/* 任务中心的数据契约与折算：`/api/tasks` 一次请求供整页三段使用。
 *
 * 分三次取会出现「在跑那段是新的、完成那段是旧的」这种自相矛盾的一屏，所以只有一个
 * queryKey。首屏由 `prefetchTasks` 写进 Query 缓存，组件挂上去读的就是它。 */
import { apiGet, apiSend } from '../../api';
import { fmtSize } from '@peach/legacy/core';
import { requestErrorMessage } from '../../core/request-error';
import { codedText, partsLabel, partsText, serverLabel, stageText, type TextPart } from '../../core/server-text';
import { queryClient } from '../query';
import type { ProcessingSpeed } from '../library-processing/library-processing';
import { interfaceLanguage, t } from '../../i18n';

export const TASKS_URL = '/api/tasks';
/** 整页共用这一个键：三段是同一次响应的三个字段。 */
export const TASKS_KEY = ['tasks'] as const;

export type TaskControlAction = 'pause' | 'resume' | 'cancel';
export type TaskControlState = 'running' | 'pausing' | 'paused' | 'cancelling';
export type TaskResourceState = 'ready' | 'sampling' | 'unavailable';
/** `via` 只出现在未取得的网络读数上：`cloud` 是从网盘挂载读的，网速无法按任务计量。 */
export interface TaskResourceMetric { state: TaskResourceState; high: boolean; reason?: string; via?: 'cloud' }
export interface TaskPercentMetric extends TaskResourceMetric { percent: number | null }
export interface TaskResourcesPayload {
  cpu: TaskPercentMetric;
  gpu: TaskPercentMetric;
  network: TaskResourceMetric & { bytes_per_second: number | null };
  sampled_at: string;
}

export interface TaskRunPayload {
  id: number;
  task_key: string;
  task_label: string;
  trigger: string;
  status: string;
  host: string;
  started_at: string | null;
  finished_at: string | null;
  elapsed_seconds: number | null;
  progress_current: number | null;
  progress_total: number | null;
  progress_label: string;
  /** `progress_label` 与 `error` 的 code 和参数（ADR-0156 第三条）；旧行没有。 */
  progress_code?: string;
  progress_params?: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  error: string;
  error_code?: string;
  error_params?: Record<string, unknown>;
  /** 派出这一轮的父任务；不是后继时为 null（ADR-0040）。 */
  parent_run_id: number | null;
  root_run_id: number | null;
  /** 这条后继要做的那件事的全名。不是后继时是空串，界面据此判断它挂不挂到父卡片下。 */
  followup_key: string;
  followup_depth: number;
  /** 服务端给出当前控制状态与可用动作，界面不按任务种类推断。 */
  control?: { state: TaskControlState; actions: (TaskControlAction | 'set_speed')[]; speed_mode?: ProcessingSpeed };
  /** 只投影可归属的实测读数；缺失字段代表该快照未提供资源采样。 */
  resources?: TaskResourcesPayload;
}

export interface ActivityData {
  finished_total?: number;
  finished_page?: number;
  available: boolean;
  result_versions?: Record<string, string>;
  message?: string;
  running: TaskRunPayload[];
  skipped: TaskRunPayload[];
  finished: TaskRunPayload[];
  /** 「最近完成」这一页后面还有更早的。 */
  finished_has_more?: boolean;
  /** 自己已结束、后继还在排或在跑的父任务里，不在 `running` 与 `finished` 这一页上的那些。 */
  working_parents?: TaskRunPayload[];
  /** 父任务 id → 它直接派出的后继按状态各几条。下发的后继只是一部分，进度与「还在不在跑」看这份。 */
  followup_counts?: FollowupCounts;
  /** 逐部到来的入库通知：云下载整理完成、推送发现登记的新影片。`epoch` 换了表示服务重启过。 */
  ingest_notices?: { epoch: string; items: IngestNotice[] };
}

export interface IngestNotice { id: number; kind: 'download' | 'discovered'; asset_id: number; label: string; at: number }

export type FollowupCounts = Record<string, Record<string, number>>;

