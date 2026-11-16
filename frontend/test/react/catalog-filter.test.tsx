/* 首页筛选条岛：空馆藏与首屏等待时两排、标签条摆什么。
 *
 * 点选、续页、排序、版式与详情往返要真的取数和量布局，由 `frontend/e2e/catalog-filter.test.ts` 在真浏览器里走。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogFilterPage } from '../../src/react/catalog-filter/catalog-filter-page';
import {
  EMPTY_SLOTS, rememberedTiers, rememberTiers, TIERS_SHAPE_KEY, type CatalogFilterProps, type TierPerformer,
} from '../../src/react/catalog-filter/catalog-filter';
import { catalogFilterSkeletonHtml } from '../../src/catalog-filter-skeleton';
import { mount, mountRoot, pending, settle } from './render';

function props(patch: Partial<CatalogFilterProps> = {}): CatalogFilterProps {
  return {
    tiers: { key: 'k', performers: [], studios: [] }, tiersPending: false, empty: false, tags: [], tagFirst: 0,
    views: [{ k: '', label: '全部', href: '/' }], state: '', count: { total: 0, shown: 0 }, trash: false, trashHost: null,
    sorts: [], layout: null, refreshing: false, offscreen: false, combo: [], comboHidden: true, comboHost: null,
    actions: {
      openEntity: vi.fn(), setView: vi.fn(), toggleTag: vi.fn(), clearFilter: vi.fn(), clearAll: vi.fn(),
      setSort: vi.fn(), reshuffle: vi.fn(async () => {}), setLayout: vi.fn(), moreTops: vi.fn(async () => []),
      emptyTrash: vi.fn(),
    },
    helpers: { wireDrag: vi.fn(), wireScroller: vi.fn() },
    ...patch,
  };
}

const count = (host: HTMLElement, selector: string) => host.querySelectorAll(selector).length;

describe('空馆藏', () => {
  it('两排头像与标签条各铺一行静止占位，不挂忙态、不接指针也不进读屏', async () => {
    const host = await mount(<CatalogFilterPage {...props({ empty: true })} />);
    for (const kind of ['performer', 'studio']) {
      expect(count(host, `[data-catalog-placeholder="${kind}"]`)).toBe(EMPTY_SLOTS);
    }
    expect(count(host, '[data-catalog-placeholder="tag"] > span')).toBe(EMPTY_SLOTS);
    expect([...host.querySelectorAll('[data-catalog-placeholder]')].every((node) => node.getAttribute('aria-hidden') === 'true'))
      .toBe(true);
    // 空馆藏说的是「这里将来会有东西」，不是「正在取」：没有微光。
    expect(host.querySelector('[data-loading]')).toBeNull();
    expect(host.querySelector('[data-catalog-tier] [aria-busy="true"]')).toBeNull();
  });

  it('收起时两排头像照留，浮层那两排不画', async () => {
    const host = await mount(<CatalogFilterPage {...props({ empty: true, offscreen: true })} />);
    expect(count(host, '[data-catalog-placeholder="performer"]')).toBe(EMPTY_SLOTS);
    expect(host.querySelector('[data-catalog-frame]')).toBeNull();
  });
});

describe('回收站', () => {
  it('浮层只有下排，画进正文里的宿主：读数后跟「清空回收站」，空了不出；首页那个宿主里不画浮层', async () => {
    const trashHost = document.createElement('div');
    trashHost.innerHTML = '<div class="peach-react" data-skeleton="trash-filter"></div>';
    document.body.append(trashHost);
    const base = props({ trash: true, trashHost, count: { total: 9, shown: 9 }, offscreen: true });
    const host = await mount(<CatalogFilterPage {...base} />);
    expect(host.querySelector('[data-catalog-frame]')).toBeNull();
    // 壳先铺的骨架被换掉，浮层画在宿主里自建的那一层 `.peach-react` 下。
    expect(trashHost.querySelector('[data-skeleton]')).toBeNull();
    const frame = trashHost.querySelector('.peach-react > [data-catalog-frame]')!;
    expect(frame.querySelector('[data-filter-row="top"]')).toBeNull();
    expect(frame.querySelector('[data-catalog-readout]')?.textContent).toBe('9 个符合 · 显示 9');
    expect(frame.querySelector('[data-entity-batch], [data-folder-mode-toggle]')).toBeNull();
    const empty = frame.querySelector<HTMLButtonElement>('[data-empty-trash]')!;
    expect(empty.textContent).toBe('清空回收站');
    empty.click();
    expect(base.actions.emptyTrash).toHaveBeenCalledTimes(1);
    trashHost.remove();
  });

  it('回收站空了不给清空键', async () => {
    const trashHost = document.createElement('div');
    document.body.append(trashHost);
    await mount(<CatalogFilterPage {...props({ trash: true, trashHost, count: { total: 0, shown: 0 } })} />);
    expect(trashHost.querySelector('[data-catalog-readout]')?.textContent).toBe('0 个符合 · 显示 0');
    expect(trashHost.querySelector('[data-empty-trash]')).toBeNull();
    trashHost.remove();
  });
});

describe('首屏等待两排头像', () => {
  beforeEach(() => localStorage.clear());
  const rows = (host: HTMLElement) => [...host.querySelectorAll('[data-catalog-tier]')].map((row) => row.getAttribute('data-catalog-tier'));

  it('本机没有记录或记录坏了时两排都铺占位，壳在取数时整块挂忙态', async () => {
    for (const saved of [null, 'broken', 'null']) {
      if (saved !== null) localStorage.setItem(TIERS_SHAPE_KEY, saved);
      const host = await mount(<CatalogFilterPage {...props({ tiers: null, tiersPending: true })} />);
      expect(rows(host)).toEqual(['performers', 'studios']);
      expect(host.querySelector('[data-catalog-tiers]')?.getAttribute('aria-busy')).toBe('true');
      document.body.innerHTML = '';
    }
  });

  it('不取头像的页面与收起的筛选条不挂忙态：没有一趟取数会来撤它', async () => {
    for (const patch of [{ tiersPending: false }, { tiersPending: true, offscreen: true }]) {
      const host = await mount(<CatalogFilterPage {...props({ tiers: null, ...patch })} />);
      expect(host.querySelector('[data-catalog-tiers]')?.hasAttribute('aria-busy'), JSON.stringify(patch)).toBe(false);
      document.body.innerHTML = '';
    }
  });

  it('照上次画好时的结构铺：上次没人的那排不画，两排都没人时整块不占位', async () => {
    rememberTiers({ performers: false, studios: true });
    const studiosOnly = await mount(<CatalogFilterPage {...props({ tiers: null })} />);
    expect(rows(studiosOnly)).toEqual(['studios']);
    document.body.innerHTML = '';
    rememberTiers({ performers: false, studios: false });
    const none = await mount(<CatalogFilterPage {...props({ tiers: null })} />);
    expect(rows(none)).toEqual([]);
    expect(none.querySelector<HTMLElement>('[data-catalog-tiers]')?.hidden).toBe(true);
  });

  it('取回后撤掉忙态，并记下这次画了哪几排；空馆藏两排占位都算画了', async () => {
    const { host, rerender } = await mountRoot(<CatalogFilterPage {...props({ tiers: null, tiersPending: true })} />);
    await rerender(<CatalogFilterPage {...props({ tiers: { key: 'k', performers: [], studios: [{ name: 'S1', logo: '', fallback: 'S1' }] } })} />);
    expect(host.querySelector('[data-catalog-tiers]')?.hasAttribute('aria-busy')).toBe(false);
    expect(rows(host)).toEqual(['studios']);
    expect(rememberedTiers()).toEqual({ performers: false, studios: true });
    await rerender(<CatalogFilterPage {...props({ empty: true })} />);
    expect(rememberedTiers()).toEqual({ performers: true, studios: true });
  });

  it('岛挂上之前的壳骨架读同一份记录', () => {
    const skeleton = () => {
      const host = document.createElement('div');
      host.innerHTML = catalogFilterSkeletonHtml([{ k: '', label: '全部', href: '/' }], '');
      return host;
    };
    expect(rows(skeleton())).toEqual(['performers', 'studios']);
    rememberTiers({ performers: true, studios: false });
    expect(rows(skeleton())).toEqual(['performers']);
    rememberTiers({ performers: false, studios: false });
    const none = skeleton();
    expect(rows(none)).toEqual([]);
    expect(none.querySelector<HTMLElement>('[data-catalog-tiers]')?.hidden).toBe(true);
  });

  it('设置里关掉首页头像：岛与壳骨架都不画两排，浮层照旧', async () => {
    rememberTiers({ performers: true, studios: true });
    const performer: TierPerformer = { name: '甲', ringHtml: '' };
    const host = await mount(<CatalogFilterPage {...props({ hideTiers: true,
      tiers: { key: 'k', performers: [performer], studios: [] } })} />);
    expect(host.querySelector('[data-catalog-tiers]')).toBeNull();
    expect(host.querySelector('[data-catalog-frame]')).not.toBeNull();
    const skeleton = document.createElement('div');
    skeleton.innerHTML = catalogFilterSkeletonHtml([{ k: '', label: '全部', href: '/' }], '', undefined, false);
    expect(rows(skeleton)).toEqual([]);
    expect(skeleton.querySelector('[data-catalog-frame]')).not.toBeNull();
  });
});

describe('读数', () => {
  it('取数期间是一条微光；这一趟失败时收起，不留着一直转的微光', async () => {
    const waiting = await mount(<CatalogFilterPage {...props({ count: null })} />);
    expect(count(waiting, '[data-skeleton="count"]')).toBe(1);
    document.body.innerHTML = '';
    const failed = await mount(<CatalogFilterPage {...props({ count: false })} />);
    expect(count(failed, '[data-skeleton="count"]')).toBe(0);
    expect(count(failed, '[data-count-readout]')).toBe(1);
    expect(failed.querySelector('[data-count-readout] [aria-busy="true"]')).toBeNull();
    expect(failed.querySelector('[data-catalog-readout]')?.textContent).toBe('');
  });
});

describe('只显示有预览图', () => {
  it('只看有预览图时读数旁给「显示全部」，点下去交给壳；看全部时不出', async () => {
    const showAll = vi.fn();
    const base = props();
    const host = await mount(<CatalogFilterPage {...base} previewOnly actions={{ ...base.actions, showAll }} />);
    const button = [...host.querySelectorAll('[data-catalog-summary] button')].find((node) => node.textContent === '显示全部');
    expect(button).toBeTruthy();
    (button as HTMLButtonElement).click();
    expect(showAll).toHaveBeenCalledOnce();
    document.body.innerHTML = '';
    const all = await mount(<CatalogFilterPage {...base} actions={{ ...base.actions, showAll }} />);
    expect([...all.querySelectorAll('[data-catalog-summary] button')].some((node) => node.textContent === '显示全部')).toBe(false);
  });
});

describe('续页', () => {
  it('上一份名单要的那页还在路上时换了名单，新名单照样续页，旧的那页回来不进这一排', async () => {
    // 一排一枚铺不满一行：没溢出就一直停在右端，每次画完都要下一页。
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    const stale = pending<TierPerformer[]>();
    const moreTops = vi.fn<CatalogFilterProps['actions']['moreTops']>()
      .mockReturnValueOnce(stale.answer)
      .mockResolvedValueOnce([{ name: '新二', ringHtml: '' }])
      .mockResolvedValue([]);
    const tiers = (key: string, name: string) => ({ key, performers: [{ name, ringHtml: '' }], studios: [] });
    const base = props();
    const page = (key: string, name: string) =>
      <CatalogFilterPage {...base} tiers={tiers(key, name)} actions={{ ...base.actions, moreTops }} />;
    const { host, rerender } = await mountRoot(page('旧', '旧一'));
    expect(moreTops).toHaveBeenCalledTimes(1);

    await rerender(page('新', '新一'));
    await settle();
    await stale.release([{ name: '旧二', ringHtml: '' }]);
    await settle();

    const names = [...host.querySelectorAll('[data-tier-performer]')].map((node) => node.getAttribute('data-entity-name'));
    expect(names).toEqual(['新一', '新二']);
    expect(moreTops).toHaveBeenCalledTimes(3);
  });
});
