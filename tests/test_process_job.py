import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

from peach import process_job
from peach.process_job import assign_to_job, close_job, create_kill_on_close_job

ROOT = Path(__file__).resolve().parents[1]

#: 一个最小的「托盘」：用真的 ServiceManager 拉起一个睡着的子服务，报出它的 PID 后原地等着被杀。
TRAY_STAND_IN = """
import sys, time
from pathlib import Path
from unittest import mock
from peach.tray import ServiceManager, ServiceSpec

spec = ServiceSpec("http", "http://127.0.0.1:9/healthz",
                   (sys.executable, "-c", "import time; time.sleep(120)"), True)
manager = ServiceManager((spec,), log_dir=Path(sys.argv[1]),
                         health_get=mock.Mock(side_effect=OSError("down")))
manager.start_missing()
print(manager._owned["http"].pid, flush=True)
time.sleep(120)
"""


def descendants(root: int) -> set[int]:
    from peach.windows_restart import _process_paths_and_parents
    _paths, parents = _process_paths_and_parents()
    found, frontier = set(), [root]
    while frontier:
        current = frontier.pop()
        for process_id, parent in parents.items():
            if parent == current and process_id not in found:
                found.add(process_id)
                frontier.append(process_id)
    return found


def open_for_wait(pid: int) -> int:
    """按 PID 开一个只带 `SYNCHRONIZE` 的进程句柄，开不到返回 0。

    句柄在手里，进程对象就不会被回收，PID 复用冒充不了结果。
    """
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
    return kernel32.OpenProcess(0x00100000, False, pid) or 0


def still_running(handles: dict[int, int], seconds: float) -> set[int]:
    """在期限内等这些进程对象进入 signaled 状态，返回期限到了还没 signaled 的 PID。

    判据是 signaled，不是 `process_alive`：它看的退出码在内核拆句柄表之前就写好了，
    进程被 Job 终止后有一段时间退出码已不是 `STILL_ACTIVE`，句柄表却还没拆，
    日志文件照样被占着，`TemporaryDirectory` 这时删目录就报 WinError 32。
    进程对象要等句柄表拆完才 signaled，所以等到它，文件句柄一定已经放掉。
    """
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.WaitForSingleObject.restype = wintypes.DWORD
    kernel32.WaitForSingleObject.argtypes = (wintypes.HANDLE, wintypes.DWORD)
    deadline = time.monotonic() + seconds
    survivors = set()
    for pid, handle in handles.items():
        remaining = max(0, int((deadline - time.monotonic()) * 1000))
        if kernel32.WaitForSingleObject(handle, remaining) != 0:
            survivors.add(pid)
    return survivors


def close_handle(handle: int) -> None:
    import ctypes
    from ctypes import wintypes

    ctypes.WinDLL("kernel32", use_last_error=True).CloseHandle(wintypes.HANDLE(handle))


def wait_until(predicate, seconds: float = 10.0) -> bool:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.1)
    return predicate()


