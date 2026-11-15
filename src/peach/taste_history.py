from __future__ import annotations

import csv
import hashlib
import json
import re
import socket
import sqlite3
import tempfile
import zipfile
import math
import os
import sys
import time
from collections import Counter, defaultdict
from contextlib import closing, contextmanager
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta, timezone
from html.parser import HTMLParser
import itertools
from itertools import chain
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from browserexport.parse import read_visits as read_browser_visits
from browserexport.browsers.chrome import Chrome
from browserexport.browsers.firefox import Firefox
from browserexport.browsers.safari import Safari
from browserexport.browsers.common import Schema
from browserexport.common import BrowserexportError
import ahocorasick

from . import interface_text
from .catalog_rules import LENGTH_TAGS, TECH_TAGS
from .catalog_vocabulary import PORTRAIT
from .review_csv import read_rows, write_rows
from .taste_sites import ADULT_DOMAINS, MIXED_DOMAINS, account_key, identity_context, mixed_adult, parse_url
from .taste_words import (CATEGORY_TERMS, STOPWORDS, SUBTITLE_AND_RESTORE_TAGS, TASTE_CATEGORY_TAGS,
                          TITLE_AMBIGUOUS_TERMS)
from .user_messages import UserTimeoutError, UserValueError, message_fields


@dataclass(frozen=True)
class HistorySource:
    browser: str
    profile: str
    path: Path
    root: Path | None = None
    engine: str | None = None


@dataclass(frozen=True)
class HistoryVisit:
    visit_key: str
    visited_at: str
    url: str
    title: str


QUERY_KEYS = {"q", "query", "search", "keyword", "keywords", "tag", "tags", "term"}
NEGATIVE_QUERY_TERM = re.compile(
    r"(?<![a-z0-9\u3400-\u9fff])-[a-z0-9\u3400-\u9fff]+(?:[_-][a-z0-9\u3400-\u9fff]+)*"
)
CREATOR_MARKERS = {"artist", "artists", "author", "channel", "creator", "creators", "model", "models", "profile"}
CREATOR_HOSTS = {"fansly.com", "onlyfans.com", "patreon.com", "rule34video.com"}
RESERVED_HANDLES = {
    "about", "account", "creator", "creators", "explore", "home", "login", "messages", "model",
    "models", "notifications", "post", "posts", "search", "settings", "share", "user", "users",
}
TASTE_DOMAIN_SUFFIXES = {
    "cangku.moe", "coomer.st", "e-hentai.org", "exhentai.org", "f95zone.to", "fanbox.cc",
    "fansly.com", "fantia.jp", "gelbooru.com", "hanime1.me", "jable.tv", "javbus.com",
    "javdb.com", "kemono.cr", "kemono.su", "missav.com", "nhentai.net", "onlyfans.com",
    "patreon.com", "pawchive.com", "pixiv.net", "pornhub.com", "redgifs.com", "rule34.xxx",
    "rule34video.com", "simpcity.cr", "simpcity.su", "south-plus.org", "spankbang.com",
    "supjav.com", "xhamster.com", "xsijishe.com", "xvideos.com",
}
TASTE_DOMAIN_SUFFIXES = (TASTE_DOMAIN_SUFFIXES | ADULT_DOMAINS) - MIXED_DOMAINS
QUERY_KEYS |= {"searchstr", "search_word", "search_query", "k", "word", "text"}
NON_TASTE_SUMMARY_TAGS = TECH_TAGS | LENGTH_TAGS | SUBTITLE_AND_RESTORE_TAGS
TAKEOUT_HISTORY_MEMBER = "Takeout/Chrome/History.json"
TAKEOUT_ACTIVITY_MEMBERS = (
    ("chrome", "Google My Activity - Chrome", "Takeout/My Activity/Chrome/MyActivity.html"),
    ("google_activity", "Google My Activity - Search", "Takeout/My Activity/Search/MyActivity.html"),
    ("google_activity", "Google My Activity - Image Search", "Takeout/My Activity/Image Search/MyActivity.html"),
    ("google_activity", "Google My Activity - Video Search", "Takeout/My Activity/Video Search/MyActivity.html"),
)
TAKEOUT_ACTIVITY_ACTIONS = {"Visited", "Searched for", "Viewed", "Watched"}
TAKEOUT_DATE_RE = re.compile(
    r"^(?P<date>[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2}\s+[AP]M) (?P<zone>HKT|UTC|GMT)$"
)
HONG_KONG_TIMEZONE = timezone(timedelta(hours=8), name="HKT")

#: 口味证据的来源：看板榜单与发现页推荐理由里的名字在 `taste.evidence.<id>`。
EVIDENCE_SOURCES = ("watched", "collection", "browsing", "bookmarks", "follows", "peach")


def taste_text(code: str, params: dict | None = None, language: str = interface_text.SOURCE_LANGUAGE) -> str:
    """渲染一句口味文字（ADR-0159）。参数可以是字符串与数字、列表（按 `labels.listSeparator` 连起来），
    或 `taste_phrase` 给的一段（显示名，按它自己的 code 渲染）。"""
    values = {name: _phrase_value(value, language) for name, value in (params or {}).items()}
    return interface_text.text(f"server:{code}", values, language)


def _phrase_value(value, language: str):
    if isinstance(value, dict) and "code" in value:
        return interface_text.label(f"server:{value['code']}", str(value.get("text") or ""),
                                    {name: _phrase_value(item, language) for name, item in (value.get("params") or {}).items()},
                                    language)
    if isinstance(value, (list, tuple)):
        separator = interface_text.text("server:labels.listSeparator", None, language)
        return separator.join(str(_phrase_value(item, language)) for item in value)
    return value


def taste_phrase(code: str, params: dict | None = None, *, fallback: str = "") -> dict:
    """一段要译的文字，放进别的句子的参数或列表里：`code`、`params`，以及按 zh-CN 渲染好的 `text`。
    前端按 code 取当前语言的译文，没有译文时用 `text`；资源里没有这条 code 时 `text` 是 `fallback`。"""
    params = dict(params or {})
    phrase = {"code": code, "params": params, "text": fallback}
    phrase["text"] = _phrase_value(phrase, interface_text.SOURCE_LANGUAGE)
    return phrase


def phrase_fields(name: str, *, code: str, params: dict | None = None) -> dict:
    """结果里的一个显示字段：`<name>` 是按 zh-CN 渲染好的原文（给还不认 code 的前端兜底），
    旁边是 `<name>_code` 与 `<name>_params`。"""
    params = dict(params or {})
    return {name: taste_text(code, params), f"{name}_code": code, f"{name}_params": params}


def evidence_fields(sources) -> dict:
    """榜单一行的证据来源：`evidence` 是显示名，`evidence_codes` 是并行的 code。"""
    codes = [f"taste.evidence.{source}" for source in sources]
    return {"evidence": [taste_text(code) for code in codes], "evidence_codes": codes}


def category_phrase(category: str) -> dict:
    """一个口味维度的显示名。"""
    return taste_phrase(f"taste.category.{category}")


def failure_row(code: str) -> dict:
    """读取结果里一个来源没读成的原因：`error` 是按 zh-CN 渲染好的原句，配 `error_code` 与 `error_params`。
    结果会写进分析清单，旧清单里只有 `error` 原文。"""
    return {"error": taste_text(code), "error_code": code, "error_params": {}}


def discover_history_sources(
    *,
    home: Path | None = None,
    appdata: Path | None = None,
    localappdata: Path | None = None,
    platform_name: str | None = None,
    include_bookmarks: bool = False,
) -> list[HistorySource]:
    from .taste_browsers import _paths

    platform_name = platform_name or {"win32": "windows", "darwin": "macos"}.get(sys.platform, "linux")
    use_environment = home is None
    home = home or Path.home()
    candidates: list[tuple[str, Path]] = []
    if platform_name == "windows":
        appdata = appdata or (Path(os.environ.get("APPDATA") or home / "AppData" / "Roaming")
                              if use_environment else home / "AppData" / "Roaming")
        localappdata = localappdata or (Path(os.environ.get("LOCALAPPDATA") or home / "AppData" / "Local")
                                       if use_environment else home / "AppData" / "Local")
        candidates.extend(
            [
                ("firefox", appdata / "Mozilla" / "Firefox" / "Profiles"),
                ("zen", appdata / "zen" / "Profiles"),
                ("chrome", localappdata / "Google" / "Chrome" / "User Data"),
                ("aside", localappdata / "Aside" / "User Data"),
                ("edge", localappdata / "Microsoft" / "Edge" / "User Data"),
                ("brave", localappdata / "BraveSoftware" / "Brave-Browser" / "User Data"),
                ("vivaldi", localappdata / "Vivaldi" / "User Data"),
                ("opera", appdata / "Opera Software" / "Opera Stable"),
                ("opera_gx", appdata / "Opera Software" / "Opera GX Stable"),
                ("115", localappdata / "115Chrome" / "User Data"),
                ("qq", localappdata / "Tencent" / "QQBrowser" / "User Data"),
                ("360chrome", localappdata / "360chrome" / "Chrome" / "User Data"),
                ("360chromex", localappdata / "360ChromeX" / "Chrome" / "User Data"),
                ("360se", appdata / "360se6" / "User Data"),
                ("360se", localappdata / "360se6" / "User Data"),
                ("360se", localappdata / "secoresdk" / "360se6" / "User Data"),
                ("sogou", localappdata / "Sogou" / "SogouExplorer" / "User Data"),
                ("2345", localappdata / "2345Explorer" / "User Data"),
                ("maxthon", localappdata / "Maxthon" / "Application" / "User Data"),
                ("maxthon", localappdata / "Maxthon" / "User Data"),
                ("chromium", localappdata / "Chromium" / "User Data"),
            ]
        )
    elif platform_name == "macos":
        candidates.extend(
            [
                ("firefox", home / "Library" / "Application Support" / "Firefox" / "Profiles"),
                ("zen", home / "Library" / "Application Support" / "zen" / "Profiles"),
                ("chrome", home / "Library" / "Application Support" / "Google" / "Chrome"),
                ("aside", home / "Library" / "Application Support" / "Aside"),
                ("edge", home / "Library" / "Application Support" / "Microsoft Edge"),
                ("brave", home / "Library" / "Application Support" / "BraveSoftware" / "Brave-Browser"),
                ("vivaldi", home / "Library" / "Application Support" / "Vivaldi"),
                ("opera", home / "Library" / "Application Support" / "com.operasoftware.Opera"),
                ("opera_gx", home / "Library" / "Application Support" / "com.operasoftware.OperaGX"),
            ]
        )
    elif platform_name == "linux":
        config = (Path(os.environ.get("XDG_CONFIG_HOME") or home / ".config")
                  if use_environment else home / ".config")
        candidates.extend([
            ("firefox", home / ".mozilla/firefox"),
            ("firefox", home / ".var/app/org.mozilla.firefox/.mozilla/firefox"),
            ("firefox", home / "snap/firefox/common/.mozilla/firefox"),
            ("chrome", config / "google-chrome"),
            ("chrome", home / ".var/app/com.google.Chrome/config/google-chrome"),
            ("chromium", config / "chromium"),
            ("edge", config / "microsoft-edge"),
            ("brave", config / "BraveSoftware/Brave-Browser"),
            ("vivaldi", config / "vivaldi"),
            ("opera", config / "opera"),
        ])

    found: list[HistorySource] = []
    for browser, root in candidates:
        if not root.is_dir():
            continue
        paths = _paths(root, browsing_only=True)
        if include_bookmarks:
            paths = sorted(set(paths + _paths(root, bookmarks=True)))
        for path in paths:
            if path.is_file():
                found.append(HistorySource(browser, path.parent.name, path, root,
                                           "firefox" if browser in {"firefox", "zen"} else "chrome"))
    if platform_name == "macos":
        safari = home / "Library" / "Safari" / "History.db"
        if safari.is_file():
            found.append(HistorySource("safari", "iCloud", safari))
    return sorted(found, key=lambda source: (source.browser, source.profile.casefold()))


