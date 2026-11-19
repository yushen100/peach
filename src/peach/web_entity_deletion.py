"""实体批量接口的删除流程，协调范围预览、备份与三种删除模式。"""
from __future__ import annotations

import hashlib
import json
from contextlib import ExitStack
from datetime import datetime, timezone
from uuid import uuid4

from filelock import FileLock

from .entities import FLAT_COLUMN, normalize_entity_name
from .catalog_vocabulary import PERFORMER_TAG_PREFIX
from .field_owners import USER_MANUAL, write_owned_fields
from .migrations import sqlite_backup
from .previews import entity_image_key
from .user_messages import UserValueError


ROSTER_KINDS = frozenset({"performer", "creator", "studio", "agency", "series"})
DELETE_MODES = frozenset({"profile", "trash", "purge"})

# 连接关闭外键检查时，显式执行 schema 声明的级联与置空。
CHILDREN = (
    ("asset_entity", "entity_id"), ("entity_alias", "entity_id"),
    ("entity_link", "entity_id"), ("entity_search_term", "entity_id"),
    ("entity_external_ref", "entity_id"), ("entity_classification", "entity_id"),
    ("performer_profile", "entity_id"), ("feed_discovery_entity", "entity_id"),
    ("entity_membership", "member_id"), ("entity_membership", "agency_id"),
    ("label_maker", "label_id"), ("label_maker", "maker_id"),
    ("entity_identity_link", "left_id"), ("entity_identity_link", "right_id"),
    ("entity_redirect", "target_id"),
)


def deletion_plan(connection, ids: list[int]) -> dict:
    """绑定所选身份、作品关联与旧投影，确认后变化就重新确认。"""
    marks = ",".join("?" for _ in ids)
    rows = [dict(row) for row in connection.execute(
        f"SELECT * FROM entity WHERE id IN ({marks}) ORDER BY id", ids)]
    if len(rows) != len(ids) or any(row["kind"] not in ROSTER_KINDS for row in rows):
        raise UserValueError("api.entityBatch.selectionChanged")
    aliases = [list(row) for row in connection.execute(
        f"SELECT entity_id,alias,normalized_alias,source FROM entity_alias "
        f"WHERE entity_id IN ({marks}) ORDER BY entity_id,normalized_alias,source", ids)]
    names: dict[str, set[str]] = {}
    by_id = {row["id"]: row["kind"] for row in rows}
    for row in rows:
        names.setdefault(row["kind"], set()).add(normalize_entity_name(row["canonical_name"]))
    for entity_id, alias, _normalized, _source in aliases:
        names[by_id[entity_id]].add(normalize_entity_name(alias))
    # 别名允许同名。仍由其它档案使用的写法保留其作品投影。
    for kind, spelling in connection.execute(
            f"SELECT kind,canonical_name FROM entity WHERE id NOT IN ({marks}) UNION ALL "
            "SELECT e.kind,al.alias FROM entity_alias al JOIN entity e ON e.id=al.entity_id "
            f"WHERE e.id NOT IN ({marks})", [*ids, *ids]):
        if kind in names:
            names[kind].discard(normalize_entity_name(spelling))
    links = [list(row) for row in connection.execute(
        f"SELECT * FROM asset_entity WHERE entity_id IN ({marks}) "
        "ORDER BY asset_id,entity_id,role,source", ids)]
    columns = []
    for kind, column in FLAT_COLUMN.items():
        if kind in names:
            columns.extend([asset_id, column, value] for asset_id, value in connection.execute(
                f"SELECT id,{column} FROM asset WHERE {column} IS NOT NULL ORDER BY id")
                if normalize_entity_name(value) in names[kind])
    tags = []
    if "performer" in names:
        tags = [list(row) for row in connection.execute(
            "SELECT asset_id,tag FROM asset_tag WHERE tag LIKE ? ORDER BY asset_id,tag",
            (PERFORMER_TAG_PREFIX + "%",))
            if normalize_entity_name(row[1][len(PERFORMER_TAG_PREFIX):]) in names["performer"]]
    assets = {row[0] for row in links} | {row[0] for row in columns} | {row[0] for row in tags}
    scopes, content_rows, shared = _content_scope(connection, rows)
    payload = json.dumps([rows, aliases, links, columns, tags, scopes, content_rows, sorted(shared)],
                         ensure_ascii=False, sort_keys=True)
    return {"entities": rows, "assets": len(content_rows), "profile_assets": len(assets),
            "columns": columns, "tags": tags, "asset_rows": content_rows, "scopes": scopes,
            "bytes": sum(row['size'] or 0 for row in content_rows), "shared": len(shared),
            "token": hashlib.sha256(payload.encode()).hexdigest()}


