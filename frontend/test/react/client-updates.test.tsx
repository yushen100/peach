import { act } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

import { ClientUpdateBanner, CLIENT_UPDATES_INTERVAL, PROGRESS_INTERVAL, RECOVERY_DELAYS, RELEASE_UPDATES_PATH,
  useClientUpdates, type ClientUpdates } from '../../src/react/client-updates';
import { SETTINGS_KEY } from '../../src/settings-key';
import { buttonNamed, click, linkNamed, mountRoot, pending, settle } from './render';

const current: ClientUpdates = {
  runtime: { version: '0.9.0', build_id: 'build-a' },
  release: { current_version: '0.9.0', latest_version: '0.9.0', channel: '测试版', installation: '独立测试包', installation_code: 'standalone',
    state: 'current', message: '已是最新测试版。', release_url: 'https://example.test/releases' },
  update_job: { state: 'idle', progress: 0 },
  userscript: { version: '0.8.0', minimum_version: '0.7.0', install_url: '/peach.user.js' },
  repairs: { state: 'ready', items: [] },
};

/* 横幅关掉的那个状态记在本机，换页刷新也算数；每条用例从没关过开始。 */
const DISMISSED_KEY = 'peach.client-update.dismissed.v1';
beforeEach(() => localStorage.removeItem(DISMISSED_KEY));

function available(version = '0.10.0'): ClientUpdates {
  return { ...current, release: { ...current.release, latest_version: version, state: 'available' } };
}

function response(body: ClientUpdates) {
  return { ok: true, json: async () => body };
}

function visible(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
}

async function render(initial = current, firstError = false, state: DocumentVisibilityState = 'visible') {
  vi.useFakeTimers();
  visible(state);
  const fetcher = vi.fn(async (_path: string, _init?: RequestInit) => response(initial));
  if (firstError) fetcher.mockRejectedValueOnce(new Error('连接失败'));
  vi.stubGlobal('fetch', fetcher);
  const slot = document.createElement('div');
  slot.setAttribute('data-network-banner', '');
  document.body.append(slot);
  const navigate = vi.fn();
  const root = await mountRoot(<ClientUpdateBanner navigate={navigate} />);
  await settle();
  return { ...root, slot, fetcher, navigate };
}

async function tick() {
  await act(async () => { await vi.advanceTimersByTimeAsync(CLIENT_UPDATES_INTERVAL); });
  await settle();
}

function seedRuntime() {
  const marker = document.createElement('script');
  marker.id = 'peach-client-runtime';
  marker.type = 'application/json';
  marker.textContent = JSON.stringify(current.runtime);
  document.body.append(marker);
}

it('后台首次打开的页面按文档标记识别升级，恢复可见后提示刷新', async () => {
  seedRuntime();
  const { slot, fetcher } = await render({ ...current, runtime: { ...current.runtime, build_id: 'build-b' } }, false, 'hidden');
  expect(fetcher).not.toHaveBeenCalled();
  visible('visible');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await settle();
  expect(slot.querySelector('[data-client-update="refresh"]')).not.toBeNull();
});

it('首次断连恢复后按文档标记提示刷新', async () => {
  seedRuntime();
  const { slot, fetcher } = await render(current, true);
  fetcher.mockResolvedValue(response({ ...current, runtime: { ...current.runtime, build_id: 'build-b' } }));
  await tick();
  expect(slot.querySelector('[data-client-update="refresh"]')).not.toBeNull();
});

it('首次读取只保存运行基线，发行版可更新时提供现有设置入口', async () => {
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  const { slot, fetcher, navigate } = await render(available());
  expect(slot.querySelector('[data-client-update]')?.getAttribute('data-client-update')).toBe('available');
  expect(slot.textContent).toContain('有可用更新。');
  expect(slot.textContent).toContain('Peach 0.10.0');
  expect(linkNamed('查看更新', slot)?.getAttribute('href')).toBe(RELEASE_UPDATES_PATH);
  await click(linkNamed('查看更新', slot));
  expect(navigate).toHaveBeenCalledWith(RELEASE_UPDATES_PATH);
  expect(fetcher.mock.calls.map(([path]) => path)).toEqual(['/api/client-updates']);
  expect(reload).not.toHaveBeenCalled();
});

