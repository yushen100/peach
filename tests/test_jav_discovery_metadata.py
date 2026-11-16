"""发现资料边车、固定批次、预算和失败状态的行为契约。"""
import tempfile
import json
import unittest
import threading
from pathlib import Path
from unittest.mock import patch

from peach.javdb_public import PublicAPI, PublicSourceUnavailable
from peach.jav_discovery_metadata import DiscoveryMetadata
from peach.web_jav_discovery import _metadata_response


class DiscoveryMetadataTests(unittest.TestCase):
    def test_legacy_sidecar_identity_is_not_trusted_and_new_original_title_survives_restart(self):
        self.path.write_text(json.dumps({'version': 1, 'records': {'MIKR-023': {
            'movie': {'id': 'WrongFirst', 'number': 'MIKR-023'}, 'checked_at': self.now[0]}}}), encoding='utf8')
        original = self.path.read_bytes()
        old_job = self.path.with_suffix('.job.json')
        old_job.write_text(json.dumps({'status': 'running', 'codes': ['MIKR-023'],
                                      'completed_codes': ['MIKR-023']}), encoding='utf8')
        old = DiscoveryMetadata(self.path, api=self.api, clock=lambda: self.now[0])
        self.addCleanup(old.stop)
        self.assertEqual(old.peek('MIKR-023')[0], {})
        self.assertIsNone(old.job.snapshot())
        old.remember('MIKR-023', {'id': 'XeYkdb', 'number': 'MIKR-023',
                                 'title': '显示题', 'origin_title': 'Original 日本語', 'javdb_rule': 2})
        restarted = DiscoveryMetadata(self.path, api=self.api, clock=lambda: self.now[0])
        self.addCleanup(restarted.stop)
        self.assertEqual(restarted.peek('MIKR-023')[0]['origin_title'], 'Original 日本語')
        self.assertEqual(self.path.read_bytes(), original)
        self.assertTrue(old_job.exists())

    def test_restart_retains_batch_identity_budget_and_completed_codes(self):
        self.cache.remember('EXM-001', {'number': 'EXM-001', 'tags': [], 'score': 4, 'duration': 120})
        self.cache.job_path.write_text(json.dumps(dict(
            javdb_rule=2, job_id='original', status='running', codes=['EXM-001', 'EXM-002'], refresh=True,
            completed=1, completed_codes=['EXM-001'], attempted_codes=['EXM-001'], requests=3, bytes=120,
            active_seconds=10)), encoding='utf-8')
        with patch.object(self.api, 'movie', return_value={'number': 'EXM-002', 'tags': [], 'score': 4, 'duration': 120}) as movie:
            restarted = DiscoveryMetadata(self.path, api=self.api, clock=lambda: self.now[0])
            self.addCleanup(restarted.stop)
            restarted.job.thread.join(5)
        final = restarted.job.snapshot()
        movie.assert_called_once_with('EXM-002', refresh=True)
        self.assertEqual((final['job_id'], final['completed'], final['requests'], final['bytes']), ('original', 2, 3, 120))

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.path = Path(temporary.name).resolve() / "metadata.json"
        self.now = [1000.0]
        self.api = PublicAPI(sleeper=lambda _: None)
        self.cache = DiscoveryMetadata(self.path, api=self.api, clock=lambda: self.now[0])
        self.addCleanup(self.cache.stop)

    def test_repeated_restart_keeps_checkpoint_before_the_next_item_finishes(self):
        self.cache.job_path.write_text(json.dumps(dict(
            javdb_rule=2, job_id='original', status='running', codes=['EXM-001', 'EXM-002'], refresh=True,
            started_at=100, completed=1, completed_codes=['EXM-001'], attempted_codes=['EXM-001'],
            failed_codes=[], requests=3, bytes=120, active_seconds=10)), encoding='utf-8')
        with patch.object(DiscoveryMetadata, '_run_batch'):
            first = DiscoveryMetadata(self.path, api=self.api, clock=lambda: self.now[0])
            first.job.thread.join(5)
            first.stop()
        saved = json.loads(self.cache.job_path.read_text(encoding='utf-8'))
        self.assertEqual(saved['completed_codes'], ['EXM-001'])
        self.assertEqual(saved['started_at'], 100)
        with patch.object(self.api, 'movie', return_value={'number': 'EXM-002', 'tags': [], 'score': 4, 'duration': 120}) as movie:
            second = DiscoveryMetadata(self.path, api=self.api, clock=lambda: self.now[0])
            self.addCleanup(second.stop)
            second.job.thread.join(5)
        movie.assert_called_once_with('EXM-002', refresh=True)
        self.assertEqual(second.job.snapshot()['completed'], 2)

    def test_sidecar_survives_restart_and_distinguishes_empty_unknown_and_stale(self):
        movie = {"number": "EXM-001", "tags": [], "score": "4.23", "duration": 180,
                 "preview_video_url": "https://example.invalid/secret",
                 "actors": [{"name": "甲", "gender": 0, "avatar_url": "secret"}]}
        self.cache.remember("EXM-001", movie)
        restarted = DiscoveryMetadata(self.path, clock=lambda: self.now[0])
        source, state = restarted.peek("EXM001")
        self.assertEqual(state["metadata_state"], "ready")
        self.assertEqual(state["metadata_fields"]["tags"], "empty")
        self.assertNotIn("preview_video_url", source)
        self.assertNotIn("avatar_url", source["actors"][0])
        self.assertEqual(restarted.peek("EXM-002")[1]["metadata_fields"]["tags"], "unavailable")
        self.now[0] += 86400
        self.assertEqual(restarted.peek("EXM-001")[1]["metadata_state"], "stale")
        self.cache.remember("EXM-002", error="资料未取得")
        self.assertEqual(self.cache.peek("EXM-002")[1]["metadata_state"], "unavailable")

    def test_fixed_batch_finishes_without_detail_open_or_polling_new_batch(self):
        def movie_for(code, **_):
            return {"number": code, "tags": [{"name": "制服"}], "score": 4, "duration": 120}
        with patch.object(self.api, "movie", side_effect=movie_for) as movie:
            self.cache.ensure([f"EXM-{index:03d}" for index in range(1, 105)])
            self.cache.job.thread.join(5)
            state = self.cache.job.snapshot()
            self.assertEqual((state["status"], state["completed"], state["total"]), ("complete", 100, 100))
            self.cache.ensure(["EXM-999"])
            self.assertEqual(movie.call_count, 100)
            self.assertEqual(self.cache.peek("EXM-001")[1]["metadata_state"], "ready")
            self.cache.ensure(["EXM-001", "EXM-999"], refresh=True, job_id=state["job_id"])
            self.cache.job.thread.join(5)
            self.assertEqual(movie.call_count, 102)

    def test_static_portraits_survive_restart_without_signed_addresses(self):
        self.cache.remember('EXM-001', {'actors': [
            {'id': 'Static', 'name': '甲', 'avatar_url': 'https://tp.spfcas.com/actor.jpg'},
            {'id': 'Signed', 'name': '乙', 'avatar_url': 'https://tp.spfcas.com/actor.jpg?signature=example'},
            {'id': 'Private', 'name': '丙', 'avatar_url': 'http://127.0.0.1/private'}]})
        source, _ = DiscoveryMetadata(self.path).peek('EXM-001')
        actors = source['actors']
        self.assertEqual(actors[0]['avatar_image'], 'https://tp.spfcas.com/actor.jpg')
        self.assertNotIn('avatar_image', actors[1])
        self.assertTrue(actors[1]['has_avatar'])
        self.assertFalse(actors[2]['has_avatar'])
        self.assertNotIn('signature', self.cache.path.read_text(encoding='utf-8'))

    def test_source_cooldown_stops_batch_and_preserves_failure(self):
        def unavailable(code):
            self.api.paused_until = self.api.clock() + 900
            raise PublicSourceUnavailable("errors.javdbPublic.unavailable")
        with patch.object(self.api, "movie", side_effect=unavailable) as movie:
            self.cache.ensure(["EXM-001", "EXM-002"])
            self.cache.job.thread.join(5)
            state = self.cache.job.snapshot()
            self.assertEqual(state["status"], "stopped")
            self.assertEqual(state["stop_reason"], "source_cooldown")
            self.assertEqual(movie.call_count, 1)
            self.assertEqual(self.cache.peek("EXM-001")[1]["metadata_state"], "unavailable")

    def test_cancel_preserves_completed_records_and_requires_explicit_resume(self):
        entered, release = threading.Event(), threading.Event()
        def movie_for(code, **_):
            entered.set()
            release.wait(5)
            return {"number": code, "tags": [], "score": 4, "duration": 120}
        with patch.object(self.api, "movie", side_effect=movie_for) as movie:
            self.cache.ensure(["EXM-001", "EXM-002"])
            self.assertTrue(entered.wait(5))
            thread = self.cache.job.thread
            stopped = self.cache.cancel()
            release.set()
            thread.join(5)
            self.assertEqual(stopped["stop_reason"], "cancelled")
            self.assertEqual(self.cache.peek("EXM-001")[1]["metadata_state"], "ready")
            self.cache.ensure(["EXM-001", "EXM-002"])
            self.assertEqual(movie.call_count, 1)
            self.cache.ensure(["EXM-001", "EXM-002"], refresh=True)
            self.cache.job.thread.join(5)
            self.assertEqual(movie.call_count, 3)

    def test_finished_collection_rechecks_expired_new_work_and_keeps_mature_work(self):
        self.now[0] = 1791892800.0
        def movie_for(code):
            return {'number': code, 'release_date': '2026-10-01' if code == 'EXM-001' else '2020-01-01',
                    'tags': [], 'score': 4, 'duration': 120}
        with patch.object(self.api, 'movie', side_effect=movie_for) as movie:
            self.cache.ensure(['EXM-001', 'EXM-002'])
            self.cache.job.thread.join(5)
            saved = self.cache.peek('EXM-002')[1]['metadata_checked_at']
            self.cache.ensure(['EXM-999'])
            self.assertEqual(movie.call_count, 2)
            self.now[0] += 86400
            self.cache.ensure(['EXM-999'])
            self.cache.job.thread.join(5)
            self.assertEqual(movie.call_count, 3)
            self.assertEqual(movie.call_args.args, ('EXM-001',))
            self.assertEqual(self.cache.peek('EXM-002')[1]['metadata_checked_at'], saved)

    def test_complete_new_work_is_kept_and_pre_release_work_waits_for_release_day(self):
        self.now[0] = 1791892800.0  # 2026-10-13
        def movie_for(code):
            return {'number': code, 'title': 'T', 'cover_url': 'https://c/x.jpg', 'tags': [], 'score': 4,
                    'duration': 120, 'release_date': '2026-10-10' if code == 'EXM-001' else '2026-10-20'}
        with patch.object(self.api, 'movie', side_effect=movie_for):
            self.cache.ensure(['EXM-001', 'EXM-002'])
            self.cache.job.thread.join(5)
        restarted = DiscoveryMetadata(self.path, api=self.api, clock=lambda: self.now[0])
        self.addCleanup(restarted.stop)
        self.now[0] += 5 * 86400
        self.assertEqual(restarted._pending_codes(['EXM-001', 'EXM-002'], set(), False), [])
        self.now[0] += 2 * 86400
        self.assertEqual(restarted._pending_codes(['EXM-001', 'EXM-002'], set(), False), ['EXM-002'])
        self.now[0] += 365 * 86400
        self.assertEqual(restarted.peek('EXM-001')[1]['metadata_state'], 'ready')

    def test_official_catalogue_stands_in_when_javdb_does_not_answer(self):
        stand_in = {'number': 'SSIS-001', 'title': '官方标题', 'tags': ['単体作品'], 'duration': 150,
                    'actors': [{'name': '葵つかさ', 'gender': 'female'}], 'fallback_source': 'dmm'}
        asked = []
        cache = DiscoveryMetadata(self.path.with_name('fallback.json'), api=self.api, clock=lambda: self.now[0],
                                  fallback=lambda code: asked.append(code) or (stand_in if code == 'SSIS-001' else None))
        self.addCleanup(cache.stop)
        with patch.object(self.api, 'movie', side_effect=PublicSourceUnavailable('errors.javdbPublic.sourcePaused')):
            cache.ensure(['SSIS-001', 'SSIS-002'])
            cache.job.thread.join(5)
        self.assertEqual(asked, ['SSIS-001', 'SSIS-002'])
        movie, state = cache.peek('SSIS-001')
        self.assertEqual((movie['title'], movie['fallback_source'], movie['tags']), ('官方标题', 'dmm', ['単体作品']))
        self.assertEqual(state['metadata_message'], '')
        self.assertEqual(cache.job.snapshot()['stop_reason'], '')
        # 一天之内不再问；之后照常再问 JavDB。
        self.assertEqual(cache._pending_codes(['SSIS-001'], set(), False), [])
        self.now[0] += 86400
        self.assertEqual(cache._pending_codes(['SSIS-001'], set(), False), ['SSIS-001'])

    def test_official_payload_maps_to_the_work_fields(self):
        from peach.jav_discovery_metadata import movie_from_payload
        payload = {'title': 'T', 'release_date': '2026-11-01', 'maker': 'S1', 'series': 'X', 'runtime': 120,
                   'genres': ['単体作品', ''], 'actresses': [{'japanese_name': '甲'}, {'japanese_name': ''}]}
        self.assertEqual(movie_from_payload('ssis-001', payload, 'r18dev'), {
            'number': 'SSIS-001', 'title': 'T', 'release_date': '2026-11-01', 'maker_name': 'S1',
            'series_name': 'X', 'duration': 120, 'tags': ['単体作品'],
            'actors': [{'name': '甲', 'gender': 'female'}], 'fallback_source': 'r18dev'})
        self.assertIsNone(movie_from_payload('SSIS-001', {'title': ''}, 'dmm'))

    def test_source_cache_read_and_failed_refresh_do_not_renew_source_timestamp(self):
        source = {'number': 'EXM-001', 'release_date': '2020-01-01', 'tags': [], 'score': 4, 'duration': 120}
        self.cache.remember('EXM-001', source, checked_at=100)
        self.now[0] = 2000
        self.cache.remember('EXM-001', source, checked_at=100)
        self.cache.remember('EXM-001', error='来源未取得')
        self.assertEqual(self.cache.peek('EXM-001')[1]['metadata_checked_at'], 100)

    def test_public_job_status_excludes_internal_errors_and_private_codes(self):
        failure = {"job_id": "sample", "status": "failed", "error": "RuntimeError: https://example.invalid/?private=sample",
                   "codes": ["EXM-001"], "completed": 0, "total": 1, "stop_reason": ""}
        with patch("peach.web_jav_discovery.discovery_metadata") as metadata:
            metadata.return_value.current.return_value = failure
            response = _metadata_response(None, {}, [], [], 60, "external")
        self.assertEqual(response["metadata_job"]["message"], "作品资料未取得")
        self.assertEqual(response["metadata_job"]["error"], "作品资料未取得")
        self.assertNotIn("codes", response["metadata_job"])
        self.assertNotIn("poll_after_ms", response)
