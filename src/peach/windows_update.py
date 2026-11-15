from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable

from . import interface_text, process_job
from .fsutil import atomic_write_text, replace_with_retry


log = logging.getLogger(__name__)

BACKUP_GLOB = "Peach.pre-source-sync-*.exe"
STAGING_DIRNAME = "source-sync-build"
KEEP_BACKUPS = 2
#: 「同步源码」各步的期限（秒）：超时收掉整棵进程树，按这一步失败处理，托盘和服务保持原样。
#: 完整测试本机要一个多小时，构建十来分钟，暂存包的 `migrate status` 只开库读版本。
TEST_SECONDS = 4 * 3600
BUILD_SECONDS = 3600
MIGRATE_STATUS_SECONDS = 300

WINDOWS_TRAY_INPUTS = (
    "src/peach/",
    "scripts/build_app_entry.py",
    "scripts/build_windows.ps1",
    "scripts/replace_windows_tray.py",
    "web/",
    "migrations/",
    "resources/",
    "pyproject.toml",
)


def windows_tray_rebuild_required(changed_paths: tuple[str, ...]) -> bool:
    """The frozen Windows entry must carry every packaged runtime input."""
    return any(
        path == prefix or path.startswith(prefix)
        for path in changed_paths
        for prefix in WINDOWS_TRAY_INPUTS
    )


@dataclass(frozen=True)
class PendingWindowsUpdate:
    commit: str
    changed_paths: tuple[str, ...]


@dataclass(frozen=True)
class WindowsUpdatePreparation:
    """`message` 进托盘通知，按本机语言渲染（`tray.sourceSync.*`）。"""

    state: str
    message: str

    @classmethod
    def of(cls, state: str, code: str) -> "WindowsUpdatePreparation":
        return cls(state, interface_text.text(f"server:{code}", None, interface_text.local_language()))


#: PyInstaller 单文件包解压目录的固定前缀，位于 `%TEMP%`。
ONEFILE_GLOB = "_MEI*"
#: 比这更新的解压目录可能属于正在启动的另一份进程，不碰。
ONEFILE_MIN_AGE = timedelta(days=1)


def sweep_onefile_extractions(
    bundle_root: str | None = getattr(sys, "_MEIPASS", None), *,
    now: datetime | None = None, min_age: timedelta = ONEFILE_MIN_AGE,
) -> tuple[Path, ...]:
    """删掉单文件包解压后没能自清的 `%TEMP%/_MEIxxxx` 目录，托盘每次启动调一次。

    PyInstaller 的单文件包每次启动都把自己解到临时目录，只在正常退出时删掉它；托盘被
    结束进程、断电或在替换过程中被接管时那份就一直留着，每份 40–80 MB，几周就以 GB 计。
    只认 `_MEIPASS` 所在目录里的同前缀兄弟目录：跳过自己，跳过修改时间不满 `min_age`
    的（可能是正在启动的另一份进程），删不掉的只记日志。源码运行没有 `_MEIPASS`，
    什么都不做。
    """
    if not bundle_root:
        return ()
    own = Path(bundle_root).resolve()
    moment = now or datetime.now()
    removed: list[Path] = []
    for entry in sorted(own.parent.glob(ONEFILE_GLOB)):
        if not entry.is_dir() or entry.resolve() == own:
            continue
        try:
            modified = datetime.fromtimestamp(entry.stat().st_mtime)
            if moment - modified < min_age:
                continue
            shutil.rmtree(entry)
        except OSError as exc:
            log.warning("Failed to delete one-file bundle extraction leftovers %s: %s", entry, exc)
            continue
        removed.append(entry)
    return tuple(removed)


def swap_tray_binary(
    staged: Path,
    target: Path,
    *,
    timeout: float = 45.0,
    now: Callable[[], datetime] = datetime.now,
    sleep: Callable[[float], None] = time.sleep,
) -> Path:
    """换掉生产托盘 EXE，先在原地留一份可回滚的备份，返回备份路径。

    调用方必须先让旧托盘正常退出：这个函数不发停止消息，也不判断谁还活着。
    备份名沿用 `BACKUP_GLOB`，托盘下次启动的 `sweep_artifacts` 才认得出它、
    才会按 `KEEP_BACKUPS` 收口；换个名字就会在 `dist/Peach/` 里越堆越多。
    """
    if not staged.is_file():
        raise FileNotFoundError(f"staged package not found: {staged}")
    if target.name.lower() != "peach.exe" or not target.is_file():
        raise ValueError(f"production entry point is missing or is not Peach.exe: {target}")
    if os.path.normcase(os.path.abspath(staged)) == os.path.normcase(os.path.abspath(target)):
        raise ValueError("staged package and production entry point are the same file")

    backup = target.with_name(f"Peach.pre-source-sync-{now().strftime('%Y%m%d-%H%M%S')}.exe")
    shutil.copy2(target, backup)
    try:
        replace_with_retry(staged, target, timeout=timeout, sleep=sleep)
    except OSError:
        backup.unlink(missing_ok=True)
        raise
    return backup


