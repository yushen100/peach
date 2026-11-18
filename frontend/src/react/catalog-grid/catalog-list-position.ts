import { useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import type { PaginationState, SortingState } from '@tanstack/react-table';

export interface CatalogListPosition {
  sorting: SortingState;
  pagination: PaginationState;
  filters: Record<string, string>;
}

const defaultPosition: CatalogListPosition = { sorting: [], pagination: { pageIndex: 0, pageSize: 20 }, filters: {} };
const positions = new Map<string, CatalogListPosition>();
const listeners = new Set<() => void>();

export const getCatalogListPosition = (scope: string) => positions.get(scope) ?? defaultPosition;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener) };
}

export function useCatalogListPosition(scope: string) {
  const position = useSyncExternalStore(subscribe, () => getCatalogListPosition(scope), () => defaultPosition);
  const setPosition: Dispatch<SetStateAction<CatalogListPosition>> = update => {
    const next = typeof update === 'function' ? update(getCatalogListPosition(scope)) : update;
    positions.set(scope, next);
    listeners.forEach(listener => listener());
  };
  return [position, setPosition] as const;
}
