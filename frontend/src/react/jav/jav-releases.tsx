/* JAV 页「新作」分区：订阅发现、还没入库的全部新作，按发行日期倒序分页。
 * 女优、厂牌两排与标签条只列这批新作里出现过的（`/api/jav/releases` 的 facets），点了在本分区里筛，
 * 不跳实体页；筛选与页码都写进地址栏。 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RiRssLine } from '@remixicon/react';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { esc, firstGrapheme, leadingGraphemes } from '@peach/legacy/core';
import { appSettingsStore, javLayout, storeJavLayout, JAV_LAYOUTS, cardRatio, gridLayout } from '@peach/appearance';
import { entityFaceImg, facePos, logoUrl } from '@peach/card-art';
import { wireHorizontalScroller } from '../../ui-kit/scroll';
import { javContentSkeleton, javTagSkeleton, JAV_RECOMMENDATION_GRID } from '../../jav-skeleton';
import { tierPlaceholdersHtml } from '../../catalog-filter-skeleton';
import { errorMessage } from '../../api';
import { entityDisplayName } from '../../core/entity-names';
import type { DownloadPrefill } from '../activity/cloud-download-dialog';
import { Note } from '../components/note';
import { CoverQueue } from '../components/cover-queue';
import { TaskProgress } from '../components/task-progress';
import { activityKind } from '../../activity-kinds';
import { EmptyState } from '../components/empty-state';
import { DataTableFooter } from '../components/table-controls';
import { FilterGlassRows, FilterPill, FilterActionButton } from '../components/filter-glass';
import { Segments, Shuffle, SortKeys } from '../entity-filter/entity-filter-page';
import { Chip } from '@/components/base/badges/chip';
import { recommendationScore, RELEASE_SORTS, type DiscoveryDirection, type ReleaseSort } from './discovery-sorts';
import { addWant, invalidateWants } from '../wants/wants';
import { useAction } from '../settings/use-action';
import { useEntityNames } from '../use-entity-names';
import { DiscoveryCard, resourcePrefill } from './discovery-card';
import { controlReleaseMetadata, coverArrived, DISCOVERY_METADATA_KEY, fetchCoverNow, fetchDiscoveryMetadata, fetchReleases, metadataInterval,
  releaseFilters, releaseKey, releaseColumnValues, releaseColumnSelection, setReleaseColumn, RELEASE_PAGE_SIZE, RELEASE_PAGE_SIZES,
  type Discovery, type DiscoveryMetadataStatus, type ReleaseFacetPerformer, type ReleaseFacetStudio, type ReleaseFilters,
  writeJavQuery } from './jav';
import { queryClient } from '../query';
import { ReleaseTable } from './jav-release-table';
import { CatalogViewToggle } from '../catalog-grid/catalog-view-toggle';
import { useCatalogView } from '../catalog-grid/catalog-view';
import { useVisibleJavWorks } from './jav-selection';
import { t } from '../../i18n';
import { columnValueSelected, toggleColumnValue, type ColumnSelection } from '../../column-filters';

type Facet = 'performer' | 'studio' | 'tag';
/** 等数据时两排头像的占位，与路由骨架（`releasesFilterSkeleton`）同一份。 */
const TIER_PLACEHOLDERS = `<div data-catalog-tier="performers" data-skeleton="tiers">${tierPlaceholdersHtml('performer')}</div><div data-catalog-tier="studios">${tierPlaceholdersHtml('studio')}</div>`;

const performerRing = (person: ReleaseFacetPerformer) =>
  `<span data-tier-initial>${esc(firstGrapheme(entityDisplayName('performer', person.name, person.id)))}</span>${entityFaceImg({
    id: person.id, hasImage: person.has_image, version: person.image_version, style: facePos(person.avatar_focus),
    focus: person.avatar_focus, standIn: person.avatar_stand_in })}`;

