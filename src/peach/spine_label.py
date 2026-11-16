# -*- coding: utf-8 -*-
"""封套书脊上印的番号在哪：找到它就知道哪一条竖带是书脊，折痕是书脊的右缘。

只靠边缘与颜色分不清书脊和正封里长得像书脊的竖带：STZY-019 的黄色书脊和 CEAD-731 正封左侧
的红色标题栏，梯度、满高覆盖与宽度几乎一样；书脊里的标志框、照片框也是两道满高边夹出的竖带。
书脊底部几乎都印着番号（JBS-016、CEAD-731、IPX-843 的标签都在书脊上），这是分得开的特征。

文字检测复用 `avatar_watermark` 的 PP-OCRv3 DB 模型，识别用同一来源 opencv_zoo 的 CRNN 英文模型
（数字与小写字母），都走 OpenCV 自带的 dnn，不另引运行时。只在标准折痕位置附近那一条竖带里找，
竖带按段放大后识别：整条压到 736 像素时标签字太小，一个都认不出。
"""
from __future__ import annotations

import re
import threading
from pathlib import Path

from . import avatar_watermark
from .avatar_watermark import WatermarkModelUnavailable
from .config import TOOLS_DIR

#: opencv_zoo 定版的 CRNN 英文识别模型，和检测模型同一个仓库、同一种取法（media. 域名，见
#: `avatar_watermark.MODEL_URL`）。
RECOGNIZER_URL = (
    "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/"
    "models/text_recognition_crnn/text_recognition_CRNN_EN_2021sep.onnx"
)
RECOGNIZER_SHA256 = "a84b1f6e11a65c2d733cb0cc1f014aae3f99051e3f11447dc282faa678eee544"
RECOGNIZER_PATH = TOOLS_DIR / "ppocr" / "text_recognition_CRNN_EN_2021sep.onnx"
VOCABULARY = "0123456789abcdefghijklmnopqrstuvwxyz"
#: CRNN 的输入尺寸与归一化，沿用 opencv_zoo 示例。
RECOGNIZER_SIZE = (100, 32)

#: 找番号的竖带：标准折痕位置左边这么多倍图高（盖住整条书脊和封底靠书脊的一侧）到右边这么多倍。
SEARCH_LEFT = 0.16
SEARCH_RIGHT = 0.06
#: 竖带按段识别，每段高是竖带宽的这个倍数，段与段重叠三分之一。
TILE_RATIO = 1.5
#: 竖排文字框（高比宽大这么多倍）转两个方向都识别一遍。
VERTICAL_RATIO = 1.5


class CodePattern:
    """番号的字母段必须原样出现，字母加数字整体容许一个字符的差异。

    识别偶尔丢字或认混：CEAD-731 读成 `cead31`，UNT-017 读成 `unto17`（0 认成 o）。字母段要求原样，
    是为了不让封底小字里碰巧的数字串凑上来。
    """

    def __init__(self, code: str):
        found = re.match(r"^(?:\d+)?([A-Z]+)-?0*(\d+)", (code or "").upper())
        self.letters = found.group(1).lower() if found else ""
        digits = found.group(2) if found else ""
        self.targets = {self.letters + digits.zfill(width) for width in (len(digits), 3, 5)} if found else set()

    def matches(self, word: str) -> bool:
        if not self.letters:
            return False
        start = word.find(self.letters)
        if start < 0:
            return False
        tail = word[start:]
        return any(_distance(tail[:len(target) + extra], target) <= 1
                   for target in self.targets for extra in (-1, 0, 1))


def _distance(a: str, b: str) -> int:
    row = list(range(len(b) + 1))
    for i, char_a in enumerate(a, 1):
        previous, row[0] = row[0], i
        for j, char_b in enumerate(b, 1):
            previous, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, previous + (char_a != char_b))
    return row[-1]


def ensure_recognizer(path: Path | None = None, *, allow_download: bool = True) -> Path:
    """本地那份校验通过就用，否则按固定 URL 取一次再校验；失败抛 `WatermarkModelUnavailable`。"""
    return avatar_watermark.ensure_model(path or RECOGNIZER_PATH, allow_download=allow_download,
                                         url=RECOGNIZER_URL, sha256=RECOGNIZER_SHA256)


