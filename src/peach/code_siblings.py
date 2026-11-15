"""同一番号的视频是同一部作品：新副本缺演员或创作者时，从已有归属的那一份补上。

`www.98T.la@FC2-1666863-CD1.mp4` 与 `FC2-PPV-1666863-CD1.mp4` 字节都一样，可后入库的那份
在资料快照被判失效之后才登记，拿不到演员；FC2 卖家归属又只跑过一次性脚本。账本里同番号
那一份早有答案，判据只有「番号相同」，是确定的（ADR-0052）：只给这个角色还空着的文件补，
来源记 `auto:code-sibling@<时刻>`，按批次能整批撤回（`auto_landing_revert`）。

创作者只抄作品级的归属：FC2 卖家与关注源认出的账号。从目录名推出来的创作者
（`legacy:asset`、整理目录时的 `user:manual-library-organize*`）讲的是这个文件夹，不是这部片，
副本放在别处就不该跟着走。
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from .catalog_rules import normalise_code_key
from .catalog_vocabulary import PERFORMER_TAG_PREFIX

SOURCE = "auto:code-sibling"
#: 创作者可以照抄的来源前缀：作品级的归属。
_WORK_CREATOR_SOURCES = ("script:fc2-seller@", "follow:")


def _register(connection) -> None:
    connection.create_function("normalise_code_key", 1, lambda value: normalise_code_key(value) if value else None,
                               deterministic=True)


def _copyable(role: str, source: str) -> bool:
    source = str(source or "")
    if source.startswith(SOURCE + "@"):
        return True
    if role == "performer":
        return True
    return source.startswith(_WORK_CREATOR_SOURCES)


def inherit(connection, asset_ids: Iterable[int] | None = None, *, now: str | None = None) -> dict:
    """给 `asset_ids`（不给就是整库）里缺演员或创作者的视频，从同番号的另一份补上。

    返回 `{'batch', 'links': [...]}`，`links` 逐条记补上的关系，回执与测试都读它。不开不提交事务。
    """
    _register(connection)
    moment = now or datetime.now(timezone.utc).isoformat()
    batch = f"{SOURCE}@{moment}"
    if asset_ids is None:
        targets = [tuple(row) for row in connection.execute(
            "SELECT id,code FROM asset WHERE medium='video' AND disposal IS NULL AND code IS NOT NULL")]
    else:
        ids = sorted({int(value) for value in asset_ids})
        targets = []
        for start in range(0, len(ids), 500):
            chunk = ids[start:start + 500]
            targets += [tuple(row) for row in connection.execute(
                f"SELECT id,code FROM asset WHERE id IN ({','.join('?' * len(chunk))}) AND medium='video' "
                "AND disposal IS NULL AND code IS NOT NULL", chunk)]
    links = []
    for asset_id, code in targets:
        key = normalise_code_key(code)
        if not key:
            continue
        for role in ("performer", "creator"):
            if connection.execute("SELECT 1 FROM asset_entity WHERE asset_id=? AND role=? LIMIT 1",
                                  (asset_id, role)).fetchone():
                continue
            found = {}
            for sibling, entity_id, source, confidence, name in connection.execute(
                    "SELECT ae.asset_id,ae.entity_id,ae.source,ae.confidence,e.canonical_name FROM asset_entity ae"
                    " JOIN asset a ON a.id=ae.asset_id JOIN entity e ON e.id=ae.entity_id"
                    " WHERE ae.role=? AND a.id<>? AND a.medium='video' AND COALESCE(a.disposal,'')<>'vanished'"
                    " AND a.code IS NOT NULL AND normalise_code_key(a.code)=? ORDER BY ae.asset_id",
                    (role, asset_id, key)):
                if _copyable(role, source) and entity_id not in found:
                    found[entity_id] = (sibling, confidence, name)
            for entity_id, (sibling, confidence, name) in found.items():
                connection.execute(
                    "INSERT OR IGNORE INTO asset_entity(asset_id,entity_id,role,source,confidence,metadata_json)"
                    " VALUES(?,?,?,?,?,?)", (asset_id, entity_id, role, batch, confidence,
                                             f'{{"from_asset": {int(sibling)}}}'))
                if role == "performer":
                    connection.execute(
                        "INSERT OR IGNORE INTO asset_tag(asset_id,tag,confidence,source) VALUES(?,?,?,?)",
                        (asset_id, PERFORMER_TAG_PREFIX + name, confidence, batch))
                links.append({"asset_id": asset_id, "entity_id": entity_id, "role": role, "from_asset": sibling})
    return {"batch": batch, "links": links}


def planned_revert(connection, source: str, batch: str = "") -> list[dict]:
    """这条规则补上、现在还在账本里的关系，只读。不给批次时按「来源@」前缀认。"""
    if source != SOURCE:
        return []
    clause = "ae.source=?" if batch else "substr(ae.source,1,?)=?"
    values = (batch,) if batch else (len(SOURCE) + 1, SOURCE + "@")
    return [{"asset_id": row[0], "entity_id": row[1], "role": row[2], "source": row[3], "name": row[4]}
            for row in connection.execute(
                "SELECT ae.asset_id,ae.entity_id,ae.role,ae.source,e.canonical_name FROM asset_entity ae"
                " JOIN entity e ON e.id=ae.entity_id WHERE " + clause + " ORDER BY ae.asset_id,ae.role", values)]


def revert(connection, planned: list[dict]) -> int:
    """按 `planned_revert` 删掉补上的关系与演员标签，返回删了几条关系。不开不提交事务。"""
    removed = 0
    for row in planned:
        removed += connection.execute(
            "DELETE FROM asset_entity WHERE asset_id=? AND entity_id=? AND role=? AND source=?",
            (row["asset_id"], row["entity_id"], row["role"], row["source"])).rowcount or 0
        if row["role"] == "performer":
            connection.execute("DELETE FROM asset_tag WHERE asset_id=? AND tag=? AND source=?",
                               (row["asset_id"], PERFORMER_TAG_PREFIX + row["name"], row["source"]))
    return removed
