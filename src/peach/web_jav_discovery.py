"""只读 JAV 发现：库外已知作品与少看的馆藏共用口味和展示契约。"""
from __future__ import annotations

import hashlib
import re
import time

from . import entities, feed_followup, web_catalog, web_feeds, wants
from .related import rank_related
from .taste_preferences import preference_profile, preference_score
from .genre_decisions import load_genre_decisions
from .jav_discovery_metadata import discovery_metadata, source_number
from .user_messages import UserValueError, message_fields
from .web_state import path_version
from .web_jav_detail import _source_fields, discovery_cover_url, visible_actors, source_performer_refs

def _identity(connection, kind, name):
    found = entities.resolve_entity(connection, kind, name)
    return int(found["id"]) if found else f"name:{entities.normalize_entity_name(name)}"


def _cached_movie(code, contract):
    from .javdb_public import PUBLIC_API, public_cache_scope, cache_checked_at
    metadata = discovery_metadata(contract)
    stored, _ = metadata.peek(code)
    if stored:
        return stored
    with public_cache_scope(contract.cover_root.parent / 'jav-public'):
        source = PUBLIC_API.peek_movie(code)
        if source:
            metadata.remember(code, source, checked_at=cache_checked_at('movie:' + code + ':'))
    return source or {}


def _external(connection, contract):
    web_feeds.register_listed(contract, connection)
    rows = [dict(row) for row in connection.execute(
        "SELECT d.* FROM feed_discovery d WHERE d.ignored_at IS NULL AND "
        + " AND ".join(web_feeds.LISTED) + " ORDER BY d.id")]
    identities = {}
    excluded = entities.male_performer_ids(connection)
    decisions = load_genre_decisions(connection)
    for row in rows:
        detail = _cached_movie(row["code"], contract)
        row['cover_url'] = discovery_cover_url(row, detail)
        projection = _source_fields(detail, decisions)
        tags = [tag["name"] for tag in projection["tag_refs"]]
        row["source_tags"] = projection["tags"]
        row["tag_refs"] = projection["tag_refs"]
        row["source_score"] = source_number(detail.get("score"))
        _, metadata_fields = discovery_metadata(contract).peek(row["code"])
        row.update(metadata_fields)
        series = detail.get("series_name") or ""
        if detail.get("maker_name"):
            row["studio"] = detail["maker_name"]
        source_actors = visible_actors(connection, detail, excluded)
        actors = [actor['name'] for actor in source_actors]
        row['_source_actors'] = source_actors
        if 'actors' in detail:
            row["performers"] = "、".join(actors)
        minutes = source_number(detail.get("duration"))
        row["duration"] = minutes * 60 if minutes else None
        features = {}
        for kind, values in (("performer", re.split(r"[,，、;/]", row["performers"] or "")),
                             ("studio", [row["studio"] or ""]), ("tag", tags), ("series", [series])):
            features[kind] = set()
            for name in values:
                name = name.strip()
                if not name:
                    continue
                key = (kind, name)
                if key not in identities:
                    identities[key] = _identity(connection, kind, name)
                features[kind].add(identities[key])
        row["entities"] = features
        features["creator"] = {_identity(connection, "creator", name) for name in actors
                               if entities.resolve_entity(connection, "creator", name)}
        row["tags"] = tags
        row["asset_id"] = None
    return rows


