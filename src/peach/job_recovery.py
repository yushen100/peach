"""将可重放任务的参数保存在本机，服务启动时只领取未完成的记录。"""
from __future__ import annotations

import json
import logging
import os
from contextvars import ContextVar
from pathlib import Path

from . import interface_text
from .fsutil import atomic_write_text
from .update_tasks import admission, state_for, UpdateBusy, _mutex

LOGGER = logging.getLogger(__name__)
current_run = ContextVar('peach_resuming_run', default=None)
current_job_id = ContextVar('peach_resuming_job_id', default=None)


def _path(db: Path, key: str) -> Path:
    if not key or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in key):
        raise ValueError("invalid job recovery key")
    return state_for(db).parent / "job-recovery" / (key + ".json")


def _worker_alive(db: Path, data: dict) -> bool:
    from .jobs import process_alive, process_matches
    pid = data.get('pid')
    if not isinstance(pid, int) or pid <= 0:
        return False
    run_id = data.get('run_id')
    if isinstance(run_id, int):
        from .task_runs import TaskRunStore
        run = TaskRunStore(db).get(run_id)
        if run is not None and (run.pid == pid or (run.pid == 0 and run.status == 'pending')):
            return process_matches(pid, run.heartbeat_at or run.started_at)
    return process_alive(pid)


