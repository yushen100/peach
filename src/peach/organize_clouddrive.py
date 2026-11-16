"""PikPak 的同来源官方移动与有界核验。

改名与移动只走 CloudDrive 官方接口：同父改名用 `RenameFile`，保留名称的跨目录移动用
`MoveFile`；目录证据只取 `GetSubFiles(forceRefresh=True)` 的完整成员。HTTPS WebDAV 只用来
`MKCOL` 建父目录。官方接口的回答不能代替目录证据：`RenameFile` 改文件时回 `success=true`，
目录列表却没变。
"""
from __future__ import annotations

from contextlib import closing, contextmanager
from dataclasses import dataclass
from pathlib import PurePosixPath, PureWindowsPath
import time
from urllib.parse import quote, unquote, urlsplit

import httpx
import grpc
from google.protobuf import descriptor_pb2, descriptor_pool, message_factory
from google.protobuf.empty_pb2 import Empty

from . import interface_text, organize
from .task_retry import TRANSIENT_STATUS, RetryableIOError, transient_delay
from .downloads_clouddrive import CloudDriveClient, SERVICE, discover
from .downloads import CLOUDDRIVE_CREDENTIAL, DownloadSettings
from .follow_secrets import CredentialStore
from .config import DATABASE_PATH, SECRETS_DIR, STATE_DIR
from . import downloads_clouddrive_pb2 as pb
from .peach_proxy import http_client
from .scripting import open_readonly
from .push_discovery import CloudPrefix, PushDiscoverySettings, map_cloud_path, normalise_prefix
from .os_errors import UserFileExistsError, UserFileNotFoundError
from .user_messages import UserFacingError, UserOSError, UserValueError

MAX_RESPONSE = 2 * 1024 * 1024
MAX_FILES = 10000
DAV_ORIGIN = 'https://dav.mypikpak.com'
#: 提交结果：官方接口确认执行、确定性拒绝；`None` 表示没取得回答。
ACCEPTED, REJECTED = 200, 403
#: 官方接口对请求本身的拒绝。原样重提只会得到同样的回答，原件仍在原处。
REJECTED_CODES = frozenset({grpc.StatusCode.INVALID_ARGUMENT, grpc.StatusCode.PERMISSION_DENIED,
                            grpc.StatusCode.NOT_FOUND, grpc.StatusCode.ALREADY_EXISTS,
                            grpc.StatusCode.FAILED_PRECONDITION})


class UnconfirmedMove(SystemExit):
    """原件与目标都在或都不在、成员不符或目录读不到：状态未知，保留意图并停止当前进程。

    仍是 `SystemExit`（停进程的语义不变），说明文字按 zh-CN 从资源渲染；换成带 code 的类型见延后清单。"""

    CODE = "errors.organizeClouddrive.moveUnconfirmed"

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or interface_text.text(f"server:{self.CODE}"))


class MoveNotExecuted(UserFacingError, FileNotFoundError):
    """官方目录确认原件仍在、目标未出现：本条未执行，可记失败后继续下一条。"""


def _submission_status(error: grpc.RpcError):
    code = error.code() if callable(getattr(error, 'code', None)) else None
    return REJECTED if code in REJECTED_CODES else None


