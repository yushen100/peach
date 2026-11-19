"""固定共享根的 SMB 传输；每个实例独占连接、会话及请求期限。"""

from __future__ import annotations

import errno
import io
import logging
import math
import ntpath
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from types import SimpleNamespace

import smbclient
from smbclient._io import _chunk_size, SMBFileTransaction, query_info, set_info
from smbprotocol.connection import Connection
from smbprotocol.exceptions import (
    NoMoreFiles, NoSuchFile, SMBAuthenticationError, SMBOSError, SMBResponseException,
)
from smbprotocol.file_info import (
    FileAttributes, FileInformationClass, FileRenameInformation,
    FileDispositionInformation, FileEndOfFileInformation, FileInternalInformation,
)
from smbprotocol.header import NtStatus
from smbprotocol.open import (
    CreateDisposition, CreateOptions, FilePipePrinterAccessMask,
    ImpersonationLevel, Open, QueryDirectoryFlags, ShareAccess,
)
from smbprotocol.tree import TreeConnect

from .os_errors import CodedOSError, CodedPermissionError, CodedTimeoutError
from .user_messages import UserValueError


# SDK 的 INFO/DEBUG 记录包含会话用户名与认证报文。
for _namespace in ("smbprotocol", "smbclient"):
    logging.getLogger(_namespace).setLevel(logging.WARNING)

#: 只关乎单个路径的错误，连接仍可继续使用；其余错误视为连接已不可用。
PATH_ERRNOS = frozenset({errno.ENOENT, errno.EACCES, errno.EPERM, errno.EISDIR, errno.ENOTDIR})


@dataclass(frozen=True)
class SmbConnection:
    host: str
    share: str
    username: str = field(default="", repr=False)
    password: str = field(default="", repr=False)
    port: int = 445
    encrypt: bool = False
    timeout: float = 8

    def __post_init__(self):
        for value in (self.host, self.share):
            if not value or any(c in value for c in "\\/\x00") or value in (".", ".."):
                raise UserValueError("errors.smbTransport.hostShareNotComponent")
        if not 0 < self.port <= 65535:
            raise UserValueError("errors.smbTransport.invalidPort")
        if not math.isfinite(self.timeout) or self.timeout <= 0:
            raise UserValueError("errors.smbTransport.invalidTimeout")


@dataclass(frozen=True)
class SmbStat:
    size: int
    mtime: float
    mtime_ns: int
    is_dir: bool
    name: str
    file_index: int = field(default=0, kw_only=True)

    @property
    def st_size(self):
        return self.size

    @property
    def st_mtime(self):
        return self.mtime

    @property
    def st_mtime_ns(self):
        return self.mtime_ns


@dataclass(frozen=True)
class SmbEntry(SmbStat):
    is_symlink: bool = False


def _parts(relative: tuple[str, ...] | str) -> tuple[str, ...]:
    if isinstance(relative, str):
        if ntpath.isabs(relative) or ntpath.splitdrive(relative)[0]:
            raise UserValueError("errors.smbTransport.pathNotRelative")
        parts = tuple(relative.replace("\\", "/").split("/")) if relative else ()
    elif isinstance(relative, tuple):
        parts = relative
    else:
        raise TypeError("SMB path must be a string or a tuple of path components")
    for part in parts:
        if (not isinstance(part, str) or not part or part in (".", "..")
                or any(c in part for c in "\\/:\x00*?\"<>|")
                or any(ord(c) < 32 for c in part) or part.endswith((" ", "."))):
            raise UserValueError("errors.smbTransport.invalidPathComponent")
    return parts


def _timestamp(value: datetime) -> tuple[float, int]:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    delta = value - datetime(1970, 1, 1, tzinfo=timezone.utc)
    ns = ((delta.days * 86400 + delta.seconds) * 1_000_000 + delta.microseconds) * 1000
    return ns / 1_000_000_000, ns


def _request_failed() -> str:
    """SDK 没给出原因时的兜底说明。仍是内置 `OSError`：按错误号自动成为 `FileNotFoundError` 等子类，
    上层按子类与 `PATH_ERRNOS` 区分，所以这里只换文字来源（zh-CN 渲染）、不换类型。"""
    from . import interface_text
    return interface_text.text("server:errors.smbTransport.requestFailed")


