"""番号发现源的读写契约：订阅管理、拉取、未入库新作的列表与已读/忽略（ADR-0042）。

这里是 Feed 唯一会向站点发请求的地方。HTTP 走 `scraping_access.SourceTransport`
（按来源的凭据、代理与冷却）套 `HostLimitedTransport`（按主机的间隔），
和刮削链同一套预算——Feed 是后台跑的，不因此另开一套限流。
"""
from __future__ import annotations

import json
import re
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from . import (
    avatar_followup, entities, entry_links, feed_followup, feeds, interface_text, javdb,
    performer_alias_followup as alias, performer_profile_followup, wants, web_catalog,
    web_settings, web_wants,
)
from .catalog_rules import normalise_code_key
from .coded_text import Said, from_error
from .follow_scheduler import CHECK_WAIT_SECONDS
from .followups import Attempts, attempts_root
from .jobs import TaskRunConflict
from .http import HttpRequest, public_https_url
from .task_runs import MAX_FOLLOWUPS
from .user_messages import UserFacingError, UserInterruptedError, UserValueError

#: 一次拉取的超时与体积上限。JavDB 演员页 78 KB；2 MiB 之外的东西不是演员页，
#: 是被替换成了别的页面。
FETCH_TIMEOUT = 30.0
FETCH_MAX_BYTES = 2 * 1024 * 1024

#: 一轮里最多拉几个源。源多的时候分几轮拉完，而不是让一轮跑到限流上去。
MAX_SOURCES_PER_RUN = 20

#: 定时那几轮多久派一次存量后继：旧壳重试、补封面、缺头像的存量女优与想要作品重试
#: （ADR-0134）。定时拉取每 `feeds.TICK_MINUTES` 一跳，存量跟着每跳派一次就成了原来的十几倍；
#: 本轮新发现的番号不受它管，照旧当场派取资料。
STOCK_INTERVAL = timedelta(hours=6)

_NOT_MODIFIED = 304


def _cooling_until(contract, url: str) -> datetime | None:
    """这个地址所属的来源还在冷却就返回冷却结束的时刻（UTC），否则 None。"""
    from .scraping_access import paused_until, source_for

    source = source_for(url)
    until = paused_until(contract.follow_secrets_root, source) if source else 0.0
    return datetime.fromtimestamp(until, timezone.utc) if until else None


def _same_source(url: str, other: str) -> bool:
    """两个订阅地址是不是同一个来源的：冷却按来源记，顺延也只顺延同一来源的那几个。"""
    from .scraping_access import source_for

    return source_for(url) == source_for(other)


def _paused_by_source(error: Exception) -> bool:
    """来源冷却挡下的这一次；本趟预算耗尽（`SourceBudgetExhausted`）不算来源冷却。"""
    from .scraping_access import SourceBudgetExhausted, SourcePaused

    return isinstance(error, SourcePaused) and not isinstance(error, SourceBudgetExhausted)


def _parse_source(kind: str, body: bytes, url: str):
    """演员页受登录限制时返回可操作的原因。"""
    if kind == feeds.KIND_JAVDB_ACTOR and javdb.LOGIN.search(body.decode("utf-8", "replace")):
        raise UserValueError("api.feeds.javdbLoginRequired")
    parsed = feeds.parse(kind, body, url)
    if parsed is None:
        raise UserValueError("api.feeds.pageUnparsable")
    return parsed


def _transport(contract):
    from .jav_cover_fetch import HostLimitedTransport
    from .library_processing import SOURCE_LIMITER
    from .scraping_access import SourceTransport

    return HostLimitedTransport(
        SourceTransport(contract.follow_secrets_root), 2.0, limiter=SOURCE_LIMITER)


def fetch(transport, url: str, *, etag: str | None = None,
          last_modified: str | None = None):
    """取一次订阅地址。304 不是失败，原样交给调用方判。"""
    if not public_https_url(url):
        raise UserValueError("api.feeds.publicHttpsRequired")
    headers = {"Accept": "text/html"}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified
    return transport(HttpRequest("GET", url, headers), FETCH_TIMEOUT, FETCH_MAX_BYTES)


def _reason(code: str, **params) -> dict:
    """结果行上的一句失败原因：`error` 是 zh-CN 原文，`error_code` 与 `error_params` 给界面取译文。"""
    return {"error": interface_text.text(f"server:{code}", params), "error_code": code, "error_params": params}


def _failure(error: BaseException) -> dict:
    """异常写成结果行的失败原因：带 code 的连同 code 一起给，别的只给原文。"""
    if isinstance(error, UserFacingError):
        return {"error": error.message, "error_code": error.code, "error_params": dict(error.params)}
    return {"error": str(error)}


