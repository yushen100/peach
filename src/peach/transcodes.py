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
from .hardware_transcode import HardwareTranscoder
from .mp4index import composition_offsets_present


BROWSER_NATIVE_SUFFIXES = frozenset({".mp4", ".m4v", ".webm", ".ogv", ".ogg"})
DIRECT_MP4_PIXEL_FORMATS = frozenset({"yuv420p", "yuvj420p"})
TRANSCODE_TIMEOUT_SECONDS = 3600
PROBE_TIMEOUT_SECONDS = 20
#: 探测失败记多久。键里有大小和修改时间，文件换了自然重探；冷却只挡同一份文件反复白等。
PROBE_FAILURE_SECONDS = 300
PROFILE_CACHE_LIMIT = 512
_UNKNOWN = object()
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
    """片源的 stat：调用方刚取过（`known`）就用它，网盘上每次 stat 都是一趟网络往返；没取过再问。"""
    return source.stat() if known is None else known


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

    def requires_conversion(self, source: Path, *, session: str = "", registry=None) -> bool:
        """按容器和内部编码选择浏览器兼容路径，不生成整片缓存。"""
        if self.needs_transcode(source):
            return True
        if self.resolver.ffprobe() is None:
            return False
        profile = self._profile_for(source, session, registry)
        return profile is None or not self._browser_compatible(source, profile)

    def decode_order_timestamps(self, source: Path, *, session: str = "", registry=None, stat=None) -> bool:
        """是不是只有时间戳错乱的那一类：有 B 帧却没有 ctts，码流本身浏览器解得出来。

        这类片源不必重编码，重建一份头就够了；其余不兼容的原因（编码、像素格式、容器）
        换不掉，只能转码。`stat` 是调用方刚取过的片源 stat，给了就不再问网盘。
        """
        if self.needs_transcode(source) or self.resolver.ffprobe() is None:
            return False
        profile = self._profile_for(source, session, registry, stat)
        return bool(profile and profile.decode_order_timestamps
                    and self._decodes_in_browser(source, profile))

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
        convert: bool = True, stat=None,
    ) -> tuple[Path, bool]:
        """浏览器能直接放的路径，以及它是不是转码产物。

        `convert=False` 时只交现成的整片缓存，缺缓存就抛 `TranscodeNeedsSession`。
        没有会话的请求取消不了，浏览器断开后整片 FFmpeg 还会跑到结束。
        `stat` 是调用方刚取过的片源 stat，给了就不再问网盘。
        """
        profile = None
        if not self.needs_transcode(source):
            if self.resolver.ffprobe() is None:
                return source, False
            try:
                profile = self._profile_for(source, session, registry, stat)
            except OSError as exc:
                raise TranscodeUnavailable("source unavailable") from exc
            if profile is not None and self._decodes_in_browser(source, profile):
                return source, False

        choice = self.resolver.ffmpeg()
        if choice is None:
            raise TranscodeUnavailable("ffmpeg unavailable")

        try:
            stat = _source_stat(source, stat)
        except OSError as exc:
            raise TranscodeUnavailable("source unavailable") from exc

        target = self.cache_root / f"{asset_id}-{stat.st_size}-{stat.st_mtime_ns}.mp4"
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
                        profile = self._probe(source, session, registry, deadline)
                    for attempt in self._attempts(
                        choice.path, source, temporary, profile,
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

    @staticmethod
    def _browser_compatible(source: Path, profile: _MediaProfile) -> bool:
        if source.suffix.lower() in {".mp4", ".m4v"}:
            return (profile.video_codec == "h264"
                    and profile.pixel_format in DIRECT_MP4_PIXEL_FORMATS
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
            "stream=codec_type,codec_name,pix_fmt,has_b_frames:format=duration",
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
        )

    @staticmethod
    def _decodes_in_browser(source: Path, profile: _MediaProfile) -> bool:
        """浏览器能不能解出画面。时间戳错乱不算解不出来。

        整片转码要占满一个编码位、写一份和原片同量级的缓存，只有编码本身不被支持才值得。
        缺 `ctts` 的片源画面解得出来，错的只是容器写的显示顺序，交给 HLS 转码分片按需修
        就够。卡片悬停预览直接打不带会话的 `/stream`，那条路只交现成缓存，见 `browser_path`。
        """
        return TranscodeService._browser_compatible(
            source, replace(profile, decode_order_timestamps=False),
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
    ):
        prefix = (
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        )
        mapping = ("-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn")
        finish = ("-movflags", "+faststart", str(temporary))

        if (profile is not None and profile.video_codec == "h264"
                and profile.pixel_format in DIRECT_MP4_PIXEL_FORMATS):
            audio = (
                ("-c:a", "copy")
                if profile.audio_codec in {"", "aac"}
                else ("-c:a", "aac", "-b:a", "160k")
            )
            yield _TranscodeAttempt(
                "video-copy",
                prefix + ("-i", input_url(source)) + mapping + ("-c:v", "copy") + audio + finish,
            )

        fast_audio = (
            ("-c:a", "copy")
            if profile is not None and profile.audio_codec in {"", "aac"}
            else ("-c:a", "aac", "-b:a", "160k")
        )
        codec = profile.video_codec if profile else ""
        for encoder in self.hardware.encoders(ffmpeg):
            for attempt in encoder.attempts(codec):
                yield _TranscodeAttempt(
                    attempt.name, prefix + attempt.before_input + ("-i", input_url(source))
                    + mapping + attempt.output + fast_audio + finish,
                )

        software = (
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
        )
        decode = self.hardware.decode_options(ffmpeg, codec)
        if decode:
            yield _TranscodeAttempt(
                "d3d11va-libx264",
                prefix + decode + ("-i", input_url(source)) + mapping + software + finish,
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
