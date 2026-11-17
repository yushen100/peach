"""版本化存量补修：本地事务、证据回执和有界后台派发。"""
from __future__ import annotations

import errno
import json
import logging
import re
import time
import threading
import sqlite3
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from filelock import FileLock, Timeout

from . import artifact_rules, composite_alias_repair, metadata_text_repair, r18_legacy_repair, upgrade_rules
from .field_owners import SCAN_FILENAME, is_protected, owner_of, write_owned_fields
from .followups import FollowupType, Attempts, attempts_root, register
from .fsutil import atomic_path, atomic_write_text
from .jobs import DiskSpaceDenied, JobPaused
from .migrations import sqlite_backup
from . import interface_text
from .task_outcomes import joined, part, render, said
from .task_runs import MAX_FOLLOWUPS, run_error, run_progress
from .task_stages import stage_code, stage_label
from .update_tasks import UpdateBusy
from .user_messages import UserRuntimeError, UserValueError, nested_message

LOGGER = logging.getLogger(__name__)
TASK_KEY = 'upgrade-repairs'
MEDIA_TASK = 'upgrade-library'
CATALOG_REVISION = ':'.join((upgrade_rules.CATALOG, upgrade_rules.PREVIEWS, upgrade_rules.PROCESSING,
                           str(upgrade_rules.PUBLIC_SNAPSHOTS), str(upgrade_rules.PROVIDER_EVIDENCE)))
REVISION = f'{CATALOG_REVISION}:text-{upgrade_rules.PROVIDER_TEXT}'


#: 本版派出的补修失败后按退避自动重派：10 分钟起翻倍，最长一天；连败五次后只等用户点重试。
RETRY_BASE_SECONDS = 600
RETRY_CAP_SECONDS = 86400
MAX_AUTO_RETRIES = 5
#: 派发线程的兜底复查。派出的后继跑完会回调叫醒、重派排在最早的 `retry_at`；文件换过、
#: 种子包更新、延后来源的费用设置改了这些没有本进程通知，靠它补上。
IDLE_RECHECK_SECONDS = 20 * 60
#: 两轮派发之间至少隔这么久：后继接连跑完时攒成一轮，不一条一轮。
ACTIVE_GAP_SECONDS = 30.0
#: 回执锁被占、更新闸门忙或派发出错时，隔这么久再试。
BUSY_RETRY_SECONDS = 60.0
#: 挂载不可达、来源冷却时这部片延后多久再派；不算失败，不计次数。
MOUNT_RETRY_SECONDS = 1800
COOLDOWN_RETRY_SECONDS = 3600


def retry_at(attempts: int, now: float) -> float | None:
    """第 `attempts` 次失败之后什么时候自动重派；超过次数是 None（只等用户重试）。"""
    if attempts > MAX_AUTO_RETRIES:
        return None
    return now + min(RETRY_BASE_SECONDS * 2 ** max(attempts - 1, 0), RETRY_CAP_SECONDS)


#: 延后原因码，记进状态表那一行的 `result_json.deferred`，「修复与迁移」按它写明在等什么。
DEFER_MOUNT, DEFER_COOLDOWN, DEFER_COST = 'mount', 'cooldown', 'cost'
#: 结论码（`RepairDeferred.code`）对应的延后原因码。
DEFER_REASONS = {'deferMountMedia': DEFER_MOUNT, 'deferMountDimensions': DEFER_MOUNT,
                 'deferCooling': DEFER_COOLDOWN, 'deferBilling': DEFER_COST}
#: 有了结论的行摘掉上次的延后原因（`json_patch` 里 null 即删键）。
_NOT_DEFERRED = {'deferred': None}


class RepairDeferred(Exception):
    """这部片这会儿补不了（挂载不可达、计费来源未确认、来源冷却），过 `retry_after` 秒再派。

    `code` 是结论里那一段原因（`task_outcomes`），异常文字按它渲染；延后原因码见 `DEFER_REASONS`。"""

    def __init__(self, code: str, retry_after: float):
        self.code = code
        super().__init__(render([part(code)]))
        self.retry_after = retry_after


class MalformedPath(UserValueError):
    """账本里的影片路径写法本身不对：翻译不出、含空字符或本机不认的字符。

    这不是挂载掉线，延后多少次也读不到，补修按失败结算并写明原因，等用户修好路径或重新扫描。"""


#: Windows 路径里盘符之后不能出现的字符。
_WINDOWS_ILLEGAL = frozenset('<>"|?*:')


def mount_unreachable(ledger_path: str) -> bool:
    """影片所在目录现在读不到：网盘或 NAS 掉线时补修延后，不按这部片失败结算。

    本机没挂载的来源（翻译到未映射根）照旧算读不到；路径写法本身不对时抛 `MalformedPath`。"""
    import os
    from .platform import is_unmapped, root_status, translate_ledger_path
    text = os.fspath(ledger_path or '')
    if chr(0) in text:
        raise MalformedPath('errors.upgradeRepairs.malformedPath', {'path': text.replace(chr(0), '?')})
    try:
        translated = translate_ledger_path(text)
    except ValueError as error:
        raise MalformedPath('errors.upgradeRepairs.malformedPathReason',
                            {'path': text, 'reason': nested_message(error)}) from None
    if is_unmapped(translated):
        return True
    if os.name == 'nt' and any(_WINDOWS_ILLEGAL & set(segment) for segment in translated.parts[1:]):
        raise MalformedPath('errors.upgradeRepairs.malformedPath', {'path': text})
    try:
        return root_status(translated.parent) != 'ok'
    except (OSError, ValueError):
        return True


class CapacityPaused(JobPaused, DiskSpaceDenied):
    """容量触线：整批已暂停（`pause_media`），这一条挂回队列等用户重试，不按失败结算。

    仍是 `DiskSpaceDenied`，调用方照旧认得出是容量；后继通道按 `JobPaused` 把它挂回待跑。
    """


_ITEM_SQL = {
    # 新加进补修的片子与旧回执搬进来的状态：已有的行不动。
    'seed': 'INSERT OR IGNORE INTO ledger_upgrade_item(rule,asset_id,generation,state,run_id,attempts,retry_at,'
            'result_json,updated_at) VALUES(:rule,:asset_id,:generation,:state,:run_id,:attempts,:retry_at,:result,:at)',
    # 派出去了。处理器可能抢在派发方记账之前就跑完并写了自己的结论，同一任务的行不覆盖。
    'dispatch': 'INSERT INTO ledger_upgrade_item(rule,asset_id,generation,state,run_id,updated_at) '
                "VALUES(:rule,:asset_id,:generation,'queued',:run_id,:at) ON CONFLICT(rule,asset_id) DO UPDATE SET "
                "state='queued',generation=excluded.generation,run_id=excluded.run_id,updated_at=excluded.updated_at "
                'WHERE ledger_upgrade_item.run_id IS NOT excluded.run_id',
    # 按任务终态结算；补测结果留着。
    'settle': 'INSERT INTO ledger_upgrade_item(rule,asset_id,generation,state,run_id,attempts,retry_at,updated_at) '
              'VALUES(:rule,:asset_id,:generation,:state,:run_id,:attempts,:retry_at,:at) '
              'ON CONFLICT(rule,asset_id) DO UPDATE SET state=excluded.state,generation=excluded.generation,'
              'run_id=excluded.run_id,attempts=excluded.attempts,retry_at=excluded.retry_at,'
              'updated_at=excluded.updated_at',
    # 处理器自己的结论：完成、延后。结果并进原有的那份（补测前的尺寸留着）。
    'finish': 'INSERT INTO ledger_upgrade_item(rule,asset_id,generation,state,run_id,retry_at,result_json,updated_at) '
              'VALUES(:rule,:asset_id,:generation,:state,:run_id,:retry_at,:result,:at) '
              'ON CONFLICT(rule,asset_id) DO UPDATE SET state=excluded.state,generation=excluded.generation,'
              'run_id=coalesce(excluded.run_id,ledger_upgrade_item.run_id),retry_at=excluded.retry_at,'
              'result_json=json_patch(ledger_upgrade_item.result_json,excluded.result_json),'
              'updated_at=excluded.updated_at',
}


def upsert_items(connection, rows, *, mode: str) -> None:
    """写 `ledger_upgrade_item`：升级补修每部片一行的状态，写法见 `_ITEM_SQL`。"""
    at = str(time.time())
    connection.executemany(_ITEM_SQL[mode], [
        {'rule': row['rule'], 'asset_id': int(row['asset_id']), 'generation': row.get('generation') or '',
         'state': row.get('state', 'pending'), 'run_id': row.get('run_id'), 'attempts': row.get('attempts', 0),
         'retry_at': row.get('retry_at'), 'result': json.dumps(row.get('result') or {}, ensure_ascii=False), 'at': at}
        for row in rows])


def item_of(key: str) -> tuple[str, int, str] | None:
    """影片补全的后继键对应状态表里哪一行：(规则, 影片, 文件世代)。不是影片补全的键是 None。"""
    from .display_dimensions_repair import ITEM_RULE
    if not key.startswith(MEDIA_TASK + ':') or batch_members(key) is not None:
        return None
    rest, _, asset_id = key[len(MEDIA_TASK) + 1:].rpartition(':')
    if not asset_id.isdigit() or not rest:
        return None
    if rest.startswith(upgrade_rules.DISPLAY_DIMENSIONS_SAR + ':'):
        return ITEM_RULE, int(asset_id), rest.rsplit(':', 1)[1]
    return f'media:{rest}', int(asset_id), ''


#: 一条影片补全后继处理几部片。逐部各跑一整套 `process_library`，每部都要整份读写
#: 十几 MB 的候选表；一批共用一次读取，整份写回按耗时节流摊薄。
BATCH_SIZE = 16
_BATCH_PREFIX = f'{MEDIA_TASK}:batch:'


def batch_members(key: str) -> tuple[str, list[int]] | None:
    """一批影片补全的键（`upgrade-library:batch:<规则>:<id,id,…>`）里的规则与影片。"""
    if not key.startswith(_BATCH_PREFIX):
        return None
    rule, _, ids = key[len(_BATCH_PREFIX):].rpartition(':')
    return rule, [int(asset_id) for asset_id in ids.split(',')]


def member_keys(key: str) -> list[str]:
    """后继键对应回执队列里的哪几个键：一批展开成每部片的键，其余原样。"""
    members = batch_members(key)
    if members is None:
        return [key]
    rule, ids = members
    return [f'{MEDIA_TASK}:{rule}:{asset_id}' for asset_id in ids]


def _batch_digest(key: str) -> str:
    import hashlib
    return hashlib.sha1(key.encode('utf-8')).hexdigest()[:16]


def _checkpoint_files(state_file: Path) -> list[Path]:
    """一份补修续跑状态在盘上的全部文件：状态文件、同名问题日志与 `<名>-items` 逐项检查点目录。"""
    return [state_file, state_file.with_suffix('.issues.jsonl'), state_file.with_name(state_file.stem + '-items')]


def _remove(path: Path) -> tuple[int, int]:
    """删一个文件或目录，返回删掉的文件数与字节数；删不掉的（被占用、已不在）跳过。"""
    import shutil
    try:
        if path.is_dir():
            files = [item for item in path.rglob('*') if item.is_file()]
            size = sum(item.stat().st_size for item in files)
            shutil.rmtree(path)
            return len(files), size
        size = path.stat().st_size
        path.unlink()
        return 1, size
    except OSError:
        return 0, 0


def discard_checkpoint(state_file: Path) -> None:
    """补修有了结论、续跑用不上了：删掉它的状态文件、问题日志和逐项检查点。

    完成的不会再跑；一批结算后延后的片子重派时编进新批次，换了键，旧检查点也认不上。
    延后与失败的单部补修不走这里：同一个键重派时还能接着上次的进度跑。"""
    for path in _checkpoint_files(state_file):
        _remove(path)


def _job_id(rule: str, asset_id) -> str:
    """状态表里这条影片规则（`media:<规则>`）下单部补修的任务号，续跑状态文件里记的就是它。"""
    return f'{MEDIA_TASK}:{rule[len("media:"):]}:{asset_id}'.replace(':', '-')


