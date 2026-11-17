"""投影既有来源快照、明确未收录和封面取景，不上传原始快照或图片。"""
from datetime import datetime, timezone
import hashlib
import json

from .metadata_policy import SOURCE_SPECS
from .seed_contributions import public_url


def read(path):
    if not path.is_file():
        return {}
    if path.stat().st_size > 8 * 1024 * 1024:
        raise ValueError('cached source record is too large')
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError('cached source record is not an object')
    return value


def stamp(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat()


def _metadata_claims(root, codes):
    snapshots = {}
    # 目录只枚举一次，避免每个番号都重新扫描全部来源快照。
    for path in root.glob('*.json'):
        for source in SOURCE_SPECS:
            suffix = '-' + source
            if path.stem.endswith(suffix) and path.stem[:-len(suffix)] in codes:
                snapshots.setdefault(path.stem[:-len(suffix)], []).append((source, path))
                break
    for code in sorted(codes):
        for source, path in sorted(snapshots.get(code, ()), key=lambda row: row[0]):
            payload = read(path)
            if not payload:
                continue
            try:
                url = public_url(str(payload.get('source_url') or ''))
            except ValueError:
                continue
            common = dict(subject=code, source=source, origin='source', evidence_url=url,
                          observed_at=stamp(path.stat().st_mtime))
            yield {**common, 'field': 'source-id', 'value': url}
            yield {**common, 'field': 'source-result', 'value': 'success'}


def _cover_claims(cover_root, codes):
    from . import jav_poster_crop
    for code in sorted(codes):
        image = cover_root / f'{code}.jpg'
        evidence = read(image.with_suffix('.scraping.json'))
        try:
            url = public_url(str(evidence.get('source_url') or ''))
        except ValueError:
            continue
        source = str(evidence.get('source') or 'observed')
        common = dict(subject=code, source=source, origin='manual' if source.startswith('user:') else 'source',
                      evidence_url=url)
        yield {**common, 'field': 'cover', 'value': url}
        crop = jav_poster_crop.read_sidecar(image)
        if not image.is_file() or not crop or not jav_poster_crop.is_manual(crop):
            continue
        width, height = crop.get('px') or (0, 0)
        box = crop.get('box') or {}
        with image.open('rb') as handle:
            digest = hashlib.file_digest(handle, 'sha256').hexdigest()
        yield {**common, 'origin': 'manual', 'field': 'cover-crop', 'value': {
            'image_sha256': digest, 'width': width, 'height': height,
            'box': [box.get(key, 0) for key in ('x0', 'y0', 'x1', 'y1')]}}


def cached_claims(config, contract, codes):
    yield from _metadata_claims(config.directory('sources') / 'library-metadata', codes)
    yield from _cover_claims(contract.cover_root, codes)
    misses = read(config.directory('state') / 'library-metadata-misses.json')
    for source, entries in misses.get('misses', {}).items():
        if source not in SOURCE_SPECS:
            continue
        for code, checked in entries.items():
            if code in codes:
                yield dict(subject=code, field='source-result', value='not-found', source=source,
                           origin='source', observed_at=stamp(checked))
    # 只发送已有最近一次来源检查的有限状态与耗时，不带网络出口、凭据、错误原文。
    from .scraping_access import source_checks
    for source in SOURCE_SPECS:
        check = source_checks(config.directory('secrets'), source).get('metadata')
        if not check or not check.get('checked_at'):
            continue
        status = ('success' if check.get('ok') else 'not-found' if check.get('kind') == 'not_found'
                  else 'timeout' if check.get('reason') == 'timeout' else 'rate-limit'
                  if check.get('reason') == 'rate_limited' else 'error')
        yield dict(subject='source:' + source, field='source-result', value=status, origin='observed', source=source,
                   observed_at=stamp(check['checked_at']),
                   elapsed_ms=round(check['elapsed_s'] * 1000) if 'elapsed_s' in check else None)
