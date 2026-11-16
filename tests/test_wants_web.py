"""「想要」的接口与入口：清单读写、Feed 卡与关注条目上的想要、互斥、取资料任务（ADR-0090）。"""
from __future__ import annotations

import io
import json
import sys
import tempfile
import traceback
import unittest
from unittest.mock import Mock, patch
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from peach import feed_followup, wants, web_wants  # noqa: E402
from peach.web_contract import WebContract  # noqa: E402
from peach.web_router import dispatch_api_get, dispatch_api_post  # noqa: E402
from peach.user_messages import UserValueError
from support.ledger import fresh_ledger  # noqa: E402


class MagnetLookupTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.items = [{'protocol': 'magnet', 'uri': 'magnet:?xt=urn:btih:' + 'a' * 40,
                       'size': '4 GB', 'attributes': [], 'name': 'DEMO-001'}]

    def test_saved_resources_are_read_while_another_title_owns_the_search_lock(self):
        from peach.wants_magnets import MagnetSearch
        from unittest.mock import Mock
        fetcher = Mock(return_value={'items': self.items})
        search = MagnetSearch(self.root, fetcher=fetcher)
        found = search.query('DEMO-001')
        with search.lock:
            self.assertEqual(search.query('demo-001'), found)
            refreshing = search.query('DEMO-001', refresh=True)
            self.assertEqual(refreshing['state'], 'busy')
            self.assertEqual(refreshing['items'], found['items'])
        self.assertEqual(fetcher.call_count, 1)

    def test_old_partial_failure_is_refetched_while_its_magnets_remain_settlement_evidence(self):
        from peach.wants_magnets import MagnetSearch
        now = 1_800_000_000.0
        path = self.root / 'cache/want-resources.json'
        path.parent.mkdir()
        path.write_text(json.dumps({'version': 1, 'entries': [{'code': 'DEMO-001', 'saved': now - 3600,
            'result': {'state': 'ready', 'items': self.items, 'warnings': ['JavDB：未取得']}}]}), encoding='utf-8')
        fetcher = Mock(return_value={'items': self.items, 'complete': True})
        search = MagnetSearch(self.root, fetcher=fetcher, wallclock=lambda: now)
        self.assertIsNotNone(search.known_candidate('DEMO-001'))
        self.assertEqual(search.query('DEMO-001')['items'], self.items)
        fetcher.assert_called_once()
        self.assertEqual(json.loads(path.read_text(encoding='utf-8'))['version'], 2)

    def test_restart_keeps_resources_and_the_original_expiry(self):
        from peach.wants_magnets import MagnetSearch
        from unittest.mock import Mock
        now = [1_800_000_000.0]
        fetcher = Mock(return_value={'items': self.items})
        first = MagnetSearch(self.root, fetcher=fetcher, wallclock=lambda: now[0])
        result = first.query('OLD-001', released='2020-01-01')
        now[0] += 8 * 86400
        restarted = MagnetSearch(self.root, fetcher=fetcher, clock=lambda: 5.0, wallclock=lambda: now[0])
        self.assertEqual(restarted.query('OLD-001', released='2020-01-01'), result)
        self.assertEqual(fetcher.call_count, 1)
        now[0] += 358 * 86400
        expired = MagnetSearch(self.root, fetcher=fetcher, clock=lambda: 3.0, wallclock=lambda: now[0])
        expired.query('OLD-001', released='2020-01-01')
        self.assertEqual(fetcher.call_count, 1)

    def test_recent_titles_expire_after_one_day_across_restart(self):
        from peach.wants_magnets import MagnetSearch
        from unittest.mock import Mock
        now = [1_800_000_000.0]
        fetcher = Mock(return_value={'items': []})
        MagnetSearch(self.root, fetcher=fetcher, wallclock=lambda: now[0]).query('DEMO-001')
        now[0] += 86400 + 1
        MagnetSearch(self.root, fetcher=fetcher, wallclock=lambda: now[0]).query('DEMO-001')
        self.assertEqual(fetcher.call_count, 2)

    def test_failed_manual_refresh_preserves_successful_resources_on_disk(self):
        from peach.wants_magnets import MagnetSearch
        from unittest.mock import Mock
        fetcher = Mock(side_effect=[{'items': self.items}, ValueError('source failure')])
        search = MagnetSearch(self.root, fetcher=fetcher, sleeper=lambda seconds: None)
        result = search.query('DEMO-001')
        snapshot = search.path.read_bytes()
        failed = search.query('DEMO-001', refresh=True)
        self.assertEqual(failed['state'], 'error')
        self.assertEqual(failed['items'], result['items'])
        self.assertEqual(search.path.read_bytes(), snapshot)
        self.assertEqual(search.query('DEMO-001'), result)
        self.assertEqual(MagnetSearch(self.root, fetcher=fetcher).query('DEMO-001'), result)
        self.assertEqual(fetcher.call_count, 2)

    def test_invalid_saved_records_do_not_prevent_resource_search(self):
        from peach.wants_magnets import MagnetSearch
        from unittest.mock import Mock
        fetcher = Mock(return_value={'items': []})
        path = self.root / 'cache' / 'want-resources.json'
        path.parent.mkdir()
        for payload in ('{', json.dumps({'version': 1, 'entries': [{'code': 'DEMO-001',
                        'saved': float('inf'), 'result': {'state': 'ready', 'items': []}}]})):
            path.write_text(payload, encoding='utf-8')
            self.assertEqual(MagnetSearch(self.root, fetcher=fetcher).query('DEMO-001')['state'], 'ready')
        self.assertEqual(fetcher.call_count, 2)

    def test_resources_saved_by_older_versions_read_back_with_english_ids(self):
        from peach.wants_magnets import MagnetSearch
        from unittest.mock import Mock
        now = 1_800_000_000.0
        fetcher = Mock(return_value={'items': []})
        path = self.root / 'cache' / 'want-resources.json'
        path.parent.mkdir()
        legacy = [{**self.items[0], 'attributes': ['中字', '高清', '4K']},
                  {**self.items[0], 'protocol': 'url', 'uri': 'https://example.test/a', 'source': 'JavDB 评论'}]
        path.write_text(json.dumps({'version': 1, 'entries': [{'code': 'DEMO-001', 'saved': now - 60,
                        'result': {'state': 'ready', 'items': legacy}}]}, ensure_ascii=False), encoding='utf-8')
        items = MagnetSearch(self.root, fetcher=fetcher, wallclock=lambda: now).query(
            'DEMO-001', released='2020-01-01')['items']
        self.assertEqual(fetcher.call_count, 0)
        self.assertEqual(items[0]['attributes'], ['chinese-subtitles', 'high-definition', '4K'])
        self.assertEqual(items[1]['source'], 'javdb-comments')

    def test_expired_success_keeps_its_resources_and_uses_the_failure_cooldown(self):
        from peach.wants_magnets import MagnetSearch
        from unittest.mock import Mock
        now = [100.0]
        fetcher = Mock(side_effect=[{'items': self.items}, ValueError('source failure'), {'items': self.items}])
        search = MagnetSearch(self.root, fetcher=fetcher, clock=lambda: now[0], sleeper=lambda seconds: None)
        search.query('DEMO-001')
        now[0] += 7 * 86400 + 1
        failed = search.query('DEMO-001')
        self.assertEqual(failed['items'], self.items)
        self.assertEqual(search.query('DEMO-001'), failed)
        self.assertEqual(fetcher.call_count, 2)
        now[0] += 61
        self.assertEqual(search.query('DEMO-001')['state'], 'ready')
        self.assertEqual(fetcher.call_count, 3)

    def test_persistent_cache_keeps_the_most_recent_128_titles(self):
        from peach.wants_magnets import MagnetSearch
        from unittest.mock import Mock
        fetcher = Mock(return_value={'items': []})
        search = MagnetSearch(self.root, fetcher=fetcher, sleeper=lambda seconds: None)
        for number in range(129):
            search.query(f'DEMO-{number:03}')
        restarted = MagnetSearch(self.root, fetcher=fetcher)
        with restarted.lock:
            self.assertEqual(restarted.query('DEMO-128')['state'], 'ready')
            self.assertEqual(restarted.query('DEMO-000')['state'], 'busy')
        self.assertEqual(fetcher.call_count, 129)

    def test_cache_serializes_and_expires_without_mutating_ledger(self):
        from peach.wants_magnets import MagnetSearch
        calls = []
        now = [100.0]
        search = MagnetSearch(self.root, fetcher=lambda root, code: calls.append(code) or {"items": [], "warnings": []},
                              clock=lambda: now[0], sleeper=lambda seconds: None)
        self.assertEqual(search.query('DEMO-001')['state'], 'ready')
        search.query('DEMO-001')
        self.assertEqual(calls, ['DEMO-001'])
        now[0] += 7 * 86400 + 1
        search.query('DEMO-001')
        self.assertEqual(len(calls), 2)
        with search.lock:
            self.assertEqual(search.query('DEMO-002')['state'], 'busy')

    def test_release_age_controls_cache_and_manual_refresh_bypasses_it(self):
        from peach.wants_magnets import cache_lifetime, MagnetSearch
        today = date(2026, 10, 3)
        self.assertEqual(cache_lifetime('2026-09-03', today), 86400)
        self.assertIsNone(cache_lifetime('2026-09-02', today))
        self.assertEqual(cache_lifetime(None, today), 86400)
        self.assertEqual(cache_lifetime('2026-01-31', date(2026, 2, 28)), 86400)
        now, calls = [100.0], []
        search = MagnetSearch(self.root, fetcher=lambda root, code: calls.append(code) or {'items': []},
                              clock=lambda: now[0], sleeper=lambda seconds: None)
        search.query('OLD-001', released='2020-01-01')
        now[0] += 8 * 86400
        search.query('OLD-001', released='2020-01-01')
        self.assertEqual(len(calls), 1)
        search.query('OLD-001', released='2020-01-01', refresh=True)
        self.assertEqual(len(calls), 2)

    def test_failures_retry_after_one_minute(self):
        from peach.wants_magnets import MagnetSearch
        now, calls = [100.0], []
        def failed(root, code):
            calls.append(code)
            raise ValueError('failed')
        search = MagnetSearch(self.root, fetcher=failed, clock=lambda: now[0], sleeper=lambda seconds: None)
        search.query('OLD-001', released='2020-01-01')
        now[0] += 61
        search.query('OLD-001', released='2020-01-01')
        self.assertEqual(len(calls), 2)

    def test_source_failure_is_distinct_from_no_results(self):
        from peach.wants_magnets import MagnetSearch
        from peach.sources import SourceFailure, FailureReason
        def refused(root, code):
            raise SourceFailure(FailureReason.AUTH_REQUIRED, 'errors.javdb.loginRequired')
        result = MagnetSearch(self.root, fetcher=refused).query('DEMO-001')
        self.assertEqual(result['state'], 'error')
        self.assertIn('登录', result['error'])


class WantWebFixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.contract = WebContract(fresh_ledger(self.temporary.name))
        self.addCleanup(self.contract.stop_background_jobs)
        self.contract.followups.stop()
        self.contract.cover_root = Path(self.temporary.name).resolve() / "covers"
        self.contract.follow_secrets_root = Path(self.temporary.name).resolve() / 'secrets'
        detector = Mock()
        detector.detect.return_value = []
        self.enterContext(patch('peach.cover_artwork._default_detector', return_value=detector))
        # 图像扩展在测试线程初始化，后台等待只覆盖资料与封面任务。
        from peach.face_detect import decode
        try:
            decode(self._fetch_cover(self.contract, 'DEMO-001')[0])
        except ImportError:
            pass
        # 取资料与取图都替掉：番号是假的，配额是真的。
        self.collected: list[str] = []
        self.collect_misses: set[str] = set()
        original_collect, original_fetch = feed_followup.collect, feed_followup.fetch_cover
        feed_followup.collect = self._collect
        feed_followup.fetch_cover = self._fetch_cover
        self.addCleanup(lambda: setattr(feed_followup, "collect", original_collect))
        self.addCleanup(lambda: setattr(feed_followup, "fetch_cover", original_fetch))
        original_provider = web_wants._provider
        web_wants._provider = lambda contract: (lambda: None)
        self.addCleanup(lambda: setattr(web_wants, "_provider", original_provider))

    def test_resource_lookup_reads_only_eligible_wants(self):
        with self.contract.database.write_transaction() as connection:
            row = wants.add_code(connection, 'DEMO-001')
        with patch('peach.wants_magnets.search_for') as factory:
            factory.return_value.query.return_value = {"state": "ready", "items": []}
            from peach.scraping_access import sends_cookie
            def resource_result(*args, **kwargs):
                self.assertTrue(sends_cookie('javdb'))
                return {'state': 'ready', 'items': []}
            factory.return_value.query.side_effect = resource_result
            self.get('/api/wants/magnets', id=str(row['id']))
            factory.return_value.query.assert_called_once_with('DEMO-001', refresh=False, released=None)
            self.get('/api/wants/magnets', id=str(row['id']), refresh='1')
            factory.return_value.query.assert_called_with('DEMO-001', refresh=True, released=None)
            with self.contract.database.write_transaction() as connection:
                connection.execute("UPDATE want_item SET release_date='2999-01-01' WHERE id=?", (row['id'],))
            self.assertEqual(self.get('/api/wants/magnets', id=str(row['id']))['state'], 'unavailable')
            self.assertEqual(factory.return_value.query.call_count, 2)
        with self.assertRaises(ValueError):
            self.get('/api/wants/magnets', id='-1')
        with self.assertRaises(KeyError):
            self.get('/api/wants/magnets', id='999999')

    def test_cached_real_magnets_restore_given_up_wants_through_the_write_route(self):
        from peach.wants_magnets import search_for
        with self.contract.database.write_transaction() as connection:
            row = wants.add_code(connection, 'DEMO-001')
            missing = wants.add_code(connection, 'DEMO-002')
            for _ in range(3):
                wants.record_search(connection, row['id'], 'none')
        search = search_for(self.contract.follow_secrets_root)
        item = {'protocol': 'magnet', 'uri': 'magnet:?xt=urn:btih:' + 'a' * 40,
                'name': '论坛@546DEMO-001J', 'source': 'JavBus', 'source_url': 'https://www.javbus.com/DEMO-001',
                'size': '4 GB', 'attributes': []}
        with patch.object(search, 'fetcher', return_value={'items': [item]}) as fetcher:
            search.query('DEMO-001')
            result = self.post('/api/wants', {'action': 'found', 'ids': [row['id'], missing['id']]})
            self.assertEqual(result['affected'], 1)
            restored = next(item for item in self.get()['items'] if item['id'] == row['id'])
            self.assertEqual((restored['phase'], restored['search_count'], restored['last_search_outcome']), ('searching', 0, 'found'))
            self.assertEqual(self.post('/api/wants', {'action': 'found', 'ids': [row['id']]})['affected'], 0)
            self.assertEqual(fetcher.call_count, 1)

    def test_want_list_reports_known_magnets_without_searching_sources(self):
        from peach.wants_magnets import search_for
        with self.contract.database.write_transaction() as connection:
            wants.add_code(connection, 'DEMO-001')
            wants.add_code(connection, 'DEMO-002')
            wants.add_code(connection, 'DEMO-003')
        search = search_for(self.contract.follow_secrets_root)
        resources = {'items': [{'protocol': 'magnet', 'uri': 'magnet:?xt=urn:btih:' + 'a' * 40,
                                'size': '4 GB', 'attributes': []}]}
        with patch.object(search, 'fetcher', return_value=resources) as fetcher:
            search.query('DEMO-001')
            with patch.object(search, 'fetcher', return_value={'items': []}):
                search.sleeper = lambda seconds: None
                search.query('DEMO-002')
            values = {item['code']: item['has_magnets'] for item in self.get()['items']}
            self.assertEqual(values, {'DEMO-001': True, 'DEMO-002': False, 'DEMO-003': None})
            self.assertEqual(fetcher.call_count, 1)

    def _collect(self, provider, code):
        self.collected.append(code)
        if code in self.collect_misses:
            raise UserValueError("errors.feedFollowup.noMetadata", {"chain": "r18dev、javdb"})
        return ({"title": f"{code} 的标题", "studio": "示例厂牌", "release_date": "2026-09-20",
                 "performers": [{"name": "深田えいみ"}]}, "https://images.example.test/cover.jpg")

    def _fetch_cover(self, contract, code, cover_url=None):
        from PIL import Image
        buffer = io.BytesIO()
        Image.new("RGB", (800, 538), (40, 40, 40)).save(buffer, format="JPEG")
        return buffer.getvalue(), (800, 538), {"code": code, "source": "test"}

    def get(self, path="/api/wants", **args):
        return dispatch_api_get(self.contract, path, args)

    def post(self, path, body):
        return dispatch_api_post(self.contract, path, body)

    def settle(self):
        thread = self.contract.want_job.thread
        if thread is not None:
            thread.join(10)
            frame = sys._current_frames().get(thread.ident)
            self.assertFalse(thread.is_alive(), {
                'job': self.contract.want_job.snapshot(),
                'stack': ''.join(traceback.format_stack(frame)) if frame else '',
            })

    def execute(self, sql, params=()):
        with self.contract.database.write_transaction() as connection:
            connection.execute(sql, params)

    def shell(self, discovery_id=5, code="HMN-071", ignored=None):
        self.execute(
            "INSERT INTO feed_discovery(id,code,title,cover_url,release_date,discovered_at,scraped_at,ignored_at)"
            " VALUES(?,?,'作品标题','https://images.example.test/c.jpg','2026-09-20','x','x',?)",
            (discovery_id, code, ignored))

    def follow_item(self, item_id=9, status="new"):
        self.execute("INSERT OR IGNORE INTO follow_source(id,provider,ref,label,url,semantics,created_at,"
                     "updated_at) VALUES(2,'rule34video','r34/1','Creator','https://rule34video.com/u',"
                     "'work','x','x')")
        self.execute("INSERT INTO follow_item(id,source_id,external_id,title,url,media_url,release_key,"
                     "status,first_seen_at,last_seen_at) VALUES(?,2,?,'帖子标题',"
                     "'https://rule34video.com/video/9/x/','https://rule34video.com/get_file/9.mp4',"
                     "'r',?,'x','x')", (item_id, str(item_id), status))