/** 按口味排时卡上那枚推荐档，与「发现」同一套分档。 */
function TasteChip({ value }: { value?: number | null }) {
  const recommendation = recommendationScore(value);
  return <span data-jav-taste-score="" title={t('catalog:javScore.taste', { score: recommendation.score })}><Chip color={recommendation.color}>{recommendation.label}</Chip></span>;
}

function StudioMark({ studio }: { studio: ReleaseFacetStudio }) {
  const [broken, setBroken] = useState(false);
  return <span data-tier-mark="">
    {studio.has_logo && !broken ? <img src={logoUrl(studio.name, 'icon', studio.logo_version)} alt="" width={28} height={28}
      loading="lazy" decoding="async" onError={() => setBroken(true)} /> : leadingGraphemes(studio.name, 2)}
  </span>;
}

/** 本页一键插队当场取一部：取到就补进已取回的数据（`coverArrived`），卡片换成本机那张。 */
const fetchReleaseCover = (code: string) => fetchCoverNow(code).then(result => {
  if (result.has_cover) coverArrived(code, result);
  return result.has_cover;
});

export function Releases({ readOnly, receipt, resource, query, navigate, clearText }: {
  readOnly: boolean; receipt(message: string): void; resource(work: DownloadPrefill): void; query: string;
  navigate(path: string): void; clearText(): void;
}) {
  useEntityNames();
  const [filters, setFilters] = useState<ReleaseFilters>(() => releaseFilters(location.search));
  /* 页头的 `IndexSearch` 停手 300 毫秒才交出文字，这里换了就回第 1 页重问服务端。 */
  useEffect(() => {
    if (query === filters.q) return;
    setFilters(current => ({ ...current, q: query, page: 1 }));
    writeJavQuery({ page: '' });
  }, [query, filters.q]);
  const chooseValues = (facet: Facet, values: ColumnSelection | undefined) => {
    const next = setReleaseColumn(filters, facet, values);
    setFilters(next);
    writeJavQuery({ [facet]: '', column_filters: next.column_filters || '', page: '' });
  };
  const choose = (facet: Facet, value: string) => {
    const values = releaseColumnSelection(filters, facet);
    chooseValues(facet, values === undefined ? [value] : toggleColumnValue(values, value, !columnValueSelected(values, value)));
  };
  const section = useRef<HTMLElement>(null);
  const changePage = ({ pageIndex, pageSize }: { pageIndex: number; pageSize: number }) => {
    const page = pageIndex + 1;
    setFilters(current => ({ ...current, page, size: pageSize }));
    writeJavQuery({ page: page > 1 ? String(page) : '', size: pageSize === RELEASE_PAGE_SIZE ? '' : String(pageSize) });
    section.current?.scrollIntoView({ block: 'start' });
  };
  const clear = () => {
    setFilters(current => ({ ...current, performer: '', studio: '', tag: '', column_filters: '', q: '', page: 1 }));
    writeJavQuery({ performer: '', studio: '', tag: '', column_filters: '', page: '' });
    clearText();
  };
  /* 点选中的那一枚翻方向；换一枚时番号默认正序，其余倒序（同「发现」）。 */
  const sortBy = (key: ReleaseSort) =>
    setSort(key, key === filters.sort ? (filters.dir === 'asc' ? 'desc' : 'asc') : key === 'code' ? 'asc' : 'desc');
  /* 列表模式的表头直接给出方向。 */
  const setSort = (key: ReleaseSort, dir: DiscoveryDirection) => {
    setFilters(current => ({ ...current, sort: key, dir, seed: '', page: 1 }));
    writeJavQuery({ sort: key === 'release_date' ? '' : key, dir: dir === 'asc' ? 'asc' : '', seed: '', page: '' });
  };
  /* 换一批：同一批新作按新种子重排，翻页时顺序不变；排序键都不再按下。 */
  const reshuffle = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    setFilters(current => ({ ...current, sort: 'random', dir: 'desc', seed, page: 1 }));
    writeJavQuery({ sort: 'random', dir: '', seed, page: '' });
  };
  useEffect(() => {
    const rows = section.current?.querySelectorAll('[data-catalog-tier],[data-catalog-tags],[data-filter-row="bottom"]');
    const scrollers = [...(rows || [])].map(row => wireHorizontalScroller(row, { drag: true }));
    return () => scrollers.forEach(scroller => scroller.destroy());
  }, []);
  const settings = appSettingsStore();
  useSyncExternalStore(settings.subscribe, settings.version, settings.version);
  const layout = javLayout();
  /* 卡片／列表与馆藏同一个开关（`peach.catalog-view.v1`）：JAV 页的馆藏与新作一起切。 */
  const view = useCatalogView();
  const ratio = cardRatio(gridLayout({ active: true, home: false, portrait: false }));
  /* 新作列表只读：每问一次都把全部候选重算一遍，不拿它当进度轮询，自己也不轮询。还没读过来源资料的
     那几部由「读取资料」起一轮（与「发现」共用一个任务），进度单独轮询；读的期间读到的标签与评分由
     全站那一处的 `discoveries` 版本作废列表带上来，跑完再取一次，标签与筛选项补全。 */
  const releases = useQuery({ queryKey: releaseKey(filters), queryFn: ({ signal }) => fetchReleases(filters, signal),
    placeholderData: keepPreviousData, retry: false, refetchOnWindowFocus: false });
  const listedJob = releases.data?.metadata_job;
  const listedRunning = useRef(false);
  listedRunning.current = listedJob?.status === 'running';
  const polled = queryClient.getQueryData<DiscoveryMetadataStatus>(DISCOVERY_METADATA_KEY)?.metadata_job;
  /* 进度只在有一轮在跑时轮询：列表带回来的、或起读回执写进来的那一轮。 */
  const progress = useQuery({ queryKey: DISCOVERY_METADATA_KEY, retry: false, refetchOnWindowFocus: false,
    enabled: listedJob?.status === 'running' || polled?.status === 'running',
    queryFn: ({ signal }) => fetchDiscoveryMetadata(signal),
    refetchInterval: metadataInterval(() => listedRunning.current) });
  // 两处谁新用谁：进度轮询与起读的回执写在进度那份里，列表重取时也带回当前任务。
  const metadata = progress.data && progress.dataUpdatedAt >= releases.dataUpdatedAt
    ? progress.data.metadata_job : listedJob;
  const reading = metadata?.status === 'running';
  const wasReading = useRef(false);
  useEffect(() => {
    if (wasReading.current && !reading) void releases.refetch();
    wasReading.current = reading;
  }, [reading, releases]);
  /* 筛选结果里有从没读过的就起一轮；同一组筛选每次挂载只起一次，停下、失败的那一轮不在这里重启。 */
  const started = useRef('');
  const scope = JSON.stringify([filters.performer, filters.studio, filters.tag, filters.column_filters, filters.q, filters.sort, filters.dir, filters.seed]);
  const unread = !releases.isPlaceholderData && (releases.data?.metadata_unread || 0) > 0 && !reading;
  useEffect(() => {
    if (!unread || started.current === scope) return;
    started.current = scope;
    void controlReleaseMetadata('start', filters).then(async (result) => {
      // 起读之前发出的进度请求晚回来会盖掉这份回执，先取消。
      await queryClient.cancelQueries({ queryKey: DISCOVERY_METADATA_KEY });
      queryClient.setQueryData(DISCOVERY_METADATA_KEY, result);
    }).catch(() => {});
  }, [unread, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const action = useAction();
  const want = (item: Discovery) => { void action.run(String(item.id), signal => addWant({ code: item.code }, signal), () => {
    receipt(t('catalog:javWant.added')); void invalidateWants(); void releases.refetch();
  }) };
  const data = releases.data;
  useVisibleJavWorks(data?.items || []);
  const waiting = releases.isPending;
  const filtered = !!(filters.performer || filters.studio || filters.tag || filters.column_filters || filters.q);
  const pages = Math.max(1, Math.ceil((data?.total || 0) / filters.size));
  useEffect(() => {
    if (!data || releases.isPlaceholderData || filters.page <= pages) return;
    setFilters(current => ({ ...current, page: pages }));
    writeJavQuery({ page: pages > 1 ? String(pages) : '' });
  }, [data, releases.isPlaceholderData, filters.page, pages]);
  return <section ref={section} aria-label={t('catalog:entityHero.subscribeNewReleases')} aria-busy={waiting || releases.isFetching} className="flex min-w-0 scroll-mt-24 flex-col gap-4">
    {waiting ? <div data-catalog-tiers="" aria-busy="true" dangerouslySetInnerHTML={{ __html: TIER_PLACEHOLDERS }} /> : null}
    {data && (data.facets.performers.length || data.facets.studios.length) ? <div data-catalog-tiers="" data-release-tiers="">
      {data.facets.performers.length ? <div data-catalog-tier="performers" role="group" aria-label={t('catalog:javReleases.filterByActress')}>
        {data.facets.performers.map(person => <button key={person.name} type="button" data-tier-performer=""
          aria-pressed={releaseColumnValues(filters, 'performer').includes(person.name)} title={t('catalog:javReleases.facetCount', { name: entityDisplayName('performer', person.name, person.id), count: person.count })}
          onClick={() => choose('performer', person.name)}>
          <span data-tier-ring="" dangerouslySetInnerHTML={{ __html: performerRing(person) }} />
          <span data-tier-name="">{entityDisplayName('performer', person.name, person.id)}</span>
        </button>)}
      </div> : null}
      {data.facets.studios.length ? <div data-catalog-tier="studios" role="group" aria-label={t('catalog:javReleases.filterByLabel')}>
        {data.facets.studios.map(studio => <button key={studio.name} type="button" data-tier-studio=""
          aria-pressed={releaseColumnValues(filters, 'studio').includes(studio.name)} title={t('catalog:javReleases.facetCount', { name: studio.name, count: studio.count })} onClick={() => choose('studio', studio.name)}>
          <StudioMark studio={studio} />{studio.name}<span data-count-badge="">{studio.count}</span>
        </button>)}
      </div> : null}
    </div> : null}
    <FilterGlassRows label={t('catalog:javReleases.filtersLabel')} topLabel={t('catalog:javReleases.tagsLabel')} attrs={{ 'data-filter-frame': '', 'data-jav-filter': '', 'data-catalog-frame': '' }}
      busy={waiting} topClassName="gap-1.5 overflow-visible" bottomClassName="min-h-12" top={<div data-catalog-scroll="">
        <div data-catalog-tags="" dangerouslySetInnerHTML={waiting ? { __html: javTagSkeleton() } : undefined}>
          {waiting ? null : data?.facets.tags.map(row => <FilterPill key={row.name} data-catalog-tag={row.name} data-entity-press=""
            pressed={releaseColumnValues(filters, 'tag').includes(row.name)} onPress={() => choose('tag', row.name)}>
            {row.name}<span data-count-badge="">{row.count}</span>
          </FilterPill>)}
        </div></div>} bottom={<>
        <span data-catalog-readout="">{waiting ? <span data-skeleton="count" aria-hidden className="relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen" />
          : filtered ? t('catalog:javReleases.matchedCount', { matched: data?.total || 0, count: data?.candidate_total || 0 }) : t('catalog:countLabel.works', { count: data?.total || 0 })}</span>
        {filtered ? <FilterActionButton onPress={clear}>{t('catalog:shared.clearFilters')}</FilterActionButton> : null}
        <span data-entity-sorts="">
          <Shuffle onPress={reshuffle} busy={filters.sort === 'random' && releases.isFetching} />
          {view === 'cards' ? <Segments label={t('catalog:entityFilter.javCardLayout')} value={layout} options={JAV_LAYOUTS} onChange={storeJavLayout} /> : null}
          <CatalogViewToggle />
          <SortKeys group="releases" sorts={RELEASE_SORTS.map(([key, label, ariaLabel]) => ({ key, label, ariaLabel, pressed: key === filters.sort, dir: filters.dir }))}
            onSort={key => sortBy(key as ReleaseSort)} />
        </span>
      </>} />
    {waiting && view === 'cards' ? <div role="status" aria-label={t('catalog:javReleases.loading')} dangerouslySetInnerHTML={{ __html: javContentSkeleton('discover', layout) }} /> : null}
    {releases.error ? <Note tone="error" title={t('catalog:javReleases.failed')}>{errorMessage(releases.error)}</Note> : null}
    {reading && metadata ? <div data-jav-metadata="" className="min-w-0"><TaskProgress kind={activityKind('jav-discovery-metadata')}
      label={t('catalog:javMetadata.loadingProgress', { completed: metadata.completed, count: metadata.total })} value={metadata.completed} total={metadata.total} /></div> : null}
    {readOnly ? null : <CoverQueue scope={t('catalog:javReleases.coverQueueScope')} fetchOne={fetchReleaseCover}
      codes={(data?.items || []).filter(item => item.cover_state === 'queued' && !item.cover_url).map(item => item.code)}
      settled={(got, total) => {
        receipt(got === total ? t('catalog:javReleases.coversFetched', { count: total }) : t('catalog:javReleases.coversPartial', { got, count: total }));
        void releases.refetch();
      }} />}
    {!waiting && !releases.error && !data?.items.length && (view === 'cards' || !filtered) ? <EmptyState icon={RiRssLine} title={filtered ? t('catalog:javReleases.noMatches') : t('catalog:javReleases.emptyTitle')}
      actions={filtered ? <Button size="small" onClick={clear}>{t('catalog:shared.clearFilters')}</Button>
        : <ButtonLink size="small" href="/subscriptions?tab=add">{t('catalog:javReleases.addSubscription')}</ButtonLink>}>
      {filtered ? t('catalog:javReleases.clearFiltersHint') : t('catalog:javReleases.emptyHint')}
    </EmptyState> : null}
    {action.error ? <Note tone="error">{action.error}</Note> : null}
    {view === 'list' ? waiting || data?.items.length || filtered ? <ReleaseTable items={data?.items || []} waiting={waiting} filters={filters}
      studios={data?.facets.studios || []} javImage={settings.value.javImage} readOnly={readOnly} navigate={navigate}
      facets={data?.facets} onFilter={chooseValues}
      onTag={value => choose('tag', value)} onSort={setSort} wanting={item => action.busy === String(item.id)}
      onWant={want} onResource={item => resource(resourcePrefill(item))} /> : null
    : <div data-media-grid="" className={JAV_RECOMMENDATION_GRID} style={{ '--card-ratio': ratio } as CSSProperties}>
      {(data?.items || []).map(item => <DiscoveryCard key={item.id} item={item} layout={layout} javImage={settings.value.javImage}
        readOnly={readOnly} navigate={navigate} tag={releaseColumnValues(filters, 'tag')} onTag={value => choose('tag', value)}
        wanting={action.busy === String(item.id)} onWant={() => want(item)}
        onResource={() => resource(resourcePrefill(item))} badge={filters.sort === 'taste' ? <TasteChip value={item.taste_score} /> : undefined} />)}
    </div>}
    {data ? <DataTableFooter label={t('catalog:javTabs.newReleases')} total={data.total}
      pagination={{ pageIndex: filters.page - 1, pageSize: filters.size }} onChange={changePage}
      unit={t('catalog:catalogList.footerUnit')} pageUnit={t('catalog:catalogList.footerPageUnit')} pageSizes={RELEASE_PAGE_SIZES} /> : null}
  </section>;
}
