"""升级补修以临时账本验证归属、原子标记、重试及无写入端边界。"""
import json
from pathlib import Path, PureWindowsPath
import subprocess
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from peach import (display_dimensions_repair, entry_links, interface_text_upgrade, legacy_repairs, quality_repair,
                   r18_legacy_repair, upgrade_repairs, upgrade_rules)
from peach.entities import upsert_asset_entity
from peach.repository import LedgerDatabase
from peach.task_runs import TaskRunStore
from peach.task_outcomes import parts
from support.ledger import fresh_ledger
from support.outcomes import told

#: 0.51.0 之前采集桥按 GBK 输出、按 UTF-8 宽松读回的人物名（#478）。
BAD = chr(0xFFFD)
GARBLED = BAD * 2 + 'ľ' + BAD * 2
#: 路径写法不对时状态表那一行记下的原因：code 加参数，按界面语言渲染。
BAD_PATH = {'code': 'errors.upgradeRepairs.malformedPath', 'params': {'path': 'bad'}}


class UpgradeRepairTests(unittest.TestCase):
    def test_auto_repair_speed_survives_dispatch_batches_without_changing_other_tasks(self):
        from peach import task_control
        from peach.followups import Followup

        def dispatch(asset_id):
            key = f'upgrade-library:processing-v2:{asset_id}'
            planned = [Followup(key, upgrade_repairs.MEDIA_TASK, '补修')]
            return self.service._dispatch(planned, {})[0]['run_id']

        first = dispatch(1)
        queued = dispatch(4)
        self.assertEqual(task_control.projection(self.store, self.store.get(first))['speed_mode'], 'standard')
        task_control.request(self.store, first, 'set_speed', mode='high')
        self.assertEqual(task_control.projection(self.store, self.store.get(queued))['speed_mode'], 'high')
        self.store.finish(first, 'succeeded')

        # 新派发批次拥有新的父任务；重新构造服务也不能丢掉用户的选择。
        self.service = upgrade_repairs.UpgradeRepairs(self.contract, available=True)
        second = dispatch(2)
        self.assertEqual(task_control.projection(self.store, self.store.get(second))['speed_mode'], 'high')
        ordinary = self.store.start('scan', trigger='manual')
        self.assertEqual(task_control.projection(self.store, ordinary)['speed_mode'], 'standard')
        task_control.request(self.store, second, 'set_speed', mode='low')
        self.assertEqual(task_control.projection(self.store, self.store.get(queued))['speed_mode'], 'low')
        self.store.finish(second, 'succeeded')
        third = dispatch(3)
        self.assertEqual(task_control.projection(self.store, self.store.get(third))['speed_mode'], 'low')

    def display_key(self, asset_id=1):
        from peach.display_dimensions_repair import task_key
        with self.database.read_connection() as connection:
            return task_key(connection.execute('SELECT * FROM asset WHERE id=?', (asset_id,)).fetchone())

    def display_items(self):
        """显示尺寸补测在状态表里的行，键是影片 id 字符串。"""
        from peach.display_dimensions_repair import ITEM_RULE
        with self.database.read_connection() as connection:
            return {str(row['asset_id']): {**dict(row), 'result': json.loads(row['result_json'])}
                    for row in connection.execute('SELECT * FROM ledger_upgrade_item WHERE rule=?', (ITEM_RULE,))}

    def display_targets(self):
        """要补测的片子与补测前的尺寸（旧版回执的 `dimensions`）。"""
        return {asset_id: row['result']['before'] for asset_id, row in self.display_items().items()}

    def add_display_targets(self, ids, size=(720, 1280)):
        """把这几部片加进显示尺寸补测（旧版回执往 `dimensions` 里加一项）。"""
        with self.database.write_transaction() as connection:
            rows = self.service._display_targets(connection, {str(key): list(size) for key in ids})
            upgrade_repairs.upsert_items(connection, rows, mode='seed')

    def display_completed(self):
        """补测完成的结果（旧版回执的 `completed`）。"""
        return {asset_id: {key: value for key, value in row['result'].items() if key != 'before'}
                for asset_id, row in self.display_items().items() if row['state'] == 'done'}

    def seed_receipt(self, receipt):
        encoded = json.dumps(receipt)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE ledger_upgrade_repair SET result_json=? WHERE id=?',
                               (encoded, upgrade_repairs.REVISION))
        self.service.receipt.write_text(encoded, encoding='utf-8')

    def display_sample(self, *, width=720, height=1280):
        from peach import artifact_rules
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        self.service.config = self.contract.upgrade_config
        self.asset(1, code='SSIS-123', duration=60)
        sheet = self.contract.snapshot_root / '1.jpg'
        sheet.parent.mkdir(parents=True)
        sheet.write_bytes(b'old grid')
        artifact_rules.remember(sheet)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET width=?,height=?,ctx_orient=?,snapshot_path=?,rating=5 WHERE id=1',
                               (width, height, 'portrait', str(sheet)))
        self.service.prepare()
        return sheet

    def test_cloud_videos_wait_for_the_user_before_their_display_size_is_measured(self):
        """网盘里的旧视频不在升级时补测；用户在「修复与迁移」里确认才加进来，之后不再等确认。"""
        from peach import media_probe, repair_center
        with self.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO asset(id,location,path,name,medium,code,field_owners,duration,width,height) "
                "VALUES(2,'115','2.mp4','ABC-002.mp4','video','ABC-002','{}',60,720,1280)")
        self.display_sample()
        self.assertEqual(self.display_targets(), {'1': [720, 1280]})
        self.assertEqual(self.service.cloud_display_videos(), 1)

        def cloud_item():
            with self.database.read_connection() as connection:
                center = repair_center.snapshot(connection, upgrade_repairs._read(self.service.receipt),
                                                cloud_pending=self.service.cloud_display_videos())
            return next(item for item in center['items'] if item['id'] == 'display-cloud')

        self.assertEqual((cloud_item()['mode'], cloud_item()['state'], cloud_item()['pending']), ('confirm', 'waiting', 1))
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch.object(upgrade_repairs, '_stale_previews', return_value=False), \
                patch.object(media_probe, 'probe_file') as probe:
            self.service.include_cloud_display_dimensions()
        probe.assert_not_called()
        self.assertEqual(sorted(self.display_targets()), ['1', '2'])
        self.assertEqual(self.service.cloud_display_videos(), 0)
        self.assertEqual((cloud_item()['state'], cloud_item()['pending']), ('running', 0))

    def test_cloud_pending_count_is_reused_until_the_library_or_the_list_changes(self):
        """「修复与迁移」每次打开、补测在跑时每 2 秒都问网盘待补测几部：两张表不变就不再全扫一遍。"""
        from peach.web_state import WebContract
        with self.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO asset(id,location,path,name,medium,code,field_owners,duration,width,height) "
                "VALUES(2,'115','2.mp4','ABC-002.mp4','video','ABC-002','{}',60,720,1280)")
        self.display_sample()
        web = WebContract(self.db, database=self.database)
        self.contract.cached_until_changed = web.cached_until_changed
        with patch.object(display_dimensions_repair, 'collect', wraps=display_dimensions_repair.collect) as collect:
            self.assertEqual(self.service.cloud_display_videos(), 1)
            self.assertEqual(self.service.cloud_display_videos(), 1)
            self.assertEqual(collect.call_count, 1)
            with self.database.write_transaction() as connection:
                connection.execute(
                    "INSERT INTO asset(id,location,path,name,medium,code,field_owners,duration,width,height) "
                    "VALUES(3,'115','3.mp4','ABC-003.mp4','video','ABC-003','{}',60,720,1280)")
            self.assertEqual(self.service.cloud_display_videos(), 2)
            self.assertEqual(collect.call_count, 2)

    def test_display_size_progress_is_split_between_local_and_cloud_items(self):
        """网盘补测确认后并进同一份名单；两项各自只数自己来源的片子，页面才画得出各自的进度条。"""
        from peach import repair_center
        with self.database.write_transaction() as connection:
            connection.executemany(
                "INSERT INTO asset(id,location,path,name,medium,code,field_owners,duration,width,height) "
                "VALUES(?,?,?,?,'video',?,'{}',60,720,1280)",
                [(1, 'local', '1.mp4', '1.mp4', 'A-1'), (2, 'local', '2.mp4', '2.mp4', 'A-2'),
                 (3, '115', '3.mp4', '3.mp4', 'A-3'), (4, '115', '4.mp4', '4.mp4', 'A-4'),
                 (5, '115', '5.mp4', '5.mp4', 'A-5')])
            connection.executemany(
                "INSERT INTO ledger_upgrade_item(rule,asset_id,state,updated_at) VALUES(?,?,?,'now')",
                [(display_dimensions_repair.ITEM_RULE, key, 'done' if key in (1, 3) else 'queued')
                 for key in (1, 2, 3, 4, 5, 9)])
        receipt = {'display_dimensions_v2': {'cloud_included_at': 1.0}}
        with self.database.read_connection() as connection:
            items = {item['id']: item for item in repair_center.snapshot(connection, receipt, cloud_pending=0)['items']}
        # 资产 9 已删除，按本地算。
        self.assertEqual({key: (items[key]['state'], items[key]['done'], items[key]['total'])
                          for key in ('display-local', 'display-cloud')},
                         {'display-local': ('running', 1, 3), 'display-cloud': ('running', 1, 3)})
        # 早期版本把网盘片直接排进了名单、没有确认记录：没确认就是没开始，不报进度，
        # 名单里还没测的 2 部和名单外的 2 部一起算待补测。
        receipt['display_dimensions_v2'].pop('cloud_included_at')
        with self.database.read_connection() as connection:
            cloud = next(item for item in repair_center.snapshot(connection, receipt, cloud_pending=2)['items']
                         if item['id'] == 'display-cloud')
        self.assertEqual((cloud['state'], cloud['pending'], 'total' in cloud), ('waiting', 4, False))

    def test_display_size_item_says_what_unfinished_films_are_waiting_for(self):
        """没做完的只剩延后就报延后并按原因分开数，只剩等重试的失败就报失败；还有在排或退避中的才算进行中。"""
        from peach import repair_center
        rule = display_dimensions_repair.ITEM_RULE

        def local(rows):
            with self.database.write_transaction() as connection:
                connection.execute('DELETE FROM ledger_upgrade_item')
                connection.executemany(
                    "INSERT INTO ledger_upgrade_item(rule,asset_id,state,retry_at,result_json,updated_at) "
                    "VALUES(?,?,?,?,?,'now')",
                    [(rule, key, state, retry, json.dumps(result)) for key, (state, retry, result) in enumerate(rows, 1)])
            with self.database.read_connection() as connection:
                items = repair_center.snapshot(connection, {}, cloud_pending=0)['items']
            item = next(item for item in items if item['id'] == 'display-local')
            return {key: item.get(key) for key in ('state', 'done', 'total', 'deferred', 'failed')}

        mount, cooling, legacy = ({'deferred': 'mount'}, {'deferred': 'cooldown'}, {})
        self.assertEqual(local([('done', None, {}), ('deferred', 9, mount), ('deferred', 9, mount),
                                ('deferred', 9, cooling), ('deferred', 9, legacy)]),
                         {'state': 'deferred', 'done': 1, 'total': 5, 'deferred': {'mount': 2, 'cooldown': 1, '': 1},
                          'failed': None})
        self.assertEqual(local([('deferred', 9, mount), ('queued', None, {})])['state'], 'running')
        # 延后到期重派出去、还没回话的照旧算延后，整盘掉线时页面不在两种状态间来回跳。
        self.assertEqual(local([('deferred', 9, mount), ('queued', None, mount)]),
                         {'state': 'deferred', 'done': 0, 'total': 2, 'deferred': {'mount': 2}, 'failed': None})
        # 退避中的失败到时间自己重派，算进行中；连败到上限、只等用户点重试的才单列。
        self.assertEqual(local([('deferred', 9, mount), ('failed', 9, {})])['state'], 'running')
        self.assertEqual(local([('done', None, {}), ('failed', None, {})]),
                         {'state': 'failed', 'done': 1, 'total': 2, 'deferred': None, 'failed': 1})

    def test_repair_history_shows_each_run_and_whether_its_backup_is_still_kept(self):
        """历史与「账本备份」联动：修复前的备份还在就能去恢复，按保留规则清退了照实写。"""
        from peach import repair_center
        kept = self.root / 'ledger.pre-sar-1.db'
        kept.write_bytes(b'')
        with self.database.write_transaction() as connection:
            connection.execute('DELETE FROM ledger_upgrade_repair')
            connection.executemany('INSERT INTO ledger_upgrade_repair(id,result_json,applied_at) VALUES(?,?,?)', [
                ('catalog-v4:x', json.dumps({'local': {'changed': {'codes': 2, 'probe_retry': 9,
                                                                    'text_snapshots_invalidated': 40},
                                                       'backup': str(self.root / 'ledger.pre-upgrade-1.db')},
                                             'display_dimensions_v2': {'backup': str(kept)}}), '200'),
                ('stale-filename-codes-1', json.dumps({'cleared': [1, 2, 3]}), '100'),
                ('stale-filename-codes-0', json.dumps({'cleared': []}), '50'),
            ])
        with self.database.read_connection() as connection:
            history = repair_center.snapshot(connection, {}, cloud_pending=0,
                                             backup_directories=[self.root])['history']
        self.assertEqual([(row['title'], row['changed']) for row in history],
                         [('资料与番号整理', 2), ('清除误认的番号', 3)])
        self.assertEqual(sorted((row['name'], row['exists']) for row in history[0]['backups']),
                         [('ledger.pre-sar-1.db', True), ('ledger.pre-upgrade-1.db', False)])
        self.assertEqual(history[1]['backups'], [])

    def test_repair_page_lists_only_what_touched_this_library(self):
        """没有网盘视频、NAS 系统目录与乱码人物的馆藏，这几项不出现；只改了资料的那项才列。"""
        from peach import repair_center
        with self.database.write_transaction() as connection:
            connection.execute('DELETE FROM ledger_upgrade_repair')
            connection.execute('INSERT INTO ledger_upgrade_repair(id,result_json,applied_at) VALUES(?,?,?)',
                               ('garbled-people-1', json.dumps({'garbled_people': {'links': []}}), '10'))
        receipt = {'local': {'state': 'done', 'changed': {'codes': 2}}}
        with self.database.read_connection() as connection:
            items = repair_center.snapshot(connection, receipt, cloud_pending=0)['items']
            self.assertEqual([item['id'] for item in items], ['catalog'])
            waiting = repair_center.snapshot(connection, {}, cloud_pending=3)['items']
        self.assertEqual([(item['id'], item['state']) for item in waiting], [('display-cloud', 'waiting')])

    def test_upgrade_schedules_measured_videos_once_without_reading_media_during_planning(self):
        from peach import media_probe
        sheet = self.display_sample()
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(self.display_targets(), {'1': [720, 1280]})
        self.assertTrue(Path(receipt['display_dimensions_v2']['backup']).is_file())
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch.object(upgrade_repairs, '_stale_previews', return_value=False), \
                patch.object(media_probe, 'probe_file') as probe:
            self.service.tick()
        probe.assert_not_called()
        self.assertEqual(list(upgrade_repairs._read(self.service.receipt)['queued']),
                         [self.display_key()])
        self.assertEqual(sheet.read_bytes(), b'old grid')
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT duration,width,height,rating FROM asset').fetchone()),
                             (60, 720, 1280, 5))

    def test_existing_display_receipt_is_preserved_and_new_rule_reopens_completed_dispatch(self):
        self.display_sample()
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt['display_dimensions'] = {'rule': upgrade_rules.DISPLAY_DIMENSIONS,
                                         'dimensions': {'1': [720, 1280]}, 'backup': 'retained.db'}
        receipt.pop('display_dimensions_v2')
        receipt['dispatch_complete'] = True
        self.seed_receipt(receipt)
        self.service.prepare()
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch.object(upgrade_repairs, '_stale_previews', return_value=False):
            self.service.tick()
        after = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(after['display_dimensions'], receipt['display_dimensions'])
        self.assertEqual(list(after['queued']), [self.display_key()])
        self.assertFalse(after['dispatch_complete'])

    def test_a_due_film_the_planner_skips_does_not_reopen_planning_every_tick(self):
        """到期的补测碰上同片被取消的影片补全：规划器整片跳过，派发判断也不再每分钟重开一轮空规划。"""
        self.display_sample()
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE ledger_upgrade_item SET state='deferred',retry_at=1 WHERE rule=?",
                               (display_dimensions_repair.ITEM_RULE,))
            upgrade_repairs.upsert_items(connection, [{'rule': 'media:processing-v2', 'asset_id': 1,
                                                       'state': 'cancelled'}], mode='settle')
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt.update(dispatch_complete=True, queued={})
        self.service._save_receipt(receipt)
        with patch.object(self.service, '_plan', wraps=self.service._plan) as plan:
            for _ in range(2):
                self.tick_quietly()
        plan.assert_not_called()
        self.assertTrue(upgrade_repairs._read(self.service.receipt)['dispatch_complete'])
        # 取消的那行不在了，这部片就真会被派出去：照常重开规划。
        with self.database.write_transaction() as connection:
            connection.execute("DELETE FROM ledger_upgrade_item WHERE rule='media:processing-v2'")
        self.assertEqual(list(self.tick_quietly()['queued']), [self.display_key()])

    def test_old_receipts_without_asset_generation_are_preserved_and_probed_once_under_the_new_rule(self):
        self.display_sample()
        for key in (2, 3):
            self.asset(key, duration=60)
            with self.database.write_transaction() as connection:
                connection.execute('UPDATE asset SET width=720,height=1280 WHERE id=?', (key,))
        parent = self.store.start('old-display', trigger='manual')
        keys = [f'upgrade-library:display-dimensions-1:{key}' for key in (1, 2, 3)]
        ids = self.store.enqueue_followups(parent.id, [(key, upgrade_repairs.MEDIA_TASK, '显示尺寸') for key in keys])['queued']
        self.store.finish(ids[0], 'succeeded', summary={'outcome': '显示尺寸重探完成', 'dimensions_changed': True})
        self.store.finish(ids[1], 'succeeded', summary={'outcome': 'skipped'})
        self.store.finish(ids[2], 'failed', error='未取得')
        self.store.finish(parent.id, 'succeeded')
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt.pop('display_dimensions_v2')
        receipt['queued'] = dict(zip(keys, ids))
        receipt['display_dimensions'] = {'rule': upgrade_rules.DISPLAY_DIMENSIONS, 'backup': 'old.db'}
        self.seed_receipt(receipt)
        self.service.prepare()
        after = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(self.display_completed(), {})
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch.object(upgrade_repairs, '_stale_previews', return_value=False):
            planned = self.service._plan(after)
        self.assertEqual([row.key for row in planned],
                         [self.display_key(key) for key in (1, 2, 3)])

    def run_display_probe(self, measured, *, checkpoint=None):
        from peach import display_dimensions_repair
        with patch('peach.library_processing._ffprobe_path', return_value='ffprobe'), \
                patch('peach.media_probe.measure', return_value=measured) as probe:
            result = display_dimensions_repair.reprobe(self.contract, self.service.config, 1,
                                                       checkpoint=checkpoint or Mock())
        return result, probe

    def test_changed_dimensions_preserve_media_and_records_and_invalidate_only_owned_previews(self):
        from peach import artifact_rules, timeline_sheets
        sheet = self.display_sample()
        timeline = self.root / 'timeline'
        self.contract.timeline_root = timeline
        meta = timeline_sheets.meta_path(timeline, 1)
        meta.parent.mkdir(parents=True)
        meta.write_text(json.dumps({'frames': 6, 'interval': 10, 'sheets': 1}), encoding='utf-8')
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET has_audio=1,vcodec='old',fps=24 WHERE id=1")
        measured = (61, 1440, 1280, 'new', 30, None, 'quick', 'landscape', '1080P', 1)
        result, _ = self.run_display_probe(measured)
        self.assertTrue(result['changed'])
        self.assertEqual(sheet.read_bytes(), b'old grid')
        self.assertFalse(artifact_rules.current(sheet))
        self.assertEqual(json.loads(meta.read_text())['invalidated_by'], upgrade_rules.DISPLAY_DIMENSIONS_SAR)
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute(
                'SELECT duration,width,height,ctx_orient,rating,has_audio,vcodec,fps FROM asset').fetchone()),
                (60, 1440, 1280, 'landscape', 5, 1, 'old', 24))
            row = connection.execute('SELECT * FROM asset').fetchone()
        self.assertFalse(upgrade_repairs._stale_previews(self.contract, row))
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]):
            self.assertEqual(self.service._plan(upgrade_repairs._read(self.service.receipt)), [])

    def test_successful_measurement_is_not_repeated_after_restart_or_task_settlement_failure(self):
        from peach import artifact_rules
        sheet = self.display_sample()
        measured = (60, 720, 1280, 'h264', 25, None, 'quick', 'portrait', '720P', 1)
        first, _ = self.run_display_probe(measured)
        self.service.prepare()
        second, probe = self.run_display_probe(measured)
        self.assertEqual(second, first)
        probe.assert_not_called()
        self.assertFalse(first['changed'])
        self.assertTrue(artifact_rules.current(sheet))

    def test_real_anamorphic_media_repairs_legacy_dimensions_without_rewriting_the_source(self):
        from peach import display_dimensions_repair
        from peach.ffmpeg import FFmpegResolver
        from support.conditions import missing_prerequisite
        self.display_sample(width=320, height=180)
        resolver = FFmpegResolver(self.root / 'tools')
        ffmpeg, ffprobe = resolver.ffmpeg(), resolver.ffprobe()
        if ffmpeg is None or ffprobe is None:
            missing_prerequisite('SAR 旧测量补修需要 FFmpeg 与 ffprobe')
        source = self.root / 'anamorphic.mp4'
        subprocess.run([str(ffmpeg.path), '-y', '-v', 'error', '-f', 'lavfi', '-i',
                        'color=c=green:s=320x180:r=5:d=1', '-vf', 'setsar=2',
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(source)],
                       capture_output=True, check=True, timeout=20)
        original = source.read_bytes()
        with patch('peach.library_processing._ffprobe_path', return_value=str(ffprobe.path)), \
                patch('peach.media_probe.resolve_case_insensitive', return_value=str(source)):
            result = display_dimensions_repair.reprobe(self.contract, self.service.config, 1, checkpoint=Mock())
        self.assertEqual(result['dimensions'], [640, 180])
        self.assertEqual(source.read_bytes(), original)
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT duration,width,height,rating FROM asset').fetchone()),
                             (60, 640, 180, 5))

    def test_failed_measurement_and_capacity_denial_preserve_old_measurements_for_retry(self):
        from peach import artifact_rules
        from peach.jobs import DiskSpaceDenied
        sheet = self.display_sample()
        with self.assertRaisesRegex(ValueError, '未取得'):
            self.run_display_probe((-1, 0, 0, None, 0, 0, None, None, None, 1))
        with self.assertRaises(DiskSpaceDenied):
            self.run_display_probe((60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1),
                                   checkpoint=Mock(side_effect=[None, DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'})]))
        self.assertEqual(self.display_completed(), {})
        self.assertTrue(artifact_rules.current(sheet))
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT width,height FROM asset').fetchone()), (720, 1280))
        result, _ = self.run_display_probe((60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1))
        self.assertTrue(result['changed'])

    def test_display_planner_defers_metered_sources_and_uses_the_existing_batch_limit(self):
        self.display_sample()
        for key in range(2, 72):
            self.asset(key, duration=60)
        self.add_display_targets(range(2, 72))
        receipt = upgrade_repairs._read(self.service.receipt)
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch('peach.media_sources.cost_for', side_effect=lambda _location, path, _config:
                      'metered' if PureWindowsPath(path).name == '1.mp4' else 'free'):
            planned = self.service._plan(receipt)
        self.assertEqual(len(planned), 64)
        self.assertTrue(all(':display-dimensions-2:' in row.key for row in planned))
        self.assertEqual(receipt['deferred'], [1])

    def legacy_receipt(self):
        """0.57 之前的回执：逐片补测字典整份记在回执里，结束了的任务键一直留在队列里。"""
        from peach.display_dimensions_repair import generation
        self.display_sample()
        for key in (2, 3, 4):
            self.asset(key, duration=60)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET width=720,height=1280 WHERE id IN (2,3,4)')
            connection.execute('DELETE FROM ledger_upgrade_item')
            generations = {str(row['id']): generation(row) for row in connection.execute('SELECT * FROM asset')}
        parent = self.store.start('old-upgrade', trigger='manual')
        keys = ['upgrade-library:processing-v2:2', 'upgrade-library:processing-v2:3', self.display_key(1)]
        ids = self.store.enqueue_followups(parent.id, [(key, upgrade_repairs.MEDIA_TASK, '旧') for key in keys])['queued']
        for run_id, status in zip(ids, ('succeeded', 'failed', 'failed')):
            self.store.finish(run_id, status)
        self.store.finish(parent.id, 'succeeded')
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt['display_dimensions_v2'] = {
            'rule': upgrade_rules.DISPLAY_DIMENSIONS_SAR, 'backup': 'old.db',
            'dimensions': {'1': [720, 1280], '2': [720, 1280]},
            'generations': {'1': generations['1'], '2': generations['2']},
            'completed': {'2': {'changed': False, 'dimensions': [720, 1280], 'generation': generations['2']}}}
        # 第四条的任务行早已被清退：清退只删成功与取消的后继。
        receipt['queued'] = {**dict(zip(keys, ids)), 'upgrade-library:processing-v2:4': 99999}
        receipt['media_ids'] = [2, 3, 4]
        self.seed_receipt(receipt)
        return receipt

    def items(self):
        with self.database.read_connection() as connection:
            return {(row['rule'], row['asset_id']): (row['state'], row['retry_at']) for row in connection.execute(
                'SELECT rule,asset_id,state,retry_at FROM ledger_upgrade_item')}

    def test_legacy_receipt_moves_into_the_item_table_once_and_its_queue_is_settled(self):
        """升级后旧回执自动修好：逐片字典搬进状态表、回执去掉；结束了的队列项结算后不再重派。"""
        from peach.display_dimensions_repair import ITEM_RULE
        self.legacy_receipt()
        self.service.prepare()
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(sorted(receipt['display_dimensions_v2']), ['backup', 'rule'])
        self.assertEqual(self.display_targets(), {'1': [720, 1280], '2': [720, 1280]})
        self.assertEqual(list(self.display_completed()), ['2'])
        moved = self.display_items()
        self.service.prepare()
        self.assertEqual(self.display_items(), moved)
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch.object(upgrade_repairs, '_stale_previews', return_value=False), \
                patch('peach.media_sources.cost_for', return_value='free'):
            self.service.tick()
            self.service.tick()
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['queued'], {})
        self.assertTrue(receipt['dispatch_complete'])
        self.assertEqual(self.items(), {
            (ITEM_RULE, 1): ('failed', None), (ITEM_RULE, 2): ('done', None),
            ('media:processing-v2', 2): ('done', None), ('media:processing-v2', 3): ('failed', None),
            ('media:processing-v2', 4): ('done', None)})
        background = self.service.snapshot()['items'][1]
        self.assertEqual((background['state'], background['failed']), ('failed', 2))

    def test_legacy_failures_wait_for_the_user_and_explicit_retry_dispatches_them_again(self):
        """旧版留下的失败结算后不自动重派；用户点重试才重新派出。"""
        self.legacy_receipt()
        self.service.prepare()
        patches = (patch('peach.library_processing._people_allowed', return_value=False),
                   patch('peach.seed_followup.plan', return_value=[]),
                   patch.object(upgrade_repairs, '_stale_previews', return_value=False),
                   patch('peach.media_sources.cost_for', return_value='free'))
        for active in patches:
            active.start()
            self.addCleanup(active.stop)
        for _ in range(3):
            self.service.tick()
        self.assertEqual(upgrade_repairs._read(self.service.receipt)['queued'], {})
        self.service.retry()
        self.assertEqual(sorted(upgrade_repairs._read(self.service.receipt)['queued']),
                         sorted([self.display_key(1), 'upgrade-library:processing-v2:3']))

    def test_committed_measurement_survives_an_older_receipt_being_saved_again(self):
        """完成结果只写状态表里这部片那一行；调度拿着补测前读到的回执再保存，也盖不掉它。"""
        self.display_sample()
        stale = upgrade_repairs._read(self.service.receipt)
        with patch('peach.upgrade_repairs.atomic_write_text') as written:
            self.run_display_probe((60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1))
        written.assert_not_called()
        self.service._save_receipt(stale)
        self.assertEqual(self.display_completed()['1']['dimensions'], [1440, 1280])
        _, probe = self.run_display_probe((60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1))
        probe.assert_not_called()

    def test_display_handler_only_probes_and_pauses_before_committing_when_capacity_is_exhausted(self):
        from peach.jobs import DiskSpaceDenied
        from peach import task_control
        self.display_sample()
        self.contract.upgrade_repairs = self.service
        parent = self.store.start('sar-batch', trigger='manual')
        child = self.store.enqueue_followups(parent.id, [
            (self.display_key(), upgrade_repairs.MEDIA_TASK, '补测')])['queued'][0]
        with patch('peach.storage_budget.CapacityGuard.check', side_effect=[None, DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'})]), \
                patch('peach.library_processing._ffprobe_path', return_value='ffprobe'), \
                patch('peach.media_probe.measure', return_value=(60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1)), \
                patch('peach.library_processing.process_library') as process, \
                self.assertRaises(DiskSpaceDenied):
            upgrade_repairs._media_run(self.contract, self.display_key(), Mock())
        process.assert_not_called()
        self.assertEqual(task_control.requested(self.db, child), 'pause')
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT width,height FROM asset').fetchone()), (720, 1280))

    def test_display_failure_is_recorded_independently_and_explicit_retry_keeps_successful_items(self):
        from peach.followups import FollowupRunner
        self.display_sample()
        self.asset(2, duration=60)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET width=720,height=1280 WHERE id=2')
        self.add_display_targets([2])
        self.contract.upgrade_repairs = self.service
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch('peach.storage_budget.CapacityGuard.check'), \
                patch('peach.library_processing._ffprobe_path', return_value='ffprobe'), \
                patch('peach.media_probe.measure', side_effect=[
                    (-1, 0, 0, None, 0, 0, None, None, None, 1),
                    (60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 2)]) as probe, \
                patch('peach.library_processing.process_library') as process:
            self.service.tick()
            queued = dict(upgrade_repairs._read(self.service.receipt)['queued'])
            with self.assertLogs('peach.followups', level='WARNING'):
                self.assertEqual(FollowupRunner(self.contract).drain(), 2)
            self.assertEqual([self.store.get(run_id).status for run_id in queued.values()], ['failed', 'succeeded'])
            self.service.retry()
        self.assertEqual(probe.call_count, 2)
        process.assert_not_called()
        after = upgrade_repairs._read(self.service.receipt)
        self.assertIn('2', self.display_completed())
        self.assertNotIn('1', self.display_completed())
        new = after['queued'][self.display_key()]
        self.assertNotEqual(new, queued[self.display_key()])
        self.assertEqual(self.store.get(new).status, 'pending')

    def test_cancel_after_probe_stops_measurement_and_leaves_success_checkpoint_empty(self):
        from peach import task_control
        from peach.followups import FollowupRunner
        self.display_sample()
        self.contract.upgrade_repairs = self.service
        parent = self.store.start('sar-cancel', trigger='manual')
        child = self.store.enqueue_followups(parent.id, [
            (self.display_key(), upgrade_repairs.MEDIA_TASK, '补测')])['queued'][0]
        self.store.finish(parent.id, 'succeeded')
        def measured(*_args):
            task_control.request(self.store, child, 'cancel')
            return (60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1)
        with patch('peach.library_processing._ffprobe_path', return_value='ffprobe'), \
                patch('peach.media_probe.measure', side_effect=measured):
            self.assertEqual(FollowupRunner(self.contract).drain(), 1)
        self.assertEqual(self.store.get(child).status, 'cancelled')
        self.assertEqual(self.display_completed(), {})
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT width,height FROM asset').fetchone()), (720, 1280))

    def test_display_dispatch_refills_only_the_free_slots_in_the_existing_batch(self):
        self.display_sample()
        for key in range(2, 67):
            self.asset(key, duration=60)
        self.add_display_targets(range(2, 67))
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]):
            self.service.tick()
            receipt = upgrade_repairs._read(self.service.receipt)
            first = next(iter(receipt['queued'].values()))
            self.store.finish(first, 'succeeded')
            self.service.tick()
        receipt = upgrade_repairs._read(self.service.receipt)
        # 跑完的那条结算进状态表、移出回执队列，空出的一格补上一部新的。
        self.assertEqual(len(receipt['queued']), 64)
        self.assertNotIn(first, receipt['queued'].values())
        self.assertEqual(self.service._media_backlog(), 64)
        self.assertEqual(sum(row['state'] == 'done' for row in self.display_items().values()), 1)

    def remove_sar_preparation(self):
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt.pop('display_dimensions_v2')
        self.seed_receipt(receipt)

    def test_first_sar_backup_capacity_denial_keeps_other_ledger_services_available(self):
        from peach import api
        from peach.jobs import DiskSpaceDenied
        self.display_sample()
        self.remove_sar_preparation()
        self.contract.upgrade_repairs = self.service
        independent = Mock()
        with patch('peach.storage_budget.CapacityGuard.check', side_effect=DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '备份投影超限'})), \
                patch.object(upgrade_repairs, 'sqlite_backup') as backup, \
                patch.object(api, '_restore_task_center'), patch('peach.web_job_recovery.restore'), \
                self.assertNoLogs('peach', level='ERROR'):
            self.assertTrue(api._start_ledger_services(SimpleNamespace(db_path=self.db), self.contract, [independent]))
        independent.start.assert_called_once()
        backup.assert_not_called()
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertNotIn('display_dimensions_v2', receipt)
        self.assertIn('备份投影超限', receipt['media_paused']['message'])
        with patch('peach.storage_budget.CapacityGuard.check') as check:
            self.service.prepare()
        check.assert_not_called()
        with patch('peach.storage_budget.CapacityGuard.check', side_effect=DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '备份投影超限'})), \
                self.assertRaises(DiskSpaceDenied):
            self.service.retry()

    def test_backup_reserves_sqlite_pages_and_rechecks_remaining_bytes_without_publishing_partial_files(self):
        from peach.jobs import DiskSpaceDenied
        self.display_sample()
        self.remove_sar_preparation()
        before = set(self.db.parent.glob('ledger.pre-sar-*.db'))
        with self.database.read_connection() as connection:
            page_size = connection.execute('PRAGMA page_size').fetchone()[0]
            pages = connection.execute('PRAGMA page_count').fetchone()[0]
        def copying(_source, destination, *, pages, progress):
            self.assertEqual(pages, 256)
            Path(destination).write_bytes(b'partial backup')
            progress(0, 17, 18)
        with patch('peach.storage_budget.CapacityGuard.check', side_effect=[None, DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '剩余备份超限'})]) as check, \
                patch.object(upgrade_repairs, 'sqlite_backup', side_effect=copying):
            self.service.prepare()
        self.assertEqual([call.kwargs['required_bytes'] for call in check.call_args_list],
                         [pages * page_size, 17 * page_size])
        self.assertTrue(all(call.kwargs['destination'] == self.db.parent for call in check.call_args_list))
        self.assertEqual(set(self.db.parent.glob('ledger.pre-sar-*.db')), before)
        self.assertEqual(list(self.db.parent.glob('.ledger.pre-sar-*.tmp.db')), [])
        self.assertNotIn('display_dimensions_v2', upgrade_repairs._read(self.service.receipt))

    def test_changed_asset_generation_reopens_dispatch_and_old_task_does_not_read_the_new_file(self):
        from peach import media_probe
        self.display_sample()
        old_key = self.display_key()
        self.run_display_probe((60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1))
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt.update(dispatch_complete=True, queued={old_key: 999})
        self.service._save_receipt(receipt)
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET path='R:\\media\\replacement.mp4',size=200,mtime='2026-11-07' WHERE id=1")
        new_key = self.display_key()
        self.assertNotEqual(new_key, old_key)
        with patch.object(media_probe, 'measure') as probe:
            result = upgrade_repairs._media_run(self.contract, old_key, Mock())
        self.assertEqual(told(result)['outcome'], 'skipped')
        probe.assert_not_called()
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]):
            self.service.tick()
        after = upgrade_repairs._read(self.service.receipt)
        self.assertIn(new_key, after['queued'])
        self.assertNotIn('1', self.display_completed())

    def test_same_path_replacement_during_probe_cannot_commit_a_measurement_for_the_previous_file(self):
        self.display_sample()
        def replacement(*_args):
            with self.database.write_transaction() as connection:
                connection.execute("UPDATE asset SET size=200,mtime='2026-11-07' WHERE id=1")
            return (60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1)
        from peach import display_dimensions_repair
        with patch('peach.library_processing._ffprobe_path', return_value='ffprobe'), \
                patch('peach.media_probe.measure', side_effect=replacement), self.assertRaisesRegex(ValueError, '已变化'):
            display_dimensions_repair.reprobe(self.contract, self.service.config, 1, checkpoint=Mock())
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT width,height FROM asset').fetchone()), (720, 1280))
        self.assertEqual(self.display_completed(), {})

    def test_stale_file_receipt_preserves_only_the_successful_measurement_for_the_current_generation(self):
        self.display_sample()
        self.run_display_probe((60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1))
        stale = upgrade_repairs._read(self.service.receipt)
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET size=200,mtime='2026-11-07' WHERE id=1")
        self.run_display_probe((60, 1920, 1280, None, 0, 0, None, 'landscape', '2K', 1))
        self.service._save_receipt(stale)
        self.assertEqual(self.display_completed()['1']['dimensions'], [1920, 1280])
        _, probe = self.run_display_probe((60, 1920, 1280, None, 0, 0, None, 'landscape', '2K', 1))
        probe.assert_not_called()

    def run_queued_display(self, measured=(60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1), *, unreachable=False):
        """派出显示尺寸补测再在当前线程跑完，返回这一轮的任务行。`unreachable` 给异常就由挂载判断抛出。"""
        from peach.followups import FollowupRunner
        self.contract.upgrade_repairs = self.service
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch.object(upgrade_repairs, '_stale_previews', return_value=False):
            self.service.tick()
        run_id = upgrade_repairs._read(self.service.receipt)['queued'][self.display_key()]
        with patch('peach.library_processing._ffprobe_path', return_value='ffprobe'), \
                patch.object(upgrade_repairs, 'mount_unreachable',
                             **({'side_effect': unreachable} if isinstance(unreachable, Exception)
                                else {'return_value': unreachable})), \
                patch('peach.media_probe.measure', return_value=measured):
            FollowupRunner(self.contract).drain()
        return self.store.get(run_id)

    def tick_quietly(self):
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch.object(upgrade_repairs, '_stale_previews', return_value=False):
            self.service.tick()
        return upgrade_repairs._read(self.service.receipt)

    def make_due(self):
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE ledger_upgrade_item SET retry_at=1 WHERE retry_at IS NOT NULL')

    def test_unreachable_mount_defers_the_measurement_instead_of_failing_it(self):
        """挂载掉线时补测延后、不读媒体、不算失败；到时间自己重派。"""
        self.display_sample()
        run = self.run_queued_display(unreachable=True)
        self.assertEqual(run.status, 'succeeded')
        self.assertIn('已延后', told(run.result_summary)['outcome'])
        row = self.display_items()['1']
        self.assertEqual((row['state'], row['attempts']), ('deferred', 0))
        self.assertGreater(row['retry_at'], time.time() + 60)
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT width,height FROM asset').fetchone()), (720, 1280))
        self.assertEqual(self.tick_quietly()['queued'], {})
        self.assertEqual(self.service.snapshot()['items'][1]['deferred'], 1)
        self.assertEqual(self.service.snapshot()['state'], 'deferred')
        # 原因记在这一行上，「修复与迁移」照它写明在等什么，全部延后时不报进行中。
        self.assertEqual(row['result']['deferred'], 'mount')
        self.assertEqual(self.repair_item('display-local'),
                         {**self.repair_item('display-local'), 'state': 'deferred', 'deferred': {'mount': 1}})
        self.make_due()
        self.assertEqual(list(self.tick_quietly()['queued']), [self.display_key()])
        self.assertEqual(self.run_queued_display().status, 'succeeded')
        row = self.display_items()['1']
        self.assertEqual(row['state'], 'done')
        self.assertNotIn('deferred', row['result'])
        self.assertEqual(self.repair_item('display-local')['state'], 'done')

    def repair_item(self, item_id):
        from peach import repair_center
        with self.database.read_connection() as connection:
            center = repair_center.snapshot(connection, upgrade_repairs._read(self.service.receipt), cloud_pending=0)
        return next(item for item in center['items'] if item['id'] == item_id)

    def test_dispatch_sleeps_until_the_next_retry_and_wakes_when_its_followups_finish(self):
        """不再每分钟醒来全表扫：没活时排到最早的 `retry_at`，派出的后继跑完由回调叫醒。"""
        from types import SimpleNamespace
        from peach.followups import FollowupRunner
        self.display_sample()
        self.run_queued_display(unreachable=True)
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch.object(upgrade_repairs, '_stale_previews', return_value=False):
            delay = self.service.tick()
            retry = self.display_items()['1']['retry_at']
            self.assertAlmostEqual(delay, retry - time.time(), delta=5)
            self.assertGreater(delay, upgrade_repairs.ACTIVE_GAP_SECONDS)
            self.make_due()
            self.assertIsNone(self.service.tick(), '派出去了就等它跑完，没有要定时的重派')
        run_id = upgrade_repairs._read(self.service.receipt)['queued'][self.display_key()]
        self.service._wake.clear()
        self.service._followup_finished(SimpleNamespace(id=run_id + 1000))
        self.assertFalse(self.service._wake.is_set(), '别人派的后继跑完不叫醒')
        runner = FollowupRunner(self.contract)
        runner.on_finished(self.service._followup_finished)
        self.contract.upgrade_repairs = self.service
        with patch('peach.library_processing._ffprobe_path', return_value='ffprobe'), \
                patch.object(upgrade_repairs, 'mount_unreachable', return_value=False), \
                patch('peach.media_probe.measure', return_value=(60, 1440, 1280, None, 0, 0, None, 'landscape', '1080P', 1)):
            runner.drain()
        self.assertTrue(self.service._wake.is_set(), '自己派的补测跑完就叫醒派发线程')

    def test_a_malformed_path_is_not_mistaken_for_an_offline_mount(self):
        self.mount_status.stop()
        """路径写法本身不对不是挂载掉线：抛 `MalformedPath`；本机没挂载的来源照旧算读不到。"""
        import os
        from peach.platform import UNMAPPED_ROOT
        malformed = ['R:' + chr(92) + 'media' + chr(0) + '.mp4']
        if os.name == 'nt':
            malformed.append('R:' + chr(92) + 'me<dia' + chr(92) + 'a.mp4')
        for text in malformed:
            with self.subTest(text=text), self.assertRaises(upgrade_repairs.MalformedPath):
                upgrade_repairs.mount_unreachable(text)
        with patch('peach.platform.translate_ledger_path', side_effect=ValueError('SMB 地址或端口无效')), \
                self.assertRaises(upgrade_repairs.MalformedPath):
            upgrade_repairs.mount_unreachable('smb://bad')
        with patch('peach.platform.translate_ledger_path', return_value=UNMAPPED_ROOT / 'R' / 'a.mp4'):
            self.assertTrue(upgrade_repairs.mount_unreachable('R:' + chr(92) + 'a.mp4'))
        self.assertFalse(upgrade_repairs.mount_unreachable(str(self.root / 'a.mp4')))

    def test_a_malformed_path_fails_the_measurement_with_its_reason_instead_of_deferring_forever(self):
        """路径翻译不了的片子按失败结算、写明原因，不排自动重派，出现在失败计数里；用户点重试才再派。"""
        self.display_sample()
        broken = upgrade_repairs.MalformedPath('errors.upgradeRepairs.malformedPath', {'path': 'bad'})
        with self.assertLogs('peach.followups', level='WARNING'):
            run = self.run_queued_display(unreachable=broken)
        self.assertEqual(run.status, 'failed')
        row = self.display_items()['1']
        self.assertEqual((row['state'], row['retry_at'], row['result']['error']),
                         ('failed', None, BAD_PATH))
        self.make_due()
        self.assertEqual(self.tick_quietly()['queued'], {})
        self.assertEqual(self.display_items()['1']['state'], 'failed')
        self.assertEqual(self.service.snapshot()['items'][1]['failed'], 1)
        self.assertEqual(self.repair_item('display-local')['failed'], 1)

    def test_a_malformed_path_in_a_batch_fails_only_that_film(self):
        """一批里路径写法不对的那部按失败结算并写明原因，不拖累同批其他片子，也不让整批重跑。"""
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        for key in (1, 2):
            self.asset(key, duration=10)

        def unreachable(path):
            if PureWindowsPath(path).name == "2.mp4":
                raise upgrade_repairs.MalformedPath('errors.upgradeRepairs.malformedPath', {'path': 'bad'})
            return False
        with patch('peach.library_processing.process_library', return_value={'status': 'complete'}) as process, \
                patch.object(upgrade_repairs, 'mount_unreachable', side_effect=unreachable):
            result = upgrade_repairs._media_run(self.contract, 'upgrade-library:batch:processing-v2:1,2',
                                                Mock(run_id=None))
        self.assertEqual(process.call_args.kwargs['asset_ids'], [1])
        self.assertEqual((result['done'], result['failed']), (1, 1))
        with self.database.read_connection() as connection:
            rows = {row['asset_id']: (row['state'], row['retry_at'], json.loads(row['result_json']).get('error'))
                    for row in connection.execute("SELECT * FROM ledger_upgrade_item WHERE rule='media:processing-v2'")}
        self.assertEqual(rows, {1: ('done', None, None), 2: ('failed', None, BAD_PATH)})

    def test_new_failures_are_dispatched_again_with_backoff_until_the_attempt_limit(self):
        """本版派出的失败按退避自动重派；连败到上限后只等用户点重试。"""
        self.display_sample()
        for attempt in range(1, upgrade_repairs.MAX_AUTO_RETRIES + 2):
            with self.assertLogs('peach.followups', level='WARNING'):
                run = self.run_queued_display((-1, 0, 0, None, 0, 0, None, None, None, 1))
            self.assertEqual(run.status, 'failed')
            self.assertEqual(self.tick_quietly()['queued'], {})
            row = self.display_items()['1']
            self.assertEqual((row['state'], row['attempts']), ('failed', attempt))
            if attempt > upgrade_repairs.MAX_AUTO_RETRIES:
                self.assertIsNone(row['retry_at'])
                break
            self.assertAlmostEqual(row['retry_at'] - time.time(),
                                   min(upgrade_repairs.RETRY_BASE_SECONDS * 2 ** (attempt - 1),
                                       upgrade_repairs.RETRY_CAP_SECONDS), delta=30)
            self.make_due()
        self.make_due()
        self.assertEqual(self.tick_quietly()['queued'], {})
        self.assertEqual(self.service.snapshot()['items'][1]['failed'], 1)

    def test_source_cooldown_defers_the_processing_repair(self):
        """资料来源冷却时这部片延后到来源放开，不按失败结算。"""
        self.asset(1, duration=60)
        self.service.prepare()
        self.contract.upgrade_repairs = self.service
        key = 'upgrade-library:processing-v2:1'
        cooled = {'status': 'failed', 'outcome': 'partial', 'issue_count': 1, 'paused_count': 1,
                  'paused_asset_ids': [1], 'retryable_asset_ids': [1]}
        with patch('peach.library_processing.process_library', return_value=cooled):
            result = upgrade_repairs._media_run(self.contract, key, Mock(run_id=None))
        self.assertIn('来源', told(result)['outcome'])
        with self.database.read_connection() as connection:
            row = connection.execute("SELECT state,retry_at,result_json FROM ledger_upgrade_item "
                                     "WHERE rule='media:processing-v2'").fetchone()
        self.assertEqual(row['state'], 'deferred')
        self.assertEqual(json.loads(row['result_json'])['deferred'], 'cooldown')
        self.assertGreater(row['retry_at'], time.time() + 600)

    def test_capacity_denial_returns_the_run_to_the_queue_until_explicit_retry(self):
        """容量触线这一条挂回队列、整批暂停，不按失败结算；用户重试后接着跑。"""
        from peach import task_control
        from peach.jobs import DiskSpaceDenied
        from peach.followups import FollowupRunner
        self.display_sample()
        self.contract.upgrade_repairs = self.service
        self.tick_quietly()
        run_id = upgrade_repairs._read(self.service.receipt)['queued'][self.display_key()]
        with patch('peach.storage_budget.CapacityGuard.check', side_effect=DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'})), \
                patch('peach.library_processing._ffprobe_path', return_value='ffprobe'), \
                patch('peach.media_probe.measure') as probe:
            FollowupRunner(self.contract).drain()
        probe.assert_not_called()
        self.assertEqual(self.store.get(run_id).status, 'pending')
        self.assertEqual(task_control.requested(self.db, run_id), 'pause')
        self.assertIsNone(self.store.claim_followup([upgrade_repairs.MEDIA_TASK]))
        with patch.object(self.service, 'tick'):
            self.service.retry()
        self.assertEqual(task_control.requested(self.db, run_id), 'resume')
        self.assertEqual(self.store.claim_followup([upgrade_repairs.MEDIA_TASK]).id, run_id)

    def test_queued_display_reprobe_skips_without_media_reads_or_measurement_changes(self):
        from peach import artifact_rules, media_probe
        sheet = self.display_sample()
        with patch.object(media_probe, 'probe_file') as probe, \
                patch('peach.library_processing.process_library') as process:
            result = upgrade_repairs._media_run(self.contract, 'upgrade-library:display-dimensions-1:1', Mock())
        self.assertEqual(told(result)['outcome'], 'skipped')
        probe.assert_not_called()
        process.assert_not_called()
        self.assertTrue(artifact_rules.current(sheet))
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT duration,width,height,ctx_orient,rating FROM asset').fetchone()),
                             (60, 720, 1280, 'portrait', 5))

    def disk_batch(self):
        from peach import task_control
        self.display_sample()
        self.contract.upgrade_repairs = self.service
        parent = self.store.start('disk-batch', trigger='manual')
        ids = self.store.enqueue_followups(parent.id, [
            (f'upgrade-library:processing-v2:{key}', upgrade_repairs.MEDIA_TASK, '处理')
            for key in (1, 2)])['queued']
        # 用户原本暂停的项不由磁盘重试解除。
        task_control.request(self.store, ids[1], 'pause')
        return ids

    def test_disk_denial_pauses_batch_and_stays_paused_after_space_returns_and_restart(self):
        from peach import task_control
        from peach.jobs import DiskSpaceDenied
        ids = self.disk_batch()
        with patch('peach.storage_budget.CapacityGuard.check', side_effect=DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'})), \
                patch('peach.library_processing.process_library') as process, \
                self.assertRaises(DiskSpaceDenied):
            upgrade_repairs._media_run(self.contract, 'upgrade-library:processing-v2:1', Mock())
        process.assert_not_called()
        self.assertEqual(task_control.requested(self.db, ids[0]), 'pause')
        paused = upgrade_repairs._read(self.service.receipt)['media_paused']
        self.assertEqual(paused['run_ids'], [ids[0]])
        restarted = upgrade_repairs.UpgradeRepairs(self.contract, available=True, config=self.service.config)
        restarted.prepare()
        self.contract.upgrade_repairs = restarted
        with patch('peach.storage_budget.CapacityGuard.check'), \
                patch('peach.library_processing.process_library') as process, \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch('peach.library_processing._people_allowed', return_value=False), \
                self.assertRaises(DiskSpaceDenied):
            restarted.tick()
            upgrade_repairs._media_run(self.contract, 'upgrade-library:processing-v2:1', Mock())
        process.assert_not_called()
        self.assertEqual(upgrade_repairs._read(restarted.receipt)['media_paused'], paused)
        self.assertEqual(restarted.snapshot()['state'], 'failed')
        self.assertIn('已暂停', restarted.snapshot()['message'])
        self.assertIsNone(self.store.claim_followup([upgrade_repairs.MEDIA_TASK]))

    def test_explicit_retry_rechecks_disk_and_only_resumes_policy_paused_items(self):
        from peach import task_control
        from peach.jobs import DiskSpaceDenied
        ids = self.disk_batch()
        self.service.pause_media(DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'}))
        with patch('peach.storage_budget.CapacityGuard.check', side_effect=DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'})), self.assertRaises(DiskSpaceDenied):
            self.service.retry()
        self.assertEqual(task_control.requested(self.db, ids[0]), 'pause')
        with patch('peach.storage_budget.CapacityGuard.check'), patch.object(self.service, 'tick'):
            self.service.retry()
        self.assertNotIn('media_paused', upgrade_repairs._read(self.service.receipt))
        self.assertEqual(task_control.requested(self.db, ids[0]), 'resume')
        self.assertEqual(task_control.requested(self.db, ids[1]), 'pause')

    def test_disk_denial_during_processing_or_after_reading_pauses_the_whole_batch(self):
        from peach import task_control
        from peach.jobs import DiskSpaceDenied
        ids = self.disk_batch()
        for inside in (True, False):
            with self.subTest(inside=inside):
                with patch('peach.storage_budget.CapacityGuard.check', side_effect=[None] if inside else [None, DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'})]), \
                        patch('peach.library_processing.process_library',
                              side_effect=DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'}) if inside else None,
                              return_value={'status': 'complete'}), self.assertRaises(DiskSpaceDenied):
                    upgrade_repairs._media_run(self.contract, 'upgrade-library:processing-v2:1', Mock())
                self.assertEqual(task_control.requested(self.db, ids[0]), 'pause')
                with patch('peach.storage_budget.CapacityGuard.check'), patch.object(self.service, 'tick'):
                    self.service.retry()

    def test_explicit_retry_preserves_a_later_manual_parent_pause(self):
        from peach import task_control
        from peach.jobs import DiskSpaceDenied
        ids = self.disk_batch()
        self.service.pause_media(DiskSpaceDenied('errors.storageBudget.intakeStopped', {'reasons': '空间不足'}))
        parent_id = self.store.get(ids[0]).parent_run_id
        task_control.request(self.store, parent_id, 'pause')
        manual = task_control.intent(self.db, ids[0], (parent_id,))
        with patch('peach.storage_budget.CapacityGuard.check'), patch.object(self.service, 'tick'):
            self.service.retry()
        self.assertEqual(task_control.intent(self.db, ids[0], (parent_id,)), manual)
        self.assertEqual(manual['action'], 'pause')
        self.assertIsNone(self.store.claim_followup([upgrade_repairs.MEDIA_TASK]))

    def test_old_system_metadata_is_isolated_once_without_deleting_files_or_records(self):
        from peach import system_file_repair
        file = self.root / '@eaDir/video.mp4@SynoEAStream'
        file.parent.mkdir()
        file.write_bytes(b'metadata')
        rows = [(1, str(file), None), (2, r'R:\media\@eaDir\kept@SynoEAStream', 5),
                (3, r'R:\media\normal.txt', None)]
        with self.database.write_transaction() as connection:
            for key, path, rating in rows:
                connection.execute("INSERT INTO asset(id,location,path,name,medium,rating) "
                                   "VALUES(?,'local',?,'metadata','other',?)", (key, path, rating))
            connection.execute("INSERT INTO asset_tag(asset_id,tag,source) VALUES(1,'retained','test')")
        self.service.prepare()
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual([tuple(row) for row in connection.execute('SELECT id,disposal,rating FROM asset')],
                             [(1, 'trash', None), (2, None, 5), (3, None, None)])
            self.assertEqual(connection.execute('SELECT count(*) FROM asset_tag WHERE asset_id=1').fetchone()[0], 1)
        self.assertEqual(file.read_bytes(), b'metadata')
        receipt = upgrade_repairs._read(self.service.receipt)[system_file_repair.RULE]
        self.assertEqual(receipt['isolated'], [dict(id=1, path=str(file), disposal=None,
                                                   disposal_reason=None, feedback_at=None)])
        self.assertTrue(Path(receipt['backup']).is_file())
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET disposal=NULL,disposal_reason=NULL WHERE id=1')
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertIsNone(connection.execute('SELECT disposal FROM asset WHERE id=1').fetchone()[0])
        with patch.object(upgrade_repairs, 'REVISION', upgrade_repairs.REVISION + '-next'):
            self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertIsNone(connection.execute('SELECT disposal FROM asset WHERE id=1').fetchone()[0])

    def test_webm_filed_as_other_becomes_video_once_and_is_queued_for_processing(self):
        """#551：旧版把 WebM 登记成 other；升级时改成视频并补处理，不要求用户完整重扫。"""
        from peach import repair_center
        rows = [(1, r'R:\media\clip.WeBM', None), (2, r'R:\media\notes.txt', None),
                (3, r'R:\media\gone.webm', 'trash'), (4, r'R:\media\._clip.webm', None)]
        with self.database.write_transaction() as connection:
            for key, path, disposal in rows:
                connection.execute("INSERT INTO asset(id,location,path,name,medium,rating,disposal) "
                                   "VALUES(?,'local',?,?,'other',5,?)", (key, path, PureWindowsPath(path).name, disposal))
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual([tuple(row) for row in connection.execute('SELECT id,medium,rating FROM asset ORDER BY id')],
                             [(1, 'video', 5), (2, 'other', 5), (3, 'other', 5), (4, 'other', 5)])
            stored = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                   (upgrade_repairs.VIDEO_MEDIUM_KEY,)).fetchone()[0])
            center = repair_center.snapshot(connection, {}, cloud_pending=0)
        self.assertEqual(stored['video'], [1])
        self.assertEqual(next(item['changed'] for item in center['items'] if item['id'] == 'video-medium'), 1)
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertIn(1, receipt['media_ids'])
        self.assertFalse(receipt['dispatch_complete'])
        # 回执在就不再重做：撤回后的 other 保持原样。
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET medium='other' WHERE id=1")
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT medium FROM asset WHERE id=1').fetchone()[0], 'other')

    def test_sidecars_registered_as_works_leave_the_ledger_once_and_can_be_put_back(self):
        """0.35 之前登记成作品的 NFO、海报、剧照与截图：只删账本行，受保护的留着，回执能原样插回。"""
        from peach import repair_center, sidecar_asset_repair
        rows = [  # (id, 路径, 媒介, 处置, 评分, 反馈)
            (1, r'R:\media\ABC-001\ABC-001.mp4', 'video', None, None, None),
            (2, r'R:\media\ABC-001\ABC-001.nfo', 'other', None, None, None),
            (3, r'R:\media\ABC-001\poster.jpg', 'image', None, None, None),
            (4, r'R:\media\ABC-001\extrafanart\fanart1.jpg', 'image', None, None, None),
            (5, r'R:\media\gallery\cover.jpg', 'image', None, None, None),       # 图集自己的封面
            (6, r'R:\media\ABC-001\ABC-001-fanart.jpg', 'image', None, 4, None),  # 带个人记录
            (7, r'R:\media\ABC-001\ABC-001-thumb.jpg', 'image', None, None, 'like'),
            (8, r'R:\media\shots\clip_4x4_thumb.jpg', 'image', None, None, None),
            (9, r'R:\media\ABC-001\old.nfo', 'other', 'trash', None, None),
            (10, r'R:\media\ABC-001\folder.jpg', 'image', None, None, None),     # 垃圾复核判为不是垃圾
        ]
        with self.database.write_transaction() as connection:
            for key, path, medium, disposal, rating, feedback in rows:
                connection.execute('INSERT INTO asset(id,location,path,name,medium,disposal,rating,feedback) '
                                   "VALUES(?,'local',?,?,?,?,?,?)",
                                   (key, path, PureWindowsPath(path).name, medium, disposal, rating, feedback))
            connection.execute("INSERT INTO asset_tag(asset_id,tag,source) VALUES(3,'海报','scan')")
            connection.execute("INSERT INTO review_decision(category,item_key,status,updated_at) "
                               "VALUES('junk_file','10','rejected','now')")
        self.service.prepare()
        with self.database.read_connection() as connection:
            left = [row[0] for row in connection.execute('SELECT id FROM asset ORDER BY id')]
            stored = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                   (upgrade_repairs.SIDECAR_ASSETS_KEY,)).fetchone()[0])
            center = repair_center.snapshot(connection, {}, cloud_pending=0)
        self.assertEqual(left, [1, 5, 6, 7, 9, 10])
        self.assertEqual(sorted(record['asset']['id'] for record in stored['removed']), [2, 3, 4, 8])
        self.assertTrue(Path(stored['backup']).is_file())
        self.assertEqual(next(item['changed'] for item in center['items'] if item['id'] == 'sidecar-assets'), 4)
        self.assertIn('sidecar-assets', [row['rule'] for row in center['history']])
        # 回执在就不再重做；按回执插回的行与引用和原来一样。
        with self.database.write_transaction() as connection:
            self.assertEqual(sidecar_asset_repair.restore(connection, stored['removed']), 4)
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(len(connection.execute('SELECT id FROM asset').fetchall()), 10)
            self.assertEqual(connection.execute('SELECT tag,source FROM asset_tag WHERE asset_id=3').fetchone()[:],
                             ('海报', 'scan'))
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_prior_restore_uses_windows_path_identity_without_exempting_other_paths(self):
        from peach import system_file_repair
        with self.database.write_transaction() as connection:
            for key in (1, 2):
                connection.execute("INSERT INTO asset(id,location,path,name,medium) "
                                   "VALUES(?,'local',?,'metadata','other')",
                                   (key, fr'R:\media\@eaDir\old{key}@SynoEAStream'))
        with patch.object(system_file_repair, 'RULE', system_file_repair.PRIOR_RULES[-1]):
            self.service.prepare()
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET disposal=NULL,disposal_reason=NULL,path=? WHERE id=1",
                               ('r:/MEDIA/@EADIR/OLD1@SYNOEASTREAM',))
            connection.execute("UPDATE asset SET disposal=NULL,disposal_reason=NULL,path=? WHERE id=2",
                               (r'R:\media\@eaDir\different@SynoEAStream',))
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual([tuple(row) for row in connection.execute('SELECT id,disposal FROM asset ORDER BY id')],
                             [(1, None), (2, 'trash')])
        receipt = upgrade_repairs._read(self.service.receipt)[system_file_repair.RULE]
        self.assertEqual([row['id'] for row in receipt['isolated']], [2])

    def test_expanded_system_rules_preserve_prior_restores_and_personal_records(self):
        from peach import system_file_repair
        with self.database.write_transaction() as connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium) "
                               "VALUES(1,'local',?,'old metadata','other')",
                               (r'R:\media\@eaDir\old@SynoEAStream',))
        with patch.object(system_file_repair, 'RULE', system_file_repair.PRIOR_RULES[-1]):
            self.service.prepare()
        previous = upgrade_repairs._read(self.service.receipt)[system_file_repair.PRIOR_RULES[-1]]
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET disposal=NULL,disposal_reason=NULL WHERE id=1')
            for key, name, medium, rating, code, feedback, plays in (
                    (2, '.DS_Store', 'other', None, None, None, 0),
                    (3, 'Thumbs.db', 'other', 5, None, None, 0),
                    (4, '._movie.mp4', 'video', None, None, None, 0),
                    (5, '.localized', 'other', None, 'EXM-123', None, 0),
                    (6, '.SYNOPPSDB1', 'other', None, None, 'like', 0),
                    (7, 'desktop.ini', 'other', None, None, None, 3),
                    (8, '.wfm_upload1', 'other', None, None, None, 0)):
                connection.execute(
                    'INSERT INTO asset(id,location,path,name,medium,rating,code,feedback,play_count) '
                    "VALUES(?,'local',?,?,?,?,?,?,?)",
                    (key, str(PureWindowsPath(r'R:\media', name)), name, medium, rating, code, feedback, plays))
            connection.execute("INSERT INTO review_decision(category,item_key,status,note,updated_at) "
                               "VALUES('junk_file','8','rejected','','2026-11-06')")
        self.service.prepare()
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt[system_file_repair.PRIOR_RULES[-1]], previous)
        self.assertEqual([row['id'] for row in receipt[system_file_repair.RULE]['isolated']], [2, 4, 5])
        with self.database.read_connection() as connection:
            self.assertEqual([tuple(row) for row in connection.execute('SELECT id,disposal FROM asset ORDER BY id')],
                             [(1, None), (2, 'trash'), (3, None), (4, 'trash'), (5, 'trash'),
                              (6, None), (7, None), (8, None)])

    def test_scraped_appledouble_videos_are_isolated_but_videos_in_system_directories_stay(self):
        from peach import system_file_repair
        with self.database.write_transaction() as connection:
            for key, path, code in ((1, r'R:\media\SSIS-950.mp4', 'SSIS-950'),
                                    (2, r'R:\media\._SSIS-950.mp4', 'SSIS-950'),
                                    (3, r'R:\media\@eaDir\clip.mp4', None)):
                connection.execute("INSERT INTO asset(id,location,path,name,medium,code) "
                                   "VALUES(?,'local',?,?,'video',?)", (key, path, PureWindowsPath(path).name, code))
            connection.execute("INSERT INTO asset_tag(asset_id,tag,source) VALUES(2,'scraped','test')")
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual([tuple(row) for row in connection.execute('SELECT id,disposal FROM asset ORDER BY id')],
                             [(1, None), (2, 'trash'), (3, None)])
            self.assertEqual(connection.execute('SELECT count(*) FROM asset_tag WHERE asset_id=2').fetchone()[0], 1)
        receipt = upgrade_repairs._read(self.service.receipt)[system_file_repair.RULE]
        self.assertEqual([row['id'] for row in receipt['isolated']], [2])

    def test_javdb_upgrade_requeues_legacy_evidence_and_keeps_manual_values(self):
        from peach import artifact_rules, upgrade_rules
        self.asset(1, code='EXM-001', duration=1)
        self.asset(2, code='EXM-002', duration=1)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET catalog_title=?,field_owners=? WHERE id=1',
                               ('人工题名', json.dumps({'catalog_title':'user:manual'})))
        with patch.object(upgrade_repairs, 'REVISION', f'{upgrade_repairs.CATALOG_REVISION}:text-2'):
            self.service.prepare()
            previous=upgrade_repairs._read(self.service.receipt)
            previous.update(queued={'previous-task':99}, deferred=[42], dispatch_complete=True)
            self.service._save_receipt(previous)
        directory=self.root/'sources/library-metadata'
        directory.mkdir(parents=True,exist_ok=True)
        legacy=directory/'EXM-001-javdb.json'
        current=directory/'EXM-002-javdb.json'
        other=directory/'EXM-001-dmm.json'
        payloads=((legacy,{'id':'EXM-001','title':'来源显示题名'}),
                  (current,{'id':'EXM-002','title':'Original title * Limited','javdb_rule':2,
                            'source_id':'CurrentMovie'}),
                  (other,{'id':'EXM-001','title':'其他来源题名'}))
        for path,payload in payloads:
            path.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
            artifact_rules.remember(path,str(upgrade_rules.PROVIDER_EVIDENCE))
        original={path:path.read_bytes() for path,_ in payloads}
        self.service.prepare()
        self.assertFalse(artifact_rules.current(legacy,str(upgrade_rules.PROVIDER_EVIDENCE)))
        self.assertTrue(artifact_rules.current(current,str(upgrade_rules.PROVIDER_EVIDENCE)))
        self.assertTrue(artifact_rules.current(other,str(upgrade_rules.PROVIDER_EVIDENCE)))
        for path,content in original.items():
            self.assertEqual(path.read_bytes(),content)
        receipt=upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['text_media_ids'],[1])
        self.assertEqual(receipt['queued'],{'previous-task':99})
        self.assertEqual(receipt['deferred'],[42])
        self.assertFalse(receipt['dispatch_complete'])
        self.assertEqual(receipt['local']['changed']['text_snapshots_invalidated'],1)
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT catalog_title FROM asset WHERE id=1').fetchone()[0],
                             '人工题名')
        self.service.prepare()
        self.assertEqual(len(list(self.root.glob('ledger.pre-upgrade-*.db'))), 1)

    def test_legacy_javdb_title_is_excluded_from_machine_text_repair(self):
        from peach import metadata_text_repair
        self.damaged_asset(owner='auto:javdb')
        directory=self.root/'sources/library-metadata'
        directory.mkdir(parents=True,exist_ok=True)
        (directory/'EXM-001-javdb.json').write_text(
            json.dumps({'id':'EXM-001','title':'旧绑定显示题名'}),encoding='utf-8')
        with self.database.read_connection() as connection:
            plan=metadata_text_repair.collect(connection,directory)
        row=next(row for row in plan['rows'] if row['field']=='title')
        self.assertEqual(row['group']['candidates'],[])
        self.assertEqual(row['action'],'review')

    def test_current_javdb_original_is_accepted_for_empty_machine_text(self):
        from peach import metadata_auto_apply, metadata_text_repair
        self.asset(1,code='EXM-001',duration=1)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET name=? WHERE id=1',('EXM-001.mp4',))
        directory=self.root/'sources/library-metadata'
        directory.mkdir(parents=True,exist_ok=True)
        (directory/'EXM-001-javdb.json').write_text(json.dumps({
            'id':'EXM-001','title':'元の題名','origin_title':'元の題名',
            'javdb_rule':2,'source_id':'AbC123','source_url':'https://javdb.com/v/AbC123'}),encoding='utf-8')
        with self.database.read_connection() as connection:
            candidate=metadata_auto_apply.metadata_auto_apply_candidate(connection,{
                'asset_id':1,'code':'EXM-001','field':'title','current_value':'',
                'candidates':metadata_text_repair._candidates(directory,'EXM-001','title')})
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate['value'],'元の題名')
        self.assertEqual(candidate['source_id'],'AbC123')

    def test_encoding_upgrade_invalidates_damaged_snapshots_after_a_text_one_receipt(self):
        from peach import artifact_rules, upgrade_rules
        self.asset(1, code='EXM-001', duration=1)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET catalog_title=?,field_owners=? WHERE id=1',
                               ('人工题名', json.dumps({'catalog_title': 'user:manual'})))
        with patch.object(upgrade_repairs, 'REVISION', f'{upgrade_repairs.CATALOG_REVISION}:text-1'):
            self.service.prepare()
            receipt = upgrade_repairs._read(self.service.receipt)
            receipt.update(queued={'old-work': 99}, deferred=[42], dispatch_complete=True)
            self.service._save_receipt(receipt)
        directory = self.root / 'sources/library-metadata'
        directory.mkdir(parents=True, exist_ok=True)
        bad, good = directory / 'EXM-001-makers.json', directory / 'EXM-001-dmm.json'
        for path, title in ((bad, '壊\ufffdれた題名'), (good, '元の題名')):
            path.write_text(json.dumps({'id': 'EXM-001', 'title': title}), encoding='utf-8')
            artifact_rules.remember(path, str(upgrade_rules.PROVIDER_EVIDENCE))
        original = bad.read_bytes()
        self.service.prepare()
        self.assertFalse(artifact_rules.current(bad, str(upgrade_rules.PROVIDER_EVIDENCE)))
        self.assertTrue(artifact_rules.current(good, str(upgrade_rules.PROVIDER_EVIDENCE)))
        self.assertEqual(bad.read_bytes(), original)
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['text_media_ids'], [1])
        self.assertEqual(receipt['local']['changed']['text_snapshots_invalidated'], 1)
        self.assertEqual(receipt['queued'], {'old-work': 99})
        self.assertEqual(receipt['deferred'], [42])
        self.assertFalse(receipt['dispatch_complete'])
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT catalog_title FROM asset WHERE id=1').fetchone()[0],
                             '人工题名')
        self.service.prepare()
        self.assertEqual(len(list(self.root.glob('ledger.pre-upgrade-*.db'))), 1)

    def damaged_asset(self, key=1, *, owner='auto:makers'):
        self.asset(key, code='EXM-001', duration=1)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET name=?,catalog_title=?,field_owners=? WHERE id=?',
                ('EXM-001.mp4', '壊\ufffdれた題名', json.dumps({'code':'scan:filename',
                                                            'catalog_title':owner}), key))

    def clean_snapshot(self):
        snapshots = self.root/'sources/library-metadata'
        snapshots.mkdir(parents=True,exist_ok=True)
        (snapshots/'EXM-001-dmm.json').write_text(json.dumps({'id':'EXM-001','title':'元の題名'}),
                                                encoding='utf-8')

    def test_readable_source_repairs_machine_title_after_an_older_upgrade_receipt(self):
        self.damaged_asset()
        self.clean_snapshot()
        with patch.object(upgrade_repairs, 'REVISION', upgrade_repairs.CATALOG_REVISION), patch(
                'peach.metadata_text_repair.collect', return_value={'rows':[], 'asset_ids':[]}):
            self.service.prepare()
        with patch('peach.r18_legacy_repair.apply_rows',side_effect=AssertionError('不能重放已完成补修')):
            self.service.prepare()
        self.service.prepare()
        with self.database.read_connection() as connection:
            row=connection.execute('SELECT catalog_title,field_owners FROM asset WHERE id=1').fetchone()
            self.assertEqual(row[0], '元の題名')
            self.assertEqual(json.loads(row[1])['catalog_title'], 'auto:dmm')
            # 悬空候选、JavDB 记录类型、视频改登记、附属文件删行、番号尾字母、来源分辨率标签、画质分档与旧记录转换八条补修，以及旧版数据补修各记一行，这里只数更新已有资料的回执。
            self.assertEqual(connection.execute('SELECT count(*) FROM ledger_upgrade_repair WHERE id NOT IN (?,?,?,?,?,?,?,?) '
                                                'AND id NOT IN (SELECT value FROM json_each(?))',
                                                (upgrade_repairs.DANGLING_KEY, upgrade_repairs.SUFFIX_CODES_KEY,
                                                 upgrade_repairs.JAVDB_RECORDS_KEY,
                                                 upgrade_repairs.VIDEO_MEDIUM_KEY, upgrade_repairs.SIDECAR_ASSETS_KEY,
                                                 upgrade_repairs.RESOLUTION_TAGS_KEY, quality_repair.KEY,
                                                 interface_text_upgrade.RECEIPT_KEY,
                                                 json.dumps([rule.key for rule in legacy_repairs.RULES]))).fetchone()[0], 2)
            self.assertEqual(connection.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        self.assertEqual(len(list(self.root.glob('ledger.pre-upgrade-*.db'))), 1)
        self.assertEqual(upgrade_repairs._read(self.service.receipt)['text_media_ids'], [1])

    def garbled_title_plan(self, owner):
        from peach import metadata_text_repair
        self.damaged_asset(owner=owner)
        self.clean_snapshot()
        with self.database.read_connection() as connection:
            plan = metadata_text_repair.collect(connection, self.root / 'sources/library-metadata')
        with self.database.write_transaction() as connection:
            changed = metadata_text_repair.apply(connection, plan)
        with self.database.read_connection() as connection:
            title = connection.execute('SELECT catalog_title FROM asset WHERE id=1').fetchone()[0]
        return [row['action'] for row in plan['rows']], plan['asset_ids'], changed, title

    def test_garbled_titles_without_an_owner_are_replaced_from_a_clean_source(self):
        """#208：旧版没记归属的乱码标题也按同番号的干净来源替换。"""
        actions, asset_ids, changed, title = self.garbled_title_plan(None)
        self.assertEqual((actions, asset_ids, changed['text_fields'], title), (['replace'], [1], 1, '元の題名'))

    def test_garbled_titles_approved_in_review_are_kept_but_requeued(self):
        """#208：复核批准过的乱码不自动改，但照样排进重采，干净候选回到复核页。"""
        actions, asset_ids, changed, title = self.garbled_title_plan('review:makers')
        self.assertEqual((actions, asset_ids, changed['text_review'], title),
                         (['review'], [1], 1, '壊' + BAD + 'れた題名'))

    def test_damaged_manual_titles_are_kept_and_garbled_studios_still_count_for_review(self):
        self.damaged_asset(owner='user:manual')
        self.clean_snapshot()
        with self.database.write_transaction() as connection:
            entity=upsert_asset_entity(connection,kind='studio',name='片商'+BAD,asset_id=1,
                role='studio',source='javinizer:makers:studio',confidence=.75,now='now')
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT catalog_title FROM asset WHERE id=1').fetchone()[0],
                             '壊'+BAD+'れた題名')
            self.assertEqual(connection.execute('SELECT canonical_name FROM entity WHERE id=?', (entity,)).fetchone()[0],
                             '片商'+BAD)
        receipt=upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['local']['review_count'],1)
        self.assertEqual(receipt['text_media_ids'],[1])

    def garbled_people(self):
        """报告者的现场（#478）：乱码名挂着刮削关联，正确名的人物另有作品。"""
        for key in (1, 2, 3):
            self.asset(key, code=f'EXM-00{key}', duration=1)
        with self.database.write_transaction() as connection:
            def link(asset_id, name, source, external_id=None):
                return upsert_asset_entity(connection, kind='performer', name=name, asset_id=asset_id,
                    role='performer', source=source, confidence=.75, now='now',
                    external_provider='dmm' if external_id else None, external_id=external_id)
            garbled = link(1, GARBLED, 'javinizer:dmm:performer', '1')
            correct = link(2, '桃乃木かな', 'javinizer:dmm:performer')
            link(1, '他の女優', 'javinizer:dmm:performer')
            # 另一位乱码人物用户手动挂过一部：实体留着，只解刮削关联、摘站上编号。
            manual = link(3, BAD + '名前', 'javinizer:dmm:performer', '3')
            link(3, BAD + '名前', 'user:manual')
            connection.execute("INSERT INTO entity_alias(entity_id,alias,normalized_alias,source,confidence) "
                               "VALUES(?,?,?,'javinizer:alias',.9)", (garbled, 'ǰ' + BAD, 'ǰ' + BAD))
            connection.executemany('INSERT INTO asset_tag(asset_id,tag,confidence,source) VALUES(?,?,?,?)', [
                (1, 'performer:' + GARBLED, .75, 'javinizer:dmm:performer'),
                (1, 'performer:他の女優', .75, 'javinizer:dmm:performer'),
                (2, 'performer:桃乃木かな', .75, 'javinizer:dmm:performer'),
                (3, 'performer:' + BAD + '名前', 1, 'user:manual')])
        return {'garbled': garbled, 'correct': correct, 'manual': manual}

    def performer_links(self):
        with self.database.read_connection() as connection:
            return sorted(tuple(row) for row in connection.execute(
                "SELECT asset_id,entity_id,source FROM asset_entity WHERE role='performer'"))

    def asset_tags(self):
        with self.database.read_connection() as connection:
            return sorted(tuple(row) for row in connection.execute('SELECT asset_id,tag,source FROM asset_tag'))

    def upgrade_garbled_people_from(self, old_revision):
        from peach.metadata_text_repair import RECEIPT_KEY
        from peach.settings_file import load_config
        with patch.object(upgrade_repairs, 'REVISION', old_revision):
            self.service.prepare()
            receipt = upgrade_repairs._read(self.service.receipt)
            local = receipt['local']
            # 旧规则把乱码人物只记成复核：三条计进了 `text_review` 与 `review_count`。
            local.update(review_count=local['review_count'] + 3,
                         changed={**local['changed'], 'text_review': local['changed'].get('text_review', 0) + 3})
            receipt.update(queued={'upgrade-library:processing-v2:text-3:1': 99}, dispatch_complete=True)
            self.service._save_receipt(receipt)
        fixture = self.garbled_people()
        before = self.performer_links()
        self.service.prepare()
        after = self.performer_links()
        # 乱码人物的刮削关联解除；正确名的作品、别的女优与人手挂的关联不动。
        self.assertEqual(sorted(set(before) - set(after)),
                         [(1, fixture['garbled'], 'javinizer:dmm:performer'),
                          (3, fixture['manual'], 'javinizer:dmm:performer')])
        self.assertIn((3, fixture['manual'], 'user:manual'), after)
        self.assertIn((2, fixture['correct'], 'javinizer:dmm:performer'), after)
        self.assertEqual(self.asset_tags(), [(1, 'performer:他の女優', 'javinizer:dmm:performer'),
                                             (2, 'performer:桃乃木かな', 'javinizer:dmm:performer'),
                                             (3, 'performer:' + BAD + '名前', 'user:manual')])
        with self.database.read_connection() as connection:
            names = dict(connection.execute("SELECT id,canonical_name FROM entity WHERE kind='performer'").fetchall())
            refs = connection.execute('SELECT count(*) FROM entity_external_ref').fetchone()[0]
            aliases = connection.execute('SELECT count(*) FROM entity_alias WHERE entity_id=?',
                                         (fixture['garbled'],)).fetchone()[0]
            self.assertEqual(connection.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), [])
        # 失去全部关联的乱码实体连同别名、编号删掉；用户挂过的那位留着，只摘编号。
        self.assertNotIn(fixture['garbled'], names)
        self.assertEqual(names[fixture['manual']], BAD + '名前')
        self.assertEqual((refs, aliases), (0, 0))
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['revision'], upgrade_repairs.REVISION)
        self.assertEqual(receipt['local']['review_count'], 0)
        self.assertEqual(receipt['local']['changed']['text_unlinked'], 2)
        self.assertEqual(receipt['local']['changed']['text_entities_removed'], 1)
        self.assertEqual(receipt['text_media_ids'], [1, 3])
        self.assertEqual(len(receipt[RECEIPT_KEY]['links']), 2)
        self.assertFalse(receipt['dispatch_complete'])
        # 上一轮按 `text-3` 派过的片子换规则段重新排采。
        self.service.config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        with patch('peach.library_processing._people_allowed', return_value=False), patch(
                'peach.seed_followup.plan', return_value=[]), patch('peach.media_sources.cost_for', return_value='free'):
            planned = self.service._plan(receipt)
        self.assertEqual([row.key for row in planned],
                         [f'upgrade-library:processing-v2:text-{upgrade_rules.PROVIDER_TEXT}:{asset_id}'
                          for asset_id in (1, 3)])
        # 重采按站上编号认人：乱码实体的编号已摘掉，正确名字落到正确的那一位。
        with self.database.write_transaction() as connection:
            for external_id in ('1', '3'):
                landed = upsert_asset_entity(connection, kind='performer', name='桃乃木かな', asset_id=1,
                    role='performer', source='javinizer:dmm:performer', confidence=.75, now='later',
                    external_provider='dmm', external_id=external_id)
                self.assertEqual(landed, fixture['correct'])
                connection.execute('DELETE FROM entity_external_ref')
            connection.execute('DELETE FROM asset_entity WHERE asset_id=1 AND entity_id=?', (fixture['correct'],))
        # 只做一次：再启动不重放、不再备份。
        backups = len(list(self.root.glob('ledger.pre-upgrade-*.db')))
        with patch('peach.metadata_text_repair._unlink_garbled', side_effect=AssertionError('不能重放')):
            self.service.prepare()
        self.assertEqual(len(list(self.root.glob('ledger.pre-upgrade-*.db'))), backups)

    def test_garbled_scraped_performers_are_unlinked_and_requeued_once_after_a_text_receipt(self):
        self.upgrade_garbled_people_from(f'{upgrade_repairs.CATALOG_REVISION}:text-3')

    def test_garbled_scraped_performers_are_unlinked_after_skipping_text_revisions(self):
        self.upgrade_garbled_people_from(upgrade_repairs.CATALOG_REVISION)

    def revert_garbled_people(self, batch=''):
        from peach import auto_landing_revert, metadata_text_repair
        with self.database.write_transaction() as connection:
            planned = auto_landing_revert.plan(connection, metadata_text_repair.GARBLED_PEOPLE_SOURCE, batch,
                                               logo_root=self.root / 'logos', cover_root=self.root / 'covers')
            return planned, auto_landing_revert.apply(connection, planned)

    def test_garbled_people_revert_restores_every_removed_row_once(self):
        from peach import auto_landing_revert
        with patch.object(upgrade_repairs, 'REVISION', f'{upgrade_repairs.CATALOG_REVISION}:text-3'):
            self.service.prepare()
        fixture = self.garbled_people()
        links, tags = self.performer_links(), self.asset_tags()
        with self.database.read_connection() as connection:
            refs = [tuple(row) for row in connection.execute('SELECT * FROM entity_external_ref ORDER BY external_id')]
            entity = tuple(connection.execute('SELECT * FROM entity WHERE id=?', (fixture['garbled'],)).fetchone())
        self.service.prepare()
        planned, result = self.revert_garbled_people(upgrade_repairs.REVISION)
        # 实体行、它的别名与编号、另一位被摘的编号、两条关联、一个标签。
        self.assertEqual(auto_landing_revert.counts(planned)['garbled'], 7)
        self.assertEqual(result['restored_garbled_rows'], 7)
        self.assertEqual((self.performer_links(), self.asset_tags()), (links, tags))
        with self.database.read_connection() as connection:
            self.assertEqual([tuple(row) for row in connection.execute(
                'SELECT * FROM entity_external_ref ORDER BY external_id')], refs)
            self.assertEqual(tuple(connection.execute('SELECT * FROM entity WHERE id=?', (fixture['garbled'],)).fetchone()),
                             entity)
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), [])
        planned, result = self.revert_garbled_people()
        self.assertEqual((planned['garbled'], result['restored_garbled_rows']), ([], 0))

    def test_garbled_people_revert_refuses_when_the_entity_name_is_taken(self):
        with patch.object(upgrade_repairs, 'REVISION', f'{upgrade_repairs.CATALOG_REVISION}:text-3'):
            self.service.prepare()
        fixture = self.garbled_people()
        self.service.prepare()
        with self.database.write_transaction() as connection:
            upsert_asset_entity(connection, kind='performer', name=GARBLED, asset_id=2,
                                role='performer', source='user:manual', now='later')
        with self.assertRaisesRegex(ValueError, '整批拒绝'):
            self.revert_garbled_people()
        self.assertNotIn((1, fixture['garbled'], 'javinizer:dmm:performer'), self.performer_links())

    def test_missing_alternative_keeps_the_original_and_records_review(self):
        self.damaged_asset()
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT catalog_title FROM asset WHERE id=1').fetchone()[0],
                             '壊\ufffdれた題名')
        receipt=upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['local']['changed']['text_fields'],0)
        self.assertEqual(receipt['local']['changed']['text_review'],1)

    def test_damaged_text_reprocessing_has_an_independent_rule_identity(self):
        from peach.settings_file import load_config
        self.service.config=load_config(environ={'PEACH_DATA_ROOT':str(self.root)})
        self.damaged_asset()
        receipt={'queued':{'upgrade-library:processing-v2:1':99},
                 'media_ids':[1],'text_media_ids':[1]}
        with patch('peach.library_processing._people_allowed',return_value=False), patch(
                'peach.seed_followup.plan',return_value=[]), patch('peach.media_sources.cost_for',return_value='free'):
            planned=self.service._plan(receipt)
        self.assertEqual([row.key for row in planned],[f'upgrade-library:processing-v2:text-{upgrade_rules.PROVIDER_TEXT}:1'])
        # 任务中心那一行写的是哪部片，不是一句笼统的「更新影片资料」。
        with self.service.contract.database.read_connection() as connection:
            code, name = connection.execute('SELECT code,name FROM asset WHERE id=1').fetchone()
        self.assertEqual(dict(planned[0].params)['name'], code or name)

    def test_text_only_dispatch_does_not_plan_unrelated_people(self):
        from peach.settings_file import load_config
        self.service.config=load_config(environ={'PEACH_DATA_ROOT':str(self.root)})
        self.damaged_asset()
        receipt={'queued':{},'media_ids':[1],'text_media_ids':[1],'text_only':True}
        with patch('peach.library_processing._people_allowed',return_value=True), patch(
                'peach.seed_followup.plan',return_value=[]), patch('peach.media_sources.cost_for',return_value='free'), patch(
                'peach.performer_alias_followup.stock',side_effect=AssertionError('不能重放人物补修')):
            planned=self.service._plan(receipt)
        self.assertEqual([row.key for row in planned],[f'upgrade-library:processing-v2:text-{upgrade_rules.PROVIDER_TEXT}:1'])

    def test_completed_dispatch_rereads_the_seed_pack_only_after_it_or_the_entities_change(self):
        """派发完成后每分钟一问：包文件与实体都没变时不再整包读、算摘要。"""
        import os
        pack = self.root / 'entities.json'
        pack.write_text('{}', encoding='utf-8')
        revision = {'entity': 1}
        self.contract.ledger_revision = lambda tables: revision['entity']
        self.service.prepare()
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt['dispatch_complete'] = True
        self.service._save_receipt(receipt)
        with patch('peach.seed_pack.DEFAULT_PACK', pack), \
                patch('peach.seed_followup.plan', return_value=[]) as plan, \
                patch('peach.library_processing._people_allowed', return_value=False):
            self.service.tick()
            self.service.tick()
            self.assertEqual(plan.call_count, 1)
            revision['entity'] = 2
            self.service.tick()
            self.assertEqual(plan.call_count, 2)
            changed = pack.stat().st_mtime_ns + 10 ** 9
            os.utime(pack, ns=(changed, changed))
            self.service.tick()
            self.assertEqual(plan.call_count, 3)
            # 包要派时不记指纹，下一轮照旧整包判断。
            plan.return_value = [SimpleNamespace(key='seed-import:new')]
            receipt = upgrade_repairs._read(self.service.receipt)
            receipt['queued'] = {**receipt.get('queued', {}), 'seed-import:new': 1}
            self.service._save_receipt(receipt)
            revision['entity'] = 3
            self.service.tick()
            self.service.tick()
            self.assertEqual(plan.call_count, 5)
        self.assertTrue(upgrade_repairs._read(self.service.receipt)['dispatch_complete'])

    def test_completed_catalog_dispatch_preserves_deferred_work_across_text_revision(self):
        with patch.object(upgrade_repairs,'REVISION',upgrade_repairs.CATALOG_REVISION):
            self.service.prepare()
            receipt=upgrade_repairs._read(self.service.receipt)
            receipt.update(queued={'old-work':99},media_ids=[42],deferred=[42],dispatch_complete=True)
            self.service._save_receipt(receipt)
        self.service.prepare()
        receipt=upgrade_repairs._read(self.service.receipt)
        self.assertTrue(receipt['text_only'])
        self.assertTrue(receipt['dispatch_complete'])
        self.assertEqual(receipt['queued'],{'old-work':99})
        self.assertEqual(receipt['media_ids'],[42])
        self.assertEqual(receipt['deferred'],[42])

    def test_text_rule_preserves_inherited_running_or_cancelled_media_work(self):
        from peach.settings_file import load_config
        self.service.config=load_config(environ={'PEACH_DATA_ROOT':str(self.root)})
        self.damaged_asset()
        parent=self.store.start('old-upgrade',trigger='manual')
        key='upgrade-library:processing-v2:1'
        child=self.store.enqueue_followups(parent.id,[(key,upgrade_repairs.MEDIA_TASK,'处理')])['queued'][0]
        self.store.finish(parent.id,'succeeded')
        receipt={'queued':{key:child},'media_ids':[1],'text_media_ids':[1]}
        for status in ('pending','cancelled'):
            if status=='cancelled':
                self.store.finish(child,'cancelled')
            with self.subTest(status=status), patch('peach.library_processing._people_allowed',return_value=False), patch(
                    'peach.seed_followup.plan',return_value=[]), patch('peach.media_sources.cost_for',return_value='free'):
                self.assertEqual(self.service._plan(receipt),[])

    def test_planning_reads_queued_task_states_in_batches_and_skips_them_when_media_waits(self):
        """回执里上千条旧任务按批 `IN` 查状态，不逐条 `get`；影片补全这轮不派时根本不查。"""
        self.damaged_asset()
        keys = [f'upgrade-library:processing-v2:{key}' for key in range(1, 1201)]
        with self.database.write_transaction() as connection:
            ids = [connection.execute(
                "INSERT INTO task_run(task_key,trigger,status,followup_key,host,finished_at) "
                "VALUES(?,'scheduled','succeeded',?,'upgrade-test','2026-11-08T00:00:00Z')",
                (upgrade_repairs.MEDIA_TASK, key)).lastrowid for key in keys]
        receipt = {'queued': dict(zip(keys, ids)), 'media_ids': [1]}
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch('peach.media_sources.cost_for', return_value='free'), \
                patch.object(self.store, 'get', side_effect=AssertionError('逐条查询')), \
                patch.object(self.service, '_run_states', wraps=self.service._run_states) as states:
            self.assertEqual(self.service._plan(dict(receipt), media=False), [])
            states.assert_not_called()
            self.service._plan(dict(receipt))
        states.assert_called_once()
        self.assertEqual(set(self.service._run_states(ids).values()), {'succeeded'})

    def test_start_returns_before_the_first_dispatch_round_finishes(self):
        """首轮派发交给调度器立即执行；服务启动不等它，HTTPS 不因此晚一分钟监听。"""
        entered, release, finished = threading.Event(), threading.Event(), threading.Event()

        def slow_tick():
            entered.set()
            release.wait(5)
            finished.set()

        with patch.object(self.service, 'tick', side_effect=slow_tick), \
                patch.object(self.service, '_settle_verification'), \
                patch.object(self.service, '_release_studio_misses'), \
                patch.object(self.service, '_clear_stale_codes'):
            self.contract.followups.stop = Mock()
            self.service.start()
            try:
                self.assertFalse(finished.is_set())
                self.assertTrue(entered.wait(5))
            finally:
                release.set()
                # 一次性作业跑完才关调度器，否则它收尾时找不到已被关停清掉的作业。
                deadline = time.monotonic() + 5
                while len(self.service.scheduler.get_jobs()) > 1 and time.monotonic() < deadline:
                    time.sleep(.01)
                self.service.stop()

    def test_a_snapshot_for_another_work_cannot_repair_machine_text(self):
        self.damaged_asset()
        self.clean_snapshot()
        path=self.root/'sources/library-metadata/EXM-001-dmm.json'
        path.write_text(json.dumps({'id':'OTHER-999','title':'別の作品'}),encoding='utf-8')
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT catalog_title FROM asset WHERE id=1').fetchone()[0],
                             '壊\ufffdれた題名')

    def test_manual_change_after_planning_prevents_the_machine_repair(self):
        from peach import metadata_text_repair
        self.damaged_asset()
        self.clean_snapshot()
        with self.database.read_connection() as connection:
            plan=metadata_text_repair.collect(connection,self.root/'sources/library-metadata')
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET catalog_title=?,field_owners=? WHERE id=1',
                               ('人工题名',json.dumps({'catalog_title':'user:manual'})))
            result=metadata_text_repair.apply(connection,plan)
            self.assertEqual(result['text_fields'],0)
            self.assertEqual(connection.execute('SELECT catalog_title FROM asset WHERE id=1').fetchone()[0],
                             '人工题名')

    def setUp(self):
        capacity = patch('peach.storage_budget.CapacityGuard.check')
        capacity.start()
        self.addCleanup(capacity.stop)
        holder = tempfile.TemporaryDirectory()
        self.addCleanup(holder.cleanup)
        self.root = Path(holder.name).resolve()
        (self.root / 'config.toml').write_text("[media.locations]\nlocal = ['R:\\media']\n'115' = ['B:\\media']\n", encoding='utf-8')
        self.db = fresh_ledger(self.root)
        self.database = LedgerDatabase(self.db)
        self.store = TaskRunStore(self.database, host='upgrade-test')
        self.contract = SimpleNamespace(database=self.database, db_path=self.db, task_runs=self.store,
            follow_state_root=self.root / 'state', follow_sources_root=self.root / 'sources',
            entry_links_root=self.root / 'state',
            candidate_root=self.root / 'generated', cover_root=self.root / 'covers',
            logo_root=self.root / 'logos', avatar_root=self.root / 'avatars', snapshot_root=self.root / 'snapshots',
            followups=SimpleNamespace(wake=Mock()))
        self.service = upgrade_repairs.UpgradeRepairs(self.contract, available=True)
        self.mount_status = patch('peach.upgrade_repairs.mount_unreachable', return_value=False)
        self.mount_status.start()
        self.addCleanup(self.mount_status.stop)
        from peach.settings_file import load_config
        self.service.config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})

    def asset(self, key, *, code='BAD-001', owner='scan:filename', duration=0):
        with self.database.write_transaction() as connection:
            connection.execute('INSERT INTO asset(id,location,path,name,medium,code,field_owners,duration) '
                               "VALUES(?,'local',?,?,'video',?,?,?)",
                               (key, rf'R:\media\{key}.mp4', 'SSIS-123.mp4', code, json.dumps({'code': owner}), duration))

    def test_codes_missing_their_label_suffix_are_restored_once_with_a_receipt(self):
        """#124：旧版把 `IBW-483z` 的 `z` 当版次剥掉，只改回扫描写入、去掉尾字母正好等于旧值的番号。"""
        rows = [
            (1, 'IBW-483z.mp4', 'IBW-483', 'scan:filename'),
            # 没有归属的番号来路不明（旧导入），不碰。
            (7, 'IBW-622z.mp4', 'IBW-622', None),
            (2, 'IBW-518Z 少女.mp4', 'IBW-518', 'scan:filename'),
            # 用户填的番号不碰。
            (3, 'IBW-529z.mp4', 'IBW-529', 'user:manual'),
            # 文件名本来就没有尾字母，旧值是对的。
            (4, 'IBW-562.mp4', 'IBW-562', 'scan:filename'),
            # 版次尾字母不是登记的尾字母。
            (5, 'ADN-516C.mp4', 'ADN-516', 'scan:filename'),
            # 去掉尾字母也对不上旧值：不是这一类误认，留着。
            (6, 'IBW-613z.mp4', 'IBW-612', 'scan:filename'),
        ]
        with self.database.write_transaction() as connection:
            for key, name, code, owner in rows:
                connection.execute(
                    'INSERT INTO asset(id,location,path,name,medium,code,field_owners) '
                    "VALUES(?,'local',?,?,'video',?,?)",
                    (key, rf'R:\{name}', name, code, json.dumps({'code': owner}) if owner else None))
        self.service._restore_suffix_codes()
        with self.database.read_connection() as connection:
            codes = dict(connection.execute('SELECT id,code FROM asset ORDER BY id').fetchall())
            receipt = connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                         (upgrade_repairs.SUFFIX_CODES_KEY,)).fetchone()
        self.assertEqual(codes, {1: 'IBW-483Z', 2: 'IBW-518Z', 3: 'IBW-529', 4: 'IBW-562', 5: 'ADN-516',
                                 6: 'IBW-612', 7: 'IBW-622'})
        self.assertEqual(json.loads(receipt[0]), {'codes': [
            {'id': 1, 'current': 'IBW-483', 'target': 'IBW-483Z'},
            {'id': 2, 'current': 'IBW-518', 'target': 'IBW-518Z'}]})
        # 只做一次：之后再记上的旧值不再改。
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET code='IBW-483' WHERE id=1")
        self.service._restore_suffix_codes()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT code FROM asset WHERE id=1').fetchone()[0], 'IBW-483')

    def test_codes_misread_from_old_filenames_are_cleared_once_with_a_receipt(self):
        rows = [
            # 手机录像的时间戳与被截断的「名字_日期」：现行规则都不认，账本里还记着旧值。
            (1, r'R:\media\某人\VID_20220818_125735_816.mp4', '125735-816', None, None),
            (2, r'A:\pen\KUZU_250103-U_iris3.mp4', 'KUZU-25010', None, None),
            # 现行规则认不出文件名，但番号完整写在文件名里：保留。
            (3, r'B:\x\(アリスJAPAN)(DVAJ-185)标题.mp4', 'DVAJ-185', None, None),
            # 番号不在文件名里，可这一行有刮削资料：是按另一份身份改过的，保留。
            (4, r'B:\一本道\092415-001\1pon-092415-001-fhd2_(new).mp4', '092415_159', '另一部的标题', None),
            # 用户自己填的番号不碰。
            (5, r'A:\pen\KUZU_142-U_iris3.mp4', 'KUZU-142', None, 'user:manual'),
        ]
        with self.database.write_transaction() as connection:
            for key, path, code, title, owner in rows:
                connection.execute(
                    'INSERT INTO asset(id,location,path,name,medium,code,catalog_title,field_owners) '
                    "VALUES(?,'local',?,?,'video',?,?,?)",
                    (key, path, path.rsplit('\\', 1)[1], code, title, json.dumps({'code': owner}) if owner else None))
        self.service._clear_stale_codes()
        with self.database.read_connection() as connection:
            codes = dict(connection.execute('SELECT id,code FROM asset ORDER BY id').fetchall())
            receipt = connection.execute(f"SELECT result_json FROM ledger_upgrade_repair "
                                         f"WHERE id='{upgrade_repairs.STALE_CODES_KEY}'").fetchone()
        self.assertEqual(codes, {1: None, 2: None, 3: 'DVAJ-185', 4: '092415_159', 5: 'KUZU-142'})
        self.assertEqual(json.loads(receipt[0]), {'cleared': [{'id': 1, 'code': '125735-816'},
                                                              {'id': 2, 'code': 'KUZU-25010'}]})
        # 只做一次：之后再记上的旧值不再清。
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET code='125735-816' WHERE id=1")
        self.service._clear_stale_codes()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT code FROM asset WHERE id=1').fetchone()[0], '125735-816')

    def test_old_task_records_are_converted_to_codes_once_with_their_originals(self):
        # ADR-0159 第五条：升级前写进库里的中文换成 code，原值记进回执；对不上的原样留着。
        from peach import interface_text_upgrade, repair_center
        from peach.followups import attempts_root
        legacy = {
            'outcome': '补上 2 部的样张（9 张）；跳过 1 部没有可问的官方站、3 部联网名额用完留到下一轮；还有 4 部待补，接着排下一轮'}
        rows = [  # (task_key, progress_label, error, result_summary)
            ('code-samples', '扫描文件', None, legacy),
            ('performer-profile', '女优资料补全：涼森れむ', None, {'name': '涼森れむ', 'outcome': 'avbase 绑定；javdb 写入'}),
            ('upgrade-library', '影片升级补全', None,
             {'outcome': '已延后：影片所在目录读不到，挂载恢复后再补测', 'deferred': 1}),
            ('studio-mark', 'SSIS-123.mp4', '服务重启，这一轮没有跑完', {'outcome': '官网未取得', 'site': {'outcome': '未取得'}}),
            ('demo', None, 'RuntimeError: 原文', {'outcome': '一句对不上的旧话'}),
        ]
        with self.database.write_transaction() as connection:
            for key, label, error, summary in rows:
                connection.execute("INSERT INTO task_run(task_key,trigger,status,host,finished_at,progress_label,"
                                   "error,result_summary) VALUES(?,'manual','succeeded','h','2026-01-01T00:00:00Z',?,?,?)",
                                   (key, label, error, json.dumps(summary, ensure_ascii=False)))
        root = attempts_root(self.contract.candidate_root)
        root.mkdir(parents=True)
        (root / 'performer-alias-7.json').write_text(json.dumps(
            {'key': 'performer-alias:7', 'fingerprint': 'fp', 'outcome': '登记 3 个别名'}, ensure_ascii=False),
            encoding='utf-8')
        (root / 'entity-avatar-performer-8.json').write_text(json.dumps(
            {'key': 'entity-avatar:performer:8', 'fingerprint': 'fp', 'outcome': '更早的措辞'}, ensure_ascii=False),
            encoding='utf-8')

        self.service._convert_interface_text()

        runs = {run.task_key: run for run in self.store.query(limit=20)}
        sample = runs['code-samples'].payload()
        self.assertEqual((sample['progress_code'], sample['progress_label']), ('stage.library.scanFiles', '扫描文件'))
        self.assertEqual(sample['result_summary']['outcome'], legacy['outcome'])
        self.assertEqual([part['code'] for part in sample['result_summary']['outcome_parts']],
                         ['samplesLanded', 'semicolon', 'skipped', 'skipNoSite', 'listComma', 'skipDeferred',
                          'semicolon', 'remainingNext'])
        profile = runs['performer-profile'].payload()
        self.assertEqual((profile['progress_code'], profile['progress_params']),
                         ('taskRun.progress.item', {'name': '涼森れむ'}))
        # 措辞改写过的段落按新措辞显示：库里存的已经是 code。
        self.assertEqual(profile['result_summary']['outcome'], '已关联 avbase 资料页；已保存来自 javdb 的资料')
        deferred = runs['upgrade-library'].result_summary['outcome_parts']
        self.assertEqual(deferred, [{'code': 'deferredBy', 'params': {
            'reason': [{'code': 'deferMountDimensions', 'params': {}}]}}])
        studio = runs['studio-mark']
        self.assertEqual((studio.progress_label, studio.progress_code), ('SSIS-123.mp4', ''))
        self.assertEqual((studio.error_code, studio.error), ('taskRun.error.interrupted', '服务重启，这一轮没有跑完'))
        self.assertEqual([part['code'] for part in studio.result_summary['outcome_parts']], ['officialSite', 'unfetched'])
        self.assertEqual(studio.result_summary['site'], {'outcome_parts': [{'code': 'unfetched', 'params': {}}]})
        untouched = runs['demo']
        self.assertEqual((untouched.error, untouched.result_summary), ('RuntimeError: 原文', {'outcome': '一句对不上的旧话'}))
        self.assertEqual(json.loads((root / 'performer-alias-7.json').read_text(encoding='utf-8'))['outcome_parts'],
                         [{'code': 'aliasesAdded', 'params': {'count': 3}}])
        self.assertEqual(json.loads((root / 'entity-avatar-performer-8.json').read_text(encoding='utf-8'))['outcome'],
                         '更早的措辞')

        with self.database.read_connection() as connection:
            receipt = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                    (interface_text_upgrade.RECEIPT_KEY,)).fetchone()[0])
            center = repair_center.snapshot(connection, {}, cloud_pending=0)
        self.assertEqual((receipt['rows'], receipt['attempts']), (4, 1))
        self.assertEqual(receipt['attempt_originals'], {'performer-alias-7.json': '登记 3 个别名'})
        original = receipt['originals'][str(runs['studio-mark'].id)]
        self.assertEqual((original['error'], json.loads(original['result_summary'])['outcome']),
                         ('服务重启，这一轮没有跑完', '官网未取得'))
        item = next(item for item in center['items'] if item['id'] == 'interface-text')
        self.assertEqual((item['state'], item['changed']), ('done', 5))
        # 只做一次：之后再写进来的旧句子不再转。
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE task_run SET error='服务重启，这一轮没有跑完',error_code=NULL WHERE id=?",
                               (studio.id,))
        self.service._convert_interface_text()
        self.assertEqual(self.store.get(studio.id).error_code, '')

    def test_old_studio_misses_are_released_only_once(self):
        from peach.followups import Attempts, attempts_root
        root = attempts_root(self.contract.candidate_root)
        Attempts(root).record('studio-mark:7', 'fp', parts('officialSite', 'unfetched'))
        self.service._release_studio_misses()
        record = json.loads((root / 'studio-mark-7.json').read_text(encoding='utf-8'))
        self.assertIn('retry_until', record)
        with self.database.read_connection() as connection:
            receipt = connection.execute("SELECT result_json FROM ledger_upgrade_repair "
                                         "WHERE id='studio-unbounded-misses-1'").fetchone()
        self.assertEqual(json.loads(receipt[0]), {'released': 1})
        # 放行之后又照旧规则记下的「未取得」，升级补修不再碰第二次。
        Attempts(root).record('studio-mark:7', 'fp', parts('officialSite', 'unfetched'))
        self.service._release_studio_misses()
        self.assertNotIn('retry_until', json.loads((root / 'studio-mark-7.json').read_text(encoding='utf-8')))

    def test_runtime_files_left_by_finished_runs_are_cleared_on_upgrade(self):
        from peach import update_tasks
        root = update_tasks.state_for(self.db).parent / 'task-controls'
        finished = self.store.start('probe', trigger='manual')
        self.store.finish(finished.id, 'succeeded')
        running = self.store.start('probe', trigger='manual')
        # 旧版每轮都留下即时状态，结束和清退历史行后都不删。
        for identity in (finished.id, running.id, 999999):
            for kind in ('observed', 'resources'):
                (root / f'{identity}.{kind}.json').write_text('{}', encoding='utf-8')
        self.service._prune_task_controls()
        self.assertEqual(sorted(path.name for path in root.iterdir()),
                         sorted([f'{finished.id}.speed.json', f'{running.id}.speed.json',
                                 f'{running.id}.observed.json', f'{running.id}.resources.json']))
        with self.database.read_connection() as connection:
            receipt = connection.execute("SELECT result_json FROM ledger_upgrade_repair "
                                         "WHERE id='task-controls-runtime-files-1'").fetchone()
        self.assertEqual(json.loads(receipt[0]), {'removed': 4})
        (root / '999999.observed.json').write_text('{}', encoding='utf-8')
        self.service._prune_task_controls()
        self.assertTrue((root / '999999.observed.json').exists())

    def failed_followups(self, keys):
        """一轮父任务派出这几条后继并全按失败结束，返回 {键: 任务 id}。"""
        parent = self.store.start('upgrade-repairs', trigger='scheduled')
        queued = self.store.enqueue_followups(parent.id, [(key, key.split(':')[0], key) for key in keys])['queued']
        self.store.finish(parent.id, 'succeeded')
        runs = {}
        for run_id in queued:
            run = self.store.get(run_id)
            self.store.finish(run_id, 'failed', error='来源出错')
            runs[run.followup_key] = run_id
        return runs

    def test_failed_followups_left_by_old_versions_are_pruned_once_with_their_controls(self):
        from peach import update_tasks
        self.service.prepare()
        runs = self.failed_followups([
            'upgrade-library:processing-v2:1',          # 结论已记进状态表
            'upgrade-library:display-dimensions-1:2',   # 已撤下的旧规则
            'upgrade-library:processing-v2:3',          # 回执队列里还等结算
            'upgrade-library:processing-v2:4',          # 状态表说它正排着、指的就是这一行
            'avatar:5', 'avatar:6'])
        with self.database.write_transaction() as connection:
            upgrade_repairs.upsert_items(connection, [
                {'rule': 'media:processing-v2', 'asset_id': 1, 'state': 'failed',
                 'run_id': runs['upgrade-library:processing-v2:1']},
                {'rule': 'media:processing-v2', 'asset_id': 4, 'state': 'queued',
                 'run_id': runs['upgrade-library:processing-v2:4']}], mode='finish')
            connection.execute("UPDATE task_run SET finished_at='2000-01-01T00:00:00.000Z' WHERE id=?",
                               (runs['avatar:5'],))
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt['queued'] = {'upgrade-library:processing-v2:3': runs['upgrade-library:processing-v2:3']}
        self.service._save_receipt(receipt)
        self.service._prune_failed_followups()
        left = {key for key, run_id in runs.items() if self.store.get(run_id) is not None}
        self.assertEqual(left, {'upgrade-library:processing-v2:3', 'upgrade-library:processing-v2:4', 'avatar:6'})
        controls = update_tasks.state_for(self.db).parent / 'task-controls'
        self.assertFalse((controls / f"{runs['upgrade-library:processing-v2:1']}.speed.json").exists())
        self.assertTrue((controls / f"{runs['avatar:6']}.speed.json").exists())
        with self.database.read_connection() as connection:
            result = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                   (upgrade_repairs.FAILED_FOLLOWUPS_KEY,)).fetchone()[0])
        self.assertEqual(result, {'removed': {'upgrade-library': 2, 'avatar': 1}})

    def test_a_settled_failure_leaves_the_task_list_once_its_conclusion_is_recorded(self):
        self.service.prepare()
        key = 'upgrade-library:processing-v2:7'
        run_id = self.failed_followups([key])[key]
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt['queued'] = {key: run_id}
        self.service._save_receipt(receipt)
        self.tick_quietly()
        with self.database.read_connection() as connection:
            state = connection.execute("SELECT state FROM ledger_upgrade_item WHERE asset_id=7").fetchone()[0]
        self.assertEqual(state, 'failed')
        self.assertIsNone(self.store.get(run_id))

    def test_one_time_rules_in_one_startup_share_a_single_pre_write_backup(self):
        first = self.service._upgrade_backup()
        self.assertEqual(self.service._upgrade_backup(), first)
        self.assertEqual(list(self.root.glob('ledger.pre-upgrade-*.db')), [first])
        # 只有一家领过、又没用上时才删；别的规则的回执还指着它就留着。
        self.service._release_upgrade_backup(first)
        self.assertTrue(first.exists())
        # 下一次启动是新的服务实例，重新备一份。
        later = upgrade_repairs.UpgradeRepairs(self.contract, available=True)._upgrade_backup()
        self.assertNotEqual(later, first)
        lone = upgrade_repairs.UpgradeRepairs(self.contract, available=True)
        backup = lone._upgrade_backup()
        lone._release_upgrade_backup(backup)
        self.assertFalse(backup.exists())

    def test_code_siblings_with_nothing_to_inherit_leave_no_backup_behind(self):
        with self.database.write_transaction() as connection:
            connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                               (upgrade_repairs.FC2_SELLERS_KEY, '1', '{}'))
        self.service._inherit_code_siblings()
        self.assertEqual(list(self.root.glob('ledger.pre-upgrade-*.db')), [])
        with self.database.read_connection() as connection:
            result = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                   (upgrade_repairs.CODE_SIBLINGS_KEY,)).fetchone()[0])
        self.assertNotIn('backup', result)

    def test_writer_startup_prunes_ledger_backups_like_the_tray(self):
        """Docker 与 `peach serve` 没有托盘，服务启动时按同一保留份数清退账本备份。"""
        import os
        import shutil
        import threading
        from peach import api
        old = time.time() - 3 * 86400
        for index in range(7):
            backup = self.db.with_name(f'ledger.pre-manual-2026010{index}-000000.db')
            shutil.copyfile(self.db, backup)
            os.utime(backup, (old + index, old + index))
        self.contract.upgrade_repairs = self.service
        settings = SimpleNamespace(db_path=self.db, follow_state_root=self.root / 'state')
        with patch.object(api, '_restore_task_center'), patch('peach.web_job_recovery.restore'):
            self.assertTrue(api._start_ledger_services(settings, self.contract, []))
        for thread in threading.enumerate():
            if thread.name == 'PeachLedgerBackupPrune':
                thread.join(60)
        self.assertEqual(sorted(path.name for path in self.root.glob('ledger.pre-manual-*.db')),
                         [f'ledger.pre-manual-2026010{index}-000000.db' for index in range(2, 7)])

    def test_local_repairs_are_atomic_idempotent_and_preserve_manual_codes(self):
        self.asset(1)
        self.asset(2, owner='user:manual')
        self.service.prepare()
        self.service.prepare()
        with self.database.read_connection() as connection:
            rows = connection.execute('SELECT id,code,duration FROM asset ORDER BY id').fetchall()
            self.assertEqual([tuple(row) for row in rows], [(1, 'SSIS-123', None), (2, 'BAD-001', None)])
            # 悬空候选、JavDB 记录类型、视频改登记、附属文件删行、番号尾字母、来源分辨率标签、画质分档与旧记录转换八条补修，以及旧版数据补修各记一行，这里只数更新已有资料的回执。
            self.assertEqual(connection.execute('SELECT count(*) FROM ledger_upgrade_repair WHERE id NOT IN (?,?,?,?,?,?,?,?) '
                                                'AND id NOT IN (SELECT value FROM json_each(?))',
                                                (upgrade_repairs.DANGLING_KEY, upgrade_repairs.SUFFIX_CODES_KEY,
                                                 upgrade_repairs.JAVDB_RECORDS_KEY,
                                                 upgrade_repairs.VIDEO_MEDIUM_KEY, upgrade_repairs.SIDECAR_ASSETS_KEY,
                                                 upgrade_repairs.RESOLUTION_TAGS_KEY, quality_repair.KEY,
                                                 interface_text_upgrade.RECEIPT_KEY,
                                                 json.dumps([rule.key for rule in legacy_repairs.RULES]))).fetchone()[0], 1)
        self.assertEqual(len(list(self.root.glob('ledger.pre-upgrade-*.db'))), 1)
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['local']['before'], receipt['local']['after'])
        self.service.receipt.unlink()
        self.service.prepare()
        self.assertEqual(upgrade_repairs._read(self.service.receipt), receipt)

    def test_catalog_upgrade_restores_a_registered_short_serial(self):
        # #296：旧规则把 `mcdv-24.mp4` 补零成 `MCDV-024`，那是另一部有码片。
        with self.database.write_transaction() as connection:
            for key, name, code in ((1, 'mcdv-24.mp4', 'MCDV-024'), (2, 'LAF-41.mp4', 'LAF-041')):
                connection.execute('INSERT INTO asset(id,location,path,name,medium,code,field_owners,duration) '
                                   "VALUES(?,'local',?,?,'video',?,?,60)",
                                   (key, name, name, code, json.dumps({'code': 'scan:filename'})))
            old = upgrade_repairs.CATALOG_REVISION.replace(upgrade_rules.CATALOG, 'catalog-v2')
            connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                               (old, '1', json.dumps({'revision': old})))
        self.service.prepare()
        with self.database.read_connection() as connection:
            rows = connection.execute('SELECT id,code FROM asset ORDER BY id').fetchall()
        self.assertEqual([tuple(row) for row in rows], [(1, 'MCDV-24'), (2, 'LAF-041')])
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertIn(1, receipt['media_ids'])
        self.assertNotIn(2, receipt['media_ids'])

    def test_catalog_upgrade_restores_heyzo_four_digits(self):
        # #354：旧规则把 `HEYZO-0707.mp4` 收成三位 `HEYZO-707`，用户手改过的番号不动。
        with self.database.write_transaction() as connection:
            for key, name, code, owner in ((1, 'HEYZO-0707.mp4', 'HEYZO-707', 'scan:filename'),
                                           (2, 'HEYZO-1082.mp4', 'HEYZO-1082', 'scan:filename'),
                                           (3, 'heyzo_hd_0500_full.mp4', 'HEYZO-500', 'user:edit')):
                connection.execute('INSERT INTO asset(id,location,path,name,medium,code,field_owners,duration) '
                                   "VALUES(?,'local',?,?,'video',?,?,60)",
                                   (key, name, name, code, json.dumps({'code': owner})))
            old = upgrade_repairs.CATALOG_REVISION.replace(upgrade_rules.CATALOG, 'catalog-v3')
            connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                               (old, '1', json.dumps({'revision': old})))
        self.service.prepare()
        with self.database.read_connection() as connection:
            rows = connection.execute('SELECT id,code FROM asset ORDER BY id').fetchall()
        self.assertEqual([tuple(row) for row in rows], [(1, 'HEYZO-0707'), (2, 'HEYZO-1082'), (3, 'HEYZO-500')])
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertIn(1, receipt['media_ids'])
        self.assertNotIn(2, receipt['media_ids'])

    def code_evidence_fixture(self, assets):
        """#296 的现场：`MCDV-24` 曾按 `MCDV-024` 取过 r18.dev，标题那一行用户批准过。"""
        from peach import artifact_rules
        from peach.library_processing import FIELDS
        from peach.review_csv import write_rows
        with self.database.write_transaction() as connection:
            for key, name, code in assets:
                connection.execute('INSERT INTO asset(id,location,path,name,medium,code,field_owners,duration) '
                                   "VALUES(?,'local',?,?,'video',?,?,60)",
                                   (key, rf'R:\media\{name}', name, code, json.dumps({'code': 'scan:filename'})))
            connection.execute('UPDATE asset SET catalog_title=?,field_owners=? WHERE id=1',
                               ('クリスタル映像の題名', json.dumps({'code': 'scan:filename',
                                                                   'catalog_title': 'review:r18dev'})))
            connection.execute("INSERT INTO review_decision(category,item_key,status,note,updated_at) "
                               "VALUES('metadata_fields','asset:1:title','approved',?,'2026-11-04T00:00:00Z')",
                               (json.dumps({'candidate_key': 'r18-title', 'source': 'r18dev'}),))

        def candidate(key, source, provider_id, value, content_id=''):
            return {'candidate_key': key, 'source': source, 'provider_id': provider_id, 'content_id': content_id,
                    'value': value, 'display_value': value, 'source_url': ''}

        def row(asset_id, field, code, *candidates):
            return {'item_key': f'asset:{asset_id}:{field}', 'code': code, 'query': code, 'asset_id': asset_id,
                    'asset_path': f'{asset_id}.mp4', 'field': field, 'field_label': field, 'current_value': '',
                    'candidates_json': json.dumps(list(candidates), ensure_ascii=False),
                    'source_count': len(candidates), 'source_profile': 'library', 'policy_version': 'library-v1',
                    'status': 'candidate'}

        old = ('MCDV-024', '49mcdv024')
        rows = [row(1, 'title', 'MCDV-024', candidate('r18-title', 'r18dev', *old[:1], 'クリスタル映像の題名', old[1])),
                row(1, 'studio', 'MCDV-024', candidate('r18-studio', 'r18dev', old[0], 'クリスタル映像', old[1]),
                    candidate('javdb-studio', 'javdb', 'MCDV-24', 'メルシーボークー'),
                    candidate('nfo-studio', 'local_nfo', '', 'メルシーボークー')),
                row(1, 'release_date', 'MCDV-024', candidate('r18-date', 'r18dev', old[0], '2004-12-10', old[1])),
                # 同一部片只是写法变了：番号补修把 `HEYZO-707` 改成了 `HEYZO-0707`，候选照样成立。
                row(2, 'title', 'HEYZO-707', candidate('heyzo-title', 'javdb', 'HEYZO-707', 'HEYZO の題名')),
                row(3, 'title', 'ABP-001', candidate('abp-title', 'r18dev', 'ABP-001', 'ABP の題名', 'abp00001'))]
        if any(key == 4 for key, _, _ in assets):
            rows.append(row(4, 'title', 'MCDV-024', candidate('mcdv024-title', 'r18dev', *old[:1], '2004 年那部', old[1])))
        output = self.contract.candidate_root / upgrade_repairs.CANDIDATE_FILE
        output.parent.mkdir(parents=True, exist_ok=True)
        write_rows(output, FIELDS, rows, fill_missing=True)
        directory = self.root / 'sources/library-metadata'
        directory.mkdir(parents=True, exist_ok=True)
        snapshots = {}
        for name in ('MCDV-024-r18dev', 'MCDV-24-javdb', 'HEYZO-707-javdb', 'ABP-001-r18dev'):
            path = directory / f'{name}.json'
            path.write_text(json.dumps({'id': name.rsplit('-', 1)[0]}), encoding='utf-8')
            artifact_rules.remember(path, str(upgrade_rules.PROVIDER_EVIDENCE))
            snapshots[name] = path
        return output, snapshots

    def candidate_rows(self, output):
        from peach.review_csv import read_rows
        return {row['item_key']: row for row in read_rows(output)}

    def test_reverted_short_code_withdraws_old_code_evidence_and_requeues_once(self):
        # 报告者的现场：番号早已改回 `MCDV-24`、那一轮也派过补全，旧番号的候选和快照还在。
        from peach import artifact_rules
        from peach.settings_file import load_config
        output, snapshots = self.code_evidence_fixture(
            ((1, 'mcdv-24.mp4', 'MCDV-24'), (2, 'HEYZO-0707.mp4', 'HEYZO-0707'), (3, 'ABP-001.mp4', 'ABP-001')))
        with self.database.write_transaction() as connection:
            connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                               (upgrade_repairs.REVISION, '1', json.dumps({
                                   'revision': upgrade_repairs.REVISION, 'media_ids': [1], 'deferred': [],
                                   'queued': {'upgrade-library:processing-v2:1': 99}, 'dispatch_complete': True})))
        before = self.candidate_rows(output)
        snapshot_bytes = {name: path.read_bytes() for name, path in snapshots.items()}
        self.service.prepare()
        after = self.candidate_rows(output)
        # 批准过的标题行候选原样留着，只改按现番号核身份：按现番号重采回来的标题才进得了这一行的比对。
        self.assertEqual(after['asset:1:title'], {**before['asset:1:title'], 'code': 'MCDV-24', 'query': 'MCDV-24'})
        # 未批准的行只摘认旧番号的候选，留下的改按现番号核身份。
        studio = after['asset:1:studio']
        self.assertEqual([choice['candidate_key'] for choice in json.loads(studio['candidates_json'])],
                         ['javdb-studio', 'nfo-studio'])
        self.assertEqual((studio['code'], studio['query'], studio['source_count']), ('MCDV-24', 'MCDV-24', '2'))
        self.assertNotIn('asset:1:release_date', after)
        self.assertEqual(after['asset:2:title'], before['asset:2:title'])
        self.assertEqual(after['asset:3:title'], before['asset:3:title'])
        with self.database.read_connection() as connection:
            title, owners = connection.execute('SELECT catalog_title,field_owners FROM asset WHERE id=1').fetchone()
        self.assertEqual((title, json.loads(owners)['catalog_title']), ('クリスタル映像の題名', 'review:r18dev'))
        evidence = str(upgrade_rules.PROVIDER_EVIDENCE)
        self.assertFalse(artifact_rules.current(snapshots['MCDV-024-r18dev'], evidence))
        for name in ('MCDV-24-javdb', 'HEYZO-707-javdb', 'ABP-001-r18dev'):
            self.assertTrue(artifact_rules.current(snapshots[name], evidence), name)
        self.assertEqual({name: path.read_bytes() for name, path in snapshots.items()}, snapshot_bytes)
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['code_media_ids'], [1])
        self.assertEqual(receipt['media_ids'], [1])
        self.assertFalse(receipt['dispatch_complete'])
        self.assertEqual(receipt['code_evidence']['approved_kept'], ['asset:1:title'])
        self.assertEqual(sorted(row['item_key'] for row in receipt['code_evidence']['withdrawn']),
                         ['asset:1:release_date', 'asset:1:studio'])
        # 上一轮按 `processing-v2:1` 派过，这次换规则段才会真的重采。
        self.service.config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        with patch('peach.library_processing._people_allowed', return_value=False), patch(
                'peach.seed_followup.plan', return_value=[]), patch('peach.media_sources.cost_for', return_value='free'):
            planned = self.service._plan(receipt)
        self.assertEqual([row.key for row in planned], ['upgrade-library:processing-v2:code-evidence-1:1'])
        # 一份回执只撤一次，再启动不重做、不重排。
        stored = output.read_bytes()
        self.service.prepare()
        self.assertEqual(output.read_bytes(), stored)
        self.assertEqual(upgrade_repairs._read(self.service.receipt), receipt)

    def dangling_fixture(self):
        """#486 的现场：77 永久删除后同一个文件重新登记成 759，220 的文件已不在库。"""
        from peach.library_processing import FIELDS
        from peach.review_csv import write_rows
        moved, gone, live = r'R:\media\DASD-321.mp4', r'R:\media\SSIS-220.mp4', r'R:\media\MIAA-337.mp4'
        with self.database.write_transaction() as connection:
            for key, path, code in ((759, moved, 'DASD-321'), (760, live, 'MIAA-337')):
                connection.execute('INSERT INTO asset(id,location,path,name,medium,code,duration) '
                                   "VALUES(?,'local',?,?,'video',?,60)", (key, path, path.rsplit('\\', 1)[1], code))
            connection.executemany(
                "INSERT INTO review_decision(category,item_key,status,note,updated_at) "
                "VALUES('metadata_fields',?,?,?,'2026-10-29T00:00:00Z')",
                [('asset:77:title', 'skipped', ''), ('asset:77:studio', 'approved', '{"auto_applied": true}'),
                 ('asset:220:title', 'approved', '{"auto_applied": true}'),
                 ('asset:80:title', 'skipped', ''), ('asset:760:title', 'skipped', '')])

        def row(asset_id, field, code, path):
            choice = {'candidate_key': f'{code}-{field}', 'source': 'javbus', 'provider_id': code,
                      'value': f'{code} の{field}', 'display_value': f'{code} の{field}'}
            return {'item_key': f'asset:{asset_id}:{field}', 'code': code, 'query': code, 'asset_id': asset_id,
                    'asset_path': path, 'field': field, 'field_label': field, 'current_value': '',
                    'candidates_json': json.dumps([choice], ensure_ascii=False), 'source_count': 1,
                    'source_profile': 'library', 'policy_version': 'library-v1', 'status': 'candidate'}

        rows = [row(77, 'title', 'DASD-321', moved),
                # 新编号已有同字段的行：旧行让位。
                row(77, 'studio', 'DASD-321', moved), row(759, 'studio', 'DASD-321', moved),
                row(220, 'title', 'SSIS-220', gone), row(760, 'title', 'MIAA-337', live),
                # 按番号出的行不钉编号，不归这条补修管。
                {**row('', 'series', 'ABP-001', ''), 'item_key': 'code:ABP-001:series'}]
        output = self.contract.candidate_root / upgrade_repairs.CANDIDATE_FILE
        output.parent.mkdir(parents=True, exist_ok=True)
        write_rows(output, FIELDS, rows, fill_missing=True)
        return output

    def decisions(self):
        with self.database.read_connection() as connection:
            return {row[0]: tuple(row[1:]) for row in connection.execute(
                'SELECT item_key,status,note,updated_at FROM review_decision ORDER BY item_key')}

    def test_dangling_candidates_are_repinned_or_withdrawn_once_and_can_be_restored(self):
        output = self.dangling_fixture()
        with self.database.write_transaction() as connection:
            connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                               (upgrade_repairs.REVISION, '1', json.dumps({
                                   'revision': upgrade_repairs.REVISION, 'media_ids': [], 'deferred': [],
                                   'queued': {}, 'dispatch_complete': True, 'code_evidence': {}})))
        before, decided = self.candidate_rows(output), self.decisions()
        self.service.prepare()
        after = self.candidate_rows(output)
        self.assertEqual(sorted(after), ['asset:759:studio', 'asset:759:title', 'asset:760:title',
                                         'code:ABP-001:series'])
        self.assertEqual(after['asset:759:title'], {**before['asset:77:title'], 'item_key': 'asset:759:title',
                                                    'asset_id': '759'})
        for key in ('asset:759:studio', 'asset:760:title', 'code:ABP-001:series'):
            self.assertEqual(after[key], before[key])
        # 跳过的决定跟着改挂，仍在「稍后处理」；挂不上的决定清掉；在库资产的不动。
        self.assertEqual(self.decisions(), {'asset:759:title': decided['asset:77:title'],
                                            'asset:760:title': decided['asset:760:title']})
        with self.database.read_connection() as connection:
            receipt = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                    (upgrade_repairs.DANGLING_KEY,)).fetchone()[0])
        self.assertEqual(receipt['rule'], upgrade_rules.DANGLING_CANDIDATES)
        self.assertEqual(receipt['repinned'], [{'file': upgrade_repairs.CANDIDATE_FILE, 'item_key': 'asset:77:title',
                                                'asset_id': 77, 'new_item_key': 'asset:759:title',
                                                'new_asset_id': 759}])
        self.assertEqual([entry['row'] for entry in receipt['withdrawn']],
                         [before['asset:77:studio'], before['asset:220:title']])
        self.assertEqual({entry['item_key']: entry['moved_to'] for entry in receipt['decisions']},
                         {'asset:77:title': 'asset:759:title', 'asset:77:studio': None,
                          'asset:220:title': None, 'asset:80:title': None})
        # 只做一次：再启动不重读、不重写。
        stored = output.read_bytes()
        self.service.prepare()
        self.assertEqual(output.read_bytes(), stored)
        # 按回执整批还原：行与决定回到补修之前，补修也不再重做。
        result = upgrade_repairs.restore_dangling_candidates(self.database, self.contract.candidate_root)
        self.assertEqual(result, {'rows': 3, 'decisions': 4, 'skipped': 0})
        self.assertEqual(self.candidate_rows(output), before)
        self.assertEqual(self.decisions(), decided)
        self.service.prepare()
        self.assertEqual(self.candidate_rows(output), before)

    def test_javdb_records_from_cached_cards_hide_the_same_record_name_matched_page_once(self):
        """#271：森日向子 的署名页 bkxd 与按名字回填的 MmbDR（白石アイリ）都是有碼记录。

        补修按本机缓存的搜索卡片记下有碼／無碼：MmbDR 不再出入口，订着它的那条源停用；
        深田えいみ 按名字回填的是她的無碼那页，照出。只做一次，再启动不重扫。
        """
        def card(actor, name, record=''):
            mark = f'<span class="info">{record}</span>' if record else ''
            return f'<div class="box actor-box">\n<a href="/actors/{actor}" title="{name}">{mark}</a></div>'

        cache = self.root / 'state' / 'directory-links' / 'javdb'
        cache.mkdir(parents=True)
        (cache / 'a.html').write_text(card('MmbDR', '白石アイリ') + card('bkxd', '森日向子, 日向結衣'),
                                      encoding='utf-8')
        followup_cache = self.root / 'generated' / 'provider-cache' / 'javdb-pages'
        followup_cache.mkdir(parents=True)
        (followup_cache / 'b.json').write_text(json.dumps({
            'final_url': 'https://javdb.com/search', 'body': card('E26vd', '深田えいみ', '无码')}), encoding='utf-8')
        backfill, signed = {'source': 'backfill_performer_entry_ids'}, {'source': 'javdb', 'provider_id': 'X-1'}
        with self.database.write_transaction() as connection:
            for key, name in ((1, '森日向子'), (2, '深田咏美')):
                connection.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at)"
                                   " VALUES(?,'performer',?,?,'t','t')", (key, name, name))
            connection.executemany(
                "INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id,metadata_json)"
                " VALUES(?,'javdb','performer',?,?)",
                [(1, 'MmbDR', json.dumps(backfill)), (1, 'bkxd', json.dumps(signed)),
                 (2, 'E26vd', json.dumps(backfill)), (2, 'pRMq', json.dumps(signed))])
            connection.executemany(
                "INSERT INTO feed_source(id,kind,name,url,entity_id,enabled,interval_minutes,created_at)"
                " VALUES(?,'javdb_actor','',?,?,1,60,'t')",
                [(3, 'https://javdb.com/actors/MmbDR', 1), (4, 'https://javdb.com/actors/bkxd', 1)])
        self.service.prepare()

        def pages(entity_id, name):
            with self.database.read_connection() as connection:
                refs = [dict(row) for row in connection.execute(
                    'SELECT provider,external_kind,external_id,metadata_json FROM entity_external_ref'
                    ' WHERE entity_id=?', (entity_id,))]
            return entry_links.javdb_actor_pages(name, refs)

        self.assertEqual(pages(1, '森日向子'), ['https://javdb.com/actors/bkxd'])
        # pRMq 没有缓存卡片，类型未知；E26vd 是無碼那条，与谁都不同类，照出。
        self.assertEqual(pages(2, '深田咏美'), ['https://javdb.com/actors/pRMq', 'https://javdb.com/actors/E26vd'])
        with self.database.read_connection() as connection:
            self.assertEqual(dict(connection.execute('SELECT id,enabled FROM feed_source').fetchall()), {3: 0, 4: 1})
            receipt = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                    (upgrade_repairs.JAVDB_RECORDS_KEY,)).fetchone()[0])
        self.assertEqual(receipt['hidden'], [{'entity_id': 1, 'external_id': 'MmbDR'}])
        self.assertEqual(receipt['disabled_feeds'], [{'entity_id': 1, 'external_id': 'MmbDR', 'source_id': 3}])
        self.assertEqual(sorted((row['external_id'], row['uncensored']) for row in receipt['recorded']),
                         [('E26vd', True), ('MmbDR', False), ('bkxd', False)])
        # 按来源整批撤回（ADR-0052）：类型去掉、订阅启用回去，入口回到补修之前；补修不再重做。
        from peach import auto_landing_revert
        with self.database.write_transaction() as connection:
            planned = auto_landing_revert.plan(connection, upgrade_repairs.JAVDB_RECORDS_SOURCE,
                                               logo_root=self.root / 'logos', cover_root=self.root / 'covers')
            self.assertEqual(len(planned['javdb_records']), 4)
            self.assertEqual(auto_landing_revert.apply(connection, planned)['restored_javdb_records'], 4)
        self.assertEqual(pages(1, '森日向子'), ['https://javdb.com/actors/bkxd', 'https://javdb.com/actors/MmbDR'])
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT enabled FROM feed_source WHERE id=3').fetchone()[0], 1)
            self.assertEqual(auto_landing_revert.plan(
                connection, upgrade_repairs.JAVDB_RECORDS_SOURCE, logo_root=self.root / 'logos',
                cover_root=self.root / 'covers')['javdb_records'], [])

    def test_quality_repair_updates_measured_videos_once_and_preserves_later_edits(self):
        """已有尺寸按画质规则补修，撤回只还原尺寸和值均未再变的记录。"""
        from peach import auto_landing_revert, repair_center, web_stats
        rows = ((1, 1920, 1080, '2K'), (2, 1080, 1920, '2K'),
                (3, 1280, 720, '720P'), (4, 1920, 1080, '自定义'),
                (5, 2048, 1080, '2K'), (6, 1500, 900, '1080P'),
                (7, None, None, '2K'), (8, 1920, 1080, '2K'), (9, 1920, 1080, '2K'),
                # 迁移 0057 之后最低一档存英文 id：旧规则的 720P 落到新规则的 low。
                (10, 960, 540, '720P'))
        for key, *_ in rows:
            self.asset(key, duration=60)
        with self.database.write_transaction() as connection:
            connection.executemany('UPDATE asset SET width=?,height=?,ctx_quality=? WHERE id=?',
                                   [(width, height, quality, key) for key, width, height, quality in rows])

        def qualities():
            with self.database.read_connection() as connection:
                return dict(connection.execute('SELECT id,ctx_quality FROM asset'))

        self.service.prepare()
        self.assertEqual(qualities(), {1: '1080P', 2: '1080P', 3: '720P', 4: '自定义',
                                       5: '2K', 6: '720P', 7: '2K', 8: '1080P', 9: '1080P', 10: 'low'})
        with self.database.read_connection() as connection:
            bands = {row['k']: row['n'] for row in web_stats._bands(connection, 'ctx_quality', web_stats.QUALITY_BANDS)}
        self.assertEqual((bands['1080P'], bands['2K'], bands['720P'], bands['low']), (4, 2, 2, 1))
        with self.database.read_connection() as connection:
            center = repair_center.snapshot(connection, {}, cloud_pending=0)
        self.assertEqual(next(item['changed'] for item in center['items'] if item['id'] == 'quality-bands'), 6)
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET ctx_quality='手工' WHERE id=2")
            connection.execute('UPDATE asset SET width=1600 WHERE id=6')
            connection.execute("UPDATE asset SET path='R:\\media\\replacement.mp4' WHERE id=8")
        self.service.prepare()
        self.assertEqual(qualities()[2], '手工')
        with self.database.write_transaction() as connection:
            planned = auto_landing_revert.plan(connection, quality_repair.SOURCE,
                                               logo_root=self.root / 'logos', cover_root=self.root / 'covers')
            connection.execute("UPDATE asset SET path='R:\\media\\later.mp4' WHERE id=9")
            self.assertEqual(auto_landing_revert.apply(connection, planned)['restored_quality'], 2)
        self.assertEqual(qualities(), {1: '2K', 2: '手工', 3: '720P', 4: '自定义',
                                       5: '2K', 6: '720P', 7: '2K', 8: '1080P', 9: '1080P', 10: '720P'})
        self.service.prepare()
        self.assertEqual(qualities()[1], '2K')

    def test_scraped_4k_tags_are_released_once_and_revert_by_source(self):
        """资料站的 `4K` 是官方发行版本：刮削挂上的解除，`stash` 导入与人手加的留着；按回执整批插回。"""
        from peach import auto_landing_revert, repair_center
        with self.database.write_transaction() as connection:
            for key in (1, 2, 3, 4):
                connection.execute("INSERT INTO asset(id,location,path,name,medium) VALUES(?,'local',?,?,'video')",
                                   (key, rf'R:\media\{key}.mp4', f'{key}.mp4'))
            for key, name in ((10, '4K'), (11, '痴女')):
                connection.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at)"
                                   " VALUES(?,'tag',?,?,'t','t')", (key, name, name))
            rows = ((1, 10, '4K', 'javinizer:javdb:tag'), (2, 10, '4K', 'auto:metadata-tags@20261104T141053'),
                    (3, 10, '4K', 'stash'), (4, 10, '4K', 'user:manual'), (1, 11, '痴女', 'javinizer:javdb:tag'))
            for asset_id, entity_id, tag, source in rows:
                connection.execute('INSERT INTO asset_tag(asset_id,tag,confidence,source) VALUES(?,?,0.9,?)',
                                   (asset_id, tag, source))
                connection.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source,confidence,first_seen_at,"
                                   "last_seen_at) VALUES(?,?,'tag',?,0.9,'t','t')", (asset_id, entity_id, source))

        def tagged():
            with self.database.read_connection() as connection:
                return (sorted(tuple(row) for row in connection.execute('SELECT asset_id,tag,source FROM asset_tag')),
                        sorted(tuple(row) for row in connection.execute(
                            "SELECT asset_id,entity_id,source FROM asset_entity WHERE role='tag'")))

        before = tagged()
        self.service.prepare()
        self.assertEqual(tagged(), ([(1, '痴女', 'javinizer:javdb:tag'), (3, '4K', 'stash'), (4, '4K', 'user:manual')],
                                    [(1, 11, 'javinizer:javdb:tag'), (3, 10, 'stash'), (4, 10, 'user:manual')]))
        with self.database.read_connection() as connection:
            center = repair_center.snapshot(connection, {}, cloud_pending=0)
        self.assertEqual(next(item['changed'] for item in center['items'] if item['id'] == 'resolution-tags'), 2)
        # 按来源整批撤回（ADR-0052）：两份行原样插回；补修不再重做。
        with self.database.write_transaction() as connection:
            planned = auto_landing_revert.plan(connection, upgrade_repairs.RESOLUTION_TAGS_SOURCE,
                                               logo_root=self.root / 'logos', cover_root=self.root / 'covers')
            self.assertEqual(auto_landing_revert.apply(connection, planned)['restored_resolution_tags'], 4)
        self.assertEqual(tagged(), before)
        self.service.prepare()
        self.assertEqual(tagged(), before)

    def test_old_code_snapshot_stays_while_another_video_is_that_release(self):
        from peach import artifact_rules
        output, snapshots = self.code_evidence_fixture(
            ((1, 'mcdv-24.mp4', 'MCDV-24'), (2, 'HEYZO-0707.mp4', 'HEYZO-0707'), (3, 'ABP-001.mp4', 'ABP-001'),
             (4, 'MCDV-024.mp4', 'MCDV-024')))
        before = self.candidate_rows(output)
        self.service.prepare()
        after = self.candidate_rows(output)
        self.assertNotIn('asset:1:release_date', after)
        self.assertEqual(after['asset:4:title'], before['asset:4:title'])
        self.assertTrue(artifact_rules.current(snapshots['MCDV-024-r18dev'], str(upgrade_rules.PROVIDER_EVIDENCE)))
        self.assertNotIn(4, upgrade_repairs._read(self.service.receipt)['code_media_ids'])

    def test_catalog_upgrade_reverting_a_short_code_withdraws_its_old_candidates(self):
        from peach import artifact_rules
        output, snapshots = self.code_evidence_fixture(
            ((1, 'mcdv-24.mp4', 'MCDV-024'), (2, 'HEYZO-0707.mp4', 'HEYZO-0707'), (3, 'ABP-001.mp4', 'ABP-001')))
        with self.database.write_transaction() as connection:
            old = upgrade_repairs.CATALOG_REVISION.replace(upgrade_rules.CATALOG, 'catalog-v2')
            connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                               (old, '1', json.dumps({'revision': old})))
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT code FROM asset WHERE id=1').fetchone()[0], 'MCDV-24')
        after = self.candidate_rows(output)
        self.assertNotIn('asset:1:release_date', after)
        self.assertEqual(after['asset:1:studio']['code'], 'MCDV-24')
        self.assertFalse(artifact_rules.current(snapshots['MCDV-024-r18dev'], str(upgrade_rules.PROVIDER_EVIDENCE)))
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertEqual(receipt['code_media_ids'], [1])
        self.assertNotIn(2, receipt['media_ids'])
        self.assertNotIn(3, receipt['media_ids'])

    def test_failure_rolls_back_repairs_and_marker_together(self):
        self.asset(1)
        original = upgrade_repairs._catalog_apply
        def fail(connection, plan):
            original(connection, plan)
            raise RuntimeError('stop')
        with patch.object(upgrade_repairs, '_catalog_apply', side_effect=fail):
            with self.assertRaisesRegex(RuntimeError, 'stop'):
                self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT code FROM asset').fetchone()[0], 'BAD-001')
            self.assertEqual(connection.execute('SELECT count(*) FROM ledger_upgrade_repair').fetchone()[0], 0)
        self.assertFalse(self.service.receipt.exists())

    def test_verification_rows_already_on_disk_settle_once_in_the_background(self):
        """升级前落盘的核查候选（ADR-0139）在后台结算一次，官方一致的日期写入，备份先行；
        启动前的 `prepare` 不等它。"""
        import csv
        with self.database.write_transaction() as connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium,code,release_date) "
                               "VALUES(7,'local','DASS-468.mp4','DASS-468.mp4','video','DASS-468','2024-09-06')")
        self.contract.candidate_root.mkdir(parents=True)
        candidates = [{'candidate_key': f'k{index}', 'source': source, 'value': '2024-09-10',
                       'display_value': '2024-09-10', 'confidence': 0.75, 'provider_id': 'DASS-468',
                       'requires_review': True, **extra}
                      for index, (source, extra) in enumerate((
                          ('makers', {}), ('javdb', {'javdb_rule': 2, 'source_id': 'Fixture'})))]
        with (self.contract.candidate_root / 'library-metadata-field-candidates.csv').open(
                'w', encoding='utf-8-sig', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=['item_key', 'code', 'query', 'field', 'current_value',
                                                        'candidates_json', 'status'])
            writer.writeheader()
            writer.writerow({'item_key': 'DASS-468:release_date', 'code': 'DASS-468', 'query': 'DASS-468',
                             'field': 'release_date', 'current_value': '2024-09-06', 'status': 'candidate',
                             'candidates_json': json.dumps(candidates)})
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT release_date FROM asset WHERE id=7').fetchone()[0],
                             '2024-09-06')
        self.service._settle_verification()
        self.service._settle_verification()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT release_date FROM asset WHERE id=7').fetchone()[0],
                             '2024-09-10')
            settled = connection.execute("SELECT result_json FROM ledger_upgrade_repair "
                                         "WHERE id GLOB 'verification-settlement-*'").fetchall()
        self.assertEqual(len(settled), 1)
        self.assertEqual(json.loads(settled[0][0])['applied'], 1)
        self.assertEqual(len(list(self.root.glob('ledger.pre-upgrade-*.db'))), 1)

    def test_spaced_performer_rows_already_on_disk_settle_once_in_the_background(self):
        """旧版扣在人工队列里的 `釈 アリス` 那一行，升级后在后台按新判据重判一次，对得上登记过的人就落库。"""
        import csv
        from peach.entities import normalize_entity_name
        with self.database.write_transaction() as connection:
            connection.execute("INSERT INTO asset(id,location,path,name,medium,code) "
                               "VALUES(8,'local','ABF-347.mp4','ABF-347.mp4','video','ABF-347')")
            connection.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at)"
                               " VALUES(901,'performer','釈アリス',?,'x','x')", (normalize_entity_name('釈アリス'),))
        self.contract.candidate_root.mkdir(parents=True)
        candidates = [{'candidate_key': f'k{index}', 'source': source, 'value': [{'name': name}],
                       'display_value': name, 'confidence': 0.75, 'provider_id': 'ABF-347'}
                      for index, (source, name) in enumerate((('prestige', '釈 アリス'), ('javbus', '釈アリス')))]
        with (self.contract.candidate_root / 'library-metadata-field-candidates.csv').open(
                'w', encoding='utf-8-sig', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=['item_key', 'code', 'query', 'field', 'current_value',
                                                        'candidates_json', 'status'])
            writer.writeheader()
            writer.writerow({'item_key': 'asset:8:performers', 'code': 'ABF-347', 'query': 'ABF-347',
                             'field': 'performers', 'current_value': '', 'status': 'candidate',
                             'candidates_json': json.dumps(candidates, ensure_ascii=False)})
        self.service._settle_spaced_performers()
        self.service._settle_spaced_performers()
        with self.database.read_connection() as connection:
            self.assertEqual([row[0] for row in connection.execute(
                "SELECT entity_id FROM asset_entity WHERE asset_id=8 AND role='performer'")], [901])
            settled = connection.execute("SELECT result_json FROM ledger_upgrade_repair WHERE id=?",
                                         (upgrade_repairs.SPACED_PERFORMERS_KEY,)).fetchall()
        self.assertEqual(len(settled), 1)
        self.assertEqual(json.loads(settled[0][0])['applied'], 1)

    def test_same_code_copies_inherit_the_cast_once_after_the_seller_backfill(self):
        """存量里后入库、缺演员的同番号副本，升级后在卖家补挂之后照抄一次，两条回执各记一次。"""
        with self.database.write_transaction() as connection:
            for asset_id, name in ((21, 'FC2-PPV-1666863-CD1.mp4'), (22, 'www.98T.la@FC2-1666863-CD1.mp4')):
                connection.execute("INSERT INTO asset(id,location,path,name,medium,code) "
                                   "VALUES(?,'local',?,?,'video','FC2-PPV-1666863')", (asset_id, name, name))
            connection.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at)"
                               " VALUES(910,'performer','Cast','cast','x','x')")
            connection.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source) "
                               "VALUES(21,910,'performer','javinizer:javdb:performer')")
        self.service._backfill_identities()
        self.service._backfill_identities()
        with self.database.read_connection() as connection:
            self.assertEqual([row[0] for row in connection.execute(
                "SELECT entity_id FROM asset_entity WHERE asset_id=22 AND role='performer'")], [910])
            receipts = {row[0]: json.loads(row[1]) for row in connection.execute(
                'SELECT id,result_json FROM ledger_upgrade_repair WHERE id IN (?,?)',
                (upgrade_repairs.FC2_SELLERS_KEY, upgrade_repairs.CODE_SIBLINGS_KEY))}
        self.assertEqual(len(receipts[upgrade_repairs.CODE_SIBLINGS_KEY]['links']), 1)
        self.assertEqual(receipts[upgrade_repairs.FC2_SELLERS_KEY]['entity_ids'], [])

    def test_enhancement_model_aliases_and_search_terms_are_cleared_once_with_a_backup(self):
        """`prob4`、`chf3` 这类代号别名与搜索词删掉并记进回执，带代号的规范名不改、只补去掉代号的别名。"""
        with self.database.write_transaction() as connection:
            connection.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at)"
                               " VALUES(7391,'creator','大叔 chf3_prob4','大叔 chf3_prob4','x','x')")
            for alias in ('prob4', 'chf3', '大叔11'):
                connection.execute("INSERT INTO entity_alias(entity_id,alias,normalized_alias,source,confidence)"
                                   " VALUES(7391,?,?,'stash:performer',0.8)", (alias, alias))
                connection.execute("INSERT INTO entity_search_term(entity_id,term,purpose,source,created_at)"
                                   " VALUES(7391,?,'discovery','stash:performer','x')", (alias,))
        self.service._settle_enhancement_names()
        self.service._settle_enhancement_names()
        with self.database.read_connection() as connection:
            aliases = sorted(row[0] for row in connection.execute('SELECT alias FROM entity_alias WHERE entity_id=7391'))
            terms = sorted(row[0] for row in connection.execute('SELECT term FROM entity_search_term'))
            canonical = connection.execute('SELECT canonical_name FROM entity WHERE id=7391').fetchone()[0]
            receipt = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                    (upgrade_repairs.ENHANCEMENT_NAMES_KEY,)).fetchone()[0])
        self.assertEqual(aliases, ['大叔', '大叔11'])
        self.assertEqual(terms, ['大叔11'])
        self.assertEqual(canonical, '大叔 chf3_prob4')
        self.assertEqual((len(receipt['aliases']), len(receipt['terms']), len(receipt['added_aliases'])), (2, 2, 1))
        self.assertTrue(Path(receipt['backup']).is_file())

    def test_stale_receipt_cannot_hide_a_restored_database(self):
        self.asset(1)
        self.service.root.mkdir(parents=True)
        self.service.receipt.write_text(json.dumps({'revision': upgrade_repairs.REVISION,
            'local': {'state': 'succeeded'}, 'dispatch_complete': True}), encoding='utf-8')
        self.service.prepare()
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute('SELECT code FROM asset').fetchone()[0], 'SSIS-123')

    def test_corrupt_receipt_is_preserved_and_restored_from_the_ledger(self):
        self.service.prepare()
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt.update(queued={'upgrade-library:processing-v2:1':71}, dispatch_complete=True)
        self.service._save_receipt(receipt)
        self.service.receipt.write_text('{', encoding='utf-8')
        self.assertEqual(self.service.snapshot()['state'], 'failed')
        self.service.prepare()
        self.assertEqual(upgrade_repairs._read(self.service.receipt), receipt)
        copies = list(self.service.root.glob('receipt.corrupt-*.json'))
        self.assertEqual(len(copies), 1)
        self.assertEqual(copies[0].read_text(encoding='utf-8'), '{')

    def test_identical_dispatch_receipt_keeps_the_ledger_revision(self):
        self.service.prepare()
        receipt = upgrade_repairs._read(self.service.receipt)
        with self.database.read_connection() as connection:
            before = connection.execute("SELECT n FROM ledger_revision WHERE tbl='ledger_upgrade_repair'").fetchone()[0]
        self.service._save_receipt(receipt)
        with self.database.read_connection() as connection:
            after = connection.execute("SELECT n FROM ledger_revision WHERE tbl='ledger_upgrade_repair'").fetchone()[0]
        self.assertEqual(before, after)

    def test_source_evidence_requires_the_current_rule_without_removing_legacy_files(self):
        from peach import artifact_rules, library_processing, upgrade_rules
        from peach.settings_file import load_config
        config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        remote = library_processing._RemoteSession(config, Mock(),
            library_processing._MissCache(self.root / 'misses.json'), retrying=False)
        path = remote._evidence_path('EXM-001', 'r18dev')
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps({'title':'样本'}), encoding='utf-8')
        self.assertEqual(remote._cached_evidence(('r18dev',), 'EXM-001'), [])
        self.assertTrue(path.exists())
        artifact_rules.remember(path, str(upgrade_rules.PROVIDER_EVIDENCE))
        self.assertEqual(remote._cached_evidence(('r18dev',), 'EXM-001')[0][0], 'r18dev')

    def test_interrupted_dispatch_parent_cannot_block_the_next_attempt(self):
        from peach.followups import Followup
        self.service.prepare()
        planned = [Followup('upgrade-library:processing-v2:1', 'upgrade-library', '处理')]
        with patch.object(self.service, '_plan', return_value=planned):
            with patch.object(self.store, 'enqueue_followups', side_effect=OSError('locked')), patch.object(
                    self.store, 'finish', side_effect=OSError('locked')), self.assertLogs('peach.upgrade_repairs', level='ERROR'):
                self.service.tick()
            self.assertIsNotNone(self.store.blocking(upgrade_repairs.TASK_KEY))
            self.service.tick()
        self.assertIsNone(self.store.blocking(upgrade_repairs.TASK_KEY))
        self.assertEqual(len(upgrade_repairs._read(self.service.receipt)['queued']), 1)
        self.assertEqual(self.service.error, '')

    def test_shutdown_waits_for_media_work_and_preserves_it_for_resume(self):
        from peach.followups import FollowupRunner
        from peach.settings_file import load_config
        self.contract.upgrade_repairs = self.service
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        runner = FollowupRunner(self.contract)
        self.contract.followups = runner
        parent = self.store.start('test-parent', trigger='manual')
        child = self.store.enqueue_followups(parent.id, [('upgrade-library:processing-v2:1', 'upgrade-library', '处理')])['queued'][0]
        self.store.finish(parent.id, 'succeeded')
        entered, ended = threading.Event(), threading.Event()
        def process(*_args, **kwargs):
            self.assertTrue(kwargs['active']())
            entered.set()
            self.assertTrue(self.service.stopping.wait(5))
            self.assertFalse(kwargs['active']())
            ended.set()
            raise InterruptedError('stopping')
        with patch('peach.library_processing.process_library', side_effect=process):
            runner.wake()
            self.assertTrue(entered.wait(5))
            self.service.stop()
        self.assertTrue(ended.is_set())
        self.assertEqual(self.store.get(child).status, 'pending')

    def test_reader_does_not_create_state_or_modify_ledger(self):
        service = upgrade_repairs.UpgradeRepairs(self.contract, available=False)
        service.prepare()
        service.tick()
        self.assertEqual(service.snapshot()['state'], 'unavailable')
        self.assertFalse(service.root.exists())

    def test_custom_code_patterns_are_used_during_planning(self):
        self.asset(1, code='CUSTOM-001')
        with self.database.read_connection() as connection, patch('peach.profiles.read_settings',
                return_value={'codePatterns': [r'CUSTOM-\d+']}), patch(
                'peach.catalog_rules.release_code_from_filename', return_value='CUSTOM-001') as identify:
            self.assertEqual(upgrade_repairs._catalog_plan(connection, self.root)['codes'], [])
        self.assertEqual(identify.call_args.kwargs['patterns'][0].pattern, r'CUSTOM-\d+')

    def test_series_projection_only_updates_linked_unprotected_fields(self):
        for key in (1, 2, 3):
            self.asset(key, duration=12)
        with self.database.write_transaction() as connection:
            for key in (1, 2):
                entity = upsert_asset_entity(connection, kind='series', name='Series', asset_id=key,
                                            role='series', source='javinizer:r18dev:series')
            connection.execute("UPDATE asset SET series='Series'")
            connection.execute('UPDATE asset SET field_owners=? WHERE id=2', (json.dumps({'series':'review:r18dev'}),))
            r18_legacy_repair.apply_entity_rows(connection, [{'action':'rename', 'entity_id':entity,
                'kind':'series', 'current':'Series', 'target':'シリーズ'}], 'now')
            rows = connection.execute('SELECT series,mutation_revision FROM asset ORDER BY id').fetchall()
        self.assertEqual([tuple(row) for row in rows], [('シリーズ',1), ('Series',0), ('Series',0)])

    def test_queue_batches_and_retry_keep_cancelled_items(self):
        from peach.followups import Followup
        self.asset(1, duration=12)
        self.service.prepare()
        planned = [Followup('upgrade-library:processing-v2:1', 'upgrade-library', '补全')]
        with patch.object(self.service, '_plan', side_effect=[planned, []]):
            self.service.tick()
            self.service.tick()
        receipt = upgrade_repairs._read(self.service.receipt)
        child = next(iter(receipt['queued'].values()))
        self.store.finish(child, 'cancelled')
        with patch.object(self.service, '_plan', return_value=[]):
            self.service.retry()
        # 结束了的键结算进状态表、移出回执队列；用户取消的那一行在重试后仍是取消。
        self.assertEqual(upgrade_repairs._read(self.service.receipt)['queued'], {})
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute(
                'SELECT rule,asset_id,state,run_id FROM ledger_upgrade_item').fetchone()),
                ('media:processing-v2', 1, 'cancelled', child))
        self.assertEqual(self.service.snapshot()['state'], 'complete')

    def test_seed_content_change_reopens_completed_dispatch(self):
        from peach.followups import Followup
        self.service.prepare()
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt['dispatch_complete'] = True
        self.service.receipt.write_text(json.dumps(receipt), encoding='utf-8')
        row = Followup('seed-import:new:digest', 'seed-import', '资料')
        with patch('peach.seed_followup.plan', return_value=[row]), patch.object(self.service, '_plan', return_value=[row]):
            self.service.tick()
        self.assertIn(row.key, upgrade_repairs._read(self.service.receipt)['queued'])

    def test_runtime_identity_detects_rebuilt_assets_in_the_running_process(self):
        from peach import client_updates
        dist = self.root / 'web/dist'
        dist.mkdir(parents=True)
        asset = dist / 'peach-app.js'
        asset.write_text('first', encoding='utf-8')
        with patch.object(client_updates, 'PROJECT_ROOT', self.root):
            first = client_updates.runtime_identity()
            self.assertEqual(client_updates.runtime_identity(), first)
            asset.write_text('second build', encoding='utf-8')
            second = client_updates.runtime_identity()
        self.assertNotEqual(first['build_id'], second['build_id'])
        self.assertEqual(first['version'], second['version'])

    def test_pending_schema_on_configured_writer_is_migrated_before_services(self):
        from peach import api, config
        with self.database.write_transaction() as connection:
            connection.execute('DROP TABLE ledger_upgrade_repair')
            connection.execute("DELETE FROM ledger_revision WHERE tbl='ledger_upgrade_repair'")
            connection.execute("DELETE FROM schema_migration WHERE version='0048'")
        self.contract.upgrade_repairs = self.service
        settings = SimpleNamespace(db_path=self.db)
        service, migration, seen = Mock(), api.LedgerMigration(), []
        report = migration.report

        def record(stage, progress):
            report(stage, progress)
            seen.append(migration.payload())
        migration.report = record
        with patch.object(api, '_restore_task_center'), patch('peach.web_job_recovery.restore'), patch.object(
                config, 'MIGRATIONS_DIR', Path(__file__).resolve().parents[1] / 'migrations'):
            self.assertTrue(api._start_ledger_services(settings, self.contract, [service], migration))
        service.start.assert_called_once()
        self.assertEqual(len(list(self.root.glob('ledger.pre-schema-*.db'))), 1)
        # 状态接口在备份时读到阶段与百分比，执行迁移脚本时只读到阶段；做完回到 idle。
        self.assertEqual((seen[0], seen[-1]), ({'state': 'running', 'stage': 'backup', 'progress': 0},
                                               {'state': 'running', 'stage': 'apply'}))
        self.assertIn({'state': 'running', 'stage': 'backup', 'progress': 100}, seen)
        self.assertEqual(migration.payload(), {'state': 'idle'})

    def test_failed_startup_migration_keeps_services_stopped_and_reports_why(self):
        from peach import api, config
        with self.database.write_transaction() as connection:
            connection.execute("DELETE FROM schema_migration WHERE version='0056'")
        self.contract.upgrade_repairs = self.service
        migration, service = api.LedgerMigration(), Mock()
        with (patch('peach.migrations.upgrade', side_effect=RuntimeError('foreign key violations')),
              patch.object(api, '_restore_task_center'), patch('peach.web_job_recovery.restore'),
              patch.object(config, 'MIGRATIONS_DIR', Path(__file__).resolve().parents[1] / 'migrations'),
              self.assertLogs('peach.api', level='ERROR')):
            self.assertFalse(api._start_ledger_services(SimpleNamespace(db_path=self.db), self.contract, [service], migration))
        service.start.assert_not_called()
        payload = migration.payload()
        self.assertEqual((payload['state'], payload['message_code']), ('failed', 'api.ledger.migrationFailed'))
        self.assertIn('foreign key violations', payload['message'])
        self.assertEqual(self.service.error, 'foreign key violations')

    def test_media_planning_uses_current_roots_and_retains_removed_assets_with_records(self):
        self.asset(1, duration=10)
        self.asset(2, duration=10)
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET path='R:\\removed\\two.mp4',play_count=3,rating=80 WHERE id=2")
        receipt = {'queued': {}, 'media_ids': [1, 2]}
        with patch('peach.library_processing._people_allowed', return_value=False), \
                patch('peach.seed_followup.plan', return_value=[]), \
                patch('peach.media_sources.cost_for', return_value='free'):
            planned = self.service._plan(receipt)
            self.assertEqual([upgrade_repairs.item_of(item.key)[1] for item in planned], [1])
            (self.root / 'config.toml').write_text('[media.locations]\n', encoding='utf-8')
            self.assertEqual(self.service._plan(dict(receipt)), [])
        with self.database.read_connection() as connection:
            self.assertEqual(tuple(connection.execute('SELECT play_count,rating FROM asset WHERE id=2').fetchone()), (3, 80))

    def test_media_dispatch_is_bounded_and_rechecks_deferred_cost(self):
        from peach.settings_file import load_config
        self.service.config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        for key in range(1, 71):
            self.asset(key, duration=10)
        receipt = {'queued': {}, 'media_ids': list(range(1, 71)), 'deferred': [1]}
        with patch('peach.library_processing._people_allowed', return_value=False), patch(
                'peach.seed_followup.plan', return_value=[]), patch('peach.media_sources.cost_for', return_value='free'):
            batch = self.service._plan(receipt)
            self.assertEqual(len(batch), 64)
            self.assertEqual(receipt['deferred'], [])
            receipt['queued'] = {row.key: index for index, row in enumerate(batch)}
            self.assertEqual(len(self.service._plan(receipt)), 6)

    def test_next_media_batch_waits_until_the_queued_batch_runs_down(self):
        from peach.followups import Followup
        from peach.settings_file import load_config
        self.service.config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        for key in range(1, 71):
            self.asset(key, duration=10)
        self.service.prepare()
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt.update(media_ids=list(range(1, 71)), dispatch_complete=False)
        self.service._save_receipt(receipt)
        seed = Followup('seed-import:new:digest', 'seed-import', '资料')
        def parents():
            with self.database.read_connection() as connection:
                return connection.execute('SELECT count(*) FROM task_run WHERE task_key=?',
                                          (upgrade_repairs.TASK_KEY,)).fetchone()[0]
        with patch('peach.library_processing._people_allowed', return_value=False), patch(
                'peach.media_sources.cost_for', return_value='free'):
            with patch('peach.seed_followup.plan', return_value=[]):
                self.service.tick()
                self.assertEqual(self.service._media_backlog(), 64)
                self.service.tick()
            self.assertEqual(parents(), 1)
            with patch('peach.seed_followup.plan', return_value=[seed]):
                self.service.tick()
        receipt = upgrade_repairs._read(self.service.receipt)
        self.assertIn(seed.key, receipt['queued'])
        self.assertEqual(self.service._media_backlog(), 64)
        self.assertFalse(receipt['dispatch_complete'])

    def test_processing_repairs_run_in_batches_and_each_film_is_settled_on_its_own(self):
        """一批共用一次馆藏处理；每部片各自结算，冷却的那部延后，其余完成后不再派。"""
        from peach.followups import FollowupRunner
        for key in range(1, 21):
            self.asset(key, duration=10)
        self.service.prepare()
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt.update(media_ids=list(range(1, 21)), dispatch_complete=False)
        self.service._save_receipt(receipt)
        self.contract.upgrade_repairs = self.service
        planning = (patch('peach.library_processing._people_allowed', return_value=False),
                    patch('peach.seed_followup.plan', return_value=[]),
                    patch('peach.media_sources.cost_for', return_value='free'))
        for active in planning:
            active.start()
            self.addCleanup(active.stop)
        self.service.tick()
        queued = upgrade_repairs._read(self.service.receipt)['queued']
        self.assertEqual(sorted(queued), sorted(f'upgrade-library:processing-v2:{key}' for key in range(1, 21)))
        with self.database.read_connection() as connection:
            keys = [row[0] for row in connection.execute(
                'SELECT followup_key FROM task_run WHERE task_key=? ORDER BY id', (upgrade_repairs.MEDIA_TASK,))]
        self.assertEqual([len(upgrade_repairs.member_keys(key)) for key in keys], [16, 4])
        self.assertEqual(len(set(queued.values())), 2)
        self.assertEqual(self.service._media_backlog(), 20)

        def process(*_args, asset_ids, **_kwargs):
            cooling = [3] if 3 in asset_ids else []
            return {'status': 'failed' if cooling else 'complete', 'outcome': 'partial' if cooling else 'complete',
                    'paused_count': len(cooling), 'paused_asset_ids': cooling}
        with patch('peach.library_processing.process_library', side_effect=process) as processed, \
                patch.object(upgrade_repairs, 'mount_unreachable', return_value=False):
            self.assertEqual(FollowupRunner(self.contract).drain(), 2)
        self.assertEqual([len(call.kwargs['asset_ids']) for call in processed.call_args_list], [16, 4])
        self.service.tick()
        self.assertEqual(upgrade_repairs._read(self.service.receipt)['queued'], {})
        states = {asset_id: state for (rule, asset_id), (state, _) in self.items().items()}
        self.assertEqual(states.pop(3), 'deferred')
        self.assertEqual(set(states.values()), {'done'})
        self.assertEqual(len(states), 19)

    def test_cloud_previews_without_a_rule_are_left_to_their_own_tool(self):
        snapshots = self.contract.snapshot_root / 'cloud' / '115'
        snapshots.mkdir(parents=True)
        for key, location in ((1, '115'), (2, 'local')):
            self.asset(key, duration=20)
            sheet = snapshots / f'{key}.jpg'
            sheet.write_bytes(b'unsigned sheet')
            with self.database.write_transaction() as connection:
                connection.execute('UPDATE asset SET location=?,snapshot_path=? WHERE id=?',
                                   (location, str(sheet), key))
        with patch('peach.library_processing._people_allowed', return_value=False), patch(
                'peach.seed_followup.plan', return_value=[]), patch('peach.media_sources.cost_for', return_value='free'):
            batch = self.service._plan({'queued': {}})
        self.assertEqual([item.key for item in batch], ['upgrade-library:processing-v2:2'])

    def test_media_handler_finishes_when_only_media_issues_remain(self):
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        with patch('peach.library_processing.process_library', return_value={
                'status': 'failed', 'outcome': 'partial', 'issue_count': 2,
                'retryable_asset_ids': [1]}):
            result = upgrade_repairs._media_run(
                self.contract, 'upgrade-library:processing-v2:1', Mock())
        self.assertEqual(told(result)['outcome'], '影片升级补全完成')

    def test_cooldown_without_the_paused_film_list_is_settled_as_a_retryable_failure(self):
        """旧版断点没有 `paused_asset_ids`，分不出哪部在等来源：按失败结算，由退避重派。"""
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        with patch('peach.library_processing.process_library', return_value={
                'status': 'failed', 'outcome': 'partial', 'issue_count': 2, 'paused_count': 1,
                'error': '2 项需要处理，其中 1 项是来源限流', 'retryable_asset_ids': [1]}), \
                self.assertRaisesRegex(RuntimeError, '来源限流'):
            upgrade_repairs._media_run(self.contract, 'upgrade-library:processing-v2:1', Mock())

    def test_media_handler_resumes_its_own_checkpoint(self):
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        self.service.root.mkdir(parents=True)
        (self.service.root / '1.json').write_text(json.dumps({'completed_previews':['asset:1'], 'issue_count':3}), encoding='utf-8')
        with patch('peach.library_processing.process_library', return_value={'status':'complete'}) as process:
            upgrade_repairs._media_run(self.contract, 'upgrade-library:processing-v2:1', Mock())
        self.assertEqual(process.call_args.kwargs['resume_state']['completed_previews'], ['asset:1'])
        self.assertEqual(process.call_args.kwargs['resume_state']['issue_count'], 0)
        self.assertEqual(process.call_args.kwargs['asset_ids'], [1])
        self.assertTrue(process.call_args.kwargs['recheck_existing'])

    def checkpoint(self, name, job_id=None):
        """在补修状态目录里放一份续跑状态：状态文件、问题日志与逐项检查点目录。"""
        self.service.root.mkdir(parents=True, exist_ok=True)
        (self.service.root / f'{name}.json').write_text(json.dumps({'job_id': job_id} if job_id else {}),
                                                        encoding='utf-8')
        (self.service.root / f'{name}.issues.jsonl').write_text('{}\n', encoding='utf-8')
        (self.service.root / f'{name}-items').mkdir()
        (self.service.root / f'{name}-items' / 'a.json').write_text('{}', encoding='utf-8')
        return [f'{name}.json', f'{name}.issues.jsonl', f'{name}-items']

    def test_a_finished_film_removes_its_checkpoint_and_a_failed_one_keeps_it_for_the_retry(self):
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        self.checkpoint('1')
        with patch('peach.library_processing.process_library', return_value={
                'status': 'failed', 'outcome': 'failed', 'error': '来源出错'}), \
                self.assertRaises(RuntimeError):
            upgrade_repairs._media_run(self.contract, 'upgrade-library:processing-v2:1', Mock())
        self.assertEqual(sorted(path.name for path in self.service.root.iterdir()), ['1-items', '1.issues.jsonl', '1.json'])
        with patch('peach.library_processing.process_library', return_value={'status': 'complete'}):
            upgrade_repairs._media_run(self.contract, 'upgrade-library:processing-v2:1', Mock())
        self.assertEqual(list(self.service.root.iterdir()), [])

    def test_a_settled_batch_removes_its_checkpoint_even_when_a_film_is_deferred(self):
        """延后的片子重派时编进新批次、换了键，旧批次的检查点再也认不上。"""
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        for key in (1, 2):
            self.asset(key, duration=10)
        key = 'upgrade-library:batch:processing-v2:1,2'
        self.checkpoint(f'batch-{upgrade_repairs._batch_digest(key)}')
        with patch('peach.library_processing.process_library', return_value={
                'status': 'failed', 'outcome': 'partial', 'paused_count': 1, 'paused_asset_ids': [2]}), \
                patch.object(upgrade_repairs, 'mount_unreachable', return_value=False):
            result = upgrade_repairs._media_run(self.contract, key, Mock(run_id=None))
        self.assertEqual((result['done'], result['deferred']), (1, 1))
        self.assertEqual(list(self.service.root.iterdir()), [])

    def test_checkpoints_left_by_finished_repairs_are_cleared_once_on_upgrade(self):
        """旧版补修完不删的续跑状态：只清用不上的，待补、延后、失败与在跑批次的留着。"""
        import os
        self.service.prepare()
        stale = time.time() - 7200
        names = {key: self.checkpoint(key) for key in ('1', '2', '3', '4', '5', '6')}
        running = 'upgrade-library:batch:processing-v2:7,8'
        names['running'] = self.checkpoint(f'batch-{upgrade_repairs._batch_digest(running)}')
        names['old-batch'] = self.checkpoint('batch-' + 'a' * 16)
        names['fresh'] = self.checkpoint('9')
        (self.service.root / 'catalog-review.json').write_text('{}', encoding='utf-8')
        for path in self.service.root.iterdir():
            if not path.name.startswith('9'):
                os.utime(path, (stale, stale))
        with self.database.write_transaction() as connection:
            upgrade_repairs.upsert_items(connection, [
                {'rule': 'media:processing-v2', 'asset_id': asset_id, 'state': state}
                for asset_id, state in ((1, 'done'), (2, 'failed'), (3, 'deferred'), (4, 'cancelled'))], mode='finish')
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt['queued'] = {'upgrade-library:processing-v2:5': 1, running: 2}
        self.service._save_receipt(receipt)
        self.service._prune_repair_checkpoints()
        # 回执的文件锁在 macOS、Linux 上用完不删，留下 `receipt.json.lock`，与这里的清理无关。
        kept = sorted(path.name for path in self.service.root.iterdir() if path.suffix != '.lock')
        expected = names['2'] + names['3'] + names['5'] + names['running'] + names['fresh'] + ['catalog-review.json', 'receipt.json']
        self.assertEqual(kept, sorted(expected))
        with self.database.read_connection() as connection:
            result = json.loads(connection.execute("SELECT result_json FROM ledger_upgrade_repair "
                                                   "WHERE id='upgrade-repair-checkpoints-2'").fetchone()[0])
        # 1、4、6 与旧批次各三个文件。
        self.assertEqual(result['removed'], 12)
        self.checkpoint('10')
        os.utime(self.service.root / '10.json', (stale, stale))
        self.service._prune_repair_checkpoints()
        self.assertTrue((self.service.root / '10.json').exists())

    def test_checkpoints_are_kept_only_for_the_rule_that_still_needs_them(self):
        """一部片在别的规则下失败，不再替这条已做完的规则留着续跑状态。"""
        import os
        self.service.prepare()
        stale = time.time() - 7200
        names = {
            # 处理规则已做完，失败的是已撤下的旧显示尺寸规则。
            '1': self.checkpoint('1', 'upgrade-library-processing-v2-1'),
            # 同一条规则还在等重试。
            '2': self.checkpoint('2', 'upgrade-library-processing-v2-2'),
            # 状态属于旧的文字规则，现在只剩处理规则在等。
            '3': self.checkpoint('3', 'upgrade-library-processing-v2-text-4-3'),
            # 回执队列里正排着这条规则的键。
            '4': self.checkpoint('4', 'upgrade-library-processing-v2-text-4-4'),
        }
        for path in self.service.root.iterdir():
            os.utime(path, (stale, stale))
        with self.database.write_transaction() as connection:
            upgrade_repairs.upsert_items(connection, [
                {'rule': 'media:processing-v2', 'asset_id': 1, 'state': 'done'},
                {'rule': 'media:display-dimensions-1', 'asset_id': 1, 'state': 'failed'},
                {'rule': 'media:processing-v2', 'asset_id': 2, 'state': 'failed'},
                {'rule': 'media:processing-v2', 'asset_id': 3, 'state': 'failed'}], mode='finish')
        receipt = upgrade_repairs._read(self.service.receipt)
        receipt['queued'] = {'upgrade-library:processing-v2:text-4:4': 1}
        self.service._save_receipt(receipt)
        self.service._prune_repair_checkpoints()
        kept = sorted(path.name for path in self.service.root.iterdir()
                      if path.name[0].isdigit())
        self.assertEqual(kept, sorted(names['2'] + names['4']))

    def test_a_film_finished_in_a_batch_drops_its_earlier_single_checkpoint(self):
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        for key in (1, 2):
            self.asset(key, duration=10)
        single = self.checkpoint('1', 'upgrade-library-processing-v2-1')
        other = self.checkpoint('2', 'upgrade-library-processing-v2-text-4-2')
        with patch('peach.library_processing.process_library', return_value={'status': 'complete'}), \
                patch.object(upgrade_repairs, 'mount_unreachable', return_value=False):
            upgrade_repairs._media_run(self.contract, 'upgrade-library:batch:processing-v2:1,2', Mock(run_id=None))
        self.assertEqual(sorted(path.name for path in self.service.root.iterdir()), sorted(other))
        self.assertFalse(any((self.service.root / name).exists() for name in single))

    def test_processing_state_files_that_only_grew_are_cleared_once(self):
        """本地证据缓存留状态还引用的；下载续跑状态留还在等的那部；整理批次日志留最近几份。"""
        import os
        from peach import organize
        stale = time.time() - 7200
        state = self.root / 'state'
        items = state / 'library-processing-items'
        items.mkdir(parents=True)
        for name in ('1-aaa.json', '2-bbb.json', '3-ccc.json'):
            (items / name).write_text('{}', encoding='utf-8')
        (state / 'library-processing.json').write_text(json.dumps(
            {'status': 'complete', 'local_metadata': {'1:x': str(items / '1-aaa.json')}}), encoding='utf-8')
        downloads = state / 'download-processing'
        downloads.mkdir()
        for main in (11, 12):
            (downloads / f'{main}.json').write_text('{}', encoding='utf-8')
            (downloads / f'{main}-items').mkdir()
            (downloads / f'{main}-items' / 'a.json').write_text('{}', encoding='utf-8')
        batches = organize.batch_log_dir(self.root / 'generated')
        batches.mkdir(parents=True)
        for day in range(1, 8):
            (batches / f'organize-2026010{day}-000000.json').write_text('{}', encoding='utf-8')
        for path in [*state.rglob('*'), *batches.iterdir()]:
            os.utime(path, (stale, stale))
        (items / '3-ccc.json').touch()  # 一小时内刚写的不碰
        self.asset(12)
        with self.database.write_transaction() as connection:
            connection.execute("INSERT INTO download_task(provider,source_uri,target,state,updated_at,postprocess_state,"
                               "asset_id) VALUES('115','x','/115','ingested','now','failed',12)")
        self.service._prune_processing_state()
        self.assertEqual(sorted(path.name for path in items.iterdir()), ['1-aaa.json', '3-ccc.json'])
        self.assertEqual(sorted(path.name for path in downloads.iterdir()), ['12-items', '12.json'])
        self.assertEqual(len(list(batches.iterdir())), 5)
        with self.database.read_connection() as connection:
            result = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                   (upgrade_repairs.PROCESSING_STATE_KEY,)).fetchone()[0])
        self.assertEqual(result, {'local_evidence': 1, 'download_states': 2, 'organize_batches': 2})

    def test_avatar_faces_are_backfilled_offline_and_retried_while_the_model_is_missing(self):
        from peach import avatar_face, repair_center
        with patch.object(avatar_face, 'backfill', return_value=None) as backfill:
            self.service._backfill_avatar_faces()
        probe = backfill.call_args.args[1]
        self.assertEqual(backfill.call_args.args[0], self.root / 'avatars')
        self.assertFalse(probe._allow_download)
        with self.database.read_connection() as connection:
            self.assertIsNone(connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                                 (upgrade_repairs.AVATAR_FACES_KEY,)).fetchone())
        with patch.object(avatar_face, 'backfill', return_value={'checked': 3, 'written': 2}):
            self.service._backfill_avatar_faces()
        with patch.object(avatar_face, 'backfill', return_value={'checked': 0, 'written': 0}) as again:
            self.service._backfill_avatar_faces()
        again.assert_called_once()
        with self.database.read_connection() as connection:
            stored = json.loads(connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                                   (upgrade_repairs.AVATAR_FACES_KEY,)).fetchone()[0])
            center = repair_center.snapshot(connection, {}, cloud_pending=0)
        self.assertEqual(stored, {'checked': 3, 'written': 2})
        self.assertEqual(next(item['changed'] for item in center['items'] if item['id'] == 'avatar-faces'), 2)

    def test_a_new_library_run_drops_local_evidence_its_state_does_not_reference(self):
        from peach.library_processing import prune_local_evidence
        path = self.root / 'state' / 'library-processing.json'
        items = path.parent / 'library-processing-items'
        items.mkdir(parents=True)
        for name in ('1-aaa.json', '2-bbb.json'):
            (items / name).write_text('{}', encoding='utf-8')
        self.assertEqual(prune_local_evidence(path, {'1:x': str(items / '1-aaa.json')}), 1)
        self.assertEqual([item.name for item in items.iterdir()], ['1-aaa.json'])
        self.assertEqual(prune_local_evidence(path, {}), 1)
        self.assertEqual(prune_local_evidence(self.root / 'absent.json', {}), 0)

    def test_local_evidence_the_cross_run_index_points_at_survives_a_new_run(self):
        """新一轮的状态从空开始，跨任务索引（#587）指着的证据与索引本身照样留着，其余收走。"""
        from peach.library_processing import prune_local_evidence
        path = self.root / 'state' / 'library-processing.json'
        items = path.parent / 'library-processing-items'
        items.mkdir(parents=True)
        for name in ('1-aaa.json', '2-bbb.json', '3-ccc.json'):
            (items / name).write_text('{}', encoding='utf-8')
        (items / 'index.json').write_text(json.dumps({'entries': {'1:x': ['stamp', '1-aaa.json']}}), encoding='utf-8')
        self.assertEqual(prune_local_evidence(path, {'2:y': str(items / '2-bbb.json')}), 1)
        self.assertEqual(sorted(item.name for item in items.iterdir()), ['1-aaa.json', '2-bbb.json', 'index.json'])
        (items / 'index.json').write_text('not json', encoding='utf-8')
        self.assertEqual(prune_local_evidence(path, {}), 2)
        self.assertEqual([item.name for item in items.iterdir()], ['index.json'])

    def test_a_new_text_rule_does_not_resume_completed_metadata_from_the_old_rule(self):
        from peach.settings_file import load_config
        self.contract.upgrade_config = load_config(environ={'PEACH_DATA_ROOT': str(self.root)})
        self.service.root.mkdir(parents=True)
        previous = {'job_id': 'upgrade-library-processing-v2-text-1-1',
                    'processing_rule': 'processing-v2', 'completed_metadata': ['asset:1']}
        (self.service.root / '1.json').write_text(json.dumps(previous), encoding='utf-8')
        with patch('peach.library_processing.process_library', return_value={'status': 'complete'}) as process:
            upgrade_repairs._media_run(self.contract, 'upgrade-library:processing-v2:text-2:1', Mock())
        self.assertIsNone(process.call_args.kwargs['resume_state'])

    def test_unsigned_sidecar_posters_are_scheduled_without_a_failed_probe_or_snapshot(self):
        self.asset(1, duration=20)
        posters = self.contract.candidate_root / 'posters'
        posters.mkdir(parents=True)
        poster = posters / '1_4.jpg'
        poster.write_bytes(b'legacy derived poster')
        with patch('peach.library_processing._people_allowed', return_value=False), patch(
                'peach.seed_followup.plan', return_value=[]), patch('peach.media_sources.cost_for', return_value='free'):
            batch = self.service._plan({'queued':{}})
        self.assertEqual([item.key for item in batch], ['upgrade-library:processing-v2:1'])
        self.assertEqual(poster.read_bytes(), b'legacy derived poster')

    def test_processing_rule_change_rechecks_completed_work_and_local_evidence(self):
        from peach import library_processing, upgrade_rules
        previous = {'processing_rule':'legacy', 'completed_previews':['asset:1'],
                    'completed_metadata':['asset:1'], 'local_metadata':{'asset:1':{'old':True}}}
        state = {'local_metadata':previous['local_metadata']}
        checkpoints = library_processing._LibraryCheckpoints(state, previous, self.database, self.database.db_path)
        self.assertEqual(checkpoints.completed, {'completed_previews':set(), 'completed_metadata':set()})
        self.assertEqual(state['local_metadata'], {})
        self.assertEqual(state['processing_rule'], upgrade_rules.PROCESSING)
        previous['processing_rule'] = upgrade_rules.PROCESSING
        checkpoints = library_processing._LibraryCheckpoints({}, previous, self.database, self.database.db_path)
        self.assertEqual(checkpoints.completed['completed_metadata'], {'asset:1'})


