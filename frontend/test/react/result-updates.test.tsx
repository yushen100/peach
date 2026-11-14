import { act } from 'react';
import { QueryClientProvider, notifyManager, useQuery } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

import { createResultRefresher, ResultUpdates } from '../../src/react/result-updates';
import { RESULT_UPDATES_KEY } from '../../src/react/activity/tasks';
import { queryClient } from '../../src/react/query';
import { mount, pending, settle } from './render';

notifyManager.setScheduler(notify => notify());
afterEach(() => queryClient.clear());

it('未显示页面的后台预取继续读取，不阻塞当前页面的版本处理', async () => {
  const old = pending<string>();
  const prefetched = queryClient.fetchQuery({ queryKey: ['item', 3], queryFn: () => old.answer });
  await createResultRefresher()({ catalog: '1' }, { catalog: '2' });
  expect(queryClient.getQueryState(['item', 3])?.fetchStatus).toBe('fetching');
  await old.release('预取内容');
  expect(await prefetched).toBe('预取内容');
});

it('运行中的任务发布确认结果时更新列表，状态与凭据查询保持原值', async () => {
  const data = { busy: true,
    result_versions: { follow: '1' } };
  queryClient.setQueryData(RESULT_UPDATES_KEY, data);
  queryClient.setQueryData(['follow-feed'], '首项');
  queryClient.setQueryData(['follow-manage', 'check'], 'running');
  queryClient.setQueryData(['follow-manage', 'credentials'], '凭据');
  queryClient.setQueryData(['catalog-grid'], '馆藏');
  queryClient.setQueryData(['index', 'performers'], '旧名册');
  let current = '首项';
  const read = vi.fn(async () => current);
  function Feed() {
    const feed = useQuery({ queryKey: ['follow-feed'], queryFn: read });
    return <p>{feed.data}</p>;
  }
  const host = await mount(<QueryClientProvider client={queryClient}><ResultUpdates openItem={vi.fn()} /><Feed /></QueryClientProvider>);
  await settle();
  expect(read).not.toHaveBeenCalled();
  await act(async () => {
    current = '首项、次项';
    queryClient.setQueryData(RESULT_UPDATES_KEY, { ...data, result_versions: { follow: '2' } });
  });
  await settle();
  expect(host.textContent).toBe('首项、次项');
  expect(read).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(['follow-manage', 'check'])?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(['follow-manage', 'credentials'])?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(['catalog-grid'])?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(['index', 'performers'])?.isInvalidated).toBe(true);
});

it('关注结果变了，统计与口味也重取：两页的服务端缓存都读关注来源', async () => {
  // 页面与版本键的对应和 `tests/test_ledger_revision.py` 的 `ResultVersionTablesTests` 一致。
  for (const key of [['stats'], ['taste', 'all'], ['catalog-grid']]) queryClient.setQueryData(key, '旧');
  await createResultRefresher()({ follow: '1' }, { follow: '2' });
  expect(queryClient.getQueryState(['stats'])?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(['taste', 'all'])?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(['catalog-grid'])?.isInvalidated).toBe(false);
});

it('版本到达前已发出的读取结束后再核查一次，旧响应不能盖住确认结果', async () => {
  const old = pending<string>();
  let reads = 0;
  function Item() {
    const item = useQuery({ queryKey: ['item', 2], queryFn: () => ++reads === 1 ? old.answer : Promise.resolve('确认结果') });
    return <p>{item.data}</p>;
  }
  const host = await mount(<QueryClientProvider client={queryClient}><Item /></QueryClientProvider>);
  const refresh = createResultRefresher();
  const completed = refresh({ catalog: '1' }, { catalog: '2' });
  await old.release('旧响应');
  await act(async () => { await completed; });
  expect(reads).toBe(2);
  expect(host.textContent).toBe('确认结果');
});

