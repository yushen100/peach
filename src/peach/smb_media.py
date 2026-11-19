"""SMB 媒体资源与媒体工具的回环读取入口。"""
from __future__ import annotations

import atexit
import hmac
import io
import errno
import mimetypes
import secrets
import stat
import threading
from contextlib import contextmanager, ExitStack
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import PureWindowsPath
from types import SimpleNamespace
from urllib.parse import quote, unquote, urlsplit

from .os_errors import CodedOSError
from .user_messages import UserPermissionError, UserValueError


def address(value: str) -> tuple[str, str, tuple[str, ...], int]:
    """解析不含凭据的共享地址；路径始终限定在一个共享内。"""
    try:
        parsed = urlsplit(value)
        port = parsed.port or 445
    except ValueError:
        raise UserValueError("errors.smbMedia.addressInvalid") from None
    if (parsed.scheme != 'smb' or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment
            or not 1 <= port <= 65535 or any(ord(c) < 33 or c in '\\/%' for c in parsed.hostname)):
        raise UserValueError("errors.smbMedia.addressFormat")
    parts = tuple(unquote(part) for part in parsed.path.split('/') if part)
    if not parts or any(part in {'.', '..'} or any(c in part for c in '\\/:\x00')
                        or any(ord(c) < 32 for c in part) for part in parts):
        raise UserValueError("errors.smbMedia.sharePathInvalid")
    return parsed.hostname, parts[0], parts[1:], port


def canonical(value: str) -> str:
    host, share, tail, port = address(value)
    host = f'[{host}]' if ':' in host else host.lower()
    return 'smb://' + host + (f':{port}' if port != 445 else '') + '/' + '/'.join(
        quote(part, safe='') for part in (share, *tail))


def is_address(value) -> bool:
    return isinstance(value, str) and value.startswith('smb://')


def source_identity(value):
    """将本进程媒体工具的回环地址还原为账本路径。"""
    if _BRIDGE is None or not isinstance(value, str):
        return value
    prefix = f'http://127.0.0.1:{_BRIDGE.server.server_port}/{_BRIDGE.secret}/'
    if not value.startswith(prefix):
        return value
    with _BRIDGE.lock:
        resource = _BRIDGE.resources.get(value[len(prefix):])
    return str(resource) if resource is not None else value


def credential_store(config):
    from .follow_secrets import CredentialStore
    return CredentialStore(config.directory('secrets'))


def save_credentials(config, sources):
    store = credential_store(config)
    for row in sources:
        if not is_address(row.get('path')):
            continue
        root_id = next((key for key, value in config.storage_roots.items()
                        if value.get('transport') == 'smb'
                        and canonical(value['mount']) == canonical(row['path'])), None)
        if root_id is None:
            raise UserValueError('errors.smbMedia.rootIdentityInvalid')
        key = 'smb-' + root_id
        previous = store.load(key)
        values = dict(previous.values) if previous else {}
        if row.get('smb_clear') is True:
            store.clear(key)
            if _BRIDGE is not None:
                _BRIDGE.invalidate(root_id)
            continue
        username = row.get('smb_username', values.get('username', ''))
        password = row.get('smb_password', '')
        if not isinstance(username, str) or not isinstance(password, str):
            raise UserValueError('errors.smbMedia.credentialsNotText')
        if username != values.get('username', ''):
            values.pop('password', None)
        values['username'] = username
        if password:
            values['password'] = password
        if row.get('smb_encrypt') is not None:
            values['encrypt'] = 'true' if row['smb_encrypt'] is True else 'false'
        if values != (previous.values if previous else {}):
            store.save(key, values)
            if _BRIDGE is not None:
                _BRIDGE.invalidate(root_id)


