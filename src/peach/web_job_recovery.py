"""Web 组合入口为可恢复任务装配领域处理器。"""
import sys
import threading
import time
import traceback
from datetime import timezone
from pathlib import Path

from .job_recovery import resume
from .web_library_processing import w_library_processing
from .web_scraping import w_scraping_cover, w_scraping_amane_rebuild
from .web_timeline_thumbnails import w_thumbnail_jobs
from .web_follow import w_follow_check, w_follow_resolve
from .web_feeds import w_feed_check
from .web_wants import start_scrape, start_search
from .web_links import w_links_check, w_links_prune
from .web_resource_sync import w_resource_sync_scan, w_resource_sync_apply
from .web_stats import w_taste_refresh
from .web_media_repair import w_media_repair
from .web_organize import w_organize_apply, w_organize_rollback
from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler

#: 一次接回超过这么久就记下卡在哪个任务、各线程停在哪一行；每次卡住只记一次。
STUCK_SECONDS = 30
#: 一次接回卡这么久就不再等它：后面的接回另起一轮，卡住的那个任务先不接，等那一轮自己回来（#144）。
ABANDON_SECONDS = 300
FALLBACK_JOB = 'recovery-fallback'
#: 没有事件时的兜底：别的进程里的工作进程死掉不会通知本服务，最迟这么久接回。
FALLBACK_SECONDS = 30
#: 看见安装预约后多久问一次它撤下没有；撤下就接回并停掉这一问。
RELEASE_POLL_SECONDS = 2
AWAIT_RELEASE_JOB = 'await-install-release'
#: 关停时等在途接回收尾的上限（秒）。
STOP_SECONDS = 10


def restore(contract, track=lambda key, handler: handler, skip=()):
    from .jav_discovery_metadata import discovery_metadata
    from .job_recovery import read
    handlers = {
        "library-processing": lambda body: w_library_processing(contract, body, resume=True),
        "timeline-thumbnails": lambda body: w_thumbnail_jobs(contract, body),
        "scraping-cover": lambda body: w_scraping_cover(contract, body),
        "follow-check": lambda body: w_follow_check(contract, body),
        "feed-check": lambda body: w_feed_check(contract, body),
        "want-scrape": lambda _body: start_scrape(contract),
        "want-search": lambda _body: start_search(contract),
        "link-check": lambda body: w_links_check(contract, {**body, 'restart': True}),
        "resource-scan": lambda body: w_resource_sync_scan(contract, {**body, 'background': True}),
        "resource-apply": lambda body: w_resource_sync_apply(contract, body),
        "link-prune": lambda body: w_links_prune(contract, body),
        "follow-resolve": lambda body: w_follow_resolve(contract, body),
        "taste-refresh": lambda body: w_taste_refresh(contract, body),
        "media-repair": lambda body: w_media_repair(contract, body),
        "amane-bridge": lambda body: w_scraping_amane_rebuild(contract, body),
        'jav-discovery-metadata': lambda body: discovery_metadata(contract).ensure(
            body['codes'], refresh=body.get('refresh', False),
            _resume=read(contract.db_path, 'jav-discovery-metadata').get('checkpoint')),
        "organize": lambda body: (w_organize_rollback(contract, body) if body.get('action') == 'rollback'
                                    else w_organize_apply(contract, body)),
    }
    return resume(contract.db_path, {key: track(key, handler) for key, handler in handlers.items()
                                     if key not in skip})


def thread_stacks() -> dict[str, list[str]]:
    """各线程当前的调用栈，只留文件名、行号与函数名：完整路径会被本机日志脱敏成 `<path>`。"""
    names = {thread.ident: thread.name for thread in threading.enumerate()}
    return {f'{names.get(ident, "thread")}-{ident}': [
                f'{Path(frame.filename).name}:{frame.lineno} {frame.name}'
                for frame in traceback.extract_stack(stack)[-40:]]
            for ident, stack in sys._current_frames().items()}


