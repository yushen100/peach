import { islandButton, islandGlyph, islandSearchInput, islandShortcutsEntry } from './island-skeleton';
import { JAV_TABS } from './react/jav/jav-navigation';
import { cardRatio, gridLayout, javLayout, JAV_LAYOUTS } from './appearance';
import { DISCOVERY_SORTS, RELEASE_SORTS } from './react/jav/discovery-sorts';
import { tierPlaceholdersHtml } from './catalog-filter-skeleton';
import { filterControlsSkeletonHtml, sortKeysSkeletonHtml } from './filter-controls-skeleton';
import { listTableSkeletonHtml } from './catalog-content-skeleton';
import { catalogView } from './react/catalog-grid/catalog-view';
import { releaseTableSnapshot } from './react/jav/release-table-columns';
import { t } from './i18n';

const text = (width: string) => `<span data-jav-skeleton-text class="skeleton block rounded-md" style="width:${width}" aria-hidden="true"></span>`;
const cover = (classes: string) => `<span data-jav-skeleton-cover class="skeleton ${classes}"></span>`;
export const JAV_RECOMMENDATION_GRID = 'w-full min-w-0';

/** 查询中的标签沿用筛选条的高度与横向布局。 */
export function javTagSkeleton(): string {
  return ['w-20', 'w-16', 'w-24', 'w-20', 'w-16', 'w-24'].map(width =>
    `<span data-skeleton="tag" aria-hidden="true" class="skeleton-sheen relative block h-8 flex-none rounded-(--tag-radius) ${width}"></span>`).join('');
}

/** 占位复用推荐卡与想要行的宽度、封面比例和列数。 */
export function javContentSkeleton(tab: string, layout = javLayout()): string {
  if (tab === 'wants') return `<div class="flex w-full flex-col gap-8" data-skeleton="jav-wants">${text('5em')}${Array.from({ length: 3 }, () => `<div class="flex min-w-0 gap-4 rounded-2lg bg-background-secondary-default p-6">${cover('block w-card-cover shrink-0 aspect-card-cover rounded-2lg max-sm:w-24')}<div class="flex min-w-0 flex-1 flex-col gap-3">${text('80%')}${text('60%')}${text('40%')}</div></div>`).join('')}</div>`;
  const ratio = cardRatio({ ...gridLayout({ active: true, home: false, portrait: false }), size: layout });
  return `<div data-media-grid class="${JAV_RECOMMENDATION_GRID}" data-skeleton="jav-discover">${discoveryCardSkeleton(ratio).repeat(6)}</div>`;
}

/** 探索卡占位里随页面变的几处：卡底几颗键的宽度、有没有头像、卡上额外的属性（处理队列页的卡带
 *  `data-queue-card`，署名排法跟着它走）与标题占几行（垃圾卡的文件名由中段截断收成一行）。 */
export interface DiscoverySkeletonShape {
  actions?: readonly string[];
  avatar?: boolean;
  attrs?: string;
  titleLines?: 1 | 2;
}

/** 一张探索卡排法的占位：封面、头像、两行标题、署名、标签与一排动作键。高清版、垃圾文件的卡也是这一副，
 *  它们没有头像（`avatar` 为假）。 */
export function discoveryCardSkeleton(ratio: number | string,
  { actions = ['w-20', 'w-12', 'w-26'], avatar = true, attrs = '', titleLines = 2 }: DiscoverySkeletonShape = {}): string {
  return `<div data-jav-skeleton-card data-media-card data-jav-card${attrs} class="flex min-w-0 flex-col gap-3">
    <span data-jav-skeleton-cover class="skeleton block w-full rounded-2lg" style="aspect-ratio:${ratio}"></span>
    <div data-media-meta>${avatar ? '<span data-jav-skeleton-avatar class="skeleton block shrink-0"></span>' : ''}<div data-media-text>
      <div data-media-title${titleLines === 2 ? '' : ' style="min-height:0"'}>${text('85%')}${titleLines === 2 ? text('65%') : ''}</div><div data-media-byline><span data-media-who>${text('6em')}</span><span data-media-facts><span data-media-release>${text('7em')}</span></span></div>
      <div data-media-tags><span class="skeleton block h-5 w-20 rounded-md"></span><span class="skeleton block h-5 w-24 rounded-md"></span></div>
    </div></div>
    <div data-jav-skeleton-actions class="flex flex-wrap gap-2">${actions.map(width => `<span data-jav-skeleton-action class="skeleton block h-9 ${width} rounded-md"></span>`).join('')}</div>
  </div>`;
}

const SEARCH_LABELS: Record<string, string> = { releases: t('catalog:javSearch.filterReleases'), discover: t('catalog:javSearch.filterRecommended'), wants: t('catalog:javSearch.filterWants') };

/** 照 `JavPage` 的静止态画：页头一行是标题、靠右的筛选框（同名册页的 `IndexSearch` 骨架）与查找资源，
 *  分区按地址栏里的那一个按下，下面按分区画各自的筛选条与卡片占位。 */
