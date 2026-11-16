"""rule34 关注条目的存量补填：判据只有这一份，「修复与迁移」的后台项与两份手动脚本都调它。

0.54 之前写下的条目有两处旧值，常规「检查更新」只看第一页、补齐过的行也不再进详情阶段，存量靠它改不过来：

- rule34video：站方 Characters 组里的名字记成了 general。角色和普通标签都是 `a.tag_item`，只有外层
  `.vp-group--characters` 不同，要逐条读详情页（`Rule34VideoConnector._detail`）。
- rule34.xxx：帖子页被 Cloudflare 挡住那段时间入库的行没有 `tag_types`，`published_at` 是 DAPI 的 `change`
  （最后修改时间）；更早还有 mp4 缺时长。分类与上传时间各问一次 dapi（`Rule34XxxConnector._detail`），
  时长读原文件头（`_video_seconds`）。

只补不抹：只把已经记过类型的名字改成 `character`；dapi 没给的上传时间不动，已有的时长与非空类型不覆盖。

后台执行（`Backfill`）随账本就绪自动开始，按站方口径限速，每批改动与回执在同一个写事务里提交：回执 id 是
`<前缀><开始时刻>`，记着问过的条目（续跑跳过）和每处改动前的 `tag_types`／`published_at`／`duration`。
服务退出时停在批与批之间，下次启动接着跑；取不到、被限流或在活动页取消的，下次启动再补。
"""
from __future__ import annotations

import json
import logging
import threading
import time
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from .coded_text import Said
from .follow_sources import FollowSourceError, FollowSourceRateLimited, Rule34VideoConnector
from .user_messages import UserValueError

LOGGER = logging.getLogger(__name__)

#: 每条问过之后的结论。`found` 有要写的列，`unchanged` 问过了不用改，`missed` 没取到（留给下一趟），
#: `skipped` 不是能问的条目（不是详情页地址、不是帖子号），`gone` 站方已经删了（详情页 404／410）。
FOUND, MISSED, SKIPPED, UNCHANGED, GONE = "found", "missed", "skipped", "unchanged", "gone"
#: 复核 CSV 的 `written` 等是非列。
YES, NO = "yes", "no"
#: 复核行 `note` 列里的固定原因；手动脚本按 `<脚本名>.<原因>` 换成界面语言，其余备注（HTTP 状态、异常）照原样。
NOTE_NOT_DETAIL, NOTE_NO_DETAIL = "notDetailPage", "noDetail"
NOTE_NOT_POST, NOTE_NO_TAG_TYPES = "notPostId", "noTagTypes"
NOTE_NO_CREATED_AT, NOTE_NO_DURATION = "noCreatedAt", "durationMissing"
NOTES = frozenset({NOTE_NOT_DETAIL, NOTE_NO_DETAIL, NOTE_NOT_POST, NOTE_NO_TAG_TYPES, NOTE_NO_CREATED_AT,
                   NOTE_NO_DURATION})


def _iso(seconds: float) -> str:
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat().replace("+00:00", "Z")


def _metadata(text) -> dict:
    try:
        value = json.loads(text or "{}")
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


# ======== rule34video：Characters 组改记 character ========

#: 详情页的最小请求间隔。站方没有公布限流口径，按常规检查的节奏留余量。
VIDEO_DELAY = 1.0
#: 被 429 挡回时静默多久；连续这么多次就停下，留给下一趟续跑。
VIDEO_COOLDOWN = 120.0
VIDEO_RATE_LIMIT_STOP = 3


def video_pending(connection, limit: int = 0, done=frozenset(), *, before: str | None = None) -> list[dict]:
    """待问条目：已经记过 `tag_types`、里面还没有一个 `character` 的 rule34video 条目，扣掉问定的。

    旧解析一个角色都不记，现行解析与补填过的行一次就把整组记齐，所以有过 `character` 的行不用再问。
    不按名字带不带括号筛：那是词形猜测，`melony` 这类不带括号的角色会漏。`before` 给了就只挑那之前首次
    入库的（之后的由现行解析写下）。
    """
    rows = []
    for row in connection.execute(
            "SELECT i.id, i.external_id, i.url, i.metadata_json FROM follow_item i"
            " JOIN follow_source s ON s.id=i.source_id"
            " WHERE s.provider='rule34video'"
            " AND json_extract(i.metadata_json,'$.tag_types') IS NOT NULL"
            + (" AND i.first_seen_at<?" if before else "") + " ORDER BY i.id",
            (before,) if before else ()):
        metadata = _metadata(row[3])
        types = metadata.get("tag_types")
        if row[0] in done or (isinstance(types, dict) and "character" in types.values()):
            continue
        rows.append({"id": row[0], "external_id": str(row[1] or ""), "url": str(row[2] or ""),
                     "metadata": metadata})
        if limit and len(rows) >= limit:
            break
    return rows


