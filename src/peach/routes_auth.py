"""口令闸门与登录页。

401 有三种形态，按路由类分组保留（不许统一成一种）：页面路由跳登录页，页面资产
返回 PlainText 提示，API 与媒体路由返回 JSON。三个 `require_*` 是唯一的判定入口，
路由里不要自己比对口令；对应的响应形态由 `api.py` 的异常处理器给出。

口令从 `request.app.state.settings` 取，不是闭包捕获：路由挂在模块级的 `APIRouter`
上，import 期就定型了，那时还没有 settings。
"""
from __future__ import annotations

import hmac
import ipaddress
from collections import OrderedDict
import threading
import time
from urllib.parse import urlsplit
from . import access, distribution, interface_text, tunnel
from .user_messages import message_fields
from .web_entry import page_shell
from .web_local_access import local_client
from starlette.concurrency import run_in_threadpool
from urllib.parse import parse_qs

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

router = APIRouter()
_ATTEMPTS: OrderedDict[str, list[float]] = OrderedDict()
_ATTEMPTS_LOCK = threading.Lock()
_LOGIN_FORM_LIMIT = 8 * 1024
_LOGIN_FORM_FIELDS = 16


def _attempt_key(request: Request) -> str:
    """限速按真实来源分桶。

    隧道运行且连接来自回环或服务自己的地址时才读取边缘客户端地址。源码隧道连接本机
    HTTPS 地址；其他局域网客户端按连接源计数。转发地址必须有效并归一化。
    """
    peer = request.client.host if request.client else "unknown"
    server = request.scope.get('server')
    local_peer = peer in ("127.0.0.1", "::1") or bool(
        server and peer == server[0] and peer not in ('0.0.0.0', '::'))
    if local_peer and tunnel.running(getattr(request.app.state, "tunnel", None)):
        forwarded = (request.headers.get("cf-connecting-ip") or "").strip()
        try:
            return f"cf:{ipaddress.ip_address(forwarded)}"
        except ValueError:
            pass
    return peer


def _login_attempt(request: Request) -> None:
    """按连接来源限制密码尝试，保留有界的短期计数。"""
    peer = _attempt_key(request)
    now = time.monotonic()
    with _ATTEMPTS_LOCK:
        attempts = [stamp for stamp in _ATTEMPTS.pop(peer, []) if now - stamp < 60]
        _ATTEMPTS[peer] = attempts
        if len(attempts) >= 10:
            raise HTTPException(429, message_fields("api.auth.tooManyAttempts"), headers={"Retry-After": "60"})
        attempts.append(now)
        while len(_ATTEMPTS) > 1024:
            _ATTEMPTS.popitem(last=False)


def _policy(request: Request) -> dict:
    policy = access.load(request.app.state.settings.access_path)
    if policy["mode"] == "legacy":
        policy["key"] = request.app.state.settings.token
    return policy


def sessions(request: Request) -> access.Sessions | None:
    path = request.app.state.settings.access_path
    return access.Sessions(access.sessions_path(path)) if path is not None else None


def _client(request: Request) -> dict:
    """设备记录要的三样：浏览器简称、来源网段、是否经公网隧道进来。"""
    key = _attempt_key(request)
    return {"device": access.device_name(request.headers.get("user-agent", "")[:512]),
            "network": access.network_of(key.removeprefix("cf:")), "remote": key.startswith("cf:")}


def valid_session(request: Request, policy: dict) -> bool:
    return access.valid_session(policy, request.cookies.get(access.COOKIE, ""), sessions(request), **_client(request))


def _first_query_values(request: Request) -> dict[str, str]:
    """兼容 urllib.parse.parse_qs：取首值并忽略空值。"""
    result: dict[str, str] = {}
    for key, value in request.query_params.multi_items():
        if key not in result and value != "":
            result[key] = value
    return result


