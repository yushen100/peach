/* JAV 想要：按状态分组的作品卡，复用资源链接查询与查找资源弹层。 */
import { useEffect, useState } from 'react';
import { Radio } from 'react-aria-components';
import type { KeyboardEvent, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RiStarLine, RiExternalLinkLine, RiDeleteBinLine, RiSearchLine, RiRestartLine, RiCheckboxLine } from '@remixicon/react';

import { Button, ButtonLink } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';

import { apiGet, errorMessage } from '../../api';
import { javContentSkeleton } from '../../jav-skeleton';
import type { DownloadsSnapshot } from '../bundle';
import { CloudDownloadDialog, type DownloadPrefill } from '../activity/cloud-download-dialog';
import { DOWNLOADS_KEY, DOWNLOADS_URL } from '../activity/downloads-panel';
import type { BulkAction, Receipt } from '../components/bulk-action';
import { cardClass } from '../components/card';
import { SelectionDock } from '../components/selection-dock';
import { JavBatchResources } from '../jav/jav-batch-resources';
import { useJavSelection } from '../jav/jav-selection';
import type { Discovery } from '../jav/jav';
import { EmptyState, EmptyFocusButton } from '../components/empty-state';
import { Note } from '../components/note';
import { DataTableFooter } from '../components/table-controls';
import { pageWindow } from '../follow-manage/follow-manage';
import { ErrorLine } from '../follow-manage/source-view';
import { TaskProgress } from '../components/task-progress';
import { activityKind } from '../../activity-kinds';
import { WantMagnets, type ResourceSourcePage } from './want-magnets';
import { ScrapeSourceLabel } from '../components/source-label';
import { resourceSourceKey } from './resource-display';
import { cachedMagnetStates } from './resource-cache';
import { SEGMENT, SEGMENTED_TRACK, SegmentedRadioGroup } from '../components/segmented';
import { busyProps, useAction } from '../settings/use-action';
import { composingKey } from '../components/ime';
import { useWorkContextMenu, type WorkContextOperation } from '../components/work-context-menu';
import {
  addWant, fetchWants, invalidateWants, lastSearchNote, PHASES, removeWants, resetWants, restoreWants, searchNote, wantName,
  WANTS_KEY, wantsInterval, type Want,
} from './wants';
import { t } from '../../i18n';

const ORIGINS: Record<Want['origin'], string> = { code: t('catalog:wants.originManual'), feed: t('catalog:entityHero.subscribeNewReleases'), follow: t('catalog:entityHero.following') };
/** 每一段一页摆多少张：一张卡二十来个节点，上千条一次摆开就是十几万像素高的一页。 */
export const WANT_PAGE_SIZE = 20;
const MAGNET_FILTERS = [['all', t('catalog:shared.all')], ['available', t('catalog:wants.hasMagnet')], ['missing', t('catalog:wants.noMagnet')]] as const;


/** 资料那一行：发行日、厂牌、女优、从哪儿加进来的。 */
const facts = (want: Want) => [want.release_date, want.studio, want.performers, ORIGINS[want.origin]]
  .filter(Boolean).join(' · ');

function Cover({ want }: { want: Want }) {
  return (
    <span className="relative inline-grid w-card-cover shrink-0 aspect-card-cover place-items-center overflow-hidden rounded-2lg bg-media-placeholder max-sm:w-24">
      <span className="text-caption-1-regular text-text-secondary">{t('catalog:shared.noCover')}</span>
      {want.cover ? (
        <img src={want.cover} alt="" loading="lazy" referrerPolicy={want.remote_cover ? 'no-referrer' : undefined}
          onError={(event) => event.currentTarget.remove()} className="absolute inset-0 size-full object-cover" />
      ) : null}
    </span>
  );
}

