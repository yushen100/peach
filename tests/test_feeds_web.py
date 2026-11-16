"""番号发现源的契约层：拉取一轮、建壳、列表、已读与忽略（ADR-0042）。"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import tempfile
import threading
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from peach import feed_followup, feeds, web_entity, web_feeds, web_settings, web_state  # noqa: E402
from peach import web_jav_browser_performer as performer  # noqa: E402
from peach.http import HttpResponse  # noqa: E402
from peach.web_contract import WebContract  # noqa: E402
from peach.task_outcomes import part  # noqa: E402
from peach.web_router import dispatch_api_get, dispatch_api_post  # noqa: E402
from support.ledger import fresh_ledger  # noqa: E402

#: 端到端那一趟读的是临时 Peach 数据目录里的这份文件：拉取只吃已下载的字节，
#: 字节从网络来还是从盘上来与解析、去重、建壳那几步无关。
SAMPLE = """
<a href="/v/Ab2" class="box" title="x"><div class="video-title"><strong>SSIS-950</strong>
 作品标题</div><div class="meta">
 2026-09-21</div></a>
<a href="/v/Ab1" class="box" title="x"><div class="video-title"><strong>HMN-071</strong>
 另一部作品</div><div class="meta">
 2026-09-20</div></a>
<a href="/v/Ab0" class="box" title="x"><div class="video-title"><strong></strong>
 合集 30 部打包</div><div class="meta">
 2026-09-19</div></a>
