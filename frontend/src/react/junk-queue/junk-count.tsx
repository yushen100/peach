/* 垃圾文件页的筛选浮层：首页那副两排玻璃浮层，上排分类条，下排读数、「全选」，右边卡片／列表与排序键。
 *
 * 分类有哪几项、选中哪一项、看的是待判断还是已排除，全由地址决定，等数据时就是最终样子；
 * 随请求变的只有读数和各类的计数徽标，数据没到时它们让位给占位。壳在 React 包加载
 * 之前铺的那一版（`src/junk-queue.ts` 的 `junkCountSkeletonHtml`）和这里等数据时逐项相同。
 *
 * 当前那一类底下垫一块滑动玻璃，悬停时滑到指针下那一枚（`components/use-view-glide.ts`）。
 * 分隔线右边的「已排除／返回待判断」是换视图，不归这块玻璃：已排除视图下它和「全部」同时是
 * 当前项，它自己静止垫一块同料的玻璃。
 *
 * 分类仍是 `<a href>`：要落到地址上，可深链、可刷新恢复，中键与修饰键照浏览器默认开新标签。
 * 普通左键交给壳，由它收起多选、改地址并重读。计数为 0 的那一类整枚徽标不画。 */
import { useRef, type MouseEvent } from 'react';
import { Button } from '@/components/base/buttons/button';

import { JUNK_KIND_OPTIONS, junkPath, junkSummaryLabel, junkViewLink } from '../../junk-queue';
import { FilterGlassRows, SelectAllButton } from '../components/filter-glass';
import { CatalogViewToggle } from '../catalog-grid/catalog-view-toggle';
import { SortKeys } from '../entity-filter/entity-filter-page';
import type { EntitySortKey } from '../entity-filter/entity-filter';
import { AsyncText } from '../components/async-text';
import { useViewGlide } from '../components/use-view-glide';
import { junkCount, type JunkPage, type JunkRoute } from './junk-queue';
import { t } from '../../i18n';

function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
}

function Badge({ scope, count }: { scope: string; count: number }) {
  if (!count) return null;
  return <>{' '}<span data-count-badge={`junk:${scope}`}>{count.toLocaleString()}</span></>;
}

/** 下排「全选」：这一屏已取回的那几张。 */
export interface JunkPickAll { loaded: number[]; picked: number; onChange(on: boolean): void }

export function JunkCount({ route, page, failed, pickAll, sorts, onSort, onNavigate, onDisposeAll }: {
  route: JunkRoute; page: JunkPage | undefined; failed: boolean; pickAll: JunkPickAll | null;
  sorts: readonly EntitySortKey[]; onSort(key: string): void; onNavigate(path: string): void;
  /** 「全部移入回收站」：只在待判断视图、这一类有条目时给。 */
  onDisposeAll?(): void;
}) {
  const nav = useRef<HTMLElement>(null);
  const pane = useRef<HTMLSpanElement>(null);
  const { kind, view } = route;
  /* 计数徽标到货、判过一批后计数变了，各枚的宽度跟着变：这些数也算进键里，玻璃重新落位。 */
  const counts = page ? JUNK_KIND_OPTIONS.map(([key]) => junkCount(page, key)).join(',') : '';
  const glide = useViewGlide(pane, nav, '[data-junk-kind-link][aria-current="page"]', `${view}:${kind}:${counts}`);
  const other = junkViewLink(view);
  const click = (event: MouseEvent<HTMLElement>) => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(link.getAttribute('href') || junkPath());
  };
  /* 读不到就不再转圈：失败的原因写在网格那一格里，这里只说「没有数」。 */
  const figure = page ? t('cleanup:junk.countFigure', { count: Number(page.total || 0) }) : failed ? '—' : undefined;
  return (
    <FilterGlassRows label={t('cleanup:junk.categories')} topLabel={t('cleanup:junk.categories')}
      attrs={{ 'data-catalog-frame': '', 'data-filter-frame': '', 'data-junk-filters-frame': '' }} bottomClassName="min-h-12"
      className="mx-auto w-full max-w-board"
      busy={!page && !failed} panes={<span ref={pane} data-view-glide="" aria-hidden="true" />}
      top={
        <nav ref={nav} data-junk-filters="" aria-label={t('cleanup:junk.categories')} onClick={click} onPointerLeave={glide.leave}>
          {JUNK_KIND_OPTIONS.map(([key, label, glyph]) => (
            <a key={key || 'all'} href={junkPath(key, view)} data-junk-kind-link={key}
              aria-current={key === kind ? 'page' : undefined} onPointerEnter={glide.hover}>
              <Icon name={glyph} />{label}<Badge scope={key} count={page ? junkCount(page, key) : 0} />
            </a>
          ))}
          <i data-junk-divider="" aria-hidden="true" />
          <a href={other.href} data-junk-view-link={other.view} aria-current={view === 'dismissed' ? 'page' : undefined}
            onPointerEnter={view === 'dismissed' ? undefined : glide.hover}>
            <Icon name={other.glyph} />{other.label}<Badge scope="dismissed" count={Number(page?.dismissed_total || 0)} />
          </a>
        </nav>
      }
      bottom={<>
        <span data-catalog-summary="" data-junk-summary="">
          <span data-catalog-readout="" role="status" aria-live="polite">
            {junkSummaryLabel(view)} · <AsyncText text={figure} busy={figure === undefined} placeholder={<span data-skeleton="count"
              aria-hidden className="relative inline-block h-3.5 w-12 rounded-md align-middle skeleton-sheen" />} />
          </span>
          {pickAll && pickAll.loaded.length ? <SelectAllButton label={t('cleanup:junk.selectAll', { count: pickAll.loaded.length })}
            picked={pickAll.picked} total={pickAll.loaded.length} onChange={pickAll.onChange} /> : null}
          {/* 同回收站的「清空回收站」那一档：危险操作用实底红键，件数写在确认框里。 */}
          {onDisposeAll ? <Button size="small" variant="danger" data-junk-dispose-all="" onClick={onDisposeAll}>
            {t('shell:batchJunk.disposeAll')}</Button> : null}
        </span>
        <span data-entity-sorts="">
          <CatalogViewToggle />
          <SortKeys sorts={sorts} onSort={onSort} />
        </span>
      </>}
    />
  );
}
