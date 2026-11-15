"""时间轴预览的采集任务：选一档密度、后台跑、页面轮询。

档位存在服务端而不是浏览器里：跑的是这台机器上的一条长任务，从另一台设备打开设置
时要看到的是「这台机器正在按 10 秒一帧采集」，不是那台设备自己的上一次选择。
"""
import json
import sqlite3
import threading
import time
from collections import OrderedDict
from pathlib import Path

from . import media_io, timeline_sheets, timeline_sources
from .coded_text import coded
from .config import FFMPEG_DIR, STATE_DIR
from .ffmpeg import FFmpegResolver
from .fsutil import atomic_path
from .storage_budget import CapacityGuard
from .media_processing_policy import metadata_only
from .task_stages import stage as stage_fields
from .user_messages import UserValueError

MODE_PATH = STATE_DIR / 'timeline-thumbnails.json'


def _mode_file(path: Path | None = None) -> Path:
    return Path(path) if path is not None else MODE_PATH


def read_mode(path: Path | None = None) -> str:
    """当前档位。读不出来就是关着——这条链会写盘也会读片子，不能靠猜来开。"""
    try:
        data = json.loads(_mode_file(path).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return timeline_sheets.OFF
    mode = str((data or {}).get('mode') or timeline_sheets.OFF)
    return mode if mode in timeline_sheets.MODES else timeline_sheets.OFF


def write_mode(mode: str, path: Path | None = None) -> None:
    with atomic_path(_mode_file(path)) as destination:
        destination.write_text(json.dumps({'mode': mode, 'saved_at': time.time()}),
                               encoding='utf-8')


def q_media_processing(contract, _args):
    from .media_processing_policy import acceleration, playback_max_height
    return {'metadata_only': metadata_only(contract.follow_state_root),
            'preview_acceleration': acceleration(contract.follow_state_root, purpose='preview'),
            'playback_acceleration': acceleration(contract.follow_state_root),
            'playback_max_height': playback_max_height(contract.follow_state_root)}


def w_media_processing(contract, body):
    from .media_processing_policy import save_preferences
    value = (body or {}).get('metadata_only')
    save_preferences(contract.follow_state_root, body or {})
    if value:
        write_mode('off', Path(contract.follow_state_root) / 'timeline-thumbnails.json')
        contract.thumbnail_job.stop(resume=False)
    return q_media_processing(contract, {})


def q_timeline(contract, args):
    """一部片子的时间轴索引。没铺到就回空对象，页面据此决定要不要画这一层。

    单独一条而不是随列表下发：一页六十张卡里真正被悬停的是个位数，为此每行多读一份
    `meta.json` 是把六十次文件读摊到每一次翻页上。
    """
    asset_id = int((args or {}).get('id') or 0)
    if asset_id <= 0:
        return {}
    cached = timeline_sheets.read_meta(contract.timeline_root, asset_id)
    if cached:
        cached = {**cached, 'source': 'peach'}
    external = external_timeline(contract, asset_id)
    if external is not None:
        return {**external.metadata(), **({'fallback': cached} if cached else {})}
    return cached or {}


class _TimedCache:
    """有界、按时间过期、不随账本提交清掉的缓存；`None` 也记。

    视频旁的预览文件不在账本里，提交与它无关。`WebContract.cached_lru` 每次提交都清空，后台
    任务几秒提交一次时它等于没有缓存，而在网盘上配对一次要列目录、读索引，慢时上分钟。
    """

    def __init__(self, *, maxsize: int, ttl: float):
        self._maxsize, self._ttl = maxsize, ttl
        self._items: OrderedDict = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key, compute):
        now = time.monotonic()
        with self._lock:
            hit = self._items.get(key)
            if hit is not None and now - hit[0] < self._ttl:
                self._items.move_to_end(key)
                return hit[1]
        value = compute()
        with self._lock:
            self._items[key] = (now, value)
            self._items.move_to_end(key)
            while len(self._items) > self._maxsize:
                self._items.popitem(last=False)
        return value

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


#: 视频旁新放进去的预览最多晚这么久出现；键里有账本路径与时长，换了文件当场重配。
SIDECAR_TTL = 600
_SIDECARS = _TimedCache(maxsize=1024, ttl=SIDECAR_TTL)
_FRAMES = _TimedCache(maxsize=256, ttl=SIDECAR_TTL)


