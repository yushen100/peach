"""名册与人物索引的批量动作及永久删除资料。

可逆动作交回这一批里真正变了的那几项，撤销按它原样做反向动作：订过的不再算进
「订上」，已经在回收站里的不算进「移进回收站」，撤销时也就不会把原本的状态一起改掉。
"""
from __future__ import annotations

import time

from . import entities, feeds
from .web_entity_deletion import ROSTER_KINDS, deletion_plan, delete_profiles
from .user_messages import UserValueError
from .web_entity import ROSTER_HIDDEN_KEY as HIDDEN_KEY, roster_hidden, scope_predicate

#: 名下作品移进回收站时按哪种实体取范围。事务所不在内：它名下是成员拍的片，一次移走
#: 整家事务所全部成员的作品不是名册上该有的一键。
CONTENT_KINDS = frozenset({"performer", "creator", "studio", "series", "tag"})

OPERATIONS = frozenset({"follow", "unfollow", "hide", "unhide", "trash", "restore", "delete"})

#: 一批最多几项，与标签管理同一档。
LIMIT = 2000


def _ids(values, *, required=True) -> list[int]:
    if not isinstance(values, list) or (required and not values) or len(values) > LIMIT * 50:
        raise UserValueError("api.entityBatch.selectionInvalid")
    ids = []
    for value in values:
        if type(value) is not int or not 0 < value < 2**63:
            raise UserValueError("api.entityBatch.selectionInvalid")
        ids.append(value)
    return sorted(set(ids))


def _entities(connection, ids: list[int], kinds: frozenset[str]) -> list[dict]:
    if len(ids) > LIMIT:
        raise UserValueError("api.entityBatch.selectionInvalid")
    resolved = sorted({entities.resolve_entity_id(connection, entity_id) or entity_id for entity_id in ids})
    marks = ",".join("?" for _ in resolved)
    rows = [dict(row) for row in connection.execute(
        f"SELECT id,kind,canonical_name FROM entity WHERE id IN ({marks})", resolved)]
    if len(rows) != len(resolved) or any(row["kind"] not in kinds for row in rows):
        raise UserValueError("api.entityBatch.selectionChanged")
    return rows


def _hide(connection, rows, hidden: bool) -> list[int]:
    changed = []
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for row in rows:
        current = connection.execute(
            f"SELECT {roster_hidden('e')} FROM entity e WHERE e.id=?", (row["id"],)).fetchone()[0]
        if bool(current) == hidden:
            continue
        connection.execute(
            f"UPDATE entity SET metadata_json=json_set(COALESCE(metadata_json,'{{}}'),'{HIDDEN_KEY}',?),"
            "updated_at=? WHERE id=?", (1 if hidden else 0, stamp, row["id"]))
        changed.append(row["id"])
    return changed


def _follow(connection, rows, on: bool) -> tuple[list[int], list[dict], list[int]]:
    """订上或停掉这几位的新作订阅；没有站上编号、订不了的记进 `skipped`。"""
    from .web_feeds import subscribe_performer
    changed, skipped, sources = [], [], []
    for row in rows:
        if feeds.entity_following(connection, row["id"]) == on:
            continue
        if not on:
            feeds.unfollow_entity(connection, row["id"])
            changed.append(row["id"])
            continue
        try:
            sources.extend(subscribe_performer(connection, row["id"], row["canonical_name"]))
        except UserValueError:
            skipped.append({"id": row["id"], "name": row["canonical_name"], "reason": "no-source"})
            continue
        changed.append(row["id"])
    return changed, skipped, sources


def _content_ids(connection, rows) -> list[int]:
    """这几项名下还在库里的作品：资料页与名册数作品的同一个范围。"""
    ids: set[int] = set()
    for row in rows:
        predicate = scope_predicate(row["kind"], "ae.entity_id")
        ids.update(item[0] for item in connection.execute(
            "SELECT DISTINCT a.id FROM asset_entity ae CROSS JOIN asset a ON a.id=ae.asset_id "
            f"WHERE {predicate} AND a.disposal IS NULL", (row["id"],)))
    return sorted(ids)


