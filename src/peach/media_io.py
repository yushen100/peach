"""在可终止的只读子进程中访问媒体挂载；账本与任务状态由调用方保存。"""
from __future__ import annotations

import argparse
import base64
import errno
import json
import os
import shutil
import stat
from pathlib import Path
import queue
import subprocess
import sys
import threading
from types import SimpleNamespace

from .os_errors import CodedOSError, CodedTimeoutError

#: 单项读取的期限。目录枚举按「多久没有新条目」计：挂死的挂载一条也不返回，到期判失败；
#: 网络盘上的大目录逐条返回得慢，只要还在返回就不按总时长判死。
TIMEOUT_SECONDS = 20.0
OPERATIONS = ('directory', 'files', 'nfo', 'art', 'online', 'resolve', 'stat', 'browse', 'volume')


def _request(operation, path, *, value='', timeout=None):
    from .smb_media import resolve
    remote = resolve(path)
    if remote is not None:
        if timeout is not None:
            from dataclasses import replace
            if timeout <= 0:
                raise CodedTimeoutError(errno.ETIMEDOUT, 'errors.mediaIo.deadlinePassed')
            remote = replace(remote, connection=replace(remote.connection, timeout=min(remote.connection.timeout, timeout)))
        return _read(operation, remote, value)
    command = ([sys.executable, 'media-read'] if getattr(sys, 'frozen', False)
               else [sys.executable, '-m', 'peach.media_io'])
    try:
        result = subprocess.run([*command, operation, str(path), value],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=TIMEOUT_SECONDS if timeout is None else timeout,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    except subprocess.TimeoutExpired as error:
        raise CodedTimeoutError(errno.ETIMEDOUT, 'errors.mediaIo.readTimedOut', filename=str(path)) from error
    if result.returncode:
        raise CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=str(path))
    response = json.loads(result.stdout)
    if 'error' in response:
        error = response['error']
        if error['kind'] == 'value':
            raise ValueError(error['message'])
        raise OSError(error.get('errno'), error['message'], str(path))
    return response['value']


class DirectoryEntry:
    """目录快照中的条目，属性访问不再触碰媒体盘。"""

    def __init__(self, value):
        self.__dict__.update(value)

    def is_dir(self):
        return self.directory

    def is_symlink(self):
        return self.symlink

    def stat(self):
        if self.error:
            raise OSError(errno.EIO, self.error, self.path)
        return SimpleNamespace(**self.attributes)


def directory_entries(path, *, file_identity=False):
    value = 'identity' if file_identity else ''
    from .smb_media import resolve
    if resolve(path) is not None:
        return [DirectoryEntry(item) for item in _request('directory', path, value=value)]
    return [DirectoryEntry(item) for item in _directory_stream(path, value)]


def _paced(lines, idle, path):
    """逐条取出 `lines`；距上一条超过 `idle` 秒仍没有新的一条时判超时。

    读取放在后台线程里：卡在网络盘上的读取不能被打断，只能由调用方结束子进程。
    """
    arrived = queue.SimpleQueue()

    def pump():
        try:
            for line in lines:
                arrived.put(line)
        except (OSError, ValueError):
            pass
        finally:
            arrived.put(None)
    threading.Thread(target=pump, name='PeachMediaRead', daemon=True).start()
    while True:
        try:
            line = arrived.get(timeout=idle)
        except queue.Empty:
            raise CodedTimeoutError(errno.ETIMEDOUT, 'errors.mediaIo.readTimedOut', filename=str(path)) from None
        if line is None:
            return
        yield line


def _directory_stream(path, value):
    """子进程逐条交回目录条目，见到结束标记才算读完；中途断开不把半截清单当整个目录。"""
    command = ([sys.executable, 'media-read'] if getattr(sys, 'frozen', False)
               else [sys.executable, '-m', 'peach.media_io'])
    process = subprocess.Popen([*command, 'directory', str(path), value],
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    items = []
    try:
        for line in _paced(process.stdout, TIMEOUT_SECONDS, path):
            message = json.loads(line)
            if 'entry' in message:
                items.append(message['entry'])
            elif 'error' in message:
                raise OSError(message['error'].get('errno'), message['error']['message'], str(path))
            elif message.get('end') == len(items):
                return items
            else:
                break
        raise CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=str(path))
    finally:
        # 先回收子进程再返回：超时时它可能还卡在挂载上。
        process.kill()
        process.wait()
        process.stdout.close()


def directory_files(path):
    from .smb_media import resolve
    return {name: resolve(value) or Path(value) for name, value in _request('files', path).items()}


def read_nfo(path):
    from .smb_media import resolve
    if remote := resolve(path):
        from .library_nfo import read_nfo as read_remote_nfo
        return read_remote_nfo(remote)
    from .processing_traffic import record_media_read
    payload, encoded = _request('nfo', path)
    raw = base64.b64decode(encoded)
    record_media_read(path, len(raw))
    return payload, raw


def local_art(video, payload):
    value = payload.get('local_art', '')
    if not value or '://' in value:
        return None
    found = _request('art', video, value=value)
    from .smb_media import resolve
    return (resolve(found) or Path(found)) if found else None


def root_online(path):
    return _request('online', path)


