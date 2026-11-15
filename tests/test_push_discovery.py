"""推送发现：去抖、写完判定、云端路径映射、鉴权拒收与单路径登记。

真正会伤到账本的是两件事：把半截文件当成品登记，和把一条云端路径拼成指向别处的账本
路径。这两条各有专门的用例，其余覆盖的是拒收面——密钥不符、来源不是局域网、通道没开。

账本口径的路径在 Windows 上是真实盘符目录，在 macOS 上是 `R:\\media` 加一张挂载表；
`_shape()` 按本机给出当前平台成立的那一种，两边跑的是同一批断言。
"""
from __future__ import annotations

import errno
import json
import os
import sqlite3
import tempfile
import threading
import time
import tomllib
import unittest
from contextlib import closing, contextmanager
from dataclasses import replace
from pathlib import Path, PureWindowsPath
from types import SimpleNamespace
from unittest import mock


from peach import push_discovery as push
from peach import routes_configuration
from peach import scan
from support.ledger import fresh_ledger

CLOUD_ROOT = "B:\\"
LOCAL_LEDGER_ROOT = r"R:\media"


def _wait_for(check, timeout=15.0, interval=0.05):
    """等一个后台线程把事情做完；超时就让调用方自己断言失败。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        found = check()
        if found:
            return found
        time.sleep(interval)
    return check()


@contextmanager
def _hung_mount(root: Path):
    """`root` 下的路径在本进程里一碰就卡住，像挂死的网盘挂载；读取子进程看不到这层替身。"""
    release = threading.Event()
    prefix = os.path.normcase(str(root))

    def hang(real):
        def call(path, *args, **kwargs):
            try:
                touched = os.path.normcase(os.fsdecode(os.fspath(path))).startswith(prefix)
            except TypeError:
                touched = False
            if touched:
                release.wait(60)
            return real(path, *args, **kwargs)
        return call
    with mock.patch.object(os, "stat", hang(os.stat)), mock.patch.object(os, "scandir", hang(os.scandir)), \
            mock.patch.object(os.path, "isdir", hang(os.path.isdir)), \
            mock.patch.object(os.path, "exists", hang(os.path.exists)), \
            mock.patch.object(os.path, "isfile", hang(os.path.isfile)):
        try:
            yield
        finally:
            release.set()


def _within(function, timeout=15.0):
    """在另一个线程里跑 `function`，`timeout` 秒内跑完返回 `(True, 结果或异常)`。"""
    outcome = {}

    def run():
        try:
            outcome["value"] = function()
        except Exception as error:
            outcome["value"] = error
    worker = threading.Thread(target=run, daemon=True)
    worker.start()
    worker.join(timeout)
    return not worker.is_alive(), outcome.get("value")


class CloudPathTests(unittest.TestCase):
    """云端路径只用前缀表加纯字符串切分换算，不进本机 pathlib。"""

    PREFIXES = (push.CloudPrefix("/115", CLOUD_ROOT),
                push.CloudPrefix("/115/影视", r"A:\影视"))

    def test_the_longest_matching_prefix_decides_the_declared_root(self):
        self.assertEqual(push.map_cloud_path("/115/纪录片/a.mp4", self.PREFIXES),
                         str(PureWindowsPath(CLOUD_ROOT, "纪录片", "a.mp4")))
        self.assertEqual(push.map_cloud_path("/115/影视/b.mp4", self.PREFIXES),
                         str(PureWindowsPath(r"A:\影视", "b.mp4")))

    def test_separators_and_repeated_slashes_are_normalised(self):
        for raw in ("115//纪录片//a.mp4", "\\115\\纪录片\\a.mp4"):
            with self.subTest(raw=raw):
                self.assertEqual(push.map_cloud_path(raw, self.PREFIXES),
                                 str(PureWindowsPath(CLOUD_ROOT, "纪录片", "a.mp4")))

    def test_a_path_that_could_escape_the_root_is_refused(self):
        for bad in ("/115/../secret.mp4", "/115/C:x.mp4", "/115/a\nb.mp4"):
            with self.subTest(bad=bad), self.assertRaises(push.CloudPathError):
                push.map_cloud_path(bad, self.PREFIXES)

    def test_an_unconfigured_prefix_and_the_prefix_itself_are_refused(self):
        for bad in ("/pikpak/a.mp4", "/115", "", "/"):
            with self.subTest(bad=bad), self.assertRaises(push.CloudPathError):
                push.map_cloud_path(bad, self.PREFIXES)


class NotificationTests(unittest.TestCase):
    """CloudDrive2 的载荷形状，含它把布尔渲染成字符串的那一档。"""

    def test_new_and_renamed_files_are_taken_and_deletions_are_not(self):
        paths = push.parse_notification({"device_name": "nas", "data": [
            {"action": "CREATE", "is_dir": "false", "source_file": "/115/a.mp4",
             "destination_file": ""},
            {"action": "rename", "is_dir": False, "source_file": "/115/b.mp4",
             "destination_file": "/115/c.mp4"},
            {"action": "delete", "is_dir": "false", "source_file": "/115/d.mp4"},
            {"action": "create", "is_dir": "true", "source_file": "/115/新目录"},
            {"action": "create", "is_dir": "false", "source_file": "  "},
        ]})
        self.assertEqual(paths, ["/115/a.mp4", "/115/c.mp4"])

    def test_a_payload_without_the_expected_shape_yields_nothing(self):
        for body in ({}, {"data": "x"}, {"data": [1, "a"]}, {"data": [{}]}):
            with self.subTest(body=body):
                self.assertEqual(push.parse_notification(body), [])


class CloudDriveConfigTests(unittest.TestCase):
    """页面给出的那段配置，是 CloudDrive2「配置内容」框要的整段 TOML。"""

    def test_the_block_parses_and_points_at_this_machine(self):
        config = tomllib.loads(push.clouddrive_config("https://192.0.2.10", "s3cret-token"))
        self.assertEqual(config["global_params"]["base_url"], "https://192.0.2.10")
        # 总开关关着的话，下面两节写什么都不会发出来。
        self.assertIs(config["global_params"]["enabled"], True)
        watcher = config["file_system_watcher"]
        self.assertIs(watcher["enabled"], True)
        self.assertEqual(watcher["method"], "POST")
        self.assertEqual(watcher["url"], "{base_url}" + push.WEBHOOK_PATH)
        self.assertEqual(watcher["headers"][push.SECRET_HEADER], "s3cret-token")
        # 挂载点通知一条路径也给不出，收下来只是空转一次队列。
        self.assertIs(config["mount_point_watcher"]["enabled"], False)
        # 两个 watcher 在 CloudDrive2 那边是同一个 5 字段结构，关着的那个也得写全：
        # 只写 `enabled = false` 时整份配置在它的 Webhooks 列表里标「无效」。
        for name in ("file_system_watcher", "mount_point_watcher"):
            self.assertEqual(set(config[name]), {"url", "method", "enabled", "headers", "body"}, name)
        # 默认模板里那行 `authorization = "basic usernamepassword"` 不能留：它是示例值，
        # 发出来只会在 Peach 的访问日志里留一串假凭据。
        self.assertNotIn("authorization", config["global_params"]["default_headers"])

    def test_a_trailing_slash_on_the_origin_does_not_double_up_the_path(self):
        config = tomllib.loads(push.clouddrive_config("https://peach.local/", "t"))
        self.assertEqual(config["global_params"]["base_url"], "https://peach.local")

    def test_the_body_it_declares_is_what_the_parser_reads(self):
        """配置里那段正文，按 CloudDrive2 代入占位符之后要能被本模块解析回路径。

        两处各写一份的话，改了正文模板而没改解析器（或者反过来）是静默的：推送照发，
        Peach 收下来解析出零条路径，看上去就是「推送没生效」。
        """
        body = tomllib.loads(push.clouddrive_config("https://h", "t"))["file_system_watcher"]["body"]
        for placeholder, value in (("{action}", "create"), ("{is_dir}", "false"),
                                   ("{source_file}", "/115/影视/a.mp4"),
                                   ("{destination_file}", "")):
            body = body.replace(placeholder, value)
        self.assertEqual(push.parse_notification(json.loads(body)), ["/115/影视/a.mp4"])

    def test_nothing_is_handed_out_before_there_is_an_address_and_a_secret(self):
        for origin, secret in (("", "t"), ("https://h", ""), ("", ""), ("  ", " ")):
            with self.subTest(origin=origin, secret=secret):
                self.assertEqual(push.clouddrive_config(origin, secret), "")


class ConfigPagePayloadTests(unittest.TestCase):
    """配置页拿到的那份载荷里，CloudDrive2 要推去的地址是怎么定下来的。"""

    @staticmethod
    def _request(*, tls=True, published=None, declared="192.0.2.10", port=443):
        state = SimpleNamespace(
            mdns=None if published is None else SimpleNamespace(address=published),
            settings=SimpleNamespace(tls_enabled=tls, mdns_address=declared, mdns_port=port))
        return SimpleNamespace(app=SimpleNamespace(state=state))

    def _payload(self, request, secret="tok"):
        return routes_configuration.push_discovery_payload(request, {"secret": secret})

    def test_the_address_is_the_one_this_machine_publishes_not_the_caller_origin(self):
        """配置页多半是从回环地址打开的，而 TLS 那条服务只绑局域网地址。

        照着这次请求的 origin 生成，抄进 CloudDrive2 的就是 `127.0.0.1`——同机也连不上，
        因为 443 根本没绑在回环上。
        """
        payload = self._payload(self._request(published="198.51.100.7"))
        self.assertEqual(payload["origin"], "https://198.51.100.7")
        self.assertIn('base_url = "https://198.51.100.7"', payload["config_toml"])

    def test_a_port_other_than_443_stays_in_the_address(self):
        payload = self._payload(self._request(port=8443))
        self.assertEqual(payload["origin"], "https://192.0.2.10:8443")

    def test_http_service_uses_its_published_address_and_listening_port(self):
        for port, origin in ((38473, "http://198.51.100.7:38473"),
                             (80, "http://198.51.100.7"),
                             (443, "http://198.51.100.7:443")):
            with self.subTest(port=port):
                payload = self._payload(self._request(tls=False, published="198.51.100.7", port=port))
                self.assertEqual(payload["origin"], origin)
                config = tomllib.loads(payload["config_toml"])
                self.assertEqual(config["global_params"]["base_url"], origin)
                self.assertEqual(config["file_system_watcher"]["headers"][push.SECRET_HEADER], "tok")

    def test_without_an_address_the_block_is_withheld(self):
        for tls in (True, False):
            with self.subTest(tls=tls):
                payload = self._payload(self._request(tls=tls, declared=""))
                self.assertEqual(payload["origin"], "")
                self.assertEqual(payload["config_toml"], "")

    def test_a_machine_that_never_published_an_address_falls_back_to_the_declared_one(self):
        payload = self._payload(self._request(published=None))
        self.assertEqual(payload["origin"], "https://192.0.2.10")


class IgnoreAndSourceTests(unittest.TestCase):
    def test_half_written_and_bookkeeping_files_never_enter_the_queue(self):
        for name in ("a.mp4.part", "b.mkv.!qb", "c.crdownload", "desktop.ini", ".DS_Store"):
            with self.subTest(name=name):
                self.assertTrue(push.ignored(name))
        self.assertFalse(push.ignored("正片.mp4"))

    def test_system_directories_are_ignored_before_names_are_encoded(self):
        for path in (r'R:\media\@eaDir\video.mp4@SynoEAStream',
                     '/media/@snapshot/nested/video.mp4', r'R:\media\#RECYCLE\video.mp4',
                     'R:\\media\\@eaDir\\broken\udcff.mp4@SynoEAStream',
                     r'R:\media\video.mp4@SynoEAStream',
                     '/vol1/1000/Movies/.@#local/trash/movie.mp4',
                     '/vol1/@team/Movies/.@#local/trash/movie.mp4'):
            with self.subTest(path=ascii(path)):
                self.assertTrue(push.ignored(path))
        self.assertFalse(push.ignored(r'R:\media\scene@home\video.mp4'))

    def test_metadata_patterns_do_not_hide_unrelated_media_names(self):
        from peach.discovery_rules import system_directory
        for name in ('._movie.mp4', '.SYNOPPSDB123', '.wfm_upload123', 'Icon\r'):
            with self.subTest(name=repr(name)):
                self.assertTrue(push.ignored(str(PureWindowsPath(r'R:\media', name))))
        for name in ('@creator', 'normal', '@eaDir-old', '#recycle-old', '.snapshot-old',
                     'Snapshots', 'Recycle Bin', 'Temporary Items', '.Trash-', '.Trash-1000-old',
                     '.Trash-user', '.Trash-١٠٠٠', '.snapshots-old', '.TemporaryItems-old',
                     '.@#local-old', '@appshare', '.DocumentRevisions-V100-old', '.DocumentRevisions-V100-bad-x'):
            with self.subTest(directory=name):
                self.assertFalse(system_directory(name))
                self.assertFalse(push.ignored(str(PureWindowsPath(r'R:\media', name, 'movie.mp4'))))
        for name in ('.hidden.mp4', '@movie.mp4', 'movie_qtmp_scene.mp4', 'Icon.mp4', 'Thumbs.db.mp4'):
            self.assertFalse(push.ignored(str(PureWindowsPath(r'R:\media', name))), name)

    def test_only_loopback_and_private_addresses_are_accepted(self):
        # 局域网那一档用 RFC 5737 的文档网段举例：`ipaddress` 把它判成 private，
        # 正是 `allowed_source` 看的那一位，写谁家的真实网段都不必要（`test_repo_hygiene`）。
        for good in ("127.0.0.1", "::1", "192.0.2.9", "198.51.100.4", "169.254.1.1"):
            with self.subTest(good=good):
                self.assertTrue(push.allowed_source(good))
        for bad in ("8.8.8.8", "1.1.1.1", "2001:4860:4860::8888", "", "not-an-address"):
            with self.subTest(bad=bad):
                self.assertFalse(push.allowed_source(bad))


class QueueTests(unittest.TestCase):
    """去抖与写完判定。时钟由用例给，`tick` 一格一格走完，不真的等几秒。"""

    def setUp(self):
        self.sizes: dict[str, int | None] = {}
        self.ingested: list[str] = []
        self.queue = push.DiscoveryQueue(
            self._ingest, lambda _location, path: self.sizes.get(path),
            debounce=5.0, settle=4.0, timeout=100.0, max_pending=3)

    def _ingest(self, _location, path):
        self.ingested.append(path)
        return True

    def test_a_file_is_registered_only_after_its_size_stops_changing(self):
        self.sizes["p"] = 10
        self.queue.submit("local", "p", 0.0)
        self.queue.tick(4.0)
        self.assertEqual(self.ingested, [], "静置窗口没过，一次探测都不该发")
        self.queue.tick(5.0)
        self.assertEqual(self.ingested, [], "第一次探测只记下大小")
        self.sizes["p"] = 40
        self.queue.tick(9.0)
        self.assertEqual(self.ingested, [], "还在长大，接着等")
        self.queue.tick(13.0)
        self.assertEqual(self.ingested, ["p"])
        self.assertEqual(self.queue.snapshot()["pending"], 0)

    def test_a_repeated_event_restarts_the_quiet_window(self):
        self.sizes["p"] = 10
        self.queue.submit("local", "p", 0.0)
        self.queue.submit("local", "p", 3.0)
        self.queue.tick(5.0)
        self.assertEqual(self.queue.snapshot()["pending"], 1)
        self.queue.tick(8.0)
        self.queue.tick(12.0)
        self.assertEqual(self.ingested, ["p"])
        self.assertEqual(self.queue.snapshot()["submitted"], 2)

    def test_a_file_that_vanished_before_the_window_closed_is_dropped(self):
        self.queue.submit("local", "gone", 0.0)
        self.queue.tick(5.0)
        self.assertEqual(self.ingested, [])
        self.assertEqual(self.queue.snapshot()["missing"], 1)
        self.assertEqual(self.queue.snapshot()["pending"], 0)

    def test_a_probe_that_cannot_answer_keeps_the_file_queued(self):
        """读超时不等于文件没了：过一个静置窗口再测，答上了照常登记。"""
        answers = [TimeoutError("stat timed out"), 10, 10]

        def probe(_location, _path):
            answer = answers.pop(0)
            if isinstance(answer, Exception):
                raise answer
            return answer
        queue = push.DiscoveryQueue(self._ingest, probe, debounce=5.0, settle=4.0, timeout=100.0)
        queue.submit("local", "p", 0.0)
        queue.tick(5.0)
        self.assertEqual((queue.snapshot()["pending"], queue.snapshot()["missing"]), (1, 0))
        queue.tick(9.0)
        queue.tick(13.0)
        self.assertEqual(self.ingested, ["p"])

    def test_an_event_storm_beyond_the_ceiling_is_counted_not_queued(self):
        for index in range(5):
            self.queue.submit("local", f"p{index}", 0.0)
        snapshot = self.queue.snapshot()
        self.assertEqual(snapshot["pending"], 3)
        self.assertEqual(snapshot["dropped"], 2, "溢出的那些交回给全量扫描，不是静默丢弃")

    def test_a_file_that_never_stops_growing_is_handed_back_to_the_full_scan(self):
        self.sizes["p"] = 1
        self.queue.submit("local", "p", 0.0)
        for moment in (5.0, 9.0, 13.0):
            self.sizes["p"] += 1
            self.queue.tick(moment)
        self.queue.tick(200.0)
        self.assertEqual(self.ingested, [])
        self.assertEqual(self.queue.snapshot()["timed_out"], 1)

    def test_one_failing_path_does_not_take_the_queue_down(self):
        def boom(_location, _path):
            raise OSError("database is locked")

        queue = push.DiscoveryQueue(boom, lambda _location, _path: 1,
                                    debounce=0.0, settle=0.0)
        queue.submit("local", "p", 0.0)
        queue.tick(0.0)
        with self.assertLogs("peach.push_discovery", level="ERROR") as captured:
            queue.tick(0.0)
        self.assertIn("database is locked", "\n".join(captured.output))
        self.assertEqual(queue.snapshot()["failed"], 1)
        self.assertIn("database is locked", queue.snapshot()["last_error"])


class JournalTests(unittest.TestCase):
    """收下的待办落盘：进程重启后原样放回队列，从头去抖。"""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.journal = Path(tmp.name) / push.PENDING_FILENAME
        self.sizes: dict[str, int] = {}
        self.ingested: list[tuple] = []

    def queue(self):
        return push.DiscoveryQueue(
            lambda location, path, move_from=None: self.ingested.append((location, path, move_from)) or True,
            lambda _location, path: self.sizes.get(path),
            debounce=5.0, settle=4.0, journal=self.journal)

    def test_pending_paths_survive_a_restart_and_are_registered_by_the_next_process(self):
        first = self.queue()
        first.submit("local", "a.mp4", 0.0)
        first.submit("local", "new.mp4", 0.0, move_from="old.mp4")
        first.flush()

        second = self.queue()
        self.assertEqual(second.restore(1000.0), 2)
        self.assertEqual(second.snapshot()["pending"], 2)
        self.sizes.update({"a.mp4": 1, "new.mp4": 2})
        second.tick(1004.0)
        self.assertEqual(self.ingested, [], "放回来的从头去抖，不沿用上一个进程的时刻")
        second.tick(1005.0)
        second.tick(1009.0)
        self.assertEqual(sorted(self.ingested), [("local", "a.mp4", None), ("local", "new.mp4", "old.mp4")])

    def test_an_emptied_queue_leaves_no_journal_behind(self):
        queue = self.queue()
        queue.submit("local", "a.mp4", 0.0)
        queue.flush()
        self.assertTrue(self.journal.is_file())
        self.sizes["a.mp4"] = 1
        queue.tick(5.0)
        queue.tick(9.0)
        queue.flush()
        self.assertFalse(self.journal.exists())

    def test_a_storm_rewrites_the_journal_at_most_once_per_interval(self):
        queue = self.queue()
        queue.submit("local", "a.mp4", 0.0)
        with mock.patch.object(push, "atomic_write_text", wraps=push.atomic_write_text) as written:
            queue.flush(10.0)
            for index in range(50):
                queue.submit("local", f"p{index}.mp4", 10.0)
            with queue._lock:
                due = queue._flush_due(10.5)
        self.assertEqual(written.call_count, 1)
        self.assertEqual(due, 10.0 + push.JOURNAL_SECONDS)

    def test_an_unreadable_journal_is_skipped_not_fatal(self):
        self.journal.write_text("{坏的", encoding="utf-8")
        with self.assertLogs("peach.push_discovery", level="WARNING"):
            self.assertEqual(self.queue().restore(0.0), 0)


class SecretTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.secret = push.WebhookSecret(Path(self.tmp.name) / "secrets")

    def test_an_absent_or_empty_secret_never_matches(self):
        self.assertFalse(self.secret.matches("anything"))
        value = self.secret.ensure()
        self.assertTrue(value)
        self.assertFalse(self.secret.matches(""))
        self.assertFalse(self.secret.matches(value + "x"))
        self.assertTrue(self.secret.matches(value))

    def test_rotating_invalidates_the_previous_value(self):
        first = self.secret.ensure()
        self.assertEqual(self.secret.ensure(), first, "已有一份就沿用，不每次换新")
        second = self.secret.rotate()
        self.assertNotEqual(first, second)
        self.assertFalse(self.secret.matches(first))
        self.assertTrue(self.secret.matches(second))


class _ServiceCase(unittest.TestCase):
    """两条通道共用的临时部署：一个本地来源、一个网盘来源，各一份真实目录。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.db = fresh_ledger(self.root)
        self.media = self.root / "media"
        self.cloud = self.root / "cloud"
        self.media.mkdir()
        self.cloud.mkdir()
        self.declared, self.mounts = self._shape()

    def _shape(self):
        if os.name == "nt":
            return {"local": (str(self.media),), "115": (str(self.cloud),)}, {}
        return ({"local": (LOCAL_LEDGER_ROOT,), "115": (CLOUD_ROOT,)},
                {"local": (str(self.media),), "115": (str(self.cloud),)})

    def ledger(self, location, *parts) -> str:
        return str(PureWindowsPath(self.declared[location][0]).joinpath(*parts))

    def rows(self) -> dict[str, tuple[str, int]]:
        connection = sqlite3.connect(self.db)
        try:
            return {row[0]: (row[1], row[2]) for row in connection.execute(
                "SELECT path,medium,size FROM asset")}
        finally:
            connection.close()

    def service(self, **overrides):
        made = push.PushDiscoveryService(
            state_root=self.root / "state", secrets_root=self.root / "secrets",
            db_path=self.db, declared_roots=self.declared, mounts=self.mounts,
            debounce=0.05, settle=0.05, **overrides)
        self.addCleanup(made.stop)
        return made


