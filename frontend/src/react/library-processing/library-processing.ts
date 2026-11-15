/* 扫描与采集的数据契约、轮询节律与纯折算。
 *
 * 数据管理页卡片、常驻任务面与缺预览提示读同一个 `queryKey`，使用同一份任务快照。
 * 轮询也由 Query 合成一份，进度、失败与完成状态由服务端统一提供。
 * 端点在 `frontend/src` 里只在这里声明一次（`tests/test_frontend_build.py` 盯着）。 */
import { apiGet } from '../../api';
import { withBackoff } from '../../polling';
import { elapsedText, progressText } from '../activity/tasks';
import { queryClient } from '../query';
import { joinList, quoted, t } from '../../i18n';
import { codedText, serverLabel, stageText } from '../../core/server-text';

export const LIBRARY_PROCESSING_URL = '/api/library-processing';

/** 卡片与常驻任务面共用这一个键。 */
export const LIBRARY_PROCESSING_KEY = ['library-processing'] as const;

/** 处理过程中记下的一条问题。`asset_id` 为空时说的是媒体来源本身。 */
export interface LibraryProcessingIssue {
  asset_id: number | null;
  title?: string;
  path?: string;
  message: string;
  /** `message` 的 code 与参数；有译文时显示译文，没有 code 的（异常原文、文件名）照原文。 */
  message_code?: string;
  message_params?: Record<string, unknown>;
  /** `paused` 是来源限流没轮到这一项，等来源放开再跑就有；`error` 是它自己出的事。 */
  severity?: 'info' | 'error' | 'paused';
}

/** 一趟扫描与采集的快照。字段以 `q_library_processing`（`src/peach/web_library_processing.py`）为准。 */
export interface LibraryProcessingData {
  library_id?: string | null;
  library_name?: string;
  metadata_only?: boolean;
  /** `idle` | `running` | `pausing` | `paused` | `stopping` | `cancelled` | `complete` | `failed`。 */
  status: string;
  /** 本轮各阶段已处理完但留有问题，或执行中断。 */
  outcome?: 'complete' | 'partial' | 'interrupted' | 'cancelled';
  archived?: boolean;
  new_asset_count?: number;
  /** 进行中这一轮在任务中心记的发起方式：`manual` | `scheduled` | `startup` | `cli`。 */
  trigger?: string;
  speed_mode?: ProcessingSpeed;
  eta_seconds_min?: number | null;
  eta_seconds_max?: number | null;
  eta_kind?: 'historical' | 'measured' | 'estimating';
  eta_scope?: string;
  eta_scope_code?: string;
  eta_initial?: boolean;
  job_id?: string;
  stage?: string;
  stage_code?: string;
  requested_stage?: string;
  /** `label` 是 zh-CN 原文，`label_code` 有译文时显示译文。 */
  steps?: { id: string; label: string; label_code?: string; status: 'pending' | 'current' | 'complete' }[];
  checked?: number;
  total?: number;
  scanned?: number;
  scanned_bytes?: number;
  identified?: number;
  candidates?: number;
  auto_applied?: number;
  covers?: number;
  previews?: number;
  /* 落库之后补齐女优资料那一步的四个读数：别名、头像、交回人工的冲突、没取到的头像。 */
  performer_aliases?: number;
  performer_avatars?: number;
  performer_profile_conflicts?: number;
  performer_profile_failed?: number;
  error?: string;
  /** `error` 的 code 与参数；有译文时显示译文。 */
  error_code?: string;
  error_params?: Record<string, unknown>;
  issue_count?: number;
  /** `issue_count` 里卡在来源限流上的那些，等来源放开再跑一次就有。 */
  paused_count?: number;
  issue_preview?: LibraryProcessingIssue[];
  issues_log?: string;
  issues_truncated?: boolean;
  retryable_asset_ids?: number[];
  notes?: Record<string, number>;
  current_asset_id?: number | null;
  current_asset_name?: string;
  current_action?: string;
  current_started_at?: number;
  /** 当前这一项正在等的外部来源；`network` 是它这次请求走的那条路。 */
  current_source?: { key: string; label: string; network?: string };
  skip_requested?: boolean;
  last_progress_at?: number;
  stalled?: boolean;
  waited_seconds?: number;
  completed_at?: number;
  traffic?: ProcessingTraffic;
}