def _content_scope(connection, entities: list[dict]) -> tuple[dict, list[dict], set[int]]:
    """所选档案的完整馆藏范围，以及仍与其他档案共享的作品。"""
    from .web_entity import scope_predicate
    ids = [entity['id'] for entity in entities]
    marks = ','.join('?' for _ in ids)
    scopes, content = {}, {}
    for entity in entities:
        scoped = [dict(row) for row in connection.execute(
            "SELECT DISTINCT a.id,a.location,a.path,a.snapshot_path,a.name,a.code,a.medium,a.size,"
            "a.mutation_revision,a.disposal FROM asset_entity ae CROSS JOIN asset a ON a.id=ae.asset_id "
            f"WHERE {scope_predicate(entity['kind'], 'ae.entity_id')} ORDER BY a.id", (entity['id'],))]
        scopes[entity['id']] = [row['id'] for row in scoped]
        content.update((row['id'], row) for row in scoped)
    content_ids = sorted(content)
    shared = set()
    for start in range(0, len(content_ids), 500):
        chunk = content_ids[start:start + 500]
        holes = ','.join('?' for _ in chunk)
        shared.update(row[0] for row in connection.execute(
            f"SELECT DISTINCT ae.asset_id FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id "
            f"WHERE ae.asset_id IN ({holes}) AND ae.entity_id NOT IN ({marks}) "
            "AND e.kind IN ('performer','creator','studio','series')", [*chunk, *ids]))
    content_rows = [content[key] for key in content_ids]
    return scopes, content_rows, shared


def delete_entities(connection, plan: dict) -> list[int]:
    """在调用方事务里删除资料与引用，并清理收藏和作品上的兼容投影。"""
    ids = [row["id"] for row in plan["entities"]]
    marks = ",".join("?" for _ in ids)
    old_ids = {row[0] for row in connection.execute(
        f"SELECT r.old_id FROM entity_redirect r WHERE r.target_id IN ({marks})"
        " AND NOT EXISTS (SELECT 1 FROM entity e WHERE e.id=r.old_id)", ids)}
    removed = set(ids) | old_ids
    # 旧 id 可能被新实体复用。演员移除决定归档后，避免它套到新身份上。
    for item_key, in connection.execute(
            "SELECT item_key FROM review_decision WHERE category='performer-removal'").fetchall():
        if int(item_key.rsplit(":", 1)[-1]) in removed:
            connection.execute(
                "INSERT INTO review_decision_history(category,item_key,status,reviewer,note,decided_at,restored_at) "
                "SELECT category,item_key,status,reviewer,note,updated_at,? FROM review_decision "
                "WHERE category='performer-removal' AND item_key=?",
                (datetime.now(timezone.utc).isoformat(), item_key))
            connection.execute("DELETE FROM review_decision WHERE category='performer-removal' AND item_key=?",
                               (item_key,))
    for profile_id, raw in connection.execute("SELECT id,settings_json FROM profile").fetchall():
        try:
            settings = json.loads(raw or "{}")
        except (ValueError, TypeError):
            continue
        shortcuts = settings.get("libraryShortcuts") if isinstance(settings, dict) else None
        favorites = shortcuts.get("favorites") if isinstance(shortcuts, dict) else None
        if not isinstance(favorites, list):
            continue
        kept = [item for item in favorites if not isinstance(item, dict)
                or type(item.get("entity_id")) is not int or item["entity_id"] not in removed]
        if len(kept) != len(favorites):
            shortcuts["favorites"] = kept
            connection.execute("UPDATE profile SET settings_json=?,updated_at=? WHERE id=?",
                               (json.dumps(settings, ensure_ascii=False),
                                datetime.now(timezone.utc).isoformat(), profile_id))
    for asset_id, column, _value in plan["columns"]:
        write_owned_fields(connection, [asset_id], {column: None}, USER_MANUAL)
    connection.executemany("DELETE FROM asset_tag WHERE asset_id=? AND tag=?", plan["tags"])
    for table, column in CHILDREN:
        connection.execute(f"DELETE FROM {table} WHERE {column} IN ({marks})", ids)
    for table in ("follow_source", "feed_source"):
        connection.execute(f"UPDATE {table} SET entity_id=NULL WHERE entity_id IN ({marks})", ids)
    connection.execute(f"DELETE FROM entity WHERE id IN ({marks})", ids)
    return ids


