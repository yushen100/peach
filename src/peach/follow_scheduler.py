"""APScheduler-backed automatic follow checks and their persisted preference."""
from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler
from .update_tasks import UpdateBusy
from .fsutil import atomic_write_text
from . import interface_text
from .user_messages import UserFacingError, UserValueError


LOGGER = logging.getLogger(__name__)
JOB_ID = "peach-follow-update"
MIN_INTERVAL_MINUTES = 15
MAX_INTERVAL_MINUTES = 7 * 24 * 60
#: 连续失败时下一次最多推迟到原间隔的几倍。失败最常见的原因是上游临时挡回来或者
#: 断网；按原间隔继续敲只会把同一个错误重复几十遍，还白耗流量额度。第一次失败不
#: 退避（可能只是抖动），从第二次起翻倍，到这个倍数为止。
MAX_BACKOFF_FACTOR = 8
#: 同步发起的检查（定时那一跳、登记来源时顺带的首次检查）最多等这一轮这么久。这一轮在任务中心
#: 被暂停后会一直停着；调度线程 `max_instances=1`，一直等下去之后每一跳都被跳过。
#: 到期就先回「还在跑」，这一轮照常跑完、记在任务中心。取最短间隔：等得更久也只是多跳过一跳。
CHECK_WAIT_SECONDS = MIN_INTERVAL_MINUTES * 60


