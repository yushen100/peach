"""磁力抓取链的纯判据；不连接真实站点。"""
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

from peach.downloads import parse_magnet
from peach.magnet_chain import (CHAIN, _normalise, decode_base91, rank_candidates,
                                resolution_of, size_bytes)

HASH_A = "c9e15763f722f23e98a29decdfae341b98d53056"
HASH_B = "d9e15763f722f23e98a29decdfae341b98d53056"


def item(info_hash, **fields):
    return {
        "id": info_hash, "info_hash": info_hash,
        "uri": f"magnet:?xt=urn:btih:{info_hash}&dn=ABC-123",
        "name": "ABC-123", "size": 0, "size_text": "", "files": "",
        "file_count": 0, "file_list": [], "promo_files": 0,
        "resolution": 0, "codec": "", "seeders": 0, "peers": 0, "date": "",
        "chinese": False, "uncensored": False,
        "source": "test", "origins": ["test"], "source_url": "",
        "watermark_check": "pending", **fields,
    }


class MagnetChainTests(unittest.TestCase):
    def test_wishlist_preserves_comment_links_and_more_than_eight_source_versions(self):
        from peach.wants_magnets import fetch
        links = [dict(id=f'magnet:{index:040x}', protocol='magnet', info_hash=f'{index:040x}',
                      uri=f'magnet:?xt=urn:btih:{index:040x}', name='ABC-123', size='2 GB', files='',
                      date='', attributes=[], source='JavDB', source_url='https://example.test/work', origins=['JavDB'])
                 for index in range(10)]
        links.append({**links[0], 'id': 'ed2k:example', 'protocol': 'ed2k', 'info_hash': '',
                      'uri': 'ed2k://|file|ABC-123|1234|' + 'a' * 32 + '|/', 'source': 'javdb-comments'})
        direct = _normalise({'uri': item(HASH_A)['uri'], 'size': '8 GiB'}, CHAIN[0], 'ABC-123')
        with patch('peach.magnet_chain.search', return_value={'items': [direct], 'linked_resources': links}):
            shown = fetch(Path('.'), 'ABC-123')['items']
        self.assertEqual(len(shown), 12)
        self.assertEqual(shown[-1]['protocol'], 'ed2k')
        self.assertEqual(shown[0]['source'], 'manko.fun')

    def test_direct_add_stops_at_preferred_hd_but_wishlist_collects_other_sources(self):
        from peach.magnet_chain import Fetcher, search
        from peach.wants_magnets import fetch
        preferred = item(HASH_A, source='manko.fun', origins=['manko.fun'], resolution=1080)
        alternate = item(HASH_B, source='JavDB', origins=['JavDB'], resolution=2160)
        with patch.object(Fetcher, '__init__', return_value=None), patch.object(Fetcher, 'close'), \
                patch.object(Fetcher, 'manko', side_effect=lambda _: [dict(preferred)]), \
                patch.object(Fetcher, 'javdb', side_effect=lambda _: [dict(alternate)]) as javdb, \
                patch.object(Fetcher, 'sukebei', return_value=[]) as sukebei, \
                patch.object(Fetcher, 'javbus', return_value=[]) as javbus:
            self.assertEqual(len(search(Path('.'), 'ABC-123')['items']), 1)
            javdb.assert_not_called()
            sukebei.assert_not_called()
            javbus.assert_not_called()
            found = fetch(Path('.'), 'ABC-123')['items']
            self.assertEqual({row['source'] for row in found}, {'manko.fun', 'JavDB'})
            self.assertEqual(found[0]['resolution'], 2160)
            javdb.assert_called_once()
            sukebei.assert_called_once()
            javbus.assert_called_once()
            # 想要定时查找：manko 已有高清时只跳过 JavDB，sukebei 与 JavBus 照查。
            quick = fetch(Path('.'), 'ABC-123', quick=True)
            self.assertEqual({row['source'] for row in quick['items']}, {'manko.fun'})
            javdb.assert_called_once()
            self.assertEqual((sukebei.call_count, javbus.call_count), (2, 2))
            self.assertIn('JavDB: skipped, manko.fun already had 1080p/2160p', quick['trace'])

    def test_wishlist_candidates_have_display_and_download_fields(self):
        from peach.wants_magnets import fetch
        candidate = _normalise({'uri': item(HASH_A)['uri'], 'size': '2 GiB',
                                'attributes': ['chinese-subtitles']}, CHAIN[1], 'ABC-123')
        # JavDB 磁链的中字属性是 id，名字里没写中字也算中字。
        self.assertTrue(candidate['chinese'])
        with patch('peach.magnet_chain.search', return_value={'items': [candidate]}):
            result = fetch(Path('.'), 'ABC-123')['items'][0]
        self.assertEqual(result['protocol'], 'magnet')
        self.assertEqual(result['attributes'], ['chinese-subtitles'])
        self.assertEqual(result['size'], '2 GiB')

    def test_unavailable_sources_without_results_use_the_failure_cooldown(self):
        from peach.magnet_chain import Fetcher, search
        from peach.wants_magnets import MagnetSearch
        now = [100.0]
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        with patch.object(Fetcher, '__init__', return_value=None), patch.object(Fetcher, 'close'), \
                patch.object(Fetcher, 'manko', side_effect=RuntimeError), \
                patch.object(Fetcher, 'javdb', return_value=[]), \
                patch.object(Fetcher, 'sukebei', return_value=[]), \
                patch.object(Fetcher, 'javbus', return_value=[]):
            calls = []
            def fetcher(root, code):
                calls.append(code)
                return search(root, code)
            lookup = MagnetSearch(Path(temporary.name).resolve(), fetcher=fetcher, clock=lambda: now[0], sleeper=lambda _: None)
            self.assertEqual(lookup.query('ABC-123')['state'], 'error')
            now[0] += 120
            self.assertEqual(lookup.query('ABC-123')['state'], 'error')
        self.assertEqual(len(calls), 2)
    def test_javdb_step_reads_the_anonymous_api_and_keeps_comment_links(self):
        from peach.magnet_chain import Fetcher
        rows = [{'hash': HASH_A, 'name': 'ABC-123-C.torrent', 'size': 4219, 'cnsub': True, 'hd': True,
                 'files_count': 3, 'created_at': '2026-10-08'}]
        ed2k = 'ed2k://|file|ABC-123.mp4|1234|' + 'b' * 32 + '|/'
        fetcher = Fetcher(Path('.'), transport=object())
        with patch('peach.magnet_chain.PUBLIC_API.movie', return_value={'id': 'Exact'}) as movie, \
                patch('peach.magnet_chain.PUBLIC_API.magnets', return_value=rows) as magnets, \
                patch('peach.magnet_chain.PUBLIC_API.reviews', return_value=[{'id': 7, 'content': ed2k}]):
            found = fetcher.javdb('ABC-123')
        # 只重取磁链与评论；作品资料按快照规则复用。
        movie.assert_called_once_with('ABC-123')
        magnets.assert_called_once_with('ABC-123', refresh=True, movie={'id': 'Exact'})
        self.assertEqual(len(found), 1)
        self.assertEqual((found[0]['size'], found[0]['size_text']), (int(4.12 * 1024 ** 3), '4.12GB'))
        self.assertEqual((found[0]['chinese'], found[0]['file_count']), (True, 3))
        self.assertEqual(found[0]['source_url'], 'https://javdb.com/v/Exact')
        self.assertEqual([row['protocol'] for row in fetcher.resource_result['items']], ['magnet', 'ed2k'])

    def test_javbus_step_reads_the_magnet_table_behind_the_work_page(self):
        """2026-11-16 实测形态：作品页带 gid／img／uc，磁链表三列（名称带「高清」「字幕」、大小、日期）。"""
        from types import SimpleNamespace
        from peach.magnet_chain import Fetcher
        work = ('<html><h3>ABC-123 タイトル</h3><p><span class="header">識別碼:</span> <span>ABC-123</span></p>'
                "<script>var gid = 45622883496;\nvar uc = 0;\nvar img = '/pics/cover/83ie_b.jpg';</script></html>")
        table = (f'<tr><td><a href="magnet:?xt=urn:btih:{HASH_A}&amp;dn=ABC-123">ABC-123-C '
                 '<a class="btn btn-mini-new btn-primary disabled">高清</a>'
                 '<a class="btn btn-mini-new btn-warning disabled">字幕</a></a></td>'
                 f'<td><a href="magnet:?xt=urn:btih:{HASH_A}">4.12GB</a></td><td><a>2025-10-28</a></td></tr>'
                 f'<tr><td><a href="magnet:?xt=urn:btih:{HASH_B}&amp;dn=XYZ-999">XYZ-999</a></td>'
                 f'<td><a href="magnet:?xt=urn:btih:{HASH_B}">1.00GB</a></td><td><a>2025-10-27</a></td></tr>')
        asked = []

        def get(url, *, config, referer="", headers=None):
            asked.append((url, referer, dict(headers or {})))
            return SimpleNamespace(url=url, text=table if "uncledatoolsbyajax" in url else work)

        fetcher = Fetcher(Path('.'), transport=object())
        fetcher.session = SimpleNamespace(get=get)
        found = fetcher.javbus('ABC-123')
        self.assertEqual([row['info_hash'] for row in found], [HASH_A], "番号对不上的那一行不收")
        self.assertEqual((found[0]['size_text'], found[0]['chinese'], found[0]['source']), ('4.12GB', True, 'JavBus'))
        self.assertEqual(found[0]['attributes'], ['高清', '字幕'])
        url, referer, headers = asked[1]
        self.assertIn('gid=45622883496', url)
        self.assertEqual((referer, headers), ('https://www.javbus.com/ABC-123', {'X-Requested-With': 'XMLHttpRequest'}))

    def test_partial_javdb_failures_reach_browser_and_wishlist_searches(self):
        from peach.magnet_chain import Fetcher, search
        for stop in (True, False):
            for failure in ('magnet_failed', 'comments_failed'):
                with self.subTest(stop=stop, failure=failure), \
                        patch.object(Fetcher, 'manko', return_value=[]), \
                        patch.object(Fetcher, 'sukebei', return_value=[]), \
                        patch.object(Fetcher, 'javbus', return_value=[]), \
                        patch('peach.magnet_chain.PUBLIC_API.resources', return_value={
                            'items': [], 'warnings': ['JavDB partial failure'], failure: True}):
                    result = search(Path('.'), 'ABC-123', transport=object(), stop_on_preferred=stop)
                self.assertEqual(result['state'], 'error')
                self.assertEqual(result['unfetched_sources'], ['JavDB'])
                self.assertEqual(result['warnings'], ['JavDB partial failure'])

    def test_partial_javdb_failure_preserves_links_from_other_sources(self):
        from peach.magnet_chain import Fetcher, search
        for stop in (True, False):
            with self.subTest(stop=stop), patch.object(Fetcher, 'manko', return_value=[]), \
                    patch.object(Fetcher, 'sukebei', return_value=[]), \
                    patch.object(Fetcher, 'javbus', return_value=[item(HASH_A, source='JavBus')]), \
                    patch('peach.magnet_chain.PUBLIC_API.resources', return_value={
                        'items': [], 'warnings': ['JavDB partial failure'], 'magnet_failed': True}):
                result = search(Path('.'), 'ABC-123', transport=object(), stop_on_preferred=stop)
            self.assertEqual((result['state'], result['error']), ('ready', ''))
            self.assertEqual(result['items'][0]['source'], 'JavBus')
            self.assertEqual(result['unfetched_sources'], ['JavDB'])
            self.assertEqual(result['warnings'], ['JavDB partial failure'])

    def test_wishlist_keeps_comment_links_when_the_magnet_section_is_unavailable(self):
        from peach.magnet_chain import Fetcher, search
        link = {'protocol': 'ed2k', 'uri': 'ed2k://|file|ABC-123|1234|' + 'a' * 32 + '|/', 'files': ''}
        with patch.object(Fetcher, 'manko', return_value=[]), \
                patch.object(Fetcher, 'sukebei', return_value=[]), \
                patch.object(Fetcher, 'javbus', return_value=[]), \
                patch('peach.magnet_chain.PUBLIC_API.resources', return_value={
                    'items': [link], 'warnings': ['JavDB partial failure'], 'magnet_failed': True}):
            result = search(Path('.'), 'ABC-123', transport=object(), stop_on_preferred=False)
        self.assertEqual((result['state'], result['error']), ('ready', ''))
        self.assertEqual(result['linked_resources'], [link])
        self.assertEqual(result['unfetched_sources'], ['JavDB'])

    def test_javdb_identity_ambiguity_is_reported_with_source_ids(self):
        from peach.javdb_public import PublicIdentityAmbiguous
        from peach.magnet_chain import Fetcher, search
        ambiguous = PublicIdentityAmbiguous('errors.javdbPublic.identityAmbiguous', {'identities': 'Aa1、Bb2'})
        with patch.object(Fetcher, 'manko', return_value=[]), patch.object(Fetcher, 'sukebei', return_value=[]), \
                patch.object(Fetcher, 'javbus', return_value=[]), \
                patch('peach.magnet_chain.PUBLIC_API.movie', side_effect=ambiguous):
            result = search(Path('.'), 'ABC-123', transport=object(), stop_on_preferred=False)
        self.assertEqual(result['warnings'], ['JavDB：同番号对应多个作品，请核对来源身份：Aa1、Bb2'])

    def test_unanswered_sources_are_listed_with_their_cooldown_but_an_unlisted_code_is_an_answer(self):
        from peach.javdb_public import PublicNotFound
        from peach.magnet_chain import Fetcher, search
        from peach.scraping_access import SourcePaused, pause_source
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name).resolve()
        pause_source(root, 'javdb', retry_after=600)
        with patch.object(Fetcher, 'manko', return_value=[]), patch.object(Fetcher, 'sukebei', return_value=[]), \
                patch.object(Fetcher, 'javbus', return_value=[]), \
                patch.object(Fetcher, 'javdb', side_effect=SourcePaused('errors.scrapingAccess.coolingDown')):
            paused = search(root, 'ABC-123', transport=object())
        self.assertEqual((paused['state'], paused['unfetched_sources']), ('error', ['JavDB']))
        self.assertGreater(paused['retry_after'], 590)
        with patch.object(Fetcher, 'manko', return_value=[]), patch.object(Fetcher, 'sukebei', return_value=[]), \
                patch.object(Fetcher, 'javbus', return_value=[]), \
                patch('peach.magnet_chain.PUBLIC_API.movie', side_effect=PublicNotFound('errors.javdbPublic.notFound')):
            unlisted = search(root, 'ABC-123', transport=object())
        self.assertEqual((unlisted['unfetched_sources'], unlisted['retry_after']), ([], None))
        self.assertEqual((unlisted['state'], unlisted['warnings']), ('ready', []))

    def test_base91_decodes_the_api_envelope_payload(self):
        # basE91 官方示例：编码后的这一段解回 ASCII "test"。
        self.assertEqual(decode_base91("fPNKd"), b"test")

    def test_resolution_and_size_are_normalised(self):
        self.assertEqual(resolution_of("[FHD] ABC-123"), 1080)
        self.assertEqual(resolution_of("ABC-123 4K"), 2160)
        self.assertEqual(size_bytes("2.5 GiB"), int(2.5 * 1024 ** 3))

    def test_manko_bypasses_watermark_gate_but_other_sources_do_not(self):
        manko = _normalise({"uri": item(HASH_A)["uri"], "name": "ABC-123 FHD"},
                           CHAIN[0], "ABC-123")
        javdb = _normalise({"uri": item(HASH_B)["uri"], "name": "ABC-123 FHD"},
                           CHAIN[1], "ABC-123")
        self.assertEqual((manko["watermark_check"], javdb["watermark_check"]),
                         ("bypassed", "pending"))

    def test_file_count_is_not_a_rejection_and_quality_wins(self):
        many = item(HASH_A, resolution=2160, file_count=8, promo_files=2, seeders=1)
        single = item(HASH_B, resolution=1080, file_count=1, seeders=20)
        ranked = rank_candidates([single, many])
        self.assertEqual([row["info_hash"] for row in ranked], [HASH_A, HASH_B])

    def test_selected_edition_goal_wins_before_resolution(self):
        chinese = item(HASH_A, resolution=1080, chinese=True)
        plain = item(HASH_B, resolution=2160)
        self.assertEqual(rank_candidates([plain, chinese], "chinese")[0]["info_hash"], HASH_A)

    def test_mismatched_release_is_rejected(self):
        candidate = _normalise({"uri": item(HASH_A)["uri"], "name": "ABC-124 FHD"},
                               CHAIN[1], "ABC-123")
        self.assertIsNone(candidate)
        self.assertEqual(parse_magnet(item(HASH_A)["uri"]).info_hash, HASH_A)


if __name__ == "__main__":
    unittest.main()
