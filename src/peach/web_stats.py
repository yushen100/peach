"""数据面板：库存统计、存储卷、口味窗口、搜索历史与画质目标。

这一域的输出全是聚合数，没有一条是真相字段：它们要么来自 `COUNT`/`SUM`，要么来自
浏览历史分析产出的 JSON。因此这里的函数都可以走 `contract.cached()`，也都必须能在
缓存被 `cache_bust()` 清掉时安全丢弃结果——口径见 `web_state.WebContract.cached`。

存储卷一节读的是真实挂载点：不在线的来源要显示成「未挂载」而不是 0 字节，
否则面板会把一整块外置盘报告成「空的」。
"""
from __future__ import annotations

import json
import os
import re
import threading
import time

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from .catalog_rules import tag_cat
from .catalog_vocabulary import LENGTH_BANDS, QUALITY_BANDS
from . import media_libraries, settings_file
from .config import LOCATION_ROOT_DECLARATIONS
from .fsutil import atomic_write_text
from .media_io import volume_usage
from .platform import is_unmapped, system_volume, translate_ledger_path
from .taste_history import (
    analyze_history,
    build_taste_dashboard,
    phrase_fields,
    refresh_history,
    remove_history_source,
    store_version,
    taste_phrase,
    taste_text,
    write_manifest,
)
from .user_messages import UserFacingError, UserInterruptedError, UserRuntimeError, error_fields, message_fields
from .web_activity import DEFAULT_PROFILE_ID
from .web_catalog import attach_avatar_availability, tag_is_not_a_performer_name, tag_not_hidden
from .media_sources import cost_for
from .web_state import CACHE_TTL, WebContract, path_version
from .taste_browsers import browser_sources, configure_browser, enabled_history_sources, enabled_bookmark_sources
from .taste_bookmarks import refresh_bookmarks


def q_search_history(contract: WebContract, limit: int = 10):
    with contract.read_connection() as connection:
        rows = connection.execute(
            "SELECT query FROM search_history ORDER BY last_used_at DESC, query LIMIT ?",
            (max(1, min(limit, 50)),),
        ).fetchall()
    return {"items": [row["query"] for row in rows]}


TASTE_WINDOWS = {"all": None, "7d": 7, "30d": 30, "90d": 90, "365d": 365}


def _taste_since(window: str) -> str | None:
    if window not in TASTE_WINDOWS:
        raise ValueError("invalid taste window")
    days = TASTE_WINDOWS[window]
    return (datetime.now(UTC) - timedelta(days=days)).isoformat() if days else None


def taste_inputs(contract: WebContract, window: str) -> tuple:
    """`q_taste` 读到的账本之外的东西的版本，与账本版本号一起构成看板快照的版本。

    浏览历史库、分析清单与导入目录由 `scripts/taste_history.py` 在进程外写；榜单上的
    圆头像读头像目录。有时间窗的视图起点每天滑一格，按日期重算一次。
    """
    return (store_version(contract.taste_history_store),
            path_version(contract.taste_history_manifest),
            path_version(contract.taste_history_import_root),
            path_version(contract.avatar_root),
            (_taste_since(window) or "")[:10])


#: 看板重算最多等这么久。账本里与口味无关的写入（播放、关注检查）之后重算不到一秒，
#: 照常等新结果；身份输入变了或进程刚起时要十几秒，就先回上一份并标 `stale`，后台
#: 算完再换，不让一个页面占住整个服务。
TASTE_FRESH_WAIT = 1.0


#: 重算失败后，同一份输入在这段时间内不再重算：失败多半是确定性的（库损坏、代码错误），
#: 页面每两秒一问就每两秒起一趟必然失败的计算。输入变了、或页面点「立即重试」照常重算。
TASTE_RETRY_AFTER = 300.0

#: 口味看板实际读到的账本表，`test_ledger_revision.DeclaredTablesTests` 用 SQLite 授权回调
#: 实测核对。长任务写别的表（关注检查、资料处理的状态与任务心跳）不让看板重算。
TASTE_TABLES = ("asset", "asset_entity", "asset_preference", "entity", "entity_alias",
                "entity_classification", "entity_link", "follow_source")


class _TasteSnapshot:
    """一个范围最近算出的看板、它对应的输入版本、正在后台重算的那一趟，以及最近一次失败。"""

    def __init__(self):
        self.version = None
        self.payload: dict | None = None
        self.computed_at: str | None = None
        self.worker: threading.Thread | None = None
        self.error: Exception | None = None
        #: 最近一次失败对应的输入版本与时刻（`time.monotonic()`）。
        self.failed_version = None
        self.failed_at = 0.0


_TASTE_SNAPSHOTS: dict[tuple[str, str, str], _TasteSnapshot] = {}
_TASTE_LOCK = threading.Lock()