/** 几轮派出的后继合在一起数：共几条、结束了几条、还有几条在排或在跑。 */
export function followupTally(counts: FollowupCounts | undefined, runs: TaskRunPayload[]) {
  let total = 0, active = 0, failed = 0, cancelled = 0;
  for (const run of runs) {
    for (const [status, count] of Object.entries(counts?.[String(run.id)] || {})) {
      total += count;
      if (status === 'pending' || status === 'running') active += count;
      if (status === 'failed' || status === 'interrupted') failed += count;
      if (status === 'cancelled') cancelled += count;
    }
  }
  return { total, active, failed, cancelled, settled: total - active };
}

/** 同一种任务连着派出的几轮合成一件事：自动修复每分钟派一批，一屏十几张「已完成」卡说的是同一件事。
 *  每组按最新那一轮排在前面，`runs[0]` 是最新那一轮。`split` 再按它的值分组，同一种任务值不同的分开。 */
export function foldByKind(rows: TaskRunPayload[], split: (run: TaskRunPayload) => string = () => ''): RunFold[] {
  const folds = new Map<string, RunFold>();
  for (const run of rows) {
    const key = `${run.task_key}\u0000${split(run)}`;
    const fold = folds.get(key);
    if (fold) fold.runs.push(run);
    else folds.set(key, { run, runs: [run] });
  }
  return [...folds.values()];
}

/** 任务中心有东西在跑就两秒一次（和进度写库的节流同一个数），全是终态时十秒一次；读失败按 `withBackoff` 退避。 */
export const RUNNING_POLL_MS = 2000;
export const SETTLED_POLL_MS = 10000;
export const pollInterval = (data: ActivityData | undefined): number =>
  data?.running?.length ? RUNNING_POLL_MS : SETTLED_POLL_MS;

/** 全站那一处（`/api/result-updates`）有任务时五秒一次：结果版本在任务期间本就每 30 秒才放出一次
 *  （`web_tasks.RESULT_UPDATE_INTERVAL`），再密只是重复读到同一份。闲着时十秒一次，是全站唯一的心跳。 */
export const RESULT_BUSY_POLL_MS = 5000;
export const RESULT_IDLE_POLL_MS = SETTLED_POLL_MS;

export const fetchTasks = (signal?: AbortSignal, page = 1, limit = 20) =>
  apiGet<ActivityData>(page === 1 && limit === 20 ? TASKS_URL : `${TASKS_URL}?page=${page}&limit=${limit}`, signal);

/** 每个页面常驻轮询的那一小份：结果版本、入库通知与在排在跑的任务（`running_tasks`）。完整任务列表只给任务中心。 */
export { fetchResultUpdates, RESULT_UPDATES_KEY, type ResultUpdatesPayload as ResultUpdatesData } from '../../running-tasks';

export const controlTask = (id: number, action: TaskControlAction, signal?: AbortSignal) =>
  apiSend(`${TASKS_URL}/${id}/control`, { action }, 'POST', signal);

export const setTaskSpeed = (id: number, speed: ProcessingSpeed) =>
  apiSend(`${TASKS_URL}/${id}/control`, { action: 'set_speed', speed_mode: speed }, 'POST');

/** 首屏：取完数才画。中止时 `fetchQuery` 把 `AbortError` 抛回给挂载方，它据此放弃这一次。 */
export async function prefetchTasks(signal: AbortSignal): Promise<void> {
  await queryClient.fetchQuery({ queryKey: TASKS_KEY, queryFn: () => fetchTasks(signal) });
}

export const TRIGGER_LABELS: Record<string, string> = {
  manual: t('manage:taskTrigger.manual'), scheduled: t('manage:taskTrigger.scheduled'), startup: t('manage:taskTrigger.startup'), cli: t('manage:taskTrigger.cli'),
};

const STATUS_LABELS: Record<string, string> = {
  pending: t('manage:taskStatus.queued'), running: t('manage:taskStatus.running'), succeeded: t('manage:taskStatus.completed'),
  failed: t('manage:shared.failed'), cancelled: t('manage:shared.canceled'), interrupted: t('manage:taskStatus.interrupted'),
};

/** 状态的中文名。表里的状态集是封闭的，认不出来只可能是表先改了，那就原样显示。 */
export const statusLabel = (status: string): string => STATUS_LABELS[status] || status;

