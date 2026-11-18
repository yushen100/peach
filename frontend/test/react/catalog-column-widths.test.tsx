import { act } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultColumnVisibility, useCatalogTablePreferences } from '../../src/react/catalog-grid/catalog-column-widths';
import { columnSizes } from '../../src/react/catalog-grid/catalog-table-columns';
import { mountRoot } from './render';

const key = 'peach.catalog-column-widths.v1';
let sizing!: ReturnType<typeof useCatalogTablePreferences>;
let visibility!: ReturnType<typeof useCatalogTablePreferences>;
function Probe() { sizing = useCatalogTablePreferences(); visibility = sizing; return null }
beforeEach(() => localStorage.clear());

it('损坏或超限偏好不会破坏列宽，选择列保持固定', async () => {
  for (const [saved, name] of [['broken', '1fr'], ['null', '1fr'], ['[]', '1fr'],
    ['{"name":99999,"select":200,"dur":-10,"size":"wide"}', 2000]] as const) {
    localStorage.setItem(key, saved);
    const root = await mountRoot(<Probe />);
    expect(sizing.widths.name).toBe(name);
    expect(sizing.widths.select).toBe(48);
    expect(sizing.widths.dur).toBeGreaterThanOrEqual(columnSizes.dur!.min);
    expect(sizing.widths.size).toBe(columnSizes.size!.width);
    await root.unmount();
  }
});

it('列显示偏好只允许隐藏数据列，保留隐藏列的自定义宽度', async () => {
  localStorage.setItem('peach.catalog-column-visibility.v1', '{"name":false,"select":false,"rating":false,"unknown":false}');
  await mountRoot(<Probe />);
  expect(visibility.visibility).toEqual({ ...defaultColumnVisibility, rating: false });
  await act(() => sizing.save(new Map([['code', 260]])));
  await act(() => sizing.save(new Map([['name', 480]])));
  expect(sizing.widths.code).toBe(260);
  await act(() => visibility.change(current => ({ ...current, played: false })));
  expect(JSON.parse(localStorage.getItem('peach.catalog-column-visibility.v1')!)).toEqual({ ...defaultColumnVisibility, rating: false, played: false });
  await act(() => visibility.change({ code: true }));
  expect(visibility.visibility.code).toBe(true);
  await act(() => visibility.change({}));
  expect(visibility.visibility).toEqual(defaultColumnVisibility);
});

it('调整结束保存列宽，重置清除偏好，存储被禁用时仍可调整', async () => {
  const root = await mountRoot(<Probe />);
  await act(() => sizing.save(new Map([['name', 512], ['select', 100]])));
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ name: 512, select: 48 });
  await root.unmount();
  await mountRoot(<Probe />);
  expect(sizing.widths.name).toBe(512);
  await act(() => sizing.reset());
  expect(sizing.widths.name).toBe('1fr');
  expect(localStorage.getItem(key)).toBeNull();
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('存储未允许') });
  try {
    await act(() => sizing.save(new Map([['name', 480]])));
    expect(sizing.widths.name).toBe(480);
  } finally { blocked.mockRestore() }
});
