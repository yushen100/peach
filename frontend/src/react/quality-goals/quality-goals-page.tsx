/* 高清版目标页：数据库里标记为「还该有更好一版」的那些作品。
 *
 * 一屏回答两件事：还欠多少部、每一部欠在哪里。所以卡片上除了标题就只有来源、时长、
 * 体积和判定原因——决定要不要去找更好一版，看的就是这几项。
 *
 * 番号标题与来源徽标由遗留层以 HTML 字符串传进来：它们是全站语义契约的唯一实现，
 * 在这里重写一份就会漂。时长、体积、来源名走 `src/core/index.ts` 同一套格式化口径，同理。
 *
 * 这一页是处理队列：每张卡直接带勾选框，顶上有「全选」，选中几部后底部条给「查找资源」，
 * 打开的是 JAV 页同一个批量查找面板。查找本身不写数据，下载由面板里各行自己确认。
 *
 * 页头是首页那副玻璃筛选浮层的第二行：左端读数（还欠多少部）与「全选」，右边卡片／列表与排序键；列表版式
 * 同首页列表（`../components/queue-table.tsx`）。卡片排法同
 * JAV 探索卡（`../jav/discovery-card.tsx`）：封面、头像那一格放勾选框、两行标题、来源与体积，
 * 判定原因落在标签行，底部一排动作键。 */
import { useState, type CSSProperties } from 'react';
import { RiCheckboxLine, RiPlayLine, RiSearchLine, RiSparklingLine } from '@remixicon/react';
import { useQuery } from '@tanstack/react-query';

import { LOC, fmtDur, fmtSize } from '@peach/legacy/core';

import { Button } from '@/components/base/buttons/button';

import { errorMessage } from '../../api';
import { queueContentSkeletonHtml } from '../../queue-skeleton';
import { CloudDownloadDialog, type DownloadPrefill } from '../activity/cloud-download-dialog';
import type { QualityGoalsProps } from '../bundle';
import { CardTags, Icon } from '../components/card-meta';
import { EmptyState } from '../components/empty-state';
import { FilterGlassRows, SelectAllButton } from '../components/filter-glass';
import { QueueIdentity, QueuePicture, QueueTable } from '../components/queue-table';
import { useQueueSort } from '../components/queue-sort';
import { useCatalogView } from '../catalog-grid/catalog-view';
import { CatalogViewToggle } from '../catalog-grid/catalog-view-toggle';
import { SortKeys } from '../entity-filter/entity-filter-page';
import { Note } from '../components/note';
import { Page } from '../components/page';
import { enterPageSelection, exitPageSelection, usePageSelection } from '../components/page-selection';
import { SelectionDock } from '../components/selection-dock';
import { providerIcon } from '../components/source-label';
import { useDense } from '../components/use-dense';
import { useLibraryTints } from '../components/library-tint';
import { ListLibrary } from '../catalog-grid/catalog-list-page';
import { JavBatchResources } from '../jav/jav-batch-resources';
import type { Discovery } from '../jav/jav';
import {
  fetchQualityGoals, previewUrl, QUALITY_GOALS_KEY, type QualityGoal,
} from './quality-goals';
import { t } from '../../i18n';
import type { TableFilters } from '../components/use-table-filters';
import { useWorkContextMenu, type WorkContextOperation } from '../components/work-context-menu';

/** 判定原因按「高清 / 无水印 / 完整版」那样的分隔拆成几枚只读标签。 */
const reasonTags = (reason: string | null) => (reason || '').split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);

function goalPrefill(item: QualityGoal, title: string): DownloadPrefill {
  return { code: item.code!, title, origin: `asset:${item.id}`, searchReason: item.reason || '',
    duration: item.duration, cover: previewUrl(item) };
}

function goalOperations(item: QualityGoal, picked: boolean, open: () => void, search: () => void, pick: () => void) {
  const operations: WorkContextOperation[] = [
    { id: 'open', label: t('manage:hdUpgrades.viewEditions'), icon: RiPlayLine, run: open },
    { id: 'select', label: t(picked ? 'catalog:mediaActions.deselect' : 'catalog:mediaActions.select'), icon: RiCheckboxLine, run: pick },
  ];
  if (item.code) operations.splice(1, 0, { id: 'search', label: t('manage:resourceSearch.searchTorrents'), icon: RiSearchLine, run: search });
  return operations;
}

