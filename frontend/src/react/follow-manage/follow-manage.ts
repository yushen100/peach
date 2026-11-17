/* 关注管理页的数据契约、轮询节律与纯折算。九条端点在 `frontend/src` 里都只在这里声明
 * 一次（`tests/test_frontend_build.py` 盯着）。
 *
 * 这一页有三份各自节律的真相，所以有三个键：
 * - `['follow-manage']` 是来源清单、创作者别名与「猜你喜欢」，由用户的写操作推进。写完
 *   只把改动的那一条换进缓存（`setQueryData`），不为一次开关把整页重取一遍。
 * - `['follow-manage','credentials']` 是凭据状态。它按站点报「填没填」，和来源清单的改动
 *   互不影响，合成一个键就会让每次开关来源都顺带重问一遍每个站的凭据文件。
 * - `['follow-manage','check']` 与 `['follow-manage','resolve']` 是两趟后台任务的快照，
 *   节律由后台推进：跑起来两秒一次，停了就不问。
 * - `['follow-manage','feeds']` 是订阅源（ADR-0042）。它和关注来源是两张表，开关与移除之后
 *   只重取这一份。
 *
 * 分组、排序、分页都是纯函数：两种视图（创作者卡片与表格）必须给出同一套顺序，比较器
 * 写在两处的话，同一份数据在两种视图里的先后就会不一样。 */
import { apiGet, apiSend } from '../../api';
import type { FaceRef } from '../../card-art/markup';
import {
  DEFAULT_SORT, isSortKey, SORT_DEFAULT_DIR, SORT_OPTIONS, type SortDir, type SortKey,
} from '../../follow-sort';
import { clampPage, pageCount } from '../../pagination';
import { pollUntil } from '../../polling';
import { queryClient } from '../query';
import { localTime } from '../time';
import { t } from '../../i18n';
import { codedText } from '../../core/server-text';

export const FOLLOW_URL = '/api/follow';
export const FOLLOW_CREDENTIALS_URL = '/api/follow/credentials';
export const FOLLOW_CHECK_URL = '/api/follow/check';
export const FOLLOW_SOURCE_URL = '/api/follow/source';
export const FOLLOW_RESOLVE_URL = '/api/follow/resolve';
export const FOLLOW_SUGGEST_URL = '/api/follow/suggest';
export const FOLLOW_ALIAS_URL = '/api/follow/author-alias';
export const FOLLOW_CREDENTIAL_URL = '/api/follow/credential';
export const FOLLOW_STATUS_URL = '/api/follow/status';
export const FEEDS_URL = '/api/feeds';
export const FEED_SOURCE_URL = '/api/feeds/source';
export const FEEDS_CHECK_URL = '/api/feeds/check';
/** 订阅拉取在后台跑时，隔多久读一次进度。 */
const FEED_CHECK_POLL_MS = 3000;
export const FEEDS_LOOKUP_URL = '/api/feeds/lookup';

/** 来源清单、创作者别名与推荐共用这一个键。 */
export const FOLLOW_MANAGE_KEY = ['follow-manage'] as const;
/** 各站凭据的状态。 */
export const FOLLOW_CREDENTIALS_KEY = ['follow-manage', 'credentials'] as const;
/** 检查更新那一趟后台任务。 */
export const FOLLOW_CHECK_KEY = ['follow-manage', 'check'] as const;
/** 查找关注来源那一趟后台任务。 */
export const FOLLOW_RESOLVE_KEY = ['follow-manage', 'resolve'] as const;
/** 订阅源清单与未读数。 */
export const FEEDS_KEY = ['follow-manage', 'feeds'] as const;
/** 敲字建议按词各存一份：同一个词回头再敲不必再打一趟站点的公开补全。 */
export const followSuggestKey = (term: string) => ['follow-manage', 'suggest', term] as const;

/** 一条关注来源。字段以 `_source_payload`（`src/peach/web_follow.py`）为准。 */
export interface FollowSource extends AuthorSource {
  id: number;
  provider: string;
  provider_label: string;
  ref: string;
  label: string;
  url: string;
  enabled: boolean;
  author_name?: string;
  author_key?: string;
  official_avatar_url?: string;
  avatar_url?: string;
  entity_id?: number | null;
  entity_name?: string;
  created_at?: string;
  last_checked_at?: string | null;
  last_status?: string;
  last_error?: string;
  /** 有 code 的按界面语言显示；旧记录只有原文。 */
  last_error_code?: string;
  last_error_params?: Record<string, unknown>;
  history_exhausted?: boolean;
}

/** 一组已保存的创作者别名。 */
export interface AliasGroup {
  canonical_key: string;
  canonical_name: string;
  aliases: { key: string; name: string; source?: string }[];
}

/** 一条待合并的别名，带判定依据。合并永远由人点，服务端不自动升级。 */
export interface AliasSuggestion {
  canonical: string; alias: string; evidence: string;
  /** 依据那句的 code 与参数；有译文时显示译文。 */
  evidence_code?: string; evidence_params?: Record<string, unknown>;
}