def characters_of(detail: dict) -> list[str]:
    types = (detail.get("extra") or {}).get("tag_types") or {}
    return [name for name, kind in types.items() if kind == "character"]


def retype(metadata: dict, characters: list[str]) -> dict | None:
    """库里这份 metadata 改完的样子；没有要改的就是 None。只改已经记过类型的名字。"""
    types = metadata.get("tag_types")
    if not isinstance(types, dict):
        return None
    changed = {name: "character" for name in characters
               if name in types and types[name] != "character"}
    if not changed:
        return None
    return {**metadata, "tag_types": {**types, **changed}}


def inspect_video(connector, row: dict) -> tuple[dict, list[str]]:
    """问一条详情页。返回复核行和要改记成角色的名字；被 429 挡回抛 `FollowSourceRateLimited`。"""
    entry = {"item_id": row["id"], "external_id": row["external_id"], "result": "",
             "characters": "", "written": NO, "note": ""}
    if not Rule34VideoConnector._VIDEO_RE.match(row["url"]):
        entry.update(result=SKIPPED, note=NOTE_NOT_DETAIL)
        return entry, []
    try:
        response = connector.probe(row["url"], headers={"Accept": "text/html"})
        connector._raise_if_rate_limited(response)
        if response.status in (404, 410):
            entry.update(result=GONE, note=f"HTTP {response.status}")
            return entry, []
        if response.status != 200:
            entry.update(result=MISSED, note=f"HTTP {response.status}")
            return entry, []
        detail = Rule34VideoConnector._detail(response.body)
    except FollowSourceRateLimited:
        raise
    except (FollowSourceError, OSError, httpx.HTTPError, ValueError) as error:
        entry.update(result=MISSED, note=f"{type(error).__name__}: {error}"[:120])
        return entry, []
    if not detail:
        entry.update(result=MISSED, note=NOTE_NO_DETAIL)
        return entry, []
    characters = characters_of(detail)
    metadata = row["metadata"]
    updated = retype(metadata, characters)
    if updated is None:
        entry["result"] = UNCHANGED
        return entry, []
    names = [name for name in characters
             if updated["tag_types"].get(name) != metadata["tag_types"].get(name)]
    entry.update(result=FOUND, characters=" | ".join(names))
    return entry, names


def apply_characters(connection, item_id: int, characters: list[str]) -> dict | None:
    """在调用方的写事务里重读再改：常规检查同时在写这一列，不拿问之前读到的旧值覆盖。

    改了就返回改动前的 `{"item_id", "tag_types"}`，没有要改的返回 None。"""
    row = connection.execute("SELECT metadata_json FROM follow_item WHERE id=?", (item_id,)).fetchone()
    metadata = _metadata(row[0]) if row else {}
    updated = retype(metadata, characters)
    if updated is None:
        return None
    connection.execute("UPDATE follow_item SET metadata_json=? WHERE id=?",
                       (json.dumps(updated, ensure_ascii=False), item_id))
    return {"item_id": item_id, "tag_types": metadata["tag_types"]}


# ======== rule34.xxx：标签类型、上传时间、mp4 时长 ========

#: 每条之间的最小间隔。站方公布的口径是每 60 秒 60 次，`_detail` 每条问两次 dapi（JSON 的分类、XML 的
#: 上传时间），所以每条至少 2 秒；留一点余量。按 0.35 秒跑过一次：400 条里 372 条被限流挡了，被读成
#: 「没有类型」。视频文件头在另一个主机上，在这段间隔里发，不另占时间。
POST_DELAY = 2.2
#: 连续这么多条取不到就认定是被限流，而不是这一段恰好都取不到。
MISS_STREAK_LIMIT = 8
#: 限流后的静默时长，按站方公布的窗口取满一格。
POST_COOLDOWN = 60.0


