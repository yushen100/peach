"""扫描一个来源的目录，把文件元数据写进账本。

这是摄取入口，不是复核写入：它新增行、刷新 `size`／`mtime`／`last_seen`，不改任何
真相字段——本次没扫到的文件只会在 `last_seen` 上落后，由资源同步对账决定去留。

文件消失、带着个人记录的行由资源同步标 `disposal='vanished'`（ADR-0087）。登记时把它们接回：
同一路径的文件回来了，upsert 清掉那一行的 `disposal`；新登记的行由 `record_rehome.reattach`
按番号或「创作者 + 文件名主干 + 时长」找它的旧行，把记录搬过来、删掉旧行，记一个可撤回的批次。
旧行还在库、文件已不在盘上时，登记前先由 `record_rehome.CodeRelocator` 按番号把它改指到新文件。
接着由 `wants.reconcile` 按番号对一遍「想要」清单，命中的标「已入库」，同样记可撤回的批次。

两条不变量都在这里守：

- `asset.location` 是来源 ID，`asset.path` 一律是 Windows 形态的账本路径。扫描根必须
  落在该来源 `[media.locations]` 数据库路径前缀之内（`check_scan_target`），否则写进去的行既
  翻译不出本机路径、也通不过授权根，而且要等到有人点开那个资产才会发现。
- 目录在本机哪里，由 `[media.mounts]` 决定。Windows 上盘符本身就是挂载点，数据库路径前缀原样
  就是要遍历的目录；macOS 上遍历的是挂载点，写进账本的仍是 `数据库路径前缀\\相对路径`，这样
  读取侧的 `platform.translate_ledger_path` 才翻得回同一个文件。

字幕 sidecar 顺带在这里登记：遍历时每个目录的文件名已经在手上，配对判据只看同目录，
`subtitles.py` 负责判定，本模块只负责把结论落进 `asset_subtitle`。

刮削器与播放器写在正片旁边的附属文件不登记（`is_sidecar`）：本地预告片、花絮、主题媒体、NFO、海报与背景图、
`extrafanart/` 里的剧照、截图工具拼出的缩略图。它们描述一部片，本身不是作品，登记进来就会在
馆藏里冒出成百张「图片」，把真正的图集淹掉。

`peach init` 的首次扫描与 `peach scan` 调 `scan_location` 遍历整个根；推送发现拿到一条
路径时调 `ingest_path`，登记口径、不变量与 upsert 语句都是同一份。
数据库路径前缀和挂载表由调用方传入而不是读进程缓存：`init` 刚写完设置文件时缓存还是旧的。
"""
from __future__ import annotations

import os
import ntpath
import hashlib
import json
import logging
import re
import sqlite3
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import asdict, dataclass
from functools import partial
from itertools import chain
from pathlib import Path, PureWindowsPath
from filelock import FileLock

from . import folder_rules, interface_text, junk, record_rehome, subtitles, wants
from .platform import is_windows_path, is_unmapped, resolve_location, resolve_root
from .processing_control import checkpoint
from .fsutil import atomic_write_text
from .user_messages import UserFacingError
from .discovery_rules import system_directory, system_path
from .catalog_rules import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, is_local_extra

VIDEO = VIDEO_EXTENSIONS
IMAGE = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
AUDIO = AUDIO_EXTENSIONS
ARCHIVE = {".zip", ".rar", ".7z", ".tar", ".gz"}

#: 每攒够这么多行落一次盘，并报一行进度。
BATCH_SIZE = 2000
#: 账本连接开写事务时打不开事务侧文件（`SQLITE_CANTOPEN`，杀毒软件或备份工具短暂占住 `-wal`/`-journal`）
#: 时，重开连接重试当前批次的等待秒数；用完仍失败就照原样报出（#138）。
REOPEN_DELAYS = (0.5, 1.0, 2.0)

LOGGER = logging.getLogger(__name__)

#: Kodi／Jellyfin 的影片图片名（单写或挂在片名后面，如 `ABC-123-fanart.jpg`）。
#: 只在同目录有视频时算附属：没有正片的目录里，`cover.jpg` 是图集自己的封面。
ARTWORK = frozenset({
    "poster", "fanart", "thumb", "folder", "cover", "banner", "clearart", "clearlogo",
    "landscape", "disc", "discart", "logo", "backdrop", "keyart",
})
#: 装一部片剧照的整个子目录，只在上一层有视频时算附属。
ARTWORK_DIRS = frozenset({"extrafanart", "extrathumbs"})
#: 截图工具的产物，看名字就能认出来，不必看同目录：`X_4x4_thumb.jpg`（拼版缩略图）、
#: `X.mp4_thumbs.jpg`（MPC-HC 存缩略图）、`X.png.thumb.png`（图片的缩略图）。
_DERIVED_THUMB = re.compile(
    r"(?:_\d+x\d+_thumbs?|\.(?:" + "|".join(sorted(ext[1:] for ext in VIDEO))
    + r")_thumbs?|\.(?:" + "|".join(sorted(ext[1:] for ext in IMAGE)) + r")\.thumb)$",
    re.IGNORECASE)

# 同一路径上的文件回来了，标「已消失」的那一行就是它：清掉 `disposal`，不另起一行。
# 回收站里的行是用户丢的，文件在不在都不改。
_UPSERT = """INSERT INTO asset(location,path,name,medium,size,mtime,first_seen,last_seen)
             VALUES(?,?,?,?,?,?,?,?)
             ON CONFLICT(location,path) DO UPDATE SET
               medium=excluded.medium, size=excluded.size, mtime=excluded.mtime, last_seen=excluded.last_seen,
               disposal=CASE WHEN asset.disposal='vanished' THEN NULL ELSE asset.disposal END"""