class IngestPathTests(_ServiceCase):
    def test_system_files_never_enter_any_push_registration_path(self):
        service = self.service()
        path = self.ledger('local', '@eaDir', 'broken\udcff.mp4@SynoEAStream')
        with mock.patch.object(service.queue, 'submit') as submit, \
                mock.patch.object(service, '_ingest') as ingest:
            self.assertFalse(service.submit('local', path))
            service.submit_move('local', self.ledger('local', 'old.mp4'), path)
            service.submit_move('local', path, self.ledger('local', '@eaDir'), directory=True)
            self.assertFalse(service.ingest_now('local', path))
        submit.assert_not_called()
        ingest.assert_not_called()

    def test_direct_ingest_does_not_register_system_directory_contents(self):
        file = self.media / '@eaDir/video.mp4@SynoEAStream'
        file.parent.mkdir()
        file.write_bytes(b'metadata')
        result = scan.ingest_path(self.db, 'local', self.ledger('local', '@eaDir', file.name),
                                  declared_roots=self.declared, mounts=self.mounts)
        self.assertTrue(result.sidecar)
        self.assertEqual(self.rows(), {})

    def test_nas_metadata_is_rejected_by_create_move_and_immediate_ingest(self):
        service = self.service()
        for parts in (('@Recently-Snapshot', 'movie.mp4'), ('.AppleDouble', 'movie.mp4'),
                      ('.zfs', 'snapshot', 'movie.mp4'), ('$Recycle.Bin', 'movie.mp4'),
                      ('._movie.mp4',), ('desktop.ini',), ('@eaDir',), ('.Trash-1000',),
                      ('.snapshots',), ('.TemporaryItems',), ('.@#local',),
                      ('.@#local', 'trash', 'movie.mp4')):
            path = self.ledger('local', *parts)
            with self.subTest(parts=parts), mock.patch.object(service.queue, 'submit') as submit, \
                    mock.patch.object(service, '_ingest') as ingest:
                self.assertFalse(service.submit('local', path))
                service.submit_move('local', self.ledger('local', 'old.mp4'), path)
                self.assertFalse(service.ingest_now('local', path))
                submit.assert_not_called()
                ingest.assert_not_called()

    def test_move_event_keeps_upgrade_existing_asset_without_an_identity_cache(self):
        from contextlib import closing
        old = self.media / 'old.mp4'
        old.write_bytes(b'video')
        path = self.ledger('local','old.mp4')
        with closing(sqlite3.connect(self.db)) as connection, connection:
            asset_id = connection.execute("INSERT INTO asset(location,path,name,medium,rating) VALUES(?,?,?,?,?)",
                ('local',path,'old.mp4','video',5)).lastrowid
        old.rename(self.media/'renamed.mp4')
        service = self.service()
        self.assertTrue(service._ingest('local',self.ledger('local','renamed.mp4'),path))
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("SELECT id,name,rating FROM asset WHERE medium='video'").fetchall(),
                             [(asset_id,'renamed.mp4',5)])

    """单条路径走的是扫描那段登记，不是第二套写法。"""

    def test_new_video_queue_accepts_push_arrivals_without_readding_completed_paths(self):
        from peach.library_new_assets import pending, remember
        (self.media / 'new.mp4').write_bytes(b'video')
        (self.media / 'photo.jpg').write_bytes(b'image')
        options = dict(declared_roots=self.declared, mounts=self.mounts)
        with mock.patch('peach.scan.time.strftime', return_value='2026-10-27 12:00:00'):
            first = scan.ingest_path(self.db, 'local', self.ledger('local', 'new.mp4'), **options)
            scan.ingest_path(self.db, 'local', self.ledger('local', 'photo.jpg'), **options)
            self.assertEqual(pending(self.db), [first.asset_id])
            remember(self.db, completed=[first.asset_id])
            again = scan.ingest_path(self.db, 'local', self.ledger('local', 'new.mp4'), **options)
            self.assertFalse(again.new)
            self.assertEqual(pending(self.db), [])
        (self.cloud / 'cloud.mp4').write_bytes(b'cloud video')
        arrival = scan.ingest_path(self.db, '115', self.ledger('115', 'cloud.mp4'), **options)
        self.assertEqual(pending(self.db), [arrival.asset_id])

    def test_a_new_video_from_the_queue_leaves_one_ingest_notice(self):
        """推送队列登记的新影片记一条入库通知；同一路径再来、图片、云下载落地与同番号云下载都不记。"""
        from contextlib import closing

        from peach.ingest_notices import IngestNotices
        notices = IngestNotices()
        service = self.service()
        for name in ("SSIS-057.mp4", "photo.jpg", "landed.mp4", "ABW-123.mp4"):
            (self.media / name).write_bytes(b"0" * 8)
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute(
                "INSERT INTO download_task(provider,source_uri,target,code,state,updated_at)"
                " VALUES('115','magnet:?xt=urn:btih:x','/115/云下载','ABW-123','remote_done','2026-11-05T00:00:00+00:00')")
        with mock.patch("peach.ingest_notices.NOTICES", notices):
            self.assertTrue(service._ingest("local", self.ledger("local", "SSIS-057.mp4")))
            self.assertTrue(service._ingest("local", self.ledger("local", "SSIS-057.mp4")))
            self.assertTrue(service._ingest("local", self.ledger("local", "photo.jpg")))
            self.assertTrue(service.ingest_now("local", self.ledger("local", "landed.mp4")))
            self.assertTrue(service._ingest("local", self.ledger("local", "ABW-123.mp4")))
        items = notices.snapshot()["items"]
        self.assertEqual([(item["kind"], item["label"]) for item in items], [("discovered", "SSIS-057")])

    def test_one_file_lands_as_one_row_with_the_ledger_shape(self):
        (self.media / "创作者").mkdir()
        (self.media / "创作者" / "a.mp4").write_bytes(b"0" * 12)
        result = scan.ingest_path(
            self.db, "local", self.ledger("local", "创作者", "a.mp4"),
            declared_roots=self.declared, mounts=self.mounts)
        self.assertTrue(result.found)
        self.assertEqual(self.rows(), {self.ledger("local", "创作者", "a.mp4"): ("video", 12)})

    def test_registering_the_same_path_twice_refreshes_instead_of_duplicating(self):
        (self.media / "a.mp4").write_bytes(b"0" * 4)
        path = self.ledger("local", "a.mp4")
        kwargs = {"declared_roots": self.declared, "mounts": self.mounts}
        scan.ingest_path(self.db, "local", path, **kwargs)
        (self.media / "a.mp4").write_bytes(b"0" * 9)
        scan.ingest_path(self.db, "local", path, **kwargs)
        self.assertEqual(self.rows(), {path: ("video", 9)})

    def test_a_conflict_in_the_directory_does_not_block_a_different_new_file(self):
        (self.media / 'copy.mp4').write_bytes(b'copy')
        (self.media / 'copy.srt').write_text('subtitle', encoding='utf-8')
        (self.media / 'new.mp4').write_bytes(b'new')
        path = self.ledger('local', 'copy.mp4')
        with closing(sqlite3.connect(self.db)) as connection, connection:
            for value in (path, path.upper()):
                connection.execute("INSERT INTO asset(location,path,name,medium,rating,play_count) "
                                   "VALUES('local',?,'copy.mp4','video',4,7)", (value,))
        result = scan.ingest_path(self.db, 'local', self.ledger('local', 'new.mp4'),
                                  declared_roots=self.declared, mounts=self.mounts)
        self.assertTrue(result.new)
        self.assertEqual(len(self.rows()), 3)
        with self.assertRaises(scan.ScanPathConflict) as caught:
            scan.ingest_path(self.db, 'local', path,
                             declared_roots=self.declared, mounts=self.mounts)
        self.assertEqual(caught.exception.asset_ids, (1, 2))
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(list(connection.execute(
                'SELECT rating,play_count FROM asset WHERE id<=2 ORDER BY id')), [(4, 7), (4, 7)])
            self.assertEqual(connection.execute('SELECT count(*) FROM asset_subtitle').fetchone()[0], 0)

    def test_a_subtitle_next_to_its_video_is_paired_in_the_same_pass(self):
        (self.media / "a.mp4").write_bytes(b"0" * 4)
        (self.media / "a.zh.srt").write_bytes(b"1" * 4)
        kwargs = {"declared_roots": self.declared, "mounts": self.mounts}
        scan.ingest_path(self.db, "local", self.ledger("local", "a.mp4"), **kwargs)
        result = scan.ingest_path(self.db, "local", self.ledger("local", "a.zh.srt"), **kwargs)
        self.assertEqual(result.subtitles, 1)
        connection = sqlite3.connect(self.db)
        try:
            track = connection.execute(
                "SELECT asset_subtitle.language FROM asset_subtitle "
                "JOIN asset ON asset.id=asset_subtitle.asset_id").fetchone()
        finally:
            connection.close()
        self.assertEqual(track[0], "zh")

    def test_a_scraper_sidecar_is_found_but_not_registered(self):
        folder = self.media / "ABC-123"
        (folder / "extrafanart").mkdir(parents=True)
        for name in ("ABC-123.mp4", "ABC-123.nfo", "poster.jpg", "extrafanart/1.jpg", "ABC-123-trailer.mp4"):
            (folder / name).write_bytes(b"0" * 4)
        kwargs = {"declared_roots": self.declared, "mounts": self.mounts}
        for parts in (("ABC-123.nfo",), ("poster.jpg",), ("extrafanart", "1.jpg"), ("ABC-123-trailer.mp4",)):
            result = scan.ingest_path(self.db, "local", self.ledger("local", "ABC-123", *parts),
                                      **kwargs)
            self.assertEqual((result.found, result.sidecar), (True, True), parts)
        self.assertEqual(self.rows(), {})

    def test_extra_suffixes_and_nested_folders_are_found_without_ledger_writes(self):
        relative = ('Film/Interview-interview2.mkv', 'Film/Extras/Trailers/Teaser.mp4',
                    'Film/deleted scenes/Ending.mp4', 'Film/backdrops/Menu.mkv',
                    'Film/theme-music/Score.flac')
        for value in relative:
            target = self.media / value
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b'clip')
        for value in relative:
            result = scan.ingest_path(self.db, 'local', self.ledger('local', *value.split('/')),
                                     declared_roots=self.declared, mounts=self.mounts)
            self.assertEqual((result.found, result.sidecar, result.asset_id), (True, True, None), value)
        self.assertEqual(self.rows(), {})

    def test_a_slow_directory_listing_does_not_hold_the_ledger_write_lock(self):
        """挂载卡在列目录上时，同一账本的另一个写入者照样能在短超时内拿到写锁。"""
        (self.media / "a.mp4").write_bytes(b"0" * 4)
        entered, release = threading.Event(), threading.Event()
        listing = scan._directory_stats

        def slow_listing(directory):
            entered.set()
            release.wait(10)
            return listing(directory)

        outcome = {}

        def ingest():
            outcome["result"] = scan.ingest_path(
                self.db, "local", self.ledger("local", "a.mp4"),
                declared_roots=self.declared, mounts=self.mounts)

        with mock.patch.object(scan, "_directory_stats", side_effect=slow_listing):
            worker = threading.Thread(target=ingest)
            worker.start()
            try:
                self.assertTrue(entered.wait(10))
                other = sqlite3.connect(self.db, timeout=0.5)
                try:
                    other.execute("BEGIN IMMEDIATE")
                    other.execute("COMMIT")
                finally:
                    other.close()
            finally:
                release.set()
                worker.join(10)
        self.assertTrue(outcome["result"].found)
        self.assertEqual(self.rows(), {self.ledger("local", "a.mp4"): ("video", 4)})

    def test_the_ingest_connection_waits_as_long_as_the_shared_ledger_connection(self):
        (self.media / "a.mp4").write_bytes(b"0" * 4)
        seen = []
        reconcile = scan.wants.reconcile

        def spy(connection, ids):
            seen.append(connection.execute("PRAGMA busy_timeout").fetchone()[0])
            return reconcile(connection, ids)

        with mock.patch.object(scan.wants, "reconcile", side_effect=spy):
            scan.ingest_path(self.db, "local", self.ledger("local", "a.mp4"),
                             declared_roots=self.declared, mounts=self.mounts)
        self.assertEqual(seen, [30_000])

    def test_a_path_that_is_already_gone_writes_nothing(self):
        result = scan.ingest_path(
            self.db, "local", self.ledger("local", "没有这个文件.mp4"),
            declared_roots=self.declared, mounts=self.mounts)
        self.assertFalse(result.found)
        self.assertEqual(self.rows(), {})

    def test_a_path_outside_the_declared_root_is_refused_before_the_ledger(self):
        with self.assertRaises(scan.ScanTargetError):
            scan.ingest_path(self.db, "local", self.ledger("115", "a.mp4"),
                             declared_roots=self.declared, mounts=self.mounts)
        self.assertEqual(self.rows(), {})


