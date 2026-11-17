"""一个应用实例的库连接、聚合缓存与后台任务句柄。

`WebContract` 是 web 层唯一的可变状态载体，刻意不用模块级全局：测试和真实服务在
同一个解释器里各建自己的实例，任何一个全局都会让它们串到同一个库上。

它单独成一个模块，是为了把依赖方向钉死成一个走法——**它不认识任何域处理器**。
`web_catalog`、`web_entity`、`web_stats`、`web_batch` 全都 import 它，所以它一旦反
过来 import 其中任何一个，整层立刻循环。判据就是这个文件里不许出现 `from .web_`。

`CACHE_TTL` 与账本版本号归这里，因为它们决定本文件 `cached()`／`cached_lru()` 的寿命。内联 favicon 也放这里：它是
唯一一个没有磁盘文件的静态资源，而 `api` 一直从契约模块取它，这次只搬位置。
"""
from __future__ import annotations

import json
import logging
import math
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from contextvars import ContextVar

from collections import OrderedDict
from collections.abc import Mapping
from pathlib import Path
from typing import NamedTuple

from .catalog_rules import normalise_code_key
from .config import (
    COVER_DIR,
    DATA_ROOT,
    GENERATED_DIR,
    MEDIA_ROOT_DECLARATIONS,
    SECRETS_DIR,
    SHARED_CREDENTIAL_ROOT,
    SOURCES_DIR,
    STATE_DIR,
    TOOLS_DIR,
)
from . import avatar_face
from . import brand_marks
from . import jav_poster_crop
from .jobs import BackgroundJob
from .media import normalized_path
# `previews` 是取图那一侧，不是 web 域处理器：依赖方向仍然只有一个走法。落盘名的
# 规则必须和 `/logo` 用的是同一个函数，否则可用性判定迟早和取图对不上。
from .previews import ENTITY_IMAGE_KINDS, LOGO_VARIANTS, entity_image_key, logo_key
from .repository import LedgerDatabase, writing_in_background
from .task_runs import TaskRunStore

LOGGER = logging.getLogger(__name__)

#: 当前读请求的账本版本快照，见 `WebContract.revision_snapshot`；不在请求里时为 None，每次现读。
_REVISION_SNAPSHOT: ContextVar[dict | None] = ContextVar("peach_revision_snapshot", default=None)
_FRESH_AGGREGATES: ContextVar[bool] = ContextVar('peach_fresh_aggregates', default=False)


@contextmanager
def revision_snapshot():
    """这一段里各表版本只读一次（一个读请求用一份）。

    一次页面请求要核对十几个聚合缓存，每个都单独开连接读一遍版本表；账本表多、触发器多，
    光是开连接、载入表结构就要十几毫秒一次。本进程有提交时（`cache_generation` 变了）
    快照作废重读：请求里自己写过的，后面的缓存照样认得出来。快照记着是哪个契约读的，
    换了契约也重读。
    """
    token = _REVISION_SNAPSHOT.set({})
    try:
        yield
    finally:
        _REVISION_SNAPSHOT.reset(token)


class AvatarRootIndex(NamedTuple):
    """`avatar_root` 一次扫描的产物。两样东西同处一个目录，分开扫就是白扫两遍。

    `entity_images` 是已装实体图的 casefold 落盘名到它的版本（修改时间的十六进制纳秒），
    `generated` 是已经裁好的头像资产 id。两者的判据不一样，故意不合并成一个集合：实体图
    有就是有、没有就是没有，而头像是按需生成的，「目录里没有」只说明还没裁过。
    """

    entity_images: Mapping[str, str]
    generated: frozenset[int]





FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0B0B0D"/><defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9A76"/><stop offset="1" stop-color="#F2557B"/></linearGradient></defs><path d="M16 28c-5.7 0-9.7-3.6-9.7-8.6 0-4.3 2.8-7.6 6.5-7.6 1.4 0 2.4.5 3.2 1.1.8-.6 1.8-1.1 3.2-1.1 3.7 0 6.5 3.3 6.5 7.6C25.7 24.4 21.7 28 16 28z" fill="url(#pg)"/><path d="M16 13.4V27" stroke="#0B0B0D" stroke-width="1.1" opacity=".3" stroke-linecap="round"/><path d="M17.1 11.7c.6-2.8 2.8-4.6 5.6-4.8-.2 2.8-2.2 4.7-5.6 4.8z" fill="#5FB95F"/><path d="M16 11.9c0-1.9.5-3.4 1.5-4.5" stroke="#8A5A3B" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>')

CACHE_TTL = 90

#: 目录时间距今不足这么久算「还在写」，那时扫出的目录索引只缓存 `SETTLE_TTL` 秒。
#: 见 `WebContract._directory_index`。
SETTLE_SECONDS = 2
SETTLE_TTL = 1.0

#: `cached()` 的聚合缓存最多留这么多个键，最久没用的先淘汰。
CACHE_KEYS = 192


def path_version(path: Path) -> int | None:
    """文件或目录的修改时间，缓存键拿它认「变了没有」；不存在就是 None。

    目录的时间在里面新增、删除、换名文件时变，原地覆写已有文件时不变，所以会被这样
    读的边车一律先写临时文件再换名（`avatar_face.write_sidecar`）。
    """
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return None


