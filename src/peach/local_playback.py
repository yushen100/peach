"""通过系统文件关联或已安装的播放器打开已授权媒体；mpv、IINA、VLC 接上观看进度回传。"""
from __future__ import annotations

import os
import secrets
import shutil
import subprocess
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

from . import playback_tracking as tracking
from .media import bounded_normalized_path
from .user_messages import UserValueError


def available() -> bool:
    return sys.platform in {'win32', 'darwin'} and os.environ.get('PEACH_HEADLESS_MANAGED') != '1'


def installed() -> dict[str, tuple[str, str]]:
    """固定播放器名单；路径只来自系统与已知安装目录。"""
    if not available():
        return {}
    result = {}
    if sys.platform == 'darwin':
        for key, name in [('iina', 'IINA'), ('vlc', 'VLC'), ('mpv', 'mpv')]:
            for root in [Path('/Applications'), Path.home() / 'Applications']:
                app = root / f'{name}.app'
                if app.is_dir():
                    result[key] = (name, str(app))
                    break
    else:
        for key, name, relatives in [
            ('vlc', 'VLC', ('VideoLAN/VLC/vlc.exe',)),
            ('mpv', 'mpv', ('mpv/mpv.exe',)),
            ('potplayer', 'PotPlayer', ('DAUM/PotPlayer/PotPlayerMini64.exe', 'DAUM/PotPlayer/PotPlayerMini.exe',
                                      'PotPlayer/PotPlayerMini64.exe', 'PotPlayer/PotPlayerMini.exe')),
        ]:
            candidates = [shutil.which(Path(relative).name) for relative in relatives]
            candidates.extend(str(Path(os.environ[root]) / relative) for relative in relatives
                              for root in ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA'] if os.environ.get(root))
            found = next((path for path in candidates if path and Path(path).is_file()), None)
            if found:
                result[key] = (name, found)
    return result


Track = Callable[[Callable[[], 'tracking.Probe'], Callable[[], bool]], bool]


def _tracked_command(key: str, program: str, path: Path) -> tuple[list[str], Callable[[], 'tracking.Probe']] | None:
    """mpv 与 IINA 开 JSON IPC，VLC 开只听回环的 HTTP 接口；名字、端口、密码每次随机。"""
    token = secrets.token_hex(12)
    mac = sys.platform == 'darwin'
    if key in {'mpv', 'iina'}:
        address = tracking.mpv_address(token)
        if key == 'iina':
            if not mac:
                return None
            command = [str(Path(program) / 'Contents/MacOS/iina-cli'), f'--mpv-input-ipc-server={address}']
        else:
            binary = str(Path(program) / 'Contents/MacOS/mpv') if mac else program
            command = [binary, f'--input-ipc-server={address}']
        return command, lambda: tracking.MpvProbe(tracking.connect_mpv(address))
    if key == 'vlc' and not mac:
        port, password = tracking.free_port(), secrets.token_urlsafe(18)
        command = [program, '--extraintf=http', '--http-host=127.0.0.1', f'--http-port={port}',
                   f'--http-password={password}']
        return command, lambda: tracking.VlcProbe(port, password, path.name)
    return None


def open_media(path: Path, player: str = 'default', *, track: Track | None = None,
               extra_args: Sequence[str] = ()) -> bool:
    """打开文件；`track` 给了且播放器能回报进度时接上跟踪，返回是否接上。

    `extra_args` 只给人工验收用（静音、暂停起播），接口不暴露。
    文件在不在带期限地问（`media_io.bounded`），网盘答不上抛超时（`OSError` 的子类）。
    """
    if not available():
        raise UserValueError("errors.localPlayback.deploymentUnsupported")
    from . import media_io
    path = bounded_normalized_path(path)
    if not media_io.bounded(media_io.mount_key(path), path.is_file) or path.suffix.lower() not in {
        '.mp4', '.m4v', '.mkv', '.webm', '.avi', '.mov', '.wmv', '.flv', '.ts', '.mts', '.m2ts',
        '.mpg', '.mpeg', '.vob', '.iso', '.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus',
    }:
        raise UserValueError("errors.localPlayback.fileUnsupported")
    chosen = installed().get(player) if player != 'default' else None
    if player != 'default' and chosen is None:
        raise UserValueError("errors.localPlayback.playerMissing")
    tracked = _tracked_command(player, chosen[1], path) if chosen and track else None
    if tracked:
        command, connect = tracked
        process = subprocess.Popen([*command, *extra_args, str(path)], stdin=subprocess.DEVNULL,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   cwd=str(Path(command[0]).parent))
        return track(connect, lambda: process.poll() is None)
    if sys.platform == 'darwin':
        command = ['/usr/bin/open']
        if chosen:
            command.extend(['-a', chosen[1]])
        subprocess.run([*command, str(path)], check=True, timeout=10, capture_output=True)
    elif chosen:
        subprocess.Popen([chosen[1], str(path)], stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         cwd=str(Path(chosen[1]).parent))
    else:
        os.startfile(str(path), 'open')
    return False
