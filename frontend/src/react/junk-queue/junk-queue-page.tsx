/* 垃圾文件队列（`/junk-files`，由路由树画进 `#grid`）：筛选浮层加一屏逐项处置的卡片。
 *
 * 页面画在壳的 `#grid` 里，浮层经 portal 画进 `#count` 里自己建的一个 `.peach-react` 容器：
 * 那一行本身归壳（目录页也用它，换页时由壳清空），里面的分类条、读数与「全选」归这里。
 *
 * 首屏不在 `prefetch` 里等。分类条由地址决定、此刻就画得出最终样子，等的只有读数，所以一打开
 * 就画：计数行是等待态（`#count[aria-busy]`、摘要里一条占位），网格是壳那份骨架，数据到了
 * 骨架淡出、卡片从模糊里清晰起来（同目录网格）。在 `prefetch` 里等的话，请求挂着的这段时间
 * 屏上只有壳的静态骨架，分类点不动。
 *
 * 换分类或筛选条件是换查询键。壳处置完推进 `revision` 时查询也换键，
 * 但旧的一份留在屏上直到新的一份到货（`placeholderData`），被处置的那张卡原地消失，
 * 已经往下露出来的那几段也不收回去。 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { requestErrorMessage } from '@peach/legacy/core';
import { activityStatusHtml, LOAD_MORE_STATUS, popBadges } from '@peach/legacy/ui';
import { ButtonLink } from '@/components/base/buttons/button';

import { EmptyState } from '../components/empty-state';
import { LOAD_MORE_MARGIN, RetryNote, useSkeletonReveal } from '../components/grid-reveal';
import { spriteGlyph } from '../components/sprite-glyph';
import { JunkCard } from './junk-card';
import { JunkFilterChips, JunkList } from './junk-list';
import { useCatalogView } from '../catalog-grid/catalog-view';
import { useQueueSort } from '../components/queue-sort';
import { JunkCount } from './junk-count';
import { fetchJunkPage, groupJunkCopies, junkQueryKey, type JunkItem, type JunkPage, type JunkQueueProps, type JunkRoute } from './junk-queue';
import { t } from '../../i18n';
import type { TableFilters, RemoteTableFilters } from '../components/use-table-filters';

const CheckGlyph = spriteGlyph('check');

const sameRoute = (key: readonly unknown[], route: JunkRoute) => key[1] === route.view && key[2] === route.kind;

export function JunkQueuePage(props: JunkQueueProps) {
  const route: JunkRoute = { kind: props.kind, view: props.view };
  const [filters, setFilters] = useState<TableFilters>({});
  const encoded = JSON.stringify(filters);
  const query = useQuery<JunkPage, Error>({
    queryKey: encoded === '{}' ? junkQueryKey(route, props.revision) : [...junkQueryKey(route, props.revision), encoded],
    queryFn: ({ signal }) => fetchJunkPage(route, signal, encoded === '{}' ? undefined : filters),
    placeholderData: (previous, previousQuery) =>
      (previousQuery && sameRoute(previousQuery.queryKey, route) ? previous : undefined),
  });

  /* 一次取数落定就告诉壳一次，成功、为空、失败都算：壳里 `await` 这次重读的调用方据此放行。 */
  useEffect(() => {
    if (!query.isFetching) props.settled?.(props.revision);
  }, [query.isFetching, props.revision]);

  const host = useCountHost(props.countRow);
  const waiting = query.isPending;
  useLayoutEffect(() => {
    const row = props.countRow;
    if (!row) return;
    if (waiting) row.setAttribute('aria-busy', 'true');
    else row.removeAttribute('aria-busy');
  }, [props.countRow, waiting]);
  /* 判过一批之后各类的计数变了，弹的是变了的那几枚，没动的原地不动（遗留层 `popBadges`）。 */
  useLayoutEffect(() => {
    if (host && query.data) popBadges(host, 'junk');
  }, [host, query.data]);

  /* 排序键在浮层上、排的是网格里那一份，所以在这一层持有。 */
  const order = useQueueSort<JunkItem>('junk-files', { size: (item) => Number(item.size || 0), new: (item) => item.id });
  const { navigate, selectAll } = props.actions;
  const loaded = (query.data?.items || []).map((item) => item.id);
  const pickAll = query.data && !query.isFetching && !query.isError ? { loaded, picked: loaded.filter((id) => props.selected.has(id)).length,
    onChange: (on: boolean) => selectAll(loaded, on) } : null;
  const count = host
    ? createPortal(<JunkCount route={route} page={query.data} failed={query.isError && !query.data} pickAll={pickAll}
      sorts={order.sorts} onSort={order.onSort} onNavigate={navigate}
      onDisposeAll={!query.isFetching && !query.isError && route.view === 'pending' && Number(query.data?.total || 0) > 0
        ? () => encoded === '{}' ? props.actions.disposeAll(route.kind, Number(query.data!.total))
          : props.actions.disposeAll(route.kind, Number(query.data!.total), encoded) : undefined} />, host)
    : null;
  return (
    <>
      {count}
      <JunkBody key={`${route.view}:${route.kind}`} props={props} data={query.data} pending={waiting}
        filters={{ values: filters, facets: query.data?.column_facets ?? {}, onChange: setFilters }}
        error={query.error} busy={query.isFetching || query.isError} retry={() => void query.refetch()} order={order} />
    </>
  );
}