def _error(exc: Exception, filename: str | None = None) -> OSError:
    """转成标准 `OSError`；打开文件时带上共享内路径，诊断据此区分输入缺失与代码缺陷。"""
    if isinstance(exc, SMBAuthenticationError):
        return CodedPermissionError(errno.EACCES, "errors.smbTransport.authenticationFailed")
    if isinstance(exc, SMBResponseException):
        if exc.status in (NtStatus.STATUS_ACCESS_DENIED, NtStatus.STATUS_LOGON_FAILURE,
                          NtStatus.STATUS_STOPPED_ON_SYMLINK):
            return CodedPermissionError(errno.EACCES, "errors.smbTransport.accessDenied", filename=filename)
        mapped = SMBOSError(exc.status, "SMB share")
        return OSError(mapped.errno or errno.EIO, mapped.strerror or _request_failed(), filename)
    if isinstance(exc, SMBOSError):
        return OSError(exc.errno or errno.EIO, exc.strerror or _request_failed(), filename)
    if isinstance(exc, OSError):
        return exc
    return CodedOSError(errno.ENETUNREACH, "errors.smbTransport.connectionUnavailable")


class _DeadlineConnection(Connection):
    """在库的响应事件上等待绝对期限，关闭自动符号链接解析。"""

    def __init__(self, config: SmbConnection):
        super().__init__(uuid.uuid4(), config.host, config.port)
        self.request_timeout = config.timeout
        self._cancelling = False

    def receive(self, request, wait=True, timeout=None, resolve_symlinks=False):
        budget = self.request_timeout if timeout is None else min(timeout, self.request_timeout)
        deadline = time.monotonic() + budget
        sent_deadline = getattr(request, "_peach_deadline", None)
        if isinstance(sent_deadline, (float, int)):
            deadline = min(deadline, sent_deadline)
        try:
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not request.response_event.wait(remaining):
                    raise CodedTimeoutError(errno.ETIMEDOUT, "errors.smbTransport.requestTimedOut")
                with request.response_event_lock:
                    self._check_worker_running()
                    status = request.response["status"].get_value()
                    if status == NtStatus.STATUS_PENDING and wait:
                        request.response_event.clear()
                        continue
                return super().receive(request, wait=False, timeout=remaining, resolve_symlinks=False)
        except TimeoutError:
            self._cancelling = True
            try:
                request.cancel()
            except Exception:
                pass
            finally:
                self.disconnect(close=False)
            raise

    def send(self, *args, **kwargs):
        deadline = time.monotonic() + self.request_timeout
        self._bound_socket()
        request = super().send(*args, **kwargs)
        request._peach_deadline = deadline
        return request

    def send_compound(self, *args, **kwargs):
        deadline = time.monotonic() + self.request_timeout
        self._bound_socket()
        requests = super().send_compound(*args, **kwargs)
        for request in requests:
            request._peach_deadline = deadline
        return requests

    def _bound_socket(self):
        # 限制发送及取消消息的 socket 等待；响应读取由独立的库接收线程负责。
        if self.transport is not None and self.transport.connected:
            timeout = min(self.request_timeout, .05) if self._cancelling else self.request_timeout
            self.transport._sock.settimeout(timeout)


