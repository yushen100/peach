"""CloudDrive2 云下载：通过官方 gRPC 接口提交并跟踪任务。

Peach 不另申请 115 应用，复用 CloudDrive2 已有的 115open 授权：一个应用最多授权两次，第三次
会顶掉第一次。CloudDrive2 的 API 令牌由用户在设置页填一次，存本机 `CredentialStore`，
只放进 gRPC 的 `authorization` 元数据，不进 URL、日志与 ledger。

接口子集见 `downloads_clouddrive.proto`。流程参照 JavBoss
`internal/clouddrive/client.go` 与 `internal/service/download.go`：提交前确认目标目录
`canOfflineDownload` 并查配额，提交时让 CloudDrive2 10 秒后自己看一眼目录，之后按 infohash
在目录的离线列表里对账；列表里找不到时看目录里有没有那个文件。

115 每个任务扣一条离线配额（年费会员每月 1500 条、月费 200 条，月底清零）。提交前先查
目录里是否已有同一 infohash 的离线任务，有就接管，不再扣。

115 目标目录留空时，检查从推送发现的云端路径前缀里推一个（「检查」键、打开设置页与保存配置
都走这一套）：对每条前缀调 `FindFileByPath`，CloudDrive2 回的 `CloudAPI.name` 是 115 那一类
的才算 115 前缀，候选是 `<前缀>/云下载`。判据取 CloudDrive2 自报的云盘类型，不看前缀名字；`FindFileByPath` 只要
「列目录」权限，查目标目录本来就要它，不另要挂载点或云盘列表的权限。PikPak 根目录对应的
媒体目录同理：前缀是 PikPak 云盘根、对应的本机根是已声明的 PikPak 来源，就推它。
"""
from __future__ import annotations

import dataclasses
import posixpath
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import grpc
from google.protobuf import empty_pb2

from . import downloads_clouddrive_pb2 as pb
from . import interface_text
from .content_words import SUGGESTED_CLOUD_FOLDER
from .downloads import (
    CD2_OUTSIDE_TOKEN_ROOT, DONE, ERROR, MISSING, RUNNING, DownloadError, DownloadTask, Magnet, Problem, RemoteStatus,
    classify_remote_message, clean_address, magnet_info_hash, problem_codes, storage_full,
)
from .push_discovery import CloudPrefix, normalise_prefix
from .user_messages import UserValueError

SERVICE = "/clouddrive.CloudDriveFileSrv/"
#: 单次调用的上限。离线列表要强制刷新，115 那一侧偶尔要几秒。
CALL_TIMEOUT = 30.0
#: 提交后让 CloudDrive2 自己隔多久去目标目录看一眼。
CHECK_FOLDER_AFTER_SECS = 10
#: 地址留空时「检查」依次试的本机地址：独立版默认 19798，Windows 桌面版有用 29798 的。
LOCAL_ADDRESSES = ("http://127.0.0.1:19798", "http://127.0.0.1:29798")
#: 探测一个地址的上限。本机端口没人听时立刻被拒，这个上限只兜住听着却不应答的情况。
PROBE_TIMEOUT = 3.0

#: 「检查」要报的三项离线权限，值是显示名的 code（`labels.downloadsClouddrive.permission.<id>`）。
#: 取消要用到第三项，缺它只是不能取消。
OFFLINE_PERMISSIONS = {
    "allow_add_offline_download": "labels.downloadsClouddrive.permission.addOffline",
    "allow_list_offline_downloads": "labels.downloadsClouddrive.permission.listOffline",
    "allow_modify_offline_downloads": "labels.downloadsClouddrive.permission.modifyOffline",
}
#: `CloudDriveClient.call` 的动作 id：调用失败时按「哪种失败」取一句，哪一步作嵌套参数填进 `{{action}}`，
#: 显示名在 `labels.downloadsClouddrive.action.<id>`。不在表里的动作名原样填进去。
CALL_ACTIONS = frozenset({
    "verifyToken", "findTarget", "refreshLanding", "readQuota", "listOffline", "createFolder",
    "submitOffline", "cancelOffline", "findLandedFile", "findPrefix", "readProxy", "readAccounts",
    "saveProxy", "readMountPoints", "readLibraryMounts", "readCacheDir",
})