def poll_source(contract, transport, source) -> dict:
    """拉一个源并落库，返回这一轮的账。任何失败都写进源的 `last_error`。

    四条返回路径（请求失败、304、解析失败、正常）都经 `feeds.settle` 写下次时间，
    所以任何一种结局都不会让这个源卡住不再排队。
    """
    source_id = int(source["id"])
    interval = int(source["interval_minutes"])
    # `ok` 与 `added` 两个键名跟着 `follow_scheduler` 读结果的那一套写：它按
    # `ok` 数失败、按 `added` 数新增，两个调度对象共用同一段结算。
    report = {"source": source_id, "name": source["name"] or source["url"],
              "ok": True, "seen": 0, "added": 0, "without_code": 0, "error": None}
    if source["kind"] == feeds.KIND_DMM_ACTRESS:
        return _poll_dmm(contract, transport, source, report)
    try:
        response = fetch(transport, source["url"], etag=source["etag"],
                         last_modified=source["last_modified"])
    except Exception as error:  # noqa: BLE001 - 原因写到源那一行上给人看
        report.update(ok=False, **_failure(error))
        # 整站冷却挡回来的，冷却一过就重拉，不跟着间隔再等一整轮。
        retry_at = _cooling_until(contract, source["url"]) if _paused_by_source(error) else None
        if retry_at is not None:
            report["paused"] = True
        with contract.database.write_transaction() as connection:
            feeds.settle(connection, source_id, error=from_error(error),
                         interval_minutes=interval, retry_at=retry_at)
        return report
    if response.status == _NOT_MODIFIED:
        with contract.database.write_transaction() as connection:
            feeds.settle(connection, source_id, error=None, interval_minutes=interval)
        report["not_modified"] = True
        _backfill_solo_works(contract, transport, source, report)
        return report
    if response.status != 200:
        failure = Said("api.feeds.sourceHttpStatus", status=response.status)
        report.update(ok=False, error=str(failure), error_code=failure.code, error_params=dict(failure.params))
        with contract.database.write_transaction() as connection:
            feeds.settle(connection, source_id, error=failure, interval_minutes=interval)
        return report
    try:
        parsed = _parse_source(source["kind"], response.body, source["url"])
    except ValueError as error:
        message = from_error(error)
        report.update(ok=False, **_failure(error))
        with contract.database.write_transaction() as connection:
            feeds.settle(connection, source_id, error=message, interval_minutes=interval)
        return report
    headers = {key.lower(): value for key, value in (response.headers or {}).items()}
    with contract.database.write_transaction() as connection:
        outcome = feeds.poll(connection, source, parsed)
        feeds.settle(connection, source_id, error=None,
                     etag=headers.get("etag"), last_modified=headers.get("last-modified"),
                     interval_minutes=interval, seen=outcome["seen"],
                     new=len(outcome["created"]), page_name=parsed.title)
    report.update(seen=outcome["seen"], fresh=outcome["fresh"],
                  without_code=outcome["without_code"],
                  added=len(outcome["created"]),
                  codes=[code for _id, code in outcome["created"]])
    _backfill_solo_works(contract, transport, source, report)
    return report


def _poll_dmm(contract, transport, source, report: dict) -> dict:
    """拉一条 DMM 片单源（ADR-0135）：按地址里的女优编号问 GraphQL，不 GET 那个地址。

    请求走同一条 `SourceTransport` 与主机限流，包在 `holding` 里：验证页、封禁、地区限制与
    限流让 DMM 整站进冷却，刮削链之后的请求在同一关停下。任何失败都按原因写进这一行。
    """
    from .sources.base import Session, SourceFailure
    from .sources.dmm import DmmSource

    source_id = int(source["id"])
    interval = int(source["interval_minutes"])
    site = DmmSource()
    with contract.database.read_connection() as connection:
        known = feeds.seen_keys(connection, source_id)
    session = Session(transport)
    try:
        with site.holding(session):
            works = site.actress_works(feeds.dmm_actress_id(source["url"]), session=session,
                                       known=known, limit=feeds.MAX_ENTRIES)
    except Exception as error:  # noqa: BLE001 - 原因写到源那一行上给人看
        message = from_error(error)
        report.update(ok=False, **{**_failure(error), "error": message},
                      reason=str(error.reason) if isinstance(error, SourceFailure) else None)
        # 和演员页同一条：整站冷却挡回来的，冷却一过就重拉（ADR-0134）。
        retry_at = _cooling_until(contract, source["url"]) if _paused_by_source(error) else None
        if retry_at is not None:
            report["paused"] = True
        with contract.database.write_transaction() as connection:
            feeds.settle(connection, source_id, error=message, interval_minutes=interval,
                         retry_at=retry_at)
        return report
    parsed = feeds.parse_dmm_actress(works)
    hidden = web_settings.hidden_compilations(contract.database)
    with contract.database.write_transaction() as connection:
        outcome = feeds.poll(connection, source, parsed, hidden)
        feeds.settle(connection, source_id, error=None, interval_minutes=interval,
                     seen=outcome["seen"], new=len(outcome["created"]), page_name=parsed.title)
    report.update(seen=outcome["seen"], fresh=outcome["fresh"], total=works.total,
                  pre_order=sum(work.pre_order for work in works.works),
                  without_code=outcome["without_code"], compilations=outcome["compilations"],
                  added=len(outcome["created"]), codes=[code for _id, code in outcome["created"]])
    return report


#: 人物页那一行能列出的新作少于这个数，就再拉她的「單體作品」页补一批。隐退的人主页
#: 最近几十条全是合集，收起合集后那一行是空的；在役的人主页就够，不多花配额。
BACKFILL_BELOW = 12


def _backfill_solo_works(contract, transport, source, report: dict) -> None:
    """关联了人物的演员页列不满一行时，补拉「單體作品」页，用同一个源落库。

    条目身份是 `/v/<id>`，和主页同一套，已经见过的自动跳过。补拉失败不算这个源失败：
    主页那一轮已经成了，原因记在 `backfill_error` 上。
    """
    entity_id = source["entity_id"]
    if source["kind"] != feeds.KIND_JAVDB_ACTOR or not entity_id:
        return
    with contract.database.read_connection() as connection:
        register_listed(contract, connection)
        listed = connection.execute(
            "SELECT count(*) FROM feed_discovery d WHERE d.ignored_at IS NULL"
            f" AND {' AND '.join(LISTED)} AND EXISTS (SELECT 1 FROM feed_discovery_entity de"
            " WHERE de.discovery_id=d.id AND de.entity_id=?)", (int(entity_id),)).fetchone()[0]
    if int(listed or 0) >= BACKFILL_BELOW:
        return
    url = feeds.solo_works_url(source["url"])
    try:
        response = fetch(transport, url)
        if response.status != 200:
            raise UserValueError("api.feeds.sourceHttpStatus", {"status": response.status})
        parsed = _parse_source(source["kind"], response.body, url)
    except Exception as error:  # noqa: BLE001 - 主页已经落库，补拉只记原因
        report["backfill_error"] = str(error)
        return
    with contract.database.write_transaction() as connection:
        outcome = feeds.poll(connection, source, parsed)
    codes = [code for _id, code in outcome["created"]]
    report["backfilled"] = len(codes)
    report["added"] = int(report.get("added") or 0) + len(codes)
    report["codes"] = list(report.get("codes") or []) + codes


