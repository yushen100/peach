"""独立安装的来源配置、凭据边界与实际传输行为。"""
import json
import io
from pathlib import Path
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import httpx
from PIL import Image

from peach import interface_text
from peach.http import HttpRequest, HttpResponse, HttpxTransport
from peach.scraping_access import (SourceTransport, client_for, cookie_jar, describe,
                                   save, source_for, values_for)
from peach.web_scraping import q_scraping, w_scraping_check
from peach import peach_proxy


class ScrapingAccessTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        # 这台机器上装着 Edge 的话，两个 Cloudflare 来源会真的拉起浏览器；测试里当作没有浏览器。
        finder = patch("peach.browser_transport.find_browser", return_value=None)
        finder.start()
        self.addCleanup(finder.stop)

    def test_independent_installations_never_share_session_or_proxy(self):
        peach_proxy.save(self.root, {"mode": "proxy", "proxy": "http://user:private-proxy@127.0.0.1:7890"})
        save(self.root, "javdb", {"cookie": "session=private-cookie", "network": "peach"})
        public = q_scraping(SimpleNamespace(follow_secrets_root=self.root), {})
        self.assertEqual(next(item['label'] for item in public['sources'] if item['source'] == 'javdb'), 'JavDB')
        self.assertNotIn("private-cookie", json.dumps(public))
        self.assertNotIn("private-proxy", json.dumps(public))
        self.assertFalse(describe(self.root / "other-user", "javdb")["cookie_saved"])
        save(self.root, "javdb", {"revoke": True})
        self.assertFalse(describe(self.root, "javdb")["cookie_saved"])
        self.assertEqual(values_for(self.root, "javdb")["network"], "peach")

    def test_import_discards_expired_foreign_and_cdn_cookies(self):
        text = ("# Netscape HTTP Cookie File\n"
                ".instagram.com\tTRUE\t/\tTRUE\t4102444800\tsessionid\tvalid\n"
                ".instagram.com\tTRUE\t/\tTRUE\t1\texpired\told\n"
                ".cdninstagram.com\tTRUE\t/\tTRUE\t4102444800\tsession\tcdn\n"
                ".example.org\tTRUE\t/\tTRUE\t4102444800\tforeign\tother\n")
        jar = cookie_jar({"cookies_text": text}, "instagram")
        self.assertEqual([(c.name, c.value) for c in jar], [("sessionid", "valid")])
        with httpx.Client(cookies=jar) as client:
            self.assertIn("sessionid", client.build_request("GET", "https://www.instagram.com/").headers["cookie"])
            self.assertNotIn("cookie", client.build_request("GET", "https://scontent.cdninstagram.com/x.jpg").headers)

    def test_empty_malformed_and_cross_site_cookie_imports_are_rejected(self):
        for supplied in ({"cookie": "bad\nheader"}, {"cookies_text": "not a cookie jar"},
                         {"cookie": "a=b", "cookies_text": "anything"}):
            with self.subTest(supplied=list(supplied)), self.assertRaises(ValueError):
                save(self.root, "instagram", supplied)

    def test_network_mode_reaches_the_client_and_survives_renewal(self):
        save(self.root, "dmm", {"network": "direct"})
        with patch("peach.scraping_access.httpx.Client") as factory:
            client_for(self.root, "dmm")
            self.assertFalse(factory.call_args.kwargs["trust_env"])
        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)
        with patch("peach.scraping_access.client_for") as factory:
            fake = factory.return_value
            fake.stream.return_value.__enter__.return_value.iter_bytes.return_value = [b"ok"]
            for _ in range(2):
                transport(HttpRequest("GET", "https://pics.dmm.co.jp/x", {}), 1, 10)
                transport.renew()
            self.assertEqual(factory.call_count, 2)
            self.assertEqual(fake.close.call_count, 2)

    def test_javbus_language_preference_reaches_checks_and_work_pages(self):
        from peach.sources import JavBusSource, Session

        save(self.root, "javbus", {"network": "direct", "cookie": "PHPSESSID=test-session"})
        seen = []

        def respond(request):
            seen.append(request.url.path)
            if request.headers.get("Accept-Language") != "zh-CN,zh;q=0.9":
                return httpx.Response(200, text="<title>Age Verification JavBus</title>")
            self.assertIn("PHPSESSID=test-session", request.headers.get("cookie", ""))
            return httpx.Response(200, text=(
                '<h3>ABW-123 测试作品</h3>'
                '<p><span class="header">識別碼:</span> ABW-123</p>'
                '<a class="bigImage" href="/imgs/cover/test.jpg"></a>'))

        def client(root, source, **kwargs):
            return client_for(root, source, transport=httpx.MockTransport(respond), **kwargs)

        with patch("peach.scraping_access.client_for", side_effect=client):
            check = w_scraping_check(SimpleNamespace(follow_secrets_root=self.root), {"source": "javbus"})
            self.assertTrue(check["results"][0]["ok"])
            transport = SourceTransport(self.root)
            self.addCleanup(transport.close)
            record = JavBusSource().query("ABW-123", session=Session(transport))
        self.assertEqual(record.code, "ABW-123")
        self.assertEqual(record.cover_urls, ("https://www.javbus.com/imgs/cover/test.jpg",))
        self.assertEqual(seen, ["/", "/pics/cover/9paa_b.jpg", "/ABW-123"], "检查连图片主机一起问")

    def test_javbus_cover_language_overrides_caller_headers_without_changing_other_sources(self):
        from peach.jav_cover_fetch import _fetch

        for source in ("javbus", "javdb"):
            save(self.root, source, {"network": "direct"})
        seen = []

        def respond(request):
            seen.append(request)
            return httpx.Response(200, content=b"cover")

        def client(root, source, **kwargs):
            return client_for(root, source, transport=httpx.MockTransport(respond), **kwargs)

        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)
        with patch("peach.scraping_access.client_for", side_effect=client):
            self.assertEqual(_fetch(transport, "https://www.javbus.com/imgs/cover/test.jpg",
                referer="https://www.javbus.com/ABW-123", limit=1024, ranged=True), b"cover")
            transport(HttpRequest("GET", "https://www.javbus.com/ABW-123",
                {"accept-language": "en-US", "X-Test": "preserved"}), 1, 1024)
            self.assertEqual(_fetch(transport, "https://javdb.com/test.jpg",
                referer="https://javdb.com/", limit=1024), b"cover")
        self.assertEqual([request.headers["Accept-Language"] for request in seen],
                         ["zh-CN,zh;q=0.9", "zh-CN,zh;q=0.9", "ja,en;q=0.9"])
        self.assertEqual(seen[0].headers["Range"], "bytes=0-65535")
        self.assertEqual(seen[0].headers["Referer"], "https://www.javbus.com/ABW-123")
        self.assertEqual(seen[1].headers.get_list("Accept-Language"), ["zh-CN,zh;q=0.9"])
        self.assertEqual(seen[1].headers["X-Test"], "preserved")

    def test_browser_obeys_global_direct_proxy_and_environment_modes(self):
        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)
        for mode, direct, proxy in (("direct", True, ""),
                                    ("proxy", False, "http://127.0.0.1:7890"),
                                    ("environment", False, "")):
            with self.subTest(mode=mode):
                peach_proxy.save(self.root, {"mode": mode, "proxy": "http://127.0.0.1:7890"})
                with patch("peach.browser_transport.shared") as shared:
                    transport._browser_for("javten")
                self.assertEqual(shared.call_args.kwargs["direct"], direct)
                self.assertEqual(shared.call_args.kwargs["proxy"], proxy)

    def test_the_background_browser_mode_defaults_to_a_window_and_is_read_at_launch(self):
        """后台采集浏览器默认保留窗口；设置成无窗口后，浏览器下次拉起时读到的是新模式。"""
        from peach.scraping_access import browser_mode, save_browser_mode
        self.assertEqual(browser_mode(self.root), "window")
        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)
        with patch("peach.browser_transport.shared") as shared:
            transport._browser_for("javten")
        headless = shared.call_args.kwargs["headless"]
        self.assertFalse(headless())
        self.assertEqual(save_browser_mode(self.root, "headless"), "headless")
        self.assertTrue(headless())
        with self.assertRaises(ValueError):
            save_browser_mode(self.root, "minimized")
        self.assertEqual(browser_mode(self.root), "headless")
        from peach.web_scraping import w_scraping_settings
        contract = SimpleNamespace(follow_secrets_root=self.root)
        self.assertEqual(w_scraping_settings(contract, {"browser_mode": "window"}),
                         {"ok": True, "browser_mode": "window"})
        self.assertEqual(q_scraping(contract, {})["browser_mode"], "window")
        (self.root / "scraping-browser.json").write_text("{broken", encoding="utf-8")
        self.assertEqual(browser_mode(self.root), "window", "存坏了按默认")

    def test_switching_networks_releases_the_previous_exit_cooldown(self):
        from peach.scraping_access import pause_source, paused_until
        pause_source(self.root, 'airav', refused=True)
        self.assertGreater(paused_until(self.root, 'airav'), time.time())
        save(self.root, 'airav', {'network': 'direct'})
        self.assertEqual(paused_until(self.root, 'airav'), 0)

    def test_redirect_selects_destination_policy_and_strips_secrets(self):
        transport = SourceTransport(self.root)
        with patch.object(transport, "_request", side_effect=[
            HttpResponse(302, {"location": "https://pics.dmm.co.jp/x"}, b""),
            HttpResponse(200, {}, b"image"),
        ]) as request:
            result = transport(HttpRequest("GET", "https://r18.dev/x", {"Cookie": "secret", "Authorization": "secret"}), 1, 20)
        self.assertEqual(result.body, b"image")
        self.assertEqual(request.call_args_list[1].args[0].headers, {})
        self.assertEqual(source_for("https://evil-dmm.co.jp/x"), None)
        self.assertEqual(source_for("https://awsimgsrc.dmm.com/x"), "dmm")

    def test_connections_do_not_claim_session_validity_or_echo_exception_urls(self):
        contract = SimpleNamespace(follow_secrets_root=self.root)
        with patch("peach.source_checks.SourceTransport") as factory:
            factory.return_value.side_effect = httpx.ConnectError("https://secret:password@example.org/")
            result = w_scraping_check(contract, {"source": "fc2cmadb"})
        self.assertFalse(result["session_verified"])
        self.assertNotIn("password", json.dumps(result))
        self.assertFalse(result["results"][0]["ok"])

    def test_the_check_tells_a_login_wall_apart_from_an_unreachable_source(self):
        """页面上要分得开三种结果，因为用户的下一步各不相同。

        登录墙不一定回 403。跟完重定向落在登录页的那次响应是 200，只看状态码的判据
        会把一次「其实什么都没取到」报成可连接。反过来，只剩状态码可看的 403 也不许
        报成登录墙：`docs/SOURCING.md` 记着那些 403 多半是出口 IP 被封，去官网登录
        白做一场，正确动作是等或换出口。措辞与元数据来源同源，页面不另写一份。
        """
        contract = SimpleNamespace(follow_secrets_root=self.root)
        login = "https://fc2cmadb.com/"
        cases = ((HttpResponse(403, {}, b"", login), "auth", False, "出口 IP", "请在官网"),
                 (HttpResponse(200, {}, b"<html>login</html>",
                               "https://fc2cmadb.com/users/sign_in"), "auth", False,
                  "请在官网完成登录后重试", "出口 IP"),
                 (HttpResponse(503, {}, b"", login), "unavailable", False, "稍后重试", "登录"),
                 (HttpResponse(200, {}, b"<html>ok</html>", login), "ok", True, "", "登录"))
        for response, kind, ok, says, avoids in cases:
            with self.subTest(status=response.status, url=response.url), \
                    patch("peach.source_checks.SourceTransport") as factory:
                factory.return_value.return_value = response
                result = w_scraping_check(contract, {"source": "fc2cmadb"})["results"][0]
            self.assertEqual((result["kind"], result["ok"]), (kind, ok))
            self.assertIn(says, result.get("message", ""))
            self.assertNotIn(avoids, result.get("message", ""))

    def test_transport_ownership_is_explicit(self):
        for owned in (True, False):
            client = httpx.Client()
            transport = HttpxTransport(client, owns_client=owned)
            transport.close()
            self.assertEqual(client.is_closed, owned)
            client.close()

    def test_connection_checks_classify_failures_and_store_only_diagnostics(self):
        from peach.scraping_access import source_checks
        contract = SimpleNamespace(follow_secrets_root=self.root)
        cases = [
            (httpx.ProxyError("http://user:secret@proxy.invalid"), "proxy"),
            (httpx.ReadTimeout("secret"), "timeout"),
            (HttpResponse(429, {}, b"", "https://airav.io/"), "rate_limited"),
            (HttpResponse(200, {}, b"<title>Just a moment</title>", "https://airav.io/"), "cloudflare_challenge"),
        ]
        for outcome, reason in cases:
            with self.subTest(reason=reason), patch("peach.source_checks.SourceTransport") as factory:
                if isinstance(outcome, Exception):
                    factory.return_value.side_effect = outcome
                else:
                    factory.return_value.return_value = outcome
                result = w_scraping_check(contract, {"source": "airav"})["results"][0]
            self.assertFalse(result["ok"])
            self.assertEqual(result["reason"], reason)
            self.assertGreaterEqual(result["elapsed_s"], 0)
            stored = source_checks(self.root, "airav")["connection"]
            self.assertEqual(stored["reason"], reason)
            self.assertNotIn("secret", json.dumps(stored))
            self.assertNotIn("url", stored)

    def test_rate_limit_cooldown_survives_a_new_transport(self):
        from peach.scraping_access import SourcePaused
        transport = SourceTransport(self.root)
        transport.transports["dmm"] = lambda *args: HttpResponse(429, {"retry-after": "600"}, b"")
        request = HttpRequest("GET", "https://pics.dmm.co.jp/x", {})
        with self.assertRaises(SourcePaused):
            transport(request, 1, 100)
        with patch("peach.scraping_access.client_for") as factory:
            with self.assertRaises(SourcePaused):
                SourceTransport(self.root)(request, 1, 100)
        factory.assert_not_called()

    def test_a_spent_budget_says_what_to_do_instead_of_naming_the_counter(self):
        """三条闸门按任务重新计数，所以话说到「再跑一次接着采」为止。

        「请求预算」是这个类内部的词：看到它的人在问题清单里只能读出「有个数用完了」，
        既不知道那个数归谁管，也不知道自己还要不要动手。一趟任务的用量见
        `library_processing.SourceBudget`。
        """
        from peach.scraping_access import SourcePaused
        request = HttpRequest("GET", "https://javdb.com/search?q=ABW-358", {})
        budgets = [
            SourceTransport(self.root, max_requests=1),
            SourceTransport(self.root, max_seconds=0.001),
            SourceTransport(self.root, max_bytes=1),
        ]
        budgets[0].requests = 1
        budgets[1].deadline = time.monotonic() - 1
        budgets[2].bytes = 1
        for transport in budgets:
            with self.assertRaises(SourcePaused) as spent:
                transport(request, 1, 100)
            self.assertIn("本趟", str(spent.exception))
            self.assertIn("再跑一次接着采", str(spent.exception))
            self.assertNotIn("预算", str(spent.exception))

    def test_a_library_scan_asks_for_enough_to_carry_a_batch_of_covers(self):
        """一趟任务的三条闸门要够一批片子用完，不然每次跑都停在同一个地方。

        一部片问三家目录站、每家 1～2 次，6000 次约等于 1500 部；每来源 2 秒的间隔下
        三家并行也要 4 小时才用得完，时间不会先掐断请求数。每次约 250 KB，1 GiB 装得下。
        """
        from peach import library_processing
        self.assertEqual(library_processing.SourceBudget(), library_processing.SourceBudget(
            requests=6000, bytes=1024 * 1024 * 1024, seconds=4 * 3600))
        # 设置里能选的档位要包含默认档：没调过的人看到的就是现在这一档。
        self.assertEqual(library_processing.source_budget_settings({}), {
            'sourceBudgetRequests': 6000, 'sourceBudgetHours': 4, 'sourceBudgetGigabytes': 1})
        for key, value in library_processing.SOURCE_BUDGET_DEFAULTS.items():
            self.assertIn(value, library_processing.SOURCE_BUDGET_CHOICES[key])

    def test_a_community_source_that_refuses_is_paused_as_a_whole(self):
        """javdb 超配额回 403 不带 Retry-After，接着问只会每条都再撞一次、把封期拖长。"""
        from peach.scraping_access import SourcePaused
        transport = SourceTransport(self.root)
        transport.transports["javdb"] = lambda *args: HttpResponse(403, {}, b"")
        with self.assertRaises(SourcePaused):
            transport(HttpRequest("GET", "https://javdb.com/search?q=ABW-358", {}), 1, 100)
        with patch("peach.scraping_access.client_for") as factory, self.assertRaises(SourcePaused):
            SourceTransport(self.root)(HttpRequest("GET", "https://c0.jdbstatic.com/covers/x.jpg", {}), 1, 100)
        factory.assert_not_called()
        transport.transports["dmm"] = lambda *args: HttpResponse(403, {}, b"")
        self.assertEqual(transport(HttpRequest("GET", "https://pics.dmm.co.jp/x", {}), 1, 100).status, 403,
                         '官方来源的 403 照常交给调用方判断')

    def test_the_pause_starts_short_and_only_doubles_on_a_second_refusal(self):
        """第一次拒绝只停 `FIRST_BLOCKED_PAUSE`，`blocked_pause` 是连撞多次后的上限。

        封期常常远短于上限，一次就记满等于让整个来源盲等一整天：2026-09-22 那轮 778 部片
        的 1432 条失败全部写着「来源正在冷却」，而同一套 client 当时问 javdb 全回 200。
        """
        from peach.scraping_access import (FIRST_BLOCKED_PAUSE, SOURCES, SourcePaused)
        cooldown = self.root / "scraping-javdb.cooldown.json"
        request = HttpRequest("GET", "https://javdb.com/search?q=ABW-358", {})
        waits = []
        for _ in range(3):
            transport = SourceTransport(self.root)
            transport.transports["javdb"] = lambda *args: HttpResponse(403, {}, b"")
            with self.assertRaises(SourcePaused):
                transport(request, 1, 100)
            record = json.loads(cooldown.read_text(encoding="utf-8"))
            waits.append(round(record["until"] - time.time()))
            cooldown.write_text(json.dumps({"until": 0, "blocks": record["blocks"]}), encoding="utf-8")
        self.assertEqual(waits, [FIRST_BLOCKED_PAUSE, FIRST_BLOCKED_PAUSE * 2, FIRST_BLOCKED_PAUSE * 4])
        self.assertLess(FIRST_BLOCKED_PAUSE * 4, SOURCES["javdb"]["blocked_pause"])

    def test_one_request_that_gets_through_clears_the_pause(self):
        """封解了就该从最短的一档重新起算，不然下一次拒绝直接跳到上限。"""
        from peach.scraping_access import FIRST_BLOCKED_PAUSE, SourcePaused
        cooldown = self.root / "scraping-javdb.cooldown.json"
        request = HttpRequest("GET", "https://javdb.com/search?q=ABW-358", {})
        cooldown.parent.mkdir(parents=True, exist_ok=True)
        cooldown.write_text(json.dumps({"until": 0, "blocks": 6}), encoding="utf-8")
        opened = SourceTransport(self.root)
        opened.transports["javdb"] = lambda *args: HttpResponse(200, {}, b"ok")
        self.assertEqual(opened(request, 1, 100).status, 200)
        self.assertFalse(cooldown.exists())
        refused = SourceTransport(self.root)
        refused.transports["javdb"] = lambda *args: HttpResponse(403, {}, b"")
        with self.assertRaises(SourcePaused):
            refused(request, 1, 100)
        self.assertEqual(round(json.loads(cooldown.read_text(encoding="utf-8"))["until"] - time.time()),
                         FIRST_BLOCKED_PAUSE)

    def test_a_region_page_pauses_the_source_briefly_and_says_to_change_the_exit(self):
        """地区限制页多半回 200，交给调用方只会被读成「解不出条目」或「站上没有」。

        JavDB 对日本出口回 1.8 KB 的版权说明（2026-11-08 实测），DMM 系与日本站回英文或日文的
        地区说明。三种都整站停下，而且只停最短的一档、连撞也不翻倍：要换出口才会变，用户改完
        代理不该再等一整天。
        """
        from peach.scraping_access import FIRST_BLOCKED_PAUSE, SourcePaused, SourceRefused
        pages = {
            "javdb": ("https://javdb.com/actors/RJM8",
                      "<html><body>\nDue to copyright restrictions, access to this site is prohibited in "
                      "the country where your internet is located.\n<br /><br />\n"
                      "由於版權限制，本站禁止了你的網路所在國家的訪問。\n</body></html>"),
            "dmm": ("https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=abw00358/",
                    "<html><body><h1>Sorry! This content is not available in your region.</h1></body></html>"),
            "mgstage": ("https://www.mgstage.com/product/product_detail/SIRO-5000/",
                        "<html><body><p>申し訳ございません。お住まいの地域からはご利用になれません。</p></body></html>"),
        }
        for source, (url, page) in pages.items():
            with self.subTest(source=source):
                cooldown = self.root / f"scraping-{source}.cooldown.json"
                waits = []
                for _ in range(2):
                    transport = SourceTransport(self.root)
                    transport.transports[source] = lambda *args, page=page: HttpResponse(
                        200, {}, page.encode("utf-8"))
                    with self.assertRaises(SourceRefused) as refused:
                        transport(HttpRequest("GET", url, {}), 1, 100000)
                    self.assertEqual(refused.exception.reason, "geo_restricted")
                    self.assertIn("换一个它接受的地区的出口", str(refused.exception))
                    record = json.loads(cooldown.read_text(encoding="utf-8"))
                    waits.append(round(record["until"] - time.time()))
                    cooldown.write_text(json.dumps({"until": 0, "blocks": record["blocks"]}), encoding="utf-8")
                self.assertEqual(waits, [FIRST_BLOCKED_PAUSE, FIRST_BLOCKED_PAUSE])
                with self.assertRaises(SourcePaused):
                    cooldown.write_text(json.dumps({"until": time.time() + 60, "blocks": 0}),
                                        encoding="utf-8")
                    SourceTransport(self.root)(HttpRequest("GET", url, {}), 1, 100)

    def test_a_ban_page_doubles_like_a_refusal_and_ordinary_pages_pass(self):
        """封禁说明页按 403 那一档翻倍；正文里没有这几句话的正常页原样交回。"""
        from peach.scraping_access import FIRST_BLOCKED_PAUSE, SourceRefused
        cooldown = self.root / "scraping-javbus.cooldown.json"
        request = HttpRequest("GET", "https://www.javbus.com/ABW-358", {})
        waits = []
        for _ in range(2):
            transport = SourceTransport(self.root)
            transport.transports["javbus"] = lambda *args: HttpResponse(
                200, {}, b"<html><body>The owner of this website has banned your access.</body></html>")
            with self.assertRaises(SourceRefused) as refused:
                transport(request, 1, 100000)
            self.assertEqual(refused.exception.reason, "ip_banned")
            record = json.loads(cooldown.read_text(encoding="utf-8"))
            waits.append(round(record["until"] - time.time()))
            cooldown.write_text(json.dumps({"until": 0, "blocks": record["blocks"]}), encoding="utf-8")
        self.assertEqual(waits, [FIRST_BLOCKED_PAUSE, FIRST_BLOCKED_PAUSE * 2])
        opened = SourceTransport(self.root)
        opened.transports["javbus"] = lambda *args: HttpResponse(200, {}, b"<html>ABW-358 page</html>")
        self.assertEqual(opened(request, 1, 100000).status, 200)
        self.assertFalse(cooldown.exists())

    def test_a_connection_check_names_the_region_refusal(self):
        """来源检查撞上地区限制页：细档报 `geo_restricted`，话说到「换出口」，不是「稍后重试」。"""
        from peach.scraping_access import source_checks
        transport = SourceTransport(self.root)
        transport.transports["javdb"] = lambda *args: HttpResponse(
            200, {}, "由於版權限制，本站禁止了你的網路所在國家的訪問。".encode("utf-8"))
        with patch("peach.source_checks.SourceTransport", return_value=transport):
            result = w_scraping_check(SimpleNamespace(follow_secrets_root=self.root),
                                      {"source": "javdb"})["results"][0]
        self.assertFalse(result["ok"])
        self.assertEqual((result["kind"], result["reason"]), ("auth", "geo_restricted"))
        self.assertIn("换一个它接受的地区的出口", result["message"])
        self.assertEqual(source_checks(self.root, "javdb")["connection"]["reason"], "geo_restricted")

    def test_community_sources_carry_the_pasted_cookie_on_public_requests(self):
        """JavBus 的年龄门和 javdb 的登录墙靠用户贴的 Cookie 过；别的来源公开采集不带会话。"""
        self.assertTrue(describe(self.root, "javdb")["accepts_cookie"])
        save(self.root, "javbus", {"cookie": "existmag=all; age=verified"})
        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)
        with patch("peach.scraping_access.client_for") as factory:
            fake = factory.return_value
            fake.stream.return_value.__enter__.return_value.iter_bytes.return_value = [b"ok"]
            transport(HttpRequest("GET", "https://www.javbus.com/MIDE-594", {}), 1, 10)
            transport(HttpRequest("GET", "https://pics.dmm.co.jp/x", {}), 1, 10)
        self.assertEqual([call.args[1] for call in factory.call_args_list], ["javbus", "dmm"])
        self.assertEqual([call.kwargs["session"] for call in factory.call_args_list], [True, False])
        with httpx.Client(cookies=cookie_jar(values_for(self.root, "javbus"), "javbus")) as client:
            self.assertIn("age=verified", client.build_request("GET", "https://www.javbus.com/MIDE-594").headers["cookie"])
            self.assertNotIn("cookie", client.build_request("GET", "https://pics.dmm.co.jp/x").headers)

    def test_the_fc2_mirror_carries_the_pasted_cookie_too(self):
        """女優那一栏在浏览器里只对登录用户显示，采集按登录用户看到的那一页取。"""
        save(self.root, "fc2cmadb", {"cookie": "peach_session=abc"})
        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)
        with patch("peach.scraping_access.client_for") as factory:
            fake = factory.return_value
            fake.stream.return_value.__enter__.return_value.iter_bytes.return_value = [b"ok"]
            transport(HttpRequest("GET", "https://fc2cmadb.com/articles/4030617", {}), 1, 10)
        self.assertEqual(factory.call_args.args[1], "fc2cmadb")
        self.assertTrue(factory.call_args.kwargs["session"])
        with httpx.Client(cookies=cookie_jar(values_for(self.root, "fc2cmadb"), "fc2cmadb")) as client:
            self.assertIn("peach_session=abc", client.build_request(
                "GET", "https://fc2cmadb.com/articles/4030617").headers["cookie"])

    def test_the_cloudflare_sources_carry_the_pasted_cookie_under_the_shared_browser_user_agent(self):
        """`cf_clearance` 绑着解题那台浏览器的 UA：整站 UA 与用户的 Chrome 一致，Cookie 由用户贴，卡上不另收 UA。"""
        from peach.user_agent import USER_AGENT
        shown = save(self.root, "fc2ppvdb", {"cookie": "cf_clearance=abc"})
        self.assertEqual(set(shown), {"source", "label", "login", "accepts_cookie", "network", "cookie_saved", "browser", "cooldown_until"})
        self.assertTrue(shown["cookie_saved"])
        self.assertFalse(shown["browser"], "没有浏览器的机器上这张卡照旧收 Cookie")
        for name in ("fc2ppvdb", "javten"):
            with client_for(self.root, name) as client:
                self.assertEqual(client.headers["user-agent"], USER_AGENT, name)
        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)
        with patch("peach.scraping_access.client_for") as factory:
            fake = factory.return_value
            fake.stream.return_value.__enter__.return_value.iter_bytes.return_value = [b"ok"]
            transport(HttpRequest("GET", "https://fc2ppv-db.com/ja/videos/4898837", {}), 1, 10)
            transport(HttpRequest("GET", "https://javten.com/search?kw=4898837", {}), 1, 10)
        self.assertEqual([(call.args[1], call.kwargs["session"]) for call in factory.call_args_list],
                         [("fc2ppvdb", True), ("javten", True)])

    def test_the_cloudflare_sources_go_through_the_local_browser_when_there_is_one(self):
        """有浏览器的机器上两站的请求在浏览器页面里发（ADR-0065）：连接方式换成启动参数，Cookie 不再是必需的。"""
        save(self.root, "fc2ppvdb", {"network": "direct"})
        peach_proxy.save(self.root, {"mode": "proxy", "proxy": "socks5://127.0.0.1:7890"})
        fake = lambda request, timeout, max_bytes: HttpResponse(200, {}, b"page", request.url)
        fake.close = lambda: self.fail("浏览器是进程共用的，SourceTransport.close 不许关它")
        transport = SourceTransport(self.root)
        with patch("peach.browser_transport.shared", return_value=fake) as shared:
            transport(HttpRequest("GET", "https://fc2ppv-db.com/ja/videos/1", {}), 1, 100)
            transport(HttpRequest("GET", "https://javten.com/search?kw=1", {}), 1, 100)
        self.assertEqual([(call.kwargs["direct"], call.kwargs["proxy"]) for call in shared.call_args_list],
                         [(True, ""), (False, "socks5://127.0.0.1:7890")])
        self.assertEqual(shared.call_args.args, (self.root / "browser",))
        self.assertEqual(shared.call_args_list[0].kwargs["gates"],
                         {"fc2ppv-db.com": {"path": "/age-verify", "button": r"18|はい|入場|同意|以上|Enter|Yes"}},
                         "FC2PPV-DB 的年龄门交给浏览器传输去点")
        self.assertEqual(shared.call_args_list[1].kwargs["gates"], {}, "JAVten 没有门")
        transport.close()
        self.assertFalse(describe(self.root, "javten")["browser"])
        with patch("peach.browser_transport.find_browser", return_value="C:/edge.exe"):
            self.assertTrue(describe(self.root, "javten")["browser"])
        with patch("peach.scraping_access.client_for") as factory, \
                patch("peach.browser_transport.shared", return_value=None):
            factory.return_value.stream.return_value.__enter__.return_value.iter_bytes.return_value = [b"ok"]
            SourceTransport(self.root)(HttpRequest("GET", "https://javten.com/", {}), 1, 10)
        self.assertEqual(factory.call_args.kwargs["session"], True, "没有浏览器就退回带 Cookie 的直连")

    def test_an_unsolved_challenge_pauses_the_source_and_a_lost_browser_reads_as_a_connection_failure(self):
        from peach import browser_transport
        from peach.scraping_access import SourcePaused
        cooldown = self.root / "scraping-fc2ppvdb.cooldown.json"
        request = HttpRequest("GET", "https://fc2ppv-db.com/ja/videos/1", {})

        def unsolved(*args):
            raise browser_transport.ChallengeUnsolved("fc2ppv-db.com 的人机验证在 150 秒内没有通过")

        transport = SourceTransport(self.root)
        transport.transports["fc2ppvdb"] = unsolved
        with self.assertRaises(SourcePaused) as caught:
            transport(request, 1, 100)
        self.assertIn("点一下验证", str(caught.exception))
        self.assertTrue(cooldown.exists())
        cooldown.unlink()

        def lost(*args):
            raise browser_transport.BrowserUnavailable("浏览器请求未取得")

        transport.transports["fc2ppvdb"] = lost
        with self.assertRaises(httpx.TransportError):
            transport(request, 1, 100)
        self.assertFalse(cooldown.exists(), "浏览器断了是连接问题，不记来源的账")

    def test_a_pause_earned_on_the_direct_path_does_not_hold_back_the_browser(self):
        """直连 403 攒下的冷却不压到浏览器那条路上：换了路就作废，浏览器撞验证没过从第一档重新数。"""
        from peach import browser_transport
        from peach.scraping_access import FIRST_BLOCKED_PAUSE, SourcePaused

        class FakeBrowser(browser_transport.BrowserTransport):
            def __init__(self, respond):
                self.respond = respond

            def __call__(self, request, timeout, max_bytes):
                return self.respond(request)

        cooldown = self.root / "scraping-fc2ppvdb.cooldown.json"
        request = HttpRequest("GET", "https://fc2ppv-db.com/ja/videos/1", {})
        refused = SourceTransport(self.root)
        refused.transports["fc2ppvdb"] = lambda *args: HttpResponse(403, {}, b"")
        for _ in range(3):
            with self.assertRaises(SourcePaused):
                refused(request, 1, 100)
            record = json.loads(cooldown.read_text(encoding="utf-8"))
            cooldown.write_text(json.dumps({**record, "until": 0}), encoding="utf-8")
        cooldown.write_text(json.dumps({**record, "until": time.time() + 3600}), encoding="utf-8")
        self.assertEqual((record["blocks"], record["via"]), (3, "http"))

        opened = SourceTransport(self.root)
        opened.transports["fc2ppvdb"] = FakeBrowser(lambda request: HttpResponse(200, {}, b"page", request.url))
        self.assertEqual(opened(request, 1, 100).status, 200, "直连那一小时的冷却不拦浏览器")
        self.assertFalse(cooldown.exists())

        def unsolved(request):
            raise browser_transport.ChallengeUnsolved("fc2ppv-db.com 的人机验证在 160 秒内没有通过")

        cooldown.write_text(json.dumps({"until": 0, "blocks": 3, "via": "http"}), encoding="utf-8")
        challenged = SourceTransport(self.root)
        challenged.transports["fc2ppvdb"] = FakeBrowser(unsolved)
        with self.assertRaises(SourcePaused):
            challenged(request, 1, 100)
        record = json.loads(cooldown.read_text(encoding="utf-8"))
        self.assertEqual((round(record["until"] - time.time()), record["blocks"], record["via"]),
                         (FIRST_BLOCKED_PAUSE, 1, "browser"), "浏览器那条路的第一次从第一档起")
        with self.assertRaises(SourcePaused):
            challenged(request, 1, 100)

        # 浏览器那条路写下的冷却，回到直连时同样作废：直连会被按自己的账重新判。
        direct = SourceTransport(self.root)
        direct.transports["fc2ppvdb"] = lambda *args: HttpResponse(200, {}, b"page")
        self.assertEqual(direct(request, 1, 100).status, 200)
        self.assertFalse(cooldown.exists())

    def test_the_javdb_account_cookie_rides_only_on_requests_the_user_opened(self):
        """后台任务匿名取 JavDB，用户点开的页面才带登录账号；JavBus 年龄门的会话照带。"""
        from peach import scraping_access
        save(self.root, "javdb", {"cookie": "_jdb_session=private"})
        self.assertFalse(scraping_access.sends_cookie("javdb"))
        self.assertTrue(scraping_access.sends_cookie("javbus"))
        with scraping_access.with_account():
            self.assertTrue(scraping_access.sends_cookie("javdb"))
        self.assertFalse(scraping_access.sends_cookie("javdb"))
        with patch.object(scraping_access, "client_for", wraps=scraping_access.client_for) as made:
            SourceTransport(self.root)._transport_for("javdb").close()
            with scraping_access.with_account():
                SourceTransport(self.root)._transport_for("javdb").close()
        self.assertEqual([call.kwargs["session"] for call in made.call_args_list], [False, True])
        # 匿名那次撞上 403，不让人去换 Cookie：这次根本没带。
        transport = SourceTransport(self.root)
        transport.transports["javdb"] = lambda *args: HttpResponse(403, {}, b"")
        with self.assertRaises(scraping_access.SourcePaused) as caught:
            transport(HttpRequest("GET", "https://javdb.com/search?q=ABP-616&f=all", {}), 1, 100)
        self.assertNotIn("Cookie", str(caught.exception))

    def test_a_suspended_account_pauses_until_the_page_says_it_resumes(self):
        """账号被临时停用与出口被拦分开：按页面写的恢复时刻停，提示里说停的是账号、换出口没用。"""
        from peach.scraping_access import SourceRefused, cooldown_state
        from datetime import datetime, timedelta, timezone
        resume = datetime.now(timezone(timedelta(hours=8))).replace(second=0, microsecond=0) + timedelta(hours=5)
        body = ("<html><body><div>帳號已被臨時停用：系統檢測到該帳號的瀏覽速度遠超正常用戶，判定為異常採集行為。"
                f"將於 {resume:%Y-%m-%d %H:%M}（UTC+08:00）自動恢復。</div></body></html>").encode("utf-8")
        save(self.root, "javdb", {"cookie": "_jdb_session=private"})
        transport = SourceTransport(self.root)
        transport.transports["javdb"] = lambda *args: HttpResponse(403, {}, body)
        with self.assertRaises(SourceRefused) as caught:
            transport(HttpRequest("GET", "https://javdb.com/search?q=ABP-616&f=all", {}), 1, 100000)
        self.assertEqual(caught.exception.reason, "account_suspended")
        self.assertIn("账号被临时停用", str(caught.exception))
        self.assertIn("换出口没用", str(caught.exception))
        # 恢复时刻说成「今晚 21:39」「明天 09:00」这类，不写月日时间戳；按显示语言渲染。
        local = datetime.fromtimestamp(resume.timestamp())
        self.assertIn(f" {local:%H:%M} 自动恢复", str(caught.exception))
        self.assertNotIn(f"{local:%m-%d}", str(caught.exception))
        self.assertTrue(caught.exception.params["time"]["code"].startswith("labels.resumeAt."))
        until, blocks = cooldown_state(self.root, "javdb")
        self.assertAlmostEqual(until, resume.timestamp(), delta=1)
        self.assertEqual(blocks, 0, "账号停用不往出口封禁那档翻倍")

    def test_a_resume_moment_reads_as_tonight_or_tomorrow_in_each_language(self):
        """恢复时刻按本机时间说成今晚、明天、后天，再远带月日；英文同一句也这样说。"""
        from datetime import datetime
        from peach.scraping_access import resume_phrase
        now = datetime(2026, 11, 16, 20, 0).timestamp()
        cases = [(datetime(2026, 11, 16, 21, 39), "今晚 21:39", "at 21:39 tonight"),
                 (datetime(2026, 11, 16, 3, 0), "今天凌晨 03:00", "at 03:00 today"),
                 (datetime(2026, 11, 17, 9, 0), "明天 09:00", "at 09:00 tomorrow"),
                 (datetime(2026, 11, 17, 2, 30), "明天凌晨 02:30", "at 02:30 tomorrow"),
                 (datetime(2026, 11, 17, 22, 0), "明晚 22:00", "at 22:00 tomorrow night"),
                 (datetime(2026, 11, 18, 8, 0), "后天 08:00", "at 08:00 the day after tomorrow"),
                 (datetime(2026, 11, 22, 10, 5), "11月22日 10:05", "at 10:05 on 11/22")]
        for moment, chinese, english in cases:
            phrase = resume_phrase(moment.timestamp(), now)
            self.assertTrue(interface_text.nested(phrase), phrase)
            self.assertEqual(interface_text.text(f"server:{phrase['code']}", phrase["params"]), chinese)
            self.assertEqual(interface_text.text(f"server:{phrase['code']}", phrase["params"], "en"), english)

    def test_a_new_cookie_lifts_the_pause_the_old_one_earned(self):
        """过期的 `cf_clearance` 撞出 403 后整站冷却；用户换了新 Cookie 就该立刻再试，不等旧账到期。"""
        from peach.scraping_access import SourcePaused
        cooldown = self.root / "scraping-javten.cooldown.json"
        request = HttpRequest("GET", "https://javten.com/search?kw=4898837", {})
        # 没贴过 Cookie 时，裸 403 不提 Cookie。
        refused = SourceTransport(self.root)
        refused.transports["javten"] = lambda *args: HttpResponse(403, {}, b"")
        with self.assertRaises(SourcePaused) as caught:
            refused(request, 1, 100)
        self.assertNotIn("Cookie", str(caught.exception))
        cooldown.unlink()
        save(self.root, "javten", {"cookie": "cf_clearance=old"})
        refused = SourceTransport(self.root)
        refused.transports["javten"] = lambda *args: HttpResponse(403, {}, b"")
        with self.assertRaises(SourcePaused) as caught:
            refused(request, 1, 100)
        self.assertIn("Cookie 已过期", str(caught.exception))
        self.assertTrue(cooldown.exists())
        save(self.root, "javten", {"network": "peach"})
        self.assertTrue(cooldown.exists(), "只改连接方式不算换了 Cookie")
        save(self.root, "javten", {"cookie": "cf_clearance=new"})
        self.assertFalse(cooldown.exists())

    def test_full_quality_bytes_are_installed_and_cache_avoids_download(self):
        from peach.web_scraping import _fetch_cover
        from peach.jav_cover_fetch import Candidate
        output = io.BytesIO()
        Image.new("RGB", (1600, 1000)).save(output, "JPEG")
        original = output.getvalue()
        contract = SimpleNamespace(cover_root=self.root / "covers", candidate_root=self.root,
                                   follow_secrets_root=self.root / "secrets", follow_sources_root=self.root)
        with patch("peach.jav_cover_fetch.best_cover", return_value=(
            Candidate("dmm", "https://pics.dmm.co.jp/fixture.jpg"), (1600, 1000), original,
        )) as fetch:
            result = _fetch_cover(contract, "ABW-232")
            cached = _fetch_cover(contract, "ABW-232")
        self.assertTrue(result["ok"])
        self.assertTrue(cached["ok"])
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual((contract.cover_root / "ABW-232.jpg").read_bytes(), original)

    def test_smaller_candidate_cannot_overwrite_a_full_quality_cover(self):
        from peach.web_scraping import _fetch_cover
        from peach.jav_cover_fetch import Candidate
        target = self.root / "ABW-232.jpg"
        Image.new("RGB", (2000, 1400)).save(target, "JPEG")
        original = target.read_bytes()
        contract = SimpleNamespace(cover_root=self.root, candidate_root=self.root,
                                   follow_secrets_root=self.root / "secrets", follow_sources_root=self.root)
        with patch("peach.jav_cover_fetch.best_cover", return_value=(
            Candidate("dmm", "https://pics.dmm.co.jp/fixture.jpg"), (800, 600), b"small",
        )):
            result = _fetch_cover(contract, "ABW-232")
        self.assertTrue(result["ok"])
        self.assertEqual(result["reason"], "kept_existing")
        self.assertIn("2000 × 1400", result["result"])
        self.assertIn("800 × 600", result["result"])
        self.assertEqual(target.read_bytes(), original)

    def test_equal_size_product_image_replaces_a_preview(self):
        from peach.web_scraping import _fetch_cover
        from peach.jav_cover_fetch import candidate_for
        preview = ("https://image.mgstage.com/images/luxutv/sp/259luxu/1509/"
                   "popsample2_sp-259luxu-1509.jpg")
        product = ("https://image.mgstage.com/images/luxutv/259luxu/1509/"
                   "pb_e_259luxu-1509.jpg")
        target = self.root / "259LUXU-1509.jpg"
        old = io.BytesIO()
        Image.new("RGB", (840, 472), "black").save(old, "JPEG")
        target.write_bytes(old.getvalue())
        target.with_suffix(".scraping.json").write_text(json.dumps({
            "checked_at": 0, "source_url": preview, "raw_sha256": "old",
            "width": 840, "height": 472,
        }), encoding="utf-8")
        new = io.BytesIO()
        Image.new("RGB", (840, 472), "white").save(new, "JPEG")
        contract = SimpleNamespace(cover_root=self.root, candidate_root=self.root,
                                   follow_secrets_root=self.root / "secrets",
                                   follow_sources_root=self.root)
        with patch("peach.jav_cover_fetch.best_cover", return_value=(
            candidate_for(product), (840, 472), new.getvalue(),
        )), patch("peach.cover_artwork._sidecars", return_value={}):
            result = _fetch_cover(contract, "259LUXU-1509")
        self.assertTrue(result["ok"])
        self.assertNotEqual(result.get("reason"), "kept_existing")
        self.assertEqual(target.read_bytes(), new.getvalue())

    def test_cover_failure_explains_observed_cause_without_exposing_urls(self):
        from peach.web_scraping import _fetch_cover
        from peach.jav_cover_fetch import NotFound
        contract = SimpleNamespace(cover_root=self.root, candidate_root=self.root,
                                   follow_secrets_root=self.root / "secrets", follow_sources_root=self.root)
        cases = [(403, "access_denied"), (503, "source_error"), (404, "no_candidate"), (None, "network")]
        for status, reason in cases:
            def fetch(transport, *args, **kwargs):
                try:
                    transport(HttpRequest("GET", "https://example.test/private?token=secret", {}), 1, 100)
                except httpx.TransportError:
                    pass
                raise NotFound("errors.javCoverFetch.noCandidates")
            with self.subTest(reason=reason), patch("peach.jav_cover_fetch.best_cover", side_effect=fetch), \
                    patch("peach.web_scraping.SourceTransport") as factory:
                if status is None:
                    factory.return_value.side_effect = httpx.ConnectError("private?token=secret")
                else:
                    factory.return_value.return_value = HttpResponse(status, {}, b"")
                result = _fetch_cover(contract, "ABW-232")
            self.assertFalse(result["ok"])
            self.assertEqual(result["reason"], reason)
            self.assertNotIn("secret", json.dumps(result))
            self.assertNotIn("可能需要代理", result["error"])

    def test_unreachable_dmm_image_hosts_point_at_the_connection_setting(self):
        """中国移动宽带直连 DMM 图片主机大多在握手后被断开：封面比较和连接检查都要把人
        指到 DMM / FANZA 的连接方式上，而不是说官方没有图、或让人去官网登录。"""
        from peach.source_checks import MOBILE_BROADBAND_HINT
        from peach.web_scraping import _fetch_cover
        from peach.jav_cover_fetch import HOSTS_UNREACHABLE, HOSTS_UNREACHABLE_CODE, CoverConnectError
        contract = SimpleNamespace(cover_root=self.root, candidate_root=self.root,
                                   follow_secrets_root=self.root / "secrets", follow_sources_root=self.root)
        with patch("peach.jav_cover_fetch.best_cover", side_effect=CoverConnectError(HOSTS_UNREACHABLE_CODE)), \
                patch("peach.web_scraping.SourceTransport"):
            result = _fetch_cover(contract, "ABW-232")
        self.assertEqual(result["reason"], "network")
        self.assertEqual(result["error"], f"{HOSTS_UNREACHABLE}，未能完成封面比较；{MOBILE_BROADBAND_HINT}已有图片保留。")
        english = "".join(interface_text.text(f"server:{part['code']}", part["params"], language="en")
                          for part in result["error_parts"])
        self.assertEqual(english, "Can't connect to any official image host, so the cover comparison didn't finish. "
                                  "On China Mobile broadband, direct connections to DMM image hosts are often dropped "
                                  "after the handshake; set the DMM / FANZA connection to the Peach proxy. "
                                  "The existing image was kept.")
        with patch("peach.source_checks.SourceTransport") as factory:
            factory.return_value.side_effect = httpx.ConnectError("EOF occurred in violation of protocol")
            checks = {item["label"]: item for item in
                      w_scraping_check(SimpleNamespace(follow_secrets_root=self.root), {"source": "dmm"})["results"]}
        self.assertIn(MOBILE_BROADBAND_HINT, checks["图片 CDN"]["message"])
        self.assertNotIn(MOBILE_BROADBAND_HINT, checks["来源页面"]["message"])
        cdn = checks["图片 CDN"]
        self.assertEqual((cdn["target"], checks["来源页面"]["target"]), ("cdn", "page"))
        self.assertEqual(interface_text.text(f"server:{cdn['label_code']}", language="en"), "Image CDN")
        self.assertEqual(interface_text.text(f"server:{cdn['message_code']}", cdn["message_params"], language="en"),
                         "Can't connect. On China Mobile broadband, direct connections to DMM image hosts are often "
                         "dropped after the handshake; set the DMM / FANZA connection to the Peach proxy.")


    def test_the_dmm_check_asks_the_catalog_api_instead_of_the_age_gated_home_page(self):
        """DMM 首页 301 到 fanza.jp 再落到年龄确认页，按首页查永远是「要登录」（#144）；采集走的是
        不设年龄门的 GraphQL 接口，检查问它。"""
        sent = []

        def respond(request, timeout, max_bytes):
            sent.append(request)
            if request.url.startswith("https://api.video.dmm.co.jp/"):
                return HttpResponse(200, {"content-type": "application/json"},
                                    b'{"data":{"__typename":"Query"}}', request.url)
            buffer = io.BytesIO()
            Image.new("RGB", (800, 538)).save(buffer, format="JPEG")
            return HttpResponse(206, {"content-type": "image/jpeg"}, buffer.getvalue(), request.url)

        with patch("peach.source_checks.SourceTransport") as factory:
            factory.return_value.side_effect = respond
            checks = {item["target"]: item for item in
                      w_scraping_check(SimpleNamespace(follow_secrets_root=self.root), {"source": "dmm"})["results"]}
        self.assertEqual((checks["page"]["ok"], checks["page"]["reason"]), (True, "ok"))
        self.assertEqual((sent[0].method, sent[0].url), ("POST", "https://api.video.dmm.co.jp/graphql"))
        self.assertTrue(checks["cdn"]["ok"])

    def test_each_source_with_a_fixed_image_host_checks_it_and_the_rest_say_not_checked(self):
        """页面与图片主机分开报（#377）：有固定图片主机的来源各查一张那台主机上的图，只取前 64 KB；
        没有的标「未检查」，全部检查里归到「跳过」，不算失败；DMM 以外的图片主机连不上不附移动宽带那句。"""
        from peach.source_checks import IMAGE_PROBES, MOBILE_BROADBAND_HINT, check_source
        from peach.source_preflight import outcome
        self.assertTrue({"dmm", "r18dev", "javdb", "javbus", "mgstage"} <= set(IMAGE_PROBES))
        sent = []

        def respond(request, timeout, max_bytes):
            sent.append(request)
            if "jdbstatic" in request.url:
                raise httpx.ConnectError("connection reset")
            return HttpResponse(200, {"content-type": "text/html"}, b"<html><title>ok</title></html>", request.url)

        with patch("peach.source_checks.SourceTransport") as factory:
            factory.return_value.side_effect = respond
            javdb = {item["target"]: item for item in check_source(self.root, "javdb")["results"]}
            avbase = {item["target"]: item for item in check_source(self.root, "avbase")["results"]}
        self.assertEqual([request.url for request in sent if "jdbstatic" in request.url], [IMAGE_PROBES["javdb"]])
        self.assertEqual(sent[1].headers.get("Range"), "bytes=0-65535")
        self.assertEqual((javdb["cdn"]["ok"], outcome(javdb["cdn"])), (False, "network"))
        self.assertNotIn(MOBILE_BROADBAND_HINT, javdb["cdn"]["message"])
        self.assertEqual((avbase["page"]["ok"], avbase["cdn"]["kind"], outcome(avbase["cdn"])), (True, "unchecked", "skipped"))
        self.assertFalse(any("avbase" not in request.url and "jdbstatic" not in request.url and "javdb" not in request.url
                             for request in sent), "没有固定图片主机的来源图片那一跳不发请求")

