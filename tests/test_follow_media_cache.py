import asyncio
import json
import gzip
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

import httpx
from starlette.applications import Starlette
from starlette.routing import Route

from peach import remote_media_cache
from peach.preview_cache import PreviewCache
from peach.remote_media_cache import AVATAR_REFRESH_SECONDS, FAVICON_REFRESH_SECONDS, RemoteMediaCache


class RemoteMediaCacheTests(unittest.IsolatedAsyncioTestCase):
    def test_capacity_denial_after_fetch_does_not_write_or_enter_upstream_cooldown(self):
        from peach.jobs import DiskSpaceDenied
        from peach.remote_media_cache import RemoteMediaUnavailable
        guard = mock.Mock()
        guard.check.side_effect = [None, DiskSpaceDenied('errors.storageBudget.cacheWritesStopped', {'reasons': '缓存超限'})]
        self.cache.capacity_guard = guard
        with self.assertRaises(RemoteMediaUnavailable):
            self.cache.bytes('new-image', lambda: b'image')
        self.assertFalse(list(self.root.rglob('*.data')))
        self.assertFalse(list(self.root.rglob('*.failed')))
        guard.check.side_effect = None
        self.assertEqual(self.cache.bytes('new-image', lambda: b'image'), b'image')

    async def test_active_documents_are_rejected_without_forwarding_or_caching_bytes(self):
        self.payload=b'<svg><script>active()</script></svg>'
        for kind in ('image/svg+xml','text/html','application/xhtml+xml','application/xml',''):
            with self.subTest(kind=kind):
                self.headers={'content-type':kind,'content-length':str(len(self.payload))}
                response=await self.client.get('/media')
                self.assertEqual(response.status_code,502)
                self.assertNotIn(b'<script>',response.content)
                self.assertEqual(response.headers['x-content-type-options'],'nosniff')
                self.assertIn('sandbox',response.headers['content-security-policy'])
                self.assertIsNone(self.cache.stored('follow:1:media:0'))

    async def test_old_active_document_cache_is_not_served_after_upgrade(self):
        slot=self.cache._slot('follow:1:media:0')
        slot.parent.mkdir(parents=True)
        body=b'<svg><script>active()</script></svg>'
        slot.with_suffix('.bin').write_bytes(body)
        slot.with_suffix('.json').write_text(json.dumps({'status':200,'size':len(body),
            'headers':{'content-type':'image/svg+xml'}}),encoding='utf-8')
        response=await self.client.get('/media')
        self.assertEqual(response.content,self.payload)
        self.assertEqual(self.calls,1)
        self.assertEqual(response.headers['cache-control'],'private, no-cache')

    async def test_damaged_cache_metadata_is_a_miss_not_a_server_error(self):
        slot = self.cache._slot('follow:1:media:0')
        slot.parent.mkdir(parents=True)
        slot.with_suffix('.bin').write_bytes(b'x' * 4)
        for headers in (['content-type'], {'content-type': ['video/mp4']}):
            with self.subTest(headers=headers):
                slot.with_suffix('.json').write_text(json.dumps({'status': 200, 'size': 4, 'headers': headers}),
                                                     encoding='utf-8')
                self.assertIsNone(self.cache.stored('follow:1:media:0'))
        response = await self.client.get('/media')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, self.payload)

    async def test_hls_manifests_remain_available_as_passive_media(self):
        self.payload=b'#EXTM3U\n'
        self.headers={'content-type':'application/vnd.apple.mpegurl','content-length':str(len(self.payload))}
        response=await self.client.get('/media')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.content,self.payload)
        self.assertIn('sandbox',response.headers['content-security-policy'])

    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.cache = RemoteMediaCache(self.root)
        self.calls = 0
        self.status = 200
        self.headers = {"content-type": "video/mp4", "content-length": "10", "set-cookie": "origin=private", "server": "origin"}
        self.payload = b"0123456789"
        def fetch():
            self.calls += 1
            return httpx.Response(self.status, headers=self.headers, stream=httpx.ByteStream(self.payload))
        def endpoint(request):
            return self.cache.stream("follow:1:media:0", request, fetch)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=Starlette(routes=[Route("/media", endpoint)])),
                                       base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        self.temp.cleanup()

    async def test_complete_media_survives_restart_and_serves_range_without_upstream(self):
        first = await self.client.get("/media")
        self.assertEqual(first.content, self.payload)
        self.assertNotIn("set-cookie", first.headers)
        self.assertNotIn("server", first.headers)
        self.cache = RemoteMediaCache(self.root)
        replay = await self.client.get("/media", headers={"Range": "bytes=2-5"})
        self.assertEqual(replay.status_code, 206)
        self.assertEqual(replay.content, b"2345")
        self.assertEqual(replay.headers["content-range"], "bytes 2-5/10")
        head = await self.client.head("/media")
        self.assertEqual(head.content, b"")
        self.assertEqual(self.calls, 1)

    async def test_metadata_write_recovers_after_the_cache_folder_keeps_disappearing(self):
        real = remote_media_cache.atomic_write_text
        calls = 0
        def flaky(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls < remote_media_cache.SIDECAR_ATTEMPTS:
                raise FileNotFoundError
            return real(*args, **kwargs)
        with mock.patch.object(remote_media_cache, "atomic_write_text", side_effect=flaky):
            first = await self.client.get("/media")
            replay = await self.client.get("/media", headers={"Range": "bytes=2-5"})
        self.assertEqual(first.content, self.payload)
        self.assertEqual(replay.content, b"2345")
        self.assertEqual(self.calls, 1)

    async def test_a_new_capture_installs_its_own_data_file_and_drops_the_previous_one(self):
        """数据文件每次用新名字、sidecar 最后写：不替换正被读着的文件，也不会新数据配旧长度。"""
        key = "follow:1:media:0"
        first = await self.client.get("/media")
        self.assertEqual(first.content, self.payload)
        slot = self.cache._slot(key)
        before = json.loads(slot.with_suffix(".json").read_text(encoding="utf-8"))["file"]
        self.payload = b"abcdefghij"
        list(self.cache._capture_response(
            slot, httpx.Response(200, headers=self.headers, stream=httpx.ByteStream(self.payload)),
            self.headers, accepted=True, content_range=None, complete_range=False))
        after = json.loads(slot.with_suffix(".json").read_text(encoding="utf-8"))["file"]
        self.assertNotEqual(before, after)
        self.assertEqual([path.name for path in slot.parent.glob("*.bin")], [after])
        path, _metadata = self.cache.stored(key)
        self.assertEqual(path.read_bytes(), b"abcdefghij")

    async def test_missing_cache_folder_falls_back_to_the_live_response(self):
        with mock.patch.object(remote_media_cache, "atomic_path", side_effect=FileNotFoundError):
            response = await self.client.get("/media")
        self.assertEqual(response.content, self.payload)
        self.assertEqual(self.calls, 1)
        self.assertIsNone(self.cache.stored("follow:1:media:0"))

    async def test_partial_response_is_reused_only_for_its_range(self):
        self.status, self.payload = 206, b"2345"
        self.headers.update({"content-range": "bytes 2-5/10", "content-length": "4"})
        for _ in range(2):
            response = await self.client.get("/media", headers={"Range": "bytes=2-5"})
            self.assertEqual(response.status_code, 206)
            self.assertEqual(response.content, b"2345")
        self.assertEqual(self.calls, 1)
        self.assertIsNone(self.cache.stored("follow:1:media:0", "bytes=6-9"))
        self.assertIsNone(self.cache.stored("follow:1:media:0"))

    async def test_content_encoding_is_preserved_for_disk_replay(self):
        self.payload = gzip.compress(b"0123456789")
        self.headers.update({"content-encoding": "gzip", "content-length": str(len(self.payload))})
        for _ in range(2):
            response = await self.client.get("/media")
            self.assertEqual(response.content, b"0123456789")
        self.assertEqual(self.calls, 1)

    async def test_concurrent_cold_requests_download_once(self):
        responses = await asyncio.gather(self.client.get("/media"), self.client.get("/media"))
        self.assertEqual([response.content for response in responses], [self.payload] * 2)
        self.assertEqual(self.calls, 1)

    async def test_another_range_is_not_queued_behind_a_playing_download(self):
        """在线播放时整段还在送，拖动或读尾部 moov 的另一个 Range 当场取上游，不排在它后面。"""
        started, release = threading.Event(), threading.Event()

        class Held(httpx.SyncByteStream):
            def __iter__(self):
                yield b"01"
                started.set()
                release.wait(10)
                yield b"23456789"

        def fetch(request):
            self.calls += 1
            if "range" not in request.headers:
                return httpx.Response(200, headers=self.headers, stream=Held())
            return httpx.Response(206, headers={"content-type": "video/mp4", "content-length": "4",
                                               "content-range": "bytes 2-5/10"}, stream=httpx.ByteStream(b"2345"))

        def endpoint(request):
            return self.cache.stream("follow:1:media:0", request, lambda: fetch(request))
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=Starlette(routes=[Route("/media", endpoint)])),
                                   base_url="http://test")
        self.addAsyncCleanup(client.aclose)
        playing = asyncio.create_task(client.get("/media"))
        try:
            await asyncio.to_thread(started.wait, 5)
            seek = await asyncio.wait_for(client.get("/media", headers={"Range": "bytes=2-5"}), 5)
            self.assertEqual((seek.status_code, seek.content), (206, b"2345"))
        finally:
            release.set()
        self.assertEqual((await playing).content, self.payload)
        self.assertEqual(self.calls, 2)

    async def test_a_complete_range_can_serve_other_ranges(self):
        self.status = 206
        self.headers["content-range"] = "bytes 0-9/10"
        await self.client.get("/media", headers={"Range": "bytes=0-"})
        replay = await self.client.get("/media", headers={"Range": "bytes=2-5"})
        self.assertEqual(replay.content, b"2345")
        self.assertEqual(self.calls, 1)

    async def test_html_and_failed_status_are_not_installed(self):
        self.headers = {"content-type": "text/html", "content-length": "5"}
        self.payload = b"error"
        response = await self.client.get("/media")
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertIsNone(self.cache.stored("follow:1:media:0"))
        self.headers["content-type"] = "video/mp4"
        self.status = 403
        response = await self.client.get("/media")
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertIsNone(self.cache.stored("follow:1:media:0"))

    async def test_invalid_media_head_is_not_cacheable_and_valid_retry_is_persistent(self):
        self.headers['content-type'] = 'text/html'
        response = await self.client.head('/media')
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertIsNone(self.cache.stored('follow:1:media:0'))
        self.headers['content-type'] = 'video/mp4'
        response = await self.client.get('/media')
        self.assertEqual(response.content, self.payload)
        self.assertEqual(response.headers['cache-control'], 'private, no-cache')
        await self.client.get('/media')
        self.assertEqual(self.calls, 2)

    async def test_truncated_response_leaves_no_cache_or_temporary_bytes(self):
        self.payload = b"short"
        with self.assertRaises(OSError):
            await self.client.get("/media")
        self.assertIsNone(self.cache.stored("follow:1:media:0"))
        self.assertFalse(list(self.root.rglob("*.tmp*")))

    def test_permanent_bytes_and_refresh_periods(self):
        fetch = mock.Mock(return_value=b"image")
        self.assertEqual(self.cache.bytes("image", fetch), b"image")
        for file in self.root.rglob("*.data"):
            os.utime(file, (0, 0))
        self.assertEqual(RemoteMediaCache(self.root).bytes("image", fetch), b"image")
        fetch.assert_called_once()
        self.assertEqual(AVATAR_REFRESH_SECONDS, 90 * 86400)
        self.assertEqual(FAVICON_REFRESH_SECONDS, 365 * 86400)
        self.assertEqual(self.cache.bytes("image", fetch, ttl=AVATAR_REFRESH_SECONDS), b"image")
        self.assertEqual(fetch.call_count, 2)

    def test_refresh_failure_preserves_existing_bytes(self):
        self.cache.bytes("image", lambda: b"image")
        for file in self.root.rglob("*.data"):
            os.utime(file, (0, 0))
        def fail():
            raise OSError("offline")
        fetch = mock.Mock(side_effect=fail)
        self.assertEqual(self.cache.bytes("image", fetch, ttl=90), b"image")
        self.assertEqual(self.cache.bytes("image", fetch, ttl=90), b"image")
        fetch.assert_called_once()