@contextmanager
def credential_transaction(config, sources):
    """配置文件替换失败时恢复本次涉及的本机凭据。"""
    store = credential_store(config)
    keys = {'smb-' + key for key, value in config.storage_roots.items()
            if value.get('transport') == 'smb'
            and any(is_address(row.get('path')) and canonical(row['path']) == canonical(value['mount'])
                    for row in sources)}
    previous = {key: store.load(key) for key in keys}
    try:
        save_credentials(config, sources)
        yield
    except BaseException:
        for key, credential in previous.items():
            if credential is None:
                store.clear(key)
            else:
                store.save(key, credential.values)
        raise


def connection_for(config, root_id: str, uri: str):
    from .smb_transport import SmbConnection
    host, share, _tail, port = address(uri)
    credential = credential_store(config).load('smb-' + root_id)
    values = credential.values if credential else {}
    return SmbConnection(host, share, username=values.get('username', ''),
                         password=values.get('password', ''), port=port,
                         encrypt=values.get('encrypt') == 'true', timeout=8)


@dataclass(frozen=True)
class SmbResource:
    """以账本路径标识的远端资源；不实现操作系统路径协议。"""
    root_id: str
    ledger_root: str
    uri: str
    relative: tuple[str, ...]
    connection: object

    def __str__(self):
        return str(PureWindowsPath(self.ledger_root, *self.relative))

    @property
    def name(self):
        _host, share, tail, _port = address(self.uri)
        return self.relative[-1] if self.relative else tail[-1] if tail else share

    @property
    def suffix(self):
        return PureWindowsPath(self.name).suffix

    @property
    def stem(self):
        return PureWindowsPath(self.name).stem

    @property
    def parent(self):
        return self.child_relative(self.relative[:-1])

    @property
    def parts(self):
        return PureWindowsPath(str(self)).parts

    @property
    def parents(self):
        return tuple(self.child_relative(self.relative[:index]) for index in reversed(range(len(self.relative))))

    def resolve(self):
        return self

    def is_symlink(self):
        self.stat()
        return False

    def child_relative(self, relative):
        from dataclasses import replace
        parts = tuple(relative)
        if any(part in {'.', '..'} or any(c in part for c in '/\\:\x00') for part in parts):
            raise UserValueError('errors.smbMedia.outsideRoot')
        return replace(self, relative=parts)

    def joinpath(self, *parts):
        return self.child_relative((*self.relative, *parts))

    def __truediv__(self, part):
        return self.joinpath(part)

    def relative_to(self, other):
        return PureWindowsPath(str(self)).relative_to(PureWindowsPath(str(other)))

    def is_relative_to(self, other):
        return PureWindowsPath(str(self)).is_relative_to(PureWindowsPath(str(other)))

    def with_name(self, name):
        return self.parent / name

    def with_suffix(self, suffix):
        return self.with_name(str(PureWindowsPath(self.name).with_suffix(suffix)))

    def is_dir(self):
        try:
            return self.stat().is_dir
        except FileNotFoundError:
            return False

    def exists(self):
        try:
            self.stat()
            return True
        except FileNotFoundError:
            return False

    def _transport(self):
        from .smb_transport import SmbTransport
        return SmbTransport(self.connection)

    @property
    def remote_parts(self):
        return (*address(self.uri)[2], *self.relative)

    def stat(self, *, with_identity: bool = False):
        transport = self._transport()
        try:
            info = transport.stat(self.remote_parts, with_identity=True) if with_identity else transport.stat(self.remote_parts)
            return SimpleNamespace(st_size=info.size, st_mtime=info.mtime, st_mtime_ns=info.mtime_ns,
                                   st_mode=stat.S_IFDIR if info.is_dir else stat.S_IFREG, is_dir=info.is_dir,
                                   st_ino=info.file_index if with_identity else 0, st_dev=self.uri)
        finally:
            transport.close()

    def is_file(self):
        try:
            return not self.stat().is_dir
        except FileNotFoundError:
            return False

    def open(self, mode='rb'):
        if mode not in ('rb', 'wb', 'xb', 'ab', 'r+b'):
            raise ValueError(f'unsupported SMB file mode: {mode}')
        if mode != 'rb' and not self.relative:
            raise UserPermissionError('errors.smbMedia.rootNotWritable')
        transport = self._transport()
        try:
            handle = (transport.open(self.remote_parts) if mode == 'rb' else
                      transport.open_write(self.remote_parts, mode))
        except BaseException:
            transport.close()
            raise
        return _OwnedReader(handle, transport)

    def read_bytes(self):
        with self.open() as handle:
            return handle.read()

    def read_text(self, encoding='utf-8', errors='strict'):
        return self.read_bytes().decode(encoding, errors)

    def write_bytes(self, data):
        with self.open('wb') as handle:
            return handle.write(data)

    def write_text(self, data, encoding='utf-8', errors='strict'):
        self.write_bytes(data.encode(encoding, errors))
        return len(data)

    def rename(self, target):
        if not isinstance(target, SmbResource) or target.root_id != self.root_id or target.uri != self.uri:
            raise CodedOSError(errno.EXDEV, 'errors.smbMedia.renameAcrossRoots')
        if not self.relative or not target.relative:
            raise UserPermissionError('errors.smbMedia.rootNotRenamable')
        with self._transport() as transport:
            transport.rename(self.remote_parts, target.remote_parts)
        return target

    def unlink(self, missing_ok=False):
        if not self.relative:
            raise UserPermissionError('errors.smbMedia.rootNotDeletable')
        try:
            with self._transport() as transport:
                transport.unlink(self.remote_parts)
        except FileNotFoundError:
            if not missing_ok:
                raise

    def rmdir(self):
        if not self.relative:
            raise UserPermissionError('errors.smbMedia.rootNotDeletable')
        with self._transport() as transport:
            transport.unlink(self.remote_parts, directory=True)

    def mkdir(self, mode=0o777, parents=False, exist_ok=False):
        if not self.relative:
            if exist_ok and self.is_dir():
                return
            raise UserPermissionError('errors.smbMedia.rootNotReplaceable')
        if parents:
            self.parent.mkdir(mode, parents=True, exist_ok=True)
        try:
            with self._transport() as transport:
                transport.mkdir(self.remote_parts)
        except FileExistsError:
            if not exist_ok or not self.is_dir():
                raise

    def scandir(self, transport=None):
        """列目录。给 `transport` 时沿用调用方的连接，由调用方负责关闭。"""
        if transport is not None:
            return transport.scandir(self.remote_parts)
        transport = self._transport()
        try:
            return transport.scandir(self.remote_parts)
        finally:
            transport.close()