export interface TrafficWorkload {
  video_files: number; jav_files: number; jav_titles: number;
  pending_jav_titles?: number; metadata_average_bytes?: number;
}
export interface TrafficSource {
  connection?: 'direct' | 'proxy' | 'system' | 'unknown';
  workload?: TrafficWorkload;
  estimated_bytes?: number;
  key: string; label: string; root: string; location: string; metered: boolean;
  used_bytes: number; estimated_min_bytes: number; estimated_max_bytes: number;
  unobserved: string[];
}
export interface ProcessingTraffic {
  disk?: {
    estimated_bytes: number; temporary_bytes: number; can_fit: boolean | null; cache_unknown: boolean;
    volumes: { path: string; labels: string[]; free_bytes: number | null; estimated_bytes: number;
      temporary_bytes: number; reserve_bytes: number | null; required_bytes: number | null;
      shortfall_bytes: number | null; can_fit: boolean | null }[];
  };
  unknown_route_estimated_bytes?: number;
  workload?: TrafficWorkload;
  inventory?: { complete: boolean; errors: number; token?: string };
  estimated_bytes?: number; metered_estimated_bytes?: number;
  used_bytes: number; estimated_min_bytes: number; estimated_max_bytes: number;
  metered_used_bytes: number; metered_estimated_min_bytes: number; metered_estimated_max_bytes: number;
  sources: TrafficSource[]; partial: boolean; unknown_files: boolean;
}

export const fetchProcessingEstimate = (command: LibraryProcessingCommand, signal?: AbortSignal, inventory?: string) => {
  const params = new URLSearchParams({ estimate: '1', stage: command.stage || 'all' });
  if (command.asset_ids) params.set('asset_ids', JSON.stringify(command.asset_ids));
  if (command.scope) params.set('scope', command.scope);
  if (command.library_id) params.set('library_id', command.library_id);
  if (command.incremental) params.set('incremental', '1');
  if (inventory) params.set('inventory', inventory);
  return apiGet<{ traffic: ProcessingTraffic }>(`${LIBRARY_PROCESSING_URL}?${params}`, signal);
};

/** 一次写操作的请求体：指定处理阶段与影片，或者按任务号重试失败项。 */
export type ProcessingSpeed = 'low' | 'standard' | 'high';
export interface LibraryProcessingCommand {
  library_id?: string;
  incremental?: boolean;
  scope?: 'new';
  stage?: 'scan' | 'collect' | 'previews' | 'metadata' | 'covers';
  asset_ids?: number[];
  job_id?: string;
  retry?: number[];
  speed_mode?: ProcessingSpeed;
}
export type ProcessingControlCommand =
  | { action: 'pause' | 'resume' | 'cancel' | 'archive' | 'unarchive'; job_id: string }
  | { action: 'set_speed'; speed_mode: ProcessingSpeed; job_id?: string }
  | { action: 'skip_current'; job_id: string; asset_id: number };

/** 单部影片问外部来源超过这么久，就把跳过与改走代理摆出来。 */
export const SLOW_ITEM_SECONDS = 120;
const SLOW_ACTIONS: Record<string, string> = { fetching_cover: t('manage:scanFetch.slowWhatCover'), querying_metadata: t('manage:scanFetch.slowWhatMetadata') };

export interface SlowItem { what: string; source?: LibraryProcessingData['current_source'] }