class IngestNotifiesTests(_ServiceCase):
    def test_a_registered_file_tells_the_service_its_caches_are_stale(self):
        """入库走扫描自己的连接；不通知的话，统计与复核要等缓存过期才看见新文件。"""
        (self.media / "a.mp4").write_bytes(b"0" * 4)
        notified = []
        service = self.service(after_ingest=lambda: notified.append(True))
        self.assertTrue(service._ingest("local", self.ledger("local", "a.mp4")))
        self.assertFalse(service._ingest("local", self.ledger("local", "gone.mp4")))
        self.assertEqual(notified, [True])


class _HangingObserver:
    """`schedule` 卡住的 watchdog 监视器替身：`release` 放行之前一直停在那里。"""
    entered = threading.Event()
    release = threading.Event()
    made: list = []

    def __init__(self):
        self.started = self.stopped = False
        type(self).made.append(self)

    def schedule(self, *_args, **_kwargs):
        type(self).entered.set()
        type(self).release.wait(30)

    def start(self):
        self.started = True

    def stop(self):
        self.stopped = True

    def join(self, timeout=None):
        pass


class HungMountTests(_ServiceCase):
    """来源挂载挂死时，推送发现的启动、保存、队列与登记都不能被它拖住。"""

    def hanging_observer(self):
        _HangingObserver.entered = threading.Event()
        _HangingObserver.release = threading.Event()
        _HangingObserver.made = []
        self.addCleanup(lambda: _HangingObserver.release.set())
        patcher = mock.patch("watchdog.observers.Observer", _HangingObserver)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_probing_a_hung_mount_does_not_hold_the_queue_thread(self):
        (self.media / "a.mp4").write_bytes(b"0" * 4)
        service = self.service()
        with _hung_mount(self.media):
            finished, size = _within(lambda: service._probe("local", self.ledger("local", "a.mp4")))
        self.assertTrue(finished, "队列线程卡在了本进程的 stat 上")
        self.assertEqual(size, 4)

    def test_files_due_together_in_one_directory_are_probed_with_one_listing(self):
        for name, size in (("a.mp4", 1), ("b.mp4", 2), ("c.mp4", 3)):
            (self.media / name).write_bytes(b"0" * size)
        (self.media / "sub").mkdir()
        (self.media / "sub" / "d.mp4").write_bytes(b"0" * 4)
        service = self.service()
        items = [("local", self.ledger("local", name)) for name in ("a.mp4", "b.mp4", "c.mp4", "gone.mp4")]
        items.append(("local", self.ledger("local", "sub", "d.mp4")))
        listings, stats = mock.Mock(wraps=push.media_io.directory_entries), mock.Mock(wraps=push.media_io.file_stat)
        with mock.patch.object(push.media_io, "directory_entries", listings), \
                mock.patch.object(push.media_io, "file_stat", stats), _hung_mount(self.media):
            finished, sizes = _within(lambda: service._probe_many(items))
        self.assertTrue(finished, "批量探测卡在了本进程的读盘上")
        self.assertEqual(sizes, [1, 2, 3, None, 4])
        # 根目录四条列一次；按名字找不到的那条和单独一条的子目录各 stat 一次。
        self.assertEqual((listings.call_count, stats.call_count), (1, 2))
        from peach.os_errors import CodedTimeoutError
        with mock.patch.object(push.media_io, "directory_entries",
                               side_effect=CodedTimeoutError(errno.ETIMEDOUT, "errors.mediaIo.readTimedOut")):
            answers = service._probe_many(items[:2])
        self.assertTrue(all(isinstance(answer, TimeoutError) for answer in answers), answers)

    def test_a_probe_that_times_out_is_not_taken_for_a_missing_file(self):
        from peach.os_errors import CodedTimeoutError
        service = self.service()
        self.assertIsNone(service._probe("local", self.ledger("local", "没有这个文件.mp4")))
        with mock.patch.object(push.media_io, "file_stat",
                               side_effect=CodedTimeoutError(errno.ETIMEDOUT, "errors.mediaIo.readTimedOut")):
            with self.assertRaises(OSError):
                service._probe("local", self.ledger("local", "a.mp4"))

    def test_starting_does_not_wait_for_a_hung_source_root(self):
        service = self.service()
        with _hung_mount(self.media):
            finished, _ = _within(service.start, timeout=5)
            self.assertTrue(finished, "服务启动卡在了来源目录上")
        self.assertTrue(service.wait_local(30))

    def test_a_watch_that_hangs_while_scheduling_holds_neither_start_nor_save(self):
        self.hanging_observer()
        service = self.service()
        finished, _ = _within(service.start, timeout=5)
        self.assertTrue(finished, "服务启动卡在了 observer.schedule 上")
        self.assertTrue(_HangingObserver.entered.wait(15))
        self.assertFalse(service.local_channel.running)
        first = service._opening
        with mock.patch.object(push, "LOCAL_START_WAIT_SECONDS", 0.2):
            finished, state = _within(lambda: service.save({"enabled": True, "watch_local": True}), timeout=5)
        self.assertTrue(finished, "设置页保存卡在了 observer.schedule 上")
        self.assertFalse(state["local_running"])
        _HangingObserver.release.set()
        self.assertTrue(service.wait_local(15))
        first.join(15)
        self.assertTrue(service.local_channel.running)
        # 保存前那一次起到一半被停掉：它起完的那一份要收掉，不能顶替现在的状态。
        stale, current = _HangingObserver.made
        self.assertEqual((stale.stopped, current.started, current.stopped), (True, True, False))

    def test_registering_from_a_hung_mount_does_not_block(self):
        (self.media / "a.mp4").write_bytes(b"0" * 4)
        (self.media / "a.srt").write_text("1\n00:00:01,000 --> 00:00:02,000\nhi\n", encoding="utf-8")
        (self.media / "poster.jpg").write_bytes(b"jpg")
        with _hung_mount(self.media):
            finished, results = _within(lambda: [scan.ingest_path(
                self.db, "local", self.ledger("local", name), declared_roots=self.declared, mounts=self.mounts)
                for name in ("a.mp4", "poster.jpg", "gone.mp4")], timeout=30)
        self.assertTrue(finished, "登记卡在了本进程的 stat 或列目录上")
        video, poster, gone = results
        self.assertEqual((video.found, video.subtitles), (True, 1))
        self.assertEqual((poster.found, poster.sidecar), (True, True))
        self.assertFalse(gone.found)
        self.assertEqual(self.rows()[self.ledger("local", "a.mp4")], ("video", 4))

    def test_identity_and_code_checks_ask_a_hung_mount_through_the_reader(self):
        from peach.file_identity import missing
        from peach.os_errors import CodedTimeoutError
        from peach.record_rehome import _gone
        (self.media / "here.mp4").write_bytes(b"0")
        with _hung_mount(self.media):
            finished, answers = _within(lambda: [
                missing(str(self.media / "gone.mp4")), missing(str(self.media / "here.mp4")),
                _gone(self.media / "gone.mp4"), _gone(self.media / "here.mp4")], timeout=30)
        self.assertTrue(finished, "判文件在不在卡在了本进程的 stat 上")
        self.assertEqual(answers, [True, False, True, False])
        # 没答上不算文件没了：不按「旧路径已消失」改指或接回。
        with mock.patch("peach.media_io.file_stat",
                        side_effect=CodedTimeoutError(errno.ETIMEDOUT, "errors.mediaIo.readTimedOut")):
            self.assertEqual([missing(str(self.media / "gone.mp4")), _gone(self.media / "gone.mp4")],
                             [False, False])


