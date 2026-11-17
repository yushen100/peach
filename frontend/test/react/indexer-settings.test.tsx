import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { queryClient } from '../../src/react/query';
import { IndexerSettings } from '../../src/react/settings/indexer-settings';
import { buttonNamed, click, mount, pending, settle, submit, type } from './render';

notifyManager.setScheduler(notify => notify());
it('普通 HTTP 的随机源支持添加、编辑、移除和保存索引器', async () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const fetch = vi.fn(async (_url: string, options?: RequestInit) => ({
    ok: true, status: 200,
    json: async () => options?.body ? JSON.parse(String(options.body)) : { indexers: [], max_indexers: 4 },
  }));
  vi.stubGlobal('fetch', fetch);
  const host = await mount(<QueryClientProvider client={queryClient}><IndexerSettings receipt={vi.fn()} /></QueryClientProvider>);
  await settle();
  await click(buttonNamed('添加索引器', host));
  await click(buttonNamed('添加索引器', host));
  const names = host.querySelectorAll<HTMLInputElement>('input[type="text"]');
  await type(names[0], '第一个');
  await type(names[1], '第二个');
  await type(host.querySelectorAll<HTMLInputElement>('input[type="url"]')[1], 'https://indexer.example/api');
  await click(host.querySelector('button[aria-label="移除索引器 1"]'));
  await submit(host.querySelector('form'));
  const sent = JSON.parse(String(fetch.mock.calls.at(-1)?.[1]?.body));
  expect(sent.indexers).toHaveLength(1);
  expect(sent.indexers[0]).toMatchObject({ name: '第二个', url: 'https://indexer.example/api', enabled: true });
  expect(sent.indexers[0].key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
afterEach(() => queryClient.clear());
it('进入资源搜索设置时先读取当前值，再创建表单草稿', async () => {
  const row = { key: 'one', name: '缓存名称', url: 'https://example.com/api', enabled: true, api_key_set: false };
  queryClient.setQueryData(['indexers'], { indexers: [row], max_indexers: 4 });
  const hold = pending<unknown>();
  vi.stubGlobal('fetch', vi.fn(() => hold.answer));
  const host = await mount(<QueryClientProvider client={queryClient}><IndexerSettings receipt={vi.fn()} /></QueryClientProvider>);
  expect(host.querySelector('form')).toBeNull();
  // 等待期间分区标题照画，正文是骨架；状态名只给辅助技术。
  expect(host.querySelector('section')?.getAttribute('aria-label')).toBe('资源搜索');
  expect(host.querySelector('[data-skeleton][aria-busy="true"]')?.getAttribute('aria-label')).toBe('正在读取资源搜索设置');
  await hold.release({ ok: true, status: 200, json: async () => ({ indexers: [{ ...row, name: '当前名称' }], max_indexers: 4 }) });
  await settle();
  expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('当前名称');
  expect(host.querySelector('[data-skeleton]')).toBeNull();
});

it('骨架照终态画底栏两颗禁用的键，索引器行数与展开态按上次读回的结构', async () => {
  const rows = [
    { key: 'one', name: '甲', url: 'https://example.com/a', enabled: true, api_key_set: true },
    { key: 'two', name: '', url: '', enabled: true, api_key_set: false },
  ];
  const state = { indexers: rows, max_indexers: 4 };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => state })));
  const first = await mount(<QueryClientProvider client={queryClient}><IndexerSettings receipt={vi.fn()} /></QueryClientProvider>);
  await settle();
  expect(first.querySelector('form[aria-label="资源搜索"]')).not.toBeNull();

  const hold = pending<unknown>();
  vi.stubGlobal('fetch', vi.fn(() => hold.answer));
  const host = await mount(<QueryClientProvider client={queryClient}><IndexerSettings receipt={vi.fn()} /></QueryClientProvider>);
  const skeleton = host.querySelector('[data-skeleton] section[aria-label="资源搜索"]')!;
  const keys = [...skeleton.querySelectorAll<HTMLButtonElement>('button')];
  expect(keys.map((key) => [key.textContent, key.disabled])).toEqual([['移除', true], ['添加索引器', true], ['保存配置', true]]);
  // 两条索引器两行，只有还没填地址的那条展开出三栏输入。
  expect(skeleton.querySelectorAll('.border-t.pt-2')).toHaveLength(2);
  expect([...skeleton.querySelectorAll('span.text-body-medium')].map((node) => node.textContent)).toEqual(['名称', 'Torznab 地址', 'API key']);
  await hold.release({ ok: true, status: 200, json: async () => state });
  await settle();
  expect(host.querySelector('[data-skeleton]')).toBeNull();
  localStorage.clear();
});
