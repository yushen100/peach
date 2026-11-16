"""取随包分发的识别模型及其许可证，逐个校验 SHA-256 后放进发行包的模型目录。

人脸检测 YuNet、人脸比对 SFace，以及封面取景用的三个：书脊与水印的文字检测（PP-OCRv3）、书脊番号识别
（CRNN）、整幅封面的身体部位检测（NudeNet 320n，从 PyPI 的 nudenet wheel 里解出，见 `peach.body_parts`）。

Windows 构建放进程序目录的 `tools/face-models`，macOS 放 `Peach.app/Contents/Resources/tools/face-models`，
运行时由 `peach.face_detect.bundled_model` 认这一份；Docker 镜像在 Dockerfile 里按同一组地址与哈希取。
下载先落到缓存目录，缓存里哈希对得上的文件不再联网。
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from peach import avatar_watermark, body_parts, face_detect, face_match, spine_label
from peach.interface_text import dev as t
from peach.peach_proxy import read_url
from peach.user_agent import USER_AGENT

CACHE = ROOT / "build" / "face-models"
SOURCE = "https://github.com/opencv/opencv_zoo"
LICENSE_BASE = f"https://raw.githubusercontent.com/opencv/opencv_zoo/{face_detect.ZOO_COMMIT}/models/"
#: (随包文件名, 地址, SHA-256[, 压缩包里的路径])。许可证按 opencv_zoo 各模型目录的 LICENSE 与 README 核实：
#: `face_detection_yunet` 为 MIT（Copyright (c) 2020 Shiqi Yu），`face_recognition_sface`、
#: `text_detection_ppocr`（PaddlePaddle）、`text_recognition_crnn` 为 Apache-2.0；这些目录都没有 NOTICE
#: 文件。NudeNet 为 AGPL-3.0，与 Peach 相同，许可证取 wheel 自带的那份。带第四项的从 wheel 里解出，
#: 校验的是解出来的文件。
WHEEL = body_parts.MODEL_URL
FILES = (
    (face_detect.MODEL_PATH.name, face_detect.MODEL_URL, face_detect.MODEL_SHA256),
    (face_match.MODEL_PATH.name, face_match.MODEL_URL, face_match.MODEL_SHA256),
    (avatar_watermark.MODEL_PATH.name, avatar_watermark.MODEL_URL, avatar_watermark.MODEL_SHA256),
    (spine_label.RECOGNIZER_PATH.name, spine_label.RECOGNIZER_URL, spine_label.RECOGNIZER_SHA256),
    (body_parts.MODEL_PATH.name, WHEEL, body_parts.MODEL_SHA256, body_parts.MODEL_MEMBER),
    ("LICENSE-yunet.txt", LICENSE_BASE + "face_detection_yunet/LICENSE",
     "c83b8120c50ccbd4c4f96edf53141bdd566ebb8f8e9227e415326aa1b1aba958"),
    ("LICENSE-sface.txt", LICENSE_BASE + "face_recognition_sface/LICENSE",
     "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"),
    ("LICENSE-ppocr.txt", LICENSE_BASE + "text_detection_ppocr/LICENSE",
     "609aaac97719da6b71cd3ffd08b5de08b75f582e5c50a196fab522b6d5087714"),
    ("LICENSE-crnn.txt", LICENSE_BASE + "text_recognition_crnn/LICENSE",
     "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"),
    ("LICENSE-nudenet.txt", WHEEL, "8486a10c4393cee1c25392769ddd3b2d6c242d6ec7928e1414efff7dfb2f07ef",
     "nudenet-3.4.2.dist-info/LICENSE"),
)
#: 模型文件名 → (许可证, 许可文件)。
LICENSES = {
    face_detect.MODEL_PATH.name: ("MIT", "LICENSE-yunet.txt"),
    face_match.MODEL_PATH.name: ("Apache-2.0", "LICENSE-sface.txt"),
    avatar_watermark.MODEL_PATH.name: ("Apache-2.0", "LICENSE-ppocr.txt"),
    spine_label.RECOGNIZER_PATH.name: ("Apache-2.0", "LICENSE-crnn.txt"),
    body_parts.MODEL_PATH.name: ("AGPL-3.0", "LICENSE-nudenet.txt"),
}


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def download(url: str) -> bytes:
    return read_url(url, headers={"User-Agent": USER_AGENT}, timeout=300)


def manifest() -> str:
    """模型目录里的 `manifest.json`：来源提交、地址、哈希与许可证。内容固定，工具包哈希可复现。"""
    models = [{"file": name, "url": url, "sha256": sha256, **({"member": rest[0]} if rest else {}),
               "license": LICENSES[name][0], "license_file": LICENSES[name][1]}
              for name, url, sha256, *rest in FILES if name in LICENSES]
    return json.dumps({"source": SOURCE, "commit": face_detect.ZOO_COMMIT, "models": models},
                      ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def install(destination: Path, *, cache: Path = CACHE, fetch=download) -> list[Path]:
    """把 `FILES` 与清单写进 `destination`；任何一个哈希对不上都不落盘并报错。同一个 wheel 只取一次。"""
    cache.mkdir(parents=True, exist_ok=True)
    destination.mkdir(parents=True, exist_ok=True)
    written = []
    archives: dict[str, bytes] = {}
    for name, url, sha256, *member in FILES:
        cached = cache / name
        if not (cached.is_file() and digest(cached) == sha256):
            if member:
                if url not in archives:
                    archives[url] = fetch(url)
                with zipfile.ZipFile(io.BytesIO(archives[url])) as archive:
                    payload = archive.read(member[0])
            else:
                payload = fetch(url)
            actual = hashlib.sha256(payload).hexdigest()
            if actual != sha256:
                raise ValueError(t("fetch_face_models.shaMismatch", name=name, sha256=sha256, actual=actual))
            temporary = cached.with_name(cached.name + ".part")
            temporary.write_bytes(payload)
            temporary.replace(cached)
        shutil.copyfile(cached, destination / name)
        written.append(destination / name)
    (destination / "manifest.json").write_bytes(manifest().encode("utf-8"))
    written.append(destination / "manifest.json")
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=t("fetch_face_models.description"))
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=CACHE)
    args = parser.parse_args()
    written = install(args.destination.resolve(), cache=args.cache.resolve())
    print(json.dumps({"destination": str(args.destination.resolve()), "files": [path.name for path in written]},
                     ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