function WantRow({ want, readOnly, busy, onReset, onRemove, onCloudDownload, downloads, provider, toast, picked }: {
  want: Want; readOnly: boolean; busy: string; downloads?: DownloadsSnapshot; provider: string; toast(message: string): void;
  onReset(): void; onRemove(): void; onCloudDownload(): void;
  /** 多选模式下这一条的勾选；不在多选模式时为空，不画勾选框。 */
  picked?: { on: boolean; toggle(on: boolean): void };
}) {
  const menu = useWorkContextMenu();
  const [resourcePages, setResourcePages] = useState<ResourceSourcePage[]>([]);
  const original = want.link || (!resourcePages.length && want.code ? `https://javdb.com/search?q=${encodeURIComponent(want.code)}&f=all` : '');
  const host = original && URL.canParse(original) ? new URL(original).hostname.replace(/^www\./, '') : '';
  const originalKey = resourceSourceKey(want.follow_provider || host.split('.')[0] || '');
  const originalLabel = originalKey === 'javdb' ? 'JavDB' : originalKey === 'javbus' ? 'JavBus' : host;
  const pages = original && host && !resourcePages.some(page => page.source === originalKey)
    ? [{ source: originalKey, label: originalLabel, url: original }, ...resourcePages] : resourcePages;
  // 有番号还在找的，资源区自己说明查到了什么，这里只给上次定时查找的结果。
  const note = want.code && want.phase === 'searching' ? lastSearchNote(want) : searchNote(want);
  const operations: WorkContextOperation[] = pages.map(page => ({ id: `source:${page.source}`, label: page.label, icon: RiExternalLinkLine,
    run: () => { window.open(page.url, '_blank', 'noopener,noreferrer') } }));
  if (want.phase === 'searching' || want.phase === 'given_up') operations.push({ id: 'resource', label: t('catalog:shared.searchTorrents'),
    icon: RiSearchLine, run: onCloudDownload });
  if (want.phase === 'given_up') operations.push({ id: 'reset', label: t('catalog:wants.searchAgain'), icon: RiRestartLine,
    disabled: readOnly || !!busy, run: onReset });
  if (picked) operations.push({ id: 'select', label: t(picked.on ? 'catalog:mediaActions.deselect' : 'catalog:mediaActions.select'),
    icon: RiCheckboxLine, run: () => picked.toggle(!picked.on) });
  operations.push({ id: 'remove', label: t('catalog:shared.remove'), icon: RiDeleteBinLine, danger: true,
    disabled: readOnly || !!busy, run: onRemove });
  const menuContext = { key: want.id, operations };
  return (
    <li data-want-id={want.id}
      onContextMenu={event => menu.onContextMenu(event, menuContext)} onKeyDown={event => menu.onKeyDown(event, menuContext)}
      className={cardClass({ className: 'flex flex-col gap-4 max-sm:p-4' })}>
      {menu.menu}
      <div className="flex min-w-0 items-start gap-4 max-sm:gap-3">
      {picked ? <Checkbox slot={null} className="mt-1 shrink-0 self-start" aria-label={t('catalog:wants.selectRow', { name: wantName(want) })}
        isSelected={picked.on} onChange={picked.toggle} /> : null}
      <Cover want={want} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <b className="min-w-0 text-headline-medium wrap-anywhere text-text-primary">{wantName(want)}</b>
          {want.code && want.title ? (
            <span className="min-w-0 truncate text-body-2-regular text-text-secondary">{want.title}</span>
          ) : null}
        </p>
        {facts(want) ? <p className="text-body-2-regular text-text-secondary">{facts(want)}</p> : null}
        {note ? <p data-want-note="" className="text-caption-1-regular text-text-secondary">{note}</p> : null}
        {want.scrape_error ? <ErrorLine text={want.scrape_error} prefix={t('catalog:wants.metadataNotFound')} tone="muted" /> : null}
        <div data-want-actions="" className="mt-1 flex flex-wrap items-center gap-2">
          {pages.map(page => <ButtonLink key={page.source} data-button-link="" variant="secondary" size="small" trailingIcon={RiExternalLinkLine}
            href={page.url} target="_blank" rel="noopener noreferrer"><ScrapeSourceLabel source={page.source} label={page.label} /></ButtonLink>)}
          {want.phase === 'given_up' ? (
            <Button variant="secondary" size="small" disabled={readOnly} {...busyProps(busy === `reset:${want.id}`)}
              onClick={onReset}>{t('catalog:wants.searchAgain')}</Button>
          ) : null}
          {/* 还在找的两段才给云下载：未发售的没有资源可下，已入库的已经到手。 */}
          {want.phase === 'searching' || want.phase === 'given_up' ? (
            <Button variant="primary" size="small" leadingIcon={RiSearchLine} onClick={onCloudDownload}>{t('catalog:shared.searchTorrents')}</Button>
          ) : null}
          <Button variant="danger" size="small" leadingIcon={RiDeleteBinLine} disabled={readOnly} {...busyProps(busy === `remove:${want.id}`)}
            onClick={onRemove}>{t('catalog:shared.remove')}</Button>
        </div>
      </div>
      </div>
      {want.code && (want.phase === 'searching' || want.phase === 'given_up')
        ? <WantMagnets want={want} readOnly={readOnly} downloads={downloads} provider={provider} toast={toast} onSources={setResourcePages} /> : null}
    </li>
  );
}

