"""从本地账本、资料缓存与下载预算规划待执行的流量。"""
from __future__ import annotations

from itertools import islice
import json
import os
import sqlite3
from statistics import median
from contextlib import closing

from .catalog_rules import is_local_extra
from .catalog_vocabulary import PERFORMER_TAG_PREFIX

MIB = 1024 ** 2


def cached_names(directory):
    try:
        with os.scandir(directory) as entries:
            return {entry.name.casefold() for entry in entries}
    except OSError:
        return set()


def ledger_rows(db_path, asset_ids=None, *, library_roots=()):
    query = """SELECT asset.*,
        EXISTS(SELECT 1 FROM asset_entity ae JOIN entity e ON ae.entity_id=e.id
               WHERE ae.asset_id=asset.id AND e.kind='performer') AS performers,
        EXISTS(SELECT 1 FROM asset_tag t WHERE t.asset_id=asset.id AND t.tag NOT LIKE ?) AS tags
        FROM asset WHERE medium='video' AND disposal IS NULL"""
    parameters = [PERFORMER_TAG_PREFIX + '%']
    if asset_ids is not None:
        query += ' AND id IN (SELECT value FROM json_each(?))'
        parameters.append(json.dumps(asset_ids))
    with closing(sqlite3.connect(db_path, timeout=30)) as connection:
        connection.row_factory = sqlite3.Row
        return [dict(row) for row in connection.execute(query, parameters)
                if not is_local_extra(row['name'], row['path'], library_roots=library_roots)]


def typical_size(directory, pattern, fallback):
    """只在本机缓存抽取至多 256 个文件大小，不访问媒体挂载。"""
    sizes = []
    for path in islice(directory.glob(pattern), 256):
        try:
            size = path.stat().st_size
            if size > 0:
                sizes.append(size)
        except OSError:
            pass
    return int(median(sizes)) if sizes else fallback


