"""画面推广、片头广告与派生证据缓存的行为回归。"""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
from unittest import TestCase, skipUnless
from unittest.mock import Mock, patch

from PIL import Image, ImageDraw, ImageFont

from peach import junk, junk_visual, library_processing
from peach.image_ocr import ImageReader, OcrUnavailable
from peach.repository import LedgerDatabase
from peach.settings_file import PeachConfig
from peach.web_batch import q_ads, w_batch
from peach.web_contract import WebContract
from support.ledger import fresh_ledger


PROMO = '赔率最高，彩金征求赢家 VIP5678.COM'


def evidence(texts, *, qr=False):
    return [junk_visual.frame_evidence(index, text, int(qr), ['https://promo.example/'] if qr else [])
            for index, text in enumerate(texts)]


class VisualJudgementTests(TestCase):
    def verdict(self, texts, *, size=8 * 1024**2, duration=90, qr=False):
        return junk_visual.judge(evidence(texts, qr=qr), size=size, duration=duration)['verdict']

    def test_promotion_across_the_video_enters_review(self):
        self.assertEqual(self.verdict([PROMO] * 9), 'candidate')

    def test_advertising_intro_with_a_clean_remainder_is_preserved(self):
        for count in (1, 2, 3):
            with self.subTest(count=count):
                self.assertEqual(self.verdict([PROMO] * count + ['normal scene'] * (9 - count)), 'intro_only')
        self.assertEqual(self.verdict([PROMO] * 2 + ['example.com'] * 7, qr=True), 'intro_only')

    def test_watermarks_and_qr_codes_without_promotional_wording_are_preserved(self):
        self.assertEqual(self.verdict(['example.com'] * 9), 'no_candidate')
        self.assertEqual(self.verdict(['example.com'] * 9, qr=True), 'no_candidate')
        self.assertEqual(self.verdict([''] * 9, qr=True), 'no_candidate')

    def test_a_middle_insert_and_an_advertising_ending_do_not_describe_the_whole_video(self):
        self.assertEqual(self.verdict(['scene'] * 4 + [PROMO] + ['scene'] * 4), 'no_candidate')
        self.assertEqual(self.verdict(['scene'] * 7 + [PROMO] * 2), 'no_candidate')
        self.assertEqual(self.verdict([PROMO] * 6 + ['scene'] * 3), 'no_candidate')

    def test_long_or_large_videos_need_more_promotional_wording_across_frames(self):
        texts = ['example.com'] * 3 + [PROMO] + ['example.com'] * 3 + [PROMO, 'example.com']
        self.assertEqual(self.verdict(texts), 'candidate')
        self.assertEqual(self.verdict(texts, size=600 * 1024**2), 'no_candidate')
        self.assertEqual(self.verdict(texts, duration=7200), 'no_candidate')
        self.assertEqual(self.verdict([PROMO] * 9, size=600 * 1024**2, duration=7200), 'candidate')

    def test_incomplete_coverage_and_unknown_measurements_remain_unresolved(self):
        self.assertEqual(self.verdict([PROMO] * 3), 'incomplete')
        for duration in (None, 0, -1):
            self.assertEqual(self.verdict([PROMO] * 9, duration=duration), 'unmeasured')
            self.assertEqual(self.verdict([PROMO] * 2 + ['scene'] * 7, duration=duration), 'unmeasured')
        self.assertEqual(self.verdict([PROMO] * 9, size=None), 'unmeasured')

    def test_spaced_chinese_words_and_qr_domains_are_combined(self):
        frame = junk_visual.frame_evidence(1, '一 键 约 会 会 员 聚 会', 1, ['https://promo.example/page'])
        self.assertEqual(frame['terms'], ['一键约会', '会员聚会'])
        self.assertEqual(frame['domains'], ['promo.example'])
        self.assertEqual(junk_visual.frame_evidence(0, '', 1, ['https://['])['domains'], [])
        self.assertIn('一对一或一对多服务', junk_visual.frame_evidence(
            0, '主 播 支 持 一 对 一 或 一 对 多 服 务', 0, [])['terms'])


