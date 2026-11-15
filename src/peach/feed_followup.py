"""给 Feed 发现的番号取一份资料和封面（ADR-0042 第六条）。

拉取只解出番号，壳上除了番号什么都没有——没有标题就没法在页面上认出这是哪一部。
这条后继把标题、女优、厂牌、发行日与封面地址取回来写进壳，再把封面装进本机封面目录。

**一轮拉取一条后继。** 同一轮发现的番号在活动页上是一件事，拆成一部一条，一次订阅
就是二十张一模一样的卡片；键里带着这一批的番号，重跑、去重都按这一批算。

**补封面单独排队。** 不在这一批取资料里、只缺本机封面的壳另派一条 `feed-cover`
（新作封面采集）：它只取图、不问资料来源、不写账本，走自己的通道。资料来源连不上时取资料
每部要等一轮超时，补封面若跟在后面，旧壳会被源源不断的新番号挤到轮不上。还没轮到取资料的
壳也算：取资料走写账本的串行通道，那条通道被存量补修排满时，新作要等几个小时才轮得到，
而官方封面只凭番号就能取。排在队里或正在跑的番号（`in_flight`）不再进下一批，两种批次也互不重复。

**不复用 `process_library`**：那条路以 `asset` 行为单位、要写候选 CSV、要按字段优先级链
结算到真相字段，而壳没有真相字段可写。壳上的每个值都只是「某个来源这么说」，用户复核
的时机是文件真的到手、建成 `asset` 之后。所以这里只借来源链本身
（`metadata_routes`）和发请求那一层（`library_processing.LibraryMetadataProvider`），
不借结算。

**封面走馆藏那一条。** 官方候选复用 `jav_cover_fetch.best_cover`，来源图复用详情的身份校验与缓存，落盘是
`cover_artwork.install_cover`：书脊折痕的正封框与人脸位置随图一起写进边车，新作卡和
资产卡按同一份边车取景。文件到手、建成 `asset` 之后，这张封面原样就是它的封面。

幂等（ADR-0040 第六条要求）：重跑一次只是把同样的值再写一遍，本机已有的封面不再取；
壳已经不在了就跳过那一部。
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import feeds, metadata_routes
from .catalog_rules import normalise_code_key
from .followups import Followup, FollowupType, register
from .task_runs import item_progress, run_progress, task_label
from .metadata import extract_peach_fields
from .user_messages import UserFacingError, UserValueError
from . import interface_text

TASK_KEY = "feed-scrape"
TASK_LABEL = task_label(TASK_KEY)
COVER_TASK_KEY = "feed-cover"
COVER_TASK_LABEL = task_label(COVER_TASK_KEY)
LABELS = {TASK_KEY: TASK_LABEL, COVER_TASK_KEY: COVER_TASK_LABEL}

#: 一条资料够用就停。四个标量都拿到就不再问下一家——Feed 是后台跑的，
#: 多问一家换来的是配额，而壳上的值本来就不是真相字段。
WANTED = ("title", "performers", "studio", "release_date")

#: 一批最多带几部。取资料那一批新发现的先排，余下的名额给上次没取到资料、到了重试时间的
#: 旧壳；补封面那一批按上次尝试由远到近排。
MAX_BATCH = 24

#: 取资料那一批至少留给重试旧壳的名额。订阅一轮能发现几十部新番号，不留就一部旧壳也
#: 轮不到：没取到资料的那些会一直停在页面上没有标题。
RETRY_SHARE = 6

#: 缺封面或上次没取到资料的壳，定时拉取隔多久再试一次。新片的封面常常晚于番号出现，
#: 所以不是试一次就放弃；但也不该每拉一轮源就把同一批再问一遍。人手点的那一次不等：
#: 点「检查」本身就是要现在取。
RETRY_AFTER = timedelta(hours=12)

#: 一部封面最多等多久。一部卡住不能拖住后面整批。
COVER_SECONDS = 30


def followup_key(codes, task_key: str = TASK_KEY) -> str:
    return f"{task_key}:{','.join(codes)}"


def parse_key(key: str, task_key: str = TASK_KEY) -> list[str]:
    prefix, _, body = str(key).partition(":")
    codes = [code for code in body.split(",") if code]
    if prefix != task_key or not codes:
        raise ValueError(f"unrecognized {task_key} followup key: {key}")
    return codes


def _label(codes: list[str], task_key: str = TASK_KEY) -> dict:
    if len(codes) == 1:
        return item_progress(task_key, codes[0])
    return run_progress("items", task_key, first=codes[0], count=len(codes))


def plan(codes, task_key: str = TASK_KEY) -> list[Followup]:
    """一批番号合成一条后继；一部都没有就不派。"""
    batch = list(dict.fromkeys(code for code in codes if code))[:MAX_BATCH]
    if not batch:
        return []
    return [Followup.coded(followup_key(batch, task_key), task_key, _label(batch, task_key))]


def plan_covers(codes) -> list[Followup]:
    return plan(codes, COVER_TASK_KEY)


def in_flight(task_runs, status: str = "active", task_keys=(TASK_KEY, COVER_TASK_KEY)) -> set[str]:
    """排在队里或正在跑的取资料、补封面后继里的番号键。下一批不再带它们。
    `status` 换成 `running` 或 `pending`、`task_keys` 只留一种，就是正在跑的或还排在某条队里的那几批，
    新作卡据此说清在等什么（`cover_states`）。"""
    codes: set[str] = set()
    for task_key in task_keys:
        for run in task_runs.query(status=status, task_key=task_key, limit=500):
            try:
                codes.update(normalise_code_key(code) for code in parse_key(run.followup_key, task_key))
            except ValueError:
                continue
    return codes


def has_local_cover(cover_root: Path, code: str) -> bool:
    from .library_processing import cover_settled
    key = normalise_code_key(code)
    return bool(key) and cover_settled(Path(cover_root) / f"{key}.jpg")


def scrape_batch(connection, fresh=(), *, exclude=(), now: datetime | None = None,
                 retry_after: timedelta = RETRY_AFTER,
                 hidden: frozenset[str] = feeds.DEFAULT_HIDDEN_COMPILATIONS,
                 cover_root: Path | None = None) -> list[str]:
    """下一批取资料的番号：这一轮新发现的 `fresh` 与还没取过资料的壳在前，上次没取到、
    已经过了 `retry_after` 的壳在后，并且至少留 `RETRY_SHARE` 个名额给后者。不在这一批里、
    只缺封面的归 `cover_backlog`。

    给了 `cover_root` 时，还没封面、上次取资料已过 `retry_after` 的蓝光版也算重试：
    并入配信版（`fold_bluray_edition`）要写壳，只有这一条通道写账本。

    已忽略的不算：人说了不想看，就不再替它花配额。已经入库的壳本来就不在表里
    （入库即从列表里消失，ADR-0042 第三条），这里同样用番号键排除掉。取回标题后认出是
    设置里收起的那类合集（`hidden`）也不算：页面上不列它，替它补资料的配额是白花的；
    开关打开后下一轮就轮到它。
    """
    moment = now or datetime.now(timezone.utc)
    cutoff = feeds.stamp(moment - retry_after)
    fresh = list(dict.fromkeys(code for code in fresh if code))
    skip = [*exclude, *fresh]
    untried = _first(_candidates(connection, "d.scraped_at IS NULL", (), ""),
                     skip, hidden, MAX_BATCH)
    retries = _first(_candidates(connection, "d.scrape_error IS NOT NULL AND d.scraped_at<?",
                                 (cutoff,), "d.scraped_at, "), skip, hidden, MAX_BATCH)
    if cover_root is not None:
        retries += [row["code"] for row in _visible(_candidates(
            connection, "d.scrape_error IS NULL AND d.scraped_at<?", (cutoff,), "d.scraped_at, "), skip, hidden)
            if _bluray_without_cover(row, cover_root) and row["code"] not in retries][:MAX_BATCH]
    head = [*fresh, *untried][:MAX_BATCH - min(len(retries), RETRY_SHARE)]
    return head + retries[:MAX_BATCH - len(head)]


def _bluray_without_cover(row, cover_root: Path) -> bool:
    from .jav_editions import bluray_title
    return bluray_title(row["title"]) and not has_local_cover(cover_root, row["code"])


def _first(rows, exclude, hidden, limit: int) -> list[str]:
    found: list[str] = []
    for row in _visible(rows, exclude, hidden):
        found.append(row["code"])
        if len(found) >= limit:
            break
    return found


def cover_backlog(connection, cover_root: Path, *, exclude=(), now: datetime | None = None,
                  limit: int = MAX_BATCH, retry_after: timedelta = RETRY_AFTER,
                  hidden: frozenset[str] = feeds.DEFAULT_HIDDEN_COMPILATIONS) -> list[str]:
    """本机还没有封面、上次取图已经过了 `retry_after` 的壳，资料齐了的和还没取过资料的都算。

    上次没取到资料的不算：它归 `scrape_batch` 重试，取完资料就地补封面；缺封面的蓝光版也归它，
    先并入配信版再取图。调用方把这一批取资料的番号放进 `exclude`，同一部不两头都派。
    上次取图的时间读逐番号的取图记录（`record_cover_attempt`），没试过的排最前，其余由远到近；
    同样远的新片在前。排除规则与 `scrape_batch` 相同。
    """
    from .catalog_rules import is_korean_mib_code

    cutoff = (now or datetime.now(timezone.utc)).timestamp() - retry_after.total_seconds()
    rows = _candidates(connection, "d.scrape_error IS NULL", (), "")
    due: list[tuple[float, int, str]] = []
    for position, row in enumerate(_visible(rows, exclude, hidden)):
        code = row["code"]
        key = normalise_code_key(code)
        if (not key or is_korean_mib_code(key) or has_local_cover(cover_root, code)
                or _bluray_without_cover(row, cover_root)):
            continue
        try:
            attempted = cover_attempt_path(cover_root, key).stat().st_mtime
        except OSError:
            attempted = 0.0
        if attempted < cutoff:
            due.append((attempted, position, code))
    return [code for _, _, code in sorted(due)[:limit]]


def _candidates(connection, condition: str, values: tuple, order: str):
    return connection.execute(
        "SELECT d.code,d.title,d.performers,d.studio FROM feed_discovery d"
        f" WHERE d.ignored_at IS NULL AND {condition}"
        " AND NOT EXISTS (SELECT 1 FROM asset a WHERE a.medium='video' AND a.code IS NOT NULL"
        " AND COALESCE(a.disposal,'')<>'vanished'"
        " AND normalise_code_key(a.code)=normalise_code_key(d.code))"
        f" ORDER BY {order}COALESCE(d.release_date,d.discovered_at) DESC, d.id DESC",
        values).fetchall()


def _visible(rows, exclude, hidden):
    skip = {normalise_code_key(code) for code in exclude}
    for row in rows:
        if normalise_code_key(row["code"]) in skip or feeds.compilation_kind(
                row["title"], row["performers"], row["studio"]) in hidden:
            continue
        yield row


def _cover(payload: dict) -> str | None:
    for field in ("cover_url", "cover"):
        value = str(payload.get(field) or "").strip()
        if value:
            return value
    urls = payload.get("cover_urls")
    if isinstance(urls, list):
        for value in urls:
            text = str(value or "").strip()
            if text:
                return text
    return None


def collect(provider, code: str) -> tuple[dict, str | None]:
    """按番号问来源链，返回 (字段, 封面地址)。

    问哪几家由 `metadata_routes` 决定，与刮削链同一份判据；这里没有本机证据可给，
    所以只传番号本身。一家都没给就抛——调用方把原因写进壳的 `scrape_error`，
    页面上那一行因此能说清是「还没取」还是「取不到」。

    一部最多问多久与媒体库资料处理同一份预算（`ACTION_BUDGETS['querying_metadata']`）：
    来源连不上时每家要等满超时再退避重试，不设上限一部能耗掉几分钟，整批和排在后面的
    后继都跟着等。
    """
    from .jav_cover_fetch import DeadlineExceeded
    from .library_processing import ACTION_BUDGETS
    from .processing_control import deadline_after

    chain = metadata_routes.route_for_code(code)
    budget = ACTION_BUDGETS["querying_metadata"]
    try:
        found = provider.community(
            code, deadline=deadline_after(budget),
            route=metadata_routes.community_route(code))
    except DeadlineExceeded as error:
        raise DeadlineExceeded("errors.feedFollowup.chainTimedOut",
                               {"chain": _chain(chain), "seconds": f"{budget:g}"}) from error
    fields: dict[str, object] = {}
    cover: str | None = None
    for _source, payload in found:
        if not isinstance(payload, dict):
            continue
        cover = cover or _cover(payload)
        for name, item in extract_peach_fields(payload).items():
            if name in WANTED and name not in fields:
                fields[name] = item.get("value")
        if all(name in fields for name in WANTED):
            break
    if not fields and cover is None:
        raise UserValueError("errors.feedFollowup.noMetadata", {"chain": _chain(chain)})
    return fields, cover


def fetch_cover(contract, code: str,
                cover_url: str | None = None) -> tuple[bytes, tuple[int, int], dict]:
    """取得当前作品的官方封面与来路。

    `cover_url` 是取资料那一步来源给的地址，它是官方图路径时一起参与择优。`DAZD-308`
    这类番号 r18 与本机快照里都没有，官方渠道一条候选也列不出来，来源给的却正是 DMM 那张
    封套；不收它，这部就只能在页面上拿远程图按固定比例切，书脊切不干净。
    上次装图时证据里记的地址同样参与：图片被删后证据还在，想看条目没有 `cover_url`，
    素人档的 `jp.jpg`、MGS 图这类路径只有靠它才列得回候选。
    取不到就抛；原因交给调用方记账，一部取不到不影响同批其余几部。
    """
    from .jav_cover_fetch import HostLimitedTransport, best_cover, official_image_candidates
    from .scraping_access import SourceTransport

    prior = {candidate.url: candidate for url in (cover_url, _recorded_cover_url(contract.cover_root, code))
             for candidate in official_image_candidates(url or "")}

    raw = SourceTransport(contract.follow_secrets_root, max_requests=40,
                          max_bytes=32 * 1024 * 1024, max_seconds=COVER_SECONDS)
    transport = HostLimitedTransport(raw, 1.0)
    from .cover_artwork import metadata_snapshots
    from .library_processing import _official_evidence, artwork_title
    snapshots = metadata_snapshots(contract.follow_sources_root / 'library-metadata', code)
    try:
        candidate, size, data = best_cover(
            transport, code, 0,
            metadata_root=contract.follow_sources_root / "metadata" / "javinizer-go",
            known=_official_evidence(snapshots),
            prior_candidates=tuple(prior.values()),
            deadline=time.monotonic() + COVER_SECONDS)
    finally:
        transport.close()
    digest = hashlib.sha256(data).hexdigest()
    evidence = {"code": code, "width": size[0], "height": size[1],
                "title": artwork_title(snapshots),
                "source": candidate.source, "source_url": candidate.url,
                "raw_sha256": digest, "installed_sha256": digest,
                "checked_at": time.time(), "resolver": "peach-jav-cover-v1"}
    return data, size, evidence


def _recorded_cover_url(cover_root: Path, code: str) -> str:
    try:
        evidence = json.loads((Path(cover_root) / f"{normalise_code_key(code)}.scraping.json")
                              .read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    return str(evidence.get("source_url") or "") if isinstance(evidence, dict) else ""


def cover_attempt_path(cover_root: Path, code: str) -> Path:
    return Path(cover_root).parent / 'feed-cover-attempts' / (normalise_code_key(code) + '.json')


def awaiting_official_cover(contract, code: str, release_date: str | None) -> bool:
    """还没发售、本机没有封面、上次取图官方只回「准备中」占位图：DMM 提前一个多月上架的新作常这样。
    新作列表先不放它，`/cover-image` 也不代理那张占位图；`cover_backlog` 照旧按 `RETRY_AFTER`
    重取，官方出图、本机有了封面就回到列表里。已发售的旧作不算：官方那几个地址里常有一张
    偏窄的真封面，取图记录照样写成占位图。"""
    from .jav_cover_fetch import OFFICIAL_PLACEHOLDER_ONLY, OFFICIAL_PLACEHOLDER_ONLY_CODE, PLACEHOLDER_CODE, PLACEHOLDER_REASON
    if not release_date or str(release_date)[:10] <= datetime.now().date().isoformat():
        return False
    if contract.has_cover(code):
        return False
    attempt = cover_attempt(contract.cover_root, code)
    if not attempt or attempt.get("ok"):
        return False
    # 记录里的 `reason` 是 zh-CN 原文；原因嵌在别的说法里（「DMM：…」）时也认得出。
    reason = str(attempt.get("reason") or "")
    return (attempt.get("reason_code") in (PLACEHOLDER_CODE, OFFICIAL_PLACEHOLDER_ONLY_CODE)
            or any(text in reason for text in (PLACEHOLDER_REASON, OFFICIAL_PLACEHOLDER_ONLY)))


def cover_states(contract, rows) -> dict[str, tuple[str, dict | str]]:
    """本机还没有封面的新作，封面那一格说什么：番号键 → (状态, 原因)。

    状态只有三档，判据与后台真的会怎么处理它一致，不让卡片说一套、队列做一套：

    - `fetching`：在正在跑的那一批里。
    - `queued`：排在某条队里，或者 `cover_backlog` 下一轮会捞走它（资料没出错、没忽略、从没取过图）。
    - `missing`：取过没取到，或者后台不会替它取。原因用取图记录里那句（已去掉来源地址）。

    原因是 `{code, params}` 那一句（`cover_state_fields` 拆成字段），旧取图记录只有原文时是原文。
    `rows` 是壳的行，至少带 `code`、`scrape_error`、`ignored_at`。
    """
    from .catalog_rules import is_korean_mib_code
    from .jav_cover_fetch import MIB_NOT_JAV_CODE

    running = in_flight(contract.task_runs, "running")
    covers = in_flight(contract.task_runs, "pending", (COVER_TASK_KEY,))
    scrapes = in_flight(contract.task_runs, "pending", (TASK_KEY,))
    states: dict[str, tuple[str, str]] = {}
    for row in rows:
        key = normalise_code_key(row["code"])
        if not key or contract.has_cover(key):
            continue
        attempt = cover_attempt(contract.cover_root, key)
        if key in running:
            states[key] = ("fetching", _said("fetching"))
        elif is_korean_mib_code(key):
            states[key] = ("missing", {"code": MIB_NOT_JAV_CODE, "params": {}})
        elif key in covers:
            states[key] = ("queued", _said("queuedCover"))
        elif key in scrapes:
            states[key] = ("queued", _said("queuedAfterScrape"))
        elif attempt is not None and attempt.get("ok"):
            states[key] = ("missing", _said("coverGone"))
        elif attempt is not None:
            states[key] = ("missing", _said("lastAttemptFailed", reason=attempt_reason(attempt)))
        elif row.get("ignored_at"):
            states[key] = ("missing", _said("ignored"))
        elif row.get("scrape_error"):
            states[key] = ("missing", _said("scrapeFailed"))
        else:
            states[key] = ("queued", _said("nextCheck"))
    return states


def _chain(names) -> dict | str:
    """来源链写成报错里的一个参数：`labels.feedFollowup.chainLink` 一层套一层，分隔符在资源里，各语言自己定。"""
    names = [str(name) for name in names]
    said: dict | str = names[-1] if names else ""
    for head in reversed(names[:-1]):
        said = {"code": "labels.feedFollowup.chainLink", "params": {"first": head, "rest": said}}
    return said


def _said(name: str, /, **params) -> dict:
    """封面格原因的一句：`labels.feedFollowup.cover.<名字>`。"""
    return {"code": f"labels.feedFollowup.cover.{name}", "params": params}


#: 封面格原因的名字（`_said`），文字在 `server.json` 的 `labels.feedFollowup.cover.*`。
COVER_REASONS = ("fetching", "queuedCover", "queuedAfterScrape", "coverGone", "lastAttemptFailed", "ignored",
                 "scrapeFailed", "nextCheck", "unfinished", "connectFailed")


def attempt_reason(attempt: dict) -> dict | str:
    """取图记录里那次没取到的原因：带 code 的是那一句，旧记录只有原文时是原文，什么都没记时是「封面处理未完成」。"""
    if attempt.get("reason_code"):
        return {"code": attempt["reason_code"], "params": dict(attempt.get("reason_params") or {})}
    return attempt.get("reason") or _said("unfinished")


def cover_state_fields(states: dict, code: str) -> dict:
    """新作卡封面格的字段：`cover_state`（`fetching`／`queued`／`missing`，有封面时为 None）、
    `cover_reason`（zh-CN 原文）与 `cover_reason_code`／`cover_reason_params`。"""
    state, said = states.get(normalise_code_key(code), (None, ""))
    if isinstance(said, dict):
        return {"cover_state": state, "cover_reason": interface_text.text(f"server:{said['code']}", said["params"]),
                "cover_reason_code": said["code"], "cover_reason_params": said["params"]}
    return {"cover_state": state, "cover_reason": said}


def cover_attempt(cover_root: Path, code: str) -> dict | None:
    """这个番号上次取图的记录（`record_cover_attempt`）；没取过、或记录读不出来时是 None。"""
    try:
        record = json.loads(cover_attempt_path(cover_root, code).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return record if isinstance(record, dict) else None


def record_cover_attempt(contract, code: str, *, ok: bool, error=None):
    """逐番号保存封面处理结果；不记录请求凭据或来源返回正文。文件时间就是 `cover_backlog`
    判重试的上次取图时间。"""
    from .fsutil import atomic_write_text
    path = cover_attempt_path(contract.cover_root, code)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {'code': code, 'checked_at': time.time(), 'ok': ok}
    if error is not None:
        from .jav_cover_fetch import Unavailable
        from .javdb_public import PublicSourceUnavailable
        from .remote_media_cache import RemoteMediaUnavailable
        import httpx
        if isinstance(error, (Unavailable, PublicSourceUnavailable, RemoteMediaUnavailable)):
            said = ({"code": error.code, "params": _scrubbed(error.params)} if isinstance(error, UserFacingError)
                    else _URL.sub(interface_text.text(f"server:{SOURCE_ADDRESS_CODE}"), str(error)))
        else:
            said = _said("connectFailed" if isinstance(error, httpx.TransportError) else "unfinished")
        record["error_type"] = type(error).__name__
        if isinstance(said, dict):
            record.update(reason=interface_text.text(f"server:{said['code']}", said["params"])[:300],
                          reason_code=said["code"], reason_params=said["params"])
        else:
            record["reason"] = said[:300]
    atomic_write_text(path, json.dumps(record, ensure_ascii=False))


#: 取图记录里代替网址的那一句。
SOURCE_ADDRESS_CODE = "labels.feedFollowup.sourceAddress"
_URL = re.compile(r'https?://\S+')


def _scrubbed(params: dict) -> dict:
    """取图记录不留来源地址：参数里的网址（可能带凭据）换掉，嵌套的那一句逐层换。整个参数就是网址时换成嵌套的
    `SOURCE_ADDRESS_CODE` 一句，界面按当前语言显示「来源地址」；网址夹在别的文字里时只能换成 zh-CN 那几个字。"""
    def clean(value):
        if isinstance(value, str):
            if _URL.fullmatch(value.strip()):
                return {"code": SOURCE_ADDRESS_CODE}
            return _URL.sub(interface_text.text(f"server:{SOURCE_ADDRESS_CODE}"), value)
        if isinstance(value, dict):
            return {key: clean(item) for key, item in value.items()}
        return value
    return clean(dict(params))


def ensure_cover(contract, code: str, cover_url: str | None = None) -> bool:
    """本机还没有这个番号的封面就去取来装上。返回这一部现在有没有封面。"""
    from .catalog_rules import is_korean_mib_code
    from .cover_artwork import install_cover

    key = normalise_code_key(code)
    if not key or is_korean_mib_code(key):
        return False
    if has_local_cover(contract.cover_root, key):
        return True
    try:
        data, size, evidence = fetch_cover(contract, key, cover_url)
        with contract.database.read_connection() as connection:
            row = connection.execute('SELECT title FROM feed_discovery WHERE code=?', (key,)).fetchone()
        if row and not evidence.get('title'):
            evidence = {**evidence, 'title': row['title']}
        from .community_catalog import origin_of
        from .images import measure_image_file
        target = Path(contract.cover_root) / f'{key}.jpg'
        kept = measure_image_file(target)
        incoming_community = origin_of(str(evidence.get('source_url') or '')) in ('javdb', 'javbus')
        if kept and incoming_community and size[0] * size[1] <= kept[0] * kept[1]:
            record_cover_attempt(contract, key, ok=True)
            return True
        install_cover(target, key, data, size, evidence=evidence)
    except Exception as error:
        record_cover_attempt(contract, key, ok=False, error=error)
        raise
    record_cover_attempt(contract, key, ok=True)
    return True


def performer_names(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item.get("name") or "") if isinstance(item, dict) else str(item)
                for item in value]
    return []


def _shell(contract, condition: str, value):
    with contract.database.read_connection() as connection:
        return connection.execute(
            "SELECT id,code,title,performers,scraped_at,scrape_error FROM feed_discovery"
            f" WHERE {condition}", (value,)).fetchone()


def fold_bluray_edition(contract, row) -> str | None:
    """还没封面的蓝光版壳并入 DMM 配信版，返回之后按哪个番号接着取；这一条删掉了返回 None。

    蓝光版另有品番（GRABD-039），官方封面按番号取不到，配信版（GRACE-039）是同一部片、同一张封套。
    配信版已在列表里或已入库，这一条就是重复，删掉；否则把壳改成配信版番号，资料与封面按它重取，
    已读、已忽略照旧。问不到 DMM 或对不上时原样留着，到了重试时间再问。
    """
    from .jav_editions import bluray_title, digital_edition

    code = row["code"]
    if not bluray_title(row["title"]) or has_local_cover(contract.cover_root, code):
        return code
    names = [name for name in re.split(r"[、,]", row["performers"] or "") if name.strip()]
    try:
        digital = normalise_code_key(digital_edition(row["title"], names, contract.follow_secrets_root))
    except Exception:  # noqa: BLE001 - 问不到就当这次没对上，壳原样留着
        return code
    if not digital or digital == normalise_code_key(code):
        return code
    shell = int(row["id"])
    with contract.database.write_transaction() as connection:
        if feeds.in_library(connection, digital) or connection.execute(
                "SELECT 1 FROM feed_discovery WHERE normalise_code_key(code)=? AND id<>?",
                (digital, shell)).fetchone():
            # 连接的 `PRAGMA foreign_keys` 是 OFF，子表的 `ON DELETE CASCADE` 要显式做。
            connection.execute("DELETE FROM feed_discovery_entity WHERE discovery_id=?", (shell,))
            connection.execute("DELETE FROM feed_discovery WHERE id=?", (shell,))
            return None
        connection.execute("UPDATE feed_discovery SET code=?,cover_url=NULL,scraped_at=NULL,scrape_error=NULL"
                           " WHERE id=?", (digital, shell))
    return digital


def _scrape_fields(contract, provider, row) -> bool:
    """取一部的资料写进壳。返回取没取到；取不到的原因写在壳的 `scrape_error` 上。"""
    code = row["code"]
    try:
        fields, cover = collect(provider, code)
    except Exception as error:  # noqa: BLE001 - 原因要写到壳上给人看
        with contract.database.write_transaction() as connection:
            connection.execute(
                "UPDATE feed_discovery SET scrape_error=?,scraped_at=? WHERE id=?",
                (str(error), feeds.stamp(), int(row["id"])))
        return False
    names = performer_names(fields.get("performers"))
    with contract.database.write_transaction() as connection:
        connection.execute(
            "UPDATE feed_discovery SET title=COALESCE(?,title),cover_url=COALESCE(?,cover_url),"
            "studio=COALESCE(?,studio),release_date=COALESCE(?,release_date),"
            "performers=COALESCE(?,performers),scrape_error=NULL,scraped_at=? WHERE id=?",
            (fields.get("title") or None, cover, fields.get("studio") or None,
             fields.get("release_date") or None, "、".join(name for name in names if name) or None,
             feeds.stamp(), int(row["id"])))
        for entity_id in feeds.match_performers(connection, names):
            feeds.link_entity(connection, int(row["id"]), entity_id)
    return True


def run(contract, key: str, handle) -> dict:
    """跑一批取资料。返回的摘要就是活动页上那一行：几部、取到几部、装上几张封面。

    封面断在连接上的几部另记 `cover_network`：这一类换条线路就能取到，新作页据此提示
    去配来源的连接方式，而不是让人以为官方没出图。

    检查点记的是这一批里已经试过的番号，不论取没取到：服务重启后这一条重新领取时只接着
    试余下的。没取到的那几部由 `scrape_batch`、`cover_backlog` 到了重试时间再排，不在
    同一批的续跑里每次重启都重耗一遍。
    """
    import httpx

    from .jav_cover_fetch import CoverConnectError
    from .library_processing import LibraryMetadataProvider

    codes = parse_key(key)
    provider = None
    saved = getattr(handle, 'saved', {})
    saved = saved if isinstance(saved, dict) else {}
    done = set(saved.get('done_codes') or [])
    fetched, covers = saved.get('fetched', 0), saved.get('covers', 0)
    missed, unreachable = saved.get('miss', 0), saved.get('cover_network', 0)
    for index, code in enumerate(codes):
        if code in done:
            continue
        handle.progress(current=index, total=len(codes),
                        **item_progress(TASK_KEY, code), throttle=0)
        row = _shell(contract, "code=?", code)
        if row is not None and fold_bluray_edition(contract, row) is not None:
            row = _shell(contract, "id=?", int(row["id"]))
        else:
            row = None
        if row is None:
            # 壳被删了、并进了配信版，或者这个番号这中间已经入库。都不该再取一遍。
            continue
        if row["scraped_at"] is None or row["scrape_error"] is not None:
            provider = provider or LibraryMetadataProvider(contract.follow_secrets_root)
            if _scrape_fields(contract, provider, row):
                fetched += 1
            else:
                missed += 1
        # 封面地址在取资料那一步才写上壳，所以取完再读一遍，不用循环开头那份。
        with contract.database.read_connection() as connection:
            cover_url = connection.execute(
                "SELECT cover_url FROM feed_discovery WHERE id=?", (int(row["id"]),)).fetchone()
        try:
            covers += ensure_cover(contract, row["code"], cover_url[0] if cover_url else None)
        except (CoverConnectError, httpx.TransportError):
            unreachable += 1
        except Exception:  # noqa: BLE001 - 取不到封面这一部照样有资料，下一轮再试
            pass
        # 记下这一次尝试，没取到资料的由 `scrape_batch` 按它隔 `RETRY_AFTER` 再试；封面的重试另看取图记录。
        with contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET scraped_at=? WHERE id=?",
                               (feeds.stamp(), int(row["id"])))
        done.add(code)
        handle.checkpoint(done_codes=sorted(done), fetched=fetched, covers=covers,
                          miss=missed, cover_network=unreachable)
    handle.progress(current=len(codes), total=len(codes), **item_progress(TASK_KEY), throttle=0)
    contract.cache_bust()
    summary = {"total": len(codes), "ok": fetched, "miss": missed, "covers": covers}
    if unreachable:
        summary["cover_network"] = unreachable
    return summary


def run_covers(contract, key: str, handle) -> dict:
    """跑一批补封面：只取图装进本机封面目录，不问资料来源、不写账本。摘要同取资料那一行，
    连不上图片主机的几部同样另记 `cover_network`。"""
    import httpx

    from .jav_cover_fetch import CoverConnectError

    codes = parse_key(key, COVER_TASK_KEY)
    saved = getattr(handle, 'saved', {})
    saved = saved if isinstance(saved, dict) else {}
    done = set(saved.get('done_codes') or [])
    covers = saved.get('covers', 0)
    unreachable = saved.get('cover_network', 0)
    for index, code in enumerate(codes):
        if code in done:
            continue
        handle.progress(current=index, total=len(codes),
                        **item_progress(COVER_TASK_KEY, code), throttle=0)
        with contract.database.read_connection() as connection:
            row = connection.execute(
                "SELECT cover_url FROM feed_discovery WHERE code=? AND ignored_at IS NULL",
                (code,)).fetchone()
        if row is not None:
            try:
                covers += ensure_cover(contract, code, row["cover_url"])
            except (CoverConnectError, httpx.TransportError):
                unreachable += 1
            except Exception:  # noqa: BLE001 - 取图记录里有原因，到了重试时间再排
                pass
        done.add(code)
        handle.checkpoint(done_codes=sorted(done), covers=covers, cover_network=unreachable)
    handle.progress(current=len(codes), total=len(codes), **item_progress(COVER_TASK_KEY), throttle=0)
    contract.cache_bust()
    summary = {"total": len(codes), "covers": covers}
    if unreachable:
        summary["cover_network"] = unreachable
    return summary


#: 写账本：壳与实体关联都在 `ledger.db` 里，所以它走串行那条通道。
TYPE = register(FollowupType(task_key=TASK_KEY, label=TASK_LABEL,
                             writes_ledger=True, run=run))
#: 补封面只写封面目录与取图记录，走自己的通道，不排在写账本的后继后面。
COVER_TYPE = register(FollowupType(task_key=COVER_TASK_KEY, label=COVER_TASK_LABEL,
                                   writes_ledger=False, run=run_covers))
