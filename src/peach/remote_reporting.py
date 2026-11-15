"""按本机选择发送技术诊断；不读取历史日志、账本或媒体。"""
from __future__ import annotations

import atexit
import errno
import hashlib
import json
import os
import platform
import re
import subprocess
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

from . import interface_text
from .reporting_identity import event_metadata, machine_facts
from .diagnostic_exceptions import media_details
from .user_messages import UserFacingError, UserValueError

#: 两类上报，各自的「上传哪些字段」说明是 `labels.remoteReporting.field.<类>`（ADR-0159）。
FIELDS = ("usage", "errors")
CONSENT_SCHEMA = 2
NOTICE_CODE = "labels.remoteReporting.notice"
_lock = threading.RLock()
_client = None
_client_dsn = ""
_disabled = False
_frequency_timer = None
#: 定时器真正要处理的时刻（UNIX 秒）；长等待分段时中途醒来只比时间，不读写文件。
_frequency_due = None
_frequency_configs = {}
#: 新计数先攒这么久再落盘；也是两次处理的最短间隔，提交失败时不会空转。
FREQUENCY_DEBOUNCE = 60.0
#: 长等待按墙钟复核：Windows 的等待超时不计睡眠时间，睡醒后最晚这么久补上到期的处理。
WALL_CLOCK_RECHECK = 3600.0
TELEMETRY_ITEMS = frozenset({"log", "sessions"})
MEDIA_STAGES = frozenset({"frame-capture", "frame-tile", "media-probe", "preview", "library-preview"})
LOCAL_EXCEPTION_TYPES = frozenset({
    ("asyncio.exceptions", "CancelledError"), ("concurrent.futures._base", "CancelledError"),
    ("builtins", "InterruptedError"), ("peach.jobs", "JobPolicyError"),
    ("peach.jav_cover_fetch", "Unavailable"), ("peach.jav_cover_fetch", "DeadlineExceeded"),
    ("peach.scraping_access", "SourcePaused"), ("peach.previews", "PreviewUnavailable"),
    ("peach.transcodes", "TranscodeCancelled"), ("peach.segments", "SegmentCancelled"),
    ("peach.browser_transport", "BrowserUnavailable"), ("peach.browser_transport", "ChallengeUnsolved"),
    ("peach.face_detect", "FaceModelUnavailable"), ("peach.avatar_watermark", "WatermarkModelUnavailable"),
    ("starlette.requests", "ClientDisconnect"), ("filelock._error", "Timeout"),
    ("httpx", "TimeoutException"),
})
# 磁盘与文件系统层的 SQLite 错误，以及下一轮会重试的锁争用。
SQLITE_CONDITIONS = (("SQLITE_IOERR", "sqlite_io"), ("SQLITE_FULL", "disk_full"),
                     ("SQLITE_BUSY", "sqlite_busy"), ("SQLITE_LOCKED", "sqlite_busy"))
MEDIA_CONDITIONS = frozenset({"invalid_media", "permission_denied", "disk_full", "missing_media", "io_error"})
#: 媒体所在的盘或网络卷不可用：读写错误、磁盘满，外接盘与网络卷掉线（macOS 报 ENXIO）、连接断开。
#: 不收 ENETUNREACH：`smb_transport` 把认不出的异常也归成它，收进来会盖住代码缺陷。
MEDIA_VOLUME_ERRNOS = frozenset(getattr(errno, name) for name in (
    "EIO", "ENOSPC", "ENXIO", "ENODEV", "ENOTCONN", "ESTALE", "ENETDOWN",
    "EHOSTDOWN", "EHOSTUNREACH") if hasattr(errno, name))


def _config(config=None):
    if config is None:
        from .settings_file import active
        config = active()
    return config


def _read(path, *, missing=None):
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except FileNotFoundError:
        return missing if missing is not None else {}
    except (OSError, ValueError, UnicodeError):
        return {}


