"""远程媒体的本机持久缓存；只安装完整响应，Range 保留自己的范围。"""
from __future__ import annotations

import hashlib
import json
import re
import time
import uuid
from pathlib import Path

from filelock import FileLock, Timeout
from starlette.background import BackgroundTask
from starlette.responses import Response, StreamingResponse

from .fsutil import atomic_path, atomic_write_text
from .streaming import BufferedFileResponse
from .user_messages import UserFacingError, UserOSError, nested_message

AVATAR_REFRESH_SECONDS = 90 * 86400
FAVICON_REFRESH_SECONDS = 365 * 86400
#: 同一段已有下载者时最多等它这么久，过了就直通上游、不落盘。
FETCH_WAIT_SECONDS = 15
#: 缓存目录在落盘前被清理掉时重建目录再试的次数；用完还不行就直通上游、不落盘。
CAPTURE_ATTEMPTS = 3
#: 数据文件装好之后、sidecar 写入前目录被清理时重写 sidecar 的次数。
SIDECAR_ATTEMPTS = 5
MEDIA_HEADERS = ("content-type", "content-length", "content-range", "accept-ranges", "content-encoding")
MEDIA_SECURITY_HEADERS = {
    'content-security-policy': "sandbox; default-src 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
}


def _data_path(slot: Path, metadata: dict) -> Path:
    """sidecar 记下的数据文件；旧版本写的 sidecar 没有 `file`，数据在固定的 `.bin`。"""
    name = metadata.get("file")
    return slot.parent / Path(str(name)).name if name else slot.with_suffix(".bin")


def passive_media_type(value: str) -> bool:
    """代理只返回被动媒体；活动文档和未知类型不能在应用域打开。"""
    if not isinstance(value, str):
        return False
    kind = value.split(';',1)[0].strip().lower()
    return (not kind.endswith(('/svg+xml','+xml','/xml'))
            and (kind.startswith(('image/','video/','audio/'))
                 or kind in ('application/octet-stream','binary/octet-stream',
                             'application/vnd.apple.mpegurl','application/x-mpegurl')))


class RemoteMediaUnavailable(UserFacingError, ValueError):
    """远程媒体这次取不到；带 code，界面按语言显示。"""


def cache_for(contract):
    return RemoteMediaCache(Path(contract.candidate_root) / "remote-media",
                            capacity_guard=getattr(contract, 'capacity_guard', None))


