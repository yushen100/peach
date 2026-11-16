"""应用组装点：把依赖建好挂到 `app.state`，再按顺序把各 router include 进来。

路由按用途拆分，各自 import 需要的东西，运行期依赖一律从
`request.app.state` 取：

| 模块 | 管什么 |
| --- | --- |
| `routes_auth` | 口令闸门与登录页，三个 `require_*` 依赖 |
| `routes_pages` | 单页界面、静态资产与全部前端路由落点 |
| `routes_configuration` | 本机配置与账号设置 |
| `routes_jav_browser` | JAV 用户脚本的专用权限、添加与状态查询 |
| `routes_media` | 播放、分片、缩图、封面、头像、外链圆标 |
| `routes_subtitles` | 字幕转换、按界面语言搜索与加载 SubtitleCat 字幕 |
| `routes_api` | JSON 契约出口，含两条 `/api/{route:path}` catch-all |

`include_router` 的顺序是契约的一部分，不是排版：FastAPI 按注册顺序匹配，
`routes_api` 的两条 catch-all 会吃掉一切 `/api/...`，所以它必须最后。
`/api/stream-plan` 和 `/api/stream-cancel` 住在 `routes_media`，那个 router 也因此
要排在 `routes_api` 前面。

留在本文件里的只有全应用一份的东西：依赖装配、`lifespan`、异常处理器、`/vendor`
挂载、响应头与压缩中间件、启动迁移期间的请求闸门和 `/healthz`。
"""
import asyncio
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from urllib.parse import quote

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.datastructures import MutableHeaders
from starlette.middleware.gzip import DEFAULT_EXCLUDED_CONTENT_TYPES, GZipMiddleware

from . import (__version__, browser_transport, distribution, feeds, interface_text, ledger_backups, tunnel, web_contract,
               web_feeds, web_follow, web_settings)
from . import routes_api, routes_auth, routes_configuration, routes_jav_browser, routes_media, routes_pages, routes_subtitles
from .buildinfo import frozen_build
from .config import LOCATION_ROOT_DECLARATIONS, MEDIA_ROOT_DECLARATIONS, PeachSettings
from .ffmpeg import FFmpegResolver
from .follow_scheduler import FEED_JOB_ID, FEED_UNAVAILABLE_CODE, FollowScheduleConfig, FollowUpdateScheduler
from .follow_covers import FollowCoverService
from .follow_faces import FollowFaceIndex
from .follow_stream import FollowMediaResolver
from .http import HttpxTransport
from .remote_media_cache import MEDIA_SECURITY_HEADERS
from .health import inspect_database
from .media import (
    FilesystemBackend,
    MediaEngine,
    MediaNotFound,
    MediaOffline,
    MediaUnavailable,
)
from .mdns import create_mdns_publisher
from .mount_reachability import MountReachability
from .mp4repair import HeaderRepairStore
from .platform import location_mounts
from .previews import (
    COVER_SMALL_THUMB_EDGE,
    COVER_SMALL_THUMB_QUALITY,
    COVER_THUMB_EDGE,
    COVER_THUMB_QUALITY,
    DerivedImageService,
    PhotoThumbnailService,
    PreviewService,
    cover_thumb_root,
    entity_thumb_root,
)
from .follow_secrets import credential_store_for
from .push_discovery import PushDiscoveryService
from .web_downloads import build_download_service
from .web_local_access import local_client
from .sample_images import SampleCache
from .sample_images import cache_root as sample_cache_root
from .providers import OpenCodeGoClient, default_registry
from .repository import LedgerDatabase, LedgerRepository
from .review_mirror import ReviewMirror
from .routes_auth import FIRST_ACCESS_DENIED_CODE, AssetLoginRequired, PageLoginRequired
# 两档缓存时长的实现在 `routes_media`，这里再导出：它们是对外的缓存契约，
# tests/test_follow_web.py 按 `api.MEDIA_CACHE_SECONDS` 断言两者的关系。
from .routes_media import AVATAR_CACHE_SECONDS, MEDIA_CACHE_SECONDS  # noqa: F401
from .segments import HlsSegmentService
from .streaming import StreamSessionRegistry
from .sync import LedgerSync
from .transcodes import TranscodeService
from .user_messages import UserFacingError, error_fields, message_fields, nested_message, response_status


LOGGER = logging.getLogger(__name__)

#: 这个进程的构建身份，打包时埋在包根，进程内不变。源码运行时没有第二份代码，是 None。
#: 换生产托盘的脚本靠它确认跑起来的正是这次打出的包：版本号一次发布只推一格，同一个
#: 版本号下会有很多个构建，只比版本号证明不了二进制真的换掉了。
BUILD = frozen_build()

#: gzip 不碰的内容类型。Starlette 的默认名单已经排掉 `video/*`、`audio/*` 和各种
#: 已压缩的图片，这里再补两个它没排、而 Peach 会真的撞上的：
#: `application/octet-stream` 是通用字节流；`text/plain` 是 `FileResponse` 猜不出
#: 扩展名时的兜底值，`/stream` 与 `/photo` 都不传 media_type，一个没登记过扩展名的
#: 媒体文件会以 `text/plain` 出去——压它纯属烧 CPU。Peach 自己有意发的
#: `text/plain` 只有 "missing" 这类错误提示，本来就在 `minimum_size` 之下。
COMPRESSION_EXCLUDED_TYPES = (
    *DEFAULT_EXCLUDED_CONTENT_TYPES, "application/octet-stream", "text/plain",
)