def is_mp4(url: str | None) -> bool:
    return str(url or "").lower().split("?")[0].endswith(".mp4")


def post_pending(connection, limit: int = 0, done=frozenset(), *, duration_only: bool = False,
                 missing_types: bool = False, gaps_only: bool = False, before: str | None = None) -> list[dict]:
    """待补条目：rule34xxx 来源的条目，扣掉问定的。

    上传时间错没错，不问 dapi 就看不出来：被改过的帖子 `change` 晚于上传，没改过的两者逐秒相同。所以
    手动脚本默认每条都问。`missing_types` 只挑没有非空类型的（帖子页被挡住那段时间入库的正是这一批，上传
    时间也还是 `change` 占位）；`duration_only` 只挑缺时长的 mp4；`gaps_only` 是两者的并集，后台项用它。
    """
    rows = []
    for row in connection.execute(
            "SELECT i.id, i.external_id, i.media_url, i.published_at, i.duration, i.metadata_json"
            " FROM follow_item i JOIN follow_source s ON s.id=i.source_id WHERE s.provider='rule34xxx'"
            + (" AND i.duration IS NULL" if duration_only else "")
            + (" AND i.first_seen_at<?" if before else "") + " ORDER BY i.id",
            (before,) if before else ()):
        if row[0] in done or (duration_only and not is_mp4(row[2])):
            continue
        metadata = _metadata(row[5])
        untyped = not metadata.get("tag_types")
        # 空表与缺键同样算缺：`plan_update` 也只在没有非空类型时才补。
        if missing_types and not untyped:
            continue
        if gaps_only and not untyped and not (is_mp4(row[2]) and row[4] is None):
            continue
        rows.append({"id": row[0], "external_id": str(row[1] or ""), "media_url": row[2],
                     "published_at": row[3], "duration": row[4], "metadata": metadata})
        if limit and len(rows) >= limit:
            break
    return rows


def plan_update(row: dict, detail: dict, duration: float | None) -> dict | None:
    """这一条要改哪几列。没有可写的就是 None。

    只补不抹：dapi 没给上传时间就不动 `published_at`；已有时长不覆盖；已有非空类型不覆盖。取不到的留待
    下一趟，不写空值冒充已补。
    """
    update: dict = {}
    posted = detail.get("published_at")
    if posted and posted != row["published_at"]:
        update["published_at"] = posted
    if duration and row["duration"] is None:
        update["duration"] = duration
    tag_types = detail.get("tag_types")
    if tag_types and not row["metadata"].get("tag_types"):
        update["metadata_json"] = json.dumps(
            {**row["metadata"], "tag_types": dict(tag_types)}, ensure_ascii=False)
    return update or None


def fetch_post(connector, row: dict) -> tuple[dict, float | None, str]:
    """问一条：dapi 的分类与上传时间，缺时长的 mp4 再读一次文件头。返回 `(细节, 时长, 备注)`。

    分类没取到就不读文件头：被限流挡回来与帖子已删都是这样，这一条整条留给下一趟。"""
    try:
        detail = connector._detail(row["external_id"])
    except (FollowSourceError, OSError) as error:
        return {}, None, f"{type(error).__name__}: {error}"[:120]
    if not detail.get("tag_types"):
        return detail, None, ""
    duration = connector._video_seconds(row["media_url"]) if row["duration"] is None else None
    return detail, duration, ""


def inspect_post(connector, row: dict) -> tuple[dict, dict | None]:
    """问一条并对照账本，返回复核行和要写的列。分类没取到时 `result` 是 `missed`，不写。"""
    post_id = row["external_id"]
    entry = {"item_id": row["id"], "external_id": post_id, "result": "",
             "published_before": row["published_at"] or "", "published_after": "",
             "duration": row["duration"] if row["duration"] is not None else "",
             "tag_types_added": "", "written": NO, "note": ""}
    if not post_id.isdigit():
        entry.update(result=SKIPPED, note=NOTE_NOT_POST)
        return entry, None
    detail, duration, note = fetch_post(connector, row)
    if not detail.get("tag_types"):
        entry.update(result=MISSED, note=note or NOTE_NO_TAG_TYPES)
        return entry, None
    update = plan_update(row, detail, duration) or {}
    entry.update(result=FOUND if update else UNCHANGED,
                 published_after=detail.get("published_at") or "",
                 duration=update.get("duration", entry["duration"]),
                 tag_types_added=YES if "metadata_json" in update else "")
    if not detail.get("published_at"):
        entry["note"] = NOTE_NO_CREATED_AT
    elif is_mp4(row["media_url"]) and row["duration"] is None and not duration:
        entry["note"] = NOTE_NO_DURATION
    return entry, update or None


