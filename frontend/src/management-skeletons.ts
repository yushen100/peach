import { islandButton, islandGlassRows, islandSelect } from './island-skeleton';
import { queueContentSkeletonHtml, queueControlsSkeletonHtml } from './queue-skeleton';
import { RESULT_PANEL, RESULT_SECTION } from './react/components/fieldset';
import { t } from './i18n';

const placeholder = 'relative overflow-hidden skeleton-sheen bg-background-tertiary-default rounded-lg';
const text = (width = '60%') => `<span class="${placeholder} inline-block max-w-full align-middle" style="width:${width};height:1em"></span>`;
const wait = 'disabled data-skeleton-action';
const chart = 'min-w-0 rounded-2-5xl bg-background-secondary-default p-5 flex flex-col gap-4 max-sm:p-4';
/** Board UI `Checkbox` 的未勾静止态：`md` 16px 框配 14px 字，`sm` 14px 框配 13px 字，和组件同一副间距。 */
const check = (label = '', size: 'md' | 'sm' = 'md', className = '') => `<span class="group inline-flex items-center select-none ${size === 'sm' ? 'gap-1.5' : 'gap-2'} ${className}">`
  + `<span class="flex shrink-0 items-center justify-center rounded-sm ${size === 'sm' ? 'size-3.5' : 'size-4'} border bg-background-primary-default shadow-xs border-border-checkbox-default"></span>`
  + `${label ? `<span class="${size === 'sm' ? 'text-body-2-medium' : 'text-body-medium'} text-text-primary">${label}</span>` : ''}</span>`;
/** 文字动作与 `FilterActionButton` 使用同档 BoardUI 按钮。 */
const filterAction = (label: string) => islandButton({ label, size: 'small', variant: 'secondary', attrs: wait });

/** 统计首屏与 StatsPage 的读数卡、双列库存图和三列分布图共用布局。 */
export function statsSkeleton(): string {
  const metrics = [t('manage:statsSkeleton.collection'), t('manage:shared.watched'), t('manage:statsSkeleton.contentTags'), t('manage:statsSkeleton.spaceUsed')].map((label, index) => `
    <div class="min-w-0 rounded-2xl shadow-card flex flex-col overflow-hidden pt-4 text-left ${index === 0 ? 'ring-2 ring-border-focus-ring bg-background-primary-default' : 'bg-background-secondary-default'}">
      <span class="flex min-w-0 items-center gap-2 px-4 text-body-regular text-text-secondary max-sm:gap-1.5 max-sm:px-3"><i class="${placeholder} size-7 max-sm:size-6"></i>${label}</span>
      <b class="px-4 pt-3 pb-4 text-title-1-medium max-sm:px-3 max-sm:pb-3 max-sm:text-title-3-medium">${text('4em')}</b>
      <small class="mt-auto block min-h-9.5 bg-card-footer px-4 py-2.5 text-caption-1-regular max-sm:px-3 max-sm:py-2">${text('6em')}</small>
    </div>`).join('');
  const radial = (title: string) => `<section class="${chart}" data-stats-chart>
    <header class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1"><span class="flex min-w-0 flex-col gap-1"><h3 class="text-title-2-medium text-text-primary">${title}</h3><b class="text-display-4-medium">${text('4em')}</b></span><small class="text-caption-1-regular text-text-secondary">${t('manage:radialCard.videoUnit', { count: 0 })}</small></header>
    <svg class="h-75 w-full max-sm:h-65 text-background-tertiary-default" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="12">${[76, 54, 32].map(r => `<circle cx="100" cy="100" r="${r}"/>`).join('')}</svg>
    <div class="inline-grid w-full grid-cols-3 gap-2 max-sm:grid-cols-2">${Array.from({ length: 3 }, () => `<div class="flex min-w-0 flex-col gap-1 rounded-xl bg-background-tertiary-default p-2.5"><span class="text-caption-1-regular">${text()}</span><b class="text-title-2-medium">${text('3em')}</b><small class="text-caption-1-regular">${text()}</small></div>`).join('')}</div>
  </section>`;
  return `<div class="peach-react"><div class="mx-auto flex w-full max-w-board flex-col gap-8">
    <div class="flex flex-col gap-4"><div class="inline-grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-stats-metrics>${metrics}</div>
      <div class="flex flex-col gap-5"><div class="inline-grid w-full gap-5 md:grid-cols-2">${radial(t('manage:stats.cloudAndLocal'))}${radial(t('manage:shared.library'))}</div>
        <div class="inline-grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3">${[t('manage:shared.duration'), t('manage:shared.quality'), t('manage:stats.fileTypes')].map(title => `<section class="${chart}"><h3 class="text-title-2-medium">${title}</h3><div class="${placeholder} h-64"></div></section>`).join('')}</div>
      </div>
    </div>
    <section class="rounded-surface bg-background-secondary-default dark:bg-background-primary-default">
      <div class="flex flex-wrap gap-3 px-4 pt-3 text-body-regular">${[t('manage:statsSkeleton.contentTags'), t('manage:stats.recentlyWatched'), t('manage:stats.tagSources')].map(label => `<span>${label}</span>`).join('')}</div>
      <div class="flex flex-col gap-3 px-4 pt-3.5 pb-4">${Array.from({ length: 5 }, () => `<div class="${placeholder} h-7"></div>`).join('')}</div>
    </section>
  </div></div>`;
}