"""


class FakeTransport:
    """按地址回一份事先备好的响应，可调用的按请求现答（GraphQL 同一个地址答不同的查询）。
    记下每次请求，好核对条件请求头。"""

    def __init__(self, responses):
        self.responses = responses
        self.requests = []

    def __call__(self, request, timeout, max_bytes):
        self.requests.append(request)
        response = self.responses[request.url]
        return response(request) if callable(response) else response


DMM_ENDPOINT = "https://api.video.dmm.co.jp/graphql"


def dmm_catalogue(rows, codes):
    """DMM GraphQL 的假答复：片单一页 `rows`（cid, 发售日, 预购, 出演人数），官方番号按 `codes`。"""
    def answer(request):
        payload = json.loads(request.body)
        if "legacySearchPPV" in payload["query"]:
            contents = [{"id": cid, "title": "作品", "deliveryStartAt": f"{date}T00:00:00+09:00",
                         "releaseStatus": "PRE_ORDER" if pre_order else None,
                         "actresses": [{"id": "1051912", "name": "涼森れむ"},
                                       *({"id": str(index), "name": f"女優{index}"}
                                         for index in range(cast - 1))],
                         "maker": {"id": "1", "name": "エスワン"}}
                        for cid, date, pre_order, cast in rows]
            data = {"legacySearchPPV": {"result": {
                "pageInfo": {"totalCount": len(rows), "hasNext": False}, "contents": contents}}}
        else:
            cids = re.findall(r'ppvContent\(id: "([^"]+)"\)', payload["query"])
            data = {f"a{index}": {"id": cid, "makerContentId": codes[cid]} for index, cid in enumerate(cids)}
        return HttpResponse(200, {}, json.dumps({"data": data}, ensure_ascii=False).encode(), request.url)
    return answer


def remove_when_released(temporary: tempfile.TemporaryDirectory, timeout: float = 15.0) -> None:
    """删临时目录；Windows 上文件还被占用（WinError 32）时等它放手再删。

    `stop_background_jobs` 只等每个线程 2 秒（关停不该被外部请求拖住），满载时取资料、拉取
    线程可能还拿着 `update-tasks/admission.lock`。等到时限仍被占用就照常报错，真泄漏的线程不会被掩盖。
    """
    deadline = time.monotonic() + timeout
    while True:
        try:
            temporary.cleanup()
            return
        except PermissionError as error:
            if getattr(error, "winerror", None) != 32 or time.monotonic() >= deadline:
                raise
            time.sleep(0.2)


class FeedWebFixture(unittest.TestCase):
    """临时账本、本地 feed 字节和替掉的取资料一步。不带用例，两个套件共用。"""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(remove_when_released, self.temporary)
        self.db_path = fresh_ledger(self.temporary.name)
        self.contract = WebContract(self.db_path)
        self.addCleanup(self.contract.stop_background_jobs)
        # 后继在服务里由后台线程领走，在测试里那是一个和断言赛跑的线程：它可能在
        # assert 之后才写完，也可能在临时目录删掉之后才醒。这里关掉自动领取，
        # 要跑后继的用例自己 `drain()`。
        self.contract.followups.stop()
        # 来源冷却记录读写这里：每轮拉取前都要看 JavDB 是否在冷却，不能读到本机真实的那份。
        self.contract.follow_secrets_root = Path(self.temporary.name) / "secrets"
        self.url = "https://javdb.com/actors/Smp1"
        sample = Path(self.temporary.name) / "feed-sample.html"
        sample.write_text(SAMPLE, encoding="utf-8")
        self.transport = FakeTransport({self.url: HttpResponse(
            200, {"ETag": 'W/"abc"', "Content-Type": "text/html"},
            sample.read_bytes(), self.url)})
        self._patched = web_feeds.fetch
        web_feeds.fetch = self._fetch
        self.addCleanup(lambda: setattr(web_feeds, "fetch", self._patched))
        # 建壳会派取资料后继，后继由契约自己的 runner 领走。不替掉问来源那一步的话，
        # 这个套件每跑一次就朝真实来源发一轮请求——番号是假的，配额是真的。
        self._collect = feed_followup.collect
        feed_followup.collect = lambda provider, code: (
            {"title": f"{code} 的标题", "studio": "示例厂牌",
             "release_date": "2026-09-20",
             "performers": [{"name": "深田えいみ"}]},
            "https://images.example.test/cover.jpg")
        self.addCleanup(lambda: setattr(feed_followup, "collect", self._collect))
        # 封面装进临时封面目录；取图那一步同样替掉，换成一张现画的横版封套。
        self.contract.cover_root = Path(self.temporary.name) / "covers"
        # 每一轮拉取还会给缺头像的存量女优派补头像，判缺不缺、试没试过都读这两处。
        self.contract.candidate_root = Path(self.temporary.name) / "generated"
        self.contract.avatar_root = self.contract.candidate_root / "avatars"
        self.cover_misses: set[str] = set()
        self.cover_unreachable: set[str] = set()
        self.cover_broken: set[str] = set()
        self.cover_urls: dict[str, str | None] = {}
        self._fetch_cover = feed_followup.fetch_cover
        feed_followup.fetch_cover = self._fake_cover
        self.addCleanup(lambda: setattr(feed_followup, "fetch_cover", self._fetch_cover))
        self.addCleanup(self._finish_feed_job)

    def _finish_feed_job(self):
        thread = self.contract.feed_job.thread
        self.contract.feed_job.stop(timeout=15)
        if thread is not None:
            self.assertFalse(thread.is_alive(), '检查线程未结束，不能还原替身或删除临时账本')

    def _fake_cover(self, contract, code, cover_url=None):
        self.cover_urls[code] = cover_url
        if code in self.cover_misses:
            from peach.jav_cover_fetch import NO_CANDIDATES_CODE, NotFound
            raise NotFound(NO_CANDIDATES_CODE)
        if code in self.cover_broken:
            raise RuntimeError("cover pipeline crashed")
        if code in self.cover_unreachable:
            from peach.jav_cover_fetch import HOSTS_UNREACHABLE_CODE, CoverConnectError
            raise CoverConnectError(HOSTS_UNREACHABLE_CODE)
        from PIL import Image
        image = Image.new("RGB", (800, 538), (40, 40, 40))
        image.paste((200, 120, 150), (420, 0, 800, 538))
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG")
        return buffer.getvalue(), (800, 538), {"code": code, "source": "test"}

    def _fetch(self, transport, url, *, etag=None, last_modified=None):
        # 真实路径上的 SSRF 闸门要做 DNS，这里替换掉的正是那一层；条件请求头仍原样传下去。
        headers = {}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified
        from peach.http import HttpRequest
        return transport(HttpRequest("GET", url, headers), 30.0, 1 << 21)

    def _stock_window_passes(self):
        """定时拉取派存量后继的窗口（`web_feeds.STOCK_INTERVAL`）已经过去。"""
        self.contract.feed_stock_planned_at = None

    def _add(self, entity_id=None):
        with self.contract.database.write_transaction() as connection:
            return feeds.add_source(connection, url=self.url, name="示例源",
                                    entity_id=entity_id)

    def _check(self, **body):
        original = web_feeds._transport
        web_feeds._transport = lambda contract: self.transport
        try:
            result = dispatch_api_post(self.contract, "/api/feeds/check", {"all": True, **body})
            if not body.get('background'):
                thread = self.contract.feed_job.thread
                if thread is not None:
                    thread.join(15)
                    self.assertFalse(thread.is_alive(), '本轮结算未退出，不能启动下一轮或还原传输替身')
            return result
        finally:
            web_feeds._transport = original


class FeedWebTest(FeedWebFixture):
    def test_synchronous_checks_wait_for_settlement_before_returning(self):
        self._add()
        settling, release, returned = threading.Event(), threading.Event(), threading.Event()
        errors = []
        original = self.contract.feed_job._finish_execution
        def finish(job_id):
            settling.set()
            if not release.wait(5):
                raise TimeoutError('未释放测试结算')
            original(job_id)
        def check():
            try:
                self._check()
            except Exception as error:
                errors.append(error)
            finally:
                returned.set()
        with patch.object(self.contract.feed_job, '_finish_execution', side_effect=finish):
            caller = threading.Thread(target=check)
            caller.start()
            try:
                self.assertTrue(settling.wait(5))
                self.assertFalse(returned.wait(0.05), '同步夹具在后台结算完成前返回')
            finally:
                release.set()
                caller.join(5)
        self.assertTrue(returned.is_set())
        self.assertEqual(errors, [])
        self.assertFalse(self.contract.feed_job.thread.is_alive())

    def test_a_round_that_stays_paused_does_not_hold_the_caller(self):
        """这一轮在任务中心被暂停、一直不恢复：同步发起的一方（定时那一跳也是）到期就回来。"""
        self._add()
        entered, release = threading.Event(), threading.Event()
        def paused(contract, body, job_id):
            entered.set()
            release.wait(10)
            return {"ok": True, "checked": 0, "total": 0, "results": [], "added": 0, "stock": False}
        with patch.object(web_feeds, "_execute_check", side_effect=paused), \
                patch.object(web_feeds, "CHECK_WAIT_SECONDS", 0.3):
            try:
                begun = time.monotonic()
                result = dispatch_api_post(self.contract, "/api/feeds/check", {"all": True})
                self.assertLess(time.monotonic() - begun, 5, "同步发起的一方一直等到这一轮跑完")
                self.assertTrue(entered.is_set())
                self.assertEqual(result["status"], "running")
            finally:
                release.set()
                self.contract.feed_job.thread.join(5)
        self.assertEqual(dispatch_api_get(self.contract, "/api/feeds/check", {})["status"], "complete")

    def test_schedule_route_reports_feed_scheduler_failures(self):
        from peach.follow_scheduler import FEED_JOB_ID, FollowScheduleConfig, FollowUpdateScheduler
        idle = dispatch_api_get(self.contract, "/api/feeds/schedule", {})
        self.assertEqual((idle["available"], idle["interval_minutes"]),
                         (False, feeds.DEFAULT_INTERVAL_MINUTES))

        def failing():
            return {"ok": True, "checked": 2, "results": [{"ok": False}, {"ok": True, "added": 1}]}
        self.contract.feed_scheduler = FollowUpdateScheduler(
            Path(self.temporary.name) / "schedule", failing, available=True, job_id=FEED_JOB_ID,
            filename="feed-schedule.json",
            default=FollowScheduleConfig(enabled=True, interval_minutes=feeds.DEFAULT_INTERVAL_MINUTES))
        self.contract.feed_scheduler._run()
        self.contract.feed_scheduler._run()
        status = dispatch_api_get(self.contract, "/api/feeds/schedule", {})
        self.assertEqual((status["available"], status["enabled"], status["interval_minutes"]),
                         (True, True, feeds.DEFAULT_INTERVAL_MINUTES))
        self.assertEqual((status["last_error"], status["consecutive_failures"]), ("1 个来源检查失败", 2))

    def test_schedule_route_saves_switch_and_interval(self):
        from peach.follow_scheduler import FEED_JOB_ID, FollowScheduleConfig, FollowUpdateScheduler
        root = Path(self.temporary.name) / "schedule"
        self.contract.feed_scheduler = FollowUpdateScheduler(
            root, lambda: {"ok": True}, available=True, job_id=FEED_JOB_ID, filename="feed-schedule.json",
            default=FollowScheduleConfig(enabled=True, interval_minutes=feeds.DEFAULT_INTERVAL_MINUTES))
        saved = dispatch_api_post(self.contract, "/api/feeds/schedule", {"enabled": True, "interval_minutes": 720})
        self.assertEqual((saved["enabled"], saved["interval_minutes"]), (True, 720))
        off = dispatch_api_post(self.contract, "/api/feeds/schedule", {"enabled": False, "interval_minutes": 720})
        self.assertFalse(off["enabled"])
        self.assertEqual(json.loads((root / "feed-schedule.json").read_text(encoding="utf-8")),
                         {"enabled": False, "interval_minutes": 720})
        with self.assertRaises(ValueError):
            dispatch_api_post(self.contract, "/api/feeds/schedule", {"enabled": True, "interval_minutes": 5})

    def test_recovery_keeps_source_selection_progress_and_discovered_codes(self):
        from peach import job_recovery
        first = self._add()
        self.url = 'https://javdb.com/actors/Smp2'
        second = self._add()
        run = self.contract.task_runs.start('feed-check', trigger='manual', total=2)
        self.contract.task_runs.suspend(run.id)
        job_recovery.save(self.db_path, 'feed-check', 'original', {'background': True}, run_id=run.id, waiting=True)
        job_recovery.checkpoint(self.db_path, 'feed-check', 'original', dict(source_ids=[first, second],
            checked=1, total=2, added=1, results=[{'source': first, 'ok': True, 'codes': ['AAA-001']}]))
        seen = []
        def poll(contract, transport, source):
            seen.append((source['id'], contract.feed_job.snapshot()['checked']))
            return {'source': source['id'], 'ok': True, 'codes': ['BBB-002']}
        with patch.object(web_feeds, 'poll_source', side_effect=poll), \
                patch.object(web_feeds, '_transport', return_value=self.transport):
            job_recovery.resume(self.db_path, {'feed-check': lambda body: web_feeds.w_feed_check(self.contract, body)})
            self.contract.feed_job.thread.join(5)
        final = self.contract.feed_job.snapshot()
        self.assertEqual(seen, [(second, 1)])
        self.assertEqual((final['job_id'], final['run_id'], final['checked'], final['added']), ('original', run.id, 2, 2))
        self.assertEqual({row['source'] for row in final['results']}, {first, second})

    def test_javdb_provenance_is_unavailable_to_cover_readers(self):
        from PIL import Image
        target = self.contract.cover_root / 'SSIS-950.jpg'
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.new('RGB', (800, 538)).save(target)
        from peach.fsutil import atomic_write_text
        # 来源边车与 `install_cover` 一样换名写入：封面索引只认封面目录的修改时间。
        evidence = target.with_suffix('.scraping.json')
        atomic_write_text(evidence, json.dumps({'source_url': 'https://c0.jdbstatic.com/covers/a.jpg'}))
        self.assertFalse(self.contract.has_cover('SSIS-950'))
        self.assertIsNone(self.contract.cover_path('SSIS-950'))
        atomic_write_text(evidence, json.dumps({'source_url': 'https://pics.dmm.co.jp/a.jpg'}))
        # 两次换名可能落在同一个时钟刻度，目录时间不变；刚写过的目录索引过了静置时效才重扫。
        later = web_state.time.monotonic() + web_state.SETTLE_TTL + 1
        with patch.object(web_state.time, 'monotonic', return_value=later):
            self.assertTrue(self.contract.has_cover('SSIS-950'))
        self.assertEqual(self.contract.cover_path('SSIS-950'), target)

    def test_known_discovery_without_cover_address_has_no_javdb_image_fallback(self):
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute('UPDATE feed_discovery SET cover_url=NULL')
        rows = dispatch_api_get(self.contract, '/api/feeds/discoveries', {})['items']
        self.assertTrue(rows)
        self.assertTrue(all('jdbstatic.com' not in row['cover_url'] and not row['cover_url'].startswith('/jav-cover') for row in rows))
        with self.contract.database.read_connection() as connection:
            self.assertTrue(all(row[0] is None for row in connection.execute('SELECT cover_url FROM feed_discovery')))

    def test_newwork_cast_reads_cached_source_faces_and_local_aliases_without_fetching(self):
        from peach.jav_discovery_metadata import discovery_metadata
        self._add()
        self._check()
        self._drain(1)
        with self.contract.database.write_transaction() as connection:
            connection.execute("INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                               " VALUES('performer','规范乙','规范乙',?,?)", (feeds.stamp(), feeds.stamp()))
            eid = connection.execute("SELECT id FROM entity WHERE canonical_name='规范乙'").fetchone()[0]
            connection.execute("INSERT INTO entity_alias(entity_id,alias,normalized_alias,source)"
                               " VALUES(?,'来源乙','来源乙','test')", (eid,))
        metadata = discovery_metadata(self.contract)
        with self.contract.database.read_connection() as connection:
            codes = [row[0] for row in connection.execute('SELECT code FROM feed_discovery')]
        for code in codes:
            metadata.remember(code, {'number': code, 'actors': [
                {'id': 'A', 'name': '深田えいみ', 'gender': 0, 'avatar_url': 'https://tp.spfcas.com/A.jpg'},
                {'id': 'B', 'name': '来源乙', 'gender': 0, 'avatar_url': 'https://tp.spfcas.com/B.jpg'},
                {'id': 'C', 'name': '来源男优', 'gender': 1}]})
        with patch('peach.javdb_public.PUBLIC_API.movie') as fetch:
            items = dispatch_api_get(self.contract, '/api/feeds/discoveries', {})['items']
        fetch.assert_not_called()
        self.assertTrue(items)
        for item in items:
            self.assertEqual(item['performers'], '深田えいみ、规范乙')
            self.assertEqual([ref['source_actor_id'] for ref in item['performer_refs']], ['A', 'B'])
            self.assertTrue(all(ref['source_avatar'] for ref in item['performer_refs']))
            self.assertEqual(item['performer_refs'][1]['id'], eid)
        with self.contract.database.read_connection() as connection:
            self.assertEqual({row[0] for row in connection.execute('SELECT performers FROM feed_discovery')}, {'深田えいみ'})

    def test_home_shape_tracks_visible_discoveries_without_an_entity(self):
        def has_feed():
            return dispatch_api_get(self.contract, "/api/entity/shapes", {})["home"]["feed"]

        self.assertFalse(has_feed())
        self._add()
        self._check()
        self.assertTrue(has_feed())
        items = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]
        dispatch_api_post(self.contract, "/api/feeds/discovery",
                          {"action": "read", "ids": [item["id"] for item in items]})
        self.assertTrue(has_feed())
        dispatch_api_post(self.contract, "/api/feeds/discovery",
                          {"action": "ignore", "ids": [item["id"] for item in items]})
        self.assertFalse(has_feed())

    def test_new_discoveries_only_recompute_the_feed_part_of_the_shapes(self):
        """采集每几秒写一次订阅表：形状名单只重算新作那一份，同台、资料表与版式那部分照旧命中缓存。"""
        self.assertFalse(dispatch_api_get(self.contract, "/api/entity/shapes", {})["home"]["feed"])
        with patch.object(web_entity, "_entity_shape_parts", side_effect=AssertionError("其余部分被重算了")):
            self._add()
            self._check()
            self.assertTrue(dispatch_api_get(self.contract, "/api/entity/shapes", {})["home"]["feed"])

    def test_home_shape_applies_library_and_compilation_filters(self):
        self._compilation("波多野結衣、篠田ゆう")
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO asset(location,path,name,medium,code) "
                "VALUES('R','R:\\media\\hmn071.mp4','hmn071.mp4','video','HMN-071')")
        shape = lambda: dispatch_api_get(self.contract, "/api/entity/shapes", {})["home"]["feed"]
        self.assertFalse(shape())
        dispatch_api_post(self.contract, "/api/settings", {"feedHideGroupCompilations": False})
        self.assertTrue(shape())

    def test_entity_shapes_use_the_real_jav_work_predicate(self):
        people = []
        with self.contract.database.write_transaction() as connection:
            for index, region in enumerate(("jp", "kr")):
                name = f"演示艺人{index}"
                entity_id = connection.execute(
                    "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                    " VALUES('performer',?,peach_normalize(?),?,?)",
                    (name, name, feeds.stamp(), feeds.stamp())).lastrowid
                asset_id = connection.execute(
                    "INSERT INTO asset(location,path,name,medium,code,region,studio)"
                    " VALUES('local',?,?,'video','SSIS-950',?,'S1')",
                    (f"R:\\media\\shape{index}.mp4", f"shape{index}.mp4", region)).lastrowid
                connection.execute(
                    "INSERT INTO asset_entity(asset_id,entity_id,role,source)"
                    " VALUES(?,?,'performer','test')", (asset_id, entity_id))
                people.append((entity_id, name, region == "jp"))
        shapes = {item["id"]: item["parts"] for item in dispatch_api_get(
            self.contract, "/api/entity/shapes", {})["entities"]}
        for entity_id, name, jav in people:
            items = dispatch_api_get(self.contract, "/api/items", {"performer": name})["items"]
            self.assertEqual(items[0]["is_jav"], jav)
            self.assertEqual("jav" in shapes.get(entity_id, []), jav)

    def test_settings_snapshot_lists_the_source(self):
        self._add()
        snapshot = dispatch_api_get(self.contract, "/api/feeds", {})
        self.assertEqual(len(snapshot["sources"]), 1)
        self.assertEqual(snapshot["sources"][0]["name"], "示例源")
        self.assertEqual(snapshot["sources"][0]["kind_label"], "JAV 订阅")
        self.assertTrue(snapshot["sources"][0]["enabled"])
        # 没挂人物就没有资料图可画。
        self.assertFalse(snapshot["sources"][0]["has_image"])

    def test_a_source_tied_to_a_performer_is_named_by_her_canonical_name(self):
        """挂着人物的源，名字是她在账本里的统称，登记时抄下的站上名字不再顶在前面。"""
        with self.contract.database.write_transaction() as connection:
            entity_id = int(connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer',?,peach_normalize(?),?,?)",
                ("凉森玲梦", "凉森玲梦", feeds.stamp(), feeds.stamp())).lastrowid)
        self._add(entity_id)
        [source] = dispatch_api_get(self.contract, "/api/feeds", {})["sources"]
        self.assertEqual((source["name"], source["entity_id"], source["entity_name"]),
                         ("凉森玲梦", entity_id, "凉森玲梦"))
        self.assertFalse(source["has_image"])

    def test_the_source_endpoint_takes_no_address_from_the_page(self):
        # 订阅只从人物页进，地址由服务端现拼（ADR-0047）；页面送来的地址一律不收。
        with self.assertRaises(ValueError):
            dispatch_api_post(self.contract, "/api/feeds/source",
                              {"action": "add", "url": "https://example.test/rss"})
        self.assertEqual(dispatch_api_get(self.contract, "/api/feeds", {})["sources"], [])

    def test_one_round_turns_a_local_feed_into_unfiled_new_releases(self):
        self._add()
        result = self._check()
        self.assertEqual(result["checked"], 1)
        self.assertEqual(result["results"][0]["error"], None)
        self.assertEqual(result["added"], 2)
        # 后继由结果声明，调度端统一派（ADR-0040）；同一轮发现的合成一条。
        self.assertEqual([(item["task_key"], item["key"]) for item in result["followups"]],
                         [("feed-scrape", "feed-scrape:SSIS-950,HMN-071")])
        listing = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})
        self.assertEqual([item["code"] for item in listing["items"]],
                         ["SSIS-950", "HMN-071"])
        self.assertFalse(listing["items"][0]["read"])

    def test_the_second_round_uses_the_stored_validators_and_adds_nothing(self):
        self._add()
        self._check()
        self.transport.responses[self.url] = HttpResponse(304, {}, b"", self.url)
        result = self._check()
        self.assertTrue(result["results"][0]["not_modified"])
        self.assertEqual(self.transport.requests[-1].headers["If-None-Match"], 'W/"abc"')
        listing = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})
        self.assertEqual(len(listing["items"]), 2)

    def test_missing_covers_follow_their_active_scrape_job(self):
        self._add()
        self._check()
        deadline = time.monotonic() + 5
        while not self.contract.task_runs.query(status="active", task_key=feed_followup.TASK_KEY):
            self.assertLess(time.monotonic(), deadline, "取资料后继未入队")
            time.sleep(0.01)
        # 还排在通道里的那一批是「排队中」，说得出排在哪条队后面；领走开跑才算抓取中。
        states = lambda: [(item["cover_state"], item["cover_reason"]) for item in
                          dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]]
        self.assertEqual(states(), [("queued", "排在新作资料采集后面，资料取完就取封面")] * 2)
        [run] = self.contract.task_runs.query(status="active", task_key=feed_followup.TASK_KEY)
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE task_run SET status='running' WHERE id=?", (run.id,))
        self.assertEqual({state for state, _ in states()}, {"fetching"})
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE task_run SET status='pending' WHERE id=?", (run.id,))
        self._drain(1)
        items = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]
        self.assertTrue(all(item["has_cover"] and item["cover_state"] is None for item in items))

    def test_the_cover_cell_says_why_a_release_has_no_cover(self):
        """取过没取到的写上次的原因；韩国 MIB 后台不替它取图，也不该说在排队；新作页与首页同一口径。"""
        self.cover_misses.add("HMN-071")
        self._add()
        self._check()
        self._drain(1)
        with self.contract.database.write_transaction() as connection:
            connection.execute("INSERT INTO feed_discovery(code,source_id,title,link,release_date,discovered_at)"
                               " VALUES('NOAH-101',1,'',NULL,'2026-09-22',?)", (feeds.stamp(),))
            connection.execute("INSERT INTO feed_discovery(code,source_id,title,link,release_date,discovered_at)"
                               " VALUES('ABP-123',1,'',NULL,'2026-09-22',?)", (feeds.stamp(),))
        expected = {"HMN-071": ("missing", "上次没取到：所有渠道都没有候选"),
                    "NOAH-101": ("missing", "韩国 MIB 不适用 JAV 封面来源"),
                    "ABP-123": ("queued", "等下一轮订阅检查分批取图")}
        with patch("peach.jav_discovery_metadata.DiscoveryMetadata.ensure", return_value=None):
            for path in ("/api/feeds/discoveries", "/api/jav/releases"):
                items = {item["code"]: (item["cover_state"], item["cover_reason"])
                         for item in dispatch_api_get(self.contract, path, {})["items"]}
                self.assertEqual({code: items[code] for code in expected}, expected, path)

    def test_unreleased_works_wait_off_the_list_while_the_official_cover_is_a_placeholder(self):
        """未发售、官方只回「准备中」占位图的先不列，后台照旧重取；已发售的旧作与没取过图的照常列出。"""
        from peach.jav_cover_fetch import NotFound, OFFICIAL_PLACEHOLDER_ONLY_CODE
        future = (datetime.now() + timedelta(days=30)).date().isoformat()
        rows = {"VRKM-971": future, "HIGM-183": "2024-03-09", "VRKM-972": future}
        with self.contract.database.write_transaction() as connection:
            for code, released in rows.items():
                connection.execute("INSERT INTO feed_discovery(code,source_id,title,link,release_date,discovered_at)"
                                   " VALUES(?,NULL,'',NULL,?,?)", (code, released, feeds.stamp()))
        for code in ("VRKM-971", "HIGM-183"):
            feed_followup.record_cover_attempt(self.contract, code, ok=False, error=NotFound(OFFICIAL_PLACEHOLDER_ONLY_CODE))
        with patch("peach.jav_discovery_metadata.DiscoveryMetadata.ensure", return_value=None):
            for path in ("/api/feeds/discoveries", "/api/jav/releases"):
                codes = {item["code"] for item in dispatch_api_get(self.contract, path, {})["items"]}
                self.assertEqual(codes & set(rows), {"HIGM-183", "VRKM-972"}, path)
        self.assertIn("VRKM-971", self._cover_backlog())

    def test_a_failing_source_reports_on_its_own_row_and_stays_scheduled(self):
        self._add()
        self.transport.responses[self.url] = HttpResponse(503, {}, b"", self.url)
        result = self._check()
        self.assertFalse(result["results"][0]["ok"])
        row = dispatch_api_get(self.contract, "/api/feeds", {})["sources"][0]
        self.assertEqual(row["last_error"], "来源回了 HTTP 503")
        self.assertIsNotNone(row["next_fetch_at"])
        # 原因连同 code 落在源那一行上，英文界面照 code 显示（迁移 0056）。
        from peach import interface_text
        self.assertEqual(interface_text.text(f"server:{row['last_error_code']}", row["last_error_params"], "en"),
                         "The source returned HTTP 503.")

    def _sources_named(self, *names):
        """再加几个演员页源，各回一份同样的样本页。返回全部源 id，第一个是 `_add` 那个。"""
        ids = [self._add()]
        for name in names:
            url = f"https://javdb.com/actors/{name}"
            self.transport.responses[url] = self.transport.responses[self.url]
            with self.contract.database.write_transaction() as connection:
                ids.append(feeds.add_source(connection, url=url, name=name))
        return ids

    def _rows(self):
        with self.contract.database.read_connection() as connection:
            return {int(row["id"]): dict(row) for row in connection.execute("SELECT * FROM feed_source")}

    def test_a_refused_round_records_one_failure_and_defers_the_rest_to_the_cooldown_end(self):
        """一轮里撞上 403：只记撞上的那一条，其余源不再问、顺延到冷却结束（ADR-0134）。"""
        from peach import scraping_access
        first, *rest = self._sources_named("Smp2", "Smp3")
        served = self.transport

        def refused(request, timeout, max_bytes):
            served.requests.append(request)
            scraping_access.pause_source(self.contract.follow_secrets_root, "javdb", refused=True)
            raise scraping_access.SourcePaused("errors.scrapingAccess.refused")

        self.transport = refused
        result = self._check()
        self.assertEqual(len(served.requests), 1)
        self.assertEqual(result["deferred"], 2)
        [row] = result["results"]
        self.assertFalse(row["ok"])
        self.assertIn("其余 2 个源顺延到冷却结束后再拉", row["error"])
        until = scraping_access.paused_until(self.contract.follow_secrets_root, "javdb")
        expected = feeds.stamp(datetime.fromtimestamp(until, timezone.utc))
        rows = self._rows()
        self.assertEqual({rows[source]["next_fetch_at"] for source in (first, *rest)}, {expected})
        self.assertTrue(all(rows[source]["last_fetched_at"] is None for source in rest))

    def test_a_region_page_reads_as_the_exit_problem_not_an_empty_page(self):
        """JavDB 对日本出口回 200 的版权说明页：整轮只记一条地区限制的原因，其余源顺延，不再各报
        一条「这一页解不出任何条目」（2026-11-08，14 个演员页源一起这么报过）。"""
        from peach.scraping_access import SourceTransport
        first, *_ = self._sources_named("Smp2", "Smp3")
        served = FakeTransport({})
        transport = SourceTransport(self.contract.follow_secrets_root)

        def blocked(request, timeout, max_bytes):
            served.requests.append(request)
            return HttpResponse(200, {}, "由於版權限制，本站禁止了你的網路所在國家的訪問。".encode("utf-8"),
                                request.url)

        transport.transports["javdb"] = blocked
        self.transport = transport
        result = self._check()
        self.assertEqual(len(served.requests), 1)
        self.assertEqual(result["deferred"], 2)
        [row] = result["results"]
        self.assertIn("JavDB 不对当前出口所在的地区开放", row["error"])
        self.assertIn("其余 2 个源顺延到冷却结束后再拉", row["error"])
        self.assertNotIn("解不出", self._rows()[first]["last_error"])

    def test_a_round_that_starts_in_cooldown_asks_nothing(self):
        """别的任务撞出来的冷却还没过：这一轮一个请求都不发，整轮只说一句。"""
        from peach import scraping_access
        self._sources_named("Smp2")
        scraping_access.pause_source(self.contract.follow_secrets_root, "javdb", refused=True)
        result = self._check()
        self.assertEqual(self.transport.requests, [])
        [row] = result["results"]
        self.assertEqual(row["error"], "JavDB 正在冷却，这一轮没有拉；其余 1 个源顺延到冷却结束后再拉")
        self.assertTrue(all(row["last_fetched_at"] is None and row["last_error"] is None
                            for row in self._rows().values()))

    def test_a_javdb_cooldown_does_not_defer_the_dmm_catalogue(self):
        """冷却按来源记：JavDB 在冷却，DMM 片单照拉（ADR-0135）。"""
        from peach import scraping_access
        javdb = self._add()
        with self.contract.database.write_transaction() as connection:
            dmm = feeds.add_source(connection, url=feeds.dmm_actress_url("1051912"))
        self.transport.responses[DMM_ENDPOINT] = dmm_catalogue(
            [("mikr00133", "2026-11-13", True, 1)], {"mikr00133": "MIKR-133"})
        scraping_access.pause_source(self.contract.follow_secrets_root, "javdb", refused=True)
        result = self._check()
        reports = {row["source"]: row for row in result["results"]}
        self.assertEqual(result["deferred"], 1)
        self.assertEqual(reports[javdb]["error"], "JavDB 正在冷却，这一轮没有拉")
        self.assertEqual((reports[dmm]["ok"], reports[dmm]["codes"]), (True, ["MIKR-133"]))
        self.assertTrue(all(request.url == DMM_ENDPOINT for request in self.transport.requests))

    def test_a_scheduled_tick_without_due_sources_starts_nothing(self):
        """定时每半小时一跳；没有到期的源时不起任务，任务中心里不留空跑的一行。"""
        self._add()
        self._check()
        runs = len(self.contract.task_runs.query(task_key="feed-check", limit=50))
        result = web_feeds.w_feed_check(self.contract, {"automatic": True})
        self.assertTrue(result["idle"])
        self.assertEqual(len(self.contract.task_runs.query(task_key="feed-check", limit=50)), runs)
        self.assertEqual(len(self.transport.requests), 1)

    def test_an_empty_alias_page_settles_quietly_and_names_its_row(self):
        """同一个人的第二页挂在旧艺名下、一部作品都没有：不算失败，行上说出是哪个名字。"""
        with self.contract.database.write_transaction() as connection:
            entity_id = int(connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer',?,peach_normalize(?),?,?)",
                ("森日向子", "森日向子", feeds.stamp(), feeds.stamp())).lastrowid)
        self._add(entity_id)
        empty = ('<span class="actor-section-name">白石アイリ</span><br>'
                 '<span class="section-meta">0 部影片</span>'
                 '<div class="empty-message">暂无内容</div>').encode("utf-8")
        self.transport.responses[self.url] = HttpResponse(200, {}, empty, self.url)
        self.assertTrue(self._check()["results"][0]["ok"])
        [row] = dispatch_api_get(self.contract, "/api/feeds", {})["sources"]
        self.assertEqual((row["last_error"], row["name"], row["page_name"]),
                         (None, "森日向子", "白石アイリ"))

    def test_login_page_keeps_discoveries_and_reports_cookie_action(self):
        self._add()
        self._check()
        before = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]
        login = "<title>登入 | JavDB</title>".encode("utf-8")
        self.transport.responses[self.url] = HttpResponse(200, {}, login, self.url)
        report = self._check()["results"][0]
        self.assertFalse(report["ok"])
        self.assertIn("Cookie", report["error"])
        [row] = dispatch_api_get(self.contract, "/api/feeds", {})["sources"]
        self.assertEqual(row["last_error"], report["error"])
        self.assertIsNotNone(row["next_fetch_at"])
        after = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]
        self.assertEqual([item["code"] for item in after], [item["code"] for item in before])
        self.transport.responses[self.url] = HttpResponse(200, {}, SAMPLE.encode("utf-8"), self.url)
        self.assertTrue(self._check()["results"][0]["ok"])
        [recovered] = dispatch_api_get(self.contract, "/api/feeds", {})["sources"]
        self.assertIsNone(recovered["last_error"])

    def test_read_and_ignore_are_separate_and_idempotent(self):
        self._add()
        self._check()
        first = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"][0]
        dispatch_api_post(self.contract, "/api/feeds/discovery",
                          {"action": "read", "ids": [first["id"]]})
        dispatch_api_post(self.contract, "/api/feeds/discovery",
                          {"action": "read", "ids": [first["id"]]})
        listing = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})
        self.assertTrue(listing["items"][0]["read"])
        self.assertFalse(listing["items"][0]["ignored"])

        dispatch_api_post(self.contract, "/api/feeds/discovery",
                          {"action": "ignore", "ids": [first["id"]]})
        active = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})
        self.assertEqual([item["code"] for item in active["items"]], ["HMN-071"])
        ignored = dispatch_api_get(self.contract, "/api/feeds/discoveries",
                                   {"state": "ignored"})
        self.assertEqual([item["code"] for item in ignored["items"]], ["SSIS-950"])

        dispatch_api_post(self.contract, "/api/feeds/discovery",
                          {"action": "unignore", "ids": [first["id"]]})
        back = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})
        # 取消忽略只恢复可见性，已读状态不跟着变。
        self.assertEqual([item["code"] for item in back["items"]],
                         ["SSIS-950", "HMN-071"])
        self.assertTrue(back["items"][0]["read"])

    def test_a_code_that_reaches_the_library_leaves_the_list(self):
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO asset(location,path,name,medium,code) "
                "VALUES('R','R:\\\\media\\\\ssis950.mp4','ssis950.mp4','video','SSIS-950')")
        listing = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})
        self.assertEqual([item["code"] for item in listing["items"]], ["HMN-071"])

    def _compilation(self, performers: str) -> None:
        self._add()
        self._check()
        self._drain(1)
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET title='8時間 BEST',performers=?,"
                               "scraped_at=NULL WHERE code='SSIS-950'", (performers,))

    def _listed(self) -> list[str]:
        return [item["code"] for item in
                dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]]

    def _backlog(self) -> list[str]:
        hidden = web_settings.hidden_compilations(self.contract.database)
        with self.contract.database.read_connection() as connection:
            return feed_followup.scrape_batch(connection, hidden=hidden)

    def test_a_group_compilation_is_neither_listed_counted_nor_rescheduled(self):
        self._compilation("波多野結衣、篠田ゆう")
        listing = dispatch_api_get(self.contract, "/api/feeds/discoveries", {"limit": 1})
        # 分页按筛过的条数算：合集排在前面，要一条也还是拿到下一部，不是空页。
        self.assertEqual([item["code"] for item in listing["items"]], ["HMN-071"])
        self.assertFalse(listing["more"])
        self.assertEqual(dispatch_api_get(self.contract, "/api/feeds", {})["unread"], 1)
        self.assertEqual(self._backlog(), [])

    def test_the_two_switches_each_decide_their_own_kind(self):
        self._compilation("深田えいみ")
        # 单人合集默认照列，也照样补资料与封面。
        self.assertCountEqual(self._listed(), ["SSIS-950", "HMN-071"])
        self.assertEqual(self._backlog(), ["SSIS-950"])
        dispatch_api_post(self.contract, "/api/settings", {"feedHideSoloCompilations": True})
        self.assertEqual(self._listed(), ["HMN-071"])
        self.assertEqual(dispatch_api_get(self.contract, "/api/feeds", {})["unread"], 1)
        self.assertEqual(self._backlog(), [])
        # 换成大合集：默认收起；关掉大合集那个开关就回来，单人那个开关不管它。
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET performers='波多野結衣、篠田ゆう'"
                               " WHERE code='SSIS-950'")
        self.assertEqual(self._listed(), ["HMN-071"])
        dispatch_api_post(self.contract, "/api/settings", {"feedHideGroupCompilations": False})
        settings = dispatch_api_get(self.contract, "/api/settings", {})
        self.assertEqual((settings["feedHideGroupCompilations"],
                          settings["feedHideSoloCompilations"]), (False, True))
        self.assertCountEqual(self._listed(), ["SSIS-950", "HMN-071"])
        self.assertEqual(self._backlog(), ["SSIS-950"])

    def test_a_highlight_excerpt_is_hidden_by_studio_until_its_switch_is_off(self):
        self._compilation("篠田ゆう")
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET title='愛する妻が…',studio='ハイライト'"
                               " WHERE code='SSIS-950'")
        self.assertEqual(self._listed(), ["HMN-071"])
        self.assertEqual(self._backlog(), [])
        dispatch_api_post(self.contract, "/api/settings", {"feedHideExcerpts": False})
        self.assertCountEqual(self._listed(), ["SSIS-950", "HMN-071"])
        self.assertEqual(self._backlog(), ["SSIS-950"])

    def test_the_entity_filter_only_returns_that_person(self):
        with self.contract.database.write_transaction() as connection:
            cursor = connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','深田えいみ',peach_normalize('深田えいみ'),?,?)",
                (feeds.stamp(), feeds.stamp()))
            entity_id = int(cursor.lastrowid)
        self._add(entity_id=entity_id)
        self._check()
        mine = dispatch_api_get(self.contract, "/api/feeds/discoveries",
                                {"entity": entity_id})
        self.assertEqual(len(mine["items"]), 2)
        nobody = dispatch_api_get(self.contract, "/api/feeds/discoveries",
                                  {"entity": entity_id + 1})
        self.assertEqual(nobody["items"], [])

    def test_the_shape_list_names_whoever_still_has_a_listed_new_release(self):
        with self.contract.database.write_transaction() as connection:
            entity_id = int(connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','深田えいみ',peach_normalize('深田えいみ'),?,?)",
                (feeds.stamp(), feeds.stamp())).lastrowid)
            connection.execute(
                "INSERT INTO entity_alias(entity_id,alias,normalized_alias,source)"
                " VALUES(?,'Eimi Fukada',peach_normalize('Eimi Fukada'),'test')", (entity_id,))
        def rows():
            return [entity for entity in dispatch_api_get(
                self.contract, "/api/entity/shapes", {})["entities"] if "feed" in entity["parts"]]

        self.assertEqual(rows(), [])
        self._add(entity_id=entity_id)
        self._check()
        self.assertEqual(rows(), [{"id": entity_id, "kind": "performer",
                                   "names": ["深田えいみ", "Eimi Fukada"], "parts": ["feed"]}])
        # 那几部都忽略掉，她的页面上就没有那一行了，名单跟着不再有她。
        ids = [item["id"] for item in dispatch_api_get(
            self.contract, "/api/feeds/discoveries", {"entity": entity_id})["items"]]
        dispatch_api_post(self.contract, "/api/feeds/discovery", {"action": "ignore", "ids": ids})
        self.assertEqual(rows(), [])

    def test_removing_a_source_keeps_the_new_releases_it_found(self):
        self._add()
        self._check()
        source_id = dispatch_api_get(self.contract, "/api/feeds", {})["sources"][0]["id"]
        dispatch_api_post(self.contract, "/api/feeds/source",
                          {"action": "remove", "id": source_id})
        listing = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})
        self.assertEqual(len(listing["items"]), 2)

    def _drain(self, expected):
        """等待检查线程完成派发，再同步执行已入队的后继（ADR-0040）。"""
        thread = self.contract.feed_job.thread
        if thread is not None:
            thread.join(5)
            self.assertFalse(thread.is_alive(), self.contract.feed_job.snapshot())
        done = self.contract.followups.drain()
        self.assertGreaterEqual(done, expected, "检查线程结束后未取得预期后继")
        return done

    def test_the_scrape_followup_fills_the_shell_and_links_the_performer(self):
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','深田えいみ',peach_normalize('深田えいみ'),?,?)",
                (feeds.stamp(), feeds.stamp()))
        self._add()
        self._check()
        self.assertEqual(self._drain(1), 1)
        items = {row["code"]: row for row in dispatch_api_get(
            self.contract, "/api/feeds/discoveries", {})["items"]}
        item = items["SSIS-950"]
        self.assertEqual(item["title"], "SSIS-950 的标题")
        self.assertEqual(item["studio"], "示例厂牌")
        self.assertEqual(item["performers"], "深田えいみ")
        self.assertEqual(item["performer_refs"], [{"id": 1, "name": "深田えいみ", "has_image": False}])
        # 壳只认已有的人，不新建实体；关联上了人物页那一块才看得到。
        self.assertEqual(len(dispatch_api_get(
            self.contract, "/api/feeds/discoveries", {"entity": 1})["items"]), 2)

    def test_the_card_names_the_studio_the_way_the_library_does(self):
        """来源给的是日文厂牌名，卡片上写账本里那个厂牌的规范名；壳上仍存原文。"""
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('studio','Sample Studio',peach_normalize('Sample Studio'),?,?)",
                (feeds.stamp(), feeds.stamp()))
            connection.execute(
                "INSERT INTO entity_alias(entity_id,alias,normalized_alias,source)"
                " VALUES(last_insert_rowid(),'示例厂牌',peach_normalize('示例厂牌'),'test')")
        self._add()
        self._check()
        self._drain(1)
        items = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]
        self.assertEqual({item["studio"] for item in items}, {"Sample Studio"})
        with self.contract.database.read_connection() as connection:
            self.assertEqual({row[0] for row in connection.execute(
                "SELECT studio FROM feed_discovery")}, {"示例厂牌"})

    def test_discovery_performer_references_resolve_existing_aliases_without_writing_names(self):
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','规范姓名',peach_normalize('规范姓名'),?,?)",
                (feeds.stamp(), feeds.stamp()))
            connection.execute(
                "INSERT INTO entity_alias(entity_id,alias,normalized_alias,source)"
                " VALUES(last_insert_rowid(),'深田えいみ',peach_normalize('深田えいみ'),'test')")
        self._add()
        self._check()
        self._drain(1)
        items = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]
        self.assertEqual({tuple((ref["id"], ref["name"]) for ref in item["performer_refs"])
                          for item in items}, {((1, "规范姓名"),)})
        self.assertEqual({item["performers"] for item in items}, {"规范姓名"})
        with self.contract.database.read_connection() as connection:
            self.assertEqual({row[0] for row in connection.execute("SELECT performers FROM feed_discovery")}, {"深田えいみ"})

    def test_discovery_avatars_share_entity_image_version_and_focus(self):
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','深田えいみ',peach_normalize('深田えいみ'),?,?)",
                (feeds.stamp(), feeds.stamp()))
        self._add()
        self._check()
        self._drain(1)
        focus = {"axis": "y", "pct": 12}
        with patch.object(self.contract, "has_entity_image", return_value=True), \
                patch.object(self.contract, "entity_image_version", return_value="image7"), \
                patch.object(self.contract, "avatar_focus", return_value=focus):
            items = dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["items"]
        for item in items:
            self.assertEqual(item["performer_refs"], [{
                "id": 1, "name": "深田えいみ", "has_image": True,
                "image_version": "image7", "avatar_focus": focus}])

    def test_one_batch_installs_each_cover_with_the_sidecars_the_cards_frame_by(self):
        self.cover_misses.add("HMN-071")
        self._add()
        self._check()
        self.assertEqual(self._drain(1), 1)
        [run] = self.contract.task_runs.query(task_key=feed_followup.TASK_KEY)
        self.assertEqual(run.result_summary, {"total": 2, "ok": 2, "miss": 0, "covers": 1})
        covers = self.contract.cover_root
        self.assertTrue((covers / "SSIS-950.jpg").is_file())
        self.assertTrue((covers / "SSIS-950.poster.json").is_file())
        self.contract.cache_bust()
        items = {row["code"]: row for row in dispatch_api_get(
            self.contract, "/api/feeds/discoveries", {})["items"]}
        # 装上的那部带着正封框，页面按资产卡同一套取景；没装上的只有来源地址。
        self.assertTrue(items["SSIS-950"]["has_cover"])
        self.assertEqual(items["SSIS-950"]["poster_box"]["px"], [800, 538])
        self.assertFalse(items["HMN-071"]["has_cover"])
        self.assertIsNone(items["HMN-071"]["poster_box"])
        attempt = json.loads((covers.parent / 'feed-cover-attempts/HMN-071.json').read_text(encoding='utf-8'))
        self.assertFalse(attempt['ok'])
        self.assertIn('error_type', attempt)

    def test_detail_retry_installs_the_cover_or_reports_the_recorded_reason(self):
        self.cover_misses.add("HMN-071")
        missed = dispatch_api_post(self.contract, "/api/jav/cover", {"code": "hmn-071"})
        self.assertEqual((missed["code"], missed["has_cover"], missed["message"]),
                         ("HMN-071", False, "所有渠道都没有候选"))
        # 取图链以外的故障不把原文给用户看，只说没处理完。
        self.cover_broken.add("IPX-001")
        broken = dispatch_api_post(self.contract, "/api/jav/cover", {"code": "IPX-001"})
        self.assertEqual((broken["has_cover"], broken["message"]), (False, "封面处理未完成"))
        got = dispatch_api_post(self.contract, "/api/jav/cover", {"code": "SSIS-950"})
        self.assertEqual((got["has_cover"], got["message"]), (True, ""))
        self.assertTrue(got["cover_version"])
        self.assertTrue((self.contract.cover_root / "SSIS-950.poster.json").is_file())

    def test_official_miss_does_not_install_a_bound_javdb_image(self):
        from peach.jav_cover_fetch import Unavailable
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET link='https://javdb.com/v/Source01' WHERE code='SSIS-950'")
        with patch('peach.jav_cover_fetch.best_cover', side_effect=Unavailable('errors.javCoverFetch.catalogUnfinished')), \
                patch('peach.javdb_public.PUBLIC_API.image') as source_image, \
                patch('peach.javdb_public.PUBLIC_API.remember_movie_identity') as identity:
            with self.assertRaisesRegex(Unavailable, '官方目录查询未完成'):
                self._fetch_cover(self.contract, 'SSIS-950')
        identity.assert_not_called()
        source_image.assert_not_called()

    def test_recorded_source_url_returns_as_an_official_candidate(self):
        from peach.jav_cover_fetch import Unavailable
        recorded = 'https://awsimgsrc.dmm.co.jp/pics_dig/digital/amateur/deas082/deas082jp.jpg'
        given = 'https://pics.dmm.co.jp/digital/amateur/deas082/deas082jp.jpg'
        evidence = self.contract.cover_root / 'DEAS-082.scraping.json'
        evidence.parent.mkdir(parents=True, exist_ok=True)
        evidence.write_text(json.dumps({'code': 'DEAS-082', 'source_url': recorded}), encoding='utf-8')
        with patch('peach.jav_cover_fetch.best_cover', side_effect=Unavailable('errors.javCoverFetch.catalogUnfinished')) as best:
            for cover_url in (None, given):
                with self.assertRaises(Unavailable):
                    self._fetch_cover(self.contract, 'DEAS-082', cover_url)
        without, with_given = ([c.url for c in call.kwargs['prior_candidates']] for call in best.call_args_list)
        self.assertIn(recorded, without)
        self.assertIn(recorded, with_given)
        self.assertEqual(with_given[0], given)
        self.assertEqual(len(with_given), len(set(with_given)))

    def test_vr_layout_survives_without_a_detected_face(self):
        target = self.contract.cover_root / 'MDVR-276.face.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({'layout': 'still', 'face': None}), encoding='utf-8')
        self.assertEqual(self.contract._cover_focus(str(target)), {'layout': 'still'})

    def _attempted(self, code: str, seconds_ago: float) -> None:
        path = feed_followup.cover_attempt_path(self.contract.cover_root, code)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"code": code, "ok": False}), encoding="utf-8")
        moment = time.time() - seconds_ago
        os.utime(path, (moment, moment))

    def _cover_backlog(self, **options) -> list[str]:
        with self.contract.database.read_connection() as connection:
            return feed_followup.cover_backlog(connection, self.contract.cover_root, hidden=frozenset(),
                                               retry_after=timedelta(0), **options)

    def test_cover_backlog_prioritises_the_least_recent_attempt(self):
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET scraped_at='2026-01-01T00:00:00Z',release_date='2026-10-01' WHERE code='SSIS-950'")
            connection.execute("UPDATE feed_discovery SET scraped_at='2026-01-01T00:00:00Z',release_date='2025-01-01' WHERE code='HMN-071'")
        self._attempted('SSIS-950', 3600)
        self._attempted('HMN-071', 86400)
        self.assertEqual(self._cover_backlog(limit=1), ['HMN-071'])
        # 资料没取到的壳归取资料那一批，不进补封面。
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET scrape_error='来源连接未取得' WHERE code='HMN-071'")
        self.assertEqual(self._cover_backlog(), ['SSIS-950'])
        with self.contract.database.read_connection() as connection:
            self.assertEqual(feed_followup.scrape_batch(connection, hidden=frozenset(),
                                                        retry_after=timedelta(0)), ['HMN-071'])

    def test_failed_old_rows_keep_a_share_of_a_batch_full_of_new_codes(self):
        """一轮发现的新番号比一批还多时，上次没取到资料的旧壳仍有保底名额，不被挤到轮不上。"""
        fresh = [f"NEW-{number:03d}" for number in range(feed_followup.MAX_BATCH + 10)]
        self._add()
        with self.contract.database.write_transaction() as connection:
            for number in range(feed_followup.RETRY_SHARE + 2):
                connection.execute(
                    "INSERT INTO feed_discovery(code,source_id,title,link,release_date,discovered_at,"
                    "scraped_at,scrape_error) VALUES(?,1,'',NULL,'2026-09-22',?,?,'来源连接未取得')",
                    (f"OLD-{number:03d}", feeds.stamp(), f"2026-01-{number + 1:02d}T00:00:00Z"))
        with self.contract.database.read_connection() as connection:
            batch = feed_followup.scrape_batch(connection, fresh, hidden=frozenset(),
                                               retry_after=timedelta(0))
        self.assertEqual(len(batch), feed_followup.MAX_BATCH)
        self.assertEqual(batch[:feed_followup.MAX_BATCH - feed_followup.RETRY_SHARE],
                         fresh[:feed_followup.MAX_BATCH - feed_followup.RETRY_SHARE])
        # 保底名额给最久没试过的那几部。
        self.assertEqual(batch[-feed_followup.RETRY_SHARE:],
                         [f"OLD-{number:03d}" for number in range(feed_followup.RETRY_SHARE)])

    BLURAY_TITLE = "Pretty Glamour ― 誰もが恋する私に ― /藤森里穂（ブルーレイディスク）"

    def _bluray_shell(self, code="GRABD-039", title=BLURAY_TITLE):
        with self.contract.database.write_transaction() as connection:
            entity = connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','藤森里穂',peach_normalize('藤森里穂'),?,?)",
                (feeds.stamp(), feeds.stamp())).lastrowid
            shell = feeds.create_shell(connection, code, source_id=None, title=title,
                                       performers="藤森里穂", entity_id=entity)
            connection.execute("UPDATE feed_discovery SET scraped_at='2026-01-01T00:00:00Z',"
                               "cover_url='https://c0.jdbstatic.com/covers/qn/QNZQX9.jpg' WHERE id=?", (shell,))
        return shell

    def _run_scrape(self, *codes):
        handle = SimpleNamespace(saved={}, progress=lambda **_: None, checkpoint=lambda **_: None)
        return feed_followup.run(self.contract, feed_followup.followup_key(codes), handle)

    def test_a_bluray_product_number_resolves_to_its_dmm_streaming_edition_by_title(self):
        """蓝光版品番 DMM 配信版里没有，序号也可能不同；标题去掉版本字样、出演者对得上的才算同一部。"""
        def answer(request):
            payload = json.loads(request.body)
            if "legacySearchPPV" in payload["query"]:
                self.assertEqual(payload["variables"]["queryWord"], "Pretty Glamour 誰もが恋する私に 藤森里穂")
                contents = [{"id": "h_1714grace00039"}, {"id": "h_1714grace00038"}]
                return HttpResponse(200, {"Content-Type": "application/json"},
                                    json.dumps({"data": {"legacySearchPPV": {"result": {"contents": contents}}}}).encode(),
                                    DMM_ENDPOINT)
            cid = payload["variables"]["id"]
            item = {"h_1714grace00039": ("GRACE-039", "Pretty Glamour ー 誰もが恋する私に ー 藤森里穂"),
                    "h_1714grace00038": ("GRACE-038", "Pretty Glamour ー 別の作品 ー 藤森里穂")}[cid]
            content = {"id": cid, "makerContentId": item[0], "title": item[1], "actresses": [{"name": "藤森里穂"}]}
            return HttpResponse(200, {"Content-Type": "application/json"},
                                json.dumps({"data": {"ppvContent": content}}).encode(), DMM_ENDPOINT)

        from peach.jav_editions import digital_edition
        root = self.contract.follow_secrets_root
        transport = FakeTransport({DMM_ENDPOINT: answer})
        self.assertEqual(digital_edition(self.BLURAY_TITLE, ["藤森里穂"], root, transport=transport), "GRACE-039")
        self.assertEqual(digital_edition(self.BLURAY_TITLE, ["別の人"], root, transport=transport), "",
                         "出演者对不上的不算同一部")
        asked = len(transport.requests)
        self.assertEqual(digital_edition("Pretty Glamour 藤森里穂", ["藤森里穂"], root, transport=transport), "")
        self.assertEqual(len(transport.requests), asked, "标题没写蓝光的不问 DMM")

    def test_a_bluray_shell_whose_streaming_edition_is_listed_leaves_the_list(self):
        self._bluray_shell()
        with self.contract.database.write_transaction() as connection:
            feeds.create_shell(connection, "GRACE-039", source_id=None,
                               title="Pretty Glamour ー 誰もが恋する私に ー 藤森里穂")
        with patch("peach.jav_editions.digital_edition", return_value="GRACE-039") as lookup:
            self._run_scrape("GRABD-039")
        lookup.assert_called_once()
        self.assertEqual(lookup.call_args.args[:2], (self.BLURAY_TITLE, ["藤森里穂"]))
        with self.contract.database.read_connection() as connection:
            self.assertEqual([row[0] for row in connection.execute("SELECT code FROM feed_discovery")], ["GRACE-039"])
            self.assertIsNone(connection.execute("SELECT 1 FROM feed_discovery_entity WHERE discovery_id NOT IN"
                                                 " (SELECT id FROM feed_discovery)").fetchone())
        self.assertNotIn("GRABD-039", self.cover_urls)

    def test_a_listed_bluray_shell_without_a_cover_becomes_its_streaming_edition(self):
        """存量里取过资料、封面一直取不到的蓝光版归取资料那一批：改成配信版番号，资料与封面按它重取。"""
        shell = self._bluray_shell("REBDB-1006", "Hinako2 Eternal Wave・森日向子 ブルーレイエディション（ブルーレイディスク）")
        with self.contract.database.read_connection() as connection:
            batch = feed_followup.scrape_batch(connection, hidden=frozenset(), retry_after=timedelta(0),
                                               cover_root=self.contract.cover_root)
        self.assertEqual(batch, ["REBDB-1006"])
        self.assertEqual(self._cover_backlog(), [], "补封面那条通道不写账本，蓝光版不排进去")
        with patch("peach.jav_editions.digital_edition", return_value="REBD-1021"):
            summary = self._run_scrape(*batch)
        self.assertEqual(summary["covers"], 1)
        with self.contract.database.read_connection() as connection:
            row = connection.execute("SELECT id,code,title,cover_url FROM feed_discovery").fetchone()
            linked = connection.execute("SELECT entity_id FROM feed_discovery_entity WHERE discovery_id=?",
                                        (shell,)).fetchall()
        self.assertEqual((row["id"], row["code"], row["title"]), (shell, "REBD-1021", "REBD-1021 的标题"))
        self.assertEqual(self.cover_urls, {"REBD-1021": "https://images.example.test/cover.jpg"})
        self.assertEqual(len(linked), 1, "出演者关联跟着壳走")
        # 并完就不再是蓝光版，下一轮不再问 DMM。
        with self.contract.database.read_connection() as connection:
            self.assertEqual(feed_followup.scrape_batch(connection, hidden=frozenset(), retry_after=timedelta(0),
                                                        cover_root=self.contract.cover_root), [])

    def test_a_bluray_shell_stays_when_dmm_has_no_matching_edition(self):
        self._bluray_shell()
        with patch("peach.jav_editions.digital_edition", side_effect=OSError("timeout")):
            self._run_scrape("GRABD-039")
        with patch("peach.jav_editions.digital_edition", return_value=""):
            self._run_scrape("GRABD-039")
        with self.contract.database.read_connection() as connection:
            self.assertEqual([row[0] for row in connection.execute("SELECT code FROM feed_discovery")], ["GRABD-039"])
        self.assertIn("GRABD-039", self.cover_urls, "对不上时照旧按原番号取封面")

    def test_scraping_one_code_stops_at_the_metadata_budget(self):
        """来源连不上时一部最多问到资料预算为止，原因写成哪几家在多少秒内没答复。"""
        from peach.jav_cover_fetch import DeadlineExceeded
        from peach.library_processing import ACTION_BUDGETS

        seen = {}

        class Silent:
            def community(self, code, *, deadline=None, route=None):
                seen["remaining"] = float(deadline) - time.monotonic()
                raise DeadlineExceeded("errors.javCoverFetch.deadline")

        with self.assertRaisesRegex(DeadlineExceeded, "秒内没有答复"):
            self._collect(Silent(), "SSIS-950")
        self.assertLessEqual(seen["remaining"], ACTION_BUDGETS["querying_metadata"])
        self.assertGreater(seen["remaining"], ACTION_BUDGETS["querying_metadata"] - 5)

    def test_codes_already_queued_are_not_planned_again(self):
        """在队里的那一批还没跑完，下一轮检查只带新的番号，不把同一批换个组合再派一条。"""
        self._add()
        self.assertEqual([item["key"] for item in self._check()["followups"]],
                         ["feed-scrape:SSIS-950,HMN-071"])
        with self.contract.database.write_transaction() as connection:
            connection.execute("INSERT INTO feed_discovery(code,source_id,title,link,release_date,discovered_at)"
                               " VALUES('ABP-123',1,'',NULL,'2026-09-22',?)", (feeds.stamp(),))
        self.transport.responses[self.url] = HttpResponse(304, {}, b"", self.url)
        thread = self.contract.feed_job.thread
        if thread is not None:
            thread.join(5)
        self.assertEqual([item["key"] for item in self._check()["followups"]], ["feed-scrape:ABP-123"])

    def test_shells_still_waiting_for_their_scrape_get_covers_in_their_own_lane(self):
        """取资料一批装不下的壳不等写账本的那条通道，先只凭番号补封面；两批互不重复。"""
        self._add()
        self._check()
        fresh = [f"NEW-{number:03d}" for number in range(feed_followup.MAX_BATCH + 2)]
        with self.contract.database.write_transaction() as connection:
            for code in fresh:
                connection.execute("INSERT INTO feed_discovery(code,source_id,title,link,release_date,discovered_at)"
                                   " VALUES(?,1,'',NULL,'2026-12-01',?)", (code, feeds.stamp()))
        self.transport.responses[self.url] = HttpResponse(304, {}, b"", self.url)
        thread = self.contract.feed_job.thread
        if thread is not None:
            thread.join(5)
        planned = {item["task_key"]: item["key"] for item in self._check()["followups"]}
        scrape = feed_followup.parse_key(planned[feed_followup.TASK_KEY])
        covers = feed_followup.parse_key(planned[feed_followup.COVER_TASK_KEY], feed_followup.COVER_TASK_KEY)
        self.assertEqual(len(scrape), feed_followup.MAX_BATCH)
        self.assertEqual(sorted(covers), sorted(set(fresh) - set(scrape)))
        # 上次没取到资料的仍归取资料重试，不进补封面。
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET scraped_at=?,scrape_error='来源连接未取得'"
                               " WHERE code=?", (feeds.stamp(), covers[0]))
        self.assertNotIn(covers[0], self._cover_backlog(exclude=scrape))

    def test_a_missing_cover_gets_its_own_batch_outside_the_ledger_lane(self):
        """资料齐了只缺封面的壳另派补封面：只取图，不再问资料来源，也不排在写账本的后继后面。"""
        self.cover_misses.add("HMN-071")
        self._add()
        self._check()
        self._drain(1)
        self.cover_misses.clear()
        self.transport.responses[self.url] = HttpResponse(304, {}, b"", self.url)
        asked = []
        feed_followup.collect = lambda provider, code: asked.append(code)
        self.assertEqual([item["key"] for item in self._check()["followups"]], ["feed-cover:HMN-071"])
        self.assertFalse(feed_followup.COVER_TYPE.writes_ledger)
        self._drain(1)
        self.assertEqual(asked, [])
        self.assertTrue(feed_followup.has_local_cover(self.contract.cover_root, "HMN-071"))
        [run] = self.contract.task_runs.query(task_key=feed_followup.COVER_TASK_KEY)
        self.assertEqual(run.result_summary, {"total": 1, "covers": 1})

    def test_a_resumed_batch_does_not_retry_a_code_it_already_tried(self):
        """服务重启后续跑这一批：上次试过没取到的那部不再在批首重耗一遍，计数接着上次的。"""
        self._add()
        self._check()
        thread = self.contract.feed_job.thread
        if thread is not None:
            thread.join(5)
        asked = []
        collect = feed_followup.collect
        feed_followup.collect = lambda provider, code: asked.append(code) or collect(provider, code)
        saved = {"done_codes": ["SSIS-950"], "fetched": 0, "covers": 0, "miss": 1}
        handle = SimpleNamespace(saved=saved, progress=lambda **_: None,
                                 checkpoint=lambda **fields: saved.update(fields))
        summary = feed_followup.run(self.contract, "feed-scrape:SSIS-950,HMN-071", handle)
        self.assertEqual(asked, ["HMN-071"])
        self.assertEqual(summary, {"total": 2, "ok": 1, "miss": 1, "covers": 1})
        self.assertEqual(saved["done_codes"], ["HMN-071", "SSIS-950"])

    def test_covers_cut_off_at_the_connection_are_counted_for_the_new_release_row(self):
        """连不上图片主机的几部单独记数，列表把最近一轮的数带给页面去提示换线路；
        官方没图的那几部不算进去。"""
        self.assertEqual(dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["cover_network"], 0)
        self.cover_unreachable.add("SSIS-950")
        self.cover_misses.add("HMN-071")
        self._add()
        self._check()
        self.assertEqual(self._drain(1), 1)
        [run] = self.contract.task_runs.query(task_key=feed_followup.TASK_KEY)
        self.assertEqual(run.result_summary,
                         {"total": 2, "ok": 2, "miss": 0, "covers": 0, "cover_network": 1})
        self.assertEqual(dispatch_api_get(self.contract, "/api/feeds/discoveries", {})["cover_network"], 1)

    def test_the_cover_step_gets_the_address_the_scrape_just_wrote(self):
        """封面地址是同一轮取资料才写上壳的，取图那一步拿到的得是它，不是空的。"""
        self._add()
        self._check()
        self._drain(1)
        self.assertEqual(self.cover_urls, {
            "SSIS-950": "https://images.example.test/cover.jpg",
            "HMN-071": "https://images.example.test/cover.jpg"})

    def test_a_shell_still_missing_its_cover_rejoins_a_batch_after_the_retry_window(self):
        self.cover_misses.add("HMN-071")
        self._add()
        self._check()
        self._drain(1)
        self.transport.responses[self.url] = HttpResponse(304, {}, b"", self.url)
        # 定时那一轮：刚试过的不再排；已经有封面、资料也齐的那部永远不再排。
        self._stock_window_passes()
        self.assertEqual(self._check(automatic=True)["followups"], [])
        self._attempted("HMN-071", feed_followup.RETRY_AFTER.total_seconds() + 60)
        self._stock_window_passes()
        self.assertEqual([item["key"] for item in self._check(automatic=True)["followups"]],
                         ["feed-cover:HMN-071"])
        # 人说了不想看的，不再替它花配额。
        first = {row["code"]: row for row in dispatch_api_get(
            self.contract, "/api/feeds/discoveries", {})["items"]}["HMN-071"]
        dispatch_api_post(self.contract, "/api/feeds/discovery",
                          {"action": "ignore", "ids": [first["id"]]})
        self.assertEqual(self._check()["followups"], [])

    def test_a_manual_check_retries_a_missing_cover_without_waiting_out_the_window(self):
        """人手点的那一轮不等重试窗口：点「检查」就是要现在取。"""
        self.cover_misses.add("HMN-071")
        self._add()
        self._check()
        self._drain(1)
        attempt = self.contract.cover_root.parent / 'feed-cover-attempts' / 'SSIS-950.json'
        self.assertTrue(feed_followup.has_local_cover(self.contract.cover_root, 'SSIS-950'),
                        attempt.read_text(encoding='utf-8') if attempt.exists() else '未取得封面处理记录')
        self.transport.responses[self.url] = HttpResponse(304, {}, b"", self.url)
        self.assertEqual([item["key"] for item in self._check()["followups"]],
                         ["feed-cover:HMN-071"])

    def test_every_check_carries_performers_still_missing_an_avatar(self):
        """缺头像的存量女优跟着定时拉取补；当前图库下已取证的跳过，图库变化后重新派发。"""
        from peach import avatar_followup
        from peach.followups import Attempts, attempts_root

        with self.contract.database.write_transaction() as connection:
            entity_id = connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','二の宮すずか','二の宮すずか',?,?)",
                ("2026-09-22T00:00:00Z", "2026-09-22T00:00:00Z")).lastrowid
            connection.execute(
                "INSERT INTO asset(id,location,path,name,medium,code,size)"
                " VALUES(9001,'R:','R:\\media\\NHDTB-557.mp4','NHDTB-557.mp4','video','NHDTB-557',1)")
            connection.execute(
                "INSERT INTO asset_entity(asset_id,entity_id,role,source)"
                " VALUES(9001,?,'performer','test')", (entity_id,))
        key = avatar_followup.followup_key("performer", entity_id)
        providers_root = self.contract.candidate_root / "provider-cache" / "performer-avatars"
        index_dir = providers_root / "gfriends"
        index_dir.mkdir(parents=True, exist_ok=True)
        index_path = index_dir / "gfriends-filetree.json"
        index_path.write_text('{"Content": {}}', encoding="utf-8")
        self.assertIn(key, [item["key"] for item in self._check(automatic=True)["followups"]])
        with self.contract.database.read_connection() as connection:
            current = avatar_followup.fingerprint(connection, entity_id, providers_root)
        Attempts(attempts_root(self.contract.candidate_root)).record(key, current, [part("galleryUnsure", count=6)])
        self._stock_window_passes()
        self.assertNotIn(key, [item["key"] for item in self._check(automatic=True)["followups"]])
        index_path.write_text(json.dumps({"Content": {"1-S1": {"二の宮すずか.jpg": "二の宮すずか.jpg"}}}), encoding="utf-8")
        self._stock_window_passes()
        self.assertIn(key, [item["key"] for item in self._check(automatic=True)["followups"]])

    def test_scheduled_rounds_carry_the_stock_only_once_per_window(self):
        """定时每半小时一跳：新番号每跳都派，存量（旧壳、封面、头像、想要）一个窗口只派一次。"""
        self.cover_misses.add("HMN-071")
        self._add()
        first = self._check(automatic=True)
        self.assertTrue(first["stock"])
        self.assertEqual([item["key"] for item in first["followups"]],
                         ["feed-scrape:SSIS-950,HMN-071"])
        self._drain(1)
        self._attempted("HMN-071", feed_followup.RETRY_AFTER.total_seconds() + 60)
        self.transport.responses[self.url] = HttpResponse(304, {}, b"", self.url)
        quiet = self._check(automatic=True)
        self.assertFalse(quiet["stock"])
        self.assertEqual(quiet["followups"], [])
        self._stock_window_passes()
        self.assertEqual([item["key"] for item in self._check(automatic=True)["followups"]],
                         ["feed-cover:HMN-071"])

    def test_an_unknown_action_is_refused(self):
        with self.assertRaises(ValueError):
            dispatch_api_post(self.contract, "/api/feeds/discovery",
                              {"action": "delete", "ids": [1]})


#: JavDB 演员页里两部作品，形状照 `test_feeds.JAVDB_ACTOR` 那份抓回来的 HTML。
JAVDB_PAGE = """
<a href="/v/5nr8mp" class="box" title="x"><div class="video-title"><strong>PBD-528</strong>
 気高きお姉さん達</div><div class="meta">
 2026-10-20</div></a>