def _messages():
    """CloudDrive 官方 GetDownloadUrlPath/GetSubFiles 消息的所需字段。"""
    from . import downloads_clouddrive_pb2 as pb
    proto = descriptor_pb2.FileDescriptorProto(
        name='peach_organize_cloud.proto', package='peach_organize_cloud', syntax='proto3')
    proto.dependency.append(pb.DESCRIPTOR.name)
    request = proto.message_type.add(name='DownloadRequest')
    request.field.add(name='path', number=1, type=9, label=1)
    request.field.add(name='get_direct_url', number=4, type=8, label=1)
    reply = proto.message_type.add(name='DownloadReply')
    reply.field.add(name='directUrl', number=3, type=9, label=1)
    reply.field.add(name='userAgent', number=4, type=9, label=1)
    entry = reply.nested_type.add(name='HeadersEntry')
    entry.options.map_entry = True
    entry.field.add(name='key', number=1, type=9, label=1)
    entry.field.add(name='value', number=2, type=9, label=1)
    reply.field.add(name='additionalHeaders', number=5, type=11, label=3,
                    type_name='.peach_organize_cloud.DownloadReply.HeadersEntry')
    rename = proto.message_type.add(name='RenameRequest')
    rename.field.add(name='path', number=1, type=9, label=1)
    rename.field.add(name='newName', number=2, type=9, label=1)
    move = proto.message_type.add(name='MoveRequest')
    move.field.add(name='theFilePaths', number=1, type=9, label=3)
    move.field.add(name='destPath', number=2, type=9, label=1)
    policy = move.enum_type.add(name='ConflictPolicy')
    for name, number in (('Overwrite', 0), ('Rename', 1), ('Skip', 2)):
        policy.value.add(name=name, number=number)
    move.field.add(name='conflictPolicy', number=3, type=14, label=1,
                   type_name='.peach_organize_cloud.MoveRequest.ConflictPolicy')
    for name, number in (('moveAcrossClouds', 4), ('handleConflictRecursively', 5)):
        index = len(move.oneof_decl)
        move.oneof_decl.add(name='_' + name)
        move.field.add(name=name, number=number, type=8, label=1, proto3_optional=True, oneof_index=index)
    pool = descriptor_pool.DescriptorPool()
    pool.AddSerializedFile(pb.DESCRIPTOR.dependencies[0].serialized_pb)
    pool.AddSerializedFile(pb.DESCRIPTOR.serialized_pb)
    pool.Add(proto)
    return tuple(message_factory.GetMessageClass(pool.FindMessageTypeByName('peach_organize_cloud.' + name))
                 for name in ('DownloadRequest', 'DownloadReply', 'RenameRequest', 'MoveRequest'))


DownloadRequest, DownloadReply, RenameRequest, MoveRequest = _messages()
ListRequest, ListReply = pb.FileRequest, pb.SubFilesReply


@dataclass(frozen=True)
class PikPakPaths:
    """已声明媒体根、CloudDrive 前缀和账号内 WebDAV 目录的对应关系。"""

    root: str
    remote: str
    dav_root: str = ""

    def __post_init__(self):
        root = PureWindowsPath(self.root)
        if not root.is_absolute() or root.drive.startswith('\\\\') or '..' in root.parts:
            raise UserValueError('errors.organizeClouddrive.pikpakRootInvalid')
        for path in (self.remote, self.dav_root):
            if path and (not path.startswith('/') or any(
                    part in ('.', '..') or '\\' in part or ':' in part
                    or any(ord(char) < 32 for char in part) for part in path.split('/'))):
                raise UserValueError('errors.organizeClouddrive.cloudDirectoryInvalid')
        if normalise_prefix(self.remote) == '/':
            raise UserValueError('errors.organizeClouddrive.cloudPrefixIsRoot')

    def relative(self, path: str) -> tuple[str, ...]:
        item = PureWindowsPath(path)
        if not item.is_absolute() or '..' in item.parts or any(
                ':' in part or any(ord(char) < 32 for char in part) for part in item.parts[1:]):
            raise UserValueError('errors.organizeClouddrive.pathOutsideSource')
        try:
            return item.relative_to(PureWindowsPath(self.root)).parts
        except ValueError:
            raise UserValueError('errors.organizeClouddrive.pathOutsideSource') from None

    def cloud_path(self, path: str) -> str:
        return normalise_prefix(self.remote) + ''.join('/' + part for part in self.relative(path))

    def dav_path(self, path: str) -> str:
        return self.dav_root.rstrip('/') + '/' + '/'.join(self.relative(path))


