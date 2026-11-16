"""统一处理任务的启动、只读状态查询与失败项重试。"""
import json
import hashlib
import logging

from . import interface_text, settings_file
from .library_processing_scope import scoped_config, scoped_assets
from .library_processing import (ALL_STAGES, COLLECT_STAGE, COVERS_STAGE, SCAN_STAGE, STAGES,
                                METADATA_STAGE, PREVIEWS_STAGE, _asset_selection,
                                decorate, issues_path, process_library, snapshot)
from .processing_control import control_for, initial_estimate, valid_mode, mode_ratio
from .task_stages import stage as stage_fields
from .user_messages import UserValueError

ACTIVE = ('running', 'pausing', 'paused', 'stopping')
LOGGER = logging.getLogger(__name__)

#: 回给页面的状态字段：`frontend/src/react/library-processing/library-processing.ts` 的
#: `LibraryProcessingData`，加上对应任务中心那一行的 `run_id` 与发起方式 `trigger`。状态文件里另有续跑用的 `local_metadata`（带完整媒体路径）、
#: `asset_ids`、`completed_metadata` 等大字段，页面一个都不读；照发的话每页每 10 秒轮询一次
#: 就是两兆多，还把媒体路径交给了浏览器。续跑与重试读的是 `_current()`，不经过这里。
PUBLIC_FIELDS = frozenset({
    'library_id', 'library_name', 'run_id', 'metadata_only', 'status', 'outcome', 'speed_mode', 'eta_seconds_min', 'eta_seconds_max', 'eta_kind',
    'eta_scope', 'eta_scope_code', 'eta_initial', 'job_id', 'stage', 'stage_code', 'requested_stage', 'steps', 'checked', 'total',
    'scanned', 'scanned_bytes', 'identified', 'candidates', 'auto_applied', 'covers', 'previews',
    'performer_aliases', 'performer_avatars', 'performer_profile_conflicts',
    'performer_profile_failed', 'error', 'error_code', 'error_params', 'issue_count', 'paused_count', 'issue_preview',
    'issues_log', 'issues_truncated', 'retryable_asset_ids', 'notes', 'current_asset_id',
    'current_asset_name', 'current_action', 'current_started_at', 'last_progress_at', 'stalled',
    'waited_seconds', 'completed_at', 'current_source', 'skip_requested', 'archived', 'new_asset_count', 'trigger',
})


def public_state(state):
    """任务状态的页面投影：只留 `PUBLIC_FIELDS`。"""
    return {key: value for key, value in state.items() if key in PUBLIC_FIELDS}


def _current(contract):
    live = contract.library_processing_job.snapshot()
    thread = getattr(contract.library_processing_job, 'thread', None)
    if live and live.get('status') in ('cancelled', 'failed', 'complete') and thread is not None and thread.is_alive():
        return {**live, 'status':'stopping'}
    if live and live.get('status') in ACTIVE:
        return live
    stored = snapshot(settings_file.active())
    from .job_recovery import read
    recovery = read(contract.db_path, 'library-processing')
    if recovery.get('status') == 'active' and recovery.get('job_id') == stored.get('job_id'):
        stored['run_id'] = recovery.get('run_id')
    if live and live.get('job_id') == stored.get('job_id'):
        return {**stored, **live}
    if live and live.get('started_at', 0) > stored.get('started_at', 0):
        # 抢处理锁之前失败时还未写进度文件，不能再用上一轮终态遮住这次错误。
        return live
    return stored


def _active_run(contract, state):
    """进行中这一轮在任务中心的那一行。

    命令行那一轮没有恢复记录，状态里也就没有 `run_id`：按任务键找还在跑的那一行。
    """
    if state.get('run_id') is not None:
        return contract.task_runs.get(state['run_id'])
    if not getattr(contract.task_runs, 'enabled', True):
        return None
    runs = contract.task_runs.query(status='active', task_key='library-processing', limit=1)
    return runs[0] if runs else None


def _speed_fields(previous, mode):
    """切换档位时同步公开速度和估算范围。"""
    fields = dict(speed_mode=mode, eta_initial=True)
    if previous.get('speed_mode') != mode:
        ratio = mode_ratio(mode, previous.get('speed_mode') or 'standard')
        for key in ('eta_seconds_min', 'eta_seconds_max'):
            if isinstance(previous.get(key), (int, float)):
                fields[key] = max(0, int(previous[key] * ratio))
    return fields