def _taste_version(contract: WebContract, window: str):
    """口味依赖表的版本号、代码指纹加 `taste_inputs`，转成 JSON 再读回，内存与磁盘上的
    版本才能直接比。代码指纹含版本号与口味各模块的源码，升级后落盘的旧快照不算新鲜。"""
    from .taste_preferences import _policy_fingerprint
    revision = contract.ledger_revision(TASTE_TABLES)
    if revision is None:
        # 账本还没有版本号时按缓存时效分段，同 `cached_until_changed` 的退路。
        revision = f"ttl:{int(time.time() // CACHE_TTL)}"
    return json.loads(json.dumps([revision, _policy_fingerprint(), *taste_inputs(contract, window)],
                                 default=str))


def _taste_snapshot_path(contract: WebContract, window: str):
    return contract.taste_history_store.with_name(f"dashboard-cache-{window}.json")


def _load_taste_snapshot(contract: WebContract, window: str, snapshot: _TasteSnapshot) -> None:
    """进程重启后先接上一次的看板：输入没变就是现成结果，变了也有一份可以先显示。"""
    try:
        saved = json.loads(_taste_snapshot_path(contract, window).read_text(encoding="utf-8"))
        snapshot.version, snapshot.payload, snapshot.computed_at = (
            saved["version"], saved["payload"], saved["computed_at"])
    except (OSError, ValueError, KeyError, TypeError):
        pass


def _compute_taste_snapshot(contract: WebContract, window: str, version, snapshot: _TasteSnapshot) -> None:
    try:
        payload = q_taste(contract, {"window": window})
    except Exception as error:  # 没有旧结果时请求线程原样抛给调用方，有旧结果时随 stale 下发
        with _TASTE_LOCK:
            snapshot.error, snapshot.failed_version, snapshot.failed_at = (
                error, version, time.monotonic())
        return
    computed_at = datetime.now(UTC).isoformat()
    with _TASTE_LOCK:
        snapshot.version, snapshot.payload, snapshot.computed_at = version, payload, computed_at
        snapshot.error, snapshot.failed_version = None, None
    if contract.taste_history_store.parent.is_dir():
        try:
            atomic_write_text(_taste_snapshot_path(contract, window), json.dumps(
                {"version": version, "computed_at": computed_at, "payload": payload},
                ensure_ascii=False, default=str), mode=0o600)
        except OSError:
            pass


def taste_snapshot(contract: WebContract, window: str, *, retry: bool = False) -> dict:
    """`/api/taste`：输入版本没变就回现成的看板，变了就在后台重算。

    重算在 `TASTE_FRESH_WAIT` 内完成就回新结果；没完成先回上一份，带上 `stale` 与
    `computed_at`，页面据此标出数据时间并稍后再问。一份都没有时等到算完。同一范围同时
    只有一趟在算。

    同一份输入算失败后，`TASTE_RETRY_AFTER` 内不再重算：有旧结果时回旧结果并带 `error`，
    页面据此停止轮询、给出重试入口；没有旧结果时抛出那次的错误。`retry` 跳过这段等待。
    """
    _taste_since(window)
    version = _taste_version(contract, window)
    key = (str(contract.db_path), str(contract.taste_history_store), window)
    with _TASTE_LOCK:
        snapshot = _TASTE_SNAPSHOTS.get(key)
        if snapshot is None:
            snapshot = _TASTE_SNAPSHOTS[key] = _TasteSnapshot()
            _load_taste_snapshot(contract, window, snapshot)
        if retry:
            snapshot.failed_version = None
        failed = (snapshot.failed_version == version
                  and time.monotonic() - snapshot.failed_at < TASTE_RETRY_AFTER)
        waiting = snapshot.version != version and not failed
        if waiting and not (snapshot.worker and snapshot.worker.is_alive()):
            snapshot.worker = threading.Thread(
                target=_compute_taste_snapshot, args=(contract, window, version, snapshot),
                name=f"peach-taste-{window}", daemon=True)
            snapshot.worker.start()
        worker, empty = snapshot.worker, snapshot.payload is None
    if waiting:
        worker.join(None if empty else TASTE_FRESH_WAIT)
    with _TASTE_LOCK:
        if snapshot.payload is None:
            # 没有结果也没有错误：按内部故障回 500，与改成 code 之前相同。
            raise snapshot.error or UserRuntimeError("errors.webStats.tasteNotFound", status_code=500)
        stale = snapshot.version != version
        result = {**snapshot.payload, "computed_at": snapshot.computed_at, "stale": stale}
        if stale and snapshot.failed_version == version and snapshot.error is not None:
            result["error"] = str(snapshot.error) or type(snapshot.error).__name__
            if isinstance(snapshot.error, UserFacingError):
                result.update(error_fields(snapshot.error))
        return result