def read(db: Path, key: str) -> dict:
    try:
        data = json.loads(_path(db, key).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        return {'status': 'blocked', 'error': interface_text.text('server:errors.jobRecovery.unreadable'),
                'error_code': 'errors.jobRecovery.unreadable'}


def _stopped() -> dict:
    """用户停止的那一轮写进任务行的原因（与 `processing_control` 的停止信号同一句）。"""
    return {'error': interface_text.text('server:errors.processingControl.userStopped'),
            'error_code': 'errors.processingControl.userStopped'}


def save(db: Path, key: str, job_id: str, request: dict, *, run_id=None, waiting=False) -> None:
    previous = read(db, key)
    atomic_write_text(_path(db, key), json.dumps({
        "job_id": job_id, "pid": -1 if waiting else os.getpid(), "status": "active",
        "request": request, 'run_id': run_id,
        'checkpoint': previous.get('checkpoint', {}) if previous.get('job_id') == job_id else {},
    }, ensure_ascii=False))


def checkpoint(db: Path, key: str, job_id: str, fields: dict) -> None:
    """结果落盘后保存进度；只更新同一任务的恢复记录。"""
    with _mutex(state_for(db)):
        data = read(db, key)
        if data.get('job_id') == job_id and data.get('status') == 'active':
            data['checkpoint'] = {**data.get('checkpoint', {}), **fields}
            atomic_write_text(_path(db, key), json.dumps(data, ensure_ascii=False))


def finish(db: Path, key: str, job_id: str, status: str) -> None:
    with _mutex(state_for(db)):
        data = read(db, key)
        if data.get("job_id") == job_id:
            data["status"] = status
            if isinstance(data.get('checkpoint'), dict) and data['checkpoint']:
                # 下次启动按进度快照恢复页面状态，快照的状态要与记录一起落到终态。
                data['checkpoint']['status'] = status
            atomic_write_text(_path(db, key), json.dumps(data, ensure_ascii=False))


def cancel(db: Path, key: str) -> None:
    with _mutex(state_for(db)):
        data = read(db, key)
        if data.get('run_id') is not None:
            from .task_runs import TaskRunStore
            TaskRunStore(db).finish(data['run_id'], 'cancelled', **_stopped())
        _path(db, key).unlink(missing_ok=True)


def waiting(db: Path, key: str, job_id: str) -> None:
    with _mutex(state_for(db)):
        data = read(db, key)
        if data.get('job_id') == job_id:
            data['pid'] = -1
            atomic_write_text(_path(db, key), json.dumps(data, ensure_ascii=False))


def request_pause(db: Path) -> None:
    """在安装事务内保留暂停意图，进程退出后仍能接回同一条任务。"""
    for path in (state_for(db).parent / 'job-recovery').glob('*.json'):
        data = read(db, path.stem)
        if data.get('status') == 'active':
            data['pause_requested'] = True
            atomic_write_text(path, json.dumps(data, ensure_ascii=False))


def reconcile_paused(db: Path) -> None:
    from .task_runs import TaskRunStore
    with _mutex(state_for(db)):
        for path in (state_for(db).parent / 'job-recovery').glob('*.json'):
            data = read(db, path.stem)
            if (data.get('status') == 'active' and data.get('pause_requested')
                    and not _worker_alive(db, data)):
                if data.get('run_id') is not None:
                    TaskRunStore(db).suspend(data['run_id'])
                waiting(db, path.stem, data['job_id'])


def _maybe_active(db: Path, key: str) -> bool:
    """无锁先看一眼：没有记录或记录已结束就不必取闸门锁。读不出来（替换瞬间的共享冲突）
    不算结束，交给持锁的那次重读。"""
    try:
        data = json.loads(_path(db, key).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return False
    except (OSError, ValueError):
        return True
    return not isinstance(data, dict) or data.get('status') == 'active'


def resume(db: Path, handlers: dict) -> list[str]:
    """领取与起跑在同一把锁内；失败保留参数但不循环重试。"""
    resumed = []
    for key, handler in handlers.items():
        if not _maybe_active(db, key):
            continue
        try:
            with admission(db):
                data = read(db, key)
                pid = data.get("pid")
                if key == 'library-processing':
                    from .processing_control import user_paused, user_cancelled
                    if user_paused(db, data.get('job_id')):
                        continue
                if (data.get("status") != "active" or not isinstance(data.get("request"), dict)
                        or _worker_alive(db, data)):
                    continue
                # 当前进程自己的新任务不属于启动恢复。
                if pid == os.getpid() and not isinstance(data.get('run_id'), int):
                    continue
                if key == 'library-processing' and user_cancelled(db, data.get('job_id')):
                    if data.get('run_id') is not None:
                        from .task_runs import TaskRunStore
                        TaskRunStore(db).finish(data['run_id'], 'cancelled', **_stopped())
                    finish(db, key, data['job_id'], 'cancelled')
                    continue
                try:
                    context = current_run.set(data.get('run_id'))
                    identity = current_job_id.set(data.get('job_id'))
                    try:
                        result = handler(data["request"])
                        if result is None and read(db, key) == data:
                            finish(db, key, data['job_id'], 'complete')
                            if data.get('run_id') is not None:
                                from .task_runs import TaskRunStore
                                TaskRunStore(db).finish(data['run_id'], 'succeeded')
                    finally:
                        current_run.reset(context)
                        current_job_id.reset(identity)
                except Exception as exc:
                    if data.get('run_id') is not None:
                        from .task_runs import TaskRunStore
                        TaskRunStore(db).finish(data['run_id'], 'failed', error=str(exc))
                    data.update(status="blocked", error=str(exc))
                    atomic_write_text(_path(db, key), json.dumps(data, ensure_ascii=False))
                    LOGGER.warning("Task %s could not be resumed: %s", key, exc)
                else:
                    resumed.append(key)
        except UpdateBusy:
            break
    return resumed


def legacy_library_request(db: Path) -> dict:
    """读取已在执行的馆藏处理范围，供安装助手承接已有状态文件。"""
    if read(db, 'library-processing').get('status') == 'active':
        return {}
    path = state_for(db).parent / 'library-processing.json'
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) and data.get('status') == 'running' else {}


def import_legacy_library(db: Path, previous: dict) -> None:
    if not previous or read(db, 'library-processing').get('status') == 'active':
        return
    path = state_for(db).parent / 'library-processing.json'
    try:
        latest = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        latest = previous
    if latest.get('status') == 'complete':
        return
    from .task_runs import TaskRunStore
    store = TaskRunStore(db)
    runs = store.query(status='active', task_key='library-processing', limit=1)
    run_id = runs[0].id if runs else None
    if run_id is not None:
        store.suspend(run_id)
    request = {'stage': previous.get('requested_stage') or 'all'}
    if previous.get('library_id'):
        request['library_id'] = previous['library_id']
    if previous.get('asset_ids'):
        request['asset_ids'] = previous['asset_ids']
    save(db, 'library-processing', previous.get('job_id') or 'library-processing',
         request, run_id=run_id, waiting=True)