/** 一部待升级的作品一张卡。 */
function GoalCard({ item, openItem, searchResources, javTitleHtml, javDisplayName, srcBadge, picked, onPick, selecting }: { item: QualityGoal }
  & Omit<QualityGoalsProps, 'toast'> & { searchResources(prefill: DownloadPrefill): void; picked: boolean; onPick(on: boolean): void;
    selecting: boolean }) {
  const menu = useWorkContextMenu();
  const dense = useDense();
  const [broken, setBroken] = useState(false);
  const open = () => openItem(item.id);
  const title = javDisplayName(item);
  const search = () => searchResources(goalPrefill(item, title));
  const context = { key: item.id, operations: goalOperations(item, picked, open, search, () => onPick(!picked)) };
  const tints = useLibraryTints();
  const library = item.library_id && tints.get(item.library_id)?.color ? item.library_id : undefined;
  return (
    /* 多选模式与修饰键优先：点在卡上任何地方都是切换选中，同探索卡；平时点封面与标题打开。 */
    <article data-media-card="" data-jav-card="" data-queue-card="" data-goal-id={item.id} data-library={library}
      data-selected={picked ? '' : undefined}
      onContextMenu={event => menu.onContextMenu(event, context)}
      onKeyDown={event => menu.onKeyDown(event, context)}
      onClickCapture={(event) => {
        if ((event.target as Element).closest('[data-work-context-menu]')) return;
        if (!selecting && !event.shiftKey && !event.ctrlKey && !event.metaKey) return;
        event.preventDefault(); event.stopPropagation(); onPick(!picked);
      }}>
      {menu.menu}
      <button type="button" data-media-pic="" onClick={open} aria-label={t('manage:hdUpgrades.openVideo', { title })}
        style={{ '--card-ratio': String(16 / 9) } as CSSProperties}>
        {/* 图片取不到时露出来的就是这句。 */}
        {broken ? <span data-media-nopic="">{t('manage:hdUpgrades.noPreview')}</span>
          : <span data-media-art="thumb"><img className="absolute inset-0 size-full object-contain" src={previewUrl(item)} alt="" loading="lazy" data-goal-cover=""
            onError={() => setBroken(true)} /></span>}
        <span data-media-badge="" dangerouslySetInnerHTML={{ __html: srcBadge(item.location, item.cost) }} />
        {Number(item.duration) > 0 ? <span data-media-duration="">{fmtDur(item.duration)}</span> : null}
        <span data-media-check=""><Icon name="check" /></span>
      </button>
      <div data-media-meta="">
        <div data-media-text="">
          {/* 标题从番号读起，长了折到第二行再截尾：中段截断会把番号和片名一起切掉。 */}
          <button type="button" data-media-title="" onClick={open} title={title}
            dangerouslySetInnerHTML={{ __html: javTitleHtml(item) }} />
          <div data-media-byline="">
            {/* 署名写这一部所在的媒体库（标识加名字，同列表那一列）；不在任何媒体库里时写来源。 */}
            <span data-media-who="">{item.library_id ? <ListLibrary item={item} /> : LOC[item.location] ?? item.location}</span>
            <span data-media-facts=""><span data-media-size=""><Icon name="hard-drive" />
              {Number(item.size) > 0 ? fmtSize(Number(item.size)) : t('manage:hdUpgrades.unknownSize')}</span></span>
          </div>
          <CardTags tags={reasonTags(item.reason)} label={(tag) => tag} readOnly title={item.reason || undefined} />
        </div>
      </div>
      <div data-jav-actions="" className="flex flex-wrap gap-2">
        {item.code ? <Button variant="secondary" size={dense ? 'small' : 'medium'} onClick={search}>{t('manage:resourceSearch.searchTorrents')}</Button> : null}
        <Button variant="secondary" size={dense ? 'small' : 'medium'} onClick={open}>{t('manage:hdUpgrades.viewEditions')}</Button>
      </div>
    </article>
  );
}