def _authorized(request: Request, token: str, args: dict[str, str]) -> bool:
    if not token:
        return True
    supplied = args.get("t") or request.headers.get("X-Token")
    if supplied is not None and hmac.compare_digest(str(supplied).encode(), token.encode()):
        return True
    policy = _policy(request)
    if policy["mode"] == "open":
        return True
    if policy["mode"] == "legacy":
        if hmac.compare_digest(request.cookies.get("tok", "").encode(), token.encode()):
            return True
    return valid_session(request, policy)


class PageLoginRequired(Exception):
    """页面路由未授权：401 形态是跳登录页，不是响应体。"""

    def __init__(self, next_path: str):
        self.next_path = next_path


class AssetLoginRequired(Exception):
    """页面脚本与样式未授权：401 形态是 PlainText 提示。"""


def _origin_key(value: str) -> tuple[str, str, int | None] | None:
    """把 Origin 头和隧道 URL 归一到可比较的三元组。"""
    try:
        parsed = urlsplit(value.strip().rstrip("/"))
    except ValueError:
        return None
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
        return None
    try:
        port = parsed.port
    except ValueError:
        return None
    scheme = parsed.scheme.lower()
    # 浏览器通常省略默认端口，代理或客户端可能显式保留；二者是同一个 origin。
    if port == {"http": 80, "https": 443}[scheme]:
        port = None
    return scheme, parsed.hostname.rstrip(".").lower(), port


def _tunnel_origin(request: Request) -> tuple[str, str, int | None] | None:
    """返回当前进程实际拿到的隧道 origin，而不是信任请求头。"""
    manager = getattr(request.app.state, "tunnel", None)
    if manager is None:
        return None
    try:
        url = manager.snapshot().url
    except (AttributeError, OSError, ValueError):
        return None
    return _origin_key(url) if url else None


def _named_origin(request: Request) -> tuple[str, str, int | None] | None:
    """命名隧道的公开主机名。

    它来自本次启动注入的运行设置，不是请求头，也不随隧道握手完成才出现：连接刚建立
    那几秒页面就已经能提交，这时 manager 的快照还没进入 running。
    """
    settings = getattr(request.app.state, "settings", None)
    if getattr(settings, "tunnel_mode", "") != tunnel.NAMED_MODE:
        return None
    hostname = (getattr(settings, "tunnel_hostname", "") or "").strip()
    return _origin_key(tunnel.public_url(hostname)) if hostname else None


_FETCH_SITES = frozenset({"same-origin", "same-site", "cross-site", "none"})
_FETCH_MODES = frozenset({"cors", "navigate", "no-cors", "same-origin", "websocket"})
_FETCH_DESTS = frozenset({"empty", "document", "iframe", "frame", "script", "worker"})
_MISMATCH_SEEN: dict[str, float] = {}
_MISMATCH_LOCK = threading.Lock()


def _origin_shape(key: tuple[str, str, int | None] | None) -> dict[str, object]:
    """只记协议、主机类别与端口：NAS 部署的 Origin 是公网域名，属于网络坐标。"""
    if key is None:
        return {}
    from .diagnostic_context import host_kind
    return {"scheme": key[0], "host_kind": host_kind(key[1]), "port": key[2]}


