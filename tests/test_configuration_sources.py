"""CloudDrive 表单、来源映射与离线状态的隔离回归。"""
from dataclasses import replace
from contextlib import ExitStack
import ntpath
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
from types import SimpleNamespace
import tempfile
import threading
import unittest
from unittest.mock import patch

from peach import interface_text, media_configuration as media_config, onboarding, settings_file


class ConfigurationIsolationTests(unittest.TestCase):
    def test_phone_access_addresses_use_runtime_protocol_scope_and_ipv6(self):
        from peach.routes_configuration import network_payload
        runtime = SimpleNamespace(host='0.0.0.0', port=8900, tls_enabled=True,
                                  mdns_enabled=True, mdns_port=443, mdns_name='peach-writer', mdns_address='192.0.2.8')
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=runtime)),
                                  base_url='https://peach-writer.local/')
        with patch('peach.distribution.standalone', return_value=False):
            result = network_payload(request, self.config)
            self.assertEqual(result['lan_url'], 'https://peach-writer.local/')
            self.assertEqual(result['ip_url'], '')
            self.assertEqual(result['scope'], 'lan')
            self.assertFalse(result['editable'])
            runtime.tls_enabled, runtime.mdns_enabled, runtime.mdns_address = False, False, 'fd00::8'
            self.assertEqual(network_payload(request, self.config)['ip_url'], 'http://[fd00::8]:8900/')
            runtime.host = '127.0.0.1'
            local = network_payload(request, self.config)
            self.assertEqual((local['scope'], local['lan_url'], local['ip_url']), ('local', '', ''))

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.config = settings_file.PeachConfig(self.root, self.root / "config.toml", present=True)
        self.config.path.write_text("[server]\nport = 8900\n", encoding="utf-8")

    def test_optional_configuration_readers_fail_independently_with_diagnostic_ids(self):
        from peach import routes_configuration as routes, remote_reporting, library_sharing

        readers = (
            ("remote_reporting", remote_reporting, "snapshot", {}),
            ("library_sharing", library_sharing, "snapshot", {}),
            ("startup", routes.desktop_startup, "snapshot", {}),
            ("uninstall", routes.desktop_uninstall, "snapshot", {}),
            ("storage", routes.data_storage, "snapshot", {}),
            ("peach_proxy", routes.peach_proxy, "describe", {}),
            ("entry_links", routes.entry_links, "snapshot", {}),
            ("updates", routes.release_updates, "snapshot", {}),
            ("update_job", routes.standalone_update, "public", {}),
            ("access", routes.access, "load", {}),
            ("media_sources", routes.media_configuration, "rows", []),
            ("library_count", routes.media_libraries, "libraries", []),
            ("mount_dependencies", routes.media_configuration, "mount_dependencies", []),
            ("facts", routes, "runtime_fact_entries", []),
        )
        for failed, *_ in readers:
            with self.subTest(failed=failed), ExitStack() as stack:
                for key, module, name, value in readers:
                    stack.enter_context(patch.object(module, name, side_effect=RuntimeError("private-detail"))
                                        if key == failed else patch.object(module, name, return_value=value))
                stack.enter_context(patch.object(routes.access, "public", return_value={}))
                emit = stack.enter_context(patch.object(routes.error_reporting, "event"))
                result = routes.snapshot(self.config)
                self.assertEqual(list(result["section_errors"]), [failed])
                issue = result["section_errors"][failed]
                self.assertEqual(len(issue["error_id"]), 32)
                self.assertTrue(issue["title"].endswith("未取得"))
                self.assertEqual(issue["title"], interface_text.text(f"server:{issue['title_code']}", issue["title_params"]))
                self.assertEqual(issue["title_params"]["section"], interface_text.text(f"server:{issue['section_code']}"))
                self.assertEqual(issue["message"], interface_text.text(f"server:{issue['message_code']}"))
                self.assertNotIn("private-detail", str(result))
                self.assertEqual(result["media_dirs"], [])
                self.assertEqual(result["port"], 8900)
                self.assertEqual(emit.call_args.kwargs["section"], failed)

    def test_runtime_configuration_sections_do_not_hide_the_healthy_sections(self):
        from unittest.mock import Mock
        from peach import routes_configuration as routes

        for failed in ("tunnel", "automatic_updates", "push_discovery", "downloads"):
            with self.subTest(failed=failed), ExitStack() as stack:
                state = SimpleNamespace(sync=None, tunnel=Mock(), automatic_updates=Mock(),
                                        downloads=object(), push_discovery=SimpleNamespace(declared_roots={}))
                state.tunnel.snapshot.return_value = object()
                state.automatic_updates.snapshot.return_value = {"state": "idle"}
                if failed in ("tunnel", "automatic_updates"):
                    getattr(state, failed).snapshot.side_effect = OSError("private-detail")
                request = SimpleNamespace(app=SimpleNamespace(state=state))
                stack.enter_context(patch.object(routes, "local_only"))
                stack.enter_context(patch.object(routes.settings_file, "load_config", return_value=self.config))
                stack.enter_context(patch.object(routes, "snapshot", return_value={"media_dirs": [], "port": 8900}))
                stack.enter_context(patch.object(routes, "network_payload", return_value={"scope": "local"}))
                stack.enter_context(patch.object(routes, "tunnel_payload", return_value={"state": "idle"}))
                stack.enter_context(patch.object(routes, "api_token_payload", return_value={"rotatable": False}))
                stack.enter_context(patch.object(routes, "certificate_payload", return_value=None))
                for key, module, name in (("push_discovery", routes, "push_discovery_payload"),
                                          ("downloads", routes.web_downloads, "settings_payload")):
                    stack.enter_context(patch.object(module, name, side_effect=OSError("private-detail"))
                                        if key == failed else patch.object(module, name, return_value={"ok": True}))
                stack.enter_context(patch.object(routes.error_reporting, "event"))
                result = routes.read_configuration(request)
                self.assertEqual(list(result["section_errors"]), [failed])
                self.assertEqual(result["port"], 8900)
                for key in {"tunnel", "automatic_updates", "push_discovery", "downloads"} - {failed}:
                    self.assertIn(key, result)

    def test_generated_push_discovery_origins_support_ipv6_and_actual_ports(self):
        from peach import routes_configuration as routes

        for address, port, tls, expected in (("::1", 443, True, "https://[::1]"),
                                             ("::1", 8443, True, "https://[::1]:8443"),
                                             ("192.0.2.1", 8900, False, "http://192.0.2.1:8900")):
            with self.subTest(address=address, port=port):
                state = SimpleNamespace(mdns=SimpleNamespace(address=address), settings=SimpleNamespace(
                    mdns_address=None, mdns_port=port, tls_enabled=tls))
                result = routes.push_discovery_payload(SimpleNamespace(app=SimpleNamespace(state=state)), {})
                self.assertEqual(result["origin"], expected)


