/* 垃圾文件队列（`/junk-files`）的路由与计数行骨架。
 *
 * 看哪一类、看待判断还是已排除，全由地址决定：分类链接是可深链的 `<a href>`，刷新后原样恢复。
 * 壳（`Application`）与垃圾队列那一页读的是同一组函数，所以放在 island 层这边，不依赖 React。
 *
 * 计数行骨架是壳在 React 包加载之前铺的那一版，画在 `.peach-react` 里，结构、`data-*` 钩子与
 * 类名和页面等数据时画出来的那一版逐项相同（`junk-queue/junk-count.tsx`，用例对照两者），
 * 所以接管那一拍这一行不跳。分类与视图此刻就有答案，只有读数和各类的计数徽标要等数据。 */
import { esc } from '@peach/legacy/core';

import { islandGlassRows } from './island-skeleton';
import { queueControlsSkeletonHtml } from './queue-skeleton';
import { t } from './i18n';

export type JunkView = 'pending' | 'dismissed';
export type JunkKind = '' | 'video' | 'image' | 'archive' | 'audio' | 'url' | 'other';

export interface JunkRoute { kind: JunkKind; view: JunkView }

/** 分类条上的几项：键、标签、雪碧图字形。键与 `/api/ads?kind=` 的取值一一对应。 */
export const JUNK_KIND_OPTIONS: readonly (readonly [JunkKind, string, string])[] = [
  ['', t('cleanup:shared.all'), 'layout-grid'], ['video', t('cleanup:junk.kindVideos'), 'play'], ['image', t('cleanup:junk.kindImages'), 'pics'],
  ['archive', t('cleanup:junk.kindArchives'), 'file-archive'], ['audio', t('cleanup:junk.kindAudio'), 'file-audio'], ['url', t('cleanup:junk.kindUrls'), 'globe'],
  ['other', t('cleanup:junk.kindOther'), 'hard-drive'],
];

/** 认不出的分类一律落回「全部」。 */
export const cleanJunkKind = (value: string | null | undefined): JunkKind =>
  JUNK_KIND_OPTIONS.find(([key]) => key === value)?.[0] ?? '';

/** 地址查询串里的分类与视图。 */
export function junkRoute(search: string): JunkRoute {
  const params = new URLSearchParams(search);
  return { kind: cleanJunkKind(params.get('type')), view: params.get('view') === 'dismissed' ? 'dismissed' : 'pending' };
}

/** 某一类、某一视图的地址。默认那一档（全部、待判断）不写进查询串。 */
export function junkPath(kind: JunkKind = '', view: JunkView = 'pending'): string {
  const params = new URLSearchParams();
  if (kind) params.set('type', kind);
  if (view === 'dismissed') params.set('view', 'dismissed');
  const query = params.toString();
  return `/junk-files${query ? `?${query}` : ''}`;
}

/** 分类条末尾那一项：待判断时去「已排除」，已排除时回「待判断」。 */
export function junkViewLink(view: JunkView): { view: JunkView; label: string; glyph: string; href: string } {
  return view === 'dismissed'
    ? { view: 'pending', label: t('cleanup:junk.backToUndecided'), glyph: 'rotate-ccw', href: junkPath('', 'pending') }
    : { view: 'dismissed', label: t('cleanup:junk.excluded'), glyph: 'eye-off', href: junkPath('', 'dismissed') };
}

export const junkSummaryLabel = (view: JunkView) => (view === 'dismissed' ? t('cleanup:junk.excluded') : t('cleanup:junk.undecided'));

const glyph = (name: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

/** 壳在 React 包加载之前铺的筛选浮层：上排分类条，下排读数留空，计数徽标不画。滑动玻璃由 island
 *  量着放，这一版里没有它，当前那一类自己垫一块同料的玻璃（`junk-queue.css`）。 */
export function junkCountSkeletonHtml({ kind, view }: JunkRoute): string {
  const links = JUNK_KIND_OPTIONS.map(([key, label, icon]) =>
    `<a href="${junkPath(key, view)}" data-junk-kind-link="${key}"${key === kind ? ' aria-current="page"' : ''}>${glyph(icon)}${esc(label)}</a>`).join('');
  const other = junkViewLink(view);
  const nav = `<nav data-junk-filters="" aria-label="${esc(t('cleanup:junk.categories'))}">${links}<i data-junk-divider="" aria-hidden="true"></i>`
    + `<a href="${other.href}" data-junk-view-link="${other.view}"${view === 'dismissed' ? ' aria-current="page"' : ''}>${glyph(other.glyph)}${other.label}</a></nav>`;
  return `<div class="peach-react" data-junk-count-skeleton="">`
    + islandGlassRows({ label: junkSummaryLabel(view), top: nav, attrs: ' data-filter-frame="" data-junk-filters-frame=""',
      controls: queueControlsSkeletonHtml('junk-files'), className: 'mx-auto w-full max-w-board' }) + `</div>`;
}
