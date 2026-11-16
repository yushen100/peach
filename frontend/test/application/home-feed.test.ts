/* 首页新作那一行的显示开关：关掉后哪条目录路径上都不铺、不开那一行，开着的当场卸掉；打开时人在目录上就当场画。 */
import { beforeEach, expect, it, vi } from 'vitest';

import { appSettingsStore } from '../../src/appearance/settings';
import { clearHomeFeed, feedState, isFeedNewPath, prepareHomeFeed, rememberHomeFeed, renderHomeFeed, syncHomeFeedSetting } from '../../src/application/feed.js';
import { state, writeShell } from '../../src/shell/index';

const managed = vi.hoisted(() => ({ taken: false, opened: [] as string[], released: 0 }));
vi.mock('../../src/history/managed', () => ({
  managedTaken: () => managed.taken,
  openManagedRoute: (name: string) => { managed.opened.push(name); managed.taken = true; return Promise.resolve(true) },
  releaseManagedRoute: () => { managed.released += 1; managed.taken = false },
  updateManagedRoute: () => {},
}));
// 只测这一行的显隐，其余域控制器换成空壳，免得装载整套应用。
vi.mock('../../src/application/catalog.js', () => ({ catalogState: {} }));
vi.mock('../../src/application/preferences.js', () => ({ preferencesState: { appSettings: {} }, wireDrag: () => {} }));
vi.mock('../../src/application/entity.js', () => ({ pushEntityPage: () => {} }));
vi.mock('../../src/application/effects', () => ({ applicationEffects: {} }));

beforeEach(() => {
  document.body.innerHTML = '<section id="feedNew" hidden></section>';
  Object.assign(managed, { taken: false, opened: [], released: 0 });
  appSettingsStore().value.feedNewRows = true;
  window.history.replaceState(null, '', '/');
  writeShell({ state: { ...state, browse: '' } });
  rememberHomeFeed(true);
  feedState.feedNewSkeletonHtml = () => '<div class="feednewskeleton"></div>';
});

it('关掉后目录路径上不再算这一行的地方（首屏骨架、换页与路由都按它判）', () => {
  expect([isFeedNewPath('/'), isFeedNewPath('/junk-files')]).toEqual([true, false]);
  appSettingsStore().value.feedNewRows = false;
  expect(isFeedNewPath('/')).toBe(false);
});

it('设置里关掉时卸掉画着的那一行并收起，打开时人在目录上就当场画，文件夹浏览不画', () => {
  const host = document.getElementById('feedNew')!;
  managed.taken = true;
  host.hidden = false;
  appSettingsStore().value.feedNewRows = false;
  syncHomeFeedSetting(false);
  expect([managed.released, host.hidden]).toEqual([1, true]);

  appSettingsStore().value.feedNewRows = true;
  syncHomeFeedSetting(true);
  expect(managed.opened).toEqual([]);
  syncHomeFeedSetting(false);
  expect(managed.opened).toEqual(['feed-new']);
});

it('收起时卸载查询订阅和在途打开，清除卡片、骨架与等待态，返回目录可重新打开', () => {
  const host = document.getElementById('feedNew')!;
  managed.taken = true;
  host.hidden = false;
  host.setAttribute('aria-busy', 'true');
  host.innerHTML = '<div class="feednewrow"><article data-feed-id="1"></article></div>';
  clearHomeFeed();
  expect([managed.released, managed.taken, host.hidden, host.childElementCount, host.hasAttribute('aria-busy')])
    .toEqual([1, false, true, 0, false]);
  renderHomeFeed();
  expect(managed.opened).toEqual(['feed-new']);
  expect(host.hidden).toBe(false);
});

it.each(['/jav?tab=wants', '/performers', '/performers/7', '/stats', '/trash', '/junk-files'])(
  '%s 的晚到形状结果不重新铺首页新作骨架，也不打开新作组件', (path) => {
    window.history.replaceState(null, '', path);
    const host = document.getElementById('feedNew')!;
    prepareHomeFeed(host);
    renderHomeFeed();
    expect([host.hidden, host.childElementCount, managed.opened]).toEqual([true, 0, []]);
  },
);

it('文件夹浏览中的晚到形状结果不铺新作骨架，退出文件夹后正常打开', () => {
  const host = document.getElementById('feedNew')!;
  writeShell({ state: { ...state, browse: 'folders' } });
  prepareHomeFeed(host);
  renderHomeFeed();
  expect([host.hidden, host.childElementCount, managed.opened]).toEqual([true, 0, []]);
  writeShell({ state: { ...state, browse: '' } });
  renderHomeFeed();
  expect([host.hidden, managed.opened]).toEqual([false, ['feed-new']]);
});