class BrowserFallbackTests(unittest.TestCase):
    """登记了 `browser_fallback` 的来源（minnano-av）：HTTP 客户端被拦时由本机浏览器验证一页，
    取到就固定走浏览器；浏览器也没取到才照 HTTP 客户端被拦那样冷却。"""

    SEARCH = "https://www.minnano-av.com/search_result.php?search_scope=actress&search_word=x"

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.cooldown = self.root / "scraping-minnano-av.cooldown.json"
        self.request = HttpRequest("GET", self.SEARCH, {})
        finder = patch("peach.browser_transport.find_browser", return_value=None)
        finder.start()
        self.addCleanup(finder.stop)

    def browser(self, respond):
        from peach import browser_transport

        class FakeBrowser(browser_transport.BrowserTransport):
            def __init__(self):
                self.calls = []

            def __call__(self, request, timeout, max_bytes):
                self.calls.append(request.url)
                return respond(request)

        return FakeBrowser()

    def refused_transport(self, response=None):
        transport = SourceTransport(self.root)
        http_calls = []

        def http(request, *_args):
            http_calls.append(request.url)
            return response or HttpResponse(403, {}, b"")

        transport.transports["minnano-av"] = http
        return transport, http_calls

    def record(self) -> dict:
        return json.loads(self.cooldown.read_text(encoding="utf-8"))

    def test_a_refused_http_request_is_retried_in_the_browser_and_the_source_stays_there(self):
        from peach.scraping_access import fixed_to_browser
        page = HttpResponse(200, {}, b"<title>actress</title>", "https://www.minnano-av.com/actress1.html")
        browser = self.browser(lambda request: page)
        self.cooldown.write_text(json.dumps({"until": 0, "blocks": 6, "via": "http"}), encoding="utf-8")
        transport, http_calls = self.refused_transport()
        with patch("peach.browser_transport.shared", return_value=browser):
            self.assertIs(transport(self.request, 1, 100), page)
            self.assertIs(transport(self.request, 1, 100), page, "本趟之后的请求直接走浏览器")
        self.assertEqual(len(http_calls), 1)
        self.assertEqual(browser.calls, [self.SEARCH, self.SEARCH])
        self.assertTrue(fixed_to_browser(self.root, "minnano-av"))
        self.assertFalse(self.cooldown.exists(), "HTTP 客户端攒下的六次拒绝不压到浏览器上")

        later = SourceTransport(self.root)
        with patch("peach.browser_transport.shared", return_value=browser), \
                patch("peach.scraping_access.client_for", side_effect=AssertionError("固定后不该再起 HTTP 客户端")):
            self.assertIs(later(self.request, 1, 100), page)
        with patch("peach.browser_transport.find_browser", return_value="C:/chrome.exe"):
            self.assertTrue(describe(self.root, "minnano-av")["browser"])
        save(self.root, "minnano-av", {"network": "direct"})
        self.assertTrue(fixed_to_browser(self.root, "minnano-av"), "改连接方式不丢固定")

    def test_user_pause_between_http_and_browser_waits_before_opening_the_browser(self):
        from peach.processing_control import ProcessingControl

        control = ProcessingControl(self.root / 'control.json')
        paused = threading.Event()
        finished = threading.Event()
        errors = []
        browser = self.browser(lambda request: HttpResponse(200, {}, b'<title>actress</title>'))
        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)

        def http(*args):
            control.request('pause', 'job')
            return HttpResponse(403, {}, b'')

        transport.transports['minnano-av'] = http

        def run():
            try:
                with control.bind('job', publish=lambda **values: paused.set() if values.get('status') == 'paused' else None,
                                  active=lambda: True, db_path=self.root / 'database/ledger.db', mode='high'):
                    transport(self.request, 1, 100)
            except BaseException as error:
                errors.append(error)
            finally:
                finished.set()

        with patch('peach.browser_transport.shared', return_value=browser):
            thread = threading.Thread(target=run)
            thread.start()
            try:
                self.assertTrue(paused.wait(2))
                self.assertEqual(browser.calls, [])
                self.assertFalse(finished.is_set())
            finally:
                control.request('resume', 'job')
                thread.join(2)
        self.assertFalse(thread.is_alive())
        self.assertEqual(errors, [])
        self.assertEqual(browser.calls, [self.SEARCH])

    def test_user_cancel_between_http_and_browser_does_not_open_the_browser(self):
        from peach.jobs import JobCancelled
        from peach.processing_control import ProcessingControl

        control = ProcessingControl(self.root / 'control.json')
        transport = SourceTransport(self.root)
        self.addCleanup(transport.close)

        def http(*args):
            control.request('cancel', 'job')
            return HttpResponse(403, {}, b'')

        transport.transports['minnano-av'] = http
        with patch('peach.browser_transport.shared') as browser, \
                control.bind('job', publish=lambda **values: None, active=lambda: True,
                             db_path=self.root / 'database/ledger.db', mode='high'):
            with self.assertRaises(JobCancelled):
                transport(self.request, 1, 100)
        browser.assert_not_called()

    def test_a_challenge_page_over_http_also_gets_the_browser_check(self):
        challenge = HttpResponse(200, {}, b"<html><head><title>Just a moment...</title></head></html>")
        page = HttpResponse(200, {}, b"<title>actress</title>")
        transport, _calls = self.refused_transport(challenge)
        with patch("peach.browser_transport.shared", return_value=self.browser(lambda request: page)):
            self.assertIs(transport(self.request, 1, 100), page)

    def test_when_the_browser_fails_too_the_http_refusal_cools_down_as_before(self):
        from peach import browser_transport
        from peach.scraping_access import FIRST_BLOCKED_PAUSE, SourcePaused, fixed_to_browser

        def unsolved(request):
            raise browser_transport.ChallengeUnsolved("minnano-av.com 的人机验证没有通过")

        def lost(request):
            raise browser_transport.BrowserUnavailable("浏览器请求未取得")

        for respond in (unsolved, lost, lambda request: HttpResponse(403, {}, b"")):
            with self.subTest(respond=respond):
                self.cooldown.unlink(missing_ok=True)
                transport, _calls = self.refused_transport()
                with patch("peach.browser_transport.shared", return_value=self.browser(respond)), \
                        self.assertRaises(SourcePaused):
                    transport(self.request, 1, 100)
                record = self.record()
                self.assertEqual((round(record["until"] - time.time()), record["blocks"], record["via"]),
                                 (FIRST_BLOCKED_PAUSE, 1, "http"))
                self.assertFalse(fixed_to_browser(self.root, "minnano-av"))

        self.cooldown.unlink()
        transport, _calls = self.refused_transport()
        with patch("peach.browser_transport.shared", return_value=None), self.assertRaises(SourcePaused):
            transport(self.request, 1, 100)
        self.assertEqual(self.record()["via"], "http", "没有浏览器的机器照 HTTP 客户端冷却")

    def test_a_source_fixed_to_the_browser_cools_down_on_the_browser_path(self):
        from peach import browser_transport
        from peach.scraping_access import FIRST_BLOCKED_PAUSE, SourcePaused, fix_to_browser, fixed_to_browser

        def unsolved(request):
            raise browser_transport.ChallengeUnsolved("minnano-av.com 的人机验证没有通过")

        fix_to_browser(self.root, "minnano-av")
        with patch("peach.browser_transport.shared", return_value=self.browser(unsolved)), \
                self.assertRaises(SourcePaused):
            SourceTransport(self.root)(self.request, 1, 100)
        record = self.record()
        self.assertEqual((round(record["until"] - time.time()), record["blocks"], record["via"]),
                         (FIRST_BLOCKED_PAUSE, 1, "browser"))
        self.assertTrue(fixed_to_browser(self.root, "minnano-av"), "浏览器那条路冷却完还走浏览器")

    def test_sources_without_the_fallback_never_open_the_browser_on_a_refusal(self):
        from peach.scraping_access import SourcePaused
        transport = SourceTransport(self.root)
        transport.transports["avwikidb"] = lambda *args: HttpResponse(403, {}, b"")
        with patch("peach.browser_transport.shared", side_effect=AssertionError("avwikidb 不走浏览器")), \
                self.assertRaises(SourcePaused):
            transport(HttpRequest("GET", "https://avwikidb.com/actor/x/", {}), 1, 100)