def _consent(path):
    value = _read(path, missing={"usage": True, "errors": True, "revision": "default"})
    enabled = all(value.get(key) is True for key in FIELDS)
    result = {"usage": enabled, "errors": enabled,
              "revision": str(value.get("revision", ""))}
    identity = value.get('diagnostic_instance')
    if (enabled and value.get('schema') == CONSENT_SCHEMA and isinstance(identity, str)
            and re.fullmatch(r'[a-f0-9]{32}', identity)):
        result['diagnostic_instance'] = identity
    return result


def consent(config=None):
    return _consent(_config(config).directory('state') / 'remote-reporting.json')


def _instance_consent(config):
    from filelock import FileLock
    from .fsutil import atomic_write_text
    path = _config(config).directory('state') / 'remote-reporting.json'
    current = _consent(path)
    if not current['usage'] or current.get('diagnostic_instance'):
        return current
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path) + '.lock', timeout=5):
        current = _consent(path)
        if current['usage'] and not current.get('diagnostic_instance'):
            current['diagnostic_instance'] = uuid.uuid4().hex
            atomic_write_text(path, json.dumps({**current, 'schema': CONSENT_SCHEMA}))
        return current


def dsn(environment="PEACH_SENTRY_DSN", key="dsn"):
    value = os.environ.get(environment, "").strip()
    if not value:
        from .settings_file import PROJECT_ROOT
        value = _read(PROJECT_ROOT / "sentry.json").get(key, "")
    if not isinstance(value, str):
        return ""
    try:
        parsed = urlsplit(value)
        # 托管 Sentry 的公开 DSN；不接受任意网络目标或带私钥的旧 DSN。
        if (parsed.scheme == "https" and parsed.hostname and re.fullmatch(r"[a-z0-9-]+\.ingest(?:\.(?:us|de))?\.sentry\.io", parsed.hostname)
                and parsed.username and not parsed.password and not parsed.query and not parsed.fragment
                and parsed.path[1:].isdigit() and parsed.port in (None, 443)):
            return value
    except ValueError:
        pass
    return ""


def snapshot(config=None):
    from . import reporting_delivery
    config = _config(config)
    current = consent(config)
    return {**{key: current[key] for key in FIELDS},
            "available": bool(dsn()),
            "fields": {key: interface_text.text(f"server:labels.remoteReporting.field.{key}") for key in FIELDS},
            "field_codes": {key: f"labels.remoteReporting.field.{key}" for key in FIELDS},
            "notice": interface_text.text(f"server:{NOTICE_CODE}"), "notice_code": NOTICE_CODE,
            "delivery": reporting_delivery.snapshot(config)}


def parse_choices(body, *, partial=False):
    if not isinstance(body, dict):
        raise UserValueError("errors.remoteReporting.notBoolean")
    defaults = consent() if partial else {}
    choices = {key: body.get(key, defaults.get(key)) for key in FIELDS}
    if any(type(value) is not bool for value in choices.values()):
        raise UserValueError("errors.remoteReporting.notBoolean")
    if choices["usage"] != choices["errors"]:
        raise UserValueError("errors.remoteReporting.mustMatch")
    return choices


def save(body, config=None):
    payload = parse_choices(body)
    from .fsutil import atomic_write_text
    config = _config(config)
    previous = consent(config)
    payload['schema'] = CONSENT_SCHEMA
    if payload['usage']:
        payload['diagnostic_instance'] = previous.get('diagnostic_instance') or uuid.uuid4().hex
    payload["revision"] = uuid.uuid4().hex
    atomic_write_text(config.directory("state") / "remote-reporting.json", json.dumps(payload))
    from . import diagnostic_frequency
    diagnostic_frequency.clear(config)
    # 打开选项后无需重启；首次日统计交给既有后台检查，不阻塞设置请求。
    if payload['usage'] and not _disabled and dsn():
        try:
            _schedule_frequency(config)
        except Exception:
            pass
    elif not payload['usage']:
        global _frequency_timer, _frequency_due
        with _lock:
            _frequency_configs.pop(str(config.directory('state')), None)
            if not _frequency_configs and _frequency_timer is not None:
                _frequency_timer.cancel()
                _frequency_timer = _frequency_due = None
    return snapshot(config)


