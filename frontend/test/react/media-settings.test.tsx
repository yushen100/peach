import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONFIGURATION_URL, PICK_FOLDER_URL } from '../../src/configuration-endpoints';
import type { ConfigurationData } from '../../src/react/bundle';
import { CloudDriveGuide } from '../../src/react/settings/clouddrive-guide';
import { MEDIA_SOURCE_ICONS } from '../../src/ui-kit/media-source-icons';
import { MediaSettings } from '../../src/react/settings/media-settings';
import { MEDIA_PROCESSING_KEY } from '../../src/react/settings-panel/settings-data';
import { queryClient } from '../../src/react/query';
import { buttonNamed, choose, click, fetchMock, mount, section, sentBody, settle, submit, type } from './render';

vi.mock('../../src/react/settings/service-preferences', () => ({ VideoThumbnailRow: () => null }));
vi.mock('../../src/react/settings/cloud-proxy-settings', () => ({ CloudProxySettings: () => null }));
vi.mock('@peach/legacy/ui', async (original) => ({
  ...await original<Record<string, unknown>>(),
  MEDIA_SOURCE_ICONS: (await import('../../src/ui-kit/media-source-icons')).MEDIA_SOURCE_ICONS,
  confirmModal: (await import('../../src/ui-kit/modal')).confirmModal,
}));
/* 保存前先读一次扫描与采集的状态。单独接住它，各用例的 `fetch` 桩只数配置请求。 */
const processing = vi.hoisted(() => ({ read: vi.fn(async (): Promise<{ status: string; trigger?: string }> => ({ status: 'idle' })) }));
vi.mock('../../src/react/library-processing/library-processing', async (original) => ({
  ...await original<Record<string, unknown>>(),
  fetchLibraryProcessing: () => processing.read(),
}));
afterEach(() => { processing.read.mockReset(); processing.read.mockResolvedValue({ status: 'idle' }) });

const data = (over: Partial<ConfigurationData> = {}): ConfigurationData => ({
  editable: true, notice: '', revision: 'rev-1', media_dirs: ['D:\\Media'], library_count: 1, port: 9123, facts: [], ...over,
});

const open = (over: Partial<ConfigurationData> = {}, receipt = vi.fn()) =>
  mount(<MediaSettings data={data(over)} receipt={receipt} />);
const rows = (root: ParentNode) => [...root.querySelectorAll('[data-folder-row]')];
const paths = (root: ParentNode) => [...root.querySelectorAll<HTMLInputElement>('input[aria-label^="媒体目录 "]')];

it('媒体表单保留重启提示，访问端口由网络分区管理', async () => {
  const host = await open({ port_editable: false });
  expect(host.querySelector('#configPort')).toBeNull();
  expect(host.textContent).toContain('保存后 Peach 会重新启动');
  expect(host.querySelector('form')).not.toBeNull();
});

it('网盘来源缺依赖时给新窗口下载链接，已装的不提示', async () => {
  const host = await open({
    media_sources: [{ location: '115', root: 'B:\\', path: 'B:\\' }],
    mount_dependencies: [
      { name: 'CloudDrive', available: false, download_url: 'https://www.clouddrive2.com/download.html' },
      { name: 'WinFsp', available: true, download_url: 'https://winfsp.dev/rel/' },
    ],
  });
  const link = host.querySelector('a[href="https://www.clouddrive2.com/download.html"]');
  expect(link?.getAttribute('target')).toBe('_blank');
  expect(link?.querySelector('svg')).not.toBeNull();
  expect(host.textContent).not.toContain('下载 WinFsp');
});

