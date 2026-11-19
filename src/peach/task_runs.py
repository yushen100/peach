"""任务中心：一张 `task_run` 表的写入、互斥、租约与查询。

各域的执行细节仍归各域（`BackgroundJob` 的状态字典、`library_processing` 的动作预算、
追更调度器的退避计数）。这里只维护对外那一层：谁在跑、跑到哪、什么时候结束的、
为什么没跑。表的取舍写在 `migrations/0028_task_runs.sql`。

三条不变量，全部由这个模块和那张表一起守住：

1. **终态一次性**。`finish` 是一条带 `WHERE status IN (活跃态)` 的 UPDATE，从终态改回
   活跃态不可能发生，重复结算也只有第一次生效。租约回收和任务自己收尾撞在一起时，
   落地的是先到的那一个。
2. **互斥由 `INSERT` 判**。撞上部分唯一索引才算冲突，不先查一遍——先查再插之间那个
   时间窗正是「两轮同时开跑」的来源。
3. **跳过也是一条记录**。定时触发撞上在跑的那轮会写一条 `cancelled`，带上挡路那条的
   id。跳过只留在内存里的话，「刚才那轮为什么没跑」就永远答不出来。

后继（ADR-0040）也住在这张表里：一轮任务结束时声明「接下来该做什么」，`enqueue_followups`
把它们写成 `pending` 行，父子关系落在 `parent_run_id` / `root_run_id` 上。真正去跑它们的是
`followups.FollowupRunner`，这一层只负责入队、去重、领取和查询。
"""
from __future__ import annotations

import json
import logging
import os
import socket
import sqlite3
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

from . import interface_text, task_outcomes, task_stages
from .jobs import TaskRunConflict, process_alive, process_matches
from .repository import LedgerDatabase

__all__ = [
    "ACTIVE_STATUSES", "DEFAULT_KEEP", "LEASE_SECONDS", "MAX_FOLLOWUPS",
    "MAX_FOLLOWUP_DEPTH", "PROGRESS_INTERVAL", "TASK_KEYS", "TERMINAL_STATUSES",
    "TRIGGERS", "TaskRun", "TaskRunConflict", "TaskRunHandle", "TaskRunStore",
    "cli_run", "inert_handle", "item_progress", "run_error", "run_progress", "stamp",
    "task_label",
]

LOGGER = logging.getLogger(__name__)

#: 未结束的两种状态。部分唯一索引和每一条 CAS 的 WHERE 都用这一份。
ACTIVE_STATUSES = ("pending", "running")
#: 终态。只有这四种能进 `finish`，也只有这四种会被 `prune` 回收。
TERMINAL_STATUSES = ("succeeded", "failed", "cancelled", "interrupted")
TRIGGERS = ("manual", "scheduled", "startup", "cli")
#: 任务中心列表每轮下发的已结束后继条数上限，见 `settled_followups`。
SETTLED_FOLLOWUP_LIMIT = 50

#: 心跳超过这么久没续，且进程也不在了，就按被打断处理。
#: 取 5 分钟不是因为任务不会更久——单项外部动作的预算是 240 秒（`library_processing`
#: 的 `ACTION_BUDGETS`），比它短就会把正常的慢任务判成死掉的。
LEASE_SECONDS = 300.0

#: 进度与心跳的默认写入间隔。扫描一万个文件时每项都写一次库，等于给每一项加一次
#: 写事务；页面两秒轮询一次，比这更密的进度没有读者。
PROGRESS_INTERVAL = 2.0

#: 进度与心跳最多等写锁这么久。它们不是结果：等不到就跳过这一次、记一条 warning，
#: 下一次进度照常再写。按默认的 30 秒等，任务线程会为一行心跳停住半分钟，同进程排在
#: 后面的写入也跟着等。
PROGRESS_LOCK_TIMEOUT = 2.0

#: 结算撞上写锁时，每次重试前等多少秒。结算写不进去，这一行就停在 `running`、
#: 占住互斥键到下次服务重启，所以它要重试；每一次尝试本身还会等满 SQLite 的 30 秒。
FINISH_RETRY_DELAYS = (1.0, 5.0)

#: 每个 task_key 默认保留多少条终态记录。活动页只看最近几轮，更早的属于日志。
DEFAULT_KEEP = 20

#: 失败与中断的后继行按结束时间保留这么多天，见 `prune` 的 `failed_days`。
FAILED_FOLLOWUP_DAYS = 30

#: 一轮任务最多能派出多少条后继（ADR-0040 第五条）。多出来的在入队时截断，截断了几条
#: 写进父任务的摘要——静默丢弃和无上限一样，都是事后查不出来的那一类。
#: 64 是「一部片的出演者加厂牌」那个量级的十几倍，正常扇出撞不到它。
MAX_FOLLOWUPS = 64

#: 链深度上限。根任务是 0，它派出的后继是 1。允许到 2 是给「后继再派一次后继」留一层，
#: 再往下就不是扇出而是递归了，而递归的规模在代码评审里看不出来。
MAX_FOLLOWUP_DEPTH = 2

#: 任务登记表。名字在 `resources/locales/<语言>/server.json` 的 `task.<key>`（ADR-0159）；
#: 不在表里的 key 由界面原样显示，不猜。
TASK_KEYS = (
    "follow-check", "follow-resolve", "library-processing", "taste-refresh", "link-check", "link-prune",
    "resource-scan", "resource-apply", "scraping-cover", "media-repair", "mp4-header-repair",
    "jav-discovery-metadata", "diagnostic-export", "ledger-backup", "ledger-restore", "upgrade-repairs",
    "upgrade-library", "follow-evidence-reclaim", "follow-backfill", "organize", "batch", "scrape-codes", "jav-covers",
    "entity-avatar", "performer-profile", "performer-alias", "studio-mark", "creator-identity", "code-samples",
    "feed-check", "feed-scrape", "feed-cover", "want-scrape", "want-search", "timeline-thumbnails", "download-postprocess",
    "seed-import", "follow-creator", "amane-bridge", "source-check", "face-models", "cover-artwork-repair",
)


def task_label(task_key: str) -> str:
    return interface_text.text(f"server:task.{task_key}") if task_key in TASK_KEYS else task_key


def trigger_label(trigger: str) -> str:
    """触发方式的名字。跳过原因是给人看的一句话，里面不留英文枚举值。"""
    return interface_text.label(f"manage:taskTrigger.{trigger}", trigger)


#: 落库的进度说明与结束原因（ADR-0159 第二条）的键：文字在 `server.json` 的 `taskRun.progress.*`、
#: `taskRun.error.*`。带 code 的那一句只存 code 与参数，`progress_label` / `error` 列留空，读出时
#: 按资源渲染；没有 code 的那一句（文件名、异常原文）照旧存原文。
#: `{{task}}`、`{{trigger}}`、`{{stage}}` 不进参数：库里只有 `task_key`、触发方式的 id 与阶段 code，
#: 读的一方按界面语言换成名字。
PROGRESS_KEYS = ("item", "items", "downloadLanded", "batch", "subjectStage", "videosStage",
                 "waitingForUpdate", "waitingForService", "pausedWaiting", "schedulingRepairs")
ERROR_KEYS = ("skippedBy", "skipped", "interrupted", "unknownFollowup", "dispatchInterrupted", "stoppedEarly")