#: CloudDrive2 自报的云盘类型（`CloudDriveFile.CloudAPI.name`），比对不分大小写。115 开放平台
#: 授权是 `115open`，cookie 或扫码登录的是 `115`。
CLOUDS_115 = frozenset({"115", "115open"})
CLOUDS_PIKPAK = frozenset({"pikpak"})
#: 115 目标目录留空时，在 115 前缀下建议的文件夹名。
SUGGESTED_FOLDER = SUGGESTED_CLOUD_FOLDER

_METHODS = {
    "GetSystemInfo": (empty_pb2.Empty, pb.CloudDriveSystemInfo),
    "GetSystemSettings": (empty_pb2.Empty, pb.SystemSettings),
    "GetApiTokenInfo": (pb.StringValue, pb.TokenInfo),
    "GetAllCloudApis": (empty_pb2.Empty, pb.CloudAPIList),
    "GetCloudAPIConfig": (pb.GetCloudAPIConfigRequest, pb.CloudAPIConfig),
    "SetCloudAPIConfig": (pb.SetCloudAPIConfigRequest, empty_pb2.Empty),
    "GetMountPoints": (empty_pb2.Empty, pb.GetMountPointsResult),
    "FindFileByPath": (pb.FindFileByPathRequest, pb.CloudDriveFile),
    "CreateFolder": (pb.CreateFolderRequest, pb.CreateFolderResult),
    "AddOfflineFiles": (pb.AddOfflineFileRequest, pb.FileOperationResult),
    "RemoveOfflineFiles": (pb.RemoveOfflineFilesRequest, pb.FileOperationResult),
    "ListOfflineFilesByPath": (pb.FileRequest, pb.OfflineFileListResult),
    "GetOfflineQuotaInfo": (pb.OfflineQuotaRequest, pb.OfflineQuotaInfo),
}

_NETWORK_CODES = {grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.DEADLINE_EXCEEDED,
                  grpc.StatusCode.RESOURCE_EXHAUSTED, grpc.StatusCode.ABORTED,
                  grpc.StatusCode.CANCELLED}
_AUTH_CODES = {grpc.StatusCode.UNAUTHENTICATED, grpc.StatusCode.PERMISSION_DENIED}


def channel_target(address: str) -> tuple[str, bool]:
    """校验服务地址并生成 gRPC 目标；非法地址使用下载领域错误。"""
    try:
        address = clean_address(address)
    except UserValueError as error:
        raise DownloadError("config", error.code, error.params) from error
    parts = urlsplit(address)
    if not parts.hostname:
        raise DownloadError("config", "errors.downloadsClouddrive.addressEmpty")
    port = parts.port or (443 if parts.scheme == "https" else 19798)
    host = parts.hostname if ":" not in parts.hostname else f"[{parts.hostname}]"
    return f"{host}:{port}", parts.scheme == "https"


def open_channel(address: str) -> grpc.Channel:
    target, secure = channel_target(address)
    return (grpc.secure_channel(target, grpc.ssl_channel_credentials())
            if secure else grpc.insecure_channel(target))


def answers(address: str, *, timeout: float = PROBE_TIMEOUT) -> bool:
    """不带令牌调 `GetSystemInfo`，正常应答才算这个地址上有 CloudDrive2。"""
    request_type, response_type = _METHODS["GetSystemInfo"]
    with open_channel(address) as channel:
        stub = channel.unary_unary(
            SERVICE + "GetSystemInfo", request_serializer=request_type.SerializeToString,
            response_deserializer=response_type.FromString)
        try:
            stub(request_type(), timeout=timeout)
        except grpc.RpcError:
            return False
    return True


def discover(addresses: tuple[str, ...] = LOCAL_ADDRESSES) -> str:
    """按顺序试，返回第一个应答的地址；都不应答时报错并原样列出试过的地址。"""
    for address in addresses:
        try:
            normalized = clean_address(address)
        except ValueError:
            continue
        if normalized and answers(normalized):
            return normalized
    raise DownloadError("network", "errors.downloadsClouddrive.noLocalAnswer", {"tried": list(addresses)})


#: gRPC 报「没有这个路径」时的原因；`find` 按它把「不存在」与别的失败分开。
PATH_NOT_FOUND = "errors.downloadsClouddrive.pathNotFound"
#: 四种调用失败各自的一句。
_CALL_CODES = {
    "unreachable": "errors.downloadsClouddrive.unreachable",
    "tokenRejected": "errors.downloadsClouddrive.tokenRejected",
    "pathNotFound": PATH_NOT_FOUND,
    "failed": "errors.downloadsClouddrive.callFailed",
}


