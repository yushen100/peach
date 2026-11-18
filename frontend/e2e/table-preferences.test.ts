import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type { Browser, Locator, Page } from 'playwright-core';
import { followSource, openFollowManage } from './design-fixture.ts';
import { launch, layout, VIEWPORTS } from './harness.ts';
import { verifyTablePreferences } from './table-preferences-fixture.ts';

async function visibleSelectAll(table: Locator) {
  const label = table.locator('thead label');
  const box = (await label.boundingBox())!;
  assert.ok(box.width >= 16 && box.height >= 16, JSON.stringify(box));
  await label.click();
  await table.locator('tbody input:checked:not([role="switch"])').first().waitFor({ state: 'attached' });
  assert.ok(await table.locator('tbody input:checked:not([role="switch"])').count() > 0);
  await label.click();
  await table.locator('tbody input:checked:not([role="switch"])').first().waitFor({ state: 'detached', timeout: 5000 });
  assert.equal(await table.locator('tbody input:checked:not([role="switch"])').count(), 0);
}

async function noPageOverflow(page: Page) {
  const measured = await layout(page);
  assert.ok(measured.scrollWidth <= measured.viewportWidth + 1, JSON.stringify(measured));
}

describe('所有数据表共用列设置', () => {
  let browser: Browser;
  before(async () => { browser = await launch(); mkdirSync('../build/agent-verification/all-tables', { recursive: true }) });
  after(async () => { await browser.close() });
  it('关注列表按匹配来源渲染创作者卡片，切回表格保留筛选', { timeout: 60_000 }, async () => {
    const opened = await openFollowManage(browser, VIEWPORTS[0]!);
    const { page } = opened;
    try {
      const tableView = page.getByRole('button', { name: '表格视图', exact: true });
      const cardView = page.getByRole('button', { name: '默认视图', exact: true });
      await tableView.click();
      const table = page.getByRole('grid', { name: '关注来源', exact: true });
      await table.getByRole('button', { name: '筛选站点', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '筛选站点' });
      await dialog.getByRole('checkbox', { name: '全部', exact: true }).press('Space');
      const pawchive = dialog.getByRole('checkbox', { name: 'Pawchive', exact: true });
      await pawchive.press('Space');
      await pawchive.press('Escape');
      assert.deepEqual(await table.locator('tbody [data-work-context-row]').evaluateAll(rows =>
        rows.map(row => row.getAttribute('data-work-context-row'))), ['2']);
      await cardView.click();
      const rows = page.locator('[data-follow-source-row]');
      await rows.first().waitFor();
      assert.equal(await rows.count(), 1);
      await rows.getByText('kou · Pawchive', { exact: true }).waitFor();
      await tableView.click();
      await table.locator('[data-table-column-filter="provider"][data-filter-active]').waitFor();
      await cardView.click();
      await page.getByRole('button', { name: /清除.*站点/ }).click();
      await rows.nth(2).waitFor();
    } finally { await opened.close() }
  });
  for (const viewport of VIEWPORTS) {
    it(`${viewport.name}：关注来源可全选、调整列和拖动，名称右侧留给行选择`, { timeout: 60000 }, async () => {
      const opened = await openFollowManage(browser, viewport);
      const { page } = opened;
      try {
        await page.getByRole('button', { name: '表格视图', exact: true }).click();
        const table = page.getByRole('grid', { name: '关注来源', exact: true });
        await visibleSelectAll(table);
        await verifyTablePreferences(page, table, '关注来源', 'source', { id: 'provider', label: '站点' },
          () => page.getByRole('button', { name: '表格视图', exact: true }).click());
        const row = table.locator('tbody tr').first(), cell = row.locator('td').nth(2), link = cell.locator('a');
        await link.scrollIntoViewIfNeeded();
        const hit = await cell.evaluate(node => {
          const cell = node.getBoundingClientRect(), anchor = node.querySelector('a')!.getBoundingClientRect();
          return { cell: cell.width, link: anchor.width, gap: cell.right - anchor.right };
        });
        assert.ok(hit.gap > 40 && hit.link < hit.cell - 40, JSON.stringify(hit));
        await cell.click({ position: { x: Math.min(hit.cell - 8, hit.link + 28), y: 6 } });
        assert.equal(await row.getByRole('checkbox').isChecked(), true);
        await noPageOverflow(page);
        await page.screenshot({ path: `../build/agent-verification/all-tables/follow-${viewport.name}.png` });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
    it(`${viewport.name}：JAV 订阅共用列设置、可见全选和站点图标`, { timeout: 60000 }, async () => {
      const opened = await openFollowManage(browser, viewport);
      const { page } = opened;
      try {
        await page.route('**/api/feeds', route => route.fulfill({ json: { unread: 0, sources: [{
          id: 1, kind: 'javdb-actor', kind_label: 'JAV 订阅', name: '示例订阅', url: 'https://javdb.com/actors/example',
          entity_id: null, enabled: true, interval_minutes: 360, last_fetched_at: null, last_new_count: 0,
        }] } }));
        await page.reload({ waitUntil: 'load' });
        await page.getByRole('tab', { name: '关注列表', exact: true }).waitFor();
        const table = page.getByRole('grid', { name: 'JAV 订阅源', exact: true });
        await visibleSelectAll(table);
        assert.equal(await table.locator('tbody img[src="/site-mark?source=javdb"]').count(), 1);
        await verifyTablePreferences(page, table, 'JAV 订阅源', 'name', { id: 'interval', label: '频率' });
        await noPageOverflow(page);
        await page.screenshot({ path: `../build/agent-verification/all-tables/feeds-${viewport.name}.png` });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
    it(`${viewport.name}：两张别名表列设置独立，空白选择和改名按钮不冲突`, { timeout: 60000 }, async () => {
      const opened = await openFollowManage(browser, viewport);
      const { page } = opened;
      try {
        const name = 'Suzutaru 3D (鈴太郎3D)'; let renamed = false;
        await page.route('**/api/follow?summary=1', route => route.fulfill({ json: {
          sources: [followSource(1, name, 'Kemono', name)], counts: {}, suggestions: [],
          author_aliases: [{ canonical_key: renamed ? '鈴太郎3d' : 'suzutaru3d(鈴太郎3d)', canonical_name: renamed ? '鈴太郎3D' : name,
            aliases: [{ key: 'platform', name: renamed ? name : '鈴太郎3D' }] }],
          alias_suggestions: [{ canonical: '作者 B', alias: '平台别名 B', evidence: '来源确认' }],
        } }));
        await page.goto(new URL('/subscriptions?tab=add', page.url()).href, { waitUntil: 'load' });
        const pending = page.getByRole('grid', { name: '待合并创作者别名', exact: true });
        const saved = page.getByRole('grid', { name: '已保存创作者别名', exact: true });
        await verifyTablePreferences(page, pending, '待合并创作者别名', 'canonical', { id: 'evidence', label: '依据' });
        await verifyTablePreferences(page, saved, '已保存创作者别名', 'canonical', { id: 'aliases', label: '平台别名' });
        const identity = saved.locator('tbody td').nth(1);
        const inset = await identity.evaluate(node => node.querySelector('span')!.getBoundingClientRect().left - node.getBoundingClientRect().left);
        assert.ok(inset <= 16, `头像左侧间隔 ${inset}`);
        await identity.click({ position: { x: 260, y: 4 } });
        assert.equal(await saved.locator('tbody input').isChecked(), true);
        await identity.click({ position: { x: 260, y: 4 } });
        await saved.getByRole('button', { name: `修改 ${name} 的统一名称`, exact: true }).click();
        const dialog = page.getByRole('dialog', { name: '修改统一名称', exact: true });
        await dialog.getByRole('button', { name: '鈴太郎3D', exact: true }).click();
        await page.route('**/api/follow/author-alias', route => {
          assert.equal(route.request().postDataJSON().action, 'rename'); renamed = true;
          return route.fulfill({ json: { ok: true } });
        });
        await dialog.getByRole('button', { name: '修改统一名称', exact: true }).click();
        await saved.getByText('鈴太郎3D', { exact: true }).waitFor();
        await noPageOverflow(page);
        await page.screenshot({ path: `../build/agent-verification/all-tables/aliases-${viewport.name}.png` });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
  }
});