class ScanTargetError(UserFacingError, ValueError):
    """来源与扫描根对不上，或者来源在本机没有落点。消息可以直接给人看。"""


class ScanRootUnreadable(ScanTargetError):
    """扫描根目录本身列不出来（掉线、没权限、不存在）。

    这时什么都没枚举到，不能当成「这个来源空了」：照常结束会报 0 个文件，并把整个来源的
    已有资产算进「清单中已消失」（#693）。根目录以下零星读不了的子目录仍按 `onerror` 跳过。
    """

    def __init__(self, directory, error):
        super().__init__('errors.scan.rootUnreadable', {'root': str(directory), 'error': str(error)})


class ScanPathConflict(ScanTargetError):
    """同一规范路径的既有记录须由用户复核，摄取不选择或合并身份。"""

    def __init__(self, entries):
        self.asset_ids = tuple(entry[0] for entry in entries)
        self.paths = tuple(entry[1] for entry in entries)
        super().__init__('errors.scan.pathConflict',
                         {'ids': [str(value) for value in self.asset_ids], 'path': self.paths[0]})


def _registered_paths(connection, location, root):
    """既有路径按 Windows 语义分组，歧义记录单列供复核。"""
    declared = PureWindowsPath(root)
    groups = {}
    for asset_id, path in connection.execute(
            "SELECT id,path FROM asset WHERE location=? AND path IS NOT NULL ORDER BY id", (location,)):
        target = PureWindowsPath(path)
        if not target.is_relative_to(declared):
            continue
        key = str(target).casefold()
        groups.setdefault(key, []).append((asset_id, path))
    return ({key: entries[0][1] for key, entries in groups.items() if len(entries) == 1},
            {key: ScanPathConflict(entries) for key, entries in groups.items() if len(entries) > 1})


def _open_ledger(db_path):
    """扫描用的账本连接：忙等时长与 `LedgerDatabase.connect` 一致，并核对日志模式真的是 WAL。

    `PRAGMA journal_mode=WAL` 失败时不报错，只回实际模式；退回 delete 后每个写事务都要新建
    `-journal`，大批扫描更容易撞上 `unable to open database file`，所以记一条告警（#138）。
    """
    connection = sqlite3.connect(db_path, timeout=30)
    mode = connection.execute("PRAGMA journal_mode=WAL").fetchone()[0]
    if str(mode).lower() != "wal":
        LOGGER.warning("Ledger journal mode is %s instead of wal; scan writes may fail to open the journal: %s",
                       mode, db_path)
    return connection


def _cannot_open(error: sqlite3.OperationalError) -> bool:
    if getattr(error, "sqlite_errorcode", None) == sqlite3.SQLITE_CANTOPEN:
        return True
    return "unable to open database file" in str(error)


def _upsert_records(connection, batch, registered, conflicts):
    rows = []
    inserted = {}
    for location, path, *values in batch:
        key = str(PureWindowsPath(path)).casefold()
        if key in conflicts:
            # 枚举确认文件仍在，只刷新观测时间；身份、处置与个人资料保持各自原值。
            connection.executemany('UPDATE asset SET last_seen=? WHERE id=?',
                                   [(values[-1], asset_id) for asset_id in conflicts[key].asset_ids])
            continue
        if key not in registered:
            inserted.setdefault(location, []).append(path)
        stored = registered.setdefault(key, path)
        rows.append((location, stored, *values))
    connection.executemany(_UPSERT, rows)
    ids = []
    for location, paths in inserted.items():
        for offset in range(0, len(paths), 900):
            portion = paths[offset:offset+900]
            ids.extend(row[0] for row in connection.execute(
                'SELECT id FROM asset WHERE location=? AND path IN ('
                + ','.join('?'*len(portion))+')', (location, *portion)))
    return ids


def medium_of(name: str) -> str:
    suffix = os.path.splitext(name)[1].lower()
    if suffix in VIDEO:
        return "video"
    if suffix in IMAGE:
        return "image"
    if suffix in AUDIO:
        return "audio"
    if suffix in ARCHIVE:
        return "archive"
    return "other"


def video_stems(names) -> frozenset[str]:
    """一个目录里视频文件的片名（casefold），`is_sidecar` 拿它判同目录有没有正片。"""
    return frozenset(os.path.splitext(name)[0].casefold() for name in names
                     if medium_of(name) == "video" and not system_path(name) and not is_local_extra(name))


def is_sidecar(name: str, videos: frozenset[str], *, artwork_dir: bool = False,
               path: str | None = None, library_roots: tuple[str, ...] = ()) -> bool:
    """`name` 是否为不登记的附属文件、系统元数据或工具隔离文件。

    `videos` 是同目录的 `video_stems`；`artwork_dir` 表示这个目录叫 `extrafanart` 之类、
    且上一层有视频。判据只看名字，不读文件内容。
    """
    if system_path(path or name):
        return True
    if re.fullmatch(r'peach-purge-[a-f0-9]{32}\.peach-quarantine', name, re.IGNORECASE):
        return True
    stem, suffix = os.path.splitext(name)
    if suffix.lower() == ".nfo":
        return True
    if is_local_extra(name, path, library_roots=library_roots):
        return True
    if medium_of(name) != "image":
        return False
    if artwork_dir or _DERIVED_THUMB.search(stem):
        return True
    if not videos:
        return False
    lowered = stem.casefold()
    if lowered in ARTWORK:
        return True
    head, dash, tail = lowered.rpartition("-")
    return bool(dash) and tail in ARTWORK and head in videos


