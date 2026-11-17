"""人脸模型随安装包分发：取模型的脚本、Docker 镜像的同一组文件，以及完整包到运行时的整条路。

真模型不进测试、不出网：每个文件换成小字节，哈希按它们重算；从 wheel 里解出的那几个装进一个小 zip。
"""
import hashlib
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch
import io
import zipfile

from peach import avatar_watermark, body_parts, face_detect, face_match, face_models, image_ocr, spine_label, update_packages
from support.outcomes import told
from scripts import fetch_face_models
from scripts.package_windows_release import package as package_release

ROOT = Path(__file__).resolve().parents[1]


def sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


class FixtureCase(unittest.TestCase):
    """每个文件换成小字节；`FILES` 与两个运行时模块的哈希一起换，脚本与运行时仍是同一组判据。"""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.payloads = {name: f"fixture {name}".encode() for name, *_ in fetch_face_models.FILES}
        self.urls = {url: name for name, url, _, *member in fetch_face_models.FILES if not member}
        wheel = io.BytesIO()
        with zipfile.ZipFile(wheel, "w") as archive:
            for name, _, _, *member in fetch_face_models.FILES:
                if member:
                    archive.writestr(member[0], self.payloads[name])
        self.wheel = wheel.getvalue()
        files = tuple((name, url, sha(self.payloads[name]), *member) for name, url, _, *member in fetch_face_models.FILES)
        for patcher in (
                patch.object(fetch_face_models, "FILES", files),
                patch.object(face_detect, "MODEL_SHA256", sha(self.payloads[face_detect.MODEL_PATH.name])),
                patch.object(face_match, "MODEL_SHA256", sha(self.payloads[face_match.MODEL_PATH.name])),
                patch.object(face_detect, "_verified", {})):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.fetched = []

    def fetch(self, url: str) -> bytes:
        self.fetched.append(url)
        return self.wheel if url == fetch_face_models.WHEEL else self.payloads[self.urls[url]]


