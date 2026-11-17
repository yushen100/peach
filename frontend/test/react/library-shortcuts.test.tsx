import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerNameWritings, setNameLanguage } from '../../src/core/entity-names';
import { queryClient } from '../../src/react/query';
import { FavoriteButton, LibraryShortcuts } from '../../src/react/library-shortcuts/shortcut-controls';
import { favoriteHref, isFavorite, SHORTCUTS_KEY, type Favorite, type Shortcuts } from '../../src/react/library-shortcuts/library-shortcuts';
import { click, mount, pending, settle, submit, type } from './render';

notifyManager.setScheduler((notify) => notify());
beforeEach(() => { registerNameWritings([]); setNameLanguage('zh-CN') });
afterEach(() => { queryClient.clear() });
const empty: Shortcuts = { favorites: [], filters: [] };

describe('我的收藏', () => {
  it('显示语言同步可见名称和无障碍名称，取消收藏仍提交原名称', async () => {
    const favorite = { key: 'entity:3', entity_id: 3, kind: 'performer', name: '枫花恋' };
    const data = { favorites: [favorite], filters: [] };
    registerNameWritings([{ id: 3, kind: 'performer', canonical_name: '枫花恋', zh_cn: '枫花恋', ja: '楓カレン' }]);
    setNameLanguage('ja');
    const writes: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (init?.body) writes.push(JSON.parse(init.body));
      return { ok: true, json: async () => data };
    }));
    queryClient.setQueryData(SHORTCUTS_KEY, data);
    await mount(<QueryClientProvider client={queryClient}><LibraryShortcuts /></QueryClientProvider>);
    await click(document.querySelector('[aria-label="我的收藏"]')); await settle();
    const link = document.querySelector('[data-shortcuts-row] a');
    expect(link?.textContent).toContain('楓カレン');
    expect(link?.getAttribute('aria-label')).toBe('楓カレン');
    expect(link?.getAttribute('href')).toBe('/performers/3');
    await type(document.querySelector('input[aria-label="搜索收藏"]'), '楓カレン');
    expect(document.querySelectorAll('[data-shortcuts-row]')).toHaveLength(1);
    await type(document.querySelector('input[aria-label="搜索收藏"]'), '枫花恋');
    expect(document.querySelectorAll('[data-shortcuts-row]')).toHaveLength(1);
    await click(document.querySelector('[aria-label="取消收藏楓カレン"]')); await settle();
    expect(writes[0]).toMatchObject({ action: 'favorite', entity_id: 3, name: '枫花恋', on: false });
  });
  it('同名在线标签和本地实体独立收藏，在线链接打开关注筛选', async () => {
    const local: Favorite = { entity_id: 3, kind: 'tag', name: '户外' };
    const online: Favorite = { kind: 'tag', scope: 'online', tag_id: 'outdoors', name: '户外', favorite: false };
    let data: Shortcuts = { favorites: [local], filters: [] };
    const writes: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (init?.body) {
        const body = JSON.parse(init.body); writes.push(body);
        data = { favorites: body.on ? [local, online] : [local], filters: [] };
      }
      return { ok: true, json: async () => data };
    }));
    queryClient.setQueryData(SHORTCUTS_KEY, data);
    const host = await mount(<QueryClientProvider client={queryClient}><FavoriteButton item={online} /></QueryClientProvider>);
    expect(isFavorite([local], online)).toBe(false);
    expect(isFavorite([online], local)).toBe(false);
    expect(favoriteHref(online)).toBe('/follow?tag=%E6%88%B7%E5%A4%96');
    await click(host.querySelector('[aria-label="收藏户外"]')); await settle();
    expect(writes[0]).toMatchObject({ action: 'favorite', scope: 'online', tag_id: 'outdoors', on: true });
    expect(host.querySelector('[data-favorite]')?.getAttribute('aria-pressed')).toBe('true');
    await click(host.querySelector('[aria-label="取消收藏户外"]')); await settle();
    expect(writes[1]).toMatchObject({ scope: 'online', tag_id: 'outdoors', on: false });
    expect(data.favorites).toEqual([local]);
  });

  it('资料页的规范收藏状态不受旧身份缓存影响', async () => {
    queryClient.setQueryData(SHORTCUTS_KEY, { favorites: [
      { entity_id: 2, kind: 'performer', name: '旧人物' },
    ], filters: [] });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const host = await mount(<QueryClientProvider client={queryClient}>
      <FavoriteButton item={{ entity_id: 2, kind: 'performer', name: '新人物', favorite: false }} />
      <FavoriteButton item={{ entity_id: 1, kind: 'performer', name: '合并目标', favorite: true }} />
    </QueryClientProvider>);
    expect(host.querySelector('[aria-label="收藏新人物"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('[aria-label="取消收藏合并目标"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('等待收藏回执时保持可聚焦，回读后允许取消', async () => {
    queryClient.setQueryData(SHORTCUTS_KEY, empty);
    const answer = pending<unknown>();
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (!init?.body) return { ok: true, json: async () => empty };
      calls.push(JSON.parse(init.body));
      return { ok: true, json: async () => calls.length === 1 ? answer.answer : empty };
    }));
    const host = await mount(<QueryClientProvider client={queryClient}>
      <FavoriteButton item={{ entity_id: 1, kind: 'studio', name: '厂牌' }} />
    </QueryClientProvider>);
    await click(host.querySelector('[aria-label="收藏厂牌"]'));
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('true');
    await click(button);
    expect(calls).toHaveLength(1);
    await answer.release({ favorites: [{ key: 'entity:1', entity_id: 1, kind: 'studio', name: '厂牌' }], filters: [] });
    await settle();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await click(host.querySelector('[aria-label="取消收藏厂牌"]'));
    await settle();
    expect(calls[1]).toMatchObject({ action: 'favorite', entity_id: 1, on: false });
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('保存当前条件后显示可应用链接并可删除', async () => {
    let data = empty;
    const writes: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (init?.body) {
        const body = JSON.parse(init.body); writes.push(body);
        data = body.action === 'save_filter' ? { favorites: [], filters: [{ id: 'one', name: body.name, href: body.href }] } : empty;
      }
      return { ok: true, json: async () => data };
    }));
    await mount(<QueryClientProvider client={queryClient}>
      <LibraryShortcuts currentHref={() => '/watch-later?loc=&tag=VR&jav=1'} />
    </QueryClientProvider>);
    await click(document.querySelector('[aria-label="我的收藏"]'));
    await settle();
    expect(document.querySelector('nav[aria-label="收藏作品清单"] a[href="/flagged"]')?.textContent).toBe('已标记');
    expect(document.querySelector('nav[aria-label="收藏作品清单"] a[href="/watch-later"]')?.textContent).toBe('稍后看');
    expect(document.querySelector('form[aria-label="保存当前筛选"]')).toBeNull();
    await click(document.querySelector('[role="tab"][aria-label="保存的筛选"]'));
    await type(document.querySelector('form[aria-label="保存当前筛选"] input'), 'VR 待看');
    await submit(document.querySelector('form'));
    await settle();
    expect(writes[0]).toEqual({ action: 'save_filter', name: 'VR 待看', href: '/watch-later?loc=&tag=VR&jav=1' });
    const savedLink = () => [...document.querySelectorAll('a')].find(link => link.textContent === 'VR 待看');
    expect(savedLink()?.getAttribute('href')).toBe('/watch-later?loc=&tag=VR&jav=1');
    expect(savedLink()?.getAttribute('title')).toBeNull();
    await click(document.querySelector('[aria-label="删除筛选VR 待看"]'));
    await settle();
    expect(savedLink()).toBeUndefined();
  });

  it('收藏链接使用现有实体路由和编码后的标签', () => {
    expect(favoriteHref({ kind: 'studio', name: 'A/B' })).toBe('/studios/A%2FB');
    expect(favoriteHref({ kind: 'tag', name: 'A&B', entity_id: 67 })).toBe('/tags/67');
  });

  it('各类收藏显示可用图像并按名称筛选', async () => {
    const favorites = ['performer', 'creator', 'studio', 'series', 'agency', 'tag'].map((kind, index) =>
      ({ key: `entity:${index + 1}`, entity_id: index + 1, kind, name: `收藏 ${kind}`, image_url: `/test-image/${kind}` }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ favorites, filters: [] }) })));
    await mount(<QueryClientProvider client={queryClient}><LibraryShortcuts /></QueryClientProvider>);
    await click(document.querySelector('[aria-label="我的收藏"]'));
    await settle();
    expect(document.querySelectorAll('[data-shortcuts-avatar] img')).toHaveLength(6);
    expect(document.querySelector('[data-shortcuts-avatar] .ini')).toBeNull();
    await type(document.querySelector('input[aria-label="搜索收藏"]'), 'studio');
    expect(document.querySelectorAll('[data-shortcuts-row]')).toHaveLength(1);
    expect(document.querySelector('[data-shortcuts-row] a')?.getAttribute('href')).toBe('/studios/3');
    await type(document.querySelector('input[aria-label="搜索收藏"]'), 'missing');
    expect(document.querySelector('[data-empty-state] h3')?.textContent).toBe('没有匹配的收藏');
  });
});
