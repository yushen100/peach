"""当前所选艺名的中日显示写法；只读投影，不更改规范名或作品署名。

按语言筛写法只针对采集来的名字：读音、括号注记、说明文字和对不上语言的写法都是来源
噪声。用户自己添的别名（`user:alias`）是本人认定的名字，菜单和别名行在两种语言下都列，
找不到对应语言的写法时照原样显示。
"""
from __future__ import annotations

import json
import re

from . import entity_classification
from .entities import USER_ALIAS_SOURCE, normalize_entity_name
from .kanji import fold_glyphs, simplify_kanji
from .metadata_alias_resolve import is_descriptive, is_planning_alias
from .performer_header import HIDDEN_SOURCES, OTHER, SHOWN, name_group, page_names
from .performer_profiles import read_profile
from .source_page_words import PROFILE_SENTENCE, REVIEWED_WRITINGS
from .sources.seesaa import split_names

_KANA = re.compile(r"[\u3040-\u30ff]")
_LATIN = re.compile(r"[A-Za-z]")
_BRACKET = re.compile(r"[()（）【】\[\]]")
_SENTENCE = re.compile(PROFILE_SENTENCE)
_REVIEWED_WRITINGS = REVIEWED_WRITINGS


def _key(name: str) -> str:
    return normalize_entity_name(fold_glyphs(name))


def writing(canonical: str, page: dict, source_url: str) -> dict:
    """只对当前统称找写法；资料页主名与统称不对应时不采用主名。"""
    original = list(dict.fromkeys(
        name for name in [page["name"], *(entry["name"] for entry in page["aliases"])] if name))
    key = _key(canonical)
    for zh, ja in _REVIEWED_WRITINGS:
        if key in {_key(zh), _key(ja)} and ja in original:
            return {"zh_cn": zh, "ja": ja, "source": source_url, "basis": "reviewed-writing"}
    matches = [name for name in original if _key(name) == key]
    # 多个原文写法折为相同字形时，只有主名确定属于当前艺名才选主名。
    ja = page["name"] if page["name"] in matches else matches[0] if len(matches) == 1 else None
    zh = simplify_kanji(canonical) if not _KANA.search(canonical) else None
    if _LATIN.search(canonical):
        return {"zh_cn": canonical, "ja": canonical, "basis": "original-spelling"}
    return {"zh_cn": zh, "ja": ja, "source": source_url, "basis": "source-glyphs"}


def _stage_key(name: str, page: dict) -> str:
    originals = {page["name"], *(entry["name"] for entry in page["aliases"])}
    for zh, ja in _REVIEWED_WRITINGS:
        if ja in originals and _key(name) in {_key(zh), _key(ja)}:
            return _key(zh)
    return _key(name)


class _NameEvidence:
    """资料原文、读音和别名来源构成的艺名判别证据。"""

    def __init__(self, canonical: str, aliases: list[dict], page: dict, manual: list[str]):
        self.canonical = canonical
        self.originals = {page["name"], *(entry["name"] for entry in page["aliases"])} - {""}
        self.readings = {page["reading"], *(entry.get("reading", "") for entry in page["aliases"])} - {""}
        self.romanizations = {_key(entry.get("romaji", "")) for entry in page["aliases"]} - {""}
        self.hidden = {_key(row["alias"]) for row in aliases if row["source"] in HIDDEN_SOURCES}
        self.manual = set(manual) - {""}
        self.registered = {canonical, *(row["alias"] for row in aliases), *self.manual}
        self.known = {_key(name) for name in self.registered | self.originals}

    def keep(self, name: str) -> bool:
        if name == self.canonical or name in self.manual:
            return True
        if not name or _BRACKET.search(name):
            return False
        parts = split_names(name)
        if len(parts) > 1 and all(_key(part) in self.known for part in parts):
            return False
        if name == "FC2" or _SENTENCE.search(name) or is_descriptive(name):
            return False
        if name not in self.originals and (name in self.readings or _key(name) in self.hidden):
            return False
        if _LATIN.search(name) and not _LATIN.search(self.canonical):
            return name in self.originals and _key(name) not in self.romanizations
        return not is_planning_alias(name)


def _registered_stages(canonical: str, aliases: list[dict], page: dict, source_url: str,
                       manual: list[str]) -> dict:
    """按同一艺名归并写法，同时保留实际登记值。

    用户添的别名所在的那一组缺某种语言的写法时，用别名原文补上，两种语言都不落下它。
    """
    evidence = _NameEvidence(canonical, aliases, page, manual)
    current_key = _stage_key(canonical, page)
    stages: dict[str, dict] = {}
    ordered = [canonical, page["name"], *(entry["name"] for entry in page["aliases"]),
               *(row["alias"] for row in aliases), *manual]
    for name in ordered:
        if not evidence.keep(name):
            continue
        key = _stage_key(name, page)
        row = stages.setdefault(key, {"value": None, "registered": [], "manual": False,
                                      **writing(name, page, source_url)})
        if name in evidence.registered and name not in row["registered"]:
            row["registered"].append(name)
        if row["value"] is None and name in evidence.registered:
            row["value"] = name
        if name in evidence.manual and key != current_key:
            row["manual"] = True
            row["zh_cn"] = row["zh_cn"] or name
            row["ja"] = row["ja"] or name
    return stages


