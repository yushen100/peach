/* 索引页的数据契约：艺人、创作者、厂牌、事务所、系列名册与标签词表。
 *
 * 本地那一档读 `/api/index?kind=`（`src/peach/web_entity.py` 的 `q_index`），在线那一档读
 * 关注来源上的两份词表（`../follow/online-vocab.ts`）。四种形状一样：`items` 加 `has_more`，
 * `limit`／`offset` 翻页；标签按页替换，人物名册按「载入更多」追加。
 *
 * 索引页自己不调 `/api/items`：点一个标签或按所选标签显示结果，是回目录按它筛选，那一次
 * 取数归遗留壳的目录网格。 */
import type { InfiniteData, QueryKey } from '@tanstack/react-query';

import { firstGrapheme } from '@peach/legacy/core';

import { apiGet } from '../../api';
import { TAG_PAGE_SIZE } from '../../tag-skeleton';
import { IDENTITY_CATEGORIES } from '../../identity-filter';
import {
  fetchOnlineAuthors, fetchOnlineTags, onlineAuthorsKey, onlineTagsKey,
  type OnlineAuthor, type OnlineTag,
} from '../follow/online-vocab';
import { queryClient } from '../query';
import { t } from '../../i18n';

export type IndexKind = 'performers' | 'creators' | 'studios' | 'agencies' | 'series' | 'tags';
export type IndexScope = 'local' | 'online';
export type TagView = 'alphabet' | 'cloud';
export type PeopleLayout = 'big' | 'compact';

export const INDEX_URL = '/api/index';

/** 页头标题与名册口径。 */
export const INDEX_TITLES: Record<IndexKind, string> = {
  performers: t('catalog:shared.performers'), creators: t('catalog:shared.sellers'), studios: t('catalog:shared.studios'), agencies: t('catalog:shared.agencies'), series: t('catalog:shared.series'), tags: t('catalog:shared.tags'),
};

/** 索引格对应的实体类型，资料页与取图链都按它分。 */
export const ENTITY_KINDS: Record<Exclude<IndexKind, 'tags'>, string> = {
  performers: 'performer', creators: 'creator', studios: 'studio', agencies: 'agency', series: 'series',
};

/** 本地标签的九类。次序就是浮层上排药丸的次序。 */
export const TAG_CATEGORIES: readonly (readonly [string, string])[] = [
  ['all', t('catalog:shared.all')], ['meta', t('catalog:tagCategories.videoProperties')], ['relationship', t('catalog:tagCategories.relationships')], ['role', t('catalog:tagCategories.roles')],
  ['appearance', t('catalog:tagCategories.appearance')], ['scene', t('catalog:tagCategories.locations')], ['story', t('catalog:tagCategories.story')], ['position', t('catalog:tagCategories.sexPositions')],
  ['general', t('catalog:tagCategories.other')],
];

/** 在线标签的分类来自上游 booru 的 tag_type。 */
export const ONLINE_TAG_CATEGORIES: readonly (readonly [string, string])[] = [
  ['all', t('catalog:shared.all')], ['general', t('catalog:tagCategories.onlineGeneral')], ['artist', t('catalog:tagCategories.onlineCreators')], ['character', t('catalog:tagCategories.onlineCharacters')],
  ['copyright', t('catalog:shared.video')], ['metadata', t('catalog:tagCategories.onlineMeta')],
];
/** 本地艺人名册的身份分类；卖家名册不分类。词表与壳的骨架共用一份。 */
export { IDENTITY_CATEGORIES };

/** 名册批次与标签默认页大小。 */
export const PAGE_SIZE = { people: 120, tags: TAG_PAGE_SIZE } as const;

export const isPeople = (kind: IndexKind): kind is Exclude<IndexKind, 'tags'> => kind !== 'tags';
export const isCompany = (kind: IndexKind) => kind === 'studios' || kind === 'agencies';

/** 本地名册的一格。字段以 `q_index` 为准；公司另有标识，事务所另有成员数。 */
export interface IndexPerson {
  entity_kind?: string;
  identity_labels?: string[];
  /** 与 `identity_labels` 一一对应的分类 id，按它取译文。 */
  identity_categories?: string[];
  following?: boolean;
  entity_id?: number;
  id?: number;
  k: string;
  n: number;
  rep?: number | null;
  has_image?: boolean;
  image_version?: string;
  has_avatar?: boolean;
  avatar_stand_in?: boolean;
  avatar_focus?: unknown;
  has_logo?: boolean;
  members?: number;
  mark?: number | null;
  /** 编辑资料里新建的档案（ADR-0165）。 */
  user_created?: boolean | number;
}

export interface IndexTag {
  id?: string;
  aliases?: string[];
  hidden?: boolean;
  entity_id?: number;
  favorite?: boolean;
  k: string;
  n: number;
  cat?: string;
}

