/* 重复文件页：每组留谁、批量保留、回收与撤销。
 *
 * 首屏和真实路径一样先落进共用缓存（遗留层 `prefetch` 那一步），页面挂上去直接读。 */
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as legacyUi from '@peach/legacy/ui';
import { advanceImageFallback } from '../../src/card-art/image-fallback';

import { DuplicatesPage } from '../../src/react/duplicates/duplicates-page';
import { ComparisonText } from '../../src/react/review/comparison-text';
import {
  batchOperate, cloudPreferenceLocations, DUPLICATES_KEY, duplicateVictims, mixedCloudPreferences, prefetchDuplicates,
  type DuplicateFile, type DuplicateGroup, type DuplicatesData,
} from '../../src/react/duplicates/duplicates';
import { cloudLocations, MEDIA_SOURCES_KEY, type MediaSourcesData } from '../../src/react/media-sources';
import { queryClient } from '../../src/react/query';
import { buttonNamed, click, fetchMock, mount, sentBody, settle } from './render';

afterEach(() => { queryClient.clear() });
notifyManager.setScheduler((notify) => notify());

const GB = 1073741824;

const file = (id: number, patch: Partial<DuplicateFile> = {}): DuplicateFile => ({
  id, name: `ABC-${id}.mp4`, path: `R:\\media\\ABC-${id}.mp4`, location: 'local', drive: 'R:',
  size: GB, duration: 3600, is_largest: false, is_longest: false, ...patch,
});

const group = (code: string, files: DuplicateFile[], patch: Partial<DuplicateGroup> = {}): DuplicateGroup => ({
  code, files, count: files.length, identical: false, drives: ['R:'], cross_drive: false,
  reclaimable: GB, ...patch,
});

/** 一组全在本地，一组本地与 115 混着。 */
const groups = [
  group('ABC-001', [file(1, { size: 2 * GB, is_largest: true }), file(2, { is_longest: true })], { identical: true }),
  group('ABC-002', [file(3, { size: 3 * GB, is_largest: true, is_longest: true }), file(4, { location: '115', drive: 'B:' })],
    { cross_drive: true, drives: ['R:', 'B:'] }),
];
const data: DuplicatesData = { total: 2, files: 4, reclaimable: 2 * GB, groups };
const sources: MediaSourcesData = {
  sources: [{ location: 'local', online: true, roots: [{ online: true }] }, { location: '115', online: false, roots: [{ online: false }] },
    { location: 'pikpak', online: true, roots: [] }],
};

type Confirmation = Parameters<typeof legacyUi.confirmModal>[0];

/** 确认弹层直接点确认，并记下弹层上写的是什么。 */
function confirmEverything() {
  const seen: Confirmation[] = [];
  vi.spyOn(legacyUi, 'confirmModal').mockImplementation((async (options: Confirmation) => {
    seen.push(options);
    await options.onConfirm?.();
    return { confirmed: true };
  }) as typeof legacyUi.confirmModal);
  return seen;
}

async function open(payload: DuplicatesData = data) {
  queryClient.setQueryData(DUPLICATES_KEY, payload);
  queryClient.setQueryData(MEDIA_SOURCES_KEY, sources);
  const props = { openItem: vi.fn(), toast: vi.fn(), failure: vi.fn() };
  const host = await mount(<QueryClientProvider client={queryClient}><DuplicatesPage {...props} /></QueryClientProvider>);
  return { host, ...props };
}

const card = (host: ParentNode, code: string) => host.querySelector(`section[aria-label="${code}"]`)!;

it('重复副本优先显示已有封面，加载失败后依次回退抽帧和播放占位', async () => {
  const files = [file(1, { code: 'ABC-001', has_cover: true, cover_version: 'cover-v1' }), file(2)];
  const { host } = await open({ total: 1, files: 2, reclaimable: GB, groups: [group('ABC-001', files)] });
  const images = host.querySelectorAll<HTMLImageElement>('.duplicate-row img');
  expect(images[0]!.getAttribute('src')).toBe('/cover?code=ABC-001&thumb=2&v=cover-v1');
  expect(images[1]!.getAttribute('src')).toBe('/thumb?id=2&c=4');
  expect(advanceImageFallback(images[0])).toBe('retry');
  expect(images[0]!.getAttribute('src')).toBe('/thumb?id=1&c=4');
  expect(advanceImageFallback(images[0])).toBe('drop');
  expect(host.querySelectorAll('.duplicate-row img')).toHaveLength(1);
  expect(host.querySelector('button[aria-label="预览 ABC-1.mp4"]')).not.toBeNull();
});