/** 「猜你喜欢」的一位创作者，来自用户自己浏览过的在线记录。 */
export interface FollowGuess { name: string; visits: number; origin?: string }

export interface FollowCounts { new?: number; seen?: number; saved?: number; ignored?: number }

/** `/api/follow` 的响应里这一页要的那几项。 */
export interface FollowData {
  sources: FollowSource[];
  author_aliases?: AliasGroup[];
  alias_suggestions?: AliasSuggestion[];
  suggestions?: FollowGuess[];
  counts?: FollowCounts;
}

/** 一个站点的凭据状态。只报存在性与去哪儿配，不回凭据值。 */
export interface CredentialRow {
  provider: string;
  provider_label: string;
  followable: boolean;
  requirement: 'required' | 'optional' | 'none' | 'blocked';
  needs: string[];
  fields: string[];
  missing: string[];
  shared_fields?: string[];
  present?: boolean;
  world_readable?: boolean | null;
  /** 说明的原文，旁边的 `why_code`、`howto_code` 给当前语言。 */
  why?: string;
  why_code?: string;
  where?: string;
  howto?: string;
  howto_code?: string;
  path?: string;
}

export interface CredentialData { root: string; providers: CredentialRow[] }

/** 检查更新那一趟的一条结果。完整统计留在页内，简短回执走 Toast。 */
export interface CheckResult {
  ok?: boolean;
  provider?: string;
  provider_label?: string;
  author?: string;
  label?: string;
  ref?: string;
  error?: string;
  evidence_error?: string;
  evidence_error_code?: string;
  evidence_error_params?: Record<string, unknown>;
  added?: number;
  updated?: number;
  skipped?: number;
  skipped_compilations?: number;
  history_skipped?: number;
  probed?: number;
  exhausted?: boolean;
}

/** 检查更新的任务快照。一次都没跑过是 `idle`。 */
export interface CheckJob {
  status: string;
  job_id?: string;
  checked?: number;
  total?: number;
  older?: boolean;
  message?: string;
  error?: string;
  results?: CheckResult[];
  current?: { label?: string; provider?: string; attempt?: number; max_attempts?: number; retry_in?: number };
}

/** 一条查找结果里的一个候选。`known` 是已经关注过的，列出来但不许再勾。 */
export interface ResolveCandidate {
  provider: string;
  provider_label: string;
  url: string;
  label: string;
  /** 站上没给标题时（「线程 123」）`label` 的 code 与参数。 */
  label_code?: string;
  label_params?: Record<string, unknown>;
  author?: string;
  aliases?: string[];
  evidence?: string;
  evidence_code?: string;
  evidence_params?: Record<string, unknown>;
  known?: boolean;
}

/** 站内索引没命中时交给人继续核对的外部搜索入口；`label`、`evidence` 各配 code 与参数。 */
export interface ExternalSearch {
  label: string; label_code?: string; label_params?: Record<string, unknown>;
  query: string; url: string;
  evidence: string; evidence_code?: string; evidence_params?: Record<string, unknown>;
}

export interface ResolveRow {
  kind?: string;
  line: string;
  error?: string;
  error_code?: string;
  error_params?: Record<string, unknown>;
  candidates?: ResolveCandidate[];
  external_searches?: ExternalSearch[];
  failures?: Record<string, string>;
  /** `failures` 里带 code 的那几条：来源 → code 与参数。 */
  failure_codes?: Record<string, { code: string; params?: Record<string, unknown> }>;
}

export interface ResolveJob {
  status: string;
  job_id?: string;
  checked?: number;
  total?: number;
  message?: string;
  error?: string;
  results?: ResolveRow[];
}

/** 添加框的建议。分组、顺序与组名都由服务端给，页面照抄。 */
export interface SuggestGroup {
  kind: string;
  label: string;
  label_code?: string;
  items: { value: string; matched?: string; matched_code?: string; n?: number }[];
}
export interface SuggestData { q: string; groups: SuggestGroup[] }

/* ── 视图与排序的取值 ── */

/** 两种视图共用同一份来源集合、创作者顺序与勾选；表格视图一行一条来源。 */
export const LAYOUTS = [['default', t('follow:followLayout.default')], ['table', t('follow:followLayout.table')]] as const;
export type Layout = (typeof LAYOUTS)[number][0];

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

/* 排序维度与默认方向和首屏骨架共用一份，见 `frontend/src/follow-sort.ts`。 */
export { DEFAULT_SORT, isSortKey, SORT_DEFAULT_DIR, SORT_OPTIONS, type SortDir, type SortKey };

/** 表格五列各自对应工具栏里的哪一档排序。列头点的就是同一个状态。 */
export const COLUMN_SORT = {
  author: 'name', source: 'source', provider: 'provider', status: 'status', checked: 'checked',
} as const satisfies Record<string, SortKey>;

export const isLayout = (value: unknown): value is Layout =>
  LAYOUTS.some(([key]) => key === value);

export const pageSizeOf = (value: unknown): number =>
  (PAGE_SIZES as readonly number[]).includes(Number(value)) ? Number(value) : DEFAULT_PAGE_SIZE;

