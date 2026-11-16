"""javdb 的作品页。

搜索页 `/search?q=<番号>&f=all` 的结果卡片带番号，只在对应唯一来源 ID 时进详情页；详情页
`?locale=zh` 下面板字段是 `番號`、`日期`、`片商`、`發行`、`系列`、`導演`、`演員`，
演员里女优带 `actor-female`，类别保留链接里的原词。它按出口 IP 计配额，限速与封禁的处理在 `scraping_access`
和调用方的主机间隔里，这里只管取页与解析。几家的值常有出入：ABW-358 在 javdb 上发行日期是
MGS 的 5/23、标题带 MGS 附注、演员里有男优，各字段按 Peach 的来源策略结算。
有隐藏 `origin-title` 时用作原标题，`current-title` 单独保存为显示标题；两者不互相改写。

一部分页面要登录才给，回的是登入页而不是 401/403（`peach.javdb.LOGIN`），搜索页与详情页都要认。

刮削先走 `JavDBPublicSource` 的匿名接口（ADR-0144）：不带 Cookie，不占 javdb.com
的出口配额，字段投影成与详情页同形的记录。接口冷却或未取得时退回详情页（ADR-0160）；详情页解析也供视频预览。
"""
from __future__ import annotations

import contextlib
import dataclasses
import re
import time
import urllib.parse

from bs4 import BeautifulSoup

from ..catalog_rules import same_release_code
from ..javdb import LOGIN, clean
from ..javdb_genres import page_genres
from ..javdb_identity import RULE
from ..javdb_public import actor_gender, public_image_url
from ..metadata import relay_args
from ..coded_text import Said, parallel
from ..user_messages import nested_message
from ..catalog_vocabulary import RESOURCE_COMMENT_SOURCE
from ..scripting import HostLimiter
from ..source_page_words import JAVDB_FIELDS, JAVDB_NO_MAGNETS
from .base import FailureReason, Page, Session, SiteConfig, SiteRecord, SiteSource, SourceFailure

#: 主机间隔由用户定（2026-09-22 定为 3 秒，每分钟 20 页）。参照面：每分钟 40～50 页会招来 3～7 天
#: 的封 IP。页面与图分别落在 `javdb.com` 与 `jdbstatic.com` 两个主机上，间隔要一起管。
JAVDB = SiteConfig(name="javdb", label="javdb", provider="javdb-page",
                   base_url="https://javdb.com", domains=("javdb.com", "jdbstatic.com", "jdbimgs.com"),
                   stage="community", interval=3.0, cookie=True)
#: 搜索页另有更严的额度：2026-11-16 实测同一出口连着搜几次就回空白 403，详情页与首页照常。
#: 整个进程的 javdb 搜索（刮削、库外详情、磁链查找）共用这一份间隔，叠在主机间隔之上。
SEARCH_INTERVAL = 12.0
SEARCH_LIMITER = HostLimiter({"javdb.com": SEARCH_INTERVAL})
#: 刮削那一问的配置。来源名、域名与 Cookie 仍是 `javdb` 这一站的（视频预览照旧读详情页，
#: 冷却按这个名字记）；解析器名另起，候选与账本证据分得清是哪一种取法。接口自己的间隔、冷却与
#: 请求预算在 `peach.javdb_public`，这一问不经会话的传输。
JAVDB_PUBLIC = dataclasses.replace(JAVDB, provider="javdb-api")
#: 一问的请求上限：签名常量两次（一天一次）、搜索、最多两份发行详情，再留两次换接口主机。
PUBLIC_REQUESTS = 7
#: 会话没有动作截止时刻时，一问最多等这么久。
PUBLIC_SECONDS = 90.0

_BOX = re.compile(r'<a href="(/v/[A-Za-z0-9]+)" class="box" title="[^"]*">.*?<strong>([^<]+)</strong>', re.S)
_PANEL = re.compile(r'<div class="panel-block[^"]*">\s*<strong>([^<:：]+)[:：]</strong>\s*(?:&nbsp;)?\s*'
                    r'<span class="value">(.*?)</span>', re.S)
