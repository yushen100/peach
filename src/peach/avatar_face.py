# -*- coding: utf-8 -*-
r"""实体图的人脸记录：一张图检一次，两处用。

同一次 YuNet 检出既是圆头像的取景依据（`<kind>-<id>.face.json` sidecar），也是选图
时「这张脸有多少像素」的判据。两处分头各检一遍不只是浪费，还会给出互相矛盾的答案：
`harvest_social_avatars.py` 按脸挑赢家、`detect_avatar_faces.py` 另算一份 sidecar，
中间隔着一次落盘，两边看到的可以是不同的图。

sidecar 的形状是契约的一部分，读它的是 `peach.web_state.avatar_focus`：`px` 给源图
像素，归一化的 `face` 配上它才还得出脸的像素数——放大到几倍还清楚问的是像素。未检出
写 `"face": null` 并省略 `focus`，页面维持几何居中。
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from peach import face_detect
from peach.fsutil import atomic_write_text
from peach.catalog_rules import face_focus
from peach.face_detect import FaceDetector, main_face

#: sidecar 与实体图同名，换后缀。`performer-8711.img` → `performer-8711.face.json`。
SIDECAR_SUFFIX = ".face.json"


def sidecar_path(image_path: Path) -> Path:
    return Path(image_path).with_suffix(SIDECAR_SUFFIX)


def face_record_of(image, detector: FaceDetector) -> dict:
    """检一张已解码的图，返回可直接落盘的 sidecar 内容。

    落盘前就要知道答案的调用方走这条：题材头像要在几个候选里挑出「看得见脸」的
    那张，那时图还只是一串字节，先写盘再检就得为落选的那几张各写一次盘。
    """
    height, width = image.shape[:2]
    ratio = round(width / height, 3) if height else 0
    record: dict = {"ratio": ratio, "px": [width, height], "face": None}
    faces = detector.detect(image)
    if not faces:
        return record
    # 多张脸时挑主角：先卡分数再取最大，判据在 peach.face_detect.main_face。
    best = main_face(faces)
    record["face"] = {"cx": best.cx, "cy": best.cy, "w": best.width,
                      "h": best.height, "score": best.score}
    focus = face_focus(ratio, best.cx, best.cy)
    if focus:
        record["focus"] = focus
    return record


def face_record(image_path: Path, detector: FaceDetector) -> dict | None:
    """检一张图，返回可直接落盘的 sidecar 内容；读不出图返回 None。"""
    import cv2

    image = cv2.imread(str(image_path))
    return None if image is None else face_record_of(image, detector)


def face_px_width(record: dict | None) -> int:
    """记录里那张脸有多少像素宽。没有脸、没有记录都是 0。"""
    if not record:
        return 0
    face = record.get("face") or {}
    px = record.get("px") or [0, 0]
    try:
        return round(float(face["w"]) * float(px[0]))
    except (KeyError, TypeError, ValueError, IndexError):
        return 0


def face_share(record: dict | None) -> float:
    """那张脸的宽占画面长边多少。没有脸、没有记录都是 0。

    比「脸有多少像素」多回答一件事：圆标里落下的是不是脸。像素数说的是清晰度，占比
    说的是构图——一张脸只占长边百分之四的图，存多大都改不了「圆里只是画面上的一小
    块」，而那一小块在这个库里多半根本不是脸，是肩背上的纹身或一团暗部。

    按长边而不是按宽：`face["w"]` 是按图宽归一化的，同样一张脸在竖图里算出来大一截。
    """
    px = (record or {}).get("px") or [0, 0]
    try:
        longest = max(int(px[0]), int(px[1]))
    except (TypeError, ValueError, IndexError):
        return 0.0
    return face_px_width(record) / longest if longest > 0 else 0.0


def write_sidecar(image_path: Path, record: dict) -> Path:
    # 原子替换会改目录的修改时间，按头像目录版本取键的缓存（口味、复核的头像取景）
    # 据此认出 sidecar 变了；原地覆写只改文件时间，那些缓存看不见。
    return atomic_write_text(sidecar_path(image_path), json.dumps(record, ensure_ascii=False))


def read_sidecar(image_path: Path) -> dict | None:
    path = sidecar_path(image_path)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def focus_axis(focus: object) -> dict:
    """sidecar 的 `focus` 那一半：换算好的单轴 object-position。

    坏值一律当没有，不当成 0：把 `pct` 写成 `"high"` 的 sidecar 按 0 处理会把
    脸顶到框边上，静静地比几何居中还糟。
    """
    if not isinstance(focus, dict):
        return {}
    axis = focus.get("axis")
    pct = focus.get("pct")
    if (axis not in {"x", "y"} or isinstance(pct, bool)
            or not isinstance(pct, (int, float)) or not 0 <= pct <= 100):
        return {}
    return {"axis": axis, "pct": int(pct)}


def face_box(face: object, px: object) -> dict | None:
    """sidecar 的 `face` 那一半，换算成绝对像素交给页面。

    脸心归一化、脸框归一化、源图像素三样缺一不可：少了源图像素就只剩比例，
    答不了「放大到几倍开始糊」。页面按 `frontend/src/card-art/face-frame.ts` 的字段名取用。
    """
    if not isinstance(face, dict) or not isinstance(px, (list, tuple)) or len(px) != 2:
        return None
    width, height = px
    values = (face.get("cx"), face.get("cy"), face.get("w"))
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in values):
        return None
    if any(isinstance(v, bool) or not isinstance(v, int) or v <= 0
           for v in (width, height)):
        return None
    cx, cy, face_w = values
    if not (0 <= cx <= 1 and 0 <= cy <= 1 and 0 < face_w <= 1):
        return None
    return {"cx": round(float(cx), 3), "cy": round(float(cy), 3),
            "faceW": round(face_w * width), "imgW": width, "imgH": height}


def focus_hint(record: object) -> dict | None:
    """一份记录交给页面的样子：取景加脸框；两样都给不出就是 None。

    两半各自校验、各自缺失。方图算不出 object-position——没有可裁的方向——但脸小
    一样该放大；补 `px` 字段之前写下的 sidecar 只有脸心，那些图照旧只挪。`box` 给的
    是绝对像素，而且是**落盘那张图**的像素：页面拿 `naturalWidth` 核对记录说的是不是
    同一张图，对不上就退回几何居中——错位在界面上和「本来就该这么取景」看不出区别。
    """
    if not isinstance(record, dict):
        return None
    out = focus_axis(record.get("focus"))
    box = face_box(record.get("face"), record.get("px"))
    if box:
        out["box"] = box
    return out or None


def drop_sidecar(image_path: Path) -> None:
    """换了图又给不出新记录时，宁可没有 sidecar。

    留着旧的比没有更糟：页面会拿上一张图的脸框去给这一张取景，放大到一个空位置上，
    而这在界面上与「这张图本来就该这么显示」看不出区别。
    """
    sidecar_path(image_path).unlink(missing_ok=True)


#: 模型取不到之后隔多久再试。服务进程里的探针活得和进程一样久：启动时恰好没网，
#: 联网后要能自己恢复；但也不能每张图都在请求线程里重下一遍。
RETRY_SECONDS = 3600


class FaceProbe:
    """按需构造模型的人脸探针，检不出与检不了分得开。

    模型是懒构造的：这一趟一个候选都没走到就不必去下 232 KB 的 ONNX。取不到模型也不
    让整轮停下——那会把「今天没网」变成「所有人都没有头像」——但要把原因记进 `unavailable`
    让调用方报出来，不然一次下载失败会静悄悄地把整批退回不看脸的旧判据。
    取不到之后 `RETRY_SECONDS` 内直接回 None，过了这段再试一次；取到了 `unavailable` 清空。
    窗口内别处取到了模型（活动中心的「立即重试」）就不再等，下一张图当场重试。
    `allow_download=False` 只用安装包随附或数据目录里已有的模型，不联网（`backfill` 走这条）。
    """

    def __init__(self, clock=time.monotonic, *, allow_download: bool = True):
        self._detector: FaceDetector | None = None
        self._unavailable = ""
        self._failed_at: float | None = None
        self._failed_generation = 0
        self._clock = clock
        self._allow_download = allow_download

    @property
    def unavailable(self) -> str:
        return self._unavailable

    def _ready(self) -> FaceDetector | None:
        if self._detector is not None:
            return self._detector
        if (self._failed_at is not None and self._failed_generation == face_detect.downloads
                and self._clock() - self._failed_at < RETRY_SECONDS):
            return None
        try:
            self._detector = FaceDetector() if self._allow_download else FaceDetector(allow_download=False)
        except Exception as error:              # 缺模型、缺 OpenCV、下载失败
            self._unavailable = str(error)
            self._failed_at = self._clock()
            self._failed_generation = face_detect.downloads
            return None
        self._unavailable = ""
        self._failed_at = None
        return self._detector

    def __call__(self, image_path: Path) -> dict | None:
        detector = self._ready()
        if detector is None:
            return None
        try:
            return face_record(Path(image_path), self._detector)
        except Exception:                       # 单张图解不开不该拖垮整轮
            return None

    def on_bytes(self, payload: bytes) -> dict | None:
        """还没落盘的一串字节的人脸记录。几个候选里挑一张时走这条，落选的不写盘。"""
        detector = self._ready()
        if detector is None:
            return None
        try:
            image = face_detect.decode(payload)
            return None if image is None else face_record_of(image, detector)
        except Exception:                       # 单张图解不开不该拖垮整轮
            return None


def stale(image_path: Path) -> bool:
    """这张实体图要补测人脸：没有 sidecar、sidecar 比图旧（换图后没重检），或 `px` 与图的实际
    尺寸对不上（含补 `px` 之前写下的）。页面遇到后两种也只会退回几何居中。"""
    from peach.images import measure_image_file

    record = read_sidecar(image_path)
    if not isinstance(record, dict):
        return True
    try:
        if sidecar_path(image_path).stat().st_mtime < Path(image_path).stat().st_mtime:
            return True
    except OSError:
        return True
    size = measure_image_file(image_path)
    return size is not None and record.get("px") != [size[0], size[1]]


def backfill(root: Path, probe: FaceProbe) -> dict | None:
    """`root` 下要补测的 `*.img`（`stale`）逐张检脸、写 sidecar，返回检了几张、写了几张。

    只读本机图片，探针该用不联网的那种（`FaceProbe(allow_download=False)`）。模型用不了时
    返回 None，什么也不写，调用方下次再试。写之前拿安装头像的同一把锁，图在检测期间换过就
    不写：新图由安装那一侧自己检。读不出的图跳过。
    """
    from filelock import FileLock, Timeout

    checked = written = 0
    for image_path in sorted(Path(root).glob("*.img")) if Path(root).is_dir() else ():
        if not stale(image_path):
            continue
        try:
            before = image_path.stat().st_mtime_ns
        except OSError:
            continue
        record = probe(image_path)
        if record is None:
            if probe.unavailable:
                return None
            continue
        checked += 1
        try:
            with FileLock(image_path.with_suffix(".install.lock"), timeout=30):
                if image_path.stat().st_mtime_ns != before:
                    continue
                write_sidecar(image_path, record)
                written += 1
        except (OSError, Timeout):
            continue
    return {"checked": checked, "written": written}
