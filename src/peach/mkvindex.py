"""读取 Matroska 的视频 Cues；只取得索引，不读取 Cluster 中的媒体包。"""
from __future__ import annotations

import io
import math
import struct
from pathlib import Path

from ebmlite.decoding import readElementID, readElementSize

SEGMENT = 0x18538067
SEEK_HEAD = 0x114D9B74
INFO = 0x1549A966
TRACKS = 0x1654AE6B
CUES = 0x1C53BB6B
CLUSTER = 0x1F43B675
MAX_INDEX_BYTES = 16 << 20
MAX_ELEMENTS = 100_000
MAX_SEEKS = 64


def _elements(stream, start: int, end: int):
    position = start
    for _ in range(MAX_ELEMENTS):
        if position >= end:
            return
        stream.seek(position)
        kind, _ = readElementID(stream)
        size, _ = readElementSize(stream)
        body = stream.tell()
        stop = end if size is None and kind == SEGMENT else body + size if size is not None else -1
        if body > end or stop < body or stop > end:
            raise ValueError("Matroska 元素越界")
        yield kind, body, stop
        position = stop
    raise ValueError("Matroska 元素过多")


def _children(data: bytes):
    stream = io.BytesIO(data)
    for kind, body, stop in _elements(stream, 0, len(data)):
        yield kind, data[body:stop]


def _uint(data: bytes) -> int:
    if not 0 < len(data) <= 8:
        raise ValueError("Matroska 整数长度无效")
    return int.from_bytes(data, "big")


def _metadata(stream, begin: int, end: int) -> dict[int, bytes]:
    """按 SeekHead 跳至 Info、Tracks 与 Cues，首次遇到 Cluster 就停止顺序访问。"""
    found: dict[int, bytes] = {}
    pending = [(begin, None)]
    visited = set()
    remaining = MAX_INDEX_BYTES
    while pending and len(visited) < MAX_SEEKS:
        position, expected = pending.pop(0)
        if position in visited:
            continue
        visited.add(position)
        for kind, body, stop in _elements(stream, position, end):
            if expected is not None and kind != expected:
                raise ValueError("Matroska SeekHead 目标不匹配")
            if kind == CLUSTER:
                break
            if kind in {SEEK_HEAD, INFO, TRACKS, CUES}:
                length = stop - body
                if length > remaining:
                    raise ValueError("Matroska 索引超过读取预算")
                stream.seek(body)
                data = stream.read(length)
                remaining -= length
                if len(data) != length:
                    raise ValueError("Matroska 索引未读完整")
                if kind == SEEK_HEAD:
                    for entry, payload in _children(data):
                        if entry != 0x4DBB:
                            continue
                        fields = dict(_children(payload))
                        target = _uint(fields.get(0x53AB, b""))
                        offset = begin + _uint(fields.get(0x53AC, b""))
                        if target in {SEEK_HEAD, INFO, TRACKS, CUES}:
                            if not begin <= offset < end:
                                raise ValueError("Matroska SeekHead 位置越界")
                            pending.append((offset, target))
                else:
                    found[kind] = data
            if expected is not None or {INFO, TRACKS, CUES} <= found.keys():
                break
        if {INFO, TRACKS, CUES} <= found.keys():
            return found
    return found


def keyframe_seconds(path: Path | str) -> list[float] | None:
    """返回首条视频轨的索引时刻；缺索引、未知布局和越界数据均返回 None。"""
    try:
        with open(path, "rb") as stream:
            end = stream.seek(0, 2)
            segment = next((item for item in _elements(stream, 0, end) if item[0] == SEGMENT), None)
            if segment is None:
                return None
            metadata = _metadata(stream, segment[1], segment[2])
        if not {INFO, TRACKS, CUES} <= metadata.keys():
            return None
        scale = _uint(dict(_children(metadata[INFO])).get(0x2AD7B1, b"\x0fB@"))
        video_track = None
        for kind, payload in _children(metadata[TRACKS]):
            if kind != 0xAE:
                continue
            fields = dict(_children(payload))
            if _uint(fields.get(0x83, b"\x00")) != 1:
                continue
            track_scale = fields.get(0x23314F)
            if track_scale is not None and (len(track_scale) not in {4, 8} or
                    struct.unpack(">f" if len(track_scale) == 4 else ">d", track_scale)[0] != 1):
                return None
            if any(_uint(fields.get(key, b"\x00")) for key in (0x537F, 0x56AA)):
                return None
            video_track = _uint(fields.get(0xD7, b""))
            break
        if not video_track or scale <= 0:
            return None
        times = []
        for kind, payload in _children(metadata[CUES]):
            if kind != 0xBB:
                continue
            fields = list(_children(payload))
            timestamp = next((_uint(value) for key, value in fields if key == 0xB3), None)
            if timestamp is None:
                continue
            for key, value in fields:
                if key != 0xB7:
                    continue
                position = dict(_children(value))
                if _uint(position.get(0xF7, b"\x00")) == video_track and 0xDB not in position:
                    seconds = timestamp * scale / 1_000_000_000
                    if math.isfinite(seconds):
                        times.append(seconds)
                    break
        return sorted(set(times)) or None
    except (OSError, EOFError, TypeError, ValueError, OverflowError, struct.error):
        return None
