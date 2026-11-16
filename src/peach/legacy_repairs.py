"""旧版本写下、按现行判据能确定改对的存量，升级时各补一次。

这些问题的修复当时只挡住了新数据（或只写成了手动脚本），老用户升级后存量还停在旧状态。每条规则两步：
`find` 只读算出要改的行，`fix` 在写事务里照改并返回回执。`UpgradeRepairs` 启动时先只读把还没做过的几条
都算一遍，有要改的才备份一次账本，再逐条在各自的写事务里重算、改写，同一事务写进
`ledger_upgrade_repair`（行 id 是规则键）。做过的不再做；出错的那条只记日志，下次启动再试。

回执里存着改动前的原值（`changed` 是改了几处，界面「设置 › 修复与迁移」按它报数），撤回按原值写回。
只改自动写入的值：真相字段经 `write_owned_fields`，用户填写与复核批准的不动。不联网、不读媒体文件。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Callable
from urllib.parse import urlsplit

from . import interface_text
from .catalog_rules import SCRAPE_MARK, strip_scrape_mark
from .catalog_vocabulary import current_link_label
from .field_owners import is_protected, owner_of, script_owner, write_owned_fields
from .social_links import canonical_url

#: 这些规则写真相字段时署的名。
OWNER = script_owner("upgrade-repairs")


@dataclass(frozen=True)
class Rule:
    #: `ledger_upgrade_repair` 的行 id；判据改了就换一个新键，升级时对存量再做一遍。
    key: str
    #: 「修复与迁移」里这一项的 id，标题与说明在 `server:repairCenter.items.<item>`。
    item: str
    find: Callable
    fix: Callable

    @property
    def prefix(self) -> str:
        return self.key.rsplit("-", 1)[0] + "-"


def _rows(connection, sql: str, params=()) -> list[tuple]:
    return [tuple(row) for row in connection.execute(sql, params)]


def _tables(connection) -> set[str]:
    return {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}


# ---- 资料页链接：`&amp;` 与中文通用链接名 ----

def find_entity_links(connection) -> list[dict]:
    """链接地址按现行 `canonical_url` 归一后变了的（`&amp;`、改名站点、主机大小写），链接名按现行词表
    （`current_link_label`）换成 id 后变了的。"""
    found = []
    for link_id, entity_id, label, url in _rows(
            connection, "SELECT id,entity_id,label,url FROM entity_link ORDER BY id"):
        new_url, new_label = canonical_url(url), current_link_label(label)
        if new_url != url or new_label != label:
            found.append({"id": link_id, "entity_id": entity_id, "label": label, "url": url,
                          "new_label": new_label, "new_url": new_url})
    return found


def fix_entity_links(connection, found: list[dict]) -> dict:
    """改地址撞上同一实体已有的那条（`UNIQUE(entity_id,url)`）时，这一条是重复，整行删掉、原样记下。"""
    labels, urls, dropped = [], [], []
    columns = [row[1] for row in connection.execute("PRAGMA table_info(entity_link)")]
    for row in found:
        if row["new_url"] != row["url"]:
            if connection.execute("SELECT 1 FROM entity_link WHERE entity_id=? AND url=? AND id<>?",
                                  (row["entity_id"], row["new_url"], row["id"])).fetchone():
                stored = connection.execute("SELECT * FROM entity_link WHERE id=?", (row["id"],)).fetchone()
                dropped.append(dict(zip(columns, stored)))
                connection.execute("DELETE FROM entity_link WHERE id=?", (row["id"],))
                continue
            connection.execute("UPDATE entity_link SET url=?,hostname=? WHERE id=?",
                               (row["new_url"], urlsplit(row["new_url"]).hostname or "", row["id"]))
            urls.append({"id": row["id"], "url": row["url"]})
        if row["new_label"] != row["label"]:
            connection.execute("UPDATE entity_link SET label=? WHERE id=?", (row["new_label"], row["id"]))
            labels.append({"id": row["id"], "label": row["label"]})
    return {"changed": len(labels) + len(urls) + len(dropped), "labels": labels, "urls": urls, "dropped": dropped}


# ---- FC2 卖家记在厂牌上（ADR-0054） ----

def find_fc2_seller_studios(connection) -> list[dict]:
    """FC2 番号上厂牌记成卖家名的作品：现行判据（`_fc2_seller_as_label`）会把它改成 `FC2-PPV`。"""
    from .metadata_auto_apply import _fc2_seller_as_label
    found = []
    for asset_id, code, studio, owners in _rows(
            connection, "SELECT id,code,studio,field_owners FROM asset WHERE trim(COALESCE(studio,''))<>''"
                        " AND code IS NOT NULL"):
        if is_protected(owner_of(owners, "studio")):
            continue
        target = _fc2_seller_as_label("studio", str(code or ""), {"value": studio})["value"]
        if target != studio:
            found.append({"id": asset_id, "studio": studio, "owner": owner_of(owners, "studio"), "target": target})
    return found


def fix_fc2_seller_studios(connection, found: list[dict]) -> dict:
    """厂牌改成 `FC2-PPV`，厂牌关系改挂 `FC2-PPV` 实体；卖家实体留着（删实体撤不回），卖家已由
    `fc2-seller-backfill` 挂成创作者。"""
    from .sources import fc2
    if not found:
        return {"changed": 0, "assets": [], "links": []}
    ids = [row["id"] for row in found]
    write_owned_fields(connection, ids, {"studio": fc2.STUDIO}, OWNER)
    marks = ",".join("?" * len(ids))
    moved = [row[0] for row in connection.execute(f"SELECT id FROM asset WHERE id IN ({marks}) AND studio=?",
                                                  (*ids, fc2.STUDIO))]
    platform = connection.execute("SELECT id FROM entity WHERE kind='studio' AND canonical_name=?",
                                  (fc2.STUDIO,)).fetchone()
    stamp = _stamp()
    if platform is None:
        from .entities import normalize_entity_name
        platform_id = int(connection.execute(
            "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at) VALUES('studio',?,?,?,?)",
            (fc2.STUDIO, normalize_entity_name(fc2.STUDIO), stamp, stamp)).lastrowid)
    else:
        platform_id = int(platform[0])
    links = []
    for asset_id in moved:
        for entity_id, source in _rows(connection, "SELECT entity_id,source FROM asset_entity "
                                       "WHERE asset_id=? AND role='studio' AND entity_id<>?", (asset_id, platform_id)):
            links.append({"asset_id": asset_id, "entity_id": entity_id, "source": source})
        connection.execute("DELETE FROM asset_entity WHERE asset_id=? AND role='studio' AND entity_id<>?",
                           (asset_id, platform_id))
        connection.execute(
            "INSERT OR IGNORE INTO asset_entity(asset_id,entity_id,role,source,confidence,metadata_json,"
            "first_seen_at,last_seen_at) VALUES(?,?,'studio',?,1.0,'{}',?,?)",
            (asset_id, platform_id, OWNER, stamp, stamp))
    assets = [{key: row[key] for key in ("id", "studio", "owner")} for row in found if row["id"] in moved]
    return {"changed": len(assets), "assets": assets, "links": links}


# ---- javdb 插进 FC2 标题的混淆串 ----

def find_scrape_mark_titles(connection) -> list[dict]:
    """标题里还留着混淆串（`SCRAPE_MARK`）、归属不受保护的作品。剥掉后为空的不改。"""
    found = []
    for asset_id, catalog_title, original_title, owners in _rows(
            connection, "SELECT id,catalog_title,original_title,field_owners FROM asset"
                        " WHERE catalog_title LIKE '%**%' OR original_title LIKE '%**%'"):
        values = {}
        for field, value in (("catalog_title", catalog_title), ("original_title", original_title)):
            if value and SCRAPE_MARK.search(value) and strip_scrape_mark(value) \
                    and not is_protected(owner_of(owners, field)):
                values[field] = {"old": value, "new": strip_scrape_mark(value), "owner": owner_of(owners, field)}
        if values:
            found.append({"id": asset_id, "fields": values})
    return found


def fix_scrape_mark_titles(connection, found: list[dict]) -> dict:
    for row in found:
        write_owned_fields(connection, [row["id"]], {field: item["new"] for field, item in row["fields"].items()},
                           OWNER)
    return {"changed": sum(len(row["fields"]) for row in found),
            "assets": [{"id": row["id"], **{field: {"value": item["old"], "owner": item["owner"]}
                                            for field, item in row["fields"].items()}} for row in found]}


# ---- 厂牌、系列扁平值写的是别名 ----

def find_alias_flat_names(connection) -> list[dict]:
    """`asset.studio`／`asset.series` 写的是某条实体的别名：按 `resolve_entity`（唯一别名才算）换成规范名。"""
    from .entities import resolve_entity
    found = []
    for field, kind in (("studio", "studio"), ("series", "series")):
        for (value,) in _rows(connection, f"SELECT DISTINCT {field} FROM asset WHERE trim(COALESCE({field},''))<>''"):
            entity = resolve_entity(connection, kind, value)
            if entity is None:
                continue
            canonical = entity["canonical_name"] if hasattr(entity, "keys") else entity[2]
            if not canonical or canonical == value:
                continue
            assets = [(asset_id, owner_of(owners, field)) for asset_id, owners in _rows(
                connection, f"SELECT id,field_owners FROM asset WHERE {field}=?", (value,))]
            assets = [(asset_id, owner) for asset_id, owner in assets if not is_protected(owner)]
            if assets:
                found.append({"field": field, "value": value, "canonical": canonical,
                              "assets": [{"id": asset_id, "owner": owner} for asset_id, owner in assets]})
    return found


def fix_alias_flat_names(connection, found: list[dict]) -> dict:
    for row in found:
        write_owned_fields(connection, [item["id"] for item in row["assets"]], {row["field"]: row["canonical"]}, OWNER)
    return {"changed": sum(len(row["assets"]) for row in found),
            "values": [{key: row[key] for key in ("field", "value", "canonical", "assets")} for row in found]}


# ---- 标签：退役名、撤掉的粗桶、旧版没规范化的 NFO 标签 ----

#: 0.34.2 之前本地 NFO 的标签只做了大小写与空白规范就落库。
NFO_TAG_SOURCE = "javinizer:local_nfo:tag"


def _nfo_tag_moves(connection) -> list[dict]:
    from .genre_taxonomy import UNMAPPED, resolve_genre
    moves = []
    for (tag,) in _rows(connection, "SELECT DISTINCT tag FROM asset_tag WHERE source=?", (NFO_TAG_SOURCE,)):
        target = resolve_genre(tag)
        if target == UNMAPPED or target == tag:
            continue
        moves.append({"old": tag, "new": target or ""})
    return moves


def find_tag_vocabulary(connection) -> dict:
    """退役名与粗桶（`tag_renames.collect`，只取有存量的）以及要按词表改名或撤下的 NFO 标签。"""
    from . import tag_renames
    retired = [row for row in tag_renames.collect(connection)
               if row["assets"] or row["merged"] or row["entity"]]
    nfo = _nfo_tag_moves(connection)
    return {"retired": retired, "nfo": nfo} if retired or nfo else {}


def fix_tag_vocabulary(connection, found: dict) -> dict:
    """改之前把会动到的 `asset_tag` 行原样记下；标签实体的改名、合并由 `tag_renames.apply_rows` 做，
    回滚靠同一次的写入前备份。原始来源（`RAW_TAG_SOURCES`）的标签不动。"""
    from . import tag_renames
    if not found:
        return {"changed": 0, "tags": []}
    names = sorted({row["old"] for row in found["retired"]})
    rows = []
    if names:
        raw = sorted(tag_renames.RAW_TAG_SOURCES)
        rows += _rows(connection, f"SELECT asset_id,tag,confidence,source FROM asset_tag WHERE tag IN "
                      f"({','.join('?' * len(names))}) AND source NOT IN ({','.join('?' * len(raw))})",
                      (*names, *raw))
    for move in found["nfo"]:
        rows += _rows(connection, "SELECT asset_id,tag,confidence,source FROM asset_tag WHERE tag=? AND source=?",
                      (move["old"], NFO_TAG_SOURCE))
    if found["retired"]:
        tag_renames.apply_rows(connection, found["retired"])
    for move in found["nfo"]:
        if move["new"]:
            connection.execute("UPDATE OR IGNORE asset_tag SET tag=? WHERE tag=? AND source=?",
                               (move["new"], move["old"], NFO_TAG_SOURCE))
        connection.execute("DELETE FROM asset_tag WHERE tag=? AND source=?", (move["old"], NFO_TAG_SOURCE))
    tags = [dict(zip(("asset_id", "tag", "confidence", "source"), row)) for row in rows]
    return {"changed": len(tags), "tags": tags, "retired": found["retired"], "nfo": found["nfo"]}


# ---- 新作：已有本机封面的蓝光版壳与配信版重复 ----

def find_bluray_duplicates(connection) -> list[dict]:
    """新作列表里蓝光版壳（`bluray_title`）与同一部的配信版壳并存：去掉版本字样与出演者名后标题一样
    （`edition_title_key`），出演者有交集。取资料时的并入（`feed_followup.fold_bluray_edition`）只管还没
    封面的那些，已有封面的旧壳留着重复。"""
    from .jav_editions import bluray_title, edition_title_key
    if "feed_discovery" not in _tables(connection):
        return []
    shells = _rows(connection, "SELECT id,code,title,performers FROM feed_discovery")

    def names(value):
        return {name.strip() for name in re.split(r"[、,]", value or "") if name.strip()}

    plain = defaultdict(list)
    for shell_id, code, title, performers in shells:
        if title and not bluray_title(title):
            plain[edition_title_key(title, names(performers))].append((shell_id, code, names(performers)))
    found = []
    for shell_id, code, title, performers in shells:
        if not title or not bluray_title(title):
            continue
        cast = names(performers)
        key = edition_title_key(title, cast)
        match = next((other for other in plain.get(key, ()) if key and cast & other[2]), None)
        if match is not None:
            found.append({"id": shell_id, "code": code, "digital_id": match[0], "digital_code": match[1]})
    return found


def fix_bluray_duplicates(connection, found: list[dict]) -> dict:
    """删蓝光版那条壳（与 `fold_bluray_edition` 同一写法，连接不开外键，子表显式删），整行原样记下。"""
    columns = [row[1] for row in connection.execute("PRAGMA table_info(feed_discovery)")]
    shells = []
    for row in found:
        stored = connection.execute("SELECT * FROM feed_discovery WHERE id=?", (row["id"],)).fetchone()
        if stored is None:
            continue
        entities = [entity_id for (entity_id,) in _rows(
            connection, "SELECT entity_id FROM feed_discovery_entity WHERE discovery_id=?", (row["id"],))]
        shells.append({**dict(zip(columns, stored)), "entities": entities, "digital_code": row["digital_code"]})
        connection.execute("DELETE FROM feed_discovery_entity WHERE discovery_id=?", (row["id"],))
        connection.execute("DELETE FROM feed_discovery WHERE id=?", (row["id"],))
    return {"changed": len(shells), "shells": shells}


# ---- 想要：先到的封面图把它标成了已到手 ----

def find_image_acquired_wants(connection) -> list[dict]:
    """标「已入库」、对上的却不是视频的想要（#681 之前入库对账只看番号）。同番号的视频在库就改指它，
    不在就回到待找。"""
    if "want_item" not in _tables(connection):
        return []
    found = []
    for want_id, key, asset_id in _rows(
            connection, "SELECT w.id,w.code_key,w.acquired_asset_id FROM want_item w"
                        " LEFT JOIN asset a ON a.id=w.acquired_asset_id"
                        " WHERE w.state='acquired' AND w.acquired_asset_id IS NOT NULL"
                        " AND COALESCE(a.medium,'')<>'video'"):
        video = None
        if key:
            hit = connection.execute(
                "SELECT id FROM asset WHERE medium='video' AND code IS NOT NULL AND COALESCE(disposal,'')<>'vanished'"
                " AND normalise_code_key(code)=? ORDER BY id LIMIT 1", (key,)).fetchone()
            video = int(hit[0]) if hit else None
        found.append({"id": want_id, "asset_id": asset_id, "video": video})
    return found


def fix_image_acquired_wants(connection, found: list[dict]) -> dict:
    columns = ("state", "acquired_asset_id", "acquired_at", "acquired_source", "acquired_batch", "updated_at")
    wants = []
    for row in found:
        stored = connection.execute(f"SELECT {','.join(columns)} FROM want_item WHERE id=?", (row["id"],)).fetchone()
        if stored is None:
            continue
        wants.append({"id": row["id"], **dict(zip(columns, stored))})
        if row["video"] is not None:
            connection.execute("UPDATE want_item SET acquired_asset_id=?,updated_at=? WHERE id=?",
                               (row["video"], _stamp(), row["id"]))
        else:
            connection.execute(
                "UPDATE want_item SET state=CASE WHEN given_up_at IS NULL THEN 'wanted' ELSE 'given_up' END,"
                "acquired_asset_id=NULL,acquired_at=NULL,acquired_source=NULL,acquired_batch=NULL,updated_at=?"
                " WHERE id=?", (_stamp(), row["id"]))
    return {"changed": len(wants), "wants": wants}


# ---- 云下载：迁移 0056 之前写下的中文说明 ----

#: 有 code 列的说明列：(表, 原文列)。code 列是 `<原文列>_code`，参数列是 `<原文列>_params`。
DOWNLOAD_TEXT_COLUMNS = (("download_task", "failure_detail"), ("download_task", "postprocess_detail"),
                         ("download_submission", "detail"))
#: 模板里至少要有这么多个汉字落在参数之外，才拿来认旧原文：只剩占位的模板什么都对得上。
_MIN_LITERAL_HAN = 2
_HAN = re.compile(f"[{chr(0x3400)}-{chr(0x9FFF)}]")
_PARAM = re.compile(r"\{\{(\w+)\}\}")


def _server_templates() -> tuple[list[tuple[str, re.Pattern]], dict[str, str]]:
    """zh-CN `server` 资源里每条可当一句说明的模板 (code, 整句正则)，以及不带参数、只有一个 code 用到的
    `labels.*` 短语到 code 的对照（嵌套参数：`{{action}}` 填的是「查离线任务」这类短语的 code）。"""
    from .interface_text_upgrade import _pattern
    data = json.loads((interface_text.LOCALES / "zh-CN" / "server.json").read_text(encoding="utf-8"))
    templates, literals = [], defaultdict(set)

    def walk(node, path):
        if isinstance(node, dict):
            for key, value in node.items():
                walk(value, (*path, key))
        elif isinstance(node, str):
            code = ".".join(path)
            names = _PARAM.findall(node)
            # 同一参数出现两次的模板拼不成正则（组名重复），这类句子不认。
            if len(_HAN.findall(_PARAM.sub("", node))) >= _MIN_LITERAL_HAN and len(names) == len(set(names)):
                templates.append((code, _pattern(node)))
            if code.startswith("labels.") and not _PARAM.search(node):
                literals[node].add(code)
    walk(data, ())
    return templates, {text: next(iter(codes)) for text, codes in literals.items() if len(codes) == 1}


def _param(value: str, literals: dict[str, str]):
    if value.isdigit():
        return int(value)
    return {"code": literals[value]} if value in literals else value


def _code_of(text: str, grammar) -> tuple[str, dict] | None:
    """整句只对上一条模板时给出 code 与参数；对上几条（措辞相同、code 不同）的有歧义，不转。"""
    templates, literals = grammar
    hits = {}
    for code, pattern in templates:
        match = pattern.fullmatch(text)
        if match:
            hits[code] = {key: _param(value, literals) for key, value in match.groupdict().items()}
    return next(iter(hits.items())) if len(hits) == 1 else None


def find_download_text_codes(connection) -> list[dict]:
    """云下载任务与提交记录里没有 code 的中文说明，能唯一对上一条 `server` 模板的。"""
    tables = _tables(connection)
    texts = defaultdict(list)
    for table, column in DOWNLOAD_TEXT_COLUMNS:
        if table not in tables:
            continue
        for row_id, text in _rows(connection, f"SELECT id,{column} FROM {table} WHERE {column} IS NOT NULL"
                                  f" AND COALESCE({column}_code,'')=''"):
            if _HAN.search(text):
                texts[text].append((table, column, row_id))
    if not texts:
        return []
    grammar = _server_templates()
    found = []
    for text, places in texts.items():
        coded = _code_of(text, grammar)
        if coded is not None:
            found.append({"text": text, "code": coded[0], "params": coded[1], "rows": places})
    return found


def fix_download_text_codes(connection, found: list[dict]) -> dict:
    """只补 code 与参数两列，原句不动（界面按 code 渲染，`restored` 仍以原句为值）；撤回把两列清空即可。"""
    rows = []
    for item in found:
        params = json.dumps(item["params"], ensure_ascii=False)
        for table, column, row_id in item["rows"]:
            connection.execute(f"UPDATE {table} SET {column}_code=?,{column}_params=? WHERE id=?"
                               f" AND COALESCE({column}_code,'')=''", (item["code"], params, row_id))
            rows.append({"table": table, "column": column, "id": row_id})
    return {"changed": len(rows), "rows": rows, "codes": sorted({item["code"] for item in found})}


def _stamp() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


RULES = (
    Rule("entity-link-values-1", "entity-links", find_entity_links, fix_entity_links),
    Rule("fc2-seller-studios-1", "fc2-studios", find_fc2_seller_studios, fix_fc2_seller_studios),
    Rule("scrape-mark-titles-1", "scrape-mark-titles", find_scrape_mark_titles, fix_scrape_mark_titles),
    Rule("alias-flat-names-1", "alias-flat-names", find_alias_flat_names, fix_alias_flat_names),
    Rule("tag-vocabulary-1", "tag-vocabulary", find_tag_vocabulary, fix_tag_vocabulary),
    Rule("feed-bluray-duplicates-1", "bluray-duplicates", find_bluray_duplicates, fix_bluray_duplicates),
    Rule("want-image-acquired-1", "want-acquired", find_image_acquired_wants, fix_image_acquired_wants),
    Rule("download-text-codes-1", "download-text", find_download_text_codes, fix_download_text_codes),
)


def pending(connection) -> list[Rule]:
    """还没做过的规则。"""
    done = {row[0] for row in connection.execute(
        f"SELECT id FROM ledger_upgrade_repair WHERE id IN ({','.join('?' * len(RULES))})",
        [rule.key for rule in RULES])}
    return [rule for rule in RULES if rule.key not in done]
