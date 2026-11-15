"""任务中心的本机控制意图、安全停点和所属媒体子进程。"""
from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import sys
import threading
import tempfile
import time
import uuid
from functools import wraps
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from pathlib import Path

import psutil

from .fsutil import atomic_write_text
from .update_tasks import state_for
from .user_messages import UserPermissionError, UserValueError

CURRENT = ContextVar('peach_task_control', default=None)
_LIVE = {}
_LOCK = threading.RLock()
#: 暂停期间多久重读一次控制文件。本进程的请求会立刻叫醒停点，这个间隔只管命令行等别的进程发来的继续。
PAUSED_POLL_SECONDS = 1.0
#: 终止进程树之后等输出管道关闭的上限。逃出进程树的孙进程还占着管道时，到期就不再等它。
REAP_SECONDS = 10.0
LOGGER = logging.getLogger(__name__)


class Cancelled(KeyboardInterrupt):
    """用户取消整轮任务；领域内的单项失败处理不能吞掉取消。"""


def _root(db):
    return state_for(db).parent / 'task-controls'


def _read(path, attempts=20):
    for attempt in range(attempts):
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except FileNotFoundError:
            return {}
        except PermissionError:
            # Windows 上写入端 os.replace 换文件的那一瞬间，读方打开会报拒绝访问；稍等即可读到新文件。
            if os.name != 'nt' or attempt == attempts - 1:
                raise
            time.sleep(.05)


def _key(db, run_id):
    return (str(db.resolve()), run_id)


def intent(db, run_id, ancestors=()):
    commands = [_read(_root(db) / f'{identity}.request.json')
                for identity in dict.fromkeys((run_id, *ancestors)) if identity is not None]
    cancelled = [command for command in commands if command.get('action') == 'cancel']
    if cancelled:
        commands = cancelled
    return max(commands, key=lambda value: value.get('at', 0), default={})


def requested(db, run_id, ancestors=()):
    return intent(db, run_id, ancestors).get('action', 'resume')


def speed_mode(db, run_id, ancestors=(), *, default='standard'):
    commands = [_read(_root(db) / f'{identity}.speed.json')
                for identity in dict.fromkeys((run_id, *ancestors)) if identity is not None]
    command = max(commands, key=lambda value: value.get('at', 0), default={})
    return command.get('speed_mode', default)


def initialize_speed(store, run_id, parent=None, *, task_key=None):
    from .processing_control import MODES, default_mode
    from .update_tasks import _mutex
    db = store.database.db_path
    with _mutex(state_for(db)):
        path = _root(db) / f'{run_id}.speed.json'
        mode = (speed_mode(db, parent.id, (parent.parent_run_id, parent.root_run_id))
                if parent is not None else default_mode(store.database))
        if parent is None and task_key == 'upgrade-repairs':
            saved = _read(_root(db) / 'upgrade-repairs.speed.json').get('speed_mode')
            if saved in MODES:
                mode = saved
        atomic_write_text(path, json.dumps({'speed_mode': mode, 'at': time.time_ns()}))


#: 控制意图：活跃后代和原地接续要沿用祖先或上一轮的速度与取消，留到运行行被清退。
INTENT_KINDS = ('speed', 'request')
#: 执行端即时状态：带写入进程的 pid，只有未结束的运行有读者，运行一结束就清。
RUNTIME_KINDS = ('observed', 'resources')


def prune_controls(store):
    """清退控制文件，返回删掉的个数。

    先列目录再查库：列出的文件若属于取样时仍活跃的运行就保留，终态不会再回到活跃。
    登记新运行的事务在 `_mutex` 内写速度文件，查库和删控制意图都在锁里；即时状态只由
    已登记的运行写，放到锁外删，首次清退存量时几万次删除不挡任务登记。
    """
    from .update_tasks import _mutex
    db = store.database.db_path
    files = []
    for path in _root(db).glob('*.json'):
        identity, _, kind = path.name.removesuffix('.json').partition('.')
        if identity.isdigit() and kind in (*INTENT_KINDS, *RUNTIME_KINDS):
            files.append((identity, kind, path))
    if not files:
        return 0
    with _mutex(state_for(db)):
        with store.database.read_connection() as connection:
            active = {str(row[0]): bool(row[1]) for row in connection.execute(
                "SELECT id,status IN ('pending','running') FROM task_run")}
        removed = _unlink(path for identity, kind, path in files
                          if kind in INTENT_KINDS and identity not in active)
    return removed + _unlink(path for identity, kind, path in files
                             if kind in RUNTIME_KINDS and not active.get(identity))


