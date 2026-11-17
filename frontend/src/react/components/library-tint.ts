/* 媒体库来源色：颜色绑定 `library_id`，存在配置的 `media.library_catalog`（ADR-0116），默认不上色。
 * 卡片和列表行只挂 `data-library`，颜色由这里注入的一张样式表给 `--library-color`，
 * 每张卡不用各自重渲染。
 *
 * 媒体库列表来自 `library-catalog`：壳每次加载取一次，这里不另发请求；只有壳不在的地方（测试、
 * 单独挂的岛）要显示媒体库名时才自己取。首屏先按本机缓存的上一次颜色铺色。
 * 色值不另写：每一档取 `[data-accent-ball=…]` 那组 `--color-accent-500`，与设置面板的取色球同源。 */
import { useSyncExternalStore } from 'react';
import { MEDIA_SOURCE_ICONS } from '@peach/legacy/ui';
import { apiGet } from '../../api';
import { cachedLibraryColors, onLibraries, publishLibraries, publishedLibraries, type LibraryRow } from '../../library-catalog';

export interface LibraryTint { id: string; name: string; icon: string; location: string; color: string; roots?: LibraryRow['roots'] }

let tints: ReadonlyMap<string, LibraryTint> = new Map();
let requested = false;
const listeners = new Set<() => void>();

function accentValue(key: string): string {
  const probe = document.createElement('span');
  probe.setAttribute('data-accent-ball', key);
  probe.hidden = true;
  document.body.append(probe);
  const value = getComputedStyle(probe).getPropertyValue('--color-accent-500').trim();
  probe.remove();
  return value;
}

function paint(next: ReadonlyMap<string, LibraryTint>) {
  tints = next;
  let sheet = document.getElementById('peach-library-tints');
  if (!sheet) {
    sheet = document.createElement('style');
    sheet.id = 'peach-library-tints';
    document.head.append(sheet);
  }
  sheet.textContent = [...tints.values()].filter(tint => tint.color)
    .map(tint => `[data-library="${CSS.escape(tint.id)}"]{--library-color:${accentValue(tint.color)}}`).join('\n');
}

function publish(next: ReadonlyMap<string, LibraryTint>) {
  paint(next);
  listeners.forEach(listener => listener());
}

// 图标名换成图形与侧栏媒体库切换器同一张表：来源名取来源标志，其余是雪碧图字形。
const fromRows = (rows: readonly LibraryRow[]) => new Map(rows.map(row => [row.id, {
  id: row.id, name: row.name, icon: MEDIA_SOURCE_ICONS[row.icon || ''] || row.icon || 'database',
  location: row.roots?.[0]?.location || '', color: row.color || '', roots: row.roots,
}]));

let seeded = false;
function seed() {
  if (seeded) return;
  seeded = true;
  onLibraries(rows => publish(fromRows(rows)));
  const known = publishedLibraries();
  if (known) { paint(fromRows(known)); return }
  const colors = Object.entries(cachedLibraryColors()).filter(([, color]) => color);
  if (colors.length) paint(new Map(colors.map(([id, color]) => [id, { id, name: '', icon: 'database', location: '', color }])));
}

function load() {
  if (requested || publishedLibraries()) return;
  requested = true;
  void apiGet<{ libraries?: LibraryRow[] }>('/api/libraries')
    .then(body => publishLibraries(body.libraries || []))
    .catch(() => { requested = false });
}

/** 设置页改色时先在本页试色；保存后服务端给的颜色接替。 */
export function previewLibraryColor(id: string, color: string) {
  const current = tints.get(id) ?? { id, name: '', icon: 'database', location: '', color: '' };
  publish(new Map([...tints, [id, { ...current, color }]]));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener) };
}

/** 按 `library_id` 读来源色。要显示媒体库名与站标的地方传 `names`，壳没给列表时才向 `/api/libraries` 取一次。 */
export function useLibraryTints({ names = false }: { names?: boolean } = {}): ReadonlyMap<string, LibraryTint> {
  seed();
  if (names) load();
  return useSyncExternalStore(subscribe, () => tints, () => tints);
}
