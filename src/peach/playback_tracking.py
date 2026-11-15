"""本机外部播放器的观看进度回传。

mpv 与 IINA 走 mpv 的 JSON IPC，VLC 走它自带的 Lua HTTP 接口；每秒问一次位置、时长与暂停
状态，按网页播放器同一口径累计观看时长与拖动次数，周期性地并在播放器退出后写进账本。
连不上、读不到或播放器中途崩溃时只是不记，不打扰用户。
"""
from __future__ import annotations

import base64
import http.client
import json
import logging
import os
import queue
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Callable, Protocol

LOGGER = logging.getLogger(__name__)

POLL_SECONDS = 1.0
FLUSH_SECONDS = 30.0
CONNECT_SECONDS = 15.0
REQUEST_SECONDS = 2.0
MAX_SESSION_SECONDS = 12 * 3600
MAX_TRACKERS = 4
# 一次轮询间位置前进超过这么多秒就不算连续观看，而是一次拖动（倍速播放留了余量）。
MAX_STEP_SECONDS = 4.0 * POLL_SECONDS
# 播放器停下时离片尾不到这么多秒就当作放完：mpv 放完即退，VLC 放完回到 0，最后一次轮询
# 未必恰好落在末尾。
END_SLACK_SECONDS = 3.0 * POLL_SECONDS

Report = Callable[[dict, bool], None]
# 播放器不见了、回了坏数据：结束本次跟踪，已看的照常落库。
FAILURES = (OSError, EOFError, ValueError, http.client.HTTPException)


@dataclass
class Snapshot:
    position: float | None
    duration: float | None
    paused: bool
    eof: bool = False
    # 播放器还开着、但已不在放这个文件（VLC 换了片、mpv 进了空闲）。
    finished: bool = False


class Probe(Protocol):
    # 播放器自己报过「放完了」；mpv 放完即退，这条事件常常是断开前的最后一句。
    eof: bool

    def snapshot(self) -> Snapshot: ...
    def close(self) -> None: ...


@dataclass
class Progress:
    """与 `frontend/src/player/telemetry.ts` 同一口径：只累计连续前进的播放位置。"""
    asset_id: int
    position: float = 0.0
    duration: float = 0.0
    pending: float = 0.0
    seeks: int = 0
    started: bool = False
    ended: bool = False
    reported_play: bool = False
    last: float | None = field(default=None, repr=False)

    def observe(self, snap: Snapshot) -> None:
        if snap.duration and snap.duration > 0:
            self.duration = float(snap.duration)
        if snap.eof:
            self.ended = True
        if snap.position is None or snap.position < 0:
            return
        position = float(snap.position)
        if self.last is not None:
            delta = position - self.last
            if not snap.paused and 0 < delta <= MAX_STEP_SECONDS:
                self.pending += delta
                self.started = True
            elif abs(delta) > MAX_STEP_SECONDS:
                self.seeks += 1
        self.last = position
        self.position = position

    def near_end(self) -> bool:
        return self.duration > 0 and self.position >= self.duration - END_SLACK_SECONDS

    def body(self) -> dict | None:
        """要写的活动记录；没有新进展时为 None。"""
        if not self.started:
            return None
        if not self.pending and not self.seeks and not self.ended:
            return None
        return {"id": self.asset_id, "position": self.position, "duration": self.duration,
                "delta": self.pending, "ended": self.ended, "seeks": self.seeks}

    def flush(self, report: Report) -> None:
        body = self.body()
        if body is None:
            return
        first = not self.reported_play
        report(body, first)
        self.reported_play = True
        self.pending = 0.0
        self.seeks = 0


# ---- mpv / IINA：JSON IPC ----------------------------------------------------

class _Channel(Protocol):
    def send(self, data: bytes) -> None: ...
    def recv(self, timeout: float) -> bytes: ...
    def close(self) -> None: ...


class SocketChannel:
    def __init__(self, sock: socket.socket):
        sock.settimeout(REQUEST_SECONDS)
        self.sock = sock

    def send(self, data: bytes) -> None:
        self.sock.sendall(data)

    def recv(self, timeout: float = REQUEST_SECONDS) -> bytes:
        self.sock.settimeout(max(timeout, 0.001))
        return self.sock.recv(65536)

    def close(self) -> None:
        self.sock.close()