def _action_label(action: str) -> dict | str:
    """调用动作作嵌套参数：登记过的 id 给它的显示名 code，别的原样。"""
    return {"code": f"labels.downloadsClouddrive.action.{action}"} if action in CALL_ACTIONS else action


def _call_error(failure: str, kind: str, action: str, details: str | None = None, *,
                channel_down: bool = False) -> DownloadError:
    params = {"action": _action_label(action), **({} if details is None else {"details": details})}
    return DownloadError(failure, _CALL_CODES[kind], params, channel_down=channel_down)


def path_not_found(error: DownloadError) -> bool:
    return error.code == PATH_NOT_FOUND


def _translate(error: grpc.RpcError, action: str) -> DownloadError:
    code = error.code() if hasattr(error, "code") else None
    details = str((error.details() if hasattr(error, "details") else "") or code)
    if code in _NETWORK_CODES:
        # 超时多是批量提交时 115 一侧慢，按任务自动重提交；UNAVAILABLE 是连接本身建不起来，
        # 多半是 CloudDrive2 没在运行，整条渠道都用不了。
        return _call_error("network", "unreachable", action, details,
                           channel_down=code == grpc.StatusCode.UNAVAILABLE)
    if code in _AUTH_CODES:
        return _call_error("config", "tokenRejected", action, details)
    if code == grpc.StatusCode.NOT_FOUND:
        return _call_error("config", "pathNotFound", action)
    if storage_full(details):
        return DownloadError("storage", "errors.downloads.remoteStorageFull")
    return _call_error("rejected", "failed", action, details)


def clean_remote(path: str) -> str:
    return posixpath.normpath("/" + str(path or "").strip().replace("\\", "/").lstrip("/"))


def split_remote(path: str) -> tuple[str, str]:
    """`/115/云下载` → (`/115`, `云下载`)。`FindFileByPath` 要父目录与名字分开给。"""
    clean = clean_remote(path)
    return posixpath.dirname(clean) or "/", posixpath.basename(clean)


def token_path(root: str, path: str) -> str | None:
    """完整路径换成令牌眼里的路径；不在令牌根目录下时为 None。

    限定了根目录的令牌，CloudDrive2 把收到的路径都接在根目录后面：根目录 `/115open/Peach`
    的令牌，`/` 就是 `/115open/Peach`，传 `/115open/Peach` 会去找 `/115open/Peach/115open/Peach`。
    """
    root, path = clean_remote(root), clean_remote(path)
    if root == "/":
        return path
    if path.casefold() == root.casefold():
        return "/"
    if path.casefold().startswith(root.casefold() + "/"):
        return path[len(root):]
    return None


def within_token_root(root: str, path: str) -> str:
    """令牌根目录落在 `path` 之下时换成根目录本身，其余原样返回。

    推送前缀（如 `/115open`）在受限令牌眼里看不到，能落任务的只有令牌根目录及其下面。
    """
    root = clean_remote(root)
    if token_path(root, path) is None and token_path(path, root) is not None:
        return root
    return path


def legacy_cloud_path(root: str, path: str) -> str | None:
    """把旧版直接发给 CloudDrive2 的路径还原为令牌内的完整路径。"""
    if not path or token_path(root, path) is not None:
        return None
    return clean_remote(root).rstrip("/") + clean_remote(path)


@dataclass(frozen=True)
class Folder:
    path: str
    can_offline: bool
    cloud_name: str
    cloud_account: str
    can_manage: bool = True
    directory_id: str = ""