class _OwnedReader(io.IOBase):
    def __init__(self, handle, transport):
        self.handle, self.transport = handle, transport

    def read(self, size=-1):
        return self.handle.read(size)

    def write(self, data):
        if not self.writable():
            raise io.UnsupportedOperation('SMB handle is not writable')
        return self.handle.write(data)

    def flush(self):
        if not self.handle.closed and hasattr(self.handle, 'flush'):
            self.handle.flush()

    def seek(self, offset, whence=0):
        return self.handle.seek(offset, whence)

    def tell(self):
        return self.handle.tell()

    def stat(self):
        return self.handle.stat()

    def close(self):
        if not self.closed:
            try:
                self.flush()
            finally:
                try:
                    self.handle.close()
                finally:
                    self.transport.close()
                    super().close()

    def readable(self):
        return True

    def writable(self):
        return hasattr(self.handle, 'write')

    def seekable(self):
        return True


def resolve(raw, config=None):
    """仅解析已声明的 SMB 根；普通本机文件返回 None。"""
    if isinstance(raw, SmbResource):
        return raw
    from . import media_identity, settings_file
    from .platform import resolve_root
    config = config or settings_file.active()
    if not any(value.get('transport') == 'smb' for value in getattr(config, 'storage_roots', {}).values()):
        return None
    location, index, tail = resolve_root(str(raw), config.locations)
    if location is None:
        return None
    declared = config.locations[location][index]
    roots = media_identity.catalog(config)[1]
    found = next(((key, value) for key, value in roots.items()
                  if media_identity.path_key(value['root']) == media_identity.path_key(declared)), None)
    if found is None or found[1].get('transport') != 'smb':
        return None
    key, value = found
    return SmbResource(key, declared, value['mount'], tail, connection_for(config, key, value['mount']))