def _project_speed(contract, state, run, control):
    """读取本轮档位及旧状态，空闲时展示下一轮待选值。"""
    previous_mode = state.get('speed_mode')
    if run is not None:
        from .task_control import speed_mode
        mode = speed_mode(contract.db_path, run.id, (run.parent_run_id, run.root_run_id),
                          default=previous_mode or control.mode)
    elif state.get('status') in ACTIVE:
        mode = control.mode
    else:
        from .processing_control import default_mode
        from .repository import LedgerDatabase
        mode = control.next_mode or default_mode(LedgerDatabase(contract.db_path))
    if state.get('status') in ACTIVE and previous_mode and previous_mode != mode:
        state.update(_speed_fields(state, mode))
    state['speed_mode'] = mode


def _estimate(contract, args):
    """按查询参数拼出与启动处理同形的请求，估算这一趟的联网流量，不启动任务。"""
    config = settings_file.active()
    body = {'stage': args.get('stage') or ALL_STAGES}
    if 'incremental' in args:
        body['incremental'] = args['incremental'] == '1'
    if 'scope' in args:
        body['scope'] = args['scope']
    if 'asset_ids' in args:
        body['asset_ids'] = json.loads(args['asset_ids'])
    if 'library_id' in args:
        body['library_id'] = args['library_id']
    config = scoped_config(config, body.get('library_id'))
    _, asset_ids, stage = _processing_request(contract, config, {}, body)
    from .processing_inventory import preview
    return {'traffic': preview(config, contract.db_path, stage, asset_ids, args.get('inventory'),
                               incremental=body.get('incremental', False), library_id=body.get('library_id'))}


def q_library_processing(contract, _args):
    if _args.get('estimate') == '1':
        return _estimate(contract, _args)
    state = _current(contract)
    run = _active_run(contract, state) if state.get('status') in ACTIVE else None
    if run is not None:
        # 忙碌回执要说清这一轮是谁发起的：托盘保存设置后起的扫描在网页上看不出来源。
        state['trigger'] = run.trigger
    if run is not None and state.get('run_id') is not None:
        from .task_control import projection
        control_state = projection(contract.task_runs, run)
        if control_state is not None:
            status = control_state['state']
            state['status'] = 'stopping' if status == 'cancelling' else status
    state = decorate(state)
    control = control_for(settings_file.active())
    control.refresh(force=True)
    _project_speed(contract, state, run, control)
    state['skip_requested'] = (state.get('status') == 'running' and state.get('current_asset_id') is not None
                               and control.skip_asset_id == state.get('current_asset_id'))
    from .media_processing_policy import metadata_only
    state['metadata_only'] = metadata_only(settings_file.active().directory('state'))
    from .job_recovery import read
    recovery = read(contract.db_path, 'library-processing')
    if control.job_id == state.get('job_id') and control.cancelled and state.get('status') in ACTIVE:
        state.update(status='stopping', eta_seconds_min=None, eta_seconds_max=None)
    if recovery.get('status') == 'cancelled' and recovery.get('job_id') == state.get('job_id'):
        state.update(status='cancelled', outcome='cancelled', error='')
    state['retryable_asset_ids'] = _remaining_retry_ids(contract, state)
    if _issues_all_removed(contract, state):
        state['archived'] = True
    from .library_new_assets import pending
    state['new_asset_count'] = len(pending(contract.db_path))
    if state.get('status') not in ACTIVE and recovery.get('status') == 'blocked':
        # 恢复记录带 code 时把原因嵌成同一语言的一句，旧记录只有原文。
        reason = ({"code": recovery['error_code'], "params": recovery.get('error_params') or {}}
                  if recovery.get('error_code') else recovery.get('error'))
        code, params = (("errors.webLibraryProcessing.recoveryFailed", {"reason": reason}) if reason
                        else ("errors.webLibraryProcessing.recoveryFailedRestart", {}))
        state.update(status='failed', outcome='interrupted', error=interface_text.text(f"server:{code}", params),
                     error_code=code, error_params=params)
    # 上一趟任务的状态文件里没有这个字段，而它那份完整清单还在磁盘上：按 job_id
    # 推出地址补回去，界面才有得可给。
    if state.get('issue_count') and state.get('job_id') and not state.get('issues_log'):
        path = issues_path(settings_file.active(), str(state['job_id']))
        if path.is_file():
            state['issues_log'] = str(path)
    return public_state(state)