def _fill(key: str, task_key: str, params: dict) -> str:
    names = {"task": task_label(task_key)}
    if "trigger" in params:
        names["trigger"] = trigger_label(str(params["trigger"]))
    if "stage" in params:
        names["stage"] = task_stages.text(str(params["stage"]))
    return interface_text.text(f"server:{key}", {**params, **names})


def coded_text(code: str, params: dict, task_key: str = "") -> str:
    """库里一句带 code 的说明按资源渲染。阶段名的 code 是 `stage.<阶段>`；只说任务名的条目说明
    （`item_progress` 不带条目名）渲染成任务名。"""
    if code.startswith("stage."):
        return task_stages.text(code.removeprefix("stage."))
    if code == "taskRun.progress.item" and not params.get("name"):
        return task_label(task_key)
    return _fill(code, task_key, params)


def run_progress(key: str, task_key: str = "", **params) -> dict:
    """一句进度说明：`label` 是中文原文，`code` 与 `params` 供界面翻译。直接展开给 `progress`、`start`、`suspend`。"""
    return {"label": _fill(f"taskRun.progress.{key}", task_key, params),
            "code": f"taskRun.progress.{key}", "params": params}


def item_progress(task_key: str, name: str = "") -> dict:
    """后继正在做哪一件：「任务名：条目」。没有条目名时只写任务名，界面同样只显示任务名。"""
    progress = run_progress("item", task_key, name=name)
    return {**progress, "label": progress["label"] if name else task_label(task_key)}


def run_error(key: str, task_key: str = "", **params) -> dict:
    """一句结束原因：展开给 `finish`，`error` 是中文原文，`error_code` 与 `error_params` 供界面翻译。"""
    return {"error": _fill(f"taskRun.error.{key}", task_key, params),
            "error_code": f"taskRun.error.{key}", "error_params": params}


def _coded(code: str | None, params: dict | None) -> tuple[str | None, str | None]:
    """code 与参数按列存。没有 code 的那句把两列清空，不让上一句的 code 盖住这一句的原文。"""
    if not code:
        return None, None
    return code, json.dumps(params or {}, ensure_ascii=False)


def _text(text: str | None, code: str | None) -> str | None:
    """原文那一列：带 code 的那句不存文字，读出时按资源渲染。"""
    return None if code else text


def _render(text: str | None, code: str | None, params: dict, task_key: str) -> str:
    if code:
        try:
            return coded_text(code, params, task_key)
        except (KeyError, TypeError, interface_text.InterfaceTextMissing):
            LOGGER.warning("task_run text code %s has no resource entry", code)
    return text or ""