class ResponseHeadersMiddleware:
    """在 ASGI 响应头阶段设置缓存与安全策略，原样传递连接和异常。"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        async def send_headers(message):
            if message['type'] == 'http.response.start':
                headers = MutableHeaders(scope=message)
                if scope['path'].startswith('/vendor/'):
                    headers['Cache-Control'] = 'public, max-age=31536000, immutable'
                elif 'cache-control' not in headers:
                    headers['Cache-Control'] = 'no-store'
                headers['X-Content-Type-Options'] = 'nosniff'
                kind = headers.get('content-type','').split(';',1)[0].strip().lower()
                if kind.startswith(('image/','video/','audio/')):
                    headers.update(MEDIA_SECURITY_HEADERS)
                if (message['status']==200 and kind=='text/html' and scope['method']=='GET'
                        and Request(scope).cookies.get('peach_media_policy')!='1'):
                    headers['Clear-Site-Data']='"cache"'
                    policy=Response()
                    policy.set_cookie('peach_media_policy','1',max_age=365*86400,httponly=True,
                                      secure=scope['scheme']=='https',samesite='strict')
                    headers.append('set-cookie',policy.headers['set-cookie'])
                headers['Referrer-Policy'] = 'same-origin'
                headers['X-Robots-Tag'] = routes_pages.ROBOTS_TAG
            await send(message)

        await self.app(scope, receive, send_headers)


class FirstSetupSourceMiddleware:
    """Docker 首次设置完成前，服务没有口令也没有访问策略，谁连得上谁就能调接口（ADR-0149）。

    这段时间 `/api/` 与写请求只收 `local_client` 认的来源：本机或私有网络、不带代理转发头。
    页面壳与静态资源照常给，来源不满足的浏览器也能看到首次设置页上那句说明。配置完成后
    服务换成正常模式，由口令与访问策略把关，这一层不再起作用。
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and distribution.docker():
            request = Request(scope)
            settings = request.app.state.settings
            if (not settings.configured
                    and (scope["path"].startswith("/api/") or scope["method"] not in {"GET", "HEAD"})
                    and not local_client(request)):
                response = JSONResponse({**message_fields(FIRST_ACCESS_DENIED_CODE, key="error"),
                                         "docker": True}, status_code=403)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


#: 启动迁移期间，需要账本的请求回 503 时带的那一句（ADR-0159）；前端认这个 code 立即查一次更新状态。
LEDGER_MIGRATING_CODE = "api.ledger.migrating"
#: 迁移期间照常回应、且不碰账本的两个接口：服务状态与页面顶部横幅的更新状态。
MIGRATION_OPEN_PATHS = frozenset({"/healthz", "/api/client-updates"})


class LedgerMigration:
    """服务启动时的账本结构迁移。

    `running`：正在整份备份并迁移，需要账本的请求一律回 503（`LedgerMigrationGate`）；
    `failed`：迁移没做完，后台服务不启动，`error` 是原因（带 code 的异常写成嵌套参数）。
    其余时候是 `idle`。只读设备、未配置与安装确认期都不走这条路，状态一直是 `idle`。

    进行中的 `stage`：`backup` 整份备份账本，`progress` 是已复制页数占总页数的百分比（0–100 的整数）；
    `apply` 执行迁移脚本，不报百分比。备份线程写、请求线程读，各字段都是整体赋值。
    """

    def __init__(self):
        self.state = "idle"
        self.error: dict | str = ""
        self.stage = "backup"
        self.progress = 0

    @property
    def running(self) -> bool:
        return self.state == "running"

    def begin(self) -> None:
        self.stage, self.progress = "backup", 0
        self.state = "running"

    def report(self, stage: str, progress: int | None) -> None:
        """`migrations.upgrade` 的 `progress` 回调。"""
        if progress is not None:
            self.progress = progress
        self.stage = stage

    def fail(self, error: BaseException) -> None:
        self.state, self.error = "failed", nested_message(error)

    def payload(self) -> dict:
        """`/healthz` 与 `/api/client-updates` 里的迁移状态；进行中带阶段与备份进度，失败时带原因，页面按界面语言显示。"""
        if self.state == "failed":
            return {"state": "failed", **message_fields("api.ledger.migrationFailed", {"error": self.error})}
        if self.state == "running":
            stage = self.stage
            return {"state": "running", "stage": stage, **({"progress": self.progress} if stage == "backup" else {})}
        return {"state": self.state}


def ledger_migrating(app) -> bool:
    migration = getattr(app.state, "ledger_migration", None)
    return bool(migration is not None and migration.running)