def _request_skip(control, previous, body):
    asset_id = body.get('asset_id')
    if (isinstance(asset_id, bool) or not isinstance(asset_id, int)
            or previous.get('status') != 'running'
            or previous.get('current_asset_id') != asset_id
            or previous.get('current_action') not in ('querying_metadata', 'fetching_cover')):
        raise UserValueError('api.libraryProcessing.currentVideoChanged')
    control.skip_current(str(body['job_id']), asset_id)


def _archive_notice(contract, config, body, archived):
    """归档与撤销归档只翻这一趟的 `archived`，问题记录和任务历史原样留着。"""
    previous = _current(contract)
    if not body.get('job_id') or body['job_id'] != previous.get('job_id'):
        raise UserValueError('api.libraryProcessing.taskChanged')
    if previous.get('status') in ACTIVE:
        raise UserValueError('api.libraryProcessing.archiveAfterFinish')
    from .library_processing import _save, state_path
    saved = json.loads(state_path(config).read_text(encoding='utf-8'))
    if saved.get('job_id') != body['job_id']:
        raise UserValueError('api.libraryProcessing.taskChanged')
    _save(state_path(config), {**saved, 'archived':archived})
    return q_library_processing(contract, {})


def _cancel_processing(contract, config, control, previous, job_id):
    control.request('cancel', job_id)
    _announce_control(contract.library_processing_job, job_id, 'stopping')
    live = contract.library_processing_job.snapshot()
    thread = getattr(contract.library_processing_job, 'thread', None)
    if not (live and thread is not None and thread.is_alive()) and not _writer_active(config):
        from .job_recovery import finish
        from .library_processing import _save, state_path
        previous.update(status='cancelled', outcome='cancelled', **stage_fields('job.stopped'), error='')
        _save(state_path(config), previous)
        finish(contract.db_path, 'library-processing', job_id, 'cancelled')
        if previous.get('run_id') is not None:
            contract.library_processing_job.runs.finish(previous['run_id'], 'cancelled')
        contract.library_processing_job.update(job_id, **{
            key:value for key,value in previous.items() if key!='job_id'})
    return q_library_processing(contract, {})


def _set_processing_speed(contract, control, previous, body):
    mode = valid_mode(body.get('speed_mode'))
    run = _active_run(contract, previous) if previous.get('status') in ACTIVE else None
    if run is not None:
        from .task_control import request
        request(contract.task_runs, run.id, 'set_speed', mode=mode)
    elif previous.get('status') not in ACTIVE:
        control.select_next_mode(mode)
        return q_library_processing(contract, {})
    control.request('set_speed', mode=mode)
    if previous.get('status') in ACTIVE:
        contract.library_processing_job.update(previous['job_id'], **_speed_fields(previous, mode))
    return q_library_processing(contract, {})


def _control_action(contract, config, body):
    action = body['action']
    if action in ('archive', 'unarchive'):
        return _archive_notice(contract, config, body, action == 'archive')
    if action not in ('pause', 'resume', 'set_speed', 'skip_current', 'cancel'):
        raise UserValueError('api.libraryProcessing.actionInvalid')
    previous = _current(contract)
    job_id = body.get('job_id')
    if action != 'set_speed' and not job_id:
        raise UserValueError('api.libraryProcessing.taskRequired')
    if job_id and str(job_id) != str(previous.get('job_id') or ''):
        raise UserValueError('api.libraryProcessing.taskChanged')
    if action != 'set_speed' and previous.get('status') not in ACTIVE:
        raise UserValueError('api.libraryProcessing.noActiveTask')
    control = control_for(config)
    control.refresh(force=True)
    if job_id:
        control.select_job(str(job_id))
    if action == 'cancel':
        if previous.get('run_id') is not None:
            from .task_control import request
            request(contract.task_runs, previous['run_id'], action)
        return _cancel_processing(contract, config, control, previous, str(job_id))
    if previous.get('status') == 'stopping':
        raise UserValueError('api.libraryProcessing.waitingForStop')
    if action == 'skip_current':
        _request_skip(control, previous, body)
        return q_library_processing(contract, {})
    if action == 'set_speed':
        return _set_processing_speed(contract, control, previous, body)
    if previous.get('run_id') is not None:
        from .task_control import request
        request(contract.task_runs, previous['run_id'], action)
    status = ('paused' if previous.get('status') == 'paused' else 'pausing') if action == 'pause' else 'running'
    _announce_control(contract.library_processing_job, str(job_id), status)
    control.request(action, str(job_id))
    live = contract.library_processing_job.snapshot()
    thread = getattr(contract.library_processing_job, 'thread', None)
    if action == 'resume' and not (live and thread is not None and thread.is_alive()) and not _writer_active(config):
        from .job_recovery import read, current_job_id, current_run
        recovery = read(contract.db_path, 'library-processing')
        identity = current_job_id.set(str(job_id))
        run = current_run.set(recovery.get('run_id'))
        try:
            return w_library_processing(contract, _resume_request(previous, control.mode), resume=True)
        finally:
            current_job_id.reset(identity)
            current_run.reset(run)
    result = q_library_processing(contract, {})
    if not live and result.get('status') in ACTIVE:
        result['status'] = status
    return result