class SettingsTests(_ServiceCase):
    def test_unsaved_settings_enable_only_local_discovery_and_preserve_saved_off(self):
        service = self.service()
        self.assertTrue(service.config.enabled)
        self.assertTrue(service.config.watch_local)
        self.assertFalse(service.config.cloud)
        service.settings.save({'enabled':False,'cloud':False}, self.declared)
        self.assertFalse(self.service().config.enabled)

    def test_a_prefix_pointing_at_an_unknown_root_is_refused_on_save(self):
        service = self.service()
        with self.assertRaisesRegex(ValueError, "不是已声明的媒体根"):
            service.save({"enabled": True, "prefixes": [{"prefix": "/115", "root": "Z:\\"}]})
        self.assertTrue(service.config.enabled)

    def test_the_same_prefix_cannot_be_registered_twice(self):
        service = self.service()
        with self.assertRaisesRegex(ValueError, "不止一次"):
            service.save({"enabled": True, "prefixes": [
                {"prefix": "/115", "root": self.declared["115"][0]},
                {"prefix": "115/", "root": self.declared["115"][0]}]})

    def test_saving_turns_the_channel_on_and_hands_back_a_secret(self):
        service = self.service()
        state = service.save({"enabled": True, "watch_local": False, "cloud": True, "prefixes": [
            {"prefix": "/115", "root": self.declared["115"][0]}]})
        self.assertTrue(state["enabled"])
        self.assertTrue(state["secret"])
        self.assertEqual(state["endpoint"], push.WEBHOOK_PATH)
        stored = json.loads((self.root / "state" / push.SETTINGS_FILENAME).read_text(
            encoding="utf-8"))
        self.assertEqual(stored["prefixes"], [{"prefix": "/115", "root": self.declared["115"][0]}])

    def test_a_service_that_boots_with_the_cloud_channel_on_mints_the_missing_secret(self):
        """设置文件可能是拷来的，或者密钥文件被删过：开机就得补，否则 webhook 永远收不下。"""
        service = self.service()
        service.save({"enabled": True, "watch_local": False, "cloud": True, "prefixes": [
            {"prefix": "/115", "root": self.declared["115"][0]}]})
        service.stop()
        (self.root / "secrets" / push.SECRET_FILENAME).unlink()

        booted = self.service()
        self.assertFalse(booted.snapshot()["secret_set"])
        booted.start()
        self.addCleanup(booted.stop)
        self.assertTrue(booted.snapshot(reveal=True)["secret"])

    def test_the_reader_never_starts_a_channel(self):
        service = self.service(available=False)
        with self.assertRaisesRegex(ValueError, "只在允许修改数据库的设备上可用"):
            service.save({"enabled": True})
        service.start()
        self.assertFalse(service.local_channel.running)