def _record_origin_mismatch(request, guard: str, origin: str | None,
                            supplied, local, *, site: str, accepted: bool) -> None:
    """来源对不上时写本机取证：接受与拒绝都记，同一形态一分钟只记一条。"""
    headers = request.headers
    mode, dest = (headers.get("sec-fetch-mode") or "").lower(), (headers.get("sec-fetch-dest") or "").lower()
    proto = (headers.get("x-forwarded-proto") or "").lower()
    if not origin:
        origin_class = "absent"
    elif origin.strip().lower() == "null":
        origin_class = "null"
    else:
        origin_class = "url" if supplied is not None else "malformed"
    fields: dict[str, object] = {
        "guard": guard, "accepted": accepted, "origin_class": origin_class,
        "origin": _origin_shape(supplied), "server": _origin_shape(local),
        "fetch_site": site if site in _FETCH_SITES else ("absent" if not site else "other"),
        "fetch_mode": mode if mode in _FETCH_MODES else ("absent" if not mode else "other"),
        "fetch_dest": dest if dest in _FETCH_DESTS else ("absent" if not dest else "other"),
        "scope_scheme": (getattr(request, "scope", None) or {}).get("scheme"),
        "forwarded": {"x_forwarded_proto": proto if proto in {"http", "https"} else bool(proto),
                      "x_forwarded_for": bool(headers.get("x-forwarded-for")),
                      "x_forwarded_host": bool(headers.get("x-forwarded-host")),
                      "forwarded": bool(headers.get("forwarded")), "via": bool(headers.get("via"))},
        "user_agent": (headers.get("user-agent") or "")[:512],
    }
    if supplied is not None and local is not None:
        fields.update(scheme_match=supplied[0] == local[0], host_match=supplied[1] == local[1],
                      port_match=supplied[2] == local[2])
    signature = repr(sorted(fields.items()))
    now = time.monotonic()
    with _MISMATCH_LOCK:
        if now - _MISMATCH_SEEN.get(signature, -120.0) < 60:
            return
        if len(_MISMATCH_SEEN) >= 64:
            _MISMATCH_SEEN.clear()
        _MISMATCH_SEEN[signature] = now
    from .error_reporting import local_event
    local_event("origin-mismatch", **fields)


def origin_allowed(request, *, guard: str, tunnels: bool = True) -> bool:
    """浏览器写请求的来源判定，`same_origin` 与首启提交共用。

    浏览器自己标的 ``Sec-Fetch-Site: same-origin`` 直接放行：这个头页面脚本改不了，
    本机代理或安全软件改写 Host、``X-Forwarded-Proto`` 翻转协议、浏览器发 ``Origin: null``
    时它仍然准确。标成 ``cross-site`` 一律拒绝。其余情况比较 Origin：没带就放行（非浏览器
    客户端），带了就要和本机地址或当前隧道地址一致。比较对不上时写一条取证，放行的也记。
    """
    headers = request.headers
    origin = headers.get("origin")
    site = (headers.get("sec-fetch-site") or "").lower()
    if not origin and site != "cross-site":
        return True
    supplied = _origin_key(origin) if origin else None
    local = _origin_key(str(request.base_url))
    allowed = {local}
    if tunnels:
        allowed |= {_tunnel_origin(request), _named_origin(request)}
    matched = supplied is not None and supplied in allowed
    accepted = site == "same-origin" or (site != "cross-site" and matched)
    if not matched or not accepted:
        _record_origin_mismatch(request, guard, origin, supplied, local, site=site, accepted=accepted)
    return accepted


def same_origin(request: Request) -> None:
    """浏览器写请求只接受 Peach 页面或当前隧道页面发来的请求，判据见 `origin_allowed`。

    独立包的 origin 是回环 HTTP，cloudflared 转发时 Host 仍可能是本机地址，
    所以不能单纯把 ``Origin`` 和 ASGI 的 ``base_url`` 比较。临时链接的随机入口由当前
    TunnelManager 产生并保存在进程内，命名隧道的公开主机名来自本次启动的运行设置；
    外部 Origin 必须精确匹配这两者之一，不能由调用方通过 ``X-Forwarded-*`` 自己
    声明一个可信地址。
    """
    if not origin_allowed(request, guard="same-origin"):
        raise HTTPException(403, message_fields("api.auth.submitFromSettings"))


def require_auth(request: Request) -> dict[str, str]:
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        same_origin(request)
    args = _first_query_values(request)
    if not _authorized(request, request.app.state.settings.token, args):
        raise HTTPException(status_code=401, detail="unauthorized")
    return args


