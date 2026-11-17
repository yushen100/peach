/* 创作者别名：同一个人在几个站上用几个名字，合并之后按一位创作者归组。
 *
 * 待合并是带依据的候选，合并永远由人点：服务端不自行升级，页面也不替他勾。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { RiCloseLine, RiUserLine } from '@remixicon/react';
import { useMutation } from '@tanstack/react-query';
import {
  createColumnHelper, createPaginatedRowModel, createSortedRowModel, flexRender,
  rowPaginationFeature, rowSelectionFeature, rowSortingFeature, columnVisibilityFeature, tableFeatures, useTable,
  type RowSelectionState, type SortingState,
} from '@tanstack/react-table';
import { confirmModal } from '@peach/legacy/ui';

import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import {
  Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from '@/components/base/table/table';

import { errorMessage } from '../../api';
import { cardClass } from '../components/card';
import { DataTableFrame } from '../components/data-table-frame';
import { useTablePreferences } from '../components/table-column-preferences';
import { TableColumnControls, TableColumnResizer } from '../components/table-column-controls';
import { DataTableFooter, DataTableSort } from '../components/table-controls';
import { runBulkAction, type BulkAction, type Receipt } from '../components/bulk-action';
import { enterPageSelection, exitPageSelection, usePageSelection } from '../components/page-selection';
import { SelectionDock } from '../components/selection-dock';
import { useTableSelection } from '../components/use-table-selection';
import { ChevronSortDown } from '@/components/foundations/icons/chevrons';
import { EmptyState, EmptyFocusButton } from '../components/empty-state';
import { ErrorText, FieldLabel } from '../settings/section';
import { busyProps } from '../settings/use-action';
import {
  addAlias, reloadFollowManage, removeAlias,
  type AliasGroup, type AliasSuggestion, type FollowSource,
} from './follow-manage';
import { AuthorAvatar } from './source-view';
import { AliasRenameDialog } from './alias-rename-dialog';
import { TableSelectionHeader } from '../components/table-selection-header';
import { serverLabel } from '../../core/server-text';
import { joinList, quoted, t } from '../../i18n';
import { useTableFilters } from '../components/use-table-filters';

const REMOVE_BODY = (alias: string) => t('follow:creatorAliases.removeBody', { alias });
const suggestionFeatures = tableFeatures({ rowSelectionFeature, rowSortingFeature, rowPaginationFeature, columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(), paginatedRowModel: createPaginatedRowModel() });
const savedFeatures = suggestionFeatures;
const selectColumn = { id: 'select', label: t('follow:shared.select'), width: 48, min: 48, max: 48, required: true };
const identityColumn = { id: 'canonical', label: t('follow:creatorAliases.displayName'), width: 280, min: 240, required: true, flex: true };
const suggestionPreferences = [selectColumn, identityColumn, { id: 'alias', label: t('follow:creatorAliases.platformAlias'), width: 240 },
  { id: 'evidence', label: t('follow:creatorAliases.evidence'), width: 320 }, { id: 'actions', label: t('follow:shared.actions'), width: 112 }];
const savedPreferences = [selectColumn, identityColumn, { id: 'aliases', label: t('follow:creatorAliases.platformAlias'), width: 400 }, { id: 'actions', label: t('follow:shared.actions'), width: 184, min: 168 }];

export interface AliasManagerProps {
  groups: AliasGroup[];
  suggestions: AliasSuggestion[];
  sources?: FollowSource[];
  readOnly: boolean;
  toast: Receipt;
}

/** 一条待合并的身份：一个别名只可能归进一个规范名，所以用别名本身当键。 */
const suggestionKey = (item: AliasSuggestion) => item.alias;

function authorSources(sources: FollowSource[], name: string, canonicalKey?: string) {
  /* 建过档的作者键是 `entity:<id>`，别名表上记的仍是名字键：按名字键找不到就按名字认。 */
  const expected = canonicalKey ? `name:${canonicalKey}` : '';
  const anchor = (expected && sources.find((source) => source.author_key === expected))
    || sources.find((source) => source.author_name === name || source.entity_name === name);
  return anchor ? sources.filter((source) => source.author_key === anchor.author_key) : [];
}

function AuthorIdentity({ sources, name, canonicalKey }: {
  sources: FollowSource[]; name: string; canonicalKey?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <AuthorAvatar group={authorSources(sources, name, canonicalKey)} name={name} />
      <b className="text-body-medium">{name}</b>
    </span>
  );
}