def _readonly_uri(path: Path) -> str:
    return f"{path.resolve().as_uri()}?mode=ro"


def _consistent_copy(source: Path, destination: Path) -> None:
    with closing(sqlite3.connect(_readonly_uri(source), uri=True)) as source_db:
        source_db.execute("PRAGMA schema_version").fetchone()
        started = time.monotonic()
        def progress(_status, _remaining, _total):
            if time.monotonic() - started > 20:
                raise UserTimeoutError("errors.tasteHistory.snapshotTimeout")
        with closing(sqlite3.connect(destination)) as destination_db:
            source_db.backup(destination_db, pages=256, progress=progress)


def _iso_from_unix_microseconds(value: int | float) -> str:
    return datetime.fromtimestamp(float(value) / 1_000_000, UTC).isoformat()


def _read_visits(snapshot: Path, _browser: str | None = None, *, progress=None) -> list[HistoryVisit]:
    """Use browserexport's maintained schema adapters and keep Peach's private DTO.

    The source database is already a consistent SQLite backup when this is called for a
    running browser.  Exported JSON/JSONL and compressed files can be passed directly.
    """
    occurrences: Counter[tuple[str, str]] = Counter()
    visits: list[HistoryVisit] = []

    def consume(source, browser: str | None = None) -> None:
        known = {"chrome": Chrome, "firefox": Firefox, "zen": Firefox, "safari": Safari}
        if isinstance(source, sqlite3.Connection):
            from .taste_browsers import history_engine
            try:
                browser = history_engine(source)
            except ValueError:
                # 其它格式仍交给 browserexport 自带的格式探测器。
                iterator = read_browser_visits(source)
                return consume_visits(iterator)
            adapter = known[browser]
            # 保留 browserexport 的时间与 DTO 转换，仅补可选元数据列。
            optional = ({"V.visit_duration": ("visits", "visit_duration", "0")}
                        if browser == "chrome" else {
                            "P.description": ("moz_places", "description", "NULL"),
                            "P.preview_image_url": ("moz_places", "preview_image_url", "NULL"),
                        } if browser == "firefox" else {})
            columns = list(adapter.schema.cols)
            for expression, (table, column, fallback) in optional.items():
                available = {row[1] for row in source.execute(f'PRAGMA table_info("{table}")')}
                replacement = (f"COALESCE({expression}, {fallback})" if column in available
                               else fallback)
                columns = [f"{replacement} AS {column}" if item == expression else item
                           for item in columns]
            adapted = type("HistoryAdapter", (adapter,), {
                "schema": Schema(cols=columns, where=adapter.schema.where, order_by=adapter.schema.order_by),
            })
            iterator = adapted.extract_visits(source)
        else:
            iterator = read_browser_visits(source)
        consume_visits(iterator)

    def consume_visits(iterator) -> None:
        for visit in iterator:
            visited = visit.dt
            if visited.tzinfo is None:
                visited = visited.replace(tzinfo=UTC)
            visited_at = visited.astimezone(UTC).isoformat()
            url = str(visit.url)
            fingerprint = (url, visited_at)
            occurrences[fingerprint] += 1
            ordinal = occurrences[fingerprint]
            visit_key = hashlib.sha256(
                f"{visited_at}\0{url}\0{ordinal}".encode("utf-8")
            ).hexdigest()
            title = ""
            if visit.metadata is not None:
                title = str(visit.metadata.title or "")
            visits.append(HistoryVisit(visit_key, visited_at, url, title))
            if progress and len(visits) % 1000 == 0:
                progress(len(visits))

    try:
        with snapshot.open("rb") as handle:
            is_sqlite = handle.read(16) == b"SQLite format 3\x00"
    except OSError:
        is_sqlite = False
    if is_sqlite:
        # browserexport 0.4.4 accepts an owned connection.  Passing a path uses a
        # context manager that commits but does not close sqlite3.Connection on Windows.
        with closing(sqlite3.connect(_readonly_uri(snapshot), uri=True)) as connection:
            consume(connection, _browser)
    else:
        consume(snapshot)
    return visits


