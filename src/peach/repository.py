from __future__ import annotations

import logging
import sqlite3
import threading
import time
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .catalog_rules import is_jav_code, normalise_code_key, sql_is_local_extra
from .entities import normalize_entity_name
from .regions import infer_region
from .user_messages import UserFacingError

LOGGER = logging.getLogger(__name__)

#: 没给 `timeout` 的写入在进程内写锁上最多排队多久。正常事务都是毫秒到秒级；
#: 等满还没轮到，说明持有者卡在锁里做了不该做的事（比如网盘 IO），排下去只会让全进程写入陪着停。
WRITE_LOCK_SECONDS = 120.0

#: 当前线程是不是后台写入者，见 `in_background`。
_WRITER = threading.local()


class LedgerWriteBusy(UserFacingError, sqlite3.OperationalError):
    """进程内写锁等到期限仍没轮到。仍是 `sqlite3.OperationalError` 且标成 `SQLITE_BUSY`：
    任务重试、结算重试和诊断分类都按「数据库忙」接住它。"""

    status_code = 503

    def __init__(self, seconds: float):
        super().__init__("errors.ledger.writeBusy", {"seconds": round(seconds)})
        self.sqlite_errorcode = sqlite3.SQLITE_BUSY
        self.sqlite_errorname = "SQLITE_BUSY"


def in_background(target):
    """把线程入口包成后台写入者：它提交的写入只让页面缓存「过期」，读者可以先拿旧值（ADR-0146）。

    没包的线程照旧按前台算：测试、请求处理与显式失效写完就要读到新值。
    """
    def run(*args, **kwargs):
        _WRITER.background = True
        return target(*args, **kwargs)
    return run


def writing_in_background() -> bool:
    return getattr(_WRITER, "background", False)


class LedgerDatabase:
    """Shared SQLite connection and transaction boundary for one Peach app."""

    def __init__(self, db_path: Path, *, media_roots=()):
        self.db_path = Path(db_path)
        self.media_roots = tuple(media_roots)
        self.write_lock = threading.Lock()
        self._holder = ("", time.monotonic())
        self.after_commit = lambda: None
        self._sql_rules = (
            ('is_jav_code', 1, lru_cache(maxsize=32768)(is_jav_code)),
            ('normalise_code_key', 1, lru_cache(maxsize=32768)(normalise_code_key)),
            ('infer_region', 2, lru_cache(maxsize=32768)(infer_region)),
            ('peach_normalize', 1, lru_cache(maxsize=32768)(normalize_entity_name)),
        )

    def connect(self, *, write: bool = False, timeout: float = 30) -> sqlite3.Connection:
        target = (
            str(self.db_path)
            if write
            else self.db_path.resolve().as_uri() + "?mode=ro"
        )
        connection = sqlite3.connect(
            target, timeout=timeout, check_same_thread=False, uri=not write,
        )
        connection.row_factory = sqlite3.Row
        roots = self.media_roots
        connection.create_function("peach_is_local_extra", 2,
            lambda name, path: sql_is_local_extra(name, path, roots), deterministic=True)
        # 产地推断要和 Python 侧同一份实现。SQL 里重写一遍前缀名单的话，账本筛出来的
        # 那批片和页面上标着的产地会从某一次改名单开始悄悄分家。
        # 标签归一化必须两边同一份。SQLite 自带的 lower() 只认 ASCII：西里尔、
        # 罗马数字 Ⅱ 这类字符它原样放过，而写入时用的是 Python 的 casefold，
        # 于是「隐藏这个标签」写进去的值和查询时算出的值对不上，隐藏静默失效。
        for name, arity, function in self._sql_rules:
            connection.create_function(name, arity, function, deterministic=True)
        return connection

    @contextmanager
    def read_connection(self):
        connection = self.connect()
        try:
            yield connection
        finally:
            connection.close()

    @contextmanager
    def write_transaction(self, *, notify: bool = True, timeout: float | None = None):
        """写事务。`notify=False` 的写入不触发 `after_commit`。

        `after_commit` 在服务里是清聚合缓存。任务中心的心跳与进度每两秒写一行
        `task_run`，它和馆藏数据没有任何关系；跟着清一次缓存，等于让首页、统计和
        复核页在每个长任务运行期间全程失去缓存。

        `timeout` 给可以放弃的写入用：进程内的写锁与 SQLite 的写锁各最多等这么久。
        不传则进程内最多排队 `WRITE_LOCK_SECONDS`、SQLite 等 30 秒。进程内等不到抛
        `LedgerWriteBusy`，它也是 `sqlite3.OperationalError`，与 SQLite 自己等超时按同一种
        暂时故障处理；超时发生在拿连接之前，这次写入一行都不会落。
        """
        from .task_control import operation
        with operation() if notify else nullcontext():
            with self._write_transaction(notify=notify, timeout=timeout) as connection:
                yield connection

    @contextmanager
    def _write_transaction(self, *, notify: bool, timeout: float | None):
        wait = WRITE_LOCK_SECONDS if timeout is None else timeout
        if not self.write_lock.acquire(timeout=wait):
            if timeout is None:
                # 自定期限的调用方（任务进度）自己决定记不记；默认期限等满说明持有者卡住了，记下是谁。
                holder, since = self._holder
                LOGGER.warning("Ledger write lock still held by thread %s after %.0f s (held for %.0f s); "
                               "this write was not applied", holder, wait, time.monotonic() - since)
            raise LedgerWriteBusy(wait)
        self._holder = (threading.current_thread().name, time.monotonic())
        try:
            connection = (self.connect(write=True) if timeout is None
                          else self.connect(write=True, timeout=timeout))
            try:
                yield connection
            except BaseException:
                connection.rollback()
                raise
            else:
                connection.commit()
                if notify:
                    self.after_commit()
            finally:
                connection.close()
        finally:
            self.write_lock.release()


@dataclass(frozen=True)
class MediaAsset:
    id: int
    path: str | None
    snapshot_path: str | None
    location: str | None = None
    name: str | None = None
    duration: float | None = None
    size: int | None = None


class LedgerRepository:
    def __init__(self, database: Path | LedgerDatabase):
        self.database = (
            database if isinstance(database, LedgerDatabase) else LedgerDatabase(database)
        )
        self.db_path = self.database.db_path

    def media_asset(self, asset_id: int) -> MediaAsset | None:
        with self.database.read_connection() as connection:
            row = connection.execute(
                "SELECT id,path,snapshot_path,location,name,duration,size "
                "FROM asset WHERE id=?",
                (asset_id,),
            ).fetchone()
        if row is None:
            return None
        return MediaAsset(
            row["id"],
            row["path"],
            row["snapshot_path"],
            row["location"],
            row["name"],
            row["duration"],
            row["size"],
        )