def _check_sources(contract, body, previous):
    """首次按请求选取到期来源，续跑只读取本批次冻结的来源集合。"""
    only = previous.get('source_ids') if 'source_ids' in previous else body.get("sources")
    with contract.database.read_connection() as connection:
        if isinstance(only, list):
            wanted = {int(value) for value in only}
            rows = [row for row in connection.execute(
                "SELECT * FROM feed_source ORDER BY id") if int(row["id"]) in wanted]
        elif body.get("all"):
            rows = list(connection.execute(
                "SELECT * FROM feed_source WHERE enabled=1 ORDER BY id"))
        else:
            rows = feeds.due_sources(connection)
    return rows[:MAX_SOURCES_PER_RUN]


def _execute_check(contract, body, job_id: str) -> dict:
    previous = contract.feed_job.snapshot() or {}
    if 'source_ids' not in previous:
        # 订阅中的人后来刮到了 DMM 编号的，这一轮前补上她的 DMM 片单源（ADR-0135）。
        with contract.database.write_transaction() as connection:
            feeds.sync_dmm_sources(connection)
    rows = _check_sources(contract, body, previous)
    transport = _transport(contract)
    results = list(previous.get('results') or [])
    completed = {row['source'] for row in results if row.get('ok') and not row.get('backfill_error')}
    codes = [code for row in results for code in row.get('codes') or []]
    if not contract.feed_job.checkpoint(job_id, source_ids=[int(row['id']) for row in rows]):
        raise UserInterruptedError("errors.webFeeds.checkStopped")
    deferred, held = 0, set()
    try:
        for index, source in enumerate(rows):
            if int(source['id']) in completed | held:
                continue
            until = _cooling_until(contract, source["url"])
            if until is not None:
                # 只顺延同一来源的：JavDB 冷却挡不住 DMM 片单，反过来也一样（ADR-0135）。
                pending = [row for row in rows[index:] if int(row['id']) not in completed | held
                           and _same_source(row["url"], source["url"])]
                results, count = _defer_round(contract, pending, until, results)
                deferred += count
                held.update(int(row['id']) for row in pending)
                if not contract.feed_job.checkpoint(job_id, results=results, checked=len(results),
                                                    total=len(rows), added=len(set(codes))):
                    raise UserInterruptedError("errors.webFeeds.checkStopped")
                continue
            if not contract.feed_job.update(job_id, checked=len(results), total=len(rows),
                                            current=source["name"] or source["url"]):
                raise UserInterruptedError("errors.webFeeds.checkStopped")
            report = poll_source(contract, transport, source)
            results = [row for row in results if row['source'] != report['source']]
            results.append(report)
            codes.extend(report.get("codes") or [])
            if not contract.feed_job.checkpoint(job_id, results=results, checked=len(results),
                                                total=len(rows), added=len(set(codes))):
                raise UserInterruptedError("errors.webFeeds.checkStopped")
    finally:
        close = getattr(transport, "close", None)
        if close:
            close()
    contract.cache_bust()
    planned, stock = _plan_followups(contract, codes, automatic=bool(body.get("automatic")))
    return {"ok": True, "checked": len(results), "total": len(rows), "results": results,
            "added": len(codes), "deferred": deferred, "stock": stock,
            # 后继由结果声明，调度端统一派（ADR-0040）：这里只把清单交出去。
            "followups": [dict(key=item.key, task_key=item.task_key, label=item.label)
                          for item in planned]}


def _plan_followups(contract, codes: list[str], *, automatic: bool) -> tuple[list, bool]:
    """这一轮拉完要派的后继，以及这一轮有没有带上存量。

    取资料：新发现的先排，没取到资料的旧壳留着保底名额，同一批一条后继。不在这一批里的缺封面
    壳另成一批补封面，还没轮到取资料的也在内。定时那一轮只带到了重试时间的，手动点的那一轮全带；已在队里的番号都不再带。
    存量部分（旧壳、封面、头像）定时那几轮隔 `STOCK_INTERVAL` 才派一次，新番号每轮都派。
    """
    stock = _stock_due(contract) if automatic else True
    retry_after = feed_followup.RETRY_AFTER if automatic else timedelta(0)
    hidden = web_settings.hidden_compilations(contract.database)
    busy = feed_followup.in_flight(contract.task_runs)
    fresh = [code for code in dict.fromkeys(codes) if normalise_code_key(code) not in busy]
    with contract.database.read_connection() as connection:
        if not stock:
            return feed_followup.plan(fresh[:feed_followup.MAX_BATCH]), False
        batch = feed_followup.scrape_batch(
            connection, fresh, exclude=[*codes, *busy], retry_after=retry_after, hidden=hidden,
            cover_root=contract.cover_root)
        covers = feed_followup.cover_backlog(
            connection, contract.cover_root, exclude=[*codes, *batch, *busy],
            retry_after=retry_after, hidden=hidden)
        planned = feed_followup.plan(batch) + feed_followup.plan_covers(covers)
        # 余下的名额给缺头像的存量女优（ADR-0097）。资料处理收尾也派这一份，但没有新片
        # 入库的日子它一轮都不跑，存量就一直停在原地；定时拉取每天都跑。
        planned += avatar_followup.stock(
            connection, contract.avatar_root, Attempts(attempts_root(contract.candidate_root)),
            limit=MAX_FOLLOWUPS - len(planned))
    contract.feed_stock_planned_at = time.monotonic()
    return planned, True


