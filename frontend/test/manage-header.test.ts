/* 管理区页头的视图模型与启动骨架（`src/manage-header.ts`）：标题取哪个名字、哪几页画面包屑、
 * 窄屏标题收档的判据，以及骨架转义。岛怎么接手由 `react/manage-header.test.tsx` 测。 */
import { describe, expect, it } from 'vitest';

import { manageHeaderSkeletonHtml, manageHeaderView, type ManageEntry, type ManageHeaderProps } from '../src/manage-header';

const SECTIONS: ManageEntry[] = [
  ['stats', '统计', 'chart'], ['cleanup', '数据管理', 'database'], ['trash', '回收站', 'trash'],
  ['configuration', 'Peach 配置', 'settings'],
];
const MENU = SECTIONS.filter(([key]) => key !== 'trash');

const props = (section: string, path: string, patch: Partial<ManageHeaderProps> = {}): ManageHeaderProps =>
  ({ section, path, sections: SECTIONS, menu: MENU, ...patch });

describe('页头判据', () => {
  it('诊断分区共用配置页标题', () => {
    expect(manageHeaderView(props('configuration', '/settings/diagnostics'))).toMatchObject({ title: 'Peach 配置', compact: true });
  });
  it('不在管理区时整块不画', () => {
    expect(manageHeaderView(props('', '/'))).toBeNull();
    expect(manageHeaderSkeletonHtml(props('', '/'))).toBe('');
  });

  it('数据管理之下的子页画面包屑，标题取子页的名字；hub 自己与别的管理区不画', () => {
    expect(manageHeaderView(props('cleanup', '/junk-files'))).toMatchObject({ title: '垃圾文件', crumb: '垃圾文件' });
    expect(manageHeaderView(props('cleanup', '/sources'))).toMatchObject({ title: '来源和凭证', crumb: '来源和凭证' });
    expect(manageHeaderView(props('cleanup', '/data-cleanup'))).toMatchObject({ title: '数据管理', crumb: '' });
    expect(manageHeaderView(props('stats', '/stats'))).toMatchObject({ title: '统计', crumb: '' });
    expect(manageHeaderView(props('trash', '/trash'))).toMatchObject({ title: '回收站', crumb: '回收站' });
  });

  it('修复与迁移挂在应用与维护之下：标题取子页名字，面包屑回到应用与维护，管理条按下配置', () => {
    const view = manageHeaderView(props('configuration', '/settings/maintenance/repairs'))!;
    expect(view).toMatchObject({ title: '修复与迁移', crumb: '修复与迁移', pressed: 'configuration',
      parent: { label: '应用与维护', href: '/settings/maintenance' } });
    const node = document.createElement('div');
    node.innerHTML = manageHeaderSkeletonHtml(props('configuration', '/settings/maintenance/repairs'));
    expect(node.querySelector('[data-manage-crumb] a')!.getAttribute('href')).toBe('/settings/maintenance');
  });

  it('窄屏标题收一档的只有数据管理 hub、来源和凭证与配置', () => {
    const compact = (section: string, path: string) => manageHeaderView(props(section, path))!.compact;
    expect([compact('cleanup', '/data-cleanup'), compact('cleanup', '/sources'), compact('configuration', '/settings/library')])
      .toEqual([true, true, true]);
    expect([compact('cleanup', '/junk-files'), compact('cleanup', '/duplicates'), compact('stats', '/stats')])
      .toEqual([false, false, false]);
  });

});

describe('启动骨架', () => {
  it('管理导航、面包屑和页面标题按层级排列', () => {
    const node = document.createElement('div');
    node.innerHTML = manageHeaderSkeletonHtml(props('cleanup', '/review'));
    expect([...node.children].map(child => child.tagName)).toEqual(['NAV', 'NAV', 'H2']);
    expect(node.firstElementChild?.hasAttribute('data-manage-bar')).toBe(true);
    expect(node.children[1]?.hasAttribute('data-manage-crumb')).toBe(true);
  });
  it('管理条标出当前项，回收站页头止于标题', () => {
    const node = document.createElement('div');
    node.innerHTML = manageHeaderSkeletonHtml(props('trash', '/trash'));
    expect([...node.querySelectorAll<HTMLElement>('[data-manage]')].map((button) => button.dataset.manage))
      .toEqual(['stats', 'cleanup', 'configuration']);
    expect([...node.querySelectorAll<HTMLElement>('[aria-pressed="true"]')].map((button) => button.dataset.manage))
      .toEqual(['cleanup']);
    expect(node.lastElementChild?.hasAttribute('data-manage-title')).toBe(true);
    expect(node.querySelector('[data-manage-crumb] a')!.getAttribute('href')).toBe('/data-cleanup');
    node.innerHTML = manageHeaderSkeletonHtml(props('stats', '/stats'));
    const pressed = node.querySelector('[data-manage="stats"]')!;
    expect([pressed.getAttribute('aria-pressed'), pressed.getAttribute('aria-current')]).toEqual(['true', 'page']);
  });

  it('名字照字面写进去', () => {
    const node = document.createElement('div');
    node.innerHTML = manageHeaderSkeletonHtml({ ...props('x', '/x'), sections: [['x', '<img src=x>', 'a"b']], menu: [['x', '<img src=x>', 'a"b']] });
    expect(node.querySelector('img')).toBeNull();
    expect(node.querySelector('[data-manage-title]')!.textContent).toBe('<img src=x>');
  });
});
