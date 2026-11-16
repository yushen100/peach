"""安装后的资料源检查；不扫描影片，不改变来源配置。命令行与「来源和凭证」页的全部检查共用。"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable
import time

from .scraping_access import SOURCES
from .coded_text import Said, coded
from .source_checks import check_source
from .user_messages import UserValueError

#: 检查原因（`check_source` 落下的 `reason`）归到报告口径。命令行与网页都读这一张表。
OUTCOMES = {
    "auth_required": "auth", "cloudflare_challenge": "auth",
    "rate_limited": "http", "server_error": "http", "not_found": "http", "http_error": "http",
    "cooldown": "cooldown",
    "proxy": "network", "timeout": "network", "network": "network",
    "needs_code": "skipped", "no_image_host": "skipped",
}
#: 口径的说法，`outcome_label` 是 zh-CN 原文，`outcome_label_code` 给界面取译文。
OUTCOME_LABEL_CODES = {
    "ok": "labels.sourcePreflight.outcome.ok", "auth": "labels.sourcePreflight.outcome.auth",
    "http": "labels.sourcePreflight.outcome.http", "cooldown": "labels.sourcePreflight.outcome.cooldown",
    "network": "labels.sourcePreflight.outcome.network", "skipped": "labels.sourcePreflight.outcome.skipped",
}


def outcome(target: dict) -> str:
    """一项结果的口径。没登记的原因按网络失败算：连接检查走到这里只剩连不上。"""
    return "ok" if target.get("ok") else OUTCOMES.get(str(target.get("reason", "")), "network")


def default_sources() -> list[str]:
    """不指定来源时检查的全部来源。Instagram 头像定位尚无独立登录会话可验，不在其列。"""
    return [source for source in SOURCES if source != "instagram"]


def check_sources(secrets_root: Path, sources: list[str] | None = None, *,
                  on_result: Callable[[dict], None] | None = None) -> dict:
    """最多四个来源同时检查。`on_result` 在调用方线程按完成先后收到每个来源：
    后台任务的进度登记依赖调用方线程上下文；返回的 `sources` 仍按选择顺序排。"""
    selected = list(dict.fromkeys(sources if sources is not None else default_sources()))
    if not selected or any(source not in SOURCES for source in selected):
        raise UserValueError("errors.sourcePreflight.unknownSource")

    def check(source):
        result = check_source(secrets_root, source, preflight=True)
        targets = []
        for target in result["results"]:
            key = outcome(target)
            targets.append({**target, "outcome": key, **coded("outcome_label", Said(OUTCOME_LABEL_CODES[key]))})
        return {"source": source, **coded("label", SOURCES[source]["label"]),
                "results": targets, "session_verified": False}

    started = time.monotonic()
    finished: dict[str, dict] = {}
    pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="source-check")
    try:
        from contextvars import copy_context
        futures = {pool.submit(copy_context().run, check, source): source for source in selected}
        for future in as_completed(futures):
            row = finished[futures[future]] = future.result()
            if on_result is not None:
                on_result(row)
    finally:
        # 任务中心取消时 `on_result` 抛出：只等已在检查的来源，排队的不再开始。
        pool.shutdown(wait=True, cancel_futures=True)
    results = [finished[source] for source in selected]
    return {"ok": all(target["ok"] or target.get("reason") == "needs_code"
                      for source in results for target in source["results"]),
            "sources": results, "elapsed_s": round(time.monotonic() - started, 2)}
