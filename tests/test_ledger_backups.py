import contextlib
import importlib.util
import io
import json
import os
import shutil
import sqlite3
import tempfile
import time
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from peach import ledger_backups, migrations, retention_settings, settings_file, update_tasks, web_organize
from peach.task_runs import TaskRunStore
from support.ledger import MIGRATIONS_DIR, fresh_ledger


ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 9, 5, 12, 0, 0)


def load_script():
    spec = importlib.util.spec_from_file_location(
        "test_prune_ledger_backups", ROOT / "scripts" / "prune_ledger_backups.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def stamp(path: Path, when: datetime) -> None:
    os.utime(path, (when.timestamp(), when.timestamp()))


class LedgerBackupRetentionTests(unittest.TestCase):
    def make_ledger(self, root: Path, *, when: datetime = NOW - timedelta(hours=3)) -> Path:
        live = root / "ledger.db"
        connection = sqlite3.connect(live)
        connection.execute("CREATE TABLE asset (id INTEGER PRIMARY KEY)")
        connection.commit()
        connection.close()
        stamp(live, when)
        return live

    def make_backup(self, root: Path, name: str, when: datetime, *, sidecars: bool = False) -> Path:
        backup = root / name
        backup.write_bytes(b"backup")
        stamp(backup, when)
        if sidecars:
            for suffix in ("-wal", "-shm"):
                sidecar = root / f"{name}{suffix}"
                sidecar.write_bytes(b"")
                stamp(sidecar, when)
        return backup

    def test_keeps_recent_young_and_newer_than_live_backups_and_removes_the_rest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live = self.make_ledger(root)
            old = [
                self.make_backup(root, f"ledger.pre-old-{index}.db",
                                 NOW - timedelta(days=10 - index), sidecars=(index == 0))
                for index in range(4)
            ]
            recent = [
                self.make_backup(root, f"ledger.pre-recent-{index}.db",
                                 NOW - timedelta(days=3, hours=index))
                for index in range(3)
            ]
            young = self.make_backup(root, "ledger.pre-young.db", NOW - timedelta(hours=2))
            future = self.make_backup(root, "ledger.pre-future.db", NOW - timedelta(hours=1))
            stamp(live, NOW - timedelta(hours=1, minutes=30))
            unrelated = root / "ledger.clean-legacy-20260828.json"
            unrelated.write_text("{}", encoding="utf-8")

            decided = ledger_backups.plan(live, keep_recent=5, now=NOW)

            self.assertIsNone(decided.refused)
            self.assertEqual(set(decided.remove), set(old),
                             "最近 5 份、24 小时内和比数据库新的都留，其余清退")
            self.assertEqual(set(decided.keep), set(recent) | {young, future})
            for path in old:
                self.assertTrue(path.exists(), "只算计划时一个字节都不动")

            applied = ledger_backups.prune(live, apply=True, keep_recent=5, now=NOW)

            self.assertEqual(set(applied.remove), set(old))
            self.assertEqual(applied.removable_bytes, 4 * len(b"backup"),
                             "字节数在删除前量好，报告里才不会写成 0")
            for path in old:
                self.assertFalse(path.exists())
            self.assertFalse((root / "ledger.pre-old-0.db-wal").exists(), "副文件一起删")
            self.assertFalse((root / "ledger.pre-old-0.db-shm").exists())
            for path in (*recent, young, future, live, unrelated):
                self.assertTrue(path.exists())

    def test_refuses_to_prune_when_the_live_ledger_is_corrupt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live = root / "ledger.db"
            live.write_bytes(b"not a database at all, just bytes")
            backup = self.make_backup(root, "ledger.pre-old.db", NOW - timedelta(days=30))

            decided = ledger_backups.prune(live, apply=True, keep_recent=0, now=NOW)

            self.assertIsNotNone(decided.refused)
            self.assertEqual(decided.remove, ())
            self.assertTrue(backup.exists(), "数据库坏了正是要用备份的时候")

    def test_refuses_when_the_live_ledger_is_missing_and_no_ops_without_backups(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live = root / "ledger.db"
            self.assertEqual(ledger_backups.prune(live, apply=True, now=NOW),
                             ledger_backups.BackupPlan((), ()))
            backup = self.make_backup(root, "ledger.pre-old.db", NOW - timedelta(days=30))
            decided = ledger_backups.prune(live, apply=True, keep_recent=0, now=NOW)
            self.assertIsNotNone(decided.refused)
            self.assertTrue(backup.exists())

    def test_wal_activity_counts_as_the_live_ledger_being_fresh(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live = self.make_ledger(root, when=NOW - timedelta(days=5))
            wal = root / "ledger.db-wal"
            wal.write_bytes(b"")
            stamp(wal, NOW - timedelta(hours=1))
            backup = self.make_backup(root, "ledger.pre-old.db", NOW - timedelta(days=2))

            decided = ledger_backups.plan(live, keep_recent=0, now=NOW)

            self.assertEqual(decided.remove, (backup,),
                             "主库文件时间没动但 -wal 动过，备份并不比数据库新")

    def test_sidecars_whose_backup_is_gone_get_swept_even_with_nothing_else_to_remove(self):
        """无主的 `-wal`／`-shm` 没人会再列到，只能单独扫。"""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live = self.make_ledger(root)
            (root / "ledger.db-wal").write_bytes(b"")
            young = self.make_backup(root, "ledger.pre-young.db",
                                     NOW - timedelta(hours=2), sidecars=True)
            orphans = []
            for suffix in ("-wal", "-shm"):
                orphan = root / f"ledger.pre-gone-20260821.db{suffix}"
                orphan.write_bytes(b"leftover")
                orphans.append(orphan)

            decided = ledger_backups.plan(live, now=NOW)

            self.assertEqual(decided.remove, (), "该留的备份一份都没动")
            self.assertEqual(set(decided.orphans), set(orphans))
            self.assertEqual(decided.removable_bytes, 2 * len(b"leftover"))
            for path in orphans:
                self.assertTrue(path.exists(), "只算计划时一个字节都不动")

            ledger_backups.prune(live, apply=True, now=NOW)

            for path in orphans:
                self.assertFalse(path.exists())
            for path in (live, root / "ledger.db-wal", young,
                         root / "ledger.pre-young.db-wal", root / "ledger.pre-young.db-shm"):
                self.assertTrue(path.exists(), "主文件还在的副文件跟着主文件走")

    def test_orphan_sidecars_survive_a_refusal_like_every_other_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live = root / "ledger.db"
            live.write_bytes(b"not a database at all, just bytes")
            orphan = root / "ledger.pre-gone-20260821.db-shm"
            orphan.write_bytes(b"leftover")

            decided = ledger_backups.prune(live, apply=True, keep_recent=0, now=NOW)

            self.assertIsNotNone(decided.refused)
            self.assertTrue(orphan.exists(), "数据库坏了就什么都别动，先看清楚再说")

    def test_script_reports_the_plan_as_json_and_only_deletes_with_apply(self):
        script = load_script()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live = self.make_ledger(root)
            old = self.make_backup(root, "ledger.pre-old.db", NOW - timedelta(days=30))
            import contextlib
            import io

            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                code = script.main(["--db", str(live), "--keep", "0", "--json"])
            self.assertEqual(code, 0)
            report = json.loads(buffer.getvalue())
            self.assertFalse(report["applied"])
            self.assertEqual(report["remove"], ["ledger.pre-old.db"])
            self.assertEqual(report["removable_bytes"], len(b"backup"))
            self.assertTrue(old.exists(), "缺省是 dry-run")

            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                code = script.main(["--db", str(live), "--keep", "0", "--apply"])
            self.assertEqual(code, 0)
            self.assertIn("已删除 1 份", buffer.getvalue())
            self.assertFalse(old.exists())


class OrganizeBackupRetentionTests(unittest.TestCase):
    """整理备份放在 generated 下，只按份数留，进行中的那份任何清退都不碰。"""

    make_ledger = LedgerBackupRetentionTests.make_ledger
    make_backup = LedgerBackupRetentionTests.make_backup

    def layout(self, root: Path) -> tuple[Path, Path, Path]:
        database = root / "database"
        database.mkdir()
        generated = root / "generated"
        folder = ledger_backups.organize_dir(generated)
        folder.mkdir(parents=True)
        return self.make_ledger(database, when=datetime.now()), generated, folder

    def aged(self, folder: Path, names: list[str]) -> list[Path]:
        """一个月前写的一批备份，越靠后越新。"""
        return [self.make_backup(folder, name, datetime.now() - timedelta(days=30, hours=-index))
                for index, name in enumerate(names)]

    def test_keeps_only_the_recent_count_and_touches_nothing_but_the_two_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live, _generated, folder = self.layout(root)
            backups = [
                self.make_backup(
                    folder,
                    f"ledger.pre-download-{index}-20260905-10{index:02d}00.db" if index % 2
                    else f"ledger.pre-organize-20260905-10{index:02d}00-job{index}.db",
                    NOW - timedelta(hours=2, minutes=-index))
                for index in range(8)
            ]
            stamp(live, NOW)
            foreign = self.make_backup(folder, "ledger.pre-migrate-20260801.db",
                                       NOW - timedelta(days=30))
            beside = self.make_backup(live.parent, "ledger.pre-old.db", NOW - timedelta(days=30))

            decided = ledger_backups.prune(
                live, apply=True, directory=folder, pattern=ledger_backups.ORGANIZE_PATTERN,
                keep_recent=ledger_backups.ORGANIZE_KEEP_RECENT,
                min_age=ledger_backups.ORGANIZE_MIN_AGE, now=NOW)

            self.assertEqual(ledger_backups.ORGANIZE_KEEP_RECENT, 5)
            self.assertEqual(set(decided.remove), set(backups[:3]),
                             "两小时内的也只留最近 5 份：下载一波一小时能写四十份")
            self.assertEqual(set(decided.keep), set(backups[3:]))
            for path in backups[:3]:
                self.assertFalse(path.exists())
            for path in (*backups[3:], foreign, beside, live):
                self.assertTrue(path.exists(), "只认两种整理备份名，也不碰账本目录")

    def test_a_held_backup_survives_any_prune_until_released(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live, _generated, folder = self.layout(root)
            backup = self.make_backup(folder, "ledger.pre-organize-20260801-000000-a.db",
                                      NOW - timedelta(days=30))
            scope = {"directory": folder, "pattern": ledger_backups.ORGANIZE_PATTERN,
                     "keep_recent": 0, "min_age": timedelta(0), "now": NOW}

            with ledger_backups.holding(backup):
                decided = ledger_backups.prune(live, apply=True, **scope)
                self.assertEqual(decided.remove, ())
                self.assertTrue(backup.exists(), "整理还在用的那份不能删")

            ledger_backups.prune(live, apply=True, **scope)
            self.assertFalse(backup.exists())

    def test_organize_backup_writes_a_copy_and_prunes_down_to_the_recent_count(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live, generated, folder = self.layout(root)
            old = self.aged(folder, [f"ledger.pre-download-{index}-20260801-000000.db"
                                     for index in range(6)])
            name = "ledger.pre-download-99-20260905-120000.db"

            with ledger_backups.organize_backup(live, generated, name) as backup:
                self.assertEqual(backup, folder / name)
                self.assertEqual(ledger_backups.integrity(backup), "ok", "是一份完整的账本副本")
                remaining = ledger_backups.list_backups(folder, ledger_backups.ORGANIZE_PATTERN)
                self.assertEqual(remaining, [*old[2:], backup])
                ledger_backups.prune(live, apply=True, directory=folder,
                                     pattern=ledger_backups.ORGANIZE_PATTERN,
                                     keep_recent=0, min_age=timedelta(0))
                self.assertTrue(backup.exists(), "同进程另一处清退也看得见这份在用")

            with self.assertRaises(ValueError):
                with ledger_backups.organize_backup(live, generated, "ledger.pre-migrate-x.db"):
                    pass
            self.assertFalse((folder / "ledger.pre-migrate-x.db").exists())

    def test_manual_organize_write_backs_up_into_the_organize_folder(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live, generated, folder = self.layout(root)
            old = self.aged(folder, [f"ledger.pre-organize-20260801-00000{index}-j{index}.db"
                                     for index in range(6)])
            contract = SimpleNamespace(db_path=live, candidate_root=generated,
                                       cache_bust=lambda: None)
            seen = []

            def work(_connection):
                seen.extend(ledger_backups.list_backups(folder, ledger_backups.ORGANIZE_PATTERN))
                return {"moved": 0}

            result = web_organize._run_write(contract, "job1", work)

            backup = Path(result["backup"])
            self.assertEqual(backup.parent, folder)
            self.assertEqual(seen, [*old[2:], backup], "写入开始前已清到最近 5 份")
            self.assertTrue(backup.exists())

    def test_script_organize_mode_plans_the_organize_folder_only(self):
        script = load_script()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            live, generated, folder = self.layout(root)
            backups = self.aged(folder, [f"ledger.pre-download-{index}-20260801-000000.db"
                                         for index in range(7)])
            beside = self.make_backup(live.parent, "ledger.pre-old.db",
                                      datetime.now() - timedelta(days=30))

            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                code = script.main(["--db", str(live), "--organize", str(generated), "--json"])

            self.assertEqual(code, 0)
            report = json.loads(buffer.getvalue())
            self.assertFalse(report["applied"])
            self.assertEqual(report["remove"], [path.name for path in backups[:2]])
            for path in (*backups, beside):
                self.assertTrue(path.exists(), "缺省是 dry-run")


def note(db: Path, value: str) -> None:
    """往账本里记一笔可辨认的内容，用来分辨恢复后是哪一份。"""
    with contextlib.closing(sqlite3.connect(db)) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS probe(v TEXT)")
        connection.execute("INSERT INTO probe VALUES (?)", (value,))
        connection.commit()


def notes(db: Path) -> list[str]:
    with contextlib.closing(sqlite3.connect(db)) as connection:
        return [row[0] for row in connection.execute("SELECT v FROM probe ORDER BY rowid")]


def task_row(db: Path, task_key: str, status: str = "succeeded") -> int:
    with contextlib.closing(sqlite3.connect(db)) as connection:
        finished = None if status in ("pending", "running") else "2026-11-04T00:00:00+00:00"
        cursor = connection.execute(
            "INSERT INTO task_run(task_key, trigger, status, finished_at) VALUES (?, 'manual', ?, ?)",
            (task_key, status, finished))
        connection.commit()
        return int(cursor.lastrowid)


class LedgerRestoreTests(unittest.TestCase):
    def completed_download(self):
        previous_run = task_row(self.live, 'download-postprocess')
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            task = connection.execute("INSERT INTO download_task(provider,source_uri,target,state,updated_at,"
                                      "postprocess_state,postprocess_run_id,postprocess_detail) "
                                      "VALUES('115','sample','/Movies','ingested','now','complete',?,'整理完成')",
                                      (previous_run,)).lastrowid
            connection.execute('UPDATE task_run SET mutex_key=? WHERE id=?',
                               (f'download-ingest:{task}', previous_run))
            connection.commit()
        return previous_run

    def test_restore_keeps_a_postprocess_link_that_matches_its_download(self):
        previous_run = self.completed_download()
        backup = ledger_backups.create(self.live)
        self.restore(backup)
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            self.assertEqual(connection.execute('SELECT postprocess_run_id FROM download_task').fetchall(),
                             [(previous_run,)])

    def test_restore_drops_a_postprocess_link_reused_by_unrelated_current_history(self):
        previous_run = self.completed_download()
        backup = ledger_backups.create(self.live)
        from peach.task_runs import TaskRunStore
        TaskRunStore(self.live).prune('download-postprocess', keep=0)
        current = task_row(self.live, 'other-task')
        self.assertEqual(current, previous_run)
        self.restore(backup)
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            self.assertEqual(connection.execute('SELECT task_key FROM task_run').fetchall(), [('other-task',)])
            self.assertEqual(connection.execute('SELECT postprocess_state,postprocess_run_id,postprocess_detail '
                                                'FROM download_task').fetchall(), [('complete', None, '整理完成')])
            connection.execute("UPDATE task_run SET task_key='download-postprocess',mutex_key='download-ingest:999999'")
            connection.commit()
        self.restore(backup)
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            self.assertIsNone(connection.execute('SELECT postprocess_run_id FROM download_task').fetchone()[0])

    def test_restore_refuses_logically_invalid_backup_before_replacing_live_data(self):
        backup = ledger_backups.create(self.live)
        with contextlib.closing(sqlite3.connect(backup)) as connection:
            connection.execute("INSERT INTO watch_queue(profile_id,asset_id,added_at,source) "
                               "VALUES('local-default',999999,'now','test')")
            connection.commit()
        self.assertEqual(ledger_backups.integrity(backup), 'ok')
        with self.assertRaisesRegex(ledger_backups.BackupRejected, '外键'):
            self.restore(backup)
        self.assertEqual(notes(self.live), ['before'])
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), [])

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.database = self.root / "database"
        self.database.mkdir()
        self.live = fresh_ledger(self.database)
        note(self.live, "before")

    def restore(self, backup: Path, **kwargs):
        return ledger_backups.restore(self.live, backup, migrations_dir=MIGRATIONS_DIR, **kwargs)

    def test_manual_backup_is_checked_before_it_gets_a_backup_name(self):
        seen = []
        backup = ledger_backups.create(self.live, progress=lambda **values: seen.append(values))

        self.assertRegex(backup.name, r"^ledger\.pre-manual-\d{8}-\d{6}\.db$")
        self.assertTrue(ledger_backups.BACKUP_PATTERN.match(backup.name), "和自动备份同一套清退规则")
        self.assertEqual(notes(backup), ["before"])
        self.assertEqual(seen[-1], {"stage": "检查备份完整性", "stage_code": "backup.checkIntegrity"})
        copied = [values for values in seen if values.get("stage") == "复制账本"]
        self.assertTrue(copied and copied[-1]["done"] == copied[-1]["total"] > 0)
        self.assertEqual([path.name for path in self.database.iterdir() if path.name.endswith(".part")], [])

    def test_backup_failing_integrity_check_is_discarded(self):
        original = ledger_backups.integrity
        with patch.object(ledger_backups, "integrity",
                          side_effect=lambda db: "page 3 is never used" if db.name.endswith(".part") else original(db)):
            with self.assertRaisesRegex(ledger_backups.BackupRejected, "完整性"):
                ledger_backups.create(self.live)

        self.assertEqual(sorted(path.name for path in self.database.iterdir()), ["ledger.db"])

    def test_catalog_tells_manual_from_automatic_and_resolve_only_takes_listed_names(self):
        organize = self.root / "generated" / "organize-backups"
        organize.mkdir(parents=True)
        auto = self.database / "ledger.pre-migrate-20261101-000000.db"
        shutil.copyfile(self.live, auto)
        stamp(auto, datetime.now() - timedelta(days=2))
        manual = ledger_backups.create(self.live)
        organized = organize / "ledger.pre-organize-20261102-000000-1.db"
        shutil.copyfile(self.live, organized)
        stamp(organized, datetime.now() - timedelta(days=1))

        listed = ledger_backups.catalog(self.live, organize)

        self.assertEqual([(entry["id"], entry["source"], entry["purpose"]) for entry in listed], [
            (f"database/{manual.name}", "manual", "手动备份"),
            ("organize/ledger.pre-organize-20261102-000000-1.db", "auto", "整理前"),
            ("database/ledger.pre-migrate-20261101-000000.db", "auto", "迁移前"),
        ])
        self.assertEqual(ledger_backups.resolve(self.live, organize, listed[1]["id"]), organized)
        for wrong in ("database/ledger.db", "database/../ledger.pre-x.db", "elsewhere/" + manual.name,
                      "organize/" + manual.name, None):
            with self.assertRaises(ledger_backups.BackupRejected, msg=wrong):
                ledger_backups.resolve(self.live, organize, wrong)

    def test_restore_saves_the_current_ledger_first_and_keeps_task_history(self):
        backup = ledger_backups.create(self.live)
        note(self.live, "after")
        running = task_row(self.live, "ledger-restore", "running")
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("UPDATE ledger_revision SET n = 50 WHERE tbl = 'asset'")
            connection.commit()

        outcome = self.restore(backup)

        self.assertEqual(notes(self.live), ["before"])
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone(), ("wal",), "账本保留自己的日志模式")
        self.assertEqual(sorted(path.name for path in self.database.glob(outcome.saved.name + "*")),
                         [outcome.saved.name], "另存的备份是单个文件，旁边没有 -wal／-shm")
        self.assertEqual(outcome.saved.parent, self.database)
        self.assertRegex(outcome.saved.name, r"^ledger\.pre-restore-")
        self.assertEqual(notes(outcome.saved), ["before", "after"], "恢复前的账本完整另存")
        self.assertEqual(outcome.migrated, ())
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            self.assertEqual(connection.execute("SELECT status FROM task_run WHERE id = ?", (running,)).fetchone(),
                             ("running",), "这次恢复自己那一行还在，结算才有地方写")
            self.assertEqual(connection.execute("SELECT n FROM ledger_revision WHERE tbl = 'asset'").fetchone(),
                             (51,), "版本号只增不减，聚合缓存不会撞上旧值")
        self.assertFalse((self.database / ledger_backups.MARKER_NAME).exists())
        self.assertFalse((self.database / ledger_backups.STAGING_NAME).exists())
        self.assertEqual(ledger_backups.integrity(self.live), "ok")

    def test_restore_refuses_a_damaged_backup_without_touching_the_ledger(self):
        damaged = self.database / "ledger.pre-manual-20261101-000000.db"
        damaged.write_bytes(b"SQLite format 3\x00" + b"\x00" * 200)

        with self.assertRaisesRegex(ledger_backups.BackupRejected, "完整性"):
            self.restore(damaged)

        self.assertEqual(notes(self.live), ["before"])
        self.assertEqual(sorted(path.name for path in self.database.iterdir()), sorted(["ledger.db", damaged.name]),
                         "没有另存、没有标记、没有暂存")

    def test_restore_migrates_an_older_backup_before_it_reaches_the_ledger(self):
        older = self.root / "older-migrations"
        older.mkdir()
        files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        for path in files[:-1]:
            shutil.copyfile(path, older / path.name)
        backup = self.database / "ledger.pre-migrate-20261101-000000.db"
        migrations.upgrade(backup, older)
        note(backup, "older")

        outcome = self.restore(backup)

        self.assertEqual(outcome.migrated, (files[-1].name[:4],))
        self.assertEqual(notes(self.live), ["older"])
        _, pending = migrations.plan(self.live, MIGRATIONS_DIR)
        self.assertEqual(pending, [])

    def test_restore_refuses_a_backup_from_a_newer_program(self):
        backup = ledger_backups.create(self.live)
        with contextlib.closing(sqlite3.connect(backup)) as connection:
            connection.execute("INSERT INTO schema_migration(version, name, checksum, applied_at) VALUES ('9999', 'future', 'x', '')")
            connection.commit()
        note(self.live, "after")

        with self.assertRaisesRegex(ledger_backups.BackupRejected, "结构"):
            self.restore(backup)

        self.assertEqual(notes(self.live), ["before", "after"])
        self.assertEqual(len(list(self.database.glob("ledger.pre-restore-*"))), 0)

    def test_failure_while_writing_leaves_the_ledger_as_it_was(self):
        backup = ledger_backups.create(self.live)
        note(self.live, "after")

        with patch.object(ledger_backups, "_copy_into", side_effect=sqlite3.OperationalError("database is locked")):
            with self.assertRaisesRegex(ledger_backups.BackupRejected, "保持不变"):
                self.restore(backup)

        self.assertEqual(notes(self.live), ["before", "after"])
        self.assertFalse((self.database / ledger_backups.MARKER_NAME).exists())
        self.assertEqual(ledger_backups.read_result(self.live)["state"], "failed")

    def interrupted(self, *, saved: Path | None, staging: bool) -> None:
        if staging:
            shutil.copyfile(self.live, self.database / ledger_backups.STAGING_NAME)
            note(self.database / ledger_backups.STAGING_NAME, "staged")
        (self.database / ledger_backups.MARKER_NAME).write_text(json.dumps({
            "state": "replacing", "backup": str(self.database / "ledger.pre-manual-1.db"),
            "saved": str(saved) if saved else ""}), encoding="utf-8")

    def test_startup_keeps_an_intact_ledger_after_an_interrupted_restore(self):
        self.assertIsNone(ledger_backups.recover(self.live), "没有标记什么都不做")
        self.interrupted(saved=None, staging=True)

        result = ledger_backups.recover(self.live)

        self.assertEqual((result["state"], result["outcome"]), ("interrupted", "kept"))
        self.assertEqual(notes(self.live), ["before"])
        self.assertFalse((self.database / ledger_backups.MARKER_NAME).exists())
        self.assertFalse((self.database / ledger_backups.STAGING_NAME).exists())
        self.assertEqual(ledger_backups.read_result(self.live)["outcome"], "kept")

    def test_startup_never_leaves_the_ledger_missing_after_an_interrupted_restore(self):
        saved = self.database / "ledger.pre-restore-20261104-000000.db"
        shutil.copyfile(self.live, saved)
        self.interrupted(saved=saved, staging=True)
        self.live.unlink()

        self.assertEqual(ledger_backups.recover(self.live)["outcome"], "completed")
        self.assertEqual(notes(self.live), ["before", "staged"], "迁好的暂存补完这次恢复")

        self.interrupted(saved=saved, staging=False)
        self.live.unlink()
        self.assertEqual(ledger_backups.recover(self.live)["outcome"], "rolled-back")
        self.assertEqual(notes(self.live), ["before"], "没有暂存就退回恢复前另存的那份")

    def test_migrate_upgrade_settles_the_marker_before_creating_anything(self):
        saved = self.database / "ledger.pre-restore-20261104-000000.db"
        shutil.copyfile(self.live, saved)
        self.interrupted(saved=saved, staging=False)
        self.live.unlink()
        from peach import cli
        with patch.object(cli, "_require_readable_settings"), contextlib.redirect_stdout(io.StringIO()):
            cli._migrate(SimpleNamespace(action="upgrade", db=self.live, yes=True))

        self.assertEqual(notes(self.live), ["before"])


class LedgerBackupManagerTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        (self.root / "config.toml").write_text("", encoding="utf-8")
        (self.root / "database").mkdir()
        self.live = fresh_ledger(self.root / "database")
        note(self.live, "before")
        self.config = settings_file.load_config(environ={settings_file.DATA_ROOT_ENV: str(self.root)})
        self.runs = TaskRunStore(self.live)
        self.busted = []
        self.manager = ledger_backups.LedgerBackups(self.config, runs=self.runs, migrations_dir=MIGRATIONS_DIR,
                                                    after_restore=lambda: self.busted.append(True))

    def finish(self, job) -> dict:
        job.thread.join(30)
        self.assertFalse(job.thread.is_alive())
        return job.snapshot()

    def finished_runs(self, task_key: str) -> list[str]:
        with contextlib.closing(sqlite3.connect(self.live)) as connection:
            return [row[0] for row in connection.execute(
                "SELECT status FROM task_run WHERE task_key = ? ORDER BY id", (task_key,))]

    def test_a_manual_backup_prunes_down_to_the_count_kept_on_this_computer(self):
        retention_settings.save(self.config.directory("state"), {"backup_keep": 2})
        old = time.time() - 3 * 86400
        for day in range(1, 5):
            path = self.root / "database" / f"ledger.pre-migrate-2026010{day}-000000.db"
            path.write_bytes(b"old")
            os.utime(path, (old + day, old + day))
        self.manager.start_backup()
        state = self.finish(self.manager.backup_job)
        self.assertEqual(state["status"], "complete", state)
        self.assertEqual(sorted(path.name for path in (self.root / "database").glob("ledger.pre-*.db")),
                         sorted(["ledger.pre-migrate-20260104-000000.db", state["name"]]))

    def test_backup_and_restore_run_as_background_tasks_in_the_task_center(self):
        self.manager.start_backup()
        state = self.finish(self.manager.backup_job)
        self.assertEqual(state["status"], "complete", state)
        listed = self.manager.snapshot()["backups"]
        self.assertEqual([entry["name"] for entry in listed], [state["name"]])
        note(self.live, "after")

        self.manager.start_restore(listed[0]["id"])
        state = self.finish(self.manager.restore_job)

        self.assertEqual(state["status"], "complete", state)
        self.assertEqual(notes(self.live), ["before"])
        self.assertEqual(self.finished_runs("ledger-backup"), ["succeeded"])
        self.assertEqual(self.finished_runs("ledger-restore"), ["succeeded"],
                         "自己那一行接回恢复后的账本并正常结算；查忙时没把自己算进去")
        self.assertEqual(self.busted, [True])
        self.assertFalse(update_tasks.is_pausing(self.live), "挡新任务的闸门已放开")
        self.assertEqual(notes(self.root / "database" / state["saved"]), ["before", "after"])

    def test_restore_is_refused_while_other_tasks_run(self):
        backup = ledger_backups.create(self.live)
        with patch.object(update_tasks, "running", return_value=["扫描与采集"]):
            with self.assertRaisesRegex(ledger_backups.BackupRejected, "扫描与采集"):
                self.manager.start_restore(f"database/{backup.name}")
        self.assertEqual(self.manager.snapshot()["restore"], {"status": "idle"})

    def test_restore_is_refused_on_a_reading_device(self):
        backup = ledger_backups.create(self.live)
        with patch("peach.runtime_prepare.configured_ledger_writer", return_value=(False, "这台电脑是只读端")):
            with self.assertRaisesRegex(ledger_backups.BackupRejected, "写入端"):
                self.manager.start_restore(f"database/{backup.name}")

    def test_new_tasks_are_held_off_while_restoring(self):
        token = update_tasks.reserve(self.live, busy="errors.ledgerBackups.restoringBusy")
        self.addCleanup(update_tasks.release, self.live, token)
        with self.assertRaisesRegex(update_tasks.UpdateBusy, "正在从备份恢复账本"):
            with update_tasks.admission(self.live):
                pass

    def test_routes_require_confirmation_and_report_refusals(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from peach import routes_configuration
        from peach.routes_auth import require_auth
        app = FastAPI()
        app.include_router(routes_configuration.router)
        app.dependency_overrides[require_auth] = lambda: None
        app.state.ledger_backups = self.manager
        with TestClient(app, base_url="http://127.0.0.1", client=("127.0.0.1", 123)) as client, \
                patch.object(settings_file, "load_config", return_value=self.config):
            self.assertEqual(client.get("/api/configuration/ledger-backups").json()["backups"], [])
            unconfirmed = client.post("/api/configuration/ledger-backups/restore", json={"id": "database/x"})
            self.assertEqual(unconfirmed.status_code, 400)
            missing = client.post("/api/configuration/ledger-backups/restore",
                                  json={"id": "database/ledger.pre-manual-1.db", "confirm": True})
            self.assertEqual(missing.status_code, 409)
            self.assertIn("已经不在", missing.json()["detail"]["message"])
            self.assertEqual(client.post("/api/configuration/ledger-backups/backup",
                                         headers={"origin": "https://other.invalid"}).status_code, 403)
            self.assertEqual(client.get("/api/configuration/retention").json(), {"backup_keep": 5, "log_days": 183})
            self.assertEqual(client.post("/api/configuration/retention", json={"log_days": 7}).status_code, 400)
            self.assertEqual(client.post("/api/configuration/retention", json={"backup_keep": 10}).json(),
                             {"backup_keep": 10, "log_days": 183})
            self.assertEqual(self.manager.keep_recent(), 10)


if __name__ == "__main__":
    unittest.main()