def _unlink(paths):
    removed = 0
    for path in paths:
        try:
            path.unlink(missing_ok=True)
            removed += 1
        except OSError:
            logging.getLogger(__name__).warning('Failed to clean up task control files: %s', path, exc_info=True)
    return removed


def projection(store, run, *, descendants_active=None):
    """`descendants_active` 是调用方已经查齐的「有没有后代还在排在跑」；不传就当场问。"""
    if not store.enabled or run.host != store.host:
        return None
    # 自己已结束的父任务，有后代还在排或在跑才算可控；这里只问有没有。
    if not run.active and not (store.active_descendants(run.id, limit=1)
                               if descendants_active is None else descendants_active):
        return None
    command = intent(store.database.db_path, run.id, (run.parent_run_id, run.root_run_id))
    action = command.get('action', 'resume')
    observed = _read(_root(store.database.db_path) / f'{run.id}.observed.json')
    if action == 'cancel':
        state, actions = 'cancelling', []
    elif action == 'pause':
        acknowledged = observed.get('command') == command.get('id') and observed.get('state') == 'paused'
        if not run.active:
            # 暂停是否已落到每个后代：只有这里要整行，一次查询取回。
            children = store.active_descendants(run.id)
            acknowledged = bool(children) and all(
                (projection(store, child) or {}).get('state') == 'paused' for child in children)
        state = 'paused' if run.status == 'pending' or acknowledged else 'pausing'
        actions = ['resume', 'cancel']
    else:
        state, actions = 'running', ['pause', 'cancel']
    return {'state': state, 'actions': [*actions, *(['set_speed'] if action != 'cancel' else [])],
            'speed_mode': speed_mode(store.database.db_path, run.id, (run.parent_run_id, run.root_run_id))}


def request(store, run_id, action, *, mode=None):
    from .update_tasks import _mutex
    with _mutex(state_for(store.database.db_path)):
        result = _request(store, run_id, action, mode=mode)
    # 后代的停点也可能在等这条请求，叫醒同一数据库下的全部停点，各自重读控制文件。
    database, _run = _key(store.database.db_path, run_id)
    with _LOCK:
        for (path, _identity), control in _LIVE.items():
            if path == database:
                control.wakeup.set()
    return result


def _request(store, run_id, action, *, mode=None):
    if action not in ('pause', 'resume', 'cancel', 'set_speed'):
        raise UserValueError('errors.taskControl.actionInvalid')
    if action == 'set_speed':
        from .processing_control import valid_mode
        mode = valid_mode(mode)
    run = store.get(run_id)
    if run is None:
        from .jobs import TaskRunMissing
        raise TaskRunMissing('errors.taskControl.runMissing')
    if not store.enabled or run.host != store.host:
        raise UserPermissionError('errors.taskControl.otherHost')
    if projection(store, run) is None:
        raise UserValueError('errors.taskControl.runFinished')
    db = store.database.db_path
    current = requested(db, run.id, (run.parent_run_id, run.root_run_id))
    if current == 'cancel':
        if action != 'cancel':
            raise UserValueError('errors.taskControl.cancelling')
        return run
    if current == action:
        return run
    if action == 'set_speed':
        command = json.dumps({'speed_mode': mode, 'at': time.time_ns()})
        children = (run, *store.active_descendants(run.id))
        if run.task_key in ('upgrade-repairs', 'upgrade-library'):
            # 自动修复由多次独立派发组成；当前批次的选择也用于已排队和之后派发的批次。
            atomic_write_text(_root(db) / 'upgrade-repairs.speed.json', command)
            with store.database.read_connection() as connection:
                pending = connection.execute(
                    "SELECT id FROM task_run WHERE task_key='upgrade-library' "
                    "AND host=? AND status IN ('pending','running')", (store.host,)).fetchall()
            for row in pending:
                atomic_write_text(_root(db) / f'{row[0]}.speed.json', command)
        for child in children:
            if child.host == store.host:
                atomic_write_text(_root(db) / f'{child.id}.speed.json', command)
        return run
    # 父任务的控制覆盖已经派出的后继；尚未派出的工作在父任务结算前经过停点。
    with store.database.read_connection() as connection:
        descendants = connection.execute(
            'WITH RECURSIVE family(id) AS (SELECT ? UNION ALL '
            'SELECT t.id FROM task_run t JOIN family f ON t.parent_run_id=f.id) '
            "SELECT id FROM task_run WHERE id IN (SELECT id FROM family) AND status IN ('pending','running')",
            (run_id,)).fetchall()
    command = {'id': uuid.uuid4().hex, 'action': action, 'at': time.time_ns()}
    atomic_write_text(_root(db) / f'{run.id}.request.json', json.dumps(command))
    for row in descendants:
        identity = int(row[0])
        child = store.get(identity)
        if child is None or child.host != store.host:
            continue
        if action != 'cancel' and requested(db, child.id, (child.parent_run_id, child.root_run_id)) == 'cancel':
            continue
        atomic_write_text(_root(db) / f'{identity}.request.json', json.dumps(command))
        if child.status == 'pending' and action == 'cancel':
            store.finish(identity, 'cancelled', summary={'cancelled_by_user': True})
            from .job_recovery import read, cancel
            saved = read(db, child.task_key)
            if saved.get('run_id') == identity:
                cancel(db, child.task_key)
    return store.get(run_id)