def _reserve(config, kind, event):
    """版本统计跨托盘与子服务每天只发一次；额度文件只存指纹。"""
    from filelock import FileLock
    from .fsutil import atomic_write_text
    path = config.directory("state") / "remote-reporting-budget.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path) + ".lock", timeout=.1):
        day = datetime.now(timezone.utc).date().isoformat()
        value = _read(path)
        value = value if value.get("day") == day else {"day": day}
        seen = value.get(kind, [])
        if not isinstance(seen, list):
            return False
        fingerprint = hashlib.sha256(json.dumps({key: value for key, value in event.items()
                                                if key != "event_id"}, sort_keys=True).encode()).hexdigest()
        if seen:
            return False
        value[kind] = [*seen, fingerprint]
        atomic_write_text(path, json.dumps(value))
        return True


def _new_client(target, *, envelope_gate=None, delivery_callback=None):
    from sentry_sdk import Client
    from .reporting_transport import transport_class

    def permitted(permit):
        try:
            current = _consent(Path(permit["consent"]))
            return all(current.get(key) is True for key in FIELDS) and current["revision"] == permit["revision"]
        except Exception:
            return False

    def gate(envelope):
        if _disabled:
            return False
        if envelope_gate is not None:
            return envelope_gate(envelope)
        # 日志与会话汇总没有 extra，同意凭据在信封头；只有 Peach 自己组装、带凭据的信封能放行这两类条目。
        telemetry = "peach_permit" in envelope.headers
        if telemetry and not permitted(envelope.headers.pop("peach_permit")):
            return False
        for item in envelope.items:
            if (item.type in TELEMETRY_ITEMS) != telemetry:
                return False
            if telemetry:
                continue
            event = item.get_event()
            if event is None or not permitted(event.pop("extra", {})):
                return False
        for key in tuple(envelope.headers):
            if key not in {"event_id", "sent_at"}:
                del envelope.headers[key]
        return bool(envelope.items)

    def final_event(event, _hint):
        # SDK 的服务器名、上下文、SDK 包清单和全局 scope 均不进入发送载荷。
        result = {key: value for key, value in event.items() if key in {
            "event_id", "timestamp", "platform", "release", "environment", "dist", "level", "message", "tags", "exception", "extra",
        }}
        from .diagnostic_browser import clean_debug_meta
        if event.get("platform") == "javascript" and (metadata := clean_debug_meta(event.get("debug_meta"))):
            result["debug_meta"] = metadata
        return result

    return Client(dsn=target, transport=transport_class(gate, delivery_callback), default_integrations=False,
                  auto_enabling_integrations=False, auto_session_tracking=False,
                  send_default_pii=False, include_local_variables=False, include_source_context=False,
                  send_client_reports=False, enable_backpressure_handling=False,
                  enable_logs=False, enable_metrics=False, traces_sample_rate=0,
                  profiles_sample_rate=0, transport_queue_size=10, shutdown_timeout=0,
                  before_send=final_event)


def _connect(target):
    global _client, _client_dsn
    if _client is None or _client_dsn != target:
        if _client is not None:
            _client.close(timeout=0)
        _client, _client_dsn = _new_client(target), target
    return _client


def _permit(kind, config, current):
    return {"consent": str(config.directory("state") / "remote-reporting.json"),
            "kind": kind, "revision": current["revision"]}


def _attribute(value):
    kind = {bool: "boolean", int: "integer", float: "double"}.get(type(value), "string")
    return {"value": value if kind != "string" else str(value)[:200], "type": kind}


def _log_item(body, event, extra=None):
    """事件的版本、环境与白名单标签转成日志属性；不经过 SDK，避免附加主机名与追踪上下文。"""
    attributes = {"sentry.release": event.get("release", ""), "sentry.environment": event.get("environment", ""),
                  **({"sentry.dist": event["dist"]} if event.get("dist") else {}),
                  **event.get("tags", {}), **(extra or {})}
    return {"timestamp": datetime.now(timezone.utc).timestamp(), "trace_id": uuid.uuid4().hex,
            "level": "info", "body": body,
            "attributes": {key: _attribute(value) for key, value in attributes.items() if value != ""}}


