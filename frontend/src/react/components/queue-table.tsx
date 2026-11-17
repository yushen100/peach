/* 处理队列页（垃圾文件、高清版）的列表版式：首页列表那一副（`../catalog-grid/catalog-list-page.tsx`）——
 * 上方工具条的「显示列」「重置列宽」与排序下拉，可拖宽的列、可点的排序列头、外框与「缩略图＋名字」那一格，
 * 有哪几列在 `../../queue-columns.ts`（壳的首屏骨架读同一份），各页只给单元格；列宽与显示哪几列按页记在本机。
 *
 * 队列一次取齐，不分页、不在服务端排序：排序下拉、列头与浮层上的排序键是同一份（`./queue-sort.ts`），
 * 这里照给的顺序画。勾选列同首页列表，只在多选模式里出现；多选时点行的空白处也是切换。 */
import { useMemo, useState, type ReactNode } from 'react';
import type { SortingState } from '@tanstack/react-table';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@/components/base/table/table';
import { ChevronSortDown } from '@/components/foundations/icons/chevrons';

import { Icon } from './card-meta';
import { DataTableFrame } from './data-table-frame';
import { DataTableSort } from './table-controls';
import { TableColumnControls, TableColumnResizer } from './table-column-controls';
import { useTablePreferences, type TableColumnSpec } from './table-column-preferences';
import { QUEUE_COLUMNS, queueTableKeys, type QueueTablePage } from '../../queue-columns';
import { useLibraryTints } from './library-tint';
import { t } from '../../i18n';
import { useTableFilters, type TableFilter, type RemoteTableFilters } from './use-table-filters';
import { useLibraryFilterOptions } from './library-filter-options';
import { ActivityStatus } from './activity-motion';
import '../catalog-grid/catalog-list.css';