def _params(raw: str | None) -> dict:
    try:
        value = json.loads(raw or "{}")
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def stamp(moment: datetime | None = None) -> str:
    """ISO-8601 UTC 文本，与 `entity`、`follow_schedule` 同一种写法。"""
    return (moment or datetime.now(timezone.utc)).astimezone(
        timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _delete_runs(connection, where: str, params) -> int:
    """删掉满足 `where` 的运行行：下载任务指向它们的链接先清空，状态本身保留。"""
    connection.execute("UPDATE download_task SET postprocess_run_id=NULL WHERE postprocess_run_id IN ("
                       f"SELECT id FROM task_run WHERE {where})", params)
    return connection.execute(f"DELETE FROM task_run WHERE {where}", params).rowcount


def _settle_cancelled_followup(connection, run_id: int) -> None:
    row = connection.execute("SELECT task_key,followup_key FROM task_run WHERE id=?", (run_id,)).fetchone()
    if row["task_key"] == "download-postprocess" and row["followup_key"]:
        from .downloads import DownloadStore
        DownloadStore.settle_cancelled_postprocess(connection, run_id)


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@dataclass(frozen=True)
class TaskRun:
    id: int
    task_key: str
    trigger: str
    status: str
    mutex_key: str | None
    pid: int | None
    host: str
    started_at: str | None
    finished_at: str | None
    heartbeat_at: str | None
    progress_current: int | None
    progress_total: int | None
    progress_label: str
    result_summary: dict
    error: str
    #: 派出这一轮的父任务；不是后继时为 None。
    parent_run_id: int | None = None
    #: 整条链的根。根任务指向自己，裸任务为 None（与 `parent_run_id` 同时为空）。
    root_run_id: int | None = None
    #: 这条后继要做的那件事的全名，同时是它的互斥键。不是后继时为空。
    followup_key: str = ""
    followup_depth: int = 0
    #: `progress_label` 与 `error` 那两句的 code 和参数（ADR-0156 第三条）；旧行与没迁移的句子为空。
    progress_code: str = ""
    progress_params: dict = field(default_factory=dict)
    error_code: str = ""
    error_params: dict = field(default_factory=dict)

    @property
    def active(self) -> bool:
        return self.status in ACTIVE_STATUSES

    @property
    def followup(self) -> bool:
        return bool(self.followup_key)

    def payload(self) -> dict:
        """API 与页面共用的投影。派生字段在这里算一次，不让每个读者各算一份。"""
        started, finished = _parse(self.started_at), _parse(self.finished_at)
        end = finished or (datetime.now(timezone.utc) if self.active else None)
        return {
            "id": self.id,
            "task_key": self.task_key,
            "task_label": task_label(self.task_key),
            "trigger": self.trigger,
            "status": self.status,
            "mutex_key": self.mutex_key,
            "pid": self.pid,
            "host": self.host,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "heartbeat_at": self.heartbeat_at,
            "elapsed_seconds": (
                round((end - started).total_seconds(), 1)
                if started and end else None),
            "progress_current": self.progress_current,
            "progress_total": self.progress_total,
            "progress_label": self.progress_label,
            "progress_code": self.progress_code,
            "progress_params": self.progress_params,
            "result_summary": task_outcomes.rendered(self.result_summary),
            "error": self.error,
            "error_code": self.error_code,
            "error_params": self.error_params,
            "parent_run_id": self.parent_run_id,
            "root_run_id": self.root_run_id,
            "followup_key": self.followup_key,
            "followup_depth": self.followup_depth,
        }


_COLUMNS = ("id,task_key,trigger,status,mutex_key,pid,host,started_at,finished_at,"
            "heartbeat_at,progress_current,progress_total,progress_label,"
            "result_summary,error,parent_run_id,root_run_id,followup_key,followup_depth,"
            "progress_code,progress_params,error_code,error_params")


def _row(row: sqlite3.Row) -> TaskRun:
    try:
        summary = json.loads(row["result_summary"] or "{}")
    except ValueError:
        summary = {}
    task_key = row["task_key"]
    progress_code, progress_params = row["progress_code"] or "", _params(row["progress_params"])
    error_code, error_params = row["error_code"] or "", _params(row["error_params"])
    return TaskRun(
        id=row["id"], task_key=task_key, trigger=row["trigger"],
        status=row["status"], mutex_key=row["mutex_key"], pid=row["pid"],
        host=row["host"] or "", started_at=row["started_at"],
        finished_at=row["finished_at"], heartbeat_at=row["heartbeat_at"],
        progress_current=row["progress_current"], progress_total=row["progress_total"],
        progress_label=_render(row["progress_label"], progress_code, progress_params, task_key),
        result_summary=summary if isinstance(summary, dict) else {},
        error=_render(row["error"], error_code, error_params, task_key),
        parent_run_id=row["parent_run_id"], root_run_id=row["root_run_id"],
        followup_key=row["followup_key"] or "",
        followup_depth=int(row["followup_depth"] or 0),
        progress_code=progress_code, progress_params=progress_params,
        error_code=error_code, error_params=error_params,
    )


class TaskRunStore:
    """`task_run` 的唯一写入口。

    `enabled=False` 时所有写入是空操作而读取照常：只读端（macOS）的账本是写入端的
    副本，在那里写一行任务记录等于制造一处永远合不回去的分叉。读得到写入端在跑什么
    仍然有用，所以只关写。
    """

    def __init__(self, database: LedgerDatabase | Path | str, *,
                 enabled: bool = True, host: str | None = None):
        self.database = (database if isinstance(database, LedgerDatabase)
                         else LedgerDatabase(Path(database)))
        self.enabled = bool(enabled)
        self.host = host if host is not None else socket.gethostname()
        self._lock = threading.Lock()
        #: run_id → 上一次写进度的单调时钟。节流只看这一份，不查库。
        self._last_write: dict[int, float] = {}
        #: 进度正写不进去的那几轮。一段连续失败只记一条 warning，写进去一次就清掉。
        self._progress_failing: set[int] = set()
        self.finish_retry_delays = FINISH_RETRY_DELAYS

    def available(self) -> bool:
        """这本账本上有没有 `task_run` 表。

        迁移不是服务启动时自动跑的（`peach migrate --apply` 是单独一步），所以升级
        之后第一次启动完全可能撞上没有这张表的账本。那时候不能让每个按钮都炸成 500：
        调用方据此把整个任务中心关掉，各域的任务照常能跑，只是这一轮不留记录。
        """
        try:
            self.query(limit=1)
            return True
        except sqlite3.DatabaseError:
            return False

    # -- 写入 --------------------------------------------------------------

    def start(self, task_key: str, *, trigger: str, mutex_key: str | None = None,
              conflict: str = "skip", total: int | None = None,
              label: str = "", pid: int | None = None,
              summary: dict | None = None, code: str | None = None,
              params: dict | None = None) -> TaskRun | None:
        from .update_tasks import admission
        with admission(self.database.db_path):
            from .job_recovery import current_run
            resumed = self._resume(current_run.get(), task_key)
            if resumed is not None:
                return resumed
            return self._start(task_key, trigger=trigger, mutex_key=mutex_key,
                               conflict=conflict, total=total, label=label, pid=pid,
                               summary=summary, code=code, params=params)

    def suspend(self, run_id: int, *, label: str | None = None, code: str | None = None,
                params: dict | None = None, paused_for_update: bool = True) -> None:
        """放回排队。不给说明时写「等待安装完成后继续」；只给原文、没给 code 的，界面照原文显示。"""
        if not self.enabled:
            return
        if label is None:
            waiting = run_progress("waitingForUpdate")
            label, code, params = waiting["label"], waiting["code"], waiting["params"]
        with self.database.write_transaction(notify=False) as connection:
            connection.execute(
                "UPDATE task_run SET status='pending',pid=0,progress_label=?,progress_code=?,"
                "progress_params=?,result_summary=? WHERE id=? AND status='running'",
                (_text(label, code), *_coded(code, params),
                 json.dumps({'paused_for_update': True} if paused_for_update else {}), run_id))

    def _resume(self, run_id, task_key):
        if run_id is None or not self.enabled:
            return None
        with self.database.write_transaction(notify=False) as connection:
            cursor = connection.execute(
                "UPDATE task_run SET status='running',pid=?,host=?,heartbeat_at=?,result_summary='{}' "
                "WHERE id=? AND task_key=? AND status='pending' "
                "AND json_extract(result_summary,'$.paused_for_update')=1",
                (os.getpid(), self.host, stamp(), run_id, task_key))
        return self.get(run_id) if cursor.rowcount else None

    def _start(self, task_key: str, *, trigger: str, mutex_key: str | None = None,
               conflict: str = "skip", total: int | None = None,
               label: str = "", pid: int | None = None,
               summary: dict | None = None, code: str | None = None,
               params: dict | None = None) -> TaskRun | None:
        """开一轮。互斥冲突时按 `conflict` 处理，返回 None 或抛 `TaskRunConflict`。

        `summary` 是开跑时就知道的那部分摘要，例如这一轮处理的是哪部作品；结算时由最终摘要替换。

        `conflict="skip"` 是定时触发的语义：本轮不跑，但要留下一条记录说明被谁挡了。
        `conflict="raise"` 是手动触发的语义：告诉用户是哪一轮挡着，让他自己决定。
        """
        if trigger not in TRIGGERS:
            raise ValueError(f"unknown trigger: {trigger}")
        if conflict not in ("skip", "raise"):
            raise ValueError(f"unknown conflict mode: {conflict}")
        if not self.enabled:
            return None
        moment = stamp()
        try:
            with self.database.write_transaction(notify=False) as connection:
                cursor = connection.execute(
                    "INSERT INTO task_run(task_key,trigger,status,mutex_key,pid,host,"
                    "started_at,heartbeat_at,progress_current,progress_total,"
                    "progress_label,progress_code,progress_params,result_summary) "
                    "VALUES(?,?,'running',?,?,?,?,?,0,?,?,?,?,?)",
                    (task_key, trigger, mutex_key, pid if pid is not None else os.getpid(),
                     self.host, moment, moment, total, _text(label, code), *_coded(code, params),
                     json.dumps(summary or {}, ensure_ascii=False)))
                run_id = int(cursor.lastrowid)
                from .task_control import initialize_speed
                initialize_speed(self, run_id, task_key=task_key)
        except sqlite3.IntegrityError:
            if mutex_key is None:
                # 没声明互斥还撞上约束，说明坏的是别的东西（CHECK、列约束），
                # 把它当成冲突就是把真故障藏起来。
                raise
            blocking = self.blocking(mutex_key)
            if conflict == "raise":
                raise TaskRunConflict(
                    task_key, blocking.id if blocking else None) from None
            self._record_skip(task_key, trigger, mutex_key, blocking)
            return None
        # 这里刻意不给节流打时间戳：开工那一刻还不知道要做多少件，第一次进度报上来的
        # 才是真正能看的那一行。把它一起节流掉，活动页开头两秒只有一句「进行中」。
        return self.get(run_id)

    def _record_skip(self, task_key: str, trigger: str, mutex_key: str,
                     blocking: TaskRun | None) -> None:
        """把一次静默跳过写成终态记录。它没有 `started_at`——这一轮从没开跑。"""
        reason = (run_error("skippedBy", run=blocking.id, trigger=blocking.trigger)
                  if blocking else run_error("skipped"))
        summary = json.dumps({"blocked_by": blocking.id if blocking else None},
                             ensure_ascii=False)
        with self.database.write_transaction(notify=False) as connection:
            connection.execute(
                "INSERT INTO task_run(task_key,trigger,status,mutex_key,pid,host,"
                "finished_at,result_summary,error,error_code,error_params) "
                "VALUES(?,?,'cancelled',?,?,?,?,?,?,?,?)",
                (task_key, trigger, mutex_key, os.getpid(), self.host, stamp(), summary,
                 None, *_coded(reason["error_code"], reason["error_params"])))

    def progress(self, run_id: int | None, *, current: int | None = None,
                 total: int | None = None, label: str | None = None,
                 throttle: float = PROGRESS_INTERVAL, code: str | None = None,
                 params: dict | None = None) -> bool:
        """推进度并顺带续租。已经进终态的行不再接受进度。

        `label` 与它的 `code`、`params` 一起写：只给原文的那一次把 code 清掉。

        `throttle` 是墙钟节流：页面两秒轮询一次，比这更密的写入没有读者，只有代价。
        收尾前那一次要看到真实的最终计数，调用方传 `throttle=0`。

        写锁拿不到时返回 False、不抛：进度丢一次，页面上只是计数晚两秒；抛出去则会
        打断正在跑的任务本身。没写进去的那次照样占一个节流窗口，否则账本被长时间占住
        期间，每一次进度都要为写锁等满 `PROGRESS_LOCK_TIMEOUT`。
        """
        if not self.enabled or run_id is None or not self._due(run_id, throttle):
            return False
        assignments = ["heartbeat_at=?"]
        values: list[object] = [stamp()]
        for column, value in (("progress_current", current),
                              ("progress_total", total)):
            if value is not None:
                assignments.append(f"{column}=?")
                values.append(value)
        if label is not None:
            assignments += ["progress_label=?", "progress_code=?", "progress_params=?"]
            values += [_text(label, code), *_coded(code, params)]
        return self._update_progress(run_id, assignments, values)

    def heartbeat(self, run_id: int | None, *,
                  throttle: float = PROGRESS_INTERVAL) -> bool:
        """只续租。没有计数可报、但确实还活着的阶段用它。写锁拿不到时同 `progress`。"""
        if not self.enabled or run_id is None or not self._due(run_id, throttle):
            return False
        return self._update_progress(run_id, ["heartbeat_at=?"], [stamp()])

    def _update_progress(self, run_id: int, assignments: list[str],
                         values: list[object]) -> bool:
        try:
            done = self._update_active(run_id, assignments, values,
                                       timeout=PROGRESS_LOCK_TIMEOUT)
        except sqlite3.OperationalError as error:
            with self._lock:
                first = run_id not in self._progress_failing
                self._progress_failing.add(run_id)
            if first:
                LOGGER.warning("Progress for run %s was not written to task_run, will retry with the next update: %s",
                               run_id, error)
            return False
        with self._lock:
            self._progress_failing.discard(run_id)
        return done

    def finish(self, run_id: int | None, status: str, *, summary: dict | None = None,
               error: str = "", error_code: str | None = None,
               error_params: dict | None = None) -> bool:
        """结算。只能从活跃态进终态，一条 UPDATE 带 WHERE 做 CAS。

        返回是否由本次调用落地。`False` 表示这一轮已经被别人结算过——租约回收和任务
        自己收尾撞在一起就是这种情形，后到的那个不许覆盖。

        写锁拿不到时按 `finish_retry_delays` 重试，全部用完仍写不进去才抛。
        """
        if status not in TERMINAL_STATUSES:
            raise ValueError(f"{status} is not a terminal status")
        if not self.enabled or run_id is None:
            return False
        moment = stamp()
        assignments = ["status=?", "finished_at=?", "heartbeat_at=?", "result_summary=?",
                       "error=?", "error_code=?", "error_params=?"]
        coded = error_code if error else None
        values = [status, moment, moment,
                  json.dumps(summary or {}, ensure_ascii=False), _text(error, coded),
                  *_coded(coded, error_params)]
        delays = list(self.finish_retry_delays)
        while True:
            try:
                done = self._update_active(run_id, assignments, values, cancelled=status == "cancelled")
                break
            except sqlite3.OperationalError as failure:
                if not delays:
                    raise
                delay = delays.pop(0)
                LOGGER.warning("Settlement for run %s was not written to task_run, retrying in %s s: %s",
                               run_id, delay, failure)
                time.sleep(delay)
        with self._lock:
            self._last_write.pop(run_id, None)
            self._progress_failing.discard(run_id)
        return done

    # -- 后继（ADR-0040）--------------------------------------------------

    def enqueue_followups(self, parent_run_id: int | None, followups, *, on_queued=None) -> dict:
        """把一轮任务声明的后继写成 `pending` 行，返回这次入队的结果。

        `followups` 的每一项是 `(key, task_key, label)`，可再带 `code, params`：`key` 是这件事的
        全名，同时是互斥键；`task_key` 决定谁来跑它、活动页上显示成什么；`label` 是排队时的进度说明。

        三种没入队的情况分开计数，都不静默：`duplicates` 是同一件事已经在排或在跑
        （同一次声明里重复的也算），`truncated` 是超出 `MAX_FOLLOWUPS` 被截掉的，
        `depth_exceeded` 是这条链已经到 `MAX_FOLLOWUP_DEPTH` 层。调用方把这三个数
        放进父任务的摘要，活动页因此看得见「派了几条、丢了几条」。
        `on_queued(connection, run_id)` 在入队事务内登记后继所属的业务记录。
        """
        result = {"queued": [], "duplicates": 0, "truncated": 0, "depth_exceeded": 0}
        items = list(followups or [])
        if not self.enabled or parent_run_id is None or not items:
            return result
        parent = self.get(int(parent_run_id))
        if parent is None:
            return result
        depth = parent.followup_depth + 1
        if depth > MAX_FOLLOWUP_DEPTH:
            result["depth_exceeded"] = len(items)
            return result
        seen: set[str] = set()
        planned: list[tuple[str, str, str | None, str | None, str | None]] = []
        for item in items:
            key, task_key, label, code, params = (*item, None, None)[:5]
            key = str(key).strip()
            if not key or key in seen:
                result["duplicates"] += 1
                continue
            seen.add(key)
            planned.append((key, str(task_key), _text(str(label or ""), code), *_coded(code, params)))
        if len(planned) > MAX_FOLLOWUPS:
            result["truncated"] = len(planned) - MAX_FOLLOWUPS
            planned = planned[:MAX_FOLLOWUPS]
        root = parent.root_run_id or parent.id
        moment = stamp()
        from .task_control import initialize_speed
        from .update_tasks import gate, state_for
        with gate(state_for(self.database.db_path)), self.database.write_transaction(notify=False) as connection:
            # 父任务是裸任务时它就是这条链的根。补在这里而不是 `start`：开工那一刻还
            # 不知道这一轮会不会派后继，给每一行都填一个指向自己的 root 是无意义的噪声。
            connection.execute(
                "UPDATE task_run SET root_run_id=id WHERE id=? AND root_run_id IS NULL",
                (parent.id,))
            for key, task_key, label, code, params in planned:
                try:
                    cursor = connection.execute(
                        "INSERT INTO task_run(task_key,trigger,status,mutex_key,pid,host,"
                        "heartbeat_at,progress_label,progress_code,progress_params,result_summary,"
                        "parent_run_id,root_run_id,followup_key,followup_depth) "
                        "VALUES(?,?,'pending',?,?,?,?,?,?,?,'{}',?,?,?,?)",
                        (task_key, parent.trigger, key, os.getpid(), self.host,
                         moment, label, code, params, parent.id, root, key, depth))
                except sqlite3.IntegrityError:
                    # 活跃互斥索引拦下的：同一件事已经在排队或在跑，这一条不必再排。
                    result["duplicates"] += 1
                    continue
                run_id = int(cursor.lastrowid)
                if on_queued is not None:
                    on_queued(connection, run_id)
                initialize_speed(self, run_id, parent)
                result["queued"].append(run_id)
        return result

    def continue_followup(self, run: TaskRun) -> int | None:
        """一条后继结算后说「还没做完」，在原地接一条同样的：同一个父任务、同一层、同一个键。

        不走 `enqueue_followups`：那是往下派一层，存量要跑几十轮的事会撞上 `MAX_FOLLOWUP_DEPTH`。
        接续不加深，会不会停由处理器自己保证——它只在这一轮确实推进了才说要接着跑（ADR-0084）。
        新行的 id 比已经在排的都大，同一通道里别的后继先跑。返回新行 id；同一件事已经在排就是 None。
        """
        if not self.enabled or not run.followup_key:
            return None
        from .task_control import initialize_speed
        from .update_tasks import gate, state_for
        with gate(state_for(self.database.db_path)), self.database.write_transaction(notify=False) as connection:
            try:
                # 接续的那一行只说任务名：要做的那一件还没领到，上一轮的条目已经做完。
                waiting = item_progress(run.task_key)
                cursor = connection.execute(
                    "INSERT INTO task_run(task_key,trigger,status,mutex_key,pid,host,"
                    "heartbeat_at,progress_label,progress_code,progress_params,result_summary,"
                    "parent_run_id,root_run_id,followup_key,followup_depth) "
                    "VALUES(?,?,'pending',?,?,?,?,?,?,?,'{}',?,?,?,?)",
                    (run.task_key, run.trigger, run.followup_key, os.getpid(), self.host,
                     stamp(), None, *_coded(waiting["code"], waiting["params"]),
                     run.parent_run_id, run.root_run_id, run.followup_key, run.followup_depth))
            except sqlite3.IntegrityError:
                return None
            run_id = int(cursor.lastrowid)
            initialize_speed(self, run_id, run)
        return run_id

    def claim_followup(self, task_keys, first=()) -> TaskRun | None:
        """装更新期间返回 None；闸门锁被别人拿着时抛 `GateBusy`，调用方稍后再领。"""
        from .update_tasks import admission, GateBusy, UpdateBusy
        try:
            with admission(self.database.db_path):
                return self._claim_followup(task_keys, first)
        except GateBusy:
            raise
        except UpdateBusy:
            return None

    def _claim_followup(self, task_keys, first=()) -> TaskRun | None:
        """领走这几类里最早的一条待跑后继并标 `running`；没有就返回 None。

        `task_keys` 是调用方这条通道负责的任务种类，`first` 是其中插队先领的那几类
        （ADR-0114）。同一档里按 id 升序领，先声明的先跑。
        """
        keys = tuple(dict.fromkeys(str(key) for key in task_keys or ()))
        if not self.enabled or not keys:
            return None
        ahead = tuple(dict.fromkeys(str(key) for key in first or ())) or ("",)
        marks = ",".join("?" * len(keys))
        from .task_control import requested
        moment = stamp()
        with self.database.write_transaction(notify=False) as connection:
            rows = connection.execute(
                f"SELECT id,parent_run_id,root_run_id FROM task_run WHERE followup_key IS NOT NULL "
                f"AND status='pending' AND task_key IN ({marks}) "
                f"ORDER BY task_key IN ({','.join('?' * len(ahead))}) DESC, id",
                (*keys, *ahead)).fetchall()
            row = None
            for candidate in rows:
                action = requested(self.database.db_path, candidate['id'],
                                   (candidate['parent_run_id'], candidate['root_run_id']))
                if action == 'cancel':
                    connection.execute("UPDATE task_run SET status='cancelled',finished_at=?,heartbeat_at=? "
                                       "WHERE id=? AND status='pending'", (moment, moment, candidate['id']))
                    _settle_cancelled_followup(connection, candidate['id'])
                elif action != 'pause':
                    row = candidate
                    break
            if row is None:
                return None
            run_id = int(row["id"])
            cursor = connection.execute(
                "UPDATE task_run SET status='running',pid=?,host=?,started_at=COALESCE(started_at,?),"
                "heartbeat_at=? WHERE id=? AND status='pending'",
                (os.getpid(), self.host, moment, moment, run_id))
        return self.get(run_id) if cursor.rowcount else None

    def requeue_followups(self) -> list[int]:
        """把停在 `running` 的后继改回 `pending`，服务启动时调用一次。

        普通任务在这种情形下被判 `interrupted`（`recover_interrupted`），后继不能——
        没跑完的后继冻在终态就再也没有重试机会，而续跑的判据是「只把成功判定当作已
        完成」（`peach-batch-jobs`）。代价是后继必须幂等，这条写在 ADR-0040 第六条。
        """
        if not self.enabled:
            return []
        with self.database.write_transaction(notify=False) as connection:
            rows = connection.execute(
                "SELECT id FROM task_run WHERE followup_key IS NOT NULL "
                "AND status='running'").fetchall()
            if not rows:
                return []
            connection.execute(
                "UPDATE task_run SET status='pending',heartbeat_at=? "
                "WHERE followup_key IS NOT NULL AND status='running'",
                (stamp(),))
        return [int(row["id"]) for row in rows]

    def children(self, parent_run_id: int, *, limit: int | None = None) -> list[TaskRun]:
        """这一轮派出的后继，按入队顺序。

        给了 `limit` 只取最近派出的那么多条，正在跑的另外一条不落：后继按 id 顺序认领，在跑的那条
        往往是最早的，按 id 取最近几条只剩排队的。总数看 `followup_counts`。
        """
        with self.database.read_connection() as connection:
            if limit is None:
                rows = connection.execute(
                    f"SELECT {_COLUMNS} FROM task_run WHERE parent_run_id=? ORDER BY id",
                    (int(parent_run_id),)).fetchall()
            else:
                rows = connection.execute(
                    f"SELECT {_COLUMNS} FROM task_run WHERE parent_run_id=? AND (status='running' OR id IN ("
                    "SELECT id FROM task_run WHERE parent_run_id=? ORDER BY id DESC LIMIT ?)) ORDER BY id",
                    (int(parent_run_id), int(parent_run_id), max(1, int(limit)))).fetchall()
        return [_row(row) for row in rows]

    def _due(self, run_id: int, throttle: float) -> bool:
        """节流闸门。放行的那一次也记时间——不记的话下一次拿 0 当基准，节流形同虚设。"""
        now = time.monotonic()
        with self._lock:
            if throttle > 0 and now - self._last_write.get(run_id, 0.0) < throttle:
                return False
            self._last_write[run_id] = now
        return True

    def _update_active(self, run_id: int, assignments: list[str],
                       values: list[object], *, timeout: float | None = None, cancelled: bool = False) -> bool:
        marks = ",".join(f"'{name}'" for name in ACTIVE_STATUSES)
        with self.database.write_transaction(notify=False, timeout=timeout) as connection:
            cursor = connection.execute(
                f"UPDATE task_run SET {','.join(assignments)} "
                f"WHERE id=? AND status IN ({marks})",
                [*values, run_id])
            if cancelled and cursor.rowcount:
                _settle_cancelled_followup(connection, run_id)
        return cursor.rowcount > 0

    # -- 启动恢复与回收 ----------------------------------------------------

    def recover_interrupted(self, *, stale_after: float = LEASE_SECONDS) -> list[int]:
        """把上一个进程留下的活跃行改成 `interrupted`。服务启动时调用一次。

        判据分两种，本机与别的机器不能共用一条：

        - **本机写的行**：进程不在了就是被打断，不必等租约到期。PID 与我们自己相同
          也算——启动恢复跑在建任何一轮之前，那必然是一个被复用的 PID。
        - **别的机器写的行**：账本是复制过来的，那台机器上的进程存活与否这里查不到，
          只能按租约判。

        写成 `interrupted` 而不是 `failed`：任务没有失败，是没跑完；两者在「要不要
        去查为什么」上是相反的结论。

        后继不走这里，它们由 `requeue_followups` 重新排队（ADR-0040 第六条）。
        """
        if not self.enabled:
            return []
        deadline = datetime.now(timezone.utc) - timedelta(seconds=stale_after)
        recovered: list[int] = []
        for run in self.query(status="active", limit=1000):
            if run.followup:
                continue
            if run.status == 'pending' and run.result_summary.get('paused_for_update'):
                from .job_recovery import read
                recovery = read(self.database.db_path, run.task_key)
                if recovery.get('status') == 'active' and recovery.get('run_id') == run.id:
                    continue
            local = run.host == self.host
            alive = (local and run.pid is not None and run.pid != os.getpid()
                     and process_matches(run.pid, run.heartbeat_at or run.started_at, alive=process_alive))
            beat = _parse(run.heartbeat_at) or _parse(run.started_at)
            expired = beat is None or beat < deadline
            if alive or (not local and not expired):
                continue
            if local:
                from .job_recovery import read
                recovery = read(self.database.db_path, run.task_key)
                if recovery.get('status') == 'active' and recovery.get('run_id') == run.id:
                    self.suspend(run.id, **run_progress("waitingForService"))
                    continue
            if self.finish(run.id, "interrupted", **run_error("interrupted")):
                recovered.append(run.id)
        return recovered

    def prune(self, task_key: str, keep: int = DEFAULT_KEEP, *, keep_errors: bool = False,
              failed_days: float | None = FAILED_FOLLOWUP_DAYS) -> int:
        """每个 task_key 只留最近 `keep` 条终态记录，返回删掉多少条。

        活跃任务保留，指向已清退历史的父任务和根任务关联由删除触发器置空。
        随后清退整个数据根里已结束运行的控制文件（`task_control.prune_controls`），不限本 task_key。
        后继使用 `keep_errors`：成功与取消的按 `keep` 条清退；失败与中断的不占条数，按结束时间
        保留 `failed_days` 天，过了就清退。重试不读这一行——下载按自己的后处理状态重派，
        升级补修按 `ledger_upgrade_item`——它只供任务中心里看最近出过什么错。`failed_days`
        为 None 时失败行全留，交给类型自己按结论清退（`FollowupType.prunes_failures`）。
        下载状态保留并清空已清退运行的链接。阈值用 `LIMIT 1 OFFSET keep` 取「第 keep+1 新的那条 id」。
        """
        if not self.enabled or keep < 0:
            return 0
        states = ('succeeded', 'cancelled') if keep_errors else TERMINAL_STATUSES
        marks = ",".join(f"'{name}'" for name in states)
        removed = 0
        with self.database.write_transaction(notify=False) as connection:
            threshold = connection.execute(
                f"SELECT id FROM task_run WHERE task_key=? AND status IN ({marks}) "
                "ORDER BY id DESC LIMIT 1 OFFSET ?", (task_key, keep)).fetchone()
            if threshold is not None:
                removed = _delete_runs(connection, f"task_key=? AND status IN ({marks}) AND id<=?",
                                       (task_key, threshold["id"]))
            if keep_errors and failed_days is not None:
                cutoff = stamp(datetime.now(timezone.utc) - timedelta(days=failed_days))
                removed += _delete_runs(
                    connection, "task_key=? AND status IN ('failed','interrupted') "
                    "AND followup_key IS NOT NULL AND finished_at<?", (task_key, cutoff))
        from .task_control import prune_controls
        prune_controls(self)
        return removed

    def delete_finished(self, run_ids) -> int:
        """删掉这几行已结束的运行（活跃的不碰），收走它们的控制文件，返回删掉的行数。

        给按自己的结论清退失败后继的调用方（`upgrade_repairs.prune_settled_failures`）。
        """
        ids = sorted({int(run_id) for run_id in run_ids})
        if not self.enabled or not ids:
            return 0
        removed = 0
        terminal = ",".join(f"'{name}'" for name in TERMINAL_STATUSES)
        with self.database.write_transaction(notify=False) as connection:
            for offset in range(0, len(ids), 900):
                batch = ids[offset:offset + 900]
                removed += _delete_runs(
                    connection, f"status IN ({terminal}) AND id IN ({','.join('?' * len(batch))})", batch)
        from .task_control import prune_controls
        prune_controls(self)
        return removed

    # -- 查询 --------------------------------------------------------------

    def get(self, run_id: int) -> TaskRun | None:
        with self.database.read_connection() as connection:
            row = connection.execute(
                f"SELECT {_COLUMNS} FROM task_run WHERE id=?", (run_id,)).fetchone()
        return _row(row) if row else None

    def active_descendants(self, run_id: int, *, limit: int | None = None) -> list[TaskRun]:
        """还在排或在跑的全部后代（不含自己），一条查询取回整行。

        一轮补全能派出上千条后继；逐条 `get` 每条都开一次连接，任务中心每次轮询都要等好几秒。
        只想知道有没有时给 `limit=1`。
        """
        sql = ("WITH RECURSIVE family(id) AS (SELECT id FROM task_run WHERE parent_run_id=? "
               "UNION ALL SELECT t.id FROM task_run t JOIN family f ON t.parent_run_id=f.id) "
               f"SELECT {_COLUMNS} FROM task_run WHERE id IN (SELECT id FROM family) "
               "AND status IN ('pending','running') ORDER BY id")
        params: tuple = (run_id,)
        if limit is not None:
            sql += " LIMIT ?"
            params += (limit,)
        with self.database.read_connection() as connection:
            rows = connection.execute(sql, params).fetchall()
        return [_row(row) for row in rows]

    def active_families(self, run_ids: list[int] | None = None) -> dict[int, list[tuple[int, str]]]:
        """每条自己或后代还在排在跑的任务 → 这一族里在排在跑的 `(id, status)`（含自己），按 id 排。

        键与 `live_ids` 相同。任务中心一页里每条在跑的任务都要问「族里谁还活着」：逐条递归查询、
        逐条开连接，几千条排队后继时一次轮询要好几秒；这里一条查询沿父链往上一次取齐。
        """
        if run_ids == []:
            return {}
        if run_ids is None:
            query = ("WITH RECURSIVE up(ancestor, id, status) AS ("
                    "SELECT id, id, status FROM task_run WHERE status IN ('pending','running') "
                    "UNION SELECT t.parent_run_id, u.id, u.status FROM task_run t JOIN up u ON t.id=u.ancestor "
                    "WHERE t.parent_run_id IS NOT NULL) SELECT ancestor, id, status FROM up ORDER BY ancestor, id")
        else:
            marks = ",".join("?" for _ in run_ids)
            query = (f"WITH RECURSIVE family(ancestor, id, status) AS ("
                     f"SELECT id, id, status FROM task_run WHERE id IN ({marks}) "
                     "UNION SELECT f.ancestor, t.id, t.status FROM task_run t JOIN family f ON t.parent_run_id=f.id) "
                     "SELECT ancestor, id, status FROM family WHERE status IN ('pending','running') ORDER BY ancestor, id")
        families: dict[int, list[tuple[int, str]]] = {}
        with self.database.read_connection() as connection:
            for ancestor, run_id, status in connection.execute(query, run_ids or ()):
                families.setdefault(int(ancestor), []).append((int(run_id), status))
        return families

    def live_ids(self) -> set[int]:
        """自己或某个后代还在排或在跑的任务：在排在跑的那些，连同它们沿父链往上的每一层。

        任务中心一页两百来条，绝大多数早已结束、后代也都结束了；先一条查询圈出这一份，
        不在里面的就不必逐条再问控制状态与资源占用。
        """
        with self.database.read_connection() as connection:
            return {int(row[0]) for row in connection.execute(
                "WITH RECURSIVE live(id) AS (SELECT id FROM task_run WHERE status IN ('pending','running') "
                "UNION SELECT t.parent_run_id FROM task_run t JOIN live l ON t.id=l.id "
                "WHERE t.parent_run_id IS NOT NULL) SELECT id FROM live")}

    def blocking(self, mutex_key: str) -> TaskRun | None:
        """当前占着这把锁的那一轮。冲突时用它回答「是谁挡的」。"""
        marks = ",".join(f"'{name}'" for name in ACTIVE_STATUSES)
        with self.database.read_connection() as connection:
            row = connection.execute(
                f"SELECT {_COLUMNS} FROM task_run WHERE mutex_key=? "
                f"AND status IN ({marks}) ORDER BY id LIMIT 1", (mutex_key,)).fetchone()
        return _row(row) if row else None

    def query(self, *, status: str = "", task_key: str = "",
              limit: int = 50) -> list[TaskRun]:
        """按状态与任务筛最近的若干轮。`status` 另收 `active`／`finished` 两个合集。"""
        clauses: list[str] = []
        values: list[object] = []
        if status == "active":
            clauses.append("status IN (%s)" % ",".join(f"'{s}'" for s in ACTIVE_STATUSES))
        elif status == "finished":
            clauses.append("status IN (%s)" % ",".join(f"'{s}'" for s in TERMINAL_STATUSES))
        elif status:
            if status not in (*ACTIVE_STATUSES, *TERMINAL_STATUSES):
                raise ValueError(f"unknown status: {status}")
            clauses.append("status=?")
            values.append(status)
        if task_key:
            clauses.append("task_key=?")
            values.append(task_key)
        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        with self.database.read_connection() as connection:
            rows = connection.execute(
                f"SELECT {_COLUMNS} FROM task_run{where} ORDER BY id DESC LIMIT ?",
                [*values, max(1, min(int(limit), 500))]).fetchall()
        return [_row(row) for row in rows]

    @staticmethod
    def _finished_condition() -> str:
        marks = ",".join(f"'{name}'" for name in TERMINAL_STATUSES)
        active = ",".join(f"'{name}'" for name in ACTIVE_STATUSES)
        return (f"t.status IN ({marks}) AND (t.parent_run_id IS NULL OR NOT EXISTS "
                "(SELECT 1 FROM task_run p WHERE p.id=t.parent_run_id)) AND NOT EXISTS "
                f"(SELECT 1 FROM task_run c WHERE c.parent_run_id=t.id AND c.status IN ({active}))")

    def finished_count(self) -> int:
        with self.database.read_connection() as connection:
            return connection.execute(
                f"SELECT count(*) FROM task_run t WHERE {self._finished_condition()}").fetchone()[0]

    def finished_page(self, *, before: tuple[str, int] | None = None,
                      limit: int = 50, offset: int = 0) -> tuple[list[TaskRun], bool]:
        """终态行按结束时刻从新到旧取一页，返回这一页和它后面还有没有更早的。

        排序键是 `(finished_at, id)` 而不是 `id`：开跑早、结束晚的长任务按 id 会落进
        早已翻过的那几页，活动页「最近完成」上就再也看不到它。终态一次性，结束时刻落地
        后不再变，所以游标之后的行不会再挪到它前面去。`before` 是上一页最旧那一行的
        `(finished_at, id)`，这一页只取严格排在它后面的行。

        一页数的是顶层那几轮，它们已结束的后继跟着一起回来：一轮拉取派出二十条后继时，
        按行数翻页会让后继占满这一页、把派出它们的那一轮挤到下一页，页面上就只剩一串
        没有父卡片可挂的散行。父行已被 `prune` 掉的后继自己算顶层。

        后继还在排或在跑的那几轮不算「完成」，由 `active_parents` 单独交给「正在进行」：
        自动修复每分钟派一批，它们留在这里会占满第一页，「最近完成」就只剩一个「加载更早」。
        """
        size = max(1, min(int(limit), 500))
        where = self._finished_condition()
        values: list[object] = []
        if before is not None:
            where += " AND (t.finished_at<? OR (t.finished_at=? AND t.id<?))"
            values = [before[0], before[0], int(before[1])]
        columns = ",".join(f"t.{name}" for name in _COLUMNS.split(","))
        with self.database.read_connection() as connection:
            rows = connection.execute(
                f"SELECT {columns} FROM task_run t WHERE {where} "
                "ORDER BY t.finished_at DESC, t.id DESC LIMIT ? OFFSET ?",
                [*values, size + 1, max(0, int(offset))]).fetchall()
        page = [_row(row) for row in rows[:size]]
        return page + self.settled_followups([run.id for run in page]), len(rows) > size

    def settled_followups(self, root_ids, *, limit: int | None = None) -> list[TaskRun]:
        """这几轮派出的、已经结束的后继，整条链上的都算；每轮只取最近 `limit` 条。

        任务中心有任务在跑时每两秒取一次，一轮派出上千条后继时不设上限就是每两秒几千行。
        总数与失败数看 `followup_counts`，卡片展开时再按父任务取全（`/api/tasks/{id}`）。
        """
        ids = [int(run_id) for run_id in root_ids]
        if not self.enabled or not ids:
            return []
        marks = ",".join(f"'{name}'" for name in TERMINAL_STATUSES)
        holes = ",".join("?" * len(ids))
        with self.database.read_connection() as connection:
            rows = connection.execute(
                f"SELECT {_COLUMNS} FROM (SELECT *, ROW_NUMBER() OVER ("
                "PARTITION BY root_run_id ORDER BY id DESC) AS recent FROM task_run "
                f"WHERE root_run_id IN ({holes}) AND id NOT IN ({holes}) AND status IN ({marks})) "
                "WHERE recent<=? ORDER BY id",
                [*ids, *ids, max(1, int(SETTLED_FOLLOWUP_LIMIT if limit is None else limit))]).fetchall()
        return [_row(row) for row in rows]

    def active_parents(self) -> list[TaskRun]:
        """自己已经结束、派出的后继还有在排或在跑的那几轮，新的在前。"""
        if not self.enabled:
            return []
        marks = ",".join(f"'{name}'" for name in ACTIVE_STATUSES)
        with self.database.read_connection() as connection:
            rows = connection.execute(
                f"SELECT {_COLUMNS} FROM task_run WHERE id IN (SELECT DISTINCT parent_run_id FROM task_run "
                f"WHERE status IN ({marks}) AND parent_run_id IS NOT NULL) AND status NOT IN ({marks}) "
                "ORDER BY id DESC").fetchall()
        return [_row(row) for row in rows]

    def followup_counts(self, parent_ids) -> dict[int, dict[str, int]]:
        """这几轮直接派出的后继按状态各有几条。

        活动页只取得到最近几十条后继，一轮派出上千条时，父任务还算不算在进行、
        做到第几条，要靠这份计数回答，不能数页面上那几行。
        """
        ids = sorted({int(run_id) for run_id in parent_ids})
        if not self.enabled or not ids:
            return {}
        counts: dict[int, dict[str, int]] = {}
        with self.database.read_connection() as connection:
            for offset in range(0, len(ids), 900):
                batch = ids[offset:offset + 900]
                for parent, status, count in connection.execute(
                        f"SELECT parent_run_id, status, count(*) FROM task_run "
                        f"WHERE parent_run_id IN ({','.join('?' * len(batch))}) GROUP BY parent_run_id, status",
                        batch):
                    counts.setdefault(int(parent), {})[str(status)] = int(count)
        return counts

    # -- 调用方的便利入口 --------------------------------------------------

    @contextmanager
    def track(self, task_key: str, *, trigger: str, mutex_key: str | None = None,
              conflict: str = "skip", total: int | None = None,
              label: str = "", keep: int = DEFAULT_KEEP) -> Iterator["TaskRunHandle"]:
        """同步代码用的一段式接线：进去开一轮，出来按有没有异常自动结算。

        被互斥挡住时产出一个不记录任何东西的 handle（`run_id is None`），调用方自己
        决定要不要继续干活——定时触发应当直接返回，命令行脚本通常也一样。
        """
        run = self.start(task_key, trigger=trigger, mutex_key=mutex_key,
                         conflict=conflict, total=total, label=label)
        handle = TaskRunHandle(self, run.id if run else None)
        try:
            from .task_control import bind, checkpoint
            with bind(self, handle.run_id):
                yield handle
                checkpoint()
        except BaseException as error:
            from .task_control import Cancelled
            from .user_messages import failure_fields
            handle.finish('cancelled' if isinstance(error, Cancelled) else 'failed',
                          **({} if isinstance(error, Cancelled) else failure_fields(error)))
            raise
        else:
            handle.finish("succeeded")
        finally:
            if run is not None:
                self.prune(task_key, keep)


def inert_handle() -> "TaskRunHandle":
    """一个什么都不登记的句柄。给「这一趟不进任务中心」和默认参数用。"""
    return TaskRunHandle(TaskRunStore(Path("."), enabled=False), None)


@contextmanager
def cli_run(task_key: str, db_path: Path | str | None, *, label: str = "",
            mutex_key: str | None = None) -> Iterator["TaskRunHandle"]:
    """命令行脚本的一段式接线：账本上记一轮，异常时记成失败。

    账本还没建、或者还没跑到 0028 时不记录，只在标准输出上说一句。批处理是无人值守
    跑的，因为「这一趟没法登记」就整个不跑，代价比不登记大得多；而静默跳过又会让人
    以为记上了，所以那一句必须打出来。

    脚本被强杀时这里什么也做不了，那一行会停在 `running`：服务下次启动的
    `recover_interrupted` 按 PID 把它收成 `interrupted`，两处判据是同一个。
    """
    store = None
    if db_path is not None and Path(db_path).is_file():
        candidate = TaskRunStore(Path(db_path))
        try:
            candidate.query(limit=1)
            store = candidate
        except sqlite3.OperationalError:
            print(f"[task-run] {db_path} has no task_run table; this run is not recorded in the task center")
    if store is None:
        yield TaskRunHandle(TaskRunStore(Path(db_path or ":memory:"), enabled=False), None)
        return
    with store.track(task_key, trigger="cli", mutex_key=mutex_key,
                     conflict="skip", label=label) as handle:
        yield handle


def declared_rows(declared) -> list[tuple]:
    """任务结果里声明的后继（`Followup.declared()` 的写法）换成 `enqueue_followups` 要的行。

    后台任务的结算与命令行入口共用这一份：任务结果是同一个函数给的，两边各拆一遍，
    命令行那边漏掉，就是一整轮新登记的女优全都没人去补头像和资料。
    """
    if not isinstance(declared, list):
        return []
    return [(item.get("key"), item.get("task_key"), item.get("label", ""),
             item.get("label_code"), item.get("label_params") or {})
            for item in declared if isinstance(item, dict) and item.get("key")]


@dataclass
class TaskRunHandle:
    """一轮任务的句柄。`run_id is None` 表示这一轮没有被记录，所有方法都是空操作。"""

    store: TaskRunStore
    run_id: int | None
    settled: bool = False

    @property
    def saved(self) -> dict:
        """同一条持久任务已提交的领域检查点。"""
        run = self.store.get(self.run_id) if self.run_id is not None else None
        return dict(run.result_summary.get('checkpoint') or {}) if run else {}

    def checkpoint(self, **fields) -> None:
        """领域结果提交后保存完成集合；后继重新领取时沿用。"""
        from .task_control import checkpoint
        checkpoint()
        if self.run_id is None or not self.store.enabled:
            return
        with self.store.database.write_transaction(notify=False) as connection:
            row = connection.execute('SELECT result_summary FROM task_run WHERE id=?', (self.run_id,)).fetchone()
            if row is None:
                return
            summary = json.loads(row[0] or '{}')
            summary['checkpoint'] = {**summary.get('checkpoint', {}), **fields}
            connection.execute("UPDATE task_run SET result_summary=? WHERE id=? AND status='running'",
                               (json.dumps(summary, ensure_ascii=False), self.run_id))

    def progress(self, current: int | None = None, total: int | None = None,
                 label: str | None = None, *,
                 throttle: float = PROGRESS_INTERVAL, code: str | None = None,
                 params: dict | None = None) -> None:
        from .task_control import checkpoint
        checkpoint()
        self.store.progress(self.run_id, current=current, total=total,
                            label=label, throttle=throttle, code=code, params=params)

    def heartbeat(self) -> None:
        from .task_control import checkpoint
        checkpoint()
        self.store.heartbeat(self.run_id)

    def finish(self, status: str, *, summary: dict | None = None,
               error: str = "", error_code: str | None = None,
               error_params: dict | None = None) -> bool:
        """结算一次。重复调用不再写入——终态一次性这条约束在句柄这一层也要成立。"""
        if self.settled:
            return False
        self.settled = True
        return self.store.finish(self.run_id, status, summary=summary, error=error,
                                 error_code=error_code, error_params=error_params)
