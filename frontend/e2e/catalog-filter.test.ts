/* 首页上方那一整块：两排头像、玻璃浮层的两排（视图与标签、读数与排序）和网格上面那条交集条
 * （`catalog-filter` 岛，ADR-0031）。
 *
 * 作品、详情与图片沿用 `item-fixture.ts` 的桩；两排头像（`/api/tops`）、标签（`/api/facets` 的 `tags`）
 * 与目录列表在这里另给一份，好数请求、好让「按了什么」和「重取了几次」对得上。验的是行为：
 * 点下去发什么请求、按下态与地址怎么变、详情往返时这几排是不是原来那批节点。外观对照另有截图。 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Browser, Page } from 'playwright-core';

import { launch, layout, settle, VIEWPORTS, withPageDiagnostics } from './harness.ts';
import { CATALOG, ITEM, openItemPage, type ItemVisit } from './item-fixture.ts';

const DESKTOP = VIEWPORTS.find((viewport) => !viewport.mobile)!;
const PHONE = VIEWPORTS.find((viewport) => viewport.mobile)!;
const DETAIL_READY = '#stage[open] [data-item-side]';
const FILTER = '[data-catalog-filter]';
const READOUT = `${FILTER} [data-count-readout]`;

/** 第一页四十位女优、十个厂牌；女优那排还有一页二十位，再往后就到底了。 */
const PERFORMERS = Array.from({ length: 60 }, (_, at) => ({
  id: 95_000 + at, k: `演示女优${String(at + 1).padStart(2, '0')}`, n: 60 - at,
  has_image: true, has_avatar: false, avatar_focus: null, rep: null,
}));
const STUDIOS = Array.from({ length: 10 }, (_, at) => ({ k: `演示厂牌${at + 1}`, n: 20 - at, has_logo: false }));
const TAGS = Array.from({ length: 40 }, (_, at) => ({ k: `演示标签${String(at + 1).padStart(2, '0')}`, n: 90 - at }));

interface Counts {
  /** 目录分页带 offset；竖屏、搜索推荐与库存在性探测各走各的。窄屏首批可以只有一张。 */
  items: URL[];
  summaries: URL[];
  facets: URL[];
  tops: URL[];
}

const pathIs = (page: Page, path: string) => page.waitForFunction(
  (want) => decodeURIComponent(location.pathname) === want, path, { timeout: 10_000 });
const withoutPlayer = (problems: string[]) => problems.filter((line) => !line.includes('VIDEOJS'));

/** 等 Node 这一侧记下的请求数到位：桩在 Node 里计数，页面里的 `waitForFunction` 读不到。 */
async function until(done: () => boolean, message: string | (() => string), timeout = 10_000) {
  const end = Date.now() + timeout;
  while (!done()) {
    if (Date.now() > end) assert.fail(typeof message === 'function' ? message() : message);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** 打开首页：桩装好之后重新载入，等到读数出现、等待态结束。 */
async function openHome(browser: Browser, path = '/', viewport = DESKTOP): Promise<ItemVisit & { counts: Counts }> {
  const opened = await openItemPage(browser, '/', viewport, { ready: '#grid [data-media-card]' });
  const { page } = opened;
  const counts: Counts = { items: [], summaries: [], facets: [], tops: [] };
  await page.route((url) => url.pathname === '/api/tops', (route) => {
    const url = new URL(route.request().url());
    counts.tops.push(url);
    const page = Number(url.searchParams.get('page') || 0);
    const performers = page === 0 ? PERFORMERS.slice(0, 40) : page === 1 ? PERFORMERS.slice(40) : [];
    return route.fulfill({ json: { performers, studios: page ? [] : STUDIOS } });
  });
  await page.route((url) => url.pathname === '/api/facets', async (route) => {
    const url = new URL(route.request().url());
    counts.facets.push(url);
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), tags: url.searchParams.has('scope_kind') ? TAGS.slice(0, 1) : TAGS } });
  });
  /* 加一条标签筛选，列表就只剩一半：读数跟着换，才看得出这一趟真按新口径取了。 */
  await page.route((url) => url.pathname === '/api/items', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('summary_only') === '1') counts.summaries.push(url);
    else if (!url.searchParams.has('orient') && url.searchParams.has('offset')) counts.items.push(url);
    const ids = url.searchParams.get('tag') || url.searchParams.get('owner') === 'none' ? CATALOG.slice(0, 3) : CATALOG;
    return route.fulfill({ json: {
      items: ids.map((id) => ({ id, name: `sample_${id}.mp4`, title: `演示作品 ${id}`, is_jav: false, medium: 'video',
        location: 'local', has_thumb: true, duration: 3600, studio: 'Peach Studio', performers: [], tags: [] })),
      total: ids.length, has_more: false,
    } });
  });
  await page.goto(new URL(path, page.url()).toString(), { waitUntil: 'load' });
  await page.locator(READOUT, { hasText: '个符合' }).waitFor({ timeout: 15_000 });
  await page.locator(`${FILTER} [data-tier-performer]`).first().waitFor({ timeout: 15_000 });
  await settle(page);
  return { ...opened, counts };
}

