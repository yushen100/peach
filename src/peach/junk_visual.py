"""九宫格的逐帧推广证据与本机派生缓存；识别仅在后台任务执行。"""
from __future__ import annotations

from contextlib import closing
import json
from pathlib import Path
import re
import sqlite3
import tempfile
import time
from urllib.parse import urlsplit

from PIL import Image

from . import artifact_rules
from .image_ocr import ImageReader, OcrUnavailable
from .junk_words import VISUAL_PROMO_BRAND, VISUAL_PROMO_TERM
from .platform import translate_ledger_path

# 识别模型或判断规则变化时递增，使旧派生结果重新计算。
VERSION = 3
FRAME_COUNT = 9
SMALL_BYTES = 120 * 1024**2
SHORT_SECONDS = 240


def cache_path(database) -> Path:
    """派生证据与实例账本绑定，各工作副本单独生成。"""
    return Path(database.db_path).with_suffix('.junk-visual.sqlite3')


def version(database) -> tuple:
    try:
        stat = cache_path(database).stat()
        return stat.st_mtime_ns, stat.st_size
    except FileNotFoundError:
        return 0, 0


def _asset_identity(row) -> list:
    return [row['id'], row['location'], row['path'], row['name'], row['size'],
            row['duration'], row['snapshot_path']]


def _source(row) -> dict:
    return {'asset': _asset_identity(row),
            'snapshot': artifact_rules.fingerprint(translate_ledger_path(row['snapshot_path']))}


def current(row, entry) -> bool:
    if not entry or entry.get('version') != VERSION or entry.get('source', {}).get('asset') != _asset_identity(row):
        return False
    try:
        return entry['source'] == _source(row)
    except OSError:
        return False


def read(database, asset_id=None) -> dict[int, dict]:
    path = cache_path(database)
    if not path.is_file():
        return {}
    query = 'SELECT asset_id,payload FROM evidence'
    values = ()
    if asset_id is not None:
        query += ' WHERE asset_id=?'
        values = (asset_id,)
    else:
        query += " WHERE verdict IN ('candidate','intro_only')"
    try:
        with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as connection:
            results = {}
            for asset_id, payload in connection.execute(query, values):
                entry = json.loads(payload)
                if (not isinstance(entry, dict) or not isinstance(entry.get('source'), dict)
                        or entry.get('verdict') not in ('candidate', 'intro_only', 'no_candidate',
                                                      'unmeasured', 'incomplete')):
                    raise ValueError('Invalid saved visual evidence')
                results[asset_id] = entry
            return results
    except (sqlite3.Error, ValueError) as error:
        raise OcrUnavailable(f'Saved visual evidence unavailable: {error}') from error


def _save(database, asset_id, entry):
    path = cache_path(database)
    with closing(sqlite3.connect(path)) as connection, connection:
        connection.execute('CREATE TABLE IF NOT EXISTS evidence('
                           'asset_id INTEGER PRIMARY KEY,verdict TEXT NOT NULL,payload TEXT NOT NULL)')
        connection.execute('INSERT INTO evidence(asset_id,verdict,payload) VALUES(?,?,?) '
                           'ON CONFLICT(asset_id) DO UPDATE SET verdict=excluded.verdict,payload=excluded.payload',
                           (asset_id, entry['verdict'], json.dumps(entry, ensure_ascii=False)))


def frame_evidence(index: int, text: str, qr_count: int, qr_values) -> dict:
    """保留原识别文字，按紧凑文本匹配推广词；二维码地址只提取主机，不发起访问。"""
    from .junk import PROMO_DOMAIN
    compact = re.sub(r'\s+', '', text).casefold()
    domains = {match.group(0).casefold() for match in PROMO_DOMAIN.finditer(compact)}
    qr_domains = set()
    for value in qr_values:
        try:
            host = urlsplit(value).hostname
        except ValueError:
            host = None
        if host:
            qr_domains.add(host.casefold())
    terms = sorted({match.group(0) for match in VISUAL_PROMO_TERM.finditer(compact)})
    return {'index': index, 'text': text, 'terms': terms, 'qr_count': qr_count,
            'domains': sorted(domains | qr_domains),
            'brand': bool(VISUAL_PROMO_BRAND.search(compact))}


def _frame_statistics(frames):
    """推广线索、明确推广词及独立支持证据的时间分布。"""
    hits = [frame['index'] for frame in frames
            if frame['terms'] or frame['qr_count'] or frame['domains'] or frame['brand']]
    claims = [frame['index'] for frame in frames if frame['terms']]
    terms = sorted({term for frame in frames for term in frame['terms']})
    supported = any(frame['domains'] or frame['qr_count'] or frame['brand'] for frame in frames)
    return hits, claims, terms, supported


