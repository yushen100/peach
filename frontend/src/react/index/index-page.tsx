/* 索引页：艺人、创作者、厂牌、事务所、系列名册和标签词表。
 *
 * 地址栏是唯一真相。壳从地址读出 kind／q／scope／view／category 作初值挂上来，页面换档
 * （厂牌↔事务所、本地↔在线、类型、视图、过滤词）只改自己的状态并经 `route` 写回地址，
 * 不重挂：重挂会让页头连同过滤框里正在打的字一起被换掉，Tabs 那条蓝线从头起跑。
 *
 * 页头只有标题、读数、版式切换和过滤框；页面级的切换（厂牌／事务所、本地／在线）是页头
 * 下面那排 Tabs。标签页的读数住在浮层下排，页头不再重复一遍。 */
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Radio } from 'react-aria-components';

import { refitNativeImages } from '@peach/card-art';
import { requestErrorMessage } from '@peach/legacy/core';
import { indexSkeletonHtml, spinnerHtml } from '@peach/legacy/ui';

import { Button, ButtonLink } from '@/components/base/buttons/button';
import { IndexSearch } from './index-search';
import { DataTableFooter } from '../components/table-controls';
import { tagSkeletonHtml, TAG_PAGE_SIZE, TAG_PAGE_SIZES } from '../../tag-skeleton';
import { INDEX_NOUNS } from '../../index-skeleton';
import { useTagPagination, useTagPageBounds } from './tag-pagination';

import { IDENTITY_ROW_CLASS } from '../../identity-filter';

import { BoardTabs, type BoardTab } from '../components/board-tabs';
import { SortableBoardTabs } from '../components/navigation-order';
import { EmptyState } from '../components/empty-state';
import { LibraryShortcuts } from '../library-shortcuts/shortcut-controls';
import { AsyncText } from '../components/async-text';
import { SkeletonContent } from '../components/skeleton-content';
import { pageNavigationReady } from '../../history/page-navigation';
import { SEGMENTED_TRACK, SEGMENT_ICON, SegmentedRadioGroup as RadioGroup } from '../components/segmented';
import { spriteGlyph } from '../components/sprite-glyph';
import type { OnlineAuthor, OnlineTag } from '../follow/online-vocab';
import {
  INDEX_TITLES, IDENTITY_CATEGORIES, ONLINE_TAG_CATEGORIES, TAG_CATEGORIES, countText, flatItems, indexQuery, indexRoute, indexSource, isCompany,
  isPeople, tagGroups, type IndexKind, type IndexPage as Page, type IndexPerson, type IndexProps,
  type IndexRoute, type IndexScope, type IndexTag, type PeopleLayout,
} from './index-data';
import { OnlineAuthors, PeopleGrid } from './index-people';
import { RosterDock, useRosterSelection } from './roster-selection';
import { OnlineTagDock } from './online-tag-dock';
import { TagAlphabet, TagCloud, TagDock, TagFilters, type TagEntry } from './index-tags';
import { TagManager } from './tag-manager';
import { TagEditor, useTagStatusCounts } from './tag-operations';
import { FilterActionButton } from '../components/filter-glass';
import { t } from '../../i18n';

/* 厂牌与事务所是两种实体，不是同一份数据的两种筛选：厂牌出片，事务所出人。所以这个开关切的
   是地址。场记板归厂牌，公文包归事务所，字形各说各的那一件事。 */
const MAKER_TABS: BoardTab<'studios' | 'agencies' | 'series'>[] = [
  { value: 'studios', label: t('catalog:shared.studios'), symbol: 'clapperboard' },
  { value: 'series', label: t('catalog:shared.series'), symbol: 'list' },
  { value: 'agencies', label: t('catalog:shared.agencies'), symbol: 'briefcase' },
];
/* 本地与在线是两套词表：计数口径、类别划分和点开去哪儿都不同，所以也是页面级的 Tabs。 */
const SCOPE_TABS: BoardTab<IndexScope>[] = [
  { value: 'local', label: t('catalog:shared.localLabel'), symbol: 'hard-drive' },
  { value: 'online', label: t('catalog:shared.online'), symbol: 'rss' },
];
const PEOPLE_TABS: BoardTab<'performers' | 'creators' | 'online'>[] = [
  { value: 'performers', label: t('catalog:shared.performers'), symbol: 'user-round' },
  { value: 'creators', label: t('catalog:shared.sellers'), symbol: 'user-round' },
  { value: 'online', label: t('catalog:shared.online'), symbol: 'rss' },
];