def _defer_round(contract, pending, until: datetime, results: list) -> tuple[list, int]:
    """来源在冷却：这一轮剩下的源都顺延到冷却结束，整轮只记一条失败（ADR-0134）。

    冷却是整个来源的状态，不是哪个订阅的毛病；每个源各记一条「正在冷却」只会把真正的
    原因淹掉。本轮撞上 403 的那一行已经写了原因，就在它后面补一句顺延了几个；本轮一开始
    来源就在冷却（别的任务撞出来的），就用第一个源那一行说明，它的上次结论不改。
    """
    with contract.database.write_transaction() as connection:
        for row in pending:
            feeds.defer(connection, int(row["id"]), until)
    results = list(results)
    trigger = next((row for row in reversed(results) if row.get("paused")), None)
    rest = len(pending)
    if trigger is None:
        from .scraping_access import SOURCES, source_for
        first = pending[0]
        label = SOURCES.get(source_for(first["url"]) or "", {}).get("label")
        trigger = {"source": int(first["id"]), "name": first["name"] or first["url"],
                   "ok": False, "seen": 0, "added": 0, "without_code": 0, "paused": True,
                   **(_reason("labels.webFeeds.sourceCooling", source=label) if label
                      else _reason("labels.webFeeds.cooling"))}
        results.append(trigger)
        rest -= 1
    if rest:
        # 顺延了几个另成一句：前面的原因可能是别处的报错，两句各带各的 code。`error` 仍是连起来的原文，
        # 读 `error_code` 的界面要把 `deferred_note` 接在后面。
        note = _reason("labels.webFeeds.deferredRest", count=rest)
        trigger.update(deferred_note=note["error"], deferred_note_code=note["error_code"],
                       deferred_note_params=note["error_params"])
        trigger["error"] = f"{trigger['error']}{interface_text.text('server:outcome.semicolon')}{note['error']}"
    return results, len(pending)


def _stock_due(contract) -> bool:
    """定时这一轮该不该派存量后继：本进程里还没派过，或上次派过已经满 `STOCK_INTERVAL`。"""
    last = getattr(contract, "feed_stock_planned_at", None)
    return last is None or time.monotonic() - last >= STOCK_INTERVAL.total_seconds()


def w_feed_check(contract, body) -> dict:
    """拉一轮订阅。不带参数只拉到期的源，`all` 拉全部启用的源。

    定时那一跳没有到期的源就什么也不起：每半小时一跳（`feeds.TICK_MINUTES`），任务中心
    不该每半小时多一行空跑。定时那一跳也顺带给「想要」查资源：有到期的才起一轮，与订阅源到没到期无关。
    """
    if body.get("automatic") and not body.get("background"):
        # 续跑的那一次带 `background`，跑在订阅源任务的恢复上下文里，不顺带起别的任务。
        web_wants.start_search(contract)
    if body.get("automatic") and "sources" not in body and not body.get("all"):
        with contract.database.read_connection() as connection:
            if not feeds.due_sources(connection):
                return {"ok": True, "idle": True, "checked": 0, "total": 0, "results": []}
    finished = threading.Event()
    request_id = uuid.uuid4().hex

    def work(job_id):
        try:
            result = _execute_check(contract, body, job_id)
            contract.feed_job.update(job_id, **result, status="complete",
                                     current=None, completed_at=time.time())
            # 「想要」里取不到资料或封面的，跟着派存量的那几轮再试（隔 `web_wants.RETRY_AFTER`）。
            if result["stock"]:
                web_wants.start_scrape(contract, trigger="scheduled" if body.get("automatic") else "manual")
        finally:
            finished.set()

    started = contract.feed_job.start(
        work, restart=True,
        trigger="scheduled" if body.get("automatic") else "manual",
        recovery={**{key: body[key] for key in ('sources', 'all', 'automatic') if key in body}, 'background': True},
        initial={"ok": True, "checked": 0, "total": 0, "results": [], "added": 0,
                 "request_id": request_id, "current": None})
    if body.get("background") or started.get('waiting_for_update'):
        return started
    if started["request_id"] != request_id:
        return {"ok": False, "busy": True, "checked": 0, "results": []}
    # 到期还没跑完（多半在任务中心被暂停了）就先回现状，`status` 仍是 running；见 `CHECK_WAIT_SECONDS`。
    finished.wait(CHECK_WAIT_SECONDS)
    return contract.feed_job.snapshot() or started


def q_feed_check(contract, args) -> dict:
    return contract.feed_job.snapshot() or {"status": "idle"}


def q_feed_schedule(contract, _args) -> dict:
    """订阅源定时拉取的档位与上次运行状态，形状与 `/api/follow/schedule` 相同。"""
    scheduler = contract.feed_scheduler
    if scheduler is None:
        return {"ok": True, "available": False, "enabled": False,
                "interval_minutes": feeds.DEFAULT_INTERVAL_MINUTES, "running": False, "next_run_at": None}
    return scheduler.status()


def w_feed_schedule(contract, body) -> dict:
    """订阅源定时拉取的开关与每个源的间隔，校验与关注那一份同一套（15 分钟到一周）。"""
    scheduler = contract.feed_scheduler
    if scheduler is None:
        raise UserValueError("api.feeds.scheduleDisabled")
    return scheduler.update(
        enabled=body.get("enabled", True),
        interval_minutes=body.get("interval_minutes", feeds.DEFAULT_INTERVAL_MINUTES),
    )


def w_feed_schedule_run(contract, _body) -> dict:
    """让订阅源定时拉取立刻跑一轮，结果照常记进调度状态。"""
    scheduler = contract.feed_scheduler
    if scheduler is None:
        raise UserValueError("api.feeds.scheduleDisabled")
    return scheduler.run_now()


