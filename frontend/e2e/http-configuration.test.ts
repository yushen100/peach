import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import type { Browser, Page, Route } from 'playwright-core';
import { configurationBody, expectBody, launch, layout, requiredEnv, settle, visit, VIEWPORTS, type Visit } from './harness.ts';

function forwardingState() {
  const active = new Map<Route, { url: string; phase: string }>();
  const errors: string[] = [];
  return { active, errors, snapshot: () => ({ active: [...active.values()], errors }) };
}

async function forwardHttp(page: Page, origin: string, service: string, signal: AbortSignal,
  state = forwardingState()): Promise<void> {
  await page.route(`${origin}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pending = { url: url.pathname + url.search, phase: 'fetch' };
    state.active.set(route, pending);
    try {
      const response = await route.fetch({ url: service + url.pathname + url.search, maxRedirects: 0, signal,
        headers: { ...request.headers(), host: new URL(service).host, origin: service } });
      pending.phase = 'fulfill';
      await route.fulfill({ response });
    } catch (error) {
      state.errors.push(`${pending.phase} ${pending.url}: ${String(error)}`);
      if (signal.aborted && error instanceof Error && error.name === 'AbortError' && error.cause === signal.reason) {
        pending.phase = 'abort';
        await route.abort().catch(error => {
          if (!/already handled|disposed|closed/i.test(String(error))) throw error;
        });
        return;
      }
      if (!/already handled|disposed|closed/i.test(String(error))) throw error;
    } finally {
      state.active.delete(route);
    }
  });
}

async function closeHttp(opened: Pick<Visit, 'page' | 'close'>, forwards: AbortController,
  phase: (value: string) => void = () => {}): Promise<void> {
  try {
    phase('离开播放器页面');
    await opened.page.goto('about:blank');
  } finally {
    // 独立转发先取消，再由上下文释放浏览器路由；关闭前等待 Route 会与失效目标形成互等。
    phase('取消请求转发');
    forwards.abort();
    phase('关闭浏览器上下文');
    await opened.close();
  }
}

describe('普通 HTTP 的配置与播放', () => {
  let browser: Browser;
  before(async () => { browser = await launch() });
  after(async () => { await browser?.close() });

  it('离开页面会取消尚未结束的转发响应并完成路由清理', { timeout: 60_000 }, async t => {
    let phase = '准备受控响应';
    t.after(() => { if (t.signal.aborted) t.diagnostic(`HTTP 取消回归超时阶段：${phase}`); });
    let notify!: () => void;
    const started = new Promise<void>(resolve => { notify = resolve; });
    let disconnected!: () => void;
    const cancelled = new Promise<void>(resolve => { disconnected = resolve; });
    const server = createServer((request, response) => {
      if (request.url === '/') { response.end('<html><body>HTTP</body></html>'); return; }
      if (request.url !== '/pending') { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('pending');
      response.on('close', disconnected);
      notify();
    });
    phase = '启动受控 HTTP 服务';
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    phase = '创建浏览器上下文';
    const context = await browser.newContext();
    t.after(async () => {
      await context.close();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });
    phase = '创建空白页';
    const page = await context.newPage();
    const origin = 'http://peach-forward.test';
    const forwards = new AbortController();
    phase = '挂载请求转发';
    await forwardHttp(page, origin, `http://127.0.0.1:${address.port}`, forwards.signal);
    phase = '打开受控页面';
    await page.goto(origin);
    phase = '发起未结束的响应';
    await page.evaluate(() => { void fetch('/pending').catch(() => {}); });
    phase = '等待转发开始';
    await started;
    await t.test('转发开始后十秒内取消并完成清理', { timeout: 10_000 }, async cancellation => {
      cancellation.after(() => {
        if (cancellation.signal.aborted) cancellation.diagnostic(`HTTP 取消回归超时阶段：${phase}`);
      });
      await closeHttp({ page, close: () => context.close() }, forwards, value => { phase = value; });
      phase = '等待服务端断连';
      await cancelled;
    });
  });

  it('路由等待依赖上下文释放时仍能关闭拥有者', { timeout: 2_000 }, async () => {
    let closed = false;
    let release!: () => void;
    const untilClosed = new Promise<void>(resolve => { release = resolve; });
    const page = { goto: async () => {}, unrouteAll: async () => untilClosed } as unknown as Page;
    const forwards = new AbortController();
    await closeHttp({ page, close: async () => { closed = true; release(); } }, forwards);
    assert.equal(closed, true);
    assert.equal(forwards.signal.aborted, true);
  });

  for (const viewport of VIEWPORTS) {
    it(`${viewport.name}：非安全来源打开配置、编辑索引器并挂载播放器`, { timeout: 60_000 }, async t => {
      let phase = '准备演示服务';
      const forwarding = forwardingState();
      t.after(() => {
        if (t.signal.aborted) t.diagnostic(`HTTP 配置用例超时阶段：${phase}；转发现场：${JSON.stringify(forwarding.snapshot())}`);
      });
      const service = requiredEnv('PEACH_E2E_ORIGIN');
      const origin = 'http://peach-http.test';
      const forwards = new AbortController();
      const opened = await visit(browser, '/', viewport, async page => {
        // 只将临时演示服务映射到普通 HTTP 来源；浏览器自行决定 Web Crypto 的可用性。
        // 跳转与关页会取消浏览器请求；独立转发请求由 closeHttp 在释放上下文前取消。
        await forwardHttp(page, origin, service, forwards.signal, forwarding);
      });
      const { page, problems } = opened;
      try {
        const response = await page.request.get(`${service}/api/configuration`);
        assert.equal(response.status(), 200);
        const configuration = await response.json();
        // 路由拦截只处理重定向的首个请求；别名契约在服务端读取，页面走正式入口。
        const alias = await page.request.get(`${service}/configuration`, { maxRedirects: 0 });
        assert.equal(alias.status(), 307);
        assert.equal(alias.headers().location, '/settings/library');
        await page.route(`${origin}/api/configuration`, route => route.fulfill({ json: { ...configuration, editable: true } }));
        const writes: { indexers: { key: string; name: string; url: string }[] }[] = [];
        await page.route(`${origin}/api/configuration/indexers`, route => {
          if (route.request().method() === 'GET') return route.fulfill({ json: { indexers: [], max_indexers: 4 } });
          const sent = route.request().postDataJSON();
          writes.push(sent);
          return route.fulfill({ json: { ...sent, max_indexers: 4 } });
        });
        page.on('response', response => {
          if (response.url().startsWith(origin) && response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
        });
        for (const path of ['/settings/library', '/settings/subscriptions']) {
          phase = `打开 ${path}`;
          await page.goto(origin + path, { waitUntil: 'load' });
          assert.deepEqual(await page.evaluate(() => ({
            secure: isSecureContext, uuid: typeof crypto.randomUUID, random: typeof crypto.getRandomValues,
          })), { secure: false, uuid: 'undefined', random: 'function' });
          phase = `等待 ${path} 配置主体`;
          await expectBody(page, path, configurationBody(page));
          await page.getByRole('tab', { name: '来源与订阅', exact: true }).click();
          const section = page.getByRole('form', { name: '资源搜索', exact: true });
          phase = `编辑 ${path} 索引器`;
          await section.getByRole('button', { name: '添加索引器', exact: true }).click();
          await section.getByRole('button', { name: '添加索引器', exact: true }).click();
          await section.getByRole('textbox', { name: /名称/ }).nth(1).fill('HTTP 测试');
          await section.getByRole('textbox', { name: /Torznab 地址/ }).nth(1).fill('https://indexer.example/api');
          await section.getByRole('button', { name: '移除索引器 1', exact: true }).click();
          phase = `保存 ${path} 索引器`;
          const saved = page.waitForResponse(response => response.url() === `${origin}/api/configuration/indexers`
            && response.request().method() === 'POST');
          await section.getByRole('button', { name: '保存配置', exact: true }).click();
          assert.equal((await saved).status(), 200);
          assert.equal(writes.at(-1)!.indexers.length, 1);
          assert.equal(writes.at(-1)!.indexers[0]!.name, 'HTTP 测试');
          phase = `等待 ${path} 保存后布局`;
          await settle(page, '.ui-configpage');
          const bounds = await layout(page);
          assert.ok(bounds.scrollWidth <= bounds.viewportWidth);
          assert.deepEqual(bounds.offenders, []);
        }
        phase = '打开播放器';
        await page.goto(`${origin}/assets/${requiredEnv('PEACH_E2E_ITEM')}`, { waitUntil: 'load' });
        phase = '等待播放器挂载';
        await page.locator('#stage .video-js video.vjs-tech').waitFor();
        assert.deepEqual(problems, []);
      } finally {
        await closeHttp(opened, forwards, value => { phase = value; });
      }
    });
  }
});
