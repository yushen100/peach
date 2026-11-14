"""在可终止的只读子进程中访问媒体挂载；账本与任务状态由调用方保存。"""
from __future__ import annotations

import argparse
import base64
import errno
import json
import os
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
OPERATIONS = ('directory', 'files', 'nfo', 'art', 'online', 'resolve', 'stat', 'browse', 'present', 'directories', 'rmdirs')


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


def read_directories(paths, *, walk=False):
    """依次列出 `paths`，`walk` 时连同各级子目录；逐个产出 `(目录, 条目列表或 OSError)`。

    一个子进程连续读一串目录，不再每个目录起一个进程：网盘上几千个目录，起进程的开销会比
    读目录本身还大。某个目录超过期限没有新条目，它产出超时错误，剩下的换一个子进程接着读。
    报找不到的目录，错误上带 `hollow`：是不是 CloudDrive 的空目录（见 `directory_hollow`）。
    调用方中途不读了要关掉生成器，子进程才会被回收。
    """
    from .smb_media import resolve
    local = []
    for path in paths:
        if resolve(path) is None:
            local.append(os.fspath(path))
        else:
            yield from directories_in_process([path], walk, directory_entries)
    if local:
        yield from _directories_stream(list(reversed(local)), walk)


def directories_in_process(paths, walk, read):
    """`read_directories` 的同一次序与产出，读取交给 `read`（SMB 走自己的连接与期限）。"""
    stack = list(reversed(paths))
    while stack:
        directory = stack.pop()
        try:
            entries = read(directory)
        except OSError as error:
            yield directory, error
            continue
        yield directory, entries
        if walk:
            stack.extend(_subdirectories([vars(entry) for entry in entries]))


def _subdirectories(items):
    """walk 时接着往下读的子目录：真目录，不跟目录链接，读不出类型的不进。父子两边按它推演同一个次序。"""
    return [item['path'] for item in items if item['directory'] and not item['symlink'] and not item['error']]


def _directories_stream(stack, walk):
    """父进程与子进程各持一份同样的栈：子进程每读完一个目录，父进程照同一规则推进，
    子进程卡住或退出时，父进程手里就是还没读的那些。"""
    import tempfile
    command = ([sys.executable, 'media-read'] if getattr(sys, 'frozen', False)
               else [sys.executable, '-m', 'peach.media_io'])
    while stack:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', suffix='.json', delete=False) as listing:
            json.dump(stack, listing)
        current, items, heard = None, [], False
        try:
            try:
                process = subprocess.Popen([*command, 'directories', listing.name, 'walk' if walk else ''],
                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            except OSError as error:
                for directory in reversed(stack):
                    yield directory, error
                return
            try:
                for line in _paced(process.stdout, TIMEOUT_SECONDS, stack[-1]):
                    heard = True
                    message = json.loads(line)
                    if 'reading' in message:
                        if not stack or message['reading'] != stack[-1]:
                            break
                        current, items = stack.pop(), []
                    elif 'entry' in message and current is not None:
                        items.append(message['entry'])
                    elif message.get('done') == len(items) and current is not None:
                        if walk:
                            stack.extend(_subdirectories(items))
                        directory, current = current, None
                        yield directory, [DirectoryEntry(item) for item in items]
                    elif 'error' in message and current is not None:
                        error = OSError(message['error'].get('errno'), message['error']['message'], current)
                        error.hollow = message['error'].get('hollow', False)
                        directory, current = current, None
                        yield directory, error
                    elif 'end' in message:
                        if not stack:
                            return
                        break
                    else:
                        break
            except TimeoutError:
                if current is not None:
                    # 卡在这个目录上：只记它读超时，剩下的换一个子进程接着读。
                    yield current, CodedTimeoutError(errno.ETIMEDOUT, 'errors.mediaIo.readTimedOut',
                                                     filename=current)
                    continue
            except (OSError, ValueError, KeyError):
                pass
            finally:
                process.kill()
                process.wait()
                process.stdout.close()
        finally:
            os.unlink(listing.name)
        # 子进程半途退出或答非所问：读到一半的目录算读不了，剩下的换一个子进程接着读；
        # 一句话都没答就退出的，换几次也一样，剩下的全部算读不了。
        if current is not None:
            yield current, CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=current)
        elif not heard:
            for directory in reversed(stack):
                yield directory, CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=directory)
            return


