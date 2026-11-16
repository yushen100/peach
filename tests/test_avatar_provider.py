import io
import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest import mock

from PIL import Image

from peach.avatar_provider import (
    AvatarCandidateCache,
    AvatarImageError,
    inspect_avatar,
    mark_duplicate_candidates,
    prepare_avatar,
    provenance_now,
)


def image_bytes(image_format: str = "JPEG", size: tuple[int, int] = (600, 800)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (60, 80, 100)).save(buffer, image_format)
    return buffer.getvalue()


class AvatarProviderTests(unittest.TestCase):
    def test_common_rasters_have_a_static_browser_preview(self):
        for image_format in ("JPEG", "PNG", "WEBP", "AVIF", "GIF", "BMP", "TIFF", "ICO", "JPEG2000"):
            with self.subTest(image_format=image_format):
                body = image_bytes(image_format, (64, 64))
                prepared = prepare_avatar(body)
                inspected = inspect_avatar(prepared)
                self.assertIsNotNone(inspected)
                self.assertEqual((inspected.width, inspected.height), (64, 64))
                self.assertIn(inspected.mime_type, ("image/jpeg", "image/png"))
                if image_format in ("JPEG", "PNG"):
                    self.assertEqual(prepared, body)

    def test_transparency_and_first_animation_frame_are_preserved(self):
        buffer = io.BytesIO()
        Image.new("RGBA", (32, 32), (20, 40, 60, 0)).save(buffer, "WEBP", lossless=True)
        with Image.open(io.BytesIO(prepare_avatar(buffer.getvalue()))) as image:
            self.assertEqual(image.format, "PNG")
            self.assertEqual(image.getpixel((0, 0))[3], 0)
        buffer = io.BytesIO()
        first = Image.new("RGB", (32, 32), "red")
        first.save(buffer, "GIF", save_all=True, append_images=[Image.new("RGB", (32, 32), "blue")], duration=100)
        with Image.open(io.BytesIO(prepare_avatar(buffer.getvalue()))) as image:
            self.assertEqual(getattr(image, "n_frames", 1), 1)
            red, _, blue = image.convert("RGB").getpixel((0, 0))
            self.assertGreater(red, blue)

    def test_incomplete_jpeg_and_bad_png_checksum_are_rejected(self):
        jpeg = image_bytes()[:-32]
        png = bytearray(image_bytes("PNG"))
        png[png.index(b"IDAT") + 4] ^= 1
        for body in (jpeg, bytes(png)):
            with self.subTest(signature=body[:8]):
                self.assertIsNone(inspect_avatar(body))
                with self.assertRaisesRegex(AvatarImageError, "数据不完整或无法解码"):
                    prepare_avatar(body)

    def test_unknown_content_has_an_image_error(self):
        with self.assertRaisesRegex(AvatarImageError, "无法识别图片内容"):
            prepare_avatar(b"<html>not an image</html>")

    def test_cache_is_content_addressed_and_provenance_is_stable(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache = AvatarCandidateCache(Path(tmp))
            body = image_bytes()
            avatar = inspect_avatar(body)
            self.assertIsNotNone(avatar)
            url = "https://example.invalid/a.jpg"
            object_path = cache.store(url, body, avatar)
            self.assertEqual(cache.lookup(url), body)
            self.assertIn(avatar.sha256, object_path.name)
            provenance = provenance_now(
                entity_id=7, provider="gfriends", source_kind="external_media_library",
                matched_name="甲", name_source="canonical", external_id="7-S1/a.jpg",
                upstream_url=url, width=avatar.width, height=avatar.height,
                mime_type=avatar.mime_type, sha256=avatar.sha256,
                cache_path=str(object_path),
            )
            evidence_path = cache.store_provenance(provenance)
            original = evidence_path.read_bytes()
            cache.store_provenance(replace(provenance, cached_at="2099-01-01T00:00:00Z"))
            self.assertEqual(evidence_path.read_bytes(), original)
            evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
            self.assertEqual(evidence["sha256"], avatar.sha256)
            self.assertEqual(evidence["policy_version"], "performer-avatar-provider-v1")

    def test_cache_hash_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache = AvatarCandidateCache(Path(tmp))
            body = image_bytes()
            avatar = inspect_avatar(body)
            url = "https://example.invalid/a.jpg"
            object_path = cache.store(url, body, avatar)
            object_path.write_bytes(b"tampered")
            self.assertIsNone(cache.lookup(url))

    def test_vanished_evidence_cache_does_not_fail_an_avatar_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache = AvatarCandidateCache(Path(tmp))
            avatar = inspect_avatar(image_bytes())
            self.assertIsNotNone(avatar)
            provenance = provenance_now(
                entity_id=7, provider="gfriends", source_kind="user_selected",
                matched_name="甲", name_source="picker", external_id="7-S1/a.jpg",
                upstream_url="https://example.invalid/a.jpg", width=avatar.width,
                height=avatar.height, mime_type=avatar.mime_type, sha256=avatar.sha256,
                cache_path="objects/a.jpg",
            )
            with mock.patch("peach.avatar_provider.atomic_write_bytes",
                            side_effect=FileNotFoundError):
                path = cache.store_provenance(provenance)
            self.assertFalse(path.exists())

    def test_duplicate_gate_keeps_evidence_out_of_review(self):
        digest = "a" * 64
        rows = [
            {"section": "missing", "entity_id": 2, "verdict": "ok", "sha256": digest},
            {"section": "missing", "entity_id": 3, "verdict": "ok", "sha256": digest},
        ]
        mark_duplicate_candidates(rows, {digest: 1})
        self.assertEqual([row["verdict"] for row in rows], ["duplicate", "duplicate"])
        self.assertEqual([row["duplicate_of_entity_id"] for row in rows], [1, 1])


if __name__ == "__main__":
    unittest.main()
