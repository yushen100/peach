"""本机软件更新偏好与定时检查，复用发行查询和下载事务。

后台线程睡到「上次检查 + 间隔」；检查完、手动检查或改设置时叫醒重排。记录文件与文件锁
扛重启，也让托盘和子服务共用一个到期点。
"""
from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path

from filelock import FileLock, Timeout

from . import distribution, interface_text, release_updates, standalone_update
from .fsutil import atomic_write_text
from .user_messages import UserValueError

LOGGER = logging.getLogger(__name__)
#: 另一个服务正持锁检查时，隔这么久再看它写下的检查时间。
LOCK_RETRY_SECONDS = 60.0
#: 长等待按墙钟复核：Windows 的等待超时不计睡眠时间，睡醒后最晚这么久补上到期的检查。
WALL_CLOCK_RECHECK = 3600.0
#: 服务启动后先等这么久再做第一次检查，不和启动抢网络；改设置或手动检查会提前叫醒。
STARTUP_DELAY_SECONDS = 60.0
#: 关停时最多等在途的一轮检查这么久，让它放下文件锁；网络卡住时不再等。
STOP_JOIN_SECONDS = 5.0


class AutomaticUpdates:
    def __init__(self, root: Path, *, available: bool):
        self.path = root / "automatic-updates.json"
        self.available = available
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def read(self) -> dict:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            if (not isinstance(data, dict) or data.get("mode") not in ("off", "check", "download")
                    or type(data.get("interval_hours")) is not int or data["interval_hours"] not in (6, 24, 168)):
                raise ValueError("invalid settings")
            return data
        except FileNotFoundError:
            return {"mode": "check", "interval_hours": 24}
        except (OSError, ValueError):
            return {"mode": "off", "interval_hours": 24, "error": interface_text.text("server:errors.automaticUpdates.unreadable"),
                    "error_code": "errors.automaticUpdates.unreadable"}

    def snapshot(self) -> dict:
        data = self.read()
        result = data.get("result")
        if isinstance(result, dict):
            if (data.get('listing_rule') == release_updates.LISTING_RULE
                    and result.get("current_version") == release_updates.snapshot()["current_version"]):
                data["result"] = dict(result, checked_at=data.get("checked_at"))
            else:
                data.pop("result")
        data.pop('listing_rule', None)
        return dict(data, available=self.available, download_available=distribution.in_app_update())

    def remember(self, result: dict) -> None:
        """手动检查与后台检查共享最近一次结果。"""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with FileLock(str(self.path) + ".lock", timeout=0):
                data = self.read()
                data.pop("error", None)
                data.pop("error_code", None)
                self.write(dict(data, checked_at=time.time(), result=result,
                                listing_rule=release_updates.LISTING_RULE))
        except Timeout:
            return
        self._wake.set()

    def write(self, data: dict) -> None:
        atomic_write_text(self.path, json.dumps(data, ensure_ascii=False))

    def save(self, body: dict) -> dict:
        if not self.available:
            raise UserValueError("errors.automaticUpdates.needsTray")
        mode, hours = body.get("mode"), body.get("interval_hours")
        if mode not in ("off", "check", "download"):
            raise UserValueError("errors.automaticUpdates.chooseMode")
        if type(hours) is not int or hours not in (6, 24, 168):
            raise UserValueError("errors.automaticUpdates.chooseInterval")
        if mode == "download" and not distribution.in_app_update():
            raise UserValueError("errors.automaticUpdates.downloadUnsupported")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with FileLock(str(self.path) + ".lock", timeout=0):
            current = self.read()
            if current.get("mode") == mode and current.get("interval_hours") == hours and not current.get("error"):
                return self.snapshot()
            self.write({"mode": mode, "interval_hours": hours})
        self._wake.set()
        return self.snapshot()

    @staticmethod
    def _remaining(data: dict, now: float) -> float:
        """距下次检查的秒数；没有可信的上次检查时间或已经到期时为 0。"""
        interval = data["interval_hours"] * 3600
        last = data.get("checked_at", 0) if data.get('listing_rule') == release_updates.LISTING_RULE else 0
        if isinstance(last, (int, float)) and 0 <= now - last < interval:
            return last + interval - now
        return 0.0

    def tick(self) -> float | None:
        """到期就检查一次，返回距下次到期的秒数；关闭或不可用时返回 None，等改设置叫醒。"""
        if not self.available:
            return None
        data = self.read()
        if data["mode"] == "off":
            return None
        # 没到期不取锁也不写文件。
        remaining = self._remaining(data, time.time())
        if remaining > 0:
            return remaining
        try:
            with FileLock(str(self.path) + ".lock", timeout=0):
                data = self.read()
                if data["mode"] == "off":
                    return None
                now = time.time()
                remaining = self._remaining(data, now)
                if remaining > 0:
                    return remaining
                if data.get('listing_rule') != release_updates.LISTING_RULE:
                    data.pop('result', None)
                # 先落检查时间；进程中断后也按频率重试，多服务共用这一份记录。
                self.write(dict(data, checked_at=now, listing_rule=release_updates.LISTING_RULE))
                result = release_updates.check()
                data.pop("error", None)
                data.pop("error_code", None)
                data = dict(data, checked_at=now, result=result, listing_rule=release_updates.LISTING_RULE)
                self.write(data)
                # 以前在 macOS 独立包上存下的「自动下载」只按检查处理：那里没有应用内安装。
                if data["mode"] == "download" and distribution.in_app_update() and result["state"] == "available":
                    job = standalone_update.public()
                    if job["state"] not in standalone_update.ACTIVE | {"ready"}:
                        try:
                            standalone_update.start()
                        except (ValueError, Timeout) as exc:
                            self.write(dict(data, error=str(exc)))
                return data["interval_hours"] * 3600.0
        except Timeout:
            return LOCK_RETRY_SECONDS

    def _run(self) -> None:
        self._wake.wait(STARTUP_DELAY_SECONDS)
        while not self._stop.is_set():
            # 先清再算：算的过程中改了设置，下面的等待会立即返回。
            self._wake.clear()
            try:
                delay = self.tick()
            except Exception:
                LOGGER.exception("Automatic update check failed")
                delay = LOCK_RETRY_SECONDS
            self._wake.wait(None if delay is None else min(delay, WALL_CLOCK_RECHECK))

    def start(self) -> None:
        if self.available and self._thread is None and not self._stop.is_set():
            self._thread = threading.Thread(target=self._run, name="PeachAutomaticUpdates", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        """叫停后台线程并等在途的一轮收尾，最多 `STOP_JOIN_SECONDS`。"""
        self._stop.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join(STOP_JOIN_SECONDS)
