"""采集设置与有界来源连接检查；凭据只写本机。"""
import hashlib
import json
import time
import httpx

from PIL import Image

from .scraping_access import SOURCES, SourcePaused, SourceTransport, describe, save

from . import interface_text
from .coded_text import coded
from .source_checks import check_source
from .user_messages import UserValueError, failure_fields


def _kept_cover_size(target, incoming, incoming_size, installed, previous):
    """本机封面不比来源这张差时回它的尺寸；该换、或本机还没有封面时回 `None`。

    本机那张的图片角色按装它时的来源认：边车记着来源地址就按它，否则按采集日志里
    上一次成功的那条。比较口径与批处理脚本同一个 `candidate_improves`。
    """
    from .jav_cover_fetch import candidate_for, candidate_improves, candidate_quality
    if not target.is_file():
        return None
    if isinstance(installed, dict) and installed.get("source_url"):
        current = candidate_for(str(installed["source_url"]))
    else:
        current = previous[0] if previous is not None else None
    with Image.open(target) as image:
        current_size = image.size
    if candidate_improves(
            incoming, incoming_size[0] * incoming_size[1],
            candidate_quality(current), current_size[0] * current_size[1]):
        return None
    return current_size


def w_scraping_cover(contract, body):
    """仅处理用户指定且馆藏命中的番号；完整解码后才允许升级封面。"""
    from .catalog_rules import is_korean_mib_code
    from .jav_cover_fetch import MIB_NOT_JAV_CODE
    from .metadata import validate_provider_code
    code = validate_provider_code(str(body.get("code", "")))
    if is_korean_mib_code(code):
        raise UserValueError(MIB_NOT_JAV_CODE)
    with contract.database.read_connection() as connection:
        if not connection.execute("SELECT 1 FROM asset WHERE code=? LIMIT 1", (code,)).fetchone():
            raise UserValueError("api.scraping.codeNotInCollection")
    return contract.scraping_cover_job.start_result(lambda: _fetch_cover(contract, code), recovery={'code': code})


def _said(code: str, **params) -> dict:
    return {"code": code, "params": params}


def _rendered(parts: list[dict]) -> str:
    """一串段落按 zh-CN 拼成的原句，给还不认段落的读者。"""
    return "".join(interface_text.text(f"server:{part['code']}", part["params"]) for part in parts)


def _unavailable_reason(exc, network_failed: bool, statuses: set[int]) -> tuple[str, list[dict]]:
    """一次封面比较没取到图时，页面上那一格的原因键与说法（段落）：先看线路，再看来源回了什么。"""
    from .jav_cover_fetch import (CoverConnectError, HOSTS_UNREACHABLE_CODE, NO_CANDIDATES_CODE,
                                 NO_USABLE_OFFICIAL_CODES, OFFICIAL_PLACEHOLDER_ONLY_CODE)
    # 按异常的 code 认是哪一句（`jav_cover_fetch` 抛出时带的 code），不比对原文。
    code = getattr(exc, "code", None)
    if isinstance(exc, CoverConnectError):
        return "network", [_said(HOSTS_UNREACHABLE_CODE), _said("labels.webScraping.compareIncompleteMobileHint")]
    if network_failed:
        return "network", [_said("errors.webScraping.sourceConnectionFailed")]
    if statuses & {401, 403}:
        codes = "/".join(str(s) for s in sorted(statuses & {401, 403}))
        return "access_denied", [_said("errors.webScraping.sourceAccessDenied", status=codes)]
    if any(s >= 500 for s in statuses):
        return "source_error", [_said("errors.webScraping.sourceServerError")]
    if code == NO_CANDIDATES_CODE:
        return "no_candidate", [_said("errors.webScraping.noCoverCandidates")]
    return {
        OFFICIAL_PLACEHOLDER_ONLY_CODE: ("placeholder_only", [_said(OFFICIAL_PLACEHOLDER_ONLY_CODE),
                                                              _said("labels.webScraping.period")]),
        **dict.fromkeys(NO_USABLE_OFFICIAL_CODES, ("unusable_candidate", [_said("errors.webScraping.unusableCandidate")])),
    }.get(code, ("download_failed", [_said("errors.webScraping.downloadFailed")]))


#: 候选封面没过检查的几种情形，各带张数。
DIAGNOSTIC_LABELS = {
    "placeholder": "labels.webScraping.diagnosticPlaceholder", "probe_failed": "labels.webScraping.diagnosticProbeFailed",
    "invalid_image": "labels.webScraping.diagnosticInvalidImage", "too_small": "labels.webScraping.diagnosticTooSmall",
    "download_failed": "labels.webScraping.diagnosticDownloadFailed",
    "dimension_mismatch": "labels.webScraping.diagnosticDimensionMismatch",
}