/** 跳过入口属于外部资料与封面采集，扫描和生成预览使用各自的任务控制。 */
export function slowItem(state?: LibraryProcessingData): SlowItem | null {
  if (state?.status !== 'running' || state.current_asset_id == null) return null;
  const what = SLOW_ACTIONS[state.current_action || ''];
  if (!what || (state.waited_seconds || 0) < SLOW_ITEM_SECONDS) return null;
  return { what, source: state.current_source };
}

export function slowItemText({ what, source }: SlowItem): string {
  return source?.label
    ? t('manage:scanFetch.slowItemFrom', { source: source.label, what })
    : t('manage:scanFetch.slowItemExternal', { what });
}

/** 暂停中的任务仍占用同一份处理范围，可继续并持续读取状态。 */
export const processingActive = (state?: LibraryProcessingData) =>
  !!state && ['running', 'pausing', 'paused', 'stopping'].includes(state.status);

export const processingHasPartialResult = (state?: LibraryProcessingData) =>
  state?.status === 'failed' && state.outcome === 'partial';

export const PARTIAL_RESULT_TEXT = t('manage:scanFetch.partialResult');
export const ALL_CONTENT_URL = '/?loc=&thumb=0';

/** 时间向分钟取整；区间两端始终使用同一单位。 */
export function remainingTime(state: LibraryProcessingData): string {
  if (!processingActive(state)) return '';
  if (state.status === 'stopping') return t('manage:scanFetch.stopping');
  if (state.status === 'paused') return t('manage:scanFetch.pausedEta');
  if (state.status === 'pausing') return t('manage:scanFetch.pausingEta');
  if (state.stalled) return t('manage:scanFetch.stalledEta');
  const low = state.eta_seconds_min, high = state.eta_seconds_max;
  if (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < low)
    return t('manage:scanFetch.estimatingEta');
  if (high < 60) return t('manage:scanFetch.underMinute');
  const unit = high >= 86400 ? 86400 : high >= 3600 ? 3600 : 60;
  const precision = unit === 60 ? 1 : 10;
  const start = Math.max(1 / precision, Math.floor(low / unit * precision) / precision);
  const end = Math.max(start, Math.ceil(high / unit * precision) / precision);
  const span = start === end ? `${end}` : `${start}–${end}`;
  const rough = state.eta_initial || state.eta_kind !== 'measured' ? t('manage:scanFetch.roughEstimate') : '';
  const key = unit === 86400 ? 'manage:scanFetch.etaDays' : unit === 3600 ? 'manage:scanFetch.etaHours' : 'manage:scanFetch.etaMinutes';
  return t(key, { count: end, span, rough, scope: state.eta_scope ? ` · ${serverLabel(state.eta_scope_code ?? '', state.eta_scope)}` : '' });
}

export const fetchLibraryProcessing = (signal?: AbortSignal) =>
  apiGet<LibraryProcessingData>(LIBRARY_PROCESSING_URL, signal);

/** 首屏。中止时 `fetchQuery` 把 `AbortError` 抛回挂载方，它据此放弃这一次。 */
export async function prefetchLibraryProcessing(signal: AbortSignal): Promise<void> {
  await queryClient.fetchQuery({
    queryKey: LIBRARY_PROCESSING_KEY,
    queryFn: () => fetchLibraryProcessing(signal),
  });
}

/** 在跑的时候两秒问一次，和别的后台任务同一个节律。闲着不问：后台自己起的那一趟由全站那一处
 *  读到的 `running_tasks` 带来（`LIBRARY_PROCESSING_TASK`），停靠栏据此重取一次再接上。 */
export const RUNNING_POLL_MS = 2000;
/** 任务中心登记这一种任务用的 `task_key`。 */
export const LIBRARY_PROCESSING_TASK = 'library-processing';

/** 读失败时页面上留的那句话。上一份数据不撤，下一轮轮询自己会接上。 */
export const DISCONNECTED_TEXT = t('manage:scanFetch.disconnected');