def delete_profiles(contract, body: dict, ids: list[int]) -> dict:
    """备份后在一个事务里删除，提交失败时把暂存的头像恢复。"""
    from .web_batch import stage_purge, _restore_staged_media, _purge_receipt
    from .personal_records import purging
    mode = body.get('mode', 'profile')
    if not isinstance(mode, str) or mode not in DELETE_MODES:
        raise UserValueError('api.entityBatch.operationInvalid')
    with contract.read_connection() as connection:
        initial = deletion_plan(connection, ids)
        if body.get('token') != initial['token']:
            raise UserValueError('api.entityBatch.previewStale')
    assets = initial['asset_rows'] if mode == 'purge' else ()
    deferred = []
    with purging(row['id'] for row in assets):
        purge = stage_purge(assets, deferred_direct=deferred) if mode == 'purge' else None
        try:
            fields = _commit_delete(contract, body, ids, mode, purge, deferred)
        except BaseException:
            if purge is not None:
                _restore_staged_media([*purge['_staged'], *purge.get('_returned', [])])
            raise
    contract.cache_bust()
    if purge is not None:
        return _purge_receipt(contract, purge, **fields)
    return {"ok": True, **fields, "purged": 0, "blocked": [], "cleanup_pending": [], "cache_blocked": []}


def _commit_delete(contract, body, ids, mode, purge, deferred):
    from .web_batch import commit_purge, stage_purge
    from .web_entity_batch import _set_disposal
    with ExitStack() as locks, ExitStack() as rollback:
        with contract.write_transaction() as connection:
            connection.execute('BEGIN IMMEDIATE')
            plan = deletion_plan(connection, ids)
            if body.get("token") != plan["token"]:
                raise UserValueError("api.entityBatch.previewStale")
            stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            batch = f"{stamp}-{uuid4().hex[:8]}"
            backup = contract.db_path.with_name(f"ledger.pre-entity-delete-{batch}.db")
            sqlite_backup(contract.db_path, backup)
            before = set(map(tuple, connection.execute("PRAGMA foreign_key_check")))
            moved = []
            retained = []
            if mode == 'trash':
                moved = _set_disposal(connection, [row['id'] for row in plan['asset_rows']], True)
            if purge is not None:
                if deferred:
                    direct = stage_purge(deferred)
                    for key in ('_items', '_staged', 'blocked'):
                        purge[key].extend(direct[key])
                commit_purge(connection, purge)
                deleted_assets = set(purge['_ids'])
                retained = [entity_id for entity_id, assets in plan['scopes'].items()
                            if set(assets) - deleted_assets]
                ids = [entity_id for entity_id in ids if entity_id not in retained]
                plan = deletion_plan(connection, ids) if ids else None
            marks = ",".join("?" for _ in ids)
            old_ids = [row[0] for row in connection.execute(
                f"SELECT r.old_id FROM entity_redirect r WHERE r.target_id IN ({marks})"
                " AND NOT EXISTS (SELECT 1 FROM entity e WHERE e.id=r.old_id)", ids)]
            keys = {entity_image_key(row["kind"], row["id"]) for row in plan["entities"]} if plan else set()
            keys.update(entity_image_key(kind, old_id) for kind in ROSTER_KINDS for old_id in old_ids)
            for key in sorted(keys):
                if not contract.avatar_root.is_dir():
                    break
                locks.enter_context(FileLock(contract.avatar_root / f"{key}.install.lock", timeout=30))
                for suffix in (".img", ".img.ct", ".img.provenance.json", ".face.json"):
                    original = contract.avatar_root / f"{key}{suffix}"
                    if original.is_file():
                        saved = contract.avatar_root / "deleted" / batch / original.name
                        saved.parent.mkdir(parents=True, exist_ok=True)
                        original.replace(saved)
                        rollback.callback(saved.replace, original)
            changed = delete_entities(connection, plan) if plan else []
            if set(map(tuple, connection.execute("PRAGMA foreign_key_check"))) - before:
                raise ValueError("entity deletion failed the foreign key check")
        rollback.pop_all()
    return {"operation": "delete", "mode": mode, "entity_ids": changed, "asset_ids": moved,
            "retained_entity_ids": retained, "skipped": []}
