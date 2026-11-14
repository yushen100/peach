import { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

import { appSettingsStore } from '../../src/appearance/settings';
import { queryClient } from '../../src/react/query';
import { FollowPreferenceRows, VideoThumbnailRow, TaskSpeedSettings } from '../../src/react/settings/service-preferences';
import { configurationContentSkeleton } from '../../src/configuration-skeleton';
import { buttonNamed, choose, click, mount, mountRoot, pending, settle, type } from './render';

notifyManager.setScheduler((notify) => notify());

afterEach(() => { queryClient.clear(); localStorage.removeItem('peach.number.followScheduleSetting') });

function server() {
  const settings = { followInitialDays: 30, avatarRefreshDays: 90, faviconRefreshDays: 365 };
  const schedule: Record<string, unknown> = { available: true, enabled: true, interval_minutes: 180 };
  const feedSchedule: Record<string, unknown> = { available: true, enabled: true, interval_minutes: 360 };
  const thumbnails = { mode: 'precise', status: 'idle' };
  const routes: Record<string, object> = {
    '/api/settings': settings, '/api/follow/schedule': schedule,
    '/api/feeds/schedule': feedSchedule, '/api/thumbnail-jobs': thumbnails,
  };
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    // 「立即重试」回来的是同一份调度状态，服务端已把它标成运行中。
    const rerun = url.endsWith('/run');
    const data = routes[rerun ? url.slice(0, -'/run'.length) : url];
    if (!data) throw new Error(`没有登记的地址：${url}`);
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      posts.push({ url, body });
      Object.assign(data, rerun ? { running: true, last_error: null } : body);
    }
    return { ok: true, status: 200, json: async () => ({ ...data }) };
  }));
  return { posts, settings, schedule, feedSchedule, thumbnails };
}

const mountFollowRows = async () => {
  const host = await mount(<QueryClientProvider client={queryClient}><FollowPreferenceRows receipt={vi.fn()} /></QueryClientProvider>);
  await settle();
  return host;
};

it('默认任务档位通过共享设置保存，并显示保存回执', async () => {
  const { posts } = server();
  const receipt = vi.fn();
  const host = await mount(<QueryClientProvider client={queryClient}><TaskSpeedSettings receipt={receipt} /></QueryClientProvider>);
  await settle();
  await click(buttonNamed('标准', host));
  const slider = document.querySelector('input[type="range"]')!;
  await act(async () => {
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    slider.dispatchEvent(new KeyboardEvent('keyup', { key: 'Home', bubbles: true }));
  });
  await vi.waitFor(() => expect(buttonNamed('低占用', host)).not.toBeNull());
  expect(posts).toEqual([{ url: '/api/settings', body: { taskSpeedMode: 'low' } }]);
  expect(receipt).toHaveBeenCalledWith('已保存默认处理速度');
});

