"""编辑资料：单片字段、演员逐人增删、厂牌系列接管、自建档案与换封面（ADR-0165）。

盯的是两件事：用户这一笔写进去长什么样，以及之后自动写入的各条路径会不会把它冲掉——
删掉的演员不能随刮削回来，加上的人、选定的厂牌、换上的封面不能被自动来源换掉。
"""
from __future__ import annotations

import io
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing, contextmanager
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

from peach.cover_artwork import USER_COVER_SOURCE, UserCoverKept, install_cover, is_user_cover
from peach.entities import merge_entity, upsert_asset_entity
from peach.field_owners import USER_MANUAL, RevisionConflict, auto_owner, parse_owners, write_owned_fields
from peach.folder_rules import _link
from peach.item_cover import restore_user_cover, set_user_cover
from peach.item_edit import PERFORMER_REMOVAL, apply_item_edit, field_sources, performer_removed
from peach.library_processing import cover_settled
from peach.metadata_auto_apply import _apply_metadata_candidate, _apply_performer_candidate
from peach.user_messages import UserValueError
from peach.web_catalog import write_item_tag
from support.ledger import fresh_ledger

NOW = "2026-11-15T00:00:00+00:00"


class ItemEditLedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.con = sqlite3.connect(fresh_ledger(self.tmp.name))
        self.con.row_factory = sqlite3.Row
        self.addCleanup(self.con.close)
        self.con.execute("INSERT INTO asset(id,location,path,name,medium,code) "
                         "VALUES(1,'local','R:\\media\\a.mp4','a.mp4','video','ABC-123')")

    def edit(self, body: dict) -> dict:
        return apply_item_edit(self.con, 1, body, write_tag=write_item_tag)

    def performers(self) -> dict[str, set[str]]:
        found: dict[str, set[str]] = {}
        for row in self.con.execute(
                "SELECT e.canonical_name,ae.source FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id "
                "WHERE ae.asset_id=1 AND ae.role='performer'"):
            found.setdefault(row[0], set()).add(row[1])
        return found

    def projections(self) -> set[str]:
        return {row[0] for row in self.con.execute(
            "SELECT tag FROM asset_tag WHERE asset_id=1 AND tag LIKE 'performer:%'")}

    def scrape_performers(self, *names: str) -> None:
        _apply_performer_candidate(self.con, [1], {"value": [{"name": name} for name in names]},
                                   source="r18dev", confidence=0.9, metadata={}, now=NOW)

    def test_edited_fields_belong_to_the_user_and_automatic_writes_skip_them(self):
        self.edit({"fields": {"title": "  人工  标题 ", "release_date": "2025-11-04", "region": "jp", "code": "abc 123"}})
        row = self.con.execute("SELECT * FROM asset WHERE id=1").fetchone()
        self.assertEqual((row["catalog_title"], row["release_date"], row["region"], row["code"]),
                         ("人工 标题", "2025-11-04", "jp", "ABC-123"))
        self.assertEqual(parse_owners(row["field_owners"])["catalog_title"], USER_MANUAL)
        result = write_owned_fields(self.con, [1], {"catalog_title": "刮来的标题"}, auto_owner("r18dev"))
        self.assertEqual(result.refused, ("catalog_title",))
        self.assertEqual(field_sources(row["field_owners"])["title"]["owner"], "user")

    def test_restore_hands_a_field_back_to_automatic_collection(self):
        self.edit({"fields": {"title": "人工标题"}})
        self.edit({"restore": ["title"]})
        self.assertNotIn("catalog_title", parse_owners(
            self.con.execute("SELECT field_owners FROM asset WHERE id=1").fetchone()[0]))
        write_owned_fields(self.con, [1], {"catalog_title": "刮来的标题"}, auto_owner("r18dev"))
        self.assertEqual(self.con.execute("SELECT catalog_title FROM asset WHERE id=1").fetchone()[0], "刮来的标题")

    def test_field_source_uses_the_registered_site_name_and_mark(self):
        owners = json.dumps({"catalog_title": auto_owner("javdb"), "release_date": auto_owner("local_nfo"),
                             "code": "scan:filename"})
        sources = field_sources(owners)
        self.assertEqual(sources["title"], {"owner": "auto", "source": "JavDB", "site": "javdb"})
        self.assertNotIn("site", sources["release_date"])
        self.assertIn("source_code", sources["release_date"])
        self.assertEqual(sources["series"], {"owner": "", "source": ""})

    def test_a_stale_form_is_refused_before_anything_is_written(self):
        revision = self.con.execute("SELECT mutation_revision FROM asset WHERE id=1").fetchone()[0]
        self.edit({"expected_revision": revision, "fields": {"title": "第一次"}})
        with self.assertRaises(RevisionConflict):
            self.edit({"expected_revision": revision, "fields": {"title": "过期的表单"},
                       "performers": {"add": [{"name": "某人"}]}})
        self.assertEqual(self.con.execute("SELECT catalog_title FROM asset WHERE id=1").fetchone()[0], "第一次")
        self.assertEqual(self.performers(), {})

    def test_invalid_values_are_refused(self):
        for fields in ({"release_date": "2025/11/04"}, {"region": "mars"}, {"title": "a\nb"}, {"unknown": "x"}):
            with self.subTest(fields=fields), self.assertRaises(UserValueError):
                self.edit({"fields": fields})
        with self.assertRaises(UserValueError):
            self.edit({"fields": {"title": "x"}, "restore": ["title"]})

    def test_a_new_name_creates_a_user_created_performer_that_scraping_keeps(self):
        receipt = self.edit({"performers": {"add": [{"name": "自建艺人"}]}})
        self.assertTrue(receipt["performers_added"][0]["created"])
        self.assertEqual(self.performers(), {"自建艺人": {USER_MANUAL}})
        self.assertEqual(self.projections(), {"performer:自建艺人"})
        metadata = json.loads(self.con.execute(
            "SELECT metadata_json FROM entity WHERE kind='performer' AND canonical_name='自建艺人'").fetchone()[0])
        self.assertTrue(metadata["user_created"])
        # 之后刮到同一个人刷新实体资料，自建标记照样留着；整组重写演员也不清用户加的这一位。
        upsert_asset_entity(self.con, kind="performer", name="自建艺人", asset_id=1, role="performer",
                            source="javinizer:r18dev:performer", metadata={"source_url": "https://example.test"})
        self.scrape_performers("刮来的人")
        self.assertIn(USER_MANUAL, self.performers()["自建艺人"])
        self.assertIn("刮来的人", self.performers())
        self.assertTrue(json.loads(self.con.execute(
            "SELECT metadata_json FROM entity WHERE canonical_name='自建艺人'").fetchone()[0])["user_created"])

    def test_choosing_an_existing_performer_does_not_create_another(self):
        existing = upsert_asset_entity(self.con, kind="performer", name="已有艺人", asset_id=1, role="performer", source="seed")
        self.con.execute("DELETE FROM asset_entity WHERE asset_id=1")
        receipt = self.edit({"performers": {"add": [{"id": existing, "name": "已有艺人"}]}})
        self.assertFalse(receipt["performers_added"][0]["created"])
        self.assertEqual(self.con.execute("SELECT count(*) FROM entity WHERE kind='performer'").fetchone()[0], 1)

    def test_a_removed_performer_does_not_come_back_with_the_next_scrape(self):
        self.scrape_performers("错的人", "对的人")
        self.edit({"performers": {"remove": [{"name": "错的人"}]}})
        self.assertEqual(set(self.performers()), {"对的人"})
        self.assertEqual(self.projections(), {"performer:对的人"})
        wrong = self.con.execute("SELECT id FROM entity WHERE canonical_name='错的人'").fetchone()[0]
        self.assertTrue(performer_removed(self.con, 1, wrong))
        # 来源仍给出这个人，同时补上了新的一位：删掉的不回来，新补的照常加上。
        self.scrape_performers("错的人", "对的人", "新补的人")
        self.assertEqual(set(self.performers()), {"对的人", "新补的人"})
        self.assertNotIn("performer:错的人", self.projections())

    def test_adding_a_removed_performer_back_lifts_the_decision(self):
        self.scrape_performers("某人")
        self.edit({"performers": {"remove": [{"name": "某人"}]}})
        self.edit({"performers": {"add": [{"name": "某人"}]}})
        self.assertEqual(self.con.execute("SELECT count(*) FROM review_decision WHERE category=?",
                                          (PERFORMER_REMOVAL,)).fetchone()[0], 0)
        self.scrape_performers("某人")
        self.assertIn("某人", self.performers())

    def test_a_folder_rule_does_not_relink_a_removed_performer(self):
        self.scrape_performers("某人")
        self.edit({"performers": {"remove": [{"name": "某人"}]}})
        asset = self.con.execute("SELECT * FROM asset WHERE id=1").fetchone()
        rule = {"id": "r1", "purpose": "performer", "name": "某人", "path": "R:\\media"}
        self.assertFalse(_link(self.con, asset, rule))
        self.assertEqual(self.performers(), {})

    def test_merging_entities_keeps_the_removal_on_the_kept_one(self):
        self.scrape_performers("旧艺名")
        self.edit({"performers": {"remove": [{"name": "旧艺名"}]}})
        old = self.con.execute("SELECT id FROM entity WHERE canonical_name='旧艺名'").fetchone()[0]
        new = upsert_asset_entity(self.con, kind="performer", name="现艺名", asset_id=1, role="performer", source="seed")
        self.con.execute("DELETE FROM asset_entity WHERE entity_id=?", (new,))
        merge_entity(self.con, target_id=new, source_id=old, source_name="旧艺名", alias_source="user:identity-merge")
        self.assertTrue(performer_removed(self.con, 1, new))
        self.scrape_performers("现艺名")
        self.assertEqual(self.performers(), {})

    def test_a_user_chosen_studio_is_not_joined_by_the_scraped_one(self):
        self.con.execute("UPDATE asset SET path='/x/1.mp4' WHERE id=1")
        self.edit({"fields": {"studio": {"name": "自选厂牌"}}})
        group = {"asset_id": "1", "asset_path": "/x/1.mp4", "code": "", "field": "studio", "item_key": "asset:1:studio"}
        candidate = {"source": "makers", "value": "刮来的厂牌", "confidence": 1, "candidate_key": "studio"}
        _apply_metadata_candidate(self.con, group, candidate, NOW, auto_owner("makers"))
        self.assertEqual(self.con.execute("SELECT studio FROM asset WHERE id=1").fetchone()[0], "自选厂牌")
        self.assertEqual({row[0] for row in self.con.execute(
            "SELECT e.canonical_name FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id "
            "WHERE ae.asset_id=1 AND ae.role='studio'")}, {"自选厂牌"})
        # 交回自动采集之后，刮来的那一个照常替换。
        self.edit({"restore": ["studio"]})
        _apply_metadata_candidate(self.con, group, candidate, NOW, auto_owner("makers"))
        self.assertEqual({row[0] for row in self.con.execute(
            "SELECT e.canonical_name FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id "
            "WHERE ae.asset_id=1 AND ae.role='studio'")}, {"刮来的厂牌"})

    def test_tags_are_added_and_hidden_in_the_same_save(self):
        write_item_tag(self.con, 1, "add", "剧情")
        self.edit({"tags": {"add": ["自定义标签"], "remove": ["剧情"]}})
        self.assertTrue(self.con.execute(
            "SELECT 1 FROM asset_tag WHERE asset_id=1 AND tag='自定义标签' AND source='web-user'").fetchone())
        self.assertEqual(self.con.execute(
            "SELECT hidden FROM asset_tag_preference WHERE asset_id=1").fetchone()[0], 1)


class ItemCoverTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.db = fresh_ledger(root)
        with closing(sqlite3.connect(self.db)) as con, con:
            con.execute("INSERT INTO asset(id,location,path,name,medium,code) "
                        "VALUES(1,'local','R:\\media\\a.mp4','a.mp4','video','ABC-123')")
        self.covers = root / "covers"
        self.covers.mkdir()

        @contextmanager
        def read_connection():
            con = sqlite3.connect(self.db)
            try:
                yield con
            finally:
                con.close()
        self.contract = SimpleNamespace(cover_root=self.covers, read_connection=read_connection)
        self.target = self.covers / "ABC-123.jpg"

    @staticmethod
    def image(width: int = 800, height: int = 538, color=(200, 30, 30)) -> bytes:
        out = io.BytesIO()
        Image.new("RGB", (width, height), color).save(out, "PNG")
        return out.getvalue()

    def scraped_cover(self) -> bytes:
        data = self.image(color=(10, 10, 200))
        install_cover(self.target, "ABC-123", data, (800, 538), evidence={"source": "makers", "source_url": "https://example.test/c.jpg"})
        return self.target.read_bytes()

    def test_a_user_cover_replaces_the_scraped_one_and_restore_brings_it_back(self):
        original = self.scraped_cover()
        set_user_cover(self.contract, 1, self.image())
        self.assertTrue(is_user_cover(self.target))
        self.assertNotEqual(self.target.read_bytes(), original)
        self.assertEqual(json.loads(self.target.with_suffix(".scraping.json").read_text(encoding="utf-8"))["source"],
                         USER_COVER_SOURCE)
        # 连换两次，恢复回去的仍是刮削来的那张。
        set_user_cover(self.contract, 1, self.image(color=(0, 200, 0)))
        receipt = restore_user_cover(self.contract, 1)
        self.assertTrue(receipt["restored"])
        self.assertEqual(self.target.read_bytes(), original)
        self.assertFalse(is_user_cover(self.target))

    def test_restoring_without_a_scraped_cover_leaves_none(self):
        set_user_cover(self.contract, 1, self.image())
        self.assertFalse(restore_user_cover(self.contract, 1)["restored"])
        self.assertFalse(self.target.exists())
        with self.assertRaises(UserValueError):
            restore_user_cover(self.contract, 1)

    def test_automatic_sources_do_not_replace_a_user_cover(self):
        set_user_cover(self.contract, 1, self.image())
        self.assertTrue(cover_settled(self.target))
        with self.assertRaises(UserCoverKept):
            install_cover(self.target, "ABC-123", self.image(1600, 1076), (1600, 1076),
                          evidence={"source": "makers", "source_url": "https://example.test/big.jpg"})
        self.assertTrue(is_user_cover(self.target))

    def test_unreadable_or_tiny_images_are_refused(self):
        for data in (b"", b"not an image", self.image(120, 80)):
            with self.subTest(size=len(data)), self.assertRaises(UserValueError):
                set_user_cover(self.contract, 1, data)
        self.assertFalse(self.target.exists())


if __name__ == "__main__":
    unittest.main()