/* 主摘要使用已定义的中文字段；原始状态字典由技术详情保留。 */
const SUMMARY_LABELS: Record<string, string> = {
  checked: t('manage:taskSummary.checked'), total: t('manage:taskSummary.total'), scanned: t('manage:taskSummary.scanned'), identified: t('manage:taskSummary.recognized'),
  candidates: t('manage:taskSummary.metadata'), covers: t('manage:taskSummary.covers'), changed: t('manage:taskSummary.changed'), operation: t('manage:taskSummary.operation'),
  ok: t('manage:taskSummary.found'), miss: t('manage:shared.notFound'), kept: t('manage:taskSummary.kept'), planned: t('manage:taskSummary.planned'), done: t('manage:taskSummary.processed'), added: t('manage:taskSummary.added'),
  written: t('manage:taskSummary.saved'), removed: t('manage:taskSummary.removed'), issue_count: t('manage:backgroundIssues.title'),
  followups_duplicate: t('manage:taskSummary.followupsDuplicate'), followups_truncated: t('manage:taskSummary.followupsTruncated'),
  followups_depth_exceeded: t('manage:taskSummary.followupsTooDeep'), name: t('manage:shared.name'),
  matched: t('manage:taskSummary.matched'), size: t('manage:taskSummary.size'), source: t('manage:taskSummary.source'), cover_network: t('manage:taskSummary.coverNetwork'),
  probed: t('manage:taskSummary.probed'), previews: t('manage:taskSummary.previews'), paused_count: t('manage:taskSummary.pausedCount'),
  auto_applied: t('manage:taskSummary.autoApplied'), auto_rejected: t('manage:taskSummary.autoRejected'), performer_avatars: t('manage:taskSummary.actressAvatars'),
  performer_profile_failed: t('manage:taskSummary.actressFetchFailed'), performer_aliases: t('manage:taskSummary.actressAliases'),
  performer_profile_conflicts: t('manage:taskSummary.actressToReview'), conflicts: t('manage:taskSummary.conflictsToReview'),
  gone_count: t('manage:taskSummary.deadLinks'), unclear_count: t('manage:taskSummary.unreachableLinks'),
  source_failed: t('manage:taskSummary.sourceCheckFailed'), source_warning: t('manage:taskSummary.sourceRecheckFailed'),
  resolve_failed: t('manage:taskSummary.lookupFailed'), sources_found: t('manage:taskSummary.sourcesFound'),
  warning_count: t('manage:taskSummary.warnings'), profiles_checked: t('manage:taskSummary.browserProfilesRead'),
  missing: t('manage:taskSummary.missingFiles'), purge: t('manage:taskSummary.recordsToDelete'), vanish: t('manage:taskSummary.recordsToKeep'),
  empty: t('manage:taskSummary.emptyDirectories'), unreadable: t('manage:taskSummary.unreadable'), cache_files: t('manage:taskSummary.cacheFiles'),
  cache_bytes: t('manage:taskSummary.cacheSize'), bytes_reclaimed: t('manage:taskSummary.spaceFreed'),
  cache_removed: t('manage:taskSummary.cacheCleaned'), cache_blocked_count: t('manage:taskSummary.cacheCleanupFailed'), files_removed: t('manage:taskSummary.filesDeleted'),
  purged: t('manage:taskSummary.recordsDeleted'), vanished: t('manage:taskSummary.markedMissing'), reattached: t('manage:taskSummary.recordsTransferred'),
  blocked_count: t('manage:taskSummary.recordsNotDeleted'), dirs_removed: t('manage:taskSummary.emptyDirsDeleted'), dir_errors: t('manage:taskSummary.directoryCleanupFailed'),
  marked: t('manage:taskSummary.markedDead'), recovered: t('manage:taskSummary.recovered'), entities: t('manage:taskSummary.entities'),
  found: t('manage:taskSummary.filesToRepair'), repaired: t('manage:taskSummary.repaired'), failed: t('manage:shared.failed'), missing_tool: t('manage:taskSummary.missingTool'),
  moved: t('manage:taskSummary.filesOrganized'), restored: t('manage:taskSummary.restored'), skipped: t('manage:taskSummary.skipped'), made: t('manage:taskSummary.previewsGenerated'),
  fetched: t('manage:taskSummary.metadataFetched'), updated: t('manage:taskSummary.updated'), discovered: t('manage:taskSummary.videosFound'), without_code: t('manage:taskSummary.withoutCode'),
  incomplete: t('manage:taskSummary.incomplete'),
  result: t('manage:taskSummary.result'),
};