export interface IndexPage<T> {
  items: T[];
  has_more: boolean;
  total?: number;
  /** 分类的命中数量；筛选条只显示有内容的分类。 */
  categories?: Record<string, number>;
  /** 本地名册里从名册隐藏的有几项，「已隐藏」那颗键按它出现。 */
  hidden?: number;
}

/** 地址栏上的那几项。页面改它们只经 `IndexProps.route`，壳按这份拼地址。 */
export interface IndexRoute {
  kind: IndexKind;
  q: string;
  scope: IndexScope;
  view: TagView;
  category: string;
}

/** 一格头像：圆框里那段 HTML 和人脸取景的 `object-position`。 */
export interface PersonAvatar {
  html: string;
  /** `faceOrigin()` 的结果；没检出人脸时是空串，维持几何居中。 */
  face: string;
}

/** 索引页。地址栏是唯一真相：`kind`、`q`、`scope`、`view`、`category` 由壳从地址读出，
 *  `layout` 从这台浏览器的偏好读出，都只作初值；页面换档时经 `route` 与 `savePreference`
 *  写回去。取图、回落链与去处仍是遗留层唯一那一份，经 props 递进来。 */
export interface IndexProps extends IndexRoute {
  layout: PeopleLayout;
  /** 写回地址栏。`replace` 用在打字过滤那种一路改写的场合，不往历史里塞一串。 */
  route(params: IndexRoute, options?: { replace?: boolean }): void;
  /** 版式偏好改了：存储归壳（`appSettings.peopleLayout`），资料页的名册读的也是它。 */
  savePreference(patch: { layout: PeopleLayout }): void;
  /** 顶栏那枚选择键的状态：本地标签拼目录筛选，在线标签与本地名册做批量动作。键归壳，关掉时
   *  壳经 `updateManagedRoute` 把 `false` 推进来，页面随之清空所选。 */
  selectMode: boolean;
  /** 页面自己要退出选择模式的两处：按所选标签显示结果，和艺人页切到在线名册。 */
  exitSelectMode(): void;
  /** 本地名册一格的头像（`card-art` 的 `avatarInner` 那条回落链）。 */
  personAvatar(item: IndexPerson, entityKind: string, big: boolean): PersonAvatar;
  /** 在线创作者一格的头像：主页头像优先、归档兜底，都取不到落回首字母。 */
  authorAvatar(author: OnlineAuthor): string;
  tagLabel(tag: string): string;
  /** 打开资料页。 */
  openEntity(entityKind: string, name: string): void;
  /** 回目录，按这一枚或这几枚本地标签筛选。 */
  showTags(tags: string[], match: 'any' | 'all'): void;
  /** 去关注页，只看这一位创作者或这一枚在线标签的更新。 */
  openFollowAuthor(key: string): void;
  openFollowTag(tag: string): void;
  /** 本机能改配置：空态里给「添加内容」。 */
  configurable: boolean;
}

/** 地址栏上的类型可能是手敲或拼错的：认不出的回到「全部」，不拿它去问后端。
 *  只有艺人和标签两页分本地与在线。动画作者归艺人名册的一个分类，
 *  卖家名册上的 `category=animation` 链接转到那里。 */
export function indexRoute(route: IndexRoute): IndexRoute {
  if (route.kind === 'creators' && route.category === 'animation') {
    return indexRoute({ ...route, kind: 'performers', scope: 'local' });
  }
  const scope = route.kind === 'tags' || route.kind === 'performers' ? route.scope : 'local';
  const categories = route.kind === 'tags' ? (scope === 'online' ? ONLINE_TAG_CATEGORIES : TAG_CATEGORIES)
    : route.kind === 'performers' && scope === 'local' ? IDENTITY_CATEGORIES : [];
  // 「已隐藏」是本地名册共有的一档，不在各自的分类表里。
  const known = categories.some(([key]) => key === route.category)
    || (route.kind !== 'tags' && scope === 'local' && route.category === 'hidden');
  return { ...route, scope, category: known ? route.category : 'all' };
}

/** 一种状态下该读哪一份：本地名册、本地词表、在线创作者或在线标签。 */
export type IndexSource =
  | { what: 'people'; kind: Exclude<IndexKind, 'tags'>; q: string; category?: string }
  | { what: 'tags'; q: string; category: string }
  | { what: 'online-authors'; q: string }
  | { what: 'online-tags'; q: string; category: string };

export function indexSource(route: Pick<IndexRoute, 'kind' | 'q' | 'scope' | 'category'>): IndexSource {
  const { kind, q, scope, category } = route;
  if (kind === 'tags') return scope === 'online' ? { what: 'online-tags', q, category } : { what: 'tags', q, category };
  if (kind === 'performers' && scope === 'online') return { what: 'online-authors', q };
  return { what: 'people', kind, q, ...(category && category !== 'all' ? { category } : {}) };
}

export const indexKey = (kind: IndexKind, q: string, category = 'all') =>
  ['index', kind, q, ...(kind === 'tags' || category !== 'all' ? [category] : [])] as const;

