"""无桌面部署的只读目录选择；访问限制在明确配置的媒体根内。"""
from __future__ import annotations

from itertools import islice
import json
import os
from pathlib import Path

from .user_messages import UserValueError


class NasDirectoryError(UserValueError):
    """目录选择超出已配置的媒体根，或分页参数无效。"""


def available() -> bool:
    from .local_playback import available as desktop_available
    return desktop_available()


def file_position(path, ledger_path: str = '') -> dict:
    """回执只描述已知容器/服务端位置，不推测宿主机的共享路径。"""
    from .platform import location_mount_values, resolve_root
    result = {'mode': 'server', 'path': str(path),
              'container': os.environ.get('PEACH_DISTRIBUTION') == 'docker'}
    if ledger_path:
        location, index, tail = resolve_root(ledger_path)
        mounts = location_mount_values().get(location, ())
        if 0 <= index < len(mounts):
            result.update(media_root=str(mounts[index]), relative_path='/'.join(tail))
    return result


def roots(config) -> list[str]:
    values = [value for group in config.mounts.values() for value in group]
    if os.name == 'nt':
        values.extend(value for group in config.locations.values() for value in group)
    if os.environ.get('PEACH_DISTRIBUTION') == 'docker':
        values.insert(0, '/media')
    return list(dict.fromkeys(str(Path(value)) for value in values
                             if Path(value).is_absolute() and Path(value) != Path(Path(value).anchor)))


def browse(config, initial: str, *, start: bool = False, offset: int = 0) -> dict:
    from .media_io import _request
    if type(offset) is not int or not 0 <= offset < 2**31:
        raise NasDirectoryError('errors.nasDirectories.invalidOffset')
    allowed = roots(config)
    if start or not initial:
        return {'mode': 'server', 'path': None, 'parent': None, 'roots': allowed,
                'directories': [], 'next_offset': None}
    candidate = Path(initial)
    if not candidate.is_absolute() or not any(candidate.is_relative_to(Path(root)) for root in allowed):
        raise NasDirectoryError('errors.nasDirectories.outsideRoots')
    try:
        return _request('browse', initial, value=json.dumps({'allowed': allowed, 'offset': offset}), timeout=10)
    except ValueError as exc:
        # 读取子进程解析符号链接后才知道越界，回传的只有原因；界面一律按越界提示。
        raise NasDirectoryError('errors.nasDirectories.outsideRoots') from exc


def list_directory(path, allowed: list[str], offset: int = 0) -> dict:
    """由可终止的媒体读取子进程调用；不跟随列表中的符号链接。"""
    candidate = Path(path)
    if not candidate.is_absolute():
        raise ValueError('the path must be absolute')
    boundaries = [Path(root) for root in allowed if candidate.is_relative_to(Path(root))
                  and Path(root) != Path(Path(root).anchor)]
    if not boundaries:
        raise ValueError('outside the configured media roots')
    # 只访问本次路径所属的根；离线网盘不阻塞另一个本地媒体根。
    boundary = max(boundaries, key=lambda root: len(root.parts)).resolve(strict=True)
    target = candidate.resolve(strict=True)
    if not target.is_relative_to(boundary) or boundary == Path(boundary.anchor):
        raise ValueError('outside the configured media roots')
    directories = []
    with os.scandir(target) as entries:
        limited = list(islice(entries, offset, offset + 501))
        for entry in limited[:500]:
            if entry.is_dir(follow_symlinks=False):
                directories.append({'name': entry.name, 'path': str(target / entry.name)})
    return {'mode': 'server', 'path': str(target),
            'parent': str(target.parent) if target != boundary else None,
            'roots': allowed, 'directories': sorted(directories, key=lambda item: item['name'].casefold()),
            'next_offset': offset + 500 if len(limited) > 500 else None}
