import { act, useState } from 'react';
import type { ColumnSelection } from '../../src/column-filters';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@/components/base/table/table';
import { CatalogColumnFilter } from '../../src/react/catalog-grid/catalog-column-filter';
import { TableColumnFilter } from '../../src/react/components/table-column-filter';
import { queryClient } from '../../src/react/query';
import { buttonNamed, click, mount, settle, type } from './render';

afterEach(() => queryClient.clear());

it('列头下拉支持搜索、多选与清除，搜索不丢失已选项', async () => {
  const changed = vi.fn();
  const options = [{ id: 'studio:one', label: 'One', searchTerms: ['别名'] }, { id: 'studio:two', label: 'Two' }];
  function Choices() {
    const [values, setValues] = useState<ColumnSelection | undefined>(['studio:two']);
    return <TableColumnFilter id="studio" label="厂牌" values={values} options={options}
      onChange={next => { changed(next); setValues(next) }} />;
  }
  const host = await mount(<QueryClientProvider client={queryClient}>
    <Table aria-label="作品"><TableHeader><TableColumn id="studio" textValue="厂牌">
      <Choices />
    </TableColumn></TableHeader><TableBody><TableRow id="one"><TableCell>One</TableCell></TableRow></TableBody></Table>
  </QueryClientProvider>);
  await click(host.querySelector('[data-table-column-filter]'));
  await type(document.querySelector('input[aria-label="搜索厂牌"]'), '别名');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)) });
  expect([...document.querySelectorAll('[data-column-filter-options] label')].map(node => node.textContent)).toEqual(['全部', 'One']);
  await click(document.querySelector('input[aria-label="One"]'));
  expect(changed).toHaveBeenLastCalledWith(['studio:two', 'studio:one']);
  expect(document.querySelector<HTMLInputElement>('input[aria-label="One"]')?.checked).toBe(true);
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await click(document.querySelector('[data-column-filter-options] label'));
  expect(changed).toHaveBeenLastCalledWith(undefined);
  await click(document.querySelector('[data-column-filter-options] label'));
  expect(changed).toHaveBeenLastCalledWith([]);
});

it('全选覆盖未加载项，取消一项后续页仍按排除项选择', async () => {
  const load = vi.fn(async (_signal: AbortSignal, _search: string, offset: number) => ({
    items: [{ id: String(offset), label: `Person ${offset}` }], nextOffset: offset === 0 ? 24 : undefined,
  }));
  const changed = vi.fn();
  function Choices() {
    const [values, setValues] = useState<ColumnSelection | undefined>();
    return <TableColumnFilter id="people" label="艺人" values={values} load={load}
      onChange={next => { changed(next); setValues(next) }} />;
  }
  const host = await mount(<QueryClientProvider client={queryClient}><Choices /></QueryClientProvider>);
  expect(load).not.toHaveBeenCalled();
  await click(host.querySelector('[data-table-column-filter]'));
  await settle();
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Person 0"]')?.checked).toBe(true);
  await click(document.querySelector('input[aria-label="Person 0"]'));
  expect(changed).toHaveBeenLastCalledWith({ exclude: ['0'] });
  await click(buttonNamed('载入更多'));
  await settle();
  expect(load.mock.calls.map(call => call[2])).toEqual([0, 24]);
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Person 24"]')?.checked).toBe(true);
  await click(document.querySelector('[data-column-filter-options] label'));
  expect(changed).toHaveBeenLastCalledWith(undefined);
  await click(document.querySelector('[data-column-filter-options] label'));
  expect(changed).toHaveBeenLastCalledWith([]);
});

it('艺人选项按完整范围延迟读取，切换时保留其它列条件', async () => {
  const fetcher = vi.fn(async (_url: string) => ({ ok: true, status: 200,
    json: async () => ({ items: [{ kind: 'performer', k: 'Another Person', n: 25 },
      { kind: 'creator', k: 'Creator', n: 2 }, { kind: 'performer', k: 'Third Person', n: 1 }] }) }));
  vi.stubGlobal('fetch', fetcher);
  const changed = vi.fn();
  function Probe() {
    const [filters, setFilters] = useState<Record<string, string>>({
      column_filters: JSON.stringify({ people: ['creator:Creator'], tags: ['Tag'] }),
    });
    return <CatalogColumnFilter column="people" label="艺人" filters={filters}
      scope={{ scope_kind: 'studio', scope_name: 'Studio', loc: '115' }} revision={1} tagLabel={value => value}
      onChange={next => { changed(next); setFilters(next) }} />;
  }
  const host = await mount(<QueryClientProvider client={queryClient}><Probe /></QueryClientProvider>);
  expect(fetcher).not.toHaveBeenCalled();
  await click(buttonNamed('艺人', host));
  await settle();
  const params = new URL(String(fetcher.mock.calls[0]![0]), 'http://peach.test').searchParams;
  expect(Object.fromEntries(params)).toMatchObject({ column: 'people', scope_kind: 'studio', scope_name: 'Studio', loc: '115' });
  expect(JSON.parse(params.get('column_filters')!)).toEqual({ tags: ['Tag'] });
  expect(params.has('creator')).toBe(false);
  await click(document.querySelector('input[aria-label="Another Person"]'));
  expect(JSON.parse(changed.mock.calls.at(-1)![0].column_filters)).toEqual({ tags: ['Tag'], people: ['creator:Creator', 'performer:Another Person'] });
});
