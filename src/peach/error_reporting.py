"""标准库错误取证；在配置与第三方依赖加载前可用。"""
from __future__ import annotations

import faulthandler
import ipaddress
import json
import logging
import os
import platform
import re
import sys
import tempfile
import threading
import traceback
from datetime import datetime, timezone
from pathlib import Path

from . import __version__

_log_dir: Path | None = None
_fault_stream = None
_write_lock = threading.RLock()
_hooks_installed = False
_timezone_lookup = threading.local()


def redact(value: str) -> str:
    """去掉网址、本机路径、地址与凭据值，保留异常类型和错误码。"""
    text = str(value).encode("utf-8", errors="backslashreplace").decode("utf-8")
    text = re.sub(r"(?i)\b(?:https?|ftp|file)://[^\s<>\"']+", "<url>", text)
    text = re.sub(r"(?i)\b(?:bearer|basic)\s+[\w+/=.-]+", "<credential>", text)
    text = re.sub(
        r"(?i)(--(?:[a-z0-9_]+-)*(?:password|passwd|token|api[_-]?key|secret|cookie|authorization|access[_-]?key)\s+)"
        r"(?:\"[^\"]*\"|'[^']*'|[^\s,;}]+)", r"\1<redacted>", text,
    )
    text = re.sub(r"(?im)(\b(?:cookie|set-cookie|authorization)[\"']?\s*:\s*)[^\r\n]*", r"\1<redacted>", text)
    text = re.sub(
        r"(?i)([\"']?(?:password|passwd|token|api[_-]?key|secret|cookie|authorization|access[_-]?key)"
        r"[\"']?\s*[:=]\s*)(?:\"[^\"]*\"|'[^']*'|[^\s,;}]+)",
        r"\1<redacted>", text,
    )
    text = re.sub(r"(?i)(?:[a-z]:[\\/]|\\\\)[^\r\n\"'<>]*", "<path>", text)
    text = re.sub(r"(?<![\w<:])/(?!api(?:/|\b)|healthz\b)(?:[^\r\n\"'<>/]+/)+[^\r\n\"'<>]*", "<path>", text)
    text = re.sub(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", "<ip>", text)
    def ipv6(match):
        try:
            ipaddress.IPv6Address(match[0])
            return "<ip>"
        except ValueError:
            return match[0]
    text = re.sub(r"(?<![\w:])(?:[\da-fA-F]{0,4}:){2,}[\da-fA-F:.%]*", ipv6, text)
    text = re.sub(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b", "<email>", text)
    return text


def log_directories() -> list[Path]:
    """配置日志目录不可写时使用当前用户临时目录。"""
    result = []
    if _log_dir is not None:
        result.append(_log_dir)
    try:
        from .settings_file import discover_data_root
        root, _ = discover_data_root()
        result.append(root / "logs")
    except Exception:
        pass
    try:
        result.append(Path(tempfile.gettempdir()) / "Peach" / "logs")
    except OSError:
        pass
    return list(dict.fromkeys(result))


def _redact_key(key):
    """字典键同样脱敏；`编号:路径` 形态保留编号前缀。键是标识而非正文，路径起头就整段替换，
    文件名里的引号不会截断替换。"""
    if not isinstance(key, str):
        return key
    prefix, colon, rest = key.partition(":")
    if colon and not re.search(r"[\\/]", prefix) and redact(rest).startswith("<path>"):
        return f"{prefix}:<path>"
    hidden = redact(key)
    return "<path>" if hidden.startswith("<path>") else hidden


def scrub(value):
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            name = _redact_key(key)
            if name != key:
                # 多个路径键脱敏后可能同名，按出现顺序编号保持唯一。
                base, count = name, 1
                while name in result or name in value:
                    count += 1
                    name = f"{base}#{count}"
            result[name] = "<redacted>" if re.search(
                r"(?i)password|passwd|token|api.?key|secret|cookie|authorization|credential|access.?key",
                str(key)) else scrub(item)
        return result
    if isinstance(value, (tuple, list)):
        return [scrub(item) for item in value]
    return value


def timezone_facts(moment: datetime | None = None) -> dict:
    """本机实际时区名称、偏移及本地时间；名称读取失败不阻止取证。"""
    local = (moment or datetime.now().astimezone())
    offset = local.utcoffset()
    result = {'local_time': local.isoformat(), 'abbreviation': local.tzname(),
              'utc_offset_minutes': int(offset.total_seconds() / 60) if offset is not None else None}
    if getattr(_timezone_lookup, 'active', False):
        return {**result, 'status': 'unavailable', 'name': None, 'reason': 'lookup-in-progress'}
    _timezone_lookup.active = True
    try:
        from tzlocal import get_localzone_name
        name = get_localzone_name()
        result.update(status='available' if name else 'unavailable', name=name[:200] if name else None)
    except Exception as error:
        result.update(status='unavailable', name=None, reason=type(error).__name__)
    finally:
        _timezone_lookup.active = False
    return result


def system_facts() -> dict:
    facts = {"peach": __version__, "python": platform.python_version(),
            "os": platform.system(), "os_release": platform.release(),
            "os_version": platform.version(),
            "architecture": platform.machine(), "frozen": bool(getattr(sys, "frozen", False)),
            "pid": os.getpid(), "parent_pid": os.getppid(), "server_timezone": timezone_facts()}
    try:
        from .buildinfo import frozen_build
        build = frozen_build()
        if build is not None:
            facts["build"] = {"commit": build.commit, "built_at": build.built_at, "version": build.version}
    except Exception:
        pass
    return facts


def exception_facts(error: BaseException) -> dict:
    from .diagnostic_exceptions import structured_codes
    frames = []
    seen = set()
    current = error
    chain = []
    while current is not None and id(current) not in seen and len(chain) < 8:
        seen.add(id(current))
        chain.append({"type": type(current).__name__, "message": redact(str(current))[:4000],
                      "winerror": getattr(current, "winerror", None), "errno": getattr(current, "errno", None),
                      "operation": getattr(current, "peach_operation", None),
                      "codes": structured_codes(current),
                      "context": getattr(current, "peach_context", None)})
        for frame in traceback.extract_tb(current.__traceback__)[-40:]:
            frames.append({"file": Path(frame.filename).name, "line": frame.lineno, "function": frame.name})
        current = current.__cause__ or (None if current.__suppress_context__ else current.__context__)
    return {"exception": chain, "frames": frames}


def event(stage: str, error: BaseException | None = None, *, local_fields: dict | None = None, **fields) -> Path | None:
    try:
        from . import remote_reporting
        remote_reporting.capture(stage, error, **fields)
    except Exception:
        pass
    return local_event(stage, error, **{**fields, **(local_fields or {})})


def local_event(stage: str, error: BaseException | None = None, **fields) -> Path | None:
    """只写本机脱敏日志，不调用远程上报。"""
    record = {"at": datetime.now(timezone.utc).isoformat(), "stage": stage,
              **system_facts(), 'thread': threading.current_thread().name, **fields}
    if error is not None:
        record.update(exception_facts(error))
    payload = json.dumps(scrub(record), ensure_ascii=False, default=str) + "\n"
    with _write_lock:
        for directory in log_directories():
            try:
                directory.mkdir(parents=True, exist_ok=True)
                path = directory / f"errors-{os.getpid()}.log"
                with path.open("a", encoding="utf-8") as stream:
                    stream.write(payload)
                return path
            except OSError:
                continue
    return None


def subprocess_failure(stage: str, *, tool: str, error: BaseException | None = None,
                       returncode=None, stderr=b'', **fields) -> Path | None:
    """媒体子进程仅保留工具名、错误码和有界错误输出，不记录完整命令。"""
    raw = stderr or getattr(error, 'stderr', b'') or b''
    text = raw.decode('utf-8', 'replace') if isinstance(raw, bytes) else str(raw)
    from .diagnostic_exceptions import media_details
    reason = media_details(error, {'stderr': text}, {})
    return event(stage, error, tool=Path(tool).name, returncode=returncode,
                 stderr=text[-4000:], local_fields={'reason_code': reason or 'unclassified'}, **fields)


class ErrorHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            error = record.exc_info[1] if record.exc_info else None
            event("logging", error, logger=record.name, level=record.levelname, message=redact(record.getMessage())[:4000])
        except Exception:
            # 取证失败不得递归调用 logging。
            pass


def _tidy_process_logs() -> None:
    """正常退出时收走本进程没写进任何问题的日志（#485）：空的崩溃日志、只有启动记录的事件日志。

    崩溃时解释器来不及跑 `atexit`，崩溃日志自然留下；写过事件的日志也留下。"""
    global _fault_stream
    if _fault_stream is not None:
        try:
            faulthandler.disable()
            _fault_stream.close()
        except (OSError, ValueError):
            pass
        _fault_stream = None
    from .log_retention import idle_process_log
    with _write_lock:
        for directory in log_directories():
            for name in (f"crash-{os.getpid()}.log", f"errors-{os.getpid()}.log"):
                path = directory / name
                if idle_process_log(path):
                    try:
                        path.unlink()
                    except OSError:
                        pass


def install(log_dir: Path | None = None) -> None:
    global _hooks_installed, _log_dir, _fault_stream
    if log_dir is not None:
        _log_dir = Path(log_dir)
    if _hooks_installed:
        return
    _hooks_installed = True
    original_main, original_thread, original_unraisable = sys.excepthook, threading.excepthook, sys.unraisablehook

    def main_hook(kind, error, tb):
        event("unhandled-main", error)
        if sys.stderr is not None:
            original_main(kind, error, tb)

    def thread_hook(args):
        if args.exc_type is not SystemExit:
            event("unhandled-thread", args.exc_value, thread=args.thread.name if args.thread else "unknown")
        if sys.stderr is not None:
            original_thread(args)

    def unraisable_hook(args):
        event("unraisable", args.exc_value)
        if sys.stderr is not None:
            original_unraisable(args)

    sys.excepthook, threading.excepthook, sys.unraisablehook = main_hook, thread_hook, unraisable_hook
    if sys.stderr is not None:
        logging.basicConfig()
    logging.getLogger().addHandler(ErrorHandler(level=logging.WARNING))
    for directory in log_directories():
        try:
            directory.mkdir(parents=True, exist_ok=True)
            _fault_stream = (directory / f"crash-{os.getpid()}.log").open("a", encoding="utf-8")
            faulthandler.enable(_fault_stream, all_threads=True)
            break
        except (OSError, RuntimeError):
            if _fault_stream is not None:
                _fault_stream.close()
                _fault_stream = None
    event("entry")
    import atexit
    atexit.register(_tidy_process_logs)
    try:
        from . import remote_reporting
        remote_reporting.usage()
    except Exception:
        pass


def console_ready() -> None:
    """冻结 CLI 取得标准错误句柄后保留控制台日志。"""
    root = logging.getLogger()
    if sys.stderr is not None and not any(isinstance(handler, logging.StreamHandler)
                                         and handler.stream is sys.stderr for handler in root.handlers):
        root.addHandler(logging.StreamHandler(sys.stderr))


def failure_details(stage: str, error: BaseException) -> str:
    """托盘弹窗与通知里的一段：异常本身加诊断报告或错误日志的位置，跟本机语言（`tray.failure.*`）。"""
    from . import interface_text
    from .user_messages import UserFacingError
    language = interface_text.local_language()
    shown = (interface_text.text(f"server:{error.code}", error.params, language)
             if isinstance(error, UserFacingError) else str(error))
    path = event(stage, error)
    try:
        from .support_bundle import save_bundle
        report = save_bundle()
        return interface_text.text("server:tray.failure.report", {"error": shown, "path": report}, language)
    except Exception as report_error:
        event("report-failed", report_error)
        if path:
            return interface_text.text("server:tray.failure.log", {"error": shown, "path": path}, language)
        return interface_text.text("server:tray.failure.noLog", {"error": shown}, language)


def tray_main() -> int:
    install()
    try:
        from .tray import main
        return main()
    except Exception as error:
        message = failure_details("tray-import", error)
        if os.name == "nt":
            import ctypes
            from . import interface_text
            title = interface_text.text("server:tray.title.startFailed", None, interface_text.local_language())
            ctypes.windll.user32.MessageBoxW(None, message, title, 0x10)
        elif sys.stderr is not None:
            print(message, file=sys.stderr)
        return 1


def cli_main() -> int:
    from .docker_entrypoint import drop_root_for_cli
    drop_root_for_cli()
    install()
    try:
        from .cli import main
        return main()
    except Exception as error:
        event("cli", error)
        if sys.stderr is not None:
            traceback.print_exc()
        return 1


def _code_name(value) -> str:
    name = f"{getattr(value, '__module__', '')}.{getattr(value, '__qualname__', '')}"
    return name if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.]{0,180}", name) else ""


def _asyncio_fields(context) -> dict:
    """仅保留代码类别，不访问连接地址、实例文本或请求内容。"""
    callback = getattr(context.get("handle"), "_callback", None)
    transport = context.get("transport") or getattr(callback, "__self__", None)
    protocol = context.get("protocol") or getattr(transport, "_protocol", None)
    fields = {}
    if name := _code_name(callback):
        fields["asyncio_callback"] = name
    tls = _code_name(type(protocol)) == "asyncio.sslproto.SSLProtocol"
    if tls:
        protocol = getattr(protocol, "_app_protocol", None) or protocol
    if protocol is not None and (name := _code_name(type(protocol))):
        fields["asyncio_protocol"] = name
        if name.startswith("uvicorn.protocols.http."):
            fields["asyncio_connection_role"] = "http-server"
    if tls:
        fields["asyncio_tls"] = True
    return fields


#: 清理回调里 `shutdown` 会报的 Winsock 错误：10054 对端已重置连接，10022 套接字已失效（WSAEINVAL）。
_CLEANUP_WINERRORS = frozenset({10054, 10022})


def is_asyncio_connection_cleanup(error, fields) -> bool:
    """识别对端断开后、纯标准库清理回调中 `shutdown` 抛出的 Winsock 异常。"""
    callback = "asyncio.proactor_events._ProactorBasePipeTransport._call_connection_lost"
    if (not isinstance(error, OSError) or getattr(error, "winerror", None) not in _CLEANUP_WINERRORS
            or fields.get("asyncio_callback") != callback
            or error.__cause__ is not None or error.__context__ is not None):
        return False
    frame = error.__traceback__
    last = None
    while frame is not None:
        last = (frame.tb_frame.f_globals.get("__name__"), frame.tb_frame.f_code.co_name)
        if last not in {("asyncio.events", "_run"), ("asyncio.proactor_events", "_call_connection_lost")}:
            return False
        frame = frame.tb_next
    return last == ("asyncio.proactor_events", "_call_connection_lost")


def _finish_asyncio_connection_cleanup(context) -> bool:
    """完成 CPython 清理回调中 shutdown 之后的资源收尾，不重复通知协议。"""
    from asyncio.proactor_events import _ProactorBasePipeTransport
    callback = getattr(context.get("handle"), "_callback", None)
    transport = getattr(callback, "__self__", None)
    if (not isinstance(transport, _ProactorBasePipeTransport) or not transport._closing
            or transport._called_connection_lost or transport._sock is None):
        return False
    transport._sock.close()
    transport._sock = None
    if transport._server is not None:
        transport._server._detach(transport)
        transport._server = None
    transport._called_connection_lost = True
    return True


def is_asyncio_accept_abort(error, context) -> bool:
    """识别客户端在 AcceptEx 完成前断开（WinError 64，ERROR_NETNAME_DELETED）的 accept 失败。

    这是对端行为，不是 Peach 故障；但 CPython 3.14 的 Proactor `_start_serving` 在处理器
    返回后会关掉监听套接字，这之后该端口不再接受连接，由 `_listen_again` 按原地址重新监听。
    """
    return (context.get("message") == "Accept failed on a socket"
            and isinstance(error, OSError) and getattr(error, "winerror", None) == 64
            and context.get("socket") is not None)


#: 重新监听前的等待秒数。刚关的监听套接字没有 TIME_WAIT，正常第一次就能绑上。
_REARM_DELAYS = (0, 0.5, 2)
#: 在途的重新监听任务；事件循环只弱引用任务。
_rearm_tasks = set()


def _rearm_listener(loop, uvicorn_server, listener) -> bool:
    """标准库关掉 `listener` 之后，替 uvicorn 补上一份同地址的监听。

    这时标准库还没关它，fileno 仍能和 uvicorn 手里的 `asyncio.Server` 对上。
    """
    if not any(sock.fileno() == listener.fileno()
               for server in getattr(uvicorn_server, "servers", ()) for sock in server.sockets):
        return False
    task = loop.create_task(_listen_again(uvicorn_server, listener.getsockname(), listener.family,
                                          dualstack=_dualstack(listener)))
    _rearm_tasks.add(task)
    task.add_done_callback(_rearm_tasks.discard)
    return True


def _dualstack(listener) -> bool:
    """`listening.bind` 的 `::` 套接字关着 `IPV6_V6ONLY`，IPv4 连接也从它进来；重新监听要照样关。"""
    import socket
    if listener.family != socket.AF_INET6:
        return False
    try:
        return listener.getsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY) == 0
    except OSError:
        return False


