"""用户自配 Torznab 索引器：有界请求、候选筛选与质量排序。

XML 模型由 torznab 解析；请求、凭据与番号判据由 Peach 管理。搜索只返回候选，
下载由用户逐条提交现有云下载入口。配置以一份本机凭据文件原子保存。

OneJAV 一类索引器只给种子文件、不给磁力与 infohash：这类条目经索引器自己的下载代理
取回种子，按 bencode2 解码后对 info 字典求 SHA-1，换成磁力候选。
"""
from __future__ import annotations

import hashlib
import json
import re
import threading
import time
from collections import Counter, OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlsplit
from xml.etree.ElementTree import ParseError, fromstring

import bencode2
import httpx
from .task_retry import transient_delay
from torznab.exceptions import TorznabAPIError
from torznab.parser import parse_capabilities, parse_torznab

from .catalog_rules import (
    UNCENSORED_EDITIONS, jav_edition_badges, normalise_code_key, release_code_from_filename,
    release_code_from_product, same_release_code,
)
from .coded_text import Said, coded, parallel
from .catalog_vocabulary import CHINESE_SUBTITLES, RESOURCE_CHINESE_SUBTITLES
from .downloads import parse_magnet
from .follow_secrets import CredentialError, CredentialStore
from .feeds import scan_code
from .user_messages import UserValueError, nested_message

CREDENTIAL = "resource-indexers"
MAX_INDEXERS = 4
MAX_BYTES = 2 * 1024 * 1024
MAX_RESULTS = 5
MAX_ITEMS = 100
#: 每个索引器每轮最多取几份种子：只取番号、体积、做种都已对上的条目。
MAX_TORRENTS = 6
MAX_TORRENT_BYTES = 8 * 1024 * 1024


def endpoint(value: object) -> str:
    """API 地址不携带查询参数或凭据；允许用户部署在回环和局域网。"""
    text = str(value or "").strip()
    try:
        url = urlsplit(text)
        port = url.port
    except ValueError:
        raise UserValueError("errors.resourceSearch.invalidEndpoint") from None
    if (len(text) > 2048 or url.scheme not in ("http", "https") or not url.hostname
            or url.username is not None or url.password is not None or url.query or url.fragment
            or any(char.isspace() for char in text) or port == 0):
        raise UserValueError("errors.resourceSearch.endpointFormat")
    return text


class Indexers:
    def __init__(self, credentials: CredentialStore):
        self.credentials = credentials

    def load(self) -> list[dict]:
        try:
            credential = self.credentials.load(CREDENTIAL)
            rows = json.loads(credential.values.get("indexers", "[]")) if credential else []
            if not isinstance(rows, list) or len(rows) > MAX_INDEXERS:
                raise ValueError
            for row in rows:
                if not isinstance(row, dict) or not isinstance(row.get("key"), str):
                    raise ValueError
                if not isinstance(row.get("name"), str) or type(row.get("enabled")) is not bool:
                    raise ValueError
                endpoint(row.get("url"))
            return rows
        except (CredentialError, ValueError, TypeError):
            raise UserValueError("errors.resourceSearch.unreadableConfig") from None

    def public(self) -> dict:
        return {"indexers": [
            {name: row[name] for name in ("key", "name", "url", "enabled")}
            | {"api_key_set": bool(row.get("api_key"))}
            for row in self.load()], "max_indexers": MAX_INDEXERS}

    def save(self, body: dict) -> dict:
        rows = body.get("indexers") if isinstance(body, dict) else None
        if not isinstance(rows, list) or len(rows) > MAX_INDEXERS:
            raise UserValueError("errors.resourceSearch.tooManyIndexers", {"max": MAX_INDEXERS})
        previous = {row["key"]: row for row in self.load()}
        saved: list[dict] = []
        keys: set[str] = set()
        for row in rows:
            if not isinstance(row, dict):
                raise UserValueError("errors.resourceSearch.indexerNotObject")
            key = str(row.get("key") or "")
            name = str(row.get("name") or "").strip()
            if not re.fullmatch(r"[a-zA-Z0-9_-]{1,48}", key) or key in keys:
                raise UserValueError("errors.resourceSearch.invalidIndexerKey")
            if not name or len(name) > 80:
                raise UserValueError("errors.resourceSearch.invalidIndexerName")
            address = endpoint(row.get("url"))
            old = previous.get(key, {})
            secret = str(row.get("api_key") or "").strip()
            if not secret and not row.get("clear_api_key") and old.get("url") == address:
                secret = old.get("api_key", "")
            if len(secret) > 512 or any(char.isspace() for char in secret):
                raise UserValueError("errors.resourceSearch.invalidApiKey")
            saved.append(dict(key=key, name=name, url=address, api_key=secret,
                              enabled=row.get("enabled") is True))
            keys.add(key)
        self.credentials.save(CREDENTIAL, {"indexers": json.dumps(saved, ensure_ascii=False)})
        return self.public()


