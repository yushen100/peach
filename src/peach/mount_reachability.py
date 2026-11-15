"""媒体挂载的周期快照；目录调用在有界的后台线程中执行。

节律和在途去重参考 OpenAver 8cc17e5 的 source_reachability（MIT，见 REUSE）。
目录语义使用 platform.root_status；快照不替代播放与扫描的即时访问检查。
"""
from __future__ import annotations

import threading
import time
from concurrent.futures import Future
from dataclasses import dataclass
from pathlib import Path

from . import interface_text
from .platform import root_status

HEALTHY_INTERVAL = 600.0
DEGRADED_INTERVAL = 60.0
PROBE_TIMEOUT = 5.0
MAX_PENDING = 4
#: 各状态给人看的说明（ADR-0159）；文字在语言资源里。
MESSAGE_CODES = {
    "ok": "labels.mountReachability.ok", "permission_denied": "labels.mountReachability.permission_denied",
    "missing": "labels.mountReachability.missing", "not_directory": "labels.mountReachability.not_directory",
    "unavailable": "labels.mountReachability.unavailable", "unmapped": "labels.mountReachability.unmapped",
    "checking": "labels.mountReachability.checking", "timeout": "labels.mountReachability.timeout",
}
SOURCE_MESSAGE_CODE = "labels.mountReachability.sourceState"


def _text(code, params=None):
    return interface_text.text(f"server:{code}", params)
FAILURES = frozenset({"permission_denied", "missing", "not_directory", "unavailable", "unmapped"})


@dataclass(frozen=True)
class MountRoot:
    location: str
    label: str
    declared: str
    path: Path | None
    root_id: str = ""
    library_id: str = ""


def source_roots() -> list[MountRoot]:
    """沿用数据库路径前缀与平台路径转换；构造检查对象时不访问挂载目录。"""
    from .config import LOCATION_ROOT_DECLARATIONS
    from .media_configuration import SOURCE_OPTIONS
    from .platform import is_unmapped, translate_ledger_path
    from . import media_identity, settings_file

    labels = dict(SOURCE_OPTIONS)
    roots = []
    for location, declared_roots in LOCATION_ROOT_DECLARATIONS.items():
        for declared in declared_roots:
            from .smb_media import resolve
            resolved = resolve(declared) or translate_ledger_path(declared)
            roots.append(MountRoot(location, labels.get(location, location), declared,
                                   None if is_unmapped(resolved) else resolved,
                                   **media_identity.ownership(settings_file.active(), declared)))
    return roots


@dataclass
class _Probe:
    state: str = "checking"
    checked_at: float | None = None
    due: float = float("-inf")
    started: float = 0.0
    pending: Future | None = None