def _configured_paths(sample_path: str, roots, prefixes) -> PikPakPaths:
    """从当前 PikPak 媒体根选取样本所属的唯一云端映射。"""
    sample = PureWindowsPath(sample_path)
    candidates = [PureWindowsPath(root) for root in roots.get('pikpak', ())
                  if sample.is_relative_to(PureWindowsPath(root))]
    if not candidates:
        raise UserValueError('errors.organizeClouddrive.sampleOutsideRoot')
    root = max(candidates, key=lambda item: len(item.parts))
    matches = [entry for entry in prefixes if PureWindowsPath(entry.root) == root]
    if len(matches) != 1:
        raise UserValueError('errors.organizeClouddrive.prefixNotUnique')
    mapping = PikPakPaths(str(root), matches[0].prefix)
    mapping.relative(sample_path)
    return mapping


class PikPakDav:
    """已声明 PikPak 目录的一次移动：官方接口提交一次，官方完整目录确认结果。

    `listing(path)` 返回官方目录的完整成员；`rename`／`move_remote` 提交同父改名与保留名称的
    跨目录移动，回 `ACCEPTED`、`REJECTED` 或 `None`。
    """

    def __init__(self, http: httpx.Client, mapping: PikPakPaths, refresh, *, listing, rename, move_remote, confirm_attempts=1):
        self.mapping = mapping
        self.http, self.root, self.refresh = http, PureWindowsPath(mapping.root), refresh
        self.rename = rename
        self.listing = listing
        self.move_remote = move_remote
        if not 1 <= confirm_attempts <= 4:
            raise ValueError('confirm_attempts must be between 1 and 4')
        self.confirm_attempts = confirm_attempts

    def url(self, path: str) -> str:
        return DAV_ORIGIN + quote(self.mapping.dav_path(path), safe='/@')

    def request(self, method, path, **kwargs):
        try:
            with self.http.stream(method, self.url(path), **kwargs) as response:
                if response.status_code in TRANSIENT_STATUS:
                    error = httpx.HTTPStatusError('WebDAV temporarily unavailable',
                        request=httpx.Request(method, self.url(path)), response=response)
                    raise RetryableIOError('errors.organizeClouddrive.webdavUnavailable',
                                           {'status': response.status_code}, after=transient_delay(error) or 0)
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > MAX_RESPONSE:
                        raise UserValueError('errors.organizeClouddrive.webdavResponseTooLarge')
                    chunks.append(chunk)
                return response.status_code, b''.join(chunks)
        except httpx.HTTPError as error:
            delay = transient_delay(error)
            if delay is not None:
                raise RetryableIOError('errors.organizeClouddrive.webdavNoResponse', after=delay) from None
            raise UserOSError('errors.organizeClouddrive.webdavNoResponse') from None

    def list(self, path):
        self.url(path)
        return self.listing(path)

    def tree(self, path):
        pending, files, visited = [path], [], set()
        while pending:
            parent = pending.pop()
            if parent in visited or len(visited) >= MAX_FILES:
                raise UserValueError('errors.organizeClouddrive.webdavTreeTooLarge')
            visited.add(parent)
            for entry in self.list(parent):
                if entry['directory']:
                    pending.append(entry['path'])
                else:
                    files.append(entry)
            if len(files) > MAX_FILES:
                raise UserValueError('errors.organizeClouddrive.webdavTooManyFiles')
        return files

    def ensure_parent(self, path):
        self.mapping.relative(path)
        if PureWindowsPath(path) == self.root:
            return
        parent = PureWindowsPath(path).parent
        if parent == self.root:
            return
        self.ensure_parent(str(parent))
        grandparent = str(parent.parent)
        listing = self.list(grandparent)
        matches = [r for r in listing if PureWindowsPath(r['path']) == parent]
        if matches:
            if not matches[0]['directory']:
                raise UserValueError('errors.organizeClouddrive.targetParentNotDirectory')
            return
        status, _ = self.request('MKCOL', str(parent))
        if status != 201:
            raise UserOSError('errors.organizeClouddrive.webdavMkcolFailed', {'status': status})
        self.refresh(grandparent)

    def submit_move(self, source, target):
        if PureWindowsPath(source).parent == PureWindowsPath(target).parent:
            return self.rename(source, target)
        return self.move_remote(source, target)

    def move(self, source, target):
        self.url(source)
        self.url(target)
        old, new = PureWindowsPath(source), PureWindowsPath(target)
        if old.parent != new.parent and old.name != new.name:
            raise UserValueError('errors.organizeClouddrive.crossParentRename')
        old_parent, new_parent = str(old.parent), str(new.parent)
        entries = self.list(old_parent)
        found = [r for r in entries if PureWindowsPath(r['path']) == PureWindowsPath(source)]
        if len(found) != 1:
            raise UserFileNotFoundError('errors.organizeClouddrive.webdavSourceNotFound')
        before = self.tree(source) if found[0]['directory'] else found
        self.ensure_parent(target)
        if any(PureWindowsPath(r['path']) == PureWindowsPath(target) for r in self.list(new_parent)):
            raise UserFileExistsError('errors.organizeClouddrive.webdavTargetExists')
        try:
            response_status = self.submit_move(source, target)
        except OSError:
            response_status = None
        for attempt in range(self.confirm_attempts):
            final = attempt + 1 == self.confirm_attempts
            try:
                for parent in {old_parent, new_parent}:
                    self.refresh(parent)
                self.confirm_move(source, target, found[0], before, response_status, final=final)
                return
            except MoveNotExecuted:
                raise
            except (UnconfirmedMove, OSError, ValueError):
                if final:
                    raise UnconfirmedMove() from None
                time.sleep(2)

    def confirm_move(self, source, target, source_entry, before, response_status, *, final=True):
        """官方目录里原件仍在、目标未出现：被拒绝或确认预算用完时判为未执行，否则再等一轮。"""
        old_parent, new_parent = str(PureWindowsPath(source).parent), str(PureWindowsPath(target).parent)
        try:
            after_parent = self.list(new_parent)
            old_listing = self.list(old_parent)
            arrived = [r for r in after_parent if PureWindowsPath(r['path']) == PureWindowsPath(target)]
            still_present = any(PureWindowsPath(r['path']) == PureWindowsPath(source) for r in old_listing)
            if still_present and not arrived:
                if response_status == REJECTED or final:
                    raise MoveNotExecuted('errors.organizeClouddrive.moveNotExecuted')
                raise ValueError('move may still be in progress on the server')
            after = self.tree(target) if source_entry['directory'] else arrived
            expected = {(str(PureWindowsPath(target, *PureWindowsPath(r['path']).parts[len(PureWindowsPath(source).parts):])), r['size'])
                        for r in before}
            if still_present or len(arrived) != 1 or arrived[0]['directory'] != source_entry['directory'] or expected != {(r['path'], r['size']) for r in after}:
                raise ValueError('move state or member listing does not match')
            for parent in {old_parent, new_parent}:
                self.refresh(parent)
            if source_entry['directory']:
                self.refresh(target)
        except MoveNotExecuted:
            raise
        except Exception:
            raise UnconfirmedMove() from None


