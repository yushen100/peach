"""整幅封面的主体部位：挑哪一处、怎么记进人脸记录、卡片怎么用，以及模型从 wheel 里解出。"""
from __future__ import annotations

import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from peach import avatar_watermark, body_parts, cover_artwork
from peach.body_parts import Part
from peach.face_detect import Face


class MainSubjectTests(unittest.TestCase):
    def test_the_largest_subject_part_beats_a_small_face(self):
        """SDDE-613 型：主打臀部，角落里只有一张小脸。"""
        parts = [Part("BUTTOCKS_EXPOSED", .6, .5, .2, .3, .8), Part("FACE_FEMALE", .06, .1, .05, .08, .9),
                 Part("FEET_EXPOSED", .3, .9, .1, .1, .7)]
        self.assertEqual(body_parts.main_subject(parts, face_area=.05 * .08).kind, "BUTTOCKS_EXPOSED")

    def test_male_parts_and_weak_reads_are_not_the_subject(self):
        parts = [Part("MALE_GENITALIA_EXPOSED", .5, .5, .4, .4, .9), Part("FACE_MALE", .2, .2, .3, .3, .9),
                 Part("BUTTOCKS_EXPOSED", .7, .5, .3, .3, .3)]
        self.assertIsNone(body_parts.main_subject(parts))

    def test_a_face_larger_than_every_part_keeps_the_face(self):
        """FKOS-005 型：大特写脸比哪个部位都大，照旧按脸取景。"""
        parts = [Part("FEMALE_BREAST_EXPOSED", .7, .7, .1, .1, .8)]
        self.assertIsNone(body_parts.main_subject(parts, face_area=.23 * .3))

    def test_wide_covers_are_cut_into_overlapping_squares(self):
        self.assertEqual(body_parts.tiles(2184, 1468), [(0, 1468), (358, 1468), (716, 1468)])
        self.assertEqual(body_parts.tiles(800, 800), [(0, 800)])


class Faces:
    def detect(self, image):
        return [Face(.06, .1, .05, .08, .9)]


class Parts:
    def __init__(self):
        self.calls = 0

    def detect(self, image):
        self.calls += 1
        return [Part("BUTTOCKS_EXPOSED", .6, .5, .2, .3, .8)]


class FaceRecordTests(unittest.TestCase):
    def setUp(self):
        import numpy
        self.image = numpy.zeros((1468, 2184, 3), numpy.uint8)

    def test_a_whole_picture_records_the_subject_and_keeps_the_face(self):
        """`face` 不动：换头像按脸框截方图，不能截到臀部上。"""
        found = cover_artwork.face_record(self.image, Faces(), code="SDDE-613", whole=True, parts=Parts())
        self.assertEqual((found["face"]["cx"], found["subject"]["cx"], found["subject"]["kind"]),
                         (.06, .6, "BUTTOCKS_EXPOSED"))

    def test_a_sleeve_does_not_look_for_parts(self):
        parts = Parts()
        found = cover_artwork.face_record(self.image, Faces(), code="SSIS-001", parts=parts)
        self.assertNotIn("subject", found)
        self.assertEqual(parts.calls, 0)

    def test_the_card_frames_a_whole_picture_on_its_subject(self):
        from peach.web_state import WebContract
        with tempfile.TemporaryDirectory() as root:
            side = Path(root) / "SDDE-613.face.json"
            side.write_text(json.dumps({"layout": "still", "face": {"cx": .06, "cy": .1},
                                        "subject": {"cx": .6, "cy": .5}}), encoding="utf-8")
            self.assertEqual(WebContract._cover_focus(str(side)), {"layout": "still", "cx": .6, "cy": .5})
            side.write_text(json.dumps({"face": {"cx": .8, "cy": .3}, "subject": {"cx": .6, "cy": .5}}),
                            encoding="utf-8")
            self.assertEqual(WebContract._cover_focus(str(side)), {"cx": .8, "cy": .3})


class ModelTests(unittest.TestCase):
    def test_the_model_is_taken_out_of_the_wheel_and_checked(self):
        payload = io.BytesIO()
        with zipfile.ZipFile(payload, "w") as archive:
            archive.writestr("nudenet/320n.onnx", b"model")
        import hashlib
        with tempfile.TemporaryDirectory() as root, \
                patch.object(avatar_watermark, "read_url", return_value=payload.getvalue()):
            target = avatar_watermark.ensure_model(Path(root) / "320n.onnx", url="https://example.invalid/x.whl",
                                                   sha256=hashlib.sha256(b"model").hexdigest(),
                                                   member="nudenet/320n.onnx")
            self.assertEqual(target.read_bytes(), b"model")
            with self.assertRaises(avatar_watermark.WatermarkModelUnavailable):
                avatar_watermark.ensure_model(Path(root) / "other.onnx", url="https://example.invalid/x.whl",
                                              sha256="0" * 64, member="nudenet/320n.onnx")


if __name__ == "__main__":
    unittest.main()