async def _listen_again(uvicorn_server, address, family, *, dualstack=False) -> None:
    """任务排在处理器所在回调之后执行，此时旧监听已关。绑不上就让服务退出，交给托盘重拉。

    旧的 `asyncio.Server` 原样留着：主机名解析出多个地址时，它的其余监听还在服务；
    里面那个已关的 socket 在停机 `close()` 时是空操作。
    """
    import asyncio
    import socket
    config = uvicorn_server.config

    def create_protocol(_loop=None):
        # 与 uvicorn `Server.startup` 里的工厂相同，新连接照样进 `server_state`，停机时一并收尾。
        return config.http_protocol_class(config=config, server_state=uvicorn_server.server_state,
                                          app_state=uvicorn_server.lifespan.state, _loop=_loop)

    failure = None
    for delay in _REARM_DELAYS:
        await asyncio.sleep(delay)
        if uvicorn_server.should_exit:
            return
        listener = None
        try:
            listener = socket.create_server(address, family=family, backlog=config.backlog,
                                            dualstack_ipv6=dualstack)
            server = await asyncio.get_running_loop().create_server(
                create_protocol, sock=listener, ssl=config.ssl, backlog=config.backlog)
        except OSError as error:
            if listener is not None:
                listener.close()
            failure = error
            continue
        if uvicorn_server.should_exit:
            # 停机已经遍历过 `servers`，这一份没人关。
            server.close()
        else:
            uvicorn_server.servers.append(server)
        return
    event("unhandled-asyncio", failure, classification="accept-listener-lost")
    uvicorn_server.should_exit = True


def asyncio_handler(loop, context, *, uvicorn_server=None) -> None:
    error = context.get("exception")
    if is_asyncio_accept_abort(error, context):
        rearm = uvicorn_server is not None and _rearm_listener(loop, uvicorn_server, context["socket"])
        # 默认处理器会经 asyncio 记录器写 ERROR 日志并远程上报，这里只留本机证据。
        local_event("unhandled-asyncio", error, message=context.get("message", ""),
                    classification="accept-aborted", listener_closed=True, listener_rearm=rearm)
        return
    fields = _asyncio_fields(context)
    if is_asyncio_connection_cleanup(error, fields):
        fields["classification"] = "connection-cleanup"
        try:
            fields["cleanup_recovered"] = _finish_asyncio_connection_cleanup(context)
        except Exception as cleanup_error:
            cleanup_error.__cause__ = error
            error = cleanup_error
            fields.update(classification="connection-cleanup-failed", cleanup_recovered=False)
            context = {**context, "exception": error}
    event("unhandled-asyncio", error, message=context.get("message", ""), **fields)
    if not fields.get("cleanup_recovered"):
        loop.default_exception_handler(context)
