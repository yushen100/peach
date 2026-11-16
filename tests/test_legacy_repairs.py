"""旧版本留下的存量在升级时各补一次：用临时账本造出旧数据，跑一遍升级本地补修，核对改写、回执与只做一次。"""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from peach import legacy_repairs, repair_center, upgrade_repairs
from peach.catalog_rules import normalise_code_key
from peach.catalog_vocabulary import current_link_label
from peach.entities import normalize_entity_name
from peach.repository import LedgerDatabase
from peach.social_links import canonical_url
from peach.task_runs import TaskRunStore
from support.ledger import fresh_ledger

STAMP = '2026-11-01T00:00:00Z'


class LinkValueTests(unittest.TestCase):
    def test_amp_entity_in_address_is_restored(self):
        self.assertEqual(canonical_url('https://www.bambi.ne.jp/official/model.php?alias=a&amp;id=176'),
                         'https://www.bambi.ne.jp/official/model.php?alias=a&id=176')
        self.assertEqual(canonical_url('https://example.jp/?a=1&amp;amp;b=2'), 'https://example.jp/?a=1&b=2')

    def test_legacy_generic_link_names_become_ids_and_proper_names_stay(self):
        cases = {'官方网站': 'official-site', '官方博客': 'official-blog', '官方频道页': 'official-channel',
                 '官网存档（2022-05）': 'official-archive:2022-05', '博客 旬の果実': 'blog:旬の果実',
                 'KMP 作品页': 'catalog-page:KMP', 'FALENO Group 厂牌页': 'label-page:FALENO Group',
                 'TeamSkeet 系列页': 'series-page:TeamSkeet', 'FANZA 作品列表': 'catalog-list:FANZA',
                 '粉丝社区 X @Ura_Deeps': 'fan-community:X @Ura_Deeps', 'X（招募）': 'recruiting:X',
                 '链接集（lit.link）': 'link-hub:lit.link', 'nanairo 官方 X @_scute': 'nanairo X @_scute',
                 'マインズ': 'マインズ', 'Instagram @name': 'Instagram @name', 'blog': 'blog'}
        for old, new in cases.items():
            with self.subTest(old=old):
                self.assertEqual(current_link_label(old), new)
                self.assertEqual(current_link_label(new), new)


class LedgerCase(unittest.TestCase):
    """临时账本与一份升级补修服务。"""

    def setUp(self):
        capacity = patch('peach.storage_budget.CapacityGuard.check')
        capacity.start()
        self.addCleanup(capacity.stop)
        holder = tempfile.TemporaryDirectory()
        self.addCleanup(holder.cleanup)
        self.root = Path(holder.name).resolve()
        self.db = fresh_ledger(self.root)
        self.database = LedgerDatabase(self.db)
        self.contract = SimpleNamespace(
            database=self.database, db_path=self.db, task_runs=TaskRunStore(self.database, host='legacy-test'),
            follow_state_root=self.root / 'state', follow_sources_root=self.root / 'sources',
            entry_links_root=self.root / 'state', candidate_root=self.root / 'generated',
            cover_root=self.root / 'covers', logo_root=self.root / 'logos', avatar_root=self.root / 'avatars',
            snapshot_root=self.root / 'snapshots', followups=SimpleNamespace(wake=Mock()))
        self.service = upgrade_repairs.UpgradeRepairs(self.contract, available=True)

    def execute(self, sql, params=()):
        with self.database.write_transaction() as connection:
            return connection.execute(sql, params).lastrowid

    def rows(self, sql, params=()):
        with self.database.read_connection() as connection:
            return [tuple(row) for row in connection.execute(sql, params)]

    def receipt(self, key):
        found = self.rows('SELECT result_json FROM ledger_upgrade_repair WHERE id=?', (key,))
        return json.loads(found[0][0]) if found else None

    def entity(self, kind, name):
        return self.execute('INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)'
                            ' VALUES(?,?,?,?,?)', (kind, name, normalize_entity_name(name), STAMP, STAMP))

    def asset(self, asset_id, *, medium='video', code=None, owners=None, **fields):
        columns = ['id', 'location', 'path', 'name', 'medium', 'code', 'field_owners', *fields]
        values = [asset_id, 'local', f'{asset_id}.mp4', f'{asset_id}.mp4', medium, code,
                  json.dumps(owners or {}), *fields.values()]
        self.execute(f'INSERT INTO asset({",".join(columns)}) VALUES({",".join("?" * len(values))})', values)


