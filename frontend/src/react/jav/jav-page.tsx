import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RiCompassLine } from '@remixicon/react';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { Chip } from '@/components/base/badges/chip';
import { appSettingsStore, javLayout, storeJavLayout, JAV_LAYOUTS, cardRatio, gridLayout } from '@peach/appearance';
import { wireHorizontalScroller } from '../../ui-kit/scroll';
import { javContentSkeleton, javTagSkeleton, JAV_RECOMMENDATION_GRID } from '../../jav-skeleton';
import { errorMessage } from '../../api';
import { CloudDownloadDialog, type DownloadPrefill } from '../activity/cloud-download-dialog';
import { Note } from '../components/note';
import { EmptyState } from '../components/empty-state';
import { WantList } from '../wants/want-list';
import { JavSelectionProvider, useVisibleJavWorks } from './jav-selection';
import { addWant, invalidateWants } from '../wants/wants';
import { busyProps, useAction } from '../settings/use-action';
import { controlDiscoveryMetadata, DISCOVERY_METADATA_KEY, discoveryKey, fetchDiscoveries, fetchDiscoveryMetadata, metadataInterval, writeJavQuery,
  type DiscoveryMetadataJob, type DiscoveryScope } from './jav';
import { queryClient } from '../query';
import { DiscoveryCard, resourcePrefill } from './discovery-card';
import { Releases } from './jav-releases';
import { JavHeader } from './jav-header';
import { IndexSearch } from '../index/index-search';
import { spriteGlyph } from '../components/sprite-glyph';
import { FilterGlassRows, FilterIconButton, FilterPill, GlassPill } from '../components/filter-glass';
import { LibraryShortcuts } from '../library-shortcuts/shortcut-controls';
import { Segments, SortKeys } from '../entity-filter/entity-filter-page';
import { TaskProgress } from '../components/task-progress';
import { activityKind } from '../../activity-kinds';
import { DISCOVERY_SORTS, discoveryScore, recommendationScore, type DiscoverySort } from './discovery-sorts';
import { jobText, serverLabelList } from '../../core/server-text';
import { t } from '../../i18n';
import type { Receipt } from '../components/bulk-action';

const MetadataStopGlyph = spriteGlyph('x');
const MetadataRefreshGlyph = spriteGlyph('refresh-cw');
const SEARCH_LABELS: Record<string, string> = { releases: t('catalog:javSearch.filterReleases'), discover: t('catalog:javSearch.filterRecommended'), wants: t('catalog:javSearch.filterWants') };

export function JavPage({ tab, readOnly, navigate, receipt }: {
  tab: string; readOnly: boolean; navigate(path: string): void; receipt: Receipt;
}) {
  const [download, setDownload] = useState<DownloadPrefill | null>(null);
  const [text, changeText] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const setText = (value: string) => { changeText(value); writeJavQuery({ q: value }) };
  return <JavSelectionProvider key={tab} readOnly={readOnly} receipt={receipt} dock={tab !== 'wants'}><div className="flex w-full flex-col gap-6">
    <JavHeader tab={tab} navigate={navigate} find={() => setDownload({})}
      search={<IndexSearch label={SEARCH_LABELS[tab] || t('catalog:javDiscover.filter')} value={text} onQuery={setText} />} />
    {tab === 'releases'
      ? <Releases readOnly={readOnly} receipt={receipt} resource={setDownload} query={text.trim()} navigate={navigate} clearText={() => setText('')} />
      : tab === 'discover'
      ? <Discover readOnly={readOnly} receipt={receipt} resource={setDownload} query={text.trim()} navigate={navigate} clearText={() => setText('')} />
      : <WantList readOnly={readOnly} toast={receipt} query={text.trim()} clearQuery={() => setText('')} />}
    <CloudDownloadDialog prefill={download} close={() => setDownload(null)} receipt={receipt} />
  </div></JavSelectionProvider>;
}

