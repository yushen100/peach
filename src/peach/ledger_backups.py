"""账本备份的保留规则：`ledger.pre-<用途>-<时间戳>.db` 只留该留的，其余清退。

每个 `--apply` 脚本与 `peach migrate` 都在写入前留一份完整备份，每份和账本一样大
（一百多 MB）。备份的价值只在「这次写入被复核之前」，之后它就是一份没人会再读的旧账本。
三条规则任一成立就留：最近 `KEEP_RECENT` 份之内（Peach 配置里能改，存在本机的
`retention_settings`）、还没满 `MIN_AGE`、或者比当前账本更新
（正常不会出现，出现了说明有事没弄清，先别删）。三条都不成立才删，连同 `-wal`／`-shm`
一起删。当前账本 `integrity_check` 不是 `ok` 时拒绝清退任何一份：那正是要回滚的时候。

主文件已经不在的 `-wal`／`-shm` 另外扫一遍。清退按 `.db` 列举，边车只跟着主文件走，所以
主文件删掉而边车没删掉的那一刻，这几个文件就再没有人会看它们一眼：下一轮列不到，只会
一直留在账本目录里。2026-09-13 在真实数据目录数到 20 个，最早的来自 08-21。

整理（下载后整理与手动整理）的备份放在 `<generated>/organize-backups/`，由
`organize_backup` 写出并在同一处清退，只认 `ORGANIZE_PATTERN` 两种文件名。下载一波能在
一小时里整理四十个文件，按年龄保留在这里等于不设上限，所以这一类只按份数留
（`ORGANIZE_KEEP_RECENT`，`ORGANIZE_MIN_AGE` 为零）；整理进行中的那份由 `holding`
登记，同一进程里的清退都不碰它。登记不跨进程：手动脚本给 `--keep 0` 时只靠份数保护。

设置页的「立即备份」与「从备份恢复」也在这里（ADR-0138）。手动备份叫
`ledger.pre-manual-<时间>.db`，恢复前另存的当前账本叫 `ledger.pre-restore-<时间>.db`，
和自动备份同目录、同一套保留规则。恢复不换文件，而是经 SQLite Backup API 写进在用的账本，
写入前留下 `ledger.restore.json`；启动时看到它说明上次恢复没走完，由 `recover` 收拾。
"""
from __future__ import annotations

import json
import logging
import re
import shutil
import sqlite3
import threading
import time
from collections.abc import Iterator
from contextlib import closing, contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from . import interface_text
from .fsutil import atomic_write_text
from .migrations import plan as migration_plan, sqlite_backup, upgrade as migration_upgrade
from .task_stages import stage as stage_fields
from .user_messages import UserFacingError, nested_message

log = logging.getLogger(__name__)

BACKUP_PATTERN = re.compile(r"^ledger\.pre-.+\.db$")
SIDECAR_SUFFIXES = ("-wal", "-shm")
KEEP_RECENT = 5
MIN_AGE = timedelta(hours=24)

#: 设置页「立即备份」与恢复前另存当前账本的用途名，和自动备份同一套命名与保留规则。
MANUAL_PURPOSE = "manual"
RESTORE_PURPOSE = "restore"
#: 复制中的文件后缀。不合 `BACKUP_PATTERN`，列表与清退都看不见它。
PART_SUFFIX = ".part"
#: 分页复制每步的页数：4 KiB 一页时每步 16 MiB，一百多 MB 的账本十来步，进度条看得见在走。
COPY_PAGES = 4096
#: 账本目录里的恢复标记、暂存与上次恢复的结果。标记在写进账本之前落下，写完才删。
MARKER_NAME = "ledger.restore.json"
STAGING_NAME = "ledger.restore-staging.db"
RESULT_NAME = "ledger.restore-result.json"
#: 备份列表里「用途」一栏的 code；不在表里的写入前备份统称 `OTHER_PURPOSE`。名字在
#: `server:ledgerBackup.purpose.<code>`（ADR-0159），响应同时带 `purpose_code`。
OTHER_PURPOSE = "other"
PURPOSES = (MANUAL_PURPOSE, RESTORE_PURPOSE, "migrate", "schema", "upgrade", "organize", "download", "tag-management",
            "auto-landing-revert", "sar", OTHER_PURPOSE)

