"""115 云下载经 CloudDrive2 gRPC：起一个进程内的假服务端，走真实的序列化与元数据。

假服务端只实现那八个方法，状态放在内存里。断言落在「Peach 发出去的是什么」上：令牌只在
`authorization` 元数据里，提交前先查目录与配额，已有同一 infohash 的任务就不再提交，
地址留空时只用不带令牌的 `GetSystemInfo` 探测，目标目录留空时按 CloudDrive2 报的云盘类型
从推送前缀里推，只有用户点了才建目录。
"""
from __future__ import annotations

import socket
import unittest
from concurrent import futures

import grpc

from peach import downloads as dl
from peach import interface_text
from peach import downloads_clouddrive as cd
from peach import downloads_clouddrive_pb2 as pb
from peach.push_discovery import CloudPrefix

HASH = "c9e15763f722f23e98a29decdfae341b98d53056"
MAGNET = dl.parse_magnet(f"magnet:?xt=urn:btih:{HASH}&dn=ABC-123")
TOKEN = "token-for-tests"
TARGET = "/115/云下载"


class FakeCloudDrive:
    def __init__(self):
        self.calls: list[tuple[str, object, str]] = []
        self.folders = {TARGET: True}
        #: 挂载树里的云盘根 → CloudDrive2 报的云盘类型。没登记的目录都算在 115 上。
        self.clouds = {"/115": "115open"}
        self.create_error = ""
        self.offline: list[pb.OfflineFile] = []
        self.quota = pb.OfflineQuotaInfo(total=1500, used=3, left=1497)
        self.add_error = ""
        self.add_abort = ""
        self.files: set[str] = set()
        self.files_after_refresh: set[str] = set()
        self.list_error = None
        self.can_manage = True
        #: 令牌根目录。状态里一律记完整路径；限定了根目录时，收到的路径照 CloudDrive2 实测行为
        #: 接在根目录后面，所以传完整路径会找到 `<根>/<完整路径>` 去。
        self.root = "/"

    def _full(self, path: str) -> str:
        path = "/" + path.strip("/")
        if self.root == "/":
            return path
        return self.root if path == "/" else self.root + path

    def _auth(self, name, request, context):
        header = dict(context.invocation_metadata()).get("authorization", "")
        self.calls.append((name, request, header))
        if header != f"Bearer {TOKEN}":
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")

    def GetSystemInfo(self, request, context):
        header = dict(context.invocation_metadata()).get("authorization", "")
        self.calls.append(("GetSystemInfo", request, header))
        return pb.CloudDriveSystemInfo(IsLogin=True, UserName="u1", SystemReady=True)

    def GetSystemSettings(self, request, context):
        self._auth('GetSystemSettings', request, context)
        return pb.SystemSettings()

    def GetApiTokenInfo(self, request, context):
        self._auth("GetApiTokenInfo", request, context)
        return pb.TokenInfo(token=request.value, rootDir=self.root, permissions=pb.TokenPermissions(
            allow_add_offline_download=True, allow_list_offline_downloads=True))

    def GetAllCloudApis(self, request, context):
        self._auth('GetAllCloudApis', request, context)
        return pb.CloudAPIList()

    def GetCloudAPIConfig(self, request, context):
        self._auth('GetCloudAPIConfig', request, context)
        return pb.CloudAPIConfig()

    def SetCloudAPIConfig(self, request, context):
        self._auth('SetCloudAPIConfig', request, context)
        from google.protobuf.empty_pb2 import Empty
        return Empty()

    def GetMountPoints(self, request, context):
        self._auth('GetMountPoints', request, context)
        return pb.GetMountPointsResult()

    def FindFileByPath(self, request, context):
        self._auth("FindFileByPath", request, context)
        full = self._full(f"{request.parentPath.rstrip('/')}/{request.path}")
        if full in self.folders:
            root = max((root for root in self.clouds if full == root or full.startswith(root + "/")),
                       key=len, default="/115")
            return pb.CloudDriveFile(name=request.path, fullPathName=full, isDirectory=True,
                                     isCloudRoot=full == root, canOfflineDownload=self.folders[full],
                                     supportOfflineDownloadManagement=self.can_manage,
                                     CloudAPI=pb.CloudAPI(name=self.clouds.get(root, "115open"),
                                                          userName="u1", path=root))
        if full in self.files:
            return pb.CloudDriveFile(name=request.path, fullPathName=full)
        context.abort(grpc.StatusCode.NOT_FOUND, "no such file")

    def GetSubFiles(self, request, context):
        self._auth('GetSubFiles', request, context)
        if self.list_error is not None:
            context.abort(self.list_error, 'listing unavailable')
        self.files.update(self.files_after_refresh)
        yield pb.SubFilesReply()

    def CreateFolder(self, request, context):
        self._auth("CreateFolder", request, context)
        if self.create_error:
            return pb.CreateFolderResult(result=pb.FileOperationResult(
                success=False, errorMessage=self.create_error))
        full = self._full(f"{request.parentPath.rstrip('/')}/{request.folderName}")
        self.folders[full] = True
        return pb.CreateFolderResult(
            folderCreated=pb.CloudDriveFile(name=request.folderName, fullPathName=full, isDirectory=True),
            result=pb.FileOperationResult(success=True))

    def AddOfflineFiles(self, request, context):
        self._auth("AddOfflineFiles", request, context)
        if self.add_abort:
            context.abort(grpc.StatusCode.UNKNOWN, self.add_abort)
        if self.add_error:
            return pb.FileOperationResult(success=False, errorMessage=self.add_error)
        self.offline.append(pb.OfflineFile(name="ABC-123", url=request.urls, infoHash=HASH,
                                           status=pb.OFFLINE_DOWNLOADING, percendDone=12.5))
        return pb.FileOperationResult(success=True)

    def RemoveOfflineFiles(self, request, context):
        self._auth("RemoveOfflineFiles", request, context)
        self.offline = [item for item in self.offline if item.infoHash not in request.infoHashes]
        return pb.FileOperationResult(success=True)

    def ListOfflineFilesByPath(self, request, context):
        self._auth("ListOfflineFilesByPath", request, context)
        return pb.OfflineFileListResult(offlineFiles=self.offline)

    def GetOfflineQuotaInfo(self, request, context):
        self._auth("GetOfflineQuotaInfo", request, context)
        return self.quota