class LegacyRepairTests(LedgerCase):
    def test_entity_links_are_repaired_once_with_a_backup(self):
        performer = self.entity('performer', '某女优')
        link = "INSERT INTO entity_link(entity_id,link_kind,label,url,hostname,created_at,updated_at) VALUES(?,?,?,?,?,?,?)"
        broken = self.execute(link, (performer, 'official', '官方网站', 'https://www.bambi.ne.jp/m.php?a=x&amp;id=1',
                                     'www.bambi.ne.jp', STAMP, STAMP))
        archive = self.execute(link, (performer, 'official', '官网存档（2022-05）', 'https://web.archive.org/x',
                                      'web.archive.org', STAMP, STAMP))
        self.execute(link, (performer, 'social', 'X', 'https://x.com/a?b=1&c=2', 'x.com', STAMP, STAMP))
        duplicate = self.execute(link, (performer, 'social', 'X', 'https://x.com/a?b=1&amp;c=2', 'x.com', STAMP, STAMP))
        proper = self.execute(link, (performer, 'official', 'マインズ', 'https://minds.example/', 'minds.example',
                                     STAMP, STAMP))

        self.service.prepare()

        self.assertEqual(self.rows('SELECT id,label,url FROM entity_link ORDER BY id'), [
            (broken, 'official-site', 'https://www.bambi.ne.jp/m.php?a=x&id=1'),
            (archive, 'official-archive:2022-05', 'https://web.archive.org/x'),
            (archive + 1, 'X', 'https://x.com/a?b=1&c=2'),
            (proper, 'マインズ', 'https://minds.example/')])
        receipt = self.receipt('entity-link-values-1')
        self.assertEqual(receipt['changed'], 4)
        self.assertEqual([row['id'] for row in receipt['dropped']], [duplicate])
        self.assertEqual({row['id']: row['label'] for row in receipt['labels']},
                         {broken: '官方网站', archive: '官网存档（2022-05）'})
        self.assertTrue(Path(receipt['backup']).is_file())
        # 做过就不再做：之后再写进来的旧值留给入口去挡。
        self.execute('UPDATE entity_link SET label=? WHERE id=?', ('官方博客', proper))
        self.service.prepare()
        self.assertEqual(self.rows('SELECT label FROM entity_link WHERE id=?', (proper,)), [('官方博客',)])
        with self.database.read_connection() as connection:
            center = repair_center.snapshot(connection, {}, cloud_pending=0)
        self.assertEqual(next(item['changed'] for item in center['items'] if item['id'] == 'entity-links'), 4)
        self.assertIn('entity-link-values', [row['rule'] for row in center['history']])

    def test_fc2_seller_studio_moves_to_the_platform_and_user_values_stay(self):
        seller = self.entity('studio', 'プライベート管理人')
        self.asset(1, code='FC2-PPV-1234567', studio='プライベート管理人', owners={'studio': 'auto:javdb'})
        self.asset(2, code='FC2-PPV-7654321', studio='プライベート管理人', owners={'studio': 'user:manual'})
        self.asset(3, code='SSIS-001', studio='S1 NO.1 STYLE')
        for asset_id in (1, 2):
            self.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source,confidence,metadata_json,"
                         "first_seen_at,last_seen_at) VALUES(?,?,'studio','javinizer:javdb',1.0,'{}',?,?)",
                         (asset_id, seller, STAMP, STAMP))

        self.service.prepare()

        self.assertEqual(self.rows('SELECT id,studio FROM asset ORDER BY id'),
                         [(1, 'FC2-PPV'), (2, 'プライベート管理人'), (3, 'S1 NO.1 STYLE')])
        platform = self.rows("SELECT id FROM entity WHERE kind='studio' AND canonical_name='FC2-PPV'")[0][0]
        self.assertEqual(self.rows("SELECT asset_id,entity_id FROM asset_entity WHERE role='studio' ORDER BY asset_id"),
                         [(1, platform), (2, seller)])
        receipt = self.receipt('fc2-seller-studios-1')
        self.assertEqual(receipt['assets'], [{'id': 1, 'studio': 'プライベート管理人', 'owner': 'auto:javdb'}])
        self.assertEqual(receipt['links'], [{'asset_id': 1, 'entity_id': seller, 'source': 'javinizer:javdb'}])

    def test_scrape_marks_are_stripped_from_unprotected_titles(self):
        self.asset(1, code='FC2-PPV-1', catalog_title='**ppjonsoo 素人ちゃん', original_title='素人ちゃん')
        self.asset(2, code='FC2-PPV-2', catalog_title='**ppjonsoo 手動', owners={'catalog_title': 'user:manual'})

        self.service.prepare()

        self.assertEqual(self.rows('SELECT id,catalog_title FROM asset ORDER BY id'),
                         [(1, '素人ちゃん'), (2, '**ppjonsoo 手動')])
        receipt = self.receipt('scrape-mark-titles-1')
        self.assertEqual(receipt['assets'], [{'id': 1, 'catalog_title': {'value': '**ppjonsoo 素人ちゃん', 'owner': ''}}])

    def test_series_alias_in_flat_column_becomes_the_canonical_name(self):
        series = self.entity('series', '1VS1')
        self.execute("INSERT INTO entity_alias(entity_id,alias,normalized_alias,source) VALUES(?,?,?,?)",
                     (series, '1 VS 1', normalize_entity_name('1 VS 1'), 'test'))
        self.asset(1, series='1 VS 1')
        self.asset(2, series='1 VS 1', owners={'series': 'review:javdb'})

        self.service.prepare()

        self.assertEqual(self.rows('SELECT id,series FROM asset ORDER BY id'), [(1, '1VS1'), (2, '1 VS 1')])
        self.assertEqual(self.receipt('alias-flat-names-1')['changed'], 1)

    def test_retired_and_old_nfo_tags_follow_the_current_vocabulary(self):
        from peach.catalog_rules import DROPPED_TAGS
        dropped = sorted(DROPPED_TAGS)[0]
        self.asset(1)
        self.asset(2)
        for asset_id, tag, source in ((1, dropped, 'auto:filename'), (2, dropped, 'pixiv_tag'),
                                      (1, 'Blu-ray', 'javinizer:local_nfo:tag'), (1, 'My own shelf', 'javinizer:local_nfo:tag')):
            self.execute('INSERT INTO asset_tag(asset_id,tag,source) VALUES(?,?,?)', (asset_id, tag, source))

        with patch('peach.genre_taxonomy.resolve_genre',
                   side_effect=lambda raw, decisions=None: None if raw == 'Blu-ray' else ''):
            self.service.prepare()

        self.assertEqual(sorted(self.rows('SELECT tag,source FROM asset_tag')),
                         [('My own shelf', 'javinizer:local_nfo:tag'), (dropped, 'pixiv_tag')])
        receipt = self.receipt('tag-vocabulary-1')
        self.assertEqual(receipt['changed'], 2)
        self.assertEqual(receipt['nfo'], [{'old': 'Blu-ray', 'new': ''}])

    def test_bluray_shell_listed_beside_its_streaming_edition_is_removed(self):
        insert = ('INSERT INTO feed_discovery(code,title,performers,discovered_at) VALUES(?,?,?,?)')
        digital = self.execute(insert, ('GRACE-039', 'Pretty Glamour ー 誰もが恋する私に ー 藤森里穂', '藤森里穂', STAMP))
        bluray = self.execute(insert, ('GRABD-039', 'Pretty Glamour ― 誰もが恋する私に ― /藤森里穂（ブルーレイディスク）',
                                       '藤森里穂', STAMP))
        lone = self.execute(insert, ('GRABD-040', '別作品（ブルーレイディスク）', '藤森里穂', STAMP))
        performer = self.entity('performer', '藤森里穂')
        self.execute('INSERT INTO feed_discovery_entity(discovery_id,entity_id) VALUES(?,?)', (bluray, performer))

        self.service.prepare()

        self.assertEqual(self.rows('SELECT id FROM feed_discovery ORDER BY id'), [(digital,), (lone,)])
        self.assertEqual(self.rows('SELECT * FROM feed_discovery_entity'), [])
        shells = self.receipt('feed-bluray-duplicates-1')['shells']
        self.assertEqual([(row['code'], row['entities'], row['digital_code']) for row in shells],
                         [('GRABD-039', [performer], 'GRACE-039')])

    def test_wants_acquired_by_a_cover_point_to_the_video_or_go_back_to_wanted(self):
        self.asset(1, medium='image', code='ABC-001')
        self.asset(2, medium='video', code='ABC-001')
        self.asset(3, medium='image', code='ABC-002')
        insert = ("INSERT INTO want_item(code,code_key,origin,state,acquired_asset_id,acquired_at,acquired_source,"
                  "created_at,updated_at) VALUES(?,?,'code','acquired',?,?,'scan',?,?)")
        arrived = self.execute(insert, ('ABC-001', normalise_code_key('ABC-001'), 1, STAMP, STAMP, STAMP))
        waiting = self.execute(insert, ('ABC-002', normalise_code_key('ABC-002'), 3, STAMP, STAMP, STAMP))
        fine = self.execute(insert, ('ABC-001 second', 'ABC-001-second', 2, STAMP, STAMP, STAMP))

        self.service.prepare()

        self.assertEqual(self.rows('SELECT id,state,acquired_asset_id FROM want_item ORDER BY id'),
                         [(arrived, 'acquired', 2), (waiting, 'wanted', None), (fine, 'acquired', 2)])
        wants = self.receipt('want-image-acquired-1')['wants']
        self.assertEqual([(row['id'], row['acquired_asset_id']) for row in wants], [(arrived, 1), (waiting, 3)])

    def test_old_cloud_download_notes_get_codes_and_keep_their_text(self):
        insert = ("INSERT INTO download_task(provider,source_uri,target,state,postprocess_detail,failure_detail,"
                  "updated_at) VALUES('115','magnet:?x',?,'done',?,?,?)")
        done = self.execute(insert, ('a', '正片已绑定，资料已采集并完成整理', None, STAMP))
        odd = self.execute(insert, ('b', None, 'RuntimeError: 某个异常', STAMP))
        submission = self.execute(
            "INSERT INTO download_submission(provider,source_uri,target,outcome,detail,created_at)"
            " VALUES('115','magnet:?y','c','failed',?,?)", ('查离线任务时连不上 CloudDrive2：Deadline Exceeded', STAMP))

        self.service.prepare()

        self.assertEqual(self.rows('SELECT id,postprocess_detail,postprocess_detail_code,failure_detail_code'
                                   ' FROM download_task ORDER BY id'),
                         [(done, '正片已绑定，资料已采集并完成整理', 'labels.downloadPostprocess.done', None),
                          (odd, None, None, None)])
        code, params = self.rows('SELECT detail_code,detail_params FROM download_submission WHERE id=?', (submission,))[0]
        self.assertEqual(code, 'errors.downloadsClouddrive.unreachable')
        self.assertEqual(json.loads(params), {'action': {'code': 'labels.downloadsClouddrive.action.listOffline'},
                                              'details': 'Deadline Exceeded'})

    def test_clean_ledger_records_every_rule_without_a_backup(self):
        with patch.object(self.service, '_upgrade_backup', wraps=self.service._upgrade_backup) as backup:
            self.service._settle_legacy()
        for rule in legacy_repairs.RULES:
            self.assertEqual(self.receipt(rule.key), {'changed': 0})
        backup.assert_not_called()

    def test_failing_rule_is_retried_next_start_while_others_finish(self):
        rule = legacy_repairs.RULES[0]
        broken = legacy_repairs.Rule(rule.key, rule.item, lambda connection: [{}], Mock(side_effect=RuntimeError('boom')))
        with patch.object(legacy_repairs, 'RULES', (broken, *legacy_repairs.RULES[1:])):
            self.service.prepare()
        self.assertIsNone(self.receipt(rule.key))
        self.assertIsNotNone(self.receipt(legacy_repairs.RULES[1].key))
        self.service.prepare()
        self.assertEqual(self.receipt(rule.key), {'changed': 0})


