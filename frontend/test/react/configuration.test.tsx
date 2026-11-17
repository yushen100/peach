import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../src/react/settings/cloud-proxy-settings', () => ({ CloudProxySettings: () => null }));
import { CONFIGURATION_URL } from '../../src/configuration-endpoints';
import type { ConfigurationData, DownloadSettingsState } from '../../src/react/bundle';
import { queryClient } from '../../src/react/query';
import { CONFIGURATION_KEY, prefetchConfiguration } from '../../src/react/settings/configuration';
import { ConfigurationPage } from '../../src/react/settings/configuration-page';
import type { CredentialData } from '../../src/react/follow-manage/follow-manage';
import { buttonNamed, click, mount, section, settle, type } from './render';

afterEach(() => queryClient.clear());
notifyManager.setScheduler(notify => notify());
const data = (over: Partial<ConfigurationData> = {}): ConfigurationData => ({
  editable: true, notice: '', revision: 'rev-1', media_dirs: ['D:\\Media'], library_count: 1,
  port: 9123, facts: [], ...over,
});
const downloads: DownloadSettingsState = {
  media_sources: ['115', 'pikpak'],
  available: true, config: { clouddrive_address: '', targets: {}, pikpak_root: '', wait_hours: 168 },
  token_set: false, pikpak: { logged_in: false, username: '', remember: false, method: 'password' },
  pikpak_browser: { available: true, state: 'idle', message: '' }, pikpak_roots: [],
  providers: [{ key: '115', label: '115' }, { key: 'pikpak', label: 'PikPak' }], max_wait_hours: 1440,
};
const full = () => data({ downloads, startup: {
  available: true, enabled: false, silent: true, desktop: false, desktop_message: '', message: '',
}, peach_proxy: { mode: 'environment', proxy_saved: false, needs_selection: false },
  entry_links: { sites: [{ key: 'javdb', label: 'JavDB', host: '', default_host: 'javdb.com' }] },
});
const names = ['媒体库与入库', '来源与订阅', '下载渠道', '网络与访问', '应用与维护', '系统诊断'];
function serve(config: ConfigurationData, credentials: CredentialData = { root: '', providers: [] }) {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => {
    if (url === CONFIGURATION_URL) return config;
    if (url === '/api/configuration/seed-sharing') return { enabled: false, available: false, schema: 1, last_attempt: {} };
    if (url === '/api/configuration/indexers') return { indexers: [], max_indexers: 4 };
    if (url === '/api/configuration/jav-browser') return { enabled: false, provider: '115', available: true,
      providers: [{ key: '115', label: '115', configured: true, target: '/115/Movies' }] };
    if (url === '/api/follow/credentials') return credentials;
    if (url === '/api/settings') return { followInitialDays: 30, metadataRefreshDays: 30 };
    if (url === '/api/follow/schedule') return { enabled: false, available: true, interval_minutes: 60 };
    return { mode: 'off', status: 'idle' };
  } }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
async function open(config = full(), selected?: string, credentials?: CredentialData) {
  serve(config, credentials);
  await prefetchConfiguration(new AbortController().signal);
  return mount(<QueryClientProvider client={queryClient}>
    <ConfigurationPage receipt={vi.fn()} reopenTutorial={vi.fn()} section={selected} />
  </QueryClientProvider>);
}
const tabs = (host: ParentNode) => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const chosen = (host: ParentNode) => tabs(host).find(tab => tab.getAttribute('aria-selected') === 'true')!;
const press = (target: Element, key: string) => act(async () => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
});

