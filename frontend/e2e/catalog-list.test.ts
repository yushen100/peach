import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { launch, layout, settle, VIEWPORTS, visit, withPageDiagnostics } from './harness.ts';

describe('馆藏卡片与列表', () => {
  let browser: Browser;
  before(async () => { browser = await launch() });
  after(async () => { await browser?.close() });
  for (const viewport of VIEWPORTS) it(`${viewport.name}：多选隐藏卡片悬浮操作，退出后恢复`, { timeout: 60000 }, async () => {
    const opened = await visit(browser, '/', viewport);
    const { page } = opened;
    try {
      await page.locator('#grid [data-media-card] [data-media-later]').first().waitFor({ state: 'attached' });
      await page.locator('#selectMode').click();
      await page.waitForFunction(() => document.querySelectorAll('#grid [data-media-card] [data-media-later]').length === 0);
      assert.equal(await page.locator('#grid [data-media-card] [data-media-seek]').count(), 0);
      assert.ok(await page.locator('#grid [data-media-check]').count() > 0);
      await page.locator('#selectMode').click();
      await page.locator('#grid [data-media-card] [data-media-later]').first().waitFor({ state: 'attached' });
      assert.deepEqual(opened.problems, []);
    } finally { await opened.close() }
  });
  for (const viewport of VIEWPORTS) {
    it(`${viewport.name} 显示切换、文件夹开关、详情与刷新保留列表`, { timeout: 90_000 }, async () => {
      const opened = await visit(browser, '/?browse=folders&loc=local', viewport);
      const { page } = opened;
      try {
        await page.locator('#grid [data-media-card]').first().waitFor({ state: 'visible' });
        const folder = page.getByRole('button', { name: '文件夹模式', exact: true });
        assert.equal(await folder.getAttribute('aria-pressed'), 'true');
        assert.equal(await folder.evaluate(node => !!node.closest('[data-entity-sorts]')), true);
        const choose = (name: string) => page.getByRole('radiogroup', { name: '馆藏显示方式' })
          .locator('label').filter({ has: page.getByRole('radio', { name, exact: true }) }).click();
        await choose('列表');
        await page.locator('[data-catalog-table] [data-catalog-row]').first().waitFor();
        await settle(page, '#grid');
        const count = await page.locator('#grid [data-catalog-row]').count();
        assert.ok(count > 0);
        const listedIds = await page.locator('#grid [data-catalog-row]').evaluateAll(rows => rows.map(row => row.getAttribute('data-id')).sort());
        assert.equal(await page.locator('#grid [data-mix-card]').count(), 0);
        const geometry = await page.locator('#grid [data-catalog-row]').first().evaluate(node => {
          const row = node.getBoundingClientRect();
          const picture = node.querySelector('[data-list-picture]')!.getBoundingClientRect();
          const title = node.querySelector('[data-list-name]')!.getBoundingClientRect();
          const people = node.querySelector('[data-list-people]');
          const cell = (selector: string) => node.querySelector(selector)?.closest('td')?.getBoundingClientRect().left ?? -1;
          return { width: row.width, height: row.height, pictureRight: picture.right, titleLeft: title.left,
            radius: getComputedStyle(node).borderBottomLeftRadius, identityAvatar: !!node.querySelector('[data-list-identity] [data-media-avatar]'),
            peopleAvatar: !!people?.querySelector('[data-media-avatar]'), nameCell: cell('[data-list-identity]'), peopleCell: cell('[data-list-people]') };
        });
        assert.ok(geometry.height <= 120 && geometry.width > geometry.height * 2, JSON.stringify(geometry));
        assert.ok(geometry.titleLeft > geometry.pictureRight, JSON.stringify(geometry));
        assert.equal(geometry.radius, '0px');
        assert.ok(!geometry.identityAvatar && geometry.peopleAvatar && geometry.peopleCell > geometry.nameCell,
          `头像与署名拆成作品列之后单独的艺人列：${JSON.stringify(geometry)}`);
        const screenshots = join('..', 'build', 'agent-verification', 'folders');
        mkdirSync(screenshots, { recursive: true });
        await page.screenshot({ path: join(screenshots, `${viewport.name}-list.png`), fullPage: false });
        await page.reload({ waitUntil: 'load' });
        await page.locator('[data-catalog-table] [data-catalog-row]').first().waitFor();
        assert.equal(await page.getByRole('radio', { name: '列表', exact: true }).isChecked(), true);
        const pageSize = page.getByRole('button', { name: /每页显示数量/ });
        await pageSize.scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await pageSize.click();
        await page.getByRole('option', { name: '每页 10 部', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('[data-catalog-row]').length === 10);
        await page.getByRole('button', { name: '下一页', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('[data-catalog-row]').length === 2);
        await page.locator('#grid [data-list-open]').first().click();
        await page.waitForURL(/\/(?:assets|works)\//);
        await page.goBack();
        await page.locator('[data-catalog-table] [data-catalog-row]').first().waitFor();
        await page.waitForFunction(() => document.querySelectorAll('[data-catalog-row]').length === 2);
        assert.equal(await page.getByRole('button', { name: '第 2 页', exact: true }).getAttribute('aria-current'), 'page');
        await choose('卡片');
        await page.locator('[data-catalog-view-mode="cards"] [data-media-card]').first().waitFor();
        // 卡片首批只覆盖视口；列表的一页可能已经包含全部样本，先正常续载再比较同一集合。
        while (await page.locator('#grid [data-media-card]').count() < count) {
          const before = await page.locator('#grid [data-media-card]').count();
          if (!await page.locator('#grid [data-load-more]').count()) break;
          await page.evaluate(() => document.querySelector('#grid [data-load-more]')?.scrollIntoView());
          await page.waitForFunction(before => document.querySelectorAll('#grid [data-media-card]').length > before
            || !document.querySelector('#grid [data-load-more]'), before);
        }
        assert.equal(await page.locator('#grid [data-media-card]').count(), count);
        assert.deepEqual(await page.locator('#grid [data-media-card]').evaluateAll(cards => cards.map(card => card.getAttribute('data-id')).sort()),
          listedIds, '切换和刷新后卡片应展示列表中的同一批作品');
        if (viewport.mobile) {
          await page.evaluate(() => {
            document.documentElement.dataset.theme = 'dark';
            document.documentElement.classList.add('dark');
          });
          await page.screenshot({ path: join(screenshots, 'mobile-cards-dark.png'), fullPage: false });
        }
        const measured = await layout(page);
        assert.ok(measured.scrollWidth <= measured.viewportWidth + 1, JSON.stringify(measured));
        assert.deepEqual(opened.problems.filter(line => !line.includes('VIDEOJS')), []);
      } finally { await opened.close() }
    });
    it(`${viewport.name} 全集排序、每页数量与跨页选择`, { timeout: 90_000 }, async () => {
      const requests: URLSearchParams[] = [];
      const entries = Array.from({ length: 45 }, (_, index) => ({
        id: 9000 + index, name: `条目 ${String(index + 1).padStart(2, '0')}${index === 44 ? '超长文件名'.repeat(60) : ''}.mp4`,
        medium: 'video', location: 'local', duration: 45 - index, size: index * 1024,
      }));
      /* 导航前挂上：首屏网格的请求可能早于 load，挂晚了它会落到真实服务上。 */
      const opened = await visit(browser, '/?browse=folders&loc=local', viewport, page => page.route('**/api/items?*', route => {
        const params = new URL(route.request().url()).searchParams;
        requests.push(params);
        const direction = params.get('dir') === 'asc' ? 1 : -1;
        const sorted = [...entries].sort((a, b) => params.get('sort') === 'dur'
          ? direction * (a.duration - b.duration) : direction * a.name.localeCompare(b.name));
        const offset = Number(params.get('offset') || 0), limit = Number(params.get('limit') || 60);
        return route.fulfill({ json: { items: sorted.slice(offset, offset + limit), total: sorted.length } });
      }));
      const { page } = opened;
      try {
        await page.locator('#grid [data-media-card]').first().waitFor({ state: 'visible' });
        await page.getByRole('radiogroup', { name: '馆藏显示方式' }).locator('label')
          .filter({ has: page.getByRole('radio', { name: '列表', exact: true }) }).click();
        await withPageDiagnostics(page, '切到列表后第一页没有出现', () =>
          page.locator('[data-catalog-row][data-id="9044"]').waitFor());
        assert.equal(await page.locator('[data-catalog-row]').count(), 20);
        assert.equal(requests.at(-1)!.get('limit'), '20');
        assert.equal(requests.at(-1)!.get('loc'), 'local');
        assert.equal(requests.at(-1)!.get('browse'), 'folders');
        const first = page.locator('[data-catalog-row]').first();
        const firstId = await first.getAttribute('data-id');
        await page.locator('#selectMode').click();
        await first.locator('label').click();
        assert.equal(await first.getAttribute('data-board-selected'), 'true');
        await page.getByRole('button', { name: '下一页', exact: true }).click();
        await page.locator('[data-catalog-row][data-id="9024"]').waitFor();
        assert.equal(requests.at(-1)!.get('offset'), '20');
        await page.locator('[data-catalog-row]').first().locator('label').click();
        await page.getByRole('button', { name: '上一页', exact: true }).click();
        await page.locator(`[data-catalog-row][data-id="${firstId}"][data-board-selected]`).waitFor();
        const sortButton = page.getByRole('button', { name: /作品列表排序/ });
        await sortButton.scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await sortButton.click();
        const sortedResponse = page.waitForResponse(response => {
          const url = new URL(response.url());
          return url.pathname === '/api/items' && url.searchParams.get('sort') === 'dur' && url.searchParams.get('dir') === 'asc';
        });
        try { await page.getByRole('option', { name: '时长', exact: true }).click({ timeout: 5000 }) }
        catch (error) {
          console.info('排序菜单', await sortButton.getAttribute('aria-expanded'), await page.locator('[role="option"]').allTextContents());
          throw error;
        }
        await sortedResponse;
        await page.locator('[data-catalog-row][data-id="9044"]').waitFor();
        await page.waitForFunction(() => document.querySelector('[data-catalog-row]')?.getAttribute('data-id') === '9044');
        assert.equal(requests.at(-1)!.get('sort'), 'dur');
        assert.equal(requests.at(-1)!.get('dir'), 'asc');
        assert.equal(requests.at(-1)!.get('offset'), '0');
        const pageSizeButton = page.getByRole('button', { name: /每页显示数量/ });
        await pageSizeButton.scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await pageSizeButton.click();
        try { await page.getByRole('option', { name: '每页 10 部', exact: true }).click({ timeout: 5000 }) }
        catch (error) {
          console.info('分页菜单', await pageSizeButton.getAttribute('aria-expanded'),
            await page.locator('[role="option"]').allTextContents(), await pageSizeButton.boundingBox());
          await page.screenshot({ path: `../build/agent-verification/pagination-menu-${viewport.name}.png` });
          throw error;
        }
        await page.waitForFunction(() => document.querySelectorAll('[data-catalog-row]').length === 10);
        assert.equal(requests.at(-1)!.get('limit'), '10');
        if (!viewport.mobile) {
          const namedResponse = page.waitForResponse(response => {
            const url = new URL(response.url());
            return url.pathname === '/api/items' && url.searchParams.get('sort') === 'name';
          });
          await page.locator('[data-catalog-table] th[data-key="name"]').click();
          await namedResponse;
          await page.waitForFunction(() => document.querySelector('[data-catalog-row]')?.getAttribute('data-id') === '9000');
          assert.equal(requests.at(-1)!.get('dir'), 'asc');
        }
        const durationSort = page.locator('[data-entity-sort="dur"]');
        await durationSort.scrollIntoViewIfNeeded();
        const durationResponse = page.waitForResponse(response => {
          const url = new URL(response.url());
          return url.pathname === '/api/items' && url.searchParams.get('sort') === 'dur' && url.searchParams.get('dir') === 'desc';
        });
        await durationSort.click();
        await durationResponse;
        await page.waitForFunction(() => document.querySelector('[data-catalog-row]')?.getAttribute('data-id') === '9000');
        assert.equal(await durationSort.getAttribute('aria-pressed'), 'true');
        assert.equal(requests.at(-1)!.get('offset'), '0');
        const measured = await layout(page);
        assert.ok(measured.scrollWidth <= measured.viewportWidth + 1, JSON.stringify(measured));
        assert.deepEqual(opened.problems.filter(line => !line.includes('VIDEOJS')), []);
      } finally { await opened.close() }
    });
  }
});
