/* 关注列表里的 JAV 订阅表：
 * 一行一条源，名字前是她的资料图，列出类型、来源、状态、频率、上次拉取与新增，行尾是启用开关、
 * 拉取键与移除键（ADR-0042）。行尾这三样和关注列表那一行一一对应，两张表看起来是一回事。
 *
 * 订阅从人物页的「订阅新作」或「添加关注」按名字进，两条路都不收地址（ADR-0047、ADR-0083）。拉回来的
 * 新作排在首页与人物页筛选栏下面那一行，不在这里列——这里再列一遍就成了第二个入口，两处的
 * 已读状态会各说各话。
 * 服务端是唯一真相：开关与移除之后重取这一份，不在前端按响应拼一份新的本地状态。
 *
 * 勾选和关注列表同一套：勾在行首，点一行的空白处也是选这一行，选中了底部浮出批量操作。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createColumnHelper, createPaginatedRowModel, createSortedRowModel, flexRender, rowPaginationFeature,
  rowSelectionFeature, rowSortingFeature, columnVisibilityFeature, tableFeatures, useTable,
  type RowSelectionState, type SortingState,
} from '@tanstack/react-table';
import { RiCheckboxLine, RiDeleteBinLine, RiExternalLinkLine, RiPauseLine, RiPlayLine, RiRefreshLine, RiRssLine } from '@remixicon/react';

import { avatarInner } from '@peach/card-art';
import { mapLimit } from '@peach/legacy/core';
import { confirmModal } from '@peach/legacy/ui';

import { Chip } from '@/components/base/badges/chip';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Switch } from '@/components/base/switch/switch';
import {
  Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from '@/components/base/table/table';
import { ChevronSortDown } from '@/components/foundations/icons/chevrons';

import { errorMessage } from '../../api';
import { skeletonHtml } from '../../ui-kit/skeleton';
import { DataTableFrame } from '../components/data-table-frame';
import { useTablePreferences } from '../components/table-column-preferences';
import { TableColumnControls, TableColumnResizer } from '../components/table-column-controls';
import { TableSelectionHeader } from '../components/table-selection-header';
import { DataTableFooter, DataTableSort } from '../components/table-controls';
import { cardClass } from '../components/card';
import { EmptyState } from '../components/empty-state';
import { LEGACY_AVATAR_IMG } from '../components/legacy-avatar';
import { SiteIcon, SiteLabel } from '../components/source-label';
import { ColumnFilterAvatar } from '../components/column-filter-avatar';
import { Note } from '../components/note';
import type { BulkAction, Receipt } from '../components/bulk-action';
import { exitPageSelection } from '../components/page-selection';
import { SelectionDock } from '../components/selection-dock';
import { queryClient } from '../query';
import { ErrorText } from '../settings/section';
import { busyProps, useAction } from '../settings/use-action';
import { localTime } from '../time';
import {
  checkFeeds, errorHeadline, FEEDS_KEY, feedIntervalText, fetchFeeds, removeFeed, setFeedEnabled,
  pageWindow, type FeedSource,
} from './follow-manage';
import { codedText } from '../../core/server-text';
import { t } from '../../i18n';
import { useTableFilters } from '../components/use-table-filters';
import { useRowWorkContext, type WorkContextOperation } from '../components/work-context-menu';

const feedTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

const COLUMN_LABELS: Record<string, string> = {
  select: t('follow:shared.select'),
  name: t('follow:shared.name'),
  kind: t('follow:shared.type'),
  origin: t('follow:followFeed.filterKindSource'),
  status: t('follow:shared.status'),
  interval: t('follow:feedSources.colInterval'),
  fetched: t('follow:feedSources.colLastFetched'),
  fresh: t('follow:feedSources.colLastAdded'),
  actions: t('follow:shared.actions'),
};

const preferenceColumns = Object.entries(COLUMN_LABELS).map(([id, label]) => ({ id, label,
  /* 来源那一格要放下站标、`video.dmm.co.jp` 与外链图标，160 会把站名压到图标底下。 */
  width: id === 'select' ? 48 : id === 'name' ? 300 : id === 'actions' ? 208 : id === 'fetched' ? 200
    : id === 'origin' ? 184 : 160,
  min: id === 'select' ? 48 : id === 'actions' ? 200 : id === 'name' ? 300 : 112, max: id === 'select' ? 48 : id === 'name' ? 2000 : 800,
  flex: id === 'name',
  required: id === 'select' || id === 'name',
}));

