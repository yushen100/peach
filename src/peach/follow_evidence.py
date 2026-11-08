"""关注抓取原始快照的保留规则与清退。

快照在 `sources/follow/<provider>/<来源摘要>/`，一份是 `<时间>-<摘要>.raw` 加同名 `.json`。
每个来源目录留最近 `KEEP` 份，加上被 `follow_item.evidence_path` 引用的；其余两件一起删。
新写入一份后由 `FollowStore.record` 在它自己那个目录里删一份，只抵消这次增长：它在写事务里，
在 Windows 上删一个文件就要几毫秒到几十毫秒。升级前留下的存量不自动删，
在「设置 › 修复与迁移」里先估算、等用户确认后由 `Reclaim` 在后台删，结果记进 `ledger_upgrade_repair`。

除 `follow_item.evidence_path` 外没有别处读这些快照：诊断与重新解析只用账本里的条目和来源行。
引用按文件名比较：名字带时间和摘要、全库唯一，`evidence_path` 无论是相对 `sources/` 的路径、
迁移前留下的绝对路径（`data_storage.PATH_COLUMNS`），还是哪种分隔符，都对得上同一个文件。
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from contextlib import nullcontext
from pathlib import Path
from .coded_text import Said
from .user_messages import UserValueError

LOGGER = logging.getLogger(__name__)

#: 每个来源目录保留的最近快照份数，被条目引用的另算。
KEEP = 3
#: 存量清退在 `ledger_upgrade_repair` 里的行 id 前缀；可以做多次，后缀是执行时刻。
RECEIPT_PREFIX = 'follow-evidence-reclaim-'
#: 删除这一轮在任务中心（`task_runs.TASK_KEYS`）的键。
TASK_KEY = 'follow-evidence-reclaim'


def reference_name(value) -> str:
    """`evidence_path` 指向的文件名，分隔符不论正反。"""
    return str(value).replace('\\', '/').rsplit('/', 1)[-1]


def referenced_names(connection, source_id: int | None = None) -> frozenset[str]:
    """被条目引用的快照文件名；给 `source_id` 时只看这一个来源（走 `source_id` 索引）。"""
    sql = "SELECT evidence_path FROM follow_item WHERE evidence_path IS NOT NULL AND evidence_path<>''"
    params: tuple = ()
    if source_id is not None:
        sql += " AND source_id=?"
        params = (int(source_id),)
    return frozenset(reference_name(row[0]) for row in connection.execute(sql, params))


def latest_snapshot(directory: Path) -> Path | None:
    """目录里最新一份 `.raw`。文件名以 UTC 时间开头，字典序就是时间序。"""
    try:
        names = [entry.name for entry in os.scandir(directory)
                 if entry.name.endswith('.raw') and entry.is_file(follow_symlinks=False)]
    except OSError:
        return None
    return Path(directory) / max(names) if names else None


def surplus(directory: Path, referenced, keep: int = KEEP, limit: int | None = None) -> list[tuple[Path, int]]:
    """目录里该删的文件与字节数：最近 `keep` 份之外、又没被引用的 `.raw`，连同同名 `.json`。

    `limit` 限定最多几份，从新往旧数：新写入后只抵消这一份增长，升级前留下的存量原样等用户确认。"""
    try:
        entries = {entry.name: entry for entry in os.scandir(directory) if entry.is_file(follow_symlinks=False)}
    except OSError:
        return []
    snapshots = sorted((name for name in entries if name.endswith('.raw')), reverse=True)
    doomed = []
    chosen = 0
    for name in snapshots[keep:]:
        if name in referenced:
            continue
        if limit is not None and chosen >= limit:
            break
        chosen += 1
        for member in (name, name[:-len('.raw')] + '.json'):
            entry = entries.get(member)
            if entry is None:
                continue
            try:
                size = entry.stat(follow_symlinks=False).st_size
            except OSError:
                size = 0
            doomed.append((Path(entry.path), size))
    return doomed


def remove(doomed, pace=None) -> tuple[int, int]:
    """删掉 `surplus` 给出的文件，返回删成的个数与字节数。别人先删了的不算失败。

    `pace(已删个数)` 在每份快照（`.raw` 打头、同名 `.json` 随后）开删前调一次：任务中心的暂停、
    取消与速度档在这里生效，停在两份之间，不会只删半份。"""
    files = freed = 0
    for path, size in doomed:
        if pace is not None and path.suffix == '.raw':
            pace(files)
        try:
            path.unlink()
        except FileNotFoundError:
            continue
        except OSError as error:
            LOGGER.warning('Could not delete follow snapshot: %s (%s)', path, error)
            continue
        files += 1
        freed += size
    return files, freed


def prune(directory: Path, referenced, keep: int = KEEP, limit: int | None = None) -> tuple[int, int]:
    return remove(surplus(directory, referenced, keep, limit))


def directories(root: Path):
    """`root` 下每个来源目录（`<provider>/<来源摘要>`）。根不在或读不了就是空的。"""
    try:
        providers = [entry.path for entry in os.scandir(root) if entry.is_dir(follow_symlinks=False)]
    except OSError:
        return
    for provider in sorted(providers):
        try:
            sources = [entry.path for entry in os.scandir(provider) if entry.is_dir(follow_symlinks=False)]
        except OSError:
            continue
        yield from (Path(path) for path in sorted(sources))


class Reclaim:
    """「修复与迁移」里的存量清退。

    估算要列全部来源目录（生产 121 个目录、17.8 万个文件实测 0.7 秒，冷缓存时更久），服务启动后
    在后台先算一次（`prime`），页面第一次打开就有读数，不再每次重启后先显示「正在统计」；
    删除在 Windows 上被杀毒软件拖到每秒几百个文件，十几万个要十来分钟，也在后台做，
    页面按 `done`/`total` 显示进度。删的时候逐个目录重新列、重新判，不用估算时的名单。
    """

    def __init__(self, root: Path, database, runs=None):
        """`database` 提供 `read_connection()` 与 `write_transaction()`（`WebContract`）；
        `runs` 是任务中心（`TaskRunStore`），删除这一轮在活动页登记、报进度。估算只读、十几秒，不登记。"""
        self.root = Path(root)
        self.database = database
        self.runs = runs
        self._lock = threading.Lock()
        self._state: dict = {'phase': 'idle'}
        #: 最近一次起的后台线程（估算或删除）。
        self.worker: threading.Thread | None = None

    def prime(self) -> None:
        """服务启动后调：在后台先估算一次，不挡启动。已在算、算过或正在删的不动。"""
        with self._lock:
            self._begin_estimate()

    def status(self) -> dict:
        """当前读数；还没估算过（启动时目录还不在）就在后台开始估算。

        `phase`：idle / estimating / ready / running / failed。"""
        with self._lock:
            self._begin_estimate()
            return dict(self._state)

    def _begin_estimate(self) -> None:
        """还没估算过就起后台估算。调用方持 `_lock`。"""
        if self._state['phase'] == 'idle' and self.root.is_dir():
            self._state = {'phase': 'estimating'}
            self.worker = threading.Thread(target=self._estimate, name='follow-evidence-estimate', daemon=True)
            self.worker.start()

    def start(self) -> dict:
        with self._lock:
            phase = self._state['phase']
            if phase == 'running':
                raise UserValueError("errors.followEvidence.running")
            if phase != 'ready':
                raise UserValueError("errors.followEvidence.estimating")
            self._state = {'phase': 'running', 'done': 0, 'total': int(self._state.get('files') or 0)}
            self.worker = threading.Thread(target=self._run, name='follow-evidence-reclaim', daemon=True)
            self.worker.start()
            return dict(self._state)

    def _referenced(self) -> frozenset[str]:
        with self.database.read_connection() as connection:
            return referenced_names(connection)

    def _count(self) -> dict:
        referenced = self._referenced()
        files = freed = 0
        for directory in directories(self.root):
            for _, size in surplus(directory, referenced):
                files += 1
                freed += size
        return {'phase': 'ready', 'files': files, 'bytes': freed}

    def _estimate(self) -> None:
        try:
            state = self._count()
        except Exception as error:  # noqa: BLE001 — 估算失败只影响这一项的读数
            LOGGER.exception('Follow snapshot estimate failed')
            state = {'phase': 'failed', 'error': str(error)}
        with self._lock:
            self._state = state

    def _task(self, call, *args, **kwargs):
        """任务中心记录写不进去不影响删除本身：只记日志。"""
        if self.runs is None:
            return None
        try:
            return call(*args, **kwargs)
        except Exception:  # noqa: BLE001
            LOGGER.warning('Failed to record follow snapshot cleanup in the task center', exc_info=True)
            return None

    def _run(self) -> None:
        """删除这一轮。和其他后台任务一样登记进任务中心：`bind` 让活动页读得到这条线程的占用，
        每份快照前过一次 `checkpoint('scan')`，暂停、取消与低占用 / 标准 / 高强度速度档都在那里生效。"""
        from .task_control import Cancelled, bind, checkpoint
        removed = freed = 0
        error = None
        status = 'succeeded'
        run = self._task(lambda: self.runs.start(TASK_KEY, trigger='manual', mutex_key=TASK_KEY,
                                                 total=self._state.get('total') or None,
                                                 label=Said('labels.followEvidence.runLabel')))
        run_id = getattr(run, 'id', None)

        def pace(done_here: int) -> None:
            checkpoint('scan')
            current = removed + done_here
            with self._lock:
                self._state['done'] = current
            self._task(lambda: self.runs.progress(run_id, current=current))

        try:
            with bind(self.runs, run_id) if self.runs is not None else nullcontext():
                referenced = self._referenced()
                for directory in directories(self.root):
                    files, size = remove(surplus(directory, referenced), pace)
                    removed += files
                    freed += size
                    with self._lock:
                        self._state['done'] = removed
        except Cancelled:
            status, error = 'cancelled', Said('labels.followEvidence.stoppedByUser')
        except Exception as exc:  # noqa: BLE001 — 删了多少照实记进历史
            LOGGER.exception('Follow snapshot cleanup interrupted')
            status, error = 'failed', str(exc)
        self._task(lambda: self.runs.progress(run_id, current=removed, throttle=0))
        self._task(lambda: self.runs.finish(run_id, status, error='' if status == 'cancelled' else error or '',
                                            summary={'files_removed': removed, 'bytes_reclaimed': freed}))
        result = {'files': removed, 'bytes': freed, **({'error': error} if error else {})}
        try:
            with self.database.write_transaction() as connection:
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (f'{RECEIPT_PREFIX}{time.time_ns()}', str(time.time()), json.dumps(result)))
        except Exception as exc:  # noqa: BLE001
            LOGGER.exception('Failed to record follow snapshot cleanup in the repair history')
            error = error or str(exc)
        LOGGER.info('Follow snapshot cleanup: removed %s files, %s bytes%s', removed, freed, f', interrupted: {error}' if error else '')
        # 做完重新估算：中断了的，剩下的照常等用户再点一次；删干净的，这一项改报上一次删了多少。
        with self._lock:
            self._state = {'phase': 'idle'}
        self.status()
