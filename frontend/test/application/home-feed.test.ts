/* 首页新作那一行的显示开关：关掉后哪条目录路径上都不铺、不开那一行，开着的当场卸掉；打开时人在目录上就当场画。 */
import { beforeEach, expect, it, vi } from 'vitest';

import { appSettingsStore } from '../../src/appearance/settings';
import { feedState, isFeedNewPath, rememberHomeFeed, syncHomeFeedSetting } from '../../src/application/feed.js';

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
