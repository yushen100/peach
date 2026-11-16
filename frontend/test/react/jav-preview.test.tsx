import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { JavDetailPage } from '../../src/react/jav-detail/jav-detail-page';
import { javDetailKey, type JavDetail } from '../../src/react/jav-detail/jav-detail';
import { queryClient } from '../../src/react/query';
import { buttonNamed, click, fetchMock, mountRoot, sentBody, settle } from './render';

const player = vi.hoisted(() => vi.fn((_video: HTMLVideoElement, _source: { src: string; type: string }, _failed: () => void) => vi.fn()));
vi.mock('../../src/player', () => ({ mountPreviewPlayer: player }));
notifyManager.setScheduler(notify => notify());
afterEach(() => { queryClient.clear(); player.mockClear() });

it('官方MP4预告进入现有播放器并在关闭时销毁', async () => {
  const src = '/jav-preview/EXM-001/0123456789abcdef';
  const item: JavDetail = { code: 'EXM-001', title: '示例作品', state: 'ready', summary: '', director: '', publisher: '',
    performers: '', performer_refs: [], studio_refs: [], series_refs: [], tags: [], has_cover: false,
    source_image: false, preview_count: 0, comments_count: 0, source_url: '', wanted: false, want_id: null,
    preview_video_url: src };
  queryClient.setQueryData(javDetailKey(item.code), item);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, image: '' }) })));
  const mounted = await mountRoot(<QueryClientProvider client={queryClient}><JavDetailPage code={item.code} readOnly
    actions={{ close: vi.fn(), navigate: vi.fn(), openTag: vi.fn(), receipt: vi.fn() }} /></QueryClientProvider>);
  await click(mounted.host.querySelector('[data-jav-preview-toggle]'));
  await settle();
  expect(player).toHaveBeenCalledOnce();
  expect(player.mock.calls[0]?.[1]).toEqual({ src, type: 'video/mp4' });
  expect(mounted.host.querySelector('video')?.getAttribute('aria-label')).toBe('视频预览');
  const dispose = player.mock.results[0]!.value;
  await mounted.unmount();
  expect(dispose).toHaveBeenCalledOnce();
});

const missingCover: JavDetail = { code: 'EXM-002', title: '示例作品', state: 'ready', summary: '', director: '', publisher: '',
  performers: '', performer_refs: [], studio_refs: [], series_refs: [], tags: [], has_cover: false,
  source_image: false, preview_count: 0, comments_count: 0, source_url: '', wanted: false, want_id: null };

it('预告失败时销毁播放器，重试重新挂载，切回图片清理实例', async () => {
  const item = { ...missingCover, preview_video_url: '/jav-preview/EXM-002/unavailable.mp4' };
  queryClient.setQueryData(javDetailKey(item.code), item);
  vi.stubGlobal('fetch', fetchMock(200, { ok: true, image: '' }));
  player.mockImplementationOnce(video => vi.fn(() => video.remove()));
  const mounted = await mountRoot(<QueryClientProvider client={queryClient}><JavDetailPage code={item.code} readOnly
    actions={{ close: vi.fn(), navigate: vi.fn(), openTag: vi.fn(), receipt: vi.fn() }} /></QueryClientProvider>);
  try {
    await click(mounted.host.querySelector('[data-jav-preview-toggle]'));
    const first = player.mock.results[0]!.value;
    await act(async () => player.mock.calls[0]![2]());
    await settle();
    expect(first).toHaveBeenCalledOnce();
    expect(mounted.host.querySelector('[data-jav-video] video')).toBeNull();
    const failure = mounted.host.querySelector('[data-jav-video] [role="note"]')!;
    expect(failure.textContent).toContain('视频预览未取得');
    await click(buttonNamed('立即重试', failure));
    expect(player).toHaveBeenCalledTimes(2);
    expect(mounted.host.querySelector('[data-jav-video] [role="note"]')).toBeNull();
    const second = player.mock.results[1]!.value;
    await click(mounted.host.querySelector('[data-jav-preview-toggle]'));
    expect(second).toHaveBeenCalledOnce();
  } finally { await mounted.unmount(); vi.unstubAllGlobals() }
});

async function mountMissingCover(reply: unknown) {
  queryClient.setQueryData(javDetailKey(missingCover.code), missingCover);
  const fetcher = fetchMock(200, reply);
  vi.stubGlobal('fetch', fetcher);
  const mounted = await mountRoot(<QueryClientProvider client={queryClient}><JavDetailPage code={missingCover.code} readOnly
    actions={{ close: vi.fn(), navigate: vi.fn(), openTag: vi.fn(), receipt: vi.fn() }} /></QueryClientProvider>);
  return { fetcher, host: mounted.host };
}