#: 详情页那张封面。认标签、再从标签里取 `src`，不把属性挨着写死：站上 `class` 与 `src` 的先后
#: 两种写法都出现过，中间还可能夹着 `width`、`height` 与 `fetchpriority`。
_COVER = re.compile(r'<img\b[^>]*\bclass="video-cover"[^>]*>')
_IMG_SRC = re.compile(r'\bsrc="(https://[^"]+)"')
_ACTRESS = re.compile(r'<a\s([^>]*)>([^<]+)</a>')
#: 演員一栏里每个人名都挂着自己的资料页。那串 id 正是人物页 JavDB 入口要的东西，
#: 取名字时顺手带出来——另走一趟演员页只是把同一页再取一遍，而 javdb 的配额最紧。
_ACTOR_HREF = re.compile(r'href="/actors/([A-Za-z0-9]+)"')
_JAPANESE = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")
#: 网页上的封面与样张在 `c0.jdbstatic.com`，与 javdb.com 同算出口配额。接口 CDN 上同一路径的图
#: 不占这份配额，图片校验也只放行它（2026-11-12 实测封面、小封面、样张与头像都在）。
_CDN = "https://tp.spfcas.com/rhe951l4q/"
_STATIC = re.compile(r"https://c\d+\.jdbstatic\.com/((?:covers|samples)/[a-z0-9]{2}/[A-Za-z0-9_]+\.jpg)")
#: 评分是星级图标后面那个数，短评数在评论页签的括号里；按页面结构认，不按文字认。
_SCORE = re.compile(r'class="score-stars".*?</span>&nbsp;([0-9]+(?:\.[0-9]+)?)', re.S)
_REVIEWS = re.compile(r'class="review-tab"[^>]*>\s*<span>[^<(]*\(([0-9]+)\)')
_MISSING = "errors.javdb.notFound"


def actresses(value: str) -> list[dict]:
    """演員一栏里的女优：名字，以及她在 javdb 的演员 id。

    男优挂的是同样的 `/actors/` 链接，靠 `actor-female` 分开。href 与 class 在标签里的
    先后不固定，所以先取整段属性再判，不假设它们的次序。
    """
    found = []
    for attributes, name in _ACTRESS.findall(value):
        if "actor-female" not in attributes:
            continue
        actor = _ACTOR_HREF.search(attributes)
        found.append({"japanese_name": clean(name), "profile_source": "javdb",
                      "external_id": actor.group(1) if actor else ""})
    return found


def maker_writing(value: str) -> str:
    """片商一栏并列英文与日文（`PRESTIGE,プレステージ`），取日文那一种。"""
    parts = [part.strip() for part in value.split(",") if part.strip()]
    return next((part for part in parts if _JAPANESE.search(part)), parts[0] if parts else "")


def _cdn(url: object) -> str:
    match = _STATIC.fullmatch(str(url or ""))
    return _CDN + match[1] if match else ""


def page_search_rows(text: str) -> list[dict]:
    """搜索页的结果卡片，投影成接口搜索行：来源 id、番号与卡片标题。"""
    rows = []
    for box in BeautifulSoup(text, "html.parser").select('a.box[href^="/v/"]'):
        movie_id = box["href"].rsplit("/", 1)[-1]
        number = box.find("strong")
        if number and re.fullmatch(r"[A-Za-z0-9]+", movie_id):
            rows.append({"id": movie_id, "number": clean(number.get_text(" ", strip=True)),
                         "origin_title": clean(box.get("title") or "")})
    return rows


def _detail(text: str) -> dict:
    """详情页面板与标题区：刮削记录与接口同名投影共用一份读法。栏名是站上 `?locale=zh` 的繁体原词。"""
    panel = {clean(label): value for label, value in _PANEL.findall(text)}
    soup = BeautifulSoup(text, "html.parser")
    title = soup.select_one("strong.current-title")
    original = soup.select_one(".origin-title")
    runtime = re.search(r"\d+", clean(panel.get(JAVDB_FIELDS["runtime"], "")))
    cover = _COVER.search(text)
    cover = _IMG_SRC.search(cover.group(0)) if cover else None
    genres = (clean(link.get_text(" ", strip=True))
              for link in BeautifulSoup(panel.get(JAVDB_FIELDS["genres"], ""), "html.parser").find_all("a"))
    return {"code": clean(panel.get(JAVDB_FIELDS["code"], "")).replace(" ", ""), "soup": soup,
            "display_title": clean(title.get_text(" ", strip=True)) if title else "",
            "origin_title": clean(original.get_text(" ", strip=True)) if original else "",
            "cover": cover.group(1) if cover else "", "actors": panel.get(JAVDB_FIELDS["actors"], ""),
            "studio": maker_writing(clean(panel.get(JAVDB_FIELDS["studio"], ""))), "label": clean(panel.get(JAVDB_FIELDS["label"], "")),
            "series": clean(panel.get(JAVDB_FIELDS["series"], "")), "director": clean(panel.get(JAVDB_FIELDS["director"], "")),
            "release_date": clean(panel.get(JAVDB_FIELDS["release_date"], "")), "runtime": int(runtime.group()) if runtime else None,
            "genres": tuple(dict.fromkeys(word for word in genres if word))}


