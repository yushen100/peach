"""跨进程聚合已筛选的技术诊断；不读取日志或账本。

同一诊断键在本机只上传一次错误事件，全部发生次数按间隔合并成计数日志。环境条件与超出
登记上限的新诊断键只计次数，不上传错误事件。
"""
from __future__ import annotations

import hashlib
import json
import threading
from datetime import datetime, timedelta, timezone

from filelock import FileLock

from .fsutil import atomic_write_text

INTERVAL = 6 * 3600
EVENT_LIMIT = 5
NEW_KEY_LIMIT = 20
#: 每天最多登记的只计数新键；环境条件与超出 `NEW_KEY_LIMIT` 的故障共用，样本只到代码位置。
COUNT_KEY_LIMIT = 100
RETENTION_DAYS = 7
LOCK_TIMEOUT = 5
# 掉盘时扫描里每个文件都会碰到同一条件；进程内先累计，防抖后或退出时再并入聚合文件。
_pending = {}
_pending_lock = threading.Lock()


def _now():
    return datetime.now(timezone.utc)


def _path(config):
    return config.directory("state") / "remote-reporting-frequency.json"


def _key(sample):
    fingerprint = {**sample, 'tags': {key: value for key, value in sample.get('tags', {}).items()
                                    if key != 'diagnostic_instance'}}
    return hashlib.sha256(json.dumps(fingerprint, sort_keys=True).encode()).hexdigest()


def coarse(event):
    """只计数的样本保留标签、被捕获异常的类型和最内层 Peach 代码位置，其余栈帧不参与诊断键。"""
    sample = {key: value for key, value in event.items() if key not in {"event_id", "exception", "debug_meta"}}
    values = event.get("exception", {}).get("values", [])
    if values:
        value = values[-1]
        frames = [frame for frame in value.get("stacktrace", {}).get("frames", []) if "module" not in frame]
        sample["exception"] = {"values": [{**{key: value[key] for key in ("type", "module") if key in value},
                                           "stacktrace": {"frames": frames[-1:]}}]}
    return sample


def _valid(key, row, cutoff, day):
    return (isinstance(key, str) and len(key) == 64 and isinstance(row, dict)
            and isinstance(row.get("day"), str) and cutoff <= row["day"] <= day
            and isinstance(row.get("first"), str) and row["first"] <= row["day"]
            and isinstance(row.get("event"), dict) and type(row.get("sent")) is bool
            and type(row.get("total")) is int and type(row.get("submitted")) is int
            and 0 <= row["submitted"] <= row["total"]
            and type(row.get("last_logged")) in (int, float)
            and type(row.get("count_only", False)) is bool)


def _load(path, revision, now):
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError):
        state = {}
    if not isinstance(state, dict) or state.get("revision") != revision:
        state = {"revision": revision, "records": {}}
    day = now.date().isoformat()
    if state.get("day") != day:
        state.update(day=day, events=0)
    cutoff = (now.date() - timedelta(days=RETENTION_DAYS - 1)).isoformat()
    records = state.get("records", {})
    if not isinstance(records, dict):
        records = {}
    state["records"] = {key: row for key, row in records.items() if _valid(key, row, cutoff, day)}
    if state.get('count_schema') != 2:
        for row in state['records'].values():
            if row['sent'] and row['first'] == row['day']:
                row['submitted'] = max(0, row['submitted'] - 1)
        state['count_schema'] = 2
    if type(state.get("events")) is not int or state["events"] < 0:
        state["events"] = 0
    return state


def _tags(row, key, count):
    return {**row["event"].get("tags", {}), "diagnostic_key": key,
            'count_schema': '2',
            "occurrence_day": row["day"], "occurrence_count": str(count)}


def _emit_event(state, row, key, emit, *, event_id=None):
    """首次错误事件提供定位样本，发生次数统一由计数日志汇总；只计数的行不上传错误事件。"""
    if row.get("count_only") or row["sent"] or row["total"] <= 0 or state["events"] >= EVENT_LIMIT:
        return
    event = {**row["event"], "tags": _tags(row, key, 1)}
    if event_id:
        event["event_id"] = event_id
    try:
        accepted = emit(event)
    except Exception:
        accepted = False
    if accepted:
        row['sent'] = True
        state["events"] += 1