def _stream_directories(listing, walk):
    """按名单（一个栈，从末尾取）逐个列目录；walk 时把子目录压回栈。每个目录先报 `reading`，
    再逐条报条目，最后报 `done` 或 `error`；全部读完报 `end`。"""
    stack = json.loads(Path(listing).read_text(encoding='utf-8'))
    count = 0
    try:
        while stack:
            directory = stack.pop()
            _emit({'reading': directory})
            items = []
            entries = _local_directory(directory, '')
            while True:
                try:
                    item = next(entries)
                except StopIteration:
                    break
                except OSError as error:
                    failure = dict(kind='os', errno=error.errno, message=str(error))
                    if isinstance(error, FileNotFoundError):
                        try:
                            failure['hollow'] = _hollow(Path(directory))
                        except OSError:
                            failure['hollow'] = False
                    _emit({'error': failure})
                    items = None
                    break
                _emit({'entry': item})
                items.append(item)
            if items is None:
                continue
            _emit({'done': len(items)})
            count += 1
            if walk:
                stack.extend(_subdirectories(items))
        _emit({'end': count})
    except OSError:
        # 父进程已超时离开、管道关闭时，结果没有读取方，不算故障。
        pass
    return 0


def remove_directories(paths):
    """依次删这些空目录，逐个产出 `(目录, 结果)`：`removed` 删掉了，`gone` 已经不在，
    `kept` 不空或是目录链接（照旧留着），删不掉或超时是 OSError。

    一个子进程按给定次序连续删；某个目录超过期限没有回答，它记超时，剩下的换一个子进程接着删。
    调用方中途不删了要关掉生成器，子进程才会被回收。
    """
    import tempfile
    command = ([sys.executable, 'media-read'] if getattr(sys, 'frozen', False)
               else [sys.executable, '-m', 'peach.media_io'])
    pending = [os.fspath(path) for path in reversed(paths)]
    while pending:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', suffix='.json', delete=False) as listing:
            json.dump(list(reversed(pending)), listing)
        current, heard = None, False
        try:
            try:
                process = subprocess.Popen([*command, 'rmdirs', listing.name],
                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            except OSError as error:
                for directory in reversed(pending):
                    yield directory, error
                return
            try:
                for line in _paced(process.stdout, TIMEOUT_SECONDS, pending[-1]):
                    heard = True
                    message = json.loads(line)
                    if 'end' in message:
                        if not pending and current is None:
                            return
                        break
                    if current is None and pending and message.get('removing') == pending[-1]:
                        current = pending.pop()
                    elif 'result' in message and current is not None:
                        directory, current = current, None
                        yield directory, message['result']
                    elif 'error' in message and current is not None:
                        directory, current = current, None
                        yield directory, OSError(message['error'].get('errno'), message['error']['message'], directory)
                    else:
                        break
            except TimeoutError:
                if current is not None:
                    yield current, CodedTimeoutError(errno.ETIMEDOUT, 'errors.mediaIo.readTimedOut', filename=current)
                    continue
            except (OSError, ValueError, KeyError):
                pass
            finally:
                process.kill()
                process.wait()
                process.stdout.close()
        finally:
            os.unlink(listing.name)
        if current is not None:
            yield current, CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=current)
        elif not heard:
            for directory in reversed(pending):
                yield directory, CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=directory)
            return


def remove_directory(path):
    """删一个空目录：`removed`、`gone`（已经不在）或 `kept`（不空、是目录链接）；其他错误照常抛出。"""
    try:
        if os.path.islink(path):
            return 'kept'
        os.rmdir(path)
    except FileNotFoundError:
        # CloudDrive 会在最后一个子项消失时自己收掉空的一层。
        return 'gone'
    except OSError as error:
        if error.errno in {errno.ENOTEMPTY, errno.EEXIST}:
            return 'kept'
        raise
    return 'removed'


