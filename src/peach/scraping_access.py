"""采集来源的本机设置、域内 Cookie 和按来源连接策略。"""
from __future__ import annotations

import http.cookiejar
import hashlib
from http.cookies import SimpleCookie, CookieError
import json
import logging
import math
import os
from pathlib import Path
import tempfile
import threading
import time
from contextlib import contextmanager
from contextvars import ContextVar
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from urllib.parse import urlsplit, urljoin

import httpx

from .coded_text import Said, coded
from .content_words import AGE_GATE_BUTTON, ONEPONDO_NAME
from .follow_secrets import CredentialStore
from . import browser_transport, peach_proxy
from .http import HttpRequest, HttpxTransport
from .scripting import USER_AGENT, host_under, hostname_of
from .fsutil import atomic_write_text
from .metadata import RelayableError
from .user_messages import UserValueError

LOGGER = logging.getLogger(__name__)


SOURCES = {
    "r18dev": {"label": "R18.dev", "domains": ("r18.dev",), "login": "https://r18.dev/"},
    "dmm": {"label": "DMM / FANZA", "domains": ("dmm.co.jp", "dmm.com"), "login": "https://www.dmm.co.jp/"},
    "prestige": {"label": "Prestige", "domains": ("prestige-av.com",), "login": "https://www.prestige-av.com/"},
    "mgstage": {"label": "MGStage", "domains": ("mgstage.com",), "login": "https://www.mgstage.com/"},
    "faleno": {"label": "FALENO", "domains": ("faleno.jp",), "login": "https://faleno.jp/"},
    "dahlia": {"label": "DAHLIA", "domains": ("dahlia-av.jp",), "login": "https://dahlia-av.jp/"},
    "makers": {"label": Said("labels.scrapingAccess.makers"), "domains": (), "login": ""},
    "fc2club": {"label": "FC2Club", "domains": ("fc2club.top",), "login": "https://fc2club.top/"},
    "freejavbt": {"label": "FreeJavBT", "domains": ("freejavbt.com",), "login": "https://freejavbt.com/"},
    "airav": {"label": "AIRAV", "domains": ("airav.io",), "login": "https://airav.io/"},
    "avsox": {"label": "AVSOX", "domains": ("avsox.click",), "login": "https://avsox.click/"},
    # FC2 的商品页、卖家页和图片存储（`storage*`、`contents-thumbnail*`）都在 fc2.com
    # 底下，一条域名就够。免登录可读，不收 Cookie。
    "fc2": {"label": "FC2", "domains": ("fc2.com",), "login": "https://adult.contents.fc2.com/"},
    # 女優那一栏在浏览器里只对登录用户显示，公开采集也带上用户贴的 Cookie（`session`），
    # 按登录用户看到的那一页取；游客补问这一栏眼下也回，见 `sources/fc2cmadb.py`。
    "fc2cmadb": {"label": "FC2CMADB", "domains": ("fc2cmadb.com",), "login": "https://fc2cmadb.com/",
                 "cookie": True, "session": True},
    # FC2 商品的两个存档站都在 Cloudflare 的 JS 验证后面：httpx 与模拟 Chrome 指纹的直连都回 403，
    # 只有浏览器过完验证发下的 `cf_clearance` 能进，而它绑着解题那台浏览器的 User-Agent 与出口。
    # `browser`：请求在本机 Edge/Chrome 的页面里发，验证由它自己过（ADR-0065）；这台机器没有可驱动的
    # 浏览器时才退回下面这条路——整站 UA 与用户的 Chrome 一致、Cookie 由用户贴、连接方式选成与浏览器
    # 同一个出口。验证没过或 Cookie 过期都按 `blocked_pause` 停下，不反复撞。
    # `browser_gate`：新 profile 第一次进站会被送到年龄确认页（`/ja/age-verify?returnTo=…`），点那颗
    # 「18 岁以上」的按钮才回到要看的页；浏览器传输落到这个路径就替用户点。
    "fc2ppvdb": {"label": "FC2PPV-DB", "domains": ("fc2ppv-db.com",), "login": "https://fc2ppv-db.com/",
                 "cookie": True, "session": True, "browser": True, "blocked_pause": 6 * 3600,
                 "browser_gate": {"path": "/age-verify", "button": AGE_GATE_BUTTON}},
    "javten": {"label": "JAVten", "domains": ("javten.com",), "login": "https://javten.com/",
               "cookie": True, "session": True, "browser": True, "blocked_pause": 6 * 3600},
    # 下架 FC2 的最后一档。作品页在 javarchive.com、封面转存在 javstore.net 上，两边算同一个
    # 来源。免登录可读，不收 Cookie，`robots.txt` 是全站放行。
    "javarchive": {"label": "JavArchive", "domains": ("javarchive.com", "javstore.net"),
                   "login": "https://javarchive.com/"},
    # 作品 JSON、剧照和样片都在 1pondo.tv 底下（含 `smovie.`）。免登录可读，不收 Cookie。
    "1pondo": {"label": ONEPONDO_NAME, "domains": ("1pondo.tv",), "login": "https://www.1pondo.tv/"},
    "instagram": {"label": "Instagram", "domains": ("instagram.com", "cdninstagram.com"), "login": "https://www.instagram.com/accounts/login/", "cookie": True},
    # 三家社区来源拒绝访问时回 403，不发 Retry-After：javdb 是出口 IP 超了配额（一封 3～7 日，
    # docs/SOURCING.md），AVBase 是 Cloudflare 验证，JavBus 的 403 原因未取得。封期里接着问只会每条都
    # 再撞一次，所以整个来源停下——停多久按 `FIRST_BLOCKED_PAUSE` 翻倍，`blocked_pause` 是这个来源的上限。
    # 回 200 的验证页由解析器认成 `cloudflare_challenge`，经 `SourceTransport.hold` 进同一份记录。
    # `session`：公开采集也带上用户在采集设置里贴的 Cookie。javdb 有登录墙，JavBus 有年龄门，
    # 不带只回确认页；Cookie 由用户在浏览器里过门或登录后贴进来，Peach 不读浏览器的 Cookie 库。
    "javdb": {"label": "JavDB", "domains": ("javdb.com", "jdbstatic.com", "jdbimgs.com"), "login": "https://javdb.com/",
              "cookie": True, "session": True, "account": True, "blocked_pause": 6 * 3600},
    "javbus": {"label": "JavBus", "domains": ("javbus.com",), "login": "https://www.javbus.com/", "cookie": True,
               "session": True, "blocked_pause": 6 * 3600},
    # 磁力候选链。manko.fun 的页面数据来自同一产品使用的 healertanker API；Sukebei
    # 只读搜索结果。两者仍走统一的请求预算、来源冷却与域名白名单。
    "manko": {"label": "manko.fun", "domains": ("manko.fun", "healertanker.com"),
              "login": "https://manko.fun/", "blocked_pause": 6 * 3600},
    "sukebei": {"label": "sukebei", "domains": ("sukebei.nyaa.si",),
                "login": "https://sukebei.nyaa.si/", "blocked_pause": 6 * 3600},
    "avbase": {"label": "AVBase", "domains": ("avbase.net",), "login": "https://www.avbase.net/", "blocked_pause": 6 * 3600},
    # 女优编号与资料交叉核对（ADR-0067）。httpx 直连就回整页，不收 Cookie、不走浏览器；
    # 拒绝访问时和 AVBase 一样停一段，不反复撞。
    "avwikidb": {"label": "AVWikiDB", "domains": ("avwikidb.com",), "login": "https://avwikidb.com/",
                 "blocked_pause": 6 * 3600},
    # 女优资料表、别名与事务所名册（补别名、补女优资料、链接与名册采集）。Cloudflare 对 HTTP 客户端
    # 间歇拦截：同一天里有的请求 403、有的照常 200。`browser_fallback`：HTTP 客户端撞上 403、429 或
    # 验证页时，改由本机浏览器取同一页验证；取到正常页就把这个来源固定到浏览器（`fixed_to_browser`），
    # 浏览器也没取到才照常冷却。不收 Cookie。
    "minnano-av": {"label": "みんなのAV", "domains": ("minnano-av.com",), "login": "https://www.minnano-av.com/",
                   "blocked_pause": 6 * 3600, "browser_fallback": True},
}
_LOCK = threading.RLock()

