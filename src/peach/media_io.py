"""在可终止的子进程中访问媒体挂载；账本与任务状态由调用方保存。"""
from __future__ import annotations

import argparse
import base64
import errno
import json
import os
import pickle
import shutil
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
OPERATIONS = ('directory', 'files', 'nfo', 'art', 'online', 'resolve', 'stat', 'browse', 'volume', 'serve', 'present', 'directories', 'rmdirs')


#: 请求路径上一次挂载读取的期限。播放、缩略图、字幕这类请求不能为一个答不上的网盘一直挂着。
REQUEST_TIMEOUT_SECONDS = 10.0
#: 同一挂载上同时在等的读取上限；超出的请求直接按超时回，不再多开线程。
REQUEST_SLOTS_PER_MOUNT = 16
#: 挂载上有读取卡着时，隔这么久放一个请求过去试：答上了就整个挂载放行。
REQUEST_RETRY_SECONDS = 30.0
#: 全进程超了期还没回的读取线程上限；到了就不再放请求去试卡着的挂载，免得线程越积越多。
MAX_STUCK_READS = 64

_bounded_lock = threading.Lock()
_bounded_active: dict = {}
#: 挂载名 → 下一次放请求去试的时刻。挂载卡着时才有这一项。
_bounded_stuck: dict = {}
#: 超了期还没回的读取，按挂载记。挂载放行后仍留着计数，线程真正返回才去掉。
_bounded_late: dict = {}


def mount_key(path):
    """`bounded` 用来分组的挂载名：盘符或 UNC 共享、POSIX 前两级目录、SMB 来源的 root_id。"""
    root_id = getattr(path, 'root_id', None)
    if root_id is not None:
        return f'smb:{root_id}'
    text = os.fspath(path)
    if os.name == 'nt':
        from pathlib import PureWindowsPath
        pure = PureWindowsPath(text)
        return (pure.drive or pure.anchor or text).casefold()
    from pathlib import PurePosixPath
    return str(PurePosixPath(*PurePosixPath(text).parts[:3]))


def _release(key, box):
    """读取线程返回时清账；调用方不持锁。卡着的读取都回来了，挂载自然放行。"""
    with _bounded_lock:
        remaining = _bounded_active.get(key, 1) - 1
        if remaining:
            _bounded_active[key] = remaining
        else:
            _bounded_active.pop(key, None)
        late = _bounded_late.get(key)
        if late is not None:
            late.discard(box)
            if not late:
                _bounded_late.pop(key, None)
                _bounded_stuck.pop(key, None)


def _admit(key):
    """调用方持 `_bounded_lock`：这次读取放不放行。挂载卡着时只按间隔放一个去试。"""
    if _bounded_active.get(key, 0) >= REQUEST_SLOTS_PER_MOUNT:
        return False
    retry_at = _bounded_stuck.get(key)
    if retry_at is None:
        return True
    import time
    now = time.monotonic()
    if now < retry_at or sum(len(calls) for calls in _bounded_late.values()) >= MAX_STUCK_READS:
        return False
    _bounded_stuck[key] = now + REQUEST_RETRY_SECONDS
    return True


def bounded(key, call, *args, timeout=None, **kwargs):
    """在请求路径上带期限地做一次挂载读取，到期抛超时（`OSError` 的子类）。

    子进程（`file_stat` 等）每次要起一个解释器，约 150 毫秒，放不进每个 Range 请求和一屏几十张
    缩略图；这里改在后台线程里读，调用方只等到期限。卡住的那次读取收不回来，线程照旧挂着；
    为免越挂越多，同一挂载（`key`）上有读取超了期还没返回时，后来的请求不再开线程，直接按超时回。
    那次读取自己返回，或隔 `REQUEST_RETRY_SECONDS` 放过去试的一个请求在期限内答上了，挂载就放行：
    一次丢在挂载层里永远不回的读取，不能让整个盘到重启前都打不开。线程不占 anyio 的线程池，
    `/healthz` 不受连累。
    """
    import time
    from concurrent.futures import Future, wait
    with _bounded_lock:
        if not _admit(key):
            raise CodedTimeoutError(errno.ETIMEDOUT, 'errors.mediaIo.readTimedOut', filename=str(key))
        _bounded_active[key] = _bounded_active.get(key, 0) + 1
    box = Future()

    def run():
        try:
            box.set_result(call(*args, **kwargs))
        except BaseException as error:
            box.set_exception(error)
        finally:
            _release(key, box)
    try:
        threading.Thread(target=run, name='PeachMediaDeadline', daemon=True).start()
    except RuntimeError:
        _release(key, box)
        raise CodedOSError(errno.EIO, 'errors.mediaIo.readerFailed', filename=str(key)) from None
    wait([box], timeout=REQUEST_TIMEOUT_SECONDS if timeout is None else timeout)
    with _bounded_lock:
        # 读取线程先交结果再取锁清账，这里在锁内看 done，两边不会错过对方。
        if not box.done():
            _bounded_late.setdefault(key, set()).add(box)
            _bounded_stuck.setdefault(key, time.monotonic() + REQUEST_RETRY_SECONDS)
            late = True
        else:
            late = False
            error = box.exception()
            if error is None or (isinstance(error, OSError) and not isinstance(error, TimeoutError)):
                # 期限内答上了（读到了，或报了文件系统错误）：挂载在应答，卡着的那几次不再拦后来的请求。
                _bounded_stuck.pop(key, None)
    if late:
        raise CodedTimeoutError(errno.ETIMEDOUT, 'errors.mediaIo.readTimedOut', filename=str(key))
    return box.result()


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

    def is_file(self):
        """跟随链接后不是目录、类型也读得出来；口径同 `os.DirEntry.is_file` 对普通文件的回答。"""
        return not self.directory and not self.error

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
    if operation == 'volume':
        return _volume(path, system=value == 'system')
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