class PipeChannel:
    """Windows 命名管道。

    同步句柄没有读超时：mpv 还活着却不答时，`read` 会一直不返回。读取交给一条后台线程，
    `recv` 只等到期限；到期抛超时，跟踪线程照常收尾、让出名额。卡着的那条读取线程等 mpv
    退出、管道断开时自己结束。
    """

    def __init__(self, handle):
        self.handle = handle
        self._arrived: queue.SimpleQueue = queue.SimpleQueue()
        self._reader: threading.Thread | None = None

    def send(self, data: bytes) -> None:
        self.handle.write(data)

    def _pump(self) -> None:
        try:
            while True:
                chunk = self.handle.read(65536) or b""
                self._arrived.put(chunk)
                if not chunk:
                    return
        except (OSError, ValueError):
            self._arrived.put(b"")

    def recv(self, timeout: float = REQUEST_SECONDS) -> bytes:
        if self._reader is None:
            self._reader = threading.Thread(target=self._pump, name="PeachMpvPipe", daemon=True)
            self._reader.start()
        try:
            return self._arrived.get(timeout=max(timeout, 0.001))
        except queue.Empty:
            raise TimeoutError("mpv IPC did not answer in time") from None

    def close(self) -> None:
        if self._reader is not None and self._reader.is_alive():
            # 读取线程还卡在同步 `read` 上时，关句柄可能跟着等；交给后台关，跟踪线程不陪着等。
            threading.Thread(target=self._close_quietly, name="PeachMpvPipeClose", daemon=True).start()
            return
        self.handle.close()

    def _close_quietly(self) -> None:
        try:
            self.handle.close()
        except OSError:
            pass


def mpv_address(token: str) -> str:
    if sys.platform == "win32":
        return rf"\\.\pipe\peach-mpv-{token}"
    import tempfile
    return os.path.join(tempfile.gettempdir(), f"peach-mpv-{token}.sock")


def connect_mpv(address: str) -> _Channel:
    if sys.platform == "win32":
        return PipeChannel(open(address, "r+b", buffering=0))
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)  # type: ignore[attr-defined]
    try:
        sock.settimeout(REQUEST_SECONDS)
        sock.connect(address)
    except OSError:
        sock.close()
        raise
    return SocketChannel(sock)


class MpvProbe:
    def __init__(self, channel: _Channel):
        self.channel = channel
        self.buffer = b""
        self.request = 0
        self.eof = False

    def _line(self, deadline: float) -> dict:
        while b"\n" not in self.buffer:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("mpv IPC did not answer in time")
            chunk = self.channel.recv(remaining)
            if not chunk:
                raise EOFError("mpv IPC closed")
            self.buffer += chunk
            if len(self.buffer) > 1 << 20:
                raise ValueError("mpv IPC line too long")
        line, self.buffer = self.buffer.split(b"\n", 1)
        return json.loads(line) if line.strip() else {}

    def get(self, name: str):
        """问一个属性，整次问答以 `REQUEST_SECONDS` 为限：中途一直有事件推来也不会无限等。"""
        self.request += 1
        request = self.request
        deadline = time.monotonic() + REQUEST_SECONDS
        self.channel.send(json.dumps({"command": ["get_property", name], "request_id": request}).encode() + b"\n")
        while True:
            message = self._line(deadline)
            if message.get("event") == "end-file" and message.get("reason") == "eof":
                self.eof = True
            if message.get("request_id") == request:
                return message.get("data") if message.get("error") == "success" else None

    def snapshot(self) -> Snapshot:
        idle = bool(self.get("idle-active"))
        position = self.get("time-pos")
        duration = self.get("duration")
        paused = bool(self.get("pause"))
        reached = bool(self.get("eof-reached"))
        return Snapshot(_number(position), _number(duration), paused, eof=self.eof or reached, finished=idle)

    def close(self) -> None:
        try:
            self.channel.close()
        except OSError:
            pass


# ---- VLC：Lua HTTP 接口 --------------------------------------------------------