def _stamp(moment: datetime | None = None) -> str:
    return (moment or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat().replace(
        "+00:00", "Z")


#: 订阅源拉取（ADR-0042）借用同一个实现，只是换一个 job id 与一份自己的状态文件。
#: 间隔、退避、跳过与状态上报只有一份：第二套定时会长出第二种「上次什么时候跑的」。
FEED_JOB_ID = "peach-feed-update"
RUNTIME_COUNTS = ('last_checked', 'last_added', 'consecutive_failures')
RUNTIME_TIMES = ('last_started_at', 'last_finished_at', 'last_skipped_at', 'failing_since', 'next_run_at')
#: 上次失败的原因：`last_error` 是 zh-CN 原文，`last_error_code` 与 `last_error_params` 给界面取译文。
#: 旧状态文件只有原文，读出来照原文显示。
RUNTIME_ERROR = ('last_error', 'last_error_code', 'last_error_params')
#: 订阅源拉取只在写入端可用：`api.py` 建订阅源那一个调度对象时传 `unavailable_code=FEED_UNAVAILABLE_CODE`。
FEED_UNAVAILABLE_CODE = "errors.followScheduler.feedWriterOnly"


@dataclass(frozen=True)
class FollowScheduleConfig:
    enabled: bool = True
    interval_minutes: int = 60


class FollowScheduleStore:
    """Small replace-on-write state file; scheduling preferences are not ledger truth."""

    def __init__(self, state_root: Path, filename: str = "follow-schedule.json",
                 default: FollowScheduleConfig | None = None):
        self.path = Path(state_root) / filename
        self.default = default or FollowScheduleConfig()

    @staticmethod
    def validate(enabled: object, interval_minutes: object) -> FollowScheduleConfig:
        if not isinstance(enabled, bool) or isinstance(interval_minutes, bool):
            raise ValueError("enabled must be a boolean and interval_minutes an integer")
        interval = int(interval_minutes)
        if not MIN_INTERVAL_MINUTES <= interval <= MAX_INTERVAL_MINUTES:
            raise ValueError(
                f"interval_minutes must be between {MIN_INTERVAL_MINUTES} and "
                f"{MAX_INTERVAL_MINUTES}"
            )
        return FollowScheduleConfig(bool(enabled), interval)

    def load(self) -> FollowScheduleConfig:
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            return self.validate(payload.get("enabled", self.default.enabled),
                                 payload.get("interval_minutes",
                                             self.default.interval_minutes))
        except FileNotFoundError:
            return self.default
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            LOGGER.warning("invalid follow schedule preference at %s; using defaults", self.path)
            return self.default

    def save(self, config: FollowScheduleConfig) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_name(f".{self.path.name}.{os.getpid()}.tmp")
        temporary.write_text(
            json.dumps(asdict(config), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        os.replace(temporary, self.path)


class FollowUpdateScheduler:
    """Own one interval job and expose its state to the settings surface."""

    def __init__(self, state_root: Path, run_check: Callable[[], dict], *, available: bool,
                 job_id: str = JOB_ID, filename: str = "follow-schedule.json",
                 default: FollowScheduleConfig | None = None,
                 tick_minutes: int | None = None,
                 unavailable_message: str =
                 "automatic follow updates are available only on the ledger writer",
                 unavailable_code: str | None = None):
        self.job_id = job_id
        #: 多久跑一次。不给就等于设置里的间隔；订阅源给的是 `feeds.TICK_MINUTES`：
        #: 那边设置里的间隔是每个源的周期，到期由源自己判（ADR-0134）。
        self.tick_minutes = tick_minutes
        self.unavailable_message = unavailable_message
        #: 给了 code 就抛带 code 的报错，界面按语言显示；只给原文的照旧抛原文。
        self.unavailable_code = unavailable_code
        self.store = FollowScheduleStore(state_root, filename, default)
        self.run_check = run_check
        self.available = bool(available)
        self.config = self.store.load()
        self.scheduler = BackgroundScheduler(timezone=timezone.utc, daemon=True)
        self._started = False
        self._state_lock = threading.Lock()
        self._running = False
        self._last_started_at: str | None = None
        self._last_finished_at: str | None = None
        self._last_skipped_at: str | None = None
        self._last_error: str | None = None
        self._last_error_code: str | None = None
        self._last_error_params: dict | None = None
        self._last_checked = 0
        self._last_added = 0
        self._consecutive_failures = 0
        #: 这一串连续失败里第一轮的开始时刻；成功一轮就清空。
        self._failing_since: str | None = None
        self._next_run_at: str | None = None
        self._runtime_path = self.store.path.with_suffix('.runtime.json')
        self._restore_runtime()

    def _restore_runtime(self) -> None:
        try:
            state = json.loads(self._runtime_path.read_text(encoding='utf-8'))
            if not isinstance(state, dict):
                raise ValueError('runtime state must be an object')
            for key in RUNTIME_COUNTS:
                value = state.get(key, 0)
                if type(value) is not int or value < 0:
                    raise ValueError('invalid runtime count')
            for key in RUNTIME_TIMES:
                value = state.get(key)
                if value is not None and (not isinstance(value, str)
                        or datetime.fromisoformat(value.replace('Z', '+00:00')).tzinfo is None):
                    raise ValueError('invalid runtime timestamp')
            for key, kind in zip(RUNTIME_ERROR, (str, str, dict)):
                if state.get(key) is not None and not isinstance(state[key], kind):
                    raise ValueError('invalid runtime error')
            for key in (*RUNTIME_COUNTS, *RUNTIME_TIMES, *RUNTIME_ERROR):
                setattr(self, '_' + key, state.get(key, 0 if key in RUNTIME_COUNTS else None))
        except FileNotFoundError:
            return
        except (OSError, ValueError, TypeError):
            LOGGER.warning('automatic follow runtime state unavailable at %s', self._runtime_path,
                           exc_info=True)
            self._fail('labels.followScheduler.runtimeUnavailable')

    def _fail(self, code: str | None = None, params: dict | None = None, *, text: str | None = None) -> None:
        """记下上次失败的原因：给 code 时原文按 zh-CN 渲染；只有原文（别处异常的说明）时不带 code。
        `text=None` 且不给 code 就是清掉。调用方持 `_state_lock`。"""
        values = dict(params or {})
        self._last_error = interface_text.text(f"server:{code}", values) if code else text
        self._last_error_code = code
        self._last_error_params = values if code else None

    def _save_runtime(self) -> None:
        job = self.scheduler.get_job(self.job_id) if self._started else None
        with self._state_lock:
            if self._started:
                self._next_run_at = _stamp(job.next_run_time) if job is not None else None
            state = {key: getattr(self, '_' + key)
                     for key in (*RUNTIME_COUNTS, *RUNTIME_TIMES, *RUNTIME_ERROR)}
            atomic_write_text(self._runtime_path, json.dumps(state, ensure_ascii=False) + '\n')

    def start(self) -> None:
        if self._started or not self.available:
            return
        self.scheduler.start()
        self._started = True
        self._apply_job()

    def stop(self) -> None:
        if not self._started:
            return
        self.scheduler.shutdown(wait=False)
        self._started = False

    def update(self, *, enabled: object, interval_minutes: object) -> dict:
        if not self.available:
            raise (UserValueError(self.unavailable_code) if self.unavailable_code
                   else ValueError(self.unavailable_message))
        self.config = self.store.validate(enabled, interval_minutes)
        self.store.save(self.config)
        if self._started:
            self._apply_job(reset=True)
        return self.status()

    def run_now(self) -> dict:
        """把下一轮提前到此刻，由调度线程照常跑完并结算失败计数。

        手动检查走的是另一条路，不碰这里的 `last_error`；重试自动检查的失败只能让
        这个任务自己再跑一轮。之后的轮次从这一轮起按原间隔排。
        """
        if not self.available:
            raise (UserValueError(self.unavailable_code) if self.unavailable_code
                   else ValueError(self.unavailable_message))
        if not self._started or not self.config.enabled:
            raise UserValueError("errors.followScheduler.autoRunOff")
        with self._state_lock:
            already = self._running
            # 提前标成运行中：调度线程领走这一轮之前，读状态的人不该再看到旧的失败。
            self._running = True
        if already:
            return self.status()
        accepted = self.status()
        scheduled_at = datetime.now(timezone.utc)
        try:
            self.scheduler.modify_job(self.job_id, next_run_time=scheduled_at)
        except JobLookupError:
            with self._state_lock:
                self._running = False
            raise UserValueError("errors.followScheduler.autoRunOff") from None
        self._save_runtime()
        accepted['next_run_at'] = _stamp(scheduled_at)
        return accepted

    @property
    def tick(self) -> int:
        """调度任务的实际间隔（分钟）。"""
        return self.tick_minutes or self.config.interval_minutes

    def _apply_job(self, *, reset: bool = False) -> None:
        if not self.config.enabled:
            if self.scheduler.get_job(self.job_id) is not None:
                self.scheduler.remove_job(self.job_id)
            self._next_run_at = None
            self._save_runtime()
            return
        interval = self.tick
        now = datetime.now(timezone.utc)
        next_run = (max(now, datetime.fromisoformat(self._next_run_at.replace('Z', '+00:00')))
                    if self._next_run_at and not reset else now + timedelta(minutes=interval))
        self.scheduler.add_job(
            self._run,
            "interval",
            id=self.job_id,
            minutes=interval,
            next_run_time=next_run,
            replace_existing=True,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=min(interval * 60, 300),
        )
        self._save_runtime()

    def backoff_minutes(self, failures: int) -> int:
        """连续失败 `failures` 次之后，下一次应当推到多少分钟以后。

        第一次失败照原间隔重试——大多数失败只是一次抖动。从第二次起翻倍，
        到 `MAX_BACKOFF_FACTOR` 倍为止，且不超过允许的最大间隔。
        """
        if failures <= 1:
            return self.tick
        factor = min(2 ** (failures - 1), MAX_BACKOFF_FACTOR)
        return min(self.tick * factor, MAX_INTERVAL_MINUTES)

    def _run(self) -> None:
        with self._state_lock:
            started_before = self._last_started_at
            error_before = (self._last_error, self._last_error_code, self._last_error_params)
            self._running = True
            self._last_started_at = _stamp()
            self._fail()
        skipped = False
        try:
            # 这一轮在 `task_run` 里的记录由 `run_check` 那条路上的 BackgroundJob 落下
            # （`w_follow_check` 按 `automatic` 传 `trigger="scheduled"`），开始、进度、
            # 结束三样都在里面。这里不再记第二条：轮询和手动检查是同一件事的两种发起
            # 方式，各记一条在活动页上就成了两轮。
            try:
                result = self.run_check()
            except UpdateBusy:
                result = {'busy': True}
            if result.get("busy"):
                # 锁被另一次检查占着是互斥的正常结果，不是故障：手动检查正在跑的
                # 时候自动这一轮什么也没做。这里不抛异常：抛了界面就把它显示成
                # 「上次失败」，还连带触发退避——真正的失败反而被这种噪声盖住。
                # 这一轮既没检查也没完成，所以不留「上次运行」的时间戳，
                # 只记一次跳过；下一次照原间隔来。
                skipped = True
                with self._state_lock:
                    self._last_skipped_at = _stamp()
                    self._last_started_at = started_before
                return
            if result.get("idle"):
                # 这一跳没有到期的来源（订阅源每半小时一跳，ADR-0134）：什么也没做，
                # 上一轮的结论原样留着。按成功结算的话，一次真实失败半小时后就从界面上消失，
                # 而失败的那几个源还要等到下一次到期才重拉。
                skipped = True
                with self._state_lock:
                    self._last_started_at = started_before
                    self._last_error, self._last_error_code, self._last_error_params = error_before
                return
            if result.get("status") == "running":
                # 等满 `CHECK_WAIT_SECONDS` 这一轮还没跑完（多半被暂停了）：它开始了，但还没有结论。
                # 不按成功结算掉上一轮的失败，也不退避；这一轮的结果记在任务中心。
                skipped = True
                with self._state_lock:
                    self._last_error, self._last_error_code, self._last_error_params = error_before
                return
            rows = result.get("results") or []
            failures = [row for row in rows if not row.get("ok")]
            with self._state_lock:
                self._last_checked = int(result.get("checked") or 0)
                self._last_added = sum(int(row.get("added") or 0) for row in rows)
                if failures:
                    self._fail('labels.followScheduler.sourcesFailed', {'count': len(failures)})
            self._settle(failed=bool(failures))
        except Exception as error:  # the background job must never terminate the scheduler
            LOGGER.exception("automatic follow update failed")
            with self._state_lock:
                if isinstance(error, UserFacingError):
                    self._fail(error.code, error.params)
                else:
                    self._fail(text=str(error))
            self._settle(failed=True)
        finally:
            with self._state_lock:
                self._running = False
                if not skipped:
                    self._last_finished_at = _stamp()
            self._save_runtime()

    def _settle(self, *, failed: bool) -> None:
        """结算这一轮的连续失败计数，必要时把下一次推后。

        `modify_job` 不在 `_state_lock` 里调用：那会把本类的锁套在 APScheduler
        自己的锁外面，而 `status()` 的取锁顺序正相反，两条路径一起跑就会死锁。
        """
        with self._state_lock:
            self._consecutive_failures = (
                self._consecutive_failures + 1 if failed else 0)
            failures = self._consecutive_failures
            if not failed:
                self._failing_since = None
            elif failures == 1:
                self._failing_since = self._last_started_at
            self._next_run_at = _stamp(datetime.now(timezone.utc)
                                       + timedelta(minutes=self.backoff_minutes(failures)))
        if not failed or not self._started:
            return
        delay = self.backoff_minutes(failures)
        if delay <= self.tick:
            return
        try:
            self.scheduler.modify_job(
                self.job_id,
                next_run_time=datetime.now(timezone.utc) + timedelta(minutes=delay))
        except JobLookupError:
            # 任务在这一轮跑的过程中被关掉了。没什么要退避的。
            pass

    def status(self) -> dict:
        with self._state_lock:
            # 任务与本类的状态必须是同一张快照：分开读会出现「已经不在跑了，
            # 下次运行时间却还是上一轮的」这种自相矛盾的回答。
            job = self.scheduler.get_job(self.job_id) if self._started else None
            next_run = job.next_run_time if job is not None else None
            return {
                "ok": True,
                "available": self.available,
                "enabled": self.config.enabled,
                "interval_minutes": self.config.interval_minutes,
                "running": self._running,
                "next_run_at": _stamp(next_run) if next_run else None,
                "last_started_at": self._last_started_at,
                "last_finished_at": self._last_finished_at,
                # 上一次因为锁被占着而跳过的时刻。跳过不是失败，所以它不进
                # `last_error`，但也不能一点痕迹都不留。
                "last_skipped_at": self._last_skipped_at,
                "last_error": self._last_error,
                "last_error_code": self._last_error_code,
                "last_error_params": self._last_error_params,
                "last_checked": self._last_checked,
                "last_added": self._last_added,
                "consecutive_failures": self._consecutive_failures,
                "failing_since": self._failing_since,
            }