def _submit_telemetry(kind, items, config, current, target):
    """日志与会话汇总组成一个信封交给同一传输；同意凭据只在信封头，闸门发送前移除。"""
    from sentry_sdk.envelope import Envelope, Item, PayloadRef
    from sentry_sdk.utils import format_timestamp
    with _lock:
        client = _connect(target)
        from .reporting_delivery import record
        receipt = uuid.uuid4().hex
        permit = {**_permit(kind, config, current), "receipt": receipt}
        envelope = Envelope(headers={"sent_at": format_timestamp(datetime.now(timezone.utc)), "peach_permit": permit})
        logs = [item for item in items if "body" in item]
        if logs:
            envelope.add_item(Item(type="log", content_type="application/vnd.sentry.items.log+json",
                                   headers={"item_count": len(logs)},
                                   payload=PayloadRef(json={"version": 2, "items": logs})))
        for session in (item for item in items if "aggregates" in item):
            envelope.add_item(Item(type="sessions", payload=PayloadRef(json=session)))
        record(permit, receipt, {"status": "queued"})
        if client.transport is None:
            record(permit, receipt, {"status": "failed", "reason": "disabled"})
            return False
        client.transport.capture_envelope(envelope)
        return True


def _submit(kind, event, config, current, target):
    with _lock:
        if current.get('diagnostic_instance'):
            event = {**event, 'tags': {**event.get('tags', {}), 'diagnostic_instance': current['diagnostic_instance']}}
        client = _connect(target)
        from .reporting_delivery import record
        permit = _permit(kind, config, current)
        event_id = event.get("event_id") or uuid.uuid4().hex
        record(permit, event_id, {"status": "queued"})
        accepted = client.capture_event({**event, "event_id": event_id,
            "platform": event.get("platform", "python"), "extra": permit})
        if not accepted:
            record(permit, event_id, {"status": "failed", "reason": "queue_full"})
        return accepted


def _wall():
    return datetime.now(timezone.utc).timestamp()


def _next_day():
    today = datetime.now(timezone.utc).date()
    return datetime.combine(today + timedelta(days=1), datetime.min.time(), timezone.utc).timestamp()


def _arm(due):
    """在 `_lock` 内调用：定时器排到 `due`，长等待按墙钟分段。"""
    global _frequency_timer, _frequency_due
    if _frequency_timer is not None:
        _frequency_timer.cancel()
    _frequency_due = due
    _frequency_timer = threading.Timer(max(0.0, min(due - _wall(), WALL_CLOCK_RECHECK)), _frequency_tick)
    _frequency_timer.daemon = True
    _frequency_timer.start()


def _schedule_frequency(config, due=None):
    """登记要定时处理的数据根并排定下次处理；不给时刻表示有新计数，防抖后落盘。只会把定时器提前。"""
    with _lock:
        _frequency_configs[str(config.directory("state"))] = config
        floor = _wall() + FREQUENCY_DEBOUNCE
        due = floor if due is None else max(due, floor)
        if _frequency_timer is None or _frequency_due is None or due < _frequency_due:
            _arm(due)


def _frequency_tick():
    global _frequency_timer, _frequency_due
    with _lock:
        if _frequency_due is not None and _wall() < _frequency_due:
            _arm(_frequency_due)
            return
        _frequency_timer = _frequency_due = None
        configs = list(_frequency_configs.values())
    for config in configs:
        # 常驻托盘与 NAS 不一定每天重启；沿用每日额度，不能只统计启动的那一天。
        # `usage` 按日界与计数到期点重排下一次。
        usage(config)


def _code_location(values):
    """被捕获异常里最内层的 Peach 栈帧，写成「文件:函数」和行号；没有 Peach 栈帧就不带。"""
    frames = [frame for frame in (values[-1].get("stacktrace", {}).get("frames", []) if values else [])
              if "module" not in frame]
    if not frames or not frames[-1].get("filename"):
        return {}
    frame = frames[-1]
    location = {"code_location": f"{frame['filename']}:{frame['function']}" if frame.get("function") else frame["filename"]}
    if type(frame.get("lineno")) is int:
        location["code_line"] = frame["lineno"]
    return location


