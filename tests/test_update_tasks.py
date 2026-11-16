"""升级预检以真实临时账本、进程与文件锁验证任务保护和恢复。"""
import json
from contextlib import contextmanager
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from peach import desktop_installer, job_recovery, settings_file, update_tasks
from peach.jobs import BackgroundJob
from peach.task_runs import TaskRunStore, stamp
from peach.user_messages import UserValueError
from support.ledger import fresh_ledger


class UpdateTaskTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.db = self.root / 'database/ledger.db'
        self.db.parent.mkdir()
        fresh_ledger(self.db.parent)
        self.store = TaskRunStore(self.db)

    def test_restart_keeps_the_run_identity_and_committed_progress(self):
        entered, release = threading.Event(), threading.Event()
        first = BackgroundJob('resume-test', runs=self.store, task_key='feed-check')
        def initial(job_id):
            first.checkpoint(job_id, completed_sources=[1], checked=1, total=3, added=7)
            entered.set()
            release.wait(5)
        original = first.start(initial, recovery={'all': True}, initial={'checked': 0, 'total': 3})
        worker = first.thread
        self.assertTrue(entered.wait(5))
        first.stop(timeout=0)
        release.set()
        worker.join(5)
        self.assertFalse(worker.is_alive())
        self.assertEqual(self.store.get(original['run_id']).status, 'pending')
        second = BackgroundJob('resume-test', runs=self.store, task_key='feed-check')
        observed, processed = [], []
        def resumed(job_id):
            observed.append(second.snapshot())
            for source in (1, 2, 3):
                if source not in observed[0]['completed_sources']:
                    processed.append(source)
            second.update(job_id, checked=3, status='complete')
        result = job_recovery.resume(self.db, {'feed-check': lambda body: second.start(
            resumed, restart=True, recovery=body, initial={'checked': 0, 'total': 0})})
        second.thread.join(5)
        self.assertEqual(result, ['feed-check'])
        self.assertEqual(processed, [2, 3])
        self.assertEqual((observed[0]['job_id'], observed[0]['run_id']),
                         (original['job_id'], original['run_id']))
        self.assertEqual((observed[0]['checked'], observed[0]['total'], observed[0]['added']), (1, 3, 7))

    def test_dead_process_keeps_a_recoverable_run_pending(self):
        run = self.store.start('follow-check', trigger='manual', total=5)
        self.store.progress(run.id, current=3, total=5, throttle=0)
        job_recovery.save(self.db, 'follow-check', 'original', {'older': True}, run_id=run.id, waiting=True)
        self.assertNotIn(run.id, self.store.recover_interrupted())
        pending = self.store.get(run.id)
        self.assertEqual((pending.status, pending.progress_current, pending.progress_total), ('pending', 3, 5))

    def test_recovery_resumes_when_saved_pid_was_reused_by_another_process(self):
        run = self.store.start('library-processing', trigger='manual')
        old_start = stamp(datetime.now(timezone.utc) - timedelta(days=1))
        with self.store.database.write_transaction(notify=False) as connection:
            connection.execute('UPDATE task_run SET started_at=?,heartbeat_at=? WHERE id=?',
                               (old_start, old_start, run.id))
        job_recovery.save(self.db, 'library-processing', 'old-job', {'stage': 'collect'}, run_id=run.id)
        path = update_tasks.state_for(self.db).parent / 'job-recovery/library-processing.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['pid'] = os.getpid()
        path.write_text(json.dumps(data), encoding='utf-8')
        self.store.suspend(run.id)
        observed = []
        job = BackgroundJob('pid-reuse-test', runs=self.store, task_key='library-processing')
        def finish(identity):
            observed.append(job.snapshot())
            job.update(identity, status='complete')
        handler = {'library-processing': lambda request: job.start(finish, restart=True, recovery=request)}
        with patch('peach.jobs.process_creation_time', return_value=datetime.now(timezone.utc).timestamp()):
            self.assertEqual(job_recovery.resume(self.db, handler), ['library-processing'])
        job.thread.join(5)
        self.assertFalse(job.thread.is_alive())
        self.assertEqual((observed[0]['job_id'], observed[0]['run_id']), ('old-job', run.id))
        self.assertEqual(self.store.get(run.id).status, 'succeeded')
        self.assertIsNone(self.store.blocking('library-processing'))

    def test_terminal_checkpoint_is_readable_by_a_new_job_instance(self):
        first = BackgroundJob('resume-test', runs=self.store, task_key='link-check')
        original = first.start(lambda identity: first.update(identity, status='complete', checked=2, total=2), recovery={})
        first.thread.join(5)
        second = BackgroundJob('resume-test', runs=self.store, task_key='link-check')
        self.assertEqual((second.snapshot()['job_id'], second.snapshot()['checked']), (original['job_id'], 2))

    def test_explicit_stop_removes_the_resume_record(self):
        entered, release = threading.Event(), threading.Event()
        job = BackgroundJob('resume-test', runs=self.store, task_key='feed-check')
        def work(identity):
            job.checkpoint(identity, checked=1)
            entered.set()
            release.wait(5)
        original = job.start(work, recovery={})
        worker = job.thread
        try:
            self.assertTrue(entered.wait(5))
            job.stop(timeout=0, resume=False)
            self.assertTrue(worker.is_alive())
            self.assertEqual(self.store.get(original['run_id']).status, 'running')
            self.assertEqual(job_recovery.read(self.db, 'feed-check')['job_id'], original['job_id'])
        finally:
            release.set()
            worker.join(5)
        self.assertFalse(worker.is_alive())
        self.assertEqual(job_recovery.read(self.db, 'feed-check'), {})
        self.assertEqual(self.store.get(original['run_id']).status, 'cancelled')
        replay = []
        self.assertEqual(job_recovery.resume(self.db, {'feed-check': replay.append}), [])
        self.assertEqual(replay, [])

    def test_running_tasks_receive_a_pause_request_when_installation_is_accepted(self):
        for trigger in ('manual', 'scheduled'):
            with self.subTest(trigger=trigger):
                run = TaskRunStore(self.db).start('library-processing', trigger=trigger)
                token = update_tasks.reserve(self.db)
                self.assertTrue(update_tasks.is_pausing(self.db))
                self.assertFalse(update_tasks.wait_quiescent(self.db, timeout=0))
                self.store.finish(run.id, 'succeeded')
                self.assertTrue(update_tasks.wait_quiescent(self.db, timeout=0))
                update_tasks.release(self.db, token)

    def test_pause_checks_do_not_wait_for_the_gate_lock_and_leave_stale_reservations_to_it(self):
        """检查点问「在装更新吗」不取闸门锁；预约者死了只答「否」，文件留给持锁方清。"""
        from filelock import FileLock
        root = update_tasks.state_for(self.db)
        root.mkdir(parents=True, exist_ok=True)
        held, release = threading.Event(), threading.Event()

        def hold():
            with FileLock(root / 'admission.lock'):
                held.set()
                release.wait(10)

        holder = threading.Thread(target=hold)
        holder.start()
        try:
            self.assertTrue(held.wait(5))
            with patch.object(update_tasks, '_mutex', side_effect=AssertionError('检查点取了闸门锁')):
                self.assertFalse(update_tasks.is_pausing(self.db))
                (root / 'install.json').write_text(json.dumps({'pid': os.getpid(), 'token': 't'}), encoding='utf-8')
                self.assertTrue(update_tasks.is_pausing(self.db))
                with patch('peach.jobs.process_alive', return_value=False):
                    self.assertFalse(update_tasks.is_pausing(self.db))
                self.assertTrue((root / 'install.json').is_file())
        finally:
            release.set()
            holder.join(5)
        with patch('peach.jobs.process_alive', return_value=False):
            update_tasks.reserve(self.db)
        self.assertTrue(update_tasks.is_pausing(self.db))

    def test_a_timed_out_gate_is_reported_as_busy_instead_of_a_bare_lock_timeout(self):
        from filelock import FileLock
        root = update_tasks.state_for(self.db)
        root.mkdir(parents=True, exist_ok=True)
        outcome = []

        def admit():
            try:
                with update_tasks.admission(self.db):
                    outcome.append(None)
            except Exception as error:
                outcome.append(error)

        with FileLock(root / 'admission.lock'), patch.object(
                update_tasks, '_mutex', lambda path: FileLock(path / 'admission.lock', timeout=0.05)):
            worker = threading.Thread(target=admit)
            worker.start()
            worker.join(5)
        self.assertIsInstance(outcome[0], update_tasks.GateBusy)
        self.assertIsInstance(outcome[0], update_tasks.UpdateBusy)

    def test_disk_guard_asks_about_installation_only_when_its_check_is_due(self):
        from peach.jobs import DiskGuard
        guard = DiskGuard(self.root, 0, interval_secs=3600)
        with patch.object(update_tasks, 'check_pause') as pause:
            guard.check()
            for _ in range(50):
                self.assertIsNone(guard.check())
            guard.check(force=True)
        self.assertEqual(pause.call_count, 2)

    def test_reservation_prevents_task_start_until_release(self):
        token = update_tasks.reserve(self.db)
        with self.assertRaises(update_tasks.UpdateBusy):
            self.store.start('timeline-thumbnails', trigger='manual')
        job = BackgroundJob('test', runs=self.store, task_key='library-processing')
        called = threading.Event()
        state = job.start(lambda _: called.set(), recovery={'stage': 'previews'})
        self.assertFalse(called.is_set())
        self.assertTrue(state['waiting_for_update'])
        self.assertEqual(job_recovery.read(self.db, 'library-processing')['request'], {'stage': 'previews'})
        update_tasks.release(self.db, token)
        self.assertIsNotNone(self.store.start('timeline-thumbnails', trigger='manual'))

    def test_checkpoint_pause_and_resume_keep_the_same_task_run(self):
        entered, progress = threading.Event(), threading.Event()
        job = BackgroundJob('test', runs=self.store, task_key='library-processing')
        attempts = []
        def work(job_id):
            attempts.append(job_id)
            entered.set()
            progress.wait(5)
            job.update(job_id, status='complete')
        job.start(work, recovery={'stage': 'previews'})
        self.assertTrue(entered.wait(5))
        run_id = job.snapshot()['run_id']
        token = update_tasks.reserve(self.db)
        progress.set()
        job.thread.join(5)
        self.assertFalse(job.thread.is_alive())
        self.assertTrue(update_tasks.wait_quiescent(self.db, timeout=0))
        self.assertEqual(self.store.get(run_id).status, 'pending')
        self.assertEqual(self.store.recover_interrupted(), [])
        self.assertTrue(job.snapshot()['waiting_for_update'])
        update_tasks.release(self.db, token)
        resumed = job_recovery.resume(self.db, {'library-processing':
            lambda body: job.start(work, restart=True, recovery=body)})
        self.assertEqual(resumed, ['library-processing'])
        job.thread.join(5)
        self.assertEqual(len(attempts), 2)
        self.assertEqual(attempts[0], attempts[1])
        self.assertEqual(job.snapshot()['run_id'], run_id)
        self.assertEqual(self.store.get(run_id).status, 'succeeded')

    def test_installation_pause_is_reconciled_when_the_service_exits_during_a_step(self):
        run = self.store.start('library-processing', trigger='manual', pid=-1)
        job_recovery.save(self.db, 'library-processing', 'old', {'stage': 'previews'}, run_id=run.id)
        token = update_tasks.reserve(self.db)
        path = update_tasks.state_for(self.db).parent / 'job-recovery/library-processing.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['pid'] = -1
        path.write_text(json.dumps(data), encoding='utf-8')
        job_recovery.reconcile_paused(self.db)
        self.assertEqual(self.store.get(run.id).status, 'pending')
        self.assertEqual(self.store.recover_interrupted(), [])
        update_tasks.release(self.db, token)

    def test_service_shutdown_during_installation_preserves_the_run_until_its_worker_exits(self):
        entered, release = threading.Event(), threading.Event()
        job = BackgroundJob('test', runs=self.store, task_key='library-processing')
        def work(job_id):
            entered.set()
            release.wait(10)
            job.update(job_id, status='complete')
        state = job.start(work, recovery={'stage': 'previews'})
        thread = job.thread
        token = None
        try:
            self.assertTrue(entered.wait(5))
            token = update_tasks.reserve(self.db)
            job.stop(timeout=0)
            self.assertEqual(self.store.get(state['run_id']).status, 'pending')
            update_tasks.release(self.db, token)
            handler = {'library-processing': lambda body: job.start(work, restart=True, recovery=body)}
            self.assertEqual(job_recovery.resume(self.db, handler), [])
        finally:
            release.set()
            thread.join(5)
            if token is not None:
                update_tasks.release(self.db, token)
        self.assertFalse(thread.is_alive())
        self.assertEqual(job_recovery.resume(self.db, handler), ['library-processing'])
        job.thread.join(5)
        self.assertEqual(job.snapshot()['job_id'], state['job_id'])
        self.assertEqual(job.snapshot()['run_id'], state['run_id'])
        self.assertEqual(self.store.get(state['run_id']).status, 'succeeded')

    def test_another_service_cannot_replace_the_scope_already_waiting_for_installation(self):
        token = update_tasks.reserve(self.db)
        first = BackgroundJob('one', runs=self.store, task_key='library-processing')
        second = BackgroundJob('two', runs=TaskRunStore(self.db), task_key='library-processing')
        original = first.start(lambda _: None, recovery={'stage': 'previews', 'asset_ids': [7]})
        later = second.start(lambda _: None, recovery={'stage': 'metadata', 'asset_ids': [9]})
        self.assertEqual(original['job_id'], later['job_id'])
        self.assertEqual(job_recovery.read(self.db, 'library-processing')['request'],
                         {'stage': 'previews', 'asset_ids': [7]})
        update_tasks.release(self.db, token)

    def test_source_batch_waits_for_installation_and_continues_in_the_same_process(self):
        import argparse
        from peach.jobs import DiskGuard, job_main
        entered, checkpoint = threading.Event(), threading.Event()
        lock = self.root / 'state/.probe.lock'
        parser = argparse.ArgumentParser()
        parser.add_argument('--lock', default=lock, type=Path)
        parser.add_argument('--db', default=self.db, type=Path)
        attempts, results = [], []
        def run(_args):
            guard = DiskGuard(self.root, 0)
            attempts.append(os.getpid())
            entered.set()
            checkpoint.wait(5)
            guard.check()
            return 0
        thread = threading.Thread(target=lambda: results.append(job_main(lambda: parser, run, [])))
        thread.start()
        try:
            self.assertTrue(entered.wait(5))
            token = update_tasks.reserve(self.db)
            checkpoint.set()
            self.assertTrue(update_tasks.wait_quiescent(self.db, timeout=5))
            self.assertTrue(thread.is_alive())
            update_tasks.release(self.db, token)
        finally:
            checkpoint.set()
            update_tasks.release_owner(self.db, os.getpid())
            thread.join(10)
        self.assertEqual(results, [0])
        self.assertEqual(attempts, [os.getpid(), os.getpid()])

    def test_activity_registration_remains_readable_until_the_protected_scan_finishes(self):
        entered, finish, withdrawing = (threading.Event() for _ in range(3))
        errors = []
        mutex, read = update_tasks._mutex, update_tasks._read

        def work():
            try:
                with update_tasks.activity(self.db, '受保护任务'):
                    entered.set()
                    if not finish.wait(5):
                        raise TimeoutError('任务结束信号未取得')
            except Exception as error:
                errors.append(error)
            finally:
                withdrawing.set()

        worker = threading.Thread(target=work)

        @contextmanager
        def observed_mutex(root):
            lock = mutex(root)
            if threading.current_thread() is worker and finish.is_set():
                withdrawing.set()
            with lock:
                yield

        def protected_read(path):
            if path.parent.name == 'active':
                finish.set()
                self.assertTrue(withdrawing.wait(5))
                self.assertTrue(path.is_file(), '受保护扫描期间任务登记必须保留')
            return read(path)

        with patch.object(update_tasks, '_mutex', observed_mutex), patch.object(
                update_tasks, '_read', protected_read):
            worker.start()
            try:
                self.assertTrue(entered.wait(5))
                self.assertEqual(update_tasks._running(self.db), ['受保护任务'])
            finally:
                finish.set()
                worker.join(5)
        self.assertFalse(worker.is_alive())
        self.assertEqual(errors, [])
        self.assertTrue(update_tasks.wait_quiescent(self.db, timeout=0))

    def test_a_live_thread_remains_protected_after_its_record_is_cancelled(self):
        entered, release = threading.Event(), threading.Event()
        job = BackgroundJob('test', runs=self.store, task_key='library-processing')
        def work(_):
            entered.set()
            release.wait(10)
        job.start(work)
        thread = job.thread
        try:
            self.assertTrue(entered.wait(5))
            job.stop(timeout=0)
            token = update_tasks.reserve(self.db)
            self.assertFalse(update_tasks.wait_quiescent(self.db, timeout=0))
        finally:
            release.set()
            thread.join(10)
        self.assertFalse(thread.is_alive())
        self.assertTrue(update_tasks.wait_quiescent(self.db, timeout=0))
        update_tasks.release(self.db, token)

    def child(self, source):
        child = subprocess.Popen([sys.executable, '-X', 'utf8', '-c', source, str(self.db)],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 text=True, encoding='utf-8')
        def cleanup():
            if child.poll() is None:
                child.kill()
            child.communicate(timeout=10)
        self.addCleanup(cleanup)
        return child

    def test_cli_activity_is_observed_without_refusing_the_installation_request(self):
        child = self.child("from pathlib import Path; import sys; "
                           "from peach.update_tasks import register; "
                           "register(Path(sys.argv[1]), 'CLI 抽帧'); print('ready', flush=True); input()")
        self.assertEqual(child.stdout.readline().strip(), 'ready')
        token = update_tasks.reserve(self.db)
        self.assertFalse(update_tasks.wait_quiescent(self.db, timeout=0))
        child.kill()
        child.communicate(timeout=10)
        self.assertTrue(update_tasks.wait_quiescent(self.db, timeout=0))
        update_tasks.release(self.db, token)

    def test_installer_accepts_a_running_task_and_holds_the_pause_until_completion(self):
        config = settings_file.load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        self.store.start('library-processing', trigger='manual')
        error = self.root / 'prepare-error.txt'
        with patch.object(settings_file, 'load_config', return_value=config), patch.object(
                desktop_installer, 'stop', return_value=True) as stop, patch.object(
                update_tasks, 'wait_quiescent', return_value=False):
            self.assertEqual(desktop_installer.prepare(self.root / 'app', os.getpid(), error), 0)
            stop.assert_called_once()
            self.assertFalse(error.exists())
            with self.assertRaises(update_tasks.UpdateBusy):
                self.store.start('timeline-thumbnails', trigger='manual')
            desktop_installer.finish_install(self.root / 'app', os.getpid())
            self.assertIsNotNone(self.store.start('timeline-thumbnails', trigger='manual'))

    def test_unreadable_task_state_keeps_the_database_bytes_for_the_installer_diagnostic(self):
        self.db.write_bytes(b'not sqlite')
        token = update_tasks.reserve(self.db)
        self.assertFalse(update_tasks.wait_quiescent(self.db, timeout=0))
        self.assertEqual(self.db.read_bytes(), b'not sqlite')
        update_tasks.release(self.db, token)

    def test_installer_migration_uses_the_selected_data_directory_and_skips_empty_installs(self):
        config = settings_file.load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        with patch.object(settings_file, 'load_config', return_value=config), patch(
                'peach.cli.main', return_value=0) as migrate:
            self.assertEqual(desktop_installer.migrate_install(self.root / 'app'), 0)
            migrate.assert_called_once_with(['migrate', 'upgrade', '--yes', '--db', str(self.db)])
            migrate.reset_mock()
            self.db.unlink()
            self.assertEqual(desktop_installer.migrate_install(self.root / 'app'), 0)
            migrate.assert_not_called()
            self.assertFalse(self.db.exists())

    def test_installer_owner_handoff_does_not_allow_new_tasks_between_processes(self):
        token = update_tasks.reserve(self.db)
        child = self.child('print("ready", flush=True); input()')
        self.assertEqual(child.stdout.readline().strip(), 'ready')
        update_tasks.transfer(self.db, token, child.pid)
        update_tasks.release(self.db, 'wrong-token')
        with self.assertRaises(update_tasks.UpdateBusy):
            self.store.start('library-processing', trigger='manual')
        child.kill()
        child.communicate(timeout=10)
        self.assertIsNotNone(self.store.start('library-processing', trigger='manual'))

    def test_interrupted_task_request_is_replayed_once_by_two_service_instances(self):
        child = self.child("from pathlib import Path; import sys; from peach.job_recovery import save; "
                           "save(Path(sys.argv[1]), 'library-processing', 'old', "
                           "{'stage':'previews','asset_ids':[7,9]}); print('ready', flush=True); input()")
        self.assertEqual(child.stdout.readline().strip(), 'ready')
        calls = []
        def replay(body):
            calls.append(body)
            job_recovery.save(self.db, 'library-processing', 'new', body)
        handlers = {'library-processing': replay}
        self.assertEqual(job_recovery.resume(self.db, handlers), [])
        child.kill()
        child.communicate(timeout=10)
        self.assertEqual(job_recovery.resume(self.db, handlers), ['library-processing'])
        self.assertEqual(job_recovery.resume(self.db, handlers), [])
        self.assertEqual(calls, [{'stage': 'previews', 'asset_ids': [7, 9]}])

    def test_completed_failed_and_explicitly_cancelled_requests_are_not_replayed(self):
        for status in ('complete', 'failed'):
            job_recovery.save(self.db, 'library-processing', 'a', {'stage': 'collect'})
            job_recovery.finish(self.db, 'library-processing', 'a', status)
            self.assertEqual(job_recovery.read(self.db, 'library-processing')['status'], status)
        job_recovery.cancel(self.db, 'library-processing')
        self.assertEqual(job_recovery.read(self.db, 'library-processing'), {})

    def test_a_stale_request_validation_failure_is_visible_without_an_automatic_retry_loop(self):
        job_recovery.save(self.db, 'library-processing', 'old', {'asset_ids': [404]})
        path = update_tasks.state_for(self.db).parent / 'job-recovery/library-processing.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['pid'] = -1
        path.write_text(json.dumps(data), encoding='utf-8')
        calls = []
        def fail(body):
            calls.append(body)
            raise UserValueError('errors.libraryProcessing.notInLibrary')
        with self.assertLogs('peach.job_recovery', level='WARNING'):
            self.assertEqual(job_recovery.resume(self.db, {'library-processing': fail}), [])
        self.assertEqual(job_recovery.read(self.db, 'library-processing')['status'], 'blocked')
        self.assertEqual(job_recovery.resume(self.db, {'library-processing': fail}), [])
        self.assertEqual(len(calls), 1)


