"""单片资料编辑：详情页编辑框一次保存落下的全部改动（ADR-0165）。

真相字段走 `write_owned_fields(..., USER_MANUAL)`，改过的字段自动写入者不再碰。演员按人记：
用户加的人以 `user:manual` 来源挂上，刮削整组重写时不删这个来源；用户删的人记一条
`performer-removal` 拒绝决定，键是 `<资产 id>:<实体 id>`，刮削再给出这个人时由
`drop_removed_performers` 摘掉。读取侧一律不用改：删除是真删，挡的是写回。
"""
from __future__ import annotations

import json
import re
import time
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timezone

from .catalog_rules import PERFORMER_TAG_PREFIX, normalise_code_key
from .entities import _ingest_name_id, canonicalize_entity_name, normalize_entity_name, upsert_asset_entity
from .field_owners import USER_MANUAL, check_revision, parse_owners
from .regions import normalize_region
from .user_messages import UserValueError

#: 用户从一部片上删掉某个演员的决定。`review_decision` 的语义正好是「人判过」，
#: 自带历史表，不另开新表。
PERFORMER_REMOVAL = "performer-removal"

#: 编辑框里的字段名 → `asset` 列。厂牌与系列另有实体关联，单独处理。
TEXT_FIELDS = {
    "title": "catalog_title",
    "original_title": "original_title",
    "code": "code",
    "release_date": "release_date",
    "region": "region",
}
ENTITY_FIELDS = ("studio", "series")
EDITABLE_FIELDS = (*TEXT_FIELDS, *ENTITY_FIELDS)

#: 自建实体在 `metadata_json` 上的标记；`_entity_metadata_payload` 保留 `user_` 开头的键，
#: 之后刮到同一个人刷新资料也冲不掉它。
USER_CREATED = "user_created"

#: 恢复自动之后，厂牌、系列现值留一条可被刮削替换的关联；与 `metadata_auto_apply`
#: 的 `_SCRAPED_ROLE_SOURCES` 同一个来源名。
LEGACY_LINK_SOURCE = "legacy:asset"

_MAX_TEXT = 1000


def removal_key(asset_id: int, entity_id: int) -> str:
    return f"{int(asset_id)}:{int(entity_id)}"


def performer_removed(connection, asset_id: int, entity_id: int) -> bool:
    return connection.execute(
        "SELECT 1 FROM review_decision WHERE category=? AND item_key=? AND status='rejected'",
        (PERFORMER_REMOVAL, removal_key(asset_id, entity_id))).fetchone() is not None


def _has_decisions(connection) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_schema WHERE type='table' AND name='review_decision'").fetchone() is not None


def _removed_entities(connection, asset_ids: Sequence[int]) -> dict[int, set[int]]:
    keys = [str(int(asset_id)) for asset_id in asset_ids]
    if not keys or not _has_decisions(connection):
        return {}
    found: dict[int, set[int]] = {}
    for (item_key,) in connection.execute(
            "SELECT item_key FROM review_decision WHERE category=? AND status='rejected' "
            "AND substr(item_key,1,instr(item_key,':')-1) IN (" + ",".join("?" * len(keys)) + ")",
            (PERFORMER_REMOVAL, *keys)):
        asset, _, entity = str(item_key).partition(":")
        found.setdefault(int(asset), set()).add(int(entity))
    return found


def _entity_names(connection, entity_id: int) -> set[str]:
    names = {str(row[0]) for row in connection.execute(
        "SELECT normalized_name FROM entity WHERE id=?", (entity_id,))}
    names |= {str(row[0]) for row in connection.execute(
        "SELECT normalized_alias FROM entity_alias WHERE entity_id=?", (entity_id,))}
    return names


def _unlink_performer(connection, asset_id: int, entity_id: int) -> None:
    """这部片上与这个人有关的行全删：实体关联（不论来源）和 `performer:` 投影。"""
    connection.execute(
        "DELETE FROM asset_entity WHERE asset_id=? AND entity_id=? AND role='performer'",
        (asset_id, entity_id))
    names = _entity_names(connection, entity_id)
    for tag, in connection.execute(
            "SELECT tag FROM asset_tag WHERE asset_id=? AND tag LIKE ?",
            (asset_id, PERFORMER_TAG_PREFIX + "%")).fetchall():
        if normalize_entity_name(str(tag).removeprefix(PERFORMER_TAG_PREFIX)) in names:
            connection.execute("DELETE FROM asset_tag WHERE asset_id=? AND tag=?", (asset_id, tag))