export function javPageSkeleton(tab: string): string {
  const q = new URLSearchParams(location.search).get('q') || '';
  const body = tab === 'wants' ? `<div class="rounded-2lg bg-background-secondary-default px-6 py-5"><h3 class="mb-4 text-title-2-medium text-text-primary">${t('catalog:wants.addByCode')}</h3>${text('100%')}</div>${javContentSkeleton(tab)}`
    : tab === 'releases' ? `<section class="flex min-w-0 flex-col gap-4">${releasesFilterSkeleton()}${catalogView() === 'list'
      ? `<div data-catalog-table>${listTableSkeletonHtml(releaseTableSnapshot())}</div>` : javContentSkeleton(tab)}</section>`
    : `<section class="flex min-w-0 flex-col gap-4">${javFilterSkeleton()}${javContentSkeleton(tab)}</section>`;
  return `<div class="peach-react"><div class="flex w-full flex-col gap-6">
    <div class="flex w-full flex-col gap-4"><div class="flex min-w-0 flex-wrap items-center gap-3 max-board-narrow:gap-x-2"><h2 data-page-title class="text-display-4-medium text-text-primary max-board-narrow:text-title-1-medium">JAV</h2><div data-index-search class="ml-auto min-w-0 max-w-80 flex-1">${islandSearchInput('', q, SEARCH_LABELS[tab] || t('catalog:javDiscover.filter'))}</div>${islandButton({ variant: 'primary', label: t('catalog:shared.searchTorrents'), attrs: 'disabled data-skeleton-action' })}</div>
    <div class="relative flex flex-none gap-1 overflow-x-auto max-board-narrow:gap-0">${JAV_TABS.map(([key, label]) => `<span class="relative flex flex-none items-center whitespace-nowrap rounded-md px-3 py-2 text-body-regular max-board-narrow:px-2.25 max-board-narrow:text-body-2-regular ${key === tab ? 'bg-background-tertiary-default text-text-primary' : 'text-text-secondary'}">${label}</span>`).join('')}</div></div>
    ${body}</div></div>`;
}

/** 新作分区等数据时的两排头像与筛选条：头像、厂牌、标签用馆藏同一份占位，下排是换一批、卡片版式、卡片／列表与
 *  排序键（照地址栏里的排序按下），同 `jav-releases.tsx` 取到数据后的样子。 */
export function releasesFilterSkeleton(): string {
  const params = new URLSearchParams(location.search);
  const sort = params.get('sort') || 'release_date';
  const dir: 'asc' | 'desc' = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const sorts = RELEASE_SORTS.map(([key, label, ariaLabel]) => ({ key, label, ariaLabel, pressed: key === sort,
    dir: key === sort ? dir : '' as const }));
  return `<div data-catalog-tiers="" aria-busy="true"><div data-catalog-tier="performers" data-skeleton="tiers">${tierPlaceholdersHtml('performer')}</div><div data-catalog-tier="studios">${tierPlaceholdersHtml('studio')}</div></div>
  <div data-filter-glass data-glass-pane data-filter-frame data-jav-filter data-catalog-frame class="sticky top-topbar z-10 mb-5.5 flex flex-col">
    <div data-filter-row="top" class="flex h-12 min-w-0 items-center overscroll-x-contain px-3 py-2 gap-1.5 overflow-visible">
      <div data-catalog-scroll><div data-catalog-tags>${javTagSkeleton()}</div></div>
    </div>
    <div data-filter-row="bottom" aria-busy="true" class="flex min-h-12 min-w-0 items-center gap-3 px-3 py-2">
      <span data-catalog-readout><span data-skeleton="count" class="relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"></span></span>
      ${filterControlsSkeletonHtml(sorts, { name: 'jav-layout', label: t('catalog:entityFilter.javCardLayout'), value: javLayout(), options: JAV_LAYOUTS }, { folders: false, group: 'releases' })}
    </div>
  </div>`;
}

/** 首屏筛选控件使用首页的两排容器；标签和读数依赖查询。 */
function javFilterSkeleton(): string {
  const scope = (key: string, label: string) => `<button type="button" data-entity-tag="${key}" data-entity-press="" aria-pressed="${key === 'external'}" class="flex h-8 flex-none items-center gap-1.75 rounded-lg border border-dashed border-(--glass-low) bg-transparent px-2.5 text-body-2-regular leading-5 whitespace-nowrap text-inherit">${label}</button>`;
  const size = (value: string, glyph: string) => `<span data-glass-segment="" ${javLayout() === value ? 'data-selected="true"' : ''} class="flex size-8 flex-none items-center justify-center rounded-lg text-(--glass-text)/62">${islandGlyph(glyph, 'size-4')}</span>`;
  return `<div data-filter-glass data-glass-pane data-filter-frame data-jav-filter data-catalog-frame class="sticky top-topbar z-10 mb-5.5 flex flex-col">
    <div data-filter-row="top" class="flex h-12 min-w-0 items-center overscroll-x-contain px-3 py-2 gap-1.5 overflow-visible">
      <div data-catalog-scroll><div data-catalog-views>${scope('external', t('catalog:javDiscover.external'))}${scope('library', t('catalog:javDiscover.library'))}<span data-entity-sep aria-hidden="true"></span></div><div data-catalog-tags>${javTagSkeleton()}</div></div>
    </div>
    <div data-filter-row="bottom" aria-busy="true" class="flex min-h-12 min-w-0 items-center gap-3 px-3 py-2">
      <span data-catalog-readout><span data-skeleton="count" class="relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"></span></span>
      ${islandShortcutsEntry()}
      <span data-entity-sorts><button type="button" data-entity-batch data-filter-action data-skeleton-action data-jav-metadata-update title="${t('catalog:javDiscover.updateMetadata')}" aria-label="${t('catalog:javDiscover.updateMetadata')}" disabled>${islandGlyph('refresh-cw', 'size-4')}</button><span data-entity-layout class="inline-flex w-max max-w-full flex-none items-center gap-0.5 rounded-lg">${size('big', 'maximize')}${size('small', 'layout-grid')}</span>
        ${sortKeysSkeletonHtml(DISCOVERY_SORTS.map(([key, label, ariaLabel]) => ({ key, label, ariaLabel, pressed: key === 'taste', dir: key === 'taste' ? 'desc' : '' })), 'discover')}
      </span>
    </div>
  </div>`;
}