class CloudDriveClient:
    """带令牌调用官方 gRPC 接口。"""

    def __init__(self, address: str, token: str, *, timeout: float = CALL_TIMEOUT):
        if not token:
            raise DownloadError("config", "errors.downloadsClouddrive.tokenMissing")
        self.token = token
        self.address = address
        self.timeout = timeout
        self.channel = open_channel(address)
        self._info: pb.TokenInfo | None = None

    def close(self) -> None:
        self.channel.close()

    def __enter__(self) -> "CloudDriveClient":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()

    def call(self, method: str, request, action: str):
        request_type, response_type = _METHODS[method]
        stub = self.channel.unary_unary(
            SERVICE + method, request_serializer=request_type.SerializeToString,
            response_deserializer=response_type.FromString)
        try:
            return stub(request, timeout=self.timeout,
                        metadata=(("authorization", f"Bearer {self.token}"),))
        except grpc.RpcError as error:
            raise _translate(error, action) from None

    # -- 读

    def token_info(self) -> pb.TokenInfo:
        if self._info is None:
            self._info = self.call("GetApiTokenInfo", pb.StringValue(value=self.token), "verifyToken")
        return self._info

    @property
    def root(self) -> str:
        """令牌的根目录，没限定时是 `/`。"""
        return clean_remote(self.token_info().rootDir)

    def remote(self, path: str) -> str:
        """Peach 记的完整路径换成发给 CloudDrive2 的路径；不在令牌根目录下就报错，不让它建错地方。"""
        inner = token_path(self.root, path)
        if inner is None:
            raise DownloadError("config", CD2_OUTSIDE_TOKEN_ROOT,
                                {"path": path, "root": self.root})
        return inner

    def find(self, path: str, action: str = "findTarget") -> pb.CloudDriveFile | None:
        inner = token_path(self.root, path)
        if inner is None:
            return None
        parent, name = split_remote(inner)
        try:
            found = self.call("FindFileByPath", pb.FindFileByPathRequest(parentPath=parent, path=name),
                              action)
        except DownloadError as error:
            if path_not_found(error):
                return None
            raise
        return found if found.fullPathName or found.name else None

    def folder(self, path: str) -> Folder:
        self.remote(path)
        found = self.find(path)
        if found is None or not found.isDirectory:
            raise DownloadError("config", "errors.downloadsClouddrive.folderMissing", {"path": path})
        return Folder(path, bool(found.canOfflineDownload), found.CloudAPI.name,
                      found.CloudAPI.userName, bool(found.supportOfflineDownloadManagement), found.id)

    def refresh_directory(self, path: str) -> None:
        """完整读取目标目录元数据，让远端新文件进入 CloudDrive 与挂载的目录缓存。"""
        call = self.channel.unary_stream(SERVICE + 'GetSubFiles',
            request_serializer=pb.FileRequest.SerializeToString,
            response_deserializer=pb.SubFilesReply.FromString)
        stream = call(pb.FileRequest(path=self.remote(path), forceRefresh=True), timeout=self.timeout,
                      metadata=(("authorization", f"Bearer {self.token}"),))
        try:
            for _response in stream:
                pass
        except grpc.RpcError as error:
            raise _translate(error, "refreshLanding") from None
        finally:
            stream.cancel()

    def quota(self, folder: Folder) -> pb.OfflineQuotaInfo:
        return self.call("GetOfflineQuotaInfo", pb.OfflineQuotaRequest(
            cloudName=folder.cloud_name, cloudAccountId=folder.cloud_account, path=self.remote(folder.path)),
            "readQuota")

    def offline_files(self, path: str) -> list[pb.OfflineFile]:
        result = self.call("ListOfflineFilesByPath", pb.FileRequest(path=self.remote(path), forceRefresh=True),
                           "listOffline")
        return list(result.offlineFiles)

    # -- 写

    def create_folder(self, path: str) -> None:
        """在父目录下建一层。父目录要已经存在；令牌要有「新建文件夹」权限。"""
        parent, name = split_remote(self.remote(path))
        created = self.call("CreateFolder", pb.CreateFolderRequest(parentPath=parent, folderName=name),
                            "createFolder")
        if created.result.success or created.folderCreated.fullPathName or created.folderCreated.name:
            return
        if not created.result.errorMessage:
            raise DownloadError("rejected", "errors.downloadsClouddrive.folderNotCreatedNoReason", {"path": path})
        raise DownloadError("rejected", "errors.downloadsClouddrive.folderNotCreated",
                            {"path": path, "reason": created.result.errorMessage})

    def add(self, magnet: str, path: str) -> None:
        result = self.call("AddOfflineFiles", pb.AddOfflineFileRequest(
            urls=magnet, toFolder=self.remote(path), checkFolderAfterSecs=CHECK_FOLDER_AFTER_SECS),
            "submitOffline")
        if not result.success:
            raise classify_remote_message(result.errorMessage)

    def remove(self, folder: Folder, info_hash: str) -> None:
        result = self.call("RemoveOfflineFiles", pb.RemoveOfflineFilesRequest(
            cloudName=folder.cloud_name, cloudAccountId=folder.cloud_account, deleteFiles=False,
            infoHashes=[info_hash], path=self.remote(folder.path)), "cancelOffline")
        if not result.success:
            raise DownloadError("rejected", "errors.downloadsClouddrive.cancelRefused", {"reason": result.errorMessage})