class LedgerMigrationGate:
    """启动迁移进行中，挡下需要账本的请求：`/api/` 与媒体路由回 503，带 `api.ledger.migrating`。

    页面壳、登录、静态资源与 `MIGRATION_OPEN_PATHS` 照常回应，页面自己在迁移期间不读账本
    （`routes_pages` 跳过教程进度与实体页形状）；前端据此在顶部横幅显示「正在更新本地数据库」。
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and ledger_migrating(scope["app"]) and _gated(scope):
            response = JSONResponse({**message_fields(LEDGER_MIGRATING_CODE, key="error"), "ledger_migration": "running"},
                                    status_code=503, headers={"Retry-After": "5", "Cache-Control": "no-store"})
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)


def _gated(scope) -> bool:
    """`/api/` 与 `routes_media` 的路由（媒体、封面、缩图都要先查账本才知道文件在哪）；只在迁移期间逐条匹配。"""
    path = scope["path"]
    if path in MIGRATION_OPEN_PATHS:
        return False
    return path.startswith("/api/") or any(route.path_regex.match(path) for route in routes_media.router.routes)


def _migration_pending(settings, contract) -> bool:
    """这次启动要先迁移：结构待迁移，且本机是能写账本的已配置写入端（与 `_start_ledger_services` 同一判据）。"""
    if not getattr(getattr(contract, "upgrade_repairs", None), "available", False):
        return False
    return inspect_database(settings.db_path)["schema"] == "pending"


#: Starlette 自己抛的那几种 HTTPException 带的是英文 detail，给人看之前换成 code 和渲染好的一句。
_DEFAULT_DETAILS = {
    "Not Found": message_fields("http.notFound", key="error"),
    "Method Not Allowed": message_fields("http.methodNotAllowed", key="error"),
}


def _navigation(request: Request) -> bool:
    """浏览器地址栏直接打开页面路径：报错给一页话，`/api/` 与脚本取数（Accept 里没有 text/html）回 JSON。"""
    return (request.method in {"GET", "HEAD"} and not request.url.path.startswith("/api/")
            and "text/html" in request.headers.get("accept", ""))


def _error_page(request: Request, status: int, body: dict) -> str:
    """导航撞上的错误页：说明按浏览器的 `Accept-Language` 渲染，没有 code 的照原文。"""
    language = interface_text.request_language(request.headers.get("accept-language"))
    code = body.get("message_code")
    detail = (interface_text.text(f"server:{code}", body.get("message_params"), language)
              if isinstance(code, str) and code and interface_text.has(f"server:{code}", language) else body["error"])
    return routes_pages.error_page(status, detail, language=language)


def _offline_response(exc: MediaOffline) -> JSONResponse:
    """脱盘：来源盘整体不在，客户端据此显示「脱盘模式」而不是当成文件丢失。"""
    response = JSONResponse(
        {"error": "offline", "source": exc.source, "root_id": exc.root_id, "id": exc.asset_id},
        status_code=503,
    )
    response.headers["X-Peach-Offline"] = "1"
    return response


def _writer(sync: LedgerSync | None) -> bool:
    """这台是不是账本写入端。只读端不起任何会往账本里写的后台通道。"""
    return sync is None or not sync.read_only


def _start_tunnel(settings: PeachSettings, manager: tunnel.TunnelManager) -> None:
    """公网入口只按本次启动注入的设置开；不回头读设置文件里的当前值。"""
    if not (settings.tunnel_enabled and settings.configured):
        return
    try:
        manager.start(tunnel.plan_for_settings(settings))
    except tunnel.TunnelError:
        LOGGER.warning("Cloudflare Tunnel failed to start", exc_info=True)


def _restore_task_center(contract) -> None:
    """开机时收拾任务中心。

    上一次服务被强杀的话，表里会留下几行停在 `running` 的记录，它们还占着互斥键——不先
    收掉，这一次开机后那几类任务一按就是 409。判据是 pid 还在不在与心跳有没有过期，两样
    都不满足才算被打断。

    后继是例外：它重新排队而不判 `interrupted`，冻在终态就再也没有重试的机会
    （ADR-0040 第六条）。排着的那些也在这一步被叫醒，接着跑完。
    """
    from .job_recovery import reconcile_paused
    if contract.task_runs.enabled:
        reconcile_paused(contract.db_path)
    recovered = contract.task_runs.recover_interrupted()
    if recovered:
        LOGGER.info("task center recovered %s interrupted run(s)", len(recovered))
    # 先接上再叫醒后继：排着的补头像后继一跑就可能去取人脸模型。
    from . import face_models
    face_models.attach(contract.task_runs)
    requeued = contract.task_runs.enabled and contract.followups.resume()
    if requeued:
        LOGGER.info("task center requeued %s followup(s)", len(requeued))


#: 开机在后台先算一遍的聚合：口味、复核、垃圾复核、关注的全部条目与筛选项各要几秒到
#: 十几秒，都按账本版本号缓存（`WebContract.cached_until_changed`），算好一次就一直用到
#: 账本或文件真的变了。排在前面的是每页都碰到的几份：形状名单、作品分组快照（目录、
#: 索引、筛选项都建在它上面）、统计与搜索推荐池，重启后第一个打开页面的人不再等它们一起冷算。
WARM_AGGREGATES = (("/api/entity/shapes", {}), ("/api/items", {"limit": "60"}), ("/api/stats", {}),
                   ("/api/search/recommendations", {}),
                   ("/api/taste", {"window": "all"}), ("/api/review", {}), ("/api/ads", {}),
                   ("/api/follow", {}))
#: 关停时最多等在算的那份预热这么久（秒）：比存储卷探测的期限长一点，正常都等得到它放下连接；
#: 等不到就不再等，免得一份卡住的预热让服务停不下来。
WARMUP_STOP_SECONDS = 15.0


def _prune_ledger_backups(settings: PeachSettings) -> None:
    """账本旁的写入前备份按保留份数清退，规则与托盘启动时同一份（`ledger_backups.prune`）。

    Docker 与 `peach serve` 没有托盘，只有服务启动这一处能清；有托盘的部署两处都清，删过的
    再删是空操作。要先做一次整库完整性检查，所以放在后台线程里，不挡后台服务启动；失败只记日志。"""
    import threading
    from . import retention_settings

    def prune():
        try:
            ledger_backups.prune(settings.db_path, apply=True,
                                 keep_recent=retention_settings.backup_keep(settings.follow_state_root))
        except Exception:
            LOGGER.warning('Database backup retention cleanup failed', exc_info=True)

    threading.Thread(target=prune, name='PeachLedgerBackupPrune', daemon=True).start()


def _start_ledger_services(settings: PeachSettings, contract, services, migration: LedgerMigration | None = None) -> bool:
    """只读核对当前账本后，恢复任务并启动依赖账本的后台服务。

    结构待迁移的写入端先整份备份再迁移；`migration` 记下进行中与失败，供请求闸门与状态接口读。
    写入端在迁移之后、升级补修之前按保留份数清退账本备份（`_prune_ledger_backups`）。"""
    try:
        # 上次从备份恢复没走完：先把账本收拾到确定的状态，再判它能不能用（ADR-0138）。
        ledger_backups.recover(settings.db_path)
    except Exception:
        LOGGER.exception('Could not process the ledger restore marker')
    status = inspect_database(settings.db_path)
    repairs = getattr(contract, 'upgrade_repairs', None)
    if status['schema'] == 'pending' and repairs is not None and repairs.available:
        from .config import MIGRATIONS_DIR
        from .migrations import upgrade
        import time
        migration = migration or LedgerMigration()
        migration.begin()
        try:
            upgrade(settings.db_path, MIGRATIONS_DIR,
                    settings.db_path.with_name(f'ledger.pre-schema-{time.time_ns()}.db'), progress=migration.report)
            status = inspect_database(settings.db_path)
            contract.task_runs.enabled = contract.task_runs.available()
        except Exception as exc:
            repairs.error, repairs.error_phrase = str(exc), nested_message(exc)
            migration.fail(exc)
            LOGGER.exception('Automatic migration failed; background tasks stay stopped')
            return False
        migration.state = "idle"
    if not status["readable"] or status["schema"] != "current":
        LOGGER.warning("Database not ready; background tasks that need it stay stopped (database: %s; schema: %s). Restart the service once the database is ready.",
                       status["database"], status["schema"])
        return False
    if repairs is not None and repairs.available:
        _prune_ledger_backups(settings)
    if repairs is not None:
        try:
            repairs.prepare()
        except Exception as exc:
            repairs.error = str(exc)
            LOGGER.exception('Upgrade repairs did not finish; background tasks stay stopped')
            return False
    _restore_task_center(contract)
    from .web_job_recovery import restore
    if contract.task_runs.enabled:
        restore(contract)
    for service in services:
        service.start()
    return True


async def _warm_ledger_aggregates(ledger_ready: bool, contract, stopping: asyncio.Event) -> None:
    """走和真实请求同一条分派，缓存键一致，页面第一次打开就是现成的。"""
    if not ledger_ready:
        return
    for path, args in WARM_AGGREGATES:
        if stopping.is_set():
            return
        try:
            await asyncio.to_thread(web_contract.dispatch_api_get, contract, path, args)
        except Exception:
            # 预热失败不影响服务启动，这一页照旧在第一次打开时自己算。
            LOGGER.debug("aggregate warmup failed: %s", path, exc_info=True)


async def _stop_warmup(warmup: asyncio.Task) -> None:
    """关停时等预热收尾：to_thread 的查询在线程内释放连接后才算结束，最多等 `WARMUP_STOP_SECONDS`。"""
    try:
        await asyncio.wait_for(warmup, WARMUP_STOP_SECONDS)
    except TimeoutError:
        LOGGER.warning("Aggregate warmup still running after %ss at shutdown; not waiting for it",
                       WARMUP_STOP_SECONDS)


def _server_error_headers(request: Request, error: Exception, status_code=500):
    """服务错误按路由模板关联；请求参数、正文与鉴权头留在请求中。"""
    if status_code < 500:
        return {}
    from .error_reporting import event
    error_id = uuid.uuid4().hex
    event('http-request', error, error_id=error_id, method=request.method,
          route=getattr(request.scope.get('route'), 'path', '<unmatched>').lstrip('/'), status_code=status_code)
    return {'X-Peach-Error-ID': error_id, 'Cache-Control': 'no-store'}


def _user_facing_response(request: Request, exc: UserFacingError):
    """带 code 的报错漏到接口层：给原句与 code；5xx 照服务错误处理，生成错误编号并记进错误日志。"""
    status = response_status(exc)
    headers = _server_error_headers(request, exc, status)
    body = error_fields(exc)
    if _navigation(request):
        return HTMLResponse(_error_page(request, status, body), status_code=status, headers=headers)
    if 'X-Peach-Error-ID' in headers:
        body['error_id'] = headers['X-Peach-Error-ID']
    return JSONResponse(body, status_code=status, headers=headers)


def _configure_upgrade_repairs(settings, contract, sync):
    from . import settings_file
    from .upgrade_repairs import UpgradeRepairs
    config = settings_file.active()
    enabled = (_writer(sync) and settings.configured and config.present
               and (config.directory('database') / 'ledger.db').resolve() == settings.db_path.resolve())
    if enabled:
        from .runtime_prepare import configured_ledger_writer
        enabled, _reason = configured_ledger_writer(config)
    service = UpgradeRepairs(contract, available=enabled, config=config)
    contract.upgrade_config, contract.upgrade_repairs = config, service
    return service


def _installation_in_progress(database):
    from . import standalone_update, update_tasks
    return update_tasks.is_pausing(database) or standalone_update.installation_pending()


class _LedgerActivation:
    """安装确认期只提供网页；确认后启动后台，退出时等待在途准备收尾。

    结构待迁移时服务先开始监听，备份与迁移在后台做，期间需要账本的请求由 `LedgerMigrationGate` 挡下。"""

    def __init__(self, app, settings, contract, services, automatic_updates, sharing):
        self.app, self.settings, self.contract = app, settings, contract
        self.services, self.automatic_updates, self.sharing = services, automatic_updates, sharing
        if getattr(app.state, "ledger_migration", None) is None:
            app.state.ledger_migration = LedgerMigration()
        self.migration = app.state.ledger_migration
        self.stopping = asyncio.Event()
        self.lock = asyncio.Lock()
        self.automatic_started = False
        self.task = None

    async def start(self):
        self.app.state.ledger_background_ready = False
        self.app.state.ledger_background_deferred = False
        if not self.settings.configured:
            return False
        deferred = await asyncio.to_thread(_installation_in_progress, self.settings.db_path)
        self.app.state.ledger_background_deferred = deferred
        if deferred:
            self.task = asyncio.create_task(self._wait_for_installation())
            return False
        if await asyncio.to_thread(_migration_pending, self.settings, self.contract):
            self.migration.begin()
            self.task = asyncio.create_task(self._migrate())
            return False
        return await self.resume()

    async def _migrate(self):
        """后台备份并迁移，做完照常启动后台服务并预热聚合；失败沿用 `_start_ledger_services` 的处理。"""
        try:
            if await self.resume():
                await _warm_ledger_aggregates(True, self.contract, self.stopping)
        except Exception as exc:
            if self.migration.running:
                self.migration.fail(exc)
            self.contract.upgrade_repairs.error = str(exc)
            LOGGER.exception('Background services failed to start after the ledger migration')
        finally:
            if self.migration.running:
                self.migration.state = "idle"

    async def resume(self):
        async with self.lock:
            if self.stopping.is_set() or self.app.state.ledger_background_ready:
                return self.app.state.ledger_background_ready
            ready = await asyncio.to_thread(_start_ledger_services, self.settings, self.contract, self.services,
                                            self.migration)
            self.app.state.ledger_background_ready = ready
            if not self.automatic_started:
                self.automatic_updates.start()
                self.automatic_started = True
            if ready:
                self.sharing.start()
            return ready

    async def _wait_for_installation(self):
        try:
            while await asyncio.to_thread(_installation_in_progress, self.settings.db_path):
                if self.stopping.is_set():
                    return
                await asyncio.sleep(1)
            if not self.stopping.is_set():
                await self.resume()
        except Exception as exc:
            self.contract.upgrade_repairs.error = str(exc)
            LOGGER.exception('Background services failed to start after the update was installed')
        finally:
            self.app.state.ledger_background_deferred = False

    async def stop(self):
        self.stopping.set()
        if self.task is not None:
            await self.task


def _readiness_response(app, settings):
    """`/healthz?ready=1`：迁移进行中直接报未就绪，不碰账本；其余照 `health.readiness` 核对。"""
    from .health import readiness
    migration = app.state.ledger_migration
    deferred = getattr(app.state, 'ledger_background_deferred', False)
    result = readiness(settings, background_ready=None if deferred else getattr(app.state, "ledger_background_ready", None),
                       migrating=migration.running)
    result.update(background_deferred=deferred, ledger_migration=migration.payload())
    return JSONResponse(result, status_code=200 if result["ready"] else 503, headers={"Cache-Control": "no-store"})


def _database_field(settings, migration: LedgerMigration) -> str:
    from .health import database_status
    return "migrating" if migration.running else database_status(settings.db_path)


def _configure_capacity_guard(settings, contract, services):
    from .storage_budget import CapacityGuard
    config = contract.upgrade_config
    # 服务进程里这把闸门守的是播放、浏览与网络媒体缓存：总量超限只清理，不挡请求。
    guard = (CapacityGuard(config, foreground=True)
             if settings.transcode_root.parent.resolve() == config.directory('generated').resolve() else None)
    contract.capacity_guard = guard
    for service in services:
        service.capacity_guard = guard


def _read_only_fields(sync, read_only: bool) -> dict:
    """健康检查里的只读说明：zh-CN 原文给旧页面，旁边是同一句的 code 与参数（ADR-0159），页面按界面语言显示。"""
    if not read_only:
        return {"ledger_read_only_message": None, "ledger_read_only_message_code": None,
                "ledger_read_only_message_params": None}
    phrase = sync.read_only_phrase
    return {"ledger_read_only_message": sync.read_only_message, "ledger_read_only_message_code": phrase["code"],
            "ledger_read_only_message_params": phrase.get("params", {})}


def create_app(
    settings: PeachSettings | None = None,
    sync: LedgerSync | None = None,
    review_mirror: ReviewMirror | None = None,
    tunnel_manager: tunnel.TunnelManager | None = None,
) -> FastAPI:
    """`sync` 由 CLI 注入。测试直接建 app 时不传，复制与只读闸门整体不参与。"""
    settings = settings or PeachSettings()
    if tunnel_manager is None:
        tunnel_manager = tunnel.TunnelManager(settings.tunnel_state_root, settings.tunnel_log_root)
    database = LedgerDatabase(settings.db_path, media_roots=MEDIA_ROOT_DECLARATIONS)
    contract = web_contract.WebContract(
        settings.db_path, settings.snapshot_root,
        candidate_root=settings.candidate_root,
        cover_root=settings.cover_root,
        avatar_root=settings.avatar_root,
        logo_root=settings.logo_root,
        poster_root=settings.poster_root,
        timeline_root=settings.timeline_root,
        photo_root=settings.photo_root,
        transcode_root=settings.transcode_root,
        stream_root=settings.stream_root,
        follow_state_root=settings.follow_state_root,
        entry_links_root=settings.entry_links_root,
        taste_history_root=settings.taste_history_output_root,
        taste_history_store=settings.taste_history_store,
        taste_history_import_root=settings.taste_history_import_root,
        taste_history_manifest=settings.taste_history_manifest,
        database=database,
    )
    contract.download_organize_templates = lambda: web_settings.organize_templates(contract)
    repository = LedgerRepository(database)
    from .mount_reachability import source_roots
    mount_reachability = MountReachability(source_roots())
    from .network_reachability import NetworkReachability
    from .web_library_processing import retry_after_network_recovery
    network_reachability = NetworkReachability(
        on_recovered=lambda: retry_after_network_recovery(contract, sync))
    # 处理任务在外部采集前按它判断网（`library_processing._network_gate`）。
    contract.network_reachability = network_reachability
    resolver = FFmpegResolver(settings.ffmpeg_root)
    http_transport = HttpxTransport()
    follow_media_resolver = FollowMediaResolver(http_transport, state_root=settings.follow_state_root).with_credential_loader(
        lambda provider: web_follow._credential_store(contract).load(provider))
    # 检查更新、浏览与画面签名的取图共用这一份按站冷却：同一个站被限流，几处都得停。
    contract.follow_media_resolver = follow_media_resolver
    follow_cover_service = FollowCoverService(
        resolver, follow_media_resolver, settings.poster_root / "follow")
    contract.follow_faces = FollowFaceIndex(
        settings.poster_root / "follow-faces", http_transport,
        cover_root=settings.poster_root / "follow", gate=follow_media_resolver)
    filesystem = FilesystemBackend(
        settings.allowed_media_roots,
        settings.snapshot_root,
    )
    media_engine = MediaEngine(repository, filesystem)
    preview_service = PreviewService(
        repository, resolver, settings.snapshot_root, settings.poster_root,
        settings.avatar_root, settings.logo_root,
    )
    photo_service = PhotoThumbnailService(settings.photo_root)
    sample_cache = SampleCache(sample_cache_root(settings.photo_root))
    entity_thumb_service = DerivedImageService(entity_thumb_root(settings.avatar_root))
    cover_thumb_service = DerivedImageService(cover_thumb_root(settings.cover_root),
                                              edge=COVER_THUMB_EDGE, quality=COVER_THUMB_QUALITY)
    cover_small_thumb_service = DerivedImageService(cover_thumb_root(settings.cover_root),
                                                    edge=COVER_SMALL_THUMB_EDGE,
                                                    quality=COVER_SMALL_THUMB_QUALITY)
    transcode_service = TranscodeService(resolver, settings.transcode_root, state_root=settings.follow_state_root)
    header_repairs = HeaderRepairStore(settings.transcode_root, resolver, runs=contract.task_runs)
    # 分片计划按会话记住（`SessionPlans`），这里只跑没记过的那一次；一次可能要等 ffprobe，
    # 两个线程时两部探不动的片子就让所有会话的分片排队。
    hls_plan_executor = ThreadPoolExecutor(
        max_workers=8, thread_name_prefix="PeachHlsPlan",
    )
    hls_service = HlsSegmentService(
        resolver, settings.stream_root, prefer_hardware=transcode_service.prefer_hardware,
        hardware=transcode_service.hardware,
    )
    mdns = create_mdns_publisher(
        settings.mdns_name, settings.mdns_port, secure=settings.tls_enabled,
        address=settings.mdns_address,
    ) if settings.mdns_enabled else None
    providers = default_registry()
    opencode_go = OpenCodeGoClient(transport=http_transport)
    review_mirror = review_mirror or ReviewMirror(
        settings.review_writer_origin,
        settings.review_writer_ca,
        settings.review_mirror_cache,
        token=settings.token,
        proxy=settings.review_writer_proxy,
    )
    follow_scheduler = FollowUpdateScheduler(
        settings.follow_state_root,
        lambda: web_follow.w_follow_check(contract, {"automatic": True}),
        available=sync is None or not sync.read_only,
    )
    push_discovery = PushDiscoveryService(
        state_root=settings.follow_state_root,
        secrets_root=settings.secrets_root,
        db_path=settings.db_path,
        declared_roots=LOCATION_ROOT_DECLARATIONS,
        mounts=location_mounts(),
        available=_writer(sync),
        ffprobe=resolver.ffprobe,
        after_ingest=contract.cache_bust,
    )
    # 云下载：远端完成后的文件由推送发现登记，这里只对账与兜底定向登记。凭据只在本机。
    from .download_postprocess import enqueue as enqueue_download_postprocess
    downloads = build_download_service(
        database=database, state_root=settings.follow_state_root,
        credentials=credential_store_for(settings.secrets_root,
                                         shared_root=contract.follow_shared_root),
        push_discovery=push_discovery, available=_writer(sync),
        after_ingest=lambda task: enqueue_download_postprocess(contract, task))
    contract.downloads = downloads
    from .jav_browser import JavBrowser
    from .web_resource_search import q_resource_search
    from .jav_editions import EditionProbe
    jav_browser = JavBrowser(contract, search=q_resource_search,
                             edition_probe=EditionProbe(contract.follow_secrets_root))
    contract.follow_scheduler = follow_scheduler
    # 订阅源拉取（ADR-0042）用同一个调度实现，只换 job id、状态文件与默认间隔。
    # 默认 6 小时：一位女优的 JavDB 演员页一天更新几条，比这更密只是把 JavDB 的配额
    # 花在一张没变的页面上。6 小时是每个源的周期；调度每半小时看一次谁到期，各源按
    # 自己的相位错开（ADR-0134）。
    feed_scheduler = FollowUpdateScheduler(
        settings.follow_state_root,
        lambda: web_feeds.w_feed_check(contract, {"automatic": True}),
        available=_writer(sync),
        job_id=FEED_JOB_ID,
        filename="feed-schedule.json",
        default=FollowScheduleConfig(enabled=True,
                                     interval_minutes=feeds.DEFAULT_INTERVAL_MINUTES),
        tick_minutes=feeds.TICK_MINUTES,
        unavailable_code=FEED_UNAVAILABLE_CODE,
    )
    contract.feed_scheduler = feed_scheduler
    from .web_job_recovery import RecoveryService
    recovery_service = RecoveryService(contract, available=_writer(sync))
    contract.header_repairs = header_repairs
    contract.transcode_service = transcode_service
    # 只读端不写任务中心：`task_run` 也在账本里，reader 往里写会造成无法自动合并的
    # 分叉。活动页在只读端照常能看——读不受影响，只是看到的是写入端那台的记录。
    contract.task_runs.enabled = (
        (sync is None or not sync.read_only) and contract.task_runs.available())
    from .library_sharing import Service as LibrarySharing
    from . import settings_file
    sharing = LibrarySharing(settings_file.active(), contract)
    from .automatic_updates import AutomaticUpdates
    from .routes_configuration import managed_configuration
    automatic_updates = AutomaticUpdates(
        settings.follow_state_root,
        available=managed_configuration() and bool(settings.configured),
    )
    upgrade_repairs = _configure_upgrade_repairs(settings, contract, sync)
    _configure_capacity_guard(settings, contract,
        (transcode_service, hls_service, entity_thumb_service, cover_thumb_service, cover_small_thumb_service))

    async def warm_startup_entries():
        """配置页首屏要的开机启动项状态，先在后台问一遍。

        那一格是 `/api/configuration` 同步路径上唯一一件慢事：读一个 `.lnk` 得起一个
        `powershell.exe`，本机三个快捷方式加起来 2.5 秒，而它正好挡在用户点开设置之后。
        这里先问一次，`desktop_startup` 按 `.lnk` 的指纹留着结论，等用户真点开时是现成的。
        """
        if not (managed_configuration() and settings.configured):
            return
        from . import desktop_startup
        try:
            await asyncio.to_thread(desktop_startup.snapshot)
        except Exception:
            # 预热失败不该影响服务起不起得来，配置页照旧自己现问一遍。
            logging.getLogger(__name__).debug("startup entry warmup failed", exc_info=True)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # asyncio 异常处理器由 `cli._run_uvicorn` 装在 uvicorn 的事件循环上：它要拿着 uvicorn
        # 的 Server，才能在监听被标准库关掉后重新监听。
        # 握手要等 cloudflared 连上边缘，断网时会等满 `wait_timeout`；放在后台，本机访问
        # 不等公网入口。连接进度由 `tunnel_manager.snapshot()` 报告。
        tunnel_startup = asyncio.create_task(asyncio.to_thread(_start_tunnel, settings, tunnel_manager))
        services = (follow_scheduler, feed_scheduler, push_discovery, downloads, recovery_service, jav_browser, upgrade_repairs)
        activation = _LedgerActivation(_app, settings, contract, services, automatic_updates, sharing)
        _app.state.ledger_activation = activation
        ledger_ready = await activation.start()
        if settings.configured:
            mount_reachability.start()
        warmup = asyncio.create_task(warm_startup_entries())
        aggregate_stop = asyncio.Event()
        aggregate_warmup = asyncio.create_task(_warm_ledger_aggregates(ledger_ready, contract, aggregate_stop))
        if mdns is not None:
            try:
                await asyncio.to_thread(mdns.start)
            except Exception:
                mdns.status = "unavailable"
                logging.getLogger(__name__).exception("mDNS publication failed")
        try:
            yield
        finally:
            # 外部播放器的最后一段观看要赶在账本收尾前落下。
            await asyncio.to_thread(_app.state.playback_trackers.stop)
            await activation.stop()
            _app.state.ledger_background_ready = False
            aggregate_stop.set()
            warmup.cancel()
            # 等在途接回收尾有上限，放在线程里等，不占事件循环。
            await asyncio.to_thread(recovery_service.stop)
            follow_scheduler.stop()
            feed_scheduler.stop()
            await asyncio.to_thread(automatic_updates.stop)
            await asyncio.to_thread(upgrade_repairs.stop)
            await asyncio.to_thread(sharing.stop)
            push_discovery.stop()
            await asyncio.to_thread(jav_browser.stop)
            downloads.stop()
            mount_reachability.stop()
            await asyncio.to_thread(network_reachability.stop)
            await _stop_warmup(aggregate_warmup)
            # 死链检查和资源对账的后台线程是 daemon，本来挡不住进程退出；这里显式收
            # 一下，免得在途的那一轮在解释器拆卸期间还继续查库、往没人读的状态里写。
            contract.stop_background_jobs()
            header_repairs.stop()
            from . import face_models
            face_models.detach(contract.task_runs)
            if mdns is not None:
                await asyncio.to_thread(mdns.stop)
            # stop 让还在等边缘的握手当场返回；握手若刚好在 stop 之后才拉起子进程，
            # 第二次 stop 把它收掉。
            await asyncio.to_thread(tunnel_manager.stop)
            await tunnel_startup
            await asyncio.to_thread(tunnel_manager.stop)
            http_transport.close()
            follow_media_resolver.close()
            hls_plan_executor.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(
        title="Peach API",
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )
    app.state.settings = settings
    app.state.database = database
    app.state.ledger_migration = LedgerMigration()
    app.state.web_contract = contract
    app.state.library_sharing = sharing
    app.state.repository = repository
    app.state.media_engine = media_engine
    app.state.preview_service = preview_service
    app.state.photo_service = photo_service
    from .subtitles import SidecarListings
    app.state.sidecar_listings = SidecarListings()
    app.state.sample_cache = sample_cache
    app.state.entity_thumb_service = entity_thumb_service
    app.state.cover_thumb_service = cover_thumb_service
    app.state.cover_small_thumb_service = cover_small_thumb_service
    app.state.transcode_service = transcode_service
    app.state.header_repairs = header_repairs
    app.state.hls_plan_executor = hls_plan_executor
    from .segments import SessionPlans
    app.state.hls_session_plans = SessionPlans()
    app.state.hls_service = hls_service
    app.state.mdns = mdns
    app.state.providers = providers
    app.state.opencode_go = opencode_go
    app.state.review_mirror = review_mirror
    app.state.http_transport = http_transport
    app.state.follow_media_resolver = follow_media_resolver
    app.state.follow_cover_service = follow_cover_service
    app.state.follow_scheduler = follow_scheduler
    app.state.automatic_updates = automatic_updates
    app.state.upgrade_repairs = upgrade_repairs
    from pathlib import Path
    from .follow_evidence import Reclaim
    app.state.follow_evidence = Reclaim(Path(contract.follow_sources_root) / "follow", contract,
                                        runs=contract.task_runs)
    app.state.push_discovery = push_discovery
    app.state.downloads = downloads
    app.state.jav_browser = jav_browser
    app.state.mount_reachability = mount_reachability
    app.state.network_reachability = network_reachability
    from .background_issues import IssueLog
    app.state.background_issues = IssueLog()
    app.state.stream_sessions = StreamSessionRegistry()
    from .strm_stream import StrmResources
    app.state.strm_resources = StrmResources()
    import secrets
    app.state.external_playback_key = secrets.token_bytes(32)
    from .playback_tracking import PlaybackTrackers
    app.state.playback_trackers = PlaybackTrackers()
    app.state.sync = sync
    app.state.tunnel = tunnel_manager

    # 媒体三异常的统一出口，路由里不再手抄同一组 try/except。
    # 404/503/404 是逐个异常的状态码契约，不许并成一种。
    @app.exception_handler(MediaNotFound)
    def _media_not_found_handler(request: Request, exc: MediaNotFound):
        return JSONResponse({"error": "no such id"}, status_code=404)

    @app.exception_handler(MediaOffline)
    def _media_offline_handler(request: Request, exc: MediaOffline):
        return _offline_response(exc)

    @app.exception_handler(MediaUnavailable)
    def _media_unavailable_handler(request: Request, exc: MediaUnavailable):
        return JSONResponse({"error": "unavailable"}, status_code=404)

    # 401 有三种形态，按路由类分组保留（不许统一成一种）：页面路由跳登录页，
    # 页面资产返回 PlainText 提示，API 与媒体路由返回 JSON。
    @app.exception_handler(PageLoginRequired)
    def _page_login_required_handler(request: Request, exc: PageLoginRequired):
        return RedirectResponse(
            "/login?next=" + quote(exc.next_path or "/", safe="/"), status_code=303,
        )

    @app.exception_handler(AssetLoginRequired)
    def _asset_login_required_handler(request: Request, exc: AssetLoginRequired):
        # 纯文本没有 code 可带：浏览器给了语言就按它渲染，没给（脚本、测试客户端）用源语言。
        accepted = request.headers.get("accept-language")
        language = interface_text.request_language(accepted) if accepted else interface_text.SOURCE_LANGUAGE
        return PlainTextResponse(interface_text.text("server:api.auth.assetTokenRequired", None, language),
                                 status_code=401)

    # 挂在 Starlette 的基类上：路由没匹配到的 404 是它抛的，不是 FastAPI 子类，
    # 只挂子类的话地址栏敲错一个字母仍会看到一行 JSON。
    @app.exception_handler(StarletteHTTPException)
    def _http_exception_handler(request: Request, exc: StarletteHTTPException):
        headers = _server_error_headers(request, exc, exc.status_code)
        detail = exc.detail
        if isinstance(detail, dict):
            # 表单校验那种带字段明细的 4xx：`message` 是总话，其余键（含 `message_code`）原样带给页面。
            body = {"error": str(detail.get("message", "")), **{k: v for k, v in detail.items() if k != "message"}}
        else:
            body = dict(_DEFAULT_DETAILS.get(str(detail)) or {"error": str(detail)})
        # 浏览器地址栏直接打开一个页面路径撞上 403／404／409 时，给人看的是一页话，不是一行 JSON。
        if _navigation(request):
            return HTMLResponse(_error_page(request, exc.status_code, body),
                                status_code=exc.status_code, headers=headers)
        return JSONResponse(body, status_code=exc.status_code, headers=headers)

    @app.exception_handler(UserFacingError)
    def _user_facing_error_handler(request: Request, exc: UserFacingError):
        return _user_facing_response(request, exc)

    @app.exception_handler(Exception)
    def _server_exception_handler(request: Request, exc: Exception):
        headers = _server_error_headers(request, exc)
        return JSONResponse({**message_fields('http.serverError', key='error'),
                             'error_id': headers['X-Peach-Error-ID']}, status_code=500, headers=headers)

    # 第三方前端依赖固定版本并随 Peach 自托管；局域网断网时仍可播放。
    app.mount(
        "/vendor",
        StaticFiles(directory=settings.vendor_path, check_dir=False),
        name="vendor",
    )

    app.add_middleware(LedgerMigrationGate)
    app.add_middleware(FirstSetupSourceMiddleware)
    app.add_middleware(ResponseHeadersMiddleware)

    # JSON 契约、页面脚本与样式是仅有的几类大文本响应，压下去省的字节最多：
    # `/api/items`、主界面 bundle 与样式都通过内容类型选择压缩。
    # `add_middleware` 是 `insert(0)`，最后加的在最外层，所以压缩看到的是上面
    # ResponseHeadersMiddleware 补完 Cache-Control 之后的最终响应头。
    # 自己写内容类型闸门的 ASGI 中间件是重复劳动：Starlette 这个已经按 Content-Type
    # 排除、跳过 206 与已编码响应、逐块流式压缩，还会把大块丢到工作线程去压，
    # 不占事件循环。只需要把它的排除名单补齐（见 COMPRESSION_EXCLUDED_TYPES）。
    app.add_middleware(
        GZipMiddleware, exclude_content_types=COMPRESSION_EXCLUDED_TYPES,
    )

    # 健康检查常被 HEAD 探测（`curl -I`、各种 uptime 工具）。本仓库其他公开端点
    # 都显式声明了 GET+HEAD，只有这个漏了，HEAD 会拿到 405。
    @app.api_route("/healthz", methods=["GET", "HEAD"])
    def healthz(request: Request, ready: bool = False):
        if ready:
            return _readiness_response(request.app, settings)
        # 不探测共享目录或迁移数据库；健康检查必须无副作用。启动迁移期间不碰账本。
        ffmpeg = resolver.ffmpeg()
        read_only = bool(sync is not None and sync.read_only)
        tunnel_state = tunnel_manager.snapshot()
        from .diagnostics import health_components
        migration = app.state.ledger_migration
        components = health_components(settings, app.state.mount_reachability.summary(), migrating=migration.running)
        return {"ok": True, "service": "peach-api", "version": __version__,
                "checks": components,
                # 打包这份代码的提交。源码运行时是 null：跑的就是检出本身。
                "build_commit": BUILD.commit if BUILD else None,
                # 这台机器跑过 `peach init` 没有。未配置时服务照常起，只是没有数据。
                "configured": settings.configured,
                # 这次请求的发起方能不能改这台机器的配置（独立包、回环地址）。它随调用方
                # 变化，只决定管理菜单里「配置」显不显示；拒绝写入的判定在端点自己那里。
                "configurable": routes_configuration.configurable(request),
                "db": _database_field(settings, migration),
                "ledger_migration": migration.payload(),
                "ffmpeg": ffmpeg.source if ffmpeg else "unavailable",
                "media_mounts": app.state.mount_reachability.summary(),
                "mdns": mdns.status if mdns is not None else "disabled",
                "mdns_backend": mdns.backend if mdns is not None else None,
                "mdns_service": mdns.name if mdns is not None else None,
                "mdns_service_host": mdns.hostname if mdns is not None else None,
                "mdns_address": mdns.address if mdns is not None else None,
                "ledger_sync": sync.status if sync is not None else "disabled",
                "ledger_read_only": read_only,
                **_read_only_fields(sync, read_only),
                "ledger_writer_origin": settings.review_writer_origin if read_only else None,
                "scheme": "https" if settings.tls_enabled else "http",
                # 采集用的浏览器窗口正等着人点验证的站，供排查时看一眼；窗口本身就是提醒，不另弹通知（ADR-0065）。
                "attention": browser_transport.attention(),
                # 健康检查可能被公网探针访问，不能在这里回传随机 Tunnel URL。
                "tunnel": {"enabled": settings.tunnel_enabled, "state": tunnel_state.state},
        }

    # 顺序即契约：catch-all 最后。`routes_media` 里有 `/api/stream-plan` 与
    # `/api/stream-cancel` 两条具名 API，所以它也要排在 `routes_api` 之前。
    app.include_router(routes_auth.router)
    app.include_router(routes_pages.router)
    app.include_router(routes_configuration.router)
    app.include_router(routes_jav_browser.create_router(routes_configuration.local_only))
    app.state.local_only = routes_configuration.local_only
    app.include_router(routes_media.router)
    app.include_router(routes_subtitles.router)
    app.include_router(routes_api.router)
    return app
