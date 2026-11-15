"""远程诊断只用临时同意文件与内存接收端，不访问 Sentry。"""
import json
import os
import runpy
import subprocess
import sys
import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

from peach import remote_reporting as reporting
from peach.settings_file import PeachConfig

DSN = "https://public@o123.ingest.us.sentry.io/456"


class RemoteReportingTests(unittest.TestCase):
    def test_last_sent_date_survives_queued_and_failed_delivery(self):
        from peach import reporting_delivery
        reporting.save({'usage': True, 'errors': True}, self.config)
        permit = reporting._permit('usage', self.config, reporting.consent(self.config))
        reporting_delivery.record(permit, 'first', {'status': 'queued'})
        reporting_delivery.record(permit, 'first', {'status': 'accepted'})
        sent = reporting_delivery.snapshot(self.config)['usage']['last_sent_at']
        reporting_delivery.record(permit, 'next', {'status': 'queued'})
        reporting_delivery.record(permit, 'next', {'status': 'failed', 'reason': 'queue_full'})
        self.assertEqual(reporting_delivery.snapshot(self.config)['usage']['last_sent_at'], sent)

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name).resolve()
        self.config = PeachConfig(self.root, self.root / "config.toml")
        self.addCleanup(mock.patch.stopall)
        mock.patch.dict(os.environ, {"PEACH_DATA_ROOT": str(self.root), "PEACH_SENTRY_DSN": DSN}).start()
        mock.patch("peach.settings_file.active", return_value=self.config).start()
        mock.patch.object(reporting, "_disabled", False).start()
        self.addCleanup(reporting.close)
        reporting.close()
        reporting.save({"usage": False, "errors": False})

    def test_enabled_legacy_choice_generates_a_stable_random_instance_and_disable_removes_it(self):
        path = self.config.directory('state') / 'remote-reporting.json'
        path.write_text(json.dumps({'usage': True, 'errors': True, 'revision': 'old-choice'}))
        with mock.patch.object(reporting, '_schedule_frequency'), mock.patch.object(reporting, '_new_client', return_value=mock.Mock()):
            self.assertNotIn('diagnostic_instance', reporting.consent(self.config))
            reporting.usage(self.config)
            first = reporting.consent(self.config)
            self.assertRegex(first['diagnostic_instance'], r'^[a-f0-9]{32}$')
            self.assertEqual(first['revision'], 'old-choice')
            self.assertEqual(reporting.consent(self.config), first)
            reporting.save({'usage': True, 'errors': True}, self.config)
            self.assertEqual(reporting.consent(self.config)['diagnostic_instance'], first['diagnostic_instance'])
            reporting.save({'usage': False, 'errors': False}, self.config)
            self.assertNotIn('diagnostic_instance', reporting.consent(self.config))
            self.assertNotIn('diagnostic_instance', json.loads(path.read_text()))
            reporting.save({'usage': True, 'errors': True}, self.config)
            self.assertNotEqual(reporting.consent(self.config)['diagnostic_instance'], first['diagnostic_instance'])
        self.assertNotIn('research_instance', path.read_text())

    def test_frequency_migration_counts_the_old_first_event_once_in_logs(self):
        from peach import diagnostic_frequency as frequency
        reporting.save({'usage': True, 'errors': True})
        now = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
        path = frequency._path(self.config)
        key = 'a' * 64
        path.write_text(json.dumps({'revision': reporting.consent()['revision'], 'day': '2026-10-18', 'events': 1,
            'records': {key: {'event': {'tags': {'stage': 'cli'}}, 'first': '2026-10-18', 'day': '2026-10-18',
                             'sent': True, 'total': 4, 'submitted': 3, 'last_logged': now.timestamp()}}}))
        counts = []
        with mock.patch.object(frequency, '_now', return_value=now):
            for _ in range(2):
                frequency.flush(self.config, reporting.consent()['revision'], lambda _event: True,
                    lambda batch: counts.extend(batch) or True, force=True)
        self.assertEqual([row['tags']['occurrence_count'] for row in counts], ['2'])
        self.assertEqual(json.loads(path.read_text())['count_schema'], 2)

    def test_diagnostic_keys_match_across_random_instances(self):
        from peach import diagnostic_frequency as frequency
        keys = []
        for identity in ('a' * 32, 'b' * 32):
            config = PeachConfig(self.root / identity, self.root / identity / 'config.toml')
            frequency.record(config, 'choice', {'release': 'test', 'tags': {
                'stage': 'cli', 'diagnostic_instance': identity}},
                lambda event: keys.append(event['tags']['diagnostic_key']) or True, lambda _counts: True)
        self.assertEqual(len(keys), 2)
        self.assertEqual(keys[0], keys[1])

    def test_browser_client_categories_are_coarse_and_server_environment_is_separate(self):
        reporting.save({'usage': True, 'errors': True})
        client = mock.Mock()
        with mock.patch.object(reporting, '_new_client', return_value=client):
            reporting.capture('browser', error_name='TypeError', stack='peach-app.js:12:34', browser={
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; private-device) Chrome/140.1.2.3 Safari/537.36 Edg/140.1.2.3',
                'graphics': {'renderer': 'private-gpu'}})
        event = client.capture_event.call_args.args[0]
        self.assertEqual({key: value for key, value in event['tags'].items() if key.startswith('client_')},
                         {'client_browser': 'Edge', 'client_browser_major': '140', 'client_os': 'Windows'})
        wire = json.dumps(event)
        for private in ('private-device', 'private-gpu', '140.1.2.3', 'user_agent'):
            self.assertNotIn(private, wire)
        self.assertIn('diagnostic_instance', event['tags'])

    def test_invalid_and_disabled_choices_never_construct_client(self):
        with mock.patch.object(reporting, "_new_client") as client:
            reporting.usage()
            reporting.capture("unhandled-main", ValueError("secret"))
            self.assertFalse(reporting.snapshot()["errors"])
            path = self.config.directory("state") / "remote-reporting.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            for content in ('{"usage": "true", "errors": 1}', '{broken', '[]'):
                path.write_text(content, encoding="utf-8")
                reporting.usage()
                reporting.capture("unhandled-main", ValueError("secret"))
            client.assert_not_called()
        self.assertFalse((path.parent / "remote-reporting-budget.json").exists())

    def test_default_enables_both_channels_and_saved_disable_is_persistent(self):
        path = self.config.directory("state") / "remote-reporting.json"
        path.unlink()
        client = mock.Mock()
        with mock.patch.object(reporting, "_new_client", return_value=client):
            self.assertTrue(reporting.snapshot()["usage"])
            self.assertTrue(reporting.snapshot()["errors"])
            reporting.usage()
            reporting.capture("unhandled-main", ValueError("private"))
            self.assertEqual(client.capture_event.call_count, 1)
            self.assertEqual(client.transport.capture_envelope.call_count, 1)
            reporting.save({"usage": False, "errors": False})
            self.assertFalse(reporting.snapshot()["usage"])
            self.assertFalse(reporting.snapshot()["errors"])
            reporting.usage()
            reporting.capture("unhandled-main", ValueError("private"))
            self.assertEqual(client.capture_event.call_count, 1)
            self.assertEqual(client.transport.capture_envelope.call_count, 1)

    def test_consent_requires_joint_choice_and_missing_endpoint_is_visible(self):
        for invalid in ({"usage": "false", "errors": False}, {"usage": True}, [],
                        {"usage": True, "errors": False}, {"usage": False, "errors": True}):
            with self.assertRaises(ValueError):
                reporting.save(invalid)
        reporting.save({"usage": True, "errors": True})
        self.assertTrue(reporting.snapshot()["usage"])
        self.assertTrue(reporting.snapshot()["errors"])
        with mock.patch.dict(os.environ, {"PEACH_SENTRY_DSN": ""}):
            self.assertFalse(reporting.snapshot()["available"])
            with mock.patch.object(reporting, "_new_client") as client:
                reporting.usage()
                client.assert_not_called()

    def test_partial_consent_keeps_both_channels_disabled(self):
        path = self.config.directory("state") / "remote-reporting.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        for usage, errors in ((True, False), (False, True)):
            path.write_text(json.dumps({"usage": usage, "errors": errors, "revision": "partial"}))
            with mock.patch.object(reporting, "_new_client") as client:
                self.assertFalse(reporting.snapshot()["usage"])
                self.assertFalse(reporting.snapshot()["errors"])
                reporting.usage()
                reporting.capture("unhandled-main", ValueError("private"))
                client.assert_not_called()

    def test_optional_setup_choices_preserve_saved_opt_out(self):
        self.assertEqual(reporting.parse_choices({}, partial=True), {"usage": False, "errors": False})
        (self.config.directory("state") / "remote-reporting.json").unlink()
        self.assertEqual(reporting.parse_choices({}, partial=True), {"usage": True, "errors": True})

    def test_dsn_only_accepts_hosted_public_https_endpoint(self):
        for value in (DSN, DSN.replace('.us.', '.'), DSN.replace('.us.', '.de.')):
            with self.subTest(value=value), mock.patch.dict(os.environ, {"PEACH_SENTRY_DSN": value}):
                self.assertEqual(reporting.dsn(), value)
        for value in ('http://public@o123.ingest.sentry.io/1', 'https://public:secret@o123.ingest.sentry.io/1',
                      'https://public@localhost/1', DSN + '?token=secret', DSN + '#secret',
                      'https://public@o123.ingest.sentry.io.evil/1'):
            with self.subTest(value=value), mock.patch.dict(os.environ, {"PEACH_SENTRY_DSN": value}):
                self.assertEqual(reporting.dsn(), "")

    @staticmethod
    def _telemetry(client):
        """内存客户端收到的日志与会话条目，按信封顺序展开。"""
        items = []
        for call in client.transport.capture_envelope.call_args_list:
            for item in call.args[0].items:
                payload = item.payload.json
                if item.type == 'log':
                    items.extend(('log', log) for log in payload['items'])
                else:
                    items.append((item.type, payload))
        return items

    @staticmethod
    def _counts(client):
        return [{key: value['value'] for key, value in log['attributes'].items()}
                for kind, log in RemoteReportingTests._telemetry(client)
                if kind == 'log' and log['body'] == 'Peach diagnostic count']

    def test_daily_budget_is_shared_deduplicated_and_bounded(self):
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        with mock.patch.object(reporting, "_new_client", return_value=client):
            reporting.usage()
            reporting.usage()
            for index in range(25):
                event = {"message": str(index)}
                reporting.send("errors", event)
                reporting.send("errors", event)
        self.assertEqual(client.capture_event.call_count, 5)
        self.assertEqual(client.transport.capture_envelope.call_count, 1)
        payload = json.loads((self.config.directory("state") / "remote-reporting-frequency.json").read_text())
        rows = list(payload["records"].values())
        # 超出登记上限的新诊断键改为只计数，次数照样累计。
        self.assertEqual(sum(not row.get('count_only') for row in rows), 20)
        self.assertEqual(sum(row.get('count_only', False) for row in rows), 5)
        self.assertTrue(all(row['total'] == 2 for row in rows))

    def test_usage_is_one_log_and_session_without_error_events(self):
        from peach import reporting_identity as identity
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        with mock.patch.object(reporting, "_new_client", return_value=client), \
                mock.patch.object(identity, "_memory_bytes", return_value=15.8 * 2 ** 30):
            reporting.usage()
        client.capture_event.assert_not_called()
        (kind, log), (session_kind, session) = self._telemetry(client)
        self.assertEqual((kind, session_kind, log['body']), ('log', 'sessions', 'Peach daily activity'))
        attributes = {key: value['value'] for key, value in log['attributes'].items()}
        self.assertEqual(attributes["purpose"], "version-statistics")
        self.assertEqual(attributes["distribution"], "source")
        self.assertEqual(attributes["memory_gb"], "16")
        self.assertEqual(attributes["cpu_cores"], str(os.cpu_count()))
        self.assertEqual(attributes["sentry.release"], session['attrs']['release'])
        for key in ("os", "os_version", "architecture", "python", "sentry.environment"):
            self.assertTrue(attributes[key], key)
        self.assertEqual(session['aggregates'][0]['exited'], 1)
        self.assertEqual(set(session['attrs']), {'release', 'environment'})

    def test_distribution_tells_desktop_apps_docker_wheel_and_source_apart(self):
        from peach import reporting_identity as identity
        cases = (
            ("windows-app", {"frozen": True, "system": "Windows"}),
            ("macos-app", {"frozen": True, "system": "Darwin"}),
            ("docker", {"environ": {"PEACH_DISTRIBUTION": "docker"}}),
            ("wheel", {"root": Path("site-packages/peach/_resources")}),
            ("source", {"root": Path("peach-app")}),
        )
        for expected, case in cases:
            with self.subTest(expected), \
                    mock.patch.object(identity.sys, "frozen", case.get("frozen", False), create=True), \
                    mock.patch.object(identity.platform, "system", return_value=case.get("system", "Linux")), \
                    mock.patch.dict(os.environ, case.get("environ", {"PEACH_DISTRIBUTION": ""})), \
                    mock.patch("peach.settings_file.PROJECT_ROOT", case.get("root", Path("peach-app"))):
                self.assertEqual(identity.distribution(), expected)

    def test_memory_is_reported_as_the_nearest_common_capacity(self):
        from peach.reporting_identity import memory_bucket
        for gigabytes, bucket in ((7.6, "8"), (15.8, "16"), (23.4, "24"), (31.9, "32"), (0.9, "2"), (1024, "256+")):
            with self.subTest(gigabytes=gigabytes):
                self.assertEqual(memory_bucket(gigabytes * 2 ** 30), bucket)

    def test_frequency_sends_one_event_then_count_logs_with_the_same_key(self):
        from peach import diagnostic_frequency as frequency
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        now = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
        with mock.patch.object(reporting, '_new_client', return_value=client), \
                mock.patch.object(frequency, '_now', return_value=now) as clock:
            for index in range(5):
                reporting.capture('unhandled-main', ValueError('private title'), error_id=str(index))
            self.assertEqual(client.capture_event.call_count, 1)
            first = client.capture_event.call_args.args[0]
            self.assertEqual(first['tags']['occurrence_count'], '1')
            clock.return_value = now + timedelta(hours=1)
            reporting.flush_counts()
            self.assertEqual(self._counts(client), [])
            clock.return_value = now + timedelta(hours=6)
            reporting.flush_counts()
            reporting.flush_counts(force=True)
            [count] = self._counts(client)
            self.assertEqual(count['occurrence_count'], 5)
            self.assertEqual(count['count_schema'], '2')
            self.assertEqual(count['diagnostic_key'], first['tags']['diagnostic_key'])
            self.assertEqual(count['occurrence_day'], '2026-10-18')
            self.assertEqual(count['exception_type'], 'ValueError')
            self.assertEqual(count['purpose'], 'technical-diagnostics')
            self.assertEqual(client.capture_event.call_count, 1)
        payload = (self.config.directory('state') / 'remote-reporting-frequency.json').read_text()
        self.assertNotIn('private title', payload)
        self.assertNotIn('installation', payload)

    def test_environment_conditions_are_counted_without_events_or_new_key_slots(self):
        import errno
        from peach import diagnostic_frequency as frequency
        namespace = {}
        exec(compile('def read(code):\n    raise OSError(code, "private", "movie.mp4")\n', 'peach/fixture.py', 'exec'), namespace)
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        with mock.patch.object(reporting, '_new_client', return_value=client):
            for _ in range(30):
                try:
                    namespace['read'](errno.ENXIO)
                except OSError as error:
                    reporting.capture('library-preview', error)
            # 掉盘期间每次发生只在进程内累计，不逐次写聚合文件。
            self.assertFalse(frequency._path(self.config).exists())
            reporting.flush_counts()
            for index in range(frequency.NEW_KEY_LIMIT):
                reporting.send('errors', {'message': str(index)})
            reporting.flush_counts(force=True)
        events = [call.args[0] for call in client.capture_event.call_args_list]
        self.assertEqual(len(events), frequency.EVENT_LIMIT)
        self.assertFalse(any('condition' in event['tags'] for event in events))
        [count] = [count for count in self._counts(client) if 'condition' in count]
        self.assertEqual((count['condition'], count['occurrence_count']), ('media_volume', 30))
        self.assertEqual((count['code_location'], count['code_line']), ('fixture.py:read', 2))
        payload = json.loads(frequency._path(self.config).read_text())
        rows = list(payload['records'].values())
        self.assertEqual(sum(not row.get('count_only') for row in rows), frequency.NEW_KEY_LIMIT)
        self.assertNotIn('private', json.dumps(payload))
        self.assertNotIn('movie.mp4', json.dumps(payload))

    def test_frequency_survives_client_restart_and_http_ids_do_not_split_groups(self):
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        with mock.patch.object(reporting, '_new_client', return_value=client):
            for error_id in ('a' * 32, 'b' * 32, 'c' * 32):
                reporting.capture('http-request', RuntimeError('private'), status_code=500, error_id=error_id)
            first = client.capture_event.call_args.args[0]
            self.assertEqual(first['event_id'], 'a' * 32)
            reporting.close()
            reporting.flush_counts(force=True)
            [count] = self._counts(client)
            self.assertEqual(count['occurrence_count'], 3)
            self.assertEqual(count['diagnostic_key'], first['tags']['diagnostic_key'])
            self.assertEqual(client.capture_event.call_count, 1)

    def test_frequency_pending_counts_expire_with_consent_and_expected_states_are_excluded(self):
        import asyncio
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        with mock.patch.object(reporting, '_new_client', return_value=client):
            reporting.capture('background-job', asyncio.CancelledError())
            reporting.capture('unhandled-main', ValueError('private'))
            reporting.capture('unhandled-main', ValueError('private'))
            reporting.save({"usage": False, "errors": False})
            self.assertFalse((self.config.directory('state') / 'remote-reporting-frequency.json').exists())
            reporting.flush_counts(force=True)
            reporting.save({"usage": True, "errors": True})
            reporting.flush_counts(force=True)
            self.assertEqual(client.capture_event.call_count, 1)
            self.assertEqual(self._counts(client), [])
            reporting.capture('unhandled-main', ValueError('private'))
            self.assertEqual(client.capture_event.call_count, 2)
            self.assertEqual(client.capture_event.call_args.args[0]['tags']['occurrence_count'], '1')

    def test_frequency_daily_event_limit_defers_first_events_and_keeps_their_day(self):
        from peach import diagnostic_frequency as frequency
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        now = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
        with mock.patch.object(reporting, '_new_client', return_value=client), \
                mock.patch.object(frequency, '_now', return_value=now) as clock:
            for index in range(7):
                reporting.send('errors', {'message': str(index)})
            reporting.send('errors', {'message': '0'})
            reporting.flush_counts(force=True)
            self.assertEqual(client.capture_event.call_count, frequency.EVENT_LIMIT)
            self.assertEqual([count['occurrence_count'] for count in self._counts(client)], [2, 1, 1, 1, 1, 1, 1])
            clock.return_value = now + timedelta(days=1)
            reporting.flush_counts(force=True)
            self.assertEqual(client.capture_event.call_count, 7)
            self.assertEqual(client.capture_event.call_args.args[0]['tags']['occurrence_count'], '1')
            self.assertEqual(client.capture_event.call_args.args[0]['tags']['occurrence_day'], '2026-10-18')

    def test_frequency_counts_roll_over_by_occurrence_day(self):
        from peach import diagnostic_frequency as frequency
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        now = datetime(2026, 10, 18, 23, tzinfo=timezone.utc)
        with mock.patch.object(reporting, '_new_client', return_value=client), \
                mock.patch.object(frequency, '_now', return_value=now) as clock:
            for _ in range(3):
                reporting.capture('unhandled-main', ValueError('private'))
            clock.return_value = now + timedelta(hours=2)
            reporting.capture('unhandled-main', ValueError('private'))
            reporting.flush_counts(force=True)
        self.assertEqual(client.capture_event.call_count, 1)
        self.assertEqual([(count['occurrence_day'], count['occurrence_count']) for count in self._counts(client)],
                         [('2026-10-18', 3), ('2026-10-19', 1)])

    def test_frequency_resends_one_event_after_the_key_goes_quiet(self):
        from peach import diagnostic_frequency as frequency
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        now = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
        with mock.patch.object(reporting, '_new_client', return_value=client), \
                mock.patch.object(frequency, '_now', return_value=now) as clock:
            reporting.capture('unhandled-main', ValueError('private'))
            clock.return_value = now + timedelta(days=frequency.RETENTION_DAYS - 1)
            reporting.capture('unhandled-main', ValueError('private'))
            self.assertEqual(client.capture_event.call_count, 1)
            clock.return_value = now + timedelta(days=2 * frequency.RETENTION_DAYS)
            reporting.capture('unhandled-main', ValueError('private'))
            self.assertEqual(client.capture_event.call_count, 2)

    def test_frequency_sdk_rejection_keeps_the_first_event_for_later(self):
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        client.capture_event.return_value = None
        with mock.patch.object(reporting, '_new_client', return_value=client):
            reporting.capture('unhandled-main', ValueError('private'))
            client.capture_event.return_value = 'accepted'
            reporting.flush_counts(force=True)
            self.assertEqual(client.capture_event.call_args.args[0]['tags']['occurrence_count'], '1')
            reporting.flush_counts(force=True)
            self.assertEqual(client.capture_event.call_count, 2)
            self.assertEqual([count['occurrence_count'] for count in self._counts(client)], [1])

    def test_frequency_shared_file_serializes_independent_processes(self):
        from peach import diagnostic_frequency as frequency
        from filelock import FileLock
        root = Path(__file__).resolve().parents[1]
        reporting.save({"usage": True, "errors": True})
        program = ('import sys; from peach import diagnostic_frequency as f; '
                   'from peach.settings_file import active; '
                   'from peach.remote_reporting import consent; '
                   'config=active(); revision=consent()["revision"]; '
                   'print("ready", flush=True); sys.stdin.readline(); '
                   'f.record(config, revision, {"release":"test", "tags":{"stage":"cli"}}, '
                   'lambda e: True, lambda c: True)')
        env = {**os.environ, 'PYTHONPATH': str(root / 'src'), 'PEACH_SENTRY_DSN': ''}
        processes = [subprocess.Popen([sys.executable, '-X', 'utf8', '-c', program], env=env,
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE) for _ in range(2)]
        try:
            for process in processes:
                self.assertEqual(process.stdout.readline().strip(), b'ready')
            with FileLock(str(frequency._path(self.config)) + '.lock'):
                for process in processes:
                    process.stdin.write(b'go\n')
                    process.stdin.flush()
                time.sleep(.25)
                for process in processes:
                    self.assertIsNone(process.poll(), '锁被短暂占用时诊断记录进程不能退出')
            for process in processes:
                stdout, stderr = process.communicate(timeout=30)
                self.assertEqual(process.returncode, 0, (stdout, stderr))
        finally:
            for process in processes:
                if process.poll() is None:
                    process.kill()
                    process.communicate()
        events, counts = [], []
        frequency.flush(self.config, reporting.consent()['revision'], lambda e: events.append(e) or True,
                        lambda batch: counts.extend(batch) or True, force=True)
        self.assertEqual(events, [])
        self.assertEqual([count['tags']['occurrence_count'] for count in counts], ['2'])

    def test_frequency_shutdown_submits_pending_counts_and_stops_timer(self):
        reporting.save({"usage": True, "errors": True})
        client = mock.Mock()
        with mock.patch.object(reporting, '_new_client', return_value=client):
            for _ in range(3):
                reporting.capture('unhandled-main', ValueError('private'))
            reporting._shutdown()
        self.assertEqual(client.capture_event.call_count, 1)
        self.assertEqual([count['occurrence_count'] for count in self._counts(client)], [3])
        self.assertIsNone(reporting._frequency_timer)
        self.assertFalse(reporting._frequency_configs)

    def test_frequency_background_failure_does_not_break_startup(self):
        reporting.save({"usage": True, "errors": True})
        with mock.patch.object(reporting, '_schedule_frequency', side_effect=OSError('unavailable')), \
                mock.patch.object(reporting, '_new_client'):
            reporting.usage()

    def test_frequency_timer_flushes_without_another_occurrence(self):
        from peach import diagnostic_frequency as frequency
        now = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
        client = mock.Mock()
        with mock.patch.object(reporting, '_new_client', return_value=client), \
                mock.patch.object(reporting.threading, 'Timer') as timer, \
                mock.patch.object(reporting, 'datetime', wraps=datetime) as wall, \
                mock.patch.object(frequency, '_now', return_value=now) as clock:
            wall.now.return_value = now
            reporting.save({"usage": True, "errors": True})
            for _ in range(4):
                reporting.capture('unhandled-main', ValueError('private'))
            callback = timer.call_args.args[1]
            clock.return_value = wall.now.return_value = now + timedelta(seconds=frequency.INTERVAL)
            callback()
            self.assertEqual(client.capture_event.call_count, 1)
            self.assertEqual([count['occurrence_count'] for count in self._counts(client)], [4])

    def test_frequency_timer_sleeps_until_the_next_day_or_count_interval(self):
        """不再每分钟取锁读写状态文件：排到日界或计数到期点，新计数防抖后落盘。"""
        from peach import diagnostic_frequency as frequency
        timers = []

        class FakeTimer:
            def __init__(self, delay, callback):
                self.delay, self.callback, self.cancelled, self.daemon = delay, callback, False, False
                timers.append(self)

            def start(self):
                pass

            def cancel(self):
                self.cancelled = True

        def fire(at):
            wall.now.return_value = clock.return_value = at
            active = [timer for timer in timers if not timer.cancelled]
            self.assertEqual(len(active), 1)
            active[0].cancelled = True
            active[0].callback()

        start = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
        midnight = datetime(2026, 11, 2, tzinfo=timezone.utc)
        client = mock.Mock()
        with mock.patch.object(reporting, '_new_client', return_value=client), \
                mock.patch.object(reporting.threading, 'Timer', FakeTimer), \
                mock.patch.object(reporting, 'datetime', wraps=datetime) as wall, \
                mock.patch.object(frequency, '_now', return_value=start) as clock, \
                mock.patch.object(frequency, 'flush', wraps=frequency.flush) as flush:
            wall.now.return_value = start
            reporting.save({'usage': True, 'errors': True})
            self.assertEqual(timers[-1].delay, reporting.FREQUENCY_DEBOUNCE)
            fire(start + timedelta(seconds=60))
            self.assertEqual(client.transport.capture_envelope.call_count, 1)
            self.assertEqual(reporting._frequency_due, midnight.timestamp())
            self.assertEqual(timers[-1].delay, reporting.WALL_CLOCK_RECHECK)
            calls = flush.call_count
            fire(start + timedelta(seconds=60 + reporting.WALL_CLOCK_RECHECK))
            self.assertEqual(flush.call_count, calls, "分段等待的中途不读写状态文件")
            self.assertEqual(client.transport.capture_envelope.call_count, 1)
            fire(midnight)
            self.assertEqual(client.transport.capture_envelope.call_count, 2, "过了日界报当天的活跃")
            reporting.capture('unhandled-main', ValueError('private'))
            self.assertEqual(timers[-1].delay, reporting.FREQUENCY_DEBOUNCE, "新计数把定时器提前到防抖点")
            fire(midnight + timedelta(seconds=60))
            self.assertEqual(reporting._frequency_due, midnight.timestamp() + frequency.INTERVAL)

    def test_daily_activity_is_reported_after_midnight_without_restarting(self):
        client = mock.Mock()
        start = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
        with mock.patch.object(reporting, '_new_client', return_value=client), \
                mock.patch.object(reporting.threading, 'Timer'), \
                mock.patch.object(reporting, 'datetime', wraps=datetime) as clock:
            clock.now.return_value = start
            reporting.save({'usage': True, 'errors': True})
            reporting.usage(self.config)
            reporting._frequency_tick()
            self.assertEqual(client.transport.capture_envelope.call_count, 1)
            clock.now.return_value = start + timedelta(days=1)
            reporting._frequency_tick()
            self.assertEqual(client.transport.capture_envelope.call_count, 2)
            reporting.save({'usage': False, 'errors': False})
            clock.now.return_value = start + timedelta(days=2)
            reporting._frequency_tick()
            self.assertEqual(client.transport.capture_envelope.call_count, 2)

    def test_missing_transport_records_failure_instead_of_leaving_queued(self):
        reporting.save({'usage': True, 'errors': True})
        client = mock.Mock(transport=None)
        with mock.patch.object(reporting, '_new_client', return_value=client):
            reporting.usage(self.config)
        self.assertEqual(reporting.snapshot(self.config)['delivery']['usage']['status'], 'failed')

    def test_enabling_starts_background_reporting_without_restart_and_disable_cancels_it(self):
        with mock.patch.object(reporting.threading, 'Timer') as timer:
            reporting.save({'usage': True, 'errors': True})
            timer.return_value.start.assert_called_once()
            self.assertIn(str(self.config.directory('state')), reporting._frequency_configs)
            reporting.save({'usage': False, 'errors': False})
            timer.return_value.cancel.assert_called_once()
            self.assertIsNone(reporting._frequency_timer)

    def test_actionable_faults_keep_codes_and_omit_private_text(self):
        with mock.patch.object(reporting, "send") as send:
            cause = OSError(13, 'private movie token=secret D:/media/private.mp4')
            error = RuntimeError('private movie')
            error.__cause__ = cause
            reporting.capture("background-job", error, job_id='private-job')
            event = send.call_args.args[1]
            self.assertEqual(event["tags"]["errno"], '13')
            self.assertIn('PermissionError', event['exception']['values'][0]['value'])
            self.assertNotIn('private', json.dumps(event))
            reporting.capture('frame-capture', returncode=69,
                              stderr="private.mp4 Your platform doesn't support hardware accelerated AV1 decoding")
            self.assertEqual(send.call_args.args[1]['tags']['media_failure'], 'av1_decoder_unavailable')

    def test_expected_and_opaque_errors_stay_local(self):
        with mock.patch.object(reporting, "send") as send:
            reporting.capture('logging', message='generic error', level='ERROR')
            reporting.capture('logging', ValueError('source temporarily unavailable'), logger='sentry_sdk.errors')
            reporting.capture('http-request', ValueError('invalid input'), status_code=400)
            reporting.capture('background-result', message='cancelled')
            reporting.capture('browser', message='Script error.', stack='chrome-extension://private/file.js:1:2')
            send.assert_not_called()
            reporting.capture('browser', message='private title', stack='at https://private/dist/peach-app.js:12:34')
            self.assertEqual(send.call_args.args[1]['exception']['values'][0]['stacktrace']['frames'],
                             [{'filename': 'peach-app.js', 'abs_path': 'app:///peach-app.js', 'lineno': 12, 'colno': 34}])

    def test_unsupported_folder_picker_is_local_and_dialog_failures_are_reported(self):
        from peach.folder_picker import command, PickerUnavailable
        from fastapi import HTTPException
        try:
            command(None, platform='linux')
        except PickerUnavailable as cause:
            unsupported = HTTPException(501, 'private')
            unsupported.__cause__ = cause
        with mock.patch.object(reporting, 'send') as send:
            reporting.capture('http-request', unsupported, status_code=501, route='api/pick-folder')
            send.assert_not_called()
            failed = HTTPException(501, 'private')
            failed.__cause__ = PickerUnavailable('errors.folderPicker.cannotOpen')
            reporting.capture('http-request', failed, status_code=501, route='api/pick-folder')
            send.assert_called_once()
            send.reset_mock()
            unexpected = HTTPException(500, 'private')
            unexpected.__cause__ = unsupported.__cause__
            reporting.capture('http-request', unexpected, status_code=500, route='api/pick-folder')
            send.assert_called_once()

    def test_control_and_source_states_keep_local_records_without_remote_events(self):
        import asyncio
        from concurrent.futures import CancelledError
        from peach import error_reporting
        from peach.browser_transport import BrowserUnavailable, ChallengeUnsolved
        from peach.jav_cover_fetch import CoverConnectError, DeadlineExceeded
        from peach.jobs import JobPaused, MeteredSourceDenied, DiskSpaceDenied, TaskRunConflict
        from peach.metadata import MetadataProviderError, relayed
        from peach.previews import PreviewUnavailable
        from peach.scraping_access import SourcePaused
        from peach.segments import SegmentCancelled
        from peach.sources.base import SourceFailure, FailureReason
        from peach.transcodes import TranscodeCancelled
        from starlette.requests import ClientDisconnect
        errors = [asyncio.CancelledError(), CancelledError(), InterruptedError(), JobPaused('errors.updateTasks.pausedForInstall'),
                  MeteredSourceDenied('errors.jobs.meteredSourceDenied', {'location': 'x'}), DiskSpaceDenied('errors.upgradeRepairs.displayBackupNoSpace'), TaskRunConflict('processing', 1),
                  SourcePaused('errors.scrapingAccess.coolingDown'), DeadlineExceeded('errors.javCoverFetch.deadline'),
                  CoverConnectError('errors.javCoverFetch.hostsUnreachable'), PreviewUnavailable(*relayed('snapshot unavailable')),
                  SegmentCancelled(), TranscodeCancelled(), BrowserUnavailable(), ChallengeUnsolved(),
                  ClientDisconnect(),
                  MetadataProviderError('errors.javdb.loginRequired', kind='auth'),
                  MetadataProviderError('errors.javdb.notFound', kind='not_found'),
                  MetadataProviderError('errors.metadataAmane.bridgeTimeout', kind='unavailable', retryable=True)]
        errors += [SourceFailure(reason, *relayed('HTTP 503')) for reason in FailureReason
                   if reason != FailureReason.PARSE_ERROR]
        with mock.patch.object(reporting, 'send') as send:
            for error in errors:
                with self.subTest(error=type(error).__name__):
                    path = error_reporting.event('background-job', error)
                    self.assertTrue(path.is_file())
            send.assert_not_called()

    def test_source_parser_and_unknown_provider_failures_are_actionable(self):
        from peach.metadata import MetadataProviderError, relayed
        from peach.sources.base import SourceFailure, FailureReason
        errors = [SourceFailure(FailureReason.PARSE_ERROR, 'errors.dmm.notWorkJson'),
                  MetadataProviderError('errors.dmm.notWorkJson', kind='unavailable', detail='parse_error'),
                  # amane 桥报告里的原文按默认分类转述（`metadata_amane._bridge_report`）。
                  MetadataProviderError(*relayed('unknown failure'))]
        for error in errors:
            with self.subTest(error=type(error).__name__), mock.patch.object(reporting, 'send') as send:
                reporting.capture('background-job', error)
                send.assert_called_once()

    def test_unrelated_exception_names_do_not_acquire_domain_state_semantics(self):
        for name in ('CancelledError', 'NotFound', 'Unavailable'):
            with self.subTest(name=name), mock.patch.object(reporting, 'send') as send:
                error = type(name, (RuntimeError,), {'__module__': 'peach.fixture'})('unexpected failure')
                reporting.capture('background-job', error)
                send.assert_called_once()

    def test_source_client_http_statuses_are_local_and_server_failures_are_reported(self):
        import httpx
        from urllib.error import HTTPError
        for code in (400, 401, 403, 404, 410, 429, 500, 503):
            response = httpx.Response(code, request=httpx.Request('GET', 'https://example.test/'))
            errors = [httpx.HTTPStatusError('http state', request=response.request, response=response),
                      HTTPError('https://example.test/', code, 'http state', {}, None)]
            for error in errors:
                with self.subTest(code=code, error=type(error).__name__), \
                        mock.patch.object(reporting, 'send') as send:
                    reporting.capture('background-job', error)
                    if code < 500:
                        send.assert_not_called()
                    else:
                        send.assert_called_once()
                        self.assertEqual(send.call_args.args[1]['tags']['status_code'], str(code))

    def test_warning_exceptions_do_not_consume_remote_error_budget(self):
        namespace = {}
        exec(compile('def fail():\n    raise ValueError("retrying")\n', 'peach/fixture.py', 'exec'), namespace)
        try:
            namespace['fail']()
        except ValueError as error:
            with mock.patch.object(reporting, 'send') as send:
                reporting.capture('logging', error, level='WARNING', logger='peach.fixture')
                send.assert_not_called()
                reporting.capture('logging', error, level='ERROR', logger='peach.fixture')
                send.assert_called_once()

    def _condition_of(self, send):
        """断言这次捕获只计数，返回环境条件类别；计数样本不带错误码、路径或原文。"""
        send.assert_called_once()
        self.assertEqual(send.call_args.kwargs, {'count_only': True})
        event = send.call_args.args[1]
        self.assertNotIn('private', json.dumps(event))
        self.assertNotIn('movie.mp4', json.dumps(event))
        self.assertEqual(set(event['tags']), {'os', 'python', 'architecture', 'stage', 'condition'})
        return event['tags']['condition']

    def test_lock_contention_and_upstream_stay_local_while_disk_and_database_conditions_are_counted(self):
        import errno
        import sqlite3
        import httpx
        from fastapi import HTTPException
        from filelock import Timeout
        timeout = httpx.ConnectTimeout('private', request=httpx.Request('GET', 'https://example.test/'))
        for stage, error, fields in (('background-job', Timeout('private.lock'), {}), ('background-job', timeout, {}),
                                     ('http-request', HTTPException(502, 'private'), {'status_code': 502})):
            with self.subTest(error=type(error).__name__, stage=stage), mock.patch.object(reporting, 'send') as send:
                reporting.capture(stage, error, level='ERROR', **fields)
                send.assert_not_called()
        counted = [('media-probe', TimeoutError(errno.ETIMEDOUT, 'private'), {'tool': 'ffprobe'}, 'timeout'),
                   ('library-preview', OSError(errno.EIO, 'private'), {}, 'io_error'),
                   ('library-preview', OSError(errno.ENXIO, 'private', 'movie.mp4'), {}, 'media_volume'),
                   ('library-preview', OSError(errno.ENOTCONN, 'private'), {}, 'media_volume')]
        for name, condition in (('SQLITE_IOERR_SHMSIZE', 'sqlite_io'), ('SQLITE_FULL', 'disk_full'),
                                ('SQLITE_BUSY', 'sqlite_busy'), ('SQLITE_LOCKED', 'sqlite_busy')):
            error = sqlite3.OperationalError('private')
            error.sqlite_errorname = name
            counted.append(('background-job', error, {}, condition))
        for stage, error, fields, condition in counted:
            with self.subTest(condition=condition, stage=stage), mock.patch.object(reporting, 'send') as send:
                reporting.capture(stage, error, level='ERROR', **fields)
                self.assertEqual(self._condition_of(send), condition)
        reported = sqlite3.OperationalError('private')
        reported.sqlite_errorname = 'SQLITE_ERROR'
        for stage, error, fields in (('background-job', reported, {}),
                                     ('http-request', RuntimeError('private'), {'status_code': 500})):
            with self.subTest(error=type(error).__name__), mock.patch.object(reporting, 'send') as send:
                reporting.capture(stage, error, level='ERROR', **fields)
                send.assert_called_once()
                self.assertEqual(send.call_args.kwargs, {})

    def test_media_input_conditions_are_counted_and_decoder_faults_are_reported(self):
        import errno
        for marker, condition in (('Invalid data found', 'invalid_media'), ('Permission denied', 'permission_denied'),
                                  ('No space left', 'disk_full'), ('No such file or directory', 'missing_media'),
                                  ('Invalid argument', 'invalid_media'), ('Input/output error', 'io_error')):
            with self.subTest(marker=marker), mock.patch.object(reporting, 'send') as send:
                reporting.capture('frame-capture', returncode=1, stderr=marker)
                self.assertEqual(self._condition_of(send), condition)
        for error, condition in ((OSError(errno.ENOSPC, 'private'), 'disk_full'),
                                 (subprocess.TimeoutExpired('ffprobe', 20), 'timeout'),
                                 (FileNotFoundError(2, 'private', 'movie.mp4'), 'missing_media'),
                                 (PermissionError(13, 'private', 'movie.mp4'), 'permission_denied')):
            with self.subTest(error=type(error).__name__), mock.patch.object(reporting, 'send') as send:
                reporting.capture('media-probe', error, tool='ffprobe')
                self.assertEqual(self._condition_of(send), condition)
        with mock.patch.object(reporting, 'send') as send:
            reporting.capture('media-probe', FileNotFoundError(2, 'missing tool', 'ffprobe'), tool='ffprobe')
            send.assert_called_once()
            self.assertEqual(send.call_args.kwargs, {})
            send.reset_mock()
            reporting.capture('frame-capture', returncode=69,
                              stderr="Your platform doesn't support hardware accelerated AV1 decoding")
            send.assert_called_once()
            send.reset_mock()
            reporting.capture('frame-capture', returncode=1,
                              stderr='Unknown decoder; Invalid data found')
            send.assert_called_once()

    def test_browser_abort_and_extension_frames_stay_local_and_bundle_versions_keep_positions(self):
        with mock.patch.object(reporting, 'send') as send:
            reporting.capture('browser', error_name='AbortError', stack='peach-app.js:12:34')
            reporting.capture('browser', stack='at chrome-extension://extension/peach-app.js:12:34')
            reporting.capture('browser', stack='at moz-extension://extension/peach-pages.js:12:34')
            send.assert_not_called()
            reporting.capture('browser', stack='at https://example.test/dist/peach-app.js?v=build:12:34')
            send.assert_called_once()
            frames = send.call_args.args[1]['exception']['values'][0]['stacktrace']['frames']
            self.assertEqual(frames, [{'filename': 'peach-app.js', 'abs_path': 'app:///peach-app.js', 'lineno': 12, 'colno': 34}])

    def test_preview_environment_conditions_preserve_guidance_and_local_issue(self):
        from peach import library_processing
        from peach.previews import PreviewUnavailable
        resolver = mock.Mock()
        resolver.ffmpeg.return_value = None
        row = {'id': 1, 'path': str(self.root / 'missing.mp4'), 'location': 'local', 'name': 'missing.mp4'}
        with self.assertRaises(PreviewUnavailable) as raised:
            library_processing._generate_preview(self.config, row, mock.Mock(), resolver, progress=lambda: None)
        issue = mock.Mock()
        with mock.patch.object(reporting, 'send') as send, \
                mock.patch.object(library_processing, '_generate_preview', side_effect=raised.exception):
            made = library_processing._generate_previews(self.config, [row], mock.Mock(),
                update=mock.Mock(), issue=issue, guard=mock.Mock())
        self.assertEqual(made, 0)
        self.assertIn('FFmpeg', library_processing.phrase_text(issue.call_args.args[1]))
        self.assertTrue(issue.call_args.kwargs['retryable'])
        send.assert_not_called()

    def test_sdk_wire_payload_has_no_local_context_or_consent_path(self):
        from sentry_sdk.transport import HttpTransport
        sent = []
        (self.config.directory("state") / "remote-reporting.json").unlink()
        with mock.patch.object(HttpTransport, "_send_envelope", side_effect=lambda envelope: sent.append(envelope.serialize())):
            reporting.capture("unhandled-main", ValueError("private title token=secret"))
            reporting._client.flush(timeout=2)
        self.assertEqual(len(sent), 1)
        wire = sent[0].decode()
        for value in ('private title', 'secret', str(self.root), 'server_name', 'contexts', 'extra', 'consent'):
            self.assertNotIn(value, wire)
        self.assertIn('ValueError', wire)
        self.assertIn('occurrence_count', wire)
        self.assertIn('diagnostic_key', wire)

    def test_queued_event_requires_current_joint_consent_revision(self):
        from sentry_sdk.transport import HttpTransport
        from sentry_sdk.envelope import Envelope
        reporting.save({"usage": True, "errors": True})
        previous = reporting.consent()
        client = reporting._new_client(DSN)
        self.addCleanup(lambda: client.close(timeout=0))
        envelope = Envelope()
        envelope.add_event({"message": "Peach started", "extra": {
            "consent": str(self.config.directory('state') / 'remote-reporting.json'),
            "kind": "usage", "revision": previous['revision']}})
        reporting.save({"usage": False, "errors": False})
        reporting.save({"usage": True, "errors": True})
        with mock.patch.object(HttpTransport, "_send_envelope") as network:
            client.transport._send_envelope(envelope)
            network.assert_not_called()
            path = self.config.directory('state') / 'remote-reporting.json'
            for usage, errors in ((True, False), (False, True)):
                path.write_text(json.dumps({"usage": usage, "errors": errors, "revision": previous['revision']}))
                client.transport._send_envelope(envelope)
            network.assert_not_called()

    def test_telemetry_envelopes_need_a_current_permit_and_events_cannot_carry_them(self):
        from sentry_sdk.transport import HttpTransport
        from sentry_sdk.envelope import Envelope, Item, PayloadRef
        reporting.save({"usage": True, "errors": True})
        current = reporting.consent()
        client = reporting._new_client(DSN)
        self.addCleanup(lambda: client.close(timeout=0))
        permit = {"consent": str(self.config.directory('state') / 'remote-reporting.json'),
                  "kind": "usage", "revision": current['revision'], "receipt": 'r' * 32}

        def envelope(headers, *items):
            built = Envelope(headers=headers)
            for kind in items:
                if kind == 'event':
                    built.add_event({"message": "fixture", "extra": dict(permit)})
                else:
                    built.add_item(Item(type=kind, payload=PayloadRef(json={"items": []})))
            return built

        sent = []
        with mock.patch.object(HttpTransport, "_send_envelope", side_effect=sent.append):
            client.transport._send_envelope(envelope({"peach_permit": dict(permit)}, 'log', 'sessions'))
            self.assertEqual(len(sent), 1)
            self.assertNotIn('peach_permit', sent[0].headers)
            for blocked in (envelope({}, 'log'), envelope({"peach_permit": dict(permit)}, 'log', 'event'),
                            envelope({}, 'event', 'sessions'),
                            envelope({"peach_permit": {**permit, "revision": "old"}}, 'log')):
                client.transport._send_envelope(blocked)
            self.assertEqual(len(sent), 1)

    def test_usage_wire_payload_has_no_host_sdk_or_consent_path(self):
        from sentry_sdk.transport import HttpTransport
        sent = []
        reporting.save({"usage": True, "errors": True})
        with mock.patch.object(HttpTransport, "_send_envelope", side_effect=lambda envelope: sent.append(envelope.serialize())):
            reporting.usage()
            reporting._client.flush(timeout=2)
        self.assertEqual(len(sent), 1)
        wire = sent[0].decode()
        for value in (str(self.root), 'server.address', 'sentry.sdk', 'consent', 'peach_permit', 'receipt'):
            self.assertNotIn(value, wire)
        self.assertIn('"type":"log"', wire.replace(' ', ''))
        self.assertIn('"aggregates"', wire)

    def test_sdk_failure_does_not_break_local_error_recording(self):
        from peach import error_reporting
        reporting.save({"usage": True, "errors": True})
        with mock.patch.object(reporting, "_new_client", side_effect=OSError('offline')), \
                mock.patch.object(error_reporting, 'log_directories', return_value=[self.root / 'logs']):
            path = error_reporting.event('unhandled-main', ValueError('local detail'))
        self.assertTrue(path.is_file())

    def test_http_failure_keeps_template_and_error_id_without_request_details(self):
        with mock.patch.object(reporting, "send") as send:
            reporting.capture('http-request', ValueError('private query'), method='POST',
                              route='api/assets/{asset_id}', status_code=500, error_id='a' * 32,
                              query='token=secret', headers={'Authorization': 'secret'})
            event = send.call_args.args[1]
        self.assertEqual(event['event_id'], 'a' * 32)
        self.assertEqual(event['tags']['route_template'], 'api/assets/{asset_id}')
        self.assertEqual(event['tags']['status_code'], '500')
        self.assertNotIn('secret', json.dumps(event))

    def test_installer_choice_is_saved_without_startup_reporting(self):
        reporting.save({"usage": True, "errors": True})
        entry = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/build_app_entry.py"))
        with mock.patch("peach.error_reporting.install", side_effect=reporting.usage), \
                mock.patch.object(reporting, "send") as send:
            self.assertEqual(entry["main"](["Peach.exe", "--installer-reporting", "0", "0"]), 0)
            send.assert_not_called()
        self.assertFalse(reporting.consent()["usage"])
        self.assertFalse(reporting.consent()["errors"])

    def test_installer_helpers_keep_startup_and_faults_local(self):
        reporting.save({"usage": True, "errors": True})
        entry = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/build_app_entry.py"))

        def helper(*_args):
            reporting.capture("unhandled-main", RuntimeError("installer fault"))
            return 0

        cases = (
            ("--installer-stop", "main", []),
            ("--installer-uninstall", "main", []),
            ("--installer-prepare", "prepare", [str(self.root), "123", str(self.root / "error.txt")]),
            ("--installer-tools", "prepare_install_tools", [str(self.root)] * 3),
            ("--installer-finish", "finish_install", [str(self.root), "123"]),
            ("--installer-migrate", "migrate_install", [str(self.root)]),
        )
        for mode, handler, args in cases:
            with self.subTest(mode=mode), mock.patch.object(reporting, "_disabled", False), \
                    mock.patch("peach.error_reporting.install", side_effect=reporting.usage), \
                    mock.patch(f"peach.desktop_installer.{handler}", side_effect=helper), \
                    mock.patch.object(reporting, "_new_client") as client:
                self.assertEqual(entry["main"](["Peach.exe", mode, *args]), 0)
                client.assert_not_called()
                self.assertTrue(reporting.consent()["usage"])
                self.assertTrue(reporting.consent()["errors"])

    def test_read_helpers_leave_reporting_to_the_parent_process(self):
        """独立包每读一次媒体起一个子进程；它们各自发统计、退出时提交计数，会把计数拆成一次一条。"""
        reporting.save({"usage": True, "errors": True})
        entry = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/build_app_entry.py"))

        def helper(_argv):
            reporting.capture("unhandled-main", RuntimeError("helper fault"))
            reporting.flush_counts(force=True)
            return 0

        for command, sends in (("media-read", False), ("local-image", False), ("scan", True)):
            with self.subTest(command=command), mock.patch.object(reporting, "_disabled", False), \
                    mock.patch.dict(entry["main"].__globals__, {"cli_main": helper, "_prepare_console": lambda: None}), \
                    mock.patch("peach.error_reporting.install", side_effect=reporting.usage), \
                    mock.patch.object(reporting, "_new_client") as client:
                self.assertEqual(entry["main"](["Peach.exe", command]), 0)
                self.assertEqual(client.called, sends)
            reporting.close()

    def test_installer_helper_persists_explicit_choices_in_fresh_process(self):
        root = Path(__file__).resolve().parents[1]
        env = {**os.environ, 'PYTHONPATH': str(root / 'src'), 'PEACH_SENTRY_DSN': ''}
        for usage, errors in (('1', '1'), ('0', '0')):
            result = subprocess.run([sys.executable, '-X', 'utf8', str(root / 'scripts/build_app_entry.py'),
                                     '--installer-reporting', usage, errors], env=env,
                                    capture_output=True, text=True, encoding='utf-8', timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(reporting.consent()['usage'], usage == '1')
            self.assertEqual(reporting.consent()['errors'], errors == '1')
        self.assertFalse(self.config.path.exists())

    def test_invalid_installer_arguments_do_not_start_tray_or_network(self):
        reporting.save({"usage": True, "errors": True})
        entry = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/build_app_entry.py"))
        tray = mock.Mock()
        with mock.patch.dict(entry["main"].__globals__, {"tray_main": tray}), \
                mock.patch("peach.error_reporting.install", side_effect=reporting.usage), \
                mock.patch.object(reporting, "_new_client") as client:
            for mode in ("--installer-prepare", "--installer-reporting", "--installer-unknown"):
                with self.subTest(mode=mode), self.assertRaises(ValueError):
                    entry["main"](["Peach.exe", mode])
            tray.assert_not_called()
            client.assert_not_called()


class PackagedReportingConfigTests(unittest.TestCase):
    """两端打包共用的 `sentry.json` 写入；发行构建缺 DSN 必须失败，而不是产出静默的安装包。"""

    LIBRARY_DSN = "https://public@o123.ingest.us.sentry.io/789"

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name).resolve()
        self.output = self.root / "bundle" / "sentry.json"

    def write(self, *flags, **targets):
        env = {key: value for key, value in os.environ.items()
               if key not in {"PEACH_SENTRY_DSN", "PEACH_LIBRARY_SENTRY_DSN"}}
        env.update(targets, PYTHONIOENCODING="utf-8")
        script = Path(__file__).resolve().parents[1] / "scripts/write_reporting_config.py"
        return subprocess.run([sys.executable, "-X", "utf8", str(script), "--output", str(self.output), *flags],
                              capture_output=True, text=True, encoding="utf-8", env=env, timeout=60)

    def test_release_config_is_read_back_by_the_packaged_runtime(self):
        result = self.write("--require", PEACH_SENTRY_DSN=DSN, PEACH_LIBRARY_SENTRY_DSN=self.LIBRARY_DSN)
        self.assertEqual(result.returncode, 0, result.stderr)
        from peach import library_sharing
        with mock.patch.dict(os.environ, {"PEACH_SENTRY_DSN": "", "PEACH_LIBRARY_SENTRY_DSN": ""}), \
                mock.patch("peach.settings_file.PROJECT_ROOT", self.output.parent):
            self.assertEqual(reporting.dsn(), DSN)
            self.assertEqual(library_sharing.target(), self.LIBRARY_DSN)

    def test_local_build_without_targets_ships_an_unconfigured_bundle(self):
        result = self.write()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(self.output.read_text(encoding="utf-8")), {"dsn": "", "library_dsn": ""})

    def test_release_build_rejects_missing_invalid_or_shared_targets(self):
        cases = {
            "缺共享馆藏": {"PEACH_SENTRY_DSN": DSN},
            "非 Sentry 托管": {"PEACH_SENTRY_DSN": "https://public@sentry.example.com/456",
                              "PEACH_LIBRARY_SENTRY_DSN": self.LIBRARY_DSN},
            "同一项目": {"PEACH_SENTRY_DSN": DSN, "PEACH_LIBRARY_SENTRY_DSN": DSN},
        }
        for name, targets in cases.items():
            with self.subTest(name):
                result = self.write("--require", **targets)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.output.exists())


class RemoteReportingApiTests(unittest.TestCase):
    setUp = RemoteReportingTests.setUp

    def request(self, method, path, *, peer='127.0.0.1', origin='http://test', body=None):
        import asyncio
        import httpx
        from fastapi import FastAPI
        from peach.routes_configuration import router, require_auth
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_auth] = lambda: {}

        async def run():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=(peer, 1234)),
                                         base_url='http://test') as client:
                return await client.request(method, path, json=body, headers={'Origin': origin})
        return asyncio.run(run())

    def test_local_save_and_remote_and_cross_origin_denial(self):
        endpoint = '/api/configuration/remote-reporting'
        body = {'usage': True, 'errors': True}
        response = self.request('POST', endpoint, body=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()['usage'])
        self.assertTrue(response.json()['errors'])
        response = self.request('POST', endpoint, body={'usage': False, 'errors': True})
        self.assertEqual(response.status_code, 400, response.text)
        for peer, origin in (('198.51.100.7', 'http://test'), ('127.0.0.1', 'https://external.invalid')):
            response = self.request('POST', endpoint, body={'usage': False, 'errors': False}, peer=peer, origin=origin)
            self.assertEqual(response.status_code, 403, response.text)
        self.assertTrue(reporting.consent()['errors'])