function Discover({ readOnly, receipt, resource, query, navigate, clearText }: {
  readOnly: boolean; receipt(message: string): void; resource(work: DownloadPrefill): void; query: string;
  navigate(path: string): void; clearText(): void;
}) {
  const params = new URLSearchParams(location.search);
  const [scope, changeScope] = useState<DiscoveryScope>(() => params.get('scope') === 'library' ? 'library' : 'external');
  const [tag, changeTag] = useState(() => params.get('tag') || '');
  const [sort, changeSort] = useState<DiscoverySort>(() => DISCOVERY_SORTS.some(([key]) => key === params.get('sort'))
    ? params.get('sort') as DiscoverySort : 'taste');
  const [ascending, changeAscending] = useState(() => params.get('dir') === 'asc');
  const setScope = (value: DiscoveryScope) => { changeScope(value); writeJavQuery({ scope: value === 'external' ? '' : value }) };
  const setTag = (value: string) => { changeTag(value); writeJavQuery({ tag: value }) };
  const setSort = (value: DiscoverySort) => { changeSort(value); writeJavQuery({ sort: value === 'taste' ? '' : value }) };
  const setAscending = (value: boolean) => { changeAscending(value); writeJavQuery({ dir: value ? 'asc' : '' }) };
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const rows = section.current?.querySelectorAll('[data-catalog-scroll],[data-catalog-tags],[data-filter-row="bottom"]');
    const scrollers = [...(rows || [])].map(row => wireHorizontalScroller(row, { drag: true }));
    return () => scrollers.forEach(scroller => scroller.destroy());
  }, []);
  const settings = appSettingsStore();
  useSyncExternalStore(settings.subscribe, settings.version, settings.version);
  const layout = javLayout();
  const ratio = cardRatio(gridLayout({ active: true, home: false, portrait: false }));
  const direction = ascending ? 'asc' : 'desc';
  /* 推荐列表只读，自己不轮询。资料读取进行中时进度单独轮询；读到的标签与评分由全站那一处的
     `discoveries` 版本作废列表带上来，读完再取一次。 */
  const discoveries = useQuery({ queryKey: discoveryKey(scope, sort, direction), retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => fetchDiscoveries(scope, signal, { sort, direction }),
  });
  const listedJob = discoveries.data?.metadata_job;
  const listedRunning = useRef(false);
  listedRunning.current = listedJob?.status === 'running';
  const progress = useQuery({ queryKey: DISCOVERY_METADATA_KEY, retry: false, refetchOnWindowFocus: false,
    enabled: scope === 'external',
    queryFn: ({ signal }) => fetchDiscoveryMetadata(signal),
    refetchInterval: metadataInterval(() => listedRunning.current),
  });
  // 两处谁新用谁：进度轮询与起停的回执写在进度那份里，列表重取时也带回当前任务。
  const metadata = progress.data && progress.dataUpdatedAt >= discoveries.dataUpdatedAt
    ? progress.data.metadata_job : listedJob;
  const jobState = (job: DiscoveryMetadataJob | null | undefined) => (job ? `${job.job_id}:${job.status}` : '');
  const answered = useRef('');
  const seen = useRef('');
  const polled = progress.data?.metadata_job;
  useEffect(() => {
    // 轮询看到这一轮从进行中到结束：列表再取一次。起停按钮自己的回执不算，它已经取过。
    const state = jobState(polled);
    const ended = seen.current.endsWith(':running') && polled && polled.status !== 'running';
    seen.current = state;
    if (ended && state !== answered.current) void discoveries.refetch();
  }, [jobState(polled)]); // eslint-disable-line react-hooks/exhaustive-deps
  const action = useAction();
  const metadataAction = useAction();
  const control = async (kind: 'start' | 'refresh' | 'cancel', signal?: AbortSignal) => {
    const result = await controlDiscoveryMetadata(kind, { sort, direction, jobId: metadata?.job_id }, signal);
    if (kind !== 'start') await discoveries.refetch({ cancelRefetch: true, throwOnError: true });
    // 起停之前发出的进度请求晚回来会盖掉这份回执（比如挂载时那次），先取消。
    await queryClient.cancelQueries({ queryKey: DISCOVERY_METADATA_KEY });
    answered.current = jobState(result.metadata_job);
    queryClient.setQueryData(DISCOVERY_METADATA_KEY, result);
  };
  const updateMetadata = (key: 'stop' | 'update' | 'retry') => {
    void metadataAction.run(key, signal => control(key === 'stop' ? 'cancel' : 'refresh', signal), () => {});
  };
  // 打开页面时补读从没读过或已过期的那几部（停下、失败的那一轮由服务端留着，不重启）；
  // 每次挂载只问一次。
  const autoStarted = useRef(false);
  const unread = scope === 'external' && metadata?.status !== 'running' && (discoveries.data?.items || [])
    .some(item => item.metadata_state === 'pending' || item.metadata_state === 'stale');
  useEffect(() => {
    if (!unread || autoStarted.current) return;
    autoStarted.current = true;
    void control('start').catch(() => {});
  }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = discoveries.data?.items || [];
  const tags = [...new Set(all.flatMap(item => item.tags || []))];
  const items = all.filter(item => (!tag || item.tags?.includes(tag)) &&
    (!query || [item.code, item.title, item.performers, item.studio, ...(item.tags || []), ...(item.performer_refs || []).map(ref => ref.name)].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const waiting = discoveries.isPending;
  useVisibleJavWorks(items);
  return <section ref={section} aria-label={t('catalog:shared.recommendedForYou')} aria-busy={waiting} className="flex min-w-0 flex-col gap-4">
    <FilterGlassRows label={t('catalog:javDiscover.filtersLabel')} topLabel={t('catalog:javDiscover.scopeLabel')} attrs={{ 'data-filter-frame': '', 'data-jav-filter': '', 'data-catalog-frame': '' }}
      busy={waiting} topClassName="gap-1.5 overflow-visible" bottomClassName="min-h-12" top={<div data-catalog-scroll="">
      <div data-catalog-views="">
        {([['external', t('catalog:javDiscover.external')], ['library', t('catalog:javDiscover.library')]] as const).map(([key, label]) =>
          <FilterPill key={key} data-entity-tag={key} data-entity-press="" pressed={scope === key} onPress={() => { setScope(key); setTag('') }}>{label}</FilterPill>)}
        <span data-entity-sep="" aria-hidden="true" />
      </div><div data-catalog-tags="" dangerouslySetInnerHTML={waiting ? { __html: javTagSkeleton() } : undefined}>
        {waiting ? null : tags.map(name => <FilterPill key={name} data-catalog-tag={name} data-entity-press="" pressed={tag === name} onPress={() => setTag(tag === name ? '' : name)}>
          {name}<span data-count-badge="">{all.filter(item => item.tags?.includes(name)).length}</span>
        </FilterPill>)}
      </div></div>} bottom={<>
        <span data-catalog-readout="">{waiting ? <span data-skeleton="count" aria-hidden className="relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen" /> : t('catalog:countLabel.works', { count: items.length })}</span>
        <LibraryShortcuts currentHref={() => location.pathname + location.search} />
        {query || tag ? <GlassPill onPress={() => { setTag(''); clearText() }}>{t('catalog:shared.clearFilters')}</GlassPill> : null}
        <span data-entity-sorts="">
        {scope === 'external' ? <FilterIconButton data-entity-batch="" data-jav-metadata-update=""
          label={metadata?.status === 'running' ? t('catalog:javDiscover.stopUpdating') : t('catalog:javDiscover.updateMetadata')}
          disabled={waiting} data-skeleton-action={waiting ? '' : undefined} busy={!!metadataAction.busy}
          icon={metadata?.status === 'running' ? MetadataStopGlyph : MetadataRefreshGlyph}
          onPress={() => updateMetadata(metadata?.status === 'running' ? 'stop' : 'update')} /> : null}
        <Segments label={t('catalog:entityFilter.javCardLayout')} value={layout} options={JAV_LAYOUTS} onChange={storeJavLayout} />
        <SortKeys sorts={DISCOVERY_SORTS.map(([key, label, ariaLabel]) => ({ key, label, ariaLabel,
          pressed: key === sort, dir: direction }))} onSort={key => {
          if (key === sort) setAscending(!ascending); else { setSort(key as DiscoverySort); setAscending(key === 'code') }
        }} /></span>
      </>} />
    {waiting ? <div role="status" aria-label={t('catalog:javDiscover.loading')} dangerouslySetInnerHTML={{ __html: javContentSkeleton('discover', layout) }} /> : null}
    {discoveries.error ? <Note tone="error" title={t('catalog:javDiscover.failed')}>{errorMessage(discoveries.error)}</Note> : null}
    {scope === 'external' && metadata?.status === 'running' ? <div data-jav-metadata="" className="min-w-0"><TaskProgress kind={activityKind('jav-discovery-metadata')}
        label={t('catalog:javMetadata.loadingProgress', { completed: metadata.completed, count: metadata.total })} value={metadata.completed} total={metadata.total} /></div> : null}
    {metadata && metadata.status !== 'running' && (metadata.status !== 'complete' || metadata.failed > 0)
      ? <Note tone="neutral" action={<Button variant="secondary" {...busyProps(metadataAction.busy === 'retry')}
        aria-label={t('catalog:javMetadata.retry')} onClick={() => updateMetadata('retry')}>{t('catalog:shared.retryNow')}</Button>}>{jobText(metadata) || t('catalog:javMetadata.progress', { completed: metadata.completed, count: metadata.total })}</Note> : null}
    {metadataAction.error ? <Note tone="error">{metadataAction.error}</Note> : null}
    {!waiting && !discoveries.error && !items.length ? <EmptyState icon={RiCompassLine} title={query || tag ? t('catalog:javDiscover.noMatches') : t('catalog:javDiscover.noTasteMatches')}
      actions={<><ButtonLink size="small" href="/taste" variant="secondary">{t('catalog:javDiscover.viewTaste')}</ButtonLink>
        {query || tag ? <Button variant="primary" size="small" onClick={() => { clearText(); changeTag(''); writeJavQuery({ q: '', tag: '' }) }}>{t('catalog:shared.clearFilters')}</Button>
        : scope === 'library' ? <ButtonLink variant="primary" size="small" href="/">{t('catalog:entityPage.browseCollection')}</ButtonLink>
        : <Button variant="primary" size="small" onClick={() => resource({})}>{t('catalog:javDiscover.findVideos')}</Button>}</>}>
      {query || tag ? t('catalog:javDiscover.clearFiltersHint') : scope === 'library' ? t('catalog:javDiscover.libraryEmptyHint') : t('catalog:javDiscover.externalEmptyHint')}
    </EmptyState> : null}
    {action.error ? <Note tone="error">{action.error}</Note> : null}
    <div data-media-grid="" className={JAV_RECOMMENDATION_GRID} style={{ '--card-ratio': ratio } as CSSProperties}>
      {items.map(item => {
        const recommendation = recommendationScore(item.taste_score ?? item.score);
        const scoreDetails = [recommendation.label, t('catalog:javScore.taste', { score: discoveryScore(item.taste_score ?? item.score) }),
          discoveries.data?.ranking_method === 'mmr' && item.ranking_score != null ? t('catalog:javScore.ranking', { score: discoveryScore(item.ranking_score) }) : '',
          item.source_score != null ? t('catalog:javScore.siteRating', { rating: item.source_score.toFixed(1) }) : '', ...serverLabelList(item.reasons, item.reason_codes, item.reason_params)].filter(Boolean).join(' · ');
        return <DiscoveryCard key={item.id} item={item} layout={layout} javImage={settings.value.javImage} readOnly={readOnly}
          navigate={navigate} tag={tag} onTag={setTag} wanting={action.busy === String(item.id)}
          onWant={() => { void action.run(String(item.id), signal => addWant({ code: item.code }, signal), () => {
            receipt(t('catalog:javWant.added')); void invalidateWants(); void discoveries.refetch();
          }) }}
          onResource={() => resource(resourcePrefill(item))}
          badge={<button data-jav-taste-score="" type="button" title={scoreDetails} aria-label={t('catalog:javScore.badgeLabel', { score: recommendation.score, label: recommendation.label })}
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            <Chip color={recommendation.color}>{recommendation.label}</Chip>
          </button>} />;
      })}
    </div>
  </section>;
}