def _cloud_listing(cloud, path, mapping):
    """逐层完整读取官方目录元数据并校验来源、父目录与重名。"""
    relative = mapping.relative(path)
    if len(relative) > 32:
        raise UserValueError('errors.organizeClouddrive.cloudPathTooDeep')
    previous = None
    for depth in range(len(relative) + 1):
        parent = PureWindowsPath(mapping.root, *relative[:depth])
        if previous is not None and not any(PureWindowsPath(row['path']) == parent and row['directory'] for row in previous):
            raise UserFileNotFoundError('errors.organizeClouddrive.cloudParentMissing')
        request = ListRequest(path=mapping.cloud_path(str(parent)), forceRefresh=True)
        call = cloud.channel.unary_stream(SERVICE + 'GetSubFiles',
            request_serializer=ListRequest.SerializeToString, response_deserializer=ListReply.FromString)
        stream = call(request, timeout=15, metadata=(('authorization', 'Bearer ' + cloud.token),))
        rows, seen = [], set()
        try:
            for response in stream:
                for member in response.subFiles:
                    name = PureWindowsPath(map_cloud_path(member.fullPathName,
                        (CloudPrefix(mapping.remote, mapping.root),)))
                    if name.parent != parent or str(name).casefold() in seen or member.size < 0:
                        raise UserValueError('errors.organizeClouddrive.cloudListingInvalid')
                    seen.add(str(name).casefold())
                    rows.append(dict(path=str(name),size=member.size,directory=member.isDirectory))
                if len(rows) > MAX_FILES:
                    raise UserValueError('errors.organizeClouddrive.cloudListingTooLarge')
        except grpc.RpcError as error:
            params = {'status': error.code().name}
            if error.code() in {grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.DEADLINE_EXCEEDED, grpc.StatusCode.ABORTED}:
                raise RetryableIOError('errors.organizeClouddrive.cloudListingUnavailable', params) from None
            raise UserOSError('errors.organizeClouddrive.cloudListingUnavailable', params) from None
        finally:
            stream.cancel()
        previous = rows
    return previous


