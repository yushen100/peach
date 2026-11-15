"""`peach.log_retention`：日志目录统一保留半年，按月切段，大小不设限。"""
from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from peach import log_retention, retention_settings

NOW = datetime(2026, 9, 5, 12, 0, 0)


def touch(path: Path, when: datetime, content: bytes = b"line\n") -> None:
    path.write_bytes(content)
    stamp = when.timestamp()
    os.utime(path, (stamp, stamp))


class SweepTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.logs = Path(self.tmp.name).resolve() / "logs"
        self.logs.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def test_a_file_nobody_wrote_to_for_half_a_year_is_deleted_whole(self):
        touch(self.logs / "tray-http.out.log", NOW - timedelta(days=184))
        touch(self.logs / "tray-http.out.until-20260131.log", NOW - timedelta(days=200))
        actions = log_retention.sweep(self.logs, now=NOW)
        self.assertEqual(sorted(p.name for p in self.logs.iterdir()), [])
        self.assertEqual(sorted(actions), ["deleted tray-http.out.log",
                                           "deleted tray-http.out.until-20260131.log"])

    def test_a_file_last_written_in_an_earlier_month_becomes_a_dated_segment(self):
        touch(self.logs / "tray-https.err.log", datetime(2026, 8, 30, 23, 0), b"august\n")
        actions = log_retention.sweep(self.logs, now=NOW)
        self.assertEqual(actions, ["rotated tray-https.err.log -> tray-https.err.until-20260830.log"])
        self.assertFalse((self.logs / "tray-https.err.log").exists(), "下一次写入从空文件开始")
        self.assertEqual((self.logs / "tray-https.err.until-20260830.log").read_bytes(), b"august\n")

    def test_a_file_written_this_month_stays_put(self):
        touch(self.logs / "windows-source-sync.log", NOW - timedelta(days=3))
        self.assertEqual(log_retention.sweep(self.logs, now=NOW), [])
        self.assertTrue((self.logs / "windows-source-sync.log").exists())

    def test_segments_are_never_cut_again_until_they_expire(self):
        segment = self.logs / "tray-scan.out.until-20260731.log"
        touch(segment, datetime(2026, 7, 31, 8, 0))
        self.assertEqual(log_retention.sweep(self.logs, now=NOW), [])
        self.assertTrue(segment.exists())
        self.assertEqual(log_retention.sweep(self.logs, now=datetime(2027, 2, 1)),
                         ["deleted tray-scan.out.until-20260731.log"])

    def test_a_second_cut_on_the_same_day_appends_instead_of_overwriting(self):
        touch(self.logs / "tray-http.out.until-20260830.log", datetime(2026, 8, 30, 9, 0), b"first\n")
        touch(self.logs / "tray-http.out.log", datetime(2026, 8, 30, 22, 0), b"second\n")
        log_retention.sweep(self.logs, now=NOW)
        self.assertEqual((self.logs / "tray-http.out.until-20260830.log").read_bytes(), b"first\nsecond\n")
        self.assertFalse((self.logs / "tray-http.out.log").exists())

    def test_only_log_files_are_touched_and_a_missing_directory_is_fine(self):
        touch(self.logs / "peach-tray.lock", NOW - timedelta(days=400))
        touch(self.logs / "notes.txt", NOW - timedelta(days=400))
        self.assertEqual(log_retention.sweep(self.logs, now=NOW), [])
        self.assertEqual(log_retention.sweep(self.logs / "absent", now=NOW), [])

    def test_the_retention_is_half_a_year(self):
        self.assertEqual(log_retention.RETENTION, timedelta(days=183))
        self.assertEqual(retention_settings.log_retention(Path(self.tmp.name) / "state"), log_retention.RETENTION)

    def test_a_shorter_retention_from_this_computer_deletes_sooner(self):
        state = Path(self.tmp.name) / "state"
        self.assertEqual(retention_settings.save(state, {"log_days": 30}), {"backup_keep": 5, "log_days": 30})
        touch(self.logs / "tray.log", NOW - timedelta(days=31))
        touch(self.logs / "sync.log", NOW - timedelta(days=29))
        actions = log_retention.sweep(self.logs, now=NOW, retention=retention_settings.log_retention(state))
        self.assertEqual([action for action in actions if action.startswith("deleted")], ["deleted tray.log"])

    def test_retention_settings_take_only_listed_choices_and_survive_a_broken_file(self):
        state = Path(self.tmp.name) / "state"
        for body in ({"log_days": 7}, {"backup_keep": True}, {"backup_keep": "5"}, {}):
            with self.assertRaises(ValueError):
                retention_settings.save(state, body)
        self.assertFalse((state / retention_settings.FILENAME).exists())
        state.mkdir()
        (state / retention_settings.FILENAME).write_text('{"backup_keep": 3, "log_days": 365}', encoding="utf-8")
        self.assertEqual(retention_settings.read(state), {"backup_keep": 5, "log_days": 365})
        (state / retention_settings.FILENAME).write_text("not json", encoding="utf-8")
        self.assertEqual(retention_settings.read(state), {"backup_keep": 5, "log_days": 183})

    def test_idle_logs_of_finished_processes_go_and_the_rest_stay(self):
        entry = b'{"stage": "entry", "pid": 1}\n'
        touch(self.logs / "crash-11.log", NOW, b"")
        touch(self.logs / "errors-11.log", NOW, entry)
        touch(self.logs / "crash-12.log", NOW, b"Fatal Python error: Segmentation fault\n")
        touch(self.logs / "errors-12.log", NOW, entry + b'{"stage": "logging", "message": "x"}\n')
        touch(self.logs / "crash-13.log", NOW, b"")
        touch(self.logs / "errors-13.log", NOW, entry)
        actions = log_retention.sweep(self.logs, now=NOW, alive=lambda pid: pid == 13)
        self.assertEqual(actions, ["removed 2 idle process logs"])
        self.assertEqual(sorted(path.name for path in self.logs.iterdir()),
                         ["crash-12.log", "crash-13.log", "errors-12.log", "errors-13.log"])


if __name__ == "__main__":
    unittest.main()