<a href="/v/RkPb5z" class="box" title="x"><div class="video-title"><strong>BBSS-106</strong>
 別の作品</div><div class="meta">
 2026-10-13</div></a>
"""

#: 隐退的人：主页最近只剩大合集，「單體作品」页才翻得到她自己的正片。
RETIRED_PAGE = """
<a href="/v/Rt0001" class="box" title="x"><div class="video-title"><strong>JKSR-736</strong>
 デカパイ奥様 16人4時間</div><div class="meta">
 2026-05-23</div></a>
"""
SOLO_PAGE = """
<a href="/v/Rt0001" class="box" title="x"><div class="video-title"><strong>JKSR-736</strong>
 デカパイ奥様 16人4時間</div><div class="meta">
 2026-05-23</div></a>
<a href="/v/Rt0002" class="box" title="x"><div class="video-title"><strong>MCSR-191</strong>
 欲情不倫妻</div><div class="meta">
 2025-07-19</div></a>
<a href="/v/Rt0003" class="box" title="x"><div class="video-title"><strong>CLO-350</strong>
 今晩、何回シテくれるか</div><div class="meta">
 2025-06-06</div></a>
"""


class PerformerFeedFixture(FeedWebFixture):
    """一位有 JavDB 演员页的女优、按地址回样本页的传输，以及订阅相关的取数辅助。"""

    def setUp(self):
        super().setUp()
        self.page = "https://javdb.com/actors/pRMq"
        self.transport.responses[self.page] = HttpResponse(
            200, {"Content-Type": "text/html"}, JAVDB_PAGE.encode("utf-8"), self.page)
        original = web_feeds._transport
        web_feeds._transport = lambda contract: self.transport
        self.addCleanup(lambda: setattr(web_feeds, "_transport", original))
        self.performer = self._performer("凉森れむ", ["pRMq"])

    def _performer(self, name, javdb_ids):
        with self.contract.database.write_transaction() as connection:
            entity_id = int(connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer',?,peach_normalize(?),?,?)",
                (name, name, feeds.stamp(), feeds.stamp())).lastrowid)
            for external_id in javdb_ids:
                connection.execute(
                    "INSERT INTO entity_external_ref(entity_id,provider,external_kind,"
                    "external_id) VALUES(?,'javdb','performer',?)", (entity_id, external_id))
        return entity_id

    def _switch(self, enabled, entity_id=None):
        return dispatch_api_post(self.contract, "/api/feeds/source", {
            "action": "follow", "entity_id": entity_id or self.performer,
            "enabled": enabled})

    def _settled(self):
        thread = self.contract.feed_job.thread
        self.assertIsNotNone(thread, '订阅拉取未启动')
        thread.join(15)
        self.assertFalse(thread.is_alive(), '订阅拉取未结束')
        state = self.contract.feed_job.snapshot() or {}
        self.assertNotIn(state.get('status'), ('running', None))
        return state

    def _sources(self):
        return dispatch_api_get(self.contract, "/api/feeds", {})["sources"]


class PerformerFeedSwitchTest(PerformerFeedFixture):
    """人物页「订阅新作」开关：地址由服务端按 JavDB 演员页拼，页面只送开和关。"""

    def test_switching_on_subscribes_her_javdb_page_and_fetches_it_now(self):
        result = self._switch(True)
        self.assertTrue(result["following"])
        [source] = self._sources()
        self.assertEqual((source["kind"], source["url"], source["entity_id"]),
                         (feeds.KIND_JAVDB_ACTOR, self.page, self.performer))
        # 名字不另存，跟着人物走。
        self.assertEqual(source["name"], "凉森れむ")
        self.assertEqual(self._settled()["added"], 2)
        mine = dispatch_api_get(self.contract, "/api/feeds/discoveries",
                                {"entity": self.performer})
        self.assertEqual([item["code"] for item in mine["items"]], ["PBD-528", "BBSS-106"])

    def test_a_name_matched_page_of_the_credited_record_is_not_subscribed(self):
        """#271：按名字对上的同类演员页（旧艺名的空页）不进订阅，只订作品署名的那页。"""
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "UPDATE entity_external_ref SET metadata_json=? WHERE entity_id=? AND external_id='pRMq'",
                (json.dumps({"source": "javdb", "provider_id": "PBD-528", "uncensored": False}),
                 self.performer))
            connection.execute(
                "INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id,metadata_json)"
                " VALUES(?,'javdb','performer','MmbDR',?)",
                (self.performer, json.dumps({"source": "backfill_performer_entry_ids", "uncensored": False})))
        self._switch(True)
        self.assertEqual([source["url"] for source in self._sources()], [self.page])
        self._settled()

    def test_a_page_of_only_compilations_is_backfilled_from_her_solo_works(self):
        retired = self._performer("篠田ゆう", ["WE4e"])
        page = "https://javdb.com/actors/WE4e"
        self.transport.responses[page] = HttpResponse(
            200, {"Content-Type": "text/html"}, RETIRED_PAGE.encode("utf-8"), page)
        self.transport.responses[page + "?t=s"] = HttpResponse(
            200, {"Content-Type": "text/html"}, SOLO_PAGE.encode("utf-8"), page + "?t=s")
        self._switch(True, retired)
        state = self._settled()
        [report] = state["results"]
        self.assertTrue(report["ok"])
        self.assertEqual(report["backfilled"], 2)
        mine = dispatch_api_get(self.contract, "/api/feeds/discoveries", {"entity": retired})
        self.assertEqual([item["code"] for item in mine["items"]], ["MCSR-191", "CLO-350"])

    def test_a_missing_solo_page_leaves_the_round_itself_successful(self):
        self._switch(True)
        [report] = self._settled()["results"]
        self.assertTrue(report["ok"])
        self.assertIn("backfill_error", report)
        self.assertIsNone(report["error"])

    def test_switching_off_pauses_and_switching_on_again_reuses_the_source(self):
        self._switch(True)
        self._settled()
        self._switch(False)
        [paused] = self._sources()
        self.assertFalse(paused["enabled"])
        self._switch(True)
        self._settled()
        [again] = self._sources()
        self.assertEqual(again["id"], paused["id"])
        self.assertTrue(again["enabled"])

    def test_a_listed_page_without_a_person_is_adopted_instead_of_duplicated(self):
        with self.contract.database.write_transaction() as connection:
            feeds.add_source(connection, url=self.page)
        self._switch(True)
        self._settled()
        [source] = self._sources()
        self.assertEqual(source["entity_id"], self.performer)

    def test_every_javdb_page_of_hers_gets_its_own_source(self):
        twice = self._performer("释爱丽丝", ["d45k9", "ZX5z7"])
        result = self._switch(True, twice)
        self._settled()
        self.assertEqual(len(result["sources"]), 2)
        self.assertEqual(sorted(source["url"] for source in self._sources()),
                         ["https://javdb.com/actors/ZX5z7", "https://javdb.com/actors/d45k9"])

    def test_the_profile_carries_the_switch_only_when_she_has_a_javdb_page(self):
        profile = dispatch_api_get(self.contract, "/api/entity",
                                   {"kind": "performer", "name": "凉森れむ"})
        self.assertEqual(profile["feed"], {"following": False})
        self._switch(True)
        self._settled()
        profile = dispatch_api_get(self.contract, "/api/entity",
                                   {"kind": "performer", "name": "凉森れむ"})
        self.assertEqual(profile["feed"], {"following": True})
        self._performer("無名の人", [])
        bare = dispatch_api_get(self.contract, "/api/entity",
                                {"kind": "performer", "name": "無名の人"})
        self.assertNotIn("feed", bare)

    def test_a_performer_without_a_javdb_page_is_refused(self):
        bare = self._performer("無名の人", [])
        with self.assertRaises(ValueError):
            self._switch(True, bare)
        self.assertEqual(self._sources(), [])

    def _dmm_id(self, entity_id, value="1051912", provider="r18dev"):
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id)"
                " VALUES(?,?,'performer',?)", (entity_id, provider, value))

    def test_her_dmm_catalogue_is_a_second_source_merged_with_javdb(self):
        self._dmm_id(self.performer)
        self.transport.responses[DMM_ENDPOINT] = dmm_catalogue(
            [("mikr00133", "2026-11-13", True, 1), ("pbd00528", "2026-10-20", False, 2),
             ("mizd00570", "2026-11-27", True, 37)],
            {"mikr00133": "MIKR-133", "pbd00528": "PBD-528", "mizd00570": "MIZD-570"})
        result = self._switch(True)
        self.assertEqual(len(result["sources"]), 2)
        reports = {report["source"]: report for report in self._settled()["results"]}
        # 同一个人的几条源挨在一起，JavDB 演员页在前。
        self.assertEqual([source["kind"] for source in self._sources()],
                         [feeds.KIND_JAVDB_ACTOR, feeds.KIND_DMM_ACTRESS])
        sources = {source["kind"]: source for source in self._sources()}
        dmm = sources[feeds.KIND_DMM_ACTRESS]
        self.assertEqual((dmm["url"], dmm["kind_label"], dmm["page_name"], dmm["name"]),
                         ("https://video.dmm.co.jp/av/list/?actress=1051912", "JAV 订阅 · DMM",
                          "涼森れむ", "凉森れむ"))
        self.assertEqual({key: reports[dmm["id"]][key] for key in ("ok", "pre_order", "compilations")},
                         {"ok": True, "pre_order": 2, "compilations": 1})
        mine = dispatch_api_get(self.contract, "/api/feeds/discoveries", {"entity": self.performer})
        # PBD-528 两个来源都报了，只有一个壳；三五十人的合集不建壳。
        self.assertEqual(sorted(item["code"] for item in mine["items"]),
                         ["BBSS-106", "MIKR-133", "PBD-528"])
        # 两类源一起开、一起关。
        self._switch(False)
        self.assertEqual([source["enabled"] for source in self._sources()], [False, False])

    def test_her_censored_javdb_page_is_skipped_while_her_dmm_catalogue_answers(self):
        """DMM 片单拉成功后，定时轮次绕过她在 JavDB 上的有碼页；無碼页照拉，DMM 出错时 JavDB 接上。源都不停用。"""
        self._dmm_id(self.performer)
        self.transport.responses[DMM_ENDPOINT] = dmm_catalogue([], {})
        self._switch(True)
        self._settled()
        sources = {source["kind"]: source for source in self._sources()}
        javdb, dmm = sources[feeds.KIND_JAVDB_ACTOR], sources[feeds.KIND_DMM_ACTRESS]
        future = "2999-01-01T00:00:00Z"
        with self.contract.database.read_connection() as connection:
            self.assertEqual(feeds.covered_by_dmm(connection), {javdb["id"]})
            self.assertEqual([row["id"] for row in feeds.due_sources(connection, future)], [dmm["id"]])
        self.assertTrue(all(source["enabled"] for source in self._sources()), "绕过不等于停用")
        # 她这一页是無碼记录时照拉。
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE entity_external_ref SET metadata_json=? WHERE entity_id=? AND provider='javdb'",
                               (json.dumps({"uncensored": True}), self.performer))
        with self.contract.database.read_connection() as connection:
            self.assertEqual(feeds.covered_by_dmm(connection), set())
        # DMM 片单上次失败时 JavDB 接上。
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE entity_external_ref SET metadata_json='{}' WHERE entity_id=? AND provider='javdb'",
                               (self.performer,))
            connection.execute("UPDATE feed_source SET last_error='HTTP 503' WHERE id=?", (dmm["id"],))
        with self.contract.database.read_connection() as connection:
            self.assertEqual(feeds.covered_by_dmm(connection), set())

    def test_a_dmm_failure_lands_on_its_own_row(self):
        self._dmm_id(self.performer)
        self.transport.responses[DMM_ENDPOINT] = HttpResponse(503, {}, b"", DMM_ENDPOINT)
        self._switch(True)
        reports = {report["source"]: report for report in self._settled()["results"]}
        sources = {source["kind"]: source for source in self._sources()}
        dmm, javdb = sources[feeds.KIND_DMM_ACTRESS], sources[feeds.KIND_JAVDB_ACTOR]
        self.assertEqual((dmm["last_error"], reports[dmm["id"]]["reason"]), ("HTTP 503", "server_error"))
        self.assertIsNotNone(dmm["next_fetch_at"])
        self.assertTrue(reports[javdb["id"]]["ok"])

    def test_a_performer_with_only_a_dmm_id_can_subscribe(self):
        dmm_only = self._performer("RION", [])
        self._dmm_id(dmm_only, "1012345", provider="dmm")
        self.transport.responses[DMM_ENDPOINT] = dmm_catalogue([], {})
        profile = dispatch_api_get(self.contract, "/api/entity", {"kind": "performer", "name": "RION"})
        self.assertEqual(profile["feed"], {"following": False})
        self._switch(True, dmm_only)
        [report] = self._settled()["results"]
        self.assertEqual((report["ok"], report["seen"]), (True, 0))
        [source] = self._sources()
        self.assertEqual(source["kind"], feeds.KIND_DMM_ACTRESS)

    def test_a_round_adds_her_dmm_source_once_her_id_is_scraped(self):
        self._switch(True)
        self._settled()
        self.assertEqual(len(self._sources()), 1)
        self._dmm_id(self.performer, "1051912", provider="dmm")
        self.transport.responses[DMM_ENDPOINT] = dmm_catalogue(
            [("mikr00133", "2026-11-13", True, 1)], {"mikr00133": "MIKR-133"})
        self._check()
        kinds = sorted(source["kind"] for source in self._sources())
        self.assertEqual(kinds, [feeds.KIND_DMM_ACTRESS, feeds.KIND_JAVDB_ACTOR])
        mine = dispatch_api_get(self.contract, "/api/feeds/discoveries", {"entity": self.performer})
        self.assertIn("MIKR-133", [item["code"] for item in mine["items"]])