def _suspend_tree(process, suspended):
    """暂停仍存活的媒体进程树，逐个登记供退出停点时恢复。"""
    try:
        owner = psutil.Process(process.pid)
    except psutil.NoSuchProcess:
        return False
    try:
        children = owner.children(recursive=True)
    except psutil.NoSuchProcess:
        children = []
    for child in [owner, *children]:
        try:
            child.suspend()
            suspended.append(child)
        except psutil.NoSuchProcess:
            pass
    return True


class Control:
    def __init__(self, store, run_id, *, recoverable=False):
        self.store, self.run_id = store, run_id
        self.recoverable = recoverable
        self.db = store.database.db_path
        self.stopping = threading.Event()
        #: 本进程发出控制请求或要停服务时叫醒暂停中的停点，不必等满 `PAUSED_POLL_SECONDS`。
        self.wakeup = threading.Event()
        self.lock = threading.RLock()
        self.operations = {}
        self.owners = {}
        self._paused_seconds = 0.0
        self._paused_at = None
        self.next_work = {}
        self._speed_mode = None
        run = store.get(run_id)
        self.ancestors = (run.parent_run_id, run.root_run_id)
        self._observed = None
        from .task_resources import Usage
        self.usage = Usage(self.db, run_id)

    @property
    def mode(self):
        return speed_mode(self.db, self.run_id, self.ancestors)

    def pace(self, kind):
        from .processing_control import IO_INTERVALS
        while True:
            self.checkpoint()
            mode = self.mode
            with self.lock:
                if mode != self._speed_mode:
                    self.next_work.clear()
                    self._speed_mode = mode
                remaining = self.next_work.get(kind, 0) - time.monotonic()
                if remaining <= 0:
                    self.next_work[kind] = time.monotonic() + IO_INTERVALS[mode].get(kind, 0)
                    return
            self.stopping.wait(min(.1, remaining))

    @property
    def paused_seconds(self):
        with self.lock:
            return self._paused_seconds + (time.monotonic() - self._paused_at
                                           if self._paused_at is not None else 0.0)

    def _publish(self, command, state):
        value = {'command': command.get('id'), 'state': state, 'pid': os.getpid()}
        with self.lock:
            if value != self._observed:
                atomic_write_text(_root(self.db) / f'{self.run_id}.observed.json', json.dumps(value))
                self._observed = value

    def check_item(self):
        self.checkpoint()

    def checkpoint(self, process=None):
        started = None
        suspended = []
        parked = []
        try:
            while True:
                self.wakeup.clear()
                self.usage.publish()
                from .update_tasks import check_pause
                check_pause(self.db if self.recoverable else None)
                if self.stopping.is_set():
                    from .jobs import JobPaused
                    if self.recoverable:
                        raise JobPaused('errors.taskControl.shuttingDown')
                    raise Cancelled()
                command = intent(self.db, self.run_id, self.ancestors)
                action = command.get('action', 'resume')
                if action == 'cancel':
                    raise Cancelled()
                if action != 'pause':
                    with self.lock:
                        if self._paused_at is not None:
                            self._paused_seconds += time.monotonic() - self._paused_at
                            self._paused_at = None
                    self._publish(command, 'running')
                    return time.monotonic() - started if started is not None else 0.0
                if started is None:
                    started = time.monotonic()
                    with self.lock:
                        if self._paused_at is None:
                            self._paused_at = started
                    if process is not None and process.poll() is None:
                        if not _suspend_tree(process, suspended):
                            return
                    with self.lock:
                        parked = [key for key, owner in self.owners.items()
                                  if owner == threading.get_ident()]
                        for key in parked:
                            self.operations[key] = True
                with self.lock:
                    quiet = all(self.operations.values())
                self._publish(command, 'paused' if quiet else 'pausing')
                self.store.heartbeat(self.run_id)
                # 还有线程没停稳时照旧勤看，好尽快报「已暂停」；停稳之后只等继续，放慢重读控制文件。
                self.wakeup.wait(PAUSED_POLL_SECONDS if quiet else .1)
        finally:
            for child in reversed(suspended):
                try:
                    child.resume()
                except psutil.NoSuchProcess:
                    pass
            with self.lock:
                for key in parked:
                    if key in self.operations:
                        self.operations[key] = False