def match_offline(files: list[pb.OfflineFile], info_hash: str) -> pb.OfflineFile | None:
    """按 infohash 对账。`infoHash` 为空时从原始链接里取，JavBoss 也是这样回退的。"""
    for item in files:
        candidate = (item.infoHash or "").strip().lower() or magnet_info_hash(item.url)
        if candidate == info_hash:
            return item
    return None


def offline_status(item: pb.OfflineFile | None) -> RemoteStatus:
    if item is None:
        return RemoteStatus(MISSING)
    progress = max(0.0, min(float(item.percendDone or 0.0) / 100.0, 1.0))
    if item.status == pb.OFFLINE_FINISHED:
        return RemoteStatus(DONE, item.fileId, item.name, 1.0)
    if item.status == pb.OFFLINE_ERROR:
        # 列表里的失败没有原文；拦截码只在提交那一下的 errorMessage 里出现。
        code = "errors.downloadsClouddrive.offlineFailed"
        return RemoteStatus(ERROR, item.fileId, item.name, progress,
                            interface_text.text(f"server:{code}"), message_code=code)
    return RemoteStatus(RUNNING, item.fileId, item.name, progress)


class CloudDriveProvider:
    """按网盘能力查询任务列表或确认文件落地。每次调用新开通道，用完就关。"""

    key = "115"

    def __init__(self, address: str, token: str):
        self.address = address
        self.token = token

    def client(self) -> CloudDriveClient:
        if not self.address:
            raise DownloadError("config", "errors.downloadsClouddrive.addressMissing")
        return CloudDriveClient(self.address, self.token)

    def submit(self, magnet: Magnet, target: str) -> RemoteStatus:
        with self.client() as client:
            return self._submit(client, magnet, target)

    @staticmethod
    def _submit(client: CloudDriveClient, magnet: Magnet, target: str) -> RemoteStatus:
        folder = client.folder(target)
        if not folder.can_offline:
            raise DownloadError("config", "errors.downloadsClouddrive.offlineUnsupported", {"target": target})
        existing = match_offline(client.offline_files(target), magnet.info_hash) if folder.can_manage else None
        if existing is not None:
            return dataclasses.replace(offline_status(existing), adopted=True)
        try:
            quota = client.quota(folder) if folder.can_manage else None
        except DownloadError as error:
            if error.failure != "rejected":
                raise
            quota = None  # 这一侧不支持查配额时照常提交，由提交接口自己拒。
        if quota is not None and quota.total > 0 and quota.left <= 0:
            raise DownloadError("quota", "errors.downloadsClouddrive.quotaUsedUp",
                                {"used": quota.used, "total": quota.total})
        client.add(magnet.uri, target)
        return RemoteStatus(RUNNING, name=magnet.name)

    def retry_submit(self, task: DownloadTask, magnet: Magnet) -> RemoteStatus:
        with self.client() as client:
            existing = self._legacy_match(client, task)
            if existing is not None:
                return dataclasses.replace(offline_status(existing[1]), adopted=True)
            return self._submit(client, magnet, task.target)

    @staticmethod
    def _legacy_match(client: CloudDriveClient, task: DownloadTask) -> tuple[Folder, pb.OfflineFile] | None:
        target = legacy_cloud_path(client.root, task.target)
        if not target or not task.info_hash:
            return None
        try:
            folder = client.folder(target)
        except DownloadError as error:
            if error.code == "errors.downloadsClouddrive.folderMissing":
                return None
            raise
        if not folder.can_manage:
            return None
        existing = match_offline(client.offline_files(target), task.info_hash)
        if existing is None or (task.remote_id and existing.fileId and task.remote_id != existing.fileId):
            return None
        if folder.directory_id and existing.parentId and folder.directory_id != existing.parentId:
            return None
        task.target = target
        return folder, existing

    def recover_legacy_target(self, task: DownloadTask) -> RemoteStatus | None:
        with self.client() as client:
            existing = self._legacy_match(client, task)
            return offline_status(existing[1]) if existing is not None else None

    def status(self, task: DownloadTask) -> RemoteStatus:
        with self.client() as client:
            existing = self._legacy_match(client, task)
            if existing is not None:
                return offline_status(existing[1])
            if not client.folder(task.target).can_manage:
                return RemoteStatus(DONE if self._landed(client, task) else RUNNING, name=task.remote_name or task.display_name)
            return offline_status(match_offline(client.offline_files(task.target), task.info_hash or ""))

    def landed(self, task: DownloadTask) -> bool:
        with self.client() as client:
            client.refresh_directory(task.target)
            return self._landed(client, task)

    @staticmethod
    def _landed(client: CloudDriveClient, task: DownloadTask) -> bool:
        names = [name for name in (task.remote_name, task.display_name) if name]
        return any(client.find(f"{task.target.rstrip('/')}/{name}", "findLandedFile")
                   is not None for name in names)

    def cancel(self, task: DownloadTask) -> None:
        with self.client() as client:
            existing = self._legacy_match(client, task)
            folder = existing[0] if existing is not None else client.folder(task.target)
            if not folder.can_manage:
                raise DownloadError("config", "errors.downloadsClouddrive.cancelUnsupported")
            client.remove(folder, task.info_hash or "")


