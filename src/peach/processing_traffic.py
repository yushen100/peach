"""馆藏任务的逐目录流量读数、连接分账与预估。"""
from __future__ import annotations

import math
import re
import threading
import time
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import PureWindowsPath

from . import interface_text
from .media_sources import CLOUD_LOCATIONS, cost_for

#: 资料来源那几行的显示名（ADR-0159），与媒体库行的库名并列。
METADATA_LABEL = 'labels.processingTraffic.metadata'
#: 传输量取不到实际读数的原因；`unobserved` 里存的是这些 code。
MOUNT_UNOBSERVED = 'labels.processingTraffic.mountUnobserved'
MEDIA_READ_MISSING = 'labels.processingTraffic.mediaReadMissing'

CURRENT = ContextVar('peach_processing_traffic', default=None)
ROUTE = ContextVar('peach_processing_traffic_route', default='metadata')
MIB = 1024 ** 2
STATISTICS = re.compile(r'Statistics:\s*(\d+) bytes read')


def _key(path):
    return str(PureWindowsPath(path)).rstrip('\\').casefold()


def record_download(size):
    from .task_resources import record_download as task_download
    task_download(size)
    meter = CURRENT.get()
    if meter is not None:
        meter.add(ROUTE.get(), size)


def unobserved(reason):
    from .task_resources import unobserved_network
    unobserved_network(reason)
    meter = CURRENT.get()
    if meter is not None:
        meter.mark(ROUTE.get(), reason)


def record_media_read(path, size):
    meter = CURRENT.get()
    if meter is not None:
        meter.media_read(str(path), size)


def media_statistics(path, stderr, *, kind=None, successful=False):
    """FFmpeg 的输入读取量；挂载缓存和预读由挂载工具管理。"""
    meter = CURRENT.get()
    if meter is None:
        return
    from .smb_media import source_identity
    path = source_identity(path)
    text = stderr.decode('utf-8', 'replace') if isinstance(stderr, bytes) else str(stderr or '')
    sizes = STATISTICS.findall(text)
    if sizes:
        amount = sum(map(int, sizes))
        record_media_read(path, amount)
        if kind and successful:
            meter.observe_media(path, kind, amount)
    else:
        meter.media_read(str(path), 0, missing=True)


@contextmanager
def download_route(metered):
    token = ROUTE.set('metadata-proxy' if metered else 'metadata-direct')
    try:
        yield
    finally:
        ROUTE.reset(token)