const PROBLEM_COUNTS = [
  'gone_count', 'unclear_count', 'source_failed', 'source_warning', 'resolve_failed',
  'warning_count', 'missing', 'unreadable', 'cache_blocked_count', 'blocked_count', 'dir_errors',
  'failed', 'missing_tool', 'issue_count', 'cover_network', 'performer_profile_failed',
  'performer_profile_conflicts', 'conflicts', 'paused_count', 'miss', 'incomplete',
];

/** 这一轮缺了一项能力，结论按退回的旧判据得出。数字为 0 也算问题：没做成的不是那几件，是整件。 */
const PROBLEM_FLAGS = ['face_match_unavailable'];

/** 完成检查与检查结果有问题是两件事，问题不能被例行折叠隐藏。 */
export const hasResultProblems = (run: TaskRunPayload): boolean => run.result_summary?.ok === false
  || Boolean(run.result_summary?.error)
  || PROBLEM_FLAGS.some((key) => run.result_summary?.[key] === true)
  || PROBLEM_COUNTS.some((key) => Number(run.result_summary?.[key]) > 0);

/** 一条来源问题。`kind` 与 `error` 是服务端按中文渲染的原句；`kind_code` 与按段存的 `error_parts` 给当前语言。 */
export interface TaskIssue {
  source: number; label: string; provider: string; kind: string; error: string;
  kind_code?: string; error_parts?: TextPart[];
}

/** 问题明细绑定本轮快照，当前来源状态由对应管理页查看。类别与原因已换成当前语言。 */
export function taskIssues(run: TaskRunPayload): TaskIssue[] {
  const issues = run.result_summary?.issues;
  return Array.isArray(issues) ? issues.filter((item): item is TaskIssue => !!item
    && typeof item === 'object' && typeof item.error === 'string' && typeof item.label === 'string')
    .map((issue) => ({ ...issue, kind: codedText(issue, 'kind'), error: partsLabel(issue.error_parts, issue.error) })) : [];
}

/** 处理入口只对同一种任务最新那一轮有意义的任务：目标页只显示最新一轮，更早的失败已经被后来的结果取代。
 *  扫描与采集卡片上的问题清单与「重试未完成项」只认最新一轮的失败集合。 */
const LATEST_ONLY = new Set(['library-processing']);

export function problemDestination(run: TaskRunPayload, latest = true): { href: string; label: string } | null {
  if (!hasResultProblems(run) && run.status !== 'failed') return null;
  if (LATEST_ONLY.has(run.task_key) && !latest) return null;
  const targets: Record<string, [string, string]> = {
    'link-check': ['/data-cleanup#link-manager', t('manage:taskLinks.problemLinks')],
    'link-prune': ['/data-cleanup#link-manager', t('manage:taskLinks.problemLinks')],
    // 「需要处理」不收这里的可重试项：问题清单有几百项，先看清单再在那张卡上重试。
    'library-processing': ['/data-cleanup#libraryProcessing', t('manage:taskLinks.unfinished')],
    'follow-check': ['/subscriptions', t('manage:taskLinks.followSources')],
    'feed-check': ['/subscriptions', t('manage:taskLinks.feeds')],
    'follow-resolve': ['/subscriptions?tab=add', t('manage:taskLinks.sourceLookup')],
    'resource-scan': ['/data-cleanup#resource-sync', t('manage:taskLinks.resourceSync')],
    'resource-apply': ['/data-cleanup#resource-sync', t('manage:taskLinks.resourceSync')],
    'media-repair': ['/data-cleanup#mediaRepair', t('manage:taskLinks.mediaRepair')],
    'taste-refresh': ['/taste', t('manage:taskLinks.tasteSources')],
    'follow-evidence-reclaim': ['/settings/maintenance/repairs', t('manage:taskLinks.repairs')],
    'follow-backfill': ['/settings/maintenance/repairs', t('manage:taskLinks.repairs')],
    'cover-artwork-repair': ['/settings/maintenance/repairs', t('manage:taskLinks.repairs')],
  };
  const target = targets[run.task_key];
  return target ? { href: target[0], label: target[1] } : null;
}

