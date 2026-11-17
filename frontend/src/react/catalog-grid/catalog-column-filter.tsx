import { apiGet } from '../../api';
import { useLibraryFilterOptions } from '../components/library-filter-options';
import { TableColumnFilter, type ColumnFilterOption, type ColumnFilterPage } from '../components/table-column-filter';
import { ColumnFilterAvatar } from '../components/column-filter-avatar';
import type { FaceRef } from '../../card-art/markup';
import { readColumnFilters, writeColumnFilters } from '../../column-filters';
import { entityDisplayName, entityWriting } from '../../core/entity-names';
import { useEntityNames } from '../use-entity-names';
import { t } from '../../i18n';

/** 筛选口径沿用作品请求，列内切换时保留其余列的条件。 */
export function CatalogColumnFilter({ column, label, filters, scope, revision, tagLabel, onChange }: {
  column: 'people' | 'library' | 'tags' | 'rating' | 'resolution'; label: string; filters: Readonly<Record<string, string>>;
  scope: Readonly<Record<string, string>>; revision: number; tagLabel(tag: string): string;
  onChange(filters: Record<string, string>): void;
}) {
  useEntityNames();
  const libraries = useLibraryFilterOptions(column === 'library');
  const selected = readColumnFilters(filters.column_filters);
  const remaining = { ...filters, column_filters: writeColumnFilters(selected, column, undefined) };
  const params = new URLSearchParams(Object.entries({ ...scope, ...remaining, column }).filter(([, value]) => value));
  const load = async (signal: AbortSignal, search: string, offset: number): Promise<ColumnFilterPage> => {
    const query = new URLSearchParams(params);
    const term = search.normalize('NFKC').toLocaleLowerCase();
    const scalarSearch = column === 'rating' ? '' : column === 'resolution'
      ? term && t('manage:shared.notFound').toLocaleLowerCase().includes(term) ? 'none' : term.replace(/\s/g, '').replace(/×/g, 'x') : search;
    query.set('column_q', scalarSearch); query.set('column_offset', String(offset)); query.set('column_limit', '24');
    const data = await apiGet<{ items: (FaceRef & { kind: string; k: string; n: number; aliases?: string[] })[]; next_offset: number | null }>(`/api/facets?${query}`, signal);
    if (column === 'rating' || column === 'resolution') return {
      items: data.items.map(row => ({ id: row.k, count: row.n,
        label: column === 'rating' ? row.k === '0' ? t('catalog:ratingControl.unrated') : t('catalog:ratingControl.rated', { score: row.k })
          : row.k === 'none' ? t('manage:shared.notFound') : row.k.replace('x', ' × ') }))
        .filter(row => column !== 'rating' || row.label.normalize('NFKC').toLocaleLowerCase().includes(term)),
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
  return <TableColumnFilter id={column} label={label} values={selected[column]}
    options={[...libraries.values()]}
    load={column === 'library' ? undefined : load} queryKey={['table-column-filter', String(params), revision]}
    onChange={next => {
      const encoded = writeColumnFilters(selected, column, next);
      const nextFilters = { ...filters };
      if (encoded) nextFilters.column_filters = encoded;
      else delete nextFilters.column_filters;
      onChange(nextFilters);
    }} />;
}
