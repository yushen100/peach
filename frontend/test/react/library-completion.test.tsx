import { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

import { LibraryCompletionPrompt, meteredPreviewIds, missingPreviewIds } from '../../src/react/library-processing/library-completion';
import { LIBRARY_PROCESSING_KEY } from '../../src/react/library-processing/library-processing';
import type { MediaItem } from '../../src/react/catalog-grid/types';
import { queryClient } from '../../src/react/query';
import { appSettingsStore } from '../../src/appearance/settings';
import { buttonNamed, click, mount, pending } from './render';

vi.mock('@peach/legacy/ui', async (original) => ({
  ...await original<typeof import('@peach/legacy/ui')>(),
  confirmModal: (await import('../../src/ui-kit/modal')).confirmModal,
}));

notifyManager.setScheduler(notify => notify());
afterEach(() => queryClient.clear());

const item = (id: number, extra: Partial<MediaItem> = {}): MediaItem => ({ id, location: 'local', ...extra });
const prompt = (ids = [7, 8], onComplete = vi.fn()) =>
  <QueryClientProvider client={queryClient}><LibraryCompletionPrompt assetIds={ids} onComplete={onComplete} /></QueryClientProvider>;
const menuItem = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
  .find(button => button.querySelector('span > span')?.textContent === label);

it('缺图提示只选择没有可用卡面且可以补全的影片：免费网盘也能抽帧，流量保护的只补封面', () => {
  expect(missingPreviewIds([
    item(1), item(1), item(2, { has_thumb: true }), item(3, { has_local_poster: true }),
    item(4, { location: 'online' }), item(5, { disposal: 'trash' }), item(6, { medium: 'image' }),
    item(7, { location: '115' }), item(8, { code: 'ABW-001', location: 'pikpak', cost: 'metered' }),
    item(13, { location: 'pikpak', cost: 'metered' }),
    item(9, { follow_thumb_url: 'https://example.test/image.jpg' }),
    item(10, { has_cover: true, cover_key: 'sample' }),
    item(11, { name: 'unknown.strm' }), item(12, { name: 'unknown.iso' }),
  ], 'cover')).toEqual([1, 7, 8]);
});

it('流量保护目录里没有图的影片单独成批：在线、STRM、回收站和已有图的不算', () => {
  expect(meteredPreviewIds([
    item(1, { location: 'pikpak', cost: 'metered' }), item(2, { location: 'pikpak', cost: 'metered', has_thumb: true }),
    item(3, { location: '115', cost: 'free' }), item(4, { location: 'online', cost: 'metered' }),
    item(5, { location: 'pikpak', cost: 'metered', name: 'a.strm' }), item(6, { location: 'pikpak', cost: 'metered', disposal: 'trash' }),
  ], 'cover')).toEqual([1]);
});

it('两批合成一条：主按钮「同步这些影片」在最右，流量保护那批先确认，再只为它们带授权补预览', async () => {
  const posts: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)));
    return { ok: true, json: async () => ({ status: 'idle' }) };
  }));
  const host = await mount(<QueryClientProvider client={queryClient}>
    <LibraryCompletionPrompt assetIds={[7, 8]} meteredIds={[8, 9]} /></QueryClientProvider>);
  expect(host.textContent).toContain('这批影片中有 3 部暂无预览，其中 2 部在流量保护目录');
  const labels = [...host.querySelectorAll('[data-library-completion] button')].map(button => button.textContent?.trim()).filter(Boolean);
  expect(labels.at(-1) === '同步这些影片' || labels.at(-2) === '同步这些影片', '主按钮（含下拉）排在最右').toBe(true);
  expect(labels.indexOf('补全流量保护的 2 部')).toBeLessThan(labels.indexOf('同步这些影片'));

  await click(buttonNamed('补全流量保护的 2 部', host));
  await vi.waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));
  expect(document.querySelector('dialog')?.textContent).toContain('这 2 部影片');
  await click(document.querySelector('dialog [data-modal-confirm]'));
  await vi.waitFor(() => expect(posts).toEqual([{ stage: 'previews', asset_ids: [8, 9], allow_metered: true }]));
});

it('关闭视频预览生成时保留资料同步，并禁用单独抽帧', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'idle', metadata_only: true }) })));
  const host = await mount(prompt());
  await click(host.querySelector('[aria-haspopup="dialog"]'));
  expect(menuItem('仅补全预览图')?.disabled).toBe(true);
  expect(menuItem('仅补全影片资料')?.disabled).toBe(false);
});