#: 撞上拒绝访问后第一次停多久。`blocked_pause` 是**上限**，不是首停时长：那几家按出口
#: IP 计的封，实际封期常常远短于上限。2026-09-22 实测——javdb 记下的 24 小时只走了
#: 6.6 小时，用同一套 client 问首页和两条搜索全回 200，剩下的时间整个来源在盲等，那一轮
#: 778 部片的 1432 条失败全部写着「来源正在冷却」。所以先停这一档，连着再撞才翻倍到上限；
#: 通了一次就把记录清掉，下次从最短的一档重新起算。
FIRST_BLOCKED_PAUSE = 900


class SourcePaused(RelayableError, RuntimeError):
    """来源冷却期内停止请求，保留已有图像。"""


class SourceBudgetExhausted(SourcePaused):
    """本趟采集预算耗尽，不能作为单个来源的冷却跳过。"""


#: 整趟预算三项到顶时那一句的 code，键是 `SourceTransport` 的三个上限。
BUDGET_SPENT = {
    'requests': "errors.scrapingAccess.requestBudgetSpent",
    'seconds': "errors.scrapingAccess.timeBudgetSpent",
    'bytes': "errors.scrapingAccess.downloadBudgetSpent",
}


class SourceRefused(SourcePaused):
    """站方回的是拒绝这个出口的说明页（`sources.base.refusal_page`），来源已经记下冷却。

    `reason` 是 `FailureReason` 的取值（`geo_restricted`／`ip_banned`），来源检查按它报细档。
    """

    def __init__(self, code: str, params: dict, reason: str) -> None:
        super().__init__(code, params)
        self.reason = reason