def _job_of(state_file: Path) -> str:
    """单部补修续跑状态里记的任务号；文件不在或读不出是空串。"""
    try:
        value = json.loads(state_file.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return ''
    return str(value.get('job_id') or '') if isinstance(value, dict) else ''


def _discard_settled(root: Path, rule: str, asset_ids) -> None:
    """这几部片在这条规则下有了结论：单部补修留下的续跑状态属于这条规则的，一并删掉。

    一部片先单部跑失败、后来编进一批跑完时，批次只删自己的状态，单部那份没人再删。
    """
    for asset_id in asset_ids:
        state_file = root / f'{asset_id}.json'
        if _job_of(state_file) == _job_id(rule, asset_id):
            discard_checkpoint(state_file)


def _batched(planned) -> list:
    """同一规则的影片补全按 `BATCH_SIZE` 合成一批；显示尺寸补测与资料后继不动。"""
    from .followups import Followup
    from .display_dimensions_repair import ITEM_RULE
    rows, groups = [], {}
    for row in planned:
        item = item_of(row.key) if row.task_key == MEDIA_TASK else None
        if item is None or item[0] == ITEM_RULE:
            rows.append(row)
            continue
        groups.setdefault(item[0].removeprefix('media:'), []).append((item[1], row))
    for rule, members in groups.items():
        for offset in range(0, len(members), BATCH_SIZE):
            chunk = members[offset:offset + BATCH_SIZE]
            if len(chunk) == 1:
                rows.append(chunk[0][1])
                continue
            ids = ','.join(str(asset_id) for asset_id, _ in chunk)
            first = dict(chunk[0][1].params).get('name') or chunk[0][1].label
            rows.append(Followup.coded(f'{_BATCH_PREFIX}{rule}:{ids}', MEDIA_TASK,
                                       run_progress('items', MEDIA_TASK, first=first, count=len(chunk))))
    return rows


#: 「这部片没有被别的影片补全占着」：同片有排着或被用户取消的非显示尺寸补全行时，规划器整片跳过
#: （`UpgradeRepairs._inherited_media`），派发判断也要跳过，否则这种片子每轮都触发一次空规划。
#: 参数是显示尺寸的规则名。子查询不关联外层，只算一次（主键以 rule 打头，按 asset_id 关联会逐行扫表）。
_NOT_HELD = ("item.asset_id NOT IN (SELECT asset_id FROM ledger_upgrade_item "
             "WHERE rule<>? AND state IN ('queued','cancelled'))")


def settled(row, generation: str | None, now: float) -> bool:
    """状态表里这一行说这部片这会儿不用派：做完了、用户取消了、在跑，或者还没到重派时间。

    `generation` 给了就只认同一文件世代的结论：文件换过的片子按新文件重做。
    `retry_at` 为空的失败只等用户在「自动修复」里点重试。
    """
    if row is None or (generation is not None and row['generation'] != generation):
        return False
    if row['state'] in ('done', 'cancelled', 'queued'):
        return True
    if row['state'] in ('failed', 'deferred'):
        return row['retry_at'] is None or float(row['retry_at']) > now
    return False


def prune_settled_failures(store, queued_run_ids) -> int:
    """清退结论已记进 `ledger_upgrade_item` 的影片补全失败行，返回删掉的行数。

    失败行只在结算之前有用：`_settle_queue` 读它的状态给状态表记结论，记完之后重派按那一行的
    `retry_at` 或用户点重试，任务中心里的这一行只剩历史。所以留下的只有两种：回执队列里还等
    结算的（`queued_run_ids`），和状态表里那部片还在等或在跑、指的正是这一行的（结算前的那一刻）。
    已撤下的旧规则（`display-dimensions-1`）与早已重派过的旧行都不在两者之中，一并清退。
    """
    if not getattr(store, 'enabled', False):
        return 0
    keep = {int(run_id) for run_id in queued_run_ids}
    with store.database.read_connection() as connection:
        rows = connection.execute(
            "SELECT id,followup_key FROM task_run WHERE task_key=? AND status IN ('failed','interrupted') "
            'AND followup_key IS NOT NULL', (MEDIA_TASK,)).fetchall()
        if not rows:
            return 0
        waiting = {(row[0], row[1]): row[2] for row in connection.execute(
            "SELECT rule,asset_id,run_id FROM ledger_upgrade_item WHERE state IN ('pending','queued')")}
    doomed = []
    for run_id, key in rows:
        if run_id in keep:
            continue
        members = [item_of(member) for member in member_keys(key)]
        if any(member is not None and waiting.get(member[:2]) == run_id for member in members):
            continue
        doomed.append(run_id)
    return store.delete_finished(doomed)


def _media_items(connection, *, rules=None, every=False) -> dict:
    """状态表里影片补全的行，键是 (规则, 影片)。

    规划只要显示尺寸的全部行（那是补测的目标集）与其余规则里有结论的行；`every` 连待办行也要。
    """
    from .display_dimensions_repair import ITEM_RULE
    sql = 'SELECT rule,asset_id,generation,state,run_id,attempts,retry_at FROM ledger_upgrade_item'
    if rules is not None:
        rules = sorted(rules)
        sql += f' WHERE rule IN ({",".join("?" * len(rules))})'
        arguments = rules
    elif not every:
        sql += " WHERE rule=? OR state<>'pending'"
        arguments = [ITEM_RULE]
    else:
        arguments = []
    return {(row['rule'], row['asset_id']): row for row in connection.execute(sql, arguments)}


def _read(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return {}
    if not isinstance(value, dict):
        raise UserValueError('errors.upgradeRepairs.invalidReceipt')
    return value


def _media_progress(state: dict, key: str, **params) -> dict:
    """「标题 · 阶段」「N 部影片 · 阶段」。阶段认得出 code 时整句带 code，认不出照原文。"""
    code = stage_code(state) if state.get('stage') else 'upgrade.updateMetadata'
    if code:
        return run_progress(key, stage=code, **params)
    label = interface_text.text(f'server:taskRun.progress.{key}', {**params, 'stage': state['stage']})
    return {'label': label, 'code': None, 'params': {}}


def _coded(code: str, params: dict | None = None, *, key: str = 'message') -> dict:
    """`<key>` 是 zh-CN 原文，旁边是 `<key>_code` 与 `<key>_params`（ADR-0159）。"""
    values = dict(params or {})
    return {key: interface_text.text(f'server:{code}', values), f'{key}_code': code, f'{key}_params': values}


def _paused_phrase(paused: dict) -> dict | str:
    """影片补全暂停回执里的那一句，作为另一句的参数。"""
    if paused.get('message_code'):
        return {'code': paused['message_code'], 'params': paused.get('message_params') or {}}
    return str(paused.get('message', ''))


def _title(row) -> str:
    """任务中心里这一条写哪部片：有番号写番号，没有就写文件名。"""
    return str(row['code'] or row['name'] or interface_text.text('server:labels.upgradeRepairs.video', {'id': row['id']}))


def _legacy_display_rows(display: dict) -> list[dict]:
    """旧版回执里逐片的补测目标、文件世代与完成结果，换成状态表的行。"""
    from .display_dimensions_repair import ITEM_RULE
    generations, completed = display.get('generations') or {}, display.get('completed') or {}
    rows = []
    for asset_id, before in (display.get('dimensions') or {}).items():
        result = completed.get(asset_id) or {}
        if result.get('generation'):
            rows.append({'rule': ITEM_RULE, 'asset_id': asset_id, 'generation': result['generation'],
                         'state': 'done', 'result': {'before': before, **result}})
        else:
            rows.append({'rule': ITEM_RULE, 'asset_id': asset_id, 'generation': generations.get(asset_id, ''),
                         'state': 'pending', 'result': {'before': before}})
    return rows


def _counts(connection) -> dict:
    return {table: connection.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
            for table in ('asset', 'entity', 'asset_tag')}


def _manual_name(connection, entity_id: int) -> bool:
    row = connection.execute('SELECT metadata_json FROM entity WHERE id=?', (entity_id,)).fetchone()
    try:
        metadata = json.loads(row[0] or '{}') if row else {}
        if not isinstance(metadata, dict):
            return True
        preference = metadata.get('name_preference', {})
    except (ValueError, TypeError):
        return True
    return (is_protected(preference.get('source')) if isinstance(preference, dict) else True) or bool(
        connection.execute("SELECT 1 FROM entity_alias WHERE entity_id=? AND source='user:preferred-name'",
                           (entity_id,)).fetchone())


#: 旧版从文件名误认的番号只清一次；清掉的行与原值记进同一条回执，可以按它整批撤回。
STALE_CODES_KEY = 'stale-filename-codes-1'
#: 出演者写法带空格的存量候选重判（`_settle_spaced_performers`）。
SPACED_PERFORMERS_KEY = 'performer-spacing-1'
#: 名字里视频增强模型代号的存量清理（`settle_enhancement_names`）。
ENHANCEMENT_NAMES_KEY = 'enhancement-suffix-names-1'
#: 卖家归属的存量补挂（`_backfill_fc2_sellers`）。
FC2_SELLERS_KEY = 'fc2-seller-backfill-1'
#: 同番号副本缺演员、创作者的存量补齐（`_inherit_code_siblings`）。
CODE_SIBLINGS_KEY = 'code-sibling-identity-1'


def settle_enhancement_names(connection) -> dict:
    """视频增强模型代号（`prob4`、`chf3`）在身份数据里的存量：只有代号的别名与搜索词删掉，
    规范名带代号后缀的补一个去掉后缀的别名。

    代号别名会把文件名带同样后缀的视频认到这个人名下，代号搜索词会拿 `prob4` 去发现页搜；
    删掉的行逐条记进回执，能原样插回。规范名不改：改规范名撤不回（`peach-ledger-write`），
    留给用户在资料页「统一名称」里选，补上的别名就是候选之一。
    """
    from .classification import is_enhancement_model, strip_enhancement_suffix
    from .entities import normalize_entity_name
    aliases = [dict(row) for row in connection.execute(
        'SELECT entity_id,alias,normalized_alias,source,confidence FROM entity_alias').fetchall()
        if is_enhancement_model(row['alias'])]
    terms = [dict(row) for row in connection.execute(
        'SELECT entity_id,term,purpose,source,created_at FROM entity_search_term').fetchall()
        if is_enhancement_model(row['term'])]
    for row in aliases:
        connection.execute('DELETE FROM entity_alias WHERE entity_id=? AND alias=?', (row['entity_id'], row['alias']))
    for row in terms:
        connection.execute('DELETE FROM entity_search_term WHERE entity_id=? AND term=? AND purpose=?',
                           (row['entity_id'], row['term'], row['purpose']))
    added = []
    for entity_id, name in connection.execute('SELECT id,canonical_name FROM entity').fetchall():
        stripped = strip_enhancement_suffix(name)
        if stripped == str(name).strip():
            continue
        connection.execute(
            'INSERT OR IGNORE INTO entity_alias(entity_id,alias,normalized_alias,source,confidence) VALUES(?,?,?,?,1.0)',
            (entity_id, stripped, normalize_entity_name(stripped), ENHANCEMENT_NAMES_SOURCE))
        if connection.execute('SELECT changes()').fetchone()[0]:
            added.append({'entity_id': entity_id, 'name': name, 'alias': stripped})
    return {'aliases': aliases, 'terms': terms, 'added_aliases': added}


def enhancement_names_pending(connection) -> bool:
    """`settle_enhancement_names` 有没有要改的，只读；有才先备份。"""
    from .classification import is_enhancement_model, strip_enhancement_suffix
    return (any(is_enhancement_model(row[0]) for row in connection.execute('SELECT alias FROM entity_alias'))
            or any(is_enhancement_model(row[0]) for row in connection.execute('SELECT term FROM entity_search_term'))
            or any(strip_enhancement_suffix(row[0]) != str(row[0]).strip()
                   for row in connection.execute('SELECT canonical_name FROM entity')))


#: 补上的「去掉代号后缀」别名的来源，撤回时按它认。
ENHANCEMENT_NAMES_SOURCE = 'upgrade:enhancement-suffix'


#: 永久删除后悬空的资料候选（#486）在 `ledger_upgrade_repair` 里的回执键；规则版本见 `upgrade_rules`。
DANGLING_KEY = f'dangling-candidates-{upgrade_rules.DANGLING_CANDIDATES}'

#: JavDB 演员页补记有碼／無碼（#271）的回执键；规则版本见 `upgrade_rules`。
JAVDB_RECORDS_KEY = f'javdb-actor-records-{upgrade_rules.JAVDB_ACTOR_RECORDS}'

#: 来源 genre 挂上的分辨率标签解除的回执键；规则版本见 `upgrade_rules`。
RESOLUTION_TAGS_KEY = f'source-resolution-tags-{upgrade_rules.SOURCE_RESOLUTION_TAGS}'


VIDEO_MEDIUM_KEY = f'video-medium-{upgrade_rules.VIDEO_MEDIUM}'
#: 附属文件删行（`_remove_sidecar_assets`）的回执键；规则版本见 `upgrade_rules`。
SIDECAR_ASSETS_KEY = f'sidecar-assets-{upgrade_rules.SIDECAR_ASSETS}'
#: 旧版永不清退的失败后继行（`_prune_failed_followups`）的回执键。
FAILED_FOLLOWUPS_KEY = 'failed-followups-1'
#: 处理任务积下的状态文件（`_prune_processing_state`）的回执键。
PROCESSING_STATE_KEY = 'processing-state-files-1'
#: 头像人脸记录补测（`_backfill_avatar_faces`）第一次做完时的回执键。
AVATAR_FACES_KEY = 'avatar-faces-1'


def misfiled_videos(connection) -> list[int]:
    """记成 other、按现行扩展名规则是视频的行；已处置的行与系统元数据不算。"""
    from .discovery_rules import system_path
    from .scan import medium_of
    return [row[0] for row in connection.execute(
        "SELECT id,name,path FROM asset WHERE medium='other' AND disposal IS NULL ORDER BY id")
        if medium_of(row[1]) == 'video' and not system_path(row[2])]


def javdb_card_pages(contract):
    """本机缓存过的 javdb 搜索页：回填脚本的整页缓存，和补女优资料后继的取页缓存。"""
    for path in sorted((Path(contract.entry_links_root) / 'directory-links' / 'javdb').glob('*.html')):
        try:
            yield path.read_text(encoding='utf-8', errors='replace')
        except OSError:
            continue
    for path in sorted((Path(contract.candidate_root) / 'provider-cache' / 'javdb-pages').glob('*.json')):
        try:
            body = json.loads(path.read_text(encoding='utf-8')).get('body')
        except (OSError, ValueError, AttributeError):
            continue
        if isinstance(body, str):
            yield body


def settle_javdb_records(connection, records: dict[str, bool]) -> dict:
    """给存量 javdb 演员 id 记下有碼还是無碼（`records` 取自本机缓存的搜索卡片）。

    记上之后，与署名 id 同类的按名字找到的 id 不再出入口（`entry_links.provider_ids`）；
    订阅新作已经订着那一页的源停用，不删：条目与发现记录留着，回执里的源 id 能原样启用回去。
    已记下的不改，缓存里没有卡的不猜。
    """
    from . import entry_links
    recorded, touched = [], set()
    for entity_id, external_id, raw in connection.execute(
            "SELECT entity_id,external_id,metadata_json FROM entity_external_ref "
            "WHERE provider='javdb' AND external_kind='performer' ORDER BY entity_id,external_id").fetchall():
        if external_id not in records:
            continue
        try:
            metadata = json.loads(raw or '{}')
        except ValueError:
            continue
        if not isinstance(metadata, dict) or isinstance(metadata.get('uncensored'), bool):
            continue
        metadata['uncensored'] = records[external_id]
        connection.execute("UPDATE entity_external_ref SET metadata_json=? WHERE provider='javdb' "
                           "AND external_kind='performer' AND external_id=?",
                           (json.dumps(metadata, ensure_ascii=False), external_id))
        recorded.append({'entity_id': entity_id, 'external_id': external_id, 'uncensored': records[external_id]})
        touched.add(entity_id)
    hidden, disabled = [], []
    for entity_id in sorted(touched):
        refs = [dict(row) for row in connection.execute(
            "SELECT provider,external_kind,external_id,metadata_json FROM entity_external_ref "
            "WHERE entity_id=? AND provider='javdb' AND external_kind='performer'", (entity_id,))]
        shown = set(entry_links.provider_ids(refs).get('javdb', []))
        for ref in refs:
            if ref['external_id'] in shown:
                continue
            hidden.append({'entity_id': entity_id, 'external_id': ref['external_id']})
            for (source_id,) in connection.execute(
                    'SELECT id FROM feed_source WHERE entity_id=? AND url=? AND enabled=1',
                    (entity_id, entry_links.javdb_actor_page(ref['external_id']))).fetchall():
                connection.execute('UPDATE feed_source SET enabled=0 WHERE id=?', (source_id,))
                disabled.append({'entity_id': entity_id, 'external_id': ref['external_id'], 'source_id': source_id})
    return {'rule': upgrade_rules.JAVDB_ACTOR_RECORDS, 'recorded': recorded, 'hidden': hidden,
            'disabled_feeds': disabled}


#: `revert_auto_landing.py --source` 认这条补修的归属串；批次是回执行的 id（`JAVDB_RECORDS_KEY`）。
JAVDB_RECORDS_SOURCE = 'upgrade:javdb-actor-records'


def planned_javdb_records_revert(connection, source: str, batch: str = '') -> list[dict]:
    """这条补修写下、现在还原样在账本里的记录类型与停用的订阅（ADR-0052 整批撤回），只读。

    按当前状态认：类型已被改成别的值、订阅已被重新启用或删掉的，不再列出。
    """
    if source != JAVDB_RECORDS_SOURCE:
        return []
    planned = []
    for receipt_id, encoded in connection.execute(
            "SELECT id,result_json FROM ledger_upgrade_repair WHERE id GLOB 'javdb-actor-records-*' "
            'ORDER BY CAST(applied_at AS REAL)').fetchall():
        if batch and receipt_id != batch:
            continue
        detail = json.loads(encoded)
        for row in detail.get('recorded', []):
            held = connection.execute(
                "SELECT json_extract(metadata_json,'$.uncensored') FROM entity_external_ref "
                "WHERE provider='javdb' AND external_kind='performer' AND external_id=? "
                "AND json_valid(metadata_json) AND json_type(metadata_json,'$.uncensored') IN ('true','false')",
                (row['external_id'],)).fetchone()
            if held is not None and bool(held[0]) == row['uncensored']:
                planned.append({'kind': 'record', **row, 'batch': receipt_id})
        for row in detail.get('disabled_feeds', []):
            if connection.execute('SELECT 1 FROM feed_source WHERE id=? AND enabled=0',
                                  (row['source_id'],)).fetchone():
                planned.append({'kind': 'feed', **row, 'batch': receipt_id})
    return planned


def revert_javdb_records(connection, planned: list[dict]) -> int:
    """按 `planned_javdb_records_revert` 去掉记下的类型、重新启用停掉的订阅，返回改了几行。

    不开不提交事务，由调用方包住。回执行留着，补修不会再做一遍。
    """
    changed = 0
    for item in planned:
        if item['kind'] == 'record':
            changed += connection.execute(
                "UPDATE entity_external_ref SET metadata_json=json_remove(metadata_json,'$.uncensored') "
                "WHERE provider='javdb' AND external_kind='performer' AND external_id=?",
                (item['external_id'],)).rowcount or 0
        else:
            changed += connection.execute('UPDATE feed_source SET enabled=1 WHERE id=? AND enabled=0',
                                          (item['source_id'],)).rowcount or 0
    return changed


#: 刮削落库写下的标签归属：单一来源整套写的 `javinizer:<来源>:tag`，并集补的 `auto:metadata-tags@<时间>`。
#: `stash` 导入与人手加的不在其内。
_SCRAPED_TAG_SOURCES = "(source GLOB 'javinizer:*:tag' OR source GLOB 'auto:metadata-tags@*')"


def settle_source_resolution_tags(connection) -> dict:
    """解除刮削按来源 genre 挂上的分辨率标签（`metadata_auto_apply.SOURCE_RESOLUTION_TAGS`）。

    JavDB、DMM、r18dev 的 `4K` 分类说的是官方出过 4K 版，手里这份文件多是 1080p；文件自己的
    画质由探测写进 `ctx_quality`，卡片与播放器读实际尺寸。只删刮削归属的行，`stash` 导入的
    和人手加的不动；扁平 `asset_tag` 与 `asset_entity` 两份一起删，原样记进回执供撤回插回。
    标签实体本身留着：别的来源还挂着它。
    """
    from .metadata_auto_apply import SOURCE_RESOLUTION_TAGS
    names = sorted(SOURCE_RESOLUTION_TAGS)
    marks = ','.join('?' * len(names))
    tags = [dict(zip(('asset_id', 'tag', 'confidence', 'source'), row)) for row in connection.execute(
        f'SELECT asset_id,tag,confidence,source FROM asset_tag WHERE tag IN ({marks}) AND {_SCRAPED_TAG_SOURCES} '
        'ORDER BY asset_id,tag,source', names)]
    links = [dict(zip(('asset_id', 'entity_id', 'role', 'source', 'confidence', 'metadata_json',
                       'first_seen_at', 'last_seen_at'), row)) for row in connection.execute(
        'SELECT ae.asset_id,ae.entity_id,ae.role,ae.source,ae.confidence,ae.metadata_json,ae.first_seen_at,'
        "ae.last_seen_at FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id WHERE ae.role='tag' "
        f"AND e.kind='tag' AND e.canonical_name IN ({marks}) AND {_SCRAPED_TAG_SOURCES.replace('source', 'ae.source')} "
        'ORDER BY ae.asset_id,ae.entity_id,ae.source', names)]
    connection.executemany('DELETE FROM asset_tag WHERE asset_id=? AND tag=? AND source=?',
                           [(row['asset_id'], row['tag'], row['source']) for row in tags])
    connection.executemany("DELETE FROM asset_entity WHERE asset_id=? AND entity_id=? AND role='tag' AND source=?",
                           [(row['asset_id'], row['entity_id'], row['source']) for row in links])
    return {'rule': upgrade_rules.SOURCE_RESOLUTION_TAGS, 'tags': tags, 'links': links}


#: `revert_auto_landing.py --source` 认这条补修的归属串；批次是回执行的 id（`RESOLUTION_TAGS_KEY`）。
RESOLUTION_TAGS_SOURCE = 'upgrade:source-resolution-tags'


def planned_resolution_tags_revert(connection, source: str, batch: str = '') -> list[dict]:
    """这条补修删掉、现在账本里还没有的标签行（ADR-0052 整批撤回），只读。"""
    if source != RESOLUTION_TAGS_SOURCE:
        return []
    planned = []
    for receipt_id, encoded in connection.execute(
            "SELECT id,result_json FROM ledger_upgrade_repair WHERE id GLOB 'source-resolution-tags-*' "
            'ORDER BY CAST(applied_at AS REAL)').fetchall():
        if batch and receipt_id != batch:
            continue
        detail = json.loads(encoded)
        for row in detail.get('tags', []):
            if not connection.execute('SELECT 1 FROM asset_tag WHERE asset_id=? AND tag=?',
                                      (row['asset_id'], row['tag'])).fetchone():
                planned.append({'kind': 'tag', 'row': row, 'batch': receipt_id})
        for row in detail.get('links', []):
            if not connection.execute('SELECT 1 FROM asset_entity WHERE asset_id=? AND entity_id=? AND role=?',
                                      (row['asset_id'], row['entity_id'], row['role'])).fetchone():
                planned.append({'kind': 'link', 'row': row, 'batch': receipt_id})
    return planned


def revert_resolution_tags(connection, planned: list[dict]) -> int:
    """按 `planned_resolution_tags_revert` 把删掉的标签行原样插回，返回插回几行。

    资产或标签实体已经不在的跳过。不开不提交事务，由调用方包住；回执行留着，补修不会再做一遍。
    """
    restored = 0
    for item in planned:
        row = item['row']
        if item['kind'] == 'tag':
            restored += connection.execute(
                'INSERT OR IGNORE INTO asset_tag(asset_id,tag,confidence,source) '
                'SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM asset WHERE id=?)',
                (row['asset_id'], row['tag'], row['confidence'], row['source'], row['asset_id'])).rowcount or 0
        else:
            restored += connection.execute(
                'INSERT OR IGNORE INTO asset_entity(asset_id,entity_id,role,source,confidence,metadata_json,'
                'first_seen_at,last_seen_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM asset WHERE id=?) '
                'AND EXISTS(SELECT 1 FROM entity WHERE id=?)',
                (row['asset_id'], row['entity_id'], row['role'], row['source'], row['confidence'],
                 row['metadata_json'], row['first_seen_at'], row['last_seen_at'], row['asset_id'],
                 row['entity_id'])).rowcount or 0
    return restored


def restore_dangling_candidates(database, candidate_root) -> dict:
    """按 `DANGLING_KEY` 的回执把悬空候选补修整批还原。

    改挂的行与决定改回旧编号，撤下的行与清掉的决定原样放回。之后又被处理任务改过的行照样
    按键改回；键已被别的行或决定占着的那几条跳过并计数。回执记下 `restored_at`，补修不再重做。
    """
    from .review_csv import read_rows, write_rows
    root = Path(candidate_root)
    with database.write_transaction() as connection:
        stored = connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                    (DANGLING_KEY,)).fetchone()
        if stored is None:
            raise UserValueError('errors.upgradeRepairs.noDanglingReceipt')
        receipt = json.loads(stored[0])
        if receipt.get('restored_at'):
            return {'rows': 0, 'decisions': 0, 'skipped': 0}
        files: dict[str, tuple[list[str], list[dict]]] = {}

        def rows_of(name: str, fallback: dict) -> list[dict]:
            if name not in files:
                rows = read_rows(root / name, missing_ok=True)
                files[name] = (list(rows[0] if rows else fallback), rows)
            return files[name][1]

        restored = skipped = 0
        for entry in receipt.get('withdrawn', []):
            rows = rows_of(entry['file'], entry['row'])
            if any(row['item_key'] == entry['row']['item_key'] for row in rows):
                skipped += 1
                continue
            rows.append(dict(entry['row']))
            restored += 1
        for entry in receipt.get('repinned', []):
            rows = rows_of(entry['file'], {})
            taken = entry['item_key'] != entry['new_item_key'] and any(
                row['item_key'] == entry['item_key'] for row in rows)
            index = next((index for index, row in enumerate(rows)
                          if row['item_key'] == entry['new_item_key']), None)
            if index is None or taken:
                skipped += 1
                continue
            rows[index] = {**rows[index], 'item_key': entry['item_key'], 'asset_id': str(entry['asset_id'])}
            restored += 1
        decisions = 0
        for decision in receipt.get('decisions', []):
            if decision.get('moved_to'):
                changed = connection.execute(
                    "UPDATE OR IGNORE review_decision SET item_key=? "
                    "WHERE category='metadata_fields' AND item_key=?",
                    (decision['item_key'], decision['moved_to'])).rowcount
            else:
                changed = connection.execute(
                    "INSERT OR IGNORE INTO review_decision(category,item_key,status,reviewer,note,updated_at) "
                    "VALUES('metadata_fields',?,?,?,?,?)",
                    (decision['item_key'], decision['status'], decision['reviewer'], decision['note'],
                     decision['updated_at'])).rowcount
            decisions += changed
            skipped += not changed
        receipt['restored_at'] = time.time()
        connection.execute('UPDATE ledger_upgrade_repair SET result_json=? WHERE id=?',
                           (json.dumps(receipt, ensure_ascii=False), DANGLING_KEY))
        for name, (header, rows) in files.items():
            write_rows(root / name, header, rows, atomic=True)
    return {'rows': restored, 'decisions': decisions, 'skipped': skipped}


def stale_filename_codes(connection) -> list[dict]:
    """旧版从文件名误认、现行规则已经不认的番号。

    实例是手机录像的时间戳（`VID_20220818_125735_816` 记成 `125735-816`）和被截断的「名字_日期」
    （个人投稿者的 `KUZU_250103` 记成 `KUZU-25010`）。这类行有了番号就被当成 JAV，日期式番号还会拿到
    「无码」徽章。只看无主或由文件名扫描写入的番号，且文件名与所在文件夹按现行规则都认不出番号；
    再满足下面一条才清：番号本身已不合现行形状；或番号没有完整出现在文件名与文件夹里，这一行也没有
    任何目录资料（标题、片商、发行日）。带资料的那类是刮削按另一份身份改过的（`1pon-092415-001-fhd2`
    实为 `092415_159`），不碰。
    """
    import re
    from pathlib import PureWindowsPath
    from .catalog_rules import compile_code_patterns, is_jav_code, normalise_code_key, release_code_from_filename
    from .profiles import read_settings
    patterns = compile_code_patterns(read_settings(connection).get('codePatterns'))
    rows = []
    for row in connection.execute(
            "SELECT id,name,path,code,field_owners,catalog_title,studio,release_date FROM asset "
            "WHERE medium='video' AND code IS NOT NULL AND code<>''"):
        owner = owner_of(row['field_owners'], 'code')
        if owner not in ('', SCAN_FILENAME):
            continue
        texts = (str(row['name'] or ''), PureWindowsPath(str(row['path'] or '')).parent.name)
        if any(release_code_from_filename(text, patterns=patterns) for text in texts):
            continue
        body = re.escape(normalise_code_key(row['code'])).replace(r'\-', '[-_ ]?')
        whole = any(re.search(rf'(?<![A-Za-z0-9]){body}(?![A-Za-z0-9])', text, re.I) for text in texts)
        described = row['catalog_title'] or row['studio'] or row['release_date']
        if not is_jav_code(row['code']) or (not whole and not described):
            rows.append({'id': row['id'], 'code': row['code']})
    return rows


#: 旧版截掉登记尾字母的番号改回一次（`truncated_suffix_codes`，#124）；改过的行与原值记进同一条回执。
SUFFIX_CODES_KEY = 'label-suffix-codes-1'


def truncated_suffix_codes(connection) -> list[dict]:
    """旧版截掉登记尾字母记下的番号：`IBW-483z.mp4` 记成 `IBW-483`。

    按截掉的写法问来源，回来的 `IBW-483z` 被身份闸拒掉，这些片一直没有资料，也就没有要撤的旧证据。
    只看扫描写入的番号，且现行规则从同一文件名认出的番号去掉登记尾字母后正好等于旧值；
    用户填的、刮削改过的、文件名对不上的一律不碰。
    """
    from .catalog_rules import compile_code_patterns, normalise_code_key, release_code_from_filename, without_label_suffix
    from .profiles import read_settings
    patterns = compile_code_patterns(read_settings(connection).get('codePatterns'))
    rows = []
    for row in connection.execute(
            "SELECT id,name,code,field_owners FROM asset WHERE medium='video' AND code IS NOT NULL AND code<>'' "
            'ORDER BY id'):
        if owner_of(row['field_owners'], 'code') != SCAN_FILENAME:
            continue
        expected = release_code_from_filename(row['name'] or '', patterns=patterns) or ''
        base = without_label_suffix(expected)
        if base and base == normalise_code_key(row['code']):
            rows.append({'id': row['id'], 'current': row['code'], 'target': expected})
    return rows


#: 撤过旧番号证据的影片按现番号重采时，补全任务键上的规则段。上一轮改回番号时已按
#: `processing-v2` 派过同一部片，键相同就会被当成派过而跳掉。
CODE_EVIDENCE_RULE = 'code-evidence-1'
CANDIDATE_FILE = 'library-metadata-field-candidates.csv'


def _split_by_code(row: dict, old: str, current: str) -> tuple[list[dict], dict | None]:
    """一行候选按旧、现番号拆开：撤下的候选，与改按现番号核身份的那一行（摘空了是 None）。"""
    from .metadata_auto_apply import _candidate_identifies_code
    try:
        choices = [choice for choice in json.loads(row.get('candidates_json') or '[]') if isinstance(choice, dict)]
    except ValueError:
        return [], row
    stale = [choice for choice in choices
             if _candidate_identifies_code(old, choice) and not _candidate_identifies_code(current, choice)]
    remaining = [choice for choice in choices if choice not in stale]
    if not remaining:
        return stale, None
    # 留下的候选按现番号核身份；`refresh_current_values` 也按这一栏找影片。
    return stale, {**row, 'code': current, 'query': current, 'source_count': len(remaining),
                   'candidates_json': json.dumps(remaining, ensure_ascii=False)}


def _orphan_snapshots(sources: Path, withdrawn: list[dict], codes) -> list[str]:
    """撤下的候选出自哪几份旧番号快照；库里还有影片是那部片的不算。"""
    from .catalog_rules import same_release_code
    snapshots = []
    pairs = {(row['code'], str(choice.get('source') or '')) for row in withdrawn for choice in row['candidates']}
    for old, source in sorted(pairs):
        path = sources / f'{old}-{source}.json'
        if (source and path.is_file() and not path.is_symlink()
                and not any(same_release_code(old, code) for code in codes)):
            snapshots.append(str(path))
    return snapshots


def stale_code_evidence(connection, candidates: Path, sources: Path) -> dict:
    """番号改过之后，旧番号下取到的资料候选和来源快照（#296）。

    `MCDV-24` 曾被补零成 `MCDV-024`，按它从 r18.dev 取回的是 2004 年的另一部片；番号改回之后，
    候选表那一行的 `code` 还写着旧番号，复核页按它核身份，那组资料就一直摆着。

    判据是候选级的：这一行记的番号与影片现番号不是同一部片（`same_release_code`），且这条
    候选认得旧番号、不认现番号。同一部片只是写法变了（`HEYZO-707` 改成 `HEYZO-0707`）的整行
    放过；两个番号都不认的候选身份不明，也放过。用户批准过的行候选与账本值都不动，那是人的
    结论，只把这一行的番号改成现番号：复核页按它核身份，按现番号重采回来的资料与批准值不同时，
    这一行会以差异重新摆出。旧番号的快照只在库里已没有任何影片还是那部片时失效：真有 2004 年
    那部 `MCDV-024` 的，快照是对的。
    """
    from .catalog_rules import same_release_code
    from .review_csv import read_rows
    rows = read_rows(candidates, missing_ok=True)
    codes = {row[0]: row[1] for row in connection.execute(
        "SELECT id,code FROM asset WHERE medium='video' AND disposal IS NULL AND code IS NOT NULL AND code<>''")}
    approved = {row[0] for row in connection.execute(
        "SELECT item_key FROM review_decision WHERE category='metadata_fields' AND status='approved'")}
    kept, withdrawn, held, changed = [], [], [], False
    for row in rows:
        old = str(row.get('code') or '').strip()
        asset_id = int(row['asset_id']) if str(row.get('asset_id') or '').isdigit() else 0
        current = codes.get(asset_id)
        if not old or not current or same_release_code(old, current):
            kept.append(row)
            continue
        changed = True
        if row['item_key'] in approved:
            held.append(row['item_key'])
            kept.append({**row, 'code': current, 'query': current})
            continue
        stale, rest = _split_by_code(row, old, current)
        if stale:
            withdrawn.append({'item_key': row['item_key'], 'asset_id': asset_id, 'code': old, 'target': current,
                              'candidates': stale})
        if rest is not None:
            kept.append(rest)
    return {'rows': kept if changed else None, 'withdrawn': withdrawn,
            'snapshots': _orphan_snapshots(sources, withdrawn, codes.values()),
            'approved_kept': held, 'asset_ids': sorted({row['asset_id'] for row in withdrawn})}


def _catalog_plan(connection, sources: Path, *, catalog: bool = True) -> dict:
    text = metadata_text_repair.collect(connection, sources / 'library-metadata')
    if not catalog:
        return {'codes':[], 'fields':[], 'names':[], 'aliases':[], 'text':text, 'catalog':False}
    from .catalog_rules import (compile_code_patterns, normalise_code_key, release_code_from_filename,
                                same_release_code)
    from .profiles import read_settings
    patterns = compile_code_patterns(read_settings(connection).get('codePatterns'))
    codes = []
    for row in connection.execute('SELECT id,name,code,field_owners FROM asset WHERE medium=\'video\''):
        if owner_of(row['field_owners'], 'code') != SCAN_FILENAME:
            continue
        expected = release_code_from_filename(row['name'] or '', patterns=patterns)
        # 同一部片、规范写法变了的也改：HEYZO 定宽四位后，旧的 `HEYZO-707` 规范化就是 `HEYZO-0707`（#354）。
        rewritten = row['code'] != expected == normalise_code_key(row['code'])
        if expected and row['code'] and (rewritten or not same_release_code(expected, row['code'])):
            codes.append({'id': row['id'], 'current': row['code'], 'target': expected})
    fields = r18_legacy_repair.collect(connection, sources / 'library-metadata')
    names = r18_legacy_repair.collect_entities(connection, sources / 'library-metadata',
                                              sources / 'metadata/javinizer-go')
    for row in names:
        if _manual_name(connection, row['entity_id']):
            row.update(action='skip', reason='manual-name')
    aliases = composite_alias_repair.collect(connection)
    for row in aliases:
        if is_protected(row['source']):
            row.update(verdict='review', note=interface_text.text('server:labels.upgradeRepairs.manualAliasKept'))
    return {'codes': codes, 'fields': fields, 'names': names, 'aliases': aliases,
            'text': text, 'catalog': True}


def _catalog_apply(connection, plan: dict) -> dict:
    if not plan.get('catalog', True):
        return {'codes':0, 'probe_retry':0, **metadata_text_repair.apply(connection, plan['text'])}
    from datetime import datetime, timezone
    changed = {}
    for row in plan['codes']:
        current = connection.execute('SELECT code,field_owners FROM asset WHERE id=?', (row['id'],)).fetchone()
        if current and current[0] == row['current'] and owner_of(current[1], 'code') == SCAN_FILENAME:
            write_owned_fields(connection, [row['id']], {'code': row['target']}, SCAN_FILENAME)
    changed['codes'] = len(plan['codes'])
    changed.update(r18_legacy_repair.apply_rows(connection, plan['fields']))
    stamp = datetime.now(timezone.utc).isoformat()
    names = [row for row in plan['names'] if not _manual_name(connection, row['entity_id'])]
    changed.update(r18_legacy_repair.apply_entity_rows(connection, names, stamp))
    fields = ('entity_id', 'field', 'value', 'source', 'parts')
    approved = {tuple(row[field] for field in fields) for row in plan['aliases'] if row['verdict'] == 'auto'}
    aliases = [row for row in composite_alias_repair.collect(connection)
               if tuple(row[field] for field in fields) in approved and not is_protected(row['source'])]
    changed.update(composite_alias_repair.apply_rows(connection, aliases))
    changed.update(metadata_text_repair.apply(connection, plan['text']))
    failed = connection.execute("SELECT id FROM asset WHERE medium='video' AND duration<=0 AND disposal IS NULL").fetchall()
    connection.execute("UPDATE asset SET duration=NULL WHERE medium='video' AND duration<=0 AND disposal IS NULL")
    changed['probe_retry'] = len(failed)
    return changed


def _stale_previews(contract, row):
    """本地配套海报和九宫格分别按所属规则校验。

    只看本机影片：影片补全只给本机影片重抽九宫格、重读配套海报。网盘影片的九宫格是
    `scripts/sheets.py` 抽的，没有规则签名，算它过期就每次换版都把整个网盘库派一遍，派完照旧过期。
    """
    from .media_processing_policy import metadata_only
    from .platform import translate_ledger_path
    if row['location'] != 'local':
        return False
    poster = Path(getattr(contract, 'poster_root', Path(contract.candidate_root) / 'posters')) / f'{row["id"]}_4.jpg'
    if poster.is_file() and not (artifact_rules.current(poster, source_required=True) or artifact_rules.current(
            poster, upgrade_rules.LOCAL_POSTERS, source_required=True)):
        return True
    snapshot = translate_ledger_path(row['snapshot_path']) if row['snapshot_path'] else None
    # SAR 补测只标记派生图过期；不能由此再自动安排整部影片的采集和重抽。
    if snapshot is not None and any(artifact_rules.current(snapshot, f'invalid:{rule}') for rule in (
            upgrade_rules.DISPLAY_DIMENSIONS, upgrade_rules.DISPLAY_DIMENSIONS_SAR)):
        return False
    return (snapshot is not None and contract.snapshot_root is not None
            and snapshot.is_relative_to(contract.snapshot_root) and not artifact_rules.current(snapshot)
            and not metadata_only(contract.follow_state_root))


class UpgradeRepairs:
    """一个数据目录一份回执；网络与媒体工作由现有任务通道执行。"""

    def __init__(self, contract, *, available: bool, config=None):
        self.contract, self.available = contract, available
        self.config = config
        self.error = ''
        #: `error` 那一句的 `{code, params}`（带 code 的异常），没有时是原文。
        self.error_phrase: dict | str = ''
        self.stopping = threading.Event()
        self.root = Path(contract.follow_state_root) / 'upgrade-repairs'
        self.scheduler = BackgroundScheduler(timezone='UTC', daemon=True)
        self._wake = threading.Event()
        #: 回执队列里派出、还没结算的后继任务 id；其中一条跑完就叫醒派发线程。
        self._watched: frozenset[int] = frozenset()
        self._listening = False
        #: 上一次判过「种子包不用派」时的指纹（`_seed_fingerprint`）；没变就不再整包读、算摘要。
        self._quiet_seed = None
        #: 这次启动里一次性规则共用的写入前备份，与领过它的规则数（`_upgrade_backup`）。
        self._backup: Path | None = None
        self._backup_claims = 0
        self._backup_lock = threading.Lock()

    def _upgrade_backup(self) -> Path:
        """一次性规则写账本前的整库备份：这次启动里第一条要写的规则备一份，后面的规则共用。

        每条规则各备一份时，一次升级接连写好几份几百 MB 的整库。共用的这份是第一条规则动手前
        的账本，按它恢复会连同之后各条规则的改动与回执一起退回，退回的规则下次启动重做，
        所以够撤回每一条。文件不在了（被清退或手动删了）就重备一份。
        """
        with self._backup_lock:
            if self._backup is None or not self._backup.is_file():
                backup = self.contract.db_path.with_name(f'ledger.pre-upgrade-{time.time_ns()}.db')
                sqlite_backup(self.contract.db_path, backup)
                self._backup = backup
            self._backup_claims += 1
            return self._backup

    def _release_upgrade_backup(self, backup: Path) -> None:
        """没用上备份的规则交回；只有它一家领过时删掉，别的规则的回执还指着它就留着。"""
        with self._backup_lock:
            self._backup_claims -= 1
            if self._backup_claims == 0 and self._backup == backup:
                backup.unlink(missing_ok=True)
                self._backup = None

    def _seed_fingerprint(self):
        """种子包派发判断的廉价指纹：包文件的修改时间与大小，加实体与种子导入记录的账本版本。

        派发完成后每分钟都要问一次「种子包要不要派」，整包 1.9 MB 读一遍、算摘要不划算。
        读不到账本版本（库还没迁移到 0038，或测试替身）时返回 None，照旧整包判断。
        """
        from . import seed_pack
        revision = getattr(self.contract, 'ledger_revision', None)
        revision = revision(('entity', 'seed_pack_history')) if revision is not None else None
        if revision is None:
            return None
        try:
            stat = Path(seed_pack.DEFAULT_PACK).stat()
        except FileNotFoundError:
            return (str(seed_pack.DEFAULT_PACK), None, None, revision)
        return (str(seed_pack.DEFAULT_PACK), stat.st_mtime_ns, stat.st_size, revision)

    def _seed_pending(self, connection) -> list:
        """种子包要派的后继；上次判过不用派、指纹也没变时直接答空。"""
        from . import seed_followup
        fingerprint = self._seed_fingerprint()
        if fingerprint is not None and fingerprint == self._quiet_seed:
            return []
        maximum = connection.execute('SELECT coalesce(max(id),0) FROM entity').fetchone()[0]
        seed = seed_followup.plan(connection, since_entity_id=maximum)
        self._quiet_seed = fingerprint if not seed else None
        return seed

    @property
    def receipt(self) -> Path:
        return self.root / 'receipt.json'

    def snapshot(self) -> dict:
        if not self.available:
            return {'state': 'unavailable', 'items': [], 'available': False}
        try:
            receipt = _read(self.receipt)
        except (OSError, ValueError, TypeError):
            return {'state': 'failed', 'items': [{'id': 'receipt', **_coded('labels.upgradeRepairs.item.receipt', key='label'),
                                                 'state': 'failed', **_coded('labels.upgradeRepairs.receiptUnreadable')}],
                    'available': True, **_coded('labels.upgradeRepairs.receiptRetry')}
        local = receipt.get('local', {})
        queued = receipt.get('queued', {})
        runs = self._run_states(queued.values())
        states = [runs.get(int(run_id)) for run_id in queued.values()]
        active = sum(state in ('pending', 'running') for state in states)
        failed = sum(state in ('failed', 'interrupted') for state in states)
        # 结算进状态表的失败与延后也要看得见：失败等用户决定，延后的到时间自己重派。
        settled_counts = self._item_counts()
        failed += settled_counts.get('failed', 0)
        waiting = settled_counts.get('deferred', 0)
        review = int(local.get('review_count', 0)) + len(receipt.get('deferred', []))
        paused = receipt.get('media_paused', {})
        # 只剩延后（挂载读不到、来源冷却、退避中）的报「已延后」：没有东西在跑，也不挡用户点重试。
        state = 'failed' if self.error or paused else 'running' if active else 'failed' if failed else (
            'deferred' if waiting else 'review' if review else
            'complete' if receipt.get('dispatch_complete') and local else 'pending')
        items = [{'id': REVISION, **_coded('labels.upgradeRepairs.item.existing', key='label'), 'state': local.get('state', 'pending'),
                  'changed': local.get('changed', {}), 'review_count': review},
                 {'id': 'background', **_coded('labels.upgradeRepairs.item.background', key='label'), 'state': state,
                  'pending': active, 'failed': failed, 'deferred': waiting, 'queued': len(queued)}]
        return {'state': state, 'items': items, 'available': self.available, **self._message(paused)}

    def _message(self, paused: dict) -> dict:
        """快照里那一句：派发出错或影片补全暂停的原因；`message` 是 zh-CN 原文，旁边带 code。"""
        if self.error:
            phrase = self.error_phrase
            return _coded(phrase['code'], phrase['params']) if isinstance(phrase, dict) else {'message': self.error}
        if paused.get('message_code'):
            return _coded(paused['message_code'], paused.get('message_params'))
        return {'message': paused.get('message', '')}

    def _item_counts(self) -> dict[str, int]:
        """状态表里等用户决定的失败、到时间会自己重派的（延后与退避中的失败）各几条。

        表还没建出来（迁移前）按没有算。
        """
        try:
            with self.contract.database.read_connection() as connection:
                return {row[0]: row[1] for row in connection.execute(
                    "SELECT CASE WHEN state='failed' AND retry_at IS NULL THEN 'failed' ELSE 'deferred' END,count(*) "
                    "FROM ledger_upgrade_item WHERE state IN ('failed','deferred') GROUP BY 1")}
        except sqlite3.OperationalError:
            return {}

    def _run_states(self, run_ids) -> dict[int, str]:
        """回执里这些任务现在的状态；已清退的不在结果里。

        回执的队列有上万条，逐条 `task_runs.get` 每条都新开一个连接，一轮要一分钟；
        按 900 个一批 `IN` 查（SQLite 默认绑定参数上限 999），上万条约 0.1 秒。
        """
        ids = sorted({int(run_id) for run_id in run_ids})
        states: dict[int, str] = {}
        if not ids:
            return states
        with self.contract.database.read_connection() as connection:
            for offset in range(0, len(ids), 900):
                batch = ids[offset:offset + 900]
                states.update((row[0], row[1]) for row in connection.execute(
                    f'SELECT id,status FROM task_run WHERE id IN ({",".join("?" * len(batch))})', batch))
        return states

    def prepare(self, *, retry_media=False) -> None:
        self._prepare_local()
        if not self.available or not self.contract.task_runs.enabled:
            return
        if not retry_media and _read(self.receipt).get('media_paused'):
            return
        from .jobs import DiskSpaceDenied
        try:
            with FileLock(str(self.receipt) + '.lock', timeout=0):
                self._prepare_display_dimensions()
        except DiskSpaceDenied as error:
            # 退出准备阶段的锁，再复用整批暂停；容量不足不关闭其他账本后台服务。
            self.pause_media(error)
            if retry_media:
                raise

    def _repair_feed_overflow(self) -> None:
        """旧版每轮新作限额截掉、只记成「已见」的历史新作补建一次壳（`feed_overflow_repair`）。

        和其余存量补修一样由调度器在服务起来后跑，失败只记日志、不挡后台服务；有要补的才先备份。
        """
        from . import feed_overflow_repair
        from .feeds import hidden_compilations
        from .profiles import read_settings
        try:
            with self.contract.database.read_connection() as connection:
                hidden = hidden_compilations(read_settings(connection))
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (feed_overflow_repair.RECEIPT_KEY,)).fetchone():
                    return
                planned = feed_overflow_repair.candidates(connection, hidden)
            backup = None
            if planned:
                backup = self.contract.db_path.with_name(f'ledger.pre-upgrade-{time.time_ns()}.db')
                sqlite_backup(self.contract.db_path, backup)
            with self.contract.database.write_transaction() as connection:
                result = feed_overflow_repair.repair(connection, hidden, backup=backup)
            if result is not None:
                LOGGER.info('Feed overflow history repair: recovered %s of %s candidates',
                            len(result['created']), result['candidates'])
        except Exception:
            LOGGER.exception('Feed overflow history repair failed')

    def _prepare_local(self) -> None:
        """服务恢复任务前应用本地确定性修复。"""
        if not self.available or not self.contract.task_runs.enabled:
            return
        self.root.mkdir(parents=True, exist_ok=True)
        with FileLock(str(self.receipt) + '.lock', timeout=0):
            contract = self.contract
            with contract.database.read_connection() as connection:
                applied = connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                              (REVISION,)).fetchone()
                prior = connection.execute(
                    'SELECT result_json,id FROM ledger_upgrade_repair WHERE id=? OR id GLOB ? '
                    'ORDER BY CAST(applied_at AS REAL) DESC LIMIT 1',
                    (CATALOG_REVISION, CATALOG_REVISION + ':text-*')).fetchone()
            if applied is not None:
                self._restore_receipt(json.loads(applied[0]))
                self._restore_suffix_codes()
                self._withdraw_stale_code_evidence()
                self._settle_dangling_candidates()
                self._settle_javdb_records()
                self._reclassify_videos()
                self._remove_sidecar_assets()
                self._settle_resolution_tags()
                self._settle_quality()
                self._convert_interface_text()
                self._isolate_system_files()
                self._settle_legacy()
                return
            self._restore_receipt(None)
            sources = Path(contract.follow_sources_root)
            previous = json.loads(prior[0]) if prior is not None else {}
            with contract.database.read_connection() as connection:
                plan = _catalog_plan(connection, sources, catalog=prior is None)
                before = _counts(connection)
                failed = [row[0] for row in connection.execute(
                    "SELECT id FROM asset WHERE medium='video' AND duration<=0 AND disposal IS NULL")] if prior is None else []
            atomic_write_text(self.root / 'catalog-review.json', json.dumps(plan, ensure_ascii=False, indent=2))
            backup = self._upgrade_backup()
            review = sum(row['reason'] not in ('already-original', 'already-japanese', 'manual-name')
                         and row['action'] not in ('replace', 'rename') for row in plan['fields'] + plan['names'])
            review += sum(row['verdict'] == 'review' for row in plan['aliases'])
            review += sum(row['action'] == 'review' for row in plan['text']['rows'])
            # 上一份回执的文字复核本轮已重新收集，只继承它的其余复核数。
            carried = previous.get('local', {})
            review += max(0, carried.get('review_count', 0) - carried.get('changed', {}).get('text_review', 0))
            with contract.database.write_transaction() as connection:
                violations = {tuple(row) for row in connection.execute('PRAGMA foreign_key_check')}
                changed = _catalog_apply(connection, plan)
                garbled = changed.pop(metadata_text_repair.RECEIPT_KEY)
                if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise UserRuntimeError('errors.upgradeRepairs.integrityFailed')
                if any(tuple(row) not in violations for row in connection.execute('PRAGMA foreign_key_check')):
                    raise UserRuntimeError('errors.upgradeRepairs.foreignKeyFailed')
                after = _counts(connection)
                receipt = {'revision': REVISION, 'local': {'state': 'succeeded', 'changed': changed,
                           'review_count': review, 'before': before, 'after': after, 'backup': str(backup)},
                           'text_media_ids': plan['text']['asset_ids'],
                           metadata_text_repair.RECEIPT_KEY: garbled,
                           'media_ids': sorted(set(failed + [row['id'] for row in plan['codes']]
                                                   + previous.get('media_ids', [])
                                                   + plan['text']['asset_ids'])),
                           'queued': dict(previous.get('queued', {})),
                           'deferred': list(previous.get('deferred', [])),
                           'code_media_ids': list(previous.get('code_media_ids', [])),
                           'media_paused': previous.get('media_paused', {}),
                           'dispatch_complete': bool(previous.get('dispatch_complete')) and not plan['text']['asset_ids'],
                           'text_only': prior is not None,
                           'prior_revision': prior[1] if prior else None}
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (REVISION, str(time.time()), json.dumps(receipt, ensure_ascii=False)))
            atomic_write_text(self.receipt, json.dumps(receipt, ensure_ascii=False))
            self._restore_suffix_codes()
            self._withdraw_stale_code_evidence()
            self._settle_dangling_candidates()
            self._settle_javdb_records()
            self._reclassify_videos()
            self._remove_sidecar_assets()
            self._settle_resolution_tags()
            self._settle_quality()
            self._convert_interface_text()
            self._isolate_system_files()
            self._settle_legacy()

    def _settle_legacy(self) -> None:
        """旧版本写下、按现行判据能确定改对的存量各补一次（`legacy_repairs.RULES`）。

        先只读把还没做过的几条算一遍，有要改的才领这次启动共用的写入前备份（`_upgrade_backup`），
        再逐条在各自的写事务里重算、改写、记回执，回执带这份备份。某条出错只记日志，其余照做，
        下次启动再试那一条。
        """
        from . import legacy_repairs
        try:
            with self.contract.database.read_connection() as connection:
                rules = legacy_repairs.pending(connection)
                planned = [rule for rule in rules if rule.find(connection)]
        except Exception:
            LOGGER.exception('Legacy repairs: planning failed')
            return
        backup = None
        if planned:
            try:
                backup = self._upgrade_backup()
            except Exception:
                LOGGER.exception('Legacy repairs: backup failed')
                return
        for rule in rules:
            try:
                with self.contract.database.write_transaction() as connection:
                    if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (rule.key,)).fetchone():
                        continue
                    found = rule.find(connection)
                    result = rule.fix(connection, found) if found else {'changed': 0}
                    if found and backup is not None:
                        result['backup'] = str(backup)
                    connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                       (rule.key, str(time.time()), json.dumps(result, ensure_ascii=False, default=str)))
            except Exception:
                LOGGER.exception('Legacy repair %s failed', rule.key)
                continue
            LOGGER.info('Legacy repair %s: changed %s', rule.key, result.get('changed', 0))

    def apply_confirmed(self, item: str) -> dict:
        """用户在「修复与迁移」确认的存量修正（`legacy_repairs.CONFIRMS`）：备份账本，在一个写事务里重算、
        改写，回执 id 是 `<前缀><时刻>`。返回回执；没有要改的返回 `{'changed': 0}` 且不写回执。"""
        from . import legacy_repairs
        rule = legacy_repairs.confirm_rule(item)
        if rule is None:
            raise UserValueError('api.configuration.repairUnknown', {'item': item})
        with self.contract.database.read_connection() as connection:
            if not rule.find(connection, self.contract):
                return {'changed': 0}
        backup = self.contract.db_path.with_name(f'ledger.pre-{rule.prefix}{time.time_ns()}.db')
        sqlite_backup(self.contract.db_path, backup)
        with self.contract.database.write_transaction() as connection:
            found = rule.find(connection, self.contract)
            result = rule.fix(connection, found, self.contract) if found else {'changed': 0}
            if found:
                result['backup'] = str(backup)
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (f'{rule.prefix}{time.time_ns()}', str(time.time()),
                                    json.dumps(result, ensure_ascii=False, default=str)))
        LOGGER.info('Confirmed repair %s: changed %s', item, result.get('changed', 0))
        return result

    def _prepare_display_dimensions(self) -> None:
        from . import display_dimensions_repair
        key = display_dimensions_repair.RECEIPT_KEY
        receipt = _read(self.receipt)
        display = receipt.get(key)
        if display is not None and not any(field in display for field in display_dimensions_repair.LEGACY_FIELDS):
            return
        rows = []
        with self.contract.database.read_connection() as connection:
            if display is None:
                previous = connection.execute(
                    "SELECT result_json FROM ledger_upgrade_repair WHERE json_extract(result_json,?)=? "
                    "ORDER BY CAST(applied_at AS REAL) DESC LIMIT 1",
                    (f'$.{key}.rule', upgrade_rules.DISPLAY_DIMENSIONS_SAR)).fetchone()
                legacy = connection.execute(
                    "SELECT result_json FROM ledger_upgrade_repair WHERE "
                    "json_extract(result_json,'$.display_dimensions.rule')=? "
                    "ORDER BY CAST(applied_at AS REAL) DESC LIMIT 1", (upgrade_rules.DISPLAY_DIMENSIONS,)).fetchone()
                if previous is None:
                    dimensions = display_dimensions_repair.collect(connection)
                    rows = self._display_targets(connection, dimensions)
        if display is None and previous is not None:
            display = json.loads(previous[0])[key]
        elif display is None:
            old = json.loads(legacy[0]) if legacy else receipt
            if 'display_dimensions' in old:
                receipt.setdefault('display_dimensions', old['display_dimensions'])
            backup = self.contract.db_path.with_name(f'ledger.pre-sar-{time.time_ns()}.db')
            self._backup_display_dimensions(backup)
            display = {'rule': upgrade_rules.DISPLAY_DIMENSIONS_SAR, 'backup': str(backup)}
        # 旧版回执的逐片字典搬进状态表（已有的行不动，重复搬是空操作），回执里只留规则与备份。
        rows += _legacy_display_rows(display)
        receipt[key] = {name: value for name, value in display.items()
                        if name not in display_dimensions_repair.LEGACY_FIELDS}
        with self.contract.database.write_transaction(notify=False) as connection:
            upsert_items(connection, rows, mode='seed')
        if self._display_due(receipt):
            receipt['dispatch_complete'] = False
        self._save_receipt(receipt)

    @staticmethod
    def _display_targets(connection, dimensions: dict) -> list[dict]:
        """要补测的片子写成状态表的待办行：补测前的尺寸记进结果，文件世代记当时的。"""
        from . import display_dimensions_repair as repair
        return [{'rule': repair.ITEM_RULE, 'asset_id': row['id'], 'generation': repair.generation(row),
                 'state': 'pending', 'result': {'before': dimensions[str(row['id'])]}}
                for row in connection.execute(
                    f'SELECT {repair.IDENTITY_COLUMNS} FROM asset WHERE id IN (SELECT value FROM json_each(?))',
                    (json.dumps([int(asset_id) for asset_id in dimensions]),))]

    def _backup_display_dimensions(self, backup):
        from .jobs import DiskSpaceDenied
        from .settings_file import load_config
        from .storage_budget import CapacityGuard
        config = self.config or getattr(self.contract, 'upgrade_config', None) or load_config()
        guard = CapacityGuard(config)
        with self.contract.database.read_connection() as connection:
            page_size = connection.execute('PRAGMA page_size').fetchone()[0]
            pages = connection.execute('PRAGMA page_count').fetchone()[0]
        guard.check(force=True, required_bytes=page_size * pages, destination=backup.parent)
        try:
            with atomic_path(backup) as temporary:
                sqlite_backup(self.contract.db_path, temporary, pages=256,
                              progress=lambda _status, remaining, _total: guard.check(
                                  force=True, required_bytes=page_size * remaining, destination=backup.parent))
        except (OSError, sqlite3.Error) as error:
            if (getattr(error, 'errno', None) == errno.ENOSPC or getattr(error, 'winerror', None) in (39, 112)
                    or getattr(error, 'sqlite_errorcode', None) == sqlite3.SQLITE_FULL):
                raise DiskSpaceDenied('errors.upgradeRepairs.displayBackupNoSpace') from error
            raise

    def _isolate_system_files(self) -> None:
        """旧系统元数据按路径规则隔离；回执保留原状态，媒体与关联行不动。"""
        from . import system_file_repair
        with self.contract.database.read_connection() as connection:
            stored = connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                        (REVISION,)).fetchone()
            receipt = json.loads(stored[0]) if stored else None
            if receipt is None or system_file_repair.RULE in receipt:
                return
            earlier = connection.execute(
                'SELECT result_json FROM ledger_upgrade_repair WHERE json_type(result_json,?) IS NOT NULL '
                'ORDER BY applied_at DESC LIMIT 1', (f'$."{system_file_repair.RULE}"',)).fetchone()
            if earlier:
                receipt[system_file_repair.RULE] = json.loads(earlier[0])[system_file_repair.RULE]
            else:
                rows = system_file_repair.collect(connection)
        if earlier:
            self._save_receipt(receipt)
            return
        backup = None
        if rows:
            backup = self._upgrade_backup()
        with self.contract.database.write_transaction() as connection:
            changed = system_file_repair.apply(connection, rows, time.time())
            receipt[system_file_repair.RULE] = {'isolated': changed, 'backup': str(backup) if backup else None}
            connection.execute('UPDATE ledger_upgrade_repair SET result_json=? WHERE id=?',
                               (json.dumps(receipt, ensure_ascii=False), REVISION))
        atomic_write_text(self.receipt, json.dumps(receipt, ensure_ascii=False))

    def _withdraw_stale_code_evidence(self) -> None:
        """撤掉旧番号下取到的候选与快照（`stale_code_evidence`），被撤的影片按现番号重采。

        每份回执做一次，在 `prepare` 里、处理任务恢复之前做：那时没有采集任务拿着候选表。
        撤下的候选原样记进回执的 `code_evidence`，快照只加失效标记、正文不动，都能按它整批还原。
        """
        from .library_processing import FIELDS
        from .review_csv import write_rows
        output = Path(self.contract.candidate_root) / CANDIDATE_FILE
        sources = Path(self.contract.follow_sources_root) / 'library-metadata'
        with self.contract.database.write_transaction() as connection:
            stored = connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                        (REVISION,)).fetchone()
            receipt = json.loads(stored[0]) if stored else None
            if receipt is None or 'code_evidence' in receipt:
                return
            plan = stale_code_evidence(connection, output, sources)
            if plan['rows'] is not None:
                write_rows(output, FIELDS, plan['rows'], atomic=True)
            for path in plan['snapshots']:
                artifact_rules.remember(Path(path), f'invalid:{CODE_EVIDENCE_RULE}')
            receipt['code_evidence'] = {'withdrawn': plan['withdrawn'], 'snapshots': plan['snapshots'],
                                        'approved_kept': plan['approved_kept']}
            if plan['asset_ids']:
                receipt['code_media_ids'] = sorted(set(receipt.get('code_media_ids', [])) | set(plan['asset_ids']))
                receipt['media_ids'] = sorted(set(receipt.get('media_ids', [])) | set(plan['asset_ids']))
                receipt['dispatch_complete'] = False
            connection.execute('UPDATE ledger_upgrade_repair SET result_json=? WHERE id=?',
                               (json.dumps(receipt, ensure_ascii=False), REVISION))
        atomic_write_text(self.receipt, json.dumps(receipt, ensure_ascii=False))
        if plan['withdrawn']:
            LOGGER.info('Metadata candidates under stale codes: withdrew %s rows, invalidated %s snapshots',
                        len(plan['withdrawn']), len(plan['snapshots']))

    def _settle_dangling_candidates(self) -> None:
        """永久删除后悬空的资料候选与复核决定（`stale_candidates.settle_dangling_rows`），只做一次。

        在 `prepare` 里、处理任务恢复之前做，那时没有采集任务拿着候选表。改挂的行连同决定
        换成新编号；撤下的行原样、清掉的决定整行记进回执，`restore_dangling_candidates` 按它还原。
        出错只记日志：读不了候选表不该挡住服务启动，下次启动再试。
        """
        try:
            self._settle_dangling_candidates_once()
        except Exception:
            LOGGER.exception('Dangling metadata candidate repair failed')

    def _settle_dangling_candidates_once(self) -> None:
        from .review_csv import write_rows
        from .stale_candidates import metadata_candidate_files, settle_dangling_rows
        with self.contract.database.read_connection() as connection:
            if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (DANGLING_KEY,)).fetchone():
                return
        files = metadata_candidate_files(self.contract.candidate_root)
        with self.contract.database.write_transaction() as connection:
            plan = settle_dangling_rows(connection, files)
            moved = {row['item_key']: row['new_item_key'] for row in plan['repinned']}
            existing = {row[0] for row in connection.execute('SELECT id FROM asset')}
            decisions = []
            for row in connection.execute(
                    "SELECT item_key,status,reviewer,note,updated_at FROM review_decision "
                    "WHERE category='metadata_fields' AND item_key GLOB 'asset:[0-9]*:*'").fetchall():
                asset_id = row[0].split(':')[1]
                if asset_id.isdigit() and int(asset_id) not in existing:
                    decisions.append({'item_key': row[0], 'status': row[1], 'reviewer': row[2],
                                      'note': row[3], 'updated_at': row[4], 'moved_to': moved.get(row[0])})
            for decision in decisions:
                if decision['moved_to']:
                    connection.execute("UPDATE review_decision SET item_key=? "
                                       "WHERE category='metadata_fields' AND item_key=?",
                                       (decision['moved_to'], decision['item_key']))
                else:
                    connection.execute("DELETE FROM review_decision WHERE category='metadata_fields' "
                                       "AND item_key=?", (decision['item_key'],))
            result = {'rule': upgrade_rules.DANGLING_CANDIDATES, 'repinned': plan['repinned'],
                      'withdrawn': plan['withdrawn'], 'decisions': decisions}
            connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                               (DANGLING_KEY, str(time.time()), json.dumps(result, ensure_ascii=False)))
            # 候选件在事务里写，写不成整个事务回滚、下次启动重做（`_withdraw_stale_code_evidence` 同一做法）。
            for path, (header, rows) in plan['files'].items():
                write_rows(path, header, rows, atomic=True)
        LOGGER.info('Dangling metadata candidates: repinned %s rows, withdrew %s rows, repinned or cleared %s decisions',
                    len(plan['repinned']), len(plan['withdrawn']), len(decisions))

    def _settle_javdb_records(self) -> None:
        """存量 javdb 演员 id 补记有碼／無碼（`settle_javdb_records`），只做一次。

        只读本机缓存、不出网；缓存不在的部署没有可记的，照样记一条空回执，不再每次启动重扫。
        出错只记日志：缓存读不了不该挡住服务启动，下次启动再试。
        """
        from . import javdb
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (JAVDB_RECORDS_KEY,)).fetchone():
                    return
            records = javdb.card_records(javdb_card_pages(self.contract))
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (JAVDB_RECORDS_KEY,)).fetchone():
                    return
                result = settle_javdb_records(connection, records)
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (JAVDB_RECORDS_KEY, str(time.time()), json.dumps(result, ensure_ascii=False)))
        except Exception:
            LOGGER.exception('JavDB actor page record type repair failed')
            return
        LOGGER.info('JavDB actor pages: recorded %s record types, stopped offering %s entries, disabled %s feeds',
                    len(result['recorded']), len(result['hidden']), len(result['disabled_feeds']))

    def _remove_sidecar_assets(self) -> None:
        """旧扫描登记成作品的 NFO、海报、剧照与截图缩略图从账本删行（`sidecar_asset_repair`），只做一次。

        盘上文件不动、不进回收站（理由见 `sidecar_asset_repair`）。有要删的才先备份；删掉的行与引用
        整行记进回执，`sidecar_asset_repair.restore` 按它插回。在 `prepare` 里、任务恢复之前做，
        那时没有处理任务拿着这些行。出错只记日志，下次启动再试。
        """
        from . import sidecar_asset_repair as repair
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (SIDECAR_ASSETS_KEY,)).fetchone():
                    return
                rows = repair.collect(connection)
            backup = self._upgrade_backup() if rows else None
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (SIDECAR_ASSETS_KEY,)).fetchone():
                    return
                removed = repair.apply(connection, rows)
                result = {'rule': upgrade_rules.SIDECAR_ASSETS, repair.REMOVED: removed}
                if backup is not None:
                    result['backup'] = str(backup)
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (SIDECAR_ASSETS_KEY, str(time.time()),
                                    json.dumps(result, ensure_ascii=False, default=str)))
        except Exception:
            LOGGER.exception('Sidecar asset row removal failed')
            return
        LOGGER.info('Sidecar files registered as works: removed %s ledger rows', len(removed))

    def _reclassify_videos(self) -> None:
        """记成 other、按现行扩展名规则是视频的行（`misfiled_videos`）改成视频，只做一次。

        WebM 以前不在视频扩展名里（#551），旧版扫描把它登记成 other，只有完整重扫才会改正。
        改过的 id 记进回执，撤回时按它改回 other；这些影片并进本轮补修的 `media_ids`，由自动修复
        补时长、预览与资料。出错只记日志，下次启动再试。
        """
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (VIDEO_MEDIUM_KEY,)).fetchone():
                    return
            receipt = None
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (VIDEO_MEDIUM_KEY,)).fetchone():
                    return
                ids = misfiled_videos(connection)
                connection.execute("UPDATE asset SET medium='video' WHERE id IN (SELECT value FROM json_each(?))",
                                   (json.dumps(ids),))
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (VIDEO_MEDIUM_KEY, str(time.time()),
                                    json.dumps({'rule': upgrade_rules.VIDEO_MEDIUM, 'video': ids})))
                stored = connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?',
                                            (REVISION,)).fetchone()
                if ids and stored:
                    receipt = json.loads(stored[0])
                    receipt['media_ids'] = sorted(set(receipt.get('media_ids', [])) | set(ids))
                    receipt['dispatch_complete'] = False
                    connection.execute('UPDATE ledger_upgrade_repair SET result_json=? WHERE id=?',
                                       (json.dumps(receipt, ensure_ascii=False), REVISION))
            if receipt is not None:
                atomic_write_text(self.receipt, json.dumps(receipt, ensure_ascii=False))
        except Exception:
            LOGGER.exception('Video medium repair failed')
            return
        LOGGER.info('Video medium: reclassified %s rows as video', len(ids))

    def _settle_resolution_tags(self) -> None:
        """解除刮削按来源 genre 挂上的分辨率标签（`settle_source_resolution_tags`），只做一次。

        出错只记日志，下次启动再试；删掉的行原样记进回执，`revert_auto_landing.py --source
        upgrade:source-resolution-tags` 按它插回。
        """
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (RESOLUTION_TAGS_KEY,)).fetchone():
                    return
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (RESOLUTION_TAGS_KEY,)).fetchone():
                    return
                result = settle_source_resolution_tags(connection)
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (RESOLUTION_TAGS_KEY, str(time.time()), json.dumps(result, ensure_ascii=False)))
        except Exception:
            LOGGER.exception('Source resolution tag repair failed')
            return
        LOGGER.info('Source resolution tags: removed %s rows', len(result['tags']))

    def _convert_interface_text(self) -> None:
        """旧任务行与补全记录里的界面文字转成 code（`interface_text_upgrade`），只做一次。

        改动前的原值逐条记进回执：任务行按 id，补全记录按文件名。补全记录在回执落库之后才改写，
        中途失败的那几个文件留着原文，界面照原文显示。出错只记日志，下次启动再试。
        """
        from . import interface_text_upgrade as upgrade
        key = upgrade.RECEIPT_KEY
        root = attempts_root(self.contract.candidate_root)
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                    return
            planned = upgrade.plan_attempts(root)
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                    return
                result = upgrade.convert_task_runs(connection)
                result.update(attempts=len(planned),
                              attempt_originals={name: text for name, (text, _parts) in planned.items()})
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (key, str(time.time()), json.dumps(result, ensure_ascii=False)))
            upgrade.apply_attempts(root, planned)
        except Exception:
            LOGGER.exception('interface text conversion failed')
            return
        LOGGER.info('interface text converted to codes: %s task rows, %s follow-up records',
                    result['rows'], result['attempts'])

    def _settle_quality(self) -> None:
        """按已存尺寸修正画质分档，原值与结果在同一事务写入回执。"""
        from . import quality_repair
        try:
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (quality_repair.KEY,)).fetchone():
                    return
                result = quality_repair.settle(connection)
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (quality_repair.KEY, str(time.time()), json.dumps(result, ensure_ascii=False)))
        except Exception:
            LOGGER.exception('Quality classification repair failed')
            return
        LOGGER.info('Quality classification repair: corrected %s rows', len(result['assets']))

    def _clear_stale_codes(self) -> None:
        """清掉旧版从文件名误认的番号（`stale_filename_codes`），只做一次。"""
        with self.contract.database.write_transaction() as connection:
            if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (STALE_CODES_KEY,)).fetchone():
                return
            rows = stale_filename_codes(connection)
            if rows:
                write_owned_fields(connection, [row['id'] for row in rows], {'code': None}, SCAN_FILENAME)
            connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                               (STALE_CODES_KEY, str(time.time()), json.dumps({'cleared': rows})))
        LOGGER.info('Codes misread by older versions: cleared %s', len(rows))

    def _restore_suffix_codes(self) -> None:
        """旧版截掉登记尾字母的番号改回现行写法（`truncated_suffix_codes`），只做一次。

        在 `prepare` 里、处理任务恢复之前做：处理检查点按改回后的番号决定哪几部重新采集。
        出错只记日志，下次启动再试。
        """
        try:
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (SUFFIX_CODES_KEY,)).fetchone():
                    return
                rows = truncated_suffix_codes(connection)
                for row in rows:
                    write_owned_fields(connection, [row['id']], {'code': row['target']}, SCAN_FILENAME)
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (SUFFIX_CODES_KEY, str(time.time()), json.dumps({'codes': rows}, ensure_ascii=False)))
        except Exception:
            LOGGER.exception('Label suffix code repair failed')
            return
        LOGGER.info('Codes missing their label suffix: restored %s', len(rows))

    def _release_studio_misses(self) -> None:
        """旧版断网时记下的「官网未取得」各放一次重试（`studio_followup.release_unbounded_misses`）。

        只改候选缓存里的记号文件，不写账本行；做过的记进 `ledger_upgrade_repair`，只做一次。
        """
        from .studio_followup import release_unbounded_misses
        key = 'studio-unbounded-misses-1'
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                    return
            changed = release_unbounded_misses(attempts_root(self.contract.candidate_root))
            with self.contract.database.write_transaction() as connection:
                connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                   'VALUES(?,?,?)', (key, str(time.time()), json.dumps({'released': changed})))
            LOGGER.info('Released old "official site not retrieved" records for retry: %s', changed)
        except Exception:
            LOGGER.exception('Failed to release old "official site not retrieved" records for retry')

    def _prune_task_controls(self) -> None:
        """旧版每轮任务留下的 `state/task-controls` 即时状态文件一次清掉（`task_control.prune_controls`）。

        之后每轮任务结算后的 `prune` 照同一判据清；这里只是不等下一轮任务结束。回执记删掉的个数。
        """
        from .task_control import prune_controls
        key = 'task-controls-runtime-files-1'
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                    return
            removed = prune_controls(self.contract.task_runs)
            with self.contract.database.write_transaction() as connection:
                connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                   'VALUES(?,?,?)', (key, str(time.time()), json.dumps({'removed': removed})))
            LOGGER.info('Control files of finished tasks: removed %s', removed)
        except Exception:
            LOGGER.exception('Failed to clean up control files of finished tasks')

    def _prune_repair_checkpoints(self) -> None:
        """补修完不删的续跑状态一次清掉；之后每部、每批有了结论就当场删（`discard_checkpoint`、`_discard_settled`）。

        留下的只有还用得上的：回执队列里在跑的键，以及状态表里这部片在**这条规则**下待补、延后、
        失败的（重派同一个键时接着跑）。单部的续跑状态按文件里的 `job_id` 认是哪条规则留下的：
        上一版按影片汇总，一部片只要在任意规则下还有失败，各条规则已做完的状态也一直留着。
        读不出 `job_id` 的按影片判。一小时内动过的也不碰，免得和刚派出的任务抢同一份文件。
        回执记删掉的文件数与字节数；`-1` 是上一版判据的回执，这一版换新键再清一遍。
        """
        import re
        key = 'upgrade-repair-checkpoints-2'
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                    return
                open_items = [(row[0], str(row[1])) for row in connection.execute(
                    "SELECT rule,asset_id FROM ledger_upgrade_item WHERE rule LIKE 'media:%'"
                    " AND state IN ('pending','queued','deferred','failed')")]
            queued = list(_read(self.receipt).get('queued', {}))
            members = [member for queued_key in queued for member in member_keys(queued_key)]
            # 每部片还用得上的续跑状态是哪几条规则的（按 `job_id` 认），以及这部片有没有任何还用得上的。
            wanted = {member.replace(':', '-') for member in members}
            wanted |= {_job_id(rule, asset_id) for rule, asset_id in open_items}
            assets = {asset_id for _rule, asset_id in open_items} | {member.rsplit(':', 1)[1] for member in members}
            batches = {f'batch-{_batch_digest(queued_key)}' for queued_key in queued if batch_members(queued_key)}
            pattern = re.compile(r'^(\d+|batch-[0-9a-f]{16})(\.json|\.issues\.jsonl|-items)$')
            cutoff = time.time() - 3600
            removed = size = 0
            found = [(path, matched.group(1)) for path in (self.root.iterdir() if self.root.is_dir() else ())
                     if (matched := pattern.match(path.name)) and matched.group(1) not in batches]
            # 先把每部片认完再删：状态文件删掉之后，同名的问题日志与逐项目录就认不出规则了。
            jobs = {name: _job_of(self.root / f'{name}.json') for _path, name in found if not name.startswith('batch-')}
            for path, name in found:
                job_id = jobs.get(name)
                if job_id is not None and ((job_id in wanted) if job_id else (name in assets)):
                    continue
                try:
                    if path.stat().st_mtime > cutoff:
                        continue
                except OSError:
                    continue
                files, total = _remove(path)
                removed, size = removed + files, size + total
            with self.contract.database.write_transaction() as connection:
                connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                   'VALUES(?,?,?)', (key, str(time.time()),
                                                     json.dumps({'removed': removed, 'bytes': size})))
            LOGGER.info('Repair resume state: removed %s files, %s bytes', removed, size)
        except Exception:
            LOGGER.exception('Failed to clean up repair resume state')

    def _prune_failed_followups(self) -> None:
        """旧版永不清退的失败后继行一次清掉，连同它们的控制文件；只做一次。

        影片补全按结论清（`prune_settled_failures`）；其余后继按 `TaskRunStore.prune` 的天数清
        （`FAILED_FOLLOWUP_DAYS`）。之后每条后继跑完、每轮结算后都照同样的判据清，这里只是不等下一轮。
        回执按任务种类记删掉的行数。出错只记日志，下次启动再试。
        """
        key = FAILED_FOLLOWUPS_KEY
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                    return
                keys = [row[0] for row in connection.execute(
                    "SELECT DISTINCT task_key FROM task_run WHERE status IN ('failed','interrupted') "
                    'AND followup_key IS NOT NULL AND task_key<>?', (MEDIA_TASK,))]
            store = self.contract.task_runs
            removed = {MEDIA_TASK: prune_settled_failures(store, _read(self.receipt).get('queued', {}).values())}
            for task_key in keys:
                removed[task_key] = store.prune(task_key, keep_errors=True)
            removed = {name: count for name, count in removed.items() if count}
            with self.contract.database.write_transaction() as connection:
                connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                   'VALUES(?,?,?)', (key, str(time.time()), json.dumps({'removed': removed})))
            LOGGER.info('Failed follow-up rows: removed %s', removed)
        except Exception:
            LOGGER.exception('Failed to clean up failed follow-up rows')

    def _backfill_avatar_faces(self) -> None:
        """人物头像缺人脸记录或记录过期的补测一遍（`avatar_face.backfill`），每次启动在后台做。

        人脸模型不可用时装上的头像没有 `.face.json`，页面一直按几何居中取景；换图后没重检、
        `px` 对不上的同样退回居中。只读本机图片，只用随包或已在数据目录里的模型，不联网；
        模型用不了就什么也不写，下次启动再试。第一次做完记回执（检了几张、写了几张），之后
        每次启动照样补安装时没检成的。

        关注作品的题材圆标不补：那里一张都过不了人脸判据的题材本来就不写记录（按整张封面显示），
        而判据要看站点的高清原图，缺记录的分不出是没检成还是本来没有可用的脸，只能联网重取。
        """
        from . import avatar_face
        try:
            root = getattr(self.contract, 'avatar_root', None)
            if root is None:
                return
            result = avatar_face.backfill(Path(root), avatar_face.FaceProbe(allow_download=False))
            if result is None:
                LOGGER.info('Avatar face backfill waits for the face model')
                return
            with self.contract.database.write_transaction() as connection:
                connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                   'VALUES(?,?,?)', (AVATAR_FACES_KEY, str(time.time()), json.dumps(result)))
            LOGGER.info('Avatar face backfill: %s', result)
        except Exception:
            LOGGER.exception('Avatar face backfill failed')

    def _prune_processing_state(self) -> None:
        """处理任务积下的状态文件一次清掉，只做一次；之后各在自己的任务里清。

        - 馆藏处理的本地证据缓存（`library-processing-items/`）：留状态文件还引用的，判据同
          `library_processing.prune_local_evidence`。馆藏处理正在跑就不碰，留给它下一轮开工时清。
        - 下载后处理的续跑状态（`download-processing/<正片>`）：后处理还在等、在跑或失败待重试的
          下载指着的那部片留着，其余删掉；现在每条后处理完成时当场删。
        - 整理批次日志（`organize-batches/`）：只留最近几份（`organize.prune_batches`），现在每次整理后都清。

        一小时内动过的不碰。回执记三类各删掉多少。出错只记日志，下次启动再试。
        """
        import re
        from . import organize
        from .job_recovery import read as recovery
        from .library_processing import prune_local_evidence
        key = PROCESSING_STATE_KEY
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                    return
                waiting = {str(row[0]) for row in connection.execute(
                    'SELECT asset_id FROM download_task WHERE asset_id IS NOT NULL '
                    "AND postprocess_state IN ('pending','queued','running','failed')")}
            state_root = Path(self.contract.follow_state_root)
            cutoff = time.time() - 3600
            result = {'local_evidence': 0, 'download_states': 0, 'organize_batches': 0}
            if recovery(self.contract.db_path, 'library-processing').get('status') != 'active':
                library_state = state_root / 'library-processing.json'
                try:
                    stored = json.loads(library_state.read_text(encoding='utf-8'))
                except FileNotFoundError:
                    stored = {}
                if isinstance(stored, dict):
                    result['local_evidence'] = prune_local_evidence(
                        library_state, stored.get('local_metadata'), before=cutoff)
            pattern = re.compile(r'^(\d+)(\.json|\.issues\.jsonl|-items)$')
            folder = state_root / 'download-processing'
            for path in folder.iterdir() if folder.is_dir() else ():
                found = pattern.match(path.name)
                if not found or found.group(1) in waiting:
                    continue
                try:
                    if path.stat().st_mtime > cutoff:
                        continue
                except OSError:
                    continue
                result['download_states'] += _remove(path)[0]
            result['organize_batches'] = organize.prune_batches(Path(self.contract.candidate_root))
            with self.contract.database.write_transaction() as connection:
                connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                   'VALUES(?,?,?)', (key, str(time.time()), json.dumps(result)))
            LOGGER.info('Processing state files: %s', result)
        except Exception:
            LOGGER.exception('Failed to clean up processing state files')

    def _settle_verification(self) -> None:
        """核查差异的结算规则（ADR-0139）对存量候选跑一遍，规则版本变了才再跑。

        只喂带核查标记的那些行：其余候选的判据没变，这一步不替它们重判。有要处理的行才
        先备份；结果连同规则版本记进 `ledger_upgrade_repair`，账本恢复到之前的备份时会重跑。
        几千行要跑一两分钟，所以不在 `prepare` 里挡着服务启动，由 `start` 交给后台调度跑；
        自动落库按批提交，页面上的写入照常穿插进来。
        """
        try:
            self._settle_verification_once()
        except Exception as exc:
            self.error, self.error_phrase = str(exc), nested_message(exc)
            LOGGER.exception('Verification difference settlement failed')

    def _settle_verification_once(self) -> None:
        from .metadata_auto_apply import _parsed_candidates, auto_apply_metadata
        from .review_csv import read_candidates
        key = f'verification-settlement-{upgrade_rules.VERIFICATION_SETTLEMENT}'
        contract = self.contract
        with contract.database.read_connection() as connection:
            if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                return
        rows, _source, _skipped = read_candidates('metadata_fields', Path(contract.candidate_root))
        rows = [row for row in rows
                if any(candidate.get('requires_review') for candidate in _parsed_candidates(row))]
        result = {'rows': len(rows)}
        if rows:
            backup = self._upgrade_backup()
            summary = auto_apply_metadata(
                contract.database, Path(contract.candidate_root), candidate_rows=rows,
                snapshot_root=Path(contract.follow_sources_root) / 'library-metadata',
                active=lambda: not self.stopping.is_set())
            if self.stopping.is_set():
                return
            result.update({name: summary[name] for name in
                           ('applied', 'kept', 'refreshed', 'auto_rejected', 'left_to_review')},
                          backup=str(backup))
        with contract.database.write_transaction() as connection:
            connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                               'VALUES(?,?,?)', (key, str(time.time()), json.dumps(result, ensure_ascii=False)))
        LOGGER.info('Verification difference settlement: %s', result)

    def _backfill_identities(self) -> None:
        """先补挂 FC2 卖家，再让同番号副本照抄归属：副本要抄的卖家得先挂上。"""
        self._backfill_fc2_sellers()
        self._inherit_code_siblings()

    def _backfill_fc2_sellers(self) -> None:
        """来源快照写明卖家、却没挂上卖家账号的 FC2 作品整库补一次（`fc2_sellers.land`）。

        卖家归属此前只有一次性脚本，脚本之后入库的作品与后来才认出番号的副本都缺。之后每轮
        资料落库会顺手处理新的那几部；这里只补存量。有要挂的才先备份；计划与账本对不上时
        不写回执，下次启动再试。
        """
        from . import fc2_sellers
        try:
            root = Path(self.contract.follow_sources_root) / 'library-metadata'
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (FC2_SELLERS_KEY,)).fetchone():
                    return
                todo = fc2_sellers.pending(connection, root)
            backup = None
            if todo:
                backup = self._upgrade_backup()
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (FC2_SELLERS_KEY,)).fetchone():
                    return
                result = fc2_sellers.land(connection, root) if todo else {'entity_ids': [], 'skipped': [], 'changes': 0}
                if backup is not None:
                    result['backup'] = str(backup)
                connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                   'VALUES(?,?,?)', (FC2_SELLERS_KEY, str(time.time()),
                                                     json.dumps(result, ensure_ascii=False, default=str)))
            LOGGER.info('FC2 sellers backfilled: %s accounts', len(result['entity_ids']))
        except ValueError:
            LOGGER.info('FC2 seller backfill skipped: plan no longer matches the ledger', exc_info=True)
        except Exception:
            LOGGER.exception('FC2 seller backfill failed')

    def _inherit_code_siblings(self) -> None:
        """同番号副本缺演员、创作者的存量整库补一次（`code_siblings.inherit`），排在卖家补挂之后。

        事先算不出有没有要补的，所以先领一份写入前备份，没补上任何关系就交回（`_release_upgrade_backup`）；
        补上的关系逐条记回执，按批次可撤（`auto_landing_revert`）。
        """
        from . import code_siblings
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (CODE_SIBLINGS_KEY,)).fetchone():
                    return
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (FC2_SELLERS_KEY,)).fetchone() is None:
                    return  # 卖家补挂还没做完，下次启动再来
            backup = self._upgrade_backup()
            result = None
            try:
                with self.contract.database.write_transaction() as connection:
                    if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                          (CODE_SIBLINGS_KEY,)).fetchone():
                        return
                    result = code_siblings.inherit(connection)
                    if result['links']:
                        result['backup'] = str(backup)
                    connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                       'VALUES(?,?,?)', (CODE_SIBLINGS_KEY, str(time.time()),
                                                         json.dumps(result, ensure_ascii=False)))
            finally:
                if result is None or not result['links']:
                    self._release_upgrade_backup(backup)
            LOGGER.info('Code siblings: inherited %s links', len(result['links']))
        except Exception:
            LOGGER.exception('Code sibling inheritance failed')

    def _settle_enhancement_names(self) -> None:
        """名字里的视频增强模型代号清理一次（`settle_enhancement_names`）；有要改的才先备份。"""
        try:
            with self.contract.database.read_connection() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (ENHANCEMENT_NAMES_KEY,)).fetchone():
                    return
                pending = enhancement_names_pending(connection)
            backup = None
            if pending:
                backup = self._upgrade_backup()
            with self.contract.database.write_transaction() as connection:
                if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?',
                                      (ENHANCEMENT_NAMES_KEY,)).fetchone():
                    return
                result = settle_enhancement_names(connection)
                if backup is not None:
                    result['backup'] = str(backup)
                connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                                   'VALUES(?,?,?)', (ENHANCEMENT_NAMES_KEY, str(time.time()),
                                                     json.dumps(result, ensure_ascii=False)))
            LOGGER.info('Enhancement model names: removed %s aliases, %s search terms, added %s aliases',
                        len(result['aliases']), len(result['terms']), len(result['added_aliases']))
        except Exception:
            LOGGER.exception('Enhancement model name cleanup failed')

    def _settle_spaced_performers(self) -> None:
        """出演者写法带空格的存量候选按新判据重判一次（`performer-spacing-1`）。

        旧版把片商官网 `釈 アリス` 这类姓名间的空格、欧美艺名 `Tiny Lu` 都当企划文案，整行
        扣在人工队列里，别家写法一致也没用。现在去掉空格对得上账本里的人、或是欧美艺名，就能
        自动落库；只重判这些行，其余候选的判据没变。有要处理的行才先备份，回执记进
        `ledger_upgrade_repair`，与核查结算一样交给后台调度，不挡服务启动。
        """
        try:
            self._settle_spaced_performers_once()
        except Exception:
            LOGGER.exception('Spaced performer settlement failed')

    def _settle_spaced_performers_once(self) -> None:
        from .metadata_auto_apply import _parsed_candidates, auto_apply_metadata
        from .review_csv import read_candidates
        key = SPACED_PERFORMERS_KEY
        contract = self.contract
        with contract.database.read_connection() as connection:
            if connection.execute('SELECT 1 FROM ledger_upgrade_repair WHERE id=?', (key,)).fetchone():
                return
        rows, _source, _skipped = read_candidates('metadata_fields', Path(contract.candidate_root))
        rows = [row for row in rows if row.get('field') == 'performers' and any(
            re.search(r'[ 　]', str(candidate.get('display_value') or ''))
            for candidate in _parsed_candidates(row))]
        result = {'rows': len(rows)}
        if rows:
            backup = self._upgrade_backup()
            summary = auto_apply_metadata(
                contract.database, Path(contract.candidate_root), candidate_rows=rows,
                snapshot_root=Path(contract.follow_sources_root) / 'library-metadata',
                active=lambda: not self.stopping.is_set())
            if self.stopping.is_set():
                return
            result.update({name: summary[name] for name in
                           ('applied', 'kept', 'refreshed', 'auto_rejected', 'left_to_review')},
                          backup=str(backup))
        with contract.database.write_transaction() as connection:
            connection.execute('INSERT OR IGNORE INTO ledger_upgrade_repair(id,applied_at,result_json) '
                               'VALUES(?,?,?)', (key, str(time.time()), json.dumps(result, ensure_ascii=False)))
        LOGGER.info('Spaced performer settlement: %s', result)

    def _restore_receipt(self, authoritative):
        try:
            cached = _read(self.receipt)
        except (ValueError, TypeError):
            self.receipt.replace(self.receipt.with_name(f'receipt.corrupt-{time.time_ns()}.json'))
            cached = {}
        if authoritative is not None and cached != authoritative:
            atomic_write_text(self.receipt, json.dumps(authoritative, ensure_ascii=False))

    def _save_receipt(self, receipt, items=()):
        """回执与状态表的行（`items`：`(写法, 行)`）同一事务提交。"""
        with self.contract.database.write_transaction(notify=False) as connection:
            stored = connection.execute('SELECT result_json FROM ledger_upgrade_repair WHERE id=?', (REVISION,)).fetchone()
            if stored is None:
                raise UserValueError('errors.upgradeRepairs.receiptNeedsPrepare')
            from .display_dimensions_repair import LEGACY_FIELDS, RECEIPT_KEY
            saved = json.loads(stored[0]).get(RECEIPT_KEY)
            if saved is not None:
                # 文件回执没写成时还是旧的：补测规则段以账本为准，已搬进状态表的逐片字典不再写回。
                display = receipt.setdefault(RECEIPT_KEY, saved)
                if not any(field in saved for field in LEGACY_FIELDS):
                    for field in LEGACY_FIELDS:
                        display.pop(field, None)
            for mode, rows in items:
                upsert_items(connection, rows, mode=mode)
            encoded = json.dumps(receipt, ensure_ascii=False)
            connection.execute('UPDATE ledger_upgrade_repair SET result_json=? WHERE id=? AND result_json<>?',
                               (encoded, REVISION, encoded))
        atomic_write_text(self.receipt, encoded)

    def _media_backlog(self) -> int:
        """已经派出、还没跑完的影片补全有几部片；一批按其中的片数算。"""
        with self.contract.database.read_connection() as connection:
            keys = [row[0] or '' for row in connection.execute(
                "SELECT followup_key FROM task_run WHERE task_key=? AND status IN ('pending','running')", (MEDIA_TASK,))]
        return sum(len(member_keys(key)) for key in keys)

    def _plan(self, receipt: dict, *, media: bool = True, media_limit: int = MAX_FOLLOWUPS):
        """`media` 为假时只排资料与人物后继，影片补全等前面那批跑下去再派。"""
        from . import (avatar_followup, creator_identity_followup, performer_alias_followup,
                       performer_profile_followup, seed_followup, studio_followup)
        from .library_processing import _people_allowed
        from .settings_file import load_config, DATA_ROOT_ENV
        config = load_config(environ={DATA_ROOT_ENV: str(self.config.data_root)}) if self.config is not None else load_config()
        seen = set(receipt.get('queued', {}))

        attempts = Attempts(attempts_root(self.contract.candidate_root))
        with self.contract.database.read_connection() as connection:
            maximum = connection.execute('SELECT coalesce(max(id),0) FROM entity').fetchone()[0]
            planned = [row for row in seed_followup.plan(connection, since_entity_id=maximum) if row.key not in seen]
            planners = (performer_alias_followup, studio_followup, performer_profile_followup,
                        creator_identity_followup, avatar_followup) if (
                            not receipt.get('text_only') and _people_allowed(config)) else ()
            for planner in planners:
                remaining = MAX_FOLLOWUPS - len(planned)
                if remaining <= 0:
                    break
                args = [connection]
                if planner is studio_followup:
                    args.append(self.contract.logo_root)
                elif planner is avatar_followup:
                    args.append(self.contract.avatar_root)
                args.append(attempts)
                planned.extend(planner.stock(*args, limit=min(16, remaining), skip=seen))
            if not media or receipt.get('media_paused'):
                return planned[:MAX_FOLLOWUPS]
            from .media_folders import path_predicate
            scopes = [path_predicate(location, root) for location, roots in config.locations.items() for root in roots]
            clause = " OR ".join(term for term, _values in scopes) or "0"
            parameters = [value for _term, values in scopes for value in values]
            rows = connection.execute("SELECT id,code,name,path,location,size,mtime,snapshot_path FROM asset a "
                                      "WHERE medium='video' AND disposal IS NULL AND (" + clause + ") ORDER BY id",
                                      parameters).fetchall()
            items = _media_items(connection)
        inherited, inherited_display = self._inherited_media(receipt, items)
        return self._plan_media(receipt, config, rows, planned, seen, inherited, inherited_display, media_limit, items)

    def _inherited_media(self, receipt, items=None):
        """保留仍在执行或用户取消的影片及文件世代，避免重复派发。

        还在回执队列里的看任务状态，已结算进状态表的看那一行。
        """
        from .display_dimensions_repair import ITEM_RULE
        inherited, inherited_display = set(), set()
        media = {key: run_id for key, run_id in receipt.get('queued', {}).items() if item_of(key)}
        states = self._run_states(media.values())
        held = [item_of(key) for key, run_id in media.items()
                if states.get(int(run_id)) in ('pending', 'running', 'cancelled')]
        held += [(rule, asset_id, row['generation']) for (rule, asset_id), row in (items or {}).items()
                 if row['state'] in ('queued', 'cancelled')]
        for rule, asset_id, generation in held:
            if rule == ITEM_RULE:
                inherited_display.add((asset_id, generation))
            else:
                inherited.add(asset_id)
        return inherited, inherited_display

    def _plan_media(self, receipt, config, rows, planned, seen, inherited, inherited_display, media_limit, items=None):
        """在余下配额中先补显示尺寸，再安排旧规则产物更新。"""
        from .media_sources import cost_for
        from .followups import Followup
        selected = set(receipt.get('media_ids', []))
        from .display_dimensions_repair import ITEM_RULE, generation, task_key
        items = items or {}
        now = time.time()
        deferred = []
        media_count = 0
        for row in rows:
            if media_count >= media_limit:
                break
            current = generation(row)
            if row['id'] in inherited or (row['id'], current) in inherited_display:
                continue
            display_key = task_key(row)
            display = items.get((ITEM_RULE, row['id']))
            if display is not None and display_key not in seen and not settled(display, current, now):
                if cost_for(row['location'], row['path'], config) != 'free':
                    deferred.append(row['id'])
                    continue
                planned.append(Followup.coded(display_key, MEDIA_TASK, run_progress(
                    'subjectStage', subject=_title(row), stage='upgrade.displayDimensions')))
                media_count += 1
                if len(planned) >= MAX_FOLLOWUPS:
                    break
                continue
            if row['id'] not in selected and not _stale_previews(self.contract, row):
                continue
            rule = upgrade_rules.PROCESSING
            if row['id'] in receipt.get('text_media_ids', []):
                rule += f':text-{upgrade_rules.PROVIDER_TEXT}'
            if row['id'] in receipt.get('code_media_ids', []):
                rule += f':{CODE_EVIDENCE_RULE}'
            key = f'{MEDIA_TASK}:{rule}:{row["id"]}'
            # 结算过的键已移出回执队列，防重复派发靠状态表里那一行。
            if key in seen or settled(items.get((f'media:{rule}', row['id'])), None, now):
                continue
            if cost_for(row['location'], row['path'], config) != 'free':
                deferred.append(row['id'])
                continue
            planned.append(Followup.item(key, MEDIA_TASK, _title(row)))
            media_count += 1
            if len(planned) >= MAX_FOLLOWUPS:
                break
        receipt['deferred'] = deferred
        return planned[:MAX_FOLLOWUPS]

    def tick(self) -> float | None:
        """结算跑完的后继并派出到期的补修。

        返回距最早一条自动重派的秒数；没有可等的时刻时返回 None，等派出的后继跑完回调或兜底复查。
        """
        if not self.available or not self.receipt.is_file():
            return None
        try:
            with FileLock(str(self.receipt) + '.lock', timeout=0):
                receipt = _read(self.receipt)
                try:
                    dispatched = self._dispatch_round(receipt)
                finally:
                    self._watched = frozenset(int(run_id) for run_id in receipt.get('queued', {}).values())
            if dispatched:
                self.contract.followups.wake()
            return self._next_retry()
        except Timeout:
            return BUSY_RETRY_SECONDS
        except UpdateBusy:
            # 装更新或闸门正忙：这一轮不派，过一会儿再看，不算派发失败。
            return BUSY_RETRY_SECONDS
        except Exception as exc:
            self.error, self.error_phrase = str(exc), nested_message(exc)
            LOGGER.exception('Upgrade repair dispatch failed')
            return BUSY_RETRY_SECONDS

    def _dispatch_round(self, receipt) -> bool:
        """持回执锁做一轮结算与派发；存了回执、要叫醒后继通道时返回 True。"""
        settled_rows = self._settle_queue(receipt)
        if settled_rows is not None:
            self._save_receipt(receipt, [('settle', settled_rows)])
            prune_settled_failures(self.contract.task_runs, receipt.get('queued', {}).values())
            # 完成与取消的不会再按同一个键接着跑（取消的重试也不重派）：续跑状态用不上了。
            for row in settled_rows:
                if row['state'] in ('done', 'cancelled'):
                    _discard_settled(self.root, row['rule'], [row['asset_id']])
        if receipt.get('dispatch_complete'):
            with self.contract.database.read_connection() as connection:
                seed = self._seed_pending(connection)
            if (not receipt.get('deferred') and not self._display_due(receipt) and not self._retry_due()
                    and not any(row.key not in receipt.get('queued', {}) for row in seed)):
                return False
            receipt['dispatch_complete'] = False
        # 影片补全只有一条通道、一次一条；不等前面那批跑下去就每分钟再派一批，
        # 整个库会在一两个小时里全堆进队列，任务中心满屏都是「已处理 0 / 64」。
        # 配额按片数算：处理规则的补全合批派出（`BATCH_SIZE`），排着的最多 64 部。
        available = MAX_FOLLOWUPS - self._media_backlog()
        media = not receipt.get('media_paused') and available > 0
        planned = self._plan(receipt, media=media, media_limit=max(0, available))
        if not planned and not media:
            return False
        dispatched = []
        if not planned:
            receipt['dispatch_complete'] = True
        else:
            dispatched = self._dispatch(planned, receipt)
            if dispatched is None:
                return False
        self._save_receipt(receipt, [('dispatch', dispatched)])
        self.error, self.error_phrase = '', ''
        return True

    def _next_retry(self) -> float | None:
        """距下一条自动重派（`retry_at` 还没到的失败与延后）的秒数；没有时返回 None。

        已过 `retry_at` 却没派出的行是被配额或暂停挡着，等后继跑完的回调，不按它定时。
        """
        now = time.time()
        with self.contract.database.read_connection() as connection:
            row = connection.execute(
                "SELECT min(item.retry_at) FROM ledger_upgrade_item item JOIN asset ON asset.id=item.asset_id "
                "WHERE item.state IN ('failed','deferred') AND item.retry_at>? AND asset.disposal IS NULL",
                (now,)).fetchone()
        return None if row is None or row[0] is None else float(row[0]) - now

    def _followup_finished(self, run) -> None:
        """后继通道的回调：本回执派出的那一批里有一条跑完了，叫醒派发线程结算、补派。"""
        if run.id in self._watched:
            self._wake.set()

    def _run(self) -> None:
        while not self.stopping.is_set():
            # 先清再算：这一轮期间跑完的后继会让下面的等待立即返回。
            self._wake.clear()
            started = time.monotonic()
            delay = self.tick()
            self._wake.wait(IDLE_RECHECK_SECONDS if delay is None else min(delay, IDLE_RECHECK_SECONDS))
            rest = ACTIVE_GAP_SECONDS - (time.monotonic() - started)
            if rest > 0:
                self.stopping.wait(rest)

    def _settle_queue(self, receipt) -> list[dict] | None:
        """已结束的影片补全移出回执队列，结论记进状态表；没有要结算的返回 None。

        回执队列原本只增不减，上万条结束了的键还在承担防重复派发；结算后这件事交给
        状态表里那一行（`settled`）。只改两种行：本版派发时记下、还归这一轮任务管的
        （`queued` 且 `run_id` 对得上），和旧版留下、表里没有结论的。处理器自己写过结论的不动。
        任务已被清退的按完成算：跑完后的清退只删成功与取消的影片补全，失败的等这里结算之后才由
        `prune_settled_failures` 收走。
        本版派出的失败按退避自动重派（`retry_at`）；旧版留下的失败照旧只等用户点重试
        （`retry_at` 为空），不会被自动重派。
        """
        queued = receipt.get('queued', {})
        media = {key: int(run_id) for key, run_id in queued.items() if item_of(key)}
        states = self._run_states(media.values())
        finished = {key: run_id for key, run_id in media.items() if states.get(run_id) not in ('pending', 'running')}
        if not finished:
            return None
        targets = {item_of(key)[:2] for key in finished}
        with self.contract.database.read_connection() as connection:
            current = _media_items(connection, rules={rule for rule, _ in targets}, every=True)
        rows = []
        now = time.time()
        for key, run_id in finished.items():
            rule, asset_id, generation = item_of(key)
            row = current.get((rule, asset_id))
            owned = row is not None and row['state'] == 'queued' and row['run_id'] == run_id
            if row is None or row['state'] == 'pending' or owned:
                status = states.get(run_id)
                state = ('done' if status in (None, 'succeeded') else 'cancelled' if status == 'cancelled'
                         else 'failed')
                attempts = (row['attempts'] if row is not None else 0) + (state == 'failed')
                rows.append({'rule': rule, 'asset_id': asset_id, 'generation': generation, 'state': state,
                             'run_id': run_id, 'attempts': attempts,
                             'retry_at': retry_at(attempts, now) if state == 'failed' and owned else None})
            del queued[key]
        return rows

    def _retry_due(self) -> bool:
        """有延后或退避中的补修到了重派时间，而且规划器这一轮真会派它。

        同片还有排着或被取消的影片补全时，规划器整片跳过（`_inherited_media`）；那种片子不算，
        否则它一直到期、一直派不出，每分钟都要白白重开一轮规划。"""
        from .display_dimensions_repair import ITEM_RULE
        with self.contract.database.read_connection() as connection:
            return connection.execute(
                "SELECT 1 FROM ledger_upgrade_item item JOIN asset ON asset.id=item.asset_id "
                "WHERE item.state IN ('failed','deferred') AND item.retry_at IS NOT NULL AND item.retry_at<=? "
                f'AND asset.disposal IS NULL AND {_NOT_HELD} LIMIT 1', (time.time(), ITEM_RULE)).fetchone() is not None

    def _display_due(self, receipt):
        from .display_dimensions_repair import IDENTITY_COLUMNS, ITEM_RULE, generation, task_key
        now = time.time()
        columns = ','.join(f'asset.{name}' for name in IDENTITY_COLUMNS.split(','))
        with self.contract.database.read_connection() as connection:
            rows = connection.execute(
                f'SELECT {columns},item.generation AS item_generation,item.state,item.retry_at '
                'FROM ledger_upgrade_item item JOIN asset ON asset.id=item.asset_id '
                f"WHERE item.rule=? AND asset.medium='video' AND asset.disposal IS NULL AND {_NOT_HELD}",
                (ITEM_RULE, ITEM_RULE)).fetchall()
        queued = receipt.get('queued', {})
        return any(not settled({'generation': row['item_generation'], 'state': row['state'], 'retry_at': row['retry_at']},
                               generation(row), now) and task_key(row) not in queued for row in rows)

    def _dispatch(self, planned, receipt) -> list[dict] | None:
        """派出这一批；返回派出的影片补全在状态表里要记的行，没派成是 None。"""
        store = self.contract.task_runs
        orphan = store.blocking(TASK_KEY)
        if orphan is not None:
            store.finish(orphan.id, 'failed', **run_error('dispatchInterrupted'))
        run = store.start(TASK_KEY, trigger='scheduled', mutex_key=TASK_KEY, **run_progress('schedulingRepairs'))
        if run is None:
            return None
        planned_keys = {row.key for row in planned}
        batched = _batched(planned)
        try:
            result = store.enqueue_followups(run.id, [row.as_row() for row in batched])
            queued = receipt.setdefault('queued', {})
            # 回执队列按每部片记：一批里的每部片都指向这一批的任务，防重复派发与结算照旧按片。
            for run_id in result['queued']:
                child = store.get(run_id)
                for key in member_keys(child.followup_key):
                    queued[key] = run_id
            for row in batched:
                child = None
                for key in member_keys(row.key):
                    if key not in queued:
                        child = child or store.blocking(row.key)
                        if child is not None:
                            queued[key] = child.id
            store.finish(run.id, 'succeeded', summary=said(part('scheduled', count=len(result["queued"]))))
        except Exception as exc:
            store.finish(run.id, 'failed', error=str(exc))
            raise
        finally:
            store.prune(TASK_KEY)
        return [{'rule': item[0], 'asset_id': item[1], 'generation': item[2], 'run_id': int(run_id)}
                for key, run_id in queued.items() if key in planned_keys and (item := item_of(key))]

    def _display_targets_known(self, connection) -> set[str]:
        from .display_dimensions_repair import ITEM_RULE
        return {str(row[0]) for row in connection.execute(
            'SELECT asset_id FROM ledger_upgrade_item WHERE rule=?', (ITEM_RULE,))}

    def cloud_display_videos(self) -> int:
        """网盘里还没加进显示尺寸补测的旧视频数；用户点过「补测网盘视频」就是 0。"""
        from . import display_dimensions_repair as repair
        try:
            display = _read(self.receipt).get(repair.RECEIPT_KEY)
        except (OSError, ValueError, TypeError):
            return 0
        if display is None or display.get('cloud_included_at'):
            return 0

        def count() -> int:
            with self.contract.database.read_connection() as connection:
                known = self._display_targets_known(connection)
                return sum(asset_id not in known for asset_id in repair.collect(connection, cloud=True))
        # 「修复与迁移」每次打开、补测在跑时每 2 秒都要问；全部网盘视频与补测名单各扫一遍，
        # 生产冷时 0.46 秒。两张表不变就用上一次的数。
        cached = getattr(self.contract, 'cached_until_changed', None)
        return cached('upgrade-cloud-display-pending', count, tables=('asset', 'ledger_upgrade_item')) \
            if callable(cached) else count()

    def include_cloud_display_dimensions(self) -> dict:
        """用户在「自动修复」里点了「补测网盘视频」：把网盘来源的旧视频加进显示尺寸补测。

        升级时自动补测只看本机与局域网的来源（`display_dimensions_repair.collect`）；
        网盘这一批交给用户决定什么时候做，照样受容量保护和计费来源设置约束。"""
        if not self.available:
            raise UserValueError('errors.upgradeRepairs.primaryOnly')
        from . import display_dimensions_repair as repair
        self.prepare()
        with FileLock(str(self.receipt) + '.lock', timeout=0):
            receipt = _read(self.receipt)
            display = receipt.get(repair.RECEIPT_KEY)
            if display is None:
                raise UserValueError('errors.upgradeRepairs.displayRepairNotReady')
            with self.contract.database.read_connection() as connection:
                known = self._display_targets_known(connection)
                extra = {asset_id: size for asset_id, size in repair.collect(connection, cloud=True).items()
                         if asset_id not in known}
                rows = self._display_targets(connection, extra)
            display['cloud_included_at'] = time.time()
            receipt['dispatch_complete'] = False
            self._save_receipt(receipt, [('seed', rows)])
        self.tick()
        return self.snapshot()

    def retry(self) -> dict:
        """显式重试失败项；用户取消的任务保持取消。"""
        if not self.available:
            raise UserValueError('errors.upgradeRepairs.primaryOnly')
        self.prepare(retry_media=True)
        with FileLock(str(self.receipt) + '.lock', timeout=0):
            receipt = _read(self.receipt)
            paused = receipt.get('media_paused', {})
            if paused:
                from .storage_budget import CapacityGuard
                from .settings_file import load_config
                config = self.config or getattr(self.contract, 'upgrade_config', None) or load_config()
                CapacityGuard(config).check(force=True)
                receipt.pop('media_paused')
            # 先把结束了的键结算进状态表，再把失败与延后一并放回待办：旧版留下、只等用户决定的失败也在这里重派。
            settled_rows = self._settle_queue(receipt) or []
            receipt['dispatch_complete'] = False
            self._save_receipt(receipt, [('settle', settled_rows)])
            with self.contract.database.write_transaction(notify=False) as connection:
                connection.execute("UPDATE ledger_upgrade_item SET state='pending',attempts=0,retry_at=NULL,"
                                   "updated_at=? WHERE state IN ('failed','deferred')", (str(time.time()),))
            self.error, self.error_phrase = '', ''
        from . import task_control
        from .update_tasks import _mutex, state_for
        with _mutex(state_for(self.contract.db_path)):
            for run_id, command_id in paused.get('commands', {}).items():
                run = self.contract.task_runs.get(int(run_id))
                if run is None or run.status not in ('pending', 'running'):
                    continue
                current = task_control.intent(self.contract.db_path, run.id, (run.parent_run_id, run.root_run_id))
                if current.get('action') == 'pause' and current.get('id') == command_id:
                    task_control.request(self.contract.task_runs, run.id, 'resume')
        self.tick()
        return self.snapshot()

    def pause_media(self, error, *, run_id: int | None = None) -> None:
        """磁盘触线后持久暂停整批；腾出空间或重启都不解除，显式重试才解除。

        `run_id` 是撞上触线的那一条：它挂回队列等重试，所以整批已经暂停时也要给它下暂停，
        否则挂回去马上又被领走、再撞一次。
        """
        from . import task_control
        from .update_tasks import _mutex, state_for
        store = self.contract.task_runs
        with FileLock(str(self.receipt) + '.lock'):
            receipt = _read(self.receipt)
            paused = receipt.get('media_paused')
            if paused:
                if run_id is None or str(run_id) in paused.get('commands', {}):
                    return
                with _mutex(state_for(self.contract.db_path)):
                    if task_control.requested(self.contract.db_path, run_id) != 'resume':
                        return
                    task_control.request(store, run_id, 'pause')
                    paused.setdefault('run_ids', []).append(run_id)
                    paused.setdefault('commands', {})[str(run_id)] = task_control.intent(
                        self.contract.db_path, run_id)['id']
                    self._save_receipt(receipt)
                return
            with self.contract.database.read_connection() as connection:
                rows = connection.execute(
                    "SELECT id,parent_run_id,root_run_id FROM task_run WHERE task_key=? "
                    "AND host=? AND status IN ('pending','running')", (MEDIA_TASK, store.host)).fetchall()
            with _mutex(state_for(self.contract.db_path)):
                ids = [row['id'] for row in rows if task_control.requested(
                    self.contract.db_path, row['id'], (row['parent_run_id'], row['root_run_id'])) == 'resume']
                receipt['media_paused'] = {**_coded('labels.upgradeRepairs.mediaPaused', {'error': nested_message(error)}),
                                           'run_ids': ids, 'commands': {}}
                self._save_receipt(receipt)
                for run_id in ids:
                    task_control.request(store, run_id, 'pause')
                    receipt['media_paused']['commands'][str(run_id)] = task_control.intent(
                        self.contract.db_path, run_id)['id']
                self._save_receipt(receipt)

    def start(self) -> None:
        if self.available and not self.scheduler.running:
            on_finished = getattr(self.contract.followups, 'on_finished', None)
            if not self._listening and on_finished is not None:
                on_finished(self._followup_finished)
                self._listening = True
            # 派发线程由调度器起，首轮立即跑、不挡服务启动：同步跑完首轮才返回，HTTPS 要晚一分钟才监听。
            self.scheduler.add_job(self._run, max_instances=1)
            self.scheduler.add_job(self._settle_verification, max_instances=1)
            self.scheduler.add_job(self._settle_spaced_performers, max_instances=1)
            self.scheduler.add_job(self._settle_enhancement_names, max_instances=1)
            self.scheduler.add_job(self._backfill_identities, max_instances=1)
            self.scheduler.add_job(self._repair_feed_overflow, max_instances=1)
            self.scheduler.add_job(self._release_studio_misses, max_instances=1)
            self.scheduler.add_job(self._clear_stale_codes, max_instances=1)
            self.scheduler.add_job(self._prune_task_controls, max_instances=1)
            self.scheduler.add_job(self._prune_repair_checkpoints, max_instances=1)
            self.scheduler.add_job(self._prune_failed_followups, max_instances=1)
            self.scheduler.add_job(self._prune_processing_state, max_instances=1)
            self.scheduler.add_job(self._backfill_avatar_faces, max_instances=1)
            self.scheduler.start()

    def stop(self) -> None:
        self.stopping.set()
        self._wake.set()
        if self.scheduler.running:
            self.scheduler.shutdown(wait=True)
        if self.available:
            self.contract.followups.stop(wait_for=(MEDIA_TASK,))