def _source_key(source: HistorySource, host: str) -> str:
    identity = f"{host}\0{source.browser}\0{source.profile}\0{source.path.resolve()}"
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def _prepare_store(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS history_source (
            source_key TEXT PRIMARY KEY,
            browser TEXT NOT NULL,
            profile TEXT NOT NULL,
            host TEXT NOT NULL,
            path_hash TEXT NOT NULL,
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS history_visit (
            source_key TEXT NOT NULL REFERENCES history_source(source_key),
            visit_key TEXT NOT NULL,
            visited_at TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            PRIMARY KEY (source_key, visit_key)
        );
        CREATE INDEX IF NOT EXISTS history_visit_time_idx ON history_visit(visited_at);
        CREATE TABLE IF NOT EXISTS history_bookmark (
            source_key TEXT NOT NULL REFERENCES history_source(source_key),
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            added_at TEXT NOT NULL,
            PRIMARY KEY (source_key, url)
        );
        CREATE TABLE IF NOT EXISTS browser_snapshot (
            source_key TEXT PRIMARY KEY,
            browser_id TEXT NOT NULL
        );
        """
    )


@contextmanager
def _open_history_store(store_path: Path, host: str | None):
    """打开私有历史库，并备好三个入口都要的东西：主机名、目录、时间戳。

    这段前导此前在 refresh_history、refresh_takeout_history 和导入入口里各写了一份。
    它们共享的不只是形状：`_prepare_store` 漏掉一次，写入就会撞上不存在的表；而
    `host` 参与 source_key，三处算法必须一致，否则同一台机器的历史会被记成两个来源。

    浏览历史只进这个私有库，不进 ledger——单独一个入口也让这条边界只需要守一处。
    """
    resolved = host or socket.gethostname()
    store_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(store_path)) as store:
        _prepare_store(store)
        yield store, resolved, datetime.now(UTC).isoformat()


def refresh_history(
    sources: list[HistorySource],
    store_path: Path,
    *,
    host: str | None = None,
    progress=None,
) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    with _open_history_store(store_path, host) as (store, host, now):
        for index, source in enumerate(sources):
            def report(count=0, index=index):
                if progress:
                    progress(stage="reading", checked=count, total=None, **message_fields(
                        "jobMessage.tasteHistory.readingProfile",
                        {"index": index + 1, "total": len(sources), "count": f"{count:,}"}))
            try:
                with tempfile.TemporaryDirectory(prefix="peach-history-") as temp_dir:
                    snapshot = Path(temp_dir) / "history.sqlite"
                    if progress:
                        progress(stage="snapshot", checked=0, total=None, **message_fields(
                            "jobMessage.tasteHistory.preparingSnapshot", {"index": index + 1, "total": len(sources)}))
                    _consistent_copy(source.path, snapshot)
                    report()
                    visits = _read_visits(snapshot, source.engine or source.browser, progress=report)
                    report(len(visits))
            except (sqlite3.DatabaseError, OSError, ValueError, TypeError, OverflowError, BrowserexportError) as error:
                reason = ("errors.tasteHistory.historyInUse" if "locked" in str(error).casefold()
                          else "errors.tasteHistory.historyNotRead")
                results.append({"browser": source.browser, "profile": source.profile, "visits": 0,
                                "added": 0, "status": "failed", **failure_row(reason)})
                continue
            source_key = _source_key(source, host)
            from .taste_browsers import browser_snapshot_allowed
            if not browser_snapshot_allowed(store, source):
                continue
            path_hash = hashlib.sha256(str(source.path.resolve()).encode("utf-8")).hexdigest()
            store.execute(
                "INSERT INTO history_source VALUES (?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(source_key) DO UPDATE SET last_seen_at=excluded.last_seen_at",
                (source_key, source.browser, source.profile, host, path_hash, now, now),
            )
            from .taste_browsers import bind_browser_snapshot
            bind_browser_snapshot(store, source_key, source)
            before = store.total_changes
            store.executemany(
                "INSERT OR IGNORE INTO history_visit(source_key, visit_key, visited_at, url, title) "
                "VALUES (?, ?, ?, ?, ?)",
                ((source_key, visit.visit_key, visit.visited_at, visit.url, visit.title) for visit in visits),
            )
            added = store.total_changes - before
            store.commit()
            results.append(
                {"browser": source.browser, "profile": source.profile, "visits": len(visits), "added": added}
            )
    return results


def _normalize_takeout_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.hostname in {"google.com", "www.google.com"} and parsed.path == "/url":
        query = parse_qs(parsed.query)
        for key in ("q", "url"):
            if query.get(key):
                return query[key][0]
    return value


def _parse_takeout_date(value: str) -> datetime:
    match = TAKEOUT_DATE_RE.fullmatch(value.replace("\u202f", " "))
    if not match:
        raise ValueError(f"unrecognized Google My Activity timestamp: {value!r}")
    naive = datetime.strptime(match.group("date"), "%b %d, %Y, %I:%M:%S %p")
    source_timezone = HONG_KONG_TIMEZONE if match.group("zone") == "HKT" else UTC
    return naive.replace(tzinfo=source_timezone).astimezone(UTC)


class _TakeoutActivityParser(HTMLParser):
    def __init__(self, *, visit_prefix: str) -> None:
        super().__init__()
        self.visit_prefix = visit_prefix
        self.depth = 0
        self.card_number = 0
        self.pending_visit = False
        self.in_target = False
        self.href: str | None = None
        self.title_parts: list[str] = []
        self.date_text: str | None = None
        self.visits: list[HistoryVisit] = []
        self.errors = 0
        self.matched_action = False
        self.skipped = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "div" and self.depth == 0 and "outer-cell" in (values.get("class") or "").split():
            self.depth = 1
            self.pending_visit = False
            self.in_target = False
            self.href = None
            self.title_parts = []
            self.date_text = None
            self.matched_action = False
            return
        if not self.depth:
            return
        if tag == "div":
            self.depth += 1
        elif tag == "a" and self.pending_visit and self.href is None:
            self.in_target = True
            self.href = values.get("href")

    def handle_endtag(self, tag: str) -> None:
        if self.depth and tag == "a" and self.in_target:
            self.in_target = False
            self.pending_visit = False
        if not self.depth or tag != "div":
            return
        self.depth -= 1
        if self.depth:
            return
        self.card_number += 1
        if self.href is None or self.date_text is None:
            if self.matched_action:
                self.skipped += 1
            return
        try:
            visited = _parse_takeout_date(self.date_text)
        except ValueError:
            self.errors += 1
            return
        url = _normalize_takeout_url(self.href)
        if urlparse(url).scheme not in {"http", "https"}:
            self.errors += 1
            return
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
        self.visits.append(
            HistoryVisit(
                f"{self.visit_prefix}:{self.card_number}:{int(visited.timestamp())}:{digest}",
                visited.isoformat(),
                url,
                " ".join(self.title_parts).strip(),
            )
        )

    def handle_data(self, data: str) -> None:
        if not self.depth:
            return
        value = data.strip()
        if value in TAKEOUT_ACTIVITY_ACTIONS:
            self.matched_action = True
            self.pending_visit = True
        elif self.in_target and value:
            self.title_parts.append(value)
        elif value.endswith((" HKT", " UTC", " GMT")) and len(value) >= 20:
            self.date_text = value


def _read_takeout_archive(path: Path) -> list[tuple[str, str, list[HistoryVisit], int]]:
    with zipfile.ZipFile(path) as archive:
        members = set(archive.namelist())
        if TAKEOUT_HISTORY_MEMBER not in members and not any(
            member in members for _browser, _profile, member in TAKEOUT_ACTIVITY_MEMBERS
        ):
            raise UserValueError("errors.tasteHistory.takeoutNoActivity")
        history_visits: list[HistoryVisit] = []
        if TAKEOUT_HISTORY_MEMBER in members:
            history_payload = json.loads(archive.read(TAKEOUT_HISTORY_MEMBER))
            history_rows = history_payload.get("Browser History")
            if not isinstance(history_rows, list):
                raise UserValueError("errors.tasteHistory.takeoutHistoryListMissing")
            for index, row in enumerate(history_rows, 1):
                if not isinstance(row, dict) or not row.get("url") or row.get("time_usec") is None:
                    raise UserValueError("errors.tasteHistory.takeoutHistoryRowInvalid")
                url = str(row["url"])
                time_usec = int(row["time_usec"])
                digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
                history_visits.append(
                    HistoryVisit(
                        f"history:{index}:{time_usec}:{digest}",
                        _iso_from_unix_microseconds(time_usec),
                        url,
                        str(row.get("title") or ""),
                    )
                )
        sources: list[tuple[str, str, list[HistoryVisit], int]] = []
        if history_visits:
            sources.append(("chrome", "Takeout Browser History", history_visits, 0))
        for browser, profile, member in TAKEOUT_ACTIVITY_MEMBERS:
            if member not in members:
                continue
            activity = _TakeoutActivityParser(visit_prefix=hashlib.sha256(member.encode()).hexdigest()[:10])
            activity.feed(archive.read(member).decode("utf-8"))
            activity.close()
            if activity.errors:
                raise UserValueError("errors.tasteHistory.takeoutActivityUnparsed",
                                     {"profile": profile, "count": activity.errors})
            sources.append((browser, profile, activity.visits, activity.skipped))
    return sources


def _event_fingerprint(url: str, visited_at: str) -> tuple[str, int]:
    return url, int(datetime.fromisoformat(visited_at).timestamp())


def refresh_takeout_history(
    archives: list[Path],
    store_path: Path,
    *,
    host: str | None = None,
) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    with _open_history_store(store_path, host) as (store, host, now):
        existing = Counter(
            _event_fingerprint(url, visited_at)
            for visited_at, url in store.execute(
                "SELECT v.visited_at, v.url FROM history_visit v "
                "JOIN history_source s ON s.source_key = v.source_key"
            )
        )
        for archive_path in archives:
            for browser, profile, visits, skipped in _read_takeout_archive(archive_path):
                source = HistorySource(browser, profile, archive_path)
                source_key = _source_key(source, host)
                path_hash = hashlib.sha256(str(archive_path.resolve()).encode("utf-8")).hexdigest()
                store.execute(
                    "INSERT INTO history_source VALUES (?, ?, ?, ?, ?, ?, ?) "
                    "ON CONFLICT(source_key) DO UPDATE SET last_seen_at=excluded.last_seen_at",
                    (source_key, source.browser, source.profile, host, path_hash, now, now),
                )
                source_seen: Counter[tuple[str, int]] = Counter()
                additions: list[HistoryVisit] = []
                for visit in visits:
                    fingerprint = _event_fingerprint(visit.url, visit.visited_at)
                    source_seen[fingerprint] += 1
                    if source_seen[fingerprint] > existing[fingerprint]:
                        additions.append(visit)
                before = store.total_changes
                store.executemany(
                    "INSERT OR IGNORE INTO history_visit(source_key, visit_key, visited_at, url, title) "
                    "VALUES (?, ?, ?, ?, ?)",
                    ((source_key, visit.visit_key, visit.visited_at, visit.url, visit.title) for visit in additions),
                )
                added = store.total_changes - before
                for fingerprint, count in source_seen.items():
                    existing[fingerprint] = max(existing[fingerprint], count)
                results.append(
                    {
                        "browser": browser,
                        "profile": profile,
                        "visits": len(visits),
                        "added": added,
                        "skipped": skipped,
                    }
                )
        store.commit()
    return results


def refresh_export_history(
    exports: list[Path],
    store_path: Path,
    *,
    host: str | None = None,
) -> list[dict[str, object]]:
    """Import browserexport SQLite/JSON/JSONL (including compressed variants).

    Raw exports stay in the private sources directory.  Only normalized visits enter the
    private history store; no URL or title is copied to the Peach ledger.
    """
    results: list[dict[str, object]] = []
    with _open_history_store(store_path, host) as (store, host, now):
        for export_path in exports:
            visits = _read_visits(export_path)
            source = HistorySource("browserexport", export_path.name, export_path)
            source_key = _source_key(source, host)
            path_hash = hashlib.sha256(str(export_path.resolve()).encode("utf-8")).hexdigest()
            store.execute(
                "INSERT INTO history_source VALUES (?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(source_key) DO UPDATE SET last_seen_at=excluded.last_seen_at",
                (source_key, source.browser, source.profile, host, path_hash, now, now),
            )
            before = store.total_changes
            store.executemany(
                "INSERT OR IGNORE INTO history_visit(source_key, visit_key, visited_at, url, title) "
                "VALUES (?, ?, ?, ?, ?)",
                ((source_key, visit.visit_key, visit.visited_at, visit.url, visit.title)
                 for visit in visits),
            )
            results.append({
                "browser": source.browser,
                "profile": source.profile,
                "visits": len(visits),
                "added": store.total_changes - before,
                "skipped": 0,
            })
        store.commit()
    return results


def import_history_exports(
    exports: list[Path],
    store_path: Path,
    *,
    host: str | None = None,
) -> list[dict[str, object]]:
    """Route Google Takeout archives and browserexport-compatible files."""
    results: list[dict[str, object]] = []
    from .taste_bookmarks import is_bookmark_export, refresh_bookmarks
    for export_path in exports:
        if is_bookmark_export(export_path):
            results.extend(refresh_bookmarks(
                [HistorySource("bookmarks", export_path.name, export_path)], store_path, host=host, strict=True))
            continue
        is_takeout = False
        if zipfile.is_zipfile(export_path):
            with zipfile.ZipFile(export_path) as archive:
                members = set(archive.namelist())
                is_takeout = TAKEOUT_HISTORY_MEMBER in members or any(
                    member in members for _browser, _profile, member in TAKEOUT_ACTIVITY_MEMBERS
                )
        if is_takeout:
            results.extend(refresh_takeout_history([export_path], store_path, host=host))
        else:
            results.extend(refresh_export_history([export_path], store_path, host=host))
    return results


def remove_history_source(store_path: Path, source_key: str) -> int:
    """Remove one normalized source while retaining the immutable raw export."""
    if not store_path.is_file():
        return 0
    with closing(sqlite3.connect(store_path)) as store:
        _prepare_store(store)
        row = store.execute(
            "SELECT count(*) FROM history_visit WHERE source_key=?", (source_key,),
        ).fetchone()
        removed = int(row[0]) if row else 0
        removed += store.execute("SELECT count(*) FROM history_bookmark WHERE source_key=?", (source_key,)).fetchone()[0]
        store.execute("DELETE FROM history_bookmark WHERE source_key=?", (source_key,))
        store.execute("DELETE FROM history_visit WHERE source_key=?", (source_key,))
        store.execute("DELETE FROM browser_snapshot WHERE source_key=?", (source_key,))
        store.execute("DELETE FROM history_source WHERE source_key=?", (source_key,))
        store.commit()
    return removed


def history_source_count(store_path: Path) -> int:
    """导入过几份浏览器历史。与 `_history_dashboard_evidence` 的 `sources` 同一张表、
    同一个数：安装教程只要这个读数，不必把整份口味分析算一遍。"""
    if not store_path.is_file():
        return 0
    try:
        with closing(sqlite3.connect(_readonly_uri(store_path), uri=True)) as store:
            return int(store.execute("SELECT count(*) FROM history_source").fetchone()[0])
    except sqlite3.DatabaseError:
        return 0


@dataclass(frozen=True)
class _TasteVisit:
    """一次落在口味站上的访问，只留汇总要用的那几样，时间窗筛选靠 `visited_at`。"""

    visited_at: str
    domain: str
    day: str
    hour: tuple[int, int]
    tags: tuple[str, ...]
    creators: tuple[str, ...]
    categories: tuple[str, ...]
    bookmark: bool = False


@dataclass(frozen=True)
class _HistoryRows:
    """历史库解析一遍后的结果。`visited` 是去重后全部访问的时间，按查询顺序。"""

    sources: tuple[dict, ...]
    visited: tuple[str, ...]
    taste: tuple[_TasteVisit, ...]
    identity_visits: tuple[tuple[str, str, str], ...] = ()
    bookmarks: tuple[tuple[str, str, str], ...] = ()
    #: 读出这些行时历史库的版本（`store_version`）。按行派生的缓存拿它作键，
    #: 不另读一次：另读的那次可能已经是下一次写入之后的版本。
    version: tuple = ()


#: 按历史库文件的版本缓存解析结果。历史库只在导入与刷新时变，逐条解析网址要十几秒；
#: 账本写入与它无关，不该连带重算。键里带 `-wal` 的版本：WAL 模式下写入先落在那里。
_HISTORY_ROWS: dict[tuple, _HistoryRows] = {}
_PREFERENCE_VISITS: dict[tuple, tuple[tuple[str, str, str], ...]] = {}
#: 读的途中历史库被写过的那几次读，各领一个序号作版本，见 `_history_rows`。
_UNSETTLED_READS = itertools.count()


def store_version(store_path: Path) -> tuple:
    version = [str(store_path)]
    for path in (store_path, store_path.with_name(store_path.name + "-wal")):
        try:
            stat = path.stat()
        except OSError:
            version.append(None)
        else:
            version.append(None if path.name.endswith("-wal") and stat.st_size <= 32 else (stat.st_mtime_ns, stat.st_size))
    return tuple(version)


def preference_history_visits(store_path: Path) -> tuple[tuple[str, str, str], ...]:
    """推荐按日使用身份浏览证据，缓存随历史库与 WAL 版本失效。"""
    version = store_version(store_path)
    cached = _PREFERENCE_VISITS.get(version)
    if cached is not None:
        return cached
    visits = dict.fromkeys(_HISTORY_ROWS[version].identity_visits) if version in _HISTORY_ROWS else {}
    if version not in _HISTORY_ROWS:
        try:
            with closing(sqlite3.connect(_readonly_uri(store_path), uri=True)) as store:
                seen = set()
                for visited_at, url, title in store.execute(
                        "SELECT v.visited_at,v.url,v.title FROM history_visit v "
                        "JOIN history_source s ON s.source_key=v.source_key"):
                    try:
                        fingerprint = (url, int(datetime.fromisoformat(visited_at).timestamp()))
                    except ValueError:
                        continue
                    if fingerprint in seen:
                        continue
                    seen.add(fingerprint)
                    visits.setdefault((visited_at[:10], url, title or ''), None)
        except sqlite3.DatabaseError:
            return ()
    daily = dict.fromkeys((day[:10], url, title) for day, url, title in visits)
    result = []
    for day, url, title in daily:
        try:
            parsed = urlparse(url)
            if parsed.scheme in {'http', 'https'} and parsed.hostname:
                result.append((day, url, title))
        except ValueError:
            continue
    _PREFERENCE_VISITS.clear()
    _PREFERENCE_VISITS[version] = tuple(result)
    return _PREFERENCE_VISITS[version]


def _taste_visit(visited_at, url, title, moment, bookmark):
    """解析一条浏览器信号的域名、题材和本地时间维度。"""
    domain, row_tags, row_creators = _url_candidates(url, title)
    if not domain or not (_is_taste_domain(domain) or mixed_adult(url, title)):
        return domain, None
    if moment is not None:
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=UTC)
        moment = moment.astimezone(HONG_KONG_TIMEZONE)
    categories = set()
    for tag in row_tags:
        compact = tag.replace(" ", "").replace("_", "")
        categories.update(category for category, terms in CATEGORY_TERMS.items()
                          if compact in terms or tag in terms or tag in TASTE_CATEGORY_TAGS.get(category, ()))
    return domain, _TasteVisit(
        visited_at, domain, moment.date().isoformat() if moment else "", (moment.weekday(), moment.hour) if moment else (0, 0),
        tuple(row_tags), tuple(row_creators), tuple(categories), bookmark)


def _read_history_rows(store_path: Path) -> _HistoryRows | None:
    from .taste_bookmarks import bookmark_rows
    with closing(sqlite3.connect(_readonly_uri(store_path), uri=True)) as store:
        store.row_factory = sqlite3.Row
        store.execute("BEGIN")
        try:
            source_rows = tuple(dict(row) for row in store.execute(
                "SELECT s.source_key,s.browser,s.profile,s.host,s.first_seen_at,s.last_seen_at,"
                "count(v.visit_key) visits,min(v.visited_at) range_start,max(v.visited_at) range_end "
                "FROM history_source s LEFT JOIN history_visit v ON v.source_key=s.source_key "
                "GROUP BY s.source_key ORDER BY s.last_seen_at DESC,s.browser,s.profile"
            ))
            bookmarks = bookmark_rows(store)
            counts = Counter(row[0] for row in bookmarks)
            for source in source_rows:
                source["bookmarks"] = counts[source["source_key"]]
            rows = store.execute(
                "SELECT v.visited_at,v.url,v.title FROM history_visit v "
                "JOIN history_source s ON s.source_key=v.source_key"
            )
            seen: set[tuple[str, int | str]] = set()
            visited: list[str] = []
            taste: list[_TasteVisit] = []
            identity_visits: list[tuple[str, str, str]] = []
            # 同一 URL 在不同设备或文件夹的书签只贡献一份证据。
            unique_bookmarks = {}
            for _, added_at, url, title in bookmarks:
                unique_bookmarks.setdefault(url, (added_at, url, title))
            combined = chain(((str(row["visited_at"]), str(row["url"]), str(row["title"] or ""), False) for row in rows),
                             ((*row, True) for row in unique_bookmarks.values()))
            for visited_at, url, title, bookmark in combined:
                if not visited_at and not bookmark:
                    continue
                try:
                    moment = datetime.fromisoformat(visited_at) if visited_at else None
                    fingerprint = (url, "bookmark" if bookmark else int(moment.timestamp()))
                except ValueError:
                    continue
                if fingerprint in seen:
                    continue
                seen.add(fingerprint)
                if not bookmark:
                    visited.append(visited_at)
                domain, candidate = _taste_visit(visited_at, url, title, moment, bookmark)
                if domain and not bookmark:
                    identity_visits.append((visited_at, url, title))
                if candidate:
                    taste.append(candidate)
        except sqlite3.DatabaseError:
            return None
    return _HistoryRows(source_rows, tuple(visited), tuple(taste), tuple(identity_visits), tuple(unique_bookmarks.values()))


def _history_rows(store_path: Path) -> _HistoryRows | None:
    """历史库解析结果，`version` 是读之前取的版本。

    读的途中历史库被写（口味刷新逐个来源提交）的话，读前读后两个版本对不上，这份结果
    不进缓存，版本也换成只属于它自己的一个值，按版本取键的派生缓存不会拿别的行命中它。
    """
    version = store_version(store_path)
    cached = _HISTORY_ROWS.get(version)
    if cached is None:
        cached = _read_history_rows(store_path)
        if cached is None:
            return None
        if store_version(store_path) != version:
            return replace(cached, version=(*version, "unsettled", next(_UNSETTLED_READS)))
        cached = replace(cached, version=version)
        # 只留最新一版：旧版本的键再也不会被问到。
        _HISTORY_ROWS.clear()
        _HISTORY_ROWS[version] = cached
    return cached


def _history_dashboard_evidence(store_path: Path, since: str | None) -> dict[str, object]:
    empty = {
        "visits": 0, "bookmarks": 0, "sources": [], "range_start": None, "range_end": None,
        "tags": Counter(), "creators": Counter(), "categories": Counter(),
        "bookmark_tags": Counter(), "bookmark_creators": Counter(), "bookmark_domains": Counter(),
        "domains": Counter(), "creator_domains": {}, "activity": {"days": [], "hours": []},
    }
    if not store_path.is_file():
        return empty
    history = _history_rows(store_path)
    if history is None:
        return empty
    # 与 SQL 的 `visited_at>=?` 同一个比较：两边都是按字符串比。行序保持查询出来的
    # 顺序，计数相同的几项在 `most_common` 里的先后因此不变。
    visited = [value for value in history.visited if value >= since] if since else history.visited
    taste = [visit for visit in history.taste if visit.visited_at >= since] if since else history.taste
    tags: Counter[str] = Counter()
    creators: Counter[str] = Counter()
    creator_domains: dict[str, Counter[str]] = defaultdict(Counter)
    categories: Counter[str] = Counter()
    domains: Counter[str] = Counter()
    activity_days: Counter[str] = Counter()
    activity_hours: Counter[tuple[int, int]] = Counter()
    bookmark_tags, bookmark_creators, bookmark_domains = Counter(), Counter(), Counter()
    for visit in taste:
        domains[visit.domain] += 1
        if visit.bookmark:
            bookmark_tags.update(visit.tags)
            bookmark_creators.update(visit.creators)
            bookmark_domains[visit.domain] += 1
        if not visit.bookmark:
            activity_days[visit.day] += 1
            activity_hours[visit.hour] += 1
        tags.update(visit.tags)
        creators.update(visit.creators)
        for creator in visit.creators:
            creator_domains[creator.casefold().strip()][visit.domain] += 1
        categories.update(visit.categories)
    return {
        "visits": len(visited),
        "bookmarks": sum(not since or added >= since for added, _, _ in history.bookmarks),
        "sources": [dict(row) for row in history.sources],
        "range_start": min(visited) if visited else None,
        "range_end": max(visited) if visited else None,
        "tags": tags,
        "bookmark_tags": bookmark_tags,
        "bookmark_creators": bookmark_creators,
        "bookmark_domains": bookmark_domains,
        "creators": creators,
        "creator_domains": creator_domains,
        "categories": categories,
        "domains": domains,
        "activity": {
            "timezone": "UTC+08:00",
            "days": [{"date": day, "count": count} for day, count in sorted(activity_days.items())],
            "hours": [{"weekday": day, "hour": hour, "count": count}
                      for (day, hour), count in sorted(activity_hours.items())],
        },
    }


def _epoch(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
        except ValueError:
            return None


def _solo_representatives(linked: list[tuple[int, int, str, str]]) -> dict[str, int]:
    """女优的代表作只取她单独出演的片：多人作品的封面裁脸，每个出演者都会拿到同一张脸。"""
    performers: dict[int, set[int]] = defaultdict(set)
    for aid, entity_id, kind, _ in linked:
        if kind == "performer":
            performers[aid].add(entity_id)
    chosen: dict[str, int] = {}
    for aid, _, kind, normalized in linked:
        if kind == "performer" and len(performers[aid]) == 1:
            chosen.setdefault(normalized, aid)
    return chosen


def _positive_behavior_score(row: dict, *, exclude_disliked: bool) -> float:
    """按观看与明确反馈计算正向证据，不从不合口味推导负向标签。"""
    if exclude_disliked and row.get("feedback") == "dislike":
        return 0.0
    seconds = max(float(row.get("play_seconds") or 0), 0)
    plays = max(int(row.get("play_count") or 0), 0)
    o_count = max(int(row.get("o_count") or 0), 0)
    rating = max(int(row.get("rating") or 0), 0)
    score = (1.0 if plays or seconds else 0.0) + math.log2(1 + seconds / 60)
    score += min(plays, 12) * .75 + min(o_count, 8) * 1.5 + rating / 20
    score += 3.0 if row.get("liked") else 0.0
    score += .5 if row.get("feedback") == "seen" else 0.0
    return max(score, 0.0)


def _peach_dashboard_evidence(connection: sqlite3.Connection, since: str | None, *, exclude_disliked: bool = False) -> dict[str, object]:
    from .entities import male_performer_ids
    excluded = male_performer_ids(connection)
    since_epoch = datetime.fromisoformat(since).timestamp() if since else None
    rows = connection.execute(
        "SELECT a.id,a.creator,a.studio,a.play_count,a.play_seconds,a.o_count,a.rating,"
        "a.feedback,a.last_played,COALESCE(p.liked,0) liked "
        "FROM asset a LEFT JOIN asset_preference p ON p.asset_id=a.id AND p.profile_id='local-default' "
        "WHERE COALESCE(a.play_count,0)>0 OR COALESCE(a.play_seconds,0)>0 "
        "OR COALESCE(a.o_count,0)>0 OR COALESCE(a.rating,0)>0 "
        "OR a.feedback IN ('seen','dislike') OR COALESCE(p.liked,0)>0"
    ).fetchall()
    assets: dict[int, dict[str, object]] = {}
    total_seconds = 0.0
    liked = disliked = 0
    for raw in rows:
        row = dict(raw)
        played_at = _epoch(row.get("last_played"))
        if since_epoch is not None and (played_at is None or played_at < since_epoch):
            continue
        seconds = max(float(row.get("play_seconds") or 0), 0)
        is_liked = bool(row.get("liked"))
        is_disliked = row.get("feedback") == "dislike"
        row["positive"] = _positive_behavior_score(row, exclude_disliked=exclude_disliked)
        assets[int(row["id"])] = row
        total_seconds += seconds
        liked += int(is_liked)
        disliked += int(is_disliked)

    scores: dict[str, Counter[str]] = defaultdict(Counter)
    items: dict[str, dict[str, set[int]]] = defaultdict(lambda: defaultdict(set))
    labels: dict[str, dict[str, str]] = defaultdict(dict)
    entity_kinds: dict[int, set[str]] = defaultdict(set)
    entity_ids: dict[str, dict[str, int]] = defaultdict(dict)
    representatives: dict[str, dict[str, int]] = defaultdict(dict)
    if assets:
        ids = list(assets)
        linked: list[tuple[int, int, str, str]] = []
        for offset in range(0, len(ids), 800):
            batch = ids[offset:offset + 800]
            placeholders = ",".join("?" for _ in batch)
            entity_rows = connection.execute(
                "SELECT ae.asset_id,e.id entity_id,e.kind,e.canonical_name,e.normalized_name "
                f"FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id WHERE ae.asset_id IN ({placeholders})",
                batch,
            )
            for entity in entity_rows:
                if entity['entity_id'] in excluded:
                    continue
                aid = int(entity["asset_id"])
                kind = str(entity["kind"])
                normalized = str(entity["normalized_name"] or entity["canonical_name"]).casefold()
                labels[kind][normalized] = str(entity["canonical_name"])
                entity_ids[kind][normalized] = int(entity["entity_id"])
                representatives[kind].setdefault(normalized, aid)
                linked.append((aid, int(entity["entity_id"]), kind, normalized))
                entity_kinds[aid].add(kind)
                if assets[aid]["positive"]:
                    scores[kind][normalized] += float(assets[aid]["positive"])
                    items[kind][normalized].add(aid)
        representatives["performer"] = _solo_representatives(linked)

        for aid, asset in assets.items():
            for kind, column in (("creator", "creator"), ("studio", "studio")):
                value = str(asset.get(column) or "").strip()
                if not value or kind in entity_kinds[aid]:
                    continue
                normalized = value.casefold()
                labels[kind][normalized] = value
                representatives[kind].setdefault(normalized, aid)
                if asset["positive"]:
                    scores[kind][normalized] += float(asset["positive"])
                    items[kind][normalized].add(aid)

    tagged = sum("tag" in entity_kinds[aid] for aid in assets)
    identified = sum(bool(entity_kinds[aid] & {"creator", "performer"}) for aid in assets)
    return {
        "assets": len(assets), "seconds": total_seconds, "liked": liked, "disliked": disliked,
        "scores": scores, "items": items, "labels": labels,
        "entity_ids": entity_ids, "representatives": representatives,
        "coverage": {
            "tagged": tagged, "identified": identified,
            "untagged": len(assets) - tagged, "unidentified": len(assets) - identified,
        },
    }


def _rank_combined(
    kind: str,
    web_values: Counter[str],
    peach: dict[str, object],
    *,
    limit: int = 30,
) -> list[dict[str, object]]:
    scores = peach["scores"].get(kind, Counter())
    labels = peach["labels"].get(kind, {})
    item_sets = peach["items"].get(kind, {})
    normalized_web: Counter[str] = Counter()
    web_labels: dict[str, str] = {}
    for label, count in web_values.items():
        normalized = label.casefold().strip()
        normalized_web[normalized] += count
        web_labels.setdefault(normalized, label)
    rows: list[dict[str, object]] = []
    for normalized in set(scores) | set(normalized_web):
        web_visits = int(normalized_web[normalized])
        peach_score = float(scores[normalized])
        combined = peach_score + math.log2(1 + web_visits) * 2.0
        rows.append({
            "name": labels.get(normalized) or web_labels.get(normalized) or normalized,
            "score": round(combined, 2),
            "web_visits": web_visits,
            "peach_score": round(peach_score, 2),
            "peach_items": len(item_sets.get(normalized, set())),
            "entity_id": peach["entity_ids"].get(kind, {}).get(normalized),
            "representative_asset_id": peach["representatives"].get(kind, {}).get(normalized),
            **evidence_fields([source for source, present in (
                ("browsing", web_visits > 0), ("peach", peach_score > 0),
            ) if present]),
        })
    rows.sort(key=lambda row: (-float(row["score"]), -int(row["web_visits"]), str(row["name"])))
    return rows[:limit]


def _rank_for_source(
    rows: list[dict[str, object]], source: str, *, limit: int = 20,
) -> list[dict[str, object]]:
    """Let one evidence store order a list while retaining cross-store context."""
    if source == "browser":
        selected = [row for row in rows if int(row["web_visits"]) > 0]
        selected.sort(key=lambda row: (-int(row["web_visits"]), -int(row["peach_items"]), str(row["name"])))
    else:
        selected = [row for row in rows if float(row["peach_score"]) > 0]
        selected.sort(key=lambda row: (-float(row["peach_score"]), -int(row["web_visits"]), str(row["name"])))
    return selected[:limit]


def _tag_inventory(connection: sqlite3.Connection) -> dict[str, int]:
    """Count usable local tag matches without assuming every test schema is current."""
    columns = {str(row[1]) for row in connection.execute("PRAGMA table_info(asset)")}
    clauses, parameters = ["e.kind='tag'"], []
    if "medium" in columns:
        clauses.append("a.medium='video'")
    if "disposal" in columns:
        clauses.append("a.disposal IS NULL")
    if "location" in columns:
        clauses.append("a.location IN ('local','115')")
    if "snapshot_path" in columns:
        clauses.append("a.snapshot_path IS NOT NULL")
    if "ctx_orient" in columns:
        clauses.append("(a.ctx_orient IS NULL OR a.ctx_orient<>?)")
        parameters.append(PORTRAIT)
    query = (
        "SELECT e.canonical_name,count(DISTINCT ae.asset_id) "
        "FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id "
        "JOIN asset a ON a.id=ae.asset_id WHERE " + " AND ".join(clauses) +
        " GROUP BY e.id,e.canonical_name"
    )
    return {str(name): int(count) for name, count in connection.execute(query, parameters)}


def _taste_category_scores(rows: list[dict[str, object]]) -> Counter[str]:
    scores: Counter[str] = Counter()
    for row in rows:
        if not float(row.get("peach_score") or 0):
            continue
        compact = str(row["name"]).casefold().replace(" ", "").replace("_", "")
        for category, terms in CATEGORY_TERMS.items():
            if compact in terms:
                scores[category] += float(row["peach_score"])
    return scores


def _taste_analysis(
    history: dict[str, object],
    peach: dict[str, object],
    all_tags: list[dict[str, object]],
    all_creators: list[dict[str, object]],
    inventory: dict[str, int],
) -> dict[str, object]:
    browser_categories = Counter(history["categories"])
    peach_categories = _taste_category_scores(all_tags)
    browser_names = [name for name, score in browser_categories.most_common() if score > 0]
    peach_tags = [
        row for row in all_tags
        if float(row["peach_score"]) > 0 and str(row["name"]) not in NON_TASTE_SUMMARY_TAGS
    ]
    peach_tags.sort(key=lambda row: (-float(row["peach_score"]), str(row["name"])))
    peach_names = [str(row["name"]) for row in peach_tags[:5]]
    shared = [
        name for name, _score in browser_categories.most_common()
        if browser_categories[name] >= 3 and peach_categories[name] >= 3
    ][:3]
    browser_only = next((name for name in browser_names if peach_categories[name] <= 0), "")

    # 维度是 id，显示名由各自的 code 渲染；标签名与创作者名是内容，原样进参数。
    if browser_names and peach_names:
        headline = phrase_fields("headline", code="taste.headline.browserAndPeach", params={
            "category": category_phrase(browser_names[0]), "tags": peach_names[:3]})
    elif browser_names:
        headline = phrase_fields("headline", code="taste.headline.browserOnly",
                                 params={"category": category_phrase(browser_names[0])})
    elif peach_names:
        headline = phrase_fields("headline", code="taste.headline.peachOnly", params={"tags": peach_names[:3]})
    else:
        headline = phrase_fields("headline", code="taste.headline.notEnough")

    def point(code: str, items: list) -> dict:
        return {**phrase_fields("label", code=code),
                **phrase_fields("text", code="taste.items", params={"items": items})}

    points: list[dict[str, object]] = []
    if browser_names:
        points.append(point("taste.point.browsing", [category_phrase(name) for name in browser_names[:3]]))
    if peach_names:
        points.append(point("taste.point.peach", peach_names))
    if shared:
        points.append(point("taste.point.shared", [category_phrase(name) for name in shared]))
    elif browser_only:
        points.append(point("taste.point.unverified", [category_phrase(browser_only)]))

    visits = int(history["visits"])
    assets = int(peach["assets"])
    explicit = int(peach["liked"]) + int(peach["disliked"])
    if visits >= 1000 and assets >= 50 and explicit >= 10:
        confidence = "high"
    elif visits >= 1000 and assets >= 20:
        confidence = "medium"
    else:
        confidence = "early"

    explore: list[dict[str, object]] = []
    used_tags: set[str] = set()
    for category, signal in browser_categories.most_common():
        options = TASTE_CATEGORY_TAGS.get(category, ())
        tag = next((name for name in options if inventory.get(name, 0) > 0 and name not in used_tags), None)
        if not tag:
            continue
        used_tags.add(tag)
        corroborated = peach_categories[category] > 0
        explore.append({
            "kind": "tag", "tag": tag,
            **phrase_fields("title", code="taste.explore.title", params={"tag": tag}),
            **phrase_fields("detail", code=(
                "taste.explore.corroborated" if corroborated else "taste.explore.uncorroborated"),
                params={"signals": f"{int(signal):,}", "items": f"{inventory[tag]:,}"}),
            "items": inventory[tag], "signal": int(signal), "corroborated": corroborated,
        })
        if len(explore) == 3:
            break

    return {
        **headline,
        "points": points,
        "confidence": {"level": confidence, **phrase_fields("label", code=f"taste.confidence.{confidence}")},
        "explore": explore,
        "next_steps": _next_steps(peach, all_creators, explicit),
    }


def _next_steps(peach: dict[str, object], all_creators: list[dict[str, object]], explicit: int) -> list[dict[str, object]]:
    """口味总结末尾的几步建议：关注常逛却没收的创作者、复核没打标签或没认出身份的作品、补喜欢与不喜欢。"""
    creator_leads = [
        row for row in all_creators
        if int(row["web_visits"]) >= 3 and not int(row["peach_items"])
    ][:3]
    next_steps: list[dict[str, object]] = []
    if creator_leads:
        next_steps.append({
            "kind": "follow", **phrase_fields("title", code="taste.next.follow"),
            **phrase_fields("detail", code="taste.items",
                            params={"items": [str(row["name"]) for row in creator_leads]}),
            "route": "/subscriptions",
        })
    if int(peach["coverage"]["untagged"]) or int(peach["coverage"]["unidentified"]):
        next_steps.append({
            "kind": "review", **phrase_fields("title", code="taste.next.review"),
            **phrase_fields("detail", code="taste.next.reviewDetail", params={
                "untagged": int(peach["coverage"]["untagged"]),
                "unidentified": int(peach["coverage"]["unidentified"])}),
            "route": "/review",
        })
    if explicit < 10:
        next_steps.append({
            "kind": "feedback", **phrase_fields("title", code="taste.next.feedback"),
            **phrase_fields("detail", code="taste.next.feedbackDetail",
                            params={"liked": int(peach["liked"]), "disliked": int(peach["disliked"])}),
            "route": "/",
        })
    return next_steps


#: 每条浏览信号（身份访问在前、书签在后，与 `_HistoryRows` 同序）对应的出演者、创作者与
#: 域名，键是历史库版本加身份输入。只留最新一版。账本的其它写入（播放、关注检查、
#: 状态）不改身份输入，这份结果照样命中，重算只剩按行累加。
_LINKED_SIGNALS: dict[tuple, tuple[tuple, ...]] = {}
_NO_SIGNAL = ((), (), "", False)


def _linked_history_evidence(history_store, ledger_connection, since, history):
    """账号与标题的规范身份按浏览器信号汇总。"""
    browser_performers = Counter()
    history["bookmark_performers"] = Counter()
    cached = _history_rows(history_store) if history_store.is_file() else None
    if cached:
        rows = chain(((visited_at, False) for visited_at, _, _ in cached.identity_visits),
                     ((visited_at, True) for visited_at, _, _ in cached.bookmarks))
        for (visited_at, bookmark), signal in zip(rows, _linked_signals(history_store, cached, ledger_connection)):
            if since and visited_at < since:
                continue
            performers, creators, domain, counts_domain = signal
            for name in performers:
                browser_performers[name] += 1
                if bookmark:
                    history["bookmark_performers"][name] += 1
            for name in creators:
                history["creators"][name] += 1
                if bookmark:
                    history["bookmark_creators"][name] += 1
                history["creator_domains"].setdefault(name.casefold(), Counter())[domain] += 1
            if counts_domain:
                history["domains"][domain] += 1
                if bookmark:
                    history["bookmark_domains"][domain] += 1
    return browser_performers


def _linked_signals(history_store, cached, ledger_connection):
    """每条浏览信号一份 `_linked_signal`。同一网址与标题（历史里约四成是重复访问）只判一次。"""
    from .entities import male_performer_ids
    from .taste_evidence import IdentityIndex, browser_entities
    excluded = male_performer_ids(ledger_connection)
    accounts, _ = identity_context(ledger_connection)
    index = IdentityIndex(ledger_connection)
    # 判据读到的账本只有这几样：实体的种类与规范名、别名、身份链接与关注来源推出的账号、
    # 排除的男优。取值本身进键，不用账本版本号——关注检查每小时都写账本，身份却很少变。
    # 历史库那一半用这些行读出时的版本：此刻再读一次可能已是新版本，旧行算出的信号存到
    # 新版本下，之后新行命中它就会按位置错配。
    key = (cached.version,
           tuple(sorted((eid, row["kind"], row["canonical_name"]) for eid, row in index.entities.items())),
           tuple(sorted((kind, label, tuple(sorted(ids))) for (kind, label), ids in index.aliases.items())),
           tuple(sorted((identity, tuple(sorted(values))) for identity, values in accounts.items())),
           tuple(sorted(excluded)))
    hit = _LINKED_SIGNALS.get(key)
    if hit is not None:
        return hit
    matcher = index.title_matcher()
    pairs: dict[tuple[str, str], tuple] = {}
    signals = []
    for _, url, title in chain(cached.identity_visits, cached.bookmarks):
        signal = pairs.get((url, title))
        if signal is None:
            signal = pairs[url, title] = _linked_signal(
                url, title, browser_entities(url, title, index, matcher, accounts, {}), excluded)
        signals.append(signal)
    result = tuple(signals)
    _LINKED_SIGNALS.clear()
    _LINKED_SIGNALS[key] = result
    return result


def _linked_signal(url, title, entities, excluded):
    """一对网址与标题贡献的出演者、创作者、域名，以及这次访问算不算进域名榜。"""
    matches = set(entities)
    raw_creators = _url_candidates(url, title)[2]
    domain = (parse_url(url).hostname or "").removeprefix("www.")
    performers, creators = [], []
    for eid, kind, name in matches:
        if eid in excluded:
            continue
        if kind == "performer":
            performers.append(name)
        elif kind == "creator" and name.casefold() not in raw_creators:
            creators.append(name)
    counts_domain = bool(matches) and not (_is_taste_domain(domain) or mixed_adult(url, title))
    if not (performers or creators or counts_domain):
        return _NO_SIGNAL
    return tuple(performers), tuple(creators), domain, counts_domain


def _attach_bookmark_counts(rows, counts):
    """榜单保留浏览器信号总数，分别标注访问与书签证据。"""
    normalized = Counter()
    for label, count in counts.items():
        normalized[label.casefold().strip()] += count
    for row in rows:
        row["web_bookmarks"] = normalized[row["name"].casefold().strip()]
        row.update(evidence_fields([source for source, present in (
            ("browsing", row["web_visits"] > row["web_bookmarks"]),
            ("bookmarks", row["web_bookmarks"] > 0), ("peach", row["peach_score"] > 0)) if present]))


def build_taste_dashboard(
    history_store: Path,
    ledger_connection: sqlite3.Connection,
    *,
    since: str | None = None,
    exclude_disliked: bool = False,
) -> dict[str, object]:
    """Build a privacy-bounded, read-only taste view from both evidence stores."""
    history = _history_dashboard_evidence(history_store, since)
    browser_performers = _linked_history_evidence(history_store, ledger_connection, since, history)
    peach = _peach_dashboard_evidence(ledger_connection, since, exclude_disliked=exclude_disliked)
    all_tags = [row for row in _rank_combined("tag", history["tags"], peach, limit=1000)
                if row["name"] not in LENGTH_TAGS]
    all_creators = _rank_combined("creator", history["creators"], peach, limit=1000)
    for row in all_creators:
        source_counts = history["creator_domains"].get(str(row["name"]).casefold().strip(), Counter())
        row["source_domain"] = source_counts.most_common(1)[0][0] if source_counts else None
    all_performers = _rank_combined("performer", browser_performers, peach, limit=1000)
    for rows, counts in ((all_tags, history["bookmark_tags"]), (all_creators, history["bookmark_creators"]),
                         (all_performers, history["bookmark_performers"])):
        _attach_bookmark_counts(rows, counts)
    all_studios = _rank_combined("studio", Counter(), peach, limit=1000)
    all_series = _rank_combined("series", Counter(), peach, limit=1000)
    tags, creators, performers = all_tags[:30], all_creators[:30], all_performers[:30]

    category_scores: Counter[str] = Counter(history["categories"])
    for row in tags:
        compact = str(row["name"]).casefold().replace(" ", "").replace("_", "")
        for category, terms in CATEGORY_TERMS.items():
            if compact in terms:
                category_scores[category] += max(1, round(float(row["peach_score"])))

    gaps = [row for row in all_tags if row["web_visits"] >= 2 and not row["peach_items"]][:12]
    analysis = _taste_analysis(
        history, peach, all_tags, all_creators, _tag_inventory(ledger_connection),
    )
    # 前六个网站与前八位创作者之外的并成一端，键里记 None，输出时换成「其他网站」「其他创作者」。
    creator_flows: Counter[tuple[str | None, str | None]] = Counter()
    top_creators = {name.casefold().strip() for name, _ in history["creators"].most_common(8)}
    flow_domains: Counter[str] = Counter()
    for domains in history["creator_domains"].values():
        flow_domains.update({domain: count for domain, count in domains.items()
                             if _is_taste_domain(domain)})
    top_domains = {name for name, _ in flow_domains.most_common(6)}
    for creator, domains in history["creator_domains"].items():
        for domain, count in domains.items():
            if not _is_taste_domain(domain):
                continue
            creator_flows[(domain if domain in top_domains else None,
                           creator if creator in top_creators else None)] += count

    def flow_end(side: str, name: str | None, other: str) -> dict:
        return {side: name} if name is not None else phrase_fields(side, code=other)

    def category_rows(scores: Counter[str]) -> list[dict]:
        return [{**phrase_fields("name", code=f"taste.category.{name}"), "score": score}
                for name, score in scores.most_common(20)]
    return {
        "summary": {
            "history_visits": history["visits"],
            "bookmarks": history["bookmarks"],
            "history_sources": len(history["sources"]),
            "peach_items": peach["assets"],
            "peach_seconds": round(float(peach["seconds"])),
            "liked": peach["liked"],
            "disliked": peach["disliked"],
            "range_start": history["range_start"],
            "range_end": history["range_end"],
        },
        "sources": history["sources"],
        "activity": history["activity"],
        "creator_flows": [{**flow_end("source", source, "taste.flow.otherSites"),
                           **flow_end("target", target, "taste.flow.otherCreators"), "value": count}
                          for (source, target), count in creator_flows.most_common()],
        "rankings": {
            "browser_categories": category_rows(history["categories"]),
            "categories": category_rows(category_scores),
            "tags": tags,
            "creators": creators,
            "performers": performers,
            "browser_tags": _rank_for_source(all_tags, "browser"),
            "browser_creators": _rank_for_source(all_creators, "browser"),
            "browser_performers": _rank_for_source(all_performers, "browser"),
            "peach_tags": _rank_for_source(all_tags, "peach"),
            "peach_creators": _rank_for_source(all_creators, "peach"),
            "peach_performers": _rank_for_source(all_performers, "peach"),
            "peach_studios": _rank_for_source(all_studios, "peach"),
            "peach_series": _rank_for_source(all_series, "peach"),
            "domains": [{"name": name, "visits": count, "web_bookmarks": history["bookmark_domains"][name]}
                        for name, count in history["domains"].most_common(20)],
        },
        "coverage": peach["coverage"],
        "gaps": gaps,
        "analysis": analysis,
        "privacy": {
            "raw_history_local_only": True,
            "ledger_unchanged": True,
            "candidate_only": True,
            "dislikes_do_not_downrank_tags": True,
        },
    }


def read_creator_candidates(output_dir: Path, limit: int = 200) -> list[dict]:
    """读最新一批创作者候选，按访问次数从多到少。

    只读，不联网、不重跑分析。取最新那个文件而不是合并全部：每次分析都是对当时
    全量历史的重算，旧文件是快照不是增量，合起来只会把同一个人算两遍。
    """
    try:
        files = sorted(Path(output_dir).glob("taste-creator-candidates-*.csv"))
    except OSError:
        return []
    if not files:
        return []
    rows: list[dict] = []
    try:
        for row in read_rows(files[-1]):
                name = (row.get("candidate") or "").strip()
                if not name:
                    continue
                try:
                    visits = int(row.get("visits") or 0)
                except ValueError:
                    visits = 0
                rows.append({
                    "name": name,
                    "visits": visits,
                    "status": (row.get("status") or "").strip(),
                    "sources": (row.get("sources") or "").strip(),
                })
    except (OSError, csv.Error, UnicodeError):
        return []
    rows.sort(key=lambda item: (-item["visits"], item["name"]))
    return rows[:limit]


def _tokens(value: str) -> set[str]:
    decoded = unquote(value).casefold()
    decoded = re.sub(r"(?<!\S)(?:sort|order|rating|score|id|date|limit|page|artist):\S+", " ", decoded)
    # Search syntaxes use a leading minus for exclusion. Remove the whole
    # operand before tokenizing, including grouped forms such as -ai_generated.
    decoded = NEGATIVE_QUERY_TERM.sub(" ", decoded).replace("-", " ")
    # Underscores are part of one source tag (detroit_become_human,
    # big_breasts), not separators between independent preferences.
    values = re.findall(
        r"(?:[a-z0-9]{2,}|[\u3040-\u30ff\u3400-\u9fff]{1,30})(?:_(?:[a-z0-9]+|[\u3040-\u30ff\u3400-\u9fff]+))*",
        decoded,
    )
    return {value for value in values if value not in STOPWORDS and not value.isdigit()}


def _is_taste_domain(domain: str) -> bool:
    # 逐级去掉最左一段查集合：`a.b.kemono.su` 依次查 `a.b.kemono.su`、`b.kemono.su`、
    # `kemono.su`，与「等于某个后缀或以 `.后缀` 结尾」同义，不必每条网址扫一遍名单。
    while domain:
        if domain in TASTE_DOMAIN_SUFFIXES:
            return True
        _, _, domain = domain.partition(".")
    return False


def _creator_candidate(value: str) -> str | None:
    candidate = unquote(value).casefold().strip("@ ")
    if candidate in RESERVED_HANDLES or candidate.isdigit() or not (3 <= len(candidate) <= 80):
        return None
    if re.fullmatch(r"[0-9a-f]{24,}", candidate):
        return None
    if not re.fullmatch(r"[a-z0-9._-]+|[\u3400-\u9fff][\u3400-\u9fff·._-]*", candidate):
        return None
    return candidate


def _query_candidates(parsed):
    """站内搜索与 Booru 艺术家语法，排除排序和负向条件。"""
    tags: set[str] = set()
    query_creators: set[str] = set()
    for value in re.findall(r"/(?:searchstr|search_word|keyword)=([^/]+)", unquote(parsed.path), re.I):
        tags.update(_tokens(value.replace("+", " ")))
    for key, values in parse_qs(parsed.query).items():
        if key.casefold() in QUERY_KEYS:
            for value in values:
                tags.update(_tokens(value))
                for raw in re.findall(r"(?:^|\s)artist:([^\s]+)", value, re.I):
                    candidate = _creator_candidate(raw)
                    if candidate:
                        query_creators.add(candidate)
    return tags, query_creators


@lru_cache(maxsize=1)
def _title_genre_matcher():
    """标题复用内容词表，排除依赖来源语境的省写与单字。"""
    from .genre_taxonomy import CONTENT_GENRES, CONTENT_ALIASES, normalise_genre, resolve_genre
    matcher = ahocorasick.Automaton()
    ambiguous = TITLE_AMBIGUOUS_TERMS
    for raw in CONTENT_GENRES.keys() | CONTENT_ALIASES.keys() | set(CONTENT_GENRES.values()):
        term = normalise_genre(raw)
        label = resolve_genre(term)
        if label and term not in ambiguous and len(term) >= (4 if term.isascii() else 2):
            matcher.add_word(term, (term, label))
    matcher.make_automaton()
    return matcher


def _title_tags(title):
    from .genre_taxonomy import normalise_genre
    text = NEGATIVE_QUERY_TERM.sub(" ", normalise_genre(title))
    tags = set()
    for end, (term, label) in _title_genre_matcher().iter_long(text):
        start = end - len(term) + 1
        edges = text[max(0, start - 1):start] + text[end + 1:end + 2]
        if term.isascii() and any(char.isascii() and (char.isalnum() or char == "_") for char in edges):
            continue
        tags.add(label)
    return tags


def _url_candidates(url: str, title: str = "") -> tuple[str | None, set[str], set[str]]:
    try:
        parsed = parse_url(url)
        domain = (parsed.hostname or "").casefold()
    except ValueError:
        return None, set(), set()
    if parsed.scheme not in {"http", "https"}:
        return None, set(), set()
    if domain.startswith("www."):
        domain = domain[4:]
    if not (_is_taste_domain(domain) or mixed_adult(url, title)):
        return domain or None, set(), set()
    tags, creators = _query_candidates(parsed)

    segments = [unquote(segment).casefold() for segment in parsed.path.split("/") if segment]
    for index, segment in enumerate(segments[:-1]):
        if segment in {"tag", "tags", "search"}:
            tags.update(_tokens(segments[index + 1]))
    for index, segment in enumerate(segments[:-1]):
        candidate = _creator_candidate(segments[index + 1])
        if segment in CREATOR_MARKERS and candidate:
            creators.add(candidate)
    if domain in CREATOR_HOSTS and segments:
        if domain != "rule34video.com" or segments[0] in {"model", "models"}:
            candidate = _creator_candidate(segments[-1] if domain == "rule34video.com" else segments[0])
            if candidate:
                creators.add(candidate)
    if domain in MIXED_DOMAINS:
        account = account_key(url)
        if account:
            creators.add(account[1])
    from .genre_taxonomy import resolve_genre
    unique = {}
    for tag in sorted(tags, key=lambda value: (len(value), value)):
        label = resolve_genre(tag.replace("_", " "))
        unique.setdefault(label or tag, tag)
    tags = set(unique.values())
    represented = set(unique)
    tags.update(_title_tags(title) - represented)
    return domain or None, tags, creators


def analyze_history(store_path: Path, output_dir: Path, *, since: str | None = None, progress=None) -> dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    query = (
        "SELECT v.source_key, v.visited_at, v.url, s.browser, s.profile,v.title,0 bookmark "
        "FROM history_visit v JOIN history_source s ON s.source_key = v.source_key"
    )
    params: tuple[str, ...] = (since,) if since else ()
    domains: Counter[str] = Counter()
    tag_visits: Counter[str] = Counter()
    creator_visits: Counter[str] = Counter()
    tag_bookmarks, creator_bookmarks = Counter(), Counter()
    tag_urls: dict[str, set[str]] = defaultdict(set)
    creator_urls: dict[str, set[str]] = defaultdict(set)
    tag_sources: dict[str, set[str]] = defaultdict(set)
    creator_sources: dict[str, set[str]] = defaultdict(set)
    category_visits: Counter[str] = Counter()
    min_time: str | None = None
    max_time: str | None = None
    total = 0
    bookmarks_count = 0
    with closing(sqlite3.connect(_readonly_uri(store_path), uri=True)) as db:
        if db.execute("SELECT 1 FROM sqlite_master WHERE name='history_bookmark'").fetchone():
            query += (" UNION ALL SELECT b.source_key,b.added_at,b.url,s.browser,s.profile,b.title,1 bookmark "
                      "FROM history_bookmark b JOIN history_source s ON s.source_key=b.source_key")
        if since:
            query = "SELECT * FROM (" + query + ") WHERE visited_at>=?"
        source_count = db.execute("SELECT COUNT(*) FROM history_source").fetchone()[0]
        ceiling = db.execute("SELECT COUNT(*) FROM (" + query + ")", params).fetchone()[0]
        def report_analysis():
            if progress:
                progress(stage="analyzing", checked=total, total=ceiling, **message_fields(
                    "jobMessage.tasteHistory.analyzing", {"checked": f"{total:,}", "total": f"{ceiling:,}"}))
        report_analysis()
        for source_key, visited_at, url, browser, profile, title, bookmark in db.execute(query, params):
            total += 1
            bookmarks_count += bookmark
            if visited_at and not bookmark:
                min_time = visited_at if min_time is None or visited_at < min_time else min_time
                max_time = visited_at if max_time is None or visited_at > max_time else max_time
            domain, tags, creators = _url_candidates(url, title or "")
            if domain:
                domains[domain] += 1
            url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()
            source_label = f"{browser}:{profile}"
            for tag in tags:
                tag_visits[tag] += 1
                tag_bookmarks[tag] += bookmark
                tag_urls[tag].add(url_hash)
                tag_sources[tag].add(source_label)
                compact = tag.replace(" ", "").replace("_", "")
                for category, terms in CATEGORY_TERMS.items():
                    if compact in terms or tag in terms:
                        category_visits[category] += 1
            for creator in creators:
                creator_visits[creator] += 1
                creator_bookmarks[creator] += bookmark
                creator_urls[creator].add(url_hash)
                creator_sources[creator].add(source_label)
            if total % 1000 == 0:
                report_analysis()
        report_analysis()

    if progress:
        progress(stage="reporting", checked=0, total=None, **message_fields("jobMessage.tasteHistory.reporting"))

    stamp = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
    tag_path = output_dir / f"taste-tag-candidates-{stamp}.csv"
    creator_path = output_dir / f"taste-creator-candidates-{stamp}.csv"
    report_path = output_dir / f"taste-report-{stamp}.md"
    _write_candidates(tag_path, "tag", tag_visits, tag_urls, tag_sources, tag_bookmarks)
    _write_candidates(creator_path, "creator", creator_visits, creator_urls, creator_sources, creator_bookmarks)

    # 报告是写给这台电脑上的人读的文件，与命令行同一个语言判断。
    language = interface_text.local_language()

    def report_text(key: str, params: dict | None = None) -> str:
        return taste_text(f"taste.report.{key}", params, language)

    nothing = report_text("none")
    lines = [
        f"# {report_text('title')}",
        "",
        "- " + report_text("generatedAt", {"time": datetime.now().astimezone().isoformat(timespec="seconds")}),
        "- " + report_text("range", {"start": min_time or nothing, "end": max_time or nothing}),
        "- " + report_text("visits", {"count": f"{total - bookmarks_count:,}"}),
        "- " + report_text("bookmarks", {"count": f"{bookmarks_count:,}"}),
        "- " + report_text("sources", {"count": source_count}),
        "- " + report_text("privacy"),
        "",
    ]
    categories = Counter({taste_text(f"taste.category.{name}", None, language): count
                          for name, count in category_visits.items()})
    for key, values in (("categories", categories), ("tags", tag_visits),
                        ("creators", creator_visits), ("domains", domains)):
        _append_ranking(lines, report_text, key, values)
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return {
        "visits": total - bookmarks_count,
        "bookmarks": bookmarks_count,
        "sources": source_count,
        "range_start": min_time,
        "range_end": max_time,
        "report": str(report_path),
        "tags": str(tag_path),
        "creators": str(creator_path),
    }


def _write_candidates(
    path: Path,
    kind: str,
    visits: Counter[str],
    urls: dict[str, set[str]],
    sources: dict[str, set[str]],
    bookmarks: Counter[str],
) -> None:
    write_rows(
        path,
        ["candidate", "kind", "visits", "bookmarks", "signals", "distinct_urls", "source_count", "sources", "status"],
        (
            {
                "candidate": candidate,
                "kind": kind,
                "visits": count - bookmarks[candidate],
                "bookmarks": bookmarks[candidate],
                "signals": count,
                "distinct_urls": len(urls[candidate]),
                "source_count": len(sources[candidate]),
                "sources": " | ".join(sorted(sources[candidate])),
                "status": "candidate",
            }
            for candidate, count in visits.most_common()
        ),
    )


def _append_ranking(lines: list[str], report_text, section: str, values: Counter[str], limit: int = 30) -> None:
    """报告里的一节排行。`report_text(键)` 渲染 `taste.report.<键>`，节标题在 `taste.report.section.<section>`。"""
    lines.extend([f"## {report_text(f'section.{section}')}", "",
                  f"| {report_text('candidate')} | {report_text('signals')} |", "| --- | ---: |"])
    if values:
        lines.extend(f"| {name.replace('|', '\\|')} | {count:,} |" for name, count in values.most_common(limit))
    else:
        lines.append(f"| {report_text('nothingExtracted')} | 0 |")
    lines.append("")


def write_manifest(path: Path, refresh_results: list[dict[str, object]], analysis: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(UTC).isoformat(),
        "refresh": refresh_results,
        "analysis": analysis,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
