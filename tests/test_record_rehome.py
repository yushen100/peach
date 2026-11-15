"""已消失行的个人记录接到新文件（ADR-0087 决策二）。

登记那一侧走真的 `scan.scan_location` 与 `scan.ingest_path`：全量扫描与推送发现是两条
登记路径，接回要在两条上都发生。数据库路径前缀使用 `R:\\media`，挂载表指向临时目录，支持跨平台验证。
"""
from __future__ import annotations

import importlib.util
import io
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing, redirect_stdout
from pathlib import Path

from peach import personal_records, record_rehome, scan
from peach.migrations import upgrade

ROOT = Path(__file__).resolve().parents[1]
DECLARED = {"local": ("R:\\media",)}


class RecordRehomeTests(unittest.TestCase):
    def test_follow_reference_moves_with_the_asset_and_reverts_with_its_batch(self):
        self.add_vanished(7, r'R:\media\old\EXM-001.mp4', code='EXM-001', records=False)
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium) "
                               "VALUES(8,'local','new.mp4','new.mp4','video')")
            connection.execute("INSERT INTO follow_source(id,provider,ref,label,url,created_at,updated_at) "
                               "VALUES(1,'test','sample','sample','https://example.test/','now','now')")
            connection.execute("INSERT INTO follow_item(id,source_id,external_id,title,release_key,asset_id,"
                               "first_seen_at,last_seen_at) VALUES(1,1,'item','item','item',7,'now','now')")
            baseline = connection.execute('PRAGMA foreign_key_check').fetchall()
            batch = record_rehome.move(connection, 7, 8, source='test', rule='same-release')
            self.assertEqual(connection.execute('SELECT asset_id FROM follow_item').fetchall(), [(8,)])
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), baseline)
            record_rehome.revert_one(connection, batch)
            self.assertEqual(connection.execute('SELECT asset_id FROM follow_item').fetchall(), [(7,)])
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), baseline)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.db = self.root / "ledger.db"
        upgrade(self.db, ROOT / "migrations")
        self.media = self.root / "media"
        self.media.mkdir()
        self.mounts = {"local": (str(self.media),)}
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("INSERT INTO playlist(id,profile_id,name,current_asset_id,created_at,updated_at) "
                               "VALUES(1,'default','收藏',NULL,'2026-01-01','2026-01-01')")
            connection.commit()

    def add_vanished(self, asset_id, path, *, code=None, creator=None, duration=None, records=True):
        """一条已消失的旧行；`records` 时带上六张表里的记录，各一条。"""
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute(
                "INSERT INTO asset(id,location,path,name,medium,size,code,creator,duration,rating,disposal) "
                "VALUES(?,'local',?,?,'video',10,?,?,?,4,'vanished')",
                (asset_id, path, path.rsplit("\\", 1)[-1], code, creator, duration))
            connection.execute("INSERT INTO asset_tag(asset_id,tag,source) VALUES(?,'旧标签','name')", (asset_id,))
            if records:
                self.add_records(connection, asset_id)
            connection.commit()

    @staticmethod
    def add_records(connection, asset_id, *, liked=1):
        connection.execute("INSERT INTO asset_preference(profile_id,asset_id,liked,reason,updated_at) "
                           "VALUES('default',?,?,'旧的','2026-01-01')", (asset_id, liked))
        connection.execute("INSERT INTO watch_queue(profile_id,asset_id,added_at) VALUES('default',?,'2026-01-01')",
                           (asset_id,))
        connection.execute("INSERT INTO playlist_item(playlist_id,asset_id,position,added_at) "
                           "VALUES(1,?,?,'2026-01-01')", (asset_id, asset_id))
        connection.execute("UPDATE playlist SET current_asset_id=? WHERE id=1", (asset_id,))
        connection.execute("INSERT INTO asset_quality_goal(profile_id,asset_id,wanted,reason,updated_at) "
                           "VALUES('default',?,1,'要高清','2026-01-01')", (asset_id,))
        connection.execute("INSERT INTO activity_event(asset_id,profile_id,kind,occurred_at,position_seconds,source) "
                           "VALUES(?,'default','climax','2026-01-01',61.5,'web')", (asset_id,))
        connection.execute("INSERT INTO asset_tag_preference(profile_id,asset_id,normalized_tag,hidden,updated_at) "
                           "VALUES('default',?,'旧标签',1,'2026-01-01')", (asset_id,))

    def put(self, relative: str) -> str:
        path = self.media.joinpath(*relative.split("/"))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"0" * 10)
        return "R:\\media\\" + relative.replace("/", "\\")

    def scan_all(self):
        with redirect_stdout(io.StringIO()):
            return scan.scan_location(self.db, "local", "R:\\media", declared_roots=DECLARED,
                                      mounts=self.mounts, windows=False)

    def ingest(self, path):
        return scan.ingest_path(self.db, "local", path, declared_roots=DECLARED, mounts=self.mounts,
                                windows=False)

    def query(self, sql, params=()):
        with closing(sqlite3.connect(self.db)) as connection:
            return connection.execute(sql, params).fetchall()

    def owner(self, table):
        return sorted({row[0] for row in self.query(f"SELECT asset_id FROM {table}")})

    def id_of(self, path):
        return self.query("SELECT id FROM asset WHERE path=?", (path,))[0][0]

    def test_a_file_back_at_its_path_clears_vanished_on_the_same_row(self):
        path = self.put("ABC-123.mp4")
        self.add_vanished(7, path, code="ABC-123")
        result = self.scan_all()
        self.assertEqual(self.query("SELECT id,disposal FROM asset"), [(7, None)])
        self.assertEqual(result.new_ids, ())
        self.assertEqual(self.query("SELECT count(*) FROM record_rehome"), [(0,)])

    def test_a_full_scan_moves_all_records_to_the_one_new_file_with_the_same_code(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123", duration=3600)
        new_path = self.put("hd/ABC-123.mkv")
        result = self.scan_all()
        new_id = self.id_of(new_path)
        self.assertEqual(result.reattached, 1)
        self.assertEqual(self.query("SELECT id FROM asset"), [(new_id,)], "旧行搬完就删")
        for table in ("asset_preference", "watch_queue", "playlist_item", "asset_quality_goal",
                      "activity_event", "asset_tag_preference"):
            self.assertEqual(self.owner(table), [new_id], table)
        self.assertEqual(self.query("SELECT current_asset_id FROM playlist"), [(new_id,)])
        self.assertEqual(self.query("SELECT position_seconds FROM activity_event"), [(61.5,)])
        goal = self.query("SELECT wanted,replaced_at IS NOT NULL FROM asset_quality_goal")
        self.assertEqual(goal, [(0, 1)], "寻找更好版本随记录搬过去后关闭，标已替换")
        self.assertEqual(self.owner("asset_tag"), [], "资料不在搬运范围内，留在快照里")
        batch = self.query("SELECT source,rule,old_asset_id,new_asset_id FROM record_rehome")
        self.assertEqual(batch, [(record_rehome.AUTO_SOURCE, "code", 7, new_id)])

    def test_push_discovery_ingest_moves_records_too(self):
        self.add_vanished(7, "R:\\media\\old\\SSIS-950.mp4", code="SSIS-950")
        new_path = self.put("SSIS-950.mkv")
        result = self.ingest(new_path)
        self.assertTrue(result.new)
        self.assertEqual(result.reattached, 1)
        self.assertEqual(self.owner("asset_preference"), [result.asset_id])
        self.assertEqual(self.query("SELECT count(*) FROM asset WHERE id=7"), [(0,)])

    def test_new_row_records_win_over_the_moved_ones(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123")
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium,size) "
                               "VALUES(9,'local','R:\\media\\ABC-123.mkv','ABC-123.mkv','video',10)")
            connection.execute("INSERT INTO asset_preference(profile_id,asset_id,liked,reason,updated_at) "
                               "VALUES('default',9,0,'新的','2026-02-01')")
            record_rehome.move(connection, 7, 9, source=record_rehome.MANUAL_SOURCE, rule="manual")
            connection.commit()
        self.assertEqual(self.query("SELECT asset_id,reason FROM asset_preference"), [(9, "新的")])
        self.assertEqual(self.owner("watch_queue"), [9])

    def test_several_new_files_pick_the_closest_duration_or_wait_for_a_person(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123", duration=3600)
        near, far = self.put("a/ABC-123.mp4"), self.put("b/ABC-123.mp4")
        result = self.scan_all()
        self.assertEqual(result.reattached, 0, "登记那一刻新文件还没有时长，分不出")
        self.assertEqual(self.owner("asset_preference"), [7])
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("UPDATE asset SET duration=3598 WHERE path=?", (near,))
            connection.execute("UPDATE asset SET duration=1800 WHERE path=?", (far,))
            connection.commit()
        self.assertEqual(record_rehome.reattach_in(self.db, list(result.new_ids)), 1)
        self.assertEqual(self.owner("asset_preference"), [self.id_of(near)])

    def test_two_vanished_rows_with_one_code_are_left_for_a_person(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123-1.mp4", code="ABC-123")
        self.add_vanished(8, "R:\\media\\old\\ABC-123-2.mp4", code="ABC-123")
        self.put("ABC-123.mp4")
        self.assertEqual(self.scan_all().reattached, 0)
        self.assertEqual(self.owner("asset_preference"), [7, 8])

    def test_a_creator_video_without_code_matches_creator_stem_and_duration(self):
        self.add_vanished(7, "R:\\media\\桃子\\old\\海边.mp4", creator="桃子", duration=600)
        path = self.put("桃子/2026/海边.mp4")
        result = self.scan_all()
        self.assertEqual(result.reattached, 0, "登记时还没有时长")
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("UPDATE asset SET duration=601 WHERE path=?", (path,))
            connection.commit()
        self.assertEqual(record_rehome.reattach_in(self.db, list(result.new_ids)), 1)
        self.assertEqual(self.owner("watch_queue"), [self.id_of(path)])

    def test_a_creator_video_under_another_creator_is_not_matched(self):
        self.add_vanished(7, "R:\\media\\桃子\\海边.mp4", creator="桃子", duration=600)
        path = self.put("别人/海边.mp4")
        result = self.scan_all()
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("UPDATE asset SET duration=600 WHERE path=?", (path,))
            connection.commit()
        self.assertEqual(record_rehome.reattach_in(self.db, list(result.new_ids)), 0)

    def test_revert_rebuilds_the_old_row_and_points_records_back(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123", duration=3600)
        new_path = self.put("ABC-123.mp4")
        self.scan_all()
        new_id = self.id_of(new_path)
        with closing(sqlite3.connect(self.db)) as connection:
            planned = record_rehome.planned_revert(connection, record_rehome.AUTO_SOURCE)
        self.assertEqual([item["old_asset_id"] for item in planned], [7])
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(record_rehome.planned_revert(
                connection, record_rehome.MANUAL_SOURCE, planned[0]["batch"]), [],
                "别的来源的批次号一条都不认")
        spec = importlib.util.spec_from_file_location(
            "revert_auto_landing_under_test", ROOT / "scripts" / "revert_auto_landing.py")
        script = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(script)
        with redirect_stdout(io.StringIO()) as printed:
            self.assertEqual(script.main([
                "--db", str(self.db), "--logo-root", str(self.root / "logos"),
                "--source", record_rehome.AUTO_SOURCE, "--batch", planned[0]["batch"],
                "--apply", "--backup", str(self.root / "backup.db")]), 0)
        self.assertIn("'reverted_rehomes': 1", printed.getvalue())
        self.assertEqual(self.query("SELECT id,disposal,rating FROM asset ORDER BY id"),
                         [(7, "vanished", 4), (new_id, None, None)])
        for table in ("asset_preference", "watch_queue", "playlist_item", "asset_quality_goal",
                      "activity_event", "asset_tag_preference", "asset_tag"):
            self.assertEqual(self.owner(table), [7], table)
        self.assertEqual(self.query("SELECT wanted,replaced_at FROM asset_quality_goal"), [(1, None)])
        self.assertEqual(self.query("SELECT current_asset_id FROM playlist"), [(7,)])
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(record_rehome.planned_revert(connection, record_rehome.AUTO_SOURCE), [])

    def test_revert_refuses_when_the_old_id_is_taken(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123")
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium,size) "
                               "VALUES(9,'local','R:\\media\\ABC-123.mkv','ABC-123.mkv','video',10)")
            batch = record_rehome.move(connection, 7, 9, source=record_rehome.MANUAL_SOURCE, rule="manual")
            connection.execute("INSERT INTO asset(id,location,path,name,medium,size) "
                               "VALUES(7,'local','R:\\media\\other.mp4','other.mp4','video',10)")
            with self.assertRaisesRegex(ValueError, "已被占用"):
                record_rehome.revert_one(connection, batch)
            snapshot = json.loads(connection.execute(
                "SELECT snapshot_json FROM record_rehome WHERE id=?", (batch,)).fetchone()[0])
        self.assertEqual(snapshot["asset"]["rating"], 4, "行上的打分留在快照里")

    def add_live(self, asset_id, path, *, code=None, duration=None):
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium,size,code,duration) "
                               "VALUES(?,'local',?,?,'video',10,?,?)",
                               (asset_id, path, path.rsplit("\\", 1)[-1], code, duration))
            connection.commit()

    def reattach_vanished(self, *old_ids):
        with closing(sqlite3.connect(self.db)) as connection:
            moved = record_rehome.reattach_vanished(connection, old_ids)
            connection.commit()
        return moved

    def test_a_row_that_just_vanished_moves_to_the_one_version_already_in_the_library(self):
        self.add_live(9, "R:\\media\\hd\\ABC-123.mkv", code="ABC-123")
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123")
        self.assertEqual(self.reattach_vanished(7), [7])
        self.assertEqual(self.owner("asset_preference"), [9])
        self.assertEqual(self.query("SELECT source,rule,old_asset_id,new_asset_id FROM record_rehome"),
                         [(record_rehome.AUTO_SOURCE, "code", 7, 9)])

    def test_a_row_that_just_vanished_with_two_versions_and_no_duration_stays_an_orphan(self):
        self.add_live(9, "R:\\media\\a\\ABC-123.mkv", code="ABC-123")
        self.add_live(10, "R:\\media\\b\\ABC-123.mp4", code="ABC-123")
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123")
        self.assertEqual(self.reattach_vanished(7), [])
        self.assertEqual(self.owner("asset_preference"), [7])

    def test_only_the_rows_that_just_vanished_are_moved(self):
        self.add_live(9, "R:\\media\\ABC-123.mkv", code="ABC-123")
        self.add_live(10, "R:\\media\\XYZ-001.mkv", code="XYZ-001")
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123")
        self.add_vanished(8, "R:\\media\\old\\XYZ-001.mp4", code="XYZ-001")
        self.assertEqual(self.reattach_vanished(8), [8])
        self.assertEqual(self.owner("watch_queue"), [7, 10], "不是这一轮标的孤儿不跟着搬")

    def test_a_creator_video_that_just_vanished_matches_creator_stem_and_duration(self):
        self.add_live(9, "R:\\media\\桃子\\2026\\海边.mp4", duration=601)
        self.add_live(10, "R:\\media\\别人\\海边.mp4", duration=600)
        self.add_vanished(7, "R:\\media\\桃子\\old\\海边.mp4", creator="桃子", duration=600)
        self.assertEqual(self.reattach_vanished(7), [7])
        self.assertEqual(self.owner("watch_queue"), [9])

    def test_each_of_the_four_row_columns_alone_counts_as_records(self):
        with closing(sqlite3.connect(self.db)) as connection:
            connection.executemany(
                "INSERT INTO asset(id,location,path,name,medium,size,rating,o_count,play_count,last_played) "
                "VALUES(?,'local',?,'x.mp4','video',10,?,?,?,?)",
                [(1, "R:\\media\\1.mp4", 3, None, 0, None), (2, "R:\\media\\2.mp4", None, 2, 0, None),
                 (3, "R:\\media\\3.mp4", None, None, 5, None), (4, "R:\\media\\4.mp4", None, None, 0, 1700.0),
                 (5, "R:\\media\\5.mp4", None, 0, 0, None)])
            self.assertEqual(personal_records.record_holders(connection, [1, 2, 3, 4, 5]), {1, 2, 3, 4})
            self.assertEqual(personal_records.record_counts(connection, [1, 2, 3, 4, 5]), {
                1: {"rating": 3}, 2: {"o_count": 2}, 3: {"play_count": 5}, 4: {"last_played": 1}, 5: {}})

    def row_records(self, asset_id):
        """行上四列；`last_played` 是 TEXT 列，写进去的 epoch 秒读回来是文本。"""
        return self.query("SELECT rating,o_count,play_count,last_played FROM asset WHERE id=?", (asset_id,))[0]

    def test_row_records_fold_into_the_new_row_and_revert_restores_both(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123")
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("UPDATE asset SET o_count=2,play_count=3,last_played=1000.0 WHERE id=7")
            connection.execute(
                "INSERT INTO asset(id,location,path,name,medium,size,rating,o_count,play_count,last_played) "
                "VALUES(9,'local','R:\\media\\ABC-123.mkv','ABC-123.mkv','video',10,5,NULL,1,2000.0)")
            batch = record_rehome.move(connection, 7, 9, source=record_rehome.MANUAL_SOURCE, rule="manual")
            connection.commit()
        self.assertEqual(self.row_records(9), (5, 2, 4, "2000.0"),
                         "评分新行有就留新行的；次数相加；最近播放取较晚的")
        with closing(sqlite3.connect(self.db)) as connection:
            record_rehome.revert_one(connection, batch)
            connection.commit()
        self.assertEqual(self.row_records(9), (5, None, 1, "2000.0"), "新行还原成接回前的值")
        self.assertEqual(self.row_records(7), (4, 2, 3, "1000.0"), "旧行按快照重建")

    def test_an_unrated_new_row_takes_the_old_rating_and_the_later_play(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123")
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("UPDATE asset SET play_count=2,last_played=3000.0 WHERE id=7")
            connection.execute("INSERT INTO asset(id,location,path,name,medium,size,last_played) "
                               "VALUES(9,'local','R:\\media\\ABC-123.mkv','ABC-123.mkv','video',10,1000.0)")
            record_rehome.move(connection, 7, 9, source=record_rehome.MANUAL_SOURCE, rule="manual")
            connection.commit()
        self.assertEqual(self.row_records(9), (4, None, 2, "3000.0"))

    def test_move_only_takes_a_vanished_row_onto_an_in_library_row(self):
        self.add_vanished(7, "R:\\media\\old\\ABC-123.mp4", code="ABC-123")
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium,size,disposal) "
                               "VALUES(9,'local','R:\\media\\x.mp4','x.mp4','video',10,'trash')")
            with self.assertRaisesRegex(ValueError, "在库"):
                record_rehome.move(connection, 7, 9, source=record_rehome.MANUAL_SOURCE, rule="manual")
            with self.assertRaisesRegex(ValueError, "已消失"):
                record_rehome.move(connection, 9, 7, source=record_rehome.MANUAL_SOURCE, rule="manual")

    # 以下：旧行还在库、文件已不在盘上，新文件同番号，登记前把旧行改指过去（ADR-0131）。
    OLD = "R:\\media\\演员\\FNS-257\\FNS-257.mp4"

    def add_old(self, asset_id=7, path=OLD):
        """一条在库旧行，盘上没有它的文件；带刮削标签、探测结果与一次播放。"""
        self.add_live(asset_id, path, code="FNS-257", duration=7208.23)
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute("UPDATE asset SET width=1920,height=1080,play_count=1 WHERE id=?", (asset_id,))
            connection.execute("INSERT INTO asset_tag(asset_id,tag,source) VALUES(?,'刮削标签','javdb')", (asset_id,))
            connection.commit()

    def scan_new(self):
        with redirect_stdout(io.StringIO()):
            return scan.scan_location(self.db, "local", "R:\\media", declared_roots=DECLARED,
                                      mounts=self.mounts, windows=False, new_only=True)

    def test_a_renamed_and_reencoded_folder_keeps_its_row(self):
        """#312：目录改名又换了编码，增量扫描不新建行，标签与播放留在原行，探测列等重探。"""
        self.add_old()
        new_path = self.put("演员/FNS-257 新后缀/FNS-257.mp4")
        result = self.scan_new()
        self.assertEqual((result.new_ids, result.relocated_ids), ((), (7,)))
        self.assertEqual(self.query("SELECT id,path,code,duration,width,height,play_count FROM asset"),
                         [(7, new_path, "FNS-257", None, None, None, 1)])
        self.assertEqual(self.owner("asset_tag"), [7])
        self.assertEqual(self.query("SELECT count(*) FROM record_rehome"), [(0,)])

    def test_push_discovery_keeps_the_row_too(self):
        self.add_old()
        new_path = self.put("演员/FNS-257 新后缀/FNS-257.mp4")
        result = self.ingest(new_path)
        self.assertEqual((result.asset_id, result.new, result.relocated), (7, False, 7))
        self.assertEqual(self.query("SELECT id,path FROM asset"), [(7, new_path)])

    def test_an_old_file_still_on_disk_is_a_second_copy(self):
        old_path = self.put("演员/FNS-257/FNS-257.mp4")
        self.scan_all()
        new_path = self.put("演员/FNS-257 新后缀/FNS-257.mp4")
        result = self.scan_new()
        self.assertEqual(result.relocated_ids, ())
        self.assertEqual(sorted(row[0] for row in self.query("SELECT path FROM asset")), sorted([old_path, new_path]))

    def test_two_old_rows_with_the_code_are_left_alone(self):
        self.add_old(7)
        self.add_old(8, "R:\\media\\演员\\FNS-257 4K\\FNS-257.mp4")
        new_path = self.put("演员/FNS-257 新后缀/FNS-257.mp4")
        result = self.scan_new()
        self.assertEqual(result.relocated_ids, ())
        self.assertEqual(self.query("SELECT path FROM asset WHERE id IN (7,8) ORDER BY id"),
                         [(self.OLD,), ("R:\\media\\演员\\FNS-257 4K\\FNS-257.mp4",)])
        self.assertEqual(len(result.new_ids), 1)
        self.assertEqual(self.query("SELECT path FROM asset WHERE id=?", (result.new_ids[0],)), [(new_path,)])

    def test_two_new_videos_with_the_code_in_one_folder_are_left_alone(self):
        self.add_old()
        self.put("演员/FNS-257 新后缀/FNS-257.mp4")
        self.put("演员/FNS-257 新后缀/FNS-257.mkv")
        result = self.scan_new()
        self.assertEqual((result.relocated_ids, len(result.new_ids)), ((), 2))
        self.assertEqual(self.query("SELECT path FROM asset WHERE id=7"), [(self.OLD,)])

    def test_an_old_row_under_another_media_folder_is_left_alone(self):
        """另一个媒体目录可能只是没挂上：它下面的行答「不在」不能作数。"""
        other = self.root / "other"
        other.mkdir()
        self.mounts["local"] = (str(self.media), str(other))
        self.add_old(path="R:\\other\\FNS-257\\FNS-257.mp4")
        self.put("演员/FNS-257 新后缀/FNS-257.mp4")
        declared = {"local": ("R:\\media", "R:\\other")}
        with redirect_stdout(io.StringIO()):
            result = scan.scan_location(self.db, "local", "R:\\media", declared_roots=declared,
                                        mounts=self.mounts, windows=False, new_only=True)
        self.assertEqual((result.relocated_ids, len(result.new_ids)), ((), 1))
        self.assertEqual(self.query("SELECT path FROM asset WHERE id=7"), [("R:\\other\\FNS-257\\FNS-257.mp4",)])