it('没有封面时舞台里给说明与立即重试，取到后换成本机封面', async () => {
  const { fetcher, host } = await mountMissingCover({ ok: true, has_cover: true, cover_version: 'v7', message: '' });
  try {
    const gap = host.querySelector('[data-jav-picture-gap]');
    expect(gap?.querySelector('strong')?.textContent).toBe('封面未取得');
    // 舞台恒为黑底，不套空态卡片。
    expect(gap?.querySelector('[data-empty-state]')).toBeNull();
    await click(buttonNamed('立即重试', gap!));
    await settle();
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/jav/cover');
    expect(sentBody(fetcher)).toEqual({ code: 'EXM-002' });
    expect(host.querySelector('[data-jav-picture-gap]')).toBeNull();
    expect(host.querySelector('img[data-jav-picture]')?.getAttribute('src')).toBe('/cover?code=EXM-002&thumb=1&v=v7');
  } finally { vi.unstubAllGlobals() }
});

it('重试没取到时写出服务端给的原因', async () => {
  const { host } = await mountMissingCover({ ok: true, has_cover: false, cover_version: '', message: '来源连接失败' });
  try {
    await click(buttonNamed('立即重试', host));
    await settle();
    expect(host.querySelector('[data-jav-picture-gap] p')?.textContent).toBe('来源连接失败');
  } finally { vi.unstubAllGlobals() }
});

async function mountDetail(item: JavDetail, reply: unknown = { ok: true, image: '' }) {
  queryClient.setQueryData(javDetailKey(item.code), item);
  const fetcher = fetchMock(200, reply);
  vi.stubGlobal('fetch', fetcher);
  const mounted = await mountRoot(<QueryClientProvider client={queryClient}><JavDetailPage code={item.code} readOnly
    actions={{ close: vi.fn(), navigate: vi.fn(), openTag: vi.fn(), receipt: vi.fn() }} /></QueryClientProvider>);
  return { fetcher, host: mounted.host, unmount: mounted.unmount };
}

it('没有封面而有样张时仍停在封面那格，写出取图记录的原因，缩略条那格只放图标', async () => {
  // 缩略条只挂可见范围里的那几格；不给 IntersectionObserver，各格直接挂上。
  vi.stubGlobal('IntersectionObserver', undefined);
  const { host, unmount } = await mountDetail({ ...missingCover, preview_count: 2,
    cover_message: '所有渠道都没有候选', cover_message_code: 'errors.javCoverFetch.noCandidates', cover_message_params: {} });
  try {
    expect(host.querySelector('[data-jav-picture-gap] p')?.textContent).toBe('所有渠道都没有候选');
    const gap = host.querySelector('[data-thumbnail-gap]');
    expect(gap?.getAttribute('aria-label')).toBe('封面未取得');
    expect(gap?.textContent).toBe('');
  } finally { await unmount(); vi.unstubAllGlobals() }
});

it('预告没取到时在预告的位置说明，点它重取整页资料', async () => {
  const { fetcher, host, unmount } = await mountDetail({ ...missingCover, has_cover: true, preview_message: 'DMM 视频预览未取得，请稍后重试' },
    { ...missingCover, has_cover: true });
  try {
    expect(host.querySelector('[data-jav-info] [role="note"]')).toBeNull();
    const tag = host.querySelector('[data-jav-preview-toggle][data-unavailable]')!;
    expect(tag.textContent).toBe('视频预览未取得');
    expect(tag.getAttribute('title')).toBe('DMM 视频预览未取得，请稍后重试');
    await click(tag);
    await settle();
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('/api/jav/detail?code=EXM-002&refresh=1');
  } finally { await unmount(); vi.unstubAllGlobals() }
});

it('整页详情没取到时居中给空态，不是红色横条', async () => {
  vi.stubGlobal('fetch', fetchMock(504, { ok: false, error: 'Gateway Timeout' }));
  const mounted = await mountRoot(<QueryClientProvider client={queryClient}><JavDetailPage code="EXM-003" readOnly
    actions={{ close: vi.fn(), navigate: vi.fn(), openTag: vi.fn(), receipt: vi.fn() }} /></QueryClientProvider>);
  try {
    await settle();
    const empty = mounted.host.querySelector('[data-jav-failure] [data-empty-state]');
    expect(empty?.querySelector('h3')?.textContent).toBe('详情未取得');
    expect(empty?.textContent).toContain('EXM-003');
    expect(mounted.host.querySelector('[data-jav-failure] [data-media-error]')).toBeNull();
  } finally { await mounted.unmount(); vi.unstubAllGlobals() }
});