def _fallback_samples(mapping):
    prefix = str(PureWindowsPath(mapping.root)).rstrip('\\') + '\\'
    with closing(open_readonly(DATABASE_PATH)) as db:
        return [row[0] for row in db.execute(
            "SELECT path FROM asset WHERE location='pikpak' AND disposal IS NULL AND medium='image' "
            "AND lower(substr(path,1,?))=lower(?) ORDER BY id LIMIT 2", (len(prefix), prefix))]


def _move_remote(cloud, source, target, mapping):
    """官方同来源移动保持原名，显式跳过冲突并关闭跨云及递归合并。"""
    from . import downloads_clouddrive_pb2 as pb
    old, new = PureWindowsPath(source), PureWindowsPath(target)
    old_remote, new_remote = mapping.cloud_path(source), mapping.cloud_path(target)
    if (old.name != new.name or old.parent == new.parent
            or PureWindowsPath(mapping.root) in (old, new)):
        raise UserValueError('errors.organizeClouddrive.moveMismatch')
    request = MoveRequest(theFilePaths=[old_remote],
                          destPath=str(PurePosixPath(new_remote).parent),
                          conflictPolicy=2, moveAcrossClouds=False, handleConflictRecursively=False)
    stub = cloud.channel.unary_unary(SERVICE + 'MoveFile', request_serializer=MoveRequest.SerializeToString,
                                    response_deserializer=pb.FileOperationResult.FromString)
    try:
        reply = stub(request, timeout=15, metadata=(('authorization', 'Bearer ' + cloud.token),))
        return ACCEPTED if reply.success else REJECTED
    except grpc.RpcError as error:
        return _submission_status(error)


def _rename_remote(cloud, source, target, mapping):
    """官方同父改名；`success=true` 只是提交结果，生效与否由调用方读官方目录确认。"""
    from . import downloads_clouddrive_pb2 as pb
    old, new = PureWindowsPath(source), PureWindowsPath(target)
    old_remote = mapping.cloud_path(source)
    mapping.relative(target)
    if old.parent != new.parent or PureWindowsPath(mapping.root) in (old, new):
        raise UserValueError('errors.organizeClouddrive.renameOutsideParent')
    stub = cloud.channel.unary_unary(SERVICE + 'RenameFile',
        request_serializer=RenameRequest.SerializeToString, response_deserializer=pb.FileOperationResult.FromString)
    try:
        reply = stub(RenameRequest(path=old_remote, newName=new.name), timeout=15,
                     metadata=(('authorization', 'Bearer ' + cloud.token),))
        return ACCEPTED if reply.success else REJECTED
    except grpc.RpcError as error:
        return _submission_status(error)


def _refresh_listing(cloud, path, mapping):
    """使已声明目录的缓存过期，再按完整祖先链读取实际成员。"""
    from . import downloads_clouddrive_pb2 as pb
    remote = mapping.cloud_path(path)
    stub = cloud.channel.unary_unary(SERVICE + 'ForceExpireDirCache',
            request_serializer=pb.FileRequest.SerializeToString, response_deserializer=Empty.FromString)
    try:
        stub(pb.FileRequest(path=remote),
             timeout=15, metadata=(('authorization', 'Bearer ' + cloud.token),))
    except grpc.RpcError as error:
        if error.code() != grpc.StatusCode.NOT_FOUND:
            raise UserOSError('errors.organizeClouddrive.refreshFailed', {'status': error.code().name}) from None
    return _cloud_listing(cloud, path, mapping)