def _library(connection):
    # 完播作品和反复观看作品不属于「少看」；未知时长只按已有观看次数判断。
    rows = [dict(row) for row in connection.execute(
        "SELECT a.id,a.location,a.name,COALESCE(NULLIF(a.catalog_title,''),NULLIF(a.original_title,''),a.name) AS title,a.creator,a.studio,a.code,"
        "a.release_date,a.duration,a.snapshot_path,a.play_count,a.max_reached,a.region,"
        + web_catalog.EFFECTIVE_REGION_SQL + " AS effective_region FROM asset a WHERE "
        + web_catalog.JAV_ASSET_PREDICATE
        + " AND a.medium='video' AND a.disposal IS NULL AND COALESCE(a.feedback,'') NOT IN ('dislike','seen')"
        " AND COALESCE(a.play_count,0)<=1 AND (COALESCE(a.duration,0)<=0"
        " OR COALESCE(a.max_reached,0)<a.duration*0.5) ORDER BY a.id")]
    by_id = {row["id"]: row for row in rows}
    excluded = entities.male_performer_ids(connection)
    for row in rows:
        row.update({"entities": {}, "tags": [], "asset_id": row["id"], "cover_url": "", "link": "",
                    "source_score": None, "metadata_state": "ready", "metadata_fields": {}})
    for offset in range(0, len(rows), 800):
        ids = [row["id"] for row in rows[offset:offset + 800]]
        marks = ",".join("?" * len(ids))
        for aid, identity, kind, name in connection.execute(
            "SELECT ae.asset_id,e.id,e.kind,e.canonical_name FROM asset_entity ae"
            " JOIN entity e ON e.id=ae.entity_id WHERE ae.asset_id IN (" + marks + ")"
            " AND e.kind IN ('performer','creator','tag','studio','series') AND (e.kind<>'tag' OR "
            + web_catalog.tag_not_hidden("ae.asset_id", "e.normalized_name") + ") ORDER BY e.canonical_name", ids):
            if identity in excluded:
                continue
            row = by_id[aid]
            row["entities"].setdefault(kind, set()).add(identity)
            if kind == "tag" and web_catalog.tag_cat(name) in (
                    "general", "relationship", "role", "appearance", "scene", "story", "position"):
                row["tags"].append(name)
        # 兼容投影仍须同一身份解析，不以名称子串匹配。
        for row in rows[offset:offset + 800]:
            if not row["entities"].get("studio") and row.get("studio"):
                row["entities"]["studio"] = {_identity(connection, "studio", row["studio"])}
            if not row["entities"].get("creator") and row.get("creator"):
                row["entities"]["creator"] = {_identity(connection, "creator", row["creator"])}
    return rows


def _metadata_cursor(args, candidates) -> int:
    return max(0, min(int(args.get("metadata_cursor") or 0), len(candidates)))


def _metadata_response(contract, args, candidates, picked, limit, scope):
    """只读：当前那一轮资料读取的进度。起、停任务走 `w_jav_discovery_metadata`。"""
    if scope != "external":
        return {}
    job = discovery_metadata(contract).current()
    if not job:
        return {}
    cursor = _metadata_cursor(args, candidates)
    return {**_job_response(job),
            "metadata_coverage": sum(row["metadata_state"] in ("ready", "partial", "stale") for row in picked),
            "metadata_next_cursor": cursor + limit if not picked and cursor + limit < len(candidates) else None}


def q_jav_discovery_metadata(contract, _args):
    """发现页资料读取的进度轮询：只读任务快照，不算候选、不打分。"""
    job = discovery_metadata(contract).current()
    return _job_response(job) if job else {"metadata_job": None}


def w_jav_discovery_metadata(contract, body):
    """发现页「更新资料」「停止读取」「立即重试」，以及打开页面时补读从没读过的那几部。

    `action`：`start` 只读缓存已过期或从没读过的，`refresh` 整批重读，`cancel` 停下当前这一轮。
    读哪一批与页面当前排序下的那一页相同（`_ranked`）；GET 不起任务。
    """
    action = str(body.get("action") or "start")
    if action not in ("start", "refresh", "cancel"):
        raise UserValueError("api.javDiscovery.invalidMetadataAction")
    metadata = discovery_metadata(contract)
    if action == "cancel":
        job = metadata.cancel(body.get("job_id") or None)
    else:
        limit, sort, descending = _ranking_args(body)
        ranked = _ranked(contract, "external", sort, descending, limit)
        candidates, picked = ranked["bounded"], ranked["picked"]
        cursor = _metadata_cursor(body, candidates)
        cohort = picked if picked and not cursor else sorted(candidates, key=lambda row: row["id"])[cursor:cursor + limit]
        job = metadata.ensure([row["code"] for row in cohort], refresh=action == "refresh",
                              job_id=body.get("job_id") or None)
    return _job_response(job) if job else {"metadata_job": None}


def _job_response(job):
    public_job = {key: value for key, value in job.items() if key not in ("codes", "error")}
    message = message_fields(_metadata_message(job))
    public_job.update(message)
    failed = job["status"] == "failed"
    public_job.update(error=message["message"] if failed else "",
                      error_code=message["message_code"] if failed else "",
                      error_params=message["message_params"] if failed else {})
    return {"metadata_job": public_job, **({"poll_after_ms": 3000} if job["status"] == "running" else {})}


