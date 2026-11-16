import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmModal } from '@peach/legacy/ui';
import { TagManager, type ManagedTag } from '../../src/react/index/tag-manager';
import { TagEditor } from '../../src/react/index/tag-operations';
import { queryClient } from '../../src/react/query';
import { buttonNamed, click, mount, mountRoot, settle, submit, type } from './render';

vi.mock('@peach/legacy/ui', async original => ({
  ...await original<typeof import('@peach/legacy/ui')>(),
  confirmModal: vi.fn(async ({ onConfirm }: { onConfirm(): Promise<unknown> }) => ({ confirmed: true, result: await onConfirm() })),
}));
vi.mock('../../src/react/toaster', () => ({ showToast: vi.fn() }));
notifyManager.setScheduler(notify => notify());
afterEach(() => queryClient.clear());

const initial = (): ManagedTag[] => [
  { entity_id: 1, k: '眼镜', aliases: ['眼镜娘'], n: 2, hidden: false },
  { entity_id: 2, k: '旅行', aliases: [], n: 1, hidden: false },
  { entity_id: 3, k: '旧标签', aliases: [], n: 1, hidden: true },
];

function inventoryPage(rows: ManagedTag[], url: string) {
  const params = new URL(url, 'http://localhost').searchParams;
  const state = params.get('state') || 'active';
  const q = (params.get('q') || '').toLocaleLowerCase();
  const matches = rows.filter(row => (state === 'blocked' ? row.blocked : !row.blocked && row.hidden === (state === 'hidden'))
    && [row.k, ...row.aliases].some(name => name.toLocaleLowerCase().includes(q)));
  const categories = Object.fromEntries(matches.map(row => [row.cat || 'general', 1]));
  const filtered = matches.filter(row => !params.get('category') || params.get('category') === 'all' || row.cat === params.get('category'));
  const offset = Number(params.get('offset') || 0), limit = Number(params.get('limit') || 20);
  return { items:filtered.slice(offset, offset + limit), total:filtered.length, categories, duplicate_groups:[] };
}

function backend(failPreview = false) {
  let rows = initial();
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const command = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.endsWith('/preview')) return { ok: !failPreview, status: failPreview ? 400 : 200, json: async () =>
      failPreview ? { error: '目标名称已存在，请使用合并标签' } : { token: 'plan', assets: 2, overlap: 0, tags: rows.filter(row => command.ids.includes(row.entity_id)) } };
    if (command) rows = rows.map(row => !command.ids.includes(row.entity_id) ? row :
      { ...row, k: command.operation === 'rename' ? command.name : row.k,
        hidden: command.operation === 'hide' || (command.operation !== 'restore' && row.hidden) });
    return { ok: true, status: 200, json: async () => command ? { ok: true } : inventoryPage(rows, url) };
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

/** 状态药丸带着数量（「已隐藏 3」），按开头的档名找。 */
const statePill = (host: ParentNode, name: string) =>
  [...host.querySelectorAll('[data-tag-pill]')].find((pill) => pill.textContent?.trim().startsWith(name));

async function open() {
  const host = await mount(<QueryClientProvider client={queryClient}><TagManager /></QueryClientProvider>);
  await settle(); return host;
}

