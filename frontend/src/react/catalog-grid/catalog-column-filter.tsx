import { apiGet } from '../../api';
import { useLibraryFilterOptions } from '../components/library-filter-options';
import { TableColumnFilter, type ColumnFilterOption, type ColumnFilterPage } from '../components/table-column-filter';
import { ColumnFilterAvatar } from '../components/column-filter-avatar';
import { RatingStars } from '../components/rating-stars';
import type { FaceRef } from '../../card-art/markup';
import { columnRangeKinds, readColumnFilters, writeColumnFilters, type ColumnFilters, type ColumnRangeKey, type RangeScalar } from '../../column-filters';
import { TableColumnRange } from '../components/table-column-range';
import { entityDisplayName, entityWriting } from '../../core/entity-names';
import { useEntityNames } from '../use-entity-names';
import { t } from '../../i18n';
import type { MediaItem } from './types';

interface CatalogFilterState {
  label: string;
  filters: Readonly<Record<string, string>>;
  onChange(filters: Record<string, string>): void;
}

function catalogSelection<K extends keyof ColumnFilters>(
  filters: Readonly<Record<string, string>>, column: K, next: ColumnFilters[K],
): Record<string, string> {
  const encoded = writeColumnFilters(readColumnFilters(filters.column_filters), column, next);
  const updated = { ...filters };
  if (encoded) updated.column_filters = encoded;
  else delete updated.column_filters;
  return updated;
}

export function CatalogColumnRangeFilter({ column, label, filters, scope, revision, onChange }: CatalogFilterState & {
  column: ColumnRangeKey;
  scope: Readonly<Record<string, string>>;
  revision: number;
}) {
  const kind = columnRangeKinds[column];
  const selected = readColumnFilters(filters.column_filters);
  const remaining = { ...filters, column_filters: writeColumnFilters(selected, column, undefined) };
  const dates = kind === 'date' || kind === 'timestamp';
  const params = new URLSearchParams(Object.entries({ ...scope, ...remaining }).filter(([, value]) => value));
  if (dates) params.set('column', column);
  if (kind === 'count') {
    params.set('sort', column);
    params.set('dir', 'desc');
    params.set('limit', '1');
    params.set('offset', '0');
  }
  const rangeQuery = dates || kind === 'count' ? {
    key: ['catalog-column-range-values', column, String(params), revision],
    load: async (signal: AbortSignal) => {
      if (dates) return (await apiGet<{ date_values: RangeScalar[] }>(`/api/facets?${params}`, signal)).date_values;
      const { items: [row] } = await apiGet<{ items: Pick<MediaItem, 'play_count' | 'o_count'>[] }>(`/api/items?${params}`, signal);
      return row ? [(column === 'plays' ? row.play_count : row.o_count) ?? 0] : [];
    },
  } : undefined;
  return <TableColumnRange id={column} label={label} kind={kind}
    value={selected[column]} rangeQuery={rangeQuery}
    onChange={next => onChange(catalogSelection(filters, column, next))} />;
}

/** 筛选口径沿用作品请求，列内切换时保留其余列的条件。 */
export function CatalogColumnFilter({ column, label, filters, scope, revision, tagLabel, onChange }: CatalogFilterState & {
  column: 'people' | 'library' | 'tags' | 'rating' | 'resolution';
  scope: Readonly<Record<string, string>>; revision: number; tagLabel(tag: string): string;
}) {
  useEntityNames();
  const libraries = useLibraryFilterOptions(column === 'library');
  const selected = readColumnFilters(filters.column_filters);
  const remaining = { ...filters, column_filters: writeColumnFilters(selected, column, undefined) };
  const params = new URLSearchParams(Object.entries({ ...scope, ...remaining, column }).filter(([, value]) => value));
  const load = async (signal: AbortSignal, search: string, offset: number): Promise<ColumnFilterPage> => {
    const query = new URLSearchParams(params);
    const term = search.normalize('NFKC').toLocaleLowerCase();
    const scalarSearch = column === 'resolution'
      ? term && t('manage:shared.notFound').toLocaleLowerCase().includes(term) ? 'none' : term.replace(/\s/g, '').replace(/×/g, 'x') : search;
    query.set('column_q', scalarSearch); query.set('column_offset', String(offset)); query.set('column_limit', '24');
    const data = await apiGet<{ items: (FaceRef & { kind: string; k: string; n: number; aliases?: string[] })[]; next_offset: number | null }>(`/api/facets?${query}`, signal);
    if (column === 'rating') {
      const counts = new Map(data.items.map(row => [row.k, row.n]));
      return { items: [0, 1, 2, 3, 4, 5].map(score => ({
        id: String(score),
        count: counts.get(String(score)) ?? 0,
        label: score === 0 ? t('catalog:ratingControl.unrated') : t('shell:rating.stars', { count: score }),
        content: score === 0 ? undefined : <RatingStars value={score} />,
      })) };
    }
    if (column === 'resolution') return {
      items: data.items.map(row => ({ id: row.k, count: row.n,
        label: row.k === 'none' ? t('manage:shared.notFound') : row.k.replace('x', ' × ') })),
      nextOffset: data.next_offset ?? undefined,
    };
    const options = data.items.map(row => ({ id: `${row.kind}:${row.k}`, count: row.n,
      label: row.kind === 'tag' ? tagLabel(row.k) : entityDisplayName(row.kind, row.k, row.id),
      searchTerms: [row.k, ...(row.aliases || []), ...[entityWriting(row.kind, row.k, row.id)?.ja,
        entityWriting(row.kind, row.k, row.id)?.zh_cn].filter((value): value is string => !!value)],
      leading: row.kind === 'tag' ? undefined : <ColumnFilterAvatar person={{ ...row, name: row.k }} kind={row.kind} /> }));
    const uncredited = t('catalog:shared.uncredited');
    const unowned: ColumnFilterOption[] = column === 'people' && offset === 0 && uncredited.toLocaleLowerCase().includes(search.toLocaleLowerCase())
      ? [{ id: 'owner:none', label: uncredited, leading: <ColumnFilterAvatar person={{ name: uncredited }} /> }] : [];
    return { items: column === 'people' ? [...unowned, ...options] : options.map(row => ({ ...row, id: row.id.slice(4) })),
      nextOffset: data.next_offset ?? undefined };
  };
  return <TableColumnFilter id={column} label={label} values={selected[column]} searchable={column !== 'rating'}
    options={[...libraries.values()]}
    load={column === 'library' ? undefined : load} queryKey={['table-column-filter', String(params), revision]}
    onChange={next => onChange(catalogSelection(filters, column, next))} />;
}
