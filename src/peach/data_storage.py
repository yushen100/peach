"""Peach 数据目录的占用统计、缓存清理与整体迁移。

数据目录随馆藏增长：数据库与它的备份、封面头像、预览图、播放缓存，几万部片子就是几十 GB。
Windows 安装版默认把它放在 `%LOCALAPPDATA%`，也就是系统盘。设置页的「存储空间」由这里供数：

- **占用统计**：整棵目录走一遍，按类别累计字节，结果存进 `state/storage-usage.json`。
  几十 GB 的小文件要走一两分钟，所以在后台线程里跑，页面轮询。
- **清理**：只清能在本机自动重建、或者有保留规则兜底的几类：播放缓存、缩略图、旧数据库备份、
  已归档日志。预览图要重读媒体、封面头像要重新联网，只统计不清理。
- **迁移**：服务端只校验并写下请求；托盘停下服务、退出，交给助手进程（`apply`）整体搬家。
  同卷直接改名，跨卷复制后逐项核对再删原目录。账本里指向数据目录的绝对路径
  （`PATH_COLUMNS`）一起改写；默认落点与原目录各留一份 `state/data-root.txt` 指向新位置，
  开机自启与桌面图标按新位置重写。任何一步失败都退回原目录，原目录在核对通过前不动。

迁移要有托盘：停服务、退出、搬家、在新位置重新打开，这几步只有托盘做得了。安装版与源码运行
（Windows、macOS）都由托盘托管，都能迁；打包版的助手是同一个可执行文件带 `HELPER_FLAG`，
源码运行是当前解释器跑 `python -m peach.data_storage`。源码运行的默认落点是项目旁边的
`peach-data`，原位置留下的 `state/data-root.txt` 让它和显式的 `PEACH_DATA_ROOT` 都跟到新位置。
容器的数据目录是宿主机挂进来的卷，在容器里搬家等于搬出卷外，只能在宿主机改挂载；
不经托盘直接跑的服务没有人接手请求，也不能迁。
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
import json
import logging
import os
from pathlib import Path, PureWindowsPath
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from typing import Callable
import uuid

from filelock import FileLock

from . import distribution, interface_text, ledger_backups, settings_file
from .fsutil import atomic_write_text
from .user_messages import (UserFacingError, UserInterruptedError, UserOSError, UserRuntimeError, UserTimeoutError,
                            UserValueError, message_fields, nested_message)

USAGE_NAME = "storage-usage.json"
REQUEST_NAME = "data-relocation-request.json"
RESULT_NAME = "data-relocation.json"
RELOCATION_PROOF = ".peach-relocation-id"
PATHS_REWRITTEN = ":rewritten"
LOGGER = logging.getLogger(__name__)
#: 托盘拉起迁移助手用的参数，`scripts/build_app_entry.py` 按它分发。
HELPER_FLAG = "--relocate-data"
#: 请求写下后托盘要在这段时间里接手，过期的请求作废，避免几天后重启时突然搬家。
REQUEST_TTL = 120
#: 跨卷迁移时目标磁盘至少要多出的余量：迁移期间日志、锁文件和数据库日志还会再写一些。
SPACE_MARGIN = 1 << 30
#: 统计时多久报一次走到哪了，秒。页面 1.5 秒问一次，比这更密没有读者。
REPORT_INTERVAL = 0.5
#: 源码运行的项目根目录（`src/peach/` 往上两级）。
PROJECT_ROOT = Path(__file__).resolve().parents[2]
#: 账本里保存数据目录内绝对路径的列。迁移后按新位置改写，其余路径都由目录键现算。
PATH_COLUMNS = (("asset", "snapshot_path"), ("follow_item", "evidence_path"))
#: 整片转码缓存；同目录的 `.mp4hdr` 是重建的文件头，生成要重扫原片，不在清理范围。
_TRANSCODE = re.compile(r"^\d+-.+\.mp4$")
_ROTATED_LOG = re.compile(r"^(?:.+\.until-\d{8}\.log|crash-\d+\.log)$")
#: 账本目录里归「数据库备份」的文件：`ledger.pre-*.db` 和它的 `-wal`／`-shm`。
_BACKUP_FILE = re.compile(r"^ledger\.pre-.+\.db(?:-wal|-shm)?$")


def _phrase(code: str, params: dict | None = None, language: str = interface_text.SOURCE_LANGUAGE) -> str:
    """渲染一句（ADR-0159）；列表参数（每项可以是一句带 code 的话）由 `interface_text.text` 逐项渲染，
    按语言资源的列表分隔符连起来，前端 `serverLabel` 对列表也这样处理。"""
    return interface_text.text(f"server:{code}", params, language)


def _coded(code: str, params: dict | None = None, *, key: str = "message") -> dict:
    """`<key>` 放 zh-CN 原文，旁边是 `<key>_code` 与 `<key>_params`。"""
    return {key: _phrase(code, params), f"{key}_code": code, f"{key}_params": dict(params or {})}


def backup_directories(config) -> tuple[Path, ...]:
    """一份 Peach 数据目录里放账本备份的全部目录：账本目录在前。"""
    return (config.directory("database"), ledger_backups.organize_dir(config.directory("generated")))


@dataclass(frozen=True)
class Category:
    """一类存储。名字、它是什么、清理后会怎样（不能清理的写为什么不能）在
    `server:storage.category.<key>` 的 `label`、`description`、`note`（ADR-0159）。"""

    key: str
    cleanable: bool = False

    def _text(self, field: str) -> str:
        return interface_text.text(f"server:storage.category.{self.key}.{field}")

    @property
    def label(self) -> str:
        return self._text("label")

    @property
    def description(self) -> str:
        return self._text("description")

    @property
    def note(self) -> str:
        return self._text("note")


#: 缩略图与预览图名字相近，区别在来源：缩略图由已下载的封面、头像缩小而来，本机随时能重算；
#: 预览图从视频抽帧，重建要重新读取整部影片。
CATEGORIES = tuple(Category(key, cleanable) for key, cleanable in (
    ("database", False), ("backups", True), ("playback", True), ("thumbnails", True), ("previews", False),
    ("downloads", False), ("sources", False), ("records", False), ("tools", False), ("accounts", False),
    ("logs", True), ("other", False),
))
CATEGORY_KEYS = tuple(category.key for category in CATEGORIES)
CLEANABLE = frozenset(category.key for category in CATEGORIES if category.cleanable)


def _key(path: Path) -> str:
    return os.path.normcase(os.path.abspath(path))


def _roots(config) -> dict[str, str]:
    """数据目录下各子目录归哪一类；没有列名的按上一级归类，最外层归「其他」。"""
    from .previews import cover_thumb_root, entity_thumb_root
    generated = config.directory("generated")
    pairs = [
        (config.directory("database"), "database"),
        (generated / ledger_backups.ORGANIZE_DIRNAME, "backups"),
        (generated / "transcodes", "playback"),
        (generated / "stream-segments", "playback"),
        (cover_thumb_root(generated / "covers"), "thumbnails"),
        (entity_thumb_root(generated / "avatars"), "thumbnails"),
        (generated / "snapshots", "previews"),
        (generated / "posters", "previews"),
        (generated / "timeline", "previews"),
        (generated / "photo-thumbs", "previews"),
        (generated / "covers", "downloads"),
        (generated / "avatars", "downloads"),
        (generated / "logos", "downloads"),
        (generated / "follow-assets", "downloads"),
        (generated / "sample-cache", "downloads"),
        (generated / "provider-cache", "downloads"),
        (config.directory("sources"), "sources"),
        (config.directory("state"), "records"),
        (config.directory("review"), "records"),
        (config.data_root / "archive", "records"),
        (config.directory("tools"), "tools"),
        (config.directory("secrets"), "accounts"),
        (config.directory("logs"), "logs"),
    ]
    return {_key(path.resolve()): category for path, category in pairs}


def _reclaimable(category: str, path: Path, parent_name: str) -> bool:
    if category == "playback":
        return parent_name != "transcodes" or bool(_TRANSCODE.match(path.name))
    if category == "thumbnails":
        return True
    if category == "logs":
        return bool(_ROTATED_LOG.match(path.name))
    return False


def measure(config, *, should_stop: Callable[[], bool] = lambda: False,
            report: Callable[[int, int], None] | None = None) -> dict:
    """走一遍数据目录，按类别统计文件数、字节与可清理字节。链接不跟随。

    `report(文件数, 字节)` 报告走到哪了，最多每 `REPORT_INTERVAL` 秒一次。
    """
    root = config.data_root
    roots = _roots(config)
    database = _key(config.directory("database").resolve())
    totals = {key: {"bytes": 0, "files": 0, "reclaimable": 0} for key in CATEGORY_KEYS}
    from . import storage_budget
    policy = storage_budget.load_policy(config)
    config.directory('state').mkdir(parents=True, exist_ok=True)
    binding = storage_budget.layout(config, policy)
    stack = [(path, roots.get(_key(path), 'other')) for path in storage_budget.data_roots(config)]
    files = size_seen = 0
    allocated = 0
    allocated_files = set()
    allocated_error = ''
    reported = time.monotonic()
    while stack:
        if should_stop():
            raise UserInterruptedError("errors.dataStorage.measureStopped")
        if report is not None and time.monotonic() - reported >= REPORT_INTERVAL:
            reported = time.monotonic()
            report(files, size_seen)
        folder, inherited = stack.pop()
        try:
            entries = list(os.scandir(folder))
        except FileNotFoundError:
            continue
        except OSError as error:
            allocated_error = str(error)
            continue
        in_database = _key(folder) == database
        for entry in entries:
            try:
                if entry.is_symlink() or Path(entry.path).is_junction():
                    continue
                if entry.is_dir(follow_symlinks=False):
                    stack.append((Path(entry.path), roots.get(_key(Path(entry.path)), inherited)))
                    continue
                info = storage_budget.file_stat(entry)
                size = info.st_size
            except OSError as error:
                allocated_error = str(error)
                continue
            category = inherited
            if in_database and _BACKUP_FILE.match(entry.name):
                category = "backups"
            bucket = totals[category]
            bucket["bytes"] += size
            bucket["files"] += 1
            files += 1
            size_seen += size
            try:
                if storage_budget.count_file(info, allocated_files):
                    allocated += storage_budget.allocated_bytes(Path(entry.path), info)
            except OSError as error:
                allocated_error = str(error)
            if _reclaimable(category, Path(entry.path), Path(folder).name):
                bucket["reclaimable"] += size
    live = config.directory("database") / "ledger.db"
    totals["backups"]["reclaimable"] = sum(
        _backup_plan(live, directory).removable_bytes
        for directory in backup_directories(config))
    try:
        capacity = {**storage_budget.cache_usage(config), 'capacity_error': ''}
    except (OSError, ValueError) as error:
        capacity = {'managed_cache_bytes': None, 'external_cache_bytes': None, 'capacity_error': str(error)}
    if storage_budget.layout(config, policy) != binding:
        raise UserOSError("errors.dataStorage.layoutChanged")
    storage_budget.record_history(config, data_bytes=allocated if not allocated_error else None,
                                  cache_bytes=capacity['managed_cache_bytes'])
    return {
        "root": str(root.resolve()), "layout": binding,
        "measured_at": time.time(),
        "total_bytes": sum(item["bytes"] for item in totals.values()),
        "total_files": sum(item["files"] for item in totals.values()),
        "allocated_bytes": allocated if not allocated_error else None,
        "allocation_error": allocated_error,
        "categories": totals,
        **capacity,
    }


def _backup_plan(live: Path, directory: Path, *, apply: bool = False) -> ledger_backups.BackupPlan:
    """手动清理每处只留最近一份，不看备份年龄；当前账本校验不过时一份都不删。"""
    return ledger_backups.prune(live, apply=apply, keep_recent=1, min_age=timedelta(0), directory=directory)


def _remove(path: Path, *, allocations: list[int | None] | None = None) -> tuple[int, int, int]:
    """删一个文件或整个目录，返回 (删掉的文件数, 字节, 删不掉的文件数)。"""
    removed = size = failed = 0
    if path.is_symlink() or path.is_junction():
        return 0, 0, 0
    if path.is_dir() and not path.is_symlink():
        folders = []
        for folder, dirs, files in os.walk(path):
            dirs[:] = [name for name in dirs if not (Path(folder) / name).is_symlink()
                       and not (Path(folder) / name).is_junction()]
            folders.append(Path(folder))
            for name in files:
                file = Path(folder) / name
                if file.is_symlink():
                    continue
                try:
                    info = file.stat()
                    length = info.st_size
                    allocated = _clean_allocation(file, info) if allocations is not None else None
                    file.unlink()
                except OSError:
                    failed += 1
                    continue
                removed += 1
                size += length
                if allocations is not None:
                    allocations.append(allocated)
        for folder in reversed(folders):
            try:
                folder.rmdir()
            except OSError:
                pass
        return removed, size, failed
    try:
        info = path.stat()
        length = info.st_size
        allocated = _clean_allocation(path, info) if allocations is not None else None
        path.unlink()
    except OSError:
        return 0, 0, 1
    if allocations is not None:
        allocations.append(allocated)
    return 1, length, 0


def _clean_allocation(path, info):
    from .storage_budget import allocated_bytes
    try:
        return allocated_bytes(path, info) if info.st_nlink == 1 else 0
    except OSError:
        return None


def clean(config, category: str) -> dict:
    """清理一类可重建的产物，返回删掉的文件数、字节和删不掉的数量。"""
    if category not in CLEANABLE:
        raise UserValueError("errors.dataStorage.categoryNotCleanable")
    generated = config.directory("generated")
    targets: list[Path] = []
    if category == "backups":
        live = config.directory("database") / "ledger.db"
        removed = size = 0
        for directory in backup_directories(config):
            decided = _backup_plan(live, directory, apply=True)
            if decided.refused:
                raise UserValueError("errors.dataStorage.backupNotCleaned", {"reason": decided.refused})
            removed += len(decided.remove) + len(decided.orphans)
            size += decided.removable_bytes
        if removed:
            from .storage_budget import invalidate_measurements
            invalidate_measurements(config)
        return {"files": removed, "bytes": size, "failed": 0}
    if category == "playback":
        transcodes, segments = generated / "transcodes", generated / "stream-segments"
        if transcodes.is_dir():
            targets += [path for path in transcodes.iterdir() if path.is_file() and _TRANSCODE.match(path.name)]
        if segments.is_dir():
            targets += list(segments.iterdir())
    elif category == "thumbnails":
        from .previews import cover_thumb_root, entity_thumb_root
        for folder in (cover_thumb_root(generated / "covers"), entity_thumb_root(generated / "avatars")):
            if folder.is_dir():
                targets += list(folder.iterdir())
    elif category == "logs":
        logs = config.directory("logs")
        if logs.is_dir():
            targets += [path for path in logs.iterdir() if path.is_file() and _ROTATED_LOG.match(path.name)]
    totals = [0, 0, 0]
    allocations = [] if category in {'playback', 'thumbnails'} else None
    for target in targets:
        for index, value in enumerate(_remove(target, allocations=allocations)):
            totals[index] += value
    if allocations and all(amount is not None for amount in allocations):
        from .storage_budget import record_history
        record_history(config, data_bytes=None, cache_bytes=None, cleaned_bytes=sum(allocations))
    if totals[0]:
        from .storage_budget import invalidate_measurements
        invalidate_measurements(config)
    return {"files": totals[0], "bytes": totals[1], "failed": totals[2]}


def read_usage(config) -> dict | None:
    """只显示当前目录及挂载身份的统计，迁移前或无身份的旧读数失效。"""
    from . import storage_budget
    try:
        data = json.loads((config.directory("state") / USAGE_NAME).read_text(encoding="utf-8"))
        current = storage_budget.layout(config, storage_budget.load_policy(config))
    except (OSError, ValueError):
        return None
    if (not isinstance(data, dict) or data.get("root") != str(config.data_root.resolve())
            or data.get('layout') != current):
        return None
    return data


class StorageJobs:
    """统计与清理共用一条后台线程：同一时间只做一件事，清理完顺手重新统计。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict = {"state": "idle", "message": ""}
        self._thread: threading.Thread | None = None

    def snapshot(self) -> dict:
        with self._lock:
            return dict(self._state)

    def busy(self) -> bool:
        with self._lock:
            return self._state["state"] != "idle"

    def start(self, config, action: str | list[str] | tuple[str, ...]) -> dict:
        """`"measure"` 是重新统计；一个或几个类别键是依次清理它们，清理完统一统计一次。"""
        keys = [] if action == "measure" else [action] if isinstance(action, str) else list(action)
        if action != "measure" and (not keys or any(key not in CLEANABLE for key in keys)):
            raise UserValueError("errors.dataStorage.categoryNotCleanable")
        keys = [key for key in CATEGORY_KEYS if key in keys]
        with self._lock:
            if self._state["state"] != "idle":
                raise UserRuntimeError("errors.dataStorage.busy")
            self._state = {"state": "cleaning" if keys else "measuring", "category": keys[0] if keys else "",
                           "categories": keys, "message": "", **self._expected(config)}
            self._thread = threading.Thread(target=self._run, args=(config, keys),
                                            name="PeachStorage", daemon=True)
            self._thread.start()
            return dict(self._state)

    @staticmethod
    def _expected(config) -> dict:
        """上次统计的文件数，这一轮的进度条按它估；没统计过就只报走过多少。"""
        usage = read_usage(config)
        return {"files": 0, "bytes": 0, "expected_files": int(usage["total_files"]) if usage else None}

    def _progress(self, files: int, size: int) -> None:
        with self._lock:
            self._state.update(files=files, bytes=size)

    def join(self, timeout: float | None = None) -> None:
        thread = self._thread
        if thread is not None:
            thread.join(timeout)

    def _run(self, config, keys: list[str]) -> None:
        # 清理回执：code 是 `labels.dataStorage.cleaned`、`cleanedInUse`，出错时再接上原因。
        done: tuple[str, dict] | None = None
        try:
            if keys:
                freed = failed = 0
                for key in keys:
                    with self._lock:
                        self._state.update(category=key)
                    result = clean(config, key)
                    freed += result["bytes"]
                    failed += result["failed"]
                params = {"labels": [{"code": f"storage.category.{item.key}.label"} for item in CATEGORIES
                                     if item.key in keys], "size": format_size(freed), "failed": failed}
                done = ("labels.dataStorage.cleanedInUse" if failed else "labels.dataStorage.cleaned", params)
                with self._lock:
                    self._state.update(state="measuring", category="", **_coded(*done), files=0, bytes=0)
            usage = measure(config, report=self._progress)
            atomic_write_text(config.directory("state") / USAGE_NAME, json.dumps(usage))
        except Exception as exc:
            if done:
                fields = _coded(done[0] + "ThenFailed", {**done[1], "error": nested_message(exc)})
            elif isinstance(exc, UserFacingError):
                fields = _coded(exc.code, exc.params)
            else:
                fields = {"message": str(exc)}
            with self._lock:
                self._state = {"state": "idle", **fields, "error": True}
            return
        with self._lock:
            self._state = {"state": "idle", **(_coded(*done) if done else {"message": ""})}


