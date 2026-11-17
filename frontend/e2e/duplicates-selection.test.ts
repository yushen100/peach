import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { launch, layout, settle, visit, VIEWPORTS } from './harness.ts';

describe('重复文件逐份回收', () => {
  let browser: Browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  it('相同名称完整显示，名称和路径差异在宽窄视口切换后保留高亮', { timeout: 60_000 }, async () => {
    const names = ['ABC-123 演示画面 [1080p] 完整文件名.mp4', 'ABC-123 演示画面 [720p] 完整文件名.mp4'];
    const opened = await visit(browser, '/duplicates', VIEWPORTS[0]!, async page => {
      await page.route('**/thumb?**', route => route.fulfill({
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=', 'base64'),
      }));
      await page.route('**/api/duplicates?**', route => route.fulfill({ json: {
        total: 2, files: 4, reclaimable: 2000,
        groups: ['SSNI-677', 'ABC-123'].map((code, index) => ({
          code, count: 2, identical: false, drives: ['R:'], cross_drive: false, reclaimable: 1000,
          files: [0, 1].map(part => ({ id: 100 + index * 2 + part,
            name: index ? names[part] : 'ssni-677-C.mp4',
            path: `R:\\${part ? 'second' : 'first'}\\${index ? names[part] : 'ssni-677-C.mp4'}`,
            location: 'local', drive: 'R:', size: 1000, duration: 3600,
            is_largest: part === 0, is_longest: part === 0,
          })),
        })),
      } }));
    });
    try {
      const { page } = opened;
      const name = page.getByRole('button', { name: names[0]!, exact: true });
      await name.waitFor();
      await settle(page);
      await page.waitForFunction(expected => document.querySelector(`button[title="${expected}"]`)?.textContent === expected, names[0]);
      const identical = page.getByRole('region', { name: 'SSNI-677', exact: true });
      assert.deepEqual(await identical.locator('button[title="ssni-677-C.mp4"]').allTextContents(),
        ['ssni-677-C.mp4', 'ssni-677-C.mp4']);
      assert.ok(await identical.locator('mark[data-review-difference]').count() > 0);
      await page.setViewportSize({ width: 390, height: 844 });
      await settle(page);
      await page.waitForFunction(expected => document.querySelector(`button[title="${expected}"]`)?.textContent?.includes('…'), names[0]);
      await page.setViewportSize({ width: 1280, height: 800 });
      await settle(page);
      await page.waitForFunction(expected => document.querySelector(`button[title="${expected}"]`)?.textContent === expected, names[0]);
      assert.ok(await name.locator('mark[data-review-difference]').count() > 0);
      const dimensions = await layout(page);
      assert.ok(dimensions.scrollWidth <= dimensions.viewportWidth);
      assert.deepEqual(opened.problems, []);
    } finally { await opened.close(); }
  });

  for (const viewport of VIEWPORTS) {
    it(`勾选、取消确认、长按回收与撤销使用同一份文件（${viewport.name}）`, { timeout: 60_000 }, async () => {
      const batches: { ids: number[]; operation: string; disposal_reason?: string }[] = [];
      let disposed = false;
      const opened = await visit(browser, '/duplicates', viewport, async page => {
        await page.route('**/cover?**', route => route.fulfill({
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=', 'base64'),
        }));
        await page.route('**/thumb?**', route => route.fulfill({
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=', 'base64'),
        }));
        await page.route('**/api/duplicates?**', route => {
          const files = [1, 2, 3].filter(id => !disposed || id !== 2).map(id => ({
            id, name: `ABC-${id}.mp4`, path: `R:\\Media\\ABC-${id}.mp4`, location: 'local', drive: 'R:',
            size: 1000, duration: 3600, is_largest: id === 1, is_longest: id === 1,
            code: 'ABC-001', has_cover: id === 1, cover_version: id === 1 ? 'fixture-cover' : '',
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
        await page.waitForFunction(() => {
          const image = document.querySelector<HTMLImageElement>('.duplicate-row img[src^="/cover?"]');
          return image?.complete && image.naturalWidth > 0;
        });
        const cover = group.locator('img[src="/cover?code=ABC-001&thumb=2&v=fixture-cover"]');
        assert.equal(await cover.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0), true);
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
