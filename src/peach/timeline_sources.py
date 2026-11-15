"""读取视频旁已有的时间轴预览；索引统一为带时刻的图片裁切区域。"""
from __future__ import annotations

import io
import json
import math
import os
import re
from dataclasses import dataclass, replace
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

import m3u8
from PIL import Image

from . import bif, media_io

MAX_INDEX_BYTES = 4 * 1024 * 1024
MAX_FRAMES = 20000
MAX_IMAGE_BYTES = 32 * 1024 * 1024
IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp'}


@dataclass(frozen=True)
class Frame:
    start: float
    end: float
    path: Path
    box: tuple[int, int, int, int] | None = None
    bif_index: bif.BifIndex | None = None
    bif_number: int = 0


@dataclass(frozen=True)
class Timeline:
    source: str
    frames: tuple[Frame, ...]
    estimated: bool = False
    root: Path | None = None

    def metadata(self) -> dict:
        return {'source': self.source, 'frames': len(self.frames), 'interval': 0,
                'columns': 1, 'rows': 1, 'estimated': self.estimated,
                'cues': [[frame.start, frame.end] for frame in self.frames]}


def _text(path: Path) -> str:
    with path.open('rb') as stream:
        data = stream.read(MAX_INDEX_BYTES + 1)
    if len(data) > MAX_INDEX_BYTES:
        raise ValueError("preview index is too large")
    return data.decode('utf-8-sig')


def _local(base: Path, name: str, root: Path) -> Path:
    """只接受同一视频目录内的本地引用。越界按 `_real` 判：其他平台解析符号链接，Windows 按词法。"""
    url = urlsplit(name)
    if url.scheme or url.netloc or url.query or '\\' in name:
        raise ValueError("invalid preview image reference")
    relative = Path(unquote(url.path))
    if relative.is_absolute() or ':' in str(relative):
        raise ValueError("invalid preview image reference")
    path = _real(base / relative)
    if not path.is_relative_to(_real(root)):
        raise ValueError("preview image is outside the video directory")
    return path


def _size(path: Path) -> tuple[int, int]:
    if path.suffix.lower() not in IMAGE_SUFFIXES or path.stat().st_size > MAX_IMAGE_BYTES:
        raise ValueError("invalid preview image format or size")
    with Image.open(path) as image:
        if image.format not in ('JPEG', 'PNG', 'WEBP') or image.width * image.height > 40_000_000:
            raise ValueError("preview image has too many pixels")
        return image.size


def _timeline(source: str, frames: list[Frame], *, estimated: bool = False) -> Timeline | None:
    if not frames or len(frames) > MAX_FRAMES:
        return None
    previous = -1.0
    sizes = {}
    for frame in frames:
        if not (math.isfinite(frame.start) and math.isfinite(frame.end)
                and 0 <= frame.start < frame.end and frame.start >= previous):
            return None
        previous = frame.end
        if frame.bif_index is not None:
            continue
        size = sizes.setdefault(frame.path, None)
        if size is None:
            size = sizes[frame.path] = _size(frame.path)
        if frame.box:
            x, y, width, height = frame.box
            if min(x, y) < 0 or min(width, height) <= 0 or x + width > size[0] or y + height > size[1]:
                return None
    return Timeline(source, tuple(frames), estimated)


def _seconds(value: str) -> float:
    if not re.fullmatch(r'(?:\d+:)?\d{2}:\d{2}\.\d{3}', value):
        raise ValueError("invalid preview timestamp")
    parts = value.split(':')
    if float(parts[-1]) >= 60 or int(parts[-2]) >= 60:
        raise ValueError("invalid preview timestamp")
    return sum(float(part) * 60 ** index for index, part in enumerate(reversed(parts)))


