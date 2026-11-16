"""按关键帧切 HLS 片段，避免挂载网盘承担整段 MP4 Range。"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import subprocess
import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path

from .ffmpeg import FFmpegResolver
from .hardware_transcode import QUALITY_BITRATES, HardwareTranscoder, software_video_output
from .mkvindex import keyframe_seconds as mkv_keyframe_seconds
from .mp4index import keyframe_seconds, segment_plan
from .streaming import StreamSessionRegistry, _cancel_and_wait, _wait_for_tasks
from .smb_media import input_url

HLS_SEGMENT_SECONDS = 6
# 片段缓存上限。超了按最后访问时间淘汰；片段可再生，丢了只是重跑一次 FFmpeg。
DEFAULT_CACHE_BYTES = 2 << 30
PLAN_CACHE_LIMIT = 256
SESSION_PLAN_LIMIT = 64
CODEC_CACHE_LIMIT = 256
PROBE_TIMEOUT_SECONDS = 20
GENERATION_TIMEOUT_SECONDS = 120
logger = logging.getLogger(__name__)


def _first_video_pts(ffprobe: Path, source: Path) -> float:
    """只检查本地临时片段开头的视频包，取得封装器使用的时间轴起点。"""
    result = subprocess.run([
        str(ffprobe), "-v", "error", "-read_intervals", "%+#64", "-select_streams", "v:0",
        "-show_entries", "packet=pts_time,flags", "-of", "json", str(source),
    ], capture_output=True, timeout=PROBE_TIMEOUT_SECONDS,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    packets = json.loads(result.stdout).get("packets", []) if result.returncode == 0 else []
    if not packets or "K" not in packets[0].get("flags", ""):
        raise SegmentUnavailable("remux source has no leading keyframe")
    timestamp = float(packets[0]["pts_time"])
    if not math.isfinite(timestamp):
        raise SegmentUnavailable("invalid remux timestamp")
    return timestamp


def _probe_video_codec(ffprobe: Path, source: Path) -> str:
    """问 ffprobe 要第一条视频流的编码名。问不出来返回空串，调用方按软件解码处理。"""
    command = (str(ffprobe), "-v", "error", "-select_streams", "v:0", "-show_entries",
               "stream=codec_name", "-of", "default=nw=1:nk=1", input_url(source))
    try:
        result = subprocess.run(command, capture_output=True, timeout=PROBE_TIMEOUT_SECONDS,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    except (OSError, subprocess.SubprocessError):
        return ""
    return result.stdout.decode("utf-8", "replace").strip().lower() if result.returncode == 0 else ""


class SessionPlans:
    """一次播放（流会话 × 资产）解析好的分片计划，播放列表算一次，之后每个分片直接取用。

    分片端点原先每片都重算一遍：读账本、找片源、问画像，片源要转码时还可能跑 ffprobe，而这一步
    排在只有几个线程的执行器里。计划本来就要在整段会话里保持同一个形状（`_hls_plan`），按会话
    记住它是同一个约束。会话取消时摘掉，总量有界。

    `variant` 区分同一会话里的另一套计划：播放器从保留码流的分片退到视频重编码时，
    沿用同一个会话，计划却换成固定 6 秒的那一套。
    """

    def __init__(self, limit: int = SESSION_PLAN_LIMIT):
        self._limit = limit
        self._plans: OrderedDict[tuple[str, int, str], tuple] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, session: str, asset_id: int, variant: str = "") -> tuple | None:
        with self._lock:
            plan = self._plans.get((session, asset_id, variant))
            if plan is not None:
                self._plans.move_to_end((session, asset_id, variant))
            return plan

    def put(self, session: str, asset_id: int, plan: tuple, variant: str = "") -> None:
        with self._lock:
            self._plans[(session, asset_id, variant)] = plan
            self._plans.move_to_end((session, asset_id, variant))
            while len(self._plans) > self._limit:
                self._plans.popitem(last=False)

    def forget(self, session: str) -> None:
        with self._lock:
            for key in [key for key in self._plans if key[0] == session]:
                del self._plans[key]


class SegmentUnavailable(RuntimeError):
    pass


class SegmentCancelled(RuntimeError):
    pass


def build_hls_playlist(plan: list[tuple[float, float]], segment_url) -> str:
    """按真实分片计划生成 VOD 播放列表。

    时长必须写实际值。按 6 秒等分声明的话，`-c copy` 只能切在关键帧上，
    遇到关键帧间隔 8.33 秒的片源，目录说的和实际内容就完全对不上。
    """
    target = max(1, round(max(length for _, length in plan)))
    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        f"#EXT-X-TARGETDURATION:{target}",
        "#EXT-X-PLAYLIST-TYPE:VOD",
        "#EXT-X-MEDIA-SEQUENCE:0",
    ]
    for index, (_, length) in enumerate(plan):
        lines.extend((f"#EXTINF:{length:.3f},", str(segment_url(index))))
    lines.extend(("#EXT-X-ENDLIST", ""))
    return "\n".join(lines)


@dataclass
class _Generation:
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    users: int = 0
    task: asyncio.Task[Path] | None = None


class HlsSegmentService:
    """按关键帧边界 remux 单个时间段，输出可缓存的 MPEG-TS。"""

    def __init__(
        self,
        resolver: FFmpegResolver,
        work_root: Path,
        segment_seconds: int = HLS_SEGMENT_SECONDS,
        max_concurrent: int | None = None,
        cache_bytes: int = DEFAULT_CACHE_BYTES,
        prefer_hardware: bool = False,
        hardware: HardwareTranscoder | None = None,
    ):
        self.resolver = resolver
        self.work_root = work_root
        self.capacity_guard = None
        self.segment_seconds = segment_seconds
        self.cache_bytes = cache_bytes
        self.prefer_hardware = prefer_hardware
        self.hardware = hardware if hardware is not None else HardwareTranscoder(enabled=prefer_hardware)
        # 每个分片请求都会起一个 FFmpeg；播放器本身就并发预取，多设备同看能把机器打满。
        self._limit = max_concurrent or max(1, (os.cpu_count() or 4) // 2)
        self._semaphore: asyncio.Semaphore | None = None
        self._plans: OrderedDict[tuple, list[tuple[float, float]]] = OrderedDict()
        self._codecs: OrderedDict[tuple, str] = OrderedDict()
        # 同一分片常被并发请求：播放器预取、重连、多设备同看都会撞上同一个目标文件。
        # 同目标只放一个生成者，后到者等它完事后直接用缓存，不再各起一个 FFmpeg 重读网盘。
        self._generation_locks: dict[Path, _Generation] = {}
        # 淘汰要把缓存目录整个列一遍：按新写入的字节攒够一截才跑一次，放在线程里，同一时刻只跑一次。
        self._written_since_evict = 0
        self._evicting = False

    def _gate(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self._limit)
        return self._semaphore

    def fingerprint(self, source: Path) -> tuple:
        from . import media_io
        try:
            # 起播与每个分片请求都问这一句：网盘答不上按期限当作读不到，不挂住 HLS 线程池。
            stat = media_io.bounded(media_io.mount_key(source), source.stat)
        except OSError:
            return (str(source), 0, 0)
        return (str(source), stat.st_size, int(stat.st_mtime))

    async def video_codec(self, source: Path) -> str:
        """片源的视频编码名；探测不到返回空串。按 (路径, 大小, mtime) 缓存。

        只有重编码路径问这一句，用来决定敢不敢把解码交给显卡。探测本身在线程里跑：
        片源在挂载网盘上时 ffprobe 要几百毫秒，占着事件循环会卡住同时在放的其它片。
        """
        key = await asyncio.to_thread(self.fingerprint, source)
        cached = self._codecs.get(key)
        if cached is not None:
            self._codecs.move_to_end(key)
            return cached
        choice = self.resolver.ffprobe()
        codec = await asyncio.to_thread(_probe_video_codec, choice.path, source) if choice else ""
        while len(self._codecs) >= CODEC_CACHE_LIMIT:
            self._codecs.popitem(last=False)
        self._codecs[key] = codec
        return codec

    def plan(self, source: Path, duration: float) -> list[tuple[float, float]] | None:
        """返回分片计划；读不到关键帧就返回 None，由调用方回退标准 Range。"""
        key = (*self.fingerprint(source), self.segment_seconds, round(duration, 3))
        cached = self._plans.get(key)
        if cached is not None:
            self._plans.move_to_end(key)
            return cached or None
        keyframes = (mkv_keyframe_seconds(source) if source.suffix.lower() == ".mkv"
                     else keyframe_seconds(source))
        result = segment_plan(keyframes, duration, self.segment_seconds) if keyframes else []
        while len(self._plans) >= PLAN_CACHE_LIMIT:
            self._plans.popitem(last=False)
        self._plans[key] = result
        return result or None

    def cached_path(self, source: Path, asset_id: int, index: int, *, transcode: bool = False,
                    max_height: int = 0, audio_transcode: bool = False) -> Path:
        _, size, mtime = self.fingerprint(source)
        # 版本号跟着转码命令走：命令一变，磁盘上按另一套命令转出来的片段就得失效，
        # 否则换了解码器，播放器拿到的仍是缓存里那些绿帧。
        # v3：QSV 全硬件链等后端改了命令却没换目录，v2 目录里的旧片段与新片段可能出自不同编码器，
        # 同一次播放混着放会在片段交界处换参数集；升级后旧目录不再命中，按需重转、按容量淘汰。
        # 画质上限同理：原画不带后缀，换一档就是另一套片段。
        # 只转音轨与 MKV 码流复制各用一套目录：命令、切点与视频重编码那套都不同。
        quality = f"-{max_height}p" if max_height in QUALITY_BITRATES else ""
        flavor = (f'-h264-v3{quality}' if transcode else '-aac-v2' if audio_transcode
                  else '-mkv-v1' if source.suffix.lower() == '.mkv' else '')
        return self.work_root / str(asset_id) / f"{size}-{mtime}-{self.segment_seconds}{flavor}" / f"{index}.ts"

    def conversion_plan(self, duration: float) -> list[tuple[float, float]]:
        """编码片段各自以关键帧开始，覆盖完整的播放时间轴。"""
        return [(float(start), min(float(self.segment_seconds), duration - start))
                for start in range(0, math.ceil(duration), self.segment_seconds)]

    def _evict(self) -> None:
        files = [item for item in self.work_root.rglob("*.ts") if item.is_file()]
        total = 0
        stats = []
        for item in files:
            try:
                stat = item.stat()
            except OSError:
                continue
            total += stat.st_size
            stats.append((stat.st_mtime, stat.st_size, item))
        if total <= self.cache_bytes:
            return
        for _, size, item in sorted(stats):
            try:
                item.unlink()
            except OSError:
                continue
            total -= size
            if total <= self.cache_bytes:
                return

    async def _evict_after(self, written: int) -> None:
        """记下新写入的字节，攒够缓存上限的十六分之一才在线程里淘汰一次。"""
        self._written_since_evict += written
        if self._evicting or self._written_since_evict < max(1, self.cache_bytes // 16):
            return
        self._evicting = True
        self._written_since_evict = 0
        try:
            await asyncio.to_thread(self._evict)
        finally:
            self._evicting = False

    def _cached_target(self, source: Path, asset_id: int, index: int,
                       transcode: bool, audio_transcode: bool = False) -> tuple[Path, bool, int]:
        """分片缓存的位置、是否已有，以及这一段按哪一档画质上限编码；命中即续期。

        画质上限只在这里读一次，缓存位置和编码命令用同一个值：中途改了设置，也不会把新一档的
        片段写进旧一档的目录。要 stat 片源（可能在网盘上），只在线程里调。
        """
        max_height = self.hardware.max_height() if transcode else 0
        target = self.cached_path(source, asset_id, index, transcode=transcode, max_height=max_height,
                                  **({"audio_transcode": True} if audio_transcode and not transcode else {}))
        if target.is_file() and target.stat().st_size:
            os.utime(target, None)      # 命中即续期，淘汰按最后访问时间
            return target, True, max_height
        return target, False, max_height

    async def generate(
        self,
        source: Path,
        start: float,
        duration: float,
        *,
        asset_id: int,
        index: int,
        session: str,
        registry: StreamSessionRegistry,
        transcode: bool = False,
        audio_transcode: bool = False,
    ) -> Path:
        # 缓存位置要 stat 片源：网盘忙时一次 stat 能卡几秒，放在事件循环上会停住整个服务的发送。
        target, hit, max_height = await asyncio.to_thread(
            self._cached_target, source, asset_id, index, transcode,
            **({"audio_transcode": True} if audio_transcode else {}))
        if hit:
            return target
        consumer = asyncio.current_task()
        if consumer is None or not registry.register(session, consumer):
            raise SegmentCancelled(session)
        entry = self._generation_locks.setdefault(target, _Generation())
        entry.users += 1
        try:
            if entry.task is not None and entry.task.cancelling():
                await _wait_for_tasks(entry.task)
            if entry.task is None or entry.task.done():
                entry.task = asyncio.create_task(self._generate_locked(
                    entry.lock, source, start, duration, target, registry=registry, transcode=transcode,
                    max_height=max_height, audio_transcode=audio_transcode))
            generation = entry.task
            await asyncio.wait({generation})
            return generation.result()
        finally:
            registry.unregister(session, consumer)
            entry.users -= 1
            if entry.users == 0:
                try:
                    if entry.task is not None:
                        await _cancel_and_wait(entry.task)
                finally:
                    if entry.users == 0 and self._generation_locks.get(target) is entry:
                        self._generation_locks.pop(target, None)

    async def _generate_locked(self, lock: asyncio.Lock, source: Path, start: float,
                               duration: float, target: Path, *, registry: StreamSessionRegistry,
                               transcode: bool, max_height: int = 0, audio_transcode: bool = False) -> Path:
        async with lock:
            if target.is_file() and target.stat().st_size:
                os.utime(target, None)
                return target
            try:
                async with asyncio.timeout(GENERATION_TIMEOUT_SECONDS):
                    return await self._generate_uncached(
                        source, start, duration, target, session=f'hls-{uuid.uuid4().hex}',
                        registry=registry, transcode=transcode, max_height=max_height,
                        audio_transcode=audio_transcode)
            except TimeoutError as error:
                raise SegmentUnavailable('segment generation timed out') from error

    async def _generate_uncached(
        self, source: Path, start: float, duration: float, target: Path, *,
        session: str, registry: StreamSessionRegistry, transcode: bool, max_height: int = 0,
        audio_transcode: bool = False,
    ) -> Path:
        choice = self.resolver.ffmpeg()
        if choice is None:
            raise SegmentUnavailable("ffmpeg unavailable")
        if registry.is_cancelled(session):
            raise SegmentCancelled(session)
        target.parent.mkdir(parents=True, exist_ok=True)
        codec = await self.video_codec(source) if transcode and self.hardware.enabled else ""
        detail = ""
        async with self._gate():
            attempts = await asyncio.to_thread(
                self._attempts, choice.path, source, start, duration, transcode, codec, max_height,
                audio_transcode=audio_transcode,
            )
            for name, build in attempts:
                temporary = target.with_name(f"{uuid.uuid4().hex}.tmp.ts")
                try:
                    returncode, stderr = await self._run(build(temporary), session, registry)
                    if returncode == 0 and temporary.is_file() and temporary.stat().st_size:
                        if not transcode and source.suffix.lower() == ".mkv":
                            await self._align_remux(choice.path, temporary, start, duration, session, registry)
                        written = temporary.stat().st_size
                        temporary.replace(target)
                        logger.info("HLS segmenting finished: %s", name)
                        await self._evict_after(written)
                        return target
                    if registry.is_cancelled(session):
                        raise SegmentCancelled(session)
                    detail = stderr.decode("utf-8", "replace")[-1000:]
                    if not detail:
                        # FFmpeg 可以退出码 0、stderr 全空却写出 0 字节（时间窗取错就是
                        # 这样）。此时光报 "ffmpeg failed" 等于没报，把能观测到的都说出来。
                        size = temporary.stat().st_size if temporary.is_file() else None
                        detail = (
                            f"ffmpeg wrote no data: returncode={returncode} "
                            f"bytes={'missing' if size is None else size} "
                            f"ss={start:.3f} to={start + duration:.3f}"
                        )
                    detail = f"{name}: {detail}"
                finally:
                    temporary.unlink(missing_ok=True)
        raise SegmentUnavailable(detail)

    async def _align_remux(self, ffmpeg: Path, source: Path, start: float, duration: float,
                           session: str, registry: StreamSessionRegistry) -> None:
        """用 FFmpeg segment muxer 在关键帧上裁掉本地片段的定位预卷和结束关键帧。

        MKV 的 `-ss` 落在 Cues 指向的关键帧上，码流复制会带着它之前的预卷与终点后的那个关键帧；
        相邻两段各带一份就会在时间轴上重叠。片段已落在本地临时目录，再切一刀只读本地盘。
        """
        probe = self.resolver.ffprobe()
        if probe is None:
            raise SegmentUnavailable("ffprobe unavailable")
        try:
            first = await asyncio.to_thread(_first_video_pts, probe.path, source)
        except (OSError, ValueError, KeyError, subprocess.SubprocessError) as exc:
            raise SegmentUnavailable("remux timestamp unavailable") from exc
        offset = start - first
        if offset < -0.001 and start > 0:
            raise SegmentUnavailable("remux starts after the requested keyframe")
        boundaries = ([offset] if offset > 0.001 else []) + [offset + duration]
        pattern = source.with_name(source.stem + ".split-%d.ts")
        selected = source.with_name(source.stem + f".split-{1 if len(boundaries) == 2 else 0}.ts")
        try:
            command = [str(ffmpeg), "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                       "-copyts", "-i", str(source), "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy",
                       "-avoid_negative_ts", "disabled", "-f", "segment", "-segment_times",
                       ",".join(f"{value:.6f}" for value in boundaries),
                       "-segment_time_delta", "0.000001", "-segment_format", "mpegts", "-reset_timestamps", "0",
                       "-segment_format_options", "mpegts_copyts=1:avoid_negative_ts=disabled", str(pattern)]
            returncode, _ = await self._run(command, session, registry)
            if registry.is_cancelled(session):
                raise SegmentCancelled(session)
            if returncode or not selected.is_file() or not selected.stat().st_size:
                raise SegmentUnavailable("keyframe remux failed")
            selected.replace(source)
        finally:
            for part in source.parent.glob(source.stem + ".split-*.ts"):
                part.unlink(missing_ok=True)

    def _attempts(self, ffmpeg: Path, source: Path, start: float, duration: float,
                  transcode: bool, codec: str = "", max_height: int = 0, *, audio_transcode: bool = False):
        """依次尝试的命令，每项是 (名字, 接收临时文件路径的构造函数)。

        封装复制只有一种，不受画质上限影响。重编码与整片转码共享可用硬件后端，最后回退 libx264；
        Windows 上 libx264 前先试一次 D3D11VA 解码。`max_height` 为画质上限，0 为原画。

        NVDEC 解得出来的编码才走 CUDA 解码，`codec` 空或不在名单里就从软件解码起。
        判据要在开跑前定，因为坏结果不会自报：实测 `MIAD573_02.wmv`（vc1、1080p）经
        `-hwaccel cuda` 出来的首个分片，开头 21 帧在黑场与纯绿之间交替（色度均值在
        128 与 0 之间跳），而 FFmpeg 退出码 0、stderr 全空，绿帧就这么写进缓存，
        下次命中还是它。同一段去掉 CUDA 解码后色度全程 128，一帧绿都没有。
        """
        prefix = [str(ffmpeg), "-hide_banner", "-loglevel", "error", "-nostdin", "-y"]
        mapping = ["-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn"]
        mux = ["-muxdelay", "0", "-muxpreload", "0", "-f", "mpegts"]
        if not transcode:
            # 终点必须写成绝对时间戳。-copyts 保留原始时间轴后，-t 会被当成绝对结束时刻
            # 而不是片段时长，于是除了开头那一两段，每段的 -t 都早已过期，ffmpeg 以
            # 退出码 0、空 stderr 写出 0 字节，服务端只能报一句没有内容的 ffmpeg failed。
            # 保留原始时间戳，让每段接着上一段走。用 -avoid_negative_ts make_zero
            # 把每段归零的话，每段都自称从 0 秒开始，拖动进度条时容易跳错位置。
            window = ["-ss", f"{start:.3f}", "-i", input_url(source), "-to", f"{start + duration:.3f}"]
            if not audio_transcode and source.suffix.lower() != ".mkv":
                return [("copy", lambda out: prefix + window + mapping + ["-c", "copy", "-copyts"] + mux + [str(out)])]
            # MKV 复制与只转音轨：时间戳原样进 MPEG-TS，不让封装器平移或归零，
            # 否则 MKV 段随后按关键帧裁齐时对不上计划里的绝对时刻。
            codecs = (["-c:v", "copy", "-c:a", "aac", "-b:a", "160k"]
                      if audio_transcode else ["-c", "copy"])
            return [("audio" if audio_transcode else "copy", lambda out:
                     prefix + window + mapping + codecs + ["-copyts", "-avoid_negative_ts", "disabled",
                                                          "-mpegts_copyts", "1"] + mux + [str(out)])]
        window = ["-ss", f"{start:.3f}", "-i", input_url(source), "-t", f"{duration:.3f}"]
        audio = ["-c:a", "aac", "-b:a", "160k", "-output_ts_offset", f"{start:.3f}"]
        attempts = []
        for encoder in self.hardware.encoders(ffmpeg):
            for attempt in encoder.attempts(codec, max_height):
                attempts.append((attempt.name, lambda out, attempt=attempt:
                                 prefix + list(attempt.before_input) + window + mapping
                                 + list(attempt.output) + audio + mux + [str(out)]))
        software = list(software_video_output(max_height, threads="2"))
        decode = list(self.hardware.decode_options(ffmpeg, codec))
        if decode:
            attempts.append(("d3d11va-libx264", lambda out: prefix + decode + window + mapping
                             + software + audio + mux + [str(out)]))
        attempts.append(("libx264", lambda out: prefix + window + mapping + software + audio + mux + [str(out)]))
        return attempts

    async def _run(self, command: list[str], session: str, registry: StreamSessionRegistry) -> tuple[int, bytes]:
        """跑一次 FFmpeg 并把进程登记到会话，取消时能被杀掉。返回 (退出码, stderr)。"""
        from .jobs import DiskSpaceDenied
        try:
            if self.capacity_guard is not None:
                await asyncio.to_thread(self.capacity_guard.check, force=True)
        except DiskSpaceDenied as error:
            raise SegmentUnavailable(str(error)) from error
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
                creationflags=creationflags,
            )
        except OSError as exc:
            raise SegmentUnavailable("ffmpeg failed to start") from exc
        if not registry.register_process(session, process):
            _kill_process(process)
            await process.communicate()
            raise SegmentCancelled(session)
        communication = asyncio.create_task(process.communicate())
        try:
            while not communication.done():
                await asyncio.wait((communication,), timeout=0.5)
                if self.capacity_guard is not None:
                    try:
                        await asyncio.to_thread(self.capacity_guard.check)
                    except DiskSpaceDenied as error:
                        _kill_process(process)
                        await _wait_for_tasks(communication)
                        raise SegmentUnavailable(str(error)) from error
            _, stderr = await communication
        except asyncio.CancelledError:
            _kill_process(process)
            await _wait_for_tasks(communication)
            raise
        finally:
            registry.unregister_process(session, process)
        return process.returncode, stderr or b""


def _kill_process(process) -> None:
    try:
        if process.returncode is None:
            process.kill()
    except (OSError, ProcessLookupError):
        pass
