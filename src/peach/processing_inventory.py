"""首次目录的只读预检；每次查询推进一批，关闭弹窗后不再继续。"""
from __future__ import annotations

import threading
import time
import sqlite3
from contextlib import closing
from pathlib import PureWindowsPath
from uuid import uuid4

from .processing_traffic import ProcessingTraffic
from .library_processing_scope import scoped_assets
from .user_messages import UserValueError

_SESSIONS = {}
_LATEST = {}
_LOCK = threading.Lock()


def _identity(config, db_path, stage, asset_ids, incremental=False):
    return (str(db_path), repr(config), stage, tuple(asset_ids) if asset_ids is not None else None, incremental)


def recent_rows(config, db_path, stage, asset_ids):
    with _LOCK:
        value = _LATEST.get(_identity(config, db_path, stage, asset_ids))
        return list(value[1]) if value and time.monotonic() - value[0] < 300 else []


class InventoryPreview:
    def __init__(self, config, db_path, stage, asset_ids, incremental=False, library_id=None):
        self.identity = _identity(config, db_path, stage, asset_ids, incremental)
        if incremental:
            from .library_new_assets import pending
            asset_ids = pending(db_path)
        self.meter = ProcessingTraffic(config, db_path, stage, scoped_assets(config, db_path, library_id, asset_ids))
        with closing(sqlite3.connect(db_path)) as connection:
            self.known = {(location, str(PureWindowsPath(path)).casefold()) for location, path
                          in connection.execute('SELECT location,path FROM asset WHERE path IS NOT NULL')}
        self.rows = list(self.meter.plan.assets)
        self.discovered = []
        self.errors = 0
        self.complete = stage not in ('all', 'scan') or (asset_ids is not None and not incremental)
        self.meter.unknown_files = not self.complete
        self.iterator = self._files(config)
        self.at = time.monotonic()
        self.lock = threading.Lock()

    def _files(self, config):
        from .scan import ScanRootUnreadable, _walk, is_sidecar, medium_of, walk_root_for, _relative_directory
        library_roots = tuple(root for roots in config.locations.values() for root in roots)
        seen = set()
        for key, source in self.meter.rows.items():
            if not source['root']:
                continue
            location, root = source['location'], source['root']
            try:
                top = walk_root_for(location, root, declared_roots=config.locations, mounts=config.mounts)
            except ValueError:
                self.errors += 1
                yield None
                continue
            # 根目录列不出来与子目录读失败一样只记一次错误，别的来源照常盘点。
            try:
                for directory, entries in _walk(top, onerror=self._error):
                    yield None
                    relative = _relative_directory(directory, top)
                    for entry in entries:
                        row = None
                        path = str(PureWindowsPath(root, *relative, entry.name))
                        if medium_of(entry.name) == 'video' and not is_sidecar(
                                entry.name, frozenset(), path=path, library_roots=library_roots):
                            owner = self.meter._media_key(path, location)
                            identity = location, path.casefold()
                            if owner is not None and identity not in self.known and identity not in seen:
                                seen.add(identity)
                                row = dict(location=location, path=path, name=entry.name,
                                           size=None, duration=None, snapshot_path=None)
                        yield row
            except ScanRootUnreadable as error:
                self._error(error)
                yield None

    def _error(self, error):
        self.errors += 1

    def advance(self):
        with self.lock:
            deadline = time.monotonic() + 0.15
            if not self.complete:
                batch = []
                for _ in range(1000):
                    try:
                        row = next(self.iterator)
                    except StopIteration:
                        self.complete = True
                        break
                    if row is not None:
                        self.rows.append(row)
                        self.discovered.append(row)
                        batch.append(row)
                    if time.monotonic() >= deadline:
                        break
                self.meter.plan.extend(batch)
            self.at = time.monotonic()
            self.meter.unknown_files = not self.complete or bool(self.errors)
            result = self.meter.snapshot()
            result['inventory'] = dict(complete=self.complete, errors=self.errors)
            return result


def preview(config, db_path, stage, asset_ids, token=None, *, incremental=False, library_id=None):
    with _LOCK:
        expired = [key for key, value in _SESSIONS.items() if time.monotonic() - value.at > 300]
        for key in expired:
            del _SESSIONS[key]
        expired = [key for key, value in _LATEST.items() if time.monotonic() - value[0] > 300]
        for key in expired:
            del _LATEST[key]
        if token:
            session = _SESSIONS.get(token)
            if session is None or session.identity != _identity(config, db_path, stage, asset_ids, incremental):
                raise UserValueError('errors.processingInventory.previewEnded')
        else:
            session = InventoryPreview(config, db_path, stage, asset_ids, incremental, library_id)
            token = uuid4().hex
            _SESSIONS[token] = session
    result = session.advance()
    with _LOCK:
        _LATEST[session.identity] = session.at, tuple(session.discovered)
    if not result['inventory']['complete']:
        result['inventory']['token'] = token
    else:
        with _LOCK:
            _SESSIONS.pop(token, None)
    return result
