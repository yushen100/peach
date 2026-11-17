"""私有候选归档、独立安装支持统计与显式公共包复核。"""
from collections import defaultdict
from contextlib import closing
from datetime import datetime, timezone
import gzip
import hashlib
import io
from pathlib import Path
import re
import sqlite3
from urllib.parse import urlsplit
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .seed_contributions import MAX_BYTES, MAX_RAW_BYTES, Snapshot, claim_key, parse_snapshot
from .seed_catalog import Fact, Pack, load


class Decision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    key: str = Field(pattern='^[a-f0-9]{64}$')
    action: Literal['approve', 'withdraw']
    reason: str
    evidence_url: str | None = None
    preferred: bool = False

    @model_validator(mode='after')
    def explicit_evidence(self):
        from .seed_contributions import public_text, public_url
        public_text(self.reason)
        if self.action == 'approve':
            if not self.evidence_url:
                raise ValueError('approval requires public evidence')
            public_url(self.evidence_url)
        return self


def import_snapshot(archive, attachment, *, instance, received_at):
    if not re.fullmatch('[a-f0-9]{32}', instance):
        raise ValueError('source event contribution_instance is required')
    when = datetime.fromisoformat(received_at.replace('Z', '+00:00'))
    if when.tzinfo is None:
        raise ValueError('received time requires timezone')
    wire = Path(attachment).read_bytes()
    if len(wire) > MAX_BYTES:
        raise ValueError('attachment too large')
    with gzip.GzipFile(fileobj=io.BytesIO(wire)) as handle:
        raw = handle.read(MAX_RAW_BYTES + 1)
    if len(raw) > MAX_RAW_BYTES:
        raise ValueError('snapshot too large')
    payload = parse_snapshot(raw)
    digest = hashlib.sha256(raw).hexdigest()
    root = Path(archive)
    root.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(root / 'contributions.sqlite3')) as con, con:
        con.execute('CREATE TABLE IF NOT EXISTS snapshot(instance TEXT,period TEXT,received_at TEXT,digest TEXT,payload TEXT,'
                    'PRIMARY KEY(instance,period))')
        con.execute('INSERT INTO snapshot VALUES(?,?,?,?,?) ON CONFLICT(instance,period) DO UPDATE SET '
                    'received_at=excluded.received_at,digest=excluded.digest,payload=excluded.payload '
                    'WHERE (excluded.received_at,excluded.digest)>(snapshot.received_at,snapshot.digest)',
                    (instance, payload.period, when.astimezone(timezone.utc).isoformat(), digest, raw.decode()))
    return {'period': payload.period, 'claims': len(payload.claims)}


def summary(archive):
    path = Path(archive) / 'contributions.sqlite3'
    groups = {}
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as con:
        # 每个安装只取最新周，重复周快照不增加票数；安装数并非人数。
        rows = con.execute('SELECT instance,payload FROM snapshot s WHERE period='
                           '(SELECT max(period) FROM snapshot WHERE instance=s.instance)')
        for instance, payload in rows:
            for claim in Snapshot.model_validate_json(payload).claims:
                # 观察时间与耗时不拆散同一事实，但原始投递保留这些信息。
                normalized = claim.model_copy(update={'observed_at': None, 'elapsed_ms': None})
                key = claim_key(normalized)
                group = groups.setdefault(key, {'claim': normalized.model_dump(mode='json', exclude_none=True),
                    'instances': set(), 'manual_instances': set(), 'sources': set(), 'evidence_urls': set(), 'elapsed_ms': []})
                group['instances'].add(instance)
                if claim.origin == 'manual' and claim.source.startswith('user:'):
                    group['manual_instances'].add(instance)
                group['sources'].add(claim.source)
                if claim.evidence_url:
                    group['evidence_urls'].add(claim.evidence_url)
                if claim.elapsed_ms is not None:
                    group['elapsed_ms'].append(claim.elapsed_ms)
    slots = defaultdict(list)
    result = {}
    for key, group in groups.items():
        claim = group['claim']
        slots[claim['subject'], claim['field'], claim.get('original'), claim.get('language')].append(key)
        result[key] = {'claim': claim, 'supporting_instances': len(group['instances']),
                       'manual_instances': len(group['manual_instances']),
                       'source_domains': sorted({urlsplit(url).hostname for url in group['evidence_urls']}),
                       'evidence_urls': sorted(group['evidence_urls']), 'sources': sorted(group['sources']),
                       'elapsed_ms': group['elapsed_ms'], 'status': 'candidate'}
    for keys in slots.values():
        for key in keys:
            result[key]['conflicts'] = [other for other in keys if result[other]['claim']['value'] != result[key]['claim']['value']]
    return {'format': 1, 'unit': 'installation, not person or independent source', 'candidates': result}


def publish(report, decisions, previous, *, revision):
    """每项采纳必须指明引用与理由；不提供按支持票数自动批准的入口。"""
    old = load(previous)
    if revision <= old.revision:
        raise ValueError('reviewed seed revision must increase')
    facts, withdrawals = dict(old.facts), dict(old.withdrawals)
    for decision in decisions:
        decision = Decision.model_validate(decision).model_dump()
        key, action = decision['key'], decision['action']
        if action == 'withdraw':
            if key not in facts:
                raise ValueError('withdrawal must name an existing fact')
            reason = decision['reason']
            from .seed_contributions import public_text
            withdrawals[key] = public_text(reason)
            del facts[key]
            continue
        if action != 'approve' or key not in report['candidates'] or key in withdrawals:
            raise ValueError('approval must name an available candidate')
        claim = report['candidates'][key]['claim']
        if claim['field'] == 'source-result':
            raise ValueError('network results are observations, not distributable facts')
        fact = Fact(claim=claim, evidence_url=decision['evidence_url'], reason=decision['reason'],
                    preferred=decision.get('preferred', False))
        if fact.preferred:
            for old_key, item in list(facts.items()):
                a, b = item.claim, fact.claim
                if (a.subject, a.field, a.original, a.language) == (b.subject, b.field, b.original, b.language):
                    facts[old_key] = item.model_copy(update={'preferred': False})
        facts[key] = fact
    pack = Pack(format=1, revision=revision, facts=facts, withdrawals=withdrawals)
    from .seed_catalog import _parsed
    return _parsed(pack.model_dump_json().encode())