/** 方向按维度各说各的：时间说远近、数量说多少，「正序」对一个时间戳不成立。每格是一整句无障碍名称。
 *  第一项是从升序点下去会得到的那一头，第二项是它的反面。 */
const SORT_ARIA: Record<SortKey, readonly [string, string]> = {
  checked: [t('follow:manageSort.aria.checkedNewest'), t('follow:manageSort.aria.checkedOldest')], added: [t('follow:manageSort.aria.addedNewest'), t('follow:manageSort.aria.addedOldest')],
  name: [t('follow:manageSort.aria.nameDesc'), t('follow:manageSort.aria.nameAsc')], sources: [t('follow:manageSort.aria.sourcesMost'), t('follow:manageSort.aria.sourcesFewest')],
  source: [t('follow:manageSort.aria.sourceDesc'), t('follow:manageSort.aria.sourceAsc')], provider: [t('follow:manageSort.aria.providerDesc'), t('follow:manageSort.aria.providerAsc')],
  status: [t('follow:manageSort.aria.statusDesc'), t('follow:manageSort.aria.statusAsc')],
};

/** 方向按钮的无障碍名称：说的是点下去会得到什么，所以取反方向的词。照抄当前方向，
 *  读屏那边会以为点下去还是这个顺序。 */
export const sortLabel = (sort: SortKey, dir: SortDir): string => SORT_ARIA[sort][dir === 'asc' ? 0 : 1];

/* ── 分组、排序、分页 ── */

/** 状态的排序位：失败最前，其次暂停、未检查，正常最后——正序就是「先看要处理的」。 */
export function statusRank(source: FollowSource): number {
  const state = source.last_status;
  if (state === 'error' || state === 'unauthorized') return 0;
  if (!source.enabled) return 1;
  return state === 'ok' ? 3 : 2;
}

/** 这一条此刻是什么状态。四种写法对应四种徽章。 */
export function statusText(source: FollowSource): string {
  if (source.history_exhausted) return t('follow:sourceStatus.noMore');
  if (!source.enabled) return t('follow:shared.paused');
  if (source.last_status === 'ok') return t('follow:shared.ok');
  return source.last_status === 'error' || source.last_status === 'unauthorized' ? t('follow:followCheck.checkFailed') : t('follow:feedSources.notChecked');
}

export const isBroken = (source: FollowSource): boolean =>
  source.last_status === 'error' || source.last_status === 'unauthorized';

/** 订阅源的拉取频率：一小时以内按分钟，两天以内按小时，再长按天。 */
export function feedIntervalText(minutes: number): string {
  const value = Number(minutes) || 0;
  if (value >= 2880) return t('follow:feedInterval.days', { count: Math.round(value / 1440) });
  if (value >= 60) return t('follow:feedInterval.hours', { count: Math.round(value / 60) });
  return t('follow:feedInterval.minutes', { count: value });
}

/** 一段报错在列表里只露的那一行。Python traceback 的第一行永远是「Traceback (most recent call
 *  last):」，说明不了什么，取最后一行的异常类型与消息；别的取第一行非空。 */
export function errorHeadline(text: string): string {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '';
  return /^Traceback \(most recent call last\)/.test(lines[0]!) ? lines[lines.length - 1]! : lines[0]!;
}

const byLabel = (a: FollowSource, b: FollowSource) =>
  String(a.label || '').localeCompare(String(b.label || ''), 'zh-CN', { numeric: true });

/** 按单条来源比的三个维度。 */
const SOURCE_SORTS: Partial<Record<SortKey, (a: FollowSource, b: FollowSource) => number>> = {
  source: byLabel,
  provider: (a, b) => String(a.provider_label || '').localeCompare(
    String(b.provider_label || ''), 'zh-CN') || byLabel(a, b),
  status: (a, b) => statusRank(a) - statusRank(b) || byLabel(a, b),
};

const timeOf = (value: string | null | undefined): number => Date.parse(value || '') || 0;

/** 同名的几种写法里取大写最多的那个：`LazyProcrastinator` 比 `lazyprocrastinator`
 *  更像创作者自己写的名字。 */
const clean = (value: string | undefined): string => String(value || '')
  .replace(/\s*[·|]\s*[A-Za-z0-9_-]+\s*$/, '')
  .replace(/\s+collections?\s*$/i, '').trim();

/** 署名与头像只读来源上的这几列：关注管理页与关注页（`follow-feed/follow-marks.ts`）的来源都给得出。 */
export interface AuthorSource {
  author_key?: string | undefined;
  author_name?: string | undefined;
  label?: string | undefined;
  ref?: string | undefined;
  entity_name?: string | undefined;
  official_avatar_url?: string | undefined;
  avatar_url?: string | undefined;
  cached_avatar_url?: string;
  author_entity?: (FaceRef & { name: string }) | null;
}

export function authorPortrait(group: readonly AuthorSource[]) {
  const portraits = group.map(source => source.author_entity);
  return portraits.find(person => person?.has_image)
    || portraits.find(person => person?.has_avatar && person.rep)
    || portraits.find(person => person?.source_avatar_url);
}

