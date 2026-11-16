"""社区来源的解析与封面比对：AVBase、JavBus、javdb 各自的页面形状，以及图源印证与只有一个图源时的退路。"""
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from PIL import Image

from peach.community_catalog import COMMUNITY_SOURCES, IMAGE_LIMIT, _download, community_sources_for, verified_cover
from peach.http import HttpResponse
from peach.jav_cover_fetch import Candidate, NotFound, Unavailable, _fetch
from peach.javdb_genres import page_genres
from peach.javdb_public import (PUBLIC_API, PublicBudgetExceeded, PublicIdentityAmbiguous, PublicNotFound,
                                PublicSourcePaused, PublicSourceUnavailable)
from peach.library_processing import _previous_order
from peach.scraping_access import SourcePaused
from peach.sources import (SITE_SOURCES, AVBaseSource, FailureReason, JavBusSource, JavDBPublicSource, JavDBSource,
                           Page, Session, SourceFailure)
from peach.sources.javdb import actresses as javdb_actresses, public_record


def gradient(width, height, rising=True):
    """横向渐变。dHash 只看相邻像素谁亮：升序与降序是两张完全不同的图。"""
    image = Image.new("L", (width, height))
    row = [int(255 * (x if rising else width - 1 - x) / (width - 1)) for x in range(width)]
    image.putdata(row * height)
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG")
    return buffer.getvalue()


def serve(pages):
    def call(request, timeout, limit):
        found = request.url in pages
        return HttpResponse(200 if found else 404, {}, pages.get(request.url, b""), request.url)
    return call


def work(site, pages, code):
    """走完取页与解析，交出来源快照那份 dict：采集任务与 `scrape_codes` 拿到的就是它。"""
    return site.query(code, session=Session(serve(pages))).payload()


TITLE = "涼森れむ流 HOW TO SEX！！"
DMM_COVER = "https://pics.dmm.co.jp/mono/movie/adult/118abw358/118abw358pl.jpg"
MGS_COVER = "https://image.mgstage.com/images/prestige/abw/358/pb_e_abw-358.jpg"
JAVDB_COVER = "https://c0.jdbstatic.com/covers/zb/Zb7mX.jpg"
JAVBUS_COVER = "https://www.javbus.com/pics/cover/9x2a_b.jpg"
AVBASE_DATA = {"props": {"pageProps": {"works": [
    {"work_id": "ABW-3580", "title": "別の作品", "products": []},
    {"prefix": "prestige", "work_id": "ABW-358", "title": TITLE, "actors": [{"name": "涼森れむ"}], "products": [
        # 收录本作的合集：标题和番号都对不上，封面和厂牌都不该带进来。
        {"source": "duga", "title": "総集編 8時間", "product_id": "prestige-9999",
         "image_url": "https://pic.duga.jp/unsecure/prestige/9999/noauth/jacket.jpg", "maker": {"name": "別メーカー"}},
        {"source": "mgstage", "title": TITLE, "product_id": "ABW-358", "image_url": MGS_COVER,
         "maker": {"name": "プレステージ"}, "date": "Tue May 23 2023 09:00:00 GMT+0900"},
        {"source": "fanza", "title": TITLE, "product_id": "118abw358", "image_url": DMM_COVER,
         "maker": {"name": "プレステージ"}, "label": {"name": "ABSOLUTELY WONDERFUL"},
         "date": "Fri May 26 2023 09:00:00 GMT+0900", "iteminfo": {"director": "監督A"}},
    ]},
]}}}
AVBASE_SEARCH = "https://www.avbase.net/works?q=ABW-358"
#: 形状取自 259LUXU-1514 的实测页：名寄せ的作品标题是 FANZA 合集那一件的标题，
#: 单卖本作的只有 MGStage 那条。
LUXU_TITLE = "ラグジュTV 1485 綺麗で笑顔が素敵な看護師さんが「普通のセックスでは物足りない…」と刺激を求めて登場！"
LUXU_COVER = "https://image.mgstage.com/images/luxutv/sp/259luxu/1514/pake-03_sp-259luxu-1514.jpg"
LUXU_DATA = {"props": {"pageProps": {"works": [
    {"work_id": "259LUXU-1514", "title": "FIRST CLASS ファーストクラス File/006",
     "actors": [{"name": "東條なつ"}], "products": [
         {"source": "fanza", "title": "FIRST CLASS ファーストクラス File/006", "product_id": "118sng013",
          "image_url": "https://pics.dmm.co.jp/mono/movie/adult/118sng013/118sng013pl.jpg",
          "maker": {"name": "プレステージ"}, "label": {"name": "SINGLE"},
          "series": {"name": "FIRST CLASS ファーストクラス"},
          "date": "Fri Aug 16 2024 09:00:00 GMT+0900"},
         {"source": "mgstage", "title": LUXU_TITLE, "product_id": "259LUXU-1514", "image_url": LUXU_COVER,
          "maker": {"name": "ラグジュTV"}, "series": {"name": "ラグジュTV"},
          "date": "Fri Nov 19 2021 09:00:00 GMT+0900"},
     ]},
]}}}
LUXU_SEARCH = "https://www.avbase.net/works?q=259LUXU-1514"
JAVBUS_WORK = "https://www.javbus.com/ABW-358"
JAVDB_SEARCH = "https://javdb.com/search?q=ABW-358&f=all"
JAVDB_DETAIL = "https://javdb.com/v/Zb7mX?locale=zh"


def avbase_page(data):
    return ('<html><script id="__NEXT_DATA__" type="application/json">'
            + json.dumps(data, ensure_ascii=False) + "</script></html>").encode()


