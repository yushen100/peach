/* 设置偏好与 Peach 配置的五份服务端数据，各一个 Query 键。
 *
 * - `['settings']`：跟数据库走、所有访问端同一份的那几项（`/api/settings`，`src/peach/web_settings.py`）。
 *   面板每次打开都重取一次，取回来交给壳对账（`host.syncRemote`）：界面偏好的真相仍是壳里那一份
 *   `appSettings`，这个键只是数据库那边的快照。写入同样走这个端点，成功后回来的整份写回这个键。
 * - `['follow-schedule']`：这台机器上关注自动更新的档位与上次运行状态。
 * - `['feed-schedule']`：订阅源定时拉取的档位与上次运行状态，形状同上，只读。
 * - `['thumbnail-jobs']`：视频缩略图采集的档位与状态。档位跟着机器走，不存在浏览器里。
 * - `['media-processing']`：这台机器生成预览的开关与抽帧、转码的编解码方式。配置页「视频预览」与
 *   「视频播放」两张卡读写同一份。
 *
 * 面板常驻不卸载，每次打开重取设置；Peach 配置在挂载时重取各自的数据。 */
import type { InterfaceLanguageChoice } from '../../i18n';
import type { NameLanguage } from '../../core/entity-names';
import { useMutation, type QueryClient } from '@tanstack/react-query';

import { apiGet, apiSend } from '../../api';
import { withBackoff } from '../../polling';
import { queryClient } from '../query';
import type { NavigationOrders } from '../../navigation-order';
import type { SortControls } from '../../sort-controls';

export const SETTINGS_URL = '/api/settings';
export const FOLLOW_SCHEDULE_URL = '/api/follow/schedule';
export const FEED_SCHEDULE_URL = '/api/feeds/schedule';
export const THUMBNAIL_JOBS_URL = '/api/thumbnail-jobs';

export const SETTINGS_KEY = ['settings'] as const;
export const FOLLOW_SCHEDULE_KEY = ['follow-schedule'] as const;
export const FEED_SCHEDULE_KEY = ['feed-schedule'] as const;
export const THUMBNAIL_JOBS_KEY = ['thumbnail-jobs'] as const;
export const MEDIA_PROCESSING_URL = '/api/media-processing';
export const MEDIA_PROCESSING_KEY = ['media-processing'] as const;

/** `/api/media-processing` 的整份；写入只送改了的那一项，回来的仍是整份。 */
export interface MediaProcessingPolicy {
  metadata_only: boolean;
  preview_acceleration?: 'auto' | 'software';
  playback_acceleration?: 'auto' | 'software';
  /** 播放转码的画质上限（短边像素），0 为原画。 */
  playback_max_height?: number;
}
export const fetchMediaProcessing = (signal?: AbortSignal) =>
  apiGet<MediaProcessingPolicy>(MEDIA_PROCESSING_URL, signal);

/** `q_settings` 返回的整份；写入时只送改了的那几个键，回来的仍是整份。 */
export interface SyncedSettings {
  taskSpeedMode?: 'low' | 'standard' | 'high';
  performerNameLanguage?: NameLanguage;
  interfaceLanguage?: InterfaceLanguageChoice;
  systemLanguage?: string | null;
  sidebarOrder?: string[];
  manageOrder?: string[];
  navigationOrders?: NavigationOrders;
  sortControls?: SortControls;
  libraryOrder?: string[];
  followInitialDays?: number;
  postSetupTutorialDone?: boolean;
  feedHideGroupCompilations?: boolean;
  feedHideSoloCompilations?: boolean;
  feedHideExcerpts?: boolean;
  /** 数据库里还没存过时是 null：这台设备本地那个数替所有访问端先定下来。 */
  searchHistoryLimit?: number | null;
  /** 番号识别规则，一条一个正则；配置页「媒体库与入库」里编辑。 */
  codePatterns?: string[];
  /** 「想要」老片多久再查一次（天），以及查几次没找到就暂时放弃（0 表示一直查）。 */
  wantStaleSearchDays?: number;
  wantStaleAttemptLimit?: number;
  /** 每趟扫描与采集向外部来源要的总量：请求次数、小时数、GB 数，档位与服务端 `SOURCE_BUDGET_CHOICES` 一致。 */
  sourceBudgetRequests?: number;
  sourceBudgetHours?: number;
  sourceBudgetGigabytes?: number;
  /** 没有别的封面时用 JavDB 带水印的图（#531），默认关。 */
  javdbCoverFallback?: boolean;
}