/** 分组标题用创作者本人的名字，不是某一条来源的标签。哪一段是人名由服务端一处判定
 *  （`author_name`），这里只在同一个人的几种写法之间挑一个。 */
export function authorName(group: readonly AuthorSource[], aliases: readonly AliasGroup[] = []): string {
  if (!group.length) return '';
  const authored = (source: AuthorSource) => String(source.author_name || '').trim() || clean(source.label);
  const entity = group.find((source) => source.entity_name);
  if (entity) return entity.entity_name!;
  const aliasGroup = aliases.find((item) => `name:${item.canonical_key}` === group[0]?.author_key);
  if (aliasGroup) return clean(aliasGroup.canonical_name);
  /* 官方主页来源优先提供创作者写法；否则 F95 的线程标题
     `Lazy Procrastinator Collection` 会因为大写字母更多而抢成分组标题。 */
  const official = group.find((source) => source.official_avatar_url);
  if (official && authored(official)) return authored(official);
  const names = group.map(authored).filter(Boolean);
  if (!names.length) return group[0]!.label || group[0]!.ref || '';
  const caps = (text: string) => (text.match(/[A-Z]/g) || []).length;
  return names.reduce((best, name) => (caps(name) > caps(best) ? name : best), names[0]!);
}

/** 圆标里的字：先找拉丁字母或数字，没有就取第一个字。 */
export function authorInitial(name: string): string {
  const ascii = name.trim().match(/[A-Za-z0-9]/);
  return (ascii ? ascii[0] : Array.from(name.trim())[0] || '?').toUpperCase();
}

/** 来源头像先读已有缓存，缺少缓存时按官方与归档来源回退。 */
export function authorAvatar(group: readonly AuthorSource[]): { src: string; fallback: string } {
  const official = group.find((source) => source.official_avatar_url);
  const mirror = group.find((source) => source.avatar_url);
  const cached = group.find(source => source.cached_avatar_url)?.cached_avatar_url;
  const urls = [...new Set([cached, official?.official_avatar_url, mirror?.avatar_url].filter(Boolean))];
  return { src: urls[0] || '', fallback: urls[1] || '' };
}

/** 这位创作者的身份。同一个人在不同站点上是多条来源、一个人，归组用后端给的
 *  `author_key`——那是实体 id 或归一化后的名字，不在前端二次猜。 */
export const groupKey = (group: FollowSource[]): string =>
  String(group[0]?.author_key || group[0]?.id || '');

/** 按创作者归组，组内顺序是原始顺序。排序另算，归组本身不看排序。 */
export function groupByAuthor(sources: FollowSource[]): FollowSource[][] {
  const order: string[] = [];
  const byKey = new Map<string, FollowSource[]>();
  for (const source of sources) {
    const key = source.author_key || `source:${source.id}`;
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key) }
    byKey.get(key)!.push(source);
  }
  return order.map((key) => byKey.get(key)!);
}

/** 排好序的创作者组。
 *
 * `flip` 只在方向偏离这一列的默认值时取反：写成「asc 就取反」的话，创作者名称默认本来
 * 就是正序，一进页面就被翻成倒序。同值回退始终按名字正序，不跟着翻——否则「来源数量」
 * 里数量相同的那几个人每换一次方向就整段倒序一遍，看着像列表在乱跳。 */
export function authorGroups(
  sources: FollowSource[], sort: SortKey, dir: SortDir, aliases: AliasGroup[] = [],
): FollowSource[][] {
  const groups = groupByAuthor(sources);
  const flip = dir === SORT_DEFAULT_DIR[sort] ? 1 : -1;
  const name = (group: FollowSource[]) => authorName(group, aliases);
  const byName = (a: FollowSource[], b: FollowSource[]) =>
    name(a).localeCompare(name(b), 'zh-CN', { numeric: true });
  const bySource = SOURCE_SORTS[sort];
  if (bySource) {
    // 先排每位创作者名下的来源，创作者之间再按各自排在最前的那条比。
    for (const group of groups) group.sort((a, b) => flip * bySource(a, b));
    return groups.sort((a, b) => flip * bySource(a[0]!, b[0]!) || byName(a, b));
  }
  const checked = (group: FollowSource[]) => Math.max(...group.map((s) => timeOf(s.last_checked_at)));
  const added = (group: FollowSource[]) => Math.max(...group.map((s) => timeOf(s.created_at)));
  return groups.sort((a, b) => {
    if (sort === 'name') return flip * byName(a, b);
    if (sort === 'sources') return flip * (b.length - a.length) || byName(a, b);
    if (sort === 'added') return flip * (added(b) - added(a)) || byName(a, b);
    return flip * (checked(b) - checked(a)) || byName(a, b);
  });
}

/** 表格视图的行：一行一条来源，创作者列每行都写。
 *
 * 行的顺序来自同一组创作者组，按来源比的那三档再把整张表拉平重排——那时表格不再按
 * 创作者聚在一起，而这正是点那三列列头要的效果。排序作用在全部结果上，分页只切最后一步。 */
