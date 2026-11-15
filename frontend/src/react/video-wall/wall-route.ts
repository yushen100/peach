import { peachHistory } from '@peach/history';
import { isCatalogPath, ROUTE_STATES } from '@peach/legacy/core';
import { entityLinkName } from '../../core/entity-links';
import { WALL_FILTER_KEYS } from './wall-layout';

const PAGE_KINDS: Readonly<Record<string, string>> = {
  performers: 'performer', creators: 'creator', studios: 'studio', series: 'series', agencies: 'agency', tags: 'tag',
};

/** 顶栏播放墙与沉浸「播什么」：有自己视频的页按这一页的范围，其余页按全部馆藏（只留媒体库与 JAV 开关）。
 *
 *  目录页（垃圾文件除外）带上地址里的筛选与状态，JAV 页带上 JAV 筛选，资料页换成同一实体的作品范围；
 *  回收站、关注、统计、设置等页不算有自己的视频，按全部馆藏，`/api/items` 默认不含回收站里的文件。
 *  `filters` 是壳给的当前筛选（`pagePlaybackFilters`），显式上下文优先于地址上的数字身份。 */
export function pagePlaybackParams(from = `${location.pathname}${location.search}`,
  filters: Readonly<Record<string, string>> = {}): URLSearchParams {
  const source = new URL(from, location.origin);
  const [section, ...parts] = source.pathname.split('/').filter(Boolean);
  const kind = PAGE_KINDS[section || ''];
  const scoped = (isCatalogPath(source.pathname) && source.pathname !== '/junk-files') || source.pathname === '/jav' || !!(kind && parts.length);
  const params = new URLSearchParams(scoped ? source.search : '');
  for (const [key, value] of Object.entries(filters)) if (value && (scoped || ['jav','loc'].includes(key))) params.set(key, value);
  if (scoped && ROUTE_STATES[source.pathname]) params.set('state', ROUTE_STATES[source.pathname]!);
  if (kind && parts.length) {
    const identity = decodeURIComponent(parts.join('/'));
    const name = /^[0-9]+$/.test(identity) ? entityLinkName(kind, Number(identity)) : identity;
    if (name && kind === 'tag') {
      params.set('tag', [...new Set([name, ...(params.get('tag') || '').split(',').filter(Boolean)])].join(','));
      params.set('tag_match', 'all');
    } else if (name && !params.has(kind)) params.set(kind, name);
  }
  return params;
}

export function wallAddress(from = `${location.pathname}${location.search}`, filters: Readonly<Record<string, string>> = {}): string {
  const source = new URL(from, location.origin);
  const params = pagePlaybackParams(from, filters);
  params.set('returnTo', `${source.pathname}${source.search}`);
  return `/wall?${params}`;
}

export function unfilteredWallAddress(from = `${location.pathname}${location.search}`): string {
  const params = new URL(from, location.origin).searchParams;
  for (const key of WALL_FILTER_KEYS) params.delete(key);
  params.delete('tag_match');
  return `/wall${params.size ? `?${params}` : ''}`;
}

export function exitWall(): void {
  const target = new URLSearchParams(peachHistory.navigation.location.search).get('returnTo') || '/';
  peachHistory.replace(target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/wall') ? target : '/');
}