export function QueueTable<T extends { id: number; library_id?: unknown }>({
  table, label, items, cells, selected, selecting, sort, rowLabel, onPick, onPickAll, filters, filterColumns = {}, busy = false,
}: {
  table: QueueTablePage;
  /** 每一列的单元格，键是 `QUEUE_COLUMNS` 里那一列的 id。 */
  cells: Record<string, (item: T) => ReactNode>;
  label: string; items: readonly T[]; selected: ReadonlySet<number>; selecting: boolean;
  sort: { options: { id: string; label: string }[]; sorting: SortingState; onChange(next: SortingState): void };
  rowLabel(item: T): string; onPick(item: T, on: boolean): void; onPickAll(on: boolean): void;
  filters?: RemoteTableFilters;
  filterColumns?: Record<string, TableFilter<T>>;
  busy?: boolean;
}) {
  const libraryOptions = useLibraryFilterOptions();
  const filtered = useTableFilters(items, { ...filterColumns, library: {
    values: item => typeof item.library_id === 'string' && item.library_id ? item.library_id : 'none',
    option: id => libraryOptions.get(id) ?? { label: id === 'none' ? t('cleanup:shared.none') : id },
  } }, () => {}, filters);
  const columns = useMemo(() => QUEUE_COLUMNS[table](), [table]);
  const specs = useMemo<TableColumnSpec[]>(() => [
    { id: 'select', label: t('catalog:catalogList.selectColumn'), width: 48, min: 48, max: 48, required: true },
    ...columns.map((column, index) => ({
      id: column.id, label: column.header, width: column.width, min: column.min, max: column.max,
      flex: index === 0, required: index === 0, visible: !column.hidden,
    })),
  ], [columns]);
  const preferences = useTablePreferences(`queue-${table}`, specs, queueTableKeys(table));
  const tints = useLibraryTints();
  const shown = columns.filter((column) => preferences.visibility[column.id] !== false);
  const picked = items.filter((item) => selected.has(item.id)).length;
  const current = sort.sorting[0];
  const library = (item: T) => {
    const id = typeof item.library_id === 'string' ? item.library_id : '';
    return id && tints.get(id)?.color ? id : undefined;
  };
  const byId = (key: string) => items.find((item) => String(item.id) === key);
  return (
    <div data-catalog-view-mode="list" data-catalog-table="" data-queue-table="" aria-busy={busy || undefined} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2" role="toolbar" aria-label={label}>
        <div data-toolbar-actions="">
          <TableColumnControls preferences={preferences} label={label} />
          <DataTableSort label={label} options={sort.options} sorting={sort.sorting} onChange={sort.onChange} />
        </div>
      </div>
      <DataTableFrame preferences={preferences}
        onRowClick={selecting ? (key) => { const item = byId(key); if (item) onPick(item, !selected.has(item.id)) } : undefined}>
        <Table aria-label={label} size="sm"
          sortDescriptor={current ? { column: current.id, direction: current.desc ? 'descending' : 'ascending' } : undefined}
          onSortChange={(next) => sort.onChange([{ id: String(next.column), desc: next.direction === 'descending' }])}>
          <TableHeader>
            {selecting ? <TableColumn id="select" {...preferences.columnProps('select')}>
              <Checkbox slot={null} aria-label={label} isSelected={picked > 0 && picked === items.length}
                isDisabled={busy} isIndeterminate={picked > 0 && picked < items.length} onChange={onPickAll} />
            </TableColumn> : null}
            {shown.map((column, index) => (
              <TableColumn key={column.id} id={column.id} isRowHeader={index === 0} allowsSorting={!!column.sortable}
                {...preferences.columnProps(column.id)}>
                {({ sortDirection }) => <>
                  <span className="flex items-center gap-0.5">
                    {filtered.header(column.id, column.header) ?? column.header}
                    {column.sortable ? <span data-sort-indicator="" data-direction={sortDirection || undefined}><ChevronSortDown /></span> : null}
                  </span>
                  <TableColumnResizer preferences={preferences} id={column.id} />
                </>}
              </TableColumn>
            ))}
            <TableColumn id="remaining-space" aria-label={t('catalog:catalogList.rowSpacer')} data-table-space="" width={preferences.spaceWidth} minWidth={0} />
          </TableHeader>
          <TableBody renderEmptyState={() => busy ? null : t('shell:dataTable.empty')}>
            {(busy ? [] : filtered.items).map((item) => (
              <TableRow key={item.id} id={String(item.id)} data-id={item.id} data-catalog-row="" data-library={library(item)}
                data-board-selected={selected.has(item.id) || undefined}>
                {selecting ? <TableCell><Checkbox slot={null} aria-label={rowLabel(item)} isSelected={selected.has(item.id)}
                  onChange={(on) => onPick(item, on)} /></TableCell> : null}
                {shown.map((column) => <TableCell key={column.id}>{cells[column.id]?.(item)}</TableCell>)}
                <TableCell data-table-space="" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableFrame>
      {busy ? <ActivityStatus kind="linear-dots" label={t('shell:spinner.loading')} /> : null}
    </div>
  );
}

/** 名称格：缩略图在前、名字在后，同首页列表；点哪一处都是打开。 */
export function QueueIdentity({ picture, name, title, onOpen }: { picture: ReactNode; name: string; title?: string; onOpen?(): void }) {
  return (
    <div data-list-identity="">
      <button type="button" data-list-open="" tabIndex={-1} aria-hidden="true" onClick={onOpen}>
        <span data-list-picture="">{picture}</span>
      </button>
      <span data-list-text="">
        <button type="button" data-list-name="" title={title ?? name} onClick={onOpen}>{name}</button>
      </span>
    </div>
  );
}

/** 名称格里的缩略图：取不到就换成类型字形，不露浏览器的破图标。 */
export function QueuePicture({ src, glyph }: { src: string; glyph: string }) {
  const [broken, setBroken] = useState(false);
  return src && !broken
    ? <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setBroken(true)} />
    : <span data-queue-glyph=""><Icon name={glyph} /></span>;
}