class MediaConfigurationTests(unittest.TestCase):
    def test_posix_paths_without_internal_prefixes_can_be_saved(self):
        sources = [{"location": "local", "path": "/media/local"},
                   {"location": "115", "path": "/media/115"},
                   {"location": "115", "path": "/media/115-more"}]
        roots, mounts, errors = media_config.validate(sources, windows=False)
        self.assertEqual(errors, [])
        self.assertEqual(mounts, {"local": ("/media/local",), "115": ("/media/115", "/media/115-more")})
        declared = [PureWindowsPath(root) for group in roots.values() for root in group]
        self.assertTrue(all(path.is_absolute() for path in declared))
        for index, first in enumerate(declared):
            for second in declared[index + 1:]:
                self.assertFalse(first.is_relative_to(second) or second.is_relative_to(first))
        self.assertTrue(all("root" not in row for row in sources), "解析不应修改调用方的表单")

    def test_existing_paths_keep_prefixes_and_names_when_rows_are_reordered(self):
        config = replace(settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml')),
                         present=True, locations={"local": (r"D:\Videos",), "115": ("B:/",)},
                         mounts={"local": ("/media/local",), "115": ("/media/115",)},
                         library_names={r"D:\Videos": "收藏"})
        sources = [{"location": "115", "path": "/media/115"}, {"location": "local", "path": "/media/local"}]
        prepared = media_config.prepare_sources(sources, windows=False, config=config)
        roots, mounts, errors = media_config.validate(sources, windows=False, config=config)
        self.assertEqual(errors, [])
        self.assertEqual(roots, {"115": ("B:\\",), "local": (r"D:\Videos",)})
        self.assertEqual(mounts, {"115": ("/media/115",), "local": ("/media/local",)})
        self.assertEqual(prepared[1]["library"], "收藏")

    def test_readding_an_automatic_path_keeps_its_identity_and_other_paths_differ(self):
        first = [{"location": "local", "path": "/media/movies"}]
        root = media_config.validate(first, windows=False)[0]["local"][0]
        empty = replace(settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml')),
                        present=True, locations={}, mounts={})
        restored, _, errors = media_config.validate(first, windows=False, config=empty)
        self.assertEqual(errors, [])
        self.assertEqual(restored["local"], (root,))
        different, _, errors = media_config.validate(
            [{"location": "local", "path": "/media/other"}], windows=False, config=empty)
        self.assertEqual(errors, [])
        self.assertNotEqual(different["local"], (root,))

    def test_explicit_paths_are_reserved_before_automatic_paths(self):
        first = {"location": "local", "path": "/media/movies"}
        automatic = media_config.validate([first], windows=False)[0]["local"][0]
        roots, _, errors = media_config.validate(
            [first, {"location": "115", "path": "/media/115", "root": automatic}], windows=False)
        self.assertEqual(errors, [])
        self.assertEqual(roots["115"], (automatic,))
        self.assertNotEqual(roots["local"], (automatic,))

    def test_fully_occupied_drive_prefixes_return_a_row_error(self):
        config = replace(settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml')),
                         present=True, locations={"local": tuple(f"{chr(code)}:/" for code in range(65, 91))})
        roots, _, errors = media_config.validate(
            [{"location": "local", "path": "/media/movies"}], windows=False, config=config)
        self.assertEqual(roots, {})
        self.assertIn("无法自动配置", str(errors[0]))

    def test_configuration_uses_the_automatic_prefix_for_library_name_and_cost(self):
        from peach import routes_configuration
        config = settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml'))
        for path, name in (("/media/movies", "movies"), ("/media", "media"),
                           ("/vol02/nas-user/video/影视", "影视")):
            with self.subTest(path=path):
                body = {"media_sources": [{"location": "local", "path": path, "cost": "free"}]}
                with patch.object(routes_configuration, "os", SimpleNamespace(name="posix")):
                    errors, prepared = routes_configuration._validate(body, config)
                self.assertEqual(errors, {})
                root = prepared["locations"]["local"][0]
                self.assertTrue(PureWindowsPath(root).is_absolute())
                self.assertEqual(prepared["mounts"], {"local": (path,)})
                self.assertEqual(prepared["library_names"], {root: name})
                self.assertEqual(prepared["media_costs"][root], "free")

    def test_existing_prefix_is_kept_when_its_actual_directory_moves(self):
        config = replace(settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml')),
                         present=True, locations={"local": (r"D:\Videos",)}, mounts={"local": ("/old",)})
        roots, mounts, errors = media_config.validate(
            [{"location": "local", "path": "/new", "root": r"D:\Videos"}], windows=False, config=config)
        self.assertEqual(errors, [])
        self.assertEqual(roots, {"local": (r"D:\Videos",)})
        self.assertEqual(mounts, {"local": ("/new",)})

    def test_path_only_configuration_save_keeps_existing_prefixes_when_reordered(self):
        from starlette.requests import Request
        from peach import routes_configuration
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            config = replace(settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)}), present=True,
                             locations={"local": (r"D:\Movies", r"E:\Films"), "115": ("B:/",)},
                             mounts={"local": ("/media/movies", "/media/films"), "115": ("/media/115",)})
            settings_file.write(config)
            request = Request({"type": "http", "scheme": "http", "server": ("127.0.0.1", 8900),
                               "client": ("127.0.0.1", 1234), "path": "/api/configuration", "headers": [],
                               "app": SimpleNamespace(state=SimpleNamespace(settings=SimpleNamespace(mdns_name="peach")))})
            validated = {"media_dirs": [PurePosixPath("/media/films"), PurePosixPath("/media/movies")], "port": 8900}
            with patch.object(routes_configuration, "managed_configuration", return_value=True), \
                    patch.object(settings_file, "load_config", return_value=config), \
                    patch.object(routes_configuration, "_validate", return_value=({}, validated)), \
                    patch.object(routes_configuration, "os", SimpleNamespace(name="posix", replace=os.replace, environ=os.environ)):
                receipt = routes_configuration.save_configuration(request, {"revision": routes_configuration.revision(config)})
            loaded = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)})
        self.assertTrue(receipt["saved"])
        self.assertEqual(loaded.locations["local"], (r"E:\Films", r"D:\Movies"))
        self.assertEqual(loaded.mounts["local"], ("/media/films", "/media/movies"))
        self.assertEqual(loaded.mounts["115"], ("/media/115",))

    def test_setup_can_save_a_cloud_folder_without_an_internal_path(self):
        from peach.routes_pages import _read_answers
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)})
            submitted = {"data_root": str(base), "media_dir": ["/media/115"],
                         "media_location": ["115"], "host": "1"}
            answers, errors = _read_answers(config, submitted, windows=False)
            self.assertEqual(errors, {})
            prepared = onboarding.configure(config, answers, windows=False)
            settings_file.write(prepared)
            loaded = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)})
        root = loaded.locations["115"][0]
        self.assertTrue(PureWindowsPath(root).is_absolute())
        self.assertEqual(loaded.mounts, {"115": ("/media/115",)})
        self.assertEqual(loaded.library_names[root], "115")
        self.assertFalse(loaded.replication.enabled)

    def test_setup_local_source_accepts_a_mapped_nas_drive(self):
        from peach.routes_pages import _read_answers

        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)})
            mapped = r"Z:\CloudDrive2\115open\云下载"
            submitted = {"data_root": str(base), "media_dir": [mapped],
                         "media_location": ["local"], "host": "1"}
            windows_abspath = ntpath.abspath
            with patch.object(Path, "is_dir", return_value=True), \
                    patch.object(Path, "resolve", return_value=Path(r"\\NAS\媒体库")), \
                    patch("peach.onboarding.os.path.abspath", side_effect=windows_abspath):
                answers, errors = _read_answers(config, submitted, windows=True)
            self.assertEqual(errors, {})
            prepared = onboarding.configure(config, answers, windows=True)
            self.assertEqual(prepared.locations, {"local": (mapped,)})
            self.assertEqual(prepared.mounts, {})

    def test_runtime_facts_name_the_operating_system_and_settings_file(self):
        from peach import web_entry
        with tempfile.TemporaryDirectory() as directory:
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(Path(directory).resolve())})
            facts = dict(web_entry.runtime_facts(config))
            self.assertIn('操作系统', facts)
            self.assertIn('设置文件', facts)

    def test_runtime_fact_entries_list_dependencies_only_when_missing(self):
        from peach import web_entry
        from peach.ffmpeg import BinaryChoice
        with tempfile.TemporaryDirectory() as directory:
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(Path(directory).resolve())})

            def facts(choice, untrunc, *, installable):
                with patch("peach.ffmpeg.FFmpegResolver.ffmpeg", return_value=choice), \
                        patch("peach.ffmpeg.FFmpegResolver.ffprobe", return_value=choice), \
                        patch("peach.mp4recover.untrunc_path", return_value=untrunc), \
                        patch("peach.media_tools.supported", return_value=installable):
                    return {row["term"]: row for row in web_entry.runtime_fact_entries(config)}

            present = facts(BinaryChoice(Path("ffmpeg"), "path"), Path("untrunc"), installable=True)
            missing = facts(None, None, installable=False)
            installable = facts(None, None, installable=True)
            tools = config.directory("tools")
            (tools / "ffmpeg").mkdir(parents=True)
            (tools / "ffmpeg" / "manifest.json").write_text('{"version": "9.0.2"}', encoding="utf-8")
            managed = facts(BinaryChoice(tools / "ffmpeg" / "bin" / "ffmpeg.exe", "peach-managed"),
                            (tools / "untrunc" / "untrunc.exe").resolve(), installable=True)
        self.assertNotIn("FFmpeg", present)
        self.assertNotIn("untrunc", present)
        self.assertIn("版本", present)
        self.assertEqual(missing["FFmpeg"]["download_label"], "下载 FFmpeg")
        self.assertEqual(missing["untrunc"]["download_label"], "下载 untrunc")
        self.assertEqual(missing["FFmpeg"]["value"], "未找到 FFmpeg、ffprobe；转码、媒体信息与缩略图需要 FFmpeg 工具包。")
        self.assertEqual(missing["untrunc"]["value"],
                         f"未安装；缺索引的 MP4 需要它才修得了。解压到 {tools / 'untrunc'}。")
        # 项名、取值与链接文字都带 code，英文界面拿到英文。
        english = {key: interface_text.text(f"server:{missing['FFmpeg'][f'{key}_code']}",
                                            missing["FFmpeg"][f"{key}_params"], "en")
                   for key in ("value", "download_label")}
        self.assertEqual(english, {
            "value": "FFmpeg and ffprobe not found. Transcoding, media info and thumbnails need the FFmpeg tools.",
            "download_label": "Download FFmpeg"})
        self.assertEqual(interface_text.text(f"server:{present['版本']['term_code']}", None, "en"), "Version")
        self.assertEqual({term: (row.get("install_tool"), "download_url" in row) for term, row in installable.items()
                          if term in ("FFmpeg", "untrunc")},
                         {"FFmpeg": ("ffmpeg", False), "untrunc": ("untrunc", False)})
        self.assertEqual(managed["FFmpeg"]["value"], "已安装，版本 9.0.2")
        self.assertEqual(managed["untrunc"]["value"], "已安装在数据目录")

    def test_windows_cloud_sources_keep_policy_ids_and_offline_roots(self):
        roots, mounts, errors = media_config.validate([
            {"location": "115", "path": "B:/"}, {"location": "pikpak", "path": "A:/"},
        ], windows=True)
        self.assertFalse(errors)
        self.assertEqual(roots, {"115": ("B:\\",), "pikpak": ("A:\\",)})
        self.assertEqual(mounts, {})

    def test_macos_multiple_mounts_preserve_declared_root_order(self):
        roots, mounts, errors = media_config.validate([
            {"location": "115", "root": "B:/Movies", "path": "/Volumes/115/Movies"},
            {"location": "115", "root": "B:/Photos", "path": "/Volumes/115/Photos"},
        ], windows=False)
        self.assertFalse(errors)
        self.assertEqual(roots["115"], ("B:\\Movies", "B:\\Photos"))
        self.assertEqual(mounts["115"], ("/Volumes/115/Movies", "/Volumes/115/Photos"))

    def test_windows_network_shares_require_a_mapped_drive(self):
        roots, mounts, errors = media_config.validate([
            {"location": "115", "path": r"\\nas\media\115"},
        ], windows=True)
        self.assertEqual(roots, {})
        self.assertEqual(mounts, {})
        self.assertIn("映射为 Windows 盘符", str(errors[0]))
        self.assertTrue(errors[0].code.startswith("errors.mediaConfiguration."))
        with patch.object(media_config, "mount_dependencies", return_value=[]):
            roots, mounts, errors = media_config.validate([
                {"location": "115", "path": r"Z:\视频"},
            ], windows=True)
        self.assertFalse(errors)
        self.assertEqual(roots, {"115": ("Z:\\视频",)})
        self.assertEqual(mounts, {})

    def test_invalid_and_overlapping_roots_return_row_errors(self):
        for rows in ([{"location": "bad", "path": "B:/"}],
                     [{"location": [], "path": "B:/"}],
                     [{"location": "115", "path": "B:/bad\u0000file"}],
                     [{"location": "115", "path": "../115"}],
                     [{"location": "115", "path": "B:/"}, {"location": "local", "path": "b:/Movies"}]):
            self.assertTrue(media_config.validate(rows, windows=True)[2])

    def test_cloud_only_setup_roundtrips_config_without_local_source(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)})
            answers = onboarding.Answers(base, (), "127.0.0.1", 8900, "peach", [
                {"location": "115", "path": "/Volumes/115", "root": "B:/"}])
            prepared = onboarding.configure(config, answers, windows=False)
            settings_file.write(prepared)
            loaded = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)})
            self.assertEqual(loaded.locations, {"115": ("B:\\",)})
            self.assertEqual(loaded.mounts, {"115": ("/Volumes/115",)})
            self.assertFalse((base / "database" / "ledger.db").exists())

    def test_unreadable_existing_mount_is_offline(self):
        config = replace(settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml')), locations={"115": ("B:/",)}, mounts={"115": ("/Volumes/115",)})
        with patch("peach.platform.os.scandir", side_effect=OSError("Device not configured")):
            self.assertFalse(media_config.rows(config, windows=False, probe=True)[0]["online"])

    def test_settings_read_mount_state_from_the_reachability_snapshot_without_listing_the_mount(self):
        """所有设置页都等配置接口；网盘卡住时它不能跟着卡在列目录上。"""
        from peach.mount_reachability import MountReachability, MountRoot
        config = replace(settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml')),
                         locations={"115": ("B:/",)}, mounts={"115": ("/Volumes/115",)})
        monitor = MountReachability([MountRoot("115", "115", "B:/", Path("/Volumes/115"))],
                                    probe=lambda path: "ok")
        monitor.tick()
        for _ in range(200):
            monitor.tick()
            if monitor.sources()[0]["online"] is not None:
                break
            threading.Event().wait(0.01)
        with patch("peach.platform.os.scandir", side_effect=AssertionError("配置接口不该列举网盘根")):
            row = media_config.rows(config, windows=False, probe=True,
                                    known=media_config.reachability_states(monitor))[0]
        self.assertTrue(row["online"])

    def test_reachability_sleeps_until_the_next_due_or_timeout_point(self):
        """不再每半秒醒一次：在途探测等超时点，探完排到下一个到期点。"""
        from peach import mount_reachability as reachability
        now = [100.0]
        release = threading.Event()
        monitor = reachability.MountReachability(
            [reachability.MountRoot("115", "115", "B:/", Path("/Volumes/115"))],
            probe=lambda path: release.wait(5) and "ok", clock=lambda: now[0], timeout=5.0)
        self.addCleanup(release.set)
        self.assertEqual(monitor.tick(), 5.0)
        now[0] = 103.0
        self.assertEqual(monitor.tick(), 2.0)
        now[0] = 105.0
        self.assertIsNone(monitor.tick(), "已超时的探测只等完成回调")
        self.assertEqual(monitor.sources()[0]["state"], "timeout")
        release.set()
        for _ in range(200):
            if monitor._states[Path("/Volumes/115")].pending.done():
                break
            threading.Event().wait(0.01)
        now[0] = 106.0
        self.assertEqual(monitor.tick(), reachability.HEALTHY_INTERVAL)
        self.assertEqual(monitor.sources()[0]["state"], "ok")
        now[0] = 106.0 + reachability.HEALTHY_INTERVAL - 1
        self.assertEqual(monitor.tick(), 1.0)
        now[0] = 106.0 + reachability.HEALTHY_INTERVAL
        self.assertEqual(monitor.tick(), 5.0, "到期就起新的探测")

    def test_reachability_loop_wakes_when_a_probe_finishes(self):
        from peach.mount_reachability import MountReachability, MountRoot
        release, calls = threading.Event(), []

        def probe(path):
            calls.append(path)
            release.wait(5)
            return "ok"
        # 冻结的时钟让超时点永远不到；状态能变成在线，只能是完成回调叫醒了调度线程。
        monitor = MountReachability([MountRoot("115", "115", "B:/", Path("/Volumes/115"))],
                                    probe=probe, clock=lambda: 0.0, timeout=30.0)
        monitor.start()
        self.addCleanup(monitor.stop)
        self.addCleanup(release.set)
        for _ in range(200):
            if calls:
                break
            threading.Event().wait(0.01)
        release.set()
        for _ in range(200):
            if monitor.sources()[0]["online"]:
                break
            threading.Event().wait(0.01)
        self.assertTrue(monitor.sources()[0]["online"])
        self.assertEqual(len(calls), 1)

    def test_a_root_the_snapshot_is_still_checking_is_probed_on_the_spot(self):
        """服务刚启动、快照还没探完时，不能把在线的根报成未检测。"""
        from peach.mount_reachability import MountReachability, MountRoot
        config = replace(settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml')),
                         locations={"115": ("B:/",)}, mounts={"115": ("/Volumes/115",)})
        monitor = MountReachability([MountRoot("115", "115", "B:/", Path("/Volumes/115"))])
        self.assertIsNone(monitor.sources()[0]["online"])
        with patch("peach.platform.root_status", return_value="ok"):
            row = media_config.rows(config, windows=False, probe=True,
                                    known=media_config.reachability_states(monitor))[0]
        self.assertTrue(row["online"])

    def test_a_root_missing_from_the_snapshot_is_probed_with_a_deadline(self):
        """刚保存、服务还没重载的目录不在快照里：现场探测，网盘不回话时按时报未检测。"""
        config = replace(settings_file.PeachConfig(Path('/unused'), Path('/unused/config.toml')),
                         locations={"115": ("B:/",)}, mounts={"115": ("/Volumes/115",)})
        release = threading.Event()
        calls = []

        def hung(path):
            calls.append(path)
            release.wait(5)
            return "ok"
        try:
            with patch("peach.platform.root_status", hung), \
                    patch("peach.mount_reachability.PROBE_TIMEOUT", 0.05):
                self.assertIsNone(media_config.rows(config, windows=False, probe=True, known={})[0]["online"])
                self.assertIsNone(media_config.rows(config, windows=False, probe=True, known={})[0]["online"])
            self.assertEqual(len(calls), 1, "上一次探测还没返回时不另起线程")
        finally:
            release.set()

    def test_setup_answers_keep_the_cloud_source_and_its_windows_root(self):
        from peach.routes_pages import _read_answers
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)})
            submitted = {"data_root": str(base), "media_dir": ["/Volumes/115"],
                         "media_location": ["115"], "media_root": ["B:/"], "host": "1"}
            answers, errors = _read_answers(config, submitted, windows=False)
            self.assertFalse(errors)
            self.assertEqual(answers.media_sources[0]["location"], "115")
            self.assertEqual(answers.media_sources[0]["root"], "B:/")

    def test_setup_local_source_reports_native_directory_error_first(self):
        from peach.routes_pages import _setup_media_source_errors
        from peach.user_messages import UserValueError

        def missing_directory(_path):
            raise UserValueError("errors.onboarding.mediaDirMissing", {"path": "/missing"})

        errors = _setup_media_source_errors(
            ["/missing"], ["local"],
            ["Windows 中的对应路径必须包含盘符，例如 B:\\"], missing_directory,
        )
        self.assertEqual([str(error) for error in errors], ["目录不存在，或者不是目录：/missing。先建好再填。"])

    def test_completion_facts_and_entry_leave_out_mounts_and_internals(self):
        from peach.routes_pages import _setup_destination
        from peach.web_entry import runtime_fact_entries
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            config = replace(settings_file.load_config(environ={"PEACH_DATA_ROOT": str(base)}),
                             locations={"115": ("B:/",)}, mounts={"115": ("/Volumes/115",)})
            shown = " ".join(row["value"] for row in runtime_fact_entries(config))
            for internal in ('/Volumes/115', 'peach scan configured', '本机 CA', '已应用 0 个迁移'):
                self.assertNotIn(internal, shown)
            with patch('peach.distribution.standalone', return_value=False):
                self.assertEqual(_setup_destination(config, history_guide=False),
                                 f'http://127.0.0.1:{config.server.port}/?onboarding=1')
            with patch('peach.distribution.standalone', return_value=True):
                self.assertEqual(_setup_destination(config, history_guide=True),
                                 f'http://127.0.0.1:{config.server.port}/taste?onboarding=1')
