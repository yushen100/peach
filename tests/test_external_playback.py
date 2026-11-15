"""外部播放器票据只授权单资产、限时读取；本机播放器的进度经假 IPC / HTTP 端点回传。"""
import base64
import json
import socket
import threading
import time
import unittest
import urllib.error
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import MagicMock, patch

from peach.external_playback import TTL_SECONDS, issue, valid
from peach import local_playback
from peach import playback_tracking as tracking
from support.stalls import stalled_mount


class ExternalPlaybackTests(unittest.TestCase):
    def test_ticket_is_scoped_expiring_and_tamper_evident(self):
        key = b'one-instance-key'
        ticket = issue(key, 42, now=100)
        self.assertTrue(valid(key, 42, ticket, now=101))
        self.assertFalse(valid(key, 43, ticket, now=101))
        self.assertFalse(valid(b'another-instance', 42, ticket, now=101))
        self.assertFalse(valid(key, 42, ticket, now=100 + TTL_SECONDS))
        self.assertFalse(valid(key, 42, ticket + '0', now=101))
        self.assertFalse(valid(key, 42, '../../media.mp4', now=101))

    def test_ticket_binds_origin(self):
        ticket = issue(b'key', 1, origin='https://public.example', now=100)
        self.assertTrue(valid(b'key', 1, ticket, origin='https://public.example', now=101))
        self.assertFalse(valid(b'key', 1, ticket, origin='https://other.example', now=101))
        self.assertFalse(valid(b'key', 1, ticket, now=101))

    def test_default_player_uses_windows_file_association(self):
        with tempfile.TemporaryDirectory() as directory:
            media = Path(directory).resolve() / '测试 movie.mp4'
            media.write_bytes(b'video')
            with patch.object(local_playback.sys, 'platform', 'win32'), \
                    patch.dict(os.environ, {'PEACH_HEADLESS_MANAGED': '0'}), \
                    patch.object(os, 'startfile', create=True) as launch:
                local_playback.open_media(media)
                launch.assert_called_once_with(str(media), 'open')

    def test_mac_selected_player_uses_open_without_shell(self):
        with tempfile.TemporaryDirectory() as directory:
            media = Path(directory).resolve() / 'movie.mp4'
            media.write_bytes(b'video')
            with patch.object(local_playback.sys, 'platform', 'darwin'), \
                    patch.dict(os.environ, {'PEACH_HEADLESS_MANAGED': '0'}), \
                    patch.object(local_playback, 'installed', return_value={'iina': ('IINA', '/Applications/IINA.app')}), \
                    patch.object(local_playback.subprocess, 'run') as launch:
                local_playback.open_media(media, 'iina')
                self.assertEqual(launch.call_args.args[0], ['/usr/bin/open', '-a', '/Applications/IINA.app', str(media)])
                local_playback.open_media(media)
                self.assertEqual(launch.call_args.args[0], ['/usr/bin/open', str(media)])

    def test_mounted_media_path_supports_file_access_without_final_path_resolution(self):
        with tempfile.TemporaryDirectory() as directory:
            media = Path(directory).resolve() / 'mounted.mp4'
            media.touch()
            with patch.object(local_playback.sys, 'platform', 'win32'), \
                    patch.dict(os.environ, {'PEACH_HEADLESS_MANAGED': '0'}), \
                    patch.object(Path, 'resolve', side_effect=OSError(1005, '挂载卷不支持最终路径解析')), \
                    patch.object(os, 'startfile', create=True) as launch, \
                    patch.object(local_playback, 'installed', return_value={'potplayer': ('PotPlayer', 'player.exe')}), \
                    patch.object(local_playback.subprocess, 'Popen') as selected:
                local_playback.open_media(media)
                launch.assert_called_once_with(str(media), 'open')
                local_playback.open_media(media, 'potplayer')
                self.assertEqual(selected.call_args.args[0], ['player.exe', str(media)])

    def test_a_stuck_drive_fails_within_the_deadline_without_launching(self):
        with tempfile.TemporaryDirectory() as directory:
            media = Path(directory).resolve() / 'stuck' / 'movie.mp4'
            media.parent.mkdir()
            media.write_bytes(b'video')
            with patch.object(local_playback.sys, 'platform', 'win32'), \
                    patch.dict(os.environ, {'PEACH_HEADLESS_MANAGED': '0'}), \
                    patch.object(os, 'startfile', create=True) as launch, \
                    stalled_mount(media.parent):
                started = time.monotonic()
                with self.assertRaises(TimeoutError):
                    local_playback.open_media(media)
                self.assertLess(time.monotonic() - started, 3)
            launch.assert_not_called()

    def test_headless_deployment_and_unknown_player_cannot_launch(self):
        with patch.dict(os.environ, {'PEACH_HEADLESS_MANAGED': '1'}):
            self.assertFalse(local_playback.available())
            self.assertEqual(local_playback.installed(), {})
            with self.assertRaises(ValueError):
                local_playback.open_media(Path('movie.mp4'))
        with tempfile.TemporaryDirectory() as directory:
            media = Path(directory).resolve() / 'movie.mp4'
            media.touch()
            with patch.object(local_playback, 'available', return_value=True), \
                    patch.object(local_playback, 'installed', return_value={}):
                with self.assertRaises(ValueError):
                    local_playback.open_media(media, 'cmd.exe')
                script = media.with_suffix('.exe')
                script.touch()
                with self.assertRaises(ValueError):
                    local_playback.open_media(script)

    def test_tracked_players_open_random_ipc_endpoints(self):
        with tempfile.TemporaryDirectory() as directory:
            media = Path(directory).resolve() / 'movie.mp4'
            media.write_bytes(b'video')
            track = MagicMock(return_value=True)
            players = {'mpv': ('mpv', 'C:/mpv/mpv.exe'), 'vlc': ('VLC', 'C:/VLC/vlc.exe')}
            with patch.object(local_playback.sys, 'platform', 'win32'), \
                    patch.dict(os.environ, {'PEACH_HEADLESS_MANAGED': '0'}), \
                    patch.object(local_playback, 'installed', return_value=players), \
                    patch.object(local_playback.subprocess, 'Popen') as launch:
                self.assertTrue(local_playback.open_media(media, 'mpv', track=track))
                command = launch.call_args.args[0]
                self.assertEqual((command[0], command[-1]), ('C:/mpv/mpv.exe', str(media)))
                self.assertRegex(command[1], r'^--input-ipc-server=\\\\\.\\pipe\\peach-mpv-[0-9a-f]{24}$')
                self.assertTrue(local_playback.open_media(media, 'vlc', track=track))
                vlc = launch.call_args.args[0]
                self.assertIn('--extraintf=http', vlc)
                self.assertIn('--http-host=127.0.0.1', vlc)
                self.assertTrue(any(part.startswith('--http-password=') and len(part) > 20 for part in vlc))
                self.assertEqual(track.call_count, 2)
                self.assertFalse(local_playback.open_media(media, 'mpv'))
                self.assertEqual(launch.call_args.args[0], ['C:/mpv/mpv.exe', str(media)])

    def test_mac_iina_tracks_through_iina_cli_and_vlc_keeps_open(self):
        with tempfile.TemporaryDirectory() as directory:
            media = Path(directory).resolve() / 'movie.mp4'
            media.write_bytes(b'video')
            track = MagicMock(return_value=True)
            players = {'iina': ('IINA', '/Applications/IINA.app'), 'vlc': ('VLC', '/Applications/VLC.app')}
            with patch.object(local_playback.sys, 'platform', 'darwin'), \
                    patch.dict(os.environ, {'PEACH_HEADLESS_MANAGED': '0'}), \
                    patch.object(local_playback, 'installed', return_value=players), \
                    patch.object(local_playback.subprocess, 'Popen') as launch, \
                    patch.object(local_playback.subprocess, 'run') as opened:
                self.assertTrue(local_playback.open_media(media, 'iina', track=track))
                command = launch.call_args.args[0]
                self.assertEqual(Path(command[0]).as_posix(), '/Applications/IINA.app/Contents/MacOS/iina-cli')
                self.assertRegex(command[1], r'^--mpv-input-ipc-server=.+peach-mpv-[0-9a-f]{24}\.sock$')
                self.assertFalse(local_playback.open_media(media, 'vlc', track=track))
                self.assertEqual(opened.call_args.args[0], ['/usr/bin/open', '-a', '/Applications/VLC.app', str(media)])
                self.assertEqual(track.call_count, 1)


