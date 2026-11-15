"""按源内抓取批次的确凿证据补建旧版 20 条限额遗漏的新作壳。"""
from __future__ import annotations

import json
import time
from collections import defaultdict

from . import feeds
from .catalog_rules import normalise_code_key

RECEIPT_KEY = "feed-overflow-discoveries-1"


def candidates(connection, hidden: frozenset[str] = feeds.DEFAULT_HIDDEN_COMPILATIONS) -> list[dict]:
    """只认同批已有 20 个壳的明确溢出；不推测其他缺失记录的原因。"""
    batches = defaultdict(list)
    for row in connection.execute(
            "SELECT i.id,i.source_id,i.first_seen,i.code,i.title,i.link,i.published_at,"
            "s.entity_id FROM feed_item i JOIN feed_source s ON s.id=i.source_id"
            " WHERE s.enabled=1 AND i.code IS NOT NULL"
            " ORDER BY i.source_id,i.first_seen,i.id"):
        batches[(row["source_id"], row["first_seen"])].append(row)

    anchors = defaultdict(set)
    existing = set()
    for row in connection.execute(
            "SELECT source_id,discovered_at,code FROM feed_discovery"):
        key = normalise_code_key(row["code"])
        if not key:
            continue
        existing.add(key)
        if row["source_id"] is not None:
            anchors[(row["source_id"], row["discovered_at"])].add(key)
    # 历史里曾经入库但已标记消失的影片也不恢复，避免重现用户清理的作品。
    library = {normalise_code_key(row[0]) for row in connection.execute(
        "SELECT code FROM asset WHERE code IS NOT NULL")}
    planned = []
    pending = set()
    for batch, rows in batches.items():
        if len(rows) <= feeds.MAX_NEW_PER_POLL:
            continue
        found = anchors[batch]
        present = [row for row in rows if normalise_code_key(row["code"]) in found]
        # 20 个同批建壳记录证明触发过旧版限额；少于 20 无法排除入库、过滤和主动删除。
        if len({normalise_code_key(row["code"]) for row in present}) != feeds.MAX_NEW_PER_POLL:
            continue
        oldest_created = min(row["id"] for row in present)
        for row in reversed(rows):
            if row["id"] >= oldest_created:
                continue
            code = normalise_code_key(row["code"])
            if (not code or code in existing or code in library or code in pending
                    or feeds.compilation_kind(row["title"], None) in hidden):
                continue
            planned.append(dict(row))
            pending.add(code)
    return planned


def repair(connection, hidden: frozenset[str] = feeds.DEFAULT_HIDDEN_COMPILATIONS) -> dict | None:
    """同一事务写新作壳与可审计水位；已补过或无目标时仍只记一次回执。"""
    if connection.execute(
            "SELECT 1 FROM ledger_upgrade_repair WHERE id=?", (RECEIPT_KEY,)).fetchone():
        return None
    planned = candidates(connection, hidden)
    created = []
    for row in planned:
        shell = feeds.create_shell(
            connection, row["code"], source_id=row["source_id"],
            title=row["title"], link=row["link"],
            release_date=(row["published_at"] or "")[:10] or None,
            entity_id=row["entity_id"], now=row["first_seen"])
        if shell is not None:
            created.append({"id": shell, "code": row["code"], "item_id": row["id"]})
    outcome = {"candidates": len(planned), "created": created}
    connection.execute(
        "INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)",
        (RECEIPT_KEY, str(time.time()), json.dumps(outcome, ensure_ascii=False)))
    return outcome