export interface TableRow { source: FollowSource; group: FollowSource[]; author: string }

export function tableRows(
  groups: FollowSource[][], sort: SortKey, dir: SortDir, aliases: AliasGroup[] = [],
): TableRow[] {
  const rows = groups.flatMap((group) => {
    const author = authorName(group, aliases);
    return group.map((source) => ({ source, group, author }));
  });
  const bySource = SOURCE_SORTS[sort];
  if (bySource) {
    const flip = dir === SORT_DEFAULT_DIR[sort] ? 1 : -1;
    rows.sort((a, b) => flip * bySource(a.source, b.source));
  }
  return rows;
}

/** 一页的边界。总量、页数与当前页都按同一份计算，页脚那句读数和切片不会各说各的。 */
export interface PageWindow { page: number; pages: number; total: number; start: number; end: number }

export function pageWindow(total: number, size: number, page: number): PageWindow {
  const pages = pageCount(total, size);
  const current = clampPage(page, pages);
  const start = (current - 1) * size;
  return { page: current, pages, total, start, end: Math.min(start + size, total) };
}

/* ── 跨页与跨视图的选择 ── */

/** 勾选的身份是来源 ID，不是行号：换页、换视图、换排序之后选中的仍是同一批来源。
 *  已经不在清单里的 ID 顺手丢掉——删掉的来源不该还占着计数。 */
export function keepSelected(selected: ReadonlySet<number>, sources: FollowSource[]): Set<number> {
  const available = new Set(sources.map((source) => source.id));
  return new Set([...selected].filter((id) => available.has(id)));
}

/** 一组来源在当前选择里的样子：全选、半选还是都没选。表头与创作者行的全选键读它。 */
export function selectionState(selected: ReadonlySet<number>, ids: number[]):
{ all: boolean; some: boolean } {
  const count = ids.filter((id) => selected.has(id)).length;
  return { all: ids.length > 0 && count === ids.length, some: count > 0 && count < ids.length };
}

export function toggleGroup(selected: ReadonlySet<number>, ids: number[], on: boolean): Set<number> {
  const next = new Set(selected);
  for (const id of ids) { if (on) next.add(id); else next.delete(id) }
  return next;
}

/* ── 取数与写操作 ── */

/** 管理页只要来源清单、别名与计数；`summary=1` 让服务端跳过作品分组与筛选项。 */
export const fetchFollow = (signal?: AbortSignal) =>
  apiGet<FollowData>(`${FOLLOW_URL}?summary=1`, signal);

export const fetchCredentials = (signal?: AbortSignal) =>
  apiGet<CredentialData>(FOLLOW_CREDENTIALS_URL, signal);

export const fetchCheckJob = (signal?: AbortSignal) =>
  apiGet<CheckJob>(FOLLOW_CHECK_URL, signal);

export const fetchResolveJob = (signal?: AbortSignal) =>
  apiGet<ResolveJob>(FOLLOW_RESOLVE_URL, signal);

export const fetchSuggestions = (query: string, signal?: AbortSignal) =>
  apiGet<SuggestData>(`${FOLLOW_SUGGEST_URL}?q=${encodeURIComponent(query)}`, signal);

/** 起一趟检查。`sources` 给了就只查这几条，都不给就是全部。 */
export const startCheck = (sources?: number[]) =>
  apiSend<CheckJob>(FOLLOW_CHECK_URL, { ...(sources?.length ? { sources } : {}), background: true });

/** 起一趟查找。结果先摆出来由人勾选，这一步不写任何东西。 */
export const startResolve = (lines: string[]) =>
  apiSend<ResolveJob>(FOLLOW_RESOLVE_URL, { lines, background: true });

export const setSourceEnabled = (id: number, enabled: boolean) =>
  apiSend<{ source: number; enabled: boolean }>(FOLLOW_SOURCE_URL, { action: 'enabled', id, enabled });

export const removeSource = (id: number) =>
  apiSend<{ ok: boolean }>(FOLLOW_SOURCE_URL, { action: 'remove', id });

export const addSource = (candidate: ResolveCandidate) =>
  apiSend<{ source: number }>(FOLLOW_SOURCE_URL, {
    action: 'add', url: candidate.url, label: candidate.label,
    author: candidate.author || '', aliases: candidate.aliases || [], defer_check: true,
  });

export const addAlias = (canonical: string, alias: string) =>
  apiSend<{ ok: boolean }>(FOLLOW_ALIAS_URL, { action: 'add', canonical, alias });

export const removeAlias = (alias: string) =>
  apiSend<{ ok: boolean }>(FOLLOW_ALIAS_URL, { action: 'remove', alias });

export const renameAliasGroup = (key: string, name: string, signal?: AbortSignal) =>
  apiSend<{ ok: boolean }>(FOLLOW_ALIAS_URL, { action: 'rename', canonical_key: key, canonical: name }, 'POST', signal);