#: 作品资料读取任务的状态说明：先看停止原因，再看状态。
METADATA_STATUS_MESSAGES = {
    "running": "jobMessage.webJavDiscovery.reading", "complete": "jobMessage.webJavDiscovery.complete",
    "failed": "jobMessage.webJavDiscovery.unfetched", "cancelling": "jobMessage.webJavDiscovery.cancelling",
    "cancelled": "jobMessage.webJavDiscovery.cancelled",
}
METADATA_STOP_MESSAGES = {
    "request_budget": "jobMessage.webJavDiscovery.requestBudget", "byte_budget": "jobMessage.webJavDiscovery.byteBudget",
    "time_budget": "jobMessage.webJavDiscovery.timeBudget", "source_cooldown": "jobMessage.webJavDiscovery.sourceCooldown",
    "cancelled": "jobMessage.webJavDiscovery.stopped",
}


def _metadata_message(job) -> str:
    """任务此刻那一句的 code。"""
    return METADATA_STOP_MESSAGES.get(job.get("stop_reason"),
                                      METADATA_STATUS_MESSAGES.get(job["status"], "jobMessage.webJavDiscovery.unfetched"))


DISCOVERY_SORTS = ("taste", "release_date", "source_score", "duration", "code")
#: 打分读的账本之外、又写得很勤的表：在线播放心跳、播放记录与搜索历史。打分不读它们。
RANKING_UNREAD_TABLES = ("follow_playback", "activity_event", "search_history")


def _ranking_args(args):
    limit = max(1, min(int(args.get("limit") or 60), 100))
    sort = args.get("sort") if args.get("sort") in DISCOVERY_SORTS else "taste"
    return limit, sort, args.get("direction") != "asc"