class WantListTests(WantWebFixture):
    def test_a_missing_cover_is_counted_when_the_metadata_succeeds(self):
        with patch.object(feed_followup, 'ensure_cover', return_value=False):
            self.post('/api/wants', {'action': 'add', 'code': 'SSIS-952'})
            self.settle()
        summary = self.contract.task_runs.query(task_key='want-scrape')[0].result_summary
        self.assertEqual((summary['fetched'], summary['covers'], summary['incomplete']), (1, 0, 1))

    def test_adding_a_typed_code_fetches_its_details_and_cover(self):
        result = self.post("/api/wants", {"action": "add", "code": "ssis950"})
        self.settle()
        self.assertTrue(result["created"])
        self.assertEqual(self.collected, ["SSIS-950"])
        listed = self.get()
        item = listed["items"][0]
        self.assertEqual((item["code"], item["title"], item["studio"], item["performers"], item["phase"]),
                         ("SSIS-950", "SSIS-950 的标题", "示例厂牌", "深田えいみ", wants.SEARCHING))
        self.assertEqual((item["cover"], item["remote_cover"]), ("/cover?code=SSIS-950&thumb=1", False))
        self.assertTrue((self.contract.cover_root / "SSIS-950.jpg").is_file())
        self.assertEqual(self.contract.task_runs.query(task_key='want-scrape')[0].result_summary['incomplete'], 0)
        self.assertEqual(listed["counts"], {"searching": 1, "unreleased": 0, "given_up": 0, "acquired": 0})

    def test_a_failed_lookup_is_recorded_and_retried_only_after_the_interval(self):
        self.collect_misses.add("SSIS-951")
        self.post("/api/wants", {"action": "add", "code": "SSIS-951"})
        self.settle()
        item = self.get()["items"][0]
        self.assertEqual(item["scrape_error"], "来源链 r18dev、javdb 上都没有这个番号的资料")
        self.assertEqual(self.contract.task_runs.query(task_key='want-scrape')[0].result_summary['incomplete'], 1)
        with self.contract.database.read_connection() as connection:
            self.assertEqual(web_wants.backlog(connection, self.contract.cover_root), [])
            later = datetime.now(timezone.utc) + web_wants.RETRY_AFTER + timedelta(minutes=1)
            self.assertEqual(web_wants.backlog(connection, self.contract.cover_root, now=later), [item["id"]])

    def test_a_code_already_in_the_library_or_unreadable_text_is_refused(self):
        self.execute("INSERT INTO asset(id,location,path,name,medium,code) VALUES(1,'local','R:\\a.mp4',"
                     "'a.mp4','video','ABP-123')")
        with self.assertRaisesRegex(ValueError, "已经在库里"):
            self.post("/api/wants", {"action": "add", "code": "ABP-123"})
        with self.assertRaisesRegex(ValueError, "认不出番号"):
            self.post("/api/wants", {"action": "add", "code": "hello"})
        with self.assertRaisesRegex(ValueError, "unknown want action"):
            self.post("/api/wants", {"action": "drop", "ids": [1]})

    def test_remove_and_reset_act_on_the_listed_ids(self):
        first = self.post("/api/wants", {"action": "add", "code": "ABP-100"})["want"]["id"]
        second = self.post("/api/wants", {"action": "add", "code": "ABP-101"})["want"]["id"]
        self.settle()
        self.execute("UPDATE want_item SET state='given_up',search_count=3,given_up_at='x' WHERE id=?",
                     (second,))
        self.assertEqual(self.post("/api/wants", {"action": "reset", "ids": [second]})["affected"], 1)
        self.assertEqual(self.post("/api/wants", {"action": "remove", "ids": [first]})["affected"], 1)
        self.assertEqual([(item["id"], item["phase"], item["search_count"]) for item in self.get()["items"]],
                         [(second, wants.SEARCHING, 0)])

    def test_remove_and_reset_are_undone_from_the_receipt(self):
        first = self.post("/api/wants", {"action": "add", "code": "ABP-100"})["want"]["id"]
        second = self.post("/api/wants", {"action": "add", "code": "ABP-101"})["want"]["id"]
        self.settle()
        self.execute("UPDATE want_item SET state='given_up',search_count=3,given_up_at='x' WHERE id=?",
                     (second,))
        reset = self.post("/api/wants", {"action": "reset", "ids": [second]})
        removed = self.post("/api/wants", {"action": "remove", "ids": [first]})
        for receipt in (removed, reset):
            self.post("/api/wants", {"action": "restore", "rows": receipt["previous"]})
        listed = {item["id"]: item for item in self.get()["items"]}
        self.assertEqual(set(listed), {first, second}, "移除的那条按原 id 回来")
        self.assertEqual(listed[second]["search_count"], 3, "重置的计数原样写回")
        with self.assertRaises(ValueError):
            self.post("/api/wants", {"action": "restore", "rows": [{"code": "ABP-102"}]})