describe('网盘保留选项', () => {
  it('本地与在线来源不算网盘；已配置但离线的网盘仍然算，没配根目录的不算', () => {
    expect(cloudLocations({ sources: [{ location: 'local', online: true }, { location: 'online', online: true }] })).toEqual([]);
    expect(cloudLocations(sources)).toEqual(['115']);
  });

  it('只给组内真的出现过、且已配置的网盘', () => {
    expect(cloudPreferenceLocations([{ location: 'local' }], ['115', 'pikpak'])).toEqual([]);
    expect(cloudPreferenceLocations([{ location: 'local' }, { location: '115' }], ['115', 'pikpak'])).toEqual(['115']);
    expect(cloudPreferenceLocations([{ location: '115' }], [])).toEqual([]);
  });

  it('整组都在同一个网盘时不给「留 115」：留它和留最大是同一个结果', () => {
    expect(mixedCloudPreferences([{ location: '115' }, { location: '115' }], ['115'])).toEqual([]);
    expect(mixedCloudPreferences([{ location: '115' }, { location: 'local' }], ['115'])).toEqual(['115']);
  });
});

describe('每组留谁', () => {
  it('留最大、留最长按服务端标的那一个；指名网盘时那里没有就退回全组最大；整组回收一个不留', () => {
    expect(duplicateVictims(groups, 'largest')).toEqual([2, 4]);
    expect(duplicateVictims(groups, 'longest')).toEqual([1, 4]);
    expect(duplicateVictims(groups, '115')).toEqual([2, 3]);
    expect(duplicateVictims([groups[1]!], 'all')).toEqual([3, 4]);
  });
});

it('首屏一次取回分组和来源可达性，页面挂上去不再补取', async () => {
  const fetcher = vi.fn(async (path: string) => ({
    ok: true, status: 200, json: async () => (path === '/api/sources' ? sources : data),
  }));
  vi.stubGlobal('fetch', fetcher);
  await prefetchDuplicates(new AbortController().signal);
  const host = await mount(
    <QueryClientProvider client={queryClient}>
      <DuplicatesPage openItem={vi.fn()} toast={vi.fn()} failure={vi.fn()} />
    </QueryClientProvider>);
  expect(fetcher.mock.calls.map((call) => call[0]).sort()).toEqual(['/api/duplicates?limit=120', '/api/sources']);
  expect(host.textContent).toContain('2 组');
  expect(host.textContent).toContain('4 个文件 · 可回收 2.0 GB');
});

it('组头说清判据：sha1 齐全才写「一致」，否则只是时长推断；跨盘的组写出盘符', async () => {
  vi.stubGlobal('fetch', fetchMock(200, {}));
  const { host } = await open();
  expect(card(host, 'ABC-001').textContent).toContain('sha1 一致');
  expect(card(host, 'ABC-002').textContent).toContain('时长推断');
  expect(card(host, 'ABC-002').textContent).toContain('跨盘 R: B:');
  expect(card(host, 'ABC-001').textContent).not.toContain('跨盘');
});

it('「留 115」只出现在混着 115 与别处文件的那一组，批量条上的「全部优先 115」同理', async () => {
  vi.stubGlobal('fetch', fetchMock(200, {}));
  const { host } = await open();
  expect(buttonNamed('留 115', card(host, 'ABC-001'))).toBeNull();
  expect(buttonNamed('留 115', card(host, 'ABC-002'))).not.toBeNull();
  expect(buttonNamed('全部优先 115', host)).not.toBeNull();
  expect(buttonNamed('留 115', card(host, 'ABC-002'))?.querySelector('svg use')?.getAttribute('href'))
    .toBe(`#i-${legacyUi.MEDIA_SOURCE_ICONS['115']}`);
  expect(buttonNamed('全部优先 115', host)?.querySelector('svg use')?.getAttribute('href'))
    .toBe(`#i-${legacyUi.MEDIA_SOURCE_ICONS['115']}`);
  expect(buttonNamed('全部优先 PikPak', host)).toBeNull();
});

