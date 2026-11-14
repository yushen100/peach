/* 处理队列页的多选模式：勾选框与「全选」直接画在页上，右上角的多选开关同样能用，两者是同一套状态。
 *
 * 选择集归各页自己（重复文件按组、复核按条目、数据表按行），这里只管「此刻是不是多选模式」：
 * 点右上角进入或退出；直接勾某一项等于进入；退出时调各页登记的清空，所选一并清掉。右上角键的
 * `aria-pressed` 跟着这份状态写。离开这一页（最后一个登记者卸载）时退出。
 *
 * 右上角开关交给本模块的两种情形：地址在下表里（整页都是页面自己的选择集），或者页上有登记了
 * `topbar` 的组件（标签页的管理模式：同一个地址，平时的标签勾选归壳，进管理模式后归标签管理）。 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { CLEANUP_TOOL_PATHS } from '../../cleanup-routes';

/** 哪些页是处理队列、选择集归页面自己。垃圾文件的选择集在壳里，不在这张表上。 */
const PAGE_SELECT_PATHS: ReadonlySet<string> = new Set([
  '/duplicates', '/quality-goals', '/review', '/subscriptions',
  CLEANUP_TOOL_PATHS.links, CLEANUP_TOOL_PATHS['orphan-records'], CLEANUP_TOOL_PATHS['batch-delete'],
]);

export const pageSelectPath = (path: string) => PAGE_SELECT_PATHS.has(path);

interface Entry { current: () => void; topbar: boolean }

let on = false;
const entries = new Set<Entry>();
const listeners = new Set<() => void>();

/** 页上有组件登记了接管右上角开关（标签管理模式）。 */
export const pageSelectionOwned = () => [...entries].some((entry) => entry.topbar);

/** 右上角开关此刻归本模块：处理队列页，或页上有接管开关的组件。 */
export const pageSelectionActive = (path: string) => pageSelectPath(path) || pageSelectionOwned();

function publish() {
  document.getElementById('selectMode')?.setAttribute('aria-pressed', String(on));
  for (const listener of [...listeners]) listener();
}

/** 进入多选：勾了某一项时调用。只在开关归本模块时生效，别处的数据表勾选不碰右上角开关。 */
export function enterPageSelection() {
  if (on || !pageSelectionActive(location.pathname)) return;
  on = true;
  publish();
}

/** 退出多选并清空各页的所选。 */
export function exitPageSelection() {
  on = false;
  for (const entry of [...entries]) entry.current();
  publish();
}

/** 右上角开关点下去。 */
export function togglePageSelection() {
  if (on) exitPageSelection();
  else enterPageSelection();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener) };
};

/** 登记这一页的清空办法，读多选模式。返回 `true` 时页上处于多选模式。`topbar` 让本组件在
 *  不在处理队列表上的地址也接管右上角开关（挂载期间）。 */
export function usePageSelection(clear: () => void, { topbar = false }: { topbar?: boolean } = {}): boolean {
  const latest = useRef(clear);
  latest.current = clear;
  useEffect(() => {
    const entry: Entry = { current: () => latest.current(), topbar };
    entries.add(entry);
    return () => {
      entries.delete(entry);
      if ((!entries.size || topbar) && on) { on = false; publish() }
    };
  }, [topbar]);
  return useSyncExternalStore(subscribe, () => on, () => false);
}
