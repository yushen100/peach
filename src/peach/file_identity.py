"""本机文件身份缓存：改名或同卷移动后保留影片 ID，不按文件名与大小合并。"""
import json
from pathlib import Path

from filelock import FileLock

from .fsutil import atomic_write_text
from .update_tasks import state_for
from .user_messages import UserValueError



def fingerprint(stat):
    if not getattr(stat, 'st_ino', 0):
        return None
    return [stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns,
            getattr(stat, 'st_birthtime_ns', 0)]


def missing(path):
    """只有盘上明确答「没有这个文件」才算没了；读不了、超时都按不确定，不接回。

    stat 交给可终止的读取子进程：扫描与推送发现的线程不能卡在挂死的挂载上。
    """
    from . import media_io
    try:
        media_io.file_stat(path)
    except FileNotFoundError:
        return True
    except OSError:
        return False
    return False


class FileIdentityIndex:
    def __init__(self, db):
        self.path = state_for(Path(db)).parent / 'local-file-identities.json'
        self.rows = self._read()
        self.dirty = {}
        self.identities = {}
        for key, row in self.rows.items():
            self.identities.setdefault(tuple(row['identity']), {})[key] = row

    def _read(self):
        try:
            result = json.loads(self.path.read_text(encoding='utf-8'))
        except FileNotFoundError:
            return {}
        if not isinstance(result, dict):
            raise UserValueError('errors.fileIdentity.invalidCache')
        return result

    def relocate(self, connection, location, path, native, stat, *, previous=None):
        """只接回唯一、旧路径已消失的系统文件身份或本机移动事件。"""
        if connection.execute('SELECT 1 FROM asset WHERE location=? AND path=?', (location, path)).fetchone():
            return False
        identity = fingerprint(stat)
        matches = list(self.identities.get(tuple(identity), {}).values()) if identity is not None else []
        if previous:
            old_location, old_path, old_native = previous
            record = connection.execute('SELECT id FROM asset WHERE location=? AND path=?',
                                        (old_location, old_path)).fetchone()
            matches = [dict(id=record[0], location=old_location, path=old_path, native=str(old_native))] if record else []
        matches = [row for row in matches if missing(row['native'])]
        if len(matches) != 1:
            return False
        row = matches[0]
        changed = connection.execute(
            "UPDATE asset SET location=?,path=?,name=?,disposal=NULL WHERE id=? AND location=? AND path=? "
            "AND (disposal IS NULL OR disposal='vanished')",
            (location, path, Path(native).name, row['id'], row['location'], row['path'])).rowcount
        return bool(changed)

    def observe(self, connection, location, path, native, stat):
        identity = fingerprint(stat)
        if identity is None:
            return
        row = connection.execute('SELECT id FROM asset WHERE location=? AND path=?', (location, path)).fetchone()
        if row:
            value = dict(id=row[0], location=location, path=path, native=str(native), identity=identity)
            key = str(row[0])
            if value != self.rows.get(key):
                old = self.rows.get(key)
                if old:
                    self.identities[tuple(old['identity'])].pop(key, None)
                self.rows[key] = self.dirty[key] = value
                self.identities.setdefault(tuple(identity), {})[key] = value

    def save(self):
        if not self.dirty:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with FileLock(str(self.path) + '.lock'):
            rows = self._read()
            rows.update(self.dirty)
            atomic_write_text(self.path, json.dumps(rows, ensure_ascii=False))
        self.dirty.clear()
