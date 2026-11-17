"""收藏身份重定向、命名筛选与用户设置事务。"""
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest import mock

from peach.web_contract import WebContract, dispatch_api_get, dispatch_api_post
from peach.web_library_shortcuts import clean_href
from peach import web_settings


class LibraryShortcutsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name).resolve() / "ledger.db"
        with closing(sqlite3.connect(self.path)) as c, c:
            c.executescript("""
                CREATE TABLE profile(id TEXT PRIMARY KEY,settings_json TEXT,updated_at TEXT);
                INSERT INTO profile VALUES('local-default','{"sidebarOrder":["tags"]}','');
                CREATE TABLE entity(id INTEGER PRIMARY KEY,kind TEXT,canonical_name TEXT,normalized_name TEXT);
                INSERT INTO entity VALUES(1,'studio','厂牌','厂牌'),(2,'series','系列','系列'),(3,'tag','剧情','剧情');
                CREATE TABLE entity_redirect(old_id INTEGER,target_id INTEGER);
                CREATE TABLE entity_alias(entity_id INTEGER,alias TEXT,normalized_alias TEXT);
                INSERT INTO entity_alias VALUES(3,'故事','故事');
                CREATE TABLE asset(id INTEGER PRIMARY KEY,medium TEXT,disposal TEXT,size INTEGER,snapshot_path TEXT,name TEXT,path TEXT);
                CREATE TABLE asset_entity(asset_id INTEGER,entity_id INTEGER,role TEXT);
            """)
        generated = Path(self.tmp.name) / 'generated'
        self.contract = WebContract(self.path, candidate_root=generated,
                                    avatar_root=generated / 'avatars', logo_root=generated / 'logos')

    def read(self):
        return dispatch_api_get(self.contract, "/api/library-shortcuts", {})

    def write(self, **body):
        return dispatch_api_post(self.contract, "/api/library-shortcuts", body)

    def test_favorite_is_idempotent_and_reads_canonical_name(self):
        for _ in range(2):
            self.write(action="favorite", entity_id=1, on=True)
        with closing(sqlite3.connect(self.path)) as c, c:
            c.execute("UPDATE entity SET canonical_name='规范厂牌' WHERE id=1")
        self.assertEqual([row['name'] for row in self.read()['favorites']], ['规范厂牌'])
        self.assertEqual(self.write(action="favorite", entity_id=1, on=False)['favorites'], [])

    def test_saved_filters_reorder_atomically_and_reject_stale_members(self):
        self.write(action="save_filter", name="筛选一", href="/?q=one")
        before = self.write(action="save_filter", name="筛选二", href="/?q=two")['filters']
        ids = [row['id'] for row in reversed(before)]
        ordered = self.write(action="reorder_filters", ids=ids)['filters']
        self.assertEqual(ordered, list(reversed(before)))
        for invalid in ([ids[0], ids[0]], ids[:1], [*ids, 'removed'], [1, 2], None):
            with self.assertRaises(ValueError):
                self.write(action="reorder_filters", ids=invalid)
            self.assertEqual(self.read()['filters'], ordered)
        self.assertEqual(web_settings.q_settings(self.contract)['sidebarOrder'], ['tags'])

    def test_merge_collapses_favorites_and_cancel_accepts_old_id(self):
        self.write(action="favorite", entity_id=1, on=True)
        self.write(action="favorite", entity_id=2, on=True)
        with closing(sqlite3.connect(self.path)) as c, c:
            c.execute("DELETE FROM entity WHERE id=1")
            c.execute("INSERT INTO entity_redirect VALUES(1,2)")
        self.assertEqual([row['entity_id'] for row in self.read()['favorites']], [2])
        self.assertEqual(self.write(action="favorite", entity_id=1, on=False)['favorites'], [])

    def test_tag_alias_resolves_to_entity_and_can_be_cancelled(self):
        result = self.write(action="favorite", kind="tag", name="故事", on=True)
        self.assertEqual(result['favorites'][0]['entity_id'], 3)
        self.assertEqual(result['favorites'][0]['name'], '剧情')
        self.assertEqual(self.write(action="favorite", kind="tag", name="剧情", on=False)['favorites'], [])

    def test_filters_roundtrip_preserves_empty_source_and_removal(self):
        href = '/watch-later?loc=&q=ABW&tag=%E5%89%A7%E6%83%85&jav=1&sort=name&dir=asc&thumb=0'
        result = self.write(action="save_filter", name="筛选", href=href)
        saved = result['filters'][0]
        self.assertEqual(saved['href'], href)
        self.write(action="favorite", entity_id=1, on=True)
        self.assertEqual(self.read()['filters'], [saved])
        self.write(action="delete_filter", id=saved['id'])
        self.assertEqual(self.read()['filters'], [])
        with closing(sqlite3.connect(self.path)) as c, c:
            settings = json.loads(c.execute("SELECT settings_json FROM profile").fetchone()[0])
        self.assertEqual(settings['sidebarOrder'], ['tags'])

    def test_favorites_include_entity_art_logos_and_available_representatives(self):
        with closing(sqlite3.connect(self.path)) as c, c:
            c.execute("INSERT INTO asset(id,medium,disposal,size,snapshot_path) "
                      "VALUES(10,'video',NULL,100,'sample.jpg')")
            c.execute("INSERT INTO asset_entity VALUES(10,3,'tag')")
        with mock.patch.object(WebContract, 'has_logo', return_value=True), \
                mock.patch.object(WebContract, 'logo_version', return_value='logo-v'), \
                mock.patch.object(WebContract, 'has_avatar', return_value=True):
            studio = self.write(action='favorite', entity_id=1, on=True)['favorites'][0]
            tag = self.write(action='favorite', entity_id=3, on=True)['favorites'][1]
        self.assertIn('studio=%E5%8E%82%E7%89%8C', studio['image_url'])
        self.assertEqual(tag['image_url'], '/avatar?id=10')
        self.assertEqual(tag['image_label'], '剧情 · 代表作')
        with closing(sqlite3.connect(self.path)) as c:
            stored = json.loads(c.execute('SELECT settings_json FROM profile').fetchone()[0])
        self.assertNotIn('image_url', stored['libraryShortcuts']['favorites'][0])

    def test_favorite_representative_uses_the_main_feature(self):
        with closing(sqlite3.connect(self.path)) as c, c:
            c.executemany("INSERT INTO asset(id,name,medium,size,snapshot_path) VALUES(?,?,'video',?,?)", [
                (10, 'ABC-123.mp4', 100, 'main.jpg'),
                (11, 'ABC-123-trailer.mp4', 1000, 'trailer.jpg'),
            ])
            c.executemany("INSERT INTO asset_entity VALUES(?,3,'tag')", [(10,), (11,)])
        with mock.patch.object(WebContract, 'has_avatar', return_value=True):
            tag = self.write(action='favorite', entity_id=3, on=True)['favorites'][0]
        self.assertEqual(tag['image_url'], '/avatar?id=10')

    def test_creator_favorite_projects_bound_official_and_archive_avatars(self):
        from peach.web_catalog import entity_ref
        with closing(sqlite3.connect(self.path)) as c, c:
            c.executescript("""
                INSERT INTO entity VALUES(4,'creator','创作者','创作者');
                INSERT INTO entity VALUES(5,'creator','同名待确认','同名待确认');
                CREATE TABLE follow_source(id INTEGER PRIMARY KEY,provider TEXT,ref TEXT,entity_id INTEGER,metadata_json TEXT);
                INSERT INTO follow_source VALUES(1,'kemono','fanbox/123',4,'{}');
                INSERT INTO follow_source VALUES(2,'pawchive','fanbox/123',4,'{}');
                INSERT INTO follow_source VALUES(3,'f95zone','99',NULL,'{}');
            """)
        creator = self.write(action='favorite', entity_id=4, on=True)['favorites'][0]
        self.assertEqual(creator['image_url'], '/follow-avatar?service=fanbox&id=123')
        self.assertEqual(creator['image_fallbacks'], [
            '/follow-avatar?provider=kemono&ref=fanbox%2F123',
            '/follow-avatar?provider=pawchive&ref=fanbox%2F123'])
        self.assertEqual(entity_ref(self.contract, 'creator', 4, '创作者')['source_avatar_url'], creator['image_url'])
        with closing(sqlite3.connect(self.path)) as c, c:
            c.execute("INSERT INTO asset(id,name,medium,size,snapshot_path) VALUES(12,'main.mp4','video',100,'main.jpg')")
            c.execute("INSERT INTO asset_entity VALUES(12,4,'creator')")
        with mock.patch.object(WebContract, 'has_avatar', return_value=True):
            local = self.write(action='favorite', entity_id=4, on=True)['favorites'][0]
        self.assertEqual(local['image_url'], '/avatar?id=12')
        unknown = self.write(action='favorite', entity_id=5, on=True)['favorites'][1]
        self.assertEqual(unknown['image_url'], '')
        with closing(sqlite3.connect(self.path)) as c:
            stored = json.loads(c.execute('SELECT settings_json FROM profile').fetchone()[0])
        self.assertNotIn('image_url', stored['libraryShortcuts']['favorites'][0])

    def test_bad_targets_are_rejected_without_writes(self):
        for href in ('https://evil.example/', '//evil.example/', '/configuration', '/?token=x', '/?seed=123'):
            with self.subTest(href=href), self.assertRaises(ValueError):
                clean_href(href)
        for entity_id in (True, -1, 99, '1'):
            with self.subTest(entity_id=entity_id), self.assertRaises(ValueError):
                self.write(action="favorite", entity_id=entity_id, on=True)
        self.assertEqual(self.read(), {'favorites': [], 'filters': []})

    def test_other_settings_keep_favorites_written_during_validation(self):
        stored = web_settings._stored
        def interleaved(contract):
            value = stored(contract)
            self.write(action="favorite", entity_id=1, on=True)
            return value
        with mock.patch.object(web_settings, '_stored', side_effect=interleaved):
            web_settings.w_settings(self.contract, {'searchHistoryLimit': 10})
        self.assertEqual([row['entity_id'] for row in self.read()['favorites']], [1])