/** 口味页首屏，按 TastePage 默认那一页（浏览器记录）排：工具行、读数带、画像卡、两张热力图、
 *  流向图与维度面板。分段、范围框与读取键取 React 那侧渲染出的同一串类名，只有读数与图画占位。 */
export function tasteSkeleton(): string {
  const segment = 'flex min-h-7 flex-none items-center gap-1.5 rounded-md px-2.5 py-1 text-body-medium whitespace-nowrap text-text-secondary data-selected:bg-background-primary-default data-selected:text-text-primary data-selected:shadow-card dark:data-selected:bg-background-primary-hover';
  const track = (labels: string[]) => `<div class="inline-flex w-max max-w-full items-center gap-0.5 overflow-x-auto rounded-2lg bg-background-tertiary-default p-1" data-taste-segments>${labels.map((label, index) => `<span class="${segment}"${index === 0 ? ' data-selected="true"' : ''}>${label}</span>`).join('')}</div>`;
  const metrics = [t('manage:tasteSkeleton.browsingHistory'), t('manage:tasteSkeleton.tasteDimensions'), t('manage:tasteSkeleton.browsingLeads'), t('manage:tasteSkeleton.privateExports')].map(label => `
    <div class="min-w-0 rounded-2xl shadow-card bg-background-secondary-default flex flex-col overflow-hidden pt-4 text-left">
      <span class="flex min-w-0 items-center gap-2 px-4 text-body-regular text-text-secondary max-sm:gap-1.5 max-sm:px-3"><i class="${placeholder} size-7 max-sm:size-6"></i>${label}</span>
      <b class="px-4 pt-3 pb-4 text-title-1-medium max-sm:px-3 max-sm:pb-3">${text('4em')}</b>
      <small class="mt-auto block min-h-9.5 bg-card-footer px-4 py-2.5 text-caption-1-regular max-sm:px-3 max-sm:py-2">${text('6em')}</small>
    </div>`).join('');
  const card = 'min-w-0 bg-background-secondary-default rounded-2xl shadow-card p-5 flex flex-col gap-4';
  const bars = Array.from({ length: 6 }, () => `<div class="${placeholder} h-6"></div>`).join('');
  const heat = (title: string) => `<section class="${chart}"><h3 class="text-title-2-medium text-text-primary">${title}</h3><div class="${placeholder} h-40"></div></section>`;
  return `<div class="peach-react"><div class="mx-auto flex w-full max-w-board flex-col gap-8">
    <div class="flex flex-col gap-5">
      <div class="flex flex-wrap items-center justify-between gap-3">${track([t('manage:taste.browserHistory'), t('manage:taste.peachActivity')])}
        <div class="flex flex-wrap items-center gap-2">${islandSelect(t('manage:taste.allTime'))}<span data-button-group data-split-button data-variant="primary">${islandButton({ glyph: 'compass', label: t('manage:taste.readBrowserHistory'), attrs: wait })}${islandButton({ glyph: 'chevron-down', attrs: wait })}</span></div>
      </div>
      <div class="inline-grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-taste-metrics>${metrics}</div>
      <section class="${card} md:flex-row md:gap-6" data-taste-portrait>
        <div class="flex shrink-0 flex-col gap-2 pb-5 md:w-80 md:pr-6 md:pb-0"><span class="text-caption-1-regular text-text-secondary">${t('manage:taste.browsingProfile')}</span>
          <svg class="h-70 w-full text-background-tertiary-default" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="2">${[70, 47, 24].map(r => `<polygon points="${[0, 1, 2, 3, 4, 5].map(i => `${(100 + r * Math.sin(i * Math.PI / 3)).toFixed(1)},${(100 - r * Math.cos(i * Math.PI / 3)).toFixed(1)}`).join(' ')}"/>`).join('')}</svg>
          <small class="text-caption-1-regular">${text('8em')}</small></div>
        <div class="flex min-w-0 grow flex-col justify-around gap-3">${bars}</div>
      </section>
      <div class="inline-grid w-full items-start gap-5 lg:grid-cols-2">${heat(t('manage:taste.browsingActivity'))}${heat(t('manage:taste.dailyActivity'))}</div>
      <section class="${chart}"><h3 class="text-title-2-medium text-text-primary">${t('manage:tasteCharts.creatorLeadSources')}</h3><div class="${placeholder} h-72 max-sm:h-48"></div></section>
      <section class="min-w-0 bg-background-secondary-default rounded-2xl shadow-card flex flex-col">
        <div class="px-4 pt-3">${track([t('manage:shared.tags'), t('manage:shared.creators'), t('manage:taste.topSites'), t('manage:tasteSkeleton.browsingLeads')])}</div>
        <div class="flex flex-col gap-3 px-4 pt-3.5 pb-4">${Array.from({ length: 5 }, () => `<div class="${placeholder} h-7"></div>`).join('')}</div>
      </section>
    </div>
  </div></div>`;
}

