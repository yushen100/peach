import { apiGet, apiSend } from '../../api';
import { withBackoff } from '../../polling';
import { queryClient } from '../query';
import { fetchWants, WANTS_KEY } from '../wants/wants';
import type { CoverState, FaceRef, CoverItem } from '@peach/card-art';
import { coverImage, javArtwork, remoteCoverUrl } from '@peach/card-art';
import { esc } from '@peach/legacy/core';
import { peachHistory, shellNavigate } from '@peach/history';
import { RELEASE_SORTS, type DiscoveryDirection, type DiscoverySort, type ReleaseSort } from './discovery-sorts';
import { t } from '../../i18n';
import { columnValueSelected, mapColumnSelection, readColumnFilters, writeColumnFilters, type ColumnFilterKey, type ColumnSelection } from '../../column-filters';

export { JAV_TABS, javTab, javPath, javLibraryPath } from './jav-navigation';

/** 分区里的筛选写进地址栏：替换当前记录，不多压一条历史。 */
export function writeJavQuery(patch: Record<string, string>): void {
  const params = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries(patch)) { if (value) params.set(key, value); else params.delete(key) }
  shellNavigate(location.pathname + (params.size ? `?${params}` : ''), { replace: true, state: peachHistory.navigation.location.state });
}

export interface Discovery extends CoverItem {
  id: number; code: string; title: string; performers: string; release_date: string;
  studio: string; link: string; cover_url: string; has_cover: boolean; wanted: boolean;
  studio_ref?: Omit<ReleaseFacetStudio, 'count'>;
  performer_refs?: (FaceRef & { name: string; source_actor_id?: string; source_avatar?: boolean })[];
  asset_id?: number | null; tags?: string[]; score?: number;
  /** 口味理由，服务端按中文渲染好的原句；`reason_codes`、`reason_params` 与它一一对应。 */
  reasons?: string[]; reason_codes?: string[]; reason_params?: Record<string, unknown>[];
  taste_score?: number | null; ranking_score?: number | null; rank?: number;
  source_score?: number | null; duration?: number | null;
  metadata_state?: 'pending' | 'ready' | 'partial' | 'unavailable' | 'stale'; metadata_message?: string;
  cover_state?: CoverState | null; cover_reason?: string; cover_reason_code?: string;
  cover_reason_params?: Record<string, unknown>;
}
export type DiscoveryScope = 'external' | 'library';

/** `/api/jav/cover` 的回话：取到了就带上版本与取景的两份边车，没取到是原因。 */
export interface CoverNow {
  has_cover: boolean; cover_version: string; message: string;
  cover_frame?: CoverItem['cover_frame']; poster_box?: CoverItem['poster_box'];
}

/* 正在当场取的番号：卡上点的、整批插队里轮到的都记在这里，卡片按它画不定进度圆环，两种入口一个样子。 */
const coversInFlight = new Set<string>();
const coverListeners = new Set<() => void>();
let coverRevision = 0;
const coversChanged = () => { coverRevision += 1; coverListeners.forEach(listener => listener()) };
export const coverFetching = {
  subscribe(listener: () => void) { coverListeners.add(listener); return () => { coverListeners.delete(listener) } },
  revision: () => coverRevision,
  has: (code: string) => coversInFlight.has(code),
};

/** 不进后台的队，当场取这一部的官方封面（详情页「立即重试」同一个接口）。 */
export function fetchCoverNow(code: string, signal?: AbortSignal): Promise<CoverNow> {
  coversInFlight.add(code); coversChanged();
  return apiSend<CoverNow>('/api/jav/cover', { code }, 'POST', signal)
    .finally(() => { coversInFlight.delete(code); coversChanged() });
}

/** 一批番号逐部当场取，`parallel` 部并行。`fetchOne` 回这一部取没取到；`alive()` 为假就停在当前这部，
 *  没轮到的照旧排在后台的队里。JAV 页「新作」与首页、女优页的新作那一行共用。 */
