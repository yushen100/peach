/* 管理区各页（连同播放列表页）的加载态只有一份定义：壳在深链冷启动时铺它，路由树的页面元素挂上时也铺它。
 * 两处各写各的时，整页刷新会连播两段动画：先一张通用大布局骨架，再各页自己的加载态。取同一份，
 * `data-skeleton` 的键就相同，后铺的那一处认出是同一张后不再重画（`paintManagementPlaceholder`）。
 *
 * 版式照 `boardPageSkeleton` 画的那几页之外，数据管理首页与各个维护工具（`cleanup-tool-skeletons.ts`）、复核和
 * 采集来源各有一张，其余路径落到通用面板。 */
import { esc } from '@peach/legacy/core';
import { fitSkeleton, skeletonHtml } from '@peach/legacy/ui';

import { boardPageSkeleton } from './board-skeleton';
import { cleanupToolSkeletonHtml } from './cleanup-tool-skeletons';
import { CLEANUP_TOOLS } from './cleanup-tools';
import { cleanupSkeletonHtml } from './management';
import { appSettingsStore } from './appearance/settings';
import { NAVIGATION_GROUPS, normalizeNavigationOrder } from './navigation-order';
import { t } from './i18n';

export interface PageSkeletonOptions {
  cards?: boolean;
  className?: string;
  variant?: string;
  count?: number;
  fill?: boolean;
  cardRatio?: number;
  gridClass?: string;
  gridSize?: string;
}

/** 整页骨架：`cards` 画卡片网格，否则画面板；只把给了的几项交下去，其余用 `skeletonHtml` 自己的缺省。 */
export const pageSkeletonHtml = (
  label: string,
  { cards = false, className = '', variant = '', count, fill, cardRatio, gridClass = '', gridSize = '' }: PageSkeletonOptions = {},
): string => skeletonHtml(label, {
  variant: variant || (cards ? 'cards' : 'panel'), className, gridClass, gridSize,
  ...(count ? { count } : {}), ...(fill === undefined ? {} : { fill }), ...(cardRatio ? { cardRatio } : {}),
});

/* 分类名是静态文案，骨架直接写出来；次序就是页签次序，与复核页那一份一致。 */
const reviewLabels = () => normalizeNavigationOrder('review', appSettingsStore().value.navigationOrders.review)
  .map(key => NAVIGATION_GROUPS.review.items.find(([id]) => id === key)![1]);
/* 复核页是左边一列分类、右边工具条加一格一格 Fieldset，骨架就用最终容器的那几个类名，
   分栏、列宽和卡高全由页面自己那套规则给：读完数据只是把占位换成内容，版面一格不挪。
   分类名和「复核分类」这两样与数据无关，直接写出来；等的是每类多少条，所以只有计数
   那一枚是占位。工具条上那三件——分组方式、分类筛选、全选本页——要等队列回来才知道
   选项和条数，三枚占位一件对一件。 */
const reviewSkeletonHtml = (label = t('manage:reviewSkeleton.loading')): string => `<div class="review review-workspace review-skeleton" data-skeleton="review" aria-busy="true" aria-label="${esc(label)}">
  <div class="reviewcontrols" data-section-nav><h2 class="review-category-title">${esc(t('manage:reviewPage.categories'))}</h2>
    <div class="reviewtabs" data-section-items>${reviewLabels().map((text, i) =>
      `<button type="button" disabled aria-selected="${i === 0}">${esc(text)}<span class="skeleton reviewcountskeleton" aria-hidden="true"></span></button>`).join('')}</div></div>
  <div class="reviewbulkbar reviewbulktoolbar" aria-hidden="true">${'<span class="skeleton reviewtoolskeleton"></span>'.repeat(3)}</div>
  <section class="reviewsection"><div class="reviewlist">${
    '<div class="skeletoncard" aria-hidden="true"><i></i><b></b><em></em></div>'.repeat(6)}</div></section></div>`;

const PLACEHOLDERS: Record<string, () => string> = {
  '/data-cleanup': () => cleanupSkeletonHtml(),
  /* 每个维护工具都有自己那一页的骨架，新加的工具不会落到下面那张通用面板上。 */
  ...Object.fromEntries(CLEANUP_TOOLS.map(tool => [tool.path, () => cleanupToolSkeletonHtml(tool.key)])),
  // 旧地址 /resource-sync 打开后转到资源同步二级页，占位先画成那一页，转过去时同一个键不重画。
  '/resource-sync': () => cleanupToolSkeletonHtml('resource-sync'),
  '/review': () => reviewSkeletonHtml(),
  /* 来源目录与正文保持同一分栏，来源名称等数据到齐后替换占位。 */
  '/sources': () => `<div class="scraping-page"><p>${esc(t('manage:scrapingSources.proxyHint'))}</p>
    <div data-section-page><div data-section-toc aria-hidden="true">
      ${Array.from({ length: 12 }, () => '<div class="skeleton" style="height:36px;margin-bottom:4px;border-radius:8px"></div>').join('')}
    </div><div>${pageSkeletonHtml(t('manage:scrapingSources.loading'), { cards: true, count: 4, fill: false, className: 'cleanup-skeleton' })}</div></div></div>`,
};

/** 关注管理的骨架照这台浏览器上次选的视图画，排序框与方向键照地址栏上的那一档画：等数据的这段时间画成
 *  卡片、数据到了换成表格的话，同一次进入里版式会整个翻一遍。 */
export interface FollowSkeletonState {
  followLayout: string;
  followSort: string;
  followDir: string;
}

/** 这一页的加载态 HTML。 */
export function managementSkeletonHtml(path: string, { followLayout, followSort, followDir }: FollowSkeletonState): string {
  return boardPageSkeleton(path, { followLayout, ...(path === '/subscriptions' ? { followSort, followDir } : {}) })
    || (PLACEHOLDERS[path] ?? (() => pageSkeletonHtml(t('manage:manageSkeleton.loadingPage'))))();
}

/** 骨架的键：同一个键说明是同一张，不必重画。 */
export const skeletonKeyOf = (html: string): string => String(html).match(/data-skeleton="([^"]*)"/)?.[1] || '';

/** 把加载态铺进容器。容器里已经是同一张骨架就不动：innerHTML 换新节点会把 shimmer 从头放一遍，
 *  整页刷新看到的就是同一段动画闪两次。 */
export function paintManagementPlaceholder(container: HTMLElement, placeholder: string): void {
  const painted = container.querySelector<HTMLElement>('[data-skeleton]')?.dataset.skeleton || '';
  const next = skeletonKeyOf(placeholder);
  if (!next || next !== painted) {
    container.innerHTML = placeholder;
    fitSkeleton(container);
  }
}
