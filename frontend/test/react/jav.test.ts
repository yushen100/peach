import { expect, it } from 'vitest';
import { discoveryArtwork, javLibraryPath, javPath, javTab, type Discovery } from '../../src/react/jav/jav';
import { controlDiscoveryMetadata, discoveryKey, fetchDiscoveries, fetchDiscoveryMetadata, fetchReleases, releaseFilters,
  releaseKey, releaseColumnValues, releaseColumnSelection, setReleaseColumn } from '../../src/react/jav/jav';
import { discoveryScore, recommendationScore } from '../../src/react/jav/discovery-sorts';
import { vi } from 'vitest';
import { advanceImageFallback } from '../../src/card-art/image-fallback';

it('口味分保留零值、小数与负排序分，未取得读数不伪装成零', () => {
  expect(discoveryScore(0)).toBe('0.000');
  expect(discoveryScore(0.004)).toBe('0.004');
  expect(discoveryScore(-0.125)).toBe('-0.125');
  for (const value of [undefined, null, NaN, Infinity]) expect(discoveryScore(value)).toBe('—');
});
it('推荐标签使用固定百分制与档次，未知值和越界值有明确读数', () => {
  expect(recommendationScore(0.337)).toEqual({ score: '34', label: '值得看看', color: 'yellow' });
  for (const [input, score, label] of [[0, '0', '探索'], [-0.1, '0', '探索'], [0.5, '50', '推荐'], [0.75, '75', '强烈推荐'], [1.2, '100', '强烈推荐']] as const) {
    expect(recommendationScore(input)).toMatchObject({ score, label });
  }
  for (const value of [undefined, null, NaN, Infinity]) expect(recommendationScore(value)).toMatchObject({ score: '—', label: '资料未取得' });
});
it('发现查询隔离排序缓存且只读，资料读取用 POST 起停、进度单独轮询', async () => {
  const requests: { url: URL; method: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    requests.push({ url: new URL(input, 'https://peach.test'), method: init?.method || 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null });
    return { ok: true, status: 200, json: async () => ({ items: [], candidate_total: 0, limited: false }) };
  }));
  try {
    const signal = new AbortController().signal;
    await fetchDiscoveries('external', signal, { sort: 'source_score', direction: 'asc' });
    expect(Object.fromEntries(requests[0]!.url.searchParams)).toEqual({ scope: 'external', limit: '100', sort: 'source_score', direction: 'asc' });
    await fetchDiscoveryMetadata(signal);
    expect([requests[1]!.method, requests[1]!.url.pathname]).toEqual(['GET', '/api/jav/discoveries/metadata']);
    await controlDiscoveryMetadata('cancel', { sort: 'duration', jobId: 'current' }, signal);
    expect([requests[2]!.method, requests[2]!.url.pathname]).toEqual(['POST', '/api/jav/discoveries/metadata']);
    expect(requests[2]!.body).toMatchObject({ action: 'cancel', sort: 'duration', direction: 'desc', job_id: 'current' });
    expect(discoveryKey('external', 'taste')).not.toEqual(discoveryKey('external', 'duration'));
  } finally { vi.unstubAllGlobals() }
});

