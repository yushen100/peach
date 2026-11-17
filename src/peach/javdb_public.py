"""JavDB Web UI 的匿名只读协议；作品身份核对、请求预算与有界缓存。"""
from __future__ import annotations

import hashlib
import io
import json
import re
import threading
import time
from collections import OrderedDict
from concurrent.futures import Future, TimeoutError as FutureTimeout
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass
from contextvars import ContextVar
from datetime import date, datetime
from urllib.parse import urlencode, urlsplit

from PIL import Image

from .catalog_rules import normalise_code_key, release_identity, same_release_code
from .coded_text import Said, parallel
from .catalog_vocabulary import RESOURCE_CHINESE_SUBTITLES, RESOURCE_HD
from .http import HttpRequest, HttpxTransport, response_text
from .scripting import HostLimiter
from .user_agent import JAVDB_APP_USER_AGENT
from .jav_cache import DAY, PublicSnapshots, cache_lifetime
from .javdb_identity import RULE, cache_key as identity_cache_key, current_evidence
from .metadata import RelayableError, relay_args
from .user_messages import UserValueError, nested_message

WEB = "https://catembylegacy.fastcdn.dpdns.org"
#: 接口主机按序使用（ADR-0148）。2026-11-05 实测三家对同一作品给出同一份详情，网页签名与 App 签名都收；
#: 镜像每次慢 0.25～0.45 秒，只在前一家冷却时接替。配额按各主机分开处理。
API_HOSTS = ("https://jdforrepam.com", "https://apidd.czssdgz.com", "https://apidd.spthgb.com")
#: 网页前端取不到签名时用的 App 签名材料与请求形态，按实测通过的那一组原样发送。
APP_SIGNATURE = ("lpw6vgqzsp", "71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e"
                 "7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa")
APP_QUERY = {"platform": "android", "app_channel": "official", "app_version": "official",
             "app_version_number": "1.9.35", "system_version": "13", "device_model": "Pixel 6",
             "device_name": "Pixel", "device_uuid": "1d26b2df-f042-5138-90b3-28980fe1d98a"}
APP_HEADERS = {"accept-language": "zh", "User-Agent": JAVDB_APP_USER_AGENT}
PAGE_SIZE = 10
MAX_REVIEW_PAGES = 8
#: 资料请求的主机间隔，由用户 2026-11-05 定为 0.5 秒。同日实测：2 秒逐档降到 0.25 秒各 40 次，
#: 再按 0.5 秒连发 600 次（5 分钟），全部 HTTP 200 且业务成功；更长时间的累计配额未测。
#: 一个接口主机撞上 403/429 时冷却 15 分钟、换下一家，全部冷却才整源停（`_json`）。
API_INTERVAL = 0.5
#: 接口要求登录后，搜索与作品资料这么久内不再问接口，直接读网页；过后再试一次接口。
LOGIN_SECONDS = 6 * 3600
#: 同一键已有请求在途时最多等它多久。在途请求不过停点，最慢是几次 15 秒的接口请求加 30 秒的网页读取，
#: 与快照文件锁的 120 秒同一量级；等满按来源暂不可用处理，不让 Web 请求和别的任务一直挂着。
PENDING_WAIT_SECONDS = 120.0
_UNAVAILABLE = "errors.javdbPublic.unavailable"
_JS_IDENTIFIER = r'[A-Za-z_$][A-Za-z0-9_$]*'
_CACHE_ROOT = ContextVar('jav_public_cache_root', default=None)
_CACHE_READS = ContextVar('jav_public_cache_reads', default=None)


def public_signature_parts(script: str) -> tuple[str, str] | None:
    """从公开请求头的签名计算式读取常量，不执行来源脚本。"""
    calls = set(re.findall(r'\bjdsignature\s*:\s*(' + _JS_IDENTIFIER + r')\s*\(\s*\)', script))
    if len(calls) != 1:
        return None
    recipes = list(re.finditer(
        r'\bfunction\s+' + re.escape(calls.pop()) + r'\s*\(\s*\)\s*\{\s*(?:const|let|var)\s+'
        r'(?P<stamp>' + _JS_IDENTIFIER + r')\s*=\s*Math\.floor\(Date\.now\(\)\s*/\s*'
        r'(?:1e3|1000)\)\.toString\(\)\s*;\s*return\s*'
        r'`\$\{(?P=stamp)\}\.\$\{(?P<middle>' + _JS_IDENTIFIER + r')\}\.'
        r'\$\{' + _JS_IDENTIFIER + r'\(\s*(?P=stamp)\s*\+\s*(?P<suffix>' + _JS_IDENTIFIER + r')\s*\)\}`\s*;?\s*\}',
        script,
    ))
    if len(recipes) != 1:
        return None
    recipe = recipes[0]
    values = []
    for name in (recipe['middle'], recipe['suffix']):
        assignments = re.findall(r'(?<![\w$])' + re.escape(name) + r'\s*=\s*("(?:\\.|[^"\\]){1,512}")\s*[,;]', script)
        if len(assignments) != 1:
            return None
        try:
            value = json.loads(assignments[0])
        except ValueError:
            return None
        if (not isinstance(value, str) or not 1 <= len(value) <= 256
                or any(ord(char) < 32 for char in value)):
            return None
        values.append(value)
    return values[0], values[1]


