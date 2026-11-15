"""发现使用的偏好快照与候选排序，分数不代表喜欢概率。"""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

from .taste_evidence import era, length_band, preference_evidence
from .taste_history import taste_phrase, taste_text

#: 各维度的权重；维度的显示名在 `taste.dimension.<维度>`。
WEIGHTS = {"performer": .4, "creator": .4, "tag": .34, "studio": .12, "series": .08,
           "era": .03, "length": .03}
#: 一条推荐理由：「维度：命中的名字（证据来源）」。
REASON_CODE = "taste.reason.line"
_PROFILES = {}
_POLICY_FINGERPRINT = None
PROFILE_TABLES = ('asset', 'asset_entity', 'asset_preference', 'entity', 'entity_alias',
                  'entity_link', 'entity_classification', 'follow_source', 'genre_decision')


def _policy_fingerprint():
    global _POLICY_FINGERPRINT
    if _POLICY_FINGERPRINT is None:
        from . import __version__, taste_history, taste_sites, taste_evidence, genre_taxonomy, entities, follow_sources
        digest = hashlib.sha256(__version__.encode())
        for path in (__file__, taste_history.__file__, taste_sites.__file__, taste_evidence.__file__, genre_taxonomy.__file__, entities.__file__, follow_sources.__file__):
            try:
                digest.update(Path(path).read_bytes())
            except OSError:
                pass
        _POLICY_FINGERPRINT = digest.hexdigest()
    return _POLICY_FINGERPRINT


def preference_profile(connection, store, *, cache=True):
    if not cache:
        return preference_evidence(connection, store, cache=False)
    from .taste_history import store_version
    from .fsutil import atomic_write_text
    database = next((row[2] for row in connection.execute("PRAGMA database_list") if row[1] == "main"), "")
    key = None
    if database:
        revision_table = connection.execute("SELECT 1 FROM sqlite_master WHERE name='ledger_revision'").fetchone()
        revision = connection.execute("SELECT sum(n) FROM ledger_revision WHERE tbl IN ("
                                      + ','.join('?' for _ in PROFILE_TABLES) + ')', PROFILE_TABLES).fetchone()[0] if revision_table else None
        key = database, revision if revision_table else store_version(Path(database)), store_version(store), _policy_fingerprint()
        if key in _PROFILES:
            return _PROFILES[key]
        cache_path = store.parent / "preference-cache.json"
        fingerprint = json.dumps(key, ensure_ascii=False)
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if cached.get("version") == 1 and cached.get("fingerprint") == fingerprint:
                strengths, names, evidence = {}, defaultdict(dict), defaultdict(dict)
                for kind, rows in cached["dimensions"].items():
                    strengths[kind] = {row["id"]: row["strength"] for row in rows}
                    names[kind] = {row["id"]: row["name"] for row in rows}
                    evidence[kind] = {row["id"]: row["evidence"] for row in rows}
                _PROFILES.clear()
                _PROFILES[key] = strengths, names, evidence
                return _PROFILES[key]
        except (OSError, ValueError, KeyError, TypeError):
            pass
    result = preference_evidence(connection, store)
    if key:
        _PROFILES.clear()
        _PROFILES[key] = result
        strengths, names, evidence = result
        payload = {"version": 1, "fingerprint": fingerprint, "dimensions": {kind: [
            {"id": eid, "strength": strength, "name": names[kind].get(eid, str(eid)), "evidence": evidence[kind][eid]}
            for eid, strength in values.items()] for kind, values in strengths.items()}}
        try:
            atomic_write_text(cache_path, json.dumps(payload, ensure_ascii=False), mode=0o600)
        except OSError:
            pass
    return result


def preference_score(row, strengths, names, evidence):
    """按候选特征匹配偏好；未知资料不加分，人物与账号只计一个身份维度。

    返回分数与按 zh-CN 渲染好的理由；同时把每条理由的 code 与参数写进 `row` 的 `reason_codes`、
    `reason_params`（与理由一一对应），推荐结果带着它们下发，前端按界面语言重排。
    """
    denominator = sum(WEIGHTS[kind] for kind, values in strengths.items() if values and kind not in {"performer", "creator"})
    denominator += .4 if strengths.get("performer") or strengths.get("creator") else 0
    total = people_score = 0.0
    reasons, reason_params = [], []
    for kind, values in strengths.items():
        features = row.get("entities", {}).get(kind, set())
        if kind == "era":
            features = {era(row.get("release_date"))} - {None}
        elif kind == "length":
            features = {length_band(row.get("duration"))} - {None}
        matches = features & values.keys()
        if not matches:
            continue
        scores = [values.get(eid, 0) for eid in features]
        strength = sum(scores) / len(scores) if kind == "tag" else max(scores)
        if kind in {"performer", "creator"}:
            people_score = max(people_score, .4 * strength)
        else:
            total += WEIGHTS[kind] * strength
        # 证据来源是 id，按显示名排序，与改成 code 之前的先后一致。
        sources = sorted((taste_phrase(f"taste.evidence.{source}", fallback=source) for source in
                          {source for eid in matches for source in evidence[kind][eid]}),
                         key=lambda phrase: phrase["text"])
        labels = sorted(str(names[kind].get(eid, eid)) for eid in matches)[:3]
        if kind in {"era", "length"}:
            labels = [taste_phrase("taste.reason.nearDistribution")]
        params = {"dimension": taste_phrase(f"taste.dimension.{kind}"), "names": labels, "sources": sources}
        reasons.append(taste_text(REASON_CODE, params))
        reason_params.append(params)
    row["reason_codes"] = [REASON_CODE] * len(reasons)
    row["reason_params"] = reason_params
    return round((total + people_score) / denominator, 4) if denominator else 0.0, reasons