#: JavDB 演员搜索页：同一位的有碼与無碼两张卡，加一位同名的别人。写法照
#: `test_directory_link_harvest.JAVDB_SEARCH_PAGE`，多了無碼那枚 `info` 标记。
SEARCH_PAGE = """<div id="actors" class="actors">
 <div class="box actor-box"><a href="/actors/Kn01" title="瀬戸環奈, 瀨戶環奈, 濑户环奈">
  <figure class="image"><img class="avatar" src="https://c0.jdbstatic.com/avatars/kn/Kn01.jpg" />
  </figure><strong>瀬戸環奈</strong></a></div>
 <div class="box actor-box"><a href="/actors/Kn02" title="瀬戸環奈">
  <figure class="image"><span class="info">無碼</span></figure><strong>瀬戸環奈</strong></a></div>
 <div class="box actor-box"><a href="/actors/Zz99" title="別人さん">
  <strong>別人さん</strong></a></div>
</div>"""

#: 站上真有两位同名：有碼那种记录出现了两张。
TWINS_PAGE = """<div id="actors" class="actors">
 <div class="box actor-box"><a href="/actors/Tw01" title="瀬戸環奈"><strong>瀬戸環奈</strong></a></div>
 <div class="box actor-box"><a href="/actors/Tw02" title="瀬戸環奈"><strong>瀬戸環奈</strong></a></div>
</div>"""