#: 用户亲手打开的页面（库外详情、查找资源、按名字搜演员）才带登录账号的 Cookie；见 `with_account`。
_WITH_ACCOUNT: ContextVar[bool] = ContextVar("peach_scraping_with_account", default=False)


@contextmanager
def with_account():
    """这一段里的请求带上 `account` 来源的登录 Cookie。

    登录账号会被站方按浏览速度停用（2026-11-16 JavDB 停了一天），后台任务一个接一个地取页正是那种速度。
    所以账号 Cookie 默认不带：浏览器添加队列、想要定时查找、资料处理与订阅源抓取都匿名取页，只有用户
    在页面上点开的那一次请求进这一段。
    """
    token = _WITH_ACCOUNT.set(True)
    try:
        yield
    finally:
        _WITH_ACCOUNT.reset(token)


def sends_cookie(source: str | None) -> bool:
    """这次请求带不带这个来源的 Cookie：年龄门一类会话照带；登录账号（`account`）只在 `with_account` 里带。"""
    entry = SOURCES.get(source or "", {})
    return bool(entry.get("session")) and (not entry.get("account") or _WITH_ACCOUNT.get())


def _paused(source: str | None, kind: str, until: float) -> "SourcePaused":
    """冷却、限流、拒绝三种停下的报错；登记过的来源点名并写出大约还要停多久，没登记的照旧泛称。"""
    label = SOURCES.get(source or "", {}).get("label")
    if not label:
        return SourcePaused("errors.scrapingAccess.refused" if kind == "refusedCookie" else f"errors.scrapingAccess.{kind}")
    minutes = max(1, math.ceil((until - time.time()) / 60))
    return SourcePaused(f"errors.scrapingAccess.{kind}Named", {"label": label, "minutes": minutes})


def cooldown_path(root: Path, source: str) -> Path:
    """这个来源的冷却记录。键是来源名；没有来源名的请求按主机名散列，见 `SourceTransport`。"""
    return Path(root) / ("scraping-" + source + ".cooldown.json")


#: 冷却记录里的 `via`：写下这笔账时请求走的是哪条路。HTTP 客户端（httpx 直连或经 Peach 代理、amane 桥）
#: 与本机浏览器（ADR-0065）在站方眼里是两个客户端，一条路撞出的封不说明另一条路进不去。
#: 没有 `via` 的记录按 HTTP 客户端算。
VIA_HTTP = "http"
VIA_BROWSER = "browser"
#: 来源设置里记「这个来源已固定走浏览器」的键，值是 `VIA_BROWSER`。只对登记了 `browser_fallback` 的来源有效。
FIXED_TRANSPORT = "transport"


def cooldown_state(root: Path, source: str) -> tuple[float, int]:
    """`(冷却到几点, 连着撞了几次)`；没有记录或记录坏了都按 `(0, 0)`。"""
    until, blocks, _via = _record(root, source)
    return until, blocks


def _record(root: Path, source: str) -> tuple[float, int, str]:
    """`(冷却到几点, 连着撞了几次, 走的哪条路)`；没有记录或记录坏了都按 `(0, 0, VIA_HTTP)`。"""
    try:
        record = json.loads(cooldown_path(root, source).read_text(encoding="utf-8"))
        return float(record["until"]), int(record.get("blocks") or 0), str(record.get("via") or VIA_HTTP)
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return 0.0, 0, VIA_HTTP


def _state_for(root: Path, source: str, via: str) -> tuple[float, int]:
    """走 `via` 这条路时该认的冷却：记录是另一条路写下的就作废（删掉），按 `(0, 0)` 从第一档重新数。"""
    until, blocks, recorded = _record(root, source)
    if recorded != via and (until or blocks):
        with _LOCK:
            cooldown_path(root, source).unlink(missing_ok=True)
        return 0.0, 0
    return until, blocks


def paused_until(root: Path, source: str) -> float:
    """来源还在冷却就返回到几点，否则 0。amane 桥那几站在起子进程前按它筛。"""
    until, _ = cooldown_state(root, source)
    return until if until > time.time() else 0.0


