from __future__ import annotations

import io
import json
import math
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext, redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

from filelock import FileLock

from scripts import test_environment_identity
from scripts import test_evidence as evidence
from scripts import test_runner as runner
from scripts import test_shard_results
from scripts import test_slots as slots
from support.gitrepo import seed_repository

ROOT = Path(__file__).resolve().parents[1]


class SlotFixture:
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.folder = Path(temporary.name).resolve() / "locks" / "slots"
        # 外层正式运行持有名额时会把标记传给本进程；这里模拟的是没有父进程的独立运行。
        self.enterContext(mock.patch.dict(os.environ))
        for name in (slots.HELD_VARIABLE, slots.SLOTS_VARIABLE, "CI"):
            os.environ.pop(name, None)

    def hold(self, need, total=2, wait_seconds=0, **kwargs):
        return slots.held(need, total=total, scope=kwargs.pop("scope", "auto"), root=kwargs.pop("root", "here"),
                          folder=self.folder, wait_seconds=wait_seconds, **kwargs)

    def until(self, condition):
        deadline = time.monotonic() + 5
        while not condition() and time.monotonic() < deadline:
            time.sleep(0.02)
        self.assertTrue(condition())

    def taken(self, need, **kwargs):
        """在别的线程里排队取名额，取到就放，返回取到的编号。"""
        with self.hold(need, **kwargs) as numbers:
            return numbers