def check_scan_target(
    location: str, root: str, *, declared_roots: Mapping[str, Sequence[str]],
) -> None:
    """扫描根必须落在这个来源的某个数据库路径前缀内，否则拒绝（ADR-0023 第 2 阶段的写入侧门槛）。"""
    declared = declared_roots.get(location)
    if declared is None:
        if not declared_roots:
            raise ScanTargetError("errors.scan.unknownSourceNoneDeclared", {"location": repr(location)})
        raise ScanTargetError("errors.scan.unknownSource",
                              {"location": repr(location), "known": "、".join(sorted(declared_roots))})
    actual = resolve_location(root, declared_roots)[0]
    if actual != location:
        params = {"location": location, "prefixes": "、".join(declared), "root": root}
        if actual:
            raise ScanTargetError("errors.scan.rootBelongsElsewhere", {**params, "actual": actual})
        raise ScanTargetError("errors.scan.rootOutsideMedia", params)


def ledger_root_for(
    location: str, root: str | os.PathLike[str], *,
    declared_roots: Mapping[str, Sequence[str]],
    mounts: Mapping[str, Sequence[str | Path]], windows: bool | None = None,
) -> str:
    """将媒体目录转换为数据库使用的 Windows 格式路径。

    Windows 上任何绝对路径本来就是账本形态，相对路径先按当前目录补全。其他平台上
    给的是本机目录（某个挂载点下的某一层），换成对应那个 `数据库路径前缀\\相对路径`；没有
    挂载点或不在任何挂载点下都拒绝——那种目录扫出来的行谁也翻译不回去。
    """
    windows = os.name == "nt" if windows is None else windows
    text = os.fspath(root)
    declared = declared_roots.get(location, ())
    location_mounts = tuple(mounts.get(location, ()))
    for declared_root, mount in zip(declared, location_mounts):
        from .smb_media import is_address, canonical
        if is_address(str(mount)):
            if text == declared_root or PureWindowsPath(text).is_relative_to(PureWindowsPath(declared_root)):
                return text
            if is_address(text) and canonical(text).startswith(canonical(str(mount)).rstrip('/') + '/'):
                from urllib.parse import unquote
                tail = tuple(unquote(part) for part in canonical(text)[len(canonical(str(mount))) + 1:].split('/'))
                return str(PureWindowsPath(declared_root, *tail))
            if is_address(text) and canonical(text) == canonical(str(mount)):
                return declared_root
            continue
        if not str(mount):
            continue
        try:
            tail = Path(text).resolve().relative_to(Path(mount).resolve()).parts
        except ValueError:
            continue
        return str(PureWindowsPath(declared_root, *tail))
    if windows:
        return text if is_windows_path(text) else str(Path(text).resolve())
    if is_windows_path(text):
        return text
    if not location_mounts:
        raise ScanTargetError("errors.scan.noMounts", {"location": repr(location), "path": text})
    raise ScanTargetError("errors.scan.outsideMounts", {
        "path": text, "location": repr(location),
        "mounts": "、".join(os.fspath(mount) for mount in location_mounts)})


def walk_root_for(
    location: str, root: str, *, declared_roots: Mapping[str, Sequence[str]],
    mounts: Mapping[str, Sequence[str | Path]], windows: bool | None = None,
) -> Path:
    """取得数据库路径在本机对应的扫描目录。

    先过 `check_scan_target`：不在这个来源任何数据库路径前缀下的目录，`resolve_root` 给的
    序号是 -1，拿它取挂载表会越界或落到最后一个挂载点，所以在这里就报可读的错误。
    """
    windows = os.name == "nt" if windows is None else windows
    check_scan_target(location, root, declared_roots=declared_roots)
    _location, index, tail = resolve_root(root, declared_roots)
    location_mounts = tuple(mounts.get(location, ()))
    from .smb_media import is_address, resolve
    if index < len(location_mounts) and is_address(str(location_mounts[index])):
        resource = resolve(root)
        if resource is None:
            raise ScanTargetError('errors.scan.smbNotSaved')
        return resource
    if index >= len(location_mounts) or str(location_mounts[index]) in ("", ".") or is_unmapped(Path(location_mounts[index])):
        if windows:
            return Path(root)
        raise ScanTargetError("errors.scan.prefixWithoutMount", {"location": repr(location), "index": index + 1})
    return Path(location_mounts[index]).joinpath(*tail)


@dataclass(frozen=True)
class IngestResult:
    """单条路径的登记结果。`found` 为假表示那个文件此刻不在磁盘上，什么也没写。"""
    location: str
    path: str
    found: bool
    size: int = 0
    subtitles: int = 0
    #: 文件在，但认作附属文件（`is_sidecar`），什么也没写。
    sidecar: bool = False
    #: 登记的那一行；`new` 表示这一次才新建。
    asset_id: int | None = None
    new: bool = False
    #: 新行接回了几条已消失作品的个人记录（`record_rehome`）。
    reattached: int = 0
    #: 新行让几条「想要」标了已入库（`wants.reconcile`）。
    acquired: int = 0
    #: 登记前按番号改指过来的旧行（`record_rehome.CodeRelocator`）；有它时 `new` 为假。
    relocated: int | None = None


def _video_names(entries) -> list[str]:
    """同一目录里视频的文件名，按番号改指时数同目录有几个同番号视频。"""
    return [entry.name for entry in entries if medium_of(entry.name) == "video"]