it.each([
  { version: '0.10.0', build_id: 'build-a' },
  { version: '0.9.0', build_id: 'build-b' },
])('运行标记变为 %j 时等待用户点击刷新', async (runtime) => {
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  const { slot, fetcher } = await render();
  expect(slot.childElementCount).toBe(0);
  fetcher.mockResolvedValue(response({ ...current, runtime }));
  await tick();
  expect(slot.querySelector('[data-client-update="refresh"]')).not.toBeNull();
  expect(reload).not.toHaveBeenCalled();
  await click(buttonNamed('刷新页面', slot));
  expect(reload).toHaveBeenCalledTimes(1);
});

it('稍后隐藏相同更新，发行版本和准备状态变化时重新提示', async () => {
  const { slot, fetcher } = await render(available());
  await click(buttonNamed('稍后', slot));
  await tick();
  expect(slot.childElementCount).toBe(0);
  fetcher.mockResolvedValue(response(available('0.11.0')));
  await tick();
  expect(slot.textContent).toContain('Peach 0.11.0');
  await click(buttonNamed('稍后', slot));
  fetcher.mockResolvedValue(response({ ...available('0.11.0'), update_job: { state: 'ready', progress: 100, version: '0.11.0' } }));
  await tick();
  expect(slot.querySelector('[data-client-update="ready"]')).not.toBeNull();
  expect(slot.textContent).toContain('可重启安装');
});

it('同一版本关掉后重开页面也不再提示，出了新版本再提示', async () => {
  const first = await render(available());
  await click(buttonNamed('稍后', first.slot));
  await first.unmount();
  vi.useRealTimers();
  first.slot.remove();
  const again = await render(available());
  expect(again.slot.childElementCount).toBe(0);
  again.fetcher.mockResolvedValue(response(available('0.11.0')));
  await tick();
  expect(again.slot.textContent).toContain('Peach 0.11.0');
});

it('刷新提示稍后保持关闭，新运行标记重新提示', async () => {
  const { slot, fetcher } = await render();
  fetcher.mockResolvedValue(response({ ...current, runtime: { ...current.runtime, build_id: 'build-b' } }));
  await tick();
  await click(buttonNamed('稍后', slot));
  await tick();
  expect(slot.childElementCount).toBe(0);
  fetcher.mockResolvedValue(response({ ...current, runtime: { ...current.runtime, build_id: 'build-c' } }));
  await tick();
  expect(slot.querySelector('[data-client-update="refresh"]')).not.toBeNull();
});

it('后台失败保持安静并保留已取得的更新提示', async () => {
  const { slot, fetcher } = await render(available());
  fetcher.mockRejectedValue(new Error('连接失败'));
  await tick();
  expect(slot.textContent).toContain('有可用更新');
  expect(slot.querySelector('[role="alert"]')).toBeNull();
  expect(slot.textContent).not.toContain('已是最新');
});

it('未取得首次快照时不显示成功状态，恢复后建立运行基线', async () => {
  const { slot, fetcher } = await render(current, true);
  expect(slot.childElementCount).toBe(0);
  fetcher.mockResolvedValue(response({ ...current, runtime: { ...current.runtime, build_id: 'build-b' } }));
  await tick();
  expect(slot.childElementCount).toBe(0);
});

it('页面隐藏停止轮询，恢复可见立即读取且只请求本机快照', async () => {
  const { fetcher } = await render();
  visible('hidden');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await tick();
  expect(fetcher).toHaveBeenCalledTimes(1);
  visible('visible');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await settle();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([path]) => path === '/api/client-updates')).toBe(true);
});

