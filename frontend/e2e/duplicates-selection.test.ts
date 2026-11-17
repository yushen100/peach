import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { launch, layout, settle, visit, VIEWPORTS } from './harness.ts';

describe('重复文件逐份回收', () => {
  let browser: Browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  for (const viewport of VIEWPORTS) {
    it(`勾选、取消确认、长按回收与撤销使用同一份文件（${viewport.name}）`, { timeout: 60_000 }, async () => {
      const batches: { ids: number[]; operation: string; disposal_reason?: string }[] = [];
      let disposed = false;
      const opened = await visit(browser, '/duplicates', viewport, async page => {
        await page.route('**/thumb?**', route => route.fulfill({
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=', 'base64'),
        }));
        await page.route('**/api/duplicates?**', route => {
          const files = [1, 2, 3].filter(id => !disposed || id !== 2).map(id => ({
            id, name: `ABC-${id}.mp4`, path: `R:\\Media\\ABC-${id}.mp4`, location: 'local', drive: 'R:',
            size: 1000, duration: 3600, is_largest: id === 1, is_longest: id === 1,
          }));
          return route.fulfill({ json: { total: 1, files: files.length, reclaimable: 2000, groups: [{
            code: 'ABC-001', count: files.length, identical: true, drives: ['R:'], cross_drive: false,
            reclaimable: 2000, files,
          }] } });
        });
        await page.route('**/api/batch', route => {
          const body = JSON.parse(route.request().postData() || '{}');
          batches.push(body);
          disposed = body.operation === 'dispose';
          return route.fulfill({ json: { ok: true, changed: body.ids.length } });
        });
      });
      try {
        const { page } = opened;
        const group = page.getByRole('region', { name: 'ABC-001', exact: true });
        await group.waitFor();
        await settle(page);
        const selected = page.getByRole('checkbox', { name: '选择回收 ABC-2.mp4', exact: true });
        assert.equal(await selected.isChecked(), false);
        await group.locator('label').filter({ has: selected }).click();
        assert.equal(await selected.isChecked(), true);
        await group.getByRole('button', { name: '回收所选 1 项', exact: true }).click();
        const dialog = page.locator('dialog[open]');
        assert.match(await dialog.innerText(), /其余 2 个文件保留/);
        await dialog.getByRole('button', { name: '取消', exact: true }).click();
        assert.deepEqual(batches, []);
        assert.equal(await selected.isChecked(), true);
        await group.getByRole('button', { name: '回收所选 1 项', exact: true }).click();
        const confirm = dialog.locator('[data-hold-confirm]');
        await confirm.press('Enter', { delay: 2100 });
        await selected.waitFor({ state: 'detached' });
        assert.deepEqual(batches, [{ ids: [2], operation: 'dispose', disposal_reason: 'duplicate' }]);
        await page.getByRole('button', { name: '撤销', exact: true }).last().click();
        await selected.waitFor();
        assert.deepEqual(batches.at(-1), { ids: [2], operation: 'restore' });
        assert.equal(await selected.isChecked(), false);
        const dimensions = await layout(page);
        assert.ok(dimensions.scrollWidth <= dimensions.viewportWidth);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });
  }
});