def _emit_counts(rows, now, log, *, force=False):
    """把所有诊断键的未提交次数合并成一批计数日志。"""
    due = [(key, row) for key, row in rows
           if row["total"] > row["submitted"]
           and (force or row["day"] != now.date().isoformat()
                or now.timestamp() - row["last_logged"] >= INTERVAL)]
    if not due:
        return
    counts = [{**row["event"], "tags": _tags(row, key, row["total"] - row["submitted"])} for key, row in due]
    try:
        accepted = log(counts)
    except Exception:
        accepted = False
    if accepted:
        for _key, row in due:
            row.update(submitted=row["total"], last_logged=now.timestamp())


def _roll(row, key, now, log):
    """跨 UTC 日先提交前一天的次数，计数日志的统计日期是实际发生日；提交失败的旧次数不再保留。"""
    day = now.date().isoformat()
    if row["day"] == day:
        return
    _emit_counts([(key, row)], now, log, force=True)
    row.update(day=day, total=0, submitted=0, last_logged=now.timestamp())


def _fresh(records, day, count_only):
    return sum(row["first"] == day and row.get("count_only", False) == count_only for row in records.values())


def _row(records, sample, now, *, count_only=False):
    """返回诊断键与聚合行。故障的新键超出当天登记上限时改用只计数的粗样本，只计数的名额也用尽时返回空行。"""
    day = now.date().isoformat()
    key = _key(sample)
    if key in records:
        return key, records[key]
    fresh = {"event": sample, "first": day, "day": day, "sent": False,
             "total": 0, "submitted": 0, "last_logged": now.timestamp()}
    if not count_only:
        if _fresh(records, day, False) < NEW_KEY_LIMIT:
            records[key] = fresh
            return key, fresh
        sample = coarse(sample)
        key = _key(sample)
        if key in records:
            return key, records[key]
    if _fresh(records, day, True) >= COUNT_KEY_LIMIT:
        return key, None
    records[key] = {**fresh, "event": sample, "count_only": True}
    return key, records[key]


def record(config, revision, event, emit, log):
    """记录一次筛选后的故障；新诊断键立即上传错误事件，重复发生只累计次数。"""
    path = _path(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path) + ".lock", timeout=LOCK_TIMEOUT):
        now = _now()
        state = _load(path, revision, now)
        sample = {key: value for key, value in event.items() if key != "event_id"}
        key, row = _row(state["records"], sample, now)
        if row is None:
            return
        _roll(row, key, now, log)
        row["total"] += 1
        _emit_event(state, row, key, emit, event_id=event.get("event_id"))
        atomic_write_text(path, json.dumps(state))


def tally(config, revision, event):
    """环境条件只累计次数；样本收窄到代码位置，由下一次 `flush` 并入聚合文件。"""
    sample = coarse(event)
    key = _key(sample)
    with _pending_lock:
        rows = _pending.setdefault((str(_path(config)), revision), {})
        if key in rows:
            rows[key][1] += 1
        elif len(rows) < COUNT_KEY_LIMIT:
            rows[key] = [sample, 1]


def _take(path):
    with _pending_lock:
        return {revision: _pending.pop((name, revision)) for name, revision in list(_pending) if name == str(path)}


def _merge(state, path, revision, now, log):
    """进程内累计并入聚合文件；其他同意版本的累计直接丢弃。"""
    for sample, count in _take(path).get(revision, {}).values():
        key, row = _row(state["records"], sample, now, count_only=True)
        if row is not None:
            _roll(row, key, now, log)
            row["total"] += count


def _next_due(state, now):
    """下一次需要 `flush` 的时刻：最早到间隔的未提交计数，或下一个 UTC 日界（跨日提交、补传推迟的首次事件）。"""
    due = datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), timezone.utc).timestamp()
    for row in state["records"].values():
        if row["total"] > row["submitted"]:
            due = min(due, row["last_logged"] + INTERVAL)
    return due


def flush(config, revision, emit, log, *, force=False):
    """并入进程内累计、补传额度不足时推迟的首次事件，并按间隔提交计数日志；退出时可提前提交。

    返回下一次需要 `flush` 的时刻（UNIX 秒）；没有聚合文件时返回 None。
    """
    path = _path(config)
    with _pending_lock:
        waiting = any(name == str(path) for name, _revision in _pending)
    if not waiting and not path.exists():
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path) + ".lock", timeout=LOCK_TIMEOUT):
        now = _now()
        state = _load(path, revision, now)
        _merge(state, path, revision, now, log)
        for key, row in state["records"].items():
            _emit_event(state, row, key, emit)
        _emit_counts(state["records"].items(), now, log, force=force)
        atomic_write_text(path, json.dumps(state))
        return _next_due(state, now)


def clear(config):
    path = _path(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path) + ".lock", timeout=LOCK_TIMEOUT):
        _take(path)
        path.unlink(missing_ok=True)