def q_feeds(contract, args) -> dict:
    """设置页「订阅源」小节的首屏。"""
    with contract.database.read_connection() as connection:
        register_listed(contract, connection)
        rows = feeds.sources(connection)
        # 表里名字前面那个圆框：有图走 `/entity-image`，判据与取景都取自身份引用那一份。
        for row in rows:
            ref = web_catalog.entity_ref(contract, "performer", row["entity_id"], row["name"])
            row["has_image"] = ref["has_image"]
            row["image_version"] = ref.get("image_version", "")
            row["avatar_focus"] = ref.get("avatar_focus")
        pending = connection.execute(
            "SELECT count(*) FROM feed_discovery d WHERE d.ignored_at IS NULL"
            f" AND d.read_at IS NULL AND {' AND '.join(LISTED)}").fetchone()[0]
    return {"ok": True, "sources": rows, "unread": int(pending or 0)}


def w_feed_source(contract, body) -> dict:
    """订阅的移除与开关、人物页的「订阅新作」，以及订阅源页签按名字订。

    这里不收页面送来的地址：地址由服务端按这位的 JavDB 身份现拼，按名字订时页面送的也只是
    她在站上的演员 id（ADR-0047、ADR-0083）。
    """
    action = str(body.get("action") or "")
    if action == "remove":
        source_id = body.get("id")
        if not isinstance(source_id, int):
            raise ValueError("id must be an integer feed source id")
        with contract.database.write_transaction() as connection:
            feeds.remove_source(connection, source_id)
        return {"ok": True, "removed": source_id}
    if action == "enabled":
        source_id, enabled = body.get("id"), body.get("enabled")
        if not isinstance(source_id, int) or not isinstance(enabled, bool):
            raise ValueError("id must be an integer and enabled must be a boolean")
        with contract.database.write_transaction() as connection:
            feeds.set_enabled(connection, source_id, enabled)
        return {"ok": True, "source": source_id, "enabled": enabled}
    if action == "follow":
        return _follow_entity(contract, body)
    if action == "follow-name":
        return _follow_by_name(contract, body)
    raise ValueError(f"unknown feed source action: {action}")


def subscribe_performer(connection, entity_id: int, canonical_name: str) -> list[int]:
    """这位的每个 JavDB 演员页与 DMM 片单各订一条，返回源 id。地址按账本里她的编号现拼。"""
    refs = [dict(ref) for ref in connection.execute(
        "SELECT provider,external_kind,external_id,metadata_json FROM entity_external_ref"
        " WHERE entity_id=?", (int(entity_id),))]
    pages = [*entry_links.javdb_actor_pages(canonical_name, refs),
             *feeds.dmm_actress_pages(connection, entity_id)]
    if not pages:
        raise UserValueError("api.feeds.noSourceIds")
    return feeds.follow_entity(connection, entity_id, pages)


def fetch_new_sources(contract, ids: list[int]) -> None:
    """新订的当场在后台拉：订的人要的是马上看到她有哪些新作，不是等下一轮到期扫描。

    已有一轮在跑时就交给那一轮之后的到期扫描——新源 `next_fetch_at` 为空，下一轮一定带上它。
    """
    contract.cache_bust()
    if ids:
        try:
            w_feed_check(contract, {"sources": ids, "background": True})
        except TaskRunConflict:
            pass


def _follow_entity(contract, body) -> dict:
    """人物页「订阅新作」开关。地址按这位的 JavDB 演员页现拼，不收页面传来的地址。"""
    entity_id, enabled = body.get("entity_id"), body.get("enabled")
    if not isinstance(entity_id, int) or not isinstance(enabled, bool):
        raise ValueError("entity_id must be an integer and enabled must be a boolean")
    with contract.database.write_transaction() as connection:
        entity_id = entities.resolve_entity_id(connection, entity_id) or entity_id
        row = connection.execute(
            "SELECT canonical_name FROM entity WHERE id=? AND kind='performer'",
            (entity_id,)).fetchone()
        if row is None:
            raise UserValueError("api.feeds.performerMissing")
        if not enabled:
            feeds.unfollow_entity(connection, entity_id)
            ids: list[int] = []
        else:
            ids = subscribe_performer(connection, entity_id, row["canonical_name"])
    fetch_new_sources(contract, ids)
    return {"ok": True, "entity_id": entity_id, "following": enabled, "sources": ids}


#: 订阅源页签按名字订的那条路写下的来源：新建的实体与绑上的演员 id 都记这一个，
#: 回溯「这位是谁登记的」时一眼看得出是用户当场点选的，不是自动后继猜的。
FOLLOW_SOURCE = "user:feed-follow"

#: JavDB 演员 id 的写法。页面送来的 id 只认这一种，拼出的地址才一定还在演员页那一档。
ACTOR_ID = re.compile(r"^[A-Za-z0-9]{1,16}$")

#: 搜索页的超时。它比演员页小，体积上限沿用演员页那一档。
LOOKUP_TIMEOUT = 20.0


def q_feed_lookup(contract, args) -> dict:
    """按女优名到 JavDB 搜演员卡，列出候选；只查不写（ADR-0083）。

    每张卡带站内 id、标题一栏的全部写法与记录类型，再对一遍账本：这个 id 已经在谁名下
    （`held_by`），卡上哪个写法是账本里某位的正名或别名（`matched`）。名字对得上、又只有
    一个人的那几张先勾上（`suggested`）；同名不止一位时一张都不替用户挑。
    """
    name = entities.canonicalize_entity_name("performer", str(args.get("q") or ""))
    if not name:
        raise UserValueError("api.feeds.nameRequired")
    url = javdb.SEARCH.format(quote(name))
    with contract.database.read_connection() as connection:
        # 账本里按这个名字认得出谁：登记时没人持有所勾的卡就挂到她名下（`_follow_by_name`），
        # 页面提前把这句话说出来，免得点了才知道挂给了谁。
        found = entities.resolve_entity(connection, "performer", name)
        known = _known_performer(connection, found) if found else None
    try:
        html = _search_javdb(contract, url)
    except ValueError as error:
        # 她已有 JavDB 或 DMM 编号时不必靠这一趟搜索，按库里的她直接订；原因照样告诉页面。
        if known and known["subscribable"]:
            return {"ok": True, "q": name, "url": url, "candidates": [], "suggested": [],
                    "known": known, "unavailable": str(error),
                    **({"unavailable_code": error.code, "unavailable_params": dict(error.params)}
                       if isinstance(error, UserFacingError) else {})}
        raise
    cards = javdb.search_cards(html)
    wanted = alias.match_key(name)
    with contract.database.read_connection() as connection:
        candidates = [_describe_card(connection, card) for card in cards]
    mine = [card for card in cards
            if any(alias.match_key(written) == wanted for written in card["names"])]
    suggested = [card["id"] for card in mine] if javdb.one_person(mine) else []
    return {"ok": True, "q": name, "url": url, "candidates": candidates, "suggested": suggested,
            "known": known}