def page_movie(text: str, movie_id: str) -> dict:
    """详情页投影成接口作品资料的同名字段，库外详情、评论与磁链照旧按来源 id 取。

    男优与女优挂同样的 `/actors/` 链接，只有女优带 `actor-female`，所以没带的记作男优；头像按演员 id
    指向接口 CDN。网页不给视频预览地址，预告仍由视频预览那条路读同一页。
    """
    fields = _detail(text)
    score = _SCORE.search(text)
    reviews = _REVIEWS.search(text)
    actors = []
    for attributes, name in _ACTRESS.findall(fields["actors"]):
        actor = _ACTOR_HREF.search(attributes)
        if actor and clean(name):
            actors.append({"id": actor[1], "name": clean(name),
                           "gender": "female" if "actor-female" in attributes else "male",
                           "avatar_url": f"{_CDN}avatars/{actor[1][:2].lower()}/{actor[1]}.jpg"})
    previews = [_cdn(link.get("href")) for link in fields["soup"].select(".preview-images a.tile-item")]
    return {"id": movie_id, "number": fields["code"], "title": fields["display_title"],
            "origin_title": fields["origin_title"], "cover_url": _cdn(fields["cover"]),
            "preview_images": [url for url in previews if url], "actors": actors,
            "maker_name": fields["studio"], "publisher_name": fields["label"], "series_name": fields["series"],
            "director_name": fields["director"], "release_date": fields["release_date"],
            "duration": fields["runtime"], "score": float(score[1]) if score else None,
            "comments_count": int(reviews[1]) if reviews else 0, "tags": list(fields["genres"])}


@contextlib.contextmanager
def page_reader(secrets_root, *, seconds: float = 30.0):
    """库外详情与磁链读 javdb.com 网页的入口：带用户在「来源和凭证」里贴的 Cookie，与资料处理和视频预览
    共用 `SOURCE_LIMITER` 的主机间隔，撞登录页、验证页或封禁时按 `javdb` 这一站的来源冷却停下。"""
    from ..jav_cover_fetch import HostLimitedTransport
    from ..library_processing import SOURCE_LIMITER
    from ..scraping_access import SourceTransport

    transport = HostLimitedTransport(SourceTransport(secrets_root, max_requests=6, max_bytes=6 * 1024 * 1024,
                                                     max_seconds=seconds), JAVDB.interval, limiter=SOURCE_LIMITER)
    session = Session(transport, deadline=time.monotonic() + seconds)
    source = JavDBSource(JAVDB)
    pages = {}

    def read(path: str) -> str:
        if path in pages:
            return pages[path]
        with source.holding(session):
            pages[path] = source._page(JAVDB.base_url + path, session=session).text
        return pages[path]

    try:
        yield read
    finally:
        transport.close()


class JavDBSource(SiteSource):
    DEFAULT = JAVDB

    def search_url(self, code: str) -> str:
        return f"{self.config.base_url}/search?q={urllib.parse.quote(code)}&f=all"

    def _page(self, url: str, *, session: Session) -> Page:
        if urllib.parse.urlsplit(url).path == "/search":
            SEARCH_LIMITER.wait(url)
        page = session.get(url, config=self.config)
        if LOGIN.search(page.text):
            raise SourceFailure(FailureReason.AUTH_REQUIRED, "errors.javdb.loginRequired")
        return page

    def fetch(self, code: str, *, session: Session) -> Page:
        search = self._page(self.search_url(code), session=session)
        paths = list(dict.fromkeys(path for path, shown in _BOX.findall(search.text)
                                  if same_release_code(code, clean(shown))))
        if not paths:
            raise SourceFailure(FailureReason.NOT_FOUND, _MISSING)
        if len(paths) > 1:
            raise SourceFailure(FailureReason.PARSE_ERROR, "errors.javdb.identityAmbiguous",
                                {"identities": '、'.join(paths)}, detail='identity_ambiguous')
        path = paths[0]
        detail = self._page(self.config.base_url + path + "?locale=zh", session=session)
        # `source_url` 记不带界面语言参数的详情页地址。
        return Page(self.config.base_url + path, detail.body)

    def parse(self, page: Page, code: str) -> SiteRecord:
        fields = _detail(page.text)
        shown = fields["code"]
        if not same_release_code(code, shown):
            raise SourceFailure(FailureReason.PARSE_ERROR, "errors.javdb.detailCodeMismatch")
        display_title, origin_title = fields["display_title"], fields["origin_title"]
        return SiteRecord(
            source=self.config.name, provenance=self.config.provider, code=shown, source_url=page.url,
            title=origin_title or display_title, performers=tuple(actresses(fields["actors"])),
            studio=fields["studio"], label=fields["label"], series=fields["series"], director=fields["director"],
            release_date=fields["release_date"], runtime=fields["runtime"], tags=fields["genres"],
            cover_urls=(fields["cover"],) if fields["cover"] else (),
            extra={'origin_title': origin_title, 'display_title': display_title,
                   'source_id': urllib.parse.urlsplit(page.url).path.rsplit('/', 1)[-1], 'javdb_rule': RULE})


