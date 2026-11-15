/* 「想要」清单的数据契约（ADR-0090）：`/api/wants` 在 `frontend/src` 里只在这里声明一次。
 *
 * 两个键：清单整页一把（关注管理的「想要」页签），关注详情问「这一条想要过没有」按条目各一把。
 * 写完把两族都作废：在详情里点了想要，回到页签时清单要已经有它；在页签里移除了，详情那颗键也要
 * 跟着弹起。 */
import { apiGet, apiSend } from '../../api';
import { withBackoff } from '../../polling';
import { queryClient } from '../query';
import { t } from '../../i18n';

export const WANTS_URL = '/api/wants';

export const WANTS_KEY = ['wants'] as const;
export const wantFollowKey = (itemId: number) => ['wants', 'follow', itemId] as const;

/** 清单上的四段，次序就是页签里排的次序。 */
export const PHASES = [
  ['searching', t('catalog:wants.phaseSearching')], ['unreleased', t('catalog:wants.phaseUnreleased')], ['given_up', t('catalog:wants.phaseOnHold')], ['acquired', t('catalog:javWant.imported')],
] as const;
export type Phase = (typeof PHASES)[number][0];

/** 一条想要。字段与 `src/peach/web_wants.py` 的 `_payload` 对齐。 */
export interface Want {
  id: number;
  code: string | null;
  has_magnets?: boolean | null;
  origin: 'code' | 'feed' | 'follow';
  title: string | null;
  link: string | null;
  release_date: string | null;
  studio: string | null;
  performers: string | null;
  phase: Phase;
  fresh: boolean;
  search_count: number;
  last_search_at: string | null;
  last_search_outcome: 'found' | 'none' | 'error' | null;
  given_up_at: string | null;
  acquired_asset_id: number | null;
  acquired_at: string | null;
  follow_item_id: number | null;
  follow_provider: string | null;
  cover: string | null;
  /** 封面还是来源给的远程地址：要带 `no-referrer` 去取。 */
  remote_cover: boolean;
  scraped: boolean;
  scrape_error: string | null;
  created_at: string;
}

export interface WantsData {
  items: Want[];
  counts: Record<Phase, number>;
  /** 取资料那一轮还在跑：刚登记的那几条资料还没回来。 */
  scraping: boolean;
  /** 定时查资源那一轮还在跑：卡片上的查找结果会陆续更新。 */
  searching: boolean;
}

export const fetchWants = (signal?: AbortSignal) => apiGet<WantsData>(WANTS_URL, signal);
/** 想要清单的 `refetchInterval`：刚登记的还在取资料就隔几秒再读，取完就停；定时查资源一部要十来秒，
 *  隔得松一些。读失败按连续失败次数退避。 */
export const wantsInterval = withBackoff<WantsData>((data) =>
  (data?.scraping ? 3000 : data?.searching ? 10_000 : false));

export function recordWantMagnets(id: number, available: boolean) {
  queryClient.setQueryData<WantsData>(WANTS_KEY, current => {
    if (!current?.items.some(want => want.id === id && want.has_magnets !== available)) return current;
    return { ...current, items: current.items.map(want => want.id === id ? { ...want, has_magnets: available } : want) };
  });
}

export const fetchFollowWant = (itemId: number, signal?: AbortSignal) =>
  apiGet<{ want: Want | null }>(`${WANTS_URL}?follow=${encodeURIComponent(itemId)}`, signal);

type AddTarget = { code: string } | { follow: number };

export const addWant = (target: AddTarget, signal?: AbortSignal) =>
  apiSend<{ created: boolean; want: Want }>(WANTS_URL, { action: 'add', ...target }, 'POST', signal);

/** 移除与重置的回执带上之前的整行（`previous`），撤销时交回 `restoreWants` 原样写回。 */
export const removeWants = (ids: number[], signal?: AbortSignal) =>
  apiSend<{ previous: object[] }>(WANTS_URL, { action: 'remove', ids }, 'POST', signal);

export const resetWants = (ids: number[], signal?: AbortSignal) =>
  apiSend<{ previous: object[] }>(WANTS_URL, { action: 'reset', ids }, 'POST', signal);

export const restoreWants = (rows: object[]) => apiSend(WANTS_URL, { action: 'restore', rows });

/** 写完之后：清单与各条关注详情的想要状态一起重取。 */
export const invalidateWants = () => queryClient.invalidateQueries({ queryKey: WANTS_KEY });

/** 一条想要叫什么：番号打头，没有番号的关注条目用标题。 */
export const wantName = (want: Want) => want.code || want.title || t('catalog:wants.followItemName', { id: want.follow_item_id ?? want.id });

/** 「待找」那一段的说明：新片查不到不计数，老片查满三次就暂时放弃。 */
export function searchNote(want: Want): string {
  if (want.phase === 'acquired') return want.acquired_at ? t('catalog:wants.importedOn', { date: want.acquired_at.slice(0, 10) }) : t('catalog:javWant.imported');
  if (want.phase === 'unreleased') return want.release_date ? t('catalog:wants.releaseDate', { date: want.release_date }) : t('catalog:wants.notReleased');
  if (want.phase === 'given_up') return t('catalog:wants.givenUpNote', { count: want.search_count });
  if (want.fresh) return t('catalog:wants.freshNote');
  return want.search_count ? t('catalog:wants.searchCount', { count: want.search_count }) : t('catalog:wants.notSearched');
}

/** 有番号、还在找的那一条上次定时查找没查到或失败时的日期；老片没查到时带上已查次数（满三次暂时放弃）。
 * 查到的不写：资源区已经列出了查到的链接。 */
export function lastSearchNote(want: Want): string {
  if (!want.last_search_at || !want.last_search_outcome || want.last_search_outcome === 'found') return '';
  const date = want.last_search_at.slice(0, 10);
  if (want.last_search_outcome === 'error') return t('catalog:wants.lastSearchError', { date });
  const text = t('catalog:wants.lastSearchNone', { date });
  return want.fresh || !want.search_count ? text
    : t('shell:format.withNote', { text, note: t('catalog:wants.searchCount', { count: want.search_count }) });
}
