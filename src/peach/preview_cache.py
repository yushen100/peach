"""预览 HLS 的持久清单与媒体分片，浏览器仅取得本机对象 ID。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import m3u8

from .fsutil import atomic_write_text
from .http import public_https_url
from .user_messages import UserValueError

PLAYLIST_REFRESH_SECONDS = 300


def rewrite_hls(body: bytes, url: str, register) -> bytes:
    """用已声明的 m3u8 模型投影全部媒体引用，地址登记策略由消费者提供。"""
    text = body.decode('utf-8-sig')
    if not text.lstrip().startswith('#EXTM3U'):
        raise UserValueError('errors.previewCache.playlistNotFetched')
    playlist = m3u8.loads(text, uri=url)
    if playlist.content_steering:
        raise UserValueError('errors.previewCache.contentSteering')
    nested = [*playlist.playlists, *playlist.iframe_playlists, *playlist.image_playlists, *playlist.media]
    objects = [*playlist.segments, *nested, *playlist.keys, *playlist.session_keys,
               *playlist.session_data, *playlist.segment_map, *playlist.rendition_reports,
               playlist.preload_hint]
    objects += [segment.init_section for segment in playlist.segments if segment.init_section]
    objects += [part for segment in playlist.segments for part in segment.parts]
    seen = set()
    for obj in objects:
        if obj is not None and id(obj) not in seen and getattr(obj, 'uri', None):
            seen.add(id(obj))
            obj.uri = register(urljoin(url, obj.uri), any(obj is row for row in nested))
    return playlist.dumps().encode('utf-8')


class PreviewCache:
    def __init__(self, cache):
        self.cache = cache

    def _source_paths(self, code: str, ref: str) -> tuple[Path, Path]:
        """来源记录的短路径，以及旧版本用过的长路径。

        旧布局是两段 64 位十六进制（番号目录与对象 ID），再加原子写入的临时名，装在 Windows
        较深的安装或数据目录下会超过 MAX_PATH。对外的对象 ID 保持完整，只把私有目录缩短。
        """
        name = ref + ".source.json"
        compact = self.cache.root / "p" / hashlib.sha256(code.encode()).hexdigest()[:16] / name
        legacy = self.cache.folder("preview:" + code) / name
        return compact, legacy

    def register(self, code: str, url: str, *, identity: str = "", playlist: bool | None = None,
                 media_type: str = "") -> str:
        if not public_https_url(url):
            raise UserValueError("errors.previewCache.sourceUnavailable")
        ref = hashlib.sha256((identity or url).encode()).hexdigest()
        path, _legacy = self._source_paths(code, ref)
        value = {"url": url, "playlist": playlist if playlist is not None else urlsplit(url).path.lower().endswith(".m3u8")}
        if media_type == 'video/mp4':
            value['media_type'] = media_type
        try:
            current = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            current = None
        if current != value:
            atomic_write_text(path, json.dumps(value), mode=0o600)
        return ref

    def source(self, code: str, ref: str) -> dict:
        ref = ref.removesuffix(".m3u8")
        if len(ref) != 64 or any(char not in "0123456789abcdef" for char in ref):
            raise UserValueError("errors.previewCache.objectMissing")
        # 升级前登记的来源还在旧布局里，先读新布局，没有再读旧的；新登记一律写新布局。
        compact, legacy = self._source_paths(code, ref)
        try:
            return json.loads(compact.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return json.loads(legacy.read_text(encoding="utf-8"))

    def playlist(self, code: str, ref: str, fetch) -> bytes:
        url = self.source(code, ref)["url"]
        def download():
            body = fetch(url)
            if not body.decode("utf-8").removeprefix(chr(0xFEFF)).lstrip().startswith("#EXTM3U"):
                raise UserValueError("errors.previewCache.manifestNotFetched")
            return body
        generation = hashlib.sha256(url.encode()).hexdigest()
        body = self.cache.bytes(f"preview:{code}:{ref}:playlist:{generation}", download,
                                ttl=PLAYLIST_REFRESH_SECONDS)
        def register(source, nested):
            item = self.register(code, source, playlist=nested)
            return f"/jav-preview/{code}/{item}{'.m3u8' if nested else ''}"
        return rewrite_hls(body, url, register)