def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class VlcProbe:
    eof = False

    def __init__(self, port: int, password: str, filename: str):
        self.url = f"http://127.0.0.1:{port}/requests/status.json"
        token = base64.b64encode(f":{password}".encode()).decode()
        self.headers = {"Authorization": f"Basic {token}"}
        self.filename = filename
        # 本机回环不经系统或环境变量里的代理。
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def snapshot(self) -> Snapshot:
        request = urllib.request.Request(self.url, headers=self.headers)
        with self.opener.open(request, timeout=REQUEST_SECONDS) as response:
            data = json.loads(response.read(1 << 20))
        state = data.get("state")
        meta = (((data.get("information") or {}).get("category") or {}).get("meta") or {})
        current = meta.get("filename")
        other = bool(current) and current != self.filename
        # `time` 只到整秒，每秒一问会让每段连续播放少记近一秒；`position` 是 0–1 的小数。
        length, ratio = _number(data.get("length")), _number(data.get("position"))
        position = ratio * length if ratio is not None and length else _number(data.get("time"))
        return Snapshot(position, length, state != "playing", finished=other or (state == "stopped"))

    def close(self) -> None:
        pass


def _number(value) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


# ---- 跟踪线程 -----------------------------------------------------------------

@dataclass
class Session:
    asset_id: int
    connect: Callable[[], Probe]
    alive: Callable[[], bool]
    report: Report


class PlaybackTrackers:
    """同时最多跟踪 `MAX_TRACKERS` 个播放器，每个最长 `MAX_SESSION_SECONDS`。"""

    def __init__(self, *, clock: Callable[[], float] = time.monotonic, poll: float = POLL_SECONDS,
                 connect_wait: float = CONNECT_SECONDS, flush_every: float = FLUSH_SECONDS,
                 max_session: float = MAX_SESSION_SECONDS):
        self.clock = clock
        self.poll = poll
        self.connect_wait = connect_wait
        self.flush_every = flush_every
        self.max_session = max_session
        self.stopping = threading.Event()
        self.lock = threading.Lock()
        self.threads: set[threading.Thread] = set()

    def has_room(self) -> bool:
        with self.lock:
            return not self.stopping.is_set() and len(self.threads) < MAX_TRACKERS

    def start(self, session: Session) -> bool:
        with self.lock:
            if self.stopping.is_set() or len(self.threads) >= MAX_TRACKERS:
                return False
            thread = threading.Thread(target=self._run, args=(session,), daemon=True,
                                      name=f"peach-playback-{session.asset_id}")
            self.threads.add(thread)
        thread.start()
        return True

    def stop(self, timeout: float = 5.0) -> None:
        self.stopping.set()
        with self.lock:
            threads = list(self.threads)
        deadline = time.monotonic() + timeout
        for thread in threads:
            thread.join(max(0.0, deadline - time.monotonic()))

    def _run(self, session: Session) -> None:
        try:
            self._track(session)
        except Exception:
            LOGGER.debug("External player progress tracking stopped: asset=%s", session.asset_id, exc_info=True)
        finally:
            with self.lock:
                self.threads.discard(threading.current_thread())

    def _connect(self, session: Session) -> Probe | None:
        deadline = self.clock() + self.connect_wait
        while not self.stopping.is_set():
            probe = None
            try:
                probe = session.connect()
                probe.snapshot()
                return probe
            except FAILURES:
                if probe is not None:
                    probe.close()
            if self.clock() >= deadline or not session.alive():
                return None
            self.stopping.wait(self.poll)
        return None

    def _track(self, session: Session) -> None:
        probe = self._connect(session)
        if probe is None:
            LOGGER.info("External player progress interface not reachable; not recording this view: asset=%s", session.asset_id)
            return
        progress = Progress(session.asset_id)
        started = last_flush = self.clock()
        try:
            while not self.stopping.is_set():
                try:
                    snap = probe.snapshot()
                except FAILURES:
                    break
                except Exception:
                    # 意料之外的回答也只结束跟踪，已经看过的部分照常落库。
                    LOGGER.debug("Error reading external player progress: asset=%s", session.asset_id, exc_info=True)
                    break
                if snap.finished and progress.last is not None:
                    # 停下或换片后的位置不属于这个文件；VLC 刚起来、还没开始放时也报 stopped。
                    progress.ended = progress.ended or snap.eof
                    break
                if not snap.finished:
                    progress.observe(snap)
                now = self.clock()
                if now - started >= self.max_session:
                    break
                if now - last_flush >= self.flush_every:
                    self._flush(progress, session)
                    last_flush = now
                if self.stopping.wait(self.poll):
                    break
        finally:
            probe.close()
        if probe.eof or progress.near_end():
            progress.ended = True
        self._flush(progress, session)

    def _flush(self, progress: Progress, session: Session) -> None:
        try:
            progress.flush(session.report)
        except Exception:
            LOGGER.warning("Failed to write external player watch record: asset=%s", session.asset_id, exc_info=True)