def _search_javdb(contract, url: str) -> str:
    """取一页 JavDB 演员搜索结果；冷却、限流、断网、登入页都按原因报 ValueError。"""
    from .sources.javdb import SEARCH_LIMITER
    SEARCH_LIMITER.wait(url)
    try:
        response = _transport(contract)(HttpRequest("GET", url, {"Accept": "text/html"}),
                                        LOOKUP_TIMEOUT, FETCH_MAX_BYTES)
    except Exception as error:  # noqa: BLE001 - 冷却、限流还是断网，原因原样交给页面
        raise UserValueError("api.feeds.javdbSearchFailed", {"error": str(error)}) from error
    if response.status != 200:
        raise UserValueError("api.feeds.javdbHttpStatus", {"status": response.status})
    html = response.body.decode("utf-8", "replace")
    if javdb.LOGIN.search(html):
        raise UserValueError("api.feeds.javdbSearchLogin")
    return html


def subscribable(connection, row) -> bool:
    """这位不经搜索就能订：已有 JavDB 演员页或 DMM 女优编号。"""
    entity_id = int(row["id"])
    refs = [dict(ref) for ref in connection.execute(
        "SELECT provider,external_kind,external_id,metadata_json FROM entity_external_ref"
        " WHERE entity_id=?",
        (entity_id,))]
    return bool(entry_links.javdb_actor_pages(str(row["canonical_name"]), refs)
                or feeds.dmm_actress_ids(connection, entity_id))


def _known_performer(connection, row) -> dict:
    """库里认出的这位：能不能直接订、订没订着。"""
    entity_id = int(row["id"])
    return {"id": entity_id, "name": str(row["canonical_name"]),
            "subscribable": subscribable(connection, row),
            "following": feeds.entity_following(connection, entity_id)}


def create_followed_performer(connection, name: str) -> int:
    """为订阅新建一位零作品的女优，来源记 `FOLLOW_SOURCE`。"""
    stamp = feeds.stamp()
    return int(connection.execute(
        "INSERT INTO entity(kind,canonical_name,normalized_name,metadata_json,"
        "created_at,updated_at) VALUES('performer',?,?,?,?,?)",
        (name, entities.normalize_entity_name(name),
         json.dumps({"source": FOLLOW_SOURCE}, ensure_ascii=False), stamp, stamp)).lastrowid)


def _describe_card(connection, card: dict) -> dict:
    held = connection.execute(
        "SELECT e.id,e.canonical_name FROM entity_external_ref r JOIN entity e ON e.id=r.entity_id"
        " WHERE r.provider='javdb' AND r.external_kind='performer' AND r.external_id=?",
        (card["id"],)).fetchone()
    matched: list[dict] = []
    for written in card["names"]:
        key = entities.normalize_entity_name(written)
        if not key:
            continue
        for row in connection.execute(
                "SELECT id,canonical_name FROM entity WHERE kind='performer' AND normalized_name=?"
                " UNION SELECT e.id,e.canonical_name FROM entity_alias a"
                " JOIN entity e ON e.id=a.entity_id"
                " WHERE e.kind='performer' AND a.normalized_alias=? ORDER BY 1", (key, key)):
            if all(int(row[0]) != found["id"] for found in matched):
                matched.append({"id": int(row[0]), "name": str(row[1])})
    return {"id": card["id"], "names": card["names"], "record": card["record"],
            "url": f"{javdb.BASE}actors/{card['id']}",
            "held_by": {"id": int(held[0]), "name": str(held[1])} if held else None,
            "matched": matched}


def _follow_by_name(contract, body) -> dict:
    """订阅源页签「添加 JAV 订阅」：勾选的演员卡登记到这位名下，再订上她的演员页（ADR-0083）。

    这位是谁按这个顺序定：卡上的 id 已经在账本里谁名下就是谁；都没主时按名字认账本里
    的正名或唯一别名；还认不出就新建一位。几张卡分属不同的人时拒绝，让用户先去合并。
    新建的实体与绑上的 id 都记 `FOLLOW_SOURCE`；卡上的其他写法不写进别名，那是资料后继的事。
    """
    name = entities.canonicalize_entity_name("performer", str(body.get("name") or ""))
    if not name:
        raise UserValueError("api.feeds.nameEmpty")
    raw = body.get("ids")
    ids = [value for value in (raw if isinstance(raw, list) else [])
           if isinstance(value, str) and ACTOR_ID.match(value)]
    if not ids:
        raise UserValueError("api.feeds.cardRequired")
    with contract.database.write_transaction() as connection:
        holders: dict[int, str] = {}
        for actor_id in ids:
            held = connection.execute(
                "SELECT e.id,e.canonical_name FROM entity_external_ref r"
                " JOIN entity e ON e.id=r.entity_id WHERE r.provider='javdb'"
                " AND r.external_kind='performer' AND r.external_id=?", (actor_id,)).fetchone()
            if held is not None:
                holders[int(held[0])] = str(held[1])
        if len(holders) > 1:
            raise UserValueError("api.feeds.cardsSpanPeople", {"names": "、".join(holders.values())})
        created = False
        if holders:
            [(entity_id, canonical)] = holders.items()
        else:
            found = entities.resolve_entity(connection, "performer", name)
            if found is not None:
                entity_id, canonical = int(found["id"]), str(found["canonical_name"])
            else:
                entity_id = create_followed_performer(connection, name)
                canonical, created = name, True
        for actor_id in ids:
            performer_profile_followup.bind(connection, entity_id, "javdb", actor_id,
                                            {"source": FOLLOW_SOURCE})
        sources = subscribe_performer(connection, entity_id, canonical)
    fetch_new_sources(contract, sources)
    return {"ok": True, "entity_id": entity_id, "entity_name": canonical, "created": created,
            "sources": sources}