class VisualEvidenceTests(TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.db_path = fresh_ledger(self.root)
        self.database = LedgerDatabase(self.db_path)
        self.contract = WebContract(self.db_path)
        self.snapshot = self.root / 'snapshot.jpg'
        Image.new('RGB', (480, 270), 'blue').save(self.snapshot)
        with self.database.write_transaction() as connection:
            connection.execute('INSERT INTO asset(id,location,path,name,medium,size,duration,snapshot_path) '
                               'VALUES(1,?,?,?,?,?,?,?)', ('local', r'R:\media\clip.mp4', 'clip.mp4', 'video',
                                                        8 * 1024**2, 90, str(self.snapshot)))

    def row(self):
        with self.database.read_connection() as connection:
            return dict(connection.execute('SELECT * FROM asset WHERE id=1').fetchone())

    def analyse(self, texts):
        reader = Mock()
        reader.read.return_value = texts
        return junk_visual.analyse(self.database, self.row(), reader), reader

    def test_saved_visual_candidate_refreshes_the_queue_without_a_ledger_write(self):
        self.assertEqual(q_ads(self.contract)['items'], [])
        entry, reader = self.analyse([PROMO] * 9)
        self.assertEqual(entry['verdict'], 'candidate')
        items = q_ads(self.contract)['items']
        self.assertEqual([item['id'] for item in items], [1])
        self.assertIn('9 帧', items[0]['why'])
        self.assertLess(items[0]['score'], junk.AUTO_TRASH_SCORE)
        self.assertEqual(junk.isolate(self.database, asset_ids=[1])['isolated'], 0)
        junk_visual.analyse(self.database, self.row(), reader)
        reader.read.assert_called_once()
        w_batch(self.contract, {'ids': [1], 'operation': 'dismiss-junk'})
        self.assertEqual(q_ads(self.contract)['items'], [])
        w_batch(self.contract, {'ids': [1], 'operation': 'reconsider-junk'})
        self.assertEqual(q_ads(self.contract)['total'], 1)

    def test_intro_evidence_overrides_a_promotional_filename(self):
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET name='点击进入.mp4' WHERE id=1")
        self.assertEqual(q_ads(self.contract)['total'], 1)
        entry, _ = self.analyse([PROMO] * 2 + ['normal scene'] * 7)
        self.assertEqual(entry['verdict'], 'intro_only')
        self.assertEqual(q_ads(self.contract)['items'], [])
        self.assertEqual(junk.isolate(self.database, asset_ids=[1])['isolated'], 0)

    def test_isolation_rechecks_intro_evidence_published_after_scoring(self):
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET name='点击进入.mp4' WHERE id=1")
        original = junk.scored_candidates
        def score_then_analyse(*args, **options):
            result = original(*args, **options)
            self.analyse([PROMO] * 2 + ['normal scene'] * 7)
            return result
        with patch.object(junk, 'scored_candidates', side_effect=score_then_analyse):
            self.assertEqual(junk.isolate(self.database, asset_ids=[1])['isolated'], 0)

    def test_long_large_candidates_use_visual_evidence_and_still_require_review(self):
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET size=?,duration=? WHERE id=1', (2 * 1024**3, 7200))
        self.analyse([PROMO] * 9)
        self.assertEqual(q_ads(self.contract)['total'], 1)
        self.assertEqual(junk.isolate(self.database, asset_ids=[1])['isolated'], 0)

    def test_changed_asset_or_snapshot_cannot_reuse_old_evidence(self):
        entry, _ = self.analyse([PROMO] * 9)
        with self.database.write_transaction() as connection:
            connection.execute('UPDATE asset SET size=size+1 WHERE id=1')
        self.assertFalse(junk_visual.current(self.row(), entry))
        self.assertEqual(q_ads(self.contract)['items'], [])
        Image.new('RGB', (481, 270), 'green').save(self.snapshot)
        self.assertFalse(junk_visual.current(self.row(), entry))

    def test_missing_frames_and_ocr_failures_do_not_save_clean_results(self):
        for result in ([''] * 8, OcrUnavailable('engine missing')):
            reader = Mock()
            if isinstance(result, Exception):
                reader.read.side_effect = result
            else:
                reader.read.return_value = result
            with self.assertRaises(OcrUnavailable):
                junk_visual.analyse(self.database, self.row(), reader)
            self.assertFalse(junk_visual.cache_path(self.database).exists())

    def test_changed_source_and_cancellation_do_not_publish_results(self):
        reader = Mock()
        def changed(_paths):
            with self.database.write_transaction() as connection:
                connection.execute("UPDATE asset SET path='R:\\media\\replacement.mp4' WHERE id=1")
            return [PROMO] * 9
        reader.read.side_effect = changed
        with self.assertRaises(OcrUnavailable):
            junk_visual.analyse(self.database, self.row(), reader)
        with self.assertRaises(InterruptedError):
            junk_visual.analyse(self.database, self.row(), reader, checkpoint=Mock(side_effect=InterruptedError))
        self.assertFalse(junk_visual.cache_path(self.database).exists())

    def test_cached_preview_processing_runs_analysis_and_retries_recognition_failure(self):
        config = PeachConfig(self.root, self.root / 'config.toml', present=True)
        checked, issue = Mock(), Mock()
        with patch.object(library_processing, '_library_stages', return_value=lambda _: {'preview'}), \
                patch.object(library_processing, 'metadata_only', return_value=False), \
                patch.object(library_processing, '_generate_preview', return_value=False), \
                patch.object(ImageReader, 'read', return_value=[PROMO] * 9):
            made = library_processing._generate_previews(config, [self.row()], self.database,
                update=Mock(), issue=issue, guard=Mock(), checkpoint=checked)
        self.assertEqual(made, 0)
        checked.assert_called_once()
        issue.assert_not_called()
        self.assertEqual(q_ads(self.contract)['total'], 1)
        Image.new('RGB', (481, 270), 'green').save(self.snapshot)
        checked.reset_mock()
        with patch.object(library_processing, '_library_stages', return_value=lambda _: {'preview'}), \
                patch.object(library_processing, 'metadata_only', return_value=False), \
                patch.object(library_processing, '_generate_preview', return_value=False), \
                patch.object(ImageReader, 'read', side_effect=OcrUnavailable('engine missing')):
            library_processing._generate_previews(config, [self.row()], self.database,
                update=Mock(), issue=issue, guard=Mock(), checkpoint=checked)
        checked.assert_not_called()
        self.assertTrue(issue.call_args.kwargs['retryable'])

    def test_invalid_saved_evidence_is_reported_as_unavailable(self):
        self.analyse([PROMO] * 9)
        with closing(sqlite3.connect(junk_visual.cache_path(self.database))) as connection:
            connection.execute("UPDATE evidence SET payload='[]'")
            connection.commit()
        with self.assertRaises(OcrUnavailable):
            junk_visual.read(self.database)


class ImageReaderTests(TestCase):
    def test_portable_engine_uses_verified_models_and_an_independent_python(self):
        reader = ImageReader(Path('tools'), platform='linux')
        with patch('peach.ocr_runtime.python', return_value=Path('ocr-python')), \
                patch.object(reader, '_process', return_value=['download app']) as process, \
                patch('peach.avatar_watermark.ensure_model', side_effect=lambda path, **_: path) as ensure:
            self.assertEqual(reader.read([Path('a.png')]), ['download app'])
            self.assertEqual(reader.read([Path('b.png')]), ['download app'])
        self.assertEqual(process.call_args.args[0][:3], ['ocr-python', '-X', 'utf8'])
        self.assertEqual(len(process.call_args.args[2]['parameters']), 4)
        self.assertEqual(ensure.call_count, 3)
        for call in ensure.call_args_list:
            self.assertEqual(len(call.kwargs['sha256']), 64)

    def test_runtime_preparation_uses_the_lock_and_does_not_repeat_a_completed_install(self):
        from peach import ocr_runtime
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            runtime = root / 'manifest'
            runtime.mkdir()
            for name in ('pyproject.toml', 'uv.lock'):
                (runtime / name).write_text(name)
            executable = root / 'ocr-runtime/.venv' / (
                'Scripts/python.exe' if sys.platform == 'win32' else 'bin/python')

            def install(*args, **kwargs):
                executable.parent.mkdir(parents=True)
                executable.touch()
                return subprocess.CompletedProcess([], 0, b'', b'')

            with patch.dict('os.environ', {'PEACH_OCR_PYTHON': ''}), \
                    patch.object(ocr_runtime, 'RUNTIME', runtime), \
                    patch('peach.runtime_prepare.find_uv', return_value=Path('uv')), \
                    patch('peach.peach_proxy.client_options', return_value={'trust_env': True}), \
                    patch('peach.task_control.run', side_effect=install) as run:
                self.assertEqual(ocr_runtime.python(root), executable)
                self.assertEqual(ocr_runtime.python(root), executable)
            run.assert_called_once()
            self.assertIn('--locked', run.call_args.args[0])
            self.assertEqual(run.call_args.args[0][5], '3.14')

    def test_runtime_installation_failure_preserves_the_error_and_no_success_receipt(self):
        from peach import ocr_runtime
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch.dict('os.environ', {'PEACH_OCR_PYTHON': ''}), \
                    patch('peach.runtime_prepare.find_uv', return_value=Path('uv')), \
                    patch('peach.peach_proxy.client_options', return_value={'trust_env': True}), \
                    patch('peach.task_control.run', return_value=subprocess.CompletedProcess([], 1, b'', b'bad wheel')):
                with self.assertRaisesRegex(RuntimeError, 'bad wheel'):
                    ocr_runtime.python(root)
            self.assertFalse((root / 'ocr-runtime/installed.sha256').exists())

    @skipUnless(sys.platform == 'darwin', 'macOS Vision')
    def test_macos_native_engine_reads_a_local_image(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary).resolve() / 'text.png'
            image = Image.new('RGB', (960, 160), 'white')
            ImageDraw.Draw(image).text((30, 40), 'SIGNUP BONUS DOWNLOAD APP',
                                      font=ImageFont.load_default(size=40), fill='black')
            image.save(path)
            text = ImageReader(Path(temporary)).read([path])[0].casefold()
            self.assertIn('signup', text)
            self.assertIn('download', text)

    def test_windows_results_match_the_requested_images(self):
        paths = [Path('first.png').resolve(), Path('second.png').resolve()]
        entries = [{'path': str(path), 'text': PROMO, 'error': ''} for path in paths]
        response = subprocess.CompletedProcess([], 0, json.dumps(entries).encode(), b'')
        with patch('peach.image_ocr.shutil.which', return_value='powershell.exe'), \
                patch('peach.task_control.run', return_value=response) as run:
            self.assertEqual(ImageReader(Path('.'), platform='win32').read(paths), [PROMO] * 2)
        request = json.loads(run.call_args.kwargs['input'])
        self.assertEqual(request['paths'], [str(path) for path in paths])

    def test_windows_engine_error_and_incomplete_responses_are_failures(self):
        path = Path('first.png').resolve()
        for result in (subprocess.CompletedProcess([], 1, b'', b'language unavailable'),
                       subprocess.CompletedProcess([], 0, b'[]', b''),
                       subprocess.CompletedProcess([], 0, b'not json', b'')):
            with patch('peach.image_ocr.shutil.which', return_value='powershell.exe'), \
                    patch('peach.task_control.run', return_value=result), self.assertRaises(OcrUnavailable):
                ImageReader(Path('.'), platform='win32').read([path])