def pause_source(root: Path, source: str, *, refused: bool = False,
                 retry_after: float | None = None, via: str = VIA_HTTP) -> float:
    """按现成的两档把来源停下，返回冷却到几点。

    `refused` 走 403 那一档：先停 `FIRST_BLOCKED_PAUSE`，连着再撞才翻倍，上限是
    `SOURCES[source]['blocked_pause']`，没登记上限的来源按 24 小时。否则走 429 那一档：
    停站方说的 `retry_after` 秒，没说就 15 分钟。amane 桥报的限流与封禁、自写站契约报的
    冷却细档（`SourceTransport.hold`）都从这里进，与 `SourceTransport` 读写同一份记录。
    `via` 是这次请求走的路；记录是另一条路写下的，就从第一档重新数。
    """
    until, blocks = _state_for(root, source, via)
    if refused:
        blocks += 1
        limit = SOURCES.get(source, {}).get("blocked_pause") or 24 * 3600
        until = time.time() + min(FIRST_BLOCKED_PAUSE * 2 ** (blocks - 1), limit)
    else:
        until = time.time() + max(0.0, float(retry_after if retry_after is not None else 900))
    _pause(cooldown_path(root, source), until, blocks, via)
    return until


def _pause(cooldown: Path, until: float, blocks: int = 0, via: str = VIA_HTTP) -> None:
    with _LOCK:
        cooldown.parent.mkdir(parents=True, exist_ok=True)
        cooldown.write_text(json.dumps({"until": max(until, time.time() + 1), "blocks": blocks, "via": via}),
                            encoding="utf-8")


def source_for(url: str) -> str | None:
    return next((name for name, spec in SOURCES.items()
                 if host_under(hostname_of(url), spec["domains"])), None)


def _store(root: Path) -> CredentialStore:
    return CredentialStore(root)


def values_for(root: Path, source: str) -> dict[str, str]:
    if source not in SOURCES:
        raise UserValueError("errors.scrapingAccess.unknownSource")
    credential = _store(root).load("scraping-" + source)
    return dict(credential.values) if credential else {}


def fixed_to_browser(root: Path, source: str) -> bool:
    """登记了 `browser_fallback` 的来源，是不是已经在这台机器上验证过浏览器能进、固定走浏览器。"""
    return (bool(SOURCES[source].get("browser_fallback"))
            and values_for(root, source).get(FIXED_TRANSPORT) == VIA_BROWSER)


def wants_browser(root: Path, source: str) -> bool:
    """这个来源该不该走本机浏览器：登记了 `browser`，或 `browser_fallback` 已固定到浏览器。"""
    return bool(SOURCES[source].get("browser")) or fixed_to_browser(root, source)


def _write_values(root: Path, source: str, values: dict[str, str]) -> None:
    path = _store(root).path_for("scraping-" + source)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(values, handle, ensure_ascii=False)
        if os.name != "nt":
            temporary.chmod(0o600)
        temporary.replace(path)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def _refused(response) -> bool:
    """HTTP 客户端这一下是不是被站方拦了：429、403，或回 200 的 Cloudflare 验证页。"""
    from .sources.base import challenge_page

    return response.status in {403, 429} or challenge_page(response.body)


def cookie_jar(values: dict[str, str], source: str) -> http.cookiejar.CookieJar:
    """文本导入复用标准库；过期项、异域项和 CDN 会话项不参与请求。"""
    domain = urlsplit(SOURCES[source]["login"]).hostname or ""
    domain = domain.removeprefix("www.")
    jar = http.cookiejar.MozillaCookieJar()
    text = values.get("cookies_text", "")
    if text:
        path = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False) as handle:
                path = handle.name
                handle.write(text)
            jar.load(path, ignore_discard=True, ignore_expires=False)
        except (OSError, http.cookiejar.LoadError) as exc:
            raise UserValueError("errors.scrapingAccess.cookieFileFormat") from exc
        finally:
            if path:
                Path(path).unlink(missing_ok=True)
        for cookie in list(jar):
            if not host_under(cookie.domain.lstrip(".").lower(), (domain,)):
                jar.clear(cookie.domain, cookie.path, cookie.name)
    elif values.get("cookie"):
        text = values["cookie"]
        if "\r" in text or "\n" in text:
            raise UserValueError("errors.scrapingAccess.cookieOneLine")
        parsed = SimpleCookie()
        try:
            parsed.load(text)
        except CookieError as exc:
            raise UserValueError("errors.scrapingAccess.invalidCookieHeader") from exc
        for name, item in parsed.items():
            jar.set_cookie(http.cookiejar.Cookie(
                0, name, item.value, None, False, domain, True, False,
                "/", True, True, None, True, None, None, {}, False))
    return jar


