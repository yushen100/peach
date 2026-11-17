"""独立同意的公共资料贡献；每周一份候选快照，与口味研究授权无关。"""
from __future__ import annotations

from datetime import datetime, timezone
import gzip
import json
import threading
import time
import uuid

from filelock import FileLock

from . import library_sharing, remote_reporting
from .fsutil import atomic_write_text
from .research_participation import instance as valid_instance
from .seed_contributions import FILENAME, MAX_BYTES, MAX_RAW_BYTES, SCHEMA, collect, parse_snapshot
from .user_messages import UserValueError


class Service:
    def __init__(self, config, contract):
        self.config, self.contract = config, contract
        self.root = config.directory('state')
        self.choice_path = self.root / 'seed-sharing.json'
        self.receipt_path = self.root / 'seed-sharing-attempt.json'
        self._stop, self._wake = threading.Event(), threading.Event()
        self._thread = None
        self._preview = None
        self._mutex = threading.RLock()

    def lock(self):
        self.root.mkdir(parents=True, exist_ok=True)
        return FileLock(str(self.choice_path) + '.lock', timeout=5)

    def choice(self):
        value = remote_reporting._read(self.choice_path)
        return value if (value.get('enabled') is True and value.get('consent_schema') == SCHEMA
                         and all(valid_instance(value.get(key)) for key in ('instance', 'revision'))) else {}

    def snapshot(self):
        from .seed_catalog import load
        pack = load()
        names = {'pending': 0, 'adopted': 0, 'withdrawn': 0}
        for path in (self.root / 'seed-name-proposals').glob('*.json'):
            state = 'adopted' if path.stem in pack.facts else 'withdrawn' if path.stem in pack.withdrawals else 'pending'
            names[state] += 1
        return {'enabled': bool(self.choice()), 'available': bool(library_sharing.target()), 'schema': SCHEMA,
                'name_candidates': names, 'seed_revision': pack.revision,
                'last_attempt': {key: value for key, value in remote_reporting._read(self.receipt_path).items()
                                 if key in {'status', 'period', 'raw_bytes', 'compressed_bytes', 'reason', 'snapshot_id'}}}

    def preview(self):
        payload = collect(self.contract, self.config).model_dump(mode='json', exclude_none=True)
        raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()
        if len(raw) > MAX_RAW_BYTES or len(gzip.compress(raw, mtime=0)) > MAX_BYTES:
            raise UserValueError('errors.seedSharing.tooLarge')
        token = uuid.uuid4().hex
        with self._mutex:
            self._preview = token, time.monotonic() + 600
        return {'data': payload, 'bytes': len(raw), 'token': token, 'schema': SCHEMA}

    def save(self, body):
        if type(body.get('enabled')) is not bool:
            raise UserValueError('errors.seedSharing.invalidChoice')
        with self._mutex:
            if body['enabled'] and (not self._preview or self._preview[0] != body.get('preview_token')
                    or time.monotonic() > self._preview[1] or body.get('consent') is not True
                    or body.get('schema') != SCHEMA):
                raise UserValueError('errors.seedSharing.previewFirst')
            with self.lock():
                instance = remote_reporting._read(self.choice_path).get('instance')
                atomic_write_text(self.choice_path, json.dumps({'enabled': body['enabled'], 'consent_schema': SCHEMA,
                    'revision': uuid.uuid4().hex, 'instance': instance if valid_instance(instance) else uuid.uuid4().hex}))
                attempt = remote_reporting._read(self.receipt_path)
                if attempt.get('status') == 'queued':
                    atomic_write_text(self.receipt_path, json.dumps({**attempt,
                        'status': 'unknown' if attempt.get('attempted') else 'blocked', 'reason': 'consent'}))
            self._preview = None
        self._wake.set()
        return self.snapshot()

    def _gate(self, identity, envelope):
        if self._stop.is_set() or [item.type for item in envelope.items] != ['event', 'attachment']:
            return False
        attachment = envelope.items[1]
        if attachment.headers.get('filename') != FILENAME:
            return False
        import io
        data = attachment.payload.get_bytes()
        if len(data) > MAX_BYTES:
            return False
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(data)) as zipped:
                raw = zipped.read(MAX_RAW_BYTES + 1)
            payload = parse_snapshot(raw)
            period = datetime.now(timezone.utc).strftime('%G-W%V')
            if len(raw) > MAX_RAW_BYTES or not payload.claims or payload.period != period:
                return False
        except (ValueError, OSError, EOFError):
            return False
        with self.lock():
            current = self.choice()
            saved = remote_reporting._read(self.receipt_path)
            if (current.get('revision') != identity['revision'] or saved.get('snapshot_id') != identity['snapshot_id']
                    or saved.get('period') != period or saved.get('attempted') or saved.get('status') != 'queued'):
                return False
            atomic_write_text(self.receipt_path, json.dumps({**saved, 'attempted': True}))
        event = envelope.items[0].get_event()
        keep = {key: value for key, value in event.items() if key in {'event_id', 'timestamp', 'platform'}}
        metadata = remote_reporting.event_metadata('research')
        metadata['tags'].update(purpose='public-metadata-contributions', contribution_instance=current['instance'],
                                snapshot_id=identity['snapshot_id'], schema=str(SCHEMA))
        event.clear()
        event.update(**keep, **metadata, message='Peach public metadata contributions', level='info')
        envelope.headers = {key: value for key, value in envelope.headers.items() if key in {'event_id', 'sent_at'}}
        return True

    def _delivery(self, identity, result):
        with self.lock():
            saved = remote_reporting._read(self.receipt_path)
            if (self.choice().get('revision') != identity['revision'] or saved.get('snapshot_id') != identity['snapshot_id']
                    or saved.get('status') not in {'queued', 'unknown'}):
                return
            status = result.get('status', 'unknown')
            if status not in {'accepted', 'failed', 'unknown', 'blocked'}:
                return
            atomic_write_text(self.receipt_path, json.dumps({**saved, 'status': status,
                'reason': result.get('reason') if result.get('reason') in
                    {'network', 'http_status', 'rate_limit', 'queue_full', 'consent', 'disabled', 'unknown'} else 'unknown'}))

    def attempt(self):
        current, target = self.choice(), library_sharing.target()
        if not current or not target or self._stop.is_set() or remote_reporting._disabled:
            return
        period = datetime.now(timezone.utc).strftime('%G-W%V')
        with self.lock():
            previous = remote_reporting._read(self.receipt_path)
            if previous.get('period') == period and (previous.get('attempted') or previous.get('status') == 'queued'):
                return
        identity = {'revision': current['revision'], 'snapshot_id': uuid.uuid4().hex}
        value = {**identity, 'period': period, 'attempted': False}
        try:
            snapshot = collect(self.contract, self.config)
            raw = snapshot.model_dump_json(exclude_none=True).encode()
            wire = gzip.compress(raw, mtime=0)
            if len(raw) > MAX_RAW_BYTES or len(wire) > MAX_BYTES:
                raise ValueError('contribution too large')
            value.update(raw_bytes=len(raw), compressed_bytes=len(wire), status='queued' if snapshot.claims else 'waiting-data')
        except (ValueError, OSError):
            with self.lock():
                saved = remote_reporting._read(self.receipt_path)
                if (self.choice().get('revision') == current['revision'] and
                        not (saved.get('period') == period and (saved.get('attempted') or saved.get('status') == 'queued'))):
                    atomic_write_text(self.receipt_path, json.dumps({**value, 'status': 'failed', 'reason': 'collection'}))
            return
        with self.lock():
            previous = remote_reporting._read(self.receipt_path)
            if (self.choice().get('revision') != current['revision'] or
                    previous.get('period') == period and (previous.get('attempted') or previous.get('status') == 'queued')):
                return
            atomic_write_text(self.receipt_path, json.dumps(value))
        if not snapshot.claims:
            return
        client = None
        try:
            from sentry_sdk.attachments import Attachment
            client = remote_reporting._new_client(target,
                envelope_gate=lambda envelope: self._gate(identity, envelope),
                delivery_callback=lambda result: self._delivery(identity, result))
            client.capture_event({'message': 'Peach public metadata contributions', 'level': 'info'},
                hint={'attachments': [Attachment(bytes=wire, filename=FILENAME, content_type='application/gzip')]})
            client.flush(timeout=5)
        except Exception:
            # 贡献数据与错误原文不转交技术诊断。
            self._delivery(identity, {'status': 'unknown', 'reason': 'unknown'})
        finally:
            if client is not None:
                client.close(timeout=0)
            self._delivery(identity, {'status': 'unknown', 'reason': 'unknown'})

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        def run():
            while not self._stop.is_set():
                try:
                    self.attempt()
                except Exception:
                    pass
                self._wake.wait(3600)
                self._wake.clear()
        self._thread = threading.Thread(target=run, name='PeachSeedSharing', daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        self._wake.set()
        if self._thread:
            self._thread.join(timeout=6)
