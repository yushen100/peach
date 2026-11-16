from __future__ import annotations

if __name__ == "__main__":
    from . import error_reporting
    error_reporting.install()

import argparse
import ctypes
import errno
import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import httpx
import pystray
from PIL import Image

from . import (desktop_startup, error_reporting, interface_text, ledger_backups, log_retention, onboarding,
               retention_settings, runtime_prepare, settings_file, sparkle_update)
from .appid import MACOS_LAUNCH_AGENT_LABEL
from .certs import ensure_certificate
from .distribution import standalone
from .config import (
    DATABASE_PATH, LOG_DIR, MDNS_HOSTNAME, PROJECT_ROOT, REPLICATION_ENABLED,
    SECRETS_DIR, SHARED_DATABASE_PATH, SHARED_SMB_HOST, SHARED_SMB_SHARE,
    SHARED_SMB_USER, STATE_DIR,
)
from .listening import is_loopback, loopback_origin_host
from .mdns import lan_ipv4
from .netwatch import NetworkChangeWatcher
from .mount import mount_share as mount_smb_share
from . import process_job
from .process_job import assign_to_job, create_kill_on_close_job
from .tray_diagnostics import show_report as show_diagnostic_report
from .tray_lifecycle import Lifecycle
from .tray_detached import handoff_tray
from .sync import COPY_ACTIONS, SyncPlan, device_id, resolve
from .versioning import VersionManager, VersionSnapshot
from .windows_update import (
    PendingWindowsUpdate, WindowsUpdateInstaller, windows_tray_rebuild_required,
    sweep_onefile_extractions,
)


LOGGER = logging.getLogger(__name__)


def tray_text(code: str, /, **params) -> str:
    """托盘菜单、通知与弹窗上的一句（`tray.*`），按本机语言渲染：`PEACH_LANGUAGE` 优先，其次系统显示语言。"""
    return interface_text.text(f"server:{code}", params, interface_text.local_language())


def _clauses(items) -> str:
    """几句短说明连成一句（中文用「；」）。"""
    return tray_text("tray.clauseSeparator").join(items)


#: macOS 菜单栏项拉起的端口。80/443 在 macOS 上要 root，开发机不该为一个菜单栏图标
#: 去要管理员权限；本机 CA 的那套 TLS 材料也是给 Windows 生产实例签的。
MACOS_PORT = 8900
#: HTTPS 同理，443 也要 root，所以走 8443。
MACOS_TLS_PORT = 8443
#: LaunchAgent 的标签。托盘、安装脚本和 `.app` 外壳共用 `peach.appid` 这一处定义。
LAUNCH_AGENT_LABEL = MACOS_LAUNCH_AGENT_LABEL

#: 本地领先远端、或者根本连不上远端时，`update()` 给出的这几种状态。这台机器既是开发机
#: 又是生产机，提交先落本地再推 GitHub，所以它们才是常态，`updated` 反而几乎不出现。
#: 托盘要不要重建与远端无关，只取决于 EXE 里那份代码和当前检出差了什么。
LOCAL_REBUILD_STATES = ("ahead", "current", "error", "unconfigured")

#: 自动检查托盘是否比检出旧的间隔。健康轮询每 10 秒一轮，构建陈旧不需要那个频率：
#: 这一步要跑几条 git，5 分钟一次既跟得上一次集成，也不会让 git 常驻在磁盘上。
BUILD_CHECK_INTERVAL = 300.0


def ledger_menu_items(make_item, sync_ledger, take_ownership) -> list:
    """两个 Ledger 菜单项；`replication.enabled = false` 时一个都不装配。

    单机部署没有第二份账本，这两项点下去只会去探一个不存在的共享传输点，
    然后回一句「盘不可达」——那不是状态，是这台机器根本不做复制（ADR-0023 第 3 阶段）。
    标签在两个平台上共用这一处定义，`make_item` 负责套上各自的菜单项类型。
    """
    if not REPLICATION_ENABLED or standalone():
        return []
    return [
        make_item(tray_text("tray.menu.syncLedger"), sync_ledger),
        make_item(tray_text("tray.menu.takeOwnership"), take_ownership),
    ]

#: 改到这些路径就得重启托盘进程本身。托盘启动那一刻就把它们装进了内存，重启子服务
#: 追不上——「同步开发进度」之后菜单还是旧的，正是这个原因。
TRAY_SOURCES = (
    "src/peach/tray.py",
    "src/peach/tray_detached.py",
    "src/peach/tray_lifecycle.py",
    "src/peach/tray_diagnostics.py",
    "src/peach/menubar.py",
    "src/peach/versioning.py",
    "src/peach/sync.py",
    "src/peach/certs.py",
    "src/peach/netwatch.py",
    "src/peach/config.py",
    "src/peach/settings_file.py",
    "pyproject.toml",
)


#: `/healthz?ready=1` 各项检查给人看的名字（`peach.health.readiness`）。
READINESS_CODES = {
    "configured": "tray.readiness.configured", "web": "tray.readiness.web", "database": "tray.readiness.database",
    "schema": "tray.readiness.schema",
}

#: 托盘拉起的整托盘重启脚本最多等多久。脚本停旧托盘、同步依赖、起新托盘各有期限，
#: 本托盘还活着地等过这么久，说明脚本卡在停托盘之前，菜单动作锁要放开。
TRAY_RESTART_WAIT = 300.0
#: 「同步 Ledger」那次 `peach ledger-sync` 的期限。它跑时服务停着、托盘操作锁被占着，
#: 自愈每一轮都在跳过；超时收掉整棵进程树，照常把服务拉回来。复制走原子替换，被打断不留半份账本。
LEDGER_SYNC_SECONDS = 1800.0
#: `launchctl print` 与 `kickstart` 的期限。
LAUNCHCTL_SECONDS = 30.0


def _service_state(ok: bool, detail: str, *, detailed: bool) -> str:
    """一个服务的状态词；`detailed` 时正常的也带上说明（挂载提醒）。"""
    if ok:
        return tray_text("tray.health.okDetail", detail=detail) if detailed and detail else tray_text("tray.health.ok")
    return tray_text("tray.health.failedDetail", detail=detail) if detail else tray_text("tray.health.failed")


def menu_text(value: str, limit: int = 48) -> str:
    """原生菜单不折行；详细路径留在配置页，菜单中的每行限制宽度。"""
    text = " ".join(value.split())
    return text if len(text) <= limit else text[:limit - 1] + "…"


def tray_restart_required(changed_paths: tuple[str, ...]) -> bool:
    """这次更新动没动托盘自己的代码。"""
    return any(path in TRAY_SOURCES for path in changed_paths)


def enable_hidpi() -> str:
    """Enable native sharp Win32 menus before pystray creates any windows."""
    if os.name != "nt":
        return "not-windows"
    try:
        setter = ctypes.windll.user32.SetProcessDpiAwarenessContext
        setter.argtypes = [ctypes.c_void_p]
        setter.restype = ctypes.c_bool
        if setter(ctypes.c_void_p(-4)):  # DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
            return "per-monitor-v2"
    except (AttributeError, OSError):
        pass
    try:
        result = ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
        if result in (0, -2147024891):  # S_OK or E_ACCESSDENIED (already set)
            return "per-monitor"
    except (AttributeError, OSError):
        pass
    try:
        if ctypes.windll.user32.SetProcessDPIAware():
            return "system"
    except (AttributeError, OSError):
        pass
    return "unavailable"


@dataclass(frozen=True)
class ServiceSpec:
    name: str
    health_url: str
    command: tuple[str, ...]
    verify: bool | str


class AlreadyRunning(RuntimeError):
    pass


