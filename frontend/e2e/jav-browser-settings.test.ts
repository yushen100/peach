import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { launch, layout, settle, visit, VIEWPORTS } from './harness.ts';

const SITES = JSON.parse(readFileSync(new URL('../../web/integrations/jav-sites.json', import.meta.url), 'utf8')).sites;
const SCRIPT = readFileSync(new URL('../../web/integrations/peach-jav.user.js', import.meta.url), 'utf8');
const RELEASE = JSON.parse(readFileSync(new URL('../../web/integrations/jav-userscript-release.json', import.meta.url), 'utf8'));
const USERSCRIPT = { version: RELEASE.version, minimum_version: RELEASE.bridge_min_version, install_url: RELEASE.install_url };

describe('浏览器添加 JAV 设置', () => {
  let browser: Browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });
  for (const viewport of VIEWPORTS) {
    it(`${viewport.name}：启用、轮换与关闭，令牌只在签发响应后显示`, async () => {
      const opened = await visit(browser, '/settings/library?section=' + encodeURIComponent('下载渠道'), viewport);
      const { page } = opened;
      try {
        let enabled = false;
        const posted: Record<string, unknown>[] = [];
        await page.route('**/api/configuration/jav-browser', async route => {
          const request = route.request();
          const state = { enabled, provider: '115', available: true, userscript: USERSCRIPT, sites: SITES, want_on_no_match: true, providers: [
            { key: '115', label: '115', configured: true, target: '/115/Movies' },
            { key: 'pikpak', label: 'PikPak', configured: true, target: '/Movies' },
          ] };
          if (request.method() === 'POST') {
            const body = request.postDataJSON();
            posted.push(body);
            enabled = body.action !== 'disable';
            await route.fulfill({ json: { ...state, enabled,
              ...(enabled ? { token: 'test-issued-token-' + posted.length } : {}) } });
          } else await route.fulfill({ json: state });
        });
        await page.reload();
        const region = page.getByRole('region', { name: '浏览器添加 JAV', exact: true });
        const install = region.getByRole('link', { name: '安装 Peach 用户脚本' });
        await install.waitFor();
        const channel = region.locator('button[aria-haspopup="listbox"]');
        const installBox = await region.locator('[data-userscript-status]').boundingBox();
        const channelBox = await channel.boundingBox();
        assert.ok(installBox && channelBox && Math.abs(installBox.x - channelBox.x) <= 1,
          JSON.stringify({ installBox, channelBox }));
        assert.equal(await channel.locator('img').count(), 1);
        const status = region.locator('[data-userscript-status]').getByText('未启用', { exact: true }).or(
          region.locator('[data-userscript-status]').getByText('已启用', { exact: true }));
        assert.equal(await status.innerText(), '未启用');
        const statusColor = () => status.evaluate(node => getComputedStyle(node).color);
        const disabledColor = await statusColor();
        const themeColor = (token: string) => page.evaluate(token => {
          const sample = document.createElement('span');
          sample.style.color = `var(${token})`;
          document.querySelector('.peach-react')!.append(sample);
          const color = getComputedStyle(sample).color;
          sample.remove();
          return color;
        }, token);
        assert.equal(disabledColor, await themeColor('--color-text-secondary'));
        await channel.scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await channel.click();
        const pikpak = page.getByRole('option', { name: 'PikPak', exact: true });
        await pikpak.waitFor();
        const overflow = await page.getByRole('listbox').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
        assert.ok(overflow.scroll <= overflow.width + 1, JSON.stringify(overflow));
        assert.equal(await pikpak.locator('img').count(), 1);
        const cloud115 = page.getByRole('option', { name: '115', exact: true });
        assert.equal(await cloud115.locator('img').count(), 1);
        await cloud115.click();
        await region.getByRole('button', { name: '启用并生成令牌', exact: true }).click();
        const token = region.getByLabel('浏览器添加专用令牌', { exact: true });
        await token.waitFor();
        assert.equal(await status.innerText(), '已启用');
        assert.notEqual(await statusColor(), disabledColor);
        assert.equal(await statusColor(), await themeColor('--color-status-lime-text'));
        const channelLabelBox = await region.getByText('浏览器添加的下载渠道', { exact: true }).boundingBox();
        const channelFieldBox = await channel.boundingBox();
        assert.ok(channelLabelBox && channelFieldBox);
        const channelGap = channelFieldBox.y - channelLabelBox.y - channelLabelBox.height;
        const inputGaps = await region.locator('[data-input-size]').evaluateAll(fields => fields.map(field => {
          const label = field.querySelector('label')!;
          const control = label.nextElementSibling!;
          return control.getBoundingClientRect().top - label.getBoundingClientRect().bottom;
        }));
        assert.equal(inputGaps.length, 2);
        assert.ok(inputGaps.every(gap => Math.abs(gap - channelGap) <= 0.5),
          JSON.stringify({ channelGap, inputGaps }));
        assert.equal(await token.inputValue(), 'test-issued-token-1');
        assert.equal(await token.getAttribute('type'), 'password');
        const refreshed = page.waitForResponse(response => response.url().endsWith('/api/configuration/jav-browser')
          && response.request().method() === 'GET');
        await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
        await refreshed;
        assert.equal(await token.inputValue(), 'test-issued-token-1');
        await page.evaluate(() => {
          const copied: string[] = [];
          Object.assign(window, { pairingClipboard: copied });
          Object.defineProperty(navigator, 'clipboard', { configurable: true,
            value: { writeText: async (value: string) => { copied.push(value); } } });
        });
        await region.getByRole('button', { name: '复制配对信息', exact: true }).click();
        const copied = await page.evaluate(() => (window as Window & { pairingClipboard: string[] }).pairingClipboard);
        assert.equal(copied.length, 1);
        assert.deepEqual(JSON.parse(copied[0]!), { peach_pairing: 1, base: new URL(page.url()).origin, token: 'test-issued-token-1' });
        assert.equal(await region.getByRole('link', { name: '安装 Peach 用户脚本' }).getAttribute('href'),
          USERSCRIPT.install_url);
        assert.equal(await region.getByLabel('Peach 地址', { exact: true }).inputValue(), new URL(page.url()).origin);
        await region.getByRole('button', { name: '更新渠道与令牌', exact: true }).click();
        await page.waitForFunction(() => document.querySelector<HTMLInputElement>(
          'input[type="password"][value="test-issued-token-2"]') !== null);
        await region.getByRole('button', { name: '关闭浏览器添加', exact: true }).click();
        await token.waitFor({ state: 'detached' });
        assert.equal(await region.getByRole('button', { name: '复制配对信息', exact: true }).count(), 0);
        assert.equal(await status.innerText(), '未启用');
        assert.equal(await statusColor(), disabledColor);
        assert.deepEqual(posted.map(body => body.action), ['enable', 'rotate', 'disable']);
        assert.ok(posted.every(body => body.provider === '115'));
        await settle(page);
        assert.ok((await layout(page)).scrollWidth <= viewport.width + 1);
        assert.deepEqual(opened.problems, []);
        await region.screenshot({ path: `../build/jav-browser-settings-${viewport.name}.png` });
      } finally { await opened.close(); }
    });
  }

  it('「没找到资源时加入想要」默认开启，切换即写入账本设置，写入失败退回原值', async () => {
    const opened = await visit(browser, '/settings/library?section=' + encodeURIComponent('下载渠道'), VIEWPORTS[0]!);
    const { page } = opened;
    try {
      await page.route('**/api/configuration/jav-browser', route => route.fulfill({ json: {
        enabled: true, provider: '115', available: true, userscript: USERSCRIPT, want_on_no_match: true,
        providers: [{ key: '115', label: '115', configured: true, target: '/Movies' }],
      } }));
      const posted: unknown[] = [];
      let failing = false;
      await page.route('**/api/settings', async route => {
        if (route.request().method() !== 'POST') return route.fallback();
        posted.push(route.request().postDataJSON());
        await (failing ? route.fulfill({ status: 500, json: { error: '写入失败' } }) : route.fulfill({ json: { ok: true } }));
      });
      await page.reload();
      const region = page.getByRole('region', { name: '浏览器添加 JAV', exact: true });
      const toggle = region.getByRole('switch', { name: '没找到资源时加入想要', exact: true });
      const face = toggle.locator('xpath=ancestor::label[1]');
      const settled = (checked: boolean) => toggle.and(page.locator(checked ? ':enabled:checked' : ':enabled:not(:checked)'))
        .waitFor({ state: 'attached', timeout: 10_000 });
      await settled(true);
      await face.click();
      await settled(false);
      assert.deepEqual(posted, [{ javBrowserWantOnNoMatch: false }]);
      failing = true;
      await face.click();
      await region.getByText('写入失败').waitFor();
      await settled(false);
      assert.deepEqual(posted, [{ javBrowserWantOnNoMatch: false }, { javBrowserWantOnNoMatch: true }]);
      assert.deepEqual(opened.problems.filter(problem => !String(problem).includes('500')), []);
    } finally { await opened.close(); }
  });

  it('桥接页延迟加载仍能检测脚本，未知来源消息不改变检测结果', async () => {
    const opened = await visit(browser, '/settings/library?section=' + encodeURIComponent('下载渠道'), VIEWPORTS[0]!);
    const { page } = opened;
    try {
      await page.route('**/api/configuration/jav-browser', route => route.fulfill({ json: {
        enabled: true, provider: '115', available: true, userscript: USERSCRIPT,
        providers: [{ key: '115', label: '115', configured: true, target: '/Movies' }],
      } }));
      let installed = true;
      await page.route('**/integrations/peach-userscript-bridge', async route => {
        if (installed) await new Promise(resolve => setTimeout(resolve, 3500));
        await route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="peach-userscript-bridge" content="1">'
          + (installed ? '<script>window.GM_getValue=(key,fallback)=>({"peach.jav.base":location.origin,"peach.jav.token":"test-only-stored-token"})[key]??fallback;</script><script>'
            + SCRIPT.replaceAll('</script', '<\\/script') + '</script>' : '') });
      });
      await page.reload();
      const region = page.getByRole('region', { name: '浏览器添加 JAV', exact: true });
      const connection = region.locator('[data-userscript-status] [data-connection-tone]');
      await connection.getByText('已连接', { exact: true }).waitFor();
      assert.equal(await connection.getAttribute('data-connection-tone'), 'success');
      await region.getByText(`用户脚本 v${RELEASE.version}`, { exact: true }).waitFor();
      assert.equal(await region.getByRole('link', { name: '安装 Peach 用户脚本' }).count(), 0);
      assert.equal(await region.getByLabel('浏览器添加专用令牌', { exact: true }).count(), 0);
      installed = false;
      await region.getByRole('button', { name: '重新检测', exact: true }).click();
      await connection.getByText('未检测到', { exact: true }).waitFor();
      assert.equal(await connection.getAttribute('data-connection-tone'), 'neutral');
      await page.evaluate(() => window.postMessage({ type: 'peach-userscript:ready', protocol: 1,
        version: '9.0.0', paired: true, nonce: crypto.randomUUID() }, location.origin));
      assert.equal(await connection.getByText('未检测到', { exact: true }).count(), 1);
      assert.equal(await region.getByRole('link', { name: '安装 Peach 用户脚本' }).count(), 1);
      assert.ok((await region.innerText()).includes('允许用户脚本'));
      assert.equal(await region.getByRole('link', { name: 'Tampermonkey 权限设置说明' }).getAttribute('href'),
        'https://www.tampermonkey.net/faq.php#Q209');
      assert.deepEqual(opened.problems, []);
    } finally { await opened.close(); }
  });
});
