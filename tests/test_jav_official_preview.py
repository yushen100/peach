"""官方预告的精确作品身份、地址边界、固定成功缓存和短期缺失缓存。"""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import httpx

from peach.http import HttpResponse
from peach.jav_official_preview import dmm_preview, dmm_preview_url, javdb_preview, prestige_preview
from peach.javdb_public import PublicAPI, PublicSourceUnavailable
from peach.preview_cache import PreviewCache
from peach.remote_media_cache import cache_for
from peach.web_jav_detail import q_jav_detail
from peach.web_state import WebContract
from support.ledger import fresh_ledger

UUID = '69fa4c03-103c-482e-aec5-14f971ba4d7d'
VIDEO = 'https://www.prestige-av.com/api/media/6/9/' + UUID + '.mp4'
DMM_VIDEO = 'https://cc3001.dmm.co.jp/pv/sample/1rctd007644k.mp4'


class OfficialPreviewTests(unittest.TestCase):
    def setUp(self):
        for name in ('dmm_preview', 'javdb_preview'):
            patcher = patch('peach.jav_official_preview.' + name, return_value='')
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_dmm_search_reuses_exact_identity_and_declared_preview(self):
        requests = []
        def transport(request, *_):
            body = json.loads(request.body)
            requests.append(body)
            if 'queryWord' in body['variables']:
                data = {'legacySearchPPV': {'result': {'contents': [{'id': '1rctd00765'}, {'id': '1rctd00764'}]}}}
            elif body['variables']['id'] == 'rctd00764':
                data = {'ppvContent': None}
            else:
                data = {'ppvContent': {'id': '1rctd00764', 'makerContentId': 'RCTD-764',
                                      'sample2DMovie': {'highestMovieUrl': DMM_VIDEO}}}
            return HttpResponse(200, {}, json.dumps({'data': data}).encode())
        self.assertEqual(dmm_preview('RCTD-764', Path('unused'), transport=transport), DMM_VIDEO)
        self.assertEqual([row['variables'].get('id') for row in requests], ['rctd00764', None, '1rctd00764'])
        self.assertIn('sample2DMovie', requests[-1]['query'])

    def test_dmm_rejects_identity_mismatch_and_unrecognised_preview_fields(self):
        item = {'id': 'rctd00764', 'makerContentId': 'RCTD-764', 'sample2DMovie': {'highestMovieUrl': DMM_VIDEO}}
        missing = dict(item)
        del missing['sample2DMovie']
        for value in [missing, {**item, 'id': 'another'}, {**item, 'makerContentId': 'RCTD-765'},
                      {**item, 'sample2DMovie': {'highestMovieUrl': 'https://private.invalid/sample.mp4'}}]:
            with self.subTest(value=value), self.assertRaises(PublicSourceUnavailable):
                dmm_preview('RCTD-764', Path('unused'), transport=Mock(return_value=HttpResponse(
                    200, {}, json.dumps({'data': {'ppvContent': value}}).encode())))
        self.assertEqual(dmm_preview('RCTD-764', Path('unused'), transport=Mock(return_value=HttpResponse(
            200, {}, json.dumps({'data': {'ppvContent': {**item, 'sample2DMovie': None}}}).encode()))), '')

    def test_dmm_media_boundary_rejects_credentials_fragments_and_other_hosts(self):
        # DMM 换过预告主机（cc3001 → tencc3001）：DMM 自己域名下的主机都认。
        for url in [DMM_VIDEO, DMM_VIDEO.replace('cc3001.', 'tencc3001.'),
                    'https://tencc3001.dmm.co.jp/pv/TXIzJDkq45zQjNREbc2UuietOP16/sqte738hhb.mp4']:
            with self.subTest(url=url):
                self.assertEqual(dmm_preview_url(url), url)
        for url in [DMM_VIDEO.replace('https:', 'http:'), DMM_VIDEO + '#fragment',
                    DMM_VIDEO.replace('dmm.co.jp', 'dmm.co.jp.evil.test'), DMM_VIDEO.replace('cc3001.dmm', 'evildmm'),
                    DMM_VIDEO.replace('cc3001.dmm.co.jp', 'dmm.co.jp'), DMM_VIDEO.replace('https://', 'https://user:pass@'),
                    DMM_VIDEO.replace('/pv/', '/pv/../'), DMM_VIDEO.replace('.mp4', '.jpg')]:
            with self.subTest(url=url):
                self.assertEqual(dmm_preview_url(url), '')

    def test_an_unrecognised_dmm_address_says_so_instead_of_asking_to_retry(self):
        """DMM 声明了预告、地址却不认时，原因不是网络：界面写出主机，日志留下原地址。"""
        item = {'id': 'rctd00764', 'makerContentId': 'RCTD-764',
                'sample2DMovie': {'highestMovieUrl': 'https://private.invalid/sample.mp4'}}
        transport = Mock(return_value=HttpResponse(200, {}, json.dumps({'data': {'ppvContent': item}}).encode()))
        with self.assertLogs('peach.jav_official_preview', 'WARNING') as logs, \
                self.assertRaises(PublicSourceUnavailable) as raised:
            dmm_preview('RCTD-764', Path('unused'), transport=transport)
        self.assertEqual((raised.exception.code, raised.exception.params),
                         ('errors.javOfficialPreview.dmmUnrecognized', {'host': 'private.invalid'}))
        self.assertIn('private.invalid', str(raised.exception))
        self.assertIn('https://private.invalid/sample.mp4', logs.output[0])

    def test_dmm_response_without_product_field_is_unavailable(self):
        with self.assertRaises(PublicSourceUnavailable):
            dmm_preview('RCTD-764', Path('unused'), transport=Mock(return_value=HttpResponse(200, {}, b'{"data": {}}')))

    def test_javdb_reads_only_the_matching_work_declared_dmm_video(self):
        html = ('<div class="panel-block"><strong>番號:</strong><span class="value">RCTD-764</span></div>'
                f'<video><source src="{DMM_VIDEO}"></video>')
        transport = Mock(return_value=HttpResponse(200, {}, html.encode()))
        self.assertEqual(javdb_preview('RCTD-764', 'ZN9Ad6', Path('unused'), transport=transport), DMM_VIDEO)
        self.assertEqual(transport.call_count, 1)
        with self.assertRaises(PublicSourceUnavailable):
            javdb_preview('RCTD-765', 'ZN9Ad6', Path('unused'), transport=transport)

    def test_javdb_can_identify_the_work_without_webui_identity(self):
        search = '<a href="/v/ZN9Ad6" class="box" title="来源作品"><strong>RCTD-764</strong></a>'
        detail = ('<div class="panel-block"><strong>番號:</strong><span class="value">RCTD-764</span></div>'
                  f'<video><source src="{DMM_VIDEO}"></video>')
        transport = Mock(side_effect=[HttpResponse(200, {}, search.encode()), HttpResponse(200, {}, detail.encode())])
        self.assertEqual(javdb_preview('RCTD-764', None, Path('unused'), transport=transport), DMM_VIDEO)
        self.assertEqual(transport.call_count, 2)

    def test_javdb_detail_page_waits_on_the_process_wide_javdb_interval(self):
        """资料处理刚问过 javdb.com，点开预告这一页排在同一条 3 秒队里，不另起一份间隔。"""
        from peach import library_processing
        from peach.scripting import HostLimiter

        now, slept = [50.0], []

        def sleep(delay):
            slept.append(delay)
            now[0] += delay

        shared = HostLimiter(library_processing.SOURCE_INTERVALS, default_interval=2.0,
                             clock=lambda: now[0], sleeper=sleep)
        html = ('<div class="panel-block"><strong>番號:</strong><span class="value">RCTD-764</span></div>'
                f'<video><source src="{DMM_VIDEO}"></video>')
        inner = Mock(return_value=HttpResponse(200, {}, html.encode()))
        with patch.object(library_processing, 'SOURCE_LIMITER', shared), \
                patch('peach.jav_official_preview.SourceTransport', return_value=inner):
            shared.wait('https://javdb.com/v/Other')
            self.assertEqual(javdb_preview('RCTD-764', 'ZN9Ad6', Path('unused')), DMM_VIDEO)
        self.assertEqual(slept, [3.0])
        inner.close.assert_called_once()

    def test_preview_source_order_and_webui_fallback(self):
        mirror = 'https://jdforrepam.com/api/v1/movies/ttm3u8/preview/sample/720p.m3u8'
        for dmm, javdb, expected in [(DMM_VIDEO, '', DMM_VIDEO), ('', DMM_VIDEO, DMM_VIDEO), ('', '', mirror),
                                     (PublicSourceUnavailable('errors.javOfficialPreview.dmmUnavailable'), '', mirror)]:
            with self.subTest(dmm=dmm, javdb=javdb), tempfile.TemporaryDirectory() as directory:
                root = Path(directory).resolve()
                contract = WebContract(fresh_ledger(root), cover_root=root / 'covers')
                self.addCleanup(contract.stop_background_jobs)
                api = PublicAPI()
                api.movie = Mock(return_value={'number': 'RCTD-764', 'id': 'ZN9Ad6', 'preview_video_url': mirror})
                with patch('peach.web_jav_detail.PUBLIC_API', api), \
                        patch('peach.jav_official_preview.dmm_preview', side_effect=dmm if isinstance(dmm, Exception) else None,
                              return_value=dmm) as official, \
                        patch('peach.jav_official_preview.javdb_preview', return_value=javdb) as page:
                    payload = q_jav_detail(contract, {'code': 'RCTD-764'})
                ref = payload['preview_video_url'].rsplit('/', 1)[-1]
                self.assertEqual(PreviewCache(cache_for(contract)).source('RCTD-764', ref)['url'], expected)
                official.assert_called_once()
                self.assertEqual(page.call_count, 0 if dmm == DMM_VIDEO else 1)

    def test_dmm_preview_cache_is_separate_and_rechecks_daily(self):
        now = [1791936000.0]
        api = PublicAPI(clock=lambda: now[0], wallclock=lambda: now[0])
        fetch = Mock(return_value=DMM_VIDEO)
        for _ in range(2):
            self.assertEqual(api.official_preview('RCTD-764', fetch, provider='dmm', released='2020-01-01')['url'], DMM_VIDEO)
        self.assertEqual(fetch.call_count, 1)
        now[0] += 86400
        api.official_preview('RCTD-764', fetch, provider='dmm', released='2020-01-01')
        self.assertEqual(fetch.call_count, 2)
        other = Mock(return_value=VIDEO)
        self.assertEqual(api.official_preview('RCTD-764', other, provider='prestige')['url'], VIDEO)
        other.assert_called_once()

    def test_official_preview_is_available_when_webui_metadata_is_unavailable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            contract = WebContract(fresh_ledger(root), cover_root=root / 'covers')
            self.addCleanup(contract.stop_background_jobs)
            api = PublicAPI()
            api.movie = Mock(side_effect=PublicSourceUnavailable('errors.javdbPublic.unavailable'))
            with patch('peach.web_jav_detail.PUBLIC_API', api), \
                    patch('peach.jav_official_preview.dmm_preview', return_value=DMM_VIDEO):
                payload = q_jav_detail(contract, {'code': 'RCTD-764'})
            self.assertEqual(payload['state'], 'partial')
            self.assertEqual(payload['preview_state'], 'ready')
            self.assertTrue(payload['preview_video_url'].startswith('/jav-preview/RCTD-764/'))

    def test_dmm_preview_precedes_webui(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            contract = WebContract(fresh_ledger(root), cover_root=root / 'covers')
            self.addCleanup(contract.stop_background_jobs)
            api = PublicAPI()
            api.movie = Mock(return_value={'number': 'RCTD-764', 'id': 'ZN9Ad6', 'maker_name': 'ROCKET',
                'preview_video_url': 'https://jdforrepam.com/api/v1/movies/ttm3u8/preview/sample/720p.m3u8'})
            with patch('peach.web_jav_detail.PUBLIC_API', api), \
                    patch.object(api, 'official_preview', return_value={'url': DMM_VIDEO}) as official:
                payload = q_jav_detail(contract, {'code': 'RCTD-764'})
            ref = payload['preview_video_url'].rsplit('/', 1)[-1]
            self.assertEqual(PreviewCache(cache_for(contract)).source('RCTD-764', ref)['url'], DMM_VIDEO)
            self.assertEqual(official.call_args.kwargs['provider'], 'dmm')

    def transport(self, product):
        return Mock(side_effect=[HttpResponse(200, {}, json.dumps({'parentProduct': {'uuid': UUID}}).encode()),
                                 HttpResponse(200, {}, json.dumps(product).encode())])

    def product(self, **values):
        return {'uuid': UUID, 'sku': [{'deliveryItemId': 'EXM-001'}],
                'movie': {'path': '6/9/' + UUID + '.mp4', 'mimeType': 'video/mp4', 'isLimited': 0}, **values}

    def test_exact_sku_provides_declared_public_mp4_without_media_download(self):
        transport = self.transport(self.product())
        self.assertEqual(prestige_preview('EXM-001', Path('unused'), transport=transport), VIDEO)
        self.assertEqual(transport.call_count, 2)
        self.assertTrue(transport.call_args_list[0].args[0].url.endswith('/api/sku/item/EXM-001'))
        self.assertTrue(transport.call_args_list[1].args[0].url.endswith('/api/product/' + UUID))

    def test_undeclared_fields_wrong_identity_and_private_movies_are_unavailable(self):
        missing = self.product()
        del missing['movie']
        for product in [missing, self.product(uuid='another'), self.product(sku=[{'deliveryItemId': 'EXM-002'}]),
                        self.product(movie={'path': '../private.mp4', 'mimeType': 'video/mp4', 'isLimited': 0}),
                        self.product(movie={'path': '6/9/' + UUID + '.mp4', 'mimeType': 'video/mp4', 'isLimited': 1})]:
            with self.subTest(product=product), self.assertRaises(PublicSourceUnavailable):
                prestige_preview('EXM-001', Path('unused'), transport=self.transport(product))

    def test_source_absence_is_distinct_from_transport_failure(self):
        self.assertEqual(prestige_preview('EXM-001', Path('unused'), transport=self.transport(self.product(movie=None))), '')
        offline, slept = Mock(side_effect=httpx.ConnectError('offline')), []
        # 连接失败按网络退避重试后才认定来源不可用；退避只记下时长，不真睡。
        with patch('peach.jav_cover_fetch._sleep_within', side_effect=lambda delay, _: slept.append(delay)), \
                self.assertRaises(PublicSourceUnavailable):
            prestige_preview('EXM-001', Path('unused'), transport=offline)
        self.assertEqual(slept, [2, 4, 6, 8])
        self.assertEqual(offline.call_count, 5)

    def test_empty_preview_rechecks_daily_and_good_old_preview_survives_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            now = [1791936000.0]
            root = Path(directory).resolve()
            api = PublicAPI(cache_root=root, clock=lambda: now[0], wallclock=lambda: now[0])
            fetch = Mock(return_value='')
            self.assertEqual(api.official_preview('EXM-001', fetch, released='2020-01-01')['url'], '')
            api.official_preview('EXM-001', fetch, released='2020-01-01')
            self.assertEqual(fetch.call_count, 1)
            now[0] += 86400
            fetch.return_value = VIDEO
            self.assertEqual(api.official_preview('EXM-001', fetch, released='2020-01-01')['url'], VIDEO)
            self.assertEqual(fetch.call_count, 2)
            now[0] += 86400 * 400
            restarted = PublicAPI(cache_root=root, clock=lambda: now[0], wallclock=lambda: now[0])
            forbidden = Mock(side_effect=AssertionError('来源请求不可执行'))
            self.assertEqual(restarted.official_preview('EXM-001', forbidden)['url'], VIDEO)
            forbidden.assert_not_called()

    def test_detail_projects_official_mp4_and_preserves_movie_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            contract = WebContract(fresh_ledger(root), cover_root=root / 'covers')
            self.addCleanup(contract.stop_background_jobs)
            movie = {'number': 'EXM-001', 'id': 'Exact', 'maker_name': 'PRESTIGE,プレステージ',
                     'release_date': '2020-01-01', 'preview_video_url': None}
            api = PublicAPI()
            api.movie = Mock(return_value=movie)
            with patch('peach.web_jav_detail.PUBLIC_API', api), \
                    patch('peach.jav_official_preview.prestige_preview', return_value=VIDEO) as official:
                payload = q_jav_detail(contract, {'code': 'EXM-001'})
                again = q_jav_detail(contract, {'code': 'EXM-001'})
            self.assertEqual(payload['preview_state'], 'ready')
            self.assertEqual(payload['preview_video_url'], again['preview_video_url'])
            self.assertFalse(payload['preview_video_url'].endswith('.m3u8'))
            ref = payload['preview_video_url'].rsplit('/', 1)[-1]
            self.assertEqual(PreviewCache(cache_for(contract)).source('EXM-001', ref), {'url': VIDEO, 'playlist': False, 'media_type': 'video/mp4'})
            official.assert_called_once()
            self.assertEqual(movie['preview_video_url'], None)

    def test_failed_official_preview_keeps_detail_and_reports_retryable_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            contract = WebContract(fresh_ledger(root), cover_root=root / 'covers')
            self.addCleanup(contract.stop_background_jobs)
            api = PublicAPI()
            api.movie = Mock(return_value={'number': 'EXM-001', 'id': 'Exact', 'maker_name': 'Prestige'})
            with patch('peach.web_jav_detail.PUBLIC_API', api), \
                    patch('peach.jav_official_preview.prestige_preview', side_effect=PublicSourceUnavailable('errors.javOfficialPreview.officialUnavailable')):
                payload = q_jav_detail(contract, {'code': 'EXM-001'})
            self.assertEqual(payload['state'], 'ready')
            self.assertEqual(payload['preview_state'], 'unavailable')
            # 预告的原因单独给，页面写在预告本来的位置；资料那句只说资料。
            self.assertIn('官方视频预览未取得', payload['preview_message'])
            self.assertEqual(payload['message'], '')

    def test_a_preview_kept_from_an_earlier_fetch_and_a_missing_cover_say_only_what_is_missing(self):
        """预告这次没问到、沿用上次的地址时照样能播，资料那句不提它；没有封面时带上取图记录里的原因。"""
        from types import SimpleNamespace
        from peach import javdb_public

        def preview(contract, code, source, *, refresh=False):
            javdb_public._record_read('preview:dmm:EXM-001', SimpleNamespace(saved=0.0),
                                      PublicSourceUnavailable('errors.javOfficialPreview.dmmUnavailable'))
            return {'preview_video_url': '/jav-preview/EXM-001/ref', 'preview_state': 'ready'}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            contract = WebContract(fresh_ledger(root), cover_root=root / 'covers')
            self.addCleanup(contract.stop_background_jobs)
            attempts = root / 'feed-cover-attempts'
            attempts.mkdir()
            (attempts / 'EXM-001.json').write_text(json.dumps(
                {'code': 'EXM-001', 'ok': False, 'reason_code': 'errors.javCoverFetch.noCandidates', 'reason_params': {}}),
                encoding='utf-8')
            api = PublicAPI()
            api.movie = Mock(return_value={'number': 'EXM-001', 'id': 'Exact'})
            with patch('peach.web_jav_detail.PUBLIC_API', api), patch('peach.web_jav_detail._preview_fields', preview):
                payload = q_jav_detail(contract, {'code': 'EXM-001'})
        self.assertEqual((payload['message'], payload.get('cache_stale')), ('', None))
        self.assertEqual(payload['preview_state'], 'ready')
        self.assertEqual(payload['cover_message_code'], 'errors.javCoverFetch.noCandidates')

    def test_an_official_placeholder_is_not_shown_as_the_cover(self):
        """取图记录认出官方地址只有「准备中」占位图：详情不拿新作行上的那个地址当封面，改说原因。"""
        from peach import feeds
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            contract = WebContract(fresh_ledger(root), cover_root=root / 'covers')
            self.addCleanup(contract.stop_background_jobs)
            with contract.database.write_transaction() as connection:
                shell = feeds.create_shell(connection, 'EXM-001', source_id=None, title='示例作品')
                connection.execute("UPDATE feed_discovery SET cover_url=? WHERE id=?",
                                   ('https://pics.dmm.co.jp/digital/video/exm00001/exm00001pl.jpg', shell))
            attempts = root / 'feed-cover-attempts'
            attempts.mkdir()
            (attempts / 'EXM-001.json').write_text(json.dumps(
                {'code': 'EXM-001', 'ok': False, 'reason_code': 'errors.javCoverFetch.officialPlaceholderOnly',
                 'reason_params': {}}), encoding='utf-8')
            api = PublicAPI()
            api.movie = Mock(return_value={'number': 'EXM-001', 'id': 'Exact'})
            with patch('peach.web_jav_detail.PUBLIC_API', api), \
                    patch('peach.web_jav_detail._preview_fields', return_value={'preview_video_url': '', 'preview_state': 'missing'}):
                payload = q_jav_detail(contract, {'code': 'EXM-001'})
        self.assertEqual((payload['has_cover'], payload['cover_url']), (False, ''))
        self.assertEqual(payload['cover_message_code'], 'errors.javCoverFetch.officialPlaceholderOnly')

    def test_a_cooling_source_still_opens_the_detail_from_the_local_feed_row(self):
        """JavDB 在冷却：详情照样打开，片名、演员取本机新作行，资料那句说来源暂停，不是整页失败。"""
        from contextlib import nullcontext
        from peach import feeds
        from peach.scraping_access import SourcePaused

        def cooling(path):
            raise SourcePaused('errors.scrapingAccess.coolingDown')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            contract = WebContract(fresh_ledger(root), cover_root=root / 'covers')
            self.addCleanup(contract.stop_background_jobs)
            with contract.database.write_transaction() as connection:
                shell = feeds.create_shell(connection, 'EXM-001', source_id=None, title='示例作品')
                connection.execute("UPDATE feed_discovery SET performers=? WHERE id=?", ('示例演员', shell))
            api = PublicAPI()
            api.login_until = api.clock() + 3600
            with patch('peach.web_jav_detail.PUBLIC_API', api), \
                    patch('peach.web_jav_detail._jav_pages', return_value=nullcontext(cooling)), \
                    patch('peach.web_jav_detail._preview_fields', return_value={'preview_video_url': '', 'preview_state': 'missing'}):
                payload = q_jav_detail(contract, {'code': 'EXM-001'})
        self.assertEqual((payload['ok'], payload['state'], payload['title']), (True, 'partial', '示例作品'))
        self.assertEqual(payload['performers'], '示例演员')
        self.assertTrue(payload['message'])