it('关闭钮写本机偏好，同页的几条一起收起；设置里再打开就回来', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'idle' }) })));
  const settings = appSettingsStore();
  const host = await mount(<QueryClientProvider client={queryClient}>
    <LibraryCompletionPrompt assetIds={[7]} /><LibraryCompletionPrompt assetIds={[8]} /></QueryClientProvider>);
  expect(host.querySelectorAll('[data-library-completion]')).toHaveLength(2);
  await click(host.querySelector('[data-completion-dismiss]'));
  expect(settings.value.completionPrompt).toBe(false);
  expect(JSON.parse(localStorage.getItem('peach.settings.v1') || '{}').completionPrompt).toBe(false);
  expect(host.querySelectorAll('[data-library-completion]')).toHaveLength(0);
  await act(async () => { settings.value.completionPrompt = true; settings.save() });
  expect(host.querySelectorAll('[data-library-completion]')).toHaveLength(2);
});

it('没有缺图影片时不显示入口也不查询任务', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const host = await mount(prompt([]));
  expect(host.textContent).toBe('');
  expect(fetcher).not.toHaveBeenCalled();
});

it('默认补全与下拉分项都只提交当前缺图影片，菜单仅包含分项', async () => {
  const posts: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)));
    return { ok: true, json: async () => ({ status: 'idle' }) };
  }));
  const host = await mount(prompt());
  expect(host.textContent).toContain('2 部暂无预览');
  await click(buttonNamed('同步这些影片', host));
  for (const label of ['仅补全预览图', '仅补全影片资料']) {
    await click(host.querySelector('[aria-haspopup="dialog"]'));
    const menu = document.querySelector('[role="dialog"]')!;
    expect(buttonNamed('同步这些影片', menu)).toBeNull();
    await click(menuItem(label));
  }
  expect(posts).toEqual([
    { stage: 'collect', asset_ids: [7, 8] },
    { stage: 'previews', asset_ids: [7, 8] },
    { stage: 'metadata', asset_ids: [7, 8] },
  ]);
});

it('启动等待期间不重复提交，结束后刷新馆藏并给出封面与预览数量', async () => {
  const response = pending<{ status: string; job_id: string }>();
  const posts: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)));
      return { ok: true, json: () => response.answer };
    }
    return { ok: true, json: async () => ({ status: 'running', job_id: 'complete-one', current_action: 'generating_preview' }) };
  }));
  queryClient.setQueryData(LIBRARY_PROCESSING_KEY, { status: 'idle' });
  queryClient.setQueryData(['catalog-grid', 'catalog', 'sample', 1], { pages: [] });
  const onComplete = vi.fn();
  const host = await mount(prompt([7], onComplete));
  const primary = buttonNamed('同步这些影片', host)!;
  await click(primary);
  expect(primary.getAttribute('aria-busy')).toBe('true');
  const more = host.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!;
  await click(more);
  expect(more.getAttribute('aria-expanded')).toBe('false');
  await click(primary);
  expect(posts).toHaveLength(1);
  await response.release({ status: 'running', job_id: 'complete-one' });
  expect(host.textContent).toContain('当前任务结束后可单独补全');
  expect(primary.getAttribute('aria-disabled')).toBe('true');
  await click(more);
  expect(more.getAttribute('aria-expanded')).toBe('false');
  await act(async () => queryClient.setQueryData(LIBRARY_PROCESSING_KEY,
    { status: 'complete', job_id: 'complete-one', covers: 1, previews: 2 }));
  expect(host.textContent).toContain('取得 1 张封面，生成 2 部视频预览');
  expect(queryClient.getQueryState(['catalog-grid', 'catalog', 'sample', 1])?.isInvalidated).toBe(true);
  expect(onComplete).toHaveBeenCalledTimes(1);
  const nextMore = host.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!;
  await click(nextMore);
  expect(nextMore.getAttribute('aria-expanded')).toBe('true');
});

it('启动失败保留入口与处理详情，不显示完成回执', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? { ok: false, status: 400, json: async () => ({ error: '请先添加媒体目录' }) }
    : { ok: true, json: async () => ({ status: 'idle' }) }));
  const host = await mount(prompt());
  await click(buttonNamed('同步这些影片', host));
  expect(host.textContent).toContain('请先添加媒体目录');
  expect(host.textContent).not.toContain('补全完成');
  expect(host.querySelector('a[href="/data-cleanup#libraryProcessing"]')?.textContent).toBe('打开扫描与采集');
  expect(buttonNamed('同步这些影片', host)?.disabled).toBe(false);
});
