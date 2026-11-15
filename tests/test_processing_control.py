"""馆藏处理控制与启动粗估的隔离行为回归。"""
import json
import tempfile
import threading
import time
import unittest
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from peach import job_recovery
from peach.processing_control import (CURRENT, ProcessingControl, ProcessingEstimate,
                                      checkpoint, control_for, initial_estimate, user_paused, deadline_after)
from peach.settings_file import PeachConfig
from peach.task_stages import stage as stage_fields
from peach.web_library_processing import w_library_processing
from support.ledger import fresh_ledger


class ProcessingControlTests(unittest.TestCase):
    def assert_processing_status(self, contract, expected):
        from peach.web_library_processing import q_library_processing
        deadline = time.monotonic() + 5
        while True:
            state = q_library_processing(contract, {})
            if state['status'] == expected or time.monotonic() >= deadline:
                self.assertEqual(state['status'], expected)
                return state
            threading.Event().wait(.01)

    def test_failed_worker_keeps_retries_out_until_its_real_lock_is_released(self):
        from filelock import FileLock, Timeout
        from peach.jobs import BackgroundJob
        from peach.library_processing import _save, state_path
        from peach.web_library_processing import _current
        job = BackgroundJob('library-processing')
        contract = SimpleNamespace(db_path=self.db, library_processing_job=job)
        path = state_path(self.config)
        path.parent.mkdir(parents=True, exist_ok=True)
        _save(path, {'job_id': 'old', 'status': 'failed', 'started_at': 1, 'error': '旧错误'})
        failed, release = threading.Event(), threading.Event()
        def work(job_id):
            with FileLock(str(path) + '.lock', timeout=0):
                job.update(job_id, status='failed', error='当前处理失败')
                failed.set()
                release.wait(10)
        job.start(work)
        self.addCleanup(release.set)
        self.assertTrue(failed.wait(5))
        identity = job.snapshot()['job_id']
        try:
            with patch('peach.web_library_processing.settings_file.active', return_value=self.config):
                with self.assertRaises(Timeout), FileLock(str(path) + '.lock', timeout=0):
                    pass
                state = _current(contract)
                self.assertEqual((state['job_id'], state['status']), (identity, 'stopping'))
                retried = w_library_processing(contract, {'retry': True})
                self.assertEqual((retried['job_id'], retried['status']), (identity, 'stopping'))
                release.set()
                job.thread.join(5)
                self.assertFalse(job.thread.is_alive())
                with FileLock(str(path) + '.lock', timeout=0):
                    pass
                current = _current(contract)
                self.assertEqual((current['job_id'], current['error']), (identity, '当前处理失败'))
                _save(path, {'job_id': 'external', 'status': 'complete',
                             'started_at': job.snapshot()['started_at'] + 1})
                self.assertEqual(_current(contract)['job_id'], 'external')
        finally:
            release.set()
            job.thread.join(5)

    def test_skip_intent_is_shared_scoped_and_cleared_before_next_asset(self):
        from peach.processing_control import ItemSkipped, processing_item
        control = ProcessingControl(self.root / 'skip-control.json')
        with control.bind('job', publish=lambda **values: None, active=lambda: True, db_path=self.db):
            with self.assertRaises(ItemSkipped), processing_item(1):
                other = ProcessingControl(control.path)
                other.skip_current('job', 1)
                control.refresh(force=True)
                checkpoint('network')
            with processing_item(2):
                checkpoint('network')
            self.assertIsNone(ProcessingControl(control.path).skip_asset_id)
            with self.assertRaises(ValueError):
                control.skip_current('stale', 2)

    def test_skip_action_rejects_stale_asset_and_local_work(self):
        contract = SimpleNamespace(library_processing_job=Mock())
        state = {'job_id': 'current', 'status': 'running', 'current_asset_id': 1, 'current_action': 'querying_metadata'}
        contract.library_processing_job.snapshot.return_value = state
        with patch('peach.web_library_processing.settings_file.active', return_value=self.config):
            for body in ({'asset_id': 2}, {'asset_id': True}, {'asset_id': '1'}):
                with self.assertRaises(ValueError):
                    w_library_processing(contract, {'action': 'skip_current', 'job_id': 'current', **body})
            state['current_action'] = 'generating_preview'
            with self.assertRaises(ValueError):
                w_library_processing(contract, {'action': 'skip_current', 'job_id': 'current', 'asset_id': 1})

    def test_skip_preserves_published_results_and_records_retryable_item(self):
        from peach.processing_control import processing_item
        from peach.library_processing import _collect_allowed
        control = ProcessingControl(self.root / 'partial-skip.json')
        remote, traffic = Mock(), Mock()
        published, issues = [], []
        def collect(*args, **options):
            options['received']([('javdb', {'title': '已取得的资料'}, self.root / 'evidence.json')])
            control.skip_current('job', 1)
            checkpoint('network')
        remote.collect.side_effect = collect
        with control.bind('job', publish=lambda **values: None, active=lambda: True, db_path=self.db):
            result = _collect_allowed(remote, traffic, {'id': 1}, 'ABC-123', ['title'], {'metadata'},
                self.root, [], update=lambda **values: None,
                issue=lambda row, message, **values: issues.append(values), answered=(),
                received=published.extend, succeeded=lambda: not issues)
            self.assertEqual(result, ([], 0))
            self.assertEqual(published[0][1]['title'], '已取得的资料')
            self.assertEqual(issues[0], {'action': 'skipped', 'retryable': True})
            remote.reset.assert_called_once()
            traffic.finish_work.assert_called_with('metadata', 'ABC-123', successful=False)
            with processing_item(2):
                checkpoint('network')

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.config = PeachConfig(self.root, self.root / 'config.toml', present=True,
                                  locations={'local': ('R:\\Media',)})
        self.db = fresh_ledger(self.root)

    def seed(self, count=10):
        import sqlite3
        with closing(sqlite3.connect(self.db)) as connection, connection:
            for index in range(count):
                connection.execute('INSERT INTO asset(location,path,name,medium,size) VALUES(?,?,?,?,?)',
                                   ('local', f'R:\\Media\\{index}.mp4', f'{index}.mp4', 'video', 1024**3))

    def test_start_estimate_uses_known_count_size_and_scoped_selection(self):
        self.seed()
        estimate = initial_estimate(self.config, self.db, 'all')
        chosen = initial_estimate(self.config, self.db, 'all', [1, 2])
        low = initial_estimate(self.config, self.db, 'all', mode='low')
        high = initial_estimate(self.config, self.db, 'all', mode='high')
        self.assertEqual(estimate['estimate_file_count'], 10)
        self.assertEqual(estimate['estimate_bytes'], 10 * 1024**3)
        self.assertGreater(estimate['eta_seconds_max'], estimate['eta_seconds_min'])
        self.assertLess(chosen['eta_seconds_max'], estimate['eta_seconds_max'])
        self.assertGreater(low['eta_seconds_max'], estimate['eta_seconds_max'])
        self.assertLess(high['eta_seconds_max'], estimate['eta_seconds_max'])
        self.assertTrue(estimate['eta_initial'])
        self.assertIn('未含未知新增', estimate['eta_scope'])

    def test_new_directory_reports_counting_without_invented_time(self):
        estimate = initial_estimate(self.config, self.db, 'scan')
        self.assertIsNone(estimate['eta_seconds_min'])
        self.assertIsNone(estimate['eta_seconds_max'])
        self.assertIn('统计', estimate['eta_basis'])

    def test_progress_calibrates_range_and_paused_time_does_not_count(self):
        self.seed()
        state = dict(initial_estimate(self.config, self.db, 'metadata'),
                     requested_stage='metadata', status='running', **stage_fields('library.checkCompanions'), checked=0, total=10)
        with patch('peach.processing_control.time.monotonic', return_value=100):
            estimate = ProcessingEstimate(self.config, state, None)
            estimate.update(state)
        state['checked'] = 2
        with patch('peach.processing_control.time.monotonic', return_value=110):
            estimate.update(state)
        self.assertEqual(state['eta_kind'], 'measured')
        self.assertFalse(state['eta_initial'])
        self.assertLessEqual(state['eta_seconds_min'], 40)
        self.assertGreaterEqual(state['eta_seconds_max'], 40)
        frozen = (state['eta_seconds_min'], state['eta_seconds_max'])
        state['status'] = 'paused'
        with patch('peach.processing_control.time.monotonic', return_value=9999):
            estimate.update(state)
        self.assertEqual((state['eta_seconds_min'], state['eta_seconds_max']), frozen)

    def test_metadata_passes_use_independent_measured_samples(self):
        self.seed()
        state = dict(initial_estimate(self.config, self.db, 'metadata'),
                     requested_stage='metadata', status='running', **stage_fields('library.checkCompanions'), checked=0, total=10)
        with patch('peach.processing_control.time.monotonic', return_value=100):
            estimate = ProcessingEstimate(self.config, state, None)
            estimate.update(state)
        state['checked'] = 3
        with patch('peach.processing_control.time.monotonic', return_value=103):
            estimate.update(state)
        self.assertEqual(state['eta_kind'], 'measured')
        state.update(**stage_fields('library.fetchMetadata'), checked=0)
        with patch('peach.processing_control.time.monotonic', return_value=200):
            estimate.update(state)
        self.assertTrue(state['eta_initial'])
        self.assertEqual(state['eta_kind'], 'estimating')
        self.assertEqual(state['eta_scope'], '整趟任务')
        state['checked'] = 2
        with patch('peach.processing_control.time.monotonic', return_value=204):
            estimate.update(state)
        self.assertLessEqual(state['eta_seconds_min'], 16)
        self.assertGreaterEqual(state['eta_seconds_max'], 16)
        self.assertLess(state['eta_seconds_max'], 40)

    def test_total_estimate_includes_pending_media_and_collection(self):
        state = dict(speed_mode='standard', status='running', requested_stage='all',
                     **stage_fields('library.checkCompanions'), checked=0, total=10,
                     estimate_pending={'local': 10, 'probe': 2, 'previews': 3, 'metadata': 10})
        with patch('peach.processing_control.time.monotonic', return_value=100):
            estimate = ProcessingEstimate(self.config, state, None)
            estimate.update(state)
        state['checked'] = 8
        with patch('peach.processing_control.time.monotonic', return_value=108):
            estimate.update(state)
        self.assertEqual(state['eta_scope'], '整趟任务')
        self.assertTrue(state['eta_initial'])
        self.assertGreater(state['eta_seconds_min'], 40)
        state.update(checked=0, total=2, **stage_fields('library.fetchMetadata'), estimate_pending={'metadata': 2})
        with patch('peach.processing_control.time.monotonic', return_value=120):
            estimate.update(state)
        self.assertLessEqual(state['eta_seconds_max'], 40)

    def test_unmeasured_finalization_does_not_keep_a_completed_phase_estimate(self):
        state = dict(speed_mode='standard', status='running', requested_stage='metadata',
                     **stage_fields('library.saveCandidates'), checked=10, total=10, estimate_pending={},
                     eta_seconds_min=1, eta_seconds_max=2)
        estimate = ProcessingEstimate(self.config, state, None)
        estimate.update(state)
        self.assertIsNone(state['eta_seconds_max'])

    def test_slow_tail_uses_recent_completions_instead_of_the_fast_prefix(self):
        state = dict(speed_mode='standard', status='running', requested_stage='metadata',
                     **stage_fields('library.checkCompanions'), checked=0, total=120, estimate_pending={'local': 120})
        with patch('peach.processing_control.time.monotonic', return_value=100):
            estimate = ProcessingEstimate(self.config, state, None)
            estimate.update(state)
        for done in range(1, 101):
            state['checked'] = done
            elapsed = done if done <= 80 else 80 + (done - 80) * 10
            with patch('peach.processing_control.time.monotonic', return_value=100 + elapsed):
                estimate.update(state)
        self.assertGreaterEqual(state['eta_seconds_min'], 150)
        self.assertGreaterEqual(state['eta_seconds_max'], 240)

    def test_progress_count_rewind_starts_a_new_sample_for_same_stage(self):
        self.seed()
        state = dict(initial_estimate(self.config, self.db, 'metadata'),
                     requested_stage='metadata', status='running', **stage_fields('library.probeMedia'), checked=0, total=10)
        with patch('peach.processing_control.time.monotonic', return_value=100):
            estimate = ProcessingEstimate(self.config, state, None)
            estimate.update(state)
        state['checked'] = 5
        with patch('peach.processing_control.time.monotonic', return_value=150):
            estimate.update(state)
        state['checked'] = 0
        with patch('peach.processing_control.time.monotonic', return_value=200):
            estimate.update(state)
        self.assertEqual(state['eta_kind'], 'estimating')
        state['checked'] = 2
        with patch('peach.processing_control.time.monotonic', return_value=202):
            estimate.update(state)
        self.assertLessEqual(state['eta_seconds_min'], 8)
        self.assertGreaterEqual(state['eta_seconds_max'], 8)
        self.assertLess(state['eta_seconds_max'], 20)

    def test_pause_waits_at_checkpoint_and_resume_releases_same_job(self):
        control = control_for(self.config)
        entered, paused, finished = threading.Event(), threading.Event(), threading.Event()
        errors = []
        def publish(**values):
            if values['status'] == 'paused':
                paused.set()
        def worker():
            try:
                with control.bind('one', publish=publish, active=lambda: True, db_path=self.db, mode='high'):
                    entered.set()
                    control.request('pause', 'one')
                    checkpoint('probe')
                    finished.set()
            except BaseException as exc:
                errors.append(exc)
        thread = threading.Thread(target=worker)
        thread.start()
        self.addCleanup(lambda: control.request('resume', 'one'))
        self.addCleanup(lambda: thread.join(2))
        self.assertTrue(entered.wait(2))
        self.assertTrue(paused.wait(2))
        self.assertFalse(finished.is_set())
        self.assertTrue(user_paused(self.db, 'one'))
        control.request('resume', 'one')
        thread.join(2)
        self.assertFalse(thread.is_alive())
        self.assertTrue(finished.is_set())
        self.assertEqual(errors, [])
        self.assertFalse(user_paused(self.db, 'one'))

    def test_a_paused_checkpoint_rereads_its_control_about_once_a_second(self):
        from peach import processing_control
        control = control_for(self.config)
        paused, finished = threading.Event(), threading.Event()

        def worker():
            with control.bind('one', publish=lambda **values: values['status'] == 'paused' and paused.set(),
                              active=lambda: True, db_path=self.db, mode='high'):
                control.request('pause', 'one')
                checkpoint('probe')
                finished.set()

        thread = threading.Thread(target=worker)
        thread.start()
        self.addCleanup(lambda: thread.join(2))
        self.addCleanup(lambda: control.request('resume', 'one'))
        self.assertTrue(paused.wait(2))
        reads = []
        original = processing_control._read
        with patch.object(processing_control, '_read', side_effect=lambda path: reads.append(path) or original(path)):
            time.sleep(1.5)
        self.assertLessEqual(len(reads), 3)
        resumed = time.monotonic()
        control.request('resume', 'one')
        self.assertTrue(finished.wait(2))
        # 本进程的继续立刻叫醒停点，不等满一秒。
        self.assertLess(time.monotonic() - resumed, .5)

    def test_saved_pause_intent_prevents_automatic_restart(self):
        control = control_for(self.config)
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db, mode='high'):
            control.request('pause', 'one')
        restored = ProcessingControl(control.path)
        self.assertTrue(restored.paused)
        self.assertEqual(restored.mode, 'high')
        job_recovery.save(self.db, 'library-processing', 'one', {'stage': 'scan'}, waiting=True)
        handler = Mock()
        self.assertEqual(job_recovery.resume(self.db, {'library-processing': handler}), [])
        handler.assert_not_called()

    def test_low_mode_leaves_io_gaps_and_preserves_unrelated_context(self):
        control = control_for(self.config)
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db, mode='low'), \
                patch('peach.processing_control.time.monotonic', return_value=10), \
                patch.object(control.event, 'wait', side_effect=lambda _: control.request('set_speed', mode='standard')) as wait:
            checkpoint('network')
            checkpoint('network')
            wait.assert_called_once()
        self.assertIsNone(CURRENT.get())
        checkpoint('network')
        restored = ProcessingControl(control.path)
        self.assertEqual(restored.mode, 'standard')

    def test_stale_job_control_is_rejected(self):
        contract = SimpleNamespace(library_processing_job=Mock())
        contract.library_processing_job.snapshot.return_value = {'job_id': 'current', 'status': 'running'}
        with patch('peach.web_library_processing.settings_file.active', return_value=self.config):
            with self.assertRaisesRegex(ValueError, '任务已变化'):
                w_library_processing(contract, {'action': 'pause', 'job_id': 'stale'})
            with self.assertRaisesRegex(ValueError, '任务已变化'):
                w_library_processing(contract, {'action': 'set_speed', 'job_id': 'stale', 'speed_mode': 'low'})

    def test_completed_timing_is_available_for_next_initial_estimate(self):
        self.seed()
        state = dict(initial_estimate(self.config, self.db, 'metadata'),
                     requested_stage='metadata', status='running')
        with patch('peach.processing_control.time.monotonic', return_value=100):
            estimate = ProcessingEstimate(self.config, state, None)
        state['status'] = 'complete'
        with patch('peach.processing_control.time.monotonic', return_value=200):
            estimate.update(state)
        next_run = initial_estimate(self.config, self.db, 'metadata')
        self.assertEqual(next_run['eta_kind'], 'historical')
        self.assertTrue(next_run['eta_initial'])
        self.assertEqual(json.loads((self.config.directory('state') / 'library-processing-timing.json').read_text()),
                         {'metadata': 10.0})

    def test_action_deadline_keeps_the_same_budget_after_user_pause(self):
        control = control_for(self.config)
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db), \
                patch('peach.processing_control.time.monotonic', return_value=100):
            deadline = deadline_after(90)
            self.assertEqual(deadline - 110, 80)
            control.paused_seconds += 3600
            self.assertEqual(deadline - 3710, 80)
            self.assertEqual((deadline + 5) - 3710, 85)
            self.assertTrue(3710 < deadline)
            self.assertTrue(3800 > deadline)

    def test_cancel_crosses_process_control_and_releases_a_paused_checkpoint(self):
        from peach.jobs import JobCancelled
        control = control_for(self.config)
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db):
            control.request('pause', 'one')
            external = ProcessingControl(control.path)
            external.request('cancel', 'one')
            control.refresh(force=True)
            with self.assertRaises(JobCancelled):
                checkpoint()
            self.assertFalse(control.paused)
        control.select_job('two')
        self.assertFalse(control.cancelled)

    def test_new_asset_ranges_keep_later_arrivals_out_of_an_existing_request(self):
        from peach.library_new_assets import pending, remember
        from peach.web_library_processing import _processing_request
        from peach.repository import LedgerDatabase
        root=self.config.directory('database')
        root.mkdir(parents=True)
        db=fresh_ledger(root)
        database=LedgerDatabase(db)
        with database.write_transaction() as connection:
            for key in (1,2,3):
                connection.execute("INSERT INTO asset(id,location,path,name,medium) VALUES(?,'local',?,?,'video')",
                    (key,f'R:\\Media\\{key}.mp4',f'{key}.mp4'))
        contract=SimpleNamespace(db_path=db,database=database)
        remember(db,[1,2])
        _,ids,stage=_processing_request(contract,self.config,{}, {'stage':'collect','scope':'new'})
        self.assertEqual(ids,[1,2])
        remember(db,[3])
        self.assertEqual(_processing_request(contract,self.config,{}, {'stage':stage,'asset_ids':ids})[1],[1,2])
        remember(db,completed=ids)
        self.assertEqual(pending(db),[3])
        with self.assertRaises(ValueError):
            _processing_request(contract,self.config,{}, {'scope':'new','retry':[]})
        remember(db,completed=[3])
        with self.assertRaisesRegex(ValueError,'暂无'):
            _processing_request(contract,self.config,{}, {'scope':'new'})

    def test_new_asset_range_imports_a_legacy_scan_checkpoint(self):
        import json
        from peach.library_new_assets import pending
        from peach.update_tasks import state_for
        self.seed(3)
        state=state_for(self.db).parent/'library-processing.json'
        state.parent.mkdir(parents=True,exist_ok=True)
        state.write_text(json.dumps({'status':'complete','requested_stage':'scan',
            'scan_checkpoints':{'root':{'result':{'new_ids':[1,2,3]}}},
            'completed_metadata':['1:R:\\Media\\0.mp4']}),encoding='utf-8')
        self.assertEqual(pending(self.db),[2,3])

    def test_new_asset_range_is_read_under_the_writer_lock(self):
        """`remember` 持锁原子替换文件；Windows 替换瞬间读会撞上共享冲突，所以读也要等同一把锁。"""
        from filelock import FileLock
        from peach.library_new_assets import pending
        from peach.update_tasks import state_for
        self.seed(3)
        path=state_for(self.db).parent/'library-new-assets.json'
        path.parent.mkdir(parents=True,exist_ok=True)
        outcome={}

        def read():
            try:
                outcome['ids']=pending(self.db)
            except Exception as error:
                outcome['error']=error
        with FileLock(str(path)+'.lock'):
            path.write_text('[1, 2',encoding='utf-8')
            reader=threading.Thread(target=read)
            reader.start()
            reader.join(0.5)
            self.assertTrue(reader.is_alive(),f'写入方持锁期间读到了半份文件：{outcome}')
            path.write_text('[1, 2]',encoding='utf-8')
        reader.join(5)
        self.assertEqual(outcome,{'ids':[1,2]})

    def test_new_asset_range_is_empty_before_any_state_exists(self):
        from peach.library_new_assets import pending
        self.seed(1)
        self.assertEqual(pending(self.db),[])

    def test_a_damaged_new_asset_range_is_set_aside_and_the_next_scan_starts_over(self):
        """断电或同步盘留下的半份文件不能让之后每次轮询都报错；改名留证，扫描重新登记。"""
        from peach.library_new_assets import pending, remember
        from peach.update_tasks import state_for
        self.seed(3)
        path=state_for(self.db).parent/'library-new-assets.json'
        path.parent.mkdir(parents=True,exist_ok=True)
        for damaged in ('[1, 2', '{"ids": [1]}', '[0, "2"]'):
            with self.subTest(damaged=damaged):
                path.write_text(damaged,encoding='utf-8')
                with self.assertLogs('peach.library_new_assets','WARNING'):
                    self.assertEqual(pending(self.db),[])
                self.assertFalse(path.exists())
                self.assertEqual(path.with_name(path.name+'.invalid').read_text(encoding='utf-8'),damaged)
        remember(self.db,[2])
        self.assertEqual(pending(self.db),[2])

    def test_archiving_keeps_full_legacy_issues_and_export_rejects_changes(self):
        import json
        from peach.library_processing import state_path,_save
        from peach.web_library_processing import q_library_processing_issues
        from peach.repository import LedgerDatabase
        root=self.config.directory('database')
        root.mkdir(parents=True)
        db=fresh_ledger(root)
        job=Mock()
        job.snapshot.return_value=None
        contract=SimpleNamespace(db_path=db,database=LedgerDatabase(db),library_processing_job=job)
        state={'job_id':'legacy','status':'failed','issue_count':250,
               'issues':[{'asset_id':None,'message':f'问题 {index}'} for index in range(250)]}
        _save(state_path(self.config),state)
        with patch('peach.web_library_processing.settings_file.active',return_value=self.config):
            archived=w_library_processing(contract,{'action':'archive','job_id':'legacy'})
            self.assertTrue(archived['archived'])
            self.assertEqual(json.loads(state_path(self.config).read_text(encoding='utf-8'))['issues'],state['issues'])
            first=q_library_processing_issues(contract,{'job_id':'legacy','limit':200})
            last=q_library_processing_issues(contract,{'job_id':'legacy','limit':200,'offset':200,'revision':first['revision']})
            self.assertEqual(first['rows']+last['rows'],state['issues'])
            restored=w_library_processing(contract,{'action':'unarchive','job_id':'legacy'})
            self.assertFalse(restored['archived'],'撤销归档后提示回来')
            self.assertEqual(json.loads(state_path(self.config).read_text(encoding='utf-8'))['issues'],state['issues'])
            state['issues'].append({'asset_id':None,'message':'恢复后新增的问题'})
            _save(state_path(self.config),state)
            with self.assertRaisesRegex(ValueError,'变化'):
                q_library_processing_issues(contract,{'job_id':'legacy','offset':200,'revision':first['revision']})

    def test_retry_set_removes_retired_assets_without_testing_mount_availability(self):
        from peach.repository import LedgerDatabase
        from peach.web_library_processing import _remaining_retry_ids
        self.seed(3)
        database=LedgerDatabase(self.db)
        with database.write_transaction() as connection:
            connection.execute("UPDATE asset SET disposal='vanished' WHERE id=2")
            connection.execute('DELETE FROM asset WHERE id=3')
        contract=SimpleNamespace(database=database)
        self.assertEqual(_remaining_retry_ids(contract,{'retryable_asset_ids':[1,2,3]}),[1])

    def test_cancelled_recovery_is_not_replayed_after_the_writer_exits(self):
        from peach.task_runs import TaskRunStore
        store = TaskRunStore(self.db)
        run = store.start('library-processing', trigger='manual')
        job_recovery.save(self.db, 'library-processing', 'one', {'stage':'metadata'},
                          run_id=run.id, waiting=True)
        job_recovery.checkpoint(self.db, 'library-processing', 'one',
                                {'job_id': 'one', 'status': 'running', 'stage': '准备处理'})
        control = control_for(self.config)
        control.select_job('one')
        control.request('cancel', 'one')
        handler = Mock()
        self.assertEqual(job_recovery.resume(self.db, {'library-processing':handler}), [])
        handler.assert_not_called()
        self.assertEqual(store.get(run.id).status, 'cancelled')
        saved = job_recovery.read(self.db, 'library-processing')
        self.assertEqual((saved['status'], saved['checkpoint']['status']), ('cancelled', 'cancelled'))
        from peach.jobs import BackgroundJob
        self.assertEqual(BackgroundJob('library-processing', runs=store).snapshot()['status'], 'cancelled',
                         '再启动后的页面状态是终态，不是挡住新任务的 running')

    def test_a_cancelled_recovery_left_by_a_dead_process_does_not_block_a_new_job(self):
        """恢复记录已取消、进度快照还停在 running 时，重启后的新请求要能另起一趟。"""
        from peach.jobs import BackgroundJob
        from peach.library_processing import _save, state_path
        from peach.task_runs import TaskRunStore
        from peach.update_tasks import state_for
        from peach.web_library_processing import q_library_processing
        root = self.config.directory('database')
        root.mkdir(parents=True)
        db = fresh_ledger(root)
        store = TaskRunStore(db)
        run = store.start('library-processing', trigger='manual')
        store.finish(run.id, 'cancelled', error='用户停止任务')
        dead = 2 ** 30
        stale = {'job_id': 'stale', 'status': 'running', 'run_id': run.id, 'started_at': time.time() - 8 * 86400,
                 'stage': '准备处理', 'requested_stage': 'all', 'speed_mode': 'high'}
        recovery = state_for(db).parent / 'job-recovery' / 'library-processing.json'
        recovery.parent.mkdir(parents=True)
        recovery.write_text(json.dumps({'job_id': 'stale', 'pid': dead, 'status': 'cancelled',
                                        'request': {'stage': 'all'}, 'run_id': run.id,
                                        'checkpoint': stale}, ensure_ascii=False), encoding='utf-8')
        (state_for(db) / 'active').mkdir(parents=True)
        (state_for(db) / 'active' / 'dead.json').write_text(
            json.dumps({'pid': dead, 'label': 'library-processing'}), encoding='utf-8')
        (self.config.directory('state') / 'library-processing-control.json').write_text(json.dumps(
            {'speed_mode': 'high', 'job_id': 'stale', 'paused': False, 'cancelled': True,
             'skip_asset_id': None}), encoding='utf-8')
        _save(state_path(self.config), {**stale, 'status': 'failed', 'stage': '扫描文件',
                                        'error': '处理被中断，可重试未完成的部分。'})
        job = BackgroundJob('library-processing', runs=store)
        self.addCleanup(job.stop, timeout=None)
        contract = SimpleNamespace(db_path=db, library_processing_job=job, database=store.database,
            task_runs=store, candidate_root=self.root/'candidates', cover_root=self.root/'covers',
            cache_bust=lambda: None)
        def process(*_args, **kwargs):
            return {'status': 'complete', 'stage': '完成'}
        with patch('peach.web_library_processing.settings_file.active', return_value=self.config), patch(
                'peach.web_library_processing.process_library', side_effect=process):
            self.assertEqual(q_library_processing(contract, {})['status'], 'cancelled')
            started = w_library_processing(contract, {'stage': 'collect'})
            self.assertNotEqual(started['job_id'], 'stale')
            job.thread.join(5)
            state = self.assert_processing_status(contract, 'complete')
            self.assertEqual(state['job_id'], started['job_id'])
            self.assertEqual(job_recovery.read(db, 'library-processing')['job_id'], started['job_id'])

    def test_cancel_waits_for_inflight_work_and_retains_results(self):
        from peach.jobs import BackgroundJob
        from peach.library_processing import _save, state_path
        from peach.task_runs import TaskRunStore
        from peach.web_library_processing import q_library_processing
        root = self.config.directory('database')
        root.mkdir(parents=True)
        db = fresh_ledger(root)
        job = BackgroundJob('library-processing', runs=TaskRunStore(db))
        self.addCleanup(job.stop, timeout=None)
        contract = SimpleNamespace(db_path=db, library_processing_job=job, database=job.runs.database,
            task_runs=job.runs,
            candidate_root=self.root/'candidates', cover_root=self.root/'covers', cache_bust=lambda:None)
        entered, release = threading.Event(), threading.Event()
        self.addCleanup(release.set)
        def process(*_args, **kwargs):
            identity = kwargs['job_id']
            with control_for(self.config).bind(identity, publish=lambda **v:kwargs['report'](v),
                                               active=lambda:True, db_path=db):
                _save(state_path(self.config), {'job_id':identity,'status':'running','candidates':3})
                kwargs['report']({'candidates':3})
                entered.set()
                release.wait(5)
                checkpoint()
                self.fail('取消后不能领取下一项')
        with patch('peach.web_library_processing.settings_file.active',return_value=self.config), patch(
                'peach.web_library_processing.process_library',side_effect=process):
            initial=w_library_processing(contract,{'stage':'metadata'})
            self.assertTrue(entered.wait(2))
            try:
                state=w_library_processing(contract,{'action':'cancel','job_id':initial['job_id']})
                self.assertEqual(state['status'],'stopping')
                self.assertEqual(job.runs.get(initial['run_id']).status,'running')
                self.assertEqual(w_library_processing(contract,{'stage':'collect'})['job_id'],initial['job_id'])
            finally:
                release.set()
                job.thread.join(5)
            self.assertFalse(job.thread.is_alive())
            self.assertEqual(job.snapshot()['status'],'cancelled')
            self.assertEqual(job.snapshot()['candidates'],3)
            self.assertEqual(job.runs.get(initial['run_id']).status,'cancelled')
            self.assertEqual(q_library_processing(contract,{})['status'],'cancelled')
            self.assertEqual(job_recovery.resume(db,{'library-processing':Mock()}),[])

    def test_status_names_how_a_command_line_run_was_started(self):
        from peach.task_runs import TaskRunStore
        from peach.web_library_processing import q_library_processing
        root = self.config.directory('database')
        root.mkdir(parents=True)
        db = fresh_ledger(root)
        runs = TaskRunStore(db)
        # 命令行那一轮在另一个进程里写状态；这里用一份进行中的快照代替，状态里没有 `run_id`。
        job = Mock()
        job.snapshot.return_value = {'job_id': 'cli', 'status': 'running', 'started_at': 1}
        contract = SimpleNamespace(db_path=db, library_processing_job=job, task_runs=runs)
        with patch('peach.web_library_processing.settings_file.active', return_value=self.config):
            self.assertNotIn('trigger', q_library_processing(contract, {}))
            run = runs.start('library-processing', trigger='cli')
            self.assertEqual(q_library_processing(contract, {})['trigger'], 'cli')
            runs.finish(run.id, 'succeeded')
            job.snapshot.return_value = {'job_id': 'cli', 'status': 'complete', 'started_at': 1}
            self.assertNotIn('trigger', q_library_processing(contract, {}))

    def test_web_pause_and_resume_preserve_running_job_and_initial_estimate(self):
        from peach.jobs import BackgroundJob
        from peach.library_processing import _save, state_path
        from peach.web_library_processing import q_library_processing
        from peach.repository import LedgerDatabase
        from peach.task_runs import TaskRunStore
        database_root = self.config.directory('database')
        database_root.mkdir(parents=True)
        db = fresh_ledger(database_root)
        job = BackgroundJob('library-processing', runs=TaskRunStore(LedgerDatabase(db)))
        self.addCleanup(job.stop, timeout=None)
        contract = SimpleNamespace(db_path=db, library_processing_job=job,
                                   task_runs=job.runs,
                                   candidate_root=self.root / 'candidates', cover_root=self.root / 'covers',
                                   database=job.runs.database, cache_bust=lambda: None)
        entered, advance, done = (threading.Event() for _ in range(3))
        calls, errors = [], []
        def process(*_args, **kwargs):
            identity = kwargs['job_id']
            calls.append(identity)
            def report(**values):
                kwargs['report'](values)
            try:
                with control_for(self.config).bind(identity, publish=report, active=lambda: True, db_path=db):
                    _save(state_path(self.config), dict(job_id=identity, status='running', requested_stage='metadata'))
                    entered.set()
                    advance.wait(2)
                    checkpoint()
                    done.set()
                    return {'status': 'complete'}
            except BaseException as exc:
                errors.append(exc)
                raise
        with patch('peach.web_library_processing.settings_file.active', return_value=self.config), \
                patch('peach.web_library_processing.process_library', side_effect=process):
            initial = w_library_processing(contract, {'stage': 'metadata', 'speed_mode': 'high'})
            self.assertIn('eta_seconds_max', initial)
            self.assertEqual(initial['speed_mode'], 'high')
            self.assertTrue(entered.wait(2))
            run_id = initial['run_id']
            identity = initial['job_id']
            reply = w_library_processing(contract, {'action': 'pause', 'job_id': identity})
            self.assertEqual(reply['status'], 'pausing')
            advance.set()
            self.assert_processing_status(contract, 'paused')
            self.assertEqual(q_library_processing(contract, {})['status'], 'paused')
            self.assertFalse(done.is_set())
            w_library_processing(contract, {'action': 'resume', 'job_id': identity})
            job.thread.join(2)
            self.assertTrue(done.is_set())
            self.assertEqual(job.snapshot()['status'], 'complete')
            self.assertEqual(job.snapshot()['run_id'], run_id)
            self.assertEqual(calls, [identity])
            self.assertEqual(errors, [])
            self.assertEqual(job.runs.get(run_id).status, 'succeeded')

    def test_low_mode_ffmpeg_uses_single_decode_filter_and_encode_threads(self):
        from peach.frame_capture import capture_frame
        control = control_for(self.config)
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db, mode='low'), \
                patch('peach.frame_capture._readable_image', return_value=True), \
                patch('peach.frame_capture.subprocess.run', return_value=SimpleNamespace(returncode=0, stderr=b'')) as run:
            capture_frame('ffmpeg', 'video.mp4', 1, self.root / 'frame.jpg')
        command = run.call_args.args[0]
        self.assertEqual(command.count('-threads'), 2)
        self.assertEqual(command[command.index('-filter_threads') + 1], '1')

    def test_user_paused_job_keeps_identity_and_progress_through_service_restart(self):
        from peach.jobs import BackgroundJob
        from peach.library_processing import _save, state_path
        from peach.repository import LedgerDatabase
        from peach.task_runs import TaskRunStore
        database_root = self.config.directory('database')
        database_root.mkdir(parents=True)
        db = fresh_ledger(database_root)
        runs = TaskRunStore(LedgerDatabase(db))
        first = BackgroundJob('library-processing', runs=runs)
        self.addCleanup(first.stop, timeout=None)
        contract = SimpleNamespace(db_path=db, library_processing_job=first,
                                   task_runs=runs,
                                   candidate_root=self.root / 'candidates', cover_root=self.root / 'covers',
                                   database=runs.database, cache_bust=lambda: None)
        entered, advance = (threading.Event() for _ in range(2))
        identities, resumes = [], []
        def process(*_args, **kwargs):
            identity = kwargs['job_id']
            identities.append(identity)
            resumes.append(kwargs['resume_state'])
            state = dict(job_id=identity, requested_stage='metadata', status='running', completed_metadata=['1:R:\\a.mp4'])
            def report(**values):
                values.pop('resumed_after', None)
                state.update(values)
                _save(state_path(self.config), state)
                kwargs['report'](dict(state))
            with control_for(self.config).bind(identity, publish=report, active=kwargs['active'], db_path=db):
                _save(state_path(self.config), state)
                if len(identities) == 1:
                    entered.set()
                    advance.wait(2)
                try:
                    checkpoint()
                except Exception:
                    from peach.processing_control import interrupted_state
                    state.update(interrupted_state(control_for(self.config)))
                    _save(state_path(self.config), state)
                    raise
                return {'status': 'complete'}
        with patch('peach.web_library_processing.settings_file.active', return_value=self.config), \
                patch('peach.web_library_processing.process_library', side_effect=process):
            initial = w_library_processing(contract, {'stage': 'metadata', 'speed_mode': 'high'})
            self.assertTrue(entered.wait(2))
            w_library_processing(contract, {'action': 'pause', 'job_id': initial['job_id']})
            advance.set()
            self.assert_processing_status(contract, 'paused')
            from peach import task_control
            task_control.request(runs, initial['run_id'], 'set_speed', mode='low')
            first.stop()
            self.assertEqual(runs.get(initial['run_id']).status, 'pending')
            self.assertEqual(runs.get(initial['run_id']).progress_label, '已暂停，等待继续')
            second = BackgroundJob('library-processing', runs=runs)
            self.addCleanup(second.stop, timeout=None)
            contract.library_processing_job = second
            w_library_processing(contract, {'action': 'resume', 'job_id': initial['job_id']})
            second.thread.join(2)
            self.assertEqual(identities, [initial['job_id'], initial['job_id']])
            self.assertEqual(resumes[1]['completed_metadata'], ['1:R:\\a.mp4'])
            self.assertEqual(second.snapshot()['status'], 'complete')
            self.assertEqual(second.snapshot()['run_id'], initial['run_id'])
            self.assertEqual(control_for(self.config).mode, 'low')
            self.assertEqual(task_control.speed_mode(db, initial['run_id']), 'low')
            self.assertEqual(runs.get(initial['run_id']).status, 'succeeded')

    def test_legacy_library_recovery_preserves_speed_without_a_task_speed_file(self):
        from peach import task_control, update_tasks
        from peach.jobs import BackgroundJob
        from peach.library_processing import _save, state_path
        from peach.task_runs import TaskRunStore
        from peach.web_job_recovery import restore
        from peach.web_library_processing import q_library_processing
        from peach.processing_control import default_mode
        database_root = self.config.directory('database')
        database_root.mkdir(parents=True)
        db = fresh_ledger(database_root)
        runs = TaskRunStore(db)
        for mode, source in (('low', 'state'), ('high', 'state'), ('high', 'control')):
            with self.subTest(mode=mode, source=source):
                identity = f'legacy-{mode}-{source}'
                run = runs.start('library-processing', trigger='manual')
                runs.suspend(run.id)
                speed_file = update_tasks.state_for(db).parent / 'task-controls' / f'{run.id}.speed.json'
                speed_file.unlink()
                control = control_for(self.config)
                control.select_job(identity)
                control.request('set_speed', mode=mode if source == 'control' else 'standard')
                previous = dict(job_id=identity, requested_stage='metadata', status='paused',
                                completed_metadata=['1:R:\\a.mp4'])
                if source == 'state':
                    previous['speed_mode'] = mode
                _save(state_path(self.config), previous)
                job_recovery.save(db, 'library-processing', identity, {'stage': 'metadata', 'speed_mode': mode},
                                  run_id=run.id, waiting=True)
                job_recovery.checkpoint(db, 'library-processing', identity, previous)
                job = BackgroundJob('library-processing', runs=runs)
                self.addCleanup(job.stop, timeout=None)
                contract = SimpleNamespace(db_path=db, library_processing_job=job, task_runs=runs,
                                           database=runs.database, candidate_root=self.root / 'candidates',
                                           cover_root=self.root / 'covers', cache_bust=lambda: None)
                observed = []
                def process(*_args, observed=observed, **kwargs):
                    observed.append((kwargs['speed_mode'], task_control.CURRENT.get().mode,
                                     kwargs['resume_state']['completed_metadata']))
                    return {'status': 'complete'}
                with patch('peach.web_library_processing.settings_file.active', return_value=self.config), \
                        patch('peach.web_library_processing.process_library', side_effect=process):
                    self.assertEqual(q_library_processing(contract, {})['speed_mode'], mode)
                    self.assertEqual(restore(contract), ['library-processing'])
                    job.thread.join(5)
                self.assertFalse(job.thread.is_alive())
                self.assertEqual(observed, [(mode, mode, ['1:R:\\a.mp4'])])
                self.assertEqual(job.snapshot()['run_id'], run.id)
                self.assertEqual(job.snapshot()['speed_mode'], mode)
                self.assertEqual(runs.get(run.id).status, 'succeeded')
                self.assertTrue(speed_file.exists())
                self.assertEqual(task_control.speed_mode(db, run.id), mode)
                self.assertEqual(default_mode(runs.database), 'standard')

    def test_three_intensities_set_distinct_io_start_intervals(self):
        control = control_for(self.config)
        intervals = {}
        for mode in ('low', 'standard', 'high'):
            with self.subTest(mode=mode), \
                    control.bind(mode, publish=lambda **_: None, active=lambda: True, db_path=self.db, mode=mode), \
                    patch('peach.processing_control.time.monotonic', return_value=10):
                checkpoint('network')
                intervals[mode] = control.next_work['network'] - 10
        self.assertGreater(intervals['low'], intervals['standard'])
        self.assertGreater(intervals['standard'], intervals['high'])
        self.assertEqual(intervals['high'], 0)

    def test_three_intensities_set_decode_filter_and_encode_threads(self):
        from peach.frame_capture import capture_frame, tile_frames
        control = control_for(self.config)
        for mode, threads in (('low', '1'), ('standard', '2'), ('high', None)):
            with self.subTest(mode=mode), \
                    control.bind(mode, publish=lambda **_: None, active=lambda: True, db_path=self.db, mode=mode), \
                    patch('peach.frame_capture.checkpoint'), \
                    patch('peach.frame_capture._readable_image', return_value=True), \
                    patch('peach.frame_capture.subprocess.run', return_value=SimpleNamespace(returncode=0, stderr=b'')) as run:
                capture_frame('ffmpeg', 'video.mp4', 1, self.root / 'frame.jpg')
                tile_frames('ffmpeg', 'frame%02d.jpg', 3, 3, self.root / 'tile.jpg')
                for call, filter_option in zip(run.call_args_list, ('-filter_threads', '-filter_complex_threads')):
                    command = call.args[0]
                    if threads is None:
                        self.assertNotIn('-threads', command)
                        self.assertNotIn(filter_option, command)
                    else:
                        self.assertEqual(command.count('-threads'), 2)
                        self.assertEqual(command[command.index(filter_option) + 1], threads)
                        self.assertEqual([command[index + 1] for index, value in enumerate(command)
                                          if value == '-threads'], [threads, threads])

    def test_intensity_switch_recalibrates_estimate_in_every_direction(self):
        self.seed()
        control = control_for(self.config)
        for initial, target in (('low', 'standard'), ('standard', 'high'), ('high', 'low')):
            with self.subTest(initial=initial, target=target), \
                    control.bind(initial, publish=lambda **_: None, active=lambda: True,
                                 db_path=self.db, mode=initial):
                state = dict(initial_estimate(self.config, self.db, 'metadata', mode=initial),
                             status='paused', requested_stage='metadata')
                estimate = ProcessingEstimate(self.config, state, control)
                old = state['eta_seconds_max']
                control.request('set_speed', mode=target)
                estimate.update(state)
                self.assertEqual(state['speed_mode'], target)
                if target == 'low':
                    self.assertGreater(state['eta_seconds_max'], old)
                else:
                    self.assertLess(state['eta_seconds_max'], old)

    def test_high_intensity_honors_installation_pause(self):
        from peach.jobs import JobPaused
        from peach import update_tasks
        control = control_for(self.config)
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db, mode='high'):
            token = update_tasks.reserve(self.db)
            try:
                with self.assertRaises(JobPaused):
                    checkpoint('frame')
            finally:
                update_tasks.release(self.db, token)
            checkpoint('frame')
            self.assertEqual(control.mode, 'high')

    def test_high_history_is_normalized_for_every_initial_intensity(self):
        self.seed()
        control = control_for(self.config)
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db, mode='high'):
            state = dict(initial_estimate(self.config, self.db, 'metadata', mode='high'),
                         requested_stage='metadata', status='running')
            with patch('peach.processing_control.time.monotonic', return_value=100):
                estimate = ProcessingEstimate(self.config, state, control)
            state['status'] = 'complete'
            with patch('peach.processing_control.time.monotonic', return_value=175):
                estimate.update(state)
        history = json.loads((self.config.directory('state') / 'library-processing-timing.json').read_text())
        self.assertEqual(history['metadata'], 10.0)
        low, standard, high = [initial_estimate(self.config, self.db, 'metadata', mode=mode)
                               for mode in ('low', 'standard', 'high')]
        self.assertEqual(high['eta_kind'], 'historical')
        self.assertGreater(low['eta_seconds_max'], standard['eta_seconds_max'])
        self.assertGreater(standard['eta_seconds_max'], high['eta_seconds_max'])

    def test_high_intensity_and_pause_intent_are_shared_between_control_instances(self):
        control = control_for(self.config)
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db, mode='standard'):
            external = ProcessingControl(control.path)
            external.request('set_speed', 'one', mode='high')
            external.request('pause', 'one')
            control.refresh(force=True)
            self.assertEqual(control.mode, 'high')
            self.assertTrue(control.paused)
            external.request('resume', 'one')
            control.refresh(force=True)
            self.assertFalse(control.paused)
            self.assertEqual(control.mode, 'high')

    def test_api_switches_between_all_intensities_with_proportional_paused_estimates(self):
        from peach.jobs import BackgroundJob
        control = control_for(self.config)
        job = BackgroundJob('library-processing')
        job.state = dict(job_id='one', status='paused', speed_mode='low', eta_seconds_min=180, eta_seconds_max=360)
        from peach.task_runs import TaskRunStore
        contract = SimpleNamespace(db_path=self.db, library_processing_job=job, task_runs=TaskRunStore(self.db))
        with control.bind('one', publish=lambda **_: None, active=lambda: True, db_path=self.db, mode='low'), \
                patch('peach.web_library_processing.settings_file.active', return_value=self.config):
            control.request('pause', 'one')
            high = w_library_processing(contract, {'action': 'set_speed', 'job_id': 'one', 'speed_mode': 'high'})
            self.assertEqual((high['speed_mode'], high['status']), ('high', 'paused'))
            self.assertEqual((high['eta_seconds_min'], high['eta_seconds_max']), (75, 150))
            standard = w_library_processing(contract, {'action': 'set_speed', 'job_id': 'one', 'speed_mode': 'standard'})
            self.assertEqual((standard['eta_seconds_min'], standard['eta_seconds_max']), (100, 200))
            low = w_library_processing(contract, {'action': 'set_speed', 'job_id': 'one', 'speed_mode': 'low'})
            self.assertEqual((low['eta_seconds_min'], low['eta_seconds_max']), (180, 360))
            self.assertTrue(control.paused)

    def test_library_and_task_controls_share_runtime_speed_without_changing_the_default(self):
        from peach import task_control
        from peach.jobs import BackgroundJob
        from peach.task_runs import TaskRunStore
        from peach.web_library_processing import q_library_processing
        from peach.processing_control import default_mode
        runs = TaskRunStore(self.db)
        run = runs.start('library-processing', trigger='manual')
        job = BackgroundJob('library-processing')
        job.state = dict(job_id='one', run_id=run.id, status='running', speed_mode='standard',
                         eta_seconds_min=100, eta_seconds_max=200)
        contract = SimpleNamespace(db_path=self.db, library_processing_job=job, task_runs=runs)
        control = control_for(self.config)
        with patch('peach.web_library_processing.settings_file.active', return_value=self.config):
            task_control.request(runs, run.id, 'set_speed', mode='high')
            state = q_library_processing(contract, {})
            self.assertEqual((state['speed_mode'], state['eta_seconds_min']), ('high', 75))
            state = w_library_processing(contract, {'action': 'set_speed', 'job_id': 'one', 'speed_mode': 'low'})
            self.assertEqual(state['speed_mode'], 'low')
            self.assertEqual(task_control.projection(runs, run)['speed_mode'], 'low')
            self.assertEqual(default_mode(runs.database), 'standard')
            with task_control.bind(runs, run.id), control.bind(
                    'one', publish=lambda **_: None, active=lambda: True, db_path=self.db):
                self.assertEqual(control.mode, 'low')
                task_control.request(runs, run.id, 'set_speed', mode='high')
                self.assertEqual(control.mode, 'high')

    def test_new_library_run_uses_settings_instead_of_the_previous_processing_mode(self):
        from peach.jobs import BackgroundJob
        from peach.task_runs import TaskRunStore
        from peach.web_settings import w_settings
        root = self.config.directory('database')
        root.mkdir(parents=True)
        db = fresh_ledger(root)
        runs = TaskRunStore(db)
        w_settings(runs.database, {'taskSpeedMode': 'low'})
        control_for(self.config).request('set_speed', mode='high')
        job = BackgroundJob('library-processing', runs=runs)
        contract = SimpleNamespace(db_path=db, database=runs.database, task_runs=runs,
                                   library_processing_job=job)
        with patch('peach.web_library_processing.settings_file.active', return_value=self.config), \
                patch.object(job, 'start', side_effect=lambda _work, **kwargs: kwargs['initial']) as start:
            result = w_library_processing(contract, {'stage': 'metadata'})
            self.assertEqual(result['speed_mode'], 'low')
            self.assertEqual(start.call_args.kwargs['recovery']['speed_mode'], 'low')
            chosen = w_library_processing(contract, {'action': 'set_speed', 'speed_mode': 'high'})
            self.assertEqual(chosen['speed_mode'], 'high')
            from peach.processing_control import default_mode
            self.assertEqual(default_mode(runs.database), 'low')
            selected = w_library_processing(contract, {'stage': 'metadata'})
            self.assertEqual(selected['speed_mode'], 'high')
            from peach.web_library_processing import q_library_processing
            self.assertEqual(q_library_processing(contract, {})['speed_mode'], 'low')

    def test_scan_progress_accumulates_discovered_counts_across_roots(self):
        from peach.library_processing import _scan_sources
        reports = []
        config = PeachConfig(self.root, self.root / 'config.toml', present=True,
                             locations={'local': ('R:\\Media', 'R:\\Other')})
        def scan(*_args, **kwargs):
            kwargs['progress'](1, 10)
            kwargs['progress'](2, 30)
            return SimpleNamespace(files=2, total_bytes=30, new_ids=(), junk_isolated=1)
        with patch('peach.library_processing.scan_location', side_effect=scan), \
                patch('peach.library_processing._online_source_root', return_value=self.root), \
                patch('peach.library_processing._ffprobe_path', return_value=None), \
                patch('peach.library_processing.probe_unmeasured', return_value=0), \
                patch('peach.library_processing.reattach_in'):
            result = _scan_sources(config, self.db, locations=config.locations, asset_ids=None,
                                   stage='scan', guard=Mock(), update=lambda **values: reports.append(values),
                                   issue=lambda *_args, **_kwargs: None)
        discovering = [row for row in reports if row.get('current_action') == 'scanning_files']
        self.assertEqual([row['scanned'] for row in discovering], [1, 2, 3, 4])
        self.assertEqual([row['scanned_bytes'] for row in discovering], [10, 30, 40, 60])
        self.assertTrue(all(row['total'] == 0 for row in discovering))
        self.assertEqual((result.scanned, result.scanned_bytes), (4, 60))
        self.assertEqual(result.junk_isolated, 2)

    def test_incremental_scan_probes_rows_moved_onto_new_files(self):
        """按番号改指到新文件的旧行不算新行，但文件换了，增量扫描照样要探它。"""
        from peach.library_processing import _scan_sources
        config = PeachConfig(self.root, self.root / 'config.toml', present=True, locations={'local': ('R:\\Media',)})
        scanned = SimpleNamespace(files=2, total_bytes=30, new_ids=(5,), relocated_ids=(7,), junk_isolated=0)
        with patch('peach.library_processing.scan_location', return_value=scanned), \
                patch('peach.library_processing._online_source_root', return_value=self.root), \
                patch('peach.library_processing._ffprobe_path', return_value=None), \
                patch('peach.library_processing.probe_unmeasured', return_value=0) as probe, \
                patch('peach.library_processing.reattach_in') as reattach:
            result = _scan_sources(config, self.db, locations=config.locations, asset_ids=None,
                                   stage='scan', guard=Mock(), update=lambda **values: None,
                                   issue=lambda *_args, **_kwargs: None, incremental=True)
        self.assertEqual(probe.call_args.kwargs['asset_ids'], [5, 7])
        self.assertEqual(result.new_ids, (5,), "改指的旧行不进新影片范围")
        reattach.assert_called_once_with(self.db, (5,))

    def test_library_scan_reports_conflicting_records_and_processes_both_roots(self):
        import sqlite3
        from peach.library_processing import _scan_sources
        first, second = self.root / 'first', self.root / 'second'
        first.mkdir()
        second.mkdir()
        (first / 'copy.mp4').write_bytes(b'copy')
        (first / 'new.mp4').write_bytes(b'new')
        (second / 'other.mp4').write_bytes(b'other')
        config = PeachConfig(self.root, self.root / 'config.toml', present=True,
                             locations={'local': ('R:\\Media', 'S:\\Other')},
                             mounts={'local': (str(first), str(second))})
        with closing(sqlite3.connect(self.db)) as connection, connection:
            for path in ('R:\\Media\\copy.mp4', 'r:\\MEDIA\\COPY.MP4'):
                connection.execute("INSERT INTO asset(location,path,name,medium) "
                                   "VALUES('local',?,'copy.mp4','video')", (path,))
        issues = []
        with patch('peach.library_processing._online_source_root', return_value=first), \
                patch('peach.library_processing._ffprobe_path', return_value=None), \
                patch('peach.library_processing.probe_unmeasured', return_value=0):
            result = _scan_sources(config, self.db, locations=config.locations, asset_ids=None,
                                   stage='scan', guard=Mock(), update=lambda **values: None,
                                   issue=lambda row, message, **values: issues.append((message, values)))
        self.assertEqual((result.scanned, result.scanned_bytes), (3, 12))
        self.assertEqual(len(issues), 1)
        # 问题项是 `{code, params}`，按 zh-CN 渲染后核对；记录号是列表参数，按资源里的分隔符连起来。
        from peach.library_processing import phrase_text
        self.assertIn('记录 1、2', phrase_text(issues[0][0]))
        self.assertEqual(issues[0][1]['action'], 'scanning_files')
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM asset').fetchone()[0], 4)
            self.assertIsNotNone(connection.execute("SELECT id FROM asset WHERE path='S:\\Other\\other.mp4'").fetchone())