/** 这一轮只处理一部作品时，摘要里带它的 `asset_id` 与文件名，任务卡据此链接到作品详情。 */
export function taskSubject(run: TaskRunPayload): { href: string; label: string } | null {
  const id = run.result_summary?.asset_id;
  const name = run.result_summary?.name;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 && typeof name === 'string' && name
    ? { href: `/assets/${id}`, label: name } : null;
}

/** `LATEST_ONLY` 里每种任务最新那一轮的 id。后继不算：它们挂在父任务下，不是这种任务的一轮。 */
export function latestOfKind(rows: TaskRunPayload[]): Set<number> {
  const newest = new Map<string, number>();
  for (const row of rows) {
    if (LATEST_ONLY.has(row.task_key) && !row.followup_key
        && row.id > (newest.get(row.task_key) ?? 0)) newest.set(row.task_key, row.id);
  }
  return new Set(newest.values());
}

/** 把一批任务按 `parent_run_id` 归到各自的父任务下。没有父的那些留在外面。 */
export function groupFollowups(rows: TaskRunPayload[]): Map<number, TaskRunPayload[]> {
  const grouped = new Map<number, TaskRunPayload[]>();
  for (const row of rows) {
    if (!row.followup_key || row.parent_run_id == null) continue;
    const siblings = grouped.get(row.parent_run_id);
    if (siblings) siblings.push(row);
    else grouped.set(row.parent_run_id, [row]);
  }
  return grouped;
}

/** 连着的几轮收成一张卡：`runs[0]` 是最新那一轮。 */
export interface RunFold { run: TaskRunPayload; runs: TaskRunPayload[] }

/** 「最近完成」按时间顺序折叠：一段连续的例行轮次里，同一种任务并成一张卡，摆在它
 *  最新那一轮的位置上。任何一轮不是例行的（手动、失败、有新增或派了后继）都会截断这一段
 *  ——折叠只收「按时跑了、什么也没发生」的那些，有事的那一轮必须单独看得见。 */
export function foldRoutine(rows: TaskRunPayload[],
                            routine: (run: TaskRunPayload) => boolean): RunFold[] {
  const folds: RunFold[] = [];
  let open = new Map<string, RunFold>();
  for (const run of rows) {
    if (!routine(run)) {
      open = new Map();
      folds.push({ run, runs: [run] });
      continue;
    }
    const fold = open.get(run.task_key);
    if (fold) fold.runs.push(run);
    else {
      const started = { run, runs: [run] };
      open.set(run.task_key, started);
      folds.push(started);
    }
  }
  return folds;
}

/** 按时跑完、什么也没发生的一轮：定时触发、成功、没有新增也没派后继。 */
export const isRoutine = (run: TaskRunPayload) => run.trigger === 'scheduled'
  && run.status === 'succeeded' && !run.error
  && !hasResultProblems(run)
  && !(Number(run.result_summary?.added) > 0) && !(Number(run.result_summary?.followups) > 0);

export const isActive = (run: TaskRunPayload) => run.status === 'pending' || run.status === 'running';

/** 任务名按 `task_key` 取当前界面语言；没有译文的照用服务端的中文名。 */
export const taskName = (run: Pick<TaskRunPayload, 'task_key' | 'task_label'>): string =>
  serverLabel(`task.${run.task_key}`, run.task_label);

const ITEM_PROGRESS = 'taskRun.progress.item';
const ITEMS_PROGRESS = 'taskRun.progress.items';

/** 落库的一句说明（ADR-0156 第三条）：带 code 的按界面语言显示，任务名、触发方式和阶段换成当前语言的名字；
 *  旧行没有 code，照原文显示。 */
function runText(run: TaskRunPayload, code: string | null | undefined, params: Record<string, unknown> | undefined,
  original: string): string {
  if (!code) return original;
  if (code === ITEM_PROGRESS && !params?.name) return taskName(run);
  const trigger = String(params?.trigger || ''), stage = String(params?.stage || '');
  return serverLabel(code, original, {
    ...params, task: taskName(run), ...(trigger ? { trigger: TRIGGER_LABELS[trigger] || trigger } : {}),
    ...(stage ? { stage: stageText({ stage, stage_code: stage }) } : {}),
  });
}