const tag = (page: Page, key: string) => page.locator(`${FILTER} [data-catalog-tag="${key}"]`);
const chips = (page: Page) => page.locator('#combo [data-combo-chip]');

describe('首页筛选条', () => {
  let browser: Browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  const entityReturns = [
    { kind: 'creator', segment: 'creators', viewport: DESKTOP },
    { kind: 'creator', segment: 'creators', viewport: PHONE },
    { kind: 'performer', segment: 'performers', viewport: DESKTOP },
    { kind: 'studio', segment: 'studios', viewport: DESKTOP },
    { kind: 'series', segment: 'series', viewport: DESKTOP },
    { kind: 'agency', segment: 'agencies', viewport: DESKTOP },
    { kind: 'tag', segment: 'tags', viewport: DESKTOP },
  ];
  for (const { kind, segment, viewport } of entityReturns) {
    it(`${viewport.name} 从 ${kind} 资料深链返回首页恢复馆藏标签，重复往返沿用首页范围`, { timeout: 60_000 }, async () => {
      const opened = await openHome(browser, '/', viewport);
      const { page, counts } = opened;
      try {
        await page.route((url) => url.pathname === '/api/entity', route => route.fulfill({ json: {
          id: 90_102, kind, canonical_name: '演示实体', aliases: [], display_aliases: [], user_aliases: [],
          asset_count: CATALOG.length, tags: TAGS.slice(0, 1), related_performers: [], links: [], metadata: {},
          has_image: false, has_avatar: false, avatar_focus: null, representative_asset_id: null, entry_links: [], feed: null,
        } }));
        await page.route((url) => url.pathname === '/api/photos', route => route.fulfill({ json: {
          total: 0, sample_total: 0, sets: [], items: [], has_more: false, seed: '',
        } }));
        await page.goto(new URL(`/${segment}/${encodeURIComponent('演示实体')}`, page.url()).href, { waitUntil: 'load' });
        await pathIs(page, `/${segment}/90102`);
        for (let pass = 0; pass < 2; pass += 1) {
          await withPageDiagnostics(page, () => `${kind} 资料页就绪 ${JSON.stringify(opened.problems)}`, () =>
            page.locator('[data-entity-filter-glass] [data-entity-readout]').waitFor({ timeout: 10_000 }));
          await settle(page);
          const before = counts.facets.length;
          if (viewport.mobile) await page.getByRole('button', { name: '展开侧栏', exact: true }).click();
          await page.locator('[data-nav=""]:visible').first().click();
          await pathIs(page, '/');
          await page.waitForFunction(filter => document.querySelectorAll(`${filter} [data-catalog-tag]`).length > 1, FILTER);
          await settle(page);
          const queries = counts.facets.slice(before);
          assert.ok(queries.every(url => !url.searchParams.has('scope_kind') && !url.searchParams.has('scope_name')),
            '首页聚合仍带有资料页范围');
          assert.ok(await page.locator(`${FILTER} [data-catalog-tag]`).count() > 1, '首页只留下资料页的标签');
          if (pass === 0) {
            assert.ok(queries.length > 0, '深链首次返回首页应读取馆藏聚合');
            await page.goBack();
            await pathIs(page, `/${segment}/90102`);
          }
        }
        assert.deepEqual(withoutPlayer(opened.problems), []);
      } finally { await opened.close(); }
    });
  }

  it('JAV 读数尚未返回时保持两行骨架，内容就绪后再决定合行', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser, '/?jav=1');
    const { page } = opened;
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve });
    try {
      await page.route((url) => url.pathname === '/api/facets', async route => {
        const response = await route.fetch();
        await route.fulfill({ json: { ...await response.json(), tags: TAGS.slice(0, 1) } });
      });
      await page.route((url) => url.pathname === '/api/items', async route => { await waiting; await route.fallback() });
      await page.setViewportSize({ width: 1920, height: 900 });
      await page.reload();
      const frame = page.locator(`${FILTER} [data-catalog-frame]`);
      await frame.locator('[data-catalog-tag]').first().waitFor();
      assert.equal(await frame.getAttribute('data-single-row'), null);
      assert.equal(await frame.evaluate(node => node.getBoundingClientRect().height), 96);
      release();
      await page.locator(READOUT, { hasText: '个符合' }).waitFor();
      await page.locator(`${FILTER} [data-catalog-frame][data-single-row]`).waitFor();
      assert.deepEqual(opened.problems, []);
    } finally { release(); await opened.close() }
  });

  it('少量筛选项与右侧操作按容器宽度同行或分行', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser);
    const { page } = opened;
    try {
      await page.route((url) => url.pathname === '/api/facets', async route => {
        const response = await route.fetch();
        await route.fulfill({ json: { ...await response.json(), tags: TAGS.slice(0, 1) } });
      });
      await page.setViewportSize({ width: 1920, height: 900 });
      await page.reload(); await settle(page);
      const frame = page.locator(`${FILTER} [data-catalog-frame]`);
      await frame.locator('[data-catalog-tag]').first().waitFor();
      await page.locator(`${FILTER} [data-catalog-frame][data-single-row]`).waitFor();
      const wide = await frame.evaluate(element => {
        const top = element.querySelector('[data-filter-row="top"]')!.getBoundingClientRect();
        const bottom = element.querySelector('[data-filter-row="bottom"]')!.getBoundingClientRect();
        return { same: Math.abs(top.y - bottom.y) < 2, after: bottom.x >= top.right - 2 };
      });
      assert.deepEqual(wide, { same: true, after: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator(`${FILTER} [data-catalog-frame]:not([data-single-row])`).waitFor();
      assert.ok((await layout(page)).scrollWidth <= 390);
    } finally { await opened.close(); }
  });

  for (const viewport of [DESKTOP, PHONE]) {
    it(`${viewport.name} 筛选条件与作品卡片悬停面保持间距`, { timeout: 60_000 }, async () => {
      const opened = await openHome(browser, '/?studio=Peach%20Studio', viewport);
      try {
        await opened.page.mouse.move(0, 0);
        const controls = await opened.page.locator(`${FILTER} [data-filter-glass]`).evaluate(frame => {
          const candidates = [...frame.querySelectorAll('button,a[aria-pressed],[data-glass-segment]')]
            .filter(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0);
          const actions = ['[data-shortcuts-trigger]', '[data-entity-batch]'].map(selector => {
            const node = frame.querySelector(selector)!;
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            return { width: rect.width, height: rect.height, background: style.backgroundImage,
              color: style.color, border: style.border, shadow: style.boxShadow, radius: style.borderRadius };
          });
          return { heights: candidates.map(node => ({ label: node.getAttribute('aria-label') || node.textContent,
            height: node.getBoundingClientRect().height })), actions,
            compact: parseFloat(getComputedStyle(frame).getPropertyValue('--control-h-compact')) };
        });
        // 筛选条整条取紧凑档：页签、药丸、分段与两枚动作键同高。
        assert.equal(controls.compact, 32);
        for (const control of controls.heights) assert.equal(control.height, controls.compact, JSON.stringify(control));
        assert.deepEqual(controls.actions[0], controls.actions[1]);
        assert.equal(controls.actions[0].width, controls.compact);
        assert.equal(controls.actions[0].color, 'rgb(255, 255, 255)');
        assert.match(controls.actions[0].background, /^linear-gradient\(/);
        const gap = await opened.page.evaluate(() => document.querySelector('#grid [data-media-card]')!.getBoundingClientRect().top
          - document.querySelector('#combo [data-entity-combo]')!.getBoundingClientRect().bottom - 8);
        assert.ok(gap >= 16, `筛选条件距卡片悬停面只有 ${gap}px`);
        assert.deepEqual(withoutPlayer(opened.problems), []);
      } finally { await opened.close(); }
    });
  }

  it('点头像条一格打开那一位的资料页；地址里的厂牌筛选出一颗交集条，撤掉它重取一次列表', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser, '/?studio=Peach%20Studio');
    try {
      const { page, counts } = opened;
      await chips(page).filter({ hasText: '厂牌 Peach Studio' }).waitFor();
      const before = counts.items.length;
      await chips(page).filter({ hasText: 'Peach Studio' }).getByRole('button', { name: '撤掉 厂牌 Peach Studio' }).click();
      await page.waitForFunction(() => !new URLSearchParams(location.search).has('studio'));
      await page.locator(READOUT, { hasText: `${CATALOG.length} 个符合` }).waitFor();
      assert.equal(await chips(page).count(), 0, '撤掉之后交集条上还有东西');
      const after = counts.items.slice(before);
      assert.ok(after.length >= 1 && after.every((url) => !url.searchParams.has('studio')), '撤掉之后没有按新口径重取');
      await page.locator(`${FILTER} [data-tier-performer]`).first().click();
      await pathIs(page, `/performers/${PERFORMERS[0]!.id}`);
    } finally {
      await opened.close();
    }
  });

  it('标签条点选：按下态当场变，出一颗交集条，读数和侧栏计数按新口径各取一次；交集条上撤掉它回到原样', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser);
    try {
      const { page, counts } = opened;
      /* 首屏那批标签按种子从四十枚里抽，点屏幕上的第一枚，不点清单里的第一枚。 */
      const key = (await page.locator(`${FILTER} [data-catalog-tag]`).first().getAttribute('data-catalog-tag'))!;
      await page.evaluate((filter) => {
        const first = document.querySelector(`${filter} [data-tier-performer]`) as HTMLElement & { __kept?: boolean };
        first.__kept = true;
      }, FILTER);
      const [items, facets, summaries] = [counts.items.length, counts.facets.length, counts.summaries.length];
      const order = () => page.locator(`${FILTER} [data-catalog-tag]`).evaluateAll((pills) =>
        pills.map((pill) => pill.getAttribute('data-catalog-tag')));
      const members = await order();
      /* 计数是标签的附注：隔开一段、字号降一档、字色退一档，不和标签名读成一个词。 */
      const footnote = await tag(page, key).evaluate((pill) => {
        const badge = pill.querySelector('[data-count-badge]')!;
        const [p, b] = [getComputedStyle(pill), getComputedStyle(badge)];
        return { gap: parseFloat(b.marginLeft), smaller: parseFloat(b.fontSize) < parseFloat(p.fontSize),
          dimmer: b.color !== p.color, spaced: !/\s$/.test(badge.previousSibling?.textContent ?? '') };
      });
      assert.ok(footnote.gap >= 4, `计数离标签只有 ${footnote.gap}px`);
      assert.deepEqual([footnote.smaller, footnote.dimmer, footnote.spaced], [true, true, true],
        '计数和标签同字号、同色，或者靠空格文本节点隔开');
      await tag(page, key).click();
      await page.locator(`${FILTER} [data-catalog-tag="${key}"][aria-pressed="true"]`).waitFor({ timeout: 2_000 });
      await chips(page).filter({ hasText: key }).waitFor();
      await page.locator(READOUT, { hasText: '3 个符合' }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('tag'), key);
      assert.deepEqual(counts.items.slice(items).map((url) => url.searchParams.get('tag')), [key],
        '点一枚标签应当只按新口径取一次列表');
      assert.deepEqual(counts.summaries.slice(summaries).map((url) => url.searchParams.get('tag')), [key],
        '独立读数应当按新口径取一次统计');
      assert.deepEqual(counts.facets.slice(facets).map((url) => url.searchParams.get('tag')), [key],
        '侧栏计数应当按新口径取一次聚合');
      /* 口径变了两排头像会按新口径再取一次（`getBarsData`），但同一位的那一格原地换数，不拆了重建。 */
      assert.equal(await page.evaluate((filter) => !!(document.querySelector(`${filter} [data-tier-performer]`) as
        (HTMLElement & { __kept?: boolean }) | null)?.__kept, FILTER), true, '加一条筛选把头像条拆了重建');
      /* 标签条的成员与次序不动：刚点的那枚还在原位，没被挪到最前面去。 */
      assert.deepEqual(await order(), members, '加一条筛选把标签条重排了');
      await chips(page).filter({ hasText: key }).getByRole('button').click();
      await page.locator(READOUT, { hasText: `${CATALOG.length} 个符合` }).waitFor();
      await page.locator(`${FILTER} [data-catalog-tag="${key}"][aria-pressed="false"]`).waitFor({ timeout: 2_000 });
      assert.equal(await chips(page).count(), 0);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('头像条横滚到右端先把手上这页摆完，再要下一页，要到空页就停', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser);
    try {
      const { page, counts } = opened;
      const row = page.locator(`${FILTER} [data-catalog-tier="performers"]`);
      const shown = () => row.locator('[data-tier-performer]').count();
      assert.equal(await shown(), 24, '首屏应当只摆 24 枚');
      for (let at = 0; at < 20 && await shown() < PERFORMERS.length; at += 1) {
        await row.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        await page.waitForTimeout(120);
      }
      assert.equal(await shown(), PERFORMERS.length, '续页没有把第二页摆出来');
      for (let at = 0; at < 5; at += 1) {
        await row.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        await page.waitForTimeout(120);
      }
      /* 请求不带是哪一排：厂牌那排第一页就摆得下，挂上时已在右端，要一次第 1 页（空的）就停。女优那排
         翻到第 1 页时参数串相同，共用那一次回包，接着自己要第 2 页。 */
      assert.deepEqual(counts.tops.map((url) => url.searchParams.get('page') ?? '').sort(), ['', '1', '2'],
        '续页的页号不对，或到底之后还在要');
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('排序键：按下态当场到位，网格只重取一次；再点一次同一枚翻方向', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser);
    try {
      const { page, counts } = opened;
      const key = page.locator(`${FILTER} [data-entity-sort="new"]`);
      const before = counts.items.length;
      await key.click();
      await page.locator(`${FILTER} [data-entity-sort="new"][aria-pressed="true"]`).waitFor({ timeout: 2_000 });
      await until(() => counts.items.length > before, '换排序之后没有重取列表');
      await settle(page);
      assert.deepEqual(counts.items.slice(before).map((url) => url.searchParams.get('sort')), ['new'],
        '换一次排序应当只重取一次列表');
      /* 只数第一页：厂牌那排挂上时在右端，续要的那次空页与排序无关。 */
      assert.equal(counts.tops.filter((url) => !url.searchParams.has('page')).length, 1, '换排序不该重取两排头像');
      await key.click();
      await until(() => counts.items.length > before + 1, '翻方向之后没有重取列表');
      await settle(page);
      assert.deepEqual(counts.items.slice(before).map((url) => url.searchParams.get('dir') || ''), ['desc', 'asc']);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('卡片版式：只重画不重取，选择记进设置', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser);
    try {
      const { page, counts } = opened;
      const choice = (value: string) => page.locator(`${FILTER} input[name="home-layout"][value="${value}"]`);
      const before = counts.items.length;
      assert.equal(await choice('small').isChecked(), true);
      await page.locator(`${FILTER} label:has(input[name="home-layout"][value="big"])`).click();
      assert.equal(await choice('big').isChecked(), true);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('peach.settings.v1') || '{}'));
      assert.equal(saved.homeLayout, 'big');
      assert.equal(counts.items.length, before, '换版式不该重取列表');
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  for (const viewport of [DESKTOP, PHONE]) {
  it(`${viewport.name} JAV 馆藏保留目录版式、筛选和顶部搜索，三个分区可往返`, { timeout: 60_000 }, async () => {
    const opened = await openHome(browser, '/', viewport);
    try {
      const { page, counts } = opened;
      const before = counts.items.length;
      const homeIds = await page.locator('#grid [data-media-card]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-id')));
      if (viewport.mobile) await page.locator('#filterBtn').click();
      await page.locator('button[data-nav="jav"]:visible').first().click();
      await page.waitForFunction(() => location.pathname === '/' && new URLSearchParams(location.search).get('jav') === '1');
      await page.getByRole('tab', { name: '馆藏', exact: true, selected: true }).waitFor();
      await page.locator('#grid [data-media-card]').first().waitFor();
      await settle(page);
      assert.ok(counts.items.slice(before).some((url) => url.searchParams.get('jav') === '1'), 'JAV 口径没有重取列表');
      assert.equal(await page.evaluate(() => document.querySelector('#javLibraryHeader')!.getBoundingClientRect().bottom <= document.querySelector('#catalogFilter [data-catalog-tier="performers"]')!.getBoundingClientRect().top), true, 'JAV 标题和分区应在可见筛选行之前');
      assert.equal(await page.locator('#catalogPageHeading').isVisible(), false);
      assert.equal(await page.locator(`${FILTER} input[name="home-layout"]`).first().isVisible(), false);
      await page.locator(`${FILTER} input[name="jav-layout"]`).first().waitFor({ state: 'attached' });
      assert.ok(await page.locator(`${FILTER} [data-tier-performer]`).count() > 0, 'JAV 没有女优筛选');
      assert.ok(await page.locator(`${FILTER} [data-tier-studio]`).count() > 0, 'JAV 没有厂牌筛选');
      assert.ok(await page.locator(`${FILTER} [data-catalog-tag]`).count() > 0, 'JAV 没有标签筛选');
      assert.equal(await page.getByRole('textbox', { name: '搜索作品', exact: true }).count(), 0);
      const width = await page.evaluate(() => ({
        grid: document.querySelector('#grid')!.getBoundingClientRect().width,
        main: document.querySelector('#main')!.clientWidth,
      }));
      assert.ok(width.grid >= width.main - 40, 'JAV 网格没有铺满目录宽度');
      await page.locator(`${FILTER} label:has(input[name="jav-layout"][value="big"])`).click();
      assert.equal(await page.locator(`${FILTER} input[name="jav-layout"][value="big"]`).isChecked(), true);
      const beforeSearch = counts.items.length;
      if (viewport.mobile) await page.locator('#searchBtn').click();
      await page.locator('#q').fill('演示作品');
      await page.locator('#q').press('Enter');
      await withPageDiagnostics(page, '作品搜索没有按搜索词重取 JAV 馆藏', () => until(
        () => counts.items.slice(beforeSearch).some(url => url.searchParams.get('q') === '演示作品'),
        () => JSON.stringify({ url: page.url(), list: counts.items.slice(beforeSearch).map(url => url.search),
          summaries: counts.summaries.map(url => url.search) })));
      assert.equal(counts.items.at(-1)?.searchParams.get('jav'), '1');
      assert.equal(counts.items.at(-1)?.searchParams.get('q'), '演示作品');
      assert.equal(new URL(page.url()).searchParams.get('jav'), '1');
      assert.equal(new URL(page.url()).searchParams.get('q'), '演示作品');
      if (viewport.mobile) await page.locator('#searchBack').click();
      await page.getByRole('tab', { name: '发现', exact: true }).click();
      await page.getByRole('tab', { name: '发现', exact: true, selected: true }).waitFor();
      assert.equal(await page.locator('#javLibraryHeader').isVisible(), false);
      await page.getByRole('tab', { name: '想要', exact: true }).click();
      await page.getByRole('tab', { name: '想要', exact: true, selected: true }).waitFor();
      await page.getByRole('tab', { name: '馆藏', exact: true }).click();
      await page.getByRole('tab', { name: '馆藏', exact: true, selected: true }).waitFor();
      await page.locator('#grid [data-media-card]').first().waitFor();
      assert.equal(await page.locator(`${FILTER} input[name="jav-layout"][value="big"]`).isChecked(), true);
      const box = await layout(page);
      assert.ok(box.scrollWidth <= box.viewportWidth, 'JAV 页面横向溢出');
      await settle(page);
      const beforeHome = counts.items.length;
      if (viewport.mobile) await page.locator('#filterBtn').click();
      await page.locator('button[data-nav=""]:visible').first().click();
      await page.waitForFunction(() => location.pathname === '/' && !new URLSearchParams(location.search).has('jav'));
      await page.locator(`${FILTER} input[name="home-layout"]`).first().waitFor({ state: 'attached' });
      await page.locator(READOUT, { hasText: '个符合' }).waitFor();
      await settle(page);
      assert.equal(counts.items.length, beforeHome, '返回首页沿用原来的目录缓存');
      assert.deepEqual(await page.locator('#grid [data-media-card]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-id'))), homeIds);
      assert.equal(await page.locator('#javLibraryHeader').isVisible(), false);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });
  }

  it('未归属随首页位置保留，撤掉筛选后取全库，后退恢复未归属缓存', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser, '/?owner=none');
    try {
      const { page, counts } = opened;
      assert.equal(counts.items.at(-1)?.searchParams.get('owner'), 'none', '地址上的未归属没有进列表请求');
      let before = counts.items.length;
      const mainCards = page.locator('#grid [data-media-grid] > [data-media-card]');
      const filteredIds = await mainCards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-id')));
      await page.locator('[data-nav=""]:visible').first().click();
      await settle(page);
      assert.equal(new URL(page.url()).searchParams.get('owner'), 'none');
      assert.equal(counts.items.length, before, '点击当前栏目保留筛选');
      await chips(page).filter({ hasText: '未归属' }).getByRole('button').click();
      await page.waitForFunction(() => !new URLSearchParams(location.search).has('owner'));
      await until(() => counts.items.length > before, '撤掉未归属之后没有重取列表');
      await settle(page);
      assert.equal(counts.items.at(-1)?.searchParams.has('owner'), false);
      assert.equal(await mainCards.count(), CATALOG.length);
      before = counts.items.length;
      await page.goBack();
      await page.waitForFunction(() => new URLSearchParams(location.search).get('owner') === 'none');
      await settle(page);
      assert.equal(counts.items.length, before, '后退恢复已取得的未归属结果');
      assert.equal(await chips(page).filter({ hasText: '未归属' }).count(), 1);
      assert.deepEqual(await mainCards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-id'))), filteredIds);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('进详情再关回来：头像条还是原来那批节点，图还是解码过的那一张，也没有多发聚合请求', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser);
    try {
      const { page, counts } = opened;
      await page.waitForFunction((filter) => {
        const img = document.querySelector(`${filter} [data-tier-ring] > img`) as HTMLImageElement | null;
        return !!img && img.complete && img.naturalWidth > 0;
      }, FILTER, { timeout: 10_000 });
      await page.evaluate((filter) => {
        const first = document.querySelector(`${filter} [data-tier-performer]`) as HTMLElement & { __kept?: boolean };
        first.__kept = true;
        (first.querySelector('[data-tier-ring] > img') as HTMLImageElement & { __kept?: boolean }).__kept = true;
      }, FILTER);
      const [facets, tops] = [counts.facets.length, counts.tops.length];
      await page.locator(`#grid [data-media-card][data-id="${ITEM.plain}"] [data-media-title]`).first().click();
      await pathIs(page, `/assets/${ITEM.plain}`);
      await page.locator(DETAIL_READY).waitFor();
      await page.locator('#closeStage').click();
      await pathIs(page, '/');
      await page.locator('#stage[open]').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
      await settle(page);
      const kept = await page.evaluate((filter) => {
        const first = document.querySelector(`${filter} [data-tier-performer]`) as (HTMLElement & { __kept?: boolean }) | null;
        const img = first?.querySelector('[data-tier-ring] > img') as (HTMLImageElement & { __kept?: boolean }) | null;
        return { same: !!first?.__kept, img: !!img?.__kept && img.complete && img.naturalWidth > 0 };
      }, FILTER);
      assert.deepEqual(kept, { same: true, img: true }, '关掉详情时头像条被重建了');
      assert.equal(counts.facets.length, facets, '详情往返多取了一遍聚合');
      assert.equal(counts.tops.length, tops, '详情往返多取了一遍头像');
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('去索引页再回首页：收起时不留一套同名的浮层，回来之后玻璃垫在当前视图下面', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser);
    try {
      const { page } = opened;
      await page.locator('[data-nav="tags"]:visible').first().click();
      await pathIs(page, '/tags');
      await settle(page);
      assert.equal(await page.locator(`${FILTER} [data-catalog-frame]`).count(), 0, '收起的首页浮层还留在页面上');
      assert.equal(await page.locator(`${FILTER} [data-skeleton], ${FILTER} [aria-busy="true"]`).count(), 0);
      await page.locator('[data-nav=""]:visible').first().click();
      await pathIs(page, '/');
      await page.locator(READOUT, { hasText: '个符合' }).waitFor();
      await settle(page);
      const back = await page.evaluate((filter) => {
        const rect = (node: Element | null) => {
          if (!node || (node as HTMLElement).hidden) return null;
          const { left, width } = node.getBoundingClientRect();
          return { left: Math.round(left), width: Math.round(width) };
        };
        return {
          glide: rect(document.querySelector(`${filter} [data-view-glide]`)),
          key: rect(document.querySelector(`${filter} [data-catalog-view][aria-pressed="true"]`)),
        };
      }, FILTER);
      assert.ok(back.glide && back.key && Math.abs(back.glide.left - back.key.left) <= 1
        && Math.abs(back.glide.width - back.key.width) <= 1, `玻璃没有垫在当前视图下面 ${JSON.stringify(back)}`);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('手机 390 宽：视图和标签整段一起横滚，页面本身不被撑宽', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser, '/', PHONE);
    try {
      const { page } = opened;
      const scroller = page.locator(`${FILTER} [data-catalog-scroll]`);
      const before = await scroller.evaluate((element) => ({
        overflow: getComputedStyle(element).overflowX, room: element.scrollWidth - element.clientWidth,
        view: element.querySelector('[data-catalog-view]')!.getBoundingClientRect().left,
      }));
      assert.equal(before.overflow, 'auto', '窄屏下滚的应当是视图与标签外面那一层');
      assert.ok(before.room > 100, `视图与标签在 390 宽下应当放不下：多出 ${before.room}px`);
      await scroller.evaluate((element) => { element.scrollLeft = 200; });
      const moved = await scroller.evaluate((element) => ({
        left: element.scrollLeft, view: element.querySelector('[data-catalog-view]')!.getBoundingClientRect().left,
      }));
      assert.ok(moved.left > 0, '外层滚不动');
      assert.ok(moved.view < before.view - 100, '四枚视图没有跟着标签一起滚走');
      const controls = page.locator(`${FILTER} [data-filter-row="bottom"]`);
      const bottom = await controls.evaluate(element => {
        const summary = element.querySelector('[data-catalog-summary]')!.getBoundingClientRect();
        const sorts = element.querySelector('[data-entity-sorts]')!.getBoundingClientRect();
        return { height: element.getBoundingClientRect().height, summary: summary.y + summary.height / 2,
          sorts: sorts.y + sorts.height / 2, room: element.scrollWidth - element.clientWidth,
          overflow: getComputedStyle(element).overflowX };
      });
      assert.ok(Math.abs(bottom.summary - bottom.sorts) < 2, JSON.stringify(bottom));
      assert.ok(bottom.height <= 56 && bottom.room > 100 && bottom.overflow === 'auto', JSON.stringify(bottom));
      await controls.evaluate(element => { element.scrollLeft = 300 });
      assert.ok(await controls.evaluate(element => element.scrollLeft > 100));
      for (const width of [430, 390, 760, 761, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const glass = await page.locator(`${FILTER} [data-filter-glass]`).evaluate(async element => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const style = getComputedStyle(element);
          return { filter: style.backdropFilter, width: element.getBoundingClientRect().width,
            viewport: document.documentElement.clientWidth };
        });
        assert.ok(glass.filter.includes('blur(') && glass.width < glass.viewport, JSON.stringify(glass));
      }
      const measured = await layout(page);
      assert.deepEqual(measured.offenders, [], `筛选条把页面撑宽了：${measured.offenders.join('、')}`);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('上次两排都没人：再进首页时取回之前不铺两排占位，浮层不随取回移位', { timeout: 60_000 }, async () => {
    const opened = await openHome(browser);
    try {
      const { page } = opened;
      let delay = 0;
      // 后注册的先拦：这一组两排都没人，第二次进页拖住三秒，量的就是取回之前那一刻。
      await page.route((url) => url.pathname === '/api/tops', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        await route.fulfill({ json: { performers: [], studios: [] } });
      });
      await page.reload();
      await page.locator(`${FILTER} [data-catalog-root]:not([data-loading])`).waitFor();
      await settle(page);
      delay = 3_000;
      await page.reload({ waitUntil: 'domcontentloaded' });
      const frame = page.locator(`${FILTER} [data-catalog-frame]`);
      await frame.waitFor();
      const read = () => page.evaluate((filter) => ({
        rows: document.querySelectorAll(`${filter} [data-catalog-tier]`).length,
        loading: !!document.querySelector(`${filter} [data-catalog-root][data-loading]`),
        top: Math.round(document.querySelector(`${filter} [data-catalog-frame]`)!.getBoundingClientRect().top),
      }), FILTER);
      const waiting = await read();
      assert.deepEqual({ rows: waiting.rows, loading: waiting.loading }, { rows: 0, loading: true }, JSON.stringify(waiting));
      await page.locator(`${FILTER} [data-catalog-root]:not([data-loading])`).waitFor({ timeout: 10_000 });
      await settle(page);
      const done = await read();
      assert.equal(done.rows, 0);
      assert.ok(Math.abs(done.top - waiting.top) <= 1, `取回后浮层移位：${waiting.top} → ${done.top}`);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });
});