/** 保存或清除一个站点的凭据。`values` 为空就是清除。 */
export const saveCredential = (provider: string, values: Record<string, string>) =>
  apiSend<{ note?: string; note_code?: string }>(FOLLOW_CREDENTIAL_URL, { provider, values });

/** 一次批量写最多几条，与 `w_follow_status` 收 `items` 的上限相同；一页待处理也最多这么多组。 */
export const MARK_BATCH = 1000;
/** 「全部标为」最多取几轮待处理清单：一轮最多标 `MARK_BATCH` 组，十万条以上的积压不在一次点击里收完。 */
const MARK_ROUNDS = 100;

export const markItems = (items: number[], to: string) =>
  apiSend<{ ok: boolean; items: number[] }>(FOLLOW_STATUS_URL, { items, to });

type PendingRow = { id: number; status: string };
/** 待处理的未看条目，最多 `MARK_BATCH` 组；`has_more` 说后面还有。 */
export const fetchPending = () =>
  apiGet<{ groups?: { primary: PendingRow; variants: PendingRow[]; duplicates: PendingRow[] }[]; has_more?: boolean }>(
    `${FOLLOW_URL}?status=new&limit=${MARK_BATCH}`);

/** 把未看条目全部标成 `to`：取一页待处理、按 `MARK_BATCH` 条一批写，写完再从第一页取，直到取不到为止。
 *  标过的离开 `status=new`，所以不按偏移翻页；写失败的那批不再重取，免得一直撞同一个错。 */
export async function markAllPending(to: string): Promise<{ total: number; failed: number; error?: unknown; marked: number[] }> {
  const tried = new Set<number>();
  const marked: number[] = [];
  let failed = 0;
  let error: unknown;
  for (let round = 0; round < MARK_ROUNDS; round += 1) {
    const pending = await fetchPending();
    const ids = [...new Set((pending.groups || [])
      .flatMap((group) => [group.primary, ...group.variants, ...group.duplicates])
      .filter((item) => item.status === 'new' && !tried.has(item.id)).map((item) => item.id))];
    if (!ids.length) break;
    for (let start = 0; start < ids.length; start += MARK_BATCH) {
      const batch = ids.slice(start, start + MARK_BATCH);
      for (const id of batch) tried.add(id);
      try {
        await markItems(batch, to);
        marked.push(...batch);
      } catch (cause) {
        failed += batch.length;
        error ??= cause;
      }
    }
    if (!pending.has_more) break;
  }
  return { total: tried.size, failed, error, marked };
}

/** 把这一批条目改回未看：「全部标记」的撤销，按批量接口的上限分批发。 */
export async function unmarkItems(ids: readonly number[]): Promise<void> {
  for (let start = 0; start < ids.length; start += MARK_BATCH) await markItems(ids.slice(start, start + MARK_BATCH), 'new');
}

/** 一条订阅源。字段以 `feeds.sources`（`src/peach/feeds.py`）为准。 */
export interface FeedSource {
  id: number;
  kind: string;
  kind_label: string;
  kind_label_code?: string;
  /** 挂着人物时是她在数据库里的统称，否则是存下的名字。 */
  name: string;
  /** 上次拉取时这一页在站上挂的名字。同一个人的旧艺名页靠它和本名页分开。 */
  page_name?: string;
  url: string;
  entity_id: number | null;
  entity_name: string | null;
  /** 这位有没有资料图：有就在名字前画 `/entity-image` 的圆框，没有退首字母。 */
  has_image?: boolean;
  image_version?: string;
  /** 资料图的人脸取景，和 `has_image` 出自同一份身份引用。 */
  avatar_focus?: unknown;
  enabled: boolean;
  interval_minutes: number;
  last_fetched_at: string | null;
  last_error: string | null;
  last_error_code?: string;
  last_error_params?: Record<string, unknown>;
  last_new_count: number;
  seen: number;
}

export interface FeedsData {
  sources: FeedSource[];
  unread: number;
}

/** 认不出的响应当读失败：没有 sources 的那份不是订阅源的数据，画出来只会在第一次取长度时炸掉。 */
export async function fetchFeeds(signal?: AbortSignal): Promise<FeedsData> {
  const payload = await apiGet<FeedsData>(FEEDS_URL, signal);
  if (!Array.isArray(payload?.sources)) throw new Error(t('follow:feedSources.readFailed'));
  return payload;
}

export const setFeedEnabled = (id: number, enabled: boolean, signal?: AbortSignal) =>
  apiSend(FEED_SOURCE_URL, { action: 'enabled', id, enabled }, 'POST', signal);

export const removeFeed = (id: number, signal?: AbortSignal) =>
  apiSend(FEED_SOURCE_URL, { action: 'remove', id }, 'POST', signal);

/** 拉取走的是和定时同一条路：不点名就是「全部启用的源」，点名几条就只拉那几条，停用的也拉。
 *  在后台发起、再按进度读到这一轮结束：请求不占着服务端线程等，这一轮被暂停也只是页面这边停在忙态。 */
