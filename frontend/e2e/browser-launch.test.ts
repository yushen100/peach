/* 真实浏览器启动契约：隔离 E2E 沿用 Playwright 默认禁用特性，其中必须含 Windows 回环规避项。 */
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium, type Browser } from 'playwright-core';
import { launch, requiredEnv, visit, VIEWPORTS } from './harness.ts';

async function disabledFeatures(browser: Browser): Promise<Set<string>> {
  const session = await browser.newBrowserCDPSession();
  try {
    const { arguments: args } = await session.send('Browser.getBrowserCommandLine');
    const value = args.filter(arg => arg.startsWith('--disable-features=')).at(-1);
    assert.ok(value, 'Chrome 必须公开实际启动的禁用特性');
    return new Set(value.slice('--disable-features='.length).replaceAll('"', '').split(','));
  } finally { await session.detach(); }
}

it('隔离 E2E 浏览器保留 Playwright 的全部默认禁用特性，其中包含回环网络规避', async t => {
  // 只为本用例开启启动参数的只读协议观测，两个真实浏览器使用同一观测参数。
  const launchChromium = chromium.launch.bind(chromium);
  t.mock.method(chromium, 'launch', (options: Parameters<typeof chromium.launch>[0] = {}) =>
    launchChromium({ ...options, args: [...(options.args ?? []), '--enable-automation'] }));
  const baseline = await chromium.launch({ headless: true, executablePath: requiredEnv('PEACH_E2E_CHROME') });
  let expected: Set<string>;
  try { expected = await disabledFeatures(baseline); }
  finally { await baseline.close(); }
  assert.ok(expected.has('TcpPortRandomizationWin'), 'Playwright 默认参数必须规避 Chromium 572515601');
  const browser = await launch();
  try { assert.deepEqual(await disabledFeatures(browser), expected); }
  finally { await browser.close(); }
});

it('撤除页面桩期间的新请求仍被关闭流程中止', async t => {
  const browser = await launch();
  try {
    const opened = await visit(browser, '/healthz', VIEWPORTS[0]!, async page => {
      await page.route('**/healthz?close-probe=1', route => route.fulfill({ json: { ok: true } }));
    });
    const page = opened.page;
    const unrouteAll = page.unrouteAll.bind(page);
    let blocked = false;
    t.mock.method(page, 'unrouteAll', async (options: Parameters<typeof page.unrouteAll>[0]) => {
      await unrouteAll(options);
      blocked = await page.evaluate(async () => {
        try {
          await fetch('/healthz?close-probe=1');
          return false;
        } catch { return true; }
      });
    });
    await opened.close();
    assert.equal(blocked, true, '撤桩和关闭上下文之间的请求必须被拦截');
  } finally { await browser.close(); }
});
