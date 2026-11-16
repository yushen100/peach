# -*- coding: utf-8 -*-
"""实体图人脸记录：sidecar 形状、像素换算与探针的降级行为。"""
import json
import tempfile
import unittest
import unittest.mock
from pathlib import Path

from peach.avatar_face import (
    FaceProbe, drop_sidecar, face_px_width, face_share, read_sidecar,
    sidecar_path, write_sidecar,
)
from peach.face_detect import FaceModelUnavailable

#: 模型取不到时 `FaceDetector` 抛的那一个：联网下载模型失败（`face_detect.ensure_model`）。
MODEL_UNAVAILABLE = FaceModelUnavailable("errors.faceDetect.faceModelFetchFailed", {"error": "network is unreachable"})


def record(width=640, height=960, face_w=0.105):
    return {"ratio": round(width / height, 3), "px": [width, height],
            "face": {"cx": 0.439, "cy": 0.224, "w": face_w, "h": 0.095,
                     "score": 0.934}}


class SidecarTests(unittest.TestCase):
    def test_the_sidecar_sits_beside_the_image_under_a_swapped_suffix(self):
        self.assertEqual(sidecar_path(Path("/x/performer-8711.img")).name,
                         "performer-8711.face.json")

    def test_a_written_sidecar_reads_back_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp).resolve() / "performer-1.img"
            payload = record()
            written = write_sidecar(image, payload)
            self.assertEqual(json.loads(written.read_text(encoding="utf-8")), payload)
            self.assertEqual(read_sidecar(image), payload)

    def test_a_missing_or_broken_sidecar_reads_as_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp).resolve() / "performer-1.img"
            self.assertIsNone(read_sidecar(image))
            sidecar_path(image).write_text("{ not json", encoding="utf-8")
            self.assertIsNone(read_sidecar(image))

    def test_dropping_is_safe_to_repeat(self):
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp).resolve() / "performer-1.img"
            write_sidecar(image, record())
            drop_sidecar(image)
            drop_sidecar(image)
            self.assertFalse(sidecar_path(image).exists())


class FacePixelWidthTests(unittest.TestCase):
    def test_the_normalized_box_becomes_pixels_against_the_source_width(self):
        """归一化值给得出比例，给不出像素——放大到几倍还清楚问的是像素。"""
        self.assertEqual(face_px_width(record(640, 960, 0.105)), 67)

    def test_everything_unmeasurable_is_zero(self):
        for payload in (None, {}, {"px": [640, 960], "face": None},
                        {"face": {"w": 0.1}}, {"px": [], "face": {"w": 0.1}},
                        {"px": [640, 960], "face": {"w": "大"}}):
            with self.subTest(payload=payload):
                self.assertEqual(face_px_width(payload), 0)


class FaceShareTests(unittest.TestCase):
    def test_the_share_is_measured_against_the_longest_side(self):
        """脸框宽是按图宽归一化的，同一张脸在竖图里算出来会大一截。

        占比回答的是构图——圆标里落下的是不是一张脸——所以两种取向必须是同一把尺。
        """
        self.assertAlmostEqual(face_share(record(1920, 1080, 0.1)), 0.1, places=3)
        self.assertAlmostEqual(face_share(record(1080, 1920, 0.1)), 0.056, places=3)

    def test_everything_unmeasurable_is_zero(self):
        for payload in (None, {}, {"px": [640, 960], "face": None},
                        {"px": [0, 0], "face": {"w": 0.3}},
                        {"px": ["宽", "高"], "face": {"w": 0.3}}):
            with self.subTest(payload=payload):
                self.assertEqual(face_share(payload), 0.0)


