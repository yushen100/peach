"""账本版本号（migration 0038）与按版本缓存的聚合。

口味、复核、垃圾复核的结果不按时间过期，只在账本或它们读的文件变了之后重算。进程外的
写（CLI 脚本、推送发现的扫描连接、账本同步）大多直接 `sqlite3.connect`，服务看不见，
只有库里的触发器看得见，所以这里的写一律走独立连接。
"""
import json
import os
import re
import sqlite3
import tempfile
import threading
import time
import unittest
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from peach import taste_history, taste_preferences, web_batch, web_follow, web_state, web_stats
from peach.follow_sources import FollowCandidate, SourceFetch
from peach.follow_store import FollowStore
from peach.previews import entity_image_key, logo_key
from peach.repository import LedgerDatabase, in_background
from peach.web_catalog import CATALOG_TOTAL_TABLES, FACETS_TABLES, GROUP_TABLES, TOPS_TABLES
from peach.web_contract import dispatch_api_get
from peach.web_entity import INDEX_TABLES
from peach.web_state import WebContract
from support.ledger import fresh_ledger

#: 不挂触发器的表，理由见 `migrations/0038_ledger_revision.sql` 开头。
EXEMPT = {"ledger_revision", "schema_migration", "task_run"}
#: 播放心跳写的观看进度列，不推 asset 的版本（migration 0054）。
PLAYBACK_PROGRESS = {"play_seconds", "leave_ratio", "max_reached", "seek_count", "last_played"}


def insert_asset(db_path: Path, asset_id: int) -> None:
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.execute(
            "INSERT INTO asset(id,location,path,name,medium,size) VALUES(?,?,?,?,?,?)",
            (asset_id, "local", f"R:\\media\\{asset_id}.mp4", f"{asset_id}.mp4", "video", 1))


class LedgerRevisionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.db_path = fresh_ledger(self.directory.name)
        self.contract = WebContract(self.db_path)
        self.addCleanup(self.contract.stop_background_jobs)
        self.calls = 0

    def compute(self):
        self.calls += 1
        return self.calls

    def test_every_ledger_table_bumps_its_revision_on_insert_update_and_delete(self):
        with closing(sqlite3.connect(self.db_path)) as connection:
            virtual = [row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND sql LIKE 'CREATE VIRTUAL TABLE%'")]
            tables = {row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' "
                "AND sql NOT LIKE 'CREATE VIRTUAL TABLE%'")}
            tracked = {name for name in tables - EXEMPT
                       if not any(name.startswith(v + "_") for v in virtual)}
            triggers = {row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='trigger'")}
            rows = {row[0] for row in connection.execute("SELECT tbl FROM ledger_revision")}
        missing = sorted(f"rev_{table}_{event}" for table in tracked
                         for event in ("insert", "update", "delete")
                         if f"rev_{table}_{event}" not in triggers)
        self.assertEqual(missing, [], "新表要在同一个迁移里补上版本号触发器和 ledger_revision 预置行")
        self.assertEqual(sorted(tracked - rows), [])

    def test_asset_revision_follows_every_column_except_playback_progress(self):
        with closing(sqlite3.connect(self.db_path)) as connection:
            columns = {row[1] for row in connection.execute("PRAGMA table_info(asset)")}
            sql = connection.execute(
                "SELECT sql FROM sqlite_master WHERE name='rev_asset_update'").fetchone()[0]
        listed = {name.strip() for name in re.search(r"\bOF\b(.*?)\bON\s+asset\b", sql, re.S)[1].split(",")}
        self.assertEqual(listed, columns - PLAYBACK_PROGRESS,
                         "给 asset 加列要同步改 rev_asset_update 的列名单（migration 0054）")

    def test_playback_heartbeats_keep_versions_and_caches_while_starts_refresh_them(self):
        from peach import web_activity
        insert_asset(self.db_path, 1)
        tables = ("asset",)
        self.contract.cached_until_changed("tops", self.compute, tables=tables)
        self.contract.cached("plain", self.compute)
        before = self.contract.ledger_revision(tables)
        web_activity.w_activity(self.contract, {"id": 1, "position": 30, "duration": 60, "delta": 10, "seeks": 1})
        self.assertEqual(self.contract.ledger_revision(tables), before)
        self.assertEqual(self.contract.cached_until_changed("tops", self.compute, tables=tables), 1)
        self.assertEqual(self.contract.cached("plain", self.compute), 2)
        with closing(sqlite3.connect(self.db_path)) as connection:
            self.assertEqual(connection.execute(
                "SELECT play_seconds,max_reached,seek_count FROM asset WHERE id=1").fetchone(), (10.0, 0.5, 1))
        web_activity.w_play(self.contract, {"id": 1})
        self.assertGreater(self.contract.ledger_revision(tables), before)

    def test_catalog_revision_preserves_cached_content_after_play_and_refreshes_after_edits(self):
        from peach import web_activity
        insert_asset(self.db_path, 1)
        tables = ('asset_catalog',)
        before = self.contract.ledger_revision(tables)
        self.assertEqual(self.contract.cached_until_changed('content', self.compute, tables=tables), 1)
        web_activity.w_play(self.contract, {'id': 1})
        self.assertEqual(self.contract.ledger_revision(tables), before)
        self.assertEqual(self.contract.cached_until_changed('content', self.compute, tables=tables), 1)
        with self.contract.write_transaction() as connection:
            connection.execute("UPDATE asset SET catalog_title='Edited' WHERE id=1")
        self.assertEqual(self.contract.cached_until_changed('content', self.compute, tables=tables), 2)
        with closing(sqlite3.connect(self.db_path)) as connection:
            columns = {row[1] for row in connection.execute('PRAGMA table_info(asset)')}
            sql = connection.execute("SELECT sql FROM sqlite_schema WHERE name='rev_asset_catalog_update'").fetchone()[0]
        listed = {name.strip() for name in re.search(r"\bOF\b(.*?)\bON\s+asset\b", sql, re.S)[1].split(',')}
        self.assertEqual(listed, columns - PLAYBACK_PROGRESS - {'play_count'})

    def test_a_write_from_another_connection_recomputes_and_nothing_else_does(self):
        self.assertEqual(self.contract.cached_until_changed("taste", self.compute), 1)
        self.assertEqual(self.contract.cached_until_changed("taste", self.compute), 1)
        insert_asset(self.db_path, 1)
        self.assertEqual(self.contract.cached_until_changed("taste", self.compute), 2)
        self.assertEqual(self.contract.cached_until_changed("taste", self.compute), 2)

    def test_one_request_reads_the_revisions_once_until_this_process_commits(self):
        connect = self.contract.database.connect
        opened = []

        def counted(*args, **kwargs):
            opened.append(1)
            return connect(*args, **kwargs)

        with mock.patch.object(self.contract.database, "connect", counted), \
                web_state.revision_snapshot():
            whole = self.contract.ledger_revision()
            self.assertEqual(self.contract.ledger_revision(("asset",)) + self.contract.ledger_revision(
                tuple(table for table in self.contract.ledger_tables_except(("asset",)))), whole)
            self.assertEqual(len(opened), 1)
            # 请求里自己写过：提交通知让快照作废，后面的缓存认得出这次写入。
            with self.contract.database.write_transaction() as connection:
                connection.execute(
                    "INSERT INTO asset(id,location,path,name,medium,size) VALUES(?,?,?,?,?,?)",
                    (90, "local", "R:\\media\\90.mp4", "90.mp4", "video", 1))
            self.assertEqual(self.contract.ledger_revision(("asset",)), self.contract.ledger_revision(("asset",)))
            self.assertGreater(self.contract.ledger_revision(), whole)
        # 请求之外每次现读：进程外的写马上看得到。
        before = self.contract.ledger_revision()
        insert_asset(self.db_path, 91)
        self.assertGreater(self.contract.ledger_revision(), before)

    def test_catalog_totals_are_shared_across_sort_seeds_and_refresh_after_writes(self):
        from peach import web_catalog
        insert_asset(self.db_path, 1)
        insert_asset(self.db_path, 2)
        with mock.patch.object(web_catalog, 'video_work_key', wraps=web_catalog.video_work_key) as work_key:
            first = dispatch_api_get(self.contract, '/api/items', {'sort': 'seed', 'seed': '1', 'limit': '1'})
            second = dispatch_api_get(self.contract, '/api/items', {'sort': 'seed', 'seed': '2', 'limit': '1'})
            self.assertEqual((first['total'], second['total']), (2, 2))
            self.assertEqual(work_key.call_count, 1)
            with self.contract.database.write_transaction() as connection:
                connection.execute("UPDATE asset SET size=3 WHERE id=1")
            refreshed = dispatch_api_get(self.contract, '/api/items', {'sort': 'seed', 'seed': '2', 'limit': '1'})
            self.assertEqual(refreshed['bytes'], 4)
            self.assertEqual(work_key.call_count, 2)

    def test_background_insert_does_not_pair_fresh_rows_with_stale_totals(self):
        insert_asset(self.db_path, 1)
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET code='ABC-001',name='ABC-001-CD1.mp4' WHERE id=1")
        self.assertEqual(dispatch_api_get(self.contract, '/api/items', {})['total'], 1)

        @in_background
        def add():
            with self.contract.database.write_transaction() as connection:
                connection.execute("INSERT INTO asset(location,path,name,medium,size,code) VALUES(?,?,?,?,?,?)",
                                   ('local', r'R:\media\second.mp4', 'ABC-001-CD2.mp4', 'video', 2, 'ABC-001'))
        worker = threading.Thread(target=add)
        worker.start()
        worker.join()
        result = dispatch_api_get(self.contract, '/api/items', {})
        self.assertEqual(result['total'], 2)
        self.assertEqual(len(result['items']), 2)
        self.assertEqual(result['work_total'], 1)

    def test_sql_identity_rules_reuse_inputs_across_connections(self):
        from peach import repository
        with mock.patch.object(repository, 'is_jav_code', wraps=repository.is_jav_code) as identify:
            database = LedgerDatabase(self.db_path)
            for _ in range(3):
                with database.read_connection() as connection:
                    self.assertEqual(connection.execute('SELECT is_jav_code(?)', ('ABC-001',)).fetchone()[0], 1)
            self.assertEqual(identify.call_count, 1)
            with database.read_connection() as connection:
                self.assertEqual(connection.execute('SELECT is_jav_code(?)', ('plain',)).fetchone()[0], 0)
            self.assertEqual(identify.call_count, 2)

    def test_task_center_heartbeats_keep_the_cache(self):
        self.contract.cached_until_changed("review", self.compute)
        run = self.contract.task_runs.start("library-processing", trigger="manual")
        self.contract.task_runs.progress(run.id, current=5, total=10, throttle=0)
        self.contract.task_runs.heartbeat(run.id, throttle=0)
        self.assertEqual(self.contract.cached_until_changed("review", self.compute), 1)

    def test_catalog_cache_survives_download_progress_and_commit_notifications(self):
        from peach.downloads import DownloadStore, DownloadTask, POSTPROCESS_RUNNING
        tables = ('asset', 'asset_entity', 'entity')
        self.assertEqual(self.contract.cached_until_changed('catalog', self.compute, tables=tables), 1)
        task = DownloadStore(self.contract.database).save(DownloadTask(
            id=0, info_hash='a' * 40, provider='115', source_uri='', display_name='',
            target='/115/test', state='ingested'))
        DownloadStore(self.contract.database).postprocess(task.id, POSTPROCESS_RUNNING)
        self.contract.cache_bust()
        self.assertEqual(self.contract.cached_until_changed('catalog', self.compute, tables=tables), 1)
        insert_asset(self.db_path, 1)
        self.assertEqual(self.contract.cached_until_changed('catalog', self.compute, tables=tables), 2)

    def test_concurrent_catalog_requests_share_one_computation(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Event
        def check(tables):
            self.calls = 0
            entered, release = Event(), Event()
            def derive():
                self.calls += 1
                entered.set()
                release.wait(5)
                return self.calls
            key = repr(('catalog', tables))
            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(self.contract.cached_until_changed, key, derive, tables=tables)
                self.assertTrue(entered.wait(5))
                second = pool.submit(self.contract.cached_until_changed, key, derive, tables=tables)
                release.set()
                self.assertEqual((first.result(), second.result()), (1, 1))
            self.assertEqual(self.calls, 1)
        for tables in ((), ('asset',)):
            with self.subTest(tables=tables):
                check(tables)

    def test_a_changed_file_input_recomputes(self):
        self.contract.cached_until_changed("review", self.compute, "csv-1")
        self.assertEqual(self.contract.cached_until_changed("review", self.compute, "csv-1"), 1)
        self.assertEqual(self.contract.cached_until_changed("review", self.compute, "csv-2"), 2)
        self.assertEqual(len([key for key in self.contract.cache if key == "review"]), 1)

    def test_scoped_cache_without_revisions_honors_commit_invalidation(self):
        with closing(sqlite3.connect(self.db_path)) as connection, connection:
            connection.execute("DROP TABLE ledger_revision")
        self.assertEqual(self.contract.cached_until_changed('review', self.compute, tables=('genre_decision',)), 1)
        self.assertEqual(self.contract.cached_until_changed('review', self.compute, tables=('genre_decision',)), 1)
        self.contract.cache_bust()
        self.assertEqual(self.contract.cached_until_changed('review', self.compute, tables=('genre_decision',)), 2)

    def test_a_ledger_without_revisions_falls_back_to_the_time_limit(self):
        with closing(sqlite3.connect(self.db_path)) as connection, connection:
            connection.execute("DROP TABLE ledger_revision")
        self.assertIsNone(self.contract.ledger_revision())
        with mock.patch.object(web_state.time, "monotonic", return_value=1000.0):
            self.assertEqual(self.contract.cached_until_changed("ads", self.compute), 1)
            self.assertEqual(self.contract.cached_until_changed("ads", self.compute), 1)
        with mock.patch.object(web_state.time, "monotonic",
                               return_value=1000.0 + web_state.CACHE_TTL):
            self.assertEqual(self.contract.cached_until_changed("ads", self.compute), 2)

    def test_evicted_aggregates_take_their_locks_and_registrations_with_them(self):
        """按作者、按筛选口径的聚合键空间不封闭；结果被淘汰时锁与登记一起摘掉，两份不再增长。"""
        for index in range(3 * web_state.CACHE_KEYS):
            self.contract.cached_until_changed(f"author:{index}", self.compute, tables=("asset",))
        self.assertEqual(len(self.contract.cache), web_state.CACHE_KEYS)
        self.assertLessEqual(set(self.contract.aggregate_locks), set(self.contract.cache))
        self.assertLessEqual(self.contract.revision_cache_keys, set(self.contract.cache))
        # 被淘汰的键再来照常重算并重新登记。
        self.assertEqual(self.contract.cached_until_changed("author:0", self.compute, tables=("asset",)),
                         3 * web_state.CACHE_KEYS + 1)
        self.assertIn("author:0", self.contract.revision_cache_keys)

    def write_asset(self, asset_id: int, *, background: bool) -> None:
        def write():
            with self.contract.write_transaction() as connection:
                connection.execute(
                    "INSERT INTO asset(id,location,path,name,medium,size) VALUES(?,?,?,?,?,?)",
                    (asset_id, "local", f"R:\\media\\{asset_id}.mp4", f"{asset_id}.mp4", "video", 1))
        thread = threading.Thread(target=in_background(write) if background else write)
        thread.start()
        thread.join(5)

    def wait_refreshed(self, key: str) -> None:
        deadline = time.monotonic() + 5
        while key in self.contract.stale_refreshing and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertNotIn(key, self.contract.stale_refreshing)

    def test_background_commits_serve_the_previous_result_until_the_refresh_lands(self):
        """后台任务写账本后先回上一份、另起重算；写回后结果版本跟着变，页面再取拿到新值。"""
        self.assertEqual(self.contract.cached_until_changed("catalog", self.compute, tables=("asset",)), 1)
        before = dispatch_api_get(self.contract, "/api/result-updates", {})["result_versions"]["catalog"]
        self.write_asset(1, background=True)
        self.assertEqual(self.contract.cached_until_changed("catalog", self.compute, tables=("asset",)), 1)
        self.wait_refreshed("catalog")
        self.assertEqual(self.contract.cached_until_changed("catalog", self.compute, tables=("asset",)), 2)
        self.assertEqual(self.calls, 2)
        after = dispatch_api_get(self.contract, "/api/result-updates", {})["result_versions"]["catalog"]
        self.assertNotEqual(after, before)

    def test_foreground_and_out_of_process_writes_still_recompute_on_the_spot(self):
        """写的人要立刻看到自己写的：前台提交之后，以及命令行、账本同步这类进程外的写之后，都当场重算。"""
        self.assertEqual(self.contract.cached_until_changed("catalog", self.compute, tables=("asset",)), 1)
        self.write_asset(1, background=True)
        self.write_asset(2, background=False)
        self.assertEqual(self.contract.cached_until_changed("catalog", self.compute, tables=("asset",)), 2)
        insert_asset(self.db_path, 3)
        self.assertEqual(self.contract.cached_until_changed("catalog", self.compute, tables=("asset",)), 3)
        self.assertEqual(self.contract.stale_refreshing, set())

    def test_startup_warms_the_aggregates_every_page_reads(self):
        """重启后第一个打开页面的人不等形状名单、作品分组快照与推荐池一起冷算：开机就先算好。"""
        import asyncio
        from peach import api
        insert_asset(self.db_path, 1)
        # 只看每页都碰到的那几份；口味、复核、关注那几份另有后台线程，不在这条测试里起。
        pages = [entry for entry in api.WARM_AGGREGATES if entry[0] not in {"/api/taste", "/api/review", "/api/ads", "/api/follow"}]
        with mock.patch.object(api, "WARM_AGGREGATES", tuple(pages)):
            asyncio.run(api._warm_ledger_aggregates(True, self.contract, asyncio.Event()))
        for key in ("entity-shapes", "catalog-group-rows", "search-recommendations:"):
            self.assertIn(key, self.contract.cache)

    def test_a_commit_during_a_versioned_computation_keeps_the_result(self):
        def derive():
            self.calls += 1
            self.contract.cache_bust()
            return self.calls
        for tables in ((), ('asset',)):
            with self.subTest(tables=tables):
                self.calls = 0
                key = repr(('catalog', tables))
                self.assertEqual(self.contract.cached_until_changed(key, derive, tables=tables), 1)
                self.assertEqual(self.contract.cached_until_changed(key, derive, tables=tables), 1)


class _TableReads:
    """装在每条账本连接上的 SQLite authorizer，把读到的表记进所有正在算的声明帧。

    帧是一次按声明表缓存的计算（或口味、偏好、关注输入这类同样按声明表取版本的读）。
    嵌套的帧把读表同时计入外层：外层缓存的结果里包含内层的结果，内层依赖的表变了，
    外层也必须跟着变。
    """

    # json_each 只展开查询绑定的 JSON 参数，缓存失效由参数及其来源负责。
    IGNORED = frozenset({"ledger_revision", "sqlite_master", "sqlite_temp_master", "sqlite_schema", "json_each"})

    def __init__(self, virtual: set[str]):
        self.virtual = virtual
        self.stack: list[set[str]] = []
        self.frames: list[tuple[str, tuple[str, ...], set[str]]] = []

    def authorize(self, action, table, _column, _database, _trigger):
        if action == sqlite3.SQLITE_READ and table and self.stack:
            # FTS 的影子表算在它的虚表名下。
            table = next((name for name in self.virtual if table.startswith(name + "_")), table)
            if table not in self.IGNORED:
                for reads in self.stack:
                    reads.add(table)
        return sqlite3.SQLITE_OK

    def measure(self, label, declared, fn):
        reads: set[str] = set()
        self.stack.append(reads)
        try:
            return fn()
        finally:
            self.stack.pop()
            self.frames.append((str(label), tuple(declared), reads))


class DeclaredTablesTests(unittest.TestCase):
    """按声明表缓存的计算实际读到的账本表必须是声明的子集。

    漏声明一张表，那张表变了缓存照样命中，页面就一直是旧的。每条账本连接都装上
    authorizer 并关掉语句缓存（缓存命中的语句不再经过授权回调），每个场景前清空
    契约与模块级缓存，嵌套缓存的读表才会在外层的计算里出现。
    """

    MOMENT = datetime(2026, 8, 25, 9, 0, tzinfo=timezone.utc)

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name).resolve()
        self.db_path = fresh_ledger(self.root)
        store_root = self.root / "taste-history"
        store_root.mkdir()
        self.contract = WebContract(
            self.db_path, cover_root=self.root / "covers", avatar_root=self.root / "avatars",
            logo_root=self.root / "logos", candidate_root=self.root / "generated",
            follow_sources_root=self.root / "sources", follow_secrets_root=self.root / "secrets",
            follow_shared_root=self.root / "shared", follow_state_root=self.root / "state",
            entry_links_root=self.root / "state", taste_history_store=store_root / "history.sqlite",
            taste_history_import_root=store_root / "imports",
            taste_history_manifest=store_root / "manifest.json")
        self.addCleanup(self.contract.stop_background_jobs)
        self.contract.followups.stop()
        self._seed_ledger()
        self._seed_history(store_root / "history.sqlite")
        with closing(sqlite3.connect(self.db_path)) as connection:
            virtual = {row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE sql LIKE 'CREATE VIRTUAL TABLE%'")}
        self.reads = _TableReads(virtual)
        real_connect, raw_connect = LedgerDatabase.connect, sqlite3.connect

        def connect(database, *args, **kwargs):
            with mock.patch.object(sqlite3, "connect",
                                   lambda *a, **k: raw_connect(*a, cached_statements=0, **k)):
                connection = real_connect(database, *args, **kwargs)
            connection.set_authorizer(self.reads.authorize)
            return connection

        real_cached = WebContract.cached_until_changed

        def cached_until_changed(contract, key, fn, *inputs, tables=(), **options):
            return real_cached(contract, key, lambda: self.reads.measure(key, tables, fn),
                               *inputs, tables=tables, **options)

        real_inputs = web_follow._follow_inputs

        def follow_inputs(contract, connection):
            return self.reads.measure("follow-inputs", web_follow.FOLLOW_GROUP_TABLES,
                                      lambda: real_inputs(contract, connection))

        mock.patch.object(LedgerDatabase, "connect", connect).start()
        mock.patch.object(WebContract, "cached_until_changed", cached_until_changed).start()
        mock.patch.object(web_follow, "_follow_inputs", follow_inputs).start()
        self.addCleanup(mock.patch.stopall)

    def _seed_ledger(self):
        with closing(sqlite3.connect(self.db_path)) as connection, connection:
            connection.executemany(
                "INSERT INTO asset(id,location,path,name,medium,size,code,duration,width,height,"
                "play_count,o_count,feedback,snapshot_path,first_seen) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [(1, "local", r"R:\media\ABC-001.mp4", "ABC-001.mp4", "video", 100, "ABC-001", 600,
                  1920, 1080, 2, 1, "like", r"R:\snap\1.jpg", "2026-08-14"),
                 (2, "local", r"R:\media\two.mp4", "two.mp4", "video", 200, None, 90,
                  1080, 1920, None, None, None, r"R:\snap\2.jpg", "2026-08-13"),
                 (3, "local", r"R:\media\photo.jpg", "photo.jpg", "image", 10, None, None,
                  None, None, None, None, None, None, "2026-08-12"),
                 (4, "115", r"B:\four.mp4", "four.mp4", "video", 300, "XYZ-002", 1200,
                  1920, 1080, 1, None, "dislike", None, "2026-08-11")])
            connection.executemany(
                "INSERT INTO entity(id,kind,canonical_name,normalized_name,metadata_json,created_at,updated_at) "
                "VALUES(?,?,?,?,?,'2026-01-01','2026-01-01')",
                [(10, "tag", "足交", "足交", "{}"), (11, "performer", "Canonical Alice", "canonical alice", "{}"),
                 (12, "creator", "Canonical Creator", "canonical creator", "{}"),
                 (13, "studio", "Canonical Studio", "canonical studio", "{}"),
                 (14, "series", "Canonical Series", "canonical series", "{}"),
                 (15, "agency", "Canonical Agency", "canonical agency", "{}"),
                 (16, "tag", "隐藏标签", "隐藏标签", '{"user_tag_hidden": 1}'),
                 (17, "performer", "Male Bob", "male bob", '{"gender": "male"}')])
            connection.executemany(
                "INSERT INTO asset_entity(asset_id,entity_id,role,source,confidence) VALUES(?,?,?,?,1.0)",
                [(1, 10, "tag", "test"), (1, 11, "performer", "test"), (1, 12, "creator", "test"),
                 (1, 13, "studio", "test"), (1, 14, "series", "test"), (2, 12, "creator", "test"),
                 (4, 11, "performer", "test"), (4, 17, "performer", "test"), (4, 13, "studio", "test"),
                 (2, 16, "tag", "test")])
            connection.executemany(
                "INSERT INTO asset_tag(asset_id,tag,source) VALUES(?,?,?)",
                [(1, "足交", "name"), (2, "隐藏别名", "name"), (4, "足交", "name")])
            connection.executemany(
                "INSERT INTO entity_alias(entity_id,alias,normalized_alias,source,confidence) VALUES(?,?,?,?,1.0)",
                [(11, "Alice Alias", "alice alias", "test"), (16, "隐藏别名", "隐藏别名", "test")])
            connection.execute(
                "INSERT INTO entity_link(entity_id,link_kind,label,url,hostname,created_at,updated_at) "
                "VALUES(11,'social','OnlyFans','https://onlyfans.com/alice','onlyfans.com','2026-01-01','2026-01-01')")
            connection.execute(
                "INSERT INTO entity_membership(member_id,agency_id,source,confidence,checked_at) "
                "VALUES(11,15,'test',1.0,'2026-01-01')")
            connection.execute(
                "INSERT INTO entity_classification(entity_id,facet,value,source,evidence,status,confidence,checked_at) "
                "VALUES(11,'identity','person','user:test','test','approved',1.0,'2026-01-01')")
            connection.executemany(
                "INSERT INTO asset_preference(profile_id,asset_id,liked,source,updated_at) "
                "VALUES('local-default',?,?,'test','2026-08-20')", [(1, 1), (4, 0)])
            connection.execute(
                "INSERT INTO asset_tag_preference(profile_id,asset_id,normalized_tag,hidden,updated_at) "
                "VALUES('local-default',2,'隐藏别名',1,'2026-08-20')")
            connection.execute(
                "INSERT INTO watch_queue(profile_id,asset_id,added_at,source) "
                "VALUES('local-default',2,'2026-08-20','test')")
            connection.execute(
                "UPDATE profile SET settings_json=? WHERE id='local-default'",
                (json.dumps({"libraryShortcuts": {"favorites": [
                    {"entity_id": 11}, {"kind": "tag", "name": "足交"},
                    {"kind": "tag", "scope": "online", "tag_id": "animation", "name": "animation"}]}}),))
        with self.contract.database.write_transaction() as connection:
            store = FollowStore(lambda: connection, sources_root=self.contract.follow_sources_root)
            source_id = store.register(provider="rule34video", ref="alice", label="Alice",
                                       url="https://rule34video.test/alice", semantics="work",
                                       moment=self.MOMENT)
            store.record(source_id, SourceFetch(
                provider="rule34video", ref="alice", request_url="https://rule34video.test/alice",
                semantics="work", raw_body=b"<html/>", candidates=(
                    FollowCandidate(provider="rule34video", external_id="1", title="Fiona - Paizuri",
                                    url="https://rule34video.com/video/1/x/", duration=20.0,
                                    media_url="https://example.test/1.mp4",
                                    thumb_url="https://rule34video.com/t/1.jpg",
                                    extra={"tags": ["animation", "fiona"],
                                           "tag_types": {"animation": "general", "fiona": "character"}},
                                    published_at="2026-08-18T00:00:00Z"),
                    FollowCandidate(provider="rule34video", external_id="2", title="Fiona - Paizuri (Nude)",
                                    url="https://rule34video.com/video/2/x/",
                                    thumb_url="https://rule34video.com/t/2.jpg"))),
                moment=self.MOMENT)
            items = store.items()
            store.save_asset(items[0].id, confirm=True)
            store.record_playback(items[1].id, moment=self.MOMENT)
            connection.execute(
                "INSERT INTO follow_author_alias(alias_key,alias_name,canonical_key,canonical_name,"
                "source,created_at,updated_at) VALUES('alice2','Alice2','alice','Alice','manual',"
                "'2026-01-01','2026-01-01')")

    @staticmethod
    def _seed_history(path: Path):
        with closing(sqlite3.connect(path)) as store, store:
            taste_history._prepare_store(store)
            store.execute("INSERT INTO history_source VALUES('s','chrome','Default','host','h',"
                          "'2026-08-01T00:00:00+00:00','2026-08-20T00:00:00+00:00')")
            store.executemany(
                "INSERT INTO history_visit VALUES('s',?,?,?,?)",
                [("1", "2026-08-10T10:00:00+00:00", "https://onlyfans.com/alice", "Alice"),
                 ("2", "2026-08-11T10:00:00+00:00", "https://rule34.xxx/index.php?tags=feet", "Canonical Alice"),
                 ("3", "2026-08-12T10:00:00+00:00", "https://example.com/Canonical-Creator", "Canonical Creator")])
            store.execute("INSERT INTO history_bookmark VALUES('s','https://onlyfans.com/alice','Alice',"
                          "'2026-08-10T10:00:00+00:00')")

    def _fresh(self):
        """清掉契约与模块级的结果缓存，下一次计算从账本读起。"""
        self.contract.cache.clear()
        self.contract.keyed_cache.clear()
        for cache in (taste_history._HISTORY_ROWS, taste_history._LINKED_SIGNALS,
                      taste_history._PREFERENCE_VISITS, taste_preferences._PROFILES):
            cache.clear()

    def _get(self, path, **args):
        self._fresh()
        return dispatch_api_get(self.contract, path, args)

    def test_json_parameter_expansion_tracks_the_queried_ledger_table(self):
        with self.contract.database.read_connection() as connection:
            rows = self.reads.measure('selected-assets', ('asset',), lambda: connection.execute(
                'SELECT id FROM asset WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id',
                ('[1,3]',)).fetchall())
        self.assertEqual([row[0] for row in rows], [1, 3])
        self.assertEqual(self.reads.frames[-1][2], {'asset'})

    def test_cached_computations_read_only_their_declared_tables(self):
        for state in ("", "fresh", "played", "flagged", "later"):
            for jav in ("", "1"):
                self._get("/api/tops", state=state, jav=jav, n="4", seed="s")
                self._get("/api/facets", state=state, jav=jav)
            self._get("/api/items", state=state, limit="10")
        for loc in ("online", "local", "115"):
            self._get("/api/facets", loc=loc)
            self._get("/api/items", loc=loc, limit="10")
        self._get("/api/parts", id="1")
        self._get("/api/item", id="1")
        for kind in ("performers", "creators", "studios", "agencies", "tags"):
            self._get("/api/index", kind=kind)
        self._get("/api/stats")
        self._get("/api/folders")
        self._get("/api/ads", limit="10")
        self._get("/api/duplicates", limit="10")
        with closing(sqlite3.connect(self.db_path)) as connection:
            source_id, item_id = (str(connection.execute(f"SELECT min(id) FROM {table}").fetchone()[0])
                                  for table in ("follow_source", "follow_item"))
        for args in ({}, {"summary": "1"}, {"item": item_id}, {"source": source_id},
                     {"author": "Alice"}, {"status": "new", "sort": "old"}, {"offset": "1"}):
            self._get("/api/follow", **args)
        self._fresh()
        web_follow.cover_alternatives(self.contract, int(item_id))
        self._fresh()
        self.reads.measure("taste", web_stats.TASTE_TABLES,
                           lambda: web_stats.q_taste(self.contract, {"window": "all"}))
        self._fresh()
        with self.contract.database.read_connection() as connection:
            self.reads.measure("preference-profile", taste_preferences.PROFILE_TABLES,
                               lambda: taste_preferences.preference_profile(
                                   connection, self.contract.taste_history_store, cache=False))

        declarations = {
            "GROUP_TABLES": GROUP_TABLES, "TOPS_TABLES": TOPS_TABLES,
            "FACETS_TABLES": FACETS_TABLES, "INDEX_TABLES": INDEX_TABLES,
            "STATS_TABLES": web_stats.STATS_TABLES, "PLAY_STATS_TABLES": web_stats.PLAY_STATS_TABLES,
            "CATALOG_TOTAL_TABLES": CATALOG_TOTAL_TABLES,
            "FOLLOW_GROUP_TABLES": web_follow.FOLLOW_GROUP_TABLES,
            "TASTE_TABLES": web_stats.TASTE_TABLES,
            "PROFILE_TABLES": taste_preferences.PROFILE_TABLES,
            "JUNK_SCORE_TABLES": web_batch.JUNK_SCORE_TABLES,
            "DUPLICATE_TABLES": web_batch.DUPLICATE_TABLES}
        names = {tuple(tables): name for name, tables in declarations.items()}
        leaks: dict[str, set[str]] = {}
        for label, declared, reads in self.reads.frames:
            # asset_catalog 是 asset 除起播计数和观看进度之外的修订号。
            represented = set(declared) | ({'asset'} if 'asset_catalog' in declared else set())
            extra = reads - represented
            if declared and extra:
                leaks.setdefault(names.get(declared, label), set()).update(extra)
        self.maxDiff = None
        self.assertEqual({name: sorted(extra) for name, extra in leaks.items()}, {},
                         "这些计算读到了没有声明的表")
        exercised = {declared for _, declared, reads in self.reads.frames if reads}
        for name, tables in declarations.items():
            self.assertIn(tuple(tables), exercised, f"{name} 没有被任何场景跑到")