def inspect_duration(connector, row: dict) -> tuple[dict, dict | None]:
    """只补时长：读一次原文件头，读到就只写 `duration`。读不到记 `missed`，不写空冒充测过。"""
    entry = {"item_id": row["id"], "external_id": row["external_id"], "result": "",
             "published_before": row["published_at"] or "", "published_after": "",
             "duration": "", "tag_types_added": "", "written": NO, "note": ""}
    seconds = connector._video_seconds(row["media_url"])
    if not seconds:
        entry.update(result=MISSED, note=NOTE_NO_DURATION)
        return entry, None
    entry.update(result=FOUND, duration=seconds)
    return entry, {"duration": seconds}


def write_update(connection, item_id: int, update: dict) -> None:
    """照 `plan_update` 的结果写一条；事务由调用方提交。"""
    if "published_at" in update:
        connection.execute("UPDATE follow_item SET published_at=?, published_precision='exact' WHERE id=?",
                           (update["published_at"], item_id))
    if "duration" in update:
        connection.execute("UPDATE follow_item SET duration=? WHERE id=? AND duration IS NULL",
                           (update["duration"], item_id))
    if "metadata_json" in update:
        connection.execute("UPDATE follow_item SET metadata_json=? WHERE id=?",
                           (update["metadata_json"], item_id))


def apply_post(connection, item_id: int, detail: dict, duration: float | None) -> dict | None:
    """在调用方的写事务里重读这一行、按现值重算 `plan_update` 再写，返回改动前的值；没有要改的返回 None。"""
    current = connection.execute(
        "SELECT published_at, duration, metadata_json FROM follow_item WHERE id=?", (item_id,)).fetchone()
    if current is None:
        return None
    row = {"published_at": current[0], "duration": current[1], "metadata": _metadata(current[2])}
    update = plan_update(row, detail, duration)
    if update is None:
        return None
    write_update(connection, item_id, update)
    return {"item_id": item_id, "published_at": row["published_at"], "duration": row["duration"],
            "tag_types": row["metadata"].get("tag_types")}


# ======== 「修复与迁移」里的后台项 ========

#: 任务中心（`task_runs.TASK_KEYS`）里这两项共用的键。
TASK_KEY = "follow-backfill"


@dataclass(frozen=True)
class Job:
    #: 「修复与迁移」的项 id；标题与说明在 `server:repairCenter.items.<item>`，任务名在
    #: `server:labels.followBackfill.<item>`。
    item: str
    #: 回执 id 前缀（含末尾连字符）；去掉连字符就是历史里的规则 id。
    prefix: str
    provider: str


VIDEO = Job("rule34video-characters", "rule34video-characters-", "rule34video")
POST = Job("rule34-details", "rule34-details-", "rule34xxx")
JOBS = (VIDEO, POST)
#: 每这么多条提交一次改动与回执；中断最多重问这么多条。
FLUSH_EVERY = 20


def job(item: str) -> Job | None:
    return next((candidate for candidate in JOBS if candidate.item == item), None)


def upgraded_at(connection) -> str | None:
    """这个版本第一次启动、旧版数据补修（`legacy_repairs.RULES`）落回执的时刻。

    两处旧值都在 0.54 改掉了，这一刻之后首次入库的条目由现行解析写下，不用再问。补修还没跑过就没有界限。"""
    from . import legacy_repairs
    keys = [rule.key for rule in legacy_repairs.RULES]
    row = connection.execute(
        f"SELECT min(CAST(applied_at AS REAL)) FROM ledger_upgrade_repair WHERE id IN ({','.join('?' * len(keys))})",
        keys).fetchone()
    return _iso(row[0]) if row and row[0] else None