def closed_address() -> str:
    """本机一个刚放开、没人在听的端口。"""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    return f"http://127.0.0.1:{port}"


class _Server(unittest.TestCase):
    def setUp(self):
        self.fake = FakeCloudDrive()
        self.server, self.address = self.serve(self.fake)
        self.provider = cd.CloudDriveProvider(self.address, TOKEN)

    def serve(self, fake: FakeCloudDrive) -> tuple[grpc.Server, str]:
        handlers = {
            name: grpc.unary_unary_rpc_method_handler(
                getattr(fake, name), request_deserializer=request.FromString,
                response_serializer=response.SerializeToString)
            for name, (request, response) in cd._METHODS.items()}
        handlers['GetSubFiles'] = grpc.unary_stream_rpc_method_handler(
            fake.GetSubFiles, request_deserializer=pb.FileRequest.FromString,
            response_serializer=pb.SubFilesReply.SerializeToString)
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
        server.add_generic_rpc_handlers(
            (grpc.method_handlers_generic_handler("clouddrive.CloudDriveFileSrv", handlers),))
        port = server.add_insecure_port("127.0.0.1:0")
        server.start()
        self.addCleanup(server.stop, None)
        return server, f"http://127.0.0.1:{port}"

    def methods(self) -> list[str]:
        return [name for name, _request, _header in self.fake.calls]