it('Peach 配置按用途分类，媒体库与入库默认打开，各分类关联独立面板', async () => {
  const host = await open();
  expect(tabs(host).map(tab => tab.textContent)).toEqual(names);
  expect(chosen(host).textContent).toBe(names[0]);
  for (const tab of tabs(host)) {
    const panel = host.querySelector(`#${tab.getAttribute('aria-controls')}`)!;
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
  }
  expect(host.querySelector('#configPort')?.closest('[role="tabpanel"]')?.getAttribute('aria-labelledby'))
    .toBe(tabs(host)[3]!.id);
  expect(host.querySelector('#entry-link-javdb')?.closest('[role="tabpanel"]')?.getAttribute('aria-labelledby'))
    .toBe(tabs(host)[1]!.id);
});
it('方向键首尾循环，Home 与 End 选择两端并同步焦点', async () => {
  const host = await open();
  chosen(host).focus();
  await press(chosen(host), 'ArrowUp');
  expect(chosen(host).textContent).toBe('系统诊断');
  expect(document.activeElement).toBe(chosen(host));
  await press(chosen(host), 'ArrowDown');
  expect(chosen(host).textContent).toBe('媒体库与入库');
  await press(chosen(host), 'End');
  expect(chosen(host).textContent).toBe('系统诊断');
  await press(chosen(host), 'Home');
  expect(chosen(host).textContent).toBe('媒体库与入库');
  expect(tabs(host).map(tab => tab.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
});
it('分区深链打开来源与订阅，切换分类保留未保存字段', async () => {
  const host = await open(full(), '来源与订阅');
  expect(chosen(host).textContent).toBe('来源与订阅');
  await type(host.querySelector<HTMLInputElement>('#entry-link-javdb'), 'example.invalid');
  await click(tabs(host)[0]);
  await click(tabs(host)[1]);
  expect(host.querySelector<HTMLInputElement>('#entry-link-javdb')?.value).toBe('example.invalid');
  await act(async () => { queryClient.setQueryData(CONFIGURATION_KEY, { ...full(), revision: 'rev-2' }) });
  expect(chosen(host).textContent).toBe('来源与订阅');
});
it.each([false, true])('来源凭据依据数据库只读状态 %s 控制写入', async (readOnly) => {
  const host = await open(data({ ledger_read_only: readOnly }), '来源与订阅', { root: '', providers: [{
    provider: 'test', provider_label: '测试来源', followable: true, requirement: 'required',
    needs: ['cookie'], fields: [], missing: ['cookie'],
  }] });
  await settle();
  expect(host.querySelector<HTMLInputElement>('input[type="password"]')?.disabled).toBe(readOnly);
  expect(buttonNamed('保存配置', host.querySelector('[aria-label="可配置凭据"]')!)?.disabled).toBe(readOnly);
});
it('未知分区回到媒体库，未提供下载渠道时省略对应分类', async () => {
  const host = await open(data({ editable: false }), '不存在');
  expect(tabs(host).map(tab => tab.textContent)).toEqual(['媒体库与入库', '来源与订阅', '应用与维护', '系统诊断']);
  expect(chosen(host).textContent).toBe('媒体库与入库');
});
it('配置读取失败显示服务端原因', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ message: '数据库正在迁移' }) })));
  const host = await mount(<QueryClientProvider client={queryClient}>
    <ConfigurationPage receipt={vi.fn()} reopenTutorial={vi.fn()} />
  </QueryClientProvider>);
  await settle();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('数据库正在迁移');
  expect(host.querySelector('[role="tablist"]')).toBeNull();
});
it('挂载状态只跟随已保存路径，修改文件夹时撤下读数', async () => {
  const host = await open(data({ windows: true, media_sources: [{ location: '115', path: 'B:/', root: 'B:/', online: false }] }));
  const row = host.querySelector('[data-folder-row]')!;
  expect(row.querySelector('[data-mount="offline"]')?.textContent).toBe('离线');
  await type(row.querySelector<HTMLInputElement>('input[aria-label^="媒体目录 "]'), 'B:/Movies');
  expect(row.querySelector('[data-mount]')).toBeNull();
});
it('网盘检测超时的挂载（快照里是 null）显示未检测，不当离线', async () => {
  const host = await open(data({ windows: true, media_sources: [{ location: '115', path: 'B:/', root: 'B:/', online: null }] }));
  const badge = host.querySelector('[data-folder-row] [data-mount]');
  expect([badge?.getAttribute('data-mount'), badge?.textContent]).toEqual(['unknown', '未检测']);
});
it('非 Windows 文件夹只展示媒体目录，提交时保留已有路径对应关系', async () => {
  const host = await open(data({ windows: false,
    media_sources: [{ location: 'local', path: '/old', root: 'R:\\media', library: '电影', cost: 'free' }] }));
  const row = host.querySelector('[data-folder-row]')!;
  expect(row.querySelector('details')).toBeNull();
  expect(row.querySelector('input[placeholder="自动配置"]')).toBeNull();
  await type(row.querySelector<HTMLInputElement>('input[aria-label^="媒体目录 "]'), '/new');
  await click(buttonNamed('保存配置', row.closest('form')!));
});
it('只读媒体配置可刷新挂载状态，更新共用配置快照', async () => {
  const offline = { location: '115', path: 'B:/', root: 'B:/', online: false };
  const host = await open(data({ editable: false, notice: '只在本机可改', media_sources: [offline] }));
  serve(data({ editable: false, notice: '只在本机可改', media_sources: [{ ...offline, online: true }], revision: 'rev-2' }));
  await click(buttonNamed('刷新挂载状态', host));
  await settle();
  expect(section(host, '挂载状态')?.textContent).toContain('在线');
  expect(queryClient.getQueryData<ConfigurationData>(CONFIGURATION_KEY)?.revision).toBe('rev-2');
});