def _error(code: str, **params) -> dict:
    """封面任务失败那一句：`error` 是 zh-CN 原文，`error_code` 与 `error_params` 给界面取译文。"""
    return {"error": interface_text.text(f"server:{code}", params), "error_code": code, "error_params": params}


def _result(code: str, **params) -> dict:
    """封面任务成功那一句：`result` 是 zh-CN 原文，`result_code` 与 `result_params` 给界面取译文。"""
    return {"result": interface_text.text(f"server:{code}", params), "result_code": code, "result_params": params}


def _fetch_cover(contract, code):
    from .cover_artwork import install_cover, is_user_cover
    from .jav_cover_fetch import (best_cover, HostLimitedTransport, Unavailable, dmm_portrait,
                                 fc2_cover_candidates, logged_success_evidence)
    from .review_csv import read_rows
    target = contract.cover_root / (code + ".jpg")
    # 编辑资料里换上的封面不联网替换；要换回刮削封面，在编辑资料里点「恢复刮削封面」（ADR-0165）。
    if is_user_cover(target):
        return {"ok": True, "code": code, "reason": "kept_existing", **_result("labels.webScraping.keptUserCover")}
    sidecar = target.with_suffix(".scraping.json")
    try:
        installed = json.loads(sidecar.read_text(encoding="utf-8"))
        if (time.time() - float(installed["checked_at"]) < 86400 and target.is_file()
                and hashlib.sha256(target.read_bytes()).hexdigest() == installed["raw_sha256"]):
            return {"ok": True, "code": code, **_result(
                "labels.webScraping.reusedCover", width=installed["width"], height=installed["height"]), **{
                key: installed[key] for key in ("width", "height", "raw_sha256")}}
    except (OSError, ValueError, KeyError, TypeError):
        installed = None
    raw = SourceTransport(contract.follow_secrets_root, max_requests=80,
                          max_bytes=32 * 1024 * 1024, max_seconds=180)
    transport = HostLimitedTransport(raw, 1.5)
    statuses = set()
    diagnostics = {}
    network_failed = False

    def observed(request, timeout, limit):
        nonlocal network_failed
        try:
            response = transport(request, timeout, limit)
        except httpx.TransportError:
            network_failed = True
            raise
        statuses.add(response.status)
        return response

    try:
        fc2 = fc2_cover_candidates(contract.candidate_root / "fc2-candidate-log.csv").get(code)
        log = contract.candidate_root / "cover-fetch-log.csv"
        previous = logged_success_evidence(read_rows(log), code) if log.is_file() else None
        prior = tuple(item for item in (fc2, previous[0] if previous else None) if item)
        candidate, size, data = best_cover(observed, code, 0, diagnostics=diagnostics,
                                          prior_candidates=prior,
                                          metadata_root=contract.follow_sources_root / "metadata" / "javinizer-go")
        kept_size = _kept_cover_size(target, candidate, size, installed, previous)
        if kept_size is not None:
            partial = network_failed or any(s >= 400 and s != 404 for s in statuses)
            return {"ok": True, "code": code, "reason": "kept_existing", **_result(
                "labels.webScraping.keptLocalPartial" if partial else "labels.webScraping.keptLocalNoBetter",
                localWidth=kept_size[0], localHeight=kept_size[1], width=size[0], height=size[1])}
        evidence = {"code": code, "width": size[0], "height": size[1],
                    "source": candidate.source, "source_url": candidate.url,
                    "raw_sha256": hashlib.sha256(data).hexdigest(),
                    "installed_sha256": hashlib.sha256(data).hexdigest(),
                    "checked_at": time.time(), "resolver": "peach-jav-cover-v1"}
        install_cover(target, code, data, size, evidence=evidence,
                      portrait=dmm_portrait(observed, candidate.url))
        return {"ok": True, "code": code, **_result("labels.webScraping.coverSaved"), "width": size[0],
                "height": size[1], "requests": raw.requests, "bytes": raw.bytes}
    except Unavailable as exc:
        reason, parts = _unavailable_reason(exc, network_failed, statuses)
        details = []
        for key, label in DIAGNOSTIC_LABELS.items():
            if diagnostics.get(key):
                details += [*([_said("labels.webScraping.diagnosticSeparator")] if details else []),
                            _said(label, count=diagnostics[key])]
        if details:
            head = [_said("errors.webScraping.candidateChecksFailed")] if reason == "unusable_candidate" else parts
            parts = [*head, *details, _said("labels.webScraping.keptAfterDetails")]
        else:
            parts = [*parts, _said("labels.webScraping.kept")]
        # 一句由几段拼成：`error_parts` 每段一个 code，界面逐段取译文；`error` 是拼好的 zh-CN 原文。
        return {"ok": False, "code": code, "reason": reason, "error": _rendered(parts), "error_parts": parts}
    except SourcePaused as exc:
        return {"ok": False, "code": code, "reason": "paused", **failure_fields(exc)}
    except httpx.TransportError:
        return {"ok": False, "code": code, "reason": "network",
                **_error("api.scraping.sourceConnectionFailed")}
    except OSError:
        return {"ok": False, "code": code, "reason": "local_file",
                **_error("api.scraping.localCoverFailed")}
    except Exception as exc:
        return {"ok": False, "code": code, "reason": "processing_error",
                **_error("api.scraping.coverProcessingFailed", errorType=type(exc).__name__),
                "error_type": type(exc).__name__}
    finally:
        transport.close()