@unittest.skipUnless(os.name == "nt", "Job Object 是 Windows 能力，其余平台三个函数都是空操作")
class KillOnCloseJobTests(unittest.TestCase):
    def sleeper(self) -> subprocess.Popen:
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"],
                                 creationflags=subprocess.CREATE_NO_WINDOW)
        self.addCleanup(lambda: child.poll() is None and child.kill())
        return child

    def test_closing_the_job_ends_the_processes_in_it(self):
        child = self.sleeper()
        job = create_kill_on_close_job()
        self.assertIsNotNone(job)
        assign_to_job(job, child)
        close_job(job)
        self.assertIsNotNone(child.wait(timeout=10))

    def test_a_force_killed_tray_takes_its_services_along(self):
        """`Stop-Process -Force` 打托盘时收尾代码一行不跑，只有内核关 Job 句柄这一步还在。

        2026-09-25 就是这样留下两棵孤儿服务，继续占着 80/443 跑旧代码。
        """
        with tempfile.TemporaryDirectory() as directory:
            environment = {**os.environ, "PYTHONPATH": str(ROOT / "src"),
                           "PEACH_DATA_ROOT": directory}
            tray = subprocess.Popen(
                [sys.executable, "-c", TRAY_STAND_IN, directory], stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL, text=True, encoding="utf-8", env=environment,
                creationflags=subprocess.CREATE_NO_WINDOW)
            self.addCleanup(lambda: tray.poll() is None and tray.kill())
            service = int(tray.stdout.readline())
            # venv 的 python.exe 是个转发器，真正的解释器是它再起的子进程。
            wait_until(lambda: descendants(service))
            owned = {tray.pid, service} | descendants(tray.pid) | descendants(service)
            handles = {pid: open_for_wait(pid) for pid in owned}
            for handle in handles.values():
                if handle:
                    self.addCleanup(close_handle, handle)
            self.assertTrue(all(handles.values()), f"强杀前就开不到这些服务进程：{handles}")
            tray.kill()
            tray.wait(timeout=10)
            tray.stdout.close()
            # 托盘解释器和服务都持有日志句柄；整棵进程树 signaled 后才能删临时目录。
            survivors = still_running(handles, seconds=10)
            self.assertFalse(survivors, f"托盘被强杀后这些进程还活着：{sorted(survivors)}")


#: 子进程起一个继承输出管道的孙进程，记下孙进程 PID 后自己要么睡着、要么先退出。
HOLDS_PIPE = """
import subprocess, sys, time
grandchild = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
open(sys.argv[1], "w").write(str(grandchild.pid))
print("started", flush=True)
if sys.argv[2] == "stay":
    time.sleep(60)
"""


class BoundedRunTests(unittest.TestCase):
    def test_success_returns_the_output_like_subprocess_run(self):
        completed = process_job.run([sys.executable, "-c", "print('ok')"], timeout=30,
                                    capture_output=True, text=True)
        self.assertEqual((completed.returncode, completed.stdout.strip()), (0, "ok"))
        with self.assertRaises(subprocess.CalledProcessError):
            process_job.run([sys.executable, "-c", "raise SystemExit(3)"], timeout=30, check=True)

    def holding_pipe(self, mode: str):
        """超时后整棵树都被收掉，调用在期限内返回，不被孙进程占着的管道挂住。"""
        import psutil
        directory = Path(self.enterContext(tempfile.TemporaryDirectory()))
        marker = directory / "grandchild.pid"
        outcome = {}

        def call():
            try:
                process_job.run([sys.executable, "-c", HOLDS_PIPE, str(marker), mode], timeout=3,
                                capture_output=True, text=True)
            except subprocess.TimeoutExpired as error:
                outcome["error"] = error

        def cleanup():
            try:
                psutil.Process(int(marker.read_text())).kill()
            except (OSError, ValueError, psutil.Error):
                pass
        self.addCleanup(cleanup)
        worker = threading.Thread(target=call, daemon=True)
        started = time.monotonic()
        worker.start()
        worker.join(30)
        self.assertFalse(worker.is_alive(), "超时后还在等孙进程占着的输出管道")
        self.assertIsInstance(outcome.get("error"), subprocess.TimeoutExpired)
        self.assertLess(time.monotonic() - started, 3 + process_job.REAP_SECONDS + 10)
        self.assertIn("started", outcome["error"].output or "")
        grandchild = int(marker.read_text())
        self.assertTrue(wait_until(lambda: not psutil.pid_exists(grandchild)
                                   or psutil.Process(grandchild).status() == psutil.STATUS_ZOMBIE),
                        "孙进程还活着")

    def test_a_grandchild_holding_the_pipe_is_killed_on_timeout(self):
        self.holding_pipe("stay")

    def test_an_orphaned_grandchild_holding_the_pipe_is_killed_on_timeout(self):
        """子进程自己先退出，只剩孙进程占着管道：标准库的 `run` 这时会一直等。"""
        self.holding_pipe("exit")


if __name__ == "__main__":
    unittest.main()