class CoverIndexTests(unittest.TestCase):
    """封面索引只认封面目录：账本提交与时间都不让它重扫，换名写入的封面与边车立刻生效。"""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.db_path = fresh_ledger(self.directory.name)
        self.covers = Path(self.directory.name) / "covers"
        self.covers.mkdir()
        (self.covers / "ABC-001.jpg").write_bytes(b"jpg")
        # 目录一分钟前就写完了：刚写过的目录只给短时效，见下面的「还在写」用例。
        self.settled = web_state.time.time_ns() - 60 * 1_000_000_000
        os.utime(self.covers, ns=(self.settled, self.settled))
        self.contract = WebContract(self.db_path, cover_root=self.covers)
        self.scans = mock.patch.object(
            self.contract, "_scan_cover_root", wraps=self.contract._scan_cover_root).start()
        self.addCleanup(mock.patch.stopall)

    def test_commits_and_elapsed_time_keep_the_index(self):
        self.assertTrue(self.contract.has_cover("ABC-001"))
        self.contract.cache_bust()
        insert_asset(self.db_path, 1)
        with mock.patch.object(web_state.time, "monotonic",
                               return_value=web_state.time.monotonic() + 10 * web_state.CACHE_TTL):
            self.assertTrue(self.contract.has_cover("ABC-001"))
        self.assertEqual(self.scans.call_count, 1)

    def test_rewritten_sidecars_and_added_or_removed_covers_show_up_at_once(self):
        from peach import jav_poster_crop
        moments = iter(range(1, 100))

        def changed():
            # 换名会改目录时间；连着几次写入可能落在同一个时钟刻度里，那是下一条用例的
            # 场景。这里每次都钉到一个新的时间，只看「目录时间变了就重扫」。
            stamp = self.settled + next(moments) * 1_000_000
            os.utime(self.covers, ns=(stamp, stamp))

        self.assertIsNone(self.contract.poster_box("ABC-001"))
        jav_poster_crop.write_sidecar(self.covers / "ABC-001.jpg", jav_poster_crop.manual_record(
            800, 538, {"x0": 420, "y0": 0, "x1": 800, "y1": 538}))
        changed()
        self.assertEqual(self.contract.poster_box("ABC-001")["x0"], 420)
        jav_poster_crop.write_sidecar(self.covers / "ABC-001.jpg", jav_poster_crop.manual_record(
            800, 538, {"x0": 400, "y0": 0, "x1": 800, "y1": 538}))
        changed()
        self.assertEqual(self.contract.poster_box("ABC-001")["x0"], 400)
        self.assertFalse(self.contract.has_cover("XYZ-002"))
        (self.covers / "XYZ-002.jpg").write_bytes(b"jpg")
        changed()
        self.assertTrue(self.contract.has_cover("XYZ-002"))
        (self.covers / "XYZ-002.jpg").unlink()
        changed()
        self.assertFalse(self.contract.has_cover("XYZ-002"))

    def test_a_scan_of_a_directory_still_being_written_is_not_kept(self):
        """换名落在同一个时钟刻度里，目录时间不变；刚写过的目录扫出的索引只按短时效缓存，
        目录静下来之后重扫一次，才无限期缓存。"""
        tick = web_state.time.time_ns()

        def same_tick_install(name):
            (self.covers / name).write_bytes(b"jpg")
            os.utime(self.covers, ns=(tick, tick))

        same_tick_install("XYZ-002.jpg")
        self.assertTrue(self.contract.has_cover("XYZ-002"))
        same_tick_install("XYZ-003.jpg")
        later = web_state.time.monotonic() + web_state.SETTLE_TTL + 1
        with mock.patch.object(web_state.time, "monotonic", return_value=later):
            self.assertTrue(self.contract.has_cover("XYZ-003"))
        same_tick_install("XYZ-004.jpg")
        settled = tick + (web_state.SETTLE_SECONDS + 1) * 1_000_000_000
        with mock.patch.object(web_state.time, "time_ns", return_value=settled):
            self.assertTrue(self.contract.has_cover("XYZ-004"))
            scans = self.scans.call_count
            with mock.patch.object(web_state.time, "monotonic", return_value=later + 10 * web_state.CACHE_TTL):
                self.assertTrue(self.contract.has_cover("XYZ-004"))
        self.assertEqual(self.scans.call_count, scans, "目录静下来之后的那一份一直用到目录再变")