class TrafficPlan:
    def __init__(self, config, stage, media_key, *, allow_metered=False):
        from .library_processing import _MissCache, _RemoteSession, misses_path
        from .library_processing import MAX_SOURCE_BYTES
        self.config, self.stage, self.media_key = config, stage, media_key
        #: 本趟采集预算里的下载字节上限；`ProcessingTraffic` 按账本设置换掉默认档。
        self.budget_bytes = MAX_SOURCE_BYTES
        self.allow_metered = allow_metered
        self.remote = _RemoteSession(config, None, _MissCache(misses_path(config)), retrying=False)
        self.cover_root = config.directory('generated') / 'covers'
        self.cover_bytes = typical_size(self.cover_root, '*.jpg', MIB // 2)
        self.nfo_bytes = typical_size(config.directory('sources') / 'library-metadata', '*.nfo', 32 * 1024)
        self.units = {}
        self.outside_budget = {}
        self.completed = set()
        self.cover_ready = {}
        self.cover_names = cached_names(self.cover_root)
        self.evidence_names = cached_names(config.directory('sources') / 'library-metadata')
        self.proxy = {}
        from .processing_traffic_history import TrafficHistory
        self.history = TrafficHistory(config)
        self.profiles = {}
        self.baselines = {}
        self.counts = {}

    def _add(self, token, key, amount, *, budgeted=True):
        if amount <= 0 or token in self.completed or token.partition(':')[0] + ':*' in self.completed:
            return
        unit = self.units.setdefault(token, {})
        unit[key] = unit.get(key, 0) + int(amount)
        if not budgeted:
            outside = self.outside_budget.setdefault(token, {})
            outside[key] = outside.get(key, 0) + int(amount)

    def _ready(self, code):
        from .library_processing import cover_settled
        if code not in self.cover_ready:
            self.cover_ready[code] = ((code + '.jpg').casefold() in self.cover_names
                                     and cover_settled(self.cover_root / (code + '.jpg')))
        return self.cover_ready[code]

    def _network(self, source):
        from . import peach_proxy
        from .scraping_access import SOURCES, values_for
        if source not in self.proxy:
            root = self.config.directory('secrets')
            # 不在采集设置里的站（素人链上的认人 Wiki）没有单独的连接方式，同 `SourceTransport` 照 Peach 代理出网。
            if source in SOURCES and values_for(root, source).get('network') == 'direct':
                self.proxy[source] = False
            else:
                try:
                    options = peach_proxy.client_options(root)
                    self.proxy[source] = bool(options.get('proxy') or options.get('trust_env', True))
                except ValueError:
                    self.proxy[source] = True
        return 'metadata-proxy' if self.proxy[source] else 'metadata-direct'

    def refresh(self, rows):
        self.assets = []
        self.units = {}
        self.outside_budget = {}
        self.profiles = {}
        self.baselines = {}
        self.counts = {}
        self.titles = {}
        self.extend(rows)

    def extend(self, rows):
        from .library_processing import _provider_code, _scrapes_as_jav, _missing_fields, preview_readable
        from .catalog_rules import release_code_from_filename
        changed = set()
        for row in rows:
            self.assets.append(row)
            if self.stage == 'previews' and not preview_readable(row, self.config, allow_metered=self.allow_metered):
                continue
            key = self.media_key(row['path'], row['location'])
            if key is None:
                continue
            code = _provider_code(row.get('code')) or release_code_from_filename(row.get('name') or '')
            eligible = bool(code and _scrapes_as_jav(row, code))
            counts = self.counts.setdefault(key, dict(video_files=0, jav_files=0, titles=set()))
            counts['video_files'] += 1
            if eligible:
                counts['jav_files'] += 1
                counts['titles'].add(code)
            path = str(row['path'])
            if self.stage not in ('scan', 'previews'):
                # 无发行番号的创作者文件只检查配套文件，不进入 JAV 下载链。
                if eligible:
                    self._add('local:' + path, key, self.nfo_bytes)
                    if not self._ready(code):
                        self._add('local:' + path, key, self.cover_bytes)
                    title = self.titles.setdefault(code, dict(row=row, missing=set()))
                    if self.stage != 'covers':
                        title['missing'].update(_missing_fields(row))
                    changed.add(code)
            self._media(row, key)
        for code in changed:
            token = 'metadata:' + code
            self.units.pop(token, None)
            self.outside_budget.pop(token, None)
            self.profiles.pop(token, None)
            self.baselines.pop(token, None)
            self._downloads(code, self.titles[code])

    def _media(self, row, key):
        from .library_processing import preview_readable
        from .media_processing_policy import metadata_only
        from .media_sources import cost_for
        from .strm import skip_background_read
        path = str(row['path'])
        if skip_background_read(path):
            return
        size = max(0, row.get('size') if row.get('size') is not None else 9 * 8 * MIB)
        if (self.stage not in ('metadata', 'covers') and row.get('duration') is None
                and cost_for(row['location'], path, self.config) == 'free'):
            self._add('media:' + path, key, min(size, self.history.average(key + ':probe', 8 * MIB)))
        if (self.stage in ('all', 'collect', 'previews')
                and preview_readable(row, self.config, allow_metered=self.allow_metered)
                and not row.get('snapshot_path') and not metadata_only(self.config.directory('state'))):
            self._add('media:' + path, key, min(size, 9 * self.history.average(key + ':frame', 8 * MIB)))

    def _downloads(self, code, title):
        from .library_processing import _studio_evidence
        from .metadata_routes import stage_name
        chain = self.remote._chain(code, *_studio_evidence(title['row']))
        askable = self.remote._askable(chain, code)
        names = [source for source in askable if f'{code}-{source}.json'.casefold() in self.evidence_names]
        cached = {source for source, _, _ in self.remote._cached_evidence(names, code)}
        pending = [source for source in askable if source not in cached]
        token = 'metadata:' + code
        wants_cover = (not self._ready(code) and chain
                       and not self.remote._fresh_miss('cover', code, chain))
        if title['missing']:
            for source in pending:
                # 每站一至两次请求，沿用采集器约 250KB/次的工作量基准。
                self._add('metadata:' + code, self._network(source), 2 * 250 * 1024,
                          budgeted=stage_name(source) not in ('amane', 'amane_official'))
        if wants_cover:
            self._add('metadata:' + code, self._network(chain[0]), self.cover_bytes)
        if token in self.units:
            self.profiles[token] = 'jav:' + ','.join(sorted(pending if title['missing'] else [])) + ':cover=' + str(bool(wants_cover))
            self.baselines[token] = dict(self.units[token])
            self.calibrate([token])

    def calibrate(self, tokens=None):
        for token in self.profiles if tokens is None else tokens:
            profile = self.profiles[token]
            if token not in self.units:
                continue
            for key, baseline in self.baselines[token].items():
                if key not in self.outside_budget.get(token, {}):
                    self.units[token][key] = self.history.average(profile + ':' + key, baseline)

    def prepare_metadata(self, prepared):
        """配套文件读完后，使用任务实际取得的字段和核查范围。"""
        from .library_processing import COLLECTED_FIELDS, _missing_fields, _scrapes_as_jav
        for token in list(self.units):
            if token.startswith('metadata:'):
                self.units.pop(token)
                self.outside_budget.pop(token, None)
                self.profiles.pop(token, None)
                self.baselines.pop(token, None)
        titles = {}
        for row, code, verify, local_fields, *_ in prepared:
            if code and _scrapes_as_jav(row, code):
                title = titles.setdefault(code, dict(row=row, missing=set()))
                if self.stage != 'covers':
                    title['missing'].update(COLLECTED_FIELDS if verify else _missing_fields(row, local_fields))
        for code, title in titles.items():
            self._downloads(code, title)

    def finish(self, stage, code=None):
        from .library_processing import _provider_code
        if stage == 'metadata':
            release = _provider_code(code)
            if not release:
                return
            tokens = ['metadata:' + release]
            self.completed.update(tokens)
        else:
            tokens = [token for token in self.units if token.startswith(stage + ':')]
            self.completed.add(stage + ':*')
        for token in tokens:
            self.units.pop(token, None)
            self.outside_budget.pop(token, None)
            self.profiles.pop(token, None)
            self.baselines.pop(token, None)
        if stage == 'local':
            self.cover_ready.clear()
            self.cover_names = cached_names(self.cover_root)
            self.refresh(list(self.assets))

    def remaining(self, rows):
        planned = dict.fromkeys(rows, 0)
        for unit in self.units.values():
            for key, amount in unit.items():
                if rows[key]['network']:
                    planned[key] += amount
        download_keys = [key for key, row in rows.items() if not row['root']]
        outside = {key: sum(unit.get(key, 0) for unit in self.outside_budget.values()) for key in download_keys}
        wanted = sum(planned[key] - outside[key] for key in download_keys)
        budget = max(0, self.budget_bytes - sum(rows[key]['used_bytes'] for key in download_keys))
        if wanted > budget:
            remaining = budget
            for key in download_keys:
                value = min(remaining, budget * (planned[key] - outside[key]) // wanted)
                planned[key] = outside[key] + value
                remaining -= value
        return planned

    def workload(self, key=None):
        counts = [value for source, value in self.counts.items() if key is None or source == key]
        result = dict(video_files=sum(row['video_files'] for row in counts),
                      jav_files=sum(row['jav_files'] for row in counts),
                      jav_titles=len(set().union(*(row['titles'] for row in counts))))
        tokens = [token for token in self.units if token.startswith('metadata:')]
        if key is None or key.startswith('metadata'):
            amounts = [sum(value for source, value in self.units[token].items() if key is None or source == key)
                       for token in tokens]
            active = [value for value in amounts if value > 0]
            result.update(pending_jav_titles=len(active),
                          metadata_average_bytes=sum(active) // max(1, len(active)))
        return result
