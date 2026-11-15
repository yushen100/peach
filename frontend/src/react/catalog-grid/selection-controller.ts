import { junkRoute } from '../../junk-queue';
import { selectRange } from '../../selection';

export type SelectionSurface = 'catalog' | 'follow' | 'junk';
export interface SelectionSets { selected: Set<number>; followSelected: Set<number> }
export interface SelectionState {
  selectMode: boolean;
  selectSurface: string;
  lastSelectedId: number | null;
  followLastSelectedId: number | null;
}

export interface SelectionDock {
  count: number;
  context: SelectionSurface | 'trash';
  junkDismissed: boolean;
}

/** 资料页与回收站共享目录选择集；垃圾文件拥有独立的选择模式范围。资料页的在线视图（`media=online`）
 *  选的是关注条目，和关注页同一份选择集与批量键，和作品区的选择分开。 */
export function selectionSurface(pathname: string, search = ''): SelectionSurface {
  if (pathname === '/follow' || new URLSearchParams(search).get('media') === 'online') return 'follow';
  return pathname === '/junk-files' ? 'junk' : 'catalog';
}

/** 两份 Set 保持常驻，返回值供唯一壳状态写入。 */
export function setSelectionMode(sets: SelectionSets, state: Readonly<SelectionState>,
  surface: SelectionSurface, on: boolean, clear = false): SelectionState {
  if (clear) { sets.selected.clear(); sets.followSelected.clear(); }
  return {
    selectMode: on,
    selectSurface: on ? (state.selectMode ? state.selectSurface : surface) : '',
    lastSelectedId: clear ? null : state.lastSelectedId,
    followLastSelectedId: clear ? null : state.followLastSelectedId,
  };
}

/** 跨业务范围或进入不可选择页面时清空；目录内部导航沿用选择。 */
export function syncSelectionSurface(sets: SelectionSets, state: Readonly<SelectionState>,
  pathname: string, canSelect: boolean, search = ''): SelectionState {
  const surface = selectionSurface(pathname, search);
  return state.selectMode && (!canSelect || state.selectSurface !== surface)
    ? setSelectionMode(sets, state, surface, false, true) : { ...state };
}

/** 展示顺序由页面提供，不能把混合流里的短视频带入目录 Shift 范围。 */
export function toggleSelection(sets: SelectionSets, state: Readonly<SelectionState>,
  surface: SelectionSurface, visible: number[], id: number, range = false): SelectionState {
  const follow = surface === 'follow';
  const anchor = selectRange(follow ? sets.followSelected : sets.selected, visible,
    follow ? state.followLastSelectedId : state.lastSelectedId, id, range);
  return {
    ...setSelectionMode(sets, state, surface, true),
    ...(follow ? { followLastSelectedId: anchor } : { lastSelectedId: anchor }),
  };
}

/** 批量操作覆盖整份选择集，计数包含未在当前屏幕上的已选作品。 */
export function selectionDock(sets: SelectionSets, pathname: string, search: string,
  catalogState: string): SelectionDock {
  const surface = selectionSurface(pathname, search);
  return {
    count: (surface === 'follow' ? sets.followSelected : sets.selected).size,
    context: surface === 'catalog' && catalogState === 'trash' ? 'trash' : surface,
    junkDismissed: junkRoute(search).view === 'dismissed',
  };
}
