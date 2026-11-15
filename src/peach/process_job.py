"""随句柄关闭一并终止成员的 Windows Job Object。

父进程被强杀时不会走自己的收尾代码，子进程于是成了孤儿，继续占着端口或留在公网上转发。
把子进程挂进一个 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 的 Job，句柄随父进程退出由内核关闭，
成员随之一并终止，不管父进程是怎么死的。托盘的 `peach serve` 子服务与服务里的
cloudflared 都用这一份。非 Windows 上这几个 Job 函数都是空操作。

`run` 是带期限、超时杀整棵进程树的 `subprocess.run`：子进程挂进普通 Job（POSIX 上是新会话），
超时就终止整个 Job 或进程组，再按期限回收输出。
"""
from __future__ import annotations

import ctypes
import os
import signal
import subprocess

__all__ = ["REAP_SECONDS", "assign_to_job", "close_job", "create_job", "create_kill_on_close_job",
           "run", "terminate_job"]

#: 超时杀掉进程树之后，回收输出最多再等这么久。
REAP_SECONDS = 5.0

_JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000
#: JobObjectExtendedLimitInformation
_JOB_EXTENDED_LIMIT_CLASS = 9


def create_kill_on_close_job():
    """建一个随句柄关闭一并终止成员的 Job Object；非 Windows 或建不成时返回 None。

    句柄不可继承：子进程要是继承了它，Job 就要等到最后一个子进程退出才关，
    父进程死了成员也不会被收走。
    """
    if os.name != "nt":
        return None
    from ctypes import wintypes

    class _IoCounters(ctypes.Structure):
        _fields_ = [(name, ctypes.c_ulonglong) for name in (
            "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
            "ReadTransferCount", "WriteTransferCount", "OtherTransferCount",
        )]

    class _BasicLimits(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_longlong),
            ("PerJobUserTimeLimit", ctypes.c_longlong),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
        ]

    class _ExtendedLimits(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", _BasicLimits),
            ("IoInfo", _IoCounters),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.CreateJobObjectW.argtypes = (wintypes.LPVOID, wintypes.LPCWSTR)
    job = kernel32.CreateJobObjectW(None, None)
    if not job:
        return None
    limits = _ExtendedLimits()
    limits.BasicLimitInformation.LimitFlags = _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel32.SetInformationJobObject(
        wintypes.HANDLE(job), _JOB_EXTENDED_LIMIT_CLASS,
        ctypes.byref(limits), ctypes.sizeof(limits),
    ):
        kernel32.CloseHandle(wintypes.HANDLE(job))
        return None
    return job


def assign_to_job(job, process) -> None:
    """把一个 `subprocess.Popen` 挂进 Job；挂不上照样放行。

    内核拒绝嵌套 Job 时子进程仍然在跑，调用方自己的停止路径照旧收得掉它，
    只是少了强杀时的那层兜底。
    """
    if job is None or os.name != "nt":
        return
    handle = getattr(process, "_handle", None)
    if handle is None:
        return
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    try:
        kernel32.AssignProcessToJobObject(wintypes.HANDLE(job), wintypes.HANDLE(int(handle)))
    except (OSError, ValueError, TypeError):
        pass


def close_job(job) -> None:
    """关掉 Job 句柄；这一下就会终止里面还活着的成员。"""
    if job is None or os.name != "nt":
        return
    from ctypes import wintypes

    try:
        ctypes.WinDLL("kernel32", use_last_error=True).CloseHandle(wintypes.HANDLE(job))
    except (OSError, ValueError):
        pass


def create_job():
    """建一个普通 Job：关句柄不终止成员，只在 `terminate_job` 时一并终止；非 Windows 或建不成时返回 None。

    正常结束时不该连带杀掉子进程有意留下的后台进程，所以不设 kill-on-close。
    """
    if os.name != "nt":
        return None
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.CreateJobObjectW.argtypes = (wintypes.LPVOID, wintypes.LPCWSTR)
    return kernel32.CreateJobObjectW(None, None) or None


def terminate_job(job) -> None:
    """终止 Job 里所有还活着的成员，包括父进程已经退出、脱离了进程树的孙进程。"""
    if job is None or os.name != "nt":
        return
    from ctypes import wintypes

    try:
        ctypes.WinDLL("kernel32", use_last_error=True).TerminateJobObject(wintypes.HANDLE(job), 1)
    except (OSError, ValueError):
        pass


def _kill_tree(process: subprocess.Popen, job) -> None:
    terminate_job(job)
    if os.name != "nt":
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            # 进程组已空；macOS 上只剩未回收的僵尸时报 EPERM。
            pass
    try:
        process.kill()
    except OSError:
        pass


def _reap(process: subprocess.Popen, job):
    """杀掉整棵进程树，按 `REAP_SECONDS` 回收输出；回收不了就不再等。

    杀不掉的后代（挂进 Job 之前就起来、又脱离了进程组的那种）还占着输出管道时，
    Windows 上读管道的是 `communicate` 起的守护线程，丢下它们不挡进程退出。
    """
    _kill_tree(process, job)
    try:
        return process.communicate(timeout=REAP_SECONDS)
    except subprocess.TimeoutExpired:
        return None, None


def run(command, *, timeout: float, input=None, capture_output: bool = False, check: bool = False,
        **kwargs) -> subprocess.CompletedProcess:
    """与 `subprocess.run` 相同，但超时时杀掉整棵进程树，回收输出也有期限。

    标准库超时只杀直接子进程，Windows 上随后的 `communicate()` 没有期限：`git fetch` 起的
    `git-remote-https`、PowerShell 起的测试进程还占着输出管道，调用方就一直等下去。
    超时照旧抛 `subprocess.TimeoutExpired`。
    """
    if capture_output:
        if kwargs.get("stdout") is not None or kwargs.get("stderr") is not None:
            raise ValueError("stdout and stderr arguments may not be used with capture_output.")
        kwargs["stdout"] = kwargs["stderr"] = subprocess.PIPE
    if input is not None:
        if kwargs.get("stdin") is not None:
            raise ValueError("stdin and input arguments may not both be used.")
        kwargs["stdin"] = subprocess.PIPE
    if os.name != "nt":
        kwargs.setdefault("start_new_session", True)
    job = create_job()
    try:
        process = subprocess.Popen(command, **kwargs)
    except BaseException:
        close_job(job)
        raise
    try:
        assign_to_job(job, process)
        try:
            stdout, stderr = process.communicate(input, timeout=timeout)
        except subprocess.TimeoutExpired:
            stdout, stderr = _reap(process, job)
            raise subprocess.TimeoutExpired(process.args, timeout, output=stdout, stderr=stderr) from None
        except BaseException:
            _reap(process, job)
            raise
    finally:
        close_job(job)
    completed = subprocess.CompletedProcess(process.args, process.returncode, stdout, stderr)
    if check:
        completed.check_returncode()
    return completed