class LedgerActivationTests(unittest.IsolatedAsyncioTestCase):
    async def test_configured_reader_has_no_repair_service_even_without_sync_object(self):
        from peach import api, settings_file
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            config = settings_file.load_config(environ={'PEACH_DATA_ROOT':str(root)})
            settings_file.write(config)
            config = settings_file.load_config(environ={'PEACH_DATA_ROOT':str(root)})
            database = config.directory('database') / 'ledger.db'
            contract = SimpleNamespace(follow_state_root=root / 'state', db_path=database)
            with patch.object(settings_file, 'active', return_value=config), patch(
                    'peach.runtime_prepare.configured_ledger_writer', return_value=(False, '读取端')):
                service = api._configure_upgrade_repairs(SimpleNamespace(configured=True, db_path=database), contract, None)
            self.assertFalse(service.available)
            self.assertFalse(service.root.exists())

    async def test_pending_schema_migrates_in_the_background_after_the_service_starts_listening(self):
        from unittest.mock import AsyncMock
        from peach.api import _LedgerActivation
        app = SimpleNamespace(state=SimpleNamespace())
        settings = SimpleNamespace(configured=True, db_path=Path('unused.db'))
        contract = SimpleNamespace(upgrade_repairs=SimpleNamespace(error='', available=True))
        automatic, sharing = Mock(), Mock()
        activation = _LedgerActivation(app, settings, contract, (), automatic, sharing)
        release, seen = threading.Event(), []

        def migrate(_settings, _contract, _services, migration):
            seen.append(migration.state)
            release.wait(5)
            migration.state = 'idle'
            return True
        with patch('peach.api._installation_in_progress', return_value=False), patch(
                'peach.api._migration_pending', return_value=True), patch(
                'peach.api._start_ledger_services', side_effect=migrate), patch(
                'peach.api._warm_ledger_aggregates', new=AsyncMock()) as warm:
            self.assertFalse(await activation.start())
            self.assertTrue(app.state.ledger_migration.running)
            self.assertFalse(app.state.ledger_background_ready)
            release.set()
            await activation.task
        self.assertEqual(seen, ['running'])
        self.assertEqual(app.state.ledger_migration.payload(), {'state': 'idle'})
        self.assertTrue(app.state.ledger_background_ready)
        sharing.start.assert_called_once()
        warm.assert_awaited_once()
        await activation.stop()

    async def test_background_migration_failure_is_reported_and_workers_stay_stopped(self):
        from peach import interface_text
        from peach.api import _LedgerActivation
        app = SimpleNamespace(state=SimpleNamespace())
        settings = SimpleNamespace(configured=True, db_path=Path('unused.db'))
        contract = SimpleNamespace(upgrade_repairs=SimpleNamespace(error='', available=True))
        activation = _LedgerActivation(app, settings, contract, (), Mock(), Mock())

        def migrate(_settings, _contract, _services, migration):
            migration.fail(RuntimeError('disk full'))
            return False
        with patch('peach.api._installation_in_progress', return_value=False), patch(
                'peach.api._migration_pending', return_value=True), patch(
                'peach.api._start_ledger_services', side_effect=migrate):
            self.assertFalse(await activation.start())
            await activation.task
        payload = app.state.ledger_migration.payload()
        self.assertEqual(payload['state'], 'failed')
        self.assertFalse(app.state.ledger_background_ready)
        self.assertEqual(interface_text.text(f"server:{payload['message_code']}", payload['message_params'], 'en'),
                         "The local database couldn't be updated, so background tasks didn't start: disk full")
        await activation.stop()

    async def test_successful_retry_restarts_workers_once_after_prepare_failure(self):
        from peach.api import _LedgerActivation
        app = SimpleNamespace(state=SimpleNamespace())
        settings = SimpleNamespace(configured=True, db_path=Path('unused.db'))
        contract = SimpleNamespace(upgrade_repairs=SimpleNamespace(error=''))
        automatic, sharing = Mock(), Mock()
        activation = _LedgerActivation(app, settings, contract, (), automatic, sharing)
        with patch('peach.api._installation_in_progress', return_value=False), patch(
                'peach.api._start_ledger_services', side_effect=[False, True]) as start:
            self.assertFalse(await activation.start())
            self.assertTrue(await activation.resume())
            self.assertTrue(await activation.resume())
        self.assertEqual(start.call_count, 2)
        self.assertTrue(app.state.ledger_background_ready)
        automatic.start.assert_called_once()
        sharing.start.assert_called_once()
        await activation.stop()