ORGANIZE_DIRNAME = "organize-backups"
ORGANIZE_PATTERN = re.compile(r"^ledger\.pre-(?:download|organize)-.+\.db$")
ORGANIZE_KEEP_RECENT = 5
ORGANIZE_MIN_AGE = timedelta(0)

#: 本进程里正在被一轮写入引用的备份。下载后整理与手动整理都在 Web 服务进程的线程里跑，
#: 一方清退时要看得见另一方手上的那份。
_held: set[Path] = set()
_held_lock = threading.Lock()


@dataclass(frozen=True)
class BackupPlan:
    keep: tuple[Path, ...]
    remove: tuple[Path, ...]
    refused: dict | None = None  # 不为 None 时一份都不删，这里写原因（一句带 code 的话 `{code, params}`）
    removable_bytes: int = 0     # 算计划时量好，删完文件就量不到了
    orphans: tuple[Path, ...] = ()   # 主文件已不在的 `-wal`／`-shm`，和 remove 一起删


@contextmanager
def holding(path: Path) -> Iterator[Path]:
    """登记一份正在使用的备份；登记期间本进程里的清退都把它留下。"""
    key = path.resolve()
    with _held_lock:
        _held.add(key)
    try:
        yield path
    finally:
        with _held_lock:
            _held.discard(key)


def _is_held(path: Path) -> bool:
    with _held_lock:
        return path.resolve() in _held


def organize_dir(generated_root: Path | str) -> Path:
    return Path(generated_root) / ORGANIZE_DIRNAME


@contextmanager
def organize_backup(live: Path, generated_root: Path | str, name: str) -> Iterator[Path]:
    """整理前写一份整库备份，整理期间持有它，并清退同目录里超出保留份数的旧备份。

    清退失败只记日志：少删几份旧备份不能让这次整理失败。
    """
    if not ORGANIZE_PATTERN.match(name):
        raise ValueError(f"organize backup name does not match the pattern: {name}")
    backup = organize_dir(generated_root) / name
    sqlite_backup(live, backup)
    with holding(backup):
        try:
            prune(live, apply=True, directory=backup.parent, pattern=ORGANIZE_PATTERN,
                  keep_recent=ORGANIZE_KEEP_RECENT, min_age=ORGANIZE_MIN_AGE)
        except Exception:
            log.warning("Organize backup retention cleanup failed", exc_info=True)
        yield backup


def _size_with_sidecars(path: Path) -> int:
    total = 0
    for candidate in (path, *(path.with_name(path.name + s) for s in SIDECAR_SUFFIXES)):
        try:
            total += candidate.stat().st_size
        except OSError:
            continue
    return total


def list_backups(directory: Path, pattern: re.Pattern[str] = BACKUP_PATTERN) -> list[Path]:
    """目录下所有备份，按修改时间从旧到新。"""
    if not directory.is_dir():
        return []
    found = [
        path for path in directory.iterdir()
        if path.is_file() and pattern.match(path.name)
    ]
    return sorted(found, key=lambda path: path.stat().st_mtime)


def orphan_sidecars(directory: Path, pattern: re.Pattern[str] = BACKUP_PATTERN) -> list[Path]:
    """主文件已经不在的备份边车，按名字排序。"""
    if not directory.is_dir():
        return []
    found = []
    for path in directory.iterdir():
        if not path.is_file():
            continue
        for suffix in SIDECAR_SUFFIXES:
            base = path.name.removesuffix(suffix)
            if base != path.name and pattern.match(base) and not (directory / base).is_file():
                found.append(path)
    return sorted(found)