class FaceProbeTests(unittest.TestCase):
    def test_the_model_is_built_once_and_only_when_something_needs_it(self):
        """一趟里一个候选都没走到就不必去下 232 KB 的 ONNX。"""
        probe = FaceProbe()
        with unittest.mock.patch("peach.avatar_face.FaceDetector") as detector:
            self.assertEqual(detector.call_count, 0)
            with unittest.mock.patch("peach.avatar_face.face_record",
                                     return_value=record()):
                probe(Path("/tmp/a.img"))
                probe(Path("/tmp/b.img"))
            self.assertEqual(detector.call_count, 1)

    def test_an_unavailable_model_is_reported_instead_of_stopping_the_run(self):
        """取不到模型会把「今天没网」变成「所有人都没有头像」，所以只记原因。"""
        probe = FaceProbe()
        with unittest.mock.patch("peach.avatar_face.FaceDetector",
                                 side_effect=MODEL_UNAVAILABLE):
            self.assertIsNone(probe(Path("/tmp/a.img")))
        self.assertEqual(probe.unavailable, "取人脸模型失败：network is unreachable")

    def test_a_failed_model_load_waits_out_the_retry_window_then_recovers(self):
        """服务启动时恰好没网，联网后圆标要自己恢复取景；窗口内不在请求线程里反复重下。"""
        from peach import avatar_face

        now = [1000.0]
        probe = FaceProbe(clock=lambda: now[0])
        with unittest.mock.patch(
                "peach.avatar_face.FaceDetector",
                side_effect=[MODEL_UNAVAILABLE, unittest.mock.MagicMock()]) as detector, \
                unittest.mock.patch("peach.avatar_face.face_record", return_value=record()):
            self.assertIsNone(probe(Path("/tmp/a.img")))
            self.assertEqual(probe.unavailable, "取人脸模型失败：network is unreachable")
            now[0] += avatar_face.RETRY_SECONDS - 1
            self.assertIsNone(probe(Path("/tmp/a.img")))
            self.assertEqual(detector.call_count, 1)
            now[0] += 1
            self.assertEqual(probe(Path("/tmp/a.img")), record())
            self.assertEqual(detector.call_count, 2)
        self.assertEqual(probe.unavailable, "")

    def test_a_model_fetched_elsewhere_ends_the_retry_window_early(self):
        """活动中心「立即重试」取到了模型，题材圆标的探针不必再等满一小时。"""
        from peach import face_detect

        probe = FaceProbe(clock=lambda: 1000.0)
        with unittest.mock.patch(
                "peach.avatar_face.FaceDetector",
                side_effect=[MODEL_UNAVAILABLE, unittest.mock.MagicMock()]) as detector, \
                unittest.mock.patch("peach.avatar_face.face_record", return_value=record()):
            self.assertIsNone(probe(Path("/tmp/a.img")))
            self.assertIsNone(probe(Path("/tmp/a.img")))
            self.assertEqual(detector.call_count, 1)
            with unittest.mock.patch.object(face_detect, "downloads", face_detect.downloads + 1):
                self.assertEqual(probe(Path("/tmp/a.img")), record())
            self.assertEqual(detector.call_count, 2)

    def test_one_undecodable_image_does_not_take_down_the_batch(self):
        probe = FaceProbe()
        with unittest.mock.patch("peach.avatar_face.FaceDetector"):
            with unittest.mock.patch("peach.avatar_face.face_record",
                                     side_effect=ValueError("cannot decode image")):
                self.assertIsNone(probe(Path("/tmp/a.img")))
        self.assertEqual(probe.unavailable, "")

    def test_a_candidate_still_in_memory_is_checked_without_writing_it_down(self):
        """几个候选里挑一张时检的是字节，落选的那几张一个文件都不留。

        题材圆标要在五个候选里找出第一张看得见脸的。先写盘再检的话，四张落选的图会
        各自在缓存目录里留一份，还得反过来再删一次。
        """
        probe = FaceProbe()
        with unittest.mock.patch("peach.avatar_face.FaceDetector"):
            with unittest.mock.patch("peach.avatar_face.face_detect.decode",
                                     return_value=object()):
                with unittest.mock.patch("peach.avatar_face.face_record_of",
                                         return_value=record()) as checked:
                    self.assertEqual(probe.on_bytes(b"\xff\xd8\xff"), record())
        self.assertEqual(checked.call_count, 1)

    def test_bytes_that_are_not_an_image_read_as_no_record(self):
        """解不开的候选跳过就是了：站点回的质询页不该让整排圆标停下。"""
        probe = FaceProbe()
        with unittest.mock.patch("peach.avatar_face.FaceDetector"):
            self.assertIsNone(probe.on_bytes(b"<!doctype html>"))
        self.assertEqual(probe.unavailable, "")

    def test_without_a_model_bytes_get_no_record_either(self):
        probe = FaceProbe()
        with unittest.mock.patch("peach.avatar_face.FaceDetector",
                                 side_effect=MODEL_UNAVAILABLE):
            self.assertIsNone(probe.on_bytes(b"\xff\xd8\xff"))
        self.assertEqual(probe.unavailable, "取人脸模型失败：network is unreachable")

    def test_an_offline_probe_never_downloads_the_model(self):
        with unittest.mock.patch("peach.avatar_face.FaceDetector") as detector, \
                unittest.mock.patch("peach.avatar_face.face_record", return_value=record()):
            FaceProbe(allow_download=False)(Path("/tmp/a.img"))
        detector.assert_called_once_with(allow_download=False)


class _Probe:
    """补测用的假探针：按图的实际尺寸给一份记录，或者装作模型用不了。"""

    def __init__(self, unavailable=""):
        self.unavailable, self.seen = unavailable, []

    def __call__(self, image_path):
        from peach.images import measure_image_file
        self.seen.append(Path(image_path).name)
        if self.unavailable:
            return None
        width, height = measure_image_file(image_path)
        return {**record(width, height), "px": [width, height]}


class BackfillTests(unittest.TestCase):
    """人脸模型不可用时装上的头像：没有记录、记录比图旧、`px` 对不上的补测。"""

    def setUp(self):
        import os
        from PIL import Image
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        for name in ("missing", "current", "resized", "replaced"):
            Image.new("RGB", (40, 60)).save(self.root / f"performer-{name}.img", format="PNG")
        write_sidecar(self.root / "performer-current.img", record(40, 60))
        write_sidecar(self.root / "performer-resized.img", record(80, 120))
        write_sidecar(self.root / "performer-replaced.img", record(40, 60))
        old = (self.root / "performer-replaced.img").stat().st_mtime - 60
        os.utime(sidecar_path(self.root / "performer-replaced.img"), (old, old))

    def test_only_avatars_without_a_current_record_are_probed_and_written(self):
        from peach.avatar_face import backfill
        probe = _Probe()
        self.assertEqual(backfill(self.root, probe), {"checked": 3, "written": 3})
        self.assertEqual(sorted(probe.seen), ["performer-missing.img", "performer-replaced.img",
                                              "performer-resized.img"])
        for name in ("missing", "resized", "replaced"):
            self.assertEqual(read_sidecar(self.root / f"performer-{name}.img")["px"], [40, 60])
        self.assertEqual(backfill(self.root, _Probe()), {"checked": 0, "written": 0})

    def test_without_the_model_nothing_is_written_and_the_caller_retries_later(self):
        from peach.avatar_face import backfill
        self.assertIsNone(backfill(self.root, _Probe(unavailable="取人脸模型失败")))
        self.assertIsNone(read_sidecar(self.root / "performer-missing.img"))
        self.assertEqual(read_sidecar(self.root / "performer-resized.img")["px"], [80, 120])


if __name__ == "__main__":
    unittest.main()