class CloudChannelTests(_ServiceCase):
    def test_a_notified_cloud_path_becomes_a_ledger_row(self):
        service = self.service()
        service.save({"enabled": True, "watch_local": False, "cloud": True, "prefixes": [
            {"prefix": "/115", "root": self.declared["115"][0]}]})
        (self.cloud / "影视").mkdir()
        (self.cloud / "影视" / "a.mp4").write_bytes(b"0" * 6)
        self.assertEqual(service.submit_cloud("/115/影视/a.mp4"),
                         self.ledger("115", "影视", "a.mp4"))
        _wait_for(lambda: self.rows())
        self.assertEqual(self.rows(), {self.ledger("115", "影视", "a.mp4"): ("video", 6)})

    def test_a_cloud_path_outside_the_prefix_table_never_reaches_the_ledger(self):
        service = self.service()
        service.save({"enabled": True, "watch_local": False, "cloud": True, "prefixes": [
            {"prefix": "/115", "root": self.declared["115"][0]}]})
        with self.assertRaises(push.CloudPathError):
            service.submit_cloud("/pikpak/a.mp4")
        self.assertEqual(self.rows(), {})

    def test_a_notification_still_waiting_when_the_service_restarts_is_registered_after_boot(self):
        """通知收下了、还在去抖就重启：下一次启动接着登记，不等全量扫描。"""
        before = push.PushDiscoveryService(
            state_root=self.root / "state", secrets_root=self.root / "secrets",
            db_path=self.db, declared_roots=self.declared, mounts=self.mounts, debounce=3600.0)
        self.addCleanup(before.stop)
        before.save({"enabled": True, "watch_local": False, "cloud": True, "prefixes": [
            {"prefix": "/115", "root": self.declared["115"][0]}]})
        (self.cloud / "a.mp4").write_bytes(b"0" * 6)
        before.submit_cloud("/115/a.mp4")
        before.stop()
        self.assertEqual(self.rows(), {})
        self.assertTrue((self.root / "state" / push.PENDING_FILENAME).is_file())

        after = self.service()
        after.start()
        _wait_for(lambda: self.rows())
        self.assertEqual(self.rows(), {self.ledger("115", "a.mp4"): ("video", 6)})
        _wait_for(lambda: not (self.root / "state" / push.PENDING_FILENAME).exists())
        self.assertFalse((self.root / "state" / push.PENDING_FILENAME).exists())