#: 作品资料当本地资料留存所需的字段：标题、发行日与封面都取到了才算齐。
DURABLE_WORK_FIELDS = ("title", "release_date", "cover_url")


def work_hold(key: str, result, released: str | None, today) -> dict:
    """这份快照留多久：`{'durable': True}` 当本地资料固定，`{'until': 发行日}` 留到发行日再补取一次，空表按缓存规则过期。

    只收作品身份与作品资料：番号认出的作品 id 找到了就不会变；作品资料要字段齐全，发行日当天或之后取得的固定，
    发行前取得的留到发行日（发行前常缺演员、封面会换）。磁链、评论、图片会陆续更新，从不固定。
    """
    if key.startswith("movie-id:"):
        return {"durable": True} if result else {}
    if (not key.startswith("movie:") or not isinstance(result, dict)
            or not all(result.get(name) for name in DURABLE_WORK_FIELDS)):
        return {}
    shown = (released or "")[:10]
    try:
        date.fromisoformat(shown)
    except ValueError:
        return {}
    return {"durable": True} if shown <= today.isoformat() else {"until": shown}


@contextmanager
def public_cache_scope(root):
    """来源快照跟随调用者的数据目录，读取时间与失败状态属于本次请求。"""
    root_token = _CACHE_ROOT.set(root)
    reads = []
    reads_token = _CACHE_READS.set(reads)
    try:
        yield reads
    finally:
        _CACHE_READS.reset(reads_token)
        _CACHE_ROOT.reset(root_token)


def cache_checked_at(prefix, *, exact=False):
    matches = [read['saved'] for read in (_CACHE_READS.get() or [])
               if (read['key'] == prefix if exact else read['key'].startswith(prefix))]
    return min(matches) if matches else None


def cache_failure(key):
    """本次请求里这一键沿用旧快照时记下的那个失败（异常对象），没有就是 `None`。"""
    return next((read['failure'] for read in reversed(_CACHE_READS.get() or [])
                 if (read['key'] == key or read['key'].startswith(key + ':')) and read['failure']), None)


def cache_error(key):
    """同 `cache_failure`，给要一句原文的地方（资料边车记下的失败）：没有就是空串。"""
    failure = cache_failure(key)
    return str(failure) if failure else ''


def _record_read(key, snapshot, failure=None):
    reads = _CACHE_READS.get()
    if reads is not None and snapshot is not None:
        reads.append({'key': key, 'saved': snapshot.saved, 'error': str(failure) if failure else '',
                      'failure': failure})


def public_image_url(value: object) -> bool:
    """公开图片仅取已验证来源主机的 HTTPS 地址。"""
    try:
        parts = urlsplit(str(value or ""))
        return (parts.scheme == "https" and parts.hostname == "tp.spfcas.com"
                and not parts.username and not parts.password and parts.port in (None, 443))
    except ValueError:
        return False


def preview_video_url(movie: dict) -> str:
    """只投影来源作品的公开 HLS 预览入口，不替来源断言播放成功。"""
    value = str(movie.get("preview_video_url") or "")
    try:
        parts = urlsplit(value)
        allowed = (parts.scheme == "https" and parts.hostname == "jdforrepam.com"
                   and not parts.username and not parts.password and parts.port in (None, 443)
                   and not parts.fragment and not any(char.isspace() for char in value)
                   and re.fullmatch(r"/api/v1/movies/ttm3u8/preview/[A-Za-z0-9/_-]+\.m3u8", parts.path))
    except ValueError:
        return ""
    return value if allowed else ""


def magnet_size(value: object) -> str:
    """磁链区的体积是 MiB 整数，写成带单位的文字；其他形态原样保留。"""
    if type(value) in (int, float) and value > 0:
        return f"{value / 1024:.2f}GB" if value >= 1024 else f"{value:g}MB"
    return str(value or "")


class PublicSourceUnavailable(RelayableError, ValueError):
    """公开来源当前未取得。给人看的那句带 code；沿用旧快照时记下的失败照搬它的 code 与参数（`cache_failure`）。"""


class PublicIdentityAmbiguous(PublicSourceUnavailable):
    """同番号有多个来源身份，不能按番号绑定资料或媒体。"""


class PublicNotFound(PublicSourceUnavailable):
    """来源搜索结果里没有这个番号。"""


class PublicSourcePaused(PublicSourceUnavailable):
    """来源冷却期内不发请求。"""


class PublicHostFailed(PublicSourceUnavailable):
    """这一个主机没有答复或答复不可用；同协议的下一个主机可以接替。"""


class PublicLoginRequired(PublicSourceUnavailable):
    """接口要求登录（`JWTVerificationError`）。2026-11-10 起搜索与作品资料匿名都回它，评论与磁链仍答。"""


