"""馆藏任务的安全停点、处理偏好和带依据的耗时范围。"""
from __future__ import annotations

import json
import math
import sqlite3
import threading
import time
from collections import deque
from contextlib import contextmanager, closing, nullcontext
from contextvars import ContextVar

from . import interface_text
from .fsutil import atomic_write_text
from .task_stages import stage as stage_fields, stage_code
from .user_messages import UserInterruptedError, UserValueError


def _eta(scope: str, basis: str, basis_params: dict | None = None) -> dict:
    """剩余时间估算的范围与依据（ADR-0159）：`eta_scope`、`eta_basis` 是 zh-CN 原文，
    旁边是 `labels.processingControl.scope|basis.<名字>` 的 code 与参数。"""
    scope_code, basis_code = f"labels.processingControl.scope.{scope}", f"labels.processingControl.basis.{basis}"
    params = dict(basis_params or {})
    return {"eta_scope": interface_text.text(f"server:{scope_code}"), "eta_scope_code": scope_code,
            "eta_basis": interface_text.text(f"server:{basis_code}", params), "eta_basis_code": basis_code,
            "eta_basis_params": params}

CURRENT = ContextVar('peach_library_processing_control', default=None)
_CONTROLS = {}
_LOCK = threading.Lock()


class ItemSkipped(InterruptedError):
    """当前资产由用户跳过，任务继续处理下一项。"""


@contextmanager
def processing_item(asset_id):
    control = CURRENT.get()
    if control is None:
        yield
        return
    with control.lock:
        control.current_asset_id = asset_id
    try:
        control.check_item()
        yield
        control.check_item()
    finally:
        with control.lock:
            control.refresh(force=True)
            control.current_asset_id = None
            if control.skip_asset_id == asset_id:
                control.skip_asset_id = None
                control._save()
MODES = ('low', 'standard', 'high')
#: 用户暂停期间多久重读一次控制文件。
PAUSED_POLL_SECONDS = 1.0
MODE_FACTORS = {'low': 1.8, 'standard': 1.0, 'high': 0.75}
IO_INTERVALS = {
    'low': {'scan': 0.008, 'probe': 0.75, 'network': 1.5, 'frame': 0.75, 'work': 0.15},
    'standard': {'scan': 0.002, 'probe': 0.2, 'network': 0.25, 'frame': 0.2, 'work': 0.03},
    'high': {},
}


def valid_mode(value):
    if value not in MODES:
        raise UserValueError('errors.processingControl.invalidMode')
    return value