@contextmanager
def bind(store, run_id, *, recoverable=False):
    if run_id is None or not store.enabled:
        yield None
        return
    control = Control(store, run_id, recoverable=recoverable)
    key = _key(control.db, run_id)
    with _LOCK:
        _LIVE[key] = control
    token = CURRENT.set(control)
    control.usage.enter_thread()
    try:
        control.checkpoint()
        yield control
    finally:
        try:
            control.usage.leave_thread()
        finally:
            control.usage.close()
            CURRENT.reset(token)
            with _LOCK:
                _LIVE.pop(key, None)


def shutdown(db, run_id):
    with _LOCK:
        control = _LIVE.get(_key(db, run_id))
    if control is not None:
        control.stopping.set()
        control.wakeup.set()


def checkpoint(kind='work'):
    control = CURRENT.get()
    if control is not None:
        if kind is None:
            control.checkpoint()
        else:
            control.pace(kind)


def controlled(function):
    @wraps(function)
    def call(*args, **kwargs):
        with operation():
            result = function(*args, **kwargs)
        checkpoint()
        return result
    return call


@contextmanager
def operation():
    """有界网络请求等在途步骤退出后，才确认整轮已经暂停。"""
    control = CURRENT.get()
    if control is None:
        yield
        return
    marker = object()
    control.usage.enter_thread()
    with control.lock:
        control.operations[id(marker)] = False
        control.owners[id(marker)] = threading.get_ident()
    try:
        checkpoint()
        yield
    finally:
        with control.lock:
            control.operations.pop(id(marker), None)
            control.owners.pop(id(marker), None)
        control.usage.leave_thread()


@contextmanager
def committing():
    """已进入文件替换等短提交步骤时，先完整提交，再响应下一次控制请求。"""
    checkpoint()
    with operation():
        token = CURRENT.set(None)
        try:
            yield
        finally:
            CURRENT.reset(token)


class _OutputCapture:
    """独立读写句柄观察输出；Windows communicate 只在 EOF 后交出管道内容。"""

    def __init__(self):
        self.stack = ExitStack()
        root = Path(self.stack.enter_context(tempfile.TemporaryDirectory(prefix='peach-process-')))
        self.writers = [self.stack.enter_context((root / name).open('wb')) for name in ('stdout', 'stderr')]
        self.readers = [self.stack.enter_context((root / name).open('rb')) for name in ('stdout', 'stderr')]
        self.parts = [[], []]

    def drain(self, on_stdout):
        chunks = [reader.read() for reader in self.readers]
        for parts, chunk in zip(self.parts, chunks):
            if chunk:
                parts.append(chunk)
        if chunks[0] and on_stdout is not None:
            # 短进度投影不重入无进程的检查点，暂停由等待循环携子进程响应。
            token = CURRENT.set(None)
            try:
                on_stdout(chunks[0])
            finally:
                CURRENT.reset(token)
        return bool(chunks[0])

    def result(self, process=None):
        output = tuple(b''.join(parts) for parts in self.parts)
        if process is not None and process.text_mode:
            return tuple(value.decode(process.encoding, process.errors or 'strict').replace('\r\n', '\n').replace('\r', '\n')
                         for value in output)
        return output

    def close(self):
        self.stack.close()


def _wait_process(process, control, capture, *, input, timeout, idle_timeout, on_stdout):
    """轮询进程并观察 stdout 活动；用户暂停的时间不计入两种超时。"""
    started = time.monotonic()
    paused = 0.0
    last_output_at = 0.0
    while True:
        if control is not None:
            paused += control.checkpoint(process) or 0.0
        try:
            output = process.communicate(input=input, timeout=.1)
            if capture is not None:
                capture.drain(on_stdout)
                output = capture.result(process)
            return output
        except subprocess.TimeoutExpired as error:
            input = None
            elapsed = time.monotonic() - started - paused
            if capture is not None and capture.drain(on_stdout):
                last_output_at = elapsed
            if idle_timeout is not None and elapsed - last_output_at >= idle_timeout:
                raise subprocess.TimeoutExpired(process.args, idle_timeout, output=error.output, stderr=error.stderr) from None
            if timeout is not None and elapsed >= timeout:
                raise subprocess.TimeoutExpired(process.args, timeout, output=error.output, stderr=error.stderr) from None