it('批量保留最大先确认，弹层点名条数与字节数；确认后进回收站，回执带撤销', async () => {
  const seen = confirmEverything();
  const fetcher = fetchMock(200, { ok: true });
  vi.stubGlobal('fetch', fetcher);
  const { host, toast } = await open();
  await click(buttonNamed('全部保留最大', host));
  await settle();
  expect(seen).toHaveLength(1);
  expect(seen[0]!.body).toContain('将 2 组里的 2 个重复文件移入回收站（共 2.0 GB）');
  expect(seen[0]!.body).toContain('每组保留最大的一个。完成后可在回执里撤销。');
  const batch = fetcher.mock.calls.findIndex((call) => call[0] === '/api/batch');
  expect(sentBody(fetcher, batch)).toEqual({ ids: [2, 4], operation: 'dispose', disposal_reason: 'duplicate' });
  expect(toast).toHaveBeenCalledWith('已把 2 项移入回收站', expect.objectContaining({ undo: expect.any(Function) }));
  const { undo } = toast.mock.calls[0]![1] as { undo(): Promise<void> };
  await undo();
  const batches = fetcher.mock.calls.flatMap((call, index) => (call[0] === '/api/batch' ? [index] : []));
  expect(sentBody(fetcher, batches.at(-1))).toEqual({ ids: [2, 4], operation: 'restore' });
});

it('逐文件选择只回收勾选的副本，并给出保留数及撤销', async () => {
  const seen = confirmEverything();
  const fetcher = fetchMock(200, { ok: true });
  vi.stubGlobal('fetch', fetcher);
  const { host, toast } = await open();
  const selected = card(host, 'ABC-001');
  const one = selected.querySelector<HTMLInputElement>('input[aria-label="选择回收 ABC-1.mp4"]')!;
  const two = selected.querySelector<HTMLInputElement>('input[aria-label="选择回收 ABC-2.mp4"]')!;
  expect(one.checked).toBe(false);
  expect(two.checked).toBe(false);
  await click(two);
  await click(buttonNamed('回收所选 1 项', selected));
  await settle();
  expect(seen[0]!.body).toContain('其余 1 个文件保留');
  expect(seen[0]!.holdToConfirm).toBe(true);
  const batch = fetcher.mock.calls.findIndex((call) => call[0] === '/api/batch');
  expect(sentBody(fetcher, batch)).toEqual({ ids: [2], operation: 'dispose', disposal_reason: 'duplicate' });
  const { undo } = toast.mock.calls[0]![1] as { undo(): Promise<void> };
  await undo();
  const batches = fetcher.mock.calls.flatMap((call, index) => call[0] === '/api/batch' ? [sentBody(fetcher, index)] : []);
  expect(batches.at(-1)).toEqual({ ids: [2], operation: 'restore' });
});

it('逐文件回收失败保留选择并显示错误', async () => {
  vi.stubGlobal('fetch', fetchMock(500, { error: 'write failed' }));
  const seen: Confirmation[] = [];
  vi.spyOn(legacyUi, 'confirmModal').mockImplementation((async (options: Confirmation) => {
    seen.push(options);
    await Promise.resolve(options.onConfirm?.()).catch(() => {});
    return { confirmed: false };
  }) as typeof legacyUi.confirmModal);
  const { host, toast } = await open();
  const selected = card(host, 'ABC-001');
  const two = selected.querySelector<HTMLInputElement>('input[aria-label="选择回收 ABC-2.mp4"]')!;
  await click(two);
  await click(buttonNamed('回收所选 1 项', selected));
  await settle();
  expect(two.checked).toBe(true);
  expect(host.textContent).toContain('移入回收站失败');
  expect(toast).not.toHaveBeenCalled();
});

it('回收请求每批最多 200 条，剩余项按原顺序发送', async () => {
  const fetcher = fetchMock(200, { ok: true });
  vi.stubGlobal('fetch', fetcher);
  const ids = Array.from({ length: 201 }, (_, index) => index + 1);
  await batchOperate(ids, 'dispose');
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/api/batch', '/api/batch']);
  expect(sentBody(fetcher, 0)).toEqual({ ids: ids.slice(0, 200), operation: 'dispose', disposal_reason: 'duplicate' });
  expect(sentBody(fetcher, 1)).toEqual({ ids: [201], operation: 'dispose', disposal_reason: 'duplicate' });
});

it('取消确认就什么都不发', async () => {
  vi.spyOn(legacyUi, 'confirmModal').mockImplementation((async () => ({ confirmed: false })) as typeof legacyUi.confirmModal);
  const fetcher = fetchMock(200, { ok: true });
  vi.stubGlobal('fetch', fetcher);
  const { host } = await open();
  await click(buttonNamed('整组回收', card(host, 'ABC-001')));
  await settle();
  expect(fetcher.mock.calls.some((call) => call[0] === '/api/batch')).toBe(false);
});