/** 任务的发起方式写进句子里用的说法；`TRIGGER_LABELS` 是任务中心列表的短标签，放进句子读不通。 */
const TRIGGER_PHRASES: Record<string, string> = {
  manual: t('manage:scanFetch.originManual'), scheduled: t('manage:scanFetch.originScheduled'), startup: t('manage:scanFetch.originStartup'), cli: t('manage:scanFetch.originCli'),
};

/** 保存媒体库设置会重启 Peach：在跑的这一轮会怎样，按它跑在哪个进程、是否已暂停分开说。
 * 命令行与托盘起的是独立的 `peach process` 进程，重载只停服务；服务内的任务由启动恢复接着跑，
 * 用户暂停的那一轮恢复时跳过。勾了「保存后扫描」的那一趟要等全库处理锁，排在后面。 */
export function restartEffectText(state: LibraryProcessingData, scanAfterSave: boolean): string {
  const effect = state.trigger === 'cli' ? t('manage:scanFetch.restartCli')
    : state.status === 'paused' ? t('manage:scanFetch.restartPaused')
    : t('manage:scanFetch.restartRunning');
  const queued = scanAfterSave
    ? t('manage:scanFetch.restartQueuedScan', { option: quoted(t('settings:mediaLibraries.scanAfterSave')) }) : '';
  return [t('manage:scanFetch.restartLead'), effect, queued].filter(Boolean).join(t('shell:format.sentenceGap'));
}

/** 已有任务在跑时点同步的回执，写明这一轮是怎么发起的。 */
export function busyText(state: LibraryProcessingData): string {
  const origin = TRIGGER_PHRASES[state.trigger || ''];
  return origin ? t('manage:scanFetch.busyOrigin', { origin }) : t('manage:scanFetch.busy');
}

/** 同一个键只由停靠栏一处驱动轮询，卡片与补全提示只读缓存。在跑两秒一次，失败退避，闲着不问。 */
export const pollInterval = withBackoff<LibraryProcessingData>((data) =>
  (processingActive(data) ? RUNNING_POLL_MS : false));

const ACTION_LABELS: Record<string, string> = {
  scanning_files: t('manage:scanFetch.actionScanning'),
  reading_local: t('manage:scanFetch.actionReadingLocal'),
  reading_local_cover: t('manage:scanFetch.actionReadingCover'),
  querying_metadata: t('manage:scanFetch.actionQuerying'),
  fetching_cover: t('manage:scanFetch.actionFetchingCover'),
  skipped: t('manage:taskSummary.skipped'),
  generating_preview: t('manage:scanFetch.actionPreviews'),
  writing_candidates: t('manage:scanFetch.actionCandidates'),
};

/* 来源说「没有」按类型报一个数，不进问题清单：馆藏里大量独立资源和创作者作品
   任何目录站都收不到，它们不是待办。键与 `library_processing.MISS_MESSAGES` 同源。 */
const NOTE_LABELS: Record<string, string> = {
  querying_metadata: t('manage:scanFetch.missNoMetadata'),
  fetching_cover: t('manage:scanFetch.missNoCover'),
};

export function notesLine(notes: Record<string, number>): string {
  const parts = Object.entries(notes)
    .filter(([key, count]) => NOTE_LABELS[key] && count > 0)
    .map(([key, count]) => t('manage:scanFetch.missCount', { label: NOTE_LABELS[key], count: count }));
  return parts.length ? t('manage:scanFetch.missNotes', { parts: joinList(parts) }) : '';
}

/** 此刻在做什么：哪个文件、哪一步、等了多久。 */
export function currentLine(state: LibraryProcessingData): string {
  if (state.status === 'paused') return t('manage:taskStatus.paused');
  if (state.status === 'pausing') return t('manage:taskStatus.pausing');
  const action = ACTION_LABELS[state.current_action || ''] || stageText(state) || t('manage:scanFetch.processing');
  const waited = state.waited_seconds ? t('manage:scanFetch.waited', { elapsed: elapsedText(state.waited_seconds) }) : '';
  return state.current_asset_name
    ? t('manage:scanFetch.currentLine', { file: state.current_asset_name, action, waited })
    : action + waited;
}