/** 计数行里归这一页的那一格。挂上时换掉壳铺的骨架，卸载时撤掉，行本身还给壳。 */
function useCountHost(row: HTMLElement | null): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!row) return undefined;
    const el = row.ownerDocument.createElement('div');
    el.className = 'peach-react';
    row.replaceChildren(el);
    setHost(el);
    return () => { el.remove(); setHost(null) };
  }, [row]);
  return host;
}

/** 一个分类、一个视图的网格：骨架、卡片、往下露的下一段与空态。 */
function JunkBody({ props, data, pending, error, retry, order, filters, busy }: {
  props: JunkQueueProps; data: JunkPage | undefined; pending: boolean; error: Error | null; retry(): void;
  order: ReturnType<typeof useQueueSort<JunkItem>>;
  filters: RemoteTableFilters;
  busy: boolean;
}) {
  const view = useCatalogView();
  const filtered = Object.values(filters.values).some(value => value !== undefined);
  const reveal = useSkeletonReveal(pending, props.skeletonHtml);
  const batch = Math.max(1, props.batchSize || 60);
  const [segments, setSegments] = useState(1);
  const items = order.sort(data?.items || []);
  const groups = groupJunkCopies(items);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const toggleCopies = (id: number) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const visible = (group: JunkItem[]) => expanded.has(group[0]!.id) ? group : group.slice(0, 1);
  const shown = groups.slice(0, segments * batch).flatMap(visible);
  const copyGroups = new Map(groups.filter((group) => group.length > 1).map((group) => [group[0]!.id, group]));
  const copyInfo = (item: JunkItem) => {
    const group = copyGroups.get(item.id);
    return group ? { count: group.length, bytes: group.reduce((sum, member) => sum + Number(member.size || 0), 0),
      expanded: expanded.has(item.id), toggle: () => toggleCopies(item.id) } : undefined;
  };
  const { canLoadMore } = props;
  const more = useCallback(() => {
    if (canLoadMore?.() === false) return;
    setSegments((current) => current + 1);
  }, [canLoadMore]);

  const content = () => {
    if (pending) return null;
    if (!data) return <RetryNote message={requestErrorMessage(error)} onRetry={retry} />;
    if (!items.length && view !== 'list') {
      if (filtered) return <EmptyState icon={CheckGlyph} title={t('shell:dataTable.empty')}>{null}</EmptyState>;
      const dismissed = props.view === 'dismissed';
      return (
        <EmptyState icon={CheckGlyph} title={dismissed ? t('cleanup:junk.emptyExcluded') : t('cleanup:junk.emptyUndecided')}
          actions={dismissed ? <ButtonLink size="small" href="/junk-files">{t('cleanup:junk.viewUndecided')}</ButtonLink> : undefined}>
          {dismissed ? t('cleanup:junk.emptyExcludedBody') : t('cleanup:junk.emptyUndecidedBody')}
        </EmptyState>
      );
    }
    /* 列表版式一次画齐：整批已经在手上，表格行比卡矮，不用往下一段段露。 */
    if (view === 'list') return <>
      <JunkList items={groups.flatMap(visible)} copies={copyInfo} view={props.view} selected={props.selected} selecting={props.selectMode} actions={props.actions} order={order} filters={filters} busy={busy} />
      {Number(data.total || 0) > items.length ? <p data-junk-truncated="" className="py-6 text-center text-caption-1-regular text-text-secondary">
        {t('cleanup:junk.truncated', { shown: items.length.toLocaleString(), count: Number(data.total) })}</p> : null}
    </>;
    return (
      <>
        <div data-media-grid="" data-junk-grid="" data-select-mode={props.selectMode ? '' : undefined}>
          {shown.map((item) => (
            <JunkCard key={item.id} item={item} view={props.view} selected={props.selected.has(item.id)}
              selectMode={props.selectMode} helpers={props.helpers} actions={props.actions} copies={copyInfo(item)} />
          ))}
        </div>
        {segments * batch < groups.length ? <RevealMore key={segments} onMore={more} /> : null}
        {/* 队列一次只取前 200 条：露到底了还有没取的，说清楚是截断而不是全部。 */}
        {segments * batch >= groups.length && Number(data.total || 0) > items.length
          ? <p data-junk-truncated="" className="py-6 text-center text-caption-1-regular text-text-secondary">
              {t('cleanup:junk.truncated', { shown: items.length.toLocaleString(), count: Number(data.total) })}
            </p>
          : null}
      </>
    );
  };
  return (
    <div data-junk-body="" data-grid-reveal={reveal.fading ? '' : undefined}>
      {view === 'cards' && filtered ? <div className="mb-4">
        <JunkFilterChips values={filters.values} onChange={filters.onChange} />
      </div> : null}
      {reveal.layer}
      {data && error ? <RetryNote message={requestErrorMessage(error)} onRetry={retry} /> : null}
      {content()}
    </div>
  );
}

/** 往下露下一段。数据已经整批在手上，不发请求：哨兵进入视口下方一屏内就露，点它也露，
 *  判据同目录网格的续页。每露一段按新键重挂，还在视口里就接着露。 */
function RevealMore({ onMore }: { onMore(): void }) {
  const node = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = node.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onMore();
    }, { rootMargin: LOAD_MORE_MARGIN });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onMore]);
  return <div ref={node} data-load-more="" onClick={onMore} dangerouslySetInnerHTML={{ __html: activityStatusHtml('linear-dots', LOAD_MORE_STATUS) }} />;
}
