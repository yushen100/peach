import { QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

import { queryClient } from '../../src/react/query';
import { RetentionSettings } from '../../src/react/settings/retention-settings';
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

it('保留期限读出本机档位，改一项只送这一项', async () => {
  const sent = serve({ backup_keep: 5, log_days: 183 });
  const receipt = vi.fn();
  const host = await mount(<QueryClientProvider client={queryClient}><RetentionSettings receipt={receipt} /></QueryClientProvider>);
  await settle();
  expect(host.querySelector('#backupKeepSetting button')?.textContent).toContain('5 份');
  expect(host.querySelector('#logDaysSetting button')?.textContent).toContain('半年');
  await choose(host.querySelector('#logDaysSetting button'), '30 天');
  await settle();
  expect(sent).toEqual([{ url: '/api/configuration/retention', body: { log_days: 30 } }]);
  expect(receipt).toHaveBeenCalledWith('已保存配置');
  expect(host.querySelector('#logDaysSetting button')?.textContent).toContain('30 天');
});