LOGIN_PAGE = """<html><head><title> 登入 | JavDB 成人影片數據庫 </title></head>
<body><form action="/user_sessions"></form></body></html>"""


class FeedFollowByNameFixture(PerformerFeedFixture):
    """JavDB 演员搜索页与几张演员卡的样本，按名字查找与登记的辅助。"""

    def setUp(self):
        super().setUp()
        self.search = "https://javdb.com/search?f=actor&q=%E7%80%AC%E6%88%B8%E7%92%B0%E5%A5%88"
        self._serve(self.search, SEARCH_PAGE)
        for actor_id in ("Kn01", "Kn02", "Tw01", "Tw02"):
            self._serve(f"https://javdb.com/actors/{actor_id}", JAVDB_PAGE)

    def _serve(self, url, html):
        self.transport.responses[url] = HttpResponse(
            200, {"Content-Type": "text/html"}, html.encode("utf-8"), url)

    def _lookup(self, name="瀬戸環奈"):
        return dispatch_api_get(self.contract, "/api/feeds/lookup", {"q": name})

    def _follow(self, ids, name="瀬戸環奈"):
        return dispatch_api_post(self.contract, "/api/feeds/source",
                                 {"action": "follow-name", "name": name, "ids": ids})

    def _entity(self, entity_id):
        with self.contract.database.read_connection() as connection:
            row = connection.execute(
                "SELECT canonical_name,metadata_json FROM entity WHERE id=?", (entity_id,)).fetchone()
            refs = connection.execute(
                "SELECT external_id,metadata_json FROM entity_external_ref WHERE entity_id=?"
                " AND provider='javdb' ORDER BY external_id", (entity_id,)).fetchall()
        return row, refs


