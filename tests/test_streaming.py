from __future__ import annotations

import asyncio
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from starlette.requests import Request

from peach.streaming import CancellableFileResponse, StreamSessionRegistry
from peach.mp4index import segment_plan
from peach.routes_media import hls_segment
from peach.segments import HlsSegmentService, build_hls_playlist
from test_mp4repair import DECODE_TO_DISPLAY, edit_list_of, entries, legacy_sidecar, tail_mp4


async def _collect(response, requested: bytes | None, method: str = "GET"):
    """把一个 ASGI 响应跑完，返回 (状态码, 响应头, 响应体)。"""
    messages: list[dict] = []

    async def receive() -> dict:
        await asyncio.Event().wait()
        return {"type": "http.disconnect"}

    async def send(message: dict) -> None:
        messages.append(message)

    await response({
        "type": "http", "method": method, "path": "/stream",
        "headers": [(b"range", requested)] if requested else [],
    }, receive, send)
    start = messages[0]
    return (
        start["status"],
        {key.decode(): value.decode() for key, value in start["headers"]},
        b"".join(message.get("body", b"") for message in messages[1:]),
    )


class HlsDisconnectTests(unittest.IsolatedAsyncioTestCase):
    """分片请求使用真实子进程验证断开、退出和并发请求的隔离。"""

    async def asyncSetUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.source = self.root / "clip.mp4"
        self.source.write_bytes(b"source")
        self.started = asyncio.Queue()
        started = self.started

        class Registry(StreamSessionRegistry):
            def register_process(self, session, process):
                registered = super().register_process(session, process)
                if registered:
                    started.put_nowait(process)
                return registered

        self.registry = Registry()
        # 子进程只用标准库；直接运行解释器，退出与管道均属于被登记的同一个进程。
        self.python = sys._base_executable
        self.service = HlsSegmentService(
            Mock(ffmpeg=lambda: SimpleNamespace(path=Path(self.python))),
            self.root / "cache", max_concurrent=1,
        )
        executor = ThreadPoolExecutor(max_workers=1)
        self.addCleanup(executor.shutdown)
        self.state = SimpleNamespace(
            hls_service=self.service, stream_sessions=self.registry,
            hls_plan_executor=executor,
        )
        self.child_code = "import time; time.sleep(60)"

        def command(target):
            target.write_bytes(b"segment")
            return [self.python, "-c", self.child_code]

        for patcher in (
            patch("peach.routes_media._hls_plan", return_value=(
                None, self.source, [(0, 6), (6, 6)], True,
            )),
            patch.object(self.service, "_attempts", return_value=[("process", command)]),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.tasks = []

    async def asyncTearDown(self):
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
        self.registry.cancel("shared")

    def request(self, index=0):
        disconnected = asyncio.Event()

        async def receive():
            await disconnected.wait()
            return {"type": "http.disconnect"}

        request = Request({"type": "http", "app": SimpleNamespace(state=self.state)}, receive)
        task = asyncio.create_task(hls_segment(request, 1, index, "shared", {}))
        self.tasks.append(task)
        return task, disconnected

    async def process(self):
        return await asyncio.wait_for(self.started.get(), 5)

    async def response(self, task):
        return await asyncio.wait_for(asyncio.shield(task), 5)

    async def test_disconnect_reaps_the_child_and_allows_the_slice_to_be_requested_again(self):
        task, disconnected = self.request()
        process = await self.process()
        self.assertIsNone(process.returncode)
        disconnected.set()
        response = await self.response(task)
        self.assertEqual(response.status_code, 410)
        self.assertIsNotNone(process.returncode)
        self.assertFalse(self.registry.is_cancelled("shared"))
        self.assertEqual(list(self.root.rglob("*.tmp.ts")), [])
        target = self.service.cached_path(self.source, 1, 0, transcode=True)
        self.assertFalse(target.exists())

        self.child_code = "pass"
        retry, _ = self.request()
        response = await self.response(retry)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Path(response.path).read_bytes(), b"segment")

    async def test_disconnect_preserves_another_active_slice_in_the_same_session(self):
        self.service = self.state.hls_service = HlsSegmentService(
            self.service.resolver, self.root / "parallel", max_concurrent=2,
        )
        with patch.object(self.service, "_attempts", return_value=[(
            "process", lambda target: [self.python, "-c", self.child_code],
        )]):
            first, disconnected = self.request(0)
            first_process = await self.process()
            second, _ = self.request(1)
            second_process = await self.process()
            disconnected.set()
            self.assertEqual((await self.response(first)).status_code, 410)
            self.assertIsNotNone(first_process.returncode)
            self.assertIsNone(second_process.returncode)
            self.assertFalse(second.done())
            self.assertEqual(self.registry.cancel("shared"), 1)
            self.assertEqual((await self.response(second)).status_code, 410)
            self.assertIsNotNone(second_process.returncode)

    async def test_disconnected_queued_slice_does_not_start_a_child(self):
        first, _ = self.request(0)
        process = await self.process()
        second, disconnected = self.request(1)
        disconnected.set()
        self.assertEqual((await self.response(second)).status_code, 410)
        self.assertTrue(self.started.empty())
        self.assertIsNone(process.returncode)
        self.assertEqual(self.registry.cancel("shared"), 1)
        self.assertEqual((await self.response(first)).status_code, 410)
        self.assertIsNotNone(process.returncode)

    async def test_handler_cancellation_reaps_the_child_and_preserves_cancellation(self):
        task, _ = self.request()
        process = await self.process()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertIsNotNone(process.returncode)
        self.assertEqual(list(self.root.rglob("*.tmp.ts")), [])
        self.assertEqual(self.registry.cancel("shared"), 0)