def _media_run(contract, key: str, handle) -> dict:
    # 旧队列保留撤下状态，新规则拥有独立回执。
    if f':{upgrade_rules.DISPLAY_DIMENSIONS}:' in key:
        return {'outcome': 'skipped', **_coded('labels.upgradeRepairs.displayProbeRetired', key='reason')}
    if f':{upgrade_rules.DISPLAY_DIMENSIONS_SAR}:' in key:
        return _display_run(contract, key, handle)
    if batch_members(key) is not None:
        return _batch_run(contract, key, handle)
    from .settings_file import load_config
    from .library_processing import process_library
    from .storage_budget import CapacityGuard
    asset_id = int(key.rsplit(':', 1)[1])
    config = getattr(contract, 'upgrade_config', None) or load_config()
    state_file = Path(contract.follow_state_root) / 'upgrade-repairs' / f'{asset_id}.json'
    previous = _read(state_file)
    job_id = key.replace(':', '-')
    if previous.get('job_id', job_id) != job_id:
        previous = {}
    if previous:
        previous.update(issue_count=0, paused_count=0, issue_preview=[], retryable_asset_ids=[],
                        paused_asset_ids=[])
    service = getattr(contract, 'upgrade_repairs', None)
    with contract.database.read_connection() as connection:
        found = connection.execute('SELECT id,code,name,path FROM asset WHERE id=?', (asset_id,)).fetchone()
    title = _title(found) if found else interface_text.text('server:labels.upgradeRepairs.video', {'id': asset_id})
    def active():
        return service is None or not service.stopping.is_set()
    try:
        if service is not None:
            paused = _read(service.receipt).get('media_paused')
            if paused:
                raise DiskSpaceDenied('errors.upgradeRepairs.mediaPaused', {'message': _paused_phrase(paused)})
        try:
            offline = found is not None and mount_unreachable(found['path'])
        except MalformedPath as error:
            _fail(contract, key, handle, [asset_id], error)
        if offline:
            return _defer(contract, key, handle, [asset_id],
                          RepairDeferred('deferMountMedia', MOUNT_RETRY_SECONDS))
        guard = CapacityGuard(config)
        guard.check(force=True)
        result = process_library(config, contract.db_path, contract.candidate_root, contract.cover_root,
                             database=contract.database, asset_ids=[asset_id],
                             stage='collect',
                             recheck_existing=True, job_id=job_id,
                             state_file=state_file, resume_state=previous or None,
                             active=active,
                             report=lambda state: handle.progress(
                                 **_media_progress(state, 'subjectStage', subject=title)))
        guard.check(force=True)
    except DiskSpaceDenied as error:
        _pause_for_capacity(service, handle, error)
    except InterruptedError:
        if not active():
            raise JobPaused('errors.upgradeRepairs.resumeAfterRestart') from None
        raise
    # 走完全程只剩这部片自己的问题（坏文件探不出时长、抽不出帧）算完成；卡在来源冷却上的
    # 延后到来源放开再派，不算失败；其余未完成的按失败结算，由退避重派。
    finished = result.get('status') in ('complete', 'succeeded') or (
        result.get('outcome') == 'partial' and not result.get('paused_count'))
    if not finished and asset_id in result.get('paused_asset_ids', ()):
        return _defer(contract, key, handle, [asset_id],
                      RepairDeferred('deferCooling', COOLDOWN_RETRY_SECONDS))
    if not finished:
        if result.get('error'):
            raise RuntimeError(result['error'])
        raise UserRuntimeError('errors.upgradeRepairs.mediaRepairIncomplete')
    discard_checkpoint(state_file)
    return {**said('videoUpgraded'), 'name': title, 'asset_id': asset_id}


