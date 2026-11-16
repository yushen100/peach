"""CLI 与 API 共用的分项诊断；不修复账本、配置、工具或挂载。"""
from __future__ import annotations

import ipaddress
import os
import platform
import shutil
import socket
import sqlite3
import sys
import tempfile
import time
from contextlib import closing

from . import __version__, access, distribution, interface_text, listening, settings_file
from .ffmpeg import FFmpegResolver, binary_diagnostics
from .health import inspect_database
from .mount_reachability import MountReachability, PROBE_TIMEOUT

#: 诊断项的显示名、原因与修法都是 `labels.diagnostics` 下的 code（ADR-0159）。
_LABEL = "labels.diagnostics.label."
_REASON = "labels.diagnostics.reason."
_ACTION = "labels.diagnostics.action."
#: 几条原因并列时的分隔符，进语言资源一起翻译。
SEPARATOR = {"code": "labels.diagnostics.separator"}


def _render(code, params=None, language=interface_text.SOURCE_LANGUAGE):
    """渲染一句；列表参数由 `interface_text.text` 按语言资源的列表分隔符连起来（前端 `serverLabel` 同样处理）。"""
    return interface_text.text(f"server:{code}", params, language)


def render_parts(parts, language=interface_text.SOURCE_LANGUAGE):
    """按段存的一句：每段是 `{code, params}` 或原样的 `{text}`，逐段渲染再连起来。"""
    return "".join(part["text"] if "text" in part else _render(part["code"], part.get("params"), language)
                   for part in parts)


def joined(parts):
    """几段原因用分隔符连成一句的段落列表。"""
    result = []
    for part in parts:
        result += [SEPARATOR, part] if result else [part]
    return result


def item(label, status, reason, *, action="", target=None, details=None, reason_params=None, reason_parts=None):
    """一项诊断。`label`、`reason`、`action` 是 `labels.diagnostics.label|reason|action.<名字>` 的名字；
    几条原因并列时给 `reason_parts`（段落列表）。原字段放 zh-CN 渲染好的文字，旁边带 code。"""
    result = {"label": _render(_LABEL + label), "label_code": _LABEL + label, "status": status}
    if reason_parts:
        result.update(reason=render_parts(reason_parts), reason_parts=reason_parts)
    else:
        result.update(reason=_render(_REASON + reason, reason_params), reason_code=_REASON + reason,
                      reason_params=dict(reason_params or {}))
    result.update(action=_render(_ACTION + action) if action else "",
                  action_code=_ACTION + action if action else None, target=target, details=details or {})
    return result


def localized(check, language):
    """把一项诊断的文字换成 `language`（命令行跟本机语言）；没带 code 的字段照原文。"""
    result = dict(check)
    if check.get("label_code"):
        result["label"] = _render(check["label_code"], None, language)
    if check.get("reason_parts"):
        result["reason"] = render_parts(check["reason_parts"], language)
    elif check.get("reason_code"):
        result["reason"] = _render(check["reason_code"], check.get("reason_params"), language)
    if check.get("action_code"):
        result["action"] = _render(check["action_code"], None, language)
    return result


def doctor_endpoint(config):
    """选择配置端口或具有 TLS 材料的源码托盘入口。"""
    configured = (config.server.host, config.server.port)
    if distribution.standalone():
        return configured
    tls = config.directory("secrets") / "tls"
    if not all((tls / name).is_file() for name in ("peach-local-ca.crt", "peach.crt", "peach.key")):
        return configured
    if sys.platform == "darwin":
        return "0.0.0.0", 8443
    from .mdns import lan_ipv4
    try:
        address = os.environ.get("PEACH_LAN_ADDRESS") or lan_ipv4()
    except (OSError, RuntimeError):
        address = "0.0.0.0"
    return address, 443


def configuration(config, configured, *, validate=True):
    unreadable = not validate and settings_file.error() is not None
    if validate:
        try:
            settings_file.load_config(environ=dict(os.environ, PEACH_DATA_ROOT=str(config.data_root)))
        except settings_file.SettingsFileError:
            unreadable = True
    if unreadable:
        return item("configuration", "failed", "configurationUnreadable", action="repairConfiguration")
    if not configured:
        return item("configuration", "failed", "setupIncomplete", action="completeSetup", target="/settings/library")
    return item("configuration", "ok", "configurationReadable")


