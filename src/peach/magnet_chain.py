"""按入口查磁力：直接添加优先命中，待找清单汇集多个来源。

这一层只返回候选，不提交下载。站点解析与排序分开：来源顺序回答「先问谁」，
``rank_candidates`` 回答同一来源的多个版本选哪个。文件多不构成拒绝；只有明显预告、
安装包或推广附件会降低排序。manko.fun 候选带 ``watermark_check='bypassed'``，其余
候选在磁力元数据阶段只能标记为 ``pending``，留给到盘后的媒体检查。
"""
from __future__ import annotations

import html
import json
import re
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup

from .catalog_rules import normalise_code_key, release_code_from_text, same_release_code
from .coded_text import Said, coded, parallel
from .content_words import PROMO_NAME, TRAILER_NAME
from .downloads import parse_magnet
from .jav_cover_fetch import HostLimitedTransport
from .scripting import HostLimiter
from .metadata import relay_args
from .javdb_public import (_CACHE_ROOT, PUBLIC_API, PublicIdentityAmbiguous, PublicNotFound, PublicRequestBudget,
                           PublicSourceUnavailable, public_cache_scope)
from .resource_search import qualities
from .source_page_words import JAVBUS_SUBTITLES
from .scraping_access import SourcePaused, SourceTransport, paused_until
from .sources import FailureReason, Session, SourceFailure
from .sources.base import PERMANENT_REASONS
from .task_retry import transient_delay
from .user_messages import nested_message

HIGH_QUALITY = 1080
MAX_RESULTS = 8
BASE91_ALPHABET = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    "!#$%&()*+,./:;<=>?@[]^_`{|}~\""
)
_BASE91 = {character: index for index, character in enumerate(BASE91_ALPHABET)}
_SIZE = re.compile(r"(?i)\b(\d+(?:\.\d+)?)\s*(TiB|GiB|MiB|KiB|TB|GB|MB|KB)\b")
_MAGNET = re.compile(r'href=["\'](magnet:\?[^"\']+)', re.I)
_PROMO_FILE = re.compile(rf"(?i)(?:\.url$|\.apk$|\.exe$|{PROMO_NAME})")


@dataclass(frozen=True)
class Source:
    key: str
    label: str


CHAIN = (
    Source("manko", "manko.fun"),
    Source("javdb", "JavDB"),
    Source("sukebei", "sukebei"),
    Source("javbus", "JavBus"),
    Source("16mag", "16mag"),
    Source("onejav", "OneJAV"),
    Source("freejavtorrent", "Free JAV Torrent"),
)
REFERENCE_ONLY = ("iJAVTorrent", "Akiba Online", "Reddit")


def decode_base91(value: str) -> bytes:
    output = bytearray()
    first = -1
    buffer = bits = 0
    for character in str(value or ""):
        decoded = _BASE91.get(character)
        if decoded is None:
            continue
        if first < 0:
            first = decoded
            continue
        combined = first + decoded * 91
        buffer |= combined << bits
        bits += 13 if combined & 8191 > 88 else 14
        while bits >= 8:
            output.append(buffer & 255)
            buffer >>= 8
            bits -= 8
        first = -1
    if first >= 0:
        output.append((buffer | first << bits) & 255)
    return bytes(output)


def resolution_of(value: object) -> int:
    text = str(value or "")
    for pattern, resolution in ((r"(?i)\b(?:2160p|4k|uhd)\b", 2160),
                                (r"(?i)\b(?:1080[pi]|fhd)\b", 1080),
                                (r"(?i)(?:\b720p\b|(?<![a-z])hd(?![a-z]))", 720)):
        if re.search(pattern, text):
            return resolution
    return 0


def size_bytes(value: object) -> int:
    if isinstance(value, (int, float)):
        return max(0, int(value))
    match = _SIZE.search(str(value or ""))
    if not match:
        return 0
    unit = match.group(2).casefold()
    exponent = {"kb": 1, "kib": 1, "mb": 2, "mib": 2,
                "gb": 3, "gib": 3, "tb": 4, "tib": 4}[unit]
    return int(float(match.group(1)) * 1024 ** exponent)


