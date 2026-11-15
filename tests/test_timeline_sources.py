"""已有时间轴预览的格式读取、视频配对与媒体出口。"""
from __future__ import annotations

import io
import json
import shutil
import sqlite3
import struct
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image
from fastapi import FastAPI
from fastapi.testclient import TestClient

from peach import routes_media, timeline_sources as sources, web_timeline_thumbnails as web
from support.stalls import stalled_mount


class TimelineSourceTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='timeline-sources-')).resolve()
        self.addCleanup(lambda: shutil.rmtree(self.root, ignore_errors=True))
        self.video = self.root / 'movie.mp4'

    def image(self, name='sprite.jpg', size=(640, 180)):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new('RGB', size, 'red')
        if size[0] > 320:
            image.paste('blue', (320, 0, size[0], size[1]))
        image.save(path)
        return path

    def text(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        return path

    def vtt(self, payload='sprite.jpg#xywh=0,0,320,180', end='00:10.000'):
        return self.text('movie.vtt', f'WEBVTT\n\n00:00.000 --> {end}\n{payload}\n')

    def test_vtt_cues_keep_nonuniform_times_and_crop_the_selected_tile(self):
        self.image()
        self.text('movie.vtt', 'WEBVTT\n\nNOTE source\nignored\n\nfirst\n'
                  '00:00.000 --> 00:03.500\nsprite.jpg#xywh=0,0,320,180\n\n'
                  '00:03.500 --> 00:11.000 align:start\nsprite.jpg#xywh=320,0,320,180\n')
        timeline = sources.discover(self.video, 11)
        self.assertEqual(timeline.metadata()['cues'], [[0, 3.5], [3.5, 11]])
        data = sources.frame_bytes(timeline, 1)
        with Image.open(io.BytesIO(data)) as image:
            self.assertEqual(image.size, (320, 180))
            red, _, blue = image.getpixel((100, 90))
            self.assertGreater(blue, red + 100)

    def test_vtt_can_reference_individual_webp_and_percent_encoded_names(self):
        self.image('frames/one frame.webp', (100, 200))
        self.vtt('frames/one%20frame.webp')
        timeline = sources.discover(self.video, 10)
        with Image.open(io.BytesIO(sources.frame_bytes(timeline, 0))) as image:
            self.assertEqual(image.size, (100, 200))

    def test_subtitle_cues_are_not_image_previews(self):
        self.vtt('这是字幕正文')
        self.assertIsNone(sources.discover(self.video, 10))

    def test_unsafe_or_missing_references_and_out_of_bounds_crops_are_unavailable(self):
        self.image()
        for payload in ('../outside.jpg', '%2e%2e/outside.jpg', 'https://example.com/a.jpg',
                        '//example.com/a.jpg', 'C:/private.jpg', 'file:///private.jpg',
                        'sprite.jpg#xywh=600,0,320,180', 'sprite.jpg#xywh=0,0,0,180',
                        'missing.jpg', 'sprite.jpg#xywh=percent:0,0,50,50'):
            with self.subTest(payload=payload):
                self.vtt(payload)
                self.assertIsNone(sources.discover(self.video, 10))

    def test_overlap_and_invalid_time_are_unavailable(self):
        self.image()
        self.text('movie.vtt', 'WEBVTT\n\n00:00.000 --> 00:10.000\nsprite.jpg\n\n'
                  '00:09.000 --> 00:12.000\nsprite.jpg\n')
        self.assertIsNone(sources.discover(self.video, 12))
        self.vtt(end='00:61.000')
        self.assertIsNone(sources.discover(self.video, 61))

    def test_vtt_without_an_end_time_is_unavailable(self):
        self.image()
        self.text('movie.vtt', 'WEBVTT\n\n00:00.000 --> \nsprite.jpg\n')
        self.assertIsNone(sources.discover(self.video, 10))

    def test_previews_are_paired_by_exact_video_name(self):
        self.image()
        self.vtt()
        self.assertIsNone(sources.discover(self.root / 'movie-4k.mp4', 10))

    def test_a_video_without_previews_costs_one_directory_listing(self):
        """网盘上每次 stat 都是一趟网络往返：没有预览的片子只列一次目录，不逐个候选 stat。"""
        self.image()
        listings = []
        entries = sources.media_io.directory_entries

        def counting(path):
            listings.append(path)
            return entries(path)
        with patch.object(sources.media_io, 'directory_entries', side_effect=counting), \
                patch.object(Path, 'stat', side_effect=AssertionError('逐个候选 stat')):
            self.assertIsNone(sources.discover(self.root / 'other.mp4', 10))
        self.assertEqual(len(listings), 1)
        self.vtt()
        if sources.os.name == 'nt':
            with patch.object(Path, 'resolve', side_effect=AssertionError('网盘上 resolve 一次要几秒')):
                self.assertEqual(sources.discover(self.video, 10).source, 'webvtt')

    def test_the_route_keeps_its_pairing_across_commits(self):
        """预览不在账本里：配对结果按资产长缓存，不跟着提交清空，也记住「没有」。"""
        database = self.root / 'ledger.db'
        with sqlite3.connect(database) as connection:
            connection.execute('CREATE TABLE asset(id INTEGER PRIMARY KEY,path TEXT,duration REAL,medium TEXT,disposal TEXT)')
            connection.execute('INSERT INTO asset VALUES(1,?,10,"video",NULL)', (str(self.video),))
        contract = SimpleNamespace(read_connection=lambda: sqlite3.connect(f'file:{database}?mode=ro', uri=True))
        with patch.object(web.timeline_sources, 'discover', return_value=None) as discover:
            self.assertIsNone(web.external_timeline(contract, 1))
            self.assertIsNone(web.external_timeline(contract, 1))
        discover.assert_called_once()

    def test_a_stuck_drive_answers_without_pairing_and_is_not_remembered(self):
        """网盘答不上：这次按没有预览回，不挂住请求；也不把「没有」记进缓存，盘恢复后照常配对。"""
        self.image()
        self.vtt()
        database = self.root / 'ledger.db'
        with sqlite3.connect(database) as connection:
            connection.execute('CREATE TABLE asset(id INTEGER PRIMARY KEY,path TEXT,duration REAL,medium TEXT,disposal TEXT)')
            connection.execute('INSERT INTO asset VALUES(7,?,10,"video",NULL)', (str(self.video),))
        contract = SimpleNamespace(read_connection=lambda: sqlite3.connect(f'file:{database}?mode=ro', uri=True))
        web._SIDECARS.clear()
        self.addCleanup(web._SIDECARS.clear)
        with stalled_mount(self.root):
            started = time.monotonic()
            self.assertIsNone(web.external_timeline(contract, 7))
            self.assertLess(time.monotonic() - started, 3)
        self.assertEqual(web.external_timeline(contract, 7).source, 'webvtt')

    def hls(self, layout='2x1', duration=15, interval=10):
        return self.text('movie.m3u8', '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:20\n'
                         '#EXT-X-IMAGES-ONLY\n'
                         f'#EXTINF:{duration},\n#EXT-X-TILES:RESOLUTION=320x180,LAYOUT={layout},DURATION={interval}\n'
                         'sprite.jpg\n#EXT-X-ENDLIST\n')

    def test_hls_tiles_bound_the_final_cue_to_the_segment_end(self):
        self.image()
        self.hls()
        timeline = sources.discover(self.video, 15)
        self.assertEqual(timeline.source, 'hls')
        self.assertEqual(timeline.metadata()['cues'], [[0, 10], [10, 15]])

    def test_hls_master_uses_only_image_renditions(self):
        self.image()
        self.hls().rename(self.root / 'images.m3u8')
        self.text('movie.m3u8', '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100000\nvideo.m3u8\n'
                  '#EXT-X-IMAGE-STREAM-INF:BANDWIDTH=1000,RESOLUTION=320x180,CODECS="jpeg",URI="images.m3u8"\n')
        self.assertEqual(sources.discover(self.video, 15).source, 'hls')

    def test_hls_individual_images_are_supported(self):
        self.image(size=(320, 180))
        self.text('movie.m3u8', '#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXT-X-IMAGES-ONLY\n'
                  '#EXTINF:10,\nsprite.jpg\n#EXT-X-ENDLIST\n')
        self.assertEqual(sources.discover(self.video, 10).metadata()['cues'], [[0, 10]])

    def test_hls_live_video_encrypted_and_invalid_grid_are_unavailable(self):
        self.image()
        for replacement in ('#EXT-X-IMAGES-ONLY', '#EXT-X-ENDLIST'):
            path = self.hls()
            path.write_text(path.read_text().replace(replacement, ''), encoding='utf-8')
            self.assertIsNone(sources.discover(self.video, 15))
        for layout, duration, interval in (('0x1', 15, 10), ('2x1', 15, 0), ('2x1', 30, 10)):
            self.hls(layout, duration, interval)
            self.assertIsNone(sources.discover(self.video, 15))
        path = self.hls()
        path.write_text(path.read_text().replace('#EXTINF', '#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF'))
        self.assertIsNone(sources.discover(self.video, 15))

    def mpd(self, template='duration="20" startNumber="3"', body='', layout='2x1', duration=30):
        return self.text('movie.mpd', f'<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" mediaPresentationDuration="PT{duration}S">'
                         '<Period><AdaptationSet contentType="image" mimeType="image/jpeg">'
                         f'<SegmentTemplate media="frames/$RepresentationID$-$Number%03d$.jpg" {template}>{body}</SegmentTemplate>'
                         '<Representation id="thumbs" bandwidth="1000">'
                         f'<EssentialProperty schemeIdUri="http://dashif.org/guidelines/thumbnail_tile" value="{layout}"/>'
                         '</Representation></AdaptationSet></Period></MPD>')

    def test_dash_template_expands_number_and_preserves_tile_duration(self):
        self.image('frames/thumbs-003.jpg')
        self.image('frames/thumbs-004.jpg')
        self.mpd()
        timeline = sources.discover(self.video, 30)
        self.assertEqual(timeline.source, 'dash')
        self.assertEqual(timeline.metadata()['cues'], [[0, 10], [10, 20], [20, 30]])

    def test_dash_timeline_timescale_offset_and_negative_repeat(self):
        for number in (1, 2, 3):
            self.image(f'frames/thumbs-{number:03d}.jpg')
        self.mpd('timescale="10" presentationTimeOffset="100"',
                 '<SegmentTimeline><S t="100" d="100" r="-1"/></SegmentTimeline>')
        timeline = sources.discover(self.video, 30)
        self.assertEqual(timeline.metadata()['cues'], [[0, 5], [5, 10], [10, 15], [15, 20], [20, 25], [25, 30]])

    def test_dash_infers_period_duration_from_the_next_start(self):
        self.image('frames/thumbs-003.jpg')
        self.image('frames/thumbs-004.jpg')
        path = self.mpd(duration=60)
        text = path.read_text()
        period = text[text.index('<Period>'):text.index('</Period>') + len('</Period>')]
        path.write_text(text.replace(period, period.replace('<Period>', '<Period start="PT0S">')
                                     + period.replace('<Period>', '<Period start="PT30S">')))
        timeline = sources.discover(self.video, 60)
        self.assertEqual(timeline.metadata()['cues'], [[0, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60]])

    def test_dash_grid_must_have_positive_dimensions(self):
        self.image('frames/thumbs-003.jpg')
        for layout in ('0x1', '1x0', '', '1', '999999x999999'):
            self.mpd(layout=layout)
            with self.subTest(layout=layout):
                self.assertIsNone(sources.discover(self.video, 30))

    def test_dash_entities_dynamic_manifests_and_unbounded_counts_are_unavailable(self):
        self.image('frames/thumbs-003.jpg')
        for prefix in ('<!DOCTYPE MPD [<!ENTITY x SYSTEM "file:///private">]>', '<!ENTITY x "a">'):
            path = self.mpd()
            path.write_text(prefix + path.read_text())
            self.assertIsNone(sources.discover(self.video, 30))
        path = self.mpd()
        path.write_text(path.read_text().replace('<MPD ', '<MPD type="dynamic" '))
        self.assertIsNone(sources.discover(self.video, 30))
        self.mpd('duration="1"', duration=1000000)
        self.assertIsNone(sources.discover(self.video, 1000000))

    def test_jellyfin_padded_last_sheet_uses_real_count_and_millisecond_interval(self):
        directory = 'movie.trickplay/320 - 2x2'
        self.image(directory + '/0.jpg', (640, 360))
        self.image(directory + '/1.jpg', (640, 360))
        self.text(directory + '/trickplay.json', json.dumps({
            'Width': 320, 'TileWidth': 2, 'TileHeight': 2, 'Interval': 5000, 'ThumbnailCount': 5}))
        timeline = sources.discover(self.video, 25)
        self.assertFalse(timeline.estimated)
        self.assertEqual(timeline.metadata()['cues'][-1], [20, 25])
        self.assertEqual(timeline.frames[-1].box, (0, 0, 320, 180))
        self.assertIsNone(sources.frame_bytes(timeline, 5))

    def test_jellyfin_without_index_marks_default_interval_as_estimated(self):
        self.image('movie.trickplay/320 - 2x2/0.jpg', (640, 360))
        timeline = sources.discover(self.video, 30)
        self.assertTrue(timeline.estimated)
        self.assertEqual(timeline.metadata()['cues'], [[0, 10], [10, 20], [20, 30]])
        self.assertIsNone(sources.discover(self.video, 100))

    def test_jellyfin_missing_number_is_not_a_continuous_time_axis(self):
        self.image('movie.trickplay/320 - 2x2/1.jpg', (640, 360))
        self.assertIsNone(sources.discover(self.video, 30))

    def test_emby_named_bif_uses_embedded_timestamps(self):
        output = io.BytesIO()
        Image.new('RGB', (320, 180), 'green').save(output, 'JPEG')
        image = output.getvalue()
        start = 64 + 3 * 8
        header = b'\x89BIF\r\n\x1a\n' + struct.pack('<III', 0, 2, 1000) + bytes(44)
        entries = struct.pack('<IIIIII', 0, start, 7, start + len(image), 0xffffffff, start + len(image) * 2)
        (self.root / 'movie-320-10.bif').write_bytes(header + entries + image * 2)
        timeline = sources.discover(self.video, 20)
        self.assertEqual(timeline.metadata()['cues'], [[0, 7], [7, 20]])
        self.assertEqual(sources.frame_bytes(timeline, 1), image)
        self.assertIsNone(sources.discover(self.root / 'movie-4k.mp4', 20))

    def test_large_indexes_are_not_read_in_full(self):
        self.image()
        self.vtt()
        with patch.object(sources, 'MAX_INDEX_BYTES', 8):
            self.assertIsNone(sources.discover(self.video, 10))

    def test_media_route_returns_exact_crop_etag_head_and_missing_index(self):
        self.image()
        self.vtt('sprite.jpg#xywh=320,0,320,180')
        database = self.root / 'ledger.db'
        with sqlite3.connect(database) as connection:
            connection.execute('CREATE TABLE asset(id INTEGER PRIMARY KEY,path TEXT,duration REAL,medium TEXT,disposal TEXT)')
            connection.execute('INSERT INTO asset VALUES(1,?,10,"video",NULL)', (str(self.video),))
        contract = SimpleNamespace(
            read_connection=lambda: sqlite3.connect(f'file:{database}?mode=ro', uri=True),
            cached_lru=lambda _key, function, **_kwargs: function(), timeline_root=self.root / 'cache')
        self.assertEqual(web.q_timeline(contract, {'id': '1'})['source'], 'webvtt')
        self.assertEqual(web.q_timeline(contract, {'id': '2'}), {})
        cached = contract.timeline_root / '01' / '1'
        cached.mkdir(parents=True)
        (cached / 'meta.json').write_text(json.dumps({'frames': 100, 'interval': 10, 'columns': 10, 'rows': 10}))
        Image.new('RGB', (3200, 1800), 'yellow').save(cached / '000.jpg')
        self.assertEqual(web.q_timeline(contract, {'id': '1'})['fallback']['source'], 'peach')
        app = FastAPI()
        app.state.web_contract = contract
        app.include_router(routes_media.router)
        app.dependency_overrides[routes_media.require_auth] = lambda: {}
        with TestClient(app) as client:
            response = client.get('/timeline?id=1&s=0')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['content-type'], 'image/jpeg')
            with Image.open(io.BytesIO(response.content)) as image:
                self.assertEqual(image.size, (320, 180))
            self.assertEqual(client.get('/timeline?id=1&s=0', headers={'If-None-Match': response.headers['etag']}).status_code, 304)
            self.assertEqual(client.head('/timeline?id=1&s=0').content, b'')
            self.assertEqual(client.get('/timeline?id=1&s=1').status_code, 404)
            self.assertEqual(client.get('/timeline?id=-1&s=0').status_code, 404)
            self.assertEqual(client.get('/timeline?id=1&s=-1').status_code, 404)
            self.assertEqual(client.get('/timeline?id=1&s=0&source=bif').status_code, 404)
            self.assertEqual(client.get('/timeline?id=1&s=0&source=../private').status_code, 404)
            with Image.open(io.BytesIO(client.get('/timeline?id=1&s=0&source=peach').content)) as image:
                self.assertEqual(image.size, (3200, 1800))


if __name__ == '__main__':
    unittest.main()