export async function prioritiseCovers(codes: string[], fetchOne: (code: string) => Promise<boolean>,
  progress: (done: number) => void, alive: () => boolean, parallel = 2): Promise<number> {
  const queue = [...codes];
  let done = 0, got = 0;
  const worker = async () => {
    for (let code = queue.shift(); code && alive(); code = queue.shift()) {
      const ok = await fetchOne(code).catch(() => false);
      if (!alive()) return;
      done += 1; got += ok ? 1 : 0;
      progress(done);
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  return got;
}

/** 当场取到的封面补进「新作」「发现」两个分区已取回的数据：卡片换上本机那张，不必整页重问
 *  （`/api/jav/releases` 每问一次都把全部候选重算一遍）。 */
export function coverArrived(code: string, result: CoverNow): void {
  const patch = (data: unknown) => {
    const items = (data as { items?: Discovery[] } | undefined)?.items;
    return items ? { ...(data as object), items: items.map(item => item.code === code ? { ...item, has_cover: true,
      cover_version: result.cover_version, cover_frame: result.cover_frame, poster_box: result.poster_box, cover_state: null } : item) } : data;
  };
  for (const key of ['jav-releases', 'jav-discoveries']) queryClient.setQueriesData({ queryKey: [key] }, patch);
}
export interface DiscoveryMetadataJob {
  job_id: string; status: 'running' | 'complete' | 'stopped' | 'failed' | 'cancelling' | 'cancelled'; completed: number; total: number;
  failed: number; requests: number; bytes: number; stop_reason?: string; message?: string;
}
export interface DiscoveryResult {
  items: Discovery[]; candidate_total: number; limited: boolean; ranking_method?: 'mmr' | 'field-sort';
  metadata_job?: DiscoveryMetadataJob | null; poll_after_ms?: number;
}
export const discoveryKey = (scope: DiscoveryScope, sort: DiscoverySort = 'taste', direction: DiscoveryDirection = 'desc') =>
  ['jav-discoveries', scope, sort, direction] as const;
/** 推荐列表只读：资料读取由 `controlDiscoveryMetadata` 起停，进度由 `fetchDiscoveryMetadata` 单独轮询。 */
export function fetchDiscoveries(scope: DiscoveryScope, signal: AbortSignal, options: {
  sort?: DiscoverySort; direction?: DiscoveryDirection;
} = {}) {
  const params = new URLSearchParams({ scope, limit: '100', sort: options.sort || 'taste', direction: options.direction || 'desc' });
  return apiGet<DiscoveryResult>(`/api/jav/discoveries?${params}`, signal);
}

export const DISCOVERY_METADATA_KEY = ['jav-discovery-metadata'] as const;
export type DiscoveryMetadataStatus = Pick<DiscoveryResult, 'metadata_job' | 'poll_after_ms'>;
/** 资料读取进度的 `refetchInterval`：有一轮在跑时按服务端给的 `poll_after_ms`（至少一秒），读失败退避。
 *  列表本身读的期间不另起轮询：读到的标签与评分由全站那一处的 `discoveries` 版本作废列表带上来，
 *  读完页面再取一次。`listed` 是列表带回来的那一轮是不是在跑。 */
export const metadataInterval = (listed: () => boolean) => withBackoff<DiscoveryMetadataStatus>((data) =>
  (data?.metadata_job?.status === 'running' || listed() ? Math.max(1000, data?.poll_after_ms || 3000) : false));
/** 资料读取进度：只读任务快照，不重算推荐。 */
export const fetchDiscoveryMetadata = (signal: AbortSignal) =>
  apiGet<DiscoveryMetadataStatus>('/api/jav/discoveries/metadata', signal);
/** `start` 只读过期或从没读过的，`refresh` 整批重读，`cancel` 停下当前这一轮。读的是当前排序下那一页。 */
export function controlDiscoveryMetadata(action: 'start' | 'refresh' | 'cancel', options: {
  sort?: DiscoverySort; direction?: DiscoveryDirection; jobId?: string;
}, signal?: AbortSignal) {
  return apiSend<DiscoveryMetadataStatus>('/api/jav/discoveries/metadata', {
    action, limit: 100, sort: options.sort || 'taste', direction: options.direction || 'desc', job_id: options.jobId || '',
  }, 'POST', signal);
}

/** 新作分区的筛选与排序：都写在地址栏里，刷新与返回原样恢复。`seed` 只在换一批时有值。 */
export interface ReleaseFilters {
  page: number; size: number; performer: string; studio: string; tag: string; q: string;
  sort: ReleaseSort; dir: DiscoveryDirection; seed: string;
  column_filters?: string;
}
export interface ReleaseFacetPerformer extends FaceRef { name: string; count: number; source_actor_id?: string; source_avatar?: boolean; avatar_code?: string; aliases?: string[] }
export interface ReleaseFacetStudio { name: string; count: number; has_logo: boolean; logo_version?: string }
/** `/api/jav/releases`：一页新作，加只取自订阅新作的筛选项。只读：`metadata_unread` 是筛选结果里
 *  从没读过来源资料的部数，读取由 `controlReleaseMetadata` 起停。 */
export interface ReleaseResult {
  items: Discovery[]; total: number; candidate_total: number; page: number; size: number;
  facets: { performers: ReleaseFacetPerformer[]; studios: ReleaseFacetStudio[]; tags: { name: string; count: number }[] };
  metadata_unread?: number; metadata_job?: DiscoveryMetadataJob | null; poll_after_ms?: number;
}
export const RELEASE_PAGE_SIZE = 24;
export const RELEASE_PAGE_SIZES = [10, 20, 24, 50, 100] as const;
export function releaseFilters(search: string): ReleaseFilters {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  const seed = params.get('seed') || '';
  const page = Number(params.get('page'));
  const size = RELEASE_PAGE_SIZES.find(value => value === Number(params.get('size'))) || RELEASE_PAGE_SIZE;
  return { page: Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1, size, performer: params.get('performer') || '',
    studio: params.get('studio') || '', tag: params.get('tag') || '', q: (params.get('q') || '').trim(),
    sort: sort === 'random' && seed ? 'random' : RELEASE_SORTS.find(([key]) => key === sort)?.[0] || 'release_date',
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc', seed,
    ...(params.get('column_filters') ? { column_filters: params.get('column_filters')! } : {}) };
}
const RELEASE_COLUMNS: Record<'performer' | 'studio' | 'tag', ColumnFilterKey> = { performer: 'people', studio: 'studio', tag: 'tags' };

export function releaseColumnSelection(filters: ReleaseFilters, facet: 'performer' | 'studio' | 'tag'): ColumnSelection | undefined {
  const selected = readColumnFilters(filters.column_filters)[RELEASE_COLUMNS[facet]];
  const values = facet === 'performer' ? mapColumnSelection(selected, value => value.slice('performer:'.length)) : selected;
  return filters[facet] ? columnValueSelected(values, filters[facet]) ? [filters[facet]] : [] : values;
}

export function releaseColumnValues(filters: ReleaseFilters, facet: 'performer' | 'studio' | 'tag'): string[] {
  const selected = releaseColumnSelection(filters, facet);
  return Array.isArray(selected) ? selected : [];
}

export function setReleaseColumn(filters: ReleaseFilters, facet: 'performer' | 'studio' | 'tag', values: ColumnSelection | undefined): ReleaseFilters {
  const selected = facet === 'performer' ? mapColumnSelection(values, value => `performer:${value}`) : values;
  return { ...filters, [facet]: '', page: 1,
    column_filters: writeColumnFilters(readColumnFilters(filters.column_filters), RELEASE_COLUMNS[facet], selected) };
}
export const releaseKey = (filters: ReleaseFilters) =>
  ['jav-releases', filters.page, filters.size, filters.performer, filters.studio, filters.tag, filters.q, filters.sort, filters.dir, filters.seed, filters.column_filters || ''] as const;
const RELEASE_FILTER_KEYS = ['performer', 'studio', 'tag', 'q', 'seed', 'column_filters'] as const;
function releaseParams(filters: ReleaseFilters) {
  const params = new URLSearchParams({ page: String(filters.page), size: String(filters.size),
    sort: filters.sort, direction: filters.dir });
  for (const key of RELEASE_FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);
  return params;
}
export function fetchReleases(filters: ReleaseFilters, signal: AbortSignal) {
  return apiGet<ReleaseResult>(`/api/jav/releases?${releaseParams(filters)}`, signal);
}
export function fetchReleaseColumn(filters: ReleaseFilters, column: 'people' | 'studio' | 'tags', search: string, offset: number, signal: AbortSignal) {
  const params = releaseParams(filters);
  params.set('column', column); params.set('column_q', search);
  params.set('column_offset', String(offset)); params.set('column_limit', '24');
  return apiGet<{ items: (ReleaseFacetPerformer | ReleaseFacetStudio | { name: string; count: number })[]; next_offset: number | null }>(`/api/jav/releases?${params}`, signal);
}
/** 新作页的资料读取：`start` 读当前筛选结果里从没读过的那几部，`cancel` 停下当前这一轮。
 *  与「发现」共用一个任务，进度同样由 `fetchDiscoveryMetadata` 轮询。 */
export function controlReleaseMetadata(action: 'start' | 'cancel', filters: ReleaseFilters, jobId = '', signal?: AbortSignal) {
  const body: Record<string, string> = { action, sort: filters.sort, direction: filters.dir, job_id: jobId };
  for (const key of RELEASE_FILTER_KEYS) if (filters[key]) body[key] = filters[key];
  return apiSend<DiscoveryMetadataStatus>('/api/jav/releases/metadata', body, 'POST', signal);
}

export function discoveryArtwork(item: Discovery, layout: 'big' | 'small', javImage: unknown): string {
  const local = javArtwork({ ...item, is_jav: true }, layout, false, javImage);
  if (local.html || !item.cover_url || !item.code) return local.html;
  const remote = esc(remoteCoverUrl(item));
  return coverImage(item, layout).replace(/ src="[^"]*"/,
    ` src="${remote}" data-jav-image="${item.id}" data-jav-cover="${remote}" data-jav-thumb="" data-jav-image-layout="${layout}"${layout === 'big' ? ' data-panel-prior="1"' : ''}`)
    .replace('data-drop="self"', `data-drop="initial" data-initial="${esc(t('shell:artworkGap.coverNotFound'))}" data-drop-class="media-nopic"`);
}

export async function prefetchJav(tab: string, signal: AbortSignal) {
  if (tab === 'wants') {
    await queryClient.ensureQueryData({ queryKey: WANTS_KEY, queryFn: () => fetchWants(signal),
      staleTime: 30_000, revalidateIfStale: true }); return;
  }
  if (tab === 'discover') {
    await queryClient.ensureQueryData({ queryKey: discoveryKey('external'), queryFn: () => fetchDiscoveries('external', signal),
      staleTime: 30_000, revalidateIfStale: true }); return;
  }
  if (tab === 'releases') {
    const filters = releaseFilters(location.search);
    await queryClient.ensureQueryData({ queryKey: releaseKey(filters), queryFn: () => fetchReleases(filters, signal),
      staleTime: 30_000, revalidateIfStale: true });
  }
}