def q_scraping(contract, _args):
    from .scraping_access import browser_mode
    return {"sources": [describe(contract.follow_secrets_root, source) for source in SOURCES
                        if source != "instagram"],
            "browser_mode": browser_mode(contract.follow_secrets_root),
            "instagram_status": interface_text.text(f"server:{INSTAGRAM_STATUS_CODE}"),
            "instagram_status_code": INSTAGRAM_STATUS_CODE}


#: Instagram 那一格的状态说明。
INSTAGRAM_STATUS_CODE = "labels.webScraping.instagramPending"


def w_scraping_settings(contract, body):
    """一个来源的连接方式与 Cookie；只带 `browser_mode` 时改后台采集浏览器的模式（窗口／无窗口）。"""
    if "browser_mode" in body and "source" not in body:
        from .scraping_access import save_browser_mode
        return {"ok": True, "browser_mode": save_browser_mode(contract.follow_secrets_root,
                                                              str(body.get("browser_mode") or ""))}
    return {"ok": True, "saved": save(contract.follow_secrets_root, str(body.get("source", "")), body)}


def w_scraping_check(contract, body):
    return check_source(contract.follow_secrets_root, str(body.get("source", "")))


def w_scraping_check_all(contract, _body):
    """全部来源跑一趟 `peach check-sources` 的同一检查。冷却中的来源在传输层直接判冷却，
    不发请求；不登记续跑：服务重启后不该自己再打一轮来源。"""
    from .source_preflight import check_sources, default_sources
    job = contract.source_check_job
    sources = default_sources()

    def work(job_id):
        def done(row):
            with job.editing(job_id) as state:
                if state is not None:
                    state["results"].append(row)
                    state["checked"] += 1
                    state["current"] = {"label": row["label"]}
        result = check_sources(contract.follow_secrets_root, sources, on_result=done)
        targets = [target for row in result["sources"] for target in row["results"]]
        job.update(job_id, status="complete", ok=result["ok"], results=result["sources"],
                   failed=sum(target["outcome"] not in ("ok", "skipped") for target in targets),
                   elapsed_s=result["elapsed_s"], completed_at=time.time())
    return job.start(work, initial={"checked": 0, "total": len(sources), "results": []}, restart=True)


def q_scraping_amane_bridge(contract, args):
    """amane 桥那张卡：钉的 sha、锁里的版本、venv 建没建、开了哪几站，外加重建任务的快照。"""
    from . import metadata_amane
    return {**metadata_amane.describe(contract.tools_root),
            "job": contract.amane_bridge_job.snapshot() or {"status": "idle"}}


def w_scraping_amane_check(contract, body):
    """只读 GitHub API 问上游最新 release。取不到就是「未取得」；升不升级由人读 diff 决定。"""
    from . import metadata_amane, peach_proxy
    latest = metadata_amane.latest_upstream_tag(peach_proxy.client_options(contract.follow_secrets_root))
    return {"ok": True, **coded("latest", latest), "checked_at": time.time()}


def w_scraping_amane_rebuild(contract, body):
    """按锁重建桥的 venv。首次要下载约 98 MB，放后台跑，页面轮询 `q_scraping_amane_bridge` 那条读接口。"""
    from . import metadata_amane
    return contract.amane_bridge_job.start_result(lambda: metadata_amane.rebuild(contract.tools_root), recovery={})