def public_record(movie: dict) -> SiteRecord:
    """匿名接口的作品资料，投影成与详情页同形的记录。

    `origin_title` 对应详情页隐藏的原题，`title` 是显示标题；女优按接口的明确性别字段认。
    FC2 作品（`type` 3）的 `maker_name` 是卖家：按 `peach.sources.fc2` 的约定记进只作证据的
    `label`，不进厂牌。类别按 id 换回详情页原词，有表外 id 时不给标签（`javdb_genres.page_genres`）。
    """
    movie_id = str(movie.get("id") or "")
    fc2 = movie.get("type") == 3
    maker = maker_writing(clean(str(movie.get("maker_name") or "")))
    origin = clean(str(movie.get("origin_title") or ""))
    display = clean(str(movie.get("title") or ""))
    duration = movie.get("duration")
    cover = movie.get("cover_url")
    performers = tuple(
        {"japanese_name": clean(str(actor.get("name"))), "profile_source": "javdb",
         "external_id": str(actor.get("id") or "")}
        for actor in movie.get("actors") or []
        if isinstance(actor, dict) and actor_gender(actor) == "female" and clean(str(actor.get("name") or "")))
    return SiteRecord(
        source=JAVDB_PUBLIC.name, provenance=JAVDB_PUBLIC.provider, code=clean(str(movie.get("number") or "")),
        source_url=f"{JAVDB.base_url}/v/{movie_id}", title=origin or display, performers=performers,
        studio="" if fc2 else maker,
        label=clean(str(movie.get("publisher_name") or "")) or (maker if fc2 else ""),
        series=clean(str(movie.get("series_name") or "")), director=clean(str(movie.get("director_name") or "")),
        release_date=clean(str(movie.get("release_date") or "")),
        runtime=duration if type(duration) is int and duration > 0 else None,
        tags=page_genres(movie), cover_urls=(cover,) if public_image_url(cover) else (),
        extra={"origin_title": origin, "display_title": display, "source_id": movie_id, "javdb_rule": RULE})


class _PublicDown(Exception):
    """匿名接口这一问没答（冷却或未取得），交给详情页那条路。"""


class JavDBPublicSource(JavDBSource):
    """刮削的 javdb 一问：匿名接口取资料，缺失、歧义与预算按接口的结论分档。

    接口冷却或未取得时改读详情页（ADR-0160）：2026-11-10 起接口三家主机都要求登录，详情页匿名仍给
    全部面板字段。详情页那一问按 `javdb` 这一站的主机间隔与来源冷却走，失败按详情页的分档交出。
    """

    DEFAULT = JAVDB_PUBLIC

    def query(self, code: str, *, session: Session) -> SiteRecord:
        try:
            return self._public_query(code, session=session)
        except _PublicDown:
            return JavDBSource(JAVDB).query(code, session=session)

    def _public_query(self, code: str, *, session: Session) -> SiteRecord:
        from ..javdb_public import (PUBLIC_API, PublicBudgetExceeded, PublicIdentityAmbiguous, PublicNotFound,
                                    PublicRequestBudget, PublicSourceUnavailable)
        seconds = PUBLIC_SECONDS if session.deadline is None else session.deadline - time.monotonic()
        budget = PublicRequestBudget(max_requests=PUBLIC_REQUESTS, max_seconds=max(1.0, seconds))
        with self.holding(session):
            try:
                with PUBLIC_API.request_budget(budget):
                    movie = PUBLIC_API.movie(code)
            except PublicIdentityAmbiguous as error:
                if "identities" not in error.params:
                    raise SourceFailure(FailureReason.PARSE_ERROR, *relay_args(error),
                                        detail="identity_ambiguous") from None
                raise SourceFailure(FailureReason.PARSE_ERROR, "errors.javdb.identityAmbiguous",
                                    {"identities": error.params["identities"]}, detail="identity_ambiguous") from None
            except PublicNotFound:
                raise SourceFailure(FailureReason.NOT_FOUND, _MISSING) from None
            except PublicBudgetExceeded:
                raise SourceFailure(FailureReason.TIMEOUT, "errors.javdb.budgetExceeded") from None
            except PublicSourceUnavailable:
                raise _PublicDown() from None
            return public_record(movie)