JOBS = StorageJobs()


def format_size(size: int) -> str:
    """与前端 `fmtSize` 同一套写法，回执里的数字和页面上对得上。"""
    if size <= 0:
        return "0 B"
    if size < 1 << 20:
        return f"{max(1, round(size / 1024))} KB"
    if size < 1 << 30:
        return f"{size >> 20} MB"
    if size < 1 << 40:
        return f"{size / (1 << 30):.1f} GB"
    return f"{size / (1 << 40):.2f} TB"


# --------------------------------------------------------------------------- 迁移

def blocked(config) -> str:
    """这份部署为什么不能在设置页迁移数据目录：`labels.dataStorage.relocation` 下的 code，能迁移时是空串。"""
    if os.environ.get("PEACH_DISTRIBUTION") == "docker":
        return "labels.dataStorage.relocation.docker"
    if not (distribution.standalone() or os.environ.get("PEACH_TRAY_MANAGED") == "1"
            or os.environ.get("PEACH_HEADLESS_MANAGED") == "1"):
        return "labels.dataStorage.relocation.unmanaged"
    root = config.data_root.resolve()
    for key in settings_file.DIRECTORY_KEYS:
        raw = (config.directories.get(key) or "").strip()
        directory = config.directory(key)
        if raw and (PureWindowsPath(raw).is_absolute() or Path(raw).is_absolute()):
            return "labels.dataStorage.relocation.outsideRoot"
        if directory.is_symlink() or directory.is_junction() or not directory.resolve().is_relative_to(root):
            return "labels.dataStorage.relocation.linked"
    return ""