def _count_logs(config, current, target):
    """计数日志带整数 `occurrence_count`，接收端可按诊断键、日期与版本直接求和，按代码位置对应到源码。"""
    def submit(counts):
        items = []
        for event in counts:
            values = event.get("exception", {}).get("values", [])
            extra = {"occurrence_count": int(event["tags"]["occurrence_count"]),
                     **({'diagnostic_instance': current['diagnostic_instance']} if current.get('diagnostic_instance') else {}),
                     **({"exception_type": values[-1].get("type", "")} if values else {}),
                     **_code_location(values)}
            items.append(_log_item("Peach diagnostic count", event, extra))
        return _submit_telemetry("errors", items, config, current, target)
    return submit


def flush_counts(config=None, *, force=False):
    """返回计数下一次到期的时刻；没有可处理的计数时返回 None。"""
    try:
        from . import diagnostic_frequency
        config = _config(config)
        target = dsn()
        if _disabled or not target:
            return None
        current = _instance_consent(config)
        if not current['errors']:
            return None
        return diagnostic_frequency.flush(config, current["revision"],
            lambda event: _submit("errors", event, config, current, target),
            _count_logs(config, current, target), force=force)
    except Exception:
        return None


def send(kind, event, config=None, *, count_only=False):
    """发送失败不影响应用；技术诊断按同意版本聚合，关闭时不初始化 SDK。`count_only` 的环境条件只计次数。"""
    if _disabled:
        return
    try:
        config = _config(config)
        target = dsn()
        if kind not in FIELDS or not target:
            return
        current = _instance_consent(config)
        if not current[kind]:
            return
        metadata = event_metadata(kind)
        event = {**event, **metadata, "tags": {**event.get("tags", {}), **metadata["tags"]}}
        if current.get('diagnostic_instance'):
            event['tags']['diagnostic_instance'] = current['diagnostic_instance']
        if kind == 'usage':
            event['tags']['activity_kind'] = 'instance-day'
        if kind == "errors":
            from . import diagnostic_frequency
            if count_only:
                diagnostic_frequency.tally(config, current["revision"], event)
            else:
                diagnostic_frequency.record(config, current["revision"], event,
                    lambda batch: _submit(kind, batch, config, current, target),
                    _count_logs(config, current, target))
            _schedule_frequency(config)
        elif _reserve(config, kind, event):
            # 版本统计是一条日志加一条会话汇总，不占错误事件额度（ADR-0132）。
            day = datetime.now(timezone.utc).date().isoformat()
            session = {"attrs": {"release": event["release"], "environment": event["environment"]},
                       "aggregates": [{"started": f"{day}T00:00:00Z", "exited": 1}]}
            _submit_telemetry(kind, [_log_item(event.get("message", ""), event), session], config, current, target)
        return True
    except Exception:
        # 不能把遥测自身故障写回错误钩子而递归发送。
        pass


def usage(config=None):
    send("usage", {"message": "Peach daily activity", "level": "info",
                   "tags": {"os": platform.system(), **machine_facts()}}, config)
    due = flush_counts(config)
    try:
        if not _disabled and consent(config)["errors"] and dsn():
            tomorrow = _next_day()
            _schedule_frequency(_config(config), tomorrow if due is None else min(due, tomorrow))
    except Exception:
        pass


def _http_status(error):
    # 带 code 的报错（`UserFacingError`）身上的 `status_code` 只是「漏到接口层时回什么状态」的提示，
    # 不是一次 HTTP 失败；按它判 4xx 会把后台技术故障当成预期情况、不再上报。
    status = None if isinstance(error, UserFacingError) else getattr(error, "status_code", None)
    if type(status) is not int or not 100 <= status <= 599:
        status = getattr(getattr(error, "response", None), "status_code", None)
    if type(status) is not int and any(cls.__module__ == "urllib.error" and cls.__name__ == "HTTPError"
                                      for cls in type(error).__mro__):
        status = getattr(error, "code", None)
    return status if type(status) is int and 100 <= status <= 599 else None


def _exception_details(error):
    from .diagnostic_exceptions import project
    return project(error, _http_status)


