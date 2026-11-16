"""旧扫描登记成作品的附属文件（NFO、海报、剧照、截图缩略图）从账本里删行。

0.35 之前扫描把正片旁的 `.nfo`、Kodi 命名的图片（`poster`、`fanart` 等）、`extrafanart/`
里的剧照和 `_4x4_thumb` 这类截图登记成 `asset` 行；现在扫描按 `scan.is_sidecar` 不再登记，
旧行还留着。判据与扫描同一份：按账本里同目录的行重建视频名（`scan.video_stems`），剧照目录
看上一层有没有视频（`scan.ARTWORK_DIRS`）。系统元数据（`._*`、`@eaDir` 等）归
`system_file_repair`，这里不碰。

处置是从账本删行，不动盘上文件，也不移进回收站：这些 NFO 与海报是媒体服务器（Kodi、
Jellyfin 等）要用的，清空回收站会把它们从盘上删掉；而扫描不会再登记它们，删掉的行不会回来。
带个人记录的（`personal_records.record_holders`）、标过喜欢的、在垃圾复核里被判为不是垃圾的
都不动。删掉的行连同指向它们的引用整行记进回执，`restore` 按回执原样插回。
"""
from __future__ import annotations

import json
from pathlib import PureWindowsPath

from .discovery_rules import system_path
from .personal_records import ASSET_REFERENCE_TABLES, delete_asset_rows, record_holders
from .scan import ARTWORK_DIRS, is_sidecar, medium_of, video_stems

#: 回执里记删掉的行与引用的字段。
REMOVED = 'removed'
#: 删行时只断开、不删的引用：(表, 列)。
_DETACHED = (('playlist', 'current_asset_id'), ('playlist', 'source_seed_asset_id'), ('follow_item', 'asset_id'))


def _directory(path: str) -> str:
    return str(PureWindowsPath(path).parent).casefold()


def _name(row) -> str:
    return row['name'] or PureWindowsPath(row['path']).name


def _sidecar(row, videos: frozenset, artwork_dir: bool) -> bool:
    """这一行按现行扫描判据是不该登记的附属文件：NFO，或附属图片。"""
    name, path = _name(row), row['path']
    if system_path(path):
        return False
    if row['medium'] == 'other':
        return name.lower().endswith('.nfo')
    if row['medium'] != 'image' or medium_of(name) != 'image':
        return False
    return is_sidecar(name, videos, artwork_dir=artwork_dir, path=path)


def collect(connection) -> list[dict]:
    """在库的附属文件行（`id,location,path,name,medium`），已排除受保护的。

    同目录有没有视频按账本里同目录的行看（回收站里的也算，盘上文件还在）；已消失的不算。
    """
    rows = connection.execute(
        "SELECT id,location,path,name,medium,disposal,feedback FROM asset WHERE path IS NOT NULL "
        "AND coalesce(disposal,'')<>'vanished'").fetchall()
    names: dict[tuple[str, str], list[str]] = {}
    for row in rows:
        names.setdefault((row['location'], _directory(row['path'])), []).append(_name(row))
    videos = {key: stems for key, members in names.items() if (stems := video_stems(members))}
    found = []
    for row in rows:
        if row['disposal'] is not None or (row['feedback'] or '') == 'like':
            continue
        location, folder = row['location'], _directory(row['path'])
        parent = str(PureWindowsPath(folder).parent).casefold()
        artwork_dir = PureWindowsPath(folder).name in ARTWORK_DIRS and (location, parent) in videos
        if _sidecar(row, videos.get((location, folder), frozenset()), artwork_dir):
            found.append({key: row[key] for key in ('id', 'location', 'path', 'name', 'medium')})
    protected = record_holders(connection, [row['id'] for row in found])
    return [row for row in found if row['id'] not in protected and not connection.execute(
        "SELECT 1 FROM review_decision WHERE category='junk_file' AND item_key=? AND status='rejected'",
        (str(row['id']),)).fetchone()]


def _rows(connection, sql: str, params) -> list[dict]:
    cursor = connection.execute(sql, params)
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, values)) for values in cursor.fetchall()]


def apply(connection, rows) -> list[dict]:
    """在写事务里删掉这些行（先按现状复核一遍），返回逐行的原样记录：行本身、引用表的行与断开的引用。"""
    current = {row['id']: row for row in collect(connection)}
    ids = [row['id'] for row in rows if current.get(row['id']) == row]
    removed = []
    for asset_id in ids:
        record = {'asset': _rows(connection, 'SELECT * FROM asset WHERE id=?', (asset_id,))[0],
                  'references': {}, 'detached': []}
        for table in ASSET_REFERENCE_TABLES:
            found = _rows(connection, f'SELECT * FROM {table} WHERE asset_id=?', (asset_id,))
            if found:
                record['references'][table] = found
        for table, column in _DETACHED:
            record['detached'] += [{'table': table, 'column': column, 'rowid': value[0]} for value in connection.execute(
                f'SELECT rowid FROM {table} WHERE {column}=?', (asset_id,))]
        decisions = _rows(connection, "SELECT * FROM review_decision WHERE category='metadata_fields' "
                                      'AND item_key GLOB ?', (f'asset:{asset_id}:*',))
        if decisions:
            record['references']['review_decision'] = decisions
        removed.append(record)
    delete_asset_rows(connection, ids)
    return removed


def _insert(connection, table: str, row: dict) -> None:
    columns = list(row)
    connection.execute(f'INSERT OR IGNORE INTO {table}({",".join(columns)}) VALUES({",".join("?" * len(columns))})',
                       [row[column] for column in columns])


def restore(connection, removed: list[dict]) -> int:
    """按回执把删掉的行原样插回（同编号已有行的跳过），断开的引用接回；返回插回的行数。"""
    restored = 0
    for record in removed:
        asset = record['asset']
        if connection.execute('SELECT 1 FROM asset WHERE id=?', (asset['id'],)).fetchone():
            continue
        _insert(connection, 'asset', asset)
        restored += 1
        for table, found in record.get('references', {}).items():
            for row in found:
                _insert(connection, table, row)
        for link in record.get('detached', []):
            connection.execute(f"UPDATE {link['table']} SET {link['column']}=? WHERE rowid=? AND {link['column']} IS NULL",
                               (asset['id'], link['rowid']))
    return restored


def receipt(removed: list[dict]) -> str:
    return json.dumps({REMOVED: removed}, ensure_ascii=False, default=str)