#: 口味榜里会出圆头像的两排，以及页面上读得到它们的那几个榜单键。标签榜和网站榜
#: 不出脸，域名那排出的是站点 favicon，都不在这里。
TASTE_FACE_RANKINGS = {
    "creator": ("creators", "browser_creators", "peach_creators"),
    "performer": ("performers", "browser_performers", "peach_performers"),
}


def _attach_taste_face_availability(contract: WebContract, rankings: dict) -> None:
    """给口味榜的人像行标上「实体图和代表作头像取不取得到」。

    榜行和别处的身份引用形状不一样（`entity_id` 与 `representative_asset_id` 是行
    自己的列，不是嵌在 `entity_ref` 里），但判据是同一对：`has_entity_image()` 加
    `has_avatar()`。缺了标志这两排就只能无条件出图、等 404 再把图摘掉。

    同一个 dict 会同时出现在多个榜单里（`peach_creators` 是 `creators` 过滤出来的
    子集，不是副本），所以按对象身份去重再标一次——否则代表作那次批量查询要按榜单
    数量重复跑。
    """
    for kind, keys in TASTE_FACE_RANKINGS.items():
        rows = list({id(row): row for key in keys
                     for row in rankings.get(key) or ()}.values())
        if not rows:
            continue
        for row in rows:
            row["has_image"] = contract.has_entity_image(kind, row.get("entity_id"))
            row["image_version"] = contract.entity_image_version(kind, row.get("entity_id"))
            #: 榜上那颗 30 px 的圆头像和别处同一份 sidecar、同一个换算。框越小，几何
            #: 居中切掉脸的代价越大——这一格除了脸没有别的东西能认人。
            row["avatar_focus"] = contract.avatar_focus(kind, row.get("entity_id"))
        attach_avatar_availability(contract, rows, key="representative_asset_id")


def q_taste(contract: WebContract, args=None):
    args = args or {}
    window = str(args.get("window") or "all")
    with contract.read_connection() as connection:
        payload = build_taste_dashboard(
            contract.taste_history_store,
            connection,
            since=_taste_since(window),
        )
    # 取图可用性在库连接之外判：它读的是头像目录的索引，不是账本。
    _attach_taste_face_availability(contract, payload.get("rankings") or {})
    updated_at = None
    try:
        manifest = json.loads(contract.taste_history_manifest.read_text(encoding="utf-8"))
        updated_at = manifest.get("updated_at")
    except (OSError, ValueError, TypeError):
        pass
    export_count = export_bytes = 0
    try:
        for path in contract.taste_history_import_root.iterdir():
            if path.is_file() and not path.name.endswith(".part"):
                export_count += 1
                export_bytes += path.stat().st_size
    except OSError:
        pass
    payload.update({
        "window": window,
        "updated_at": updated_at,
        "storage": {"exports": export_count, "bytes": export_bytes},
        "browsers": browser_sources(contract.taste_history_store),
    })
    return payload


def w_taste_refresh(contract: WebContract, body, *, progress=None, checkpoint=None, resume_state=None):
    if body.get("background"):
        job = contract.taste_refresh_job
        def work(job_id):
            result = w_taste_refresh(contract, {**body, "background": False},
                progress=lambda **fields: job.update(job_id, **fields),
                checkpoint=lambda **fields: job.checkpoint(job_id, **fields), resume_state=job.snapshot())
            job.update(job_id, **result, status="complete", **message_fields(
                "jobMessage.webStats.partialHistory" if result["warnings"] else "jobMessage.webStats.analysisUpdated"),
                completed_at=time.time())
        return job.start(work, restart=True, initial={
            "stage": "discovering", **message_fields("jobMessage.webStats.findingProfiles")},
            recovery={'background': True, 'window': body.get('window') or 'all'})
    window = str(body.get("window") or "all")
    sources = enabled_history_sources(contract.taste_history_store)
    results = list((resume_state or {}).get('refresh_results') or [])
    completed = set((resume_state or {}).get('completed_profiles') or [])
    plans = (
            ('history', sources, refresh_history),
            ('bookmarks', enabled_bookmark_sources(contract.taste_history_store), refresh_bookmarks))
    profile_keys = (resume_state or {}).get('profile_keys')
    if profile_keys is None:
        profile_keys = [f'{kind}:{source.browser}:{source.profile}:{source.path}'
                        for kind, selected, _refresh in plans for source in selected]
        if checkpoint and not checkpoint(profile_keys=profile_keys):
            raise UserInterruptedError("errors.webStats.tasteReadStopped")
    def profile_progress(**fields):
        if progress:
            progress(**{**fields, 'checked': len(completed), 'total': len(profile_keys)})
    for kind, selected, refresh in plans:
        for source in selected:
            key = f'{kind}:{source.browser}:{source.profile}:{source.path}'
            if key in completed or key not in profile_keys:
                continue
            rows = refresh([source], contract.taste_history_store, progress=profile_progress)
            results.extend(rows)
            if rows and all(row.get('status') != 'failed' for row in rows):
                completed.add(key)
            if checkpoint and not checkpoint(refresh_results=results.copy(), completed_profiles=sorted(completed),
                                              checked=len(completed), total=len(profile_keys)):
                raise UserInterruptedError("errors.webStats.tasteReadStopped")
    if contract.taste_history_store.is_file():
        analysis = analyze_history(contract.taste_history_store, contract.taste_history_root, progress=progress)
        write_manifest(contract.taste_history_manifest, results, analysis)
    contract.cache_bust()
    if progress:
        progress(stage="dashboard", checked=0, total=None, **message_fields("jobMessage.webStats.summarizing"))
    return {"refresh": results, **_refresh_warnings(results), "dashboard": q_taste(contract, {"window": window})}