class ProcessingTraffic:
    def __init__(self, config, db_path, stage, asset_ids=None, *, resume_state=None, inventory_rows=(),
                 allow_metered=False):
        self.config, self.db_path, self.stage, self.asset_ids = config, db_path, stage, asset_ids
        self.lock = threading.RLock()
        self.publish = lambda: None
        self.published_at = 0
        self.owner = threading.get_ident()
        self.rows = {}
        from .clouddrive_proxy import connections
        routes = connections(config)
        for location, roots in config.locations.items():
            for root in roots:
                remote = any(value.get('transport') == 'smb' and _key(value['root']) == _key(root)
                             for value in config.storage_roots.values())
                network = remote or location in CLOUD_LOCATIONS or cost_for(location, root, config) == 'metered'
                connection = routes.get(_key(root), 'unknown') if network and not remote else 'direct'
                self.rows[f'{location}:{_key(root)}'] = dict(
                    label=config.library_names.get(root) or root, root=root, location=location,
                    metered=connection == 'proxy', connection=connection, network=network,
                    used_bytes=0, remaining_min=0, remaining_max=0, unobserved=[])
        for key, metered in [('metadata', True), ('metadata-proxy', True), ('metadata-direct', False)]:
            self.rows[key] = dict(label=interface_text.text(f'server:{METADATA_LABEL}'), label_code=METADATA_LABEL,
                root='', location='metadata', metered=metered,
                connection='proxy' if metered else 'direct',
                network=True, used_bytes=0, remaining_min=0, remaining_max=0, unobserved=[])
        previous = (resume_state or {}).get('traffic') or {}
        for old in previous.get('sources', []):
            if old.get('key') in self.rows:
                self.rows[old['key']].update(used_bytes=old.get('used_bytes', 0),
                                           unobserved=list(old.get('unobserved', [])))
            elif old.get('key') and old.get('used_bytes'):
                self.rows[old['key']] = {key: old[key] for key in
                    ('label', 'root', 'location', 'metered', 'network', 'used_bytes', 'unobserved')}
                self.rows[old['key']].update(remaining_min=0, remaining_max=0)
        self.unknown_files = stage in ('all', 'scan') and asset_ids is None
        from .processing_traffic_plan import TrafficPlan
        self.plan = TrafficPlan(config, stage, self._media_key, allow_metered=allow_metered)
        from .library_processing import source_budget
        self.plan.budget_bytes = source_budget(db_path).bytes
        from .processing_storage import ProcessingStorage
        self.storage = ProcessingStorage(config)
        self.plan.completed.update(previous.get('completed_work', []))
        self.active_sample = None
        self.refresh_plan()
        self.seed_inventory(inventory_rows)

    def seed_inventory(self, rows):
        if rows:
            known = {(row['location'], _key(row['path'])) for row in self.plan.assets}
            self.plan.extend(row for row in rows if (row['location'], _key(row['path'])) not in known)

    @contextmanager
    def bind(self):
        token = CURRENT.set(self)
        try:
            yield self
        finally:
            CURRENT.reset(token)

    def _media_key(self, path, location=None):
        candidates = []
        for key, row in self.rows.items():
            if not row['root'] or location and row['location'] != location:
                continue
            roots = self.config.locations.get(row['location'], ())
            if row['root'] not in roots:
                continue
            index = roots.index(row['root'])
            mounts = self.config.mounts.get(row['location'], ())
            for prefix in [row['root'], *([mounts[index]] if index < len(mounts) else [])]:
                declared, actual = _key(prefix), _key(path)
                if actual == declared or actual.startswith(declared + '\\'):
                    candidates.append((len(declared), key))
        return max(candidates)[1] if candidates else None

    def refresh_plan(self, rows=None):
        """账本统计不访问媒体目录；保护开启的目录不预估自动探测。"""
        if rows is None:
            from .processing_traffic_plan import ledger_rows
            roots = tuple(root for values in self.config.locations.values() for root in values)
            rows = ledger_rows(self.db_path, self.asset_ids, library_roots=roots)
        with self.lock:
            self.plan.refresh(rows)
            for row in self.rows.values():
                if row['root'] and row['network']:
                    self._reason(row, MOUNT_UNOBSERVED)

    def start_metadata(self, code):
        from .library_processing import _provider_code
        token = 'metadata:' + str(_provider_code(code))
        with self.lock:
            profile = self.plan.profiles.get(token)
            self.active_sample = dict(profile=profile, blocked=set(),
                before={key: row['used_bytes'] for key, row in self.rows.items()}) if profile else None

    def finish_work(self, stage, code=None, *, successful=True):
        with self.lock:
            if stage == 'metadata' and self.active_sample:
                sample, self.active_sample = self.active_sample, None
                if successful:
                    for key, before in sample['before'].items():
                        if not self.rows[key]['root'] and key not in sample['blocked']:
                            self.plan.history.observe(sample['profile'] + ':' + key, self.rows[key]['used_bytes'] - before)
                    self.plan.calibrate()
                    self.plan.history.save()
            self.plan.finish(stage, code)

    def observe_media(self, path, kind, amount):
        key = self._media_key(path)
        with self.lock:
            if key and self.rows[key]['network']:
                self.plan.history.observe(key + ':' + kind, amount)
                self.plan.history.save()

    def prepare_metadata(self, prepared):
        with self.lock:
            self.plan.prepare_metadata(prepared)

    @staticmethod
    def _reason(row, reason):
        if reason not in row['unobserved']:
            row['unobserved'].append(reason)

    def mark(self, key, reason):
        with self.lock:
            self._reason(self.rows[key], reason)
            if self.active_sample is not None:
                self.active_sample['blocked'].add(key)

    def add(self, key, size):
        if not isinstance(size, (int, float)) or not math.isfinite(size) or size <= 0:
            return
        with self.lock:
            row = self.rows[key]
            if not row['network']:
                return
            row['used_bytes'] += int(size)
            if threading.get_ident() != self.owner or time.monotonic() - self.published_at < 0.5:
                return
            self.published_at = time.monotonic()
        self.publish()

    def media_read(self, path, size, *, missing=False):
        key = self._media_key(path)
        if key is not None:
            if self.rows[key]['network']:
                self.mark(key, MOUNT_UNOBSERVED)
            if missing:
                self.mark(key, MEDIA_READ_MISSING)
            self.add(key, size)

    def snapshot(self, *, finished=False):
        with self.lock:
            self.plan.history.save(force=finished)
            sources = []
            remaining = self.plan.remaining(self.rows)
            for key, row in self.rows.items():
                amount = 0 if finished else remaining[key]
                if not row['root'] and not row['used_bytes'] and not amount and not row['unobserved']:
                    continue
                source = {**row, 'unobserved': list(row['unobserved'])}
                sources.append(dict(key=key, **source, workload=self.plan.workload(key),
                    estimated_bytes=row['used_bytes'] + amount,
                    estimated_min_bytes=row['used_bytes'],
                    estimated_max_bytes=row['used_bytes'] + amount))
            result = dict(sources=sources, workload=self.plan.workload(), unknown_files=self.unknown_files and not finished,
                          partial=any(row['unobserved'] for row in sources),
                          completed_work=sorted(self.plan.completed))
            result['disk'] = self.storage.snapshot(self.plan, self.rows, finished=finished)
            for field in ('used_bytes', 'estimated_bytes', 'estimated_min_bytes', 'estimated_max_bytes'):
                result[field] = sum(row[field] for row in sources)
                result['metered_' + field] = sum(row[field] for row in sources if row['metered'])
                result['unknown_route_' + field] = sum(row[field] for row in sources
                    if row.get('connection', 'unknown') in ('system', 'unknown'))
            return result