@dataclass(frozen=True)
class Filters:
    min_size: int = 0
    max_size: int = 1024 ** 4
    goal: str = "quality"

    def __post_init__(self):
        if not 0 <= self.min_size <= self.max_size <= 1024 ** 4:
            raise UserValueError("errors.resourceSearch.invalidSizeRange")
        if self.goal not in ("quality", "chinese", "uncensored"):
            raise UserValueError("errors.resourceSearch.invalidGoal")


def qualities(title: str, tags: list[str], code: str) -> dict:
    text = " ".join([title, *tags])
    resolution = next((value for pattern, value in (
        (r"(?i)(?<!\w)(?:4k|2160p|uhd)(?!\w)", 2160),
        (r"(?i)(?<!\w)(?:1080[pi]|fhd)(?!\w)", 1080),
        (r"(?i)(?<!\w)720p(?!\w)", 720)) if re.search(pattern, text)), 0)
    codec = next((value for pattern, value in (
        (r"(?i)\b(?:h[ ._-]?265|x265|hevc)\b", "HEVC"),
        (r"(?i)\b(?:h[ ._-]?264|x264|avc)\b", "AVC"),
        (r"(?i)\bav1\b", "AV1")) if re.search(pattern, text)), "")
    editions = jav_edition_badges(title, code, tags)
    # 来源给的中字属性（JavDB 磁链的 `cnsub`）是 id，不在标签判据里，单独认。
    chinese = CHINESE_SUBTITLES in editions or RESOURCE_CHINESE_SUBTITLES in tags
    return {"resolution": resolution, "codec": codec, "chinese": chinese,
            "uncensored": any(label in UNCENSORED_EDITIONS for label in editions),
            "edition_badges": editions}


def matches_resource_code(title: str, code: str) -> bool:
    """核对资源番号，并识别带版本后缀的资源名。"""
    ordinary = scan_code(title)
    product = scan_code(title, product=True)
    if same_release_code(ordinary, code) or same_release_code(product, code):
        return True
    return (not ordinary and not product and bool(jav_edition_badges(title, code))
            and same_release_code(release_code_from_filename(title), code))


def torrent_info_hash(data: bytes) -> str:
    """种子文件的 v1 infohash：info 字典编码后的 SHA-1。

    bencode2 拒收键乱序的字典，所以重新编码的字节就是原文，不会算出另一个哈希。
    """
    meta = bencode2.bdecode(data)
    info = meta.get(b"info") if isinstance(meta, dict) else None
    if not isinstance(info, dict):
        raise ValueError("torrent file has no info dictionary")
    return hashlib.sha1(bencode2.bencode(info)).hexdigest()


#: 条目被筛掉的原因。搜索结果为空时据此分开「索引器里没有」和「有，但都不合格」。
REJECT_REASONS = {"code": "labels.resourceSearch.reject.code", "size": "labels.resourceSearch.reject.size",
                  "seeders": "labels.resourceSearch.reject.seeders", "hash": "labels.resourceSearch.reject.hash"}