def drop_removed_performers(connection, asset_ids: Iterable[int]) -> int:
    """把用户删过的演员从这些片上再摘掉，返回摘掉的人次。

    刮削落库整组重写演员之后调用：被删的人不该随下一次采集回来。
    """
    removed = _removed_entities(connection, [int(asset_id) for asset_id in asset_ids])
    count = 0
    for asset_id, entity_ids in removed.items():
        for entity_id in entity_ids:
            linked = connection.execute(
                "SELECT 1 FROM asset_entity WHERE asset_id=? AND entity_id=? AND role='performer'",
                (asset_id, entity_id)).fetchone()
            _unlink_performer(connection, asset_id, entity_id)
            count += 1 if linked else 0
    return count


def rekey_removals(connection, *, source_id: int, target_id: int) -> None:
    """实体合并时把删除决定改指到保留的那条；目标上已有同一部片的决定时，旧的那条丢掉。"""
    if not _has_decisions(connection):
        return
    rows = connection.execute(
        "SELECT item_key FROM review_decision WHERE category=? "
        "AND substr(item_key,instr(item_key,':')+1)=?", (PERFORMER_REMOVAL, str(int(source_id)))).fetchall()
    for (item_key,) in rows:
        asset = str(item_key).partition(":")[0]
        connection.execute(
            "UPDATE OR IGNORE review_decision SET item_key=? WHERE category=? AND item_key=?",
            (f"{asset}:{int(target_id)}", PERFORMER_REMOVAL, item_key))
        connection.execute("DELETE FROM review_decision WHERE category=? AND item_key=?",
                           (PERFORMER_REMOVAL, item_key))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text_value(field: str, raw: object) -> str | None:
    """编辑框交来的一个文本字段，校验并换成落库写法；空串表示清空。"""
    if raw is None:
        return None
    text = str(raw)
    if any(ord(char) < 32 for char in text):
        raise UserValueError("errors.itemEdit.controlCharacters")
    value = " ".join(text.split())
    if len(value) > _MAX_TEXT:
        raise UserValueError("errors.itemEdit.tooLong")
    if not value:
        return None
    if field == "code":
        return normalise_code_key(value) or value
    if field == "release_date":
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise UserValueError("errors.itemEdit.releaseDateFormat")
        try:
            time.strptime(value, "%Y-%m-%d")
        except ValueError as exc:
            raise UserValueError("errors.itemEdit.releaseDateFormat") from exc
    if field == "region":
        region = normalize_region(value)
        if not region:
            raise UserValueError("errors.itemEdit.regionUnknown")
        return region
    return value


def _entity_choice(raw: object) -> tuple[int | None, str]:
    """选择器交来的一个身份：已有实体给 `id`，新建的只给 `name`。"""
    if isinstance(raw, Mapping):
        entity_id = raw.get("id")
        name = str(raw.get("name") or "").strip()
        return (int(entity_id) if entity_id not in (None, "") else None), name
    return None, str(raw or "").strip()


def _resolve_or_create(connection, kind: str, entity_id: int | None, name: str, *, now: str) -> tuple[int, str, bool]:
    """返回 (实体 id, 规范名, 是否新建)。按 id 给的必须存在且同类；按名字给的先认已有档案。"""
    if entity_id is not None:
        row = connection.execute("SELECT canonical_name FROM entity WHERE id=? AND kind=?",
                                 (entity_id, kind)).fetchone()
        if row is None:
            raise UserValueError("errors.itemEdit.entityMissing")
        return entity_id, str(row[0]), False
    canonical = canonicalize_entity_name(kind, name)
    if not canonical or len(canonical) > 200:
        raise UserValueError("errors.itemEdit.entityNameInvalid")
    found = _ingest_name_id(connection, kind, canonical)
    if found is not None:
        row = connection.execute("SELECT canonical_name FROM entity WHERE id=?", (found,)).fetchone()
        return found, str(row[0]), False
    connection.execute(
        "INSERT INTO entity(kind,canonical_name,normalized_name,metadata_json,created_at,updated_at) "
        "VALUES(?,?,?,?,?,?)",
        (kind, canonical, normalize_entity_name(canonical),
         json.dumps({USER_CREATED: True, "source": USER_MANUAL}, ensure_ascii=False), now, now))
    return int(connection.execute("SELECT last_insert_rowid()").fetchone()[0]), canonical, True