def _announce_control(job, job_id, status):
    with job.editing(job_id) as state:
        if state is not None and state.get('status') in ACTIVE:
            state['status'] = status


def _writer_active(config):
    from filelock import FileLock, Timeout
    from .library_processing import state_path
    try:
        with FileLock(str(state_path(config)) + '.lock', timeout=0):
            return False
    except Timeout:
        return True


def q_library_processing_issues(contract, args):
    state = _current(contract)
    job_id = str(args.get('job_id') or '')
    if not job_id or job_id != str(state.get('job_id') or ''):
        raise UserValueError('api.libraryProcessing.taskChanged')
    path = issues_path(settings_file.active(), job_id)
    if path.is_file():
        raw = path.read_text(encoding='utf-8')
        rows = [json.loads(line) for line in raw.splitlines() if line.strip()]
    else:
        rows = []
        if state.get('issue_count'):
            from .library_processing import state_path
            saved = json.loads(state_path(settings_file.active()).read_text(encoding='utf-8'))
            rows = saved.get('issues', [])
            if not rows:
                raise UserValueError('api.libraryProcessing.issuesUnavailable')
        raw = json.dumps(rows, ensure_ascii=False)
    revision = hashlib.sha256(raw.encode()).hexdigest()
    if args.get('revision') and args['revision'] != revision:
        raise UserValueError('api.libraryProcessing.issuesChanged')
    offset = max(0, int(args.get('offset') or 0))
    limit = max(1, min(200, int(args.get('limit') or 50)))
    return {'job_id': job_id, 'revision':revision, 'total': len(rows), 'offset': offset,
            'rows': rows[offset:offset + limit]}


def _remaining_retry_ids(contract, previous):
    ids = list(previous.get('retryable_asset_ids') or [])
    if not ids:
        return []
    remaining = set()
    with contract.database.read_connection() as connection:
        for offset in range(0, len(ids), 900):
            batch = ids[offset:offset+900]
            remaining.update(row[0] for row in connection.execute(
                'SELECT id FROM asset WHERE disposal IS NULL AND id IN ('+','.join('?'*len(batch))+')',batch))
    return [value for value in ids if value in remaining]


#: 问题日志 → (mtime_ns, 大小, 问题项的影片 id 或 None)。轮询每 10 秒一次，日志没变就不重读。
_ISSUE_ASSETS: dict = {}


def _issue_assets(path):
    """问题日志里每一条问题项（告知项不算）对应的影片；有一条不带影片就是 None。"""
    try:
        info = path.stat()
    except OSError:
        return None
    cached = _ISSUE_ASSETS.get(str(path))
    if cached is not None and cached[:2] == (info.st_mtime_ns, info.st_size):
        return cached[2]
    from .library_processing import _note_key
    ids = set()
    try:
        with path.open(encoding='utf-8') as handle:
            for line in handle:
                if not line.strip():
                    continue
                item = json.loads(line)
                if _note_key(item):
                    continue
                asset_id = item.get('asset_id')
                if isinstance(asset_id, bool) or not isinstance(asset_id, int):
                    ids = None
                    break
                ids.add(asset_id)
    except (OSError, ValueError, AttributeError):
        ids = None
    _ISSUE_ASSETS.clear()
    _ISSUE_ASSETS[str(path)] = (info.st_mtime_ns, info.st_size, ids)
    return ids


