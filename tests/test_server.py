"""无桌面入口的进程退出与现有数据保护。"""
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from peach import server, settings_file
from starlette.requests import Request


class ServerTests(unittest.TestCase):
    def test_reader_initialization_does_not_launch_a_ledger_migration(self):
        with tempfile.TemporaryDirectory() as directory:
            config = settings_file.load_config(environ={'PEACH_DATA_ROOT': str(Path(directory).resolve())})
            settings_file.write(config)
            config.directory('database').mkdir()
            database = config.directory('database') / 'ledger.db'
            database.write_bytes(b'unchanged reader ledger')
            config = settings_file.load_config(environ={'PEACH_DATA_ROOT': str(config.data_root)})
            with patch.object(server.settings_file, 'load_config', return_value=config), patch(
                    'peach.runtime_prepare.configured_ledger_writer', return_value=(False, '读取端')), \
                    patch.object(server, 'launch') as launch:
                server.initialize()
            launch.assert_not_called()
            self.assertEqual(database.read_bytes(), b'unchanged reader ledger')

    def test_headless_configuration_accepts_private_peers_and_rejects_forwarding(self):
        from peach.routes_configuration import local_client, managed_configuration
        with patch.dict("os.environ", {"PEACH_HEADLESS_MANAGED": "1"}):
            self.assertTrue(managed_configuration())
            for peer, headers, allowed in (
                ("192.0.2.1", [], True), ("198.51.100.10", [], True),
                ("8.8.8.8", [], False), ("169.254.1.1", [], False),
                ("0.0.0.0", [], False), ("240.0.0.1", [], False),
                ("127.0.0.1", [], True), ("fd00::1", [], True),
                ("192.0.2.1", [(b"x-forwarded-for", b"8.8.8.8")], False),
                ("192.0.2.1", [(b"x-forwarded-host", b"example.com")], False),
            ):
                request = Request({"type": "http", "client": (peer, 1234),
                                   "server": ("0.0.0.0", 8900), "headers": headers,
                                   "app": SimpleNamespace(state=SimpleNamespace(tunnel=None))})
                with self.subTest(peer=peer, headers=headers):
                    self.assertEqual(local_client(request), allowed)

    def test_cli_without_mdns_or_tunnel_needs_no_network_route(self):
        from peach import cli
        with patch.object(cli, "_require_readable_settings"), \
                patch.object(cli, "_serve_token", return_value="test"), \
                patch.object(cli, "_build_sync", return_value=None), \
                patch.object(cli, "create_app"), patch.object(cli, "TUNNEL_ENABLED", False), \
                patch("peach.mdns.lan_ipv4", side_effect=OSError("no route")) as route, \
                patch("peach.listening.bind", return_value=(MagicMock(), True)), \
                patch("peach.listening.serve"):
            self.assertEqual(cli.main(["serve", "--host", "0.0.0.0", "--no-mdns"]), 0)
        route.assert_not_called()

    def test_every_served_listener_gets_the_handler_that_can_listen_again(self):
        """客户端在 accept 完成前断开、监听被标准库关掉时，处理器要拿着 uvicorn 的 Server 才能重新监听。"""
        import asyncio
        from peach import cli, error_reporting
        handlers = []
        for arguments in (["serve", "--host", "0.0.0.0", "--no-mdns"],
                          ["serve", "--host", "0.0.0.0", "--port", "80", "--redirect-origin", "https://peach.test"]):
            handlers.clear()
            sock = MagicMock(**{"getsockname.return_value": ("::", 8900)})
            with self.subTest(arguments=arguments), \
                    patch.object(cli, "_require_readable_settings"), \
                    patch.object(cli, "_serve_token", return_value="test"), \
                    patch.object(cli, "_build_sync", return_value=None), \
                    patch.object(cli, "create_app"), patch.object(cli, "TUNNEL_ENABLED", False), \
                    patch("peach.listening.bind", return_value=(sock, True)), \
                    patch("uvicorn.Config") as config, patch("uvicorn.Server") as uvicorn_server:
                config.return_value.get_loop_factory.return_value = None
                uvicorn_server.return_value.serve = AsyncMock(
                    side_effect=lambda **_: handlers.append(asyncio.get_running_loop().get_exception_handler()))
                self.assertEqual(cli.main(arguments), 0)
                handler, = handlers
                self.assertIs(handler.func, error_reporting.asyncio_handler)
                self.assertEqual(handler.keywords, {"uvicorn_server": uvicorn_server.return_value})
                uvicorn_server.return_value.serve.assert_awaited_once_with(sockets=[sock])

    def test_cli_publishes_aaaa_only_when_the_socket_accepts_ipv6(self):
        """mDNS 跟着实际绑出来的套接字走，而不是跟着 `--host` 的写法走。"""
        from peach import cli
        for ipv6, argv in ((True, ["serve", "--host", "0.0.0.0", "--mdns-address", "192.0.2.10"]),
                           (False, ["serve", "--host", "0.0.0.0", "--ipv4-only",
                                    "--mdns-address", "192.0.2.10"])):
            with self.subTest(ipv6=ipv6), patch.object(cli, "_require_readable_settings"), \
                    patch.object(cli, "_serve_token", return_value="test"), \
                    patch.object(cli, "_build_sync", return_value=None), \
                    patch.object(cli, "create_app") as create_app, \
                    patch.object(cli, "TUNNEL_ENABLED", False), \
                    patch("peach.listening.bind", return_value=(MagicMock(), ipv6)) as bind, \
                    patch("peach.listening.serve"):
                self.assertEqual(cli.main(argv), 0)
                settings = create_app.call_args.args[0]
                self.assertEqual(settings.mdns_ipv6, ipv6)
                self.assertTrue(settings.mdns_enabled)
                self.assertEqual(bind.call_args.kwargs, {"ipv4_only": not ipv6})

    def test_cli_treats_every_loopback_spelling_as_local(self):
        from peach import cli
        for host in ("::1", "[::1]", "127.0.0.2", "localhost"):
            with self.subTest(host=host):
                self.assertTrue(cli._is_loopback(host))
        self.assertFalse(cli._is_loopback("::"))

    def test_initialization_preserves_existing_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(root)})
            settings_file.write(config)
            config.directory('database').mkdir()
            config.directory('database').joinpath('ledger.db').touch()
            existing = config.path.read_bytes()
            with patch.object(server.settings_file, "load_config", return_value=settings_file.load_config(
                    environ={"PEACH_DATA_ROOT": str(root)})), patch.object(server, "launch") as launch:
                launch.return_value.wait.return_value = 0
                server.initialize()
            launch.assert_called_once_with('migrate', 'upgrade', '--yes', '--db', str(config.directory('database') / 'ledger.db'))
            self.assertEqual(config.path.read_bytes(), existing)

    def test_initialization_rejects_database_without_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(root)})
            config.directory("database").mkdir()
            config.directory("database").joinpath("ledger.db").write_bytes(b"existing")
            with patch.object(server.settings_file, "load_config", return_value=config), \
                    patch.object(server, "launch") as launch:
                with self.assertRaisesRegex(RuntimeError, "已有数据库"):
                    server.initialize()
            launch.assert_not_called()

    def test_stop_waits_for_child_exit(self):
        process = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"],
                                   stdin=subprocess.DEVNULL)
        try:
            server.stop_process(process)
            self.assertIsNotNone(process.poll())
        finally:
            server.stop_process(process)

    def test_relocation_restarts_the_service_on_the_new_data_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(root)})
            process = subprocess.Popen([sys.executable, "-c", "raise SystemExit(17)"], stdin=subprocess.DEVNULL)
            process.wait(timeout=15)
            calls = []

            def relocation(stop, restart):
                if calls:
                    return False
                calls.append(True)
                stop()
                restart({"PEACH_DATA_ROOT": str(root / "moved")})
                return True

            with patch.dict(server.os.environ, {}), \
                    patch.object(server.settings_file, "load_config", return_value=config), \
                    patch("peach.data_storage.poll_headless", side_effect=relocation), \
                    patch.object(server, "launch", return_value=process) as launch:
                self.assertEqual(server.supervise("127.0.0.1", 8900, threading.Event()), 17)
                # 迁移后看守进程自己也按新位置读设置，拉起的服务继承这个位置。
                self.assertEqual(server.os.environ["PEACH_DATA_ROOT"], str(root / "moved"))
            self.assertEqual(launch.call_count, 1)

    def test_service_failure_exits_supervisor(self):
        with tempfile.TemporaryDirectory() as directory:
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(Path(directory).resolve())})
            process = subprocess.Popen([sys.executable, "-c", "raise SystemExit(17)"],
                                       stdin=subprocess.DEVNULL)
            process.wait(timeout=15)
            with patch.object(server.settings_file, "load_config", return_value=config), \
                    patch.object(server, "launch", return_value=process):
                self.assertEqual(server.supervise("127.0.0.1", 8900, threading.Event()), 17)

    def test_a_fresh_docker_volume_starts_unconfigured_without_init(self):
        with tempfile.TemporaryDirectory() as directory:
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(Path(directory).resolve())})
            with patch.dict(server.os.environ, {"PEACH_DISTRIBUTION": "docker"}), \
                    patch.object(server.settings_file, "load_config", return_value=config), \
                    patch.object(server, "launch") as launch:
                server.initialize()
                launch.assert_not_called()
                self.assertFalse(config.path.exists())
                config.directory("database").mkdir(parents=True)
                config.directory("database").joinpath("ledger.db").write_bytes(b"existing")
                with self.assertRaisesRegex(RuntimeError, "已有数据库"):
                    server.initialize()
            launch.assert_not_called()

    def test_the_setup_service_is_replaced_once_the_settings_file_appears(self):
        from dataclasses import replace
        from unittest.mock import Mock
        with tempfile.TemporaryDirectory() as directory:
            absent = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(Path(directory).resolve())})
            present = replace(absent, present=True)
            state = {"configured": False}
            stopping = threading.Event()
            launched = []

            def start(*arguments):
                launched.append(arguments)
                if len(launched) == 1:
                    state["configured"] = True  # 首次设置提交，设置文件写好了
                else:
                    stopping.set()
                return Mock(poll=Mock(return_value=None))

            with patch.object(server.settings_file, "load_config",
                              side_effect=lambda: present if state["configured"] else absent), \
                    patch("peach.data_storage.poll_headless", return_value=False), \
                    patch.object(server, "launch", side_effect=start):
                self.assertEqual(server.supervise("0.0.0.0", 8900, stopping), 0)
        self.assertEqual([arguments[:2] for arguments in launched], [("serve", "--setup"), ("serve", "--host")])

    def test_the_container_log_line_follows_the_command_line_language(self):
        with tempfile.TemporaryDirectory() as directory:
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(Path(directory).resolve())})
            with patch.dict(server.os.environ, {server.ACCESS_PASSWORD_ENV: "container-secret", "PEACH_LANGUAGE": "en"}):
                self.assertEqual(server.seed_access_password(config), "Access password set from PEACH_ACCESS_PASSWORD.")

    def test_access_password_from_the_environment_is_written_once_and_never_echoed(self):
        from peach import access
        with tempfile.TemporaryDirectory() as directory:
            config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(Path(directory).resolve())})
            path = config.directory("secrets") / "access.json"
            with patch.dict(server.os.environ, {server.ACCESS_PASSWORD_ENV: "short"}):
                message = server.seed_access_password(config)
                self.assertNotIn(server.ACCESS_PASSWORD_ENV, server.os.environ)
            self.assertIn("8–256", message)
            self.assertFalse(path.exists())
            with patch.dict(server.os.environ, {server.ACCESS_PASSWORD_ENV: "container-secret"}):
                message = server.seed_access_password(config)
                self.assertNotIn(server.ACCESS_PASSWORD_ENV, server.os.environ, "不传给服务子进程")
            self.assertNotIn("container-secret", message)
            policy = access.load(path)
            self.assertEqual(policy["mode"], "password")
            self.assertTrue(access.verify(policy, "container-secret"))
            self.assertNotIn("container-secret", path.read_text(encoding="utf-8"))
            with patch.dict(server.os.environ, {server.ACCESS_PASSWORD_ENV: "another-secret"}):
                message = server.seed_access_password(config)
            self.assertIn("忽略", message)
            self.assertNotIn("another-secret", message)
            self.assertEqual(access.load(path)["revision"], policy["revision"])
            with patch.dict(server.os.environ, {}, clear=False):
                server.os.environ.pop(server.ACCESS_PASSWORD_ENV, None)
                self.assertEqual(server.seed_access_password(config), "")


