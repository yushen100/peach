"""DMM 同号特典版：商品号判定，以及通常版页面问一次 DMM 有没有对应的特典版。

SOD 的特典版在通常版商品号后加 `v`（`1sdjs00304v`，官方番号 SDJS-304-V），内容是通常版正片加特典映像，
番号归到通常版（`sources.dmm.code_from_cid`）。浏览器入库时用户可以指定要哪一版，挑种子按它优先。

蓝光版另有品番（GRABD-039 对应配信版 GRACE-039），按标题找它对应的配信版（`digital_edition`），
新作列表据此把蓝光版并入配信版。
"""
from __future__ import annotations

import re
import threading
import time
import unicodedata
from collections import OrderedDict
from pathlib import Path

from .catalog_rules import BLURAY_TITLE as _BLURAY
from .catalog_rules import EDITION_TITLE_WORDS as _EDITION_WORDS

#: 特典版商品号：通常版商品号（数字或 `h_数字` 目录头、字母段、序号）后紧跟一个 `v`。
_BONUS_CID = re.compile(r"(?:h_\d+|\d+)?[a-z]+\d+v")
#: 能有特典版的通常版商品号：序号后没有尾字母。`1dandy00851c` 这类带尾字母的是另一部作品，不问。
_REGULAR_CID = re.compile(r"(?:h_\d+|\d+)?[a-z]+\d+")
EXISTS_QUERY = "query PeachEdition($id: ID!) { ppvContent(id: $id) { id } }"
#: 每个商品号的答案留在进程里；同一部作品的页面反复打开不再问 DMM。
CACHE_LIMIT = 4096
#: 问不到（地区限制、超时、限流）时这段时间内不再问，识别照常只给一个添加按钮。
FAILURE_PAUSE = 600.0
TIMEOUT = 5.0


#: 可能是分段发售的商品号：整片商品号后多一个尾字母（`sora00613a`）；特典版的 `v` 另有规则，不算。
_PART_CID = re.compile(r"((?:h_\d+|\d+)?[a-z]+\d+)[a-uw-z]")


def bonus_cid(cid: str) -> bool:
    return bool(_BONUS_CID.fullmatch(str(cid or "").lower()))


class EditionProbe:
    """问 DMM 某个商品号在不在：通常版有没有对应的特典版，分段商品号有没有整片。

    任何失败都按「没有」答：识别照旧，只是少一个按钮或保留尾字母。
    """

    def __init__(self, secrets_root: Path, *, transport_factory=None, clock=time.monotonic):
        self.secrets_root = Path(secrets_root)
        self.transport_factory = transport_factory
        self.clock = clock
        self.lock = threading.Lock()
        self.answers: OrderedDict[str, bool] = OrderedDict()
        self.paused_until = 0.0

    def __call__(self, cid: str) -> bool:
        """通常版商品号有没有对应的特典版。"""
        cid = str(cid or "").lower()
        return bool(_REGULAR_CID.fullmatch(cid)) and self._exists(cid + "v")

    def whole(self, cid: str) -> str:
        """分段发售的商品号对应的整片商品号；DMM 上整片不在售或问不到时为空。

        `sora00613a`、`sora00613b` 是整片 `sora00613` 的分段，资源按整片收录；`1dandy00851c` 没有整片，
        尾字母是另一部作品的身份，保留。
        """
        matched = _PART_CID.fullmatch(str(cid or "").lower())
        return matched[1] if matched and self._exists(matched[1]) else ""

    def _exists(self, cid: str) -> bool:
        with self.lock:
            if cid in self.answers:
                self.answers.move_to_end(cid)
                return self.answers[cid]
            if self.clock() < self.paused_until:
                return False
        try:
            exists = self._ask(cid)
        except Exception:  # noqa: BLE001 - 探测只决定按钮与尾字母，失败一律按不在处理。
            with self.lock:
                self.paused_until = self.clock() + FAILURE_PAUSE
            return False
        with self.lock:
            self.answers[cid] = exists
            while len(self.answers) > CACHE_LIMIT:
                self.answers.popitem(last=False)
        return exists

    def _ask(self, cid: str) -> bool:
        from .scraping_access import SourceTransport
        from .sources.base import Session
        from .sources.dmm import DmmSource

        transport = (self.transport_factory() if self.transport_factory else SourceTransport(
            self.secrets_root, max_requests=1, max_bytes=64 * 1024, max_seconds=TIMEOUT, allow_browser=False))
        source = DmmSource()
        session = Session(transport, deadline=time.monotonic() + TIMEOUT)
        try:
            with source.holding(session):
                data = source.graphql(EXISTS_QUERY, {"id": cid}, session=session)
        finally:
            close = getattr(transport, "close", None)
            if callable(close):
                close()
        item = data.get("ppvContent")
        return isinstance(item, dict) and item.get("id") == cid


