"""异常取证与分享报告只使用临时目录；进程级钩子在子进程里验证。"""
import asyncio
import contextlib
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from peach import error_reporting, support_bundle, scraping_diagnostics
from support.ledger import fresh_ledger

ROOT = Path(__file__).resolve().parents[1]


class ErrorReportingTests(unittest.TestCase):
    def test_timezone_lookup_logging_has_a_bounded_local_record(self):
        import logging
        def lookup():
            error_reporting.ErrorHandler().emit(logging.LogRecord('tzlocal', logging.WARNING, '', 0,
                                                                   'synthetic timezone warning', (), None))
            return 'Asia/Taipei'
        with mock.patch('tzlocal.get_localzone_name', side_effect=lookup) as name:
            error_reporting.local_event('synthetic')
        self.assertEqual(name.call_count, 1)
        rows = self.records()
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['server_timezone']['reason'], 'lookup-in-progress')
        self.assertEqual(rows[1]['server_timezone']['name'], 'Asia/Taipei')

    def test_local_timezone_and_browser_timezone_are_independent_and_survive_export(self):
        from datetime import datetime, timedelta, timezone
        from zoneinfo import ZoneInfoNotFoundError
        from peach import diagnostic_context, remote_reporting
        moment = datetime(2026, 10, 24, 21, 0, tzinfo=timezone(timedelta(hours=8)))
        with mock.patch('tzlocal.get_localzone_name', return_value='Asia/Taipei'):
            facts = error_reporting.timezone_facts(moment)
        self.assertEqual(facts['name'], 'Asia/Taipei')
        self.assertEqual(facts['utc_offset_minutes'], 480)
        self.assertTrue(facts['local_time'].endswith('+08:00'))
        browser = diagnostic_context.browser({'timezone': 'America/New_York', 'utc_offset_minutes': -240})
        with mock.patch.object(error_reporting, 'timezone_facts', return_value=facts), \
                mock.patch.object(remote_reporting, 'capture') as capture:
            path = error_reporting.local_event('browser-context', browser=browser)
        capture.assert_not_called()
        record = json.loads(support_bundle.redact_log(path.read_text(encoding='utf-8')))
        self.assertEqual(record['server_timezone'], facts)
        self.assertEqual(record['browser']['timezone'], 'America/New_York')
        self.assertEqual(record['browser']['utc_offset_minutes'], -240)
        with mock.patch('tzlocal.get_localzone_name', side_effect=ZoneInfoNotFoundError('synthetic')):
            fallback = error_reporting.timezone_facts(moment)
        self.assertEqual(fallback['status'], 'unavailable')
        self.assertEqual(fallback['utc_offset_minutes'], 480)
        self.assertTrue(fallback['local_time'].endswith('+08:00'))

    def test_access_export_keeps_media_response_evidence_and_removes_queries(self):
        for target in ('/stream?id=9&session=private-session', '/follow-stream?ticket=private-ticket',
                       '/api/stream-plan?id=9&t=private-token', '/stream/hls/9/index.m3u8?token=private-token'):
            with self.subTest(target=target):
                exported = support_bundle.redact_log(f'INFO: 198.51.100.23:3456 - "GET {target} HTTP/1.1" 206 Partial Content\n')
                self.assertIn(f'GET {target.split("?")[0]} HTTP/1.1" 206 Partial Content', exported)
                for private in ('198.51.100.23', 'private-', '?', 'session=', 'ticket='):
                    self.assertNotIn(private, exported)
        exported = support_bundle.redact_log('INFO: "GET /private/media/movie.mp4?token=secret HTTP/1.1" 404 Not Found\n')
        self.assertIn('GET <path> HTTP/1.1" 404 Not Found', exported)
        self.assertNotIn('private', exported)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.logs = self.root / "logs"
        self.addCleanup(mock.patch.stopall)
        mock.patch.dict(os.environ, {"PEACH_DATA_ROOT": str(self.root)}).start()
        mock.patch.object(error_reporting, "_log_dir", self.logs).start()

    def probe(self, code):
        return subprocess.run([sys.executable, "-X", "utf8", "-c", code],
                              env={**os.environ, "PYTHONPATH": str(ROOT / "src")},
                              capture_output=True, text=True, encoding="utf-8", timeout=30)

    def scraping_config(self):
        from peach.settings_file import PeachConfig
        config = PeachConfig(self.root, self.root / 'config.toml')
        evidence = config.directory('sources') / 'library-metadata'
        evidence.mkdir(parents=True)
        return config, evidence

    def test_support_bundle_includes_small_scraping_details_and_source_index(self):
        config, evidence = self.scraping_config()
        (evidence / 'ABC-123-javdb.json').write_text(json.dumps({
            'id': 'ABC-123', 'title': 'private-work-title', 'actresses': [{'name': 'private-performer'}],
            'Cookie': 'private-cookie'}), encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(config=config))) as archive:
            summary = json.loads(archive.read('scraping/summary.json'))
            self.assertEqual(summary['records'][0]['code'], 'ABC-123')
            self.assertEqual(summary['records'][0]['source'], 'javdb')
            self.assertIn('actresses', summary['records'][0]['fields'])
            self.assertNotIn('private-', str(summary))
            self.assertEqual(summary['export']['status'], 'included')
            snapshot = json.loads(archive.read('scraping/snapshots/0.json'))
            self.assertEqual(snapshot['fields']['title'], 'private-work-title')
            self.assertNotIn('private-cookie', str(snapshot))
            self.assertIn('scraping/manifest.json', archive.namelist())
            self.assertEqual(json.loads(archive.read('report.json'))['scraping']['status'], 'included')

    def test_support_bundle_marks_large_scraping_details_for_scoped_export(self):
        config, evidence = self.scraping_config()
        (evidence / 'ABC-123-javdb.json').write_text(json.dumps({'id': 'ABC-123', 'title': '来源标题'}), encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                mock.patch.object(support_bundle, 'SCRAPING_INLINE_LIMIT', 1), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(config=config))) as archive:
            summary = json.loads(archive.read('scraping/summary.json'))
            self.assertEqual(summary['export']['status'], 'separate_export_required')
            self.assertGreater(summary['export']['compressed_bytes'], summary['export']['inline_limit_bytes'])
            self.assertNotIn('scraping/manifest.json', archive.namelist())
            self.assertIn('separately by code', summary['detail'])
        with zipfile.ZipFile(io.BytesIO(scraping_diagnostics.bundle_bytes(config, codes='ABC-123'))) as archive:
            self.assertIn('snapshots/0.json', archive.namelist())

    def test_both_exports_preserve_bridge_encoding_provenance(self):
        config, evidence = self.scraping_config()
        facts = {'stage': 'bridge_stdio_decode', 'status': 'ok', 'expected_encoding': 'utf-8',
                 'runtime': 'executable', 'stdout_encoding': 'utf-8', 'stderr_encoding': 'utf-8',
                 'amane_version': '0.22.1'}
        (evidence / 'ABC-123-makers.json').write_text(json.dumps({
            'id': 'ABC-123', 'title': '完整𠮷野标题', 'collection_diagnostics': facts,
            'Cookie': 'private-cookie'}), encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]):
            bundles = [(scraping_diagnostics.bundle_bytes(config, codes='ABC-123'), ''),
                       (support_bundle.bundle_bytes(config=config), 'scraping/')]
        for content, prefix in bundles:
            with self.subTest(prefix=prefix), zipfile.ZipFile(io.BytesIO(content)) as archive:
                snapshot = json.loads(archive.read(prefix + 'snapshots/0.json'))
                self.assertEqual(snapshot['fields']['collection_diagnostics'], facts)
                self.assertEqual(snapshot['fields']['title'], '完整𠮷野标题')
                self.assertNotIn('private-cookie', str(snapshot))

    def test_support_bundle_includes_available_small_records_beyond_manual_code_limit(self):
        config, evidence = self.scraping_config()
        for number in range(25):
            code = f'ABC-{number:03}'
            (evidence / f'{code}-javdb.json').write_text(json.dumps({'id': code, 'title': '来源标题'}), encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(config=config))) as archive:
            manifest = json.loads(archive.read('scraping/manifest.json'))
            self.assertEqual(manifest['selection'], 'available')
            self.assertEqual(len(manifest['codes']), 25)
            self.assertEqual(len([name for name in archive.namelist() if name.startswith('scraping/snapshots/')]), 25)

    def test_scraping_export_preserves_source_candidate_and_entity_lineage_readonly(self):
        import sqlite3
        from contextlib import closing
        from peach.migrations import upgrade
        from peach.review_csv import write_rows
        config, evidence = self.scraping_config()
        database = config.directory('database') / 'ledger.db'
        database.parent.mkdir()
        upgrade(database, ROOT / 'migrations')
        snapshot = evidence / 'ABC-123-javdb.json'
        snapshot.write_text(json.dumps({'id': 'ABC-123', 'title': '来源标题',
            'actresses': [{'name': '来源演员', 'token': 'private-token'}],
            'cookie': 'private-cookie', 'source_url': 'https://example.com/work?token=private-url'}), encoding='utf-8')
        unrelated = evidence / 'DEF-456-javdb.json'
        unrelated.write_text(json.dumps({'id': 'DEF-456', 'title': 'unrelated-title'}), encoding='utf-8')
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium,code,catalog_title,field_owners) "
                "VALUES(1,'local','R:/private-file.mp4','private-file.mp4','video','ABC-123','当前标题','{}')")
            connection.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at) "
                "VALUES(1,'performer','归属演员','归属演员','now','now')")
            connection.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source,confidence,metadata_json) "
                "VALUES(1,1,'performer','javinizer:javdb:performers',0.6,?)",
                (json.dumps({'source': 'javdb', 'raw_snapshot': str(snapshot)}),))
            connection.execute("INSERT INTO entity_alias(entity_id,alias,normalized_alias,source) "
                "VALUES(1,'来源演员','来源演员','javdb')")
            connection.execute("INSERT INTO review_decision(category,item_key,status,updated_at) "
                "VALUES('metadata_fields','asset:1:performers','approved','now')")
        candidate_root = config.directory('generated')
        candidate_root.mkdir()
        choices = [{'candidate_key': 'choice', 'source': 'javdb', 'value': ['来源演员'],
                    'confidence': 0.6, 'raw_snapshot': str(snapshot), 'cookie': 'private-cookie'}]
        write_rows(candidate_root / 'library-metadata-field-candidates.csv',
                   ('item_key', 'code', 'asset_id', 'asset_path', 'field', 'candidates_json'),
                   [dict(item_key='asset:1:performers', code='ABC-123', asset_id=1,
                         asset_path='R:/private-file.mp4', field='performers', candidates_json=json.dumps(choices))])
        before = database.read_bytes()
        with zipfile.ZipFile(io.BytesIO(scraping_diagnostics.bundle_bytes(config, codes='abc-123'))) as archive:
            content = '\n'.join(archive.read(name).decode() for name in archive.namelist())
            self.assertIn('来源演员', content)
            self.assertIn('归属演员', content)
            for private in ('private-token', 'private-cookie', 'private-url', 'private-file', 'unrelated-title'):
                self.assertNotIn(private, content)
            candidates = json.loads(archive.read('candidates.json'))['records']
            snapshot_ref = candidates[0]['candidates'][0]['snapshot']
            source = json.loads(archive.read('snapshots/0.json'))
            self.assertEqual(source['snapshot'], snapshot_ref)
            self.assertEqual(source['fields']['id'], 'ABC-123')
            self.assertEqual(json.loads(archive.read('ledger/decisions.json'))['records'][0]['status'], 'approved')
            self.assertEqual(json.loads(archive.read('manifest.json'))['codes'], ['ABC-123'])
        self.assertEqual(database.read_bytes(), before)

    def test_scraping_export_reports_invalid_and_oversized_evidence_without_tail_json(self):
        config, evidence = self.scraping_config()
        (evidence / 'ABC-123-javdb.json').write_text('{broken', encoding='utf-8')
        (evidence / 'ABC-123-javbus.json').write_bytes(b'x' * (scraping_diagnostics.FILE_LIMIT + 1))
        with zipfile.ZipFile(io.BytesIO(scraping_diagnostics.bundle_bytes(config, codes='ABC-123'))) as archive:
            manifest = json.loads(archive.read('manifest.json'))
            self.assertEqual(sorted(row['status'] for row in manifest['entries']
                                    if row['name'].startswith('snapshots/')), ['file_limit', 'unavailable'])
            self.assertFalse(any(name.startswith('snapshots/') for name in archive.namelist()))
        for value in ('../secret', 'a/b', ','.join(f'ABC-{n}' for n in range(21))):
            with self.assertRaises(ValueError):
                scraping_diagnostics.bundle_bytes(config, codes=value)

    def test_scraping_export_retains_manifest_when_content_budget_is_exhausted(self):
        config, evidence = self.scraping_config()
        (evidence / 'ABC-123-javdb.json').write_text(json.dumps({'id': 'ABC-123', 'title': '长' * 80000}), encoding='utf-8')
        with mock.patch.object(scraping_diagnostics, 'EXPORT_LIMIT', 180000), \
                zipfile.ZipFile(io.BytesIO(scraping_diagnostics.bundle_bytes(config, codes='ABC-123'))) as archive:
            manifest = json.loads(archive.read('manifest.json'))
            self.assertTrue(any(row['status'] == 'size_limit' for row in manifest['entries']))
            self.assertLessEqual(sum(info.file_size for info in archive.infolist()), 180000)

    def test_scraping_export_rejects_candidate_snapshot_outside_sources_and_remote_download(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from peach.routes_api import require_auth
        from peach.routes_configuration import router
        from peach.review_csv import write_rows
        from peach.web_contract import WebContract
        config, _evidence = self.scraping_config()
        outside = self.root / 'outside.json'
        outside.write_text(json.dumps({'title': 'private-outside-evidence'}), encoding='utf-8')
        generated = config.directory('generated')
        generated.mkdir()
        write_rows(generated / 'library-metadata-field-candidates.csv',
                   ('item_key', 'code', 'candidates_json'),
                   [dict(item_key='asset:1:title', code='ABC-123', candidates_json=json.dumps([
                       {'value': '公开作品名', 'raw_snapshot': str(outside)}]))])
        app = FastAPI()
        app.state.web_contract = WebContract(fresh_ledger(self.root))
        app.include_router(router)
        app.dependency_overrides[require_auth] = lambda: {}
        client = TestClient(app, base_url='http://127.0.0.1', client=('127.0.0.1', 1234))
        with mock.patch('peach.settings_file.load_config', return_value=config):
            started = client.post('/api/diagnostics/exports', json={'kind': 'scraping', 'codes': 'ABC-123'})
            self.assertEqual(started.status_code, 200)
            app.state.diagnostic_exports.job.thread.join(10)
            identity = started.json()['job_id']
            response = client.get(f'/api/diagnostics/exports/{identity}/download')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['cache-control'], 'no-store')
            with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
                self.assertNotIn('private-outside-evidence', str([archive.read(name) for name in archive.namelist()]))
                manifest = json.loads(archive.read('manifest.json'))
                self.assertTrue(any(row['name'].startswith('snapshots/') and row['status'] == 'unavailable'
                                    for row in manifest['entries']))
            self.assertEqual(client.post('/api/diagnostics/exports', json={'kind': 'scraping', 'codes': '../secret'}).status_code, 400)
            remote = TestClient(app, base_url='http://127.0.0.1', client=('192.0.2.55', 1234))
            self.assertEqual(remote.get('/api/diagnostics/exports').status_code, 403)

    def test_processing_export_keeps_recent_bounded_evidence_and_hides_media_names(self):
        from peach.settings_file import PeachConfig
        config = PeachConfig(self.root, self.root / 'config.toml', present=True)
        state = config.directory('state')
        state.mkdir(parents=True)
        row = {'asset_id': 23, 'title': 'private-movie.mp4', 'path': r'D:\private\movie.mp4',
               'diagnostics': {'reason': 'timeout', 'stderr': 'token=private-token',
                               'timestamp_seconds': 12, 'timeout_seconds': 45}}
        for index in range(10):
            path = state / f'library-processing-{index}.issues.jsonl'
            path.write_text(json.dumps(row) + '\n', encoding='utf-8')
            os.utime(path, (100 + index, 100 + index))
        (state / 'private-credentials.json').write_text('private-credentials', encoding='utf-8')
        (state / 'library-processing.json').write_text(json.dumps({
            'status': 'failed', 'issue_preview': [row], 'current_asset_name': 'private-movie.mp4'}),
            encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(config=config))) as archive:
            names = [name for name in archive.namelist() if name.startswith('processing/')]
            self.assertEqual(len(names), 9)
            self.assertNotIn('processing/library-processing-0.issues.jsonl', names)
            exported = json.loads(archive.read('processing/library-processing-9.issues.jsonl'))
            self.assertEqual(exported['asset_id'], 23)
            self.assertEqual(exported['diagnostics']['timestamp_seconds'], 12)
            contents = '\n'.join(archive.read(name).decode() for name in archive.namelist())
        for private in ('private-movie', 'private-token', 'private-credentials', r'D:\private'):
            self.assertNotIn(private, contents)

    def test_processing_export_redacts_path_keys_and_keeps_them_unique(self):
        from peach.settings_file import PeachConfig
        config = PeachConfig(self.root, self.root / 'config.toml', present=True)
        state = config.directory('state')
        state.mkdir(parents=True)
        items = r'C:\Users\runner\peach-data\state\library-processing-items'
        (state / 'library-processing.json').write_text(json.dumps({
            'status': 'running',
            'local_metadata': {r"7:C:\Users\runner\Videos\owner's ABC-123 owner-movie.mp4": items + r'\7-a.json',
                               '8:/home/runner/Movies/DEF-456 owner-movie.mp4': items + r'\8-b.json'},
            'scan_checkpoints': {r'local:c:\users\runner\videos': {'directories': 3},
                                 r'local:d:\owner-library': {'directories': 5}}}), encoding='utf-8')
        (state / 'library-processing-1.issues.jsonl').write_text(json.dumps({
            'asset_id': 9, 'path': r"D:\owner's]\owner-movie.mp4", 'message': 'probe failed'}) + '\n',
            encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(config=config))) as archive:
            exported = json.loads(archive.read('processing/library-processing.json'))
            issue = json.loads(archive.read('processing/library-processing-1.issues.jsonl'))
            contents = '\n'.join(archive.read(name).decode() for name in archive.namelist())
        self.assertEqual(exported['local_metadata'], {'7:<path>': '<path>', '8:<path>': '<path>'})
        self.assertEqual(sorted(exported['scan_checkpoints']), ['local:<path>', 'local:<path>#2'])
        self.assertEqual(sorted(row['directories'] for row in exported['scan_checkpoints'].values()), [3, 5])
        self.assertEqual((issue['asset_id'], issue['path']), (9, '<path>'))
        for private in ('runner', 'owner', '.mp4'):
            self.assertNotIn(private, contents)

    def test_processing_export_omits_partial_rows_and_limits_large_files(self):
        from peach.settings_file import PeachConfig
        config = PeachConfig(self.root, self.root / 'config.toml', present=True)
        state = config.directory('state')
        state.mkdir(parents=True)
        path = state / 'library-processing-large.issues.jsonl'
        row = json.dumps({'asset_id': 23, 'message': 'error' * 100}) + '\n'
        path.write_text(row * 400 + '{"partial":', encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(config=config))) as archive:
            text = archive.read('processing/' + path.name).decode()
            report = json.loads(archive.read('report.json'))
        self.assertLessEqual(len(text.encode()), support_bundle.TAIL_BYTES)
        self.assertTrue(text.splitlines())
        self.assertTrue(all(json.loads(line)['asset_id'] == 23 for line in text.splitlines()))
        self.assertTrue(next(row for row in report['logs'] if row['name'] == path.name)['truncated'])

    def test_processing_export_reads_complete_large_json_and_keeps_task_evidence(self):
        state = self.root / 'state'
        state.mkdir()
        path = state / 'library-processing.json'
        payload = {'local_metadata': {str(index): r'D:\private\movie.mp4' for index in range(10000)},
                   'job_id': 'task-23', 'status': 'running', 'stage': 'previews', 'checked': 423,
                   'issue_count': 1, 'issue_preview': [{'asset_id': 23, 'title': 'private-movie',
                       'diagnostics': {'reason': 'timeout', 'stderr': 'token=private-token'}}]}
        path.write_text(json.dumps(payload, indent=2), encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            content = archive.read('processing/library-processing.json')
            exported = json.loads(content)
            report = json.loads(archive.read('report.json'))
        self.assertLessEqual(len(content), support_bundle.TAIL_BYTES)
        self.assertEqual((exported['job_id'], exported['status'], exported['stage'], exported['checked']),
                         ('task-23', 'running', 'previews', 423))
        self.assertEqual(exported['issue_preview'][0]['diagnostics']['reason'], 'timeout')
        self.assertNotIn(b'private-', content)
        entry = next(row for row in report['logs'] if row['name'] == path.name)
        self.assertEqual(entry['status'], 'included')
        self.assertTrue(entry['truncated'])
        self.assertTrue(entry['projected'])
        self.assertEqual(entry['collection_counts']['local_metadata'], 10000)
        self.assertEqual(len(exported['local_metadata']), 20)

    def test_processing_export_keeps_large_compact_json_without_tail_loss(self):
        state = self.root / 'state'
        state.mkdir()
        (state / 'library-processing.json').write_text(json.dumps({
            'status': 'paused', 'local_metadata': {str(index): r'D:\private\movie.mp4'
                                                for index in range(5000)}}), encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            self.assertEqual(json.loads(archive.read('processing/library-processing.json'))['status'], 'paused')

    def test_processing_export_carries_interrupted_jobs_and_update_pause_markers(self):
        """恢复服务卡住时要看的两处：启动时接回的中断任务与更新暂停标记。"""
        state = self.root / 'state'
        (state / 'job-recovery').mkdir(parents=True)
        (state / 'update-tasks' / 'active').mkdir(parents=True)
        (state / 'job-recovery' / 'library-processing.json').write_text(json.dumps({
            'body': {'stage': 'all', 'asset_ids': [60, 952]}, 'path': r'D:\private\movie.mp4'}), encoding='utf-8')
        (state / 'update-tasks' / 'active' / 'abc.json').write_text('{"kind": "scan"}', encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            recovery = json.loads(archive.read('processing/job-recovery/library-processing.json'))
            self.assertEqual(recovery['body']['asset_ids'], [60, 952])
            self.assertEqual(recovery['path'], '<path>')
            self.assertEqual(json.loads(archive.read('processing/update-tasks/active/abc.json')), {'kind': 'scan'})

    def test_processing_export_reports_invalid_empty_and_over_limit_json_without_empty_members(self):
        state = self.root / 'state'
        state.mkdir()
        for name, content in [('library-processing.json', '{"status":'),
                              ('runtime-prepare.json', ''), ('standalone-update.json', 'x' * 200)]:
            (state / name).write_text(content, encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                mock.patch.object(support_bundle, 'JSON_READ_BYTES', 100), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            report = json.loads(archive.read('report.json'))
            entries = {row['name']: row for row in report['logs']}
            self.assertEqual(entries['library-processing.json']['status'], 'unreadable_json')
            self.assertEqual(entries['runtime-prepare.json']['status'], 'empty_json')
            self.assertEqual(entries['standalone-update.json']['status'], 'json_size_limit')
            self.assertFalse(any(name.startswith('processing/') for name in archive.namelist()))

    def test_processing_jsonl_export_keeps_record_at_exact_tail_boundary(self):
        state = self.root / 'state'
        state.mkdir()
        first = json.dumps({'asset_id': 1}) + '\n'
        last = json.dumps({'asset_id': 2}) + '\n'
        path = state / 'library-processing-boundary.issues.jsonl'
        path.write_bytes((first + last).encode('utf-8'))
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                mock.patch.object(support_bundle, 'TAIL_BYTES', len(last.encode())), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            self.assertEqual(json.loads(archive.read('processing/' + path.name))['asset_id'], 2)

    def test_processing_json_export_bounds_reads_and_rejects_scalar_or_deep_documents(self):
        stream = io.BytesIO(b' ' * 1000)
        with mock.patch.object(support_bundle, 'JSON_READ_BYTES', 100):
            content, details = support_bundle._structured_json(stream)
        self.assertEqual((content, details['status'], stream.tell()), ('', 'json_size_limit', 101))
        for raw, expected in [(b'false', 'invalid_json_shape'), (b'{"status":"\xff"}', 'unreadable_json'),
                              (b'[' * 2000 + b']' * 2000, 'json_depth_limit')]:
            with self.subTest(expected=expected):
                content, details = support_bundle._structured_json(io.BytesIO(raw))
                self.assertEqual((content, details['status']), ('', expected))

    def test_processing_jsonl_export_reports_skipped_records_and_bounds_redacted_output(self):
        state = self.root / 'state'
        state.mkdir()
        path = state / 'library-processing-rows.issues.jsonl'
        rows = [json.dumps({'asset_id': index, 'token': 'x'}) for index in range(1, 4)]
        path.write_text('\n'.join([*rows, '{"partial":']), encoding='utf-8')
        limit = path.stat().st_size
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                mock.patch.object(support_bundle, 'TAIL_BYTES', limit), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            content = archive.read('processing/' + path.name)
            records = [json.loads(line) for line in content.splitlines()]
            entry = next(row for row in json.loads(archive.read('report.json'))['logs'] if row['name'] == path.name)
        self.assertLessEqual(len(content), limit)
        self.assertEqual([row['asset_id'] for row in records], [2, 3])
        self.assertEqual(entry['skipped_records'], 2)
        self.assertEqual(entry['status'], 'included')
        self.assertTrue(entry['truncated'])

    def test_processing_jsonl_export_omits_members_without_complete_records(self):
        state = self.root / 'state'
        state.mkdir()
        (state / 'library-processing-empty.issues.jsonl').write_bytes(b'')
        (state / 'library-processing-invalid.issues.jsonl').write_bytes(b'{"partial":')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            entries = {row['name']: row for row in json.loads(archive.read('report.json'))['logs']}
            self.assertFalse(any(name.startswith('processing/') for name in archive.namelist()))
        self.assertEqual(entries['library-processing-empty.issues.jsonl']['status'], 'empty_jsonl')
        self.assertEqual(entries['library-processing-invalid.issues.jsonl']['status'], 'no_complete_records')

    def test_support_bundle_contains_local_delivery_receipts_without_research_payloads(self):
        from peach.settings_file import PeachConfig
        config = PeachConfig(self.root, self.root / 'config.toml', present=True)
        state = config.directory('state')
        state.mkdir(parents=True)
        (state / 'remote-reporting-delivery.json').write_text(json.dumps({'errors': {'status': 'accepted', 'status_code': 200}}))
        (state / 'library-sharing-attempt.json').write_text(json.dumps({'status': 'unknown', 'attempted': True}))
        (state / 'remote-reporting-frequency.json').write_text('private-technical-sample')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(config=config))) as archive:
            self.assertEqual(json.loads(archive.read('processing/remote-reporting-delivery.json'))['errors']['status'], 'accepted')
            self.assertEqual(json.loads(archive.read('processing/library-sharing-attempt.json'))['status'], 'unknown')
            self.assertNotIn('processing/remote-reporting-frequency.json', archive.namelist())

    def test_support_bundle_contains_recent_cover_attempts_and_discovery_job(self):
        from peach.settings_file import PeachConfig
        config = PeachConfig(self.root, self.root / 'config.toml', present=True)
        attempts = config.directory('generated') / 'feed-cover-attempts'
        attempts.mkdir(parents=True)
        for index in range(3):
            path = attempts / f'ABC-00{index}.json'
            path.write_text(json.dumps({'code': f'ABC-00{index}', 'ok': False, 'error_type': 'Unavailable',
                                        'reason': '来源地址 返回 403'}), encoding='utf-8')
            os.utime(path, (100 + index, 100 + index))
        (attempts.parent / 'jav-discovery-metadata.job.json').write_text(json.dumps({
            'status': 'complete', 'total': 3, 'failed_codes': ['ABC-002']}), encoding='utf-8')
        (attempts.parent / 'jav-discovery-metadata.json').write_text('private-metadata-cache', encoding='utf-8')
        with mock.patch.object(error_reporting, 'log_directories', return_value=[]), \
                mock.patch.object(support_bundle, 'COVER_ATTEMPT_LIMIT', 2), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(config=config))) as archive:
            names = sorted(name for name in archive.namelist() if name.startswith('covers/'))
            self.assertEqual(names, ['covers/feed-cover-attempts/ABC-001.json', 'covers/feed-cover-attempts/ABC-002.json',
                                     'covers/jav-discovery-metadata.job.json'])
            self.assertEqual(json.loads(archive.read('covers/feed-cover-attempts/ABC-002.json'))['error_type'], 'Unavailable')
            self.assertEqual(json.loads(archive.read('covers/jav-discovery-metadata.job.json'))['failed_codes'], ['ABC-002'])

    def test_bundle_contains_update_tunnel_rotated_and_startup_evidence_with_invalid_config(self):
        from peach import settings_file
        self.logs.mkdir()
        for name in ('tray-restart.out.log', 'tray-scan.out.log', 'windows-source-sync.log',
                     'cloudflare-tunnel.log', 'tray.until-20261001.log'):
            (self.logs / name).write_text('failure --token private-cli-token\n', encoding='utf-8')
        state = self.root / 'state'
        state.mkdir()
        (state / 'runtime-prepare.json').write_text(json.dumps({
            'ok': False, 'steps': [{'name': 'dependencies', 'message': 'failed --password private-password'}]},
            indent=2), encoding='utf-8')
        migration = state / 'update-backups' / 'fixture' / 'migration.log'
        migration.parent.mkdir(parents=True)
        migration.write_text('migration failed\n', encoding='utf-8')
        with mock.patch.object(settings_file, 'load_config', side_effect=ValueError('invalid config')), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            names = archive.namelist()
            self.assertTrue(any('tray.until-' in name for name in names))
            for name in ('tray-restart.out.log', 'tray-scan.out.log', 'windows-source-sync.log', 'cloudflare-tunnel.log'):
                self.assertTrue(any(item.endswith('/' + name) for item in names), name)
            startup = json.loads(archive.read('processing/runtime-prepare.json'))
            self.assertFalse(startup['ok'])
            self.assertIn('updates/update-backups/fixture/migration.log', names)
            contents = '\n'.join(archive.read(name).decode() for name in names)
        for private in ('private-cli-token', 'private-password'):
            self.assertNotIn(private, contents)

    def test_one_unreadable_error_log_does_not_hide_other_logs(self):
        self.logs.mkdir()
        (self.logs / 'tray.log').write_text('service failed\n', encoding='utf-8')
        (self.logs / 'errors-unreadable.log').write_text('error', encoding='utf-8')
        original = Path.stat
        def stat(path, *args, **kwargs):
            if path.name == 'errors-unreadable.log':
                raise PermissionError('not readable')
            return original(path, *args, **kwargs)
        with mock.patch.object(Path, 'stat', stat), \
                zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            self.assertTrue(any(name.endswith('/tray.log') for name in archive.namelist()))
            report = json.loads(archive.read('report.json'))
        self.assertTrue(any(row['name'] == 'errors-unreadable.log' and row['status'] == 'PermissionError'
                            for row in report['logs']))

    def records(self):
        return [json.loads(line) for path in self.logs.glob("errors-*.log")
                for line in path.read_text(encoding="utf-8").splitlines()]

    def test_local_context_is_bounded_exported_and_never_sent_remotely(self):
        from peach import diagnostic_context, remote_reporting
        from peach.settings_file import PeachConfig
        context = {'user_agent': 'Chrome/150', 'platform': 'Win32', 'native_codecs': {'h264': '', 'hevc': 'probably'},
                   'cookie': 'private-cookie', 'viewport_width': 2 ** 10000, 'connection': {'downlink_mbps': float('inf')}}
        browser = diagnostic_context.browser(context)
        self.assertNotIn('viewport_width', browser)
        self.assertNotIn('cookie', browser)
        media = diagnostic_context.playback({'code': 4, 'ready_state': 0, 'network_state': 3,
            'source_route': '/stream?token=private-token', 'src': 'https://private.example/movie.mp4',
            'recent_requests': [{'route': '/stream', 'status': 206, 'duration_ms': 20},
                                {'route': '/private/movie.mp4', 'status': 403}],
            'buffered_ranges': [[0, 2], [0, float('nan')]]})
        self.assertNotIn('source_route', media)
        self.assertEqual(media['buffered_ranges'], [[0, 2]])
        self.assertEqual(media['recent_requests'], [{'status': 206, 'duration_ms': 20, 'route': '/stream'}])
        with mock.patch.object(remote_reporting, 'capture') as capture:
            for index in range(25):
                error_reporting.local_event('browser', browser=browser, playback=media, sequence=index)
            payload = support_bundle.bundle_bytes(config=PeachConfig(self.root, self.root / 'config.toml'))
        capture.assert_not_called()
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            report = json.loads(archive.read('report.json'))
            exported = '\n'.join(archive.read(name).decode() for name in archive.namelist())
        self.assertEqual(len(report['recent_browsers']), 8)
        self.assertEqual(len(report['recent_playback']), 20)
        self.assertEqual(report['recent_playback'][-1]['code'], 4)
        self.assertEqual(report['recent_browsers'][-1]['native_codecs']['h264'], '')
        self.assertIn('starlette', report['runtime']['packages'])
        self.assertNotEqual(report['runtime']['packages']['opencv-python-headless'], '<ip>')
        self.assertEqual(report['browser']['status'], 'unavailable')
        for private in ('private-cookie', 'private-token', 'private.example', 'movie.mp4'):
            self.assertNotIn(private, exported)

    def test_origin_evidence_and_windows_browsing_reach_the_exported_report(self):
        """来源检查对不上的形态与系统代理、默认浏览器进 report.json；代理地址不出现。"""
        from peach import diagnostic_context
        from peach.settings_file import PeachConfig
        registry = {'ProxyEnable': 1, 'ProxyServer': '127.0.0.1:7897', 'ProxyOverride': 'localhost;<local>',
                    'AutoConfigURL': None, 'AutoDetect': 0, 'ProgId': '360SE6.HTML'}
        with mock.patch.object(diagnostic_context.os, 'name', 'nt'), \
                mock.patch.object(diagnostic_context, '_registry_values',
                                  lambda path, names: {name: registry[name] for name in names}):
            browsing = diagnostic_context.windows_browsing()
        self.assertEqual(browsing['default_browser'], '360SE6.HTML')
        self.assertEqual(browsing['system_proxy'], {'enabled': True, 'server_configured': True, 'auto_config': False,
                                                    'auto_detect': False, 'bypass_local': True, 'bypass_loopback': True})
        self.assertNotIn('7897', json.dumps(browsing))
        with mock.patch.object(diagnostic_context, '_registry_values', side_effect=PermissionError), \
                mock.patch.object(diagnostic_context.os, 'name', 'nt'):
            self.assertEqual(diagnostic_context.windows_browsing()['system_proxy'],
                             {'status': 'unavailable', 'reason': 'PermissionError'})
        error_reporting.local_event('origin-mismatch', guard='setup', accepted=False, origin_class='null',
                                    origin={}, server={'scheme': 'http', 'host_kind': 'loopback', 'port': 8900},
                                    fetch_site='absent', user_agent='UnitBrowser/1', unrelated='dropped')
        payload = support_bundle.bundle_bytes(config=PeachConfig(self.root, self.root / 'config.toml'))
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            report = json.loads(archive.read('report.json'))
        [row] = report['recent_origin_mismatches']
        self.assertEqual((row['guard'], row['accepted'], row['origin_class'], row['user_agent']),
                         ('setup', False, 'null', 'UnitBrowser/1'))
        self.assertNotIn('unrelated', row)
        self.assertIn('windows_browsing', report['runtime'])

    def test_browser_header_handles_unicode_invalid_encoding_and_unknown_fields(self):
        import base64
        from peach.diagnostic_context import browser_header
        value = base64.b64encode(json.dumps({'platform': '测试平台', 'native_codecs': {'h264': 'maybe'},
                                           'password': 'private-password'}, ensure_ascii=False).encode()).decode()
        self.assertEqual(browser_header(value, user_agent='actual-agent')['platform'], '测试平台')
        self.assertEqual(browser_header(value, user_agent='actual-agent')['user_agent'], 'actual-agent')
        self.assertNotIn('password', browser_header(value))
        for raw in ('not-base64', 'x' * 12001, base64.b64encode(b'not-json').decode()):
            self.assertEqual(browser_header(raw)['status'], 'unavailable')

    def test_tool_error_category_survives_path_redaction_and_stays_local(self):
        from peach import remote_reporting
        with mock.patch.object(remote_reporting, 'capture') as capture:
            error_reporting.subprocess_failure('media-probe', tool='ffprobe', returncode=1,
                stderr=b'C:\\private\\movie.mp4: No such file or directory\n')
        row = self.records()[-1]
        self.assertEqual(row['reason_code'], 'missing_media')
        self.assertNotIn('movie.mp4', str(row))
        self.assertNotIn('reason_code', capture.call_args.kwargs)

    def test_context_snapshots_are_deduplicated_without_spending_the_error_budget(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from types import SimpleNamespace
        from peach import routes_configuration, remote_reporting
        app = FastAPI()
        app.include_router(routes_configuration.router)
        app.state.settings = SimpleNamespace(mdns_name='peach', token='', access_path=self.root / 'access.json')
        client = TestClient(app, base_url='http://127.0.0.1', client=('127.0.0.1', 1234))
        path = '/api/diagnostics/client-error'
        with mock.patch.object(remote_reporting, 'capture') as capture:
            replies = [client.post(path, json={'kind': 'context', 'message': 'environment',
                'browser': {'viewport_width': 1280}}) for _ in range(30)]
        self.assertTrue(all(reply.status_code == 200 for reply in replies))
        self.assertEqual(sum(reply.json()['recorded'] for reply in replies), 1)
        self.assertEqual(len(self.records()), 1)
        capture.assert_not_called()
        for index in range(20):
            self.assertEqual(client.post(path, json={'message': f'failure {index}'}).status_code, 200)
        self.assertEqual(client.post(path, json={'message': 'another failure'}).status_code, 429)

    def test_uncaught_import_and_thread_failures_are_saved_without_a_console(self):
        result = self.probe("import sys, threading; from peach import error_reporting as e; "
                            "e.install(); sys.stderr=None; "
                            "t=threading.Thread(target=lambda: 1/0, name='worker'); t.start(); t.join(); "
                            "import peach_missing_startup_dependency")
        self.assertNotEqual(result.returncode, 0)
        events = self.records()
        stages = {row["stage"] for row in events}
        self.assertTrue({"entry", "unhandled-main", "unhandled-thread"} <= stages)
        failure = next(row for row in events if row["stage"] == "unhandled-main")
        self.assertEqual(failure["exception"][0]["type"], "ModuleNotFoundError")
        self.assertTrue(failure["frames"])

    def test_native_traceback_handler_is_enabled_and_writes_to_a_file(self):
        result = self.probe("import faulthandler; from peach import error_reporting as e; "
                            "e.install(); assert faulthandler.is_enabled(); "
                            "faulthandler.dump_traceback(file=e._fault_stream)")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any('line' in path.read_text(encoding="utf-8") for path in self.logs.glob("crash-*.log")))

    def test_a_process_that_exits_cleanly_leaves_no_empty_logs_behind(self):
        result = self.probe("from peach import error_reporting as e; e.install()")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sorted(path.name for path in self.logs.glob("*-*.log")), [])

    def test_a_process_that_logged_a_problem_keeps_its_event_log(self):
        result = self.probe("import logging; from peach import error_reporting as e; e.install(); "
                            "logging.getLogger('probe').warning('磁盘读不到')")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(list(self.logs.glob("errors-*.log"))), 1)
        self.assertEqual(list(self.logs.glob("crash-*.log")), [])

    def test_exception_records_keep_codes_and_frames_without_source_lines_or_credentials(self):
        try:
            raise OSError(5, 'password=private-password https://example.com/?token=private-token')
        except OSError as error:
            error.peach_operation = "OpenProcess(desktop)"
            path = error_reporting.event("tray-handoff", error)
        row = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(row["exception"][0]["errno"], 5)
        self.assertEqual(row["exception"][0]["operation"], "OpenProcess(desktop)")
        self.assertTrue(row["frames"])
        self.assertNotIn("private-password", path.read_text(encoding="utf-8"))
        self.assertNotIn("private-token", path.read_text(encoding="utf-8"))

    def test_unwritable_log_directory_uses_the_temporary_fallback(self):
        blocked = self.root / "blocked"
        blocked.write_text("file", encoding="utf-8")
        fallback = self.root / "fallback"
        with mock.patch.object(error_reporting, "log_directories", return_value=[blocked / "logs", fallback]):
            path = error_reporting.event("entry")
        self.assertEqual(path.parent, fallback)
        self.assertTrue(path.is_file())

    def test_shared_job_failure_context_is_preserved_in_the_redacted_report(self):
        error = OSError("desktop process creation denied")
        error.peach_operation = "CreateProcessW(breakaway)"
        error.peach_context = {
            "caller": {"pid": 123, "in_job": True, "immediate_limit_flags": "0x2000",
                       "immediate_limit_names": ["KILL_ON_JOB_CLOSE"]},
            "desktop": {"pid": 456, "in_job": True},
            "job_chain": {"status": "unavailable"}, "token": "private-job-token"}
        error_reporting.event("tray-handoff", error)
        with zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            name = next(name for name in archive.namelist() if 'errors-' in name)
            payload = archive.read(name).decode()
        context = json.loads(payload)["exception"][0]["context"]
        self.assertEqual(context["caller"], error.peach_context["caller"])
        self.assertEqual(context["desktop"], {"pid": 456, "in_job": True})
        self.assertEqual(context["job_chain"]["status"], "unavailable")
        self.assertNotIn("private-job-token", payload)

    def test_bundle_is_available_with_corrupt_configuration_and_excludes_private_files(self):
        (self.root / "config.toml").write_text('secret = "unclosed-private-config', encoding="utf-8")
        (self.root / "ledger.db").write_text("private-database", encoding="utf-8")
        self.logs.mkdir()
        (self.logs / "tray.log").write_text(
            'Cookie: session=private-session; other=private-cookie\n'
            'Authorization: Bearer private-auth\n'
            'password=private-password\n'
            'https://private.example/download?key=private-key\n'
            'C:\\Users\\private-user\\private.mp4\n'
            '/example/private-user/movie.mp4\n203.0.113.20\n'
            'user@private.example\n', encoding="utf-8")
        (self.logs / "unapproved.log").write_text("private-unapproved", encoding="utf-8")
        error_reporting.event("entry")
        with zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            report = json.loads(archive.read("report.json"))
            contents = "\n".join(archive.read(name).decode() for name in archive.namelist())
            self.assertEqual(report["configuration"]["status"], "unavailable")
            self.assertTrue(all(name == "report.json" or name.startswith("logs/") for name in archive.namelist()))
            self.assertNotIn("unapproved.log", " ".join(archive.namelist()))
        for secret in ("private-session", "private-cookie", "private-auth", "private-password", "private-key",
                       "private.example", "private-user", "203.0.113.20", "private-database", "unclosed-private-config"):
            self.assertNotIn(secret, contents)

    def test_report_tail_is_bounded_and_records_the_truncation(self):
        self.logs.mkdir()
        (self.logs / "tray.log").write_bytes(b"discard-this\n" * 20_000 + b"final-error\n")
        with zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            name = next(name for name in archive.namelist() if name.endswith("tray.log"))
            self.assertLessEqual(len(archive.read(name)), support_bundle.TAIL_BYTES)
            self.assertIn(b"final-error", archive.read(name))
            report = json.loads(archive.read("report.json"))
            self.assertTrue(next(row for row in report["logs"] if row["name"] == "tray.log")["truncated"])

    def test_prefixed_cookie_headers_and_arbitrary_absolute_paths_are_redacted(self):
        self.logs.mkdir()
        (self.logs / "tray.log").write_text(
            '2026-10-15 ERROR Cookie: SEID=private-a; CID=private-b; UID=private-c\n'
            '/data/private-user/movie.mp4\n/srv/private-user/movie.mp4\n', encoding="utf-8")
        with zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            content = "\n".join(archive.read(name).decode() for name in archive.namelist())
        for secret in ("private-a", "private-b", "private-c", "private-user"):
            self.assertNotIn(secret, content)

    def test_warning_logs_keep_their_console_output_and_persistent_record(self):
        result = self.probe("import logging; from peach import error_reporting as e; "
                            "e.install(); logging.warning('warning example')")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("warning example", result.stderr)
        self.assertTrue(any(row.get("level") == "WARNING" for row in self.records()))

    def test_an_unusable_temporary_directory_does_not_disable_the_data_log_directory(self):
        with mock.patch.object(error_reporting.tempfile, "gettempdir", side_effect=FileNotFoundError("No usable temporary directory")):
            path = error_reporting.event("entry")
            report = support_bundle.save_bundle()
        self.assertEqual(path.parent, self.logs)
        self.assertTrue(zipfile.is_zipfile(report))

    def test_structured_log_export_preserves_frames_and_redacts_secret_fields(self):
        self.logs.mkdir()
        row = {"stage": "logging", "message": "Cookie: SEID=private-cookie; CID=private-cid",
               "exception": [{"type": "OSError", "winerror": 5}],
               "frames": [{"file": "tray.py", "line": 5}], "token": "private-token"}
        (self.logs / "errors-123.log").write_text(json.dumps(row) + "\n", encoding="utf-8")
        with zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            name = next(name for name in archive.namelist() if name.endswith("errors-123.log"))
            content = archive.read(name).decode()
            exported = json.loads(content)
        self.assertEqual(exported["frames"], row["frames"])
        self.assertEqual(exported["exception"][0]["winerror"], 5)
        for secret in ("private-cookie", "private-cid", "private-token"):
            self.assertNotIn(secret, content)

    def test_follow_media_report_keeps_source_context_and_redacts_upstream_details(self):
        from types import SimpleNamespace
        from peach.follow_stream import FollowProxyError
        from peach.routes_media import _report_follow_media_failure

        item = SimpleNamespace(provider="fanbox", source_id=3, id=7,
                               metadata={"media_items": [{"resource_provider": "gofile"}]})
        try:
            raise FollowProxyError(
                "upstream https://media.gofile.io/private-file?token=private-token "
                "Cookie: private-cookie", status_code=403)
        except FollowProxyError as error:
            _report_follow_media_failure(item, error, operation="stream", phase="upstream",
                                         media_index=0)
        with zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes())) as archive:
            payload = "\n".join(archive.read(name).decode() for name in archive.namelist()
                                if "errors-" in name and name.endswith(".log"))
        row = next(json.loads(line) for line in payload.splitlines()
                   if json.loads(line).get("stage") == "follow-media")
        self.assertEqual({key: row[key] for key in (
            "provider", "source_id", "item_id", "resource_provider", "operation", "phase",
            "media_index", "upstream_status")}, {
                "provider": "fanbox", "source_id": 3, "item_id": 7, "resource_provider": "gofile",
                "operation": "stream", "phase": "upstream", "media_index": 0, "upstream_status": 403})
        self.assertEqual(row["exception"][0]["type"], "FollowProxyError")
        self.assertTrue(row["frames"])
        for secret in ("private-file", "private-token", "private-cookie", "media.gofile.io"):
            self.assertNotIn(secret, payload)

    def test_follow_media_report_handles_invalid_media_without_masking_the_failure(self):
        from types import SimpleNamespace
        from peach.routes_media import _report_follow_media_failure

        item = SimpleNamespace(provider="kemono", source_id=4, id=8,
                               metadata={"media_items": [None, {"resource_provider": "private-name"}]})
        for index, expected in ((0, "kemono"), (1, "unknown")):
            with self.subTest(index=index):
                with mock.patch.object(error_reporting, "event") as emit:
                    _report_follow_media_failure(item, ValueError("unexpected media entry shape"),
                                                 operation="stream", phase="resolve", media_index=index)
                self.assertEqual(emit.call_args.kwargs["resource_provider"], expected)
        del item.source_id
        with mock.patch.object(error_reporting, "event") as emit:
            _report_follow_media_failure(item, ValueError("image source unavailable"),
                                         operation="image", phase="resolve")
        self.assertIsNone(emit.call_args.kwargs["source_id"])

    def test_failure_dialog_points_to_an_existing_report_and_cli_needs_no_service(self):
        message = error_reporting.failure_details("tray-handoff", OSError("desktop unavailable"))
        self.assertIn("诊断报告", message)
        self.assertEqual(len(list(self.logs.glob("peach-support-*.zip"))), 1)
        destination = self.root / "share.zip"
        result = self.probe(f"from peach.support_bundle import main; raise SystemExit(main([{str(destination)!r}]))")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(zipfile.is_zipfile(destination))
        again = self.probe(f"from peach.support_bundle import main; raise SystemExit(main([{str(destination)!r}]))")
        self.assertNotEqual(again.returncode, 0)

    def test_browser_errors_require_same_origin_and_remote_login_while_export_is_local(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from types import SimpleNamespace
        from peach import routes_configuration
        from peach.routes_auth import require_auth
        app = FastAPI()
        app.include_router(routes_configuration.router)
        app.dependency_overrides[require_auth] = lambda: {}
        app.state.settings = SimpleNamespace(mdns_name="peach", token='', access_path=self.root / 'access.json')
        app.state.mount_reachability = SimpleNamespace(summary=lambda: {})
        client = TestClient(app, base_url="http://127.0.0.1", client=("127.0.0.1", 1234))
        path = "/api/diagnostics/client-error"
        self.assertEqual(client.post(path, json={"message": "secret=private-browser"},
                                     headers={"Origin": "https://other.example"}).status_code, 403)
        self.assertEqual(client.post(path, content=b"x" * 20_000).status_code, 413)
        self.assertEqual(client.post(path, json={"message": 5}).status_code, 400)
        self.assertEqual(client.post(path, json={"message": "secret=private-browser", "stack": "at render",
                                               'source_file': 'app-abcd.js', 'line': 21, 'column': 8}).status_code, 200)
        browser = next(row for row in self.records() if row["stage"] == "browser")
        self.assertNotIn("private-browser", str(browser))
        self.assertEqual(browser["stack"], "at render")
        self.assertEqual(browser['line'], 21)
        self.assertEqual(browser['source_file'], 'app-abcd.js')
        from peach import remote_reporting
        with mock.patch.object(remote_reporting, 'send') as send:
            response = client.post(path, json={'message': 'request cancelled', 'error_name': 'AbortError',
                                               'stack': 'at peach-app.js:12:34'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row for row in self.records() if row['stage'] == 'browser'][-1]['error_name'], 'AbortError')
        send.assert_not_called()
        with mock.patch.object(remote_reporting, 'capture') as capture:
            response = client.post(path, json={'kind': 'media', 'message': 'media error',
                'browser': {'native_codecs': {'h264': ''}}, 'playback': {'code': 4, 'network_state': 3,
                    'src': 'https://private.example/clip.mp4?token=private-token'}},
                headers={'User-Agent': 'Chrome/150'})
            self.assertEqual(response.status_code, 200)
            response = client.post(path, json={'kind': 'context', 'message': 'browser context',
                                               'browser': {'platform': 'Win32'}})
            self.assertEqual(response.status_code, 200)
        capture.assert_not_called()
        media = [row for row in self.records() if 'playback' in row][-1]
        self.assertEqual(media['browser']['user_agent'], 'Chrome/150')
        self.assertEqual(media['playback']['code'], 4)
        self.assertNotIn('private.example', str(media))
        import base64
        snapshot = base64.b64encode(json.dumps({'native_codecs': {'h264': 'probably'},
            'client_hints': {'fullVersionList': [{'brand': 'Chrome', 'version': '150.0.1.2'}],
                             'cookie': 'private-cookie'}}).encode()).decode()
        with mock.patch("peach.diagnostics.report", side_effect=RuntimeError("diagnostics unavailable")):
            response = client.get("/api/diagnostics/bundle", headers={'X-Peach-Browser-Diagnostics': snapshot})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertTrue(zipfile.is_zipfile(io.BytesIO(response.content)))
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            exported = json.loads(archive.read('report.json'))
        self.assertEqual(exported['browser']['native_codecs']['h264'], 'probably')
        self.assertEqual(exported['browser']['client_hints']['fullVersionList'][0]['version'], 'v150.0.1.2')
        self.assertNotIn('private-cookie', str(exported))
        remote = TestClient(app, base_url="http://127.0.0.1", client=("192.0.2.55", 1234))
        self.assertEqual(remote.post(path, json={"message": "example"}).status_code, 401)
        from peach import access
        empty_policy = access.load(app.state.settings.access_path)
        empty_policy['key'] = ''
        remote.cookies.set(access.COOKIE, access.issue(empty_policy, 1)[0])
        self.assertEqual(remote.post(path, json={'message': 'anonymous'}).status_code, 401)
        policy = access.save(app.state.settings.access_path, 'valid-private-password')
        sessions = access.Sessions(access.sessions_path(app.state.settings.access_path))
        remote.cookies.set(access.COOKIE, access.issue(policy, 1, sessions)[0])
        self.assertEqual(remote.post(path, json={'message': 'phone failed'}).status_code, 200)
        self.assertEqual(remote.post(path, json={'message': 'phone failed'},
                                     headers={'Origin': 'https://other.example'}).status_code, 403)
        remote.cookies.clear()
        self.assertEqual(remote.post(path, json={'message': 'anonymous'}).status_code, 401)
        self.assertEqual(remote.get("/api/diagnostics/bundle").status_code, 403)
        for _ in range(20):
            response = client.post(path, json={"message": "example"})
        self.assertEqual(response.status_code, 429)

    def test_background_failure_has_a_persistent_traceback_and_job_identifier(self):
        from peach.jobs import BackgroundJob
        job = BackgroundJob('test-diagnostic-job')
        def fail(_job_id):
            raise ValueError('failed --token private-cli-token')
        state = job.start(fail)
        job.thread.join(3)
        self.assertFalse(job.thread.is_alive())
        event = next(row for row in self.records() if row['stage'] == 'background-job')
        self.assertEqual(event['job_id'], state['job_id'])
        self.assertEqual(event['exception'][0]['type'], 'ValueError')
        self.assertTrue(event['frames'])
        self.assertNotIn('private-cli-token', str(event))
        job.start_result(lambda: {'ok': False, 'error': 'expired --token private-result-token'})
        job.thread.join(3)
        result = next(row for row in self.records() if row['stage'] == 'background-result')
        self.assertIn('expired', result['message'])
        self.assertNotIn('private-result-token', str(result))

    def test_export_keeps_safe_source_health_without_source_response_content(self):
        source = {'source': 'javdb', 'status': 'warning', 'reason': '来源正在冷却',
                  'cooldown_until': '2026-10-18T01:00:00Z', 'raw': 'private-source-response',
                  'url': 'https://private.example/?token=private-token'}
        with zipfile.ZipFile(io.BytesIO(support_bundle.bundle_bytes(report={'sources': [source]}))) as archive:
            report = json.loads(archive.read('report.json'))
        self.assertEqual(report['sources'][0]['status'], 'warning')
        self.assertEqual(report['sources'][0]['cooldown_until'], source['cooldown_until'])
        self.assertNotIn('private-source-response', str(report))

    def test_probe_error_preserves_exit_code_and_stderr(self):
        from peach import media_probe
        result = subprocess.CompletedProcess(['ffprobe'], 69, b'{}', b'AV1 decoder unavailable')
        with mock.patch.object(media_probe.subprocess, 'run', return_value=result), \
                mock.patch.object(media_probe, 'resolve_case_insensitive', str):
            measured = media_probe.measure('ffprobe', 23, 'private.mp4')
        self.assertEqual(measured[0], -1)
        event = next(row for row in self.records() if row['stage'] == 'media-probe')
        self.assertEqual(event['asset_id'], 23)
        self.assertEqual(event['returncode'], 69)
        self.assertIn('AV1 decoder unavailable', event['stderr'])

    def test_command_line_credentials_are_redacted(self):
        for flag in ('--token', '--tunnel-token', '--api-key', '--access-key', '--password'):
            self.assertNotIn('private-value', error_reporting.redact(f'{flag} "private-value"'))

    def test_http_server_errors_are_correlated_without_request_contents(self):
        from fastapi import HTTPException
        from fastapi.testclient import TestClient
        from peach.api import create_app
        from peach.config import PeachSettings
        app = create_app(PeachSettings(db_path=self.root / 'database/ledger.db'))
        @app.get('/diagnostic-test/{identifier}')
        def fail(identifier: str):
            raise RuntimeError('request failed')
        @app.get('/diagnostic-handled-test')
        def handled():
            raise HTTPException(503, 'service unavailable')
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get('/diagnostic-test/private-identifier?token=private-query',
                              headers={'Authorization': 'Bearer private-auth'})
        self.assertEqual(response.status_code, 500)
        record = next(row for row in self.records() if row['stage'] == 'http-request')
        self.assertEqual(record['route'], 'diagnostic-test/{identifier}')
        self.assertEqual(record['error_id'], response.json()['error_id'])
        self.assertEqual(response.headers['x-peach-error-id'], record['error_id'])
        self.assertTrue(record['frames'])
        for value in ('private-identifier', 'private-query', 'private-auth'):
            self.assertNotIn(value, str(record))
        self.assertEqual(client.get('/diagnostic-handled-test').status_code, 503)
        self.assertEqual(len([row for row in self.records() if row['stage'] == 'http-request']), 2)
        client.get('/diagnostic-missing')
        self.assertEqual(len([row for row in self.records() if row['stage'] == 'http-request']), 2)

    def test_asyncio_exceptions_are_recorded_and_keep_the_default_handler(self):
        loop = mock.Mock()
        error_reporting.asyncio_handler(loop, {"exception": ValueError("async failure"), "message": "task"})
        self.assertEqual(self.records()[0]["stage"], "unhandled-asyncio")
        loop.default_exception_handler.assert_called_once()

    def asyncio_callback(self, error, *, module='asyncio.proactor_events',
                         name='_call_connection_lost', business=False, cleared=False,
                         recoverable=False, close_error=None, socket_override=None, server_override=None):
        namespace = {'__name__': module, 'failure': error}
        from asyncio.proactor_events import _ProactorBasePipeTransport
        namespace['Base'] = _ProactorBasePipeTransport if recoverable else object
        if business:
            exec(compile('def fail():\n    raise failure\n', 'peach/network_fixture.py', 'exec'), namespace)
        operation = 'fail()' if business else 'raise failure'
        if recoverable:
            operation = ('if self._called_connection_lost:\n            return\n'
                         '        self._protocol.connection_lost(None)\n        raise failure')
        exec(compile(f'class _ProactorBasePipeTransport(Base):\n    def {name}(self):\n        {operation}\n',
                     'asyncio/proactor_events.py', 'exec'), namespace)
        transport = object.__new__(namespace['_ProactorBasePipeTransport'])
        protocol_type = type('H11Protocol', (), {'__module__': 'uvicorn.protocols.http.h11_impl'})
        ssl_type = type('SSLProtocol', (), {'__module__': 'asyncio.sslproto'})
        transport._protocol = ssl_type()
        transport._protocol._app_protocol = None if cleared else protocol_type()
        transport._protocol.connection_lost = mock.Mock()
        if recoverable:
            transport._sock = socket_override if socket_override is not None else mock.Mock()
            if socket_override is None:
                transport._sock.close.side_effect = close_error
            transport._server = server_override if server_override is not None else mock.Mock()
            if server_override is not None:
                transport._server._attach(transport)
            transport._closing = True
            transport._called_connection_lost = False
            self.addCleanup(lambda: setattr(transport, '_sock', None))
        transport.private_url = 'https://private.example/?token=private-token'
        transport.private_path = 'D:/private/movie.mp4'
        loop = mock.Mock()
        loop.get_debug.return_value = False
        loop.diagnostic_transport = transport
        if recoverable:
            loop.diagnostic_socket = transport._sock
            loop.diagnostic_server = transport._server
        loop.call_exception_handler.side_effect = lambda context: error_reporting.asyncio_handler(loop, context)
        asyncio.Handle(getattr(transport, name), (), loop)._run()
        return loop

    def test_connection_cleanup_completes_socket_close_and_server_detach_once(self):
        from peach import remote_reporting
        error = ConnectionResetError(10054, 'connection reset')
        error.winerror = 10054
        with mock.patch.object(remote_reporting, 'send') as send:
            loop = self.asyncio_callback(error, recoverable=True)
        transport = loop.diagnostic_transport
        self.assertIsNone(transport._sock)
        self.assertIsNone(transport._server)
        self.assertTrue(transport._called_connection_lost)
        self.assertTrue(self.records()[-1]['cleanup_recovered'])
        loop.diagnostic_socket.close.assert_called_once()
        loop.diagnostic_server._detach.assert_called_once_with(transport)
        self.assertEqual(transport._protocol.connection_lost.call_count, 1)
        asyncio.Handle(transport._call_connection_lost, (), loop)._run()
        self.assertEqual(len(self.records()), 1)
        self.assertEqual(transport._protocol.connection_lost.call_count, 1)
        loop.default_exception_handler.assert_not_called()
        send.assert_not_called()

    def test_socket_cleanup_failure_keeps_the_original_exception_and_reports(self):
        from peach import remote_reporting
        error = ConnectionResetError(10054, 'connection reset')
        error.winerror = 10054
        close_error = OSError(5, 'close failed')
        with mock.patch.object(remote_reporting, 'send') as send:
            loop = self.asyncio_callback(error, recoverable=True, close_error=close_error)
        send.assert_called_once()
        self.assertFalse(loop.diagnostic_transport._called_connection_lost)
        record = self.records()[-1]
        self.assertEqual(record['classification'], 'connection-cleanup-failed')
        self.assertFalse(record['cleanup_recovered'])
        self.assertIs(close_error.__cause__, error)
        loop.default_exception_handler.assert_called_once()

    def test_windows_asyncio_connection_cleanup_stays_local_with_safe_context(self):
        from peach import remote_reporting
        error = ConnectionResetError(10054, 'connection reset')
        error.winerror = 10054
        with mock.patch.object(remote_reporting, 'send') as send:
            loop = self.asyncio_callback(error)
        send.assert_not_called()
        record = self.records()[0]
        self.assertEqual(record['classification'], 'connection-cleanup')
        self.assertEqual(record['asyncio_callback'],
                         'asyncio.proactor_events._ProactorBasePipeTransport._call_connection_lost')
        self.assertEqual(record['asyncio_protocol'], 'uvicorn.protocols.http.h11_impl.H11Protocol')
        self.assertEqual(record['asyncio_connection_role'], 'http-server')
        self.assertTrue(record['asyncio_tls'])
        self.assertEqual(record['exception'][0]['winerror'], 10054)
        self.assertEqual(record['frames'][-1]['function'], '_call_connection_lost')
        for value in ('private.example', 'private-token', 'movie.mp4', 'private_url', 'private_path'):
            self.assertNotIn(value, json.dumps(record))
        loop.default_exception_handler.assert_called_once()

    def test_connection_cleanup_closes_real_socket_and_releases_asyncio_server(self):
        import socket
        from peach import remote_reporting

        async def run():
            server = await asyncio.get_running_loop().create_server(asyncio.Protocol, '127.0.0.1', 0)
            accepted, peer = socket.socketpair()
            try:
                error = ConnectionResetError(10054, 'connection reset')
                error.winerror = 10054
                with mock.patch.object(remote_reporting, 'send') as send:
                    loop = self.asyncio_callback(error, recoverable=True,
                        socket_override=accepted, server_override=server)
                self.assertEqual(accepted.fileno(), -1)
                self.assertEqual(len(server._clients), 0)
                loop.default_exception_handler.assert_not_called()
                send.assert_not_called()
            finally:
                accepted.close()
                peer.close()
                server.close()
                await asyncio.wait_for(server.wait_closed(), timeout=2)

        asyncio.run(run())

    def test_shutdown_rejected_during_connection_cleanup_is_the_same_cleanup(self):
        """对端先断开时，清理回调里的 `shutdown` 报 WinError 10022（普通 OSError），收尾照常完成。"""
        from peach import remote_reporting
        error = OSError(22, 'invalid argument')
        error.winerror = 10022
        with mock.patch.object(remote_reporting, 'send') as send:
            loop = self.asyncio_callback(error, recoverable=True)
        send.assert_not_called()
        record = self.records()[-1]
        self.assertEqual(record['classification'], 'connection-cleanup')
        self.assertTrue(record['cleanup_recovered'])
        self.assertIsNone(loop.diagnostic_transport._sock)
        loop.diagnostic_socket.close.assert_called_once()
        loop.default_exception_handler.assert_not_called()

    def accept_failure(self, error, **handler_options):
        """按标准库 `_start_serving` 的形状调处理器：监听套接字仍有效时先报告，随后它会关掉监听。"""
        import socket
        from asyncio import trsock
        from peach import remote_reporting
        listener = socket.create_server(('127.0.0.1', 0))
        self.addCleanup(listener.close)
        loop = mock.Mock()
        with mock.patch.object(remote_reporting, 'send') as send:
            error_reporting.asyncio_handler(loop, {'message': 'Accept failed on a socket', 'exception': error,
                                                   'socket': trsock.TransportSocket(listener)}, **handler_options)
        return loop, send

    def test_a_client_gone_before_accept_completes_is_recorded_locally_with_the_closed_listener(self):
        """WinError 64：客户端在 AcceptEx 完成前断开。处理器返回后标准库会关掉监听套接字，记录要写明。"""
        error = OSError(22, 'The specified network name is no longer available')
        error.winerror = 64
        loop, send = self.accept_failure(error)
        send.assert_not_called()
        loop.default_exception_handler.assert_not_called()
        record = self.records()[-1]
        self.assertEqual(record['stage'], 'unhandled-asyncio')
        self.assertEqual(record['classification'], 'accept-aborted')
        self.assertTrue(record['listener_closed'])
        self.assertEqual(record['exception'][0]['winerror'], 64)

    def test_other_accept_failures_keep_remote_evidence_and_the_default_handler(self):
        error = OSError(24, 'too many open files')
        error.winerror = 10024
        loop, send = self.accept_failure(error)
        send.assert_called_once()
        self.assertNotIn('classification', self.records()[-1])
        loop.default_exception_handler.assert_called_once()

    def test_other_accept_failures_do_not_listen_again_even_with_a_server_to_recover(self):
        error = OSError(24, 'too many open files')
        error.winerror = 10024
        uvicorn_server = mock.Mock()
        loop, send = self.accept_failure(error, uvicorn_server=uvicorn_server)
        send.assert_called_once()
        loop.default_exception_handler.assert_called_once()
        loop.create_task.assert_not_called()

    def test_an_aborted_accept_on_a_socket_the_server_does_not_own_is_only_recorded(self):
        error = OSError(22, 'The specified network name is no longer available')
        error.winerror = 64
        uvicorn_server = mock.Mock(servers=[])
        loop, send = self.accept_failure(error, uvicorn_server=uvicorn_server)
        send.assert_not_called()
        loop.create_task.assert_not_called()
        record = self.records()[-1]
        self.assertTrue(record['listener_closed'])
        self.assertFalse(record['listener_rearm'])

    def serve_with_accept_abort(self, *, bind_failure=None, dualstack=False):
        """起真 uvicorn，让下一次重新挂 accept 时抛 WinError 64，走标准库 `_start_serving` 原路径。"""
        import functools
        import socket
        import time
        import uvicorn
        from peach import remote_reporting

        async def app(scope, receive, send):
            await send({'type': 'http.response.start', 'status': 204, 'headers': []})
            await send({'type': 'http.response.body', 'body': b''})

        async def request(port, *, within=0.0):
            deadline = time.monotonic() + within
            while True:
                try:
                    reader, writer = await asyncio.open_connection('127.0.0.1', port)
                    break
                except ConnectionRefusedError:
                    if time.monotonic() >= deadline:
                        return None
                    await asyncio.sleep(0.05)
            writer.write(b'GET / HTTP/1.1\r\nHost: peach\r\nConnection: close\r\n\r\n')
            status = int((await asyncio.wait_for(reader.readline(), 5)).split()[1])
            writer.close()
            await writer.wait_closed()
            return status

        async def run():
            loop = asyncio.get_running_loop()
            server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=0, lifespan='off', log_config=None))
            loop.set_exception_handler(functools.partial(error_reporting.asyncio_handler, uvicorn_server=server))
            # 双栈监听（`listening.bind`）：IPv4 连接从 `::` 套接字进来，重新监听后也要照样能连。
            listener = socket.create_server(('::', 0), family=socket.AF_INET6, dualstack_ipv6=True)                 if dualstack else None
            serving = asyncio.create_task(server.serve(sockets=[listener] if listener else None))
            while not server.started:
                await asyncio.sleep(0.01)
            port = server.servers[0].sockets[0].getsockname()[1]
            accept = loop._proactor.accept

            def abort_once(sock):
                loop._proactor.accept = accept
                error = OSError(22, 'The specified network name is no longer available')
                error.winerror = 64
                raise error

            loop._proactor.accept = abort_once
            try:
                with mock.patch.object(remote_reporting, 'send') as send, \
                        mock.patch.object(socket, 'create_server', side_effect=bind_failure) \
                        if bind_failure else contextlib.nullcontext():
                    first = await request(port)
                    again = await request(port, within=5)
                    if bind_failure:
                        await asyncio.wait_for(serving, 10)
            finally:
                server.should_exit = True
                await asyncio.wait_for(serving, 10)
            return first, again, server, send

        return asyncio.run(run(), loop_factory=asyncio.ProactorEventLoop)

    @unittest.skipUnless(os.name == 'nt', 'Proactor 事件循环只在 Windows 上')
    def test_a_listener_closed_by_an_aborted_accept_accepts_connections_again(self):
        first, again, server, send = self.serve_with_accept_abort()
        self.assertEqual(first, 204)
        self.assertEqual(again, 204)
        self.assertEqual(len(server.servers), 2)
        send.assert_not_called()
        record = next(row for row in self.records() if row.get('classification') == 'accept-aborted')
        self.assertTrue(record['listener_closed'])
        self.assertTrue(record['listener_rearm'])

    @unittest.skipUnless(os.name == 'nt' and socket.has_dualstack_ipv6(), 'Proactor 事件循环只在 Windows 上，且要有双栈')
    def test_a_dual_stack_listener_still_accepts_ipv4_after_listening_again(self):
        first, again, server, send = self.serve_with_accept_abort(dualstack=True)
        self.assertEqual((first, again), (204, 204))
        self.assertEqual(len(server.servers), 2)
        send.assert_not_called()

    @unittest.skipUnless(os.name == 'nt', 'Proactor 事件循环只在 Windows 上')
    def test_a_listener_that_cannot_be_bound_again_stops_the_service_and_reports(self):
        first, again, server, send = self.serve_with_accept_abort(bind_failure=OSError(10048, 'address in use'))
        self.assertEqual(first, 204)
        self.assertIsNone(again)
        self.assertTrue(server.should_exit)
        send.assert_called_once()
        record = self.records()[-1]
        self.assertEqual(record['classification'], 'accept-listener-lost')

    def test_asyncio_tls_cleanup_keeps_protocol_class_after_application_detaches(self):
        from peach import remote_reporting
        error = ConnectionResetError(10054, 'connection reset')
        error.winerror = 10054
        with mock.patch.object(remote_reporting, 'send') as send:
            loop = self.asyncio_callback(error, cleared=True)
        send.assert_not_called()
        record = self.records()[-1]
        self.assertEqual(record['asyncio_protocol'], 'asyncio.sslproto.SSLProtocol')
        self.assertTrue(record['asyncio_tls'])
        self.assertNotIn('asyncio_connection_role', record)
        loop.default_exception_handler.assert_called_once()

    def test_asyncio_connection_faults_require_the_exact_cleanup_signature(self):
        from peach import remote_reporting
        cases = [
            ({}, 10053, ConnectionResetError),
            ({}, 10054, RuntimeError),
            ({'name': '_read_ready'}, 10054, ConnectionResetError),
            ({'module': 'peach.network_fixture'}, 10054, ConnectionResetError),
            ({'business': True}, 10054, ConnectionResetError),
        ]
        for options, code, error_type in cases:
            with self.subTest(options=options, code=code, error_type=error_type):
                error = error_type(code, 'network failure')
                error.winerror = code
                with mock.patch.object(remote_reporting, 'send') as send:
                    loop = self.asyncio_callback(error, **options)
                send.assert_called_once()
                self.assertNotIn('classification', self.records()[-1])
                loop.default_exception_handler.assert_called_once()

    def test_asyncio_cleanup_with_linked_failure_keeps_remote_evidence(self):
        from peach import remote_reporting
        for attribute in ('__cause__', '__context__'):
            with self.subTest(attribute=attribute):
                error = ConnectionResetError(10054, 'connection reset')
                error.winerror = 10054
                setattr(error, attribute, ValueError('linked failure'))
                with mock.patch.object(remote_reporting, 'send') as send:
                    self.asyncio_callback(error)
                send.assert_called_once()
                self.assertNotIn('classification', self.records()[-1])
                self.assertNotIn('asyncio_protocol', json.dumps(send.call_args.args[1]))

    def test_connection_reset_in_business_stage_is_reported_without_asyncio_metadata(self):
        from peach import remote_reporting
        error = ConnectionResetError(10054, 'business network failure')
        error.winerror = 10054
        with mock.patch.object(remote_reporting, 'send') as send:
            error_reporting.event('background-job', error)
        send.assert_called_once()
        self.assertEqual(send.call_args.args[1]['tags']['winerror'], '10054')

    def test_unraisable_errors_and_logging_exceptions_have_persistent_records(self):
        code = """
import gc, logging, sys
from peach import error_reporting as e
e.install()
sys.stderr = None
class Broken:
    def __del__(self):
        raise RuntimeError('cleanup failed')
delayed = Broken()
del delayed
gc.collect()
try:
    raise ValueError('service failed')
except ValueError:
    logging.getLogger('peach.service').exception('request failed')
"""
        result = self.probe(code)
        self.assertEqual(result.returncode, 0, result.stderr)
        stages = {row["stage"] for row in self.records()}
        self.assertTrue({"unraisable", "logging"} <= stages)

    def test_packaged_tray_import_failure_saves_a_report_before_optional_dependencies(self):
        code = f"""
import builtins, ctypes, runpy, sys
from pathlib import Path
original = builtins.__import__
def import_module(name, *args, **kwargs):
    if name == 'pystray':
        raise ModuleNotFoundError('tray dependency unavailable')
    return original(name, *args, **kwargs)
builtins.__import__ = import_module
if sys.platform == 'win32':
    ctypes.windll.user32.MessageBoxW = lambda _, message, *rest: Path({str(self.root / 'dialog.txt')!r}).write_text(message, encoding='utf-8')
sys.argv = ['Peach.exe']
runpy.run_path({str(ROOT / 'scripts/build_app_entry.py')!r}, run_name='__main__')
"""
        result = self.probe(code)
        self.assertEqual(result.returncode, 1)
        self.assertTrue(list(self.logs.glob("peach-support-*.zip")))
        self.assertTrue(any(row["stage"] == "tray-import" for row in self.records()))
        if sys.platform == "win32":
            self.assertIn("诊断报告", (self.root / "dialog.txt").read_text(encoding="utf-8"))

    def test_offline_export_creates_its_log_directory_on_a_fresh_machine(self):
        result = self.probe("from peach.support_bundle import main; raise SystemExit(main())")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(list(self.logs.glob("peach-support-*.zip")))