class CodeSiblingIdentityTests(unittest.TestCase):
    """同番号副本缺演员、创作者时从已有归属的那一份补上（`code_siblings`）。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Path(self.tmp.name).resolve() / "ledger.db"
        upgrade(self.db, ROOT / "migrations")
        self.connection = sqlite3.connect(self.db)
        self.addCleanup(self.connection.close)
        rows = ((1, r"B:\FC2\FC2-PPV-1666863\FC2-PPV-1666863-CD1.mp4", "FC2-PPV-1666863"),
                (2, r"B:\FC2\FC2-PPV-1666863\www.98T.la@FC2-1666863-CD1.mp4", "FC2-PPV-1666863"),
                (3, r"B:\FC2\FC2-PPV-1000000\FC2-PPV-1000000.mp4", "FC2-PPV-1000000"))
        for asset_id, path, code in rows:
            self.connection.execute("INSERT INTO asset(id,location,path,name,medium,code) VALUES(?,'115',?,?,'video',?)",
                                    (asset_id, path, path.rsplit("\\", 1)[1], code))
        for entity_id, kind, name in ((10, "performer", "大村阿美香"), (20, "creator", "進撃のごろうまる"),
                                      (30, "creator", "FC2")):
            self.connection.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at)"
                                    " VALUES(?,?,?,?,'x','x')", (entity_id, kind, name, name.casefold()))
        for entity_id, role, source in ((10, "performer", "javinizer:javdb:performer"),
                                        (20, "creator", "script:fc2-seller@t"), (30, "creator", "legacy:asset")):
            self.connection.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(1,?,?,?)",
                                    (entity_id, role, source))

    def links(self, asset_id):
        return sorted(self.connection.execute(
            "SELECT entity_id,role FROM asset_entity WHERE asset_id=?", (asset_id,)).fetchall())

    def test_a_copy_takes_cast_and_seller_but_not_the_folder_creator_and_reverts_by_batch(self):
        from peach import auto_landing_revert, code_siblings
        result = code_siblings.inherit(self.connection, [2, 3], now="t1")
        self.assertEqual(self.links(2), [(10, "performer"), (20, "creator")],
                         "演员与卖家跟着番号走，目录推出的创作者讲的是那个文件夹")
        self.assertEqual(self.links(3), [])
        self.assertEqual(self.connection.execute(
            "SELECT tag FROM asset_tag WHERE asset_id=2").fetchall(), [("performer:大村阿美香",)])
        self.assertEqual(len(result["links"]), 2)
        self.assertEqual(code_siblings.inherit(self.connection, [2], now="t2")["links"], [],
                         "已经有这个角色的不再补")
        planned = auto_landing_revert.plan(self.connection, code_siblings.SOURCE, result["batch"],
                                           logo_root=Path(self.tmp.name), cover_root=Path(self.tmp.name), files=False)
        self.assertEqual(auto_landing_revert.apply(self.connection, planned)["deleted_sibling_links"], 2)
        self.assertEqual(self.links(2), [])
        self.assertEqual(self.connection.execute("SELECT count(*) FROM asset_tag WHERE asset_id=2").fetchone()[0], 0)

    def test_a_copy_that_already_has_a_performer_keeps_it(self):
        from peach import code_siblings
        self.connection.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at)"
                                " VALUES(11,'performer','別の人','別の人','x','x')")
        self.connection.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(2,11,'performer','user:manual')")
        code_siblings.inherit(self.connection, [2], now="t1")
        self.assertEqual(self.links(2), [(11, "performer"), (20, "creator")])


if __name__ == "__main__":
    unittest.main()