def _set_disposal(connection, ids: list[int], trash: bool) -> list[int]:
    """把这批作品移进或移出回收站，只动处于相反状态的那几份。"""
    changed = []
    now = time.time()
    for start in range(0, len(ids), 500):
        chunk = ids[start:start + 500]
        marks = ",".join("?" for _ in chunk)
        if trash:
            found = [row[0] for row in connection.execute(
                f"SELECT id FROM asset WHERE id IN ({marks}) AND disposal IS NULL", chunk)]
            sql = "UPDATE asset SET disposal='trash',disposal_reason='manual',feedback_at=? WHERE id IN ({})"
        else:
            found = [row[0] for row in connection.execute(
                f"SELECT id FROM asset WHERE id IN ({marks}) AND disposal='trash'", chunk)]
            sql = "UPDATE asset SET disposal=NULL,disposal_reason=NULL,feedback_at=? WHERE id IN ({})"
        if found:
            connection.execute(sql.format(",".join("?" for _ in found)), [now, *found])
            changed.extend(found)
    return sorted(changed)


def q_entity_batch_plan(contract, args) -> dict:
    """确认弹窗中的资料和作品范围，资料删除同时返回计划凭据。"""
    values = str(args.get("ids") or "").split(",")
    if args.get("operation") == "delete" and not all(value.isdecimal() for value in values):
        raise UserValueError("api.entityBatch.selectionInvalid")
    ids = _ids([int(value) for value in values if value.isdecimal()])
    with contract.read_connection() as connection:
        if args.get("operation") == "delete":
            if len(ids) > LIMIT:
                raise UserValueError("api.entityBatch.selectionInvalid")
            plan = deletion_plan(connection, ids)
            return {"entity_ids": ids, "assets": plan["assets"], "bytes": plan["bytes"],
                    "shared": plan["shared"], "token": plan["token"],
                    "names": [row["canonical_name"] for row in plan["entities"]]}
        rows = _entities(connection, ids, CONTENT_KINDS)
        assets = _content_ids(connection, rows)
    return {"entity_ids": [row["id"] for row in rows], "assets": len(assets)}


def w_entity_batch(contract, body) -> dict:
    """名册多选的写入键。`trash` 与 `restore` 的回执与撤销按作品 id 走，其余按实体 id 走。"""
    operation = body.get("operation")
    if operation not in OPERATIONS:
        raise UserValueError("api.entityBatch.operationInvalid")
    if operation == "delete":
        ids = _ids(body.get("entity_ids"))
        if len(ids) > LIMIT:
            raise UserValueError("api.entityBatch.selectionInvalid")
        return delete_profiles(contract, body, ids)
    sources: list[int] = []
    skipped: list[dict] = []
    with contract.write_transaction() as connection:
        if operation == "restore":
            changed = _set_disposal(connection, _ids(body.get("asset_ids")), False)
            result = {"asset_ids": changed}
        else:
            ids = _ids(body.get("entity_ids"))
            if operation in {"follow", "unfollow"}:
                rows = _entities(connection, ids, frozenset({"performer"}))
                changed, skipped, sources = _follow(connection, rows, operation == "follow")
                result = {"entity_ids": changed}
            elif operation in {"hide", "unhide"}:
                rows = _entities(connection, ids, ROSTER_KINDS)
                result = {"entity_ids": _hide(connection, rows, operation == "hide")}
            else:
                rows = _entities(connection, ids, CONTENT_KINDS)
                result = {"asset_ids": _set_disposal(connection, _content_ids(connection, rows), True)}
    contract.cache_bust()
    if sources:
        from .web_feeds import fetch_new_sources
        fetch_new_sources(contract, sources)
    return {"ok": True, "operation": operation, **result, "skipped": skipped}