class FetchScriptTests(FixtureCase):
    def test_the_bundle_holds_every_file_the_tool_package_requires(self):
        destination = self.root / "tools" / "face-models"
        fetch_face_models.install(destination, cache=self.root / "cache", fetch=self.fetch)
        _, required = update_packages.TOOL_PATHS["face-models"]
        self.assertEqual({path.name for path in destination.iterdir()}, required)
        manifest = json.loads((destination / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["commit"], face_detect.ZOO_COMMIT)
        self.assertEqual({model["file"]: (model["license"], model["license_file"]) for model in manifest["models"]},
                         {face_detect.MODEL_PATH.name: ("MIT", "LICENSE-yunet.txt"),
                          face_match.MODEL_PATH.name: ("Apache-2.0", "LICENSE-sface.txt"),
                          avatar_watermark.MODEL_PATH.name: ("Apache-2.0", "LICENSE-ppocr.txt"),
                          spine_label.RECOGNIZER_PATH.name: ("Apache-2.0", "LICENSE-crnn.txt"),
                          body_parts.MODEL_PATH.name: ("AGPL-3.0", "LICENSE-nudenet.txt")})

    def test_a_verified_cache_is_reused_without_network(self):
        cache = self.root / "cache"
        fetch_face_models.install(self.root / "first", cache=cache, fetch=self.fetch)
        downloads = len(self.urls) + 1
        self.assertEqual(len(self.fetched), downloads, "同一个 wheel 只取一次")
        fetch_face_models.install(self.root / "second", cache=cache, fetch=self.fetch)
        self.assertEqual(len(self.fetched), downloads, "缓存里哈希对得上的文件不再联网")
        self.assertEqual((self.root / "first" / "manifest.json").read_bytes(),
                         (self.root / "second" / "manifest.json").read_bytes(), "清单内容固定，工具包哈希可复现")

    def test_a_download_whose_digest_differs_is_refused_and_not_cached(self):
        cache = self.root / "cache"
        with self.assertRaisesRegex(ValueError, "SHA-256 不符"):
            fetch_face_models.install(self.root / "out", cache=cache, fetch=lambda url: b"tampered")
        self.assertEqual(list(cache.iterdir()), [])

    def test_the_pinned_files_point_at_one_opencv_zoo_commit(self):
        """opencv_zoo 的都钉在同一个提交；从 wheel 里解的钉在 PyPI 上那一个版本的 wheel。"""
        for name, url, digest, *member in fetch_face_models.FILES:
            with self.subTest(name=name):
                if member:
                    self.assertEqual(url, body_parts.MODEL_URL)
                else:
                    self.assertEqual(url.split("/opencv_zoo/", 1)[1].split("/", 1)[0], face_detect.ZOO_COMMIT)
                self.assertTrue(re.fullmatch(r"[0-9a-f]{64}", digest))


class DockerImageTests(unittest.TestCase):
    def test_the_image_adds_the_same_files_with_the_same_digests(self):
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        added = {Path(target).name: (url, digest) for digest, url, target in re.findall(
            r"ADD --chmod=a\+rX --checksum=sha256:([0-9a-f]{64}) \\\n\s+(\S+) \\\n\s+(/app/tools/face-models/\S+)",
            dockerfile)}
        # 镜像同时携带共享视觉模型与 Linux OCR 模型，各按运行时登记的地址和哈希核对。
        expected = {name: (url, digest) for name, url, digest, *member in fetch_face_models.FILES if not member}
        expected.update({Path(relative).name: (image_ocr.MODEL_ROOT + relative, digest)
                         for _, relative, digest in image_ocr.MODEL_SPECS})
        self.assertEqual(added, expected)
        # 从 wheel 里解出的那几个：镜像只取脚本钉的那一个 wheel，解出的文件与成员和 `FILES` 一一对应。
        wheels = re.findall(r"ADD --checksum=sha256:[0-9a-f]{64} \\\n\s+(\S+) \\\n\s+/tmp/\S+\.whl", dockerfile)
        self.assertEqual(wheels, [fetch_face_models.WHEEL])
        extracted = dict(re.findall(
            r"open\('/app/tools/face-models/([^']+)', 'wb'\)\.write\(z\.read\('([^']+)'\)\)", dockerfile))
        self.assertEqual(extracted, {name: member[0] for name, _, _, *member in fetch_face_models.FILES if member})
        self.assertEqual(re.findall(r"PEACH_FACE_MODELS=(\S+)", dockerfile), ["/app/tools/face-models"])


class FullPackageTests(FixtureCase):
    """完整包里带两个模型、哈希对得上；解开后运行时直接用它，不联网、不往数据根写。"""

    def test_the_full_package_ships_both_models_and_the_runtime_uses_them_offline(self):
        source = self.root / "dist" / "Peach"
        (source / "_internal").mkdir(parents=True)
        (source / "Peach.exe").write_bytes(b"application")
        (source / "_internal/standalone.txt").touch()
        for tool, (prefix, required) in update_packages.TOOL_PATHS.items():
            if tool == "face-models":
                continue
            for name in required:
                path = source / prefix / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(name.encode())
        fetch_face_models.install(source / "tools" / "face-models", cache=self.root / "cache", fetch=self.fetch)
        output = self.root / "release"
        manifest = package_release(source, output, "1.0.0")

        prefix = "Peach/tools/face-models/"
        with zipfile.ZipFile(output / "Peach-1.0.0-windows-x64.zip") as full:
            shipped = {name.removeprefix(prefix): sha(full.read(name))
                       for name in full.namelist() if name.startswith(prefix)}
            full.extractall(self.root / "installed")
        for module in (face_detect, face_match):
            self.assertEqual(shipped[module.MODEL_PATH.name], module.MODEL_SHA256)
        self.assertEqual({"tools/face-models/" + name for name in shipped},
                         set(manifest["tools"]["face-models"]["files"]))
        with zipfile.ZipFile(output / "Peach-1.0.0-windows-x64-update.zip") as thin:
            self.assertFalse([name for name in thin.namelist() if name.startswith(prefix)], "应用更新包不带模型")

        data = self.root / "data"
        bundle = self.root / "installed" / "Peach" / "tools" / "face-models"
        with patch.dict(face_detect.os.environ, {face_detect.BUNDLE_ENV: str(bundle)}), \
                patch.object(face_detect, "MODEL_PATH", data / "yunet" / face_detect.MODEL_PATH.name), \
                patch.object(face_match, "MODEL_PATH", data / "sface" / face_match.MODEL_PATH.name), \
                patch.object(face_detect, "read_url", side_effect=AssertionError("程序目录有模型时不该联网")):
            self.assertEqual(face_detect.ensure_model(), bundle / face_detect.MODEL_PATH.name)
            self.assertEqual(face_match.ensure_model(), bundle / face_match.MODEL_PATH.name)
            self.assertEqual(told(face_models.download_all()), {"ok": True, "outcome": "人脸模型已就绪"})
        self.assertFalse(data.exists(), "随包那份不往数据根复制")


if __name__ == "__main__":
    unittest.main()
