from __future__ import annotations

import asyncio
import logging
import os
import threading
from collections.abc import Awaitable, MutableSet
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from time import monotonic
from typing import Any

from starlette.responses import FileResponse, Response
from starlette.requests import ClientDisconnect
from starlette.types import Receive, Scope, Send

RANGE_PREFIX = "bytes="


class StreamSessionRegistry:
    """Track addressable browser stream requests so the UI can cancel them."""

    def __init__(self, *, tombstone_seconds: float = 300.0) -> None:
        self._active: dict[str, MutableSet[asyncio.Task[object]]] = {}
        self._processes: dict[str, MutableSet[Any]] = {}
        self._cancelled: dict[str, float] = {}
        self._tombstone_seconds = tombstone_seconds
        self._lock = threading.RLock()

    def _prune(self, now: float) -> None:
        expired = [
            session for session, cancelled_at in self._cancelled.items()
            if now - cancelled_at >= self._tombstone_seconds
        ]
        for session in expired:
            self._cancelled.pop(session, None)

    def register(self, session: str, task: asyncio.Task[object]) -> bool:
        with self._lock:
            self._prune(monotonic())
            if session in self._cancelled:
                return False
            self._active.setdefault(session, set()).add(task)
            return True

    def register_process(self, session: str, process: Any) -> bool:
        """把生成 HLS 片段的子进程纳入同一个可取消会话。"""
        with self._lock:
            self._prune(monotonic())
            if session in self._cancelled:
                return False
            self._processes.setdefault(session, set()).add(process)
            return True

    def unregister_process(self, session: str, process: Any) -> None:
        with self._lock:
            processes = self._processes.get(session)
            if not processes:
                return
            processes.discard(process)
            if not processes:
                self._processes.pop(session, None)

    def is_cancelled(self, session: str) -> bool:
        with self._lock:
            self._prune(monotonic())
            return session in self._cancelled

    def unregister(self, session: str, task: asyncio.Task[object]) -> None:
        with self._lock:
            tasks = self._active.get(session)
            if not tasks:
                return
            tasks.discard(task)
            if not tasks:
                self._active.pop(session, None)

    def cancel(self, session: str) -> int:
        with self._lock:
            self._prune(monotonic())
            self._cancelled[session] = monotonic()
            tasks = tuple(self._active.pop(session, ()))
            processes = tuple(self._processes.pop(session, ()))
        for task in tasks:
            task.cancel()
        for process in processes:
            try:
                if process.returncode is None:
                    process.kill()
            except (OSError, ProcessLookupError):
                pass
        return len(tasks) + len(processes)

    def active_count(self, session: str) -> int:
        with self._lock:
            return len(self._active.get(session, ()))


async def _wait_for_disconnect(receive: Receive) -> None:
    """等到客户端断开。请求体读完后 uvicorn 的 receive() 只会在断开时再返回一次。"""
    while True:
        message = await receive()
        task = asyncio.current_task()
        if message["type"] == "http.disconnect" or (task is not None and task.cancelling()):
            return


async def _wait_for_tasks(*tasks) -> None:
    """清理期间保留外层取消，等子任务结束后再向上交还。"""
    finished = asyncio.gather(*tasks, return_exceptions=True)
    cancelled = False
    while not finished.done():
        try:
            await asyncio.shield(finished)
        except asyncio.CancelledError:
            cancelled = True
    if cancelled:
        raise asyncio.CancelledError


async def _cancel_and_wait(*tasks) -> None:
    for task in tasks:
        task.cancel()
    await _wait_for_tasks(*tasks)


async def run_until_disconnect[T](operation: Awaitable[T], receive: Receive) -> T:
    """等待请求的工作结果；客户端断开时取消工作，并等待其清理完成。"""
    work = asyncio.ensure_future(operation)
    watch = asyncio.ensure_future(_wait_for_disconnect(receive))
    try:
        done, _ = await asyncio.wait({work, watch}, return_when=asyncio.FIRST_COMPLETED)
        if work in done:
            return work.result()
        watch.result()
        raise ClientDisconnect()
    finally:
        await _cancel_and_wait(work, watch)


async def _send_until_disconnect(inner, scope: Scope, receive: Receive, send: Send, *, is_cancelled=None) -> None:
    """跑 `inner` 发响应，客户端一断开就把它掐掉。"""
    started = False

    async def tracked_send(message):
        nonlocal started
        await send(message)
        if message['type'] == 'http.response.start':
            started = True

    respond = asyncio.ensure_future(inner(scope, receive, tracked_send))
    watch = asyncio.ensure_future(_wait_for_disconnect(receive))
    cancellation = None
    try:
        await asyncio.wait({respond, watch}, return_when=asyncio.FIRST_COMPLETED)
    except asyncio.CancelledError as error:
        cancellation = error
    finally:
        try:
            await _cancel_and_wait(respond, watch)
        except asyncio.CancelledError as error:
            cancellation = cancellation or error
    if not respond.cancelled():
        respond.result()
    if not watch.cancelled():
        watch.result()
    if cancellation is not None and (is_cancelled is None or not is_cancelled()):
        raise cancellation
    if respond.cancelled() and not started:
        await Response(status_code=204)(scope, receive, send)


