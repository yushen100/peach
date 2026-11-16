/* 任务卡标题前的图标：按任务做的事分十类，同类共用一枚。关注、数据管理、口味三类与导航里对应页面同一枚，
 * 其余按对象选。35 种任务各配一枚会有一半长得差不多，反而认不出来。不在表里的任务用通用任务图标。 */
import type { RemixiconComponentType } from '@remixicon/react';
import {
  RiDownloadCloud2Line, RiFileSearchLine, RiFilmLine, RiHardDrive3Line, RiHeart3Line, RiImage2Line,
  RiLinksLine, RiRssLine, RiTaskLine, RiToolsLine, RiUser3Line,
} from '@remixicon/react';

type Icon = RemixiconComponentType;

const FAMILIES: [Icon, string[]][] = [
  [RiRssLine, ['follow-check', 'follow-resolve', 'follow-creator', 'follow-evidence-reclaim', 'follow-backfill', 'feed-check', 'feed-scrape',
    'feed-cover']],
  [RiHardDrive3Line, ['library-processing', 'organize', 'batch', 'resource-scan', 'resource-apply', 'seed-import']],
  [RiFileSearchLine, ['scrape-codes', 'jav-discovery-metadata', 'want-scrape', 'upgrade-library']],
  [RiImage2Line, ['scraping-cover', 'jav-covers', 'code-samples', 'timeline-thumbnails', 'entity-avatar',
    'cover-artwork-repair']],
  [RiUser3Line, ['performer-profile', 'performer-alias', 'creator-identity', 'studio-mark']],
  [RiFilmLine, ['media-repair', 'mp4-header-repair']],
  [RiLinksLine, ['link-check', 'link-prune', 'source-check']],
  [RiDownloadCloud2Line, ['download-postprocess', 'want-search']],
  [RiHeart3Line, ['taste-refresh']],
  [RiToolsLine, ['upgrade-repairs', 'diagnostic-export', 'amane-bridge', 'face-models', 'ledger-backup', 'ledger-restore']],
];

const ICONS = new Map(FAMILIES.flatMap(([icon, keys]) => keys.map((key) => [key, icon] as const)));

export function TaskIcon({ taskKey, className }: { taskKey: string; className: string }) {
  const Icon = ICONS.get(taskKey) ?? RiTaskLine;
  return <Icon className={className} aria-hidden />;
}
