"""批量修一个媒体库里播不了或播不顺的 MP4。两类毛病，一个入口：

- **缺 `ctts`**：有 B 帧却没有时间戳表，浏览器按容器时间戳丢帧，只能退回 HLS 实时转码。
  `mp4repair` 重建一份头存成边车，原文件一个字节不动。
- **缺 `moov`**：下载或录制没写完，整个索引都没有，在哪都打不开。`mp4recover` 借同来源
  的完好片子重建，修好的文件换回原路径，坏原件改名留在同目录。

两段走，因为两段的瓶颈不是一回事：

1. **筛**：探不出时长的片子先看顶层有没有 `moov`，其余读头判断缺不缺 `ctts`。一次判定
   只读头，但 115 上就是一次网络往返。判完的结论按「资产 + 大小 + 改动时间」落盘，下次
   再点就不必把整个库重读一遍。
2. **修**：两类都要把整片读一遍，CPU 和读盘都吃满，所以串行做，并且按播放次数排序——
   常看的先修好，中途停下也已经换来了体感。

一轮只修一个库，由用户点名。选中计费来源（PikPak）上的库就是同意走流量：一部片要完整
拉一遍才修得了。

片源在网盘挂载上，挂载挂死时本进程里的一次 `stat` 或读盘会一直不返回，任务停在运行中、
取消也解不开。所以 stat、读顶层盒子与片头、暂存与换回修好的文件都交给带期限的子进程
（`media_io`）：卡住的那一部记失败，下一部照做，取消在两部之间生效。
"""
from __future__ import annotations

import json
import shutil
import subprocess
import time
from pathlib import Path, PureWindowsPath

from . import media_io, media_libraries, media_probe, mp4recover, mp4repair, settings_file
from .mp4repair import RepairUnavailable
from .platform import translate_ledger_path
from .task_stages import stage as stage_fields
from .user_messages import UserInterruptedError, UserValueError

#: 判定结论的落盘位置，放在边车自己的目录里：它们同生同灭，清缓存时一起走。
SCAN_CACHE_NAME = "mp4-repair-scan.json"

#: 文件身份对应的判定缓存；修复产物由边车或新文件核验。
CLEAN = "clean"
UNAVAILABLE = "unavailable"
LEGACY_UNAVAILABLE = "unavailable-layout-v1"

#: 缺时间戳表，修的是边车。
HEADER = "header"
#: 缺整个索引，修的是文件本身。
INDEX = "index"

_MP4 = "(lower({0}path) LIKE '%.mp4' OR lower({0}path) LIKE '%.m4v')"

#: 读片头索引（最多 64 MB）的期限；读取期间响应暂停与取消。
LAYOUT_SECONDS = 300.0
#: 暂存修好的文件时，多久没写完一块（`mp4recover.STAGE_CHUNK`）算卡住。
STAGE_IDLE_SECONDS = 120.0


def _cache_path(contract) -> Path:
    return Path(contract.transcode_root) / SCAN_CACHE_NAME


