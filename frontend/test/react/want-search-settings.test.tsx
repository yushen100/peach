import { QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

import { queryClient } from '../../src/react/query';
import { WantSearchSettings } from '../../src/react/settings/want-search-settings';
import { choose, mount, settle } from './render';

notifyManager.setScheduler((notify) => notify());
afterEach(() => queryClient.clear());

function serve(initial: Record<string, unknown>) {
  const sent: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      sent.push({ url, body });
      Object.assign(initial, body);
    }
    return { ok: true, json: async () => ({ ...initial }) };
  }));
  return sent;
}

it('想要查资源的两项写进跟账本走的设置，0 次显示为一直查', async () => {
  const sent = serve({ wantStaleSearchDays: 7, wantStaleAttemptLimit: 3 });
  const host = await mount(<QueryClientProvider client={queryClient}><WantSearchSettings receipt={vi.fn()} /></QueryClientProvider>);
  await settle();
  expect(host.querySelector('#wantStaleSearchDaysSetting button')?.textContent).toContain('每 7 天');
  await choose(host.querySelector('#wantStaleAttemptLimitSetting button'), '一直查');
  await settle();
  expect(sent).toEqual([{ url: '/api/settings', body: { wantStaleAttemptLimit: 0 } }]);
  expect(host.querySelector('#wantStaleAttemptLimitSetting button')?.textContent).toContain('一直查');
});
