"""「设置 › 修复与迁移」：升级后的各项修复做了什么、改了多少、何时做的，以及等用户确认的项。

开销小、只改自动写入的值（用户手改的不动）的修复在升级后自动执行，这里只列结果；开销大或
可能改错的（例如逐部读取网盘视频）不自动做，在这里等用户确认后才执行。
数据只读本机升级回执（`upgrade-repairs/receipt.json`）与账本的 `ledger_upgrade_repair`；
关注快照清理的估算与进度由 `follow_evidence.Reclaim` 在后台算好交进来，rule34 补填的待问条数与进度由
`follow_backfill.Backfill` 交进来。

只列这台机器真碰到的项：馆藏里没有网盘视频、没有 NAS 系统目录、没有乱码人物的，对应那项不出现；
历史里没改动的那几次也不列。平台、媒体来源与馆藏的差别都落在这些读数上，不另按系统判断。
"""
from __future__ import annotations

import json
from pathlib import Path

from . import cover_repair, follow_backfill, follow_evidence, interface_text, legacy_repairs, system_file_repair
from .media_sources import CLOUD_LOCATIONS

#: 页面上的分组与组内顺序：按改动落在哪类数据上分，组名在 `settings:repairCenter.groups.<组>`。
#: 每一项的标题与一句说明在 `server:repairCenter.items.<id>`（ADR-0159），响应里同层的中文按 zh-CN 渲染。
GROUPS = (
    ('files', ('display-local', 'display-cloud', 'video-medium', 'quality-bands', 'system-files', 'sidecar-assets',
               'case-duplicates')),
    ('catalog', ('catalog', 'scrape-mark-titles', 'fc2-studios', 'resolution-tags', 'tag-vocabulary',
                 'dangling-candidates', 'cover-artwork')),
    ('people', ('garbled-people', 'avatar-faces', 'javdb-entries', 'entity-links', 'alias-flat-names',
                'unconfirmed-fc2-cast', 'descriptive-performers', 'code-folder-creators', 'r18-merges')),
    ('follow', ('rule34video-characters', 'rule34-details', 'bluray-duplicates', 'want-acquired', 'follow-evidence')),
    ('records', ('download-text', 'interface-text')),
)
#: 等用户确认才做的项：要读网盘（流量与网盘缓存）、删了不能恢复，或判据不是百分之百、要解除关联或合并实体
#: （`legacy_repairs.CONFIRMS`）。其余判据确定、只改自动写入的值、回执记着原值，升级后自动做。
CONFIRM = frozenset({'display-cloud', 'follow-evidence', *(rule.item for rule in legacy_repairs.CONFIRMS)})
#: `(id, 模式, 组)`，顺序就是页面的默认顺序。
ITEMS = tuple((item, 'confirm' if item in CONFIRM else 'auto', group) for group, items in GROUPS for item in items)
#: 组内先列要用户处理或正在进行的：等确认、在跑、要重试、排队、延后，然后才是做完的。
_STATE_ORDER = {'waiting': 0, 'running': 1, 'failed': 2, 'pending': 3, 'deferred': 4}
#: 历史里的规则：账本行 id 的前缀、计哪个字段（`None` 为资料整理的改动合计）。
#: 前缀去掉末尾的连字符就是规则 id，名字在 `server:repairCenter.history.<id>`。
RULES = (
    ('catalog-', None), ('verification-settlement-', ('applied',)), ('performer-spacing-', ('applied',)),
    ('enhancement-suffix-names-', ('aliases', 'terms', 'added_aliases')),
    ('fc2-seller-backfill-', ('entity_ids',)),
    ('code-sibling-identity-', ('links',)),
    ('feed-overflow-discoveries-', ('created',)),
    ('studio-unbounded-misses-', ('released',)), ('stale-filename-codes-', ('cleared',)),
    ('label-suffix-codes-', ('codes',)),
    ('dangling-candidates-', ('repinned', 'withdrawn')),
    ('javdb-actor-records-', ('hidden', 'disabled_feeds')),
    ('source-resolution-tags-', ('tags',)),
    ('video-medium-', ('video',)),
    ('sidecar-assets-', ('removed',)),
    ('avatar-faces-', ('written',)),
    ('quality-resolution-', ('assets',)),
    ('interface-text-codes-', ('rows', 'attempts')),
    *((rule.prefix, ('changed',)) for rule in (*legacy_repairs.RULES, *legacy_repairs.CONFIRMS)),
    (follow_evidence.RECEIPT_PREFIX, ('files',)),
    *((job.prefix, ('changed',)) for job in follow_backfill.JOBS),
    (cover_repair.RECEIPT_PREFIX, ('judged', 'recropped', 'faces')),
)
#: 资料整理回执里不算「改动」的计数：重新探测、转人工与来源快照失效只是排队或让缓存重取，不是改了资料。
_NOT_CHANGES = ('probe_retry', 'text_review', 'text_snapshots_invalidated')