def _refresh_warnings(results: list[dict]) -> dict:
    """没读成的来源各一条：`warnings` 是按 zh-CN 渲染好的原句，`warning_codes`、`warning_params` 与它一一对应。
    续跑时接上的旧结果没有 `error_code`，原因照原文放进参数。"""
    params = [{"browser": row["browser"],
               "profile": taste_phrase(BOOKMARK_PROFILE_CODE, {"profile": row["profile"]}, fallback=row["profile"])
               if row.get("kind") == "bookmarks" else row["profile"],
               "reason": taste_phrase(row["error_code"], row.get("error_params"), fallback=str(row["error"]))
               if row.get("error_code") else str(row["error"])}
              for row in results if row.get("status") == "failed"]
    return {"warnings": [taste_text(REFRESH_WARNING_CODE, item) for item in params],
            "warning_codes": [REFRESH_WARNING_CODE] * len(params), "warning_params": params}


def w_taste_source(contract: WebContract, body):
    if body.get("operation") in ("add", "disable", "enable", "delete_browser"):
        configure_browser(contract.taste_history_store, body["operation"], body)
        if body["operation"] == "delete_browser":
            analysis = analyze_history(contract.taste_history_store, contract.taste_history_root)
            write_manifest(contract.taste_history_manifest, [], analysis)
        contract.cache_bust()
        return {"dashboard": q_taste(contract, {"window": str(body.get("window") or "all")})}
    if body.get("operation") != "remove":
        raise ValueError("invalid taste source operation")
    source_key = str(body.get("source_key") or "")
    if not re.fullmatch(r"[0-9a-f]{64}", source_key):
        raise ValueError("invalid taste source key")
    removed = remove_history_source(contract.taste_history_store, source_key)
    analysis = analyze_history(contract.taste_history_store, contract.taste_history_root)
    write_manifest(contract.taste_history_manifest, [{"removed": removed}], analysis)
    contract.cache_bust()
    return {
        "removed": removed,
        "dashboard": q_taste(contract, {"window": str(body.get("window") or "all")}),
    }


def w_search_history(contract: WebContract, body):
    operation = body.get("operation", "remember")
    query = str(body.get("query", "")).strip()
    if operation == "remove":
        if not query:
            raise ValueError("query is required")
        with contract.write_transaction() as connection:
            connection.execute("DELETE FROM search_history WHERE query=?", (query,))
        return {"ok": True, "operation": operation}
    if operation != "remember" or not query or len(query) > 200:
        raise ValueError("invalid search history request")
    with contract.write_transaction() as connection:
        connection.execute(
            "INSERT INTO search_history(query,used_count,last_used_at) VALUES(?,1,datetime('now')) "
            "ON CONFLICT(query) DO UPDATE SET used_count=used_count+1,last_used_at=excluded.last_used_at",
            (query,),
        )
    return {"ok": True, "operation": operation}

#: 有显示名的存储卷种类：`taste.volume.<种类>.name`，一个来源有几个根时用 `.numbered` 带序号。
#: 不在这里的来源代号原样显示。
STORAGE_KINDS = ("system", "local", "115", "pikpak")
#: 每个根的在线与容量探测期限（秒）；网盘挂载卡住时这一行按离线显示。
VOLUME_PROBE_SECONDS = 10.0
REFRESH_WARNING_CODE = "taste.refreshWarning"
#: 书签来源的资料名：「资料名 · 书签」，按界面语言写。
BOOKMARK_PROFILE_CODE = "taste.bookmarkProfile"