#: 列表一次给多少条。首页那一块只放一行，人物页给一屏。
DISCOVERY_LIMIT = 24

#: 哪些壳算「新作」。已经入库的不算——那条新作的使命已经完成了；设置里收起的那几类
#: 合集不算（`feeds.compilation_kind`）；还没发售、官方只回占位图的不算
#: （`feed_followup.awaiting_official_cover`）。三条都是读的时候现算。
#: 用到它的连接要先 `register_listed`。
#: 已入库那一条写成不相关子查询：库里的番号键只算一遍、建成临时索引，每条壳再去查它。
#: 相关子查询的写法要给每条壳把整张 `asset` 的番号重算一遍（60 条壳 × 2881 部是 486ms），
#: 资料页的形状名单和新作列表都等在它上面。判空与 `=` 一致：键算不出来的壳照常列出。
#: 标「已消失」的行不算入库（ADR-0087），同 `feeds.in_library`。
LISTED = (
    "(normalise_code_key(d.code) IS NULL OR normalise_code_key(d.code) NOT IN"
    " (SELECT key FROM (SELECT normalise_code_key(a.code) AS key FROM asset a"
    " WHERE a.medium='video' AND a.code IS NOT NULL AND COALESCE(a.disposal,'')<>'vanished') WHERE key IS NOT NULL))",
    "NOT is_feed_hidden(d.title,d.performers,d.studio)",
    "NOT is_cover_pending(d.code,d.release_date)",
)


def register_listed(contract, connection) -> None:
    """挂上 `LISTED` 用到的两个函数：合集收起按设置，「官方还没出图」按本机封面与取图记录。"""
    feeds.register_functions(connection, web_settings.hidden_compilations(contract.database))
    connection.create_function("is_cover_pending", 2, lambda code, release_date:
        feed_followup.awaiting_official_cover(contract, code, release_date))


def _discovery_performers(connection, contract, rows) -> dict[int, list[dict]]:
    """新作出演名单按已有身份解析，头像契约与馆藏卡片共用。"""
    from .web_jav_discovery import _cached_movie
    from .web_jav_detail import discovery_cover_url, source_performer_refs, visible_actors
    names = {name.strip() for row in rows
             for name in re.split(r"[,，、;/]", row["performers"] or "") if name.strip()}
    identities = {name: entities.resolve_entity(connection, "performer", name) for name in names}
    excluded = entities.male_performer_ids(connection)
    identities = {name: found for name, found in identities.items()
                  if found is None or found['id'] not in excluded}
    identity_refs = {int(found["id"]): web_catalog.entity_ref(
        contract, "performer", int(found["id"]), found["canonical_name"])
        for found in identities.values() if found}
    performers = {}
    for row in rows:
        source = _cached_movie(row['code'], contract)
        row['cover_url'] = discovery_cover_url(row, source)
        if 'actors' in source:
            refs = source_performer_refs(contract, connection, visible_actors(connection, source, excluded))
            performers[int(row['id'])] = refs
            row['performers'] = '、'.join(ref['name'] for ref in refs)
            continue
        refs = []
        row['performers'] = '、'.join(name.strip() for name in re.split(r"[,，、;/]", row['performers'] or '')
                                   if name.strip() in identities)
        for name in re.split(r"[,，、;/]", row["performers"] or ""):
            found = identities.get(name.strip())
            if found and found["id"] not in {ref["id"] for ref in refs}:
                refs.append(identity_refs[int(found["id"])])
            elif not found and name.strip() in identities and not any(ref['name'] == name.strip() for ref in refs):
                refs.append({'id': None, 'name': name.strip(), 'has_image': False})
        performers[int(row["id"])] = refs
        row['performers'] = '、'.join(ref['name'] for ref in refs)
    return performers


def cover_state_fields(states: dict, code: str) -> dict:
    """新作卡封面格的字段：`cover_state`（`fetching`／`queued`／`missing`，有封面时为 None）与原因
    （`feed_followup.cover_state_fields`）。首页这一行和 JAV 页「新作」「发现」两个分区共用同一份口径。"""
    return feed_followup.cover_state_fields(states, code)


