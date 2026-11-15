"""名册批量动作：隐藏、订阅新作、名下作品移进回收站，以及各自按回执原样撤销。"""
import tempfile
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