def volume_usage(path, *, system=False, timeout=None):
    """根目录在不在线、所在卷的容量与卷号：`{'online', 'free', 'total', 'device'}`，后三项可能缺。

    `system` 的根不判在线，直接读容量。卷号读不到时是 0。"""
    return _request('volume', path, value='system' if system else '', timeout=timeout)


def _volume(path, *, system):
    from .platform import root_online
    online = system or root_online(path)
    if not online or not isinstance(path, Path):
        return dict(online=online)
    try:
        usage = shutil.disk_usage(path)
    except OSError:
        return dict(online=True)
    try:
        device = os.stat(path).st_dev
    except OSError:
        device = 0
    return dict(online=True, free=usage.free, total=usage.total, device=device)


def resolve_case_insensitive(path):
    from .platform import translate_ledger_path
    from .smb_media import resolve
    return _request('resolve', resolve(path) or translate_ledger_path(path))


def file_stat(path, *, timeout=None):
    return SimpleNamespace(**_request('stat', path, timeout=timeout))


def _attributes(stat):
    return {key: getattr(stat, key) for key in ('st_size', 'st_mtime', 'st_mtime_ns', 'st_mode',
            'st_ino', 'st_dev', 'st_birthtime_ns') if hasattr(stat, key)}


def _identity_unused(name):
    """扫描按名字就跳过、不登记的文件（NFO 与系统元数据），用不上文件身份。"""
    from .discovery_rules import system_file
    return name.casefold().endswith('.nfo') or system_file(name)


def _local_directory(path, value):
    """逐条读取本机目录。

    Windows 的目录快照没有文件 ID，`os.stat` 是身份的唯一来源，身份请求时逐个补读；
    网络盘上每次补读都是一趟往返，扫描用不上身份的条目不补读。
    """
    with os.scandir(path) as entries:
        for entry in entries:
            item = dict(name=entry.name, path=entry.path, directory=False, symlink=False,
                        attributes={}, error='')
            try:
                item.update(directory=entry.is_dir(), symlink=entry.is_symlink())
                if not item['directory']:
                    info = entry.stat()
                    if value == 'identity' and not info.st_ino and not _identity_unused(entry.name):
                        info = os.stat(entry.path)
                    item['attributes'] = _attributes(info)
            except OSError as error:
                item['error'] = str(error)
            yield item


def _emit(message):
    print(json.dumps(message, ensure_ascii=True), flush=True)


def _stream_directory(path, value):
    """目录条目一条一行、逐条刷出，父进程据此判断读取仍在推进；末行是条目数。"""
    try:
        count = 0
        for item in _local_directory(path, value):
            _emit({'entry': item})
            count += 1
        _emit({'end': count})
    except OSError as error:
        try:
            _emit({'error': dict(kind='os', errno=error.errno, message=str(error))})
        except OSError:
            # 父进程已超时离开、管道关闭时，结果没有读取方，不算故障。
            pass
    return 0


def _read(operation, path, value):
    if operation == 'browse':
        from .nas_directories import list_directory
        return list_directory(path, **json.loads(value))
    if operation == 'directory':
        from .smb_media import SmbResource
        if isinstance(path, SmbResource):
            return [dict(name=entry.name, path=str(path / entry.name), directory=entry.is_dir,
                         symlink=entry.is_symlink, error='', attributes=dict(st_size=entry.size,
                         st_mtime=entry.mtime, st_mtime_ns=entry.mtime_ns,
                         st_mode=stat.S_IFDIR if entry.is_dir else stat.S_IFREG)) for entry in path.scandir()]
        return list(_local_directory(path, value))
    if operation in ('files', 'nfo', 'art'):
        from . import library_nfo
        if operation == 'files':
            return {key: str(value) for key, value in library_nfo.directory_files(path).items()}
        if operation == 'art':
            found = library_nfo.local_art(path, {'local_art': value})
            return str(found) if found else None
        payload, raw = library_nfo.read_nfo(path)
        return payload, base64.b64encode(raw).decode('ascii')
    if operation == 'online':
        from .platform import root_online
        return root_online(path)
    if operation == 'volume':
        return _volume(path, system=value == 'system')
    if operation == 'resolve':
        from .media import resolve_case_insensitive
        return str(resolve_case_insensitive(str(path)))
    return _attributes(path.stat())


def main(argv=None):
    parser = argparse.ArgumentParser(description='Read media directories and companion files with a time limit')
    parser.add_argument('operation', choices=OPERATIONS)
    parser.add_argument('path', type=Path)
    parser.add_argument('value', nargs='?', default='')
    args = parser.parse_args(argv)
    if args.operation == 'directory':
        return _stream_directory(args.path, args.value)
    try:
        response = {'value': _read(args.operation, args.path, args.value)}
    except (OSError, ValueError) as error:
        response = {'error': dict(kind='os' if isinstance(error, OSError) else 'value',
                                  errno=getattr(error, 'errno', None), message=str(error))}
    except Exception as error:
        from xml.etree.ElementTree import ParseError
        if not isinstance(error, ParseError):
            raise
        response = {'error': dict(kind='value', message=str(error))}
    try:
        print(json.dumps(response, ensure_ascii=True), flush=True)
    except OSError:
        # 父进程已超时离开、管道关闭时，结果没有读取方，不算故障。
        pass
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
