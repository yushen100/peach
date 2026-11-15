"""模拟答不上的挂载：落在指定目录下的 stat、列目录、打开文件一直不返回，用例结束才放开。"""

from __future__ import annotations

import contextlib
import io
import os
import threading
import time
from unittest.mock import patch

from peach import media_io


@contextlib.contextmanager
def stalled_mount(*roots, timeout: float = 0.2):
    """让 `roots` 下的读取卡住，请求路径的期限缩到 `timeout` 秒。

    产出一个列表，记下被卡住的路径。退出时放开卡住的读取，并等它们收尾，
    免得 `media_io.bounded` 记着的卡住状态漏到下一个用例。
    """
    prefixes = [os.path.normcase(os.path.abspath(os.fspath(root))) for root in roots]
    release = threading.Event()
    caught: list[str] = []
    real_stat, real_scandir, real_open = os.stat, os.scandir, io.open
    real_isfile, real_exists = os.path.isfile, os.path.exists

    def blocked(target) -> bool:
        if isinstance(target, int):
            return False
        try:
            text = os.path.normcase(os.path.abspath(os.fspath(target)))
        except TypeError:
            return False
        if any(text == prefix or text.startswith(prefix.rstrip(os.sep) + os.sep) for prefix in prefixes):
            caught.append(text)
            release.wait(30)
            return True
        return False

    def stat(target, *args, **kwargs):
        blocked(target)
        return real_stat(target, *args, **kwargs)

    def scandir(target=".", *args, **kwargs):
        blocked(target)
        return real_scandir(target, *args, **kwargs)

    def opened(target, *args, **kwargs):
        blocked(target)
        return real_open(target, *args, **kwargs)

    def isfile(target):
        blocked(target)
        return real_isfile(target)

    def exists(target):
        blocked(target)
        return real_exists(target)

    with contextlib.ExitStack() as stack:
        stack.enter_context(patch.object(media_io, "REQUEST_TIMEOUT_SECONDS", timeout, create=True))
        stack.enter_context(patch("os.stat", stat))
        stack.enter_context(patch("os.scandir", scandir))
        stack.enter_context(patch("io.open", opened))
        stack.enter_context(patch("builtins.open", opened))
        stack.enter_context(patch("os.path.isfile", isfile))
        stack.enter_context(patch("os.path.exists", exists))
        try:
            yield caught
        finally:
            release.set()
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        with getattr(media_io, "_bounded_lock", contextlib.nullcontext()):
            if not getattr(media_io, "_bounded_stuck", None) and not getattr(media_io, "_bounded_active", None):
                break
        time.sleep(0.01)


def elapsed(call, *args, **kwargs):
    """调一次 `call`，返回 (耗时秒数, 结果或抛出的异常)。"""
    started = time.monotonic()
    try:
        result = call(*args, **kwargs)
    except Exception as error:  # 用例自己断言异常类型
        result = error
    return time.monotonic() - started, result


__all__ = ["elapsed", "stalled_mount"]