def integrity(db: Path, *, foreign_keys: bool = False) -> str | dict:
    """`"ok"`，或者没通过的原因：SQLite `integrity_check` 的原文，或一句带 code 的话 `{code, params}`
    （打不开、外键失效、检查出错）。两种都能直接作为报错的参数。"""
    try:
        connection = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        return {"code": "labels.ledgerBackups.integrity.openFailed", "params": {"error": str(exc)}}
    try:
        result = str(connection.execute("PRAGMA integrity_check").fetchone()[0])
        if result == 'ok' and foreign_keys:
            broken = connection.execute('PRAGMA foreign_key_check').fetchall()
            if broken:
                return {"code": "labels.ledgerBackups.integrity.foreignKeys", "params": {"count": len(broken)}}
        return result
    except sqlite3.Error as exc:
        return {"code": "labels.ledgerBackups.integrity.checkFailed", "params": {"error": str(exc)}}
    finally:
        connection.close()


def _live_mtime(live: Path) -> float:
    """WAL 模式下已提交的改动先落在 `-wal`，主库文件的时间不一定动，取两者较新的。"""
    stamps = [live.stat().st_mtime]
    wal = live.with_name(live.name + "-wal")
    if wal.is_file():
        stamps.append(wal.stat().st_mtime)
    return max(stamps)


def plan(
    live: Path,
    *,
    directory: Path | None = None,
    pattern: re.Pattern[str] = BACKUP_PATTERN,
    keep_recent: int = KEEP_RECENT,
    min_age: timedelta = MIN_AGE,
    now: datetime | None = None,
) -> BackupPlan:
    """`directory` 缺省是账本所在目录；完整性检查总是针对 `live`。"""
    folder = directory if directory is not None else live.parent
    backups = list_backups(folder, pattern)
    orphans = tuple(orphan_sidecars(folder, pattern))
    if not backups and not orphans:
        return BackupPlan((), ())
    if not live.is_file():
        return BackupPlan(tuple(backups), (), {"code": "labels.ledgerBackups.refused.ledgerMissing"})
    check = integrity(live)
    if check != "ok":
        return BackupPlan(tuple(backups), (), {"code": "labels.ledgerBackups.refused.integrity",
                                               "params": {"check": check}})
    moment = now or datetime.now()
    live_mtime = _live_mtime(live)
    recent = set(backups[-keep_recent:]) if keep_recent > 0 else set()
    keep: list[Path] = []
    remove: list[Path] = []
    for backup in backups:
        mtime = backup.stat().st_mtime
        young = moment - datetime.fromtimestamp(mtime) < min_age
        if backup in recent or young or mtime > live_mtime or _is_held(backup):
            keep.append(backup)
        else:
            remove.append(backup)
    return BackupPlan(
        tuple(keep), tuple(remove), orphans=orphans,
        removable_bytes=(sum(_size_with_sidecars(path) for path in remove)
                         + sum(path.stat().st_size for path in orphans)))


def prune(
    live: Path,
    *,
    apply: bool,
    directory: Path | None = None,
    pattern: re.Pattern[str] = BACKUP_PATTERN,
    keep_recent: int = KEEP_RECENT,
    min_age: timedelta = MIN_AGE,
    now: datetime | None = None,
) -> BackupPlan:
    """算出计划；`apply` 为真且没有拒绝理由时真的删。删不掉的记日志、继续。"""
    decided = plan(live, directory=directory, pattern=pattern,
                   keep_recent=keep_recent, min_age=min_age, now=now)
    if not apply or decided.refused:
        return decided
    doomed = [target for backup in decided.remove
              for target in (backup,
                             *(backup.with_name(backup.name + s) for s in SIDECAR_SUFFIXES))]
    for target in (*doomed, *decided.orphans):
        try:
            target.unlink(missing_ok=True)
        except OSError as exc:
            log.warning("Failed to delete database backup %s: %s", target, exc)
    return decided


# ---------------------------------------------------------------------------
# 手动备份与从备份恢复（ADR-0138）


class BackupRejected(UserFacingError, ValueError):
    """这份备份或这次恢复不能做，原因写给人看；账本没有被改动。"""


def _free_name(directory: Path, purpose: str, now: datetime | None = None) -> Path:
    stamp = (now or datetime.now()).strftime("%Y%m%d-%H%M%S")
    candidate = directory / f"ledger.pre-{purpose}-{stamp}.db"
    serial = 2
    while candidate.exists() or candidate.with_name(candidate.name + PART_SUFFIX).exists():
        candidate = directory / f"ledger.pre-{purpose}-{stamp}-{serial}.db"
        serial += 1
    return candidate