def _relocate_ingested(connection, registered, location, ledger_path, here, *, declared_roots, mounts, windows):
    """推送发现登记的视频接不上文件身份时，在它所在的媒体根里按番号找旧行（ADR-0131）。"""
    key = str(ledger_path).casefold()
    root = next((value for value in declared_roots.get(location, ())
                 if PureWindowsPath(value) in ledger_path.parents), None)
    if key in registered or medium_of(ledger_path.name) != "video" or root is None:
        return None
    relocator = record_rehome.CodeRelocator(connection, location, root, walk_root_for(
        location, root, declared_roots=declared_roots, mounts=mounts or {}, windows=windows))
    moved = relocator.relocate(str(ledger_path), lambda: [name for name in here or () if medium_of(name) == "video"])
    if moved is not None:
        registered[key] = str(ledger_path)
    return moved


def _directory_stats(directory: Path) -> dict[str, tuple[int, str]]:
    """一个目录里能 stat 到的文件名 → `(size, mtime)`，读不了的条目跳过。

    列目录交给可终止的读取子进程：推送发现与云下载的线程不能卡在挂死的挂载上，读超时按读不了算。
    """
    from . import media_io
    stats: dict[str, tuple[int, str]] = {}
    try:
        entries = media_io.directory_entries(directory)
    except OSError:
        return stats
    for entry in entries:
        try:
            if entry.is_dir():
                continue
            found = entry.stat()
        except OSError:
            continue
        stats[entry.name] = (
            found.st_size, time.strftime("%Y-%m-%d", time.localtime(found.st_mtime)))
    return stats


def _sidecar_on_disk(name: str, directory: Path, *, ledger_path: str | None = None,
                     library_roots: tuple[str, ...] = ()) -> bool:
    """单条登记时的 `is_sidecar`：只在名字本身判不完时才列目录。"""
    if is_sidecar(name, frozenset(), path=ledger_path, library_roots=library_roots):
        return True
    if medium_of(name) != "image":
        return False
    if directory.name.casefold() in ARTWORK_DIRS and video_stems(
            _directory_stats(directory.parent)):
        return True
    stem = os.path.splitext(name)[0].casefold()
    if stem not in ARTWORK and stem.rpartition("-")[2] not in ARTWORK:
        return False
    return is_sidecar(name, video_stems(_directory_stats(directory)))


def ingest_path(
    db_path: str | os.PathLike[str], location: str, path: str, *,
    declared_roots: Mapping[str, Sequence[str]],
    mounts: Mapping[str, Sequence[str | Path]] | None = None,
    windows: bool | None = None, move_from: str | None = None,
) -> IngestResult:
    """按扫描的同一口径登记一个文件。

    `path` 是数据库使用的 Windows 格式绝对路径。两条不变量与 `scan_location` 共用同一段判定，upsert
    也是同一条语句：推送发现拿到一条路径之后走的就是这里，账本里不会出现第二种
    「新文件怎么变成一行」的写法。

    文件不在就直接返回：事件到达与文件落地之间总有时间差，那不是错误；定期全量扫描
    与资源同步对账各自会处理。字幕 sidecar 的配对按定义只看同一个目录，所以只有视频
    或字幕才多列一次那个目录，别的类型连一次 `scandir` 都不发。附属文件的判定同理：
    只有叫 `poster.jpg` 这类名字、或落在 `extrafanart/` 里的图片才去列目录看有没有正片。
    所有列目录与 stat 都在打开账本连接之前做完，写事务里只有 SQL。
    """
    windows = os.name == "nt" if windows is None else windows
    ledger_path = PureWindowsPath(path)
    ledger_dir = ledger_path.parent
    name = ledger_path.name
    check_scan_target(location, str(ledger_dir), declared_roots=declared_roots)
    directory = walk_root_for(
        location, str(ledger_dir), declared_roots=declared_roots,
        mounts=mounts or {}, windows=windows)
    from . import media_io
    try:
        stat = media_io.file_stat(directory / name)
    except OSError:
        return IngestResult(location, str(ledger_path), False)
    library_roots = tuple(chain.from_iterable(declared_roots.values()))
    if _sidecar_on_disk(name, directory, ledger_path=str(ledger_path), library_roots=library_roots):
        return IngestResult(location, str(ledger_path), True, stat.st_size, sidecar=True)
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    mtime = time.strftime("%Y-%m-%d", time.localtime(stat.st_mtime))
    medium = medium_of(name)
    tracks = 0
    # 列目录在开连接之前做完：写事务从 upsert 开始一直持有写锁，网盘挂载卡住的那几十秒
    # 不能落在锁里，否则同一账本的其他写入者全部跟着超时。
    here = None
    if medium == "video" or subtitles.subtitle_format(name):
        here = _directory_stats(directory)
    connection = _open_ledger(db_path)
    try:
        registered, conflicts = _registered_paths(connection, location, str(ledger_dir))
        if str(ledger_path).casefold() in conflicts:
            raise conflicts[str(ledger_path).casefold()]
        from .file_identity import FileIdentityIndex
        from .smb_media import SmbResource
        identities = FileIdentityIndex(db_path) if location == 'local' and not isinstance(directory, SmbResource) else None
        if identities is not None:
            previous = None
            if move_from:
                old = PureWindowsPath(move_from)
                check_scan_target(location, str(old.parent), declared_roots=declared_roots)
                old_directory = walk_root_for(location, str(old.parent), declared_roots=declared_roots,
                                              mounts=mounts or {}, windows=windows)
                previous = (location, move_from, old_directory / old.name)
            if identities.relocate(connection, location, str(ledger_path), directory / name, stat, previous=previous):
                registered[str(ledger_path).casefold()] = str(ledger_path)
        relocated = _relocate_ingested(connection, registered, location, ledger_path, here,
                                       declared_roots=declared_roots, mounts=mounts, windows=windows)
        inserted_ids = _upsert_records(connection, [(location, str(ledger_path), name, medium,
                                     stat.st_size, mtime, now, now)], registered, conflicts)
        stored_path = registered[str(ledger_path).casefold()]
        if here is not None:
            tracks = _record_directory_subtitles(connection, location, ledger_dir, here, conflicts, now)[0]
        asset_id = connection.execute("SELECT id FROM asset WHERE location=? AND path=?",
                                     (location, stored_path)).fetchone()[0]
        new = asset_id in inserted_ids
        reattached = len(record_rehome.reattach(connection, [asset_id] if new else [], now=now))
        acquired = len(wants.reconcile(connection, [asset_id] if new else []))
        folder_rules.apply_new(connection, [asset_id] if new else [])
        if identities is not None:
            identities.observe(connection, location, stored_path, directory / name, stat)
        connection.commit()
        if identities is not None:
            identities.save()
    finally:
        connection.close()
    junk.isolate(db_path, asset_ids=[asset_id])
    from .library_new_assets import remember
    remember(db_path, inserted_ids)
    return IngestResult(location, str(ledger_path), True, stat.st_size, tracks,
                        asset_id=asset_id, new=new, reattached=reattached, acquired=acquired,
                        relocated=relocated)


