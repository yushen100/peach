import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { launch, layout, VIEWPORTS, visit } from './harness.ts';

describe('馆藏表格列宽与占位图', () => {
  let browser: Browser;
  before(async () => { browser = await launch() });
  after(async () => { await browser?.close() });
  for (const viewport of VIEWPORTS) it(`${viewport.name}：缺图、长名称、横滚与列宽保存`, { timeout: 90_000 }, async () => {
    const opened = await visit(browser, '/', viewport);
    const { page } = opened;
    try {
      const name = `${'很长的影片名称'.repeat(30)}.mp4`;
      await page.route('**/api/items?*', route => route.fulfill({ json: { items: [{
        id: 99001, name, creator: '示例作者', medium: 'video', duration: 60,
        size: 150994944, width: 1920, height: 1080, rating: 80, play_count: 3,
        o_count: 2, first_seen: '2026-01-03', last_played: 1767312000,
        code: 'TEST-001', release_date: '2026-01-02',
      }], total: 1 } }));
      await page.getByRole('radiogroup', { name: '馆藏显示方式' }).locator('label')
        .filter({ has: page.getByRole('radio', { name: '列表', exact: true }) }).click();
      const row = page.locator('[data-catalog-row][data-id="99001"]');
      await row.waitFor();
      const geometry = await row.evaluate(node => {
        const picture = node.querySelector('[data-list-picture]')!;
        const placeholder = picture.firstElementChild!;
        const a = picture.getBoundingClientRect(), b = placeholder.getBoundingClientRect();
        const title = node.querySelector<HTMLElement>('[data-list-name]')!;
        return { picture: getComputedStyle(picture).backgroundColor,
          expected: getComputedStyle(picture).getPropertyValue('--media-placeholder').trim(),
          centerDelta: Math.abs(a.top + a.height / 2 - b.top - b.height / 2),
          titleWidth: title.clientWidth, titleHeight: title.clientHeight, fullHeight: title.scrollHeight,
          lineHeight: parseFloat(getComputedStyle(title).lineHeight), clamp: getComputedStyle(title).webkitLineClamp };
      });
      assert.ok(geometry.centerDelta <= 1, JSON.stringify(geometry));
      assert.notEqual(geometry.picture, 'rgb(255, 255, 255)');
      // 长标题在「作品」列里最多两行，多出的截掉。
      assert.ok(geometry.titleWidth < 320 && geometry.clamp === '2' && geometry.fullHeight > geometry.titleHeight
        && geometry.titleHeight <= geometry.lineHeight * 2 + 1, JSON.stringify(geometry));
      assert.equal(await row.locator('[data-list-name]').getAttribute('title'), name);
      const defaultLabels = ['作品', '艺人', '媒体库', '标签', '时长', '评分', '观看次数', '入库时间'];
      const visibleLabels = () => page.locator('[data-catalog-table] th:not([data-table-space]) > span').allTextContents();
      assert.deepEqual(await visibleLabels(), defaultLabels);
      await page.getByRole('button', { name: '显示列', exact: true }).click();
      await page.getByRole('button', { name: '显示全部列', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.deepEqual(await visibleLabels(), ['作品', '艺人', '媒体库', '标签', '时长', '评分', '观看次数', '入库时间', '发行时间', '观看时间', '高潮计数', '分辨率', '体积', '番号']);
      for (const label of ['分辨率', '评分', '高潮计数', '观看次数', '时长', '体积', '入库时间', '观看时间', '发行时间', '番号']) {
        await page.getByRole('columnheader', { name: label, exact: false }).waitFor();
      }
      assert.ok((await row.textContent())?.includes('1920 × 1080'));
      assert.equal(await row.getByRole('group', { name: '评分 4 / 5', exact: true }).count(), 1);
      assert.equal(await row.locator('[data-rating-stars] [data-rate]').count(), 5);
      assert.equal(await row.locator('[data-rating-stars] [data-rate][data-on="true"]').count(), 4);
      assert.ok((await row.textContent())?.includes('2026-01-03'));
      const header = page.getByRole('columnheader', { name: /^作品/ });
      const initialWidth = (await header.boundingBox())!.width;
      if (!viewport.mobile) {
        const sort = await header.getAttribute('aria-sort');
        const handle = await header.locator('.react-aria-ColumnResizer').boundingBox();
        assert.ok(handle);
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(handle.x + handle.width / 2 + 48, handle.y + handle.height / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForFunction(width => document.querySelector('[data-catalog-table] th[data-key="name"]')!.getBoundingClientRect().width > width + 20, initialWidth);
        assert.equal(await header.getAttribute('aria-sort'), sort);
      }
      const beforeKeyboard = (await header.boundingBox())!.width;
      const resizer = header.getByRole('slider');
      await resizer.focus();
      await resizer.press('Enter');
      await resizer.press('ArrowRight');
      await resizer.press('ArrowRight');
      await resizer.press('Tab');
      await page.waitForFunction(width => document.querySelector('[data-catalog-table] th[data-key="name"]')!.getBoundingClientRect().width > width, beforeKeyboard);
      const resizedWidth = (await header.boundingBox())!.width;
      await page.getByRole('button', { name: '显示列', exact: true }).click();
      const columnMenu = page.getByRole('dialog', { name: '表格显示列' });
      await columnMenu.locator('label').filter({ has: page.getByRole('checkbox', { name: '评分', exact: true }) }).click();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('columnheader', { name: /评分/ }).count(), 0);
      await page.reload({ waitUntil: 'load' });
      await page.locator('[data-catalog-row][data-id="99001"]').waitFor();
      assert.ok(Math.abs((await header.boundingBox())!.width - resizedWidth) <= 1);
      assert.equal(await page.getByRole('columnheader', { name: /评分/ }).count(), 0);
      await page.getByRole('button', { name: /作品列表排序/ }).click();
      const sortResponse = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === '/api/items' && url.searchParams.get('sort') === 'rating';
      });
      await page.getByRole('option', { name: '评分', exact: true }).click();
      await sortResponse;
      assert.equal(await page.getByRole('columnheader', { name: /评分/ }).count(), 0);
      await page.getByRole('button', { name: '显示列', exact: true }).click();
      await page.getByRole('button', { name: '显示全部列', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('columnheader', { name: /评分/ }).waitFor();
      const scroll = page.locator('[data-catalog-table] .overflow-x-auto');
      const scrolled = await scroll.evaluate(node => {
        node.scrollLeft = node.scrollWidth;
        return { left: node.scrollLeft, extra: node.scrollWidth - node.clientWidth };
      });
      assert.ok(scrolled.extra > 0 && scrolled.left > 0, JSON.stringify(scrolled));
      await page.getByRole('button', { name: '重置列宽', exact: true }).click();
      await page.waitForFunction(width => Math.abs(document.querySelector('[data-catalog-table] th[data-key="name"]')!.getBoundingClientRect().width - width) <= 1, initialWidth);
      await scroll.evaluate(node => { node.scrollLeft = 0 });
      await page.getByRole('button', { name: '显示列', exact: true }).click();
      await page.getByRole('button', { name: '恢复默认显示', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.deepEqual(await visibleLabels(), defaultLabels);
      const measured = await layout(page);
      assert.ok(measured.scrollWidth <= measured.viewportWidth + 1, JSON.stringify(measured));
      const screenshots = join('..', 'build', 'agent-verification', 'library-table');
      mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: join(screenshots, `${viewport.name}.png`) });
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
        document.documentElement.classList.add('dark');
      });
      await page.screenshot({ path: join(screenshots, `${viewport.name}-dark.png`) });
      assert.deepEqual(opened.problems.filter(line => !line.includes('VIDEOJS')), []);
    } finally { await opened.close() }
  });
});