def availability(config) -> tuple[bool, str]:
    """这份部署能不能在设置页迁移数据目录；不能时说清为什么、该怎么手动做（zh-CN 原文）。"""
    code = blocked(config)
    return not code, _phrase(code) if code else ""


#: 容器部署在宿主机上迁移数据目录的几步：每步一句说明（`labels.dataStorage.dockerStep.<id>`）加一条命令；
#: 命令里有要换成实际值的占位名时，命令本身也在语言资源里（`<id>Command`）。命令按仓库的 compose.yaml 写，
#: 数据卷名带 compose 项目名前缀，第一步先查出来。
DOCKER_STEPS = (
    ("volume", "docker volume ls"),
    ("stop", "docker compose down"),
    ("copy", None),
    ("edit", "docker compose up -d"),
)


def manual_steps() -> list[dict[str, str]]:
    """设置页不能迁移时，给出的手动步骤。目前只有容器有。"""
    if os.environ.get("PEACH_DISTRIBUTION") != "docker":
        return []
    steps = []
    for step, command in DOCKER_STEPS:
        code = f"labels.dataStorage.dockerStep.{step}"
        row = {"id": step, "text": _phrase(code), "text_code": code}
        row.update({"command": command} if command else _coded(code + "Command", key="command"))
        steps.append(row)
    return steps