class ScheduledSearchTests(WantWebFixture):
    """定时查资源：按到期挑条目，查到与否按浏览器添加的番号判据，逐条记账，来源连续失败就歇。"""

    def wanted(self, *codes):
        # 查询换成按番号回答的假查询；只在本类的用例里换，基类继承来的资源查询用例照常走真的。
        self.results: dict[str, dict] = {}
        factory = self.enterContext(patch('peach.wants_magnets.search_for'))
        factory.return_value.query.side_effect = lambda code, refresh=False, released=None: self.results[code]
        factory.return_value.known_candidate.return_value = None
        with self.contract.database.write_transaction() as connection:
            return [wants.add_code(connection, code)['id'] for code in codes]

    def answer(self, code, state='ready', names=(), **extra):
        items = [{'protocol': 'magnet', 'uri': f'magnet:?xt=urn:btih:{index:040x}', 'name': name,
                  'size': '4 GB', 'attributes': []} for index, name in enumerate(names, 1)]
        self.results[code] = {'state': state, 'items': items, 'warnings': [], 'error': '',
                              'checked_at': datetime.now(timezone.utc).isoformat(), **extra}

    def run_round(self):
        started = web_wants.start_search(self.contract)
        thread = self.contract.want_search_job.thread
        if thread is not None:
            thread.join(10)
            self.assertFalse(thread.is_alive())
        return started

    def outcomes(self):
        with self.contract.database.read_connection() as connection:
            return dict(connection.execute(
                "SELECT code,last_search_outcome FROM want_item ORDER BY id").fetchall())

    def test_a_round_records_found_none_and_source_errors(self):
        self.wanted('DEMO-001', 'DEMO-002', 'DEMO-003')
        self.answer('DEMO-001', names=['[HD] DEMO-001.mp4'])
        self.answer('DEMO-002', names=['OTHER-999 完整版'])
        self.answer('DEMO-003', state='error', error='来源连接失败')
        self.assertIsNotNone(self.run_round())
        self.assertEqual(self.outcomes(), {'DEMO-001': 'found', 'DEMO-002': 'none', 'DEMO-003': 'error'})
        summary = self.contract.task_runs.query(task_key='want-search')[0].result_summary
        self.assertEqual((summary['found'], summary['none'], summary['failed']), (1, 1, 1))
        listed = {item['code']: item for item in self.get()['items']}
        self.assertEqual(listed['DEMO-001']['last_search_outcome'], 'found')
        self.assertFalse(self.get()['searching'])
        self.assertIsNone(self.run_round())

    def test_consecutive_source_failures_stop_the_round_and_pause_the_next(self):
        self.wanted('DEMO-011', 'DEMO-012', 'DEMO-013', 'DEMO-014')
        for code in ('DEMO-011', 'DEMO-012', 'DEMO-013', 'DEMO-014'):
            self.answer(code, state='error')
        self.run_round()
        self.assertEqual(self.outcomes(), {'DEMO-011': 'error', 'DEMO-012': 'error', 'DEMO-013': 'error',
                                           'DEMO-014': None})
        self.assertIsNone(self.run_round())
        self.contract.want_search_resume_at = 0
        self.answer('DEMO-014')
        self.run_round()
        self.assertEqual(self.outcomes()['DEMO-014'], 'none')

    def test_a_want_the_list_page_keeps_busy_is_left_for_the_next_round(self):
        self.wanted('DEMO-021')
        self.answer('DEMO-021', state='busy')
        result = web_wants.search(self.contract, sleep=lambda seconds: None)
        self.assertEqual((result['total'], result['none'], result['failed']), (1, 0, 0))
        self.assertEqual(self.outcomes(), {'DEMO-021': None})

    def test_the_scheduled_feed_tick_starts_the_search_even_without_due_sources(self):
        from peach import web_feeds
        with patch.object(web_wants, 'start_search') as start:
            self.assertTrue(web_feeds.w_feed_check(self.contract, {'automatic': True})['idle'])
            start.assert_called_once_with(self.contract)