class SubmitTests(_Server):
    def test_cloud_without_task_management_submits_and_waits_for_the_file(self):
        self.fake.can_manage = False
        self.assertEqual(self.provider.submit(MAGNET, TARGET).state, dl.RUNNING)
        self.assertNotIn("ListOfflineFilesByPath", self.methods())
        self.assertNotIn("GetOfflineQuotaInfo", self.methods())
        task = dl.DownloadTask(1, HASH, "clouddrive:guangya:test", MAGNET.uri, "ABC-123", TARGET, dl.SUBMITTED)
        self.assertEqual(self.provider.status(task).state, dl.RUNNING)
        self.fake.files.add(f"{TARGET}/ABC-123")
        self.assertEqual(self.provider.status(task).state, dl.DONE)
        with self.assertRaisesRegex(dl.DownloadError, "到网盘中处理"):
            self.provider.cancel(task)
        self.assertNotIn("RemoveOfflineFiles", self.methods())

    def test_a_submission_checks_the_folder_and_quota_then_adds(self):
        status = self.provider.submit(MAGNET, TARGET)
        self.assertEqual((status.state, status.adopted), (dl.RUNNING, False))
        self.assertEqual(self.methods(), ["GetApiTokenInfo", "FindFileByPath", "ListOfflineFilesByPath",
                                          "GetOfflineQuotaInfo", "AddOfflineFiles"])
        add = self.fake.calls[-1][1]
        self.assertEqual((add.urls, add.toFolder, add.checkFolderAfterSecs),
                         (MAGNET.uri, TARGET, cd.CHECK_FOLDER_AFTER_SECS))
        quota = self.fake.calls[3][1]
        self.assertEqual((quota.cloudName, quota.cloudAccountId, quota.path), ("115open", "u1", TARGET))

    def test_the_token_travels_only_in_the_metadata(self):
        self.provider.submit(MAGNET, TARGET)
        for name, request, header in self.fake.calls:
            with self.subTest(name=name):
                self.assertEqual(header, f"Bearer {TOKEN}")
                if name != "GetApiTokenInfo":
                    self.assertNotIn(TOKEN.encode(), request.SerializeToString())

    def test_a_task_already_in_the_folder_is_adopted_without_adding(self):
        self.provider.submit(MAGNET, TARGET)
        self.fake.calls.clear()
        status = self.provider.submit(MAGNET, TARGET)
        self.assertTrue(status.adopted)
        self.assertNotIn("AddOfflineFiles", self.methods())
        self.assertNotIn("GetOfflineQuotaInfo", self.methods())

    def test_an_exhausted_quota_stops_before_adding(self):
        self.fake.quota = pb.OfflineQuotaInfo(total=200, used=200, left=0)
        with self.assertRaises(dl.DownloadError) as caught:
            self.provider.submit(MAGNET, TARGET)
        self.assertEqual(caught.exception.failure, "quota")
        self.assertNotIn("AddOfflineFiles", self.methods())

    def test_full_cloud_storage_is_its_own_failure_on_both_error_paths(self):
        text = "api error Cloud 115open(1) api error: code: 190031, message: 云空间不足，请扩容空间或升级VIP"
        for field in ("add_abort", "add_error"):
            with self.subTest(field=field):
                self.fake.add_abort = self.fake.add_error = ""
                setattr(self.fake, field, text)
                with self.assertRaises(dl.DownloadError) as caught:
                    self.provider.submit(MAGNET, TARGET)
                self.assertEqual((caught.exception.failure, caught.exception.code),
                                 ("storage", "errors.downloads.remoteStorageFull"))
                self.assertNotIn("115open", caught.exception.detail)

    def test_the_50038_block_is_flagged(self):
        self.fake.add_error = "errno: 50038, 该资源涉嫌违规"
        with self.assertRaises(dl.DownloadError) as caught:
            self.provider.submit(MAGNET, TARGET)
        self.assertEqual((caught.exception.failure, caught.exception.block), ("rejected", True))

    def test_a_folder_that_cannot_take_offline_tasks_is_a_configuration_problem(self):
        self.fake.folders[TARGET] = False
        with self.assertRaises(dl.DownloadError) as caught:
            self.provider.submit(MAGNET, TARGET)
        self.assertEqual(caught.exception.failure, "config")
        with self.assertRaises(dl.DownloadError) as caught:
            self.provider.submit(MAGNET, "/115/没有这个目录")
        self.assertIn("没有", caught.exception.detail)

    def test_a_wrong_token_and_an_unreachable_server_are_told_apart(self):
        with self.assertRaises(dl.DownloadError) as caught:
            cd.CloudDriveProvider(self.address, "wrong").submit(MAGNET, TARGET)
        self.assertEqual(caught.exception.failure, "config")
        self.assertEqual(caught.exception.code, "errors.downloadsClouddrive.tokenRejected")
        self.assertEqual(caught.exception.params["action"], {"code": "labels.downloadsClouddrive.action.verifyToken"})
        self.assertTrue(caught.exception.detail.startswith("CloudDrive2 拒绝了这个 API 令牌（核对 API 令牌）："))
        self.server.stop(None)
        with self.assertRaises(dl.DownloadError) as caught:
            self.provider.status(dl.DownloadTask(1, HASH, "115", MAGNET.uri, "", TARGET, dl.SUBMITTED))
        self.assertEqual(caught.exception.failure, "network")
        english = interface_text.text(f"server:{caught.exception.code}", caught.exception.params, language="en")
        self.assertTrue(english.startswith("Cannot reach CloudDrive2 while checking the API token: "))