def _volume_label(kind: str, index: int | None = None) -> dict:
    """存储卷的显示名：`label` 原文，配 `label_code` 与 `label_params`。"""
    if kind not in STORAGE_KINDS:
        return {"label": kind if index is None else f"{kind} {index}", "label_code": None, "label_params": {}}
    if index is None:
        return phrase_fields("label", code=f"taste.volume.{kind}.name")
    return phrase_fields("label", code=f"taste.volume.{kind}.numbered", params={"index": index})


def _volume_key(root, device) -> tuple[object, ...]:
    """根目录所在的那块卷：同一块卷上的几个根读到的是同一份容量，汇总时只算一次。

    `device` 是 `st_dev`：Windows 上是卷序列号，网盘挂载没有卷 GUID 也有它；POSIX 上是设备号。
    读不到或为 0（有的挂载不报序列号）就认不出是哪块卷，按根各算一卷。
    """
    return ("device", device) if device else ("root", os.path.normcase(str(root)))


def _probe_volume(root, is_system: bool) -> dict:
    """在可终止的子进程里判在线、读容量；卡住或读不到都按离线，统计页和启动预热不跟着卡。"""
    try:
        return volume_usage(root, system=is_system, timeout=VOLUME_PROBE_SECONDS)
    except OSError:
        return {"online": False}


def _storage_volumes() -> list[dict[str, object]]:
    """返回当前主机可验证的系统卷、资源盘和网盘容量。

    一个根一行；取得容量的行带私有的 `_volume`，供 `_storage_stats` 按卷汇总，输出前去掉。
    """
    declarations = [("system", _volume_label("system"), system_volume(), True)] + [
        # 一个来源有几个根就几行；同名来源用序号区分，单根不加。
        (location, _volume_label(location, index + 1 if len(roots) > 1 else None),
         translate_ledger_path(root), False)
        for location, roots in LOCATION_ROOT_DECLARATIONS.items()
        for index, root in enumerate(roots)
    ]
    probing = [(root, is_system) for _kind, _label, root, is_system in declarations if not is_unmapped(root)]
    # 各根并行探测，整页最多等一个期限。
    with ThreadPoolExecutor(max_workers=max(len(probing), 1), thread_name_prefix="peach-volume") as pool:
        probes = dict(zip(probing, pool.map(lambda item: _probe_volume(*item), probing)))
    volumes: list[dict[str, object]] = []
    for kind, label, root, is_system in declarations:
        probe = probes.get((root, is_system), {"online": False})
        mounted = bool(probe.get("online"))
        row: dict[str, object] = {
            "kind": kind,
            **label,
            "root": str(root) if not is_unmapped(root) else None,
            "online": mounted,
            "free": None,
            "used": None,
            "total": None,
        }
        if mounted and probe.get("total") is not None:
            row.update(
                free=probe["free"],
                used=max(probe["total"] - probe["free"], 0),
                total=probe["total"],
                _volume=_volume_key(root, probe.get("device")),
            )
        volumes.append(row)
    return volumes


#: 库存一节只数盘上还在的：标「已消失」的行留着只为个人记录（ADR-0087），不算库存。
#: 回收站里的照旧算进来。播放与消费一节是个人记录本身，不套这一条。
PRESENT = "COALESCE(disposal,'')<>'vanished' AND NOT peach_is_local_extra(name,path)"
PRESENT_A = "COALESCE(a.disposal,'')<>'vanished' AND NOT peach_is_local_extra(a.name,a.path)"


#: 视频的时长与画质分档（`LENGTH_BANDS`、`QUALITY_BANDS`）是账本 `ctx_length`、`ctx_quality` 的取值，
#: 定义在 `catalog_vocabulary`；时长档的显示名由前端按取值给。
#: 画质档里要翻译的那一档（最低一档的取值是中文词）的显示名 code；其余档名本身就是通用写法。
QUALITY_LABEL_CODES = {QUALITY_BANDS[-1]: "taste.qualityBand.low"}


def _bands(c, column: str, order: tuple[str, ...], codes: dict[str, str] | None = None) -> list[dict[str, object]]:
    """一列分档的视频数。判据里的档位按顺序全列出来，没有视频的读 0；账本里多出的档排在后面。
    `codes` 里有的档带上显示名的 `label_code`。"""
    counts = {row[0]: row[1] for row in c.execute(
        f"SELECT {column},count(*) FROM asset WHERE medium='video' AND {column} IS NOT NULL "
        f"AND {PRESENT} GROUP BY {column}")}
    extra = sorted(key for key in counts if key not in order)
    codes = codes or {}
    return [{"k": key, "n": counts.get(key, 0), **({"label_code": codes[key]} if key in codes else {})}
            for key in (*order, *extra)]