def _unlink_all(path: Path) -> None:
    for target in (path, *(path.with_name(path.name + s) for s in SIDECAR_SUFFIXES)):
        target.unlink(missing_ok=True)


def _pages(progress, stage: str):
    """把 `Connection.backup` 的进度回调翻成 `progress(stage=, stage_code=, done=, total=)`；`stage` 是阶段 code。"""
    if progress is None:
        return None
    return lambda _status, remaining, total: progress(**stage_fields(stage), done=total - remaining, total=total)


def _copy(live: Path, destination: Path, progress, stage: str) -> None:
    """分页复制成一个单文件备份。

    副本带着账本的 WAL 标记，之后只读打开它做完整性检查，会在旁边留下 `-wal`／`-shm`；改成回滚日志模式，
    备份就只有一个文件。写回账本时不受影响：Backup API 保留目标库自己的日志模式。
    """
    sqlite_backup(live, destination, pages=COPY_PAGES, progress=_pages(progress, stage))
    with closing(sqlite3.connect(destination)) as connection:
        connection.execute("PRAGMA journal_mode=DELETE")


def create(live: Path, *, purpose: str = MANUAL_PURPOSE, progress=None, now: datetime | None = None,
           keep_recent: int = KEEP_RECENT) -> Path:
    """写一份整库备份：先写 `.part`，完整性检查通过才改成正式文件名，再按保留规则清退。

    `.part` 不合 `BACKUP_PATTERN`，列表与清退都看不见它；没通过检查的那份当场删掉。
    """
    if not live.is_file():
        raise BackupRejected("errors.ledgerBackups.ledgerMissing")
    target = _free_name(live.parent, purpose, now)
    part = target.with_name(target.name + PART_SUFFIX)
    try:
        _copy(live, part, progress, "backup.copyLedger")
        if progress is not None:
            progress(**stage_fields('backup.checkIntegrity'))
        check = integrity(part)
        if check != "ok":
            raise BackupRejected("errors.ledgerBackups.backupIntegrityFailed", {"check": check})
        part.replace(target)
    finally:
        _unlink_all(part)
    try:
        prune(live, apply=True, keep_recent=keep_recent)
    except Exception:
        log.warning("Ledger backup retention cleanup failed", exc_info=True)
    return target


def purpose_of(name: str) -> str:
    """`ledger.pre-<用途>-<时间>.db` 里的用途，如 `manual`、`migrate`、`alias-merge`。"""
    rest = name.removeprefix("ledger.pre-").removesuffix(".db")
    matched = re.match(r"(.+?)-\d", rest)
    return matched.group(1) if matched else rest


def describe(path: Path, location: str) -> dict:
    purpose = purpose_of(path.name)
    code = purpose if purpose in PURPOSES else OTHER_PURPOSE
    stat = path.stat()
    return {
        "id": f"{location}/{path.name}", "name": path.name,
        "bytes": stat.st_size, "modified_at": stat.st_mtime,
        "source": "manual" if purpose == MANUAL_PURPOSE else "auto",
        "purpose": interface_text.text(f"server:ledgerBackup.purpose.{code}"), "purpose_code": code,
    }


def catalog(live: Path, organize_directory: Path) -> list[dict]:
    """两处备份目录里能恢复的备份，新的在前。"""
    found = [(path, location) for location, directory, pattern in
             (("database", live.parent, BACKUP_PATTERN), ("organize", organize_directory, ORGANIZE_PATTERN))
             for path in list_backups(directory, pattern)]
    entries = []
    for path, location in found:
        try:
            entries.append(describe(path, location))
        except OSError:
            continue
    return sorted(entries, key=lambda entry: entry["modified_at"], reverse=True)


def resolve(live: Path, organize_directory: Path, ident: object) -> Path:
    """页面传回的备份 id 换成文件；只认两处目录里合规则的文件名。"""
    location, _, name = str(ident or "").partition("/")
    directory, pattern = {"database": (live.parent, BACKUP_PATTERN),
                          "organize": (organize_directory, ORGANIZE_PATTERN)}.get(location, (None, None))
    if directory is None or not pattern.match(name) or Path(name).name != name:
        raise BackupRejected("errors.ledgerBackups.chooseBackup")
    path = directory / name
    if not path.is_file():
        raise BackupRejected("errors.ledgerBackups.backupGone")
    return path


