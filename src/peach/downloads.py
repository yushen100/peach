"""下载任务：云下载与本地下载共用的状态机、失败分类、任务表与对账轮询。

云下载把磁力交给 115（经 CloudDrive2 gRPC，`downloads_clouddrive`）或 PikPak（直连非官方
API，`downloads_pikpak`）离线下载。文件落在已挂载的网盘目录，由推送发现
（CloudDrive2 通知 → `scan.ingest_path`）登记进账本，不拉回本机。这里的轮询只做两件事：
看远端任务走到哪一步，以及远端完成之后账本里迟迟没有那个文件时，定向登记一次。

**状态机**（云下载与待办第 42 条本地下载共用，ADR-0089）：候选 → 已选定 → 已提交 → 远端进行中 → 远端完成 → 已落地 →
已入库，旁支失败、已取消、停滞。候选与已选定留给资源搜索（待办第 43 条）与「想要」清单；
云下载从「已提交」开始。

**九类失败**，只有「瞬时网络」自动重试，其余停在失败、交给用户决定：重新提交会再扣一条
115 离线配额，替用户自动重提等于替他花钱。

**幂等键是小写 40 位 infohash。** 同一个磁力再提交，接管已有任务；远端目录里已经有同一
infohash 的离线任务时也接管，不再调提交接口。

凭据（CloudDrive2 API 令牌、PikPak refresh token）只存本机 `CredentialStore`，不列为可
同步字段，不进 URL、日志与 ledger。
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
import re
import sqlite3
import stat
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath
from typing import Any, Callable, Mapping, Protocol
from urllib.parse import parse_qs, unquote, urlsplit

from .content_words import (CLOUD_BLOCKED, CLOUD_DUPLICATE_WORDS, CLOUD_INVALID_LINK_WORDS, CLOUD_QUOTA_WORDS,
                            CLOUD_STORAGE_FULL, PROMO_NAME)
from .follow_secrets import CredentialStore
from .fsutil import atomic_write_text
from .push_discovery import CloudPathError, CloudPrefix, map_cloud_path, normalise_prefix
from . import interface_text
from .coded_text import Said, coded, columns, from_error, restored
from .user_messages import UserFacingError, UserValueError, nested_message
from .repository import LedgerDatabase, in_background
from .task_retry import RETRY_DELAYS, retry_delay

LOGGER = logging.getLogger(__name__)

# ---------------------------------------------------------------- 状态与失败

CANDIDATE = "candidate"
SELECTED = "selected"
SUBMITTED = "submitted"
REMOTE_RUNNING = "remote_running"
REMOTE_DONE = "remote_done"
LANDED = "landed"
INGESTED = "ingested"
FAILED = "failed"
CANCELLED = "cancelled"
STALLED = "stalled"
#: 提交时网盘暂时没应答，磁力还没交出去；对账线程按退避再交，见 `SUBMIT_RETRY_WINDOW`。
SUBMIT_PENDING = "submit_pending"

POSTPROCESS_NOT_REQUESTED = "not_requested"
POSTPROCESS_PENDING = "pending"
POSTPROCESS_QUEUED = "queued"
POSTPROCESS_RUNNING = "running"
POSTPROCESS_COMPLETE = "complete"
POSTPROCESS_FAILED = "failed"
POSTPROCESS_STATES = (POSTPROCESS_NOT_REQUESTED, POSTPROCESS_PENDING, POSTPROCESS_QUEUED, POSTPROCESS_RUNNING,
                      POSTPROCESS_COMPLETE, POSTPROCESS_FAILED)
STATES = (CANDIDATE, SELECTED, SUBMITTED, REMOTE_RUNNING, REMOTE_DONE, LANDED, INGESTED, FAILED, CANCELLED, STALLED,
          SUBMIT_PENDING)


def state_label(state: str) -> str:
    """下载状态的名字，在 `server:download.state.<state>`（ADR-0159）；认不得的状态照原样。"""
    return interface_text.label(f"server:download.state.{state}", state)


def postprocess_label(state: str) -> str:
    return interface_text.label(f"server:download.postprocess.{state}", state)
#: 轮询要看的状态。远端完成与已落地还在等账本里出现那个文件；等待重新提交的还要再交一次。
TRACKED_STATES = frozenset({SUBMIT_PENDING, SUBMITTED, REMOTE_RUNNING, REMOTE_DONE, LANDED})
#: 可以再提交一次的状态。已入库的不必，在跑的接管就行。
RESUBMITTABLE_STATES = frozenset({FAILED, CANCELLED, STALLED})


@dataclass(frozen=True)
class FailureKind:
    key: str
    retryable: bool = False

    @property
    def label(self) -> str:
        """失败类别的名字，在 `server:download.failure.<key>`。"""
        return interface_text.text(f"server:download.failure.{self.key}")


FAILURE_KINDS: dict[str, FailureKind] = {kind.key: kind for kind in (
    FailureKind("config"), FailureKind("quota"), FailureKind("storage"), FailureKind("rejected"), FailureKind("invalid_link"),
    FailureKind("no_source"), FailureKind("not_accepted"), FailureKind("removed"), FailureKind("duplicate"),
    FailureKind("not_landed"), FailureKind("mismatch"), FailureKind("network", retryable=True),
)}


#: 渠道级失败：额度用完、网盘空间不足、配置或登录失效时，交给这个渠道的每一个任务都会同样失败。
#: 网络故障本身按任务自动重提交；只有带 `channel_down` 的（CloudDrive2 根本连不上）才算渠道级。
CHANNEL_FAILURES = frozenset({"quota", "storage", "config"})
#: 网盘空间不足的说法。115 经 CloudDrive2 回 `190031 云空间不足`，有时走 gRPC 错误，有时写在 `errorMessage` 里；
#: PikPak 的错误码是 `file_space_not_enough`。
STORAGE_FULL = re.compile(CLOUD_STORAGE_FULL, re.IGNORECASE)


def storage_full(text: object) -> bool:
    return bool(STORAGE_FULL.search(str(text or "")))


def never_seen(task: "DownloadTask") -> bool:
    """提交后从没在网盘离线列表里见过：没有远端编号，也没读到过进度。名字不算，提交时就取自磁力。"""
    return task.progress is None and not task.remote_id


class DownloadError(UserFacingError, RuntimeError):
    """一次远端操作失败。`failure` 是故障类别；原因写成 code 与参数，不含凭据。

    `detail` 是按 zh-CN 渲染的那一句（`Said`，带着 code），任务行的失败原因与设置页的检查报告照旧读它。
    `block` 只给 115 的违规拦截（`50038`）：这类失败不重试，同一 infohash 以后直接拒收。
    `channel_down` 表示整个渠道连不上（服务没在运行、地址不通），不是一次超时。
    """

    def __init__(self, failure: str, code: str, params: Mapping[str, Any] | None = None, *,
                 block: bool = False, channel_down: bool = False):
        if failure not in FAILURE_KINDS:
            raise ValueError(f"unknown failure kind: {failure}")
        super().__init__(code, params)
        self.failure = failure
        self.detail = from_error(self)
        self.block = block
        self.channel_down = channel_down

    @property
    def channel_wide(self) -> bool:
        """这次失败说明整个渠道暂时用不了，交给它的其他任务也会一样失败。"""
        return self.failure in CHANNEL_FAILURES or self.channel_down

    @property
    def retryable(self) -> bool:
        return FAILURE_KINDS[self.failure].retryable


class Problem(str):
    """设置块与检查报告里的一条问题（ADR-0159）：值是按 zh-CN 渲染的原句，`code`、`params` 给页面取译文。

    仍是 `str`：去重、比对与老前端读 `problems` 都照旧；`problem_codes` 把它们并行列给页面。
    """

    code: str
    params: dict

    def __new__(cls, code: str, params: Mapping[str, Any] | None = None) -> "Problem":
        values = dict(params or {})
        problem = super().__new__(cls, interface_text.text(f"server:{code}", values))
        problem.code, problem.params = code, values
        return problem

    @classmethod
    def of(cls, error: UserFacingError) -> "Problem":
        return cls(error.code, error.params)


def problem_codes(problems) -> list[dict]:
    """与 `problems` 一一对应的 code 与参数；不带 code 的旧原句给空 code，页面照原文显示。"""
    return [{"code": getattr(problem, "code", ""), "params": dict(getattr(problem, "params", {}))}
            for problem in problems]


#: 115 对违规内容的离线拦截码。CloudDrive2 把 115 的原文放进 `errorMessage`，
#: 只认得出码或「违规」字样，所以两样都匹配。
BLOCKED_PATTERN = re.compile(CLOUD_BLOCKED)
#: 远端原话里的字样到失败类别，按顺序取第一个对上的。字样是网盘接口的原话（内容数据，在 `content_words`）。
REMOTE_WORDS = tuple(
    (re.compile("|".join(map(re.escape, words)), re.IGNORECASE), failure, code)
    for words, failure, code in ((CLOUD_QUOTA_WORDS, "quota", "errors.downloads.remoteQuota"),
                                 (CLOUD_DUPLICATE_WORDS, "duplicate", "errors.downloads.remoteDuplicate"),
                                 (CLOUD_INVALID_LINK_WORDS, "invalid_link", "errors.downloads.remoteInvalidLink")))


def classify_remote_message(message: str) -> DownloadError:
    """远端只给一句话时按字面归类。认不出的归「资源被拒」，原文照抄给用户。"""
    text = str(message or "").strip()
    if not text:
        return DownloadError("rejected", "errors.downloads.remoteRejectedNoReason")
    if BLOCKED_PATTERN.search(text):
        return DownloadError("rejected", "errors.downloads.remoteBlocked", {"text": text}, block=True)
    if storage_full(text):
        return DownloadError("storage", "errors.downloads.remoteStorageFull")
    for pattern, failure, code in REMOTE_WORDS:
        if pattern.search(text):
            return DownloadError(failure, code, {"text": text})
    return DownloadError("rejected", "errors.downloads.remoteRejected", {"text": text})


# ---------------------------------------------------------------- 磁力


@dataclass(frozen=True)
class Magnet:
    info_hash: str
    uri: str
    name: str = ""


_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_BASE32 = re.compile(r"^[a-z2-7]{32}$")


def normalise_info_hash(raw: str) -> str:
    """小写 40 位十六进制。32 位 base32（BEP 9 允许）先换成十六进制，两种写法才是同一个键。"""
    text = str(raw or "").strip().lower()
    if _HEX40.match(text):
        return text
    if _BASE32.match(text):
        try:
            return base64.b32decode(text.upper()).hex()
        except binascii.Error:
            pass
    raise UserValueError("errors.downloads.infohashInvalid")


_TRACKER = re.compile(r"^(?:udp|https?|wss?)://[A-Za-z0-9.\-]+(?::\d{1,5})?(?:/[!-~]*)?$")


def clean_magnet(text: str) -> str:
    """去掉无法解析的 tracker 参数，其余原样保留。

    有的来源给出的磁力里夹着一段打乱的 tracker（`exoduecnuonnaF2%9696A3%moc.cnysed.s`，
    倒过来是 `exodus.desync.com`），115 开放平台把整条链接判为「错误的链接」（10004），
    有时还不报错、只是不建任务。2026-10-28 对照实验：同一个 DASD-911 磁力原样提交被拒，
    只去掉这一段后五秒内就出现在离线列表里。
    """
    split = urlsplit(text)
    kept = []
    for part in split.query.split("&"):
        key, _, value = part.partition("=")
        if key == "tr":
            try:
                decoded = unquote(value, errors="strict")
            except UnicodeDecodeError:
                continue
            if not _TRACKER.match(decoded):
                continue
        if part:
            kept.append(part)
    return f"{split.scheme}:?{'&'.join(kept)}"


def parse_magnet(raw: str) -> Magnet:
    """解析用户粘贴的磁力，或一个裸 infohash。只认 `urn:btih`，v2 的 `btmh` 不在幂等键口径内。"""
    text = str(raw or "").strip()
    if not text:
        raise UserValueError("errors.downloads.magnetRequired")
    if not text.casefold().startswith("magnet:"):
        info_hash = normalise_info_hash(text)
        return Magnet(info_hash, f"magnet:?xt=urn:btih:{info_hash}")
    query = parse_qs(urlsplit(text).query)
    for value in query.get("xt", []):
        if value.casefold().startswith("urn:btih:"):
            info_hash = normalise_info_hash(value[len("urn:btih:"):])
            name = (query.get("dn") or [""])[0].strip()
            return Magnet(info_hash, clean_magnet(text), name[:300])
    raise UserValueError("errors.downloads.magnetNotBittorrent")


def magnet_info_hash(uri: str) -> str:
    """远端只回了原始链接时，从里面取 infohash；取不到返回空串。"""
    try:
        return parse_magnet(uri).info_hash
    except ValueError:
        return ""


# ---------------------------------------------------------------- 远端接口


@dataclass(frozen=True)
class RemoteStatus:
    """远端任务此刻的样子。`state` 只有四种：在跑、完成、失败、列表里找不到。"""
    state: str
    remote_id: str = ""
    name: str = ""
    progress: float | None = None
    message: str = ""
    #: 提交时远端目录里已有同一 infohash 的任务，接过来跟踪，没有调提交接口。
    adopted: bool = False
    #: 远端只报失败、没给原文时，渠道自己写的原因 code；有它就不再按 `message` 的字面归类。
    message_code: str = ""

    def failure(self) -> "DownloadError":
        if self.message_code:
            return DownloadError("rejected", self.message_code)
        return classify_remote_message(self.message)


RUNNING, DONE, ERROR, MISSING = "running", "done", "error", "missing"


class OfflineProvider(Protocol):
    key: str

    def submit(self, magnet: Magnet, target: str) -> RemoteStatus: ...

    def status(self, task: "DownloadTask") -> RemoteStatus: ...

    def landed(self, task: "DownloadTask") -> bool: ...

    def cancel(self, task: "DownloadTask") -> None: ...


PROVIDER_LABELS = {"115": "115", "pikpak": "PikPak"}

# ---------------------------------------------------------------- 时间


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds")


def parse_iso(text: str | None) -> float | None:
    if not text:
        return None
    try:
        return datetime.fromisoformat(text).timestamp()
    except ValueError:
        return None


#: 提交后第一次看的间隔，之后按这张表退避，最后一档封顶。JavBoss 提交后 10 秒查一次。
POLL_DELAYS = (10.0, 30.0, 60.0, 120.0, 300.0, 600.0, 900.0)
#: 提交时网盘暂时没应答（如 CloudDrive2 刷新 115 离线列表超时），从第一次提交起按 `POLL_DELAYS`
#: 再交，这么久还没交上才算失败。
SUBMIT_RETRY_WINDOW = 3600.0
#: 正在提交的任务这么久之内不归后台对账：一次提交要依次调好几个接口，每个最多等 30 秒。
#: 新任务没有排下次检查时间时会被对账线程当作到期，读到「已提交」去查离线列表，再把这份旧状态
#: 写回去，盖掉提交线程刚记下的「等待重新提交」，磁力从没交出去就被判成网盘没收下。
SUBMIT_IN_FLIGHT = 600.0
#: 远端完成后先等推送发现登记；过了这一段账本里还没有，才定向登记一次。
LANDING_GRACE = 60.0
#: 远端完成之后最多等这么久让文件出现在挂载目录、进入账本，超过算「落地未见」。
LANDING_TIMEOUT = 6 * 3600.0
#: 远端列表里找不到任务时，提交后这么久之内当作列表还没刷新，不判失败。
MISSING_GRACE = 180.0
#: 提交后从没在离线列表里出现过的任务多等一会儿：批量提交时 CloudDrive2 与 115 登记慢，
#: 2026-10-16 一批 83 个提交里 25 个三到十分钟内被判失败，期间同一接口超时 17 次。
UNSEEN_GRACE = 900.0
DEFAULT_WAIT_HOURS = 168
MAX_WAIT_HOURS = 24 * 60
#: 判成「长时间未完成」之后，远端任务多半还挂在网盘里，冷门种子过几天才凑齐源的也有。
#: 之后每隔这么久再看一眼，远端完成就照常落地入库；最多再看这么久就彻底不管。
#: 做法同 SakuraMedia `551715b321`：超时只是不再催，不等于远端不会完成。
STALL_RECHECK = 6 * 3600.0
STALL_RECHECK_HORIZON = 7 * 86400.0


def _stall_cutoff(now: float) -> float:
    """停滞早于这一刻的，下一次复查就会超出期限（`_recheck_stalled` 的同一条界线）。"""
    return now - (STALL_RECHECK_HORIZON - STALL_RECHECK)


#: 已落地的目录最多登记这么多个文件；种子里成千上万个小文件交给全量扫描。
MAX_LANDED_FILES = 500


def poll_delay(checks: int) -> float:
    return POLL_DELAYS[min(max(checks, 0), len(POLL_DELAYS) - 1)]


# ---------------------------------------------------------------- 任务表


@dataclass
class DownloadTask:
    id: int
    info_hash: str | None
    provider: str
    source_uri: str
    display_name: str
    target: str
    state: str
    code: str | None = None
    title: str | None = None
    origin: str | None = None
    failure: str | None = None
    failure_detail: str | None = None
    remote_id: str | None = None
    remote_name: str | None = None
    progress: float | None = None
    ledger_path: str | None = None
    asset_id: int | None = None
    checks: int = 0
    submitted_at: str | None = None
    remote_done_at: str | None = None
    updated_at: str = ""
    finished_at: str | None = None
    next_check_at: str | None = None
    blocked_at: str | None = None
    postprocess_state: str = POSTPROCESS_NOT_REQUESTED
    postprocess_detail: str | None = None
    postprocess_run_id: int | None = None
    postprocessed_at: str | None = None
    postprocess_retries: int = 0

    @property
    def postprocess_label_code(self) -> tuple[str, dict]:
        """整理状态显示名的 code 与参数：排了自动重试的说第几次，其余按状态取。"""
        if self.postprocess_state == POSTPROCESS_PENDING and self.next_check_at:
            return "labels.downloads.postprocessRetrying", {
                "retries": self.postprocess_retries, "limit": len(RETRY_DELAYS)}
        return f"download.postprocess.{self.postprocess_state}", {}

    @property
    def postprocess_label(self) -> str:
        code, params = self.postprocess_label_code
        return interface_text.label(f"server:{code}", self.postprocess_state, params)

    @property
    def location(self) -> str:
        """渠道关联的媒体来源。"""
        return self.provider.split(":", 2)[1] if self.provider.startswith("clouddrive:") else self.provider

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "DownloadTask":
        values = {name: row[name] for name in row.keys()}
        for name in _CODED_COLUMNS:
            values[name] = restored(values.get(name), values.pop(f"{name}_code", None),
                                    values.pop(f"{name}_params", None))
        return cls(**values)

    def payload(self, asset: dict | None = None) -> dict:
        from .catalog_rules import jav_fallback_title, release_code_from_filename, same_release_code
        from .media_sources import SOURCES

        kind = FAILURE_KINDS.get(self.failure or "")
        codes = {code for name in (self.remote_name, self.display_name, self.title)
                 if name and (code := release_code_from_filename(name))}
        display_code = self.code or (asset or {}).get("code") or (next(iter(codes)) if len(codes) == 1 else None)
        matched_asset = asset if asset and (not display_code or not asset.get("code")
                                            or same_release_code(display_code, asset["code"])) else {}
        display_title = next((str(matched_asset.get(field) or "").strip()
                              for field in ("catalog_title", "original_title")
                              if str(matched_asset.get(field) or "").strip()), "")
        if not display_title:
            display_title = (self.title or "").strip() if jav_fallback_title(self.title, display_code) else ""
        if not display_title:
            display_title = next((title for name in (self.display_name, self.remote_name)
                                  if (title := jav_fallback_title(name, display_code))), "")
        return {
            "id": self.id, "info_hash": self.info_hash, "provider": self.provider,
            "provider_label": SOURCES[self.location].name if self.location in SOURCES else self.provider,
            "source_uri": self.source_uri, "display_name": self.display_name,
            "target": self.target, "code": self.code, "title": self.title, "origin": self.origin,
            "display_code": display_code, "display_title": display_title,
            "state": self.state, "state_label": state_label(self.state),
            "failure": self.failure, "failure_label": kind.label if kind else None,
            **coded("failure_detail", self.failure_detail),
            "progress": self.progress, "remote_name": self.remote_name,
            "ledger_path": self.ledger_path, "asset_id": self.asset_id,
            "submitted_at": self.submitted_at, "updated_at": self.updated_at,
            "finished_at": self.finished_at, "blocked": bool(self.blocked_at),
            "postprocess_state": self.postprocess_state,
            "postprocess_label": self.postprocess_label,
            "postprocess_label_code": self.postprocess_label_code[0],
            "postprocess_label_params": self.postprocess_label_code[1],
            **coded("postprocess_detail", self.postprocess_detail),
            "postprocess_run_id": self.postprocess_run_id,
            "postprocessed_at": self.postprocessed_at,
            "postprocess_retries": self.postprocess_retries,
            "postprocess_retry_at": self.next_check_at if self.postprocess_state == POSTPROCESS_PENDING else None,
            "postprocess_active": self.postprocess_state in {
                POSTPROCESS_PENDING, POSTPROCESS_QUEUED, POSTPROCESS_RUNNING},
            "postprocess_retryable": self.state == INGESTED and self.postprocess_state == POSTPROCESS_FAILED,
            "cancellable": self.state in TRACKED_STATES,
            "resubmittable": self.state in RESUBMITTABLE_STATES and not self.blocked_at,
        }


_TASK_COLUMNS = (
    "info_hash", "provider", "source_uri", "display_name", "target", "state", "code", "title",
    "origin", "failure", "failure_detail", "remote_id", "remote_name", "progress",
    "ledger_path", "asset_id", "checks", "submitted_at", "remote_done_at", "updated_at",
    "finished_at", "next_check_at", "blocked_at",
    "postprocess_state", "postprocess_detail", "postprocess_run_id", "postprocessed_at",
    "postprocess_retries",
)
#: 只有一列原句的说明字段；旁边的 `<列>_code`、`<列>_params` 存 code 与参数（迁移 0056）。
_CODED_COLUMNS = ("failure_detail", "postprocess_detail")


def _task_values(task: "DownloadTask") -> tuple[tuple[str, ...], list]:
    """任务行要写的列与值：`_TASK_COLUMNS`，再加每个说明字段的 code 与参数两列。"""
    names = list(_TASK_COLUMNS)
    values = [getattr(task, name) for name in _TASK_COLUMNS]
    for name in _CODED_COLUMNS:
        names += [f"{name}_code", f"{name}_params"]
        values += columns(getattr(task, name))
    return tuple(names), values


class DownloadStore:
    """两张表的读写。任务表是运行状态，写入不清聚合缓存（`notify=False`）。"""

    def __init__(self, database: LedgerDatabase):
        self.database = database
        self._listeners: list = []

    def on_save(self, callback) -> None:
        """每次 `save` 写完后在写入线程里调用 `callback(task)`。

        同进程里关心任务状态的一方（浏览器入库）靠它知道状态变了，不必定时去扫。
        任务状态只经 `save` 改；后处理字段的写入不通知。
        """
        self._listeners.append(callback)

    def get(self, task_id: int) -> DownloadTask | None:
        with self.database.read_connection() as connection:
            row = connection.execute("SELECT * FROM download_task WHERE id=?", (task_id,)).fetchone()
        return DownloadTask.from_row(row) if row else None

    def by_hash(self, info_hash: str) -> DownloadTask | None:
        with self.database.read_connection() as connection:
            row = connection.execute(
                "SELECT * FROM download_task WHERE info_hash=?", (info_hash,)).fetchone()
        return DownloadTask.from_row(row) if row else None

    def active_by_code(self, code: str) -> DownloadTask | None:
        states = tuple(sorted(RESUBMITTABLE_STATES))
        marks = ",".join("?" for _ in states)
        with self.database.read_connection() as connection:
            row = connection.execute(
                "SELECT * FROM download_task WHERE normalise_code_key(code)=normalise_code_key(?) "
                f"AND state NOT IN ({marks}) AND blocked_at IS NULL ORDER BY id DESC LIMIT 1",
                (code, *states)).fetchone()
        return DownloadTask.from_row(row) if row else None

    def recent(self, limit: int = 100) -> list[DownloadTask]:
        with self.database.read_connection() as connection:
            rows = connection.execute(
                "SELECT * FROM download_task ORDER BY updated_at DESC, id DESC LIMIT ?",
                (max(1, min(int(limit), 500)),)).fetchall()
        return [DownloadTask.from_row(row) for row in rows]

    def count(self) -> int:
        with self.database.read_connection() as connection:
            return connection.execute("SELECT count(*) FROM download_task").fetchone()[0]

    def page(self, limit: int, before_id: int | None = None, *, offset: int = 0) -> list[DownloadTask]:
        """按提交顺序读取一页；状态更新时间不影响分页位置。"""
        where = " WHERE id<?" if before_id is not None else ""
        args = (before_id, limit) if before_id is not None else (limit,)
        with self.database.read_connection() as connection:
            rows = connection.execute(
                f"SELECT * FROM download_task{where} ORDER BY id DESC LIMIT ? OFFSET ?", (*args, offset)).fetchall()
        return [DownloadTask.from_row(row) for row in rows]

    def display_assets(self, tasks: list[DownloadTask]) -> dict[int, dict]:
        """一页任务已绑定作品的只读标题资料。"""
        ids = sorted({task.asset_id for task in tasks if task.asset_id is not None})
        if not ids:
            return {}
        with self.database.read_connection() as connection:
            rows = connection.execute(
                "SELECT id,code,catalog_title,original_title FROM asset "
                f"WHERE id IN ({','.join('?' for _ in ids)})", ids).fetchall()
        return {row["id"]: dict(row) for row in rows}

    def due(self, now: float) -> list[DownloadTask]:
        # 停滞的任务排了复查时间才算到期；时间为空表示已经不再复查。例外是停滞还没满复查期限、
        # 时间却为空的：那是有低频复查之前就判停滞的旧任务，当作到期，复查一次后照常排下一次。
        states = tuple(sorted(TRACKED_STATES))
        marks = ",".join("?" for _ in states)
        with self.database.read_connection() as connection:
            rows = connection.execute(
                f"SELECT * FROM download_task WHERE (state IN ({marks}) "
                "AND (next_check_at IS NULL OR next_check_at<=?)) "
                "OR (state=? AND next_check_at IS NOT NULL AND next_check_at<=?) "
                "OR (state=? AND next_check_at IS NULL AND finished_at>=?) "
                "OR (state=? AND postprocess_state=? AND next_check_at<=?) ORDER BY next_check_at, id",
                (*states, iso(now), STALLED, iso(now), STALLED, iso(_stall_cutoff(now)),
                 INGESTED, POSTPROCESS_PENDING, iso(now))).fetchall()
        return [DownloadTask.from_row(row) for row in rows]

    def next_due(self, now: float) -> float | None:
        states = tuple(sorted(TRACKED_STATES))
        marks = ",".join("?" for _ in states)
        with self.database.read_connection() as connection:
            row = connection.execute(
                f"SELECT min(coalesce(next_check_at,'')) FROM download_task WHERE state IN ({marks}) "
                "OR (state=? AND next_check_at IS NOT NULL) "
                "OR (state=? AND next_check_at IS NULL AND finished_at>=?) "
                "OR (state=? AND postprocess_state=? AND next_check_at IS NOT NULL)",
                (*states, STALLED, STALLED, iso(_stall_cutoff(now)), INGESTED, POSTPROCESS_PENDING)).fetchone()
        if row is None or row[0] is None:
            return None
        return parse_iso(row[0]) or 0.0

    def save(self, task: DownloadTask) -> DownloadTask:
        names, values = _task_values(task)
        with self.database.write_transaction(notify=False) as connection:
            if task.id:
                assignments = ",".join(f"{name}=?" for name in names)
                connection.execute(f"UPDATE download_task SET {assignments} WHERE id=?",
                                   (*values, task.id))
            else:
                marks = ",".join("?" for _ in names)
                cursor = connection.execute(
                    f"INSERT INTO download_task({','.join(names)}) VALUES({marks})", values)
                task.id = int(cursor.lastrowid)
        for listener in list(self._listeners):
            try:
                listener(task)
            except Exception:
                LOGGER.exception("download task listener failed: %s", task.id)
        return task

    def record_submission(self, *, task: DownloadTask, outcome: str, now: float,
                          failure: str | None = None, detail: str | None = None) -> None:
        with self.database.write_transaction(notify=False) as connection:
            connection.execute(
                "INSERT INTO download_submission(task_id,info_hash,provider,source_uri,target,code,"
                "origin,outcome,failure,detail,detail_code,detail_params,created_at) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (task.id or None, task.info_hash, task.provider, task.source_uri, task.target,
                 task.code, task.origin, outcome, failure, detail, *columns(detail), iso(now)))

    def submissions(self, task_id: int) -> list[dict]:
        with self.database.read_connection() as connection:
            rows = connection.execute(
                "SELECT outcome,failure,detail,detail_code,detail_params,provider,created_at "
                "FROM download_submission WHERE task_id=? ORDER BY id", (task_id,)).fetchall()
        return [{"outcome": row["outcome"], "failure": row["failure"],
                 **coded("detail", restored(row["detail"], row["detail_code"], row["detail_params"])),
                 "provider": row["provider"], "created_at": row["created_at"]} for row in rows]

    def assets_under(self, location: str, ledger_path: str) -> list[dict]:
        """账本里这条路径或目录下的全部活动资产；路径按 Windows 口径不区分。"""
        escaped = ledger_path.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        with self.database.read_connection() as connection:
            rows = connection.execute(
                "SELECT id,path,name,code,medium,size,duration,width,height FROM asset "
                "WHERE location=? AND disposal IS NULL "
                "AND (path=? COLLATE NOCASE OR path LIKE ? ESCAPE '\\') ORDER BY id",
                (location, ledger_path, escaped + "\\\\%")).fetchall()
        return [dict(row) for row in rows]

    def asset_under(self, location: str, ledger_path: str, code: str | None = None) -> int | None:
        """选择正片，而不是目录中最早登记的一条推广视频。"""
        from .catalog_rules import release_code_from_filename, same_release_code
        rows = [row for row in self.assets_under(location, ledger_path)
                if row.get("medium") == "video"]
        if not rows:
            return None
        def rank(row):
            shown = row.get("code") or release_code_from_filename(row.get("name") or "")
            exact = bool(code and shown and same_release_code(code, shown))
            promo = bool(re.search(rf"(?i)(?:{PROMO_NAME})",
                                   str(row.get("name") or "")))
            duration = float(row.get("duration") or 0)
            pixels = int(row.get("width") or 0) * int(row.get("height") or 0)
            return (exact, not promo, duration, pixels, int(row.get("size") or 0), -int(row["id"]))
        return int(max(rows, key=rank)["id"])

    def pending_postprocess(self, now: float | None = None) -> list[DownloadTask]:
        with self.database.read_connection() as connection:
            rows = connection.execute(
                "SELECT * FROM download_task WHERE state=? AND postprocess_state=? "
                "AND (next_check_at IS NULL OR next_check_at<=?) ORDER BY id",
                (INGESTED, POSTPROCESS_PENDING, iso(time.time() if now is None else now))).fetchall()
        return [DownloadTask.from_row(row) for row in rows]

    def postprocess(self, task_id: int, state: str, *, detail: str | None = None,
                    run_id: int | None = None, finished: str | None = None) -> None:
        assignments = ["postprocess_state=?", "postprocess_detail=?", "postprocess_detail_code=?",
                       "postprocess_detail_params=?", "next_check_at=NULL"]
        values: list[object] = [state, detail, *columns(detail)]
        if run_id is not None:
            assignments.append("postprocess_run_id=?")
            values.append(run_id)
        if finished is not None:
            assignments.append("postprocessed_at=?")
            values.append(finished)
        with self.database.write_transaction(notify=False) as connection:
            connection.execute(f"UPDATE download_task SET {','.join(assignments)} WHERE id=?",
                               (*values, int(task_id)))

    def fail_postprocess(self, task_id: int, error: Exception, *, now: float | None = None) -> bool:
        """在原任务上排下一次后处理；终止条件与错误都保留，不重交磁力。"""
        task = self.get(task_id)
        delay = retry_delay(error, task.postprocess_retries)
        detail = from_error(error, f'{type(error).__name__}: {error}')
        if delay is None:
            if task.postprocess_retries >= len(RETRY_DELAYS):
                detail = Said("labels.downloads.postprocessRetriesExhausted",
                              retries=task.postprocess_retries, detail=detail)
            self.postprocess(task_id, POSTPROCESS_FAILED, detail=detail)
            return False
        with self.database.write_transaction(notify=False) as connection:
            connection.execute(
                'UPDATE download_task SET postprocess_state=?,postprocess_detail=?,postprocess_detail_code=?,'
                'postprocess_detail_params=?,postprocess_retries=?,next_check_at=? WHERE id=?',
                (POSTPROCESS_PENDING, detail, *columns(detail), task.postprocess_retries + 1,
                 iso((time.time() if now is None else now) + delay), task_id))
        return True


# ---------------------------------------------------------------- 设置

SETTINGS_FILENAME = "downloads.json"
#: 凭据文件名：`<secrets>/follow/download-clouddrive2.json` 与 `download-pikpak.json`。
#: 不登记进 `CREDENTIAL_GUIDE`，所以既不出现在追更凭据页，也没有可同步字段。
CLOUDDRIVE_CREDENTIAL = "download-clouddrive2"
PIKPAK_CREDENTIAL = "download-pikpak"


def normalise_target(raw: str) -> str:
    """网盘里的目标目录统一成 `/a/b`。CloudDrive2 与 PikPak 都是 POSIX 口径。"""
    text = normalise_prefix(raw)
    if text == "/" or any(part in {".", ".."} for part in text.split("/")):
        raise UserValueError("errors.downloads.targetIsRoot")
    return text


@dataclass(frozen=True)
class DownloadConfig:
    clouddrive_address: str = ""
    targets: dict = field(default_factory=dict)
    #: PikPak 根目录对应的数据库路径前缀；115 使用推送发现中配置的云端路径前缀。
    pikpak_root: str = ""
    wait_hours: int = DEFAULT_WAIT_HOURS
    problems: tuple[str, ...] = ()

    def payload(self) -> dict:
        return {"clouddrive_address": self.clouddrive_address, "targets": dict(self.targets),
                "pikpak_root": self.pikpak_root, "wait_hours": self.wait_hours}


def clean_address(raw) -> str:
    text = str(raw or "").strip().rstrip("/")
    if not text:
        return ""
    if "://" not in text:
        text = "http://" + text
    message = "errors.downloads.addressFormat"
    if len(text) > 2048 or "\\" in text or any(char.isspace() or ord(char) < 32 for char in text):
        raise UserValueError(message)
    try:
        parts = urlsplit(text)
        port = parts.port
    except ValueError:
        raise UserValueError("errors.downloads.addressPortInvalidIpv6") from None
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.path not in {"", "/"} \
            or parts.query or parts.fragment or parts.username is not None or parts.password is not None:
        raise UserValueError(message)
    if port == 0 or parts.netloc.endswith(":"):
        raise UserValueError("errors.downloads.addressPortInvalid")
    return f"{parts.scheme}://{parts.netloc}"


class DownloadSettings:
    """地址、目标目录与等待上限的落点。本机偏好，不是账本真相，也不是凭据。"""

    def __init__(self, state_root: Path):
        self.path = Path(state_root) / SETTINGS_FILENAME

    def load(self) -> DownloadConfig:
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return DownloadConfig()
        except (OSError, ValueError):
            LOGGER.warning("Could not read cloud download settings, using defaults: %s", self.path)
            return DownloadConfig(problems=(Problem("labels.downloads.settingsUnreadable"),))
        if not isinstance(payload, dict):
            return DownloadConfig(problems=(Problem("labels.downloads.settingsMalformed"),))
        try:
            return self._parse(payload, declared_roots=None, saved=True)
        except ValueError:
            LOGGER.warning("Cloud download settings contain invalid values, using defaults: %s", self.path)
            return DownloadConfig(problems=(Problem("labels.downloads.settingsInvalid"),))

    def _parse(self, body: dict, *, declared_roots, saved: bool = False) -> DownloadConfig:
        from .media_sources import SOURCE_REGISTRY
        targets = {}
        raw_targets = body.get("targets") if isinstance(body.get("targets"), dict) else {}
        for key in (source.id for source in SOURCE_REGISTRY if source.cloud):
            value = str(raw_targets.get(key) or "").strip()
            if value:
                targets[key] = normalise_target(value)
        root = str(body.get("pikpak_root") or "").strip()
        if root and declared_roots is not None:
            known = {str(item).casefold(): str(item) for item in declared_roots.get("pikpak", ())}
            if root.casefold() not in known:
                if not known:
                    raise UserValueError("errors.downloads.notPikpakRootNoneDeclared", {"root": root})
                raise UserValueError("errors.downloads.notPikpakRoot",
                                     {"root": root, "known": list(known.values())})
            root = known[root.casefold()]
        try:
            hours = int(body.get("wait_hours") or DEFAULT_WAIT_HOURS)
        except (TypeError, ValueError) as error:
            raise UserValueError("errors.downloads.waitHoursNotNumber") from error
        if not 1 <= hours <= MAX_WAIT_HOURS:
            raise UserValueError("errors.downloads.waitHoursOutOfRange", {"max": MAX_WAIT_HOURS})
        problems = ()
        try:
            address = clean_address(body.get("clouddrive_address"))
        except ValueError as error:
            if not saved:
                raise
            address = str(body.get("clouddrive_address") or "").strip()
            problems = (Problem.of(error) if isinstance(error, UserFacingError) else str(error),)
        return DownloadConfig(address, targets, root, hours, problems)

    def save(self, body: dict, declared_roots) -> DownloadConfig:
        if not isinstance(body, dict):
            raise ValueError("settings must be an object")
        config = self._parse(body, declared_roots=declared_roots)
        atomic_write_text(self.path, json.dumps(config.payload(), ensure_ascii=False, indent=2) + "\n")
        return config


# ---------------------------------------------------------------- 服务


@dataclass(frozen=True)
class SubmitResult:
    outcome: str
    task: DownloadTask

    def payload(self) -> dict:
        return {"ok": True, "outcome": self.outcome, "task": self.task.payload()}


#: 提交结果的几种说法。`adopted` 是本机已有同一 infohash 的任务；`adopted_remote` 是远端
#: 目录里已有同一个离线任务，接过来跟踪、没有调提交接口，也就没有扣配额。
SUBMIT_OUTCOMES = ("submitted", "adopted", "adopted_remote", "deferred", "refused", "failed")


class DownloadService:
    """提交、取消、列表与后台对账。

    `providers` 按 provider 键现取客户端：凭据和地址随时会在设置页里改，不在启动时固化。
    `landing` 提供推送发现那一侧：云端路径前缀、定向登记与本机路径换算。
    """

    def __init__(
        self, *, database: LedgerDatabase, state_root: Path, credentials: CredentialStore,
        providers: Callable[[str], OfflineProvider], landing: "Landing",
        available: bool = True, clock: Callable[[], float] = time.time,
        after_ingest: Callable[[DownloadTask], None] | None = None,
        channel_catalog: Callable[[], dict] | None = None,
    ):
        self.store = DownloadStore(database)
        self.settings = DownloadSettings(state_root)
        self.credentials = credentials
        self.providers = providers
        self.landing = landing
        self.available = bool(available)
        self.clock = clock
        self.after_ingest = after_ingest
        self.channel_catalog = channel_catalog
        self.config = self.settings.load()
        #: 按 provider 记最近一次渠道级失败（`CHANNEL_FAILURES`），这个渠道下一次提交成功时撤掉。
        #: 只放在内存里：重启后第一次提交自然会再试一次。
        self._channel_alerts: dict[str, dict] = {}
        self._submit_lock = threading.Lock()
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # -- 提交

    def submit(self, *, source: str, provider: str, target: str | None = None,
               code: str | None = None, title: str | None = None,
               origin: str | None = None, dedupe_code: bool = False) -> SubmitResult:
        if not self.available:
            raise UserValueError("errors.downloads.writerOnly")
        magnet = parse_magnet(source)
        channels = self.channel_snapshot()["providers"]
        channel = next((row for row in channels if row["key"] == provider), None)
        if channel is None or (self.channel_catalog is not None and not channel["configured"]):
            raise UserValueError("errors.downloads.channelUnavailable")
        folder = normalise_target(target or channel["target"])
        if provider.startswith("clouddrive:") and not (
                folder == channel["target"] or folder.startswith(channel["target"].rstrip("/") + "/")):
            raise UserValueError("errors.downloads.targetOutsideLibrary")
        with self._submit_lock:
            now = self.clock()
            if dedupe_code and code and (existing := self.store.active_by_code(code)) is not None:
                self.store.record_submission(task=existing, outcome="adopted", now=now)
                return SubmitResult("adopted", existing)
            task = self.store.by_hash(magnet.info_hash)
            if task is not None and task.blocked_at:
                self.store.record_submission(task=task, outcome="refused", now=now,
                                             failure="rejected", detail=task.failure_detail)
                return SubmitResult("refused", task)
            if task is not None and task.state not in RESUBMITTABLE_STATES:
                self.store.record_submission(task=task, outcome="adopted", now=now)
                return SubmitResult("adopted", task)
            task = self._fresh(task, magnet, provider, folder, code, title, origin, now)
            try:
                status = self.providers(provider).submit(magnet, folder)
            except DownloadError as error:
                self.note_channel(provider, error, now)
                if not error.retryable:
                    self._fail(task, error, now)
                    self.store.record_submission(task=task, outcome="failed", now=now,
                                                 failure=error.failure, detail=error.detail)
                    return SubmitResult("failed", task)
                task.state = SUBMIT_PENDING
                self._reschedule(task, now, error.detail)
                outcome = "deferred"
                self.store.record_submission(task=task, outcome=outcome, now=now,
                                             failure=error.failure, detail=error.detail)
            else:
                self.note_channel(provider, None, now)
                self._accepted(task, status, now)
                outcome = "adopted_remote" if status.adopted else "submitted"
                self.store.record_submission(task=task, outcome=outcome, now=now)
        self._wake.set()
        return SubmitResult(outcome, task)

    def _accepted(self, task: DownloadTask, status: RemoteStatus, now: float) -> None:
        task.remote_id = status.remote_id or task.remote_id
        task.remote_name = status.name or task.remote_name
        task.state = SUBMITTED
        task.checks = 0
        task.failure_detail = None
        task.next_check_at = iso(now + POLL_DELAYS[0])
        self.store.save(task)

    def _retry_submit(self, task: DownloadTask, now: float) -> None:
        """再交一次提交时网盘没应答的磁力。远端收下后从这一刻起按新提交对账。"""
        with self._submit_lock:
            latest = self.store.get(task.id)
            if latest is None or latest.state != SUBMIT_PENDING:
                return  # 到期之后、拿到提交锁之前被取消或重新提交了。
            task = latest
            try:
                status = self.providers(task.provider).submit(parse_magnet(task.source_uri), task.target)
            except DownloadError as error:
                self.note_channel(task.provider, error, now)
                started = parse_iso(task.submitted_at) or now
                if error.retryable and now - started < SUBMIT_RETRY_WINDOW:
                    self._reschedule(task, now, error.detail)
                    return
                if error.retryable:
                    error = DownloadError(error.failure, "errors.downloads.retriesExhausted",
                                          {"detail": nested_message(error), "checks": task.checks})
                self._fail(task, error, now)
                self.store.record_submission(task=task, outcome="failed", now=now,
                                             failure=error.failure, detail=error.detail)
                return
            latest = self.store.get(task.id)
            if latest is None or latest.state != SUBMIT_PENDING:
                return  # 再交的这段时间里任务被取消了。
            task.submitted_at = iso(now)
            self.note_channel(task.provider, None, now)
            self._accepted(task, status, now)
            self.store.record_submission(task=task, outcome="adopted_remote" if status.adopted else "submitted",
                                         now=now)

    def _fresh(self, task, magnet: Magnet, provider, folder, code, title, origin, now) -> DownloadTask:
        """新任务，或把失败／取消／停滞的那一行重置成一次新的提交。"""
        fresh = DownloadTask(
            id=task.id if task else 0, info_hash=magnet.info_hash, provider=provider,
            source_uri=magnet.uri, display_name=magnet.name or (task.display_name if task else ""),
            target=folder, state=SUBMITTED,
            code=_short(code) or (task.code if task else None),
            title=_short(title) or (task.title if task else None),
            origin=_short(origin) or (task.origin if task else None),
            submitted_at=iso(now), updated_at=iso(now), next_check_at=iso(now + SUBMIT_IN_FLIGHT))
        return self.store.save(fresh)

    def _fail(self, task: DownloadTask, error: DownloadError, now: float, *, state: str = FAILED) -> None:
        task.state = state
        task.failure = error.failure
        task.failure_detail = error.detail
        task.finished_at = iso(now)
        task.updated_at = iso(now)
        task.next_check_at = iso(now + STALL_RECHECK) if state == STALLED else None
        if error.block:
            task.blocked_at = iso(now)
        self.store.save(task)

    # -- 取消与列表

    def cancel(self, task_id: int) -> DownloadTask:
        if not self.available:
            raise UserValueError("errors.downloads.writerOnly")
        task = self.store.get(int(task_id))
        if task is None:
            raise UserValueError("errors.downloads.taskNotFound")
        if task.state not in TRACKED_STATES:
            raise UserValueError("errors.downloads.taskFinished")
        if task.state in {SUBMITTED, REMOTE_RUNNING}:
            try:
                self.providers(task.provider).cancel(task)
            except DownloadError as error:
                raise UserValueError("errors.downloads.cancelFailed", {"detail": nested_message(error)}) from error
        now = self.clock()
        task.state = CANCELLED
        task.finished_at = iso(now)
        task.updated_at = iso(now)
        task.next_check_at = None
        self.store.save(task)
        return task

    def snapshot(self, limit: int = 100, *, before_id: int | None = None, page: int = 1) -> dict:
        limit = max(1, min(int(limit), 500))
        total = self.store.count()
        page = min(page, max(1, (total + limit - 1) // limit))
        rows = self.store.page(limit + 1, before_id, offset=(page - 1) * limit)
        tasks = rows[:limit]
        has_more = len(rows) > limit
        assets = self.store.display_assets(tasks)
        catalog = self.channel_snapshot()
        labels = {row["key"]: row["label"] for row in catalog["providers"]}
        uncancellable = {row["key"] for row in catalog["providers"] if row.get("can_cancel") is False}
        payloads = [task.payload(assets.get(task.asset_id)) for task in tasks]
        for payload in payloads:
            payload["provider_label"] = labels.get(payload["provider"], payload["provider_label"])
            if payload["provider"] in uncancellable and payload["state"] in {SUBMITTED, REMOTE_RUNNING}:
                payload["cancellable"] = False
        return {
            "available": self.available,
            **catalog,
            "tasks": payloads,
            "has_more": has_more,
            "total": total,
            "page": page,
            "next_before_id": tasks[-1].id if has_more else None,
            "channel_alerts": [{**alert, "provider_label": labels.get(alert["provider"], alert["provider"])}
                               for alert in self.channel_alerts()],
        }

    def note_channel(self, provider: str, error: DownloadError | None, now: float) -> None:
        """按一次提交的结果更新渠道告警：渠道级失败记下，提交成功撤掉，其他失败不动。"""
        if error is None:
            self._channel_alerts.pop(provider, None)
        elif error.channel_wide:
            self._channel_alerts[provider] = {
                "provider": provider, "failure": "network" if error.channel_down else error.failure,
                "message": error.detail, "message_code": error.code, "message_params": dict(error.params),
                "since": iso(now)}

    def channel_alert(self, provider: str) -> dict | None:
        """这个渠道最近一次渠道级失败；之后成功提交过就是 None。"""
        alert = self._channel_alerts.get(provider)
        return dict(alert) if alert else None

    def channel_alerts(self) -> list[dict]:
        return [dict(alert) for alert in list(self._channel_alerts.values())]

    def channel_snapshot(self) -> dict:
        if self.channel_catalog is not None:
            return self.channel_catalog()
        return {"providers": [self._provider_state(key) for key in PROVIDER_LABELS], "problems": []}

    def retry_postprocess(self, task_id: int) -> DownloadTask:
        task = self.store.get(int(task_id))
        if task is None:
            raise UserValueError("errors.downloads.taskNotFound")
        if task.state != INGESTED or task.postprocess_state != POSTPROCESS_FAILED:
            raise UserValueError("errors.downloads.nothingToRetry")
        task.postprocess_retries = 0
        self.store.save(task)
        self.store.postprocess(task.id, POSTPROCESS_PENDING,
                               detail=Said("labels.downloads.postprocessRequeued"))
        task = self.store.get(task.id)
        self._dispatch_postprocess(task)
        return self.store.get(task.id)

    def _provider_state(self, key: str) -> dict:
        credential = CLOUDDRIVE_CREDENTIAL if key == "115" else PIKPAK_CREDENTIAL
        needed = "token" if key == "115" else "refresh_token"
        described = self.credentials.describe(credential)
        configured = needed in described["fields"] and (key != "115" or bool(self.config.clouddrive_address))
        return {"key": key, "label": PROVIDER_LABELS[key], "configured": configured,
                "target": self.config.targets.get(key, "")}

    # -- 对账

    def start(self) -> None:
        if not self.available or self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=in_background(self._loop), name="PeachDownloads", daemon=True)
        self._thread.start()
        if self.after_ingest is not None:
            try:
                pending = self.store.pending_postprocess(self.clock())
            except sqlite3.Error:
                # 未配置实例的 lifespan 也会装配服务；账本尚不存在时没有待恢复任务。
                pending = []
            for task in pending:
                self._dispatch_postprocess(task)

    def stop(self) -> None:
        thread, self._thread = self._thread, None
        self._stop.set()
        self._wake.set()
        if thread is not None:
            thread.join(timeout=5)

    def wake(self) -> None:
        self._wake.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._wake.clear()
            try:
                self.poll_once()
                upcoming = self.store.next_due(self.clock())
            except Exception:
                # 一轮里出什么错都不能让线程退出：退出之后所有任务都不再推进，界面上只是不动。
                LOGGER.exception("Cloud download reconciliation failed")
                upcoming = self.clock() + POLL_DELAYS[2]
            delay = POLL_DELAYS[-1] if upcoming is None else upcoming - self.clock()
            self._wake.wait(timeout=min(max(delay, 1.0), POLL_DELAYS[-1]))

    def poll_once(self) -> int:
        """推进所有到期的任务，返回推进了几条。测试直接调它。"""
        due = self.store.due(self.clock())
        for task in due:
            try:
                self.advance(task)
            except Exception:
                LOGGER.exception("Reconciliation failed for cloud download task %s", task.id)
                self._reschedule(task, self.clock(),
                                 Said("labels.downloads.reconcileUnexpected"))
        return len(due)

    def advance(self, task: DownloadTask) -> None:
        now = self.clock()
        if task.state == INGESTED and task.postprocess_state == POSTPROCESS_PENDING:
            self._dispatch_postprocess(task)
            return
        if task.state == STALLED:
            self._recheck_stalled(task, now)
            return
        if task.state == SUBMIT_PENDING:
            self._retry_submit(task, now)
            return
        try:
            if task.state in {SUBMITTED, REMOTE_RUNNING}:
                self._follow_remote(task, now)
            else:
                self._settle_landing(task, now)
        except DownloadError as error:
            if error.retryable:
                self._reschedule(task, now, error.detail)
            else:
                self._fail(task, error, now)
            return
        if task.state in {SUBMITTED, REMOTE_RUNNING} and self._overdue(task, now):
            self._fail(task, DownloadError(
                "no_source", "errors.downloads.noSeeders", {"hours": self.config.wait_hours}),
                now, state=STALLED)

    def _recheck_stalled(self, task: DownloadTask, now: float) -> None:
        """停滞任务的低频复查：远端完成就回到落地流程，否则排下一次，超出期限就不再查。

        这里不改失败原因与「长时间未完成」的状态：远端仍在跑、出错或不见了，都只是这次没等到。
        """
        try:
            provider = self.providers(task.provider)
            status = provider.status(task)
            done = status.state == DONE or (status.state == MISSING and provider.landed(task))
        except DownloadError:
            done = False
        if done:
            task.finished_at = None
            task.failure = None
            self._remote_done(task, status, now)
            return
        stalled = parse_iso(task.finished_at) or now
        task.next_check_at = (iso(now + STALL_RECHECK)
                              if now + STALL_RECHECK - stalled <= STALL_RECHECK_HORIZON else None)
        task.updated_at = iso(now)
        self.store.save(task)

    def _overdue(self, task: DownloadTask, now: float) -> bool:
        started = parse_iso(task.submitted_at) or now
        return now - started > self.config.wait_hours * 3600.0

    def _reschedule(self, task: DownloadTask, now: float, detail: str | None = None) -> None:
        """隔一段再查。`detail` 是这一次暂时性故障的原因；没带就是这一次查通了，旧原因作废。"""
        task.checks += 1
        task.updated_at = iso(now)
        task.next_check_at = iso(now + poll_delay(task.checks))
        task.failure_detail = detail
        self.store.save(task)

    def _follow_remote(self, task: DownloadTask, now: float) -> None:
        provider = self.providers(task.provider)
        status = provider.status(task)
        if status.state == RUNNING:
            task.state = REMOTE_RUNNING
            task.progress = status.progress
            task.remote_id = status.remote_id or task.remote_id
            task.remote_name = status.name or task.remote_name
            task.failure_detail = None
            self._reschedule(task, now)
            return
        if status.state == ERROR:
            raise status.failure()
        if status.state == MISSING:
            if not provider.landed(task):
                started = parse_iso(task.submitted_at) or now
                # 磁力本身失败时 115 会把任务留在列表里标为离线失败；从没出现过说明网盘没有收下，
                # 出现过又不见了说明任务在网盘一侧被删除或清理，两种都不是换磁力能解决的。
                unseen = never_seen(task)
                if now - started < (UNSEEN_GRACE if unseen else MISSING_GRACE):
                    self._reschedule(task, now)
                    return
                if unseen:
                    raise DownloadError("not_accepted", "errors.downloads.notAccepted")
                raise DownloadError("removed", "errors.downloads.remoteRemoved")
        self._remote_done(task, status, now)

    def _remote_done(self, task: DownloadTask, status, now: float) -> None:
        task.remote_name = status.name or task.remote_name
        task.remote_id = status.remote_id or task.remote_id
        task.state = REMOTE_DONE
        task.progress = 1.0
        task.remote_done_at = iso(now)
        task.failure_detail = None
        task.updated_at = iso(now)
        # 先给推送发现一段时间：CloudDrive2 的通知通常几秒内就把文件登记好了。
        task.next_check_at = iso(now + LANDING_GRACE)
        self.store.save(task)

    def _settle_landing(self, task: DownloadTask, now: float) -> None:
        mapped = self.landing.ledger_path(task, self.config)
        if mapped is None:
            raise DownloadError("not_landed", "errors.downloads.targetNotMapped")
        location, ledger_path = mapped
        task.ledger_path = ledger_path
        asset_id = self.store.asset_under(location, ledger_path, task.code)
        if asset_id is None and self.landing.ingest(location, ledger_path):
            task.state = LANDED
            asset_id = self.store.asset_under(location, ledger_path, task.code)
        if asset_id is None and self.providers(task.provider).landed(task):
            if self.landing.ingest(location, ledger_path):
                task.state = LANDED
                asset_id = self.store.asset_under(location, ledger_path, task.code)
        if asset_id is not None:
            task.state = INGESTED
            task.asset_id = asset_id
            task.finished_at = iso(now)
            task.updated_at = iso(now)
            task.next_check_at = None
            task.failure = task.failure_detail = None
            task.postprocess_state = POSTPROCESS_PENDING
            task.postprocess_detail = None
            task.postprocess_run_id = None
            task.postprocessed_at = None
            self.store.save(task)
            self._dispatch_postprocess(task)
            return
        done = parse_iso(task.remote_done_at) or now
        if now - done > LANDING_TIMEOUT:
            raise DownloadError("not_landed", "errors.downloads.notLanded", {"path": ledger_path})
        task.updated_at = iso(now)
        task.next_check_at = iso(now + LANDING_GRACE)
        self.store.save(task)

    def _dispatch_postprocess(self, task: DownloadTask) -> None:
        if self.after_ingest is None:
            return
        try:
            self.after_ingest(task)
        except Exception as error:
            LOGGER.exception("Failed to queue post-processing for cloud download task %s", task.id)
            if self.store.fail_postprocess(task.id, error, now=self.clock()):
                self.wake()

    # -- 设置

    def save_settings(self, body: dict, declared_roots) -> DownloadConfig:
        self.config = self.settings.save(body, declared_roots)
        return self.config


def _short(value) -> str | None:
    text = str(value or "").strip()
    return text[:300] or None


# ---------------------------------------------------------------- 落地


class Landing:
    """远端完成之后的那一段：网盘路径换成账本路径，账本里没有就定向登记一次。

    115 的网盘路径是 CloudDrive2 挂载树里的路径，换算用推送发现已经配好的云端路径前缀，
    不另存一张表。PikPak 直连取得网盘内部路径，再与设置中选定的数据库路径前缀拼接。
    """

    def __init__(self, push_discovery, *, mounts=None, declared_roots=None):
        self.push_discovery = push_discovery
        self.channel_catalog = None
        self.mounts = mounts if mounts is not None else getattr(push_discovery, "mounts", {})
        self.declared_roots = (declared_roots if declared_roots is not None
                               else getattr(push_discovery, "declared_roots", {}))

    def remote_path(self, task: DownloadTask) -> str:
        name = (task.remote_name or task.display_name or "").strip().strip("/")
        if not name:
            return ""
        return f"{task.target.rstrip('/')}/{name}"

    def ledger_path(self, task: DownloadTask, config: DownloadConfig) -> tuple[str, str] | None:
        remote = self.remote_path(task)
        if not remote:
            return None
        if task.provider == "pikpak":
            if not config.pikpak_root:
                return None
            prefixes = (CloudPrefix("/pikpak", config.pikpak_root),)
            remote = "/pikpak" + remote
        else:
            prefixes = tuple(self.push_discovery.config.prefixes)
            if self.channel_catalog:
                channel = next((row for row in self.channel_catalog()["providers"] if row["key"] == task.provider), None)
                if channel and channel.get("cloud_root"):
                    prefixes = (CloudPrefix(channel["cloud_root"], channel["root"]),)
        try:
            path = map_cloud_path(remote, prefixes)
        except CloudPathError:
            return None
        from .platform import resolve_location
        location = resolve_location(path, self.declared_roots)[0]
        return (location, path) if location else None

    def ingest(self, location: str, ledger_path: str) -> bool:
        """定向登记。目录就逐个登记里面的文件；什么也没找到返回假。"""
        from .discovery_rules import system_directory, system_path
        from .push_discovery import ignored
        from .scan import ScanRootUnreadable, _relative_directory, _walk, walk_root_for
        if system_path(ledger_path):
            return False
        parent = str(PureWindowsPath(ledger_path).parent)
        try:
            local_parent = walk_root_for(location, parent, declared_roots=self.declared_roots,
                                         mounts=self.mounts)
        except ValueError:
            return False
        local = local_parent / PureWindowsPath(ledger_path).name
        # 判类型与列目录都交给可终止的读取子进程：对账线程不能卡在挂死的网盘挂载上，读超时按没找到算。
        from . import media_io
        try:
            mode = media_io.file_stat(local).st_mode
            if stat.S_ISREG(mode):
                return self.push_discovery.ingest_now(location, ledger_path)
            if not stat.S_ISDIR(mode) or system_directory(local.name):
                return False
            found = False
            count = 0
            for directory, entries in _walk(local, read_directory=media_io.directory_entries):
                for item in entries:
                    relative = (*_relative_directory(directory, local), item.name)
                    path = str(PureWindowsPath(ledger_path).joinpath(*relative))
                    if ignored(path):
                        continue
                    if count >= MAX_LANDED_FILES:
                        return found
                    found = self.push_discovery.ingest_now(location, path) or found
                    count += 1
            return found
        except (OSError, ScanRootUnreadable):
            return False


# ---------------------------------------------------------------- 入口


def submit_offline_download(
    service: DownloadService, *, magnet: str, provider: str, target: str | None = None,
    code: str | None = None, title: str | None = None, origin: str | None = None,
    dedupe_code: bool = False,
) -> dict:
    """把一个磁力交给云下载，各入口共用这条提交路径。

    `origin` 说这次提交从哪儿来，例如 `paste`、`asset:12`、`follow:34`、`wishlist:56`。
    同一 infohash 已有任务就接管，返回的 `outcome` 是 `adopted`，不会重复提交。
    浏览器添加启用 `dedupe_code`，在提交锁内接管同番号的进行中或已入库任务。
    """
    return service.submit(source=magnet, provider=provider, target=target, code=code,
                          title=title, origin=origin, dedupe_code=dedupe_code).payload()