def database_checks(settings):
    state = inspect_database(settings.db_path)
    reasons = {"missing": "databaseMissing", "empty": "databaseEmpty", "unavailable": "databaseUnreadable"}
    readable = state["database"] == "available" and state["readable"]
    database = item("database", "ok" if readable else "failed",
                    "databaseReadable" if readable else reasons.get(state["database"], "databaseSchemaUnreadable"),
                    action="" if readable else "checkDatabase", details={"state": state["database"]})
    schema_reasons = {"current": "schemaCurrent", "pending": "schemaPending", "empty": "databaseEmpty",
                      "mismatch": "schemaMismatch", "unavailable": "schemaUnavailable"}
    current = state["schema"] == "current"
    schema = item("schema", "ok" if current else "failed", schema_reasons[state["schema"]],
                  action="" if current else "checkSchema",
                  details={key: state[key] for key in ("schema", "version", "pending", "mismatched", "unknown_versions")})
    return database, schema


def tools(settings, *, inspect=True):
    resolver = FFmpegResolver(settings.ffmpeg_root)
    found = {}
    for name, choice in (("ffmpeg", resolver.ffmpeg()), ("ffprobe", resolver.ffprobe())):
        found[name] = (binary_diagnostics(choice, decoders=name == 'ffmpeg') if inspect else
                       {'available': choice is not None, 'source': choice.source if choice else None,
                        'path': str(choice.path) if choice else None})
    openssl = shutil.which("openssl")
    found["openssl"] = {"available": openssl is not None, "source": "path" if openssl else None,
                        "path": openssl}
    missing = [name for name, value in found.items() if not value["available"]]
    unavailable = [name for name in ('ffmpeg', 'ffprobe') if found[name]['available'] and not found[name].get('usable', True)]
    incomplete = found['ffmpeg'].get('usable') and not found['ffmpeg'].get('av1_software')
    problems = ([{"code": _REASON + "toolsMissing", "params": {"names": missing}}] if missing else [])
    problems += ([{"code": _REASON + "toolsUnusable", "params": {"names": unavailable}}] if unavailable else [])
    problems += [{"code": _REASON + "av1Missing"}] if incomplete else []
    return item("tools", 'warning' if problems else 'ok', 'toolsUsable' if inspect else 'toolsFound',
                reason_parts=joined(problems), action='updateTools' if problems else '',
                target='/settings/maintenance' if problems else None, details=found)


def security(settings):
    policy = access.load(settings.access_path)
    loopback = listening.is_loopback(settings.host)
    protected = policy["mode"] == "password" or (policy["mode"] == "legacy" and bool(settings.token))
    exposed = not loopback or settings.tunnel_enabled
    if policy["mode"] == "locked":
        return item("security", "failed", "accessUnreadable", action="checkAccess")
    if exposed and not protected:
        return item("security", "warning", "passwordOff",
                    action="enablePassword", target="/settings/network", details={"exposed": True, "protected": False})
    return item("security", "ok", "passwordOn" if protected else "loopbackOnly",
                details={"exposed": exposed, "protected": protected})


def media_mounts(snapshot):
    if not snapshot["sources"]:
        return item("mediaMounts", "disabled", "noLocalSources")
    states = {"ok": "ok", "degraded": "warning", "checking": "unknown"}
    ok = snapshot["state"] == "ok"
    # 快照的每条警告另有 `{code, params}`（`warning_codes`）；只有原文的警告原样作为一段。
    codes = snapshot.get("warning_codes") or [None] * len(snapshot["warnings"])
    warnings = [] if ok else [coded or {"text": text} for text, coded in zip(snapshot["warnings"], codes)]
    return item("mediaMounts", states[snapshot["state"]], "sourcesReadable" if ok else "mountsChecking",
                reason_parts=joined(warnings), action="checkMounts" if not ok else "", target="/settings/library",
                details=snapshot)