class SmbTransport:
    """独占会话的传输；close 中止所属句柄，失败请求不自动重连。"""

    def __init__(self, connection: SmbConnection):
        self.connection = connection
        self._cache: dict = {}
        self._conn = None
        self._tree = None
        self._closed = False
        self._lock = threading.RLock()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def _connect(self):
        with self._lock:
            if self._closed:
                raise CodedOSError(errno.EBADF, "errors.smbTransport.transportClosed")
            if self._conn is not None:
                if not self._conn.transport.connected:
                    raise CodedOSError(errno.ENETDOWN, "errors.smbTransport.disconnected")
                return self._tree
            config = self.connection
            self._conn = conn = _DeadlineConnection(config)
            try:
                if self._closed:
                    raise CodedOSError(errno.ENETDOWN, "errors.smbTransport.connectionClosed")
                conn.connect(timeout=config.timeout)
                if self._closed:
                    raise CodedOSError(errno.ENETDOWN, "errors.smbTransport.connectionClosed")
                self._cache[f"{config.host.lower()}:{config.port}"] = conn
                session = smbclient.register_session(
                    config.host, username=config.username or None, password=config.password or None,
                    port=config.port, encrypt=config.encrypt, connection_timeout=config.timeout,
                    connection_cache=self._cache,
                )
                self._tree = TreeConnect(session, f"\\\\{config.host}\\{config.share}")
                self._tree.connect()
                if self._closed:
                    raise CodedOSError(errno.ENETDOWN, "errors.smbTransport.connectionClosed")
                if self._tree.is_dfs_share:
                    raise CodedPermissionError(errno.EACCES, "errors.smbTransport.dfsNotAllowed")
                return self._tree
            except Exception as exc:
                self.close()
                raise _error(exc) from None

    def close(self):
        self._closed = True
        self._cache.clear()
        if self._conn is not None and self._conn.transport is not None:
            # 直接关闭所属 socket，不发需要等待响应的逐句柄注销请求。
            self._conn.disconnect(close=False)

    def _open_fd(self, parts, *, data=False, directory=False, access_extra=0,
                 disposition=CreateDisposition.FILE_OPEN):
        tree = self._connect()
        fd = Open(tree, "\\".join(parts))
        access = FilePipePrinterAccessMask.FILE_READ_ATTRIBUTES | access_extra
        if data:
            access |= FilePipePrinterAccessMask.FILE_READ_DATA
        options = CreateOptions.FILE_OPEN_REPARSE_POINT
        if directory:
            options |= CreateOptions.FILE_DIRECTORY_FILE
        elif data:
            options |= CreateOptions.FILE_NON_DIRECTORY_FILE
        try:
            fd.create(
                ImpersonationLevel.Impersonation, access, FileAttributes.FILE_ATTRIBUTE_NORMAL,
                ShareAccess.FILE_SHARE_READ, disposition, options,
            )
            if fd.file_attributes & FileAttributes.FILE_ATTRIBUTE_REPARSE_POINT:
                raise CodedPermissionError(errno.EACCES, "errors.smbTransport.reparsePoint")
            return fd
        except Exception as exc:
            if fd.connected:
                self._close_fd(fd)
            error = _error(exc, "\\".join(parts))
            if error.errno not in PATH_ERRNOS:
                self.close()
            raise error from None

    def _close_fd(self, fd):
        if self._conn.transport.connected:
            try:
                fd.close()
            except Exception as exc:
                self.close()
                raise _error(exc) from None

    def _check_parents(self, parts):
        # 每个祖先以重解析点自身打开；读共享锁阻止检查期间的替换和删除。
        parents = []
        try:
            for index in range(1, len(parts)):
                parents.append(self._open_fd(parts[:index], directory=True))
            return parents
        except Exception:
            for fd in reversed(parents):
                self._close_fd(fd)
            raise

    def stat(self, relative: tuple[str, ...] | str, *, with_identity: bool = False) -> SmbStat:
        parts = _parts(relative)
        parents = self._check_parents(parts)
        fd = None
        try:
            fd = self._open_fd(parts)
            mtime, ns = _timestamp(fd.last_write_time)
            file_index = self._file_index(fd) if with_identity else 0
            return SmbStat(fd.end_of_file, mtime, ns,
                           bool(fd.file_attributes & FileAttributes.FILE_ATTRIBUTE_DIRECTORY),
                           parts[-1] if parts else self.connection.share, file_index=file_index)
        finally:
            for item in ([fd] if fd is not None else []) + list(reversed(parents)):
                self._close_fd(item)

    def _file_index(self, fd) -> int:
        """查询共享卷的持久文件号，不能使用仅对当前打开句柄有效的 ID。"""
        raw = SimpleNamespace(fd=fd, closed=False, name=fd.file_name)
        try:
            with SMBFileTransaction(raw) as transaction:
                query_info(transaction, FileInternalInformation)
            return transaction.results[0]["index_number"].get_value()
        except SMBOSError as error:
            if error.ntstatus not in (NtStatus.STATUS_INVALID_INFO_CLASS, NtStatus.STATUS_NOT_SUPPORTED):
                raise _error(error) from None
            return 0

    def scandir(self, relative: tuple[str, ...] | str) -> list[SmbEntry]:
        parts = _parts(relative)
        parents = self._check_parents(parts)
        fd = None
        try:
            fd = self._open_fd(parts, data=True, directory=True)
            result = []
            flags = QueryDirectoryFlags.SMB2_RESTART_SCANS
            while True:
                try:
                    page = fd.query_directory("*", FileInformationClass.FILE_ID_FULL_DIRECTORY_INFORMATION,
                                              flags=flags)
                except (NoMoreFiles, NoSuchFile):
                    break
                flags = 0
                if not page:
                    break
                for entry in page:
                    name = entry["file_name"].get_value().decode("utf-16-le")
                    if name in (".", ".."):
                        continue
                    _parts((name,))
                    attributes = entry["file_attributes"].get_value()
                    mtime, ns = _timestamp(entry["last_write_time"].get_value())
                    result.append(SmbEntry(
                        entry["end_of_file"].get_value(), mtime, ns,
                        bool(attributes & FileAttributes.FILE_ATTRIBUTE_DIRECTORY), name,
                        bool(attributes & FileAttributes.FILE_ATTRIBUTE_REPARSE_POINT),
                    ))
            return result
        except Exception as exc:
            raise _error(exc) from None
        finally:
            for item in ([fd] if fd is not None else []) + list(reversed(parents)):
                self._close_fd(item)

    def open(self, relative: tuple[str, ...] | str):
        parts = _parts(relative)
        parents = self._check_parents(parts)
        try:
            return _SmbReader(self, self._open_fd(parts, data=True), parents)
        except Exception:
            for fd in reversed(parents):
                self._close_fd(fd)
            raise

    def _set_info(self, fd, info):
        """复用 SDK 的 SET_INFO 编码与响应检查，沿用本实例请求期限。"""
        raw = SimpleNamespace(fd=fd, closed=False, name=fd.file_name)
        with SMBFileTransaction(raw) as transaction:
            set_info(transaction, info)

    def _mutate(self, parts, operation, *, directory=False, disposition=CreateDisposition.FILE_OPEN):
        parts = _parts(parts)
        if not parts:
            raise CodedPermissionError(errno.EACCES, "errors.smbTransport.rootNotModifiable")
        parents = self._check_parents(parts)
        fd = None
        try:
            fd = self._open_fd(parts, directory=directory,
                               access_extra=FilePipePrinterAccessMask.DELETE,
                               disposition=disposition)
            operation(fd)
        except Exception as exc:
            raise _error(exc) from None
        finally:
            for item in ([fd] if fd is not None else []) + list(reversed(parents)):
                self._close_fd(item)

    def rename(self, source, target):
        target = _parts(target)
        if not target:
            raise CodedPermissionError(errno.EACCES, "errors.smbTransport.rootNotReplaceable")
        parents = self._check_parents(target)
        try:
            info = FileRenameInformation()
            info['replace_if_exists'] = False
            info['file_name'] = '\\'.join(target)
            self._mutate(source, lambda fd: self._set_info(fd, info))
        finally:
            for fd in reversed(parents):
                self._close_fd(fd)

    def unlink(self, relative, *, directory=False):
        info = FileDispositionInformation()
        info['delete_pending'] = True
        self._mutate(relative, lambda fd: self._set_info(fd, info), directory=directory)

    def mkdir(self, relative):
        self._mutate(relative, lambda _fd: None, directory=True, disposition=CreateDisposition.FILE_CREATE)

    def open_write(self, relative, mode='wb'):
        if mode not in ('wb', 'xb', 'ab', 'r+b'):
            raise ValueError('invalid SMB write mode')
        parts = _parts(relative)
        if not parts:
            raise CodedPermissionError(errno.EACCES, "errors.smbTransport.rootNotWritable")
        parents = self._check_parents(parts)
        fd = None
        try:
            disposition = (CreateDisposition.FILE_CREATE if mode == 'xb' else
                           CreateDisposition.FILE_OPEN if mode == 'r+b' else CreateDisposition.FILE_OPEN_IF)
            fd = self._open_fd(parts, data=True, access_extra=FilePipePrinterAccessMask.FILE_WRITE_DATA,
                               disposition=disposition)
            if mode == 'wb':
                info = FileEndOfFileInformation()
                info['end_of_file'] = 0
                self._set_info(fd, info)
                fd.end_of_file = 0
            writer = _SmbWriter(self, fd, parents)
            if mode == 'ab':
                writer.seek(0, io.SEEK_END)
            return writer
        except Exception as exc:
            for item in ([fd] if fd is not None else []) + list(reversed(parents)):
                self._close_fd(item)
            raise _error(exc) from None