def _batch_run(contract, key: str, handle) -> dict:
    """一批影片共用一次 `process_library`，每部片的结论各自写进状态表。

    结论与单部时一致：走完全程只剩片子自己的问题算完成，卡在来源冷却上的、所在目录读不到的
    延后；整轮没走完（不是部分完成）按这一批失败结算，由退避重派。
    """
    from .settings_file import load_config
    from .library_processing import process_library
    from .storage_budget import CapacityGuard
    rule, asset_ids = batch_members(key)
    config = getattr(contract, 'upgrade_config', None) or load_config()
    job_id, state_file, previous = _batch_checkpoint(contract, key)
    service = getattr(contract, 'upgrade_repairs', None)
    with contract.database.read_connection() as connection:
        found = {row['id']: row for row in connection.execute(
            'SELECT id,path FROM asset WHERE id IN (SELECT value FROM json_each(?))', (json.dumps(asset_ids),))}
    offline, broken = [], {}
    for asset_id in asset_ids:
        try:
            if asset_id in found and mount_unreachable(found[asset_id]['path']):
                offline.append(asset_id)
        except MalformedPath as error:
            broken[asset_id] = nested_message(error)
    targets = [asset_id for asset_id in asset_ids if asset_id in found and asset_id not in offline
               and asset_id not in broken]

    def active():
        return service is None or not service.stopping.is_set()
    result = {'status': 'complete'}
    try:
        if service is not None:
            paused = _read(service.receipt).get('media_paused')
            if paused:
                raise DiskSpaceDenied('errors.upgradeRepairs.mediaPaused', {'message': _paused_phrase(paused)})
        if targets:
            guard = CapacityGuard(config)
            guard.check(force=True)
            result = process_library(config, contract.db_path, contract.candidate_root, contract.cover_root,
                                     database=contract.database, asset_ids=targets, stage='collect',
                                     recheck_existing=True, job_id=job_id, state_file=state_file,
                                     resume_state=previous or None, active=active,
                                     report=lambda state: handle.progress(
                                         **_media_progress(state, 'videosStage', count=len(targets))))
            guard.check(force=True)
    except DiskSpaceDenied as error:
        _pause_for_capacity(service, handle, error)
    except InterruptedError:
        if not active():
            raise JobPaused('errors.upgradeRepairs.resumeAfterRestart') from None
        raise
    if result.get('status') not in ('complete', 'succeeded') and result.get('outcome') != 'partial':
        if result.get('error'):
            raise RuntimeError(result['error'])
        raise UserRuntimeError('errors.upgradeRepairs.mediaRepairIncomplete')
    cooling = [asset_id for asset_id in targets if asset_id in set(result.get('paused_asset_ids', ()))]
    settled = _settle_batch(contract, handle, rule, asset_ids, offline, cooling, broken)
    discard_checkpoint(state_file)
    return settled