/** 已知总量显示实际完成数；扫描目录期间显示持续发现的文件数。 */
export function processingLine(state: LibraryProcessingData): string {
  const count = state.total ? t('manage:scanFetch.progressCount', { progress: progressText(state.checked, state.total) })
    : state.current_action === 'scanning_files' || state.stage_code === 'library.scanFiles'
      ? t('manage:scanFetch.filesFound', { count: state.scanned || 0 }) : '';
  return currentLine(state) + (count ? ` · ${count}` : '');
}

/** 折叠起来的问题清单：一句结论 + 逐条明细 + 完整日志的地址。没有问题时是 `null`。 */
export interface IssueDetails {
  label: string;
  items: { key: string; label: string; href: string; note: string; hint: string }[];
  /** 完整记录的本机路径，原样一串：前缀文字和打开它的那颗键归页面，那里才知道摆在哪。 */
  log: string;
}

export function issueDetails(state: LibraryProcessingData): IssueDetails | null {
  const issues = state.issue_preview || [];
  if (!issues.length) return null;
  return {
    label: state.issues_truncated
      ? t('manage:scanFetch.issuesTruncated', { count: state.issue_count || 0, shown: issues.length })
      : t('manage:scanFetch.issuesTotal', { count: state.issue_count || 0 }),
    items: issues.map((issue, at) => ({
      key: `${issue.asset_id ?? 'source'}-${at}`,
      label: issue.title || (issue.asset_id ? t('manage:scanFetch.issueVideo', { id: issue.asset_id }) : t('manage:shared.storage')),
      href: issue.asset_id ? `/assets/${issue.asset_id}` : '',
      note: codedText(issue, 'message'),
      hint: issue.path || '',
    })),
    log: state.issues_log || '',
  };
}

/* 完成用通知报一次。常驻任务面和数据管理页的卡片看的是同一个任务，谁先看到结束谁报，
   另一处按任务号认出来就不再报。首次引导添加文件夹后那一趟常在跳到目录页之前就跑完
   （一个文件一秒），任务面从没见过「运行中」，所以刚结束的任务第一次读到时也报。 */
const ANNOUNCED_KEY = 'peach.library-processing.announced';
const FRESH_COMPLETION_SECONDS = 120;

export function freshProcessingResult(state: LibraryProcessingData): boolean {
  const age = state.completed_at == null ? Infinity : Date.now() / 1000 - state.completed_at;
  return !!state.job_id && age >= 0 && age < FRESH_COMPLETION_SECONDS;
}

export function announceCompletion(
  state: LibraryProcessingData, toast: (message: string) => void, witnessed: boolean,
): void {
  if (state.status !== 'complete') return;
  if (!witnessed && !freshProcessingResult(state)) return;
  try {
    if (state.job_id && localStorage.getItem(ANNOUNCED_KEY) === state.job_id) return;
    if (state.job_id) localStorage.setItem(ANNOUNCED_KEY, state.job_id);
  } catch { /* 存储不可用时照常提示，最多重复一次 */ }
  if (state.requested_stage === 'previews') {
    toast(t('manage:scanFetch.previewsToast', { count: state.previews || 0 }));
    return;
  }
  if (state.requested_stage === 'covers') {
    toast(t('manage:scanFetch.coversToast', { count: state.covers || 0 }));
    return;
  }
  toast(t('manage:scanFetch.doneToast', { count: state.identified || 0, candidates: state.candidates || 0, autoApplied: state.auto_applied || 0 })
    + (state.previews ? t('manage:scanFetch.toastPreviewsTail', { count: state.previews }) : ''));
}
