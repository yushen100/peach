"""关注媒体的播放代理；Rule34Video 与 Iwara 的短效地址按需解析。"""
from __future__ import annotations

import html
import json
import logging
import math
import re
import threading
import time
import urllib.parse
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Callable, Mapping

import httpx

from . import follow_providers
from .follow_sources import USER_AGENT, IwaraConnector, archive_file_url, fallback_media_items
from .follow import FollowSourceError
from .follow_secrets import Credential
from .follow_store import FollowItemRow
from .http import HttpRequest, HttpResponse, HttpTransport, HttpxTransport, public_https_url, resolves_publicly
from .fsutil import atomic_write_text
from .user_messages import UserFacingError

LOGGER = logging.getLogger(__name__)

class FollowMediaUnavailable(UserFacingError, RuntimeError):
    """条目没有可播媒体；`status_code` 是上游的状态码（没有就是 None），不是给接口用的状态码。"""

    def __init__(self, code: str, params: Mapping[str, object] | None = None, *,
                 status_code: int | None = None):
        super().__init__(code, params)
        self.status_code = status_code


class FollowProxyError(RuntimeError):
    """上游存在但这一次代理不成立：状态码不对、重定向出界或传输失败。

    与 `FollowMediaUnavailable` 分开是因为两者的对外语义不同：条目本身没有可播
    媒体是 404，上游这一次没给出可转发的响应是 502。
    """

    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class ResolvedFollowMedia:
    url: str
    referer: str | None = None
    headers: Mapping[str, str] | None = None
    #: (高度, URL) 按播放优先级排列；Iwara 的 Source 原画可以没有已知高度。
    #: 没有多档的来源留空，播放器据此只显示「原画」。
    qualities: tuple[tuple[int, str], ...] = ()
    #: 这条媒体允许落到哪些主机后缀。解析时已经按它校验过 `url`，代理层跟重定向
    #: 时还要再按它校验每一跳：`headers` 里可能带 Cookie / Bearer token，一旦上游
    #: 把我们指到别的主机，那些凭据就跟着送出去了。空表示不允许代理。
    allowed_hosts: tuple[str, ...] = ()
    #: 允许落到任意公网主机。给帖子里贴的第三方图床用：图站有几十家，白名单追不上；
    #: 这类媒体不带凭据取，跳到哪个公网主机都泄露不了什么，所以它与 `headers` 互斥。
    #: 边界由 `http.public_https_url` 与 `http.resolves_publicly` 守：明文、IP 字面量、
    #: 本机与局域网名字、解析到内网地址的主机仍然拒收。
    public_hosts: bool = False

    def __post_init__(self) -> None:
        if self.public_hosts and self.headers:
            raise ValueError("media with credentials cannot allow arbitrary public hosts")


#: 媒体代理允许的主机，投影自 follow_providers；不在表里的 provider 一律拒绝。
_PROVIDER_HOSTS = follow_providers.hosts()
#: 直链媒体放行任意公网主机的来源，同样投影自 follow_providers。
_PUBLIC_MEDIA_PROVIDERS = follow_providers.public_media_hosts()
#: rule34video 把每一档清晰度写成独立字段：`video_url` 是最低档，
#: `video_alt_url`、`video_alt_url2`、`video_alt_url3` 依次更高。
#: 2026-08-31 实测 video/4564733 给出 360 / 480p / 720p / 1080p 四档；
#: 只解析 `video_url` 的话永远播最低那一档。
_VIDEO_URL_RE = re.compile(r"\bvideo(?:_alt)?_url\d*\s*:\s*'([^']+)'", re.IGNORECASE)
#: 从文件名尾部读分辨率：`4564733_1080p.mp4` → 1080，`4564733_360.mp4` → 360。
_VIDEO_HEIGHT_RE = re.compile(r"_(\d{3,4})p?\.mp4", re.IGNORECASE)


def _video_height(url: str) -> int:
    matched = _VIDEO_HEIGHT_RE.search(urllib.parse.urlsplit(url).path)
    return int(matched.group(1)) if matched else 0