def candidate(item, indexer: dict, code: str, filters: Filters,
              fetch: Callable[[str], str | None] | None = None,
              rejected: Counter | None = None) -> dict | None:
    """`fetch` 把索引器给的种子下载地址换成 infohash；条目自带磁力或 infohash 时不调用。

    筛掉的条目按 `REJECT_REASONS` 的键计入 `rejected`。
    """
    def reject(reason: str) -> None:
        if rejected is not None:
            rejected[reason] += 1

    title = str(item.title or "")[:500]
    if not matches_resource_code(title, code):
        return reject("code")
    if item.size is None or not filters.min_size <= item.size <= filters.max_size:
        return reject("size")
    if item.seeders is None or item.seeders <= 0:
        return reject("seeders")
    info_hash = None
    for raw in (item.magnet_url, item.link, item.guid, item.infohash):
        if raw:
            try:
                info_hash = parse_magnet(raw).info_hash
                break
            except ValueError:
                continue
    if info_hash is None and fetch and item.link:
        info_hash = fetch(item.link)
    if info_hash is None:
        return reject("hash")
    # 候选只携带规范 hash，索引器返回的 tracker 与 URL 可能含私有 passkey。
    quality = qualities(title, item.tags, code)
    return {"id": info_hash, "info_hash": info_hash,
            "uri": f"magnet:?xt=urn:btih:{info_hash}", "name": title,
            "size": item.size, "seeders": item.seeders, "peers": item.peers,
            "date": str(item.pub_date or "")[:100], "source": indexer["name"],
            "origins": [indexer["name"]], **quality}


def _xml(client: httpx.Client, indexer: dict, params: dict, deadline: float) -> str:
    params = {**params, "apikey": indexer.get("api_key", "")}
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("indexer query timed out")
    with client.stream("GET", indexer["url"], params=params, timeout=min(10, remaining)) as response:
        if response.status_code != 200:
            raise httpx.HTTPStatusError(f"indexer returned HTTP {response.status_code}", request=response.request, response=response)
        content = bytearray()
        for chunk in response.iter_bytes(chunk_size=16384):
            if time.monotonic() > deadline:
                raise TimeoutError("indexer query timed out")
            content.extend(chunk)
            if len(content) > MAX_BYTES:
                raise UserValueError("errors.resourceSearch.responseTooLarge")
    text = bytes(content).decode("utf-8")
    if "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
        raise UserValueError("errors.resourceSearch.xmlEntities")
    if fromstring(text).tag not in ("caps", "rss", "error"):
        raise UserValueError("errors.resourceSearch.notTorznab")
    return text


def _torrent_hash(client: httpx.Client, indexer: dict, link: str, deadline: float) -> str | None:
    """经索引器自己的下载代理取种子换 infohash；取不到只丢这一条，不算索引器失败。

    只请求与 API 地址同源的链接：Prowlarr、Jackett 的下载代理都在自己那台机器上，
    别处的地址不替索引器去访问。代理改回磁力的重定向直接取 Location。
    """
    api, target = urlsplit(indexer["url"]), urlsplit(link)
    try:
        same_origin = (api.scheme, api.hostname, api.port) == (target.scheme, target.hostname, target.port)
    except ValueError:
        return None
    remaining = deadline - time.monotonic()
    if not same_origin or remaining <= 0:
        return None
    try:
        with client.stream("GET", link, timeout=min(10, remaining)) as response:
            if response.is_redirect:
                return parse_magnet(response.headers.get("location", "")).info_hash
            if response.status_code != 200:
                return None
            content = bytearray()
            for chunk in response.iter_bytes(chunk_size=65536):
                content.extend(chunk)
                if len(content) > MAX_TORRENT_BYTES or time.monotonic() > deadline:
                    return None
        return torrent_info_hash(bytes(content))
    except (httpx.HTTPError, ValueError):
        return None