/** 这一轮此刻在做什么。 */
export const progressLabel = (run: TaskRunPayload): string =>
  runText(run, run.progress_code, run.progress_params, run.progress_label || '');

/** 这一轮为什么停下：跳过、被打断这类由任务中心自己写的原因按界面语言显示，其余照原文。 */
export const runError = (run: TaskRunPayload): string =>
  runText(run, run.error_code, run.error_params, run.error || '');

/** 后继在做的那一件。标题已经是任务名，这里只写条目，不再说一遍「新作资料采集：」。 */
function followupItem(row: TaskRunPayload): string {
  const params = row.progress_params || {};
  if (row.progress_code === ITEM_PROGRESS) return String(params.name || '');
  if (row.progress_code === ITEMS_PROGRESS) return t('manage:taskCenter.batchItems', { first: params.first, count: params.count });
  if (row.progress_code) return progressLabel(row);
  // 旧行没有 code，照原文显示；只是任务名的那一句与标题重复，不写。
  return row.progress_label === row.task_label ? '' : row.progress_label || '';
}

/** 后继那一行的说明：它在做哪一件、做到第几项或结果如何。 */
export function followupDetail(row: TaskRunPayload): string {
  const item = String(row.result_summary?.name || '') || followupItem(row);
  const total = row.progress_total || 0;
  const { name: _name, ...result } = row.result_summary || {};
  const tail = readableErrorHeadline(runError(row)) || summaryText(result)
    || (isActive(row) && total > 0 ? t('manage:taskCenter.progressItems', { progress: progressText(row.progress_current, total) }) : '');
  return [item, tail].filter(Boolean).join(' · ');
}

/** 秒数说成「几分几秒」。跑了几小时的批处理也要一眼读得出量级：满 48 小时按天说。 */
export function elapsedText(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '';
  const whole = Math.floor(seconds);
  if (whole < 60) return t('manage:duration.seconds', { count: whole });
  const minutes = Math.floor(whole / 60);
  if (minutes < 60) return t('manage:duration.minutesSeconds', { count: minutes, seconds: whole % 60 });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('manage:duration.hoursMinutes', { count: hours, minutes: minutes % 60 });
  return t('manage:duration.daysHours', { count: Math.floor(hours / 24), hours: hours % 24 });
}

/** 进度读数「已做 / 总数」：服务端偶尔报出超过总数的已做数，按总数封顶。 */
export function progressText(current: number | null | undefined, total: number | null | undefined): string {
  const all = Math.max(0, Number(total) || 0);
  const done = Math.min(all, Math.max(0, Number(current) || 0));
  return `${done.toLocaleString()} / ${all.toLocaleString()}`;
}

/** 一段报错在列表里只露的那一行。Python traceback 的第一行永远是「Traceback (most recent call
 *  last):」，说明不了什么，取最后一行的异常类型与消息；别的取第一行非空。 */
export function errorHeadline(text: string | null | undefined): string {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '';
  return /^Traceback \(most recent call last\)/.test(lines[0]!) ? lines[lines.length - 1]! : lines[0]!;
}

/** 异常类型和原始堆栈由详情保留，摘要说明实际原因。 */
export function readableErrorHeadline(text: string | null | undefined): string {
  const head = errorHeadline(text);
  const technical = head.match(/^(?:[\w.]*Error|Exception):\s*(.*)$/);
  if (!technical) return head;
  // Peach 自己抛的原因是中文原话，照原样显示；第三方库的英文消息是技术细节，带着异常类型交给通用句。
  return /[㐀-鿿]/.test(technical[1]!) ? technical[1]! : requestErrorMessage(head);
}

/* 域状态里的英文结局值。后继的结论按段存 code，见 `summaryParts`；对不上资源的旧句子照原文显示。 */
const OUTCOME_LABELS: Record<string, string> = {
  partial: t('manage:taskOutcome.partial'), complete: t('manage:taskOutcome.complete'), interrupted: t('manage:taskOutcome.interrupted'),
  cancelled: t('manage:shared.canceled'),
};
const SOURCE_NAMES: Record<string, string> = { avwikidb: 'AVWikiDB', javdb: 'JavDB', 'minnano-av': 'みんなのAV' };
const OPERATION_LABELS: Record<string, string> = {
  like: t('manage:taskOperation.like'), seen: t('manage:taskOperation.markWatched'), later: t('manage:taskOperation.watchLater'), dispose: t('manage:shared.moveToTrash'),
  restore: t('manage:shared.restore'), delete: t('manage:shared.deletePermanently'), 'empty-trash': t('manage:shared.emptyTrash'),
  'dismiss-junk': t('manage:taskOperation.notJunk'), 'reconsider-junk': t('manage:taskOperation.recheckJunk'), region: t('manage:batchDock.setRegion'),
};
const outcomeText = (text: string): string => OUTCOME_LABELS[text] || text;

