"""给缺 `ctts` 的 MP4 重建一份正确的头，原文件一个字节都不动。

有 B 帧却没有 `ctts` 的片子，容器声明的显示时刻就是解码顺序，浏览器会把倒着走的帧
全丢掉（实测整片掉两成）。缺的只是 `moov` 里那张表，`mdat` 里的码流本身是好的，所以
修法是重新算一份 `moov`、单独存成边车，播放时用「修好的头 + 原文件的 mdat」拼出一个
合规 MP4。不重编码，不动画质，也不必把几 GB 的片子重写一遍——网盘上的文件改一个字节
就是整份重传。

显示顺序从解码器要：`ffprobe` 解一遍，输出的帧本来就是按显示顺序来的，每帧带着来源样本
的 `pts`，于是「解码序 → 显示序」的置换是直接读出来的，不必自己解析 POC。
"""
from __future__ import annotations

import logging
import os
import struct
import subprocess
import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from .smb_media import input_url

from .mp4index import _iter_boxes
from .task_control import run as run_task_process
from .task_stages import stage as stage_fields
from .user_messages import UserFacingError, failure_fields

LOGGER = logging.getLogger(__name__)

#: 会往下拆的容器盒子，其余一律当成不透明的叶子原样搬。
CONTAINERS = frozenset({b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts"})
#: 头部盒子加起来的上限；超过这个数就不是我们认识的片源，宁可不修。
HEADER_LIMIT = 64 << 20
#: 连续没有任何解码输出的等待时间；整片解码不按片长限制总耗时。
PROBE_IDLE_SECONDS = 900
SIDECAR_MAGIC = b"PEACHMP4\x02"
LEGACY_SIDECAR_MAGIC = b"PEACHMP4\x01"
SIDECAR_SUFFIX = ".mp4hdr"


class RepairUnavailable(UserFacingError, RuntimeError):
    """这个片源修不了。调用方照旧走转码分片，不要把异常当故障报。

    原因写成 `errors.mp4repair.*` 的 code，后台补头失败时随任务行带给任务中心。
    """


@dataclass(frozen=True)
class RepairedHeader:
    """修好的头，加上原文件里那段照搬的 `mdat` 内容。

    拼出来的文件是 `prefix + source[payload_start:payload_end] + suffix`。
    """

    prefix: bytes
    payload_start: int
    payload_end: int
    suffix: bytes = b""

    @property
    def size(self) -> int:
        return len(self.prefix) + (self.payload_end - self.payload_start) + len(self.suffix)


@dataclass
class _Box:
    kind: bytes
    payload: bytes | None
    children: list["_Box"]

    def serialize(self) -> bytes:
        body = self.payload if self.payload is not None else b"".join(
            child.serialize() for child in self.children)
        return struct.pack(">I", len(body) + 8) + self.kind + body

    def find(self, kind: bytes) -> "_Box | None":
        return next((child for child in self.children if child.kind == kind), None)


def _parse(payload: bytes, start: int, end: int) -> list[_Box]:
    boxes = []
    for kind, body, stop in _iter_boxes(payload, start, end):
        if kind in CONTAINERS:
            boxes.append(_Box(kind, None, _parse(payload, body, stop)))
        else:
            boxes.append(_Box(kind, payload[body:stop], []))
    return boxes


def _top_level(handle) -> list[tuple[bytes, int, int, int]]:
    """顶层盒子：(类型, 盒子起点, 内容起点, 盒子终点)。"""
    size = handle.seek(0, 2)
    boxes = []
    offset = 0
    while offset < size:
        handle.seek(offset)
        header = handle.read(16)
        if len(header) < 8:
            break
        box_size = int.from_bytes(header[0:4], "big")
        body = offset + 8
        if box_size == 1:
            if len(header) < 16:
                break
            box_size = int.from_bytes(header[8:16], "big")
            body = offset + 16
        elif box_size == 0:
            box_size = size - offset
        if box_size < 8 or offset + box_size > size:
            break
        boxes.append((header[4:8], offset, body, offset + box_size))
        offset += box_size
    return boxes


def _sample_table(trak: _Box) -> _Box | None:
    mdia = trak.find(b"mdia")
    minf = mdia.find(b"minf") if mdia else None
    return minf.find(b"stbl") if minf else None


def _is_video(trak: _Box) -> bool:
    mdia = trak.find(b"mdia")
    hdlr = mdia.find(b"hdlr") if mdia else None
    return bool(hdlr and hdlr.payload and hdlr.payload[8:12] == b"vide")


def _decode_times(stts: bytes) -> list[int]:
    """把游程编码的 `stts` 摊开成每个样本的 dts。"""
    count = struct.unpack_from(">I", stts, 4)[0]
    times: list[int] = []
    elapsed = 0
    cursor = 8
    for _ in range(count):
        if cursor + 8 > len(stts):
            raise RepairUnavailable("errors.mp4repair.sttsLengthMismatch")
        run, delta = struct.unpack_from(">II", stts, cursor)
        cursor += 8
        for _ in range(run):
            times.append(elapsed)
            elapsed += delta
    return times


def _display_order(ffprobe: Path, source: Path, decode_times: list[int], *, progress=None) -> list[int]:
    """每个样本（解码序）的显示名次。

    解码器吐出来的帧就是显示顺序，每帧的 `pts` 原样来自它那个样本；这里 pts 就等于 dts，
    所以按 dts 反查解码序即可。用的不是 `pkt_dts`——那记的是出帧时最后喂进去的那个包，
    跟这一帧不是一回事。`-ignore_editlist` 让时间戳保持样本表里的原值，也让编辑列表
    盖住的预卷样本照样出帧，否则帧数会少一截。

    对不上就抛 `RepairUnavailable`：宁可不修，也不能写一张错的表。

    解码线程沿用任务档位，高强度和独立调用交给 FFmpeg 自动分配。
    """
    from .task_resources import media_input
    from .processing_control import ffmpeg_options
    media_input(source)
    command = (
        str(ffprobe), "-v", "error", *(ffmpeg_options() or ['-threads', '0']),
        "-ignore_editlist", "1", "-select_streams", "v:0",
        "-show_entries", "frame=pts", "-of", "csv=p=0", input_url(source),
    )
    frames = 0

    def report(chunk):
        nonlocal frames
        frames += chunk.count(b'\n')
        if progress is not None:
            progress(min(frames, len(decode_times)), len(decode_times))

    try:
        completed = run_task_process(command, capture_output=True, idle_timeout=PROBE_IDLE_SECONDS,
                                   on_stdout=report,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    except subprocess.TimeoutExpired as exc:
        raise RepairUnavailable("errors.mp4repair.probeIdle", {"seconds": PROBE_IDLE_SECONDS}) from exc
    except OSError as exc:
        raise RepairUnavailable("errors.mp4repair.probeIncomplete", {"error": str(exc)}) from exc
    if completed.returncode:
        raise RepairUnavailable("errors.mp4repair.probeExitCode", {"code": completed.returncode})

    index_of = {value: index for index, value in enumerate(decode_times)}
    if len(index_of) != len(decode_times):
        raise RepairUnavailable("errors.mp4repair.duplicateDts")
    rank = [-1] * len(decode_times)
    seen = 0
    for line in completed.stdout.decode("utf-8", "replace").splitlines():
        text = line.strip().rstrip(",")
        if not text or text == "N/A":
            raise RepairUnavailable("errors.mp4repair.frameWithoutTimestamp")
        index = index_of.get(int(text))
        if index is None:
            raise RepairUnavailable("errors.mp4repair.timestampNotInStts")
        if rank[index] >= 0:
            raise RepairUnavailable("errors.mp4repair.frameOutputTwice")
        rank[index] = seen
        seen += 1
    if seen != len(decode_times):
        raise RepairUnavailable("errors.mp4repair.frameCountMismatch", {"decoded": seen, "samples": len(decode_times)})
    return rank


def _composition_offsets(decode_times: list[int], rank: list[int]) -> tuple[list[int], int]:
    """返回每个样本的 ctts 偏移和整体平移量。

    显示时间轴就是这些 dts 排好序的样子：一帧显示一次，时长不变，变的只是顺序。
    偏移要非负（ctts version 0），所以整体平移，平移量由编辑列表补回去。
    """
    timeline = sorted(decode_times)
    offsets = [timeline[rank[index]] - decode_times[index] for index in range(len(decode_times))]
    shift = max(0, -min(offsets))
    return [value + shift for value in offsets], shift


def _ctts(offsets: list[int]) -> bytes:
    """游程编码的 `ctts`。偏移只取几个值，整片也就一两 KB。"""
    runs: list[tuple[int, int]] = []
    for offset in offsets:
        if runs and runs[-1][1] == offset:
            runs[-1] = (runs[-1][0] + 1, offset)
        else:
            runs.append((1, offset))
    body = struct.pack(">II", 0, len(runs))
    return body + b"".join(struct.pack(">II", run, offset) for run, offset in runs)


def _edit_times(elst: bytes | None, adjust: Callable[[int], int]) -> bytes | None:
    """保留编辑段长与播放速率，只映射媒体起点。"""
    if elst is not None and len(elst) >= 8:
        version = elst[0]
        width = 20 if version == 1 else 12
        layout = ">Qq" if version == 1 else ">Ii"
        count = struct.unpack_from(">I", elst, 4)[0]
        if count and len(elst) >= 8 + count * width:
            entries = []
            for index in range(count):
                base = 8 + index * width
                segment, media_time = struct.unpack_from(layout, elst, base)
                entries.append(struct.pack(layout, segment, adjust(media_time))
                               + elst[base + width - 4:base + width])
            return elst[:8] + b"".join(entries)
    return None


def _retimed_edit_list(elst: bytes | None, shift: int, segment_duration: int,
                       tolerance: int = 0) -> bytes:
    """让编辑列表跟上 ctts 的整体平移。

    平移把每一帧的显示时刻都推后 `shift`，起播点要跟着推同样多，否则音画差这么多。
    已有的 media_time 与 `shift` 差半帧以内时原样保留：原封装已经为 ctts 补过这一刀，
    表丢了而这行留着，加回去就复原了；写成两倍反而会真的切掉两帧。
    空编辑（media_time 为 -1）是延迟起播，跟显示顺序无关，原样放过。
    """
    payload = _edit_times(elst, lambda value: value + shift
                          if value >= 0 and abs(value - shift) > tolerance else value)
    return payload if payload is not None else struct.pack(">IIIiI", 0, 1, segment_duration, shift, 1 << 16)


def _half_frame(decode_times: list[int]) -> int:
    """最短帧长的一半，媒体刻度。"""
    gaps = [later - earlier for earlier, later in zip(decode_times, decode_times[1:]) if later > earlier]
    return min(gaps) // 2 if gaps else 0


def _timed_field(payload: bytes, short_offset: int, long_offset: int) -> int:
    """读 `*hd` 盒子里那种「v0 是 32 位、v1 是 64 位」的字段。"""
    if payload[0] == 1:
        return struct.unpack_from(">Q", payload, long_offset)[0]
    return struct.unpack_from(">I", payload, short_offset)[0]


def _track_duration(root: _Box, trak: _Box) -> int:
    """轨道时长，单位是影片时间刻度——编辑列表的段长用的就是这个刻度，不是媒体刻度。

    `tkhd` 里那个值可以是 0（有编辑列表时封装器常常不填），这时按媒体时长换算。
    """
    tkhd = trak.find(b"tkhd")
    if tkhd is not None and tkhd.payload:
        duration = _timed_field(tkhd.payload, 16, 24)
        if duration:
            return duration
    mvhd = root.find(b"mvhd")
    mdia = trak.find(b"mdia")
    mdhd = mdia.find(b"mdhd") if mdia else None
    if not (mvhd and mvhd.payload and mdhd and mdhd.payload):
        raise RepairUnavailable("errors.mp4repair.trackDurationUnknown")
    movie_scale = struct.unpack_from(">I", mvhd.payload, 20 if mvhd.payload[0] == 1 else 12)[0]
    media_scale = struct.unpack_from(">I", mdhd.payload, 20 if mdhd.payload[0] == 1 else 12)[0]
    if not media_scale:
        raise RepairUnavailable("errors.mp4repair.zeroTimescale")
    return _timed_field(mdhd.payload, 16, 24) * movie_scale // media_scale


def _shift_chunk_offsets(box: _Box, delta: int) -> None:
    """头变长了，`mdat` 里每个 chunk 的绝对位置就跟着挪。"""
    if delta == 0:
        return
    for child in box.children:
        if child.payload is None:
            _shift_chunk_offsets(child, delta)
            continue
        if child.kind == b"stco":
            count = struct.unpack_from(">I", child.payload, 4)[0]
            values = [struct.unpack_from(">I", child.payload, 8 + n * 4)[0] + delta for n in range(count)]
            if any(value > 0xFFFFFFFF for value in values):
                raise RepairUnavailable("errors.mp4repair.offsetNeedsCo64")
            child.payload = child.payload[:8] + b"".join(struct.pack(">I", value) for value in values)
        elif child.kind == b"co64":
            count = struct.unpack_from(">I", child.payload, 4)[0]
            values = [struct.unpack_from(">Q", child.payload, 8 + n * 8)[0] + delta for n in range(count)]
            child.payload = child.payload[:8] + b"".join(struct.pack(">Q", value) for value in values)


_Span = tuple[bytes, int, int, int]


@dataclass(frozen=True)
class _Layout:
    before: bytes
    mdat_header: bytes
    suffix: bytes
    mdat: _Span
    moov_box: bytes
    moov_body: int
    moov_before_start: int | None


def _layout(source: Path) -> _Layout:
    """读出 `mdat` 和 `moov`，返回拼回虚拟文件所需的几段。

    faststart 文件把 `moov` 放在媒体前面，尾部只允许没有盒子；下载器常见的布局则把
    `moov` 放在末尾。后一种只多读媒体之后的索引段，媒体仍按原字节流发送，不复制原片。
    """
    from .smb_media import SmbResource
    with (source.open() if isinstance(source, SmbResource) else open(source, 'rb')) as handle:
        boxes = _top_level(handle)
        kinds = {kind for kind, *_ in boxes}
        if not {b"moov", b"mdat"} <= kinds:
            raise RepairUnavailable("errors.mp4repair.missingMoovOrMdat")
        if any(sum(box[0] == kind for box in boxes) != 1 for kind in (b"moov", b"mdat")):
            raise RepairUnavailable("errors.mp4repair.needsSingleMoovAndMdat")
        mdat = next(box for box in boxes if box[0] == b"mdat")
        moov = next(box for box in boxes if box[0] == b"moov")
        if mdat[3] - mdat[2] <= 0 or moov[3] - moov[1] > HEADER_LIMIT:
            raise RepairUnavailable("errors.mp4repair.moovTooLargeOrMdatEmpty")
        if mdat[2] > HEADER_LIMIT:
            raise RepairUnavailable("errors.mp4repair.leadingIndexTooLarge")
        if moov[1] < mdat[1]:
            if any(box[1] > mdat[1] for box in boxes):
                raise RepairUnavailable("errors.mp4repair.boxesAfterMdat")
            handle.seek(moov[1])
            moov_box = handle.read(moov[3] - moov[1])
            handle.seek(0)
            before = handle.read(mdat[1])
            handle.seek(mdat[1])
            mdat_header = handle.read(mdat[2] - mdat[1])
            return _Layout(before, mdat_header, b"", mdat, moov_box, moov[2] - moov[1], moov[1])
        after_size = handle.seek(0, 2) - mdat[3]
        if after_size > HEADER_LIMIT - mdat[2]:
            raise RepairUnavailable("errors.mp4repair.trailingIndexTooLarge")
        handle.seek(0)
        before = handle.read(mdat[1])
        handle.seek(mdat[1])
        mdat_header = handle.read(mdat[2] - mdat[1])
        handle.seek(mdat[3])
        after = handle.read(after_size)
        start = moov[1] - mdat[3]
        stop = moov[3] - mdat[3]
        return _Layout(before, mdat_header, after[:start] + after[stop:], mdat,
                       after[start:stop], moov[2] - moov[1], None)


def read_layout(path) -> _Layout:
    """`_layout` 的子进程入口：路径按本机文件读。"""
    return _layout(Path(path))


def repaired_header(source: Path, ffprobe: Path, *, progress=None, read_layout=None) -> RepairedHeader:
    """算出修好的头。修不了就抛 `RepairUnavailable`。

    `read_layout` 代替本进程读片头（批量修复交给带期限的子进程读）。
    """
    layout = (read_layout or _layout)(source)
    mdat = layout.mdat
    tree = _parse(layout.moov_box, layout.moov_body, len(layout.moov_box))
    root = _Box(b"moov", None, tree)
    traks = [child for child in root.children if child.kind == b"trak"]
    video = next((trak for trak in traks if _is_video(trak)), None)
    stbl = _sample_table(video) if video else None
    if stbl is None:
        raise RepairUnavailable("errors.mp4repair.videoSampleTableMissing")
    if stbl.find(b"ctts") is not None:
        raise RepairUnavailable("errors.mp4repair.cttsPresent")
    stts = stbl.find(b"stts")
    if stts is None or stts.payload is None:
        raise RepairUnavailable("errors.mp4repair.videoSttsMissing")

    decode_times = _decode_times(stts.payload)
    offsets, shift = _composition_offsets(
        decode_times, _display_order(ffprobe, source, decode_times, progress=progress))
    if not shift and all(value == 0 for value in offsets):
        raise RepairUnavailable("errors.mp4repair.nothingToRepair")

    stbl.children.insert(stbl.children.index(stts) + 1, _Box(b"ctts", _ctts(offsets), []))
    edts = video.find(b"edts")
    elst = edts.find(b"elst") if edts else None
    if layout.moov_before_start is None and elst and elst.payload:
        def checked_start(value: int) -> int:
            if value > shift + _half_frame(decode_times):
                raise RepairUnavailable("errors.mp4repair.editStartAmbiguous")
            return value

        _edit_times(elst.payload, checked_start)
    payload = _retimed_edit_list(
        elst.payload if elst and elst.payload else None, shift, _track_duration(root, video),
        _half_frame(decode_times))
    if elst is not None:
        elst.payload = payload
    elif edts is not None:
        edts.children.append(_Box(b"elst", payload, []))
    else:
        video.children.insert(1, _Box(b"edts", None, [_Box(b"elst", payload, [])]))

    def assemble(rebuilt: bytes) -> bytes:
        if layout.moov_before_start is not None:
            stop = layout.moov_before_start + len(layout.moov_box)
            return (layout.before[:layout.moov_before_start] + rebuilt
                    + layout.before[stop:] + layout.mdat_header)
        return layout.before + rebuilt + layout.mdat_header

    rebuilt = root.serialize()
    delta = len(assemble(rebuilt)) - mdat[2]
    _shift_chunk_offsets(root, delta)
    rebuilt = root.serialize()
    prefix = assemble(rebuilt)
    if len(prefix) - mdat[2] != delta:
        raise RepairUnavailable("errors.mp4repair.rebuiltHeaderLengthMismatch")
    return RepairedHeader(prefix=prefix, payload_start=mdat[2], payload_end=mdat[3], suffix=layout.suffix)


def top_level_boxes(path) -> list[tuple[bytes, int, int, int]]:
    """本机文件的顶层盒子；`media_io.MountWorker` 在子进程里调用。"""
    with open(path, 'rb') as handle:
        return _top_level(handle)


def tail_moov(boxes) -> bool:
    """顶层只有一个 `moov` 与一个 `mdat`，且索引在媒体之后：旧布局判据会跳过的尾部索引。"""
    moovs = [box for box in boxes if box[0] == b'moov']
    mdats = [box for box in boxes if box[0] == b'mdat']
    return len(moovs) == len(mdats) == 1 and moovs[0][1] > mdats[0][1]


def write_sidecar(path: Path, header: RepairedHeader) -> None:
    """边车只存头和那段 mdat 的坐标；几十 KB，和原片放两处互不影响。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_bytes(
        SIDECAR_MAGIC
        + struct.pack(">QQQQ", len(header.prefix), len(header.suffix),
                      header.payload_start, header.payload_end)
        + header.prefix + header.suffix)
    temporary.replace(path)


def _time_runs(payload: bytes) -> list[tuple[int, int]]:
    """边车内的 version 0 时间表；保留游程，不展开整片帧时间。"""
    if len(payload) < 8 or payload[:4] != bytes(4):
        raise RepairUnavailable("errors.mp4repair.legacyTimetableVersion")
    count = struct.unpack_from(">I", payload, 4)[0]
    if len(payload) != 8 + count * 8:
        raise RepairUnavailable("errors.mp4repair.legacyTimetableLength")
    return [struct.unpack_from(">II", payload, 8 + index * 8) for index in range(count)]


def _legacy_timing(stts: bytes, ctts: bytes) -> tuple[int, int]:
    """从旧边车的游程表还原整体平移与最短半帧，不展开每帧时间。"""
    times = _time_runs(stts)
    offsets = _time_runs(ctts)
    samples = sum(run for run, _ in times)
    if not samples or sum(run for run, _ in offsets) != samples:
        raise RepairUnavailable("errors.mp4repair.legacySampleCount")
    shift, remainder = divmod(sum(run * value for run, value in offsets), samples)
    if remainder:
        raise RepairUnavailable("errors.mp4repair.legacyShiftIncomplete")
    # 最后一帧的 duration 不是两个相邻 DTS 的间距，与新头的半帧判据保持一致。
    remaining, gaps = samples - 1, []
    for run, delta in times:
        if remaining and run and delta:
            gaps.append(delta)
        remaining -= min(remaining, run)
    return shift, min(gaps) // 2 if gaps else 0


def _upgrade_legacy_header(header: RepairedHeader) -> RepairedHeader:
    """按旧写入规则撤回重复平移，不读原片或重新解码。

    显示时刻是解码时刻的置换，故旧 ctts 的偏移加权均值就是整体 shift。
    旧规则将不等于 shift 的起点再加 shift；接近两倍 shift 的存量起点因此减回一份。
    新版边车单独标识，不能对已经按半帧判据生成的头再次执行这个转换。
    """
    span = next(((body, stop) for kind, body, stop in _iter_boxes(
        header.prefix, 0, len(header.prefix)) if kind == b"moov"), None)
    if span is None:
        raise RepairUnavailable("errors.mp4repair.legacyNoMoov")
    root = _Box(b"moov", None, _parse(header.prefix, *span))
    video = next((child for child in root.children if child.kind == b"trak" and _is_video(child)), None)
    stbl = _sample_table(video) if video else None
    stts = stbl.find(b"stts") if stbl else None
    ctts = stbl.find(b"ctts") if stbl else None
    edts = video.find(b"edts") if video else None
    elst = edts.find(b"elst") if edts else None
    if not (stts and stts.payload and ctts and ctts.payload and elst and elst.payload):
        raise RepairUnavailable("errors.mp4repair.legacyNoTimetable")
    shift, tolerance = _legacy_timing(stts.payload, ctts.payload)
    payload = _edit_times(elst.payload, lambda value: value - shift
                          if value > shift and abs(value - 2 * shift) <= tolerance else value)
    if payload is None:
        raise RepairUnavailable("errors.mp4repair.legacyEditListInvalid")
    if payload == elst.payload:
        return header
    elst.payload = payload
    rebuilt = root.serialize()
    if len(rebuilt) != span[1] - span[0] + 8:
        raise RepairUnavailable("errors.mp4repair.legacyHeaderLength")
    return RepairedHeader(header.prefix[:span[0] - 8] + rebuilt + header.prefix[span[1]:],
                          header.payload_start, header.payload_end, header.suffix)


def read_sidecar(path: Path) -> RepairedHeader | None:
    """读不出来就当没有边车：调用方照旧走转码分片。"""
    try:
        blob = path.read_bytes()
    except OSError:
        return None
    magic = blob[:len(SIDECAR_MAGIC)]
    if magic not in (SIDECAR_MAGIC, LEGACY_SIDECAR_MAGIC) or len(blob) < len(SIDECAR_MAGIC) + 32:
        return None
    prefix_len, suffix_len, start, end = struct.unpack_from(">QQQQ", blob, len(SIDECAR_MAGIC))
    body = blob[len(SIDECAR_MAGIC) + 32:]
    if len(body) != prefix_len + suffix_len:
        return None
    header = RepairedHeader(prefix=body[:prefix_len], payload_start=start, payload_end=end,
                            suffix=body[prefix_len:])
    if magic == LEGACY_SIDECAR_MAGIC:
        try:
            return _upgrade_legacy_header(header)
        except (RepairUnavailable, struct.error):
            return None
    return header


class HeaderRepairStore:
    """按资产存修好的头，并负责那一趟解码要花的时间。

    文件名带上原片的大小和修改时间，源文件一换边车自然失效——和整片转码缓存同一套判据，
    也住在同一个目录里，资产删掉时由同一段清理逻辑回收。

    算一份头要把整部片解一遍（挂载盘上按几十 MB/s 算，一部两三 GB 的片子一分多钟），
    所以只在后台算、一次只算一部，算不出来就记下来别再试——调用方照旧走转码分片。
    """

    def __init__(self, root: Path, resolver, *, max_concurrent: int = 1, cached: int = 4, runs=None):
        self.root = Path(root)
        self.resolver = resolver
        self._slots = threading.Semaphore(max(1, max_concurrent))
        self._running: set[str] = set()
        #: 算不出来的那几份头，值是写进任务行的报错字段（带 code 的原因连同 `error_code`）。
        self._failed: dict[str, dict] = {}
        # 一份头有几 MB（整个 moov 加 ctts），而播放时每个 Range 请求都要问一次。
        # 同时在播的片子就那么一两部，留最近几份在手边，别反复读同一个文件。
        self._cached: dict[str, RepairedHeader] = {}
        self._cache_size = max(1, cached)
        self._guard = threading.Lock()
        self.runs = runs
        self._jobs = {}

    def _name(self, asset_id: int, source: Path, stat=None) -> str | None:
        if stat is None:
            from . import media_io
            try:
                stat = media_io.bounded(media_io.mount_key(source), source.stat)
            except OSError:
                return None
        return f"{asset_id}-{stat.st_size}-{stat.st_mtime_ns}{SIDECAR_SUFFIX}"

    def lookup(self, asset_id: int, source: Path, *, stat=None) -> RepairedHeader | None:
        """已经算好的头；没有就返回 None，不去算。`stat` 是调用方刚取过的片源 stat，给了就不再问网盘。"""
        name = self._name(asset_id, source, stat)
        if not name:
            return None
        with self._guard:
            header = self._cached.get(name)
        if header is not None:
            return header
        header = read_sidecar(self.root / name)
        if header is not None:
            with self._guard:
                if len(self._cached) >= self._cache_size:
                    self._cached.pop(next(iter(self._cached)))
                self._cached[name] = header
        return header

    def has_invalid_sidecar(self, asset_id: int, source: Path, *, stat=None) -> bool:
        """已有损坏边车仍可重建；区别于没有产物的既有解码失败。`stat` 同 `lookup`。"""
        name = self._name(asset_id, source, stat)
        if not name:
            return False
        path = self.root / name
        return path.is_file() and read_sidecar(path) is None

    def request(self, asset_id: int, source: Path) -> None:
        """在后台补一份头。播放请求不能为此等一分钟，所以这里只管开线程。"""
        name = self._name(asset_id, source)
        if not name:
            return
        with self._guard:
            if name in self._running or name in self._failed:
                return
            previous = self._jobs.get(name)
            if previous is not None:
                state = previous.snapshot() or {}
                if state.get('status') in ('running', 'cancelled'):
                    return
            from .jobs import BackgroundJob
            job = BackgroundJob(f'PeachMp4Header-{asset_id}', task_key='mp4-header-repair',
                                mutex_key=f'mp4-header-repair:{name}', runs=self.runs)
            self._jobs[name] = job

        def work(job_id):
            made = self.repair_now(asset_id, source, progress=lambda current, total: job.update(
                job_id, checked=current, total=total))
            failure = {'error': ''} if made else self._failed.get(name) or failure_fields(
                RepairUnavailable("errors.mp4repair.headerNotRepaired"))
            job.update(job_id, status='complete' if made else 'failed', repaired=int(made), **failure)

        job.start(work, initial={**stage_fields('mediaRepair.readTimestamps'), 'name': source.name, 'asset_id': asset_id})

    def stop(self):
        with self._guard:
            jobs = list(self._jobs.values())
        for job in jobs:
            job.stop()

    def repair_now(self, asset_id: int, source: Path, *, progress=None, stat=None, read_layout=None) -> bool:
        """当场算一份头并存下来。已经有、正在算或上次算不出来都返回 False。

        `stat` 同 `lookup`；`read_layout` 见 `repaired_header`。
        """
        name = self._name(asset_id, source, stat)
        ffprobe = self.resolver.ffprobe()
        if not name or ffprobe is None or read_sidecar(self.root / name) is not None:
            return False
        with self._guard:
            if name in self._running or name in self._failed:
                return False
            self._running.add(name)
        try:
            from .task_control import checkpoint
            while not self._slots.acquire(timeout=.1):
                checkpoint()
            try:
                checkpoint()
                options = {key: value for key, value in (('progress', progress), ('read_layout', read_layout))
                           if value is not None}
                header = repaired_header(source, ffprobe.path, **options)
                write_sidecar(self.root / name, header)
            finally:
                self._slots.release()
            for stale in self.root.glob(f"{asset_id}-*{SIDECAR_SUFFIX}"):
                if stale.name != name:
                    stale.unlink(missing_ok=True)
            return True
        except (RepairUnavailable, OSError, struct.error) as exc:
            LOGGER.info("mp4 header repair unavailable for asset %s: %s", asset_id, exc)
            with self._guard:
                self._failed[name] = (failure_fields(exc) if isinstance(exc, UserFacingError)
                                      else {'error': str(exc)})
            return False
        finally:
            with self._guard:
                self._running.discard(name)
