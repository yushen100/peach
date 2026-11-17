import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createColumnHelper, createPaginatedRowModel, createSortedRowModel, flexRender,
  rowPaginationFeature, rowSelectionFeature, rowSortingFeature, columnVisibilityFeature, tableFeatures, useTable,
  type RowData, type RowSelectionState, type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@/components/base/table/table';
import { ChevronSortDown } from '@/components/foundations/icons/chevrons';
import { DataTableFrame } from './data-table-frame';
import { DataTableFooter, DataTableSort } from './table-controls';
import { enterPageSelection, exitPageSelection, usePageSelection } from './page-selection';
import { SelectionDock, type DockAction } from './selection-dock';
import { cardClass } from './card';
import { useTableSelection } from './use-table-selection';
import { useTablePreferences } from './table-column-preferences';
import { TableColumnControls, TableColumnResizer } from './table-column-controls';
import { TableSelectionHeader } from './table-selection-header';
import { useTableFilters, type TableFilter, type RemoteTableFilters } from './use-table-filters';
import { ActivityStatus } from './activity-motion';
import { t } from '../../i18n';

const features = tableFeatures({
  rowSortingFeature, rowSelectionFeature, rowPaginationFeature, columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(), paginatedRowModel: createPaginatedRowModel(),
});

export interface DataColumn<T> {
  id: string;
  label: string;
  value?(item: T): string | number;
  render(item: T): ReactNode;
  filter?: TableFilter<T>;
  width?: number;
  min?: number;
  max?: number;
  flex?: boolean;
}

interface DataTableProps<T> {
  label: string;
  items: T[];
  columns: DataColumn<T>[];
  rowId(item: T): string;
  rowLabel(item: T): string;
  selected: string[];
  onSelected(ids: string[]): void;
  /** 所选行上会写数据的键：每颗都声明确认文案与撤销方式（`bulk-action.ts`）。 */
  actions(items: T[], clear: () => void): readonly DockAction[];
  /** 所选行上不写数据的键（复制、重新检查）。 */
  controls?(items: T[], clear: () => void): ReactNode;
  title?: string;
  titleId?: string;
  description?: ReactNode;
  footerActions?: ReactNode;
  toolbarActions?: ReactNode;
  panel?: boolean;
  unit?: string;
  filters?: RemoteTableFilters;
  busy?: boolean;
}

