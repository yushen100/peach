"""扫描与采集结束后，把已有封面、还没有样张的番号补上官方样张（ADR-0068）。

挂在处理链结算那一刻（ADR-0040 的后继），不插进逐行的循环：循环里「番号、字段、封面都齐了」
的行连网盘都不碰，而存量里最该补样张的正是这些行。一轮一条后继，一条最多看 `SCAN` 部、
联网问 `BATCH` 部；推进了又还有要补的，就原地接一条（ADR-0084），存量不必等几十次处理。

每部先读本机来源快照，处理链问过的站已经把样张地址带回来了（DMM 的 `sample_images`、
amane 桥的 `screenshot_urls`）；快照里没有才按番号分档问官方站：有码先问 DMM、没有再问 r18.dev，素人问 MGS。
写入按 ADR-0052 直接落，`source` 记 `auto:sample-images@<任务行 id>`，
`scripts/revert_auto_landing.py --source auto:sample-images` 整批撤回。

幂等（ADR-0040 第六条）：选番号时就跳过已有样张的，写入时再判一次，已有就整组跳过。
"""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from . import sample_images
from .followups import Followup, FollowupType, register
from .task_outcomes import joined, part, said
from .task_runs import item_progress, task_label

TASK_KEY = "code-samples"
TASK_LABEL = task_label(TASK_KEY)

#: 一轮只派一条，key 固定：同一件事同时只会有一条在排队或在跑。
FOLLOWUP_KEY = f"{TASK_KEY}:stock"

#: 一条后继最多联网问几部。写账本的后继共用一条串行通道，一条占太久会把补头像那几类压在后面；
#: DMM 一次约 1 秒、主机间隔 2 秒，30 部约一分半。
BATCH = 30

#: 一条后继最多看几部。快照里已有地址的不联网，一部只是一次短写入，不占 `BATCH`。
SCAN = 500

#: 一条后继的联网预算，到点就不再联网，快照里现成的照样落完，剩下的下一轮接着补。
BUDGET_SECONDS = 150.0


def plan(database, config, cover_root) -> list[dict]:
    """处理链结算时调用：还有问得着的番号就派一条，一部都没有就不派。

    这里出任何问题都只让这一轮不派，不影响处理本身的结论。
    """
    if database is None:
        return []
    covers = Path(cover_root)
    try:
        misses = sample_images.Misses(sample_images.misses_path(config.directory("generated")))
        snapshots = sample_images.snapshot_index(config.directory("sources"))
        with database.read_connection() as connection:
            found = sample_images.pending(
                connection, lambda key: (covers / f"{key}.jpg").is_file(), misses, snapshots, limit=1)
    except (OSError, sqlite3.Error):
        return []
    return [Followup.item(FOLLOWUP_KEY, TASK_KEY).declared()] if found else []


def _missing(error: Exception) -> bool:
    """这一站明确说没有：传输层 404 或契约里 `not_found` 那一档。"""
    from .jav_cover_fetch import NotFound
    from .sources import FailureReason, SourceFailure
    return isinstance(error, NotFound) or (
        isinstance(error, SourceFailure) and error.reason == FailureReason.NOT_FOUND)


class _SampleCheckpoint:
    """固定本批次番号，保留已经落库的样张与累计产物数。"""

    def __init__(self, contract, handle, misses, snapshots):
        self.handle = handle
        saved = getattr(handle, 'saved', {}) if handle is not None else {}
        saved = saved if isinstance(saved, dict) else {}
        self.completed = set(saved.get('completed_codes') or [])
        self.landed, self.images = saved.get('landed', 0), saved.get('images', 0)
        with contract.database.read_connection() as connection:
            self.codes = saved.get('codes') or sample_images.pending(
                connection, contract.has_cover, misses, snapshots, limit=SCAN)
        if handle is not None:
            handle.checkpoint(codes=self.codes)

    def mark(self, code, landed, images):
        self.completed.add(code)
        if self.handle is not None:
            self.handle.checkpoint(completed_codes=sorted(self.completed), landed=landed, images=images)


def _ask_sites(transport, code: str, sites, *, misses, paused: set, room: int, deadline: float):
    """按顺序问几站的样张：前一站说没有、出错或冷却就问下一站。

    返回 `(站, 地址, 结局, 联网次数)`；有地址时结局为空，否则是 `paused`、`recent_miss`、`deferred`（名额或预算用完）、
    `absent`（说没有，已记进失败记忆）或 `failed`，一部只记一个结局。冷却的站加进 `paused`，同批后面的番号不再问它。
    """
    from .jav_cover_fetch import DeadlineExceeded
    from .scraping_access import SourcePaused
    outcome, spent, site = "", 0, ""
    for site in sites:
        if site in paused or misses.fresh(site, code):
            outcome = outcome or ("paused" if site in paused else "recent_miss")
            continue
        if spent >= room:
            return site, [], "deferred", spent
        spent += 1
        try:
            urls = sample_images.usable(sample_images.FETCHERS[site](transport, code, deadline=deadline))
        except SourcePaused:
            # 冷却或本趟预算用完：不记「没有」。
            paused.add(site)
            outcome = "paused"
            continue
        except DeadlineExceeded:
            return site, [], "deferred", spent
        except Exception as error:  # noqa: BLE001 - 一部取不到不影响同批其余几部
            if _missing(error):
                misses.record(site, code)
                outcome = "absent"
            else:
                outcome = "failed"
            continue
        if urls:
            return site, urls, "", spent
        misses.record(site, code)
        outcome = "absent"
    return site, [], outcome, spent


