"""无需服务或第三方依赖的脱敏诊断包。"""
from __future__ import annotations

import io
import argparse
import json
import os
import re
import zipfile
import tempfile
from datetime import datetime, timezone
from itertools import islice
from pathlib import Path

from . import error_reporting, interface_text
from .task_stages import stage as stage_fields
from .user_messages import UserOSError

LOG_NAMES = ("tray.log", "tray-lifecycle.log", "tray-setup.err.log", "tray-setup.out.log",
             "tray-http.err.log", "tray-http.out.log", "tray-https.err.log", "tray-https.out.log",
             'tray-restart.out.log', 'tray-scan.out.log', 'windows-source-sync.log', 'cloudflare-tunnel.log')
STATE_NAMES = ('library-processing.json', 'runtime-prepare.json', 'standalone-update.json',
               'automatic-updates.json', 'windows-source-sync.json', 'cloudflare-tunnel.json',
               'remote-reporting-delivery.json', 'library-sharing-attempt.json', 'media-processing.json')
#: 发现页封面逐番号处理结果的份数上限；每份只有几十字节，排查缺封面靠它们。
COVER_ATTEMPT_LIMIT = 500
TAIL_BYTES = 96 * 1024
JSON_READ_BYTES = 16 * 1024 * 1024
ACCESS_REQUEST = re.compile(r'^(.*?"(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS) )([^"\s]+)( HTTP/\d(?:\.\d)?" \d{3}[^\r\n]*)$')
MEDIA_ROUTE = re.compile(r'/(?:stream|follow-stream|preview-stream|stream/hls/\d+/(?:index\.m3u8|\d+\.ts))')
SCRAPING_INLINE_LIMIT = 100 * 1024 * 1024


def _access_log(line: str) -> str:
    """访问日志只保留技术路由、HTTP 版本与状态码，查询串整体移除。"""
    match = ACCESS_REQUEST.fullmatch(line)
    if not match:
        return error_reporting.redact(line)
    prefix, target, suffix = match.groups()
    path = target.split('?', 1)[0].split('#', 1)[0]
    route = path if MEDIA_ROUTE.fullmatch(path) or re.fullmatch(r'/api/[a-zA-Z0-9_/{}/:-]{1,180}', path) or path == '/healthz' else '<path>'
    return error_reporting.redact(prefix) + route + error_reporting.redact(suffix)


def _processing_value(value):
    """处理证据保留资产编号和错误，媒体名称与路径留在本机。"""
    def hide_names(value):
        if isinstance(value, dict):
            # 路径字段整值替换：文件名里的引号会截断文本脱敏的路径匹配。
            return {key: '<media>' if key in ('title', 'current_asset_name')
                    else '<path>' if key == 'path' else hide_names(item)
                    for key, item in value.items()}
        if isinstance(value, list):
            return [hide_names(item) for item in value]
        return value

    return error_reporting.scrub(hide_names(value))


def _json_text(value):
    return json.dumps(value, ensure_ascii=False) + '\n'


def _limited_value(value, depth=0, limit=20):
    """集合保留前 20 项、文本保留 4000 字符，嵌套最多 8 层。"""
    if isinstance(value, (dict, list)) and depth >= 8:
        return '<depth-limit>'
    if isinstance(value, dict):
        return {key: _limited_value(item, depth + 1, limit) for key, item in islice(value.items(), limit)}
    if isinstance(value, list):
        return [_limited_value(item, depth + 1, limit) for item in value[:limit]]
    return value[:4000] if isinstance(value, str) else value


