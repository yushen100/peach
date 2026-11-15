"""标签身份、兼容投影和用户管理决定；调用方负责事务与备份。"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from .catalog_rules import canonical_tag_name, clean_tag_name, tag_cat
from .catalog_vocabulary import is_performer_marker
from .entities import _transfer_favorites, merge_entity, normalize_entity_name
from .metadata_policy import SOURCE_SPECS
from .user_messages import UserValueError

_OFFICIAL_TAG_SOURCES = tuple(f'javinizer:{name}:tag' for name, spec in SOURCE_SPECS.items() if spec.official)


def rewrite_tag_projection(connection, old: str, new: str, *, asset_id: int | None = None) -> None:
    """规范标签跟随实体名称，来源原词保存在关系证据中。"""
    if old == new:
        return
    scope = ' AND asset_id=?' if asset_id is not None else ''
    params = (old, asset_id) if asset_id is not None else (old,)
    official_marks = ','.join('?' for _ in _OFFICIAL_TAG_SOURCES)
    entity = connection.execute("SELECT id FROM entity WHERE kind='tag' AND canonical_name IN (?,?) "
                                'ORDER BY canonical_name=? DESC LIMIT 1', (old, new, old)).fetchone()
    if entity:
        connection.execute(
            'INSERT OR IGNORE INTO asset_entity(asset_id,entity_id,role,source,confidence,metadata_json,first_seen_at,last_seen_at) '
            "SELECT asset_id,?,'tag',COALESCE(source,'tag-projection'),confidence,json_object('original_tag',tag),'','' "
            'FROM asset_tag WHERE tag=?' + scope, (entity[0], *params))
    connection.execute(
        'INSERT INTO asset_tag(asset_id,tag,confidence,source) '
        'SELECT asset_id,?,confidence,source FROM asset_tag WHERE tag=? '
        "AND COALESCE(source,'')<>'pixiv_tag'" + scope +
        ' ON CONFLICT(asset_id,tag) DO UPDATE SET confidence=max(confidence,excluded.confidence),source=CASE '
        f'WHEN source IN ({official_marks}) THEN source WHEN excluded.source IN ({official_marks}) THEN excluded.source '
        "WHEN excluded.confidence>confidence OR source='filename' THEN excluded.source ELSE source END",
        (new, *params, *_OFFICIAL_TAG_SOURCES, *_OFFICIAL_TAG_SOURCES))
    connection.execute("DELETE FROM asset_tag WHERE tag=? AND COALESCE(source,'')<>'pixiv_tag'" + scope, params)
    old_key, new_key = normalize_entity_name(old), normalize_entity_name(new)
    if old_key != new_key:
        connection.execute(
            'INSERT INTO asset_tag_preference(profile_id,asset_id,normalized_tag,hidden,updated_at) '
            'SELECT profile_id,asset_id,?,hidden,updated_at FROM asset_tag_preference WHERE normalized_tag=?' + scope +
            ' ON CONFLICT(profile_id,asset_id,normalized_tag) DO UPDATE SET hidden=max(hidden,excluded.hidden),'
            'updated_at=max(updated_at,excluded.updated_at)', (new_key, old_key, *(() if asset_id is None else (asset_id,))))
        connection.execute('DELETE FROM asset_tag_preference WHERE normalized_tag=?' + scope +
                           " AND NOT EXISTS(SELECT 1 FROM asset_tag raw WHERE raw.asset_id=asset_tag_preference.asset_id "
                           "AND raw.tag=? AND raw.source='pixiv_tag')",
                           (old_key, *(() if asset_id is None else (asset_id,)), old))
    if asset_id is None:
        connection.execute('UPDATE genre_decision SET peach_tag=? WHERE peach_tag=?', (new, old))


def tag_rows(connection) -> list[dict]:
    rows = []
    for row in connection.execute(
        "SELECT e.id,e.canonical_name,e.metadata_json,count(DISTINCT ae.asset_id) n FROM entity e "
        "LEFT JOIN asset_entity ae ON ae.entity_id=e.id WHERE e.kind='tag' GROUP BY e.id ORDER BY e.canonical_name"):
        aliases = [item[0] for item in connection.execute(
            'SELECT DISTINCT alias FROM entity_alias WHERE entity_id=? ORDER BY alias', (row[0],))]
        rows.append({'entity_id': row[0], 'k': row[1], 'n': row[3], 'aliases': aliases, 'cat': tag_cat(row[1]),
                     'hidden': bool(json.loads(row[2] or '{}').get('user_tag_hidden'))})
    return rows


def duplicate_groups(rows: list[dict]) -> list[list[int]]:
    groups: dict[str, list[int]] = {}
    for row in rows:
        key = normalize_entity_name(canonical_tag_name(row['k']))
        groups.setdefault(key, []).append(row['entity_id'])
    return [ids for ids in groups.values() if len(ids) > 1]


def _ids(body: dict) -> list[int]:
    values = body.get('ids')
    if not isinstance(values, list) or not values or len(values) > 2000 or any(type(value) is not int or value <= 0 for value in values):
        raise UserValueError('errors.tagManagement.selectionInvalid')
    return sorted(set(values))


def _validate_rename(rows, ids, name):
    """改名须对应一个有效名称，并避开其他实体及其别名。"""
    if len(ids) != 1 or not name or len(name) > 80 or is_performer_marker(name):
        raise UserValueError('errors.tagManagement.nameInvalid')
    key = normalize_entity_name(canonical_tag_name(name))
    for row in rows:
        if row['entity_id'] != ids[0] and key in {normalize_entity_name(canonical_tag_name(word)) for word in [row['k'], *row['aliases']]}:
            raise UserValueError('errors.tagManagement.nameTaken', {'name': name, 'tag': row['k']})


def preview(connection, body: dict) -> dict:
    operation = body.get('operation')
    if operation not in {'rename', 'merge', 'hide', 'restore', 'repair', 'delete'}:
        raise ValueError('unknown tag operation')
    rows = tag_rows(connection)
    groups = duplicate_groups(rows)
    ids = sorted({value for group in groups for value in group}) if operation == 'repair' else _ids(body)
    selected = [row for row in rows if row['entity_id'] in ids]
    if len(selected) != len(ids):
        raise UserValueError('errors.tagManagement.tagsChanged')
    name = clean_tag_name(str(body.get('name', '')))
    target = body.get('target_id')
    if operation == 'rename':
        _validate_rename(rows, ids, name)
    if operation == 'merge' and (len(ids) < 2 or type(target) is not int or target not in ids):
        raise UserValueError('errors.tagManagement.mergeSelection')
    marks = ','.join('?' for _ in ids) or 'NULL'
    assets = [row[0] for row in connection.execute(
        f'SELECT DISTINCT asset_id FROM asset_entity WHERE entity_id IN ({marks}) ORDER BY asset_id', ids)]
    # 名称、来源、偏好与映射任一变化都会使待执行计划失效。
    evidence = [list(row) for row in connection.execute(
        f'SELECT * FROM asset_entity WHERE entity_id IN ({marks}) ORDER BY asset_id,entity_id,role,source', ids)]
    names = sorted({name for row in selected for name in [row['k'], *row['aliases']]})
    holes = ','.join('?' for _ in names) or 'NULL'
    state = [selected, evidence, list(map(list, connection.execute(f'SELECT * FROM asset_tag WHERE tag IN ({holes}) ORDER BY asset_id,tag', names))),
             list(map(list, connection.execute(f'SELECT * FROM asset_tag_preference WHERE normalized_tag IN ({holes}) ORDER BY profile_id,asset_id,normalized_tag',
                                               [normalize_entity_name(name) for name in names]))),
             list(map(list, connection.execute(f'SELECT * FROM genre_decision WHERE peach_tag IN ({holes}) ORDER BY source_genre', names)))]
    token = hashlib.sha256(json.dumps([operation, ids, name, target, state], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return {'operation': operation, 'ids': ids, 'name': name, 'target_id': target,
            'tags': selected, 'assets': len(assets), 'overlap': sum(row['n'] for row in selected) - len(assets),
            'groups': groups if operation == 'repair' else [], 'token': token}


def _alias(connection, entity_id: int, name: str) -> None:
    connection.execute('INSERT OR IGNORE INTO entity_alias(entity_id,alias,normalized_alias,source,confidence) '
                       "VALUES(?,?,?,'user:tag-management',1)", (entity_id, name, normalize_entity_name(name)))


def _merge(connection, source: dict, target: dict, stamp: str) -> None:
    rewrite_tag_projection(connection, source['k'], target['k'])
    merge_entity(connection, target_id=target['entity_id'], source_id=source['entity_id'],
                 source_name=source['k'], alias_source='user:tag-management', now=stamp)


#: 删一条标签实体时一起清掉的子表：引用它的行连接默认 `foreign_keys=OFF`，库自己不会级联。
_ENTITY_CHILDREN = (('asset_entity', 'entity_id'), ('entity_alias', 'entity_id'), ('entity_link', 'entity_id'),
                    ('entity_search_term', 'entity_id'), ('entity_external_ref', 'entity_id'),
                    ('entity_classification', 'entity_id'), ('feed_discovery_entity', 'entity_id'),
                    ('entity_redirect', 'target_id'), ('entity_identity_link', 'left_id'),
                    ('entity_identity_link', 'right_id'))


def _delete(connection, row: dict) -> None:
    """删掉标签本身：标签实体、它挂在作品上的关联与扁平投影都去掉，作品留在库里。

    来源原词（`pixiv_tag`）是证据不是投影，留着；用户对这个标签的隐藏偏好跟着标签一起没了。"""
    names = [row['k'], *row['aliases']]
    holes = ','.join('?' for _ in names)
    connection.execute(f"DELETE FROM asset_tag WHERE tag IN ({holes}) AND COALESCE(source,'')<>'pixiv_tag'", names)
    keys = sorted({normalize_entity_name(name) for name in names})
    connection.execute(f"DELETE FROM asset_tag_preference WHERE normalized_tag IN ({','.join('?' for _ in keys)})", keys)
    tables = {item[0] for item in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    for table, column in _ENTITY_CHILDREN:
        if table in tables:
            connection.execute(f'DELETE FROM {table} WHERE {column}=?', (row['entity_id'],))
    for table in ('follow_source', 'feed_source'):
        if table in tables:
            connection.execute(f'UPDATE {table} SET entity_id=NULL WHERE entity_id=?', (row['entity_id'],))
    connection.execute("DELETE FROM entity WHERE id=? AND kind='tag'", (row['entity_id'],))


def apply_plan(connection, body: dict) -> dict:
    plan = preview(connection, body)
    if body.get('token') != plan['token']:
        raise UserValueError('errors.tagManagement.previewStale')
    foreign_keys_before = set(map(tuple, connection.execute('PRAGMA foreign_key_check')))
    stamp = datetime.now(timezone.utc).isoformat()
    operation = plan['operation']
    rows = plan['tags']
    if operation == 'rename':
        row = rows[0]
        _alias(connection, row['entity_id'], row['k'])
        rewrite_tag_projection(connection, row['k'], plan['name'])
        connection.execute('UPDATE entity SET canonical_name=?,normalized_name=?,updated_at=? WHERE id=?',
                           (plan['name'], normalize_entity_name(plan['name']), stamp, row['entity_id']))
        _transfer_favorites(connection, row['entity_id'], row['entity_id'], stamp)
    elif operation in {'merge', 'repair'}:
        by_id = {row['entity_id']: row for row in rows}
        groups = plan['groups'] if operation == 'repair' else [plan['ids']]
        for group in groups:
            if operation == 'repair':
                target = min((by_id[value] for value in group), key=lambda row: (row['k'] != canonical_tag_name(row['k']), -row['n'], row['entity_id']))
            else:
                target = by_id[plan['target_id']]
            for entity_id in group:
                if entity_id != target['entity_id']:
                    _merge(connection, by_id[entity_id], target, stamp)
    elif operation == 'delete':
        for row in rows:
            _delete(connection, row)
    else:
        for row in rows:
            connection.execute("UPDATE entity SET metadata_json=json_set(metadata_json,'$.user_tag_hidden',?),updated_at=? WHERE id=?",
                               (int(operation == 'hide'), stamp, row['entity_id']))
    if set(map(tuple, connection.execute('PRAGMA foreign_key_check'))) - foreign_keys_before:
        raise ValueError('tag operation failed the foreign key check')
    return {'ok': True, 'operation': operation, 'tags': len(rows), 'assets': plan['assets']}