def q_feed_discoveries(contract, args) -> dict:
    """未入库的新作。`entity` 限定到某个人，`state` 切换忽略视图。

    「已入库」是现算的：壳上不存这个布尔，它的真相在 `asset` 那一侧（ADR-0042 第三条）。
    """
    entity_id = args.get("entity")
    state = str(args.get("state") or "active")
    try:
        limit = min(int(args.get("limit") or DISCOVERY_LIMIT), 100)
    except (TypeError, ValueError):
        limit = DISCOVERY_LIMIT
    where = list(LISTED)
    params: list[object] = []
    if state == "ignored":
        where.append("d.ignored_at IS NOT NULL")
    elif state != "all":
        where.append("d.ignored_at IS NULL")
    if entity_id:
        where.append("EXISTS (SELECT 1 FROM feed_discovery_entity de"
                     " WHERE de.discovery_id=d.id AND de.entity_id=?)")
        with contract.database.read_connection() as connection:
            params.append(entities.resolve_entity_id(connection, int(entity_id)) or int(entity_id))
    with contract.database.read_connection() as connection:
        register_listed(contract, connection)
        rows = [dict(row) for row in connection.execute(
            "SELECT d.*, s.name AS source_name, s.kind AS source_kind"
            " FROM feed_discovery d LEFT JOIN feed_source s ON s.id=d.source_id"
            f" WHERE {' AND '.join(where)}"
            " ORDER BY COALESCE(d.release_date,d.discovered_at) DESC, d.id DESC"
            " LIMIT ?", (*params, limit + 1)).fetchall()]
        studios = {name: _studio_name(connection, name)
                   for name in {row["studio"] for row in rows[:limit]} if name}
        wanted = wants.wanted_keys(connection, (normalise_code_key(row["code"]) for row in rows[:limit]))
        performers = _discovery_performers(connection, contract, rows[:limit])
    more = len(rows) > limit
    # 最近一轮新作资料采集或新作封面采集里封面断在连接上的部数。只看最近这一轮：换了线路之后
    # 下一轮取到，提示就该跟着消失，而不是让一次旧故障一直挂在页面上。
    last = [run for task_key in (feed_followup.TASK_KEY, feed_followup.COVER_TASK_KEY)
            for run in contract.task_runs.query(status="succeeded", task_key=task_key, limit=1)]
    latest = max(last, key=lambda run: run.finished_at or "", default=None)
    cover_network = int(latest.result_summary.get("cover_network") or 0) if latest else 0
    # 还没有封面的那几部，封面格说清在等什么、为什么没有（`cover_states`）。
    states = feed_followup.cover_states(contract, rows[:limit])
    return {"ok": True, "more": more, "cover_network": cover_network, "items": [{
        "id": int(row["id"]),
        "code": row["code"],
        "title": row["title"],
        "link": row["link"],
        "cover_url": row["cover_url"],
        # 本机封面与它的两份边车，形状和资产卡的同名字段一致，页面按同一套取景。
        "has_cover": contract.has_cover(row["code"]),
        **cover_state_fields(states, row["code"]),
        "cover_frame": contract.cover_frame(row["code"]),
        "cover_version": contract.cover_version(row["code"]),
        "poster_box": contract.poster_box(row["code"]),
        "release_date": row["release_date"],
        "studio": studios.get(row["studio"], row["studio"]),
        "performers": row["performers"],
        "performer_refs": performers[int(row["id"])],
        "source_name": row["source_name"],
        "read": bool(row["read_at"]),
        "ignored": bool(row["ignored_at"]),
        "wanted": normalise_code_key(row["code"]) in wanted,
        "scrape_error": row["scrape_error"],
    } for row in rows[:limit]]}


def home_has_feed(contract, connection) -> bool:
    """首页新作行是否有内容，与新作列表共用 `LISTED` 与未忽略。"""
    register_listed(contract, connection)
    return bool(connection.execute(
        "SELECT EXISTS(SELECT 1 FROM feed_discovery d"
        f" WHERE d.ignored_at IS NULL AND {' AND '.join(LISTED)})").fetchone()[0])


def feed_row_entity_ids(contract, connection) -> set[int]:
    """资料页上会出现新作那一行的实体：判据和按人取新作的那一份同一套（`LISTED`、未忽略）。"""
    register_listed(contract, connection)
    return {int(row[0]) for row in connection.execute(
        "SELECT DISTINCT de.entity_id FROM feed_discovery_entity de"
        " JOIN feed_discovery d ON d.id=de.discovery_id"
        f" WHERE d.ignored_at IS NULL AND {' AND '.join(LISTED)}")}


def _studio_name(connection, name: str) -> str:
    """来源给的厂牌名换成账本里那个厂牌的规范名，和资产卡上写的是同一个。

    壳上存的是来源原文（多半是日文），投影现算、不回写：壳没有真相字段，认不出或撞名
    就照原文显示。
    """
    found = entities.resolve_entity(connection, "studio", name)
    return found["canonical_name"] if found is not None else name


#: 允许的状态动作。已读与忽略彼此正交，各写各的列，都不改变去重（ADR-0042 第五条）。
ACTIONS = {"read": ("read_at", True), "unread": ("read_at", False),
           "ignore": ("ignored_at", True), "unignore": ("ignored_at", False)}

#: 「想要」与取消想要：写的是 `want_item`，不是壳上的列。忽略与想要互斥，两边都由 `wants` 收口。
WANT_ACTIONS = ("want", "unwant")


def _want(connection, action: str, ids: list[int]) -> int:
    if action == "want":
        return sum(int(wants.add_feed(connection, value)["created"]) for value in ids)
    marks = ",".join("?" for _ in ids)
    codes = [row[0] for row in connection.execute(
        f"SELECT code FROM feed_discovery WHERE id IN ({marks})", ids)]
    return wants.drop_codes(connection, codes)


def w_feed_discovery(contract, body) -> dict:
    """把一条或几条新作标成已读/未读、忽略/取消忽略、想要/取消想要。幂等。"""
    action = str(body.get("action") or "")
    if action not in ACTIONS and action not in WANT_ACTIONS:
        raise ValueError(f"unknown feed discovery action: {action}")
    raw = body.get("ids")
    ids = [value for value in (raw if isinstance(raw, list) else [raw])
           if type(value) is int]
    if not ids:
        raise ValueError("ids must be a nonempty list of feed discovery ids")
    if action in WANT_ACTIONS:
        with contract.database.write_transaction() as connection:
            affected = _want(connection, action, ids)
        contract.cache_bust()
        if action == "want":
            web_wants.start_scrape(contract)
        return {"ok": True, "action": action, "affected": affected}
    column, setting = ACTIONS[action]
    value = feeds.stamp() if setting else None
    marks = ",".join("?" for _ in ids)
    with contract.database.write_transaction() as connection:
        cursor = connection.execute(
            f"UPDATE feed_discovery SET {column}=? WHERE id IN ({marks})",
            (value, *ids))
        if action == "ignore":
            _want(connection, "unwant", ids)
    contract.cache_bust()
    return {"ok": True, "action": action, "affected": int(cursor.rowcount or 0)}