it('横幅与设置页读同一份快照：只查一处，卸下一个另一个照常，全部卸下才停', async () => {
  const { slot, fetcher, unmount } = await render(available());
  function Reader() {
    const { snapshot } = useClientUpdates();
    return <p data-reader="">{snapshot?.release.latest_version}</p>;
  }
  const reader = await mountRoot(<Reader />);
  await settle();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(reader.host.textContent).toBe('0.10.0');
  await unmount();
  await tick();
  expect(fetcher).toHaveBeenCalledTimes(2);
  fetcher.mockResolvedValue(response(available('0.11.0')));
  await tick();
  expect(reader.host.textContent).toBe('0.11.0');
  await reader.unmount();
  await tick();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(slot.childElementCount).toBe(0);
});

it('卸载中止请求，迟到响应不再显示提示，监听和定时器释放', async () => {
  const { slot, fetcher, unmount } = await render();
  const late = pending<ReturnType<typeof response>>();
  fetcher.mockImplementation(async () => late.answer);
  visible('visible');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  const signal = fetcher.mock.calls.at(-1)?.[1]?.signal;
  expect(signal?.aborted).toBe(false);
  await unmount();
  expect(signal?.aborted).toBe(true);
  await late.release(response(available()));
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await tick();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(slot.childElementCount).toBe(0);
});

it('隐藏中止在途请求，恢复后忽略迟到快照并立即读取当前状态', async () => {
  const { slot, fetcher } = await render();
  const late = pending<ReturnType<typeof response>>();
  fetcher.mockImplementationOnce(async () => late.answer);
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  const signal = fetcher.mock.calls.at(-1)?.[1]?.signal;
  visible('hidden');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(signal?.aborted).toBe(true);
  await late.release(response(available()));
  expect(slot.childElementCount).toBe(0);
  visible('visible');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(slot.childElementCount).toBe(0);
});

it('更新进行中与迁移中不给收起，只有查看进度；准备好后才给稍后', async () => {
  const preparing = { ...available(), update_job: { state: 'downloading', progress: 10, version: '0.10.0' } };
  const { slot, fetcher } = await render(preparing);
  expect(linkNamed('查看进度', slot)).not.toBeNull();
  expect(buttonNamed('稍后', slot)).toBeNull();
  fetcher.mockResolvedValue(response({ ...preparing, update_job: { ...preparing.update_job, state: 'ready' } }));
  await tick();
  expect(slot.textContent).toContain('可重启安装');
  expect(buttonNamed('稍后', slot)).not.toBeNull();
});

it('迁移中不给收起', async () => {
  const { slot } = await render({ ...current, ledger_migration: { state: 'running', stage: 'apply' } });
  expect(slot.querySelector('[data-client-update="migrating"]')).not.toBeNull();
  expect(buttonNamed('稍后', slot)).toBeNull();
});

const migrating: ClientUpdates = { ...current, ledger_migration: { state: 'running' } };

async function advance(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
  await settle();
}

/** 没有确定百分比时横幅左侧是那一步的语义动画，不是信息图标。 */
const loading = (slot: Element) => !!slot.querySelector('aside [data-activity]') && !slot.querySelector('aside svg use[href="#i-info"]');
/** 那一枚语义动画是哪一种。 */
const activity = (slot: Element) => slot.querySelector('aside [data-activity]')?.getAttribute('data-activity') ?? null;
/** 有确定百分比时左侧是小环形进度，读屏值就是那个百分比；不同时出现 Loading Dots。 */
const ring = (slot: Element) => {
  const meter = slot.querySelector('aside [role="progressbar"]');
  return meter && !slot.querySelector('aside [data-activity]') ? Number(meter.getAttribute('aria-valuenow')) : null;
};

it('启动迁移期间显示正在更新本地数据库，迁移结束后换成刷新提示', async () => {
  seedRuntime();
  const { slot, fetcher } = await render(migrating);
  expect(slot.querySelector('[data-client-update="migrating"]')?.textContent).toContain('正在更新本地数据库。');
  expect(loading(slot)).toBe(true);
  expect(slot.textContent).not.toContain('Peach 0.9.0');
  expect(linkNamed('查看进度', slot)).toBeNull();
  fetcher.mockResolvedValue(response({ ...current, ledger_migration: { state: 'idle' } }));
  await advance(PROGRESS_INTERVAL);
  expect(slot.querySelector('[data-client-update="refresh"]')).not.toBeNull();
  expect(slot.textContent).toContain('Peach 已更新，刷新页面即可使用。');
  expect(loading(slot)).toBe(false);
});

