import { useMemo, useState } from 'react';
import { columnValueSelected, type ColumnSelection } from '../../column-filters';
import { TableColumnFilter, type ColumnFilterOption } from './table-column-filter';
import { t } from '../../i18n';

export interface TableFilter<T> {
  values(item: T): string | readonly string[];
  option?(value: string, representative?: T): Partial<ColumnFilterOption>;
}

export type TableFilters = Record<string, ColumnSelection | undefined>;
export type TableFacets = Record<string, { id: string; count: number }[]>;
export interface RemoteTableFilters {
  values: TableFilters;
  facets: TableFacets;
  onChange(values: TableFilters): void;
}

function rowValues<T>(filter: TableFilter<T>, item: T): readonly string[] {
  const values = filter.values(item);
  return typeof values === 'string' ? [values] : values.length ? values : [''];
}

/** 每列内部取并集，列之间取交集。选项计数保留其他列的筛选条件。 */
export function useTableFilters<T>(items: readonly T[], columns: Record<string, TableFilter<T>>,
  onChange: () => void, remote?: RemoteTableFilters) {
  const [local, setLocal] = useState<TableFilters>({});
  const values = remote?.values ?? local;
  const active = Object.entries(columns).filter(([id]) => values[id] !== undefined);
  const matches = (item: T, except?: string) => active.every(([id, filter]) => {
    if (id === except) return true;
    const candidates = rowValues(filter, item);
    const selected = (value: string) => columnValueSelected(values[id], value);
    return Array.isArray(values[id]) ? candidates.some(selected) : candidates.every(selected);
  });
  const server = Boolean(remote);
  const included = server ? '' : items.map(item => matches(item) ? '1' : '0').join('');
  const filtered = useMemo(() => server ? [...items] : items.filter((_, index) => included[index] === '1'),
    [items, included, server]);

  const header = (id: string, label: string) => {
    const filter = columns[id];
    if (!filter) return null;
    const options = () => {
      const counts = new Map<string, number>();
      const representatives = new Map<string, T>();
      if (!remote) {
        for (const item of items) {
          if (!matches(item, id)) continue;
          for (const value of new Set(rowValues(filter, item))) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
            if (!representatives.has(value)) representatives.set(value, item);
          }
        }
      }
      return (remote?.facets[id] ?? [...counts].map(([id, count]) => ({ id, count })))
        .map(({ id, count }): ColumnFilterOption => ({ id, count,
          label: id || t('cleanup:shared.none'), ...filter.option?.(id, representatives.get(id)) }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    };
    return <TableColumnFilter id={id} label={label} options={options} values={values[id]}
      onChange={selection => {
        const next = { ...values, [id]: selection };
        if (remote) remote.onChange(next); else setLocal(next);
        onChange();
      }} />;
  };
  return { items: filtered, header };
}