def _media_failure(stage, error):
    return stage in MEDIA_STAGES or any(cls.__module__ == 'peach.transcodes'
        and cls.__name__ == 'TranscodeUnavailable' for cls in type(error).__mro__)


def _expected_failure(stage, error, fields):
    kinds = {(cls.__module__, cls.__name__) for cls in type(error).__mro__}
    unsupported = ('peach.folder_picker', 'PickerUnsupported')
    if unsupported in kinds:
        return True
    if ('starlette.exceptions', 'HTTPException') in kinds:
        status = _http_status(error)
        if status == 501:
            cause = getattr(error, '__cause__', None)
            if unsupported in {(cls.__module__, cls.__name__) for cls in type(cause).__mro__}:
                return True
        if status in {502, 503, 504}:
            # 路由主动报告上游不可用；未处理异常走 500，仍然上报。
            return True
    if stage == "logging" and fields.get("level", "ERROR") not in {"ERROR", "CRITICAL"}:
        return True
    if stage == "browser" and fields.get("error_name") == "AbortError":
        return True
    if kinds & LOCAL_EXCEPTION_TYPES:
        return True
    if ("peach.sources.base", "SourceFailure") in kinds:
        return str(error.reason) in {"cloudflare_challenge", "ip_banned", "geo_restricted", "account_suspended", "auth_required",
            "not_found", "gone", "no_usable_metadata", "rate_limited", "timeout", "server_error", "network"}
    if ("peach.metadata", "MetadataProviderError") in kinds and error.detail != "parse_error":
        return error.kind in {"auth", "not_found"} or error.retryable is True or error.temporary is True
    return False


def _condition(stage, error, fields):
    """环境条件的固定类别：数据库磁盘与锁争用、媒体所在的盘掉线、媒体输入缺失或损坏、权限、空间与超时。

    这些情况回答「各平台、各部署方式下多常见」，只计次数，不上传定位事件；不是环境条件时返回空串。
    """
    name = getattr(error, "sqlite_errorname", "")
    if isinstance(name, str):
        for prefix, condition in SQLITE_CONDITIONS:
            if name.startswith(prefix):
                return condition
    if not _media_failure(stage, error):
        return ""
    detail = getattr(error, "diagnostics", {})
    if (isinstance(error, (subprocess.TimeoutExpired, TimeoutError))
            or isinstance(detail, dict) and detail.get("reason") == "timeout"):
        return "timeout"
    if isinstance(error, OSError) and error.errno in MEDIA_VOLUME_ERRNOS:
        return {errno.ENOSPC: "disk_full", errno.EIO: "io_error"}.get(error.errno, "media_volume")
    if isinstance(error, (FileNotFoundError, PermissionError, IsADirectoryError, NotADirectoryError)):
        filename = getattr(error, "filename", None)
        if filename and Path(filename).name != Path(str(fields.get("tool", ""))).name:
            return "permission_denied" if isinstance(error, PermissionError) else "missing_media"
    reason = media_details(error, fields, {})
    return reason if reason in MEDIA_CONDITIONS else ""


def _actionable(stage, error, fields):
    """仅允许技术故障入口；预期领域状态和 SDK 自身日志留在本机。"""
    if str(fields.get("logger", "")).startswith(("sentry_sdk", "urllib3")):
        return False
    if stage == "unhandled-asyncio":
        from .error_reporting import is_asyncio_connection_cleanup
        if is_asyncio_connection_cleanup(error, fields):
            return False
    stages = {"browser", "http-request", "unhandled-main", "unhandled-thread", "unraisable",
              "unhandled-asyncio", "cli", "packaged-cli", "desktop-entry", "tray-import",
              "background-job", "library-preview", "frame-capture", "frame-tile", "media-probe",
              "preview", "standalone-update-install", "standalone-update-rollback", "logging"}
    if stage not in stages or isinstance(error, (SystemExit, KeyboardInterrupt)):
        return False
    if _expected_failure(stage, error, fields):
        return False
    if stage == "http-request" and fields.get("status_code", 500) < 500:
        return False
    if (status := _http_status(error)) is not None and 400 <= status < 500:
        return False
    return True