def parse_magnets(page: Page) -> list[dict]:
    """作品页磁链区的资源条目，保留种子名、大小、日期及属性。"""
    from ..downloads import parse_magnet
    from ..catalog_vocabulary import resource_item

    container = BeautifulSoup(page.text, 'html.parser').select_one('#magnets-content')
    if container is None:
        raise SourceFailure(FailureReason.PARSE_ERROR, 'errors.javdbPublic.unrecognizedFormat')
    found = {}
    for row in container.select('.item'):
        link = row.select_one('a[href^="magnet:"]')
        if link is None:
            continue
        try:
            magnet = parse_magnet(str(link.get('href') or ''))
        except ValueError:
            continue
        def text(selector, row=row):
            node = row.select_one(selector)
            return node.get_text(' ', strip=True) if node else ''
        meta = re.split(r'[,，]', text('.meta'), maxsplit=1)
        found.setdefault(magnet.info_hash, resource_item({
            'id': 'magnet:' + magnet.info_hash, 'protocol': 'magnet', 'info_hash': magnet.info_hash,
            'uri': magnet.uri, 'name': text('.name') or magnet.name or magnet.info_hash,
            'size': meta[0].strip(), 'files': meta[1].strip() if len(meta) > 1 else '',
            'date': text('.time') or text('.date'),
            'attributes': list(dict.fromkeys(tag.get_text(' ', strip=True) for tag in row.select('.tag'))),
            'source': 'JavDB', 'source_url': page.url, 'origins': [page.url],
        }))
    if not found and JAVDB_NO_MAGNETS not in container.get_text():
        raise SourceFailure(FailureReason.PARSE_ERROR, 'errors.javdbPublic.unrecognizedFormat')
    return list(found.values())


def parse_comment_links(page: Page) -> list[dict]:
    """只取评论正文的资源链接，保留原评论定位。"""
    found = []
    for row in BeautifulSoup(page.text, 'html.parser').select('.review-item'):
        content = row.select_one('.content')
        if content is None:
            continue
        links = [str(link.get('href') or '') for link in content.select('a[href]')]
        links.extend(_COMMENT_LINK.findall(content.get_text(' ', strip=True)))
        date = row.select_one('.time')
        origin = page.url + ('#' + str(row['id']) if row.get('id') else '')
        found.extend(comment_resources(links, origin, date.get_text(' ', strip=True) if date else ''))
    return merge_resources(found)