/* 公司那一格摆的是标识而不是脸，沿用艺人那套词就是提示说着「竖幅头像」、屏幕上摆着方标识。
   档位仍是同一个设置值，分开的只有说法。 */
const LAYOUTS: Record<'people' | 'company' | 'series', readonly (readonly [PeopleLayout, string, string])[]> = {
  people: [['big', t('catalog:peopleIndex.layoutLargePortrait'), 'maximize'], ['compact', t('catalog:peopleIndex.layoutCompactRound'), 'layout-grid']],
  company: [['big', t('catalog:peopleIndex.layoutLargeLogo'), 'maximize'], ['compact', t('catalog:peopleIndex.layoutCompactLogo'), 'layout-grid']],
  series: [['big', t('catalog:peopleIndex.layoutLargeSeries'), 'maximize'], ['compact', t('catalog:peopleIndex.layoutCompactSeries'), 'layout-grid']],
};

function LayoutSwitch(
  { kind, layout, onChange }: { kind: IndexKind; layout: PeopleLayout; onChange(layout: PeopleLayout): void },
) {
  return (
    <RadioGroup aria-label={t('catalog:peopleIndex.layout', { title: INDEX_NOUNS[kind] })} orientation="horizontal" value={layout}
      onChange={(next) => onChange(next as PeopleLayout)} data-index-layout=""
      className={`flex-none ${SEGMENTED_TRACK}`}>
      {LAYOUTS[kind === 'series' ? 'series' : isCompany(kind) ? 'company' : 'people'].map(([value, label, symbol]) => {
        const Glyph = spriteGlyph(symbol);
        return (
          <Radio key={value} value={value} aria-label={label} className={SEGMENT_ICON}>
            <span title={label} className="contents"><Glyph className="size-4" /></span>
          </Radio>
        );
      })}
    </RadioGroup>
  );
}

type Item = IndexPerson | IndexTag | OnlineAuthor | OnlineTag;