class RecoveryService:
    """接回等着的任务：有事才接，另留低频兜底。

    触发接回的事件：服务启动（`start`）、本进程撤下安装预约或发现预约者已死（`update_tasks`
    的 `released`）、别的进程撤下预约（看见预约后才开的 `RELEASE_POLL_SECONDS` 一问，撤下即停）。
    工作进程死掉这类没人通知的情况由 `FALLBACK_SECONDS` 一轮的兜底接回。
    """

    def __init__(self, contract, *, available):
        self.contract = contract
        self.available = available
        self.scheduler = BackgroundScheduler(timezone=timezone.utc)
        self._running_since = None
        self._step = None
        self._reported = False
        self._tick_lock = threading.Lock()
        self._again = False
        self._awaiting = False
        self._root = None
        #: 第几轮接回；放弃一轮时加一，旧那一轮回来时不再清掉新一轮的记账。
        self._round = 0
        self._round_thread = None
        #: 放弃的那一轮：（线程，卡住的任务键）。线程回来之前这个任务键不再接回，也不再放弃第二轮。
        self._abandoned = None
        self._fallback_job = FALLBACK_JOB

    def start(self):
        if self.available and not self.scheduler.running:
            from .update_tasks import state_for, subscribe
            self._root = state_for(self.contract.db_path)
            self.scheduler.add_job(self.tick, 'interval', seconds=FALLBACK_SECONDS, id=self._fallback_job,
                                   max_instances=1, coalesce=True)
            self.scheduler.add_job(self.watch, 'interval', seconds=10,
                                   max_instances=1, coalesce=True)
            self.scheduler.start()
            subscribe(self._notice)
            # 启动时的那一次接回由 `_LedgerActivation` 先做了；预约还在（安装助手要等新服务就绪才撤）
            # 就从这里开始等它撤下。
            from .update_tasks import is_pausing
            is_pausing(self.contract.db_path)

    def stop(self, timeout=STOP_SECONDS):
        """停调度，最多等 `timeout` 秒让在途的接回收尾；等不到就记下各线程停在哪，返回 False。

        在途的那一轮可能卡在网盘读取上；关停照样往下走，那一轮由下次启动重新接回。"""
        from .update_tasks import unsubscribe
        unsubscribe(self._notice)
        if not self.scheduler.running:
            return True
        def shutdown():
            # 清空待执行项会等正在派发的一轮释放 job store 锁；暂停期间不再开始新一轮派发。
            self.scheduler.pause()
            self.scheduler.remove_all_jobs()
            self.scheduler.shutdown(wait=True)
        closer = threading.Thread(target=shutdown, name='peach-recovery-stop', daemon=True)
        closer.start()
        closer.join(timeout)
        if not closer.is_alive():
            return True
        from . import error_reporting
        error_reporting.local_event('job-recovery-stop-timeout', step=self._step or 'unknown',
                                    seconds=timeout, stacks=thread_stacks())
        return False

    def wake(self):
        """马上接回一次；正在接回时，那一轮跑完再补一轮。"""
        if self.scheduler.running:
            self.scheduler.add_job(self.tick, max_instances=1, misfire_grace_time=None)

    def _notice(self, root, event):
        if root != self._root:
            return
        if event == 'released':
            self._stop_awaiting()
            self.wake()
        elif event == 'pausing' and not self._awaiting and self.scheduler.running:
            # 任务检查点在暂停期间一直在问 `is_pausing`，这里只看一个标志就返回。
            self._awaiting = True
            self.scheduler.add_job(self._await_release, 'interval', seconds=RELEASE_POLL_SECONDS,
                                   id=AWAIT_RELEASE_JOB, replace_existing=True,
                                   max_instances=1, coalesce=True)

    def _await_release(self):
        from .update_tasks import is_pausing
        if is_pausing(self.contract.db_path):
            return
        self._stop_awaiting()
        self.tick()

    def _stop_awaiting(self):
        if not self._awaiting:
            return
        try:
            self.scheduler.remove_job(AWAIT_RELEASE_JOB)
        except JobLookupError:
            pass
        self._awaiting = False

    def _track(self, key, handler):
        def tracked(body):
            self._step = key
            return handler(body)
        return tracked

    def tick(self):
        lock = self._tick_lock
        if not lock.acquire(blocking=False):
            self._again = True
            return
        try:
            self._again = True
            while self._again and lock is self._tick_lock:
                self._again = False
                self._tick_once()
        finally:
            lock.release()

    def _quarantined(self):
        """放弃的那一轮还没回来时，它卡住的任务键；回来了就解除。"""
        abandoned = self._abandoned
        if abandoned is None:
            return ()
        thread, key = abandoned
        if not thread.is_alive():
            self._abandoned = None
            return ()
        return (key,) if key else ()

    def _tick_once(self):
        from .update_tasks import is_pausing
        token = self._round
        self._round_thread = threading.current_thread()
        self._running_since, self._step, self._reported = time.monotonic(), 'update-pause-check', False
        try:
            if not is_pausing(self.contract.db_path):
                self._step = 'job-recovery'
                skip = self._quarantined()
                restore(self.contract, track=self._track, **({'skip': skip} if skip else {}))
                self._step = 'followups'
                self.contract.followups.resume_after_update()
        finally:
            if self._round == token:
                self._running_since = self._step = None

    def _abandon(self, elapsed):
        """放下卡住的那一轮：换一把接回锁，重挂兜底定时（卡住的那次调用一直占着原来那个定时的名额，
        APScheduler 会把之后每一次都跳过），马上另起一轮。卡住的任务键在那一轮回来之前不接。"""
        from . import error_reporting
        step = self._step
        self._abandoned = (self._round_thread, step if step not in (None, 'update-pause-check', 'job-recovery',
                                                                    'followups') else None)
        self._round += 1
        self._tick_lock = threading.Lock()
        self._again = False
        self._running_since = self._step = None
        error_reporting.local_event('job-recovery-abandoned', step=step or 'unknown', seconds=round(elapsed))
        if self.scheduler.running:
            try:
                self.scheduler.remove_job(self._fallback_job)
            except JobLookupError:
                pass
            self._fallback_job = f'{FALLBACK_JOB}-{self._round}'
            self.scheduler.add_job(self.tick, 'interval', seconds=FALLBACK_SECONDS, id=self._fallback_job,
                                   max_instances=1, coalesce=True)
            self.wake()

    def watch(self, now=None):
        """接回卡住时只记一次：卡在哪一步、多久了、各线程停在哪一行（quan he，11-08）。

        卡住期间后来的接回都只记一笔「再来一轮」，日志里看不出卡在哪。"""
        started = self._running_since
        if started is None:
            return
        elapsed = (time.monotonic() if now is None else now) - started
        if elapsed >= ABANDON_SECONDS and self._round_thread is not None and not self._quarantined():
            self._abandon(elapsed)
            return
        if elapsed < STUCK_SECONDS or self._reported:
            return
        self._reported = True
        from . import error_reporting
        error_reporting.local_event('job-recovery-stuck', step=self._step or 'unknown',
                                    seconds=round(elapsed), stacks=thread_stacks())
