"""媒体库渠道、只读能力探测与缓存的隔离回归。"""
from types import SimpleNamespace
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from peach.downloads import DownloadConfig, DownloadError, DownloadTask, Landing, REMOTE_DONE
from peach.downloads_channels import LibraryChannels
from peach.downloads_clouddrive import Folder
from peach.push_discovery import CloudPrefix
from peach.follow_secrets import CredentialError


class LibraryChannelTests(unittest.TestCase):
    def test_unavailable_capabilities_leave_phase_and_failure_evidence_without_exposing_credentials(self):
        from peach import error_reporting
        for operation in ('token_permissions', 'folder_capabilities', 'mount_points'):
            with self.subTest(operation=operation), tempfile.TemporaryDirectory() as directory:
                self.setUp()
                error = DownloadError('config', 'errors.downloadsClouddrive.tokenRejected',
                                      {'action': '读取令牌权限', 'details': 'Authorization: Bearer test-only-token'})
                if operation == 'token_permissions':
                    self.client.token_info.side_effect = error
                elif operation == 'folder_capabilities':
                    self.client.folder.side_effect = error
                else:
                    self.client.token_info.return_value.permissions.allow_get_mounts = True
                    self.client.call.side_effect = error
                with patch.object(error_reporting, '_log_dir', Path(directory)):
                    result = self.catalog()
                records = [json.loads(line) for path in Path(directory).glob('errors-*.log')
                           for line in path.read_text(encoding='utf-8').splitlines()]
                record = next(row for row in records if row.get('operation') == operation)
                self.assertEqual(record['stage'], 'download-channel-probe')
                self.assertEqual(record['failure'], 'config')
                self.assertTrue(record['exception'])
                self.assertNotIn('test-only-token', json.dumps(records))
                self.assertNotIn('test-only-token', str(result))
                if operation == 'mount_points':
                    self.assertEqual(len(result['providers']), 1, '可用的路径映射仍应继续探测')
                else:
                    self.assertEqual(result['providers'], [])
                    self.assertTrue(result['problems'])

    def test_a_broken_clouddrive_credential_keeps_a_healthy_pikpak_channel(self):
        self.credentials.load.side_effect = CredentialError(
            "errors.followSecrets.missingFields", {"provider": "clouddrive2", "fields": "test-only-secret-detail"})
        self.credentials.describe.return_value = {"fields": ["refresh_token"]}
        self.service.config = DownloadConfig("http://localhost:bad-port", targets={"pikpak": "/Movies"},
                                             pikpak_root="P:\\")
        self.service.landing.declared_roots["pikpak"] = ("P:\\",)
        result = self.catalog()
        self.assertEqual([row["key"] for row in result["providers"]], ["pikpak"])
        self.assertIn("CloudDrive2 令牌无法读取", result["problems"][0])
        self.assertNotIn("test-only-secret-detail", str(result))
        self.factory.assert_not_called()

    def setUp(self):
        self.credentials = Mock()
        self.credentials.load.return_value = SimpleNamespace(values={"token": "test-only-token"})
        self.credentials.describe.return_value = {"fields": []}
        self.push = SimpleNamespace(config=SimpleNamespace(prefixes=(
            CloudPrefix("/duck/Movies", "G:\\Movies"), CloudPrefix("/drive", "O:\\Movies"))))
        self.service = SimpleNamespace(
            config=DownloadConfig("http://127.0.0.1:19798"), credentials=self.credentials,
            landing=SimpleNamespace(push_discovery=self.push,
                                    declared_roots={"guangya": ("G:\\Movies",), "onedrive": ("O:\\Movies",)}))
        self.names = {"G:\\Movies": "我的影片", "O:\\Movies": "文档"}
        self.client = Mock()
        self.client.__enter__ = Mock(return_value=self.client)
        self.client.__exit__ = Mock(return_value=False)
        self.client.token_info.return_value = SimpleNamespace(rootDir="/", permissions=SimpleNamespace(
            allow_add_offline_download=True, allow_list_offline_downloads=True, allow_modify_offline_downloads=True))
        self.client.folder.side_effect = lambda path: Folder(path, path.startswith("/duck"), "cloud", "test-account")
        self.factory = Mock(return_value=self.client)
        self.clock = 0
        self.catalog = LibraryChannels(self.service, lambda: self.names, client=self.factory, clock=lambda: self.clock)

    def test_only_declared_cloud_libraries_with_offline_capability_are_listed(self):
        result = self.catalog()
        self.assertEqual(len(result["providers"]), 1)
        channel = result["providers"][0]
        self.assertTrue(channel["key"].startswith("clouddrive:guangya:"))
        self.assertEqual((channel["source"], channel["label"], channel["target"]),
                         ("guangya", "我的影片 · 光鸭云盘", "/duck/Movies"))
        self.assertEqual(result["problems"], [])
        self.client.add.assert_not_called()
        self.client.create_folder.assert_not_called()
        self.client.remove.assert_not_called()

    def test_library_removal_and_rename_invalidate_the_cache(self):
        key = self.catalog()["providers"][0]["key"]
        self.names["G:\\Movies"] = "收藏"
        channel = self.catalog()["providers"][0]
        self.assertEqual((channel["key"], channel["label"]), (key, "收藏 · 光鸭云盘"))
        self.service.landing.declared_roots = {"onedrive": ("O:\\Movies",)}
        self.assertEqual(self.catalog()["providers"], [])

    def test_submission_only_cloud_is_available_without_a_cancel_action(self):
        self.client.folder.side_effect = lambda path: Folder(path, path.startswith("/duck"), "cloud", "test-account", False)
        channel = self.catalog()["providers"][0]
        self.assertEqual(channel["source"], "guangya")
        self.assertFalse(channel["can_cancel"])
        self.assertEqual(channel["cloud_root"], "/duck/Movies")

    def test_a_token_limited_below_the_library_prefix_lands_in_its_root(self):
        self.client.token_info.return_value.rootDir = "/duck/Movies/Peach"
        channel = self.catalog()["providers"][0]
        self.assertEqual((channel["target"], channel["cloud_root"]), ("/duck/Movies/Peach", "/duck/Movies"))
        self.client.folder.assert_any_call("/duck/Movies/Peach")

    def test_capability_cache_expires_and_credential_changes_invalidate_it(self):
        self.catalog()
        self.catalog()
        self.assertEqual(self.factory.call_count, 1)
        self.clock = 31
        self.catalog()
        self.assertEqual(self.factory.call_count, 2)
        self.credentials.load.return_value = SimpleNamespace(values={"token": "test-only-rotated"})
        self.catalog()
        self.assertEqual(self.factory.call_count, 3)

    def test_missing_permissions_or_unavailable_connection_never_enable_a_channel(self):
        self.client.token_info.return_value.permissions.allow_add_offline_download = False
        self.assertEqual(self.catalog()["providers"], [])
        self.client.folder.assert_not_called()
        self.clock = 31
        self.client.token_info.side_effect = DownloadError(
            "network", "errors.downloadsClouddrive.unreachable", {"action": "读取令牌权限", "details": "test-only-failure"})
        result = self.catalog()
        self.assertEqual(result["providers"], [])
        self.assertTrue(result["problems"])
        self.assertNotIn("test-only-token", str(result))

    def test_pikpak_direct_channel_requires_its_configured_media_root(self):
        self.credentials.describe.return_value = {"fields": ["refresh_token"]}
        self.service.config = DownloadConfig(targets={"pikpak": "/Movies"}, pikpak_root="P:\\")
        self.assertEqual(self.catalog()["providers"], [])
        self.service.landing.declared_roots["pikpak"] = ("P:\\",)
        self.names["P:\\"] = "PikPak"
        channel = self.catalog()["providers"][0]
        self.assertEqual((channel["key"], channel["target"]), ("pikpak", "/Movies"))

    def test_saved_target_is_used_only_inside_the_library_mapping(self):
        self.service.config.targets["guangya"] = "/duck/Movies/收藏"
        channel = self.catalog()["providers"][0]
        self.assertEqual(channel["target"], "/duck/Movies/收藏")
        self.service.config.targets["guangya"] = "/other/Movies"
        self.assertEqual(self.catalog()["providers"][0]["target"], "/duck/Movies")

    def test_clouddrive_mount_points_resolve_media_without_a_push_prefix(self):
        self.push.config.prefixes = ()
        self.service.landing.mounts = {"guangya": ("/mnt/cloud/Movies",)}
        self.client.token_info.return_value.permissions.allow_get_mounts = True
        self.client.call.return_value = SimpleNamespace(mountPoints=[SimpleNamespace(
            mountPoint="/mnt/cloud", sourceDir="/duck", localMount=False, isMounted=True)])
        result = self.catalog()
        self.assertEqual(result["providers"][0]["target"], "/duck/Movies")
        self.assertTrue(result["problems"])
        channel = result["providers"][0]
        landing = Landing(self.push, declared_roots=self.service.landing.declared_roots)
        landing.channel_catalog = self.catalog
        task = DownloadTask(1, None, channel["key"], "", "SSIS-519.mkv", channel["target"], REMOTE_DONE)
        self.assertEqual(landing.ledger_path(task, self.service.config), ("guangya", "G:\\Movies\\SSIS-519.mkv"))

    def test_checks_skip_provider_specific_work_without_its_media_source(self):
        from peach.downloads_clouddrive import _inspect, empty_report
        from peach.web_downloads import _hints
        self.credentials.describe.return_value = {"fields": ["refresh_token"]}
        hints = _hints(self.service, {"pikpak_account": True})
        self.assertFalse(hints.target_enabled)
        self.assertFalse(hints.pikpak_account)
        _inspect(empty_report("http://127.0.0.1:19798"), self.client, "", hints)
        self.client.folder.assert_not_called()
        self.client.quota.assert_not_called()