def _vacant(folder: Path) -> bool:
    """空目录，或者只剩一份数据目录位置记录（迁走之后留下的那种）。"""
    entries = list(folder.iterdir())
    if not entries:
        return True
    if len(entries) != 1 or entries[0].name != "state" or not entries[0].is_dir():
        return False
    if entries[0].is_symlink() or entries[0].is_junction():
        return False
    return all(path.name == settings_file.DATA_ROOT_LOCATION for path in entries[0].iterdir())


def _existing_ancestor(path: Path) -> Path:
    for candidate in (path, *path.parents):
        if candidate.exists():
            return candidate
    return Path(path.anchor) if path.anchor else path


def _same_volume(source: Path, target: Path) -> bool:
    try:
        return os.stat(source).st_dev == os.stat(_existing_ancestor(target)).st_dev
    except OSError:
        return False


def check_target(config, raw: object, *, program: Path | None = None) -> Path:
    """校验新的数据目录位置，返回规范化后的绝对路径。不合适时抛 ValueError，原因写给人看。"""
    if not isinstance(raw, str) or not raw.strip():
        raise UserValueError("errors.dataStorage.chooseTarget")
    text = raw.strip()
    if os.name == "nt":
        pure = PureWindowsPath(text)
        if not pure.drive or not pure.root or pure.drive.startswith("\\\\"):
            raise UserValueError("errors.dataStorage.localDiskRequired")
    target = Path(text)
    if not target.is_absolute():
        raise UserValueError("errors.dataStorage.fullPathRequired")
    if target.parent == target:
        raise UserValueError("errors.dataStorage.driveRootNotAllowed")
    target = target.resolve()
    source = config.data_root.resolve()
    if target == source or target.is_relative_to(source) or source.is_relative_to(target):
        raise UserValueError("errors.dataStorage.overlapsCurrent")
    program = (program or Path(sys.executable).parent).resolve()
    if target.is_relative_to(program) or program.is_relative_to(target):
        raise UserValueError("errors.dataStorage.overlapsProgram")
    for rows in (*config.locations.values(), *config.mounts.values()):
        for value in rows:
            media = Path(value)
            if not media.is_absolute():
                continue
            media = media.resolve()
            if target.is_relative_to(media) or media.is_relative_to(target):
                raise UserValueError("errors.dataStorage.overlapsMedia")
    if target.exists():
        if not target.is_dir():
            raise UserValueError("errors.dataStorage.fileExists")
        if not _vacant(target):
            raise UserValueError("errors.dataStorage.folderNotEmpty")
    ancestor = _existing_ancestor(target)
    probe = ancestor / f".peach-write-test-{uuid.uuid4().hex}"
    try:
        probe.write_bytes(b"")
        probe.unlink()
    except OSError:
        raise UserValueError("errors.dataStorage.notWritable") from None
    return target


def check_space(source: Path, target: Path, needed: int) -> None:
    if _same_volume(source, target):
        return
    free = shutil.disk_usage(_existing_ancestor(target)).free
    if free < needed + SPACE_MARGIN:
        raise UserValueError("errors.dataStorage.notEnoughSpace",
                             {"free": format_size(free), "needed": format_size(needed + SPACE_MARGIN)})