it('「都保留」不进回收站也不弹确认，整组一条；回执撤销发回同一组', async () => {
  const confirm = vi.spyOn(legacyUi, 'confirmModal');
  const fetcher = fetchMock(200, { ok: true });
  vi.stubGlobal('fetch', fetcher);
  const { host, toast } = await open();
  await click(buttonNamed('都保留', card(host, 'ABC-002')));
  await settle();
  expect(confirm).not.toHaveBeenCalled();
  const batches = () => fetcher.mock.calls.flatMap((call, index) => (call[0] === '/api/batch' ? [sentBody(fetcher, index)] : []));
  expect(batches()).toEqual([{ ids: [3, 4], operation: 'keep-duplicates' }]);
  expect(toast).toHaveBeenCalledWith('ABC-002 这组都保留，不再列出', expect.objectContaining({ undo: expect.any(Function) }));
  const { undo } = toast.mock.calls[0]![1] as { undo(): Promise<void> };
  await undo();
  expect(batches().at(-1)).toEqual({ ids: [3, 4], operation: 'reconsider-duplicates' });
});

it('标过都保留的组数写在「已保留」入口上，空态时也写', async () => {
  vi.stubGlobal('fetch', fetchMock(200, {}));
  const { host } = await open({ total: 0, files: 0, reclaimable: 0, groups: [], kept: 3 });
  expect(buttonNamed('已保留 3 组', host)).not.toBeNull();
  const plain = await open();
  expect(buttonNamed('已保留 0 组', plain.host)).not.toBeNull();
});

it('点封面或文件名打开那一项', async () => {
  vi.stubGlobal('fetch', fetchMock(200, {}));
  const { host, openItem } = await open();
  await click(host.querySelector('button[aria-label="预览 ABC-3.mp4"]'));
  await click(host.querySelector('button[title="ABC-4.mp4"]'));
  expect(openItem.mock.calls).toEqual([[3], [4]]);
});

it('没有重复组时是一张空态，不画批量条', async () => {
  vi.stubGlobal('fetch', fetchMock(200, {}));
  const { host } = await open({ total: 0, files: 0, reclaimable: 0, groups: [] });
  expect(host.textContent).toContain('没有找到重复文件');
  expect(buttonNamed('全部保留最大', host)).toBeNull();
});

it('完整保留相同文件名，并以复核高亮标出名称和路径差异', async () => {
  const shared = 'ssni-677-C.mp4';
  const files = [file(1, { name: shared, path: 'R:\\first\\ssni-677-C.mp4' }),
    file(2, { name: shared, path: 'R:\\second\\ssni-677-C.mp4' })];
  const { host } = await open({ total: 1, files: 2, reclaimable: GB, groups: [group('SSNI-677', files)] });
  const names = host.querySelectorAll('button[title="ssni-677-C.mp4"]');
  expect([...names].map(name => name.textContent)).toEqual([shared, shared]);
  expect(host.querySelectorAll('.duplicate-row mark[data-review-difference]').length).toBeGreaterThan(0);
});

it('文件名的不同规格用复核高亮显示，原文完整保留', async () => {
  const files = [file(1, { name: 'ABC-123 [1080p].mp4' }), file(2, { name: 'ABC-123 [720p].mp4' })];
  const { host } = await open({ total: 1, files: 2, reclaimable: GB, groups: [group('ABC-123', files)] });
  for (const item of files) {
    const name = host.querySelector(`button[title="${item.name}"]`)!;
    expect(name.textContent).toBe(item.name);
    expect(name.querySelector('mark[data-review-difference]')).not.toBeNull();
  }
});

it('中间截断保留可见差异高亮，恢复完整宽度后原文与高亮一起恢复', async () => {
  const value = '甲ABC-123 [1080p] 演示文件.mp4';
  const reference = '乙ABC-123 [720p] 演示文件.mp4';
  const host = await mount(<ComparisonText value={value} reference={reference} cut={{ start: 3, end: value.length - 4 }} />);
  expect(host.textContent).toBe('甲AB….mp4');
  expect(host.querySelector('mark')?.textContent).toBe('甲');
  const full = await mount(<ComparisonText value={value} reference={reference} />);
  expect(full.textContent).toBe(value);
  expect(full.querySelector('mark')?.textContent).toBe('甲');
});