class PublicBudgetExceeded(PublicSourceUnavailable):
    """本轮匿名资料请求预算已用完。"""


@dataclass
class PublicRequestBudget:
    max_requests: int = 202
    max_bytes: int = 16 * 1024 * 1024
    max_seconds: int = 900
    requests: int = 0
    bytes: int = 0
    started: float = 0
    stop_reason: str = ""
    paused_at_start: float = 0.0
    control: object = None

    def check(self):
        # 用开始计时那一刻的任务控制：取数据时屏蔽了停点（`_settled`），这时再读 CURRENT 是空的。
        control = self.control
        paused = control.paused_seconds - self.paused_at_start if control is not None else 0.0
        for reason, exhausted in (
                ("request_budget", self.requests >= self.max_requests),
                ("byte_budget", self.bytes >= self.max_bytes),
                ("time_budget", time.monotonic() - self.started - paused >= self.max_seconds)):
            if exhausted:
                self.stop_reason = reason
                raise PublicBudgetExceeded("errors.javdbPublic.budgetExceeded")


@contextmanager
def _settled():
    """先过一次停点，之后到退出前任务暂停与馆藏处理暂停都不再响应。

    里面只有带期限的请求（接口 15 秒、网页读取 30 秒），暂停在它们做完后的下一个停点生效。
    """
    from .processing_control import CURRENT as PROCESSING
    from .task_control import committing
    processing = PROCESSING.get()
    if processing is not None:
        processing.checkpoint('work')
    with committing():
        token = PROCESSING.set(None)
        try:
            yield
        finally:
            PROCESSING.reset(token)


def actor_gender(actor: dict) -> str:
    """公开协议的明确性别字段；缺失和未知值保留未知。"""
    value = actor.get("gender")
    if type(value) is int:
        return {0: "female", 1: "male"}.get(value, "unknown")
    return value if value in ("female", "male") else "unknown"