/** 数据表共用排序、跨页选择与分页；业务动作只接收仍在清单里的所选行。 */
export function DataTable<T extends RowData>({ label, items, columns, rowId, rowLabel, selected, onSelected, actions, controls,
  title = label, titleId, description, footerActions, toolbarActions, panel = true, unit = t('shell:dataTable.recordUnit'), filters, busy }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const preferenceColumns = useMemo(() => [
    { id: 'select', label: t('shell:dataTable.selectColumn'), width: 48, min: 48, max: 48, required: true },
    ...columns.map((column, index) => ({ ...column, width: column.width ?? (index === 0 ? 320 : 160),
      min: column.min ?? (index === 0 ? 320 : 96), flex: column.flex ?? index === 0, required: index === 0 })),
  ], [columns]);
  const preferences = useTablePreferences(`data:${label}`, preferenceColumns);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const filtered = useTableFilters(items, Object.fromEntries(columns.filter(column => column.filter)
    .map(column => [column.id, column.filter!])), () => setPagination(now => ({ ...now, pageIndex: 0 })), filters);
  const [retained, setRetained] = useState<T[]>([]);
  const available = new Map((filters ? [...retained, ...items] : items).map(item => [rowId(item), item]));
  const activateSelection = useTableSelection(() => onSelected([]));
  /* 处理队列页的右上角多选开关与这里的勾选是同一份状态：勾了就进入多选，退出时清空。 */
  usePageSelection(() => onSelected([]));
  useEffect(() => { if (selected.length) enterPageSelection() }, [selected.length]);
  const pages = Math.max(1, Math.ceil(filtered.items.length / pagination.pageSize));
  const pageIndex = Math.min(pagination.pageIndex, pages - 1);
  const rowSelection: RowSelectionState = Object.fromEntries(selected.map((id) => [id, true]));
  const definitions = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>();
    return helper.columns([
      helper.display({ id: 'select', header: ({ table }) => (
        <TableSelectionHeader table={table} label={t('shell:dataTable.selectAll', { label })} disabled={busy} />
      ), cell: ({ row }) => (
        <Checkbox slot={null} aria-label={t('shell:dataTable.selectRow', { name: rowLabel(row.original) })} isSelected={row.getIsSelected()}
          onChange={(on) => row.toggleSelected(on)} />
      ) }),
      ...columns.map((column) => helper.accessor((item: T) => column.value?.(item) ?? '', {
        id: column.id, header: column.label, enableSorting: Boolean(column.value),
        sortFn: (a, b) => {
          const first = column.value!(a.original), second = column.value!(b.original);
          return typeof first === 'number' && typeof second === 'number'
            ? first - second : String(first).localeCompare(String(second), 'zh-CN', { numeric: true });
        },
        cell: ({ row }) => column.render(row.original),
      })),
    ]);
  }, [columns, label, rowLabel, busy]);
  const table = useTable({
    features, data: filtered.items, columns: definitions, getRowId: rowId,
    state: { sorting, rowSelection, pagination: { ...pagination, pageIndex }, columnVisibility: preferences.visibility },
    onColumnVisibilityChange: preferences.change,
    onSortingChange: (updater) => { setSorting(updater); setPagination((now) => ({ ...now, pageIndex: 0 })); },
    onPaginationChange: setPagination, enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      if (Object.values(next).some(Boolean)) activateSelection();
      onSelected([...available.values()].filter((item) => next[rowId(item)]).map(rowId));
    },
  });
  const chosen = selected.flatMap(id => { const item = available.get(id); return item ? [item] : [] });
  useEffect(() => {
    if (retained.length !== chosen.length || retained.some((item, index) => item !== chosen[index])) setRetained(chosen);
  }, [chosen, retained]);
  return (
    <div data-data-table-panel={panel || undefined} aria-busy={busy || undefined} className={panel
      ? cardClass({ padding: 'none', className: 'flex flex-col gap-4 px-6 py-5 max-sm:px-4' })
      : 'flex min-w-0 flex-col gap-4'}>
      <div data-responsive-toolbar="" role="toolbar" aria-label={t('shell:dataTable.toolbar', { label })}>
        <div data-toolbar-heading="">
        <h3 id={titleId} className="text-title-2-medium text-text-primary">{title}</h3>
        <span className="text-body-2-regular tabular-nums text-text-secondary">
          {`${filtered.items.length.toLocaleString()} ${unit}`}
        </span>
        </div>
        <div data-toolbar-actions="">
        {toolbarActions}
        <TableColumnControls preferences={preferences} label={label} />
        <DataTableSort label={label} options={columns.filter((column) => column.value).map((column) => ({ id: column.id, label: column.label }))}
          sorting={sorting} onChange={(next) => { setSorting(next); setPagination((now) => ({ ...now, pageIndex: 0 })); }} />
        </div>
      </div>
      {description ? <p className="text-body-2-regular text-text-secondary">{description}</p> : null}
      <SelectionDock label={t('shell:dataTable.bulkActions', { label })} visible={chosen.length > 0} count={t('shell:dataTable.selectedCount', { count: chosen.length, unit })}
        actions={actions(chosen, () => onSelected([]))}>
        {controls?.(chosen, () => onSelected([]))}
        <Button variant="ghost" size="small" onClick={() => { onSelected([]); exitPageSelection() }}>{t('shell:dataTable.clearSelection')}</Button>
      </SelectionDock>
      <DataTableFrame follow preferences={preferences} onRowClick={(id) => table.getRow(id)?.toggleSelected()}>
        <Table aria-label={label} size="sm"
          sortDescriptor={sorting[0] ? { column: sorting[0].id, direction: sorting[0].desc ? 'descending' : 'ascending' } : undefined}
          onSortChange={(sort) => table.getColumn(String(sort.column))?.toggleSorting(sort.direction === 'descending')}>
          <TableHeader>
            {table.getHeaderGroups()[0]!.headers.map((header) => (
              <TableColumn key={header.id} id={header.id} isRowHeader={header.id === columns[0]!.id} allowsSorting={header.column.getCanSort()} {...preferences.columnProps(header.id)}>
                {({ sortDirection }) => <><span className="flex items-center gap-0.5">
                  {filtered.header(header.id, String(header.column.columnDef.header)) ?? flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanSort() ? <span data-sort-indicator data-direction={sortDirection || undefined}><ChevronSortDown /></span> : null}
                </span><TableColumnResizer preferences={preferences} id={header.id} /></>}
              </TableColumn>
            ))}
            <TableColumn id="remaining-space" aria-label={t('shell:dataTable.spacerColumn')} data-table-space="" width={preferences.spaceWidth} minWidth={0} />
          </TableHeader>
          <TableBody renderEmptyState={() => busy ? null : t('shell:dataTable.empty')}>
            {(busy ? [] : table.getRowModel().rows).map((row) => (
              <TableRow key={row.id} id={row.id} data-board-selected={row.getIsSelected() || undefined}>
                {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                <TableCell data-table-space="" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableFrame>
      {busy ? <ActivityStatus kind="linear-dots" label={t('shell:spinner.loading')} /> : null}
      <DataTableFooter label={label} total={filtered.items.length} pagination={{ ...pagination, pageIndex }} onChange={setPagination} unit={unit} />
      {footerActions ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-separator-border pt-4">{footerActions}</div> : null}
    </div>
  );
}