def save(root: Path, source: str, body: dict) -> dict:
    with _LOCK:
        values = values_for(root, source)
        previous_network = "direct" if values.get("network") == "direct" else "peach"
        mode = body.get("network", "direct" if values.get("network") == "direct" else "peach")
        if mode not in {"direct", "peach"}:
            raise UserValueError("errors.scrapingAccess.chooseNetwork")
        if values.get("network") == "proxy" and mode == "peach":
            inherited = peach_proxy.values(root)
            peach_proxy.client_options(root)
            peach_proxy.save(root, inherited)
        values["network"] = mode
        values.pop("proxy", None)
        if body.get("revoke"):
            values.pop("cookie", None)
            values.pop("cookies_text", None)
        elif body.get("cookie") or body.get("cookies_text"):
            if not SOURCES[source].get("cookie"):
                raise UserValueError("errors.scrapingAccess.cookieNotAccepted")
            if body.get("cookie") and body.get("cookies_text"):
                raise UserValueError("errors.scrapingAccess.cookieOneMethod")
            supplied = {name: str(body.get(name) or "") for name in ("cookie", "cookies_text")}
            if sum(map(len, supplied.values())) > 256 * 1024:
                raise UserValueError("errors.scrapingAccess.cookieTooLarge")
            if not list(cookie_jar(supplied, source)):
                raise UserValueError("errors.scrapingAccess.noValidCookie")
            values.update(supplied)
            # 新 Cookie 多半是为了解开 403 才换的；冷却记的是旧 Cookie 撞出来的账，别让它压着新的等到期。
            cooldown_path(root, source).unlink(missing_ok=True)
        _write_values(root, source, values)
        if mode != previous_network:
            cooldown_path(root, source).unlink(missing_ok=True)
    return describe(root, source)


def fix_to_browser(root: Path, source: str) -> None:
    """把登记了 `browser_fallback` 的来源固定到本机浏览器：写进来源设置，连接方式与 Cookie 原样留着。"""
    with _LOCK:
        _write_values(root, source, {**values_for(root, source), FIXED_TRANSPORT: VIA_BROWSER})


def describe(root: Path, source: str) -> dict:
    values = values_for(root, source)
    until = paused_until(root, source)
    return {"source": source, **coded("label", SOURCES[source]["label"]),
            "login": SOURCES[source]["login"], "accepts_cookie": bool(SOURCES[source].get("cookie")),
            "network": "direct" if values.get("network") == "direct" else "peach",
            "cookie_saved": bool(values.get("cookie") or values.get("cookies_text")),
            "cooldown_until": until or None,
            # 这台机器上这个来源是不是由本机浏览器过验证：该走浏览器（`wants_browser`）且找得到浏览器。
            "browser": wants_browser(root, source) and browser_transport.find_browser() is not None}


def source_checks(root: Path, source: str) -> dict:
    """逐站最近一次连接与解析结果；不包含请求地址、正文或凭据。"""
    if source not in SOURCES:
        return {}
    try:
        path = Path(root) / f"source-check-{source}.json"
        if path.stat().st_size > 16384:
            return {}
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            return {}
        result = {}
        for stage in ("connection", "metadata"):
            record = value.get(stage)
            if not isinstance(record, dict):
                continue
            clean = {"ok": record.get("ok") is True,
                     "kind": record.get("kind") if record.get("kind") in ("ok", "auth", "unavailable", "not_found") else "unavailable",
                     "reason": record.get("reason") if isinstance(record.get("reason"), str) and len(record["reason"]) <= 64 else "unexpected",
                     "status": record.get("status") if type(record.get("status")) is int and 100 <= record["status"] <= 599 else 0}
            for key in ("checked_at", "last_success_at", "elapsed_s"):
                raw = record.get(key)
                if isinstance(raw, bool) or raw is None:
                    continue
                try:
                    if isinstance(raw, str) and key != "elapsed_s":
                        moment = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                        number = moment.replace(tzinfo=timezone.utc).timestamp() if moment.tzinfo is None else moment.timestamp()
                    else:
                        number = float(raw)
                    if math.isfinite(number) and number >= 0:
                        clean[key] = number
                except (ValueError, TypeError, OverflowError, OSError):
                    pass
            if "checked_at" in clean:
                result[stage] = clean
        return result
    except (OSError, ValueError):
        return {}