class BufferedFileResponse(FileResponse):
    """按 1 MiB 读文件再发，客户端一断开就停止读。

    Starlette 默认每次读 64 KiB，浏览器缓冲一段 Range 要向 CloudDrive 发几十次小读；
    读大一点只是少跑几趟挂载层，Range 语义不变。

    浏览器拖动进度条时会掐掉旧的开区间 Range 请求。uvicorn 在连接断开后 send() 只是静默
    返回，Starlette 的 FileResponse 又不监听断开事件，读文件的循环会一直跑到文件末尾：
    一部 5 GB 的片子每拖一次就多一个幽灵读者，通过挂载把剩下的几 GB 全拉一遍，新位置那
    一块只能排在它们后面（2026-09-13 实测，断开后 15 秒继续下行 221 MB 直到文件结束）。
    所以这里自己盯 http.disconnect，收到就取消发送任务，最多多读一块。
    """

    chunk_size = 1 << 20

    def _is_cancelled(self) -> bool:
        return False

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await super().__call__(scope, receive, send)
            return
        await _send_until_disconnect(super().__call__, scope, receive, send, is_cancelled=self._is_cancelled)

    @asynccontextmanager
    async def _open_file(self):
        """读块走送流自己的线程（`STREAM_EXECUTOR`），不和同步端点抢 anyio 默认的 40 个线程。

        Starlette 三种发法（整份、单段、多段）都经这里拿文件，只用 `read` 与 `seek`。
        关闭也在这组线程里做，并且护住：发送被取消时也照样关掉。
        """
        handle = await _stream_thread(open, self.path, "rb")
        try:
            yield _StreamFile(handle)
        finally:
            await asyncio.shield(asyncio.get_running_loop().run_in_executor(STREAM_EXECUTOR, handle.close))


class _StreamFile:
    def __init__(self, handle):
        self._handle = handle

    async def read(self, size: int) -> bytes:
        return await _stream_thread(self._handle.read, size)

    async def seek(self, offset: int) -> int:
        return await _stream_thread(self._handle.seek, offset)


#: 送流读块专用的线程。同步端点（`def` 路由）与 Starlette 的文件读取原先共用 anyio 默认的
#: 40 个线程，几个卡在网盘上的慢请求占满之后，播放读块也排在它们后面。
STREAM_THREADS = 16


def _new_executor() -> ThreadPoolExecutor:
    return ThreadPoolExecutor(max_workers=STREAM_THREADS, thread_name_prefix="PeachStream")


STREAM_EXECUTOR = _new_executor()


def shutdown_stream_executor() -> None:
    """服务关闭时收掉送流线程：排着的读块取消，正卡在网盘上的那几块不等，否则关服务要陪它们耗着。

    执行器是模块级的，同一进程里还会再起服务（托盘重建、测试），所以换上一个新的；
    线程按需才起，新执行器不占线程。"""
    global STREAM_EXECUTOR
    retired, STREAM_EXECUTOR = STREAM_EXECUTOR, _new_executor()
    retired.shutdown(wait=False, cancel_futures=True)


async def _stream_thread(function, *args):
    return await asyncio.get_running_loop().run_in_executor(STREAM_EXECUTOR, function, *args)


class CancellableFileResponse(BufferedFileResponse):
    """能按会话取消正在发送任务的 FileResponse。"""

    def __init__(
        self,
        path: str | Path,
        *,
        session: str,
        registry: StreamSessionRegistry,
        media_type: str | None = None,
        stat_result: os.stat_result | None = None,
    ) -> None:
        super().__init__(path, media_type=media_type, stat_result=stat_result)
        self.session = session
        self.registry = registry

    def _is_cancelled(self) -> bool:
        return self.registry.is_cancelled(self.session)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        task = asyncio.current_task()
        if task is None or not self.registry.register(self.session, task):
            await Response(status_code=410, headers={"Cache-Control": "no-store"})(scope, receive, send)
            return
        try:
            await super().__call__(scope, receive, send)
        except asyncio.CancelledError:
            if self._is_cancelled():
                logging.getLogger(__name__).info("stream session cancelled: %s", self.session)
            raise
        finally:
            self.registry.unregister(self.session, task)


def _overlap(blob: bytes, base: int, start: int, end: int):
    """`blob` 铺在虚拟文件的 `base` 处，取它和闭区间 [start, end] 相交的那一段。"""
    begin = max(start, base)
    stop = min(end + 1, base + len(blob))
    if begin < stop:
        yield blob[begin - base:stop - base]