class SpineReader:
    """检测与识别模型各建一次反复用。"""

    def __init__(self, *, allow_download: bool = True) -> None:
        import cv2

        detector_path = avatar_watermark.ensure_model(allow_download=allow_download)
        recognizer_path = ensure_recognizer(allow_download=allow_download)
        self._detector = cv2.dnn_TextDetectionModel_DB(str(detector_path))
        self._detector.setBinaryThreshold(avatar_watermark.BINARY_THRESHOLD)
        self._detector.setPolygonThreshold(avatar_watermark.POLYGON_THRESHOLD)
        self._detector.setMaxCandidates(avatar_watermark.MAX_CANDIDATES)
        self._detector.setUnclipRatio(avatar_watermark.UNCLIP_RATIO)
        side = avatar_watermark.INPUT_SIDE
        self._detector.setInputParams(avatar_watermark.INPUT_SCALE, (side, side), avatar_watermark.INPUT_MEAN)
        self._recognizer = cv2.dnn.readNet(str(recognizer_path))
        # OpenCV 的 dnn 网络不能并发调用：同一批里几个线程同时装封面会撞上。
        self._lock = threading.Lock()

    def _read(self, patch) -> str:
        import cv2

        gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY) if patch.ndim == 3 else patch
        blob = cv2.dnn.blobFromImage(cv2.resize(gray, RECOGNIZER_SIZE), 1 / 127.5, RECOGNIZER_SIZE, 127.5)
        self._recognizer.setInput(blob)
        indices = self._recognizer.forward()[:, 0, :].argmax(axis=1)
        text, last = [], 0
        for index in indices:
            if index != last and index != 0:
                text.append(VOCABULARY[index - 1])
            last = index
        return "".join(text)

    def _words(self, image):
        import cv2
        import numpy

        side = avatar_watermark.INPUT_SIDE
        scale = side / max(image.shape[:2])
        small = cv2.resize(image, (max(1, round(image.shape[1] * scale)), max(1, round(image.shape[0] * scale))))
        canvas = numpy.zeros((side, side, 3), numpy.uint8)
        canvas[:small.shape[0], :small.shape[1]] = small
        boxes, _ = self._detector.detect(canvas)
        for quad in boxes:
            points = (numpy.array(quad, numpy.float32) / scale).astype(numpy.int32)
            x, y, w, h = cv2.boundingRect(points)
            x, y = max(0, x), max(0, y)
            patch = image[y:y + h, x:x + w]
            if not patch.size:
                continue
            patches = ([cv2.rotate(patch, cv2.ROTATE_90_CLOCKWISE), cv2.rotate(patch, cv2.ROTATE_90_COUNTERCLOCKWISE)]
                       if h > w * VERTICAL_RATIO else [patch])
            yield (x, y, w, h), [self._read(item) for item in patches]

    def code_box(self, image, code: str, anchor: int) -> tuple[int, int] | None:
        """标准折痕位置 `anchor` 附近印着这个番号的文字框的左右两列；认不出返回 None。

        认出好几处时取最靠右、又没越过 `anchor` 右边 `SEARCH_RIGHT` 倍图高的那一处：
        封底下角也常印番号，书脊上的那一处离正封最近。
        """
        pattern = CodePattern(code)
        if not pattern.letters or image is None or not getattr(image, "size", 0):
            return None
        height, width = image.shape[:2]
        left = max(0, anchor - round(SEARCH_LEFT * height))
        right = min(width, anchor + round(SEARCH_RIGHT * height))
        if right - left < 16:
            return None
        strip = image[:, left:right]
        tile = max(32, round((right - left) * TILE_RATIO))
        hits = []
        with self._lock:
            for top in range(0, height, max(1, tile * 2 // 3)):
                for (x, _, w, _), words in self._words(strip[top:top + tile]):
                    if any(pattern.matches(word) for word in words):
                        hits.append((x + left, x + left + w))
        return max(hits, key=lambda hit: hit[1]) if hits else None


_READER: list[SpineReader] = []
_READER_LOCK = threading.Lock()


def default_reader(*, allow_download: bool = False) -> SpineReader | None:
    """装封面时共用的那一个；本地没有模型就是 None，取景退回原有判据。

    装封面不自己下载：一批里每张都会撞上，测试里也会联网。模型由补判与重算脚本
    （`scripts/judge_cover_portraits.py --apply`、`scripts/poster_crop_boxes.py`）开跑前取一次，
    `allow_download=True` 就是给它们用的。
    """
    with _READER_LOCK:
        if not _READER:
            try:
                _READER.append(SpineReader(allow_download=allow_download))
            except (WatermarkModelUnavailable, ImportError):
                return None
        return _READER[0]