@dataclass(frozen=True)
class ScanResult:
    location: str
    root: str
    files: int
    total_bytes: int
    seconds: float
    #: 该来源里本次没扫到的行数（`last_seen` 落后于本次）。
    gone: int
    #: 本次登记的字幕 sidecar 条数，其中配不到视频的那部分。
    subtitles: int = 0
    orphan_subtitles: int = 0
    #: 认作附属文件、没有登记的条数（`is_sidecar`）。
    sidecars: int = 0
    #: 本次新建的行；探完时长之后 `record_rehome.reattach_in` 拿它们再判一轮。
    new_ids: tuple[int, ...] = ()
    #: 本次接回了几条已消失作品的个人记录。
    reattached: int = 0
    #: 本次让几条「想要」标了已入库。
    acquired: int = 0
    junk_isolated: int = 0
    junk_review: int = 0
    path_conflicts: int = 0
    #: 登记前按番号改指到新文件的旧行（`record_rehome.CodeRelocator`）；不在 `new_ids` 里，增量探测要并进来。
    relocated_ids: tuple[int, ...] = ()

    def summary(self) -> str:
        """命令行打印的一行摘要，跟本机语言（`labels.scan.summary`）。"""
        return interface_text.text("server:labels.scan.summary", {
            "location": self.location, "files": f"{self.files:,}", "size": f"{self.total_bytes / 1024 ** 4:.2f}",
            "seconds": f"{self.seconds:.0f}", "sidecars": f"{self.sidecars:,}", "gone": f"{self.gone:,}",
            "subtitles": f"{self.subtitles:,}", "orphans": f"{self.orphan_subtitles:,}",
            "junk": f"{self.junk_isolated:,}", "junkReview": f"{self.junk_review:,}",
            "conflicts": f"{self.path_conflicts:,}"}, interface_text.local_language())


def _walk(top: Path, pending: list[str] | None = None, *, onerror=lambda error: None, read_directory=None):
    """自顶向下遍历，每个目录给出它里面的非目录条目（`os.DirEntry`）。

    与 `os.walk` 的差别只在一处：条目的大小与时间从 `DirEntry.stat()` 拿。Windows 的目录
    列表自带这两项，不必再对每个文件发一次 `os.stat`——网盘挂载上那一次就是一趟往返，
    几万个文件就是几万趟。读不了的子目录跳过，根目录本身列不出来时报 `ScanRootUnreadable`；
    符号链接指向的目录列出但不进入。
    """
    if system_path(str(top)):
        return
    from .smb_media import SmbResource
    if isinstance(top, SmbResource):
        yield from _walk_smb(top, pending, onerror)
        return
    stack = pending if pending is not None else [os.fspath(top)]
    while stack:
        checkpoint('scan')
        directory = stack.pop()
        if system_path(directory):
            continue
        try:
            if read_directory is not None:
                entries = read_directory(directory)
            else:
                with os.scandir(directory) as scanner:
                    entries = list(scanner)
        except OSError as error:
            if directory == os.fspath(top):
                raise ScanRootUnreadable(directory, error) from error
            onerror(error)
            continue
        files = []
        subdirectories = []
        for entry in entries:
            try:
                is_dir = entry.is_dir()
            except OSError:
                is_dir = False
            if is_dir:
                try:
                    if not entry.is_symlink() and not system_directory(entry.name):
                        subdirectories.append(entry.path)
                except OSError:
                    pass
            else:
                files.append(entry)
        # 倒着压栈，弹出来就是字典序，进度行读起来和目录里看到的一致。
        queued = set(stack)
        stack.extend(path for path in sorted(subdirectories, reverse=True) if path not in queued)
        yield directory, sorted(files, key=lambda entry: entry.name)


def _relative_directory(directory, top):
    from .smb_media import SmbResource
    return (PureWindowsPath(str(directory)).relative_to(PureWindowsPath(str(top))).parts
            if isinstance(top, SmbResource) else Path(directory).relative_to(top).parts)