class RecoveryServiceCadenceTests(unittest.TestCase):
    """恢复服务有事才接回：安装中不接，预约撤下立即接，没人通知的情况由低频兜底接。"""

    def setUp(self):
        from types import SimpleNamespace
        from unittest.mock import Mock
        from peach import web_job_recovery
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.db = Path(temporary.name).resolve() / 'database/ledger.db'
        self.db.parent.mkdir()
        self.restored = []
        patcher = patch.object(web_job_recovery, 'restore',
                               side_effect=lambda contract, track=None: self.restored.append(time.monotonic()))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.module = web_job_recovery
        self.service = web_job_recovery.RecoveryService(
            SimpleNamespace(db_path=self.db, followups=Mock()), available=True)
        self.addCleanup(self.service.stop)

    def wait_for(self, predicate, timeout=5.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return True
            time.sleep(.02)
        return predicate()

    def test_stop_waits_for_a_stuck_recovery_only_up_to_its_deadline(self):
        """关停时在途接回卡住：最多等 `timeout` 秒，记下各线程停在哪，不把关停挂住。"""
        import threading
        stuck, release = threading.Event(), threading.Event()
        self.service.start()
        self.addCleanup(release.set)
        self.service.scheduler.add_job(lambda: (stuck.set(), release.wait(30)))
        self.assertTrue(stuck.wait(5))
        with patch('peach.error_reporting.local_event') as event:
            started = time.monotonic()
            self.assertFalse(self.service.stop(timeout=.5))
        self.assertLess(time.monotonic() - started, 3)
        self.assertEqual(event.call_args.args[0], 'job-recovery-stop-timeout')
        self.assertIn('stacks', event.call_args.kwargs)

    def test_stop_finishes_dispatching_a_one_shot_before_shutting_down(self):
        from apscheduler.schedulers.base import STATE_RUNNING
        removing, release = threading.Event(), threading.Event()
        self.addCleanup(release.set)
        remove_job = self.service.scheduler.remove_job
        failures = []

        def remove(job_id, jobstore=None):
            if job_id == 'closing-once':
                removing.set()
                release.wait(5)
            return remove_job(job_id, jobstore)

        with patch.object(self.service.scheduler, 'remove_job', side_effect=remove), \
                patch('threading.excepthook', side_effect=failures.append):
            self.service.start()
            self.service.scheduler.add_job(lambda: None, id='closing-once')
            self.assertTrue(removing.wait(5))
            closer = threading.Thread(target=self.service.stop)
            closer.start()
            try:
                self.assertTrue(self.wait_for(lambda: self.service.scheduler.state != STATE_RUNNING))
            finally:
                release.set()
                closer.join(5)
            self.assertFalse(closer.is_alive())
            self.assertEqual([str(error.exc_value) for error in failures], [])

    def test_an_idle_service_does_not_restore_between_events(self):
        self.service.start()
        time.sleep(.5)
        self.assertEqual(self.restored, [])
        self.assertEqual(self.module.FALLBACK_SECONDS, 30)

    def test_installation_holds_recovery_and_its_release_restores_at_once(self):
        token = update_tasks.reserve(self.db)
        self.service.start()
        self.service.tick()
        self.assertEqual(self.restored, [])
        released = time.monotonic()
        update_tasks.release(self.db, token)
        self.assertTrue(self.wait_for(lambda: self.restored, timeout=2))
        self.assertLess(self.restored[0] - released, 1)
        self.assertIsNone(self.service.scheduler.get_job(self.module.AWAIT_RELEASE_JOB))

    def test_a_reservation_released_by_another_process_is_noticed_while_waiting_for_it(self):
        path = update_tasks.state_for(self.db) / 'install.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'pid': os.getpid(), 'token': 'other'}), encoding='utf-8')
        with patch.object(self.module, 'RELEASE_POLL_SECONDS', .1):
            self.service.start()
            self.assertIsNotNone(self.service.scheduler.get_job(self.module.AWAIT_RELEASE_JOB))
            time.sleep(.3)
            self.assertEqual(self.restored, [])
            # 安装助手在另一个进程里撤下预约，本进程收不到事件。
            path.unlink()
            self.assertTrue(self.wait_for(lambda: self.restored, timeout=2))
        self.assertIsNone(self.service.scheduler.get_job(self.module.AWAIT_RELEASE_JOB))

    def test_a_dead_worker_is_resumed_by_the_fallback_without_any_event(self):
        with patch.object(self.module, 'FALLBACK_SECONDS', .3):
            self.service.start()
            self.assertTrue(self.wait_for(lambda: len(self.restored) >= 2, timeout=3))

    def test_a_recovery_stuck_past_the_limit_is_left_behind_and_later_rounds_skip_only_its_task(self):
        """一轮接回卡在某个任务上太久（#144 报的 tick 卡死后每次都被跳过）：放下那一轮，后面照常接回，
        只是先不碰卡住的那个任务；那一轮自己回来后，那个任务恢复接回。"""
        entered, release = threading.Event(), threading.Event()
        rounds = []

        def restore(contract, track=None, skip=()):
            rounds.append(tuple(skip))
            if len(rounds) == 1:
                def stuck(_body):
                    entered.set()
                    release.wait(5)
                track('library-processing', stuck)({})

        self.addCleanup(release.set)
        with patch.object(self.module, 'restore', side_effect=restore),                 patch('peach.error_reporting.local_event') as event:
            self.service.start()
            worker = threading.Thread(target=self.service.tick, daemon=True)
            worker.start()
            self.assertTrue(entered.wait(5))
            self.service.watch(now=time.monotonic() + self.module.ABANDON_SECONDS + 1)
            self.assertEqual(event.call_args.args[0], 'job-recovery-abandoned')
            self.assertEqual(event.call_args.kwargs['step'], 'library-processing')
            self.assertTrue(self.wait_for(lambda: len(rounds) >= 2, timeout=3), '放下之后马上另起一轮')
            self.assertEqual(rounds[1], ('library-processing',))
            self.assertIsNotNone(self.service.scheduler.get_job(self.service._fallback_job))
            self.assertIsNone(self.service.scheduler.get_job(self.module.FALLBACK_JOB), '兜底定时换了一个')
            release.set()
            worker.join(5)
            self.service.tick()
        self.assertEqual(rounds[-1], (), '卡住的那一轮回来后不再跳过那个任务')

    def test_events_during_a_running_recovery_cause_one_more_round(self):
        entered, release = threading.Event(), threading.Event()
        calls = []

        def slow(contract, track=None):
            calls.append(1)
            if len(calls) == 1:
                entered.set()
                release.wait(5)

        with patch.object(self.module, 'restore', side_effect=slow):
            worker = threading.Thread(target=self.service.tick)
            worker.start()
            self.assertTrue(entered.wait(5))
            self.service.tick()
            self.service.tick()
            release.set()
            worker.join(5)
        self.assertEqual(len(calls), 2)