def _add_performer(connection, asset_id: int, raw: object, *, now: str) -> dict:
    entity_id, name = _entity_choice(raw)
    entity_id, canonical, created = _resolve_or_create(connection, "performer", entity_id, name, now=now)
    connection.execute("DELETE FROM review_decision WHERE category=? AND item_key=?",
                       (PERFORMER_REMOVAL, removal_key(asset_id, entity_id)))
    upsert_asset_entity(connection, kind="performer", name=canonical, asset_id=asset_id, role="performer",
                        source=USER_MANUAL, metadata={}, now=now, update_entity_metadata=False)
    connection.execute("INSERT OR IGNORE INTO asset_tag(asset_id,tag,confidence,source) VALUES(?,?,1.0,?)",
                       (asset_id, PERFORMER_TAG_PREFIX + canonical, USER_MANUAL))
    return {"id": entity_id, "name": canonical, "created": created}


def _remove_performer(connection, asset_id: int, raw: object, *, now: str) -> dict:
    entity_id, name = _entity_choice(raw)
    if entity_id is None:
        entity_id = _ingest_name_id(connection, "performer", canonicalize_entity_name("performer", name))
    if entity_id is None:
        raise UserValueError("errors.itemEdit.entityMissing")
    row = connection.execute("SELECT canonical_name FROM entity WHERE id=?", (entity_id,)).fetchone()
    _unlink_performer(connection, asset_id, entity_id)
    connection.execute(
        "INSERT INTO review_decision(category,item_key,status,note,updated_at) VALUES(?,?,'rejected',?,?) "
        "ON CONFLICT(category,item_key) DO UPDATE SET status='rejected',note=excluded.note,updated_at=excluded.updated_at",
        (PERFORMER_REMOVAL, removal_key(asset_id, entity_id), str(row[0]) if row else name, now))
    return {"id": entity_id, "name": str(row[0]) if row else name}


def _set_entity_field(connection, asset_id: int, field: str, raw: object, *, now: str) -> None:
    """厂牌或系列换成用户选的那一个；清空就只留空值。字段归用户，旧关联全部撤下。"""
    entity_id, name = _entity_choice(raw)
    connection.execute("DELETE FROM asset_entity WHERE asset_id=? AND role=?", (asset_id, field))
    if entity_id is None and not name:
        _write_fields(connection, asset_id, {field: None})
        return
    entity_id, canonical, _created = _resolve_or_create(connection, field, entity_id, name, now=now)
    _write_fields(connection, asset_id, {field: canonical})
    upsert_asset_entity(connection, kind=field, name=canonical, asset_id=asset_id, role=field,
                        source=USER_MANUAL, metadata={}, now=now, update_entity_metadata=False)


def _write_fields(connection, asset_id: int, values: Mapping[str, object]) -> None:
    from .field_owners import write_owned_fields
    write_owned_fields(connection, [asset_id], values, USER_MANUAL)


def _restore_field(connection, asset_id: int, field: str, *, now: str) -> None:
    """把一个字段交回自动采集：清掉人工归属，现值留着，等下一次采集替换。"""
    connection.execute(
        "UPDATE asset SET field_owners=json_remove(COALESCE(field_owners,'{}'),?) WHERE id=?",
        (f'$."{TEXT_FIELDS.get(field, field)}"', asset_id))
    if field not in ENTITY_FIELDS:
        return
    connection.execute("DELETE FROM asset_entity WHERE asset_id=? AND role=? AND source=?",
                       (asset_id, field, USER_MANUAL))
    current = connection.execute(f"SELECT {field} FROM asset WHERE id=?", (asset_id,)).fetchone()
    if current and str(current[0] or "").strip():
        upsert_asset_entity(connection, kind=field, name=str(current[0]), asset_id=asset_id, role=field,
                            source=LEGACY_LINK_SOURCE, metadata={}, now=now, update_entity_metadata=False)