it('启动迁移按阶段显示备份百分比与正在应用迁移，每 2 秒刷新一次', async () => {
  const { slot, fetcher } = await render({ ...current, ledger_migration: { state: 'running', stage: 'backup', progress: 0 } });
  const banner = () => slot.querySelector('[data-client-update="migrating"] [data-copy-key]')?.textContent;
  expect(banner()).toBe('正在更新本地数据库 · 备份 0%');
  expect(ring(slot)).toBe(0);
  fetcher.mockResolvedValue(response({ ...current, ledger_migration: { state: 'running', stage: 'backup', progress: 42 } }));
  await advance(PROGRESS_INTERVAL - 1);
  expect(banner()).toBe('正在更新本地数据库 · 备份 0%');
  await advance(1);
  expect(banner()).toBe('正在更新本地数据库 · 备份 42%');
  expect(ring(slot)).toBe(42);
  fetcher.mockResolvedValue(response({ ...current, ledger_migration: { state: 'running', stage: 'apply' } }));
  await advance(PROGRESS_INTERVAL);
  expect(banner()).toBe('正在更新本地数据库 · 正在应用迁移');
  expect(ring(slot)).toBeNull();
  expect(loading(slot)).toBe(true);
  expect(activity(slot), '应用迁移是整理').toBe('blocks');
});

it('没有百分比时按那一步的语义画：等服务回来是 Clock，下载还没总量是传输', async () => {
  const job = (state: string) => ({ ...available(), update_job: { state, version: '0.10.0' } }) as ClientUpdates;
  const { slot, fetcher } = await render(job('restarting'));
  expect(ring(slot)).toBeNull();
  expect(activity(slot)).toBe('clock');
  fetcher.mockResolvedValue(response(job('downloading')));
  await advance(PROGRESS_INTERVAL);
  expect(activity(slot)).toBe('linear-dots');
});

it('Windows 更新器迁移账本时显示当前步骤；安装阶段的数值只是里程碑，不报百分比', async () => {
  const { slot } = await render({ ...available(), update_job: { state: 'installing', progress: 10, version: '0.10.0',
    message: '正在更新本地数据库', message_code: 'jobMessage.standaloneUpdate.updatingDatabase' } });
  expect(slot.querySelector('[data-client-update="migrating"] [data-copy-key]')?.textContent).toBe('正在更新 Peach 0.10.0 · 正在更新本地数据库');
  expect(ring(slot)).toBeNull();
  expect(activity(slot), '迁移账本是整理').toBe('blocks');
});

it('重启服务时在等服务回来：不报百分比，画 Clock', async () => {
  const { slot } = await render({ ...available(), update_job: { state: 'restarting', progress: 100, version: '0.10.0',
    message: '正在保存任务', message_code: 'jobMessage.standaloneUpdate.savingTasks' } });
  expect(slot.querySelector('[data-client-update="preparing"] [data-copy-key]')?.textContent).not.toMatch(/%/);
  expect(ring(slot)).toBeNull();
  expect(activity(slot)).toBe('clock');
});