def _stream_rmdirs(listing):
    """按名单逐个删目录：每个先报 `removing`，再报 `result` 或 `error`；全部做完报 `end`。"""
    try:
        for path in json.loads(Path(listing).read_text(encoding='utf-8')):
            _emit({'removing': path})
            try:
                _emit({'result': remove_directory(path)})
            except OSError as error:
                _emit({'error': dict(kind='os', errno=error.errno, message=str(error))})
        _emit({'end': True})
    except OSError:
        # 父进程已超时离开、管道关闭时，结果没有读取方，不算故障。
        pass
    return 0


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


def _hollow(path):
    """CloudDrive 上的空目录：`scandir` 报找不到，`listdir` 却说目录在、里面是空的。

    挂载层给空目录列不出 `.` 与 `..`，`FindFirstFileW` 于是回 `ERROR_FILE_NOT_FOUND`；
    `os.listdir` 把它当成空目录。2026-09-27
    """
    return path.is_dir() and not path.is_symlink() and not os.listdir(path)


def paths_present(paths):
    """逐条问这些路径还在不在：True 在，False 不在，None 没答上（读错或超时）。

    本机路径一个子进程问一批；某一条超过期限没有回答，它记 None，剩下的换一个子进程接着问。
    """
    from .smb_media import resolve
    answers = [None] * len(paths)
    local = []
    for index, path in enumerate(paths):
        if resolve(path) is None:
            local.append(index)
            continue
        try:
            _request('stat', path)
            answers[index] = True
        except (FileNotFoundError, NotADirectoryError):
            answers[index] = False
        except OSError:
            pass
    while local:
        answered, stalled = _present_stream([paths[index] for index in local])
        for index, value in zip(local, answered):
            answers[index] = value
        # 卡住的是第一条没答上的那条：记 None，跳过它接着问；子进程自己退出了就不再换。
        local = local[len(answered) + 1:] if stalled else []
    return answers


def _present_stream(paths):
    """一个子进程依次回答 `paths`，返回答上的那几条，以及是不是卡住了（不是自己退出）。

    名单写进本机临时文件交给子进程：命令行装不下几百条网盘路径。
    """
    import tempfile
    command = ([sys.executable, 'media-read'] if getattr(sys, 'frozen', False)
               else [sys.executable, '-m', 'peach.media_io'])
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', suffix='.json', delete=False) as listing:
        json.dump([os.fspath(path) for path in paths], listing)
    answers = []
    stalled = False
    try:
        try:
            process = subprocess.Popen([*command, 'present', listing.name],
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        except OSError:
            return answers, stalled
        try:
            for line in _paced(process.stdout, TIMEOUT_SECONDS, paths[0]):
                answers.append(json.loads(line)['present'])
                if len(answers) == len(paths):
                    break
        except TimeoutError:
            stalled = True
        except (OSError, ValueError, KeyError):
            pass
        finally:
            process.kill()
            process.wait()
            process.stdout.close()
    finally:
        os.unlink(listing.name)
    return answers, stalled


def _stream_present(listing):
    """名单里每个路径答一行；读不出来的答 None，不当成不在。"""
    for path in json.loads(Path(listing).read_text(encoding='utf-8')):
        try:
            os.stat(path)
            value = True
        except (FileNotFoundError, NotADirectoryError):
            value = False
        except OSError:
            value = None
        try:
            _emit({'present': value})
        except OSError:
            return 0
    return 0


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


def main(argv=None):
    parser = argparse.ArgumentParser(description='Read media directories and companion files with a time limit')
    parser.add_argument('operation', choices=OPERATIONS)
    parser.add_argument('path', type=Path)
    parser.add_argument('value', nargs='?', default='')
    args = parser.parse_args(argv)
    if args.operation == 'directory':
        return _stream_directory(args.path, args.value)
    if args.operation == 'present':
        return _stream_present(args.path)
    if args.operation == 'directories':
        return _stream_directories(args.path, args.value == 'walk')
    if args.operation == 'rmdirs':
        return _stream_rmdirs(args.path)
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