it('发现封面优先本机缓存，远程封面经 Peach 代理并保留原地大小图取景身份', () => {
  const item = { id: 1, code: 'ABC-001', has_cover: true, cover_url: 'https://pics.dmm.co.jp/digital/video/abc00001/abc00001pl.jpg' } as Discovery;
  const local = document.createElement('div');
  local.innerHTML = discoveryArtwork(item, 'big', 'cover');
  expect(local.querySelector('img')?.getAttribute('src')).toContain('/cover?code=ABC-001');
  local.innerHTML = discoveryArtwork({ ...item, has_cover: false }, 'small', 'cover');
  const image = local.querySelector('img')!;
  expect(image.getAttribute('src')).toBe('/cover-image?code=ABC-001');
  expect(image.dataset.javImageLayout).toBe('small');
  expect(image.dataset.javCover).toBe('/cover-image?code=ABC-001');
  expect(local.innerHTML).not.toContain('dmm.co.jp');
  expect(advanceImageFallback(image)).toBe('drop');
  expect(local.querySelector('span.media-nopic')?.textContent).toBe('封面未取得');
  expect(discoveryArtwork({ ...item, has_cover: false, code: '' }, 'small', 'cover')).toBe('');
});
it('JAV 分区从深链恢复，未知分区落在馆藏', () => {
  expect(javTab('discover')).toBe('discover'); expect(javTab('wants')).toBe('wants'); expect(javTab('other')).toBe('library');
});
it('新作列头多选保留旧地址条件，分页归零，地址和请求恢复同一份选择', async () => {
  const original = releaseFilters('?page=3&performer=Alice&studio=Studio');
  expect(releaseColumnValues(original, 'performer')).toEqual(['Alice']);
  const next = setReleaseColumn(original, 'performer', ['Alice', 'Bob, Jr.']);
  expect(next.page).toBe(1);
  expect(next.performer).toBe('');
  const restored = releaseFilters(`?studio=Studio&column_filters=${encodeURIComponent(next.column_filters!)}`);
  expect(releaseColumnValues(restored, 'performer')).toEqual(['Alice', 'Bob, Jr.']);
  expect(releaseColumnValues(restored, 'studio')).toEqual(['Studio']);
  expect(JSON.parse(setReleaseColumn(restored, 'performer', []).column_filters!)).toEqual({ people: [] });
  expect(setReleaseColumn(restored, 'performer', undefined).column_filters).toBe('');
  const excluded = setReleaseColumn(restored, 'performer', { exclude: ['Bob, Jr.'] });
  expect(JSON.parse(excluded.column_filters!)).toEqual({ people: { exclude: ['performer:Bob, Jr.'] } });
  expect(releaseColumnSelection(excluded, 'performer')).toEqual({ exclude: ['Bob, Jr.'] });
  const fetcher = vi.fn(async (_input: string) => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));
  vi.stubGlobal('fetch', fetcher);
  try {
    await fetchReleases(restored, new AbortController().signal);
    const params = new URL(String(fetcher.mock.calls[0]![0]), 'https://peach.test').searchParams;
    expect(JSON.parse(params.get('column_filters')!)).toEqual({ people: ['performer:Alice', 'performer:Bob, Jr.'] });
    expect(params.get('studio')).toBe('Studio');
  } finally { vi.unstubAllGlobals() }
});
it('新作页大小从地址恢复，查询参数与缓存按页大小隔离', async () => {
  const filters = releaseFilters('?page=3&size=50&tag=剧情&sort=duration&dir=asc');
  expect(filters).toMatchObject({ page: 3, size: 50, tag: '剧情', sort: 'duration', dir: 'asc' });
  expect(releaseKey(filters)).not.toEqual(releaseKey({ ...filters, size: 20 }));
  for (const size of ['0', '-1', '2.5', '101', 'Infinity', 'unknown']) {
    expect(releaseFilters(`?size=${size}`).size).toBe(24);
  }
  expect(releaseFilters('?page=Infinity').page).toBe(1);
  const fetcher = vi.fn(async (_input: string) => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));
  vi.stubGlobal('fetch', fetcher);
  try {
    await fetchReleases(filters, new AbortController().signal);
    const params = new URL(String(fetcher.mock.calls[0]?.[0]), 'https://peach.test').searchParams;
    expect(Object.fromEntries(params)).toEqual({ page: '3', size: '50', sort: 'duration', direction: 'asc', tag: '剧情' });
  } finally { vi.unstubAllGlobals() }
});
it('JAV 馆藏深链保留搜索和筛选条件，使用目录入口', () => {
  const url = new URL(javLibraryPath('?tab=library&q=ABC-123&studio=演示厂牌&loc=cloud&sort=new&jav=0'), 'https://peach.test');
  expect(url.pathname).toBe('/');
  expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'ABC-123', studio: '演示厂牌', loc: 'cloud', sort: 'new', jav: '1' });
  expect(javPath('library')).toBe('/?jav=1');
  expect(javPath('unknown')).toBe('/?jav=1');
  expect(javPath('discover')).toBe('/jav?tab=discover');
  expect(javPath('wants')).toBe('/jav?tab=wants');
});