class FeedFollowByNameTest(FeedFollowByNameFixture):
    """订阅源页签「添加 JAV 订阅」：按名字搜演员卡，勾选后登记到她名下并订上（ADR-0083）。"""

    def test_lookup_lists_every_card_and_only_pre_picks_the_one_person_matching_the_name(self):
        result = self._lookup()
        self.assertEqual(result["url"], self.search)
        self.assertEqual([card["id"] for card in result["candidates"]], ["Kn01", "Kn02", "Zz99"])
        first = result["candidates"][0]
        self.assertEqual(first["names"], ["瀬戸環奈", "瀨戶環奈", "濑户环奈"])
        self.assertEqual(first["url"], "https://javdb.com/actors/Kn01")
        self.assertEqual(result["candidates"][1]["record"], "無碼")
        # 有碼与無碼各一张，是同一个人；别人那张不在预勾里。
        self.assertEqual(result["suggested"], ["Kn01", "Kn02"])
        # 账本里还没有她：既没人持有这些 id，名字也对不上谁。
        self.assertIsNone(first["held_by"])
        self.assertEqual(first["matched"], [])
        self.assertIsNone(result["known"])
        self.assertEqual(self.transport.requests[-1].url, self.search)

    def test_lookup_tells_who_already_holds_the_card_and_whose_name_it_matches(self):
        held = self._performer("瀬戸環奈", ["Kn01"])
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO entity_alias(entity_id,alias,normalized_alias,source)"
                " VALUES(?,'濑户环奈',peach_normalize('濑户环奈'),'test')", (held,))
        result = self._lookup()
        first, second = result["candidates"][:2]
        self.assertEqual(result["known"], {"id": held, "name": "瀬戸環奈", "subscribable": True, "following": False})
        self.assertEqual(first["held_by"], {"id": held, "name": "瀬戸環奈"})
        self.assertIsNone(second["held_by"])
        # 无码那张卡上只有正名，也对得上她；别名撞上的写法只报一次。
        self.assertEqual(first["matched"], [{"id": held, "name": "瀬戸環奈"}])
        self.assertEqual(second["matched"], [{"id": held, "name": "瀬戸環奈"}])

    def test_lookup_does_not_pre_pick_when_the_site_has_two_people_with_that_name(self):
        self._serve(self.search, TWINS_PAGE)
        result = self._lookup()
        self.assertEqual([card["id"] for card in result["candidates"]], ["Tw01", "Tw02"])
        self.assertEqual(result["suggested"], [])

    def test_lookup_refuses_a_login_page_and_an_empty_name(self):
        self._serve(self.search, LOGIN_PAGE)
        with self.assertRaisesRegex(ValueError, "登入页"):
            self._lookup()
        with self.assertRaises(ValueError):
            self._lookup("  ")

    def test_a_known_performer_with_an_id_can_be_followed_when_javdb_cannot_search(self):
        """反馈「订阅女优搜不到」：JavDB 冷却或回登入页时，库里已有编号的她照样能订。"""
        self._serve(self.search, LOGIN_PAGE)
        held = self._performer("瀬戸環奈", ["Kn01"])
        result = self._lookup()
        self.assertEqual((result["candidates"], result["suggested"]), ([], []))
        self.assertEqual(result["known"], {"id": held, "name": "瀬戸環奈", "subscribable": True, "following": False})
        self.assertRegex(result["unavailable"], "登入页")
        # 库里认得出、却没有任何编号的，仍然要靠搜索，搜不成就照旧报错。
        with self.contract.database.write_transaction() as connection:
            connection.execute("DELETE FROM entity_external_ref WHERE entity_id=?", (held,))
        with self.assertRaisesRegex(ValueError, "登入页"):
            self._lookup()

    def test_following_an_unknown_name_creates_her_binds_the_cards_and_subscribes_now(self):
        result = self._follow(["Kn01", "Kn02"])
        self.assertTrue(result["created"])
        self.assertEqual(result["entity_name"], "瀬戸環奈")
        row, refs = self._entity(result["entity_id"])
        self.assertEqual(row["canonical_name"], "瀬戸環奈")
        self.assertEqual(json.loads(row["metadata_json"])["source"], web_feeds.FOLLOW_SOURCE)
        self.assertEqual([ref["external_id"] for ref in refs], ["Kn01", "Kn02"])
        self.assertEqual(json.loads(refs[0]["metadata_json"])["source"], web_feeds.FOLLOW_SOURCE)
        # 两个演员页各一条源，全部启用、挂在她名下，当场拉了一趟。
        self.assertEqual(sorted(source["url"] for source in self._sources()),
                         ["https://javdb.com/actors/Kn01", "https://javdb.com/actors/Kn02"])
        self.assertTrue(all(source["entity_id"] == result["entity_id"] for source in self._sources()))
        self.assertEqual(self._settled()["added"], 2)
        # 新建的是零作品实体：她的资料页打得开，但作品索引里还没有她。
        profile = dispatch_api_get(self.contract, "/api/entity",
                                   {"kind": "performer", "name": "瀬戸環奈"})
        self.assertEqual(profile["feed"], {"following": True})

    def test_following_a_known_name_binds_to_her_instead_of_making_a_second_person(self):
        known = self._performer("瀬戸環奈", [])
        result = self._follow(["Kn01"])
        self.assertFalse(result["created"])
        self.assertEqual(result["entity_id"], known)
        _row, refs = self._entity(known)
        self.assertEqual([ref["external_id"] for ref in refs], ["Kn01"])
        self._settled()

    def test_a_card_already_held_wins_over_the_typed_name(self):
        holder = self._performer("瀬戸かんな", ["Kn01"])
        result = self._follow(["Kn01", "Kn02"], name="瀬戸環奈")
        self.assertEqual((result["entity_id"], result["entity_name"], result["created"]),
                         (holder, "瀬戸かんな", False))
        _row, refs = self._entity(holder)
        self.assertEqual([ref["external_id"] for ref in refs], ["Kn01", "Kn02"])
        self._settled()

    def test_cards_held_by_two_different_people_are_refused_by_name(self):
        self._performer("甲", ["Kn01"])
        self._performer("乙", ["Kn02"])
        with self.assertRaisesRegex(ValueError, "甲、乙"):
            self._follow(["Kn01", "Kn02"])
        self.assertEqual(self._sources(), [])

    def test_following_needs_a_name_and_well_formed_card_ids(self):
        with self.assertRaises(ValueError):
            self._follow(["Kn01"], name="")
        with self.assertRaises(ValueError):
            self._follow([])
        with self.assertRaises(ValueError):
            self._follow(["../Kn01"])
        self.assertEqual(self._sources(), [])


