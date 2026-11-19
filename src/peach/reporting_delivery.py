"""诊断通道的本机传输回执，不保存载荷或服务端错误正文。"""
from datetime import datetime, timezone
import json
from pathlib import Path

from filelock import FileLock

from .fsutil import atomic_write_text

STATUSES = {"queued", "accepted", "failed", "unknown", "blocked"}
REASONS = {"network", "http_status", "rate_limit", "queue_full", "consent", "disabled", "unknown"}


def record(permit, event_id, result):
    try:
        _record(permit, event_id, result)
    except Exception:
        # 本机回执不可写不能阻止原本获准的诊断，也不能触发错误钩子。
        pass


def _record(permit, event_id, result):
    from .remote_reporting import _consent, _read
    if not isinstance(permit, dict) or permit.get("kind") not in {"usage", "errors"}:
        return
    path = Path(permit["consent"])
    current = _consent(path)
    if current["revision"] != permit.get("revision") or not current[permit["kind"]]:
        return
    status = result.get("status")
    if status not in STATUSES:
        return
    kind = "counts" if permit.get("diagnostic_counts") and permit["kind"] == "errors" else permit["kind"]
    state_path = path.with_name("remote-reporting-delivery.json")
    state_path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(state_path) + ".lock", timeout=.1):
        current = _consent(path)
        if current["revision"] != permit.get("revision") or not current[permit["kind"]]:
            return
        state = _read(state_path)
        if state.get("revision") != current["revision"]:
            state = {"revision": current["revision"]}
        previous = state.get(kind, {})
        previous = previous if isinstance(previous, dict) else {}
        if kind == "errors" and previous.get("kind") != kind:
            previous = {}
        if status != "queued" and previous.get("event_id") != event_id:
            return
        row = {"status": status, "event_id": event_id, "at": datetime.now(timezone.utc).isoformat()}
        last_sent = previous.get('last_sent_at') or (previous.get('at') if previous.get('status') == 'accepted' else None)
        if status == 'accepted':
            last_sent = row['at']
        if last_sent:
            row['last_sent_at'] = last_sent
        if result.get("reason") in REASONS:
            row["reason"] = result["reason"]
        code = result.get("status_code")
        if type(code) is int and 100 <= code <= 599:
            row["status_code"] = code
        row["kind"] = kind
        state[kind] = row
        atomic_write_text(state_path, json.dumps(state))


def snapshot(config):
    from .remote_reporting import _read, consent
    state = _read(config.directory("state") / "remote-reporting-delivery.json")
    if state.get("revision") != consent(config)["revision"]:
        return {}
    result = {}
    for kind in ('usage', 'errors', 'counts'):
        row = state.get(kind)
        if not isinstance(row, dict):
            continue
        # 老版 errors 回执也可能来自计数日志，无法判定是哪类信封。
        if kind == 'errors' and row.get('kind') != kind:
            continue
        result[kind] = {key: row[key] for key in ('status', 'reason', 'status_code', 'at') if key in row}
        last_sent = row.get('last_sent_at') or (row.get('at') if row.get('status') == 'accepted' else None)
        if last_sent:
            result[kind]['last_sent_at'] = last_sent
    return result