def run(contract, key: str, handle, *, transport=None, clock=time.monotonic) -> dict:
    """跑一条补样张后继，返回活动页上那一行的摘要。"""
    from .jav_cover_fetch import HostLimitedTransport
    from .scraping_access import SourceTransport

    generated = Path(contract.candidate_root)
    misses = sample_images.Misses(sample_images.misses_path(generated))
    snapshots = sample_images.snapshot_index(Path(contract.follow_sources_root))
    checkpoint = _SampleCheckpoint(contract, handle, misses, snapshots)
    codes = checkpoint.codes
    if not codes:
        return {**said("noCodes"), "codes": 0}
    batch = sample_images.batch_for(getattr(handle, "run_id", None))
    owned = transport is None
    if owned:
        transport = HostLimitedTransport(
            SourceTransport(Path(contract.follow_secrets_root), max_requests=BATCH * 3,
                            max_bytes=64 * 1024 * 1024, max_seconds=BUDGET_SECONDS), 2.0)
    deadline = clock() + BUDGET_SECONDS
    landed, images = checkpoint.landed, checkpoint.images
    absent = failed = deferred = asked = 0
    #: 快照第一次看过、里面没有样张的部数：下一轮改为联网问，也算这一轮往前推了。
    probed = 0
    #: 没问站就跳过的部数，按原因分：快照里没样张又没有可问的官方站、那一站近期说过没有、那一站冷却中。
    skipped = {"no_site": 0, "recent_miss": 0, "paused": 0}
    paused: set[str] = set()
    try:
        for index, code in enumerate(codes):
            if code in checkpoint.completed:
                continue
            if handle is not None:
                handle.progress(current=max(index, len(checkpoint.completed)), total=len(codes), **item_progress(TASK_KEY, code))
            site, urls = "", []
            snapshot = sample_images.snapshot_samples(snapshots.get(code, ()))
            if snapshot:
                site, urls = snapshot
            elif code in snapshots and not misses.fresh("snapshot", code):
                # 只在第一次看过时算推进：每轮都算的话，那一站冷却时接续就停不下来。
                misses.record("snapshot", code)
                probed += 1
            if not urls:
                sites = sample_images.sites_for(code)
                if not sites:
                    skipped["no_site"] += 1
                    continue
                site, urls, outcome, spent = _ask_sites(
                    transport, code, sites, misses=misses, paused=paused,
                    room=BATCH - asked if clock() < deadline else 0, deadline=deadline)
                asked += spent
                if not urls:
                    if outcome in skipped:
                        skipped[outcome] += 1
                    elif outcome == "deferred":
                        deferred += 1
                    elif outcome == "absent":
                        absent += 1
                    else:
                        failed += 1
                    continue
            with contract.database.write_transaction() as connection:
                count = sample_images.land(connection, code, site, urls, source=batch)
            if count:
                landed += 1
                images += count
            checkpoint.mark(code, landed, images)
    finally:
        misses.save()
        if owned:
            transport.close()
    if landed:
        contract.cache_bust()
    if handle is not None:
        handle.progress(current=len(codes), total=len(codes), **item_progress(TASK_KEY), throttle=0)
    with contract.database.read_connection() as connection:
        remaining = len(sample_images.pending(connection, contract.has_cover, misses, snapshots, limit=10 ** 6))
    summary = {"codes": len(codes), "landed": landed, "images": images, "absent": absent, "failed": failed,
               "skipped": skipped, "deferred": deferred, "batch": batch, "remaining": remaining,
               # 这一轮推进了（落了、问出没有、快照看过）又还有要补的，就接着排下一轮（ADR-0084）。
               # 每推进一部，待补里就少一部或换成联网那一档，所以接续一定会停；全被冷却挡住的一轮不推进，等下一次处理。
               "continue": remaining > 0 and landed + absent + probed > 0}
    if paused:
        summary["paused"] = sorted(paused)
    return {**said(_outcome(summary)), **summary}


def _outcome(summary: dict) -> list[dict]:
    """活动页上那一行的段落：补上几部、跳过几部各为什么、还剩几部、接不接着跑。"""
    skipped, deferred, remaining = summary["skipped"], summary["deferred"], summary["remaining"]
    landed = (part("samplesLanded", landed=summary["landed"], images=summary["images"]) if summary["landed"]
              else part("noSamples"))
    reasons = [part(code, count=count) for code, count in (
        ("skipNoSite", skipped["no_site"]), ("skipRecentMiss", skipped["recent_miss"]),
        ("skipPaused", skipped["paused"]), ("skipDeferred", deferred)) if count]
    rest = part("remainingNext" if summary["continue"] else "remainingLater", count=remaining) if remaining else []
    return joined([landed, [part("skipped"), *joined(reasons, "listComma")] if reasons else [], rest])


#: 写账本：样张地址写在 `code_sample_image`。联网在事务外做，每部写一次，很短；
#: 照样走写账本那一条串行通道（ADR-0040 第二条）。
TYPE = register(FollowupType(task_key=TASK_KEY, label=TASK_LABEL, writes_ledger=True,
                             run=lambda contract, key, handle: run(contract, key, handle)))