def read_vtt(path: Path, root: Path) -> Timeline | None:
    text = _text(path).replace('\r\n', '\n').replace('\r', '\n')
    if not re.match(r'^WEBVTT(?:[ \t].*)?\n', text):
        return None
    frames = []
    for block in re.split(r'\n[ \t]*\n', text):
        lines = block.strip().splitlines()
        if not lines or lines[0].startswith(('WEBVTT', 'NOTE', 'STYLE', 'REGION')):
            continue
        timing = next((index for index, line in enumerate(lines[:2]) if ' --> ' in line), None)
        if timing is None or len(lines) != timing + 2:
            return None
        times = lines[timing].split(' --> ')
        if len(times) != 2 or not times[1].split():
            return None
        start, end = _seconds(times[0]), _seconds(times[1].split()[0])
        reference = lines[timing + 1].strip()
        target = _local(path.parent, reference, root)
        if target.suffix.lower() not in IMAGE_SUFFIXES:
            return None
        fragment = urlsplit(reference).fragment
        box = None
        if fragment:
            match = re.fullmatch(r'xywh=(?:pixel:)?(\d+),(\d+),(\d+),(\d+)', fragment)
            if not match:
                return None
            box = tuple(map(int, match.groups()))
        frames.append(Frame(start, end, target, box))
        if len(frames) > MAX_FRAMES:
            return None
    return _timeline('webvtt', frames)