export async function checkFeeds(signal?: AbortSignal, ids?: number[]): Promise<void> {
  const started = await apiSend<{ status?: string }>(FEEDS_CHECK_URL,
    { ...(ids?.length ? { sources: ids } : { all: true }), background: true }, 'POST', signal);
  if (started?.status !== 'running') return;
  await pollUntil<{ status?: string }>({
    signal: signal ?? new AbortController().signal, everyMs: FEED_CHECK_POLL_MS,
    read: (polling) => apiGet<{ status?: string }>(FEEDS_CHECK_URL, polling),
    apply: () => {},
    done: (job) => job.status !== 'running',
  });
}

/** JavDB 搜出来的一张演员卡。字段以 `web_feeds.q_feed_lookup` 为准。 */
export interface FeedCandidate {
  /** 站内 id，登记时送回去的就是它。 */
  id: string;
  /** 这个人在站上的全部写法。 */
  names: string[];
  /** 记录类型：無碼那条带 `無碼`，有碼那条是空串。 */
  record: string;
  url: string;
  /** 这个 id 已经在数据库里谁名下。 */
  held_by: { id: number; name: string } | null;
  /** 卡上的写法对得上数据库里哪几位的正名或别名。 */
  matched: { id: number; name: string }[];
}

export interface FeedLookup {
  q: string;
  url: string;
  candidates: FeedCandidate[];
  /** 名字对得上、又只有一个人的那几张，先替用户勾上；同名不止一位时是空的。 */
  suggested: string[];
  /** 数据库里按这个名字认得出的那位；认不出是 null，登记时会新建。`subscribable` 是她已有
   *  JavDB 演员页或 DMM 编号、不经搜索就能订，`following` 是已经在订。 */
  known: { id: number; name: string; subscribable: boolean; following: boolean } | null;
  /** JavDB 这一趟没搜成的原因；只在库里的她能直接订时随结果一起回来，否则整次查找报错。 */
  unavailable?: string;
  unavailable_code?: string;
  unavailable_params?: Record<string, unknown>;
}

export const lookupFeedActor = (name: string, signal?: AbortSignal) =>
  apiGet<FeedLookup>(`${FEEDS_LOOKUP_URL}?q=${encodeURIComponent(name)}`, signal);

export interface FeedFollowed {
  entity_id: number;
  entity_name: string;
  /** 这位是这一次新建到数据库里的。 */
  created: boolean;
  sources: number[];
}

/** 勾选的演员卡登记到这位名下并订上她的演员页。地址仍由服务端拼，页面只送 id。 */
export const followFeedByName = (name: string, ids: string[], signal?: AbortSignal) =>
  apiSend<FeedFollowed>(FEED_SOURCE_URL, { action: 'follow-name', name, ids }, 'POST', signal);

/** 按库里认出的这位直接订，和人物页「订阅新作」开关同一个动作。 */
export const followFeedEntity = (entityId: number, signal?: AbortSignal) =>
  apiSend<{ entity_id: number; following: boolean; sources: number[] }>(
    FEED_SOURCE_URL, { action: 'follow', entity_id: entityId, enabled: true }, 'POST', signal);

/** 创作者来源、JAV 订阅与凭据分别读取，页面按各区域的状态显示。
 *
 * 两趟后台任务不在首屏里：它们的快照常年躺着上一趟的回执，等它们只会让首屏多等一个
 * 往返，而它们自己的键挂上去就会读。中止时 `fetchQuery` 把 `AbortError` 抛回挂载方。 */
export async function prefetchFollowManage(signal: AbortSignal): Promise<void> {
  void queryClient.prefetchQuery({ queryKey: FOLLOW_CREDENTIALS_KEY, queryFn: () => fetchCredentials(signal) });
  void queryClient.prefetchQuery({ queryKey: FEEDS_KEY, queryFn: () => fetchFeeds(signal) });
  void queryClient.prefetchQuery({ queryKey: FOLLOW_MANAGE_KEY, queryFn: () => fetchFollow(signal) });
}

/** 把改动的那一条换进缓存。整页重取会把用户正在填的表单一起重画，也会让正在读这一屏的
 *  人看见列表整个跳一下；服务端回的就是这一条的新样子，换进去即可。 */
export function patchSource(id: number, patch: Partial<FollowSource>): void {
  queryClient.setQueryData<FollowData>(FOLLOW_MANAGE_KEY, (data) => (data ? {
    ...data,
    sources: data.sources.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  } : data));
}

/** 删掉的那几条直接从缓存里去掉。 */
export function dropSources(ids: number[]): void {
  const gone = new Set(ids);
  queryClient.setQueryData<FollowData>(FOLLOW_MANAGE_KEY, (data) => (data ? {
    ...data, sources: data.sources.filter((row) => !gone.has(row.id)),
  } : data));
}

/** 添加来源、合并别名这类会改变整份清单结构的写操作：换一条进去算不出新的分组与别名，
 *  只能让这一个键重取。
 *
 * `exact` 不能省：另外三个键都以 `follow-manage` 开头，按前缀失效会把凭据和两趟任务的
 * 快照一起推倒重来——正在跑的那一趟会在页面上闪回「没有任务」再跳回进度。 */
