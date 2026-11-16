"""Matroska 索引按视频轨和时间尺度解释，远端读取避开媒体 Cluster。"""
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from peach.mkvindex import keyframe_seconds
from support.mkv import minimal_mkv


class MatroskaIndexTests(unittest.TestCase):
    def test_tail_cues_are_read_without_media_payload(self):
        class Reader(io.BytesIO):
            read_bytes = 0

            def read(self, size=-1):
                result = super().read(size)
                self.read_bytes += len(result)
                return result

        stream = Reader(minimal_mkv(media_bytes=4 << 20))
        with patch("peach.mkvindex.open", return_value=stream):
            self.assertEqual(keyframe_seconds("virtual.mkv"), [0, 2.5, 5, 7.5, 10])
        self.assertLess(stream.read_bytes, 4096)

    def test_timestamps_follow_the_segment_scale(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp).resolve() / "clip.mkv"
            path.write_bytes(minimal_mkv(scale=2_000_000))
            self.assertEqual(keyframe_seconds(path), [0, 5, 10, 15, 20])

    def test_missing_or_malformed_index_is_not_guessed(self):
        for data in (b"not a video", minimal_mkv(cues=False), minimal_mkv()[:-10]):
            with self.subTest(length=len(data)), patch("peach.mkvindex.open", return_value=io.BytesIO(data)):
                self.assertIsNone(keyframe_seconds("virtual.mkv"))

    def test_index_budget_rejects_large_metadata(self):
        with patch("peach.mkvindex.open", return_value=io.BytesIO(minimal_mkv())), \
                patch("peach.mkvindex.MAX_INDEX_BYTES", 32):
            self.assertIsNone(keyframe_seconds("virtual.mkv"))