def _reap_process(process, job):
    """终止本次进程树并回收输出，完成后才允许任务结算。"""
    from .process_job import close_job
    children = []
    try:
        if process.poll() is None:
            try:
                children = psutil.Process(process.pid).children(recursive=True)
            except psutil.NoSuchProcess:
                children = []
            for child in reversed(children):
                try:
                    child.kill()
                except psutil.NoSuchProcess:
                    pass
            try:
                process.kill()
            except ProcessLookupError:
                pass
    finally:
        if os.name != 'nt':
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            except PermissionError:
                # macOS 上进程组只剩已退出但未回收的进程时会报 EPERM。
                if sys.platform != 'darwin':
                    raise
        close_job(job)
    try:
        output = process.communicate(timeout=REAP_SECONDS)
    except subprocess.TimeoutExpired:
        # 进程树已经终止，管道却还有别的持有者（逃出 Job 或进程组的孙进程）。任务照常收尾；
        # Windows 上读取线程随持有者退出自己关闭管道，POSIX 上由本线程读，这里直接关掉。
        LOGGER.warning('Task child process %s left descendants holding its output pipes', process.pid)
        pipes = (process.stdout, process.stderr)
        output = tuple(None if pipe is None else '' if process.text_mode else b'' for pipe in pipes)
        if os.name != 'nt':
            for pipe in pipes:
                if pipe is not None:
                    pipe.close()
    # Windows 的 kill 和关闭 Job 只发起终止；后代退出后，才能清理它继承的输出文件。
    psutil.wait_procs(children, timeout=5)
    return output


@controlled
def run(command, *, capture_output=False, timeout=None, check=False, input=None,
        idle_timeout=None, on_stdout=None, **kwargs):
    """执行当前任务拥有的子进程；idle_timeout 监测 stdout，回调接收增量 bytes。"""
    control = CURRENT.get()
    if control is None and idle_timeout is None and on_stdout is None:
        return subprocess.run(command, capture_output=capture_output, timeout=timeout,
                              check=check, input=input, **kwargs)
    checkpoint()
    if (idle_timeout is not None or on_stdout is not None) and not capture_output:
        raise ValueError('idle_timeout and on_stdout require capture_output=True')
    capture = _OutputCapture() if idle_timeout is not None or on_stdout is not None else None
    if capture_output:
        kwargs.update(stdout=capture.writers[0] if capture else subprocess.PIPE,
                      stderr=capture.writers[1] if capture else subprocess.PIPE)
    if input is not None:
        kwargs['stdin'] = subprocess.PIPE
    if os.name != 'nt':
        kwargs['start_new_session'] = True
    from .process_job import assign_to_job, close_job, create_kill_on_close_job
    job = create_kill_on_close_job()
    try:
        process = subprocess.Popen(command, **kwargs)
    except BaseException:
        close_job(job)
        if capture is not None:
            capture.close()
        raise
    assign_to_job(job, process)
    if control is not None:
        with control.lock:
            control.operations[id(process)] = False
            control.owners[id(process)] = threading.get_ident()
    timeout_error = None
    try:
        if control is not None:
            control.usage.enter_process(process)
        stdout, stderr = _wait_process(process, control, capture, input=input, timeout=timeout,
                                       idle_timeout=idle_timeout, on_stdout=on_stdout)
        checkpoint()
        result = subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
        if check:
            result.check_returncode()
        return result
    except subprocess.TimeoutExpired as error:
        timeout_error = error
        raise
    finally:
        try:
            stdout, stderr = _reap_process(process, job)
            if timeout_error is not None:
                if capture is not None:
                    capture.drain(None)
                    stdout, stderr = capture.result()
                timeout_error.output = stdout
                timeout_error.stderr = stderr
        finally:
            try:
                if control is not None:
                    with control.lock:
                        control.operations.pop(id(process), None)
                        control.owners.pop(id(process), None)
                    control.usage.leave_process(process)
            finally:
                if capture is not None:
                    capture.close()