def record_source_check(root: Path, source: str, stage: str, record: dict) -> None:
    """保存脱敏状态，保留连接检查与元数据解析的独立时间戳。"""
    if source not in SOURCES or stage not in {"connection", "metadata"}:
        return
    allowed = {"ok", "kind", "reason", "status", "elapsed_s", "checked_at"}
    with _LOCK:
        state = source_checks(root, source)
        clean = {key: value for key, value in record.items() if key in allowed}
        if stage == "metadata":
            clean["last_success_at"] = record.get("checked_at") if record.get("ok") else state.get(stage, {}).get("last_success_at")
        state[stage] = clean
        try:
            atomic_write_text(Path(root) / f"source-check-{source}.json",
                              json.dumps(state, ensure_ascii=False), mode=0o600)
        except OSError:
            LOGGER.warning("Diagnostics record for source %s was not saved", source)


def browser_profile(root: Path) -> Path:
    """浏览器 profile 放在凭据根下：里面是 `cf_clearance` 与站点会话，和贴进来的 Cookie 一个性质。"""
    return Path(root) / "browser"


def client_for(root: Path, source: str, *, session: bool = False, **kwargs) -> httpx.Client:
    values = values_for(root, source)
    network = {"trust_env": False} if values.get("network") == "direct" else peach_proxy.client_options(root)
    options = {**network, "follow_redirects": True,
               "headers": {"User-Agent": USER_AGENT}}
    if session:
        options["cookies"] = cookie_jar(values, source)
    options.update(kwargs)
    return httpx.Client(**options)