class SourcePreflightTests(unittest.TestCase):
    def test_batch_deduplicates_and_preserves_target_failures(self):
        from peach.source_preflight import check_sources
        def check(root, source, **options):
            self.assertTrue(options['preflight'])
            return {'results': [{'label': '来源页面', 'ok': source == 'dmm'},
                                {'label': '图片 CDN', 'ok': False, 'reason': 'network'}]}
        with patch('peach.source_preflight.check_source', side_effect=check) as checked:
            result = check_sources(Path('/unused'), ['dmm', 'javdb', 'dmm'])
        self.assertEqual(checked.call_count, 2)
        self.assertEqual([row['source'] for row in result['sources']], ['dmm', 'javdb'])
        self.assertFalse(result['ok'])
        self.assertTrue(all(not row['session_verified'] for row in result['sources']))
        with patch('peach.source_preflight.check_source') as checked:
            for selected in ([], ['unknown'], ['dmm', 'unknown']):
                with self.assertRaises(ValueError):
                    check_sources(Path('/unused'), selected)
            checked.assert_not_called()

    def test_preflight_bounds_requests_and_uses_no_browser(self):
        from peach.source_checks import check_source
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch('peach.source_checks.SourceTransport') as factory:
                factory.return_value.return_value = HttpResponse(200, {}, b'<html></html>')
                result = check_source(root, 'javdb', preflight=True)
            self.assertTrue(result['results'][0]['ok'])
            factory.assert_called_once_with(root, max_requests=12, max_bytes=12 * 65536,
                                            max_seconds=15, allow_browser=False)
            factory.return_value.close.assert_called_once()

    def test_each_source_reaches_caller_thread_with_report_outcome(self):
        from peach.source_preflight import check_sources
        reasons = {'dmm': 'cloudflare_challenge', 'javdb': 'cooldown', 'javbus': 'server_error'}
        def check(root, source, **options):
            return {'results': [{'label': '来源页面', 'ok': False, 'reason': reasons[source]}]}
        seen = []
        with patch('peach.source_preflight.check_source', side_effect=check):
            result = check_sources(Path('/unused'), list(reasons), on_result=lambda row: seen.append(
                (row['source'], threading.current_thread())))
        self.assertEqual({source for source, _ in seen}, set(reasons))
        self.assertTrue(all(thread is threading.current_thread() for _, thread in seen))
        self.assertEqual([row['results'][0]['outcome_label'] for row in result['sources']],
                         ['登录或人机验证', '冷却', 'HTTP 错误'])

    def test_cooling_source_reports_cooldown_without_request(self):
        from peach.scraping_access import _pause, cooldown_path
        from peach.source_preflight import check_sources
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _pause(cooldown_path(root, 'javdb'), time.time() + 600)
            with patch.object(SourceTransport, '_transport_for', side_effect=AssertionError('冷却中不应发请求')):
                row = check_sources(root, ['javdb'])['sources'][0]['results'][0]
        self.assertEqual((row['outcome'], row['outcome_label']), ('cooldown', '冷却'))

    def test_check_all_job_counts_progress_and_keeps_result(self):
        from peach.jobs import BackgroundJob
        from peach.source_preflight import default_sources
        from peach.web_scraping import w_scraping_check_all
        job =BackgroundJob('test-source-check', task_key='source-check')
        contract = SimpleNamespace(follow_secrets_root=Path('/unused'), source_check_job=job)
        def check(root, source, **options):
            return {'results': [{'label': '来源页面', 'ok': source == 'dmm',
                                 'reason': 'ok' if source == 'dmm' else 'timeout'}]}
        with patch('peach.source_preflight.check_source', side_effect=check):
            started = w_scraping_check_all(contract, {})
            job.thread.join(10)
        state = job.snapshot()
        self.assertEqual((started['status'], started['checked']), ('running', 0))
        self.assertEqual(state['status'], 'complete')
        self.assertEqual(state['checked'], state['total'])
        self.assertEqual([row['source'] for row in state['results']], default_sources())
        self.assertEqual(state['failed'], state['total'] - 1)

    def test_http_only_transport_does_not_launch_or_fix_browser_route(self):
        from peach.scraping_access import SourcePaused, fix_to_browser, fixed_to_browser
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fix_to_browser(root, 'minnano-av')
            transport = SourceTransport(root, allow_browser=False)
            with patch.object(transport, '_browser_for', side_effect=AssertionError('不能启动浏览器')), \
                    patch('peach.scraping_access.client_for') as client:
                client.return_value = httpx.Client(transport=httpx.MockTransport(
                    lambda request: httpx.Response(403, content=b'blocked')))
                with self.assertRaises(SourcePaused):
                    transport(HttpRequest('GET', 'https://www.minnano-av.com/', {}), 1, 1024)
            transport.close()
            self.assertTrue(fixed_to_browser(root, 'minnano-av'))
