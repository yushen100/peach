"""任务控制以临时账本、协作线程和本测试拥有的子进程验证。"""
from __future__ import annotations

from contextvars import copy_context
from contextlib import contextmanager
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

import psutil

from peach import job_recovery, task_control, update_tasks
from peach.jobs import BackgroundJob
from peach.task_runs import TaskRunStore
from support.ledger import fresh_ledger


HEARTBEAT_CHILD = """
from pathlib import Path
import sys
import time
path = Path(sys.argv[1])
print('child-output', flush=True)
print('child-error', file=sys.stderr, flush=True)
for _ in range(int(sys.argv[2])):
    with path.open('ab') as handle:
        handle.write(b'x')
    time.sleep(.02)
"""


class TaskControlTests(unittest.TestCase):
    def test_output_activity_allows_a_process_to_outlive_the_idle_timeout(self):
        command = [sys.executable, '-u', '-c',
                   "import time; [(print(i, flush=True), time.sleep(.15)) for i in range(8)]"]
        chunks = []
        result = task_control.run(command, capture_output=True, idle_timeout=.8, on_stdout=chunks.append)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(b''.join(chunks), result.stdout)
        self.assertEqual(len(result.stdout.splitlines()), 8)

    def test_a_stalled_process_is_reaped_and_retains_its_output(self):
        ready = self.root / 'stalled-ready'
        command = [sys.executable, '-u', '-c',
                   "import subprocess,sys,time; from pathlib import Path; "
                   "child=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)']); "
                   "print('started',child.pid,flush=True); Path(sys.argv[1]).touch(); time.sleep(30)", str(ready)]
        with self.record_child(), self.process_output_started(ready):
            with self.assertRaises(subprocess.TimeoutExpired) as caught:
                task_control.run(command, capture_output=True, idle_timeout=.8)
        self.assertIn(b'started', caught.exception.output)
        self.assertFalse(psutil.pid_exists(int(caught.exception.output.split()[1])))
        self.assertIsNotNone(self.children[-1].poll())

    def test_reaping_returns_when_an_escaped_grandchild_still_holds_the_output_pipes(self):
        marker = self.root / 'grandchild-pid'
        command = [sys.executable, '-c',
                   "import subprocess,sys; from pathlib import Path; "
                   "child=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)'],"
                   "stdout=sys.stdout,stderr=sys.stderr); Path(sys.argv[1]).write_text(str(child.pid))",
                   str(marker)]
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.children.append(process)
        self.wait_until(lambda: process.poll() is not None and marker.is_file(), '子进程没有派出孙进程')
        grandchild = psutil.Process(int(marker.read_text()))
        self.addCleanup(lambda: psutil.wait_procs([grandchild], timeout=5))
        self.addCleanup(grandchild.kill)
        started = time.monotonic()
        with patch.object(task_control, 'REAP_SECONDS', .5), \
                self.assertLogs('peach.task_control', 'WARNING') as logged:
            output = task_control._reap_process(process, None)
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(output, (b'', b''))
        self.assertTrue(grandchild.is_running())
        self.assertIn(str(process.pid), logged.output[0])

    def test_stderr_activity_does_not_extend_the_stdout_idle_timeout(self):
        command = [sys.executable, '-u', '-c',
                   "import sys,time; [(print('decode error', file=sys.stderr, flush=True), time.sleep(.1)) "
                   "for _ in range(300)]"]
        with self.record_child(), self.assertRaises(subprocess.TimeoutExpired) as caught:
            task_control.run(command, capture_output=True, idle_timeout=.8)
        self.assertIn(b'decode error', caught.exception.stderr)
        self.assertIsNotNone(self.children[-1].poll())

    def test_output_monitor_keeps_the_text_result_and_binary_callback_contracts(self):
        chunks = []
        command = [sys.executable, '-u', '-c', "print('sample')"]
        result = task_control.run(command, capture_output=True, text=True, encoding='utf-8',
                                  idle_timeout=1, on_stdout=chunks.append)
        self.assertEqual(result.stdout, 'sample\n')
        self.assertEqual(b''.join(chunks).replace(b'\r\n', b'\n'), b'sample\n')
        with self.assertRaisesRegex(ValueError, 'capture_output'):
            task_control.run(command, idle_timeout=1)

    def test_a_pause_requested_inside_progress_projection_suspends_the_owned_child(self):
        path = self.root / 'heartbeat-progress'
        ready = self.root / 'progress-ready'
        chunks = []
        def work(job, identity):
            def progress(chunk):
                chunks.append(chunk)
                if len(chunks) == 1:
                    task_control.request(self.store, job.snapshot()['run_id'], 'pause')
                job.update(identity, checked=len(chunks))
            command = [sys.executable, '-u', '-c',
                       "import sys,time\nfrom pathlib import Path\n"
                       "p, ready = map(Path, sys.argv[1:])\n"
                       "for i in range(200):\n"
                       "    p.write_bytes(str(i).encode())\n"
                       "    print(i, flush=True)\n"
                       "    if i == 0: ready.touch()\n"
                       "    time.sleep(.15)\n", str(path), str(ready)]
            task_control.run(command, capture_output=True, idle_timeout=.8, on_stdout=progress)
        with self.record_child(), self.process_output_started(ready):
            job, original = self.start(work)
            run_id = original['run_id']

            def paused():
                state = self.state(run_id)
                self.assertIsNotNone(state, f'暂停前任务已结束：{job.snapshot()!r}')
                return state['state'] == 'paused'

            self.wait_until(paused)
            before = path.read_bytes()
            time.sleep(1)
            self.assertEqual(path.read_bytes(), before)
            count = len(chunks)
            task_control.request(self.store, run_id, 'resume')
            self.wait_until(lambda: len(chunks) > count)
            self.assertEqual(self.store.get(run_id).status, 'running')
            task_control.request(self.store, run_id, 'cancel')
            job.thread.join(5)
            self.assertFalse(job.thread.is_alive())
            self.assertEqual(self.store.get(run_id).status, 'cancelled', job.snapshot())

    def test_idle_timeout_excludes_a_user_pause_and_cancel_reaps_the_process(self):
        chunks = []
        command = [sys.executable, '-u', '-c',
                   "import time; [(print(i, flush=True), time.sleep(.15)) for i in range(200)]"]
        def work(_job, _identity):
            task_control.run(command, capture_output=True, idle_timeout=.8, on_stdout=chunks.append)
        with self.record_child():
            job, original = self.start(work)
            self.wait_until(lambda: len(chunks) >= 2)
            run_id = original['run_id']
            task_control.request(self.store, run_id, 'pause')
            self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
            time.sleep(1)
            count = len(chunks)
            task_control.request(self.store, run_id, 'resume')
            self.wait_until(lambda: len(chunks) > count)
            self.assertEqual(self.store.get(run_id).status, 'running')
            task_control.request(self.store, run_id, 'cancel')
            job.thread.join(5)
            self.assertFalse(job.thread.is_alive())
            self.assertEqual(self.store.get(run_id).status, 'cancelled')
            self.assertIsNotNone(self.children[-1].poll())

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        database = self.root / 'database'
        database.mkdir()
        self.db = fresh_ledger(database)
        self.store = TaskRunStore(self.db)
        self.jobs = []
        self.children = []
        self.releases = []
        self.addCleanup(self._finish_owned_work)

    def _finish_owned_work(self):
        for event in self.releases:
            event.set()
        for job in reversed(self.jobs):
            state = job.snapshot() or {}
            worker = job.thread
            if worker is not None and worker.is_alive():
                run_id = state.get('run_id')
                run = self.store.get(run_id) if run_id is not None else None
                if run is not None and run.active:
                    task_control.request(self.store, run_id, 'cancel')
                worker.join(5)
                self.assertFalse(worker.is_alive(), '本测试的后台任务没有退出')
        for child in self.children:
            if child.poll() is None:
                child.kill()
            child.communicate(timeout=5)

    def event(self):
        event = threading.Event()
        self.releases.append(event)
        return event

    def wait_until(self, predicate, message='任务没有到达预期状态', timeout=5):
        deadline = time.monotonic() + timeout
        while not predicate():
            if time.monotonic() >= deadline:
                self.fail(message)
            time.sleep(.01)

    def state(self, run_id):
        return task_control.projection(self.store, self.store.get(run_id))

    def start(self, work, *, key='control-test', recovery=None):
        job = BackgroundJob('PeachControlTest', task_key=key, runs=self.store)
        self.jobs.append(job)
        original = job.start(lambda identity: work(job, identity), recovery=recovery,
                             initial={'checked': 0, 'total': 10})
        return job, original

    def record_child(self):
        original = subprocess.Popen

        def create(*args, **kwargs):
            child = original(*args, **kwargs)
            self.children.append(child)
            return child

        return patch('peach.task_control.subprocess.Popen', side_effect=create)

    @contextmanager
    def process_output_started(self, ready):
        wait_process = task_control._wait_process

        def wait(process, *args, **kwargs):
            self.wait_until(ready.is_file, '真实子进程尚未完成首个输出')
            return wait_process(process, *args, **kwargs)

        with patch('peach.task_control._wait_process', wait):
            yield

    @staticmethod
    def child_command(path, count):
        return [sys.executable, '-u', '-c', HEARTBEAT_CHILD, str(path), str(count)]

    def test_new_tasks_snapshot_the_default_and_runtime_speed_stays_local(self):
        from peach.processing_control import default_mode
        from peach.web_settings import w_settings
        w_settings(self.store.database, {'taskSpeedMode': 'low'})
        first = self.store.start('scan', trigger='manual')
        w_settings(self.store.database, {'taskSpeedMode': 'high'})
        second = self.store.start('probe', trigger='manual')
        self.assertEqual(self.state(first.id)['speed_mode'], 'low')
        self.assertEqual(self.state(second.id)['speed_mode'], 'high')
        task_control.request(self.store, first.id, 'set_speed', mode='standard')
        self.assertEqual(self.state(first.id)['speed_mode'], 'standard')
        self.assertEqual(self.state(second.id)['speed_mode'], 'high')
        self.assertEqual(default_mode(self.store.database), 'high')
        with self.assertRaises(ValueError):
            task_control.request(self.store, first.id, 'set_speed', mode='fast')
        self.assertEqual(self.state(first.id)['speed_mode'], 'standard')

    def test_parent_speed_reaches_existing_and_future_followups_and_preserves_pause(self):
        parent = self.store.start('parent', trigger='manual')
        child_id = self.store.enqueue_followups(parent.id, [('leaf:1', 'leaf', '')])['queued'][0]
        task_control.request(self.store, parent.id, 'pause')
        task_control.request(self.store, parent.id, 'set_speed', mode='low')
        self.assertEqual(self.state(child_id)['state'], 'paused')
        self.assertEqual(self.state(child_id)['speed_mode'], 'low')
        task_control.request(self.store, child_id, 'set_speed', mode='high')
        self.assertEqual(self.state(parent.id)['speed_mode'], 'low')
        child = self.store.get(child_id)
        self.store.finish(child_id, 'succeeded')
        continued = self.store.continue_followup(child)
        self.assertEqual(self.state(continued)['speed_mode'], 'high')
        task_control.request(self.store, parent.id, 'set_speed', mode='standard')
        self.assertEqual(self.state(continued)['speed_mode'], 'standard')
        later = self.store.enqueue_followups(parent.id, [('leaf:2', 'leaf', '')])['queued'][0]
        self.assertEqual(self.state(later)['speed_mode'], 'standard')
        reopened = task_control.Control(TaskRunStore(self.db), later)
        self.assertEqual(reopened.mode, 'standard')

    def test_generic_tasks_share_io_intervals_and_ffmpeg_thread_options(self):
        from peach.processing_control import checkpoint, ffmpeg_options, low_mode
        run = self.store.start('probe', trigger='manual')
        with task_control.bind(self.store, run.id) as control:
            for mode, interval, threads in (('low', 1.5, ['-threads', '1']),
                                             ('standard', .25, ['-threads', '2']),
                                             ('high', 0, [])):
                task_control.request(self.store, run.id, 'set_speed', mode=mode)
                with patch.object(control, 'checkpoint'), patch('peach.task_control.time.monotonic', return_value=100):
                    checkpoint('network')
                    self.assertEqual(control.next_work['network'], 100 + interval)
                self.assertEqual(ffmpeg_options(), threads)
                self.assertEqual(low_mode(), mode == 'low')

    def test_speed_initialization_failure_rolls_back_the_task_and_its_mutex(self):
        with patch('peach.task_control.atomic_write_text', side_effect=PermissionError('speed file denied')):
            with self.assertRaises(PermissionError):
                self.store.start('probe', trigger='manual', mutex_key='probe')
        self.assertEqual(self.store.query(), [])
        parent = self.store.start('probe', trigger='manual', mutex_key='probe')
        with patch('peach.task_control.atomic_write_text', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.store.enqueue_followups(parent.id, [('leaf:1', 'leaf', '')])
        self.assertEqual(self.store.children(parent.id), [])
        child = self.store.get(self.store.enqueue_followups(parent.id, [('leaf:1', 'leaf', '')])['queued'][0])
        self.store.finish(child.id, 'succeeded')
        with patch('peach.task_control.atomic_write_text', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.store.continue_followup(child)
        self.assertEqual([row.id for row in self.store.children(parent.id)], [child.id])

    def test_prune_removes_expired_speed_files_and_preserves_active_and_recent_runs(self):
        old = self.store.start('probe', trigger='manual')
        self.store.finish(old.id, 'succeeded')
        recent = self.store.start('probe', trigger='manual')
        self.store.finish(recent.id, 'succeeded')
        active = self.store.start('probe', trigger='manual')
        root = update_tasks.state_for(self.db).parent / 'task-controls'
        orphan = root / '999999.speed.json'
        orphan.write_text('{"speed_mode":"high"}', encoding='utf-8')
        self.assertEqual(self.store.prune('probe', keep=1), 1)
        self.assertFalse((root / f'{old.id}.speed.json').exists())
        self.assertFalse(orphan.exists())
        self.assertTrue((root / f'{recent.id}.speed.json').exists())
        self.assertTrue((root / f'{active.id}.speed.json').exists())
        (root / f'{active.id}.speed.json').unlink()
        self.assertEqual(self.state(active.id)['speed_mode'], 'standard')
        self.assertIsNone(task_control.speed_mode(self.db, active.id, default=None))

    def test_finished_runs_leave_no_runtime_files_while_live_families_keep_their_intent(self):
        root = update_tasks.state_for(self.db).parent / 'task-controls'

        def files(run_id):
            return sorted(path.name.split('.')[1] for path in root.glob(f'{run_id}.*.json'))

        with self.store.track('probe', trigger='manual') as handle:
            self.assertEqual(files(handle.run_id), ['observed', 'resources', 'speed'])
        self.assertEqual(files(handle.run_id), ['speed'])
        parent = self.store.start('chain', trigger='manual')
        with task_control.bind(self.store, parent.id):
            child = self.store.enqueue_followups(parent.id, [('leaf:1', 'leaf', '')])['queued'][0]
            task_control.request(self.store, parent.id, 'pause')
        self.store.finish(parent.id, 'succeeded')
        running = self.store.start('other', trigger='manual')
        orphan = '999999'
        for kind in ('observed', 'resources', 'request', 'speed'):
            (root / f'{orphan}.{kind}.json').write_text('{}', encoding='utf-8')
        with task_control.bind(self.store, running.id):
            self.store.prune('probe')
            self.assertEqual(files(running.id), ['observed', 'resources', 'speed'])
        # 已结束的父任务还有在排的后继：后继沿用它的暂停与速度，即时状态没有读者了。
        self.assertEqual(files(parent.id), ['request', 'speed'])
        self.assertEqual(files(child), ['request', 'speed'])
        self.assertEqual(self.state(child)['state'], 'paused')
        self.assertEqual(files(orphan), [])
        self.assertEqual(task_control.prune_controls(self.store), 0)

    def test_pause_and_resume_keep_the_same_job_and_run_without_progress_while_paused(self):
        finish = self.event()
        progress = []

        def work(job, identity):
            while not finish.is_set():
                task_control.checkpoint()
                progress.append(identity)
                job.update(identity, checked=len(progress))
                time.sleep(.01)
            job.update(identity, status='complete')

        job, original = self.start(work)
        self.wait_until(lambda: len(progress) >= 2)
        run_id = original['run_id']
        task_control.request(self.store, run_id, 'pause')
        self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
        paused_count = len(progress)
        time.sleep(.1)
        self.assertEqual(len(progress), paused_count)
        task_control.request(self.store, run_id, 'resume')
        self.wait_until(lambda: len(progress) > paused_count)
        self.assertEqual((job.snapshot()['job_id'], job.snapshot()['run_id']),
                         (original['job_id'], run_id))
        self.assertEqual([row.id for row in self.store.query()], [run_id])
        finish.set()
        job.thread.join(5)
        self.assertFalse(job.thread.is_alive())
        self.assertEqual(self.store.get(run_id).status, 'succeeded')

    def test_paused_work_rereads_its_control_slowly_and_wakes_on_a_resume_from_this_process(self):
        finish = self.event()
        progress = []

        def work(job, identity):
            while not finish.is_set():
                task_control.checkpoint()
                progress.append(identity)
                time.sleep(.01)
            job.update(identity, status='complete')

        _job, original = self.start(work)
        self.wait_until(lambda: len(progress) >= 2)
        run_id = original['run_id']
        task_control.request(self.store, run_id, 'pause')
        self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
        reads = []
        intent = task_control.intent
        with patch.object(task_control, 'intent', side_effect=lambda *args: reads.append(1) or intent(*args)):
            time.sleep(1.5)
        # 停稳之后约每秒重读一次控制文件，而不是每 0.1 秒。
        self.assertLessEqual(len(reads), 3)
        paused_count = len(progress)
        resumed = time.monotonic()
        task_control.request(self.store, run_id, 'resume')
        self.wait_until(lambda: len(progress) > paused_count)
        self.assertLess(time.monotonic() - resumed, .5)
        # 别的进程写下的继续（本进程收不到叫醒）在一个重读间隔内生效。
        task_control.request(self.store, run_id, 'pause')
        self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
        paused_count = len(progress)
        with update_tasks._mutex(update_tasks.state_for(self.db)):
            task_control._request(self.store, run_id, 'resume')
        self.wait_until(lambda: len(progress) > paused_count, timeout=task_control.PAUSED_POLL_SECONDS + 1)
        finish.set()

    def test_cancel_stays_running_until_work_exits_and_rejects_a_stale_resume(self):
        entered, reach_checkpoint = self.event(), self.event()
        unwinding, allow_exit = self.event(), self.event()

        def work(_job, _identity):
            try:
                entered.set()
                reach_checkpoint.wait(5)
                task_control.checkpoint()
            finally:
                unwinding.set()
                allow_exit.wait(5)

        job, original = self.start(work)
        self.assertTrue(entered.wait(5))
        run_id = original['run_id']
        task_control.request(self.store, run_id, 'cancel')
        self.assertEqual(self.store.get(run_id).status, 'running')
        self.assertEqual(self.state(run_id), {'state': 'cancelling', 'actions': [], 'speed_mode': 'standard'})
        with self.assertRaises(ValueError):
            task_control.request(self.store, run_id, 'resume')
        reach_checkpoint.set()
        self.assertTrue(unwinding.wait(5))
        self.assertEqual(self.store.get(run_id).status, 'running')
        allow_exit.set()
        job.thread.join(5)
        self.assertFalse(job.thread.is_alive())
        self.assertEqual(self.store.get(run_id).status, 'cancelled')
        self.assertEqual(job.snapshot()['status'], 'cancelled')

    def test_a_finished_parent_controls_active_grandchildren_and_later_pending_work(self):
        parent = self.store.start('parent', trigger='manual')
        child_id = self.store.enqueue_followups(parent.id, [('child:1', 'child', '子任务')])['queued'][0]
        self.store.finish(child_id, 'succeeded')
        grandchild_id = self.store.enqueue_followups(child_id, [('leaf:1', 'leaf', '孙任务')])['queued'][0]
        self.store.finish(parent.id, 'succeeded')
        task_control.request(self.store, parent.id, 'pause')
        self.assertEqual(self.state(parent.id)['state'], 'paused')
        late_id = self.store.enqueue_followups(parent.id, [('leaf:2', 'leaf', '后来排入的任务')])['queued'][0]
        self.assertIsNone(self.store.claim_followup(['leaf']))
        self.assertEqual(self.state(late_id)['state'], 'paused')
        task_control.request(self.store, parent.id, 'resume')
        self.assertEqual(self.store.claim_followup(['leaf']).id, grandchild_id)
        self.store.finish(grandchild_id, 'succeeded')
        self.assertEqual(self.store.claim_followup(['leaf']).id, late_id)
        self.store.finish(late_id, 'succeeded')
        self.assertIsNone(self.state(parent.id))

    def test_a_parent_with_many_queued_followups_is_projected_without_a_query_per_followup(self):
        """一轮补全派出上千条后继：任务中心每次轮询算父卡的控制状态，连接数不随后继条数增长。"""
        parent = self.store.start('parent', trigger='manual')
        self.store.enqueue_followups(parent.id, [(f'leaf:{n}', 'leaf', f'后继 {n}') for n in range(50)])
        self.store.finish(parent.id, 'succeeded')
        original = self.store.database.read_connection
        opened = []

        def counted():
            opened.append(1)
            return original()

        run = self.store.get(parent.id)
        with patch.object(self.store.database, 'read_connection', side_effect=counted):
            self.assertEqual(task_control.projection(self.store, run)['state'], 'running')
            running = len(opened)
            task_control.request(self.store, parent.id, 'pause')
            opened.clear()
            self.assertEqual(task_control.projection(self.store, run)['state'], 'paused')
        self.assertLessEqual(running, 2)
        self.assertLessEqual(len(opened), 3)

    def test_cancelled_parent_does_not_run_followups_enqueued_after_the_request(self):
        parent = self.store.start('parent', trigger='manual')
        first = self.store.enqueue_followups(parent.id, [('leaf:1', 'leaf', '原任务')])['queued'][0]
        self.store.finish(parent.id, 'succeeded')
        task_control.request(self.store, parent.id, 'cancel')
        self.assertEqual(self.store.get(first).status, 'cancelled')
        late = self.store.enqueue_followups(parent.id, [('leaf:2', 'leaf', '后来排入的任务')])['queued'][0]
        self.assertIsNone(self.store.claim_followup(['leaf']))
        self.assertEqual(self.store.get(late).status, 'cancelled')

    def test_resuming_a_parent_cannot_undo_an_accepted_child_cancellation(self):
        parent = self.store.start('parent', trigger='manual')
        child_id = self.store.enqueue_followups(parent.id, [('leaf:1', 'leaf', '子任务')])['queued'][0]
        self.store.finish(parent.id, 'succeeded')
        child = self.store.claim_followup(['leaf'])
        task_control.request(self.store, child_id, 'cancel')
        task_control.request(self.store, parent.id, 'pause')
        task_control.request(self.store, parent.id, 'resume')
        self.assertEqual(task_control.requested(self.db, child.id, (parent.id,)), 'cancel')
        self.assertEqual(self.state(child.id)['state'], 'cancelling')
        self.store.finish(child.id, 'cancelled')

    def test_a_pending_database_commit_prevents_another_worker_from_confirming_pause(self):
        entered, commit, finish = self.event(), self.event(), self.event()
        errors = []
        def work(job, identity):
            def peer():
                try:
                    entered.wait(5)
                    while not finish.is_set():
                        task_control.checkpoint()
                        time.sleep(.01)
                except BaseException as error:
                    errors.append(error)
            worker = threading.Thread(target=copy_context().run, args=(peer,))
            worker.start()
            try:
                with self.store.database.write_transaction() as connection:
                    connection.execute("INSERT INTO asset(location,path,name,medium) VALUES('local','sample.mp4','sample','video')")
                    entered.set()
                    commit.wait(5)
                task_control.checkpoint()
                finish.set()
            finally:
                worker.join(5)
            if errors:
                raise errors[0]
            job.update(identity, status='complete')
        job, original = self.start(work)
        self.assertTrue(entered.wait(5))
        run_id = original['run_id']
        task_control.request(self.store, run_id, 'pause')
        self.wait_until(lambda: self.state(run_id)['state'] == 'pausing')
        self.assertEqual(self.state(run_id)['state'], 'pausing')
        commit.set()
        self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
        task_control.request(self.store, run_id, 'resume')
        job.thread.join(5)
        self.assertFalse(job.thread.is_alive())
        self.assertEqual(self.store.get(run_id).status, 'succeeded')

    def test_parallel_operations_are_not_paused_until_every_inflight_step_parks(self):
        entered = [self.event(), self.event()]
        release = [self.event(), self.event()]
        after_step = []
        errors = []

        def operation(index):
            try:
                with task_control.operation():
                    entered[index].set()
                    release[index].wait(5)
                task_control.checkpoint()
                after_step.append(index)
            except BaseException as error:
                errors.append(error)

        def work(job, identity):
            workers = [threading.Thread(target=copy_context().run, args=(operation, index))
                       for index in range(2)]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(5)
                if worker.is_alive():
                    raise RuntimeError('并行操作未退出')
            if errors:
                raise errors[0]
            job.update(identity, status='complete')

        job, original = self.start(work)
        self.assertTrue(all(event.wait(5) for event in entered))
        run_id = original['run_id']
        task_control.request(self.store, run_id, 'pause')
        release[0].set()
        self.wait_until(lambda: self.state(run_id)['state'] == 'pausing')
        self.assertEqual(after_step, [])
        release[1].set()
        self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
        self.assertEqual(after_step, [])
        task_control.request(self.store, run_id, 'resume')
        job.thread.join(5)
        self.assertFalse(job.thread.is_alive())
        self.assertEqual(sorted(after_step), [0, 1])
        self.assertEqual(self.store.get(run_id).status, 'succeeded')

    def test_pause_stops_both_owned_children_and_cancel_reaps_them_before_settlement(self):
        paths = [self.root / f'heartbeat-{index}' for index in range(2)]
        errors = []

        def child_work(path):
            try:
                task_control.run(self.child_command(path, 10000), capture_output=True, timeout=10,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            except BaseException as error:
                errors.append(error)

        def work(_job, _identity):
            workers = [threading.Thread(target=copy_context().run, args=(child_work, path)) for path in paths]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(10)
                if worker.is_alive():
                    raise RuntimeError('本测试的子进程管理线程未退出')
            if errors:
                raise errors[0]

        with self.record_child():
            job, original = self.start(work)
            self.wait_until(lambda: all(path.exists() and path.stat().st_size >= 2 for path in paths))
            run_id = original['run_id']
            task_control.request(self.store, run_id, 'pause')
            self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
            paused_sizes = [path.stat().st_size for path in paths]
            time.sleep(.15)
            self.assertEqual([path.stat().st_size for path in paths], paused_sizes)
            task_control.request(self.store, run_id, 'resume')
            self.wait_until(lambda: all(path.stat().st_size > size for path, size in zip(paths, paused_sizes)))
            task_control.request(self.store, run_id, 'cancel')
            job.thread.join(5)
            self.assertFalse(job.thread.is_alive())
            self.assertEqual(self.store.get(run_id).status, 'cancelled')
            self.assertEqual(len(self.children), 2)
            self.assertTrue(all(child.poll() is not None for child in self.children))

    def test_child_output_is_preserved_and_user_pause_does_not_consume_its_timeout(self):
        path = self.root / 'heartbeat-finite'
        result = []

        # 托管 macOS 上短 sleep 会被系统合并拉长，心跳少留余量；暂停 5.2 秒超过超时，证明暂停不计入。
        def work(job, identity):
            result.append(task_control.run(self.child_command(path, 30), capture_output=True, timeout=5,
                                          creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)))
            job.update(identity, status='complete')

        with self.record_child():
            job, original = self.start(work)
            self.wait_until(lambda: path.exists() and path.stat().st_size >= 2)
            task_control.request(self.store, original['run_id'], 'pause')
            self.wait_until(lambda: self.state(original['run_id'])['state'] == 'paused')
            time.sleep(5.2)
            task_control.request(self.store, original['run_id'], 'resume')
            job.thread.join(5)
            self.assertFalse(job.thread.is_alive())
            run = self.store.get(original['run_id'])
            self.assertEqual(run.status, 'succeeded', run)
            self.assertEqual(result[0].returncode, 0)
            self.assertIn(b'child-output', result[0].stdout)
            self.assertIn(b'child-error', result[0].stderr)
            self.assertIsNotNone(self.children[0].poll())

    def test_input_and_output_survive_repeated_communicate_timeouts(self):
        run = self.store.start('input-output', trigger='manual')
        command = [sys.executable, '-u', '-c',
                   "import sys,time; data=sys.stdin.buffer.read(); time.sleep(.25); "
                   "sys.stdout.buffer.write(data); sys.stderr.buffer.write(b'diagnostic')"]
        with self.record_child(), task_control.bind(self.store, run.id):
            result = task_control.run(command, input=b'payload\nsecond line', capture_output=True, timeout=5,
                                      creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.assertEqual(result.stdout, b'payload\nsecond line')
        self.assertEqual(result.stderr, b'diagnostic')
        self.assertEqual(result.returncode, 0)
        self.store.finish(run.id, 'succeeded')

    def test_timeout_keeps_partial_output_and_reaps_the_owned_child(self):
        run = self.store.start('timeout-output', trigger='manual')
        ready = self.root / 'timeout-ready'
        command = [sys.executable, '-u', '-c',
                   "import sys,time; from pathlib import Path; print('partial-output',flush=True); "
                   "print('partial-error',file=sys.stderr,flush=True); Path(sys.argv[1]).touch(); time.sleep(10)",
                   str(ready)]
        with self.record_child(), self.process_output_started(ready), task_control.bind(self.store, run.id):
            with self.assertRaises(subprocess.TimeoutExpired) as caught:
                task_control.run(command, capture_output=True, timeout=1,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.assertIn(b'partial-output', caught.exception.output or b'')
        self.assertIn(b'partial-error', caught.exception.stderr or b'')
        self.assertIsNotNone(self.children[0].poll())
        self.store.finish(run.id, 'failed')

    def test_user_paused_recoverable_work_yields_to_installation_and_resumes_the_same_run(self):
        progressed = self.event()

        def work(job, identity):
            job.checkpoint(identity, checked=1, completed_items=[7])
            progressed.set()
            while True:
                task_control.checkpoint()
                time.sleep(.01)

        first, original = self.start(work, key='feed-check', recovery={'all': True})
        self.assertTrue(progressed.wait(5))
        run_id = original['run_id']
        task_control.request(self.store, run_id, 'pause')
        self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
        token = update_tasks.reserve(self.db)
        try:
            first.thread.join(5)
            self.assertFalse(first.thread.is_alive())
            self.assertTrue(update_tasks.wait_quiescent(self.db, timeout=1))
            self.assertEqual(self.store.get(run_id).status, 'pending')
        finally:
            update_tasks.release(self.db, token)
        second = BackgroundJob('PeachControlTest', task_key='feed-check', runs=self.store)
        self.jobs.append(second)
        resumed = []

        def resume(identity):
            resumed.append(second.snapshot())
            second.update(identity, status='complete')

        job_recovery.resume(self.db, {'feed-check': lambda request: second.start(
            resume, restart=True, recovery=request)})
        self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
        self.assertEqual(resumed, [])
        task_control.request(self.store, run_id, 'resume')
        self.wait_until(lambda: bool(resumed))
        second.thread.join(5)
        self.assertFalse(second.thread.is_alive())
        self.assertEqual((resumed[0]['job_id'], resumed[0]['run_id'], resumed[0]['completed_items']),
                         (original['job_id'], run_id, [7]))
        self.assertEqual(self.store.get(run_id).status, 'succeeded')

    def test_shutdown_of_nonrecoverable_paused_work_does_not_leave_a_pending_resume_row(self):
        entered = self.event()

        def work(_job, _identity):
            entered.set()
            while True:
                task_control.checkpoint()
                time.sleep(.01)

        job, original = self.start(work)
        self.assertTrue(entered.wait(5))
        run_id = original['run_id']
        worker = job.thread
        task_control.request(self.store, run_id, 'pause')
        self.wait_until(lambda: self.state(run_id)['state'] == 'paused')
        token = update_tasks.reserve(self.db)
        try:
            job.stop(timeout=5)
            self.assertFalse(worker.is_alive())
            self.assertIn(self.store.get(run_id).status, ('cancelled', 'interrupted'))
            self.assertNotEqual(job_recovery.read(self.db, 'control-test').get('status'), 'active')
        finally:
            update_tasks.release(self.db, token)