class StreamSessionRegistryTests(unittest.IsolatedAsyncioTestCase):
    async def test_cancel_stops_every_active_request_in_the_session(self):
        registry = StreamSessionRegistry()
        started = asyncio.Event()

        async def wait_for_cancel() -> None:
            task = asyncio.current_task()
            assert task is not None
            self.assertTrue(registry.register("detail-1", task))
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                registry.unregister("detail-1", task)

        task = asyncio.create_task(wait_for_cancel())
        await started.wait()
        self.assertEqual(registry.active_count("detail-1"), 1)
        self.assertEqual(registry.cancel("detail-1"), 1)
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(registry.active_count("detail-1"), 0)

    async def test_cancelled_session_rejects_late_range_requests(self):
        registry = StreamSessionRegistry()
        registry.cancel("detail-1")
        task = asyncio.current_task()
        assert task is not None
        self.assertFalse(registry.register("detail-1", task))

    async def test_open_ended_range_keeps_standard_http_semantics(self):
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "remote.mp4"
            path.write_bytes(bytes(range(64)))
            registry = StreamSessionRegistry()
            response = CancellableFileResponse(
                path, session="detail-2", registry=registry,
            )
            messages: list[dict] = []

            async def receive() -> dict:
                # 服务器的 receive() 在请求体读完后就一直挂着，直到客户端断开。
                await asyncio.Event().wait()
                return {"type": "http.disconnect"}

            async def send(message: dict) -> None:
                messages.append(message)

            scope = {
                "type": "http", "method": "GET", "path": "/stream",
                "headers": [(b"range", b"bytes=0-")],
            }
            await response(scope, receive, send)

        start = messages[0]
        headers = {key.decode(): value.decode() for key, value in start["headers"]}
        body = b"".join(message.get("body", b"") for message in messages[1:])
        self.assertEqual(start["status"], 206)
        self.assertEqual(headers["content-range"], "bytes 0-63/64")
        self.assertEqual(headers["content-length"], "64")
        self.assertEqual(body, bytes(range(64)))
        self.assertEqual(registry.active_count("detail-2"), 0)

    async def test_client_disconnect_stops_reading_the_rest_of_the_file(self):
        """拖动进度条掐掉旧 Range 请求后，服务端不能把文件剩下的部分读到末尾。

        uvicorn 断开后 send() 静默返回，所以这里的 send 也照单全收；能证明停下来的
        只有「断开后发出的块数」：8 块的文件，断在第 1 块之后，读到的块数必须远少于 8。
        """
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "remote.mp4"
            chunk = 1024
            path.write_bytes(bytes(range(256)) * 4 * 8)
            registry = StreamSessionRegistry()
            response = CancellableFileResponse(
                path, session="detail-3", registry=registry,
            )
            response.chunk_size = chunk
            bodies: list[bytes] = []
            disconnected = asyncio.Event()

            async def receive() -> dict:
                await disconnected.wait()
                return {"type": "http.disconnect"}

            async def send(message: dict) -> None:
                if message["type"] != "http.response.body":
                    return
                bodies.append(message["body"])
                if len(bodies) == 1:
                    disconnected.set()
                    # 让监听断开的任务先跑起来，模拟浏览器在这一块发出后关闭连接。
                    await asyncio.sleep(0)

            scope = {
                "type": "http", "method": "GET", "path": "/stream",
                "headers": [(b"range", b"bytes=0-")],
            }
            await response(scope, receive, send)

        self.assertGreaterEqual(len(bodies), 1)
        self.assertLess(len(bodies), 4, "断开后仍把文件读到了末尾")
        self.assertEqual(bodies[0], bytes(range(256)) * 4)
        self.assertEqual(registry.active_count("detail-3"), 0)

    def test_range_bodies_are_read_one_mebibyte_at_a_time(self):
        """Starlette 默认 64 KiB 一读，浏览器缓冲一段 Range 要跑几十趟 CloudDrive 挂载层。"""
        from peach.streaming import BufferedFileResponse

        self.assertEqual(BufferedFileResponse.chunk_size, 1 << 20)
        self.assertEqual(CancellableFileResponse.chunk_size, 1 << 20)

    async def test_file_reads_do_not_queue_behind_the_shared_thread_pool(self):
        """同步端点占满 anyio 默认线程时，播放读块走自己的线程，照样读完。"""
        import os
        import anyio.to_thread
        from peach.streaming import BufferedFileResponse

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "clip.mp4"
            path.write_bytes(b"0123456789")
            shared = anyio.to_thread.current_default_thread_limiter()
            total = shared.total_tokens
            shared.total_tokens = 1
            await shared.acquire()
            try:
                status, headers, body = await asyncio.wait_for(_collect(
                    BufferedFileResponse(path, stat_result=os.stat(path)), b"bytes=2-5"), 5)
            finally:
                shared.release()
                shared.total_tokens = total
        self.assertEqual((status, headers["content-range"], body), (206, "bytes 2-5/10", b"2345"))

    def test_shutdown_cancels_queued_reads_without_waiting_and_leaves_a_fresh_executor(self):
        """服务关闭时排着的读块取消、卡住的那块不等；同一进程再起服务拿到的是新的执行器。"""
        import threading
        from peach import streaming
        retired = streaming.STREAM_EXECUTOR
        release = threading.Event()
        try:
            blocked = [retired.submit(release.wait, 5) for _ in range(streaming.STREAM_THREADS)]
            queued = retired.submit(lambda: "late")
            streaming.shutdown_stream_executor()
            self.assertTrue(queued.cancelled())
            self.assertFalse(any(future.done() for future in blocked))
            self.assertIsNot(streaming.STREAM_EXECUTOR, retired)
            self.assertEqual(streaming.STREAM_EXECUTOR.submit(lambda: "fresh").result(5), "fresh")
        finally:
            release.set()

    async def test_a_spliced_file_serves_ranges_across_the_seam(self):
        """头在边车里、内容在原文件中间，跨接缝的 Range 必须拼出连续的字节。"""
        import tempfile
        from pathlib import Path

        from peach.mp4repair import RepairedHeader
        from peach.streaming import SplicedMp4Response

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "remote.mp4"
            path.write_bytes(b"OLDHEAD" + bytes(range(64)) + b"TAIL")
            header = RepairedHeader(
                prefix=b"NEWHEADER", payload_start=7, payload_end=71, suffix=b"END")
            whole = b"NEWHEADER" + bytes(range(64)) + b"END"

            for label, requested, status, expected in (
                ("没有 Range 头", None, 200, whole),
                ("整份也按 Range 答", b"bytes=0-", 206, whole),
                ("跨头与内容的接缝", b"bytes=5-12", 206, whole[5:13]),
                ("只要内容", b"bytes=20-30", 206, whole[20:31]),
                ("开区间到尾", b"bytes=70-", 206, whole[70:]),
                ("末尾若干字节", b"bytes=-4", 206, whole[-4:]),
            ):
                with self.subTest(label):
                    status_code, headers, body = await _collect(
                        SplicedMp4Response(path, header), requested)
                    self.assertEqual(status_code, status)
                    self.assertEqual(body, expected)
                    self.assertEqual(headers["content-length"], str(len(expected)))
                    self.assertEqual(headers["accept-ranges"], "bytes")

            status_code, headers, body = await _collect(
                SplicedMp4Response(path, header), b"bytes=999-")
            self.assertEqual(status_code, 416)
            self.assertEqual(headers["content-range"], f"bytes */{len(whole)}")

    async def test_tail_moov_repair_serves_both_seams_and_the_saved_suffix(self):
        from peach import mp4repair
        from peach.streaming import SplicedMp4Response

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'tail.mp4'
            path.write_bytes(tail_mp4() + b'\x00\x00\x00\x10freeABCDEFGH')
            original = path.read_bytes()
            with patch.object(mp4repair, '_display_order', return_value=list(DECODE_TO_DISPLAY)):
                header = mp4repair.repaired_header(path, Path('ffprobe'))
            sidecar = Path(tmp) / 'repair.mp4hdr'
            mp4repair.write_sidecar(sidecar, header)
            header = mp4repair.read_sidecar(sidecar)
            whole = header.prefix + original[header.payload_start:header.payload_end] + header.suffix
            for seam in (len(header.prefix), len(whole) - len(header.suffix)):
                status, headers, body = await _collect(
                    SplicedMp4Response(path, header), f'bytes={seam - 4}-{seam + 4}'.encode())
                self.assertEqual(status, 206)
                self.assertEqual(body, whole[seam - 4:seam + 5])
                self.assertEqual(headers['content-length'], '9')
            self.assertEqual(path.read_bytes(), original)

    async def test_a_spliced_head_request_reports_the_size_without_a_body(self):
        import tempfile
        from pathlib import Path

        from peach.mp4repair import RepairedHeader
        from peach.streaming import SplicedMp4Response

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "remote.mp4"
            path.write_bytes(b"OLDHEAD" + bytes(range(64)))
            header = RepairedHeader(prefix=b"NEWHEADER", payload_start=7, payload_end=71)
            status_code, headers, body = await _collect(
                SplicedMp4Response(path, header), None, method="HEAD")

        self.assertEqual(status_code, 200)
        self.assertEqual(headers["content-length"], "73")
        self.assertEqual(headers["content-type"], "video/mp4")
        self.assertEqual(body, b"")

    async def test_a_legacy_repair_streams_the_corrected_head_and_original_payload(self):
        import tempfile
        from pathlib import Path

        from peach.mp4repair import HeaderRepairStore
        from peach.streaming import SplicedMp4Response

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            sidecar = root / "old.mp4hdr"
            legacy_sidecar(sidecar, [(5200, 798, 1 << 16)])
            source = sidecar.with_suffix(".mp4")
            original = source.read_bytes()
            stat = source.stat()
            sidecar.rename(root / f"9-{stat.st_size}-{stat.st_mtime_ns}.mp4hdr")
            store = HeaderRepairStore(root, None)
            header = store.lookup(9, source)
            self.assertEqual(entries(edit_list_of(header), ">IiI"), [(5200, 398, 1 << 16)])
            whole = header.prefix + original[header.payload_start:header.payload_end]
            start = len(header.prefix) - 8
            status, headers, body = await _collect(SplicedMp4Response(source, header),
                                                  f"bytes={start}-{start + 23}".encode())

            self.assertEqual(status, 206)
            self.assertEqual(body, whole[start:start + 24])
            self.assertEqual(headers['content-range'], f'bytes {start}-{start + 23}/{len(whole)}')
            self.assertEqual(source.read_bytes(), original)

    def test_hls_playlist_is_time_addressable_without_full_file_ranges(self):
        # 分片边界由真实关键帧决定，不再按固定秒数等分（见 tests/test_segments.py）。
        plan = segment_plan([0.0, 6.0, 12.0], 13.5, 6)
        self.assertEqual(plan, [(0.0, 6.0), (6.0, 6.0), (12.0, 1.5)])
        playlist = build_hls_playlist(plan, lambda index: f"/seg/{index}.ts")
        self.assertIn("#EXT-X-PLAYLIST-TYPE:VOD", playlist)
        self.assertIn("/seg/0.ts", playlist)
        self.assertIn("/seg/2.ts", playlist)
        self.assertEqual(playlist.count("#EXTINF:"), 3)