it('更新进行中显示当前步骤与百分比，换步骤时跟着刷新', async () => {
  const downloading = { ...available(), update_job: { state: 'downloading', progress: 42.4, version: '0.10.0',
    message: '正在下载', message_code: 'jobMessage.standaloneUpdate.downloading' } };
  const { slot, fetcher } = await render(downloading);
  const banner = () => slot.querySelector('[data-client-update="preparing"] [data-copy-key]')?.textContent;
  expect(banner()).toBe('正在更新 Peach 0.10.0 · 正在下载 42%');
  expect(ring(slot)).toBe(42);
  expect(linkNamed('查看进度', slot)).not.toBeNull();
  fetcher.mockResolvedValue(response({ ...downloading, update_job: { ...downloading.update_job, state: 'verifying', progress: 66,
    message: '正在校验', message_code: 'jobMessage.standaloneUpdate.verifying' } }));
  await advance(PROGRESS_INTERVAL);
  expect(banner()).toBe('正在更新 Peach 0.10.0 · 正在校验 66%');
  // 刚开始连接发布源时任务还没有版本号，发行版检查也没取得版本。
  fetcher.mockResolvedValue(response({ ...current, release: { ...current.release, latest_version: '' },
    update_job: { state: 'downloading', progress: 0, message: '正在连接发布源', message_code: 'jobMessage.standaloneUpdate.connecting' } }));
  await advance(PROGRESS_INTERVAL);
  expect(banner(), '还不知道包多大，不报 0%').toBe('正在更新 Peach · 正在连接发布源');
  expect(ring(slot)).toBeNull();
  expect(activity(slot)).toBe('linear-dots');
});

it('可更新与准备好时仍是信息图标，不显示加载动画', async () => {
  const { slot, fetcher } = await render(available());
  expect(slot.querySelector('aside svg use[href="#i-info"]')).not.toBeNull();
  expect(slot.querySelector('aside [data-activity]')).toBeNull();
  fetcher.mockResolvedValue(response({ ...available(), update_job: { state: 'ready', progress: 100, version: '0.10.0' } }));
  await tick();
  expect(slot.querySelector('[data-client-update="ready"] svg use[href="#i-info"]')).not.toBeNull();
  expect(slot.textContent).toContain('Peach 0.10.0');
});

it('迁移或更新进行中每 2 秒查一次，结束后回到每 2 分钟一次', async () => {
  const { fetcher } = await render({ ...available(), update_job: { state: 'downloading', progress: 10, version: '0.10.0' } });
  let calls = 1;
  for (let index = 0; index < 3; index += 1) {
    await advance(PROGRESS_INTERVAL - 1);
    expect(fetcher).toHaveBeenCalledTimes(calls);
    await advance(1);
    expect(fetcher).toHaveBeenCalledTimes(++calls);
  }
  fetcher.mockResolvedValue(response({ ...available(), update_job: { state: 'ready', progress: 100, version: '0.10.0' } }));
  await advance(PROGRESS_INTERVAL);
  expect(fetcher).toHaveBeenCalledTimes(++calls);
  await advance(CLIENT_UPDATES_INTERVAL - 1);
  expect(fetcher).toHaveBeenCalledTimes(calls);
  await advance(1);
  expect(fetcher).toHaveBeenCalledTimes(++calls);
});

