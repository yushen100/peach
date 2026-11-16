"""实体链接管理：库里有哪些外链，以及它们现在还打不打得开。

从 `web_contract` 拆出，理由和资源对账一样：这一域自己持有检查线程的状态和网络往返，
和浏览、复核没有共享逻辑。

为什么资料页需要这么一块管理面：链接是**别人服务器上的东西**，会在我们不知情的时候烂掉。
2026-09-01 实测 719 条里 152 条打不开，其中 84 条 official 是 404——而它们在资料页上
和好链接长得一模一样，只有点下去才知道。检查这件事必须能随时重跑，不能是一次性脚本。

`gone` 与 `unclear` 必须分开，这是这块面板最重要的一条：`linktr.ee` 回 403 是挡爬虫、
`x.com` 回 500 是临时错误，链接本身好好的。按「非 200 就删」会连它们一起删掉。
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Protocol
from urllib.parse import urlsplit

import httpx

from . import interface_text, link_status, studio_sites
from .coded_text import coded
from .jobs import BackgroundJob

from .user_agent import USER_AGENT
from .user_messages import UserInterruptedError, UserValueError, error_fields, message_fields
#: 「这个页面没了」——只有上游明确这么说，才够格作为删除依据。
GONE_STATUSES = frozenset({404, 410})
#: 「暂时打不开」：连不上或超时（状态 0）、限流与临时服务故障。过一会儿多半就好，一趟检查里自动再问几轮；
#: 站点拒绝爬虫（403 之类）不在此列，再问也是同一个答案，留给人勾选重试。
TEMPORARY_STATUSES = frozenset({408, 425, 429, 500, 502, 503, 504})
#: 一趟检查跑完后，暂时打不开的链接再验几轮；每轮之前等多少个检查间隔（默认约 30 秒）。
RECHECK_ROUNDS = 2
RECHECK_PAUSE_INTERVALS = 120
CHECK_TIMEOUT = 12.0
CHECK_INTERVAL = 0.25


class LinkContract(Protocol):
    """链接管理需要契约提供的能力；比整个 WebContract 小得多。"""

    db_path: Path
    link_check: BackgroundJob
    link_prune_job: BackgroundJob

    def read_connection(self): ...

    def write_transaction(self): ...

    def has_entity_image(self, kind: str, entity_id: int) -> bool: ...

    def entity_image_version(self, kind: str, entity_id: int) -> str: ...

    def avatar_focus(self, kind: str, entity_id: int): ...


def _probe(url: str, timeout: float = CHECK_TIMEOUT) -> tuple[int, str]:
    """(status, 说明)。status 为 0 表示连都没连上；停放页的说明里写停放依据。

    每个请求新建 client 并立刻关掉：这批地址分布在上百个互不相同的主机上，其中不少
    连不上，而失败的连接会在共享池里漏掉槽位，几十个请求之后一切都变成 PoolTimeout。
    """
    def get(target: str) -> httpx.Response:
        from .peach_proxy import http_client
        with http_client(follow_redirects=True, timeout=timeout,
                          limits=httpx.Limits(max_connections=4,
                                              max_keepalive_connections=0)) as client:
            return client.get(target, headers={"User-Agent": USER_AGENT})

    try:
        response = get(url)
    except Exception as error:
        return 0, (studio_sites.parked_after_certificate_error(url, error, get)
                   or type(error).__name__)
    if response.status_code == 200:
        return 200, studio_sites.response_parked_reason(response)
    return response.status_code, ""


def link_verdict(status: int, note: str) -> str:
    """ok / gone / unclear。

    取不到不等于没了。实测反例：`linktr.ee` 403（Linktree 挡爬虫，浏览器里能开）、
    `facebook.com` 400、`x.com` 500（临时错误，账号还在）、连接失败与超时。
    把它们并进 gone，删除时就会连好链接一起删。

    停放页反过来：200 也是没了。域名过期后被停放平台接走，页面照样打得开，内容却已
    不是这个人或这家公司的。
    """
    if note.startswith(studio_sites.PARKED_NOTE):
        return "gone"
    if status == 200:
        return "ok"
    if status in GONE_STATUSES:
        return "gone"
    return "unclear"


def temporary_failure(status: int, note: str) -> bool:
    """取不到、但看起来是暂时的：连不上、超时、限流或临时服务故障。确证没了（`link_verdict` 的 gone）不算。"""
    return link_verdict(status, note) == "unclear" and (status == 0 or status in TEMPORARY_STATUSES)


def _unclear_row(row: dict, status: int, note: str, attempts: int) -> dict:
    """「取不到」那一行：带上是不是暂时的、问过几次，界面据此区分「临时故障，已重查」与「站点拒绝」。"""
    return {"id": row["id"], "entity": row["entity"], "link_kind": row["link_kind"], "label": row["label"],
            "url": row["url"], **_note(status, note),
            "temporary": temporary_failure(status, note), "attempts": attempts}


def _note(status: int, note: str) -> dict:
    """面板上那一格说明：`note`，取不到时另带 `note_code` 与 `note_params` 给界面取译文。
    停放页只写状态码就看不出为什么判了没了。"""
    if status == 200 or note.startswith(studio_sites.PARKED_NOTE):
        # 停放页那句是 `studio_sites` 给的 `Said`，身上带 code；200 的说明为空或原文。
        return coded("note", note)
    if status:
        return {"note": f"HTTP {status}"}
    params = {"reason": note}
    return {"note": interface_text.text("server:labels.webLinks.unreachable", params),
            "note_code": "labels.webLinks.unreachable", "note_params": params}


def _job_result(result: dict) -> dict:
    """接口回执写进任务状态：失败那句的 code 改放 `error_code`，`message_code` 留给进度说明。"""
    if result.get("ok", True) or "message_code" not in result:
        return result
    out = dict(result)
    return {**out, "error_code": out.pop("message_code"), "error_params": out.pop("message_params", {})}


def w_links(contract: LinkContract, args=None):
    """库里链接的现状。纯读库，随页面一起加载，不联网。"""
    with contract.read_connection() as connection:
        rows = [dict(row) for row in connection.execute(
            "SELECT l.id, l.link_kind, l.label, l.url, l.hostname, e.kind AS entity_kind, "
            "e.canonical_name AS entity, e.id AS entity_id "
            "FROM entity_link l JOIN entity e ON e.id=l.entity_id "
            "ORDER BY e.kind, e.canonical_name, l.link_kind")]
    by_kind: dict[str, int] = {}
    by_entity_kind: dict[str, int] = {}
    hosts: dict[str, int] = {}
    host_link_ids: dict[str, int] = {}
    for row in rows:
        by_kind[row["link_kind"]] = by_kind.get(row["link_kind"], 0) + 1
        by_entity_kind[row["entity_kind"]] = by_entity_kind.get(row["entity_kind"], 0) + 1
        host = row["hostname"] or urlsplit(row["url"]).hostname or ""
        if host:
            hosts[host] = hosts.get(host, 0) + 1
            host_link_ids.setdefault(host, row["id"])
    top_hosts = sorted(hosts.items(), key=lambda item: (-item[1], item[0]))[:12]
    return {
        "ok": True,
        "total": len(rows),
        "entities": len({row["entity_id"] for row in rows}),
        "by_kind": by_kind,
        "by_entity_kind": by_entity_kind,
        "top_hosts": top_hosts,
        "top_host_link_ids": {host: host_link_ids[host] for host, _ in top_hosts},
    }


def _check_public(state: dict, contract: LinkContract) -> dict:
    result = {
        "ok": state["status"] != "failed",
        "status": state["status"],
        "check_id": state["check_id"],
        "checked": state["checked"],
        "total": state["total"],
        "gone": [dict(item) for item in state["gone"]],
        "unclear": [dict(item) for item in state["unclear"]],
        "scope": state.get("scope", "all"),
        **({key: state[key] for key in ("error", "error_code", "error_params") if key in state}
           if state["status"] == "failed" else {}),
    }
    items = result['gone'] + result['unclear']
    if items:
        from .web_catalog import entity_ref
        with contract.read_connection() as connection:
            refs = {row['id']: dict(row) for row in connection.execute(
                'SELECT l.id, e.id AS entity_id, e.kind, e.canonical_name '
                'FROM entity_link l JOIN entity e ON e.id=l.entity_id')}
        faces = {}
        for item in items:
            ref = refs.get(item['id'])
            if ref:
                key = (ref['kind'], ref['entity_id'])
                if key not in faces:
                    faces[key] = entity_ref(contract, *key, ref['canonical_name'])
                item.update(entity=ref['canonical_name'], entity_id=ref['entity_id'], entity_kind=ref['kind'], face=faces[key])
    return result


def _run_link_check(contract: LinkContract, check_id: str,
                    link_ids: list[int] | None = None) -> None:
    """逐条联网重验。异常由 `BackgroundJob` 翻成 `failed` 状态，这里不再自己接。

    给了 `link_ids` 就只验点名的那几条，别的链接的判定由调用方原样带进初始状态。
    """
    job = contract.link_check
    previous = job.snapshot() or {}
    completed = set(previous.get('completed_links') or [])
    if 'link_ids' in previous:
        link_ids = previous['link_ids']
    # 已标记失效的不再验：结论已经落账，每次都去敲一个停放域名只会招来杀毒软件告警。
    query = ("SELECT l.id, l.link_kind, l.label, l.url, e.canonical_name AS entity "
             "FROM entity_link l JOIN entity e ON e.id=l.entity_id "
             f"WHERE {link_status.live_clause()}")
    with contract.read_connection() as connection:
        if link_ids is None:
            rows = [dict(row) for row in connection.execute(query + " ORDER BY l.id")]
        else:
            # 点名的链接可能在上一次检查之后已经被删掉；查不到就是不必再验。
            marks = ",".join("?" * len(link_ids))
            rows = [dict(row) for row in connection.execute(
                f"{query} AND l.id IN ({marks}) ORDER BY l.id", link_ids)]
    with job.editing(check_id) as state:
        if state is None:
            return
        state["total"] = len(rows)
    if not job.checkpoint(check_id, link_ids=[row['id'] for row in rows]):
        raise UserInterruptedError("errors.webLinks.checkStopped")
    for row in rows:
        if row['id'] in completed:
            continue
        if job.snapshot() is None:
            raise UserInterruptedError("errors.webLinks.checkStopped")
        status, note = _probe(row["url"])
        verdict = link_verdict(status, note)
        with job.editing(check_id) as state:
            if state is None:
                return   # 被新的检查顶掉了，安静收工
            state['gone'] = [item for item in state['gone'] if item['id'] != row['id']]
            state['unclear'] = [item for item in state['unclear'] if item['id'] != row['id']]
            if verdict != 'unclear':
                completed.add(row['id'])
            state["checked"] = len(completed)
            if verdict == "gone":
                state["gone"].append({"id": row["id"], "entity": row["entity"], "link_kind": row["link_kind"],
                                      "label": row["label"], "url": row["url"], **_note(status, note)})
            elif verdict == "unclear":
                state["unclear"].append(_unclear_row(row, status, note, 1))
        snapshot = job.snapshot() or {}
        if not job.checkpoint(check_id, completed_links=sorted(completed), checked=len(completed),
                              total=len(rows), gone=snapshot.get('gone', []), unclear=snapshot.get('unclear', [])):
            raise UserInterruptedError("errors.webLinks.checkStopped")
        time.sleep(CHECK_INTERVAL)
    _recheck_temporary(job, check_id, completed, {row['id'] for row in rows}, len(rows),
                       int(previous.get('recheck_round') or 0))
    job.update(check_id, checked=len(rows), status="complete", completed_at=time.time())


def _recheck_temporary(job, check_id: str, completed: set, probed: set, total: int, done_rounds: int) -> None:
    """这一趟验过（`probed`）、暂时打不开的链接隔一会儿自动再验，最多 `RECHECK_ROUNDS` 轮；好了就从结果里
    摘掉，确证没了才进 gone，还是打不开的留在 unclear 并记下问过几次。只重验了几条时，别的结论原样不动。
    续跑从上次做完的那一轮之后接着。"""
    for round_index in range(done_rounds, RECHECK_ROUNDS):
        pending = [dict(item) for item in (job.snapshot() or {}).get('unclear', [])
                   if item.get('temporary') and item['id'] in probed]
        if not pending:
            return
        for _ in range(RECHECK_PAUSE_INTERVALS):
            if job.snapshot() is None:
                raise UserInterruptedError("errors.webLinks.checkStopped")
            time.sleep(CHECK_INTERVAL)
        for item in pending:
            if job.snapshot() is None:
                raise UserInterruptedError("errors.webLinks.checkStopped")
            status, note = _probe(item["url"])
            verdict = link_verdict(status, note)
            with job.editing(check_id) as state:
                if state is None:
                    return
                state['unclear'] = [row for row in state['unclear'] if row['id'] != item['id']]
                if verdict == "gone":
                    state['gone'].append({key: item[key] for key in ("id", "entity", "link_kind", "label", "url")}
                                         | _note(status, note))
                elif verdict == "unclear":
                    state['unclear'].append(_unclear_row(item, status, note, int(item.get('attempts') or 1) + 1))
                if verdict != "unclear":
                    completed.add(item['id'])
                state["checked"] = len(completed)
            time.sleep(CHECK_INTERVAL)
        snapshot = job.snapshot() or {}
        if not job.checkpoint(check_id, completed_links=sorted(completed), checked=len(completed), total=total,
                              gone=snapshot.get('gone', []), unclear=snapshot.get('unclear', []),
                              recheck_round=round_index + 1):
            raise UserInterruptedError("errors.webLinks.checkStopped")


def _retry_state(state: dict, link_ids: list[int]) -> dict:
    """重验这几条时的初始状态：把它们从上一次的结论里摘掉，别的原样留着。

    留着是重点。「取不到」多半是站点挡爬虫或一次抖动，值得单独再问一次，但重问几条
    不该让另外七百条的结论一起清零——那样每次重试都要再等好几分钟才能按删除。
    """
    targets = set(link_ids)
    return {
        "checked": 0, "total": len(link_ids), "scope": "retry",
        "gone": [dict(item) for item in state["gone"] if int(item["id"]) not in targets],
        "unclear": [dict(item) for item in state["unclear"]
                    if int(item["id"]) not in targets],
    }


def w_links_check(contract: LinkContract, body=None):
    """开始（或查询）一次死链检查。

    七百多条链接逐条联网要好几分钟，同步请求必然超时，所以和资源对账走同一套：
    `BackgroundJob` 的后台线程 + 可轮询状态。
    """
    body = body or {}
    from .job_recovery import current_job_id, read
    if current_job_id.get() and not body.get('status_only'):
        saved = read(contract.db_path, 'link-check').get('checkpoint') or {}
        return _check_public(contract.link_check.start(
            lambda check_id: _run_link_check(contract, check_id, saved.get('link_ids')),
            initial={'checked': 0, 'total': 0, 'gone': [], 'unclear': [], 'scope': 'all'},
            restart=True, recovery=body), contract)
    if body.get("status_only") is True:
        state = contract.link_check.snapshot()
        if state is None:
            return {"ok": True, "status": "idle", "check_id": "", "checked": 0,
                    "total": 0, "gone": [], "unclear": [], "scope": "all"}
        return _check_public(state, contract)

    if body.get("retry") is not None:
        state = contract.link_check.snapshot()
        if state is None or state["status"] != "complete":
            return {"ok": False, **message_fields("api.links.noCompletedCheck", key="error")}
        if body.get("check_id") != state["check_id"]:
            return {"ok": False, **message_fields("api.links.checkExpired", key="error")}
        # 只认这次结果里真有的那些行。前端传来的 id 决定要删哪几条结论，放行库里
        # 别的链接等于让一个请求把没检查过的东西也标成「已通过」。
        known = {int(item["id"]) for item in state["gone"]}
        known |= {int(item["id"]) for item in state["unclear"]}
        link_ids = [int(value) for value in body["retry"]
                    if str(value).lstrip("-").isdigit() and int(value) in known]
        if not link_ids:
            return {"ok": False, **message_fields("api.links.nothingToRetry", key="error")}
        return _check_public(contract.link_check.start(
            lambda check_id: _run_link_check(contract, check_id, link_ids),
            initial=_retry_state(state, link_ids), restart=True,
            recovery={'retry': link_ids},
        ), contract)

    return _check_public(contract.link_check.start(
        lambda check_id: _run_link_check(contract, check_id),
        initial={"checked": 0, "total": 0, "gone": [], "unclear": [], "scope": "all"},
        restart=body.get("restart") is True,
        recovery={},
    ), contract)


def _prune_selection(planned: list[dict], body: dict) -> list[dict]:
    """选择只能覆盖本次已确认失效的链接。"""
    if "ids" not in body:
        return planned
    ids = body["ids"]
    if not isinstance(ids, list) or not ids or any(type(item) is not int for item in ids):
        raise UserValueError("api.links.selectionRequired")
    requested = set(ids)
    if not requested.issubset({item["id"] for item in planned}):
        raise UserValueError("api.links.selectionOutsideCheck")
    return [item for item in planned if item["id"] in requested]


def _recheck_prune_links(planned, progress, checkpoint, resume_state):
    """保存逐条重验结果，临时无法判定的链接留待重试。"""
    saved = (resume_state or {}).get('prune_checks') or {}
    confirmed = list(saved.get('confirmed') or [])
    recovered = list(saved.get('recovered') or [])
    completed = set(saved.get('completed') or [])
    for index, item in enumerate(planned):
        if item['id'] in completed:
            continue
        if progress:
            progress(checked=index, total=len(planned), **message_fields(
                "jobMessage.webLinks.recheckProgress", {"checked": index, "total": len(planned)}))
        status, note = _probe(item['url'])
        verdict = link_verdict(status, note)
        confirmed[:] = [row for row in confirmed if row['id'] != item['id']]
        recovered[:] = [row for row in recovered if row['id'] != item['id']]
        if verdict == 'gone':
            confirmed.append({**item, **_note(status, note)})
        else:
            recovered.append(item)
        if verdict != 'unclear':
            completed.add(item['id'])
        if checkpoint and not checkpoint(prune_checks=dict(confirmed=confirmed, recovered=recovered,
                completed=sorted(completed)), checked=index + 1, total=len(planned)):
            raise UserInterruptedError("errors.webLinks.pruneStopped")
    return confirmed, recovered


def w_links_prune(contract: LinkContract, body, *, progress=None, checkpoint=None, resume_state=None):
    """删掉上一次检查判定为 gone 的链接。

    只接受**刚跑完的那一次**检查的 `check_id`：拿一份放了半天的清单去删，删的可能是
    早已改好的链接。删除前逐条重验一次，这几秒钟换的是「不会因为一次网络抖动删掉好链接」。
    """
    body = body or {}
    if body.get("confirm") is not True:
        return {"ok": False, **message_fields("api.links.confirmRequired", key="error")}
    if body.get("background"):
        job = contract.link_prune_job
        def work(job_id):
            result = w_links_prune(contract, {**body, "background": False},
                progress=lambda **fields: job.update(job_id, **fields),
                checkpoint=lambda **fields: job.checkpoint(job_id, **fields), resume_state=job.snapshot())
            job.update(job_id, **_job_result(result), status="complete" if result.get("ok") else "failed",
                       completed_at=time.time())
        return job.start(work, restart=True, initial=message_fields("jobMessage.webLinks.prunePreparing"),
                         recovery=body)
    if (resume_state or {}).get('prune_receipt'):
        return resume_state['prune_receipt']
    state = contract.link_check.snapshot()
    if state is None or state["status"] != "complete":
        return {"ok": False, **message_fields("api.links.noCompletedCheck", key="error")}
    if body.get("check_id") != state["check_id"]:
        return {"ok": False, **message_fields("api.links.checkExpired", key="error")}
    try:
        planned = _prune_selection([dict(item) for item in state["gone"]], body)
    except ValueError as error:
        return {"ok": False, **error_fields(error)}

    confirmed, recovered = _recheck_prune_links(planned, progress, checkpoint, resume_state)

    removed = marked = 0
    if progress:
        progress(checked=len(planned), total=len(planned), **message_fields(
            "jobMessage.webLinks.recheckDone", {"confirmed": len(confirmed), "recovered": len(recovered)}))
    if confirmed:
        # 整批走同一个写事务：要么这一次判定的 gone 全部落库，要么一条都不落。
        # 已隐退女优的留成失效标记，其余删除，取舍见 `link_status`。
        with contract.write_transaction() as connection:
            removed, marked = link_status.settle_gone(connection, confirmed)
    with contract.link_check.editing(body.get("check_id")) as state:
        if state is not None:
            processed = {item["id"] for item in planned}
            state["gone"] = [item for item in state["gone"] if item["id"] not in processed]
    receipt = {"ok": True, "removed": removed, "marked": marked, "recovered": len(recovered),
               "entities": len({item["entity"] for item in confirmed})}
    if checkpoint:
        checkpoint(prune_receipt=receipt)
    return receipt