class NasComposeTests(unittest.TestCase):
    def test_installation_errors_keep_value_error_compatibility_and_a_message_code(self):
        from peach.nas_setup import compose
        from peach.user_messages import error_fields
        with self.assertRaises(ValueError) as caught:
            compose(bind='0.0.0.0', media='/srv/videos')
        self.assertEqual(error_fields(caught.exception), {
            'error': '请填写 NAS 的局域网 IP 或回环地址',
            'message_code': 'nasSetup.invalidBind', 'message_params': {}})

    def test_generated_config_preserves_literal_paths_and_scopes_permissions(self):
        from peach.nas_setup import compose
        import json
        text = compose(bind='192.0.2.10', media='/srv/电影 $archive/owner\'s videos',
                       render_device='/dev/dri/renderD128', prepare_render=True)
        # 从 YAML 的 JSON 字符串解码，再模拟 Compose 的美元转义，目录必须逐字保留。
        source = next(line.split('source: ', 1)[1] for line in text.splitlines() if 'source: ' in line)
        self.assertEqual(json.loads(source).replace('$$', '$'), '/srv/电影 $archive/owner\'s videos')
        self.assertIn('read_only: true', text)
        self.assertIn('create_host_path: false', text)
        self.assertIn('peach-data:/data', text)
        self.assertIn('PEACH_VAAPI_PREPARE: "1"', text, "节点由镜像入口在降权前准备")
        self.assertNotIn('entrypoint:', text, "只有一个入口，UID/GID 与核显准备在同一处降权")
        self.assertNotIn('user:', text)
        self.assertNotIn('privileged', text)
        self.assertNotIn('SYS_ADMIN', text)
        self.assertIn('image: "longmeidao/peach:latest"', text, "NAS 面板只按 latest 检查更新")

    def test_the_run_identity_can_follow_the_nas_share_owner(self):
        from peach.nas_setup import compose
        text = compose(bind='192.0.2.10', media='/srv/videos', uid=1026, gid=100)
        self.assertIn('PEACH_UID: "1026"', text)
        self.assertIn('PEACH_GID: "100"', text)
        self.assertNotIn('environment:', compose(bind='192.0.2.10', media='/srv/videos'))
        for value in (0, -1, 2**32 - 1):
            with self.subTest(value=value), self.assertRaises(ValueError):
                compose(bind='192.0.2.10', media='/srv/videos', uid=value)

    def test_cpu_and_group_access_do_not_request_root(self):
        from peach.nas_setup import compose
        cpu = compose(bind='::1', media='/srv/videos')
        self.assertIn('[::1]:8900:8900', cpu)
        self.assertNotIn('devices:', cpu)
        group = compose(bind='192.0.2.10', media='/srv/videos',
                        render_device='/dev/dri/renderD129', render_gid=107)
        self.assertIn('group_add:\n      - "107"', group)
        self.assertNotIn('user:', group)
        self.assertNotIn('entrypoint:', group)

    def test_invalid_installation_values_and_ambiguous_gpu_access_are_rejected(self):
        from peach.nas_setup import compose
        for changes in ({'bind': '0.0.0.0'}, {'media': 'relative'}, {'port': 0},
                        {'render_device': '/dev/sda', 'prepare_render': True},
                        {'render_device': '/dev/dri/renderD128'},
                        {'render_device': '/dev/dri/renderD128', 'prepare_render': True, 'render_gid': 107},
                        {'render_gid': 107}, {'hostname': 'invalid name'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                compose(**dict({'bind': '192.0.2.10', 'media': '/srv/videos'}, **changes))

    def test_existing_compose_is_never_overwritten(self):
        from peach.nas_setup import main
        import contextlib
        import io
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'compose.yaml'
            output.write_text('existing deployment', encoding='utf-8')
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as failed:
                main(['--bind', '192.0.2.10', '--media', '/srv/videos', '--output', str(output)])
            self.assertEqual(failed.exception.code, 2)
            self.assertEqual(output.read_text(encoding='utf-8'), 'existing deployment')


@unittest.skipIf(sys.platform == 'win32', 'Linux container device entry point')
class RenderDevicePreparationTests(unittest.TestCase):
    def test_host_bind_mount_and_non_render_devices_are_rejected_before_mutation(self):
        from peach import docker_vaapi
        import stat
        for device, info in (
            ('/dev/dri/renderD128', SimpleNamespace(st_mode=stat.S_IFCHR, st_rdev=0, st_dev=2)),
            ('/dev/dri/renderD128', SimpleNamespace(st_mode=stat.S_IFLNK, st_rdev=0, st_dev=1)),
        ):
            with (self.subTest(info=info), patch.object(docker_vaapi.os, 'geteuid', return_value=0),
                  patch.object(docker_vaapi.os, 'lstat', return_value=info),
                  patch.object(docker_vaapi.os, 'major', return_value=226),
                  patch.object(docker_vaapi.os, 'minor', return_value=128),
                  patch.object(docker_vaapi.os, 'stat', return_value=SimpleNamespace(st_dev=1)),
                  patch.object(docker_vaapi.os, 'chown') as chown,
                  self.assertRaises((PermissionError, ValueError))):
                docker_vaapi.prepare(device, 1027)
            chown.assert_not_called()

    def test_the_node_goes_to_the_service_group_and_identity_is_left_to_the_entrypoint(self):
        from peach import docker_vaapi
        import stat
        device = SimpleNamespace(st_mode=stat.S_IFCHR, st_rdev=0, st_dev=1)
        with (patch.object(docker_vaapi.os, 'geteuid', return_value=0),
              patch.object(docker_vaapi.os, 'lstat', return_value=device),
              patch.object(docker_vaapi.os, 'stat', return_value=SimpleNamespace(st_dev=1)),
              patch.object(docker_vaapi.os, 'major', return_value=226),
              patch.object(docker_vaapi.os, 'minor', return_value=128),
              patch.object(docker_vaapi.os, 'chown') as chown,
              patch.object(docker_vaapi.os, 'chmod') as chmod):
            docker_vaapi.prepare('/dev/dri/renderD128', 1027)
            with self.assertRaises(PermissionError):
                docker_vaapi.prepare('/dev/dri/renderD128', 0)
        chown.assert_called_once_with('/dev/dri/renderD128', 0, 1027)
        chmod.assert_called_once_with('/dev/dri/renderD128', 0o660)
