/* 真浏览器冒烟的夹具：打开页面、收集运行期问题、测布局几何。
 *
 * 只用 playwright-core 驱动本机已装的 Chrome，不下载浏览器；路径由
 * `tests/test_web_e2e.py` 探测后经 PEACH_E2E_CHROME 传进来。服务、数据库和演示库
 * 也归 Python 那一侧准备，这里只认 PEACH_E2E_ORIGIN。
 *
 * 用例只写语义断言（没有横向溢出、等待态会结束、控制台无错误），不做截图比对：
 * 单人部署里维护基线图的成本高于它能拦住的问题。 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright-core';

export interface Viewport {
  name: string;
  width: number;
  height: number;
  mobile: boolean;
}

export const VIEWPORTS: readonly Viewport[] = [
  { name: 'desktop', width: 1280, height: 800, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

export interface Visit {
  page: Page;
  /** 页面异常、console.error、同源 4xx/5xx 与失败请求，按发生顺序。 */
  problems: string[];
  close(): Promise<void>;
}

export interface Layout {
  viewportWidth: number;
  scrollWidth: number;
  /** 右边缘越出视口、且没有被任何祖先横向裁切的可见元素，最多列 5 个。 */
  offenders: string[];
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 未设置：用 \`tests/test_web_e2e.py\` 起服务后再跑`);
  return value;
}

export async function launch(): Promise<Browser> {
  // 界面语言默认跟浏览器语言走（ADR-0156）；用例断言的是中文文案，浏览器语言固定成简体中文，CI 上的 en-US 不影响结果。
  // Chromium 572515601 的回环随机端口缺陷（WSAENOBUFS 10055）由 Playwright 默认禁用的
  // `TcpPortRandomizationWin` 规避；这里不另传 --disable-features，否则会整串覆盖默认值。
  const args: string[] = ['--lang=zh-CN'];
  const networkLogs = process.env.PEACH_E2E_NET_LOG_DIR;
  if (networkLogs) {
    mkdirSync(networkLogs, { recursive: true });
    const filename = `network-${process.pid}-${randomUUID()}.json`;
    args.push(`--log-net-log=${join(networkLogs, filename)}`, '--net-log-capture-mode=HeavilyRedacted');
    console.info(`浏览器网络事件日志：${filename}`);
  }
  return chromium.launch({
    headless: true,
    executablePath: requiredEnv('PEACH_E2E_CHROME'),
    args,
    // Windows 首次加载浏览器与系统组件使用独立的启动预算，页面等待由各用例限定。
    timeout: 60_000,
  });
}

/** 失败时保留焦点、输入和弹层现场；成功路径不额外查询页面。 */
export async function withPageDiagnostics<T>(page: Page, where: string | (() => string), action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const state = await page.evaluate(() => ({
      path: location.pathname + location.search,
      ready: document.readyState,
      focus: document.activeElement?.outerHTML.slice(0, 600),
      query: document.querySelector<HTMLInputElement>('#q')?.value,
      layers: [...document.querySelectorAll('dialog,[role="dialog"],#searchMenu')].slice(0, 12).map(node => ({
        tag: node.tagName, id: node.id, hidden: (node as HTMLElement).hidden,
        expanded: node.getAttribute('aria-expanded'), text: node.textContent?.slice(0, 600),
      })),
      busy: [...document.querySelectorAll('[aria-busy="true"],[data-skeleton]')]
        .filter(node => !node.closest('[data-content-skeleton][aria-hidden="true"]'))
        .slice(0, 12).map(node => ({ tag: node.tagName, id: node.id, label: node.getAttribute('aria-label') })),
    })).catch(() => '未取得');
    const tree = await page.locator('body').ariaSnapshot({ timeout: 2000 }).catch(() => '未取得');
    throw new Error(`${typeof where === 'function' ? where() : where}：${String(error)}\n页面现场：${JSON.stringify(state)}\n无障碍树：\n${tree.slice(0, 4000)}`,
      { cause: error });
  }
}

/** 等待态以 `aria-busy="true"` 与 `data-skeleton` 为准；超时就是等待态卡住了。
 * 两个标记由页面自己写：island、遗留模板和 React 子树都得发出，这里才等得到。
 *
 * 它只证明「没有东西在等」，证明不了页面画出来了：主体完全没渲染时同样立刻成立。
 * 所以调用方先等到目标页面自己的主体出现，再调它。
 *
 * `except` 是用例自己压住、永远不会结束的那一处等待（例如故意不回的下一页），按选择器排除。 */