def external_timeline(contract, asset_id: int) -> timeline_sources.Timeline | None:
    """已有预览只读配对到具体资产；按资产长缓存索引，不读取视频内容。"""
    try:
        with contract.read_connection() as connection:
            row = connection.execute(
                "SELECT path, duration FROM asset WHERE id=? AND medium='video' AND disposal IS NULL",
                (asset_id,)).fetchone()
    except sqlite3.Error:
        return None
    if row is None or not row[0]:
        return None
    raw, duration = str(row[0]), float(row[1] or 0)

    def pair():
        from .media import normalized_path
        source = normalized_path(raw)
        # SMB 来源没有本机目录可列，旁边的预览文件读不到。
        return timeline_sources.discover(source, duration) if isinstance(source, Path) else None

    def read():
        from .media import absolute_path
        try:
            return media_io.bounded(media_io.mount_key(absolute_path(raw)), pair)
        except TimeoutError:
            # 网盘答不上不记进缓存：记了这段时间里就一直当作没有预览。
            raise
        except (OSError, TypeError, ValueError):
            return None
    try:
        result = _SIDECARS.get((asset_id, raw, duration), read)
    except TimeoutError:
        return None
    return result if isinstance(result, timeline_sources.Timeline) else None


def external_frame(contract, timeline: timeline_sources.Timeline, number: int) -> bytes | None:
    """一帧裁好的图。跟索引同一个寿命，不再每次 stat 预览图（它和视频一样在网盘上）。"""
    if not 0 <= number < len(timeline.frames):
        return None
    frame = timeline.frames[number]
    key = (str(frame.path), frame.start, frame.box, frame.bif_number)
    try:
        return _FRAMES.get(key, lambda: media_io.bounded(
            media_io.mount_key(frame.path), timeline_sources.frame_bytes, timeline, number))
    except TimeoutError:
        return None


def q_thumbnail_jobs(contract, _args):
    state = contract.thumbnail_job.snapshot() or {}
    return {'mode': read_mode(), 'modes': list(timeline_sheets.MODES),
            'intervals': dict(timeline_sheets.INTERVALS),
            'status': state.get('status') or 'idle',
            'stage': state.get('stage') or '',
            'message': state.get('message') or '',
            'waiting_for_update': bool(state.get('waiting_for_update')),
            'job_id': state.get('job_id') or '',
            'total': state.get('total') or 0, 'done': state.get('done') or 0,
            'made': state.get('made') or 0, 'skipped': state.get('skipped') or 0,
            'failed': state.get('failed') or 0, **coded('stopped', state.get('stopped') or '')}


def _with_progress(fields: dict) -> dict:
    """任务中心（活动页）按 `checked` / `total` 画进度条，这条链自己的计数叫 `done`。"""
    return {**fields, 'checked': fields['done']} if 'done' in fields else fields


def w_thumbnail_jobs(contract, body):
    """选档位。选 `off` 只是停手，已经生成的图留在盘上——几 GB 的产物删不删是另一件
    事，走数据管理页那条清理链，不在切换开关时顺手做掉。"""
    mode = str((body or {}).get('mode') or timeline_sheets.OFF)
    if mode not in timeline_sheets.MODES:
        raise UserValueError("api.timelineThumbnails.invalidMode")
    if mode != timeline_sheets.OFF and metadata_only(contract.follow_state_root):
        raise UserValueError("api.timelineThumbnails.previewsDisabled")
    write_mode(mode)
    if mode == timeline_sheets.OFF:
        contract.thumbnail_job.stop(resume=False)
        return q_thumbnail_jobs(contract, {})
    choice = FFmpegResolver(FFMPEG_DIR).ffmpeg()
    if choice is None:
        raise UserValueError("api.timelineThumbnails.ffmpegMissing")
    interval = timeline_sheets.INTERVALS[mode]
    root = contract.timeline_root

    def work(job_id):
        from .settings_file import load_config
        config = getattr(contract, 'upgrade_config', None) or load_config()
        guard = CapacityGuard(config)
        result = timeline_sheets.generate_library(
            contract.db_path, root, interval, ffmpeg=str(choice.path),
            active=lambda: ((contract.thumbnail_job.snapshot() or {}).get('job_id') == job_id
                            and not metadata_only(contract.follow_state_root)),
            report=lambda **fields: contract.thumbnail_job.update(job_id, **_with_progress(fields)),
            guard=guard, resume_state=contract.thumbnail_job.snapshot(),
            checkpoint=lambda **fields: contract.thumbnail_job.checkpoint(job_id, **fields))
        # 磁盘触线停下来的那一轮不能记成完成：队列后面还剩几千部，而页面上「完成」
        # 和「跑完了」是同一个意思。按停是用户自己做的，不算故障。
        # 磁盘闸门那句带 code（`Said`），失败原因随它按界面语言显示。
        stopped = result.get('stopped') or ''
        failed = bool(stopped) and stopped != timeline_sheets.STOPPED_BY_USER
        contract.thumbnail_job.update(
            job_id, **_with_progress(result), completed_at=time.time(),
            status='failed' if failed else 'complete',
            **coded('error', stopped if failed else ''))

    contract.thumbnail_job.start(work, restart=True, recovery={'mode': mode},
                                 initial={'mode': mode, 'interval': interval,
                                          **stage_fields('thumbnails.fetch'), 'checked': 0,
                                          'total': 0, 'done': 0, 'made': 0,
                                          'skipped': 0, 'failed': 0, 'stopped': ''})
    return q_thumbnail_jobs(contract, {})
