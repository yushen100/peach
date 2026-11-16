"""「修复与迁移」的封面一项：估算哪些封面要补修、服务起来后自动按三步做完、做过的不再算待处理。"""
from __future__ import annotations

import io
import json
import sqlite3
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from peach import cover_repair, jav_poster_crop, repair_center
from peach.jav_poster_crop import FOLD, MANUAL


def jpeg(size) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (120, 90, 80)).save(buffer, "JPEG")
    return buffer.getvalue()


class Database:
    def __init__(self, path: Path):
        self.path = path
        with self.write_transaction() as connection:
            connection.execute("CREATE TABLE ledger_upgrade_repair(id TEXT PRIMARY KEY, applied_at TEXT, result_json TEXT)")

    @contextmanager
    def write_transaction(self):
        connection = sqlite3.connect(self.path)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def rows(self):
        with self.write_transaction() as connection:
            return connection.execute("SELECT id, result_json FROM ledger_upgrade_repair").fetchall()


class CoverRepairTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.covers = self.root / "covers"
        self.covers.mkdir()
        self.state = self.root / "state"
        self.database = Database(self.root / "ledger.db")
        self.repair = cover_repair.CoverRepair(self.covers, self.state, self.database, self.root / "secrets")

    def cover(self, code: str, size=(800, 538), record: dict | None = None, rules: bool = True) -> Path:
        path = self.covers / f"{code}.jpg"
        path.write_bytes(jpeg(size))
        box = {"x0": 421, "y0": 0, "x1": size[0], "y1": size[1], "method": FOLD}
        sidecar = {"version": jav_poster_crop.ALGORITHM_VERSION, "px": list(size), "box": box, **(record or {})}
        if rules:
            sidecar["rules"] = jav_poster_crop.CROP_RULES
        jav_poster_crop.write_sidecar(path, sidecar)
        from peach.cover_artwork import FACE_ALGORITHM_VERSION
        path.with_suffix(".face.json").write_text(json.dumps({"version": FACE_ALGORITHM_VERSION, "px": list(size),
                                                              "face": None}), encoding="utf-8")
        return path

    def test_the_plan_lists_old_crops_doubtful_covers_and_missing_faces(self):
        current = self.cover("SSIS-001")
        old_rules = self.cover("SSIS-002", rules=False)
        manual = self.cover("SSIS-003", record={"box": {"x0": 400, "y0": 0, "x1": 800, "y1": 538, "method": MANUAL},
                                                "source": jav_poster_crop.MANUAL_SOURCE}, rules=False)
        promo = self.cover("STARS-080", size=(800, 564))
        no_face = self.cover("SSIS-004")
        no_face.with_suffix(".face.json").unlink()
        plan = self.repair.plan()
        self.assertEqual([path.stem for path, _ in plan["crop"]], [old_rules.stem])
        self.assertEqual([path.stem for path, _ in plan["judge"]], [promo.stem], "比例不标准、没有来源记录的按番号补判")
        self.assertEqual([path.stem for path in plan["face"]], [no_face.stem])
        self.assertNotIn(current.stem, {path.stem for path, _ in plan["crop"]})
        self.assertNotIn(manual.stem, {path.stem for path, _ in plan["crop"]}, "手工框只有用户自己能换")

    def test_a_cover_checked_without_a_dmm_portrait_is_not_pending_again(self):
        """素人系本来就没有 DMM 竖版图：查过一次记下，下次估算不再算待处理；图换了才再查。"""
        promo = self.cover("300MIUM-544", size=(800, 564))
        with patch.object(cover_repair, "judge", return_value={"code": promo.stem, "status": "no_portrait"}), \
                patch("peach.spine_label.default_reader"), patch("peach.body_parts.default_detector", return_value=None), \
                patch("peach.face_detect.FaceDetector"), patch.object(cover_repair, "HostLimitedTransport"), \
                patch.object(cover_repair, "SourceTransport"):
            self.repair.status()
            self.repair.worker.join()
            self.repair.begin()
            self.repair.worker.join()
        self.assertEqual(self.repair.plan()["judge"], [])
        promo.write_bytes(jpeg((820, 578)))
        self.assertEqual([path.stem for path, _ in self.repair.plan()["judge"]], [promo.stem])

    def test_a_portrait_too_small_to_compare_is_not_pending_again(self):
        """SBP-274 型：取到了竖版图，但老片只有 147×200，比不出结论，边车里没有判定，照样记下不再算待处理。"""
        promo = self.cover("SBP-274", size=(1920, 1080), record={"box": {"x0": 0, "y0": 0, "x1": 1920, "y1": 1080,
                                                                         "method": jav_poster_crop.NONE}})
        judged = {"code": promo.stem, "status": "judged", "verdict": None, "package": False}
        with patch.object(cover_repair, "judge", return_value=judged), \
                patch("peach.spine_label.default_reader"), patch("peach.body_parts.default_detector", return_value=None), \
                patch("peach.face_detect.FaceDetector"), patch.object(cover_repair, "HostLimitedTransport"), \
                patch.object(cover_repair, "SourceTransport"):
            self.repair.status()
            self.repair.worker.join()
            self.repair.begin()
            self.repair.worker.join()
        self.assertEqual(self.repair.plan()["judge"], [])

    def test_a_run_recrops_old_sidecars_records_a_receipt_and_backs_up_what_changed(self):
        old = self.cover("SSIS-002", rules=False)
        with patch("peach.spine_label.default_reader"), patch("peach.body_parts.default_detector", return_value=None), \
                patch("peach.face_detect.FaceDetector"), patch.object(cover_repair, "HostLimitedTransport"), \
                patch.object(cover_repair, "SourceTransport"), \
                patch("peach.cover_artwork.spine_box", return_value=None), \
                patch("peach.cover_artwork.text_across_file", return_value=lambda cut: 0):
            self.assertEqual(self.repair.status()["phase"], "estimating")
            self.repair.worker.join()
            self.assertEqual(self.repair.status(), {"phase": "ready", "covers": 1})
            self.repair.begin()
            self.repair.worker.join()
        self.assertEqual(jav_poster_crop.read_sidecar(old)["rules"], jav_poster_crop.CROP_RULES)
        (row_id, result), = self.database.rows()
        self.assertTrue(row_id.startswith(cover_repair.RECEIPT_PREFIX))
        self.assertIn("recropped", json.loads(result))
        self.assertEqual(self.repair.plan()["crop"], [])

    def test_a_run_uses_local_models_only_and_skips_faces_when_the_face_model_is_missing(self):
        """后台补修不联网取模型；没有人脸模型时照样重算切点、记回执，缺脸的几张留到下次。"""
        from peach.face_detect import FaceModelUnavailable
        old = self.cover("SSIS-002", rules=False)
        old.with_suffix(".face.json").unlink()
        with patch("peach.spine_label.default_reader") as reader, \
                patch("peach.body_parts.default_detector", return_value=None) as parts, \
                patch("peach.face_detect.FaceDetector",
                      side_effect=FaceModelUnavailable("errors.faceDetect.faceModelMissing", {"path": "yunet.onnx"})) as detector, \
                patch.object(cover_repair, "HostLimitedTransport"), patch.object(cover_repair, "SourceTransport"), \
                patch("peach.cover_artwork.spine_box", return_value=None), \
                patch("peach.cover_artwork.text_across_file", return_value=lambda cut: 0):
            self.repair.status()
            self.repair.worker.join()
            self.repair.begin()
            self.repair.worker.join()
        for call in (reader, parts, detector):
            self.assertEqual(call.call_args.kwargs, {"allow_download": False})
        self.assertEqual(jav_poster_crop.read_sidecar(old)["rules"], jav_poster_crop.CROP_RULES)
        (row_id, result), = self.database.rows()
        self.assertTrue(row_id.startswith(cover_repair.RECEIPT_PREFIX))
        self.assertNotIn("faces", json.loads(result))
        self.assertEqual(self.repair.plan()["face"], [old])

    def test_nothing_starts_before_the_estimate(self):
        self.assertFalse(self.repair.begin())

    def test_the_service_starts_on_its_own_after_the_delay(self):
        """升级后不等人点：服务起来、估算出有待处理的就开工；只读副本不动封面。"""
        old = self.cover("SSIS-002", rules=False)
        with patch("peach.spine_label.default_reader"), patch("peach.body_parts.default_detector", return_value=None),                 patch("peach.face_detect.FaceDetector"), patch.object(cover_repair, "HostLimitedTransport"),                 patch.object(cover_repair, "SourceTransport"),                 patch.object(cover_repair, "judge", return_value={"code": "SSIS-002", "status": "no_portrait"}),                 patch("peach.cover_artwork.spine_box", return_value=None),                 patch("peach.cover_artwork.text_across_file", return_value=lambda cut: 0):
            self.repair.start(delay=0)
            self.repair._service.join()
            self.repair.worker.join()
        self.assertEqual(jav_poster_crop.read_sidecar(old)["rules"], jav_poster_crop.CROP_RULES)
        replica = cover_repair.CoverRepair(self.covers, self.state, self.database, self.root, available=lambda: False)
        self.cover("SSIS-003", rules=False)
        replica.start(delay=0)
        replica._service.join()
        self.assertEqual(replica.status()["phase"] if replica.worker else "idle", "idle")

    def test_a_stopped_service_does_not_start(self):
        self.cover("SSIS-002", rules=False)
        self.repair.stop()
        self.repair.start(delay=0.2)
        self.repair.stop()
        self.repair._service.join()
        self.assertIsNone(self.repair.worker)


class RepairCenterTests(unittest.TestCase):
    def test_the_item_queues_with_a_cover_count_and_then_reports_the_last_run(self):
        self.assertEqual(repair_center._cover_artwork({"phase": "ready", "covers": 12}, []),
                         {"state": "pending", "covers": 12})
        self.assertEqual(repair_center._cover_artwork({"phase": "estimating"}, []),
                         {"state": "pending", "estimating": True})
        self.assertIn(("cover-artwork", "auto", "catalog"), repair_center.ITEMS)
        rows = [(f"{cover_repair.RECEIPT_PREFIX}1", 1.0, {"judged": 3, "recropped": 40, "faces": 7, "failed": 1})]
        self.assertEqual(repair_center._cover_artwork({"phase": "ready", "covers": 0}, rows),
                         {"state": "done", "changed": 50})
        self.assertEqual(repair_center._cover_artwork(None, []), {"state": "none"})


if __name__ == "__main__":
    unittest.main()
