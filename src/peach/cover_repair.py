# -*- coding: utf-8 -*-
"""已装封面的版式补修：老用户升级后，封面按当前判据重判一遍。

新装、重新取的封面在 `cover_artwork.install_cover` 里当场按当前判据处理；装在这之前的不会自己变：
取景算法版本没进位（进位会让所有旧边车作废，页面先退回默认切法），封面也多半已算定稿、后台不再重取。
这里补三件事，脚本（`judge_cover_portraits.py`、`poster_crop_boxes.py`、`detect_cover_faces.py`）与
「设置 › 修复与迁移」的封面一项（`CoverRepair`）共用：

1. **补判版式**（联网）：可能判错的番号封面取 DMM 竖版图判封套还是独立海报，配信宣传图换成尺寸相近的
   DVD 封套。没有来源记录的（2026-09 之前装的不记来源）按番号查 DMM 目录拿地址。
2. **重算切点**（本机）：按书脊番号、同前缀模板、比例与文字横跨重算，边车没记当前规则（`CROP_RULES`）的都算。
3. **补找主脸与主体**（本机）：取景判成整幅的在整张图里找脸，整幅画面补查比主脸还大的身体部位。

手工框、用户自己换的封面一律不动；改动前整组文件备份。
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import shutil
import threading
import time
from collections import Counter
from contextlib import nullcontext
from pathlib import Path

from . import jav_poster_crop as crop
from .coded_text import Said
from .cover_artwork import cover_group, install_cover, is_user_cover
from .images import measure_image_file, measure_image_size
from .jav_cover_fetch import (AWS_MODERN, PACKAGE_PREFERENCE, HostLimitedTransport, Unavailable, candidate_for,
                              dmm_evidence, dmm_portrait, dmm_portrait_url, official_image, package_cid, probe_size)
from .scraping_access import SourceTransport

LOGGER = logging.getLogger(__name__)
TASK_KEY = 'cover-artwork-repair'
RECEIPT_PREFIX = 'cover-artwork-'


def read(path: Path) -> dict:
    try:
        value = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


# ---------------------------------------------------------------- 1. 补判版式（联网）

def doubtful(record: dict, face: dict, size: tuple[int, int], title: str) -> bool:
    """原有判据可能判错的封面：比例不标准、没找到折痕、判成整幅画面，或标题带 VR。

    标准比例上找到折痕的封套抽查几百张都切对了，默认不为它们取图。
    """
    ratio = size[0] / size[1]
    method = (record.get('box') or {}).get('method')
    return (not crop.RATIO_FALLBACK_MIN <= ratio <= crop.RATIO_FALLBACK_MAX
            or method != crop.FOLD
            or 'still' in (record.get('layout'), face.get('layout'))
            or crop.is_vr_title(title))


def eligible(path: Path, *, every: bool, named: bool) -> dict | None:
    """这张封面要不要补判；要的话给出补判要用的来源证据（没有来源记录是 `{}`）。"""
    evidence = read(path.with_suffix('.scraping.json'))
    url = str(evidence.get('source_url') or '')
    size = measure_image_file(path)
    record = crop.read_sidecar(path) or {}
    # 有来源地址却不是 DMM 横图：是别家的图，不碰。没有来源地址的留到补判时按番号查。
    if not size or (url and not dmm_portrait_url(url)) or is_user_cover(path) or crop.is_manual(record):
        return None
    if not url and not crop.crops_to_portrait(path.stem, str(record.get('title') or '')):
        return None  # 没有来源记录、又不是番号封面：按番号查不到东西
    if named:
        return evidence
    if size[0] / size[1] < crop.SLEEVE_RATIO_MIN:
        return None  # 本机装的已经是竖版正封，没有横图要判
    if 'portrait' in record and crop.is_current(record, *size):
        return None
    face = read(path.with_suffix('.face.json'))
    return evidence if every or doubtful(record, face, size, str(evidence.get('title') or record.get('title') or '')) else None


def package_sleeve(evidence: dict, size: tuple[int, int], transport):
    """配信版来源的封面，DVD 封套不明显更糊（面积不到一半）时取回封套：(图片字节, 尺寸, 新来源证据)；否则 None。

    SOD 系的配信版横图是另画的双栏宣传图，装封面的择优现在偏向封套（`PACKAGE_PREFERENCE`），
    装在这之前的按同一判据补换。
    """
    found = re.search(r'/digital/video/([^/]+)/', str(evidence.get('source_url') or ''))
    cid = package_cid(found.group(1)) if found else ''
    if not cid:
        return None
    candidate = candidate_for(AWS_MODERN.format(kind='mono/movie', cid=cid))
    try:
        width, height = probe_size(transport, candidate)
    except (Unavailable, OSError, ValueError):
        return None
    if width * height * PACKAGE_PREFERENCE < size[0] * size[1]:
        return None
    data = official_image(transport, candidate.url)
    if data is None or measure_image_size(data) != (width, height):
        return None
    digest = hashlib.sha256(data).hexdigest()
    return data, (width, height), {**evidence, 'source': candidate.source, 'source_url': candidate.url,
                                   'width': width, 'height': height, 'raw_sha256': digest,
                                   'installed_sha256': digest, 'checked_at': time.time()}


def dmm_listing_url(transport, code: str) -> str:
    """按番号查 DMM 目录得到的配信版横图地址；查不到是空串。"""
    for candidate in dmm_evidence(transport, code).candidates:
        if dmm_portrait_url(candidate.url) and '/digital/video/' in candidate.url:
            return candidate.url
    return ''


def back_up(path: Path, backup: Path) -> None:
    """整组文件（图、边车、来源记录、竖版正封）改动前拷一份；已经拷过的不覆盖，留最早那份。"""
    for member in cover_group(path):
        saved = Path(backup) / member.relative_to(path.parent)
        if member.exists() and not saved.exists():
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(member, saved)


def judge(path: Path, evidence: dict, transport, backup: Path) -> dict:
    """补判一张：取 DMM 竖版图（与尺寸相近的 DVD 封套）重装这一组。原有整组先备份到 `backup`。"""
    size = measure_image_file(path)
    payload = path.read_bytes()
    source = str(evidence.get('source_url') or '') or dmm_listing_url(transport, path.stem)
    if not source:
        return {'code': path.stem, 'status': 'no_portrait'}
    upgraded = package_sleeve({**evidence, 'source_url': source}, size, transport)
    if upgraded is not None:
        payload, size, evidence = upgraded
        source = str(evidence['source_url'])
    portrait = dmm_portrait(transport, source)
    if portrait is None and upgraded is None:
        return {'code': path.stem, 'status': 'no_portrait'}
    back_up(path, backup)
    # 没有来源记录、也没换图的不写来源记录：空的 `{}` 会让人以为来源查过了。
    install_cover(path, path.stem, payload, size, evidence=evidence or None, portrait=portrait)
    record = crop.read_sidecar(path) or {}
    found = crop.portrait_of(record)
    return {'code': path.stem, 'status': 'judged', 'verdict': found.verdict if found else None,
            'score': found.score if found else None, 'method': (record.get('box') or {}).get('method'),
            'front': record.get('front'), 'package': upgraded is not None}


# ---------------------------------------------------------------- 2. 重算切点（本机）

def crop_stale(path: Path, size: tuple[int, int] | None) -> bool:
    """边车不是按当前规则算的：缺失、版本或尺寸不符，或没记 `CROP_RULES`。手工框不算。"""
    record = crop.read_sidecar(path)
    if crop.is_manual(record):
        return False
    return (size is None or not crop.is_current(record, *size)
            or (record or {}).get('rules') != crop.CROP_RULES)


def crop_inputs(path: Path, width: int, height: int) -> dict:
    """一张封面重算取景要用的全部输入；竖版图比对与竖版正封描述的是这张图本身，原样沿用。

    书脊番号在这一遍认（本机有模型时），模板要等全部认完才学得出来，第二遍才套。
    """
    from . import cover_artwork

    saved = crop.read_sidecar(path) or {}
    same_image = saved.get("px") == [width, height]
    face = read(path.with_suffix('.face.json'))
    portrait = crop.portrait_of(saved) if same_image else None
    front = crop.front_size(saved) if same_image and crop.front_path(path).is_file() else None
    title = saved.get('title', '')
    spine = across = None
    if crop.crops_to_portrait(path.stem, title) or portrait is not None:
        import cv2

        spine = cover_artwork.spine_box(cv2.imread(str(path)), path.stem, title, portrait)
        # 一批几千张，不能把解码后的图都留在内存里：用到时才重读原图。
        across = cover_artwork.text_across_file(path)
    current_face = face.get('px') == [width, height]
    return dict(code=path.stem, width=width, height=height, gradient_source=crop.file_gradient(path), title=title,
                face=face.get('face') if current_face and portrait is None else None,
                layout=face.get('layout', '') if current_face and portrait is None else '',
                portrait=portrait, front=front, spine=spine, text_across=across)


def recrop(directory: Path, todo: list[tuple[Path, tuple[int, int]]], *, write: bool = True,
           pace=None, backup: Path | None = None) -> list[tuple[Path, dict, dict | None]]:
    """按当前判据重算 `todo` 的取景边车：(路径, 新边车, 旧边车)。

    两遍：第一遍认书脊番号，第二遍套模板。模板从这一批按书脊番号定了切点的，加上这一批没重算、
    边车里已记着番号框的学。`pace(n)` 每算完一张报一次；`backup` 给了就在改写前备份整组。
    """
    inputs = {}
    for index, (path, (width, height)) in enumerate(todo, 1):
        inputs[path] = crop_inputs(path, width, height)
        if pace is not None:
            pace(index, first=True)
    redone = {path.stem for path in inputs}
    suffix = crop.SIDECAR_SUFFIX
    untouched = [(side.name[:-len(suffix)], crop.read_sidecar(side.with_name(side.name[:-len(suffix)] + ".jpg")))
                 for side in Path(directory).glob(f"*{suffix}") if side.name[:-len(suffix)] not in redone]
    templates = crop.learn_templates(
        [*((path.stem, crop.crop_record(**work)) for path, work in inputs.items()),
         *((code, record) for code, record in untouched if record)])
    done = []
    for index, (path, _size) in enumerate(todo, 1):
        old = crop.read_sidecar(path)
        record = crop.crop_record(**inputs[path], templates=templates)
        if write:
            if backup is not None and (old or {}).get('box') != record['box']:
                back_up(path, backup)
            crop.write_sidecar(path, record)
        done.append((path, record, old))
        if pace is not None:
            pace(index, first=False)
    return done


# ---------------------------------------------------------------- 3. 补找主脸与主体（本机）

def face_stale(path: Path, *, parts: bool) -> bool:
    """人脸记录要重算：缺失、版本或尺寸不符；取景改判整幅、脸却只在正封里找；有部位模型时整幅画面还没查过部位。"""
    from .cover_artwork import FACE_ALGORITHM_VERSION, needs_whole_face

    record = read(path.with_suffix('.face.json'))
    if not record:
        return True
    poster = crop.read_sidecar(path) or {}
    return not (record.get('version') == FACE_ALGORITHM_VERSION
                and record.get('px') == list(measure_image_file(path) or ())
                and not needs_whole_face(path.stem, poster.get('title', ''), poster, record)
                and not (parts and record.get('layout') == 'still' and 'subject' not in record))


def face_of(path: Path, detector, parts=None) -> dict | None:
    """一张封面的人脸记录；`parts` 是部位检测器，整幅画面上比主脸大的部位记成 `subject`。"""
    import cv2

    from .cover_artwork import face_record, needs_whole_face

    image = cv2.imread(str(path))
    poster = crop.read_sidecar(path) or {}
    title = poster.get('title', '')
    # 竖版图比对的结论描述的是这张图本身：装封面时按它找脸，这里也一样。
    match = crop.portrait_of(poster) if image is not None and poster.get('px') == [image.shape[1], image.shape[0]] else None
    found = face_record(image, detector, code=path.stem, title=title, verdict=match.verdict if match else '',
                        parts=parts)
    # 正封取景已判成整幅显示：主脸在整幅画面里找。
    if needs_whole_face(path.stem, title, poster, found):
        found = face_record(image, detector, code=path.stem, title=title, whole=True, parts=parts)
    return found


# ---------------------------------------------------------------- 修复与迁移里的封面一项

class CoverRepair:
    """「修复与迁移」里的封面补修：升级后服务起来，估算出有待处理的封面就在后台按上面三步做完。

    只改程序算出来的取景、主脸与来源查得到的封面，手工框与用户换的封面不碰，改前整组备份，所以按
    自动修复处理，不等确认。几千张封面要逐张认字、可能还要联网补判，几十分钟到一两个小时：开服务后
    先等 `START_DELAY` 秒避开启动时的高负载，每张之前过一次任务中心的 `checkpoint`，暂停与低占用档
    都在那里生效；中途停了下次启动接着做。查过 DMM 却没有竖版图或比不出结论的记进 `checked`（按图片
    尺寸）：素人系本来就没有，不该每次都算待处理。
    """

    #: 服务起来后等这么久再估算与开工。
    START_DELAY = 300.0

    def __init__(self, cover_root: Path, state_root: Path, database, secrets_root: Path, runs=None,
                 available=lambda: True):
        self.cover_root = Path(cover_root)
        self.state_root = Path(state_root)
        self.database = database
        self.secrets_root = Path(secrets_root)
        self.runs = runs
        #: 本机能不能写（`UpgradeRepairs.available`）：只读副本不动封面。
        self.available = available
        self._lock = threading.Lock()
        self._state: dict = {'phase': 'idle'}
        self.worker: threading.Thread | None = None
        self._stopping = threading.Event()
        self._service: threading.Thread | None = None

    def start(self, delay: float | None = None) -> None:
        """后台服务的启动：等一会儿，估算，有待处理的就开工。服务装配时随其他后台服务一起调。"""
        if self._service is not None and self._service.is_alive():
            return
        self._stopping.clear()
        wait = self.START_DELAY if delay is None else delay
        self._service = threading.Thread(target=self._automatic, args=(wait,), name='cover-artwork-service',
                                         daemon=True)
        self._service.start()

    def stop(self) -> None:
        """服务关停：不再开工；在做的那一轮到下一张封面前停下，下次启动接着做。"""
        self._stopping.set()

    def _automatic(self, wait: float) -> None:
        if self._stopping.wait(wait) or not self.available():
            return
        self.status()
        worker = self.worker
        if worker is not None:
            worker.join()
        if not self._stopping.is_set() and self.status().get('covers'):
            self.begin()

    @property
    def checked_path(self) -> Path:
        return self.state_root / 'cover-artwork-checked.json'

    def _checked(self) -> dict:
        return read(self.checked_path)

    def plan(self) -> dict[str, list]:
        """待处理的三份名单：补判、重算切点、补人脸。"""
        checked = self._checked()
        judge_list, crop_list, face_list = [], [], []
        for path in sorted(self.cover_root.glob('*.jpg')):
            if is_user_cover(path):
                continue
            size = measure_image_file(path)
            evidence = eligible(path, every=False, named=False)
            if evidence is not None and checked.get(path.stem) != list(size or ()):
                judge_list.append((path, evidence))
            if crop_stale(path, size):
                crop_list.append((path, size))
            if face_stale(path, parts=True):
                face_list.append(path)
        return {'judge': judge_list, 'crop': crop_list, 'face': face_list}

    def status(self) -> dict:
        """当前读数；还没估算过就在后台开始估算。`phase`：idle / estimating / ready / running / failed。"""
        with self._lock:
            if self._state['phase'] == 'idle' and self.cover_root.is_dir():
                self._state = {'phase': 'estimating'}
                self.worker = threading.Thread(target=self._estimate, name='cover-artwork-estimate', daemon=True)
                self.worker.start()
            return dict(self._state)

    def _estimate(self) -> None:
        try:
            plan = self.plan()
            covers = {path.stem for path, _ in plan['judge']} | {path.stem for path, _ in plan['crop']} | {
                path.stem for path in plan['face']}
            state = {'phase': 'ready', 'covers': len(covers)}
        except Exception as error:  # noqa: BLE001 — 估算失败只影响这一项的读数
            LOGGER.exception('Cover repair estimate failed')
            state = {'phase': 'failed', 'error': str(error)}
        with self._lock:
            self._state = state

    def begin(self) -> bool:
        """估算好了就开工；还在估算或已经在做时什么都不做，返回 False。"""
        with self._lock:
            if self._state['phase'] != 'ready':
                return False
            self._state = {'phase': 'running', 'done': 0, 'total': 0}
            self.worker = threading.Thread(target=self._run, name='cover-artwork-repair', daemon=True)
            self.worker.start()
            return True

    def _task(self, call):
        """任务中心记录写不进去不影响补修本身：只记日志。"""
        if self.runs is None:
            return None
        try:
            return call()
        except Exception:  # noqa: BLE001
            LOGGER.warning('Failed to record the cover repair in the task center', exc_info=True)
            return None

    def _run(self) -> None:
        from .task_control import Cancelled, bind, checkpoint

        counts: Counter = Counter()
        status, error = 'succeeded', None
        backup = self.state_root / f'cover-artwork-{time.strftime("%Y%m%d-%H%M%S")}'
        run = self._task(lambda: self.runs.start(TASK_KEY, trigger='scheduled', mutex_key=TASK_KEY,
                                                 label=Said('labels.coverRepair.runLabel')))
        run_id = getattr(run, 'id', None)
        try:
            with bind(self.runs, run_id) if self.runs is not None else nullcontext():
                counts = self._repair(backup, run_id, checkpoint)
        except Cancelled:
            status, error = 'cancelled', Said('labels.coverRepair.serviceStopped' if self._stopping.is_set()
                                              else 'labels.coverRepair.stoppedByUser')
        except Exception as exc:  # noqa: BLE001 — 改了多少照实记进历史
            LOGGER.exception('Cover repair interrupted')
            status, error = 'failed', str(exc)
        self._task(lambda: self.runs.finish(run_id, status, error='' if status == 'cancelled' else error or '',
                                            summary=dict(counts)))
        result = {**dict(counts), **({'originals': str(backup)} if backup.is_dir() else {}),
                  **({'error': str(error)} if error else {})}
        try:
            with self.database.write_transaction() as connection:
                connection.execute('INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)',
                                   (f'{RECEIPT_PREFIX}{time.time_ns()}', str(time.time()), json.dumps(result)))
        except Exception:  # noqa: BLE001
            LOGGER.exception('Failed to record the cover repair in the repair history')
        LOGGER.info('Cover repair: %s%s', dict(counts), f', interrupted: {error}' if error else '')
        # 做完重新估算：中断了的，剩下的照常等用户再点一次；做完了的，这一项改报上一次改了多少。
        with self._lock:
            self._state = {'phase': 'idle'}
        self.status()

    def _repair(self, backup: Path, run_id, checkpoint) -> Counter:
        from . import body_parts, spine_label
        from .face_detect import FaceDetector, FaceModelUnavailable
        from .fsutil import atomic_write_text
        from .task_control import Cancelled

        # 后台补修只用随包或数据目录里已有的模型，不联网取（与头像人脸的后台补测一样）。取不到的那一步
        # 退回原有判据或跳过，不拦着其余几步：书脊番号没有就按原有判据切，部位没有就只按脸，人脸检测器
        # 没有就这一轮不补脸，那几张仍算待处理，等模型有了（安装包随附、补判脚本取过）再补。
        spine_label.default_reader(allow_download=False)
        parts = body_parts.default_detector(allow_download=False)
        try:
            detector = FaceDetector(allow_download=False)
        except (FaceModelUnavailable, ImportError):
            LOGGER.info('Cover repair: no local face model, faces are left for a later run')
            detector = None
        plan = self.plan()
        def faces(listed) -> int:
            """进度里补脸那一步的张数；没有人脸检测器时这一轮不补脸，不计进总数。"""
            return len(listed) if detector is not None else 0

        total = len(plan['judge']) + 2 * len(plan['crop']) + faces(plan['face'])
        counts: Counter = Counter()
        done = 0

        def step() -> None:
            nonlocal done
            if self._stopping.is_set():
                raise Cancelled()
            checkpoint('scan')
            done += 1
            with self._lock:
                self._state.update(done=done, total=total)
            self._task(lambda: self.runs.progress(run_id, current=done, total=total))  # 自带节流

        checked = self._checked()
        attempted: set[str] = set()
        transport = HostLimitedTransport(SourceTransport(self.secrets_root), 1.0)

        def judge_all(items) -> None:
            for path, evidence in items:
                step()
                attempted.add(path.stem)
                try:
                    result = judge(path, evidence, transport, backup)
                except Exception:  # noqa: BLE001 — 一部取不到不影响其余几部，下次再点重试
                    LOGGER.warning('Cover repair could not judge %s', path.stem, exc_info=True)
                    transport.renew()
                    counts['failed'] += 1
                    continue
                counts['judged'] += result['status'] == 'judged'
                counts['sleeves'] += bool(result.get('package'))
                # 没有竖版图，或竖版图太小比不出结论（老片只有 147×200）：判完仍够补判条件，记下这张图的尺寸，
                # 不然每次估算都把它算成待处理。图换了尺寸就再查。
                if eligible(path, every=False, named=False) is not None:
                    checked[path.stem] = list(measure_image_file(path) or ())
                    atomic_write_text(self.checked_path, json.dumps(checked, ensure_ascii=False))

        try:
            judge_all(plan['judge'])
            # 补判重装过的那几张已按当前规则算过，不再算一遍。
            todo = [(path, measure_image_file(path)) for path, _ in plan['crop']]
            todo = [(path, size) for path, size in todo if size and crop_stale(path, size)]

            def pace(index: int, first: bool) -> None:
                step()

            for path, record, old in recrop(self.cover_root, todo, pace=pace, backup=backup):
                counts['recropped'] += (old or {}).get('box') != record['box']
            # 重算后改判整幅的封面这时才够补判、要在整张图里重找脸：重新出一次名单，同一轮做完。
            again = self.plan()
            more = [(path, evidence) for path, evidence in again['judge'] if path.stem not in attempted]
            total += len(more) + max(0, faces(again['face']) - faces(plan['face']))
            judge_all(more)
        finally:
            transport.close()
        for path in (self.plan()['face'] if detector is not None else ()):
            step()
            if not path.is_file() or not face_stale(path, parts=parts is not None):
                continue
            found = face_of(path, detector, parts)
            if found is None:
                continue
            back_up(path, backup)
            atomic_write_text(path.with_suffix('.face.json'), json.dumps(found, ensure_ascii=False))
            counts['faces'] += 1
        return counts