export function IndexPage(props: IndexProps) {
  const [managing, setManaging] = useState(false);
  const [addingBlockedTag, setAddingBlockedTag] = useState(false);
  /* 标签页平时那排状态药丸点「已隐藏」「已屏蔽内容」：进标签管理，直接落在那一档。 */
  const [managerState, setManagerState] = useState<'active' | 'hidden' | 'blocked'>('active');
  const [route, setRoute] = useState<IndexRoute>(() => indexRoute(
    { kind: props.kind, q: props.q, scope: props.scope, view: props.view, category: props.category },
  ));
  const incoming = JSON.stringify([props.kind, props.q, props.scope, props.view, props.category]);
  const [previousIncoming, setPreviousIncoming] = useState(incoming);
  if (incoming !== previousIncoming) {
    setPreviousIncoming(incoming);
    setRoute(indexRoute(props));
  }
  const [layout, setLayout] = useState<PeopleLayout>(props.layout);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [match, setMatch] = useState<'any' | 'all'>('any');
  const root = useRef<HTMLDivElement>(null);
  const { kind, q, scope, view, category } = route;
  const title = INDEX_TITLES[kind], noun = INDEX_NOUNS[kind];
  const onlineTags = kind === 'tags' && scope === 'online';
  const onlineAuthors = kind === 'performers' && scope === 'online';

  /* 地址给的那一份被规范过（旧链接换了名册、认不出的分类回到全部）：用 replace 改写地址，
     标题、侧栏和历史记录都跟页面上真正显示的那一份走，后退也不会再落回旧地址。
     写地址排到微任务里：壳写地址会同步画侧栏、路由根也同步提交，两处都用 `flushSync`，在提交阶段里画不出来。
     这一页已卸下就不写。 */
  useEffect(() => {
    if (route.kind === props.kind && route.scope === props.scope && route.category === props.category) return;
    let live = true;
    queueMicrotask(() => { if (live) props.route(route, { replace: true }) });
    return () => { live = false };
  }, []);

  /* 选择键归壳：关掉时所选跟着清空，下次打开从零开始，同目录页的多选。 */
  useEffect(() => { if (!props.selectMode) setPicked(new Set()) }, [props.selectMode]);
  /* 本地名册的多选：进了多选模式才显示勾选与浮条，选择集按实体 id 记。在线创作者那一档不在内。 */
  const rosterKind = isPeople(kind) && !onlineAuthors ? kind : null;

  /* 换筛选、词表或类型时保留控件，只在结果区显示等待态。 */
  const go = (patch: Partial<IndexRoute>, replace = false) => {
    if (patch.scope !== undefined) setManaging(false);
    const next = { ...route, ...patch };
    setRoute(next);
    props.route(next, { replace });
  };

  const { pagination, onChange: changePage } = useTagPagination(JSON.stringify(route));
  const query = indexQuery(indexSource(route), pagination.pageSize);
  const pagedKey = kind === 'tags' && (pagination.pageIndex || pagination.pageSize !== TAG_PAGE_SIZE)
    ? [...query.queryKey, 'page', pagination.pageIndex, pagination.pageSize] : query.queryKey;
  const result = useInfiniteQuery<Page<Item>>({
    queryKey: pagedKey,
    queryFn: ({ pageParam, signal }) => query.queryFn({ pageParam: pageParam as number, signal }),
    initialPageParam: kind === 'tags' ? pagination.pageIndex * pagination.pageSize : 0,
    getNextPageParam: kind === 'tags' ? () => undefined : query.getNextPageParam,
    enabled: !(managing && kind === 'tags'),
    placeholderData: keepPreviousData,
  });
  const items = flatItems(result.data);
  const pending = result.isPending || result.isPlaceholderData;
  const more = !!result.hasNextPage && !result.isPlaceholderData;
  const total = result.data?.pages[0]?.total;
  useEffect(() => {
    void pageNavigationReady(() => window.location.pathname === `/${kind}` && !!root.current?.isConnected,
      root.current?.querySelector('[data-index-body]'), { pending });
  }, [result.data, result.isPending, result.isPlaceholderData, route]);
  useTagPageBounds(kind === 'tags' && !result.isPlaceholderData ? total : undefined, pagination, changePage);
  const readout = kind === 'tags'
    ? (result.isPending || result.isError ? '' : t('catalog:peopleIndex.tagCount', { count: total ?? items.length }))
    : countText(items.length, !!result.hasNextPage);
  /* 分类计数只随名册、词表和过滤词变，与选中哪一类无关。换分类时新一页还没到，沿用同一份
     名册上一次拿到的计数：分类按钮行不先塌成「全部」加当前项、等数据回来再弹开。头一回
     还没有计数时整排都摆出来，同壳铺的骨架那一排，计数到了再收掉空的那几类。 */
  const countsKey = `${kind}:${scope}:${q}`;
  const lastCounts = useRef<{ key: string; counts: Record<string, number> } | null>(null);
  const pageCounts = result.data?.pages[0]?.categories;
  if (pageCounts && !result.isPlaceholderData) lastCounts.current = { key: countsKey, counts: pageCounts };
  const categoryCounts = pageCounts ?? (lastCounts.current?.key === countsKey ? lastCounts.current.counts : undefined);
  const waiting = result.isPending && !categoryCounts;
  const hasEntries = ([key]: readonly [string, string]) => key === 'all' || waiting || Number(categoryCounts?.[key] || 0) > 0;
  /* 从名册隐藏的那几项收在「已隐藏」里：有隐藏的、或正看着这一档时才摆出这颗键。 */
  const hiddenCount = result.data?.pages[0]?.hidden ?? 0;
  const hiddenView = category === 'hidden';
  const hiddenButton = rosterKind && (hiddenCount > 0 || hiddenView) ? (
    <Button variant={hiddenView ? 'primary' : 'secondary'} size="small" aria-pressed={hiddenView} data-roster-hidden=""
      onClick={() => go({ category: hiddenView ? 'all' : 'hidden' })}>{t('catalog:rosterActions.hiddenView', { count: hiddenCount })}</Button>
  ) : null;
  /* 「已隐藏」里的都恢复了就回到全部，不停在一页空结果上。 */
  useEffect(() => {
    if (hiddenView && !pending && !result.isError && hiddenCount === 0) go({ category: 'all' }, true);
  }, [hiddenView, pending, hiddenCount]);
  const roster = useRosterSelection(!!rosterKind && props.selectMode, rosterKind ? items as IndexPerson[] : []);
  /* 在线标签的多选按标签 id 写，页面上按名字记选中，这里换一次。 */
  const onlinePicked = onlineTags ? (items as IndexTag[]).filter((tag) => picked.has(tag.k)) : [];

  /* 框换了大小，「这张图要不要补底」和人脸放大都得重算：图早加载完了，不会再自己发一次 load。
     赶在绘制之前，否则换版式那一帧是按旧框算的几何。 */
  useLayoutEffect(() => { if (root.current) refitNativeImages(root.current) }, [layout]);

  const tags = useMemo<TagEntry[]>(() => kind === 'tags'
    ? (items as IndexTag[]).map((tag) => ({ ...tag, label: onlineTags ? tag.k : props.tagLabel(tag.k) })) : [], [items, kind, onlineTags]);
  const groups = useMemo(() => kind === 'tags' && view === 'alphabet'
    ? tagGroups(tags, (tag) => onlineTags ? tag : props.tagLabel(tag)) : [], [tags, view, kind, onlineTags]);

  const changeLayout = (next: PeopleLayout) => { setLayout(next); props.savePreference({ layout: next }) };

  const tabs = kind === 'tags'
    ? <SortableBoardTabs group="tags" tabs={SCOPE_TABS} value={scope} label={t('catalog:peopleIndex.tagScope')} onChange={(next) => {
      setPicked(new Set());
      // 在线标签全是英文，字母表才是它的形态；切过去时顺手换上，不必再点一次。
      go({ scope: next, category: 'all', view: next === 'online' ? 'alphabet' : view });
    }} />
    : isCompany(kind) || kind === 'series'
        ? <BoardTabs tabs={MAKER_TABS} value={kind as 'studios' | 'agencies' | 'series'} label={t('catalog:peopleIndex.companyType')}
          onChange={(next) => go({ kind: next })} />
        : null;

  const tagCounts = useTagStatusCounts(scope, kind === 'tags' && !managing);
  const openManager = (state: 'hidden' | 'blocked') => {
    props.exitSelectMode(); setPicked(new Set()); setManagerState(state); setManaging(true);
  };

  const pressTag = (tag: string) => {
    if (onlineTags && !props.selectMode) { props.openFollowTag(tag); return }
    if (!props.selectMode) {
      const identity = tags.find(item => item.k === tag);
      if (identity?.entity_id) props.openEntity('tag', tag);
      else props.showTags([tag], 'all');
      return;
    }
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(tag)) next.add(tag);
      return next;
    });
  };

  const categories = (onlineTags ? ONLINE_TAG_CATEGORIES : TAG_CATEGORIES).filter(hasEntries);

  const body = () => {
    if (pending) {
      return null;
    }
    if (result.isError) {
      return (
        <EmptyState icon={spriteGlyph('alert')} title={t('catalog:peopleIndex.loadFailed', { title: noun })}
          actions={<Button variant="secondary" onClick={() => void result.refetch()}>{t('catalog:shared.retryNow')}</Button>}>
          {requestErrorMessage(result.error)}
        </EmptyState>
      );
    }
    if (!items.length) return <IndexEmpty kind={kind} filtered={!!q || category !== 'all'}
      online={onlineTags || onlineAuthors} onClear={() => go({ q: '', category: 'all' })} />;
    if (onlineAuthors) return <OnlineAuthors items={items as OnlineAuthor[]} layout={layout} props={props} />;
    if (isPeople(kind)) return <PeopleGrid kind={kind} items={items as IndexPerson[]} layout={layout} props={props} picks={roster.picks} />;
    const actions = { online: onlineTags, picked, press: pressTag };
    return view === 'alphabet' ? <TagAlphabet groups={groups} actions={actions} /> : <TagCloud tags={tags} actions={actions} />;
  };

  return (
    <div ref={root} data-index-page={kind} className="flex min-w-0 flex-col">
      <div data-index-head="" className="mb-5 flex min-w-0 flex-wrap items-center gap-3 max-board-narrow:gap-x-2">
        <h2 data-index-title="" className="flex flex-none items-center text-display-4-medium whitespace-nowrap text-text-primary max-board-narrow:text-title-1-medium">
          {title}
        </h2>
        {isPeople(kind) ? (
          <span data-index-count="" className="text-caption-1-regular leading-5 whitespace-nowrap text-text-secondary tabular-nums max-board-narrow:order-1 max-board-narrow:basis-full">
            {/* 没取到就没有读数：「0 项」读起来是「名册是空的」，和报错说的是两件事。 */}
            <AsyncText text={pending ? undefined : result.isError ? '' : readout} busy={pending}
              placeholder={<span aria-hidden className="skeleton-sheen inline-block h-3.5 w-24 rounded-md" />} />
          </span>
        ) : null}
        {isPeople(kind) ? <LayoutSwitch kind={kind} layout={layout} onChange={changeLayout} /> : null}
        <LibraryShortcuts kind={kind === 'tags' ? 'tag' : kind === 'series' ? 'series' : kind === 'studios' ? 'studio' : kind === 'agencies' ? 'agency' : kind === 'creators' ? 'creator' : 'performer'} />
        {kind === 'tags' ? <Button variant={managing ? 'primary' : 'ghost'} iconOnly className="flex-none" data-tag-mode=""
          leadingIcon={spriteGlyph('pencil')} aria-label={managing ? t('catalog:peopleIndex.backToTags') : t('catalog:peopleIndex.manageTags')} title={managing ? t('catalog:peopleIndex.backToTags') : t('catalog:peopleIndex.manageTags')} aria-pressed={managing}
          onClick={() => { props.exitSelectMode(); setPicked(new Set()); setManagerState('active'); setManaging(!managing) }} /> : null}
        <IndexSearch label={t('catalog:peopleIndex.filterTitle', { title: noun })} value={q} onQuery={(next) => { if (next !== q) go({ q: next }, !!next) }} />
      </div>
      {kind === 'performers' || kind === 'creators' ? (
        <BoardTabs tabs={PEOPLE_TABS} value={onlineAuthors ? 'online' : kind} label={t('catalog:peopleIndex.roster')}
          onChange={(next) => {
            if (next === 'online') props.exitSelectMode();
            go({ kind: next === 'online' ? 'performers' : next,
              scope: next === 'online' ? 'online' : 'local', category: 'all' });
          }} />
      ) : null}
      {tabs}
      {managing && kind === 'tags' ? <TagManager key={`${scope}:${managerState}`} scope={scope} state={managerState} search={q} category={category} view={view}
        onCategory={next => go({ category: next })} onView={next => go({ view: next })}
        onJump={at => root.current?.querySelector(`[data-alpha-group="${at}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })} /> : <>
      {kind === 'performers' && scope === 'local' ? (
        <div aria-label={t('catalog:peopleIndex.identityCategory')} className={IDENTITY_ROW_CLASS}>
          {IDENTITY_CATEGORIES.filter((entry) => entry[0] === category || hasEntries(entry)).map(([key, label]) => (
            <Button key={key} variant={category === key ? 'primary' : 'secondary'} size="small"
              aria-pressed={category === key} onClick={() => go({ category: key })}>{label}</Button>
          ))}
          {hiddenButton}
        </div>
      ) : hiddenButton ? (
        <div className={IDENTITY_ROW_CLASS}>
          <Button variant={hiddenView ? 'secondary' : 'primary'} size="small" aria-pressed={!hiddenView}
            onClick={() => go({ category: 'all' })}>{t('catalog:shared.all')}</Button>
          {hiddenButton}
        </div>
      ) : null}
      {kind === 'tags' ? (
        <TagFilters categories={categories} category={category} online={onlineTags}
          actions={onlineTags ? <FilterActionButton onPress={() => setAddingBlockedTag(true)}>{t('catalog:tagManager.blockByName')}</FilterActionButton> : undefined}
          readout={result.isPending ? undefined : readout}
          status={{ hidden: false, blocked: false, ...tagCounts, onChange: (hidden) => { if (hidden) openManager('hidden') },
            ...(onlineTags ? { onBlocked: () => openManager('blocked') } : {}) }}
          letters={groups.map(([letter]) => letter)} view={view}
          onCategory={(next) => go({ category: next })}
          onView={(next) => go({ view: next })}
          onJump={(at) => root.current?.querySelector(`[data-alpha-group="${at}"]`)
            ?.scrollIntoView({ block: 'start', behavior: 'smooth' })} />
      ) : null}
      <div data-index-body=""><SkeletonContent pending={pending} skeletonHtml={() => kind === 'tags'
        ? tagSkeletonHtml({ mode:view, pageSize:pagination.pageSize }) : indexSkeletonHtml({ kind, layout, mode: view })}>
        {body()}
      </SkeletonContent></div>
      {kind === 'tags' && !pending && !result.isError ? <div className="mt-5">
        <DataTableFooter label={t('catalog:shared.tags')} total={total ?? items.length} pagination={pagination} onChange={changePage} unit={t('catalog:peopleIndex.footerUnit')} pageUnit={t('catalog:peopleIndex.footerPageUnit')} pageSizes={TAG_PAGE_SIZES} />
      </div> : null}
      {more ? (
        <div className="mt-5 flex justify-center">
          {/* 按下去到下一批画出来之间要有东西在动：这一段是一次网络往返加一屏头像，光把键按灰了
              说不出「还在走」和「点了没反应」的区别。用户按下的键走 Spinner（同播放墙的「载入更多」），
              键上的字不变，键宽留够放下转圈，下面的内容不跟着跳。 */}
          <Button variant="secondary" data-index-more="" className="min-w-31"
            disabled={result.isFetchingNextPage} aria-busy={result.isFetchingNextPage || undefined}
            onClick={() => void result.fetchNextPage()}>
            {result.isFetchingNextPage ? <span className="contents" dangerouslySetInnerHTML={{ __html: spinnerHtml(t('catalog:peopleIndex.loadingNext')) }} /> : null}
            {t('catalog:shared.loadMore')}
          </Button>
        </div>
      ) : null}
      {rosterKind ? <RosterDock kind={rosterKind} hiddenView={hiddenView} selection={roster} total={items.length}
        visible={props.selectMode} exit={props.exitSelectMode} /> : null}
      {onlineTags ? <OnlineTagDock tags={onlinePicked} visible={props.selectMode} pageTags={items as IndexTag[]}
        onPick={(keys) => setPicked(new Set(keys))} exit={props.exitSelectMode} /> : null}
      {kind === 'tags' && !onlineTags && props.selectMode ? (
        <TagDock count={picked.size} match={match} onMatch={setMatch}
          onClear={() => setPicked(new Set())}
          onApply={() => { const chosen = [...picked]; setPicked(new Set()); props.showTags(chosen, match) }} />
      ) : null}
      </>}
      {addingBlockedTag ? <TagEditor operation="block" selected={[]} scope="online"
        close={() => setAddingBlockedTag(false)} done={() => setPicked(new Set())} /> : null}
    </div>
  );
}

/** 空馆藏、筛选无结果与在线来源还没有内容分别给出可执行的去处。文案同目录页的空态
 *  （`frontend/src/catalog-onboarding.ts` 的 `catalogEmptyHtml`）。 */
function IndexEmpty(
  { kind, filtered, online, onClear }: { kind: IndexKind; filtered: boolean; online: boolean; onClear(): void },
) {
  if (filtered) {
    return (
      <EmptyState icon={spriteGlyph('search')} title={t('catalog:peopleIndex.noMatches')}
        actions={<Button size="small" onClick={onClear}>{t('catalog:shared.clearFilters')}</Button>}>
        {t('catalog:peopleIndex.noMatchesHint')}
      </EmptyState>
    );
  }
  // 在线那一档数的是来源上的东西，名字也跟着来源的说法：艺人页在线摆的是关注来源里的创作者。
  const label = online && kind === 'performers' ? t('catalog:peopleIndex.nounOnlineCreators') : INDEX_NOUNS[kind];
  const follow = (
    <ButtonLink size="small" variant={online ? 'primary' : 'secondary'} href="/subscriptions?tab=add">{t('catalog:entityOnlineEmpty.addFollow')}</ButtonLink>
  );
  return (
    <EmptyState icon={spriteGlyph(kind === 'tags' ? 'tags' : 'user-round')} title={t('catalog:peopleIndex.emptyTitle', { label })}
      actions={online ? follow : <>
        <ButtonLink size="small" href="/settings/library">{t('catalog:shared.addMedia')}</ButtonLink>
        {follow}
      </>}>
      {online ? t('catalog:peopleIndex.emptyOnlineHint', { label }) : t('catalog:peopleIndex.emptyLocalHint')}
    </EmptyState>
  );
}