def _normalise(item: dict, source: Source, code: str) -> dict | None:
    uri = str(item.get("uri") or item.get("magnet") or "")
    try:
        magnet = parse_magnet(uri)
    except ValueError:
        return None
    name = str(item.get("name") or magnet.name or magnet.info_hash)[:500]
    # 站点搜索可以模糊命中，只有名字能确认番号时才收；manko 的搜索结果另在标题层核过。
    shown = release_code_from_text(name)
    if shown and not same_release_code(shown, code):
        return None
    raw_files = item.get("file_list") or ()
    raw_files = (raw_files,) if isinstance(raw_files, str) else raw_files
    files = [str(value)[:500] for value in raw_files if str(value).strip()][:200]
    promo_files = sum(bool(_PROMO_FILE.search(value)) for value in files)
    raw_attributes = item.get("attributes") or ()
    raw_attributes = (raw_attributes,) if isinstance(raw_attributes, str) else raw_attributes
    attributes = [str(value) for value in raw_attributes]
    quality = qualities(name, attributes, code)
    resolution = int(item.get("resolution") or resolution_of(
        " ".join((name, str(item.get("quality") or ""), " ".join(attributes)))))
    return {
        "id": magnet.info_hash, "info_hash": magnet.info_hash,
        'protocol': 'magnet', 'attributes': attributes,
        "uri": magnet.uri, "name": name, "size": size_bytes(item.get("size")),
        "size_text": str(item.get("size") or ""), "files": str(item.get("files") or ""),
        "file_count": int(item.get("file_count") or len(files) or 0),
        "file_list": files, "promo_files": promo_files,
        "resolution": resolution, "codec": str(item.get("codec") or quality["codec"]),
        "chinese": bool(item.get("chinese", quality["chinese"])),
        "uncensored": bool(item.get("uncensored", quality["uncensored"])),
        "seeders": int(item.get("seeders") or item.get("seeds") or 0),
        "peers": int(item.get("peers") or 0), "date": str(item.get("date") or "")[:100],
        "source": source.label, "origins": [source.label],
        "source_url": str(item.get("source_url") or ""),
        "watermark_check": "bypassed" if source.key == "manko" else "pending",
    }


def rank_candidates(items: list[dict], goal: str = "quality") -> list[dict]:
    """先画质、再做种、最后正片体积；附属文件只轻微降序，不作硬门槛。"""
    unique: dict[str, dict] = {}
    for item in items:
        prior = unique.get(item["info_hash"])
        if prior is None:
            unique[item["info_hash"]] = item
            continue
        prior["origins"] = list(dict.fromkeys(prior["origins"] + item["origins"]))
        prior["seeders"] = max(prior["seeders"], item["seeders"])
        if not prior["file_list"] and item["file_list"]:
            prior["file_list"] = item["file_list"]
            prior["file_count"] = item["file_count"]
            prior["promo_files"] = item["promo_files"]
    def rank(row):
        trailer = bool(re.search(TRAILER_NAME, row["name"]))
        preferred = bool(row.get(goal)) if goal in {"chinese", "uncensored"} else False
        return (trailer, -int(preferred), -row["resolution"], -row["seeders"], row["promo_files"],
                -row["size"], row["info_hash"])
    return sorted(unique.values(), key=rank)[:MAX_RESULTS]


#: 磁链来源的主机间隔，整个进程共用：浏览器添加、想要定时查找与查找资源弹层一个接一个地查番号时，
#: 同一主机的请求不因为每次新建 `Fetcher` 而各算各的间隔、叠在一起撞限流。
MAGNET_LIMITER = HostLimiter({}, default_interval=3.0)


