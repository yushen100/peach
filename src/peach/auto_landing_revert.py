"""把自动落库写下的一批结果整批撤回（ADR-0052）：命令行与复核页共用的同一份判据。

自动落库的每条写入都带归属串和批次号：官网链接记在 `entity_link.metadata_json` 的
`source` 与 `batch`，标识文件记在边车 `.provenance.json` 的同名两项，别名的
`entity_alias.source` 直接就是批次号 `<source>@<任务行 id>`（ADR-0055）。女优资料行的
`performer_profile.source` 同样是批次号，后继登记的站上编号在 `entity_external_ref.metadata_json`
里记 `source` 与 `batch`（ADR-0067），番号样张的 `code_sample_image.source` 也是批次号（ADR-0068），
种子包补的所属事务所 `entity_membership.source` 与 label 的片商 `label_maker.source` 同样（ADR-0073、ADR-0075），
查创作者身份后继写的身份断言 `entity_classification.source` 也是批次号（ADR-0098）。
种子中文规范名按 `entity.metadata_json.name_preference` 的来源和原名快照还原，作品署名同步恢复；后续人工选择保留（ADR-0122）。
判据错了一批，就按它们认出来一起撤掉，不必一条条找。

复核队列的自动否决记在 `review_decision.note` 里（`auto_rejected` 与 `rule`，ADR-0079），
`source` 给规则名就按它认。决定没有批次号，给了 `batch` 就一条都不认。撤掉的那几行回到
复核页；下一轮处理任务会按同一条判据再否决一次，所以先改判据再撤。

人批准过的标签上按并集补进来的那几个，`asset_tag.source` 与 `asset_entity.source` 都是批次号
`auto:metadata-tags@<时间>`。撤回删掉这几行标签，并把对应决定 note 里补标签时追加的
`refreshed_candidate_key`、`added_tags` 去掉，那一行重新过期、回到复核页；生词收录后补的
那几个（ADR-0082）连同 `collected_genres` 一起去掉，下一轮按那时的收录结果重补。同样先改判据再撤。

撤回是删除，不是恢复旧值：补厂牌后继只在盘上一张图都没有、账本里一条官网都没有时才写，
补别名后继只写账本里还没有的写法，补女优资料后继只写自动来源的那一行，补样张后继只给还没有
样张的番号写，写下的就是那一格的全部，删掉就回到它写之前的样子。

已消失作品的个人记录接到新文件（ADR-0087）不是删除能撤的：搬运删了旧行，`record_rehome` 存着
旧行快照与搬动的键，批次号 `<source>@<id>`。撤回按快照重建旧行、把搬走的记录改回去，旧行的
id 或路径已被别的行占用时那一批拒绝撤回。登记时自动接回记 `auto:vanished-reattach`，孤儿记录
列表里由人接回记 `user:reattach`。

「想要」清单的入库对账记在 `want_item.acquired_source` 与 `acquired_batch`（批次号
`auto:want-acquired@<登记时刻>`）。撤回把那几条改回待找，查找计数原样留着。

核查差异按确定判据结算的两条（ADR-0139）按规则名撤：`adr-0139-official-replaces-verified`
按 note 的 `previous` 把旧值与旧归属还原，之后被别人改过的资产不动；`adr-0139-verified-tags-union`
删掉那一行补进的标签。两条都删掉决定，`batch` 给 note 里记的批次号。先改判据再撤。
复核页的「自动写入的资料」逐条列出这两条规则的写入（ADR-0141），撤回走这里同一个 `plan` 与 `apply`。

西方发行方的无番号作品封面（`ASSET-ID-<id>.jpg`）在 `.scraping.json` 边车里记 `source` 与 `batch`
（`auto:western-artwork@<时间>`）。撤回删掉封面与同组边车，作品回到没有封面的样子。

关注作者建档（ADR-0096）建下的创作者在 `entity.metadata_json` 里记 `source` 与 `batch`。撤回先删
这一批的链接与别名，再解绑关注来源；实体还被别的行引用（人挂上的作品、链接）就留着，没有才删。

升级补修解除的乱码人物关联（#478）按 `upgrade:garbled-performers` 认，批次是那份升级回执的 id。
回执 `garbled_people` 存着删掉的关联、`performer:` 标签与实体子表行的原样快照，撤回把账本里还没有的
那几行插回；实体的 id 或名字已被占用时整批拒绝。

升级补修解除的来源分辨率标签（`4K` 等）按 `upgrade:source-resolution-tags` 认，批次是回执行的 id。
回执存着删掉的 `asset_tag` 与 `asset_entity` 行，撤回把账本里还没有的那几行插回。

升级补修记下的 JavDB 演员页有码／无码（#271）按 `upgrade:javdb-actor-records` 认，批次是回执行的 id。
撤回去掉还原样在账本里的那几项类型，重新启用补修停掉的订阅。

`plan` 只读，`apply` 只写账本、在调用方的事务里跑，`remove_files` 等事务提交之后再删盘上文件。
"""
from __future__ import annotations

