/* 处理队列页（垃圾文件、高清版、重复文件）浮层上的排序键：有哪几列、本机记住选了哪一列。页面
 * （`react/components/queue-sort.ts`）与壳铺的骨架（`queue-skeleton.ts`）读同一份，骨架里按下的就是页面
 * 接管后按下的那一枚。不依赖 React。 */
import type { EntitySortKey } from './react/entity-filter/entity-filter';
import { nextSortState, sortDirWord } from './sort-preferences';
import { t } from './i18n';

export type QueuePage = 'junk-files' | 'quality-goals' | 'duplicates';
export type QueueSortKey = 'size' | 'dur' | 'new';
export interface QueueSortChoice { sort: string; dir: string }

/** 各页浮层上的排序键，方向的说法用首页那张词表，所以只放那张表里有的列。 */
export const QUEUE_SORTS: Readonly<Record<QueuePage, readonly (readonly [QueueSortKey, string])[]>> = {
  'junk-files': [['size', t('settings:shared.fileSize')], ['new', t('settings:shared.dateAdded')]],
  'quality-goals': [['size', t('settings:shared.fileSize')], ['dur', t('settings:shared.duration')], ['new', t('settings:shared.dateAdded')]],
  duplicates: [['size', t('settings:shared.fileSize')]],
};

const KEY = 'peach.queue-sort.v1';

function stored(): Record<string, QueueSortChoice> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, QueueSortChoice> } catch { return {} }
}

/** 本机记住的那一列；没选过或记的列这一页没有时是 null，照服务端的顺序。 */
export function rememberedQueueSort(page: QueuePage): QueueSortChoice | null {
  const value = stored()[page];
  return value && QUEUE_SORTS[page].some(([key]) => key === value.sort) ? value : null;
}

export function rememberQueueSort(page: QueuePage, choice: QueueSortChoice): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...stored(), [page]: choice })) } catch { /* 本页照样按所选排，只是不记。 */ }
}

/** 回到服务端给的顺序（表格排序下拉里的「默认顺序」）。 */
export function forgetQueueSort(page: QueuePage): void {
  const { [page]: _dropped, ...rest } = stored();
  try { localStorage.setItem(KEY, JSON.stringify(rest)) } catch { /* 本页照样回到默认顺序，只是不记。 */ }
}

/** 浮层上那几枚键的样子：按下哪一枚、朝哪个方向，读屏名说「点了会怎样」。 */
export function queueSortKeys(page: QueuePage, chosen: QueueSortChoice | null): EntitySortKey[] {
  return QUEUE_SORTS[page].map(([key, label]) => {
    const pressed = chosen?.sort === key;
    const next = nextSortState(key, chosen?.sort || '', chosen?.dir || '');
    return { key, label, pressed, dir: pressed ? (chosen!.dir === 'asc' ? 'asc' : 'desc') : '',
      ariaLabel: next ? t('shell:entitySort.ariaLabel', { label, direction: sortDirWord(next.sort, next.dir) }) : '' };
  });
}