class SlotPoolTests(SlotFixture, unittest.TestCase):
    def test_a_slot_is_taken_recorded_and_released(self):
        with self.hold(1, scope="auto", root="worktree-a") as taken:
            self.assertEqual(taken, [1])
            record = json.loads((self.folder / "slot-1.lock.holder.json").read_text(encoding="utf-8"))
            self.assertEqual((record["pid"], record["scope"], record["root"]), (os.getpid(), "auto", "worktree-a"))
            self.assertEqual(os.environ[slots.HELD_VARIABLE], str(os.getpid()))
            with self.hold(1) as second:
                self.assertEqual(second, [2])
        self.assertNotIn(slots.HELD_VARIABLE, os.environ)
        self.assertFalse((self.folder / "slot-1.lock.holder.json").exists())
        for number in (1, 2):
            lock = FileLock(self.folder / f"slot-{number}.lock")
            lock.acquire(timeout=0)
            lock.release()

    def test_a_full_run_takes_every_slot_and_shuts_out_the_rest(self):
        with self.hold(3, total=3, scope="full") as taken:
            self.assertEqual(taken, [1, 2, 3])
            with self.assertRaises(slots.SlotTimeout), redirect_stderr(io.StringIO()):
                with self.hold(1, total=3):
                    pass

    def test_waiters_queue_when_slots_are_full_and_take_the_freed_one(self):
        release = threading.Event()

        def occupy():
            with self.hold(1, scope="auto", root="first"):
                release.wait(10)

        errors = io.StringIO()
        with ThreadPoolExecutor(max_workers=2) as pool, redirect_stderr(errors):
            first = pool.submit(occupy)
            self.until(lambda: len(slots.holders(self.folder, 2)) == 1)
            with self.hold(1, scope="auto", root="second"):
                with self.assertRaises(slots.SlotTimeout):
                    with self.hold(1):
                        pass
                waiter = pool.submit(self.taken, 1, wait_seconds=10, root="third")
                time.sleep(0.3)
                self.assertFalse(waiter.done(), "名额满时应排队等待")
                release.set()
                self.assertEqual(waiter.result(timeout=10), [1])
            first.result(timeout=5)
        self.assertNotIn("Traceback", errors.getvalue())

    def test_a_waiting_full_run_is_not_overtaken_by_later_arrivals(self):
        with ThreadPoolExecutor(max_workers=1) as pool, redirect_stderr(io.StringIO()):
            with self.hold(1, scope="auto"):
                waiter = pool.submit(self.taken, 2, scope="full", wait_seconds=10)
                self.until(lambda: list((self.folder / "slots.lock.queue").glob("*.json")))
                # 2 号名额空着，但排在前面的全量还没取满，后来的 auto 只能排在它后面。
                with self.assertRaises(slots.SlotTimeout):
                    with self.hold(1):
                        pass
            self.assertEqual(waiter.result(timeout=10), [1, 2])

    def test_a_killed_holder_gives_its_slot_back(self):
        script = ("import sys, time; sys.path[:0] = [sys.argv[1], sys.argv[1] + '/src']\n"
                  "from pathlib import Path\nfrom scripts import test_slots\n"
                  "with test_slots.held(1, total=1, scope='auto', root='killed', folder=Path(sys.argv[2])):\n"
                  "    print('held', flush=True)\n    time.sleep(120)\n")
        environment = {key: value for key, value in os.environ.items() if key != slots.HELD_VARIABLE}
        process = subprocess.Popen([sys.executable, "-c", script, str(ROOT), str(self.folder)], env=environment,
                                   stdout=subprocess.PIPE, text=True, encoding="utf-8")
        try:
            self.assertEqual(process.stdout.readline().strip(), "held")
            self.assertEqual([note["root"] for note in slots.holders(self.folder, 1)], ["killed"])
        finally:
            # Windows venv 的 python.exe 是启动器，真正持锁的解释器是它的子进程。
            test_shard_results.stop_process_tree(process)
            process.wait(timeout=10)
            process.stdout.close()
        # 被强行结束的进程来不及删记录；记录里的 pid 已不在，不再算占用者。
        self.assertTrue((self.folder / "slot-1.lock.holder.json").exists())
        self.assertEqual(slots.holders(self.folder, 1), [])
        with self.hold(1, total=1, wait_seconds=10, root="next") as taken:
            self.assertEqual(taken, [1])

    def test_a_record_whose_pid_was_reused_is_not_a_holder(self):
        self.folder.mkdir(parents=True)
        record = self.folder / "slot-1.lock.holder.json"
        record.write_text(json.dumps({"pid": os.getpid(), "created": time.time() - 30,
                                      "process_started": 1.0, "scope": "full", "root": "gone"}), encoding="utf-8")
        with mock.patch.object(evidence, "_process_started", return_value=time.time() - 5):
            self.assertEqual(slots.holders(self.folder, 1), [])

    def test_the_waiting_report_names_each_holder_and_repeats(self):
        errors = io.StringIO()
        with ThreadPoolExecutor(max_workers=1) as pool, redirect_stderr(errors):
            with self.hold(2, scope="full", root="C:/worktrees/busy"):
                waiter = pool.submit(self.taken, 1, wait_seconds=10, report_seconds=0.1)
                deadline = time.monotonic() + 5
                while errors.getvalue().count(f"pid {os.getpid()}") < 4 and time.monotonic() < deadline:
                    time.sleep(0.05)
            self.assertEqual(waiter.result(timeout=10), [1])
        report = errors.getvalue()
        self.assertGreaterEqual(report.count("C:/worktrees/busy"), 4, "两个名额各报一行，至少报两轮")
        self.assertIn("full", report)

    def test_the_report_states_scope_root_pid_start_and_elapsed_minutes(self):
        self.folder.mkdir(parents=True)
        now = time.time()
        (self.folder / "slot-2.lock.holder.json").write_text(json.dumps({
            "pid": os.getpid(), "created": now - 200, "process_started": evidence._process_started(os.getpid()),
            "started_at": "2026-11-16 09:30:00", "scope": "auto", "root": "D:/worktrees/other"}), encoding="utf-8")
        text = slots.describe(self.folder, 2, 2, 1, 1800, now=now)
        lines = text.splitlines()
        self.assertEqual(len(lines), 2)
        for part in ("2", "auto", f"pid {os.getpid()}", "D:/worktrees/other", "2026-11-16 09:30:00", "3"):
            self.assertIn(part, lines[1])
        self.assertIn("30", lines[0])

    def test_waiting_has_no_time_limit_by_default(self):
        self.assertEqual(slots.WAIT_SECONDS, math.inf)
        unlimited = slots.describe(self.folder, 2, 1, 0, math.inf).splitlines()[0]
        limited = slots.describe(self.folder, 2, 1, 0, 600).splitlines()[0]
        self.assertTrue(limited.startswith(unlimited))
        self.assertIn("10", limited.removeprefix(unlimited))
        with ThreadPoolExecutor(max_workers=1) as pool, redirect_stderr(io.StringIO()):
            with self.hold(2, scope="full"):
                waiter = pool.submit(self.taken, 1, wait_seconds=slots.WAIT_SECONDS)
                time.sleep(0.5)
                self.assertFalse(waiter.done())
            self.assertEqual(len(waiter.result(timeout=10)), 1)

    def test_the_lock_folder_is_created_when_missing(self):
        self.assertFalse(self.folder.parent.exists())
        with self.hold(1):
            self.assertTrue(self.folder.is_dir())