import json
from pathlib import Path

from . import (code_siblings, company_profiles, fc2_sellers, follow_creators, metadata_text_repair,
               record_rehome, sample_images, seed_pack, wants, western_artwork)
from .cover_artwork import cover_group
from .metadata_auto_apply import UNION_TAGS_SOURCE, planned_verified_revert, revert_verified

SIDECARS = (".ct", ".provenance.json")


def matches(record: dict, source: str, batch: str) -> bool:
    return record.get("source") == source and (not batch or record.get("batch") == batch)


def planned_links(connection, source: str, batch: str) -> list[dict]:
    rows = connection.execute(
        "SELECT l.id,l.entity_id,e.canonical_name,l.url,l.metadata_json FROM entity_link l"
        " JOIN entity e ON e.id=l.entity_id WHERE l.metadata_json LIKE ?",
        (f"%{source}%",)).fetchall()
    found = []
    for row in rows:
        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except ValueError:
            continue
        if matches(metadata, source, batch):
            found.append({"id": row["id"], "entity": row["canonical_name"], "url": row["url"],
                          "batch": metadata.get("batch", "")})
    return found


def planned_aliases(connection, source: str, batch: str) -> list[dict]:
    """这个来源写下的别名。`source` 列存的是批次号，所以不给批次时按「来源@」前缀认。"""
    clause, values = _batch_clause("a.source", source, batch)
    return [{"entity_id": row["entity_id"], "entity": row["canonical_name"], "alias": row["alias"],
             "normalized": row["normalized_alias"], "source": row["source"]}
            for row in connection.execute(
                "SELECT a.entity_id,e.canonical_name,a.alias,a.normalized_alias,a.source"
                " FROM entity_alias a JOIN entity e ON e.id=a.entity_id WHERE " + clause
                + " ORDER BY a.entity_id,a.alias", values)]


def _batch_clause(column: str, source: str, batch: str) -> tuple[str, tuple]:
    """`column` 存的是批次号：给了批次就逐字比，不给就按「来源@」前缀认。"""
    if batch:
        return f"{column}=?", (batch,)
    return f"({column}=? OR substr({column},1,?)=?)", (source, len(source) + 1, source + "@")


def planned_profiles(connection, source: str, batch: str) -> list[dict]:
    """这个来源写下的女优资料行。"""
    clause, values = _batch_clause("p.source", source, batch)
    return [{"entity_id": row["entity_id"], "entity": row["canonical_name"], "source": row["source"]}
            for row in connection.execute(
                "SELECT p.entity_id,e.canonical_name,p.source FROM performer_profile p"
                " JOIN entity e ON e.id=p.entity_id WHERE " + clause + " ORDER BY p.entity_id",
                values)]


def planned_claims(connection, source: str, batch: str) -> list[dict]:
    """这个来源写下的身份断言（`source` 列存批次号）。FC2 卖家那一批连同关系由 `fc2_sellers` 撤。"""
    if source == fc2_sellers.SOURCE:
        return []
    clause, values = _batch_clause("c.source", source, batch)
    return [{"entity_id": row["entity_id"], "entity": row["canonical_name"], "facet": row["facet"],
             "value": row["value"], "source": row["source"]}
            for row in connection.execute(
                "SELECT c.entity_id,e.canonical_name,c.facet,c.value,c.source FROM entity_classification c"
                " JOIN entity e ON e.id=c.entity_id WHERE " + clause + " ORDER BY c.entity_id,c.facet,c.value",
                values)]


def planned_memberships(connection, source: str, batch: str) -> list[dict]:
    """这个来源写下的所属事务所（`source` 列存批次号）。"""
    clause, values = _batch_clause("m.source", source, batch)
    return [{"member_id": row["member_id"], "entity": row["canonical_name"], "agency": row["agency"],
             "source": row["source"]}
            for row in connection.execute(
                "SELECT m.member_id,e.canonical_name,a.canonical_name AS agency,m.source"
                " FROM entity_membership m JOIN entity e ON e.id=m.member_id"
                " JOIN entity a ON a.id=m.agency_id WHERE " + clause + " ORDER BY m.member_id", values)]