it('局域网 HTTP 页面没有 randomUUID 时，旧目录补上媒体库身份并照常打开', async () => {
  const real = globalThis.crypto;
  vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
  const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
  vi.stubGlobal('fetch', fetcher);
  try {
    const host = await open({ media_sources: [{ location: 'local', root: '/media', path: '/media', cost: 'free' }] });
    expect(host.querySelector('form')).not.toBeNull();
    await submit(host.querySelector('form'));
    const save = fetcher.mock.calls.findIndex(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(sentBody(fetcher, save).media_sources[0].library_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('不能编辑时只说原因，不画表单', async () => {
  const host = await open({ editable: false, notice: '请在运行 Peach 的电脑上打开配置' });
  expect(host.querySelector('form')).toBeNull();
  expect(host.querySelector('[role="note"]')?.textContent).toContain('请在运行 Peach 的电脑上打开配置');
});

describe('媒体目录', () => {
  it('来源选择 SMB 共享时显示连接字段，切回本地磁盘时隐藏', async () => {
    const host = await open({ media_sources: [{ location: 'local', root: 'D:\\Media', path: 'D:\\Media' }] });
    const source = () => host.querySelector('[aria-label="媒体来源 1"]');
    expect(host.querySelector('[aria-label="SMB 账号 1"]')).toBeNull();
    await choose(source(), 'SMB 共享');
    expect(source()?.textContent).toContain('SMB 共享');
    expect(paths(host)[0]?.value).toBe('smb://');
    expect(host.querySelector('input[aria-label="SMB 密码 1"]')?.getAttribute('type')).toBe('password');
    await type(paths(host)[0], '');
    expect(source()?.textContent).toContain('SMB 共享');
    expect(host.querySelector('[aria-label="SMB 账号 1"]')).not.toBeNull();
    await choose(source(), '本地磁盘');
    expect(host.querySelector('[aria-label="SMB 账号 1"]')).toBeNull();
  });

  it('勾了「移除账号」时账号、密码与加密一起禁用，取消后恢复', async () => {
    const host = await open({ media_sources: [{ location: 'local', root: 'D:\\Media', path: 'D:\\Media' }] });
    await choose(host.querySelector('[aria-label="媒体来源 1"]'), 'SMB 共享');
    const fields = () => [host.querySelector<HTMLInputElement>('input[aria-label="SMB 账号 1"]')!.disabled,
      host.querySelector<HTMLInputElement>('input[aria-label="SMB 密码 1"]')!.disabled,
      [...host.querySelectorAll<HTMLLabelElement>('label')].find((label) => label.textContent?.includes('要求 SMB 加密'))!
        .querySelector<HTMLInputElement>('input')!.disabled];
    const remove = () => [...host.querySelectorAll<HTMLLabelElement>('label')].find((label) => label.textContent?.includes('移除已保存的 SMB 账号'))!;
    expect(fields()).toEqual([false, false, false]);
    await click(remove());
    expect(fields()).toEqual([true, true, true]);
    await click(remove());
    expect(fields()).toEqual([false, false, false]);
  });

  it('关掉视频预览生成时，自定义步骤里的九宫格变灰并说明，其他步骤照常', async () => {
    const before = queryClient.getQueryData(MEDIA_PROCESSING_KEY);
    queryClient.setQueryData(MEDIA_PROCESSING_KEY, { metadata_only: true });
    try {
      const host = await open({ media_sources: [{ location: 'local', root: 'D:\\Media', path: 'D:\\Media', library_policy: 'custom', library_stages: 'probe,preview' }] });
      const step = (text: string) => [...host.querySelectorAll<HTMLLabelElement>('label')]
        .find((label) => label.textContent === text)!.querySelector<HTMLInputElement>('input')!;
      expect([step('生成九宫格预览').disabled, step('生成九宫格预览').checked, step('读取视频信息').disabled]).toEqual([true, true, false]);
      expect(host.textContent).toContain('九宫格这一步不会执行');
    } finally {
      queryClient.setQueryData(MEDIA_PROCESSING_KEY, before);
    }
  });

  it('保存 SMB 来源保留目录身份，密码输入保持为空', async () => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open({ media_sources: [{ location: 'local', root: 'P:\\NAS', path: 'smb://nas/Movies',
      root_id: 'nas-root', library_id: 'nas-library', transport: 'smb', smb_username: 'reader', smb_password_saved: true }] });
    expect(host.querySelector('[aria-label="媒体来源 1"]')?.textContent).toContain('SMB 共享');
    expect(host.querySelector<HTMLInputElement>('[aria-label="SMB 密码 1"]')?.value).toBe('');
    await submit(host.querySelector('form'));
    expect(sentBody(fetcher).media_sources[0]).toMatchObject({ root_id: 'nas-root', library_id: 'nas-library',
      transport: 'smb', path: 'smb://nas/Movies', smb_username: 'reader', smb_password: '' });
  });

  it('同一媒体库的文件夹归在一张卡里，名称只填一次，保存时写进全部目录并保留根目录身份', async () => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open({ windows: true, media_sources: [
      { location: 'local', root: 'D:\\JAV', path: 'D:\\JAV', root_id: 'root-one', library_id: 'library-one', library: 'JAV', cost: 'free' },
      { location: 'local', root: 'E:\\JAV', path: 'E:\\JAV', root_id: 'root-two', library_id: 'library-one', library: 'JAV', cost: 'free' },
    ] });
    const blocks = [...host.querySelectorAll('[data-library-block]')];
    expect(blocks).toHaveLength(1);
    expect(rows(blocks[0]!)).toHaveLength(2);
    await type(host.querySelector<HTMLInputElement>('[aria-label="JAV 名称"]'), '私人馆藏');
    expect(host.querySelectorAll('input[aria-label$=" 名称"]')).toHaveLength(1);
    await submit(host.querySelector('form'));
    expect(sentBody(fetcher).media_sources).toMatchObject([
      { root_id: 'root-one', library_id: 'library-one', library: '私人馆藏' },
      { root_id: 'root-two', library_id: 'library-one', library: '私人馆藏' },
    ]);
  });

  it('来源色与处理方式属于媒体库，保存时随这一库的每个目录提交', async () => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open({ windows: true, media_sources: [
      { location: 'local', root: 'D:\\JAV', path: 'D:\\JAV', root_id: 'root-one', library_id: 'library-one', library: 'JAV',
        cost: 'free', library_color: 'sky', library_policy: 'auto' },
      { location: 'local', root: 'E:\\JAV', path: 'E:\\JAV', root_id: 'root-two', library_id: 'library-one', library: 'JAV',
        cost: 'free', library_color: 'sky', library_policy: 'auto' },
    ] });
    expect(host.querySelector('[data-library-color-trigger]')?.getAttribute('aria-label')).toBe('JAV 来源色：天蓝');
    await click(host.querySelector('[data-library-color-trigger]'));
    await click(document.querySelector('[data-library-colors] [aria-label="琥珀"]'));
    const policy = host.querySelector('[aria-label="JAV 处理方式"]');
    await click(policy?.matches('[aria-haspopup]') ? policy : policy?.querySelector('[aria-haspopup="listbox"]'));
    await click([...document.querySelectorAll('[role="option"]')].find(node => node.textContent?.startsWith('自定义')));
    const steps = host.querySelector('[aria-label="JAV 处理步骤"]');
    expect(steps?.querySelectorAll('input:checked')).toHaveLength(5);
    await click([...steps!.querySelectorAll('label')].find(node => node.textContent?.includes('生成九宫格预览')));
    await submit(host.querySelector('form'));
    const expected = { library_id: 'library-one', library_color: 'amber', library_policy: 'custom',
      library_stages: 'probe,metadata,cover,people' };
    expect(sentBody(fetcher).media_sources).toMatchObject([expected, expected]);
  });

  it('目录重定位保留账本前缀，添加另一目录交由服务端生成身份', async () => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open({ windows: true, media_sources: [
      { location: 'local', root: 'D:\\JAV', path: 'D:\\JAV', root_id: 'root-one', library_id: 'library-one', library: 'JAV', cost: 'free' },
    ] });
    await type(paths(host)[0], 'F:\\JAV');
    await choose(host.querySelector('[aria-label="目录变更方式 1"]'), '重定位此目录，保留文件记录');
    await submit(host.querySelector('form'));
    expect(sentBody(fetcher).media_sources[0]).toMatchObject({
      root_id: 'root-one', root: 'D:\\JAV', path: 'F:\\JAV', change_mode: 'relocate',
    });
  });
  it.each([['guangya', '光鸭云盘'], ['onedrive', 'OneDrive'], ['mounted', '其他已挂载网盘']])(
    '%s 来源回填名称、挂载帮助和现有图标，保存带上来源', async (location, label) => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open({ windows: true, media_sources: [
      { location, root: 'G:\\Movies', path: 'G:\\Movies', online: true },
    ] });
    expect(paths(host)[0]?.value).toBe('G:\\Movies');
    expect(host.textContent).toContain(label);
    expect(host.textContent).not.toContain('（只读）');
    if (location === 'mounted') expect(host.querySelector('use[href="#i-database"]')).not.toBeNull();
    else expect(host.querySelector('img')?.getAttribute('src')).toBe(MEDIA_SOURCE_ICONS[location]);
    expect(host.textContent).toContain('CloudDrive2 v1.1.0');
    await submit(host.querySelector('form'));
    expect(sentBody(fetcher).media_sources).toMatchObject([
      { location, root: 'G:\\Movies', path: 'G:\\Movies', library: '', library_icon: '',
        cost: location === 'guangya' ? 'free' : 'metered' },
    ]);
  });

  it('Windows 只填本机路径，选了网盘才出 CloudDrive 帮助', async () => {
    const host = await open({ windows: true, media_sources: [{ location: 'local', root: 'D:/', path: 'D:/' }] });
    expect(host.textContent).not.toContain('Windows 中的对应路径');
    expect(host.textContent).not.toContain('挂载帮助');
    await choose(rows(host)[0]?.querySelector('[aria-haspopup="listbox"]'), 'CloudDrive · 115');
    expect(host.textContent).toContain('挂载帮助');
  });

  it('其它系统每行只展示媒体目录和各自的访问状态', async () => {
    const host = await open({ windows: false, media_sources: [
      { location: '115', root: 'B:/', path: '/Volumes/115', online: true },
      { location: 'pikpak', root: 'A:/', path: '/Volumes/PikPak', online: false },
      { location: 'local', root: 'D:/', path: '/Volumes/Media' },
    ] });
    expect(rows(host)).toHaveLength(3);
    expect(rows(host).some((row) => row.textContent?.includes('高级路径设置'))).toBe(false);
    const internalPaths = [...host.querySelectorAll('input[placeholder="自动配置"]')];
    expect(internalPaths).toHaveLength(0);
    expect(rows(host).map((row) => [row.querySelector('[data-mount]')?.getAttribute('data-mount'), row.querySelector('[data-mount]')?.textContent]))
      .toEqual([['online', '在线'], ['offline', '离线'], ['unknown', '未检测']]);
    expect(section(host, '挂载状态')).toBeNull();
  });

  /* 只读时单列的「挂载状态」与它的刷新键在 `configuration.test.tsx` 里：刷新换进的是整页那一个
     `queryKey`，只挂这一个分区看不出换进去之后谁读到了新的。 */

  it('按来源回填全部挂载点，提交带上盘符映射与媒体库', async () => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open({ windows: false, media_sources: [
      { location: '115', root: 'B:\\', path: '/Volumes/115', online: false, library: '收藏', library_icon: 'heart' },
      { location: 'pikpak', root: 'A:\\', path: '/Volumes/PikPak', online: true },
    ] });
    expect(paths(host).map((input) => input.value)).toEqual(['/Volumes/115', '/Volumes/PikPak']);
    await submit(host.querySelector('form'));
    await settle();
    expect(sentBody(fetcher).media_sources).toMatchObject([
      { location: '115', root: 'B:\\', path: '/Volumes/115', library: '收藏', library_icon: 'heart', cost: 'free' },
      { location: 'pikpak', root: 'A:\\', path: '/Volumes/PikPak', library: '', library_icon: '', cost: 'metered' },
    ]);
  });

  it('已保存的目录回填流量保护，用户可改为正常读取', async () => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open({ windows: true, media_sources: [
      { location: 'onedrive', root: 'O:\\Movies', path: 'O:\\Movies', cost: 'metered' },
    ] });
    const policy = rows(host)[0]?.querySelector('[data-media-read-policy] [aria-haspopup="listbox"]');
    expect(policy?.textContent).toContain('流量保护');
    await choose(policy, '正常读取');
    await submit(host.querySelector('form'));
    expect(sentBody(fetcher).media_sources).toMatchObject([
      { location: 'onedrive', root: 'O:\\Movies', path: 'O:\\Movies', library: '', library_icon: '', cost: 'free' },
    ]);
  });

  it('切换到网盘来源后必须明确选择读取策略才能保存', async () => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open({ windows: true, media_sources: [
      { location: 'local', root: 'O:\\Movies', path: 'O:\\Movies', cost: 'free' },
    ] });
    await choose(rows(host)[0]?.querySelector('[aria-haspopup="listbox"]'), 'CloudDrive · PikPak');
    const policy = rows(host)[0]?.querySelector('[data-media-read-policy] [aria-haspopup="listbox"]');
    expect(policy?.textContent).toContain('选择读取策略');
    await submit(host.querySelector('form'));
    expect(fetcher).not.toHaveBeenCalled();
    expect(host.textContent).toContain('请选择媒体读取策略');
    await choose(policy, '正常读取');
    await submit(host.querySelector('form'));
    expect(sentBody(fetcher).media_sources[0]).toMatchObject({ location: 'pikpak', cost: 'free' });
  });

  it('一行一个文件夹，只有一行时没有移除键', async () => {
    const host = await open();
    expect(paths(host).map((input) => input.value)).toEqual(['D:\\Media']);
    expect(host.querySelector('[aria-label="移除这个文件夹"]')).toBeNull();
  });

  it('新加的一行接过焦点，之后每行都能移除', async () => {
    const host = await open();
    await click(buttonNamed('添加文件夹', host));
    expect(paths(host)).toHaveLength(2);
    expect(document.activeElement).toBe(paths(host)[1]);
    const removes = host.querySelectorAll('[aria-label="移除这个文件夹"]');
    expect(removes).toHaveLength(2);
    await click(removes[0]);
    expect(paths(host).map((input) => input.value)).toEqual(['']);
  });
});