def _load_cache(contract) -> dict[str, str]:
    try:
        payload = json.loads(_cache_path(contract).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    entries = payload.get("entries") if isinstance(payload, dict) else None
    if not isinstance(entries, dict):
        return {}
    return {str(key): LEGACY_UNAVAILABLE if value == UNAVAILABLE and payload.get('version', 1) == 1
            else str(value) for key, value in entries.items()}


def _save_cache(contract, entries: dict[str, str]) -> None:
    path = _cache_path(contract)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_text(json.dumps({"version": 2, "entries": entries}), encoding="utf-8")
        temporary.replace(path)
    except OSError:
        # 结论缓存丢了只是下次重扫一遍，不该让整轮任务失败。
        pass


def _key(asset_id: int, source: Path, stat=None) -> str:
    """和边车同一套身份：文件换了内容，旧结论就不再作数。`stat` 没给就在带期限的子进程里取。"""
    stat = media_io.file_stat(source) if stat is None else stat
    return f"{asset_id}-{stat.st_size}-{stat.st_mtime_ns}"


def _stat(worker: media_io.MountWorker, source: Path):
    return worker.call('stat', str(source))


def _top_level(worker: media_io.MountWorker, source: Path):
    """一部片的顶层盒子：用到时才读，一部片只读一次。"""
    found = []

    def read():
        if not found:
            found.append(worker.call('boxes', str(source)))
        return found[0]
    return read


def _library_filter(library: str) -> tuple[str, list]:
    condition, parameters = media_libraries.predicate(settings_file.active(), library)
    if condition == "0":
        raise UserValueError("api.mediaRepair.libraryNotFound")
    return condition, parameters


def _candidates(contract, scope: tuple[str, list]) -> list[tuple[int, str, float | None]]:
    """这个库里所有还在的 MP4，常看的排前面。"""
    condition, parameters = scope
    with contract.read_connection() as connection:
        rows = connection.execute(
            "SELECT a.id,a.path,a.duration FROM asset a "
            "WHERE a.path IS NOT NULL AND a.disposal IS NULL "
            f"AND {_MP4.format('a.')} AND {condition} "
            "ORDER BY a.play_count DESC, COALESCE(a.last_played,0) DESC, a.id",
            parameters).fetchall()
    return [(row["id"], row["path"], row["duration"]) for row in rows]


def _diagnose(contract, source: Path, duration: float | None, boxes, stat) -> str | None:
    """这部片缺的是什么；什么都不缺回 None。"""
    if (duration is None or duration < 0) and mp4recover.index_missing(boxes()):
        return INDEX
    return HEADER if contract.transcode_service.decode_order_timestamps(source, stat=stat) else None


def _survey(contract, job, job_id: str, rows, cache: dict[str, str]) -> list[tuple[int, str, str]]:
    """筛出需要修的那些。结论边判边进缓存，中途停下也不白读。"""
    store = contract.header_repairs
    found: list[tuple[int, str, str]] = []
    with media_io.MountWorker() as worker:
        for index, (asset_id, raw, duration) in enumerate(rows, start=1):
            if job.snapshot() is None:
                break
            source = translate_ledger_path(raw)
            try:
                stat = _stat(worker, source)
            except OSError:
                continue
            key = _key(asset_id, source, stat)
            if store.lookup(asset_id, source, stat=stat) is not None:
                _advance(job, job_id, index, skipped=True)
                continue
            boxes = _top_level(worker, source)
            kind = cache.get(key)
            if kind == LEGACY_UNAVAILABLE:
                try:
                    kind = None if mp4repair.tail_moov(boxes()) else UNAVAILABLE
                except OSError:
                    _advance(job, job_id, index, skipped=True)
                    continue
                if kind == UNAVAILABLE:
                    cache[key] = kind
                    _save_cache(contract, cache)
            if kind == UNAVAILABLE and store.has_invalid_sidecar(asset_id, source, stat=stat):
                kind = HEADER
            if kind in (CLEAN, UNAVAILABLE):
                _advance(job, job_id, index, skipped=True)
                continue
            if kind not in (HEADER, INDEX):
                try:
                    kind = _diagnose(contract, source, duration, boxes, stat)
                except OSError:
                    continue
            if kind:
                found.append((asset_id, raw, kind))
            cache[key] = kind or CLEAN
            _save_cache(contract, cache)
            if not job.checkpoint(job_id, survey_checked=index, survey_cache=dict(cache), survey_cache_version=2):
                raise UserInterruptedError("errors.webMediaRepair.scanStopped")
            _advance(job, job_id, index, skipped=False)
    return found


def _advance(job, job_id: str, checked: int, *, skipped: bool) -> None:
    with job.editing(job_id) as state:
        if state is None:
            return
        state["checked"] = max(state.get('checked', 0), checked)
        if skipped and checked > state.get('survey_checked', 0):
            state["skipped"] = state.get("skipped", 0) + 1
        state['survey_checked'] = max(state.get('survey_checked', 0), checked)
        saved = {key: state.get(key, 0) for key in ('checked', 'survey_checked', 'skipped')}
    if not job.checkpoint(job_id, **saved):
        raise UserInterruptedError("errors.webMediaRepair.scanStopped")


def _reference_candidates(contract, asset_id: int, raw: str) -> list[str]:
    """能当参照的：同一来源、上一级目录之下、探得出时长的 MP4。"""
    parent = PureWindowsPath(raw).parent
    scope = parent.parent if parent.parent != parent else parent
    prefix = str(scope).rstrip("\\") + "\\"
    with contract.read_connection() as connection:
        rows = connection.execute(
            "SELECT path FROM asset WHERE location=(SELECT location FROM asset WHERE id=?) "
            f"AND duration>0 AND disposal IS NULL AND {_MP4.format('')} "
            "AND substr(path,1,?)=? COLLATE NOCASE",
            (asset_id, len(prefix), prefix)).fetchall()
    return [row["path"] for row in rows]


def _record_replacement(contract, asset_id: int, source: Path, ffprobe: Path) -> None:
    """文件换了，账本跟着换：重新探时长与画面，大小和时间照扫描的口径刷新。

    115 的 SHA1 是按旧内容算的，留着会让查重把它和别的文件认成同一份，所以清掉等下次同步。
    """
    stat = media_io.file_stat(source)
    measured = media_probe.measure(str(ffprobe), asset_id, str(source))
    with contract.write_transaction() as connection:
        connection.execute(media_probe.UPDATE, measured)
        connection.execute(
            "UPDATE asset SET size=?,mtime=?,hash=NULL,hash_kind=NULL WHERE id=?",
            (stat.st_size, time.strftime("%Y-%m-%d", time.localtime(stat.st_mtime)), asset_id))
    contract.cache_bust()


def _recover(contract, worker: media_io.MountWorker, asset_id: int, raw: str,
             tools: tuple[Path, Path, Path]) -> bool:
    from .smb_media import resolve
    if resolve(raw) is not None:
        return False
    with contract.read_connection() as connection:
        row = connection.execute("SELECT location FROM asset WHERE id=?", (asset_id,)).fetchone()
    if row is None:
        return False
    untrunc, ffmpeg, ffprobe = tools
    source = translate_ledger_path(raw)
    references = [translate_ledger_path(path) for path in
                  mp4recover.pick_references(raw, _reference_candidates(contract, asset_id, raw))]
    work = Path(contract.transcode_root) / "recover" / str(asset_id)
    try:
        total = mp4recover.payload_size(worker.call('boxes', str(source)))
        recovery = mp4recover.recover(source, references, untrunc=untrunc, ffmpeg=ffmpeg,
                                      ffprobe=ffprobe, work=work, total=total)
        staged = _stage(worker, source, recovery.path)
        from .task_control import committing
        with committing():
            worker.call('swap', str(source), staged)
            _record_replacement(contract, asset_id, source, ffprobe)
    except (RepairUnavailable, OSError, subprocess.SubprocessError):
        return False
    finally:
        shutil.rmtree(work, ignore_errors=True)
    return True


def _stage(worker: media_io.MountWorker, source: Path, repaired: Path) -> str:
    """把修好的文件写到原片旁的临时名；写的时候能暂停、取消。没写完就把临时名删掉。"""
    try:
        return worker.call('stage', str(source), str(repaired), timeout=STAGE_IDLE_SECONDS, interruptible=True)
    except BaseException:
        try:
            worker.call('unstage', str(source))
        except OSError:
            # 挂载还卡着就留给下一次暂存覆盖：临时名是固定的。
            pass
        raise


def _recovery_tools(contract) -> tuple[Path, Path, Path] | None:
    untrunc = mp4recover.untrunc_path(contract.tools_root)
    resolver = contract.header_repairs.resolver
    ffmpeg, ffprobe = resolver.ffmpeg(), resolver.ffprobe()
    if untrunc is None or ffmpeg is None or ffprobe is None:
        return None
    return untrunc, ffmpeg.path, ffprobe.path


def _repair(contract, job, job_id: str, found, cache: dict[str, str]) -> None:
    """逐个修。一部片要整片读一遍，所以这里刻意不并发。"""
    store = contract.header_repairs
    tools = _recovery_tools(contract) if any(kind == INDEX for *_, kind in found) else None
    previous = job.snapshot() or {}
    job.update(job_id, **stage_fields('mediaRepair.repair'), checked=previous.get('repaired', 0),
               total=len(found) + previous.get('repaired', 0))
    with media_io.MountWorker() as worker:
        for index, (asset_id, raw, kind) in enumerate(found, start=1):
            if job.snapshot() is None:
                return
            source = translate_ledger_path(raw)
            if kind == HEADER:
                made = _rebuild_header(store, worker, asset_id, source)
            elif tools is not None:
                made = _recover(contract, worker, asset_id, raw, tools)
            else:
                # 缺的是工具不是片子：装上 untrunc 之后这部还该再试，所以不记结论。
                made = None
            if made is False:
                try:
                    cache[_key(asset_id, source, _stat(worker, source))] = UNAVAILABLE
                except OSError:
                    pass
            with job.editing(job_id) as state:
                if state is None:
                    return
                state["checked"] = previous.get('repaired', 0) + index
                state["repaired"] = state.get("repaired", 0) + (1 if made else 0)
                state["failed"] = state.get("failed", 0) + (0 if made else 1)
                state["missing_tool"] = state.get("missing_tool", 0) + (1 if made is None else 0)
                state["message"] = source.name[:80]
            _save_cache(contract, cache)
            state = job.snapshot() or {}
            if not job.checkpoint(job_id, **{key: state.get(key, 0) for key in
                                  ('checked', 'total', 'repaired', 'failed', 'missing_tool')}):
                raise UserInterruptedError("errors.webMediaRepair.repairStopped")


def _rebuild_header(store, worker: media_io.MountWorker, asset_id: int, source: Path) -> bool:
    """补一份时间戳表边车；片源的 stat 与片头都在带期限的子进程里读。"""
    try:
        stat = _stat(worker, source)
    except OSError:
        return False
    return store.repair_now(asset_id, source, stat=stat, read_layout=lambda path: worker.call(
        'layout', str(path), timeout=LAYOUT_SECONDS, interruptible=True))


def run_media_repair(contract, job_id: str, scope: tuple[str, list]) -> None:
    """一轮完整的批量修复。异常由 `BackgroundJob` 变成可轮询的失败状态。"""
    job = contract.media_repair_job
    cache = _load_cache(contract)
    previous = job.snapshot() or {}
    resumed_cache = previous.get('survey_cache') or {}
    if previous.get('survey_cache_version', 1) == 1:
        resumed_cache = {key: LEGACY_UNAVAILABLE if value == UNAVAILABLE else value
                         for key, value in resumed_cache.items()}
    cache.update(resumed_cache)
    rows = _candidates(contract, scope)
    job.update(job_id, **stage_fields('mediaRepair.scan'), total=len(rows), checked=previous.get('survey_checked', 0))
    found = _survey(contract, job, job_id, rows, cache)
    _save_cache(contract, cache)
    if job.snapshot() is None:
        return
    job.update(job_id, found=len(found))
    _repair(contract, job, job_id, found, cache)
    _save_cache(contract, cache)
    job.update(job_id, **stage_fields('mediaRepair.done'), status="complete", completed_at=time.time())


def _public(state: dict | None) -> dict:
    if state is None:
        return {"ok": True, "status": "idle", "job_id": "", "library": "", "stage": "",
                "checked": 0, "total": 0, "found": 0, "repaired": 0, "failed": 0, "missing_tool": 0}
    return {
        "ok": state["status"] != "failed",
        "status": state["status"],
        "job_id": state["job_id"],
        "library": state.get("library", ""),
        "stage": state.get("stage", ""),
        "checked": int(state.get("checked", 0)),
        "total": int(state.get("total", 0)),
        "found": int(state.get("found", 0)),
        "repaired": int(state.get("repaired", 0)),
        "failed": int(state.get("failed", 0)),
        "missing_tool": int(state.get("missing_tool", 0)),
        "skipped": int(state.get("skipped", 0)),
        "message": state.get("message", ""),
        **({key: state[key] for key in ("error", "error_code", "error_params") if key in state}
           if state["status"] == "failed" else {}),
    }


def q_media_repair(contract, args=None):
    return _public(contract.media_repair_job.snapshot())


def w_media_repair(contract, body=None):
    """启动一轮，或按 `stop` 停下正在跑的那一轮。"""
    body = body or {}
    job = contract.media_repair_job
    if body.get("stop") is True:
        job.stop(resume=False)
        return _public(job.snapshot())
    if body.get("status_only") is True:
        return _public(job.snapshot())
    if contract.header_repairs is None or contract.transcode_service is None:
        raise UserValueError("api.mediaRepair.repairUnavailable")
    library = str(body.get("library") or "")
    if not library:
        raise UserValueError("api.mediaRepair.libraryRequired")
    scope = _library_filter(library)
    return _public(job.start(
        lambda job_id: run_media_repair(contract, job_id, scope),
        initial={"library": library, **stage_fields('mediaRepair.scan'), "total": 0, "checked": 0, "found": 0,
                 "repaired": 0, "failed": 0, "missing_tool": 0, "skipped": 0, "message": ""},
        restart=body.get("restart") is True,
        recovery={'library': library, 'restart': True},
    ))