class ArtworkIndexTests(unittest.TestCase):
    """标识、实体图与头像索引同样只认目录时间：刚写过的目录扫出的结果只按短时效缓存。"""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.logos, self.avatars = root / "logos", root / "avatars"
        self.logos.mkdir()
        self.avatars.mkdir()
        self.contract = WebContract(fresh_ledger(root), logo_root=self.logos, avatar_root=self.avatars,
                                    marks_root=root / "marks")

    def test_an_install_in_the_same_clock_tick_as_the_last_scan_shows_up_shortly(self):
        tick = web_state.time.time_ns()
        later = web_state.time.monotonic() + web_state.SETTLE_TTL + 1
        cases = (
            (self.logos, logo_key("Studio A") + ".img", lambda: self.contract.has_logo("Studio A")),
            (self.avatars, entity_image_key("performer", 11) + ".img",
             lambda: self.contract.has_entity_image("performer", 11)),
            (self.avatars, "42.jpg", lambda: 42 in self.contract.avatar_root_index().generated),
        )
        for root, name, present in cases:
            with self.subTest(name=name):
                # 上一格在推后的时钟下存的那份不能留给这一格。
                self.contract.cache.clear()
                os.utime(root, ns=(tick, tick))
                self.assertFalse(present())
                (root / name).write_bytes(b"img")
                os.utime(root, ns=(tick, tick))
                with mock.patch.object(web_state.time, "monotonic", return_value=later):
                    self.assertTrue(present())

    def test_a_settled_directory_keeps_its_index_until_the_time_limit(self):
        settled = web_state.time.time_ns() - 60 * 1_000_000_000
        os.utime(self.logos, ns=(settled, settled))
        scans = mock.patch.object(self.contract, "_scan_logo_root",
                                  wraps=self.contract._scan_logo_root).start()
        self.addCleanup(mock.patch.stopall)
        self.contract.has_logo("Studio A")
        self.contract.has_logo("Studio B")
        self.assertEqual(scans.call_count, 1)
        with mock.patch.object(web_state.time, "monotonic",
                               return_value=web_state.time.monotonic() + web_state.CACHE_TTL + 1):
            self.contract.has_logo("Studio A")
        self.assertEqual(scans.call_count, 2)


