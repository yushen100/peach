import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { appSettingsStore } from '../../src/appearance/settings';
import { orderLibraries } from '../../src/library-catalog';
import { navigationDefaults, normalizeNavigationOrder } from '../../src/navigation-order';
import { SortableBoardTabs, restoreNavigationOrder } from '../../src/react/components/navigation-order';
import { ObjectOrderDialog } from '../../src/react/components/object-order-dialog';
import { queryClient } from '../../src/react/query';
import { normalizeSortControl, SORT_CONTROL_KEYS, visibleSortControls } from '../../src/sort-controls';
import { SortKeys } from '../../src/react/components/sort-controls';
import { showToast } from '../../src/react/toaster';
import { buttonNamed, click, mount, settle } from './render';

vi.mock('../../src/react/toaster', () => ({ showToast: vi.fn() }));
afterEach(() => {
  queryClient.clear();
  appSettingsStore().value.navigationOrders = {};
  appSettingsStore().value.sortControls = {};
  appSettingsStore().save();
});

it('排序项保留个人顺序和隐藏选择，新增项追加，过期键和重复键被移除', () => {
  const preference = normalizeSortControl('catalog', { order: ['size', 'size', 'removed'], hidden: ['rating', 'removed'] });
  expect(preference.order).toEqual(['size', 'rating', 'o', 'plays', 'dur', 'new', 'played', 'release']);
  expect(preference.hidden).toEqual(['rating']);
  expect(visibleSortControls([{ key: 'rating' }, { key: 'size' }], preference)).toEqual([{ key: 'size' }]);
  expect(normalizeSortControl('follow', null)).toEqual({ order: ['new', 'hot', 'dur'], hidden: [] });
});

it('排序行复用侧栏键盘移动，显示项可全部隐藏并恢复，调整配置保持当前排序', async () => {
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    writes.push(body);
    return { ok: true, json: async () => body };
  }));
  const change = vi.fn();
  const sorts = SORT_CONTROL_KEYS.follow.map(key => ({ key, label: key, ariaLabel: key, pressed: key === 'new', dir: 'desc' as const }));
  const host = await mount(<SortKeys group="follow" sorts={sorts} onSort={change} />);
  await act(async () => host.querySelector('[data-entity-sort="new"]')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })));
  await settle();
  expect([...host.querySelectorAll('[data-entity-sort]')].map(node => node.getAttribute('data-entity-sort'))).toEqual(['hot', 'new', 'dur']);
  expect(writes).toContainEqual({ sortControls: { follow: { order: ['hot', 'new', 'dur'], hidden: [] } } });
  expect(change).not.toHaveBeenCalled();
  expect(host.querySelector('[data-entity-sort="new"]')?.getAttribute('aria-pressed')).toBe('true');
  await click(host.querySelector('[data-sort-settings]'));
  await settle();
  for (const input of document.querySelectorAll('[data-navigation-rows] input[type="checkbox"]')) await click(input);
  await settle();
  expect(host.querySelectorAll('[data-entity-sort]')).toHaveLength(0);
  expect(host.querySelector('[data-sort-settings]')).not.toBeNull();
  expect(appSettingsStore().value.sortControls.follow?.hidden).toHaveLength(3);
  await click(buttonNamed('恢复默认排序项'));
  await settle();
  expect([...host.querySelectorAll('[data-entity-sort]')].map(node => node.getAttribute('data-entity-sort'))).toEqual(['new', 'hot', 'dur']);
  expect(change).not.toHaveBeenCalled();
});

it('收藏固定全部首项，导航追加新增项并剔除重复及过期键', () => {
  expect(normalizeNavigationOrder('favorites', ['tag', 'all', 'tag', 'removed']).slice(0, 3)).toEqual(['all', 'tag', 'filters']);
  expect(normalizeNavigationOrder('jav', null)).toEqual(['library', 'wants', 'releases', 'discover']);
  expect(orderLibraries([{ id: 'a' }, { id: 'b' }, { id: 'new' }], ['gone', 'b', 'a'], row => row.id).map(row => row.id))
    .toEqual(['b', 'a', 'new']);
});

it('键盘调整导航保存稳定 ID，选中分区保留，重置后可撤销', async () => {
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    writes.push(body);
    return { ok: true, json: async () => body };
  }));
  const change = vi.fn();
  const host = await mount(<SortableBoardTabs group="jav" value="library" onChange={change} label="JAV 分区"
    tabs={navigationDefaults('jav').map(value => ({ value, label: value }))} />);
  expect(host.querySelector('[data-navigation-menu]')).toBeNull();
  await act(async () => host.querySelector('[data-tab="wants"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true })));
  await settle();
  expect([...host.querySelectorAll('[role="tab"]')].map(el => el.getAttribute('data-tab'))).toEqual(['wants', 'library', 'releases', 'discover']);
  expect(host.querySelector('[aria-selected="true"]')?.getAttribute('data-tab')).toBe('library');
  expect(change).not.toHaveBeenCalled();
  expect(host.querySelector('[data-navigation-menu]')).not.toBeNull();
  expect(writes).toContainEqual({ navigationOrders: { jav: ['wants', 'library', 'releases', 'discover'] } });
  const commit = vi.fn();
  restoreNavigationOrder({ label: 'JAV 分区', keys: ['wants', 'library', 'releases', 'discover'], defaults: navigationDefaults('jav'), commit });
  expect(commit).toHaveBeenLastCalledWith(navigationDefaults('jav'));
  const options = vi.mocked(showToast).mock.calls.at(-1)![1];
  options.action?.run(document.createElement('button'));
  expect(commit).toHaveBeenLastCalledWith(['wants', 'library', 'releases', 'discover']);
});

it('对象顺序先在弹层调整，保存失败保留顺序和错误，重试成功才关闭', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('列表已变化')).mockResolvedValueOnce(undefined);
  const close = vi.fn();
  await mount(<ObjectOrderDialog title="调整筛选顺序" items={[{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }]} save={save} close={close} />);
  await click(document.querySelector('[aria-label="上移 乙"]'));
  expect(save).not.toHaveBeenCalled();
  await click(buttonNamed('保存顺序', document));
  await settle();
  expect(save).toHaveBeenLastCalledWith(['b', 'a']);
  expect(document.body.textContent).toContain('列表已变化');
  expect(close).not.toHaveBeenCalled();
  await click(buttonNamed('保存顺序', document));
  await settle();
  expect(close).toHaveBeenCalledOnce();
});