def _language_groups(stages: dict, canonical: str, page: dict, grouped: dict | None, field: str) -> dict:
    """保留来源分组，去除当前艺名的重复写法，按语言展示别名和读音。"""
    current_key = _stage_key(canonical, page)
    taken = {current_key}
    sections = []
    for section in (grouped or {}).get("groups", []):
        shown = []
        for entry in section["names"]:
            key = _stage_key(entry["name"], page)
            row = stages.get(key)
            if row and row[field] and key not in taken:
                shown.append({"name": row[field]})
                taken.add(key)
        if shown:
            sections.append(name_group(section.get("label", ""), shown))
    reading = ""
    if field == "ja":
        if _stage_key(page["name"], page) == current_key:
            reading = page["reading"]
        else:
            reading = next((entry.get("reading", "") for entry in page["aliases"]
                            if _stage_key(entry["name"], page) == current_key), "")
        if reading == stages[current_key][field]:
            reading = ""
    # 页头分组按 ADR-0069 不列纯拉丁写法和读音同键的写法；用户添的别名在这里补回「其它」。
    if reading:
        taken.add(_stage_key(reading, page))
    missing = [{"name": row[field]} for key, row in stages.items()
               if row["manual"] and row[field] and key not in taken]
    if missing:
        other = next((section for section in sections if section["label"] in (OTHER, "")), None)
        if other is None:
            other = name_group(OTHER if sections else "", [])
            sections.append(other)
        other["names"].extend(missing)
    everyone = [entry["name"] for section in sections for entry in section["names"]]
    return {"reading": reading, "shown": everyone[:SHOWN], "total": len(everyone), "groups": sections}


def display(connection, entity_id: int, canonical: str, aliases: list[dict], grouped: dict | None) -> dict:
    """名称菜单与别名行共享语言投影；原始别名和可选名称的值不改写。"""
    profile = read_profile(connection, entity_id)
    page = page_names(profile)
    source_url = (profile or {}).get("source_url", "")
    # 同一写法另有来源时 `aliases` 只带其中一行的来源，用户添的那几条直接按来源查。
    manual = list(dict.fromkeys([
        *(row["alias"] for row in aliases if row["source"] == USER_ALIAS_SOURCE),
        *(str(row[0]) for row in connection.execute(
            "SELECT alias FROM entity_alias WHERE entity_id=? AND source=? ORDER BY alias",
            (int(entity_id), USER_ALIAS_SOURCE)))]))
    stages = _registered_stages(canonical, aliases, page, source_url, manual)
    current_key = _stage_key(canonical, page)
    choices, groups = {}, {}
    for language, field in (("zh-CN", "zh_cn"), ("ja", "ja")):
        choices[language] = [{"value": canonical if key == current_key else
                             row[field] if row[field] in row["registered"] else row["value"],
                              "label": row[field] or canonical}
                             for key, row in stages.items()
                             if row["value"] is not None and (row[field] or key == current_key)]
        groups[language] = _language_groups(stages, canonical, page, grouped, field)
    return {"current": {"canonical_name": canonical, **writing(canonical, page, source_url)},
            "choices": choices, "groups": groups}


def _romaji_names(connection, entity_id: int, canonical: str, profile: dict) -> list[str]:
    """资料页给过的所有罗马字写法：主名在前，登记的拉丁别名补齐，去重不区分大小写。"""
    raw = json.loads(profile.get("raw_json") or "{}")
    page = page_names({"raw": raw})
    found: list[str] = []
    main = str(profile.get("romaji") or "").strip()
    if main:
        found.append(main)
    for entry in page.get("aliases", []):
        candidate = str(entry.get("romaji") or "").strip()
        if candidate and all(candidate.casefold() != seen.casefold() for seen in found):
            found.append(candidate)
    # 登记别名里的拉丁写法也是艺名（`Yuri Oshikawa`、`Rei Kamiki`）：一并进括号。
    for row in connection.execute(
            "SELECT alias FROM entity_alias WHERE entity_id=? ORDER BY alias", (entity_id,)):
        candidate = str(row[0]).strip()
        if (_LATIN.search(candidate) and " " in candidate and canonical != candidate
                and all(candidate.casefold() != seen.casefold() for seen in found)):
            found.append(candidate)
    return found


def variants(connection) -> list[dict]:
    """资料形状接口同时交付只读显示写法；缺失对应关系明确保留为空。"""
    people = list(connection.execute(
        "SELECT id,kind,canonical_name FROM entity WHERE kind IN ('performer','creator')"))
    categories = entity_classification.summaries(connection, [row["id"] for row in people])
    profiles = {row["entity_id"]: dict(row) for row in connection.execute(
        "SELECT * FROM performer_profile")}
    result = []
    for person in people:
        if "japanese_av" not in categories[person["id"]]["identity_categories"]:
            continue
        profile = profiles.get(person["id"], {})
        raw = json.loads(profile.get("raw_json") or "{}")
        names = writing(person["canonical_name"], page_names({"raw": raw}), profile.get("source_url", ""))
        romaji = _romaji_names(connection, person["id"], person["canonical_name"], profile)
        result.append({"id": person["id"], "kind": person["kind"],
                       "canonical_name": person["canonical_name"], "en": romaji[0] if romaji else None,
                       **names})
    return result
