"""媒体读取超时的进程回收、问题隔离与公共写入边界。"""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import MagicMock, Mock, patch
from types import SimpleNamespace

from peach import media_io, library_processing
from peach.user_messages import UserInterruptedError
from test_organize import hung_mount


class MediaIoTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.config = Mock()
        self.config.directory.side_effect = lambda name: self.root / name
        # 抽帧按目录的流量保护取舍：给一个免费的本地根，`cost_for` 才读得出这批条目可抽帧。
        self.config.locations = {'local': (str(self.root),)}
        self.config.media_costs = {}

    def test_nas_browser_reads_only_directories_and_refuses_escape(self):
        from peach.nas_directories import browse
        media = self.root / 'media'
        media.mkdir()
        (media / '子目录').mkdir()
        (media / 'video.mp4').write_bytes(b'not-read')
        config = SimpleNamespace(mounts={'local': (str(media),)}, locations={})
        reply = browse(config, str(media))
        self.assertEqual(reply['directories'], [{'name': '子目录', 'path': str(media / '子目录')}])
        self.assertIsNone(reply['parent'])
        with self.assertRaises(ValueError):
            browse(config, str(media / '..'))
        with self.assertRaises(ValueError):
            browse(config, 'relative')
        with patch('peach.media_io._request') as reader:
            with self.assertRaises(ValueError):
                browse(config, 'smb://example.test/share')
            reader.assert_not_called()
        if sys.platform != 'win32':
            (media / 'escape').symlink_to(self.root, target_is_directory=True)
            self.assertNotIn('escape', [entry['name'] for entry in browse(config, str(media))['directories']])
            with self.assertRaises(ValueError):
                browse(config, str(media / 'escape'))

    def test_nas_browser_bounds_listing_and_inherits_killable_io(self):
        from peach.nas_directories import browse, list_directory
        entries = [SimpleNamespace(name=str(index), is_dir=lambda **kwargs: True) for index in range(502)]
        manager = Mock()
        manager.__enter__ = Mock(return_value=iter(entries))
        manager.__exit__ = Mock(return_value=False)
        with patch('peach.nas_directories.os.scandir', return_value=manager):
            result = list_directory(self.root, [str(self.root)])
        self.assertEqual(len(result['directories']), 500)
        self.assertEqual(result['next_offset'], 500)
        config = SimpleNamespace(mounts={'local': (str(self.root),)}, locations={})
        with patch('peach.media_io.subprocess.run', side_effect=subprocess.TimeoutExpired('media-read', 10)):
            with self.assertRaises(TimeoutError):
                browse(config, str(self.root))

    def test_nas_browser_can_reach_directories_after_a_page_of_files(self):
        from peach.nas_directories import list_directory
        entries = [SimpleNamespace(name=str(index), is_dir=lambda **kwargs: False) for index in range(500)]
        entries.append(SimpleNamespace(name='后面的目录', is_dir=lambda **kwargs: True))
        manager = Mock()
        manager.__enter__ = Mock(side_effect=lambda: iter(entries))
        manager.__exit__ = Mock(return_value=False)
        with patch('peach.nas_directories.os.scandir', return_value=manager):
            first = list_directory(self.root, [str(self.root)])
            second = list_directory(self.root, [str(self.root)], first['next_offset'])
        self.assertEqual(first['directories'], [])
        self.assertEqual(second['directories'], [{'name': '后面的目录', 'path': str(self.root / '后面的目录')}])
        self.assertIsNone(second['next_offset'])

    def test_nas_browser_start_does_not_read_a_missing_initial_path(self):
        from peach.nas_directories import browse
        config = SimpleNamespace(mounts={'local': (str(self.root),)}, locations={})
        with patch('peach.media_io._request') as reader:
            result = browse(config, '/missing/old-path', start=True)
        reader.assert_not_called()
        self.assertEqual(result['roots'], [str(self.root)])
        self.assertIsNone(result['path'])
        with self.assertRaises(ValueError):
            browse(config, str(self.root), offset=-1)

    def test_nas_local_directory_does_not_probe_an_unrelated_offline_mount(self):
        from peach.nas_directories import list_directory
        offline = self.root.parent / 'offline-cloud'
        resolve = Path.resolve
        def checked(path, **kwargs):
            if path == offline:
                raise TimeoutError('离线挂载不能参与本地目录浏览')
            return resolve(path, **kwargs)
        with patch.object(Path, 'resolve', checked):
            result = list_directory(self.root, [str(offline), str(self.root)])
        self.assertEqual(result['path'], str(self.root))

    def test_server_position_uses_the_declared_root_and_relative_location(self):
        from peach.nas_directories import file_position
        from peach import settings_file
        from dataclasses import replace
        config = replace(settings_file.load_config(),
                         locations={'local': ('R:\\media',)},
                         mounts={'local': (str(self.root),)})
        with patch('peach.settings_file.active', return_value=config), \
                patch.dict('os.environ', {'PEACH_DISTRIBUTION': 'docker'}):
            result = file_position(self.root / 'series' / 'video.mp4', 'R:\\media\\series\\video.mp4')
        self.assertTrue(result['container'])
        self.assertEqual(result['media_root'], str(self.root))
        self.assertEqual(result['relative_path'], 'series/video.mp4')

    def test_worker_reads_unicode_nfo_and_directory_attributes(self):
        source = self.root / '影片.nfo'
        raw = '<movie><title>测试影片</title><num>ABW-101</num></movie>'.encode()
        source.write_bytes(raw)
        payload, evidence = media_io.read_nfo(source)
        self.assertEqual((payload['title'], evidence), ('测试影片', raw))
        entries = media_io.directory_entries(self.root)
        self.assertEqual([(entry.name, entry.stat().st_size) for entry in entries], [(source.name, len(raw))])
        self.assertEqual(media_io.directory_files(self.root), {source.name: source})

    def test_native_file_identity_survives_the_reader_process_boundary(self):
        source = self.root/'影片.mp4'
        source.write_bytes(b'video')
        before = source.stat()
        info = media_io.directory_entries(self.root,file_identity=True)[0].stat()
        self.assertEqual((info.st_ino,info.st_dev,info.st_size),
                         (before.st_ino,before.st_dev,before.st_size))
        self.assertNotEqual(info.st_ino,0)

    def test_timeout_reaps_reader_before_returning(self):
        children = []
        original_run, original_popen = subprocess.run, subprocess.Popen
        def spawn(*args, **kwargs):
            child = original_popen(*args, **kwargs)
            children.append(child)
            return child
        def blocked(_command, **options):
            return original_run([sys._base_executable, '-c', 'import time; time.sleep(60)'], **options)
        with patch.object(media_io, 'TIMEOUT_SECONDS', 0.2), \
                patch.object(media_io.subprocess, 'run', side_effect=blocked), \
                patch.object(media_io.subprocess, 'Popen', side_effect=spawn), \
                self.assertRaises(TimeoutError):
            media_io.directory_files(self.root)
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll())

    def test_one_worker_answers_in_turn_and_returns_errors_with_their_type(self):
        source, target = self.root / 'a.mp4', self.root / 'sub' / 'b.mp4'
        source.write_bytes(b'x')
        with media_io.MountWorker() as worker:
            self.assertEqual(worker.call('stat', str(source)).st_size, 1)
            self.assertEqual(worker.call('move', str(source), str(target)), 'ok')
            self.assertEqual(worker.call('probe', [str(source), str(target)]), [[False, False], [True, True]])
            self.assertEqual(worker.call('move', str(source), str(target)), 'missing')
            with self.assertRaises(FileNotFoundError):
                worker.call('stat', str(source))
            process = worker._process
        self.assertIsNotNone(process.poll())

    def test_a_cancel_during_an_interruptible_call_ends_the_worker_at_once(self):
        from peach.task_control import Cancelled
        stuck = self.root / 'stuck.mp4'
        polls = []

        def cancel_on_third_poll(kind=None):
            polls.append(kind)
            if len(polls) == 3:
                raise Cancelled()
        started = time.monotonic()
        with hung_mount([stuck], 'os.stat') as children, media_io.MountWorker() as worker, \
                patch('peach.task_control.checkpoint', cancel_on_third_poll), self.assertRaises(Cancelled):
            worker.call('stat', str(stuck), timeout=30, interruptible=True)
        self.assertLess(time.monotonic() - started, 10)
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll())

    def _spawned(self, script=None):
        """数读取子进程；给了 `script` 时用它换掉子进程的入口（真的 media_io，只改一处行为）。"""
        children, original_popen = [], subprocess.Popen

        def spawn(command, **options):
            if script is not None and command[-3] == 'directories':
                command = [sys._base_executable, '-c', script, *command[-3:]]
            child = original_popen(command, **options)
            children.append(child)
            return child
        return children, patch.object(media_io.subprocess, 'Popen', side_effect=spawn)

    def test_one_reader_walks_the_whole_tree(self):
        """几千个目录各起一个进程，起进程比读目录还慢；整棵树由一个读取子进程连续读完。"""
        for name in ('a/1', 'a/2', 'b'):
            (self.root / name).mkdir(parents=True)
        (self.root / 'a' / '1' / 'x.mp4').write_bytes(b'x')
        children, spawning = self._spawned()
        with spawning:
            listings = dict(media_io.read_directories([self.root], walk=True))
        names = {Path(directory).relative_to(self.root).as_posix(): sorted(entry.name for entry in listing)
                 for directory, listing in listings.items()}
        self.assertEqual(names, {'.': ['a', 'b'], 'a': ['1', '2'], 'a/1': ['x.mp4'], 'a/2': [], 'b': []})
        self.assertEqual(len(children), 1)
        missing = dict(media_io.read_directories([self.root / 'gone']))[os.fspath(self.root / 'gone')]
        self.assertIsInstance(missing, FileNotFoundError)
        self.assertFalse(missing.hollow, '真找不到的目录不是 CloudDrive 空目录')

    def test_a_stuck_directory_times_out_alone_and_the_rest_are_read_by_a_new_reader(self):
        for name in ('a', 'stuck', 'z'):
            (self.root / name).mkdir()
            (self.root / name / 'x.mp4').write_bytes(b'x')
        stuck = os.fspath(self.root / 'stuck')
        script = ('import sys, time\nimport peach.media_io as m\nread = m._local_directory\n'
                  'def slow(path, value):\n'
                  f'    if path == {stuck!r}: time.sleep(60)\n'
                  '    return read(path, value)\n'
                  'm._local_directory = slow\nsys.exit(m.main(sys.argv[1:]))\n')
        children, spawning = self._spawned(script)
        with patch.object(media_io, 'TIMEOUT_SECONDS', 1.0), spawning:
            listings = dict(media_io.read_directories([self.root], walk=True))
        self.assertIsInstance(listings.pop(stuck), TimeoutError)
        self.assertEqual({Path(directory).name: [entry.name for entry in listing] for directory, listing in listings.items()
                          if Path(directory) != self.root}, {'a': ['x.mp4'], 'z': ['x.mp4']})
        self.assertEqual(len(children), 2)
        self.assertTrue(all(child.poll() is not None for child in children))

    def test_one_remover_deletes_in_order_and_a_stuck_directory_times_out_alone(self):
        for name in ('a', 'stuck', 'z', 'full'):
            (self.root / name).mkdir()
        (self.root / 'full' / 'x.mp4').write_bytes(b'x')
        stuck = os.fspath(self.root / 'stuck')
        script = ('import os, sys, time\nimport peach.media_io as m\nrmdir = os.rmdir\n'
                  'def slow(path):\n'
                  f'    if path == {stuck!r}: time.sleep(60)\n'
                  '    return rmdir(path)\n'
                  'os.rmdir = slow\nsys.exit(m.main(sys.argv[1:]))\n')
        children, original_popen = [], subprocess.Popen

        def spawn(command, **options):
            if command[-2] == 'rmdirs':
                command = [sys._base_executable, '-c', script, *command[-2:]]
            child = original_popen(command, **options)
            children.append(child)
            return child
        names = ('a', 'stuck', 'z', 'full', 'gone')
        with patch.object(media_io, 'TIMEOUT_SECONDS', 1.0), \
                patch.object(media_io.subprocess, 'Popen', side_effect=spawn):
            results = list(media_io.remove_directories([self.root / name for name in names]))
        self.assertEqual([Path(path).name for path, _result in results], list(names))
        verdicts = dict((Path(path).name, result) for path, result in results)
        self.assertIsInstance(verdicts.pop('stuck'), TimeoutError)
        self.assertEqual(verdicts, {'a': 'removed', 'z': 'removed', 'full': 'kept', 'gone': 'gone'})
        self.assertTrue((self.root / 'stuck').is_dir())
        self.assertEqual(len(children), 2)
        self.assertTrue(all(child.poll() is not None for child in children))

    def test_closing_the_listing_early_reaps_the_reader(self):
        """取消在两个目录之间生效：调用方不读了，读取子进程不能留着。"""
        for name in ('a', 'b', 'c'):
            (self.root / name).mkdir()
        children, spawning = self._spawned()
        with spawning:
            listings = media_io.read_directories([self.root], walk=True)
            next(listings)
            listings.close()
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll())

    def test_presence_answers_each_path_and_a_stalled_answer_is_unknown_not_gone(self):
        """复核失效候选：卡住的那一条答 None（照旧保留），换一个读取进程接着问后面的。"""
        here = self.root / 'here.mp4'
        here.write_bytes(b'x')
        children, original_popen = [], subprocess.Popen

        def first_stalls(command, **options):
            if not children:
                command = [sys._base_executable, '-c', 'import time; time.sleep(60)']
            child = original_popen(command, **options)
            children.append(child)
            return child
        paths = [self.root / 'stuck.mp4', here, self.root / 'gone.mp4']
        with patch.object(media_io, 'TIMEOUT_SECONDS', 1.0), \
                patch.object(media_io.subprocess, 'Popen', side_effect=first_stalls):
            answers = media_io.paths_present(paths)
        self.assertEqual(answers, [None, True, False])
        self.assertEqual(len(children), 2)
        self.assertTrue(all(child.poll() is not None for child in children))

    @staticmethod
    def _entry_line(name):
        entry = dict(name=name, path=name, directory=False, symlink=False, attributes={'st_size': 1}, error='')
        return json.dumps({'entry': entry}).encode() + b'\n'

    @staticmethod
    def _fake_reader(lines):
        reader = Mock()
        reader.stdout = MagicMock()
        reader.stdout.__iter__.return_value = lines
        return reader

    def test_directory_keeps_reading_while_entries_keep_arriving(self):
        """网络盘上的大目录：总时长超过期限，但每条间隔都在期限内，整目录照常读完。"""
        def slow():
            for index in range(12):
                time.sleep(0.1)
                yield self._entry_line(f'{index}.mp4')
            yield b'{"end": 12}\n'
        reader = self._fake_reader(slow())
        started = time.monotonic()
        with patch.object(media_io, 'TIMEOUT_SECONDS', 1.0), \
                patch.object(media_io.subprocess, 'Popen', return_value=reader):
            entries = media_io.directory_entries(self.root)
        self.assertGreater(time.monotonic() - started, 1.0)
        self.assertEqual([entry.name for entry in entries], [f'{index}.mp4' for index in range(12)])
        reader.kill.assert_called_once_with()

    def test_directory_that_stops_returning_entries_times_out_and_reaps_the_reader(self):
        children = []
        original_popen = subprocess.Popen
        line = self._entry_line('first.mp4').decode()
        def stalled(_command, **options):
            script = f'import sys, time; sys.stdout.write({line!r}); sys.stdout.flush(); time.sleep(60)'
            child = original_popen([sys._base_executable, '-c', script], **options)
            children.append(child)
            return child
        with patch.object(media_io, 'TIMEOUT_SECONDS', 1.5), \
                patch.object(media_io.subprocess, 'Popen', side_effect=stalled), \
                self.assertRaises(TimeoutError):
            media_io.directory_entries(self.root)
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll())

    def test_directory_reader_that_exits_without_the_end_marker_fails_the_directory(self):
        """中途断开的半截清单不能当成整个目录交给扫描。"""
        lines = iter([self._entry_line('a.mp4'), self._entry_line('b.mp4')])
        with patch.object(media_io.subprocess, 'Popen', return_value=self._fake_reader(lines)), \
                self.assertRaisesRegex(OSError, '未完成'):
            media_io.directory_entries(self.root)

    def test_identity_is_not_read_for_files_the_scan_never_registers(self):
        for name in ('ABW-101.mp4', 'ABW-101.nfo', 'Thumbs.db'):
            (self.root / name).write_bytes(b'x')
        with patch.object(media_io.os, 'stat', wraps=os.stat) as stat:
            items = list(media_io._local_directory(self.root, 'identity'))
        self.assertEqual(len(items), 3)
        read = {Path(call.args[0]).name for call in stat.call_args_list}
        # Windows 的目录快照没有文件 ID，只给会登记的文件补读；其他系统快照自带，不补读。
        self.assertEqual(read, {'ABW-101.mp4'} if os.name == 'nt' else set())

    def test_packaged_cli_dispatches_the_read_only_worker(self):
        from peach.cli import main
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(main(['media-read', 'online', str(self.root)]), 0)
        self.assertEqual(json.loads(output.getvalue()), {'value': True})

    def test_invalid_nfo_and_art_outside_media_directory_are_rejected(self):
        nfo = self.root / 'broken.nfo'
        nfo.write_text('<movie>', encoding='utf-8')
        with self.assertRaises(ValueError):
            media_io.read_nfo(nfo)
        outside = self.root / 'outside.jpg'
        outside.write_bytes(b'image')
        inside = self.root / 'media'
        inside.mkdir()
        self.assertIsNone(media_io.local_art(inside / 'video.mp4', {'local_art': '../outside.jpg'}))

    def test_failed_directory_is_attempted_once_in_a_task(self):
        listing = library_processing._DirectoryIndex()
        with patch.object(library_processing, 'directory_files', side_effect=TimeoutError('read timed out')) as read:
            for _ in range(3):
                with self.assertRaises(TimeoutError):
                    listing.files(self.root)
        self.assertEqual(read.call_count, 1)

    def test_scan_continues_to_sibling_after_directory_timeout(self):
        from peach.scan import _walk
        good, bad = self.root / 'good', self.root / 'bad'
        good.mkdir()
        bad.mkdir()
        (good / 'video.mp4').write_bytes(b'video')
        def read(path):
            if Path(path) == bad:
                raise TimeoutError('directory read timed out')
            return media_io.directory_entries(path)
        errors = []
        walked = list(_walk(self.root, read_directory=read, onerror=errors.append))
        self.assertEqual(len(errors), 1)
        self.assertEqual([entry.name for directory, entries in walked if Path(directory) == good
                          for entry in entries], ['video.mp4'])

    def test_cover_output_failure_interrupts_instead_of_marking_bad_media(self):
        row = dict(id=1, name='video.mp4')
        issue = Mock()
        with patch('peach.local_poster.read_jpeg', return_value=(b'image', (20, 30))), \
                patch('peach.cover_artwork.install_cover', side_effect=OSError('No space left on device')), \
                self.assertRaisesRegex(OSError, 'No space left on device'):
            library_processing._read_local_posters(
                [(row, self.root / 'source.jpg', 'ABW-101', self.root / 'cover.jpg')],
                dict(speed_mode='standard', covers=0), update=lambda **_: None, issue=issue)
        issue.assert_not_called()

    def test_metadata_persistence_failure_propagates(self):
        remote = Mock()
        remote._evidence.side_effect = PermissionError('Permission denied')
        result = library_processing._MetadataResults(remote, 'ABW-101', Mock())
        with self.assertRaises(library_processing._ProcessingPersistenceError) as caught:
            result.save([('r18dev', {'id': 'ABW-101'})])
        with self.assertRaises(library_processing._ProcessingPersistenceError):
            library_processing._raise_task_failure(caught.exception)

    def test_source_pause_request_is_not_a_file_failure(self):
        from peach.jobs import JobPaused
        for error in (UserInterruptedError('errors.processingControl.stopped'), JobPaused('errors.updateTasks.pausedForInstall')):
            with self.subTest(error=type(error)), self.assertRaises(type(error)):
                library_processing._raise_task_failure(error)

    def test_nfo_timeout_preserves_filename_code_for_external_collection(self):
        video = self.root / 'ABW-101.mp4'
        row = dict(id=1, name=video.name, path=str(video), code='ABW-101')
        listing = Mock()
        listing.files.return_value = {video.name.casefold(): video}
        listing.sidecars.return_value = (video.with_suffix('.nfo'), [])
        issues = Mock()
        with patch.object(library_processing, 'read_nfo', side_effect=TimeoutError('NFO read timed out')):
            result = library_processing._read_local_metadata(
                Mock(), self.root / 'unused.db', row, self.root, listing,
                dict(identified=0, covers=0), Mock(), issues, [])
        self.assertEqual(result, ('ABW-101', True, None, []))
        self.assertTrue(issues.call_args.kwargs['retryable'])

    def test_preview_frames_share_one_deadline(self):
        video = self.root / 'video.mp4'
        video.write_bytes(b'video')
        row = dict(id=1, name=video.name, path=str(video), duration=30, location='local')
        config = self.config
        resolver = Mock()
        resolver.ffmpeg.return_value = SimpleNamespace(path=Path('ffmpeg'))
        now, budgets = [100.0], []
        def capture(*_args, **options):
            budgets.append(options['timeout'])
            now[0] += options['timeout']
            return True
        with patch.object(library_processing.time, 'monotonic', side_effect=lambda: now[0]), \
                patch.object(library_processing, 'metadata_only', return_value=False), \
                patch('peach.frame_capture.capture_with_retry', side_effect=capture), \
                self.assertRaises(library_processing._PreviewCaptureError) as caught:
            library_processing._generate_preview(config, row, Mock(), resolver, progress=lambda: None)
        self.assertEqual(budgets, [45, 45, 30])
        self.assertEqual(caught.exception.diagnostics['reason'], 'timeout')

    def test_preview_timeout_continues_and_only_success_gets_checkpoint(self):
        rows = [dict(id=index, name=f'{index}.mp4', path=str(self.root / f'{index}.mp4'), location='local')
                for index in (1, 2)]
        issue, checkpoint = Mock(), Mock()
        with patch.object(library_processing, '_library_stages', return_value=lambda _: {'preview'}), \
                patch.object(library_processing, 'metadata_only', return_value=False), \
                patch.object(library_processing, '_generate_preview', side_effect=[TimeoutError('timed out'), True]):
            made = library_processing._generate_previews(self.config, rows, Mock(), update=Mock(),
                issue=issue, guard=Mock(), checkpoint=checkpoint)
        self.assertEqual(made, 1)
        self.assertEqual(issue.call_args.args[0]['id'], 1)
        checkpoint.assert_called_once_with(rows[1])

    def test_preview_progress_write_failure_stops_the_batch(self):
        row = dict(id=1, name='video.mp4', path=str(self.root / 'video.mp4'), location='local')
        issue = Mock()
        def capture(_config, _row, _database, _resolver, *, progress):
            progress()
            return True
        with patch.object(library_processing, '_library_stages', return_value=lambda _: {'preview'}), \
                patch.object(library_processing, 'metadata_only', return_value=False), \
                patch.object(library_processing, '_generate_preview', side_effect=capture), \
                self.assertRaises(library_processing._ProcessingPersistenceError):
            library_processing._generate_previews(self.config, [row], Mock(),
                update=Mock(side_effect=[None, PermissionError('Permission denied')]), issue=issue, guard=Mock())
        issue.assert_not_called()