def read_result(config) -> dict | None:
    try:
        data = json.loads((config.directory("state") / RESULT_NAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _record(root: Path, **fields) -> None:
    try:
        atomic_write_text(root / "state" / RESULT_NAME, json.dumps({**fields, "finished_at": time.time()},
                                                                  ensure_ascii=False))
    except OSError:
        pass


def request(config, raw: object) -> dict:
    """校验并写下迁移请求，由托盘接手。返回给页面的回执。"""
    if code := blocked(config):
        raise UserValueError(code)
    from . import standalone_update
    if standalone_update.public().get("state") in standalone_update.ACTIVE | {"ready"}:
        raise UserValueError("errors.dataStorage.updateRunning")
    if JOBS.busy():
        raise UserValueError("errors.dataStorage.busyBeforeMigration")
    target = check_target(config, raw)
    usage = read_usage(config)
    if usage is None:
        raise UserValueError("errors.dataStorage.measureFirst")
    source = config.data_root.resolve()
    check_space(source, target, int(usage.get("total_bytes") or 0))
    path = config.directory("state") / REQUEST_NAME
    with FileLock(str(path) + ".lock", timeout=0):
        atomic_write_text(path, json.dumps({"source": str(source), "target": str(target),
                                            "requested_at": time.time()}, ensure_ascii=False))
    headless = os.environ.get("PEACH_HEADLESS_MANAGED") == "1"
    return {"accepted": True, "target": str(target),
            **message_fields("labels.dataStorage.relocatingHeadless" if headless else "labels.dataStorage.relocating")}


def snapshot(config) -> dict:
    """设置页「存储空间」一屏的数据。"""
    from . import storage_budget
    root = config.data_root.resolve()
    try:
        disk = shutil.disk_usage(root)
        free, total = disk.free, disk.total
    except OSError:
        free = total = None
    drive = PureWindowsPath(str(root)).drive.casefold()
    system = os.environ.get("SystemDrive", "C:").casefold()
    reason = blocked(config)
    usage = read_usage(config)
    categories = None
    if usage is not None:
        found = usage.get("categories") or {}
        categories = [{"key": item.key, "label": item.label, "description": item.description, "note": item.note,
                       "cleanable": item.cleanable, **(found.get(item.key) or {"bytes": 0, "files": 0, "reclaimable": 0})}
                      for item in CATEGORIES]
    return {
        "data_root": str(root),
        "free_bytes": free, "total_bytes": total,
        "system_drive": os.name == "nt" and bool(drive) and drive == system,
        "budget": storage_budget.snapshot(config, usage=usage),
        "usage": None if usage is None else {
            "measured_at": usage.get("measured_at"), "total_bytes": usage.get("total_bytes", 0),
            "total_files": usage.get("total_files", 0), "categories": categories,
            "allocated_bytes": usage.get('allocated_bytes'),
            "capacity_error": usage.get('allocation_error') or usage.get('capacity_error') or '',
            "managed_cache_bytes": usage.get('managed_cache_bytes'),
            "external_cache_bytes": usage.get('external_cache_bytes')},
        "job": JOBS.snapshot(),
        "relocation": {"available": not reason, **(_coded(reason) if reason else {"message": ""}),
                       "steps": manual_steps(),
                       "last": read_result(config)},
    }


def poll(tray) -> None:
    """托盘监视循环里看一眼有没有迁移请求；有就停服务、交给助手、自己退出。"""
    try:
        config = settings_file.load_config()
    except Exception:
        # 首次设置没走完或设置文件坏了：这时不会有迁移请求，监视循环照常往下走。
        return
    path = config.directory("state") / REQUEST_NAME
    if not path.is_file() or not tray._action_lock.acquire(blocking=False):
        return
    from . import update_tasks
    database = config.directory("database") / "ledger.db"
    token = None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if time.time() - data["requested_at"] > REQUEST_TTL:
            path.unlink()
            return
        if data["source"] != str(config.data_root.resolve()):
            raise UserValueError("errors.dataStorage.sourceChanged")
        check_target(config, data["target"])
        token = update_tasks.reserve(database)
        update_tasks.wait_quiescent(database)
        atomic_write_text(path, json.dumps(dict(data, token=token), ensure_ascii=False))
        process = _spawn([*_program_command(), *_helper_arguments(path, os.getpid())])
        update_tasks.transfer(database, token, process.pid)
        _notify(tray, "labels.dataStorage.relocating")
        tray.exit(reason="data-relocation")
    except Exception as exc:
        if token:
            update_tasks.release(database, token)
        path.unlink(missing_ok=True)
        _record(config.data_root, state="error", **_coded("labels.dataStorage.startFailed", {"error": nested_message(exc)}))
        _notify(tray, "labels.dataStorage.notRelocated", {"error": nested_message(exc)})
    finally:
        tray._action_lock.release()


def poll_headless(stop: Callable[[], None], restart: Callable[[dict[str, str]], None]) -> bool:
    """无桌面服务的看守进程每轮看一眼迁移请求；有就停掉网页服务，在本进程里搬家，再拉起服务。

    看守进程自己不开数据目录里的文件，不必像托盘那样退出再交给助手。`restart(环境)` 在新位置
    （失败时是原位置）重新启动网页服务，环境里的 `PEACH_DATA_ROOT` 就是那个位置。返回是否处理了请求。
    """
    try:
        config = settings_file.load_config()
    except Exception:
        return False
    path = config.directory("state") / REQUEST_NAME
    if not path.is_file():
        return False
    from . import update_tasks
    database = config.directory("database") / "ledger.db"
    token = None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if time.time() - data["requested_at"] > REQUEST_TTL:
            path.unlink()
            return False
        if data["source"] != str(config.data_root.resolve()):
            raise UserValueError("errors.dataStorage.sourceChanged")
        check_target(config, data["target"])
        token = update_tasks.reserve(database)
        update_tasks.wait_quiescent(database)
        atomic_write_text(path, json.dumps(dict(data, token=token), ensure_ascii=False))
    except Exception as exc:
        if token:
            update_tasks.release(database, token)
        path.unlink(missing_ok=True)
        _record(config.data_root, state="error", **_coded("labels.dataStorage.startFailed", {"error": nested_message(exc)}))
        return True
    stop()
    apply(path, None, start=lambda _program, environment: restart(environment))
    return True


def _notify(tray, code: str, params: dict | None = None) -> None:
    """托盘气泡只是顺带告知，跟本机语言；有的平台不支持，不能让它打断迁移流程。"""
    try:
        tray.icon.notify(_phrase(code, params, interface_text.local_language()), "Peach")
    except Exception:
        pass


def _packaged() -> bool:
    """打包出来的 Peach（安装版，或源码检出里构建的 `dist/Peach`）：助手与托盘都是同一个可执行文件。"""
    return bool(getattr(sys, "frozen", False)) or distribution.standalone()


def _program_command() -> list[str]:
    """跑助手用的程序：打包版是可执行文件本身，源码运行是当前解释器跑这个模块。"""
    if _packaged():
        executable = Path(sys.executable).resolve()
        return [str(executable.parent / "Peach.exe" if sys.platform == "win32" else executable)]
    return [sys.executable, "-m", "peach.data_storage"]


def _helper_arguments(request_path: Path, wait_pid: int) -> list[str]:
    return [HELPER_FLAG, str(request_path), str(wait_pid)]


def _tray_command() -> list[str]:
    """迁移完成后重新打开托盘的命令。源码运行优先用虚拟环境里的 `peach-tray` 入口。"""
    if _packaged():
        return _program_command()
    script = Path(sys.executable).with_name("peach-tray.exe" if os.name == "nt" else "peach-tray")
    if script.is_file():
        return [str(script)]
    return [sys.executable, "-c", "from peach.error_reporting import tray_main; raise SystemExit(tray_main())"]


def _spawn(command: list[str], environment: dict[str, str] | None = None):
    """在托盘之外起一个进程，托盘退出时不能把它一起带走。

    打包版照原样起；源码运行在 Windows 上由虚拟环境启动器托着，启动器的 kill-on-close Job
    会在托盘退出时把子进程一并结束，所以改由桌面进程承接；macOS 开新会话脱离托盘。
    """
    environment = dict(os.environ if environment is None else environment, PYINSTALLER_RESET_ENVIRONMENT="1")
    # 工作目录不能落在要搬走的数据目录里：源码运行固定用项目根目录。
    cwd = Path(command[0]).parent if _packaged() else PROJECT_ROOT
    if sys.platform == "win32" and not _packaged():
        from .tray_detached import launch_detached
        return launch_detached(command, cwd=cwd, env=environment)
    if sys.platform == "win32":
        return subprocess.Popen(command, cwd=str(cwd), env=environment, creationflags=subprocess.CREATE_NO_WINDOW)
    return subprocess.Popen(command, cwd=str(cwd), env=environment, start_new_session=True,
                            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def count_files(root: Path) -> tuple[int, int]:
    """(文件数, 总字节)，链接不跟随；迁移前后各量一次，两边相等才算复制完整。"""
    files = size = 0
    stack = [root]
    while stack:
        for entry in os.scandir(stack.pop()):
            if entry.is_dir(follow_symlinks=False):
                stack.append(Path(entry.path))
            else:
                files += 1
                size += entry.stat(follow_symlinks=False).st_size
    return files, size


def _shell_copy(source: Path, target: Path) -> None:
    """用资源管理器的复制（`SHFileOperationW`）：自带进度、剩余时间与取消按钮。"""
    import ctypes
    from ctypes import wintypes

    class Operation(ctypes.Structure):
        _fields_ = [("hwnd", wintypes.HWND), ("wFunc", wintypes.UINT), ("pFrom", wintypes.LPCWSTR),
                    ("pTo", wintypes.LPCWSTR), ("fFlags", ctypes.c_ushort), ("fAnyOperationsAborted", wintypes.BOOL),
                    ("hNameMappings", ctypes.c_void_p), ("lpszProgressTitle", wintypes.LPCWSTR)]

    copy, no_confirmation, simple_progress, no_confirm_mkdir, no_error_ui = 2, 0x10, 0x100, 0x200, 0x400
    operation = Operation(None, copy, str(source / "*") + "\0", str(target) + "\0",
                          no_confirmation | simple_progress | no_confirm_mkdir | no_error_ui,
                          False, None, _phrase("labels.dataStorage.copyTitle", None, interface_text.local_language()))
    code = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(operation))
    if operation.fAnyOperationsAborted:
        raise UserRuntimeError("errors.dataStorage.migrationCanceled")
    if code:
        raise UserOSError("errors.dataStorage.copyIncomplete", {"code": f"{code:X}"})


def _python_copy(source: Path, target: Path) -> None:
    shutil.copytree(source, target, symlinks=True, dirs_exist_ok=True)


def _rebase(value: str, old: Path, new: Path) -> str | None:
    normal = os.path.normpath(value)
    prefix = os.path.normcase(os.path.normpath(str(old)))
    folded = os.path.normcase(normal)
    if folded == prefix:
        return str(new)
    if not folded.startswith(prefix.rstrip(os.sep) + os.sep):
        return None
    return str(new / normal[len(prefix.rstrip(os.sep)) + 1:])


def rewrite_ledger_paths(database: Path, old: Path, new: Path) -> int:
    """把账本里指向旧数据目录的绝对路径改到新位置，返回改写的行数。"""
    if not database.is_file():
        return 0
    changed = 0
    connection = sqlite3.connect(database, timeout=30)
    try:
        with connection:
            for table, column in PATH_COLUMNS:
                columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
                if column not in columns:
                    continue
                rows = connection.execute(
                    f"SELECT rowid, {column} FROM {table} WHERE {column} IS NOT NULL AND {column} <> ''").fetchall()
                for rowid, value in rows:
                    moved = _rebase(str(value), old, new)
                    if moved is not None and moved != value:
                        connection.execute(f"UPDATE {table} SET {column}=? WHERE rowid=?", (moved, rowid))
                        changed += 1
            if connection.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise UserRuntimeError("errors.dataStorage.databaseCheckFailed")
    finally:
        connection.close()
    return changed


def _point(source: Path, target: Path, bootstrap: Path) -> None:
    """默认落点和原目录都记下新位置；新位置自己不能再指向别处，否则会成环。

    默认落点只在它就是原目录、还不存在、或只剩一份位置记录时才写：那里若是另一份在用的
    数据目录（源码检出旁边本来就有一份 `peach-data`），写进去就把它劫持到这次的新位置。
    """
    (target / "state" / settings_file.DATA_ROOT_LOCATION).unlink(missing_ok=True)
    seen = {_key(target)}
    for root in (bootstrap, source):
        if _key(root) in seen:
            continue
        seen.add(_key(root))
        if root is bootstrap and _key(root) != _key(source) and root.is_dir() and not _vacant(root):
            continue
        atomic_write_text(root / "state" / settings_file.DATA_ROOT_LOCATION, str(target))


def _rename(source: Path, target: Path, *, timeout: float = 30) -> None:
    deadline = time.monotonic() + timeout
    while True:
        try:
            os.rename(source, target)
            return
        except OSError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(.5)


class MovedWithoutRewrite(UserFacingError, RuntimeError):
    """数据已经到了新位置并记下了位置，只是账本里的路径没改写成。迁移算完成，原因要告诉人。"""


class MovedWithoutLocator(UserFacingError, RuntimeError):
    """数据已迁移，位置暂由待恢复记录指向。"""


@dataclass(frozen=True)
class Relocation:
    source: Path
    target: Path
    bootstrap: Path
    database: Path
    identity: str

    def payload(self) -> dict:
        return {"source": str(self.source), "target": str(self.target), "bootstrap": str(self.bootstrap),
                "database": str(self.database), "identity": self.identity}

    def records(self) -> tuple[Path, ...]:
        return tuple(dict.fromkeys(settings_file.relocation_record(root)
                                   for root in (self.source, self.target, self.bootstrap)))

    def lock(self) -> FileLock:
        return FileLock(self.records()[0].with_suffix(".lock"))


def _read_relocation(record: Path) -> Relocation | None:
    try:
        saved = json.loads(record.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    try:
        move = Relocation(*(Path(saved[name]) for name in ("source", "target", "bootstrap", "database")),
                          uuid.UUID(saved["identity"]).hex)
        roots = (move.source, move.target, move.bootstrap)
        if (not all(root.is_absolute() for root in roots) or move.source.is_relative_to(move.target)
                or move.target.is_relative_to(move.source) or move.database.is_absolute()
                or ".." in move.database.parts or move.database.name != "ledger.db"
                or record not in move.records()):
            raise ValueError
    except (KeyError, ValueError, TypeError, AttributeError):
        raise settings_file.SettingsFileError("errors.settingsFile.locatorInvalid",
                                              {"locator": str(record)}) from None
    return move


def _relocation_id(root: Path) -> str:
    try:
        return (root / RELOCATION_PROOF).read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def _clear_relocation(move: Relocation, root: Path) -> None:
    """先撤外部记录，最后撤随目录移动的标识；再中断时剩余入口仍能复核身份。"""
    for record in move.records():
        if _read_relocation(record) == move:
            record.unlink()
    (root / RELOCATION_PROOF).unlink(missing_ok=True)


def _point_relocated(move: Relocation, *, record_rewrite: bool) -> None:
    try:
        if record_rewrite:
            atomic_write_text(move.target / RELOCATION_PROOF, move.identity + PATHS_REWRITTEN)
        _point(move.source, move.target, move.bootstrap)
        _clear_relocation(move, move.target)
    except OSError as exc:
        raise MovedWithoutLocator("errors.settingsFile.locatorUnreadable", {
            "locator": str(exc.filename or move.source / "state" / settings_file.DATA_ROOT_LOCATION),
            "error": nested_message(exc),
        }) from exc


def recover_relocation(root: Path, record: Path) -> Path:
    """启动时核对迁移标识，按同卷改名的实际结果接回已确认的目录。"""
    root = root.resolve()
    try:
        move = _read_relocation(record)
        if move is None:
            return root
        with move.lock():
            if _read_relocation(record) != move:
                return root
            if (root == move.bootstrap and root not in (move.source, move.target)
                    and root.is_dir() and not _vacant(root)):
                return root
            original = _relocation_id(move.source) == move.identity
            target_id = _relocation_id(move.target)
            rewritten = target_id == move.identity + PATHS_REWRITTEN
            relocated = target_id == move.identity or rewritten
            if original == relocated or (relocated and move.source.is_dir() and not _vacant(move.source)):
                raise settings_file.SettingsFileError("errors.settingsFile.locatorInvalid", {"locator": str(record)})
            if original:
                _clear_relocation(move, move.source)
                return move.source if root == move.target else root
            database = (move.target / move.database).resolve()
            if not database.is_relative_to(move.target):
                raise settings_file.SettingsFileError("errors.settingsFile.locatorInvalid", {"locator": str(record)})
            if not rewritten:
                rewrite_ledger_paths(database, move.source, move.target)
            try:
                _point_relocated(move, record_rewrite=not rewritten)
            except MovedWithoutLocator as exc:
                LOGGER.warning("Data relocation locators could not be published: %s", exc)
            return move.target
    except (OSError, ValueError, sqlite3.Error, UserRuntimeError) as exc:
        raise settings_file.SettingsFileError("errors.settingsFile.locatorUnreadable",
                                              {"locator": str(record), "error": nested_message(exc)}) from exc


def _relocate_same_volume(move: Relocation) -> None:
    move.target.parent.mkdir(parents=True, exist_ok=True)
    with move.lock():
        atomic_write_text(move.source / RELOCATION_PROOF, move.identity)
        encoded = json.dumps(move.payload(), ensure_ascii=False)
        for record in move.records():
            atomic_write_text(record, encoded)
        _rename(move.source, move.target)
        try:
            rewrite_ledger_paths(move.target / move.database, move.source, move.target)
        except Exception as exc:
            try:
                _rename(move.target, move.source)
            except OSError:
                # 改不回去时数据仍在新位置。保留旧行为，公布位置并说明路径改写结果。
                _point_relocated(move, record_rewrite=False)
                raise MovedWithoutRewrite("errors.dataStorage.pathsNotRewritten", {"error": nested_message(exc)}) from exc
            _clear_relocation(move, move.source)
            raise
        _point_relocated(move, record_rewrite=True)


def relocate(config, target: Path, *, bootstrap: Path,
             copy: Callable[[Path, Path], None] | None = None) -> bool:
    """把整个数据目录搬到 `target` 并改写账本路径、记下位置。返回原目录是否还要删除（跨卷复制）。

    同卷在改名前保存恢复记录，跨卷复制失败时删掉新位置已复制的部分。
    """
    source = config.data_root.resolve()
    database = config.directory("database").resolve().relative_to(source) / "ledger.db"
    same_volume = _same_volume(source, target)
    if target.exists():
        # `check_target` 已确认它是空目录或只剩一份位置记录（以前从这里迁走过）。
        if (target / "state").is_dir():
            shutil.rmtree(target / "state")
        if same_volume:
            target.rmdir()
    if same_volume:
        bootstrap = bootstrap.resolve()
        if bootstrap.is_dir() and not _vacant(bootstrap):
            bootstrap = source
        _relocate_same_volume(Relocation(source, target, bootstrap, database, uuid.uuid4().hex))
        return False
    else:
        expected = count_files(source)
        # 请求时按上次统计查过一次余量；托盘退出、任务暂停之后这里按实际大小再查一次。
        check_space(source, target, expected[1])
        target.mkdir(parents=True, exist_ok=True)
        try:
            (copy or (_shell_copy if sys.platform == "win32" else _python_copy))(source, target)
            actual = count_files(target)
            if actual != expected:
                raise UserRuntimeError("errors.dataStorage.copyMismatch", {
                    "sourceFiles": expected[0], "sourceSize": format_size(expected[1]),
                    "targetFiles": actual[0], "targetSize": format_size(actual[1])})
            rewrite_ledger_paths(target / database, source, target)
        except BaseException:
            shutil.rmtree(target, ignore_errors=True)
            raise
        copied = True
    _point(source, target, bootstrap)
    return copied


def remove_source(source: Path) -> int:
    """删掉已复制走的原目录，只留 `state/data-root.txt`。返回删不掉的文件数。"""
    keep = source / "state" / settings_file.DATA_ROOT_LOCATION
    failed = 0
    for child in list(source.iterdir()):
        if child.name == "state" and child.is_dir():
            failed += sum(_remove(item)[2] for item in list(child.iterdir()) if item != keep)
        else:
            failed += _remove(child)[2]
    return failed


def _startup(config) -> dict | None:
    from . import desktop_startup
    try:
        state = desktop_startup.snapshot(config)
    except Exception:
        return None
    return state if state.get("available") else None


def _restore_startup(config, state: dict | None) -> dict | None:
    """按迁移前的开关在新位置重写开机自启与桌面图标；失败只提示（一条备注），不影响迁移结果。"""
    if not state or not (state.get("enabled") or state.get("desktop")):
        return None
    from . import desktop_startup
    try:
        desktop_startup.save(config, enabled=bool(state["enabled"]), silent=bool(state["silent"]),
                             desktop=bool(state.get("desktop")))
    except Exception as exc:
        return {"code": "labels.dataStorage.startupNotUpdated", "params": {"error": nested_message(exc)}}
    return None


def _notes(notes: list) -> dict:
    """迁移回执的备注：`notes` 是 zh-CN 原文，`note_codes` 是同序的 `{code, params}`。"""
    kept = [note for note in notes if note]
    return {"notes": [_phrase(note["code"], note["params"]) for note in kept], "note_codes": kept}


def apply(request_path: Path, wait_pid: int | None, *, environ: dict[str, str] | None = None,
          copy: Callable[[Path, Path], None] | None = None,
          start: Callable[[Path, dict[str, str]], object] | None = None,
          wait: float = 90) -> int:
    """迁移助手：等托盘退出，搬家，重新拉起托盘，再删原目录。退出码 0 成功，1 失败，2 请求无效。

    `wait_pid` 为 None 时不等任何进程：无桌面服务的看守进程已经自己停掉了网页服务。
    """
    from . import update_tasks
    from .windows_restart import process_alive
    environ = dict(os.environ if environ is None else environ)
    try:
        data = json.loads(Path(request_path).read_text(encoding="utf-8"))
        source = Path(data["source"])
        target_raw = data["target"]
    except (OSError, ValueError, KeyError, TypeError):
        return 2
    # 新位置不能和程序重叠：打包版是可执行文件所在目录，源码运行是整个项目检出。
    program = Path(sys.executable).resolve().parent if _packaged() else PROJECT_ROOT
    final, copied, notes = source, False, []
    old = startup = None
    try:
        deadline = time.monotonic() + wait
        while wait_pid is not None and process_alive(wait_pid):
            if time.monotonic() > deadline:
                raise UserTimeoutError("errors.dataStorage.trayStillRunning")
            time.sleep(.25)
        old = settings_file.load_config(environ=dict(environ, PEACH_DATA_ROOT=str(source)))
        if old.data_root.resolve() != source:
            raise UserValueError("errors.dataStorage.sourceChanged")
        target = check_target(old, target_raw, program=program)
        Path(request_path).unlink(missing_ok=True)
        if data.get("token"):
            update_tasks.release(old.directory("database") / "ledger.db", data["token"])
        startup = _startup(old)
        if startup and (startup.get("enabled") or startup.get("desktop")):
            from . import desktop_startup
            desktop_startup.save(old, enabled=False, silent=bool(startup["silent"]), desktop=False)
        bootstrap = _bootstrap(environ)
        try:
            copied = relocate(old, target, bootstrap=bootstrap, copy=copy)
        except (MovedWithoutRewrite, MovedWithoutLocator) as exc:
            notes.append({"code": exc.code, "params": exc.params})
        final = target
    except Exception as exc:
        Path(request_path).unlink(missing_ok=True)
        if old is not None:
            notes.append(_restore_startup(old, startup))
        # 备注不再拼进 `message`，页面把它们接在原因后面显示。
        _record(source, state="error", source=str(source), target=str(target_raw),
                **_coded("labels.dataStorage.notMoved", {"error": nested_message(exc)}), **_notes(notes))
        _start_tray(dict(environ, PEACH_DATA_ROOT=str(source)), start)
        return 1
    try:
        new = settings_file.load_config(environ=dict(environ, PEACH_DATA_ROOT=str(final)))
        notes.append(_restore_startup(new, startup))
    except Exception as exc:
        notes.append({"code": "labels.dataStorage.startupNotUpdated", "params": {"error": nested_message(exc)}})
    message = _coded("labels.dataStorage.moved")
    _record(final, state="done", source=str(source), target=str(final), **message, **_notes(notes), leftovers=0)
    _start_tray(dict(environ, PEACH_DATA_ROOT=str(final)), start)
    if copied:
        # 新托盘只读新位置，原目录这时才删：删几十 GB 要几分钟，不让人对着没有托盘的桌面等。
        try:
            leftovers = remove_source(source)
        except OSError:
            leftovers = -1
        if leftovers:
            notes.append({"code": "labels.dataStorage.leftovers", "params": {"path": str(source)}})
        _record(final, state="done", source=str(source), target=str(final), **message, **_notes(notes),
                leftovers=leftovers)
    return 0


def _bootstrap(environ: dict[str, str]) -> Path:
    """不看 `PEACH_DATA_ROOT` 时的默认落点：安装版是用户目录下的 `Peach/peach-data`，
    源码运行是项目旁边的 `peach-data`。"""
    return settings_file._bootstrap_data_root(environ={
        key: value for key, value in environ.items() if key != settings_file.DATA_ROOT_ENV})[0]


def _start_tray(environment: dict[str, str], start) -> None:
    environment["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
    command = _tray_command()
    if start is not None:
        start(Path(command[0]), environment)
        return
    cwd = Path(command[0]).parent if _packaged() else PROJECT_ROOT
    if sys.platform == "win32":
        from .tray_detached import launch_detached
        try:
            launch_detached(command, cwd=cwd, env=environment)
            return
        except OSError:
            pass
    _spawn(command, environment)


def helper_main(argv: list[str]) -> int:
    """源码运行的迁移助手入口（`python -m peach.data_storage`），与打包版入口做同样的准备。"""
    if len(argv) != 3 or argv[0] != HELPER_FLAG:
        return 2
    # 迁移助手不能在要搬走的数据目录里开着任何文件：崩溃日志改写到临时目录，也不发送统计。
    import tempfile
    from . import error_reporting, remote_reporting
    remote_reporting.disable_for_process()
    error_reporting.install(Path(tempfile.gettempdir()) / "Peach" / "logs")
    return apply(Path(argv[1]), int(argv[2]))


if __name__ == "__main__":
    raise SystemExit(helper_main(sys.argv[1:]))