describe('选择文件夹', () => {
  it('让这台电脑弹系统对话框，选中的路径填回这一行', async () => {
    const fetcher = fetchMock(200, { path: 'E:\\Movies' });
    vi.stubGlobal('fetch', fetcher);
    const host = await open();
    const pick = host.querySelector('[aria-label="选择文件夹"]')!;
    await click(pick);
    await settle();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(PICK_FOLDER_URL);
    expect(init?.method).toBe('POST');
    expect(sentBody(fetcher)).toEqual({ initial: 'D:\\Media', purpose: 'media', start: true });
    expect(paths(host)[0]?.value).toBe('E:\\Movies');
    expect(pick.getAttribute('aria-busy'), '对话框关了忙态要撤掉').toBeNull();
  });

  it('取消什么也不改；打不开对话框时原因写在这一行', async () => {
    vi.stubGlobal('fetch', fetchMock(200, { path: null }));
    const host = await open();
    await click(host.querySelector('[aria-label="选择文件夹"]'));
    await settle();
    expect(paths(host)[0]?.value).toBe('D:\\Media');
    expect(paths(host)[0]?.getAttribute('aria-invalid')).toBeNull();
    vi.stubGlobal('fetch', fetchMock(501, { error: '这个系统上没有可用的文件夹对话框' }));
    await click(host.querySelector('[aria-label="选择文件夹"]'));
    await settle();
    expect(rows(host)[0]?.textContent).toContain('没有可用的文件夹对话框');
    expect(paths(host)[0]?.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('保存', () => {
  it('扫描与采集在跑时先确认重启的影响，取消就不保存；读不到任务状态时照常保存', async () => {
    const fetcher = fetchMock(200, { saved: true, url: '/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    try {
      processing.read.mockResolvedValue({ status: 'running', trigger: 'cli' });
      const host = await open();
      await submit(host.querySelector('form'));
      await settle();
      const dialog = document.querySelector('dialog');
      expect(dialog?.textContent).toContain('这个任务由命令行或托盘发起，不受重启影响');
      await click(dialog!.querySelector('[data-modal-cancel]'));
      await settle();
      expect(fetcher).not.toHaveBeenCalled();
      processing.read.mockRejectedValue(new Error('连接中断'));
      await submit(host.querySelector('form'));
      await settle();
      expect(fetcher.mock.calls[0]?.[0]).toBe(CONFIGURATION_URL);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('提交带上指纹、全部文件夹、端口与是否扫描，成功后回执并留下新地址', async () => {
    const fetcher = fetchMock(200, { saved: true, url: 'http://127.0.0.1:9124/', revision: 'rev-2' });
    vi.stubGlobal('fetch', fetcher);
    const receipt = vi.fn();
    const host = await open({}, receipt);
    expect(host.querySelector('#configPort')).toBeNull();
    await submit(host.querySelector('form'));
    await settle();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(CONFIGURATION_URL);
    expect(init?.method).toBe('POST');
    expect(sentBody(fetcher)).toEqual({ revision: 'rev-1', media_dirs: ['D:\\Media'], port: '9123', scan_now: false });
    expect(receipt).toHaveBeenCalledWith('已保存配置');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('正在重新启动');
    expect(host.querySelector('a[href="http://127.0.0.1:9124/"]')?.textContent).toBe('进入馆藏');
    expect(host.querySelector('form'), '保存后表单不再留在页面上').toBeNull();
  });

  it('服务端按字段退回的原因写回原位，不发回执', async () => {
    vi.stubGlobal('fetch', fetchMock(400, {
      error: '有几项需要修改',
      errors: { media_dirs: ['', '和上面的文件夹重复了'] },
    }));
    const receipt = vi.fn();
    const host = await open({ media_dirs: ['D:\\Media', 'D:\\Media'] }, receipt);
    await submit(host.querySelector('form'));
    await settle();
    expect(paths(host).map((input) => input.getAttribute('aria-invalid'))).toEqual([null, 'true']);
    expect(rows(host)[1]?.textContent).toContain('和上面的文件夹重复了');
    expect(host.querySelector('#configPort')).toBeNull();
    expect(receipt).not.toHaveBeenCalled();
    expect(host.textContent, '字段级原因不再叠一条整体提示').not.toContain('没有保存');
  });

  it('其它失败留在表单里等重试', async () => {
    vi.stubGlobal('fetch', fetchMock(409, { error: '配置已变更，请刷新后再保存' }));
    const host = await open();
    await submit(host.querySelector('form'));
    await settle();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('配置已变更');
    expect(host.querySelector('form')).not.toBeNull();
    expect(buttonNamed('保存配置', host)?.getAttribute('aria-busy'), '失败后忙态要撤掉').toBeNull();
  });
});

it('CloudDrive 建议按硬盘分三档，页内只留怎么填，原理链到仓库文档', async () => {
  const host = await mount(<CloudDriveGuide />);
  const tiers = host.querySelectorAll('[aria-label="按缓存所在硬盘分档"] > li');
  expect(tiers).toHaveLength(3);
  expect([...tiers[0]!.querySelectorAll('dt')].map((dt) => dt.textContent))
    .toEqual(['缓存上限', '读取长度（默认 / 最小）', '同时处理视频']);
  expect(host.textContent).toContain('256 / 128 KB');
  expect(host.textContent).toContain('上限不要填 0');
  expect(host.querySelector('details')?.open).toBe(false);
  expect([...host.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
    'https://www.clouddrive2.com/help.html',
    'https://github.com/peach-mitao/peach/blob/master/docs/CLOUDDRIVE.md',
  ]);
});

it('折叠开合走共用 Collapse：点开长到内容高度，收起时高度收回 0 并锁住正文', async () => {
  vi.useFakeTimers();
  const host = await mount(<CloudDriveGuide />);
  const details = host.querySelector('details')!;
  const summary = details.querySelector('summary')!;
  const body = document.getElementById(summary.getAttribute('aria-controls')!)!;
  expect(body.parentElement).toBe(details);
  expect(body.inert).toBe(true);
  await click(summary);
  expect(details.open).toBe(true);
  expect(summary.getAttribute('aria-expanded')).toBe('true');
  expect(body.classList.contains('ui-fcollapse')).toBe(true);
  expect(body.inert).toBe(false);
  await act(async () => { vi.advanceTimersByTime(260); });
  expect(body.style.height).toBe('auto');
  await click(summary);
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  expect(body.style.height).toBe('0px');
  expect(body.inert).toBe(true);
});
