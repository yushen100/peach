"""模拟永不退出的子进程：它起的孙进程也占着输出管道，用来验证超时会收掉整棵进程树。"""

from __future__ import annotations

import os
import sys
import threading
from pathlib import Path


def hanging_program(directory: Path) -> Path:
    """在 `directory` 里写一个永不退出的可执行文件，返回它的路径。

    它起的 Python 又起一个孙进程，都继承输出管道；孙进程 PID 写进同目录的 `grandchild.pid`。
    Windows 上是 `.cmd`，经 `cmd.exe` 再多一层进程。
    """
    script = directory / "hang.py"
    script.write_text(
        "import subprocess, sys, time\n"
        "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])\n"
        f"open({str(directory / 'grandchild.pid')!r}, 'w').write(str(child.pid))\n"
        "print('started', flush=True)\n"
        "time.sleep(60)\n", encoding="utf-8")
    interpreter = getattr(sys, "_base_executable", sys.executable)
    if os.name == "nt":
        program = directory / "hang.cmd"
        program.write_text(f'@"{interpreter}" "{script}" %*\r\n', encoding="utf-8")
    else:
        program = directory / "hang.sh"
        program.write_text(f'#!/bin/sh\n"{interpreter}" "{script}"\n', encoding="utf-8")
        program.chmod(0o755)
    return program


def grandchild_alive(directory: Path) -> bool:
    """`hanging_program` 起的孙进程是否还活着；没起来也算不活着。"""
    import psutil
    try:
        process = psutil.Process(int((directory / "grandchild.pid").read_text()))
        return process.status() != psutil.STATUS_ZOMBIE
    except (OSError, ValueError, psutil.Error):
        return False


def kill_grandchild(directory: Path) -> None:
    """清理用：实现没收掉进程树时，别让孙进程留下来占着临时目录。"""
    import psutil
    try:
        psutil.Process(int((directory / "grandchild.pid").read_text())).kill()
    except (OSError, ValueError, psutil.Error):
        pass


def finishes_within(call, seconds: float):
    """在线程里调用，期限内没返回就判失败，不让卡住的实现拖住整个测试进程。"""
    outcome: dict = {}

    def target():
        try:
            outcome["value"] = call()
        except BaseException as error:  # 交回调用方线程再抛
            outcome["error"] = error

    worker = threading.Thread(target=target, daemon=True)
    worker.start()
    worker.join(seconds)
    if worker.is_alive():
        raise AssertionError(f"{seconds} 秒内没有返回")
    if "error" in outcome:
        raise outcome["error"]
    return outcome["value"]