def _structured_json(stream):
    raw = stream.read(JSON_READ_BYTES + 1)
    if len(raw) > JSON_READ_BYTES:
        return '', {'status': 'json_size_limit', 'truncated': True}
    if not raw.strip():
        return '', {'status': 'empty_json', 'truncated': False}
    try:
        value = json.loads(raw)
        if not isinstance(value, (dict, list)):
            return '', {'status': 'invalid_json_shape', 'truncated': False}
        value = _processing_value(value)
        content = _json_text(value)
        if len(content.encode('utf-8')) <= TAIL_BYTES:
            return content, {'status': 'included', 'truncated': False, 'projected': False}
        if isinstance(value, dict):
            # 任务标识、状态、阶段、计数先于续跑索引；问题与步骤先于其他集合。
            primary = ('job_id', 'run_id', 'status', 'stage', 'requested_stage', 'checked', 'total',
                       'issue_count', 'current_action', 'error', 'started_at', 'last_progress_at', 'completed_at')
            fields = sorted(value, key=lambda key: (key not in primary,
                            isinstance(value[key], (dict, list)),
                            key not in ('steps', 'issue_preview', 'notes', 'scan_checkpoints')))
            projected, omitted = {}, 0
            for key in fields:
                for limit in (20, 10, 5, 1):
                    candidate = {**projected, key: _limited_value(value[key], limit=limit)}
                    if len(_json_text(candidate).encode('utf-8')) <= TAIL_BYTES:
                        projected = candidate
                        break
                else:
                    omitted += 1
        else:
            projected, omitted = _limited_value(value), 0
        content = _json_text(projected)
        if len(content.encode('utf-8')) > TAIL_BYTES or not projected:
            return '', {'status': 'json_projection_limit', 'truncated': True}
        details = {'status': 'included', 'truncated': True, 'projected': True, 'omitted_fields': omitted}
        if isinstance(value, dict):
            details['collection_counts'] = {key: len(item) for key, item in islice(value.items(), 64)
                                            if isinstance(item, (dict, list))}
        else:
            details['collection_count'] = len(value)
        return content, details
    except (ValueError, UnicodeDecodeError):
        return '', {'status': 'unreadable_json', 'truncated': False}
    except RecursionError:
        return '', {'status': 'json_depth_limit', 'truncated': False}


def _structured_jsonl(stream, size):
    start = max(0, size - TAIL_BYTES)
    stream.seek(max(0, start - 1))
    raw = stream.read(TAIL_BYTES + (1 if start else 0))
    if start:
        boundary, raw = raw[:1], raw[1:]
        if boundary != b'\n':
            raw = raw.partition(b'\n')[2]
    lines, skipped, output_bytes = [], 0, 0
    for line in reversed(raw.splitlines()):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
            if not isinstance(value, (dict, list)):
                raise ValueError('invalid record shape')
            content = _json_text(_processing_value(value))
        except (ValueError, UnicodeDecodeError, RecursionError):
            skipped += 1
            continue
        length = len(content.encode('utf-8'))
        if output_bytes + length > TAIL_BYTES:
            skipped += 1
            continue
        lines.append(content)
        output_bytes += length
    return ''.join(reversed(lines)), {
        'status': 'included' if lines else 'no_complete_records' if size else 'empty_jsonl',
        'truncated': bool(start or skipped), 'skipped_records': skipped}


def redact_log(text: str) -> str:
    """JSON 行按字段脱敏，保留异常链；普通文本按行处理。"""
    lines = []
    for line in text.splitlines():
        try:
            value = json.loads(line)
        except ValueError:
            lines.append(_access_log(line))
        else:
            lines.append(json.dumps(error_reporting.scrub(value), ensure_ascii=False))
    return "\n".join(lines) + ("\n" if text.endswith("\n") else "")


def _recent(directory: Path, pattern: str, limit: int, entries: list) -> list[Path]:
    found = []
    for path in directory.glob(pattern):
        try:
            found.append((path.stat().st_mtime, path))
        except OSError as error:
            entries.append({'name': path.name, 'status': type(error).__name__})
    return [path for _, path in sorted(found, reverse=True)[:limit]]


def _log_candidates(directory: Path, entries: list) -> list[Path]:
    candidates = [directory / name for name in LOG_NAMES]
    for name in LOG_NAMES:
        candidates += _recent(directory, Path(name).stem + '.until-*.log', 2, entries)
    return candidates + _recent(directory, 'errors-*.log', 8, entries) + _recent(directory, 'crash-*.log', 4, entries)


