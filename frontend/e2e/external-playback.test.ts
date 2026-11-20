import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { launch, layout, VIEWPORTS } from './harness.ts';
import { ITEM, openItemPage } from './item-fixture.ts';

const PLAYER_SELECT = '[data-local-playback] button[aria-haspopup="listbox"]';

describe('外部播放器', () => {
  let browser: Browser;
  before(async () => { browser = await launch() });
  after(async () => { await browser.close() });
  for (const viewport of [VIEWPORTS.find((one) => !one.mobile)!, VIEWPORTS.find((one) => one.mobile)!]) {
    it(`${viewport.mobile ? '手机' : '桌面'}详情共用播放器选择与打开按钮`, { timeout: 60_000 }, async () => {
      const opened = await openItemPage(browser, `/assets/${ITEM.plain}`, viewport);
      try {
        const page = opened.page;
        await page.route('**/api/local-players', route => route.fulfill({ json: { players: [
          { id: 'default', label: '系统默认播放器' }, { id: 'potplayer', label: 'PotPlayer' },
        ] } }));
        let selected = '';
        let failOpen = false;
        await page.route('**/api/local-playback?*', route => {
          selected = new URL(route.request().url()).searchParams.get('player') || '';
          if (failOpen) return route.fulfill({ status: 503, json: { detail: '无法打开播放器' } });
          return route.fulfill({ json: { opened: true } });
        });
        await page.reload();
        const chooser = page.locator(PLAYER_SELECT);
        await chooser.waitFor();
        assert.equal(await page.locator('#stage details[open]').count(), 0);
        assert.equal(await page.getByText('外部播放器 / VR', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: '使用外部播放器打开', exact: true }).count(), 1);
        const waitForChevron = (expanded: boolean) => page.waitForFunction(expanded => {
          const icon = document.querySelector('[data-local-playback] button[aria-haspopup="listbox"]:not(:disabled) > svg');
          return icon && icon.parentElement?.getAttribute('aria-expanded') === String(expanded)
            && getComputedStyle(icon).rotate === (expanded ? '180deg' : 'none');
        }, expanded);
        await waitForChevron(false);
        await chooser.click();
        await waitForChevron(true);
        await page.keyboard.press('Escape');
        await waitForChevron(false);
        assert.equal(await chooser.evaluate(button => button === document.activeElement), true);
        assert.match(await chooser.ariaSnapshot(), /外部播放器/);

        await page.keyboard.press('Enter');
        await waitForChevron(true);
        await page.keyboard.press('Tab');
        await waitForChevron(false);
        assert.equal(await page.getByRole('button', { name: '使用外部播放器打开', exact: true })
          .evaluate(button => button === document.activeElement), true);

        await chooser.click();
        await page.getByRole('option', { name: 'PotPlayer', exact: true }).click();
        await waitForChevron(false);
        await page.getByRole('button', { name: '使用外部播放器打开', exact: true }).click();
        await page.waitForFunction(() => document.body.textContent?.includes('已请求打开本地播放器'));
        assert.equal(selected, 'potplayer');
        failOpen = true;
        await page.getByRole('button', { name: '使用外部播放器打开', exact: true }).click();
        await page.locator('[data-local-playback] [role="alert"]').waitFor();
        const geometry = await page.locator('[data-local-playback]').evaluate(host => {
          const row = host.querySelector('[data-local-playback-row]')!.getBoundingClientRect();
          const error = host.querySelector('[role="alert"]')!.getBoundingClientRect();
          const select = host.querySelector('button[aria-haspopup="listbox"]')!.getBoundingClientRect();
          const button = host.querySelector('[aria-label="使用外部播放器打开"]')!.getBoundingClientRect();
          return { gap: error.top - row.bottom, left: error.left - row.left,
            sameTop: Math.abs(select.top - button.top), sameHeight: Math.abs(select.height - button.height) };
        });
        assert.equal(geometry.gap, 8);
        assert.equal(geometry.left, 0);
        assert.equal(geometry.sameTop, 0);
        assert.equal(geometry.sameHeight, 0);
        assert.deepEqual((await layout(page)).offenders, []);
      } finally { await opened.close() }
    });

    it(`${viewport.mobile ? '手机' : '桌面'}按需生成可复制的网络地址`, { timeout: 60_000 }, async () => {
      const opened = await openItemPage(browser, `/assets/${ITEM.plain}`, viewport, { ready: '#stage[open] [data-item-side]' });
      try {
        const page = opened.page;
        let requested = 0;
        await page.route('**/api/external-playback?*', route => {
          requested++;
          return route.fulfill({ json: { url: `/external-stream/${ITEM.plain}?ticket=${'a'.repeat(90)}`,
            playlist: `/external-playlist/${ITEM.plain}.m3u?ticket=${'a'.repeat(90)}` } });
        });
        await page.locator(PLAYER_SELECT).click();
        await page.getByRole('option', { name: '网络播放地址 / VR', exact: true }).click();
        assert.equal(requested, 0);
        await page.getByRole('button', { name: '使用外部播放器打开', exact: true }).click();
        await page.getByRole('textbox', { name: '网络播放地址' }).waitFor();
        assert.equal(requested, 1);
        assert.match(await page.getByRole('textbox', { name: '网络播放地址' }).inputValue(), /\/external-stream\/11\?ticket=/);
        assert.deepEqual((await layout(page)).offenders, []);
      } finally { await opened.close() }
    });
  }
});