@dataclass(frozen=True)
class Hints:
    """「检查」推建议值用的本机配置：推送发现的前缀表、已声明的媒体根、表单上的 PikPak 根。

    `pikpak_account` 为假时用户没在用 PikPak，PikPak 根那一段整段不查也不报。
    """
    prefixes: tuple[CloudPrefix, ...] = ()
    declared_roots: dict = field(default_factory=dict)
    pikpak_root: str = ""
    pikpak_account: bool = False
    target_enabled: bool = True


def empty_report(address: str, problems: list[str] | None = None) -> dict:
    """「检查」报告的形状。每一项各自报，一项失败不挡住其余几项。

    `problems` 与 `missing` 是按 zh-CN 渲染的原句，`problem_codes`、`missing_codes` 是与之一一对应的
    code，页面按它取译文（ADR-0159）。往报告里加问题走 `add_problem`，两边一起长。
    """
    problems = list(problems or ())
    return {"ok": not problems, "address": address, "permissions": [], "missing": [], "missing_codes": [],
            "root": "", "folder": None, "quota": None, "suggested_target": None, "suggested_pikpak_root": "",
            "problems": problems, "problem_codes": problem_codes(problems)}


def add_problem(report: dict, problem: Problem) -> None:
    report["problems"].append(problem)
    report.setdefault("problem_codes", []).extend(problem_codes([problem]))


def check(address: str, token: str, target: str, *, hints: Hints = Hints(),
          local_addresses: tuple[str, ...] = LOCAL_ADDRESSES) -> dict:
    """设置页的「检查」：令牌有没有离线权限、目标目录能不能离线、115 还剩多少配额。

    地址留空时先按 `local_addresses` 的顺序探测，报告的 `address` 是实际查的那个，页面把它
    填回表单，用户保存后才落盘。目标目录与 PikPak 根留空时同样只给建议值（`suggested_*`），
    由页面填回。只读：不提交、不取消、不建目录。令牌一关过不去时 `ok` 为假；之后的目录与
    配额各自报进 `problems`。
    """
    report = empty_report(address or discover(local_addresses))
    try:
        _inspect(report, CloudDriveClient(report["address"], token), target, hints)
    except DownloadError as error:
        report["ok"] = False
        add_problem(report, Problem.of(error))
    return report


def create_folder(address: str, token: str, path: str, *, hints: Hints = Hints(),
                  local_addresses: tuple[str, ...] = LOCAL_ADDRESSES) -> dict:
    """用户点「新建这个目录」时才调。建好之后按这个目录再检查一遍，报告交给页面。"""
    address = address or discover(local_addresses)
    with CloudDriveClient(address, token) as client:
        client.create_folder(path)
    return check(address, token, path, hints=hints, local_addresses=local_addresses)


def _inspect(report: dict, client: CloudDriveClient, target: str, hints: Hints) -> None:
    with client:
        info = client.token_info()
        permissions = info.permissions
        report["root"] = info.rootDir
        for name, code in OFFLINE_PERMISSIONS.items():
            granted = bool(getattr(permissions, name))
            label = interface_text.text(f"server:{code}")
            report["permissions"].append({"name": name, "label": label, "label_code": code, "granted": granted})
            if not granted:
                report["missing"].append(label)
                report["missing_codes"].append(code)
        probe = _PrefixProbe(client, hints.prefixes)
        if hints.target_enabled:
            _inspect_target(report, client, probe, target, hints)
        if hints.pikpak_account and not hints.pikpak_root:
            try:
                _suggest_pikpak_root(report, probe, hints)
            except DownloadError as error:
                add_problem(report, Problem.of(error))