#: 按标题搜 DMM 取几条、核几条详情；同名系列的前后作也会出现在结果里。
BLURAY_SEARCH_LIMIT = 10
BLURAY_DETAIL_ATTEMPTS = 3
BLURAY_SECONDS = 20.0


def bluray_title(title) -> bool:
    return bool(_BLURAY.search(str(title or "")))


def _folded(text) -> str:
    return unicodedata.normalize("NFKC", str(text or "")).casefold()


def edition_title_key(title, names=()) -> str:
    """两个版本比标题用的键：去掉版本字样、出演者名、标点与长音符，只留文字和数字。

    同一部片 JavDB 写 `Pretty Glamour ― 誰もが恋する私に ― /藤森里穂（ブルーレイディスク）`，
    DMM 配信版写 `Pretty Glamour ー 誰もが恋する私に ー 藤森里穂`；两边的破折号一个是标点、一个是长音符。
    """
    text = _EDITION_WORDS.sub(" ", _folded(title))
    for name in sorted((_folded(name) for name in names), key=len, reverse=True):
        if name.strip():
            text = text.replace(name.strip(), " ")
    return "".join(char for char in text if char != "ー" and unicodedata.category(char)[0] in "LN")


def digital_edition(title, performers, secrets_root: Path, *, transport=None) -> str:
    """蓝光版对应的 DMM 配信版官方番号；对不上或不唯一时为空。

    蓝光版另有品番，DMM 配信版只收配信版的番号，而且序号也可能不同（REBDB-1006 的配信版是
    REBD-1021），只能按标题找：去掉版本字样后标题相同、出演者有交集的才算同一部。
    问不到时抛出，调用方保留原番号。
    """
    from .catalog_rules import normalise_code_key
    from .jav_cover_fetch import HostLimitedTransport
    from .scraping_access import SourceTransport
    from .sources.base import Session
    from .sources.dmm import SEARCH_QUERY, DmmSource

    performers = [str(name).strip() for name in performers or () if str(name or "").strip()]
    words = " ".join(re.findall(r"\w+", _EDITION_WORDS.sub(" ", unicodedata.normalize("NFKC", str(title or "")))))
    if not bluray_title(title) or len(edition_title_key(title, performers)) < 4 or not words:
        return ""
    owned = transport is None
    transport = transport or HostLimitedTransport(SourceTransport(
        secrets_root, max_requests=1 + BLURAY_DETAIL_ATTEMPTS, max_bytes=1024 * 1024,
        max_seconds=BLURAY_SECONDS, allow_browser=False), 2)
    found = set()
    try:
        source = DmmSource()
        session = Session(transport, deadline=time.monotonic() + BLURAY_SECONDS)
        with source.holding(session):
            data = source.graphql(SEARCH_QUERY, {"limit": BLURAY_SEARCH_LIMIT, "sort": "RELEASE_DATE",
                                                 "queryWord": words}, session=session)
            rows = ((data.get("legacySearchPPV") or {}).get("result") or {}).get("contents") or []
            for cid in [row.get("id") for row in rows if isinstance(row, dict)][:BLURAY_DETAIL_ATTEMPTS]:
                item = source.content(str(cid), session=session) or {}
                code = normalise_code_key(item.get("makerContentId"))
                if code and _same_work(item, title, performers):
                    found.add(code)
    finally:
        if owned:
            transport.close()
    return found.pop() if len(found) == 1 else ""


def _same_work(item: dict, title, performers: list[str]) -> bool:
    """DMM 这条商品与蓝光版是不是同一部：标题键相同，两边都有出演者时至少一人相同。"""
    cast = [str(actor.get("name") or "") for actor in item.get("actresses") or [] if isinstance(actor, dict)]
    names = [*performers, *cast]
    if edition_title_key(item.get("title"), names) != edition_title_key(title, names):
        return False
    return not performers or not cast or bool({_folded(name) for name in performers} & {_folded(name) for name in cast})