#: 在线追更的一条播放不算进来的条件：它关联的馆藏视频自己已经有这一项。和 `online_played`
#: 同一个去重，一个作品在两边都播过只算一次。
_ONLINE_ONLY = ("(fi.asset_id IS NULL OR NOT EXISTS(SELECT 1 FROM asset a "
                "WHERE a.id=fi.asset_id AND {}))")


def _utc_offset(moment: datetime) -> str:
    offset = moment.strftime("%z") or "+0000"
    return f"UTC{offset[:3]}:{offset[3:]}"


def _play_activity(c, has_follow: bool) -> dict[str, object]:
    """每个作品最近一次播放落在哪一天、星期几的哪个钟点，按本机时区算。

    形状同口味页的 `activity`（`days`、`hours`、`timezone`），前端两处共用一张热力卡。
    账本每个作品只记最近一次播放的时间，所以一个作品只占一格。"""
    stamps = [row[0] for row in c.execute(
        "SELECT CAST(last_played AS REAL) FROM asset WHERE last_played IS NOT NULL")]
    if has_follow:
        stamps += [row[0] for row in c.execute(
            "SELECT CAST(fp.last_played AS REAL) FROM follow_playback fp "
            "JOIN follow_item fi ON fi.id=fp.follow_item_id WHERE fp.last_played IS NOT NULL AND "
            + _ONLINE_ONLY.format("a.last_played IS NOT NULL"))]
    days: dict[str, int] = {}
    hours: dict[tuple[int, int], int] = {}
    for stamp in stamps:
        if not stamp or stamp <= 0:
            continue
        try:
            moment = datetime.fromtimestamp(stamp).astimezone()
        except (OverflowError, OSError, ValueError):
            continue
        day = moment.date().isoformat()
        days[day] = days.get(day, 0) + 1
        slot = (moment.weekday(), moment.hour)
        hours[slot] = hours.get(slot, 0) + 1
    return {
        "timezone": _utc_offset(datetime.now().astimezone()),
        "days": [{"date": day, "count": count} for day, count in sorted(days.items())],
        "hours": [{"weekday": weekday, "hour": hour, "count": count}
                  for (weekday, hour), count in sorted(hours.items())],
    }


def _replays(c, has_follow: bool) -> list[dict[str, int]]:
    """播放次数的分布：播过 k 次的作品有几个。合计与 `consumption.played` 相同。"""
    counts: dict[int, int] = {}
    rows = list(c.execute("SELECT play_count,count(*) FROM asset WHERE play_count>0 GROUP BY play_count"))
    if has_follow:
        rows += c.execute(
            "SELECT fp.play_count,count(*) FROM follow_playback fp JOIN follow_item fi "
            "ON fi.id=fp.follow_item_id WHERE fp.play_count>0 AND "
            + _ONLINE_ONLY.format("a.play_count>0") + " GROUP BY fp.play_count").fetchall()
    for plays, n in rows:
        counts[int(plays)] = counts.get(int(plays), 0) + n
    return [{"k": plays, "n": n} for plays, n in sorted(counts.items())]


#: 库存聚合只依赖编目内容，起播更新的消费统计单独核验完整 asset 版本。
STATS_TABLES = ("asset_catalog", "asset_entity", "entity", "entity_alias", "asset_tag", "asset_tag_preference")
PLAY_STATS_TABLES = ("asset", "asset_preference", "follow_playback", "follow_item", "follow_source")


def q_stats(contract: WebContract):
    """库存、消费与存储卷分别按各自依赖缓存。"""
    config = settings_file.active()
    libraries = [(library, media_libraries.predicate(config, library["id"]))
                 for library in media_libraries.libraries(config)]
    out = dict(contract.cached_until_changed(
        "stats-ledger", lambda: _ledger_stats(contract, libraries),
        repr(libraries), tables=STATS_TABLES))
    out.update(contract.cached_until_changed(
        "stats-playback", lambda: _playback_stats(contract),
        _utc_offset(datetime.now().astimezone()), tables=PLAY_STATS_TABLES))
    out.update(contract.cached_for("stats-storage", _storage_stats, ttl=CACHE_TTL))
    return out