def _batch_checkpoint(contract, key: str) -> tuple[str, Path, dict]:
    """一批的任务号、断点文件与可续跑的断点；上一轮的问题计数清零，换了批次的断点不认。"""
    digest = _batch_digest(key)
    job_id = f'{MEDIA_TASK}-batch-{digest}'
    state_file = Path(contract.follow_state_root) / 'upgrade-repairs' / f'batch-{digest}.json'
    previous = _read(state_file)
    if previous.get('job_id', job_id) != job_id:
        previous = {}
    if previous:
        previous.update(issue_count=0, paused_count=0, issue_preview=[], retryable_asset_ids=[],
                        paused_asset_ids=[])
    return job_id, state_file, previous


def _settle_batch(contract, handle, rule: str, asset_ids, offline, cooling, broken=None) -> dict:
    """一批里每部片的结论写进状态表：目录读不到、来源冷却的延后，路径写法不对的（`broken`，影片到原因）
    按失败结算、不自动重派，其余完成。"""
    broken = broken or {}
    done = [asset_id for asset_id in asset_ids
            if asset_id not in offline and asset_id not in cooling and asset_id not in broken]
    now = time.time()
    item_rule = f'media:{rule}'
    rows = [{'rule': item_rule, 'asset_id': asset_id, 'state': 'done', 'run_id': _run_id(handle),
             'result': _NOT_DEFERRED} for asset_id in done]
    rows += [{'rule': item_rule, 'asset_id': asset_id, 'state': 'deferred', 'run_id': _run_id(handle),
              'retry_at': now + MOUNT_RETRY_SECONDS, 'result': {'deferred': DEFER_MOUNT}} for asset_id in offline]
    rows += [{'rule': item_rule, 'asset_id': asset_id, 'state': 'deferred', 'run_id': _run_id(handle),
              'retry_at': now + COOLDOWN_RETRY_SECONDS, 'result': {'deferred': DEFER_COOLDOWN}} for asset_id in cooling]
    rows += [{'rule': item_rule, 'asset_id': asset_id, 'state': 'failed', 'run_id': _run_id(handle),
              'result': {'deferred': None, 'error': error}} for asset_id, error in broken.items()]
    with contract.database.write_transaction(notify=False) as connection:
        upsert_items(connection, rows, mode='finish')
    _discard_settled(Path(contract.follow_state_root) / 'upgrade-repairs', item_rule, done)
    deferred = len(offline) + len(cooling)
    outcome = joined([part('videosUpgraded', count=len(done)),
                      part('videosDeferred', count=deferred) if deferred else [],
                      part('videosMalformed', count=len(broken)) if broken else []])
    return {**said(outcome), 'asset_ids': asset_ids, 'done': len(done), 'deferred': deferred,
            **({'failed': len(broken)} if broken else {})}