@dataclass(frozen=True)
class RestoreOutcome:
    backup: Path
    saved: Path | None      # 恢复前另存的当前账本；当前账本不存在时为 None
    migrated: tuple[str, ...] = ()


def _marker(live: Path) -> Path:
    return live.with_name(MARKER_NAME)


def _staging(live: Path) -> Path:
    return live.with_name(STAGING_NAME)


def read_result(live: Path) -> dict | None:
    """上一次恢复的结果：中断后启动时的处理，或恢复失败后的退回。成功的恢复看任务中心。"""
    try:
        data = json.loads(live.with_name(RESULT_NAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _record(live: Path, **fields) -> dict:
    data = {**fields, "finished_at": time.time()}
    try:
        atomic_write_text(live.with_name(RESULT_NAME), json.dumps(data, ensure_ascii=False))
    except OSError:
        log.warning("Failed to write the ledger restore result", exc_info=True)
    return data


def _page_size(path: Path) -> int:
    with closing(sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)) as connection:
        return int(connection.execute("PRAGMA page_size").fetchone()[0])


def _copy_into(source: Path, live: Path) -> None:
    """把 `source` 整库写进 `live`：走 SQLite Backup API，一步写完。

    写入期间 `live` 上是一个写事务，别的连接照常读到旧内容；进程中途退出时这个事务回滚，
    `live` 还是原来的账本，不会只剩半份。这是不直接换文件的原因：Windows 上服务的连接还开着，
    WAL 模式下 `-wal` 里也可能有没合进主文件的已提交内容。
    """
    src = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
    dst = sqlite3.connect(live, timeout=30)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()


def _replace_file(source: Path, live: Path) -> None:
    """当前账本坏到 SQLite 打不开时的退路：整份文件换掉，连同旧的 `-wal`／`-shm`。"""
    for suffix in SIDECAR_SUFFIXES:
        live.with_name(live.name + suffix).unlink(missing_ok=True)
    shutil.copy2(source, live.with_name(live.name + PART_SUFFIX))
    live.with_name(live.name + PART_SUFFIX).replace(live)


def _carry_operational(live: Path, saved: Path) -> None:
    """恢复后把运行记录接回来：任务历史用恢复前的，账本版本号只增不减。

    `task_run` 记的是这台机器上跑过什么、正在跑什么（包括这次恢复自己），不是馆藏数据；
    退回备份里的旧行，正在跑的这一轮就没有行可结算，旧的 `running` 行还会占着互斥键。
    `ledger_revision` 是聚合缓存的键，退回旧值后再写几次就会撞上恢复前缓存过的版本号。
    """
    connection = sqlite3.connect(live.resolve().as_uri(), uri=True, timeout=30, isolation_level=None)
    try:
        connection.execute("ATTACH DATABASE ? AS saved", (saved.resolve().as_uri() + "?mode=ro",))
        def columns(schema: str, table: str) -> list[str]:
            return [row[1] for row in connection.execute(f"PRAGMA {schema}.table_info({table})")]

        connection.execute("BEGIN IMMEDIATE")
        shared = [name for name in columns("main", "task_run") if name in set(columns("saved", "task_run"))]
        if shared:
            names = ", ".join(f'"{name}"' for name in shared)
            connection.execute("DELETE FROM main.task_run")
            connection.execute(f"INSERT INTO main.task_run ({names}) SELECT {names} FROM saved.task_run")
            connection.execute(
                "UPDATE main.download_task SET postprocess_run_id=NULL WHERE postprocess_run_id IS NOT NULL "
                "AND NOT EXISTS(SELECT 1 FROM main.task_run t WHERE t.id=postprocess_run_id "
                "AND t.task_key='download-postprocess' AND ("
                "t.mutex_key='download-ingest:'||main.download_task.id OR "
                "t.followup_key='download-postprocess:'||main.download_task.id))")
        if columns("main", "ledger_revision") and columns("saved", "ledger_revision"):
            connection.execute(
                "UPDATE main.ledger_revision SET n = max(n, coalesce((SELECT s.n FROM saved.ledger_revision s "
                "WHERE s.tbl = main.ledger_revision.tbl), 0)) + 1")
        connection.execute("COMMIT")
    except sqlite3.Error:
        if connection.in_transaction:
            connection.execute("ROLLBACK")
        raise
    finally:
        connection.close()


def restore(live: Path, backup: Path, *, migrations_dir: Path, progress=None,
            now: datetime | None = None, keep_recent: int = KEEP_RECENT) -> RestoreOutcome:
    """用 `backup` 替换当前账本。

    顺序是先查后动：备份完整性 → 复制到暂存 → 迁到当前结构 → 暂存完整性；全部通过才另存当前
    账本、留下中断标记、写进 `live`。写进之前的任何一步失败，账本都没被碰过。写进之后完整性
    不过，用另存的那份退回去。
    """
    report = progress or (lambda **_: None)
    report(**stage_fields('backup.checkIntegrity'))
    check = integrity(backup)
    if check != "ok":
        raise BackupRejected("errors.ledgerBackups.thisBackupIntegrityFailed", {"check": check})
    staging = _staging(live)
    _unlink_all(staging)
    try:
        sqlite_backup(backup, staging, pages=COPY_PAGES, progress=_pages(progress, "backup.copyBackup"))
        try:
            _, pending = migration_plan(staging, migrations_dir)
        except RuntimeError as exc:
            raise BackupRejected("errors.ledgerBackups.schemaMismatch", {"error": str(exc)}) from exc
        if pending:
            report(**stage_fields('backup.migrateBackup'))
            migration_upgrade(staging, migrations_dir)
        check = integrity(staging, foreign_keys=True)
        if check != "ok":
            raise BackupRejected("errors.ledgerBackups.migratedIntegrityFailed", {"check": check})
        healthy = live.is_file() and integrity(live) == "ok"
        if healthy and _page_size(live) != _page_size(staging):
            raise BackupRejected("errors.ledgerBackups.pageSizeMismatch")
        report(**stage_fields('backup.saveCurrent'))
        saved = None
        if live.is_file():
            saved = _free_name(live.parent, RESTORE_PURPOSE, now)
            if healthy:
                _copy(live, saved, progress, "backup.saveCurrent")
                if integrity(saved) != "ok":
                    _unlink_all(saved)
                    raise BackupRejected("errors.ledgerBackups.savedCopyIntegrityFailed")
            else:
                # 坏账本 SQLite 未必读得出来，按文件原样留一份，连同 `-wal`。
                for suffix in ("", "-wal"):
                    source = live.with_name(live.name + suffix)
                    if source.is_file():
                        shutil.copy2(source, saved.with_name(saved.name + suffix))
        marker = _marker(live)
        atomic_write_text(marker, json.dumps({
            "state": "copying", "backup": str(backup), "saved": str(saved) if saved else "",
            "started_at": time.time()}, ensure_ascii=False))
        report(**stage_fields('backup.writeLedger'))
        try:
            if healthy:
                _copy_into(staging, live)
            else:
                atomic_write_text(marker, json.dumps({
                    "state": "replacing", "backup": str(backup), "saved": str(saved) if saved else "",
                    "started_at": time.time()}, ensure_ascii=False))
                _replace_file(staging, live)
            check = integrity(live, foreign_keys=True)
            if check != "ok":
                raise BackupRejected("errors.ledgerBackups.restoredIntegrityFailed", {"check": check})
        except Exception as exc:
            settled = settle(live, reason={"code": "labels.ledgerBackups.settle.restoreIncomplete",
                                           "params": {"error": nested_message(exc)}}, state="failed")
            raise BackupRejected("errors.ledgerBackups.restoreSettled", {
                "message": {"code": settled["message_code"], "params": settled["message_params"]}}) from exc
        if healthy and saved is not None:
            try:
                _carry_operational(live, saved)
            except sqlite3.Error:
                log.warning("Failed to reattach task history and the ledger version after restore", exc_info=True)
        marker.unlink(missing_ok=True)
        live.with_name(RESULT_NAME).unlink(missing_ok=True)
    finally:
        _unlink_all(staging)
    try:
        prune(live, apply=True, keep_recent=keep_recent)
    except Exception:
        log.warning("Ledger backup retention cleanup failed", exc_info=True)
    return RestoreOutcome(backup, saved, tuple(migration.version for migration in pending))


#: 恢复中断后由启动时收拾的原因。
INTERRUPTED = {"code": "labels.ledgerBackups.settle.interrupted"}


def settle(live: Path, *, reason: dict = INTERRUPTED, state: str = "interrupted") -> dict:
    """恢复留下了标记却没走完时，把账本收拾到一个确定的状态，并记下结果。

    `reason` 是一句带 code 的话；结果的 `message` 是 zh-CN 原文，旁边带 `message_code`、`message_params`。

    启动时（服务与 `peach migrate upgrade` 打开账本之前）调用，恢复中途出错时也调用。依次：
    当前账本完整就留着它；不完整或不在了，用暂存里迁好的备份补完这次恢复；暂存也不能用，就退回
    恢复前另存的那份。绝不让账本不在的情况落到后面去——那会被当成新装、建出一个空账本。
    """
    marker = _marker(live)
    try:
        data = json.loads(marker.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    saved = Path(data["saved"]) if data.get("saved") else None
    staging = _staging(live)
    if live.is_file() and integrity(live) == "ok":
        outcome = "kept"
    elif staging.is_file() and integrity(staging) == "ok":
        _replace_file(staging, live)
        outcome = "completed"
    elif saved is not None and saved.is_file() and integrity(saved) == "ok":
        if live.is_file():
            try:
                _copy_into(saved, live)
            except sqlite3.Error:
                _replace_file(saved, live)
        else:
            shutil.copy2(saved, live)
        outcome = "rolled-back"
    else:
        outcome = "unresolved"
    code = SETTLED[outcome]
    params: dict = {"reason": reason}
    if saved is not None and outcome != "rolled-back":
        code, params = "labels.ledgerBackups.settle.savedAs", {"message": {"code": code, "params": params},
                                                                "name": saved.name}
    _unlink_all(staging)
    result = _record(live, state=state, outcome=outcome, message=interface_text.text(f"server:{code}", params),
                     message_code=code, message_params=params, backup=Path(data.get("backup") or "").name)
    marker.unlink(missing_ok=True)
    log.warning("Ledger restore marker processed: %s", outcome)
    return result


#: 收拾结果的说明，按结局分。
SETTLED = {"kept": "labels.ledgerBackups.settle.kept", "completed": "labels.ledgerBackups.settle.completed",
           "rolled-back": "labels.ledgerBackups.settle.rolledBack",
           "unresolved": "labels.ledgerBackups.settle.unresolved"}


def recover(live: Path) -> dict | None:
    """有中断标记就处理它；没有返回 None。"""
    if not _marker(live).is_file():
        return None
    return settle(live)


class LedgerBackups:
    """设置页「账本备份」：立即备份与从备份恢复各一个后台任务，都进任务中心。

    当前账本坏了时任务中心那张表也读不出来，恢复改用一个不进任务中心的任务，进度只在设置页看。
    """

    def __init__(self, config, *, runs=None, after_restore=None, migrations_dir: Path | None = None):
        from .jobs import BackgroundJob
        self.config = config
        self.live = config.directory("database") / "ledger.db"
        self.organize = organize_dir(config.directory("generated"))
        self.migrations_dir = migrations_dir
        self.after_restore = after_restore
        self.backup_job = BackgroundJob("PeachLedgerBackup", task_key="ledger-backup", runs=runs)
        self.restore_job = BackgroundJob("PeachLedgerRestore", task_key="ledger-restore", runs=runs)
        self.offline_restore = BackgroundJob("PeachLedgerRestore", task_key="ledger-restore")
        self.lock = threading.Lock()
        self._restoring = self.restore_job

    def keep_recent(self) -> int:
        from .retention_settings import backup_keep
        return backup_keep(self.config.directory("state"))

    def _busy(self) -> bool:
        return any((job.snapshot() or {}).get("status") == "running"
                   for job in (self.backup_job, self._restoring))

    def snapshot(self) -> dict:
        from .runtime_prepare import configured_ledger_writer
        writer, reason = configured_ledger_writer(self.config, language=None)
        explained = {}
        if not writer and interface_text.nested(reason):
            explained = {"writer_reason": interface_text.text(f"server:{reason['code']}", reason.get("params")),
                         "writer_reason_code": reason["code"], "writer_reason_params": reason.get("params", {})}
        elif not writer:
            explained = {"writer_reason": str(reason)}
        return {
            "backups": catalog(self.live, self.organize),
            "backup": self.backup_job.snapshot() or {"status": "idle"},
            "restore": self._restoring.snapshot() or {"status": "idle"},
            "writer": writer, "writer_reason": "", **explained,
            "last_restore": read_result(self.live),
        }

    def start_backup(self) -> dict:
        with self.lock:
            if self._busy():
                raise BackupRejected("errors.ledgerBackups.busy")
            job = self.backup_job

            def work(identity):
                path = create(self.live, progress=lambda **values: job.update(identity, **values),
                              keep_recent=self.keep_recent())
                job.update(identity, status="complete", **stage_fields('backup.backupDone'), name=path.name,
                           bytes=path.stat().st_size)

            job.start(work, restart=True, initial={**stage_fields('backup.prepareBackup'), "done": 0, "total": 0})
        return self.snapshot()

    def start_restore(self, ident: object) -> dict:
        from .health import inspect_database
        from .runtime_prepare import configured_ledger_writer
        from . import update_tasks
        writer, reason = configured_ledger_writer(self.config, language=None)
        if not writer:
            raise BackupRejected("errors.ledgerBackups.writerOnly", {"reason": reason})
        backup = resolve(self.live, self.organize, ident)
        readable = bool(inspect_database(self.live, self.migrations_dir)["readable"])
        with self.lock:
            if self._busy():
                raise BackupRejected("errors.ledgerBackups.busy")
            busy = update_tasks.running(self.live, task_rows=readable)
            if busy:
                raise BackupRejected("errors.ledgerBackups.tasksRunning", {"tasks": list(busy)})
            job = self.restore_job if readable else self.offline_restore
            self._restoring = job
            migrations_dir = self.migrations_dir

            def work(identity):
                from .config import MIGRATIONS_DIR
                token = update_tasks.reserve(self.live, busy="errors.ledgerBackups.restoringBusy")
                try:
                    own_files, own_runs = job.registration(identity)
                    late = update_tasks.running(self.live, own_files=own_files, own_runs=own_runs,
                                                task_rows=readable)
                    if late:
                        raise BackupRejected("errors.ledgerBackups.tasksRunningNotRestored",
                                             {"tasks": list(late)})
                    outcome = restore(self.live, backup, migrations_dir=migrations_dir or MIGRATIONS_DIR,
                                      progress=lambda **values: job.update(identity, **values),
                                      keep_recent=self.keep_recent())
                finally:
                    update_tasks.release(self.live, token)
                if self.after_restore is not None:
                    try:
                        self.after_restore()
                    except Exception:
                        log.warning("Failed to clear caches after restore", exc_info=True)
                job.update(identity, status="complete", **stage_fields('backup.restoreDone'), backup=backup.name,
                           saved=outcome.saved.name if outcome.saved else "",
                           migrated=len(outcome.migrated))

            job.start(work, restart=True, initial={**stage_fields('backup.prepareRestore'), "backup": backup.name,
                                                   "done": 0, "total": 0})
        return self.snapshot()


_MANAGER_LOCK = threading.Lock()


def manager(request) -> LedgerBackups:
    from . import settings_file
    with _MANAGER_LOCK:
        state = request.app.state
        if not hasattr(state, "ledger_backups"):
            contract = state.web_contract
            state.ledger_backups = LedgerBackups(settings_file.load_config(), runs=contract.task_runs,
                                                 after_restore=contract.cache_bust)
        return state.ledger_backups