def planned_makers(connection, source: str, batch: str) -> list[dict]:
    """这个来源写下的 label 归属片商（`source` 列存批次号）。"""
    clause, values = _batch_clause("l.source", source, batch)
    return [{"label_id": row["label_id"], "entity": row["canonical_name"], "maker": row["maker"],
             "source": row["source"]}
            for row in connection.execute(
                "SELECT l.label_id,e.canonical_name,m.canonical_name AS maker,l.source"
                " FROM label_maker l JOIN entity e ON e.id=l.label_id"
                " JOIN entity m ON m.id=l.maker_id WHERE " + clause + " ORDER BY l.label_id", values)]


def planned_refs(connection, source: str, batch: str) -> list[dict]:
    """这个来源登记的站上编号（`metadata_json` 里记着 `source` 与 `batch`）。"""
    found = []
    for row in connection.execute(
            "SELECT r.entity_id,e.canonical_name,r.provider,r.external_kind,r.external_id,"
            "r.metadata_json FROM entity_external_ref r JOIN entity e ON e.id=r.entity_id"
            " WHERE r.metadata_json LIKE ?", (f"%{source}%",)):
        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except ValueError:
            continue
        if isinstance(metadata, dict) and matches(metadata, source, batch):
            found.append({"entity": row["canonical_name"], "provider": row["provider"],
                          "kind": row["external_kind"], "id": row["external_id"],
                          "batch": metadata.get("batch", "")})
    return found


def planned_rejections(connection, source: str, batch: str) -> list[dict]:
    """这条规则自动写下的复核否决（note 里 `auto_rejected` 为真、`rule` 逐字相同）。

    用户手工否决的 note 是自由文本或不带 `auto_rejected`，这里认不到，也就不会被撤。
    """
    if batch:
        return []
    found = []
    for row in connection.execute(
            "SELECT category,item_key,note FROM review_decision"
            " WHERE status='rejected' AND note LIKE ? ORDER BY category,item_key",
            (f"%{source}%",)):
        try:
            note = json.loads(row["note"] or "{}")
        except ValueError:
            continue
        if (isinstance(note, dict) and note.get("auto_rejected") is True
                and note.get("rule") == source):
            found.append({"category": row["category"], "item_key": row["item_key"]})
    return found


def planned_tags(connection, source: str, batch: str) -> list[dict]:
    """人批准过的标签上按并集补进来的那几个（`asset_entity.source` 存批次号）。

    `item_key` 取自实体关系留痕里的 `review_item`：撤掉标签的同时，那一行决定的 note
    要去掉 `refreshed_candidate_key` 与 `added_tags`，否则它不再过期，也就回不到复核页。

    只认并集补标签这一个归属串：标签的来源列还存着扫描、刮削写下的 `name`、`r18` 等，
    给别的 `source` 就按它整批删，删掉的是不归自动落库管的标签。
    """
    if source != UNION_TAGS_SOURCE:
        return []
    clause, values = _batch_clause("ae.source", source, batch)
    found = []
    for row in connection.execute(
            "SELECT ae.asset_id,ae.entity_id,e.canonical_name,ae.source,ae.metadata_json"
            " FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id"
            " WHERE ae.role='tag' AND " + clause + " ORDER BY ae.asset_id,e.canonical_name",
            values):
        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except ValueError:
            metadata = {}
        found.append({"asset_id": row["asset_id"], "entity_id": row["entity_id"],
                      "tag": row["canonical_name"], "source": row["source"],
                      "item_key": str(metadata.get("review_item") or "")
                      if isinstance(metadata, dict) else ""})
    return found


def reopen_extended_decisions(connection, item_keys: set[str]) -> int:
    """并集补标签的那几行决定去掉补标签时追加的几项，其余原样，返回改了几行。"""
    changed = 0
    for item_key in sorted(key for key in item_keys if key):
        row = connection.execute(
            "SELECT note FROM review_decision WHERE category='metadata_fields' AND item_key=?",
            (item_key,)).fetchone()
        try:
            note = json.loads(row["note"] or "{}") if row else None
        except ValueError:
            note = None
        if not isinstance(note, dict) or "added_tags" not in note:
            continue
        kept = {key: value for key, value in note.items()
                if key not in {"added_tags", "refreshed_candidate_key", "collected_genres"}}
        connection.execute(
            "UPDATE review_decision SET note=? WHERE category='metadata_fields' AND item_key=?",
            (json.dumps(kept, ensure_ascii=False, separators=(",", ":")), item_key))
        changed += 1
    return changed


