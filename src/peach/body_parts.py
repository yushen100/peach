# -*- coding: utf-8 -*-
"""整幅封面的主体在哪：脸很小或没有脸时，卡片按最大的那个身体部位取景。

整幅宣传图（4:3、SOD 1.416、拼贴）放进 3:4 的大图格只露得出一条竖带。按人脸取景时，主打臀部、
黑丝、胸的封面（SDDE-613、STARS-080、AKDL-109）露出的是角落里一张小脸。人体分割（opencv_zoo 的
PP-HumanSeg）在拼贴图上几乎整张都标成人，分不出主体；部位检测分得出。

模型是 NudeNet v3 的 320n（YOLOv8n，18 类部位，AGPL-3.0，与 Peach 相同），走 OpenCV 自带的 dnn，
不引 onnxruntime。GitHub 发布页对匿名下载会跳登录，模型从 PyPI 上 nudenet 3.4.2 的 wheel 里解出，
与发布页那份逐字节相同。
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path

from . import avatar_watermark
from .avatar_watermark import WatermarkModelUnavailable
from .config import TOOLS_DIR

MODEL_URL = ("https://files.pythonhosted.org/packages/1c/ee/1aa02d44ba958cc77e16ff1e41a0aac5e721037db7bf62b9c9d124917f87/"
             "nudenet-3.4.2-py3-none-any.whl")
MODEL_MEMBER = "nudenet/320n.onnx"
MODEL_SHA256 = "c15d8273adad2d0a92f014cc69ab2d6c311a06777a55545f2c4eb46f51911f0f"
MODEL_PATH = TOOLS_DIR / "nudenet" / "320n.onnx"
INPUT_SIDE = 320
#: 模型输出的类别顺序，与 nudenet 3.4.2 的 `nudenet.py` 一致。
LABELS = ("FEMALE_GENITALIA_COVERED", "FACE_FEMALE", "BUTTOCKS_EXPOSED", "FEMALE_BREAST_EXPOSED",
          "FEMALE_GENITALIA_EXPOSED", "MALE_BREAST_EXPOSED", "ANUS_EXPOSED", "FEET_EXPOSED", "BELLY_COVERED",
          "FEET_COVERED", "ARMPITS_COVERED", "ARMPITS_EXPOSED", "FACE_MALE", "BELLY_EXPOSED",
          "MALE_GENITALIA_EXPOSED", "ANUS_COVERED", "FEMALE_BREAST_COVERED", "BUTTOCKS_COVERED")
#: 算主体的部位：女优的脸、胸、臀、腿脚、腹、私处。男性部位与腋下不算。
SUBJECT = frozenset(LABELS) - {"MALE_BREAST_EXPOSED", "FACE_MALE", "MALE_GENITALIA_EXPOSED",
                               "ARMPITS_COVERED", "ARMPITS_EXPOSED"}
#: 检出的门槛与去重，沿用 nudenet 自己的取值；当主体还要更高的分数，免得一块勉强的检出抢走取景。
MIN_SCORE = 0.25
NMS_OVERLAP = 0.45
SUBJECT_SCORE = 0.4


@dataclass(frozen=True)
class Part:
    """一处部位，坐标按原图归一化：中心 `cx`、`cy`，宽高 `w`、`h`。"""

    kind: str
    cx: float
    cy: float
    w: float
    h: float
    score: float

    @property
    def area(self) -> float:
        return self.w * self.h


def ensure_model(path: Path | None = None, *, allow_download: bool = True) -> Path:
    """本地那份校验通过就用，否则从 wheel 里解出一次再校验；失败抛 `WatermarkModelUnavailable`。"""
    return avatar_watermark.ensure_model(path or MODEL_PATH, allow_download=allow_download,
                                         url=MODEL_URL, sha256=MODEL_SHA256, member=MODEL_MEMBER)


def tiles(width: int, height: int) -> list[tuple[int, int]]:
    """横图按图高切成方块的左缘，相邻块重叠：整张缩到 320 时一个人只剩几十像素。"""
    side = min(width, height)
    if width <= side:
        return [(0, side)]
    count = -(-width // side) + 1
    return [(round(index * (width - side) / (count - 1)), side) for index in range(count)]


class PartDetector:
    """模型建一次反复用。"""

    def __init__(self, *, allow_download: bool = True) -> None:
        import cv2

        self._net = cv2.dnn.readNet(str(ensure_model(allow_download=allow_download)))
        # OpenCV 的 dnn 网络不能并发调用：同一批里几个线程同时装封面会撞上。
        self._lock = threading.Lock()

    def detect(self, image) -> list[Part]:
        import cv2
        import numpy

        if image is None or not getattr(image, "size", 0):
            return []
        height, width = image.shape[:2]
        source = image
        if height > width:  # 竖图右侧补黑成方块，和 nudenet 自己的做法一样，不拉伸
            source = numpy.zeros((height, height, 3), numpy.uint8)
            source[:, :width] = image[:, :, :3]
        boxes, scores, kinds = [], [], []
        with self._lock:
            for left, side in tiles(max(width, height), height):
                tile = source[:side, left:left + side]
                self._net.setInput(cv2.dnn.blobFromImage(tile, 1 / 255, (INPUT_SIDE, INPUT_SIDE), (0, 0, 0),
                                                         swapRB=True, crop=False))
                scale = side / INPUT_SIDE
                for row in self._net.forward()[0].T:
                    kind = int(row[4:].argmax())
                    score = float(row[4 + kind])
                    if score < MIN_SCORE:
                        continue
                    cx, cy, w, h = (float(value) * scale for value in row[:4])
                    boxes.append([round(cx - w / 2) + left, round(cy - h / 2), round(w), round(h)])
                    scores.append(score)
                    kinds.append(LABELS[kind])
        keep = numpy.array(cv2.dnn.NMSBoxes(boxes, scores, MIN_SCORE, NMS_OVERLAP)).flatten() if boxes else []
        return [Part(kinds[i], round(min(1.0, max(0.0, (boxes[i][0] + boxes[i][2] / 2) / width)), 3),
                     round(min(1.0, max(0.0, (boxes[i][1] + boxes[i][3] / 2) / height)), 3),
                     round(boxes[i][2] / width, 3), round(boxes[i][3] / height, 3), round(scores[i], 3))
                for i in keep]


def main_subject(parts: list[Part], face_area: float = 0.0) -> Part | None:
    """比主脸还大的那个部位；没有就是 None，卡片照旧按脸取景。

    实测 10 张整幅封面：按部位面积总和取景会被一堆小剧照拉偏（FKOS-005 丢了左边的大特写脸），
    取最大的那一处不会；最大的那处本身常就是脸（`FACE_FEMALE`）。
    """
    found = [part for part in parts if part.kind in SUBJECT and part.score >= SUBJECT_SCORE]
    largest = max(found, key=lambda part: part.area, default=None)
    return largest if largest is not None and largest.area > face_area else None


_DETECTOR: list[PartDetector] = []
_DETECTOR_LOCK = threading.Lock()


def default_detector(*, allow_download: bool = False) -> PartDetector | None:
    """装封面时共用的那一个；本地没有模型就是 None，卡片照旧按脸取景。

    装封面不自己下载，模型由 `scripts/detect_cover_faces.py` 开跑前取一次。
    """
    with _DETECTOR_LOCK:
        if not _DETECTOR:
            try:
                _DETECTOR.append(PartDetector(allow_download=allow_download))
            except (WatermarkModelUnavailable, ImportError):
                return None
        return _DETECTOR[0]
