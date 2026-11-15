/* 媒体格的占位底在明暗两套主题里都要和所在那层面分得开。
 *
 * 「无封面」「无头像」那一格露出来的是格子自己的底色。实色 token 在暗色里互相撞（tertiary 与 primary
 * 同为 neutral-800，遗留的 `--sunk` 与 `--ground` 同为 secondary），哪一处摆错了面，那格就和底一模
 * 一样——复核页「自动写入的资料」、名册头像框、详情页演员头像都这样漏过。这类问题按页面逐个点名
 * 守不住，新加一处没人记得补，所以这里不认类名：`media-frames.ts` 按计算值认出页面上所有放图的格子，
 * 逐个量它和底下那层的明度差。修法是统一用 `--media-placeholder`（`bg-media-placeholder`），
 * 它是半透明的一层，摆在哪种面上、悬停还是选中都比那层深一档或亮一档。
 *
 * 阈值取 4 个 CIE L*：原来浅色下 neutral-200 压白是 7 左右，看得清；低于 4 时整块底在屏幕上
 * 已经和周围连成一片。量的是格子本身，图加载出来盖住了也照样量：图取不到时露出来的就是它。 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Browser, Page } from 'playwright-core';

import { launch, settle, visit, type Visit } from './harness.ts';
import { DESKTOP, openIndexPage, openQualityGoals, qualityGoal, REVIEW_ROW } from './design-fixture.ts';
import { ITEM, openItemPage } from './item-fixture.ts';
import { mediaFrames, mediaFramesIn, type FrameReading } from './media-frames.ts';

const LIMIT = 4;

async function useTheme(page: Page, dark: boolean): Promise<void> {
  // `web/app.js` 的 `applyTheme()` 就是这两句；这里只借它换一次配色。
  await page.evaluate((on) => {
    document.documentElement.dataset.theme = on ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', on);
  }, dark);
}

/** 行底换色带过渡；量之前让它走完，读到的是终值而不是半路。循环动画（骨架微光）没有终点，跳过。 */
async function finishTransitions(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish();
    }
  });
}

/** 量过的格子里低于阈值的那些；量不出颜色的（`skipped`）不算。 */
function blended(readings: FrameReading[]): string[] {
  return readings.filter((item) => !item.skipped && item.delta < LIMIT)
    .map((item) => `${item.frame}：格 ${item.fill.toFixed(1)}，底 ${item.ground.toFixed(1)}`);
}

/** 明暗各量一次。`least` 防的是页面没画出格子、整条用例空过。 */
async function expectBothThemes(page: Page, where: string, least: number): Promise<void> {
  for (const dark of [false, true]) {
    await useTheme(page, dark);
    const readings = await mediaFrames(page);
    const measured = readings.filter((item) => !item.skipped);
    assert.ok(measured.length >= least, `${where}（${dark ? '暗色' : '浅色'}）只量到 ${measured.length} 个媒体格`);
    assert.deepEqual(blended(readings), [], `${where}（${dark ? '暗色' : '浅色'}）这些格子的底和所在那层面撞色`);
  }
}

/** 复核页「自动写入的资料」：作品已不在账本中、也没有封面的两行，和一条普通的元数据候选。
 *  字段以 `src/peach/web_review.py` 的自动写入读端点为准。 */
const landing = (key: string, assetId: number, title: string) => ({
  item_key: key, rule: 'title-official', label: '官方标题', batch: 'b1', at: 1_767_312_000,
  field: '标题', value: title, previous: [`${title}（旧）`], tags: [], assets: 1, preview_url: '',
  asset_id: assetId, name: '', code: '', gone: true,
});

async function openReviewWithLandings(browser: Browser): Promise<Visit> {
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const opened = await visit(browser, '/review', DESKTOP, async (page) => {
    await page.route('**/api/review', (route) => route.fulfill(json({
      sections: { metadata_fields: [REVIEW_ROW] }, counts: { metadata_fields: 1 }, genre_tags: [],
      queues: { later: { sections: {}, counts: {} }, ignored: { sections: {}, counts: {} } },
    })));
    await page.route('**/api/review/auto-landings', (route) => route.fulfill(json({
      items: [landing('auto:1', 86_070, '演示标题甲'), landing('auto:2', 86_172, '演示标题乙')],
    })));
  });
  await opened.page.locator('tbody tr').filter({ hasText: '演示标题甲' }).waitFor({ timeout: 15_000 });
  await settle(opened.page);
  return opened;
}

describe('媒体格占位底与所在那层面分得开', () => {
  let browser: Browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  it('复核页：自动写入的资料里「无封面」那格，静止、悬停、选中三态明暗都分得开', { timeout: 60_000 }, async () => {
    const opened = await openReviewWithLandings(browser);
    try {
      const page = opened.page;
      await expectBothThemes(page, '复核页', 2);
      const row = page.locator('tbody tr').filter({ hasText: '演示标题甲' });
      for (const dark of [false, true]) {
        await useTheme(page, dark);
        const theme = dark ? '暗色' : '浅色';
        await row.hover();
        await finishTransitions(page);
        const hovered = await mediaFramesIn(row);
        assert.ok(hovered.length >= 1, `${theme}悬停行里没量到「无封面」格`);
        assert.deepEqual(blended(hovered), [], `${theme}悬停行`);
        /* 勾选框的 input 视觉隐藏在画出来的方框底下，点它要 force。 */
        const box = row.getByRole('checkbox');
        await box.check({ force: true, timeout: 5_000 });
        await page.waitForFunction(() => !!document.querySelector('tbody tr[data-board-selected]'));
        await finishTransitions(page);
        assert.deepEqual(blended(await mediaFramesIn(row)), [], `${theme}选中行`);
        await box.uncheck({ force: true, timeout: 5_000 });
      }
    } finally {
      await opened.close();
    }
  });

  it('首页：作品卡封面格与卡上的人物头像', { timeout: 60_000 }, async () => {
    const opened = await visit(browser, '/', DESKTOP);
    try {
      await opened.page.locator('#grid [data-media-card]').first().waitFor({ timeout: 15_000 });
      await settle(opened.page);
      await expectBothThemes(opened.page, '首页', 1);
    } finally {
      await opened.close();
    }
  });

  it('艺人名册：头像框', { timeout: 60_000 }, async () => {
    const opened = await openIndexPage(browser, '/performers');
    try {
      await expectBothThemes(opened.page, '艺人名册', 1);
    } finally {
      await opened.close();
    }
  });

  it('作品详情：没有头像的演员、没有标识的厂牌与相关作品', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, `/assets/${ITEM.cast}`, DESKTOP);
    try {
      await expectBothThemes(opened.page, '作品详情', 1);
    } finally {
      await opened.close();
    }
  });

  it('高清版目标：没有封面的目标', { timeout: 60_000 }, async () => {
    const opened = await openQualityGoals(browser, [qualityGoal(1, '演示目标甲'), qualityGoal(2, '演示目标乙')]);
    try {
      await expectBothThemes(opened.page, '高清版目标', 1);
    } finally {
      await opened.close();
    }
  });
});
