"""浏览器 JAV 添加队列：按番号查磁力，交给现有云下载与入库链路。"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import math
import re
import secrets
import threading
import time
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit

from .catalog_rules import (
    is_jav_code, normalise_code_key, release_code_from_product, same_release_code, without_store_prefix,
)
from . import interface_text
from .config import PROJECT_ROOT
from .coded_text import Said
from .content_words import BONUS_EDITION, LEGACY_REMOTE_MISSING, TRAILER_NAME
from .downloads import (
    CLOUDDRIVE_CREDENTIAL, INGESTED, POSTPROCESS_FAILED, POSTPROCESS_PENDING, POSTPROCESS_QUEUED,
    POSTPROCESS_RUNNING, REMOTE_RUNNING, RESUBMITTABLE_STATES, TRACKED_STATES, iso, state_label,
    CHANNEL_FAILURES, never_seen, submit_offline_download, parse_magnet,
    parse_iso, storage_full, DownloadError,
)
from .task_retry import RETRY_DELAYS, RetryableTaskError, retry_delay
from .follow_secrets import CredentialError
from .feeds import scan_code
from .fsutil import atomic_write_text
from .sources.dmm import code_from_cid, guessed_cid
from .jav_editions import bonus_cid
from .user_messages import UserFacingError, UserValueError

LOGGER = logging.getLogger(__name__)
CREDENTIAL = "jav-browser"
#: 跟着账本走的设置键（`web_settings.SYNCED_SETTING_KEYS` 登记，ADR-0161）。
WANT_ON_NO_MATCH = "javBrowserWantOnNoMatch"
ACTIVE = {"queued", "searching"}
#: 排队与搜索中的番号上限，也是共享进度列表里进行中与已结束两部分各自的上限；
#: 结束的任务保留 10 分钟，供各窗口看到完成。
ACTIVE_LIMIT = 200
#: 持久队列连同已结束的行最多留这么多；满了先腾出结果已记在下载任务或馆藏里的行，
#: 「未找到资源」这类只记在队列里的结果尽量留着，不让它们变回「可以加入」。
ROWS_LIMIT = 1000
#: 结果已记在别处、可以从队列里腾掉的状态。
RECORDED_ELSEWHERE = ("owned", "ingested", "submitted")
RECENT_SECONDS = 600
#: 渠道级失败（额度用完、网盘空间不足、配置失效、CloudDrive2 连不上）后暂停这个渠道，
#: 每隔这么久拿排在最前的番号试一次，成功就继续。
PAUSE_PROBE_SECONDS = 600
#: 两次清扫（`_requeue_recoverable`）之间至少隔这么久。
SWEEP_SECONDS = 60
#: 空闲等待按墙钟复核：Windows 的等待超时不计睡眠时间，睡醒后最晚这么久补上到期的重试。
WALL_CLOCK_RECHECK = 3600.0
#: 没查成的来源要停这么久以上，番号就不等它：按其余来源结算，来源恢复后再补查。
LONG_SOURCE_PAUSE = 3600.0
#: 会让浏览器添加暂停的原因。`search` 是资源搜索暂不可用，暂停的是整条队列而不是某个渠道。
#: 原因与恢复说明在 `server:javBrowser.paused.<原因>`：用户脚本的提示框分两行显示，排队行的说明连成一句。
PAUSED_FAILURES = frozenset({"storage", "quota", "config", "network", "search"})
#: 提示框的语气：要用户动手修的用 error，等着就会恢复或只需腾空间的用 warning。
PAUSED_TONES = {"config": "error", "network": "error"}
SEARCH_PAUSE = "search"


def paused_text(failure: str) -> dict:
    """暂停的原因、恢复说明与连成的一句。"""
    reason = interface_text.text(f"server:javBrowser.paused.{failure}.reason")
    hint = interface_text.text(f"server:javBrowser.paused.{failure}.hint")
    return {"reason": reason, "hint": hint,
            "message": interface_text.text("server:javBrowser.paused.message", {"reason": reason, "hint": hint})}
#: 不怪这个番号、过一会儿再交就可能成的下载失败，不等用户手点：放回队列自动重来。
#: 渠道级失败（空间、额度、配置）跟着渠道暂停与试探走，不限次数；其余按这张表限次，免得死循环。
AUTO_RETRY_LIMITS = {"not_accepted": 2, "network": 2}
#: 磁力本身的问题（网盘拒收、链接无效、没人做种、内容不符、被网盘拦截）不等用户点「换一个磁力」：
#: 跳过这个磁力重新搜索、交下一个候选，最多自动换这么多次；候选用完时照旧记为没有其他可用磁力。
MAGNET_SWITCH_LIMIT = 3
#: 浏览器添加的任务结束后一直留在列表里，直到用户在脚本里标为已读。键是「任务编号@结束时间」；
#: 没有下载任务的结果（未找到资源、搜索失败）用「番号@结束时间」。
ENDED_KEY = re.compile(r"^([1-9][0-9]{0,11}|[0-9A-Z][0-9A-Z-]{1,39})@[0-9T:+.\-]{19,32}$")
ENDED_DISMISSED_LIMIT = 1000
#: 结束时间：整理完成的取整理时间，失败、取消、停滞取结束时间；停滞复查只改 updated_at，不让任务重新冒出来。
ENDED_AT = "coalesce(nullif(postprocessed_at,''), nullif(finished_at,''), updated_at)"
#: 每个状态给用户脚本看的那句话（code）。用户脚本显示 `message`，认得 code 的按 `message_code` 取译文。
MESSAGES = {
    "idle": "labels.javBrowser.idle", "queued": "labels.javBrowser.queued", "searching": "labels.javBrowser.searching",
    "submitted": "labels.javBrowser.submitted", "ingested": "labels.javBrowser.ingested",
    "owned": "labels.javBrowser.owned", "failed": "labels.javBrowser.failed", "no_match": "labels.javBrowser.noMatch",
}
#: 下载失败按原因分给用户脚本：磁力本身的问题换一个磁力，网盘一侧的问题修好后重试同一个磁力。
MAGNET_FAILURES = frozenset({"rejected", "invalid_link", "no_source", "mismatch"})
CLOUD_FAILURES = frozenset({"config", "quota", "storage", "network", "not_landed", "duplicate", "not_accepted",
                            "removed"})
NO_OTHER_MAGNET = "labels.javBrowser.noOtherMagnet"
#: 细分之前「列表里找不到」统一记为 no_source 的原文；这些旧任务从没被网盘列出过，按网盘问题处理。
LEGACY_MISSING = LEGACY_REMOTE_MISSING


def _message(said: str) -> dict:
    """一行的 `message` 与它的 code：`Said` 带上 code 与参数；下载任务记下的失败原文把旧 code 清掉。"""
    if isinstance(said, Said):
        return {"message": str(said), "message_code": said.code, "message_params": dict(said.params)}
    return {"message": said, "message_code": None, "message_params": None}


def _state_message(state: str) -> dict:
    return _message(Said(MESSAGES[state]))


def _message_of(row: dict) -> dict:
    """行里记下的那句与它的 code；旧版本写下的行只有原文。"""
    return {"message": row.get("message"), "message_code": row.get("message_code"),
            "message_params": row.get("message_params")}


@lru_cache(maxsize=1)
def source_sites() -> list[dict]:
    payload = json.loads((PROJECT_ROOT / "web" / "integrations" / "jav-sites.json").read_text(encoding="utf-8"))
    sites = payload.get("sites")
    if payload.get("version") != 1 or not isinstance(sites, list) or not sites:
        raise ValueError("JAV site list can't be read")
    ids, domains = set(), set()
    for site in sites:
        if (not isinstance(site, dict) or not site.get("id") or site["id"] in ids
                or not site.get("label") or not site.get("kind")
                or site.get("mode") not in {"automatic", "selection"}
                or not isinstance(site.get("domains"), list) or not site["domains"]):
            raise ValueError("JAV site list has an invalid entry")
        ids.add(site["id"])
        if site.get("identity") is not None and (site["identity"] != "peach" or site["mode"] != "automatic"
                or not isinstance(site.get("detail_pattern"), str) or not site["detail_pattern"].startswith("^")
                or len(site.get("query_keys", ())) > 1):
            raise ValueError("release product ID recognition settings are invalid")
        for host in site["domains"]:
            if not isinstance(host, str) or not re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)+", host) or host in domains:
                raise ValueError("JAV site list has an invalid domain")
            domains.add(host)
    return sites


def source_site(host: str) -> dict | None:
    return next((site for site in source_sites() if any(
        host == name or host.endswith("." + name) for name in site["domains"])), None)


def code_key(value: object) -> str:
    raw = str(value or "").strip()
    code = release_code_from_product(raw) if len(raw) <= 80 else None
    if not code or not is_jav_code(code) or normalise_code_key(raw) != normalise_code_key(code):
        raise UserValueError("errors.javBrowser.codeRequired")
    # 店铺商品号（`107STZY-019`）在账本与资源站都是裸番号，查询、搜索与入库统一用它。
    return without_store_prefix(code)


def source_page(value: object) -> str:
    raw = str(value or "")
    try:
        parsed = urlsplit(raw)
        host = (parsed.hostname or "").lower()
        site = source_site(host)
        if (len(raw) > 2048 or parsed.scheme != "https" or site is None or parsed.username
                or parsed.password or parsed.port not in {None, 443} or parsed.fragment):
            raise ValueError
        parameters = parse_qsl(parsed.query, keep_blank_values=True, max_num_fields=16)
        if (len({key for key, _value in parameters}) != len(parameters) or any(
                key not in site.get("query_keys", ()) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value)
                for key, value in parameters)):
            raise ValueError
    except ValueError:
        raise UserValueError("errors.javBrowser.unsupportedPage") from None
    return parsed._replace(query=urlencode(parameters), fragment="").geturl()


def _registered_product(source: str) -> tuple[dict | None, str]:
    """已净化的发行平台详情地址里的商品号；FANZA 剪辑页交回其中的 DMM 商品号。"""
    url = urlsplit(source)
    site = source_site(url.hostname or "")
    product = ""
    if site and site.get("identity") == "peach":
        match = re.fullmatch(site["detail_pattern"], url.path, re.IGNORECASE)
        if match:
            product = (match.group(1) if match.lastindex else "") or next(
                (dict(parse_qsl(url.query)).get(key, "") for key in site.get("query_keys", ())), "")
    if site and site["id"] == "fanza-clip":
        # FANZA 剪辑页的 id 是 img-<DMM 商品号>-<片段序号>，片段序号不属于番号。
        clip = re.fullmatch(r"img-((?:h_\d+)?[a-z0-9]+)-\d{1,4}", product, re.IGNORECASE)
        product = clip.group(1) if clip else ""
    return site, product


def dmm_cid(value: object) -> str:
    """DMM 本站与 FANZA 剪辑页地址里的 DMM 商品号；别的来源或认不出时为空。"""
    try:
        site, product = _registered_product(source_page(value))
    except ValueError:
        return ""
    return product.lower() if site and site["id"] in {"dmm", "fanza-clip"} else ""


def page_edition(value: object, probe) -> str:
    """作品同时有通常版与特典版时，来源页是哪一版：`bonus` / `regular`；没有特典版或认不出时为空。

    特典版页面看商品号尾字母就能定；通常版页面要问 DMM 有没有对应的特典版（`probe`，失败按没有处理）。
    """
    cid = dmm_cid(value)
    if not cid:
        return ""
    if bonus_cid(cid):
        return "bonus"
    return "regular" if probe is not None and probe(cid) else ""


def identify_source(value: object, hint: str = "") -> str:
    """从已登记发行平台的详情地址提取商品号，复用编目规则确认番号。"""
    site, product = _registered_product(source_page(value))
    if not product:
        raise UserValueError("errors.javBrowser.codeNotRecognized")
    # DMM 的商品号按编目规则拆出番号；FC2 内容市场的商品页地址里只有数字编号，番号是 FC2-PPV-<编号>。
    code = code_key(code_from_cid(product) if site["id"] in {"dmm", "fanza-clip"}
                    else f"FC2-PPV-{product}" if site["id"] == "fc2-market" else product)
    if hint and not same_release_code(code, code_key(hint)):
        raise UserValueError("errors.javBrowser.codeProductMismatch")
    return code


def whole_release(code: str, page: object, probe) -> str:
    """分段发售的作品按整片番号算：DMM 上 `SORA-613A` 的整片 `sora00613` 也在售时返回 `SORA-613`。

    商品号先取来源页地址里的，没有时按番号猜；与这个番号对不上、问不到 DMM 或整片不在售时原样返回。
    """
    whole_cid = getattr(probe, "whole", None)
    cid = dmm_cid(page) or guessed_cid(code)
    if whole_cid is None or not cid or code_key(code_from_cid(cid)) != code:
        return code
    whole = whole_cid(cid)
    return code_key(code_from_cid(whole)) if whole else code


#: 种子名、磁力显示名或文件名里标明特典版的写法。
_BONUS_MARK = re.compile(BONUS_EDITION, re.IGNORECASE)


def _bonus_code(code: str):
    """`SDJS-304` 的特典版写法：`SDJS-304V`、`sdjs-304-v`；番号不是「字母-数字」时为 None。"""
    parts = re.fullmatch(r"([A-Z]+)-(\d+)", code)
    return re.compile(rf"(?<![A-Z0-9]){parts[1]}[-_ ]?0*{int(parts[2])}[-_ ]?V(?![A-Z0-9])",
                      re.IGNORECASE) if parts else None


def _magnet_text(item) -> str:
    """一条候选能看到的全部名字：种子名、磁力显示名与文件名。"""
    uri = str(item.get("uri") or "")
    shown = parse_qs(urlsplit(uri).query).get("dn", []) if uri.startswith("magnet:") else []
    files = [str(entry.get("name") if isinstance(entry, dict) else entry) for entry in item.get("file_list") or ()]
    return " ".join([str(item.get("name") or ""), *shown, *files])


def _download_candidate(items, code, skip=frozenset(), edition=""):
    """搜索结果里番号相符的正片磁力；`skip` 是换磁力时排除的 infohash。

    `edition` 是用户在特典版与通常版之间选的那一版：特典版写法（`SDJS-304V`）的种子也收进候选，
    选中版本的种子排前面；没有对应版本时退回第一个相符的（特典版含通常版全部正片）。
    """
    bonus = _bonus_code(code) if edition else None
    eligible = []
    for item in items:
        name = str(item.get("name") or "")
        matches = (same_release_code(scan_code(name), code)
                   or same_release_code(scan_code(name, product=True), code)
                   or bool(bonus and bonus.search(name)))
        if not matches or re.search(TRAILER_NAME, name):
            continue
        try:
            magnet = parse_magnet(str(item.get("uri") or ""))
        except ValueError:
            continue
        if magnet.info_hash in skip:
            continue
        if not edition:
            return item
        eligible.append(item)

    def is_bonus(item):
        text = _magnet_text(item)
        return bool(_BONUS_MARK.search(text) or (bonus and bonus.search(text)))
    return next((item for item in eligible if is_bonus(item) == (edition == "bonus")),
                eligible[0] if eligible else None)


def _awaiting_recheck(row: dict, now: float) -> bool:
    """没分清来源有没有查成的无资源，且已到可以重查的时候（先结算的那几行要等 `recheck_after`）。"""
    return (row["state"] == "no_match" and not row.get("sources_complete") and not row.get("task_id")
            and (not row.get("recheck_after") or parse_iso(row["recheck_after"]) <= now))


def _failure_projection(task) -> dict:
    """失败任务给用户脚本的类别与原因：磁力本身的问题换磁力，网盘一侧的问题修好后重试同一个磁力。"""
    # 区分空间不足之前，115 的「云空间不足」被记成 rejected，按原文认回来。
    storage = not task.blocked_at and (task.failure == "storage" or storage_full(task.failure_detail))
    # 旧任务把「列表里找不到」记成 no_source；从没被网盘列出过的按网盘问题处理。
    legacy_unseen = (task.failure == "no_source" and never_seen(task)
                     and (task.failure_detail or "").startswith(LEGACY_MISSING))
    cause = ("magnet" if task.blocked_at
             else "cloud" if storage or legacy_unseen or task.failure in CLOUD_FAILURES
             else "magnet" if task.failure in MAGNET_FAILURES else "")
    return {"failure": "storage" if storage else task.failure or "", "cause": cause}


def _download_projection(task) -> dict:
    """下载任务的阶段与进度，不带内部字段。"""
    progress = task.progress
    return {"state": task.state, "label": state_label(task.state),
            "phase": "organize" if task.state == INGESTED else "ingest" if task.remote_done_at
                or task.state in {"remote_done", "landed"} else "download",
            "progress": min(1.0, max(0.0, progress)) if task.state in {REMOTE_RUNNING, "remote_done", "landed", INGESTED}
                and type(progress) in (int, float) and math.isfinite(progress) else None,
            "postprocess_state": task.postprocess_state,
            "postprocess_label": task.postprocess_label,
            "updated_at": task.updated_at}


def _failed(item: dict) -> bool:
    """共享列表里的一项算不算失败：搜索或下载失败、未找到资源，或入库后整理失败；与用户脚本的失败计数同一口径。"""
    return item.get("state") in {"failed", "no_match"} or (item.get("download") or {}).get("postprocess_state") == "failed"


def _postprocess_retry_status(task) -> dict:
    """后处理的等待与耗尽状态，投影成浏览器可读的重试回执。"""
    if task.postprocess_state == POSTPROCESS_PENDING and task.next_check_at:
        return {'retry_at': task.next_check_at, 'retry_attempt': task.postprocess_retries,
                'retry_limit': len(RETRY_DELAYS)}
    if task.postprocess_state == 'failed' and task.postprocess_retries >= len(RETRY_DELAYS):
        return {'retry_exhausted': True, 'retry_attempt': task.postprocess_retries, 'retry_limit': len(RETRY_DELAYS)}
    return {}


class JavBrowser:
    """本机持久队列；搜索完成前退出时，下一次启动继续处理。"""

    def __init__(self, contract, *, search, edition_probe=None):
        self.contract = contract
        # 通常版页面问 DMM 有没有对应特典版的探测（`jav_editions.EditionProbe`）；None 时不问。
        self.edition_probe = edition_probe
        self.downloads = contract.downloads
        self.credentials = self.downloads.credentials
        self.path = Path(contract.follow_state_root) / "jav-browser-queue.json"
        self.ended_path = Path(contract.follow_state_root) / "jav-browser-ended.json"
        self.search = search
        self._lock = threading.RLock()
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread = None
        self._submitting = set()
        #: 资源搜索回了「稍后再试」时整条队列等到这一刻，其余番号不去一个个撞同一个故障。
        self._search_pause: dict | None = None
        self._swept_at = float("-inf")
        #: 下载服务存过一条可重交或被挡住的任务，下一次清扫要看。
        self._downloads_changed = False
        on_save = getattr(getattr(self.downloads, "store", None), "on_save", None)
        if on_save is not None:
            on_save(self._download_saved)
        from .jav_browser_diagnostics import BrowserDiagnostics
        self.diagnostics = BrowserDiagnostics()
        from .taste_browsing import BrowsingRecorder
        #: 用户脚本在作品页、女优页的查询带 `record=1` 时记一笔浏览（ADR-0164）。
        self.browsing = BrowsingRecorder(contract)
        self.rows = self._load()
        self.ended = self._load_ended()

    def _load(self) -> dict:
        if not self.path.exists():
            return {}
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict) or len(payload) > ROWS_LIMIT:
            raise UserValueError("errors.javBrowser.queueUnreadable")
        rows = {}
        for key, row in payload.items():
            if not isinstance(row, dict) or normalise_code_key(key) != key or row.get("state") not in MESSAGES:
                raise UserValueError("errors.javBrowser.queueUnreadable")
            if 'retry_attempt' in row and (type(row['retry_attempt']) is not int or not 0 <= row['retry_attempt'] <= len(RETRY_DELAYS)):
                raise UserValueError("errors.javBrowser.invalidRetryAttempt")
            if 'retry_at' in row and (not isinstance(row['retry_at'], str) or parse_iso(row['retry_at']) is None):
                raise UserValueError("errors.javBrowser.invalidRetryTime")
            if row["state"] == "searching":
                row["state"] = "queued"
            # 店铺前缀归一之前记下的行（`107STZY-019`）改记到裸番号下，裸番号已有记录时以它为准。
            canonical = code_key(key)
            if canonical == key or canonical not in rows:
                rows[canonical] = row
        return rows

    def _save(self):
        atomic_write_text(self.path, json.dumps(self.rows, ensure_ascii=False, indent=2) + "\n")

    def _load_ended(self) -> dict:
        """结束留存的确认记录：`since` 之前结束的都算确认过，之后的逐条记在 `dismissed` 里。

        文件不存在时从 10 分钟前起算并立即落盘，启用之前早已结束的任务不会一下子涌进浮卡。
        """
        try:
            payload = json.loads(self.ended_path.read_text(encoding="utf-8"))
            since, dismissed = payload["since"], payload["dismissed"]
            if (not isinstance(since, str) or not isinstance(dismissed, list)
                    or not all(isinstance(key, str) and ENDED_KEY.match(key) for key in dismissed)):
                raise ValueError
            return {"since": since, "dismissed": dismissed[-ENDED_DISMISSED_LIMIT:]}
        except FileNotFoundError:
            ended = {"since": iso(time.time() - RECENT_SECONDS), "dismissed": []}
        except (ValueError, KeyError, TypeError):
            LOGGER.warning("Could not read the browser-add completion record; counting from now")
            ended = {"since": iso(time.time()), "dismissed": []}
        atomic_write_text(self.ended_path, json.dumps(ended, ensure_ascii=False, indent=2) + "\n")
        return ended

    def dismiss(self, body: dict) -> dict:
        """确认已结束的任务：`keys` 逐条确认 `active()` 给出的键；`all` 确认到此刻为止结束的全部，失败项除外。

        失败（含未找到资源与整理失败）要用户决定重试还是放弃，只能逐条确认。`all` 把分界点放到最早那条
        未确认的失败上，分界点之后已完成的逐条记下。
        """
        keys = body.get("keys", [])
        if body.get("all") not in (None, False, True) or not isinstance(keys, list) or len(keys) > ACTIVE_LIMIT \
                or not all(isinstance(key, str) and ENDED_KEY.match(key) for key in keys):
            raise UserValueError("errors.javBrowser.invalidDismiss")
        failed: list[str] = []
        if body.get("all") is True:
            ended = [item for item in self.active()["items"] if item.get("ended_key") and not item.get("dismissed")]
            failed = [item["ended_key"].split("@", 1)[1] for item in ended if _failed(item)]
            keys = [*keys, *(item["ended_key"] for item in ended if not _failed(item))]
        with self._lock:
            since = min([iso(time.time()), *failed]) if body.get("all") is True else self.ended["since"]
            dismissed = [key for key in dict.fromkeys([*self.ended["dismissed"], *keys])
                         if key.split("@", 1)[1] >= since]
            self.ended = {"since": since, "dismissed": dismissed[-ENDED_DISMISSED_LIMIT:]}
            atomic_write_text(self.ended_path, json.dumps(self.ended, ensure_ascii=False, indent=2) + "\n")
        return self.active()

    def _config(self) -> dict:
        credential = self.credentials.load(CREDENTIAL)
        return dict(credential.values) if credential else {}

    def settings(self) -> dict:
        config = self._config()
        release = json.loads((PROJECT_ROOT / "web/integrations/jav-userscript-release.json").read_text(encoding="utf-8"))
        catalog = self.downloads.channel_snapshot() if self.downloads.available else {"providers": [], "problems": []}
        providers = catalog["providers"]
        preferred = config.get("provider", "")
        selected = preferred if any(row["key"] == preferred for row in providers) else (
            providers[0]["key"] if providers else "")
        return {"enabled": bool(config.get("token_hash")), "provider": selected,
                "active_provider": preferred, "available": self.downloads.available, **catalog,
                "want_on_no_match": self.want_on_no_match(),
                "userscript": {"version": release["version"],
                               "minimum_version": release.get("bridge_min_version", release["version"]),
                               "install_url": release.get("install_url", "/integrations/peach-jav.user.js")},
                "sites": [{key: site[key] for key in ("id", "label", "kind", "domains", "mode")}
                          for site in source_sites()]}

    def configure(self, body: dict) -> dict:
        action = body.get("action")
        if action not in {"enable", "rotate", "disable"}:
            raise UserValueError("errors.javBrowser.chooseAction")
        if not self.downloads.available:
            raise UserValueError("errors.javBrowser.deviceNotAllowed")
        provider = str(body.get("provider") or "")
        if action != "disable":
            self._ready(provider)
        token = None
        with self._lock:
            if action == "disable":
                self.credentials.clear(CREDENTIAL)
                for code, row in self.rows.items():
                    if row["state"] in ACTIVE and code not in self._submitting:
                        row.update(state="failed", **_message(Said("labels.javBrowser.disabled")))
                self._save()
            else:
                token = secrets.token_urlsafe(32)
                self.credentials.save(CREDENTIAL, {
                    "token_hash": hashlib.sha256(token.encode()).hexdigest(), "provider": provider})
        if token:
            # 停用期间留在队列里的番号，启用后接着处理。
            self._wake.set()
        return {**self.settings(), **({"token": token} if token else {})}

    def authorized(self, supplied: str) -> bool:
        try:
            expected = self._config().get("token_hash", "")
        except CredentialError:
            return False
        return bool(expected and supplied and len(supplied) <= 256 and hmac.compare_digest(
            expected, hashlib.sha256(supplied.encode()).hexdigest()))

    def _ready(self, provider: str, *, remote=True):
        if not self.downloads.available:
            raise UserValueError("errors.javBrowser.deviceNotAllowed")
        if remote:
            state = next((row for row in self.downloads.channel_snapshot()["providers"] if row["key"] == provider), None)
        elif provider in {"115", "pikpak"}:
            state = self.downloads._provider_state(provider)
        else:
            state = {"target": provider.startswith("clouddrive:"), "configured": bool(
                self.downloads.config.clouddrive_address and "token" in
                self.credentials.describe(CLOUDDRIVE_CREDENTIAL)["fields"])}
        if not state or not state["configured"] or not state["target"]:
            raise UserValueError("errors.javBrowser.channelNotConfigured")

    def _existing(self, code: str) -> dict | None:
        with self.contract.database.read_connection() as connection:
            row = connection.execute(
                "SELECT id FROM asset WHERE normalise_code_key(code)=? AND medium='video' "
                "AND disposal IS NULL ORDER BY id LIMIT 1", (code,)).fetchone()
            tasks = connection.execute(
                "SELECT id,state,postprocess_state FROM download_task WHERE normalise_code_key(code)=? "
                "ORDER BY id DESC", (code,)).fetchall()
        if tasks and tasks[0]['state'] == INGESTED and tasks[0]['postprocess_state'] in {
                POSTPROCESS_PENDING, POSTPROCESS_QUEUED, POSTPROCESS_RUNNING, POSTPROCESS_FAILED}:
            return {'state': 'ingested', 'task_id': tasks[0]['id']}
        if row:
            return {"state": "owned", "asset_id": row[0]}
        for task in tasks:
            if task["state"] not in RESUBMITTABLE_STATES:
                return {"state": "ingested" if task["state"] == INGESTED else "submitted", "task_id": task["id"]}
        return None

    def status(self, value: object) -> dict:
        code = code_key(value)
        with self._lock:
            row = dict(self.rows.get(code, {}))
            if not row.get("task_id") and code not in self._submitting:
                row.update(self._existing(code) or {})
            task = self.downloads.store.get(row["task_id"]) if row.get("task_id") else None
            detail = {}
            if task is not None:
                state = "ingested" if task.state == INGESTED else (
                    "failed" if task.state in RESUBMITTABLE_STATES or task.blocked_at else "submitted")
                row.update(state=state, **(_message(task.failure_detail) if task.failure_detail
                                           else _state_message(state)))
                if state == "failed":
                    failure = _failure_projection(task)
                    if failure["failure"] == "storage":
                        row["message"] = interface_text.text("server:javBrowser.storageFull")
                    detail.update(failure)
                if task.asset_id:
                    row["asset_id"] = task.asset_id
                detail["download"] = _download_projection(task)
                row.update(_postprocess_retry_status(task))
            state = row.get("state", "idle")
            if state == "queued" and (paused := self._paused(row.get("provider", ""))):
                detail["paused"] = paused
                row["message"] = paused_text(paused["failure"])["message"]
            return {"ok": True, "code": code, **row, **detail, **self._queue_detail(code, state), "state": state,
                    "stage": "submitting" if code in self._submitting else state,
                    **(_message_of(row) if row.get("message") else _state_message(state))}

    def _channel_pause(self, provider: str) -> dict | None:
        """渠道级失败后这个渠道处于暂停：失败类别、开始时间与下一次试探时间。成功提交一次就解除。"""
        alert = self.downloads.channel_alert(provider) if provider else None
        if not alert or alert["failure"] not in PAUSED_FAILURES:
            return None
        return {"failure": alert["failure"], "since": alert["since"],
                "retry_at": iso(parse_iso(alert["since"]) + PAUSE_PROBE_SECONDS)}

    def _active_search_pause(self) -> dict | None:
        pause = self._search_pause
        return dict(pause) if pause and parse_iso(pause["retry_at"]) > self.downloads.clock() else None

    def _paused(self, provider: str) -> dict | None:
        """排在这个渠道的番号此刻为什么不往下走：渠道暂停优先，其次是资源搜索暂停。"""
        return self._channel_pause(provider) or self._active_search_pause()

    def _queue_detail(self, code: str, state: str) -> dict:
        """排队中的番号排在搜索队列第几位；搜索逐个进行，用户脚本据此决定要不要给「提前处理」。"""
        if state != "queued":
            return {}
        with self._lock:
            waiting = [key for key, other in self.rows.items() if other["state"] == "queued"]
        return {"queue_position": waiting.index(code) + 1 if code in waiting else 1}

    def prioritize(self, value: object) -> dict:
        """把排队中的番号挪到搜索队列最前面；搜索、下载与整理阶段的任务不受影响。"""
        code = code_key(value)
        with self._lock:
            row = self.rows.get(code)
            if row is None or row["state"] != "queued":
                raise UserFacingError("javBrowser.notQueued")
            ordered = [(code, row), *((key, other) for key, other in self.rows.items() if key != code)]
            self.rows.clear()
            self.rows.update(ordered)
            self._save()
            self._wake.set()
        return self.status(code)

    def want_state(self, value: object) -> dict:
        """这个番号在不在「想要」里：`want` 为 null 是还没登记，否则带清单上的那一段（ADR-0161）。

        字段一直给出，用户脚本据此知道这台 Peach 能从浏览器登记想要。
        """
        from datetime import date
        from . import wants
        with self.contract.database.read_connection() as connection:
            row = wants.by_code_key(connection, code_key(value))
        return {"want": {"phase": wants.phase(row, date.today())} if row else None}

    def want_on_no_match(self) -> bool:
        """账本设置 `javBrowserWantOnNoMatch`：没搜到资源时是否加入想要，没设置过按开启算。"""
        from .profiles import read_settings
        with self.contract.database.read_connection() as connection:
            return read_settings(connection).get(WANT_ON_NO_MATCH) is not False

    def _want_unmatched(self, code: str) -> None:
        """没搜到资源时按设置把番号加入想要；已在库、已登记或写入失败都不影响队列本身。

        只登记这一行：封面与资料的积压由新作的定时刷新顺带补上，不在队列线程里另起取资料任务。
        这次没搜到也记一笔查找（`record_search`），定时查找从这一次起算间隔，不马上再查一遍。
        """
        from . import wants
        try:
            if not self.want_on_no_match():
                return
            with self.contract.database.write_transaction() as connection:
                row = wants.add_code(connection, code)
                wants.record_search(connection, row["id"], "none")
            self.contract.cache_bust()
        except UserValueError:
            pass
        except Exception as error:
            LOGGER.warning("JAV browser want after no match failed: %s (%s)", code, type(error).__name__)

    def retry_postprocess(self, value: object) -> dict:
        """重试这个番号入库后失败的整理，与任务中心的「重试整理」同一入口。"""
        status = self.status(value)
        task_id = status.get("task_id")
        if not task_id or status["state"] != "ingested" or status.get("download", {}).get("postprocess_state") != "failed":
            raise UserValueError("errors.javBrowser.nothingToRetry")
        self.downloads.retry_postprocess(int(task_id))
        return self.status(value)

    def active(self) -> dict:
        """进行中与最近结束的任务，供用户脚本的各个窗口共享同一份进度。

        进行中与脚本 `tracking()` 同一判据：排队、搜索、云下载，或已入库但整理未结束。
        最近 `RECENT_SECONDS` 内结束的任务带着终态留在列表里，脚本据此看到「进行中 → 完成」。
        浏览器添加（来处 `browser:`）的任务结束后一直留着，直到 `dismiss()` 确认。结束项带 `ended_key`
        与 `dismissed`：确认过的在 10 分钟内仍然列出、只标 `dismissed`，各窗口的本页状态照旧读得到。
        没有下载任务的结果（未找到资源、搜索失败）同样留到确认为止。进行中与已结束各自最多
        `ACTIVE_LIMIT` 项，排队再多也挤不掉失败项。`paused` 列出因额度或空间暂停的渠道。
        """
        cutoff = iso(time.time() - RECENT_SECONDS)
        tracked = sorted(TRACKED_STATES)
        organizing = (POSTPROCESS_PENDING, POSTPROCESS_QUEUED, POSTPROCESS_RUNNING)
        with self._lock:
            since, dismissed = self.ended["since"], set(self.ended["dismissed"])
        with self.contract.database.read_connection() as connection:
            codes = [row[0] for row in connection.execute(
                "SELECT normalise_code_key(code) AS key FROM download_task WHERE code IS NOT NULL AND code<>'' AND ("
                f"state IN ({','.join('?' * len(tracked))}) OR (state=? AND postprocess_state IN (?,?,?)) "
                "OR max(updated_at, coalesce(postprocessed_at,''), coalesce(finished_at,''))>=? "
                f"OR (origin LIKE 'browser:%' AND {ENDED_AT}>=?)) "
                "GROUP BY key ORDER BY max(id) DESC LIMIT ?",
                (*tracked, INGESTED, *organizing, cutoff, since, ACTIVE_LIMIT * 2))]
        with self._lock:
            queued = [code for code, row in self.rows.items() if row["state"] in ACTIVE or code in self._submitting]
            unrecorded = [code for code, row in reversed(self.rows.items())
                          if row["state"] in {"failed", "no_match"} and not row.get("task_id") and row.get("ended_at")]
        running, ended = [], []
        for code in dict.fromkeys([*queued, *codes, *unrecorded]):
            try:
                status = self.status(code)
            except ValueError:
                continue
            if status["state"] == "idle":
                continue
            mark = self._ended_mark(code, status, since, dismissed, cutoff)
            if mark is None:
                continue
            status.update(mark)
            (ended if mark else running).append(status)
        return {"ok": True, "items": [*running[:ACTIVE_LIMIT], *ended[:ACTIVE_LIMIT]], "paused": self._paused_channels()}

    def _ended_mark(self, code: str, status: dict, since: str, dismissed: set, cutoff: str) -> dict | None:
        """一项在共享列表里怎么列：进行中给空字典，已结束给确认键与是否已确认，不再列出给 None。

        浏览器添加的任务结束后留到确认为止，别处添加的只留最近 10 分钟；
        没有下载任务的结果（未找到资源、搜索失败）按队列行记下的结束时间同样处理。
        """
        organizing = (POSTPROCESS_PENDING, POSTPROCESS_QUEUED, POSTPROCESS_RUNNING)
        task = self.downloads.store.get(status["task_id"]) if status.get("task_id") else None
        if task is not None and task.state not in TRACKED_STATES and not (
                task.state == INGESTED and task.postprocess_state in organizing):
            ended_at = task.postprocessed_at or task.finished_at or task.updated_at
            key = f"{task.id}@{ended_at}"
            acknowledged = ended_at < since or key in dismissed
            recent = max(task.updated_at or "", task.postprocessed_at or "", task.finished_at or "") >= cutoff
            if not recent and (acknowledged or not (task.origin or "").startswith("browser:")):
                return None
            return {"ended_key": key, "dismissed": acknowledged}
        if task is None and status["state"] in {"failed", "no_match"}:
            ended_at = status.get("ended_at")
            if not ended_at:
                return None
            key = f"{code}@{ended_at}"
            acknowledged = ended_at < since or key in dismissed
            return None if acknowledged and ended_at < cutoff else {"ended_key": key, "dismissed": acknowledged}
        return {}

    def _paused_channels(self) -> list[dict]:
        """暂停中的渠道与各自排着的番号数，用户脚本据此给出一条渠道提示。"""
        with self._lock:
            waiting: dict[str, int] = {}
            for row in self.rows.values():
                if row["state"] == "queued":
                    waiting[row.get("provider", "")] = waiting.get(row.get("provider", ""), 0) + 1
        labels = {row["key"]: row["label"] for row in self.downloads.channel_snapshot()["providers"]}

        def entry(provider, label, count, paused):
            failure = paused["failure"]
            return {"provider": provider, "provider_label": label, "waiting": count, **paused_text(failure),
                    "tone": PAUSED_TONES.get(failure, "warning"), **paused}

        channels = [entry(provider, labels.get(provider, provider), count, paused)
                    for provider, count in waiting.items() if (paused := self._channel_pause(provider))]
        rest = sum(count for provider, count in waiting.items() if not self._channel_pause(provider))
        if rest and (search := self._active_search_pause()):
            channels.append(entry(SEARCH_PAUSE, "Peach", rest, search))
        return channels

    def add(self, body: dict) -> dict:
        code = code_key(body.get("code"))
        if body.get("manual") is True:
            if body.get("source_url") not in (None, ""):
                raise UserValueError("errors.javBrowser.manualRejectsSource")
            page = ""
        else:
            page = source_page(body.get("source_url"))
        # 分段发售的按整片添加；之前按分段番号记下、已经结束的那一行由整片这一行接替。
        whole = whole_release(code, page, self.edition_probe)
        part, code = (code if whole != code else ""), whole
        with self._lock:
            config = self._config()
            if not config.get("token_hash"):
                raise UserValueError("errors.javBrowser.notEnabled")
            status = self.status(code)
            if status["state"] in ACTIVE | {"owned", "submitted", "ingested"}:
                self._drop_part(part)
                return status
            if body.get("switch") not in (None, False, True):
                raise UserValueError("errors.javBrowser.invalidSwitch")
            if body.get("edition") not in (None, "", "bonus", "regular"):
                raise UserValueError("errors.javBrowser.invalidEdition")
            # 换磁力：把上一次提交的磁力记入跳过名单，重新搜索时取下一个。
            previous = self.rows.get(code, {})
            skip = list(previous.get("skip", ()))
            if body.get("switch") is True and previous.get("task_id"):
                task = self.downloads.store.get(previous["task_id"])
                if task is not None and task.info_hash and task.info_hash not in skip:
                    skip.append(task.info_hash)
            self._ready(config.get("provider", ""), remote=False)
            if sum(row["state"] in ACTIVE for row in self.rows.values()) >= ACTIVE_LIMIT:
                raise UserValueError("errors.javBrowser.queueFull")
            if code not in self.rows and len(self.rows) >= ROWS_LIMIT:
                ended = [key for key, row in self.rows.items() if row["state"] not in ACTIVE]
                del self.rows[next((key for key in ended if self.rows[key]["state"] in RECORDED_ELSEWHERE), ended[0])]
            # 要哪一版：本次明说的优先，其次沿用上一次的选择（换磁力），都没有时按来源页的商品号定。
            edition = body.get("edition") or previous.get("edition") or (
                "bonus" if bonus_cid(dmm_cid(page)) else "")
            self.rows[code] = {"state": "queued", "provider": config["provider"], "source_url": page,
                               **({"skip": skip[-20:]} if skip else {}), **({"edition": edition} if edition else {})}
            self._drop_part(part)
            self._save()
            self._wake.set()
            return self.status(code)

    def _drop_part(self, part: str) -> None:
        """整片接手后撤掉按分段番号记下、没生成下载任务就结束的那一行（失败或无资源）。调用方持锁。"""
        row = self.rows.get(part) if part else None
        if row and row["state"] in {"failed", "no_match"} and not row.get("task_id"):
            del self.rows[part]
            self._save()

    def _requeue_recoverable(self) -> None:
        """把能自动重来的失败放回队列，原来的位置不变；无资源仍等用户决定，升级前没分清来源的无资源除外。

        磁力本身的问题跳过这个磁力换下一个候选，最多 `MAGNET_SWITCH_LIMIT` 次，与用户点「换一个磁力」同一条路。
        覆盖升级前留下的失败：11-12 之前空间不足被记成 rejected，按原文认回来一并放回。
        队列里已入库的行也要逐条读任务，一分钟最多扫一遍。
        """
        now = self.downloads.clock()
        if now - self._swept_at < SWEEP_SECONDS:
            return
        self._swept_at = now
        self._downloads_changed = False
        changed = False
        for row in self.rows.values():
            if row["state"] not in {"submitted", "failed"} or not row.get("task_id"):
                continue
            task = self.downloads.store.get(row["task_id"])
            if task is None or not (task.state in RESUBMITTABLE_STATES or task.blocked_at):
                continue
            if _failure_projection(task)["cause"] == "magnet":
                switched = row.get("magnet_switches", 0)
                if switched >= MAGNET_SWITCH_LIMIT or not task.info_hash:
                    continue
                skip = [*row.get("skip", ()), task.info_hash]
                row["state"], row["skip"], row["magnet_switches"] = "queued", list(dict.fromkeys(skip))[-20:], switched + 1
                for key in ("task_id", "message", "retry_at", "retry_attempt", "retry_limit", "retry_exhausted", "ended_at"):
                    row.pop(key, None)
                changed = True
                continue
            if task.blocked_at:
                continue
            channel = task.failure in CHANNEL_FAILURES or storage_full(task.failure_detail)
            used = row.get("auto_retries", 0)
            if not channel and used >= AUTO_RETRY_LIMITS.get(task.failure or "", 0):
                continue
            row["state"] = "queued"
            for key in ("task_id", "message", "retry_at", "retry_attempt", "retry_limit", "retry_exhausted", "ended_at"):
                row.pop(key, None)
            if not channel:
                row["auto_retries"] = used + 1
            changed = True
        if self._recheck_unverified_no_match():
            changed = True
        if changed:
            self._save()

    def _recheck_unverified_no_match(self) -> bool:
        """升级前记下的无资源没分清来源有没有查成（JavDB 要求登录那几天大量误记），按现在的判据重查。

        现在的无资源行带 `sources_complete`；没带的行在队列空闲时每次清扫重查一条，排到队尾，
        不挤占用户新加的番号，也不一下子把几十个番号压给来源。因来源长时间暂停而先结算的行带
        `recheck_after`，到那个时刻（来源恢复）才重查。
        """
        if any(row["state"] in ACTIVE for row in self.rows.values()) or self._submitting:
            return False
        code = next((key for key, row in self.rows.items() if _awaiting_recheck(row, self.downloads.clock())), None)
        if code is None:
            return False
        row = self.rows.pop(code)
        for key in ("message", "retry_at", "retry_attempt", "retry_limit", "retry_exhausted", "ended_at", "recheck_after"):
            row.pop(key, None)
        self.rows[code] = {**row, "state": "queued"}
        return True

    def _next_queued(self) -> str | None:
        """排在最前、到了时间的番号；暂停中的渠道到了试探时间才放一个过去，其余照旧排着。"""
        now = self.downloads.clock()
        waiting = {provider: parse_iso(paused["retry_at"]) > now for provider in
                   {row.get("provider", "") for row in self.rows.values() if row["state"] == "queued"}
                   if (paused := self._paused(provider))}
        return next((key for key, row in self.rows.items() if row["state"] == "queued"
                     and not waiting.get(row.get("provider", ""))
                     and (not row.get('retry_at') or parse_iso(row['retry_at']) <= now)), None)

    def _hold_for_channel(self, row: dict, provider: str, error: Exception) -> None:
        """渠道没配好或读不到媒体库渠道时每个番号都会同样失败：放回队列、暂停这个渠道，配好后试探时自动继续。"""
        LOGGER.warning("JAV browser channel not ready: %s (%s)", provider, type(error).__name__)
        with self._lock:
            if row["state"] == "searching":
                row["state"] = "queued"
                self._save()
        reason = (DownloadError("config", error.code, error.params) if isinstance(error, UserFacingError)
                  else DownloadError("config", "errors.javBrowser.channelNotConfigured"))
        self.downloads.note_channel(provider, reason, self.downloads.clock())

    @staticmethod
    def _settle_submission(row: dict, submitted: dict) -> None:
        """按提交结果更新队列行。额度、空间、配置问题不怪这个番号：放回队列等渠道恢复，位置不变。"""
        task = submitted["task"]
        if submitted["outcome"] == "failed" and task["failure"] in CHANNEL_FAILURES:
            row["state"] = "queued"
            for key in ("task_id", "message"):
                row.pop(key, None)
        else:
            row.update(state="failed" if submitted["outcome"] in {"failed", "refused"} else "submitted",
                       task_id=task["id"])

    def process_one(self) -> bool:
        with self._lock:
            if self._stop.is_set() or not self.downloads.available or not self._config().get("token_hash"):
                return False
            self._requeue_recoverable()
            code = self._next_queued()
            if code is None:
                return False
            row = self.rows[code]
            existing = self._existing(code)
            if existing:
                row.update(existing)
                self._save()
                return True
            row["state"] = "searching"
            row.pop('retry_at', None)
            self._save()
            provider = row["provider"]
        try:
            self._ready(provider)
        except Exception as error:
            self._hold_for_channel(row, provider, error)
            return True
        try:
            skip = list(row.get("skip", ()))
            result = self.search(self.contract, {"code": code, "goal": "quality", **({"skip": skip} if skip else {})})
            candidate = _download_candidate(result.get("items", ()), code, frozenset(row.get("skip", ())),
                                            row.get("edition", ""))
            if not (result.get('state') in {'error', 'unavailable'} or result.get('error')):
                self._search_pause = None
            should_submit = False
            with self._lock:
                if row["state"] != "searching" or not self._config().get("token_hash"):
                    return True
                elif self._stop.is_set():
                    row["state"] = "queued"
                elif existing := self._existing(code):
                    row.update(existing)
                elif candidate is None:
                    self._empty_search_result(row, result)
                else:
                    self._submitting.add(code)
                    should_submit = True
                self._save()
                unmatched = row["state"] == "no_match"
            if unmatched:
                self._want_unmatched(code)
            if should_submit:
                try:
                    submitted = submit_offline_download(
                        self.downloads, magnet=candidate["uri"], provider=provider, code=code,
                        origin="browser:" + (row["source_url"] or "manual"), dedupe_code=True)
                    with self._lock:
                        self._settle_submission(row, submitted)
                        self._save()
                finally:
                    with self._lock:
                        self._submitting.discard(code)
        except Exception as error:
            LOGGER.error("JAV browser add failed: %s (%s)", code, type(error).__name__)
            with self._lock:
                self._submitting.discard(code)
                if row["state"] == "searching":
                    retry_error = (RetryableTaskError(error.code, error.params)
                                   if isinstance(error, DownloadError) and error.retryable else error)
                    self._schedule_retry(row, retry_error)
                    self._save()
        return True

    def _empty_search_result(self, row: dict, result: dict) -> None:
        """搜索没有正片磁力时，分别结算无命中、可恢复故障与永久故障。

        有直连来源没查成（JavDB 要求登录、来源冷却、连接失败）时，这一轮的「没有」不算数：
        即使后备索引器答复了，也按来源冷却排自动重试，重试用完记成来源未取得，不记无资源。
        来源要停 `LONG_SOURCE_PAUSE` 以上时不让番号干等：按其余来源的结果记无资源并注明哪个来源没查，
        不带 `sources_complete`，等那个来源恢复（`recheck_after`）后由清扫重查。
        """
        failed = result.get('state') in {'error', 'unavailable'} or bool(result.get('error'))
        reason = (Said(result['error_code'], **(result.get('error_params') or {}))
                  if failed and isinstance(result.get('error_code'), str) else None)
        message = (Said('labels.javBrowser.searchFailedWith', error=reason) if reason
                   else Said('labels.javBrowser.searchUnavailable') if failed
                   else Said(NO_OTHER_MAGNET) if row.get('skip') else Said(MESSAGES['no_match']))
        after = result.get('retry_after')
        timed = type(after) in (int, float) and math.isfinite(after) and after >= 0
        unfetched = [str(value) for value in result.get('unfetched_sources') or () if value]
        if failed and timed:
            self._schedule_retry(row, RetryableTaskError('errors.javBrowser.searchUnavailable', after=after))
            # 来源让稍后再试时，整条队列一起等，不让后面的番号各自撞一次、各自耗掉重试次数。
            now = self.downloads.clock()
            self._search_pause = {"failure": SEARCH_PAUSE, "since": iso(now),
                                  "retry_at": row.get('retry_at') or iso(now + after)}
        elif not failed and unfetched and timed and after > LONG_SOURCE_PAUSE:
            now = self.downloads.clock()
            sources = ' / '.join(dict.fromkeys(unfetched))
            row.update(state='no_match', **_message(Said('labels.javBrowser.noMatchSourcesPaused', sources=sources)),
                       ended_at=iso(now), recheck_after=iso(now + after))
            for key in ('retry_at', 'retry_attempt', 'retry_limit', 'sources_complete'):
                row.pop(key, None)
        elif not failed and unfetched:
            # 只是部分来源没答复，别的番号照样可能在其余来源找到，不暂停整条队列。
            self._schedule_retry(row, RetryableTaskError('errors.javBrowser.searchUnavailable',
                                                         after=after if timed else 0),
                                 sources=' / '.join(dict.fromkeys(unfetched)))
        else:
            row.update(state='failed' if failed else 'no_match', **_message(message), ended_at=iso(self.downloads.clock()))
            if not failed:
                row['sources_complete'] = True

    def _schedule_retry(self, row: dict, error: Exception, *, sources: str = '') -> None:
        """排下一次自动重试；`sources` 是没查成的来源，等待与用完时的那句话点名它们。"""
        attempt = row.get('retry_attempt', 0)
        delay = retry_delay(error, attempt)
        if delay is None:
            message = (Said('labels.javBrowser.sourcesExhausted', sources=sources, attempts=attempt)
                       if sources and attempt == len(RETRY_DELAYS)
                       else Said('labels.javBrowser.retriesExhausted', attempts=attempt) if attempt == len(RETRY_DELAYS)
                       else Said('labels.javBrowser.submitFailed'))
            row.update(state='failed', **_message(message), ended_at=iso(self.downloads.clock()))
            row['retry_exhausted'] = attempt == len(RETRY_DELAYS)
            return
        waiting = Said('labels.javBrowser.sourcesWaiting', sources=sources) if sources \
            else Said('labels.javBrowser.retryWaiting')
        row.update(state='queued', retry_attempt=attempt + 1, retry_limit=len(RETRY_DELAYS),
                   retry_at=iso(self.downloads.clock() + delay), **_message(waiting))

    def start(self):
        if not self.downloads.available or self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="PeachJavBrowser", daemon=True)
        self._thread.start()

    def _download_saved(self, task) -> None:
        """下载服务的回调，在写入线程里：只记一笔并叫醒，不取队列锁。"""
        if task.state in RESUBMITTABLE_STATES or task.blocked_at:
            self._downloads_changed = True
            self._wake.set()

    def idle_wait(self) -> float | None:
        """队列没有能马上处理的番号时睡多久；None 表示等加入、配置或下载状态变化叫醒。

        到期点是排队行的重试时间、暂停渠道的试探时间；下载状态变过或还有待重查的无资源时，
        再加上下一次清扫的时间。
        """
        with self._lock:
            if self._stop.is_set() or not self.downloads.available or not self._config().get("token_hash"):
                return None
            moments = []
            providers = set()
            for row in self.rows.values():
                if row["state"] != "queued":
                    continue
                providers.add(row.get("provider", ""))
                if row.get("retry_at"):
                    moments.append(parse_iso(row["retry_at"]))
            for provider in providers:
                if paused := self._paused(provider):
                    moments.append(parse_iso(paused["retry_at"]))
            idle = not any(row["state"] in ACTIVE for row in self.rows.values())
            unverified = idle and any(_awaiting_recheck(row, self.downloads.clock()) for row in self.rows.values())
            if self._downloads_changed or unverified:
                moments.append(self._swept_at + SWEEP_SECONDS)
            if idle:
                # 先结算的无资源等来源恢复：到点叫醒清扫。
                moments.extend(parse_iso(row["recheck_after"]) for row in self.rows.values()
                               if row["state"] == "no_match" and row.get("recheck_after"))
            moments = [moment for moment in moments if moment is not None]
            if not moments:
                return None
            return min(max(0.0, min(moments) - self.downloads.clock()), WALL_CLOCK_RECHECK)

    def _loop(self):
        while not self._stop.is_set():
            self._wake.clear()
            if not self.process_one():
                self._wake.wait(self.idle_wait())

    def stop(self):
        self._stop.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join()
            self._thread = None