it('订阅源拉取读出间隔，没有失败时两个调度都不出提示', async () => {
  server();
  const host = await mountFollowRows();
  expect(host.textContent).toContain('订阅源拉取');
  expect(host.querySelector<HTMLInputElement>('input[aria-label="订阅源拉取间隔"]')?.value).toBe('360');
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it('订阅源拉取可以改间隔、关掉再打开，关掉时记住原来的间隔', async () => {
  const { posts } = server();
  const host = await mountFollowRows();
  const input = host.querySelector<HTMLInputElement>('input[aria-label="订阅源拉取间隔"]')!;
  await type(input, '720');
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await settle();
  await click(host.querySelector('#feedScheduleSetting input[role="switch"]'));
  await settle();
  expect(host.querySelector('input[aria-label="订阅源拉取间隔"]')).toBeNull();
  await click(host.querySelector('#feedScheduleSetting input[role="switch"]'));
  await settle();
  expect(posts).toEqual([
    { url: '/api/feeds/schedule', body: { enabled: true, interval_minutes: 720 } },
    { url: '/api/feeds/schedule', body: { enabled: false, interval_minutes: 360 } },
    { url: '/api/feeds/schedule', body: { enabled: true, interval_minutes: 720 } },
  ]);
  localStorage.removeItem('peach.number.feedScheduleSetting');
});

it('关注检查失败时在它那一行下面写出原因与连续失败次数', async () => {
  const { schedule } = server();
  Object.assign(schedule, { last_error: '3 个来源检查失败', consecutive_failures: 2 });
  const host = await mountFollowRows();
  const alerts = [...host.querySelectorAll('[role="alert"]')].map((node) => node.textContent);
  expect(alerts).toHaveLength(1);
  expect(alerts[0]).toContain('上次自动检查失败');
  expect(alerts[0]).toContain('3 个来源检查失败');
  expect(alerts[0]).toContain('已连续失败 2 次');
});

it('订阅源拉取失败时写出原因；正在跑的一轮与关闭的调度不显示旧原因', async () => {
  const { schedule, feedSchedule } = server();
  Object.assign(feedSchedule, { last_error: 'JavDB 返回 429', consecutive_failures: 1 });
  const failing = await mountFollowRows();
  const alerts = [...failing.querySelectorAll('[role="alert"]')].map((node) => node.textContent);
  expect(alerts).toHaveLength(1);
  expect(alerts[0]).toContain('上次自动拉取失败');
  expect(alerts[0]).toContain('JavDB 返回 429');
  expect(alerts[0]).not.toContain('连续失败');
  queryClient.clear();

  Object.assign(schedule, { last_error: '1 个来源检查失败', running: true });
  Object.assign(feedSchedule, { enabled: false });
  const quiet = await mountFollowRows();
  expect(quiet.querySelector('[role="alert"]')).toBeNull();
  expect(quiet.querySelector<HTMLInputElement>('#feedScheduleSetting input[role="switch"]')?.checked).toBe(false);
});

it.each([
  ['follow', '/api/follow/schedule/run', '正在检查来源更新'],
  ['feed', '/api/feeds/schedule/run', '正在拉取订阅源'],
] as const)('%s 调度失败后立即重试走调度自己的重跑接口，跑起来后原因收起', async (kind, url, running) => {
  const { posts, schedule, feedSchedule } = server();
  Object.assign(kind === 'follow' ? schedule : feedSchedule, { last_error: '上游断了', consecutive_failures: 1 });
  const host = await mountFollowRows();
  await click(buttonNamed('立即重试', host.querySelector('[role="alert"]')!));
  await settle();
  expect(posts).toEqual([{ url, body: {} }]);
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toContain(running);
});

it('首次采集范围写入服务端，头像和 favicon 使用固定刷新周期', async () => {
  const { posts } = server();
  const receipt = vi.fn();
  const host = await mount(<QueryClientProvider client={queryClient}><FollowPreferenceRows receipt={receipt} /></QueryClientProvider>);
  await settle();
  await choose(host.querySelector('#followInitialDaysSetting [aria-haspopup="listbox"]'), '最近 7 天');
  await settle();
  expect(host.textContent).toContain('每 3 个月');
  expect(host.textContent).toContain('每年');
  expect(posts).toEqual([
    { url: '/api/settings', body: { followInitialDays: 7 } },
  ]);
  expect(appSettingsStore().value.followInitialDays).toBe(7);
  expect(receipt.mock.calls).toEqual([['已保存首次采集范围']]);
});

it('缩略图选择提交原档位，保存后的控件显示采集间隔', async () => {
  const { posts } = server();
  const host = await mount(<QueryClientProvider client={queryClient}><VideoThumbnailRow /></QueryClientProvider>);
  await settle();
  await choose(host.querySelector('[aria-haspopup="listbox"]'), '每 30 秒一张');
  await settle();
  expect(posts).toEqual([{ url: '/api/thumbnail-jobs', body: { mode: 'coarse' } }]);
  expect(host.querySelector('[aria-haspopup="listbox"]')?.textContent).toContain('每 30 秒一张');
});

it('自动检查间隔拒绝范围外值，只在有效提交时写入原接口', async () => {
  const { posts } = server();
  const host = await mount(<QueryClientProvider client={queryClient}><FollowPreferenceRows receipt={vi.fn()} /></QueryClientProvider>);
  await settle();
  const input = host.querySelector<HTMLInputElement>('input[aria-label="自动检查间隔"]')!;
  await type(input, '2');
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(posts).toEqual([]);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('15–10080');
  await type(input, '240');
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await settle();
  expect(posts).toEqual([{ url: '/api/follow/schedule', body: { enabled: true, interval_minutes: 240 } }]);
});

it('服务设置重新进入时读取最新状态，关闭自动检查后保留间隔', async () => {
  const { posts, settings, thumbnails } = server();
  const view = () => <QueryClientProvider client={queryClient}>
    <FollowPreferenceRows receipt={vi.fn()} /><VideoThumbnailRow />
  </QueryClientProvider>;
  const first = await mountRoot(view());
  await settle();
  await click(first.host.querySelector('input[role="switch"]'));
  await settle();
  expect(localStorage.getItem('peach.number.followScheduleSetting')).toBe('180');
  await first.unmount();
  settings.followInitialDays = 7;
  thumbnails.mode = 'coarse';
  const second = await mount(view());
  await settle();
  expect(second.querySelector('#followInitialDaysSetting [aria-haspopup="listbox"]')?.textContent).toContain('最近 7 天');
  expect(second.textContent).toContain('每 3 个月');
  expect(second.querySelector('#videoThumbnailSetting [aria-haspopup="listbox"]')?.textContent).toContain('每 30 秒一张');
  expect(second.querySelector<HTMLInputElement>('input[role="switch"]')?.checked).toBe(false);
  await click(second.querySelector('input[role="switch"]'));
  await settle();
  expect(posts).toEqual([
    { url: '/api/follow/schedule', body: { enabled: false, interval_minutes: 60 } },
    { url: '/api/follow/schedule', body: { enabled: true, interval_minutes: 180 } },
  ]);
  expect(second.querySelector<HTMLInputElement>('input[aria-label="自动检查间隔"]')?.value).toBe('180');
});

it('首次读取时「关注采集」就是五行，与配置页整页骨架同一组行；读回之后行数不变', async () => {
  const hold = pending<unknown>();
  vi.stubGlobal('fetch', vi.fn(() => hold.answer));
  const host = await mount(<QueryClientProvider client={queryClient}><FollowPreferenceRows receipt={vi.fn()} /></QueryClientProvider>);
  const labels = (root: ParentNode) => [...root.querySelectorAll('section[aria-label="关注采集"] p.text-body-regular')].map((node) => node.textContent);
  const page = document.createElement('div');
  page.innerHTML = configurationContentSkeleton('来源与订阅');
  const waiting = labels(host);
  expect(waiting).toEqual(['自动检查更新', '订阅源拉取', '首次采集范围', '头像刷新', 'favicon 刷新']);
  expect(labels(page), '整页骨架画的也是这五行').toEqual(waiting);
  expect(host.querySelector<HTMLInputElement>('#feedScheduleSetting input[role="switch"]')?.disabled).toBe(true);
  server();
  await hold.release({ ok: true, status: 200, json: async () => ({ available: true, enabled: true, interval_minutes: 360 }) });
  await settle();
  expect(labels(host)).toEqual(waiting);
});
