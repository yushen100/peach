import io
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from peach import cover_artwork, jav_poster_crop
from peach.face_detect import Face, FaceModelUnavailable


def jpeg(colour, size=(840, 472)):
    output = io.BytesIO()
    Image.new("RGB", size, colour).save(output, "JPEG")
    return output.getvalue()


class Detector:
    def detect(self, image):
        return [Face(.72, .22, .1, .1, .9)]


class CoverArtworkTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.target = self.root / "259LUXU-1537.jpg"

    def test_javdb_images_are_rejected_before_replacing_any_file(self):
        from peach.jav_cover_fetch import Unavailable
        data = jpeg((80, 90, 100))
        self.target.write_bytes(data)
        from peach.sources.javdb import JAVDB
        evidence_list = [{'source_url': 'https://c0.' + domain + '/covers/x.jpg'}
                         for domain in (*JAVDB.domains, 'tp.spfcas.com')]
        for evidence in [*evidence_list, {'source': 'javdb-public'}]:
            with self.subTest(evidence=evidence), self.assertRaisesRegex(Unavailable, '无 JavDB 水印'):
                cover_artwork.install_cover(self.target, 'FC2-PPV-12345', data, (840, 472), evidence=evidence)
        self.assertEqual(self.target.read_bytes(), data)
        self.assertFalse(self.target.with_suffix('.face.json').exists())

    def test_a_javdb_image_marked_as_the_chosen_fallback_installs_and_shows(self):
        """#531：设置打开后按水印兜底装上的那张记着 `watermarked`，装得上，也不再被当成只作印证的图藏起来。"""
        data = jpeg((80, 90, 100))
        evidence = {'source_url': 'https://c0.jdbstatic.com/covers/x.jpg', 'watermarked': True}
        with patch.object(cover_artwork, 'face_record', return_value=None):
            cover_artwork.install_cover(self.target, 'XV-507', data, (840, 472), evidence=evidence)
        self.assertEqual(self.target.read_bytes(), data)
        self.assertFalse(cover_artwork.has_javdb_source(self.target))
        self.target.with_suffix('.scraping.json').write_text(
            json.dumps({'source_url': 'https://c0.jdbstatic.com/covers/x.jpg'}), encoding='utf-8')
        self.assertTrue(cover_artwork.has_javdb_source(self.target))

    def test_a_paper_canvas_keeps_a_face_left_of_the_expected_spine(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[Face(.478, .094, .085, .155, .838)]):
            cover_artwork.install_cover(self.target, 'STARS-350', jpeg((80, 90, 100), (840, 594)),
                                        (840, 594), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual(face['layout'], 'still')
        self.assertEqual(face['face']['cx'], .478)
        self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))

    def test_a_paper_canvas_without_faces_preserves_the_complete_picture(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[]):
            cover_artwork.install_cover(self.target, 'SDDE-640', jpeg((80, 90, 100), (840, 594)),
                                        (840, 594), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual(face['layout'], 'still')
        self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))

    def test_centered_front_with_padding_keeps_its_panel(self):
        import numpy
        image = numpy.full((563, 840, 3), 40, numpy.uint8)
        image[:, 225:618] = numpy.random.default_rng(42).integers(100, 255, (563, 393, 3), dtype=numpy.uint8)
        output = io.BytesIO()
        Image.fromarray(image).save(output, 'PNG')
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[Face(.487, .231, .135, .242, .93)]):
            cover_artwork.install_cover(self.target, 'HHL-018', output.getvalue(), (840, 563), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertNotIn('layout', face)
        box = jav_poster_crop.read_sidecar(self.target)['box']
        self.assertEqual(box['method'], jav_poster_crop.CENTER)
        self.assertLessEqual(abs(box['x0'] - 225), 1)
        self.assertLessEqual(abs(box['x1'] - 618), 1)

    def test_large_face_crossing_the_assumed_spine_uses_the_whole_cover(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[
                Face(.555, .331, .257, .422, .918), Face(.81, .3, .06, .1, .95)]):
            cover_artwork.install_cover(self.target, 'SPONE-001', jpeg((80, 90, 100), (800, 600)),
                                        (800, 600), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual(face['layout'], 'still')
        self.assertEqual(face['face']['cx'], .555)
        self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))

    def test_central_portrait_in_a_full_collage_keeps_its_face(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[Face(.508, .2, .09, .155, .917)]):
            cover_artwork.install_cover(self.target, 'MIDV-377', jpeg((80, 90, 100), (800, 600)),
                                        (800, 600), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual(face['layout'], 'still')
        self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))

    def test_dominant_left_portrait_without_a_spine_keeps_the_whole_picture(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[Face(.22, .3, .3, .4, .95), Face(.8, .3, .06, .1, .9)]):
            cover_artwork.install_cover(self.target, 'MIDV-865', jpeg((80, 90, 100), (800, 600)),
                                        (800, 600), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual((face['version'], face['layout'], face['face']['cx']),
                         (cover_artwork.FACE_ALGORITHM_VERSION, 'still', .22))
        self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))

    def test_four_three_collage_without_a_spine_keeps_the_largest_closed_eye_face(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[
                Face(.511, .435, .419, .717, .751), Face(.115, .128, .173, .227, .909)]):
            cover_artwork.install_cover(self.target, 'SONE-694', jpeg((80, 90, 100), (800, 600)),
                                        (800, 600), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual((face['layout'], face['face']['cx']), ('still', .511))
        self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))

    def test_a_large_weak_body_box_does_not_displace_the_portrait_on_a_full_canvas(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[
                Face(.389, .482, .427, .313, .798), Face(.389, .262, .202, .170, .928)]):
            cover_artwork.install_cover(self.target, 'SONE-694', jpeg((80, 90, 100), (800, 600)),
                                        (800, 600), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual(face['face']['cy'], .262)

    def test_full_canvas_layout_is_available_without_a_face_model(self):
        for size in ((800, 600), (840, 594)):
            with self.subTest(size=size), patch('peach.cover_artwork._default_detector',
                                                side_effect=FaceModelUnavailable('errors.faceDetect.faceModelMissing', {'path': 'yunet.onnx'})):
                cover_artwork.install_cover(self.target, 'CAWD-186', jpeg((80, 90, 100), size), size)
            face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
            self.assertEqual(face['layout'], 'still')
            self.assertIsNone(face['face'])
            self.assertNotIn('version', face)
            self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))

    def test_a_clear_spine_keeps_the_front_portrait_despite_a_larger_back_portrait(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[Face(.22, .3, .3, .4, .95), Face(.8, .3, .06, .1, .9)]):
            with patch.object(jav_poster_crop, 'front_panel_box', return_value={
                    'x0': 420, 'y0': 0, 'x1': 800, 'y1': 600, 'method': 'fold'}):
                cover_artwork.install_cover(self.target, 'ABW-232', jpeg((80, 90, 100), (800, 600)),
                                            (800, 600), detector=detector)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertNotIn('layout', face)
        self.assertEqual(face['face']['cx'], .8)

    def test_full_photo_keeps_faces_on_the_left_but_sleeves_use_the_front(self):
        detector = Detector()
        with patch.object(detector, "detect", return_value=[Face(.22, .3, .1, .1, .95)]):
            for code in ("FC2-PPV-3312576", "HEYZO-1380", "092415-001", "ABP-601"):
                with self.subTest(code=code):
                    target = self.root / f"{code}.jpg"
                    # 番号封面用标准封套比例：1.6 的纯色图找不到折痕，取景判成整幅，脸也就在整幅里找。
                    size = (800, 538) if code == "ABP-601" else (800, 500)
                    cover_artwork.install_cover(target, code, jpeg((90, 80, 70), size), size, detector=detector)
                    record = json.loads(target.with_suffix(".face.json").read_text(encoding="utf-8"))
                    if code == "ABP-601":
                        self.assertIsNone(record["face"])
                    else:
                        self.assertEqual(record["face"]["cx"], .22)

    def test_install_replaces_image_and_both_focus_sidecars(self):
        data = jpeg((190, 120, 80))
        cover_artwork.install_cover(
            self.target, "259LUXU-1537", data, (840, 472), detector=Detector())
        self.assertEqual(self.target.read_bytes(), data)
        face = json.loads(self.target.with_suffix(".face.json").read_text(encoding="utf-8"))
        poster = jav_poster_crop.read_sidecar(self.target)
        self.assertEqual(face["face"]["cx"], .72)
        # 换头像按脸宽在封面上框方图，`px` 用来判这份记录是不是这张图的。
        self.assertEqual((face["px"], face["face"]["w"]), ([840, 472], .1))
        self.assertTrue(jav_poster_crop.is_current(poster, 840, 472))

    def test_bluray_title_frames_the_front_panel_and_its_face(self):
        detector = Detector()
        title = '作品 ブルーレイディスク'
        with patch.object(detector, 'detect', return_value=[
                Face(.2, .25, .2, .2, .95), Face(.72, .22, .1, .1, .94)]):
            cover_artwork.install_cover(self.target, 'MIDA-239', jpeg((90, 80, 70), (800, 438)),
                (800, 438), detector=detector, evidence={'title': title})
        poster = jav_poster_crop.read_sidecar(self.target)
        self.assertEqual(poster['box']['x0'], round(800 - .85 * 438))
        self.assertEqual(poster['title'], title)
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual(face['face']['cx'], .72)

    def test_fc2_title_keeps_the_whole_image_and_left_face(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[Face(.2, .25, .2, .2, .95)]):
            cover_artwork.install_cover(self.target, 'FC2-PPV-12345', jpeg((90, 80, 70), (800, 438)),
                (800, 438), detector=detector, evidence={'title': 'Blu-ray'})
        self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual(face['face']['cx'], .2)

    def test_vr_mark_keeps_the_left_main_face_and_whole_artwork(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[
                Face(.22, .25, .2, .2, .95), Face(.75, .2, .1, .1, .94)]):
            cover_artwork.install_cover(self.target, 'MDVR-276', jpeg((90, 80, 70), (800, 600)),
                (800, 600), detector=detector, evidence={'title': '【VR】作品'})
        self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))
        face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
        self.assertEqual(face['face']['cx'], .22)
        self.assertEqual(face['layout'], 'still')

    def test_digital_collages_keep_the_whole_artwork_and_left_face(self):
        detector = Detector()
        with patch.object(detector, 'detect', return_value=[Face(.22, .8, .2, .2, .95)]):
            for code in ('IENEE-93103', 'IENFE-5301', 'SDHS-039'):
                with self.subTest(code=code):
                    cover_artwork.install_cover(self.target, code, jpeg((90, 80, 70), (800, 540)),
                        (800, 540), detector=detector)
                    self.assertIsNone(jav_poster_crop.projection(jav_poster_crop.read_sidecar(self.target)))
                    face = json.loads(self.target.with_suffix('.face.json').read_text(encoding='utf-8'))
                    self.assertEqual(face['face']['cx'], .22)
                    self.assertEqual(face['face']['cy'], .8)
                    self.assertEqual(face['layout'], 'still')

    def test_missing_face_model_removes_stale_focus_but_keeps_new_cover(self):
        self.target.write_bytes(jpeg((10, 10, 10), (800, 539)))
        self.target.with_suffix(".face.json").write_text('{"ratio":1,"face":{}}')
        self.target.with_suffix(".poster.json").write_text('{"version":"old"}')
        data = jpeg((240, 240, 240))
        with patch.object(cover_artwork, "_default_detector",
                          side_effect=FaceModelUnavailable("errors.faceDetect.faceModelMissing", {"path": "yunet.onnx"})):
            cover_artwork.install_cover(self.target, "259LUXU-1537", data, (840, 472))
        self.assertEqual(self.target.read_bytes(), data)
        self.assertFalse(self.target.with_suffix(".face.json").exists())
        self.assertTrue(jav_poster_crop.is_current(
            jav_poster_crop.read_sidecar(self.target), 840, 472))

    def test_preparation_failure_leaves_the_installed_set_untouched(self):
        old = jpeg((10, 10, 10), (800, 539))
        self.target.write_bytes(old)
        face = self.target.with_suffix(".face.json")
        face.write_text('{"old":true}', encoding="utf-8")
        with patch.object(cover_artwork, "_sidecars", side_effect=RuntimeError("failed")), \
                self.assertRaisesRegex(RuntimeError, "failed"):
            cover_artwork.install_cover(
                self.target, "259LUXU-1537", jpeg((20, 20, 20)), (840, 472))
        self.assertEqual(self.target.read_bytes(), old)
        self.assertEqual(face.read_text(encoding="utf-8"), '{"old":true}')

    def test_commit_failure_restores_the_installed_set(self):
        old = jpeg((10, 10, 10), (800, 539))
        self.target.write_bytes(old)
        face = self.target.with_suffix(".face.json")
        poster = self.target.with_suffix(".poster.json")
        face.write_text('{"old":"face"}', encoding="utf-8")
        poster.write_text('{"old":"poster"}', encoding="utf-8")
        replace = os.replace

        def fail_new_face(source, destination):
            source, destination = Path(source), Path(destination)
            if destination == face and source.suffix == ".tmp":
                raise OSError("commit failed")
            replace(source, destination)

        with patch.object(cover_artwork.os, "replace", side_effect=fail_new_face), \
                self.assertRaisesRegex(OSError, "commit failed"):
            cover_artwork.install_cover(
                self.target, "259LUXU-1537", jpeg((20, 20, 20)), (840, 472),
                detector=Detector())
        self.assertEqual(self.target.read_bytes(), old)
        self.assertEqual(face.read_text(encoding="utf-8"), '{"old":"face"}')
        self.assertEqual(poster.read_text(encoding="utf-8"), '{"old":"poster"}')

    def test_concurrent_installs_never_mix_image_and_sidecars(self):
        payloads = [jpeg((220, 20, 20)), jpeg((20, 20, 220))]
        errors = []
        def install(index):
            try:
                evidence = {"raw_sha256": str(index)}
                cover_artwork.install_cover(
                    self.target, "259LUXU-1537", payloads[index], (840, 472),
                    evidence=evidence, detector=Detector())
            except Exception as error:  # pragma: no cover - 失败时由主线程报告
                errors.append(error)
        workers = [threading.Thread(target=install, args=(index,)) for index in range(2)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
        self.assertEqual(errors, [])
        winner = payloads.index(self.target.read_bytes())
        evidence = json.loads(self.target.with_suffix(".scraping.json").read_text(encoding="utf-8"))
        self.assertEqual(evidence["raw_sha256"], str(winner))


def textured(size, seed, fold=None):
    """有纹理的 JPEG 字节与像素：竖版图比对要在纹理上做。

    纹理先模糊：纯噪声每一列都像一条满高接缝，真实封面的接缝覆盖率只有三四成。`fold` 处画一条折痕。
    """
    import numpy
    from PIL import ImageFilter

    pixels = numpy.random.default_rng(seed).integers(0, 256, (size[1], size[0], 3), dtype=numpy.uint8)
    image = Image.fromarray(pixels).filter(ImageFilter.GaussianBlur(3))
    if fold is not None:
        image.paste((10, 10, 10), (fold - 2, 0, fold, size[1]))
    output = io.BytesIO()
    image.save(output, "JPEG", quality=95)
    return output.getvalue(), image


class PortraitInstallTests(unittest.TestCase):
    """装封面时带上 DMM 竖版图：它决定横图是不是封套，独立海报装成竖版正封。"""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.target = self.root / "START-404.jpg"
        self.cover, self.image = textured((1100, 776), 1)
        self.front = jav_poster_crop.front_path(self.target)

    def portrait(self, image):
        output = io.BytesIO()
        image.save(output, "JPEG", quality=95)
        return output.getvalue()

    def test_a_separately_designed_poster_is_installed_as_the_front_image(self):
        poster, _ = textured((546, 776), 2)
        cover_artwork.install_cover(self.target, "START-404", self.cover, (1100, 776),
                                    detector=Detector(), portrait=poster)
        record = jav_poster_crop.read_sidecar(self.target)
        self.assertEqual(self.front.read_bytes(), poster)
        self.assertEqual(record["box"]["method"], jav_poster_crop.NONE)
        self.assertEqual((record["layout"], record["front"], record["portrait"]["verdict"]),
                         ("still", [546, 776], jav_poster_crop.POSTER))
        face = json.loads(self.target.with_suffix(".face.json").read_text(encoding="utf-8"))
        self.assertEqual(face["layout"], "still", "整幅画面按全图找脸")

    def test_a_shorter_poster_is_judged_but_not_installed(self):
        """比横图矮的竖版图装上去就是降清晰度：只拿它判版式，大图位按人脸铺满横图。"""
        poster, _ = textured((147, 200), 3)
        cover_artwork.install_cover(self.target, "START-404", self.cover, (1100, 776),
                                    detector=Detector(), portrait=poster)
        record = jav_poster_crop.read_sidecar(self.target)
        self.assertFalse(self.front.exists())
        self.assertEqual((record["layout"], record["portrait"]["verdict"]), ("still", jav_poster_crop.POSTER))
        self.assertNotIn("front", record)

    def test_a_portrait_cut_from_the_sleeve_frames_the_front_panel(self):
        """DMM 那块从 540 列起、带进书脊；正封从 554 列的折痕起。"""
        cover, image = textured((1100, 776), 1, fold=554)
        portrait = self.portrait(image.crop((540, 0, 1100, 776)))
        cover_artwork.install_cover(self.target, "START-404", cover, (1100, 776),
                                    detector=Detector(), portrait=portrait)
        record = jav_poster_crop.read_sidecar(self.target)
        self.assertFalse(self.front.exists(), "封套的正封按折痕切，DMM 那块会带进书脊")
        self.assertEqual(record["portrait"]["verdict"], jav_poster_crop.SLEEVE)
        self.assertEqual(record["box"]["method"], jav_poster_crop.FOLD)
        self.assertLessEqual(abs(record["box"]["x0"] - 554), 1, "缝是一列过渡带，从它下一列起")
        self.assertNotIn("layout", record)

    def test_a_later_cover_without_a_poster_removes_the_old_front_image(self):
        poster, _ = textured((546, 776), 4)
        cover_artwork.install_cover(self.target, "START-404", self.cover, (1100, 776),
                                    detector=Detector(), portrait=poster)
        cover_artwork.install_cover(self.target, "START-404", jpeg((20, 20, 20)), (840, 472),
                                    detector=Detector())
        self.assertFalse(self.front.exists())
        self.assertNotIn("front", jav_poster_crop.read_sidecar(self.target))

    def test_the_group_lists_the_front_image_with_the_sidecars(self):
        self.assertEqual([path.name for path in cover_artwork.cover_group(self.target)],
                         ["START-404.jpg", "START-404.face.json", "START-404.poster.json",
                          "START-404.scraping.json", "START-404.jpg"])
        self.assertEqual(cover_artwork.cover_group(self.target)[-1], self.front)


class WholeFaceTests(unittest.TestCase):
    """取景判成整幅显示时，主脸在整幅画面里找：左边那张更大的脸不该被「只看正封」筛掉。"""

    class Faces:
        def detect(self, image):
            return [Face(.2, .4, .07, .1, .9), Face(.75, .4, .05, .07, .9)]

    def setUp(self):
        import numpy
        self.image = numpy.zeros((1468, 2184, 3), numpy.uint8)

    def test_a_sleeve_looks_for_the_face_on_the_front_panel(self):
        found = cover_artwork.face_record(self.image, self.Faces(), code="MIDV-192")
        self.assertEqual(found["face"]["cx"], .75)

    def test_a_whole_picture_takes_the_largest_face_anywhere(self):
        found = cover_artwork.face_record(self.image, self.Faces(), code="MIDV-192", whole=True)
        self.assertEqual((found["face"]["cx"], found["layout"]), (.2, "still"))

    def test_only_a_cover_shown_whole_with_a_front_panel_face_is_redone(self):
        whole = {"box": {"method": jav_poster_crop.NONE}}
        cut = {"box": {"method": jav_poster_crop.FOLD}}
        front_face = {"face": {"cx": .75}}
        self.assertTrue(cover_artwork.needs_whole_face("MIDV-192", "", whole, front_face))
        self.assertFalse(cover_artwork.needs_whole_face("MIDV-192", "", cut, front_face))
        self.assertFalse(cover_artwork.needs_whole_face("MIDV-192", "", whole, {**front_face, "layout": "still"}))


if __name__ == "__main__":
    unittest.main()