def _count(value) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, (list, tuple)):
        return len(value)
    if isinstance(value, dict):
        return sum(_count(item) for item in value.values() if not isinstance(item, (str, type(None))))
    return 0


def _latest(rows, key):
    for _, _, result in rows:
        if key in result:
            return result[key]
    return None


def _receipt_fact(rows, prefix: str, *fields: str) -> dict:
    """按账本行 id 前缀取最新一次补修回执：有就是做完了，`changed` 为这几个字段的条数合计。"""
    result = next((result for row_id, _, result in rows if row_id.startswith(prefix)), {})
    return {'state': 'done' if result else 'none', 'changed': sum(_count(result.get(field)) for field in fields)}


def _touched(fact: dict) -> bool:
    """这台机器上这一项有没有事：在跑、等确认、失败，或者确实改了、补测了东西。"""
    if fact['state'] in ('running', 'waiting', 'failed', 'pending', 'deferred'):
        return True
    return bool(fact.get('changed') or fact.get('total') or fact.get('included'))


def _backups(value, directories) -> list[dict]:
    """回执里记下的写入前备份（`backup` 字段，可能嵌在各项补修里），以及它还在不在。

    这些备份和「账本备份」是同一批文件、同一套保留规则：还在的能从那里恢复，
    清退了的照实写已清理，撤回只能靠逐行回执。"""
    found = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key == 'backup' and isinstance(item, str) and item:
                name = Path(item).name
                found.append({'name': name, 'exists': any((folder / name).is_file() for folder in directories)})
            else:
                found += _backups(item, directories)
    return found


def _history(rows, backup_directories) -> list[dict]:
    """历史记录：认得的规则里确实改了东西的那几次，连同修复前的备份还在不在。"""
    history = []
    for row_id, applied_at, result in rows:
        rule = next((rule for rule in RULES if row_id.startswith(rule[0])), None)
        if rule is None:
            continue
        if rule[1] is None:
            changed = _count({key: value for key, value in result.get('local', {}).get('changed', {}).items()
                              if key not in _NOT_CHANGES})
        else:
            changed = sum(_count(result.get(key)) for key in rule[1])
        if not changed:
            continue
        backups = list({row['name']: row for row in _backups(result, backup_directories)}.values())
        rule_id = rule[0].rstrip('-')
        history.append({'id': row_id, 'rule': rule_id, 'title': interface_text.text(f'server:repairCenter.history.{rule_id}'),
                        'at': applied_at, 'changed': changed, 'backups': backups})
    return history


def _follow_evidence(status: dict | None, rows) -> dict:
    """关注快照清理：在删就报进度，估算出有可删的就等确认，删过且没剩下的报上一次删了多少。"""
    status = status or {}
    phase = status.get('phase')
    if phase == 'running':
        return {'state': 'running', 'done': status.get('done', 0), 'total': status.get('total', 0)}
    if phase == 'failed':
        return {'state': 'failed', 'error': status.get('error', '')}
    if phase == 'estimating':
        return {'state': 'waiting', 'estimating': True}
    if phase == 'ready' and status.get('files'):
        return {'state': 'waiting', 'files': status['files'], 'bytes': status.get('bytes', 0)}
    last = next((result for row_id, _, result in rows if row_id.startswith(follow_evidence.RECEIPT_PREFIX)), None)
    return {'state': 'done', 'changed': _count(last.get('files'))} if last else {'state': 'none'}