class PreviewCacheTests(unittest.TestCase):
    def test_new_sources_use_the_short_layout_that_stays_under_max_path(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = RemoteMediaCache(Path(directory).resolve())
            ref = PreviewCache(cache).register('ABP-123', 'https://cdn.example/root.m3u8')
            [saved] = (cache.root / 'p').rglob('*.source.json')
            self.assertEqual(saved.name, f'{ref}.source.json')
            self.assertLess(len(saved.relative_to(cache.root).as_posix()), 100)
            self.assertFalse(cache.folder('preview:ABP-123').exists())
            self.assertEqual(PreviewCache(cache).source('ABP-123', ref)['url'], 'https://cdn.example/root.m3u8')

    def test_saved_sources_keep_reading_from_the_earlier_cache_layout(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = RemoteMediaCache(Path(directory).resolve())
            ref = 'a' * 64
            legacy = cache.folder('preview:ABP-123') / f'{ref}.source.json'
            legacy.parent.mkdir(parents=True)
            legacy.write_text(json.dumps({'url': 'https://cdn.example/root.m3u8', 'playlist': True}))

            self.assertEqual(
                PreviewCache(cache).source('ABP-123', ref),
                {'url': 'https://cdn.example/root.m3u8', 'playlist': True},
            )

    def test_nested_playlists_keys_and_init_segments_are_local_and_persistent(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = RemoteMediaCache(Path(directory).resolve())
            previews = PreviewCache(cache)
            root = previews.register("ABP-123", "https://cdn.example/root.m3u8", identity="root", playlist=True)
            fetch = mock.Mock(return_value=b'\xef\xbb\xbf#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=10\nvideo/list\n')
            body = previews.playlist("ABP-123", root, fetch).decode()
            self.assertNotIn("https://", body)
            child = body.splitlines()[-1].rsplit("/", 1)[-1]
            self.assertTrue(previews.source("ABP-123", child)["playlist"])
            self.assertEqual(previews.source("ABP-123", child)["url"], "https://cdn.example/video/list")
            nested = mock.Mock(return_value=b'#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\npart.ts\n#EXT-X-ENDLIST\n')
            result = previews.playlist("ABP-123", child, nested).decode()
            self.assertNotIn('URI="key.bin"', result)
            self.assertNotIn('URI="init.mp4"', result)
            self.assertNotIn("\npart.ts", result)
            replay = PreviewCache(RemoteMediaCache(Path(directory))).playlist("ABP-123", child, nested)
            self.assertEqual(replay.decode(), result)
            nested.assert_called_once()
            self.assertEqual(previews.register("ABP-123", "https://cdn.example/changed.m3u8", identity="root"), root)
            self.assertEqual(previews.source("ABP-123", root)["url"], "https://cdn.example/changed.m3u8")
            with mock.patch.object(cache, 'bytes', wraps=cache.bytes) as saved:
                self.assertEqual(previews.playlist('ABP-123', root, fetch).decode(), body)
            self.assertEqual(saved.call_count, 1)
            self.assertEqual(fetch.call_count, 2)
            with self.assertRaises(ValueError):
                previews.source("ABP-123", "../private")
            with self.assertRaises(ValueError):
                previews.register("ABP-123", "https://127.0.0.1/a")
            for path in cache.root.rglob("*.source.json"):
                self.assertIn("url", json.loads(path.read_text()))

    def test_signed_playlist_refreshes_and_registers_current_segment_addresses(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = RemoteMediaCache(Path(directory).resolve())
            previews = PreviewCache(cache)
            root = previews.register('EXM-001', 'https://cdn.example/root.m3u8', identity='root')
            def playlist(signature):
                return f'#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\npart.ts?sign={signature}\n#EXT-X-ENDLIST\n'.encode()
            fetch = mock.Mock(side_effect=[playlist('first'), playlist('current')])
            first = previews.playlist('EXM-001', root, fetch)
            for path in cache.root.rglob('*.data'):
                os.utime(path, (0, 0))
            current = previews.playlist('EXM-001', root, fetch)
            self.assertNotEqual(first, current)
            segment = next(line for line in current.decode().splitlines() if line.startswith('/jav-preview/'))
            self.assertTrue(previews.source('EXM-001', segment.rsplit('/', 1)[-1])['url'].endswith('sign=current'))
            self.assertEqual(previews.playlist('EXM-001', root, fetch), current)
            self.assertEqual(fetch.call_count, 2)