def _walk_smb(top, pending, onerror):
    """SMB 版 `_walk`：整趟遍历共用一条连接。

    逐目录新建连接时，TCP 握手、会话认证与挂载共享的开销远大于列目录本身。
    连接断开或请求超时就换一条新连接重试一次；单个路径不存在或无权访问不影响连接，照常跳过。
    """
    from types import SimpleNamespace
    from .smb_transport import PATH_ERRNOS
    stack = pending if pending is not None else [str(top)]
    transport = top._transport()
    try:
        while stack:
            checkpoint('scan')
            directory = stack.pop()
            if system_path(directory):
                continue
            resource = top.joinpath(*_relative_directory(directory, top))
            try:
                try:
                    entries = resource.scandir(transport)
                except OSError as error:
                    if error.errno in PATH_ERRNOS:
                        raise
                    transport.close()
                    transport = top._transport()
                    entries = resource.scandir(transport)
            except OSError as error:
                if directory == str(top):
                    raise ScanRootUnreadable(directory, error) from error
                onerror(error)
                continue
            files, children = [], []
            for entry in entries:
                if entry.is_symlink:
                    continue
                path = str(resource / entry.name)
                if entry.is_dir:
                    if not system_directory(entry.name):
                        children.append(path)
                else:
                    stat = SimpleNamespace(st_size=entry.size, st_mtime=entry.mtime, st_mtime_ns=entry.mtime_ns)
                    files.append(SimpleNamespace(name=entry.name, path=path, stat=lambda value=stat: value))
            stack.extend(path for path in sorted(children, reverse=True) if path not in stack)
            yield directory, sorted(files, key=lambda entry: entry.name)
    finally:
        transport.close()


class _ScanProgress:
    """结构化扫描进度按时间节流，首项与最终汇总始终报告。"""
    def __init__(self, callback):
        self.callback = callback
        self.reported_at = 0.0

    def __call__(self, files, total_bytes, *, force=False):
        now = time.monotonic()
        if force or files == 1 or now - self.reported_at >= 0.5:
            self.callback(files, total_bytes)
            self.reported_at = now


def scan_location(db_path, location, root, **kwargs) -> ScanResult:
    """命令行按来源与根目录保存断点，组合任务可提供自己的持久检查点。"""
    if system_path(root):
        check_scan_target(location, root, declared_roots=kwargs['declared_roots'])
        result = ScanResult(location, root, 0, 0, 0, 0)
        kwargs.get('progress', lambda files, total: None)(0, 0)
        kwargs.get('report', print)(result.summary())
        return result
    if 'save_checkpoint' in kwargs or 'resume_state' in kwargs:
        return _scan_location(db_path, location, root, **kwargs)
    from .update_tasks import state_for
    mapped = walk_root_for(location, root, declared_roots=kwargs['declared_roots'],
                           mounts=kwargs.get('mounts') or {}, windows=kwargs.get('windows'))
    key = hashlib.sha256(f'{location}:{PureWindowsPath(root)}:{mapped}'.casefold().encode()).hexdigest()
    path = state_for(Path(db_path)).parent / 'scan-checkpoints' / f'{key}.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path) + '.lock', timeout=0):
        previous = json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {}
        result = _scan_location(db_path, location, root, **kwargs, resume_state=previous,
            save_checkpoint=lambda state: atomic_write_text(path, json.dumps(state, ensure_ascii=False)))
        path.unlink(missing_ok=True)
        return result


def _pending_directories(previous, walk_root):
    """恢复目录栈，并核对本机挂载仍属于当前扫描根。"""
    pending = list(previous.get('pending', [str(walk_root)]))
    if previous.get('current_directory'):
        pending.append(previous['current_directory'])
    from .smb_media import SmbResource
    if isinstance(walk_root, SmbResource):
        for value in pending:
            _relative_directory(value, walk_root)
        return pending
    if any(not Path(value).is_relative_to(walk_root) for value in pending):
        raise ScanTargetError('errors.scan.checkpointMismatch')
    return pending


def _scan_resume_state(walk_root, resume_state):
    """只接受来源身份匹配的断点，并还原已完成的扫描结果。"""
    from .smb_media import SmbResource
    mapping = f'{walk_root.uri}|{walk_root}' if isinstance(walk_root, SmbResource) else str(walk_root)
    previous = resume_state or {}
    if previous.get('mapping') != mapping:
        previous = {}
    result = previous.get('result')
    completed = ScanResult(**{**result, 'new_ids': tuple(result['new_ids']),
                              'relocated_ids': tuple(result.get('relocated_ids', ()))}) if result else None
    return mapping, previous, completed


def _record_directory_subtitles(connection, location, directory, here, conflicts, now):
    """只给身份唯一的文件配对字幕，断点中的目录资料遵守相同判据。"""
    sidecars = subtitles.directory_sidecars(
        directory, here, [name for name in here if medium_of(name) == 'video'])
    unambiguous = [sidecar for sidecar in sidecars if sidecar.path.casefold() not in conflicts
                   and (not sidecar.video or sidecar.video.casefold() not in conflicts)]
    return subtitles.record(connection, location, unambiguous, now)


