"""独立包更新使用临时目录验证路径、进度、重启确认及回滚。"""
import base64
import json
import hashlib
import os
import shutil
from contextlib import closing, nullcontext
from pathlib import Path
import tempfile
import sqlite3
import unittest
from unittest.mock import Mock, patch
import zipfile

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat
import httpx

from peach import interface_text, release_signing, settings_file, standalone_update as update
from peach import update_packages
from peach.user_messages import UserValueError
from scripts.package_windows_release import package as package_release
from scripts.smoke_split_update import verify as verify_split
from support.ledger import fresh_ledger


class ReleaseDownloadFailoverTests(unittest.TestCase):
    def test_both_sources_fall_back_to_identical_verified_bytes(self):
        suffix = 'v1.0.0/Peach-1.0.0-windows-x64-update.zip'
        urls = ('https://github.com/peach-mitao/peach/releases/download/' + suffix,
                'https://downloads.peach.video/' + suffix)
        content = b'verified release bytes'
        for primary in urls:
            for failure in ('unavailable', 'corrupt'):
                with self.subTest(primary=primary, failure=failure), tempfile.TemporaryDirectory() as folder:
                    calls = []

                    def respond(request, primary=primary, failure=failure, calls=calls):
                        calls.append(str(request.url))
                        if str(request.url) == primary:
                            return httpx.Response(503) if failure == 'unavailable' else httpx.Response(200, content=b'damaged')
                        return httpx.Response(200, content=content)

                    def client(respond=respond, **_kwargs):
                        return httpx.Client(transport=httpx.MockTransport(respond))

                    archive = Path(folder).resolve() / 'update.zip'
                    archive.write_bytes(b'previous partial download')
                    with patch('peach.peach_proxy.http_client', side_effect=client):
                        update.download(primary, archive, len(content), hashlib.sha256(content).hexdigest(), lambda _count: None)
                    self.assertEqual(calls, [primary, next(url for url in urls if url != primary)])
                    self.assertEqual(archive.read_bytes(), content)

    def test_two_corrupt_sources_cannot_bypass_the_original_digest(self):
        calls = []

        def respond(request):
            calls.append(str(request.url))
            return httpx.Response(200, content=b'bad')

        def client(**_kwargs):
            return httpx.Client(transport=httpx.MockTransport(respond))

        with tempfile.TemporaryDirectory() as folder, patch('peach.peach_proxy.http_client', side_effect=client):
            with self.assertRaisesRegex(ValueError, '校验失败'):
                update.download('https://github.com/peach-mitao/peach/releases/download/v1.0.0/Peach-1.0.0-windows-x64.zip',
                                Path(folder).resolve() / 'package.zip', 3, hashlib.sha256(b'yes').hexdigest(), lambda _count: None)
        self.assertEqual(len(calls), 2)

    def test_a_lagging_mirror_does_not_hide_why_the_primary_source_failed(self):
        github = 'https://github.com/peach-mitao/peach/releases/download/v1.0.0/Peach-1.0.0-windows-x64.zip'

        def client(primary, **_kwargs):
            return httpx.Client(transport=httpx.MockTransport(
                lambda request: primary if str(request.url) == github else httpx.Response(404)))

        for primary, expected in ((httpx.Response(200, content=b'bad'), '校验失败'),
                                  (httpx.Response(503), '503')):
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as folder, \
                    patch('peach.peach_proxy.http_client', side_effect=lambda primary=primary, **kw: client(primary, **kw)):
                with self.assertRaisesRegex((ValueError, httpx.HTTPError), expected):
                    update.download(github, Path(folder).resolve() / 'package.zip', 3,
                                    hashlib.sha256(b'yes').hexdigest(), lambda _count: None)