describe('标签管理', () => {
  it('按别名联想在线标签，选中候选填写名称并等待影响范围预览', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ items: [
      { id: 'outdoors', k: 'outdoors', aliases: ['户外'], n: 2, hidden: false },
    ] }) }));
    vi.stubGlobal('fetch', fetcher);
    await mount(<QueryClientProvider client={queryClient}><TagEditor operation="block" scope="online" selected={[]} close={vi.fn()} done={vi.fn()} /></QueryClientProvider>);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="标签名称"]')!;
    await act(async () => input.focus());
    await type(input, '户外');
    await act(async () => { await vi.advanceTimersByTimeAsync(250) });
    await settle();
    const request = new URL(fetcher.mock.calls[0]![0] as string, 'http://localhost');
    expect(request.searchParams.get('scope')).toBe('online');
    expect(request.searchParams.get('q')).toBe('户外');
    await click(document.querySelector('[role="option"][data-key="outdoors"]'));
    expect(input.value).toBe('outdoors');
    expect(buttonNamed('预览影响范围')?.disabled).toBe(false);
    expect(fetcher.mock.calls.every(([, init]) => !init?.body)).toBe(true);
  });

  it('输入法合成期间不请求候选，清空名称后停用影响范围预览', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ items: [] }) }));
    vi.stubGlobal('fetch', fetcher);
    await mount(<QueryClientProvider client={queryClient}><TagEditor operation="block" scope="online" selected={[]} close={vi.fn()} done={vi.fn()} /></QueryClientProvider>);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="标签名称"]')!;
    await act(async () => { input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })) });
    await type(input, 'zhong');
    await act(async () => { await vi.advanceTimersByTimeAsync(250) });
    expect(fetcher).not.toHaveBeenCalled();
    await type(input, '中文');
    await act(async () => { input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })) });
    await act(async () => { await vi.advanceTimersByTimeAsync(250) });
    await settle();
    expect(new URL(fetcher.mock.calls[0]![0], 'http://localhost').searchParams.get('q')).toBe('中文');
    expect(input.value).toBe('中文');
    expect(buttonNamed('预览影响范围')?.disabled).toBe(false);
    await type(input, '');
    await act(async () => { await vi.advanceTimersByTimeAsync(250) });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(buttonNamed('预览影响范围')?.disabled).toBe(true);
  });

  it('按页请求并跨页保留选择，分类筛选回到首页', async () => {
    const rows = Array.from({ length:230 }, (_, index) => ({ entity_id:index + 1, k:`tag-${index}`, n:230-index,
      aliases:[], hidden:false, cat:index < 120 ? 'general' : 'role' }));
    const fetcher = vi.fn(async (url: string) => ({ ok:true, json:async () => inventoryPage(rows, url) }));
    vi.stubGlobal('fetch', fetcher);
    const host = await open();
    expect(host.querySelectorAll('[data-tag-chip]')).toHaveLength(100);
    // 状态药丸的计数另发 `limit=1` 的请求；清单本身按页取 100 个。
    const pages = () => fetcher.mock.calls.map(([url]) => new URL(url, 'http://localhost')).filter((url) => url.searchParams.has('offset'));
    expect(pages()[0]!.searchParams.get('limit')).toBe('100');
    await click(host.querySelector('[data-tag-chip][data-k="tag-0"]'));
    await click(buttonNamed('下一页', host)); await settle();
    expect(host.querySelector('[data-tag-chip][data-k="tag-0"]')).toBeNull();
    await click(host.querySelector('[data-tag-chip][data-k="tag-100"]'));
    expect(host.querySelector('[aria-label="标签管理操作"]')?.textContent).toContain('已选 2 个标签');
    await click(buttonNamed('上一页', host)); await settle();
    expect(host.querySelector('[data-tag-chip][data-k="tag-0"]')?.getAttribute('aria-pressed')).toBe('true');
    await click(buttonNamed('下一页', host)); await settle();
    await click(buttonNamed('角色设定', host)); await settle();
    expect(host.querySelector('[data-tag-chip][data-k="tag-120"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="标签管理操作"]')).toBeNull();
    const last = pages().at(-1)!;
    expect(last.searchParams.get('offset')).toBe('0');
    expect(last.searchParams.get('category')).toBe('role');
  });

  it('在线内容屏蔽与标签隐藏各有状态并使用预览计划恢复', async () => {
    let blocked = false;
    const commands: Record<string, unknown>[] = [];
    const row = () => ({ id: 'outdoors', k: 'outdoors', n: 2, aliases: [], hidden: false, blocked, cat: 'general' });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const command = init?.body ? JSON.parse(String(init.body)) : null;
      if (command) commands.push(command);
      if (url.endsWith('/preview')) return { ok: true, json: async () => ({ token: 'content-plan', assets: 2, overlap: 0, tags: [row()] }) };
      if (command) blocked = command.operation === 'block';
      return { ok: true, json: async () => command ? { ok: true } : inventoryPage([row()], url) };
    }));
    const host = await mount(<QueryClientProvider client={queryClient}><TagManager scope="online" /></QueryClientProvider>);
    await settle();
    await click(host.querySelector('[data-tag-chip]'));
    await click(buttonNamed('屏蔽内容', host)); await settle();
    expect(commands).toEqual([{ operation: 'block', ids: ['outdoors'], scope: 'online' },
      { operation: 'block', ids: ['outdoors'], scope: 'online', token: 'content-plan' }]);
    expect(host.querySelectorAll('[data-tag-chip]')).toHaveLength(0);
    expect(statePill(host, '已屏蔽内容')?.textContent).toBe('已屏蔽内容 1');
    await click(statePill(host, '已隐藏'));
    expect(host.querySelectorAll('[data-tag-chip]')).toHaveLength(0);
    await click(statePill(host, '已屏蔽内容'));
    await click(host.querySelector('[data-tag-chip]'));
    await click(buttonNamed('恢复内容', host)); await settle();
    expect(commands.at(-1)).toEqual({ operation: 'unblock', ids: ['outdoors'], scope: 'online', token: 'content-plan' });
    await click(statePill(host, '使用中'));
    expect(host.querySelectorAll('[data-tag-chip]')).toHaveLength(1);
  });

  it('搜索登记别名并区分使用中与已隐藏标签', async () => {
    backend();
    const view = await mountRoot(<QueryClientProvider client={queryClient}><TagManager search="眼镜娘" /></QueryClientProvider>);
    const host = view.host;
    await settle();
    expect(host.querySelectorAll('[data-tag-chip]')).toHaveLength(1);
    expect(host.textContent).toContain('眼镜');
    await view.rerender(<QueryClientProvider client={queryClient}><TagManager search="" /></QueryClientProvider>);
    expect(statePill(host, '已隐藏')?.textContent).toBe('已隐藏 1');
    await click(statePill(host, '已隐藏'));
    expect(host.querySelectorAll('[data-tag-chip]')).toHaveLength(1);
    expect(host.textContent).toContain('旧标签');
  });

  it('在线标签沿用字符串身份与在线词表提交改名', async () => {
    const calls: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const command = init?.body ? JSON.parse(String(init.body)) : null;
      if (command) calls.push(command);
      return { ok: true, json: async () => url.endsWith('/preview')
        ? { token: 'online-plan', assets: 2, overlap: 0, tags: [{ id: 'outdoors', k: 'outdoors' }] }
        : inventoryPage([{ id: 'outdoors', k: 'outdoors', n: 2, aliases: [], hidden: false, cat: 'general' }], url) };
    }));
    const host = await mount(<QueryClientProvider client={queryClient}><TagManager scope="online" /></QueryClientProvider>);
    await settle();
    await click(host.querySelector('[aria-label="编辑标签 outdoors"]'));
    await type(document.querySelector('input[aria-label="标签名称"]'), '户外');
    await submit(document.querySelector('form')); await settle();
    expect(calls).toEqual([{ operation: 'rename', scope: 'online', ids: ['outdoors'], name: '户外' },
      { operation: 'rename', scope: 'online', ids: ['outdoors'], name: '户外', token: 'online-plan' }]);
  });

  it('重命名先预览再使用同一计划提交并刷新标签', async () => {
    const fetcher = backend(); const host = await open();
    await click(host.querySelector('[data-tag-chip][data-k="眼镜"]'));
    await click(buttonNamed('重命名'));
    await type(document.querySelector('input[aria-label="标签名称"]'), '我的标签');
    await submit(document.querySelector('form'));
    await settle();
    expect(confirmModal).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('2 个资源') }));
    const bodies = fetcher.mock.calls.filter(([, init]) => init?.body).map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual([{ operation: 'rename', ids: [1], name: '我的标签' },
      { operation: 'rename', ids: [1], name: '我的标签', token: 'plan' }]);
    expect(host.querySelector('[data-tag-chip][data-k="我的标签"]')).not.toBeNull();
  });

  it('冲突保留输入和错误且不发送写入', async () => {
    const fetcher = backend(true); const host = await open();
    await click(host.querySelector('[data-tag-chip][data-k="眼镜"]'));
    await click(buttonNamed('重命名'));
    await type(document.querySelector('input[aria-label="标签名称"]'), '旅行');
    await submit(document.querySelector('form')); await settle();
    expect((document.querySelector('input[aria-label="标签名称"]') as HTMLInputElement).value).toBe('旅行');
    expect(document.body.textContent).toContain('目标名称已存在');
    expect(fetcher.mock.calls.filter(([url, init]) => url === '/api/tag-management' && init?.body)).toHaveLength(0);
  });
});
