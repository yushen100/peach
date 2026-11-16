"""原子安装 JAV 封面及与当前图片匹配的取景 sidecar。"""
from __future__ import annotations

import json
import os
import threading
import uuid
from functools import lru_cache
from pathlib import Path

from filelock import FileLock

from . import body_parts, jav_poster_crop
from .face_detect import FaceDetector, FaceModelUnavailable, decode, main_face
from .jav_cover_fetch import Unavailable, is_javdb_image

FRONT_START = 0.468
MIN_FACE_Y, MAX_FACE_Y = 0.05, 0.60
FACE_ALGORITHM_VERSION = 'cover-face-v4'
PROMOTIONAL_ASPECTS = (4 / 3, 2 ** .5)
#: 正封框找不到书脊时的两种结果：标准封套比例按先验切（`ratio`），其余比例整幅显示（`none`）。
NO_SPINE = (jav_poster_crop.RATIO, jav_poster_crop.NONE)
_INSTALL_LOCK = threading.RLock()


def has_javdb_source(path: Path) -> bool:
    """封面旁的来源证据是否指向只作印证的 JavDB 转存图。

    按设置「没有别的封面时用 JavDB 带水印的图」（#531）装上的那张记着 `watermarked`，它就是封面，不算在内。
    """
    try:
        evidence = json.loads(Path(path).with_suffix('.scraping.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return False
    return (isinstance(evidence, dict) and evidence.get('watermarked') is not True
            and is_javdb_image(evidence.get('source_url'), evidence.get('source')))


@lru_cache(maxsize=1)
def _default_detector() -> FaceDetector:
    return FaceDetector(allow_download=False)


def metadata_snapshots(root: Path, code: str) -> list[tuple[str, dict]]:
    """当前番号已保存的来源快照；字段仍由各自的来源契约解释。"""
    found = []
    for path in sorted(Path(root).glob(code + '-*.json')):
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if isinstance(payload, dict):
            found.append((payload.get('source') or path.stem[len(code) + 1:], payload))
    return found


def _dominant_left_face(image, largest, faces, *, code, title):
    """没有可辨书脊、左侧主脸明显大于右侧拼图时，保留整幅宣传画面。"""
    height, width = image.shape[:2]
    if not (jav_poster_crop.SLEEVE_RATIO_MIN <= width / height < jav_poster_crop.SLEEVE_RATIO_MAX):
        return False
    spine = 1 - jav_poster_crop.PANEL_ASPECT * height / width
    if largest is None or largest.cx >= spine or largest.score < .8 or largest.width < .075 or largest.height < .12:
        return False
    front = main_face([face for face in faces if face.cx >= spine])
    if front and largest.width * largest.height < 2 * front.width * front.height:
        return False
    box = jav_poster_crop.front_panel_box(width, height, lambda: jav_poster_crop.column_gradient(image), code, title)
    return box['method'] in NO_SPINE


def _promotional_canvas(image, *, code, title):
    """4:3 与纸张比例的画布没有可辨书脊时保留整幅。"""
    height, width = image.shape[:2]
    if (min(abs(width / height - ratio) for ratio in PROMOTIONAL_ASPECTS) >= .015
            or not jav_poster_crop.crops_to_portrait(code, title)):
        return False
    box = jav_poster_crop.front_panel_box(width, height, lambda: jav_poster_crop.column_gradient(image), code, title)
    return box['method'] in NO_SPINE


def _full_picture_face(faces):
    """宣传大封允许明显占据主体的闭眼或侧脸，微弱的大框仍由强脸优先。"""
    strong = main_face(faces)
    if strong is None:
        return None
    largest = max(faces, key=lambda face: face.area)
    return largest if largest.score >= .7 and largest.area >= 4 * strong.area else strong


def _full_cover(image, largest, portraits, *, code: str, title: str, verdict: str, whole: bool) -> bool:
    """这张封面按整幅画面找主脸吗。

    有 DMM 比对结论或正封取景已判成整幅时照它；否则看主脸是否跨过书脊、左侧是否有更显著的脸、
    是不是宣传画布，再用正封判据复核一次：判不出折痕、只能居中切的不算整幅。
    """
    height, width = image.shape[:2]
    if whole or verdict:
        return whole or verdict == jav_poster_crop.POSTER
    full_cover = jav_poster_crop.face_crosses_spine(width, height, {
        'cx': largest.cx, 'w': largest.width, 'h': largest.height,
        'score': largest.score} if largest else None) or _dominant_left_face(
            image, largest, portraits, code=code, title=title) or _promotional_canvas(image, code=code, title=title)
    if not full_cover:
        return False
    panel = jav_poster_crop.front_panel_box(width, height, lambda: jav_poster_crop.column_gradient(image), code, title)
    return panel['method'] != jav_poster_crop.CENTER


def _subject_record(image, parts, best) -> dict:
    """整幅画面上比主脸还大的部位：记成 `subject` 供卡片取景，没有更大的记 None 表示查过了。"""
    found = body_parts.main_subject(parts.detect(image), best.width * best.height if best else 0.0)
    return {'subject': {'cx': found.cx, 'cy': found.cy, 'w': found.w, 'h': found.h, 'kind': found.kind,
                        'score': found.score} if found else None}


def face_record(image, detector, *, code: str, title: str = '', verdict: str = '', whole: bool = False,
                parts=None) -> dict | None:
    """已解码的封面 → 页面取景记录；无法解码时不生成记录。

    脸框宽高与源图尺寸 `px` 也记下，形状与头像边车（`avatar_face.face_record_of`）
    一致：卡片取景只用脸心，换头像要按脸宽在封面上框出一块方图
    （`avatar_cover_face.face_square`），而 `px` 对不上当前这张图时那一块不作数。

    `verdict` 是 DMM 竖版图的比对结论（`jav_poster_crop.portrait_match`）：证实是封套就按封套
    找正封上的脸，证实不是就按整幅画面找，不再靠脸的位置与画布比例去猜版式。`whole` 是正封取景
    已判成整幅显示（`crop_record` 给出 `none`）：主脸在整幅画面里找，不再只看右侧正封那一块。

    `parts` 是部位检测器（`body_parts.PartDetector`）。整幅画面上比主脸还大的部位记成 `subject`，
    卡片按它取景（`web_state._cover_focus`）；没有更大的记 `None`，表示查过了。`face` 不动：
    换头像按脸框在封面上截方图，不能把臀部当成脸。
    """
    if image is None or not getattr(image, "size", 0):
        return None
    height, width = image.shape[:2]
    ratio = width / height if height else 0
    faces = detector.detect(image)
    portraits = [face for face in faces if MIN_FACE_Y <= face.cy <= MAX_FACE_Y]
    full_cover = _full_cover(image, main_face(portraits), portraits, code=code, title=title,
                             verdict=verdict, whole=whole)
    if (not full_cover and (verdict == jav_poster_crop.SLEEVE or jav_poster_crop.crops_to_portrait(code, title))
            and (jav_poster_crop.SLEEVE_RATIO_MIN <= ratio < jav_poster_crop.SLEEVE_RATIO_MAX
                 or (jav_poster_crop.is_wide_sleeve_label(code, title)
                     and jav_poster_crop.WIDE_SLEEVE_RATIO_MIN <= ratio < jav_poster_crop.WIDE_SLEEVE_RATIO_MAX))):
        faces = [face for face in faces if face.cx >= FRONT_START]
    low, high = (0.0, 1.0) if full_cover or jav_poster_crop.is_scene_cover(code, title) else (MIN_FACE_Y, MAX_FACE_Y)
    faces = [face for face in faces if low <= face.cy <= high]
    best = _full_picture_face(faces) if full_cover else main_face(faces)
    still = full_cover or jav_poster_crop.is_scene_cover(code, title)
    subject = _subject_record(image, parts, best) if still and parts is not None else {}
    return {"version": FACE_ALGORITHM_VERSION, "ratio": round(ratio, 3), "px": [int(width), int(height)],
            **({'layout': 'still'} if still else {}), "face": (
        {"cx": best.cx, "cy": best.cy, "w": best.width, "h": best.height,
         "score": best.score} if best else None), **subject}


def text_across_of(image):
    """`crop_record` 的 `text_across`：数切线上横跨的横排文字。本机没有文字检测模型时是 None。"""
    if image is None or not getattr(image, "size", 0):
        return None
    from . import spine_label
    reader = spine_label.default_reader()
    return None if reader is None else (lambda cut: reader.text_across(image, cut))


def text_across_file(path: Path):
    """同 `text_across_of`，但用到时才读原图，同一切点只量一次：重算整个目录时不留解码后的图。"""
    seen: dict[int, int] = {}

    def across(cut: int) -> int:
        if cut not in seen:
            import cv2

            measure = text_across_of(cv2.imread(str(path)))
            seen[cut] = measure(cut) if measure is not None else 0
        return seen[cut]

    return across


#: 竖版正封至少要有横图这么高的这个比例才装：页面大图位按高铺满，比横图矮就是降了清晰度。
FRONT_MIN_HEIGHT_RATIO = 0.95


def _portrait_verdict(image, portrait: bytes | None):
    """DMM 竖版图与横图的比对结果，加上值得装成竖版正封的那张图的尺寸。"""
    if not portrait or image is None:
        return None, None
    try:
        decoded = decode(portrait)
    except (ImportError, ValueError):
        return None, None
    match = jav_poster_crop.portrait_match(image, decoded)
    if match is None or match.verdict != jav_poster_crop.POSTER:
        return match, None
    front_h, front_w = decoded.shape[:2]
    if front_h < image.shape[0] * FRONT_MIN_HEIGHT_RATIO or front_w >= front_h:
        return match, None
    return match, (int(front_w), int(front_h))


def spine_box(image, code: str, title: str = '', match=None, reader=None) -> tuple[int, int] | None:
    """封套横图书脊上印的番号框（`spine_label`）；不是封套比例、认不出或模型取不到是 None。

    竖版图证明是独立海报的不找：那不是封套。锚点是 DMM 竖版图的左缘，没有就是标准正封位置。
    """
    if image is None or not getattr(image, "size", 0) or not code:
        return None
    if match is not None and match.verdict != jav_poster_crop.SLEEVE:
        return None
    height, width = image.shape[:2]
    if not (jav_poster_crop.SLEEVE_RATIO_MIN <= width / height < jav_poster_crop.WIDE_SLEEVE_RATIO_MAX):
        return None
    if match is None and not jav_poster_crop.crops_to_portrait(code, title):
        return None
    from . import spine_label
    active = reader if reader is not None else spine_label.default_reader()
    if active is None:
        return None
    anchor = match.x0 if match is not None else round(width - jav_poster_crop.PANEL_ASPECT * height)
    return active.code_box(image, code, anchor)


#: 每个 sidecar 的修改时间与读出的内容（只留记着书脊番号框的）：一批装几百张时不必每张都重读整个目录。
_SIDECAR_CACHE: dict[Path, tuple[int, dict | None]] = {}
_TEMPLATES_LOCK = threading.Lock()


def cover_templates(directory: Path) -> dict:
    """封面目录里按书脊番号定了切点的封套学到的模板（`jav_poster_crop.learn_templates`）。

    每次都按当前目录重学，只重读修改时间变了的 sidecar。
    """
    suffix = jav_poster_crop.SIDECAR_SUFFIX
    records = []
    with _TEMPLATES_LOCK:
        for side in Path(directory).glob(f"*{suffix}"):
            try:
                stamp = side.stat().st_mtime_ns
            except OSError:
                continue
            cached = _SIDECAR_CACHE.get(side)
            if cached is None or cached[0] != stamp:
                try:
                    record = json.loads(side.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    record = None
                cached = (stamp, record if isinstance(record, dict) and "spine" in record else None)
                _SIDECAR_CACHE[side] = cached
            if cached[1] is not None:
                records.append((side.name[:-len(suffix)], cached[1]))
    return jav_poster_crop.learn_templates(records)


def needs_whole_face(code: str, title: str, poster: dict | None, face: dict | None) -> bool:
    """正封取景判成整幅显示，人脸却还是按封套只在右侧正封里找的：要在整幅画面里重找。

    两边各判各的：人脸按脸的位置与画布比例猜版式，取景按书脊、竖版图与文字。取景判成整幅时，
    卡片按主脸横向取景，主脸只在右半边就等于又切回了原来那一块。
    """
    return bool(poster and face is not None and (poster.get('box') or {}).get('method') == jav_poster_crop.NONE
                and face.get('layout') != 'still' and jav_poster_crop.crops_to_portrait(code, title))


def _sidecars(code: str, payload: bytes, size: tuple[int, int], detector=None, evidence=None,
              portrait: bytes | None = None, templates=None) -> dict[str, bytes]:
    title = str((evidence or {}).get('title') or '')
    image = None
    try:
        image = decode(payload)
    except ImportError:
        pass
    match, front = _portrait_verdict(image, portrait)
    # 注入了人脸检测器的（测试、脚本）自己决定要不要部位检测；装封面的正常路径用本机已有的模型。
    parts = body_parts.default_detector() if detector is None else None
    try:
        active = detector if detector is not None else _default_detector()
        face = face_record(image, active, code=code, title=title, verdict=match.verdict if match else '', parts=parts)
    except (FaceModelUnavailable, ImportError):
        face = None
    poster = jav_poster_crop.crop_record(
        code, size[0], size[1],
        (lambda: jav_poster_crop.column_gradient(image)) if image is not None else None,
        title=title, face=(face or {}).get('face'), layout=(face or {}).get('layout', ''),
        portrait=match, front=front, spine=spine_box(image, code, title, match), templates=templates,
        text_across=text_across_of(image),
    )
    if (match is None and face is None and min(abs(size[0] / size[1] - ratio) for ratio in PROMOTIONAL_ASPECTS) < .015
            and poster['box']['method'] in NO_SPINE):
        face = {'px': list(size), 'layout': 'still', 'face': None}
        poster = jav_poster_crop.crop_record(code, *size, title=title, layout='still')
    elif face is not None and needs_whole_face(code, title, poster, face):
        face = face_record(image, active, code=code, title=title, whole=True, parts=parts)
    records = {jav_poster_crop.SIDECAR_SUFFIX: poster}
    if face is not None:
        records[".face.json"] = face
    prepared = {suffix: json.dumps(record, ensure_ascii=False).encode("utf-8")
                for suffix, record in records.items()}
    if front is not None:
        prepared[FRONT] = portrait
    return prepared


#: `_sidecars` 结果里竖版正封那一项的键。它不是封面同目录的后缀，落在 `jav_poster_crop.front_path`。
FRONT = "front"


def cover_group(target: Path) -> list[Path]:
    """一张封面连同它的边车与竖版正封：安装、撤回、换图时一起处理的整组文件。"""
    target = Path(target)
    return [target, *(target.with_suffix(suffix) for suffix in (
        ".face.json", jav_poster_crop.SIDECAR_SUFFIX, ".scraping.json")), jav_poster_crop.front_path(target)]


def _group_member(target: Path, key: str) -> Path:
    return jav_poster_crop.front_path(target) if key == FRONT else target.with_suffix(key)


#: 编辑资料里换上的封面在 `.scraping.json` 的来源（ADR-0165）。
USER_COVER_SOURCE = "user:manual"


class UserCoverKept(Unavailable):
    """这张封面是用户换上的，自动来源不替换。"""


def is_user_cover(target: Path) -> bool:
    """本机这张封面是不是用户在编辑资料里换上的。"""
    try:
        evidence = json.loads(Path(target).with_suffix('.scraping.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return False
    return isinstance(evidence, dict) and evidence.get('source') == USER_COVER_SOURCE


def install_cover(target: Path, code: str, payload: bytes, size: tuple[int, int], *,
                  evidence: dict | None = None, detector=None, portrait: bytes | None = None) -> None:
    """准备完成后安装整组文件；失败时还原旧组，避免图片与取景跨版本。

    `portrait` 是同一部作品的 DMM 竖版图（`jav_cover_fetch.dmm_portrait`）：用来判定横图是不是
    封套，判定为另外设计的竖版海报且不比横图矮时，一起装成竖版正封。组里没有新竖版正封时，
    旧的那张随旧封面一起撤掉。

    用户换上的封面只有用户自己能换（ADR-0165）：调用方各自先比过本机那张，这里是最后一道。
    """
    if is_user_cover(target) and (evidence or {}).get('source') != USER_COVER_SOURCE:
        raise UserCoverKept('errors.coverArtwork.userCoverKept')
    if (evidence and evidence.get('watermarked') is not True
            and is_javdb_image(evidence.get('source_url'), evidence.get('source'))):
        raise Unavailable('errors.communityCatalog.noUnwatermarked')
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    prepared = _sidecars(code, payload, size, detector, evidence, portrait, cover_templates(target.parent))
    if evidence is not None:
        prepared[".scraping.json"] = json.dumps(evidence, ensure_ascii=False).encode("utf-8")
    token = uuid.uuid4().hex
    managed = cover_group(target)
    staged: dict[Path, Path] = {}
    backups: dict[Path, Path] = {}
    try:
        image_temp = target.with_name(f".{target.name}.{token}.tmp")
        image_temp.write_bytes(payload)
        staged[target] = image_temp
        for key, data in prepared.items():
            member = _group_member(target, key)
            member.parent.mkdir(parents=True, exist_ok=True)
            temporary = member.with_name(f".{member.name}.{token}.tmp")
            temporary.write_bytes(data)
            staged[member] = temporary
        with _INSTALL_LOCK, FileLock(
                str(target.parent / ".cover-install.lock"), thread_local=False):
            try:
                for current in managed:
                    if current.exists():
                        backup = current.with_name(f".{current.name}.{token}.bak")
                        os.replace(current, backup)
                        backups[current] = backup
                for current, temporary in staged.items():
                    os.replace(temporary, current)
            except Exception:
                for current in managed:
                    current.unlink(missing_ok=True)
                for current, backup in backups.items():
                    os.replace(backup, current)
                raise
            for backup in backups.values():
                backup.unlink(missing_ok=True)
    finally:
        for temporary in staged.values():
            temporary.unlink(missing_ok=True)