#: 形状取自厂牌回查缓存的 JavBus 作品页（PRED-340）：字段行之间有换行与缩进，演员不在字段行里。
JAVBUS_PAGE = (f"<h3>ABW-358 {TITLE}</h3>\n"
               '<a class="bigImage" href="/pics/cover/9x2a_b.jpg"><img src="/pics/cover/9x2a_b.jpg"></a>\n'
               '<p><span class="header">識別碼:</span> <span style="color:#CC0000;">ABW-358</span>\n</p>\n'
               '<p><span class="header">發行日期:</span> 2023-05-26</p>\n'
               '<p><span class="header">長度:</span> 210分鐘</p>\n'
               '<p><span class="header">製作商:</span> <a href="https://www.javbus.com/studio/x">プレステージ</a>\n'
               '            </p>            <p><span class="header">發行商:</span> '
               '<a href="https://www.javbus.com/label/y">ABSOLUTELY WONDERFUL</a>\n</p>'
               '<p class="header">類別:<span id="genre-toggle"></span></p>\n'
               '<div class="star-name"><a href="https://www.javbus.com/star/z" title="涼森れむ">涼森れむ</a></div>').encode()
JAVDB_RESULTS = ('<a href="/v/Q1" class="box" title="別"><div class="video-title"><strong>ABW-3580</strong></div></a>'
                 '<a href="/v/Zb7mX" class="box" title="涼森れむ流"><div class="video-title"><strong>ABW-358</strong> '
                 + TITLE + "</div></a>").encode()
#: 站上并存的两种封面标签写法：一种 class 在前、src 在后、中间夹着三个属性；另一种 src 在前。
#: 解析器对两种都要认。
JAVDB_COVER_TAG = (f'<div class="column column-video-cover"><img class="video-cover" width="600" '
                   f'height="404" fetchpriority="high" src="{JAVDB_COVER}" /></div>')
JAVDB_COVER_TAG_EARLIER = f'<img src="{JAVDB_COVER}" class="video-cover" alt="">'
JAVDB_PAGE = (f'<strong class="current-title">{TITLE}</strong>'
              + JAVDB_COVER_TAG
              + '<div class="panel-block first-block"><strong>番號:</strong>&nbsp;<span class="value">'
              '<a href="/video_codes/ABW">ABW</a>-358</span></div>'
              '<div class="panel-block"><strong>日期:</strong>&nbsp;<span class="value">2023-05-23</span></div>'
              '<div class="panel-block"><strong>時長:</strong>&nbsp;<span class="value"> 210 分鍾</span></div>'
              '<div class="panel-block"><strong>片商:</strong>&nbsp;<span class="value">'
              '<a href="/makers/x">PRESTIGE,プレステージ</a></span></div>'
              '<div class="panel-block"><strong>演員:</strong>&nbsp;<span class="value">'
              '<a href="/actors/a" class="actor-female">涼森れむ</a><a href="/actors/b">男優</a></span></div>').encode()