class LocalChannelTests(_ServiceCase):
    def test_historic_macos_events_do_not_enter_the_queue(self):
        service = mock.Mock()
        with mock.patch.object(push.time, 'time_ns', return_value=100):
            handler = push._LocalEventHandler(service)
        handler.register('local', self.declared['local'][0], self.media)
        event = SimpleNamespace(event_type='created', src_path=str(self.media/'old.mp4'), is_directory=False)
        with mock.patch.object(push, 'sys', SimpleNamespace(platform='darwin')), \
                mock.patch.object(Path, 'stat', return_value=SimpleNamespace(st_ctime_ns=99)):
            handler.dispatch(event)
        service.submit.assert_not_called()
        event.src_path = str(self.media/'new.mp4')
        with mock.patch.object(push, 'sys', SimpleNamespace(platform='darwin')), \
                mock.patch.object(Path, 'stat', return_value=SimpleNamespace(st_ctime_ns=100)):
            handler.dispatch(event)
        service.submit.assert_called_once_with('local', self.ledger('local', 'new.mp4'))
        service.submit.reset_mock()
        event.event_type, event.dest_path = 'moved', str(self.media/'renamed.mp4')
        with mock.patch.object(push, 'sys', SimpleNamespace(platform='darwin')), \
                mock.patch.object(Path, 'stat', return_value=SimpleNamespace(st_ctime_ns=101)):
            handler.dispatch(event)
        service.submit_move.assert_called_once_with('local', self.ledger('local', 'new.mp4'),
                                                   self.ledger('local', 'renamed.mp4'), directory=False)

    def test_default_native_watcher_is_idle_until_new_files_arrive(self):
        (self.media/'existing.mp4').write_bytes(b'old')
        service = self.service()
        probe = mock.Mock(wraps=service.queue.probe_many)
        service.queue.probe_many = probe
        service.start()
        self.assertTrue(service.wait_local(15))
        if not service.local_channel.running:
            self.skipTest(f'本机起不了文件监视：{service.local_channel.message}')
        started, cpu = time.monotonic(), time.process_time()
        time.sleep(0.3)
        elapsed, used = time.monotonic()-started, time.process_time()-cpu
        self.assertEqual(self.rows(),{})
        probe.assert_not_called()
        started = time.monotonic()
        for index in range(20):
            (self.media/f'new-{index}.mp4').write_bytes(b'new')
        _wait_for(lambda: len(self.rows())==20)
        self.assertEqual(len(self.rows()),20)
        self.assertNotIn(self.ledger('local','existing.mp4'),self.rows())
        self.assertEqual(service.snapshot()['queue']['failed'],0)
        print(f'原生发现：空闲 {elapsed:.3f}s / CPU {used:.3f}s / 媒体探测0次；'
              f'20个新增文件登记 {time.monotonic()-started:.3f}s')

    def test_a_file_landing_in_a_watched_root_reaches_the_ledger(self):
        service = self.service()
        service.save({"enabled": True, "watch_local": True, "cloud": False, "prefixes": []})
        self.assertTrue(service.wait_local(15))
        if not service.local_channel.running:
            self.skipTest(f"本机起不了文件监视：{service.local_channel.message}")
        (self.media / "落地.mp4").write_bytes(b"0" * 8)
        path = self.ledger("local", "落地.mp4")
        _wait_for(lambda: path in self.rows() and service.snapshot()["queue"]["ingested"] == 1)
        self.assertEqual(self.rows().get(path), ("video", 8))
        self.assertEqual(service.snapshot()["queue"]["ingested"], 1)

    def test_the_cloud_mounts_are_never_watched(self):
        # 只看选根这一步：监视器起不起得来是另一件事（缺 watchdog 时它报「不可用」），
        # 网盘来源不进本地通道的判据不该跟着那一步一起变红。
        service = self.service()
        roots = [(location, root) for location, root, _ in service._local_roots()]
        self.assertEqual(roots, [("local", self.declared["local"][0])])