class SlotSettingTests(SlotFixture, unittest.TestCase):
    def test_slot_count_defaults_to_two_and_follows_the_variable(self):
        self.assertEqual(slots.slot_count({}), 2)
        self.assertEqual(slots.slot_count({slots.SLOTS_VARIABLE: "3"}), 3)
        for value in ("0", "-1", "two", "1.5"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                slots.slot_count({slots.SLOTS_VARIABLE: value})

    def test_slot_settings_stay_out_of_the_environment_fingerprint(self):
        self.assertEqual(test_environment_identity.SCHEDULING_FLAGS, {slots.SLOTS_VARIABLE, slots.HELD_VARIABLE})
        flags = test_environment_identity.environment_flags({
            slots.SLOTS_VARIABLE: "3", slots.HELD_VARIABLE: "1234", "PEACH_OTHER": "1"})
        self.assertEqual(flags, {"PEACH_OTHER": "1"})

    def test_ci_and_children_of_a_holder_never_wait(self):
        with self.hold(2):
            with mock.patch.object(slots, "slot_dir", return_value=self.folder), \
                    mock.patch.object(runner.test_history, "nested", return_value=False):
                self.assertIsInstance(runner.machine_slots("auto", full=False), nullcontext,
                                      "持有名额的进程派出的子运行沿用父进程的名额")
                os.environ.pop(slots.HELD_VARIABLE)
                with mock.patch.dict(os.environ, {"CI": "true"}):
                    self.assertIsInstance(runner.machine_slots("full", full=True), nullcontext)
                os.environ[slots.HELD_VARIABLE] = str(os.getpid())

    def test_focus_takes_a_slot_only_for_browsers_or_many_files(self):
        self.assertTrue(slots.focus_needs_slot(["frontend/e2e/library.test.ts"]))
        self.assertFalse(slots.focus_needs_slot(["test_scan", "tests/test_cli.py,test_scan.ScanTests.test_a"]))
        self.assertFalse(slots.focus_needs_slot(["frontend/test/player.test.ts"]))
        many = [f"test_module_{index}" for index in range(slots.FOCUS_FREE_FILES + 1)]
        self.assertTrue(slots.focus_needs_slot(many))
        self.assertFalse(slots.focus_needs_slot(many[:slots.FOCUS_FREE_FILES]))


class LoadEstimateTests(unittest.TestCase):
    def test_runs_estimated_near_a_full_run_take_every_slot(self):
        files = [Path(f"test_{name}.py") for name in "abcdefghij"]
        seconds = {path.stem: 10.0 for path in files}
        with mock.patch.object(runner, "load_file_seconds", return_value=seconds),                 mock.patch.object(runner, "selected_files", return_value=tuple(files)):
            names = [path.name for path in files]
            self.assertTrue(runner.takes_every_slot(names))
            share = math.ceil(runner.FULL_LOAD_SHARE * len(names))
            self.assertTrue(runner.takes_every_slot(names[:share]))
            self.assertFalse(runner.takes_every_slot(names[:share - 1]))
            # 没测过的文件按已测文件的中位数估计，浏览器冒烟不低于先验秒数。
            self.assertTrue(runner.takes_every_slot(["test_web_e2e.py"]))


class RunnerSlotTests(SlotFixture, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.repo = seed_repository(self.folder.parent.parent / "repo", {
            ".gitignore": "build/\n", "README.md": "内容\n",
            "src/peach/__init__.py": '__version__ = "0.7.30"\n'}, "seed")
        self.enterContext(mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "false"}))
        self.enterContext(mock.patch.object(slots, "slot_dir", return_value=self.folder))
        self.enterContext(mock.patch.object(runner.test_history, "nested", return_value=False))
        self.enterContext(mock.patch.object(runner, "ROOT", self.repo))
        self.enterContext(mock.patch.object(runner, "environment_preflight"))
        self.held = self.enterContext(mock.patch.object(slots, "held", wraps=slots.held))

    def run_main(self, *arguments):
        seen = []

        def suite(*_args, **_kwargs):
            seen.append(os.environ.get(slots.HELD_VARIABLE))
            return True, 1, []

        with mock.patch.object(runner, "run_local_suite", side_effect=suite), \
                redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            code = runner.main(list(arguments))
        return code, seen

    def test_full_takes_every_slot_and_reuse_takes_none(self):
        code, seen = self.run_main("--scope", "full")
        self.assertEqual(code, 0)
        self.assertEqual(seen, [str(os.getpid())])
        self.assertEqual(self.held.call_args.args[0], 2)
        self.assertEqual(self.held.call_args.kwargs["scope"], "full")
        self.held.reset_mock()
        self.assertEqual(self.run_main("--scope", "tooling")[0], 0)
        self.held.assert_not_called()

    def test_a_domain_run_takes_one_slot_and_honours_the_variable(self):
        os.environ[slots.SLOTS_VARIABLE] = "3"
        code, _ = self.run_main("--scope", "checks")
        self.assertEqual(code, 0)
        self.assertEqual((self.held.call_args.args[0], self.held.call_args.kwargs["total"]), (1, 3))

    def test_a_timed_out_wait_runs_nothing(self):
        with mock.patch.object(slots, "WAIT_SECONDS", 0), \
                mock.patch.object(slots, "held", side_effect=slots.SlotTimeout("busy")):
            code, seen = self.run_main("--scope", "checks")
        self.assertEqual((code, seen), (2, []))

    def test_isolated_reruns_take_a_slot_unless_the_run_already_holds_one(self):
        seen = []

        def spawn(*_args, **_kwargs):
            seen.append(os.environ.get(slots.HELD_VARIABLE))
            return subprocess.CompletedProcess([], 0)

        rows = [{"test": "test_scan.ScanTests.test_a", "file": "test_scan", "outcome": "fail"}]
        with mock.patch.object(runner, "rerun_selectors", return_value=["test_scan"]),                 mock.patch.object(runner, "report_flaky"), redirect_stdout(io.StringIO()):
            self.assertTrue(runner.rerun_failures(rows, spawn=spawn))
            self.assertEqual((self.held.call_args.args[0], self.held.call_args.kwargs["scope"]), (1, "rerun"))
            self.held.reset_mock()
            with self.hold(2):
                self.assertTrue(runner.rerun_failures(rows, spawn=spawn))
            self.held.assert_called_once()
        self.assertEqual(seen, [str(os.getpid())] * 2)

    def test_the_full_suite_lock_queues_without_a_limit_by_default(self):
        lock = evidence.evidence_dir(self.repo) / "full-suite.lock"
        errors = io.StringIO()
        with ThreadPoolExecutor(max_workers=1) as pool, redirect_stderr(errors),                 mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])),                 redirect_stdout(io.StringIO()):
            with evidence.held(lock, scope="integrate"):
                waiter = pool.submit(runner.main, ["--scope", "full"])
                self.until(lambda: "full-suite.lock" in errors.getvalue())
                time.sleep(0.5)
                self.assertFalse(waiter.done(), "默认不设 30 分钟上限，一直排队")
            self.assertEqual(waiter.result(timeout=60), 0)
        self.assertNotIn("inf", errors.getvalue())

    def test_an_invalid_slot_count_is_rejected_before_running(self):
        os.environ[slots.SLOTS_VARIABLE] = "zero"
        with self.assertRaises(SystemExit) as raised, redirect_stderr(io.StringIO()):
            runner.main(["--scope", "checks"])
        self.assertEqual(raised.exception.code, 2)