def component_checks(settings, snapshot, *, config=None, validate_config=True, inspect_tools=True, migrating=False):
    config = config or settings_file.active()
    database, schema = ((item("database", "unknown", "databaseMigrating"), item("schema", "unknown", "databaseMigrating"))
                        if migrating else database_checks(settings))
    checks = {"database": database, "schema": schema, "configured": configuration(config, settings.configured, validate=validate_config),
              "media_mounts": media_mounts(snapshot), "security": security(settings)}
    checks["ffmpeg"] = tools(settings, inspect=inspect_tools)
    return checks


def writable_root(root):
    try:
        with tempfile.TemporaryFile(dir=root, prefix=".peach-doctor-") as probe:
            probe.write(b"peach")
            probe.flush()
    except PermissionError:
        return item("dataRoot", "failed", "dataRootDenied", action="fixDataRootPermission")
    except OSError:
        return item("dataRoot", "failed", "dataRootUnwritable", action="checkDataRoot")
    return item("dataRoot", "ok", "dataRootWritable")


def port_status(host, port):
    host = "127.0.0.1" if host == "localhost" else host.strip("[]")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return item("port", "unknown", "hostNotIp", details={"port": port})
    family = socket.AF_INET6 if address.version == 6 else socket.AF_INET
    try:
        with socket.socket(family, socket.SOCK_STREAM) as probe:
            probe.bind((host, port))
    except OSError as error:
        import errno
        if error.errno == errno.EADDRINUSE or getattr(error, "winerror", None) == 10048:
            return item("port", "ok", "portInUse", details={"port": port, "state": "in_use"})
        return item("port", "unknown", "portUnknown", details={"port": port})
    return item("port", "ok", "portAvailable", details={"port": port, "state": "available"})


def recent_failure(path):
    try:
        with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=1)) as connection:
            connection.execute("PRAGMA query_only=ON")
            row = connection.execute("SELECT id,finished_at FROM task_run WHERE status='failed' "
                                     "ORDER BY finished_at DESC,id DESC LIMIT 1").fetchone()
    except (sqlite3.Error, OSError):
        return item("tasks", "unknown", "taskFailuresUnknown")
    if row is None:
        return item("tasks", "ok", "noTaskFailures")
    # 不公开任务 error、参数或结果原文，它们可能包含凭据和媒体路径。
    moment = str(row[1] or "")
    safe_time = moment if len(moment) <= 32 and all(c in "0123456789-:+.TZ " for c in moment) else None
    return item("tasks", "warning", "taskFailures", action="viewFailedTasks",
                target="/tasks", details={"id": row[0], "finished_at": safe_time})


def probe_mounts(roots):
    monitor = MountReachability(roots)
    deadline = time.monotonic() + PROBE_TIMEOUT + 1.5
    try:
        while True:
            monitor.tick()
            snapshot = monitor.summary()
            if all(row["state"] != "checking" for row in snapshot["sources"]) or time.monotonic() >= deadline:
                return snapshot
            time.sleep(0.05)
    finally:
        monitor.stop()


def report(settings, snapshot, *, config=None):
    from . import library_diagnostics
    config = config or settings_file.active()
    checks = component_checks(settings, snapshot, config=config)
    checks.update(data_root=writable_root(config.data_root), port=port_status(settings.host, settings.port),
                  tasks=recent_failure(settings.db_path),
                  version=item("version", "ok", "versions",
                               reason_params={"peach": __version__, "python": platform.python_version()},
                               details={"peach": __version__, "python": platform.python_version()}))
    statuses = {check["status"] for check in checks.values()}
    state = "failed" if "failed" in statuses else "warning" if statuses & {"warning", "unknown"} else "ok"
    return {"version": __version__, "status": state, "checks": checks,
            "library": library_diagnostics.library(settings, config),
            "sources": library_diagnostics.sources(settings, config)}


def health_components(settings, snapshot, *, migrating=False):
    """公开健康检查的分项。`migrating`：服务启动时正在迁移账本，数据库两项不打开账本，记为正在更新。"""
    checks = component_checks(settings, snapshot, validate_config=False, inspect_tools=False, migrating=migrating)
    # 公开健康检查只保留分项原因与它的 code；工具路径与详细修法由本机诊断提供。
    fields = ("status", "reason", "reason_code", "reason_params", "reason_parts")
    return {key: {name: value[name] for name in fields if name in value} for key, value in checks.items()}