export interface FollowScheduleStatus {
  available: boolean;
  enabled: boolean;
  interval_minutes: number;
  running?: boolean;
  last_error?: string | null;
  last_finished_at?: string | null;
  last_added?: number | null;
  next_run_at?: string | null;
  /** 连续失败的轮数；从第二次起下一轮按倍数推后。 */
  consecutive_failures?: number;
}

export interface ThumbnailJobStatus {
  mode: string;
  status: 'idle' | 'running' | 'failed' | 'complete' | string;
  stopped?: string;
}

export const fetchSettings = (signal?: AbortSignal) => apiGet<SyncedSettings>(SETTINGS_URL, signal);
export const fetchFollowSchedule = (signal?: AbortSignal) =>
  apiGet<FollowScheduleStatus>(FOLLOW_SCHEDULE_URL, signal);
export const fetchFeedSchedule = (signal?: AbortSignal) =>
  apiGet<FollowScheduleStatus>(FEED_SCHEDULE_URL, signal);
export const fetchThumbnailJobs = (signal?: AbortSignal) =>
  apiGet<ThumbnailJobStatus>(THUMBNAIL_JOBS_URL, signal);

/** 打开偏好弹窗时重取共享设置；采集状态由 Peach 配置中的控件读取。 */
export function refreshPanelData(client: QueryClient = queryClient): Promise<SyncedSettings | null> {
  return client.fetchQuery({
    queryKey: SETTINGS_KEY, queryFn: ({ signal }) => fetchSettings(signal), staleTime: 0,
  }).catch(() => null);
}

/** 写跟数据库走的那几项。回来的是合并之后的整份，写回 `['settings']`。 */
export function useSaveSettings(scope?: string) {
  return useMutation({
    scope: scope ? { id: scope } : undefined,
    mutationFn: (patch: SyncedSettings) => apiSend<SyncedSettings>(SETTINGS_URL, patch),
    onSuccess: (saved) => queryClient.setQueryData(SETTINGS_KEY, saved),
  }, queryClient);
}

/** 关注与订阅源两份定时的读写：同一套调度实现，只换地址、缓存键和关掉时留着的默认间隔。 */
export const SCHEDULES = {
  follow: { url: FOLLOW_SCHEDULE_URL, key: FOLLOW_SCHEDULE_KEY, fetch: fetchFollowSchedule, fallback: 60 },
  feed: { url: FEED_SCHEDULE_URL, key: FEED_SCHEDULE_KEY, fetch: fetchFeedSchedule, fallback: 360 },
} as const;

/** 存一份定时：传 0 是关掉，其余是间隔分钟数。 */
export function useSaveSchedule(kind: keyof typeof SCHEDULES) {
  const { url, key, fallback } = SCHEDULES[kind];
  return useMutation({
    mutationFn: (minutes: number) => apiSend<FollowScheduleStatus>(url,
      { enabled: minutes > 0, interval_minutes: minutes || fallback }),
    onSuccess: (status) => queryClient.setQueryData(key, status),
  });
}

/** 两个调度各自的「立即重跑」：服务端把下一轮提前到此刻，回来的状态已标成运行中。 */
export const SCHEDULE_RUNS = {
  follow: { url: `${FOLLOW_SCHEDULE_URL}/run`, key: FOLLOW_SCHEDULE_KEY },
  feed: { url: `${FEED_SCHEDULE_URL}/run`, key: FEED_SCHEDULE_KEY },
} as const;

export function useRunSchedule(kind: keyof typeof SCHEDULE_RUNS) {
  const { url, key } = SCHEDULE_RUNS[kind];
  return useMutation({
    mutationFn: () => apiSend<FollowScheduleStatus>(url, {}),
    onSuccess: (status) => queryClient.setQueryData(key, status),
  });
}

/** 调度正在跑时三秒重取一次，跑完就停，失败原因随之出现或消失；读失败按连续失败次数退避。
 *  直接作 `refetchInterval`。 */
export const schedulePollInterval = withBackoff<FollowScheduleStatus>((data) => (data?.running ? 3_000 : false));

export function useSaveThumbnailMode() {
  return useMutation({
    mutationFn: (mode: string) => apiSend<ThumbnailJobStatus>(THUMBNAIL_JOBS_URL, { mode }),
    onSuccess: (status) => queryClient.setQueryData(THUMBNAIL_JOBS_KEY, status),
  });
}
