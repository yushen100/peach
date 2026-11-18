"""撤回 amane 0.28 修复涉及的旧来源缓存，保留正文和人工结论。"""
from __future__ import annotations

import json
from pathlib import Path
import re

from . import artifact_rules, upgrade_rules
from .fsutil import atomic_write_text
from .review_csv import read_rows, write_rows

RULE = 'amane-source-cache-1'
_DATE_CODE = re.compile(r'\d{6}_\d{2,3}', re.ASCII)


def invalidated(path: Path) -> bool:
    """封面取景同样跳过本规则已撤下、正文仍保留的来源快照。"""
    try:
        return Path(str(path) + '.rule').read_text(encoding='utf-8') == f'invalid:{RULE}'
    except FileNotFoundError:
        return False


def _affected(source: str, code: str, payload: dict) -> bool:
    if source == 'freejavbt':
        return _DATE_CODE.fullmatch(code) is not None
    if source != 'makers' or payload.get('poster_url'):
        return False
    raw = payload.get('raw')
    urls = raw.get('thumb_urls', []) if isinstance(raw, dict) else payload.get('cover_urls', [])
    return isinstance(urls, list) and any(isinstance(url, str) and url.endswith('_2.jpg') for url in urls)


def collect(connection, sources: Path, misses: Path, candidates: Path) -> dict:
    """只选日期号错配族和缺少可推导海报的快照，记录可撤回的原始条目。"""
    snapshots = []
    affected = {'freejavbt': set(), 'makers': set()}
    for path in sources.glob('*.json'):
        code, _, source = path.stem.rpartition('-')
        if source not in {'freejavbt', 'makers'} or path.is_symlink():
            continue
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
            current = artifact_rules.current(path, str(upgrade_rules.PROVIDER_EVIDENCE))
        except (OSError, ValueError):
            continue
        if isinstance(payload, dict) and current and _affected(source, code, payload):
            snapshots.append({'path': str(path), 'fingerprint': artifact_rules.fingerprint(path)})
            affected[source].add(code)
    try:
        remembered = json.loads(misses.read_text(encoding='utf-8'))
    except FileNotFoundError:
        remembered = {}
    entries = remembered.get('misses', {})
    free = entries.get('freejavbt', {})
    affected['freejavbt'].update(code for code in free if _DATE_CODE.fullmatch(code))
    stale_candidates = []
    for row in read_rows(candidates, missing_ok=True):
        if not _DATE_CODE.fullmatch(row.get('code', '')):
            continue
        choices = json.loads(row.get('candidates_json') or '[]')
        stale = [entry for entry in choices if entry.get('source') == 'freejavbt']
        if stale:
            affected['freejavbt'].add(row['code'])
            stale_candidates.append({'row': row, 'candidates': stale})
    codes = affected['freejavbt'] | affected['makers']
    removed_misses = {source: {code: stamp for code, stamp in entries.get(source, {}).items()
                               if code in affected.get(source, codes)}
                      for source in ('freejavbt', 'makers', 'cover')}
    approved = {row[0] for row in connection.execute(
        "SELECT item_key FROM review_decision WHERE category='metadata_fields' AND status='approved'")}
    withdrawn = [item for item in stale_candidates if item['row'].get('item_key') not in approved]
    assets = [row[0] for row in connection.execute(
        "SELECT id,code FROM asset WHERE medium='video' AND disposal IS NULL") if row[1] in codes]
    return {'snapshots': snapshots, 'misses': removed_misses, 'withdrawn': withdrawn,
            'asset_ids': sorted(assets), 'codes': sorted(codes)}


def apply(connection, plan: dict, misses: Path, candidates: Path, fields) -> None:
    """按已存回执重放，后来取得的新快照、新答复和人工批准继续保留。"""
    for item in plan['snapshots']:
        path = Path(item['path'])
        if path.is_file() and artifact_rules.fingerprint(path) == item['fingerprint']:
            artifact_rules.remember(path, f'invalid:{RULE}')
    if any(plan['misses'].values()):
        try:
            remembered = json.loads(misses.read_text(encoding='utf-8'))
        except FileNotFoundError:
            remembered = {}
        for source, entries in plan['misses'].items():
            current = remembered.get('misses', {}).get(source, {})
            for code, stamp in entries.items():
                if current.get(code) == stamp:
                    current.pop(code)
        if remembered:
            atomic_write_text(misses, json.dumps(remembered, ensure_ascii=False))
    if not plan['withdrawn']:
        return
    approved = {row[0] for row in connection.execute(
        "SELECT item_key FROM review_decision WHERE category='metadata_fields' AND status='approved'")}
    stale = {item['row']['item_key']: item['candidates'] for item in plan['withdrawn']}
    kept = []
    for row in read_rows(candidates, missing_ok=True):
        if row['item_key'] not in stale or row['item_key'] in approved:
            kept.append(row)
            continue
        choices = json.loads(row.get('candidates_json') or '[]')
        remaining = [entry for entry in choices if entry not in stale[row['item_key']]]
        if remaining:
            kept.append({**row, 'candidates_json': json.dumps(remaining, ensure_ascii=False),
                         'source_count': len(remaining)})
    write_rows(candidates, fields, kept, atomic=True)