class Fetcher:
    def __init__(self, root: Path, *, transport=None, deadline: float | None = None):
        self.root = Path(root)
        self.resource_result = {}
        self.deadline = deadline or time.monotonic() + 45
        self._owned = transport is None
        self.transport = transport or HostLimitedTransport(
            SourceTransport(self.root, max_requests=18, max_bytes=24 * 1024 * 1024,
                            max_seconds=45), 3, limiter=MAGNET_LIMITER)
        self.session = Session(self.transport, self.deadline)

    def close(self):
        if self._owned:
            self.transport.close()

    def json(self, url: str, source: str) -> dict:
        from .sources.base import SiteConfig
        config = SiteConfig(source, source, source + "-resource", "https://" + urllib.parse.urlsplit(url).netloc,
                            (urllib.parse.urlsplit(url).hostname or "",), "community", page_limit=4 * 1024 * 1024)
        page = self.session.get(url, config=config, referer="https://manko.fun/",
                                headers={"Accept": "application/json,*/*"})
        body = json.loads(page.text)
        if isinstance(body, dict) and isinstance(body.get("data"), str):
            body = {**body, "data": json.loads(decode_base91(body["data"]).decode("utf-8"))}
        return body

    def manko(self, code: str) -> list[dict]:
        source = CHAIN[0]
        query = urllib.parse.quote(code)
        body = self.json(f"https://healertanker.com/swx/searchBy?keyword={query}&by=title&page=1&size=20",
                         source.key)
        wanted = normalise_code_key(code)
        rows = [row for row in body.get("data", ()) if isinstance(row, dict)
                and normalise_code_key(str(row.get("title") or "")) == wanted]
        found = []
        for row in rows[:4]:
            detail = self.json("https://healertanker.com/swx/movie/detail/" +
                               urllib.parse.quote(str(row.get("_id") or "")), source.key).get("data")
            if not isinstance(detail, dict):
                continue
            for value, size in ((detail.get("torrent_url_2"), detail.get("file_size_2")),
                                (detail.get("torrent_url_1"), detail.get("file_size_1"))):
                if not value:
                    continue
                item = {"uri": value if isinstance(value, str) else value.get("url"),
                        "name": (value.get("name") if isinstance(value, dict) else "") or row.get("title") or code,
                        "quality": value.get("quality") if isinstance(value, dict) else "",
                        "seeders": value.get("seeds") if isinstance(value, dict) else 0,
                        "peers": value.get("peers") if isinstance(value, dict) else 0,
                        "size": size,
                        "source_url": f"https://manko.fun/movie-info/{row.get('_id')}?series=false"}
                candidate = _normalise(item, source, code)
                if candidate:
                    found.append(candidate)
        return rank_candidates(found)

    def javdb(self, code: str) -> list[dict]:
        """匿名 API 现取磁链区与前四页评论；快照兜底的失败也记成警告，预算跟随本轮期限。
        接口要求登录时作品身份改读 javdb.com 搜索页与详情页，磁链与评论仍走接口。"""
        from .sources.javdb import page_reader
        source = CHAIN[1]
        seconds = max(1, self.deadline - time.monotonic())
        budget = PublicRequestBudget(max_requests=12, max_seconds=seconds)
        try:
            with (public_cache_scope(_CACHE_ROOT.get()) as reads, PUBLIC_API.request_budget(budget),
                  page_reader(self.root, seconds=seconds) as pages, PUBLIC_API.page_reader(pages)):
                result = PUBLIC_API.resources(code, refresh=True, review_pages=4)
        except PublicSourceUnavailable as error:
            reason = (FailureReason.PARSE_ERROR if isinstance(error, PublicIdentityAmbiguous)
                      else FailureReason.NOT_FOUND if isinstance(error, PublicNotFound) else FailureReason.NETWORK)
            raise SourceFailure(reason, *relay_args(error)) from error
        stale = [Said("labels.magnetChain.staleReused", error=read['error']) for read in reads if read['error']]
        result["warnings"] = list(dict.fromkeys([*result["warnings"], *stale]))
        self.resource_result = result
        return rank_candidates([candidate for item in result["items"] if (candidate := _normalise(
            {**item, "file_count": int(item["files"]) if item["files"].isdigit() else 0}, source, code))])

    def javbus(self, code: str) -> list[dict]:
        """JavBus 作品页带 `gid`／`img`／`uc`，磁链表由站内接口按它们返回（2026-11-16 实测 SSIS-001 有 43 条）。

        作品页与资料刮削同一页、同一份年龄门 Cookie；页面番号与问的对不上（JavBus 会给近似命中）就当站上没有。
        表格每行三列：名称（带「高清」「字幕」标签）、大小、日期。
        """
        from .sources.javbus import JAVBUS, JavBusSource
        source = Source("javbus", "JavBus")
        site = JavBusSource(JAVBUS)
        page = site.fetch(code, session=self.session)
        site.parse(page, code)
        values = {key: (re.search(rf"var\s+{key}\s*=\s*['\"]?([^'\";\s]+)", page.text) or [None, ""])[1]
                  for key in ("gid", "uc", "img")}
        if not values["gid"].isdigit():
            return []
        query = urllib.parse.urlencode({"gid": values["gid"], "lang": "zh", "img": values["img"],
                                        "uc": values["uc"] or "0", "floor": int(time.time() * 1000) % 1000})
        table = self.session.get(f"{JAVBUS.base_url}/ajax/uncledatoolsbyajax.php?{query}", config=JAVBUS,
                                 referer=page.url, headers={"X-Requested-With": "XMLHttpRequest"})
        found = []
        for row in BeautifulSoup(table.text, "html.parser").select("tr"):
            link = row.select_one('a[href^="magnet:"]')
            cells = row.select("td")
            if link is None or len(cells) < 2:
                continue
            labels = [tag.get_text(strip=True) for tag in cells[0].select("a.btn")]
            name = cells[0].get_text(" ", strip=True)
            for label in labels:
                name = name.replace(label, " ")
            item = {"uri": html.unescape(str(link.get("href") or "")), "name": " ".join(name.split()),
                    "size": cells[1].get_text(" ", strip=True), "attributes": labels,
                    "chinese": JAVBUS_SUBTITLES in labels,
                    "date": cells[2].get_text(" ", strip=True) if len(cells) > 2 else "", "source_url": page.url}
            candidate = _normalise(item, source, code)
            if candidate:
                found.append(candidate)
        return rank_candidates(found)

    def sukebei(self, code: str) -> list[dict]:
        from .sources.base import SiteConfig
        source = CHAIN[2]
        config = SiteConfig(source.key, source.label, source.key + "-resource",
                            "https://sukebei.nyaa.si", ("sukebei.nyaa.si",), "community",
                            page_limit=4 * 1024 * 1024)
        url = f"https://sukebei.nyaa.si/?f=0&c=0_0&q={urllib.parse.quote(code)}"
        page = self.session.get(url, config=config)
        found = []
        for row in BeautifulSoup(page.text, "html.parser").select("table tbody tr"):
            text = row.get_text(" ", strip=True)
            if normalise_code_key(code) not in normalise_code_key(text):
                continue
            link = row.select_one('a[href^="magnet:"]')
            if link is None:
                continue
            cells = row.select("td")
            item = {"uri": html.unescape(str(link.get("href") or "")),
                    "name": str(link.get("title") or "") or text,
                    "size": next((cell.get_text(" ", strip=True) for cell in cells if _SIZE.search(cell.get_text(" ", strip=True))), ""),
                    "seeders": cells[-3].get_text(strip=True) if len(cells) >= 3 else 0,
                    "peers": cells[-2].get_text(strip=True) if len(cells) >= 2 else 0,
                    "source_url": urllib.parse.urljoin(url, str((row.select_one('a[href^="/view/"]') or {}).get("href", "")))}
            if item["source_url"]:
                try:
                    detail = self.session.get(item["source_url"], config=config, referer=url)
                    soup = BeautifulSoup(detail.text, "html.parser")
                    item["file_list"] = [node.get_text(" ", strip=True) for node in
                                         soup.select(".torrent-file-list li")
                                         if node.get_text(" ", strip=True)][:200]
                    item["file_count"] = len(item["file_list"])
                except Exception:
                    # 文件清单是质量证据，不是磁力本身；详情页失败仍保留搜索命中。
                    pass
            candidate = _normalise(item, source, code)
            if candidate:
                found.append(candidate)
        return rank_candidates(found)