def _ranking_inputs(contract, scope):
    """打分读的账本之外的输入：口味浏览库、资料边车与封面目录（封面决定「官方还没出图」的
    收起）。`peek()` 的「已过期」随时钟变，另带一个小时档。"""
    external = scope == "external"
    return (path_version(contract.taste_history_store),
            discovery_metadata(contract).revision if external else 0,
            path_version(contract.cover_root) if external else None,
            int(time.time() // 3600))


def _scored(contract, scope):
    """候选、口味打分与限定：每个范围一份，各种排序共用。"""
    def compute():
        with contract.read_connection() as connection, entities.memoized_resolution():
            strengths, names, evidence = preference_profile(connection, contract.taste_history_store)
            profile = {"id": 0, "entities": {kind: set(values) for kind, values in strengths.items()}}
            candidates = _library(connection) if scope == "library" else _external(connection, contract)
        unique = {}
        for row in candidates:
            key = web_catalog.normalise_code_key(row["code"]) or row["id"]
            unique.setdefault(key, row)
        candidates = list(unique.values())
        # 已知候选按匹配维度排序后再限定计算量，不以发行时间裁掉旧作。
        for row in candidates:
            row["preference_score"], row["reasons"] = preference_score(row, strengths, names, evidence)
        candidates.sort(key=lambda row: (-row["preference_score"], row["id"]))
        return {"total": len(candidates), "bounded": candidates[:4000], "profile": profile}

    return contract.cached_until_changed(
        repr(("jav-discoveries", scope)), compute, *_ranking_inputs(contract, scope),
        tables=contract.ledger_tables_except(RANKING_UNREAD_TABLES), allow_stale=False)


def _ranked(contract, scope, sort, descending, limit):
    """一页推荐：MMR 或按字段排序，按与候选相同的输入版本缓存。

    任务进行中页面会反复来取，原来每次都对几千个候选重做一遍纯 Python 打分。结果是共享对象，
    调用方先复制再改。
    """
    def compute():
        scored = _scored(contract, scope)
        picked = rank_related(scored["profile"], scored["bounded"], limit, seed=f"jav:{scope}",
                              order_by=None if sort == "taste" else sort, descending=descending,
                              relevance_for=lambda row: row["preference_score"])
        for row in picked:
            row["score"] = row.pop("related_score")
            row["taste_score"] = row["score"]
            row.pop("preference_score", None)
            row.pop("why", None)
            row.pop("entities", None)
        if sort == "taste":
            picked.sort(key=lambda row: (row["taste_score"], row["id"]), reverse=descending)
        for rank, row in enumerate(picked, 1):
            row["rank"] = rank
        return {"total": scored["total"], "bounded": scored["bounded"], "picked": picked}

    return contract.cached_until_changed(
        repr(("jav-discoveries", scope, sort, descending, limit)), compute, *_ranking_inputs(contract, scope),
        tables=contract.ledger_tables_except(RANKING_UNREAD_TABLES), allow_stale=False)


def q_jav_discoveries(contract, args):
    """口味采用 IDF/MMR；只读，资料补齐由 `w_jav_discovery_metadata` 起，进度另有轮询。"""
    scope = "library" if args.get("scope") == "library" else "external"
    limit, sort, descending = _ranking_args(args)
    ranked = _ranked(contract, scope, sort, descending, limit)
    bounded, total = ranked["bounded"], ranked["total"]
    picked = [dict(row) for row in ranked["picked"]]
    with contract.read_connection() as connection, entities.memoized_resolution():
        wanted = wants.wanted_keys(connection, (web_catalog.normalise_code_key(row["code"]) for row in picked))
        refs = web_feeds._discovery_performers(connection, contract, picked) if scope == "external" else {}
        for row in picked:
            actors = row.pop('_source_actors', [])
            if actors:
                refs[row['id']] = source_performer_refs(contract, connection, actors)
            row["wanted"] = web_catalog.normalise_code_key(row["code"]) in wanted
    if scope == "library":
        web_catalog.attach_card_performers(contract, picked)
        for row in picked:
            row["performer_refs"] = row.pop("performer_entities", [])
            row["performers"] = "、".join(row["performers"])
            web_catalog.attach_artwork_fields(contract, row)
            row["has_thumb"] = contract.has_snapshot(row.pop("snapshot_path", None))
    else:
        states = feed_followup.cover_states(contract, picked)
        for row in picked:
            row["performer_refs"] = refs[row["id"]]
            row["performers"] = "、".join(ref["name"] for ref in row["performer_refs"])
            row["has_cover"] = contract.has_cover(row["code"])
            row["cover_frame"] = contract.cover_frame(row["code"])
            row["cover_version"] = contract.cover_version(row["code"])
            row["poster_box"] = contract.poster_box(row["code"])
            row.update(web_feeds.cover_state_fields(states, row["code"]))
    response = {"scope": scope, "items": picked, "candidate_total": total, "sort": sort,
                "ranking_method": "mmr" if sort == "taste" else "field-sort",
                "direction": "asc" if args.get("direction") == "asc" else "desc",
                "limited": total > 4000, "source": "library" if scope == "library" else "known-works"}
    response.update(_metadata_response(contract, args, bounded, picked, limit, scope))
    return response


RELEASE_PAGE_SIZE = 24
#: 新作的三个筛选维度：每部的女优（解析后的规范名）、厂牌（规范名）与标签。
RELEASE_FACETS = ("performer", "studio", "tag")


#: 新作的排序：发行时间（默认）、来源评分、时长、番号、口味，`random` 是「换一批」。
RELEASE_SORTS = ("release_date", "source_score", "duration", "code", "taste", "random")


def _release_values(row, facet):
    if facet == "performer":
        return [ref["name"] for ref in row["performer_refs"]]
    if facet == "studio":
        return [row["studio"]] if row["studio"] else []
    return row["tags"]


def _release_order(rows, sort, descending, seed):
    """按发行日期倒序打底，再按所选字段稳定排序；取不到值的排在末尾，不随方向翻转。

    `random` 按 `seed` 与番号的摘要排：同一个种子翻页时顺序不变，换种子就是换一批。
    """
    rows = sorted(rows, key=lambda row: (row["release_date"] or row["discovered_at"] or "", row["id"]), reverse=True)
    if sort == "random":
        return sorted(rows, key=lambda row: hashlib.sha1(f"{seed}\0{row['code']}".encode("utf-8")).hexdigest())
    if sort == "release_date":
        return rows if descending else rows[::-1]
    field = "taste_score" if sort == "taste" else sort
    known = [row for row in rows if row.get(field) not in (None, "")]
    known.sort(key=lambda row: row[field], reverse=descending)
    return known + [row for row in rows if row.get(field) in (None, "")]


def q_jav_releases(contract, args):
    """订阅发现的全部未入库新作：默认按发行日期倒序分页，可按女优、厂牌、标签与文字筛选，
    排序见 `RELEASE_SORTS`（口味分只在按口味排时现算）。

    候选与「发现」同一批（`_external`），只换成时间顺序、不按口味截断。筛选项只取这批新作里
    出现过的女优、厂牌与标签；每个维度的计数按「文字与其他维度已生效、本维度不计」的行集算，
    计数为 0 的不列。

    只读：筛选结果里从没读过来源资料的（`metadata_state` 为 pending）只报个数（`metadata_unread`），
    读取由 `w_jav_release_metadata` 起停，与「发现」共用同一个有预算的后台任务，进度由
    `/api/jav/discoveries/metadata` 单独轮询。每问一次都把全部候选重算一遍，不该拿它当进度轮询。
    """
    try:
        size = max(1, min(int(args.get("size") or RELEASE_PAGE_SIZE), 100))
        page = max(1, int(args.get("page") or 1))
    except (TypeError, ValueError):
        size, page = RELEASE_PAGE_SIZE, 1
    with contract.read_connection() as connection, entities.memoized_resolution():
        rows, shown, matches, sort, descending = _release_listing(contract, connection, args)
        if args.get('column'):
            facet = {'people': 'performer', 'studio': 'studio', 'tags': 'tag'}.get(args['column'])
            if facet is None:
                raise ValueError('invalid release facet column')
            query, offset, limit = web_catalog.column_page(args)
            return _release_facet(contract, rows, facet, matches, query=query, offset=offset, limit=limit, paged=True)
        facets = {facet: _release_facet(contract, rows, facet, matches) for facet in RELEASE_FACETS}
        picked = shown[(page - 1) * size:page * size]
        wanted = wants.wanted_keys(connection, (web_catalog.normalise_code_key(row["code"]) for row in picked))
    states = feed_followup.cover_states(contract, picked)
    for row in picked:
        row["wanted"] = web_catalog.normalise_code_key(row["code"]) in wanted
        if row.get('studio'):
            row['studio_ref'] = {'name': row['studio'], 'has_logo': contract.has_logo(row['studio']),
                                 'logo_version': contract.logo_version(row['studio'])}
        row.update(has_cover=contract.has_cover(row["code"]), cover_frame=contract.cover_frame(row["code"]),
                   cover_version=contract.cover_version(row["code"]), poster_box=contract.poster_box(row["code"]),
                   **web_feeds.cover_state_fields(states, row["code"]))
    return {"items": picked, "total": len(shown), "candidate_total": len(rows), "page": page, "size": size,
            "sort": sort, "direction": "desc" if descending else "asc",
            "facets": {"performers": facets["performer"], "studios": facets["studio"], "tags": facets["tag"]},
            "metadata_unread": len(_release_unread(shown)), **_current_job(contract)}


def _release_listing(contract, connection, args):
    """新作全集（已排序）与按筛选条件留下的那些；列表与「读取资料」共用，读的是同一批。"""
    sort = args.get("sort") if args.get("sort") in RELEASE_SORTS else "release_date"
    descending = args.get("direction") != "asc"
    matches = _release_matcher({facet: str(args.get(facet) or "").strip() for facet in RELEASE_FACETS},
                               str(args.get("q") or "").strip().casefold(),
                               web_catalog.column_filters(args.get('column_filters'), {'people', 'studio', 'tags'}))
    rows = _release_rows(contract, connection, taste=sort == "taste" and not args.get('column'))
    if not args.get('column'):
        rows = _release_order(rows, sort, descending, str(args.get("seed") or ""))
    return rows, [row for row in rows if matches(row)], matches, sort, descending


def _release_unread(shown):
    """从没读过来源资料的那几部；读过但没取到的不在此列，不会每次打开都重试。"""
    return [row["code"] for row in shown if row.get("metadata_state") == "pending"]


def _current_job(contract):
    job = discovery_metadata(contract).current()
    return _job_response(job) if job else {}


def w_jav_release_metadata(contract, body):
    """新作页的「读取资料」：`start` 为当前筛选结果里从没读过的那几部起一轮读取，`cancel` 停下当前这一轮。

    与「发现」共用一个任务：一轮在跑时 `start` 只回它的快照。从没读过的作品没有缓存可用，
    所以按 `refresh` 起，不沿用上一轮那批番号。
    """
    action = str(body.get("action") or "start")
    if action not in ("start", "cancel"):
        raise UserValueError("api.javDiscovery.invalidReleaseMetadataAction")
    metadata = discovery_metadata(contract)
    if action == "cancel":
        job = metadata.cancel(body.get("job_id") or None)
        return _job_response(job) if job else {"metadata_job": None}
    with contract.read_connection() as connection, entities.memoized_resolution():
        _rows, shown, _matches, _sort, _descending = _release_listing(contract, connection, body)
    unread = _release_unread(shown)
    job = metadata.ensure(unread, refresh=True) if unread else metadata.current()
    return _job_response(job) if job else {"metadata_job": None}


def _release_rows(contract, connection, *, taste):
    """新作候选：「发现」那批去重，出演换成解析后的规范名、厂牌换成规范名；按口味排时现算口味分。"""
    unique = {}
    for row in _external(connection, contract):
        unique.setdefault(web_catalog.normalise_code_key(row["code"]) or row["id"], row)
    rows = list(unique.values())
    if taste:
        strengths, names, evidence = preference_profile(connection, contract.taste_history_store)
        for row in rows:
            row["taste_score"], row["reasons"] = preference_score(row, strengths, names, evidence)
    refs = web_feeds._discovery_performers(connection, contract, rows)
    studios = {name: web_feeds._studio_name(connection, name) for name in {row["studio"] for row in rows if row["studio"]}}
    for row in rows:
        row.pop("_source_actors", None)
        row.pop("entities", None)
        row["performer_refs"] = refs[int(row["id"])]
        row["performers"] = "、".join(ref["name"] for ref in row["performer_refs"])
        row["studio"] = studios.get(row["studio"], row["studio"])
    return rows


def _release_matcher(chosen, query, columns=None):
    """筛选判据：文字匹配番号、标题、出演、厂牌与标签，三个维度各按所选值；`skip` 的那一维不看。"""
    def matches(row, skip=None):
        if query and query not in " ".join([row["code"] or "", row["title"] or "", row["performers"], row["studio"] or "",
                                            *row["tags"]]).casefold():
            return False
        if not all(not value or facet == skip or value in _release_values(row, facet) for facet, value in chosen.items()):
            return False
        for column, selection in (columns or {}).items():
            exclude = isinstance(selection, dict)
            values = selection['exclude'] if exclude else selection
            facet = {'people': 'performer', 'studio': 'studio', 'tags': 'tag'}[column]
            accepted = [value.removeprefix('performer:') for value in values] if column == 'people' else values
            if facet != skip:
                overlap = bool(set(accepted).intersection(_release_values(row, facet)))
                if (exclude and overlap) or (not exclude and not overlap):
                    return False
        return True
    return matches


def _release_facet(contract, rows, facet, matches, *, query='', offset=0, limit=24, paged=False):
    """一个维度的筛选项：本维度不计、其余条件生效的行集里出现过的值与部数，部数多的在前。"""
    counts, first = {}, {}
    for row in rows:
        if matches(row, skip=facet):
            for value in dict.fromkeys(_release_values(row, facet)):
                counts[value] = counts.get(value, 0) + 1
                first.setdefault(value, row)
    ordered = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    if query:
        search, parameters = web_catalog.column_search(query)
        with contract.read_connection() as connection:
            matched_ids = {row[0] for row in connection.execute(
                "SELECT e.id FROM entity e WHERE e.kind=? AND " + search, [facet, *parameters])}
        ordered = [(name, count) for name, count in ordered if query.casefold() in name.casefold()
                   or (facet == 'performer' and any(ref.get('id') in matched_ids for ref in first[name]['performer_refs']
                                                   if ref['name'] == name))]
    more = len(ordered) > offset + limit
    ordered = ordered[offset:offset + limit]
    if facet == "performer":
        people = [{**next(ref for ref in first[name]["performer_refs"] if ref["name"] == name),
                   "avatar_code": first[name]['code'], "count": count} for name, count in ordered]
        with contract.read_connection() as connection:
            web_catalog.attach_entity_aliases(connection, people)
        options = people
    elif facet == "studio":
        options = [{"name": name, "count": count, "has_logo": contract.has_logo(name), "logo_version": contract.logo_version(name)}
                   for name, count in ordered]
    else:
        options = [{"name": name, "count": count} for name, count in ordered]
    return {'items': options, 'has_more': more, 'next_offset': offset + len(options) if more else None} if paged else options