export function AliasManager({ groups, suggestions, sources = [], readOnly, toast }: AliasManagerProps) {
  const suggestionView = useTablePreferences('alias-suggestions', suggestionPreferences);
  const savedView = useTablePreferences('alias-saved', savedPreferences);
  const [renaming, setRenaming] = useState<AliasGroup | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [savedSelection, setSavedSelection] = useState<RowSelectionState>({});
  usePageSelection(() => { setRowSelection({}); setSavedSelection({}) });
  useEffect(() => {
    if (Object.values(rowSelection).some(Boolean) || Object.values(savedSelection).some(Boolean)) enterPageSelection();
  }, [rowSelection, savedSelection]);
  const activateSuggestion = useTableSelection(() => setRowSelection({}));
  const activateSaved = useTableSelection(() => setSavedSelection({}));
  const [sorting, setSorting] = useState<SortingState>([]);
  const [savedSorting, setSavedSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [savedPagination, setSavedPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const filteredSuggestions = useTableFilters(suggestions, {
    canonical: { values: item => item.canonical, option: name => ({
      leading: () => <AuthorAvatar group={authorSources(sources, name)} name={name} small /> }) },
    alias: { values: item => item.alias, option: (name, item) => ({
      leading: () => <AuthorAvatar group={authorSources(sources, item?.canonical ?? name)} name={name} small /> }) },
    evidence: { values: item => serverLabel(item.evidence_code ?? '', item.evidence, item.evidence_params) },
  }, () => setPagination(now => ({ ...now, pageIndex: 0 })));
  const filteredGroups = useTableFilters(groups, {
    canonical: { values: item => item.canonical_name, option: (name, item) => ({
      leading: () => <AuthorAvatar group={authorSources(sources, name, item?.canonical_key)} name={name} small /> }) },
    aliases: { values: item => item.aliases.map(alias => alias.name), option: (name, item) => ({
      leading: () => <AuthorAvatar group={authorSources(sources, item?.canonical_name ?? name, item?.canonical_key)} name={name} small /> }) },
  }, () => setSavedPagination(now => ({ ...now, pageIndex: 0 })));
  const suggestionPage = { ...pagination, pageIndex: Math.min(pagination.pageIndex, Math.max(0, Math.ceil(filteredSuggestions.items.length / pagination.pageSize) - 1)) };
  const savedPage = { ...savedPagination, pageIndex: Math.min(savedPagination.pageIndex, Math.max(0, Math.ceil(filteredGroups.items.length / savedPagination.pageSize) - 1)) };
  const [problem, setProblem] = useState('');
  const [canonical, setCanonical] = useState('');
  const [alias, setAlias] = useState('');

  /* 合并按顺序一条一条发：一次失败要报出「还有几组没合」，而并发发出去的话，说不清
     停在了哪里。 */
  const merge = useMutation({
    mutationFn: async (items: AliasSuggestion[]) => {
      let done = 0;
      for (const item of items) {
        try {
          await addAlias(item.canonical, item.alias);
        } catch (cause) {
          /* 半路断了要说清停在哪儿：已经合上的那几组先落回列表里去掉，再点一次只发剩下的。 */
          if (done) void reloadFollowManage();
          throw new Error(t('follow:creatorAliases.mergePartialError', { error: errorMessage(cause), count: items.length - done }));
        }
        done += 1;
      }
      return { done, items };
    },
    onSuccess: () => {
      setProblem('');
      setRowSelection({});
      void reloadFollowManage();
    },
    onError: (cause) => setProblem(errorMessage(cause)),
  });

  const save = useMutation({
    mutationFn: (pair: { canonical: string; alias: string }) => addAlias(pair.canonical, pair.alias),
    onSuccess: () => {
      setProblem('');
      setCanonical('');
      setAlias('');
      void reloadFollowManage();
      toast(t('follow:creatorAliases.saved'));
    },
    onError: (cause) => setProblem(errorMessage(cause)),
  });

  const drop = useMutation({
    mutationFn: async (names: string | string[]) => {
      const pending = typeof names === 'string' ? [names] : names;
      let done = 0;
      try {
        for (const name of pending) { await removeAlias(name); done += 1; }
      } catch (cause) {
        throw new Error(t('follow:creatorAliases.removePartialError', { error: errorMessage(cause), removed: done, count: pending.length - done }));
      } finally { void reloadFollowManage(); }
    },
    onSuccess: (_result, names) => { setProblem(''); setSavedSelection({}); if (typeof names === 'string') toast(t('follow:creatorAliases.removed')) },
    onError: (cause) => setProblem(errorMessage(cause)),
  });

  const host = { receipt: toast, failure: (cause: unknown) => setProblem(errorMessage(cause)) };
  /* 合并的撤销把这一批合上的别名逐条拆开，来源回到各自独立的创作者组。 */
  const mergeAction = (all: boolean, count: number): BulkAction<AliasSuggestion> => ({
    key: all ? 'merge-all' : 'merge', reversal: 'undo',
    label: all ? t('follow:creatorAliases.mergeAllCount', { count }) : t('follow:creatorAliases.mergeSelectedCount', { count }),
    confirm: (items) => ({
      title: all ? t('follow:creatorAliases.mergeAllTitle') : t('follow:creatorAliases.mergeSelectedTitle'),
      body: t('follow:creatorAliases.mergeBody', { count: items.length, pairs: joinList(items.map(
        (item) => t('follow:creatorAliases.mergePair', { alias: quoted(item.alias), canonical: quoted(item.canonical) }))) }),
      confirmLabel: all ? t('follow:creatorAliases.mergeAllConfirm') : t('follow:creatorAliases.mergeSelectedConfirm'),
    }),
    run: async (items) => {
      const { done } = await merge.mutateAsync([...items]);
      return async () => {
        for (const item of items.slice(0, done)) await removeAlias(item.alias);
        await reloadFollowManage();
      };
    },
    receipt: (items) => t('follow:creatorAliases.merged', { count: items.length }),
  });
  const mergeSome = (items: AliasSuggestion[], all: boolean) => {
    if (!items.length) return;
    void runBulkAction(mergeAction(all, items.length), items, host).catch(host.failure);
  };
  /* 移除的撤销按原来的显示名把别名逐条加回去。 */
  const dropSaved: BulkAction<{ name: string; canonical: string }> = {
    key: 'remove', reversal: 'undo', label: t('follow:creatorAliases.removeSelectedCount', { count: 0 }),
    confirm: (items) => ({ title: t('follow:creatorAliases.removeSelectedTitle'),
      body: t('follow:creatorAliases.removeSelectedBody', { count: items.length }), items: items.map((item) => item.name),
      confirmLabel: t('follow:creatorAliases.removeSelectedConfirm') }),
    run: async (items) => {
      await drop.mutateAsync(items.map((item) => item.name));
      return async () => {
        for (const item of items) await addAlias(item.canonical, item.name);
        await reloadFollowManage();
      };
    },
    receipt: () => t('follow:creatorAliases.removed'),
  };

  const removeSome = (name: string) => void confirmModal({
    title: t('follow:creatorAliases.removeTitle'), body: REMOVE_BODY(name),
    confirmLabel: t('follow:creatorAliases.removeTitle'),
    onConfirm: () => drop.mutateAsync(name),
  });
  const handlers = useRef({ sources, readOnly, merging: merge.isPending,
    removing: drop.isPending, merge: mergeSome, remove: removeSome, rename: setRenaming });
  handlers.current = { sources, readOnly, merging: merge.isPending,
    removing: drop.isPending, merge: mergeSome, remove: removeSome, rename: setRenaming };

  const suggestionColumns = useMemo(() => {
    const column = createColumnHelper<typeof suggestionFeatures, AliasSuggestion>();
    return column.columns([
      column.display({
        id: 'select',
        header: (context) => (
          <TableSelectionHeader table={context.table} label={t('follow:creatorAliases.selectAllPending')} />
        ),
        cell: (context) => (
          <Checkbox slot={null} isSelected={context.row.getIsSelected()}
            aria-label={t('follow:creatorAliases.selectPendingRow', { alias: context.row.original.alias, name: context.row.original.canonical })}
            onChange={(on) => context.row.toggleSelected(on)} />
        ),
      }),
      column.accessor('canonical', {
        header: t('follow:creatorAliases.displayName'),
        cell: (context) => <AuthorIdentity sources={handlers.current.sources} name={context.getValue()} />,
      }),
      column.accessor('alias', { header: t('follow:creatorAliases.platformAlias'), cell: (context) => context.getValue() }),
      column.accessor((row) => serverLabel(row.evidence_code ?? '', row.evidence, row.evidence_params), {
        id: 'evidence',
        header: t('follow:creatorAliases.evidence'),
        cell: (context) => <span className="text-body-2-regular text-text-secondary">{context.getValue()}</span>,
      }),
      column.display({
        id: 'actions', header: t('follow:shared.actions'),
        cell: (context) => (
          <Button variant="secondary" size="small" disabled={handlers.current.readOnly}
            {...busyProps(handlers.current.merging)}
            onClick={() => handlers.current.merge([context.row.original], false)}>{t('follow:shared.merge')}</Button>
        ),
      }),
    ]);
  }, []);
  const savedColumns = useMemo(() => {
    const column = createColumnHelper<typeof savedFeatures, AliasGroup>();
    return column.columns([
      column.display({ id: 'select', header: ({ table }) => (
        <TableSelectionHeader table={table} label={t('follow:creatorAliases.selectAllSaved')} />
      ), cell: ({ row }) => (
        <Checkbox slot={null} aria-label={t('follow:creatorAliases.selectSavedRow', { name: row.original.canonical_name })}
          isSelected={row.getIsSelected()} onChange={(on) => row.toggleSelected(on)} />
      ) }),
      column.accessor('canonical_name', {
        id: 'canonical', header: t('follow:creatorAliases.displayName'),
        cell: (context) => (
          <AuthorIdentity sources={handlers.current.sources} name={context.getValue()}
            canonicalKey={context.row.original.canonical_key} />
        ),
      }),
      column.accessor('aliases', {
        header: t('follow:creatorAliases.platformAlias'),
        sortFn: (a, b) => a.original.aliases.map((item) => item.name).join(' ').localeCompare(b.original.aliases.map((item) => item.name).join(' '), 'zh-CN'),
        cell: (context) => (
          <span className="flex flex-wrap items-center gap-1.5">
            {context.getValue().map((item) => (
              <span key={item.key}
                className="inline-flex items-center gap-1 rounded-md bg-background-secondary-default px-1.5 py-1 text-caption-1-medium text-text-secondary">
                {item.name}
                <Button variant="ghost" size="xs" iconOnly leadingIcon={RiCloseLine}
                  aria-label={t('follow:creatorAliases.removeAliasNamed', { name: item.name })} disabled={handlers.current.readOnly}
                  {...busyProps(handlers.current.removing)}
                  onClick={() => handlers.current.remove(item.name)} />
              </span>
            ))}
          </span>
        ),
      }),
      column.display({ id: 'actions', header: t('follow:shared.actions'), cell: ({ row }) => <Button variant="secondary" size="small"
        disabled={handlers.current.readOnly} aria-label={t('follow:creatorAliases.renameRowLabel', { name: row.original.canonical_name })}
        onClick={() => handlers.current.rename(row.original)}>{t('follow:creatorAliases.rename')}</Button> }),
    ]);
  }, []);
  const suggestionTable = useTable({
    features: suggestionFeatures,
    data: filteredSuggestions.items,
    columns: suggestionColumns,
    getRowId: suggestionKey,
    state: { rowSelection, sorting, pagination: suggestionPage, columnVisibility: suggestionView.visibility },
    onColumnVisibilityChange: suggestionView.change,
    onRowSelectionChange: (next) => { activateSuggestion(); setRowSelection(next); },
    onSortingChange: (next) => { setSorting(next); setPagination((now) => ({ ...now, pageIndex: 0 })); },
    onPaginationChange: setPagination,
    enableRowSelection: true,
  });
  const savedTable = useTable({
    features: savedFeatures,
    data: filteredGroups.items,
    columns: savedColumns,
    getRowId: (group) => group.canonical_key,
    state: { rowSelection: savedSelection, sorting: savedSorting, pagination: savedPage, columnVisibility: savedView.visibility },
    onColumnVisibilityChange: savedView.change,
    onRowSelectionChange: (next) => { activateSaved(); setSavedSelection(next); }, enableRowSelection: true,
    onSortingChange: (next) => { setSavedSorting(next); setSavedPagination((now) => ({ ...now, pageIndex: 0 })); },
    onPaginationChange: setSavedPagination,
  });
  const chosen = suggestions.filter(item => rowSelection[suggestionKey(item)]);
  const savedPicked = groups.filter(group => savedSelection[group.canonical_key]).flatMap(group => group.aliases.map(item => ({
    name: item.name, canonical: group.canonical_name })));
  const busy = busyProps(merge.isPending);

  return (
    <div className={cardClass({ padding: 'none', className: 'flex flex-col gap-4 px-6 py-5 max-sm:px-4' })}>
      <h3 className="text-title-2-medium text-text-primary">{t('follow:creatorAliases.title')}</h3>

      <div className="flex flex-col gap-2">
        <FieldLabel>{t('follow:creatorAliases.addManually')}</FieldLabel>
        <div className="flex flex-wrap items-end gap-2">
          <Input aria-label={t('follow:creatorAliases.displayName')} placeholder={t('follow:creatorAliases.displayNamePlaceholder')} value={canonical}
            onChange={setCanonical} isDisabled={readOnly} className="w-56" />
          <Input aria-label={t('follow:creatorAliases.platformAlias')} placeholder={t('follow:creatorAliases.platformAlias')} value={alias}
            onChange={setAlias} isDisabled={readOnly} className="w-56" />
          <Button variant="primary" disabled={readOnly || !canonical.trim() || !alias.trim()}
            {...busyProps(save.isPending)}
            onClick={() => save.mutate({ canonical: canonical.trim(), alias: alias.trim() })}>
            {t('follow:creatorAliases.saveAlias')}
          </Button>
        </div>
      </div>

      {problem ? <ErrorText>{problem}</ErrorText> : null}

      {suggestions.length ? (
        <div className="flex flex-col gap-2">
          <div data-responsive-toolbar="">
            <div data-toolbar-heading="">
            <FieldLabel>{t('follow:creatorAliases.pending')}</FieldLabel>
            <span className="text-body-2-regular text-text-secondary">
              {t('follow:creatorAliases.groupCount', { count: filteredSuggestions.items.length })}
            </span>
            </div>
            <div data-toolbar-actions="">
            <Button variant="primary" size="small" disabled={readOnly} {...busy}
              onClick={() => mergeSome(filteredSuggestions.items, true)}>{t('follow:creatorAliases.mergeAllCount', { count: filteredSuggestions.items.length })}</Button>
            <DataTableSort label={t('follow:creatorAliases.pendingTable')} sorting={sorting}
              options={[{ id: 'canonical', label: t('follow:creatorAliases.displayName') }, { id: 'alias', label: t('follow:creatorAliases.platformAlias') }, { id: 'evidence', label: t('follow:creatorAliases.evidence') }]}
              onChange={(next) => { setSorting(next); setPagination((now) => ({ ...now, pageIndex: 0 })); }} />
            <TableColumnControls preferences={suggestionView} label={t('follow:creatorAliases.pendingTable')} />
            </div>
          </div>
          <SelectionDock label={t('follow:creatorAliases.pendingBulkActions')} visible={chosen.length > 0} count={t('follow:creatorAliases.groupsSelected', { count: chosen.length })}
            actions={[{ action: mergeAction(false, chosen.length), items: chosen, host, disabled: readOnly || merge.isPending }]}>
            <Button variant="ghost" size="small" onClick={exitPageSelection}>{t('follow:shared.clearSelection')}</Button>
          </SelectionDock>
          <DataTableFrame follow preferences={suggestionView} onRowClick={id => suggestionTable.getRow(id)?.toggleSelected()}>
            <Table aria-label={t('follow:creatorAliases.pendingTable')} size="sm"
              sortDescriptor={sorting[0] ? { column: sorting[0].id, direction: sorting[0].desc ? 'descending' : 'ascending' } : undefined}
              onSortChange={(sort) => suggestionTable.getColumn(String(sort.column))?.toggleSorting(sort.direction === 'descending')}>
            <TableHeader>
              {suggestionTable.getHeaderGroups()[0]!.headers.map((header) => (
                <TableColumn key={header.id} id={header.id} isRowHeader={header.column.id === 'canonical'} allowsSorting={header.column.getCanSort()} {...suggestionView.columnProps(header.id)}>
                  {({ sortDirection }) => <><span className="flex items-center gap-0.5">
                    {filteredSuggestions.header(header.id, String(header.column.columnDef.header)) ?? flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() ? <span data-sort-indicator data-direction={sortDirection || undefined}><ChevronSortDown /></span> : null}
                  </span><TableColumnResizer preferences={suggestionView} id={header.id} /></>}
                </TableColumn>
              ))}
              <TableColumn id="remaining-space" aria-label={t('follow:shared.rowSpacer')} data-table-space="" width={suggestionView.spaceWidth} minWidth={0} />
            </TableHeader>
            <TableBody renderEmptyState={() => t('shell:dataTable.empty')}>
              {suggestionTable.getRowModel().rows.map((row) => (
                <TableRow key={row.id} id={row.id} data-board-selected={row.getIsSelected() || undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                  <TableCell data-table-space="" />
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </DataTableFrame>
          <DataTableFooter label={t('follow:creatorAliases.pendingTable')} unit={t('follow:creatorAliases.groupUnit')} total={filteredSuggestions.items.length} pagination={suggestionPage} onChange={setPagination} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div data-responsive-toolbar="">
          <div data-toolbar-heading="">
          <FieldLabel>{t('follow:creatorAliases.savedAliases')}</FieldLabel>
          <span className="text-body-2-regular text-text-secondary">{t('follow:creatorAliases.groupCount', { count: filteredGroups.items.length })}</span>
          </div>
          <div data-toolbar-actions="">
          <DataTableSort label={t('follow:creatorAliases.saved')} sorting={savedSorting}
            options={[{ id: 'canonical', label: t('follow:creatorAliases.displayName') }, { id: 'aliases', label: t('follow:creatorAliases.platformAlias') }]}
            onChange={(next) => { setSavedSorting(next); setSavedPagination((now) => ({ ...now, pageIndex: 0 })); }} />
          <TableColumnControls preferences={savedView} label={t('follow:creatorAliases.saved')} />
          </div>
        </div>
        <SelectionDock label={t('follow:creatorAliases.savedBulkActions')} visible={savedPicked.length > 0} count={t('follow:creatorAliases.aliasesSelected', { count: savedPicked.length })}
          actions={[{ action: { ...dropSaved, label: t('follow:creatorAliases.removeSelectedCount', { count: savedPicked.length }) },
            items: savedPicked, host, disabled: readOnly || drop.isPending }]}>
          <Button variant="ghost" size="small" onClick={exitPageSelection}>{t('follow:shared.clearSelection')}</Button>
        </SelectionDock>
        {groups.length ? (
          <>
          <DataTableFrame follow preferences={savedView} onRowClick={id => savedTable.getRow(id)?.toggleSelected()}>
            <Table aria-label={t('follow:creatorAliases.saved')} size="sm"
              sortDescriptor={savedSorting[0] ? { column: savedSorting[0].id, direction: savedSorting[0].desc ? 'descending' : 'ascending' } : undefined}
              onSortChange={(sort) => savedTable.getColumn(String(sort.column))?.toggleSorting(sort.direction === 'descending')}>
            <TableHeader>
              {savedTable.getHeaderGroups()[0]!.headers.map((header) => (
                <TableColumn key={header.id} id={header.id} isRowHeader={header.column.id === 'canonical'} allowsSorting={header.column.getCanSort()} {...savedView.columnProps(header.id)}>
                  {({ sortDirection }) => <><span className="flex items-center gap-0.5">
                    {filteredGroups.header(header.id, String(header.column.columnDef.header)) ?? flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() ? <span data-sort-indicator data-direction={sortDirection || undefined}><ChevronSortDown /></span> : null}
                  </span><TableColumnResizer preferences={savedView} id={header.id} /></>}
                </TableColumn>
              ))}
              <TableColumn id="remaining-space" aria-label={t('follow:shared.rowSpacer')} data-table-space="" width={savedView.spaceWidth} minWidth={0} />
            </TableHeader>
            <TableBody renderEmptyState={() => t('shell:dataTable.empty')}>
              {savedTable.getRowModel().rows.map((row) => (
                <TableRow key={row.id} id={row.id} data-board-selected={row.getIsSelected() || undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                  <TableCell data-table-space="" />
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </DataTableFrame>
          <DataTableFooter label={t('follow:creatorAliases.saved')} unit={t('follow:creatorAliases.groupUnit')} total={filteredGroups.items.length} pagination={savedPage} onChange={setSavedPagination} />
          </>
        ) : (
          <EmptyState size="compact" icon={RiUserLine} title={t('follow:creatorAliases.emptyTitle')}
            actions={!readOnly ? <EmptyFocusButton target={`input[aria-label="${t('follow:creatorAliases.displayName')}"]`}>{t('follow:creatorAliases.addAlias')}</EmptyFocusButton> : undefined}>
            {t('follow:creatorAliases.emptyBody')}
          </EmptyState>
        )}
      </div>
      <AliasRenameDialog group={renaming} close={() => setRenaming(null)} receipt={toast} />
    </div>
  );
}