class CommunityCatalogTests(unittest.TestCase):
    def test_avbase_takes_the_fanza_listing_and_skips_compilations(self):
        found = work(AVBaseSource(), {AVBASE_SEARCH: avbase_page(AVBASE_DATA)}, "ABW-358")
        self.assertEqual((found["id"], found["title"], found["maker"], found["label"], found["director"]),
                         ("ABW-358", TITLE, "プレステージ", "ABSOLUTELY WONDERFUL", "監督A"))
        self.assertEqual(found["release_date"], "2023-05-26")
        self.assertEqual(found["actresses"], [{"japanese_name": "涼森れむ"}])
        self.assertEqual(found["cover_urls"], [DMM_COVER, MGS_COVER])
        self.assertEqual(found["source_url"], "https://www.avbase.net/works/prestige:ABW-358")

    def test_avbase_keeps_the_shop_listing_whose_product_number_is_this_code(self):
        """合集顶着作品标题时也不算本作：商品号认得出番号的那条说了算。"""
        found = work(AVBaseSource(), {LUXU_SEARCH: avbase_page(LUXU_DATA)}, "259LUXU-1514")
        self.assertEqual((found["title"], found["maker"], found["series"], found["release_date"]),
                         (LUXU_TITLE, "ラグジュTV", "ラグジュTV", "2021-11-19"))
        self.assertEqual(found["cover_urls"], [LUXU_COVER])

    def test_avbase_tells_an_unknown_code_apart_from_a_page_it_cannot_read(self):
        """搜索无命中是没有；Cloudflare 验证页与站点改版都是「页面结构未识别」，细档分开记。"""
        empty = {"props": {"pageProps": {"works": []}}}
        with self.assertRaises(SourceFailure) as caught:
            work(AVBaseSource(), {AVBASE_SEARCH: avbase_page(empty)}, "ABW-358")
        self.assertEqual((caught.exception.reason, str(caught.exception)),
                         (FailureReason.NOT_FOUND, "AVBase 没有这个番号"))
        with self.assertRaisesRegex(SourceFailure, "AVBase 页面结构未识别") as caught:
            work(AVBaseSource(), {AVBASE_SEARCH: b"<html><title>Just a moment...</title></html>"}, "ABW-358")
        self.assertEqual(caught.exception.reason, FailureReason.CLOUDFLARE_CHALLENGE)
        with self.assertRaisesRegex(SourceFailure, "AVBase 页面结构未识别") as caught:
            work(AVBaseSource(), {AVBASE_SEARCH: b"<html><body>redesigned</body></html>"}, "ABW-358")
        self.assertEqual(caught.exception.reason, FailureReason.PARSE_ERROR)

    def test_avbase_payload_equals_the_snapshot_shape_field_for_field(self):
        """`AVBaseSource` 交出的 dict 逐键钉住。AVBase 不给时长，`runtime` 留 `None`，候选那一路对它按没有处理。"""
        expected = {
            "id": "ABW-358", "source_url": "https://www.avbase.net/works/prestige:ABW-358", "title": TITLE,
            "actresses": [{"japanese_name": "涼森れむ"}], "maker": "プレステージ", "label": "ABSOLUTELY WONDERFUL",
            "series": "", "director": "監督A", "release_date": "2023-05-26", "runtime": None,
            "cover_urls": [DMM_COVER, MGS_COVER], "cover_url": DMM_COVER}
        self.assertEqual(work(AVBaseSource(), {AVBASE_SEARCH: avbase_page(AVBASE_DATA)}, "ABW-358"), expected)
        record = AVBaseSource().parse(Page(AVBASE_SEARCH, avbase_page(AVBASE_DATA)), "ABW-358")
        self.assertEqual((record.source, record.provenance, record.code), ("avbase", "avbase-search", "ABW-358"))
        self.assertEqual(record.payload(), expected, "只喂 parse 一张页面，得到的与走完 fetch 的一样")
        luxu = {
            "id": "259LUXU-1514", "source_url": "https://www.avbase.net/works/259LUXU-1514", "title": LUXU_TITLE,
            "actresses": [{"japanese_name": "東條なつ"}], "maker": "ラグジュTV", "label": "", "series": "ラグジュTV",
            "director": "", "release_date": "2021-11-19", "runtime": None,
            "cover_urls": [LUXU_COVER], "cover_url": LUXU_COVER}
        self.assertEqual(work(AVBaseSource(), {LUXU_SEARCH: avbase_page(LUXU_DATA)}, "259LUXU-1514"), luxu)

    def test_javbus_reads_the_work_page_fields_and_the_big_cover(self):
        found = work(JavBusSource(), {JAVBUS_WORK: JAVBUS_PAGE}, "ABW-358")
        self.assertEqual((found["id"], found["title"], found["maker"], found["label"], found["release_date"], found["runtime"]),
                         ("ABW-358", TITLE, "プレステージ", "ABSOLUTELY WONDERFUL", "2023-05-26", 210))
        self.assertEqual(found["actresses"], [{"japanese_name": "涼森れむ"}])
        self.assertEqual((found["source_url"], found["cover_urls"]), (JAVBUS_WORK, [JAVBUS_COVER]))

    def test_javbus_tells_a_missing_code_apart_from_its_age_gate(self):
        """番号页 404 是没有；年龄门回 200 却没有「識別碼」，要让人去贴 Cookie，而不是记成没有。"""
        with self.assertRaisesRegex(SourceFailure, "JavBus 没有这个番号") as caught:
            work(JavBusSource(), {}, "ABW-358")
        self.assertEqual(caught.exception.reason, FailureReason.NOT_FOUND)
        with self.assertRaisesRegex(SourceFailure, "JavBus 没有这个番号") as caught:
            work(JavBusSource(), {JAVBUS_WORK: JAVBUS_PAGE.replace(b">ABW-358</span>", b">ABW-359</span>")}, "ABW-358")
        self.assertEqual(caught.exception.reason, FailureReason.NOT_FOUND)
        with self.assertRaisesRegex(SourceFailure, "贴上浏览器里的 Cookie") as caught:
            work(JavBusSource(), {JAVBUS_WORK: b"<html><title>Age Verification JavBus</title></html>"}, "ABW-358")
        self.assertEqual(caught.exception.reason, FailureReason.AUTH_REQUIRED)

    def test_javdb_opens_the_exact_code_and_keeps_the_japanese_maker(self):
        found = work(JavDBSource(), {JAVDB_SEARCH: JAVDB_RESULTS, JAVDB_DETAIL: JAVDB_PAGE}, "ABW-358")
        self.assertEqual((found["id"], found["title"], found["maker"], found["release_date"], found["runtime"]),
                         ("ABW-358", TITLE, "プレステージ", "2023-05-23", 210))
        self.assertEqual(
            found["actresses"],
            [{"japanese_name": "涼森れむ", "profile_source": "javdb", "external_id": "a"}],
            "男优不进演员；女优带着她在 javdb 的演员 id")
        self.assertEqual((found["source_url"], found["cover_urls"]), ("https://javdb.com/v/Zb7mX", [JAVDB_COVER]))

    def test_javdb_reads_the_cover_whichever_side_of_the_class_the_src_sits(self):
        """站方在封面那个 img 上改过属性顺序，页面其余部分照常解析，缺的只是封面。"""
        earlier = JAVDB_PAGE.replace(JAVDB_COVER_TAG.encode(), JAVDB_COVER_TAG_EARLIER.encode())
        self.assertNotEqual(earlier, JAVDB_PAGE, '两种写法要真的不一样，否则这条用例什么也没测')
        for page in (JAVDB_PAGE, earlier):
            found = work(JavDBSource(), {JAVDB_SEARCH: JAVDB_RESULTS, JAVDB_DETAIL: page}, "ABW-358")
            self.assertEqual(found["cover_url"], JAVDB_COVER)

    def test_javdb_reads_the_actor_id_whichever_side_of_the_class_it_sits(self):
        """属性的先后由站方模板决定，不该成为拿不到演员 id 的理由。"""
        self.assertEqual(
            javdb_actresses('<a class="actor-female" href="/actors/z9">葵いぶき</a>'),
            [{"japanese_name": "葵いぶき", "profile_source": "javdb", "external_id": "z9"}])
        self.assertEqual(
            javdb_actresses('<a class="actor-female">名字没挂链接</a>'),
            [{"japanese_name": "名字没挂链接", "profile_source": "javdb", "external_id": ""}])

    def test_javdb_categories_keep_source_words_in_the_shared_record_and_snapshot(self):
        categories = ('<div class="panel-block"><strong>類別:</strong><span class="value">'
                      '<a href="/tags/a"> 高跟鞋 </a><a href="/tags/b"><b>絲襪</b></a>'
                      '<a href="/tags/c">アナル</a><a href="/tags/d">未收录分類</a>'
                      '<a href="/tags/a">高跟鞋</a><a href="/tags/empty"> </a></span></div>')
        page = JAVDB_PAGE + categories.encode()
        record = JavDBSource().parse(Page("https://javdb.com/v/Zb7mX", page), "ABW-358")
        self.assertEqual(record.tags, ("高跟鞋", "絲襪", "アナル", "未收录分類"))
        found = work(JavDBSource(), {JAVDB_SEARCH: JAVDB_RESULTS, JAVDB_DETAIL: page}, "ABW-358")
        self.assertEqual(found, record.payload())
        self.assertEqual(found["genres"], ["高跟鞋", "絲襪", "アナル", "未收录分類"])

    def test_javdb_empty_categories_are_an_empty_genres_snapshot(self):
        empty_panel = ('<div class="panel-block"><strong>類別:</strong>'
                       '<span class="value"><a href="/tags/empty"> </a></span></div>')
        for category_panel in ("", empty_panel):
            with self.subTest(category_panel=category_panel):
                record = JavDBSource().parse(
                    Page("https://javdb.com/v/Zb7mX", JAVDB_PAGE + category_panel.encode()), "ABW-358")
                self.assertEqual(record.tags, ())
                self.assertEqual(record.payload()["genres"], [])

    def test_javdb_reports_a_missing_code_and_a_login_wall_differently(self):
        with self.assertRaises(SourceFailure) as caught:
            work(JavDBSource(), {JAVDB_SEARCH: JAVDB_RESULTS.replace(b"<strong>ABW-358</strong>", b"<strong>ABW-359</strong>")},
                 "ABW-358")
        self.assertEqual(caught.exception.reason, FailureReason.NOT_FOUND)
        with self.assertRaisesRegex(SourceFailure, "javdb 要求登录") as caught:
            work(JavDBSource(), {JAVDB_SEARCH: "<title>登入 | JavDB</title>".encode()}, "ABW-358")
        self.assertEqual(caught.exception.reason, FailureReason.AUTH_REQUIRED)

    def test_javbus_payload_equals_the_snapshot_shape_field_for_field(self):
        """`JavBusSource` 交出的 dict 逐键钉住：采集任务与批量脚本认的就是这份。"""
        expected = {
            "id": "ABW-358", "source_url": JAVBUS_WORK, "title": TITLE, "actresses": [{"japanese_name": "涼森れむ"}],
            "maker": "プレステージ", "label": "ABSOLUTELY WONDERFUL", "series": "", "director": "",
            "release_date": "2023-05-26", "runtime": 210, "cover_urls": [JAVBUS_COVER], "cover_url": JAVBUS_COVER}
        self.assertEqual(work(JavBusSource(), {JAVBUS_WORK: JAVBUS_PAGE}, "ABW-358"), expected)
        record = JavBusSource().parse(Page(JAVBUS_WORK, JAVBUS_PAGE), "ABW-358")
        self.assertEqual((record.source, record.provenance, record.code), ("javbus", "javbus-page", "ABW-358"))
        self.assertEqual(record.payload(), expected, "只喂 parse 一张页面，得到的与走完 fetch 的一样")

    def test_javdb_payload_equals_the_snapshot_shape_field_for_field(self):
        expected = {
            "id": "ABW-358", "source_url": "https://javdb.com/v/Zb7mX", "title": TITLE,
            "origin_title": "", "display_title": TITLE, "source_id": "Zb7mX", "javdb_rule": 2,
            "actresses": [{"japanese_name": "涼森れむ", "profile_source": "javdb", "external_id": "a"}],
            "maker": "プレステージ", "label": "", "series": "", "director": "", "release_date": "2023-05-23",
            "runtime": 210, "genres": [], "cover_urls": [JAVDB_COVER], "cover_url": JAVDB_COVER}
        self.assertEqual(work(JavDBSource(), {JAVDB_SEARCH: JAVDB_RESULTS, JAVDB_DETAIL: JAVDB_PAGE}, "ABW-358"), expected)
        record = JavDBSource().parse(Page("https://javdb.com/v/Zb7mX", JAVDB_PAGE), "ABW-358")
        self.assertEqual((record.source, record.provenance, record.code), ("javdb", "javdb-page", "ABW-358"))
        self.assertEqual(record.payload(), expected)

    def test_the_two_sites_report_failures_through_the_shared_reason_table(self):
        """`query` 抛的是细档；`LibraryMetadataProvider` 与 `scrape_codes` 按 `kind` 分「没有」与「未取得」。"""
        with self.assertRaises(SourceFailure) as caught:
            JavBusSource().query("ABW-358", session=Session(serve({JAVBUS_WORK: b"<html>Age Verification</html>"})))
        self.assertEqual(caught.exception.reason, FailureReason.AUTH_REQUIRED)
        with self.assertRaises(SourceFailure) as caught:
            JavBusSource().query("ABW-358", session=Session(serve({})))
        self.assertEqual((caught.exception.reason, str(caught.exception)), (FailureReason.NOT_FOUND, "JavBus 没有这个番号"))
        with self.assertRaises(SourceFailure) as caught:
            JavDBSource().query("ABW-358", session=Session(serve({JAVDB_SEARCH: "<title>登入 | JavDB</title>".encode()})))
        self.assertEqual((caught.exception.reason, str(caught.exception)), (FailureReason.AUTH_REQUIRED, "javdb 要求登录"))
        with self.assertRaises(SourceFailure) as caught:
            JavDBSource().query("ABW-358", session=Session(serve({JAVDB_SEARCH: JAVDB_RESULTS})))
        self.assertEqual((caught.exception.reason, str(caught.exception)), (FailureReason.NOT_FOUND, "HTTP 404"))
        mismatched = JAVDB_PAGE.replace(b'<a href="/video_codes/ABW">ABW</a>-358', b'<a href="/video_codes/ABW">ABW</a>-359')
        with self.assertRaises(SourceFailure) as caught:
            JavDBSource().parse(Page("https://javdb.com/v/Zb7mX", mismatched), "ABW-358")
        self.assertEqual((caught.exception.reason, caught.exception.kind, str(caught.exception)),
                         (FailureReason.PARSE_ERROR, "unavailable", "javdb 详情页的番号与搜索结果不一致"))

    def test_a_redirect_to_the_now_printing_placeholder_is_not_a_cover(self):
        """DMM 没图时 302 到 590×800 的「准备中」，尺寸够门槛，只能按最终地址认。"""
        placeholder = HttpResponse(200, {}, gradient(590, 800),
                                   "https://pics.dmm.co.jp/mono/movie/adult/now_printing/now_printing.jpg")
        with self.assertRaises(NotFound):
            _fetch(lambda *args: placeholder, DMM_COVER, referer="https://www.dmm.co.jp/", limit=IMAGE_LIMIT)