def _follow_case_rename(connection, registered, conflicts, location, ledger_root, walk_root, ledger_path, native,
                        *, direct):
    """文件或目录只改了大小写时，把账本路径改成磁盘上的实际写法（#487）。

    账本按不区分大小写的键认旧行，区分大小写的文件系统上旧写法已经打不开。只在旧写法确实
    不存在、或与新写法是同一个文件（不区分大小写的文件系统）时改；两种写法各是一个文件时不动，
    交给 `conflicts`。身份、标签与观看记录都挂在资产 id 上，跟着走。只看本机直读的目录：
    SMB 走协议读取，没有本机路径可比。
    """
    key = ledger_path.casefold()
    stored = registered.get(key)
    if not direct or stored is None or stored == ledger_path or key in conflicts:
        return
    # 根目录前缀的写法来自设置，不是磁盘；只跟随根以下文件与目录的改名，不批量改写整库前缀。
    if not stored.startswith(str(ledger_root)):
        return
    try:
        old_native = Path(walk_root).joinpath(*PureWindowsPath(stored).relative_to(ledger_root).parts)
    except ValueError:
        return
    try:
        old = os.stat(old_native)
    except FileNotFoundError:
        old = None
    except OSError:
        return
    if old is not None and not os.path.samestat(old, os.stat(native)):
        return
    if connection.execute('UPDATE asset SET path=?, name=? WHERE location=? AND path=?',
                          (ledger_path, native.name, location, stored)).rowcount:
        registered[key] = ledger_path


def _scan_file_stat(connection, identities, registered, observations, location, ledger_path, directory, entry, *,
                    direct, relocate=lambda path: None):
    """读取本次文件快照，接回已移动的身份或同番号的旧行，并积累提交后的身份观测。"""
    stat = entry.stat()
    if identities is not None:
        native = Path(directory) / entry.name
        if direct and not stat.st_ino:
            stat = native.stat()
        if identities.relocate(connection, location, ledger_path, native, stat):
            registered[ledger_path.casefold()] = ledger_path
        observations.append((location, ledger_path, native, stat))
    if (ledger_path.casefold() not in registered and medium_of(entry.name) == "video"
            and relocate(ledger_path) is not None):
        registered[ledger_path.casefold()] = ledger_path
    return stat


def _commit_scan_records(connection, db, batch, registered, conflicts, identities, observations):
    inserted = _upsert_records(connection, batch, registered, conflicts)
    if identities is not None:
        for location, path, native, stat in observations:
            identities.observe(connection, location, registered.get(path.casefold(), path), native, stat)
    connection.commit()
    if identities is not None:
        identities.save()
    from .library_new_assets import remember
    remember(db, inserted)
    batch.clear()
    observations.clear()
    return inserted


def _commit_reopening(connection, db_path, batch, registered, conflicts, identities, observations, relocator):
    """提交当前批次，返回（之后要用的连接, 新建的行 id）。

    开写事务时打不开事务侧文件就重开连接，按原样重试这一批。只在这一批是本事务第一批写入时
    重试：之前已有未提交的写入（大小写改名、身份接回）随回滚一起丢掉，重放这一批也补不回来，
    那种情况照原样报出。
    """
    for delay in (*REOPEN_DELAYS, None):
        pending = connection.in_transaction
        known = dict(registered)
        try:
            return connection, _commit_scan_records(connection, db_path, batch, registered, conflicts,
                                                    identities, observations)
        except sqlite3.OperationalError as error:
            if delay is None or pending or not _cannot_open(error):
                # 重开过的连接调用方拿不到，在这里关掉；原连接关两次无妨。
                connection.close()
                raise
            LOGGER.warning("Scan write could not open the ledger journal (%s); reopening and retrying "
                           "%d rows in %.1fs", error, len(batch), delay)
            registered.clear()
            registered.update(known)
            connection.close()
            time.sleep(delay)
            connection = _open_ledger(db_path)
            relocator.connection = connection


