"""在可终止的子进程中访问媒体挂载；账本与任务状态由调用方保存。"""
from __future__ import annotations

import argparse
import base64
import errno
import json
import os
import pickle
import stat
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
from types import SimpleNamespace

from .os_errors import CodedOSError, CodedTimeoutError

#: 单项读取的期限。目录枚举按「多久没有新条目」计：挂死的挂载一条也不返回，到期判失败；
#: 网络盘上的大目录逐条返回得慢，只要还在返回就不按总时长判死。
TIMEOUT_SECONDS = 20.0
OPERATIONS = ('directory', 'files', 'nfo', 'art', 'online', 'resolve', 'stat', 'browse', 'serve')


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
    if operation == 'resolve':
        from .media import resolve_case_insensitive
        return str(resolve_case_insensitive(str(path)))
    return _attributes(path.stat())



class MountWorker:
    """一个常驻子进程，按父进程一问一答逐条执行媒体盘上的操作（`SERVED`），每条带期限。

    整理、片头修复一批要动几千个文件：每条起一个进程开销太大，放在本进程里做又会被挂死的
    挂载一直卡住、取消也解不开。某一条超过期限没有回答，就结束这个子进程、这一条报超时，
    下一条换一个新的子进程接着做。一问一答而不是整批交给子进程，是为了让调用方在两条
    之间同步账本、检查取消：子进程不会跑在账本前面。
    """

    def __init__(self):
        self._process = None
        self._replies = None

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        self.close()

    def _start(self):
        if self._process is None:
            command = ([sys.executable, 'media-read'] if getattr(sys, 'frozen', False)
                       else [sys.executable, '-m', 'peach.media_io'])
            try:
                process = subprocess.Popen([*command, 'serve', '-'],
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            except OSError as error:
                raise CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed') from error
            replies = queue.SimpleQueue()

            def pump():
                try:
                    for line in process.stdout:
                        replies.put(line)
                except (OSError, ValueError):
                    pass
                finally:
                    process.stdout.close()
                    replies.put(None)
            threading.Thread(target=pump, name='PeachMountWorker', daemon=True).start()
            self._process, self._replies = process, replies
        return self._process, self._replies

    def call(self, operation, *args, timeout=None, interruptible=False):
        """执行一条操作并返回结果；操作自己抛的异常原样抛出。

        `timeout` 按「多久没有回音」计，操作中途报进度会重新计时。`interruptible` 的操作
        在等待期间响应任务的暂停与取消（取消时结束子进程）；改名这类做到一半不能丢下的
        操作保持默认，取消在它答完之后生效。
        """
        limit = TIMEOUT_SECONDS if timeout is None else timeout
        process, replies = self._start()
        subject = str(args[0]) if args and isinstance(args[0], str) else None
        try:
            process.stdin.write((json.dumps({'op': operation, 'args': args}) + '\n').encode('utf-8'))
            process.stdin.flush()
        except OSError as error:
            self.close()
            raise CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=subject) from error
        deadline = time.monotonic() + limit
        while True:
            if interruptible:
                from .task_control import checkpoint
                paused = time.monotonic()
                try:
                    checkpoint(None)
                except BaseException:
                    self.close()
                    raise
                deadline += time.monotonic() - paused
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                self.close()
                raise CodedTimeoutError(errno.ETIMEDOUT, 'errors.mediaIo.readTimedOut', filename=subject)
            try:
                line = replies.get(timeout=min(remaining, .2) if interruptible else remaining)
            except queue.Empty:
                continue
            if line is None:
                self.close()
                raise CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=subject)
            message = json.loads(line)
            if 'progress' in message:
                deadline = time.monotonic() + limit
                continue
            # 回答来自本进程刚起的子进程：结果与异常都按原类型还原。
            if 'error' in message:
                raise pickle.loads(base64.b64decode(message['error']))
            return pickle.loads(base64.b64decode(message['value']))

    def close(self):
        """结束子进程，不等它退出：卡在挂载上的进程可能要等那次读写返回才真正退出。"""
        process, self._process, self._replies = self._process, None, None
        if process is None:
            return
        try:
            process.stdin.close()
        except OSError:
            pass
        process.kill()
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass


def stat_of(path):
    """`file_stat` 的同一份字段，给 `MountWorker` 用：一批文件逐个 stat 不必每个起一个进程。"""
    return SimpleNamespace(**_attributes(os.stat(path)))


def probe(paths):
    """每个路径答 `[在不在, 是不是普通文件]`，口径同 `os.path.exists` 与 `os.path.isfile`。"""
    return [[os.path.exists(path), os.path.isfile(path)] for path in paths]


def move(source, target, case_only=False, rename=True):
    """把 `source` 改名成 `target`：源不在答 `missing`，目标已被别的文件占着答 `taken`，改成了答 `ok`；
    `rename` 为假时只判不改，可以改答 `ready`。

    只改大小写时两个名字可能指向同一个文件，按 stat 的设备号与文件号判是不是同一个。
    """
    try:
        source_stat = os.stat(source)
    except FileNotFoundError:
        return 'missing'
    try:
        target_stat = os.stat(target)
    except FileNotFoundError:
        target_stat = None
    if target_stat is not None and not (case_only and (source_stat.st_dev, source_stat.st_ino)
                                        == (target_stat.st_dev, target_stat.st_ino)):
        return 'taken'
    if not rename:
        return 'ready'
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    os.rename(source, target)
    return 'ok'


#: `MountWorker` 能执行的操作：名字 → (模块, 函数)，在子进程里用到时才导入。
#: 带 `progress` 参数的操作中途报进度，父进程据此重新计时。
SERVED = {
    'stat': ('peach.media_io', 'stat_of'),
    'probe': ('peach.media_io', 'probe'),
    'move': ('peach.media_io', 'move'),
    'boxes': ('peach.mp4repair', 'top_level_boxes'),
    'layout': ('peach.mp4repair', 'read_layout'),
    'stage': ('peach.mp4recover', 'stage_replacement'),
    'swap': ('peach.mp4recover', 'swap_in'),
    'unstage': ('peach.mp4recover', 'discard_staged'),
}


def _serve():
    """`MountWorker` 的子进程一端：一行一条请求，一行一条回答；异常连同类型一起交回。"""
    import importlib
    import inspect
    for line in sys.stdin:
        request = json.loads(line)
        module, name = SERVED[request['op']]
        function = getattr(importlib.import_module(module), name)
        options = ({'progress': lambda value: _emit({'progress': value})}
                   if 'progress' in inspect.signature(function).parameters else {})
        try:
            value = function(*request['args'], **options)
            reply = {'value': base64.b64encode(pickle.dumps(value)).decode('ascii')}
        except Exception as error:
            reply = {'error': base64.b64encode(pickle.dumps(error)).decode('ascii')}
        try:
            _emit(reply)
        except OSError:
            # 父进程已超时离开、管道关闭时，结果没有读取方，不算故障。
            return 0
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description='Read media directories and companion files with a time limit')
    parser.add_argument('operation', choices=OPERATIONS)
    parser.add_argument('path', type=Path)
    parser.add_argument('value', nargs='?', default='')
    args = parser.parse_args(argv)
    if args.operation == 'serve':
        return _serve()
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