def apply_item_edit(connection, asset_id: int, body: Mapping[str, object], *,
                    write_tag) -> dict:
    """一次保存：字段、恢复、演员、标签，全在调用方的事务里。

    `write_tag(connection, asset_id, operation, tag)` 是单片标签写入（`web_catalog.write_item_tag`），
    由调用方传进来，免得这一层反向依赖网页模块。
    """
    row = connection.execute("SELECT id,field_owners FROM asset WHERE id=?", (asset_id,)).fetchone()
    if row is None:
        raise UserValueError("errors.itemEdit.assetMissing")
    expected = body.get("expected_revision")
    check_revision(connection, [asset_id], None if expected is None else int(expected))
    now = _now()
    fields = body.get("fields") or {}
    restore = body.get("restore") or []
    performers = body.get("performers") or {}
    tags = body.get("tags") or {}
    if not isinstance(fields, Mapping) or not isinstance(restore, list):
        raise UserValueError("errors.itemEdit.malformed")
    unknown = sorted(set(fields) - set(EDITABLE_FIELDS)) + sorted(set(restore) - set(EDITABLE_FIELDS))
    if unknown:
        raise UserValueError("errors.itemEdit.unknownField", {"fields": ", ".join(unknown)})
    overlap = sorted(set(fields) & set(restore))
    if overlap:
        raise UserValueError("errors.itemEdit.restoreAndEdit", {"fields": ", ".join(overlap)})

    text = {TEXT_FIELDS[name]: _text_value(name, value) for name, value in fields.items() if name in TEXT_FIELDS}
    if text:
        _write_fields(connection, asset_id, text)
    for name in ENTITY_FIELDS:
        if name in fields:
            _set_entity_field(connection, asset_id, name, fields[name], now=now)
    for name in restore:
        _restore_field(connection, asset_id, str(name), now=now)

    receipt: dict[str, list] = {"performers_added": [], "performers_removed": [], "tags": []}
    for raw in performers.get("remove") or []:
        receipt["performers_removed"].append(_remove_performer(connection, asset_id, raw, now=now))
    for raw in performers.get("add") or []:
        receipt["performers_added"].append(_add_performer(connection, asset_id, raw, now=now))
    for operation in ("remove", "add"):
        for tag in tags.get(operation) or []:
            receipt["tags"].append({"operation": operation, "tag": write_tag(connection, asset_id, operation, str(tag))})
    connection.execute("UPDATE asset SET mutation_revision=mutation_revision+1 WHERE id=?", (asset_id,))
    return receipt


def field_sources(owners_json: object) -> dict[str, dict]:
    """编辑框每个字段旁边那句来源，按编辑框的字段名给出。

    `owner` 是写入者类别（`user`、`review`、`auto`、`scan`、`script`，无主为空串）；
    `source` 是来源的显示名，按采集来源登记的站名写（`JavDB`，不写成键名 `javdb`），
    要随界面语言换写法的那几个另给 `source_code`；登记过的采集来源再给 `site`，
    前端凭它经 `/site-mark?source=` 取站标。
    """
    from .library_processing import SOURCE_LABELS, SOURCE_NAME_CODES
    from .scraping_access import SOURCES
    owners = parse_owners(owners_json)
    result = {}
    for name in EDITABLE_FIELDS:
        kind, _, identifier = owners.get(TEXT_FIELDS.get(name, name), "").partition(":")
        key = identifier.replace("-", "_")
        site = identifier if identifier in SOURCES else key if key in SOURCES else ""
        label = SOURCES[site]["label"] if site else None
        entry = {"owner": kind, "source": label if isinstance(label, str) else SOURCE_LABELS.get(key, identifier)}
        if key in SOURCE_NAME_CODES:
            entry["source_code"] = SOURCE_NAME_CODES[key]
        if site:
            entry["site"] = site
        result[name] = entry
    return result