/** 重复文件首屏：筛选浮层（上排批量保留，下排读数）、组头和两行文件，尺寸跟正文一致。 */
export function duplicatesSkeleton(): string {
  const row = `<div class="duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4">
    <span class="${placeholder} row-span-2 inline-grid aspect-16/10 w-full rounded-2lg"></span>
    <span class="text-body-regular max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1">${text('70%')}</span>
    ${Array.from({ length: 3 }, () => `<span class="font-mono text-caption-1-regular leading-5">${text('3em')}</span>`).join('')}
    <span class="col-start-2 -col-end-1 min-w-0 pt-0.5 font-mono text-caption-1-regular leading-5 max-duplicate-narrow:col-span-full">${text('75%')}</span>
  </div>`;
  const group = `<section class="mb-6 overflow-hidden rounded-surface bg-background-secondary-default dark:bg-background-primary-default" data-duplicate-group>
    <div class="flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default">
      ${check()}<b class="text-title-2-medium">${text('5em')}</b><span class="font-mono text-caption-1-regular leading-5">${text('8em')}</span>
      <span class="rounded-sm px-2 py-0.5 text-caption-1-regular leading-5">${text('4em')}</span>
      <span class="ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full">${islandButton({ variant: 'secondary', size: 'small', label: t('cleanup:duplicates.trashSelectedFiles', { count: 0 }), attrs: wait })}${[t('cleanup:duplicates.keepLargest'), t('cleanup:duplicates.keepLongest'), t('cleanup:duplicates.keepAll'), t('cleanup:duplicates.trashGroup')].map(label => islandButton({ variant: 'secondary', size: 'small', label, attrs: wait })).join('')}</span>
    </div>${row.repeat(2)}</section>`;
  return `<div class="peach-react"><div class="mx-auto w-full max-w-board pb-10.5">
    ${islandGlassRows({ label: t('cleanup:duplicates.summaryLabel'), attrs: ' data-filter-frame="" data-duplicates-frame=""',
      controls: queueControlsSkeletonHtml('duplicates'),
      top: [t('cleanup:duplicates.allKeepLargest'), t('cleanup:duplicates.allKeepLongest'), t('cleanup:duplicates.allKeepAll')].map(filterAction).join('')
        + `<span class="ml-auto"></span>${filterAction(text('4.5em'))}` })}
    ${group.repeat(2)}
  </div></div>`;
}

/** 高清版首屏：筛选浮层（只有下排）加按卡片／列表画的内容，同 `QualityGoalsPage` 落地那一版。 */
export function qualityGoalsSkeleton(): string {
  return `<div class="peach-react"><div data-quality-goals class="mx-auto w-full max-w-board">
    ${islandGlassRows({ label: t('manage:hdUpgrades.summaryLabel'), attrs: ' data-filter-frame=""', controls: queueControlsSkeletonHtml('quality-goals') })}
    ${queueContentSkeletonHtml('quality-goals', '', ['w-20', 'w-20'])}
  </div></div>`;
}

/** 「修复与迁移」：页首说明与分区标题照写，结果面板里几行占位，和 `react/settings/repair-center.tsx`
 *  的 `Row` 同一串类名：左边标题与说明，右边读数与状态标签。项数等数据才知道，按常见的三项画。 */
export function repairCenterPanelSkeleton(rows = 3): string {
  const row = `<div class="${RESULT_SECTION} flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
    <div class="flex min-w-0 flex-1 flex-col gap-0.5"><span class="text-body-medium">${text('7em')}</span><span class="text-body-2-regular">${text('62%')}</span></div>
    <div class="flex shrink-0 items-center gap-3"><span class="text-body-2-regular">${text('4em')}</span><span class="${placeholder} inline-block h-6 w-14 rounded-full"></span></div>
  </div>`;
  return `<div class="${RESULT_PANEL}">${row.repeat(rows)}</div>`;
}

export function repairCenterSkeleton(): string {
  return `<div class="peach-react"><div class="mx-auto flex w-full max-w-board flex-col gap-8">
    <section class="flex flex-col gap-4"><h2 class="text-title-2-medium! m-0! text-text-primary">${t('settings:repairCenter.itemsHeading')}</h2>${repairCenterPanelSkeleton()}</section>
  </div></div>`;
}
