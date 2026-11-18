import { RiCloseLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import {
  columnRangeKinds, isColumnRange, isColumnRangeKey, readColumnFilters, writeColumnFilters,
  type ColumnFilters, type ColumnFilterValue, type RangeKind,
} from '../../column-filters';
import { entityDisplayName } from '../../core/entity-names';
import { joinList, t } from '../../i18n';
import { useLibraryFilterOptions } from './library-filter-options';
import { columnRangeSummary } from './table-column-range';

export function CatalogColumnFilterChips({ encoded, columns, tagLabel, onChange }: {
  encoded: string;
  columns: readonly { id: string; label: string }[];
  tagLabel?(value: string): string;
  onChange(encoded: string): void;
}) {
  const filters = readColumnFilters(encoded);
  const libraries = useLibraryFilterOptions(filters.library !== undefined);
  const valueLabel = (column: string, value: string) => {
    switch (column) {
      case 'library': return libraries.get(value)?.label ?? value;
      case 'tags': return tagLabel?.(value) ?? value;
      case 'people': {
        if (value === 'owner:none') return t('catalog:shared.uncredited');
        const colon = value.indexOf(':');
        return colon < 0 ? value : entityDisplayName(value.slice(0, colon), value.slice(colon + 1));
      }
      case 'rating': return value === '0' ? t('catalog:ratingControl.unrated') : t('shell:rating.stars', { count: +value });
      case 'resolution': return value === 'none' ? t('manage:shared.notFound') : value.replace('x', ' × ');
      default: return value;
    }
  };
  return <ColumnFilterChips filters={filters} columns={columns} valueLabel={valueLabel}
    onRemove={id => onChange(writeColumnFilters(filters, id as keyof ColumnFilters, undefined))} />;
}

export function ColumnFilterChips({ filters, columns, valueLabel, onRemove }: {
  filters: Readonly<Record<string, ColumnFilterValue | undefined>>;
  columns: readonly { id: string; label: string; range?: RangeKind }[];
  valueLabel(column: string, value: string): string;
  onRemove(column: string): void;
}) {
  const chips = columns.flatMap(({ id, label, range }) => {
    const filter = filters[id];
    if (filter === undefined) return [];
    let detail: string;
    if (isColumnRange(filter)) {
      const kind = range ?? (isColumnRangeKey(id) ? columnRangeKinds[id] : undefined);
      if (!kind) return [];
      detail = columnRangeSummary(kind, filter.range);
    } else {
      const selection = Array.isArray(filter) ? filter : filter.exclude;
      const values = selection.length ? joinList(selection.map(value => valueLabel(id, value))) : t('catalog:columnFilter.emptySelection');
      detail = Array.isArray(filter) ? values : t('catalog:columnFilter.excludedValues', { values });
    }
    return [{ id, text: t('shell:format.labelPrefix', { label }) + detail }];
  });
  if (!chips.length) return null;
  return <div role="group" aria-label={t('catalog:columnFilter.applied')} className="flex min-w-0 flex-wrap gap-2">
    {chips.map(({ id, text }) => <Button key={id} type="button" variant="secondary" size="small" trailingIcon={RiCloseLine}
      className="min-w-0 max-w-full [&>span]:min-w-0 [&>span]:shrink" data-copy-interact=""
      title={text} aria-label={t('catalog:columnFilter.removeApplied', { filter: text })}
      onClick={() => onRemove(id)}>
      <span className="min-w-0 truncate">{text}</span>
    </Button>)}
  </div>;
}