/** 一段（待找、未发售……）：标题带总数，各段独立保存页码与每页数量。 */
function WantPhase({ phase, label, rows, row }: {
  phase: string; label: string; rows: Want[]; row(want: Want): ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(WANT_PAGE_SIZE);
  const [magnetFilter, setMagnetFilter] = useState('all');
  const cached = cachedMagnetStates(rows);
  const hasMagnet = (want: Want) => want.has_magnets ?? cached.get(want.code || '') ?? false;
  const available = rows.filter(hasMagnet);
  const filtered = phase !== 'searching' || magnetFilter === 'all' ? rows
    : rows.filter(want => hasMagnet(want) === (magnetFilter === 'available'));
  const win = pageWindow(filtered.length, pageSize, page);
  return (
    <section aria-label={label} data-want-phase={phase} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-baseline gap-2 text-title-2-medium text-text-primary">
        {label}
        <span className="text-body-2-regular tabular-nums text-text-secondary">{rows.length.toLocaleString()}</span>
      </h3>
      {phase === 'searching' ? <SegmentedRadioGroup name="want-magnet-filter" aria-label={t('catalog:wants.magnetFilter')}
        orientation="horizontal" value={magnetFilter} className={SEGMENTED_TRACK} onChange={value => { setMagnetFilter(value); setPage(1) }}>
        {MAGNET_FILTERS.map(([value, text]) => <Radio key={value} value={value} aria-label={text} className={SEGMENT}>
          {text}<span className="text-caption-1-regular tabular-nums text-text-tertiary">{
            (value === 'all' ? rows.length : value === 'available' ? available.length : rows.length - available.length).toLocaleString()
          }</span>
        </Radio>)}
      </SegmentedRadioGroup> : null}
      </div>
      {!filtered.length ? <EmptyState size="compact" icon={RiStarLine} title={t('catalog:wants.noFilterMatches')}
        actions={<Button size="small" onClick={() => { setMagnetFilter('all'); setPage(1) }}>{t('catalog:shared.viewAll')}</Button>}>{null}</EmptyState> : null}
      <ul className="flex flex-col gap-4">{filtered.slice(win.start, win.end).map(row)}</ul>
      <div data-want-pager="">
        <DataTableFooter label={label} total={win.total} pagination={{ pageIndex: win.page - 1, pageSize }}
          onChange={next => { setPageSize(next.pageSize); setPage(next.pageIndex + 1) }} unit={t('catalog:wants.itemUnit')} />
      </div>
    </section>
  );
}

export interface WantListProps {
  readOnly: boolean;
  toast: Receipt;
  query?: string;
  clearQuery?(): void;
}

export function WantList({ readOnly, toast, query = '', clearQuery }: WantListProps) {
  const [code, setCode] = useState('');
  const [download, setDownload] = useState<DownloadPrefill | null>(null);
  const action = useAction();
  const wants = useQuery({
    queryKey: WANTS_KEY, queryFn: ({ signal }) => fetchWants(signal),
    staleTime: 30_000,
    refetchInterval: wantsInterval,
  });

  const add = () => {
    const text = code.trim();
    if (!text || readOnly) return;
    void action.run('add', (signal) => addWant({ code: text }, signal), (done) => {
      toast(done.created ? t('catalog:wants.added', { name: wantName(done.want) }) : t('catalog:wants.alreadyAdded', { name: wantName(done.want) }));
      setCode('');
      void invalidateWants();
    });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !composingKey(event.nativeEvent)) { event.preventDefault(); add() }
  };
  const remove = (want: Want) => {
    void action.run(`remove:${want.id}`, (signal) => removeWants([want.id], signal), () => {
      toast(t('catalog:wants.removed', { name: wantName(want) }));
      void invalidateWants();
    });
  };
  const reset = (want: Want) => {
    void action.run(`reset:${want.id}`, (signal) => resetWants([want.id], signal), () => {
      toast(t('catalog:wants.backToSearching', { name: wantName(want) }));
      void invalidateWants();
    });
  };

  const data = wants.data;
  const items = (data?.items || []).filter(want => !query || [want.code, want.title, want.performers]
    .join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  /* 多选：右上角开关（JAV 页的多选外壳）打开后每条显示勾选框，浮条给移除、重新查找与查找资源。 */
  const selection = useJavSelection();
  const selecting = Boolean(selection?.mode);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [resources, setResources] = useState<Discovery[] | null>(null);
  useEffect(() => { if (!selecting) setPicked(new Set()) }, [selecting]);
  const chosen = items.filter((want) => picked.has(want.id));
  const allPicked = items.length > 0 && chosen.length === items.length;
  const host = { receipt: toast };
  const removeMany: BulkAction<Want> = {
    key: 'remove', label: t('catalog:shared.remove'), reversal: 'undo', danger: true,
    confirm: (rows) => ({ title: t('catalog:wants.removeMany'), body: t('catalog:wants.removeManyBody', { count: rows.length }) }),
    run: async (rows) => {
      const { previous } = await removeWants(rows.map((want) => want.id));
      await invalidateWants();
      return async () => { await restoreWants(previous); await invalidateWants() };
    },
    receipt: (rows) => t('catalog:wants.removedMany', { count: rows.length }),
  };
  const resetMany: BulkAction<Want> = {
    key: 'reset', label: t('catalog:wants.searchAgain'), reversal: 'undo',
    confirm: (rows) => ({ title: t('catalog:wants.searchAgainMany'), body: t('catalog:wants.searchAgainManyBody', { count: rows.length }) }),
    run: async (rows) => {
      const { previous } = await resetWants(rows.map((want) => want.id));
      await invalidateWants();
      return async () => { await restoreWants(previous); await invalidateWants() };
    },
    receipt: (rows) => t('catalog:wants.searchAgainDone', { count: rows.length }),
  };
  const searchable = chosen.filter((want) => want.code && (want.phase === 'searching' || want.phase === 'given_up'));
  const downloads = useQuery({
    queryKey: DOWNLOADS_KEY,
    queryFn: ({ signal }) => apiGet<DownloadsSnapshot>(`${DOWNLOADS_URL}?limit=100`, signal),
    enabled: items.some((want) => want.code && (want.phase === 'searching' || want.phase === 'given_up')),
  });
  const configured = downloads.data?.providers.filter((row) => row.configured) || [];
  const selected = configured[0]?.key || '';
  return (
    <div aria-busy={wants.isPending} className="flex flex-col gap-8">
      <div className={cardClass({ padding: 'none', className: 'flex flex-col gap-4 px-6 py-5 max-sm:px-4' })}>
        <h3 className="text-title-2-medium text-text-primary">{t('catalog:wants.addByCode')}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 grow max-sm:min-w-0">
            <Input aria-label={t('catalog:shared.code')} placeholder={t('catalog:wants.codePlaceholder')} value={code}
              isDisabled={readOnly} onChange={setCode} onKeyDown={onKeyDown} />
          </div>
          <Button variant="primary" disabled={readOnly || !code.trim()} {...busyProps(action.busy === 'add')}
            onClick={add}>{t('catalog:shared.add')}</Button>
        </div>
        {action.error ? <Note tone="error" title={t('catalog:wants.actionFailed')}>{action.error}</Note> : null}
      </div>

      {wants.error ? <Note tone="error" title={t('catalog:wants.loadFailed')}>{errorMessage(wants.error)}</Note> : null}
      {wants.isPending ? <div role="status" aria-label={t('catalog:wants.loading')} dangerouslySetInnerHTML={{ __html: javContentSkeleton('wants') }} /> : null}
      {data?.scraping ? <TaskProgress embedded kind={activityKind('want-scrape')} label={t('catalog:wants.fetchingNew')} /> : null}
      {data?.searching ? <TaskProgress embedded kind={activityKind('want-search')} label={t('catalog:wants.searchingResources')} /> : null}
      {downloads.error ? <Note tone="error" title={t('catalog:wants.downloadSettingsFailed')}>{errorMessage(downloads.error)}</Note> : null}
      {downloads.data && !configured.length ? <Note tone="neutral">{t('shell:downloadChannels.notConfigured')}{t('shell:format.sentenceGap')}<a href="/settings/downloads">{t('shell:downloadChannels.settingsLink')}</a></Note> : null}
      {downloads.data && !downloads.data.available ? <Note tone="neutral">{t('catalog:wants.cloudPrimaryOnly')}</Note> : null}

      {data && !items.length ? (
        <EmptyState size="compact" icon={RiStarLine} title={query ? t('catalog:wants.noSearchMatches') : t('catalog:wants.empty')}
          actions={query && clearQuery ? <Button size="small" onClick={clearQuery}>{t('catalog:shared.clearSearch')}</Button>
            : !query && !readOnly ? <EmptyFocusButton target={`input[aria-label="${t('catalog:shared.code')}"]`}>{t('catalog:wants.addWork')}</EmptyFocusButton> : undefined}>
          {query ? t('catalog:wants.tryOtherSearch') : t('catalog:wants.emptyHint')}
        </EmptyState>
      ) : null}

      {PHASES.map(([phase, label]) => {
        const rows = items.filter((want) => want.phase === phase);
        if (!rows.length) return null;
        return (
          <WantPhase key={phase} phase={phase} label={label} rows={rows} row={(want) => (
            <WantRow key={want.id} want={want} readOnly={readOnly} busy={action.busy}
              downloads={downloads.data} provider={selected} toast={toast}
              picked={selecting ? { on: picked.has(want.id), toggle: (on) => setPicked((current) => {
                const next = new Set(current);
                if (on) next.add(want.id); else next.delete(want.id);
                return next;
              }) } : undefined}
              onReset={() => reset(want)} onRemove={() => remove(want)}
              onCloudDownload={() => setDownload({
                code: want.code || '', title: want.title || '', origin: `wishlist:${want.id}`,
                cover: want.cover || '', performers: want.performers || '', release_date: want.release_date || '', studio: want.studio || '',
              })} />
          )} />
        );
      })}
      <CloudDownloadDialog prefill={download} close={() => setDownload(null)} receipt={toast} provider={selected} />
      <SelectionDock visible={selecting} label={t('catalog:wants.dockLabel')} count={t('catalog:javSelection.selectedCount', { count: chosen.length })}
        actions={[
          { action: removeMany, items: chosen, host, disabled: readOnly, done: () => setPicked(new Set()) },
          { action: resetMany, items: chosen.filter((want) => want.phase === 'given_up'), host, disabled: readOnly, done: () => setPicked(new Set()) },
        ]}
        leading={<Button size="small" variant="secondary" disabled={!items.length}
          onClick={() => setPicked(allPicked ? new Set() : new Set(items.map((want) => want.id)))}>
          {allPicked ? t('catalog:javSelection.deselectPage') : t('catalog:wants.selectAll')}</Button>}>
        <Button size="small" variant="secondary" disabled={!searchable.length}
          onClick={() => setResources(searchable.map((want) => ({ id: want.id, code: want.code!, title: want.title || '',
            release_date: want.release_date || undefined }) as Discovery))}>{t('catalog:shared.searchTorrents')}</Button>
        <Button size="small" variant="ghost" onClick={() => selection?.close()}>{t('catalog:javSelection.exit')}</Button>
      </SelectionDock>
      <JavBatchResources items={resources} close={() => setResources(null)} readOnly={readOnly} receipt={toast} />
    </div>
  );
}