class PublicAPI:
    """匿名资料按发行日期复用；来源请求限速，同键请求合并。"""

    def __init__(self, transport=None, *, clock=time.monotonic, sleeper=time.sleep,
                 cache_root=None, wallclock=time.time):
        self.transport = transport
        self.clock = clock
        self.limiter = HostLimiter({}, default_interval=API_INTERVAL, clock=clock, sleeper=sleeper)
        self.lock = threading.RLock()
        self.cache: OrderedDict[str, tuple[float, object]] = OrderedDict()
        self.cache_root, self.wallclock = cache_root, wallclock
        self.snapshots = {}
        self.failures = {}
        self.pending: dict[str, Future] = {}
        self.image_slots = threading.BoundedSemaphore(3)
        self.source_lock = threading.RLock()
        self.signature_parts: tuple[str, str] | None = None
        self.signature_app = False
        self.signature_until = 0.0
        self.host_paused: dict[str, float] = {}
        self.paused_until = 0.0
        self.image_paused_until = 0.0
        self.request_context = ContextVar("jav_public_request_budget", default=None)
        self.login_until = 0.0
        self.page_context = ContextVar("jav_public_pages", default=None)

    @contextmanager
    def page_reader(self, reader):
        """接口要求登录时，搜索与作品资料由 `reader(path)` 读 javdb.com 网页（`sources.javdb.page_reader`）。

        读取由调用方给：网页带用户的 Cookie、按 javdb.com 的主机间隔与来源冷却走，这些都不在本模块。
        没给读取的调用（刮削那一问）照旧报未取得，由它自己的详情页那条路接手（ADR-0160）。
        """
        token = self.page_context.set(reader)
        try:
            yield
        finally:
            self.page_context.reset(token)

    def _login_walled(self, ask, path, parse):
        """搜索与作品资料：接口答就用接口；要求登录时改读网页，评论与磁链不经这里、照常问接口。

        网页那一站在冷却或本趟预算用完时（`SourcePaused`）交 `PublicSourcePaused`，沿用旧快照、不往外冒。
        """
        from .scraping_access import SourcePaused
        from .sources.base import SourceFailure
        if self.clock() >= self.login_until:
            try:
                return ask()
            except PublicLoginRequired:
                pass
        reader = self.page_context.get()
        if reader is None:
            raise PublicLoginRequired(_UNAVAILABLE)
        try:
            return parse(reader(path))
        except SourcePaused as error:
            raise PublicSourcePaused(*relay_args(error)) from error
        except (OSError, ValueError, TypeError, AttributeError, KeyError, SourceFailure) as error:
            raise PublicSourceUnavailable(_UNAVAILABLE) from error

    @contextmanager
    def request_budget(self, budget: PublicRequestBudget):
        budget.started = time.monotonic()
        from .task_control import CURRENT
        control = budget.control = CURRENT.get()
        budget.paused_at_start = control.paused_seconds if control is not None else 0.0
        token = self.request_context.set(budget)
        try:
            yield budget
        finally:
            self.request_context.reset(token)

    def _pause(self, delay, *, image=False, host=None):
        until = self.clock() + delay
        if image:
            self.image_paused_until = until
        elif host:
            self.host_paused[host] = until
            if host in API_HOSTS and all(self.host_paused.get(name, 0.0) > self.clock() for name in API_HOSTS):
                self.paused_until = min(self.host_paused[name] for name in API_HOSTS)
        else:
            self.paused_until = until

    def _get(self, url: str, *, signed=False, limit=2 * 1024 * 1024, image=False, host=None):
        """`host` 给出时失败只冷却这个主机，抛 `PublicHostFailed` 交调用方换下一家。"""
        failed = PublicHostFailed if host else PublicSourceUnavailable
        paused = self.image_paused_until if image else self.paused_until
        if self.clock() < paused:
            raise PublicSourcePaused("errors.javdbPublic.imageSourcePaused" if image
                                     else "errors.javdbPublic.sourcePaused")
        if not image:
            self.limiter.wait(url)
        budget = self.request_context.get()
        if budget:
            budget.check()
            limit = min(limit, budget.max_bytes - budget.bytes)
        headers = {"Accept": "application/json" if signed else "*/*"}
        if signed:
            stamp = str(int(time.time()))
            middle, suffix = self._signature()
            digest = hashlib.md5((stamp + suffix).encode(), usedforsecurity=False).hexdigest()
            headers["jdsignature"] = f"{stamp}.{middle}.{digest}"
            if self.signature_app:
                headers.update(APP_HEADERS)
        if self.transport is None:
            self.transport = HttpxTransport()
        try:
            if budget:
                budget.requests += 1
            response = self.transport(HttpRequest("GET", url, headers), 15, limit)
        except Exception as error:
            self._pause(60, image=image, host=host)
            raise failed(_UNAVAILABLE) from error
        if budget:
            budget.bytes += len(response.body)
        if response.status != 200:
            self._pause(900 if response.status in (403, 429) else 60, image=image, host=host)
            raise failed("errors.javdbPublic.sourcePaused")
        return response

    def _signature(self) -> tuple[str, str]:
        if self.signature_parts and self.clock() < self.signature_until:
            return self.signature_parts
        try:
            parts = self._web_signature()
        except PublicHostFailed:
            parts = None
        if parts is None:
            # 网页前端取不到签名时用 App 那一套，一小时后再回头读网页前端。
            self.signature_parts, self.signature_app = APP_SIGNATURE, True
            self.signature_until = self.clock() + 3600
        else:
            self.signature_parts, self.signature_app = parts, False
            self.signature_until = self.clock() + 24 * 3600
        return self.signature_parts

    def _web_signature(self) -> tuple[str, str] | None:
        if self.host_paused.get(WEB, 0.0) > self.clock():
            return None
        html = response_text(self._get(WEB + "/", host=WEB))
        entry = re.search(r'src="(/assets/index-[A-Za-z0-9_-]+\.js)"', html)
        parts = entry and public_signature_parts(response_text(self._get(WEB + entry[1], host=WEB)))
        if not parts:
            self._pause(60, host=WEB)
        return parts or None

    def _json(self, path: str, query=None) -> dict:
        # 签名材料取齐后再领取 API 主机间隔，首个签名请求不占用两次间隔。
        self._signature()
        if self.signature_app:
            query = {**APP_QUERY, **(query or {})}
        tail = "/api" + path + ("?" + urlencode(query) if query else "")
        attempted = False
        for host in API_HOSTS:
            if self.host_paused.get(host, 0.0) > self.clock():
                continue
            attempted = True
            try:
                response = self._get(host + tail, signed=True, host=host)
            except PublicHostFailed:
                continue
            try:
                payload = json.loads(response.body)
                break
            except (ValueError, UnicodeError):
                # 被劫持或改版的主机会回 200 的网页，换下一家。
                self._pause(60, host=host)
        else:
            if attempted:
                raise PublicSourceUnavailable("errors.javdbPublic.sourcePaused")
            raise PublicSourcePaused("errors.javdbPublic.sourcePaused")
        if isinstance(payload, dict) and payload.get("action") == "JWTVerificationError":
            # 只停搜索与作品资料：评论与磁链端点匿名仍答，不能跟着整源冷却。
            self.login_until = self.clock() + LOGIN_SECONDS
            raise PublicLoginRequired(_UNAVAILABLE)
        if not isinstance(payload, dict) or payload.get("success") != 1:
            self.paused_until = self.clock() + 60
            raise PublicSourceUnavailable(_UNAVAILABLE)
        data = payload.get("data")
        if not isinstance(data, dict):
            self.paused_until = self.clock() + 60
            raise PublicSourceUnavailable("errors.javdbPublic.unrecognizedFormat")
        return data

    def _store(self):
        root = self.cache_root() if callable(self.cache_root) else self.cache_root
        return PublicSnapshots(root, clock=self.wallclock)

    def _cache_key(self, key):
        root = self._store().root
        key = identity_cache_key(key)
        return f'{root.resolve()}\0{key}' if root is not None else key

    def _memory(self, cache_key, *, image, refresh):
        """持有缓存锁时读取内存命中或失败冷却，返回内容及实际来源状态。"""
        hit = self.cache.get(cache_key)
        snapshot = self.snapshots.get(cache_key)
        failed = self.failures.get(cache_key)
        cooling = failed is not None and failed[0] > self.clock()
        error = failed[1] if cooling else None
        if (not refresh and hit and hit[0] > self.clock()
                and (image or (snapshot is not None and snapshot.fresh(self.wallclock())))):
            self.cache.move_to_end(cache_key)
            return hit[1], snapshot, error
        if cooling:
            if snapshot is not None:
                return snapshot.value, snapshot, error
            raise failed[1]
        return None

    def _cached(self, key, fetch, *, released=None, refresh=False):
        cache_key = self._cache_key(key)
        image = key.startswith('image:')
        found, result = self._remembered(key, cache_key, image=image, refresh=refresh)
        if found:
            return result
        # 下面要占住同键的在途 Future、来源锁或图片名额。暂停只在这里响应：锁内的请求停在
        # 暂停点上，别的任务和 Web 请求就会陪着它一直等到用户点继续。
        with _settled():
            return self._load(key, cache_key, image, fetch, released=released, refresh=refresh)

    def _remembered(self, key, cache_key, *, image, refresh):
        with self.lock:
            memory = self._memory(cache_key, image=image, refresh=refresh)
        if memory is None:
            return False, None
        result, snapshot, error = memory
        _record_read(key, snapshot, error)
        return True, result

    def _load(self, key, cache_key, image, fetch, *, released, refresh):
        store = self._store()
        with self.lock:
            found, result = self._remembered(key, cache_key, image=image, refresh=refresh)
            if found:
                return result
            snapshot = self.snapshots.get(cache_key)
            future = self.pending.get(cache_key)
            owner = future is None
            if owner:
                future = self.pending[cache_key] = Future()
        if not owner:
            try:
                result = future.result(timeout=PENDING_WAIT_SECONDS)
            except FutureTimeout:
                raise PublicSourceUnavailable(_UNAVAILABLE) from None
            failed = self.failures.get(cache_key)
            _record_read(key, self.snapshots.get(cache_key), failed[1] if failed else None)
            return result
        stored_key = identity_cache_key(key)
        previous = snapshot if snapshot is not None else None if image else store.load(stored_key)
        try:
            with nullcontext() if image else store.acquire(stored_key):
                disk = None if image else store.load(stored_key)
                if disk is not None and disk.fresh(self.wallclock()) and (
                        not refresh or (previous is not None and disk.revision != previous.revision)):
                    snapshot = self._remember(key, disk.value, snapshot=disk)
                    result = disk.value
                else:
                    previous = disk or previous
                    with nullcontext() if image else self.source_lock:
                        result = fetch()
                    snapshot = self._remember(key, result, released=released)
            future.set_result(result)
            _record_read(key, snapshot)
            return result
        except PublicSourceUnavailable as error:
            if isinstance(error, PublicBudgetExceeded):
                future.set_exception(error)
                raise
            if previous is not None:
                self._remember(key, previous.value, snapshot=previous)
            if not isinstance(error, PublicLoginRequired):
                # 没给网页读取的那一问不记失败：同一部片接着由带读取的调用（库外详情）来问时仍要去读网页。
                with self.lock:
                    self.failures[cache_key] = (self.clock() + 900, error)
            if previous is not None:
                future.set_result(previous.value)
                _record_read(key, previous, error)
                return previous.value
            future.set_exception(error)
            raise
        except BaseException as error:
            future.set_exception(error)
            raise
        finally:
            with self.lock:
                self.pending.pop(cache_key, None)

    def _remember(self, key, result, *, released=None, snapshot=None):
        image = key.startswith('image:')
        cache_key = self._cache_key(key)
        if not image and snapshot is None:
            if isinstance(result, dict):
                released = result.get('release_date') or released
            released = released if isinstance(released, str) else None
            today = datetime.fromtimestamp(self.wallclock()).date()
            snapshot = self._store().save(identity_cache_key(key), result, released,
                                          **work_hold(key, result, released, today))
        lifetime = 6 * 3600 if image else None if snapshot.durable else cache_lifetime(
            snapshot.released, datetime.fromtimestamp(self.wallclock()).date())
        remaining = lifetime if image else None if lifetime is None else max(0, snapshot.saved + lifetime - self.wallclock())
        with self.lock:
            self.cache[cache_key] = (float('inf') if remaining is None else self.clock() + remaining, result)
            if snapshot is not None:
                self.snapshots[cache_key] = snapshot
            self.failures.pop(cache_key, None)
            self.cache.move_to_end(cache_key)
            while len(self.cache) > 128:
                removed, _ = self.cache.popitem(last=False)
                self.snapshots.pop(removed, None)
                self.failures.pop(removed, None)
        return snapshot

    def movie(self, code: str, *, refresh=False, source_id=None) -> dict:
        """番号对应的来源作品。来源去掉 MGS 的数字前缀（`259LUXU-891` 记作 `LUXU-891`），
        搜索词与身份核对都按 `release_identity` 认同一部作品。"""
        from .sources.javdb import page_search_rows
        canonical = normalise_code_key(code)
        matches = []

        def identify():
            nonlocal matches
            product = re.fullmatch(r'FC2-PPV-(\d+)', canonical)
            query = product[1] if product else release_identity(canonical) or canonical
            rows = self._login_walled(
                lambda: self._rows("/v2/search", "movies", {"q": query, "type": "movie", "page": 1}),
                "/search?" + urlencode({"q": query, "f": "all"}), page_search_rows)
            matches = [row for row in rows if isinstance(row, dict)
                       and same_release_code(canonical, row.get("number"))]
            if not matches:
                raise PublicNotFound("errors.javdbPublic.notFound")
            if any(not isinstance(row.get('id'), str)
                   or not re.fullmatch(r'[A-Za-z0-9]+', row['id']) for row in matches):
                raise PublicSourceUnavailable("errors.javdbPublic.notFound")
            return list(dict.fromkeys(row['id'] for row in matches))

        if source_id is None:
            identities = self._cached("movie-id:" + canonical, identify, refresh=refresh)
            if len(identities) == 2:
                # 旧快照保存的是 ID 列表；补取搜索原题后仍须核对两份详情。
                if not matches:
                    identities = identify()
                    self._remember('movie-id:' + canonical, identities)
                resolved = self._regular_edition(canonical, identities, matches, refresh=refresh)
                if resolved is not None:
                    self._remember('movie-id:' + canonical, [resolved['id']])
                    return resolved
            if len(identities) != 1:
                raise PublicIdentityAmbiguous("errors.javdbPublic.identityAmbiguous",
                                              {"identities": list(identities)})
            movie_id = identities[0]
        elif isinstance(source_id, str) and re.fullmatch(r'[A-Za-z0-9]+', source_id):
            movie_id = source_id
        else:
            raise PublicSourceUnavailable("errors.javdbPublic.identityMismatch")

        return self._movie(canonical, movie_id, refresh=refresh)

    def _regular_edition(self, canonical, identities, matches, *, refresh):
        from .javdb_identity import fanza_regular_id
        rows = list({row['id']: row for row in matches}.values())
        regular = fanza_regular_id(rows)
        if regular is None or set(identities) != {row['id'] for row in rows}:
            return None
        movies = [self._movie(canonical, identity, refresh=refresh) for identity in identities]
        if fanza_regular_id(movies) != regular:
            return None
        performers = [{actor['id'] for actor in movie.get('actors') or []
                       if isinstance(actor, dict) and isinstance(actor.get('id'), str)
                       and actor_gender(actor) == 'female'} for movie in movies]
        duration = movies[0].get('duration')
        if (not performers[0] or performers[0] != performers[1]
                or type(duration) is not int or duration <= 0 or movies[1].get('duration') != duration):
            return None
        series = [movie.get('series_id') for movie in movies]
        if all(series) and series[0] != series[1]:
            return None
        return next(movie for movie in movies if movie['id'] == regular)

    def _movie(self, canonical, movie_id, *, refresh):

        from .sources.javdb import page_movie

        def fetch():
            movie = self._login_walled(lambda: self._json("/v4/movies/" + movie_id).get("movie"),
                                       f"/v/{movie_id}?locale=zh", lambda text: page_movie(text, movie_id))
            if (not isinstance(movie, dict) or not same_release_code(canonical, movie.get("number"))
                    or movie.get("id") != movie_id):
                raise PublicSourceUnavailable("errors.javdbPublic.identityMismatch")
            return {**movie, 'javdb_rule': RULE}

        return self._cached(f"movie:{canonical}:{movie_id}", fetch, refresh=refresh)

    def remember_movie_identity(self, code: str, source: dict):
        """已取得的编目身份可复用，完整资料仍须通过来源的身份核对。"""
        canonical = normalise_code_key(code)
        identity = source.get("id")
        if (not current_evidence(source) or not isinstance(identity, str)
                or not same_release_code(canonical, source.get("number"))
                or not re.fullmatch(r"[A-Za-z0-9]+", identity)):
            return
        key = 'movie-id:' + canonical
        with self.lock:
            # 已观察到的唯一身份或歧义不被较旧的发现边车反向覆盖。
            if self._cache_key(key) in self.cache:
                return
            stored = self._store().load(identity_cache_key(key))
            if stored:
                self._remember(key, stored.value, snapshot=stored)
            else:
                self._remember(key, [identity])

    def _rows(self, path, key, query=None):
        rows = self._json(path, query).get(key)
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            self.paused_until = self.clock() + 60
            raise PublicSourceUnavailable("errors.javdbPublic.unrecognizedFormat")
        return [row for row in rows if isinstance(row, dict)]

    def peek_movie_identity(self, code: str) -> str | None:
        """只读当前确认的唯一来源身份，歧义和缺失保持未取得。"""
        with self.lock:
            canonical = normalise_code_key(code)
            identity_key = 'movie-id:' + canonical
            hit = self.cache.get(self._cache_key(identity_key))
            identity = hit[1] if hit else None
            if identity is None:
                stored = self._store().load(identity_cache_key(identity_key))
                identity = stored.value if stored else None
            if not isinstance(identity, list) or len(identity) != 1:
                return None
            value = identity[0]
            return value if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9]+', value) else None

    def peek_movie(self, code: str) -> dict | None:
        """只读已取得的资料，不触发网络；供发现排序投影。"""
        with self.lock:
            identity = self.peek_movie_identity(code)
            if identity is None:
                return None
            canonical = normalise_code_key(code)
            key = f'movie:{canonical}:{identity}'
            cache_key = self._cache_key(key)
            hit = self.cache.get(cache_key)
            snapshot = self.snapshots.get(cache_key) or self._store().load(identity_cache_key(key))
            if snapshot and snapshot.fresh(self.wallclock()):
                _record_read(key, snapshot)
                return dict(snapshot.value) if isinstance(snapshot.value, dict) else None
            return dict(hit[1]) if hit and hit[0] > self.clock() and snapshot is None else None

    def _bound_movie(self, code, movie):
        if movie is None:
            return self.movie(code)
        if (not isinstance(movie, dict) or not isinstance(movie.get('id'), str)
                or not re.fullmatch(r'[A-Za-z0-9]+', movie['id'])
                or not same_release_code(code, movie.get('number'))):
            raise PublicSourceUnavailable('errors.javdbPublic.identityMismatch')
        return movie

    def reviews(self, code: str, page: int, *, refresh=False, movie=None) -> list[dict]:
        if not 1 <= page <= MAX_REVIEW_PAGES:
            raise UserValueError("errors.javdbPublic.reviewPageOutOfRange")
        movie = self._bound_movie(code, movie)
        return self._cached(f"reviews:{movie['id']}:{page}", lambda:
                            self._rows(f"/v1/movies/{movie['id']}/reviews", "reviews", {"page": page}),
                            released=movie.get('release_date'), refresh=refresh)

    def media_movie(self, code: str, *, movie=None) -> dict:
        """未缓存媒体可补齐带查询参数的临时来源地址，公开编目仍按发行日期复用。"""
        movie = self._bound_movie(code, movie)
        key = f"movie:{normalise_code_key(code)}:{movie['id']}"
        snapshot = self.snapshots.get(self._cache_key(key)) or self._store().load(identity_cache_key(key))
        urls = [movie.get(name) for name in ('cover_url', 'thumb_url', 'preview_video_url')]
        urls.extend(actor.get('avatar_url') for actor in movie.get('actors') or [] if isinstance(actor, dict))
        urls.extend((image.get('large_url') or image.get('url')) if isinstance(image, dict) else image
                    for image in movie.get('preview_images') or [])
        if snapshot and self.wallclock() - snapshot.saved >= DAY and any(
                isinstance(url, str) and '?' in url for url in urls):
            return self.movie(code, refresh=True, source_id=movie['id'])
        return movie

    def magnets(self, code: str, *, refresh=False, movie=None) -> list[dict]:
        movie = self._bound_movie(code, movie)
        return self._cached("magnets:" + movie['id'], lambda:
                            self._rows(f"/v1/movies/{movie['id']}/magnets", "magnets"),
                            released=movie.get('release_date'), refresh=refresh)

    def resources(self, code: str, *, refresh=False, review_pages=MAX_REVIEW_PAGES) -> dict:
        """磁链区与评论正文的资源链接；一侧未取得只记警告，作品身份未取得直接抛出。

        `refresh` 只重取磁链与评论；作品资料按快照规则复用（发行后齐全的固定，其余当天有效）。"""
        from .downloads import parse_magnet
        from .sources.javdb import merge_resources, parse_comment_text

        movie = self.movie(code)
        source_url = "https://javdb.com/v/" + movie["id"]
        warnings = []
        items = {}
        magnet_failed = comments_failed = False
        try:
            rows = self.magnets(code, refresh=refresh, movie=movie)
        except PublicSourceUnavailable as error:
            if isinstance(error, PublicLoginRequired) and self.page_context.get() is not None:
                from .sources.base import SourceFailure
                from .sources.javdb import page_resources
                from .metadata import relay_args
                try:
                    return page_resources(code, movie, self.page_context.get(), review_pages=review_pages)
                except SourceFailure as page_error:
                    raise PublicSourceUnavailable(*relay_args(page_error)) from page_error
            rows = []
            magnet_failed = True
            warnings.append(Said("labels.javdbPublic.magnetsUnfetched", error=nested_message(error)))
        for row in rows:
            try:
                magnet = parse_magnet(str(row.get("hash") or ""))
            except ValueError:
                continue
            if magnet.info_hash in items:
                continue
            attributes = [label for key, label in (("cnsub", RESOURCE_CHINESE_SUBTITLES), ("hd", RESOURCE_HD))
                          if row.get(key)]
            items[magnet.info_hash] = {"id": "magnet:" + magnet.info_hash, "protocol": "magnet",
                "info_hash": magnet.info_hash, "uri": magnet.uri, "name": row.get("name") or code,
                "size": magnet_size(row.get("size")), "files": str(row.get("files_count") or ""),
                "date": str(row.get("created_at") or ""), "attributes": attributes,
                "source": "JavDB", "source_url": source_url, "origins": ["JavDB"]}
        comments = []
        try:
            for page in range(1, review_pages + 1):
                reviews = self.reviews(code, page, refresh=refresh, movie=movie)
                for review in reviews:
                    origin = source_url + "#review-item-" + str(review.get("id") or "")
                    comments.extend(parse_comment_text(str(review.get("content") or ""), origin,
                                                       str(review.get("created_at") or "")))
                if len(reviews) < PAGE_SIZE:
                    break
            else:
                warnings.append(Said("labels.javdbPublic.reviewPagesQueried", pages=review_pages))
        except PublicSourceUnavailable as error:
            comments_failed = True
            warnings.append(Said("labels.javdbPublic.commentsUnfetched", error=nested_message(error)))
        return {"items": merge_resources([*items.values(), *comments]), "warnings": warnings,
                **parallel("warning", warnings), "source_url": source_url, "magnet_failed": magnet_failed, "comments_failed": comments_failed}

    def official_preview(self, code, fetch, *, released=None, refresh=False, provider='prestige', source_id=None):
        """预告按来源独立保存；DMM、JavDB 和未提供的预告每天可再检查。"""
        def read():
            url = fetch()
            return {'url': url, **({'release_date': released} if url and provider == 'prestige' else {})}
        key = f'preview:{provider}:' + normalise_code_key(code)
        if provider == 'javdb':
            if source_id is None:
                key += f':search-{RULE}'
            elif not isinstance(source_id, str) or not re.fullmatch(r'[A-Za-z0-9]+', source_id):
                raise PublicSourceUnavailable('errors.javdbPublic.identityMismatch')
            else:
                key += ':' + source_id
        return self._cached(key, read, refresh=refresh)

    def image(self, code: str, index: str, *, original=False, movie=None) -> str:
        movie = self.media_movie(code, movie=movie)
        if index == "cover":
            url = movie.get("cover_url") or movie.get("thumb_url")
        elif index.startswith("actor:"):
            actor_id = index.removeprefix("actor:")
            actor = next((actor for actor in movie.get("actors") or []
                          if isinstance(actor, dict) and str(actor.get("id")) == actor_id), None)
            if not actor:
                raise UserValueError("errors.javdbPublic.performerAvatarMissing")
            url = actor.get("avatar_url")
        else:
            previews = movie.get("preview_images") or []
            try:
                url = previews[int(index)]
            except (ValueError, IndexError, TypeError):
                raise UserValueError("errors.javdbPublic.previewImageMissing") from None
            if isinstance(url, dict):
                url = url.get("large_url") or url.get("url")
        return self.image_from_url(url, original=True) if original else self.image_from_url(url)

    def image_from_url(self, url, *, original=False) -> str:
        """静态头像与作品图片共用校验、并发下载、解码和请求缓存。"""
        if not public_image_url(url):
            raise PublicSourceUnavailable("errors.javdbPublic.imageUnavailable")

        def fetch():
            import base64
            with self.image_slots:
                body = self._get(str(url), limit=4 * 1024 * 1024, image=True).body
                decoded = decode_image(body, original=True) if original else decode_image(body)
            return "data:image/jpeg;base64," + base64.b64encode(decoded).decode("ascii")

        key = ('image:original:' if original else 'image:') + hashlib.sha256(str(url).encode()).hexdigest()
        return self._cached(key, fetch)


def decode_image(body: bytes, *, original=False) -> bytes:
    """标准图片与公开前端 XOR 包装，只接受 Pillow 完整解码的图像。"""
    candidates = [body]
    if body:
        candidates.append(bytes(value ^ body[0] for value in body[1:]))
        candidates.extend(bytes(value ^ 0x7f for value in body[skip:]) for skip in (0, 1, 2))
    for raw in candidates:
        try:
            with Image.open(io.BytesIO(raw)) as image:
                if image.width * image.height > 20_000_000:
                    continue
                image.load()
                if original and image.format == 'JPEG':
                    return raw
                if not original:
                    image.thumbnail((1200, 1200))
                output = io.BytesIO()
                image.convert("RGB").save(output, "JPEG", quality=95 if original else 85)
                return output.getvalue()
        except (OSError, ValueError, Image.DecompressionBombError):
            continue
    raise PublicSourceUnavailable("errors.javdbPublic.imageUnavailable")


PUBLIC_API = PublicAPI(cache_root=lambda: _CACHE_ROOT.get())