export function QualityGoalsPage({ toast, ...props }: QualityGoalsProps) {
  const [download, setDownload] = useState<DownloadPrefill | null>(null);
  const [picked, setPicked] = useState<ReadonlyMap<number, QualityGoal>>(new Map());
  const selecting = usePageSelection(() => setPicked(new Map()));
  const [resources, setResources] = useState<Discovery[] | null>(null);
  const view = useCatalogView();
  const [filters, setFilters] = useState<TableFilters>({});
  const activeFilters = view === 'list' ? filters : {};
  const encoded = JSON.stringify(activeFilters);
  const goals = useQuery({ queryKey: encoded === '{}' ? QUALITY_GOALS_KEY : [...QUALITY_GOALS_KEY, encoded],
    queryFn: ({ signal }) => fetchQualityGoals(signal, encoded === '{}' ? undefined : activeFilters), placeholderData: previous => previous });
  const order = useQueueSort<QualityGoal>('quality-goals', {
    size: (item) => Number(item.size || 0), dur: (item) => Number(item.duration || 0), new: (item) => item.id,
  });
  const data = goals.data;
  if (goals.isPending) return <Page><div dangerouslySetInnerHTML={{
    __html: queueContentSkeletonHtml('quality-goals', t('shell:spinner.loading'), ['w-20', 'w-24']),
  }} /></Page>;
  if (!data) {
    return (
      <Page>
        <Note tone="error" title={t('manage:hdUpgrades.loadFailed')}>{goals.error ? errorMessage(goals.error) : t('manage:hdUpgrades.notFound')}</Note>
      </Page>
    );
  }
  const items = order.sort(data.items || []);
  if (!items.length && view !== 'list') {
    return (
      <Page>
        <EmptyState icon={RiSparklingLine} title={t('manage:hdUpgrades.emptyTitle')}>
          {t('manage:hdUpgrades.emptyBody')}
        </EmptyState>
      </Page>
    );
  }
  /* 每一部都能勾，「全选」就是这一屏全部；批量查找资源只带有番号的那几部，没有番号的查不了。 */
  const chosen = [...picked.values()];
  const searchable = chosen.filter((item) => item.code);
  const pickAll = (on: boolean) => { if (goals.isFetching || goals.isError) return; if (on) enterPageSelection(); setPicked(current => {
    const next = new Map(current);
    for (const item of items) { if (on) next.set(item.id, item); else next.delete(item.id); }
    return next;
  }) };
  const pick = (id: number, on: boolean) => { if (on) enterPageSelection(); setPicked((current) => {
    const next = new Map(current);
    const item = items.find(item => item.id === id);
    if (on && item) next.set(id, item); else next.delete(id);
    return next;
  }) };
  return (
    <div data-quality-goals="" className="mx-auto w-full max-w-board">
      {/* 总数取服务端的 `total` 而不是这一页的条数：`limit` 截断时两者不是一个数，
          而读数要回答的是「一共还欠多少部」。 */}
      <FilterGlassRows label={t('manage:hdUpgrades.summaryLabel')} topLabel={t('manage:hdUpgrades.summaryLabel')} top={null}
        attrs={{ 'data-catalog-frame': '', 'data-filter-frame': '' }} bottomClassName="min-h-12" bottom={<><span data-catalog-summary="">
          <span data-catalog-readout="" role="status">
            {t('manage:hdUpgrades.summaryLabel')} · {t('manage:hdUpgrades.videoCount', { count: Number(data.total || 0) })}</span>
          <SelectAllButton label={t('manage:hdUpgrades.selectAll')} picked={items.filter(item => picked.has(item.id)).length} total={items.length} onChange={pickAll} />
        </span>
        <span data-entity-sorts=""><CatalogViewToggle /><SortKeys sorts={order.sorts} onSort={order.onSort} /></span></>} />
      {view === 'list'
        ? <QueueTable table="quality-goals" label={t('manage:hdUpgrades.summaryLabel')} items={items} selected={new Set(picked.keys())} selecting={selecting}
            contextOperations={item => goalOperations(item, picked.has(item.id), () => props.openItem(item.id),
              () => setDownload(goalPrefill(item, props.javDisplayName(item))), () => pick(item.id, !picked.has(item.id)))}
            busy={goals.isFetching}
            filters={{ values: activeFilters, facets: data.column_facets ?? {}, onChange: setFilters }}
            filterColumns={{
              source: { values: item => item.location, option: id => {
                const ProviderIcon = providerIcon(id);
                return { label: LOC[id] || id, leading: <ProviderIcon /> };
              } },
              reason: { values: item => reasonTags(item.reason), option: id => ({ label: id === 'none' ? t('cleanup:shared.none') : id }) },
            }}
            sort={{ options: order.sorts.map(({ key, label }) => ({ id: key, label })), sorting: order.sorting, onChange: order.setSorting }}
            rowLabel={(item) => t('manage:hdUpgrades.selectVideo', { title: props.javDisplayName(item) })}
            onPick={(item, on) => pick(item.id, on)}
            onPickAll={pickAll}
            cells={{
              name: (item) => <QueueIdentity name={props.javDisplayName(item)}
                onOpen={() => props.openItem(item.id)} picture={<QueuePicture src={previewUrl(item)} glyph="film" />} />,
              library: (item) => <ListLibrary item={item} />,
              source: (item) => <span className="inline-flex items-center gap-1.5">
                <span className="contents" dangerouslySetInnerHTML={{ __html: props.srcBadge(item.location, item.cost) }} />
                {LOC[item.location] ?? item.location}</span>,
              dur: (item) => fmtDur(item.duration) || '—',
              size: (item) => Number(item.size) > 0 ? fmtSize(Number(item.size)) : '—',
              reason: (item) => item.reason || '—',
              actions: (item) => <span className="flex gap-2">
                {item.code ? <Button variant="secondary" size="small" onClick={() => setDownload(goalPrefill(item, props.javDisplayName(item)))}>
                  {t('manage:resourceSearch.searchTorrents')}</Button> : null}
                <Button variant="secondary" size="small" onClick={() => props.openItem(item.id)}>{t('manage:hdUpgrades.viewEditions')}</Button>
              </span>,
            }} />
        : <div data-media-grid="" data-select-mode={selecting ? '' : undefined}>
            {items.map((item) => <GoalCard key={item.id} item={item} {...props} searchResources={setDownload}
              picked={picked.has(item.id)} onPick={(on) => pick(item.id, on)} selecting={selecting} />)}
          </div>}
      <SelectionDock visible={chosen.length > 0} label={t('manage:hdUpgrades.dockLabel')} count={t('manage:hdUpgrades.selectedCount', { count: chosen.length })}
        actions={[]}>
        <Button size="small" variant="secondary" disabled={!searchable.length} onClick={() => setResources(searchable.map((item) => ({ id: item.id, code: item.code!,
          title: props.javDisplayName(item), release_date: undefined }) as unknown as Discovery))}>{t('manage:resourceSearch.searchTorrents')}</Button>
        <Button size="small" variant="ghost" onClick={exitPageSelection}>{t('manage:hdUpgrades.clearSelection')}</Button>
      </SelectionDock>
      <JavBatchResources items={resources} close={() => setResources(null)} readOnly={false} receipt={toast} />
      {goals.isError ? <Note tone="error">{errorMessage(goals.error)}</Note> : null}
      {/* 列表只取前 200 部；总数比这多时说清楚这一页不是全部。 */}
      {Number(data.total || 0) > items.length
        ? <p className="mt-6 text-center text-caption-1-regular text-text-secondary">
            {t('manage:hdUpgrades.showingFirst', { shown: items.length.toLocaleString(), count: Number(data.total) })}
          </p>
        : null}
      <CloudDownloadDialog prefill={download} close={() => setDownload(null)} receipt={toast} />
    </div>
  );
}