def _archive_files(archive, directory, candidates, prefix, entries, *, structured=False):
    for path in dict.fromkeys(candidates):
        try:
            if path.is_symlink() or not path.resolve().is_relative_to(directory.resolve()):
                entries.append({'name': path.name, 'status': 'skipped_link'})
                continue
            if not path.is_file():
                continue
            with path.open('rb') as stream:
                size = stream.seek(0, os.SEEK_END)
                if structured:
                    stream.seek(0)
                    content, details = (_structured_jsonl(stream, size) if path.suffix == '.jsonl'
                                        else _structured_json(stream))
                else:
                    stream.seek(max(0, size - TAIL_BYTES))
                    raw = stream.read(TAIL_BYTES)
                    text = raw.decode('utf-8', errors='replace')
                    if size > TAIL_BYTES:
                        text = text.partition('\n')[2]
                    content = redact_log(text)
                    details = {'status': 'included', 'truncated': size > TAIL_BYTES}
            name = path.relative_to(directory).as_posix()
            if not structured or content:
                archive.writestr(f'{prefix}/{name}', content)
            entries.append({'name': name, 'section': prefix, 'source_bytes': size,
                            'exported_bytes': len(content.encode('utf-8')), **details})
        except OSError as error:
            entries.append({'name': path.name, 'status': type(error).__name__})


def _archive_state(archive, directory, entries):
    candidates = [directory / name for name in STATE_NAMES]
    candidates += _recent(directory, 'library-processing-*.issues.jsonl', 8, entries)
    # 启动时接回的中断任务与更新暂停标记：恢复服务卡住时，看的就是这两处（quan he，11-08）。
    candidates += _recent(directory, 'job-recovery/*.json', 32, entries)
    candidates += _recent(directory, 'update-tasks/**/*.json', 16, entries)
    _archive_files(archive, directory, candidates, 'processing', entries, structured=True)
    migrations = _recent(directory, 'update-backups/*/migration.log', 2, entries)
    _archive_files(archive, directory, migrations, 'updates', entries)


def _archive_covers(archive, directory, entries):
    candidates = [directory / 'jav-discovery-metadata.job.json']
    candidates += _recent(directory, 'feed-cover-attempts/*.json', COVER_ATTEMPT_LIMIT, entries)
    _archive_files(archive, directory, candidates, 'covers', entries, structured=True)


def _archive_scraping(archive, config, entries, *, progress, cancelled, include_details):
    from .scraping_diagnostics import bundle_to, summary, ExportCancelled
    index = summary(config)
    state = {'compressed_bytes': 0, 'inline_limit_bytes': SCRAPING_INLINE_LIMIT, 'status': 'summary_only'}
    if include_details:
        with tempfile.TemporaryFile() as prepared:
            bundle_to(config, prepared, include_all=True, progress=progress, cancelled=cancelled)
            state.update(compressed_bytes=prepared.tell())
            state['status'] = 'included' if prepared.tell() <= SCRAPING_INLINE_LIMIT else 'separate_export_required'
            if state['status'] == 'included':
                prepared.seek(0)
                with zipfile.ZipFile(prepared) as details:
                    for item in details.infolist():
                        with details.open(item) as source, archive.open('scraping/' + item.filename, 'w', force_zip64=True) as target:
                            while chunk := source.read(256 * 1024):
                                if cancelled():
                                    raise ExportCancelled()
                                target.write(chunk)
                index['detail'] = 'Detailed scraping records are included under scraping/'
            else:
                index['detail'] = 'Detailed scraping records exceed the automatic merge limit; export them separately by code'
    index['export'] = state
    archive.writestr('scraping/summary.json', json.dumps(error_reporting.scrub(index), ensure_ascii=False, indent=2))
    entries.append({'name': 'summary.json', 'section': 'scraping', 'status': 'included'})
    return state