class _SmbReader:
    def __init__(self, transport, fd, parents):
        self._transport, self._fd, self._parents = transport, fd, parents
        self._offset = 0
        self._lock = threading.Lock()
        self.closed = False

    def __enter__(self):
        self._check()
        return self

    def __exit__(self, *_):
        self.close()

    def _check(self):
        if self.closed:
            raise ValueError("SMB file is closed")
        if self._transport._closed or not self._fd.connection.transport.connected:
            raise CodedOSError(errno.ENETDOWN, "errors.smbTransport.disconnected")

    def tell(self):
        self._check()
        return self._offset

    def stat(self):
        self._check()
        mtime, ns = _timestamp(self._fd.last_write_time)
        return SmbStat(self._fd.end_of_file, mtime, ns, False, '')

    def seek(self, offset, whence=io.SEEK_SET):
        with self._lock:
            self._check()
            if whence not in (io.SEEK_SET, io.SEEK_CUR, io.SEEK_END):
                raise ValueError("invalid SMB seek whence")
            target = (0, self._offset, self._fd.end_of_file)[whence] + offset
            if not isinstance(target, int) or target < 0:
                raise ValueError("invalid SMB seek position")
            self._offset = target
            return target

    def read(self, size=-1):
        with self._lock:
            self._check()
            remaining = max(0, self._fd.end_of_file - self._offset)
            if size is not None and size >= 0:
                remaining = min(remaining, size)
            result = bytearray()
            try:
                while remaining:
                    length, credits = _chunk_size(self._fd.connection, remaining, "read")
                    if length <= 0:
                        raise CodedOSError(errno.EIO, "errors.smbTransport.readNoCredits")
                    message, receive = self._fd.read(self._offset, length, send=False)
                    request = self._fd.connection.send(
                        message, sid=self._fd.tree_connect.session.session_id,
                        tid=self._fd.tree_connect.tree_connect_id, credit_request=credits,
                    )
                    chunk = receive(request)
                    if not chunk or len(chunk) > length:
                        raise CodedOSError(errno.EIO, "errors.smbTransport.unexpectedEnd")
                    self._offset += len(chunk)
                    remaining -= len(chunk)
                    result.extend(chunk)
                return bytes(result)
            except Exception as exc:
                self._transport.close()
                raise _error(exc) from None

    def close(self):
        if self.closed:
            return
        self.closed = True
        if not self._lock.acquire(blocking=False):
            self._transport.close()
            return
        try:
            for fd in [self._fd] + list(reversed(self._parents)):
                self._transport._close_fd(fd)
        finally:
            self._lock.release()


class _SmbWriter(_SmbReader):
    def write(self, data):
        payload = memoryview(data)
        with self._lock:
            self._check()
            written = 0
            try:
                while written < len(payload):
                    length, credits = _chunk_size(self._fd.connection, len(payload) - written, 'write')
                    if length <= 0:
                        raise CodedOSError(errno.EIO, "errors.smbTransport.writeNoCredits")
                    message, receive = self._fd.write(bytes(payload[written:written + length]), self._offset, send=False)
                    request = self._fd.connection.send(message, sid=self._fd.tree_connect.session.session_id,
                                                       tid=self._fd.tree_connect.tree_connect_id, credit_request=credits)
                    count = receive(request)
                    if not isinstance(count, int) or not 0 < count <= length:
                        raise CodedOSError(errno.EIO, "errors.smbTransport.writeIncomplete")
                    written += count
                    self._offset += count
                    self._fd.end_of_file = max(self._fd.end_of_file, self._offset)
                return written
            except Exception as exc:
                self._transport.close()
                raise _error(exc) from None

    def flush(self):
        with self._lock:
            self._check()
            try:
                self._fd.flush()
            except Exception as exc:
                self._transport.close()
                raise _error(exc) from None