const reload = () => queryClient.invalidateQueries({ queryKey: FEEDS_KEY, exact: true });

const feedName = (source: FeedSource) => source.name || source.url;
const feedSite = (source: FeedSource) => source.kind.startsWith('javdb') ? 'javdb'
  : source.kind.startsWith('dmm') ? 'dmm' : originHost(source.url);


/** 来源那一格只摆站名：地址整条写出来会把这张表撑到一屏之外，点开就是原页面。 */
function originHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** 启用状态与已取得的拉取结果共同决定当前标签。 */
function StatusChip({ source }: { source: FeedSource }) {
  if (!source.enabled) return <Chip variant="caption" color="gray">{t('follow:shared.paused')}</Chip>;
  if (source.last_error) return <Chip variant="caption" color="rose">{t('follow:feedSources.fetchFailed')}</Chip>;
  if (!source.last_fetched_at) return <Chip variant="caption" color="gray">{t('follow:feedSources.notChecked')}</Chip>;
  return <Chip variant="caption" color="lime">{t('follow:shared.ok')}</Chip>;
}

/** 名字前的圆框：和关注列表的创作者圆标同一个尺寸与底色。里面那段由 `card-art` 的 `avatarInner` 拼：
 *  有资料图按人脸取景出图，判据是服务端的 `has_image`；没有就是首字母。整格不进读屏，名字就在旁边。 */
function FeedAvatar({ source }: { source: FeedSource }) {
  const entity = source.entity_id
    ? {
        id: source.entity_id, has_image: !!source.has_image, image_version: source.image_version,
        avatar_focus: source.avatar_focus,
      }
    : null;
  return (
    <span aria-hidden
      className={`relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary ${LEGACY_AVATAR_IMG}`}
      dangerouslySetInnerHTML={{ __html: avatarInner(feedName(source), entity, null, 'performer') }} />
  );
}

/** 这一页在站上挂的另一个名字。一个人常有两页，本名页和旧艺名页在表里同名，
 *  只有这一段说得出哪一行是哪一页。只在这位不止一行时写：站上的标题栏常把几种写法
 *  连成一串（「涼森玲夢, 涼森れむ」），只有一行的人再摆一遍只是噪音；和统称一样时也不重复。 */
const pageAlias = (source: FeedSource, shared: ReadonlySet<number>) =>
  (source.entity_id !== null && shared.has(source.entity_id)
    && source.page_name && source.page_name !== source.name ? source.page_name : '');

/** 挂着不止一条源的人。 */
function sharedEntities(sources: FeedSource[]): ReadonlySet<number> {
  const seen = new Set<number>();
  const shared = new Set<number>();
  for (const { entity_id: id } of sources) {
    if (id === null) continue;
    if (seen.has(id)) shared.add(id); else seen.add(id);
  }
  return shared;
}

interface RowHandlers {
  readOnly: boolean;
  /** 挂着不止一条源的人，名字旁的页名只给他们写。 */
  shared: ReadonlySet<number>;
  /** 正在跑的那个动作的键（`useAction` 的 `busy`），行尾的拉取键按它挂忙态。 */
  busy: string | null;
  toggle(source: FeedSource, enabled: boolean): void;
  fetch(source: FeedSource): void;
  remove(source: FeedSource): void;
}

/** 移除前先弹确认，和关注列表那一行同一套：删的是这条源和它的去重记忆，拉回来的新作留着
 *  （`feed_discovery.source_id` 置空）。写入交给弹层，忙态和失败原因都落在弹层里。 */
