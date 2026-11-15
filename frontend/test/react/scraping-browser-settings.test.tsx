import { QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

import { queryClient } from '../../src/react/query';
import { ScrapingBrowserSettings } from '../../src/react/settings/scraping-browser-settings';
import { choose, mount, settle } from './render';

notifyManager.setScheduler((notify) => notify());
afterEach(() => queryClient.clear());

it('后台采集浏览器默认保留窗口，改成无窗口写进采集设置', async () => {
  const state: Record<string, unknown> = { sources: [], browser_mode: 'window' };
  const sent: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      sent.push({ url, body });
      Object.assign(state, body);
      return { ok: true, json: async () => ({ ok: true, browser_mode: state.browser_mode }) };
    }
    return { ok: true, json: async () => ({ ...state }) };
  }));
  const receipt = vi.fn();
  const host = await mount(<QueryClientProvider client={queryClient}><ScrapingBrowserSettings receipt={receipt} /></QueryClientProvider>);
  await settle();
  expect(host.querySelector('#scrapingBrowserModeSetting button')?.textContent).toContain('保留窗口');
  await choose(host.querySelector('#scrapingBrowserModeSetting button'), '无窗口');
  await settle();
  expect(sent).toEqual([{ url: '/api/scraping/settings', body: { browser_mode: 'headless' } }]);
  expect(host.querySelector('#scrapingBrowserModeSetting button')?.textContent).toContain('无窗口');
  expect(receipt).toHaveBeenCalled();
});
