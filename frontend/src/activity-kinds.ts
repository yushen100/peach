/* 后台任务做的是哪一类事，决定它在等待时画哪一枚语义动画（`ui-kit/activity-motion.ts`）。
 *
 * 全站只有这一张对照表：活动页任务卡、扫描与采集通知卡、关注页面板与 `TaskProgress` 都查它。
 * 有后端阶段 code（`stage_code`）时先按阶段，阶段比任务名说得细（扫描与采集一趟里先查文件、
 * 再抓资料、最后写候选）；没有阶段按任务中心的 `task_key`；都对不上按传输画，它也兼做语义
 * 不明的通用后台推进。不是任务中心任务的等待（查建议、搜磁力、等浏览器登录）由调用处直接给类别。 */
import type { ActivityKind } from './ui-kit/activity-motion';

export type { ActivityKind } from './ui-kit/activity-motion';

/** 排队、等外部 → Clock；搜索、检查、探测 → Radar；传输 → LinearDots；写入入库 → Gather；整理、分析 → Blocks。 */
const TABLE: Record<ActivityKind, readonly string[]> = {
  clock: [
    'stage:job.waitingForUpdate', 'stage:library.startAll', 'stage:library.startCollect', 'stage:library.startPreviews',
    'stage:library.startScan',
  ],
  radar: [
    'follow-check', 'feed-check', 'follow-resolve', 'follow-creator', 'creator-identity', 'link-check', 'source-check',
    'resource-scan', 'want-search',
    'stage:library.scanFiles', 'stage:library.checkCompanions', 'stage:library.probeMedia', 'stage:library.checkNetwork',
    'stage:library.checkJunk', 'stage:library.recheckJunk', 'stage:library.prepareImages', 'stage:library.readImages',
    'stage:backup.checkIntegrity', 'stage:diagnostics.readSystem', 'stage:mediaRepair.scan',
    'stage:mediaRepair.readTimestamps', 'stage:organize.checkingPlan', 'stage:download.probeMedia',
    'step:sources', 'step:inspect', 'step:local',
  ],
  'linear-dots': [
    'feed-cover', 'feed-scrape', 'scraping-cover', 'jav-covers', 'code-samples', 'want-scrape', 'scrape-codes',
    'performer-profile', 'performer-alias', 'entity-avatar', 'studio-mark', 'jav-discovery-metadata', 'face-models',
    'stage:library.prepareMetadata', 'stage:library.prepareSources', 'stage:library.fetchMetadata',
    'stage:library.fetchCovers', 'stage:library.fillPerformerProfiles', 'stage:download.fetchMetadata',
    'step:collect',
  ],
  gather: [
    'seed-import', 'ledger-backup', 'ledger-restore', 'download-postprocess', 'resource-apply', 'link-prune',
    'stage:library.saveCandidates', 'stage:library.collectResults', 'stage:download.organizeFiles',
  ],
  blocks: [
    'organize', 'batch', 'library-processing', 'media-repair', 'mp4-header-repair', 'taste-refresh', 'diagnostic-export',
    'amane-bridge', 'timeline-thumbnails', 'upgrade-library', 'upgrade-repairs', 'follow-evidence-reclaim', 'follow-backfill',
    'cover-artwork-repair',
    'stage:library.preparePreviews', 'stage:library.makePreviews', 'stage:backup.migrateBackup', 'stage:mediaRepair.repair',
    'stage:organize.running', 'stage:organize.rollingBack', 'stage:download.isolateExtras',
    'step:media',
  ],
};

const KINDS = new Map<string, ActivityKind>(
  (Object.entries(TABLE) as [ActivityKind, readonly string[]][]).flatMap(([kind, keys]) => keys.map((key) => [key, kind] as const)));

/** 这一趟画哪一枚：阶段 code 优先，其次任务名，都没有登记就是传输。 */
export function activityKind(taskKey?: string | null, stageCode?: string | null): ActivityKind {
  return (stageCode && KINDS.get(`stage:${stageCode}`)) || (taskKey && KINDS.get(taskKey)) || 'linear-dots';
}

/** 扫描与采集通知卡里步骤清单的当前那一步（服务端 `steps[].id`）。 */
export function stepActivityKind(stepId: string): ActivityKind {
  return KINDS.get(`step:${stepId}`) || activityKind('library-processing');
}