class RemoteMediaCache:
    """身份键不含签名 URL；磁盘命中无需重新解析来源。"""

    def __init__(self, root: Path, *, capacity_guard=None):
        self.root = Path(root)
        self.capacity_guard = capacity_guard

    def _check_capacity(self):
        from .jobs import DiskSpaceDenied
        if self.capacity_guard is not None:
            try:
                self.capacity_guard.check()
            except DiskSpaceDenied as error:
                raise RemoteMediaUnavailable("errors.remoteMediaCache.capacityDenied", {"detail": nested_message(error)}) from error

    def folder(self, key: str) -> Path:
        return self.root / hashlib.sha256(key.encode()).hexdigest()

    def _slot(self, key: str, byte_range: str = "") -> Path:
        name = hashlib.sha256(byte_range.encode()).hexdigest() if byte_range else "full"
        return self.folder(key) / name

    def stored(self, key: str, byte_range: str = ""):
        for slot in dict.fromkeys((self._slot(key), self._slot(key, byte_range))):
            try:
                metadata = json.loads(slot.with_suffix(".json").read_text(encoding="utf-8"))
                path = _data_path(slot, metadata)
                if (passive_media_type(metadata['headers'].get('content-type',''))
                        and path.is_file() and path.stat().st_size == metadata["size"]):
                    return path, metadata
            except (OSError, ValueError, KeyError, TypeError, AttributeError):
                # 元数据被改坏（headers 不是对象）也只算没命中，重新取一份覆盖它。
                continue
        return None

    def response(self, key: str, request, *, headers=None):
        found = self.stored(key, request.headers.get("range", ""))
        if not found:
            return None
        path, metadata = found
        response_headers = {**metadata["headers"], "cache-control": "private, no-cache",
                            **(headers or {}), **MEDIA_SECURITY_HEADERS}
        if metadata["status"] == 200:
            response_headers.pop("content-length", None)
            # 落盘的关注条目照本地片子送：读块走送流自己的线程，断开就停读。
            return BufferedFileResponse(path, media_type=response_headers.pop("content-type", None),
                                        headers=response_headers)
        if request.method == "HEAD":
            return Response(status_code=206, headers=response_headers)
        def body():
            with path.open("rb") as handle:
                while chunk := handle.read(1024 * 1024):
                    yield chunk
        return StreamingResponse(body(), status_code=206, headers=response_headers)

    def stream(self, key: str, request, fetch, *, headers=None):
        """流式写入不等待整片下载；中断、长度不符与错误页不成为缓存命中。"""
        hit = self.response(key, request, headers=headers)
        if hit is not None:
            return hit
        folder = self.folder(key)
        folder.mkdir(parents=True, exist_ok=True)
        # 锁按请求的范围分：同一段同时只放一个下载者，后到的等它落盘后直接命中。原先整个条目
        # 一把锁、持到整段送完，在线播放时拖动或读尾部 moov 的第二个 Range 要排在一整段后面，
        # 等满 120 秒就 502。等不到锁就直通上游，这一次不落盘。
        lock = FileLock(self._slot(key, request.headers.get("range", "")).with_suffix(".lock"),
                        thread_local=False)
        try:
            lock.acquire(timeout=FETCH_WAIT_SECONDS)
            owned = True
        except Timeout:
            owned = False
        upstream = None
        def close():
            if upstream is not None:
                upstream.close()
            if owned:
                lock.release()
        try:
            hit = self.response(key, request, headers=headers)
            if hit is not None:
                close()
                return hit
            self._check_capacity()
            upstream = fetch()
            if not passive_media_type(upstream.headers.get('content-type','')):
                close()
                return Response('unsupported media response type',status_code=502,media_type='text/plain',
                                headers={'cache-control':'no-store',**MEDIA_SECURITY_HEADERS})
            forwarded = {name: upstream.headers[name] for name in MEDIA_HEADERS if name in upstream.headers}
            forwarded.update({'cache-control':'private, no-cache', **(headers or {}), **MEDIA_SECURITY_HEADERS})
            accepted = owned and upstream.status_code in (200,206)
            content_range = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", forwarded.get("content-range", ""))
            if upstream.status_code == 206 and not content_range:
                accepted = False
            byte_range = request.headers.get("range", "") if upstream.status_code == 206 else ""
            complete_range = bool(content_range and int(content_range[1]) == 0
                                  and int(content_range[2]) + 1 == int(content_range[3]))
            if complete_range:
                byte_range = ""
            elif upstream.status_code == 206 and not byte_range:
                accepted = False
            if not accepted:
                forwarded["cache-control"] = "no-store"
            if request.method == "HEAD":
                response = Response(status_code=upstream.status_code, headers=forwarded)
                close()
                return response
            slot = self._slot(key, byte_range)
            def body():
                try:
                    yield from self._capture_response(slot, upstream, forwarded, accepted=accepted,
                        content_range=content_range, complete_range=complete_range)
                finally:
                    close()
            return StreamingResponse(body(), status_code=upstream.status_code, headers=forwarded,
                                     background=BackgroundTask(close))
        except BaseException:
            close()
            raise

    def _capture_response(self, slot, upstream, headers, *, accepted, content_range, complete_range):
        """安装一次完整传输的字节与范围信息，未完成的临时文件由原子写入清除。

        数据文件每次用新名字，sidecar 最后写并记下文件名：读者看到的要么是上一对完整的文件，
        要么是这一对，不会拿新数据配旧长度；也不用替换别的请求正开着的数据文件。还没读上游
        一个字节时缓存目录被清理掉，重建再试，一直不行就直通上游、不落盘。
        """
        if not accepted:
            yield from upstream.iter_raw()
            return
        data = slot.with_name(f"{slot.name}-{uuid.uuid4().hex[:16]}.bin")
        for _attempt in range(CAPTURE_ATTEMPTS):
            started = False
            try:
                with atomic_path(data) as temporary:
                    with temporary.open("wb") as handle:
                        started = True
                        size = 0
                        for chunk in upstream.iter_raw():
                            self._check_capacity()
                            handle.write(chunk)
                            size += len(chunk)
                            yield chunk
                    expected = int(headers.get("content-length", size))
                    if not size or size != expected or (content_range and
                            size != int(content_range[2]) - int(content_range[1]) + 1):
                        raise UserOSError("errors.remoteMediaCache.incompleteResponse")
                break
            except FileNotFoundError:
                # 读过上游之后目录才没的，重放会重复已送出的字节，照原样报出。
                if started:
                    raise
        else:
            yield from upstream.iter_raw()
            return
        sidecar = slot.with_suffix(".json")
        try:
            previous = _data_path(slot, json.loads(sidecar.read_text(encoding="utf-8")))
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            previous = None
        metadata = json.dumps({
            "file": data.name, "status": 200 if complete_range else upstream.status_code, "size": size, "headers": {
                name: value for name, value in headers.items() if name in MEDIA_HEADERS
                and not (complete_range and name == "content-range")},
        })
        for _attempt in range(SIDECAR_ATTEMPTS):
            try:
                slot.parent.mkdir(parents=True, exist_ok=True)
                atomic_write_text(sidecar, metadata, mode=0o600)
                break
            except FileNotFoundError:
                continue
        else:
            # 目录连同刚装好的数据一起被清掉了：这次只是没缓存上，响应已经完整送出。
            return
        if previous is not None and previous != data:
            # 上一份数据可能还被别的请求读着（Windows 上删不掉），留给缓存清理。
            try:
                previous.unlink(missing_ok=True)
            except OSError:
                pass

    def stored_bytes(self, key: str) -> bytes | None:
        """读取已完整安装的图片字节，未命中时由调用方决定来源读取。"""
        path = self._slot(key).with_suffix('.data')
        return path.read_bytes() if path.is_file() and path.stat().st_size > 0 else None

    def bytes(self, key: str, fetch, *, ttl: int | None = None, on_stale=None) -> bytes:
        """图片与清单复用原子文件及跨进程锁；on_stale 登记过期副本的后续刷新。"""
        path = self._slot(key).with_suffix(".data")
        failed = path.with_suffix(".failed")
        def fresh():
            return path.is_file() and path.stat().st_size > 0 and (ttl is None or time.time() - path.stat().st_mtime < ttl)
        if fresh():
            return path.read_bytes()
        if on_stale is not None and path.is_file() and path.stat().st_size > 0:
            on_stale()
            return path.read_bytes()
        path.parent.mkdir(parents=True, exist_ok=True)
        with FileLock(path.with_suffix(".lock")):
            if fresh():
                return path.read_bytes()
            if failed.is_file() and time.time() - failed.stat().st_mtime < 3600:
                if path.is_file():
                    return path.read_bytes()
                raise RemoteMediaUnavailable("errors.remoteMediaCache.unavailable")
            self._check_capacity()
            try:
                data = fetch()
                if not data:
                    raise RemoteMediaUnavailable("errors.remoteMediaCache.unavailable")
            except Exception:
                failed.write_bytes(b"")
                if path.is_file():
                    return path.read_bytes()
                raise
            self._check_capacity()
            with atomic_path(path) as temporary:
                temporary.write_bytes(data)
            failed.unlink(missing_ok=True)
            return data