def _display_run(contract, key: str, handle) -> dict:
    from . import display_dimensions_repair
    from .jobs import DiskSpaceDenied, JobPaused
    from .settings_file import load_config, DATA_ROOT_ENV
    from .storage_budget import CapacityGuard
    from .task_control import checkpoint
    asset_id = int(key.rsplit(':', 1)[1])
    supplied = getattr(contract, 'upgrade_config', None)
    config = load_config(environ={DATA_ROOT_ENV: str(supplied.data_root)}) if supplied else load_config()
    service = getattr(contract, 'upgrade_repairs', None)
    guard = CapacityGuard(config)

    def available():
        checkpoint('probe')
        if service is not None and service.stopping.is_set():
            raise JobPaused('errors.upgradeRepairs.resumeAfterRestart')
        guard.check(force=True)

    try:
        if service is not None:
            paused = _read(service.receipt).get('media_paused')
            if paused:
                raise DiskSpaceDenied('errors.upgradeRepairs.mediaPaused', {'message': _paused_phrase(paused)})
        handle.progress(**stage_label('upgrade.displayDimensionsAll'))
        result = display_dimensions_repair.reprobe(contract, config, asset_id, checkpoint=available,
                                                   expected_generation=key.rsplit(':', 2)[1],
                                                   run_id=_run_id(handle))
    except RepairDeferred as error:
        return _defer(contract, key, handle, [asset_id], error)
    except MalformedPath as error:
        _fail(contract, key, handle, [asset_id], error)
    except DiskSpaceDenied as error:
        _pause_for_capacity(service, handle, error)
    except InterruptedError:
        if service is not None and service.stopping.is_set():
            raise JobPaused('errors.upgradeRepairs.resumeAfterRestart') from None
        raise
    return {**({'outcome': 'skipped'} if result.get('skipped') else said('dimensionsMeasured')),
            'asset_id': asset_id, 'dimensions_changed': result['changed']}


