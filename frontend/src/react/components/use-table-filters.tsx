import { useMemo, useState } from 'react';
import { columnValueSelected, isColumnRange, withinColumnRange, type ColumnFilterValue, type RangeKind, type RangeScalar } from '../../column-filters';
import { TableColumnFilter, type ColumnFilterOption } from './table-column-filter';
import { TableColumnRange } from './table-column-range';
import { t } from '../../i18n';

interface TableChoices<T> {
  values(item: T): string | readonly string[];
  option?(value: string, representative?: T): Partial<ColumnFilterOption>;
}

export type TableFilter<T> = TableChoices<T> | { range: RangeKind; value(item: T): RangeScalar | undefined | null };
export type TableFilters = Record<string, ColumnFilterValue | undefined>;
export type TableFacets = Record<string, { id: string; count: number }[]>;
export interface RemoteTableFilters {
  values: TableFilters;
  facets: TableFacets;
  onChange(values: TableFilters): void;
}

function rowValues<T>(filter: TableChoices<T>, item: T): readonly string[] {
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
    const selection = values[id];
    if ('range' in filter) {
      return !isColumnRange(selection) || withinColumnRange(filter.range, selection.range, filter.value(item));
    }
    if (isColumnRange(selection)) return true;
    const candidates = rowValues(filter, item);
    const selected = (value: string) => columnValueSelected(selection, value);
    return Array.isArray(selection) ? candidates.some(selected) : candidates.every(selected);
  });
  const server = Boolean(remote);
  const included = server ? '' : items.map(item => matches(item) ? '1' : '0').join('');
  const filtered = useMemo(() => server ? [...items] : items.filter((_, index) => included[index] === '1'),
    [items, included, server]);
  const changeFilter = (id: string, nextValue: ColumnFilterValue | undefined) => {
    const next = { ...values, [id]: nextValue };
    if (remote) remote.onChange(next); else setLocal(next);
    onChange();
  };

  const header = (id: string, label: string) => {
    const filter = columns[id];
    if (!filter) return null;
    const selection = values[id];
    const change = (nextValue: ColumnFilterValue | undefined) => changeFilter(id, nextValue);
    if ('range' in filter) {
      const usesData = filter.range === 'date' || filter.range === 'timestamp' || filter.range === 'count';
      const rangeValues = usesData ? items.flatMap(item => {
        const value = matches(item, id) ? filter.value(item) : null;
        return value == null ? [] : [value];
      }) : undefined;
      return <TableColumnRange id={id} label={label} kind={filter.range}
        value={isColumnRange(selection) ? selection : undefined} rangeValues={rangeValues} onChange={change} />;
    }
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
    return <TableColumnFilter id={id} label={label} options={options}
      values={isColumnRange(selection) ? undefined : selection} onChange={change} />;
  };
  return { items: filtered, header, values, clear: (id: string) => changeFilter(id, undefined) };
}