class DiagnosticExportJobTests(unittest.TestCase):
    def setUp(self):
        from peach.settings_file import PeachConfig
        from peach.diagnostic_exports import DiagnosticExports
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.exports = DiagnosticExports(PeachConfig(self.root, self.root / 'config.toml', present=True))

    def test_background_export_can_cancel_and_cleans_partial_output(self):
        import threading
        started, release = threading.Event(), threading.Event()
        def generate(config, destination, **options):
            Path(destination).write_bytes(b'partial')
            options['progress'](stage='整理来源快照', done=1, total=3)
            started.set()
            release.wait(5)
            if options['cancelled']():
                raise scraping_diagnostics.ExportCancelled()
        with mock.patch.object(scraping_diagnostics, 'bundle_to', side_effect=generate):
            first = self.exports.start('scraping', 'ABC-123')
            try:
                self.assertTrue(started.wait(2))
                self.assertEqual(self.exports.snapshot()['done'], 1)
                with self.assertRaises(ValueError):
                    self.exports.start('support')
                self.assertEqual(self.exports.cancel(first['job_id'])['status'], 'cancelling')
            finally:
                release.set()
                self.exports.job.thread.join(5)
        self.assertEqual(self.exports.snapshot()['status'], 'cancelled')
        self.assertEqual(list(self.exports.root.glob('*')), [])

    def test_completed_export_download_requires_matching_ready_identity(self):
        def generate(config, destination, **options):
            with zipfile.ZipFile(destination, 'w') as archive:
                archive.writestr('manifest.json', '{}')
        with mock.patch.object(scraping_diagnostics, 'bundle_to', side_effect=generate):
            first = self.exports.start('scraping', 'ABC-123')
            self.exports.job.thread.join(5)
        self.assertEqual(self.exports.snapshot()['status'], 'complete')
        path, name = self.exports.download(first['job_id'])
        self.assertEqual(name, 'peach-scraping.zip')
        self.assertTrue(zipfile.is_zipfile(path))
        for identity in ('../secret', '0' * 32):
            with self.assertRaises(FileNotFoundError):
                self.exports.download(identity)
        with self.assertRaises(ValueError):
            self.exports.cancel('stale')


if __name__ == "__main__":
    unittest.main()
