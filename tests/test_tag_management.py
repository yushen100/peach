"""标签身份归一、合并与隐藏的事务回归。"""
import json
import sqlite3
import runpy
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from support.ledger import fresh_ledger
from peach.catalog_rules import current_tags
from peach.entities import upsert_asset_entity
from peach.repository import LedgerDatabase
from peach.tag_management import apply_plan, duplicate_groups, preview, tag_rows
from peach.web_catalog import con_tags, tag_not_hidden
from peach.web_tags import q_tag_management, w_tag_management
from peach.web_entity import q_index
from peach import online_tag_management, web_follow, web_library_shortcuts
from peach.follow_sources import FollowCandidate, SourceFetch
from peach.follow_store import FollowStore
from peach.web_contract import WebContract
from peach.library_favorites import favorite_entities


class TagManagementTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = fresh_ledger(Path(self.tmp.name).resolve())
        self.database = LedgerDatabase(self.db)
        self.c = self.database.connect(write=True)
        self.addCleanup(self.c.close)
        self.c.executemany("INSERT INTO asset(id,location,path,name,medium) VALUES(?,'local',?,?,'video')",
                           [(i, f'R:\\demo\\{i}.mp4', f'{i}.mp4') for i in range(1, 5)])
        self.c.commit()

    def tag(self, name, assets=(1,), source='web-user'):
        entity_id = None
        for aid in assets:
            self.c.execute('INSERT OR IGNORE INTO asset_tag(asset_id,tag,confidence,source) VALUES(?,?,1,?)', (aid, name, source))
            entity_id = upsert_asset_entity(self.c, kind='tag', name=name, asset_id=aid, role='tag', source=source)
        return entity_id

    def execute(self, operation, ids, **fields):
        body = dict(operation=operation, ids=ids, **fields)
        plan = preview(self.c, body)
        return apply_plan(self.c, dict(body, token=plan['token']))

    def management_contract(self):
        root = Path(self.tmp.name).resolve()
        contract = WebContract(self.db, follow_sources_root=root / 'sources', follow_secrets_root=root / 'secrets',
            follow_shared_root=root / 'shared', candidate_root=root / 'generated', follow_state_root=root / 'state')
        self.addCleanup(contract.stop_background_jobs)
        contract.followups.stop()
        return contract

    def test_management_pages_filter_aliases_width_categories_and_state_before_slicing(self):
        original = self.tag('Original', (1, 2))
        self.execute('rename', [original], name='Alpha')
        self.tag('Beta')
        self.tag('gamma', (1, 2, 3))
        self.tag('眼镜')
        hidden = self.tag('Dormant')
        self.execute('hide', [hidden])
        self.c.commit()
        contract = self.management_contract()
        first = q_tag_management(contract, dict(limit='2'))
        second = q_tag_management(contract, dict(limit='2', offset='2'))
        self.assertEqual([row['k'] for row in first['items']], ['gamma', 'Alpha'])
        self.assertEqual([row['k'] for row in second['items']], ['Beta', '眼镜'])
        self.assertEqual((first['total'], first['has_more'], first['limit'], first['offset']), (4, True, 2, 0))
        self.assertEqual((second['total'], second['has_more']), (4, False))
        alphabet = q_tag_management(contract, dict(limit='2', view='alphabet'))
        self.assertEqual([row['k'] for row in alphabet['items']], ['Alpha', 'Beta'])
        found = q_tag_management(contract, dict(limit='20', q='ＯＲＩＧＩＮＡＬ'))
        self.assertEqual([row['k'] for row in found['items']], ['Alpha'])
        self.assertEqual((found['total'], found['categories']), (1, {'general': 1}))
        category = q_tag_management(contract, dict(limit='1', category='appearance'))
        self.assertEqual([row['k'] for row in category['items']], ['眼镜'])
        self.assertEqual((category['total'], category['categories']), (1, {'general': 3, 'appearance': 1}))
        hidden_page = q_tag_management(contract, dict(limit='20', state='hidden'))
        self.assertEqual([row['k'] for row in hidden_page['items']], ['Dormant'])
        self.assertEqual(q_tag_management(contract, dict(limit='20', state='blocked'))['total'], 0)
        past_end = q_tag_management(contract, dict(limit='2', offset='99'))
        self.assertEqual((past_end['items'], past_end['total'], past_end['has_more']), ([], 4, False))
        complete = q_tag_management(contract, dict(q='不存在', state='active'))
        self.assertEqual(set(complete), {'items', 'duplicate_groups'})
        self.assertEqual(len(complete['items']), 5)

    def test_management_page_limits_duplicate_groups_and_cache_invalidation(self):
        self.tag('眼镜')
        self.c.execute("INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at) VALUES('tag','眼镜娘','眼镜娘','now','now')")
        self.c.commit()
        contract = self.management_contract()
        with patch('peach.web_tags.tag_rows', wraps=tag_rows) as inventory:
            complete = q_tag_management(contract, {})
            self.assertEqual(len(complete['duplicate_groups']), 1)
            for raw, expected in [('invalid', 20), ('0', 1), ('-5', 1), ('99999', 600)]:
                page = q_tag_management(contract, dict(limit=raw, offset='invalid', q='不存在'))
                self.assertEqual((page['limit'], page['offset'], page['total']), (expected, 0, 0))
                self.assertEqual(page['duplicate_groups'], complete['duplicate_groups'])
            self.assertEqual(inventory.call_count, 1)
            complete['items'][0]['k'] = '客户端临时值'
            self.assertNotIn('客户端临时值', [row['k'] for row in q_tag_management(contract, {})['items']])
            contract.cache_bust()
            q_tag_management(contract, dict(limit='1'))
            self.assertEqual(inventory.call_count, 2)
            self.tag('新标签')
            self.c.commit()
            self.assertEqual(q_tag_management(contract, dict(limit='20'))['total'], 3)
            self.assertEqual(inventory.call_count, 3)
        for args in [dict(limit='20', state='unknown'), dict(limit='20', view='unknown')]:
            with self.subTest(args=args), self.assertRaisesRegex(ValueError, '未知的标签'):
                q_tag_management(contract, args)

    def test_local_browse_tag_total_counts_filtered_rows_on_every_page(self):
        self.tag('Alpha')
        self.tag('Beta')
        self.tag('眼镜')
        self.c.commit()
        contract = self.management_contract()
        first = q_index(contract, 'tags', limit=1)
        self.assertEqual((len(first['items']), first['total'], first['has_more']), (1, 3, True))
        category = q_index(contract, 'tags', limit=1, category='general', offset=20)
        self.assertEqual((category['items'], category['total'], category['has_more']), ([], 2, False))
        searched = q_index(contract, 'tags', q='Alpha', limit=1)
        self.assertEqual((len(searched['items']), searched['total']), (1, 1))
        self.assertNotIn('total', q_index(contract, 'performers', limit=1))

    def test_rename_preserves_unrelated_historical_reference_violations(self):
        entity_id = self.tag('眼镜')
        self.c.commit()
        self.c.execute('PRAGMA foreign_keys=OFF')
        self.c.execute('CREATE TABLE historical_parent(id INTEGER PRIMARY KEY)')
        self.c.execute('CREATE TABLE historical_reference(id INTEGER PRIMARY KEY,parent_id REFERENCES historical_parent(id))')
        self.c.execute('INSERT INTO historical_reference VALUES(1,999)')
        self.c.commit()
        self.c.execute('PRAGMA foreign_keys=ON')
        historical = list(map(tuple, self.c.execute('PRAGMA foreign_key_check')))
        self.execute('rename', [entity_id], name='我的眼镜')
        self.assertEqual(list(map(tuple, self.c.execute('PRAGMA foreign_key_check'))), historical)
        self.assertEqual(self.c.execute('SELECT canonical_name FROM entity WHERE id=?', (entity_id,)).fetchone()[0], '我的眼镜')

    def test_tag_operation_rejects_new_foreign_key_violations(self):
        entity_id = self.tag('眼镜')
        self.c.commit()
        self.c.execute('PRAGMA foreign_keys=OFF')
        self.c.execute('CREATE TABLE tag_reference(entity_id REFERENCES entity(id))')
        self.c.execute('CREATE TRIGGER bad_tag_reference AFTER UPDATE OF canonical_name ON entity BEGIN INSERT INTO tag_reference VALUES(-1); END')
        self.c.commit()
        with self.assertRaisesRegex(ValueError, 'foreign key check'):
            self.execute('rename', [entity_id], name='我的眼镜')
        self.c.rollback()
        self.assertEqual(self.c.execute('SELECT canonical_name FROM entity WHERE id=?', (entity_id,)).fetchone()[0], '眼镜')
        self.assertEqual(self.c.execute('SELECT count(*) FROM tag_reference').fetchone()[0], 0)

    def test_display_spellings_and_width_share_one_identity(self):
        self.assertEqual(current_tags(['眼镜娘', '眼镜', '３Ｐ', '3P多人', 'ＶＲ', 'vr']), ['眼镜', '3P多人', 'VR'])
        first = self.tag('眼镜')
        self.assertEqual(self.tag('眼镜娘', (2,)), first)
        self.assertEqual([row[0] for row in self.c.execute('SELECT DISTINCT tag FROM asset_tag')], ['眼镜'])

    def test_renamed_tag_accepts_old_names_and_keeps_hidden_decision(self):
        entity_id = self.tag('自定义标签')
        self.execute('rename', [entity_id], name='我的标签')
        self.execute('hide', [entity_id])
        self.assertEqual(self.tag('自定义标签', (2,), source='javinizer:javdb:tag'), entity_id)
        row = self.c.execute('SELECT canonical_name,metadata_json FROM entity WHERE id=?', (entity_id,)).fetchone()
        self.assertEqual(row[0], '我的标签')
        self.assertEqual(json.loads(row[1])['user_tag_hidden'], 1)
        self.assertEqual([row[0] for row in self.c.execute('SELECT DISTINCT tag FROM asset_tag')], ['我的标签'])

    def test_merge_keeps_source_assertions_preferences_and_genre_mapping(self):
        first = self.tag('甲', (1, 2), source='javinizer:javdb:tag')
        second = self.tag('乙', (1, 3), source='filename')
        self.c.execute("INSERT INTO asset_tag_preference VALUES('local-default',2,'甲',1,'now')")
        self.c.execute("INSERT INTO genre_decision VALUES('source','source','甲','now')")
        body = dict(operation='merge', ids=[first, second], target_id=second)
        plan = preview(self.c, body)
        self.assertEqual((plan['assets'], plan['overlap']), (3, 1))
        apply_plan(self.c, dict(body, token=plan['token']))
        self.assertEqual(self.c.execute('SELECT count(*) FROM entity').fetchone()[0], 1)
        self.assertEqual(self.c.execute('SELECT count(DISTINCT asset_id) FROM asset_entity WHERE entity_id=?', (second,)).fetchone()[0], 3)
        self.assertEqual(self.c.execute('SELECT normalized_tag FROM asset_tag_preference').fetchone()[0], '乙')
        self.assertEqual(self.c.execute('SELECT peach_tag FROM genre_decision').fetchone()[0], '乙')
        self.assertEqual(self.c.execute('SELECT source FROM asset_tag WHERE asset_id=1').fetchone()[0], 'javinizer:javdb:tag')
        self.assertEqual(self.tag('甲', (4,)), second)
        self.assertEqual(list(self.c.execute('PRAGMA foreign_key_check')), [])

    def test_rename_conflict_requires_explicit_merge(self):
        first = self.tag('甲')
        self.tag('乙')
        with self.assertRaisesRegex(ValueError, '请使用合并'):
            preview(self.c, dict(operation='rename', ids=[first], name='乙'))

    def test_stale_plan_does_not_apply(self):
        entity_id = self.tag('甲')
        body = dict(operation='rename', ids=[entity_id], name='乙')
        plan = preview(self.c, body)
        self.tag('甲', (2,))
        with self.assertRaisesRegex(ValueError, '重新预览'):
            apply_plan(self.c, dict(body, token=plan['token']))
        self.assertEqual(self.c.execute('SELECT canonical_name FROM entity').fetchone()[0], '甲')

    def test_hidden_tag_can_be_restored_for_all_assets(self):
        entity_id = self.tag('甲', (1, 2))
        self.execute('hide', [entity_id])
        sql = 'SELECT ae.asset_id FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id WHERE ' + tag_not_hidden('ae.asset_id', 'e.normalized_name')
        self.assertEqual(list(self.c.execute(sql)), [])
        self.execute('restore', [entity_id])
        self.assertEqual(len(list(self.c.execute(sql))), 2)

    def test_raw_source_spelling_obeys_hidden_tag_and_keeps_its_evidence(self):
        entity_id = self.tag('眼镜娘', source='pixiv_tag')
        self.execute('hide', [entity_id])
        self.c.commit()
        contract = SimpleNamespace(read_connection=self.database.read_connection)
        self.assertEqual(con_tags(contract, [1], '?'), [])
        self.assertEqual(self.c.execute('SELECT tag,source FROM asset_tag').fetchone()[:], ('眼镜娘', 'pixiv_tag'))
        self.execute('restore', [entity_id])
        self.c.commit()
        self.assertEqual(len(con_tags(contract, [1], '?')), 1)

    def test_repair_unifies_registered_spellings_and_is_idempotent(self):
        first = self.tag('眼镜')
        self.c.execute("INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at) VALUES('tag','眼镜娘','眼镜娘','now','now')")
        second = self.c.execute('SELECT last_insert_rowid()').fetchone()[0]
        self.c.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(2,?,'tag','legacy')", (second,))
        self.c.execute("INSERT INTO asset_tag VALUES(2,'眼镜娘',1,'legacy')")
        self.assertEqual(len(duplicate_groups(tag_rows(self.c))), 1)
        self.execute('repair', [])
        self.assertEqual([row['entity_id'] for row in tag_rows(self.c)], [first])
        self.assertEqual(duplicate_groups(tag_rows(self.c)), [])
        self.execute('repair', [])

    def test_http_write_creates_a_sqlite_backup_and_commits(self):
        entity_id = self.tag('甲')
        body = dict(operation='rename', ids=[entity_id], name='乙')
        body['token'] = preview(self.c, body)['token']
        self.c.commit()
        contract = SimpleNamespace(db_path=self.db, read_connection=self.database.read_connection,
            write_transaction=self.database.write_transaction, cache_bust=Mock())
        self.assertTrue(w_tag_management(contract, body)['ok'])
        backups = list(self.db.parent.glob('ledger.pre-tag-management-*.db'))
        self.assertEqual(len(backups), 1)
        with closing(sqlite3.connect(backups[0])) as backup:
            self.assertEqual(backup.execute('SELECT canonical_name FROM entity').fetchone()[0], '甲')
        self.assertEqual(self.c.execute('SELECT canonical_name FROM entity').fetchone()[0], '乙')

    def test_maintenance_script_previews_and_requires_backup_for_apply(self):
        self.tag('眼镜')
        self.c.execute("INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at) VALUES('tag','眼镜娘','眼镜娘','now','now')")
        self.c.commit()
        script = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts' / 'repair_duplicate_tags.py'))
        report = self.db.parent / 'review.csv'
        parser = script['build_parser']()
        options = ['--db', str(self.db), '--review-csv', str(report)]
        self.assertEqual(script['run'](parser.parse_args(options)), 0)
        self.assertIn('眼镜娘', report.read_text(encoding='utf-8'))
        self.assertEqual(len(tag_rows(self.c)), 2)
        with self.assertRaises(SystemExit):
            script['run'](parser.parse_args([*options, '--apply']))
        backup = self.db.parent / 'before.db'
        self.assertEqual(script['run'](parser.parse_args([*options, '--apply', '--backup', str(backup)])), 0)
        self.assertTrue(backup.exists())
        self.assertEqual(len(tag_rows(self.c)), 1)


    def test_delete_removes_the_tag_and_its_links_but_keeps_the_works(self):
        gone = self.tag('删掉的', (1, 2))
        kept = self.tag('留下的', (2,))
        self.c.execute("INSERT INTO entity_alias(entity_id,alias,normalized_alias,source,confidence) VALUES(?,?,?,'user',1)",
                       (gone, '旧名', '旧名'))
        self.c.execute("INSERT INTO asset_tag(asset_id,tag,confidence,source) VALUES(3,'旧名',1,'web-user')")
        self.c.execute("INSERT INTO asset_tag(asset_id,tag,confidence,source) VALUES(4,'删掉的',1,'pixiv_tag')")
        plan = preview(self.c, {'operation': 'delete', 'ids': [gone]})
        self.assertEqual((plan['assets'], [row['k'] for row in plan['tags']]), (2, ['删掉的']))
        self.execute('delete', [gone])
        self.assertEqual([row['entity_id'] for row in tag_rows(self.c)], [kept])
        self.assertEqual(self.c.execute('SELECT count(*) FROM asset').fetchone()[0], 4)
        self.assertEqual(list(map(tuple, self.c.execute('SELECT asset_id,tag,source FROM asset_tag ORDER BY asset_id,tag'))),
                         [(2, '留下的', 'web-user'), (4, '删掉的', 'pixiv_tag')])
        self.assertEqual(self.c.execute('SELECT count(*) FROM asset_entity WHERE entity_id=?', (gone,)).fetchone()[0], 0)
        self.assertEqual(self.c.execute('SELECT count(*) FROM entity_alias WHERE entity_id=?', (gone,)).fetchone()[0], 0)
        self.assertEqual(self.c.execute('PRAGMA foreign_key_check').fetchall(), [])