def _run_id(handle) -> int | None:
    run_id = getattr(handle, 'run_id', None)
    return run_id if isinstance(run_id, int) else None


def _defer(contract, key: str, handle, asset_ids, error: RepairDeferred) -> dict:
    """这几部片延后：状态表记下重派时间，这一轮按完成结算，不算失败、不计次数。"""
    rule, _, generation = item_of(key) or ('', 0, '')
    until = time.time() + error.retry_after
    with contract.database.write_transaction(notify=False) as connection:
        upsert_items(connection, [{'rule': rule, 'asset_id': asset_id, 'generation': generation, 'state': 'deferred',
                                   'run_id': _run_id(handle), 'retry_at': until,
                                   'result': {'deferred': DEFER_REASONS.get(error.code)}} for asset_id in asset_ids],
                     mode='finish')
    return {**said(part('deferredBy', reason=[part(error.code)])), 'deferred': len(asset_ids), 'retry_at': until}


def _fail(contract, key: str, handle, asset_ids, error: MalformedPath):
    """这几部片补不了、重派也没用（路径写法不对）：状态表按失败结算并写明原因（`{code, params}`），
    不排自动重派，只等用户在「自动修复」点重试；再把原因抛给任务中心，这一轮照样显示失败。"""
    rule, _, generation = item_of(key) or ('', 0, '')
    with contract.database.write_transaction(notify=False) as connection:
        upsert_items(connection, [{'rule': rule, 'asset_id': asset_id, 'generation': generation, 'state': 'failed',
                                   'run_id': _run_id(handle),
                                   'result': {'deferred': None, 'error': nested_message(error)}}
                                  for asset_id in asset_ids], mode='finish')
    raise error


def _pause_for_capacity(service, handle, error):
    """容量触线：整批暂停，这一条挂回队列，用户显式重试后接着跑。没有服务（命令行）照旧抛出。"""
    if service is None:
        raise error
    service.pause_media(error, run_id=_run_id(handle))
    raise CapacityPaused(error.code, error.params) from error


TYPE = register(FollowupType(MEDIA_TASK, interface_text.text('server:stage.upgrade.updateMetadata'), True, _media_run,
                             prunes_failures=True))
