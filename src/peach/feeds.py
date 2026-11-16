"""番号发现源：订阅拉取、条目解析、未入库的番号壳（ADR-0042）。

Feed 只回答一个问题——最近出了哪些番号。一次拉取的全部产物是一条「这个源见过这个条目」
的记录和一条「这个番号还没入库」的记录；不下载种子、不下载 enclosure、不建目录、
不碰任何媒体文件。

订阅有两类，都按人：JavDB 演员页当伪 Feed 抓，由人物页的「订阅新作」开关或订阅源页签按名字
勾选的演员卡，按这位的 JavDB 身份现拼地址（ADR-0047、ADR-0083）；DMM 按女优编号列的片单，
编号取账本里已刮到的 DMM 证据（ADR-0135）。页面不送地址，所以这里没有「任意地址」这条入口。

**解析只吃已下载的字节**，地址由调用方自己取（`peach.http` 的 transport 加主机限流）。
把地址交给一个会自己发 HTTP 的解析器，等于绕过项目的代理、限流、超时与预算闸门。
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin, urlsplit, urlunsplit

from .catalog_rules import normalise_code_key, release_code_from_text
from .coded_text import Said, coded, columns, restored
from .content_words import COMPILATION_TITLE, DMM_HOURS, DMM_MINUTES, JAVDB_WORK_COUNT
from .entities import normalize_entity_name
from .user_messages import UserValueError

#: JavDB 演员页当伪 Feed 抓。它按发行日排在前面，所以「还没发行的作品」会先出现。
KIND_JAVDB_ACTOR = "javdb-actor"
#: DMM 按女优编号列的片单（GraphQL）。预购排在最前，番号是官方 `makerContentId`。
KIND_DMM_ACTRESS = "dmm-actress"

KIND_LABELS = {KIND_JAVDB_ACTOR: "labels.feeds.kind.javdbActor", KIND_DMM_ACTRESS: "labels.feeds.kind.dmmActress"}

#: DMM 片单那一类的订阅地址：用户点得开的女优片单页，同时是 `feed_source.url` 的去重键。
#: 拉取不 GET 它，而是按地址里的编号问 GraphQL。
DMM_ACTRESS_PAGE = "https://video.dmm.co.jp/av/list/?actress={id}"
#: 片单条目指向的商品页，与 `sources.dmm.CONTENT_PAGE` 同一个。
DMM_CONTENT_PAGE = "https://video.dmm.co.jp/av/content/?id={cid}"
#: 哪些外部编号是 DMM 的女优编号：DMM 自己的详情，和 r18.dev（DMM 目录的镜像，同一套 id）。
DMM_ACTRESS_PROVIDERS = ("dmm", "r18dev")
_DMM_ACTRESS_ID = re.compile(r"^\d{1,10}$")

#: 拉取间隔。JavDB 按出口 IP 计配额，一张一天才更新几条的页面拉得再密也只是花配额。
DEFAULT_INTERVAL_MINUTES = 360

#: 定时拉取多久看一次有没有到期的源（ADR-0134）。每个源仍按自己的间隔拉，这一档只决定
#: 到期之后最多再等多久；源在间隔窗口里各占一个相位，一跳只拉落在这半小时里的那几个。
TICK_MINUTES = 30

#: 相位散列用的黄金比例小数部分：连续的 id 落在窗口里也是均匀铺开的，几个源时也不扎堆。
_GOLDEN = 0.6180339887498949

#: 一次拉取最多解析多少条。源正常一页几十条，异常的那种（被替换成别的页面、
#: 被镜像站塞进整站索引）会给出几千条，那不该变成几千个壳。
MAX_ENTRIES = 200

#: 一轮拉取最多派多少部新作品给刮削后继，所有新作品仍建壳等待后续批次。
#: 真正的后继上限由 task_runs.MAX_FOLLOWUPS 判，避免首次订阅把整页历史排成任务。
MAX_NEW_PER_POLL = 20

#: 切词元用的分隔符。标题里的番号被剧情简介夹着时，整段丢给
#: `release_code_from_text` 认不出来（2026-09-22 实测一份种子站标题 75 条里只认出 3 条）。
_TOKEN = re.compile(r"[^\s\[\]()（）【】{}、,，/|_+]+")

#: JavDB 演员页的一部作品：`/v/<id>` 是条目身份，`<strong>` 里是干净的番号，
#: `.meta` 是发行日。固件照抓回来的那份 HTML 写，不按记忆重画。
_JAVDB_BOX = re.compile(
    r'<a href="(?P<href>/v/[A-Za-z0-9]+)" class="box"'
    r'.*?<div class="video-title"><strong>(?P<code>[^<]*)</strong>(?P<title>.*?)</div>'
    r'.*?<div class="meta">\s*(?P<date>\d{4}-\d{2}-\d{2})',
    re.S)
_TAGS = re.compile(r"<[^>]+>")
#: 演员页标题栏：站上这一页挂在哪个名字下，和页面自报的作品数。一位女优常有两页，
#: 本名一页、旧艺名一页（森日向子的另一页挂在「白石アイリ」下），名字是区分两行的唯一线索。
_JAVDB_ACTOR_NAME = re.compile(r'<span class="actor-section-name">([^<]*)</span>')
_JAVDB_WORK_COUNT = re.compile(JAVDB_WORK_COUNT)

#: 合集的标题记号：精选、总集、连发。`BEST` 前后不许紧挨字母，`BESTIE` 那种词不算。
_COMPILATION_TITLE = re.compile(COMPILATION_TITLE)
_HOURS = re.compile(DMM_HOURS)
_MINUTES = re.compile(DMM_MINUTES)
#: 片长到这个数就是剪辑合集：单部新片两到三小时，四小时起是把旧片拼起来卖。
COMPILATION_MINUTES = 240
#: 出演人数到这个数就是合集：正常共演两三人，合集一列就是十几二十个名字。
COMPILATION_PERFORMERS = 8


#: 合集的两类。单人合集是一位女优自己的精选（「涼森れむ 8時間 BEST」），订阅她的人
#: 可能正想要；大合集是一串人的片段拼起来卖。两类各有一个开关，默认只收起大合集。
SOLO_COMPILATION = "solo"
GROUP_COMPILATION = "group"
#: 切片：把已经出过的正片剪成十几分钟单卖。ハイライト 的 HIGM-218 就是 MRSS-124 里的
#: 一段，122 分钟剪成 13 分钟、封面印着「¥99」（2026-09-23 对过 DMM 的片长与封面）。
#: 片名照抄原片的剧情名，标题记号认不出来，只能按厂牌认。
EXCERPT = "excerpt"
EXCERPT_STUDIOS = frozenset({"ハイライト"})
DEFAULT_HIDDEN_COMPILATIONS = frozenset({GROUP_COMPILATION, EXCERPT})
#: 三个收起开关在设置里的键与各自对应的那一类，没设过的取 `DEFAULT_HIDDEN_COMPILATIONS`。
FEED_COMPILATION_SWITCHES = (
    ("feedHideGroupCompilations", GROUP_COMPILATION),
    ("feedHideSoloCompilations", SOLO_COMPILATION),
    ("feedHideExcerpts", EXCERPT),
)


def compilation_switches(settings: dict) -> dict[str, bool]:
    """设置载荷里三个收起开关的值；没设过或不是布尔的按缺省。"""
    return {key: settings[key] if isinstance(settings.get(key), bool)
            else kind in DEFAULT_HIDDEN_COMPILATIONS
            for key, kind in FEED_COMPILATION_SWITCHES}


def hidden_compilations(settings: dict) -> frozenset[str]:
    """按设置载荷，新作那一行收起哪几类合集。"""
    switches = compilation_switches(settings)
    return frozenset(kind for key, kind in FEED_COMPILATION_SWITCHES if switches[key])


def compilation_kind(title: str | None, performers: str | None,
                     studio: str | None = None) -> str | None:
    """这部新作是哪一类合集：`solo`、`group`、`excerpt`，不是合集为 None。

    新作那一行是给「她出了什么新片」看的，合集里的片段多半早就出过。判据只看壳上已有
    的标题与出演名单，读的时候现算，壳上不存（ADR-0042）：规则或开关改了，已经取回的壳
    跟着变，不用重刮。名单只列一个人、标题带精选记号或片长到四小时的是单人合集；名单
    没取到时按记号与片长算大合集，名单到八人起不看标题也是大合集。切片厂牌先于这些判。
    """
    if str(studio or "").strip() in EXCERPT_STUDIOS:
        return EXCERPT
    names =[name for name in (performers or "").split("、") if name.strip()]
    text = title or ""
    marked = (bool(_COMPILATION_TITLE.search(text))
              or any(int(hours) * 60 >= COMPILATION_MINUTES for hours in _HOURS.findall(text))
              or any(int(minutes) >= COMPILATION_MINUTES for minutes in _MINUTES.findall(text)))
    if len(names) == 1:
        return SOLO_COMPILATION if marked else None
    if marked or len(names) >= COMPILATION_PERFORMERS:
        return GROUP_COMPILATION
    return None


def register_functions(connection: sqlite3.Connection,
                       hidden: frozenset[str] = DEFAULT_HIDDEN_COMPILATIONS) -> None:
    """把「这条收起不列」挂到这条连接上，SQL 里按同一份实现筛，分页的条数才对得上。"""
    connection.create_function(
        "is_feed_hidden", 3,
        lambda title, performers, studio: compilation_kind(title, performers, studio) in hidden,
        deterministic=True)


def stamp(moment: datetime | None = None) -> str:
    """ISO-8601 UTC 文本，与 `task_run`、`entity` 同一种写法。"""
    return (moment or datetime.now(timezone.utc)).astimezone(
        timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def scan_code(text: str | None, *, product: bool = False) -> str | None:
    """从一段文本里找出番号：整段先试一次，不成再逐词元试。

    番号判据复用 `catalog_rules`；明确商品身份使用保留尾字母的解析器，普通文件名
    使用文本解析器。两条路径都按第一个可识别番号确定身份，不在标题后段另挑作品。
    """
    if not text:
        return None
    from .catalog_rules import release_code_from_product
    parser = release_code_from_product if product else release_code_from_text
    whole = parser(text)
    if whole:
        return whole
    for token in _TOKEN.findall(str(text)):
        found = parser(token)
        if found:
            return found
    return None


@dataclass(frozen=True)
class FeedEntry:
    """一条已解析的条目。`item_key` 是这个源内部的去重真值。"""

    item_key: str
    title: str
    link: str | None = None
    published_at: str | None = None
    #: 来源明说的商品番号（DMM 的 `makerContentId`）。给了就只认它，空串表示来源没给出能认的番号，
    #: 不再回头从标题里找；为 None 时才按标题找。
    product_code: str | None = None
    #: 来源列表里就带着的出演名单（`、` 分隔）与厂牌。为 None 表示这个来源列表里没有。
    performers: str | None = None
    studio: str | None = None

    @property
    def code(self) -> str | None:
        if self.product_code is not None:
            return scan_code(self.product_code, product=True) or None
        return scan_code(self.title) or None


@dataclass(frozen=True)
class ParsedFeed:
    title: str | None
    entries: tuple[FeedEntry, ...]


def _published(value: str) -> str | None:
    """`.meta` 里的发行日按 UTC 零点读，认不出就当没有。

    它只有日期、没有时区。按本机时区读的话，同一页在 UTC+8 的机器上整体前移八小时，
    发行日 2026-10-20 变成 10-19，而排序和「这一天发了什么」都按它算。
    发布时间是排序真值：拿不到它才回退到首次见到的时间。把认不出的日期当成「现在」
    会让一整页历史条目全部挤在同一秒，那之后就再也分不出先后了。
    """
    try:
        return stamp(datetime.fromisoformat(value).replace(tzinfo=timezone.utc))
    except ValueError:
        return None


def parse_javdb_actor(html: str, base_url: str) -> ParsedFeed | None:
    """JavDB 演员页 → 条目，`title` 是这一页挂的名字。一条作品都解不出时返回 None。

    解不出不等于这个人没作品：带查询串的地址回过一份 27 KB、一条作品都没有的页面
    （2026-09-22 实测；09-23 同一种 `?t=s` 地址回的是 85 KB、40 条的完整页），不带参数
    的是 78 KB 的完整页。所以这种情况按拉取失败报出来，而不是当成「这次没有新作」——
    后者会把一个坏掉的源伪装成安静的源。

    例外只有页面自己说「0 部影片」的那种：旧艺名页常年挂着空列表（`MmbDR` 白石アイリ，
    2026-09-28 实测），那是一个真实存在、只是没有作品的源，返回零条。判据是页面自报的
    计数，不是「暂无内容」那行字——计数不为零却没有作品，照旧算失败。
    """
    if not html:
        return None
    named = _JAVDB_ACTOR_NAME.search(html)
    name = (named.group(1).strip() or None) if named else None
    rows: list[FeedEntry] = []
    for found in list(_JAVDB_BOX.finditer(html))[:MAX_ENTRIES]:
        href = found.group("href")
        code = found.group("code").strip()
        tail = _TAGS.sub("", found.group("title")).strip()
        title = f"{code} {tail}".strip() if code else tail
        rows.append(FeedEntry(href, title, urljoin(base_url, href),
                              _published(found.group("date"))))
    if not rows:
        counted = _JAVDB_WORK_COUNT.search(html)
        if name and counted and int(counted.group(1)) == 0:
            return ParsedFeed(name, ())
        return None
    return ParsedFeed(name, tuple(rows))


def parse_dmm_actress(works) -> ParsedFeed:
    """DMM 片单（`sources.dmm.ActressWorks`）→ 条目。条目身份是 cid，番号只认官方 `makerContentId`。

    `makerContentId` 先过 `catalog_rules.release_code_from_product`，和 JavDB 那一路落成同一种写法
    （`MXDLP-0343` → `MXDLP-343`），壳上的唯一番号才会把两个来源报的同一部并成一个。分卷
    `MCSR-640-02` 这种认不出番号的照样记一条、不建壳，和 JavDB 页上认不出的条目同一种待遇。
    片单为空就是零条：编号是从 DMM 自己的详情里取的，这位在 DMM 上没有配信作品（Prestige 专属）
    时接口如实答零。
    """
    rows: list[FeedEntry] = []
    for work in list(works.works)[:MAX_ENTRIES]:
        code = scan_code(work.maker_code, product=True) if work.maker_code else None
        title = f"{code} {work.title}".strip() if code else work.title
        rows.append(FeedEntry(
            work.cid, title, DMM_CONTENT_PAGE.format(cid=work.cid),
            _published(work.release_date) if work.release_date else None,
            product_code=work.maker_code, performers="、".join(work.performers),
            studio=work.studio or None))
    return ParsedFeed(works.name or None, tuple(rows))


def dmm_actress_url(actress_id: str) -> str:
    if not _DMM_ACTRESS_ID.match(str(actress_id or "")):
        raise UserValueError("errors.feeds.dmmActressIdDigits")
    return DMM_ACTRESS_PAGE.format(id=actress_id)


def dmm_actress_id(url: str) -> str:
    """订阅地址里的女优编号；地址不是 DMM 片单那一种时交空串。"""
    prefix = DMM_ACTRESS_PAGE.split("{id}")[0]
    text = str(url or "")
    found = text[len(prefix):] if text.startswith(prefix) else ""
    return found if _DMM_ACTRESS_ID.match(found) else ""


def solo_works_url(url: str) -> str:
    """演员页换到「單體作品」筛选：同一个人，合集少得多，能翻到更早的正片。"""
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "t=s", ""))


def parse(kind: str, body: bytes, url: str) -> ParsedFeed | None:
    """认不出的类型当解析失败，原因落到那一行的 `last_error` 上。"""
    if kind == KIND_JAVDB_ACTOR:
        return parse_javdb_actor(body.decode("utf-8", "replace"), url)
    return None


# -- 订阅 ------------------------------------------------------------------


def normalize_url(value: object) -> str:
    """订阅地址只收 HTTPS。

    JavDB 是 HTTPS，而 Feed 拉回来的东西会直接变成用户看见的新作——中途被改写的内容
    没有任何一步会被察觉。地址解析到内网的那一层由 `http.public_https_url` 在真正发请求时挡住。
    """
    url = str(value or "").strip()
    if not url.startswith("https://"):
        raise UserValueError("errors.feeds.httpsRequired")
    return url


def kind_of(url: str) -> str:
    """订阅地址是哪一类：DMM 片单页按地址认，其余都是 JavDB 演员页。"""
    return KIND_DMM_ACTRESS if dmm_actress_id(url) else KIND_JAVDB_ACTOR


def add_source(connection: sqlite3.Connection, *, url: str, name: str = "",
               entity_id: int | None = None) -> int:
    """登记一条订阅，类型按地址认。地址重复直接拒绝——同一个源订两遍只会让同一条新作出现两次。"""
    address = normalize_url(url)
    if connection.execute("SELECT 1 FROM feed_source WHERE url=?", (address,)).fetchone():
        raise UserValueError("errors.feeds.duplicateUrl")
    cursor = connection.execute(
        "INSERT INTO feed_source(kind,name,url,entity_id,enabled,interval_minutes,"
        "created_at) VALUES(?,?,?,?,1,?,?)",
        (kind_of(address), str(name or "").strip(), address, entity_id,
         DEFAULT_INTERVAL_MINUTES, stamp()))
    return int(cursor.lastrowid)


def dmm_actress_ids(connection: sqlite3.Connection, entity_id: int) -> list[str]:
    """这位在 DMM 上的女优编号，取自已刮到的 DMM 与 r18.dev 证据（`entity_external_ref`）。

    一个人可以有几个编号：DMM 给改名后的艺名另开一号（坂道みる 的 `1047128` 与 miru 的
    `1069632`，2026-11-04 实测两号片单分别 167 与 269 部），和 JavDB 一人两页同理，每个号各订一条。
    """
    marks = ",".join("?" for _ in DMM_ACTRESS_PROVIDERS)
    return [str(row[0]) for row in connection.execute(
        "SELECT DISTINCT external_id FROM entity_external_ref WHERE entity_id=?"
        f" AND external_kind='performer' AND provider IN ({marks}) ORDER BY external_id",
        (int(entity_id), *DMM_ACTRESS_PROVIDERS)) if _DMM_ACTRESS_ID.match(str(row[0] or ""))]


def dmm_actress_pages(connection: sqlite3.Connection, entity_id: int) -> list[str]:
    return [dmm_actress_url(value) for value in dmm_actress_ids(connection, entity_id)]


def sync_dmm_sources(connection: sqlite3.Connection) -> list[int]:
    """给已在订阅的人补上 DMM 片单源，返回新建的源 id。

    订阅是按人开的（人物页那枚开关），DMM 编号却常常是开关打开之后才由刮削写进账本的，所以每轮
    拉取前对一遍。只补地址还没登记过的：用户在设置页单独停掉的那一条不会被重新打开，没有 DMM
    编号的人一条也不建，也就不为她发请求。
    """
    created: list[int] = []
    followed = [int(row[0]) for row in connection.execute(
        "SELECT DISTINCT entity_id FROM feed_source WHERE enabled=1 AND entity_id IS NOT NULL"
        " ORDER BY entity_id")]
    for entity_id in followed:
        for url in dmm_actress_pages(connection, entity_id):
            if connection.execute("SELECT 1 FROM feed_source WHERE url=?", (url,)).fetchone():
                continue
            created.append(add_source(connection, url=url, entity_id=entity_id))
    return created


def follow_entity(connection: sqlite3.Connection, entity_id: int, urls) -> list[int]:
    """人物页那枚开关打开：这位的每个 JavDB 演员页与 DMM 片单各一条源，全部启用。

    地址已经登记过的（之前关掉过，或者登记时还没挂上人物）原地启用并补上人物，不另建一条：
    `feed_item` 的去重记忆挂在那条源上，重建一条等于让整页历史再被当成新作一遍。
    """
    ids: list[int] = []
    for url in urls:
        address = normalize_url(url)
        row = connection.execute(
            "SELECT id FROM feed_source WHERE url=?", (address,)).fetchone()
        if row is None:
            ids.append(add_source(connection, url=address,
                                  entity_id=int(entity_id)))
            continue
        connection.execute(
            "UPDATE feed_source SET enabled=1, entity_id=coalesce(entity_id, ?) WHERE id=?",
            (int(entity_id), int(row["id"])))
        ids.append(int(row["id"]))
    return ids


def unfollow_entity(connection: sqlite3.Connection, entity_id: int) -> None:
    """开关关掉：两类源一起只停用不删除，再打开时这几条的去重记忆接着用。"""
    connection.execute("UPDATE feed_source SET enabled=0 WHERE entity_id=?", (int(entity_id),))


def entity_following(connection: sqlite3.Connection, entity_id: int) -> bool:
    return connection.execute(
        "SELECT 1 FROM feed_source WHERE entity_id=? AND enabled=1",
        (int(entity_id),)).fetchone() is not None


def remove_source(connection: sqlite3.Connection, source_id: int) -> None:
    """删掉一条订阅源，连同它的条目；发现过的作品留着，只断开来源。

    子表按建表时声明的 `ON DELETE CASCADE` / `SET NULL` 显式处理：连接的
    `PRAGMA foreign_keys` 是 OFF，库自己不会做。
    """
    source_id = int(source_id)
    connection.execute("DELETE FROM feed_item WHERE source_id=?", (source_id,))
    connection.execute("UPDATE feed_discovery SET source_id=NULL WHERE source_id=?", (source_id,))
    connection.execute("DELETE FROM feed_source WHERE id=?", (source_id,))


def set_enabled(connection: sqlite3.Connection, source_id: int, enabled: bool) -> None:
    connection.execute("UPDATE feed_source SET enabled=? WHERE id=?",
                       (1 if enabled else 0, int(source_id)))


def sources(connection: sqlite3.Connection) -> list[dict]:
    """订阅源清单。挂着人物的源，名字就是她在账本里的统称：用户在资料页定的那个写法，
    不是登记时从站上抄下来的。没挂人物的才用存下的名字。

    `page_name` 是上次拉取时这一页在站上挂的名字（`settle` 写进 `feed_source.name`）。
    同一个人的两页在表里名字一样，只有它说得出哪一行是旧艺名那页。排序按人物走，
    同一个人的几页挨在一起，不被页名或类型拆开；同一个人里 JavDB 演员页在前、DMM 片单在后。"""
    rows = connection.execute(
        "SELECT s.*, e.canonical_name AS entity_name,"
        " (SELECT count(*) FROM feed_item i WHERE i.source_id=s.id) AS seen"
        " FROM feed_source s LEFT JOIN entity e ON e.id=s.entity_id"
        " ORDER BY coalesce(e.canonical_name, s.name), s.kind<>?, s.id",
        (KIND_JAVDB_ACTOR,)).fetchall()
    return [{
        "id": int(row["id"]),
        "kind": row["kind"],
        **coded("kind_label", Said(KIND_LABELS[row["kind"]]) if row["kind"] in KIND_LABELS else row["kind"]),
        "name": row["entity_name"] or row["name"] or "",
        "page_name": row["name"] or "",
        "url": row["url"],
        "entity_id": row["entity_id"],
        "entity_name": row["entity_name"],
        "enabled": bool(row["enabled"]),
        "interval_minutes": int(row["interval_minutes"]),
        "last_fetched_at": row["last_fetched_at"],
        "next_fetch_at": row["next_fetch_at"],
        **coded("last_error", restored(row["last_error"], row["last_error_code"], row["last_error_params"])),
        "last_seen_count": int(row["last_seen_count"]),
        "last_new_count": int(row["last_new_count"]),
        "seen": int(row["seen"] or 0),
    } for row in rows]


def due_sources(connection: sqlite3.Connection, now: str | None = None) -> list[sqlite3.Row]:
    """到期该拉的源，等得最久的在前。从没拉过的（`next_fetch_at` 为空）总是到期，排最前。

    同一位女优的 DMM 片单在拉时，她在 JavDB 上的有碼演员页绕过不拉（`covered_by_dmm`）：两边列的是
    同一批作品，JavDB 那页只多花请求。源本身不停用，DMM 片单停了或手动拉取时照常拉。
    """
    moment = now or stamp()
    rows = list(connection.execute(
        "SELECT * FROM feed_source WHERE enabled=1"
        " AND (next_fetch_at IS NULL OR next_fetch_at<=?) ORDER BY next_fetch_at, id", (moment,)))
    skipped = covered_by_dmm(connection)
    return [row for row in rows if int(row["id"]) not in skipped]


def covered_by_dmm(connection: sqlite3.Connection) -> set[int]:
    """DMM 片单已经覆盖的 JavDB 演员页源 id：同一人的 DMM 片单源在拉、上一次拉成功，且这一页不是她的無碼记录。

    DMM 不卖无码，無碼那一页照拉；记录类型读不出来的按有碼算（JavDB 上不带标记的那一条就是有碼）。
    DMM 片单还没拉过或上次失败时不绕过：刚订时两边各拉一次，DMM 出错时 JavDB 接上，不漏新作。
    """
    from .entry_links import _ref_metadata, javdb_actor_page
    rows = list(connection.execute(
        "SELECT s.id, s.url, s.entity_id FROM feed_source s WHERE s.enabled=1 AND s.kind=?"
        " AND s.entity_id IS NOT NULL AND EXISTS (SELECT 1 FROM feed_source d WHERE d.entity_id=s.entity_id"
        " AND d.enabled=1 AND d.kind=? AND d.last_fetched_at IS NOT NULL AND d.last_error IS NULL)",
        (KIND_JAVDB_ACTOR, KIND_DMM_ACTRESS)))
    covered: set[int] = set()
    for row in rows:
        uncensored = {javdb_actor_page(str(ref["external_id"])) for ref in connection.execute(
            "SELECT external_id, metadata_json FROM entity_external_ref WHERE entity_id=? AND provider='javdb'",
            (int(row["entity_id"]),)) if _ref_metadata(dict(ref)).get("uncensored") is True}
        if row["url"] not in uncensored:
            covered.add(int(row["id"]))
    return covered


def next_fetch(source_id: int, moment: datetime, interval_minutes: int) -> datetime:
    """这个源下一次该拉的时刻：「现在 + 间隔」附近、落在它自己相位上的那一刻（ADR-0134）。

    不直接取「现在 + 间隔」：调度每跳之间隔着 `TICK_MINUTES`，拉完那一刻总比到期晚一点，
    按它往后排会一轮轮漂，同一时刻加的源也永远在同一跳一起到期。相位由 id 定，过渡那一轮
    间隔落在半个到一个半间隔之间，之后每次都回到同一个相位。
    """
    period = max(1, int(interval_minutes)) * 60
    phase = (int(source_id) * _GOLDEN) % 1 * period
    base = moment + timedelta(seconds=period)
    offset = (phase - base.timestamp()) % period
    if offset > period / 2:
        offset -= period
    return base + timedelta(seconds=offset)


def settle(connection: sqlite3.Connection, source_id: int, *, error: str | None = None,
           etag: str | None = None, last_modified: str | None = None,
           interval_minutes: int, seen: int = 0, new: int = 0,
           page_name: str | None = None, now: datetime | None = None,
           retry_at: datetime | None = None) -> None:
    """结算一次拉取。`page_name` 是这一页在站上挂的名字，解不出时留着上次的。

    失败也按同一间隔排下一次，不做指数退避——退避要么在这里写第二套判据，要么让一个
    临时挡回来的源沉默半天。下次时间在所有返回路径上都写，任何一种结局都不会让源卡住。
    `retry_at` 是来源冷却的结束时刻：被整站挡回来的不是这个源的错，冷却一过就该再拉。
    `error` 是 `Said` 时旁边一并存下 code 与参数，界面按当前语言显示。
    """
    moment = now or datetime.now(timezone.utc)
    upcoming = retry_at or next_fetch(source_id, moment, interval_minutes)
    connection.execute(
        "UPDATE feed_source SET last_error=?,last_error_code=?,last_error_params=?,last_fetched_at=?,"
        "next_fetch_at=?,etag=COALESCE(?,etag),last_modified=COALESCE(?,last_modified),"
        "name=COALESCE(?,name),last_seen_count=?,last_new_count=? WHERE id=?",
        (error, *columns(error), stamp(moment), stamp(upcoming),
         etag, last_modified, page_name or None, int(seen), int(new), int(source_id)))


def defer(connection: sqlite3.Connection, source_id: int, until: datetime) -> None:
    """这一轮没轮到问就撞上了来源冷却：只把下次时间挪到冷却结束，上次的结论原样留着。"""
    connection.execute("UPDATE feed_source SET next_fetch_at=? WHERE id=?",
                       (stamp(until), int(source_id)))


# -- 条目与壳 --------------------------------------------------------------


def seen_keys(connection: sqlite3.Connection, source_id: int) -> set[str]:
    return {str(row[0]) for row in connection.execute(
        "SELECT item_key FROM feed_item WHERE source_id=?", (int(source_id),))}


def in_library(connection: sqlite3.Connection, code: str) -> bool:
    """这个番号已经入库了没有。

    比的是归一化之后的键：账本里写的是 `SSIS-950`，源里可能给 `ssis00950`，
    按原文比会把同一部片当成两部。`normalise_code_key` 由 `LedgerDatabase.connect`
    注册成 SQL 函数，两侧因此是同一份实现。标「已消失」的行文件已不在盘上，不算入库
    （ADR-0087）；回收站里的仍算，那是用户看过之后丢的。只算视频：番号目录里的封面图、
    广告图也带着番号，视频删掉后它们还在，不能让一张封面把这部片算成在库。
    """
    key = normalise_code_key(code)
    if not key:
        return False
    row = connection.execute(
        "SELECT 1 FROM asset WHERE medium='video' AND code IS NOT NULL AND COALESCE(disposal,'')<>'vanished' "
        "AND normalise_code_key(code)=? LIMIT 1",
        (key,)).fetchone()
    return row is not None


def record_entry(connection: sqlite3.Connection, source_id: int, entry: FeedEntry,
                 *, code: str | None, now: str | None = None) -> bool:
    """记下「这个源见过这一条」。已经见过返回 False。"""
    moment = now or stamp()
    try:
        connection.execute(
            "INSERT INTO feed_item(source_id,item_key,code,title,link,published_at,"
            "first_seen) VALUES(?,?,?,?,?,?,?)",
            (int(source_id), entry.item_key, code, entry.title or None, entry.link,
             entry.published_at, moment))
    except sqlite3.IntegrityError:
        return False
    return True


def create_shell(connection: sqlite3.Connection, code: str, *, source_id: int | None,
                 title: str | None = None, link: str | None = None,
                 release_date: str | None = None, performers: str | None = None,
                 studio: str | None = None,
                 entity_id: int | None = None, now: str | None = None) -> int | None:
    """给一个还没入库的番号建壳。已入库或已有壳时返回 None。

    两层去重里的第二层就在这三行：先查 `asset`，再靠 `code` 上的唯一约束兜住并发。
    来源列表里就带着出演与厂牌的（DMM 片单）先写上，取资料之前合集判据就有名单可看。
    """
    if in_library(connection, code):
        return None
    moment = now or stamp()
    try:
        cursor = connection.execute(
            "INSERT INTO feed_discovery(code,source_id,title,link,release_date,performers,"
            "studio,discovered_at) VALUES(?,?,?,?,?,?,?,?)",
            (code, source_id, title, link, release_date, performers or None, studio or None,
             moment))
    except sqlite3.IntegrityError:
        return None
    discovery_id = int(cursor.lastrowid)
    if entity_id:
        link_entity(connection, discovery_id, int(entity_id))
    return discovery_id


def link_entity(connection: sqlite3.Connection, discovery_id: int, entity_id: int) -> None:
    connection.execute(
        "INSERT OR IGNORE INTO feed_discovery_entity(discovery_id,entity_id) VALUES(?,?)",
        (int(discovery_id), int(entity_id)))


def match_performers(connection: sqlite3.Connection, names) -> list[int]:
    """按女优名找账本里的实体。正名与别名都查，认不出的名字直接丢掉。

    这里只做关联，不建实体：Feed 发现的是番号，不是人。凭一个来源给的名字往账本里
    加一个人，等于让未经复核的断言变成实体。
    """
    found: list[int] = []
    for name in names or []:
        key = normalize_entity_name(str(name or ""))
        if not key:
            continue
        row = connection.execute(
            "SELECT id FROM entity WHERE kind='performer' AND normalized_name=?",
            (key,)).fetchone()
        if row is None:
            row = connection.execute(
                "SELECT entity_id AS id FROM entity_alias a"
                " JOIN entity e ON e.id=a.entity_id AND e.kind='performer'"
                " WHERE a.normalized_alias=? LIMIT 1", (key,)).fetchone()
        if row is not None and int(row["id"]) not in found:
            found.append(int(row["id"]))
    return found


def poll(connection: sqlite3.Connection, source: sqlite3.Row,
         parsed: ParsedFeed, hidden: frozenset[str] = frozenset()) -> dict:
    """把一次拉取的解析结果落库，返回这一轮的账。

    写入顺序是源给出的倒序：无日期的条目按旧→新拿到递增的 id，于是「没有发布时间」
    的那些在列表里也还排得出先后。建壳仍按源给出的顺序，最新的先排上刮削。

    条目自带出演名单的（DMM 片单），按合集类型过滤后只记录条目、不建壳。
    其余新番号全部建壳，避免达到每轮新作数量上限后丢失待处理资格；
    本轮后继仅派前二十部，其余留给存量队列逐批处理。
    """
    source_id = int(source["id"])
    entity_id = source["entity_id"]
    already = seen_keys(connection, source_id)
    fresh = [entry for entry in parsed.entries if entry.item_key not in already]
    moment = stamp()
    codes: list[tuple[FeedEntry, str | None]] = []
    for entry in reversed(fresh):
        code = entry.code
        record_entry(connection, source_id, entry, code=code, now=moment)
        codes.append((entry, code))
    created: list[tuple[int, str]] = []
    skipped = compilations = 0
    for entry, code in reversed(codes):
        if code is None:
            skipped += 1
            continue
        if (entry.performers is not None
                and compilation_kind(entry.title, entry.performers, entry.studio) in hidden):
            compilations += 1
            continue
        shell = create_shell(connection, code, source_id=source_id,
                             title=entry.title or None, link=entry.link,
                             release_date=(entry.published_at or "")[:10] or None,
                             performers=entry.performers, studio=entry.studio,
                             entity_id=entity_id, now=moment)
        # 全部新番号先建壳；仅限制这一轮派出的后继。未派的壳由存量队列继续处理。
        if shell is not None and len(created) < MAX_NEW_PER_POLL:
            created.append((shell, code))
    return {"seen": len(parsed.entries), "fresh": len(fresh),
            "without_code": skipped, "compilations": compilations, "created": created}