class MediaToolInstallTests(unittest.TestCase):
    """源码运行在配置页安装 FFmpeg、untrunc：发布工具包装进数据目录的 `tools/`。"""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.tools = self.root / 'data' / 'tools'
        self.package = self.root / 'release' / 'Peach-1.0.0-windows-x64-tools-untrunc.zip'
        self.package.parent.mkdir()
        files = {name: f'{name} 内容'.encode() for name in ('untrunc.exe', 'LICENSE.txt', 'NOTICE.md', 'buildconf.txt')}
        manifest = {'version': 'abc1234', 'files': {name: hashlib.sha256(body).hexdigest() for name, body in files.items()}}
        with zipfile.ZipFile(self.package, 'w') as bundle:
            for name, body in {**files, 'manifest.json': json.dumps(manifest).encode()}.items():
                bundle.writestr(f'Peach/tools/untrunc/{name}', body)
        self.downloads = []
        supported = patch('peach.media_tools.supported', return_value=True)
        supported.start()
        self.addCleanup(supported.stop)

    def locate(self, _tool, digest=None):
        return {'url': 'https://github.com/peach-mitao/peach/releases/download/v1.0.0/' + self.package.name,
                'size': self.package.stat().st_size, 'version': '1.0.0',
                'digest': 'sha256:' + (digest or update_packages.digest(self.package))}

    def fetch(self, url, archive, size, digest, progress):
        """离线的 `standalone_update.download`：同样按发布记录核对体积与摘要。"""
        self.downloads.append(url)
        shutil.copy2(self.package, archive)
        if archive.stat().st_size != size or update_packages.digest(archive) != digest:
            raise UserValueError('errors.standaloneUpdate.checksumFailed')

    def entries(self):
        """`tools` 下除安装锁以外的条目。filelock 释放时只在 Windows 上删锁文件，macOS、Linux 上会留着。"""
        return sorted(path.name for path in self.tools.iterdir() if not path.name.endswith('.lock'))

    def install(self, **kwargs):
        from peach import media_tools
        package = kwargs.pop('locate', self.locate)('untrunc')
        digest = package['digest'].removeprefix('sha256:')
        sums = f'{digest}  {self.package.name}\n'.encode()
        private = base64.b64encode(Ed25519PrivateKey.generate().private_bytes(
            Encoding.Raw, PrivateFormat.Raw, NoEncryption())).decode('ascii')
        signature = release_signing.sign(sums, private).encode()
        public = release_signing.public_key(private)
        with patch.object(release_signing, 'PUBLIC_KEYS', (public,)), patch.object(
                update, '_fetch_small', side_effect=lambda _client, url: signature if url.endswith('.sig') else sums):
            return media_tools.install(self.tools, 'untrunc', locate=lambda _tool: package, fetch=self.fetch)

    def test_installs_the_verified_package_into_the_data_directory_and_reports_its_version(self):
        from peach import media_tools
        self.assertEqual(self.install()['message'], '已安装 untrunc（abc1234）')
        self.assertEqual((self.tools / 'untrunc' / 'untrunc.exe').read_bytes(), 'untrunc.exe 内容'.encode())
        self.assertEqual(media_tools.installed_version(self.tools, 'untrunc'), 'abc1234')
        self.assertEqual(self.entries(), ['untrunc'])

    def test_a_package_that_does_not_match_the_release_digest_changes_nothing(self):
        (self.tools / 'untrunc').mkdir(parents=True)
        (self.tools / 'untrunc' / 'untrunc.exe').write_bytes(b'user copy')
        with self.assertRaisesRegex(ValueError, '与发布摘要不符'):
            self.install(locate=lambda tool: self.locate(tool, digest='0' * 64))
        self.assertEqual((self.tools / 'untrunc' / 'untrunc.exe').read_bytes(), b'user copy')
        self.assertEqual(self.entries(), ['untrunc'])

    def test_installing_again_skips_the_download_until_a_file_stops_matching(self):
        self.install()
        receipt = self.install()
        self.assertEqual(receipt['message'], 'untrunc 已安装（abc1234），无需重新下载')
        self.assertEqual(interface_text.text(f"server:{receipt['message_code']}", receipt['message_params'], 'en'),
                         'untrunc is already installed (abc1234). No download needed.')
        self.assertEqual(len(self.downloads), 1)
        (self.tools / 'untrunc' / 'NOTICE.md').write_text('改坏了', encoding='utf-8')
        self.assertEqual(self.install()['message'], '已安装 untrunc（abc1234）')
        self.assertEqual(len(self.downloads), 2)

    def test_an_interrupted_install_is_cleared_by_the_next_one(self):
        leftover = self.tools / '.install-untrunc-0123456789ab'
        leftover.mkdir(parents=True)
        (leftover / 'package.zip').write_bytes(b'half')
        self.install()
        self.assertEqual(self.entries(), ['untrunc'])

    def test_files_outside_the_package_manifest_are_refused(self):
        with zipfile.ZipFile(self.package, 'a') as bundle:
            bundle.writestr('Peach/tools/untrunc/extra.dll', b'x')
        with self.assertRaisesRegex(ValueError, '清单外'):
            self.install()
        self.assertFalse((self.tools / 'untrunc').exists())


class StandaloneUpdateTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.config = settings_file.load_config(environ={"PEACH_DATA_ROOT": str(self.root)})
        self.load_config = settings_file.load_config
        self.database = self.config.directory("database") / "ledger.db"
        self.database.parent.mkdir()
        self.state = self.config.directory("state")
        self.state.mkdir()
        patcher = patch.object(update.settings_file, "load_config", return_value=self.config)
        patcher.start(); self.addCleanup(patcher.stop)
        # 未签名夹具沿用升级过渡期的客户端；验签用例显式装入各自的测试公钥。
        self.enterContext(patch.object(update.release_signing, "PUBLIC_KEYS", ()))

    def test_online_install_remembers_a_known_root_only_for_an_empty_default_location(self):
        settings_file.write(self.config)
        config = self.load_config(environ={"PEACH_DATA_ROOT": str(self.root)})
        target = self.root / "app"
        bootstrap = self.root / "default-data"
        with patch.object(update.distribution, "standalone", return_value=True), patch.object(
                update.distribution, "user_data_root", return_value=bootstrap), patch.object(
                update.settings_file, "load_config", side_effect=self.load_config), patch.dict(
                os.environ, {"PEACH_DATA_ROOT": str(self.root)}), patch.object(
                update.sys, "executable", str(target / "Peach.exe")):
            update.write({"target": str(target), "version": update.__version__}, state="ready")
            self.assertFalse(update.remember_installation_data_root(config))
            update.write({"target": str(self.root / "other-app"), "version": update.__version__}, state="installing")
            self.assertFalse(update.remember_installation_data_root(config))
            update.write({"target": str(target), "version": update.__version__}, state="installing")
            self.assertTrue(update.remember_installation_data_root(config))
            self.assertEqual(self.load_config(environ={"PEACH_DATA_ROOT": str(bootstrap)}).data_root, self.root)
            self.assertFalse(update.remember_installation_data_root(config))
            (bootstrap / "state/data-root.txt").unlink()
            settings = bootstrap / "config.toml"
            settings.write_text("[server]\nport = 9123\n", encoding="utf-8")
            self.assertFalse(update.remember_installation_data_root(config))
            self.assertEqual(settings.read_text(encoding="utf-8"), "[server]\nport = 9123\n")

    @unittest.skipUnless(os.name == "nt", "Windows 更新助手")
    def test_tray_reads_update_intent_from_the_selected_data_root_and_passes_it_to_helper(self):
        import threading
        from types import SimpleNamespace
        from dataclasses import replace
        selected = replace(self.config, data_root=self.root / "selected")
        tray = SimpleNamespace(_action_lock=threading.Lock(), exit=Mock())
        with patch.object(update.settings_file, "load_config", return_value=selected), patch.object(
                update.distribution, "standalone", return_value=True), patch.object(update.subprocess, "Popen") as launch:
            update.write({"helper": str(self.root / "helper")}, state="restarting")
            launch.return_value.pid = os.getpid()
            update.poll(tray)
            self.assertEqual(launch.call_args.args[0][2], str(selected.directory("state") / "standalone-update.json"))
            self.assertEqual(launch.call_args.kwargs["env"]["PEACH_DATA_ROOT"], str(selected.data_root))
            tray.exit.assert_called_once_with(reason="standalone-update")
        self.assertEqual(update.read()["state"], "idle")

    def archive(self, names):
        archive = self.root / "package.zip"
        with zipfile.ZipFile(archive, "w") as package:
            for name in names:
                package.writestr(name, "fixture")
        return archive

    def reader_installation(self):
        fresh_ledger(self.database.parent)
        target = self.root / 'app'
        (target / '_internal').mkdir(parents=True)
        (target / '_internal/standalone.txt').touch()
        (target / 'Peach.exe').write_text('old', encoding='utf-8')
        transaction = self.root / '.app-update-reader'
        stage = transaction / 'stage/Peach'
        (stage / '_internal').mkdir(parents=True)
        shutil.copytree(Path(__file__).resolve().parents[1] / 'migrations', stage / '_internal/migrations')
        (stage / 'Peach.exe').write_text('new', encoding='utf-8')
        update.write(dict(id='reader', target=str(target), transaction=str(transaction),
                          stage=str(stage), version='1.0.0'), state='ready')
        return target, stage

    def test_reader_with_pending_schema_is_rejected_before_install_or_ledger_writes(self):
        target, stage = self.reader_installation()
        with closing(sqlite3.connect(self.database)) as connection, connection:
            connection.execute('DROP TABLE ledger_upgrade_repair')
            connection.execute("DELETE FROM ledger_revision WHERE tbl='ledger_upgrade_repair'")
            connection.execute("DELETE FROM schema_migration WHERE version='0048'")
        before = self.database.read_bytes()
        with patch('peach.runtime_prepare.configured_ledger_writer', return_value=(False, '读取端')), patch.object(
                update.distribution, 'standalone', return_value=True), patch.object(update.sys, 'platform', 'win32'), \
                patch.object(update.update_tasks, 'reserve') as reserve, patch.object(update, 'preserve_local_state') as preserve, \
                patch.object(update, 'restore_database') as restore, patch('peach.windows_restart.start_tray') as start:
            with self.assertRaisesRegex(ValueError, '写入端迁移并同步'):
                update.request_restart()
            self.assertEqual(update.apply(update.state_path(), 999), 1)
        for operation in (reserve, preserve, restore, start):
            operation.assert_not_called()
        self.assertEqual(self.database.read_bytes(), before)
        self.assertEqual((target / 'Peach.exe').read_text(), 'old')
        self.assertTrue(stage.is_dir())

    def test_compatible_reader_updates_program_without_reserving_or_backing_up_ledger(self):
        target, _stage = self.reader_installation()
        before = self.database.read_bytes()
        health = Mock(status_code=200)
        health.json.return_value = dict(version='1.0.0', ready=True)
        with patch('peach.runtime_prepare.configured_ledger_writer', return_value=(False, '读取端')), patch.object(
                update.distribution, 'standalone', return_value=True), patch.object(update.sys, 'platform', 'win32'), \
                patch.object(update.update_tasks, 'reserve') as reserve, patch('peach.job_recovery.import_legacy_library') as import_job, \
                patch('peach.windows_restart.process_alive', return_value=False), patch('peach.windows_restart.start_tray'), \
                patch('peach.windows_restart.find_tray_windows', return_value=[Mock()]), patch.object(
                update.httpx, 'get', return_value=health):
            self.assertEqual(update.request_restart()['state'], 'restarting')
            self.assertEqual(update.apply(update.state_path(), 999), 0)
        reserve.assert_not_called()
        import_job.assert_not_called()
        self.assertFalse((self.state / 'update-backups/reader/ledger.db').exists())
        self.assertEqual(self.database.read_bytes(), before)
        self.assertEqual((target / 'Peach.exe').read_text(), 'new')

    def test_compatible_reader_install_failure_restores_program_without_restoring_ledger(self):
        target, stage = self.reader_installation()
        before = self.database.read_bytes()
        original = update.replace_with_retry
        def replace(source, destination):
            if source == stage:
                raise OSError('occupied')
            original(source, destination)
        with patch('peach.runtime_prepare.configured_ledger_writer', return_value=(False, '读取端')), patch.object(
                update, 'replace_with_retry', side_effect=replace), patch.object(update, 'restore_database') as restore, \
                patch.object(update.update_tasks, 'reserve') as reserve, patch('peach.windows_restart.process_alive', return_value=False), \
                patch('peach.windows_restart.start_tray'):
            self.assertEqual(update.apply(update.state_path(), 999), 1)
        restore.assert_not_called()
        reserve.assert_not_called()
        self.assertEqual(self.database.read_bytes(), before)
        self.assertEqual((target / 'Peach.exe').read_text(), 'old')

    def test_zip_requires_a_complete_standalone_layout_and_reports_progress(self):
        archive = self.archive(["Peach/Peach.exe", "Peach/_internal/standalone.txt"])
        progress = Mock()
        root = update.extract(archive, self.root / "extract", progress)
        self.assertTrue((root / "Peach.exe").is_file())
        self.assertEqual(progress.call_args.args, (2, 2))

    def test_zip_rejects_traversal_windows_streams_and_case_collisions(self):
        for name in ("../escape", "Peach/../escape", "C:/escape", "Peach/a:b", "Peach/Peach.exe"):
            with self.subTest(name=name):
                archive = self.archive(["Peach/peach.exe", name])
                with self.assertRaises(ValueError):
                    update.extract(archive, self.root / "extract", Mock())

    def test_stale_progress_is_retryable_and_public_state_hides_paths(self):
        update.write({}, state="downloading", target="private-path", progress=22)
        with patch.object(update.time, "time", return_value=10**12):
            self.assertEqual(update.public()["state"], "error")
        self.assertNotIn("target", update.public())

    def test_progress_carries_its_code_and_a_plain_message_drops_the_previous_one(self):
        update.write({}, state="downloading", **update.message_fields("jobMessage.standaloneUpdate.complete",
                                                                       {"version": "1.2.0"}))
        state = update.public()
        self.assertEqual(state["message"], "已更新至 1.2.0")
        self.assertEqual(interface_text.text(f"server:{state['message_code']}", state["message_params"], "en"),
                         "Updated to 1.2.0")
        update.write(update.read(), state="error", message="OSError: disk full")
        self.assertNotIn("message_code", update.public())
        update.write({}, state="downloading", progress=22)
        with patch.object(update.time, "time", return_value=10**12):
            stale = update.public()
        self.assertEqual(stale["message_code"], "jobMessage.standaloneUpdate.interrupted")
        self.assertEqual(interface_text.text("server:jobMessage.standaloneUpdate.interrupted", None, "en"),
                         "The update was interrupted. Try again.")

    def test_restart_requires_ready_and_only_records_intent(self):
        with patch.object(update.distribution, "standalone", return_value=True), patch.object(update.sys, "platform", "win32"):
            with self.assertRaises(ValueError):
                update.request_restart()
            update.write({}, state="ready", version="1.0.0")
            with patch.object(update.subprocess, "Popen") as launch:
                self.assertEqual(update.request_restart()["state"], "restarting")
                launch.assert_not_called()

    def test_source_installs_cannot_start_binary_update(self):
        with patch.object(update.distribution, "standalone", return_value=False):
            with self.assertRaises(ValueError):
                update.start()

    def test_restart_accepts_running_tasks_and_requests_their_pause(self):
        from peach.task_runs import TaskRunStore
        fresh_ledger(self.database.parent)
        store = TaskRunStore(self.database)
        store.start('library-processing', trigger='scheduled')
        update.write({}, state='ready', version='1.0.0')
        with patch.object(update.distribution, 'standalone', return_value=True), patch.object(update.sys, 'platform', 'win32'):
            self.assertEqual(update.request_restart()['state'], 'restarting')
            self.assertTrue(update.update_tasks.is_pausing(self.database))
            with self.assertRaisesRegex(ValueError, '安装更新'):
                store.start('timeline-thumbnails', trigger='manual')
            update.update_tasks.release(self.database, update.read()['task_token'])

    def test_download_prepares_verified_package_without_stopping_the_app(self):
        target = self.root / "installed"; target.mkdir()
        (target / "Peach.exe").write_text("old")
        (target / "unins000.exe").write_text("uninstaller")
        archive = self.archive(["Peach/Peach.exe", "Peach/_internal/standalone.txt"])
        with zipfile.ZipFile(archive, "a") as package:
            package.writestr("Peach/_internal/build-info.json", json.dumps({"version":"1.0.0","commit":None,"built_at":"fixture"}))
        content = archive.read_bytes()
        response = Mock()
        response.iter_bytes.return_value = [content[:10],content[10:]]
        client = Mock()
        client.stream.return_value = nullcontext(response)
        release = dict(state="available", latest_version="1.0.0", asset_size=len(content),
                       asset_digest="sha256:" + hashlib.sha256(content).hexdigest(), asset_url="https://github.com/fixture")
        lock = Mock()
        with patch.object(update.sys,"executable",str(target/"Peach.exe")), patch.object(
                update.release_updates,"check",return_value=release), patch.object(
                update.httpx,"Client",return_value=nullcontext(client)), patch.object(update.subprocess,"Popen") as launch:
            update.prepare({"id":"download-fixture"},lock)
        state = update.read()
        self.assertEqual(state["state"],"ready",state)
        self.assertEqual(state["downloaded"],len(content))
        self.assertTrue((Path(state["helper"])/"Peach.exe").is_file())
        self.assertEqual((Path(state["stage"])/"unins000.exe").read_text(),"uninstaller")
        self.assertEqual((target/"Peach.exe").read_text(),"old")
        launch.assert_not_called()
        lock.release.assert_called_once()

    def release_fixture(self):
        source = self.root / "dist/Peach"
        (source / "_internal").mkdir(parents=True)
        (source / "Peach.exe").write_bytes(b"new application")
        (source / "_internal/standalone.txt").touch()
        (source / "_internal/build-info.json").write_text(
            json.dumps({"version": "1.0.0", "commit": None, "built_at": "fixture"}), encoding="utf-8")
        for prefix, required in update_packages.TOOL_PATHS.values():
            for name in required | ({"bin/codec.dll"} if prefix == "tools/ffmpeg" else set()):
                path = source / prefix / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes((prefix + name).encode())
        output = self.root / "release"
        manifest = package_release(source, output, "1.0.0")
        target = self.root / "installed"
        shutil.copytree(source, target)
        (target / "Peach.exe").write_bytes(b"old application")
        (target / "unins000.exe").write_bytes(b"uninstaller")
        archive = output / "Peach-1.0.0-windows-x64-update.zip"
        release = dict(state="available", latest_version="1.0.0", asset_size=archive.stat().st_size,
                       asset_digest="sha256:" + update_packages.digest(archive),
                       asset_url="https://github.com/peach-mitao/peach/releases/download/v1.0.0/" + archive.name,
                       package_kind="update")
        return source, output, manifest, target, archive, release

    def prepare_fixture(self, target, output, release, *, corrupt=None):
        requests = []
        def response(request):
            name = request.url.path.rsplit("/", 1)[1]
            requests.append(name)
            if not (output / name).is_file():
                return httpx.Response(404)
            content = (output / name).read_bytes()
            return httpx.Response(200, content=b"corrupt" if name == corrupt else content)
        client_type = update.httpx.Client
        lock = Mock()
        with patch.object(update.sys, "executable", str(target / "Peach.exe")), patch.object(
                update.release_updates, "check", return_value=release), patch.object(
                update.httpx, "Client", side_effect=lambda **kwargs: client_type(
                    **{**kwargs, 'transport': update.httpx.MockTransport(response), 'trust_env': False, 'proxy': None})):
            update.prepare({"id": "split-fixture"}, lock)
        lock.release.assert_called_once()
        return update.read(), requests

    def test_split_package_preserves_complete_install_and_reuses_verified_tools_without_download(self):
        source, output, manifest, target, archive, release = self.release_fixture()
        rebuilt = self.root / "rebuilt"
        report = verify_split(output, "1.0.0", rebuilt)
        self.assertEqual(report["tools"], 4)
        self.assertEqual((rebuilt / "Peach/Peach.exe").read_bytes(), (source / "Peach.exe").read_bytes())
        with zipfile.ZipFile(archive) as thin, zipfile.ZipFile(output / "Peach-1.0.0-windows-x64.zip") as full:
            self.assertNotIn("Peach/tools/ffmpeg/bin/ffmpeg.exe", thin.namelist())
            self.assertNotIn("Peach/cloudflared.exe", thin.namelist())
            self.assertFalse([name for name in thin.namelist() if name.startswith("Peach/tools/face-models/")])
            self.assertIn("Peach/tools/ffmpeg/bin/ffmpeg.exe", full.namelist())
            self.assertIn("Peach/tools/face-models/face_recognition_sface_2021dec.onnx", full.namelist())
            self.assertNotIn("Peach/" + update_packages.MANIFEST, full.namelist())
        state, requests = self.prepare_fixture(target, output, release)
        self.assertEqual(state["state"], "ready", state)
        self.assertEqual(requests, [archive.name])
        self.assertEqual(state["downloaded"], state["total"])
        for bundle in manifest["tools"].values():
            self.assertTrue(update_packages.matches(Path(state["stage"]), bundle["files"]))
        self.assertEqual((Path(state["stage"]) / "unins000.exe").read_bytes(), b"uninstaller")
        self.assertEqual((target / "Peach.exe").read_bytes(), b"old application")

    def test_only_missing_or_different_tools_are_downloaded_and_verified(self):
        source, output, manifest, target, archive, release = self.release_fixture()
        (target / "tools/ffmpeg/bin/codec.dll").write_bytes(b"different version")
        (target / "cloudflared.exe").unlink()
        state, requests = self.prepare_fixture(target, output, release)
        self.assertEqual(state["state"], "ready", state)
        self.assertEqual(set(requests), {archive.name, manifest["tools"]["ffmpeg"]["asset"]["name"],
                                       manifest["tools"]["cloudflared"]["asset"]["name"]})
        self.assertEqual(state["downloaded"], state["total"])
        for bundle in manifest["tools"].values():
            self.assertTrue(update_packages.matches(Path(state["stage"]), bundle["files"]))
        self.assertEqual((target / "tools/ffmpeg/bin/codec.dll").read_bytes(), b"different version")

    def lite_fixture(self):
        source, output, manifest, target, archive, release = self.release_fixture()
        stage = update.extract(archive, self.root / 'preflight', lambda *_: None)
        return output, manifest, target, stage, self.root / 'tools-error.txt'

    def test_lite_installer_reuses_matching_tools_without_settings_or_network(self):
        from peach.desktop_installer import prepare_install_tools
        output, manifest, target, stage, error = self.lite_fixture()
        with patch('peach.__version__', '1.0.0'), patch.object(update, 'download') as download, \
                patch.object(settings_file, 'load_config') as configuration:
            self.assertEqual(prepare_install_tools(target, output, error, stage=stage), 0)
        download.assert_not_called()
        configuration.assert_not_called()
        for bundle in manifest['tools'].values():
            self.assertTrue(update_packages.matches(stage, bundle['files']))
        self.assertEqual((target / 'Peach.exe').read_bytes(), b'old application')

    def test_lite_installer_can_prepare_a_fresh_install_from_verified_sidecar_archives(self):
        from peach.desktop_installer import prepare_install_tools
        output, manifest, _, stage, error = self.lite_fixture()
        target = self.root / 'fresh-install'
        with patch('peach.__version__', '1.0.0'), patch.object(update, 'download') as download:
            self.assertEqual(prepare_install_tools(target, output, error, stage=stage), 0)
        download.assert_not_called()
        self.assertFalse(target.exists())
        for bundle in manifest['tools'].values():
            self.assertTrue(update_packages.matches(stage, bundle['files']))

    def test_lite_installer_downloads_only_a_tool_that_fails_file_verification(self):
        from peach.desktop_installer import prepare_install_tools
        output, manifest, target, stage, error = self.lite_fixture()
        (target / 'tools/ffmpeg/bin/ffmpeg.exe').write_bytes(b'damaged tool')
        requests = []
        original_client = httpx.Client

        def respond(request):
            name = request.url.path.rsplit('/', 1)[-1]
            requests.append(name)
            return httpx.Response(200, content=(output / name).read_bytes())

        def client(*args, **kwargs):
            return original_client(*args, **{**kwargs, 'transport': httpx.MockTransport(respond), 'trust_env': False, 'proxy': None})

        with patch('peach.__version__', '1.0.0'), patch.object(update.httpx, 'Client', side_effect=client):
            self.assertEqual(prepare_install_tools(target, self.root / 'empty-cache', error, stage=stage), 0)
        self.assertEqual(requests, [manifest['tools']['ffmpeg']['asset']['name']])
        self.assertEqual((target / 'tools/ffmpeg/bin/ffmpeg.exe').read_bytes(), b'damaged tool')
        for bundle in manifest['tools'].values():
            self.assertTrue(update_packages.matches(stage, bundle['files']))

    def prepare_online_lite(self, outcome='github'):
        from peach.desktop_installer import prepare_install_tools
        output, manifest, _, stage, error = self.lite_fixture()
        target = self.root / 'fresh-online-install'
        requests = []
        original_client = httpx.Client

        def respond(request):
            requests.append(str(request.url))
            r2 = request.url.host == 'downloads.peach.video'
            if not r2 and outcome == 'unavailable':
                return httpx.Response(503)
            if r2 and outcome == 'github':
                raise httpx.ConnectError('R2 unavailable', request=request)
            name = request.url.path.rsplit('/', 1)[-1]
            bad = outcome == 'both-corrupt' or (not r2 and outcome == 'mismatch')
            return httpx.Response(200, content=b'corrupt' if bad else (output / name).read_bytes())

        with patch('peach.__version__', '1.0.0'), patch.object(update.httpx, 'Client', side_effect=lambda **kwargs:
                original_client(**{**kwargs, 'transport': httpx.MockTransport(respond), 'trust_env': False, 'proxy': None})):
            result = prepare_install_tools(target, self.root / 'empty-cache', error, stage=stage)
        self.assertFalse(target.exists())
        return result, requests, manifest, stage, error

    def test_lite_installer_prepares_from_github_with_no_r2_or_adjacent_archives(self):
        result, requests, manifest, stage, error = self.prepare_online_lite()
        self.assertEqual(result, 0, error.read_text(encoding='utf-8') if error.exists() else '')
        self.assertEqual(len(requests), len(update_packages.TOOL_PATHS))
        self.assertTrue(all(url.startswith('https://github.com/peach-mitao/peach/releases/download/v1.0.0/') for url in requests))
        for bundle in manifest['tools'].values():
            self.assertTrue(update_packages.matches(stage, bundle['files']))

    def test_lite_installer_uses_same_version_r2_when_github_is_unavailable(self):
        result, requests, manifest, stage, _ = self.prepare_online_lite('unavailable')
        self.assertEqual(result, 0)
        self.assertEqual(len(requests), 2 * len(update_packages.TOOL_PATHS))
        self.assertTrue(all(url.startswith('https://downloads.peach.video/v1.0.0/')
                            for url in requests[1::2]))
        for bundle in manifest['tools'].values():
            self.assertTrue(update_packages.matches(stage, bundle['files']))

    def test_lite_installer_accepts_only_the_embedded_manifest_digest_across_sources(self):
        result, requests, manifest, stage, _ = self.prepare_online_lite('mismatch')
        self.assertEqual(result, 0)
        self.assertEqual(len(requests), 2 * len(update_packages.TOOL_PATHS))
        for bundle in manifest['tools'].values():
            self.assertTrue(update_packages.matches(stage, bundle['files']))

    def test_lite_installer_rejects_both_sources_when_their_bytes_do_not_match(self):
        result, requests, manifest, stage, error = self.prepare_online_lite('both-corrupt')
        self.assertEqual(result, 1)
        self.assertEqual(len(requests), 2)
        self.assertIn('校验失败', error.read_text(encoding='utf-8'))
        self.assertFalse(update_packages.matches(stage, manifest['tools']['ffmpeg']['files']))

    def test_lite_installer_rejects_a_corrupt_archive_and_can_retry_without_touching_the_install(self):
        from peach.desktop_installer import prepare_install_tools
        output, manifest, _, stage, error = self.lite_fixture()
        target = self.root / 'existing-without-tools'
        target.mkdir()
        (target / 'Peach.exe').write_bytes(b'keep existing application')
        bad = output / manifest['tools']['ffmpeg']['asset']['name']
        valid = bad.read_bytes()
        bad.write_bytes(b'corrupt archive')
        with patch('peach.__version__', '1.0.0'), patch.object(update, 'download') as download, \
                patch('peach.desktop_installer.stop') as stop:
            self.assertEqual(prepare_install_tools(target, output, error, stage=stage), 1)
            self.assertIn('校验失败', error.read_text(encoding='utf-8'))
            bad.write_bytes(valid)
            self.assertEqual(prepare_install_tools(target, output, error, stage=stage), 0)
        download.assert_not_called()
        stop.assert_not_called()
        self.assertEqual(list(target.iterdir()), [target / 'Peach.exe'])
        self.assertEqual((target / 'Peach.exe').read_bytes(), b'keep existing application')

    def test_packaged_entry_dispatches_lite_tool_preparation(self):
        from scripts.build_app_entry import main
        with patch('peach.error_reporting.install'), patch('peach.desktop_installer.prepare_install_tools', return_value=0) as prepare:
            self.assertEqual(main(['Peach.exe', '--installer-tools', 'target', 'cache', 'error.txt']), 0)
        prepare.assert_called_once_with(Path('target'), Path('cache'), Path('error.txt'))

    def test_corrupt_tool_download_leaves_the_installed_program_and_tools_untouched(self):
        source, output, manifest, target, archive, release = self.release_fixture()
        binary = target / "tools/ffmpeg/bin/ffmpeg.exe"
        binary.write_bytes(b"old version")
        state, _ = self.prepare_fixture(target, output, release, corrupt=manifest["tools"]["ffmpeg"]["asset"]["name"])
        self.assertEqual(state["state"], "error")
        self.assertIn("校验失败", state["message"])
        self.assertEqual(binary.read_bytes(), b"old version")
        self.assertEqual((target / "Peach.exe").read_bytes(), b"old application")

    def test_manifest_rejects_path_escape_tool_scope_collision_and_incomplete_tool_files(self):
        source, output, manifest, target, archive, release = self.release_fixture()
        for name in ("../escape.exe", "tools/ffmpeg/../../Peach.exe", "Peach.exe", "tools/untrunc/untrunc.exe",
                     "tools/ffmpeg/bin/FFMPEG.exe"):
            with self.subTest(name=name):
                invalid = json.loads(json.dumps(manifest))
                invalid["tools"]["ffmpeg"]["files"][name] = "a" * 64
                (source / update_packages.MANIFEST).write_text(json.dumps(invalid), encoding="utf-8")
                with self.assertRaises(ValueError):
                    update_packages.read_manifest(source, "1.0.0")
        del manifest["tools"]["untrunc"]["files"]["tools/untrunc/untrunc.exe"]
        (source / update_packages.MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "缺少必需文件"):
            update_packages.read_manifest(source, "1.0.0")

    def test_a_tool_this_version_does_not_know_is_left_out_not_refused(self):
        """更新版本新增的工具包这一版不认得：照常更新，只是不下载它。"""
        source, output, manifest, target, archive, release = self.release_fixture()
        future = json.loads(json.dumps(manifest))
        future["tools"]["future-tool"] = {"files": {"tools/future/x.bin": "a" * 64}, "asset": {}}
        (source / update_packages.MANIFEST).write_text(json.dumps(future), encoding="utf-8")
        self.assertEqual(set(update_packages.read_manifest(source, "1.0.0")["tools"]),
                         set(update_packages.TOOL_PATHS))

    def test_a_tool_the_new_version_dropped_is_neither_prepared_nor_required(self):
        """更新版本不再需要的工具：清单里没有它就不准备，不当成清单残缺。"""
        source, output, manifest, target, archive, release = self.release_fixture()
        del manifest["tools"]["untrunc"]
        (source / update_packages.MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")
        self.assertEqual(set(update_packages.read_manifest(source, "1.0.0")["tools"]),
                         set(update_packages.TOOL_PATHS) - {"untrunc"})

    def test_an_update_package_this_updater_cannot_use_falls_back_to_the_full_package(self):
        source, output, manifest, target, archive, release = self.release_fixture()
        full = output / "Peach-1.0.0-windows-x64.zip"
        release.update(full_url=release["asset_url"].rsplit("/", 1)[0] + "/" + full.name,
                       full_size=full.stat().st_size, full_digest="sha256:" + update_packages.digest(full))
        (target / "cloudflared.exe").unlink()
        with patch.object(update.update_packages, "read_manifest", side_effect=UserValueError("errors.updatePackages.manifestInvalid")):
            state, requests = self.prepare_fixture(target, output, release)
        self.assertEqual(state["state"], "ready", state)
        self.assertEqual(requests, [archive.name, full.name], "清单读不了时不再下单个工具包")
        self.assertEqual(Path(state["stage"]), Path(state["transaction"]) / "stage" / "Peach")
        for bundle in manifest["tools"].values():
            self.assertTrue(update_packages.matches(Path(state["stage"]), bundle["files"]))
        self.assertEqual(state["downloaded"], state["total"])
        self.assertEqual((target / "Peach.exe").read_bytes(), b"old application")

    def sign_output(self, output):
        """像发布作业那样给发布目录写 `sha256sum` 摘要与签名；返回受信任公钥。"""
        private = base64.b64encode(Ed25519PrivateKey.generate().private_bytes(
            Encoding.Raw, PrivateFormat.Raw, NoEncryption())).decode("ascii")
        sums = "".join(f"{update_packages.digest(path)}  ./{path.name}\n" for path in sorted(output.glob("*.zip")))
        (output / release_signing.SUMS).write_bytes(sums.encode())
        (output / release_signing.SIGNATURE).write_bytes(release_signing.sign(sums.encode(), private).encode())
        return release_signing.public_key(private)

    def test_signed_release_installs_after_the_sums_signature_verifies(self):
        source, output, manifest, target, archive, release = self.release_fixture()
        public = self.sign_output(output)
        with patch.object(update.release_signing, "PUBLIC_KEYS", (public,)):
            state, requests = self.prepare_fixture(target, output, release)
        self.assertEqual(state["state"], "ready", state)
        self.assertEqual(requests[:3], [release_signing.SUMS, release_signing.SIGNATURE, archive.name])

    def test_a_package_swapped_together_with_its_listed_digest_is_refused(self):
        source, output, manifest, target, archive, release = self.release_fixture()
        public = self.sign_output(output)
        # 渠道被篡改：发布记录里的摘要与大小跟着替换后的包一起改了，只有签过名的摘要还是原来的。
        release.update(asset_size=len(b"corrupt"), asset_digest="sha256:" + hashlib.sha256(b"corrupt").hexdigest())
        with patch.object(update.release_signing, "PUBLIC_KEYS", (public,)):
            state, requests = self.prepare_fixture(target, output, release, corrupt=archive.name)
        self.assertEqual(state["state"], "error", state)
        self.assertIn("校验失败", state["message"])
        self.assertEqual((target / "Peach.exe").read_bytes(), b"old application")

    def test_missing_or_untrusted_signature_stops_before_any_download(self):
        for case in ("missing", "untrusted"):
            with self.subTest(case=case):
                source, output, manifest, target, archive, release = self.release_fixture()
                public = self.sign_output(output)
                if case == "missing":
                    (output / release_signing.SIGNATURE).unlink()
                else:
                    self.sign_output(output)  # 换一把客户端不认得的私钥重签
                with patch.object(update.release_signing, "PUBLIC_KEYS", (public,)):
                    state, requests = self.prepare_fixture(target, output, release)
                self.assertEqual(state["state"], "error", state)
                self.assertIn("发布签名校验未通过", state["message"])
                self.assertNotIn(archive.name, requests)
                self.assertEqual(list(target.parent.glob(f".{target.name}-update-*")), [])
                self.assertEqual((target / "Peach.exe").read_bytes(), b"old application")
                for folder in (self.root / "dist", output, target):
                    shutil.rmtree(folder)

    def test_supported_older_clients_can_install_this_release(self):
        """旧版本标签里的更新代码原样读这一版的发布条目与更新包（ADR-0120）。"""
        from scripts import update_compat
        source, output, manifest, target, archive, release = self.release_fixture()
        self.assertEqual(update_compat.verify(output, "1.0.0"), {})
        rows = [update_compat.release_row(output, "1.0.0")]
        strict = update_compat.check_clients(update_compat.ROOT, rows, manifest, "1.0.0", oldest="0.47.3")
        self.assertIn("更新包工具清单无效", " ".join(strict["v0.47.3"]),
                      "0.47.x 要求工具集合完全相等，人脸模型加入后它读不了更新包")
        future = json.loads(json.dumps(manifest))
        future["tools"]["future-tool"] = {"files": {"tools/future/x.bin": "a" * 64}, "asset": {}}
        orphaned = update_compat.check_clients(update_compat.ROOT, rows, future, "1.0.0")
        self.assertTrue(orphaned)
        for reasons in orphaned.values():
            self.assertIn("future-tool", " ".join(reasons), "新增工具旧版不认得、又没登记为运行时补齐时拒绝发布")

    def test_tool_archive_cannot_replace_application_files(self):
        archive = self.archive(["Peach/tools/ffmpeg/bin/ffmpeg.exe", "Peach/Peach.exe"])
        with self.assertRaisesRegex(ValueError, "清单外"):
            update.extract(archive, self.root / "tool-stage", Mock(), tool_files={"tools/ffmpeg/bin/ffmpeg.exe"})

    def test_install_failure_restores_program_directory_and_preserves_data(self):
        target = self.root / "app"; target.mkdir()
        (target / "Peach.exe").write_text("old")
        (target / "_internal").mkdir()
        (target / "_internal" / "standalone.txt").touch()
        transaction = self.root / ".app-update-fixture"; transaction.mkdir()
        stage = transaction / "stage" / "Peach"; stage.mkdir(parents=True)
        (stage / "Peach.exe").write_text("new")
        update.write({"id":"fixture", "target":str(target), "transaction":str(transaction), "stage":str(stage), "version":"1.0.0"}, state="restarting")
        original = update.replace_with_retry
        def replace(source, destination):
            if source == stage:
                raise OSError("occupied")
            original(source, destination)
        with patch("peach.windows_restart.process_alive", return_value=False), patch.object(
                update, "replace_with_retry", side_effect=replace), patch("peach.windows_restart.start_tray") as start:
            self.assertEqual(update.apply(update.state_path(), 999), 1)
        self.assertEqual((target / "Peach.exe").read_text(), "old")
        self.assertEqual(update.public()["state"], "error")
        start.assert_called_once_with(target / "Peach.exe")
        self.assertTrue(self.state.is_dir())

    def test_migration_failure_can_restore_the_sqlite_backup(self):
        with update.closing(sqlite3.connect(self.database)) as connection, connection:
            connection.execute("CREATE TABLE fixture(value TEXT)")
            connection.execute("INSERT INTO fixture VALUES ('original')")
        data = {"id":"migration-fixture"}
        def failed_migration(*args, **kwargs):
            with update.closing(sqlite3.connect(self.database)) as connection, connection:
                connection.execute("UPDATE fixture SET value='changed'")
            return Mock(returncode=1)
        with patch("peach.migrations.plan",return_value=([],[object()])), patch.object(
                update.subprocess,"run",side_effect=failed_migration):
            with self.assertRaises(RuntimeError):
                update.migrate_database(self.root,data)
        update.restore_database(data)
        with update.closing(sqlite3.connect(self.database)) as connection:
            self.assertEqual(connection.execute("SELECT value FROM fixture").fetchone()[0],"original")

    def test_install_state_restore_preserves_settings_checkpoints_and_absence(self):
        self.config.path.write_text('original config', encoding='utf-8')
        recovery = self.state / 'job-recovery'
        recovery.mkdir()
        (recovery / 'job.json').write_text('saved checkpoint', encoding='utf-8')
        update.preserve_local_state({'id':'state-fixture'})
        self.config.path.write_text('changed config', encoding='utf-8')
        (recovery / 'job.json').write_text('changed checkpoint', encoding='utf-8')
        repairs = self.state / 'upgrade-repairs'
        repairs.mkdir()
        (repairs / 'receipt.json').write_text('new receipt', encoding='utf-8')
        update.restore_local_state({'id':'state-fixture'})
        self.assertEqual(self.config.path.read_text(encoding='utf-8'), 'original config')
        self.assertEqual((recovery / 'job.json').read_text(encoding='utf-8'), 'saved checkpoint')
        self.assertFalse(repairs.exists())

    def transaction(self, ident, *parts):
        directory = self.root / f'.app-update-{ident}'
        for part in parts:
            (directory / part).mkdir(parents=True, exist_ok=True)
        return directory

    def test_a_finished_update_removes_its_transaction_and_older_finished_ones(self):
        target = self.root / 'app'; (target / '_internal').mkdir(parents=True)
        current, older, failed, pending = (f'{n}' * 32 for n in 'abcd')
        installed = self.transaction(current, 'backup/_internal', 'helper/_internal', 'stage', 'tool-ffmpeg')
        (installed / 'package.zip').write_bytes(b'zip')
        (installed / 'helper/Peach.exe').write_text('old', encoding='utf-8')
        previous = self.transaction(older, 'backup', 'helper')
        rolled_back = self.transaction(failed, 'failed', 'helper')
        unfinished = self.transaction(pending, 'backup', 'stage/Peach')
        not_ours = self.transaction('fixture', 'backup')
        (self.root / 'Peach Media').mkdir()
        backups = self.state / 'update-backups'
        for age, ident in enumerate((current, older, failed, 'e' * 32)):
            (backups / ident).mkdir(parents=True)
            (backups / ident / 'ledger.db').write_bytes(b'db')
            os.utime(backups / ident, (1_000_000 - age * 1000,) * 2)
        (backups / 'fixture').mkdir()
        update.write({'id': current, 'version': update.__version__}, state='complete')
        with patch.object(update.sys, 'executable', str(target / 'Peach.exe')), patch.object(
                update, '_running_from', return_value=False):
            self.assertFalse(update.sweep())
        self.assertFalse(installed.exists())
        self.assertFalse(previous.exists())
        for kept in (rolled_back, unfinished, not_ours, target, self.root / 'Peach Media'):
            self.assertTrue(kept.is_dir(), kept)
        self.assertEqual(sorted(path.name for path in backups.iterdir()), sorted([current, older, 'fixture']))

    def test_cleanup_waits_while_an_update_runs_or_its_helper_is_still_alive(self):
        target = self.root / 'app'; target.mkdir()
        ident = 'f' * 32
        installed = self.transaction(ident, 'backup', 'helper')
        with patch.object(update.sys, 'executable', str(target / 'Peach.exe')):
            for state in ('installing', 'ready'):
                update.write({'id': ident, 'version': update.__version__}, state=state)
                with patch.object(update, '_running_from', return_value=False):
                    self.assertTrue(update.sweep(), state)
            update.write({'id': ident, 'version': update.__version__}, state='complete')
            with patch.object(update, '_running_from', return_value=True):
                self.assertTrue(update.sweep())
            self.assertTrue(installed.is_dir())
            for state, version in (('error', update.__version__), ('complete', '0.0.0')):
                update.write({'id': ident, 'version': version}, state=state)
                with patch.object(update, '_running_from', return_value=False):
                    self.assertFalse(update.sweep())
                self.assertTrue(installed.is_dir(), state)

    def test_tray_poll_starts_the_cleanup_once_in_the_background(self):
        tray = Mock()
        update.write({'id': 'a' * 32}, state='complete')
        with patch.object(update.distribution, 'standalone', return_value=True), patch.object(
                update, '_sweep_started', update.threading.Event()), patch.object(update.threading, 'Thread') as thread:
            update.poll(tray)
            update.poll(tray)
        thread.assert_called_once()
        self.assertEqual(thread.call_args.kwargs['target'], update._sweep_in_background)
        thread.return_value.start.assert_called_once_with()

    def test_running_installation_is_detected_by_the_current_executable_and_version(self):
        target = self.root / 'app'
        with patch.object(update.distribution, 'standalone', return_value=True), patch.object(
                update.sys, 'executable', str(target / 'Peach.exe')):
            update.write({'target':str(target), 'version':update.__version__}, state='installing')
            self.assertTrue(update.installation_pending())
            update.write(update.read(), state='complete')
            self.assertFalse(update.installation_pending())
            update.write({'target':str(target), 'version':'0.0.0'}, state='installing')
            self.assertFalse(update.installation_pending())