def input_url(source):
    """本机路径原样交给工具；SMB 资源生成进程内有效的回环地址。"""
    resource = resolve(source)
    return _bridge().register(resource) if resource else str(source)


def byte_range(header, size):
    if not header:
        return 0, size - 1, 200
    if not header.startswith('bytes=') or ',' in header:
        raise ValueError('range')
    left, separator, right = header[6:].partition('-')
    if not separator:
        raise ValueError('range')
    if left:
        start, end = int(left), min(int(right) if right else size - 1, size - 1)
    else:
        suffix = int(right)
        if suffix <= 0:
            raise ValueError('range')
        start, end = max(0, size - suffix), size - 1
    if start < 0 or start >= size or end < start:
        raise ValueError('range')
    return start, end, 206


class _Bridge:
    def __init__(self):
        self.resources = {}
        self.lock = threading.Lock()
        self.secret = secrets.token_urlsafe(32)
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def do_HEAD(self):
                self.do_GET()

            def do_GET(self):
                pieces = self.path.split('/')
                if len(pieces) != 3 or not hmac.compare_digest(pieces[1], owner.secret):
                    self.send_error(404)
                    return
                with owner.lock:
                    resource = owner.resources.get(pieces[2])
                if resource is None:
                    self.send_error(404)
                    return
                try:
                    with ExitStack() as stack:
                        handle = stack.enter_context(resource.open()) if self.command != 'HEAD' else None
                        self.transfer(resource, handle)
                except (OSError, ValueError):
                    self.close_connection = True

            def transfer(self, resource, handle):
                size = (handle.stat() if handle is not None and hasattr(handle, 'stat') else resource.stat()).st_size
                try:
                    start, end, status = byte_range(self.headers.get('Range'), size)
                except ValueError:
                    self.send_response(416)
                    self.send_header('Content-Range', f'bytes */{size}')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                self.send_response(status)
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Length', str(max(0, end - start + 1)))
                self.send_header('Content-Type', mimetypes.guess_type(resource.name)[0] or 'application/octet-stream')
                if status == 206:
                    self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
                self.end_headers()
                if self.command == 'HEAD':
                    return
                handle.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    block = handle.read(min(1 << 20, remaining))
                    if not block:
                        raise OSError('SMB file changed while streaming')
                    self.wfile.write(block)
                    remaining -= len(block)

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=self.server.serve_forever, name='PeachSmbInput', daemon=True)
        self.thread.start()

    def register(self, resource):
        import hashlib
        key = hashlib.sha256((resource.root_id + '\0' + str(resource)).encode()).hexdigest()
        with self.lock:
            if len(self.resources) >= 2048 and key not in self.resources:
                self.resources.pop(next(iter(self.resources)))
            self.resources[key] = resource
        return f'http://127.0.0.1:{self.server.server_port}/{self.secret}/{key}'

    def invalidate(self, root_id):
        with self.lock:
            self.resources = {key: value for key, value in self.resources.items() if value.root_id != root_id}

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


_BRIDGE = None
_BRIDGE_LOCK = threading.Lock()


def _bridge():
    global _BRIDGE
    with _BRIDGE_LOCK:
        if _BRIDGE is None:
            _BRIDGE = _Bridge()
        return _BRIDGE


def close_bridge():
    global _BRIDGE
    with _BRIDGE_LOCK:
        if _BRIDGE is not None:
            _BRIDGE.close()
            _BRIDGE = None


atexit.register(close_bridge)
