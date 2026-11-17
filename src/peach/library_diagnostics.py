"""诊断报告的只读库健康与来源解析证据。"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from urllib.parse import urlsplit

from . import interface_text
from .catalog_rules import normalise_code_key, release_code_from_text
from .metadata_policy import MAKER_SOURCES
from .metadata_routes import AMANE_STAGE, ROUTES
from .scraping_access import SOURCES, cooldown_state, source_checks

LIMIT = 500
MAX_LOG_BYTES = 8 * 1024 * 1024
MAX_RECORDS = 50_000


def timestamp(value):
    try:
        moment = (datetime.fromtimestamp(value, timezone.utc) if isinstance(value, (int, float))
                  else datetime.fromisoformat(str(value).replace("Z", "+00:00")))
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        return moment.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def inventory(root):
    try:
        with os.scandir(root) as entries:
            return {entry.name[:-4].casefold() for entry in entries if entry.name.endswith(".jpg")}
    except FileNotFoundError:
        return set()
    except OSError:
        return None


#: 库健康各分组的显示名（ADR-0159）；文字在语言资源里。
GROUP_CODES = {"identification": "labels.libraryDiagnostics.group.identification",
               "metadata": "labels.libraryDiagnostics.group.metadata",
               "cover": "labels.libraryDiagnostics.group.cover",
               "duration": "labels.libraryDiagnostics.group.duration"}
#: 读本地文件失败的问题记录不算识别失败；问题记录里写的是这句的 code 或它的中文原句。
LOCAL_ACCESS_CODES = frozenset({"errors.libraryProcessing.mediaInaccessible"})


def _text(code, params=None):
    return interface_text.text(f"server:{code}", params)


def _local_access(row):
    if row.get("message_code") in LOCAL_ACCESS_CODES:
        return True
    return row.get("message") in {_text(code) for code in LOCAL_ACCESS_CODES}


def group(key, rows=None, *, config=None, filters=None):
    label = {"label": _text(GROUP_CODES[key]), "label_code": GROUP_CODES[key]}
    if rows is None:
        return {**label, "status": "unknown", "count": None, "items": [], "truncated": False}
    ordered = sorted(rows, key=lambda row: row["id"])
    facets = {}
    if config is not None:
        from .media_identity import ownership
        from .table_filters import filter_rows
        for item in ordered:
            if "library_id" not in item:
                item["library_id"] = ownership(config, item["path"]).get("library_id", "")
        ordered, facets = filter_rows(ordered, filters, {"location": lambda row: [row["library_id"] or "none"]})
    return {**label, "status": "ok", "count": len(ordered), "items": ordered[:LIMIT],
            "truncated": len(ordered) > LIMIT, "column_facets": facets}


def failures(config):
    state_path = config.directory("state") / "library-processing.json"
    try:
        if state_path.stat().st_size > 1024 * 1024:
            return None, None
        state = json.loads(state_path.read_text(encoding="utf-8"))
        job = state.get("job_id")
        if not isinstance(job, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", job):
            return None, None
        path = state_path.parent / f"library-processing-{job}.issues.jsonl"
        if not path.exists():
            return ({"identification": set(), "metadata": set()}, timestamp(state.get("finished_at"))) if not state.get("issue_count") else (None, None)
        if path.stat().st_size > MAX_LOG_BYTES:
            return None, None
        result = {"identification": set(), "metadata": set()}
        with path.open(encoding="utf-8") as handle:
            for index, line in enumerate(handle):
                if index >= MAX_RECORDS:
                    return None, None
                row = json.loads(line)
                asset_id = row.get("asset_id")
                if not isinstance(asset_id, int) or isinstance(asset_id, bool) or asset_id <= 0:
                    continue
                if row.get("severity") not in {"error", "warning"}:
                    continue
                action = row.get("failed_action")
                if action == "querying_metadata":
                    result["metadata"].add(asset_id)
                # reading_local 的其余资产问题由 NFO 解析与番号冲突分支产生。
                elif action == "reading_local" and not _local_access(row):
                    result["identification"].add(asset_id)
        return result, timestamp(state.get("finished_at") or state.get("started_at"))
    except FileNotFoundError:
        return {"identification": set(), "metadata": set()}, None
    except (OSError, ValueError, TypeError, AttributeError):
        return None, None


def _library_item(row):
    asset_id, code, duration, name, title, original, location, path, size = row
    candidate = str(code or "")
    safe_code = release_code_from_text(candidate) if len(candidate) <= 80 else None
    filename = str(name or str(path or "").replace("\\", "/").rsplit("/", 1)[-1])
    return {"id": asset_id, "code": safe_code or None, "name": filename,
            "title": str(title or original or filename), "location": location,
            "path": str(path or ""), "duration": duration, "size": size}


def library(settings, config, filters=None):
    groups = {key: group(key) for key in GROUP_CODES}
    try:
        with closing(sqlite3.connect(settings.db_path.resolve().as_uri() + "?mode=ro", uri=True, timeout=1)) as connection:
            connection.execute("PRAGMA query_only=ON")
            rows = connection.execute("SELECT id,code,duration,name,catalog_title,original_title,location,path,size "
                                      "FROM asset WHERE medium='video' "
                                      "AND COALESCE(disposal,'') NOT IN ('vanished','trash')").fetchall()
    except (sqlite3.Error, OSError):
        return {"groups": groups, "issue_at": None}
    assets = {row[0]: _library_item(row) for row in rows}
    def grouped(key, items):
        return group(key, items, config=config, filters=(filters or {}).get(key))
    groups["duration"] = grouped("duration", [assets[row[0]] for row in rows if not row[2] or row[2] <= 0])
    covers, posters = inventory(settings.cover_root), inventory(settings.poster_root)
    if covers is not None and posters is not None:
        missing = [assets[row[0]] for row in rows
                   if (normalise_code_key(row[1]).casefold() not in covers if row[1]
                       else f"{row[0]}_4" not in posters)]
        groups["cover"] = grouped("cover", missing)
    failed, issue_at = failures(config)
    if failed is not None:
        for key in ("identification", "metadata"):
            groups[key] = grouped(key, [assets[value] for value in failed[key] if value in assets])
    return {"groups": groups, "issue_at": issue_at}


#: 来源检查失败原因的显示文字（ADR-0159），值是 `labels.libraryDiagnostics.source` 下的 code。
SOURCE_CHECK_REASONS = {
    "proxy": "labels.libraryDiagnostics.source.proxy", "timeout": "labels.libraryDiagnostics.source.timeout",
    "network": "labels.libraryDiagnostics.source.network",
    "auth_required": "labels.libraryDiagnostics.source.authRequired",
    "cloudflare_challenge": "labels.libraryDiagnostics.source.challenge",
    "cloudflare_blocked": "labels.libraryDiagnostics.source.blocked",
    "ip_banned": "labels.libraryDiagnostics.source.blocked",
    "geo_restricted": "labels.libraryDiagnostics.source.geoRestricted",
    "account_suspended": "labels.libraryDiagnostics.source.accountSuspended",
    "rate_limited": "labels.libraryDiagnostics.source.rateLimited",
    "server_error": "labels.libraryDiagnostics.source.serverError",
    "parse_error": "labels.libraryDiagnostics.source.parseError",
    "not_found": "labels.libraryDiagnostics.source.notFound", "cooldown": "labels.libraryDiagnostics.source.cooling",
}


def _source_health(cooling, failed, fresh, recent, connection_ok, reason_key, *, has_success, has_check):
    """来源诊断优先报告冷却与失败，再报告解析和连接证据。返回状态与原因的 code。"""
    if cooling:
        return "warning", "labels.libraryDiagnostics.source.cooling"
    if failed:
        return "warning", SOURCE_CHECK_REASONS.get(reason_key, "labels.libraryDiagnostics.source.failed")
    if fresh:
        return "ok", "labels.libraryDiagnostics.source.parsed"
    if has_success:
        return "stale", "labels.libraryDiagnostics.source.parsedBefore"
    if recent and connection_ok:
        return "unknown", "labels.libraryDiagnostics.source.connectedOnly"
    if has_check:
        return "stale", "labels.libraryDiagnostics.source.checkedBefore"
    return "unchecked", "labels.libraryDiagnostics.source.unchecked"


def _profile_success(settings):
    """从女优资料的来源证据读取最近解析成功时间。"""
    success = {"minnano-av": None, "javdb": None}
    try:
        with closing(sqlite3.connect(settings.db_path.resolve().as_uri() + "?mode=ro", uri=True, timeout=1)) as connection:
            connection.execute("PRAGMA query_only=ON")
            for url, stamp in connection.execute("SELECT source_url,fetched_at FROM performer_profile "
                                                "WHERE source LIKE 'auto:performer-profile@%' ORDER BY fetched_at DESC"):
                if urlsplit(str(url)).hostname in {"minnano-av.com", "www.minnano-av.com"} and timestamp(stamp):
                    success["minnano-av"] = timestamp(stamp)
                    break
            for raw, stamp in connection.execute("SELECT metadata_json,last_synced_at FROM entity_external_ref "
                                                "WHERE provider='javdb' AND external_kind='performer' ORDER BY last_synced_at DESC"):
                try:
                    source = str(json.loads(raw or "{}").get("source", ""))
                except (ValueError, AttributeError):
                    continue
                if (source == "auto:performer-profile" or source.startswith("auto:performer-profile@")) and timestamp(stamp):
                    success["javdb"] = timestamp(stamp)
                    break
    except (sqlite3.Error, OSError, ValueError):
        pass
    return success


def sources(settings, config, *, now=None):
    now = time.time() if now is None else now
    success = _profile_success(settings)
    result = []
    optional = set(AMANE_STAGE) - {source for chain in ROUTES.values() for source in chain}
    for key in dict.fromkeys([*success, *SOURCES]):
        if key == "instagram" or key in MAKER_SOURCES:
            continue
        until, _ = cooldown_state(config.directory("secrets"), key)
        cooling = now < until < now + 366 * 86400
        checks = source_checks(config.directory("secrets"), key)
        if key in optional and not cooling and not checks:
            continue
        parsed = checks.get("metadata", {})
        connection = checks.get("connection", {})
        candidate = timestamp(parsed.get("last_success_at"))
        if candidate and (not success.get(key) or candidate > success[key]):
            success[key] = candidate
        stamp = success.get(key)
        fresh = bool(stamp) and 0 <= now - datetime.fromisoformat(stamp).timestamp() <= 86400
        last = max((check for check in (parsed, connection) if timestamp(check.get("checked_at"))),
                   key=lambda check: check["checked_at"], default={})
        recent = 0 <= now - float(last.get("checked_at", 0)) <= 86400
        reason_key = last.get("reason", "") if recent else ""
        failed = recent and not last.get("ok") and reason_key != "not_found"
        status, reason = _source_health(cooling, failed, fresh, recent, connection.get("ok"), reason_key,
                                        has_success=bool(stamp), has_check=bool(last))
        result.append({"source": key, "label": SOURCES[key]["label"],
                       "status": status,
                       "reason": _text(reason), "reason_code": reason, "last_check_at": timestamp(last.get("checked_at")),
                       "elapsed_s": last.get("elapsed_s"), "last_success_at": stamp,
                       "cooldown_until": datetime.fromtimestamp(until, timezone.utc).isoformat() if cooling else None})
    return result