def _issues_all_removed(contract, state):
    """跑完、留有问题的那一趟，问题影片都已不在馆藏（删掉、进回收站或标「已消失」）时为真。

    资源同步清掉失效条目后，那一趟的红框和悬浮提示就不该再要人处理：读状态时现算，
    不改状态文件，问题日志原样留着；条目从回收站还原了，提示也跟着回来。来源离线时
    账本不动，这里不会把「盘没挂上」当成「文件删了」。有一条问题不对应影片（准备工具失败、
    预算到顶的汇总）就不算。"""
    if (state.get('archived') or state.get('status') != 'failed' or state.get('outcome') != 'partial'
            or not state.get('issue_count') or not state.get('job_id')):
        return False
    from pathlib import Path
    path = Path(state['issues_log']) if state.get('issues_log') else issues_path(
        settings_file.active(), str(state['job_id']))
    ids = _issue_assets(path)
    if not ids:
        return False
    ids = sorted(ids)
    with contract.database.read_connection() as connection:
        for offset in range(0, len(ids), 900):
            batch = ids[offset:offset + 900]
            if connection.execute('SELECT 1 FROM asset WHERE disposal IS NULL AND id IN ('
                                  + ','.join('?' * len(batch)) + ') LIMIT 1', batch).fetchone():
                return False
    return True


def _retry_ids(previous, body):
    """请求带 `retry` 时按上一任务的失败集合重试；普通启动仍处理整个馆藏。

    返回 `None` 表示全量任务；返回列表表示只处理这些资产。空列表由调用方
    按「没有可重试项」处理，不允许滑回全库重跑。
    """
    if not body or 'retry' not in body:
        return None
    job_id = str(body.get('job_id') or '')
    if not job_id or job_id != str(previous.get('job_id') or ''):
        raise UserValueError('api.libraryProcessing.originalTaskChanged')
    requested = body.get('retry')
    if not isinstance(requested, list):
        raise UserValueError('api.libraryProcessing.retryItemsInvalid')
    allowed = list(previous.get('retryable_asset_ids') or [])
    if not requested:
        return allowed
    chosen = []
    for value in requested:
        if isinstance(value, bool) or not isinstance(value, int) or value not in allowed:
            raise UserValueError('api.libraryProcessing.retryItemNotFailed')
        chosen.append(value)
    return chosen


def _expand_new_scope(db_path, body):
    """校验增量发现与待补全集合的互斥关系，并冻结已登记的范围。"""
    if 'incremental' in body:
        if type(body['incremental']) is not bool:
            raise UserValueError('api.libraryProcessing.incrementalNotBoolean')
        if body['incremental'] and any(key in body for key in ('asset_ids', 'retry', 'scope')):
            raise UserValueError('api.libraryProcessing.incrementalExclusive')
    if 'scope' in body:
        if body['scope'] != 'new' or 'asset_ids' in body or 'retry' in body:
            raise UserValueError('api.libraryProcessing.newScopeExclusive')
        from .library_new_assets import pending
        ids = pending(db_path)
        if not ids:
            raise UserValueError('api.libraryProcessing.noNewVideos')
        body['asset_ids'] = ids


def _processing_request(contract, config, previous, body):
    """校验馆藏、阶段与互斥的处理范围。"""
    if not config.configured or not config.locations:
        raise UserValueError('api.libraryProcessing.addMediaDirectory')
    if contract.db_path.resolve() != (config.directory('database') / 'ledger.db').resolve():
        raise UserValueError('api.libraryProcessing.collectionConfigMismatch')
    body = dict(body or {})
    _expand_new_scope(contract.db_path, body)
    retry_ids = _retry_ids(previous, body)
    if 'asset_ids' in (body or {}) and body['asset_ids'] is None:
        raise UserValueError('api.libraryProcessing.selectionInvalid')
    asset_ids = _asset_selection(contract.db_path, (body or {}).get('asset_ids'))
    if asset_ids is not None and retry_ids is not None:
        raise UserValueError('api.libraryProcessing.selectionRetryExclusive')
    stage = str((body or {}).get('stage') or
                (previous.get('requested_stage') if retry_ids is not None else None) or ALL_STAGES)
    if stage not in STAGES:
        raise UserValueError('api.libraryProcessing.stageInvalid')
    if body.get('incremental') and stage not in (ALL_STAGES, SCAN_STAGE):
        raise UserValueError('api.libraryProcessing.incrementalStageUnsupported')
    from .media_processing_policy import metadata_only
    if stage == PREVIEWS_STAGE and metadata_only(config.directory('state')):
        raise UserValueError('api.libraryProcessing.previewsDisabled')
    return retry_ids, asset_ids, stage


