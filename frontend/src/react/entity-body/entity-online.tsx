/* 创作者资料页的在线视图（ADR-0096）：关注里绑在这位名下、还没入库的更新，卡片与照片墙就是关注页那一份。
 *
 * 取数与筛选（状态、来源、标签、排序、视频／图片）归资料页（`entity-page-view.tsx`），筛选浮层与这一格
 * 读的是同一份；这里只画当前媒体那一档的组。查询键同关注页一族：详情里换状态、检查更新跑完时按
 * `['follow-feed']` 前缀失效与改写缓存，这一屏跟着变。换筛选时保留宿主，内容与骨架原位交叉淡化。 */
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { requestErrorMessage } from '@peach/legacy/core';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { EmptyState } from '../components/empty-state';
import { spriteGlyph } from '../components/sprite-glyph';
import { FollowCheckButton } from '../follow-feed/follow-check-button';
import { entityCheckSources } from '../follow-feed/follow-check';

import { LoadMore } from '../catalog-grid/catalog-grid-page';
import { RetryNote } from '../components/grid-reveal';
import { SkeletonContent } from '../components/skeleton-content';
import { FollowCard } from '../follow-feed/follow-card';
import {
  itemForMedia, type FollowContext, type FollowFeedActions, type FollowFeedHelpers, type FollowGroup, type FollowMedia,
  type FollowPage, type FollowSource, type FollowView,
} from '../follow-feed/follow-feed';
import { useFollowWrite } from '../follow-feed/follow-feed-page';
import type { PhotoLayout, PhotoSize } from './entity-body';
import { t } from '../../i18n';

export interface EntityOnlineProps {
  view: FollowView;
  media: FollowMedia;
  result: UseInfiniteQueryResult<InfiniteData<FollowPage>>;
  /** 合并好的几页，与这一档媒体里可见的组。 */
  data: FollowPage | null;
  visible: readonly FollowGroup[];
  context: FollowContext;
  photoSize: PhotoSize;
  photoLayout: PhotoLayout;
  imagesOnly: boolean;
  helpers: FollowFeedHelpers;
  actions: FollowFeedActions;
  canLoadMore?: () => boolean;
  clearFilters(): void;
  /** 壳的多选：在线视图选的是关注条目（`followSelected`），和作品区的选择分开。 */
  selectMode?: boolean;
  selected?: ReadonlySet<number>;
}

export function EntityOnline(props: EntityOnlineProps) {
  const { result, data, media, helpers } = props;
  /* 换筛选时先借着上一份数据（`keepPreviousData`），那一份不能当这一份画出来。 */
  const pending = result.isPending || result.isPlaceholderData;
  if (!data && result.isError) {
    return <RetryNote message={requestErrorMessage(result.error)} onRetry={() => { void result.refetch() }} />;
  }
  return (
    <div data-follow-list-body="" data-entity-online="">
      <SkeletonContent pending={pending} skeletonHtml={() => helpers.listSkeletonHtml(media)}>
      {pending || !data ? null : <Cards {...props} data={data} />}
      {!pending && data?.has_more ? (
        <LoadMore key={result.data?.pages.length} entity enabled={() => props.canLoadMore?.() !== false}
          load={async () => { await result.fetchNextPage({ throwOnError: true }) }} />
      ) : null}
      </SkeletonContent>
    </div>
  );
}

function Cards({ view, media, data, visible, context, photoSize, photoLayout, imagesOnly, actions, clearFilters, selectMode = false, selected }:
  EntityOnlineProps & { data: FollowPage }) {
  const write = useFollowWrite({ view, revision: 0, actions });
  const sources = useMemo(() => {
    const byId = new Map((data.sources || []).map((source) => [source.id, source]));
    const byAuthor = new Map<string, FollowSource[]>();
    (data.sources || []).forEach((source) => {
      if (!source.author_key) return;
      if (!byAuthor.has(source.author_key)) byAuthor.set(source.author_key, []);
      byAuthor.get(source.author_key)!.push(source);
    });
    return { byId, byAuthor };
  }, [data.sources]);
  const images = media === 'images';
  const wall = images ? { 'data-size': photoSize, 'data-layout': photoLayout, 'data-images-only': String(imagesOnly) } : {};
  const body = visible.length ? visible.map((group) => {
    const id = itemForMedia(group, media).id;
    const authorKey = sources.byId.get(group.primary?.source_id as number)?.author_key;
    return (
      <FollowCard key={`${group.primary.id}:${media}`} group={group}
        authorSources={(authorKey && sources.byAuthor.get(authorKey)) || []} media={media} context={context}
        selected={Boolean(selected?.has(id))} selectMode={selectMode} busy={write.busy.get(id) || ''} failure={write.failures.get(id) || ''}
        actions={actions} onStatus={write.status} onSave={write.save} />
    );
  }) : <Empty searched={!!(data.groups || []).length || !!(view.status || view.provider || view.tags.length || view.durMin || view.durMax)}
    clear={clearFilters} actions={actions} sources={entityCheckSources(data.sources || [], view.author)} />;
  return <div data-follow-list="" data-follow-wall={images ? '' : undefined} {...wall}>{body}</div>;
}

function Empty({ searched, clear, actions, sources }: {
  searched: boolean; clear(): void; actions: FollowFeedActions; sources: number[];
}) {
  return <div data-follow-empty="" className="contents"><EmptyState
    icon={spriteGlyph(searched ? 'search-x' : 'rss')} title={searched ? t('catalog:entityOnlineEmpty.noMatches') : t('catalog:entityOnlineEmpty.noUpdates')}
    actions={searched ? <Button size="small" onClick={clear}>{t('catalog:shared.clearFilters')}</Button>
      : sources.length ? <FollowCheckButton sources={sources} report={actions.checkReport} />
      : <ButtonLink size="small" href="/subscriptions?tab=add">{t('catalog:entityOnlineEmpty.addFollow')}</ButtonLink>}>
    {searched ? t('catalog:entityOnlineEmpty.noMatchesHint') : t('catalog:entityOnlineEmpty.noUpdatesHint')}
  </EmptyState></div>;
}