class BoundedReadTests(unittest.TestCase):
    """请求路径上的挂载读取：到期就回，卡住的挂载不再多开线程。"""

    def setUp(self):
        import threading
        self.release = threading.Event()
        self.addCleanup(self.release.set)
        self.key = f'test-mount-{id(self)}'

    def _stuck(self):
        self.release.wait(10)
        return 'late'

    def test_stuck_read_times_out_and_later_reads_on_the_mount_fail_fast(self):
        started = time.monotonic()
        with self.assertRaises(TimeoutError):
            media_io.bounded(self.key, self._stuck, timeout=0.1)
        self.assertLess(time.monotonic() - started, 2)
        calls = []
        with self.assertRaises(TimeoutError):
            media_io.bounded(self.key, calls.append, 1, timeout=5)
        self.assertEqual(calls, [])
        # 别的挂载照常读。
        self.assertEqual(media_io.bounded(self.key + '-other', lambda: 'ok', timeout=1), 'ok')

    def test_mount_reopens_once_the_stuck_read_returns(self):
        with self.assertRaises(TimeoutError):
            media_io.bounded(self.key, self._stuck, timeout=0.1)
        self.release.set()
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try:
                self.assertEqual(media_io.bounded(self.key, lambda: 'ok', timeout=1), 'ok')
                return
            except TimeoutError:
                time.sleep(0.01)
        self.fail('卡住的读取返回后，挂载没有放行')

    def test_a_read_lost_for_good_does_not_close_the_mount_until_restart(self):
        """卡着的那次永远不回：隔一段时间放一个请求去试，答上了就整个挂载放行。"""
        with patch.object(media_io, 'REQUEST_RETRY_SECONDS', 0.2):
            with self.assertRaises(TimeoutError):
                media_io.bounded(self.key, self._stuck, timeout=0.1)
            with self.assertRaises(TimeoutError):
                media_io.bounded(self.key, lambda: 'ok', timeout=1)
            time.sleep(0.3)
            self.assertEqual(media_io.bounded(self.key, lambda: 'ok', timeout=1), 'ok')
            self.assertEqual(media_io.bounded(self.key, lambda: 'again', timeout=1), 'again')

    def test_a_timeout_raised_by_the_read_itself_is_not_taken_for_a_stuck_mount(self):
        def inner_timeout():
            raise TimeoutError('socket timed out')
        with self.assertRaises(TimeoutError):
            media_io.bounded(self.key, inner_timeout, timeout=5)
        self.assertNotIn(self.key, media_io._bounded_stuck)
        self.assertEqual(media_io.bounded(self.key, lambda: 'ok', timeout=1), 'ok')

    def test_errors_from_the_read_reach_the_caller(self):
        def missing():
            raise FileNotFoundError(2, 'gone')
        with self.assertRaises(FileNotFoundError):
            media_io.bounded(self.key, missing)
        self.assertNotIn(self.key, media_io._bounded_active)

    def test_concurrent_reads_on_one_mount_are_capped(self):
        import threading
        with patch.object(media_io, 'REQUEST_SLOTS_PER_MOUNT', 2):
            waiting = [threading.Thread(target=lambda: self.assertRaises(
                TimeoutError, media_io.bounded, self.key, self._stuck, timeout=1)) for _ in range(2)]
            for thread in waiting:
                thread.start()
            deadline = time.monotonic() + 2
            while media_io._bounded_active.get(self.key, 0) < 2 and time.monotonic() < deadline:
                time.sleep(0.01)
            started = time.monotonic()
            with self.assertRaises(TimeoutError):
                media_io.bounded(self.key, lambda: 'ok', timeout=5)
            self.assertLess(time.monotonic() - started, 0.5)
            for thread in waiting:
                thread.join(5)

    def test_mount_key_groups_by_drive_or_top_directories(self):
        if os.name == 'nt':
            self.assertEqual(media_io.mount_key(Path('A:/番号/one.mp4')), 'a:')
            self.assertEqual(media_io.mount_key(Path('//nas/share/x/one.mp4')),
                             media_io.mount_key(Path('//NAS/Share/y/two.mp4')))
            self.assertNotEqual(media_io.mount_key(Path('//nas/share/x/one.mp4')),
                                media_io.mount_key(Path('//nas/other/x/one.mp4')))
        else:
            self.assertEqual(media_io.mount_key(Path('/Volumes/Media/x/one.mp4')), '/Volumes/Media')