class ResultVersionTablesTests(unittest.TestCase):
    """页面按结果版本键刷新（`frontend/src/react/result-updates.tsx` 的 `READINGS`）。

    服务端按表缓存的那几页，实际读到的表（`DeclaredTablesTests` 实测核对过的声明）必须
    落在刷新这一页的某个版本键里：漏了，服务端已经换了新结果，页面却不来取。
    """

    #: 由按表缓存供数的页面 → 刷新它的版本键。与 `READINGS` 对应，前端那一半由
    #: `frontend/test/react/result-updates.test.tsx` 核对。
    REFRESHED_BY = {
        "catalog-grid": ("catalog",),
        "catalog-totals": ("catalog", "follow"),
        "index": ("catalog", "follow", "discoveries"),
        "stats": ("catalog", "follow"),
        "taste": ("catalog", "follow"),
        "follow-feed": ("catalog", "follow"),
    }
    #: 刻意不刷新的组合：在线播放每十秒写一次 `follow_playback`，跟着它刷新的话，看片
    #: 期间整组页面每次心跳重取一遍；统计页的在线播放读数等下一次别的写入再更新。
    EXEMPT = {("stats", "follow_playback")}

    def test_every_cached_page_is_refreshed_by_the_tables_it_reads(self):
        from peach.web_result_versions import RESULT_TABLES
        declared = {
            "catalog-grid": GROUP_TABLES, "index": INDEX_TABLES, "stats": web_stats.STATS_TABLES,
            "catalog-totals": CATALOG_TOTAL_TABLES,
            "taste": web_stats.TASTE_TABLES, "follow-feed": web_follow.FOLLOW_GROUP_TABLES,
        }
        missing = {}
        for page, keys in self.REFRESHED_BY.items():
            covered = set().union(*(RESULT_TABLES[key] for key in keys))
            gap = {table for table in declared[page] if table not in covered
                   and (page, table) not in self.EXEMPT}
            if gap:
                missing[page] = sorted(gap)
        self.assertEqual(missing, {}, "这些页面读到的表变了，结果版本却不变")


if __name__ == "__main__":
    unittest.main()