def _grid(frames: list[Frame], path: Path, start: float, end: float,
          interval: float, columns: int, rows: int, width: int, height: int) -> None:
    values = (start, end, interval, columns, rows, width, height)
    if not all(math.isfinite(value) for value in values) or interval <= 0 or end <= start:
        raise ValueError("invalid preview grid")
    if min(columns, rows, width, height) <= 0 or columns * rows > MAX_FRAMES:
        raise ValueError("invalid preview grid")
    for slot in range(min(columns * rows, math.ceil((end - start) / interval - 1e-9))):
        point = start + slot * interval
        frames.append(Frame(point, min(end, point + interval), path,
                            ((slot % columns) * width, (slot // columns) * height, width, height)))
        if len(frames) > MAX_FRAMES:
            raise ValueError("too many preview frames")


def _dash_segments(template, ns: str, duration: float) -> list[tuple[int, int]]:
    scale = int(template.get('timescale', '1'))
    offset = int(template.get('presentationTimeOffset', '0'))
    if scale <= 0:
        raise ValueError("invalid DASH timescale")
    timeline = template.find(ns + 'SegmentTimeline')
    if timeline is None:
        step = int(template.get('duration', '0'))
        if step <= 0:
            raise ValueError("invalid DASH segment duration")
        count = math.ceil((duration * scale + offset) / step)
        if not 0 < count <= MAX_FRAMES:
            raise ValueError("too many DASH preview frames")
        return [(index * step, step) for index in range(count)]
    entries = list(timeline)
    segments, point = [], 0
    for number, entry in enumerate(entries):
        if entry.tag != ns + 'S':
            raise ValueError("invalid DASH timeline")
        point = int(entry.get('t', str(point)))
        step = int(entry.get('d', '0'))
        repeat = int(entry.get('r', '0'))
        if point < 0 or step <= 0 or repeat < -1:
            raise ValueError("invalid DASH timeline")
        if repeat == -1:
            next_point = (int(entries[number + 1].get('t')) if number + 1 < len(entries)
                          else duration * scale + offset)
            repeat = math.ceil((next_point - point) / step) - 1
        if repeat < 0 or len(segments) + repeat + 1 > MAX_FRAMES:
            raise ValueError("too many DASH preview frames")
        for _ in range(repeat + 1):
            segments.append((point, step))
            point += step
    return segments


def read_hls(path: Path, root: Path, *, depth: int = 0) -> Timeline | None:
    if depth > 2:
        return None
    playlist = m3u8.loads(_text(path))
    for alternative in playlist.image_playlists:
        child = _local(path.parent, alternative.uri, root)
        found = read_hls(child, root, depth=depth + 1)
        if found:
            return found
    if not playlist.is_images_only or not playlist.is_endlist:
        return None
    tiles = playlist.data.get('tiles') or []
    if tiles and len(tiles) != len(playlist.segments):
        return None
    frames, start = [], 0.0
    for index, segment in enumerate(playlist.segments):
        if segment.byterange or (segment.key and segment.key.method != 'NONE') or segment.gap_tag:
            return None
        target = _local(path.parent, segment.uri, root)
        end = start + float(segment.duration)
        if tiles:
            tile = tiles[index]
            width, height = map(int, tile['resolution'].split('x'))
            columns, rows = map(int, tile['layout'].split('x'))
            interval = float(tile['duration'])
            if end - start > interval * columns * rows + 1e-6:
                return None
            _grid(frames, target, start, end, interval, columns, rows, width, height)
        else:
            frames.append(Frame(start, end, target))
        start = end
    return _timeline('hls', frames)


def _duration(value: str | None) -> float:
    match = re.fullmatch(r'PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?', value or '')
    if not match or not any(match.groups()):
        return 0.0
    return sum(float(part or 0) * scale for part, scale in zip(match.groups(), (3600, 60, 1)))


def _dash_name(template: str, representation: str, number: int, time: int, bandwidth: str) -> str:
    values = {'RepresentationID': representation, 'Number': number, 'Time': time, 'Bandwidth': bandwidth}
    def replace(match):
        value = values[match[1]]
        return str(value).zfill(int(match[2] or 0))
    name = re.sub(r'\$(RepresentationID|Number|Time|Bandwidth)(?:%0(\d{1,2})d)?\$', replace, template)
    if '$' in name:
        raise ValueError("invalid DASH preview template")
    return name


def _dash_representation(representation, adaptation, parent: Path, root: Path,
                         start: float, duration: float, ns: str) -> list[Frame] | None:
    """将一条图片轨的网格、分段时钟和文件模板展开成预览区域。"""
    tile = next((node for node in [*representation, *adaptation]
                 if node.tag in (ns + 'EssentialProperty', ns + 'SupplementalProperty')
                 and node.get('schemeIdUri') == 'http://dashif.org/guidelines/thumbnail_tile'), None)
    layout = tile.get('value', '') if tile is not None else '1x1'
    if not re.fullmatch(r'\d+x\d+', layout):
        return None
    columns, rows = map(int, layout.split('x'))
    if min(columns, rows) <= 0 or columns * rows > MAX_FRAMES:
        return None
    template = representation.find(ns + 'SegmentTemplate')
    if template is None:
        template = adaptation.find(ns + 'SegmentTemplate')
    if template is None:
        return None
    scale = int(template.get('timescale', '1'))
    segments = _dash_segments(template, ns, duration)
    if len(segments) * columns * rows > MAX_FRAMES:
        return None
    first = int(template.get('startNumber', '1'))
    offset = int(template.get('presentationTimeOffset', '0'))
    base_url = representation.find(ns + 'BaseURL')
    directory = parent if base_url is None else _local(parent, (base_url.text or '').strip(), root)
    frames, period_end = [], start + duration
    for index, (timestamp, step) in enumerate(segments):
        name = _dash_name(template.get('media', ''), representation.get('id', ''),
                          first + index, timestamp, representation.get('bandwidth', ''))
        target = _local(directory, name, root)
        image_width, image_height = _size(target)
        if image_width % columns or image_height % rows:
            return None
        point = start + (timestamp - offset) / scale
        if point + step / scale <= start or point >= period_end:
            continue
        segment_frames = []
        _grid(segment_frames, target, point, min(period_end, point + step / scale),
              step / scale / (columns * rows), columns, rows,
              image_width // columns, image_height // rows)
        frames.extend(Frame(max(start, frame.start), frame.end, frame.path, frame.box)
                      for frame in segment_frames if frame.end > start)
    return frames


def read_dash(path: Path, root: Path) -> Timeline | None:
    text = _text(path)
    if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():
        return None
    document = ET.fromstring(text)
    ns = '{urn:mpeg:dash:schema:mpd:2011}'
    if document.tag != ns + 'MPD' or document.get('type', 'static') != 'static':
        return None
    total = _duration(document.get('mediaPresentationDuration'))
    frames, period_end = [], 0.0
    def child(node, name):
        return node.find(ns + name)
    def base(node, parent):
        item = child(node, 'BaseURL')
        return parent if item is None else _local(parent, (item.text or '').strip(), root)
    root_base = base(document, path.parent)
    periods = document.findall(ns + 'Period')
    for period_number, period in enumerate(periods):
        start = _duration(period.get('start')) if period.get('start') else period_end
        next_start = (periods[period_number + 1].get('start')
                      if period_number + 1 < len(periods) else None)
        boundary = _duration(next_start) if next_start is not None else total
        duration = _duration(period.get('duration')) or max(0, boundary - start)
        if duration <= 0:
            return None
        period_end = start + duration
        period_base = base(period, root_base)
        found = False
        for adaptation in period.findall(ns + 'AdaptationSet'):
            if adaptation.get('contentType') != 'image' and not adaptation.get('mimeType', '').startswith('image/'):
                continue
            adaptation_base = base(adaptation, period_base)
            for representation in adaptation.findall(ns + 'Representation'):
                images = _dash_representation(representation, adaptation, adaptation_base, root,
                                              start, duration, ns)
                if images is None:
                    continue
                frames.extend(images)
                found = True
                break
            if found:
                break
    return _timeline('dash', frames)


def read_bif(path: Path, duration: float) -> Timeline | None:
    index = bif.read_index(path)
    if index is None or len(index.frames) > MAX_FRAMES:
        return None
    frames = []
    for number, frame in enumerate(index.frames):
        end = (index.frames[number + 1].timestamp if number + 1 < len(index.frames)
               else duration if duration > frame.timestamp else frame.timestamp + 10)
        frames.append(Frame(frame.timestamp, end, path, bif_index=index, bif_number=number))
    return _timeline('bif', frames)


def read_jellyfin(directory: Path, duration: float) -> Timeline | None:
    match = re.fullmatch(r'(\d+) - (\d+)x(\d+)', directory.name)
    if not match or not duration > 0:
        return None
    width, columns, rows = map(int, match.groups())
    if min(width, columns, rows) <= 0:
        return None
    paths = sorted((item for item in directory.iterdir() if re.fullmatch(r'\d+\.jpg', item.name)),
                   key=lambda item: int(item.stem))
    if not paths or [int(item.stem) for item in paths] != list(range(len(paths))):
        return None
    if any(not _inside(path, directory.parent.parent) for path in paths):
        return None
    interval, count, estimated = 10.0, math.ceil(duration / 10), True
    metadata = directory / 'trickplay.json'
    if metadata.is_file() and _inside(metadata, directory.parent.parent):
        data = json.loads(_text(metadata))
        interval = float(data['Interval']) / 1000
        count = int(data['ThumbnailCount'])
        if (int(data['Width']), int(data['TileWidth']), int(data['TileHeight'])) != (width, columns, rows):
            return None
        estimated = False
    if interval <= 0 or count <= 0 or count > MAX_FRAMES or math.ceil(count / (columns * rows)) != len(paths):
        return None
    frames = []
    for page, path in enumerate(paths):
        image_width, image_height = _size(path)
        if image_width != width * columns or image_height % rows:
            return None
        start = page * columns * rows * interval
        end = min(duration, count * interval, (page + 1) * columns * rows * interval)
        if end <= start:
            return None
        _grid(frames, path, start, end, interval, columns, rows, width, image_height // rows)
    return _timeline('jellyfin', frames, estimated=estimated)


def _real(path: Path) -> Path:
    """越界判断用的绝对路径，口径同 `media.normalized_path`：Windows 只做 `abspath`。

    PikPak、115 的盘符是网络重定向器映射的，`resolve()` 要逐级问最终路径，一次就是几秒。
    """
    return Path(os.path.abspath(path)) if os.name == 'nt' else path.resolve()


def _inside(path: Path, root: Path) -> bool:
    return _real(path).is_relative_to(_real(root))


def _listed(entries: dict, root: Path, name: str, *, directory: bool = False) -> Path | None:
    """目录清单里认一个名字（不分大小写）。清单里的普通条目本来就在目录里，不再 stat；
    符号链接仍按真实路径核对不出目录。"""
    entry = entries.get(name.casefold())
    if entry is None:
        return None
    try:
        if not (entry.is_dir() if directory else entry.is_file()):
            return None
        path = root / entry.name
        if entry.is_symlink() and not path.resolve().is_relative_to(root.resolve()):
            return None
    except OSError:
        return None
    return path


def discover(video: Path, duration: float) -> Timeline | None:
    """按准确文件主名配对，不通过番号或同目录唯一性猜测视频版本。

    绝大多数片子旁边什么都没有，所以先把视频目录列一次，候选名字从这份清单里认（`_listed`），
    不对十几个候选逐个 stat。列目录交给带期限的读取子进程：挂死的挂载上读不出来就当没有。
    """
    root = _real(video.parent)
    try:
        entries = {entry.name.casefold(): entry for entry in media_io.directory_entries(root)}
    except OSError:
        return None

    def present(name: str, *, directory: bool = False) -> Path | None:
        return _listed(entries, root, name, directory=directory)

    try:
        for suffix, reader in (('.vtt', read_vtt), ('.m3u8', read_hls), ('.mpd', read_dash)):
            for stem in (video.stem, video.name, video.stem + '.thumbnails', video.stem + '-thumbs', video.stem + '.storyboard'):
                path = present(stem + suffix)
                if path is None:
                    continue
                try:
                    found = reader(path, root)
                    if found:
                        return replace(found, root=root)
                except (OSError, ValueError, OverflowError, KeyError, TypeError, ET.ParseError, Image.DecompressionBombError):
                    continue
        for name in sorted(entry.name for entry in entries.values()):
            if not name.lower().endswith('.bif') or not name.startswith(video.stem):
                continue
            tail = Path(name).stem[len(video.stem):]
            if tail and not re.fullmatch(r'-(?:\d+-\d+|sd|hd|fhd)', tail):
                continue
            path = present(name)
            if path is not None:
                found = read_bif(path, duration)
                if found:
                    return replace(found, root=root)
        directory = present(video.stem + '.trickplay', directory=True)
        if directory is not None:
            for entry in sorted(media_io.directory_entries(directory), key=lambda entry: entry.name):
                resolution = directory / entry.name
                if entry.is_dir() and _inside(resolution, root):
                    try:
                        found = read_jellyfin(resolution, duration)
                        if found:
                            return replace(found, root=root)
                    except (OSError, ValueError, OverflowError, KeyError, TypeError, Image.DecompressionBombError):
                        continue
    except OSError:
        return None
    return None


def frame_bytes(timeline: Timeline, number: int) -> bytes | None:
    """只读取所需图片并裁切，不启动 FFmpeg 或访问视频内容。"""
    if not 0 <= number < len(timeline.frames):
        return None
    frame = timeline.frames[number]
    try:
        if timeline.root is not None and not _inside(frame.path, timeline.root):
            return None
        if frame.bif_index is not None:
            return bif.read_frame(frame.bif_index, frame.bif_number)
        _size(frame.path)
        with Image.open(frame.path) as image:
            if frame.box:
                x, y, width, height = frame.box
                if x + width > image.width or y + height > image.height:
                    return None
                image = image.crop((x, y, x + width, y + height))
            output = io.BytesIO()
            image.convert('RGB').save(output, 'JPEG', quality=90)
            return output.getvalue()
    except (OSError, ValueError, Image.DecompressionBombError):
        return None
