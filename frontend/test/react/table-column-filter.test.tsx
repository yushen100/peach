import { act, useState } from 'react';
import type { ColumnSelection } from '../../src/column-filters';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@/components/base/table/table';
import { CatalogColumnFilter } from '../../src/react/catalog-grid/catalog-column-filter';
import { TableColumnFilter } from '../../src/react/components/table-column-filter';
import { ColumnFilterAvatar } from '../../src/react/components/column-filter-avatar';
import { SiteMark } from '../../src/react/components/site-mark';
import { queryClient } from '../../src/react/query';
import { publishLibraries } from '../../src/library-catalog';
import { MEDIA_SOURCES_KEY } from '../../src/query/media-sources';
import { t } from '../../src/i18n';
import { buttonNamed, click, mount, pending, settle, type } from './render';

afterEach(() => { queryClient.clear(); publishLibraries([]) });

it('人物菜单优先使用本地作品头像', async () => {
  const host = await mount(<ColumnFilterAvatar person={{ name: 'Author', has_avatar: true, rep: 41,
    source_avatar: true, source_actor_id: 'actor-1', avatar_code: 'CODE-1' }} />);
  expect(host.querySelector('img')?.getAttribute('src')).toBe('/avatar?id=41');
});

it('列头下拉支持搜索、多选与清除，搜索不丢失已选项', async () => {
  const changed = vi.fn();
  const sorted = vi.fn();
  const options = [{ id: 'studio:one', label: 'One', searchTerms: ['别名'] }, { id: 'studio:two', label: 'Two' }];
  function Choices() {
    const [values, setValues] = useState<ColumnSelection | undefined>(['studio:two']);
    return <TableColumnFilter id="studio" label="厂牌" values={values} options={options}
      onChange={next => { changed(next); setValues(next) }} />;
  }
  const host = await mount(<QueryClientProvider client={queryClient}>
    <Table aria-label="作品" onSortChange={sorted}><TableHeader><TableColumn id="studio" textValue="厂牌" allowsSorting>
      <Choices />
    </TableColumn></TableHeader><TableBody><TableRow id="one"><TableCell>One</TableCell></TableRow></TableBody></Table>
  </QueryClientProvider>);
  await click(host.querySelector('[data-table-column-filter]'));
  expect(sorted).not.toHaveBeenCalled();
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

it('本地长选项分批展示，搜索可命中尚未展示的选项', async () => {
  const options = vi.fn(() => Array.from({ length: 60 }, (_, index) => ({ id: String(index), label: `Local ${index}`,
    leading: <><ColumnFilterAvatar person={{ id: index + 1, name: `Local ${index}`, has_image: true, image_version: 'photo-v1' }} />
      <SiteMark source="dmm" /></> })));
  const host = await mount(<QueryClientProvider client={queryClient}>
    <TableColumnFilter id="local" label="本地名称" options={options}
      onChange={vi.fn()} />
  </QueryClientProvider>);
  expect(options).not.toHaveBeenCalled();
  await click(host.querySelector('[data-table-column-filter]'));
  expect(options).toHaveBeenCalledTimes(1);
  expect(document.querySelectorAll('[data-column-filter-options] label')).toHaveLength(25);
  expect(document.querySelectorAll('[data-column-filter-avatar] img')).toHaveLength(24);
  expect(document.querySelector('[data-column-filter-avatar] img')?.getAttribute('src')).toContain('&v=photo-v1');
  expect(document.querySelectorAll('[data-column-filter-options] img[src="/site-mark?source=dmm"]')).toHaveLength(24);
  await click(buttonNamed('载入更多'));
  expect(document.querySelectorAll('[data-column-filter-options] label')).toHaveLength(49);
  await type(document.querySelector('input[aria-label="搜索本地名称"]'), 'Local 59');
  await vi.waitFor(() => expect(document.querySelector('input[aria-label="Local 59"]')).not.toBeNull());
  expect(document.querySelectorAll('[data-column-filter-options] label')).toHaveLength(2);
  expect(options).toHaveBeenCalledTimes(1);
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
  await vi.waitFor(() => expect(document.querySelector<HTMLInputElement>('input[aria-label="Person 0"]')?.checked).toBe(true));
  await click(document.querySelector('input[aria-label="Person 0"]'));
  expect(changed).toHaveBeenLastCalledWith({ exclude: ['0'] });
  await click(buttonNamed('载入更多'));
  await settle();
  expect(load.mock.calls.map(call => call[2])).toEqual([0, 24]);
  await vi.waitFor(() => expect(document.querySelector<HTMLInputElement>('input[aria-label="Person 24"]')?.checked).toBe(true));
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
  await vi.waitFor(() => expect(document.querySelector('input[aria-label="Another Person"]')).not.toBeNull());
  await click(document.querySelector('input[aria-label="Another Person"]'));
  expect(JSON.parse(changed.mock.calls.at(-1)![0].column_filters)).toEqual({ tags: ['Tag'], people: ['creator:Creator', 'performer:Another Person'] });
});

it('媒体库按各自根目录显示离线状态，混合在线与未检测目录保持可选', async () => {
  const offlineRoot = { root_id: 'unplugged', location: 'local' };
  const onlineRoot = { root_id: 'connected', location: 'local' };
  publishLibraries([
    { id: 'media', name: 'media', roots: [offlineRoot] },
    { id: 'backup', name: 'backup', roots: [onlineRoot] },
    { id: 'mixed', name: 'mixed', roots: [offlineRoot, onlineRoot] },
    { id: 'unknown', name: 'unknown', roots: [{ root_id: 'checking', location: 'local' }] },
  ]);
  const status = (offline: boolean | null, online: boolean | null) => ({ sources: [{ location: 'local', online: true,
    roots: [{ root_id: 'unplugged', online: offline }, { root_id: 'connected', online }, { root_id: 'checking', online: null }] }] });
  queryClient.setQueryData(MEDIA_SOURCES_KEY, status(false, true));
  const changed = vi.fn();
  const host = await mount(<QueryClientProvider client={queryClient}>
    <CatalogColumnFilter column="library" label="媒体库" filters={{}} scope={{}} revision={1} tagLabel={value => value} onChange={changed} />
  </QueryClientProvider>);
  await click(host.querySelector('[data-table-column-filter]'));
  const choice = (name: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
  expect(choice('media').disabled).toBe(true);
  expect(choice('media').checked).toBe(true);
  expect(choice('media').closest('[data-column-filter-offline]')?.getAttribute('title')).toBe(t('shell:sourceTools.libraryOffline'));
  expect(choice('backup').disabled).toBe(false);
  expect(choice('mixed').disabled).toBe(false);
  expect(choice('unknown').disabled).toBe(false);
  await click(choice('media'));
  expect(changed).not.toHaveBeenCalled();
  await act(async () => { queryClient.setQueryData(MEDIA_SOURCES_KEY, status(true, false)) });
  await vi.waitFor(() => expect(choice('media').disabled).toBe(false));
  expect(choice('backup').disabled).toBe(true);
  expect(choice('mixed').disabled).toBe(false);
});

it('下拉加载态位于选项末尾，滚动续页期间保留已有选项', async () => {
  const first = pending<{ items: { id: string; label: string }[]; nextOffset?: number }>();
  const next = pending<{ items: { id: string; label: string }[]; nextOffset?: number }>();
  const load = vi.fn((_signal: AbortSignal, _search: string, offset: number) => offset ? next.answer : first.answer);
  const host = await mount(<QueryClientProvider client={queryClient}>
    <TableColumnFilter id="people" label="艺人" load={load} onChange={() => {}} />
  </QueryClientProvider>);
  await click(host.querySelector('[data-table-column-filter]'));
  const loading = () => document.querySelector('[role="dialog"] [role="status"]');
  const scroll = document.querySelector('[data-column-filter-options]')!;
  expect(loading()?.textContent).toBe(t('shell:spinner.loading'));
  expect(scroll.lastElementChild).toBe(loading());
  expect(loading()?.querySelector('[data-activity]')?.getAttribute('data-activity')).toBe('linear-dots');
  await first.release({ items: [{ id: 'one', label: 'First person' }], nextOffset: 24 });
  await vi.waitFor(() => expect(document.querySelector('input[aria-label="First person"]')).not.toBeNull());
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => { scroll.dispatchEvent(new Event('scroll', { bubbles: true })) });
  await vi.waitFor(() => expect(loading()?.textContent).toBe(t('shell:spinner.loadingMore')));
  expect(scroll.lastElementChild).toBe(loading());
  expect(loading()?.querySelector('[data-activity]')?.getAttribute('data-activity')).toBe('linear-dots');
  expect(document.querySelector<HTMLInputElement>('input[aria-label="First person"]')?.checked).toBe(true);
  expect(load.mock.calls.map(call => call[2])).toEqual([0, 24]);
  await next.release({ items: [{ id: 'two', label: 'Second person' }] });
  await vi.waitFor(() => expect(document.querySelector('input[aria-label="Second person"]')).not.toBeNull());
  expect(loading()).toBeNull();
});
