import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from peach.follow_scheduler import (
    MAX_BACKOFF_FACTOR,
    MAX_INTERVAL_MINUTES,
    MIN_INTERVAL_MINUTES,
    FollowScheduleConfig,
    FollowScheduleStore,
    FollowUpdateScheduler,
)


class FollowScheduleStoreTests(unittest.TestCase):
    def test_defaults_are_enabled_hourly_and_updates_are_atomic(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = FollowScheduleStore(Path(temporary))
            self.assertEqual(store.load(), FollowScheduleConfig(True, 60))
            store.save(FollowScheduleConfig(False, 180))
            self.assertEqual(store.load(), FollowScheduleConfig(False, 180))

    def test_unbounded_intervals_are_rejected(self):
        with self.assertRaises(ValueError):
            FollowScheduleStore.validate(True, 14)
        with self.assertRaises(ValueError):
            FollowScheduleStore.validate(True, 10081)
        with self.assertRaises(ValueError):
            FollowScheduleStore.validate("false", 60)


class FollowUpdateSchedulerTests(unittest.TestCase):
    def test_restart_preserves_failed_checks_and_the_backoff_deadline(self):
        failure = lambda: {'checked': 1, 'results': [{'ok': False}]}
        with tempfile.TemporaryDirectory() as temporary:
            first = FollowUpdateScheduler(Path(temporary), failure, available=True)
            first.start()
            try:
                first._run()
                first._run()
                previous = first.status()
            finally:
                first.stop()
            second = FollowUpdateScheduler(Path(temporary), failure, available=True)
            second.start()
            try:
                current = second.status()
                self.assertEqual(current['consecutive_failures'], 2)
                self.assertEqual(current['last_error'], previous['last_error'])
                self.assertEqual(current['failing_since'], previous['failing_since'])
                self.assertEqual(current['next_run_at'], previous['next_run_at'])
                second.run_check = lambda: {'checked': 1, 'results': [{'ok': True}]}
                second._run()
            finally:
                second.stop()
            third = FollowUpdateScheduler(Path(temporary), failure, available=True)
            self.assertEqual(third.status()['consecutive_failures'], 0)
            self.assertIsNone(third.status()['last_error'])
            self.assertIsNone(third.status()['failing_since'])

    def test_installation_reservation_skips_the_tick_without_recording_a_failure(self):
        from peach.update_tasks import UpdateBusy
        def blocked():
            raise UpdateBusy('errors.updateTasks.installInProgress')
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(Path(temporary), blocked, available=True)
            with self.assertNoLogs('peach', level='ERROR'):
                scheduler._run()
            status = scheduler.status()
            self.assertEqual(status['consecutive_failures'], 0)
            self.assertIsNone(status['last_error'])
            self.assertIsNotNone(status['last_skipped_at'])

    def test_interval_job_waits_one_interval_and_can_be_disabled(self):
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(Path(temporary), lambda: {"ok": True}, available=True)
            self.addCleanup(scheduler.stop)
            scheduler.start()
            status = scheduler.status()
            self.assertTrue(status["enabled"])
            self.assertIsNotNone(status["next_run_at"])
            status = scheduler.update(enabled=False, interval_minutes=60)
            self.assertFalse(status["enabled"])
            self.assertIsNone(status["next_run_at"])

    def test_run_status_reports_checked_sources_and_additions(self):
        result = {"ok": True, "checked": 2, "results": [
            {"ok": True, "added": 3}, {"ok": False, "added": 0},
        ]}
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(Path(temporary), lambda: result, available=True)
            scheduler._run()
            status = scheduler.status()
            self.assertEqual(status["last_checked"], 2)
            self.assertEqual(status["last_added"], 3)
            self.assertEqual(status["last_error"], "1 个来源检查失败")
            self.assertIsNotNone(status["last_finished_at"])

    def test_a_busy_lock_is_a_skip_not_a_failure(self):
        """互斥不是故障：手动检查正在跑的时候，自动这一轮什么也没做。

        这里抛异常的话，界面会把它显示成「上次失败」，还连带触发退避——真正的
        失败反而被这种噪声盖住。"""
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(
                Path(temporary), lambda: {"ok": False, "busy": True,
                                          "checked": 0, "results": []},
                available=True)
            scheduler._run()
            status = scheduler.status()
            self.assertIsNone(status["last_error"])
            self.assertIsNotNone(status["last_skipped_at"])
            self.assertEqual(status["consecutive_failures"], 0)
            # 这一轮既没检查也没完成，所以不留「上次运行」的时间戳：
            # 留了界面就会把一次没发生的运行显示成「上次完成」。
            self.assertIsNone(status["last_started_at"])
            self.assertIsNone(status["last_finished_at"])
            self.assertEqual(status["last_checked"], 0)

    def test_consecutive_failures_back_off_and_a_good_run_resets_them(self):
        outcomes = [
            {"ok": True, "checked": 1, "results": [{"ok": False, "added": 0}]},
            RuntimeError("upstream closed the connection"),
            {"ok": True, "checked": 1, "results": [{"ok": True, "added": 2}]},
        ]

        def run_check():
            outcome = outcomes.pop(0)
            if isinstance(outcome, Exception):
                raise outcome
            return outcome

        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(Path(temporary), run_check,
                                              available=True)
            interval = scheduler.config.interval_minutes
            # 第一次失败照原间隔重试：多数失败只是一次抖动。
            self.assertEqual(scheduler.backoff_minutes(1), interval)
            self.assertEqual(scheduler.backoff_minutes(2), interval * 2)
            self.assertEqual(scheduler.backoff_minutes(3), interval * 4)
            self.assertEqual(scheduler.backoff_minutes(99),
                             min(interval * MAX_BACKOFF_FACTOR,
                                 MAX_INTERVAL_MINUTES))
            scheduler._run()
            first = scheduler.status()
            self.assertEqual(first["consecutive_failures"], 1)
            self.assertEqual(first["failing_since"], first["last_started_at"])
            with self.assertLogs("peach.follow_scheduler", level="ERROR") as captured:
                scheduler._run()
            self.assertIn("upstream closed the connection", "\n".join(captured.output))
            status = scheduler.status()
            self.assertEqual(status["consecutive_failures"], 2)
            self.assertEqual(status["last_error"], "upstream closed the connection")
            # 连续失败的起点停在第一轮，不跟着每一轮往后挪。
            self.assertEqual(status["failing_since"], first["failing_since"])
            scheduler._run()
            status = scheduler.status()
            self.assertEqual(status["consecutive_failures"], 0)
            self.assertIsNone(status["last_error"])
            self.assertIsNone(status["failing_since"])
            self.assertEqual(status["last_added"], 2)

    def test_run_now_runs_the_scheduled_job_and_settles_its_failure(self):
        import threading
        finished = threading.Event()
        outcomes = [{"ok": True, "checked": 1, "results": [{"ok": False}]},
                    {"ok": True, "checked": 1, "results": [{"ok": True, "added": 1}]}]

        def run_check():
            return outcomes.pop(0)

        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(Path(temporary), run_check, available=True)
            self.addCleanup(scheduler.stop)
            with self.assertRaises(ValueError):
                scheduler.run_now()
            scheduler._run()
            self.assertEqual(scheduler.status()["last_error"], "1 个来源检查失败")
            original = scheduler._run

            def tracked():
                original()
                finished.set()
            scheduler._run = tracked
            scheduler.start()
            # 提前标成运行中，读状态的人不会在调度线程领走之前再看到旧的失败。
            self.assertTrue(scheduler.run_now()["running"])
            self.assertTrue(finished.wait(10))
            status = scheduler.status()
            self.assertEqual((status["running"], status["last_error"], status["consecutive_failures"]),
                             (False, None, 0))
            self.assertIsNotNone(status["next_run_at"])

    def test_run_now_is_refused_without_a_running_job(self):
        with tempfile.TemporaryDirectory() as temporary:
            reader = FollowUpdateScheduler(Path(temporary), lambda: {"ok": True}, available=False)
            with self.assertRaises(ValueError):
                reader.run_now()
            writer = FollowUpdateScheduler(Path(temporary), lambda: {"ok": True}, available=True)
            self.addCleanup(writer.stop)
            writer.start()
            writer.update(enabled=False, interval_minutes=60)
            with self.assertRaises(ValueError):
                writer.run_now()
            self.assertFalse(writer.status()["running"])

    def test_backoff_pushes_the_next_run_past_the_plain_interval(self):
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(
                Path(temporary),
                lambda: {"ok": True, "checked": 1,
                         "results": [{"ok": False, "added": 0}]},
                available=True)
            self.addCleanup(scheduler.stop)
            scheduler.update(enabled=True, interval_minutes=MIN_INTERVAL_MINUTES)
            scheduler.start()
            planned = datetime.now(timezone.utc) + timedelta(
                minutes=MIN_INTERVAL_MINUTES)
            scheduler._run()
            scheduler._run()
            next_run = scheduler.status()["next_run_at"]
            self.assertIsNotNone(next_run)
            self.assertGreater(datetime.fromisoformat(next_run), planned,
                               "连续失败后应当推后，而不是照原间隔继续敲上游")

    def test_a_tick_shorter_than_the_period_runs_often_and_backs_off_from_the_tick(self):
        """订阅源：设置里的间隔是每个源的周期，调度按更短的一跳看谁到期（ADR-0134）。"""
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(
                Path(temporary), lambda: {"ok": True, "checked": 0, "results": []},
                available=True, default=FollowScheduleConfig(True, 360), tick_minutes=30)
            self.addCleanup(scheduler.stop)
            before = datetime.now(timezone.utc)
            scheduler.start()
            status = scheduler.status()
            self.assertEqual(status["interval_minutes"], 360)
            self.assertLess(datetime.fromisoformat(status["next_run_at"]),
                            before + timedelta(minutes=31))
            self.assertEqual(scheduler.backoff_minutes(2), 60)

    def test_an_idle_tick_keeps_the_last_failure_on_record(self):
        """没有到期源的一跳什么也没做：上一轮的失败、连续失败计数和上次运行时间都留着。"""
        outcomes = [{"ok": True, "checked": 1, "results": [{"ok": False, "added": 0}]},
                    {"ok": True, "idle": True, "checked": 0, "results": []}]
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(Path(temporary), lambda: outcomes.pop(0),
                                              available=True, tick_minutes=30)
            scheduler._run()
            failed = scheduler.status()
            scheduler._run()
            status = scheduler.status()
            self.assertEqual(status["last_error"], "1 个来源检查失败")
            self.assertEqual(status["consecutive_failures"], 1)
            self.assertEqual((status["last_started_at"], status["last_finished_at"], status["last_checked"]),
                             (failed["last_started_at"], failed["last_finished_at"], 1))
            self.assertFalse(status["running"])

    def test_a_round_still_running_at_the_wait_limit_is_neither_success_nor_failure(self):
        """等满期限这一轮还没跑完（多半被暂停了）：调度线程先回来，不按成功结算掉上一轮的失败，也不退避。"""
        outcomes = [{"ok": True, "checked": 1, "results": [{"ok": False, "added": 0}]},
                    {"ok": True, "status": "running", "checked": 0, "results": []}]
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(Path(temporary), lambda: outcomes.pop(0), available=True)
            scheduler._run()
            failed = scheduler.status()
            scheduler._run()
            status = scheduler.status()
            self.assertEqual((status["last_error"], status["consecutive_failures"]), ("1 个来源检查失败", 1))
            self.assertEqual((status["last_finished_at"], status["last_checked"]), (failed["last_finished_at"], 1))
            self.assertIsNotNone(status["last_started_at"])
            self.assertFalse(status["running"])

    def test_reader_never_starts_or_accepts_schedule_changes(self):
        with tempfile.TemporaryDirectory() as temporary:
            scheduler = FollowUpdateScheduler(Path(temporary), lambda: {}, available=False)
            scheduler.start()
            self.assertFalse(scheduler.status()["available"])
            with self.assertRaises(ValueError):
                scheduler.update(enabled=True, interval_minutes=60)