def _ledger_stats(contract: WebContract, libraries) -> dict:
    with contract.read_connection() as c:
        out = {}
        out["by_loc"] = [dict(r) for r in c.execute(
            "SELECT location k, count(*) n, COALESCE(sum(size),0) bytes, "
            "SUM(CASE WHEN medium='video' THEN 1 ELSE 0 END) videos "
            f"FROM asset WHERE {PRESENT} GROUP BY location ORDER BY bytes DESC")]
        out["by_medium"] = [dict(r) for r in c.execute(
            "SELECT medium k, count(*) n, COALESCE(sum(size),0) bytes "
            f"FROM asset WHERE {PRESENT} GROUP BY medium ORDER BY bytes DESC")]
        out["by_length"] = _bands(c, "ctx_length", LENGTH_BANDS)
        out["by_quality"] = _bands(c, "ctx_quality", QUALITY_BANDS, QUALITY_LABEL_CODES)
        out["by_library"] = []
        for library, (clause, params) in libraries:
            counts = c.execute(
                "SELECT count(*) videos,COALESCE(sum(a.size),0) bytes FROM asset a "
                f"WHERE a.medium='video' AND {PRESENT_A} AND " + clause, params,
            ).fetchone()
            out["by_library"].append({"k": library["id"], "name": library["name"],
                                      "icon": library["icon"], **dict(counts)})
        v = c.execute(f"SELECT count(*) FROM asset WHERE medium='video' AND {PRESENT}").fetchone()[0]
        def one(sql, *a):
            r = c.execute(sql, a).fetchone()
            return r[0] if r else 0
        out["attribution"] = {
            "videos": v,
            "creator": one("SELECT count(DISTINCT ae.asset_id) FROM asset_entity ae "
                           "JOIN entity e ON e.id=ae.entity_id JOIN asset a ON a.id=ae.asset_id "
                           f"WHERE a.medium='video' AND {PRESENT_A} AND e.kind='creator'"),
            "code": one(f"SELECT count(*) FROM asset WHERE medium='video' AND {PRESENT} "
                        "AND code IS NOT NULL AND code<>''"),
            "studio": one("SELECT count(DISTINCT ae.asset_id) FROM asset_entity ae "
                          "JOIN entity e ON e.id=ae.entity_id JOIN asset a ON a.id=ae.asset_id "
                          f"WHERE a.medium='video' AND {PRESENT_A} AND e.kind='studio'"),
            "thumb": one(f"SELECT count(*) FROM asset WHERE medium='video' AND {PRESENT} "
                         "AND snapshot_path IS NOT NULL"),
            "duration": one(f"SELECT count(*) FROM asset WHERE medium='video' AND {PRESENT} "
                            "AND duration IS NOT NULL"),
        }
        out["tag_source"] = [dict(r) for r in c.execute(
            "SELECT source k, count(*) n, count(DISTINCT asset_id) assets "
            "FROM asset_tag GROUP BY source ORDER BY n DESC")]
        # 内容标签与详情页同一口径：不按写入来源挑（刮削、批次、复核、手动都算），
        # 只去掉演员名和用户隐藏的标签；覆盖与排行用同一判据。
        content_tags = ("FROM asset_tag t JOIN asset a ON a.id=t.asset_id "
                        f"WHERE a.medium='video' AND {PRESENT_A} "
                        "AND " + tag_is_not_a_performer_name("peach_normalize(t.tag)") + " "
                        "AND " + tag_not_hidden('t.asset_id', 'peach_normalize(t.tag)') + " ")
        out["tag_cov"] = one("SELECT count(DISTINCT t.asset_id) " + content_tags)
        out["top_tags"] = [dict(r, cat=tag_cat(r["k"])) for r in c.execute(
            "SELECT t.tag k, count(*) n " + content_tags + "GROUP BY t.tag ORDER BY n DESC LIMIT 30")]
    return out


def _playback_stats(contract: WebContract) -> dict:
    with contract.read_connection() as c:
        out = {}
        def one(sql, *args):
            row = c.execute(sql, args).fetchone()
            return row[0] if row else 0
        tables = {row[0] for row in c.execute(
            "SELECT name FROM sqlite_schema WHERE type='table'"
        )}
        library_played = one("SELECT count(*) FROM asset WHERE play_count>0")
        library_seconds = one("SELECT COALESCE(sum(play_seconds),0) FROM asset")
        online_played = 0
        online_seconds = 0
        has_follow = "follow_playback" in tables
        if has_follow:
            online_played = one(
                "SELECT count(*) FROM follow_playback fp JOIN follow_item fi "
                "ON fi.id=fp.follow_item_id WHERE fp.play_count>0 AND "
                + _ONLINE_ONLY.format("a.play_count>0")
            )
            online_seconds = one(
                "SELECT COALESCE(sum(play_seconds),0) FROM follow_playback"
            )
        out["consumption"] = {
            "played": library_played + online_played,
            "library_played": library_played,
            "online_played": online_played,
            "play_seconds": library_seconds + online_seconds,
            "library_play_seconds": library_seconds,
            "online_play_seconds": online_seconds,
            "o_total": one("SELECT COALESCE(sum(o_count),0) FROM asset"),
            "liked": one("SELECT count(*) FROM asset_preference WHERE profile_id=? AND liked=1",
                         DEFAULT_PROFILE_ID) if "asset_preference" in tables else 0,
            "dislike": one("SELECT count(*) FROM asset WHERE feedback='dislike'"),
            "seen": one("SELECT count(*) FROM asset WHERE feedback='seen'"),
            "trash": one("SELECT count(*) FROM asset WHERE disposal='trash'"),
            "skimmed": one("SELECT count(*) FROM asset WHERE duration>0 AND play_seconds>0 "
                           "AND max_reached>0.6 AND play_seconds/duration < max_reached-0.25"),
        }
        recent = [dict(r, kind="library") for r in c.execute(
            "SELECT id,name,creator,play_seconds,duration,max_reached,leave_ratio,o_count,"
            "CAST(last_played AS REAL) last_played FROM asset WHERE last_played IS NOT NULL "
            "ORDER BY CAST(last_played AS REAL) DESC LIMIT 12")]
        if "follow_playback" in tables:
            recent.extend(dict(r, kind="online", leave_ratio=None, o_count=0) for r in c.execute(
                "SELECT fi.id,fi.title name,fs.label creator,fp.play_seconds,fi.duration,"
                "fp.max_reached,fp.last_played FROM follow_playback fp "
                "JOIN follow_item fi ON fi.id=fp.follow_item_id "
                "JOIN follow_source fs ON fs.id=fi.source_id WHERE fp.last_played IS NOT NULL "
                "ORDER BY fp.last_played DESC LIMIT 12"
            ))
        out["recent"] = sorted(
            recent, key=lambda row: float(row.get("last_played") or 0), reverse=True,
        )[:12]
        out["play_activity"] = _play_activity(c, has_follow)
        out["replays"] = _replays(c, has_follow)
    return out