class FeedEntryTests(WantWebFixture):
    def wanted(self):
        return {item["id"]: item["wanted"] for item in self.get("/api/feeds/discoveries", state="all")["items"]}

    def test_a_feed_card_can_be_wanted_and_unwanted(self):
        self.shell()
        self.assertEqual(self.wanted(), {5: False})
        self.post("/api/feeds/discovery", {"action": "want", "ids": [5]})
        self.settle()
        self.assertEqual(self.wanted(), {5: True})
        item = self.get()["items"][0]
        self.assertEqual((item["origin"], item["title"]), ("feed", "作品标题"))
        self.post("/api/feeds/discovery", {"action": "unwant", "ids": [5]})
        self.assertEqual(self.get()["items"], [])

    def test_ignoring_a_feed_card_drops_its_want_and_wanting_lifts_the_ignore(self):
        self.shell()
        self.post("/api/feeds/discovery", {"action": "want", "ids": [5]})
        self.post("/api/feeds/discovery", {"action": "ignore", "ids": [5]})
        self.assertEqual(self.get()["items"], [])
        self.post("/api/feeds/discovery", {"action": "want", "ids": [5]})
        self.settle()
        self.assertEqual(self.get("/api/feeds/discoveries", state="ignored")["items"], [])
        self.assertEqual(self.wanted(), {5: True})


class FollowEntryTests(WantWebFixture):
    def test_a_follow_item_can_be_wanted_and_ignoring_it_drops_the_want(self):
        self.follow_item(status="ignored")
        self.assertIsNone(self.get(follow="9")["want"])
        want = self.post("/api/wants", {"action": "add", "follow": 9})["want"]
        self.assertEqual((want["origin"], want["follow_item_id"], want["follow_provider"]),
                         ("follow", 9, "rule34video"))
        self.assertEqual(self.get(follow="9")["want"]["id"], want["id"])
        self.assertEqual([row["id"] for row in self.get(follow="abc")["items"]], [want["id"]])
        self.post("/api/follow/status", {"item": 9, "to": "ignored"})
        self.assertIsNone(self.get(follow="9")["want"])

    def test_saving_a_wanted_follow_item_marks_it_acquired(self):
        self.follow_item()
        self.post("/api/wants", {"action": "add", "follow": 9})
        saved = self.post("/api/follow/save", {"item": 9})
        item = self.get(follow="9")["want"]
        self.assertEqual((item["phase"], item["acquired_asset_id"]), (wants.ACQUIRED, saved["asset_id"]))


if __name__ == "__main__":
    unittest.main()
