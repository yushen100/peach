"""名册批量动作：隐藏、订阅新作、名下作品移进回收站，以及各自按回执原样撤销。"""
import tempfile
import json
import unittest
from pathlib import Path
from unittest import mock

from support.ledger import fresh_ledger
from peach.user_messages import UserValueError
from peach.web_entity import q_index
from peach.web_entity_batch import q_entity_batch_plan, w_entity_batch
from peach.web_state import WebContract


class EntityBatchTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.contract = WebContract(fresh_ledger(self.root), avatar_root=self.root / 'avatars')
        with self.contract.write_transaction() as c:
            for entity_id, kind in ((1, 'performer'), (2, 'performer'), (3, 'studio'), (4, 'tag'), (5, 'agency')):
                c.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at) "
                          "VALUES(?,?,?,?,'2026-01-01','2026-01-01')", (entity_id, kind, f'名字{entity_id}', f'名字{entity_id}'))
            for asset_id, entity_id, disposal in ((1, 1, None), (2, 1, 'trash'), (3, 2, None), (4, 3, None), (5, 4, None)):
                c.execute("INSERT INTO asset(id,location,path,name,medium,disposal) VALUES(?,'local',?,?,'video',?)",
                          (asset_id, f'R:\\demo\\{asset_id}.mp4', f'{asset_id}.mp4', disposal))
                c.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(?,?,'performer','user:manual')",
                          (asset_id, entity_id))

    def run_batch(self, operation, **fields):
        return w_entity_batch(self.contract, {'operation': operation, **fields})

    def delete_plan(self, ids):
        return q_entity_batch_plan(self.contract, {'operation': 'delete', 'ids': ','.join(map(str, ids))})

    def test_delete_profiles_clears_relations_and_preserves_works(self):
        with self.contract.write_transaction() as c:
            for entity_id, kind in ((6, 'creator'), (7, 'series')):
                c.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at) "
                          "VALUES(?,?,?,?,'2026-01-01','2026-01-01')", (entity_id, kind, f'名字{entity_id}', f'名字{entity_id}'))
            c.execute("INSERT INTO entity_alias VALUES(1,'旧名','旧名','user:manual',1)")
            c.execute("INSERT INTO asset_tag(asset_id,tag,source) VALUES(1,'performer:旧名','user:manual')")
            c.execute("UPDATE asset SET studio='名字3',creator='名字6',series='名字7' WHERE id=1")
            c.execute("INSERT INTO entity_membership(member_id,agency_id,source,checked_at) "
                      "VALUES(1,5,'user:manual','2026-01-01')")
            c.execute("INSERT INTO label_maker(label_id,maker_id,source,checked_at) "
                      "VALUES(3,5,'user:manual','2026-01-01')")
            c.execute("INSERT INTO entity_redirect VALUES(20,1,'user:merge','2026-01-01')")
            c.execute("INSERT INTO performer_profile(entity_id,source,source_url,fetched_at) "
                      "VALUES(1,'user:manual','https://example.com','2026-01-01')")
            c.execute("INSERT INTO follow_source(entity_id,provider,ref,label,url,created_at,updated_at) "
                      "VALUES(1,'rss','test','名称','https://example.com/feed','2026-01-01','2026-01-01')")
            c.execute("INSERT INTO feed_source(kind,name,url,entity_id,created_at) "
                      "VALUES('rss','名称','https://example.com/feed',1,'2026-01-01')")
            c.execute("UPDATE profile SET settings_json=? WHERE id='local-default'",
                      (json.dumps({'libraryShortcuts': {'favorites': [{'entity_id': 20}, {'entity_id': 2}]}}),))
        selected = [1, 3, 5, 6, 7]
        plan = self.delete_plan(selected)
        self.assertEqual(plan['assets'], 3)
        self.assertEqual(plan['entity_ids'], selected)
        self.assertEqual(self.run_batch('delete', entity_ids=selected, token=plan['token'])['entity_ids'], selected)
        self.assertEqual(self.disposal(), {1: None, 2: 'trash', 3: None, 4: None, 5: None})
        with self.contract.read_connection() as c:
            self.assertEqual([row[0] for row in c.execute('SELECT id FROM entity ORDER BY id')], [2, 4])
            self.assertEqual(tuple(c.execute('SELECT studio,creator,series FROM asset WHERE id=1').fetchone()),
                             (None, None, None))
            self.assertEqual(c.execute("SELECT count(*) FROM asset_tag WHERE tag='performer:旧名'").fetchone()[0], 0)
            self.assertEqual(c.execute('SELECT entity_id FROM follow_source').fetchone()[0], None)
            self.assertEqual(c.execute('SELECT entity_id FROM feed_source').fetchone()[0], None)
            favorites = json.loads(c.execute("SELECT settings_json FROM profile WHERE id='local-default'").fetchone()[0])
            self.assertEqual(favorites['libraryShortcuts']['favorites'], [{'entity_id': 2}])
            self.assertEqual(list(c.execute('PRAGMA foreign_key_check')), [])
            self.assertEqual(list(c.execute('SELECT * FROM entity_membership')), [])
            self.assertEqual(list(c.execute('SELECT * FROM label_maker')), [])
        self.assertEqual(len(list(self.contract.db_path.parent.glob('ledger.pre-entity-delete-*.db'))), 1)

    def test_delete_requires_the_current_plan_and_exact_live_ids(self):
        plan = self.delete_plan([1])
        with self.assertRaises(UserValueError):
            self.run_batch('delete', entity_ids=[1])
        with self.contract.write_transaction() as c:
            c.execute("UPDATE entity SET canonical_name='已改名' WHERE id=1")
        with self.assertRaises(UserValueError):
            self.run_batch('delete', entity_ids=[1], token=plan['token'])
        with self.contract.write_transaction() as c:
            c.execute("INSERT INTO entity_redirect VALUES(20,1,'user:merge','2026-01-01')")
        for values in ([20], [4], [99]):
            with self.subTest(values=values), self.assertRaises(UserValueError):
                self.delete_plan(values)
        with self.assertRaises(UserValueError):
            q_entity_batch_plan(self.contract, {'operation': 'delete', 'ids': '1,bad'})
        self.assertEqual([row['entity_id'] for row in self.roster()['items']], [1, 2])

    def test_delete_preserves_a_live_identity_reusing_a_redirect_id(self):
        self.contract.avatar_root.mkdir()
        image = self.contract.avatar_root / 'performer-2.img'
        image.write_bytes(b'current identity image')
        with self.contract.write_transaction() as c:
            c.execute("INSERT INTO entity_redirect VALUES(2,1,'user:merge','2026-01-01')")
            c.execute("UPDATE profile SET settings_json=? WHERE id='local-default'",
                      (json.dumps({'libraryShortcuts': {'favorites': [{'entity_id': 2}]}}),))
            c.execute("INSERT INTO review_decision(category,item_key,status,note,updated_at) "
                      "VALUES('performer-removal','3:2','rejected','保留当前档案','2026-01-01')")
        plan = self.delete_plan([1])
        self.run_batch('delete', entity_ids=[1], token=plan['token'])
        self.assertTrue(image.is_file(), '重用旧 ID 的当前档案头像必须保留')
        self.assertEqual(image.read_bytes(), b'current identity image')
        with self.contract.read_connection() as c:
            self.assertIsNotNone(c.execute('SELECT id FROM entity WHERE id=2').fetchone())
            settings = json.loads(c.execute("SELECT settings_json FROM profile WHERE id='local-default'").fetchone()[0])
            self.assertEqual(settings['libraryShortcuts']['favorites'], [{'entity_id': 2}])
            self.assertEqual(c.execute("SELECT status FROM review_decision WHERE item_key='3:2'").fetchone()[0], 'rejected')
            self.assertEqual(list(c.execute('PRAGMA foreign_key_check')), [])

    def test_delete_with_trash_keeps_media_and_moves_all_scoped_works(self):
        with self.contract.write_transaction() as c:
            c.execute("INSERT INTO entity_membership(member_id,agency_id,source,checked_at) "
                      "VALUES(1,5,'user:manual','2026-01-01')")
        plan = self.delete_plan([5])
        self.assertEqual(plan['assets'], 2)
        result = self.run_batch('delete', mode='trash', entity_ids=[5], token=plan['token'])
        self.assertEqual(result['entity_ids'], [5])
        self.assertEqual(result['asset_ids'], [1])
        self.assertEqual(self.disposal()[1], 'trash')
        with self.contract.read_connection() as c:
            self.assertIsNotNone(c.execute('SELECT id FROM entity WHERE id=1').fetchone())
            self.assertEqual(c.execute('SELECT count(*) FROM asset').fetchone()[0], 5)

    def temporary_media(self, ids):
        folder = self.root / 'media'
        folder.mkdir(exist_ok=True)
        paths = {asset_id: folder / f'{asset_id}.mp4' for asset_id in ids}
        with self.contract.write_transaction() as c:
            for asset_id, path in paths.items():
                path.write_bytes(f'media-{asset_id}'.encode())
                c.execute('UPDATE asset SET path=?,size=? WHERE id=?', (str(path), path.stat().st_size, asset_id))
        self.enterContext(mock.patch('peach.web_batch.LOCATION_ROOT_DECLARATIONS', {'local': (str(folder),)}))
        return paths

    def test_delete_with_purge_removes_temporary_media_and_shared_works(self):
        paths = self.temporary_media([1, 2])
        with self.contract.write_transaction() as c:
            c.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(1,2,'performer','test')")
        plan = self.delete_plan([1])
        self.assertEqual(plan['shared'], 1)
        result = self.run_batch('delete', mode='purge', entity_ids=[1], token=plan['token'])
        self.assertEqual((result['entity_ids'], result['purged'], result['blocked']), ([1], 2, []))
        self.assertTrue(all(not path.exists() for path in paths.values()))
        with self.contract.read_connection() as c:
            self.assertEqual([row[0] for row in c.execute('SELECT id FROM asset ORDER BY id')], [3, 4, 5])
            self.assertIsNotNone(c.execute('SELECT id FROM entity WHERE id=2').fetchone())
            self.assertEqual(list(c.execute('PRAGMA foreign_key_check')), [])

    def test_purge_keeps_a_profile_with_blocked_media_and_preserves_its_links(self):
        paths = self.temporary_media([1, 2, 3])
        from peach.web_batch import _quarantine_media

        def quarantine(path, **options):
            if path == paths[2]:
                raise PermissionError('file is in use')
            return _quarantine_media(path, **options)

        plan = self.delete_plan([1, 2])
        with mock.patch('peach.web_batch._quarantine_media', side_effect=quarantine):
            result = self.run_batch('delete', mode='purge', entity_ids=[1, 2], token=plan['token'])
        self.assertEqual(result['entity_ids'], [2])
        self.assertEqual(result['retained_entity_ids'], [1])
        self.assertEqual(result['purged'], 2)
        self.assertEqual(result['blocked'][0]['id'], 2)
        self.assertEqual(paths[2].read_bytes(), b'media-2')
        with self.contract.read_connection() as c:
            self.assertIsNotNone(c.execute('SELECT entity_id FROM asset_entity WHERE asset_id=2').fetchone())

    def test_purge_transaction_failure_restores_temporary_media_and_rows(self):
        paths = self.temporary_media([1, 2])
        plan = self.delete_plan([1])
        with mock.patch('peach.web_entity_deletion.delete_entities', side_effect=RuntimeError('write failed')):
            with self.assertRaisesRegex(RuntimeError, 'write failed'):
                self.run_batch('delete', mode='purge', entity_ids=[1], token=plan['token'])
        self.assertEqual([path.read_bytes() for path in paths.values()], [b'media-1', b'media-2'])
        self.assertEqual(len(self.disposal()), 5)

    def test_direct_purge_has_no_file_effect_before_backup_succeeds(self):
        paths = self.temporary_media([1, 2])
        plan = self.delete_plan([1])
        with mock.patch('peach.web_batch._is_rclone_mount', return_value=True):
            with mock.patch('peach.web_entity_deletion.sqlite_backup', side_effect=OSError('backup failed')):
                with self.assertRaisesRegex(OSError, 'backup failed'):
                    self.run_batch('delete', mode='purge', entity_ids=[1], token=plan['token'])
            self.assertTrue(all(path.is_file() for path in paths.values()))
            self.assertEqual(len(self.disposal()), 5)
            result = self.run_batch('delete', mode='purge', entity_ids=[1], token=plan['token'])
        self.assertEqual(result['purged'], 2)
        self.assertTrue(all(not path.exists() for path in paths.values()))

    def test_changed_media_or_shared_scope_requires_a_fresh_plan_before_staging(self):
        for change in ("UPDATE asset SET mutation_revision=mutation_revision+1 WHERE id=1",
                       "INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(1,2,'performer','test')"):
            plan = self.delete_plan([1])
            with self.contract.write_transaction() as c:
                c.execute(change)
            with mock.patch('peach.web_batch.stage_purge') as stage:
                with self.assertRaises(UserValueError):
                    self.run_batch('delete', mode='purge', entity_ids=[1], token=plan['token'])
                stage.assert_not_called()

    def test_delete_rejects_unknown_modes(self):
        plan = self.delete_plan([1])
        for mode in ('unknown', [], None):
            with self.subTest(mode=mode), self.assertRaises(UserValueError):
                self.run_batch('delete', mode=mode, entity_ids=[1], token=plan['token'])

    def test_delete_preserves_another_profiles_shared_alias_and_archives_removal_history(self):
        with self.contract.write_transaction() as c:
            c.execute("INSERT INTO entity_alias VALUES(1,'名字2','名字2','user:manual',1)")
            c.execute("INSERT INTO asset_tag(asset_id,tag,source) VALUES(3,'performer:名字2','user:manual')")
            c.execute("INSERT INTO review_decision(category,item_key,status,note,updated_at) "
                      "VALUES('performer-removal','3:1','rejected','人工移除','2026-01-01')")
        plan = self.delete_plan([1])
        self.run_batch('delete', entity_ids=[1], token=plan['token'])
        with self.contract.read_connection() as c:
            self.assertEqual(c.execute("SELECT tag FROM asset_tag WHERE asset_id=3").fetchone()[0], 'performer:名字2')
            self.assertEqual(c.execute("SELECT count(*) FROM review_decision WHERE category='performer-removal'").fetchone()[0], 0)
            self.assertEqual(c.execute("SELECT note FROM review_decision_history WHERE item_key='3:1'").fetchone()[0], '人工移除')

    def test_delete_archives_images_and_restores_them_on_transaction_failure(self):
        images = self.contract.avatar_root
        images.mkdir()
        image = images / 'performer-1.img'
        image.write_bytes(b'cached image')
        sidecar = images / 'performer-1.face.json'
        sidecar.write_text('{}')
        plan = self.delete_plan([1])
        with mock.patch('peach.web_entity_deletion.delete_entities', side_effect=RuntimeError('write failed')):
            with self.assertRaisesRegex(RuntimeError, 'write failed'):
                self.run_batch('delete', entity_ids=[1], token=plan['token'])
        self.assertEqual(image.read_bytes(), b'cached image')
        self.assertTrue(sidecar.is_file())
        self.run_batch('delete', entity_ids=[1], token=plan['token'])
        self.assertFalse(image.exists())
        self.assertFalse(sidecar.exists())
        self.assertEqual(len(list((images / 'deleted').glob('*/performer-1.img'))), 1)

    def test_delete_rejects_changed_work_links_and_rolls_back_a_failed_batch(self):
        plan = self.delete_plan([1, 2])
        with self.contract.write_transaction() as c:
            c.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(4,1,'performer','test')")
        with self.assertRaises(UserValueError):
            self.run_batch('delete', entity_ids=[1, 2], token=plan['token'])
        plan = self.delete_plan([1, 2])
        with self.contract.write_transaction() as c:
            c.execute("CREATE TRIGGER refuse_delete BEFORE DELETE ON entity WHEN OLD.id=2 "
                      "BEGIN SELECT RAISE(ABORT,'refused'); END")
        with self.assertRaisesRegex(Exception, 'refused'):
            self.run_batch('delete', entity_ids=[1, 2], token=plan['token'])
        self.assertEqual([row['entity_id'] for row in self.roster()['items']], [1, 2])

    def roster(self, category=''):
        return q_index(self.contract, 'performers', category=category)

    def disposal(self):
        with self.contract.read_connection() as c:
            return dict(c.execute('SELECT id,disposal FROM asset ORDER BY id'))

    def test_hidden_people_leave_the_roster_and_only_appear_in_the_hidden_view(self):
        self.assertEqual([row['entity_id'] for row in self.roster()['items']], [1, 2])
        result = self.run_batch('hide', entity_ids=[1, 2])
        self.assertEqual(result['entity_ids'], [1, 2])
        self.assertEqual(self.roster()['items'], [])
        hidden = self.roster('hidden')
        self.assertEqual(([row['entity_id'] for row in hidden['items']], hidden['hidden']), ([1, 2], 2))
        # 已经隐藏的不算进这一批，撤销时也就不会把它一起放出来。
        self.run_batch('unhide', entity_ids=[2])
        self.assertEqual(self.run_batch('hide', entity_ids=[1, 2])['entity_ids'], [2])
        self.run_batch('unhide', entity_ids=[2])
        self.assertEqual([row['entity_id'] for row in self.roster()['items']], [2])

    def test_trash_moves_only_active_works_and_restore_returns_exactly_those(self):
        self.assertEqual(q_entity_batch_plan(self.contract, {'ids': '1,3'})['assets'], 2)
        result = self.run_batch('trash', entity_ids=[1, 3])
        self.assertEqual(result['asset_ids'], [1, 4])
        self.assertEqual(self.disposal(), {1: 'trash', 2: 'trash', 3: None, 4: 'trash', 5: None})
        self.assertEqual(self.run_batch('restore', asset_ids=result['asset_ids'])['asset_ids'], [1, 4])
        self.assertEqual(self.disposal(), {1: None, 2: 'trash', 3: None, 4: None, 5: None})

    def test_tag_content_goes_to_the_recycle_bin_but_agencies_are_refused(self):
        self.assertEqual(self.run_batch('trash', entity_ids=[4])['asset_ids'], [5])
        with self.assertRaises(UserValueError):
            self.run_batch('trash', entity_ids=[5])
        with self.assertRaises(UserValueError):
            self.run_batch('hide', entity_ids=[4])

    def test_follow_reports_people_without_source_ids_and_unfollow_only_lists_changes(self):
        with self.contract.write_transaction() as c:
            c.execute("INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id) "
                      "VALUES(1,'javdb','performer','AbC12')")
        with mock.patch('peach.web_feeds.fetch_new_sources') as fetch:
            result = self.run_batch('follow', entity_ids=[1, 2])
        self.assertEqual(result['entity_ids'], [1])
        self.assertEqual([item['id'] for item in result['skipped']], [2])
        fetch.assert_called_once()
        self.assertTrue(next(row for row in self.roster()['items'] if row['entity_id'] == 1)['following'])
        self.assertEqual(self.run_batch('unfollow', entity_ids=[1, 2])['entity_ids'], [1])
        self.assertFalse(next(row for row in self.roster()['items'] if row['entity_id'] == 1)['following'])
        with self.assertRaises(UserValueError):
            self.run_batch('follow', entity_ids=[3])

    def test_unknown_operations_and_bad_ids_are_rejected(self):
        for body in ({'operation': 'purge', 'entity_ids': [1]}, {'operation': 'hide', 'entity_ids': []},
                     {'operation': 'hide', 'entity_ids': ['1']}, {'operation': 'hide', 'entity_ids': [99]}):
            with self.subTest(body=body), self.assertRaises(UserValueError):
                w_entity_batch(self.contract, body)


if __name__ == '__main__':
    unittest.main()