class WebContract:
    """单个应用实例的数据库、写锁和聚合缓存；不共享模块级可变状态。"""

    def __init__(self, db_path: Path, snapshot_root: Path | None = None,
                 candidate_root: Path | None = None,
                 cover_root: Path | None = None,
                 avatar_root: Path | None = None,
                 logo_root: Path | None = None,
                 marks_root: Path | None = None,
                 poster_root: Path | None = None,
                 timeline_root: Path | None = None,
                 photo_root: Path | None = None,
                 transcode_root: Path | None = None,
                 stream_root: Path | None = None,
                 follow_sources_root: Path | None = None,
                 follow_secrets_root: Path | None = None,
                 follow_state_root: Path | None = None,
                 follow_shared_root: Path | None = None,
                 entry_links_root: Path | None = None,
                 tools_root: Path | None = None,
                 taste_history_root: Path | None = None,
                 taste_history_store: Path | None = None,
                 taste_history_import_root: Path | None = None,
                 taste_history_manifest: Path | None = None,
                 database: LedgerDatabase | None = None):
        # 候选 CSV 的目录做成实例属性而不是模块常量，复核层才能在临时目录里被测试。
        self.candidate_root = Path(candidate_root) if candidate_root is not None else GENERATED_DIR
        self.cover_root = Path(cover_root) if cover_root is not None else COVER_DIR
        self.avatar_root = Path(avatar_root) if avatar_root is not None else GENERATED_DIR / "avatars"
        # `/logo` 就是从这里读；批准候选等于把图装进这个目录。
        self.logo_root = Path(logo_root) if logo_root is not None else GENERATED_DIR / "logos"
        # 随仓库分发的标识（ADR-0026）。和上面同一个道理：读模块常量的话，用临时
        # `logo_root` 造「没装图」的测试会撞上仓库里那 198 个，判定于是说反话。
        self.marks_root = (Path(marks_root) if marks_root is not None
                           else brand_marks.STUDIOS_DIR)
        self.poster_root = Path(poster_root) if poster_root is not None else GENERATED_DIR / "posters"
        # 时间轴预览的接触印相。和上面几个不一样，它不是取不到就现做的缓存：一张图要抽
        # 一百帧，只能靠采集任务提前铺好，没铺到的片子悬停时退回九宫格。
        self.timeline_root = (Path(timeline_root) if timeline_root is not None
                              else GENERATED_DIR / "timeline")
        self.photo_root = Path(photo_root) if photo_root is not None else GENERATED_DIR / "photo-thumbs"
        self.transcode_root = (Path(transcode_root) if transcode_root is not None
                               else GENERATED_DIR / "transcodes")
        self.stream_root = Path(stream_root) if stream_root is not None else GENERATED_DIR / "stream-segments"
        # API construction passes every managed cache root. A bare WebContract is also used
        # by isolated unit tests; it must never wander into the machine's real generated tree.
        self.resource_cleanup_enabled = any(
            root is not None for root in (poster_root, photo_root, transcode_root, stream_root))
        # 追更的原始证据与本机凭据目录同样做成实例属性，测试才能落在临时目录里。
        self.follow_sources_root = (Path(follow_sources_root)
                                    if follow_sources_root is not None else SOURCES_DIR)
        self.follow_secrets_root = (Path(follow_secrets_root)
                                    if follow_secrets_root is not None else SECRETS_DIR)
        self.follow_state_root = (Path(follow_state_root)
                                  if follow_state_root is not None else STATE_DIR)
        # 人物页外部入口的开关与镜像域名。和上面几个同一个道理：走实例属性，测试才
        # 落得进临时目录，不会读到这台机器真实的偏好。
        self.entry_links_root = (Path(entry_links_root)
                                 if entry_links_root is not None else STATE_DIR)
        # 外部工具区（FFmpeg、amane 桥的 venv）。测试给临时目录，重建桥就不会碰真实工具区。
        self.tools_root = Path(tools_root) if tools_root is not None else TOOLS_DIR
        # 共享副本只承载**声明为可同步**的凭据字段，见 follow_secrets.SYNCABLE_FIELDS。
        # 复制关掉时 SHARED_CREDENTIAL_ROOT 是 None，凭据只留在本机。
        self.follow_shared_root = (Path(follow_shared_root)
                                   if follow_shared_root is not None
                                   else SHARED_CREDENTIAL_ROOT)
        # 浏览历史口味分析的产出目录，`scripts/taste_history.py --output` 的默认值。
        self.taste_history_root = (Path(taste_history_root)
                                   if taste_history_root is not None
                                   else DATA_ROOT / "review" / "taste-history")
        self.taste_history_store = (Path(taste_history_store)
                                    if taste_history_store is not None
                                    else SOURCES_DIR / "taste-history" / "history.sqlite")
        self.taste_history_import_root = (Path(taste_history_import_root)
                                          if taste_history_import_root is not None
                                          else SOURCES_DIR / "taste-history" / "imports")
        self.taste_history_manifest = (Path(taste_history_manifest)
                                       if taste_history_manifest is not None
                                       else STATE_DIR / "taste-history" / "manifest.json")
        self.database = database or LedgerDatabase(db_path, media_roots=MEDIA_ROOT_DECLARATIONS)
        self.db_path = self.database.db_path
        self.snapshot_root = Path(snapshot_root) if snapshot_root is not None else None
        #: 键 → (算出时刻, 输入版本, 结果)，见 `cached()`。
        self.cache: OrderedDict[str, tuple[float, object, object]] = OrderedDict()
        self.cache_lock = threading.Lock()
        #: 按资产取键的读缓存，LRU 限界。键空间不封闭的场景走这里，见 `cached_lru()`。
        self.keyed_cache: OrderedDict[str, tuple[float, object, object]] = OrderedDict()
        #: 每次 cache_bust 递增。在途计算据此判断自己出发后缓存是否失效过。
        self.cache_generation = 0
        self.revision_cache_keys: set[str] = set()
        self.aggregate_locks: dict[str, threading.RLock] = {}
        #: 每个缓存键那一份结果出发时的 `cache_generation`；判它有没有包含最近一次前台写入。
        self.cache_started: dict[str, int] = {}
        #: 最近一次前台提交（不是 `repository.in_background` 包过的线程）之后的 `cache_generation`。
        self.foreground_generation = 0
        #: 最近一次后台提交之后的 `cache_generation`。进程外的写不经提交通知，两个数都不动。
        self.background_generation = 0
        #: 后台重算写回新值的次数，按那份结果读到的表各记一次，随结果版本下发，页面据此再取一次
        #: （ADR-0146）。按表记而不是一个总数：写回一份封面统计不该让关注、发现几组页面也跟着重取。
        self.cache_landed: dict[str, int] = {}
        #: `/api/result-updates` 上一次下发的结果版本，见 `web_tasks.q_result_updates` 的节流。
        self.published_versions: tuple[float, dict, int] | None = None
        self.stale_refreshing: set[str] = set()
        self._stale_refresher = None
        self.follow_check_lock = threading.Lock()
        #: 任务中心。每个后台任务的开始、进度与结束都写这一张表，`/tasks` 只读它。
        #: 只读端由 `api` 关掉写入：那边的账本是复制来的，写一行就是一处合不回去的分叉。
        self.task_runs = TaskRunStore(self.database)
        #: 整理设置由组合根注入；垃圾检查由扫描和后处理共用领域规则。
        self.download_organize_templates = lambda: {}
        #: 后继调度（ADR-0040）。导入 `avatar_followup` 就是它的登记动作：调度器本身
        #: 不认识任何一种后继，登记表在 `followups.REGISTRY` 里。
        from . import avatar_followup  # noqa: F401  登记补头像后继
        from . import creator_identity_followup  # noqa: F401  登记创作者身份查找后继
        from . import download_postprocess  # noqa: F401  登记云下载后处理
        from . import feed_followup  # noqa: F401  登记新作资料采集后继
        from . import follow_creators  # noqa: F401  登记关注作者建档后继
        from . import performer_alias_followup  # noqa: F401  登记补女优别名后继
        from . import performer_profile_followup  # noqa: F401  登记补女优资料后继
        from . import sample_followup  # noqa: F401  登记番号样张采集后继
        from . import seed_followup  # noqa: F401  登记导入实体种子后继
        from . import studio_followup  # noqa: F401  登记厂牌官网与标识补全后继
        from .followups import FollowupRunner
        self.followups = FollowupRunner(self)
        self.follow_job = self._job("PeachFollowCheckJob", "follow-check")
        self.feed_job = self._job("PeachFeedCheckJob", "feed-check")
        self.want_job = self._job("PeachWantScrapeJob", "want-scrape")
        self.want_search_job = self._job("PeachWantSearchJob", "want-search")
        #: 想要定时查找因来源失败停下后，下一轮最早何时起（`time.monotonic()`）；None 是没在歇。
        self.want_search_resume_at = None
        self.follow_resolve_job = self._job("PeachFollowResolveJob", "follow-resolve")
        self.taste_refresh_job = self._job("PeachTasteRefreshJob", "taste-refresh")
        self.link_prune_job = self._job("PeachLinkPruneJob", "link-prune")
        self.scraping_cover_job = self._job("PeachScrapingCoverJob", "scraping-cover")
        self.amane_bridge_job = self._job("PeachAmaneBridgeJob", "amane-bridge")
        self.source_check_job = self._job("PeachSourceCheckJob", "source-check")
        self.face_models_job = self._job("PeachFaceModelsJob", "face-models")
        self.library_processing_job = self._job(
            "PeachLibraryProcessingJob", "library-processing")
        self.thumbnail_job = self._job(
            "PeachTimelineThumbnailJob", "timeline-thumbnails")
        self.resource_apply_job = self._job("PeachResourceApplyJob", "resource-apply")
        self.media_repair_job = self._job("PeachMediaRepairJob", "media-repair")
        # 整理（ADR-0039）：同一时间只跑一批，互斥由这个任务自己的键提供。
        self.organize_job = self._job("PeachOrganizeJob", "organize")
        self.follow_scheduler = None
        #: 关注卡缩略图的画面签名缓存（`follow_faces.FollowFaceIndex`），由 `api` 接上；
        #: 裸契约不联网，组里只按缩略图地址认同一张。
        self.follow_faces = None
        #: 订阅源的定时拉取（ADR-0042）。与追更共用 `follow_scheduler` 那一个实现，
        #: 只是各占一个 job id 与一份状态文件；由 `api` 在装配时接上。
        self.feed_scheduler = None
        #: 定时拉取上一次派存量后继的时刻（`time.monotonic()`）；None 是本进程还没派过
        #: （`web_feeds.STOCK_INTERVAL`）。
        self.feed_stock_planned_at = None
        #: 云下载（`downloads.DownloadService`），由 `api` 在装配时接上；没接上时
        #: `/api/downloads` 回「云下载没有启用」。
        self.downloads = None
        #: 批量修 MP4 头要的两件东西，由 `api` 在装配时接上：它们属于播放链路，
        #: 建在 app 那一侧，契约这边只留接口。没接上时修复端点会说清楚。
        self.header_repairs = None
        self.transcode_service = None
        # 两块后台任务的锁、状态和线程都归 BackgroundJob 管，契约上只留这两个字段。
        # 任务 id 的键名沿用各自原有的名字：它随公开投影下发，是前端契约。
        self.resource_scan = self._job(
            "PeachResourceScanJob", "resource-scan", id_key="scan_id")
        self.link_check = self._job("PeachLinkCheckJob", "link-check", id_key="check_id")
        self._fts_available: bool | None = None
        self.database.after_commit = self.cache_bust

    def _job(self, name: str, task_key: str, *, id_key: str = "job_id") -> BackgroundJob:
        """建一个后台任务并接进任务中心。task_key 就是它在活动页上的身份。"""
        return BackgroundJob(name, id_key=id_key, task_key=task_key,
                             runs=self.task_runs, followup_runner=self.followups)

    def cached(self, key, fn, *, ttl: float = CACHE_TTL, version=None):
        """带 TTL 的读缓存。`fn` 刻意在锁外算——它会读 CSV、查库，拿着锁算会把
        并发请求全串起来。

        `version` 是这份结果依赖的输入的版本，与存下的不同就算没命中。一个键只存
        最新算的那一版：封面刮削期间目录版本一直在变，按版本另起键会把整目录索引
        一份份堆在内存里。

        代价是计算期间缓存可能被 `cache_bust()` 清掉，那份还没写回的值就是失效前的
        快照。复核页正是这个场景：`q_review` 在算，用户批准了一条候选，
        `w_review_decision` 调 `cache_bust`；旧实现照样把批准前的快照写回去，
        于是用户批准完刷新，看到的还是批准前的列表，而且持续整整一个 TTL。

        用代次挡住：写回前确认这期间没有失效过，否则丢弃这次结果。按版本核验的键
        （`revision_cache_keys`）不挡：版本在计算前读好，期间有写入，下一次读到新版本
        照样重算；挡掉它们只会让长任务频繁提交时上秒的计算永远存不进去，每个读者各算一遍。
        """
        now = time.monotonic()
        with self.cache_lock:
            hit = self.cache.get(key)
            if hit and hit[1] == version and now - hit[0] < ttl:
                self.cache.move_to_end(key)
                return hit[2]
            generation = self.cache_generation
        value = fn()
        with self.cache_lock:
            if generation == self.cache_generation or key in self.revision_cache_keys:
                # 时间戳沿用进入时的 now：算得比 TTL 还久的结果直接算过期，
                # 宁可下次重算，也不要把一份已经旧了的数据当新的用。
                self.cache[key] = (now, version, value)
                self.cache_started[key] = generation
                self.cache.move_to_end(key)
                while len(self.cache) > CACHE_KEYS:
                    evicted, _ = self.cache.popitem(last=False)
                    self.cache_started.pop(evicted, None)
                    # 键空间不封闭的聚合（按作者、按筛选口径）的锁和登记跟着结果一起走，
                    # 否则这两份只增不减。正被别的线程拿着的锁摘掉也无妨，持有者手里还有它；
                    # 同键再来时 `cached_until_changed` 会重新登记。
                    self.revision_cache_keys.discard(evicted)
                    self.aggregate_locks.pop(evicted, None)
        return value

    def cached_for(self, key, fn, *, ttl: float):
        """只按时间过期、不随提交通知清掉的缓存，给允许旧上几分钟的结果用（搜索推荐池）。

        `cached` 的键每次提交都被 `cache_bust` 清掉；后台任务每几秒提交一次时，这类结果等于没有缓存。
        """
        with self.cache_lock:
            self.revision_cache_keys.add(key)
        return self.cached(key, fn, ttl=ttl)

    def cached_lru(self, key, fn, *, maxsize: int = 192, ttl: float = CACHE_TTL, tables=None, inputs=()):
        """带 TTL 的 LRU 读缓存，给键空间不封闭的场景用（`/api/related` 按资产取键）。

        与聚合缓存分开计量，容量和 TTL 可由调用方指定。计算在锁外进行，
        计算期间发生提交或显式失效时，结果不进入缓存。

        给了 `tables`（结果读到的账本表）时改按这些表的版本与 `inputs` 核验：提交通知不清它，
        计算期间有提交也照样写回（版本在计算前读好，期间有写入，下一次读到新版本照样重算）。
        后台任务每几秒提交一次时，不按版本核验的结果几乎存不住，算得比提交间隔慢的永远写不进。
        """
        now = time.monotonic()
        version = None
        if tables is not None:
            revision = self.ledger_revision(tables)
            version = None if revision is None else (revision, *inputs)
        with self.cache_lock:
            hit = self.keyed_cache.get(key)
            if hit and now - hit[0] < ttl and hit[1] == version:
                self.keyed_cache.move_to_end(key)
                return hit[2]
            generation = self.cache_generation
        value = fn()
        with self.cache_lock:
            if generation == self.cache_generation or version is not None:
                self.keyed_cache[key] = (now, version, value)
                self.keyed_cache.move_to_end(key)
                while len(self.keyed_cache) > maxsize:
                    self.keyed_cache.popitem(last=False)
        return value

    def ledger_revision(self, tables=()) -> int | None:
        """账本版本号：`ledger_revision` 各行之和（migration 0038）。

        每张账本表的增删改都由触发器给自己那一行加一，不论写的是服务、CLI 脚本还是
        账本同步，所以这个数变了就是账本变了。任务中心的心跳不挂触发器；播放心跳只改的
        观看进度列不推 asset 的版本（migration 0054）。库还没迁移到
        0038（或根本没有库）时返回 None。
        `tables` 非空时只累计这些表的版本。
        """
        revisions = self._table_revisions()
        if revisions is None:
            return None
        if not tables:
            return sum(revisions.values())
        return sum(revisions.get(table, revisions.get('asset', 0) if table == 'asset_catalog' else 0)
                   for table in set(tables))

    def ledger_tables_except(self, excluded) -> tuple[str, ...]:
        """登记了版本的账本表，去掉 `excluded`：聚合读的表太多、列不全时，按「除这几张以外」声明依赖。
        读不到版本表时为空，`cached_until_changed` 随之退回整本账本的版本。"""
        revisions = self._table_revisions()
        if revisions is None:
            return ()
        return tuple(table for table in sorted(revisions) if table not in excluded)

    def _table_revisions(self) -> dict[str, int] | None:
        snapshot = _REVISION_SNAPSHOT.get()
        if (snapshot is not None and snapshot.get("contract") is self
                and snapshot.get("generation") == self.cache_generation):
            return snapshot["revisions"]
        generation = self.cache_generation
        try:
            with self.read_connection() as connection:
                revisions = {str(table): int(count) for table, count in connection.execute(
                    "SELECT tbl, total(n) FROM ledger_revision GROUP BY tbl")}
        except sqlite3.Error:
            revisions = None
        if snapshot is not None:
            snapshot.update(contract=self, generation=generation, revisions=revisions)
        return revisions

    def cached_until_changed(self, key: str, fn, *inputs, tables=(), allow_stale=True):
        """只读账本聚合的缓存：账本版本号与 `inputs` 都没变就一直命中，不按时间过期。

        `inputs` 是聚合读到的账本之外的东西的版本（候选目录、头像目录、浏览历史库），
        由调用方给出：漏一样，那一样变了页面就一直是旧的。版本号在计算前读，计算期间
        有进程外的写，结果记在旧版本下，下一次请求读到新版本照样重算。库还没有版本号时
        退回 `CACHE_TTL`。
        `tables` 声明聚合依赖的表，留空时累计全库版本；缓存经过提交通知后仍按版本核验，
        同键的并发请求共用一次计算。

        带 `tables` 的键在版本变了、手上那份之后只有本进程的后台提交时，先回那一份，另起
        后台重算（ADR-0146）：后台任务写的东西晚几秒无妨；前台写入与进程外的写之后照旧
        当场重算。不带 `tables` 的键按全库版本同步核验，不返回过期结果。
        `allow_stale=False` 的馆藏统计与本次读取的列表配对，后台写入后也同步重算。
        """
        if not allow_stale:
            token = _FRESH_AGGREGATES.set(True)
            try:
                return self._cached_by_tables(key, fn, inputs, tables)
            finally:
                _FRESH_AGGREGATES.reset(token)
        if not tables or _FRESH_AGGREGATES.get():
            return self._cached_by_tables(key, fn, inputs, tables)
        revision = self.ledger_revision(tables)
        if revision is not None:
            version = (tuple(tables), revision, *inputs)
            schedule = False
            with self.cache_lock:
                hit = self.cache.get(key)
                started = self.cache_started.get(key, -1)
                # 手上那份之后只有后台提交：没有前台写入，也有一次本进程的后台提交说明版本为什么变了。
                # 进程外的写（命令行、账本同步）不经提交通知，照旧当场重算。
                stale = (hit is not None and hit[1] != version and started >= self.foreground_generation
                         and self.background_generation > started)
                if stale:
                    self.cache.move_to_end(key)
                    schedule = key not in self.stale_refreshing
                    self.stale_refreshing.add(key)
            if stale:
                if schedule:
                    self._refresh_later(key, fn, inputs, tables)
                return hit[2]
        return self._cached_by_tables(key, fn, inputs, tables)

    def _refresh_later(self, key, fn, inputs, tables) -> None:
        """一条后台线程依次重算过期的键，同一个键在途时不重复排。"""
        from concurrent.futures import ThreadPoolExecutor

        def work():
            try:
                self._cached_by_tables(key, fn, inputs, tables)
                with self.cache_lock:
                    for table in set(tables):
                        self.cache_landed[table] = self.cache_landed.get(table, 0) + 1
            except Exception:  # noqa: BLE001 - 后台重算失败时下一次读照旧当场重算，原因记日志
                LOGGER.exception("Background cache recompute %s failed", key)
                with self.cache_lock:
                    self.cache.pop(key, None)
            finally:
                with self.cache_lock:
                    self.stale_refreshing.discard(key)

        with self.cache_lock:
            if self._stale_refresher is None:
                self._stale_refresher = ThreadPoolExecutor(max_workers=1, thread_name_prefix="PeachCacheRefresh")
            refresher = self._stale_refresher
        refresher.submit(work)

    def _cached_by_tables(self, key: str, fn, inputs, tables):
        # 指定依赖表的聚合共用一次计算；提交后仍按这些表的代次核验。
        with self.cache_lock:
            lock = self.aggregate_locks.setdefault(key, threading.RLock())

        def compute():
            # 结果要记在刚读的新版本下：算的时候嵌套读到的缓存也当场核验、不回旧值，
            # 否则新版本号底下存的是一份旧结果，下一次后台写入之前一直命中。
            token = _FRESH_AGGREGATES.set(True)
            try:
                return fn()
            finally:
                _FRESH_AGGREGATES.reset(token)
        with lock:
            revision = self.ledger_revision(tables)
            with self.cache_lock:
                if revision is None:
                    self.revision_cache_keys.discard(key)
                else:
                    self.revision_cache_keys.add(key)
            version = (tuple(tables), revision, *inputs) if tables else (revision, *inputs)
            return self.cached(key, compute, ttl=CACHE_TTL if revision is None else math.inf, version=version)

    def stop_background_jobs(self) -> None:
        """服务关停时丢掉后台任务状态并等线程收工。

        谁在跑归契约自己知道，`api` 的 lifespan 不该再列一遍任务清单。
        """
        self.resource_scan.stop()
        self.follow_job.stop()
        self.scraping_cover_job.stop()
        self.library_processing_job.stop()
        self.thumbnail_job.stop()
        self.follow_resolve_job.stop()
        self.taste_refresh_job.stop()
        self.link_prune_job.stop()
        self.resource_apply_job.stop()
        self.link_check.stop()
        self.feed_job.stop()
        self.want_job.stop()
        self.want_search_job.stop()
        self.organize_job.stop()
        self.media_repair_job.stop()
        self.amane_bridge_job.stop()
        self.source_check_job.stop()
        self.face_models_job.stop()
        if hasattr(self, 'task_resource_monitor'):
            self.task_resource_monitor.close()
        if hasattr(self, "jav_discovery_metadata"):
            self.jav_discovery_metadata.stop()
        self.followups.stop()
        if self._stale_refresher is not None:
            self._stale_refresher.shutdown(wait=False, cancel_futures=True)

    def cache_bust(self):
        with self.cache_lock:
            self.cache = OrderedDict((key, value) for key, value in self.cache.items()
                                     if key in self.revision_cache_keys)
            # 按版本核验的那几条留着：版本没变就还是对的，变了下一次读自然重算。
            self.keyed_cache = OrderedDict((key, value) for key, value in self.keyed_cache.items()
                                           if value[1] is not None)
            # 在途计算靠这个数认出「我出发之后缓存失效过」，从而放弃写回。
            self.cache_generation += 1
            # 前台写入之后，出发更早的那份缓存不许再先回旧值：写的人要立刻看到自己写的。
            if writing_in_background():
                self.background_generation = self.cache_generation
            else:
                self.foreground_generation = self.cache_generation

    def read_connection(self):
        return self.database.read_connection()

    def write_transaction(self, *, notify: bool = True):
        """`notify=False` 的写入不清缓存，给只改观看进度的播放心跳用（`LedgerDatabase.write_transaction`）。"""
        return self.database.write_transaction(notify=notify)

    def has_snapshot(self, raw_path: str | None) -> bool:
        return self.snapshot_file(raw_path) is not None

    def snapshot_file(self, raw_path: str | None) -> Path | None:
        """账本里那条接触印相路径在本机的文件；不在盘上是 None。"""
        if not raw_path:
            return None
        path = normalized_path(raw_path) if self.snapshot_root is not None else Path(raw_path)
        return path if path.is_file() else None

    def cover_path(self, code: str | None) -> Path | None:
        """封面按归一番号存一份，多个文件共用同一张；没有就返回 None。"""
        key = normalise_code_key(code)
        if not key:
            return None
        path = self.cover_root / f"{key}.jpg"
        from .cover_artwork import has_javdb_source
        return path if path.is_file() and not has_javdb_source(path) else None

    def cover_index(self) -> dict[str, dict]:
        """封面目录扫一遍的索引：casefold(归一番号) → 两份取景提示加封面版本。

        值的形状是 `{"frame": 人脸中心或 None, "poster": 正封框或 None, "version": 修改时间}`。
        两份边车各描述一件事，一次目录扫描一起收齐：`.face.json` 说脸在哪，
        `.poster.json` 说正封那一块在哪。版本见 `cover_version`。

        卡片列表逐行问「有封面吗」「取景是多少」，一页 60 行就是 120+ 次 stat 加
        读文件；封面目录一次 scandir 就覆盖全部番号。`/cover` 端点仍走 `cover_path()`
        直读，取图不受索引影响。

        索引只认封面目录的修改时间，不随账本提交失效，也不按时间过期：重建要读两千多份
        边车，约一秒。封面与边车的写入方（`cover_artwork.install_cover`、
        `jav_poster_crop.write_sidecar`）都先写临时文件再换名，新增、替换、删除都会改
        目录时间。目录不存在时退回 `CACHE_TTL`。刚写过的目录见 `_directory_index`。
        """
        return self._directory_index("cover-index", self.cover_root, self._scan_cover_root,
                                     ttl=math.inf)

    def _directory_index(self, key: str, root: Path, scan, *, ttl: float):
        """按目录修改时间缓存的一次目录扫描；目录不存在时退回 `CACHE_TTL`。

        目录时间取自文件系统的时钟刻度（NTFS 约 15 ms），装图的一连串换名可能落在同一
        刻度里：读者在两次换名之间扫到的半成品，和换完之后的目录时间相同。所以照 Git 判
        「新近修改」的做法，目录时间距今不足 `SETTLE_SECONDS` 时扫出的结果只按
        `SETTLE_TTL` 缓存，版本里另记一档，目录静下来之后重扫一次才按 `ttl` 缓存。
        `ttl` 为无穷时这一份不随提交通知清掉。

        同一个目录的重扫单飞：封面刮削期间目录一直在变，一屏卡片的几个并发请求同时没命中时，
        后到的等先到的那一次扫完直接命中，不各扫一遍（重建要读两千多份边车）。
        """
        version = path_version(root)
        with self.cache_lock:
            lock = self.aggregate_locks.setdefault(key, threading.RLock())
            if version is not None and ttl == math.inf:
                self.revision_cache_keys.add(key)
        with lock:
            if version is None:
                return self.cached(key, scan, version=None)
            settling = time.time_ns() - version < SETTLE_SECONDS * 1_000_000_000
            return self.cached(key, scan, ttl=SETTLE_TTL if settling else ttl,
                               version=(version, settling))

    def _scan_cover_root(self) -> dict[str, dict]:
        """一次目录扫描同时收集封面存在性和两份 sidecar。目录不存在就是空索引。"""
        scanned: dict[str, dict] = {}
        try:
            with os.scandir(self.cover_root) as entries:
                for entry in entries:
                    if not entry.name.endswith(".jpg"):
                        continue
                    from .cover_artwork import has_javdb_source
                    if has_javdb_source(Path(entry.path)):
                        continue
                    stem = entry.path[:-len(".jpg")]
                    record = self._poster_record(stem + jav_poster_crop.SIDECAR_SUFFIX)
                    scanned[entry.name[:-len(".jpg")].casefold()] = {
                        "frame": self._with_poster_layout(self._cover_focus(stem + ".face.json"), record,
                                                          Path(entry.path)),
                        "poster": jav_poster_crop.projection(record),
                        "version": f"{entry.stat().st_mtime_ns:x}",
                    }
        except OSError:
            return {}
        return scanned

    @staticmethod
    def _cover_focus(sidecar: str) -> dict | None:
        """sidecar 里的人脸中心（整幅画面有更大的主体部位时用它）与整幅画面标记。缺少坐标时页面退回固定取景。

        两个轴都给出去：哪个轴生效由容器和图片的宽高比决定，不由这里判断。
        缺哪个键就不带哪个键，前端各自回落，不要拿另一个轴的值顶替。
        """
        try:
            with open(sidecar, encoding="utf-8") as handle:
                record = json.load(handle) or {}
                if not isinstance(record, dict):
                    return None
                face = record.get("face")
        except (OSError, ValueError):
            return None
        focus = {'layout': 'still'} if record.get('layout') == 'still' else {}
        # 整幅画面上比主脸还大的部位（`cover_artwork.face_record` 的 `subject`）：卡片按它取景。
        subject = record.get("subject")
        if focus and isinstance(subject, dict):
            face = subject
        if isinstance(face, dict):
            focus.update({axis: face[axis] for axis in ("cx", "cy") if axis in face})
        return focus or None

    @staticmethod
    def _poster_record(sidecar: str) -> dict | None:
        """正封边车原文；读不出是 None。框由 `jav_poster_crop.projection` 校验后才给页面：
        页面拿到的框必须和算它的那份代码是同一套判据。"""
        try:
            with open(sidecar, encoding="utf-8") as handle:
                record = json.load(handle)
        except (OSError, ValueError):
            return None
        return record if isinstance(record, dict) else None

    @staticmethod
    def _with_poster_layout(frame: dict | None, record: dict | None, cover: Path) -> dict | None:
        """正封边车判定的整幅画面与装好的竖版正封，并进卡片的取景提示。

        两样都是正封边车的结论：竖版图证明横图不是封套时，人脸边车不一定在（人脸模型可选），
        页面却必须知道这张不能按右缘切、大图位改用竖版正封。版本落后的边车不算数；竖版正封
        文件不在就不给，页面照旧用横图，不去取一张 404。只有记了竖版正封的才多 stat 一次。
        """
        if not isinstance(record, dict) or (
                not jav_poster_crop.is_manual(record) and record.get("version") != jav_poster_crop.ALGORITHM_VERSION):
            return frame
        extra = {}
        if record.get("layout") == "still":
            extra["layout"] = "still"
        if jav_poster_crop.front_size(record) and jav_poster_crop.front_path(cover).is_file():
            extra["front"] = True
        return {**(frame or {}), **extra} if extra else frame

    def has_cover(self, code: str | None) -> bool:
        key = normalise_code_key(code)
        # 索引的键是 casefold 过的：`is_file()` 在 Windows 与 macOS 的默认文件系统上
        # 大小写不敏感，改走索引不能顺手把这层容错丢了。
        return bool(key) and key.casefold() in self.cover_index()

    def cover_version(self, code: str | None) -> str:
        """这个番号封面的版本，页面拼进 `/cover` 的 `v=`；没有封面是空串。

        补高清、重探都把封面原地换成新图而地址不变，同一页里浏览器直接复用内存里那张
        旧图。判据与 `has_cover` 是同一份索引。
        """
        return (self._cover_entry(code) or {}).get("version", "")

    def logo_index(self) -> Mapping[str, str]:
        """厂牌标识目录扫一遍的索引：已装标识的 casefold(落盘名) → 版本。

        页面据此决定「输出 `<img>` 还是直接首字母垫底」。没有这份索引就只能每个厂牌
        都先发一次 `/logo`、靠 404 把图换掉：首页顶栏一次渲染 30 个厂牌里 21 个是
        404，而 404 那条响应不可缓存，每次重绘再打一遍。

        判据必须和 `PreviewService.logo` 逐字一致——同一个 `logo_key`、同样大小写不
        敏感、同样把 `.icon` / `.logo` 变体算作这个厂牌有图。松一格就是页面说有图却
        取回 404（碎图），紧一格就是明明装了却永远只显示首字母。

        键里和 `cover_index()` 一样带目录的修改时间，刚装上的标识立刻进索引；刚写过的
        目录见 `_directory_index`。
        """
        return self._directory_index("logo-index", self.logo_root, self._scan_logo_root,
                                     ttl=CACHE_TTL)

    def _scan_logo_root(self) -> Mapping[str, str]:
        """一次目录扫描收齐已装标识，并入随仓库分发的那批（ADR-0026）。

        内置那批不进这份索引的话，`/logo` 取得回图而页面判「没图」，厂牌位永远停在
        首字母——两边判据不一致的后果不是报错，是安静地少显示一批图。

        本机目录不存在时仍然保留内置那批：干净数据目录正是内置资源要顶上的场景。

        版本是这个厂牌几份变体里最新的修改时间：复核批准是原地替换，地址不带版本时同一页
        里看到的还是旧标识。内置那批随版本分发、不在本机替换，版本是空串。
        """
        keys: dict[str, str] = dict.fromkeys(
            brand_marks.installed_stems(LOGO_VARIANTS, self.marks_root), "")
        try:
            with os.scandir(self.logo_root) as entries:
                for entry in entries:
                    name = entry.name.casefold()
                    # `.ct` 边车和 SVG 原件不是 `/logo` 会取的文件，不算这个厂牌有图。
                    if not name.endswith(".img") or not entry.is_file():
                        continue
                    stem = name[:-len(".img")]
                    for variant in LOGO_VARIANTS:
                        if stem.endswith(f".{variant}"):
                            stem = stem[:-len(variant) - 1]
                            break
                    if stem:
                        mtime = entry.stat().st_mtime_ns
                        if mtime > int(keys.get(stem) or "0", 16):
                            keys[stem] = f"{mtime:x}"
        except OSError:
            return keys
        return keys

    def has_logo(self, studio: str | None) -> bool:
        """这个厂牌是否已装标识。空名字一律为假——`/logo` 也拒绝空 studio。"""
        key = logo_key(studio or "")
        return bool(key) and key.casefold() in self.logo_index()

    def logo_version(self, studio: str | None) -> str:
        """这个厂牌标识的版本，页面拼进 `/logo` 的 `v=`；没装或是内置的那批是空串。"""
        key = logo_key(studio or "")
        return self.logo_index().get(key.casefold(), "") if key else ""

    def avatar_root_index(self) -> AvatarRootIndex:
        """头像目录扫一遍的索引：已装的实体图，加已经裁好的头像。

        页面据此决定「输出 `<img>` 还是直接首字母垫底」。没有这份索引就只能无条件出图、
        靠 404 把图摘掉：一个作品详情页是 9 个这样的 404（1 个厂牌实体图、4 个人物
        实体图、4 个头像），而 `/entity-image` 和 `/avatar` 的 404 都不带缓存头，
        每次重绘再打一整轮。

        实体图和头像同处 `avatar_root`（`{kind}-{id}.img` 与 `{asset_id}.jpg`），
        所以一次 `os.scandir` 一起收；分成两个缓存键就是同一个目录连扫两遍。

        键里和 `cover_index()` 一样带目录的修改时间，刚装上的实体图立刻进索引，
        口味与复核按头像目录版本重算时拿到的也是这一份；刚写过的目录见 `_directory_index`。
        """
        return self._directory_index("avatar-root-index", self.avatar_root, self._scan_avatar_root,
                                     ttl=CACHE_TTL)

    def _scan_avatar_root(self) -> AvatarRootIndex:
        """一次目录扫描同时收齐实体图和已裁头像。目录不存在就是两个空集合。

        实体图顺手记下修改时间：换头像是原地覆盖同一个文件，地址不带版本时，同一页里
        浏览器直接复用内存里那张旧图，不刷新就看不到新的。Windows 上 `entry.stat()`
        取自目录枚举本身，不多一次系统调用。
        """
        entity_images: dict[str, str] = {}
        generated: set[int] = set()
        try:
            with os.scandir(self.avatar_root) as entries:
                for entry in entries:
                    name = entry.name.casefold()
                    if name.endswith(".img"):
                        # `.ct`、`.provenance.json`、`.face.json` 都是边车，不是
                        # `/entity-image` 会取的文件，不算这个实体有图。
                        if entry.is_file():
                            entity_images[name[:-len(".img")]] = f"{entry.stat().st_mtime_ns:x}"
                    elif name.endswith(".jpg"):
                        # 头像按资产 id 落盘。生成中途的 `<id>.<格>.tmp.jpg` 不算数，
                        # 它随时会被删掉或改名。
                        stem = name[:-len(".jpg")]
                        if stem.isdigit() and entry.is_file():
                            generated.add(int(stem))
        except OSError:
            return AvatarRootIndex({}, frozenset())
        return AvatarRootIndex(entity_images, frozenset(generated))

    def entity_image_version(self, kind: str, entity_id) -> str:
        """这个实体那张图的版本，页面拼进 `/entity-image` 的 `v=`；没有图是空串。

        判据与 `has_entity_image` 是同一份索引，两者不会一个说有、一个说没有。
        """
        if not self.has_entity_image(kind, entity_id):
            return ""
        # 两次取索引之间缓存可能刚失效过，第二次那份里未必还有这个键。
        return self.avatar_root_index().entity_images.get(
            entity_image_key(kind, entity_id).casefold(), "")

    def has_entity_image(self, kind: str, entity_id) -> bool:
        """`/entity-image` 能不能取到这个实体的图。

        判据必须和 `PreviewService.entity_image` 逐字一致——同一份 kind 白名单、同一个
        `entity_image_key`。松一格就是页面说有图却取回 404（碎图），紧一格就是明明
        装了却永远只显示首字母。

        索引的键 casefold 过：`is_file()` 在 Windows 与 macOS 的默认文件系统上大小写
        不敏感，改走索引不能顺手把这层容错丢了。落盘名本来就全小写，这层只兜手工
        摆进去的文件。
        """
        if kind not in ENTITY_IMAGE_KINDS or entity_id is None:
            return False
        try:
            key = entity_image_key(kind, entity_id)
        except (TypeError, ValueError):
            return False
        return key.casefold() in self.avatar_root_index().entity_images

    def has_avatar(self, asset_id, snapshot_path: str | None) -> bool:
        """`/avatar` 能不能取到这个代表作的头像。

        和实体图不是一回事，判据也不能照抄：`/avatar` 是**按需生成**的，目录里没有
        那张 jpg 只说明还没人要过，不说明取不到。只要接触印相还在盘上，第一次请求
        就现裁一张出来。把「还没裁过」也判成没有，等于把点一下就有的头像永远关掉——
        真缺和没抓过是两回事。

        所以判据是「已经裁好了」或「印相还在，裁得出来」，和 `has_thumb` 同一个
        `has_snapshot`。剩下的 404 只有生成本身失败那一种（没有 ffmpeg、六格全黑），
        那要真去跑一遍 ffmpeg 才知道，预测不了；那条兜底链照旧留着兜。
        """
        try:
            key = int(asset_id)
        except (TypeError, ValueError):
            return False
        return key in self.avatar_root_index().generated or self.has_snapshot(snapshot_path)

    def cover_frame(self, code: str | None) -> dict | None:
        """封面的取景提示：人脸中心与整幅画面标记。未检出时不含人脸坐标。

        双页封套的横向锚点仍由版式决定（正封贴着右边缘，几何规则已经稳定），人脸
        锚点用于整幅画面被裁掉的那一轴，VR 与数字发行拼图携带 `layout=still` 标记。
        取不到人脸时前端退回固定取景，不影响显示。
        """
        return (self._cover_entry(code) or {}).get("frame")

    def poster_box(self, code: str | None) -> dict | None:
        """封面里正封那一块的取景框，源图像素坐标加源图尺寸。

        没算过、算法版本落后、或这个番号的封面本来就不该裁（`jav_poster_crop`
        的 `none` 一档）都返回 None，竖版位置退回整张封面。
        """
        return (self._cover_entry(code) or {}).get("poster")

    def _cover_entry(self, code: str | None) -> dict | None:
        key = normalise_code_key(code)
        return self.cover_index().get(key.casefold()) if key else None

    def avatar_focus(self, kind: str, entity_id) -> dict | None:
        """实体图的取景提示：人脸中心换算成的 object-position，加上脸框的像素尺寸。

        sidecar 由 `scripts/detect_avatar_faces.py` 离线写入，与封面取景同一
        约定；没算过、读不出或没检出都返回 None，页面维持几何居中。取值与校验在
        `avatar_face.focus_hint`，关注页的题材圆标读的是同一份判据。

        身份 id 和 `has_entity_image` 一样按不可信对待：复核队列和榜单里的行有的
        根本没有实体（扁平标签那一批，`entity_id` 是空串或 None），拿它去算落盘名
        会当场抛出来，整页跟着 500。没有身份就是没有取景。
        """
        if entity_id is None:
            return None
        try:
            key = entity_image_key(kind, entity_id)
        except (TypeError, ValueError):
            return None
        path = self.avatar_root / f"{key}.face.json"
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        return avatar_face.focus_hint(data)

    def has_fts(self) -> bool:
        if self._fts_available is None:
            with self.read_connection() as connection:
                self._fts_available = connection.execute(
                    "SELECT 1 FROM sqlite_schema WHERE type='table' AND name='asset_search'"
                ).fetchone() is not None
        return self._fts_available