def _pick_quality(resolved: ResolvedFollowMedia, height: int | None) -> ResolvedFollowMedia:
    """按高度挑一档。要的那档不在就保持原样（默认是最高档）。"""
    if not height or not resolved.qualities:
        return resolved
    for level, url in resolved.qualities:
        if level == height:
            return replace(resolved, url=url)
    return resolved

def _allowed(provider: str, url: str) -> bool:
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError:
        return False
    host = (parsed.hostname or "").casefold()
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        return False
    if any(host == suffix or host.endswith("." + suffix)
           for suffix in _PROVIDER_HOSTS.get(provider, ())):
        return True
    return provider in _PUBLIC_MEDIA_PROVIDERS and public_https_url(url)


def proxyable(provider: str, media_url: str | None) -> bool:
    """一条直链媒体能不能经 `/follow-stream` 代理出去。

    界面上的 `playable` 要和这里同一口径：说「可播」却让代理在白名单那一步拒收，
    详情页就只剩一张打不开的图。归档站的存量行先按 `archive_file_url` 修回可取的
    形式再判，与 `resolve()` 的直链分支一致。
    """
    url = archive_file_url(provider, str(media_url or ""))
    return bool(url) and _allowed(provider, url)


class FollowMediaResolver:
    """Resolve stable ledger candidates into short-lived upstream playback URLs."""

    #: 缓存里最多留多少条解析结果。Rule34Video 与 Iwara 的短效地址共用此缓存，
    #: 用户挨个点开就会挨个留下一条；只按 TTL 过期的话，进程活多久它就长多久。
    #: 上限按「一屏反复点开也够用」定，超了先丢已过期的，再丢最早写进来的。
    MAX_CACHE_ENTRIES = 256
    #: 详情页没取到（删片、改版、被拒）后，同一条多久内不再回源。播放器起播时
    #: `/follow-stream`、`/follow-qualities` 和之后的每个 Range 请求都会来问一遍，
    #: 不记住失败，一条坏片就是一串详情页请求。
    MISS_TTL = 120.0
    #: 来源回 403 / 429 后整站暂停回源多久。带 `Retry-After` 就按它，但不超过上限。
    #: 被限流时还照常请求只会延长封禁，卡面 poster 与播放解析都先问这里。
    COOLDOWN = 300.0
    MAX_COOLDOWN = 1800.0
    REFUSED_STATUSES = frozenset({403, 429})

    def __init__(self, transport: HttpTransport, *, ttl: float = 300.0,
                 timeout: float = 20.0, max_bytes: int = 2_000_000,
                 max_cache_entries: int | None = None,
                 clock: Callable[[], float] = time.monotonic,
                 state_root: Path | None = None, wall_clock: Callable[[], float] = time.time):
        self.transport = transport
        self._iwara_transport = (IwaraConnector().transport
                                 if isinstance(transport, HttpxTransport) else transport)
        self.ttl = ttl
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.max_cache_entries = (self.MAX_CACHE_ENTRIES if max_cache_entries is None
                                  else max_cache_entries)
        self.clock = clock
        self._cache: dict[int, tuple[float, ResolvedFollowMedia]] = {}
        self._misses: dict[int, float] = {}
        self._cooldowns: dict[str, float] = {}
        self._item_locks: dict[int, threading.Lock] = {}
        self._lock = threading.Lock()
        self._wall_clock = wall_clock
        self._cooldown_path = Path(state_root) / 'follow-source-cooldowns.json' if state_root is not None else None
        self._restore_cooldowns()

    def _restore_cooldowns(self) -> None:
        if self._cooldown_path is None:
            return
        try:
            state = json.loads(self._cooldown_path.read_text(encoding='utf-8'))
            if not isinstance(state, dict) or any(not isinstance(key, str)
                    or type(value) not in (int, float) or not math.isfinite(value)
                    for key, value in state.items()):
                raise ValueError('invalid source cooldown state')
            now, wall = self.clock(), self._wall_clock()
            self._cooldowns = {key: now + min(value - wall, self.MAX_COOLDOWN)
                               for key, value in state.items() if value > wall}
        except FileNotFoundError:
            return
        except (OSError, ValueError, TypeError):
            LOGGER.warning('follow source cooldown state unavailable at %s', self._cooldown_path,
                           exc_info=True)

    def cooling(self, provider: str) -> float:
        """这个来源还要暂停回源多少秒；0 表示可以请求。"""
        with self._lock:
            return max(0.0, self._cooldowns.get(provider, 0.0) - self.clock())

    def close(self) -> None:
        """关闭解析器自己持有的 Iwara 浏览器传输。"""
        if self._iwara_transport is not self.transport:
            self._iwara_transport.close()

    def fetch(self, provider: str, request: HttpRequest, timeout: float,
              max_bytes: int, *, transport: HttpTransport | None = None) -> HttpResponse:
        """经来源冷却闸门发一次请求；来源回 403 / 429 就让整站进入冷却。

        播放解析与卡面 poster 共用这一道闸：同一个站，一边被限流、另一边还在请求，
        冷却就永远结束不了。
        """
        remaining = self.cooling(provider)
        if remaining:
            raise FollowMediaUnavailable("errors.followStream.coolingDown",
                                         {"provider": provider, "seconds": int(remaining) + 1})
        response = (transport or self.transport)(request, timeout, max_bytes)
        if response.status in self.REFUSED_STATUSES:
            headers = {key.lower(): value for key, value in response.headers.items()}
            try:
                retry_after = float(headers.get("retry-after", ""))
            except ValueError:
                retry_after = None
            seconds = self.pause(provider, retry_after)
            LOGGER.warning("%s refused upstream request with HTTP %s; pausing for %ds",
                           provider, response.status, seconds)
        return response

    def pause(self, provider: str, retry_after: float | None = None) -> float:
        """让来源进入冷却并返回冷却秒数；没给 `retry_after` 就按默认时长。

        后台检查被限流时也记到这里：浏览与检查打的是同一个站，冷却只能有一份。
        """
        seconds = (self.COOLDOWN if retry_after is None
                   else min(max(retry_after, 1.0), self.MAX_COOLDOWN))
        with self._lock:
            self._cooldowns[provider] = max(self._cooldowns.get(provider, 0.0),
                                            self.clock() + seconds)
            if self._cooldown_path is not None:
                now, wall = self.clock(), self._wall_clock()
                state = {key: wall + value - now for key, value in self._cooldowns.items() if value > now}
                atomic_write_text(self._cooldown_path, json.dumps(state) + '\n')
        return seconds

    def _item_lock(self, item_id: int) -> threading.Lock:
        """同一条的解析排队：并发进来的请求只让第一个回源，其余等它写进缓存。"""
        with self._lock:
            lock = self._item_locks.get(item_id)
            if lock is None:
                if len(self._item_locks) >= self.max_cache_entries:
                    for key, tracked in list(self._item_locks.items()):
                        if not tracked.locked():
                            del self._item_locks[key]
                lock = self._item_locks[item_id] = threading.Lock()
            return lock

    def _cached(self, item_id: int) -> ResolvedFollowMedia | None:
        """缓存命中返回结果；近期失败过直接抛出，不再回源。调用方持有 `_lock`。"""
        now = self.clock()
        cached = self._cache.get(item_id)
        if cached and cached[0] > now:
            return cached[1]
        missed = self._misses.get(item_id)
        if missed is not None:
            if missed > now:
                raise FollowMediaUnavailable("errors.followStream.recentMiss")
            del self._misses[item_id]
        return None

    def _remember_miss(self, item_id: int) -> None:
        with self._lock:
            now = self.clock()
            for key, expiry in list(self._misses.items()):
                if expiry <= now:
                    del self._misses[key]
            while self._misses and len(self._misses) >= self.max_cache_entries:
                self._misses.pop(next(iter(self._misses)))
            self._misses[item_id] = now + self.MISS_TTL

    def _remember(self, item_id: int, resolved: ResolvedFollowMedia) -> None:
        """写入缓存并保持有界。调用方持有 `_lock`。"""
        now = self.clock()
        for key, (expiry, _) in list(self._cache.items()):
            if expiry <= now:
                del self._cache[key]
        self._cache.pop(item_id, None)
        while self._cache and len(self._cache) >= self.max_cache_entries:
            self._cache.pop(next(iter(self._cache)))
        self._cache[item_id] = (now + self.ttl, resolved)

    def with_credential_loader(
            self, loader: Callable[[str], Credential | None]) -> "FollowMediaResolver":
        self._credential_loader = loader
        return self

    def _resolve_listed(self, item: FollowItemRow, media_items: list,
                        media_index: int | None) -> ResolvedFollowMedia:
        """媒体清单里的第 N 张：按它自己的 `resource_provider` 挑白名单与请求头。"""
        index = 0 if media_index is None else media_index
        if index < 0 or index >= len(media_items):
            raise FollowMediaUnavailable("errors.followStream.noSuchMedia")
        media = media_items[index]
        if not isinstance(media, dict):
            raise FollowMediaUnavailable("errors.followStream.badMediaEntry")
        url = str(media.get("url") or "")
        resource_provider = str(media.get("resource_provider") or "")
        if resource_provider == "gofile":
            if not _allowed_resource(url, ("gofile.io",)):
                raise FollowMediaUnavailable("errors.followStream.gofileUntrustedUrl")
            loader = getattr(self, "_credential_loader", None)
            credential = loader("gofile") if loader else None
            token = str(credential.values.get("api_token") or "") if credential else ""
            if not token:
                raise FollowMediaUnavailable("errors.followStream.gofileTokenMissing")
            return ResolvedFollowMedia(
                url, item.url, {"Authorization": f"Bearer {token}"},
                allowed_hosts=("gofile.io",))
        if resource_provider == "fanbox":
            # 正文图在 downloads.fanbox.cc；封面在 pixiv.pximg.net——pixiv 官方
            # CDN，fanbox 封面都从它出，与 fanbox.cc 同属一个运营方。
            if not _allowed_resource(url, ("fanbox.cc", "pixiv.pximg.net")):
                raise FollowMediaUnavailable("errors.followStream.fanboxUntrustedUrl")
            return ResolvedFollowMedia(url, item.url,
                                       allowed_hosts=("fanbox.cc", "pixiv.pximg.net"))
        if resource_provider == "f95zone":
            if not _allowed_resource(url, ("attachments.f95zone.to",)):
                raise FollowMediaUnavailable("errors.followStream.f95UntrustedUrl")
            loader = getattr(self, "_credential_loader", None)
            credential = loader("f95zone") if loader else None
            cookie = str(credential.values.get("cookie") or "") if credential else ""
            if item.metadata.get("media_needs_credential") and not cookie:
                raise FollowMediaUnavailable("errors.followStream.f95NeedsSession")
            return ResolvedFollowMedia(
                url, item.url, {"Cookie": cookie} if cookie else None,
                allowed_hosts=("attachments.f95zone.to",))
        if resource_provider and resource_provider == item.provider \
                and (_PROVIDER_HOSTS.get(item.provider) or item.provider in _PUBLIC_MEDIA_PROVIDERS):
            # 归档站（kemono、coomer、pawchive）帖子的附件清单：媒体就在条目自己的
            # 站上，按该来源的主机白名单放行，与 `resolve` 的直链分支同一口径。
            # SimpCity 楼层图在第三方图床上，按来源的公网图床规则放行，同样不带凭据。
            if not _allowed(item.provider, url):
                raise FollowMediaUnavailable("errors.followStream.mediaUrlUnavailable")
            return ResolvedFollowMedia(
                url, item.url, allowed_hosts=tuple(_PROVIDER_HOSTS.get(item.provider, ())),
                public_hosts=item.provider in _PUBLIC_MEDIA_PROVIDERS)
        raise FollowMediaUnavailable("errors.followStream.unsupportedProvider")

    def resolve(self, item: FollowItemRow, media_index: int | None = None,
                height: int | None = None) -> ResolvedFollowMedia:
        """解析可播地址。`height` 指定 Rule34Video 或 Iwara 的清晰度；
        要的那档不存在就退回默认（最高档），不报错——签名 URL 会过期，
        为一次选档失败中断播放不值得。"""
        media_items = item.metadata.get("media_items")
        if item.provider == "iwara":
            with self._item_lock(item.id):
                with self._lock:
                    cached = self._cached(item.id)
                if cached:
                    return _pick_quality(cached, height)
                return _pick_quality(self._fetch_iwara(item), height)
        if not isinstance(media_items, list) or not media_items:
            media_items = fallback_media_items(item.provider, item.metadata)
        if isinstance(media_items, list) and media_items:
            return self._resolve_listed(item, media_items, media_index)
        if item.metadata.get("media_needs_credential"):
            raise FollowMediaUnavailable("errors.followStream.needsSession")
        if item.provider != "rule34video":
            # 归档站的存量行按旧规则拼过 URL（少 /data 前缀、主机也不对），
            # 在这里修回可取的形式；`_allowed` 按后缀匹配，file./n1. 这些子域
            # 仍在原站的白名单内，安全边界没有放宽。
            media_url = archive_file_url(item.provider, str(item.media_url or ""))
            if not media_url or not _allowed(item.provider, media_url):
                raise FollowMediaUnavailable("errors.followStream.mediaUrlUnavailable")
            return ResolvedFollowMedia(
                media_url, item.url,
                allowed_hosts=tuple(_PROVIDER_HOSTS.get(item.provider, ())),
                public_hosts=item.provider in _PUBLIC_MEDIA_PROVIDERS)

        with self._lock:
            cached = self._cached(item.id)
        if cached:
            return _pick_quality(cached, height)
        if not item.url or not _allowed(item.provider, item.url):
            raise FollowMediaUnavailable("errors.followStream.rule34videoDetailUrlUnavailable")
        with self._item_lock(item.id):
            # 排队期间前一个请求可能已经写好缓存或记下失败，先看一眼再决定回不回源。
            with self._lock:
                cached = self._cached(item.id)
            if cached:
                return _pick_quality(cached, height)
            return _pick_quality(self._fetch_rule34video(item), height)

    def _fetch_iwara(self, item: FollowItemRow) -> ResolvedFollowMedia:
        """Iwara 的短效地址只进播放缓存，访问令牌只交给固定 API。"""
        if not item.url or not _allowed("iwara", item.url):
            raise FollowMediaUnavailable("errors.followStream.iwaraUrlUnavailable")
        loader = getattr(self, "_credential_loader", None)
        credential = loader("iwara") if loader else None

        def transport(request, timeout, max_bytes):
            return self.fetch("iwara", request, timeout, max_bytes,
                              transport=self._iwara_transport)

        connector = IwaraConnector(transport=transport, credential=credential,
                                    timeout=self.timeout, max_bytes=self.max_bytes)
        try:
            qualities = connector.playback_formats(item.external_id)
        except FollowSourceError as exc:
            self._remember_miss(item.id)
            raise FollowMediaUnavailable("errors.followStream.sourceFailed", {"reason": str(exc)}) from exc
        resolved = ResolvedFollowMedia(qualities[0][1], item.url, qualities=qualities,
                                       allowed_hosts=("iwara.tv",))
        with self._lock:
            self._remember(item.id, resolved)
        return resolved

    def _fetch_rule34video(self, item: FollowItemRow) -> ResolvedFollowMedia:
        """抓一次详情页，解析出各档正片地址并写进缓存；没取到记一次失败。"""
        response = self.fetch(
            item.provider,
            HttpRequest("GET", item.url, {"User-Agent": USER_AGENT,
                                           "Accept": "text/html"}),
            self.timeout, self.max_bytes,
        )
        if response.status != 200 or len(response.body) > self.max_bytes:
            LOGGER.warning("rule34video detail page for follow item %s unavailable: HTTP %s",
                           item.id, response.status)
            self._remember_miss(item.id)
            raise FollowMediaUnavailable("errors.followStream.rule34videoDetailNotFetched",
                                         status_code=response.status)
        text = response.body.decode("utf-8", errors="replace")
        found: list[str] = []
        for matched in _VIDEO_URL_RE.finditer(text):
            candidate = html.unescape(matched.group(1)).replace("\\/", "/")
            if candidate not in found and _allowed(item.provider, candidate):
                found.append(candidate)
        if not found:
            LOGGER.warning("rule34video detail page for follow item %s has no video url", item.id)
            self._remember_miss(item.id)
            raise FollowMediaUnavailable("errors.followStream.rule34videoVideoUrlNotFetched")
        # 高清优先：默认播最高一档，其余作为可选清晰度交给播放器。认不出分辨率的
        # 排在最后但不丢——签名 URL 每次都变，丢了就没有回退。
        ordered = sorted(found, key=_video_height, reverse=True)
        resolved = ResolvedFollowMedia(
            ordered[0], item.url,
            qualities=tuple((_video_height(url), url) for url in ordered),
            allowed_hosts=tuple(_PROVIDER_HOSTS.get(item.provider, ())))
        with self._lock:
            self._remember(item.id, resolved)
        return resolved