it('下载设置未取得时保留分区与健康表单，并可重试恢复', async () => {
  const partial = full();
  delete partial.downloads;
  partial.section_errors = { downloads: { title: '下载设置未取得', message: '请重新读取。', error_id: 'test-error-id' } };
  const host = await open(partial, '下载渠道');
  expect(tabs(host).map(tab => tab.textContent)).toEqual(names);
  expect(chosen(host).textContent).toBe('下载渠道');
  expect(host.querySelector('.ui-board-group-active')?.textContent).toContain('下载设置未取得');
  expect(host.querySelector('[data-folder-row]')).not.toBeNull();
  serve(full());
  await click(buttonNamed('重新读取', host.querySelector('.ui-board-group-active')!));
  await settle();
  expect(host.textContent).not.toContain('下载设置未取得');
  expect(section(host, '云下载')).not.toBeNull();
});

it('局部配置错误出现在对应分区且不替换其他未保存输入', async () => {
  const host = await open(full());
  const input = host.querySelector<HTMLInputElement>('input[aria-label^="媒体目录 "]')!;
  await type(input, 'D:\\Edited');
  await act(async () => {
    queryClient.setQueryData(CONFIGURATION_KEY, { ...full(), section_errors: {
      storage: { title: '存储空间未取得', message: '请重新读取。', error_id: 'storage-error' },
      tunnel: { title: '公网入口未取得', message: '请重新读取。', error_id: 'tunnel-error' },
    } });
  });
  expect(input.value).toBe('D:\\Edited');
  expect(host.querySelector('.ui-board-group-active')?.textContent).not.toContain('存储空间未取得');
  await click(tabs(host).find(tab => tab.textContent === '应用与维护'));
  expect(host.querySelector('.ui-board-group-active')?.textContent).toContain('存储空间未取得');
  await click(tabs(host).find(tab => tab.textContent === '网络与访问'));
  expect(host.querySelector('.ui-board-group-active')?.textContent).toContain('公网入口未取得');
  expect(host.querySelector('#peachProxy')).not.toBeNull();
});

it('媒体来源未取得时隐藏会提交媒体配置的表单，其他设置仍可用', async () => {
  const partial = full();
  partial.section_errors = { media_sources: { title: '媒体目录未取得', message: '请重新读取。', error_id: 'media-error' } };
  const host = await open(partial);
  expect(host.querySelector('[data-folder-row]')).toBeNull();
  expect(host.querySelector('#configPort')).toBeNull();
  expect(host.querySelector('#peachProxy')).not.toBeNull();
  await click(tabs(host).find(tab => tab.textContent === '网络与访问'));
  expect(host.querySelector('.ui-board-group-active')?.textContent).toContain('媒体目录未取得');
});