class PerformerPageFollowTest(FeedFollowByNameFixture):
    """用户脚本女优页上的「订阅新作」：先按页面地址里的站内编号认人，只有名字的页去 JavDB 确认。"""

    JAVDB = "https://javdb.com/actors/Kn01"
    DMM = "https://video.dmm.co.jp/av/list/?actress=1061586"
    MISSAV = "https://missav.ws/dm127/cn/actresses/" + "%E7%80%AC%E6%88%B8%E7%92%B0%E5%A5%88"

    def _status(self, url, names=()):
        return performer.performer_status(self.contract, None, url, names)

    def _page_follow(self, url, enabled=True, names=()):
        return performer.follow_performer(self.contract, None,
                                          {"source_url": url, "enabled": enabled, "names": list(names)})

    def test_the_page_address_names_the_site_id_or_the_name(self):
        self.assertEqual(performer.performer_page(self.JAVDB, ["瀬戸環奈, 瀨戶環奈"]),
                         {"site": "javdb", "javdb": "Kn01", "dmm": "", "names": ["瀬戸環奈", "瀨戶環奈"]})
        for url in (self.DMM, "https://www.dmm.co.jp/digital/videoa/-/list/=/article=actress/id=1061586/"):
            with self.subTest(url=url):
                self.assertEqual(performer.performer_page(url)["dmm"], "1061586")
        self.assertEqual(performer.performer_page(
            "https://missav.ws/cn/actresses/" + "%E6%A3%AE%E6%B2%A2%E3%81%8B%E3%81%AA%EF%BC%88%E9%A3%AF%E5%B2%A1%E3%81%8B%E3%81%AA%E3%81%93%EF%BC%89")["names"],
                         ["森沢かな", "飯岡かなこ"])
        for url in ("https://javdb.com/v/WM9m8", "https://video.dmm.co.jp/av/list/?actress=abc",
                    "https://missav.ws/cn/ssis-057", "https://example.com/actors/Kn01", "http://javdb.com/actors/Kn01"):
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, "不是支持的女优页"):
                performer.performer_page(url)

    def test_a_held_javdb_id_names_her_and_switches_her_subscription(self):
        held = self._performer("瀬戸かんな", ["Kn01"])
        status = self._status(self.JAVDB, ["瀬戸環奈"])
        self.assertEqual((status["name"], status["entity_id"], status["following"]), ("瀬戸かんな", held, False))
        self.assertTrue(self._page_follow(self.JAVDB)["following"])
        self._settled()
        self.assertFalse(self._page_follow(self.JAVDB, enabled=False)["following"])

    def test_an_unknown_javdb_page_creates_her_from_the_page_name_and_binds_the_id(self):
        status = self._page_follow(self.JAVDB, names=["瀬戸環奈, 瀨戶環奈"])
        self.assertEqual((status["name"], status["following"]), ("瀬戸環奈", True))
        _row, refs = self._entity(status["entity_id"])
        self.assertEqual([ref["external_id"] for ref in refs], ["Kn01"])
        self._settled()

    def test_an_unknown_dmm_page_asks_dmm_for_her_name_and_subscribes_her_catalogue(self):
        with patch.object(performer, "_dmm_name", return_value="森日向子") as asked, \
                patch.object(web_feeds, "fetch_new_sources"):
            status = self._page_follow(self.DMM)
        asked.assert_called_once()
        self.assertEqual((status["name"], status["following"]), ("森日向子", True))
        [source] = [row for row in self._sources() if row["entity_id"] == status["entity_id"]]
        self.assertEqual(source["url"], feeds.dmm_actress_url("1061586"))
        # 再来一次就按编号认出她，不再问 DMM。
        with patch.object(performer, "_dmm_name") as again:
            self.assertEqual(self._status(self.DMM)["entity_id"], status["entity_id"])
        again.assert_not_called()

    def test_a_name_only_page_follows_her_once_javdb_confirms_one_person(self):
        status = self._page_follow(self.MISSAV)
        self.assertEqual((status["name"], status["following"]), ("瀬戸環奈", True))
        _row, refs = self._entity(status["entity_id"])
        self.assertEqual([ref["external_id"] for ref in refs], ["Kn01", "Kn02"])
        self._settled()

    def test_a_name_only_page_refuses_when_javdb_has_two_people_or_cannot_search(self):
        for page, reason in ((TWINS_PAGE, "没能确认是同一位女优"), (LOGIN_PAGE, "登入页")):
            with self.subTest(reason=reason):
                self._serve(self.search, page)
                with self.assertRaisesRegex(ValueError, reason):
                    self._page_follow(self.MISSAV)
        self.assertEqual(self._sources(), [])
        self.assertEqual((self._status(self.MISSAV)["entity_id"], self._status(self.MISSAV)["name"]),
                         (None, "瀬戸環奈"))

    def test_a_known_name_with_an_id_is_followed_without_searching(self):
        self._serve(self.search, LOGIN_PAGE)
        held = self._performer("瀬戸環奈", ["Kn01"])
        self.assertEqual(self._page_follow(self.MISSAV)["entity_id"], held)
        self.assertTrue(all(request.url != self.search for request in self.transport.requests))
        self._settled()