class MountReachability:
    """正常十分钟、异常一分钟；一次否定结果隔一秒复查后才确认故障。"""

    def __init__(self, roots, *, probe=root_status, clock=time.monotonic,
                 wall_clock=time.time, retry_delay=1.0, timeout=PROBE_TIMEOUT):
        self.roots = tuple(roots)
        self.probe, self.clock, self.wall_clock = probe, clock, wall_clock
        self.retry_delay, self.timeout = retry_delay, timeout
        self._states = {root.path: _Probe() for root in self.roots if root.path is not None}
        self._lock = threading.RLock()
        self._stop = threading.Event()
        #: 探测完成或停止时叫醒调度线程；其余时间睡到最近的到期点或超时点。
        self._wake = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        with self._lock:
            if self._thread is not None or self._stop.is_set():
                return
            self._thread = threading.Thread(target=self._loop, name="PeachMountStatus", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=2)

    def _loop(self) -> None:
        while not self._stop.is_set():
            # 先清再算：计算期间完成的探测会让下面的等待立即返回。
            self._wake.clear()
            self._wake.wait(self.tick())

    def _read(self, path: Path, future: Future) -> None:
        try:
            state = self.probe(path)
            if state != "ok" and not self._stop.wait(self.retry_delay):
                state = self.probe(path)
            if state not in FAILURES and state != "ok":
                state = "unavailable"
            future.set_result(state)
        except Exception:
            # 未知异常不能直接作为两次文件系统失败的证据。
            future.set_result("checking")

    def tick(self) -> float | None:
        """收集完成的结果并启动到期探测；文件系统操作始终不占此线程。

        返回距最近到期点或超时点的秒数；没有可等的时间点时返回 None，等探测完成叫醒。
        """
        with self._lock:
            if self._stop.is_set():
                return None
            now = self.clock()
            for entry in self._states.values():
                if entry.pending is None:
                    continue
                if entry.pending.done():
                    entry.state = entry.pending.result()
                    entry.checked_at = self.wall_clock()
                    entry.pending = None
                    interval = HEALTHY_INTERVAL if entry.state == "ok" else DEGRADED_INTERVAL
                    entry.due = now + interval
                elif now - entry.started >= self.timeout:
                    # 保留 future；底层 scandir 未返回时绝不开第二个同路径探测。
                    entry.state = "timeout"
            slots = MAX_PENDING - sum(entry.pending is not None for entry in self._states.values())
            for path, entry in self._states.items():
                if slots <= 0:
                    break
                if entry.pending is not None or now < entry.due:
                    continue
                future = Future()
                future.add_done_callback(lambda _future: self._wake.set())
                entry.pending, entry.started = future, now
                worker = threading.Thread(target=self._read, args=(path, future),
                                          name="PeachMountProbe", daemon=True)
                try:
                    worker.start()
                except RuntimeError:
                    entry.pending = None
                    entry.state = "checking"
                    entry.due = now + DEGRADED_INTERVAL
                slots -= 1
            wake = None
            for entry in self._states.values():
                if entry.pending is not None:
                    # 已超时的探测只等它完成时的回调。
                    moment = entry.started + self.timeout if entry.state != "timeout" else None
                else:
                    # 名额占满时，到期的根要等某个探测完成腾出名额，同样由回调叫醒。
                    moment = entry.due if slots > 0 else None
                if moment is not None and (wake is None or moment < wake):
                    wake = moment
            return None if wake is None else max(0.0, wake - now)

    def sources(self) -> list[dict]:
        """纯内存读取；来源接口保留数据库路径前缀，公开健康摘要不携带路径。"""
        grouped: dict[str, dict] = {}
        with self._lock:
            for root in self.roots:
                entry = self._states.get(root.path)
                state = entry.state if entry is not None else "unmapped"
                online = True if state == "ok" else False if state in FAILURES else None
                row = grouped.setdefault(root.location, {
                    "location": root.location, "label": root.label, "roots": [],
                })
                row["roots"].append({
                    "root_id": root.root_id, "library_id": root.library_id,
                    "declared": root.declared,
                    "resolved": str(root.path) if root.path is not None else None,
                    "mapped": root.path is not None, "online": online, "state": state,
                    "message": _text(MESSAGE_CODES[state]), "message_code": MESSAGE_CODES[state],
                    "checked_at": entry.checked_at if entry else None,
                })
        for row in grouped.values():
            roots = row["roots"]
            failed = next((root for root in roots if root["online"] is False), None)
            unknown = next((root for root in roots if root["online"] is None), None)
            status = failed or unknown
            # 来源名是用户起的，原样作参数；状态说明嵌成另一句，按同一语言渲染。
            params = {"label": row["label"], "state": {"code": status["message_code"]}} if status else {}
            row.update(mapped=all(root["mapped"] for root in roots),
                       online=True if any(root["online"] is True for root in roots) else None if unknown else False,
                       state=status["state"] if status else "ok",
                       message=_text(SOURCE_MESSAGE_CODE, params) if status else "",
                       message_code=SOURCE_MESSAGE_CODE if status else None, message_params=params,
                       checked_at=min((root["checked_at"] for root in roots
                                       if root["checked_at"] is not None), default=None))
        return list(grouped.values())

    def summary(self) -> dict:
        rows = [{key: row[key] for key in ("location", "label", "online", "state", "message", "message_code",
                                           "message_params", "checked_at")}
                for row in self.sources()]
        failed = [row for row in rows if row["state"] in FAILURES]
        return {"state": "degraded" if failed else "checking" if any(
            row["online"] is None for row in rows) else "ok", "sources": rows,
            "warnings": [row["message"] for row in failed],
            "warning_codes": [{"code": row["message_code"], "params": row["message_params"]} for row in failed]}
