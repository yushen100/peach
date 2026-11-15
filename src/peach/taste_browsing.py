"""用户脚本带来的浏览记录与主动下载：口味证据的两档，以及按番号、女优的只读汇总（ADR-0164）。

用户脚本在自己的设置里勾选「记录浏览」后，作品页、女优页的查询带上 `record=1`，Peach 据此记一笔。
是否记录、哪一页算浏览都由用户脚本决定，列表面板的批量查询不带这个参数。记录和导入的浏览器历史
一样只在本机口味目录、不进 ledger，但单独存 `browsing.sqlite`：翻页很频繁，写进 `history.sqlite`
会让整份浏览器历史的口味缓存每翻一页就失效重算。

信号分级从弱到强：浏览 < 主动下载、想要 < 反复下载、关注 < 播放看完。推荐打分里的权重见
`taste_evidence.preference_evidence`；剧情类标签不作口味特征（`genre_taxonomy.PLOT_TAGS`）。
"""
from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
from collections import defaultdict
from contextlib import closing
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

from .catalog_rules import normalise_code_key
from .entities import normalize_entity_name

LOGGER = logging.getLogger(__name__)
#: 同一作品或女优页在这段时间里再查（刷新、追踪进度的轮询）只算一次。
REVISIT = timedelta(minutes=30)
#: 用户脚本「加入下载」的提交来源前缀；批量补库脚本的提交不算本人的下载意图。
BROWSER_ORIGIN = "browser:"
#: 汇总给出的信号档，从弱到强。
LEVELS = ("browse", "download", "want", "follow", "watch")


def store_path(history_store: Path) -> Path:
    return Path(history_store).with_name("browsing.sqlite")