class SingleInstance:
    """交互式托盘/菜单栏项的进程级单实例锁。"""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._handle = None

    def acquire(self) -> None:
        """进程生命周期内的单实例锁。

        Windows 用 `msvcrt.locking`，POSIX 用 `fcntl.flock`——两者都在进程退出时由
        内核释放，所以强杀之后不会留下一把解不开的锁。没有这层保护的话，菜单栏里会
        出现两个 Peach，各自再拉起一份服务去抢同一个端口。
        """
        if os.name == "nt":
            self._acquire_windows()
        else:
            self._acquire_posix()

    def is_running(self) -> bool:
        """只读探测现有锁；探测结束即释放，不创建文件或接管实例。"""
        try:
            handle = self.path.open("rb")
        except FileNotFoundError:
            return False
        with handle:
            try:
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBRLCK, 1)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except OSError as error:
                if error.errno in (errno.EACCES, errno.EAGAIN, errno.EDEADLK):
                    return True
                raise
        return False

    def _acquire_posix(self) -> None:
        import fcntl

        self.path.parent.mkdir(parents=True, exist_ok=True)
        handle = self.path.open("a+b")
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            handle.close()
            raise AlreadyRunning("Peach tray is already running") from exc
        self._handle = handle

    def _acquire_windows(self) -> None:
        import msvcrt

        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._handle = self.path.open("r+b") if self.path.exists() else self.path.open("w+b")
        if self.path.stat().st_size == 0:
            self._handle.write(b"0")
            self._handle.flush()
        self._handle.seek(0)
        try:
            msvcrt.locking(self._handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            self._handle.close()
            self._handle = None
            raise AlreadyRunning("Peach tray is already running") from exc

    def close(self) -> None:
        if self._handle is None:
            return
        if os.name == "nt":
            import msvcrt

            self._handle.seek(0)
            try:
                msvcrt.locking(self._handle.fileno(), msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
        self._handle.close()
        self._handle = None

    def relocate(self, path: Path) -> None:
        """先取得目标目录的锁，再释放当前目录的锁。"""
        if self.path == path:
            return
        replacement = SingleInstance(path)
        replacement.acquire()
        self.close()
        self.path, self._handle = replacement.path, replacement._handle
        replacement._handle = None


class ServiceManager:
    def __init__(
        self,
        specs: tuple[ServiceSpec, ...],
        *,
        popen: Callable[..., subprocess.Popen] = subprocess.Popen,
        health_get: Callable[..., httpx.Response] = httpx.get,
        run: Callable[..., subprocess.CompletedProcess] = process_job.run,
        ledger_plan: Callable[[], SyncPlan] | None = None,
        mount_share: Callable[[], bool] | None = None,
        log_dir: Path | None = None,
        extra_env: dict[str, str] | None = None,
    ) -> None:
        self.specs = specs
        # 日志目录与子进程环境可替换：首次设置完成后 Peach 数据目录可能换了地方，那之后拉起的
        # 服务必须把日志写进新 Peach 数据目录，也必须显式看到新的 PEACH_DATA_ROOT——托盘进程
        # 自己的模块常量还停在启动那一刻。
        self._log_dir = Path(log_dir) if log_dir is not None else LOG_DIR
        self._extra_env = dict(extra_env or {})
        self._popen = popen
        self._health_get = health_get
        self._run = run
        self._ledger_plan = ledger_plan or self._current_ledger_plan
        self._mount_share = mount_share or self._mount_shared_root
        self._owned: dict[str, subprocess.Popen] = {}
        self._starting: set[str] = set()
        # 子服务都挂进这个 Job：托盘被强杀时句柄由内核关闭，整棵 `peach serve` 一起收掉，
        # 不会留下孤儿继续占着 80/443，让下一份托盘见端口健康就不拉自己的。
        self._job = None
        self._last_health: dict[str, tuple[bool, str]] = {
            spec.name: (False, tray_text("tray.health.notChecked")) for spec in specs
        }
        self._mount_warnings: dict[str, tuple[str, ...]] = {}
        # 拉起取证：诊断包要答得出「为什么拉起、拉起后多久才应答」。`_launched_at` 记本托盘
        # 拉起子进程的时刻，`_awaiting_ready` 是拉起后还没通过过健康检查的服务，
        # `_failures` 是自上次健康或拉起以来的连续失败（次数、首次失败时刻、最后一次的错误）。
        self._launched_at: dict[str, float] = {}
        self._awaiting_ready: set[str] = set()
        self._failures: dict[str, tuple[int, float, str]] = {}
        self._lock = threading.RLock()

    def healthy(self, spec: ServiceSpec) -> bool:
        # trust_env=False：健康检查永远直连回环。代理客户端（Stash 等）会设置系统级
        # HTTP 代理，httpx 默认读它（urllib.getproxies 在 macOS 走系统配置），于是
        # 探测 http://127.0.0.1 的请求被送进代理、由代理回 503——服务明明活着，
        # 状态却显示「未运行」。实测 Stash 开着时就是这样，HTTPS 探测不受影响。
        warnings: tuple[str, ...] = ()
        error = ""
        try:
            response = self._health_get(
                spec.health_url, timeout=0.5, verify=spec.verify, trust_env=False,
            )
            # 已经能应答的服务进入正常健康判定；503 或坏响应不能一直算「启动中」。
            with self._lock:
                self._starting.discard(spec.name)
            payload = response.json()
            ok = response.status_code == 200 and payload.get("ok") is True
            detail = "" if ok else tray_text("tray.health.statusCode", code=response.status_code)
            error = "" if ok else f"HTTP {response.status_code}"
            if ok and isinstance(payload.get("media_mounts"), dict):
                values = payload["media_mounts"].get("warnings", [])
                if isinstance(values, list):
                    warnings = tuple(value for value in values if isinstance(value, str) and value.strip())
                    detail = _clauses(value[:120] for value in warnings[:3])
        except (httpx.HTTPError, OSError, ValueError, AttributeError) as exc:
            # 日志只记异常类名：超时（ConnectTimeout/ReadTimeout）和没在听（ConnectError）
            # 由类名分得开，异常文本里的地址不进日志。
            ok, detail, error = False, tray_text("tray.health.noResponse"), f"no response ({type(exc).__name__})"
        ready_after = None
        with self._lock:
            self._last_health[spec.name] = (ok, detail)
            self._mount_warnings[spec.name] = warnings
            if ok:
                self._failures.pop(spec.name, None)
                if spec.name in self._awaiting_ready:
                    self._awaiting_ready.discard(spec.name)
                    ready_after = time.monotonic() - self._launched_at[spec.name]
            else:
                count, since, _ = self._failures.get(spec.name, (0, time.monotonic(), ""))
                self._failures[spec.name] = (count + 1, since, error)
        if ready_after is not None:
            LOGGER.info("%s service passed its first health check %.1f s after launch", spec.name, ready_after)
        return ok

    def _failure_summary(self, name: str) -> str:
        """自上次健康（或上次拉起、停止）以来的连续健康检查失败，写进拉起与超时日志。"""
        with self._lock:
            failure = self._failures.get(name)
        if failure is None:
            return "no failed health checks before this"
        count, since, error = failure
        return (f"{count} consecutive failed health checks over {time.monotonic() - since:.1f} s, "
                f"last: {error}")

    @property
    def log_dir(self) -> Path:
        return self._log_dir

    def starting_services(self) -> tuple[str, ...]:
        """尚未应答、且本托盘刚拉起的进程仍活着的服务。"""
        with self._lock:
            return tuple(name for name in self._starting
                         if name in self._owned and self._owned[name].poll() is None)

    def waiting_for_startup(self) -> bool:
        with self._lock:
            down = {spec.name for spec in self.specs if not self._last_health[spec.name][0]}
            return bool(down) and down <= set(self.starting_services())

    def status(self) -> str:
        """菜单里那一行状态：每个服务逐个点名，正常的和异常的都写出来。

        只说「未运行」或「部分运行」没法行动——HTTP 和 HTTPS 各自会因为端口占用、
        证书过期、pf 转发写错等完全不同的原因挂掉。异常的附带最近一次探测的失败原因。
        """
        with self._lock:
            parts = []
            for spec in self.specs:
                ok, detail = self._last_health[spec.name]
                state = _service_state(ok, detail, detailed=True)
                if not ok and spec.name in self.starting_services():
                    state = tray_text("tray.health.starting")
                parts.append(f"{spec.name.upper()} {state}")
        return " · ".join(parts)

    def status_summary(self) -> str:
        """两种托盘共用的短状态；同一个挂载提醒不因 HTTP/HTTPS 重复计数。"""
        with self._lock:
            healthy = sum(self._last_health[spec.name][0] for spec in self.specs)
            warnings = set(value for spec in self.specs
                           for value in self._mount_warnings.get(spec.name, ()))
            state = tray_text(("tray.status.running" if healthy == len(self.specs) else "tray.status.partial")
                              if healthy else "tray.status.down")
            if self.waiting_for_startup():
                state = tray_text("tray.health.starting")
        return tray_text("tray.status.withWarnings", state=state, count=len(warnings)) if warnings else state

    def status_details(self) -> tuple[str, ...]:
        """服务与挂载分行呈现，避免一行堆入所有来源。"""
        with self._lock:
            services = []
            for spec in self.specs:
                ok, detail = self._last_health[spec.name]
                state = _service_state(ok, detail, detailed=False)
                if not ok and spec.name in self.starting_services():
                    state = tray_text("tray.health.starting")
                services.append(menu_text(f"{spec.name.upper()} {state}"))
            warnings = dict.fromkeys(value for spec in self.specs
                                     for value in self._mount_warnings.get(spec.name, ()))
        return tuple(services + [menu_text(value) for value in warnings])

    def replace_specs(
        self, specs: tuple[ServiceSpec, ...], *, log_dir: Path | None = None,
        extra_env: dict[str, str] | None = None,
    ) -> None:
        """换掉这一组服务规格。先停掉旧的那组，调用方随后 `start_missing()`。

        首次设置完成时走这条路：引导服务停下，正常的 HTTP/HTTPS 顶上，托盘进程不重启。
        """
        self.stop_owned()
        with self._lock:
            self.specs = tuple(specs)
            if log_dir is not None:
                self._log_dir = Path(log_dir)
            if extra_env is not None:
                self._extra_env = dict(extra_env)
            self._last_health = {spec.name: (False, tray_text("tray.health.notChecked")) for spec in self.specs}
            self._mount_warnings.clear()
            self._failures.clear()

    def child_environment(self) -> dict[str, str]:
        environment = os.environ.copy()
        if getattr(sys, "frozen", False):
            # A frozen tray must not pass its one-file bootloader state to Peach.exe.
            environment["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
        environment.update(self._extra_env)
        environment["PEACH_TRAY_MANAGED"] = "1"
        return environment

    def start_missing(self, *, reason: str = "unspecified") -> None:
        """拉起不健康、又不在本托盘手里跑着的服务；`reason` 是调用方写进日志的拉起原因。

        本托盘拉起、还活着的子进程不论健康与否都跳过：这里不会因为健康检查失败去重拉
        一个活着的进程。拉起日志另附这里自己看到的事实：上一个子进程的退出码与运行时长，
        或本托盘手里没有子进程，以及此前的连续健康检查失败。
        """
        self._log_dir.mkdir(parents=True, exist_ok=True)
        environment = self.child_environment()
        with self._lock:
            for spec in self.specs:
                owned = self._owned.get(spec.name)
                exit_code = owned.poll() if owned is not None else None
                if owned is not None and exit_code is None:
                    continue
                if self.healthy(spec):
                    if owned is None:
                        logging.getLogger(__name__).warning(
                            "A healthy service is already on the %s port but was not launched by this tray; not taking it over", spec.name)
                    continue
                if owned is None:
                    observed = "this tray has no child process for the service"
                else:
                    launched = self._launched_at.get(spec.name)
                    ran = f", ran {time.monotonic() - launched:.1f} s" if launched is not None else ""
                    readiness = "never passed a health check" if spec.name in self._awaiting_ready else "had passed health checks"
                    observed = f"previous child process exited with code {exit_code}{ran}, {readiness}"
                failures = self._failure_summary(spec.name)
                if self._job is None:
                    self._job = create_kill_on_close_job()
                # 日志句柄交给子进程后父进程这一份就关掉：服务反复被补拉时不会越攒越多。
                creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                with (self._log_dir / f"tray-{spec.name}.out.log").open("ab") as stdout, \
                        (self._log_dir / f"tray-{spec.name}.err.log").open("ab") as stderr:
                    process = self._popen(
                        list(spec.command),
                        cwd=str(PROJECT_ROOT),
                        stdin=subprocess.DEVNULL,
                        stdout=stdout,
                        stderr=stderr,
                        shell=False,
                        creationflags=creationflags,
                        env=environment,
                    )
                assign_to_job(self._job, process)
                self._owned[spec.name] = process
                self._starting.add(spec.name)
                self._launched_at[spec.name] = time.monotonic()
                self._awaiting_ready.add(spec.name)
                self._failures.pop(spec.name, None)
                logging.getLogger(__name__).info(
                    "Launched %s service, PID %s; reason: %s; %s; %s",
                    spec.name, getattr(process, "pid", "?"), reason, observed, failures)

    def wait_until_ready(self, timeout: float = 20.0) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if all(self.healthy(spec) for spec in self.specs):
                return True
            time.sleep(0.25)
        # 等待窗口到期不停服务，健康监测会继续跟进；首次通过时 `healthy` 另记总耗时。
        with self._lock:
            pending = [(name, time.monotonic() - self._launched_at[name])
                       for name in sorted(self._awaiting_ready)]
        for name, elapsed in pending:
            LOGGER.info("%s service still failing health checks %.1f s after launch; the %.0f s wait has expired; %s",
                        name, elapsed, timeout, self._failure_summary(name))
        return False

    def stop_owned(self, name: str | None = None) -> None:
        """停掉自己拉起来的服务。给 `name` 就只停那一个（证书重签后只需重启 HTTPS）。"""
        with self._lock:
            if name is None:
                processes = list(self._owned.values())
                self._owned.clear()
                stopped = [spec.name for spec in self.specs]
            else:
                process = self._owned.pop(name, None)
                processes = [process] if process is not None else []
                stopped = [name]
            for key in stopped:
                self._starting.discard(key)
                if key in self._last_health:
                    self._last_health[key] = (False, tray_text("tray.health.stopped"))
                launched = self._launched_at.pop(key, None)
                if key in self._awaiting_ready and launched is not None:
                    LOGGER.info("Stopping %s service %.1f s after launch; it never passed a health check",
                                key, time.monotonic() - launched)
                self._awaiting_ready.discard(key)
                self._failures.pop(key, None)
        for process in processes:
            if process.poll() is None:
                process.terminate()
        for process in processes:
            if process.poll() is not None:
                continue
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)

    def restart(self, prepare: Callable[[], object] | None = None, *, reason: str = "unspecified") -> bool:
        """停掉自己的子服务，`prepare` 在它们都停着时执行（迁移），再拉起来等就绪。"""
        self.stop_owned()
        if prepare is not None:
            prepare()
        self.start_missing(reason=reason)
        return self.wait_until_ready()

    def readiness_problems(self) -> list[str]:
        """逐个问 `/healthz?ready=1`，返回没就绪的那几条；全就绪返回空列表。

        只有 API 服务报 `ready`：80 口的跳转服务忽略这个参数、只回 `ok`，没有 `ready`
        字段的回应不算数。`healthy()` 看的是 `ok`，账本结构落后时服务照样回 `ok`，
        所以这里另问一遍，校验方式与健康检查相同（项目 CA）。
        """
        problems: list[str] = []
        for spec in self.specs:
            try:
                response = self._health_get(
                    f"{spec.health_url}?ready=1", timeout=3.0, verify=spec.verify,
                    trust_env=False,
                )
                payload = response.json()
            except (httpx.HTTPError, OSError, ValueError, AttributeError) as exc:
                problems.append(tray_text("tray.readiness.noResponse", service=spec.name.upper(), error=exc))
                continue
            if not isinstance(payload, dict) or "ready" not in payload:
                continue
            if payload.get("ready") is not True:
                checks = payload.get("checks") or {}
                failed = [tray_text(READINESS_CODES[key]) if key in READINESS_CODES else key
                          for key, ok in checks.items() if not ok]
                detail = (tray_text("tray.listSeparator").join(failed)
                          or tray_text("tray.health.statusCode", code=response.status_code))
                problems.append(tray_text("tray.readiness.notReady", service=spec.name.upper(), detail=detail))
        return problems

    @staticmethod
    def _current_ledger_plan() -> SyncPlan:
        return resolve(DATABASE_PATH, SHARED_DATABASE_PATH, device_id(STATE_DIR))

    @staticmethod
    def _mount_shared_root() -> bool:
        """把共享副本所在的盘挂回来；不是 macOS 或挂不上都返回 False。"""
        return mount_smb_share(SHARED_SMB_HOST, SHARED_SMB_SHARE, SHARED_SMB_USER)

    def _ledger_plan_after_mount(self) -> SyncPlan:
        """判定一次；共享盘没挂就补挂一次再判。

        macOS 重启后 SMB 共享不会自己回来，`offline` 因此是本机的日常状态而不是结论：
        在此之前菜单栏只能回一句「盘不可达」，而手动挂一下同一条同步链路立刻就通。
        挂不上时原样返回那个 offline 判定，调用方照旧降级到那条消息。
        只有 `offline` 才试挂载——判定已经通了还去碰挂载，是一次白跑的网络往返。
        """
        decision = self._ledger_plan()
        if decision.action != "offline" or not self._mount_share():
            return decision
        return self._ledger_plan()

    def _ledger_shortcut(self, *, take_ownership: bool) -> tuple[bool, str] | None:
        """这次同步会不会真的复制？不会就别停服务。

        不能无条件停服务、跑一遍 CLI、再启回来。共享盘没挂（`offline`）或者本机压根
        不是写入端（`conflict`）时，那一停一启换来的只有一次白白的停机和一条
        「同步失败」通知——而这就是本机的日常状态：`/Volumes/peach-sync` 没挂时，
        点一次「同步 Ledger」网页就断十几秒，然后告诉你盘不可达。

        「接管 Ledger 写入」只在共享盘不可达时短路：它要求两侧 `in-sync`，而 `in-sync`
        对同步是无事可做、对接管却正是要做的那一次。

        判定走 `_ledger_plan_after_mount`：`offline` 先当成「盘掉了」补挂一次再重判，
        真挂不上才落到下面这条降级消息。
        """
        try:
            decision = self._ledger_plan_after_mount()
        except OSError as exc:                     # 判定本身失败也不该拖着服务停机
            return False, tray_text("tray.ledger.undecidable", error=exc)
        if take_ownership:
            if decision.action == "offline":
                return False, tray_text("tray.ledger.notTakenOver", reason=decision.reason)
            return None
        if decision.action in COPY_ACTIONS:
            return None
        if decision.action in ("offline", "conflict", "missing"):
            return False, tray_text("tray.ledger.notSynced", reason=decision.reason)
        return True, tray_text("tray.ledger.result", action=decision.action, reason=decision.reason)

    def sync_ledger(
        self, executable: Path | None = None, *, take_ownership: bool = False,
    ) -> tuple[bool, str]:
        """停掉本托盘拥有的服务，单次同步后恢复；不碰别的进程拥有的服务。

        复制关掉时直接拒绝：菜单项本来就不装配，但托盘可以被其他入口调用，
        而这条路径会去探测一个这台机器根本没有的共享传输点。
        """
        if not REPLICATION_ENABLED:
            return False, tray_text("tray.ledger.replicationOff")
        shortcut = self._ledger_shortcut(take_ownership=take_ownership)
        if shortcut is not None:
            return shortcut
        with self._lock:
            external = []
            for spec in self.specs:
                owned = self._owned.get(spec.name)
                if self.healthy(spec) and (owned is None or owned.poll() is not None):
                    external.append(spec.name.upper())
        if external:
            return False, tray_text("tray.ledger.external", services="/".join(external))

        peach = executable or _peach_executable()
        self.stop_owned()
        try:
            creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            command = [
                str(peach), "ledger-sync", "--db", str(DATABASE_PATH),
                "--shared-db", str(SHARED_DATABASE_PATH),
            ]
            if take_ownership:
                command.append("--take-ownership")
            sync_environment = self.child_environment()
            # Windows 上 Python 的 stdout 被管道捕获时默认使用 ANSI code page
            #（简中系统是 GBK），而父进程按 UTF-8 解码。明确约定子进程输出 UTF-8，
            # 不能只锁定父进程的 decoding，否则中文通知会全部变成替换字符。
            sync_environment["PYTHONIOENCODING"] = "utf-8"
            result = self._run(
                command,
                cwd=str(PROJECT_ROOT), stdin=subprocess.DEVNULL, capture_output=True, text=True,
                encoding="utf-8", errors="replace", shell=False,
                env=sync_environment, timeout=LEDGER_SYNC_SECONDS,
                creationflags=creationflags,
            )
            output = (result.stdout or result.stderr or tray_text("tray.ledger.noOutput")).strip()
            ok = result.returncode == 0
        except subprocess.TimeoutExpired as exc:
            ok, output = False, tray_text("tray.ledger.timedOut", seconds=f"{exc.timeout:g}")
        except (OSError, subprocess.SubprocessError) as exc:
            ok, output = False, tray_text("tray.ledger.startFailed", error=exc)
        finally:
            self.start_missing(reason="restore after taking over writes" if take_ownership else "restore after database sync")
            ready = self.wait_until_ready()
        if not ready:
            return False, tray_text("tray.ledger.notRecovered", output=output)
        return ok, output


#: venv 里放可执行文件的目录与后缀。Windows 是 `Scripts\\peach.exe`，POSIX 是 `bin/peach`。
_BIN_DIR = "Scripts" if os.name == "nt" else "bin"
_EXECUTABLE = "peach.exe" if os.name == "nt" else "peach"


def _peach_executable() -> Path:
    from .distribution import standalone
    if standalone():
        return Path(sys.executable).resolve()
    if getattr(sys, "frozen", False):
        # 打包出来的托盘不是可移动的独立发行版：它仍然把服务进程的所有权交给项目 venv，
        # 因为 one-file bootloader 在本 Python 构建上再拉起一个 one-file 进程并不安全。
        # 逐级向上找 .venv，而不是写死 parents[2]——换个输出目录就不该整套失效。
        for parent in Path(sys.executable).resolve().parents:
            managed = parent / ".venv" / _BIN_DIR / _EXECUTABLE
            if managed.is_file():
                return managed
    sibling = Path(sys.executable).with_name(_EXECUTABLE)
    if sibling.is_file():
        return sibling
    candidate = PROJECT_ROOT / ".venv" / _BIN_DIR / _EXECUTABLE
    if candidate.is_file():
        return candidate
    raise FileNotFoundError(f"{_EXECUTABLE} is missing; reinstall the editable project")


def spawn_tray_restart(
    log_path: Path, *, popen: Callable[..., subprocess.Popen] = subprocess.Popen,
    root: Path = PROJECT_ROOT,
) -> subprocess.Popen:
    """从托盘里分离地拉起 `restart_windows_tray.py --source --force`。

    脚本要比本托盘活得久：它给本托盘发停止消息，等本托盘与子服务退净后同步依赖，再起
    新托盘。所以不挂进子服务那个 kill-on-close Job。`--force`：点「重启服务」本来就要停
    子服务，任务闸门在这条路上不拦。输出追加进 `log_path`，脚本没走到停托盘那一步就退出
    时，托盘从最后一行读出原因。
    """
    python = root / ".venv" / _BIN_DIR / ("python.exe" if os.name == "nt" else "python")
    script = root / "scripts" / "restart_windows_tray.py"
    for required in (python, script):
        if not required.is_file():
            raise FileNotFoundError(f"the full tray restart needs {required}")
    environment = os.environ.copy()
    environment["PYTHONIOENCODING"] = "utf-8"
    flags = 0
    if os.name == "nt":
        flags = (subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
                 | subprocess.CREATE_NEW_PROCESS_GROUP)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("ab") as output:
        return popen(
            [str(python), "-X", "utf8", str(script), "--source", "--force"],
            cwd=str(root), stdin=subprocess.DEVNULL, stdout=output,
            stderr=subprocess.STDOUT, shell=False, env=environment, creationflags=flags,
        )


def last_reported_message(log_path: Path) -> str | None:
    """重启脚本最后一行输出里的 `message`；不是 JSON 就原样返回那一行。"""
    try:
        lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return None
    for line in reversed(lines):
        text = line.strip()
        if not text:
            continue
        try:
            return str(json.loads(text).get("message") or text)
        except (ValueError, AttributeError):
            return text[-runtime_prepare.OUTPUT_TAIL:]
    return None


@dataclass(frozen=True)
class TrayPreparation:
    """托盘那一侧的运行环境准备（ADR-0091），由 `main()` 装配后交给 `PeachTray`。

    不注入就什么都不做：测试里的托盘不会去碰真实账本，macOS 菜单栏也不走这里。
    `dependencies` 只读核对（`check()`），`migrations` 在子服务停着时真跑（`apply()`）。
    """

    dependencies: object
    migrations: object
    state_dir: Path
    restart_log: Path
    spawn_restart: Callable[[], subprocess.Popen]


def tray_preparation(config, manager: "ServiceManager") -> TrayPreparation:
    database = config.directory("database") / "ledger.db"
    state = config.directory("state")
    restart_log = config.directory("logs") / "tray-restart.out.log"
    return TrayPreparation(
        dependencies=runtime_prepare.Dependencies(PROJECT_ROOT),
        migrations=runtime_prepare.Migrations(
            database, peach=_peach_executable,
            writer=lambda: runtime_prepare.configured_ledger_writer(
                config, language=interface_text.local_language()),
            environ=manager.child_environment,
        ),
        state_dir=state,
        restart_log=restart_log,
        spawn_restart=lambda: spawn_tray_restart(restart_log),
    )


def build_macos_service_specs(
    *,
    tls_dir: Path | None = None,
    mdns_hostname: str | None = None,
) -> tuple[ServiceSpec, ...]:
    """macOS 用非特权端口起 HTTP，有 TLS 材料时再加一个 HTTPS。

    80/443 在 macOS 上要 root，所以服务本身跑在 8900/8443，由 pf 把 80/443 转过去
    （`scripts/setup_macos_port80.sh`）。不钉 `--mdns-address`：这台机器会换网络，
    钉死等于换个 Wi-Fi 就打不开（见 `peach.mdns` 的地址复查）。

    证书缺失时**只是不起 HTTPS**，不像 Windows 那样直接报错——macOS 这份是开发环境，
    没有本机 CA 也应该能用。

    两条服务都 `--ipv4-only`：pf 的 80/443 转发规则只写了 `inet`，IPv6 客户端连
    `peach.local:443` 不会被转到 8443，发布 AAAA 记录只会让它连到一个没人监听的端口。

    `mdns_hostname` 是明文口跳转的目标主机名，缺省取 `MDNS_HOSTNAME`；首次设置之后
    必须由调用方传入新鲜读到的名字，理由见 `build_service_specs`。
    """
    peach = str(_peach_executable())
    redirect_origin = f"https://{mdns_hostname or MDNS_HOSTNAME}"
    specs = [
        ServiceSpec(
            "http",
            f"http://127.0.0.1:{MACOS_PORT}/healthz",
            (
                peach, "serve", "--host", "127.0.0.1", "--port", str(MACOS_PORT),
                "--no-ledger-sync", "--no-mdns",
            ),
            True,
        ),
    ]
    cert_dir = Path(tls_dir) if tls_dir is not None else SECRETS_DIR / "tls"
    ca, cert, key = (cert_dir / n for n in
                     ("peach-local-ca.crt", "peach.crt", "peach.key"))
    if all(path.is_file() for path in (ca, cert, key)):
        specs[0] = ServiceSpec(
            "http", f"http://127.0.0.1:{MACOS_PORT}/healthz",
            (peach, "serve", "--host", "0.0.0.0", "--ipv4-only", "--port", str(MACOS_PORT),
             "--redirect-origin", redirect_origin), True,
        )
        specs.append(ServiceSpec(
            "https",
            # 健康检查走回环，不走局域网地址。走 `peach.local` 会先解析到本机的
            # 局域网 IP，那条路径要穿过 pf 的转发规则，连接慢到几秒、还会超时，
            # 于是服务在跑却被判成「未运行」。证书的 SAN 已经包含 127.0.0.1
            # （见 scripts/setup_local_tls.sh），主机名校验照样成立。
            f"https://127.0.0.1:{MACOS_TLS_PORT}/healthz",
            (
                peach, "serve", "--host", "0.0.0.0", "--ipv4-only", "--port", str(MACOS_TLS_PORT),
                "--no-ledger-sync",
                "--ssl-certfile", str(cert), "--ssl-keyfile", str(key),
            ),
            str(ca),
        ))
    return tuple(specs)


def build_service_specs(
    lan_address: str | None = None,
    *,
    tls_dir: Path | None = None,
    mdns_hostname: str | None = None,
) -> tuple[ServiceSpec, ...]:
    """正常服务的两条规格：明文口只做跳转，HTTPS 那条承载全部应用。

    `mdns_hostname` 缺省取 `MDNS_HOSTNAME`，那是 import 期就按当时的设置文件定型的。
    首次设置刚让人填过 `[server].mdns_name`，托盘进程里的常量却还是旧值，跳转会把人
    送到一个不存在的 `.local` 名下——所以 `SetupGate.poll` 必须传入新鲜读到的名字。

    HTTPS 监听所有网卡（IPv4 与 IPv6 双栈），`--mdns-address` 只钉住发布的 IPv4；
    同网卡的 IPv6 由 mDNS 以 AAAA 记录一并发布。健康检查仍走局域网 IPv4，证书覆盖它。
    """
    if sys.platform == "darwin":
        return build_macos_service_specs(tls_dir=tls_dir, mdns_hostname=mdns_hostname)
    address = lan_address or os.environ.get("PEACH_LAN_ADDRESS") or lan_ipv4()
    peach = str(_peach_executable())
    redirect_origin = f"https://{mdns_hostname or MDNS_HOSTNAME}"
    cert_dir = Path(tls_dir) if tls_dir is not None else SECRETS_DIR / "tls"
    ca = cert_dir / "peach-local-ca.crt"
    cert = cert_dir / "peach.crt"
    key = cert_dir / "peach.key"
    missing = [path for path in (ca, cert, key) if not path.is_file()]
    if missing:
        raise FileNotFoundError("TLS material is missing: " + ", ".join(map(str, missing)))
    return (
        ServiceSpec(
            "http",
            "http://127.0.0.1/healthz",
            (
                peach, "serve", "--host", "0.0.0.0", "--port", "80",
                "--redirect-origin", redirect_origin,
            ),
            True,
        ),
        ServiceSpec(
            "https",
            f"https://{address}/healthz",
            (
                peach, "serve", "--host", "0.0.0.0", "--port", "443", "--mdns-address", address,
                "--no-ledger-sync",
                "--ssl-certfile", str(cert), "--ssl-keyfile", str(key),
            ),
            str(ca),
        ),
    )


#: 引导服务这条规格的名字。它和 `http`/`https` 互斥：托盘要么在等人填表单，
#: 要么在跑正常服务，不会两者同时。
SETUP_SPEC_NAME = "setup"


def needs_setup(config) -> bool:
    """这台机器还得先走一遍首次设置吗。

    判据不是 `config.configured`，而是「没有设置文件，也没有账本」。Peach 数据目录本身
    不算数：托盘的单实例锁一启动就会在 Peach 数据目录下建出 `state/`，而 `discover_data_root`
    只看目录在不在——只用 `configured` 的话，一次失败的托盘启动就足以让下一次启动
    认为这台机器已经配置好，然后照旧倒在缺 TLS 材料上。反过来，还没生成过
    `config.toml` 的老部署账本是在的，不能被拖进首次设置。
    """
    if standalone():
        return not config.present
    if config.present:
        return False
    return not (config.directory("database") / "ledger.db").is_file()


def build_setup_service_specs(config) -> tuple[ServiceSpec, ...]:
    """首次设置的引导服务：只绑回环、无 TLS、无口令、不发布 mDNS。

    不能用正常规格：全新机器上 `build_service_specs()` 会因为缺 TLS 材料直接抛错，
    而 macOS 那条即使起得来，`peach serve --host 0.0.0.0` 也会被 `_serve_token`
    以「没有口令」拒掉。这条服务的安全边界就是那个绑定地址——回环之外够不着它。
    """
    peach = str(_peach_executable())
    port = config.server.port
    return (
        ServiceSpec(
            SETUP_SPEC_NAME,
            f"http://127.0.0.1:{port}/healthz",
            (
                peach, "serve", "--setup", "--host", "127.0.0.1", "--port", str(port),
                "--no-mdns", "--no-ledger-sync",
            ),
            True,
        ),
    )


def setup_url(config) -> str:
    return f"http://{loopback_origin_host(config.server.host)}:{config.server.port}/"


def normal_hostname(config) -> str:
    """这台机器对外的 `<mdns_name>.local`，同一局域网里两台机器必须不同名。

    名字取新鲜读到的设置，不用 import 期就定型的 `MDNS_HOSTNAME`：首次设置里那一题
    正是它。菜单里的地址和明文口的跳转目标都走这一处，两边不能各算各的。
    """
    return f"{config.server.mdns_name}.local"


def normal_url(config) -> str:
    """正常服务的固定地址。macOS 上 80/443 由 pf 转到高位端口
    （scripts/setup_macos_port80.sh）。
    """
    from .distribution import standalone
    if standalone():
        return setup_url(config)
    return f"https://{normal_hostname(config)}/"


def configured_service_specs(config) -> tuple[ServiceSpec, ...]:
    """独立测试包按设置文件启动服务；源码入口沿用其生命周期。

    独立包不接管 80/443，也不要求安装本机 CA：局域网模式直接在用户填写的高位端口
    提供 HTTP，并发布带端口的 mDNS 服务。托盘自己仍从回环地址打开和做健康检查，
    不把本机操作绕去网卡、代理或 mDNS。
    """
    from .distribution import standalone
    if not standalone():
        return build_service_specs(tls_dir=config.directory("secrets") / "tls",
                                   mdns_hostname=normal_hostname(config))
    return (ServiceSpec("http", setup_url(config) + "healthz",
                        (str(_peach_executable()), "serve", "--host", config.server.host,
                         "--port", str(config.server.port),
                         *(("--no-mdns",) if is_loopback(config.server.host) else ()),
                         "--no-ledger-sync"),
                        True),)


class SetupGate:
    """首次设置期间的服务切换。Windows 托盘与 macOS 菜单栏共用这一层。

    托盘不重启自己就能完成切换，因为真正读 Peach 数据目录的是**子进程**：`peach serve` 每次
    都自己读一遍设置文件。托盘进程里剩下的几处依赖都已经改成可传入——服务规格的
    TLS 目录、日志目录、子进程环境里的 `PEACH_DATA_ROOT`、菜单里的地址。账本复制那
    几个模块常量不在此列，但首次设置写出的 `replication.enabled` 恒为 false，
    对应菜单项本来就不装配。
    """

    def __init__(
        self,
        manager: ServiceManager,
        config,
        *,
        waiting: bool,
        instance: SingleInstance | None = None,
        load: Callable[[], object] = settings_file.load_config,
        popen: Callable[..., subprocess.Popen] = subprocess.Popen,
        open_browser: Callable[[str], object] = webbrowser.open,
    ) -> None:
        self.manager = manager
        self.config = config
        self._waiting = waiting
        self._instance = instance
        self._load = load
        self._popen = popen
        self._open_browser = open_browser
        #: 由各平台的托盘装上；默认丢掉，`SetupGate` 本身不认识通知机制。
        self.notify: Callable[[str, str], None] = lambda _message, _title: None

    @property
    def waiting(self) -> bool:
        return self._waiting

    def open_label(self) -> str:
        return tray_text("tray.menu.reopenSetup" if self._waiting else "tray.menu.open")

    def open_url(self) -> str:
        return setup_url(self.config) if self._waiting else normal_url(self.config)

    def status_line(self) -> str:
        if self._waiting:
            return tray_text("tray.status.waitingSetup")
        return self.manager.status_summary()

    def open(self) -> None:
        self._open_browser(self.open_url())

    def poll(self) -> bool:
        """设置完成了就切到正常服务。返回这一轮有没有切。

        由健康轮询驱动，所以每几秒问一次：设置文件是新鲜读的，不是模块常量；TLS 材料
        还没齐就原地等下一轮，而不是拿一组缺文件的规格去启动。mDNS 名同理由这里传进
        规格：明文口的跳转目标必须是人刚填的那个名字。
        """
        reload_path = self.config.directory("state") / onboarding.RELOAD_NAME
        if not self._waiting and not reload_path.is_file():
            return False
        config = self._load()
        if needs_setup(config):
            return False
        try:
            specs = configured_service_specs(config)
        except FileNotFoundError:
            return False        # CA 还没生成完（或没有 openssl），下一轮再看
        if self._instance is not None:
            self._instance.relocate(config.directory("state") / "peach-tray.lock")
        self._waiting = False
        self.config = config
        self.manager.replace_specs(
            specs, log_dir=config.directory("logs"),
            extra_env={"PEACH_DATA_ROOT": str(config.data_root)},
        )
        self.manager.start_missing(reason="first-run setup finished, switching to the regular service")
        reload_path.unlink(missing_ok=True)
        self.notify(tray_text("tray.setup.loaded", url=normal_url(config)), "Peach")
        self.start_first_scan(config)
        return True

    def start_first_scan(self, config) -> subprocess.Popen | None:
        """消费首扫标记，用子进程跑一遍 `peach process <来源>`。

        扫描不能跑在引导服务里——那个进程刚被上面停掉；也不能跑在托盘线程里——
        几万个文件要走十几分钟，会把健康轮询和菜单一起卡住。
        """
        location = onboarding.take_first_scan_request(config)
        if location is None:
            return None
        log_dir = config.directory("logs")
        log_dir.mkdir(parents=True, exist_ok=True)
        environment = self.manager.child_environment()
        environment["PEACH_DATA_ROOT"] = str(config.data_root)
        # Windows 上子进程的 stdout 被重定向时默认走 ANSI code page，扫描进度里的
        # 中文会变成替换字符；这里和账本同步用同一条约定。
        environment["PYTHONIOENCODING"] = "utf-8"
        try:
            # 句柄开着只为了交给子进程；`Popen` 复制过去之后父进程这一份立刻关掉，
            # 否则 Windows 上这个文件会被托盘一直占着，谁也删不掉它。
            with (log_dir / "tray-scan.out.log").open("ab") as handle:
                process = self._popen(
                    [str(_peach_executable()), "process", location],
                    cwd=str(PROJECT_ROOT), stdin=subprocess.DEVNULL,
                    stdout=handle, stderr=subprocess.STDOUT, shell=False,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                    env=environment,
                )
        except (OSError, subprocess.SubprocessError) as exc:
            self.notify(tray_text("tray.setup.scanFailed", error=exc), "Peach")
            return None
        self.notify(tray_text("tray.setup.scanStarted", path=log_dir / "tray-scan.out.log"), "Peach")
        return process


def create_icon(size: int = 64, *, template: bool = False) -> Image.Image:
    """Load the shared square Peach brand asset at tray resolution.

    `template=True` 返回只有形状的单色版本：macOS 菜单栏图标必须是 template image，
    由系统按浅色/深色菜单栏自己反色。彩色图标不会跟着变——浅色菜单栏下那颗桃子会
    糊成一团。形状取自原图的 alpha 通道，颜色一律置黑。
    """
    resource = Path(getattr(sys, "_MEIPASS", PROJECT_ROOT)) / "resources" / "peach-logo.png"
    if not resource.is_file():
        resource = PROJECT_ROOT / "resources" / "peach-logo.png"
    if not resource.is_file():
        raise FileNotFoundError(f"Peach logo is missing: {resource}")
    image = Image.open(resource).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    if not template:
        return image
    black = Image.new("RGBA", image.size, (0, 0, 0, 0))
    black.putalpha(image.getchannel("A"))
    return black


def apply_macos_template(icon) -> bool:
    """把菜单栏图标标成 template image。

    pystray 的 darwin 后端只做 `setImage_`，不调 `setTemplate_`，所以默认不会跟着
    系统外观反色。这里在图标已经创建之后补上；拿不到底层 NSImage 就安静跳过——
    菜单栏项本身仍然可用，只是不会自动反色。
    """
    if sys.platform != "darwin":
        return False
    image = getattr(icon, "_icon_image", None)
    setter = getattr(image, "setTemplate_", None)
    if setter is None:
        return False
    setter(True)
    return True


def show_message(title: str, message: str, *, error: bool = False) -> None:
    if os.name == "nt":
        flags = 0x10 if error else 0x40
        ctypes.windll.user32.MessageBoxW(None, message, title, flags)
    else:
        print(f"{title}: {message}")


class PeachTray:
    def __init__(
        self,
        manager: ServiceManager,
        versions: VersionManager | None = None,
        windows_updates: WindowsUpdateInstaller | None = None,
        gate: "SetupGate | None" = None,
        silent: bool = False,
        show_browser: bool = False,
        preparation: TrayPreparation | None = None,
    ) -> None:
        self.lifecycle = None
        self.manager = manager
        self.silent = silent
        self.show_browser = show_browser
        self.preparation = preparation
        self.gate = gate or SetupGate(manager, settings_file.active(), waiting=False)
        self.versions = versions or VersionManager()
        self.windows_updates = windows_updates or WindowsUpdateInstaller(
            getattr(self.versions, "root", PROJECT_ROOT),
            state_dir=STATE_DIR,
            log_dir=LOG_DIR,
        )
        self.version = self.versions.inspect()
        self._stop_event = threading.Event()
        self._action_lock = threading.Lock()
        self._diagnostics_lock = threading.Lock()
        self._build_checked_at = time.monotonic()
        self._build_attempted_head: str | None = None
        self._pending_startup: tuple[list, bool, str | None] | None = None
        version_menu = pystray.Menu(
            pystray.MenuItem(lambda _item: f"Peach {self.version.package_version}", None, enabled=False),
            pystray.MenuItem(lambda _item: self.version.build_label, None, enabled=False),
            pystray.MenuItem(lambda _item: self.version.channel_label, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(tray_text("tray.menu.checkUpdates"), self.check_updates),
        )
        self.icon = pystray.Icon(
            "Peach",
            # macOS 菜单栏要单色 template image，Windows 托盘要彩色品牌图。
            create_icon(template=sys.platform == "darwin"),
            tray_text("tray.menu.tooltip"),
            pystray.Menu(
                pystray.MenuItem(lambda _item: self.gate.open_label(), self.open, default=True),
                pystray.MenuItem(tray_text("tray.menu.configure"),
                                 lambda *_: webbrowser.open(self.gate.open_url() + "configuration")),
                pystray.MenuItem(lambda _item: tray_text("tray.menu.status", status=self.gate.status_line()),
                                 pystray.Menu(lambda: (
                                     *(pystray.MenuItem(line, None, enabled=False)
                                       for line in self.manager.status_details()),
                                     pystray.MenuItem(menu_text(tray_text("tray.menu.address", url=self.gate.open_url())),
                                                      self.open),
                                     pystray.MenuItem(tray_text("tray.menu.fullConfiguration"), lambda *_: webbrowser.open(
                                         self.gate.open_url() + "configuration")),
                                 ))),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem(tray_text("tray.menu.syncSource"), self.sync_source,
                                 visible=lambda _: not standalone()),
                *ledger_menu_items(
                    pystray.MenuItem, self.sync_ledger, self.take_ownership),
                pystray.MenuItem(tray_text("tray.menu.restart"), self.restart),
                pystray.MenuItem(tray_text("tray.menu.logs"), self.open_logs),
                pystray.MenuItem(tray_text("tray.menu.diagnostics"), self.export_diagnostics),
                pystray.MenuItem(tray_text("tray.menu.versions"), version_menu),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem(tray_text("tray.menu.quit"), self.exit),
            ),
        )

    def open(self, _icon=None, _item=None) -> None:
        # 等待首次设置时打开的是引导服务的表单，不是那个还没有人在监听的 `.local`。
        self.gate.open()

    # -- 运行环境准备（ADR-0091）------------------------------------------

    def _check_dependencies(self) -> "runtime_prepare.Step | None":
        if self.preparation is None:
            return None
        step = self.preparation.dependencies.check()
        if step.problem:
            LOGGER.warning("Dependencies: %s", step.message)
        return step

    def _migrate(self) -> "runtime_prepare.Step | None":
        """子服务停着时把账本迁到当前结构。首次设置没走完时还没有正式账本，不迁。"""
        if self.preparation is None or self.gate.waiting:
            return None
        step = self.preparation.migrations.apply()
        self._migration_failed = step.failed
        (LOGGER.error if step.failed else LOGGER.info)("Migration: %s", step.message)
        return step

    def _readiness(self) -> "runtime_prepare.Step | None":
        if self.preparation is None or self.gate.waiting:
            return None
        problems = self.manager.readiness_problems()
        if problems:
            LOGGER.error("Readiness check: %s", "; ".join(problems))
            return runtime_prepare.Step("readiness", "failed", _clauses(problems))
        return runtime_prepare.Step("readiness", "current", tray_text("tray.prepare.ready"))

    def _record(self, steps: list) -> list[str]:
        """落一份准备记录，返回要告诉人的那几条。"""
        steps = [step for step in steps if step is not None]
        if self.preparation is not None:
            try:
                runtime_prepare.record(self.preparation.state_dir, steps)
            except OSError:
                LOGGER.warning("Failed to write the runtime preparation record", exc_info=True)
        return [tray_text("tray.prepare.staleHint", message=step.message) if step.state == "stale" else step.message
                for step in steps if step.problem]

    def _complete_startup(self, ready: bool, steps: list, *, open_browser: bool = False,
                          source_commit: str | None = None) -> list[str]:
        """记录当前结果；观察窗口结束后仍在启动的服务由健康监测补齐。"""
        if ready:
            readiness = self._readiness() or runtime_prepare.Step("readiness", "current",
                                                                  tray_text("tray.prepare.ready"))
        elif self.manager.waiting_for_startup():
            readiness = runtime_prepare.Step("readiness", "pending", tray_text("tray.prepare.stillStarting"))
        else:
            readiness = runtime_prepare.Step("readiness", "failed", tray_text("tray.prepare.notStarted"))
        self._pending_startup = ((steps, open_browser, source_commit)
                                 if readiness.state == "pending" else None)
        problems = self._record([*steps, readiness])
        if readiness.state == "current":
            if source_commit is not None:
                pending = self.windows_updates.pending()
                if pending is not None and pending.commit == source_commit:
                    self.windows_updates.clear_pending()
            if open_browser:
                self.gate.open()
        return problems

    def _restart_whole_tray(self, tray_icon, reason) -> bool:
        """依赖要换就整托盘重启：本进程加载着 venv 里的 `.pyd`，活着的托盘里同步不了。

        返回 True 表示交给了重启脚本（它会停掉本托盘，或者迟迟没有结果）；False 表示
        脚本没起来或拒绝了这次重启，调用方照常只重启子服务。
        """
        tray_icon.notify(tray_text("tray.restart.syncing", reason=reason.message), "Peach")
        try:
            process = self.preparation.spawn_restart()
        except OSError as exc:
            LOGGER.error("Full tray restart could not start: %s", exc)
            tray_icon.notify(tray_text("tray.restart.spawnFailed", error=exc), "Peach")
            return False
        try:
            process.wait(timeout=TRAY_RESTART_WAIT)
        except subprocess.TimeoutExpired:
            tray_icon.notify(tray_text("tray.restart.pending"), "Peach")
            return True
        # 走到这里说明脚本已经退出、本托盘却还活着：重启被拒，或在停托盘之前就失败了。
        message = (last_reported_message(self.preparation.restart_log)
                   or tray_text("tray.restart.exitCode", code=process.returncode))
        LOGGER.error("Full tray restart did not finish: %s", message)
        tray_icon.notify(tray_text("tray.restart.incomplete", message=message), "Peach")
        return False

    def _restart_services(
        self, tray_icon, *, source_commit: str | None = None, reason: str = "unspecified",
    ) -> tuple[bool | None, list[str]]:
        """停子服务、迁移、再拉起并检查就绪。返回 (是否恢复, 要告诉人的问题)。

        依赖与锁文件不一致时先交给整托盘重启，交出去了就返回 (None, [])。
        """
        dependencies = self._check_dependencies()
        if (dependencies is not None and dependencies.state == "stale"
                and self._restart_whole_tray(tray_icon, dependencies)):
            return None, []
        migrated: list = []
        def prepare():
            step = self._migrate()
            migrated.append(step)
            if step is not None and step.failed:
                raise RuntimeError(step.message)
        self._pending_startup = None
        try:
            ready = self.manager.restart(prepare=prepare if self.preparation else None, reason=reason)
        except RuntimeError:
            return False, self._record([dependencies, *migrated])
        return ready, self._complete_startup(ready, [dependencies, *migrated], source_commit=source_commit)

    def restart(self, icon=None, _item=None) -> None:
        if not self._action_lock.acquire(blocking=False):
            return
        tray_icon = icon or self.icon

        def work() -> None:
            try:
                ready, problems = self._restart_services(tray_icon, reason="manual service restart")
                if ready is None:
                    return
                if self._stop_event.is_set():
                    self.manager.stop_owned()
                    return
                tray_icon.update_menu()
                if self._pending_startup is not None:
                    tray_icon.notify(tray_text("tray.restart.stillStarting"), "Peach")
                elif not ready:
                    tray_icon.notify(tray_text("tray.restart.notRecoveredProblems", problems=_clauses(problems))
                                     if problems else tray_text("tray.restart.notRecovered"), "Peach")
                elif problems:
                    tray_icon.notify(tray_text("tray.restart.withProblems", problems=_clauses(problems)), "Peach")
            finally:
                self._action_lock.release()

        threading.Thread(target=work, name="PeachRestart", daemon=True).start()

    def sync_ledger(self, icon=None, _item=None) -> None:
        self._run_ledger_action(icon, take_ownership=False)

    def take_ownership(self, icon=None, _item=None) -> None:
        self._run_ledger_action(icon, take_ownership=True)

    def _run_ledger_action(self, icon=None, *, take_ownership: bool) -> None:
        if not self._action_lock.acquire(blocking=False):
            return
        tray_icon = icon or self.icon
        tray_icon.notify(tray_text("tray.ledger.stoppingForTakeover" if take_ownership
                                   else "tray.ledger.stoppingForSync"), tray_text("tray.title.ledger"))

        def work() -> None:
            try:
                ok, message = self.manager.sync_ledger(take_ownership=take_ownership)
                tray_icon.update_menu()
                tray_icon.notify(message, tray_text("tray.title.ledger" if ok else "tray.title.ledgerFailed"))
            finally:
                self._action_lock.release()

        threading.Thread(target=work, name="PeachLedgerAction", daemon=True).start()

    def open_logs(self, _icon=None, _item=None) -> None:
        log_dir = self.gate.config.directory("logs")
        log_dir.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(log_dir)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.run(["open", str(log_dir)], check=False)

    def export_diagnostics(self, _icon=None, _item=None) -> None:
        from .support_bundle import save_bundle
        if not self._diagnostics_lock.acquire(blocking=False):
            return

        def work() -> None:
            try:
                path = save_bundle()
                try:
                    show_diagnostic_report(path)
                except OSError as error:
                    show_message(tray_text("tray.title.diagnostics"),
                                 tray_text("tray.diagnostics.savedOpenFailed", path=path, error=error), error=True)
            except Exception as error:
                show_message(tray_text("tray.title.diagnostics"),
                             error_reporting.failure_details("report-export", error), error=True)
            finally:
                self._diagnostics_lock.release()

        # 菜单回调及时返回；报告窗口在独立线程上使用系统自己的消息循环。
        threading.Thread(target=work, name="PeachDiagnostics", daemon=True).start()

    def check_updates(self, icon=None, _item=None) -> None:
        if not self._action_lock.acquire(blocking=False):
            return
        tray_icon = icon or self.icon
        tray_icon.notify(tray_text("tray.update.checking"), "Peach")

        def work() -> None:
            try:
                result = self.versions.check()
                self.version = result.snapshot
                tray_icon.update_menu()
                tray_icon.notify(result.message, tray_text("tray.title.versions"))
            finally:
                self._action_lock.release()

        threading.Thread(target=work, name="PeachUpdate", daemon=True).start()

    def _local_rebuild(self, snapshot: VersionSnapshot) -> tuple[PendingWindowsUpdate | None, str]:
        """打包托盘比检出旧时，就地登记一次重建；否则给出不重建的理由。

        工作区脏不拦这一步：`prepare` 跑的是检出里的代码，脏工作区里的东西本来就是要被
        构建进去的那一份。拦住它只会让托盘一直停在旧代码上，而没人在看。
        """
        if not getattr(sys, "frozen", False):
            return None, tray_text("tray.sourceSync.notFrozen")
        if standalone():
            return None, tray_text("tray.sourceSync.standalone")
        if not snapshot.build_stale:
            return None, tray_text("tray.sourceSync.buildCurrent", build=snapshot.build_label)
        paths = self.versions.stale_build_paths(snapshot.build_commit)
        if not windows_tray_rebuild_required(paths):
            return None, tray_text("tray.sourceSync.notPackaged")
        self.windows_updates.mark_pending(snapshot.commit, paths)
        return self.windows_updates.pending(), ""

    def sync_source(self, icon=None, _item=None) -> None:
        if not self._action_lock.acquire(blocking=False):
            return
        tray_icon = icon or self.icon
        tray_icon.notify(tray_text("tray.sourceSync.checking"), tray_text("tray.title.sourceSync"))

        def work() -> None:
            title = tray_text("tray.title.sourceSync")
            try:
                result = self.versions.update()
                self.version = result.snapshot
                tray_icon.update_menu()
                pending = self.windows_updates.pending()
                if result.state == "updated":
                    self.windows_updates.mark_pending(
                        result.snapshot.commit, result.changed_paths,
                    )
                    pending = self.windows_updates.pending()
                elif result.state in LOCAL_REBUILD_STATES:
                    if pending is None or pending.commit != result.snapshot.commit:
                        pending, why = self._local_rebuild(result.snapshot)
                        if pending is None:
                            tray_icon.notify(f"{result.message}\n{why}", title)
                            return
                else:
                    tray_icon.notify(result.message, title)
                    return
                if pending is None or pending.commit != result.snapshot.commit:
                    tray_icon.notify(tray_text("tray.sourceSync.pendingMismatch"), title)
                    return

                prepared = self.windows_updates.prepare(
                    pending.commit, pending.changed_paths,
                )
                if prepared.state == "failed":
                    tray_icon.notify(prepared.message, tray_text("tray.title.sourceSyncFailed"))
                    return
                if prepared.state == "replace":
                    tray_icon.notify(prepared.message, title)
                    if self.lifecycle is not None:
                        self.lifecycle.stop("source-update", os.getpid())
                    self.manager.stop_owned()
                    self._stop_event.set()
                    tray_icon.stop()
                    return

                ready, problems = self._restart_services(tray_icon, source_commit=pending.commit,
                                                         reason="restart after syncing development changes")
                if ready is None:
                    return
                if self._pending_startup is not None:
                    suffix = tray_text("tray.restart.stillStarting")
                else:
                    suffix = tray_text("tray.sourceSync.restarted" if ready else "tray.sourceSync.notRecovered")
                if problems:
                    suffix = tray_text("tray.sourceSync.withProblems", result=suffix, problems=_clauses(problems))
                tray_icon.update_menu()
                tray_icon.notify(tray_text("tray.sourceSync.done", message=prepared.message, result=suffix), title)
            finally:
                self._action_lock.release()

        threading.Thread(target=work, name="PeachSourceSync", daemon=True).start()

    def exit(self, icon=None, _item=None, *, reason="menu-exit") -> None:
        if self.lifecycle is not None:
            self.lifecycle.stop(reason, os.getpid())
        self._stop_event.set()
        self.manager.stop_owned()
        (icon or self.icon).stop()

    def poll_build_age(self, now: Callable[[], float] = time.monotonic) -> bool:
        """每 `BUILD_CHECK_INTERVAL` 秒问一次：托盘 EXE 是不是已经比检出旧了。

        判据是本地 HEAD，不 fetch：这台机器的提交先落本地再推 GitHub，等远端根本等不到。
        同一个 HEAD 只自动试一次——失败也算试过，重建要跑完整测试和一次打包，反复重试
        只会让机器空转，而失败原因不会因为多跑一遍就变。下一个 HEAD 才重新开一次机会。

        首次设置没走完时一律不动：那时候连服务都还没定型，重建换掉的是用户正在用的入口。
        """
        if not getattr(sys, "frozen", False) or standalone() or self.gate.waiting:
            return False
        moment = now()
        if moment - self._build_checked_at < BUILD_CHECK_INTERVAL:
            return False
        self._build_checked_at = moment
        head = self.versions.head_commit()
        if not head or head == self._build_attempted_head:
            return False
        snapshot = self.versions.inspect()
        self.version = snapshot
        if not snapshot.build_stale or self._action_lock.locked():
            return False
        self._build_attempted_head = head
        self.sync_source()
        return True

    def _monitor(self) -> None:
        while not self._stop_event.wait(2 if standalone() else 10):
            from .standalone_update import poll
            poll(self)
            from .desktop_uninstall import poll as poll_uninstall
            poll_uninstall(self)
            from .dev_copy_runtime import poll as poll_copy
            poll_copy(self, PROJECT_ROOT)
            from .data_storage import poll as poll_relocation
            poll_relocation(self)
            if self._stop_event.is_set():
                return
            # 先看首次设置有没有完成：切换会换掉 `manager.specs`，采样必须落在换完之后。
            if self.gate.poll() and self.preparation is not None:
                self.preparation = tray_preparation(self.gate.config, self.manager)
            down = [spec for spec in self.manager.specs if not self.manager.healthy(spec)]
            if self._pending_startup is not None and self._action_lock.acquire(blocking=False):
                try:
                    if self._pending_startup is not None:
                        steps, open_browser, source_commit = self._pending_startup
                        problems = self._complete_startup(
                            not down, steps, open_browser=open_browser, source_commit=source_commit,
                        )
                        if problems and self._pending_startup is None:
                            self.icon.notify("；".join(problems), "Peach")
                finally:
                    self._action_lock.release()
            if down:
                self.revive_services()
            self.icon.update_menu()
            self.poll_build_age()

    def revive_services(self) -> bool:
        """有服务不健康、又不在本托盘手里跑着，就补拉一份。返回这一轮有没有动手。

        被强杀的托盘留下的孤儿服务一退，端口就空着；启动时见它健康而没拉自己的那份，
        不补拉的话要等人去点「重启服务」。重启、同步账本、同步开发进度都在
        `_action_lock` 里故意停服务，拿不到锁就是有人在维护，这一轮不动。
        本托盘拉起、还活着却没应答的（刚起、正忙）由 `start_missing` 自己跳过。
        """
        if not self._action_lock.acquire(blocking=False):
            return False
        try:
            if self._stop_event.is_set() or getattr(self, '_migration_failed', False):
                return False
            self.manager.start_missing(reason="health monitor found the service unresponsive")
            return True
        finally:
            self._action_lock.release()

    def _setup(self, icon) -> None:
        icon.visible = True
        # 必须等图标真的创建出来才拿得到底层 NSImage，所以放在 setup 里而不是构造时。
        apply_macos_template(icon)
        self.gate.notify = lambda message, title: icon.notify(message, title)
        if self._startup_warning:
            icon.notify(self._startup_warning, "Peach")

    def run(self) -> None:
        # 迁移排在第一次拉起子服务之前：服务查到还没建的表就是 500。依赖只读核对，
        # 托盘自己已经加载着这个 venv，换不了包。
        startup = [self._check_dependencies(), self._migrate()]
        if not any(step is not None and step.failed for step in startup):
            self.manager.start_missing(reason="tray startup")
        # 上一次更新留下的备份与暂存构建在这里清退：替换助手结束时托盘已经不在，
        # 只有下一次启动能确认「新托盘已经活下来、旧备份可以少留一份」。
        self.windows_updates.sweep_artifacts()
        sweep_onefile_extractions()
        # 账本备份同理：每个 --apply 都留一份整库，复核过后就没人再读。规则与拒绝条件在
        # `peach.ledger_backups`；这里失败只记日志，不能因为清退不了而不起托盘。
        try:
            ledger_backups.prune(DATABASE_PATH, apply=True,
                                 keep_recent=retention_settings.backup_keep(STATE_DIR))
        except Exception:
            logging.getLogger(__name__).warning("Database backup retention cleanup failed", exc_info=True)
        self._startup_warning = None
        problems = self._complete_startup(
            self.manager.wait_until_ready(), startup,
            open_browser=(not self.silent if self.gate.waiting else self.show_browser),
        )
        if problems:
            self._startup_warning = "；".join(
                part for part in (self._startup_warning, *problems) if part)
        threading.Thread(target=self._monitor, name="PeachHealth", daemon=True).start()
        logging.getLogger(__name__).info("Tray startup finished: %s", self.manager.status())
        try:
            self.icon.run(setup=self._setup)
        finally:
            self._stop_event.set()


def launchd_owns_this_process(
    run: Callable[..., subprocess.CompletedProcess] = subprocess.run,
    *, uid: int | None = None,
) -> bool:
    """本进程是不是 LaunchAgent 拉起的那一个。

    判据是 launchd 报的 pid 等于自己的 pid，不是「plist 存在」。`kickstart -k` 只重启
    launchd 名下那一份；托盘要是从终端跑起来的，kickstart 会在旁边**再**起一个，
    菜单栏上就出现两个桃子，而旧的那个还占着单实例锁。
    """
    if uid is None:
        getuid = getattr(os, "getuid", None)
        if getuid is None:
            return False
        uid = getuid()
    try:
        result = run(
            ["launchctl", "print", f"gui/{uid}/{LAUNCH_AGENT_LABEL}"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
            timeout=LAUNCHCTL_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return False
    if result.returncode != 0:
        return False
    match = re.search(r"^\s*pid\s*=\s*(\d+)", result.stdout or "", re.MULTILINE)
    return match is not None and int(match.group(1)) == os.getpid()


def restart_tray_process(
    run: Callable[..., subprocess.CompletedProcess] = subprocess.run,
    *, uid: int | None = None,
) -> subprocess.CompletedProcess:
    """让 launchd 杀掉并重新拉起托盘。调用方必须先停掉自己拥有的服务。

    顺序不能反：先重启服务再 kickstart，新托盘会看到一组健康但不属于自己的服务，
    `_owned` 是空的，之后每次「同步 Ledger」都被自己的归属检查挡成
    「服务不归本托盘管理」。
    """
    if uid is None:
        getuid = getattr(os, "getuid", None)
        if getuid is None:
            raise OSError("launchd is unavailable on this platform")
        uid = getuid()
    command = ["launchctl", "kickstart", "-k", f"gui/{uid}/{LAUNCH_AGENT_LABEL}"]
    try:
        return run(command, capture_output=True, text=True, encoding="utf-8", errors="replace",
                   check=False, timeout=LAUNCHCTL_SECONDS)
    except subprocess.TimeoutExpired as exc:
        # 按失败返回：调用方把刚停掉的服务拉回来，不留一个没有服务的菜单栏图标。
        return subprocess.CompletedProcess(command, 124, "", str(exc))


_MACOS_DIAGNOSTICS_LOCK = threading.Lock()


def export_macos_diagnostics(notify: Callable[[str, str], None]) -> None:
    """与 Windows 托盘同一份报告；保存后在访达里选中它，不另做结果窗口。"""
    if not _MACOS_DIAGNOSTICS_LOCK.acquire(blocking=False):
        return

    def work() -> None:
        from .support_bundle import save_bundle
        try:
            path = save_bundle()
            subprocess.run(["open", "-R", str(path)], check=False)
            notify(tray_text("tray.diagnostics.saved", name=path.name), tray_text("tray.title.diagnostics"))
        except Exception as error:
            notify(error_reporting.failure_details("report-export", error), tray_text("tray.title.diagnostics"))
        finally:
            _MACOS_DIAGNOSTICS_LOCK.release()

    threading.Thread(target=work, name="PeachDiagnostics", daemon=True).start()


class MacUpdateEntry:
    """macOS 菜单栏的「检查更新」：启用 Sparkle 时由它检查、下载并在退出时替换，否则做版本检查。

    版本检查和「同步开发进度」「同步 Ledger」共用菜单栏那把动作锁；Sparkle 自己串行，不占锁。
    """

    def __init__(self, sparkle, versions: VersionManager, state: dict, lock: threading.Lock,
                 notify: Callable[[str, str], None]):
        self.sparkle, self.versions, self.state, self.lock, self.notify = sparkle, versions, state, lock, notify

    def check(self) -> None:
        # 菜单项在主线程上回调，Sparkle 可以直接调用。
        if self.sparkle is not None:
            self.sparkle.check()
        elif self.lock.acquire(blocking=False):
            threading.Thread(target=self._check_versions, name="PeachUpdate", daemon=True).start()

    def _check_versions(self) -> None:
        try:
            self.notify(tray_text("tray.update.checking"), "Peach")
            result = self.versions.check()
            self.state["snapshot"] = result.snapshot
            self.notify(result.message, tray_text("tray.title.versions"))
        finally:
            self.lock.release()

    def follow(self, state_dir: Path) -> None:
        """设置页的自动更新偏好同步给 Sparkle；没有 Sparkle 时服务进程自己定时检查。"""
        if self.sparkle is not None:
            self.sparkle.follow(state_dir)


def run_macos_menu_bar(manager: "ServiceManager", gate: "SetupGate | None" = None, *, silent: bool = False, show_browser: bool = False) -> None:
    """macOS 走原生菜单栏项。

    pystray 的 darwin 后端漏了 activation policy 和图标尺寸两件必需的事，补齐等于
    重写它那层封装，所以这里直接用 AppKit（见 `peach.menubar`）。Windows 继续走 pystray。
    """
    from .menubar import MenuBarApp, Submenu

    gate = gate or SetupGate(manager, settings_file.active(), waiting=False)
    versions = VersionManager()
    # 「同步开发进度」会把版本行写旧，所以标题读这个可变快照而不是闭包里那一份。
    # 不在标题里直接调 `inspect()`：它要开四次 git，而标题每 5 秒刷新一次。
    state: dict[str, VersionSnapshot] = {"snapshot": versions.inspect()}
    app: dict[str, object] = {}
    # 开发进度和账本共用一把锁：两者都会停服务，同时跑等于让两条路径抢同一组进程。
    action_lock = threading.Lock()

    def restart() -> None:
        manager.stop_owned()
        manager.start_missing(reason="manual service restart")

    def quit_now() -> None:
        manager.stop_owned()
        holder = app.get("app")
        if holder is not None:
            holder.stop()

    def notify(message: str, title: str) -> None:
        holder = app.get("app")
        if holder is not None:
            holder.notify(message, title)

    def sync_source() -> None:
        """把本地检出快进到更新通道，再让新代码真的跑起来。

        和「同步 Ledger」分成两个按钮，因为它们除了名字里都有「同步」之外没有共同点：
        走的是 GitHub 而不是 SMB 共享，任一方不可达都不该拖住另一方（本机常态就是
        共享盘没挂而 GitHub 正常）；快进失败什么都没变，账本同步失败却牵涉唯一写入端
        和可能的数据取舍。合成一个按钮只会让「失败了」这句话失去意义。
        """
        if not action_lock.acquire(blocking=False):
            return

        def work() -> None:
            title = tray_text("tray.title.sourceSync")
            try:
                notify(tray_text("tray.sourceSync.checking"), title)
                result = versions.update()
                state["snapshot"] = result.snapshot
                if result.state != "updated":
                    notify(result.message, title)
                    return
                if tray_restart_required(result.changed_paths):
                    if launchd_owns_this_process():
                        notify(tray_text("tray.sourceSync.restartingMenuBar", message=result.message), title)
                        manager.stop_owned()
                        restarted = restart_tray_process()
                        if restarted.returncode != 0:
                            # kickstart 失败时旧进程仍在；把刚停掉的服务恢复，不能留下
                            # 一个有菜单图标却没有 HTTP/HTTPS 的半死状态。
                            manager.start_missing(reason="menu bar item restart failed, restoring services")
                            notify(tray_text("tray.sourceSync.menuBarRestartFailed"), title)
                        return
                    notify(tray_text("tray.sourceSync.menuBarManual", message=result.message), title)
                    manager.restart(reason="restart after syncing development changes")
                    return
                manager.restart(reason="restart after syncing development changes")
                notify(tray_text("tray.sourceSync.done", message=result.message,
                                 result=tray_text("tray.sourceSync.restarted")), title)
            finally:
                action_lock.release()

        threading.Thread(target=work, name="PeachSourceSync", daemon=True).start()

    def run_ledger_action(*, take_ownership: bool) -> None:
        if not action_lock.acquire(blocking=False):
            return

        def work() -> None:
            try:
                notify(tray_text("tray.ledger.decidingForTakeover" if take_ownership
                                 else "tray.ledger.decidingForSync"), tray_text("tray.title.ledger"))
                ok, message = manager.sync_ledger(take_ownership=take_ownership)
                notify(message, tray_text("tray.title.ledger" if ok else "tray.title.ledgerFailed"))
            finally:
                action_lock.release()

        threading.Thread(target=work, name="PeachLedgerSync", daemon=True).start()

    def sync_ledger() -> None:
        run_ledger_action(take_ownership=False)

    def take_ownership() -> None:
        run_ledger_action(take_ownership=True)

    def open_configuration() -> None:
        webbrowser.open(gate.open_url() + "configuration")

    # Sparkle 要在 NSApplication 建好之后创建，先放空，菜单建好再补上。
    updates = MacUpdateEntry(None, versions, state, action_lock, notify)

    menu = MenuBarApp(
        create_icon(template=True),
        tray_text("tray.menu.tooltip"),
        [
            (gate.open_label, gate.open),
            (lambda: tray_text("tray.menu.status", status=gate.status_line()), Submenu(lambda: [
                *((line, None) for line in manager.status_details()),
                (menu_text(tray_text("tray.menu.address", url=gate.open_url())), gate.open),
                (tray_text("tray.menu.fullConfiguration"), open_configuration),
            ])),
            (None, None),
            *(((tray_text("tray.menu.syncSource"), sync_source),) if not standalone() else ()),
            *ledger_menu_items(
                lambda label, action: (label, action), sync_ledger, take_ownership),
            (tray_text("tray.menu.restart"), restart),
            (tray_text("tray.menu.logs"), lambda: subprocess.run(["open", str(LOG_DIR)], check=False)),
            (tray_text("tray.menu.diagnostics"), lambda: export_macos_diagnostics(notify)),
            (tray_text("tray.menu.versions"), Submenu(lambda: [
                (f"Peach {state['snapshot'].package_version}", None),
                (menu_text(state['snapshot'].build_label), None),
                (menu_text(state['snapshot'].channel_label), None),
                (None, None),
                (tray_text("tray.menu.checkUpdates"), updates.check),
            ])),
            (None, None),
            (tray_text("tray.menu.quit"), quit_now),
        ],
        # 已在运行时再点开应用：和菜单第一项一样打开网页，图标被系统折叠时也有入口。
        reopen=gate.open,
    )
    app["app"] = menu
    updates.sparkle = sparkle_update.start(config=lambda: gate.config, stop_services=manager.stop_owned,
                                           notify=notify)
    gate.notify = lambda message, title: notify(message, title)
    if (gate.waiting and not silent) or show_browser:
        gate.open()

    # `manager.status()` 读的是 `healthy()` 写下的缓存。pystray 那条路径有 `_monitor`
    # 线程定时重采样，这条路径漏了，于是缓存永远停在启动那一刻——服务还没起来时测的
    # 那一次 False，菜单里就一直显示「未运行」。
    def poll_health() -> None:
        while not stopped.wait(5.0):
            gate.poll()
            for spec in manager.specs:
                manager.healthy(spec)
            updates.follow(gate.config.directory("state"))

    def refresh_certificate() -> bool:
        """本机地址变了就补签证书并重启 HTTPS。成功返回 True。

        证书的 SAN 是签死的，而局域网地址随 DHCP 和换网络变化；地址一变，用 IP 访问就
        报证书无效。由系统的网络变化事件驱动，不轮询——换 Wi-Fi 的那一刻就跑。
        """
        try:
            # 目录和主机名取 gate 手上那份配置：首次设置可能刚把 Peach 数据目录和 mDNS 名换掉，
            # 模块常量还停在托盘启动那一刻。
            reason = ensure_certificate(
                gate.config.directory("secrets") / "tls",
                f"{gate.config.server.mdns_name}.local", {lan_ipv4()})
        except Exception:
            LOGGER.exception("Certificate self-check failed")
            return False
        if reason is None:
            return True
        LOGGER.info("Certificate reissued (%s), restarting the HTTPS service", reason)
        manager.stop_owned("https")
        manager.start_missing(reason="restart HTTPS after reissuing the certificate")
        return True

    #: 事件到达时网络往往还没就绪，必须配重试；纯事件驱动会在这里断掉。
    CERT_RETRY_DELAYS = (0.0, 5.0, 15.0, 45.0, 120.0)
    cert_lock = threading.Lock()

    def refresh_certificate_with_retry() -> None:
        """换网瞬间地址还没拿到，事件那一刻必然失败——之后没人再管就一直是旧证书。

        实测：一次换网连发 7 个事件，全部落在 `lan_ipv4()` 抛
        `no publishable LAN IPv4 address` 的窗口里，网络稳定后证书仍停在上一个网段。
        所以失败要按退避重试，而不是把间隔轮询加回来。
        """
        if not cert_lock.acquire(blocking=False):
            return                      # 已经有一轮在重试，事件重复到达不用叠加
        try:
            for delay in CERT_RETRY_DELAYS:
                if delay and stopped.wait(delay):
                    return
                if refresh_certificate():
                    return
            LOGGER.error("Certificate self-check retry still failed; will try again on the next network change")
        finally:
            cert_lock.release()

    def on_network_change() -> None:
        threading.Thread(
            target=refresh_certificate_with_retry, name="PeachCertRetry", daemon=True).start()

    stopped = threading.Event()
    threading.Thread(target=poll_health, name="PeachMenuHealth", daemon=True).start()
    watcher = None
    if not standalone():
        # 源码部署维护本机 CA；独立应用使用设置中的高位端口。
        refresh_certificate_with_retry()
        watcher = NetworkChangeWatcher(on_network_change)
        watcher.start()
    try:
        menu.run()
    finally:
        stopped.set()
        if watcher is not None:
            watcher.stop()


def build_parser() -> argparse.ArgumentParser:
    """托盘启动与浏览器显示选项。"""
    parser = argparse.ArgumentParser(
        prog="peach-tray",
        description=interface_text.cli("trayCommand.description"),
    )
    visibility = parser.add_mutually_exclusive_group()
    visibility.add_argument("--silent", action="store_true", help=interface_text.cli("trayCommand.silent"))
    visibility.add_argument("--show", action="store_true", help=interface_text.cli("trayCommand.show"))
    return parser


def log_to_file(path: Path) -> logging.Handler | None:
    """托盘自己的日志另落一份文件，返回挂上的 handler；写不了返回 None。

    pythonw 下没有 stderr，`basicConfig` 那一份无处可落，启停时序出问题时只剩进程创建
    时间可对。写不了只是少一份证据，不拦托盘启动。httpx 每轮健康检查各记一条 INFO，
    一天一万多行，文件里只收它 WARNING 以上的。
    """
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(path, encoding="utf-8")
    except OSError:
        return None
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    handler.addFilter(lambda record: record.levelno >= logging.WARNING
                      or not record.name.startswith(("httpx", "httpcore")))
    logging.getLogger().addHandler(handler)
    return handler


def failure_exit_code() -> int:
    """托盘自己判定失败时的退出码；launchd 名下的 macOS 菜单栏项按 0 退出。

    LaunchAgent 写的是 `KeepAlive = {SuccessfulExit: false}`（见
    `desktop_startup.MACOS_KEEP_ALIVE`），非 0 退出会被重新拉起。走到这里的是配置、迁移、
    建菜单这类失败，原因已经记下，重来结果相同，拉起只会每隔 ThrottleInterval 再失败一次。
    PyObjC 的事件循环自己接住菜单回调里的异常，所以要 launchd 恢复的是崩溃和信号终止，
    不经过这里。终端里手跑和 Windows 仍得到 1。
    """
    if sys.platform != "darwin":
        return 1
    try:
        return 0 if launchd_owns_this_process() else 1
    except OSError:
        return 1


def main(argv: list[str] | None = None) -> int:
    try:
        return _main(argv)
    except Exception as exc:
        show_message(tray_text("tray.title.startFailed"), error_reporting.failure_details("tray-startup", exc),
                     error=True)
        return failure_exit_code()


def _main(argv: list[str] | None = None) -> int:
    # 参数解析必须排在任何进程级副作用之前：`--help` 和拼错的参数都要在 HiDPI 设置、
    # 单实例锁和目录创建之前退出，否则一条试探命令就会在磁盘上凭空造出一个 Peach 数据目录，
    # 让之后的安装探测把这台机器误判成已配置。
    args = build_parser().parse_args(argv)
    config = settings_file.load_config()
    error_reporting.install(config.directory("logs"))
    waiting = needs_setup(config)
    instance = SingleInstance(config.directory("state") / "peach-tray.lock")
    if instance.is_running():
        if not args.silent:
            webbrowser.open(setup_url(config) if waiting else normal_url(config))
        return 0
    try:
        if handoff_tray(sys.argv[1:] if argv is None else argv, PROJECT_ROOT):
            return 0
    except OSError as exc:
        details = error_reporting.failure_details("tray-handoff", exc)
        show_message(tray_text("tray.title.startFailed"), tray_text("tray.startup.handoffFailed", details=details),
                     error=True)
        return 1
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger().setLevel(logging.INFO)
    enable_hidpi()
    manager = None
    lifecycle = None
    exit_code = 1
    try:
        instance.acquire()
    except AlreadyRunning:
        if not args.silent:
            webbrowser.open(setup_url(config) if waiting else normal_url(config))
        return 0
    try:
        # 日志按设置的天数保留、按月切段，必须排在任何子进程打开日志之前：Windows 上被占着的
        # 文件改不了名也删不掉。整理不了只记日志，不能因此不起托盘。
        try:
            for action in log_retention.sweep(
                    config.directory("logs"),
                    retention=retention_settings.log_retention(config.directory("state"))):
                logging.getLogger(__name__).info("Log maintenance: %s", action)
        except Exception:
            logging.getLogger(__name__).warning("Log maintenance failed", exc_info=True)
        log_to_file(config.directory("logs") / "tray.log")
        try:
            from .standalone_update import remember_installation_data_root
            remember_installation_data_root(config)
        except (OSError, RuntimeError):
            logging.getLogger(__name__).warning("Failed to save the data directory location after the update", exc_info=True)
        try:
            if desktop_startup.refresh_launch_agent(config):
                LOGGER.info("Login item now restarts after abnormal exits; takes effect at next login")
        except (OSError, ValueError):
            LOGGER.warning("Failed to update abnormal-exit recovery for the login item", exc_info=True)
        if sys.platform == "win32":
            lifecycle = Lifecycle(config.directory("state"), config.directory("logs"),
                                  config.data_root, PROJECT_ROOT)
            try:
                lifecycle.start()
            except Exception:
                LOGGER.exception("Failed to enable automatic recovery after abnormal tray exits")
                lifecycle.stop("watchdog-start-failed", os.getpid())
                lifecycle = None
        specs = build_setup_service_specs(config) if waiting else configured_service_specs(config)
        manager = ServiceManager(specs, log_dir=config.directory("logs"))
        gate = SetupGate(manager, config, waiting=waiting, instance=instance)
        if sys.platform == "darwin":
            if not waiting:
                migration = tray_preparation(config, manager).migrations.apply()
                if migration.failed:
                    raise RuntimeError(migration.message)
            manager.start_missing(reason="tray startup")
            run_macos_menu_bar(manager, gate, silent=args.silent, show_browser=args.show)
        else:
            tray = PeachTray(manager, gate=gate, silent=args.silent, show_browser=args.show,
                             preparation=tray_preparation(config, manager))
            tray.lifecycle = lifecycle
            if lifecycle is not None:
                lifecycle.attach(tray.icon)
            tray.run()
        exit_code = 0
    except Exception as exc:
        LOGGER.exception("Tray run failed")
        if not os.environ.get("PEACH_TRAY_RECOVERIES"):
            show_message(tray_text("tray.title.startFailed"), error_reporting.failure_details("tray-runtime", exc),
                         error=True)
        return failure_exit_code()
    finally:
        if lifecycle is not None:
            lifecycle.exited(exit_code)
        if manager is not None:
            manager.stop_owned()
        instance.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