class SourceTransport:
    """公开采集按来源复用连接池；登录会话由特定来源消费者显式建立。"""

    def __init__(self, secrets_root: Path, *, max_requests: int = 0,
                 max_bytes: int = 0, max_seconds: float = 0, allow_browser: bool = True):
        self.root = secrets_root
        self.allow_browser = allow_browser
        self.transports: dict[str | None, HttpxTransport] = {}
        self.max_requests, self.max_bytes = max_requests, max_bytes
        from .processing_control import deadline_after
        self.deadline = deadline_after(max_seconds) if max_seconds else 0
        self.requests = self.bytes = 0

    def __call__(self, request: HttpRequest, timeout: float, max_bytes: int):
        from .task_control import operation
        with operation():
            return self._controlled_request(request, timeout, max_bytes)

    def _controlled_request(self, request: HttpRequest, timeout: float, max_bytes: int):
        for _ in range(6):
            from .processing_control import checkpoint
            checkpoint('network')
            from .processing_traffic import CURRENT, download_route
            if CURRENT.get() is None:
                response = self._request(request, timeout, max_bytes)
            else:
                source = source_for(request.url)
                direct = bool(source and values_for(self.root, source).get('network') == 'direct')
                options = {'trust_env': False} if direct else peach_proxy.client_options(self.root)
                with download_route(bool(options.get('proxy') or options.get('trust_env', True))):
                    response = self._request(request, timeout, max_bytes)
            if response.status not in {301, 302, 303, 307, 308} or not response.headers.get("location"):
                return response
            target = urljoin(request.url, response.headers["location"])
            if urlsplit(target).scheme != "https":
                raise UserValueError("errors.scrapingAccess.redirectNotHttps")
            cross_origin = urlsplit(target).netloc != urlsplit(request.url).netloc
            headers = {k: v for k, v in request.headers.items()
                       if not cross_origin or k.lower() not in {"cookie", "authorization", "host"}}
            request = HttpRequest("GET" if response.status == 303 else request.method,
                                  target, headers, None if response.status == 303 else request.body)
        raise UserValueError("errors.scrapingAccess.tooManyRedirects")

    def exhausted(self) -> str:
        """本趟预算到顶时返回那一句说明的 code（`BUDGET_SPENT` 的值），没到顶返回空串。

        到顶之后这个传输再也发不出请求，调用方据此整趟停下，不必逐项去撞同一句话。"""
        if self.max_requests and self.requests >= self.max_requests:
            return BUDGET_SPENT['requests']
        if self.deadline and self.deadline <= time.monotonic():
            return BUDGET_SPENT['seconds']
        if self.max_bytes and self.bytes >= self.max_bytes:
            return BUDGET_SPENT['bytes']
        return ''

    def _request(self, request: HttpRequest, timeout: float, max_bytes: int):
        """闸门到顶的三句话都写「本趟」和「再跑一次接着采」：这三条按任务重新计数，
        读的人要据以决定的是「现在重跑一遍」，不是去查哪里还有配额。"""
        source = source_for(request.url)
        if source == "javbus":
            # 中文作品解析与连接检查共用语言偏好，封面请求也遵循来源策略。
            headers = {key: value for key, value in request.headers.items() if key.lower() != "accept-language"}
            request = HttpRequest(request.method, request.url,
                                  {**headers, "Accept-Language": "zh-CN,zh;q=0.9"}, request.body)
        spent = self.exhausted()
        if spent:
            raise SourceBudgetExhausted(spent)
        if self.deadline:
            timeout = min(timeout, self.deadline - time.monotonic())
            if timeout <= 0:
                raise SourceBudgetExhausted(BUDGET_SPENT['seconds'])
        if self.max_bytes:
            max_bytes = min(max_bytes, self.max_bytes - self.bytes - 1)
        key = source or hashlib.sha256(hostname_of(request.url).encode()).hexdigest()
        cooldown = cooldown_path(self.root, key)
        # 冷却只认这条路自己撞出来的账：直连 403 攒下的 `blocks` 与 `until` 不压到浏览器那条路上，反之亦然。
        via = self._via(source)
        until, blocks = _state_for(self.root, key, via)
        if until > time.time():
            raise _paused(source, "coolingDown", until)
        if source not in self.transports:
            self.transports[source] = self._transport_for(source)
        self.requests += 1
        try:
            response = self.transports[source](request, timeout, max_bytes)
        except (httpx.HTTPError, browser_transport.BrowserUnavailable):
            raise httpx.TransportError(Said("labels.scrapingAccess.unreachable")) from None
        except browser_transport.ChallengeUnsolved:
            blocks += 1
            _pause(cooldown, time.time() + min(FIRST_BLOCKED_PAUSE * 2 ** (blocks - 1),
                                               SOURCES[source]["blocked_pause"]), blocks, via)
            raise SourcePaused("errors.scrapingAccess.challengeTimedOut")
        if via == VIA_HTTP and source and SOURCES[source].get("browser_fallback") and _refused(response):
            verified = self._verify_in_browser(source, request, timeout, max_bytes)
            if verified is not None:
                # HTTP 客户端那条路攒下的账不压到浏览器上：清掉，之后按浏览器那条路重新数。
                cooldown.unlink(missing_ok=True)
                response, via, blocks = verified, VIA_BROWSER, 0
        self.bytes += len(response.body)
        if response.status == 429:
            retry = response.headers.get("retry-after", "")
            try:
                until = time.time() + max(0, int(retry))
            except ValueError:
                try:
                    until = parsedate_to_datetime(retry).timestamp()
                except (ValueError, TypeError, OverflowError):
                    until = time.time() + 900
            _pause(cooldown, until, blocks, via)
            raise _paused(source, "rateLimited", until)
        self._refuse(source, request.url, response, cooldown, blocks, via)
        blocked_pause = SOURCES.get(source or "", {}).get("blocked_pause")
        if response.status == 403 and blocked_pause:
            blocks += 1
            until = time.time() + min(FIRST_BLOCKED_PAUSE * 2 ** (blocks - 1), blocked_pause)
            _pause(cooldown, until, blocks, via)
            # 裸 403 分不清原因：请求太频繁、出口被拦，或贴过的 Cookie（`cf_clearance`）过期都会这样回。
            # 只在这次真带了 Cookie 时把它列为可能之一，没带就不让人去贴；要登录、要过验证各有自己的报错。
            values = values_for(self.root, source)
            sent = sends_cookie(source) and bool(values.get("cookie") or values.get("cookies_text"))
            raise _paused(source, "refusedCookie" if sent else "refused", until)
        if blocks and response.status < 400:
            # 这一趟通了，封已经解除：清掉记录，下次撞上从最短的一档重新起算。
            cooldown.unlink(missing_ok=True)
        return response

    @staticmethod
    def _refuse(source: str | None, url: str, response, cooldown: Path, blocks: int, via: str) -> None:
        """回的是拒绝这个出口的说明页（地区限制、出口封禁）就记冷却并抛 `SourceRefused`。

        状态码多半是 200，交给调用方只会被读成「这一页解不出东西」或「站上没有」。两种都是换一部片
        问结果不变，整站停下。地区限制要换出口才会变，用户改完代理不该再等一整天，所以固定停
        `FIRST_BLOCKED_PAUSE`、不往上翻倍；封禁和 403 一样按次翻倍到 `blocked_pause`。
        """
        from .sources.base import FailureReason, account_suspension, refusal_page

        label = SOURCES.get(source or "", {}).get("label") or hostname_of(url)
        suspended, resume = account_suspension(response.body)
        if suspended:
            # 停的是登录账号，换出口没用：按页面写的恢复时刻停（读不出就停 6 小时），不往封禁那档翻倍。
            now = time.time()
            until = min(max(resume or now + 6 * 3600, now + FIRST_BLOCKED_PAUSE), now + 7 * 86400)
            _pause(cooldown, until, blocks, via)
            shown = datetime.fromtimestamp(until).strftime("%m-%d %H:%M")
            raise SourceRefused("errors.scrapingAccess.accountSuspended", {"label": label, "time": shown},
                                FailureReason.ACCOUNT_SUSPENDED.value)
        reason = refusal_page(response.body)
        if reason is None:
            return
        if reason is FailureReason.GEO_RESTRICTED:
            _pause(cooldown, time.time() + FIRST_BLOCKED_PAUSE, blocks, via)
            raise SourceRefused("errors.scrapingAccess.geoRestricted",
                                {"label": label, "minutes": FIRST_BLOCKED_PAUSE // 60}, reason.value)
        blocks += 1
        limit = SOURCES.get(source or "", {}).get("blocked_pause") or 24 * 3600
        _pause(cooldown, time.time() + min(FIRST_BLOCKED_PAUSE * 2 ** (blocks - 1), limit), blocks, via)
        raise SourceRefused("errors.scrapingAccess.ipBanned", {"label": label}, reason.value)

    def hold(self, source: str, action: str) -> None:
        """契约报的冷却细档（`SourceFailure.cooldown_action`）写回这个来源的冷却记录。

        `blocked` 按 403 那一档翻倍，`rate_limited` 按 429 那一档；别的值与不在 `SOURCES` 里的来源不记。
        回 200 的验证页（AVBase、JAVten、FC2PPV-DB 的 httpx 那条路）在传输层看不出来，由解析器认出后经
        `SiteSource.holding` 走到这里，与 403 进的是同一份记录。
        """
        if action not in {"blocked", "rate_limited"} or source not in SOURCES:
            return
        pause_source(self.root, source, refused=action == "blocked", via=self._via(source))

    def _via(self, source: str | None) -> str:
        """这个来源这次走哪条路。该走浏览器的来源要先选出传输才知道（不发请求、不起进程）。"""
        if self.allow_browser and source and source not in self.transports and wants_browser(self.root, source):
            self.transports[source] = self._transport_for(source)
        transport = self.transports.get(source)
        return VIA_BROWSER if isinstance(transport, browser_transport.BrowserTransport) else VIA_HTTP

    def _verify_in_browser(self, source: str, request: HttpRequest, timeout: float, max_bytes: int):
        """HTTP 客户端被拦后，由本机浏览器取同一页验证。

        取到 200 且不是验证页：这个来源固定到浏览器（`fix_to_browser`），本趟之后的请求也走浏览器，返回这一页。
        本机没有浏览器、浏览器没取到或同样被拦：返回 None，调用方照 HTTP 客户端被拦那样冷却。
        """
        if not self.allow_browser:
            return None
        from .processing_control import checkpoint
        checkpoint('network')
        browser = self._browser_for(source)
        if browser is None:
            return None
        try:
            response = browser(request, timeout, max_bytes)
        except (browser_transport.BrowserUnavailable, browser_transport.ChallengeUnsolved) as error:
            LOGGER.info("%s blocked the HTTP client and browser verification also failed: %s", source, error)
            return None
        if response.status != 200 or _refused(response):
            LOGGER.info("%s blocked the HTTP client; browser verification returned HTTP %s", source, response.status)
            return None
        fix_to_browser(self.root, source)
        replaced = self.transports.get(source)
        if isinstance(replaced, HttpxTransport):
            replaced.close()
        self.transports[source] = browser
        LOGGER.warning("%s blocked the HTTP client; browser verification got a normal page, so this source now always uses the local browser", source)
        return response

    def _browser_for(self, source: str):
        """这个来源用的本机浏览器（进程共用）；本机没有可驱动的浏览器或代理带凭据时 None。"""
        values = values_for(self.root, source)
        direct = values.get("network") == "direct"
        options = {"trust_env": False} if direct else peach_proxy.client_options(self.root)
        proxy = options.get("proxy", "")
        direct = not options.get("trust_env", True) and not proxy
        gate = SOURCES[source].get("browser_gate")
        gates = {domain: gate for domain in SOURCES[source]["domains"]} if gate else {}
        return browser_transport.shared(browser_profile(self.root), direct=direct, proxy=proxy, gates=gates)

    def _transport_for(self, source: str | None):
        """这个来源的请求走哪条路：该走浏览器（`wants_browser`）且本机有浏览器就走浏览器页面，否则 httpx。"""
        if self.allow_browser and source and wants_browser(self.root, source):
            browser = self._browser_for(source)
            if browser is not None:
                return browser
        if source:
            client = client_for(self.root, source, session=sends_cookie(source), follow_redirects=False)
        else:
            client = httpx.Client(**peach_proxy.client_options(self.root), follow_redirects=False,
                                  headers={"User-Agent": USER_AGENT})
        return HttpxTransport(client, owns_client=True)

    def renew(self):
        self.close()

    def close(self):
        # 浏览器是整个进程共用的，空闲后自己关；这里只关自己开的连接池。
        for transport in self.transports.values():
            if isinstance(transport, HttpxTransport):
                transport.close()
        self.transports.clear()