def _storage_stats() -> dict:
    """存储卷列表一个根一行；汇总按卷算，同一块盘上配了几个根也只计一次容量和一个卷。"""
    rows = _storage_volumes()
    # 没取得容量的行认不出卷，各算一个。
    keys = [row.pop("_volume", None) or ("row", index) for index, row in enumerate(rows)]
    volumes: dict[object, dict[str, object]] = {}
    for key, row in zip(keys, rows):
        volumes.setdefault(key, row)
    measured = [row for row in volumes.values() if row["total"] is not None]
    out = {"storage_volumes": rows}
    out["storage_summary"] = {
        "volumes": len(volumes),
        "online": len({key for key, row in zip(keys, rows) if row["online"]}),
        "measured": len(measured),
        "free": sum(int(row["free"]) for row in measured),
        "used": sum(int(row["used"]) for row in measured),
        "total": sum(int(row["total"]) for row in measured),
    }
    system = next((row for row in out["storage_volumes"] if row["kind"] == "system"), None)
    out["system_disk"] = (
        {"root": system["root"], "free": system["free"], "total": system["total"]}
        if system and system["total"] is not None else None
    )
    out["disk_c"] = out["system_disk"]  # 0.6.x 客户端兼容别名
    return out


def q_quality_goals(contract: WebContract, args):
    """List explicit better-version targets for the management surface."""
    limit = min(max(int(args.get("limit", "60")), 1), 200)
    offset = max(int(args.get("offset", "0")), 0)
    with contract.read_connection() as connection:
        rows = [dict(row) for row in connection.execute(
            "SELECT a.id,a.name,a.code,a.location,a.path,a.size,a.duration,a.snapshot_path,"
            "g.reason,g.updated_at FROM asset_quality_goal g "
            "JOIN asset a ON a.id=g.asset_id "
            "WHERE g.profile_id=? AND g.wanted=1 "
            "ORDER BY g.updated_at DESC,a.id DESC",
            (DEFAULT_PROFILE_ID,),
        )]
    from .media_identity import ownership
    config = settings_file.active()
    for row in rows:
        # 媒体库归属同作品列表（`web_catalog.attach_artwork_fields`）：按路径算，路径不下发。
        row["library_id"] = ownership(config, row.get('path') or '').get("library_id", "")
    from .table_filters import MEDIA_RANGE_READERS, filter_rows
    rows, facets = filter_rows(rows, args.get("column_filters"), {
        "library": lambda row: [row["library_id"] or "none"],
        "source": lambda row: [row["location"] or "none"],
        "reason": lambda row: [part.strip() for part in (row["reason"] or "").split("/") if part.strip()],
    }, ranges=MEDIA_RANGE_READERS)
    total = len(rows)
    rows = rows[offset:offset + limit]
    for row in rows:
        row["cost"] = cost_for(row['location'], row.pop('path', None))
        row["has_thumb"] = contract.has_snapshot(row["snapshot_path"])
        row["has_cover"] = contract.has_cover(row.get("code"))
        row["cover_version"] = contract.cover_version(row.get("code"))
        row.pop("snapshot_path", None)
    return {"total": total, "items": rows, "offset": offset, "column_facets": facets,
            "has_more": offset + len(rows) < total}