def require_page_auth(request: Request) -> dict[str, str]:
    args = _first_query_values(request)
    if not _authorized(request, request.app.state.settings.token, args):
        raise PageLoginRequired(request.url.path or "/")
    return args


def authenticated_client(request: Request) -> bool:
    """开放访问不代表设备已经登录。"""
    policy = _policy(request)
    if policy['mode'] not in {'password', 'legacy'} or not policy.get('key'):
        return False
    if policy['mode'] == 'legacy':
        return _authorized(request, policy['key'], _first_query_values(request))
    return valid_session(request, policy)


def require_authenticated_client(request: Request) -> None:
    """错误上报须有有效登录凭据，开放访问模式不提供匿名上报。"""
    same_origin(request)
    if not authenticated_client(request):
        raise HTTPException(401, 'unauthorized')


def require_asset_auth(request: Request) -> dict[str, str]:
    args = _first_query_values(request)
    if not _authorized(request, request.app.state.settings.token, args):
        raise AssetLoginRequired()
    return args


def _query_token_matches(request: Request) -> bool:
    token = request.app.state.settings.token
    supplied = _first_query_values(request).get("t", "")
    return bool(token) and hmac.compare_digest(supplied.encode(), token.encode())


def query_auth_redirect(request: Request) -> str | None:
    """为已授权页面清除 URL 口令，保留原始编码、重复参数与播放时间。"""
    if not _query_token_matches(request):
        return None
    token = request.app.state.settings.token
    pairs = request.scope.get("query_string", b"").decode("latin-1").split("&")
    retained = [pair for pair in pairs if parse_qs(pair).get("t") != [token]]
    query = "&".join(retained)
    return (request.url.path or "/") + (f"?{query}" if query else "")


def set_auth_cookie(response: Response, request: Request, *, days: int = 30, login: bool = False) -> None:
    token = request.app.state.settings.token
    policy = _policy(request)
    response.headers["Cache-Control"] = "no-store"
    if token and policy["mode"] in {"password", "legacy"} and (login or _query_token_matches(request)):
        value, max_age = access.issue(policy, days, sessions(request), **_client(request))
        response.set_cookie(access.COOKIE, value, max_age=max_age, path="/", httponly=True,
                            samesite="lax", secure=request.url.scheme == "https")
        response.delete_cookie("tok", path="/")


#: Docker 首次设置或访问设置的来源不满足时给的那句话；页面上的同一句写在页面包里。
FIRST_ACCESS_DENIED_CODE = "setup.firstAccessDenied"


def login_mode(request: Request) -> str:
    """登录页画哪一种，由服务端判定后交给页面，页面不自己猜。

    有访问策略时是 `password`，框里填访问密码。没有策略（`legacy`）时，非 Docker 部署
    填自动生成的访问口令；Docker 已经配置过（全新部署走首次设置页）时改在这里设访问密码或选免登录
    （`setup`），来源须过 `local_client`：本机或私有网络、不带代理转发头。来源不满足的是
    `denied`，只能用口令登录（ADR-0149）。
    """
    if access.load(request.app.state.settings.access_path)["mode"] != "legacy":
        return "password"
    if not distribution.docker():
        return "legacy"
    return "setup" if local_client(request) else "denied"


def login_html(next_path: str, *, mode: str = "password", invalid: bool = False, error: str = "",
               language: str = interface_text.SOURCE_LANGUAGE) -> str:
    """登录页的薄壳：表单由页面包画，服务端只给净化过的 `next`、页面模式、口令是否错误与限流或参数错误的原因。

    `error` 只收文字，由调用方按 `language`（请求的语言）渲染好；标题与 `<html lang>` 跟着同一种语言。"""
    data = {"next": next_path}
    if mode != "password":
        data["mode"] = mode
    if invalid:
        data["invalid"] = "true"
    if error:
        data["error"] = error
    title = "pages.login.accessSetupTitle" if mode == "setup" else "pages.login.title"
    return page_shell(interface_text.text(f"server:{title}", None, language), "login", data, language=language)