def _read(path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def control_for(config):
    path = (config.directory('state') / 'library-processing-control.json').resolve()
    with _LOCK:
        if path not in _CONTROLS:
            _CONTROLS[path] = ProcessingControl(path)
        return _CONTROLS[path]


def task_control(config, state_file):
    return control_for(config) if state_file is None else None


def bind_control(control, *args, **kwargs):
    return control.bind(*args, **kwargs) if control is not None else nullcontext()


def checkpoint_values(values):
    before = time.monotonic()
    checkpoint()
    waited = time.monotonic() - before
    for key in ('current_started_at', 'current_deadline_at'):
        if values.get(key):
            values[key] += waited


def interrupted_state(control):
    if control is not None and control.cancelled:
        return dict(status='cancelled', outcome='cancelled', **stage_fields('job.cancelled'), error='')
    return dict(status='paused', error='', completed_at=None) if control is not None and control.paused else {}


def resume_fields(state, values):
    waited = values.pop('resumed_after', 0)
    for key in ('current_started_at', 'current_deadline_at', 'last_progress_at'):
        if waited and state.get(key):
            state[key] += waited


def checkpoint(kind='work'):
    from .task_control import checkpoint as task_checkpoint
    control = CURRENT.get()
    task_checkpoint(None if control is not None else kind)
    if control is not None:
        control.checkpoint(kind)


def current_control():
    from .task_control import CURRENT as TASK_CONTROL
    return CURRENT.get() or TASK_CONTROL.get()


def default_mode(database):
    """从当前 profile 读取新任务默认档位。"""
    from .profiles import read_settings
    with database.read_connection() as connection:
        return read_settings(connection).get('taskSpeedMode', 'standard')


def execution_mode(database, requested=None, *, control):
    """执行中的任务沿用本轮档位，独立调用选择显式档位或设置默认值。"""
    if control is not None:
        return control.mode
    if requested is not None:
        return valid_mode(requested)
    return default_mode(database)


def low_mode():
    control = current_control()
    return control is not None and control.mode == 'low'


def mode_ratio(target, previous='standard'):
    return MODE_FACTORS[valid_mode(target)] / MODE_FACTORS[valid_mode(previous)]


def ffmpeg_options(*, filter_option=None):
    """当前任务的 FFmpeg 线程选项；高强度与独立调用使用工具默认值。"""
    control = current_control()
    threads = {'low': 1, 'standard': 2}.get(control.mode) if control is not None else None
    if threads is None:
        return []
    value = str(threads)
    return ['-threads', value, *([filter_option, value] if filter_option else [])]


class ActiveDeadline(float):
    """单调时钟截止点随本任务的用户暂停时长平移。"""
    def __new__(cls, value, control, paused=None):
        result = super().__new__(cls, value)
        result.control = control
        result.paused = control.paused_seconds if paused is None else paused
        return result

    def effective(self):
        self.control.check_item()
        return float(self) + self.control.paused_seconds - self.paused

    def __sub__(self, other):
        return self.effective() - other

    def __rsub__(self, other):
        return other - self.effective()

    def __add__(self, other):
        return ActiveDeadline(float(self) + other, self.control, self.paused)

    __radd__ = __add__

    def __lt__(self, other):
        return self.effective() < other

    def __le__(self, other):
        return self.effective() <= other

    def __gt__(self, other):
        return self.effective() > other

    def __ge__(self, other):
        return self.effective() >= other


def deadline_after(seconds):
    from .task_control import CURRENT as TASK_CONTROL
    value, control = time.monotonic() + seconds, CURRENT.get() or TASK_CONTROL.get()
    return ActiveDeadline(value, control) if control is not None else value


class ProcessingControl:
    @property
    def mode(self):
        from .task_control import CURRENT as TASK_CONTROL
        control = TASK_CONTROL.get() if CURRENT.get() is self else None
        return control.mode if control is not None else self._mode

    @mode.setter
    def mode(self, value):
        self._mode = value

    @property
    def paused_seconds(self):
        from .task_control import CURRENT as TASK_CONTROL
        control = TASK_CONTROL.get() if CURRENT.get() is self else None
        return self._paused_seconds + (control.paused_seconds if control is not None else 0.0)

    @paused_seconds.setter
    def paused_seconds(self, value):
        self._paused_seconds = value

    def __init__(self, path):
        self.path = path
        self.lock = threading.RLock()
        data = _read(path)
        self.mode = data.get('speed_mode') if data.get('speed_mode') in MODES else 'standard'
        self.next_mode = data.get('next_speed_mode')
        self.job_id = data.get('job_id')
        self.paused = data.get('paused') is True
        self.cancelled = data.get('cancelled') is True
        self.event = threading.Event()
        self.event.set()
        self.publish = None
        self.active = lambda: True
        self.db_path = None
        self.next_work = {}
        self._paced_mode = None
        self.paused_seconds = 0.0
        self.reloaded_at = 0.0
        self.current_asset_id = None
        self.skip_asset_id = data.get('skip_asset_id')

    def refresh(self, force=False):
        with self.lock:
            now = time.monotonic()
            if not force and now - self.reloaded_at < 0.5:
                return
            self.reloaded_at = now
            data = _read(self.path)
            if data.get('job_id') == self.job_id or self.publish is None:
                self.job_id = data.get('job_id', self.job_id)
                self.paused = data.get('paused', self.paused)
                self.cancelled = data.get('cancelled', self.cancelled)
                self.skip_asset_id = data.get('skip_asset_id')
                self.next_mode = data.get('next_speed_mode')
                mode = data.get('speed_mode', self.mode)
                if mode in MODES and self._mode != mode:
                    self.mode = mode
                    self.next_work.clear()

    def _save(self):
        atomic_write_text(self.path, json.dumps(dict(
            speed_mode=self.mode, job_id=self.job_id, paused=self.paused, cancelled=self.cancelled,
            skip_asset_id=self.skip_asset_id, next_speed_mode=self.next_mode)) + '\n')

    def select_next_mode(self, mode):
        with self.lock:
            self.refresh(force=True)
            self.next_mode = valid_mode(mode) if mode is not None else None
            self._save()

    def skip_current(self, job_id, asset_id):
        with self.lock:
            self.refresh(force=True)
            if self.job_id != job_id:
                raise UserValueError('errors.processingControl.jobChanged')
            self.skip_asset_id = asset_id
            self._save()
            self.event.set()

    def check_item(self):
        self.refresh()
        if self.cancelled:
            from .jobs import JobCancelled
            raise JobCancelled('errors.processingControl.userStopped')
        if self.current_asset_id is not None and self.skip_asset_id == self.current_asset_id:
            raise ItemSkipped('current item skipped')

    def request(self, action, job_id=None, mode=None):
        with self.lock:
            if job_id is not None and job_id != self.job_id:
                raise UserValueError('errors.processingControl.jobChanged')
            if action == 'set_speed':
                self.mode = valid_mode(mode)
                self.next_work.clear()
            elif action == 'cancel':
                self.cancelled = True
                self.paused = False
            else:
                self.paused = action == 'pause'
            self._save()
            self.event.set()

    def select_job(self, job_id):
        """调用方完成任务身份校验后，承接尚未进入首个安全停点的任务。"""
        with self.lock:
            if self.job_id != job_id:
                self.job_id, self.paused, self.paused_seconds = job_id, False, 0.0
                self.cancelled = False
                self.skip_asset_id = None

    @contextmanager
    def bind(self, job_id, *, publish, active, db_path, mode=None):
        with self.lock:
            self.select_job(job_id)
            if mode is not None:
                self.mode = valid_mode(mode)
            self.publish, self.active, self.db_path = publish, active, db_path
            self.next_work.clear()
            self._save()
        token = CURRENT.set(self)
        try:
            yield self
        finally:
            CURRENT.reset(token)
            self.publish = None

    def checkpoint(self, kind='work'):
        from .update_tasks import check_pause
        from .task_control import CURRENT as TASK_CONTROL
        task = TASK_CONTROL.get()
        started = None
        generic_started = 0.0
        while True:
            from .task_control import checkpoint as task_checkpoint
            task_checkpoint(None)
            check_pause(self.db_path)
            self.refresh()
            self.check_item()
            if not self.active():
                raise UserInterruptedError('errors.processingControl.stopped')
            with self.lock:
                paused, mode = self.paused, self.mode
                if mode != self._paced_mode:
                    self.next_work.clear()
                    self._paced_mode = mode
                self.event.clear()
            if paused:
                if started is None:
                    started = time.monotonic()
                    generic_started = task.paused_seconds if task is not None else 0.0
                    self.publish(status='paused', speed_mode=mode)
                # 本进程的继续、停止由 `request` 设 `event` 立刻叫醒；这一等只管别的进程改控制文件。
                self.event.wait(PAUSED_POLL_SECONDS)
                continue
            if started is not None:
                spent = time.monotonic() - started
                generic_spent = task.paused_seconds - generic_started if task is not None else 0.0
                self._paused_seconds += max(0.0, spent - generic_spent)
                self.publish(status='running', speed_mode=mode, resumed_after=spent)
                started = None
            # 控制只作用于当前馆藏任务；在单项 I/O 之间留出空档。
            delay = IO_INTERVALS[mode].get(kind, 0)
            remaining = self.next_work.get(kind, 0) - time.monotonic()
            if remaining > 0:
                self.event.wait(min(0.25, remaining))
                continue
            self.next_work[kind] = time.monotonic() + delay
            return


def user_paused(db_path, job_id):
    from .update_tasks import state_for
    data = _read(state_for(db_path).parent / 'library-processing-control.json')
    return data.get('job_id') == job_id and data.get('paused') is True


def user_cancelled(db_path, job_id):
    from .update_tasks import state_for
    data = _read(state_for(db_path).parent / 'library-processing-control.json')
    return bool(job_id) and data.get('job_id') == job_id and data.get('cancelled') is True


def initial_estimate(config, db_path, stage, asset_ids=None, mode=None, *, allow_metered=False):
    """仅使用账本统计，不在启动 HTTP 请求里遍历媒体目录。预览的范围同 `preview_readable`。"""
    if mode is None:
        from .repository import LedgerDatabase
        mode = execution_mode(LedgerDatabase(db_path), control=current_control())
    query = "SELECT COUNT(*), COALESCE(SUM(size),0) FROM asset WHERE medium='video' AND disposal IS NULL"
    parameters = []
    if asset_ids is not None:
        query += ' AND id IN (SELECT value FROM json_each(?))'
        parameters.append(json.dumps(asset_ids))
    if stage == 'previews':
        query += " AND location != 'online' AND (snapshot_path IS NULL OR snapshot_path='')"
        if not allow_metered:
            from .media_sources import cost_sql
            expression, values = cost_sql(config=config)
            query += f" AND {expression}='free'"
            parameters += list(values)
    if config.locations:
        query += ' AND location IN (' + ','.join('?' * len(config.locations)) + ')'
        parameters += list(config.locations)
    with closing(sqlite3.connect(db_path, timeout=30)) as connection:
        count, size = connection.execute(query, parameters).fetchone()
    # 抽帧只读取局部数据；文件总大小仅作为编解码复杂度的温和修正，不按全量读取估时。
    size_factor = min(2.0, max(0.8, (size / max(1, count) / 1024**3) ** 0.15))
    seconds = {'scan': 0.2, 'metadata': 8.0, 'covers': 6.0, 'previews': 12.0 * size_factor,
               'collect': 20.0 * size_factor, 'all': 20.2 * size_factor}[stage]
    history = _read(config.directory('state') / 'library-processing-timing.json')
    sample = history.get(stage)
    historical = isinstance(sample, (int, float)) and math.isfinite(sample) and sample > 0
    if historical:
        seconds = sample
    factor = MODE_FACTORS[valid_mode(mode)]
    known = bool(count) or asset_ids is not None or stage not in ('scan', 'all')
    estimate = count * seconds * factor
    return dict(speed_mode=mode,
                eta_seconds_min=max(1, math.ceil(estimate * 0.4)) if known and count else 0 if known else None,
                eta_seconds_max=max(1, math.ceil(estimate * 2.5)) if known and count else 0 if known else None,
                eta_kind='historical' if historical else 'estimating', eta_initial=True,
                **_eta('knownFiles' if stage in ('scan', 'all') else 'thisRun',
                       ('registeredHistory' if historical else 'registeredRough') if known else 'counting',
                       {'count': count, 'size': f'{size / 1024**3:.1f}'} if known else None),
                estimate_file_count=count, estimate_bytes=size)


class ProcessingEstimate:
    def __init__(self, config, state, control):
        control = control or current_control()
        self.config, self.control = config, control
        self.started = time.monotonic()
        self.phase = None
        self.phase_started = self.started
        self.base_done = 0
        self.last_done = 0
        self.samples = deque(maxlen=20)
        self.sample_at = self.started
        self.paused_at_start = control.paused_seconds if control is not None else 0
        self.mode = state['speed_mode']

    def paused_elapsed(self):
        return self.control.paused_seconds - self.paused_at_start if self.control is not None else 0

    def _phase_estimate(self, state, phase, done, total):
        """阶段切换时用该阶段保守范围起算，采样只消费当前阶段的增量。"""
        rates = {'local': 0.2, 'metadata': 8.0, 'previews': 12.0, 'probe': 1.0, 'images': 1.0}
        seconds = max(0, total - done) * rates.get(phase, 0) * MODE_FACTORS[self.mode]
        known = phase in rates and total > 0
        state.update(eta_seconds_min=math.ceil(seconds * 0.4) if known else None,
                     eta_seconds_max=math.ceil(seconds * 2.5) if known else None,
                     eta_kind='estimating', eta_initial=True, **_eta('wholeTask', 'stageRough'))

    def _total_estimate(self, state, phase, done, total, now):
        """当前阶段用独立样本校准，待执行阶段保留各自的粗估范围。"""
        rates = {'local': 0.2, 'metadata': 8.0, 'previews': 12.0, 'probe': 1.0, 'images': 1.0}
        pending = state.get('estimate_pending')
        if pending is None:
            return
        low = high = 0
        rough = False
        for key, count in pending.items():
            remaining = max(0, total - done) if key == phase else count
            if remaining <= 0:
                continue
            completed = sum(count for _, count in self.samples)
            if key == phase and completed >= 2:
                seconds = sum(elapsed for elapsed, _ in self.samples) / completed * remaining
                uncertainty = max(0.2, 1 / math.sqrt(completed))
                low += seconds * (1 - uncertainty)
                high += seconds * (1 + uncertainty)
            else:
                seconds = remaining * rates[key] * MODE_FACTORS[self.mode]
                low += seconds * 0.4
                high += seconds * 2.5
                rough = True
        state.update(eta_seconds_min=math.ceil(low) if high else None,
                     eta_seconds_max=math.ceil(high) if high else None,
                     eta_kind='estimating' if rough or not high else 'measured', eta_initial=rough,
                     **_eta('wholeTask', 'allStages'))

    def update(self, state):
        mode = self.control.mode if self.control is not None else self.mode
        if mode != self.mode:
            ratio = mode_ratio(mode, self.mode)
            for key in ('eta_seconds_min', 'eta_seconds_max'):
                if isinstance(state.get(key), (int, float)):
                    state[key] = math.ceil(state[key] * ratio)
            self.mode, self.phase = mode, None
            state['eta_initial'] = True
        state['speed_mode'] = mode
        if state.get('status') in ('complete', 'failed'):
            state.update(eta_seconds_min=0, eta_seconds_max=0)
            if state.get('status') == 'complete' and state.get('estimate_file_count', 0) > 0:
                elapsed = max(0.01, time.monotonic() - self.started - self.paused_elapsed())
                path = self.config.directory('state') / 'library-processing-timing.json'
                history = _read(path)
                history[state['requested_stage']] = elapsed / state['estimate_file_count'] / MODE_FACTORS[mode]
                atomic_write_text(path, json.dumps(history) + '\n')
            return
        if state.get('status') != 'running':
            return
        if any(step['id'] == 'sources' and step['status'] == 'current' for step in state.get('steps', [])):
            return
        code = stage_code(state)
        phase = ('previews' if code == 'library.makePreviews' else
                 'images' if code == 'library.readImages' else
                 'local' if code == 'library.checkCompanions' else
                 'metadata' if code in ('library.fetchMetadata', 'library.fetchCovers', 'library.saveCandidates') else
                 'probe' if code == 'library.probeMedia' else None)
        done, total = state.get('checked', 0), state.get('total', 0)
        now = time.monotonic() - self.paused_elapsed()
        if phase != self.phase or done < self.last_done:
            if self.phase is not None:
                self._phase_estimate(state, phase, done, total)
            self.phase, self.phase_started, self.base_done = phase, now, done
            self.samples.clear()
            self.sample_at = now
        elif done > self.last_done:
            self.samples.append((max(0.01, now - self.sample_at), done - self.last_done))
            self.sample_at = now
        self.last_done = done
        completed = done - self.base_done
        if 'estimate_pending' in state:
            self._total_estimate(state, phase, done, total, now)
            return
        if phase is None or completed < 2 or total <= done:
            return
        sampled = sum(count for _, count in self.samples)
        per_item = sum(elapsed for elapsed, _ in self.samples) / sampled
        # 采样增多时收窄当前阶段的范围，范围所指阶段随结果一同返回。
        uncertainty = max(0.2, 1 / math.sqrt(sampled))
        remaining = (total - done) * per_item
        state.update(eta_seconds_min=max(1, math.ceil(remaining * (1 - uncertainty))),
                     eta_seconds_max=max(1, math.ceil(remaining * (1 + uncertainty))),
                     eta_kind='measured', eta_initial=False, **_eta('wholeTask', 'measured', {'count': sampled}))