export async function settle(page: Page, scope = 'body', { except = '' }: { except?: string } = {}): Promise<void> {
  /* 活动页和馆藏页会持续轮询任务状态，本来就不保证进入 `networkidle`。页面导航由
     `visit()` 等到 load，主体由调用方的 `expectBody()` 验证；这里只等 Peach 自己公开的
     等待态结束。 */
  try {
    await page.waitForFunction(
      ({ selector, except }) => {
        const root = document.querySelector(selector);
        const waiting = (node: Element) => node.matches('[aria-busy="true"],[data-skeleton]')
          && !node.closest('[data-content-skeleton][aria-hidden="true"]') && !(except && node.matches(except));
        return !!root && !waiting(root) && ![...root.querySelectorAll('[aria-busy="true"],[data-skeleton]')].some(waiting);
      },
      { selector: scope, except }, { timeout: 15_000 });
  } catch (error) {
    const pending = await page.evaluate(({ selector, except }) => {
      const root = document.querySelector(selector);
      if (!root) return { missing_scope: selector };
      const waiting = (node: Element) => node.matches('[aria-busy="true"],[data-skeleton]')
        && !node.closest('[data-content-skeleton][aria-hidden="true"]') && !(except && node.matches(except));
      const nodes = [...root.querySelectorAll('[aria-busy="true"],[data-skeleton]')].filter(waiting);
      if (waiting(root)) nodes.unshift(root);
      return nodes.slice(0, 12).map(node => {
        const box = node.getBoundingClientRect();
        return { tag: node.tagName, id: node.id, skeleton: node.getAttribute('data-skeleton'),
          label: node.getAttribute('aria-label'), scope: node.closest('dialog')?.id || 'page',
          width: box.width, height: box.height };
      });
    }, { selector: scope, except }).catch(() => '未取得');
    throw new Error(`页面等待态未结束：${JSON.stringify(pending)}\n${(error as Error).message}`);
  }
}

/** 等目标页面自己的主体出现：每个定位器都要可见，之后才轮到 `settle`。
 * 等不到就带上此刻 `#main` 的无障碍树失败：CI 上只有这段输出，看得出停在骨架、
 * 空态换了文案还是整块没画。 */
export async function expectBody(page: Page, where: string, body: readonly Locator[], problems: readonly string[] = []): Promise<void> {
  for (const locator of body) {
    try {
      await locator.waitFor({ state: 'visible', timeout: 15_000 });
    } catch (error) {
      const snapshot = await page.locator('#main').ariaSnapshot({ timeout: 5_000 }).catch(() => '未取得');
      assert.fail(`${where}：页面主体没有出现，等不到 ${locator}\n${(error as Error).message}\n`
        + `页面：${page.url()}；已关闭：${page.isClosed()}；运行期问题：${JSON.stringify(problems)}\n`
        + `#main 当时的无障碍树：\n${snapshot.slice(0, 3000)}`);
    }
  }
}

/** Peach 配置页的主体：标题与默认的媒体库分区。 */
export function configurationBody(page: Page): Locator[] {
  return [
    page.locator('#main').getByRole('heading', { name: 'Peach 配置', exact: true }),
    page.locator('#stats').getByRole('tab', { name: '媒体库与入库' }),
  ];
}

export async function visit(browser: Browser, path: string, viewport: Viewport,
  prepare?: (page: Page) => Promise<void>): Promise<Visit> {
  const origin = requiredEnv('PEACH_E2E_ORIGIN');
  const context: BrowserContext = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    reducedMotion: 'reduce',
  });
  // 详情页默认自动播放；这台机器旁边有人，冒烟不出声。
  await context.addInitScript(() => {
    localStorage.setItem('peach.settings.v1', JSON.stringify({ detailAutoplay: false }));
  });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400) {
      problems.push(`${response.status()} ${response.url().slice(origin.length)}`);
    }
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? '';
    if (request.url().startsWith(origin) && !reason.includes('ERR_ABORTED')) {
      problems.push(`failed ${request.url().slice(origin.length)} ${reason}`);
    }
  });
  /* 桩回调里的 `route.fetch`、`route.continue` 可能在关上下文时还没返回，之后会以
   * 「Request context disposed」失败；没人等它，就成了整个文件的 unhandledRejection。
   * 先在上下文安装中止规则，再用 `ignoreErrors` 撤掉页面桩，让在途回调的关闭错误静默返回。
   * 上下文规则覆盖撤桩到关闭之间的新请求，避免来源接口落到真实服务上。 */
  const close = async () => {
    if (!page.isClosed()) {
      await context.route('**/*', (route) => route.abort().catch(() => {}));
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
    await context.close();
  };
  // 只打开到 load：等哪块主体、何时 settle 由用例决定，见 `settle` 的说明。
  try {
    await prepare?.(page);
    await page.goto(origin + path, { waitUntil: 'load' });
  } catch (error) {
    await close();
    throw error;
  }
  return { page, problems, close };
}

