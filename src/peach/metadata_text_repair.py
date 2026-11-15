"""按字段归属和同番号来源证据补修已损坏的机器文字。

0.51.0 之前中文 Windows 上的采集桥按 GBK 输出、主程序按 UTF-8 宽松读，人物名里留下 U+FFFD
（#478）。标题、片商这些字段里的 U+FFFD 不看是哪个来源写的：无主、文件名或自动写入的按同番号的
干净来源替换，复核批准过的只重采、交回复核（#208），只有用户手改的不碰。刮削来源（`javinizer:*`）挂上的这类人物关联在升级时直接解除，`performer:` 标签一起删，
作品按现行严格解码重采；失去全部关联、也没有人维护痕迹的乱码实体连同子表行删掉。删掉的每一行
原样记进升级回执的 `garbled_people`，可用
`revert_auto_landing.py --source upgrade:garbled-performers` 整批插回。
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from .field_owners import auto_owner, is_protected, owner_of
from . import artifact_rules, upgrade_rules
from .javdb_identity import current_evidence
from .metadata import extract_peach_fields, identifies_code, source_text_is_valid, validate_provider_code
from .metadata_auto_apply import _apply_metadata_candidate, metadata_auto_apply_candidate
from .metadata_policy import SOURCE_SPECS
from .user_messages import UserValueError

FIELDS = {'title': 'catalog_title', 'original_title': 'original_title',
          'studio': 'studio', 'series': 'series'}
MARKER = '\ufffd'
#: 回执里记乱码人物补修删掉的行；撤回脚本按 `GARBLED_PEOPLE_SOURCE` 认这一类。
RECEIPT_KEY = 'garbled_people'
GARBLED_PEOPLE_SOURCE = 'upgrade:garbled-performers'
#: 人维护的订阅与链接：挂着这些的乱码实体只解关联、不删。
_CURATED_TABLES = ('follow_source', 'feed_source', 'entity_link')


def _damaged_snapshots(connection, root: Path) -> tuple[list[dict], list[int]]:
    """失效损坏文字或旧 JavDB 绑定快照，保留原文并选择对应资产重采。"""
    snapshots, affected = [], []
    for path in root.glob('*.json'):
        code, separator, source = path.stem.rpartition('-')
        if not separator or source not in SOURCE_SPECS or path.is_symlink():
            continue
        try:
            code = validate_provider_code(code)
            before = artifact_rules.fingerprint(path)
            payload = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if not isinstance(payload, dict) or (source_text_is_valid(payload)
                and (source != 'javdb' or current_evidence(payload))):
            continue
        snapshots.append({'path': str(path), 'fingerprint': before})
        affected.extend(row[0] for row in connection.execute(
            "SELECT id FROM asset WHERE code=? AND medium='video' AND disposal IS NULL", (code,)))
    return snapshots, affected


def _invalidate_snapshots(snapshots: list[dict]) -> int:
    count = 0
    for item in snapshots:
        path = Path(item['path'])
        try:
            if artifact_rules.fingerprint(path) != item['fingerprint']:
                continue
            artifact_rules.remember(path, f'invalid:provider-text-{upgrade_rules.PROVIDER_TEXT}')
            count += 1
        except FileNotFoundError:
            continue
    return count


def _candidates(root: Path, code: str, field: str) -> list[dict]:
    candidates = []
    for source in SOURCE_SPECS:
        path = root / f'{code}-{source}.json'
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except FileNotFoundError:
            continue
        except (ValueError, UnicodeError):
            continue
        if (not isinstance(payload, dict) or not identifies_code(code, payload)
                or source == 'javdb' and not current_evidence(payload)):
            continue
        value = extract_peach_fields(payload).get(field)
        if not value:
            continue
        key = hashlib.sha256(json.dumps([source, value['value']], ensure_ascii=False,
                                       sort_keys=True).encode()).hexdigest()
        candidate = {**value, 'candidate_key': key, 'source': source,
                     'provider_id': payload.get('id'), 'content_id': payload.get('content_id'),
                     'source_url': payload.get('source_url'), 'raw_snapshot': str(path),
                     'confidence': .75}
        if source == 'javdb':
            candidate.update(javdb_rule=payload['javdb_rule'], source_id=payload.get('source_id'))
        candidates.append(candidate)
    return candidates


def collect(connection, snapshots: Path) -> dict:
    """选中损坏文字与失效来源快照的资产。

    刮削来源挂上的乱码人物关联记成 `unlink`；其他角色的乱码实体仍只计复核。
    """
    tests = ' OR '.join(f'instr(COALESCE(a.{column},\'\'),?)>0' for column in FIELDS.values())
    assets = connection.execute(
        f"SELECT a.* FROM asset a WHERE a.medium='video' AND a.disposal IS NULL AND ({tests} "
        "OR EXISTS(SELECT 1 FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id "
        "WHERE ae.asset_id=a.id AND ae.source LIKE 'javinizer:%' AND instr(e.canonical_name,?)>0))",
        [MARKER] * (len(FIELDS) + 1)).fetchall()
    rows, affected = [], []
    for asset in assets:
        damaged_roles = connection.execute(
            "SELECT ae.role,e.id,ae.source,e.canonical_name FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id "
            "WHERE ae.asset_id=? AND ae.source LIKE 'javinizer:%' AND instr(e.canonical_name,?)>0",
            (asset['id'], MARKER)).fetchall()
        for role, entity_id, source, name in damaged_roles:
            if role == 'performer':
                # 名字里的 U+FFFD 是确定的损坏证据：解除关联不看番号，作品照样排进重采。
                rows.append({'asset_id': asset['id'], 'field': role, 'entity_id': entity_id,
                             'source': source, 'name': name, 'action': 'unlink'})
            else:
                rows.append({'asset_id': asset['id'], 'field': role, 'entity_id': entity_id,
                             'action': 'review', 'reason': 'entity-identity-requires-review'})
        if damaged_roles:
            affected.append(asset['id'])
        try:
            code = validate_provider_code(str(asset['code'] or ''))
        except ValueError:
            continue
        for field, column in FIELDS.items():
            current, owner = asset[column] or '', owner_of(asset['field_owners'], column)
            if MARKER not in current or owner.startswith('user:'):
                continue
            affected.append(asset['id'])
            if is_protected(owner):
                # 复核时批准的是当时那份乱码（#208）：人的结论不自动改，但片子照样按现行严格解码
                # 重采，干净的候选回到复核页与这个值并排。
                rows.append({'asset_id': asset['id'], 'field': field, 'column': column, 'current': current,
                             'owner': owner, 'action': 'review', 'reason': 'reviewed-garbled-text'})
                continue
            group = {'item_key': f'asset:{asset["id"]}:{field}', 'asset_id': asset['id'],
                     'asset_path': asset['path'], 'field': field, 'code': code,
                     'current_value': current, 'candidates': _candidates(snapshots, code, field)}
            candidate = metadata_auto_apply_candidate(connection, group)
            rows.append({'asset_id': asset['id'], 'field': field, 'column': column,
                         'current': current, 'owner': owner, 'group': group,
                         'candidate': candidate, 'action': 'replace' if candidate else 'review'})
    invalid_snapshots, snapshot_assets = _damaged_snapshots(connection, snapshots)
    return {'rows':rows, 'asset_ids':sorted(set(affected + snapshot_assets)), 'snapshots':invalid_snapshots}


def apply(connection, plan: dict) -> dict:
    """按计划补修；`RECEIPT_KEY` 下是删掉的逐行快照，由调用方移进回执顶层。"""
    changed = 0
    stamp = datetime.now(timezone.utc).isoformat()
    for row in plan['rows']:
        if row['action'] != 'replace':
            continue
        current = connection.execute(
            f'SELECT {row["column"]},field_owners FROM asset WHERE id=?', (row['asset_id'],)).fetchone()
        if (current is None or current[0] != row['current']
                or owner_of(current[1], row['column']) != row['owner']):
            continue
        candidate = row['candidate']
        changed += bool(_apply_metadata_candidate(connection, row['group'], candidate, stamp,
                                                 auto_owner(candidate['source'])))
    garbled = _unlink_garbled(connection, plan['rows'])
    return {'text_fields':changed, 'text_review':sum(r['action']=='review' for r in plan['rows']),
            'text_unlinked':len(garbled['links']),
            'text_entities_removed':sum(entity['action'] == 'removed' for entity in garbled['entities']),
            'text_snapshots_invalidated':_invalidate_snapshots(plan.get('snapshots', [])),
            RECEIPT_KEY: garbled}


def _select(connection, sql: str, parameters=()) -> list[dict]:
    cursor = connection.execute(sql, parameters)
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def _entity_references(connection, entity_id: int) -> list[dict]:
    """外键指向这条实体的全部子表行。外键清单从 schema 读，新表不用回来改这里。"""
    found, seen = [], set()
    for (table,) in connection.execute("SELECT name FROM sqlite_schema WHERE type='table'").fetchall():
        for foreign in connection.execute(f'PRAGMA foreign_key_list("{table}")').fetchall():
            if foreign[2] != 'entity':
                continue
            for row in _select(connection, f'SELECT rowid AS "__rowid",* FROM "{table}" WHERE "{foreign[3]}"=?',
                               (entity_id,)):
                rowid = row.pop('__rowid')
                if (table, rowid) not in seen:
                    seen.add((table, rowid))
                    found.append({'table': table, 'rowid': rowid, 'row': row})
    return found


def _curated(connection, entity_id: int, references: list[dict]) -> str:
    """这条实体上还有关联或人维护的东西时返回原因：实体留着，只解刮削关联。"""
    from .upgrade_repairs import _manual_name
    if _manual_name(connection, entity_id):
        return 'manual-name'
    for reference in references:
        if reference['table'] == 'asset_entity':
            return 'still-linked'
        if reference['table'] in _CURATED_TABLES:
            return reference['table']
        source = str(reference['row'].get('source') or '')
        if is_protected(source) or source.startswith('script:'):
            return f'{reference["table"]}:{source}'
    return ''


def _dispose(connection, entity_id: int) -> dict:
    """处置解完关联的乱码实体，沿用孤儿实体「没有别的引用才删」的做法（`code_creators`、
    `follow_creators.revert`）。子表行连同实体行快照进回执。

    留下的实体也摘掉站上编号：`upsert_asset_entity` 先按编号认人，编号还挂在乱码实体上，
    重采回来的正确名字就会被挂回这条乱码实体。
    """
    entity = _select(connection, 'SELECT * FROM entity WHERE id=?', (entity_id,))
    if not entity:
        return {'entity_id': entity_id, 'action': 'missing', 'entity': None, 'rows': []}
    references = _entity_references(connection, entity_id)
    reason = _curated(connection, entity_id, references)
    removed = [item for item in references if item['table'] == 'entity_external_ref'] if reason else references
    for item in removed:
        connection.execute(f'DELETE FROM "{item["table"]}" WHERE rowid=?', (item['rowid'],))
    if not reason:
        connection.execute('DELETE FROM entity WHERE id=?', (entity_id,))
    return {'entity_id': entity_id, 'name': entity[0]['canonical_name'],
            'action': 'kept' if reason else 'removed', 'reason': reason,
            'entity': None if reason else entity[0],
            'rows': [{'table': item['table'], 'row': item['row']} for item in removed]}


def _unlink_garbled(connection, rows: list[dict]) -> dict:
    """解除乱码人物的刮削关联与对应的 `performer:` 标签；人手挂的关联不在选择范围内。"""
    links, tags, assets, entities = [], [], [], []
    for row in rows:
        if row['action'] != 'unlink':
            continue
        found = _select(
            connection,
            "SELECT ae.* FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id WHERE ae.asset_id=? "
            "AND ae.entity_id=? AND ae.role='performer' AND ae.source=? AND ae.source LIKE 'javinizer:%' "
            "AND instr(e.canonical_name,?)>0", (row['asset_id'], row['entity_id'], row['source'], MARKER))
        if not found:
            continue
        connection.execute("DELETE FROM asset_entity WHERE asset_id=? AND entity_id=? AND role='performer' "
                           "AND source=?", (row['asset_id'], row['entity_id'], row['source']))
        links.extend(found)
        assets.append(row['asset_id'])
        entities.append(row['entity_id'])
    for asset_id in dict.fromkeys(assets):
        for tag in _select(connection, "SELECT * FROM asset_tag WHERE asset_id=? "
                           "AND source LIKE 'javinizer:%:performer' AND instr(tag,?)>0", (asset_id, MARKER)):
            connection.execute('DELETE FROM asset_tag WHERE asset_id=? AND tag=? AND source=?',
                               (tag['asset_id'], tag['tag'], tag['source']))
            tags.append(tag)
    return {'links': links, 'tags': tags,
            'entities': [_dispose(connection, entity_id) for entity_id in dict.fromkeys(entities)]}


def _present(connection, table: str, row: dict) -> bool:
    tests = ' AND '.join(f'"{column}" IS ?' for column in row)
    return connection.execute(f'SELECT 1 FROM "{table}" WHERE {tests} LIMIT 1',
                              tuple(row.values())).fetchone() is not None


def planned_revert(connection, source: str, batch: str = '') -> list[dict]:
    """乱码人物补修删掉、账本里现在还没有的行；`batch` 是回执行的 id（升级补修版本）。

    按当前状态认：已经插回的、或之后重采写回了同一行的，都不再列出。先实体、再子表与关联。
    """
    if source != GARBLED_PEOPLE_SOURCE:
        return []
    planned = []
    for receipt_id, encoded in connection.execute(
            'SELECT id,result_json FROM ledger_upgrade_repair WHERE json_type(result_json,?) IS NOT NULL '
            'ORDER BY CAST(applied_at AS REAL)', (f'$.{RECEIPT_KEY}',)).fetchall():
        if batch and receipt_id != batch:
            continue
        detail = json.loads(encoded)[RECEIPT_KEY]
        entities = detail.get('entities', [])
        rows = [{'table': 'entity', 'row': entity['entity']} for entity in entities if entity.get('entity')]
        rows += [item for entity in entities for item in entity.get('rows', [])]
        rows += [{'table': 'asset_entity', 'row': row} for row in detail.get('links', [])]
        rows += [{'table': 'asset_tag', 'row': row} for row in detail.get('tags', [])]
        planned.extend({**item, 'batch': receipt_id} for item in rows
                       if not _present(connection, item['table'], item['row']))
    return planned


def revert(connection, planned: list[dict]) -> int:
    """按 `planned_revert` 把行原样插回，返回插回几行。不开不提交事务，由调用方包住。

    实体的 id 或名字已被别的实体占用时整批拒绝；作品已删掉的关联与标签跳过；
    站上编号已归了别人（重采后挂到正确的人）时保持现状。
    """
    restored = 0
    for item in planned:
        row = item['row']
        if item['table'] == 'entity':
            taken = connection.execute('SELECT id FROM entity WHERE id=? OR (kind=? AND normalized_name=?)',
                                       (row['id'], row['kind'], row['normalized_name'])).fetchone()
            if taken is not None:
                raise UserValueError("errors.metadataTextRepair.entityTaken", {"id": row["id"], "name": row["canonical_name"]})
        elif 'asset_id' in row and connection.execute(
                'SELECT 1 FROM asset WHERE id=?', (row['asset_id'],)).fetchone() is None:
            continue
        columns = ','.join(f'"{column}"' for column in row)
        restored += connection.execute(
            f'INSERT OR IGNORE INTO "{item["table"]}"({columns}) VALUES({",".join("?" * len(row))})',
            tuple(row.values())).rowcount or 0
    return restored