def _inspect_target(report: dict, client: CloudDriveClient, probe: "_PrefixProbe", target: str,
                    hints: Hints) -> None:
    try:
        if not target:
            target = _suggest_target(report, client, probe, hints)
            if not target:
                return
        folder = client.folder(target)
    except DownloadError as error:
        add_problem(report, Problem.of(error))
        return
    report["folder"] = {"path": folder.path, "can_offline": folder.can_offline,
                        "cloud": folder.cloud_name}
    try:
        quota = client.quota(folder)
    except DownloadError as error:
        add_problem(report, Problem.of(error))
        return
    report["quota"] = {"total": quota.total, "used": quota.used, "left": quota.left}


class _PrefixProbe:
    """每条推送前缀在 CloudDrive2 里是什么，一次检查里只问一遍。"""

    def __init__(self, client: CloudDriveClient, prefixes: tuple[CloudPrefix, ...]):
        self.client = client
        self.prefixes = tuple(CloudPrefix(normalise_prefix(entry.prefix), entry.root)
                              for entry in prefixes)
        self.found: dict[str, pb.CloudDriveFile | None] = {}

    def lookup(self, prefix: str) -> pb.CloudDriveFile | None:
        """前缀在令牌根目录之上时看不到它本身，改看根目录：同一个云盘，类型一样。"""
        if prefix not in self.found:
            self.found[prefix] = self.client.find(within_token_root(self.client.root, prefix), "findPrefix")
        return self.found[prefix]

    def of_cloud(self, clouds: frozenset[str]) -> list[tuple[CloudPrefix, pb.CloudDriveFile]]:
        hits = []
        for entry in self.prefixes:
            found = self.lookup(entry.prefix)
            if found is not None and found.isDirectory \
                    and (found.CloudAPI.name or "").strip().casefold() in clouds:
                hits.append((entry, found))
        return hits


def _roots(hints: Hints, location: str) -> dict[str, str]:
    return {str(root).casefold(): str(root) for root in hints.declared_roots.get(location, ())}


def _suggest_target(report: dict, client: CloudDriveClient, probe: _PrefixProbe,
                    hints: Hints) -> str:
    """推一个 115 目标目录。目录存在才返回它，接着查离线与配额；不存在只报建议值。"""
    declared = _roots(hints, "115")
    hits = sorted(probe.of_cloud(CLOUDS_115),
                  key=lambda hit: (hit[0].root.casefold() not in declared, len(hit[0].prefix)))
    if not hits:
        known = [entry.prefix for entry in probe.prefixes]
        add_problem(report, Problem("labels.downloadsClouddrive.no115Prefix", {"known": known}) if known
                    else Problem("labels.downloadsClouddrive.noPrefixes"))
        return ""
    candidate = f"{hits[0][0].prefix}/{SUGGESTED_FOLDER}"
    if token_path(client.root, candidate) is None:
        candidate = within_token_root(client.root, hits[0][0].prefix)
    found = client.find(candidate)
    exists = found is not None and found.isDirectory
    report["suggested_target"] = {"path": candidate, "exists": exists}
    return candidate if exists else ""


def _suggest_pikpak_root(report: dict, probe: _PrefixProbe, hints: Hints) -> None:
    """PikPak 根目录对应的媒体目录：前缀必须就是 PikPak 云盘根，子目录前缀对不上根。"""
    declared = _roots(hints, "pikpak")
    if not declared:
        return
    for entry, found in probe.of_cloud(CLOUDS_PIKPAK):
        cloud_path = found.CloudAPI.path if found.CloudAPI.HasField("path") else ""
        at_root = found.isCloudRoot or (bool(cloud_path) and normalise_prefix(cloud_path) == entry.prefix)
        if at_root and entry.root.casefold() in declared:
            report["suggested_pikpak_root"] = declared[entry.root.casefold()]
            return
    add_problem(report, Problem("labels.downloadsClouddrive.noPikpakRootPrefix"))