def _resume_request(previous, speed_mode):
    """继续一趟暂停的任务：照原任务的阶段、媒体库、范围与流量保护授权重发，不另起范围。"""
    return {
        'stage': previous.get('requested_stage') or ALL_STAGES,
        'library_id': previous.get('library_id'),
        **({'incremental': True} if previous.get('incremental') else
           {'asset_ids': previous['asset_ids']} if previous.get('asset_ids') else {}),
        **({'allow_metered': True} if previous.get('allow_metered') else {}),
        **({'recheck': True} if previous.get('recheck') else {}),
        'speed_mode': speed_mode,
    }


#: 一次「重新采集」最多点名几部。它绕过来源快照逐站重问，是给详情页那一部（或少数几部）用的，
#: 整库重问走升级补修的分批派发。
RECHECK_LIMIT = 20


def _recheck_grant(body, stage, asset_ids):
    """点名的几部片重新采集资料：不复用来源快照、已有字段也按来源再核一遍（#208）。

    快照里的乱码与过时资料只能这样换掉；用户改过、复核批准过的字段归属受保护，重采不覆盖。
    只接受显式点名的影片与资料阶段，整库同步不接受这个开关。
    """
    granted = (body or {}).get('recheck', False)
    if type(granted) is not bool:
        raise UserValueError('api.libraryProcessing.recheckNotBoolean')
    if granted and (stage not in (METADATA_STAGE, COLLECT_STAGE) or not asset_ids
                    or len(asset_ids) > RECHECK_LIMIT):
        raise UserValueError('api.libraryProcessing.recheckSelectedOnly', {'limit': RECHECK_LIMIT})
    return granted


def _metered_grant(body, stage, asset_ids):
    """开了流量保护的目录只在人点名的影片上、只为抽帧读：整库同步与资料采集都不接受这个授权。"""
    granted = (body or {}).get('allow_metered', False)
    if type(granted) is not bool:
        raise UserValueError('api.libraryProcessing.meteredGrantNotBoolean')
    if granted and (stage != PREVIEWS_STAGE or asset_ids is None):
        raise UserValueError('api.libraryProcessing.meteredGrantPreviewsOnly')
    return granted


def retry_after_network_recovery(contract, sync=None):
    """外网判回联网时，上一趟因断网跳过的外部资料自动补一次，等于替人点「立即重试」。

    只认最近一趟以失败收尾、记过断网跳过（`offline_skipped`）且还有可重试项的；只是别的原因
    失败的不碰。任务还在跑时回 `False`，探测器据此把这次恢复留到下一次判回联网再通知：断网
    那一趟可能正在收尾。只读端（`sync.read_only`）不发起，路由层会拒的写入从探测线程绕进来也不该做。
    由 `NetworkReachability.on_recovered` 在探测线程里调，这里的任何异常都只记日志。
    """
    if sync is not None and sync.read_only:
        return None
    try:
        previous = _current(contract)
        if previous.get('status') in ACTIVE:
            return False
        if (previous.get('status') != 'failed' or not previous.get('offline_skipped')
                or not previous.get('retryable_asset_ids')):
            return None
        return w_library_processing(contract, {'job_id': previous.get('job_id'), 'retry': []})
    except Exception:
        LOGGER.warning('Automatic retry of unfinished items after the network came back failed', exc_info=True)
        return None


def _initial_speed(contract, control, previous, body, *, resume):
    """恢复沿用任务及旧记录的档位，新任务消费显式选择、待选值或默认值。"""
    from .processing_control import default_mode
    from .repository import LedgerDatabase
    control.refresh(force=True)
    if resume:
        run = _active_run(contract, previous)
        if run is not None:
            from .task_control import speed_mode
            return speed_mode(contract.db_path, run.id, (run.parent_run_id, run.root_run_id),
                              default=previous.get('speed_mode') or (body or {}).get('speed_mode') or control.mode)
        return valid_mode(control.mode)
    return valid_mode((body or {}).get('speed_mode') or control.next_mode
                      or default_mode(LedgerDatabase(contract.db_path)))