def search(root: Path, code: str, *, transport=None, min_size: int = 0,
           max_size: int = 1024 ** 4, goal: str = "quality", stop_on_preferred: bool = True,
           skip_javdb_after_preferred: bool = False) -> dict:
    """有界查询四个可直连来源（manko.fun、JavDB、sukebei、JavBus），结果按 infohash 去重合并。

    直接添加允许在 manko 高清命中时结束；`skip_javdb_after_preferred`（想要定时查找）在 manko 已有高清时
    只跳过 JavDB，其余来源照查，少花 JavDB 的请求。

    `unfetched_sources` 列出这一轮没给出答复的来源：站上没有这个番号、身份对不上属于答复，不算在内。
    来源在冷却时，`retry_after` 至少等到冷却结束。"""
    fetcher = Fetcher(root, transport=transport)
    trace, warnings, found, retry_delays, unfetched = [], [], [], [], []
    try:
        for source, collect in ((CHAIN[0], fetcher.manko), (CHAIN[1], fetcher.javdb),
                                (CHAIN[2], fetcher.sukebei), (CHAIN[3], fetcher.javbus)):
            if (skip_javdb_after_preferred and source.key == "javdb"
                    and any(item["resolution"] >= HIGH_QUALITY for item in found)):
                trace.append(f"{source.label}: skipped, manko.fun already had 1080p/2160p")
                continue
            try:
                items = collect(code)
            except SourceFailure as error:
                items = []
                warnings.append(Said("labels.magnetChain.sourceFailed", source=source.label,
                                     error=nested_message(error)))
                if error.reason != FailureReason.NOT_FOUND and error.reason not in PERMANENT_REASONS:
                    unfetched.append(source.label)
                if (delay := transient_delay(error)) is not None:
                    retry_delays.append(delay)
            except Exception as error:
                items = []
                warnings.append(Said("labels.magnetChain.sourceUnfetched", source=source.label))
                unfetched.append(source.label)
                if (delay := transient_delay(error)) is not None:
                    retry_delays.append(delay)
                elif isinstance(error, SourcePaused) and (until := paused_until(Path(root), source.key)):
                    retry_delays.append(max(0.0, until - time.time()))
            items = [item for item in items if min_size <= item["size"] <= max_size]
            found.extend(items)
            if stop_on_preferred and source.key == "manko" and any(item["resolution"] >= HIGH_QUALITY for item in items):
                trace.append(f"{source.label}: 1080p/2160p found, stopped early")
                break
            trace.append(f"{source.label}: {len(items)} found" if items else f"{source.label}: no results")
    finally:
        fetcher.close()
    incomplete = bool(warnings) and not found
    result = {"items": rank_candidates(found, goal), "warnings": warnings, "trace": trace,
            'retry_after': max(retry_delays) if retry_delays else None, "unfetched_sources": unfetched,
            'state': 'error' if incomplete else 'ready',
            **coded('error', Said('labels.magnetChain.incomplete') if incomplete else ''),
            "next_sources": [source.label for source in CHAIN[4:]],
            "reference_only": list(REFERENCE_ONLY)}
    if not stop_on_preferred:
        linked = getattr(fetcher, 'resource_result', {})
        result.update(linked_resources=linked.get('items', []), source_url=linked.get('source_url', ''))
        result['warnings'].extend(linked.get('warnings') or [])
    result.update(parallel('warning', result['warnings']))
    return result