class TrackingTests(_Server):
    def task(self) -> dl.DownloadTask:
        return dl.DownloadTask(1, HASH, "115", MAGNET.uri, "ABC-123", TARGET, dl.SUBMITTED)

    def test_status_is_matched_by_infohash_or_the_original_link(self):
        self.provider.submit(MAGNET, TARGET)
        status = self.provider.status(self.task())
        self.assertEqual((status.state, status.progress), (dl.RUNNING, 0.125))
        self.fake.offline = [pb.OfflineFile(name="ABC-123", url=MAGNET.uri, status=pb.OFFLINE_FINISHED)]
        self.assertEqual(self.provider.status(self.task()).state, dl.DONE)
        self.fake.offline = []
        self.assertEqual(self.provider.status(self.task()).state, dl.MISSING)

    def test_landed_looks_for_the_name_in_the_target_folder(self):
        self.assertFalse(self.provider.landed(self.task()))
        self.fake.files.add(f"{TARGET}/ABC-123")
        self.assertTrue(self.provider.landed(self.task()))

    def test_landed_refreshes_the_official_directory_cache(self):
        self.fake.files_after_refresh.add(f'{TARGET}/ABC-123')
        self.assertTrue(self.provider.landed(self.task()))
        name, request, header = next(call for call in self.fake.calls if call[0] != 'GetApiTokenInfo')
        self.assertEqual((name, request.path, request.forceRefresh), ('GetSubFiles', TARGET, True))
        self.assertEqual(header, f'Bearer {TOKEN}')

    def test_directory_refresh_network_failure_remains_retryable(self):
        self.fake.list_error = grpc.StatusCode.UNAVAILABLE
        with self.assertRaises(dl.DownloadError) as caught:
            self.provider.landed(self.task())
        self.assertEqual(caught.exception.failure, 'network')
        # 连接建不起来说明 CloudDrive2 整个用不了；超时只是这一次慢，按任务重试。
        self.assertTrue(caught.exception.channel_down)
        self.fake.list_error = grpc.StatusCode.DEADLINE_EXCEEDED
        with self.assertRaises(dl.DownloadError) as caught:
            self.provider.landed(self.task())
        self.assertEqual((caught.exception.failure, caught.exception.channel_down), ('network', False))

    def test_cancelling_keeps_the_downloaded_files(self):
        self.provider.submit(MAGNET, TARGET)
        self.provider.cancel(self.task())
        remove = [request for name, request, _ in self.fake.calls if name == "RemoveOfflineFiles"][0]
        self.assertEqual((list(remove.infoHashes), remove.deleteFiles, remove.cloudName),
                         ([HASH], False, "115open"))
        self.assertEqual(self.fake.offline, [])