def _cover_artwork(status: dict | None, rows) -> dict:
    """封面补修：在做就报进度，估算出有待处理的封面就报排队（服务起来后自动开工），做过且没剩下的报上一次改了多少张。"""
    status = status or {}
    phase = status.get('phase')
    if phase == 'running':
        return {'state': 'running', 'done': status.get('done', 0), 'total': status.get('total', 0)}
    if phase == 'failed':
        return {'state': 'failed', 'error': status.get('error', '')}
    if phase == 'estimating':
        return {'state': 'pending', 'estimating': True}
    if phase == 'ready' and status.get('covers'):
        return {'state': 'pending', 'covers': status['covers']}
    last = next((result for row_id, _, result in rows if row_id.startswith(cover_repair.RECEIPT_PREFIX)), None)
    return ({'state': 'done', 'changed': sum(_count(last.get(key)) for key in ('judged', 'recropped', 'faces'))}
            if last else {'state': 'none'})


def _display_progress(connection) -> dict[bool, dict]:
    """显示尺寸补测按来源拆开的进度：`{是否网盘: {done, total, failed, deferred: {原因码: 部数}}}`。

    补测名单与完成状态都在 `ledger_upgrade_item`（迁移 0053），网盘补测确认后网盘视频并进同一条规则，
    表里不记哪部来自网盘，所以按资产现在的 `location` 分：本地那项只数本机与局域网，网盘那项只数网盘。
    资产已删除的按本地算。没有状态表的旧账本（读取端尚未同步迁移）按都没有算。
    延后的按处理器记下的原因码（`upgrade_repairs.DEFER_*`）分开数，旧版写下、没有原因的记在 `''` 下。
    延后到期重派出去的行（`queued`，原因码还在）照旧算延后：整盘掉线时每 30 分钟就要重派一轮，
    不这么算页面会在「进行中」和「已延后」之间来回跳；重派后读到了，处理器写完成时摘掉原因码。
    `failed` 只数等用户点重试的失败，退避中的失败到时间会自己重派，和待办一起算在进行中。"""
    import sqlite3
    from .display_dimensions_repair import ITEM_RULE
    cloud = f"a.location IN ({','.join('?' * len(CLOUD_LOCATIONS))})" if CLOUD_LOCATIONS else '0'
    split = {flag: {'done': 0, 'total': 0, 'failed': 0, 'deferred': {}} for flag in (False, True)}
    reason = "json_extract(i.result_json, '$.deferred')"
    try:
        rows = connection.execute(
            f"SELECT coalesce({cloud}, 0), CASE WHEN i.state='failed' AND i.retry_at IS NOT NULL THEN 'retry'"
            f" WHEN i.state='queued' AND {reason} IS NOT NULL THEN 'deferred' ELSE i.state END,"
            f" CASE WHEN i.state IN ('deferred', 'queued') THEN coalesce({reason}, '') END, count(*)"
            " FROM ledger_upgrade_item i LEFT JOIN asset a ON a.id=i.asset_id WHERE i.rule=?"
            " GROUP BY 1, 2, 3", (*CLOUD_LOCATIONS, ITEM_RULE)).fetchall()
    except sqlite3.OperationalError:
        return split
    for is_cloud, state, reason, count in rows:
        part = split[bool(is_cloud)]
        part['total'] += count
        if state in ('done', 'failed'):
            part[state] += count
        elif state == 'deferred':
            part['deferred'][reason] = part['deferred'].get(reason, 0) + count
    return split


def _display_state(progress: dict) -> dict:
    """一项补测现在的状态与读数。还有在排、在跑或退避中的才算进行中；
    没做完的只剩延后就报延后，只剩等用户重试的失败就报失败，不再一律写「进行中」。"""
    done, total, failed, deferred = progress['done'], progress['total'], progress['failed'], progress['deferred']
    if not total:
        return {'state': 'none', 'done': 0, 'total': 0}
    active = total - done - failed - sum(deferred.values())
    state = ('done' if done >= total else 'running' if active > 0 else 'deferred' if deferred else 'failed')
    return {'state': state, 'done': done, 'total': total,
            **({'deferred': deferred} if deferred else {}), **({'failed': failed} if failed else {})}


def _display_cloud(pending: int, included: bool, progress: dict) -> dict:
    """网盘补测：确认前等确认，不画进度；确认后报这一批做到哪里。

    待补测数连同名单里还没测的网盘片：早期版本准备名单时没排除网盘，那批片子在名单里却没有确认记录，
    在用户看来同样还没开始。"""
    if not included:
        waiting = pending + progress['total'] - progress['done']
        return {'state': 'waiting' if waiting else 'none', 'pending': waiting, 'included': False}
    fact = _display_state(progress)
    if not fact['total']:
        fact = {'state': 'done'}
    return {**fact, 'pending': 0, 'included': True}