it('页面隐藏时进行中的刷新也停，恢复可见立即读取', async () => {
  const { fetcher } = await render(migrating);
  visible('hidden');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await advance(PROGRESS_INTERVAL * 5);
  expect(fetcher).toHaveBeenCalledTimes(1);
  visible('visible');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await settle();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('连不上服务时按 2、4、8、16、30 秒退避，恢复后迁移中按 2 秒、结束回到每 2 分钟一次', async () => {
  const { fetcher } = await render(migrating);
  fetcher.mockRejectedValue(new TypeError('Failed to fetch'));
  await advance(PROGRESS_INTERVAL);
  let calls = 2;
  for (const delay of [...RECOVERY_DELAYS, 30_000]) {
    await advance(delay - 1);
    expect(fetcher).toHaveBeenCalledTimes(calls);
    await advance(1);
    expect(fetcher).toHaveBeenCalledTimes(++calls);
  }
  // 退避期间的检查事件不插队。
  await act(async () => { document.dispatchEvent(new Event('peach:client-updates')); });
  expect(fetcher).toHaveBeenCalledTimes(calls);
  fetcher.mockResolvedValue(response(migrating));
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(++calls);
  fetcher.mockResolvedValue(response(current));
  await advance(PROGRESS_INTERVAL);
  expect(fetcher).toHaveBeenCalledTimes(++calls);
  await advance(CLIENT_UPDATES_INTERVAL - 1);
  expect(fetcher).toHaveBeenCalledTimes(calls);
  await advance(1);
  expect(fetcher).toHaveBeenCalledTimes(++calls);
});

it('检查事件立即查一次，同一时刻只有一个检查在飞，迁移进行中的事件不插队', async () => {
  const { fetcher } = await render();
  const late = pending<ReturnType<typeof response>>();
  fetcher.mockImplementationOnce(async () => late.answer);
  await act(async () => { for (let index = 0; index < 3; index += 1) document.dispatchEvent(new Event('peach:client-updates')); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  await late.release(response(migrating));
  await settle();
  await act(async () => { document.dispatchEvent(new Event('peach:client-updates')); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  await advance(PROGRESS_INTERVAL);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('两个取数入口遇到迁移的 503 或连不上服务时派发检查事件，别的失败与中止不派发', async () => {
  const [{ apiGet, apiSend }, { api }] = await Promise.all([import('../../src/api'), import('../../src/core')]);
  const heard = vi.fn();
  document.addEventListener('peach:client-updates', heard);
  const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' } }));
  try {
    vi.stubGlobal('fetch', answer(503, { error: '正在更新本地数据库，完成后刷新页面即可使用。', message_code: 'api.ledger.migrating' }));
    await expect(apiGet('/api/items')).rejects.toThrow('正在更新本地数据库');
    await expect(apiSend('/api/items', {})).rejects.toThrow();
    await expect(api('/api/items')).rejects.toThrow();
    expect(heard).toHaveBeenCalledTimes(3);
    vi.stubGlobal('fetch', answer(503, { error: '别的原因', message_code: 'http.serverError' }));
    await expect(apiGet('/api/items')).rejects.toThrow();
    expect(heard).toHaveBeenCalledTimes(3);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(apiGet('/api/items')).rejects.toThrow();
    await expect(api('/api/items')).rejects.toThrow();
    expect(heard).toHaveBeenCalledTimes(5);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError'); }));
    await expect(apiGet('/api/items')).rejects.toThrow();
    await expect(api('/api/items')).rejects.toThrow();
    expect(heard).toHaveBeenCalledTimes(5);
  } finally {
    document.removeEventListener('peach:client-updates', heard);
    vi.unstubAllGlobals();
  }
});

it('英文界面显示英文的迁移与更新进度', async () => {
  vi.resetModules();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ interfaceLanguage: 'en' }));
  try {
    const { ClientUpdateBanner: Banner } = await import('../../src/react/client-updates');
    vi.useFakeTimers();
    visible('visible');
    // 先看更新进行中：页面一旦见过迁移，迁移结束后就只提示刷新。
    const fetcher = vi.fn(async () => response({ ...available(), update_job: { state: 'extracting', progress: 70, version: '0.10.0',
      message: '正在解压', message_code: 'jobMessage.standaloneUpdate.extracting' } }));
    vi.stubGlobal('fetch', fetcher);
    const slot = document.createElement('div');
    slot.setAttribute('data-network-banner', '');
    document.body.append(slot);
    await mountRoot(<Banner navigate={vi.fn()} />);
    await settle();
    const banner = () => slot.querySelector('[data-client-update] [data-copy-key]')?.textContent;
    expect(banner()).toBe('Updating to Peach 0.10.0 · Extracting 70%');
    expect(buttonNamed('Later', slot)).toBeNull();
    expect(linkNamed('View progress', slot)).not.toBeNull();
    const steps: [ClientUpdates, string][] = [
      [migrating, 'Updating the local database.'],
      [{ ...current, ledger_migration: { state: 'running', stage: 'backup', progress: 37 } }, 'Updating the local database · Backing up 37%'],
      [{ ...current, ledger_migration: { state: 'running', stage: 'apply' } }, 'Updating the local database · Applying migrations'],
    ];
    for (const [snapshot, text] of steps) {
      fetcher.mockResolvedValue(response(snapshot));
      await advance(PROGRESS_INTERVAL);
      expect(banner()).toBe(text);
    }
  } finally {
    localStorage.removeItem(SETTINGS_KEY);
    vi.resetModules();
  }
});