def _http_details(stage, fields):
    tags, error_id = {}, ""
    if stage != "http-request":
        return tags, error_id
    if fields.get("method") in {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}:
        tags["http_method"] = fields["method"]
    route = fields.get("route", "")
    if isinstance(route, str) and re.fullmatch(r"[a-zA-Z0-9_/{}/:-]{1,180}", route):
        tags["route_template"] = route
    candidate = fields.get("error_id", "")
    if isinstance(candidate, str) and re.fullmatch(r"[a-f0-9]{32}", candidate):
        error_id = candidate
    return tags, error_id


def _technical_projection(stage, error, fields):
    """投影各入口的故障证据，排除缺少定位信息的记录。"""
    media_stage = _media_failure(stage, error)
    if error is None and stage != "browser" and not media_stage:
        return
    values, codes, _chain = _exception_details(error)
    debug_meta = None
    if error is None and stage == "browser":
        from .diagnostic_browser import project
        value, debug_meta = project(fields)
        if not value["stacktrace"]["frames"]:
            return
        values = [value]
    if stage == "logging" and not any("module" not in frame for value in values for frame in value["stacktrace"]["frames"]):
        return
    for key in ("returncode", "status_code"):
        if type(fields.get(key)) is int:
            codes[key] = fields[key]
    reason = ""
    if media_stage:
        reason = media_details(error, fields, codes)
        if not reason and not codes and error is None:
            return
    category = type(error).__name__ if error is not None else ("BrowserError" if stage == "browser" else "MediaToolError")
    if not values:
        values = [{"type": category, "value": reason or category, "stacktrace": {"frames": []}}]
    return values, codes, reason, debug_meta


def capture(stage, error=None, **fields):
    """只投影代码位置和错误类别，不发送异常文本或日志文本。"""
    if not _actionable(stage, error, fields):
        return
    capture_key = (os.getpid(), id(error.__traceback__)) if error is not None else None
    if error is not None and getattr(error, "_peach_remote_capture", None) == capture_key:
        return
    base = {"os": platform.system(), "python": platform.python_version(),
            "architecture": platform.machine(), "stage": stage}
    if condition := _condition(stage, error, fields):
        # 环境条件只带类别与代码位置，不带错误码、路径或原文。
        values = _exception_details(error)[0] if error is not None else []
        sent = send("errors", {"tags": {**base, "condition": condition},
                               **({"exception": {"values": values}} if values else {})}, count_only=True)
    else:
        projection = _technical_projection(stage, error, fields)
        if projection is None:
            return
        values, codes, reason, debug_meta = projection
        http, error_id = _http_details(stage, fields)
        from .diagnostic_browser import environment
        browser_tags = environment(fields) if stage == 'browser' else {}
        event = {"level": "error", "tags": {**base, **http, **browser_tags,
            **{key: str(value) for key, value in codes.items()}, **({"media_failure": reason} if reason else {})},
            "exception": {"values": values}}
        if stage == "browser":
            event["platform"] = "javascript"
            if debug_meta:
                event["debug_meta"] = debug_meta
        if error_id:
            event["event_id"] = error_id
        sent = send("errors", event)
    if sent and error is not None:
        try:
            error._peach_remote_capture = capture_key
        except (AttributeError, TypeError):
            pass


def disable_for_process():
    """本进程停止远程发送，保留本机选择。"""
    global _disabled
    _disabled = True
    close()


def close():
    global _client, _client_dsn, _frequency_timer, _frequency_due
    with _lock:
        if _frequency_timer is not None:
            _frequency_timer.cancel()
        _frequency_timer = _frequency_due = None
        _frequency_configs.clear()
        if _client is not None:
            _client.close(timeout=0)
        _client, _client_dsn = None, ""


def _shutdown():
    try:
        with _lock:
            configs = list(_frequency_configs.values())
        for config in configs:
            flush_counts(config, force=True)
        with _lock:
            if _client is not None:
                _client.flush(timeout=1)
            close()
    except Exception:
        pass


atexit.register(_shutdown)