def _scoped_processing_request(contract, config, previous, body, resume):
    """冻结媒体库范围，拒绝重试换库与跨库的显式资产选择。"""
    library_id = (body or {}).get('library_id')
    if resume or (body or {}).get('retry') is not None:
        previous_library = previous.get('library_id')
        if library_id is not None and library_id != previous_library:
            raise UserValueError('api.libraryProcessing.libraryMustMatch')
        library_id = previous_library
    config = scoped_config(config, library_id)
    retry_ids, asset_ids, stage = _processing_request(contract, config, previous, body)
    if library_id and asset_ids is not None:
        selected = scoped_assets(config, contract.db_path, library_id, asset_ids)
        if (body or {}).get('scope') != 'new' and set(selected) != set(asset_ids):
            raise UserValueError('api.libraryProcessing.videoOutsideLibrary')
        if not selected:
            raise UserValueError('api.libraryProcessing.libraryNoPending')
        asset_ids = selected
    return config, library_id, retry_ids, asset_ids, stage


def w_library_processing(contract, body, *, resume=False):
    config = settings_file.active()
    if (body or {}).get('action'):
        return _control_action(contract, config, body)
    previous = _current(contract)
    if previous.get('status') in ACTIVE and not resume:
        return public_state(previous)
    if (body or {}).get('retry') is not None:
        previous['retryable_asset_ids'] = _remaining_retry_ids(contract, previous)
    config, library_id, retry_ids, asset_ids, stage = _scoped_processing_request(
        contract, config, previous, body, resume)
    incremental = (body or {}).get('incremental', False)
    allow_metered = _metered_grant(body, stage, asset_ids)
    recheck = _recheck_grant(body, stage, asset_ids)
    if (body or {}).get('scope') == 'new':
        from .library_new_assets import remember
        remember(contract.db_path, asset_ids)
    if retry_ids is not None and not retry_ids:
        return public_state(previous)
    control = control_for(config)
    mode = _initial_speed(contract, control, previous, body, resume=resume)
    control.request('set_speed', mode=mode)
    def work(job_id):
        try:
            result = process_library(config, contract.db_path, contract.candidate_root, contract.cover_root,
                job_id=job_id, retry_ids=retry_ids, stage=stage, asset_ids=asset_ids, incremental=incremental, library_id=library_id,
                allow_metered=allow_metered, recheck_existing=recheck,
                # 自动落库与页面写的是同一个 `LedgerDatabase`：进程内写锁在实例上，
                # 另建一个就是在同一个进程里开第二条写入路径。
                database=contract.database,
                resume_state=previous if resume else None,
                speed_mode=control_for(config).mode,
                network=getattr(contract, 'network_reachability', None),
                active=lambda:(contract.library_processing_job.snapshot() or {}).get('job_id') == job_id,
                report=lambda state: contract.library_processing_job.update(job_id, **{
                    key: value for key, value in state.items() if key != 'job_id'}))
            contract.library_processing_job.update(job_id, **{key: value for key, value in result.items() if key != 'job_id'})
        finally:
            contract.cache_bust()
    # 起步那行字按这一趟真正要做的事写：点了「只扫描」却看到「读取本地资料」，
    # 人会以为点错了。
    labels = {ALL_STAGES: 'library.startAll', SCAN_STAGE: 'library.startScan', COLLECT_STAGE: 'library.startCollect',
              METADATA_STAGE: 'library.startCollect', COVERS_STAGE: 'library.fetchCovers',
              PREVIEWS_STAGE: 'library.startPreviews'}
    estimate_ids = asset_ids if asset_ids is not None else retry_ids
    if incremental:
        from .library_new_assets import pending
        estimate_ids = pending(contract.db_path)
    estimate_ids = scoped_assets(config, contract.db_path, library_id, estimate_ids)
    library_name = config.library_catalog.get(library_id, {}).get('name', '')
    result = contract.library_processing_job.start(
        work, restart=True, initial={**stage_fields(labels[stage]), 'requested_stage': stage,
                                    'library_id': library_id, 'library_name': library_name,
                                    **({'allow_metered': True} if allow_metered else {}),
                                    **({'recheck': True} if recheck else {}),
                                    **initial_estimate(config, contract.db_path, stage, estimate_ids, mode,
                                                       allow_metered=allow_metered)},
        recovery={'stage': stage, 'speed_mode': mode, 'incremental': incremental, 'library_id': library_id,
                  **({'allow_metered': True} if allow_metered else {}),
                  **({'recheck': True} if recheck else {}),
                  **({'asset_ids': asset_ids or retry_ids}
                                    if asset_ids is not None or retry_ids is not None else {})})
    if not resume:
        control.select_next_mode(None)
    return public_state(result)