def page_resources(code: str, movie: dict, read, *, review_pages: int) -> dict:
    """接口要求登录时从已核对的作品页读取磁链和有界评论。"""
    source_url = JAVDB.base_url + '/v/' + movie['id']
    page = Page(source_url, read('/v/' + movie['id'] + '?locale=zh').encode('utf-8'))
    current = page_movie(page.text, movie['id'])
    if not same_release_code(current['number'], code):
        raise SourceFailure(FailureReason.PARSE_ERROR, 'errors.javdbPublic.identityMismatch')
    warnings, items = [], []
    magnet_failed = comments_failed = False
    try:
        items.extend(parse_magnets(page))
    except SourceFailure as error:
        magnet_failed = True
        warnings.append(Said('labels.javdbPublic.magnetsUnfetched', error=nested_message(error)))
    body = BeautifulSoup(page.text, 'html.parser')
    items.extend(parse_comment_links(page))
    entry = body.select_one('.review-tab[data-url]')
    next_url = str(entry.get('data-url') or '') if entry else ''
    seen = set()
    if current.get('comments_count'):
        try:
            if not next_url:
                raise SourceFailure(FailureReason.PARSE_ERROR, 'errors.javdbPublic.unrecognizedFormat')
            for _ in range(review_pages):
                if not next_url:
                    break
                url = urllib.parse.urljoin(source_url, next_url)
                parts = urllib.parse.urlsplit(url)
                if (parts.scheme != 'https' or parts.netloc != urllib.parse.urlsplit(source_url).netloc
                        or not parts.path.startswith('/v/' + movie['id'] + '/reviews/') or url in seen):
                    raise SourceFailure(FailureReason.PARSE_ERROR, 'errors.javdbPublic.unrecognizedFormat')
                seen.add(url)
                comments = Page(url, read(parts.path + ('?' + parts.query if parts.query else '')).encode('utf-8'))
                body = BeautifulSoup(comments.text, 'html.parser')
                if body.select_one('.review-items') is None:
                    raise SourceFailure(FailureReason.PARSE_ERROR, 'errors.javdbPublic.unrecognizedFormat')
                items.extend(parse_comment_links(comments))
                following = body.select_one('a[rel="next"], .pagination-next:not([disabled])')
                next_url = str(following.get('href') or '') if following else ''
            else:
                if next_url:
                    warnings.append(Said('labels.javdbPublic.reviewPagesQueried', pages=review_pages))
        except SourceFailure as error:
            comments_failed = True
            warnings.append(Said('labels.javdbPublic.commentsUnfetched', error=nested_message(error)))
    return {'items': merge_resources(items), 'warnings': warnings, **parallel('warning', warnings),
            'source_url': source_url, 'magnet_failed': magnet_failed, 'comments_failed': comments_failed}


_COMMENT_LINK = re.compile(r"(?:magnet:\?[^\s<>\"']+|ed2k://\|file\|[^\r\n<>]+?\|/|https?://[^\s<>\"']+)", re.I)
_ED2K = re.compile(r"ed2k://\|file\|([^|]+)\|(\d+)\|([a-f0-9]{32})\|(?:[^\r\n]*?\|)?/", re.I)


def parse_comment_text(text: str, origin: str, date: str = "") -> list[dict]:
    """匿名评论正文里的磁链、ed2k 与网页链接；正文中的 URL 都不会被服务器追踪请求。"""
    return comment_resources(_COMMENT_LINK.findall(text), origin, date)


def comment_resources(links: list[str], origin: str, date: str) -> list[dict]:
    from ..downloads import parse_magnet

    found = []
    for uri in links:
        uri = uri.strip()
        item = {"id": "", "protocol": "url", "info_hash": "", "uri": uri,
                "name": uri, "size": "", "files": "", "date": date,
                "attributes": [], "source": RESOURCE_COMMENT_SOURCE, "source_code": "labels.javdb.commentSource",
                "source_url": origin, "origins": [origin]}
        if uri.lower().startswith('magnet:'):
            try:
                magnet = parse_magnet(uri)
            except ValueError:
                continue
            item.update(id="magnet:" + magnet.info_hash, protocol="magnet", info_hash=magnet.info_hash,
                        name=magnet.name or magnet.info_hash, uri=magnet.uri)
        elif uri.lower().startswith('ed2k:'):
            match = _ED2K.fullmatch(uri)
            if not match:
                continue
            name, size, digest = match.groups()
            item.update(id=f"ed2k:{digest.lower()}:{int(size)}", protocol="ed2k",
                        name=urllib.parse.unquote(name), size=f"{int(size):,} B")
        else:
            try:
                url = urllib.parse.urlsplit(uri)
                if url.scheme.lower() not in {'http', 'https'} or not url.hostname or url.username or url.password:
                    continue
                canonical = urllib.parse.urlunsplit((url.scheme.lower(), url.netloc.lower(), url.path or '/', url.query, url.fragment))
            except ValueError:
                continue
            item.update(id="url:" + canonical, uri=canonical)
        found.append(item)
    return merge_resources(found)


def merge_resources(items: list[dict]) -> list[dict]:
    """同一资源保留完整属性，并收集它在资源区和评论中的全部出处。"""
    unique: dict[str, dict] = {}
    for item in items:
        if item['id'] not in unique:
            unique[item['id']] = {**item, "origins": list(item['origins'])}
            continue
        current = unique[item['id']]
        current['origins'] = list(dict.fromkeys([*current['origins'], *item['origins']]))
        current['attributes'] = list(dict.fromkeys([*current['attributes'], *item['attributes']]))
        for key in ('size', 'files'):
            if not current[key]:
                current[key] = item[key]
    return list(unique.values())