def planned_files(logo_root: Path, source: str, batch: str) -> list[Path]:
    """边车上写着这个来源的标识文件本体。"""
    found = []
    for sidecar in sorted(logo_root.glob("*.provenance.json")):
        try:
            record = json.loads(sidecar.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if matches(record, source, batch):
            found.append(sidecar.with_name(sidecar.name.removesuffix(".provenance.json")))
    return found


def plan(connection, source: str, batch: str = "", *, logo_root: Path, cover_root: Path,
         files: bool = True, item_keys: set[str] | None = None) -> dict:
    """这个来源（与批次）要撤的全部条目，只读。`apply` 与 `remove_files` 都按它做。

    复核页只放行两条核查结算规则（ADR-0141），它们不写盘上文件：`files=False` 不扫标识与
    封面目录，`item_keys` 只收窄核查结算那一类，撤的是人逐条勾选的那几行决定。
    """
    return {
        "source": source, "batch": batch,
        "links": planned_links(connection, source, batch),
        "aliases": planned_aliases(connection, source, batch),
        "names": seed_pack.planned_names(connection, source, batch),
        "profiles": planned_profiles(connection, source, batch),
        "claims": planned_claims(connection, source, batch),
        "companies": company_profiles.planned_revert(connection, source, batch),
        "sellers": fc2_sellers.planned_revert(connection, source, batch),
        "creators": follow_creators.planned_revert(connection, source, batch),
        "refs": planned_refs(connection, source, batch),
        "memberships": planned_memberships(connection, source, batch),
        "makers": planned_makers(connection, source, batch),
        "files": planned_files(logo_root, source, batch) if files else [],
        "covers": western_artwork.planned_covers(cover_root, source, batch) if files else [],
        "samples": sample_images.planned_revert(connection, source, batch),
        "rejections": planned_rejections(connection, source, batch),
        "tags": planned_tags(connection, source, batch),
        "rehomes": record_rehome.planned_revert(connection, source, batch),
        "acquired": wants.planned_revert(connection, source, batch),
        "verified": planned_verified_revert(connection, source, batch, item_keys),
        "garbled": metadata_text_repair.planned_revert(connection, source, batch),
        "javdb_records": _planned_javdb_records(connection, source, batch),
        "resolution_tags": _planned_resolution_tags(connection, source, batch),
        "quality": _planned_quality(connection, source, batch),
        "siblings": code_siblings.planned_revert(connection, source, batch),
    }


def _planned_javdb_records(connection, source: str, batch: str) -> list[dict]:
    # 升级补修模块带着调度器与任务通道，只在用到时才载入。
    from .upgrade_repairs import planned_javdb_records_revert
    return planned_javdb_records_revert(connection, source, batch)


def _planned_resolution_tags(connection, source: str, batch: str) -> list[dict]:
    from .upgrade_repairs import planned_resolution_tags_revert
    return planned_resolution_tags_revert(connection, source, batch)


def _planned_quality(connection, source: str, batch: str) -> list[dict]:
    from .quality_repair import planned_revert
    return planned_revert(connection, source, batch)


def counts(planned: dict) -> dict:
    """计划里每一类各有几条，命令行 dry-run 的那一行摘要。键是计划里那一类的英文标识。"""
    plain = ("links", "aliases", "profiles", "claims", "companies", "sellers", "creators", "refs", "memberships",
             "makers", "files", "covers")
    return {**{key: len(planned[key]) for key in plain},
            "samples": sum(sample["count"] for sample in planned["samples"]),
            "rejections": len(planned["rejections"]), "tags": len(planned["tags"]),
            "rehomes": len(planned["rehomes"]), "acquired": len(planned["acquired"]),
            "names": len(planned["names"]), "verified": len(planned["verified"]),
            "garbled": len(planned["garbled"]),
            "javdb_records": len(planned.get("javdb_records", [])),
            "resolution_tags": len(planned.get("resolution_tags", [])),
            "quality": len(planned.get("quality", [])),
            "siblings": len(planned.get("siblings", []))}


def apply(connection, planned: dict) -> dict:
    """按计划改账本，返回各类改了几条（键是英文标识，给代码与命令行读）。不开不提交事务，
    由调用方包住；盘上文件不在这里删。"""
    source, batch = planned["source"], planned["batch"]
    links, aliases, profiles, claims = (planned["links"], planned["aliases"], planned["profiles"],
                                        planned["claims"])
    refs, memberships, makers = planned["refs"], planned["memberships"], planned["makers"]
    rejections, tags = planned["rejections"], planned["tags"]
    restored_names = seed_pack.revert_names(connection, planned["names"])
    company_profiles.revert(connection, planned["companies"])
    connection.executemany("DELETE FROM entity_link WHERE id=?", [(link["id"],) for link in links])
    connection.executemany(
        "DELETE FROM entity_alias WHERE entity_id=? AND normalized_alias=? AND source=?",
        [(alias["entity_id"], alias["normalized"], alias["source"]) for alias in aliases])
    connection.executemany(
        "DELETE FROM performer_profile WHERE entity_id=? AND source=?",
        [(profile["entity_id"], profile["source"]) for profile in profiles])
    connection.executemany(
        "DELETE FROM entity_classification WHERE entity_id=? AND facet=? AND value=? AND source=?",
        [(claim["entity_id"], claim["facet"], claim["value"], claim["source"]) for claim in claims])
    connection.executemany(
        "DELETE FROM entity_external_ref WHERE provider=? AND external_kind=?"
        " AND external_id=?", [(ref["provider"], ref["kind"], ref["id"]) for ref in refs])
    connection.executemany(
        "DELETE FROM entity_membership WHERE member_id=? AND source=?",
        [(membership["member_id"], membership["source"]) for membership in memberships])
    connection.executemany(
        "DELETE FROM label_maker WHERE label_id=? AND source=?",
        [(maker["label_id"], maker["source"]) for maker in makers])
    removed_samples = sample_images.revert(connection, source, batch)
    connection.executemany(
        "DELETE FROM review_decision WHERE category=? AND item_key=? AND status='rejected'",
        [(rejection["category"], rejection["item_key"]) for rejection in rejections])
    connection.executemany(
        "DELETE FROM asset_entity WHERE asset_id=? AND entity_id=? AND role='tag'"
        " AND source=?", [(tag["asset_id"], tag["entity_id"], tag["source"]) for tag in tags])
    # 扁平投影只删计划里列出的那几行：按来源串整表删的话，`--source name` 这类
    # 扫描写下的标签来源也会被认成一批。
    removed_tag_rows = sum(connection.execute(
        "DELETE FROM asset_tag WHERE asset_id=? AND tag=? AND source=?",
        (tag["asset_id"], tag["tag"], tag["source"])).rowcount or 0 for tag in tags)
    reopened = reopen_extended_decisions(connection, {tag["item_key"] for tag in tags})
    restored = record_rehome.revert(connection, source, batch)
    reopened_wants = wants.revert(connection, source, batch)
    removed_seller_relations = fc2_sellers.revert(connection, planned["sellers"])
    # 链接与别名已在上面按批次删掉，剩下没有别的引用的实体才删得掉。
    creator_revert = follow_creators.revert(connection, planned["creators"])
    verified_revert = revert_verified(connection, planned["verified"])
    restored_garbled = metadata_text_repair.revert(connection, planned.get("garbled", []))
    from .upgrade_repairs import revert_javdb_records
    restored_javdb = revert_javdb_records(connection, planned.get("javdb_records", []))
    from .upgrade_repairs import revert_resolution_tags
    restored_resolution = revert_resolution_tags(connection, planned.get("resolution_tags", []))
    from .quality_repair import revert as revert_quality
    restored_quality = revert_quality(connection, planned.get("quality", []))
    removed_siblings = code_siblings.revert(connection, planned.get("siblings", []))
    return {"deleted_links": len(links), "deleted_aliases": len(aliases), "deleted_profiles": len(profiles),
            "deleted_claims": len(claims), "deleted_refs": len(refs), "deleted_memberships": len(memberships),
            "deleted_makers": len(makers), "deleted_samples": removed_samples,
            "deleted_rejections": len(rejections), "deleted_tags": len(tags), "deleted_tag_rows": removed_tag_rows,
            "reopened_decisions": reopened, "reverted_rehomes": restored, "reopened_wants": reopened_wants,
            "deleted_seller_relations": removed_seller_relations,
            "unbound_creator_sources": creator_revert["unbound"],
            "deleted_creator_entities": creator_revert["removed"], "restored_names": restored_names,
            "restored_verified": verified_revert["restored"],
            "deleted_verified_tags": verified_revert["removed_tags"],
            "deleted_verified_decisions": verified_revert["decisions"], "restored_garbled_rows": restored_garbled,
            "restored_javdb_records": restored_javdb, "restored_resolution_tags": restored_resolution,
            "restored_quality": restored_quality, "deleted_sibling_links": removed_siblings}


def remove_files(planned: dict) -> int:
    """删掉标识文件与作品封面，连同各自的同组边车；返回删掉的文件数。"""
    targets = [target for path in planned["files"]
               for target in (path, *(path.with_name(path.name + suffix) for suffix in SIDECARS))]
    targets += [target for path in planned["covers"] for target in cover_group(path)]
    removed = 0
    for target in targets:
        if target.exists():
            target.unlink()
            removed += 1
    return removed