class WindowsUpdateInstaller:
    """Test an updated checkout and stage a recoverable Windows tray replacement."""

    def __init__(
        self,
        root: Path,
        *,
        state_dir: Path,
        log_dir: Path,
        current_executable: Path | None = None,
        run: Callable[..., subprocess.CompletedProcess] = process_job.run,
        popen: Callable[..., subprocess.Popen] = subprocess.Popen,
        powershell: str | None = None,
        frozen: bool | None = None,
        process_id: int | None = None,
    ) -> None:
        self.root = root.resolve()
        self.state_dir = state_dir.resolve()
        self.log_dir = log_dir.resolve()
        self.current_executable = Path(current_executable or sys.executable).resolve()
        self._run = run
        self._popen = popen
        self._powershell = powershell
        self._frozen = (
            bool(getattr(sys, "frozen", False)) and os.name == "nt"
            if frozen is None else frozen
        )
        self._process_id = os.getpid() if process_id is None else process_id
        self.pending_path = self.state_dir / "windows-source-sync.json"
        self.log_path = self.log_dir / "windows-source-sync.log"

    def mark_pending(self, commit: str, changed_paths: tuple[str, ...]) -> None:
        atomic_write_text(self.pending_path, json.dumps(
            {"commit": commit, "changed_paths": list(changed_paths)},
            ensure_ascii=False, indent=2,
        ))

    def pending(self) -> PendingWindowsUpdate | None:
        try:
            payload = json.loads(self.pending_path.read_text(encoding="utf-8"))
            commit = str(payload["commit"])
            changed = tuple(str(path) for path in payload["changed_paths"])
        except (OSError, ValueError, KeyError, TypeError):
            return None
        return PendingWindowsUpdate(commit, changed)

    def clear_pending(self) -> None:
        self.pending_path.unlink(missing_ok=True)

    def sweep_artifacts(self, *, keep_backups: int = KEEP_BACKUPS) -> tuple[Path, ...]:
        """删掉更新流程留下、已经没人会读的产物，托盘每次启动调一次。

        每次更新都会在 EXE 旁边留一份 `Peach.pre-source-sync-<时间>.exe` 备份、在
        `state/source-sync-build/<commit>/` 留一份暂存构建，两者各约 40 MB。备份只留最新
        `keep_backups` 份；暂存目录只留待应用记录指着的那个提交——替换助手要等新托盘
        活过 3 秒才清掉待应用记录，所以刚换上来的那份到下一次启动才会被清。只认更新器
        自己的命名，`Peach.exe` 本体和手工放进目录的任何文件一律不碰；删不掉的只记日志，
        不影响启动。
        """
        removed: list[Path] = []
        backups = sorted(self.current_executable.parent.glob(BACKUP_GLOB))
        stale_count = max(len(backups) - max(keep_backups, 0), 0)
        for stale in backups[:stale_count]:
            try:
                stale.unlink()
            except OSError as exc:
                log.warning("Failed to delete old tray backup %s: %s", stale, exc)
                continue
            removed.append(stale)

        pending = self.pending()
        staging_root = self.state_dir / STAGING_DIRNAME
        if staging_root.is_dir():
            for entry in sorted(staging_root.iterdir()):
                if not entry.is_dir():
                    continue
                if pending is not None and entry.name == pending.commit:
                    continue
                try:
                    shutil.rmtree(entry)
                except OSError as exc:
                    log.warning("Failed to delete staged build %s: %s", entry, exc)
                    continue
                removed.append(entry)
        return tuple(removed)

    def _powershell_executable(self) -> str | None:
        if self._powershell:
            return self._powershell
        for name in ("pwsh.exe", "pwsh", "powershell.exe", "powershell"):
            found = shutil.which(name)
            if found:
                return found
        known = Path(r"C:\Program Files\PowerShell\7\pwsh.exe")
        return str(known) if known.is_file() else None

    def _run_logged(self, command: list[str], *, timeout: float, append: bool = True,
                    env: dict[str, str] | None = None) -> int | None:
        """跑一步并把输出记进 `log_path`；超时收掉整棵进程树，日志里记一行，返回 None。"""
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        mode = "a" if append else "w"
        with self.log_path.open(mode, encoding="utf-8", errors="replace") as log:
            log.write(f"\n[{datetime.now().isoformat(timespec='seconds')}] {' '.join(command)}\n")
            log.flush()
            try:
                result = self._run(
                    command,
                    cwd=str(self.root),
                    stdin=subprocess.DEVNULL,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    check=False,
                    env=env,
                    timeout=timeout,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                )
            except subprocess.TimeoutExpired:
                log.write(f"\n[{datetime.now().isoformat(timespec='seconds')}] "
                          f"timed out after {timeout:g}s; the process tree was stopped\n")
                return None
        return result.returncode

    def build_staged_tray(self, commit: str, *, shell: str | None = None) -> Path | None:
        """把当前检出打成一份托盘 EXE，暂存到 `state/source-sync-build/<commit>/`。

        不能就地构建 `dist/Peach/`：那份 `Peach.exe` 正被运行中的托盘持有，PyInstaller
        清理输出目录时会撞上 `WinError 5`。暂存目录的命名是 `sweep_artifacts` 认得的
        那一种，换名字它就清不掉。构建失败返回 None，原因在 `log_path` 里。
        """
        shell = shell or self._powershell_executable()
        if shell is None:
            return None
        staging_dir = self.state_dir / STAGING_DIRNAME / commit
        staging_dir.mkdir(parents=True, exist_ok=True)
        staged = staging_dir / "Peach.exe"
        staged.unlink(missing_ok=True)
        build_script = self.root / "scripts" / "build_windows.ps1"
        build_exit = self._run_logged([
            shell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(build_script),
            "-OutputDirectory", str(staging_dir),
        ], timeout=BUILD_SECONDS)
        if build_exit != 0 or not staged.is_file():
            return None
        return staged

    def packaged_migrations_pass(self, staged: Path) -> bool:
        """在换上生产入口之前，先让暂存包自己跑一次 `migrate status`。

        PyInstaller 漏掉 `migrations/` 的话包能构建、能启动，直到第一次开库才炸；
        那时旧二进制已经被换走了。这一步用真实的包在真实 Peach 数据目录上验证一遍。
        """
        reset_environment = os.environ.copy()
        reset_environment["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
        return self._run_logged([str(staged), "migrate", "status"], timeout=MIGRATE_STATUS_SECONDS,
                                env=reset_environment) == 0

    def prepare(
        self, commit: str, changed_paths: tuple[str, ...],
    ) -> WindowsUpdatePreparation:
        shell = self._powershell_executable()
        if shell is None:
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.noPowerShell")

        test_script = self.root / "scripts" / "test.ps1"
        for attempt in range(3):
            test_exit = self._run_logged(
                [shell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(test_script),
                 "-Scope", "full", "-Fresh"],
                timeout=TEST_SECONDS, append=attempt > 0,
            )
            # test_runner 的 4 表示验证期间输入变化；最多三次，每次取得完整有效记录。
            if test_exit != 4:
                break
        if test_exit is None:
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.testsTimedOut")
        if test_exit == 4:
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.inputsKeptChanging")
        if test_exit != 0:
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.testsFailed")

        if not windows_tray_rebuild_required(changed_paths):
            return WindowsUpdatePreparation.of("services", "tray.sourceSync.testsPassed")

        if not self._frozen:
            return WindowsUpdatePreparation.of("services-manual-tray", "tray.sourceSync.manualTray")

        if not self.current_executable.is_file():
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.trayExeMissing")

        staged = self.build_staged_tray(commit, shell=shell)
        if staged is None:
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.buildFailed")
        if not self.packaged_migrations_pass(staged):
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.packagedMigrationsFailed")

        backup = self.current_executable.with_name(
            f"Peach.pre-source-sync-{datetime.now().strftime('%Y%m%d-%H%M%S')}.exe"
        )
        shutil.copy2(self.current_executable, backup)
        helper_python = self.root / ".venv" / "Scripts" / "pythonw.exe"
        helper_script = self.root / "scripts" / "replace_windows_tray.py"
        if not helper_python.is_file() or not helper_script.is_file():
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.helperIncomplete")

        creationflags = 0
        if os.name == "nt":
            creationflags = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
        try:
            self._popen(
                [
                    str(helper_python), str(helper_script),
                    "--wait-pid", str(self._process_id),
                    "--staged", str(staged),
                    "--target", str(self.current_executable),
                    "--backup", str(backup),
                    "--pending", str(self.pending_path),
                    "--log", str(self.log_path),
                ],
                cwd=str(self.root), stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                shell=False, creationflags=creationflags,
            )
        except OSError:
            return WindowsUpdatePreparation.of("failed", "tray.sourceSync.helperFailed")
        return WindowsUpdatePreparation.of("replace", "tray.sourceSync.replacing")