class VerifiedCoverTests(unittest.TestCase):
    def test_a_community_cover_needs_the_same_picture_from_a_second_origin(self):
        works = [("avbase", {"cover_urls": [DMM_COVER]}), ("javdb", {"cover_urls": [JAVDB_COVER]})]
        pages = {JAVDB_COVER: gradient(800, 534), DMM_COVER: gradient(400, 267)}
        candidate, size, _data, origins = verified_cover(serve(pages), "ABW-358", works)
        self.assertEqual((candidate.url, size, origins), (DMM_COVER, (400, 267), ("dmm", "javdb")))
        self.assertEqual(candidate.referer, "https://www.dmm.co.jp/")
        pages[DMM_COVER] = gradient(400, 267, rising=False)
        with self.assertRaisesRegex(NotFound, "^dmm、javdb 给的封面不是同一张图"):
            verified_cover(serve(pages), "ABW-358", works)

    def test_javbus_is_an_origin_of_its_own(self):
        works = [("javbus", {"cover_urls": [JAVBUS_COVER]}), ("javdb", {"cover_urls": [JAVDB_COVER]})]
        pages = {JAVBUS_COVER: gradient(800, 538), JAVDB_COVER: gradient(800, 534)}
        candidate, _size, _data, origins = verified_cover(serve(pages), "ABW-358", works)
        self.assertEqual((candidate.url, candidate.referer, origins),
                         (JAVBUS_COVER, "https://www.javbus.com/", ("javbus", "javdb")))

    def test_a_javdb_only_cover_waits_for_an_eligible_image(self):
        works = [("avbase", {"cover_urls": []}), ("javdb", {"cover_urls": [JAVDB_COVER]})]
        with self.assertRaisesRegex(NotFound, '无 JavDB 水印'):
            verified_cover(serve({JAVDB_COVER: gradient(800, 534)}), "IPX-060", works)

    def test_a_javdb_only_cover_is_used_when_the_watermark_fallback_is_on(self):
        """#531：设置打开后，只剩 JavDB 水印图时用它补空；别家有图时照旧用别家的。"""
        works = [("avbase", {"cover_urls": []}), ("javdb", {"cover_urls": [JAVDB_COVER]})]
        candidate, size, _data, origins = verified_cover(
            serve({JAVDB_COVER: gradient(800, 534)}), "IPX-060", works, allow_watermarked=True)
        self.assertEqual((candidate.url, size, origins), (JAVDB_COVER, (800, 534), ()))
        both = [("javbus", {"cover_urls": [JAVBUS_COVER]}), ("javdb", {"cover_urls": [JAVDB_COVER]})]
        candidate, *_rest = verified_cover(
            serve({JAVBUS_COVER: gradient(800, 538), JAVDB_COVER: gradient(800, 534)}), "ABW-358", both,
            allow_watermarked=True)
        self.assertEqual(candidate.url, JAVBUS_COVER)

    def test_a_picture_cut_off_on_the_network_keeps_the_answer_retryable(self):
        """#342：JavBus 那张断在连接、5xx 或冷却上时，剩下的 javdb 图凑不成答复，不能当「没有」记一周。"""
        works = [("javbus", {"cover_urls": [JAVBUS_COVER]}), ("javdb", {"cover_urls": [JAVDB_COVER]})]
        pages = {JAVBUS_COVER: gradient(800, 538), JAVDB_COVER: gradient(800, 534)}

        def failing(failure, pages=pages):
            def call(request, timeout, limit):
                if request.url == JAVBUS_COVER:
                    if isinstance(failure, int):
                        return HttpResponse(failure, {}, b"", request.url)
                    raise failure
                return serve(pages)(request, timeout, limit)
            return call

        conflicting = {**pages, JAVBUS_COVER: gradient(800, 538, rising=False),
                       DMM_COVER: gradient(800, 538, rising=False)}
        failures = ((httpx.ConnectError("proxy down"), Unavailable), (httpx.ReadTimeout("read timeout"), Unavailable),
                    (503, Unavailable), (404, Unavailable), (SourcePaused("errors.scrapingAccess.coolingDown"), SourcePaused))
        for failure, expected in failures:
            with self.subTest(failure=failure), patch("peach.jav_cover_fetch.time.sleep"):
                # 只剩 javdb 带水印的那张；或另两家各给一张对不上：没下到的 JavBus 那张都可能改变结论。
                for served, answered, reason in (
                        (pages, works, "^未取得无 JavDB 水印的封面"),
                        (conflicting, [*works, ("avbase", {"cover_urls": [DMM_COVER]})], "^dmm、javdb 给的封面不是同一张图")):
                    with self.assertRaisesRegex(expected, reason + ".*；另有 1 张封面没下载到$") as caught:
                        verified_cover(failing(failure, served), "ABW-358", answered)
                    self.assertNotIsInstance(caught.exception, NotFound)
                # 下到的图全出自一个图源时照旧用它：别家那张没下到不挡已经能用的封面。
                candidate, _size, _data, origins = verified_cover(
                    failing(failure, {DMM_COVER: gradient(800, 538)}), "ABW-358",
                    [works[0], ("avbase", {"cover_urls": [DMM_COVER]})])
                self.assertEqual((candidate.url, origins), (DMM_COVER, ()))
        with self.assertRaisesRegex(NotFound, "无 JavDB 水印"):
            verified_cover(serve(pages), "ABW-358", [("javbus", {"cover_urls": []}), works[1]])

    def test_a_site_cut_off_while_another_answers_keeps_the_cover_retryable(self):
        """#342：JavBus 作品页断线、AVBase 说没有、javdb 答上；只剩 javdb 带水印的图，不是「来源没有封面」。

        javdb 一档的接口固定为未取得，由详情页答上（ADR-0160）：全局 `PUBLIC_API` 用真实传输，不拦会连外网。
        """
        from peach.library_processing import LibraryMetadataProvider
        self.enterContext(patch.object(PUBLIC_API, "movie", side_effect=PublicSourceUnavailable("errors.javdbPublic.unavailable")))
        pages = {JAVDB_SEARCH: JAVDB_RESULTS, JAVDB_DETAIL: JAVDB_PAGE, JAVDB_COVER: gradient(800, 534)}
        asked = []

        def transport(request, timeout, limit):
            asked.append(request.url)
            if request.url == JAVBUS_WORK:
                raise httpx.ConnectError("proxy down")
            return serve(pages)(request, timeout, limit)

        provider = LibraryMetadataProvider.__new__(LibraryMetadataProvider)
        provider.transport = transport
        covers = Path(self.enterContext(tempfile.TemporaryDirectory()))
        with patch("peach.jav_cover_fetch.time.sleep"), \
                patch("peach.jav_cover_fetch.best_cover", side_effect=NotFound("errors.javCoverFetch.noCandidates")), \
                self.assertRaisesRegex(Unavailable, "JavBus") as caught:
            provider.cover("ABW-358", covers)
        self.assertNotIsInstance(caught.exception, NotFound)
        self.assertFalse((covers / "ABW-358.jpg").exists())
        self.assertIn(JAVDB_DETAIL, asked)

    def test_a_small_official_cover_counts_as_the_second_origin(self):
        works = [("javdb", {"cover_urls": [JAVDB_COVER]})]
        small = Candidate("image.mgstage.com", "https://image.mgstage.com/images/x/pf_o1_x.jpg")
        reference = (small, (300, 200), gradient(300, 200))
        candidate, _size, _data, origins = verified_cover(serve({JAVDB_COVER: gradient(900, 600)}), "ORETD-615",
                                                          works, reference=reference)
        self.assertEqual((candidate.url, origins), (small.url, ("javdb", "mgstage")))
        with self.assertRaisesRegex(Unavailable, "下载失败"):
            verified_cover(serve({}), "ORETD-615", works, reference=reference)
        with self.assertRaisesRegex(NotFound, "^javdb、mgstage 给的封面不是同一张图"):
            verified_cover(serve({JAVDB_COVER: gradient(900, 600, rising=False)}), "ORETD-615",
                           works, reference=reference)
        with self.assertRaisesRegex(Unavailable, "下载失败"):
            verified_cover(serve({}), "ORETD-615", works)
        with self.assertRaises(NotFound):
            verified_cover(serve({}), "ORETD-615", [("javdb", {"cover_urls": []})])

    def test_an_animated_picture_or_another_works_picture_is_never_the_cover(self):
        """JavArchive 的图床给 FC2 存 GIF 预览动画，页面上还挂着别的作品的图。"""
        own_gif = "https://img.javstore.net/images/2022/01/03/FC2PPV-2543627.gif"
        other = "https://img.javstore.net/images/2024/01/15/2184960PL.jpg"
        frames = [Image.open(io.BytesIO(gradient(500, 282, rising))) for rising in (True, False)]
        buffer = io.BytesIO()
        frames[0].save(buffer, format="GIF", save_all=True, append_images=frames[1:])
        works = [("javarchive", {"cover_urls": [own_gif, other]})]
        pages = {own_gif: buffer.getvalue(), other: gradient(800, 450)}
        with self.assertRaisesRegex(NotFound, "动图或太小"):
            verified_cover(serve(pages), "FC2-PPV-2543627", works)
        still = "https://img.javstore.net/images/2022/01/03/fc2ppv-2543627.jpg"
        pages[still] = gradient(800, 450)
        works = [("javarchive", {"cover_urls": [own_gif, other, still]})]
        candidate, _size, _data, _origins = verified_cover(serve(pages), "FC2-PPV-2543627", works)
        self.assertEqual(candidate.url, still)


