"""JAV 用户脚本的专用权限端点与本机配对设置。"""
import json
from html import escape

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response

from . import interface_text
from .config import PROJECT_ROOT
from .jav_browser import code_key, identify_source, page_edition, whole_release
from .routes_auth import require_auth
from .user_messages import error_detail, message_fields


def browser_client(request: Request):
    service = request.app.state.jav_browser
    authorization = request.headers.get("authorization", "")
    token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
    if not service.authorized(token):
        raise HTTPException(401, message_fields("api.javBrowser.tokenRequired"))
    if not service.downloads.available:
        raise HTTPException(403, message_fields("api.javBrowser.primaryOnly"))
    return service


def userscript():
    script = (PROJECT_ROOT / "web" / "integrations" / "peach-jav.user.js").read_bytes()
    return Response(script, media_type="application/javascript", headers={"Cache-Control": "no-cache"})


def userscript_bridge(request: Request):
    """用户脚本连接用的空页面；标题与 `<html lang>` 按请求的语言。"""
    language = interface_text.request_language(request.headers.get("accept-language"))
    title = escape(interface_text.text("server:pages.userscriptBridge.title", None, language))
    return HTMLResponse(f'<!doctype html><html lang="{escape(language, quote=True)}"><head><meta charset="utf-8">'
                        '<meta name="peach-userscript-bridge" content="1">'
                        f'<title>{title}</title></head><body></body></html>',
                        headers={"Cache-Control": "no-store", "X-Frame-Options": "SAMEORIGIN",
                                 "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; base-uri 'none'"})


def status(code: str, service=Depends(browser_client)):
    try:
        return JSONResponse({**service.status(code), **service.want_state(code)}, headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def active(service=Depends(browser_client)):
    return JSONResponse(service.active(), headers={"Cache-Control": "no-store"})


def identify(source_url: str, code: str = "", service=Depends(browser_client)):
    try:
        # 分段发售的商品页（`sora00613a`）按整片番号查状态与添加。
        status = service.status(whole_release(identify_source(source_url, code), source_url, service.edition_probe))
        # 作品同时有特典版与通常版时带回来源页是哪一版，用户脚本据此给出两个添加按钮。
        edition = page_edition(source_url, service.edition_probe)
        return JSONResponse({**status, **service.want_state(status["code"]), **({"edition": edition} if edition else {})},
                            headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def updates(request: Request, service=Depends(browser_client)):
    from .client_updates import snapshot
    return JSONResponse(snapshot(request.app.state.automatic_updates), headers={'Cache-Control': 'no-store'})


def people(request: Request, codes: str, performers: list[str] = Query(default=[]), service=Depends(browser_client)):
    from .web_jav_browser_people import cached_people
    try:
        result = cached_people(service.contract, request.app.state.preview_service, codes, performers)
        return JSONResponse(result, headers={'Cache-Control': 'no-store'})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def performer(request: Request, source_url: str, names: list[str] = Query(default=[]),
              service=Depends(browser_client)):
    from .web_jav_browser_performer import performer_status
    try:
        result = performer_status(service.contract, request.app.state.preview_service, source_url, names)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def follow_performer(request: Request, body: dict = Body(...), service=Depends(browser_client)):
    from .web_jav_browser_performer import follow_performer as follow
    try:
        result = follow(service.contract, request.app.state.preview_service, body)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def retry_postprocess(body: dict = Body(...), service=Depends(browser_client)):
    try:
        return JSONResponse(service.retry_postprocess(body.get("code")), headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def prioritize(body: dict = Body(...), service=Depends(browser_client)):
    try:
        return JSONResponse(service.prioritize(body.get("code")), headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def want(body: dict = Body(...), service=Depends(browser_client)):
    """从用户脚本登记想要，与想要清单的「按番号添加」同一入口（ADR-0161）；已登记的原样返回。"""
    from .web_wants import w_wants
    try:
        code = code_key(body.get("code"))
        result = w_wants(service.contract, {"action": "add", "code": code})
        return JSONResponse({**service.status(code), "want": {"phase": result["want"]["phase"], "created": result["created"]}},
                            headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def dismiss(body: dict = Body(...), service=Depends(browser_client)):
    try:
        return JSONResponse(service.dismiss(body), headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def add(body: dict = Body(...), service=Depends(browser_client)):
    try:
        return JSONResponse(service.add(body), headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


async def errors(request: Request, service=Depends(browser_client)):
    body = bytearray()
    async for part in request.stream():
        body.extend(part)
        if len(body) > 16 * 1024:
            raise HTTPException(413, message_fields("api.javBrowser.errorReportTooLong"))
    try:
        data = json.loads(body)
    except (ValueError, UnicodeError):
        raise HTTPException(400, message_fields("api.javBrowser.errorReportInvalid")) from None
    return JSONResponse(service.diagnostics.record(data), headers={"Cache-Control": "no-store"})


def settings(request: Request):
    return JSONResponse(request.app.state.jav_browser.settings(), headers={"Cache-Control": "no-store"})


def configure(request: Request, body: dict = Body(...)):
    try:
        return JSONResponse(request.app.state.jav_browser.configure(body), headers={"Cache-Control": "no-store"})
    except ValueError as error:
        raise HTTPException(400, error_detail(error)) from None


def create_router(local_only) -> APIRouter:
    router = APIRouter()
    router.add_api_route("/integrations/peach-jav.user.js", userscript, methods=["GET"])
    router.add_api_route("/integrations/peach-userscript-bridge", userscript_bridge, methods=["GET"],
                        dependencies=[Depends(require_auth)])
    router.add_api_route("/api/jav-browser", status, methods=["GET"])
    router.add_api_route("/api/jav-browser/active", active, methods=["GET"])
    router.add_api_route("/api/jav-browser/identify", identify, methods=["GET"])
    router.add_api_route("/api/jav-browser/updates", updates, methods=["GET"])
    router.add_api_route("/api/jav-browser/people", people, methods=["GET"])
    router.add_api_route("/api/jav-browser", add, methods=["POST"])
    router.add_api_route("/api/jav-browser/postprocess", retry_postprocess, methods=["POST"])
    router.add_api_route("/api/jav-browser/prioritize", prioritize, methods=["POST"])
    router.add_api_route("/api/jav-browser/performer", performer, methods=["GET"])
    router.add_api_route("/api/jav-browser/performer", follow_performer, methods=["POST"])
    router.add_api_route("/api/jav-browser/dismiss", dismiss, methods=["POST"])
    router.add_api_route("/api/jav-browser/want", want, methods=["POST"])
    router.add_api_route("/api/jav-browser/errors", errors, methods=["POST"])
    permissions = [Depends(require_auth), Depends(local_only)]
    router.add_api_route("/api/configuration/jav-browser", settings, methods=["GET"], dependencies=permissions)
    router.add_api_route("/api/configuration/jav-browser", configure, methods=["POST"], dependencies=permissions)
    return router
