"""用合成画面探测 FFmpeg 硬件编码，共享整片与分片的尝试链。"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from .task_control import run as run_task_process
from .user_messages import UserValueError

logger = logging.getLogger(__name__)
CUDA_DECODE_CODECS = frozenset({"h264", "hevc", "vp9", "av1"})
VIDEOTOOLBOX_DECODE_CODECS = frozenset({"h264", "hevc", "av1", "prores"})
#: D3D11VA 与 CUDA 同一份名单：名单外的编码（如 vc1）硬解出错时 FFmpeg 不报错，绿帧直接进缓存。
D3D11_DECODE_CODECS = CUDA_DECODE_CODECS
#: Linux 抽帧的 VAAPI 解码沿用同一份名单，理由同上。
VAAPI_DECODE_CODECS = CUDA_DECODE_CODECS
#: AMF 只认 AMD 显卡上的 D3D11 设备，混合显卡机器上默认序号常是别家，按序号逐个试。
D3D11_ADAPTER_PROBES = 4
BACKENDS = ("auto", "software", "nvenc", "amf", "qsv", "vaapi", "videotoolbox")
PROBE_TIMEOUT_SECONDS = 10
_SYNTHETIC_FRAME = ("-f", "lavfi", "-i", "color=size=640x360:rate=1", "-frames:v", "1")
_WINDOWS_ENCODER_OUTPUT = {
    "amf": ("-c:v", "h264_amf", "-quality", "speed", "-rc", "cqp", "-qp_i", "21", "-qp_p", "21",
            "-pix_fmt", "nv12"),
    "qsv": ("-c:v", "h264_qsv", "-preset", "veryfast", "-global_quality", "23", "-pix_fmt", "nv12"),
}
#: 设置页「画质上限」每一档的目标码率与峰值；原画（0）不缩放、不限码率，命令和没有这项设置时一样。
QUALITY_BITRATES = {1080: ("6M", "8M"), 720: ("3M", "4M"), 480: ("1500k", "2M")}


def scale_size(max_height: int) -> str:
    """缩放滤镜的宽高参数：短边超过上限才缩到上限，长边按比例取偶数；短边本来就不超的原样不动。

    按短边算，竖屏片子的「720p」也是宽 720。逗号在单引号里，滤镜图不会把它当成滤镜分隔。
    """
    return (f"w='if(gt(iw,ih),-2,min(iw,{max_height}))'"
            f":h='if(gt(iw,ih),min(ih,{max_height}),-2)'")


def rate_limit(max_height: int) -> tuple[str, ...]:
    """在质量优先的码控上再压一个峰值码率，libx264 的 CRF 与 NVENC 的 CQ 都认。"""
    if max_height not in QUALITY_BITRATES:
        return ()
    _target, peak = QUALITY_BITRATES[max_height]
    return ("-maxrate", peak, "-bufsize", f"{int(peak[:-1]) * 2}{peak[-1]}")


def software_video_output(max_height: int = 0, *, threads: str = "") -> tuple[str, ...]:
    """libx264 的视频参数；整片与分片共用，只差分片多一个线程上限。"""
    scale = ("-vf", f"scale={scale_size(max_height)}") if max_height in QUALITY_BITRATES else ()
    return (*scale, "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", *rate_limit(max_height),
            "-pix_fmt", "yuv420p", *(("-threads", threads) if threads else ()))


def _capped_windows_output(backend: str, max_height: int) -> tuple[str, ...]:
    """AMF 与 QSV 的恒定质量模式不认峰值码率，有上限时改成带峰值的 VBR，前面接软件缩放。"""
    target, peak = QUALITY_BITRATES[max_height]
    rate = ("-rc", "vbr_peak") if backend == "amf" else ()
    encoder = ("-c:v", "h264_amf", "-quality", "speed") if backend == "amf" else (
        "-c:v", "h264_qsv", "-preset", "veryfast")
    return ("-vf", f"scale={scale_size(max_height)}", *encoder, *rate, "-b:v", target, "-maxrate", peak,
            "-pix_fmt", "nv12")


def videotoolbox_decode_options(codec: str) -> tuple[str, ...]:
    decoder = ("-c:v", "av1") if codec == "av1" else ()
    return ("-hwaccel", "videotoolbox", *decoder)


def d3d11va_decode_options(codec: str, device: str = "") -> tuple[str, ...]:
    """Windows 显卡解码。不指定 `-hwaccel_output_format`，解出的帧回到内存交给任意编码器。"""
    if codec not in D3D11_DECODE_CODECS:
        return ()
    return ("-hwaccel", "d3d11va", *(("-hwaccel_device", device) if device else ()))


def vaapi_devices(configured: str = "") -> list[str]:
    """`PEACH_VAAPI_DEVICE` 指定了就只用它，否则按序号列出本机的 DRM 渲染节点。"""
    return [configured] if configured else sorted(p.as_posix() for p in Path("/dev/dri").glob("renderD*"))


def vaapi_decode_options(codec: str, device: str) -> tuple[str, ...]:
    """Linux 显卡解码。同 D3D11VA，不指定输出格式，解出的帧回到内存交给缩放与 JPEG 编码。"""
    if codec not in VAAPI_DECODE_CODECS:
        return ()
    return ("-hwaccel", "vaapi", "-hwaccel_device", device)


def _run_probe(ffmpeg: Path, label: str, arguments: tuple[str, ...]) -> bool:
    """跑一条只吃合成画面、输出丢弃的探测命令；失败记一条警告。"""
    command = (str(ffmpeg), "-hide_banner", "-loglevel", "error", "-nostdin", *arguments,
               "-f", "null", "-")
    try:
        result = run_task_process(
            command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE, timeout=PROBE_TIMEOUT_SECONDS,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("Transcode hardware probe failed %s: %s", label, exc)
        return False
    if result.returncode:
        logger.warning("Transcode hardware probe failed %s: %s", label,
                       result.stderr.decode("utf-8", "replace")[-1000:])
    return result.returncode == 0


@lru_cache(maxsize=8)
def _d3d11va_ready(ffmpeg: str) -> bool:
    """这份 FFmpeg 在这台机器上建得出 D3D11 设备。没有显卡的虚拟机或远程桌面会失败。"""
    return _run_probe(Path(ffmpeg), "d3d11va", ("-init_hw_device", "d3d11va", *_SYNTHETIC_FRAME))


@lru_cache(maxsize=8)
def _vaapi_device(ffmpeg: str, configured: str) -> str:
    """第一个这份 FFmpeg 建得出 VAAPI 设备的渲染节点；容器没映射 `/dev/dri` 时为空。"""
    for device in vaapi_devices(configured):
        if _run_probe(Path(ffmpeg), f"vaapi {device}", ("-init_hw_device", f"vaapi=va:{device}", *_SYNTHETIC_FRAME)):
            return device
    return ""


@lru_cache(maxsize=128)
def _frame_codec(ffprobe: str, source: str, size: int, modified: int) -> str:
    from .media_probe import probe_file
    try:
        return probe_file(ffprobe, source, timeout=5)[3] or ""
    except (OSError, ValueError, subprocess.SubprocessError):
        return ""


def frame_decode_options(ffmpeg: str, source: str) -> tuple[str, ...]:
    """本机抽帧按文件世代复用编码探测，解码初始化失败由调用方回退。

    Windows 与 Linux 只给名单内的编码开 D3D11VA／VAAPI，编码探测不到就软件解码。
    """
    linux = sys.platform.startswith("linux")
    if not (linux or sys.platform in ("darwin", "win32")) or not Path(ffmpeg).is_file():
        return ()
    from .media_processing_policy import acceleration
    if acceleration(purpose="preview") == "software" or os.environ.get("PEACH_TRANSCODE_BACKEND") == "software":
        return ()
    if sys.platform == "win32" and not _d3d11va_ready(ffmpeg):
        return ()
    device = _vaapi_device(ffmpeg, os.environ.get("PEACH_VAAPI_DEVICE", "").strip()) if linux else ""
    if linux and not device:
        return ()
    codec = ""
    ffprobe = Path(ffmpeg).with_name("ffprobe" + Path(ffmpeg).suffix)
    try:
        from .media_io import file_stat
        stat = file_stat(source, timeout=5)
        if ffprobe.is_file():
            codec = _frame_codec(str(ffprobe), source, stat.st_size, stat.st_mtime_ns)
    except OSError:
        pass
    if sys.platform == "win32":
        return d3d11va_decode_options(codec)
    if linux:
        return vaapi_decode_options(codec, device)
    return videotoolbox_decode_options(codec)


@dataclass(frozen=True)
class HardwareAttempt:
    name: str
    before_input: tuple[str, ...]
    output: tuple[str, ...]


@dataclass(frozen=True)
class HardwareEncoder:
    backend: str
    device: str = ""

    def attempts(self, codec: str, max_height: int = 0) -> tuple[HardwareAttempt, ...]:
        """依次尝试的命令片段；最后一项总是软件解码，探测靠它喂合成画面。

        `d3d11va` 只解码不编码，这里只给探测用的建设备命令，解码参数见
        `HardwareTranscoder.decode_options`。

        `max_height` 是画质上限（`QUALITY_BITRATES` 的一档，0 为原画）：帧在显存里的路径
        （CUDA、VAAPI）用各自的显卡缩放滤镜，其余解出的帧在内存里，接软件 `scale`；码率按档压峰值。
        """
        capped = max_height in QUALITY_BITRATES
        scale = f"scale={scale_size(max_height)}" if capped else ""
        software_scale = ("-vf", scale) if capped else ()
        if self.backend == "d3d11va":
            return (HardwareAttempt("d3d11va", ("-init_hw_device", "d3d11va"), ()),)
        if self.backend in _WINDOWS_ENCODER_OUTPUT:
            output = (_capped_windows_output(self.backend, max_height) if capped
                      else _WINDOWS_ENCODER_OUTPUT[self.backend])
            software_decode = HardwareAttempt(self.backend, (), output)
            decode = d3d11va_decode_options(codec, self.device) if self.device else ()
            if not decode:
                return (software_decode,)
            return (HardwareAttempt(f"d3d11va-{self.backend}", decode, output), software_decode)
        if self.backend == "videotoolbox":
            bitrate = QUALITY_BITRATES[max_height][0] if capped else "6M"
            output = software_scale + ("-c:v", "h264_videotoolbox", "-allow_sw", "0", "-b:v", bitrate,
                                       "-pix_fmt", "yuv420p")
            software_decode = HardwareAttempt("videotoolbox-encode", (), output)
            if codec not in VIDEOTOOLBOX_DECODE_CODECS:
                return (software_decode,)
            return (HardwareAttempt("videotoolbox", videotoolbox_decode_options(codec), output), software_decode)
        if self.backend == "nvenc":
            output = ("-c:v", "h264_nvenc", "-preset", "p1", "-tune", "hq",
                      "-rc", "vbr", "-cq", "21", "-b:v", "0", *rate_limit(max_height))
            software_decode = HardwareAttempt("nvenc", (), software_scale + output + ("-pix_fmt", "yuv420p"))
            if codec not in CUDA_DECODE_CODECS:
                return (software_decode,)
            cuda_scale = f"scale_cuda={scale_size(max_height)}:format=nv12" if capped else "scale_cuda=format=nv12"
            return (HardwareAttempt(
                "cuda-nvenc", ("-hwaccel", "cuda", "-hwaccel_output_format", "cuda"),
                ("-vf", cuda_scale) + output,
            ), software_decode)
        device = ("-vaapi_device", self.device)
        if capped:
            target, peak = QUALITY_BITRATES[max_height]
            output = ("-c:v", "h264_vaapi", "-rc_mode", "VBR", "-b:v", target, "-maxrate", peak)
        else:
            output = ("-c:v", "h264_vaapi", "-qp", "21")
        vaapi_scale = f"scale_vaapi={scale_size(max_height)}:format=nv12" if capped else "scale_vaapi=format=nv12"
        return (
            HardwareAttempt(
                "vaapi", device + ("-hwaccel", "vaapi", "-hwaccel_device", self.device,
                                    "-hwaccel_output_format", "vaapi"),
                ("-vf", vaapi_scale) + output,
            ),
            HardwareAttempt("vaapi-encode", device,
                            ("-vf", f"{scale + ',' if capped else ''}format=nv12,hwupload") + output),
        )


class HardwareTranscoder:
    """首次重编码时探测，结果按 FFmpeg 路径缓存；不读取媒体或写入缓存文件。

    设置页「播放编解码方式」选软件时什么都不探测；选自动时 Windows 依次试 NVENC、AMF、
    QSV 编码，三者都不可用也用 D3D11VA 解码再交给 libx264，见 `decode_options`。
    """

    def __init__(self, *, enabled: bool = True, state_root: Path | None = None):
        self.enabled = enabled
        self.state_root = state_root
        self.backend = os.environ.get("PEACH_TRANSCODE_BACKEND", "auto").strip().lower()
        if self.backend not in BACKENDS:
            raise UserValueError("errors.hardwareTranscode.backendInvalid", {"backends": list(BACKENDS)})
        self.device = os.environ.get("PEACH_VAAPI_DEVICE", "").strip()
        self._encoders: dict[Path, tuple[HardwareEncoder, ...]] = {}
        self._lock = threading.Lock()

    def _candidates(self) -> tuple[HardwareEncoder, ...]:
        candidates = []
        windows = self.backend == "auto" and sys.platform == "win32"
        if self.backend == "videotoolbox" or (self.backend == "auto" and sys.platform == "darwin"):
            candidates.append(HardwareEncoder("videotoolbox"))
        if self.backend == "nvenc" or (self.backend == "auto" and (
            sys.platform == "win32" or Path("/dev/nvidia0").exists()
            or Path("/proc/driver/nvidia/version").exists()
        )):
            candidates.append(HardwareEncoder("nvenc"))
        candidates.extend(HardwareEncoder(backend) for backend in _WINDOWS_ENCODER_OUTPUT
                          if self.backend == backend or windows)
        if windows:
            candidates.append(HardwareEncoder("d3d11va"))
        if self.backend == "vaapi" or (self.backend == "auto" and sys.platform.startswith("linux")):
            candidates.extend(HardwareEncoder("vaapi", device) for device in vaapi_devices(self.device))
        return tuple(candidates)

    def active(self) -> bool:
        """设置页与环境变量都没把播放转码限定成软件。每次现读，改设置不用重启。"""
        from .media_processing_policy import acceleration
        if self.state_root is not None and acceleration(self.state_root) == "software":
            return False
        return self.enabled and self.backend != "software"

    def max_height(self) -> int:
        """设置页「画质上限」，0 为原画。整片与分片共用这一个实例，每次现读，改设置不用重启。"""
        from .media_processing_policy import playback_max_height
        return playback_max_height(self.state_root) if self.state_root is not None else 0

    def diagnostic_snapshot(self) -> dict:
        """读取当前硬件策略与已有探测结果，不启动新的硬件探测。"""
        with self._lock:
            results = [sorted({encoder.backend for encoder in encoders}) for encoders in self._encoders.values()]
        return {'backend': self.backend, 'enabled': self.active(),
                'probe_status': 'cached' if results else 'not-probed', 'available_backends': results}

    def _available(self, ffmpeg: Path) -> tuple[HardwareEncoder, ...]:
        if not self.active():
            return ()
        with self._lock:
            if ffmpeg not in self._encoders:
                available = []
                for encoder in self._candidates():
                    if self._probe(ffmpeg, encoder):
                        if encoder.backend == "amf":
                            encoder = self._amf_adapter(ffmpeg, encoder)
                        available.append(encoder)
                        # 一个可用 VAAPI 节点足以服务这条链，避免重复尝试同类设备。
                        if encoder.backend == "vaapi":
                            break
                self._encoders[ffmpeg] = tuple(available)
                logger.info("Transcode hardware backend: %s", ", ".join(
                    item.backend + (f" ({item.device})" if item.device else "")
                    for item in available) or "software")
            return self._encoders[ffmpeg]

    def encoders(self, ffmpeg: Path) -> tuple[HardwareEncoder, ...]:
        return tuple(item for item in self._available(ffmpeg) if item.backend != "d3d11va")

    def decode_options(self, ffmpeg: Path, codec: str) -> tuple[str, ...]:
        """libx264 前的显卡解码参数；只有 Windows 的 D3D11VA 这一种，与显卡厂商无关。

        硬件编码全不可用时，HEVC 软件解码占去 libx264 转码约三分之一的 CPU。
        """
        if not any(item.backend == "d3d11va" for item in self._available(ffmpeg)):
            return ()
        return d3d11va_decode_options(codec)

    @staticmethod
    def _amf_adapter(ffmpeg: Path, encoder: HardwareEncoder) -> HardwareEncoder:
        """找出 AMF 能接上的 D3D11 显卡序号；都不行就只用软件解码加 AMF 编码。"""
        output = _WINDOWS_ENCODER_OUTPUT["amf"][:-2]
        for index in range(D3D11_ADAPTER_PROBES):
            if _run_probe(ffmpeg, f"amf d3d11va:{index}", (
                    "-init_hw_device", f"d3d11va=peach:{index}", "-filter_hw_device", "peach",
                    *_SYNTHETIC_FRAME, "-vf", "format=nv12,hwupload", *output)):
                return HardwareEncoder("amf", str(index))
        return encoder

    @staticmethod
    def _probe(ffmpeg: Path, encoder: HardwareEncoder) -> bool:
        # 用软件生成一帧，再验证设备初始化、上传与 H.264 硬件编码。
        attempt = encoder.attempts("")[-1]
        return _run_probe(ffmpeg, f"{encoder.backend} {encoder.device}".strip(), (
            *attempt.before_input, *_SYNTHETIC_FRAME, *attempt.output))