def receipts(connection, spec: Job) -> list[tuple[str, dict]]:
    """这一项的历次回执，新的在前。"""
    rows = connection.execute("SELECT id, applied_at, result_json FROM ledger_upgrade_repair WHERE id LIKE ?",
                              (spec.prefix + "%",)).fetchall()
    return [(row[0], _metadata(row[2])) for row in sorted(rows, key=lambda row: float(row[1] or 0), reverse=True)]


def pending(connection, spec: Job) -> list[dict]:
    """还要问的条目：旧版写下的、有那处旧值嫌疑的，扣掉历次回执里问定的。"""
    done = {int(item) for _, result in receipts(connection, spec) for item in result.get("checked") or ()}
    before = upgraded_at(connection)
    if spec is VIDEO:
        return video_pending(connection, done=done, before=before)
    return post_pending(connection, done=done, gaps_only=True, before=before)


class _Stopped(Exception):
    """服务在退出：停在批与批之间，回执留在 running，下次启动接着跑。"""


class Backfill:
    """「修复与迁移」里两项 rule34 补填的后台执行，进度写法同 `follow_evidence.Reclaim`。

    `database` 提供 `read_connection()`／`write_transaction()`（`WebContract`）；`runs` 是任务中心，
    每一趟在活动页登记、报进度，暂停与取消在条与条之间生效。`credentials` 是关注凭据仓库，rule34.xxx 的
    dapi 要账号的 user_id 与 api_key。`backup` 在每趟开始前备份账本，返回备份路径。`available` 为假（不是本机
    写入端）时启动不续跑。`start`／`stop` 是后台服务的生命周期，随账本就绪启动、随服务退出停下。
    """

    def __init__(self, database, *, runs=None, credentials=None, connector_factory=None, backup=None,
                 available=lambda: True, sleep=time.sleep):
        from .follow_sources import build_connector
        self.database = database
        self.available = available
        self.runs = runs
        self.credentials = credentials
        self.connector_factory = connector_factory or build_connector
        self.backup = backup
        self.sleep = sleep
        self._lock = threading.Lock()
        self._state: dict[str, dict] = {}
        self._stopping = threading.Event()
        self.workers: dict[str, threading.Thread] = {}

    # ---- 页面读数 ----

    def status(self, item: str) -> dict:
        with self._lock:
            return dict(self._state.get(item) or {'phase': 'idle'})

    def snapshot(self, connection) -> dict[str, dict]:
        """各项给「修复与迁移」的读数：在跑的报进度；没跑的报还剩几条，缺凭据跑不了的带上原因。"""
        result = {}
        for spec in JOBS:
            state = self.status(spec.item)
            if state['phase'] == 'running':
                result[spec.item] = state
                continue
            try:
                count = len(pending(connection, spec))
            except Exception:  # noqa: BLE001 — 旧库缺表时这一项按没有算
                count = 0
            result[spec.item] = {'phase': 'idle', 'pending': count,
                                 **({'error': state['error']} if count and state.get('error') else {})}
        return result

    # ---- 开始、续跑与退出 ----

    def begin(self, item: str, *, resume_id: str | None = None, backup: bool = True) -> dict:
        """开始一项；有待问条目就在后台跑，返回当前读数。`backup` 为假时不先备份账本（续跑与重试）。"""
        spec = job(item)
        if spec is None:
            raise UserValueError('api.configuration.repairUnknown', {'item': item})
        with self._lock:
            if (self._state.get(item) or {}).get('phase') == 'running':
                raise UserValueError('errors.followBackfill.running')
            with self.database.read_connection() as connection:
                rows = pending(connection, spec)
            if not rows:
                if resume_id:
                    # 停下时恰好问完了：回执改记做完，下次启动不再续。
                    with self.database.write_transaction() as connection:
                        connection.execute("UPDATE ledger_upgrade_repair SET result_json=json_set(result_json,"
                                           "'$.state','done') WHERE id=?", (resume_id,))
                return {'phase': 'idle'}
            try:
                credential = self._credential(spec)
            except UserValueError as error:
                self._state[item] = {'phase': 'idle', 'error': str(error)}
                raise
            self._state[item] = {'phase': 'running', 'done': 0, 'total': len(rows)}
            worker = threading.Thread(target=self._run, args=(spec, rows, credential, resume_id, backup),
                                      name=f'follow-backfill-{item}', daemon=True)
            self.workers[item] = worker
            worker.start()
            return dict(self._state[item])

    def start(self) -> None:
        """账本就绪后自动补：上次没跑完的接着写同一张回执，还有待问条目的开新一趟。

        判据确定、只补缺的、回执记着原值，所以不等确认（见 ADR-0052）。只有第一趟先备份账本；续跑与重试
        （上次取不到、被限流停下、在活动页取消）都在下次启动时再来，不再备份。缺凭据的 rule34.xxx 记下原因，
        页面照实显示，补好凭据后下次启动再补。"""
        if not self.available():
            return
        self._stopping.clear()
        for spec in JOBS:
            try:
                with self.database.read_connection() as connection:
                    previous = receipts(connection, spec)
                latest = previous[0] if previous else None
                self.begin(spec.item, backup=not previous,
                           resume_id=latest[0] if latest and latest[1].get('state') == 'running' else None)
            except UserValueError:
                LOGGER.info('Follow backfill %s waits for credentials', spec.item)
            except Exception:  # noqa: BLE001 — 这一项起不来不影响其它服务
                LOGGER.warning('Follow backfill %s could not start', spec.item, exc_info=True)

    def stop(self) -> None:
        self._stopping.set()
        for worker in list(self.workers.values()):
            worker.join(10)

    def _credential(self, spec: Job):
        if spec is not POST:
            return None
        credential = self.credentials.load(spec.provider) if self.credentials is not None else None
        if credential is None:
            raise UserValueError('errors.followBackfill.credentialMissing')
        return credential

    # ---- 执行 ----

    def _task(self, call):
        """任务中心记录写不进去不影响补填本身：只记日志。"""
        if self.runs is None:
            return None
        try:
            return call()
        except Exception:  # noqa: BLE001
            LOGGER.warning('Failed to record the follow backfill in the task center', exc_info=True)
            return None

    def _wait(self, seconds: float) -> None:
        """限速与冷却的等待。按秒切开，期间照样响应暂停、取消与服务退出。"""
        from .task_control import checkpoint
        remaining = seconds
        while True:
            if self._stopping.is_set():
                raise _Stopped()
            checkpoint(None)
            if remaining <= 0:
                return
            step = min(1.0, remaining)
            self.sleep(step)
            remaining -= step

    def _run(self, spec: Job, rows: list[dict], credential, resume_id: str | None, backup: bool) -> None:
        from .task_control import Cancelled, bind
        receipt_id = resume_id or f'{spec.prefix}{time.time_ns()}'
        receipt = {'state': 'running', 'checked': [], 'missed': [], 'rows': [], 'changed': 0}
        if resume_id:
            with self.database.read_connection() as connection:
                receipt.update(dict(receipts(connection, spec)).get(resume_id) or {}, state='running')
        elif backup and self.backup is not None:
            try:
                receipt['backup'] = str(self.backup(spec.prefix))
            except Exception as error:  # noqa: BLE001 — 没有备份就不写
                LOGGER.exception('Follow backfill %s: backup failed', spec.item)
                with self._lock:
                    self._state[spec.item] = {'phase': 'idle', 'error': str(error)}
                return
        run = self._task(lambda: self.runs.start(TASK_KEY, trigger='startup', mutex_key=f'{TASK_KEY}:{spec.item}',
                                                 total=len(rows), label=Said(f'labels.followBackfill.{spec.item}')))
        run_id = getattr(run, 'id', None)
        staged: list[tuple[dict, object]] = []
        status, error, done = 'succeeded', '', 0

        def flush(final: str | None = None) -> None:
            with self.database.write_transaction() as connection:
                for row, payload in staged:
                    before = (apply_characters(connection, row['id'], payload) if spec is VIDEO
                              else apply_post(connection, row['id'], *payload))
                    if before is not None:
                        receipt['rows'].append(before)
                receipt['changed'] = len(receipt['rows'])
                if final:
                    receipt['state'] = final
                connection.execute(
                    'INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)'
                    ' ON CONFLICT(id) DO UPDATE SET result_json=excluded.result_json',
                    (receipt_id, str(time.time()), json.dumps(receipt, ensure_ascii=False, default=str)))
            staged.clear()

        def settle(row: dict, payload=None, *, missed: bool = False, checked: bool = True) -> None:
            """一条问完：`checked` 的续跑不再问，`missed` 的记进回执备查，有 `payload` 的随下一批写入。"""
            nonlocal done
            if checked:
                receipt['checked'].append(row['id'])
            if missed and row['id'] not in receipt['missed']:
                receipt['missed'].append(row['id'])
            if payload:
                staged.append((row, payload))
            done += 1
            with self._lock:
                self._state[spec.item]['done'] = done
            self._task(lambda: self.runs.progress(run_id, current=done))
            if done % FLUSH_EVERY == 0:
                flush()

        try:
            with bind(self.runs, run_id) if self.runs is not None else nullcontext():
                flush()
                connector = self.connector_factory(spec.provider, credential=credential)
                (self._video if spec is VIDEO else self._posts)(connector, rows, settle, flush)
            final = 'done'
        except Cancelled:
            status, final = 'cancelled', 'stopped'
        except _Stopped:
            status, final = 'cancelled', 'running'
        except Exception as exc:  # noqa: BLE001 — 改了多少照实记进回执
            LOGGER.exception('Follow backfill %s interrupted', spec.item)
            status, final, error = 'failed', 'failed', str(exc)
            receipt['error'] = error
        try:
            flush(final)
        except Exception:  # noqa: BLE001
            LOGGER.exception('Failed to record the follow backfill receipt')
        self._task(lambda: self.runs.progress(run_id, current=done, throttle=0))
        self._task(lambda: self.runs.finish(run_id, status, error=error,
                                            summary={'checked': done, 'changed': receipt['changed']}))
        LOGGER.info('Follow backfill %s: checked %s, changed %s (%s)', spec.item, done, receipt['changed'], final)
        with self._lock:
            self._state[spec.item] = {'phase': 'idle'}

    def _video(self, connector, rows, settle, flush) -> None:
        """每条 1 次详情页，间隔 `VIDEO_DELAY`；429 静默 `VIDEO_COOLDOWN` 后重问同一条，连续三次就停下。
        取不到的（网络错误、5xx）记进 `missed`，下一趟再问；站方删了的（404）不再问。"""
        limited, index, next_request = 0, 0, 0.0
        while index < len(rows):
            row = rows[index]
            self._wait(next_request - time.monotonic())
            next_request = time.monotonic() + VIDEO_DELAY
            try:
                entry, names = inspect_video(connector, row)
            except FollowSourceRateLimited as error:
                limited += 1
                if limited >= VIDEO_RATE_LIMIT_STOP:
                    raise
                flush()
                self._wait(max(VIDEO_COOLDOWN, float(error.retry_after or 0)))
                continue
            limited = 0
            index += 1
            missed = entry['result'] == MISSED
            settle(row, names, missed=missed, checked=not missed)

    def _posts(self, connector, rows, settle, flush) -> None:
        """缺类型的每条 2 次 dapi，间隔 `POST_DELAY`；只缺时长的只读文件头，不问 dapi。

        连续 `MISS_STREAK_LIMIT` 条取不到视作被限流：静默 `POST_COOLDOWN` 后从这一串的第一条重问，重问又连着
        取不到就停下，这一串留给下一趟。零星取不到的（帖子删了）记进 `missed`，不再算待处理。"""
        streak: list[dict] = []
        index, next_request = 0, 0.0
        retried = False
        while index < len(rows):
            row = rows[index]
            if not row['external_id'].isdigit():
                index += 1
                settle(row)
                continue
            self._wait(next_request - time.monotonic())
            next_request = time.monotonic() + POST_DELAY
            if row['metadata'].get('tag_types'):
                seconds = connector._video_seconds(row['media_url'])
                index += 1
                settle(row, ({}, seconds) if seconds else None, missed=not seconds)
                continue
            detail, duration, _ = fetch_post(connector, row)
            index += 1
            if not detail.get('tag_types'):
                streak.append(row)
                if len(streak) >= MISS_STREAK_LIMIT:
                    if retried:
                        raise FollowSourceRateLimited('errors.followSources.rateLimited',
                                                      {'provider': POST.provider})
                    flush()
                    self._wait(POST_COOLDOWN)
                    index -= len(streak)
                    streak, retried = [], True
                continue
            for missed in streak:
                settle(missed, missed=True)
            streak, retried = [], False
            settle(row, (detail, duration))
        for missed in streak:
            settle(missed, missed=True)