def photo(seed, crop=None, size=None):
    """一张有纹理的「照片」：随机色块再糊一点，特征点才找得到角。`crop` 取其中一块，`size` 缩放。"""
    import random
    from PIL import ImageDraw, ImageFilter
    rng = random.Random(seed)
    image = Image.new("RGB", (800, 900), (128, 128, 128))
    draw = ImageDraw.Draw(image)
    for _ in range(400):
        x, y = rng.randrange(800), rng.randrange(900)
        draw.rectangle((x, y, x + rng.randrange(10, 80), y + rng.randrange(10, 80)),
                       fill=tuple(rng.randrange(256) for _ in range(3)))
    image = image.filter(ImageFilter.GaussianBlur(1))
    if crop:
        image = image.crop(crop)
    if size:
        image = image.resize(size, Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


@unittest.skipUnless(__import__("importlib").util.find_spec("cv2"), "缺 vision 依赖组")
class SameSceneTests(unittest.TestCase):
    """javdb 给 FC2 的是商品图另取景的方图，JavArchive 转存的是竖版：整图指纹对不上，特征点对得上。"""

    def test_a_square_crop_of_the_same_photo_is_the_same_picture(self):
        from peach.community_catalog import same_scene
        portrait = photo(1, size=(510, 574))
        square = photo(1, crop=(100, 150, 700, 750), size=(276, 276))
        self.assertTrue(same_scene(portrait, square))
        self.assertFalse(same_scene(portrait, photo(2, crop=(100, 150, 700, 750), size=(276, 276))))

    def test_the_official_pages_other_pictures_take_part_in_the_comparison(self):
        """官方那一档按尺寸挑中的是截图；同页那张竖版商品图才和 javdb 的方图对得上。"""
        screenshot = Candidate("img.javstore.net", "https://img.javstore.net/images/FC2PPV-3264420.jpg")
        portrait = "https://img.javstore.net/images/FC2PPV-3264420PS.jpg"
        square = "https://c0.jdbstatic.com/covers/ab/AbCd.jpg"
        pages = {portrait: photo(1, size=(510, 574)),
                 square: photo(1, crop=(100, 150, 700, 750), size=(276, 276))}
        works = [("javdb", {"cover_urls": [square]})]
        reference = (screenshot, (605, 364), photo(3, size=(605, 364)))
        with self.assertRaisesRegex(Unavailable, "不是同一张图"):
            verified_cover(serve(pages), "FC2-PPV-3264420", works, reference=reference)
        candidate, size, _data, origins = verified_cover(
            serve(pages), "FC2-PPV-3264420", works, reference=reference,
            siblings=(screenshot, Candidate("img.javstore.net", portrait)))
        self.assertEqual((candidate.url, size, origins), (portrait, (510, 574), ("img.javstore.net", "javdb")))


class SourceChoiceTests(unittest.TestCase):
    def test_an_fc2_product_number_only_goes_to_javdb(self):
        """AVBase 与 JavBus 的目录里没有 FC2，问了只是各撞一次空搜索。"""
        self.assertEqual(community_sources_for("FC2-PPV-1233719"), ("javdb",))
        self.assertEqual(community_sources_for("fc2-ppv-1233719"), ("javdb",))

    def test_a_studio_code_still_goes_to_all_three(self):
        """厂牌番号三家都有产出，顺序也要保持 javdb 最后；三家都登记在契约的 `SITE_SOURCES` 里。"""
        self.assertEqual(community_sources_for("ORETD-615"), ("avbase", "javbus", "javdb"))
        self.assertEqual(COMMUNITY_SOURCES, ("avbase", "javbus", "javdb"))
        self.assertTrue(set(COMMUNITY_SOURCES) <= set(SITE_SOURCES))

    def test_a_row_without_a_code_asks_nobody(self):
        """番号是空的，三家搜什么都一样：搜索页第一条和这一行没有关系。"""
        self.assertEqual(community_sources_for(""), ())

    def test_a_korean_mib_code_asks_nobody(self):
        """MIB 番号与日本片同形，问 JAV 目录站拿回的是别的作品，只能靠人一条条认出来。"""
        self.assertEqual(community_sources_for("AIN-203"), ())


#: 接口类别按 (作品类型, id) 换回详情页原词；测试只登记这几项。
PUBLIC_GENRES = {"0:28": "單體作品", "0:57": "美臀", "0:74": "肛門・肛交", "3:11": "私人攝影"}
PUBLIC_MOVIE = {
    "id": "Zb7mX", "type": 0, "number": "ABW-358", "title": "顯示標題", "origin_title": TITLE,
    "maker_name": "PRESTIGE,プレステージ", "publisher_name": None, "series_name": None, "director_name": None,
    "release_date": "2023-05-23", "duration": 210,
    "cover_url": "https://tp.spfcas.com/rhe951l4q/covers/zb/Zb7mX.jpg",
    "actors": [{"id": "a", "name": "涼森れむ", "gender": 0}, {"id": "m", "name": "男優", "gender": 1}],
    "tags": [{"id": "28", "name": "单体作品"}, {"id": "57", "name": "屁股"}, {"id": "74", "name": "肛交"},
             {"id": "299", "name": "数位马赛克"}]}


class PublicSourceTests(unittest.TestCase):
    """刮削的 javdb 一问走匿名接口：记录与详情页同形，类别按 id 换回原词，失败按缺失、歧义、冷却分档。"""

    def setUp(self):
        for patcher in (patch.dict("peach.javdb_genres.GENRES", PUBLIC_GENRES, clear=True),
                        patch("peach.javdb_genres.HIDDEN", frozenset({"0:299"}))):
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_public_record_has_the_page_snapshot_shape_and_page_genre_words(self):
        payload = public_record(PUBLIC_MOVIE).payload()
        page = JavDBSource().parse(Page("https://javdb.com/v/Zb7mX", JAVDB_PAGE), "ABW-358").payload()
        self.assertEqual(set(payload), set(page))
        self.assertEqual(payload["genres"], ["單體作品", "美臀", "肛門・肛交"], "译名不进词表，详情页不显示的类别不投出")
        self.assertEqual((payload["title"], payload["display_title"], payload["origin_title"]),
                         (TITLE, "顯示標題", TITLE))
        self.assertEqual(payload["actresses"], [{"japanese_name": "涼森れむ", "profile_source": "javdb", "external_id": "a"}])
        self.assertEqual((payload["maker"], payload["label"], payload["source_url"], payload["source_id"]),
                         ("プレステージ", "", "https://javdb.com/v/Zb7mX", "Zb7mX"))
        record = public_record(PUBLIC_MOVIE)
        self.assertEqual((record.source, record.provenance), ("javdb", "javdb-api"))

    def test_an_unknown_genre_id_withholds_tags_instead_of_guessing(self):
        movie = {**PUBLIC_MOVIE, "tags": [*PUBLIC_MOVIE["tags"], {"id": "91", "name": "乳房"}]}
        self.assertIsNone(page_genres(movie))
        self.assertNotIn("genres", public_record(movie).payload())
        self.assertEqual(page_genres({**PUBLIC_MOVIE, "type": 1, "tags": [{"id": "28", "name": "单体作品"}]}), None,
                         "类别 id 按作品类型分开登记")

    def test_fc2_seller_is_evidence_label_not_studio(self):
        movie = {**PUBLIC_MOVIE, "type": 3, "number": "FC2-1108030", "maker_name": "至高ぷれみあ！",
                 "tags": [{"id": "11", "name": "ハメ撮り"}]}
        payload = public_record(movie).payload()
        self.assertEqual((payload["maker"], payload["label"], payload["genres"]), ("", "至高ぷれみあ！", ["私人攝影"]))

    def test_query_maps_public_answers_without_holding_the_page_cooldown(self):
        session = Session(serve({}))
        cases = ((PublicNotFound("errors.javdbPublic.notFound"), FailureReason.NOT_FOUND),
                 (PublicIdentityAmbiguous("errors.javdbPublic.identityAmbiguous", {"identities": "Aa1"}), FailureReason.PARSE_ERROR),
                 (PublicBudgetExceeded("errors.javdbPublic.budgetExceeded"), FailureReason.TIMEOUT))
        for error, reason in cases:
            with self.subTest(error=type(error).__name__), patch.object(PUBLIC_API, "movie", side_effect=error):
                with self.assertRaises(SourceFailure) as caught:
                    JavDBPublicSource().query("ABW-358", session=session)
                self.assertEqual(caught.exception.reason, reason)
                self.assertEqual(caught.exception.cooldown_action, "")
        with patch.object(PUBLIC_API, "movie", side_effect=PublicIdentityAmbiguous("errors.javdbPublic.identityAmbiguous", {"identities": "x"})):
            with self.assertRaises(SourceFailure) as caught:
                JavDBPublicSource().query("ABW-358", session=session)
        self.assertEqual(caught.exception.detail, "identity_ambiguous")
        self.assertIs(SITE_SOURCES["javdb"], JavDBPublicSource)

    def test_query_reads_the_detail_page_when_the_api_cannot_answer(self):
        pages = {JAVDB_SEARCH: JAVDB_RESULTS, JAVDB_DETAIL: JAVDB_PAGE}
        for error in (PublicSourceUnavailable("errors.javdbPublic.unavailable"), PublicSourcePaused("errors.javdbPublic.sourcePaused")):
            with self.subTest(error=type(error).__name__), patch.object(PUBLIC_API, "movie", side_effect=error):
                record = JavDBPublicSource().query("ABW-358", session=Session(serve(pages)))
            self.assertEqual((record.source, record.provenance, record.code), ("javdb", "javdb-page", "ABW-358"))
            self.assertEqual(record.payload(), work(JavDBSource(), pages, "ABW-358"))
        with patch.object(PUBLIC_API, "movie", side_effect=PublicSourceUnavailable("errors.javdbPublic.unavailable")):
            with self.assertRaises(SourceFailure) as caught:
                JavDBPublicSource().query("ABW-358", session=Session(serve({
                    JAVDB_SEARCH: "<title>登入 | JavDB</title>".encode()})))
        self.assertEqual(caught.exception.reason, FailureReason.AUTH_REQUIRED, "详情页那一问的失败按详情页分档")

    def test_query_returns_the_public_record(self):
        with patch.object(PUBLIC_API, "movie", return_value=PUBLIC_MOVIE) as movie:
            record = JavDBPublicSource().query("ABW-358", session=Session(serve({})))
        movie.assert_called_once_with("ABW-358")
        self.assertEqual((record.code, record.studio, record.runtime), ("ABW-358", "プレステージ", 210))

    def test_wrapped_public_cover_is_unwrapped_before_comparison(self):
        body = gradient(800, 538)
        wrapped = bytes(value ^ 0x7F for value in body)
        url = PUBLIC_MOVIE["cover_url"]
        found, outcome = _download(serve({url: wrapped}), Candidate("tp.spfcas.com", url, ""), deadline=None)
        self.assertEqual((outcome, found.size), ("fetched", (800, 538)))

    def test_same_people_in_another_order_keep_the_previous_candidate_order(self):
        first = [{"name": "七沢みあ", "external_id": "NPD3"}, {"name": "初川みなみ", "external_id": "E6MM"}]
        group = {"candidates_json": json.dumps([{"source": "javdb", "value": first}], ensure_ascii=False)}
        swapped = {"value": list(reversed(first)), "display_value": "初川みなみ、七沢みあ", "warnings": []}
        self.assertEqual(_previous_order(group, "javdb", swapped)["value"], first)
        self.assertEqual(_previous_order(group, "javdb", swapped)["display_value"], "七沢みあ、初川みなみ")
        other = {"value": [first[0]], "display_value": "七沢みあ", "warnings": []}
        self.assertIs(_previous_order(group, "javdb", other), other)
        self.assertIs(_previous_order(group, "javbus", swapped), swapped)
        self.assertIs(_previous_order(None, "javdb", swapped), swapped)

    def test_genre_table_aligns_by_position_infers_hidden_genres_and_refuses_conflicts(self):
        from scripts.generate_javdb_genres import align
        rows = [{"type": 0, "api": [{"id": "57", "name": "屁股"}, {"id": "299", "name": "数位马赛克"}],
                 "html": ["美臀"]},
                {"type": 0, "api": [{"id": "57", "name": "美臀"}, {"id": "30", "name": "女大学生"}],
                 "html": ["美臀", "女大學生"]},
                {"type": 1, "api": [{"id": "30", "name": "3P"}], "html": ["3P"]},
                {"type": 0, "api": [{"id": "30", "name": "3P"}], "html": ["3P"]},
                {"type": 0, "api": [{"id": "8", "name": "精选综合"}], "html": []},
                {"type": 0, "api": [{"id": "65", "name": "苗条"}, {"id": "65", "name": "苗条"}], "html": ["苗條"]},
                {"type": 0, "api": [{"id": "57", "name": "美臀"}, {"id": "390", "name": "LTX破解"}], "html": ["美臀"]},
                {"type": 0, "api": [{"id": "65", "name": "苗条"}, {"id": "299", "name": "数位马赛克"}], "html": ["苗條"]}]
        table, hidden, conflicts, skipped = align(rows)
        self.assertEqual(table, {"0:57": "美臀", "0:65": "苗條", "1:30": "3P"},
                         "重复类别先去重；只多出详情页不显示的那项时其余照样对齐")
        self.assertEqual(hidden, ["0:299"], "只有一部作品为证的 390 不算详情页不显示")
        self.assertEqual(conflicts, {"0:30": ["3P", "女大學生"]})
        self.assertEqual(skipped, 2)


if __name__ == "__main__":
    unittest.main()