/** 时间戳说成本地的「月-日 时:分」。数据库里存的是 UTC，界面上一律按本机时区读。 */
export function momentText(stamp: string | null | undefined): string {
  if (!stamp) return '';
  const moment = new Date(stamp);
  if (Number.isNaN(moment.getTime())) return '';
  return moment.toLocaleString(interfaceLanguage,
    { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* 不进摘要的键：「谁挡的」已经写在错误那一句里；其余是域状态字典里的簿记——状态、
   起止时间戳、请求号和任务号，卡片标题、徽章和时间那一行已经说过，原样摆出来只是一串
   英文键和纪元秒。 */
const SUMMARY_HIDDEN = new Set([
  'blocked_by', 'status', 'run_id', 'request_id', 'started_at', 'completed_at', 'finished_at',
]);

/** 结论里已经说了模型或人像闸不可用的那几段。 */
const UNAVAILABLE_PARTS = new Set(['faceModelUnavailable', 'matchModelUnavailable', 'galleryMatchUnavailable', 'faceGateOff']);

/** 按段存的结论与来源（ADR-0159）按界面语言拼；站点 id 换成站名。旧记录只有原文，照原文显示。 */
const summaryParts = (summary: Record<string, unknown>, field: 'outcome' | 'source'): string | null => {
  const parts = summary?.[`${field}_parts`];
  if (!Array.isArray(parts)) return null;
  return partsText(parts, String(summary[field] ?? ''), (params) =>
    typeof params.site === 'string' ? { ...params, site: SOURCE_NAMES[params.site] || params.site } : params);
};

/** 任务结果只展示面向使用者的字段。 */
export function summaryItems(summary: Record<string, unknown>): string[] {
  const items = fieldItems(summary);
  // 「发现问题」要说得出是什么问题。原因已写进结论（「人脸模型不可用：…」「人像闸未生效…」）时不再说一遍。
  const parts = Array.isArray(summary?.outcome_parts) ? summary.outcome_parts as { code?: unknown }[] : [];
  if (summary?.face_match_unavailable === true && !parts.some((part) => UNAVAILABLE_PARTS.has(String(part?.code)))) {
    items.push(t('manage:taskOutcome.faceModelUnavailable'));
  }
  return items;
}

function fieldItems(summary: Record<string, unknown>): string[] {
  return Object.entries(summary || {})
    .filter(([key, value]) => !SUMMARY_HIDDEN.has(key)
      && (key in SUMMARY_LABELS || key === 'outcome' || key === 'followups' || key === 'error')
      && (typeof value === 'number' || typeof value === 'string')
      && String(value) !== '' && (value !== 0 || key === 'checked' || key === 'total'))
    .map(([key, value]) => {
      if (key === 'followups') return t('manage:taskOutcome.followupsScheduled', { count: Number(value) });
      if (key === 'error') return readableErrorHeadline(String(value));
      if (key === 'outcome') return summaryParts(summary, 'outcome') ?? outcomeText(String(value));
      if (key === 'result') return outcomeText(String(value));
      if (key === 'source') return `${SUMMARY_LABELS[key]} ${summaryParts(summary, 'source') ?? value}`;
      if (key === 'cache_bytes' || key === 'bytes_reclaimed') return `${SUMMARY_LABELS[key]} ${fmtSize(Number(value))}`;
      if (key === 'operation') return t('manage:taskSummary.operationValue', { operation: OPERATION_LABELS[String(value)] || t('manage:taskOperation.bulk') });
      return `${SUMMARY_LABELS[key]} ${typeof value === 'number' ? value.toLocaleString() : value}`;
    });
}

export const summaryText = (summary: Record<string, unknown>): string => summaryItems(summary).join(' · ');
