/* 外网横幅只在服务端确认连不上时出现，画进壳给的节点，恢复联网后消失。 */
import { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

import { NETWORK_STATUS_KEY, NetworkBanner, networkPollInterval } from '../../src/react/network-banner';
import { queryClient } from '../../src/react/query';
import { buttonNamed, click, mount, settle } from './render';

afterEach(() => queryClient.clear());
notifyManager.setScheduler((notify) => notify());

function answer(state: string) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ state, checked_at: 1 }) })));
}

async function render() {
  const slot = document.createElement('div');
  slot.setAttribute('data-network-banner', '');
  document.body.append(slot);
  await mount(<QueryClientProvider client={queryClient}><NetworkBanner /></QueryClientProvider>);
  await settle();
  return slot;
}

it('服务端确认断网时在壳节点里画出横幅与代理设置入口', async () => {
  answer('offline');
  const slot = await render();
  const banner = slot.querySelector('[data-network-offline]');
  expect(banner?.getAttribute('role')).toBe('status');
  expect(banner?.querySelector('a')?.getAttribute('href')).toBe('/settings/network#peachProxy');
});

it.each(['online', 'checking', 'unknown'])('%s 时不画横幅', async (state) => {
  answer(state);
  const slot = await render();
  expect(slot.childElementCount).toBe(0);
});

it('恢复联网后横幅消失', async () => {
  answer('offline');
  const slot = await render();
  expect(slot.querySelector('[data-network-offline]')).not.toBeNull();
  answer('online');
  await queryClient.refetchQueries({ queryKey: NETWORK_STATUS_KEY });
  await settle();
  expect(slot.childElementCount).toBe(0);
});

it('关掉只管这一段断网：复查仍是断网不再出现，恢复联网后再断才重新出现', async () => {
  answer('offline');
  const slot = await render();
  await click(buttonNamed('关闭', slot));
  expect(slot.childElementCount).toBe(0);
  await queryClient.refetchQueries({ queryKey: NETWORK_STATUS_KEY });
  await settle();
  expect(slot.childElementCount).toBe(0);
  for (const state of ['online', 'offline']) {
    answer(state);
    await queryClient.refetchQueries({ queryKey: NETWORK_STATUS_KEY });
    await settle();
  }
  expect(slot.querySelector('[data-network-offline]')).not.toBeNull();
});

it('按快照时刻加服务端的复查间隔算下一次，快照过期未到时退回短间隔', () => {
  const now = 1_000_000_000;
  const at = (secondsAgo: number) => now / 1000 - secondsAgo;
  // 联网十分钟一次：一分钟前的快照要再等九分钟，加上探测本身的几秒。
  expect(networkPollInterval({ state: 'online', checked_at: at(60) }, now)).toBe(545_000);
  // 断网一分钟一次。
  expect(networkPollInterval({ state: 'offline', checked_at: at(20) }, now)).toBe(45_000);
  // 该到的下一份还没到（探测在跑、或两边时钟对不上），按原来的短间隔读。
  expect(networkPollInterval({ state: 'online', checked_at: at(700) }, now)).toBe(120_000);
  expect(networkPollInterval({ state: 'offline', checked_at: at(90) }, now)).toBe(30_000);
  // 服务端时钟在前：最多等一个复查间隔。
  expect(networkPollInterval({ state: 'online', checked_at: at(-3600) }, now)).toBe(605_000);
  expect(networkPollInterval({ state: 'checking', checked_at: null }, now)).toBe(30_000);
  expect(networkPollInterval(undefined, now)).toBe(30_000);
});

it('读失败按退避重试，成功一次回到快照节律', async () => {
  vi.useFakeTimers({ now: 1_000_000_000 });
  let fail = true;
  const fetcher = vi.fn(async () => (fail ? { ok: false, status: 503, json: async () => ({}) }
    : { ok: true, json: async () => ({ state: 'online', checked_at: 1_000_000 }) }));
  vi.stubGlobal('fetch', fetcher);
  await render();
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(4_000) });
  expect(fetcher, '第一次失败后 4 秒重读').toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(8_000) });
  expect(fetcher, '第二次失败后 8 秒').toHaveBeenCalledTimes(3);
  fail = false;
  await act(async () => { await vi.advanceTimersByTimeAsync(16_000) });
  expect(fetcher, '第三次失败后 16 秒，这次读到了').toHaveBeenCalledTimes(4);
  await act(async () => { await vi.advanceTimersByTimeAsync(600_000) });
  expect(fetcher, '恢复后按十分钟的快照节律读').toHaveBeenCalledTimes(5);
  vi.useRealTimers();
});
