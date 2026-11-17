import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Popover, Pressable } from 'react-aria-components';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Button } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { ChevronDownSmall } from '@/components/foundations/icons/chevrons';
import { MENU_ITEM, MENU_ITEM_ACTIVE, MENU_ITEM_INTERACTIVE, MENU_ITEMS_CONTAINER, MENU_POPOVER_SURFACE } from '@/components/base/dropdown/menu-styles';
import { cx } from '@/utils/cx';
import { errorMessage } from '../../api';
import { columnValueSelected, toggleColumnValue, type ColumnSelection } from '../../column-filters';
import { IndexSearch } from '../index/index-search';
import { MenuDialog } from './menu-dialog';
import { Note } from './note';
import { ActivityStatus } from './activity-motion';
import { t } from '../../i18n';

export interface ColumnFilterOption { id: string; label: string; count?: number; leading?: ReactNode | (() => ReactNode); searchTerms?: readonly string[]; disabled?: boolean; title?: string }
export interface ColumnFilterPage { items: ColumnFilterOption[]; nextOffset?: number }
interface ColumnFilterProps {
  id: string; label: string; values?: ColumnSelection; options?: readonly ColumnFilterOption[] | (() => readonly ColumnFilterOption[]);
  queryKey?: readonly unknown[];
  load?(signal: AbortSignal, search: string, offset: number): Promise<ColumnFilterPage>;
  onChange(values: ColumnSelection | undefined): void;
}

/** 列头菜单只在展开时挂载查询，关闭后取消未完成请求并回收短期缓存。 */
export function TableColumnFilter(props: ColumnFilterProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <Pressable onPress={() => setOpen(true)}>
    <LinkButton ref={trigger} variant={props.values === undefined ? 'secondary' : 'primary'} size="xs" trailingIcon={ChevronDownSmall}
      data-table-column-filter={props.id} data-filter-active={props.values === undefined ? undefined : ''}
      className="min-w-0 max-w-full justify-start [&>span]:min-w-0"
      aria-label={t('catalog:columnFilter.label', { column: props.label })} aria-haspopup="dialog" aria-expanded={open}
      ><span className="truncate">{props.label}</span></LinkButton>
    </Pressable>
    <Popover triggerRef={trigger} isOpen={open} onOpenChange={setOpen} placement="bottom start" offset={4}
      className={cx(MENU_POPOVER_SURFACE, 'peach-react w-80 overflow-hidden p-0')}>
      <ColumnFilterMenu {...props} />
    </Popover>
  </>;
}

function ColumnFilterMenu({ id, label, values, options = [], queryKey, load, onChange }: ColumnFilterProps) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(24);
  const scroll = useRef<HTMLDivElement>(null);
  const result = useInfiniteQuery({
    queryKey: [...(queryKey || ['table-column-filter', id]), search], enabled: !!load,
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) => load!(signal, search, pageParam),
    getNextPageParam: (last: ColumnFilterPage) => last.nextOffset,
    staleTime: 30_000, gcTime: 60_000,
  });
  const term = search.normalize('NFKC').toLocaleLowerCase();
  const localOptions = useMemo(() => typeof options === 'function' ? options() : options, [options]);
  const rows = load ? result.data?.pages.flatMap(page => page.items) || []
    : localOptions.filter(row => [row.label, ...(row.searchTerms || [])]
      .some(name => name.normalize('NFKC').toLocaleLowerCase().includes(term)));
  const complete = !load || (!!result.data && !result.hasNextPage);
  const all = values === undefined || (!Array.isArray(values) && values.exclude.length === 0)
    || (!search && complete && rows.length > 0 && rows.every(row => columnValueSelected(values, row.id)));
  const partial = !all && (!Array.isArray(values) || values.length > 0);
  const pending = !!load && result.isPending;
  return <MenuDialog aria-label={t('catalog:columnFilter.label', { column: label })} className="flex flex-col gap-2 outline-none">
    <div className="px-3 pt-3">
      <IndexSearch label={t('catalog:columnFilter.search', { column: label })}
        placeholder={t('catalog:columnFilter.search', { column: label })} value={search}
        onQuery={next => { setSearch(next); setVisible(24); if (scroll.current) scroll.current.scrollTop = 0 }} />
    </div>
    {load && result.isError ? <Note tone="error" action={<Button size="xs" variant="ghost"
      onClick={() => void (result.isFetchNextPageError ? result.fetchNextPage() : result.refetch())}>{t('shell:shared.retry')}</Button>}>
      {errorMessage(result.error)}</Note> : null}
    <div ref={scroll} role="group" aria-label={label} data-column-filter-options=""
      className={cx(MENU_ITEMS_CONTAINER, 'max-h-72 overflow-y-auto px-3 pb-3')}
      onScroll={event => {
        const node = event.currentTarget;
        if (load && result.hasNextPage && !result.isFetching && node.scrollHeight - node.scrollTop - node.clientHeight < 100)
          void result.fetchNextPage({ cancelRefetch: false });
        if (!load && visible < rows.length && node.scrollHeight - node.scrollTop - node.clientHeight < 100)
          setVisible(current => current + 24);
      }}>
      <div className={cx(MENU_ITEM, MENU_ITEM_INTERACTIVE, all && MENU_ITEM_ACTIVE, 'focus-within:bg-dropdown-item-hover-background')}>
        <Checkbox slot={null} size="sm" isSelected={all} isIndeterminate={partial} isDisabled={pending}
          onChange={on => onChange(on ? undefined : [])} className="w-full">{t('shell:shared.all')}</Checkbox>
      </div>
      {(load ? rows : rows.slice(0, visible)).map(row => <div key={row.id} title={row.title} data-column-filter-offline={row.disabled || undefined}
        className={cx(MENU_ITEM, !row.disabled && MENU_ITEM_INTERACTIVE,
          columnValueSelected(values, row.id) && MENU_ITEM_ACTIVE, !row.disabled && 'focus-within:bg-dropdown-item-hover-background')}>
        <Checkbox slot={null} size="sm" aria-label={row.label} isSelected={columnValueSelected(values, row.id)}
          isDisabled={row.disabled}
          className="w-full min-w-0 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
          onChange={on => onChange(toggleColumnValue(values, row.id, on))}>
          <span className={cx('flex min-w-0 flex-1 items-center gap-2', row.disabled && 'text-text-tertiary')}>
            {typeof row.leading === 'function' ? row.leading() : row.leading}<span className="min-w-0 flex-1 truncate">{row.label}</span>
            {row.count == null ? null : <span className="shrink-0 text-text-tertiary tabular-nums">{row.count.toLocaleString()}</span>}
          </span>
        </Checkbox>
      </div>)}
      {load && (pending || result.isFetchingNextPage)
        ? <ActivityStatus kind="linear-dots" label={t(pending ? 'shell:spinner.loading' : 'shell:spinner.loadingMore')} />
        : load && result.hasNextPage ? <Button variant="secondary" size="small"
        onClick={() => void result.fetchNextPage({ cancelRefetch: false })}>
        {t('catalog:shared.loadMore')}</Button> : !load && rows.length > visible
          ? <Button variant="secondary" size="small" onClick={() => setVisible(current => current + 24)}>{t('catalog:shared.loadMore')}</Button> : null}
    </div>
    {!pending && !(load && result.isError) && !rows.length
      ? <span role="status" className="px-3 pb-3 text-caption-1-regular text-text-secondary">{t('catalog:columnFilter.noOptions')}</span> : null}
  </MenuDialog>;
}
