"""自动更新的持久设置、跨服务互斥和安装边界。"""
from pathlib import Path
import tempfile
from threading import Event
import unittest
from unittest.mock import patch

from filelock import FileLock
from peach.automatic_updates import AutomaticUpdates


class AutomaticUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.updates = AutomaticUpdates(self.root, available=True)

    def test_settings_roundtrip_disable_and_validate_installation(self):
        self.assertEqual(self.updates.snapshot()["mode"], "check")
        self.updates.save({"mode": "check", "interval_hours": 6})
        self.assertEqual(AutomaticUpdates(self.root, available=True).read()["mode"], "check")
        for body in ({"mode": [], "interval_hours": 24}, {"mode": "check", "interval_hours": True},
                     {"mode": "check", "interval_hours": 1}):
            with self.assertRaises(ValueError):
                self.updates.save(body)
        with patch("peach.distribution.in_app_update", return_value=False), self.assertRaises(ValueError):
            self.updates.save({"mode": "download", "interval_hours": 24})
        self.updates.save({"mode": "off", "interval_hours": 24})
        with patch("peach.release_updates.check") as check:
            self.updates.tick()
            check.assert_not_called()

    def test_two_services_share_due_time_and_respect_file_lock(self):
        self.updates.save({"mode": "check", "interval_hours": 24})
        other = AutomaticUpdates(self.root, available=True)
        with patch("peach.release_updates.check", return_value={"state": "current"}) as check, patch(
                "peach.automatic_updates.time.time", return_value=200000):
            with FileLock(str(self.updates.path) + ".lock", timeout=0):
                other.tick()
                check.assert_not_called()
            self.updates.tick()
            other.tick()
            check.assert_called_once()
        with patch("peach.release_updates.check", return_value={"state": "error"}) as check, patch(
                "peach.automatic_updates.time.time", return_value=300000):
            other.tick()
            self.updates.tick()
            check.assert_called_once()
        self.assertEqual(self.updates.read()["result"]["state"], "error")

    def test_tick_sleeps_until_the_due_time_without_touching_the_shared_lock(self):
        self.updates.save({"mode": "check", "interval_hours": 6})
        with patch("peach.release_updates.check", return_value={"state": "current"}) as check, \
                patch("peach.automatic_updates.time.time", return_value=200000) as clock:
            self.assertEqual(self.updates.tick(), 6 * 3600)
            check.assert_called_once()
            clock.return_value = 200000 + 3600
            with FileLock(str(self.updates.path) + ".lock", timeout=0):
                # 没到期时连锁都不碰：别的服务持锁也照样报剩余时间。
                self.assertEqual(self.updates.tick(), 5 * 3600)
            check.assert_called_once()
            clock.return_value = 200000 + 6 * 3600
            self.assertEqual(self.updates.tick(), 6 * 3600)
            self.assertEqual(check.call_count, 2)
        self.updates.save({"mode": "off", "interval_hours": 6})
        self.assertIsNone(self.updates.tick())

    def test_background_check_waits_for_settings_instead_of_waking_every_minute(self):
        self.updates.save({"mode": "off", "interval_hours": 24})
        checked = Event()
        with patch("peach.release_updates.check",
                   side_effect=lambda: checked.set() or {"state": "current"}) as check:
            self.updates.start()
            self.addCleanup(self.updates.stop)
            self.assertFalse(checked.wait(0.3), "关闭时不该自己醒来检查")
            self.updates.save({"mode": "check", "interval_hours": 24})
            self.assertTrue(checked.wait(5), "改设置后应立即重排并检查")
            Event().wait(0.3)
            self.assertEqual(check.call_count, 1, "检查完排到下一个到期点，不再轮询")

    def test_service_start_defers_the_first_check_and_stop_waits_for_the_thread(self):
        """服务刚起不立即联网检查；关停等后台线程退出，文件锁随之放下。"""
        self.updates.save({"mode": "check", "interval_hours": 24})
        checked = Event()
        with patch("peach.release_updates.check",
                   side_effect=lambda: checked.set() or {"state": "current"}):
            self.updates.start()
            self.assertFalse(checked.wait(0.3), "启动后先等启动延迟再检查")
            self.updates.stop()
        self.assertFalse(self.updates._thread.is_alive())
        with FileLock(str(self.updates.path) + ".lock", timeout=0):
            pass

    def test_legacy_results_are_hidden_and_rechecked_without_waiting_the_old_interval(self):
        from peach import release_updates

        version = release_updates.snapshot()['current_version']
        self.updates.write({'mode': 'check', 'interval_hours': 24, 'checked_at': 200000,
                            'result': {'current_version': version, 'latest_version': '0.50.0',
                                       'state': 'ahead'}})
        self.assertNotIn('result', self.updates.snapshot())
        fresh = {'current_version': version, 'state': 'error', 'latest_version': None}
        with patch('peach.release_updates.check', return_value=fresh) as check, \
                patch('peach.automatic_updates.time.time', return_value=200001):
            self.updates.tick()
            self.updates.tick()
        check.assert_called_once()
        self.assertEqual(self.updates.snapshot()['result']['state'], 'error')
        self.assertNotIn('listing_rule', self.updates.snapshot())

    def test_manual_check_replaces_legacy_results_without_enabling_automatic_checks(self):
        from peach import release_updates

        self.updates.write({'mode': 'off', 'interval_hours': 168, 'result': {'state': 'ahead'}})
        self.updates.remember({'current_version': release_updates.snapshot()['current_version'],
                               'state': 'current'})
        result = self.updates.snapshot()
        self.assertEqual(result['mode'], 'off')
        self.assertEqual(result['interval_hours'], 168)
        self.assertEqual(result['result']['state'], 'current')

    def test_download_prepares_once_and_never_requests_restart(self):
        with patch("peach.distribution.in_app_update", return_value=True), patch(
                "peach.release_updates.check", return_value={"state": "available"}), patch(
                "peach.standalone_update.public", return_value={"state": "idle"}), patch(
                "peach.standalone_update.start") as start, patch("peach.standalone_update.request_restart") as restart:
            self.updates.save({"mode": "download", "interval_hours": 24})
            self.updates.tick()
            self.updates.tick()
            start.assert_called_once()
            restart.assert_not_called()
        for state in ("ready", "downloading", "installing"):
            with patch("peach.distribution.in_app_update", return_value=True), patch(
                    "peach.release_updates.check", return_value={"state": "available"}), patch(
                    "peach.standalone_update.public", return_value={"state": state}), patch(
                    "peach.standalone_update.start") as start:
                self.updates.write({"mode": "download", "interval_hours": 24})
                self.updates.tick()
                start.assert_not_called()

    def test_macos_standalone_only_checks_even_with_saved_download_mode(self):
        self.updates.write({"mode": "download", "interval_hours": 24})
        with patch("peach.distribution.in_app_update", return_value=False), patch(
                "peach.release_updates.check", return_value={"state": "available"}) as check, patch(
                "peach.standalone_update.start") as start:
            self.assertFalse(self.updates.snapshot()["download_available"])
            self.updates.tick()
            check.assert_called_once()
            start.assert_not_called()
        self.assertNotIn("error", self.updates.read(), "没有应用内安装的系统不能每轮记一次下载失败")

    def test_unmanaged_and_corrupt_settings_fail_closed(self):
        other = AutomaticUpdates(self.root, available=False)
        with self.assertRaises(ValueError):
            other.save({"mode": "check", "interval_hours": 24})
        self.updates.path.write_text('[]', encoding="utf-8")
        self.assertIn("error", self.updates.snapshot())
        with patch("peach.release_updates.check") as check:
            self.updates.tick()
            other.tick()
            check.assert_not_called()