class Search:
    """一轮最多四个来源，每源两次查询、至多六份种子；同一进程串行并缓存一分钟。"""
    def __init__(self, *, transport=None, clock=time.monotonic):
        self.transport = transport
        self.clock = clock
        self.lock = threading.Lock()
        self.cache: OrderedDict[tuple, tuple[float, dict]] = OrderedDict()

    def run(self, indexers: list[dict], code: str, filters: Filters, blocked=(), *,
            priority: Callable[[dict], int] | None = None) -> dict:
        code = normalise_code_key(code)
        if not code or len(code) > 80 or not same_release_code(release_code_from_product(code), code):
            raise UserValueError("errors.resourceSearch.invalidCode")
        active = [row for row in indexers if row.get("enabled")]
        if len(active) > MAX_INDEXERS:
            raise UserValueError("errors.resourceSearch.indexerLimitExceeded")
        if not active:
            return {"ok": True, "state": "unavailable", "items": [], "warnings": [],
                    **coded("error", Said("labels.resourceSearch.noIndexer"))}
        if not self.lock.acquire(blocking=False):
            return {"ok": False, "state": "busy", "items": [], "warnings": [],
                    **coded("error", Said("labels.resourceSearch.busy")), "retry_after": 0.0}
        try:
            key = (json.dumps(active, sort_keys=True), code, filters)
            cached = self.cache.get(key)
            if cached and self.clock() - cached[0] < 60:
                result = cached[1]
            else:
                result = self._search(active, code, filters)
                self.cache[key] = (self.clock(), result)
                self.cache.move_to_end(key)
                while len(self.cache) > 128:
                    self.cache.popitem(last=False)
            excluded = set(blocked)
            items = [row for row in result["items"] if row["info_hash"] not in excluded]
            if priority is not None:
                items.sort(key=priority)
            return {**result, "items": items[:MAX_RESULTS]}
        finally:
            self.lock.release()

    def _search(self, indexers: list[dict], code: str, filters: Filters) -> dict:
        found: dict[str, dict] = {}
        retry_delays = []
        warnings = []
        rejected: Counter = Counter()
        successful = 0
        deadline = time.monotonic() + 45
        query = code.split("-")[-1] if code.startswith("FC2-") else code
        with httpx.Client(transport=self.transport, follow_redirects=False, trust_env=False) as client:
            for indexer in indexers:
                try:
                    caps = parse_capabilities(_xml(client, indexer, {"t": "caps"}, deadline))
                    search = caps.searching.search if caps.searching else None
                    if not search or not search.available or "q" not in search.supported_params:
                        raise UserValueError("errors.resourceSearch.noCodeSearch")
                    limit = min(MAX_ITEMS, max(1, caps.limits.max or MAX_ITEMS)) if caps.limits else MAX_ITEMS
                    items = parse_torznab(_xml(client, indexer, {
                        "t": "search", "q": query, "cat": "6000", "limit": str(limit)}, deadline))
                    successful += 1
                    budget = [MAX_TORRENTS]

                    def fetch(link: str, indexer=indexer, budget=budget) -> str | None:
                        if budget[0] <= 0:
                            return None
                        budget[0] -= 1
                        return _torrent_hash(client, indexer, link, deadline)
                    for item in items[:MAX_ITEMS]:
                        row = candidate(item, indexer, code, filters, fetch, rejected)
                        if row is None:
                            continue
                        prior = found.get(row["info_hash"])
                        if prior:
                            prior["origins"] = sorted(set(prior["origins"] + row["origins"]))
                            prior["seeders"] = max(prior["seeders"], row["seeders"])
                        else:
                            found[row["info_hash"]] = row
                except (httpx.HTTPError, TimeoutError, UnicodeError, ParseError, TorznabAPIError) as error:
                    warnings.append(Said("labels.resourceSearch.indexerFailed", indexer=indexer['name']))
                    if (delay := transient_delay(error)) is not None:
                        retry_delays.append(delay)
                except ValueError as error:
                    warnings.append(Said("labels.resourceSearch.indexerError", indexer=indexer['name'],
                                         error=nested_message(error)))
        def rank(row):
            target = row[filters.goal] if filters.goal in ("chinese", "uncensored") else row["resolution"]
            return (-int(target), -row["resolution"], -row["seeders"], row["size"], row["info_hash"])
        if not found and rejected:
            # 一条都没留下时说清是哪种「没有」：索引器里有、只是没过筛选，换体积区间或换来源还有救。
            counts = [Said("labels.resourceSearch.rejectedCount", reason=Said(code), count=rejected[key])
                      for key, code in REJECT_REASONS.items() if rejected[key]]
            warnings.append(Said("labels.resourceSearch.allRejected", total=sum(rejected.values()), counts=counts))
        return {"ok": successful > 0, "state": "ready" if successful else "error",
                "retry_after": max(retry_delays) if retry_delays else None,
                "items": sorted(found.values(), key=rank), "warnings": warnings, **parallel("warning", warnings),
                "rejected": dict(rejected),
                **coded("error", "" if successful else Said("labels.resourceSearch.allFailed"))}