def _backfill(status: dict | None, rows, prefix: str) -> dict:
    """联网补填（升级后自动在后台跑）：在跑就报进度；还剩待问条目的排着等下次启动，缺凭据的报原因；
    没有了报上一次改了几处。"""
    status = status or {}
    if status.get('phase') == 'running':
        return {'state': 'running', 'done': status.get('done', 0), 'total': status.get('total', 0)}
    last = _receipt_fact(rows, prefix, 'changed')
    if status.get('pending'):
        return {'state': 'failed' if status.get('error') else 'pending', 'pending': status['pending'],
                'online': True, 'changed': last['changed'], **({'error': status['error']} if status.get('error') else {})}
    return last


def _confirmed(rows, prefix: str, pending: int) -> dict:
    """等确认的存量修正：还有要改的就等确认（`pending` 是几处），没有了报上一次改了几处。"""
    last = _receipt_fact(rows, prefix, 'changed')
    if pending:
        return {'state': 'waiting', 'pending': pending, 'changed': last['changed'], 'backed_up': True}
    return last


def snapshot(connection, receipt: dict, *, cloud_pending: int, backup_directories=(),
             follow_evidence_status: dict | None = None, confirm_pending: dict | None = None,
             follow_backfill_status: dict | None = None, cover_repair_status: dict | None = None) -> dict:
    rows = sorted(((row[0], float(row[1] or 0), json.loads(row[2] or '{}')) for row in connection.execute(
        'SELECT id, applied_at, result_json FROM ledger_upgrade_repair')), key=lambda row: row[1], reverse=True)
    local = receipt.get('local', {})
    display = receipt.get('display_dimensions_v2', {})
    progress = _display_progress(connection)
    included = bool(display.get('cloud_included_at'))
    isolated = _latest(rows, system_file_repair.RULE) or {}
    garbled = _latest(rows, 'garbled_people') or {}
    facts = {
        'catalog': {'state': local.get('state') or ('done' if local else 'none'),
                    'changed': _count({key: value for key, value in local.get('changed', {}).items()
                                       if key not in _NOT_CHANGES})},
        'display-local': _display_state(progress[False]),
        'display-cloud': _display_cloud(cloud_pending, included, progress[True]),
        'system-files': {'state': 'done' if isolated else 'none', 'changed': _count(isolated.get('isolated'))},
        'garbled-people': {'state': 'done' if garbled else 'none', 'changed': _count(garbled.get('links'))},
        'dangling-candidates': _receipt_fact(rows, 'dangling-candidates-', 'repinned', 'withdrawn'),
        'javdb-entries': _receipt_fact(rows, 'javdb-actor-records-', 'hidden', 'disabled_feeds'),
        'resolution-tags': _receipt_fact(rows, 'source-resolution-tags-', 'tags'),
        'quality-bands': _receipt_fact(rows, 'quality-resolution-', 'assets'),
        'video-medium': _receipt_fact(rows, 'video-medium-', 'video'),
        'sidecar-assets': _receipt_fact(rows, 'sidecar-assets-', 'removed'),
        'avatar-faces': _receipt_fact(rows, 'avatar-faces-', 'written'),
        'interface-text': _receipt_fact(rows, 'interface-text-codes-', 'rows', 'attempts'),
        'follow-evidence': _follow_evidence(follow_evidence_status, rows),
        **{job.item: _backfill((follow_backfill_status or {}).get(job.item), rows, job.prefix)
           for job in follow_backfill.JOBS},
        **{rule.item: _receipt_fact(rows, rule.prefix, 'changed') for rule in legacy_repairs.RULES},
        **{rule.item: _confirmed(rows, rule.prefix, (confirm_pending or {}).get(rule.item, 0))
           for rule in legacy_repairs.CONFIRMS},
        'cover-artwork': _cover_artwork(cover_repair_status, rows),
    }
    items = [{'id': key, 'group': group, 'title': interface_text.text(f'server:repairCenter.items.{key}.title'),
              'summary': interface_text.text(f'server:repairCenter.items.{key}.summary'), 'mode': mode, **facts[key]}
             for key, mode, group in ITEMS if _touched(facts[key])]
    groups = [group for group, _ in GROUPS]
    items.sort(key=lambda item: (groups.index(item['group']), _STATE_ORDER.get(item['state'], len(_STATE_ORDER))))
    return {'items': items, 'history': _history(rows, backup_directories)}