class JavDiscoveryTest(FeedWebFixture):
    def test_discovery_cast_projects_canonical_names_and_preserves_unknown_names(self):
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            eid = connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','筱田优','筱田优',?,?)", (feeds.stamp(), feeds.stamp())).lastrowid
            connection.execute("INSERT INTO entity_alias(entity_id,alias,normalized_alias,source) VALUES(?,?,?,'test')",
                               (eid, '篠田ゆう', '篠田ゆう'))
            connection.execute("UPDATE feed_discovery SET performers='篠田ゆう、筱田优、未知人物',studio='示例厂牌'")
        rankings = {'peach_studios': [{'name': '示例厂牌', 'score': 4}]}
        for metadata in ({}, {'actors': [{'name': '篠田ゆう'}, {'name': '筱田优'}, {'name': '未知人物'}]}):
            with self.subTest(source=bool(metadata)):
                rows = self._discover(rankings=rankings, metadata=metadata)['items']
                self.assertEqual(len(rows), 2)
                for row in rows:
                    self.assertEqual(row['performers'], '筱田优、未知人物')
                    self.assertEqual([ref['name'] for ref in row['performer_refs']], ['筱田优', '未知人物'])
                    self.assertEqual(row['performer_refs'][0]['id'], eid)
        with self.contract.database.read_connection() as connection:
            self.assertEqual({row[0] for row in connection.execute('SELECT performers FROM feed_discovery')},
                             {'篠田ゆう、筱田优、未知人物'})

    def test_source_cast_uses_female_and_unknown_references_without_male_features(self):
        self._add()
        self._check()
        result = self._discover(metadata={'actors': [
            {'id': 'Actor1', 'name': '示例女优', 'gender': 0, 'has_avatar': True},
            {'id': 'Actor2', 'name': '示例男优', 'gender': 1},
            {'id': 'Actor3', 'name': '未分类人物'}]})
        for item in result['items']:
            self.assertEqual(item['performers'], '示例女优、未分类人物')
            self.assertEqual([ref['name'] for ref in item['performer_refs']], ['示例女优', '未分类人物'])
            self.assertTrue(item['performer_refs'][0]['source_avatar'])
            self.assertFalse(any('示例男优' in reason for reason in item['reasons']))

    def test_persistent_metadata_supplies_canonical_filters_and_sort_values_without_detail(self):
        from peach import web_jav_discovery
        from peach.jav_discovery_metadata import discovery_metadata
        self._add()
        self._check()
        metadata = discovery_metadata(self.contract)
        with self.contract.database.read_connection() as connection:
            codes = [row[0] for row in connection.execute("SELECT code FROM feed_discovery ORDER BY id")]
        for code, score in zip(codes, (None, "4.23")):
            metadata.remember(code, {"number": code, "tags": [{"name": "中出"}], "score": score, "duration": 180})
        with patch.object(web_jav_discovery, "preference_profile", return_value=self._preference_fixture(
                {"browser_tags": [{"name": "中出内射", "score": 4}]})), \
                patch("peach.javdb_public.PUBLIC_API.movie") as movie:
            result = web_jav_discovery.q_jav_discoveries(self.contract, {"sort": "source_score"})
        movie.assert_not_called()
        self.assertIsNone(metadata.job.thread, "GET 只读，不起外网任务")
        self.assertEqual([row["source_score"] for row in result["items"]], [4.23, None])
        self.assertTrue(all(row["tags"] == ["中出内射"] for row in result["items"]))
        self.assertTrue(all(row["duration"] == 10800 for row in result["items"]))
        self.assertEqual(result["ranking_method"], "field-sort")
        self.assertEqual([row["rank"] for row in result["items"]], [1, 2])
        self.assertTrue(all(row["taste_score"] == row["score"] for row in result["items"]))

    def test_discovery_scoring_is_cached_until_its_inputs_change(self):
        """任务进行中页面会反复来取；打分只在账本、口味库或资料边车变了之后重算。"""
        from peach import web_jav_discovery
        from peach.jav_discovery_metadata import discovery_metadata
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET studio='示例厂牌'")
        fixture = self._preference_fixture({"peach_studios": [{"name": "示例厂牌", "score": 4}]})
        with patch.object(web_jav_discovery, "preference_profile", return_value=fixture) as profile:
            first = web_jav_discovery.q_jav_discoveries(self.contract, {})
            again = web_jav_discovery.q_jav_discoveries(self.contract, {})
            self.assertEqual(profile.call_count, 1)
            self.assertEqual([row["id"] for row in again["items"]], [row["id"] for row in first["items"]])
            code = first["items"][0]["code"]
            discovery_metadata(self.contract).remember(code, {"number": code, "tags": [{"name": "中出"}]})
            web_jav_discovery.q_jav_discoveries(self.contract, {})
            self.assertEqual(profile.call_count, 2, "资料边车变了要重算")

    def test_metadata_reading_starts_from_post_and_progress_is_read_alone(self):
        """GET 不起任务；页面用 POST 起、停，进度单独轮询，不再整页重取。"""
        from peach import web_jav_discovery
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET studio='示例厂牌'")
        fixture = self._preference_fixture({"peach_studios": [{"name": "示例厂牌", "score": 4}]})
        started = {"job_id": "batch", "status": "running", "completed": 0, "total": 2, "failed": 0,
                   "requests": 0, "bytes": 0, "codes": ["X"]}
        with patch.object(web_jav_discovery, "preference_profile", return_value=fixture), \
                patch("peach.jav_discovery_metadata.DiscoveryMetadata.ensure", return_value=started) as ensure:
            listing = web_jav_discovery.q_jav_discoveries(self.contract, {})
            ensure.assert_not_called()
            response = web_jav_discovery.w_jav_discovery_metadata(self.contract, {"action": "refresh"})
        self.assertEqual(sorted(ensure.call_args.args[0]), sorted(row["code"] for row in listing["items"]))
        self.assertTrue(ensure.call_args.kwargs["refresh"])
        self.assertEqual(response["metadata_job"]["status"], "running")
        self.assertNotIn("codes", response["metadata_job"])
        with patch("peach.jav_discovery_metadata.DiscoveryMetadata.current", return_value=started), \
                patch.object(web_jav_discovery, "_ranked", side_effect=AssertionError("进度轮询不打分")):
            progress = web_jav_discovery.q_jav_discovery_metadata(self.contract, {})
        self.assertEqual(progress["metadata_job"]["job_id"], "batch")
        self.assertEqual(progress["poll_after_ms"], 3000)
        with self.assertRaises(ValueError):
            web_jav_discovery.w_jav_discovery_metadata(self.contract, {"action": "delete"})

    def test_releases_page_by_date_and_facets_come_only_from_unowned_releases(self):
        from peach import web_jav_discovery
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute("INSERT INTO feed_discovery(code,release_date,discovered_at) VALUES('OWN-001','2026-09-25','t')")
            connection.execute("INSERT INTO asset(location,path,name,medium,code) VALUES('local','x.mp4','x.mp4','video','OWN-001')")
        movies = {"SSIS-950": {"actors": [{"name": "女优甲"}], "tags": [{"name": "中出"}], "maker_name": "厂牌甲",
                               "score": "3.5", "duration": 120},
                  "HMN-071": {"actors": [{"name": "女优乙"}], "tags": [], "maker_name": "厂牌乙", "score": "4.5"},
                  "OWN-001": {"actors": [{"name": "馆藏女优"}], "tags": [{"name": "巨乳"}], "maker_name": "馆藏厂牌"}}

        reads = []

        def releases(handler=web_jav_discovery.q_jav_releases, **args):
            with patch.object(web_jav_discovery, "_cached_movie", side_effect=lambda code, contract: movies.get(code, {})), \
                    patch("peach.jav_discovery_metadata.DiscoveryMetadata.ensure",
                          side_effect=lambda codes, **options: reads.append((codes, options))):
                return handler(self.contract, args)

        every = releases()
        self.assertEqual(reads, [], "列表只读，不起资料读取")
        self.assertEqual(every["metadata_unread"], 2)
        releases(web_jav_discovery.w_jav_release_metadata, action="start", performer="女优乙")
        self.assertEqual(reads, [(["HMN-071"], {"refresh": True})],
                         "「读取资料」只读当前筛选结果里从没读过来源资料的那几部")
        self.assertEqual(([row["code"] for row in every["items"]], every["total"]), (["SSIS-950", "HMN-071"], 2))
        self.assertEqual([(ref["name"], ref["count"]) for ref in every["facets"]["performers"]], [("女优乙", 1), ("女优甲", 1)])
        self.assertEqual([ref["name"] for ref in every["facets"]["studios"]], ["厂牌乙", "厂牌甲"])
        self.assertEqual(every["facets"]["tags"], [{"name": "中出内射", "count": 1}])
        one = releases(performer="女优乙")
        self.assertEqual([row["code"] for row in one["items"]], ["HMN-071"])
        self.assertEqual(len(one["facets"]["performers"]), 2, "本维度不计，另一位女优照样能点")
        self.assertEqual(one["facets"]["tags"], [])
        second = releases(page=2, size=1)
        self.assertEqual(([row["code"] for row in second["items"]], second["total"], second["page"]), (["HMN-071"], 2, 2))
        self.assertEqual([row["code"] for row in releases(q="中出")["items"]], ["SSIS-950"])

        def order(**args):
            return [row["code"] for row in releases(**args)["items"]]

        self.assertEqual(order(sort="release_date", direction="asc"), ["HMN-071", "SSIS-950"])
        self.assertEqual(order(sort="source_score"), ["HMN-071", "SSIS-950"])
        self.assertEqual(order(sort="source_score", direction="asc"), ["SSIS-950", "HMN-071"])
        self.assertEqual(order(sort="duration", direction="asc"), ["SSIS-950", "HMN-071"], "没有时长的排在末尾，不随方向翻转")
        self.assertEqual(order(sort="duration"), ["SSIS-950", "HMN-071"])
        self.assertEqual(order(sort="random", seed="a"), order(sort="random", seed="a"), "同一个种子翻页时顺序不变")

    def _discover(self, scope="external", rankings=None, metadata=None, args=None):
        from peach import web_jav_discovery
        # 口味与来源资料在这里是换掉的函数，不经它们的版本；每次从头算，不读上一次的打分缓存。
        self.contract.cache.clear()
        with patch.object(web_jav_discovery, "preference_profile", return_value=self._preference_fixture(rankings or {})), \
                patch.object(web_jav_discovery, "_cached_movie", return_value=metadata or {}), \
                patch("peach.jav_discovery_metadata.DiscoveryMetadata.ensure", return_value=None):
            return web_jav_discovery.q_jav_discoveries(self.contract, {"scope": scope, **(args or {})})

    def _preference_fixture(self, rankings):
        from peach import web_jav_discovery
        from peach.taste_preferences import WEIGHTS
        strengths, names, evidence = ({kind: {} for kind in WEIGHTS} for _ in range(3))
        with self.contract.database.read_connection() as connection:
            for key, kind in (("peach_studios", "studio"), ("peach_tags", "tag"),
                              ("browser_tags", "tag"), ("peach_series", "series")):
                for row in rankings.get(key, ()):
                    eid = row.get("entity_id") or web_jav_discovery._identity(connection, kind, row["name"])
                    strengths[kind][eid] = .7
                    names[kind][eid] = row["name"]
                    evidence[kind][eid] = ["浏览记录" if key.startswith("browser") else "观看与反馈"]
        return strengths, names, evidence

    def test_taste_ascending_preserves_the_selection_and_scores(self):
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET studio='示例厂牌'")
        rankings = {"peach_studios": [{"name": "示例厂牌", "score": 4}]}
        descending = self._discover(rankings=rankings, args={"direction": "desc"})
        ascending = self._discover(rankings=rankings, args={"direction": "asc"})
        self.assertEqual(ascending["direction"], "asc")
        self.assertEqual(ascending["ranking_method"], "mmr")
        self.assertEqual([row["id"] for row in ascending["items"]],
                         [row["id"] for row in reversed(descending["items"])])
        self.assertEqual([row["rank"] for row in ascending["items"]], [1, 2])
        def score_fields(rows):
            return {row["id"]: (row["score"], row["taste_score"], row["ranking_score"]) for row in rows}
        self.assertEqual(score_fields(ascending["items"]), score_fields(descending["items"]))

    def test_external_discovery_includes_older_known_works_and_studio_matches(self):
        self._add()
        self._check()
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET release_date='2010-01-01',studio='示例厂牌'")
        result = self._discover(rankings={"peach_studios": [{"name": "示例厂牌", "score": 4}]})
        self.assertEqual(len(result["items"]), 2)
        self.assertTrue(all(row["release_date"] == "2010-01-01" for row in result["items"]))
        self.assertTrue(all(row["reasons"] == ["厂牌偏好：示例厂牌（观看与反馈）"] for row in result["items"]))
        self.assertEqual(self._discover()["items"], [])

    def test_external_discovery_projects_obtained_metadata_and_canonical_tags(self):
        self._add()
        self._check()
        rankings = {"browser_tags": [{"name": "恋足", "score": 4}],
                    "peach_series": [{"name": "示例系列", "score": 2}]}
        self.assertEqual(self._discover(rankings=rankings)["items"], [])
        rows = self._discover(rankings=rankings, metadata={"tags": [{"name": "恋足"}], "series_name": "示例系列"})["items"]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["tags"], ["恋足"])
        self.assertEqual(rows[0]["reasons"], ["标签偏好：恋足（浏览记录）", "系列偏好：示例系列（观看与反馈）"])

    def test_library_exploration_excludes_completed_disliked_and_frequently_watched(self):
        with self.contract.database.write_transaction() as connection:
            entity_id = connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('tag','恋足','恋足','2026-10-01','2026-10-01')").lastrowid
            for aid, plays, reached, feedback, disposal in (
                    (1, 0, 0, None, None), (2, 1, 10, None, None), (3, 1, 95, None, None),
                    (4, 2, 10, None, None), (5, 0, 0, 'dislike', None), (6, 0, 0, None, 'vanished')):
                connection.execute("INSERT INTO asset(id,location,path,name,medium,code,studio,duration,play_count,max_reached,feedback,disposal)"
                    " VALUES(?,'local',?,'示例作品','video',?,'示例厂牌',100,?,?,?,?)",
                    (aid, f"R:\\media\\SSIS-{aid:03d}.mp4", f"SSIS-{aid:03d}", plays, reached, feedback, disposal))
                connection.execute("INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(?,?,'tag','test')", (aid, entity_id))
        result = self._discover("library", {"peach_tags": [{"name": "恋足", "entity_id": entity_id, "score": 4}]})
        self.assertEqual({row["asset_id"] for row in result["items"]}, {1, 2})
        self.assertTrue(all(row["tags"] == ["恋足"] for row in result["items"]))
        self.assertTrue(all(row["reasons"] == ["标签偏好：恋足（观看与反馈）"] for row in result["items"]))


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