def _page_language(request: Request) -> str:
    return interface_text.request_language(request.headers.get("accept-language"))


def _page_error(detail: object, language: str) -> str:
    """接口报错的明细按页面语言渲染成一句：带 `message_code` 的取译文，其余照原文。"""
    if isinstance(detail, dict):
        code = detail.get("message_code")
        if isinstance(code, str) and code:
            return interface_text.text(f"server:{code}", detail.get("message_params") or {}, language)
        return str(detail.get("message", ""))
    return str(detail)


def safe_next(value: object) -> str:
    """只接受浏览器会按站内路径解析的跳转目标。"""
    if not isinstance(value, str) or not value.startswith("/") or value.startswith("//") or "\\" in value:
        return "/"
    return "/" if any(ord(character) < 32 or ord(character) == 127 for character in value) else value


def _wants_page(request: Request) -> bool:
    """浏览器表单提交的 `Accept` 里有 `text/html`，出错时回登录页并原位报错；其余调用方回 JSON。"""
    return "text/html" in request.headers.get("accept", "")


@router.get("/login", response_class=HTMLResponse)
def login(request: Request, next: str = "/"):
    next_path = safe_next(next)
    if _authorized(request, request.app.state.settings.token,
                   _first_query_values(request)):
        return RedirectResponse(next_path, status_code=303)
    return HTMLResponse(login_html(next_path, mode=login_mode(request), language=_page_language(request)))


@router.post("/login")
async def login_submit(request: Request):
    same_origin(request)
    next_path = safe_next(request.query_params.get("next", "/"))
    try:
        _login_attempt(request)
        form = await _login_form(request)
    except HTTPException as exc:
        if not _wants_page(request):
            raise
        mode, language = login_mode(request), _page_language(request)
        return HTMLResponse(login_html(next_path, mode=mode, error=_page_error(exc.detail, language), language=language),
                            status_code=exc.status_code, headers=exc.headers)
    next_path = safe_next((form.get("next") or [next_path])[0])
    mode, language = login_mode(request), _page_language(request)
    token = request.app.state.settings.token
    supplied = (form.get("token") or [""])[0]
    policy = access.load(request.app.state.settings.access_path)
    if token and policy["mode"] != "open" and not await run_in_threadpool(access.verify, policy, supplied, token):
        return HTMLResponse(login_html(next_path, mode=mode, invalid=True, language=language), status_code=401)
    try:
        days = int((form.get("days") or ["0"])[0])
        if not 0 <= days <= 365:
            raise ValueError
    except ValueError:
        fields = message_fields("api.auth.invalidRememberDays")
        if _wants_page(request):
            return HTMLResponse(login_html(next_path, mode=mode, error=_page_error(fields, language), language=language),
                                status_code=400)
        raise HTTPException(400, fields) from None
    response = RedirectResponse(next_path, status_code=303)
    try:
        set_auth_cookie(response, request, days=days, login=True)
    except OSError:
        fields = message_fields("api.auth.sessionNotSaved")
        if _wants_page(request):
            return HTMLResponse(login_html(next_path, mode=mode, error=_page_error(fields, language), language=language),
                                status_code=503)
        raise HTTPException(503, fields) from None
    return response


async def _login_form(request: Request) -> dict[str, list[str]]:
    """登录表单的大小和字段数独立于传输方式，在缓冲和解析时分别限制。"""
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > _LOGIN_FORM_LIMIT:
            raise HTTPException(413, message_fields("api.auth.loginFormTooLarge"))
        body.extend(chunk)
    try:
        return parse_qs(body.decode("utf-8", "replace"), keep_blank_values=True,
                        max_num_fields=_LOGIN_FORM_FIELDS)
    except ValueError:
        raise HTTPException(400, message_fields("api.auth.loginFormInvalid")) from None