def _download_headers(cloud, sample_path, mapping):
    paths = [sample_path]
    stub = cloud.channel.unary_unary(SERVICE + 'GetDownloadUrlPath',
        request_serializer=DownloadRequest.SerializeToString, response_deserializer=DownloadReply.FromString)
    for index in range(3):
        if index >= len(paths):
            break
        path = paths[index]
        relative = mapping.dav_path(path)
        try:
            reply = stub(DownloadRequest(path=mapping.cloud_path(path), get_direct_url=True), timeout=15,
                         metadata=(('authorization', 'Bearer ' + cloud.token),))
        except grpc.RpcError as error:
            if error.code() != grpc.StatusCode.NOT_FOUND:
                raise UserValueError('errors.organizeClouddrive.directLinkAuthMissing') from None
            if index == 0:
                paths.extend(p for p in _fallback_samples(mapping) if p != sample_path)
            continue
        url = urlsplit(reply.directUrl)
        if url.hostname != 'dav.mypikpak.com' or url.scheme not in ('http', 'https') or url.username or url.query or unquote(url.path) != relative:
            raise UserValueError('errors.organizeClouddrive.directLinkMismatch')
        headers = dict(reply.additionalHeaders)
        if not any(k.casefold() == 'authorization' for k in headers):
            raise UserValueError('errors.organizeClouddrive.webdavAuthMissing')
        if reply.userAgent:
            headers['User-Agent'] = reply.userAgent
        return headers
    raise UserValueError('errors.organizeClouddrive.authSampleMissing')


@contextmanager
def pikpak_renames(sample_path: str, roots):
    """仅显式启用的目录批次复用既有 CloudDrive 认证。"""
    prefixes = PushDiscoverySettings(STATE_DIR).load(roots).prefixes
    mapping = _configured_paths(sample_path, roots, prefixes)
    credential = CredentialStore(SECRETS_DIR).load(CLOUDDRIVE_CREDENTIAL)
    if not credential or not credential.values.get('token'):
        raise UserValueError('errors.organizeClouddrive.tokenMissing')
    address = DownloadSettings(STATE_DIR).load().clouddrive_address or discover()
    with CloudDriveClient(address, credential.values['token'], timeout=15) as cloud:
        # 下面直接调官方接口传完整路径；限定根目录的令牌会把路径接在根目录后面，移动与改名会落到别处。
        if cloud.root != '/':
            raise UserValueError('errors.organizeClouddrive.tokenRootRestricted', {'root': cloud.root})
        info = cloud.find(mapping.remote)
        if info is None or info.CloudAPI.name.casefold() != 'webdav':
            raise UserValueError('errors.organizeClouddrive.webdavSourceMissing')
        account_root = info.CloudAPI.path if info.CloudAPI.HasField('path') else ''
        if not account_root and info.isCloudRoot:
            account_root = mapping.remote
        if not account_root:
            raise UserValueError('errors.organizeClouddrive.accountRootMissing')
        try:
            tail = PurePosixPath(mapping.remote).relative_to(PurePosixPath(account_root))
        except ValueError:
            raise UserValueError('errors.organizeClouddrive.prefixOutsideAccountRoot') from None
        mapping = PikPakPaths(mapping.root, mapping.remote, '/' + '/'.join(tail.parts))
        headers = _download_headers(cloud, sample_path, mapping)
        with http_client(root=SECRETS_DIR, headers=headers, timeout=20, follow_redirects=False) as http:
            dav = PikPakDav(http, mapping, lambda path: _refresh_listing(cloud, path, mapping),
                            listing=lambda path: _cloud_listing(cloud, path, mapping),
                            rename=lambda source, target: _rename_remote(cloud, source, target, mapping),
                            move_remote=lambda source, target: _move_remote(cloud, source, target, mapping),
                            confirm_attempts=4)
            with organize.verified_renames('pikpak', dav.move):
                yield dav