class OnlineTagManagementTests(unittest.TestCase):
    setUp = TagManagementTests.setUp

    def seed(self):
        root = Path(self.tmp.name).resolve()
        self.contract = WebContract(self.db, follow_sources_root=root / 'sources', follow_secrets_root=root / 'secrets',
            follow_shared_root=root / 'shared', candidate_root=root / 'generated', follow_state_root=root / 'state')
        self.addCleanup(self.contract.stop_background_jobs)
        self.contract.followups.stop()
        with self.database.write_transaction() as connection:
            store = FollowStore(lambda: connection)
            source = store.register(provider='rule34video', ref='preview', label='预览', url='https://example.invalid/preview')
            self.record(store, source, 1, ['outdoors', 'landscape', 'preview_artist'])
            self.record(store, source, 2, ['outdoors'])
            self.record(store, source, 3, ['landscape'])
        return source

    def record(self, store, source, index, tags):
        candidate = FollowCandidate(provider='rule34video', external_id=str(index), title=f'作品 {index}', title_is_name=False,
            extra={'tags': tags, 'tag_types': {name: 'artist' if name == 'preview_artist' else 'general' for name in tags}})
        store.record(source, SourceFetch(provider='rule34video', ref='preview', request_url='https://example.invalid/preview',
                                        semantics='work', candidates=(candidate,)))

    def execute(self, operation, ids, **fields):
        command = dict(scope='online', operation=operation, ids=ids, **fields)
        with self.database.read_connection() as connection:
            command['token'] = online_tag_management.preview(connection, command, web_follow.online_tag_inventory(connection))['token']
        return w_tag_management(self.contract, command)

    def test_online_management_pages_share_inventory_and_partition_blocked_hidden_active(self):
        self.seed()
        self.execute('rename', ['outdoors'], name='户外')
        self.execute('hide', ['outdoors'])
        self.execute('block', ['outdoors'])
        args = dict(scope='online', limit='1')
        with patch('peach.web_tags.online_tag_inventory', wraps=web_follow.online_tag_inventory) as inventory:
            first = q_tag_management(self.contract, args)
            second = q_tag_management(self.contract, dict(args, offset='1'))
            self.assertEqual([row['k'] for row in first['items']], ['landscape'])
            self.assertEqual([row['k'] for row in second['items']], ['preview_artist'])
            self.assertEqual((first['total'], first['has_more'], second['has_more']), (2, True, False))
            self.assertEqual(first['categories'], {'general': 1, 'artist': 1})
            artist = q_tag_management(self.contract, dict(args, category='artist'))
            self.assertEqual((artist['total'], artist['categories']), (1, first['categories']))
            self.assertEqual([row['k'] for row in artist['items']], ['preview_artist'])
            hidden = q_tag_management(self.contract, dict(args, state='hidden'))
            self.assertEqual((hidden['items'], hidden['total']), ([], 0))
            blocked = q_tag_management(self.contract, dict(args, state='blocked', q='ＯＵＴＤＯＯＲＳ'))
            self.assertEqual([row['k'] for row in blocked['items']], ['户外'])
            self.assertEqual((blocked['total'], blocked['categories'], blocked['duplicate_groups']), (1, {'general': 1}, []))
            complete = q_tag_management(self.contract, dict(scope='online'))
            self.assertEqual(set(complete), {'items', 'duplicate_groups'})
            self.assertEqual(len(complete['items']), 3)
            self.assertTrue(all(not key.startswith('_') for row in complete['items'] for key in row))
            self.assertEqual(inventory.call_count, 1)
            self.contract.cache_bust()
            q_tag_management(self.contract, args)
            self.assertEqual(inventory.call_count, 2)
        self.execute('unblock', ['outdoors'])
        self.assertEqual([row['k'] for row in q_tag_management(self.contract, dict(args, state='hidden'))['items']], ['户外'])

    def test_online_browse_tag_total_follows_search_and_type_before_paging(self):
        self.seed()
        first = web_follow.q_follow_tags(self.contract, dict(types='all', limit='1'))
        self.assertEqual((len(first['items']), first['total'], first['has_more']), (1, 3, True))
        artist = web_follow.q_follow_tags(self.contract, dict(types='all', type='artist', limit='1', offset='10'))
        self.assertEqual((artist['items'], artist['total'], artist['has_more']), ([], 1, False))
        found = web_follow.q_follow_tags(self.contract, dict(types='all', q='outdoors', limit='1'))
        self.assertEqual((len(found['items']), found['total']), (1, 1))

    def test_rename_merge_and_source_updates_share_one_online_identity(self):
        source = self.seed()
        originals = list(map(tuple, self.c.execute('SELECT id,metadata_json FROM follow_item ORDER BY id')))
        self.execute('rename', ['outdoors'], name='户外')
        self.execute('merge', ['outdoors', 'landscape'], target_id='outdoors')
        rows = web_follow.q_follow_tags(self.contract, {'types': 'all'})['items']
        tag = next(row for row in rows if row['id'] == 'outdoors')
        self.assertEqual((tag['k'], tag['n'], tag['cat']), ('户外', 3, 'general'))
        self.assertIn('landscape', tag['aliases'])
        self.assertEqual(list(map(tuple, self.c.execute('SELECT id,metadata_json FROM follow_item ORDER BY id'))), originals)
        for name in ['户外', 'landscape', 'outdoors']:
            feed = web_follow.q_follow(self.contract, {'tag': name})
            self.assertEqual(len(feed['groups']), 3)
            self.assertEqual([name for name, _count in feed['facets']['tags']], ['户外'])
            self.assertTrue(all(group['primary']['tags'] == ['户外'] for group in feed['groups']))
        with self.database.write_transaction() as connection:
            self.record(FollowStore(lambda: connection), source, 4, ['landscape'])
        self.assertEqual(next(row for row in web_follow.q_follow_tags(self.contract, {'types': 'all'})['items']
                              if row['id'] == 'outdoors')['n'], 4)

    def test_hidden_online_tags_restore_across_index_cards_and_facets(self):
        self.seed()
        self.execute('hide', ['outdoors'])
        self.assertNotIn('outdoors', [row['k'] for row in web_follow.q_follow_tags(self.contract, {'types': 'all'})['items']])
        feed = web_follow.q_follow(self.contract, {})
        self.assertNotIn('outdoors', dict(feed['facets']['tags']))
        self.assertTrue(all('outdoors' not in group['primary']['detail_tags'] for group in feed['groups']))
        self.assertTrue(any('outdoors' in metadata for (metadata,) in self.c.execute('SELECT metadata_json FROM follow_item')))
        self.execute('restore', ['outdoors'])
        self.assertIn('outdoors', [row['k'] for row in web_follow.q_follow_tags(self.contract, {'types': 'all'})['items']])
        restored = web_follow.q_follow(self.contract, {})
        self.assertIn('outdoors', dict(restored['facets']['tags']))
        self.assertTrue(any('outdoors' in group['primary']['detail_tags'] for group in restored['groups']))

    def test_custom_online_tags_survive_source_updates_and_follow_aliases(self):
        source = self.seed()
        item_id = self.c.execute("SELECT id FROM follow_item WHERE external_id='2'").fetchone()[0]
        originals = list(map(tuple, self.c.execute('SELECT id,metadata_json FROM follow_item ORDER BY id')))
        command = dict(id=item_id, operation='add', tag='我的精选')
        for _ in range(2):
            result = web_follow.w_follow_tag(self.contract, command)
            self.assertEqual(result['item']['custom_tags'], ['我的精选'])
        self.assertEqual(list(map(tuple, self.c.execute('SELECT id,metadata_json FROM follow_item ORDER BY id'))), originals)
        filtered = web_follow.q_follow(self.contract, {'tag': '我的精选,outdoors'})
        self.assertEqual([row['primary']['id'] for row in filtered['groups']], [item_id])
        self.assertIn('我的精选', dict(filtered['facets']['tags']))
        self.execute('rename', ['我的精选'], name='值得重看')
        with self.database.write_transaction() as connection:
            self.record(FollowStore(lambda: connection), source, 2, ['outdoors'])
        updated = web_follow.q_follow(self.contract, {'item': item_id})['groups'][0]['primary']
        self.assertEqual(updated['custom_tags'], ['值得重看'])
        self.assertIn('值得重看', updated['tags'])
        self.assertEqual(len(web_follow.q_follow(self.contract, {'tag': '我的精选'})['groups']), 1)
        removed = web_follow.w_follow_tag(self.contract, dict(id=item_id, operation='remove', tag='值得重看'))
        self.assertEqual(removed['item']['custom_tags'], [])
        self.assertIn('outdoors', removed['item']['tags'])
        self.assertEqual(web_follow.q_follow(self.contract, {'tag': '值得重看'})['groups'], [])

    def test_content_blocking_applies_to_counts_facets_new_items_and_restore(self):
        source = self.seed()
        self.execute('hide', ['outdoors'])
        self.assertEqual(sum(web_follow.q_follow(self.contract, {})['counts'].values()), 3)
        self.execute('block', ['outdoors'])
        hidden = web_follow.q_follow(self.contract, {})
        self.assertEqual([row['primary']['external_id'] for row in hidden['groups']], ['3'])
        self.assertEqual(sum(hidden['counts'].values()), 1)
        self.assertNotIn('outdoors', dict(hidden['facets']['tags']))
        self.assertNotIn('outdoors', [row['k'] for row in web_follow.q_follow_tags(self.contract, {'types': 'all'})['items']])
        blocked = next(row for row in web_follow.online_tag_inventory(self.c) if row['id'] == 'outdoors')
        self.assertTrue(blocked['blocked'])
        self.execute('rename', ['outdoors'], name='户外')
        with self.database.write_transaction() as connection:
            self.record(FollowStore(lambda: connection), source, 4, ['outdoors'])
        self.assertEqual(sum(web_follow.q_follow(self.contract, {})['counts'].values()), 1)
        item_id = self.c.execute("SELECT id FROM follow_item WHERE external_id='2'").fetchone()[0]
        detail = web_follow.q_follow(self.contract, {'item': item_id})['groups'][0]['primary']
        self.assertEqual(detail['blocked_tags'], ['户外'])
        self.execute('unblock', ['outdoors'])
        self.assertEqual(sum(web_follow.q_follow(self.contract, {})['counts'].values()), 4)
        self.assertTrue(next(row for row in web_follow.online_tag_inventory(self.c) if row['id'] == 'outdoors')['hidden'])

    def test_blocking_one_variant_hides_the_whole_group(self):
        self.seed()
        self.c.execute("UPDATE follow_item SET group_hint='shared-work' WHERE external_id IN ('2','3')")
        self.c.commit()
        whole = web_follow.q_follow(self.contract, {})
        self.assertEqual(len(whole['groups']), 2)
        self.execute('block', ['outdoors'])
        self.assertEqual(web_follow.q_follow(self.contract, {})['groups'], [])
        self.assertEqual(sum(web_follow.q_follow(self.contract, {})['counts'].values()), 0)

    def test_item_tag_removal_and_restore_preserve_source_evidence(self):
        self.seed()
        item_id = self.c.execute("SELECT id FROM follow_item WHERE external_id='2'").fetchone()[0]
        for tag in ['', ' ', 'a,b', 'a\nb', 'x' * 81]:
            with self.subTest(tag=repr(tag)), self.assertRaisesRegex(ValueError, '标签名'):
                web_follow.w_follow_tag(self.contract, dict(id=item_id, operation='add', tag=tag))
        original = self.c.execute('SELECT metadata_json FROM follow_item WHERE id=?', (item_id,)).fetchone()[0]
        removed = web_follow.w_follow_tag(self.contract, dict(id=item_id, operation='remove', tag='outdoors'))
        self.assertNotIn('outdoors', removed['item']['tags'])
        self.assertEqual(self.c.execute('SELECT metadata_json FROM follow_item WHERE id=?', (item_id,)).fetchone()[0], original)
        self.assertNotIn(item_id, [row['primary']['id'] for row in web_follow.q_follow(self.contract, {'tag': 'outdoors'})['groups']])
        self.execute('rename', ['outdoors'], name='户外')
        renamed = web_follow.q_follow(self.contract, {'item': item_id})['groups'][0]['primary']
        self.assertNotIn('户外', renamed['tags'])
        restored = web_follow.w_follow_tag(self.contract, dict(id=item_id, operation='restore', tag='户外'))
        self.assertIn('户外', restored['item']['tags'])
        self.assertEqual(restored['item']['custom_tags'], [])
        with self.assertRaisesRegex(ValueError, '不存在'):
            web_follow.w_follow_tag(self.contract, dict(id=987654, operation='add', tag='精选'))

    def test_merge_preserves_content_blocking_and_unblock_remains_available_without_items(self):
        self.seed()
        self.execute('block', ['outdoors'])
        self.execute('merge', ['outdoors', 'landscape'], target_id='landscape')
        self.assertEqual(web_follow.q_follow(self.contract, {})['groups'], [])
        self.c.execute('UPDATE follow_source SET enabled=0')
        self.c.commit()
        row = next(row for row in web_follow.online_tag_inventory(self.c) if row['id'] == 'landscape')
        self.assertEqual(row['n'], 0)
        self.assertTrue(row['blocked'])
        self.execute('unblock', ['landscape'])
        self.assertFalse(next(row for row in web_follow.online_tag_inventory(self.c) if row['id'] == 'landscape')['blocked'])

    def test_blocking_by_name_covers_tags_not_fetched_yet_and_unblocking_leaves_no_empty_tag(self):
        source = self.seed()
        command = dict(scope='online', operation='block', name='Gay')
        with self.database.read_connection() as connection:
            plan = online_tag_management.preview(connection, command, web_follow.online_tag_inventory(connection))
        self.assertEqual((plan['ids'], plan['assets']), (['gay'], 0))
        w_tag_management(self.contract, dict(command, token=plan['token']))
        blocked = next(row for row in web_follow.online_tag_inventory(self.c) if row['id'] == 'gay')
        self.assertTrue(blocked['blocked'])
        with self.database.write_transaction() as connection:
            self.record(FollowStore(lambda: connection), source, 4, ['gay', 'outdoors'])
        self.assertEqual(sorted(group['primary']['external_id'] for group in web_follow.q_follow(self.contract, {})['groups']),
                         ['1', '2', '3'])
        self.execute('unblock', ['gay'])
        self.assertEqual(len(web_follow.q_follow(self.contract, {})['groups']), 4)
        self.c.execute("DELETE FROM follow_item WHERE external_id='4'")
        self.c.commit()
        self.execute('block', [], name='nothing-yet')
        self.execute('unblock', ['nothing-yet'])
        self.assertNotIn('nothing-yet', [row['id'] for row in web_follow.online_tag_inventory(self.c)])

    def test_blocking_by_name_reuses_an_existing_tag(self):
        self.seed()
        with self.database.read_connection() as connection:
            plan = online_tag_management.preview(connection, dict(scope='online', operation='block', name='Outdoors'),
                                                 web_follow.online_tag_inventory(connection))
        self.assertEqual((plan['ids'], plan['assets']), (['outdoors'], 2))
        for name in ['', 'a,b', 'x' * 81]:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, '标签名'):
                with self.database.read_connection() as connection:
                    online_tag_management.preview(connection, dict(scope='online', operation='block', name=name),
                                                  web_follow.online_tag_inventory(connection))

    def test_online_conflicts_types_and_stale_plans_are_rejected(self):
        self.seed()
        with self.assertRaisesRegex(ValueError, '相同来源类型'):
            online_tag_management.preview(self.c, dict(operation='merge', ids=['outdoors', 'preview_artist'], target_id='outdoors'), web_follow.online_tag_inventory(self.c))
        with self.assertRaisesRegex(ValueError, '合并标签'):
            online_tag_management.preview(self.c, dict(operation='rename', ids=['outdoors'], name='landscape'), web_follow.online_tag_inventory(self.c))
        command = dict(scope='online', operation='rename', ids=['outdoors'], name='户外')
        command['token'] = online_tag_management.preview(self.c, command, web_follow.online_tag_inventory(self.c))['token']
        self.execute('hide', ['outdoors'])
        with self.assertRaisesRegex(ValueError, '重新预览'):
            w_tag_management(self.contract, command)

    def test_online_favorites_follow_rename_merge_and_keep_local_tags_independent(self):
        self.seed()
        entity_id = upsert_asset_entity(self.c, kind='tag', name='户外', asset_id=1, role='tag', source='web-user')
        self.c.commit()
        web_library_shortcuts.w_library_shortcuts(self.contract, dict(action='favorite', entity_id=entity_id, on=True))
        for tag in ['outdoors', 'landscape']:
            web_library_shortcuts.w_library_shortcuts(self.contract,
                dict(action='favorite', scope='online', kind='tag', tag_id=tag, name='客户端名称', on=True))
        self.execute('rename', ['outdoors'], name='户外')
        self.execute('merge', ['outdoors', 'landscape'], target_id='outdoors')
        favorites = web_library_shortcuts.q_library_shortcuts(self.contract)['favorites']
        self.assertEqual(len(favorites), 2)
        self.assertEqual([row['name'] for row in favorites], ['户外', '户外'])
        self.assertEqual(len(favorite_entities(self.c)), 1)
        online = next(row for row in favorites if row.get('scope') == 'online')
        self.assertEqual(online['tag_id'], 'outdoors')
        index = web_follow.q_follow_tags(self.contract, {'types': 'all'})['items']
        self.assertTrue(next(row for row in index if row['id'] == 'outdoors')['favorite'])
        web_library_shortcuts.w_library_shortcuts(self.contract, dict(action='favorite', **online, on=False))
        self.assertEqual(len(web_library_shortcuts.q_library_shortcuts(self.contract)['favorites']), 1)