def bundle_to(destination, *, report: dict | None = None, config=None, browser: dict | None = None,
              progress=lambda **values: None, cancelled=lambda: False, include_scraping=True):
    facts = {"created_at": datetime.now(timezone.utc).isoformat(), "system": error_reporting.system_facts()}
    facts['runtime'] = {'status': 'unavailable', 'reason': 'configuration-unavailable'}
    from . import diagnostic_context
    facts['browser'] = diagnostic_context.browser(browser)
    directories = error_reporting.log_directories()
    processing_directory = generated_directory = None
    try:
        from . import settings_file
        config = config or settings_file.load_config()
        facts["configuration"] = {"status": "available", "present": config.present,
                                  "port": config.server.port}
        directories.insert(0, config.directory("logs"))
        processing_directory = config.directory('state')
        generated_directory = config.directory('generated')
        try:
            facts['runtime'] = diagnostic_context.runtime(config)
        except Exception as error:
            facts['runtime'] = {'status': 'unavailable', 'reason': type(error).__name__}
        from .ffmpeg import FFmpegResolver, binary_diagnostics
        resolver = FFmpegResolver(config.directory('tools') / 'ffmpeg')
        facts['media_tools'] = {'ffmpeg': binary_diagnostics(resolver.ffmpeg(), decoders=True),
                                'ffprobe': binary_diagnostics(resolver.ffprobe())}
    except Exception as error:
        facts["configuration"] = {"status": "unavailable", **error_reporting.exception_facts(error)}
        try:
            root, _ = settings_file.discover_data_root()
            processing_directory, generated_directory = root / 'state', root / 'generated'
        except Exception:
            pass
    if report:
        # 报告分享仅保留系统检查，库清单、媒体挂载明细和来源原文留在本机页面。
        facts["checks"] = {key: {field: value.get(field) for field in ("status", "reason", "action")}
                           for key, value in report.get("checks", {}).items()
                           if key not in ("media_mounts",)}
        detail_fields = {'database': ('state',), 'schema': ('schema', 'version', 'pending', 'mismatched', 'unknown_versions'),
                         'security': ('exposed', 'protected'), 'port': ('port', 'state'), 'tasks': ('id', 'finished_at')}
        for key, names in detail_fields.items():
            if key in facts['checks']:
                details = report['checks'][key].get('details', {})
                facts['checks'][key]['details'] = {name: details[name] for name in names if name in details}
        mounts = report.get('checks', {}).get('media_mounts', {}).get('details', {})
        facts['mounts'] = {'state': mounts.get('state'), 'sources': [
            {key: row.get(key) for key in ('state', 'online', 'message', 'checked_at')}
            for row in mounts.get('sources', []) if isinstance(row, dict)]}
        source_fields = ('source', 'status', 'reason', 'last_check_at', 'elapsed_s',
                         'last_success_at', 'cooldown_until')
        facts['sources'] = [{key: row.get(key) for key in source_fields}
                            for row in report.get('sources', []) if isinstance(row, dict)]
    entries = []
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for index, directory in enumerate(dict.fromkeys(directories)):
            if cancelled():
                from .scraping_diagnostics import ExportCancelled
                raise ExportCancelled()
            progress(**stage_fields('diagnostics.collectLogs'), done=index, total=len(directories))
            try:
                candidates = _log_candidates(directory, entries)
                _archive_files(archive, directory, candidates, f'logs/{index}', entries)
            except OSError as error:
                entries.append({'name': '<logs>', 'status': type(error).__name__})
        if processing_directory is not None:
            try:
                _archive_state(archive, processing_directory, entries)
            except OSError as error:
                entries.append({'name': '<state>', 'status': type(error).__name__})
        if generated_directory is not None:
            try:
                _archive_covers(archive, generated_directory, entries)
            except OSError as error:
                entries.append({'name': '<covers>', 'status': type(error).__name__})
        if config is not None:
            try:
                facts['scraping'] = _archive_scraping(archive, config, entries, progress=progress,
                                                     cancelled=cancelled, include_details=include_scraping)
            except (OSError, ValueError) as error:
                entries.append({'name': 'scraping/summary.json', 'status': type(error).__name__})
        facts["logs"] = entries
        facts.update(diagnostic_context.archived_context(archive))
        archive.writestr("report.json", json.dumps(error_reporting.scrub(facts), ensure_ascii=False, indent=2))


def bundle_bytes(*, report: dict | None = None, config=None, browser: dict | None = None,
                 include_scraping=True) -> bytes:
    output = io.BytesIO()
    bundle_to(output, report=report, config=config, browser=browser, include_scraping=include_scraping)
    return output.getvalue()


def save_bundle(destination: Path | None = None) -> Path:
    payload = bundle_bytes(include_scraping=False)
    if destination is not None:
        with Path(destination).open("xb") as stream:
            stream.write(payload)
        return Path(destination)
    name = datetime.now(timezone.utc).strftime("peach-support-%Y%m%d-%H%M%S-%f.zip")
    for directory in error_reporting.log_directories():
        try:
            directory.mkdir(parents=True, exist_ok=True)
            target = directory / name
            with target.open("xb") as stream:
                stream.write(payload)
            return target
        except OSError:
            continue
    raise UserOSError("errors.supportBundle.notWritable")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=interface_text.text(
        "server:labels.supportBundle.cliDescription", None, interface_text.local_language()))
    parser.add_argument("destination", nargs="?", type=Path)
    args = parser.parse_args(argv)
    print(save_bundle(args.destination))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