class WebhookRouteTests(_ServiceCase):
    """端点的三道门：通道要开着、来源要是局域网、密钥要对上。"""

    def setUp(self):
        super().setUp()
        from peach.api import create_app
        from peach.config import PeachSettings
        self.app = create_app(PeachSettings(
            db_path=self.db, configured=True, token="",
            follow_state_root=self.root / "state", secrets_root=self.root / "secrets"))
        self.addCleanup(self.app.state.http_transport.close)
        self.service = self.service()
        self.app.state.push_discovery = self.service
        self.secret = self.service.save({
            "enabled": True, "watch_local": False, "cloud": True,
            "prefixes": [{"prefix": "/115", "root": self.declared["115"][0]}]})["secret"]
        (self.cloud / "a.mp4").write_bytes(b"0" * 5)

    def post(self, *, secret=None, client=("127.0.0.1", 9000), path="/115/a.mp4"):
        from fastapi.testclient import TestClient
        headers = {} if secret is None else {push.SECRET_HEADER: secret}
        # 不进 `with`：`lifespan` 会把这个进程里的后台通道全起一遍，而这一组用例验的是
        # 端点本身。连接来源由 `client` 给，三道门里的第二道就是按它判的。
        return TestClient(self.app, client=client).post(
            push.WEBHOOK_PATH, headers=headers, json={"data": [
                {"action": "create", "is_dir": "false", "source_file": path,
                 "destination_file": ""}]})

    def test_a_request_with_the_shared_secret_is_accepted(self):
        self.assertEqual(self.post(secret=self.secret).status_code, 204)
        path = self.ledger("115", "a.mp4")
        _wait_for(lambda: path in self.rows())
        self.assertEqual(self.rows().get(path), ("video", 5))

    def test_http_configuration_saves_rotates_and_delivers_a_notification(self):
        from fastapi.testclient import TestClient
        origin = "http://127.0.0.1:38473"
        self.app.state.settings = replace(
            self.app.state.settings, mdns_address="127.0.0.1", mdns_port=38473, tls_enabled=False)
        client = TestClient(self.app, base_url=origin, client=("127.0.0.1", 9000))
        saved = client.post("/api/configuration/push-discovery", json={
            "enabled": True, "watch_local": False, "cloud": True,
            "prefixes": [{"prefix": "/115", "root": self.declared["115"][0]}]})
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["origin"], origin)
        rotated = client.post("/api/configuration/push-discovery/secret")
        self.assertEqual(rotated.status_code, 200, rotated.text)
        payload = rotated.json()
        config = tomllib.loads(payload["config_toml"])
        self.assertEqual(config["global_params"]["base_url"], origin)
        self.assertNotEqual(payload["secret"], saved.json()["secret"])
        self.assertEqual(self.post(secret=saved.json()["secret"]).status_code, 404)
        watcher = config["file_system_watcher"]
        body = watcher["body"]
        for placeholder, value in (("{action}", "create"), ("{is_dir}", "false"),
                                   ("{source_file}", "/115/a.mp4"), ("{destination_file}", "")):
            body = body.replace(placeholder, value)
        response = client.post(watcher["url"].replace("{base_url}", origin),
                               headers=watcher["headers"], json=json.loads(body))
        self.assertEqual(response.status_code, 204)
        path = self.ledger("115", "a.mp4")
        _wait_for(lambda: path in self.rows())
        self.assertEqual(self.rows().get(path), ("video", 5))

    def test_a_wrong_or_missing_secret_is_refused_without_admitting_the_endpoint(self):
        for supplied in (None, "", self.secret + "x"):
            with self.subTest(supplied=supplied):
                self.assertEqual(self.post(secret=supplied).status_code, 404)
        self.assertEqual(self.rows(), {})

    def test_a_request_from_outside_the_local_network_is_refused(self):
        self.assertEqual(self.post(secret=self.secret, client=("8.8.8.8", 40000)).status_code,
                         404)
        self.assertEqual(self.rows(), {})

    def test_the_endpoint_disappears_when_the_channel_is_off(self):
        self.service.save({"enabled": False})
        self.assertEqual(self.post(secret=self.secret).status_code, 404)
        self.assertEqual(self.rows(), {})

    def test_an_unmapped_cloud_path_is_taken_but_never_written(self):
        self.assertEqual(self.post(secret=self.secret, path="/pikpak/a.mp4").status_code, 204)
        self.assertEqual(self.rows(), {})
