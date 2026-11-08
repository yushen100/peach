"""逐片补齐旧视频的 SAR 测量；只失效尺寸变化的派生预览。"""
import hashlib
import json
from pathlib import Path

from . import artifact_rules, media_probe, timeline_sheets, upgrade_rules
from .fsutil import atomic_write_text
from .media_sources import CLOUD_LOCATIONS, cost_for
from .platform import translate_ledger_path
from .media_identity import path_key
from .strm import skip_background_read
from .user_messages import UserValueError

RECEIPT_KEY = 'display_dimensions_v2'
IDENTITY_COLUMNS = 'id,location,path,size,mtime'
#: 每部要补测的片子在 `ledger_upgrade_item` 里的规则名；回执的 `RECEIPT_KEY` 只留规则、备份与网盘确认时间。
ITEM_RULE = f'display:{upgrade_rules.DISPLAY_DIMENSIONS_SAR}'
#: 旧版回执把这三份逐片字典整份记在回执里，升级时搬进状态表后从回执去掉。
LEGACY_FIELDS = ('dimensions', 'generations', 'completed')


def progress(connection) -> tuple[int, int]:
    """补测完成几部、一共几部。没有状态表的旧账本（读取端尚未同步迁移）按都没有算。"""
    import sqlite3
    try:
        row = connection.execute(
            "SELECT count(*), coalesce(sum(state='done'),0) FROM ledger_upgrade_item WHERE rule=?",
            (ITEM_RULE,)).fetchone()
    except sqlite3.OperationalError:
        return 0, 0
    return int(row[1]), int(row[0])


def generation(row) -> str:
    identity = [row['location'], path_key(row['path']), row['size'], row['mtime']]
    return hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode('utf-8')).hexdigest()[:24]


def task_key(row) -> str:
    return f'upgrade-library:{upgrade_rules.DISPLAY_DIMENSIONS_SAR}:{generation(row)}:{row["id"]}'


def collect(connection, *, cloud: bool = False) -> dict:
    """要补测的旧视频。网盘挂载默认不在内：逐部读文件头会撑大网盘客户端缓存、耗流量，
    收益只有少数非方形像素的片子；用户在「自动修复」里点「补测网盘视频」才加进来。"""
    places = ','.join('?' * len(CLOUD_LOCATIONS))
    condition = f"location IN ({places})" if cloud else f"location NOT IN ({places})"
    return {str(row['id']): [row['width'], row['height']] for row in connection.execute(
        "SELECT id,path,width,height FROM asset WHERE medium='video' AND disposal IS NULL "
        f"AND duration>0 AND width>0 AND height>0 AND {condition}", tuple(CLOUD_LOCATIONS))
        if not skip_background_read(row['path'])}


def _invalidate(contract, config, row) -> None:
    rule = upgrade_rules.DISPLAY_DIMENSIONS_SAR
    snapshot = translate_ledger_path(row['snapshot_path']) if row['snapshot_path'] else None
    if (snapshot is not None and contract.snapshot_root is not None
            and snapshot.is_relative_to(contract.snapshot_root) and snapshot.is_file()):
        artifact_rules.remember(snapshot, f'invalid:{rule}')
    root = Path(getattr(contract, 'timeline_root', Path(config.directory('generated')) / 'timeline'))
    meta = timeline_sheets.read_meta(root, row['id'])
    if meta:
        meta['invalidated_by'] = rule
        atomic_write_text(timeline_sheets.meta_path(root, row['id']), json.dumps(meta))


def _completed(connection, asset_id: int) -> dict | None:
    row = connection.execute("SELECT result_json FROM ledger_upgrade_item WHERE rule=? AND asset_id=? AND state='done'",
                             (ITEM_RULE, asset_id)).fetchone()
    if row is None:
        return None
    result = json.loads(row[0])
    result.pop('before', None)
    return result


def reprobe(contract, config, asset_id: int, *, checkpoint, expected_generation=None, run_id=None) -> dict:
    from .library_processing import _ffprobe_path
    from .upgrade_repairs import (MOUNT_RETRY_SECONDS, REVISION, RepairDeferred, mount_unreachable,
                                  upsert_items)

    with contract.database.read_connection() as connection:
        if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (REVISION,)).fetchone() is None:
            raise UserValueError('errors.displayDimensionsRepair.notPrepared')
        completed = _completed(connection, asset_id)
        row = connection.execute("SELECT * FROM asset WHERE id=? AND medium='video' AND disposal IS NULL",
                                 (asset_id,)).fetchone()
    if row is None or skip_background_read(row['path']):
        return {'changed': False, 'skipped': True}
    current_generation = generation(row)
    if expected_generation is not None and expected_generation != current_generation:
        return {'changed': False, 'skipped': True}
    if completed is not None and completed.get('generation') == current_generation:
        return completed
    if cost_for(row['location'], row['path'], config) != 'free':
        raise RepairDeferred('deferBilling', MOUNT_RETRY_SECONDS)
    ffprobe = _ffprobe_path(config)
    if not ffprobe:
        raise UserValueError('errors.displayDimensionsRepair.ffprobeMissing')
    if mount_unreachable(row['path']):
        raise RepairDeferred('deferMountDimensions', MOUNT_RETRY_SECONDS)
    checkpoint()
    measured = media_probe.measure(ffprobe, asset_id, row['path'])
    checkpoint()
    if measured[0] <= 0 or measured[1] <= 0 or measured[2] <= 0:
        # 测量途中掉线也是挂载的事，不按这部片失败结算。
        if mount_unreachable(row['path']):
            raise RepairDeferred('deferMountDimensions', MOUNT_RETRY_SECONDS)
        raise UserValueError('errors.displayDimensionsRepair.notMeasured')
    changed = (row['width'], row['height']) != tuple(measured[1:3])
    result = {'changed': changed, 'dimensions': list(measured[1:3]), 'generation': current_generation}
    # 测量和这部片的完成行同一事务提交；服务在任务结算前重启也不再读取成功的媒体。
    # 只写这一行，不再整份解析、重写回执。
    with contract.database.write_transaction() as connection:
        current = connection.execute('SELECT * FROM asset WHERE id=? AND disposal IS NULL', (asset_id,)).fetchone()
        if current is None or generation(current) != current_generation or any(
                current[key] != row[key] for key in media_probe.PROBED_COLUMNS):
            raise UserValueError('errors.displayDimensionsRepair.changedDuringRepair')
        if changed:
            _invalidate(contract, config, current)
        connection.execute('UPDATE asset SET width=?,height=?,ctx_orient=?,ctx_quality=? WHERE id=?',
                           (measured[1], measured[2], measured[7], measured[8], asset_id))
        upsert_items(connection, [{'rule': ITEM_RULE, 'asset_id': asset_id, 'generation': current_generation,
                                   'state': 'done', 'run_id': run_id, 'result': {**result, 'deferred': None}}],
                     mode='finish')
    return result
