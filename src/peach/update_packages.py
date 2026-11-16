"""独立更新包的工具清单与本机文件校验。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import re

from .user_messages import UserValueError

MANIFEST = "update-manifest.json"
TOOL_PATHS = {
    "ffmpeg": ("tools/ffmpeg", {"bin/ffmpeg.exe", "bin/ffprobe.exe", "manifest.json", "LICENSE.txt", "NOTICE.md", "buildconf.txt"}),
    "untrunc": ("tools/untrunc", {"untrunc.exe", "manifest.json", "LICENSE.txt", "NOTICE.md", "buildconf.txt"}),
    "cloudflared": ("", {"cloudflared.exe", "cloudflared-manifest.json"}),
    "face-models": ("tools/face-models", {"face_detection_yunet_2023mar.onnx", "face_recognition_sface_2021dec.onnx",
                                          "text_detection_en_ppocrv3_2023may.onnx", "text_recognition_CRNN_EN_2021sep.onnx",
                                          "320n.onnx", "LICENSE-yunet.txt", "LICENSE-sface.txt", "LICENSE-ppocr.txt",
                                          "LICENSE-crnn.txt", "LICENSE-nudenet.txt", "manifest.json"}),
}
#: 运行时自己能补齐的工具：旧版更新器不认得它、装好的新版里缺了它，由它自己的运行时下载
#: （人脸模型见 `face_models`）。新版本往清单里加旧客户端不认得的工具，必须登记在这里，
#: 否则 `scripts/update_compat.py` 拒绝发布（ADR-0120）。
SELF_PROVISIONED = frozenset({"face-models"})


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def checked_path(root: Path, name: str) -> Path:
    parts = PurePosixPath(name).parts
    if (not parts or "\\" in name or ":" in name or ".." in parts or any(part.endswith((".", " ")) for part in parts)
            or name.startswith("/") or PurePosixPath(name).as_posix() != name):
        raise UserValueError("errors.updatePackages.toolPathInvalid")
    path = root.joinpath(*parts)
    if not path.resolve().is_relative_to(root.resolve()) or any(
            parent.is_symlink() for parent in (path, *path.parents) if parent != root.parent):
        raise UserValueError("errors.updatePackages.toolPathEscapes")
    return path


def matches(root: Path, files: dict[str, str]) -> bool:
    try:
        return all((path := checked_path(root, name)).is_file() and digest(path) == expected
                   for name, expected in files.items())
    except (OSError, ValueError):
        return False


def read_manifest(stage: Path, version: str) -> dict:
    """读更新包的工具清单，只留本版认得、清单里也有的工具。

    工具集合两个方向都可能变，哪一边都不拒：清单多出本版不认得的工具，是更新版本新增的
    工具包，这一版不下载，装好后由那个工具自己的运行时补齐（`SELF_PROVISIONED`）；清单里
    少了本版认得的工具，是更新版本不再需要它，不准备也不校验。
    """
    manifest = json.loads((stage / MANIFEST).read_text(encoding="utf-8"))
    if (not isinstance(manifest, dict) or manifest.get("format") != 1 or manifest.get("version") != version
            or not isinstance(manifest.get("tools"), dict)):
        raise UserValueError("errors.updatePackages.manifestInvalid")
    manifest["tools"] = {tool: manifest["tools"][tool] for tool in TOOL_PATHS if tool in manifest["tools"]}
    all_names: set[str] = set()
    for tool, bundle in manifest["tools"].items():
        if not isinstance(bundle, dict):
            raise UserValueError("errors.updatePackages.manifestInvalid")
        prefix, required = TOOL_PATHS[tool]
        files = bundle.get("files")
        if not isinstance(files, dict) or not files or len(files) > 2000:
            raise UserValueError("errors.updatePackages.fileListInvalid")
        expected_names = {f"{prefix}/{name}" if prefix else name for name in required}
        if not expected_names.issubset(files):
            raise UserValueError("errors.updatePackages.requiredFileMissing")
        for name, expected in files.items():
            checked_path(stage, name)
            if ((prefix and not name.startswith(prefix + "/")) or (not prefix and name not in required)
                    or not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected)
                    or name.casefold() in all_names):
                raise UserValueError("errors.updatePackages.fileListInvalid")
            all_names.add(name.casefold())
        asset = bundle.get("asset", {})
        if (not isinstance(asset, dict) or asset.get("name") != f"Peach-{version}-windows-x64-tools-{tool}.zip"
                or not isinstance(asset.get("size"), int) or not 0 < asset["size"] <= 512 * 1024 * 1024
                or not isinstance(asset.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", asset["sha256"])):
            raise UserValueError("errors.updatePackages.downloadInfoInvalid")
    return manifest
