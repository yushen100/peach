"""JSON 契约的 HTTP 出口。

绝大多数端点不在这里逐个声明：`/api/{route:path}` 把路径交给 `web_router` 的两张
处理器表，加一个 API 只需要在那里注册。这里只留三类必须自己写的：
探测类（providers、sources）、本机副作用（reveal）和流式上传（taste/import）。

注册顺序有意义。`/api/{route:path}` 是 catch-all，`api.py` 必须最后 include 这个
router；同理本模块内部两条 catch-all 写在文件末尾，具名端点写在前面。
`/api/stream-plan` 与 `/api/stream-cancel` 在 `routes_media` 里，那个 router 也要
先 include。
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from browserexport.common import BrowserexportError
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from . import push_discovery, web_contract, web_tasks
from .field_owners import RevisionConflict
from .folder_rules import FolderRuleConflict
from .interaction import reveal_path
from .jobs import TaskRunConflict
from .update_tasks import UpdateBusy
from .platform import is_unmapped, translate_ledger_path
from .providers import ProviderUnavailable
from .routes_auth import require_auth
from .task_runs import task_label
from .task_control import Cancelled as TaskCancelled
from .taste_history import analyze_history, import_history_exports, write_manifest
from .user_messages import UserFacingError, UserValueError, error_fields, message_fields, response_status

router = APIRouter()

LOGGER = logging.getLogger(__name__)


@router.get("/api/providers")
def provider_health(request: Request, args: dict[str, str] = Depends(require_auth)):
    return request.app.state.providers.health()


@router.get("/api/sources")
def source_health(request: Request, args: dict[str, str] = Depends(require_auth)):
    """无副作用的来源可达性。前端据此把脱盘来源的筛选置灰。"""
    rows = request.app.state.mount_reachability.sources()
    rows.append({"location": "online", "declared": None, "resolved": None,
                 "mapped": True, "online": True, "state": "ok", "message": ""})
    return {
        "ok": True,
        "sources": rows,
        "offline": [row["location"] for row in rows if row["online"] is False],
        "offline_roots": [root["root_id"] for row in rows for root in row.get("roots", [])
                          if root.get("root_id") and root["online"] is False],
    }


@router.get("/api/libraries")
def media_library_list(request: Request, args: dict[str, str] = Depends(require_auth)):
    from . import media_libraries, settings_file
    from .media_sources import cost_for
    config = settings_file.active()
    return {"libraries": [{"id": row["id"], "name": row["name"], "icon": row["icon"], "folders": len(row["roots"]),
                           "color": row["color"], "policy": row["policy"], "stages": row["stages"],
                           "roots": [{"root_id": root["root_id"], "location": root["location"]} for root in row["roots"]],
                           "metered": any(cost_for(root['location'], root['root'], config) == 'metered'
                                          for root in row['roots'])}
                          for row in media_libraries.libraries(config)]}


def _own_data_path(raw: str) -> Path | None:
    """把前端递回来的路径收回到 Peach 自己的数据目录里，越界的一律返回 `None`。

    页面上看得见的本机路径只有这一类：凭据文件、问题日志、卸载会删的那几个目录，
    全都是服务端按 `DIRECTORY_KEYS` 自己算出来发下去的。所以这里不信任递回来的那
    一串，而是拿同一份设置重算一遍边界再比对——`resolve()` 之后 `..` 与符号链接都
    已经落到真实位置上，能过这一关的只可能是服务端本来就展示过的东西。
    """
    from . import settings_file

    if not raw.strip():
        return None
    config = settings_file.active()
    try:
        target = Path(raw).expanduser().resolve()
    except OSError:
        return None
    for root in [config.data_root, *(config.directory(key) for key in settings_file.DIRECTORY_KEYS)]:
        try:
            resolved = root.resolve()
        except OSError:
            continue
        if target == resolved or target.is_relative_to(resolved):
            return target
    return None


@router.post("/api/reveal")
def reveal(request: Request, body: dict[str, Any] = Body(default_factory=dict), args: dict[str, str] = Depends(require_auth)):
    """定位文件；无桌面时返回服务端路径。媒体按 `id`，应用数据按 `path`。

    媒体那条用于「跳过去自己整理网盘目录」：A:/B: 是 CloudDrive 挂上来的盘符，在
    资源管理器里和本地目录没有区别。它的路径一律由服务端按 asset id 查出来——
    `q_item` 刻意不把 `path` 发给前端，这里不能反过来让前端把路径传进来，所以
    `id` 在场时 `path` 连看都不看。

    `path` 那条留给页面上本来就印着全路径的几处（凭据文件、问题日志、数据目录）：
    人读到路径，下一步就是去那儿看一眼。边界仍在服务端（`_own_data_path`）。

    写不进 ledger，所以不受 reader 的只读闸门约束；但它会在**服务端所在的
    机器**上弹窗，从 Mac 浏览时弹在 Windows 那台，也正是文件所在的机器。
    """
    if body.get("id") is None and body.get("path") is not None:
        # 这一条的原因要一路显示到路径旁边，所以每种都自带一句中文：页面那层的统一错误
        # 映射按状态码说话，410／501 落在它的表外，只剩一句「操作未完成」。
        target = _own_data_path(str(body.get("path") or ""))
        if target is None:
            return JSONResponse({"error": "path not in the data root",
                                 **message_fields("api.routes.revealOutsideDataRoot")}, status_code=403)
        if not target.exists():
            return JSONResponse({"error": "file missing",
                                 **message_fields("api.routes.revealMissing")}, status_code=410)
        try:
            if not reveal_path(target):
                from .nas_directories import file_position
                return {"ok": True, **file_position(target)}
        except OSError as error:
            LOGGER.warning("reveal failed for %s: %s", target, error)
            return JSONResponse({"error": "reveal failed",
                                 **message_fields("api.routes.revealFailed")}, status_code=500)
        return {"ok": True, "path": str(target)}
    try:
        asset_id = int(body.get("id"))
    except (TypeError, ValueError):
        return JSONResponse({"error": "id must be an integer"}, status_code=400)
    asset = request.app.state.repository.media_asset(asset_id)
    if asset is None or not asset.path:
        return JSONResponse({"error": "not found"}, status_code=404)
    target = translate_ledger_path(asset.path)
    if is_unmapped(target):
        return JSONResponse(
            {"error": "source not mapped", "location": asset.location},
            status_code=409)
    from . import media_io
    try:
        present = media_io.bounded(media_io.mount_key(target), target.exists)
    except OSError:
        # 网盘在期限内答不上：说明是盘没响应，不当成文件已删去提示对账。
        return JSONResponse({"error": "source unreachable", "location": asset.location,
                             **message_fields("api.routes.revealUnreachable")}, status_code=503)
    if not present:
        # 文件已经不在了——正是「删完回来同步」的入口，前端据此提示对账。
        return JSONResponse(
            {"error": "file missing", "location": asset.location},
            status_code=410)
    try:
        if not reveal_path(target):
            from .nas_directories import file_position
            return {"ok": True, **file_position(target, asset.path), "id": asset_id,
                    "location": asset.location}
    except OSError as error:
        LOGGER.warning("reveal failed for asset %s: %s", asset_id, error)
        return JSONResponse({"error": "reveal failed"}, status_code=500)
    return {"ok": True, "id": asset_id, "location": asset.location}


@router.get("/api/providers/opencode-go/models")
def opencode_go_models(request: Request, args: dict[str, str] = Depends(require_auth)):
    try:
        models = request.app.state.opencode_go.list_models()
    except ProviderUnavailable:
        return JSONResponse({"error": "provider unavailable"}, status_code=502)
    return {"ok": True, "provider": "opencode-go", "models": models}


@router.post("/api/item-cover")
async def item_cover_set(
    request: Request,
    _args: dict[str, str] = Depends(require_auth),
):
    """编辑资料里换封面（ADR-0165）。请求体就是图片字节，`id` 与 `origin` 走查询参数，
    不用 multipart：与 `/api/taste/import` 同一个理由，不为一张图引入表单解析依赖。"""
    from .item_cover import MAX_BYTES, set_user_cover
    contract = request.app.state.web_contract
    try:
        asset_id = int(request.query_params.get("id") or 0)
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        return JSONResponse(message_fields("errors.itemEdit.malformed", key="error"), status_code=400)
    if declared > MAX_BYTES:
        return JSONResponse(message_fields("errors.itemCover.tooLarge", key="error"), status_code=413)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_BYTES:
            return JSONResponse(message_fields("errors.itemCover.tooLarge", key="error"), status_code=413)
    try:
        receipt = await asyncio.to_thread(set_user_cover, contract, asset_id, bytes(body),
                                          origin=str(request.query_params.get("origin") or "upload"))
    except UserFacingError as exc:
        return JSONResponse(error_fields(exc), status_code=response_status(exc))
    contract.cache_bust()
    return {"ok": True, "receipt": receipt, "item": web_contract.q_item(contract, asset_id)}


@router.post("/api/item-cover/restore")
async def item_cover_restore(
    request: Request,
    body: dict = Body(...),
    _args: dict[str, str] = Depends(require_auth),
):
    """换回刮削封面：有备份放回备份，没有就撤掉用户那张，等下一次采集补上。"""
    from .item_cover import restore_user_cover
    contract = request.app.state.web_contract
    asset_id = int(body.get("id") or 0)
    try:
        receipt = await asyncio.to_thread(restore_user_cover, contract, asset_id)
    except UserFacingError as exc:
        return JSONResponse(error_fields(exc), status_code=response_status(exc))
    contract.cache_bust()
    return {"ok": True, "receipt": receipt, "item": web_contract.q_item(contract, asset_id)}


@router.post("/api/taste/import")
async def taste_import(
    request: Request,
    _args: dict[str, str] = Depends(require_auth),
):
    """Stream one private history export to local storage, then import it.

    This deliberately avoids multipart/form-data and its extra parser dependency.  The
    browser sends the file bytes as-is and provides only a display filename header.
    """
    contract = request.app.state.web_contract
    maximum = 1024 * 1024 * 1024
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > maximum:
        return JSONResponse(message_fields("api.routes.importTooLarge", key="error"), status_code=413)
    filename = unquote(request.headers.get("x-peach-filename") or "history-export")
    filename = re.sub(r"[^\w.()\-\u3400-\u9fff]+", "-", os.path.basename(filename)).strip(".-")
    filename = filename[-160:] or "history-export"
    root = contract.taste_history_import_root
    root.mkdir(parents=True, exist_ok=True)
    temporary = root / f".{uuid.uuid4().hex}.part"
    imported_target: Path | None = None
    digest = hashlib.sha256()
    size = 0
    try:
        with temporary.open("xb") as handle:
            async for chunk in request.stream():
                size += len(chunk)
                if size > maximum:
                    raise OverflowError
                digest.update(chunk)
                await asyncio.to_thread(handle.write, chunk)
        if not size:
            raise UserValueError("api.routes.importEmpty")
        target = root / f"{digest.hexdigest()[:12]}-{filename}"
        if target.exists():
            temporary.unlink()
        else:
            os.replace(temporary, target)
            imported_target = target
        results = await asyncio.to_thread(
            import_history_exports, [target], contract.taste_history_store,
        )
        analysis = await asyncio.to_thread(
            analyze_history, contract.taste_history_store, contract.taste_history_root,
        )
        write_manifest(contract.taste_history_manifest, results, analysis)
        contract.cache_bust()
        return {
            "refresh": results,
            "dashboard": web_contract.q_taste(contract, {"window": "all"}),
        }
    except OverflowError:
        temporary.unlink(missing_ok=True)
        return JSONResponse(message_fields("api.routes.importTooLarge", key="error"), status_code=413)
    except (BrowserexportError, OSError, ValueError, TypeError) as exc:
        temporary.unlink(missing_ok=True)
        if imported_target is not None:
            imported_target.unlink(missing_ok=True)
        LOGGER.warning("taste history import rejected: %s", exc)
        return JSONResponse(error_fields(exc), status_code=400)


def _not_found(exc: KeyError) -> JSONResponse:
    """任务那两条路由的 404：带 code 的（`jobs.TaskRunMissing`）给原句与 code，
    别的 `KeyError` 照旧给原句。`str(KeyError(...))` 会把消息连引号一起带出来，取 args 才是那句话本身。"""
    if isinstance(exc, UserFacingError):
        return JSONResponse(error_fields(exc), status_code=404)
    return JSONResponse({"error": str(exc.args[0])}, status_code=404)


@router.get("/api/tasks/{run_id}")
def task_run_detail(request: Request, run_id: int,
                    _args: dict[str, str] = Depends(require_auth)):
    """任务中心里的某一轮。带路径参数，所以进不了 `web_router` 那两张精确匹配的表。"""
    try:
        return web_tasks.q_task(request.app.state.web_contract, run_id)
    except KeyError as exc:
        return _not_found(exc)


@router.post('/api/tasks/{run_id}/control')
def task_run_control(request: Request, run_id: int, body: dict = Body(default_factory=dict),
                     _args: dict[str, str] = Depends(require_auth)):
    from . import task_control
    contract = request.app.state.web_contract
    try:
        run = contract.task_runs.get(run_id)
        if (run is not None and run.active and run.task_key == 'library-processing'
                and body.get('action') != 'set_speed'):
            from .web_library_processing import _active_run, _current, w_library_processing
            current = _current(contract)
            active = _active_run(contract, current)
            if active is None or active.id != run_id:
                raise UserValueError('api.routes.taskChanged')
            if not contract.task_runs.enabled or run.host != contract.task_runs.host:
                return JSONResponse(message_fields('api.routes.taskOnOtherHost', key='error'), status_code=403)
            w_library_processing(contract, {'action': body.get('action'), 'job_id': current.get('job_id'),
                                             'speed_mode': body.get('speed_mode')})
        else:
            task_control.request(contract.task_runs, run_id, body.get('action'), mode=body.get('speed_mode'))
        contract.followups.wake()
        return web_tasks.q_task(contract, run_id)
    except KeyError as exc:
        return _not_found(exc)
    except PermissionError as exc:
        return JSONResponse({'error': str(exc)}, status_code=403)
    except ValueError as exc:
        return JSONResponse(error_fields(exc), status_code=409)


@router.post(push_discovery.WEBHOOK_PATH, status_code=204)
def clouddrive_inbox(request: Request, body: dict[str, Any] = Body(default_factory=dict)):
    """CloudDrive2 的文件变更通知。

    这条路不走 `require_auth`：推送方是一台服务，不是带着会话 cookie 的浏览器。三道门
    换成各自更硬的判据——来源必须是回环或局域网，请求头里的共享密钥必须对上，云端路径
    必须落在已配置的前缀表内。前两道不成立时回 404 而不是 401：这个端点对外不必承认
    自己存在。

    收下就返回，映射与登记都交给去抖队列。上游会等这个响应，在这里做任何遍历都可能把
    它堵住（见 `docs/reference-snapshots/amane-watcher.md`）。
    """
    service = request.app.state.push_discovery
    if not (service.available and service.config.enabled and service.config.cloud):
        raise HTTPException(404, message_fields("http.notFound"))
    host = request.client.host if request.client else ""
    if not push_discovery.allowed_source(host):
        LOGGER.warning("Push discovery rejected a request from %s", host or "an unknown address")
        raise HTTPException(404, message_fields("http.notFound"))
    if not service.secret.matches(request.headers.get(push_discovery.SECRET_HEADER, "")):
        LOGGER.warning("Push discovery rejected a request with a mismatched key")
        raise HTTPException(404, message_fields("http.notFound"))
    for cloud_path in push_discovery.parse_notification(body):
        try:
            service.submit_cloud(cloud_path)
        except push_discovery.CloudPathError as exc:
            # 一条路径映射不出来，同一批里的其余条目照常登记。
            LOGGER.info("Push discovery skipped a cloud path: %s", exc)
    return Response(status_code=204)


@router.get("/api/background-issues")
def background_issues(request: Request, _args: dict[str, str] = Depends(require_auth)):
    """任务中心「需要处理」：各后台服务此刻存在的问题。只读，不出网，不启动任何服务。"""
    from . import settings_file
    state = request.app.state
    try:
        config = settings_file.load_config()
    except settings_file.SettingsFileError:
        # 设置文件本身坏了由配置页报；依赖它的几项这一次读不出来，其余照常。
        config = None
    if config is not None and not config.present:
        config = None
    return {"issues": state.background_issues.collect(state, state.web_contract, config)}


def _conflict(error: TaskRunConflict) -> JSONResponse:
    """手动触发撞上在跑的那一轮：409，并带上挡路那一轮的 id。

    不用 500 也不用 200：这不是故障，用户的请求也没有生效。前端拿 `blocking_run_id`
    直接跳到活动页上的那一行，比一句「已有任务在进行」有用得多。

    `message` 是给人看的那句话（带 `message_code`），任务名在这里用 `task_label` 填进参数：
    异常自己住在 `jobs` 里，那一层在 `task_runs` 下面，拿不到任务名表。
    """
    return JSONResponse(
        {"error": "task already running", "task_key": error.task_key,
         "blocking_run_id": error.blocking_run_id,
         **message_fields("api.routes.taskAlreadyRunning", {"task": task_label(error.task_key)})},
        status_code=409)


#: 走通用契约入口、却是运行 Peach 那台电脑的配置：生成预览与编解码方式、时间轴缩略图档位。
#: 只有配置页读写它们，读写都按 `/api/configuration/*` 的本机判据放行，非本机一律 403。
#: 判据由组装点 `api.create_app` 挂在 `app.state.local_only`：路由模块之间只许依赖 `routes_auth`。
LOCAL_ONLY_ROUTES = frozenset({"/api/media-processing", "/api/thumbnail-jobs"})


def _json(payload) -> Response:
    """契约读接口的 JSON 响应，字节与 FastAPI 默认的那一份相同。

    FastAPI 默认先用 `jsonable_encoder` 把整份结果逐个值走一遍再交给 `json.dumps`；
    复核队列一份二十多 MB，光这一遍就要近五秒。契约结果本来就是 JSON 原生类型，只把
    认不出的值（路径、时间等）交给它。
    """
    if isinstance(payload, Response):
        return payload
    try:
        content = json.dumps(payload, ensure_ascii=False, allow_nan=False,
                             separators=(",", ":"), default=jsonable_encoder).encode("utf-8")
    except TypeError:
        # JSON 原生键之外的日期、路径等，沿用框架转换键和值的规则。
        return JSONResponse(jsonable_encoder(payload))
    return Response(content, media_type="application/json")


@router.get("/api/{route:path}")
def api_get(request: Request, route: str, args: dict[str, str] = Depends(require_auth)):
    if f"/api/{route}" in LOCAL_ONLY_ROUTES:
        request.app.state.local_only(request)
    state = request.app.state
    sync = state.sync
    try:
        payload = web_contract.dispatch_api_get(
            state.web_contract, f"/api/{route}", args)
        if route == "review" and sync is not None and sync.read_only:
            payload = state.review_mirror.resolve(payload)
    except TaskRunConflict as exc:
        return _conflict(exc)
    except TaskCancelled:
        return JSONResponse(message_fields('api.routes.taskCanceled', key='error'), status_code=409)
    except UpdateBusy as exc:
        return JSONResponse({'error': 'update in progress', **message_fields(exc.code, exc.params)}, status_code=409)
    except FolderRuleConflict as exc:
        return JSONResponse({'error': 'folder rule conflict', **message_fields(exc.code, exc.params)}, status_code=409)
    except KeyError:
        return JSONResponse({"error": "not found"}, status_code=404)
    except UserFacingError as exc:
        # 带 code 的拒收（含 `UserValueError`）给原句与 code，不加异常类名前缀；5xx 照旧记进日志。
        status = response_status(exc)
        if status >= 500:
            LOGGER.exception("unhandled GET contract error for /api/%s", route)
        return JSONResponse(error_fields(exc), status_code=status)
    except (TypeError, ValueError) as exc:
        return JSONResponse({"error": f"{type(exc).__name__}: {exc}"}, status_code=400)
    except Exception:
        LOGGER.exception("unhandled GET contract error for /api/%s", route)
        return JSONResponse({"error": "internal server error"}, status_code=500)
    # 序列化留在 try 外：结果编码失败与以前一样是一个 500，不被上面翻成 400。
    return _json(payload)


@router.post("/api/{route:path}")
def api_post(
    request: Request,
    route: str,
    body: dict[str, Any] = Body(default_factory=dict),
    _args: dict[str, str] = Depends(require_auth),
):
    sync = request.app.state.sync
    route_path = f"/api/{route}"
    if route_path in LOCAL_ONLY_ROUTES:
        request.app.state.local_only(request)
    if (sync is not None and sync.read_only
            and route_path not in web_contract.READ_ONLY_POST_ROUTES):
        # 非写入端或冲突状态都只读；继续写只会产生无法自动合并的分叉。
        # 但只读的 POST 要放行：它们用 POST 只是因为要带请求体，并不碰账本。
        # `detail` 是诊断信息，`message` 是给用户的可读解释与恢复方式。
        return JSONResponse(
            {
                "error": "ledger read-only",
                "detail": sync.detail,
                "message": sync.read_only_message,
                "message_code": sync.read_only_phrase["code"],
                "message_params": sync.read_only_phrase.get("params", {}),
            },
            status_code=409,
        )
    try:
        return web_contract.dispatch_api_post(
            request.app.state.web_contract, route_path, body)
    except TaskCancelled:
        return JSONResponse(message_fields('api.routes.taskCanceled', key='error'), status_code=409)
    except TaskRunConflict as exc:
        return _conflict(exc)
    except UpdateBusy as exc:
        return JSONResponse({'error': 'update in progress', **message_fields(exc.code, exc.params)}, status_code=409)
    except KeyError:
        return JSONResponse({"error": "not found"}, status_code=404)
    except RevisionConflict as exc:
        # 客户端手上的取值已经不是账本现在这一个。回 409 并带上现值，页面据此刷新
        # 再让人重判；当成 400 的话，「你填错了」和「有人先改了」读起来一模一样。
        return JSONResponse(
            {
                "error": "field revision conflict",
                "message": str(exc),
                "expected_revision": exc.expected,
                "revisions": {str(key): value for key, value in exc.revisions.items()},
            },
            status_code=409,
        )
    except (UserFacingError, TypeError, ValueError) as exc:
        # 拒收原因只落本机错误日志，诊断包据此解释页面上的 4xx；4xx 不远程上报。
        # 带 code 的拒收（含 `UserValueError`）给原句与 code，不加异常类名前缀。
        from .error_reporting import event
        coded = isinstance(exc, UserFacingError)
        status = response_status(exc) if coded else 400
        event('http-request', exc, method='POST', route=route_path.lstrip('/'), status_code=status)
        return JSONResponse(error_fields(exc) if coded else {"error": f"{type(exc).__name__}: {exc}"},
                            status_code=status)
    except Exception:
        LOGGER.exception("unhandled POST contract error for /api/%s", route)
        return JSONResponse({"error": "internal server error"}, status_code=500)