def judge(frames: list[dict], *, size, duration) -> dict:
    """前中后持续推广才形成候选；片头信号与缺少测量分别记录。"""
    hits, claims, terms, supported = _frame_statistics(frames)
    summary = {'matched_frames': len(hits), 'claim_frames': len(claims), 'sample_frames': len(frames),
               'terms': terms, 'duration': duration, 'size': size, 'verdict': 'no_candidate'}
    if len(frames) != FRAME_COUNT:
        summary['verdict'] = 'incomplete'
        return summary
    if not size or size <= 0 or not duration or duration <= 0:
        summary['verdict'] = 'unmeasured'
        return summary
    if supported and claims and max(claims) <= 2:
        summary['verdict'] = 'intro_only'
        return summary
    small_short = size < SMALL_BYTES and duration < SHORT_SECONDS
    required_hits = 6 if small_short else 8
    required_claims = 2 if small_short else 6
    if (supported and len(hits) >= required_hits and len(claims) >= required_claims
            and len(terms) >= 2 and FRAME_COUNT - 1 in hits
            and any(index >= FRAME_COUNT // 2 for index in claims)
            and sum(index >= FRAME_COUNT // 2 for index in hits) >= 3):
        summary['verdict'] = 'candidate'
    return summary


def adjust_score(row, entry, score):
    """有效画面证据修正原有分数；视觉候选保留人工复核档。"""
    from .junk import JUNK_REVIEW_SCORE, _Reason
    if not current(row, entry):
        return score, 0, []
    if entry['verdict'] == 'intro_only':
        return min(score, JUNK_REVIEW_SCORE - 1), 0, []
    if entry['verdict'] == 'candidate':
        reason = _Reason('visualPromotion', matched=entry['matched_frames'], total=entry['sample_frames'],
                         claims=entry['claim_frames'])
        return max(JUNK_REVIEW_SCORE, score + JUNK_REVIEW_SCORE), JUNK_REVIEW_SCORE, [reason]
    return score, 0, []


def preserves_intro(database, row) -> bool:
    """自动处置前重新核对最新片头证据。"""
    if row is None:
        return False
    entry = read(database, row['id']).get(row['id'])
    return current(row, entry) and entry['verdict'] == 'intro_only'


def analyse(database, row, reader: ImageReader, *, checkpoint=lambda: None) -> dict:
    """只读取已缓存的九宫格；完整结果绑定媒体与图像代际后保存。"""
    existing = read(database, row['id']).get(row['id'])
    if current(row, existing):
        return existing
    try:
        import cv2
    except ImportError as error:
        raise OcrUnavailable(error) from error
    source = _source(row)
    detector = cv2.QRCodeDetector()
    try:
        with Image.open(translate_ledger_path(row['snapshot_path'])) as image:
            image.load()
            width, height = image.size
            if width < 3 or height < 3:
                raise OcrUnavailable('Snapshot has no complete 3x3 grid')
            with tempfile.TemporaryDirectory(prefix='peach-junk-visual-') as temporary:
                paths, qr = [], []
                for index in range(FRAME_COUNT):
                    checkpoint()
                    y, x = divmod(index, 3)
                    tile = image.crop((x * width // 3, y * height // 3,
                                       (x + 1) * width // 3, (y + 1) * height // 3)).convert('RGB')
                    tile = tile.resize((tile.width * 2, tile.height * 2))
                    path = Path(temporary) / f'{index}.png'
                    tile.save(path)
                    paths.append(path)
                    pixels = cv2.imread(str(path))
                    value, points, _ = detector.detectAndDecode(pixels)
                    qr.append((int(points is not None), [value] if value else []))
                checkpoint()
                texts = reader.read(paths)
                if len(texts) != FRAME_COUNT:
                    raise OcrUnavailable('OCR result has incomplete frame coverage')
                frames = [frame_evidence(index, text, *qr[index]) for index, text in enumerate(texts)]
    except cv2.error as error:
        raise OcrUnavailable(error) from error
    checkpoint()
    with database.read_connection() as connection:
        fresh = connection.execute('SELECT * FROM asset WHERE id=? AND disposal IS NULL', (row['id'],)).fetchone()
    if fresh is None or source != _source(fresh):
        raise OcrUnavailable('Media or snapshot changed during visual analysis')
    summary = judge(frames, size=row['size'], duration=row['duration'])
    entry = {**summary, 'version': VERSION, 'source': source, 'frames': frames, 'analysed_at': time.time()}
    _save(database, row['id'], entry)
    return entry