def _scan_location(
    db_path: str | os.PathLike[str], location: str, root: str, *,
    declared_roots: Mapping[str, str], mounts: Mapping[str, str | Path] | None = None,
    report: Callable[[str], None] = print, windows: bool | None = None,
    progress: Callable[[int, int], None] = lambda files, total_bytes: None,
    resume_state: dict | None = None,
    save_checkpoint: Callable[[dict], None] = lambda state: None,
    read_directory=None, onerror=lambda error: None, new_only=False,
) -> ScanResult:
    """遍历 `root`（数据库中的路径格式）对应的本机目录，把文件元数据 upsert 进 `asset`。

    读不了的目录和文件直接跳过，不中断整轮：网盘挂载里零星几个条目读失败很常见，
    一个坏条目不该让几万个好条目白扫。
    """
    check_scan_target(location, root, declared_roots=declared_roots)
    walk_root = walk_root_for(
        location, root, declared_roots=declared_roots, mounts=mounts or {}, windows=windows)
    from .smb_media import SmbResource
    remote = isinstance(walk_root, SmbResource)
    path_module = ntpath if remote else os.path
    mapping, previous, completed = _scan_resume_state(walk_root, resume_state)
    if completed is not None:
        return completed
    ledger_root = PureWindowsPath(root)
    library_roots = tuple(chain.from_iterable(declared_roots.values()))
    now = previous.get('scan_time') or time.strftime("%Y-%m-%d %H:%M:%S")
    started = time.time()
    progress = _ScanProgress(progress)
    files = previous.get('files', 0)
    total = previous.get('total_bytes', 0)
    skipped = previous.get('sidecars', 0)
    tracks = previous.get('subtitles', 0)
    orphans = previous.get('orphan_subtitles', 0)
    discovered = set(previous.get('new_ids', []))
    video_dirs = set(previous.get('video_dirs', []))
    pending = _pending_directories(previous, walk_root)
    batch: list[tuple] = []
    from .library_new_assets import remember
    # 文件批次提交后保存文件名游标；同目录的配对资料随断点保留。
    def save_directory(directory=None, cursor=None, here=None):
        artwork_parents = {path_module.dirname(value) for value in [*pending, *([directory] if directory else [])]
                           if path_module.basename(value).casefold() in ARTWORK_DIRS}
        video_dirs.intersection_update(artwork_parents)
        save_checkpoint(dict(mapping=mapping, scan_time=now, pending=list(pending), files=files,
                             total_bytes=total, sidecars=skipped, subtitles=tracks,
                             orphan_subtitles=orphans, new_ids=sorted(discovered), relocated_ids=sorted(relocator.moved),
                             video_dirs=sorted(video_dirs),
                             current_directory=directory, cursor=cursor, here=dict(here or {})))
    # 写事务只在每批 upsert 到 commit 之间打开，遍历与 stat 都在两次 commit 之间，不持锁。
    connection = _open_ledger(db_path)
    try:
        registered, conflicts = _registered_paths(connection, location, root)
        from .file_identity import FileIdentityIndex
        identities = FileIdentityIndex(db_path) if location == 'local' and not remote else None
        relocator = record_rehome.CodeRelocator(connection, location, root, walk_root,
                                                moved=previous.get('relocated_ids', ()))
        observations = []
        for conflict in conflicts.values():
            onerror(conflict)
            report(str(conflict))
        for directory, entries in _walk(walk_root, pending, read_directory=read_directory, onerror=onerror):
            checkpoint('scan')
            relative = _relative_directory(directory, walk_root)
            continuing = directory == previous.get('current_directory')
            here = dict(previous.get('here') or {}) if continuing else {}
            cursor = previous.get('cursor') if continuing else None
            videos = video_stems(entry.name for entry in entries)
            if videos:
                video_dirs.add(directory)
            # 自顶向下遍历，上一层总是先于这一层出来，这时已经知道它有没有视频。
            artwork_dir = (path_module.basename(directory).casefold() in ARTWORK_DIRS
                           and path_module.dirname(directory) in video_dirs)
            for entry in entries:
                checkpoint('scan')
                name = entry.name
                if cursor is not None and name <= cursor:
                    continue
                ledger_path = str(ledger_root.joinpath(*relative, name))
                if is_sidecar(name, videos, artwork_dir=artwork_dir,
                              path=ledger_path, library_roots=library_roots):
                    skipped += 1
                    continue
                if new_only and ledger_path.casefold() in registered:
                    here[name] = (None, None)
                    continue
                _follow_case_rename(connection, registered, conflicts, location, ledger_root, walk_root,
                                    ledger_path, Path(directory) / name, direct=read_directory is None)
                try:
                    stat = _scan_file_stat(connection, identities, registered, observations, location,
                                           ledger_path, directory, entry, direct=read_directory is None,
                                           relocate=partial(relocator.relocate, video_names=partial(_video_names, entries)))
                except OSError as error:
                    onerror(error)
                    continue
                mtime = time.strftime("%Y-%m-%d", time.localtime(stat.st_mtime))
                here[name] = (stat.st_size, mtime)
                batch.append((location, ledger_path, name, medium_of(name),
                              stat.st_size, mtime, now, now))
                files += 1
                total += stat.st_size
                progress(files, total)
                if len(batch) >= BATCH_SIZE:
                    connection, inserted_ids = _commit_reopening(connection, db_path, batch, registered, conflicts,
                                                                 identities, observations, relocator)
                    discovered.update(inserted_ids)
                    save_directory(directory, name, here)
                    report(interface_text.text("server:labels.scan.progress", {
                        "seconds": f"{time.time() - started:5.0f}", "files": f"{files:,}",
                        "size": f"{total / 1024 ** 4:.2f}"}, interface_text.local_language()))
            connection, inserted_ids = _commit_reopening(connection, db_path, batch, registered, conflicts,
                                                         identities, observations, relocator)
            directory_tracks, directory_orphans = _record_directory_subtitles(
                connection, location, ledger_root.joinpath(*relative), here, conflicts, now)
            connection.commit()
            discovered.update(inserted_ids)
            remember(db_path, inserted_ids)
            tracks += directory_tracks
            orphans += directory_orphans
            save_directory()
        connection, inserted_ids = _commit_reopening(connection, db_path, batch, registered, conflicts,
                                                     identities, observations, relocator)
        discovered.update(inserted_ids)
        remember(db_path, inserted_ids)
        from .media_folders import path_predicate
        scope, parameters = path_predicate(location, root)
        new_ids = tuple(sorted(discovered))
        reattached = len(record_rehome.reattach(connection, new_ids, now=now))
        acquired = len(wants.reconcile(connection, new_ids))
        folder_rules.apply_new(connection, new_ids)
        connection.commit()
        gone = 0 if new_only else connection.execute(
            "SELECT COUNT(*) FROM asset a WHERE " + scope + " AND a.last_seen<?",
            (*parameters, now)).fetchone()[0]
    finally:
        connection.close()
    checked = junk.isolate(db_path, roots=[(location, root)], asset_ids=list(new_ids) if new_only else None)
    result = ScanResult(location, root, files, total, time.time() - started, gone,
                        tracks, orphans, skipped, new_ids, reattached, acquired,
                        checked['isolated'], checked['review'], len(conflicts), tuple(sorted(relocator.moved)))
    save_checkpoint({'mapping': mapping, 'result': asdict(result)})
    progress(files, total, force=True)
    report(result.summary())
    return result