export function indexUrl(kind: IndexKind, q: string, category: string, limit: number, offset: number): string {
  const params = new URLSearchParams({ kind, limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  if (category !== 'all') params.set('category', category);
  return `${INDEX_URL}?${params}`;
}

type AnyItem = IndexPerson | IndexTag | OnlineAuthor | OnlineTag;

export interface IndexQuery {
  queryKey: QueryKey;
  queryFn(context: { pageParam: number; signal?: AbortSignal }): Promise<IndexPage<AnyItem>>;
  initialPageParam: number;
  getNextPageParam(last: IndexPage<AnyItem>, pages: IndexPage<AnyItem>[]): number | undefined;
}

/** 四份数据共用一副分页：下一页的 offset 就是已经取到的条数。 */
export function indexQuery(source: IndexSource, pageSize: number = PAGE_SIZE.tags): IndexQuery {
  const limit = source.what === 'people' || source.what === 'online-authors' ? PAGE_SIZE.people : pageSize;
  const next = (last: IndexPage<AnyItem>, pages: IndexPage<AnyItem>[]) =>
    last.has_more ? pages.reduce((sum, page) => sum + page.items.length, 0) : undefined;
  const base = { initialPageParam: 0, getNextPageParam: next };
  switch (source.what) {
    case 'people':
      return { ...base, queryKey: indexKey(source.kind, source.q, source.category || 'all'),
        queryFn: ({ pageParam, signal }) => apiGet(indexUrl(source.kind, source.q, source.category || 'all', limit, pageParam), signal) };
    case 'tags':
      return { ...base, queryKey: indexKey('tags', source.q, source.category),
        queryFn: ({ pageParam, signal }) => apiGet(indexUrl('tags', source.q, source.category, limit, pageParam), signal) };
    case 'online-authors':
      return { ...base, queryKey: onlineAuthorsKey(source.q),
        queryFn: ({ pageParam, signal }) => fetchOnlineAuthors(source.q, limit, pageParam, signal) };
    case 'online-tags':
      return { ...base, queryKey: onlineTagsKey(source.q, source.category),
        queryFn: ({ pageParam, signal }) => fetchOnlineTags(source.q, source.category, limit, pageParam, signal) };
  }
}

/** 首屏在页面提交前预取，已访问的集合沿用同一标签页里的分页。 */
export async function prefetchIndex(props: IndexRoute, signal: AbortSignal) {
  const query = indexQuery(indexSource(indexRoute(props)));
  await queryClient.fetchInfiniteQuery({
    queryKey: query.queryKey,
    queryFn: ({ pageParam }) => query.queryFn({ pageParam: pageParam as number, signal }),
    initialPageParam: 0,
    getNextPageParam: query.getNextPageParam,
    staleTime: Infinity,
  });
}

export const flatItems = <T>(data: InfiniteData<IndexPage<T>> | undefined): T[] =>
  data ? data.pages.flatMap((page) => page.items) : [];

/** 读数：取到几条，后面还有就带一个加号。 */
export const countText = (count: number, more: boolean) => more ? t('catalog:peopleIndex.loadedCountMore', { count }) : t('catalog:peopleIndex.loadedCount', { count });

/** 一枚标签的类型色键（`../styles.css` 的 `[data-tag-cat]`）。在线那一套取上游 tag_type，
 *  加 `r34-` 前缀与本地同名的类分开：本地的 `artist` 是橙色，在线的是红色。 */
export const tagColorKey = (online: boolean, cat: string | undefined) =>
  online ? `r34-${cat || 'unknown'}` : cat || 'general';

/** 格子底下那个读数。事务所数的是人：它名下的视频是成员拍的，只报视频数会让它唯一独有的
 *  读数消失。数字一律带单位，同一排格子才读得出数的是人还是片，单独一个「0」也不像漏了字。 */
export const personReadout = (kind: IndexKind, item: IndexPerson) =>
  kind === 'agencies' ? t('catalog:peopleIndex.memberCount', { count: item.members || 0 }) : t('catalog:peopleIndex.videoCount', { count: item.n || 0 });

const COLLATOR = { numeric: true, sensitivity: 'base' } as const;

/** 字母表的分组：按显示名的首字归到 A–Z、`#`（数字）、`中文` 或 `其他`，组内按名字排。 */
export function tagGroups<T extends { k: string }>(items: T[], label: (tag: string) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => a.k.localeCompare(b.k, 'zh-CN', COLLATOR))) {
    const first = firstGrapheme(label(item.k).normalize('NFKC'), '').toUpperCase();
    const key = /[A-Z]/.test(first) ? first : /[0-9]/.test(first) ? '#' : /[㐀-鿿]/.test(first) ? t('catalog:peopleIndex.groupCjk') : t('catalog:peopleIndex.groupOther');
    const group = groups.get(key);
    if (group) group.push(item); else groups.set(key, [item]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'));
}