class ConfirmedRepairTests(LedgerCase):
    """要解除关联、删实体或合并记录的那几类：页面列出还剩几处，用户确认后备份账本再改，每次记一行历史。"""

    def center(self):
        with self.database.read_connection() as connection:
            pending = legacy_repairs.confirm_pending(connection, self.contract)
            return {item['id']: item for item in repair_center.snapshot(
                connection, {}, cloud_pending=0, confirm_pending=pending)['items']}

    def performer_link(self, asset_id, entity_id, source='javinizer:javdb:performer'):
        self.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source,confidence,metadata_json,"
                     "first_seen_at,last_seen_at) VALUES(?,?,'performer',?,1.0,'{}',?,?)",
                     (asset_id, entity_id, source, STAMP, STAMP))

    def test_unverified_javdb_cast_on_fc2_titles_goes_back_to_review_after_confirmation(self):
        guess = self.entity('performer', 'RINA')
        known = self.entity('performer', '三上悠亜')
        self.execute("INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id)"
                     " VALUES(?,'minnano-av','actress','1')", (known,))
        self.asset(1, code='FC2-PPV-1111111')
        self.asset(2, code='SSIS-001')
        for asset_id, entity_id in ((1, guess), (1, known), (2, guess)):
            self.performer_link(asset_id, entity_id)
        self.execute("INSERT INTO asset_tag(asset_id,tag,source) VALUES(1,'performer:RINA','javinizer:javdb:performer')")
        self.execute("INSERT INTO review_decision(category,item_key,status,note,updated_at) VALUES"
                     "('metadata_fields','asset:1:performers','approved',?,?)",
                     (json.dumps({'value': 'RINA、三上悠亜', 'auto_applied': True}, ensure_ascii=False), STAMP))

        self.service.prepare()
        item = self.center()['unconfirmed-fc2-cast']
        self.assertEqual((item['mode'], item['state'], item['pending'], item['backed_up']), ('confirm', 'waiting', 1, True))
        self.assertEqual(self.rows('SELECT count(*) FROM asset_entity'), [(3,)])

        result = self.service.apply_confirmed('unconfirmed-fc2-cast')

        self.assertEqual(self.rows('SELECT asset_id,entity_id FROM asset_entity ORDER BY asset_id,entity_id'),
                         [(1, known), (2, guess)])
        self.assertEqual(self.rows('SELECT count(*) FROM asset_tag'), [(0,)])
        self.assertEqual(self.rows('SELECT count(*) FROM review_decision'), [(0,)])
        self.assertEqual(result['changed'], 1)
        self.assertTrue(Path(result['backup']).is_file())
        item = self.center()['unconfirmed-fc2-cast']
        self.assertEqual((item['state'], item['changed']), ('done', 1))
        self.assertEqual(self.service.apply_confirmed('unconfirmed-fc2-cast'), {'changed': 0})

    def test_descriptive_performer_is_removed_unless_someone_curated_it(self):
        scraped = self.entity('performer', '美女6名')
        curated = self.entity('performer', '145cm色白お嬢様')
        self.asset(1, code='FC2-PPV-1')
        self.performer_link(1, scraped)
        self.performer_link(1, curated, source='user:manual')
        avatars = self.root / 'avatars'
        avatars.mkdir()
        (avatars / f'performer-{scraped}.jpg').write_bytes(b'x')
        self.contract.avatar_root = avatars

        result = self.service.apply_confirmed('descriptive-performers')

        self.assertEqual(self.rows("SELECT id FROM entity WHERE kind='performer'"), [(curated,)])
        self.assertEqual(result['people'][0]['disposed']['action'], 'removed')
        self.assertTrue((self.root / 'avatars-superseded' / f'performer-{scraped}.jpg').is_file())

    def test_code_folder_creators_use_the_existing_cleanup(self):
        creator = self.entity('creator', 'ABP-123')
        row = {'entity_id': creator, 'creator': 'ABP-123', 'verdict': 'release-code', 'identity': 'ABP-123'}
        with patch('peach.code_creators.collect', return_value=[row, {**row, 'verdict': 'unclear'}]), \
                patch('peach.code_creators.apply_rows', return_value={'links': 1}) as apply_rows:
            self.assertEqual(self.center()['code-folder-creators']['pending'], 1)
            result = self.service.apply_confirmed('code-folder-creators')
        apply_rows.assert_called_once()
        self.assertEqual([row['verdict'] for row in apply_rows.call_args.args[1]], ['release-code'])
        self.assertEqual(result['counts'], {'links': 1})

    def test_rows_differing_only_in_case_merge_into_the_one_with_records(self):
        for asset_id, path in ((1, r'B:\media\ABC-001.mp4'), (2, r'B:\media\abc-001.MP4'), (3, r'B:\media\other.mp4')):
            self.execute("INSERT INTO asset(id,location,path,name,medium,size) VALUES(?,'115',?,?,'video',100)",
                         (asset_id, path, path.rsplit('\\', 1)[1]))
        self.execute("INSERT INTO asset_preference(profile_id,asset_id,liked,reason,updated_at)"
                     " VALUES('local-default',2,1,'',?)", (STAMP,))

        result = self.service.apply_confirmed('case-duplicates')

        self.assertEqual(self.rows('SELECT id FROM asset ORDER BY id'), [(2,), (3,)])
        self.assertEqual(self.rows('SELECT asset_id,liked FROM asset_preference'), [(2, 1)])
        self.assertEqual([(row['from'], row['to']) for row in result['moved']], [(1, 2)])
        self.assertEqual(self.rows('SELECT source,old_asset_id FROM record_rehome'),
                         [(legacy_repairs.CASE_DUPLICATE_SOURCE, 1)])

    def test_r18_english_entity_merges_into_its_japanese_twin_listed_by_the_upgrade_review(self):
        english = self.entity('performer', 'NOZOMI')
        japanese = self.entity('performer', '希のぞみ')
        renamed = self.entity('performer', 'AOI')
        self.execute("UPDATE entity SET metadata_json=? WHERE id=?",
                     (json.dumps({'name_preference': {'source': 'user:manual'}}), renamed))
        self.asset(1)
        self.performer_link(1, english)
        review = self.root / 'state' / 'upgrade-repairs' / 'catalog-review.json'
        review.parent.mkdir(parents=True)
        review.write_text(json.dumps({'names': [
            {'entity_id': english, 'conflict_entity_id': japanese, 'action': 'merge-needed'},
            {'entity_id': renamed, 'conflict_entity_id': japanese, 'action': 'merge-needed'},
            {'entity_id': japanese, 'action': 'rename'}]}), encoding='utf-8')

        self.assertEqual(self.center()['r18-merges']['pending'], 1)
        result = self.service.apply_confirmed('r18-merges')

        self.assertEqual(self.rows("SELECT id FROM entity WHERE kind='performer' ORDER BY id"), [(japanese,), (renamed,)])
        self.assertEqual(self.rows('SELECT entity_id FROM asset_entity'), [(japanese,)])
        self.assertIn(('NOZOMI',), self.rows('SELECT alias FROM entity_alias WHERE entity_id=?', (japanese,)))
        self.assertEqual(result['merged'][0]['source_id'], english)

    def test_unknown_repair_is_refused(self):
        from peach.user_messages import UserValueError
        with self.assertRaises(UserValueError):
            self.service.apply_confirmed('nope')

    def test_pending_counts_are_reused_while_the_ledger_is_unchanged(self):
        self.addCleanup(legacy_repairs._PENDING.clear)
        rule = legacy_repairs.CONFIRMS[0]
        counted = Mock(return_value=[{}])
        with patch.object(legacy_repairs, 'CONFIRMS', (legacy_repairs.Confirm(rule.item, rule.prefix, counted, rule.fix),)), \
                self.database.read_connection() as connection:
            first = legacy_repairs.confirm_pending(connection, revision=('ledger', 7))
            again = legacy_repairs.confirm_pending(connection, revision=('ledger', 7))
            changed = legacy_repairs.confirm_pending(connection, revision=('ledger', 8))
            unknown = legacy_repairs.confirm_pending(connection, revision=('ledger', None))
        self.assertEqual((first, again, changed, unknown), ({rule.item: 1},) * 4)
        self.assertEqual(counted.call_count, 3)


if __name__ == '__main__':
    unittest.main()