def _allowed_resource(url: str, hosts: tuple[str, ...]) -> bool:
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError:
        return False
    host = (parsed.hostname or "").casefold()
    return (parsed.scheme == "https" and not parsed.username and not parsed.password
            and any(host == suffix or host.endswith("." + suffix) for suffix in hosts))


def _hop_allowed(target: ResolvedFollowMedia, url: str) -> bool:
    """代理的每一跳（含第一跳）都过这一关：白名单主机直接放行；公网模式还要域名字面
    像公网、解析出来也全是公网地址。解析放在连接前而不是解析时，是因为存量行的
    地址可能躺了几个月，域名早已换主。"""
    if _allowed_resource(url, tuple(target.allowed_hosts)):
        return True
    if not target.public_hosts or not public_https_url(url):
        return False
    return resolves_publicly(urllib.parse.urlsplit(url).hostname or "")


#: 代理层允许跟几跳重定向。归档站的主域会 302 到实际取文件的节点（2026-08-30 实测
#: kemono → n1.、coomer → n4.），所以必须跟；但每一跳都要重新过白名单。
MAX_PROXY_REDIRECTS = 3
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


def proxy_request_headers(target: ResolvedFollowMedia,
                          incoming: Mapping[str, str]) -> dict[str, str]:
    """代理请求要带的头。只透传范围请求相关的那两个，别的一律由这里决定。"""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": incoming.get("accept") or "*/*",
        "Accept-Encoding": "identity",
    }
    if target.referer:
        headers["Referer"] = target.referer
    headers.update(target.headers or {})
    for name in ("range", "if-range"):
        value = incoming.get(name)
        if value:
            headers[name.title()] = value
    return headers


def open_upstream(client: httpx.Client, method: str, target: ResolvedFollowMedia, *,
                  incoming: Mapping[str, str], allowed=None, accepted_statuses=(),
                  strip_credentials=False) -> httpx.Response:
    """打开上游媒体流；只在拿到可转发的 2xx 时返回。

    这里自己跟重定向而不是交给 client 的 `follow_redirects`：`target.headers` 可能
    带着 Cookie 或 Bearer token，httpx 跟跳时会把请求头一路带过去，上游只要回一个
    指向别处的 Location 就能把凭据换走。所以每一跳都重新过 `target.allowed_hosts`，
    出界直接失败，绝不带着凭据再发一次。

    非 2xx 同样在这里终止：上游的 403 页面、限流提示或错误 JSON 转发给播放器毫无
    用处，只会把上游的状态与正文（可能含主机名、提示语）原样交给浏览器。
    """
    if allowed is None and not target.allowed_hosts and not target.public_hosts:
        raise FollowProxyError("this media has no host allowlist for proxying")
    url = target.url
    headers = proxy_request_headers(target, incoming)
    response: httpx.Response | None = None
    for _ in range(MAX_PROXY_REDIRECTS + 1):
        if not (allowed(url) if allowed is not None else _hop_allowed(target, url)):
            raise FollowProxyError("media URL is outside the proxyable hosts" if url == target.url
                                   else "upstream redirected the media to an untrusted URL")
        request = client.build_request(method, url, headers=headers)
        if strip_credentials:
            for name in ('cookie', 'authorization', 'proxy-authorization'):
                request.headers.pop(name, None)
        response = client.send(request, stream=True, follow_redirects=False)
        if response.status_code not in _REDIRECT_STATUSES:
            break
        location = response.headers.get("location") or ""
        response.close()
        response = None
        url = urllib.parse.urljoin(url, location)
    if response is None:
        raise FollowProxyError("too many upstream redirects")
    if not 200 <= response.status_code < 300 and response.status_code not in accepted_statuses:
        status = response.status_code
        response.close()
        raise FollowProxyError(f"upstream returned HTTP {status}", status_code=status)
    return response