class CheckTests(_Server):
    def test_the_check_reports_permissions_folder_and_quota(self):
        report = cd.check(self.address, TOKEN, TARGET)
        self.assertEqual(report["missing"], ["取消离线任务"])
        self.assertEqual(report["missing_codes"], ["labels.downloadsClouddrive.permission.modifyOffline"])
        self.assertEqual(report["folder"], {"path": TARGET, "can_offline": True, "cloud": "115open"})
        self.assertEqual(report["quota"], {"total": 1500, "used": 3, "left": 1497})
        self.assertEqual(report["problems"], [])
        self.assertEqual(report["address"], self.address)
        self.assertNotIn("AddOfflineFiles", self.methods())
        self.assertNotIn("GetSystemInfo", self.methods())

    def test_without_a_token_nothing_is_called(self):
        report = cd.check(self.address, "", TARGET)
        self.assertFalse(report["ok"])
        self.assertIn("API 令牌", report["problems"][0])
        self.assertEqual(report["problem_codes"], [{"code": "errors.downloadsClouddrive.tokenMissing", "params": {}}])
        self.assertEqual(self.fake.calls, [])

    def test_a_blank_address_takes_the_first_local_address_that_answers(self):
        second = FakeCloudDrive()
        _server, second_address = self.serve(second)
        report = cd.check("", TOKEN, TARGET, local_addresses=(self.address, second_address))
        self.assertEqual((report["ok"], report["address"]), (True, self.address))
        self.assertEqual(self.methods()[0], "GetSystemInfo")
        self.assertEqual(self.fake.calls[0][2], "")
        self.assertEqual(second.calls, [])

    def test_a_blank_address_falls_through_to_the_second_local_address(self):
        report = cd.check("", TOKEN, TARGET, local_addresses=(closed_address(), self.address))
        self.assertEqual(report["address"], self.address)
        self.assertEqual(report["quota"], {"total": 1500, "used": 3, "left": 1497})

    def test_a_blank_address_without_a_token_still_finds_the_address(self):
        report = cd.check("", "", TARGET, local_addresses=(self.address,))
        self.assertEqual((report["ok"], report["address"]), (False, self.address))
        self.assertEqual(self.methods(), ["GetSystemInfo"])

    def test_no_local_address_answering_lists_every_address_tried(self):
        tried = (closed_address(), closed_address())
        with self.assertRaises(dl.DownloadError) as caught:
            cd.check("", TOKEN, TARGET, local_addresses=tried)
        self.assertEqual(caught.exception.failure, "network")
        for address in tried:
            self.assertIn(address, caught.exception.detail)

    def test_addresses_turn_into_grpc_targets(self):
        self.assertEqual(cd.channel_target("http://127.0.0.1"), ("127.0.0.1:19798", False))
        self.assertEqual(cd.channel_target("https://192.0.2.10:8443"), ("192.0.2.10:8443", True))
        self.assertEqual(cd.channel_target("http://[::1]:19798"), ("[::1]:19798", False))
        for address in ("http://localhost:bad-port", "http://localhost:0", "http://localhost:65536"):
            with self.subTest(address=address), self.assertRaises(dl.DownloadError) as raised:
                cd.channel_target(address)
            self.assertEqual(raised.exception.failure, "config")

    def test_discovery_returns_only_validated_service_addresses(self):
        from unittest.mock import patch
        with patch.object(cd, "answers", return_value=True) as answers:
            address = cd.discover(("http://localhost:bad-port", "127.0.0.1:19798"))
        self.assertEqual(address, "http://127.0.0.1:19798")
        answers.assert_called_once_with(address)
        self.assertTrue(all(dl.clean_address(address) == address for address in cd.LOCAL_ADDRESSES))
        self.assertEqual(cd.split_remote("/115/云下载/"), ("/115", "云下载"))


