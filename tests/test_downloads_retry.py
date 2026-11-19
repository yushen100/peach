"""后台暂时故障的分类、退避与停止条件，只使用临时任务和假响应。"""
import errno
from contextlib import closing
from pathlib import Path
import shutil
import sqlite3
import ssl
import tempfile
import unittest

import httpx

from peach.task_retry import RETRY_DELAYS, retry_delay, transient_delay
from peach.sources.base import FailureReason, SourceFailure
from peach import migrations
from peach.metadata import relayed


class RetryPolicyTests(unittest.TestCase):
    def test_network_and_temporary_file_errors_back_off_then_stop(self):
        for error in [TimeoutError(), ConnectionResetError(), OSError(errno.EBUSY, 'Device or resource busy'),
                      SourceFailure(FailureReason.NETWORK, *relayed('connection reset'))]:
            with self.subTest(error=type(error).__name__):
                self.assertEqual([retry_delay(error, index) for index in range(4)], [*RETRY_DELAYS, None])

    def test_credentials_integrity_disk_and_program_errors_do_not_retry(self):
        for error in [PermissionError(), FileNotFoundError(), OSError(errno.ENOSPC, 'No space left on device'),
                      sqlite3.IntegrityError(), ValueError(), RuntimeError(),
                      SourceFailure(FailureReason.AUTH_REQUIRED, 'errors.javdb.loginRequired'),
                      SourceFailure(FailureReason.PARSE_ERROR, 'errors.avbase.unrecognized')]:
            with self.subTest(error=type(error).__name__):
                self.assertIsNone(transient_delay(error))

    def test_http_retry_after_is_respected_and_authentication_is_not_replayed(self):
        request = httpx.Request('GET', 'https://example.invalid/source')
        for status, expected in [(429, 1200.0), (503, 1200.0), (401, None), (403, None), (404, None)]:
            response = httpx.Response(status, headers={'Retry-After': '1200'}, request=request)
            error = httpx.HTTPStatusError('来源未取得', request=request, response=response)
            self.assertEqual(retry_delay(error, 0), expected)
        error = httpx.ConnectError('证书未通过校验')
        error.__cause__ = ssl.SSLCertVerificationError('证书不可信')
        self.assertIsNone(transient_delay(error))

    def test_invalid_retry_after_keeps_a_finite_schedule(self):
        request = httpx.Request('GET', 'https://example.invalid/source')
        for header in ('invalid', '9' * 400):
            with self.subTest(header=header[:20]):
                response = httpx.Response(429, headers={'Retry-After': header}, request=request)
                error = httpx.HTTPStatusError('来源限流', request=request, response=response)
                self.assertEqual(retry_delay(error, 0), 900)

    def test_sqlite_lock_codes_are_transient_but_missing_schema_is_not(self):
        with sqlite3.connect(':memory:') as db:
            try:
                db.execute('SELECT * FROM missing_table')
            except sqlite3.OperationalError as error:
                self.assertIsNone(transient_delay(error))
        error = sqlite3.OperationalError('数据库被占用')
        error.sqlite_errorcode = sqlite3.SQLITE_BUSY
        self.assertEqual(transient_delay(error), 0)


class RetryUpgradeTests(unittest.TestCase):
    def test_existing_task_keeps_its_remote_identity_path_and_failure_during_upgrade(self):
        directory = Path(__file__).resolve().parents[1] / 'migrations'
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            previous = root / 'previous'
            previous.mkdir()
            for migration in migrations.discover(directory):
                if migration.version < '0051':
                    shutil.copyfile(migration.path, previous / migration.path.name)
            database = root / 'ledger.db'
            migrations.upgrade(database, previous)
            with closing(sqlite3.connect(database)) as connection:
                connection.row_factory = sqlite3.Row
                connection.execute("INSERT INTO download_task(provider,source_uri,target,state,updated_at,remote_id,"
                    "ledger_path,postprocess_state,postprocess_detail) VALUES(?,?,?,?,?,?,?,?,?)",
                    ('115', 'test-magnet', '/Movies', 'ingested', '2026-01-01T00:00:00Z', 'remote-1',
                     r'C:\Media\film.mp4', 'failed', '需要检查挂载'))
                connection.commit()
                before = dict(connection.execute('SELECT * FROM download_task').fetchone())
            self.assertEqual([item.version for item in migrations.upgrade(database, directory)], ['0051', '0052', '0053', '0054', '0055', '0056', '0057', '0058', '0059'])
            with closing(sqlite3.connect(database)) as connection:
                connection.row_factory = sqlite3.Row
                after = dict(connection.execute('SELECT * FROM download_task').fetchone())
            self.assertEqual(after.pop('postprocess_retries'), 0)
            # 0056 加的 code 列不回填：旧行照原文显示。
            codes = ('failure_detail_code', 'failure_detail_params', 'postprocess_detail_code', 'postprocess_detail_params')
            self.assertEqual({name: after.pop(name) for name in codes}, dict.fromkeys(codes))
            self.assertEqual(after, before)
            self.assertEqual(migrations.upgrade(database, directory), [])