it('缓慢读取期间的下一项结果排队刷新，不取消读取且不遗漏新值', async () => {
  const first = pending<string>();
  let reads = 0;
  queryClient.setQueryData(['item', 1], '旧标题');
  function Item() {
    const item = useQuery({ queryKey: ['item', 1], queryFn: () => ++reads === 1 ? first.answer : Promise.resolve('最终标题') });
    return <p>{item.data}</p>;
  }
  const host = await mount(<QueryClientProvider client={queryClient}><Item /></QueryClientProvider>);
  const refresh = createResultRefresher();
  let completed: Promise<void>;
  await act(async () => {
    completed = refresh({ catalog: '1' }, { catalog: '2' });
    void refresh({ catalog: '2' }, { catalog: '3' });
  });
  expect(host.textContent).toBe('旧标题');
  await first.release('中间标题');
  await act(async () => { await completed!; });
  expect(reads).toBe(2);
  expect(host.textContent).toBe('最终标题');
});

it('入库通知：首轮只记基线；新到的逐部弹 toast 并可打开，一轮超过 3 部合成一条，服务重启后不补弹', async () => {
  const toaster = await import('../../src/react/toaster');
  const shown = vi.spyOn(toaster, 'showToast').mockImplementation(() => {});
  const go = vi.fn();
  const { announceIngests } = await import('../../src/react/result-updates');
  const notice = (id: number, kind: 'download' | 'discovered' = 'download', label = `SSIS-${id}`) =>
    ({ id, kind, asset_id: 100 + id, label, at: 0 });
  let seen = announceIngests(null, { epoch: 'a', items: [notice(1), notice(2)] }, go);
  expect(shown).not.toHaveBeenCalled();
  seen = announceIngests(seen, { epoch: 'a', items: [notice(1), notice(2), notice(3), notice(4, 'discovered', '<b>x</b>')] }, go);
  expect(shown.mock.calls.map(([, request]) => request.html)).toEqual(
    ['「SSIS-3」已入库并整理完成', '新文件已入库：「&#60;b&#62;x&#60;/b&#62;」']);
  shown.mock.calls[0]![1].action!.run(document.createElement('button'));
  expect(go).toHaveBeenCalledWith(103);
  shown.mockClear();
  seen = announceIngests(seen, { epoch: 'a', items: [5, 6, 7, 8].map(id => notice(id)) }, go);
  expect(shown.mock.calls.map(([, request]) => [request.html, request.action])).toEqual([['4 部作品已入库', null]]);
  shown.mockClear();
  announceIngests(seen, { epoch: 'b', items: [notice(1)] }, go);
  expect(shown).not.toHaveBeenCalled();
  shown.mockRestore();
});

it('设置里关掉入库通知时不弹，基线照样往前记；再打开只弹之后新到的', async () => {
  const toaster = await import('../../src/react/toaster');
  const shown = vi.spyOn(toaster, 'showToast').mockImplementation(() => {});
  const { appSettingsStore } = await import('../../src/appearance/settings');
  const settings = appSettingsStore();
  const notice = (id: number) => ({ id, kind: 'download' as const, asset_id: 100 + id, label: `SSIS-${id}`, at: 0 });
  const poll = (ids: number[]) => ({ result_versions: { catalog: '1' }, busy: false,
    ingest_notices: { epoch: 'a', items: ids.map(notice) } });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => poll([1]) })));
  settings.value.ingestNotices = false;
  try {
    await mount(<QueryClientProvider client={queryClient}><ResultUpdates openItem={vi.fn()} /></QueryClientProvider>);
    await settle();
    await act(async () => { queryClient.setQueryData(RESULT_UPDATES_KEY, poll([1, 2])) });
    expect(shown).not.toHaveBeenCalled();
    settings.value.ingestNotices = true;
    await act(async () => { queryClient.setQueryData(RESULT_UPDATES_KEY, poll([1, 2, 3])) });
    expect(shown.mock.calls.map(([, request]) => request.html)).toEqual(['「SSIS-3」已入库并整理完成']);
  } finally {
    settings.value.ingestNotices = true;
    shown.mockRestore();
  }
});