export const reloadFollowManage = (): Promise<void> =>
  queryClient.invalidateQueries({ queryKey: FOLLOW_MANAGE_KEY, exact: true });

/** 敲字建议的防抖。这一路要打一次站点的公开补全，250ms 让连着敲的人停手之后才打一枪。 */
export const SUGGEST_DEBOUNCE_MS = 250;

/** 检查回执只显示内容变化与失败数，完整统计由检查结果呈现。 */
export function checkReceipt(job: Pick<CheckJob, 'results'>): string {
  const rows = job.results || [];
  const added = rows.reduce((total, row) => total + (row.added || 0), 0);
  const updated = rows.reduce((total, row) => total + (row.updated || 0), 0);
  const failed = rows.filter((row) => !row.ok).length;
  const bits: string[] = [];
  if (added) bits.push(t('follow:checkSummary.added', { count: added }));
  if (updated) bits.push(t('follow:checkSummary.updated', { count: updated }));
  if (!bits.length && failed < rows.length) bits.push(t('follow:checkSummary.noUpdates'));
  if (failed) bits.push(t('follow:shared.failedCount', { count: failed }));
  if (!bits.length) bits.push(t('follow:checkSummary.noUpdates'));
  return t('follow:checkSummary.receipt', { count: rows.length, details: bits.join(' · ') });
}

/** 一次检查的完整统计。 */
export function checkSummary(job: CheckJob): string {
  const rows = job.results || [];
  const sum = (pick: (row: CheckResult) => number | undefined) =>
    rows.reduce((total, row) => total + (pick(row) || 0), 0);
  const added = sum((row) => row.added);
  const updated = sum((row) => row.updated);
  const compilations = sum((row) => row.skipped_compilations);
  const skipped = sum((row) => row.skipped) - compilations;
  const history = sum((row) => row.history_skipped);
  const probed = sum((row) => row.probed);
  const quiet = rows.filter((row) => row.ok && !row.added && !row.updated).length;
  const failed = rows.filter((row) => !row.ok).length;
  const bits: string[] = [];
  if (added) bits.push(t('follow:checkSummary.added', { count: added }));
  if (updated) bits.push(t('follow:checkSummary.updated', { count: updated }));
  if (skipped) bits.push(t('follow:checkSummary.skippedNoResource', { count: skipped }));
  if (compilations) bits.push(t('follow:checkSummary.compilationsExcluded', { count: compilations }));
  if (history) bits.push(t('follow:checkSummary.historySkipped', { count: history }));
  if (probed) bits.push(t('follow:checkSummary.probed', { count: probed }));
  if (quiet) bits.push(t('follow:checkSummary.quietSources', { count: quiet }));
  if (!bits.length) bits.push(t('follow:checkSummary.nothingChanged'));
  /* 来源没有更多内容与本次没有更新分别计数。 */
  const exhausted = rows.filter((row) => row.exhausted).length;
  if (exhausted) bits.push(t('follow:checkSummary.exhausted', { count: exhausted }));
  if (failed) bits.push(t('follow:shared.failedCount', { count: failed }));
  return t('follow:checkSummary.summary', { count: rows.length, details: bits.join(' · ') });
}

/** 页内持久行只装要处理的东西：失败与取证缺档。全部成功时没有这一行。 */
export const checkFailures = (job: CheckJob | null): CheckResult[] =>
  (job?.results || []).filter((row) => !row.ok);

export const checkEvidenceGap = (job: CheckJob | null): string => {
  const row = (job?.results || []).find((item) => item.evidence_error);
  return row ? codedText(row, 'evidence_error') : '';
};

export { localTime };

export const checkedText = (source: FollowSource): string =>
  (source.last_checked_at ? localTime(source.last_checked_at) : t('follow:feedSources.notChecked'));

/** 有站点图标的来源。图标由服务端按 `follow_assets.SOURCE_ICON_URLS` 取回并存在本机，
 *  页面只认这份名单：没登记的来源直接不出 `<img>`。 */
export const SOURCE_ICON_PROVIDERS = new Set([
  'fanbox', 'patreon', 'subscribestar', 'iwara', 'kemono', 'coomer', 'pawchive',
  'rule34video', 'rule34xxx', 'rule34paheal', 'gofile', 'f95zone', 'simpcity',
]);

export const sourceIconUrl = (provider: string): string =>
  (SOURCE_ICON_PROVIDERS.has(provider) ? `/source-icon?provider=${encodeURIComponent(provider)}` : '');

/** 四种凭据状态四种说法：待办（缺凭据）和完成（已配置）不能同色，那正是要一眼分开的两件事。 */
export const CREDENTIAL_STATE: Record<string, string> = {
  required: t('follow:credentialState.required'), optional: t('follow:credentialState.optional'), none: t('follow:credentialState.none'), blocked: t('follow:credentialState.blocked'),
};

export const credentialDone = (row: CredentialRow): boolean =>
  !!row.present && !row.missing.length;