class _FakeMpv(threading.Thread):
    """按脚本回答 get_property，夹几条事件，放完脚本就断开，像 mpv 退出。"""

    def __init__(self, sock, frames, *, eof_event=False):
        super().__init__(daemon=True)
        self.sock, self.frames, self.eof_event = sock, list(frames), eof_event

    def run(self):
        reader = self.sock.makefile('rb')
        try:
            for index, frame in enumerate(self.frames):
                if self.eof_event and index == len(self.frames) - 1:
                    self.sock.sendall(b'{"event":"end-file","reason":"eof"}\n')
                for _ in range(5):
                    request = json.loads(reader.readline())
                    name = request['command'][1]
                    value = frame.get(name)
                    reply = ({'error': 'property unavailable'} if value is None
                             else {'error': 'success', 'data': value})
                    self.sock.sendall(b'{"event":"property-change","name":"x"}\n'
                                      + json.dumps({**reply, 'request_id': request['request_id']}).encode() + b'\n')
        finally:
            reader.close()
            self.sock.close()


def _frame(position, duration=100.0, paused=False):
    return {'idle-active': False, 'time-pos': position, 'duration': duration, 'pause': paused, 'eof-reached': False}


class PlaybackTrackingTests(unittest.TestCase):
    def _run(self, connect, alive=lambda: True, **options):
        reports = []
        trackers = tracking.PlaybackTrackers(poll=0.001, connect_wait=0.2, **options)
        started = trackers.start(tracking.Session(7, connect, alive, lambda body, first: reports.append((body, first))))
        self.assertTrue(started)
        deadline = time.monotonic() + 5
        while trackers.threads and time.monotonic() < deadline:
            time.sleep(0.01)
        trackers.stop()
        self.assertFalse(trackers.threads)
        return reports

    def _mpv(self, frames, **options):
        ours, theirs = socket.socketpair()
        server = _FakeMpv(theirs, frames, eof_event=options.pop('eof_event', False))
        server.start()
        connections = []

        def connect():
            if connections:
                raise OSError('mpv accepts one connection only')
            connections.append(ours)
            return tracking.MpvProbe(tracking.SocketChannel(ours))
        reports = self._run(connect, **options)
        server.join(5)
        return reports

    def test_an_mpv_that_only_sends_events_cannot_hold_a_question_past_its_deadline(self):
        """mpv 活着却不答、事件照推：一次问答按总期限结束，跟踪线程不会一直占着名额。"""
        ours, theirs = socket.socketpair()
        self.addCleanup(ours.close)
        self.addCleanup(theirs.close)

        def chatter():
            try:
                for _ in range(100):
                    theirs.sendall(b'{"event":"property-change","name":"x"}\n')
                    time.sleep(0.05)
            except OSError:
                pass
        threading.Thread(target=chatter, daemon=True).start()
        probe = tracking.MpvProbe(tracking.SocketChannel(ours))
        with patch.object(tracking, 'REQUEST_SECONDS', 0.3):
            started = time.monotonic()
            with self.assertRaises(TimeoutError):
                probe.get('time-pos')
            self.assertLess(time.monotonic() - started, 2)

    def test_a_silent_named_pipe_read_ends_at_its_deadline(self):
        """Windows 命名管道的同步句柄没有读超时：读取交给后台线程，`recv` 只等到期限。"""
        release = threading.Event()
        handle = MagicMock()
        handle.read.side_effect = lambda size: (release.wait(10), b'')[1]
        self.addCleanup(release.set)
        channel = tracking.PipeChannel(handle)
        started = time.monotonic()
        with self.assertRaises(TimeoutError):
            channel.recv(0.2)
        self.assertLess(time.monotonic() - started, 2)
        channel.close()
        release.set()

    def test_mpv_counts_continuous_playback_and_seeks_until_exit(self):
        # 第一帧被连接探测吃掉；暂停期间的前进与大跳都不算观看。
        frames = [_frame(10), _frame(10), _frame(11), _frame(12), _frame(12, paused=True),
                  _frame(13, paused=True), _frame(60), _frame(61), _frame(62.5)]
        reports = self._mpv(frames, flush_every=3600)
        self.assertEqual(len(reports), 1)
        body, first = reports[0]
        self.assertTrue(first)
        self.assertEqual(body['id'], 7)
        self.assertAlmostEqual(body['delta'], 4.5)
        self.assertEqual((body['position'], body['duration'], body['seeks'], body['ended']), (62.5, 100.0, 1, False))

    def test_mpv_end_of_file_marks_ended(self):
        reports = self._mpv([_frame(50), _frame(50), _frame(51)], flush_every=3600, eof_event=True)
        self.assertTrue(reports[-1][0]['ended'])
        near_end = self._mpv([_frame(96), _frame(96), _frame(98.5)], flush_every=3600)
        self.assertTrue(near_end[-1][0]['ended'])

    def test_periodic_flush_records_play_once(self):
        frames = [_frame(0)] + [_frame(float(second)) for second in range(6)]
        reports = self._mpv(frames, flush_every=0)
        self.assertGreater(len(reports), 1)
        self.assertEqual([first for _, first in reports].count(True), 1)
        self.assertTrue(reports[0][1])
        self.assertAlmostEqual(sum(body['delta'] for body, _ in reports), 5.0)

    def test_nothing_played_or_unreachable_player_records_nothing(self):
        self.assertEqual(self._mpv([_frame(5), _frame(5, paused=True), _frame(5, paused=True)]), [])
        attempts = []

        def refused():
            attempts.append(1)
            raise FileNotFoundError('pipe not found')
        self.assertEqual(self._run(refused, alive=lambda: len(attempts) < 3), [])
        self.assertEqual(len(attempts), 3)

    def test_tracker_count_is_capped_and_stop_releases_threads(self):
        trackers = tracking.PlaybackTrackers(poll=0.01, connect_wait=60)

        def waiting():
            raise OSError('not yet')
        sessions = [tracking.Session(index, waiting, lambda: True, lambda *_: None)
                    for index in range(tracking.MAX_TRACKERS + 1)]
        self.assertEqual([trackers.start(session) for session in sessions],
                         [True] * tracking.MAX_TRACKERS + [False])
        self.assertFalse(trackers.has_room())
        trackers.stop()
        self.assertFalse(trackers.threads)
        self.assertFalse(trackers.start(sessions[0]))

    def test_vlc_status_requires_password_and_detects_finish(self):
        password = 'random-password'
        # 前两条是 VLC 刚起来、还没开始放：第一条被连接探测吃掉，第二条不能被当成放完。
        states = iter([
            {'state': 'stopped', 'time': 0, 'length': 0},
            {'state': 'stopped', 'time': 0, 'length': 0},
            {'state': 'playing', 'time': 1, 'length': 30},
            {'state': 'playing', 'time': 2, 'length': 30},
            {'state': 'playing', 'time': 3, 'length': 30},
            {'state': 'paused', 'time': 3, 'length': 30},
            {'state': 'playing', 'time': 28, 'length': 30},
            {'state': 'playing', 'time': 29, 'length': 30},
            {'state': 'stopped', 'time': 0, 'length': 30},
        ])
        rejected = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                expected = 'Basic ' + base64.b64encode(f':{password}'.encode()).decode()
                if self.path != '/requests/status.json' or self.headers.get('Authorization') != expected:
                    rejected.append(self.path)
                    self.send_response(401)
                    self.end_headers()
                    return
                status = next(states, {'state': 'stopped', 'time': 0, 'length': 30})
                status['information'] = {'category': {'meta': {'filename': 'movie.mp4'}}}
                body = json.dumps(status).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            port = server.server_address[1]
            with self.assertRaises(urllib.error.HTTPError):
                tracking.VlcProbe(port, 'wrong', 'movie.mp4').snapshot()
            self.assertEqual(rejected, ['/requests/status.json'])
            reports = self._run(lambda: tracking.VlcProbe(port, password, 'movie.mp4'), flush_every=3600)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(5)
        self.assertEqual(len(reports), 1)
        body, first = reports[0]
        self.assertTrue(first)
        self.assertEqual((body['delta'], body['seeks'], body['position'], body['ended']), (3.0, 1, 29.0, True))

    def test_vlc_other_file_stops_tracking(self):
        probe = tracking.VlcProbe(1, 'x', 'movie.mp4')
        payload = json.dumps({'state': 'playing', 'time': 5, 'length': 30,
                              'information': {'category': {'meta': {'filename': 'other.mp4'}}}}).encode()
        response = MagicMock()
        response.__enter__.return_value.read.return_value = payload
        with patch.object(probe.opener, 'open', return_value=response):
            self.assertTrue(probe.snapshot().finished)

    def test_vlc_position_prefers_fractional_progress_over_whole_seconds(self):
        probe = tracking.VlcProbe(1, 'x', 'movie.mp4')
        payload = json.dumps({'state': 'playing', 'time': 6, 'length': 20, 'position': 0.3325,
                              'information': {'category': {'meta': {'filename': 'movie.mp4'}}}}).encode()
        response = MagicMock()
        response.__enter__.return_value.read.return_value = payload
        with patch.object(probe.opener, 'open', return_value=response):
            snap = probe.snapshot()
        self.assertAlmostEqual(snap.position, 6.65)
        self.assertEqual((snap.duration, snap.paused, snap.finished), (20.0, False, False))