class SuggestionTests(_Server):
    """前缀名字故意和云盘对不上：`/甲` 是 115 的挂载根，`/115假` 是 PikPak 的。"""

    def setUp(self):
        super().setUp()
        self.fake.clouds.update({"/甲": "115open", "/115假": "PikPak"})
        self.fake.folders.update({"/甲": True, "/115假": False})
        self.prefixes = (CloudPrefix("/115假", "A:\\"), CloudPrefix("/甲", "B:\\"))
        self.roots = {"115": ("B:\\",), "pikpak": ("A:\\",), "local": ("C:\\媒体",)}

    def hints(self, *, prefixes=None, roots=None, pikpak_root="", pikpak_account=True) -> cd.Hints:
        return cd.Hints(self.prefixes if prefixes is None else prefixes,
                        self.roots if roots is None else roots, pikpak_root, pikpak_account)

    def finds(self) -> list[str]:
        return [f"{request.parentPath.rstrip('/')}/{request.path}"
                for name, request, _ in self.fake.calls if name == "FindFileByPath"]

    def test_a_blank_target_takes_the_folder_under_the_prefix_clouddrive_reports_as_115(self):
        self.fake.folders["/甲/云下载"] = True
        report = cd.check(self.address, TOKEN, "", hints=self.hints())
        self.assertEqual(report["suggested_target"], {"path": "/甲/云下载", "exists": True})
        self.assertEqual(report["folder"], {"path": "/甲/云下载", "can_offline": True, "cloud": "115open"})
        self.assertEqual(report["quota"], {"total": 1500, "used": 3, "left": 1497})
        self.assertEqual(report["suggested_pikpak_root"], "A:\\")
        self.assertEqual(report["problems"], [])

    def test_a_missing_suggested_folder_is_reported_and_never_created(self):
        report = cd.check(self.address, TOKEN, "", hints=self.hints(pikpak_root="A:\\"))
        self.assertEqual(report["suggested_target"], {"path": "/甲/云下载", "exists": False})
        self.assertEqual((report["folder"], report["quota"], report["problems"]), (None, None, []))
        self.assertNotIn("CreateFolder", self.methods())
        self.assertNotIn("GetOfflineQuotaInfo", self.methods())

    def test_a_declared_115_root_wins_over_another_115_prefix(self):
        self.fake.clouds["/乙"] = "115"
        self.fake.folders.update({"/乙": True, "/乙/云下载": True, "/甲/云下载": True})
        prefixes = (CloudPrefix("/乙", "C:\\媒体"), CloudPrefix("/甲/深一层", "B:\\"))
        self.fake.folders["/甲/深一层"] = True
        report = cd.check(self.address, TOKEN, "", hints=self.hints(prefixes=prefixes, pikpak_root="A:\\"))
        self.assertEqual(report["suggested_target"]["path"], "/甲/深一层/云下载")

    def test_without_a_115_prefix_the_problem_points_at_push_discovery(self):
        only_pikpak = (CloudPrefix("/115假", "A:\\"),)
        report = cd.check(self.address, TOKEN, "", hints=self.hints(prefixes=only_pikpak, pikpak_root="A:\\"))
        self.assertIsNone(report["suggested_target"])
        self.assertEqual(len(report["problems"]), 1)
        self.assertIn("「推送发现」", report["problems"][0])
        self.assertIn("/115假", report["problems"][0])
        self.assertEqual(report["problem_codes"], [
            {"code": "labels.downloadsClouddrive.no115Prefix", "params": {"known": ["/115假"]}}])
        report = cd.check(self.address, TOKEN, "", hints=self.hints(prefixes=(), pikpak_root="A:\\"))
        self.assertIn("没有登记云端路径前缀", report["problems"][0])

    def test_a_pikpak_prefix_below_the_cloud_root_is_not_the_pikpak_root(self):
        self.fake.folders["/115假/影视"] = False
        roots = {"115": ("B:\\",), "pikpak": ("A:\\影视",)}
        prefixes = (CloudPrefix("/115假/影视", "A:\\影视"), CloudPrefix("/甲", "B:\\"))
        report = cd.check(self.address, TOKEN, "/115/云下载", hints=self.hints(prefixes=prefixes, roots=roots))
        self.assertEqual(report["suggested_pikpak_root"], "")
        self.assertEqual(len(report["problems"]), 1)
        self.assertIn("PikPak 根目录对应的媒体目录", report["problems"][0])

    def test_without_a_pikpak_account_the_pikpak_root_is_left_alone(self):
        report = cd.check(self.address, TOKEN, TARGET, hints=self.hints(prefixes=(), pikpak_account=False))
        self.assertEqual((report["suggested_pikpak_root"], report["problems"]), ("", []))
        self.assertEqual(self.finds(), [TARGET])

    def test_filled_fields_ask_nothing_about_the_prefixes(self):
        report = cd.check(self.address, TOKEN, TARGET, hints=self.hints(pikpak_root="A:\\"))
        self.assertEqual(self.finds(), [TARGET])
        self.assertEqual((report["suggested_target"], report["suggested_pikpak_root"]), (None, ""))

    def test_creating_the_folder_happens_only_on_request_and_checks_it_again(self):
        report = cd.create_folder(self.address, TOKEN, "/甲/云下载", hints=self.hints(pikpak_root="A:\\"))
        created = [request for name, request, _ in self.fake.calls if name == "CreateFolder"]
        self.assertEqual([(request.parentPath, request.folderName) for request in created],
                         [("/甲", "云下载")])
        self.assertEqual(report["folder"], {"path": "/甲/云下载", "can_offline": True, "cloud": "115open"})
        self.fake.create_error = "没有新建文件夹的权限"
        with self.assertRaises(dl.DownloadError) as caught:
            cd.create_folder(self.address, TOKEN, "/甲/另一个", hints=self.hints())
        self.assertIn("没有新建文件夹的权限", caught.exception.detail)