/** 时间轴预览的桩：`/api/timeline` 回固定间隔的自有接触印相，`/timeline` 回合成的 10×10 拼图，
 *  每格写「页-格」序号，截图里看得出取的是哪一格。返回每页被请求的次数。 */
export async function stubTimelineSheets(page: Page, { frames, interval }: { frames: number; interval: number }) {
  const requested = new Map<number, number>();
  await page.route((url) => url.pathname === '/api/timeline', (route) => route.fulfill({
    json: { source: 'peach', frames, interval, sheets: Math.ceil(frames / 100), columns: 10, rows: 10, frame_width: 160 },
  }));
  await page.route((url) => url.pathname === '/timeline', (route) => {
    const sheet = Number(new URL(route.request().url()).searchParams.get('s'));
    requested.set(sheet, (requested.get(sheet) ?? 0) + 1);
    const count = Math.min(100, frames - sheet * 100), rows = Math.ceil(count / 10);
    const cells = Array.from({ length: count }, (_, slot) => {
      const x = slot % 10 * 160, y = Math.floor(slot / 10) * 90;
      return `<rect x="${x}" y="${y}" width="160" height="90" fill="hsl(${(sheet * 100 + slot) * 7 % 360} 40% 35%)"/>`
        + `<text x="${x + 80}" y="${y + 58}" font-size="36" font-family="sans-serif" fill="#fff" text-anchor="middle">${sheet}-${slot}</text>`;
    }).join('');
    return route.fulfill({ contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${rows * 90}">${cells}</svg>` });
  });
  return requested;
}

/* 越界名单只报根因：页面一旦被撑宽，移动视口跟着变宽，`fixed` 的顶栏、Toast 会一起
 * 伸出去，按文档顺序截前几个就只剩这些症状。所以跳过 `fixed` 及其后代，并且只留
 * 父元素自己没越界的那一层。 */
/** 检查实际可滚动的区域是否由统一滑块或横向手势接管。 */
export async function unmanagedScrollers(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].flatMap(node => {
    if (!(node instanceof HTMLElement) || node.closest('.ovtrack,.ui-ov-edges,[data-skeleton],[inert]')) return [];
    const style = getComputedStyle(node), box = node.getBoundingClientRect();
    if (!box.width || !box.height || style.visibility === 'hidden' || style.display === 'none') return [];
    const vertical = /^(auto|scroll)$/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    const horizontal = /^(auto|scroll)$/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
    if (!vertical && !horizontal) return [];
    if (node.hasAttribute('data-overlay-scrollbar')) return [];
    if (!vertical && (node.hasAttribute('data-horizontal-scroll') || node.hasAttribute('data-scroll-gesture'))) return [];
    return [`${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}.${String(node.className).slice(0, 120)}`];
  }));
}

export async function layout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const excused = (element: Element): boolean => {
      if (getComputedStyle(element).position === 'fixed') return true;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.overflowX !== 'visible' || style.position === 'fixed') return true;
      }
      return false;
    };
    const label = (element: Element): string => {
      const id = element.id ? `#${element.id}` : '';
      const classes = [...element.classList].slice(0, 2).map((name) => `.${name}`).join('');
      return `${element.tagName.toLowerCase()}${id}${classes}`;
    };
    const overflowing = new Set<Element>();
    for (const element of document.body.querySelectorAll('*')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.right <= width + 1) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none' || excused(element)) continue;
      overflowing.add(element);
    }
    const offenders = [...overflowing]
      .filter((element) => !element.parentElement || !overflowing.has(element.parentElement))
      .slice(0, 5)
      .map((element) => `${label(element)} right=${Math.round(element.getBoundingClientRect().right)}`);
    return {
      viewportWidth: width,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      offenders,
    };
  });
}
