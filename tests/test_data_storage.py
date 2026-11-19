"""数据目录的占用统计、缓存清理与整体迁移。"""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from peach import data_storage, distribution, settings_file
from peach.user_messages import UserValueError


def write(path: Path, size: int = 10) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x" * size)
    return path


def make_ledger(path: Path, *, snapshot: str | None = None, evidence: str | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.execute("CREATE TABLE asset (id INTEGER PRIMARY KEY, snapshot_path TEXT)")
    connection.execute("CREATE TABLE follow_item (id INTEGER PRIMARY KEY, evidence_path TEXT)")
    connection.execute("INSERT INTO asset (snapshot_path) VALUES (?), (?), (NULL)", (snapshot, r"R:\elsewhere\a.jpg"))
    connection.execute("INSERT INTO follow_item (evidence_path) VALUES (?)", (evidence,))
    connection.commit()
    connection.close()
    return path


class DataStorageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name).resolve()
        self.data = self.base / "old" / "peach-data"
        write(self.data / "config.toml", 0)
        self.program = self.base / "Peach"
        self.program.mkdir()

    def config(self, root: Path | None = None):
        return settings_file.load_config(environ={settings_file.DATA_ROOT_ENV: str(root or self.data)})

    def test_measure_sorts_files_into_categories_and_counts_what_cleaning_frees(self):
        make_ledger(self.data / "database" / "ledger.db")
        old = write(self.data / "database" / "ledger.pre-migrate-20260101-000000.db", 100)
        os.utime(old, (time.time() - 7200, time.time() - 7200))
        write(self.data / "database" / "ledger.pre-script-20260102-000000.db", 100)
        write(self.data / "generated" / "organize-backups" / "ledger.pre-download-1-20260101-000000.db", 50)
        write(self.data / "generated" / "transcodes" / "12-main.mp4", 30)
        write(self.data / "generated" / "transcodes" / "12-main.mp4hdr", 7)
        write(self.data / "generated" / "stream-segments" / "12" / "0001.ts", 20)
        write(self.data / "generated" / "cover-thumbs" / "ABC-001.jpg", 5)
        write(self.data / "generated" / "snapshots" / "local" / "aa" / "x.jpg", 40)
        write(self.data / "generated" / "covers" / "ABC-001.jpg", 60)
        write(self.data / "generated" / "review.csv", 3)
        write(self.data / "sources" / "taste-history" / "history.sqlite", 9)
        write(self.data / "logs" / "tray.log", 4)
        write(self.data / "logs" / "tray.until-20260101.log", 6)
        write(self.data / "logs" / "crash-123.log", 2)
        write(self.data / "state" / "job-recovery" / "scan.json", 11)
        write(self.data / "review" / "names.csv", 12)
        write(self.data / "archive" / "old.csv", 13)
        write(self.data / "tools" / "ffmpeg" / "ffmpeg.exe", 14)
        write(self.data / "secrets" / "auth-token", 15)
        reports = []

        with patch.object(data_storage, "REPORT_INTERVAL", 0):
            usage = data_storage.measure(self.config(), report=lambda files, size: reports.append((files, size)))
        groups = usage["categories"]

        self.assertEqual(groups["records"], {"bytes": 36, "files": 3, "reclaimable": 0})
        self.assertEqual(groups["tools"]["bytes"], 14)
        self.assertEqual(groups["accounts"]["bytes"], 15)
        self.assertTrue(reports)
        self.assertEqual(reports, sorted(reports))
        self.assertLessEqual(reports[-1][0], usage["total_files"])

        self.assertEqual(groups["backups"]["bytes"], 250)
        self.assertEqual(groups["backups"]["reclaimable"], 100)
        self.assertEqual(groups["playback"]["bytes"], 57)
        self.assertEqual(groups["playback"]["reclaimable"], 50)
        self.assertEqual(groups["thumbnails"], {"bytes": 5, "files": 1, "reclaimable": 5})
        self.assertEqual(groups["previews"]["bytes"], 40)
        self.assertEqual(groups["downloads"]["bytes"], 60)
        self.assertEqual(groups["sources"]["bytes"], 9)
        self.assertEqual(groups["logs"], {"bytes": 12, "files": 3, "reclaimable": 8})
        self.assertEqual(groups["downloads"]["reclaimable"], 0)
        self.assertEqual(usage["total_files"], sum(item["files"] for item in groups.values()))
        self.assertEqual(usage["root"], str(self.data))

    def test_cleaning_removes_only_rebuildable_files(self):
        config = self.config()
        write(self.data / "generated" / "transcodes" / "12-main.mp4", 30)
        header = write(self.data / "generated" / "transcodes" / "12-main.mp4hdr", 7)
        write(self.data / "generated" / "stream-segments" / "12" / "0001.ts", 20)
        live_log = write(self.data / "logs" / "tray.log", 4)
        write(self.data / "logs" / "tray.until-20260101.log", 6)

        self.assertEqual(data_storage.clean(config, "playback"), {"files": 2, "bytes": 50, "failed": 0})
        self.assertEqual(data_storage.clean(config, "logs"), {"files": 1, "bytes": 6, "failed": 0})
        self.assertTrue(header.is_file())
        self.assertTrue(live_log.is_file())
        self.assertEqual(list((self.data / "generated" / "stream-segments").iterdir()), [])
        with self.assertRaises(ValueError):
            data_storage.clean(config, "downloads")

    def test_cleaning_backups_keeps_the_newest_one_in_each_directory(self):
        make_ledger(self.data / "database" / "ledger.db")
        names = [("database", "ledger.pre-a-20260101-000000.db"), ("database", "ledger.pre-b-20260102-000000.db"),
                 ("generated/organize-backups", "ledger.pre-download-1-20260101-000000.db"),
                 ("generated/organize-backups", "ledger.pre-download-2-20260102-000000.db")]
        for index, (folder, name) in enumerate(names):
            path = write(self.data / folder / name, 10)
            os.utime(path, (time.time() - 1000 + index, time.time() - 1000 + index))

        result = data_storage.clean(self.config(), "backups")

        self.assertEqual(result["files"], 2)
        self.assertEqual(sorted(path.name for path in (self.data / "database").glob("ledger.pre-*")),
                         ["ledger.pre-b-20260102-000000.db"])
        self.assertEqual([path.name for path in (self.data / "generated/organize-backups").iterdir()],
                         ["ledger.pre-download-2-20260102-000000.db"])

    def test_target_must_be_a_separate_empty_folder(self):
        config = self.config()
        cases = {
            str(self.data): "相同或互相包含",
            str(self.data / "inner"): "相同或互相包含",
            str(self.program / "data"): "程序目录",
            str(Path(self.base.anchor)): "磁盘根目录",
            "relative\\path": "",
        }
        for raw, reason in cases.items():
            with self.subTest(raw=raw), self.assertRaisesRegex(ValueError, reason):
                data_storage.check_target(config, raw, program=self.program)
        busy = write(self.base / "busy" / "file.txt").parent
        with self.assertRaisesRegex(ValueError, "空文件夹"):
            data_storage.check_target(config, str(busy), program=self.program)
        media = replace(config, locations={"local": (str(self.base / "media"),)})
        with self.assertRaisesRegex(ValueError, "媒体目录"):
            data_storage.check_target(media, str(self.base / "media" / "peach"), program=self.program)
        vacated = write(self.base / "vacated" / "state" / settings_file.DATA_ROOT_LOCATION).parents[1]
        self.assertEqual(data_storage.check_target(config, str(vacated), program=self.program), vacated)
        self.assertEqual(data_storage.check_target(config, str(self.base / "new" / "peach-data"), program=self.program),
                         self.base / "new" / "peach-data")

    def test_rename_moves_everything_rewrites_ledger_paths_and_points_both_locators(self):
        snapshot = str(self.data / "generated" / "snapshots" / "local" / "aa" / "x.jpg")
        evidence = str(self.data / "sources" / "follow" / "page.html")
        # 路径比较按本机 normcase：折叠大小写的系统上，账本里换了大小写的旧路径也要认出来。
        folds_case = os.path.normcase("A") == "a"
        make_ledger(self.data / "database" / "ledger.db",
                    snapshot=snapshot.upper() if folds_case else snapshot, evidence=evidence)
        write(self.data / "generated" / "covers" / "ABC-001.jpg")
        bootstrap = self.base / "default" / "peach-data"
        target = self.base / "new" / "peach-data"

        copied = data_storage.relocate(self.config(), target, bootstrap=bootstrap)

        self.assertFalse(copied)
        self.assertTrue((target / "generated" / "covers" / "ABC-001.jpg").is_file())
        for root in (bootstrap, self.data):
            self.assertEqual((root / "state" / settings_file.DATA_ROOT_LOCATION).read_text(encoding="utf-8"), str(target))
        self.assertEqual(settings_file.discover_data_root(environ={settings_file.DATA_ROOT_ENV: str(self.data)}),
                         (target, True))
        connection = sqlite3.connect(target / "database" / "ledger.db")
        paths = [row[0] for row in connection.execute("SELECT snapshot_path FROM asset ORDER BY id")]
        evidence_path = connection.execute("SELECT evidence_path FROM follow_item").fetchone()[0]
        connection.close()
        self.assertEqual(os.path.normcase(paths[0]),
                         os.path.normcase(str(target / "generated" / "snapshots" / "local" / "aa" / "x.jpg")))
        self.assertEqual(paths[1:], [r"R:\elsewhere\a.jpg", None])
        self.assertEqual(evidence_path, str(target / "sources" / "follow" / "page.html"))

    def test_moving_back_to_the_default_location_leaves_no_loop(self):
        bootstrap = self.base / "default" / "peach-data"
        write(bootstrap / "state" / settings_file.DATA_ROOT_LOCATION).write_text(str(self.data), encoding="utf-8")
        make_ledger(self.data / "database" / "ledger.db")

        data_storage.relocate(self.config(), bootstrap, bootstrap=bootstrap)

        self.assertFalse((bootstrap / "state" / settings_file.DATA_ROOT_LOCATION).exists())
        self.assertEqual(settings_file.discover_data_root(environ={settings_file.DATA_ROOT_ENV: str(bootstrap)}),
                         (bootstrap, True))
        self.assertEqual(settings_file.discover_data_root(environ={settings_file.DATA_ROOT_ENV: str(self.data)}),
                         (bootstrap, True))

    def test_cold_start_finds_a_default_data_root_renamed_before_the_locators_were_written(self):
        snapshot = self.data / "generated" / "snapshots" / "preview.jpg"
        make_ledger(self.data / "database" / "ledger.db", snapshot=str(snapshot))
        write(snapshot)
        target = self.base / "new" / "peach-data"
        config = self.config()

        def interrupt_after_rename(source, destination):
            os.rename(source, destination)
            raise KeyboardInterrupt

        with patch.object(data_storage, "_rename", side_effect=interrupt_after_rename), \
                self.assertRaises(KeyboardInterrupt):
            data_storage.relocate(config, target, bootstrap=self.data)
        self.assertFalse(self.data.exists())
        self.assertTrue((target / "config.toml").is_file())

        with patch.object(distribution, "standalone", return_value=False):
            cold = settings_file.load_config(project_root=self.data.parent / "Peach", environ={})
        self.assertEqual(cold.data_root, target)
        self.assertEqual(self.config().data_root, target)
        database = target / "database" / "ledger.db"
        connection = sqlite3.connect(database)
        try:
            path = connection.execute("SELECT snapshot_path FROM asset WHERE id=1").fetchone()[0]
        finally:
            connection.close()
        self.assertEqual(path, str(target / snapshot.relative_to(self.data)))
        self.assertTrue(Path(path).is_file())
        self.assertFalse(settings_file.relocation_record(self.data).exists())
        self.assertFalse(settings_file.relocation_record(target).exists())

    def test_locator_write_failure_restarts_from_the_new_root_and_recovers_on_cold_start(self):
        make_ledger(self.data / "database" / "ledger.db")
        bootstrap = self.base / "default" / "peach-data"
        target = self.base / "new" / "peach-data"
        request = self.request_file(target)
        started = []
        original_write = data_storage.atomic_write_text

        def fail_default_locator(path, text, **kwargs):
            if path == bootstrap / "state" / settings_file.DATA_ROOT_LOCATION:
                raise PermissionError("locator write was refused")
            return original_write(path, text, **kwargs)

        with patch.object(data_storage, "atomic_write_text", side_effect=fail_default_locator), \
                patch.object(data_storage, "_startup", return_value=None), \
                patch.object(data_storage, "_bootstrap", return_value=bootstrap), \
                self.assertLogs("peach.data_storage", "WARNING"):
            code = data_storage.apply(request, None, environ={}, start=lambda _exe, env: started.append(env))
        self.assertEqual(code, 0)
        self.assertEqual(started[0][settings_file.DATA_ROOT_ENV], str(target))
        self.assertFalse(self.data.exists())
        self.assertTrue(settings_file.relocation_record(bootstrap).is_file())
        self.assertTrue((target / "database" / "ledger.db").is_file())

        with patch.object(distribution, "standalone", return_value=False):
            cold = settings_file.load_config(project_root=bootstrap.parent / "Peach", environ={})
        self.assertEqual(cold.data_root, target)
        self.assertEqual(self.config().data_root, target)
        self.assertEqual(data_storage.read_result(cold)["state"], "done")
        self.assertEqual((bootstrap / "state" / settings_file.DATA_ROOT_LOCATION).read_text(encoding="utf-8"),
                         str(target))
        self.assertFalse(settings_file.relocation_record(bootstrap).exists())

    def test_incomplete_copy_is_discarded_and_the_source_stays_in_use(self):
        make_ledger(self.data / "database" / "ledger.db")
        write(self.data / "generated" / "covers" / "ABC-001.jpg")
        target = self.base / "other-disk" / "peach-data"

        def lossy(source, destination):
            shutil.copytree(source, destination, dirs_exist_ok=True)
            (destination / "generated" / "covers" / "ABC-001.jpg").unlink()

        with patch.object(data_storage, "_same_volume", return_value=False), \
                self.assertRaisesRegex(RuntimeError, "复制结果不完整"):
            data_storage.relocate(self.config(), target, bootstrap=self.base / "default", copy=lossy)

        self.assertFalse(target.exists())
        self.assertTrue((self.data / "generated" / "covers" / "ABC-001.jpg").is_file())
        self.assertFalse((self.data / "state" / settings_file.DATA_ROOT_LOCATION).exists())

    def test_copy_rechecks_free_space_with_the_actual_size(self):
        write(self.data / "generated" / "covers" / "ABC-001.jpg", 4096)
        target = self.base / "other-disk" / "peach-data"
        copy = Mock()
        with patch.object(data_storage, "_same_volume", return_value=False), \
                patch.object(data_storage.shutil, "disk_usage", return_value=SimpleNamespace(free=10)), \
                self.assertRaisesRegex(ValueError, "剩余"):
            data_storage.relocate(self.config(), target, bootstrap=self.base / "default", copy=copy)
        copy.assert_not_called()
        self.assertFalse(target.exists())

    def test_a_rename_that_cannot_be_undone_still_points_to_the_new_location(self):
        make_ledger(self.data / "database" / "ledger.db")
        target = self.base / "new" / "peach-data"
        calls = []

        def rename_once(source, destination):
            calls.append(destination)
            if len(calls) > 1:
                raise OSError("Access is denied")
            os.rename(source, destination)

        with patch.object(data_storage, "rewrite_ledger_paths", side_effect=RuntimeError("database is locked")), \
                patch.object(data_storage, "_rename", side_effect=rename_once), \
                self.assertRaisesRegex(data_storage.MovedWithoutRewrite, "database is locked"):
            data_storage.relocate(self.config(), target, bootstrap=self.base / "default")
        self.assertTrue((target / "database" / "ledger.db").is_file())
        self.assertEqual((self.base / "default" / "state" / settings_file.DATA_ROOT_LOCATION).read_text(encoding="utf-8"),
                         str(target))

    def test_copied_source_is_emptied_except_its_locator(self):
        make_ledger(self.data / "database" / "ledger.db")
        write(self.data / "generated" / "covers" / "ABC-001.jpg")
        write(self.data / "state" / "follow.json")
        target = self.base / "other-disk" / "peach-data"
        with patch.object(data_storage, "_same_volume", return_value=False):
            copied = data_storage.relocate(self.config(), target, bootstrap=self.data,
                                           copy=lambda source, destination: shutil.copytree(
                                               source, destination, dirs_exist_ok=True))
        self.assertTrue(copied)
        self.assertEqual(data_storage.remove_source(self.data), 0)
        self.assertEqual([path.relative_to(self.data).as_posix() for path in self.data.rglob("*") if path.is_file()],
                         [f"state/{settings_file.DATA_ROOT_LOCATION}"])
        self.assertTrue((target / "state" / "follow.json").is_file())

    def request_file(self, target: Path) -> Path:
        path = self.data / "state" / data_storage.REQUEST_NAME
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"source": str(self.data), "target": str(target), "token": "",
                                    "requested_at": time.time()}), encoding="utf-8")
        return path

    def test_helper_moves_the_data_restarts_the_tray_on_the_new_location_and_records_it(self):
        make_ledger(self.data / "database" / "ledger.db")
        target = self.base / "new" / "peach-data"
        request = self.request_file(target)
        started = []
        with patch.object(data_storage, "_startup", return_value=None), \
                patch("peach.windows_restart.process_alive", return_value=False), \
                patch.object(data_storage, "_bootstrap", return_value=self.base / "default" / "peach-data"):
            code = data_storage.apply(request, 1, environ={}, start=lambda exe, env: started.append(env))

        self.assertEqual(code, 0)
        self.assertEqual(started[0][settings_file.DATA_ROOT_ENV], str(target))
        result = data_storage.read_result(self.config(target))
        self.assertEqual((result["state"], result["target"]), ("done", str(target)))
        self.assertFalse((target / "state" / data_storage.REQUEST_NAME).exists())

    def test_helper_failure_keeps_the_old_location_and_explains_why(self):
        make_ledger(self.data / "database" / "ledger.db")
        busy = write(self.base / "busy" / "file.txt").parent
        request = self.request_file(busy)
        started = []
        with patch.object(data_storage, "_startup", return_value=None), \
                patch("peach.windows_restart.process_alive", return_value=False), \
                patch.object(data_storage, "_bootstrap", return_value=self.base / "default" / "peach-data"):
            code = data_storage.apply(request, 1, environ={}, start=lambda exe, env: started.append(env))

        self.assertEqual(code, 1)
        self.assertEqual(started[0][settings_file.DATA_ROOT_ENV], str(self.data))
        result = data_storage.read_result(self.config())
        self.assertEqual(result["state"], "error")
        self.assertIn("仍在原位置", result["message"])
        self.assertFalse(request.exists())

    def test_request_needs_a_measurement_and_room_on_the_target_disk(self):
        from peach.storage_budget import layout
        config = self.config()
        target = self.base / "new" / "peach-data"
        with patch.object(data_storage, "blocked", return_value=""), \
                patch("peach.standalone_update.public", return_value={"state": "idle"}):
            with self.assertRaisesRegex(ValueError, "请先统计"):
                data_storage.request(config, str(target))
            (self.data / "state").mkdir(exist_ok=True)
            (self.data / "state" / data_storage.USAGE_NAME).write_text(json.dumps(
                {"root": str(self.data), "total_bytes": 1 << 50,
                 "layout": layout(config)}), encoding="utf-8")
            with patch.object(data_storage, "_same_volume", return_value=False), \
                    self.assertRaisesRegex(ValueError, "剩余"):
                data_storage.request(config, str(target))
            receipt = data_storage.request(config, str(target))
        self.assertTrue(receipt["accepted"])
        written = json.loads((self.data / "state" / data_storage.REQUEST_NAME).read_text(encoding="utf-8"))
        self.assertEqual((written["source"], written["target"]), (str(self.data), str(target)))

    def availability_with(self, **environ):
        names = ("PEACH_DISTRIBUTION", "PEACH_TRAY_MANAGED", "PEACH_HEADLESS_MANAGED")
        clean = {key: value for key, value in os.environ.items() if key not in names}
        with patch.object(distribution, "standalone", return_value=False), \
                patch.dict(os.environ, {**clean, **environ}, clear=True):
            return data_storage.availability(self.config()), data_storage.manual_steps()

    def test_tray_and_headless_services_can_relocate_from_the_settings_page(self):
        for marker in ("PEACH_TRAY_MANAGED", "PEACH_HEADLESS_MANAGED"):
            with self.subTest(marker):
                (available, message), steps = self.availability_with(**{marker: "1"})
                self.assertEqual((available, message, steps), (True, "", []))

    def test_a_directly_started_service_explains_how_to_relocate(self):
        (available, message), steps = self.availability_with()
        self.assertFalse(available)
        self.assertIn("PEACH_DATA_ROOT", message)
        self.assertEqual(steps, [])

    def test_containers_get_host_side_steps_instead_of_a_relocation(self):
        (available, message), steps = self.availability_with(PEACH_DISTRIBUTION="docker", PEACH_HEADLESS_MANAGED="1")
        self.assertFalse(available)
        self.assertIn("宿主机", message)
        self.assertEqual([step["command"] for step in steps][1:2], ["docker compose down"])
        self.assertIn("<新文件夹>:/data", steps[-1]["text"])

    def test_relocation_never_redirects_another_live_data_directory(self):
        make_ledger(self.data / "database" / "ledger.db")
        other = self.base / "default" / "peach-data"
        write(other / "config.toml", 0)
        target = self.base / "new" / "peach-data"

        data_storage.relocate(self.config(), target, bootstrap=other)

        self.assertFalse((other / "state" / settings_file.DATA_ROOT_LOCATION).exists())
        self.assertEqual((self.data / "state" / settings_file.DATA_ROOT_LOCATION).read_text(encoding="utf-8"),
                         str(target))

    def test_headless_supervisor_stops_the_service_moves_the_data_and_restarts_there(self):
        make_ledger(self.data / "database" / "ledger.db")
        target = self.base / "new" / "peach-data"
        request = self.request_file(target)
        stopped, restarted = [], []
        original = settings_file.load_config

        def load(environ=None):
            # 看守进程自己读设置时还在原位置；助手读新旧两处时给的是显式环境。
            return original(environ=environ if environ is not None else {settings_file.DATA_ROOT_ENV: str(self.data)})

        with patch.object(settings_file, "load_config", side_effect=load), \
                patch.object(data_storage, "_startup", return_value=None), \
                patch.object(data_storage, "_bootstrap", return_value=self.base / "default" / "peach-data"), \
                patch("peach.update_tasks.reserve", return_value="token-1"), \
                patch("peach.update_tasks.wait_quiescent", return_value=True), \
                patch("peach.update_tasks.release"):
            handled = data_storage.poll_headless(lambda: stopped.append(True), restarted.append)

        self.assertTrue(handled)
        self.assertEqual(stopped, [True])
        self.assertEqual(restarted[0][settings_file.DATA_ROOT_ENV], str(target))
        self.assertFalse(request.exists())
        self.assertEqual(data_storage.read_result(self.config(target))["state"], "done")

    def tray(self):
        return SimpleNamespace(_action_lock=threading.Lock(), icon=Mock(), exit=Mock())

    def poll_with(self, tray, popen):
        config = self.config()
        with patch.object(distribution, "standalone", return_value=True), \
                patch.object(settings_file, "load_config", return_value=config), \
                patch("peach.update_tasks.reserve", return_value="token-1"), \
                patch("peach.update_tasks.wait_quiescent", return_value=True), \
                patch("peach.update_tasks.transfer") as transfer, \
                patch("peach.update_tasks.release") as release, \
                patch.object(data_storage.subprocess, "Popen", popen):
            data_storage.poll(tray)
        return transfer, release

    @unittest.skipUnless(sys.platform == "win32", "安装版助手的命令按 Windows 的 Peach.exe 写")
    def test_tray_hands_the_request_to_the_helper_and_exits(self):
        target = self.base / "new" / "peach-data"
        request = self.request_file(target)
        tray = self.tray()
        popen = Mock(return_value=SimpleNamespace(pid=4321))

        transfer, release = self.poll_with(tray, popen)

        argv = popen.call_args.args[0]
        self.assertEqual(argv[1:], [data_storage.HELPER_FLAG, str(request), str(os.getpid())])
        self.assertTrue(argv[0].endswith("Peach.exe"))
        self.assertEqual(json.loads(request.read_text(encoding="utf-8"))["token"], "token-1")
        transfer.assert_called_once()
        self.assertEqual(transfer.call_args.args[1:], ("token-1", 4321))
        release.assert_not_called()
        tray.exit.assert_called_once_with(reason="data-relocation")
        self.assertFalse(tray._action_lock.locked())

    @unittest.skipUnless(sys.platform == "win32", "安装版助手的命令按 Windows 的 Peach.exe 写")
    def test_tray_failure_releases_the_reservation_and_keeps_running(self):
        request = self.request_file(self.base / "new" / "peach-data")
        tray = self.tray()

        _transfer, release = self.poll_with(tray, Mock(side_effect=OSError("Peach.exe not found")))

        release.assert_called_once()
        self.assertEqual(release.call_args.args[1], "token-1")
        self.assertFalse(request.exists())
        tray.exit.assert_not_called()
        result = data_storage.read_result(self.config())
        self.assertEqual(result["state"], "error")
        self.assertIn("Peach.exe not found", result["message"])

    def test_storage_routes_validate_categories_and_report_target_errors_by_field(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from peach import routes_configuration
        from peach.routes_auth import require_auth
        app = FastAPI()
        app.include_router(routes_configuration.router)
        app.dependency_overrides[require_auth] = lambda: None
        config = self.config()
        with TestClient(app, base_url="http://127.0.0.1", client=("127.0.0.1", 123)) as client, \
                patch.object(settings_file, "load_config", return_value=config), \
                patch.object(data_storage, "blocked", return_value=""), \
                patch("peach.standalone_update.public", return_value={"state": "idle"}):
            snapshot = client.get("/api/configuration/storage").json()
            self.assertEqual((snapshot["data_root"], snapshot["usage"]), (str(self.data), None))
            saved = client.post('/api/configuration/storage/policy', json={'data_max_gib': 64})
            self.assertEqual(saved.status_code, 200)
            self.assertEqual(saved.json()['budget']['policy']['data_max_gib'], 64)
            self.assertEqual(client.get('/api/configuration/storage').json()['budget']['policy']['data_max_gib'], 64)
            with patch('peach.storage_external_cache.read', return_value={'path': str(self.base / 'cache')}) as read:
                detected = client.get('/api/configuration/storage/external-cache')
                self.assertEqual(detected.json(), {'path': str(self.base / 'cache')})
                read.assert_called_once_with(config)
            with patch('peach.storage_external_cache.read', side_effect=UserValueError('errors.storageExternalCache.tokenNeedsPermission')):
                self.assertEqual(client.get('/api/configuration/storage/external-cache').status_code, 400)
            self.assertEqual(client.post('/api/configuration/storage/policy', json={'cache_max_gib': True}).status_code, 400)
            self.assertEqual(client.post('/api/configuration/storage/policy', json={'data_max_gib': 32},
                                         headers={'origin':'https://other.invalid'}).status_code, 403)
            self.assertEqual(client.get('/api/configuration/storage').json()['budget']['policy']['data_max_gib'], 64)
            self.assertEqual(client.post("/api/configuration/storage/clean", json={"category": "downloads"}).status_code, 400)
            self.assertEqual(client.post("/api/configuration/storage/clean",
                                         json={"categories": ["logs", "previews"]}).status_code, 400)
            self.assertEqual(client.post("/api/configuration/storage/clean", json={"categories": []}).status_code, 400)
            self.assertEqual(client.post("/api/configuration/storage/measure",
                                         headers={"origin": "https://other.invalid"}).status_code, 403)
            refused = client.post("/api/configuration/storage/relocate", json={"target": str(self.data / "inner")})
            self.assertEqual(refused.status_code, 400)
            self.assertIn("互相包含", refused.json()["detail"]["errors"]["target"])

    def test_jobs_measure_in_the_background_and_report_cleaning(self):
        config = self.config()
        write(self.data / "logs" / "tray.until-20260101.log", 2048)
        jobs = data_storage.StorageJobs()
        release = threading.Event()
        measure = data_storage.measure

        def slow(*args, **kwargs):
            release.wait(10)
            return measure(*args, **kwargs)

        with patch.object(data_storage, "measure", side_effect=slow):
            jobs.start(config, "logs")
            with self.assertRaisesRegex(RuntimeError, "正在统计或清理"):
                jobs.start(config, "measure")
            release.set()
            jobs.join(10)
        state = jobs.snapshot()
        self.assertEqual(state["state"], "idle")
        self.assertIn("释放 2 KB", state["message"])
        self.assertIsNotNone(data_storage.read_usage(config))

    def test_jobs_clean_several_categories_in_one_pass_and_estimate_from_the_last_count(self):
        config = self.config()
        write(self.data / "logs" / "tray.until-20260101.log", 2048)
        write(self.data / "generated" / "stream-segments" / "1" / "0001.ts", 1024)
        jobs = data_storage.StorageJobs()
        jobs.start(config, "measure")
        jobs.join(10)
        counted = data_storage.read_usage(config)["total_files"]

        with patch.object(data_storage, "measure", wraps=data_storage.measure) as measured:
            started = jobs.start(config, ["logs", "playback"])
            jobs.join(10)

        # 按类别表的顺序依次清理，统计只在最后做一次；进度条按上次的文件数估。
        self.assertEqual((started["state"], started["categories"]), ("cleaning", ["playback", "logs"]))
        self.assertEqual(started["expected_files"], counted)
        measured.assert_called_once()
        message = jobs.snapshot()["message"]
        self.assertIn("播放缓存、日志", message)
        self.assertIn("释放 3 KB", message)
        with self.assertRaisesRegex(ValueError, "不能在这里清理"):
            jobs.start(config, ["logs", "downloads"])


class CapacityProtectionTests(unittest.TestCase):
    def test_all_configured_write_directories_and_temporary_volume_are_checked(self):
        from peach.jobs import DiskSpaceDenied
        config = replace(self.config, directories={'database': str(self.root / 'db-volume'),
                         'sources': str(self.root / 'source-volume')})
        def existing(path):
            name = str(path)
            device = 2 if 'db-volume' in name else 3 if 'source-volume' in name else 4 if 'temp-volume' in name else 1
            return SimpleNamespace(device=device, stat=lambda: SimpleNamespace(st_dev=device))
        def space(target):
            return SimpleNamespace(free=1 if target.device == 3 else 100 * self.budget.GIB,
                                   total=200 * self.budget.GIB)
        with patch.object(self.budget, '_existing', side_effect=existing), \
                patch.object(self.budget.shutil, 'disk_usage', side_effect=space), \
                patch.object(self.budget.tempfile, 'gettempdir', return_value=str(self.root / 'temp-volume')):
            disks = self.real_disks(config, self.budget.StoragePolicy())
        self.assertEqual(len(disks), 4)
        self.assertTrue(any('source-volume' in path and free == 1 for path, free, _ in disks))
        self.assertTrue(any('temp-volume' in path for path, _, _ in disks))
        with patch.object(self.budget, '_disks', return_value=disks), self.assertRaises(DiskSpaceDenied):
            self.budget.CapacityGuard(config).check(force=True)

    def test_hardlinks_count_once_in_allocated_data_and_cache_but_retain_directory_entries(self):
        cached = write(self.root / 'generated/transcodes/1-key.mp4', 2048)
        alias = cached.with_name('2-key.mp4')
        os.link(cached, alias)
        with patch.object(self.budget, 'allocated_bytes', return_value=64):
            self.assertEqual(self.budget.data_usage(self.config), 64)
            self.assertEqual(self.budget.cache_usage(self.config)['managed_cache_bytes'], 64)
            measured = data_storage.measure(self.config)
        self.assertEqual(measured['allocated_bytes'], 64)
        self.assertEqual(measured['categories']['playback']['files'], 2)
        self.assertEqual(measured['categories']['playback']['bytes'], 4096)

    def test_cleaning_a_hardlink_with_a_retained_alias_does_not_claim_freed_allocation(self):
        cached = write(self.root / 'generated/transcodes/1-key.mp4', 2048)
        kept = self.root / 'retained.mp4'
        os.link(cached, kept)
        with patch.object(self.budget, 'allocated_bytes', return_value=64):
            data_storage.clean(self.config, 'playback')
        self.assertTrue(kept.is_file())
        from peach.capacity_history import project
        self.assertIsNone(project(self.config)['windows']['7d']['cleaned_bytes'])

    def test_relocated_directories_invalidate_cached_measurements_within_the_scan_interval(self):
        write(self.root / 'first-cache/transcodes/1-key.mp4', 7)
        write(self.root / 'second-cache/transcodes/1-key.mp4', 19)
        first = replace(self.config, directories={'generated': str(self.root / 'first-cache')})
        second = replace(self.config, directories={'generated': str(self.root / 'second-cache')})
        policy = self.budget.StoragePolicy(cache_max_gib=100)
        with patch.object(self.budget, 'allocated_bytes', side_effect=lambda _path, info: info.st_size):
            self.assertEqual(self.budget._measure_part(first, policy, "cache")['cache_bytes'], 7)
            self.assertEqual(self.budget._measure_part(second, policy, "cache")['cache_bytes'], 19)

    def test_copied_usage_and_pause_receipts_are_not_reused_after_manual_migration(self):
        measured = data_storage.measure(self.config)
        (self.root / 'state' / data_storage.USAGE_NAME).write_text(json.dumps(measured), encoding='utf-8')
        self.assertIsNotNone(data_storage.read_usage(self.config))
        self.budget.CapacityGuard(self.config).check(force=True)
        changed = replace(self.config, directories={'database': str(self.root / 'moved-database')})
        self.assertIsNone(data_storage.read_usage(changed))
        self.assertIsNone(self.budget.snapshot(changed)['last_check'])
        moved = self.root / 'moved-data'
        moved.mkdir()
        shutil.copytree(self.root / 'state', moved / 'state')
        copied = replace(self.config, data_root=moved)
        self.assertIsNone(data_storage.read_usage(copied))
        self.assertIsNone(self.budget.snapshot(copied)['last_check'])

    def test_changed_mount_identity_invalidates_measurement_with_the_same_directory_name(self):
        policy = self.budget.StoragePolicy(cache_max_gib=100)
        with patch.object(self.budget, 'layout', return_value={'mount': 1}), \
                patch.object(self.budget, 'cache_roots', return_value=[]) as roots:
            self.budget._measure_part(self.config, policy, 'cache')
            roots.assert_called_once()
        with patch.object(self.budget, 'layout', return_value={'mount': 2}), \
                patch.object(self.budget, 'cache_roots', return_value=[]) as roots:
            self.budget._measure_part(self.config, policy, 'cache')
            roots.assert_called_once()

    def test_directory_alias_retargeting_keeps_configuration_and_invalidates_old_usage(self):
        first, second = self.root / 'first', self.root / 'second'
        write(first / 'transcodes/1-key.mp4', 7)
        write(second / 'transcodes/1-key.mp4', 19)
        alias = self.root / 'cache-alias'
        try:
            alias.symlink_to(first, target_is_directory=True)
        except OSError as error:
            if getattr(error, 'winerror', None) == 1314:
                self.skipTest('当前 Windows 账号不能创建目录符号链接')
            raise
        config = replace(self.config, directories={'generated': str(alias)})
        with patch.object(self.budget, 'allocated_bytes', side_effect=lambda _path, info: info.st_size):
            measured = data_storage.measure(config)
            (self.root / 'state' / data_storage.USAGE_NAME).write_text(json.dumps(measured), encoding='utf-8')
            self.assertEqual(measured['categories']['playback']['bytes'], 7)
            alias.unlink()
            alias.symlink_to(second, target_is_directory=True)
            self.assertIsNone(data_storage.read_usage(config))
            self.assertEqual(self.budget.cache_usage(config)['managed_cache_bytes'], 19)
        self.assertEqual(config.directory('generated'), alias)

    def test_layout_change_during_a_scan_is_not_published_as_a_successful_measurement(self):
        policy = self.budget.StoragePolicy(cache_max_gib=100)
        with patch.object(self.budget, 'cache_usage', return_value={
                'managed_cache_bytes': 1, 'external_cache_bytes': None}), \
                patch.object(self.budget, 'layout', side_effect=[{'mount': 1}, {'mount': 2}]), \
                self.assertRaisesRegex(OSError, '统计期间发生变化'):
            self.budget._measure_part(self.config, policy, 'cache')

    def test_manual_cleanup_preserves_linked_directories_inside_cache(self):
        retained = write(self.root / 'retained/source.mp4', 19)
        cache = self.root / 'generated/stream-segments/1'
        write(cache / 'segment.ts', 7)
        alias = cache / 'moved-directory'
        try:
            alias.symlink_to(retained.parent, target_is_directory=True)
        except OSError as error:
            if getattr(error, 'winerror', None) == 1314:
                self.skipTest('当前 Windows 账号不能创建目录符号链接')
            raise
        data_storage.clean(self.config, 'playback')
        self.assertTrue(retained.is_file())
        self.assertTrue(alias.is_symlink())
        self.assertFalse((cache / 'segment.ts').exists())

    def test_missing_external_directory_pauses_instead_of_checking_its_parent_volume(self):
        from peach.jobs import DiskSpaceDenied
        external = self.root.parent / (self.root.name + '-external')
        external.mkdir()
        self.addCleanup(lambda: external.rmdir() if external.exists() else None)
        self.policy(external_cache_path=str(external))
        external.rmdir()
        with patch.object(self.budget, '_disks', side_effect=lambda config, policy, **kw: self.real_disks(config, policy, **kw)), \
                self.assertRaisesRegex(DiskSpaceDenied, '迁移后请更新'):
            self.budget.CapacityGuard(self.config).check(force=True)

    def test_foreign_platform_cache_path_remains_editable_and_can_be_disabled_after_migration(self):
        path = 'Z:\\old-cache' if os.name != 'nt' else '/old-cache'
        raw = {'external_cache_path': path, 'external_cache_max_gib': 10}
        (self.root / 'state' / self.budget.POLICY_NAME).write_text(json.dumps(raw), encoding='utf-8')
        self.assertEqual(self.budget.snapshot(self.config)['policy']['external_cache_path'], path)
        self.budget.save_policy(self.config, {**raw, 'enabled': False})
        self.assertFalse(self.budget.load_policy(self.config).enabled)

    def test_disabled_protection_preserves_limits_and_skips_disk_scans_and_cleaning(self):
        self.policy(enabled=False, minimum_free_gib=8, data_max_gib=80, cache_max_gib=20)
        with patch.object(self.budget, '_disks', side_effect=AssertionError('保护已关闭')), \
                patch.object(self.budget, '_measure_part', side_effect=AssertionError('保护已关闭')), \
                patch.object(self.budget, '_clean_rebuildable', side_effect=AssertionError('保护已关闭')):
            result = self.budget.CapacityGuard(self.config).check(force=True, required_bytes=999999)
        self.assertFalse(result['paused'])
        policy = self.budget.load_policy(self.config)
        self.assertEqual((policy.data_max_gib, policy.cache_max_gib), (80, 20))
        self.assertEqual(self.budget.reserve_bytes(policy, 100 * self.budget.GIB), 0)
        offline = str(self.root.parent / 'offline-cache')
        self.policy(enabled=False, external_cache_path=offline)
        self.assertEqual(self.budget.load_policy(self.config).external_cache_path, offline)
        with self.assertRaisesRegex(ValueError, '可读取'):
            self.policy(enabled=True, external_cache_path=offline)

    def test_cloud_cache_discovery_requires_local_service_permission_and_readable_directory(self):
        from peach import storage_external_cache
        from peach import downloads_clouddrive_pb2 as pb
        from peach.downloads import DownloadSettings
        DownloadSettings(self.config.directory('state')).save({'clouddrive_address': 'http://127.0.0.1:19798'}, {})
        client = Mock(address='http://127.0.0.1:19798')
        client.__enter__ = Mock(return_value=client)
        client.__exit__ = Mock(return_value=False)
        client.token_info.return_value = pb.TokenInfo(permissions=pb.TokenPermissions(allow_get_system_settings=True))
        client.call.return_value = pb.SystemSettings(fileBufferDiskCacheLocation=str(self.root))
        with patch.object(storage_external_cache, 'client_for', return_value=client):
            self.assertEqual(storage_external_cache.read(self.config), {'path': str(self.root)})
            client.address = 'http://192.0.2.1:19798'
            with self.assertRaisesRegex(ValueError, '远程'):
                storage_external_cache.read(self.config)
            client.address = 'http://localhost:19798'
            client.token_info.return_value.permissions.allow_get_system_settings = False
            with self.assertRaisesRegex(ValueError, '权限'):
                storage_external_cache.read(self.config)
            client.token_info.return_value.permissions.allow_get_system_settings = True
            client.call.return_value = pb.SystemSettings()
            with self.assertRaisesRegex(ValueError, '未返回'):
                storage_external_cache.read(self.config)
            client.call.return_value = pb.SystemSettings(fileBufferDiskCacheLocation=str(self.root / 'missing'))
            with self.assertRaisesRegex(ValueError, '可读取'):
                storage_external_cache.read(self.config)

    def test_unconfigured_cloud_cache_discovery_does_not_contact_a_service(self):
        from peach import storage_external_cache
        with patch.object(storage_external_cache, 'client_for') as connect:
            self.assertEqual(storage_external_cache.read(self.config), {'configured': False})
            connect.assert_not_called()

    def test_manual_cache_cleanup_records_allocated_bytes_and_excludes_logs(self):
        from peach.capacity_history import project
        write(self.root / 'generated/transcodes/1-key.mp4', 1024)
        write(self.root / 'logs/tray.until-20260101.log', 1024)
        with patch.object(self.budget, 'allocated_bytes', return_value=64):
            self.assertEqual(data_storage.clean(self.config, 'playback')['bytes'], 1024)
            data_storage.clean(self.config, 'logs')
        self.assertEqual(project(self.config)['windows']['7d']['cleaned_bytes'], 64)

    def test_manual_cleanup_invalidates_budget_measurement_before_immediate_retry(self):
        from peach.jobs import DiskSpaceDenied
        write(self.root / 'generated/transcodes/1-key.mp4', 2048)
        self.policy(cache_max_gib=1, auto_clean=False)
        guard = self.budget.CapacityGuard(self.config)
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            self.budget.refresh_usage(self.config)
            with self.assertRaises(DiskSpaceDenied):
                guard.check(force=True)
            data_storage.clean(self.config, 'playback')
            self.assertFalse(guard.check(force=True)['paused'])

    def setUp(self):
        from peach import storage_budget
        self.budget = storage_budget
        self.real_disks = storage_budget._disks
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        # 前台检查在余量不足时会排后台清理，它往 state/ 写记录；删临时目录前先等它收尾。
        self.addCleanup(self.join_background)
        self.config = settings_file.PeachConfig(self.root, self.root / 'config.toml')
        self.root.joinpath('state').mkdir()
        self.budget.invalidate_measurements()
        self.addCleanup(self.budget.invalidate_measurements)
        # 请求只排后台统计；用例需要读数时显式调用 refresh_usage，避免后台线程与补丁交错。
        self.real_refresh = storage_budget._refresh_in_background
        refresh = patch.object(self.budget, '_refresh_in_background')
        self.background = refresh.start()
        self.addCleanup(refresh.stop)
        # 磁盘读数默认是两块各剩 100 GiB 的盘，不读本机；要看真实磁盘的用例用 `self.real_disks`。
        free = 100 * self.budget.GIB
        self.disks = patch.object(self.budget, '_disks', return_value=[('system', free, free * 2), ('data', free, free * 2)])
        self.disks.start()
        self.addCleanup(self.disks.stop)
        # 样本文件刚写出来，用例里不按「最近用过」跳过；进程启动延迟也不等。
        for name in ('RECENT_SECONDS', 'DATA_START_DELAY'):
            delay = patch.object(self.budget, name, 0)
            delay.start()
            self.addCleanup(delay.stop)

    @staticmethod
    def join_background():
        for thread in threading.enumerate():
            if thread.name.startswith(('PeachCapacityClean', 'PeachCapacityMeasure')):
                thread.join(10)

    def join_cleaning(self):
        for thread in threading.enumerate():
            if thread.name == 'PeachCapacityClean':
                thread.join(10)

    def policy(self, **changes):
        from dataclasses import asdict
        raw = {**asdict(self.budget.StoragePolicy()), **changes}
        return self.budget.save_policy(self.config, raw)

    def test_new_data_directory_checks_existing_parent_and_saves_status(self):
        result = self.budget.CapacityGuard(self.config).check(force=True)
        self.assertFalse(result['paused'])
        self.assertIsNone(result['cache_bytes'])
        self.assertFalse(self.config.directory('generated').exists())
        self.assertEqual(self.budget.snapshot(self.config)['last_check'], result)

    def test_invalid_policy_and_unreadable_capacity_pause_instead_of_reporting_zero(self):
        from peach.jobs import DiskSpaceDenied
        for payload in ({'enabled': 0}, {'cache_max_gib': True}, {'minimum_free_gib': -1}, {'data_max_gib': -1}, {'unknown': 5}):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                self.budget.save_policy(self.config, payload)
        (self.root / 'state' / self.budget.POLICY_NAME).write_text('{broken', encoding='utf-8')
        with self.assertRaisesRegex(DiskSpaceDenied, '设置未取得'):
            self.budget.CapacityGuard(self.config).check(force=True)
        self.policy(data_max_gib=1)
        with patch.object(self.budget, 'data_usage', side_effect=PermissionError('denied')):
            with self.assertRaises(PermissionError):
                self.budget.refresh_usage(self.config)
            with self.assertRaisesRegex(DiskSpaceDenied, 'denied'):
                self.budget.CapacityGuard(self.config).check(force=True)

    def test_either_system_or_data_disk_low_space_refuses_work(self):
        from peach.jobs import DiskSpaceDenied
        for disks in ([('system', 100, 200 * self.budget.GIB), ('data', 100 * self.budget.GIB, 200 * self.budget.GIB)],
                      [('system', 100 * self.budget.GIB, 200 * self.budget.GIB), ('data', 100, 200 * self.budget.GIB)]):
            with self.subTest(disks=disks), patch.object(self.budget, '_disks', return_value=disks), \
                    self.assertRaises(DiskSpaceDenied):
                self.budget.CapacityGuard(self.config).check(force=True)

    def test_external_cache_uses_allocated_bytes_and_never_deletes_external_files(self):
        from peach.jobs import DiskSpaceDenied
        external = tempfile.TemporaryDirectory()
        self.addCleanup(external.cleanup)
        cache = Path(external.name).resolve()
        video = write(cache / 'cache', 1024 * 1024)
        self.policy(external_cache_path=str(cache), external_cache_max_gib=1)
        with patch.object(self.budget, 'allocated_bytes', return_value=32):
            self.budget.refresh_usage(self.config)
            result = self.budget.CapacityGuard(self.config).check(force=True)
        self.assertEqual(result['external_cache_bytes'], 32)
        self.budget.invalidate_measurements()
        with patch.object(self.budget, 'allocated_bytes', return_value=2 * self.budget.GIB):
            self.budget.refresh_usage(self.config)
            with self.assertRaisesRegex(DiskSpaceDenied, '外部缓存'):
                self.budget.CapacityGuard(self.config).check(force=True)
        self.assertTrue(video.is_file())

    def test_cleanup_removes_signed_local_derivatives_and_preserves_every_other_category(self):
        from peach import artifact_rules
        source = write(self.root / 'generated/covers/source.jpg')
        thumbnail = write(self.root / 'generated/cover-thumbs/known.webp', 2048)
        artifact_rules.remember(thumbnail, source=source)
        protected = [source, write(self.root / 'generated/cover-thumbs/manual.webp', 30),
                     write(self.root / 'generated/snapshots/grid.jpg'),
                     write(self.root / 'database/ledger.db'), write(self.root / 'database/ledger.pre-copy.db'),
                     write(self.root / 'sources/import.json'), write(self.root / 'review/manual.csv')]
        self.policy(cache_max_gib=1)
        # 小文件按同一单位缩放触发预算，避免测试写入 GiB 级样本。
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            self.budget.refresh_usage(self.config)
            result = self.budget.CapacityGuard(self.config).check(force=True)
        self.assertFalse(result['paused'])
        self.assertFalse(thumbnail.exists())
        self.assertFalse(Path(str(thumbnail) + '.rule').exists())
        self.assertTrue(all(path.is_file() for path in protected))

    def test_over_limit_cleans_segments_then_the_oldest_transcode_and_keeps_writes_in_progress(self):
        def aged(path, mtime):
            os.utime(path, (mtime, mtime))
            return path
        writing = aged(write(self.root / 'generated/transcodes/1-old.0123abcd.tmp.mp4', 2048), 100)
        oldest = aged(write(self.root / 'generated/transcodes/1-old.mp4', 2048), 200)
        segment = aged(write(self.root / 'generated/stream-segments/2/key/0.ts', 2048), 300)
        newest = aged(write(self.root / 'generated/transcodes/3-new.mp4', 2048), 400)
        download = aged(write(self.root / 'generated/covers/source.jpg', 2048), 50)
        # 共 8 KB、上限 5 KB：差 3 KB。分段重建最便宜先清，再清最久没用的转码副本。
        self.policy(cache_max_gib=5)
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            self.budget.refresh_usage(self.config)
            result = self.budget.CapacityGuard(self.config).check(force=True)
            again = self.budget.CapacityGuard(self.config).check(force=True)
        self.assertFalse(result['paused'])
        self.assertEqual(result['freed_bytes'], 4096)
        self.assertFalse(segment.exists())
        self.assertFalse(oldest.exists())
        self.assertTrue(all(path.is_file() for path in (writing, newest, download)))
        # 清理量记进最近读数，下一次后台统计前不会再清一轮。
        self.assertEqual(again['freed_bytes'], 0)
        self.assertFalse(again['paused'])

    def test_unreclaimable_usage_pauses_and_saved_limit_change_applies_without_restart(self):
        from peach.jobs import DiskSpaceDenied
        ledger = write(self.root / 'database/ledger.db', 2048)
        self.policy(data_max_gib=1)
        guard = self.budget.CapacityGuard(self.config)
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            self.budget.refresh_usage(self.config)
            with self.assertRaisesRegex(DiskSpaceDenied, 'Peach 数据'):
                guard.check(force=True)
            # 只改上限数值不作废读数，新上限立刻按原读数生效。
            self.policy(data_max_gib=64)
            self.assertFalse(guard.check(force=True)['paused'])
            self.assertIsNotNone(guard.check(force=True)['data_bytes'])
        self.assertTrue(ledger.exists())

    def test_requests_read_the_last_background_count_and_never_walk_directories(self):
        from peach.jobs import DiskSpaceDenied
        write(self.root / 'database/ledger.db', 2048)
        self.policy(data_max_gib=1, auto_clean=False)
        guard = self.budget.CapacityGuard(self.config)
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            with patch.object(self.budget, '_files', side_effect=AssertionError('请求不能展开目录')):
                first = guard.check(force=True)
                guard.check(force=True)
            # 还没有读数时放行并排一次后台统计，同一间隔内不重复排。
            self.assertFalse(first['paused'])
            self.assertIsNone(first['data_bytes'])
            self.assertEqual(self.background.call_count, 1)
            self.budget.refresh_usage(self.config)
            with patch.object(self.budget, '_files', side_effect=AssertionError('请求不能展开目录')), \
                    self.assertRaisesRegex(DiskSpaceDenied, 'Peach 数据'):
                guard.check(force=True)

    def test_background_count_publishes_a_reading_and_reruns_after_the_interval(self):
        write(self.root / 'database/ledger.db', 7)
        policy = self.policy(data_max_gib=1)
        clock = [1_800_000_000.0]
        with patch.object(self.budget.time, 'time', side_effect=lambda: clock[0]), \
                patch.object(self.budget, 'data_roots', return_value=[self.root / 'database']), \
                patch.object(self.budget, 'allocated_bytes', return_value=7):
            self.assertIsNone(self.budget.latest_usage(self.config, policy)['data_bytes'])
            self.assertEqual(self.background.call_args.args[2], 'data')
            self.real_refresh(self.config, policy, 'data')
            for thread in threading.enumerate():
                if thread.name.startswith('PeachCapacityMeasure'):
                    thread.join(10)
            self.assertEqual(self.budget.latest_usage(self.config, policy)['data_bytes'], 7)
            self.assertEqual(self.background.call_count, 1)
            clock[0] += self.budget.REFRESH_SECONDS['data']
            self.budget.latest_usage(self.config, policy)
        self.assertEqual(self.background.call_count, 2)

    def test_cache_and_data_are_counted_on_their_own_intervals(self):
        policy = self.policy(data_max_gib=1, cache_max_gib=1)
        clock = [1_800_000_000.0]
        with patch.object(self.budget.time, 'time', side_effect=lambda: clock[0]), \
                patch.object(self.budget, 'data_usage', return_value=5), \
                patch.object(self.budget, 'cache_usage',
                             return_value={'managed_cache_bytes': 3, 'external_cache_bytes': None}):
            self.budget.refresh_usage(self.config)
            self.assertEqual(self.budget.latest_usage(self.config, policy)['data_bytes'], 5)
            self.background.assert_not_called()
            clock[0] += self.budget.REFRESH_SECONDS['cache']
            self.budget.latest_usage(self.config, policy)
        self.assertEqual([call.args[2] for call in self.background.call_args_list], ['cache'])

    def test_readings_survive_a_restart_and_are_shared_through_the_state_directory(self):
        policy = self.policy(data_max_gib=1)
        with patch.object(self.budget, 'data_usage', return_value=11):
            self.budget.refresh_usage(self.config)
        # 模拟重启：内存清空，状态目录里的读数还在。
        with self.budget._REFRESH_GUARD:
            self.budget._READINGS.clear()
            self.budget._STARTED.clear()
        with patch.object(self.budget, 'data_usage', side_effect=AssertionError('重启后不重新统计')):
            self.assertEqual(self.budget.latest_usage(self.config, policy)['data_bytes'], 11)
        self.background.assert_not_called()
        self.budget.invalidate_measurements(self.config)
        self.assertIsNone(self.budget.latest_usage(self.config, policy)['data_bytes'])

    def test_a_count_finished_after_a_cleanup_is_not_published(self):
        policy = self.policy(data_max_gib=1)
        def changed_midway(*_args):
            self.budget.invalidate_measurements(self.config)
            return {'data_bytes': 9}
        with patch.object(self.budget, '_measure_part', side_effect=changed_midway):
            self.budget.refresh_usage(self.config)
        self.assertIsNone(self.budget.latest_usage(self.config, policy)['data_bytes'])

    def test_playback_guard_cleans_over_limit_but_only_low_disk_refuses(self):
        from peach.jobs import DiskSpaceDenied
        write(self.root / 'database/ledger.db', 4096)
        cached = write(self.root / 'generated/transcodes/1-old.mp4', 2048)
        self.policy(data_max_gib=1)
        playback = self.budget.CapacityGuard(self.config, foreground=True)
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            self.budget.refresh_usage(self.config)
            walkers, files = [], self.budget._files

            def walk(*args, **kwargs):
                walkers.append(threading.get_ident())
                return files(*args, **kwargs)
            with patch.object(self.budget, '_files', side_effect=walk):
                result = playback.check(force=True)
                self.join_cleaning()
            # 播放请求只排后台清理，本身不走缓存目录；后台清理线程什么时候开始走不由请求决定。
            self.assertNotIn(threading.get_ident(), walkers)
            self.assertTrue(walkers)
            # 数据超限：后台清了缓存，仍超限也照常播放；前台不写状态文件。
            self.assertFalse(cached.exists())
            self.assertTrue(result['paused'])
            self.assertFalse((self.root / 'state' / self.budget.STATUS_NAME).exists())
            with self.assertRaisesRegex(DiskSpaceDenied, 'Peach 数据'):
                self.budget.CapacityGuard(self.config).check(force=True)
        with patch.object(self.budget, '_disks', return_value=[('data', 1, 200 * self.budget.GIB)]), \
                self.assertRaisesRegex(DiskSpaceDenied, '磁盘空间不足'):
            playback.check(force=True)

    def test_cleaning_that_cannot_reach_the_limit_does_not_walk_the_cache_again_on_every_check(self):
        from peach.jobs import DiskSpaceDenied
        write(self.root / 'database/ledger.db', 4096)
        self.policy(data_max_gib=1)
        guard = self.budget.CapacityGuard(self.config)
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            self.budget.refresh_usage(self.config)
            with patch.object(self.budget, '_clean_rebuildable', return_value=0) as cleaned:
                for _ in range(3):
                    with self.assertRaisesRegex(DiskSpaceDenied, 'Peach 数据'):
                        guard.check(force=True)
        cleaned.assert_called_once()

    def test_cleaning_recomputes_the_gap_after_another_check_already_cleaned_it(self):
        write(self.root / 'generated/transcodes/1-a.mp4', 2048)
        write(self.root / 'generated/transcodes/2-b.mp4', 2048)
        self.policy(cache_max_gib=3)
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            self.budget.refresh_usage(self.config)
            stale = self.budget.CapacityGuard(self.config)
            usage = self.budget.latest_usage(self.config, self.budget.load_policy(self.config))
            # 另一个检查先清掉了缺口；这一个拿着清理前的读数进来，加锁后按最新读数应无需再清。
            self.budget.CapacityGuard(self.config).check(force=True)
            with patch.object(self.budget, 'latest_usage', side_effect=[usage, self.budget.latest_usage(
                    self.config, self.budget.load_policy(self.config), reload=True)]), \
                    patch.object(self.budget, '_clean_rebuildable', side_effect=AssertionError('已清过')):
                self.budget._CLEAN_EXHAUSTED[0] = 0.0
                stale.check(force=True)

    def test_recently_used_cache_is_not_cleaned(self):
        recent = write(self.root / 'generated/transcodes/1-playing.mp4', 2048)
        with patch.object(self.budget, 'RECENT_SECONDS', 600):
            self.assertEqual(self.budget._clean_rebuildable(self.config, 10 ** 9), 0)
        self.assertTrue(recent.exists())

    def test_playback_guard_keeps_playing_when_the_check_itself_fails(self):
        self.policy(data_max_gib=1)
        with patch.object(self.budget, 'data_usage', side_effect=PermissionError('denied')), \
                self.assertRaises(PermissionError):
            self.budget.refresh_usage(self.config)
        # 不抛出就是放行；读不到的类别记在 errors 里。
        result = self.budget.CapacityGuard(self.config, foreground=True).check(force=True)
        self.assertIn('data', result['errors'])
        (self.root / 'state' / self.budget.POLICY_NAME).write_text('{broken', encoding='utf-8')
        self.assertIn('error', self.budget.CapacityGuard(self.config, foreground=True).check(force=True))

    def test_playback_guard_still_checks_disks_when_the_external_cache_folder_is_gone(self):
        from peach.jobs import DiskSpaceDenied
        external = self.root.parent / (self.root.name + '-gone')
        external.mkdir()
        self.addCleanup(lambda: external.rmdir() if external.exists() else None)
        self.policy(external_cache_path=str(external))
        external.rmdir()
        low = lambda path: SimpleNamespace(free=1, total=200 * self.budget.GIB)
        with patch.object(self.budget, '_disks', side_effect=lambda config, policy, **kw: self.real_disks(config, policy, **kw)), \
                patch.object(self.budget.shutil, 'disk_usage', side_effect=low), \
                self.assertRaisesRegex(DiskSpaceDenied, '磁盘空间不足'):
            self.budget.CapacityGuard(self.config, foreground=True).check(force=True)

    def test_disabling_cleanup_preserves_signed_cache_when_limit_is_reached(self):
        from peach import artifact_rules
        from peach.jobs import DiskSpaceDenied
        source = write(self.root / 'generated/covers/source.jpg')
        thumbnail = write(self.root / 'generated/cover-thumbs/known.webp', 2048)
        artifact_rules.remember(thumbnail, source=source)
        self.policy(cache_max_gib=1, auto_clean=False)
        with patch.object(self.budget, 'GIB', 1024), \
                patch.object(self.budget, 'allocated_bytes', side_effect=lambda path, info: info.st_size):
            self.budget.refresh_usage(self.config)
            with self.assertRaises(DiskSpaceDenied):
                self.budget.CapacityGuard(self.config).check(force=True)
        self.assertTrue(thumbnail.is_file())

    def test_automatic_reserve_handles_small_disks_and_large_storage_volumes(self):
        policy = self.budget.StoragePolicy()
        self.assertEqual(self.budget.reserve_bytes(policy, 10 * self.budget.GIB), self.budget.GIB)
        self.assertEqual(self.budget.reserve_bytes(policy, 200 * self.budget.GIB), 10 * self.budget.GIB)
        self.assertEqual(self.budget.reserve_bytes(policy, 20_000 * self.budget.GIB), 40 * self.budget.GIB)
        explicit = self.budget.StoragePolicy(minimum_free_gib=7)
        self.assertEqual(self.budget.reserve_bytes(explicit, 200 * self.budget.GIB), 7 * self.budget.GIB)

    def test_planned_backup_size_is_checked_against_disk_reserve_before_writing(self):
        from peach.jobs import DiskSpaceDenied
        self.policy(minimum_free_gib=1, auto_clean=False)
        disk = SimpleNamespace(free=3 * 1024, total=20 * 1024)
        with patch.object(self.budget, 'GIB', 1024), patch.object(self.budget.shutil, 'disk_usage', return_value=disk), \
                self.assertRaisesRegex(DiskSpaceDenied, '预计写入后'):
            self.budget.CapacityGuard(self.config).check(force=True, required_bytes=2500,
                                                         destination=self.root / 'database')

    def test_a_denied_guard_remains_denied_during_the_check_interval(self):
        from peach.jobs import DiskSpaceDenied
        guard = self.budget.CapacityGuard(self.config)
        with patch.object(self.budget, '_disks', return_value=[('data', 1, 200 * self.budget.GIB)]):
            with self.assertRaises(DiskSpaceDenied):
                guard.check(force=True)
            with self.assertRaises(DiskSpaceDenied):
                guard.check()

    def test_external_cache_directory_cannot_overlap_peach_managed_data(self):
        managed = self.root / 'generated'
        managed.mkdir()
        for target in (self.root, self.root.parent, managed):
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, '独立'):
                self.policy(external_cache_path=str(target))

    def test_default_request_guard_does_not_walk_data_or_cache_for_research_sampling(self):
        with patch.object(self.budget, 'data_roots', side_effect=AssertionError('未设置数据上限')), \
                patch.object(self.budget, 'cache_roots', side_effect=AssertionError('未设置缓存上限')), \
                patch.object(self.budget, '_files', side_effect=AssertionError('前台不能全树扫描')), \
                patch.object(self.budget, '_history_due', side_effect=AssertionError('日采样不属于请求')):
            result = self.budget.CapacityGuard(self.config).check(force=True)
        self.assertIsNone(result['data_bytes'])
        self.assertIsNone(result['cache_bytes'])
        self.assertIsNone(result['external_cache_bytes'])

    def test_external_directory_without_a_limit_does_not_trigger_foreground_scan(self):
        policy = self.budget.StoragePolicy(external_cache_path=str(self.root))
        with patch.object(self.budget, '_files', side_effect=AssertionError('外部缓存未设置上限')):
            self.assertIsNone(self.budget._measure_part(self.config, policy, 'cache')['external_cache_bytes'])

    def test_only_enabled_limits_select_the_corresponding_roots(self):
        self.assertEqual(self.budget._parts(self.budget.StoragePolicy(data_max_gib=100)), ('data',))
        self.assertEqual(self.budget._parts(self.budget.StoragePolicy(external_cache_max_gib=1)), ('cache',))
        self.assertEqual(self.budget._parts(self.budget.StoragePolicy()), ())
        with patch.object(self.budget, 'data_roots', return_value=[]) as data_roots, \
                patch.object(self.budget, 'cache_roots', side_effect=AssertionError('缓存上限未设置')):
            result = self.budget._measure_part(self.config, self.budget.StoragePolicy(data_max_gib=100), 'data')
        data_roots.assert_called_once_with(self.config)
        self.assertEqual(result, {'data_bytes': 0})
        with patch.object(self.budget, 'cache_roots', return_value=[]) as cache_roots, \
                patch.object(self.budget, 'data_roots', side_effect=AssertionError('数据上限未设置')):
            result = self.budget._measure_part(self.config, self.budget.StoragePolicy(cache_max_gib=100), 'cache')
        cache_roots.assert_called_once_with(self.config)
        self.assertEqual(result['cache_bytes'], 0)

    def test_a_file_changing_during_the_count_is_skipped_instead_of_failing_the_whole_count(self):
        kept, gone = write(self.root / 'kept', 5), write(self.root / 'gone', 7)
        def allocation(path, info):
            if path == gone:
                raise FileNotFoundError(path)
            return info.st_size
        with patch.object(self.budget, 'allocated_bytes', side_effect=allocation):
            self.assertEqual(self.budget._allocated([self.root], lambda: None),
                             kept.stat().st_size + sum(path.stat().st_size for path in (self.root / 'state').rglob('*')
                                                       if path.is_file()))

    def test_a_failed_count_is_retried_after_a_short_delay_not_a_whole_interval(self):
        policy = self.policy(data_max_gib=1)
        clock = [1_800_000_000.0]
        with patch.object(self.budget.time, 'time', side_effect=lambda: clock[0]), \
                patch.object(self.budget, 'data_usage', side_effect=PermissionError('busy')):
            with self.assertRaises(PermissionError):
                self.budget.refresh_usage(self.config)
            self.assertIn('data', self.budget.latest_usage(self.config, policy)['errors'])
            calls = self.background.call_count
            clock[0] += self.budget.RETRY_SECONDS
            self.budget.latest_usage(self.config, policy)
        self.assertEqual(self.background.call_count, calls + 1)

    def test_cache_scan_ttl_starts_at_completion_and_respects_managed_selection(self):
        file = write(self.root / 'sample', 9)
        clock = [0.0]
        def scan(_root, *_args):
            clock[0] += 100
            yield file, file.stat()
        with patch.object(self.budget.time, 'monotonic', side_effect=lambda: clock[0]), \
                patch.object(self.budget, 'cache_roots', return_value=[self.root]), \
                patch.object(self.budget, '_files', side_effect=scan) as files, \
                patch.object(self.budget, 'allocated_bytes', return_value=9):
            self.assertEqual(self.budget.cache_usage(self.config)['managed_cache_bytes'], 9)
            clock[0] = 110
            self.assertEqual(self.budget.cache_usage(self.config)['managed_cache_bytes'], 9)
            self.assertIsNone(self.budget.cache_usage(self.config, managed=False)['managed_cache_bytes'])
        self.assertEqual(files.call_count, 1)

    def test_long_scan_free_space_check_interrupts_before_reading_more_allocations(self):
        from peach.jobs import DiskSpaceDenied
        first, second = write(self.root / 'one', 1), write(self.root / 'two', 1)
        clock = [0.0]
        high = [('system', 100 * self.budget.GIB, 200 * self.budget.GIB)]
        low = [('system', 1, 200 * self.budget.GIB)]
        def scan(_root, *_args):
            yield first, first.stat()
            clock[0] = 3
            yield second, second.stat()
        self.policy(data_max_gib=100)
        with patch.object(self.budget.time, 'monotonic', side_effect=lambda: clock[0]), \
                patch.object(self.budget, '_files', side_effect=scan), \
                patch.object(self.budget, 'allocated_bytes', return_value=1) as allocated, \
                patch.object(self.budget, '_disks', side_effect=[high, low]), \
                self.assertRaisesRegex(DiskSpaceDenied, '扫描期间磁盘余量触线'):
            self.budget.refresh_usage(self.config)
        self.assertEqual(allocated.call_count, 1)

    def test_low_space_at_start_cleans_without_walking_data_in_the_request(self):
        self.policy(data_max_gib=100, minimum_free_gib=1)
        cleared = [False]
        high = [('system', 100 * self.budget.GIB, 200 * self.budget.GIB)]
        low = [('system', 1, 200 * self.budget.GIB)]
        events = []
        def cleanup(*_args):
            cleared[0] = True
            events.append('clean')
            return 16
        with patch.object(self.budget, '_disks', side_effect=lambda *_args, **_kw: high if cleared[0] else low), \
                patch.object(self.budget.shutil, 'disk_usage', return_value=SimpleNamespace(free=1, total=200 * self.budget.GIB)), \
                patch.object(self.budget, '_clean_rebuildable', side_effect=cleanup), \
                patch.object(self.budget, 'data_usage', side_effect=AssertionError('请求不能展开数据目录')):
            result = self.budget.CapacityGuard(self.config).check(force=True)
        self.assertEqual(events, ['clean'])
        self.assertFalse(result['paused'])
        self.assertEqual(result['freed_bytes'], 16)

    @unittest.skipUnless(os.name == 'nt', 'Windows 分配量接口')
    def test_windows_allocation_reuses_the_binding_and_resets_each_calls_last_error(self):
        import ctypes
        entered = []
        def allocation(_path, high):
            entered.append(ctypes.get_last_error())
            high._obj.value = 0
            ctypes.set_last_error(5)
            return 32 if len(entered) <= 2 else 0xFFFFFFFF
        function = Mock(side_effect=allocation)
        self.budget._compressed_file_size.cache_clear()
        self.addCleanup(self.budget._compressed_file_size.cache_clear)
        with patch.object(ctypes, 'WinDLL', return_value=SimpleNamespace(GetCompressedFileSizeW=function)) as load:
            self.assertEqual(self.budget.allocated_bytes(self.root, SimpleNamespace()), 32)
            self.assertEqual(self.budget.allocated_bytes(self.root, SimpleNamespace()), 32)
            with self.assertRaises(OSError):
                self.budget.allocated_bytes(self.root, SimpleNamespace())
        self.assertEqual(load.call_count, 1)
        self.assertEqual(entered, [0, 0, 0])


if __name__ == "__main__":
    unittest.main()