function confirmRemove(sources: FeedSource[], write: () => Promise<unknown>) {
  const one = sources.length === 1 ? sources[0] : null;
  return confirmModal({
    title: one ? t('follow:feedSources.removeOne') : t('follow:feedSources.removeMany', { count: sources.length }),
    body: one
      ? t('follow:feedSources.removeOneBody', { name: feedName(one) })
      : t('follow:feedSources.removeManyBody'),
    confirmLabel: one ? t('follow:feedSources.removeOne') : t('follow:feedSources.removeSelected'), danger: true, holdToConfirm: true,
    onConfirm: write,
  });
}

export function FeedSources({ readOnly, toast, onAdd, selection }: {
  readOnly: boolean; toast: Receipt; onAdd(): void;
  selection?: {
    ids: ReadonlySet<number>;
    onChange: Dispatch<SetStateAction<ReadonlySet<number>>>;
    onActivate(): void;
  };
}) {
  const feeds = useQuery({ queryKey: FEEDS_KEY, queryFn: ({ signal }) => fetchFeeds(signal) });
  const action = useAction();
  const preferences = useTablePreferences('jav-feeds', preferenceColumns);
  const data = feeds.data;
  const sources = useMemo(() => data?.sources ?? [], [data]);
  const [ownSelected, setOwnSelected] = useState<ReadonlySet<number>>(new Set<number>());
  const selected = selection?.ids ?? ownSelected;
  const setSelected = selection?.onChange ?? setOwnSelected;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sorting, setSorting] = useState<SortingState>([]);
  const filtered = useTableFilters(sources, {
    name: { values: feedName, option: (name, source) => ({ leading: source && <ColumnFilterAvatar
      person={{ ...source, id: source.entity_id, name }} /> }) },
    kind: { values: source => codedText(source, 'kind_label'), option: (_, source) => ({
      leading: source && <SiteIcon site={feedSite(source)} /> }) },
    origin: { values: source => originHost(source.url), option: (domain, source) => ({
      leading: <SiteIcon site={source ? feedSite(source) : domain} /> }) },
    status: { values: source => !source.enabled ? t('follow:shared.paused')
      : source.last_error ? t('follow:feedSources.fetchFailed')
      : !source.last_fetched_at ? t('follow:feedSources.notChecked') : t('follow:shared.ok') },
    interval: { values: source => feedIntervalText(source.interval_minutes) },
  }, () => setPage(1));
  const win = pageWindow(filtered.items.length, pageSize, page);
  useEffect(() => { setPage((current) => Math.min(current, win.pages)) }, [win.pages]);

  /* 删掉的源不该还占着计数：清单换一份就把已经不在里面的 ID 丢掉。 */
  useEffect(() => {
    setSelected((now) => {
      const alive = new Set(sources.map((source) => source.id));
      const next = new Set([...now].filter((id) => alive.has(id)));
      return next.size === now.size ? now : next;
    });
  }, [sources, setSelected]);

  const bulk = useMutation({
    mutationFn: async (work: { ids: number[]; action: 'enabled' | 'paused' | 'remove' }) => {
      const results = await mapLimit(work.ids, 4, async (id: number) => {
        if (work.action === 'remove') await removeFeed(id);
        else await setFeedEnabled(id, work.action === 'enabled');
      });
      return { ...work, results };
    },
    onSuccess: (result) => {
      const failed = result.results.filter((row) => !row.ok);
      setSelected(new Set());
      void reload();
      if (failed.length) {
        const first = failed[0]!;
        action.setError(t('follow:feedSources.writeFailed', { count: failed.length, error: first.ok ? '' : errorMessage(first.error) }));
      }
    },
    onError: (cause) => action.setError(errorMessage(cause)),
  });

  /* 启用与暂停的撤销把这一批里状态真的变了的那几个改回去；移除撤不回，弹窗写明。 */
  const host = { receipt: toast, failure: (cause: unknown) => action.setError(errorMessage(cause)) };
  const toggleMany = (enable: boolean): BulkAction<FeedSource> => ({
    key: enable ? 'enable' : 'pause', label: enable ? t('follow:shared.enable') : t('follow:shared.pause'), reversal: 'undo',
    confirm: (rows) => ({ title: enable ? t('follow:feedSources.enableMany') : t('follow:feedSources.pauseMany'),
      body: t(enable ? 'follow:feedSources.enableManyBody' : 'follow:feedSources.pauseManyBody', { count: rows.length }) }),
    run: async (rows) => {
      const flipped = rows.filter((row) => row.enabled !== enable);
      const { results } = await bulk.mutateAsync({ ids: flipped.map((row) => row.id), action: enable ? 'enabled' : 'paused' });
      const changed = flipped.filter((_row, index) => results[index]?.ok);
      return async () => {
        await mapLimit(changed.map((row) => row.id), 4, (id: number) => setFeedEnabled(id, !enable));
        await reload();
      };
    },
    receipt: (rows) => t(enable ? 'follow:feedSources.enabledMany' : 'follow:feedSources.pausedMany', { count: rows.length }),
  });
  const removeMany: BulkAction<FeedSource> = {
    key: 'remove', label: t('follow:shared.remove'), reversal: 'irreversible', danger: true, holdToConfirm: true,
    confirm: (rows) => ({ title: t('follow:feedSources.removeMany', { count: rows.length }), danger: true,
      body: t('follow:feedSources.removeManyBody'), confirmLabel: t('follow:feedSources.removeSelected') }),
    run: async (rows) => { await bulk.mutateAsync({ ids: rows.map((row) => row.id), action: 'remove' }) },
    receipt: (rows) => t('follow:feedSources.removedMany', { count: rows.length }),
  };

  /* 列定义只建一次，行里的控件到点击那一刻再从这里取最新的处理器与只读态。 */
  const shared = useMemo(() => sharedEntities(sources), [sources]);
  const handlers = useRef<RowHandlers>({
    readOnly, shared, busy: null, toggle: () => {}, fetch: () => {}, remove: () => {},
  });
  handlers.current = {
    readOnly,
    shared,
    busy: action.busy,
    toggle: (source, enabled) => void action.run(`enabled-${source.id}`,
      (signal) => setFeedEnabled(source.id, enabled, signal), () => void reload()),
    /* 只拉这一条，停着的也拉：点这枚键的人就是想现在看她有没有新作，不必先去开开关。 */
    fetch: (source) => void action.run(`check-${source.id}`,
      (signal) => checkFeeds(signal, [source.id]), () => void reload()),
    remove: (source) => void confirmRemove([source], async () => {
      await removeFeed(source.id);
      toast(t('follow:feedSources.removedOne', { name: feedName(source) }));
      void reload();
    }),
  };

  const columns = useMemo(() => {
    const column = createColumnHelper<typeof feedTableFeatures, FeedSource>();
    const label = (id: string) => () => COLUMN_LABELS[id] || id;
    return column.columns([
      column.display({
        id: 'select',
        header: context => <TableSelectionHeader table={context.table} label={t('follow:feedSources.selectPage')} page />,
        /* `slot={null}`：表格自带一个叫 selection 的插槽，摆进去的勾不声明归属就会被它
           拦下报错。这一列的勾归 TanStack Table 那份行选择管，不走 Table 自己的选择。 */
        cell: (context) => (
          <Checkbox slot={null} isSelected={context.row.getIsSelected()}
            onChange={(on) => context.row.toggleSelected(on)}
            aria-label={t('follow:shared.selectNamed', { name: feedName(context.row.original) })} />
        ),
      }),
      column.accessor(feedName, {
        id: 'name',
        header: label('name'),
        /* 名字、频率与时间都不换行：窄屏上这张表靠 Table 自带的容器横着滚，让格子换行只会
           把「三上悠亜」竖着摆成四行，滚动反而没了用处。 */
        cell: (context) => {
          const alias = pageAlias(context.row.original, handlers.current.shared);
          return (
            <span className="flex items-center gap-2 whitespace-nowrap text-body-medium text-text-primary">
              <FeedAvatar source={context.row.original} />
              {context.getValue()}
              {alias ? (
                <span className="text-body-2-regular text-text-secondary" title={t('follow:feedSources.aliasTitle', { alias })}>
                  {alias}
                </span>
              ) : null}
            </span>
          );
        },
      }),
      column.accessor((row) => codedText(row, 'kind_label'), {
        id: 'kind',
        header: label('kind'),
        cell: (context) => <span className="whitespace-nowrap">{context.getValue()}</span>,
      }),
      column.accessor((row) => row.url, {
        id: 'origin',
        header: label('origin'),
        cell: (context) => (
          <a href={context.getValue()} target="_blank" rel="noopener noreferrer" title={t('follow:followDetail.viewOnSite')}
            className="max-w-full text-text-primary underline-offset-2 hover:underline">
            <SiteLabel site={feedSite(context.row.original)}
              label={originHost(context.getValue())} />
            <RiExternalLinkLine aria-hidden className="size-(--icon-inline) shrink-0" />
          </a>
        ),
      }),
      column.accessor((source) => source.last_error ? t('follow:feedSources.fetchFailed') : source.enabled ? t('follow:shared.enabled') : t('follow:shared.paused'), {
        id: 'status',
        header: label('status'),
        cell: (context) => <StatusChip source={context.row.original} />,
      }),
      column.accessor((row) => row.interval_minutes, {
        id: 'interval',
        header: label('interval'),
        cell: (context) => <span className="whitespace-nowrap">{feedIntervalText(context.getValue())}</span>,
      }),
      column.accessor((row) => row.last_fetched_at ? Date.parse(row.last_fetched_at) || 0 : 0, {
        id: 'fetched',
        header: label('fetched'),
        cell: (context) => <span className="whitespace-nowrap tabular-nums">{context.row.original.last_fetched_at ? localTime(context.row.original.last_fetched_at) : t('follow:feedSources.neverFetched')}</span>,
      }),
      column.accessor((row) => row.last_new_count, {
        id: 'fresh',
        header: label('fresh'),
        cell: (context) => <span className="whitespace-nowrap tabular-nums">{t('follow:feedSources.itemCount', { count: context.getValue() })}</span>,
      }),
      column.display({
        id: 'actions',
        header: label('actions'),
        /* 行尾和关注列表表格同一个次序：启用开关、拉取键、移除键挨在一起。两枚键次级描边、
           刷新与垃圾桶字形，xs 那一档和开关一样高。 */
        cell: (context) => (
          <span className="flex items-center gap-1">
            <Switch aria-label={t('follow:shared.enableNamed', { name: feedName(context.row.original) })}
              isSelected={context.row.original.enabled} isDisabled={handlers.current.readOnly}
              onChange={(enabled) => handlers.current.toggle(context.row.original, enabled)} />
            <Button variant="secondary" size="small" iconOnly leadingIcon={RiRefreshLine}
              aria-label={t('follow:feedSources.fetchNamed', { name: feedName(context.row.original) })}
              disabled={handlers.current.readOnly}
              {...busyProps(handlers.current.busy === `check-${context.row.original.id}`)}
              onClick={() => handlers.current.fetch(context.row.original)} />
            <Button variant="secondary" size="small" iconOnly leadingIcon={RiDeleteBinLine}
              aria-label={t('follow:shared.removeNamed', { name: feedName(context.row.original) })}
              disabled={handlers.current.readOnly}
              onClick={() => handlers.current.remove(context.row.original)} />
          </span>
        ),
      }),
    ]);
  }, []);

  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries([...selected].map((id) => [String(id), true])), [selected]);
  const table = useTable({
    features: feedTableFeatures,
    data: filtered.items,
    columns,
    getRowId: (row) => String(row.id),
    state: { rowSelection, sorting, pagination: { pageIndex: win.page - 1, pageSize }, columnVisibility: preferences.visibility },
    onColumnVisibilityChange: preferences.change,
    onSortingChange: (next) => { setSorting(next); setPage(1); },
    enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      selection?.onActivate();
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setSelected(new Set(Object.entries(next).filter(([, on]) => on).map(([id]) => Number(id))));
    },
  });

  const check = () => void action.run('check', (signal) => checkFeeds(signal), () => void reload());
  const toggleRow = (id: number) => {
    selection?.onActivate();
    setSelected((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const chosen = sources.filter((source) => selected.has(source.id));
  const failing = sources.filter((source) => source.last_error);
  const menu = useRowWorkContext((key) => sources.find(source => String(source.id) === key), (source) => {
    const operations: WorkContextOperation[] = [
      { id: 'select', label: t(selected.has(source.id) ? 'follow:shared.clearSelection' : 'follow:shared.selectNamed', { name: feedName(source) }),
        icon: RiCheckboxLine, run: () => toggleRow(source.id) },
    ];
    if (source.url) operations.unshift({ id: 'open', label: t('follow:sourceView.openSource'), icon: RiExternalLinkLine,
      run: () => { window.open(source.url, '_blank', 'noopener,noreferrer') } });
    if (!readOnly) operations.push(
      { id: 'fetch', label: t('follow:feedSources.fetchNamed', { name: feedName(source) }), icon: RiRefreshLine,
        disabled: !!action.busy, run: () => handlers.current.fetch(source) },
      { id: 'enabled', label: t(source.enabled ? 'follow:shared.pause' : 'follow:shared.enable'),
        icon: source.enabled ? RiPauseLine : RiPlayLine, disabled: !!action.busy, run: () => handlers.current.toggle(source, !source.enabled) },
      { id: 'remove', label: t('follow:shared.removeNamed', { name: feedName(source) }), icon: RiDeleteBinLine,
        danger: true, run: () => handlers.current.remove(source) },
    );
    return operations;
  });
  if (!data) {
    return feeds.error
      ? <Note tone="error" title={t('follow:feedSources.loadFailed')}>{errorMessage(feeds.error)}</Note>
      : <div dangerouslySetInnerHTML={{ __html: skeletonHtml(t('follow:feedSources.loading'), { fill: false }) }} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <section aria-label={t('follow:feedSources.listLabel')}
        className={cardClass({ padding: 'none', className: 'flex flex-col gap-4 px-6 py-5 max-sm:px-4' })} onKeyDown={menu.onKeyDown}>
      {menu.menu}
      <div data-responsive-toolbar="">
        <div data-toolbar-heading="">
        <h3 className="text-title-2-medium text-text-primary">{t('follow:feedSources.title')}</h3>
        <span className="text-body-2-regular text-text-secondary">{t('follow:feedSources.summary', { count: sources.length, unread: Number(data.unread) || 0 })}</span>
        </div>
        <div data-toolbar-actions="">
        <Button onClick={check} disabled={readOnly} {...busyProps(action.busy === 'check')}>{t('follow:feedSources.fetchNow')}</Button>
        <TableColumnControls preferences={preferences} label={t('follow:feedSources.title')} />
        <DataTableSort label={t('follow:feedSources.title')} sorting={sorting} onChange={(next) => { setSorting(next); setPage(1); }}
          options={['name', 'kind', 'origin', 'status', 'interval', 'fetched', 'fresh'].map((id) => ({ id, label: COLUMN_LABELS[id]! }))} />
        </div>
      </div>

      {failing.length || action.error ? (
        <div className="flex flex-col gap-3">
          {/* 拉不动的源并成一条：每条源一行「源名：报错首行」，几条源同时坏也不把表格推出首屏；
              表格里那一行的状态徽章同时标着「拉取失败」。 */}
          {failing.length ? (
            <Note tone="error" title={t('follow:feedSources.failedTitle', { count: failing.length })}
              extra={<ul className="flex flex-col gap-0.5 text-body-2-regular">
                {failing.map((source) => (
                  <li key={source.id} className="min-w-0 truncate" title={codedText(source, 'last_error')}>
                    {t('follow:shared.labeled', { label: feedName(source), value: errorHeadline(codedText(source, 'last_error')) || t('follow:shared.noReason') })}
                  </li>
                ))}
              </ul>}>
              {t('follow:feedSources.failedBody')}
            </Note>
          ) : null}
          {action.error ? <ErrorText>{action.error}</ErrorText> : null}
        </div>
      ) : null}

        <SelectionDock visible={chosen.length > 0} label={t('follow:feedSources.bulkActions')} count={t('follow:feedSources.selectedCount', { count: chosen.length })}
          actions={[toggleMany(true), toggleMany(false), removeMany].map((bulkAction) => ({
            action: bulkAction, items: chosen, host, disabled: readOnly || bulk.isPending }))}>
          <Button variant="ghost" size="small" onClick={exitPageSelection}>{t('follow:shared.clearSelection')}</Button>
        </SelectionDock>

      {sources.length ? (
        <DataTableFrame follow preferences={preferences} onRowClick={(key) => toggleRow(Number(key))}>
          <Table aria-label={t('follow:feedSources.title')} size="sm"
            sortDescriptor={sorting[0] ? { column: sorting[0].id, direction: sorting[0].desc ? 'descending' : 'ascending' } : undefined}
            onSortChange={(sort) => table.getColumn(String(sort.column))?.toggleSorting(sort.direction === 'descending')}>
            <TableHeader>
              {table.getHeaderGroups()[0]!.headers.map((header) => {
                const text = flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <TableColumn key={header.id} id={header.id} isRowHeader={header.column.id === 'name'} allowsSorting={header.column.getCanSort()} {...preferences.columnProps(header.id)}>
                    {({ sortDirection }) => <><span className="flex items-center gap-0.5">{filtered.header(header.id, COLUMN_LABELS[header.id] || header.id) ?? text}
                        {header.column.getCanSort() ? <span data-sort-indicator data-direction={sortDirection || undefined}><ChevronSortDown /></span> : null}
                      </span><TableColumnResizer preferences={preferences} id={header.id} /></>}
                  </TableColumn>
                );
              })}
              <TableColumn id="remaining-space" aria-label={t('follow:shared.rowSpacer')} data-table-space="" width={preferences.spaceWidth} minWidth={0} />
            </TableHeader>
            <TableBody renderEmptyState={() => t('shell:dataTable.empty')}>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} id={row.id} data-follow-selected={row.getIsSelected() || undefined} data-work-context-row={row.id}
                  onContextMenu={event => menu.onContextMenu?.(event, row.original, row.id)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  <TableCell data-table-space="" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableFrame>
      ) : (
        <EmptyState icon={RiRssLine} title={t('follow:feedSources.empty')} size="compact"
          actions={!readOnly ? <Button variant="secondary" onClick={onAdd}>{t('follow:feedSources.add')}</Button> : undefined}>
          {t('follow:feedSources.emptyHint')}
        </EmptyState>
      )}
      {sources.length ? (
        <DataTableFooter label={t('follow:feedSources.footerLabel')} total={win.total} unit={t('follow:feedSources.unit')}
          pagination={{ pageIndex: win.page - 1, pageSize }}
          onChange={(next) => { setPageSize(next.pageSize); setPage(next.pageIndex + 1); }} />
      ) : null}
      <footer className="-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4">
        <span role="status" className="mr-auto text-body-2-regular text-text-secondary">
          {t('follow:feedSources.footerSummary', { unread: Number(data.unread) || 0, enabled: sources.filter((source) => source.enabled).length, total: sources.length })}
        </span>
      </footer>
      </section>
    </div>
  );
}