def _requested_range(scope: Scope, total: int) -> tuple[int, int, bool] | None:
    """解析单段 Range，返回 (起, 止, 是不是按 Range 答的)；要不起的区间返回 None。

    末位的布尔值决定回 206 还是 200：整份内容也要回 206，有播放器把 200 读成「这个
    服务端不支持 Range」，接着就把拖动关掉。
    多段 Range 当没有 Range 处理：浏览器播视频从不这么请求，为它写一套 multipart
    没有真实需求。
    """
    raw = ""
    for key, value in scope.get("headers", ()):
        if key.lower() == b"range":
            raw = value.decode("latin-1").strip()
            break
    if not raw.startswith(RANGE_PREFIX) or "," in raw:
        return 0, total - 1, False
    first, _, last = raw[len(RANGE_PREFIX):].partition("-")
    try:
        if not first:
            length = int(last)
            if length <= 0:
                return 0, total - 1, False
            return total - min(length, total), total - 1, True
        start = int(first)
        end = int(last) if last else total - 1
    except ValueError:
        return 0, total - 1, False
    end = min(end, total - 1)
    return None if start > end or start >= total else (start, end, True)


class SplicedMp4Response(Response):
    """把「修好的头 + 原文件里那一段 mdat」当成一个虚拟文件发出去。

    Starlette 的 `FileResponse` 按磁盘上那个文件的大小和偏移切 Range，而这里要发的字节
    序列在磁盘上并不存在：头在边车里，内容是原文件中间的一段。所以 Range 自己算。
    断开就停读，理由和 `BufferedFileResponse` 一样。
    """

    chunk_size = 1 << 20

    def __init__(
        self,
        path: str | Path,
        header,
        *,
        session: str = "",
        registry: StreamSessionRegistry | None = None,
    ) -> None:
        super().__init__(b"", media_type="video/mp4")
        from .smb_media import SmbResource
        self.path = path if isinstance(path, SmbResource) else Path(path)
        self.header = header
        self.session = session
        self.registry = registry

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await super().__call__(scope, receive, send)
            return
        task = asyncio.current_task()
        tracked = bool(self.session and self.registry is not None)
        if tracked and (task is None or not self.registry.register(self.session, task)):
            await Response(status_code=410, headers={"Cache-Control": "no-store"})(scope, receive, send)
            return
        try:
            await _send_until_disconnect(self._respond, scope, receive, send,
                                         is_cancelled=lambda: tracked and self.registry.is_cancelled(self.session))
        except asyncio.CancelledError:
            if tracked and self.registry.is_cancelled(self.session):
                logging.getLogger(__name__).info("stream session cancelled: %s", self.session)
            raise
        finally:
            if tracked and task is not None:
                self.registry.unregister(self.session, task)

    async def _respond(self, scope: Scope, receive: Receive, send: Send) -> None:
        total = self.header.size
        window = _requested_range(scope, total)
        if window is None:
            await Response(
                status_code=416,
                headers={"Content-Range": f"bytes */{total}", "Cache-Control": "no-store"},
            )(scope, receive, send)
            return
        start, end, ranged = window
        headers = [
            (b"content-type", b"video/mp4"),
            (b"accept-ranges", b"bytes"),
            (b"cache-control", b"no-store"),
            (b"content-length", str(end - start + 1).encode("latin-1")),
        ]
        if ranged:
            headers.append((b"content-range", f"bytes {start}-{end}/{total}".encode("latin-1")))
        await send({
            "type": "http.response.start",
            "status": 206 if ranged else 200,
            "headers": headers,
        })
        if scope.get("method", "GET").upper() == "HEAD":
            await send({"type": "http.response.body", "body": b"", "more_body": False})
            return
        stream = self._chunks(start, end)
        try:
            async for chunk in stream:
                await send({"type": "http.response.body", "body": chunk, "more_body": True})
        finally:
            await stream.aclose()
        await send({"type": "http.response.body", "body": b"", "more_body": False})

    async def _chunks(self, start: int, end: int):
        """按虚拟文件的坐标取字节：先头、再原文件那一段、最后尾。"""
        body_start = len(self.header.prefix)
        body_end = body_start + (self.header.payload_end - self.header.payload_start)
        for chunk in _overlap(self.header.prefix, 0, start, end):
            yield chunk
        if end >= body_start and start < body_end:
            async for chunk in self._source_chunks(
                max(start, body_start) - body_start, min(end + 1, body_end) - body_start,
            ):
                yield chunk
        for chunk in _overlap(self.header.suffix, body_end, start, end):
            yield chunk

    async def _source_chunks(self, begin: int, stop: int):
        """整段共用一个句柄：挂载盘上每开一次文件都要多走一趟握手。读块走送流自己的线程配额。"""
        handle = await _stream_thread(self.path.open, 'rb')
        try:
            await _stream_thread(handle.seek, self.header.payload_start + begin)
            remaining = stop - begin
            while remaining > 0:
                chunk = await _stream_thread(handle.read, min(self.chunk_size, remaining))
                if not chunk:
                    return
                yield chunk
                remaining -= len(chunk)
        finally:
            handle.close()