def _prepare(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS browse_visit (
            id INTEGER PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('work', 'performer')),
            subject TEXT NOT NULL,
            site TEXT NOT NULL DEFAULT '',
            url TEXT NOT NULL DEFAULT '',
            names TEXT NOT NULL DEFAULT '[]',
            visited_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS browse_visit_subject_idx ON browse_visit(kind, subject, visited_at);
        """
    )


def _rows(path: Path, sql: str, params=()) -> list:
    """只读查询；库还没建过或读不出时当作没有记录。"""
    if not path.is_file():
        return []
    from .taste_history import _readonly_uri
    try:
        with closing(sqlite3.connect(_readonly_uri(path), uri=True)) as db:
            return db.execute(sql, params).fetchall()
    except sqlite3.DatabaseError:
        return []


def _site(url: str) -> str:
    try:
        host = urlparse(url).hostname or ""
    except ValueError:
        return ""
    return host.removeprefix("www.")


class BrowsingRecorder:
    """用户脚本要求记录的那几次查询；记录失败只写日志，不影响查询本身的回答。"""

    def __init__(self, contract, clock=lambda: datetime.now(UTC)):
        self.contract, self.clock = contract, clock

    @property
    def path(self) -> Path:
        return store_path(self.contract.taste_history_store)

    def work(self, code: str, names, url: str = "") -> bool:
        """`names` 在确定要记时才调用，返回本机认得的出演者名字；由 web 层提供，本模块不依赖它。"""
        return self._record("work", normalise_code_key(code), url, names)

    def performer(self, url: str, name: str) -> bool:
        return self._record("performer", url, url, lambda: [name] if name else [])

    def _record(self, kind: str, subject: str, url: str, names) -> bool:
        if not subject:
            return False
        try:
            now = self.clock()
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(self.path, timeout=5)) as db:
                _prepare(db)
                if db.execute("SELECT 1 FROM browse_visit WHERE kind=? AND subject=? AND visited_at>=? LIMIT 1",
                              (kind, subject, (now - REVISIT).isoformat())).fetchone():
                    return False
                db.execute("INSERT INTO browse_visit(kind,subject,site,url,names,visited_at) VALUES(?,?,?,?,?,?)",
                           (kind, subject, _site(url), url, json.dumps(names(), ensure_ascii=False), now.isoformat()))
                db.commit()
            return True
        except Exception as error:  # 记录是附带的：任何失败都不能让查询报错。
            LOGGER.warning("browsing record failed: %s", type(error).__name__)
            return False


def browsing_version(history_store: Path) -> str | None:
    """口味缓存用的版本：只随「哪天看过谁」变，同一天反复浏览同一批作品不让推荐重算。"""
    rows = _rows(store_path(history_store),
                 "SELECT DISTINCT kind,subject,names,substr(visited_at,1,10) FROM browse_visit ORDER BY 1,2,3,4")
    return hashlib.sha256(json.dumps(rows, ensure_ascii=False).encode()).hexdigest() if rows else None


def _work_names(history_store: Path) -> dict[str, set[str]]:
    names = defaultdict(set)
    for subject, raw in _rows(store_path(history_store),
                              "SELECT DISTINCT subject,names FROM browse_visit WHERE kind='work'"):
        names[subject].update(json.loads(raw))
    return names


def add_browsing_evidence(history_store: Path, index, counters) -> None:
    """浏览证据按女优计「哪几天看过」；与导入的浏览器历史取较大的一方，同一天两边都记到不重复算。"""
    days = defaultdict(set)
    for raw, day in _rows(store_path(history_store),
                          "SELECT DISTINCT names,substr(visited_at,1,10) FROM browse_visit"):
        for name in json.loads(raw):
            entity = index.resolve("performer", name)
            if entity:
                index.names["performer"][entity["id"]] = entity["canonical_name"]
                days[entity["id"]].add(day)
    browsing = counters["browsing"]["performer"]
    for eid, seen in days.items():
        browsing[eid] = max(browsing[eid], len(seen))


def _downloaded_codes(connection) -> set[str]:
    if not connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='download_submission'").fetchone():
        return set()
    return {key for (code,) in connection.execute(
        "SELECT DISTINCT code FROM download_submission WHERE origin LIKE ? AND code IS NOT NULL", (BROWSER_ORIGIN + "%",))
        if (key := normalise_code_key(code))}


def add_download_evidence(connection, history_store: Path, index, counters) -> None:
    """主动下载按作品计：同一女优、厂牌、系列被下载的作品越多越强。人物先看账本，还没入库的看浏览时记下的名字。"""
    codes = _downloaded_codes(connection)
    if not codes:
        return
    works = defaultdict(set)
    known = set()
    for code, eid, kind, name in connection.execute(
            "SELECT a.code,e.id,e.kind,e.canonical_name FROM asset a JOIN asset_entity ae ON ae.asset_id=a.id "
            "JOIN entity e ON e.id=ae.entity_id WHERE a.code IS NOT NULL AND e.kind IN ('performer','studio','series')"):
        key = normalise_code_key(code)
        if key in codes and eid not in index.excluded:
            known.add(key)
            index.names[kind][eid] = name
            works[(kind, eid)].add(key)
    for key, names in _work_names(history_store).items():
        if key in codes and key not in known:
            for name in names:
                entity = index.resolve("performer", name)
                if entity:
                    index.names["performer"][entity["id"]] = entity["canonical_name"]
                    works[("performer", entity["id"])].add(key)
    for (kind, eid), keys in works.items():
        counters["downloads"][kind][eid] = len(keys)


def _span(rows) -> dict:
    """一组时间戳的次数、首次与最近；没有就是 0 次。"""
    stamps = sorted(stamp for stamp in rows if stamp)
    return {"count": len(stamps), "first_at": stamps[0] if stamps else None, "last_at": stamps[-1] if stamps else None}


def _code_signals(connection, history_store: Path, key: str) -> dict:
    visits = _rows(store_path(history_store),
                   "SELECT visited_at,site FROM browse_visit WHERE kind='work' AND subject=?", (key,))
    downloads = [created for code, created in connection.execute(
        "SELECT code,created_at FROM download_submission WHERE origin LIKE ?", (BROWSER_ORIGIN + "%",))
        if normalise_code_key(code) == key]
    wants = connection.execute("SELECT state,created_at FROM want_item WHERE code_key=?", (key,)).fetchall()
    assets = [dict(row) for row in connection.execute(
        "SELECT id,code,play_count,play_seconds,last_played,feedback FROM asset WHERE code IS NOT NULL")
        if normalise_code_key(row["code"]) == key]
    return {
        "browse": {**_span(row[0] for row in visits), "sites": sorted({row[1] for row in visits} - {""})},
        "download": {**_span(downloads), "days": len({stamp[:10] for stamp in downloads})},
        "want": {**_span(row["created_at"] for row in wants), "state": wants[0]["state"] if wants else None},
        "follow": {"count": 0},
        "watch": _watch(assets),
    }


def _watch(assets) -> dict:
    return {"assets": len(assets), "play_count": sum(int(row["play_count"] or 0) for row in assets),
            "play_seconds": round(sum(float(row["play_seconds"] or 0) for row in assets), 1),
            "last_at": max((row["last_played"] for row in assets if row["last_played"]), default=None),
            "disliked": sum(row["feedback"] == "dislike" for row in assets)}


def _performer_signals(connection, history_store: Path, entity_id: int) -> dict:
    from .entities import male_performer_ids
    entity = connection.execute("SELECT id,canonical_name FROM entity WHERE id=? AND kind='performer'",
                                (entity_id,)).fetchone()
    if entity is None or entity_id in male_performer_ids(connection):
        return {}
    labels = {normalize_entity_name(entity["canonical_name"])} | {normalize_entity_name(alias) for (alias,) in connection.execute(
        "SELECT alias FROM entity_alias WHERE entity_id=?", (entity_id,))}
    visits = [(stamp, kind, subject) for kind, subject, raw, stamp in _rows(
        store_path(history_store), "SELECT kind,subject,names,visited_at FROM browse_visit")
        if labels & {normalize_entity_name(name) for name in json.loads(raw)}]
    assets = [dict(row) for row in connection.execute(
        "SELECT a.id,a.code,a.play_count,a.play_seconds,a.last_played,a.feedback FROM asset a "
        "JOIN asset_entity ae ON ae.asset_id=a.id WHERE ae.entity_id=?", (entity_id,))]
    keys = {normalise_code_key(row["code"]) for row in assets if row["code"]} | {
        subject for _stamp, kind, subject in visits if kind == "work"}
    downloads = defaultdict(list)
    if _downloaded_codes(connection) & keys:
        for code, created in connection.execute(
                "SELECT code,created_at FROM download_submission WHERE origin LIKE ?", (BROWSER_ORIGIN + "%",)):
            if (key := normalise_code_key(code)) in keys:
                downloads[key].append(created)
    follows = connection.execute("SELECT count(*) FROM follow_source WHERE entity_id=? AND enabled=1",
                                 (entity_id,)).fetchone()[0]
    return {
        "browse": {**_span(stamp for stamp, _kind, _subject in visits),
                   "works": len({subject for _stamp, kind, subject in visits if kind == "work"}),
                   "pages": sum(kind == "performer" for _stamp, kind, _subject in visits),
                   "days": len({stamp[:10] for stamp, _kind, _subject in visits})},
        "download": {**_span(stamp for stamps in downloads.values() for stamp in stamps), "works": len(downloads)},
        "want": {"count": connection.execute(
            "SELECT count(*) FROM want_item WHERE code_key IN (SELECT value FROM json_each(?))",
            (json.dumps(sorted(keys)),)).fetchone()[0]},
        "follow": {"count": int(follows)},
        "watch": _watch(assets),
    }


def signals(connection, history_store: Path, *, code: str | None = None, performer: int | None = None) -> dict:
    """按番号或女优汇总各档口味信号，只读；`levels` 由弱到强排列。"""
    if code is not None:
        key = normalise_code_key(code)
        found = _code_signals(connection, history_store, key) if key else {}
        subject = {"code": code, "code_key": key}
    else:
        found = _performer_signals(connection, history_store, int(performer))
        subject = {"performer": int(performer)}
    if not found:
        return {**subject, "found": False, "levels": []}
    return {**subject, "found": True, "levels": [{"level": level, **found[level]} for level in LEVELS]}


def q_taste_signals(contract, args) -> dict:
    """`GET /api/taste/signals?code=` 或 `?performer=<实体 id>`：按番号或女优只读汇总各档信号。"""
    from .user_messages import UserValueError
    code, performer = str(args.get("code") or "").strip(), str(args.get("performer") or "").strip()
    if bool(code) == bool(performer) or (performer and not performer.isdigit()) or len(code) > 80:
        raise UserValueError("api.tasteSignals.chooseSubject")
    with contract.read_connection() as connection:
        return signals(connection, contract.taste_history_store,
                       code=code or None, performer=int(performer) if performer else None)
