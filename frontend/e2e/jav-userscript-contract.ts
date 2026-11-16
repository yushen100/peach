import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [origin, scriptPath, executablePath] = process.argv.slice(2);
const script = readFileSync(scriptPath, 'utf8');
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    for (const [url, code, label] of [
      ['https://video.dmm.co.jp/av/content/?id=1dandy00899', 'DANDY-899', 'メーカー品番：'],
      ['https://video.dmm.co.jp/av/content/?id=1dandy00851c', 'DANDY-851C', 'メーカー品番：'],
      ['https://video.dmm.co.jp/av/content/?id=118abw00220', 'ABW-220', 'メーカー品番：'],
      ['https://www.mgstage.com/product/product_detail/104DANDY-851C/', '104DANDY-851C', '品番：'],
      ['https://clip.fanza.jp/moment?id=img-saba00978-011', 'SABA-978', '品番：'],
    ]) {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const requests = [];
        const problems = [];
        page.on('pageerror', error => problems.push(error.message));
        await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body:
          `<!doctype html><meta charset="utf-8"><title>作品详情</title><table><tr><th>${label}</th><td>${code}</td></tr></table>` }));
        await page.exposeFunction('peachContract', async request => {
          assert.equal(request.method, 'GET');
          const parsed = new URL(request.url);
          assert.equal(parsed.pathname, '/api/jav-browser/identify');
          assert.equal(parsed.searchParams.get('source_url'), url);
          // 脚本只按地址识别，页面上的品番字段不随请求提交。
          assert.equal(parsed.searchParams.get('code'), null);
          requests.push(request.url);
          const response = await fetch(origin + parsed.pathname + parsed.search);
          return { status: response.status, responseText: await response.text() };
        });
        await page.addInitScript(() => {
          // 这里只核对服务端识别契约，向自动化选择器开放界面。
          const attach = Element.prototype.attachShadow;
          Element.prototype.attachShadow = function (options) {
            return attach.call(this, { ...options, mode: 'open' });
          };
          Object.assign(window, {
            GM_getValue: key => key === 'peach.jav.base' ? 'https://peach-contract.example.invalid' : 'isolated-test-token',
            GM_setValue: () => {}, GM_registerMenuCommand: () => {},
            // 共享进度的任务列表按不提供该接口的 Peach 应答，这里只核对识别接口。
            GM_xmlhttpRequest: request => new URL(request.url).pathname === '/api/jav-browser/active'
              ? setTimeout(() => request.onload({ status: 404, responseText: '{}' }), 0)
              : window.peachContract({ method: request.method, url: request.url })
                .then(response => request.onload(response), () => request.onerror()),
          });
        });
        await page.goto(url);
        await page.addScriptTag({ content: script });
        await page.waitForFunction(expected => {
          const root = document.getElementById('peach-jav-action')?.shadowRoot;
          return root?.querySelector('.bar strong')?.textContent === expected
            && root.querySelector('[data-action="add"]')?.getAttribute('aria-busy') === 'false'
            && root.querySelector('p')?.textContent === '可以加入 Peach 馆藏';
        }, code, { timeout: 15000 });
        assert.equal(requests.length, 1);
        assert.deepEqual(problems, []);
      } finally { await context.close(); }
    }
  }
  console.log('真实识别接口与完整用户脚本：10 个桌面和手机场景通过');
} finally { await browser.close(); }
