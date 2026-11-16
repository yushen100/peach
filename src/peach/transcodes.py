from __future__ import annotations

import json
import logging
import os
import subprocess
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, replace
from pathlib import Path
from .smb_media import input_url

from .ffmpeg import FFmpegResolver
from .hardware_transcode import QUALITY_BITRATES, HardwareTranscoder, software_video_output
from .mp4index import composition_offsets_present


BROWSER_NATIVE_SUFFIXES = frozenset({".mp4", ".m4v", ".webm", ".ogv", ".ogg"})
#: MPEG-TS 一类容器：浏览器的 `<video>` 不认，但里面常是浏览器解得了的 H.264／HEVC。
#: 起播前先探编码，解得了就整片换封装成 MP4（`-copy` 缓存），不按 6 秒分片重编码。
REMUX_SUFFIXES = frozenset({".ts", ".m2ts", ".mts"})
DIRECT_MP4_PIXEL_FORMATS = frozenset({"yuv420p", "yuvj420p"})
#: 原文件试播时浏览器普遍能出声的音轨；AC-3、DTS、PCM 这类多半静音照放，不报错也就不会回退。
ORIGINAL_AUDIO_CODECS = frozenset({"", "aac", "mp3", "opus", "flac", "vorbis"})
#: 浏览器在 `decode=` 里能报的解码能力：HEVC 8 位、HEVC 10 位、认不认 `hev1` 标签（Safari 只认 `hvc1`）。
DECODE_CAPABILITIES = frozenset({"hevc", "hevc10", "hev1"})
#: 杜比视界的 codec tag。ffprobe 报的编码仍是 hevc，浏览器直放会偏色或解不出，一律转码。
DOLBY_VISION_TAGS = frozenset({"dvh1", "dvhe"})
TRANSCODE_TIMEOUT_SECONDS = 3600
PROBE_TIMEOUT_SECONDS = 20
#: 探测失败记多久。键里有大小和修改时间，文件换了自然重探；冷却只挡同一份文件反复白等。
PROBE_FAILURE_SECONDS = 300
PROFILE_CACHE_LIMIT = 512
_UNKNOWN = object()
#: 整片软件转码最多占一半核。不设上限时 libx264 在 8 核 M1 上实测吃到 ~600% CPU，
#: 同时在播的 HLS 分片、Safari 解码和 Jellyfin 都被它挤慢。
SOFTWARE_TRANSCODE_THREADS = max(2, (os.cpu_count() or 4) // 2)
logger = logging.getLogger(__name__)


def _remember(cache: dict, key, value) -> None:
    """有界写入：满了丢最早的那一条。"""
    if key not in cache and len(cache) >= PROFILE_CACHE_LIMIT:
        cache.pop(next(iter(cache)))
    cache[key] = value


@dataclass(frozen=True)
class _MediaProfile:
    video_codec: str
    pixel_format: str
    audio_codec: str
    #: 容器报的总时长（秒）；探测不到时为 0，切片计划据此决定能不能按时间切。
    duration: float = 0.0
    #: 有 B 帧却没有 ctts：容器声明的显示时刻其实是解码顺序，直接播会掉帧。
    decode_order_timestamps: bool = False
    #: 视频轨的 codec tag（`hvc1`、`hev1`、`avc1`…），小写；探测不到为空。
    codec_tag: str = ""


def parse_decode(raw: str) -> frozenset[str]:
    """`/api/stream-plan` 与 `/stream` 的 `decode=` 参数；不认识的项丢掉，空串就是什么都不报。"""
    return frozenset(part for part in (raw or "").split(",") if part in DECODE_CAPABILITIES)


def video_decodes(profile: _MediaProfile, decode: frozenset[str] = frozenset()) -> bool:
    """浏览器能不能解这条视频轨，不看容器和音轨。

    H.264 8 位所有浏览器都能解；HEVC 要浏览器在 `decode` 里报了才算，10 位另要 `hevc10`。
    杜比视界和 4:2:2/4:4:4 一律不算。`hev1` 标签放在容器层判断（换封装就能改成 `hvc1`）。
    """
    if profile.video_codec == "h264":
        return profile.pixel_format in DIRECT_MP4_PIXEL_FORMATS
    if profile.video_codec != "hevc" or "hevc" not in decode or profile.codec_tag in DOLBY_VISION_TAGS:
        return False
    if profile.pixel_format in DIRECT_MP4_PIXEL_FORMATS:
        return True
    return profile.pixel_format == "yuv420p10le" and "hevc10" in decode


@dataclass(frozen=True)
class _TranscodeAttempt:
    name: str
    command: tuple[str, ...]


class TranscodeUnavailable(RuntimeError):
    """转码不可用；本机保留有界工具证据，远程仅投影错误码和类别。"""

    def __init__(self, message='', *, diagnostics=None):
        super().__init__(message)
        from .error_reporting import scrub
        self.diagnostics = scrub(diagnostics or {})
        self.returncode = self.diagnostics.get('returncode')


class TranscodeCancelled(TranscodeUnavailable):
    pass


class TranscodeCapacityDenied(TranscodeUnavailable):
    """容量暂停不进入编码器回退。"""


class TranscodeNeedsSession(TranscodeUnavailable):
    """片源要整片转码，但请求没带可取消的流会话，也没有现成缓存。"""


def _source_stat(source: Path, known):
    """片源的 stat：调用方刚取过（`known`）就用它，网盘上每次 stat 都是一趟网络往返；没取过再问。

    再问时带期限（`media_io.bounded`），网盘答不上抛超时，由调用方按片源不可用处理。
    """
    if known is not None:
        return known
    from . import media_io
    return media_io.bounded(media_io.mount_key(source), source.stat)


def _touch(path: Path) -> None:
    """命中即续期：容量清理按修改时间判断「最久没用」，和 HLS 分段的做法一致。"""
    try:
        os.utime(path, None)
    except OSError:
        pass


class TranscodeService:
    """Create immutable browser-playable MP4 cache entries without touching sources."""

    def __init__(
        self,
        resolver: FFmpegResolver,
        cache_root: Path,
        *,
        max_concurrent: int = 2,
        prefer_hardware: bool | None = None,
        state_root: Path | None = None,
    ):
        self.resolver = resolver
        self.cache_root = cache_root
        self.capacity_guard = None
        self.prefer_hardware = prefer_hardware is not False
        self.hardware = HardwareTranscoder(enabled=self.prefer_hardware, state_root=state_root)
        self._locks: dict[int, list] = {}
        self._locks_guard = threading.Lock()
        self._slots = threading.Semaphore(max(1, max_concurrent))
        self._native_profiles: dict[tuple[str, int, int], _MediaProfile] = {}
        #: 探测失败的文件到冷却结束的时刻（`time.monotonic()`），键同上。
        self._failed_probes: dict[tuple[str, int, int], float] = {}
        self._probing: dict[tuple[str, int, int], threading.Lock] = {}

    @staticmethod
    def needs_transcode(source: Path) -> bool:
        return source.suffix.lower() not in BROWSER_NATIVE_SUFFIXES

    def diagnostic_profile(self, source: Path) -> dict:
        """只读本次进程已有的探测缓存，不为诊断读取媒体或启动工具。"""
        from dataclasses import asdict
        with self._locks_guard:
            matches = [(key, profile) for key, profile in self._native_profiles.items() if key[0] == str(source)]
        if not matches:
            return {'status': 'unavailable', 'reason': 'not-probed'}
        key, profile = matches[-1]
        return {'status': 'cached', 'size_bytes': key[1], 'modified_ns': key[2], **asdict(profile)}

    def requires_conversion(self, source: Path, *, session: str = "", registry=None,
                            decode: frozenset[str] = frozenset()) -> bool:
        """按容器、内部编码和浏览器报的解码能力（`decode`）选择兼容路径，不生成整片缓存。"""
        if self.needs_transcode(source):
            return True
        if self.resolver.ffprobe() is None:
            return False
        profile = self._profile_for(source, session, registry)
        return profile is None or not self._browser_compatible(source, profile, decode)

    def remuxes(self, source: Path, *, session: str = "", registry=None,
                decode: frozenset[str] = frozenset()) -> bool:
        """MP4 里浏览器解得了的视频，只因音轨或 `hev1` 标签放不了：整片换封装就行，不用重编码。

        MP4 只认浏览器报了能力的 HEVC。H.264 配不兼容音轨仍走原来的转码分片：那条路起播快，
        H.264 重编码在任何机器上都跟得上，没理由为它改行为。

        `.ts`、`.m2ts`、`.mts` 只是容器浏览器不认：视频流解得了（H.264 8 位，或报了能力的 HEVC）
        就整片换封装，换一次之后命中缓存，拖动也准。
        """
        suffix = source.suffix.lower()
        if suffix not in {".mp4", ".m4v"} | REMUX_SUFFIXES or self.resolver.ffprobe() is None:
            return False
        profile = self._profile_for(source, session, registry)
        if suffix in REMUX_SUFFIXES:
            return bool(profile and video_decodes(profile, decode))
        return bool(profile and profile.video_codec == "hevc" and video_decodes(profile, decode)
                    and not profile.decode_order_timestamps
                    and not self._browser_compatible(source, profile, decode))

    def hls_mode(self, source: Path, *, session: str = "", registry=None) -> str:
        """分片所需处理：兼容视频保留码流，音轨单独判断。

        返回 `copy`（音视频都复制）、`audio`（视频复制、音轨转 AAC）或 `transcode`（视频重编码）。
        只有 H.264 8 位、时间戳没错乱的视频才保留码流；HEVC 进 MPEG-TS 分片各浏览器支持不一，仍转码。
        """
        if self.resolver.ffprobe() is None:
            return "transcode"
        profile = self._profile_for(source, session, registry)
        if (profile is None or profile.video_codec != "h264"
                or profile.pixel_format not in DIRECT_MP4_PIXEL_FORMATS
                or profile.decode_order_timestamps):
            return "transcode"
        return "copy" if profile.audio_codec in {"", "aac", "mp3"} else "audio"

    def original_playable(self, source: Path, *, session: str = "", registry=None,
                          decode: frozenset[str] = frozenset()) -> bool:
        """值不值得先让浏览器试原文件：MP4、M4V、MKV 里视频解得了、音轨浏览器认、时间戳没错乱。

        浏览器遇到解不了的视频常常不报错，只出声音或黑屏；认不了的音轨则静音照放。这两种都
        触发不了回退，所以只给编码上能放的片子原文件地址，其余直接走分片。容器（如 Safari 不认
        MKV）交给浏览器报格式错误再退。
        """
        if source.suffix.lower() not in {".mp4", ".m4v", ".mkv"} or self.resolver.ffprobe() is None:
            return False
        profile = self._profile_for(source, session, registry)
        return bool(profile and video_decodes(profile, decode)
                    and profile.audio_codec in ORIGINAL_AUDIO_CODECS
                    and not profile.decode_order_timestamps)

    def decode_order_timestamps(self, source: Path, *, session: str = "", registry=None, stat=None,
                                decode: frozenset[str] = frozenset()) -> bool:
        """是不是只有时间戳错乱的那一类：有 B 帧却没有 ctts，码流本身浏览器解得出来。

        这类片源不必重编码，重建一份头就够了；其余不兼容的原因（编码、像素格式、容器）
        换不掉，只能转码。`stat` 是调用方刚取过的片源 stat，给了就不再问网盘。
        """
        if self.needs_transcode(source) or self.resolver.ffprobe() is None:
            return False
        profile = self._profile_for(source, session, registry, stat)
        return bool(profile and profile.decode_order_timestamps
                    and self._decodes_in_browser(source, profile, decode))

    def media_duration(self, source: Path, *, session: str = "", registry=None) -> float:
        """ffprobe 报的总时长（秒）；账本没记时长的片源靠它切片。探测不到返回 0。"""
        if self.resolver.ffprobe() is None:
            return 0.0
        try:
            profile = self._profile_for(source, session, registry)
        except OSError:
            return 0.0
        return profile.duration if profile is not None else 0.0

    def _profile_for(self, source: Path, session: str, registry, stat=None) -> _MediaProfile | None:
        """按 (路径, 大小, mtime) 缓存探测结果；同一个文件只问 ffprobe 一次。

        `stat` 是调用方刚取过的片源 stat：网盘上每次 stat 都是一趟网络往返，给了就不再问。
        """
        stat = _source_stat(source, stat)
        key = (str(source), stat.st_size, stat.st_mtime_ns)
        with self._locks_guard:
            if (known := self._known_profile(key)) is not _UNKNOWN:
                return known
            gate = self._probing.setdefault(key, threading.Lock())
        # 一次起播会从好几处问同一个文件的画像（能否直放、是否只缺 ctts、时长、分片计划）：
        # 同一时刻只放一个 ffprobe，失败也记下来一段时间。否则探测不到的片子每处各等满 20 秒，
        # 起播前就耗掉一分多钟。取消与容量暂停是抛出的，不算失败。
        with gate:
            with self._locks_guard:
                if (known := self._known_profile(key)) is not _UNKNOWN:
                    return known
            try:
                profile = self._probe(source, session, registry,
                                      time.monotonic() + PROBE_TIMEOUT_SECONDS)
                with self._locks_guard:
                    if profile is None:
                        _remember(self._failed_probes, key, time.monotonic() + PROBE_FAILURE_SECONDS)
                    else:
                        self._failed_probes.pop(key, None)
                        _remember(self._native_profiles, key, profile)
            finally:
                with self._locks_guard:
                    if self._probing.get(key) is gate:
                        del self._probing[key]
        return profile

    def _known_profile(self, key):
        """已缓存的画像；探测失败还在冷却期内是 None，都没有是 `_UNKNOWN`。调用方持 `_locks_guard`。"""
        profile = self._native_profiles.get(key)
        if profile is not None:
            return profile
        until = self._failed_probes.get(key)
        if until is not None:
            if until > time.monotonic():
                return None
            del self._failed_probes[key]
        return _UNKNOWN

    def browser_path(
        self, asset_id: int, source: Path, *, session: str = "", registry=None,
        convert: bool = True, stat=None, decode: frozenset[str] = frozenset(),
    ) -> tuple[Path, bool]:
        """浏览器能直接放的路径，以及它是不是转码产物。

        `convert=False` 时只交现成的整片缓存，缺缓存就抛 `TranscodeNeedsSession`。
        没有会话的请求取消不了，浏览器断开后整片 FFmpeg 还会跑到结束。
        `stat` 是调用方刚取过的片源 stat，给了就不再问网盘。
        `decode` 是浏览器报的解码能力：报了能解 HEVC，原片直放；只差音轨或 `hev1` 标签时
        整片换封装（视频不重编码），产物文件名带 `-copy`，和转成 H.264 的那份分开存。
        """
        direct, profile, copy = self._passthrough(source, session, registry, stat, decode)
        if direct:
            return source, False

        choice = self.resolver.ffmpeg()
        if choice is None:
            raise TranscodeUnavailable("ffmpeg unavailable")

        try:
            stat = _source_stat(source, stat)
        except OSError as exc:
            raise TranscodeUnavailable("source unavailable") from exc

        max_height = self.hardware.max_height()
        target = self._cache_target(asset_id, stat, max_height, copy=copy)
        if target.is_file() and target.stat().st_size:
            _touch(target)
            return target, True
        if not convert:
            raise TranscodeNeedsSession("conversion needs a stream session")

        with self._lock_for(asset_id):
            if target.is_file() and target.stat().st_size:
                return target, True
            self.cache_root.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(f"{target.stem}.{uuid.uuid4().hex}.tmp.mp4")
            deadline = time.monotonic() + TRANSCODE_TIMEOUT_SECONDS
            last_detail = ""
            last_diagnostics = {}
            last_error = None
            completed = False
            try:
                with self._slots:
                    self._raise_if_cancelled(session, registry)
                    if profile is None:
                        # 和起播前那几处共用画像缓存：探不动的片子冷却期内不再在转码槽里等满一次 ffprobe。
                        profile = self._profile_for(source, session, registry, stat)
                    for attempt in self._attempts(
                        choice.path, source, temporary, profile, max_height,
                        decode if copy else frozenset(),
                    ):
                        temporary.unlink(missing_ok=True)
                        try:
                            returncode, _stdout, stderr = self._execute(
                                attempt.command,
                                session=session,
                                registry=registry,
                                deadline=deadline,
                                label=attempt.name,
                            )
                        except (TranscodeCancelled, TranscodeCapacityDenied):
                            raise
                        except (OSError, TranscodeUnavailable) as exc:
                            last_detail = f"{attempt.name}: {exc}"
                            last_diagnostics = getattr(exc, 'diagnostics', {})
                            last_error = exc
                            if time.monotonic() >= deadline:
                                break
                            continue
                        if (returncode == 0 and temporary.is_file()
                                and temporary.stat().st_size):
                            temporary.replace(target)
                            logger.info("Full transcode finished: %s", attempt.name)
                            completed = True
                            break
                        detail = (stderr or b"").decode("utf-8", "replace")[-1000:]
                        last_detail = f"{attempt.name}: {detail or 'ffmpeg failed'}"
                        last_diagnostics = {'reason': 'ffmpeg_error', 'returncode': returncode,
                                            'stderr': detail, 'attempt': attempt.name}
                        last_error = None
                if not completed:
                    raise TranscodeUnavailable(last_detail or "ffmpeg failed",
                                               diagnostics=last_diagnostics) from last_error
            finally:
                temporary.unlink(missing_ok=True)

            for stale in self.cache_root.glob(f"{asset_id}-*.mp4"):
                if stale != target:
                    stale.unlink(missing_ok=True)
            return target, True

    def _passthrough(self, source: Path, session: str, registry, stat,
                     decode: frozenset[str]) -> tuple[bool, _MediaProfile | None, bool]:
        """原片能不能直放：返回（直放、起播前探到的画像、只换封装）。

        只有起播前就知道画像的 MP4 与 `REMUX_SUFFIXES` 容器才按能力换封装：MKV 这类要转码时才探测，
        文件名得先定。"""
        remux_container = source.suffix.lower() in REMUX_SUFFIXES
        if self.needs_transcode(source) and not remux_container:
            return False, None, False
        if self.resolver.ffprobe() is None:
            return not remux_container, None, False
        try:
            profile = self._profile_for(source, session, registry, stat)
        except OSError as exc:
            raise TranscodeUnavailable("source unavailable") from exc
        if profile is None:
            return False, None, False
        if remux_container:
            return False, profile, video_decodes(profile, decode)
        if self._decodes_in_browser(source, profile, decode):
            return True, profile, False
        return False, profile, profile.video_codec == "hevc" and video_decodes(profile, decode)

    def _cache_target(self, asset_id: int, stat, max_height: int, *, copy: bool = False) -> Path:
        """整片缓存的位置。只换封装的产物带 `-copy`，和转成 H.264 的那份分开存，也不受画质上限影响；
        重编码的产物把画质上限写进文件名：改了档位就转一份新的，原画沿用加这项之前的名字，已有缓存照常命中。"""
        if copy:
            flavor = "-copy"
        else:
            flavor = f"-{max_height}p" if max_height in QUALITY_BITRATES else ""
        return self.cache_root / f"{asset_id}-{stat.st_size}-{stat.st_mtime_ns}{flavor}.mp4"

    @staticmethod
    def _browser_compatible(source: Path, profile: _MediaProfile,
                            decode: frozenset[str] = frozenset()) -> bool:
        if source.suffix.lower() in {".mp4", ".m4v"}:
            return (video_decodes(profile, decode)
                    and (profile.video_codec != "hevc" or profile.codec_tag != "hev1" or "hev1" in decode)
                    and profile.audio_codec in {"", "aac", "mp3"}
                    and not profile.decode_order_timestamps)
        if source.suffix.lower() == ".webm":
            return (profile.video_codec in {"vp8", "vp9", "av1"}
                    and profile.audio_codec in {"", "opus", "vorbis"})
        return (profile.video_codec == "theora"
                and profile.audio_codec in {"", "vorbis", "opus"})

    def _probe(
        self, source: Path, session: str, registry, deadline: float,
    ) -> _MediaProfile | None:
        choice = self.resolver.ffprobe()
        if choice is None:
            return None
        command = (
            str(choice.path), "-v", "error", "-show_entries",
            "stream=codec_type,codec_name,codec_tag_string,pix_fmt,has_b_frames:format=duration",
            "-of", "json", input_url(source),
        )
        try:
            returncode, stdout, _stderr = self._execute(
                command,
                session=session,
                registry=registry,
                deadline=min(deadline, time.monotonic() + PROBE_TIMEOUT_SECONDS),
                label="ffprobe",
                capture_stdout=True,
                writes=False,
            )
        except (TranscodeCancelled, TranscodeCapacityDenied):
            raise
        except (OSError, TranscodeUnavailable):
            return None
        if returncode:
            return None
        try:
            report = json.loads(stdout.decode("utf-8", "replace"))
            streams = report.get("streams", ())
        except (AttributeError, json.JSONDecodeError):
            return None
        video = next((item for item in streams if item.get("codec_type") == "video"), {})
        audio = next((item for item in streams if item.get("codec_type") == "audio"), {})
        codec = str(video.get("codec_name") or "").lower()
        if not codec:
            return None
        try:
            duration = float((report.get("format") or {}).get("duration") or 0.0)
        except (TypeError, ValueError):
            duration = 0.0
        return _MediaProfile(
            video_codec=codec,
            pixel_format=str(video.get("pix_fmt") or "").lower(),
            audio_codec=str(audio.get("codec_name") or "").lower(),
            duration=max(0.0, duration),
            decode_order_timestamps=self._decode_order_timestamps(source, video),
            codec_tag=str(video.get("codec_tag_string") or "").lower(),
        )

    @staticmethod
    def _decodes_in_browser(source: Path, profile: _MediaProfile,
                            decode: frozenset[str] = frozenset()) -> bool:
        """浏览器能不能解出画面。时间戳错乱不算解不出来。

        整片转码要占满一个编码位、写一份和原片同量级的缓存，只有编码本身不被支持才值得。
        缺 `ctts` 的片源画面解得出来，错的只是容器写的显示顺序，交给 HLS 转码分片按需修
        就够。卡片悬停预览直接打不带会话的 `/stream`，那条路只交现成缓存，见 `browser_path`。
        """
        return TranscodeService._browser_compatible(
            source, replace(profile, decode_order_timestamps=False), decode,
        )

    @staticmethod
    def _decode_order_timestamps(source: Path, video: dict) -> bool:
        """有 B 帧却没有 `ctts` 的 MP4，容器声明的显示时刻就是解码顺序。

        浏览器信容器的时间戳，凡是比已显示帧更早的一律丢掉，于是整片掉两成帧、看着
        持续卡顿；FFmpeg 和本地播放器按解码器输出顺序排，同一个文件反而正常。这类片子
        原样送给浏览器修不好，播放要走转码分片，让编码器重新写一份对的时间轴。

        判据放在探测里做一次，结论跟 profile 一起缓存：`moov` 动辄几 MB，每个分片请求
        都读一遍等于把挂载网盘反复拉一遍。
        """
        if source.suffix.lower() not in {".mp4", ".m4v"}:
            return False
        try:
            reorder_depth = int(video.get("has_b_frames") or 0)
        except (TypeError, ValueError):
            return False
        if reorder_depth <= 0:
            return False
        return composition_offsets_present(source) is False

    def _attempts(
        self,
        ffmpeg: Path,
        source: Path,
        temporary: Path,
        profile: _MediaProfile | None,
        max_height: int = 0,
        decode: frozenset[str] = frozenset(),
    ):
        """依次尝试的命令。浏览器解得了视频轨时先只换封装（`video-copy`），HEVC 一律写成
        `hvc1` 标签，Safari 不认 `hev1`。画质上限（`max_height`，0 为原画）只管重编码：
        `video-copy` 不缩放，和能直接播放的片子一样保持原画。"""
        prefix = (
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        )
        mapping = ("-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn")
        finish = ("-movflags", "+faststart", str(temporary))

        if profile is not None and video_decodes(profile, decode):
            audio = (
                ("-c:a", "copy")
                if profile.audio_codec in {"", "aac"}
                else ("-c:a", "aac", "-b:a", "160k")
            )
            tag = ("-tag:v", "hvc1") if profile.video_codec == "hevc" else ()
            yield _TranscodeAttempt(
                "video-copy",
                prefix + ("-i", input_url(source)) + mapping + ("-c:v", "copy") + tag + audio + finish,
            )

        fast_audio = (
            ("-c:a", "copy")
            if profile is not None and profile.audio_codec in {"", "aac"}
            else ("-c:a", "aac", "-b:a", "160k")
        )
        codec = profile.video_codec if profile else ""
        for encoder in self.hardware.encoders(ffmpeg):
            for attempt in encoder.attempts(codec, max_height):
                yield _TranscodeAttempt(
                    attempt.name, prefix + attempt.before_input + ("-i", input_url(source))
                    + mapping + attempt.output + fast_audio + finish,
                )

        software = (software_video_output(max_height, threads=str(SOFTWARE_TRANSCODE_THREADS))
                    + ("-c:a", "aac", "-b:a", "160k"))
        hw_decode = self.hardware.decode_options(ffmpeg, codec)
        if hw_decode:
            yield _TranscodeAttempt(
                "d3d11va-libx264",
                prefix + hw_decode + ("-i", input_url(source)) + mapping + software + finish,
            )
        yield _TranscodeAttempt(
            "libx264", prefix + ("-i", input_url(source)) + mapping + software + finish,
        )

    def _execute(
        self,
        command: tuple[str, ...],
        *,
        session: str,
        registry,
        deadline: float,
        label: str,
        capture_stdout: bool = False,
        writes: bool = True,
    ) -> tuple[int, bytes, bytes]:
        """跑一条 FFmpeg 命令；`writes=False`（ffprobe 等只读探测）不过容量检查，磁盘满也能判断能否直放。"""
        from .jobs import DiskSpaceDenied
        guard = self.capacity_guard if writes else None
        try:
            if guard is not None:
                guard.check(force=True)
        except DiskSpaceDenied as error:
            raise TranscodeCapacityDenied(str(error)) from error
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE if capture_stdout else subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            creationflags=creationflags,
        )
        registered = False
        try:
            if registry is not None and session:
                registered = registry.register_process(session, process)
                if not registered:
                    process.kill()
                    process.communicate()
                    raise TranscodeCancelled(session)
            while True:
                try:
                    stdout, stderr = process.communicate(timeout=0.5)
                    break
                except subprocess.TimeoutExpired:
                    if guard is not None:
                        try:
                            guard.check()
                        except DiskSpaceDenied as error:
                            process.kill()
                            process.communicate()
                            raise TranscodeCapacityDenied(str(error)) from error
                    if registry is not None and session and registry.is_cancelled(session):
                        process.kill()
                        process.communicate()
                        raise TranscodeCancelled(session)
                    if time.monotonic() >= deadline:
                        process.kill()
                        _stdout, stderr = process.communicate()
                        raise TranscodeUnavailable(f"{label} timed out", diagnostics={
                            'reason': 'timeout', 'returncode': process.returncode,
                            'stderr': (stderr or b'').decode('utf-8', 'replace')[-1000:]})
            self._raise_if_cancelled(session, registry)
            return (
                process.returncode if process.returncode is not None else -1,
                stdout or b"",
                stderr or b"",
            )
        finally:
            if registered:
                registry.unregister_process(session, process)

    @staticmethod
    def _raise_if_cancelled(session: str, registry) -> None:
        if registry is not None and session and registry.is_cancelled(session):
            raise TranscodeCancelled(session)

    @contextmanager
    def _lock_for(self, asset_id: int):
        """同一 asset 的转码互斥；引用归零的条目随手清掉，长跑不再只增不减。

        清理之所以安全：任何等锁线程都先在 guard 里加过引用，持有者退出临界区、
        释放锁之后再减引用。减到零的那一刻不可能还有持有者或等待者，此时删除
        才不会让后来的线程拿到第二把锁绕过互斥。
        """
        with self._locks_guard:
            entry = self._locks.get(asset_id)
            if entry is None:
                entry = [threading.Lock(), 0]
                self._locks[asset_id] = entry
            entry[1] += 1
        try:
            with entry[0]:
                yield
        finally:
            with self._locks_guard:
                entry[1] -= 1
                if entry[1] <= 0:
                    self._locks.pop(asset_id, None)
