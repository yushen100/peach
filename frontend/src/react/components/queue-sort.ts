/* 处理队列页（垃圾文件、高清版、重复文件）浮层上的排序键：队列一次取齐，在本页排，不发请求。
 *
 * 键的样子与切法同首页（`../entity-filter/entity-filter-page.tsx` 的 `SortKeys`、`../../sort-preferences.ts`）：
 * 点未选中的键换到那一列、取那一列的默认方向，点选中的键翻方向。有哪几列、本机记住哪一列在
 * `../../queue-sort-choice.ts`，壳铺的骨架读同一份。没选过时照服务端给的顺序。 */
import { useState } from 'react';
import type { SortingState } from '@tanstack/react-table';

import { defaultSortDir, nextSortState } from '../../sort-preferences';
import {
  forgetQueueSort, queueSortKeys, rememberedQueueSort, rememberQueueSort, type QueuePage, type QueueSortChoice, type QueueSortKey,
} from '../../queue-sort-choice';

export function useQueueSort<T>(page: QueuePage, values: Partial<Record<QueueSortKey, (item: T) => number>>) {
  const [chosen, setChosen] = useState<QueueSortChoice | null>(() => rememberedQueueSort(page));
  const onSort = (key: string) => setChosen((now) => {
    const next = nextSortState(key, now?.sort || '', now?.dir || defaultSortDir(key)) ?? now;
    if (next) rememberQueueSort(page, next);
    return next;
  });
  const value = chosen ? values[chosen.sort as QueueSortKey] : undefined;
  const sort = (items: readonly T[]): readonly T[] => value
    ? [...items].sort((a, b) => (value(a) - value(b)) * (chosen!.dir === 'asc' ? 1 : -1))
    : items;
  /* 表格上方的排序下拉与列头（`./queue-table.tsx`）写的是同一份：空数组回到服务端给的顺序。 */
  const sorting: SortingState = chosen ? [{ id: chosen.sort, desc: chosen.dir !== 'asc' }] : [];
  const setSorting = (next: SortingState) => {
    const first = next[0];
    const choice = first && values[first.id as QueueSortKey] ? { sort: first.id, dir: first.desc ? 'desc' : 'asc' } : null;
    if (choice) rememberQueueSort(page, choice); else forgetQueueSort(page);
    setChosen(choice);
  };
  return { sorts: queueSortKeys(page, chosen), onSort, sort, sorting, setSorting };
}
