import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { launch, layout, settle, visit, VIEWPORTS } from './harness.ts';

describe('配置表单与行间距', () => {
  let browser: Browser;
  before(async () => { browser = await launch() });
  after(async () => { await browser?.close() });
  for (const viewport of VIEWPORTS) {
    it(`${viewport.name}：拖动下载版本不会产生横向滚动`, async () => {
      const opened = await visit(browser, '/settings/downloads', viewport);
      const { page } = opened;
      try {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.route('**/api/configuration', async route => {
          const data = await (await route.fetch()).json();
          await route.fulfill({ json: { ...data, downloads: {
            ...data.downloads, media_sources: ['guangya'], token_set: false,
          } } });
        });
        await page.reload();
        const order = page.getByRole('group', { name: '优先下载的版本' }).locator('[data-navigation-rows]');
        const first = order.getByRole('group', { name: '中字', exact: true });
        const second = order.getByRole('group', { name: '无码', exact: true });
        await first.scrollIntoViewIfNeeded();
        const start = await first.boundingBox();
        const target = await second.boundingBox();
        assert.ok(start && target);
        const horizontalScroll = () => order.evaluate(element => {
          const previous = element.scrollLeft;
          element.scrollLeft = element.clientWidth;
          const actual = element.scrollLeft;
          element.scrollLeft = previous;
          return actual;
        });
        await page.mouse.move(start.x + 18, start.y + start.height / 2);
        await page.mouse.down();
        try {
          await page.mouse.move(start.x + 18 + Math.min(120, start.width / 3), target.y + target.height * 0.8);
          assert.equal(await order.locator('[data-dragging]').count(), 1);
          assert.ok(await order.evaluate(element => element.scrollWidth > element.clientWidth));
          assert.equal(await horizontalScroll(), 0);
        } finally { await page.mouse.up() }
        assert.equal(await horizontalScroll(), 0);
        assert.equal(await order.getByRole('group').first().getAttribute('aria-label'), '无码');
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
    it(`${viewport.name}：云下载空检查报告不占据分隔区域`, async () => {
      const opened = await visit(browser, '/settings/library?section=' + encodeURIComponent('下载渠道'), viewport);
      const { page } = opened;
      try {
        await page.route('**/api/configuration', async route => {
          const data = await (await route.fetch()).json();
          await route.fulfill({ json: { ...data, downloads: { ...data.downloads, media_sources: ['guangya'], token_set: true,
            config: { ...data.downloads.config, clouddrive_address: 'http://127.0.0.1:19798' } } } });
        });
        await page.route('**/api/configuration/downloads/check', route => route.fulfill({ json: {
          ok: true, address: 'http://127.0.0.1:19798', permissions: [], missing: [], root: '/', folder: null,
          quota: null, suggested_target: null, suggested_pikpak_root: '', problems: [],
        } }));
        await page.reload();
        const form = page.getByRole('form', { name: '云下载', exact: true });
        await form.getByRole('button', { name: '检查连接', exact: true }).click();
        await settle(page);
        assert.equal(await form.locator('dl').count(), 0);
        assert.equal(await form.locator('.border-t').count(), 1);
        const empty = await form.locator('div:not([aria-live])').evaluateAll(nodes => nodes.filter(node =>
          !node.childNodes.length && node.getBoundingClientRect().height > 0).map(node => node.className));
        assert.deepEqual(empty, []);
        assert.ok((await layout(page)).scrollWidth <= viewport.width + 1);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
    it(`${viewport.name}：来源站标本地提供，帮助链接紧接文字`, async () => {
      const opened = await visit(browser, '/settings/subscriptions', viewport);
      const { page } = opened;
      try {
        const section = page.getByRole('form', { name: '资源搜索', exact: true });
        await section.getByText('索引器连接帮助', { exact: true }).click();
        const link = section.getByRole('link', { name: '详细配置说明', exact: true });
        await link.waitFor({ state: 'visible' });
        assert.equal(await link.evaluate(node => node.parentElement?.tagName), 'P');
        const head = page.locator('b').filter({ hasText: /^F95zone$/ }).locator('..');
        const icon = head.locator('img');
        await icon.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('img[src*="provider=f95zone"]')].some(image => image.complete && image.naturalWidth > 0));
        assert.equal(await icon.getAttribute('src'), '/source-icon?provider=f95zone');
        await icon.evaluate(image => image.dispatchEvent(new Event('error')));
        await head.locator('svg').waitFor();
        assert.equal(await head.locator('img').count(), 0);
        await section.screenshot({ path: `../build/indexer-help-${viewport.name}.png` });
        assert.deepEqual((await layout(page)).offenders, []);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
    it(`${viewport.name}：应用更新包说明和体积不越出视口`, async () => {
      const opened = await visit(browser, '/settings/library?section=' + encodeURIComponent('应用与维护'), viewport);
      const { page } = opened;
      try {
        await page.route('**/api/configuration', async route => {
          const data = await (await route.fetch()).json();
          await route.fulfill({ json: { ...data, updates: { ...data.updates, installation: '独立测试包', installation_code: 'standalone',
            state: 'available', latest_version: '1.0.0', message: '有新版本可下载。', package_kind: 'update',
            asset_size: 12 * 1048576, release_url: 'https://github.com/peach-mitao/peach/releases/tag/v1.0.0' },
            update_job: { state: 'idle', progress: 0 } } });
        });
        await page.reload();
        const region = page.getByRole('region', { name: '检查更新', exact: true });
        await region.getByText('应用更新包 · 12.0 MB', { exact: true }).waitFor();
        assert.ok((await region.innerText()).includes('工具缺失、损坏或版本变化时会另行下载'));
        assert.equal(await region.getByRole('link', { name: '完整安装包', exact: true }).count(), 0);
        await settle(page);
        assert.ok((await layout(page)).scrollWidth <= viewport.width + 1);
        await region.screenshot({ path: `../build/update-download-${viewport.name}.png` });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
    it(`${viewport.name}：挂载目录的流量保护可切换且不越出视口`, async () => {
      const opened = await visit(browser, '/settings/library?section=' + encodeURIComponent('这台电脑'), viewport);
      const { page } = opened;
      try {
        await page.route('**/api/configuration/cloud-proxies', route => route.fulfill({ json: { accounts: [] } }));
        await page.route('**/api/configuration', async route => {
          const data = await (await route.fetch()).json();
          await route.fulfill({ json: { ...data, editable: true, windows: true, media_sources: [
            { location: 'onedrive', root: 'O:\\Movies', path: 'O:\\Movies', cost: 'metered' },
            { location: 'mounted', root: 'M:\\Movies', path: 'M:\\Movies', cost: 'free' },
            { location: 'guangya', root: 'G:\\Movies', path: 'G:\\Movies', cost: 'free' },
            { location: '115', root: 'B:\\Movies', path: 'B:\\Movies', cost: 'free' },
            { location: 'pikpak', root: 'A:\\Movies', path: 'A:\\Movies', cost: 'metered' },
          ] } });
        });
        await page.reload();
        const form = page.getByRole('form', { name: '媒体库与目录', exact: true });
        const protectedFolder = form.locator('[data-media-read-policy="0"] [aria-haspopup="listbox"]');
        await protectedFolder.waitFor();
        // 带品牌图的四个媒体库，标题行的图标、文件夹行的来源与所属媒体库各显示一枚站标。
        await page.waitForFunction(() => {
          const marks = [...document.querySelectorAll<HTMLImageElement>('[data-library-block] img')];
          return marks.length === 12 &&marks.every(image => image.complete && image.naturalWidth > 0);
        });
        const marks = await form.locator('[data-library-block] img').evaluateAll(images => images.map(image => {
          // 站标是行内字形，画框取 `--icon-inline`（所在文字字号的 1.2 倍）。
          const box = image.getBoundingClientRect();
          const glyph = parseFloat(getComputedStyle(image).fontSize) * 1.2;
          return { inline: image.getAttribute('src')?.startsWith('data:image/png;base64,'),
            sized: Math.abs(box.width - glyph) < 0.5 && Math.abs(box.height - glyph) < 0.5 };
        }));
        assert.deepEqual(marks, Array.from({ length: 12 }, () => ({ inline: true, sized: true })));
        assert.ok(!(await form.innerText()).includes('（只读）'));
        assert.ok((await protectedFolder.textContent())?.includes('流量保护'));
        assert.ok((await form.locator('[data-media-read-policy="1"]').textContent())?.includes('正常读取'));
        if (!viewport.mobile) {
          const spread = (boxes: { y: number; height: number }[]) => {
            const centers = boxes.map(box => box.y + box.height / 2);
            return Math.max(...centers) - Math.min(...centers);
          };
          for (let index = 0; index < 5; index++) {
            const block = form.locator('[data-library-block]').nth(index);
            const head = block.locator('[data-library-head]');
            const icon = await head.getByRole('button').first().boundingBox();
            const name = await head.getByRole('textbox').boundingBox();
            const preset = await head.locator('[aria-haspopup="listbox"]').last().boundingBox();
            const row = block.locator('[data-folder-row]');
            const source = await row.locator('[aria-haspopup="listbox"]').first().boundingBox();
            const policy = await row.locator('[data-media-read-policy] [aria-haspopup="listbox"]').boundingBox();
            const library = await row.getByRole('button', { name: new RegExp(`目录所属媒体库 ${index + 1}`) }).boundingBox();
            assert.ok(icon && name && preset && source && policy && library);
            // 媒体库的图标、名称与处理方式一排写在卡头；文件夹行的来源、读取策略与所属媒体库一排，同排控件中线对齐。
            assert.ok(spread([icon, name, preset]) <= 3, JSON.stringify({ index, icon, name, preset }));
            assert.ok(spread([source, policy, library]) <= 3, JSON.stringify({ index, source, policy, library }));
            assert.ok(source.y >= name.y + name.height, JSON.stringify({ index, name, source }));
            assert.ok(policy.x > source.x && library.x > policy.x);
            assert.ok(policy.width <= 132);
          }
        }
        await form.locator('[data-library-head]').first().getByRole('button').first().click();
        const icons = page.getByRole('radiogroup', { name: '可选图标', exact: true });
        await icons.waitFor();
        const inputBounds = await icons.locator('input[type="radio"]').evaluateAll(inputs => inputs.map(input => {
          const native = input.getBoundingClientRect();
          const label = input.closest('label')!.getBoundingClientRect();
          return native.top >= label.top - 1 && native.bottom <= label.bottom + 1
            && native.left >= label.left - 1 && native.right <= label.right + 1;
        }));
        assert.ok(inputBounds.length > 7 && inputBounds.every(Boolean), '图标网格的隐藏单选输入框越出所属格子');
        await icons.getByRole('radio', { name: '磁盘', exact: true }).focus();
        const iconScroll = await page.evaluate(() => window.scrollY);
        await page.keyboard.press('ArrowRight');
        assert.equal(await icons.getByRole('radio', { name: '资料库', exact: true }).isChecked(), true);
        assert.equal(await page.evaluate(() => window.scrollY), iconScroll, '选择图标移动了页面');
        await page.getByRole('dialog').filter({ has: icons }).getByRole('button', { name: '取消', exact: true }).click();
        await protectedFolder.click();
        await page.getByRole('option', { name: '正常读取', exact: true }).click();
        await settle(page);
        assert.ok((await protectedFolder.textContent())?.includes('正常读取'));
        assert.deepEqual((await layout(page)).offenders, []);
        await form.screenshot({ path: `../build/cloud-source-icons-${viewport.name}.png` });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });

    it(`${viewport.name}：PikPak 表单直接显示，登录按钮同排`, async () => {
      const opened = await visit(browser, '/settings/library?section=' + encodeURIComponent('下载渠道'), viewport);
      const { page } = opened;
      try {
        await page.route('**/api/configuration', async route => {
          const data = await (await route.fetch()).json();
          const body = data.downloads;
          await route.fulfill({ json: { ...data, downloads: { ...body, available: true, media_sources: ['pikpak'],
            pikpak: { ...body.pikpak, logged_in: false },
            pikpak_browser: { available: true, state: 'idle', message: '' } } } });
        });
        await page.reload();
        const form = page.getByRole('form', { name: 'PikPak 账号', exact: true });
        await form.getByLabel('账号', { exact: true }).waitFor();
        assert.equal(await form.locator('details').count(), 0);
        const password = await form.getByRole('button', { name: '登录', exact: true }).boundingBox();
        const browserLogin = await form.getByRole('button', { name: '用浏览器登录', exact: true }).boundingBox();
        assert.ok(password && browserLogin && Math.abs(password.y - browserLogin.y) <= 1);
        assert.ok((await layout(page)).scrollWidth <= viewport.width + 1);
        await form.screenshot({ path: `../build/pikpak-form-${viewport.name}.png` });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
    it(`${viewport.name}：完全卸载行与设置卡片正文对齐`, async () => {
      const opened = await visit(browser, '/settings/library?section=' + encodeURIComponent('应用与维护'), viewport);
      const { page } = opened;
      try {
        await page.route('**/api/configuration', async route => {
          const data = await (await route.fetch()).json();
          await route.fulfill({ json: { ...data, uninstall: { ...data.uninstall, available: false } } });
        });
        await page.reload();
        const region = page.getByRole('region', { name: '卸载 Peach', exact: true });
        await region.getByText('完全卸载', { exact: true }).waitFor();
        await settle(page);
        const geometry = await region.evaluate(node => {
          const card = node.lastElementChild!.getBoundingClientRect();
          const label = [...node.querySelectorAll('p')].find(item => item.textContent === '完全卸载')!.getBoundingClientRect();
          return { top: label.top - card.top, left: label.left - card.left };
        });
        assert.ok(geometry.top <= 12 && geometry.top >= 9, JSON.stringify(geometry));
        assert.ok(Math.abs(geometry.left - 12) <= 1, JSON.stringify(geometry));
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
  }
});
