/* 处理队列页（垃圾文件、高清版、重复文件）的首屏骨架，不依赖 React。
 *
 * 排序键的样子读 `queue-sort-choice.ts`，与页面同一份。内容骨架按当前卡片／列表（`catalogView`）画，卡片是
 * JAV 探索卡那一副（`jav-skeleton.ts` 的 `discoveryCardSkeleton`），列表是首页列表那一副（`listTableSkeletonHtml`）。 */
import { catalogView } from './react/catalog-grid/catalog-view';
import { filterControlsSkeletonHtml } from './filter-controls-skeleton';
import { listTableSkeletonHtml } from './catalog-content-skeleton';
import { discoveryCardSkeleton, type DiscoverySkeletonShape } from './jav-skeleton';
import { queueSortKeys, rememberedQueueSort, type QueuePage } from './queue-sort-choice';
import { queueTableSnapshot } from './queue-columns';
import { esc } from './core';

/** 浮层下排右边那组的等待态：卡片／列表（重复文件没有）与排序键。 */
export const queueControlsSkeletonHtml = (page: QueuePage): string =>
  filterControlsSkeletonHtml(queueSortKeys(page, rememberedQueueSort(page)), null,
    { folders: false, shuffle: false, views: page !== 'duplicates' });

/** 外层：占满壳那一格旧网格的整行。`label` 为空时不自带等待状态——嵌在整页骨架里（高清版）时，
 *  等待语义归外面那一层，一页只报一次。 */
const wrap = (key: string, label: string, body: string) => `<div class="peach-react catalog-skeleton" data-skeleton="queue/${key}"`
  + (label ? ` role="status" aria-busy="true" aria-label="${esc(label)}"` : '') + `>${body}</div>`;

/** 一格探索卡排法的卡片网格占位（回收站也用），`shape` 同落地那张卡：键宽、头像、队列卡属性与标题行数。 */
export function discoveryGridSkeletonHtml(key: string, label: string, ratio: number | string, shape: DiscoverySkeletonShape): string {
  return wrap(`${key}/cards`, label, `<div data-media-grid="">${discoveryCardSkeleton(ratio, shape).repeat(6)}</div>`);
}

/** 内容骨架：列表版式画首页列表那一副表格，卡片版式画六张探索卡。队列卡没有头像、署名一行，
 *  垃圾卡的文件名收成一行。 */
export function queueContentSkeletonHtml(page: 'junk-files' | 'quality-goals', label: string, actions: readonly string[]): string {
  if (catalogView() !== 'list') return discoveryGridSkeletonHtml(page, label, '16 / 9',
    { actions, avatar: false, attrs: ' data-queue-card', titleLines: page === 'junk-files' ? 1 : 2 });
  return wrap(`${page}/list`, label, `<div data-catalog-table="">${listTableSkeletonHtml(queueTableSnapshot(page))}</div>`);
}

/** 垃圾文件网格的等待态：壳首屏与页面揭示层共用。 */
export const junkContentSkeletonHtml = (label: string): string => queueContentSkeletonHtml('junk-files', label, ['w-20', 'w-20', 'w-24']);