class RestrictedRootTests(_Server):
    """令牌根目录限定在 `/115/Peach`：Peach 照旧记完整路径，发出去的是相对根目录的路径。"""

    ROOT = "/115/Peach"

    def setUp(self):
        super().setUp()
        self.fake.root = self.ROOT
        self.fake.folders = {self.ROOT: True, f"{self.ROOT}/云下载": True}

    def sent(self, method: str):
        return [request for name, request, _ in self.fake.calls if name == method]

    def test_submitting_and_tracking_send_paths_relative_to_the_token_root(self):
        for target, inner in ((self.ROOT, "/"), (f"{self.ROOT}/云下载", "/云下载")):
            with self.subTest(target=target):
                self.fake.calls.clear()
                self.fake.offline.clear()
                self.assertEqual(self.provider.submit(MAGNET, target).state, dl.RUNNING)
                self.assertEqual([request.toFolder for request in self.sent("AddOfflineFiles")], [inner])
                self.assertEqual([request.path for request in self.sent("ListOfflineFilesByPath")], [inner])
                self.assertEqual([request.path for request in self.sent("GetOfflineQuotaInfo")], [inner])
                task = dl.DownloadTask(1, HASH, "clouddrive:115:test", MAGNET.uri, "ABC-123", target, dl.SUBMITTED)
                self.assertEqual(self.provider.status(task).state, dl.RUNNING)
                self.provider.cancel(task)
                self.assertEqual([request.path for request in self.sent("RemoveOfflineFiles")], [inner])
        self.fake.files.add(f"{self.ROOT}/云下载/ABC-123")
        task = dl.DownloadTask(1, HASH, "clouddrive:115:test", MAGNET.uri, "ABC-123", f"{self.ROOT}/云下载",
                               dl.SUBMITTED, remote_name="ABC-123")
        self.assertTrue(self.provider.landed(task))

    def test_a_path_outside_the_token_root_is_refused_before_anything_is_written(self):
        for call in (lambda: self.provider.submit(MAGNET, "/115/云下载"),
                     lambda: cd.create_folder(self.address, TOKEN, "/115/云下载")):
            with self.assertRaises(dl.DownloadError) as caught:
                call()
            self.assertEqual((caught.exception.failure, caught.exception.code),
                             ("config", "errors.downloadsClouddrive.outsideTokenRoot"))
            self.assertIn(self.ROOT, caught.exception.detail)
        self.assertEqual(self.sent("AddOfflineFiles") + self.sent("CreateFolder"), [])

    def test_the_check_suggests_the_token_root_under_a_115_prefix(self):
        report = cd.check(self.address, TOKEN, "", hints=cd.Hints((CloudPrefix("/115", "B:\\"),), {"115": ("B:\\",)}))
        self.assertEqual(report["root"], self.ROOT)
        self.assertEqual(report["suggested_target"], {"path": self.ROOT, "exists": True})
        self.assertEqual(report["folder"], {"path": self.ROOT, "can_offline": True, "cloud": "115open"})
        self.assertEqual(report["problems"], [])
        report = cd.check(self.address, TOKEN, f"{self.ROOT}/云下载")
        self.assertEqual((report["folder"]["path"], report["problems"]), (f"{self.ROOT}/云下载", []))

    def test_new_folders_are_created_inside_the_token_root(self):
        cd.create_folder(self.address, TOKEN, f"{self.ROOT}/新目录")
        self.assertEqual([(request.parentPath, request.folderName) for request in self.sent("CreateFolder")],
                         [("/", "新目录")])
        self.assertIn(f"{self.ROOT}/新目录", self.fake.folders)


class TokenPathTests(unittest.TestCase):
    def test_paths_map_onto_the_token_root(self):
        self.assertEqual(cd.token_path("/", "/115/云下载"), "/115/云下载")
        self.assertEqual(cd.token_path("", "/115/云下载"), "/115/云下载")
        self.assertEqual(cd.token_path("/115open/Peach", "/115open/Peach"), "/")
        self.assertEqual(cd.token_path("/115open/Peach/", "/115open/peach/云下载"), "/云下载")
        self.assertIsNone(cd.token_path("/115open/Peach", "/115open"))
        self.assertIsNone(cd.token_path("/115open/Peach", "/115open/Peach2"))

    def test_a_prefix_above_the_token_root_becomes_the_root(self):
        self.assertEqual(cd.within_token_root("/115open/Peach", "/115open"), "/115open/Peach")
        self.assertEqual(cd.within_token_root("/115open/Peach", "/115open/Peach/云下载"), "/115open/Peach/云下载")
        self.assertEqual(cd.within_token_root("/115open/Peach", "/PikPak"), "/PikPak")
        self.assertEqual(cd.within_token_root("/", "/115open"), "/115open")


if __name__ == "__main__":
    unittest.main()
