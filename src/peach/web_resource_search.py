"""资源搜索的只读 Web 契约；下载仍由云下载写入口接收。"""
from .coded_text import parallel
from .javdb_public import public_cache_scope
from .magnet_chain import HIGH_QUALITY, edition_rank, rank_candidates, search as direct_search
from .resource_search import Filters, Indexers, Search
from .user_messages import UserValueError

_SEARCH = Search()


def _merged_error(direct: dict, indexed: dict) -> dict:
    """两路都没给出结果时用后备索引器那一句报错，连同它的 code 一起交给界面；有结果时报错为空。"""
    if direct["items"] or indexed.get("ok"):
        return {"error": ""}
    return {"error": indexed.get("error", ""),
            **{key: indexed[key] for key in ("error_code", "error_params") if key in indexed}}


def auto_resource_search(contract, args) -> dict:
    return q_resource_search(contract, args, edition_preferences=contract.downloads.config.edition_preferences)


def q_resource_search(contract, args, *, edition_preferences: tuple[str, ...] = ()) -> dict:
    service = getattr(contract, "downloads", None)
    if service is None:
        raise UserValueError("api.resourceSearch.downloadsDisabled")
    try:
        filters = Filters(min_size=int(args.get("min_size") or 0),
                          max_size=int(args.get("max_size") or 1024 ** 4),
                          goal=str(args.get("goal") or "quality"))
    except (TypeError, OverflowError):
        raise UserValueError("api.resourceSearch.invalidSizeRange") from None
    with contract.database.read_connection() as connection:
        blocked = [row[0] for row in connection.execute(
            "SELECT info_hash FROM download_task WHERE blocked_at IS NOT NULL")]
    # 浏览器添加换磁力时传入已失败的 infohash：它们和违规拦截一样不再作为候选，
    # 而且不能在 manko.fun 那一步短路——被跳过的往往正是那条高清结果，短路会让其他来源一条都不查。
    raw_skip = args.get("skip")
    skip = list(map(str, raw_skip)) if isinstance(raw_skip, (list, tuple)) else []
    excluded = set(blocked) | set(skip)
    code = str(args.get("code") or "")
    with public_cache_scope(contract.cover_root.parent / 'jav-public'):
        direct = direct_search(
            contract.follow_secrets_root, code, min_size=filters.min_size,
            max_size=filters.max_size, goal=filters.goal, stop_on_preferred=not skip,
            edition_preferences=edition_preferences)
    direct["items"] = [row for row in direct["items"] if row["info_hash"] not in excluded]
    # manko.fun 给出高清候选时按用户指定的优先级短路，不再消耗后备索引器请求。
    if not skip and not edition_preferences and direct["items"] and direct["items"][0]["source"] == "manko.fun" \
            and direct["items"][0]["resolution"] >= HIGH_QUALITY:
        return {"ok": True, "state": "ready", **direct}
    options = {}
    if edition_preferences:
        options["priority"] = lambda row: edition_rank(row, code, edition_preferences)
    indexed = _SEARCH.run(Indexers(service.credentials).load(), code, filters, sorted(excluded), **options)
    combined = list(direct["items"])
    for row in indexed.get("items", ()):
        combined.append({
            **row, "size_text": "", "files": "", "file_count": 0, "file_list": [],
            "promo_files": 0, "source_url": "", "watermark_check": "pending",
        })
    warnings = direct["warnings"] + list(indexed.get("warnings") or ())
    return {
        "ok": bool(direct["items"]) or indexed.get("ok", False),
        "state": "ready" if direct["items"] or indexed.get("state") == "ready" else indexed.get("state", "error"),
        "items": rank_candidates(combined, filters.goal, code=code, edition_preferences=edition_preferences),
        "warnings": warnings, **parallel("warning", warnings),
        "trace": direct["trace"] + (["indexer fallback: queried"] if indexed.get("state") != "unavailable" else []),
        "next_sources": direct["next_sources"], "reference_only": direct["reference_only"],
        # 后备索引器答复了也补不上直连来源没查成的那部分：浏览器添加据此等来源恢复，不记成无资源。
        "unfetched_sources": list(direct.get("unfetched_sources") or ()),
        **_merged_error(direct, indexed),
        "retry_after": max((value for value in (direct.get('retry_after'), indexed.get('retry_after'))
                            if value is not None), default=None),
    }
