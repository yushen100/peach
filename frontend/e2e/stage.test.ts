/* 舞台岛（`frontend/src/react/stage/`）在真浏览器里的行为：两种详情走同一个舞台、关掉回来处、深链、
 * 骨架揭示、Video.js 与它的控件（清晰度、剧场、提示、窄屏折叠、统计角标、右键菜单）、小窗（进出、
 * 展开不重建、拖动吸附）、队列换条时播放器的交接、Escape 先关最里层，以及手机 390。
 *
 * 桩数据见 `item-fixture.ts` 与 `follow-fixture.ts`；读写接口全部由桩接住，演示库数据库一次都不写。
 * 片源不给正片：小窗一律经 i 键或右键菜单请求进入（越过播放态判定），不靠真在放。 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Browser, Page } from 'playwright-core';

import { DETAIL, openFollowFeed } from './follow-fixture.ts';
import { layout, launch, stubTimelineSheets, VIEWPORTS } from './harness.ts';
import { ITEM, openItemPage } from './item-fixture.ts';

const DESKTOP = VIEWPORTS.find((viewport) => !viewport.mobile)!;
const MOBILE = VIEWPORTS.find((viewport) => viewport.mobile)!;
const ITEM_READY = '#stage[open] [data-item-side]';
const FOLLOW_READY = '#stage[open] [data-follow-detail-side]';
const PLAYER = '#stage .video-js .vjs-control-bar';
/** 桩里的片源没有正片，播放器拿到空响应会报一条 VIDEOJS 错误；量的不是它。 */
const withoutPlayer = (problems: string[]) => problems.filter((line) => !line.includes('VIDEOJS'));
const pathIs = (page: Page, path: string) => page.waitForFunction(
  (wanted) => location.pathname === wanted, path, { timeout: 10_000 });
const card = (id: number) => `#grid [data-media-card][data-id="${id}"] [data-media-title]`;

/** 舞台的宿主在 body 上常驻，宿主里只有一个 `<dialog id="stage">`。 */
const stageShape = (page: Page) => page.evaluate(() => {
  const stage = document.getElementById('stage');
  return {
    host: stage?.parentElement?.matches('body > [data-stage-host]') ?? false,
    modal: stage?.matches(':modal') ?? false,
    stages: document.querySelectorAll('dialog#stage').length,
    hosts: document.querySelectorAll('[data-stage-host]').length,
  };
});

/** 给舞台上此刻那个播放器做记号：之后找得到同一个记号，就是同一个实例。 */
const markPlayer = (page: Page, selector: string) => page.evaluate((scope) => {
  const player = document.querySelector<HTMLElement>(`${scope} .video-js`)!;
  player.dataset.probe = 'kept';
}, selector);

/** 进小窗：焦点在舞台里按 i，与 YouTube 同义。 */
async function toMiniplayer(page: Page): Promise<void> {
  await page.locator(PLAYER).waitFor({ state: 'attached' });
  await page.keyboard.press('i');
  await page.locator('#miniplayer:not([hidden]) .video-js').waitFor({ timeout: 10_000 });
  await page.locator('#stage[open]').waitFor({ state: 'detached', timeout: 10_000 });
}

describe('舞台岛', () => {
  let browser: Browser;

  before(async () => {
    browser = await launch();
  });

  after(async () => {
    await browser.close();
  });

  it('目录卡与关注卡走同一个舞台：宿主常驻 body，关掉回来处，列表不重取', { timeout: 90_000 }, async () => {
    const catalog = await openItemPage(browser, '/', DESKTOP, { ready: card(ITEM.plain) });
    try {
      const page = catalog.page;
      const listed = catalog.stub.reads.get('/api/items') || 0;
      await page.locator(card(ITEM.plain)).first().click();
      await page.locator(ITEM_READY).waitFor();
      assert.deepEqual(await stageShape(page), { host: true, modal: true, stages: 1, hosts: 1 });
      await page.evaluate(() => { (window as unknown as { stageHost: Element }).stageHost = document.querySelector('[data-stage-host]')! });
      await page.locator('#closeStage').click();
      await pathIs(page, '/');
      await page.locator('#stage').waitFor({ state: 'detached', timeout: 10_000 });
      await page.locator(card(ITEM.cast)).first().click();
      await page.locator(ITEM_READY).waitFor();
      assert.equal(await page.evaluate(() =>
        (window as unknown as { stageHost: Element }).stageHost === document.querySelector('[data-stage-host]')), true, '换一条之后舞台宿主换了一个');
      await page.locator('#closeStage').click();
      await pathIs(page, '/');
      assert.equal(catalog.stub.reads.get('/api/items') || 0, listed, '关掉详情回列表重取了一遍');
      assert.deepEqual(withoutPlayer(catalog.problems), []);
    } finally {
      await catalog.close();
    }
    const follow = await openFollowFeed(browser, '/follow', DESKTOP);
    try {
      const page = follow.page;
      let listed = 0;
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname === '/api/follow' && !url.searchParams.has('item')) listed += 1;
      });
      await page.locator('[data-follow-item="1002"] [data-follow-open]').click();
      await page.locator(FOLLOW_READY).waitFor();
      assert.deepEqual(await stageShape(page), { host: true, modal: true, stages: 1, hosts: 1 });
      await page.locator('[data-follow-related] [data-follow-item]').first().waitFor();
      const listedBeforeClose = listed;
      await page.locator('#closeStage').click();
      await pathIs(page, '/follow');
      await page.locator('[data-follow-list] > [data-follow-item]').first().waitFor();
      assert.equal(listed, listedBeforeClose, '关掉详情回关注列表重取了一遍');
      assert.deepEqual(withoutPlayer(follow.problems), []);
    } finally {
      await follow.close();
    }
  });

  it('点浮窗外面退出详情，回到来处；从浮窗里按下、拖到外面松手不算', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, '/', DESKTOP, { ready: card(ITEM.plain) });
    try {
      const page = opened.page;
      await page.locator(card(ITEM.plain)).first().click();
      await page.locator(ITEM_READY).waitFor();
      const box = (await page.locator('#stage').boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(4, 4, { steps: 4 });
      await page.mouse.up();
      assert.equal(await page.locator('#stage[open]').count(), 1, '从浮窗里拖出去松手也关了详情');
      await page.mouse.click(4, 4);
      await pathIs(page, '/');
      await page.locator('#stage').waitFor({ state: 'detached', timeout: 10_000 });
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('深链直接进两种详情：先画骨架再揭示，内容到了焦点给关闭键', { timeout: 60_000 }, async () => {
    const item = await openItemPage(browser, `/assets/${ITEM.plain}`, DESKTOP);
    try {
      assert.deepEqual(await stageShape(item.page), { host: true, modal: true, stages: 1, hosts: 1 });
      assert.equal(await item.page.evaluate(() => document.activeElement?.id), 'closeStage');
      assert.equal(await item.page.locator('#stage [data-skeleton]').count(), 0, '揭示完骨架还留着');
      assert.deepEqual(withoutPlayer(item.problems), []);
    } finally {
      await item.close();
    }
    const follow = await openFollowFeed(browser, `/posts/${DETAIL.collection}`, DESKTOP, { ready: FOLLOW_READY });
    try {
      assert.deepEqual(await stageShape(follow.page), { host: true, modal: true, stages: 1, hosts: 1 });
      assert.equal(await follow.page.evaluate(() => document.activeElement?.id), 'closeStage');
      assert.deepEqual(withoutPlayer(follow.problems), []);
    } finally {
      await follow.close();
    }
  });

  it('骨架揭示的那一段标题已经折成两行，不先铺满再收回', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, '/', DESKTOP, { ready: card(ITEM.plain) });
    try {
      const page = opened.page;
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      let release = () => {};
      const held = new Promise<void>((resolve) => { release = resolve });
      await page.route((url) => url.pathname === '/api/item', async (route) => { await held; await route.fallback() });
      // 长标题那一条不在目录里：深链进去，骨架由舞台岛画。
      await page.goto(new URL(`/assets/${ITEM.long}`, page.url()).toString(), { waitUntil: 'load' });
      await page.locator('#stage[open] [data-skeleton="detail"]').waitFor({ timeout: 15_000 });
      /* 揭示期间每一帧量一次标题行数，直到淡出层撤掉。 */
      const sampled = page.evaluate(() => new Promise<number[]>((resolve) => {
        const lines: number[] = [];
        const tick = () => {
          const title = document.querySelector<HTMLElement>('#stage [data-detail-title]');
          if (title) lines.push(Math.round(title.clientHeight / parseFloat(getComputedStyle(title).lineHeight)));
          if (title && !document.querySelector('#stage [data-stage-fade]')) { resolve(lines); return }
          requestAnimationFrame(tick);
        };
        tick();
      }));
      release();
      const lines = await sampled;
      assert.ok(lines.length > 0, '揭示期间没量到标题');
      assert.deepEqual([...new Set(lines)], [2], `揭示期间标题行数：${lines.join(',')}`);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('Video.js 挂上：清晰度键开设置面板，统计角标与它互斥，剧场键与 T 键切换，提示带快捷键', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, `/assets/${ITEM.plain}`, DESKTOP);
    try {
      const page = opened.page;
      await page.locator(PLAYER).waitFor({ state: 'attached' });
      assert.equal(await page.locator('#stage .vjs-time-tooltip').count(),0);
      assert.equal(await page.locator('#stage [data-player-time]').count(),1);
      assert.equal(await page.locator('#stage [data-player-seek-preview]').count(),1);
      const settings = page.locator('#stage .vjs-peach-settings-toggle');
      const stats = page.locator('#stage #playerStatsBtn');
      await stats.waitFor();
      await settings.dispatchEvent('click');
      assert.equal(await settings.getAttribute('aria-expanded'), 'true', '清晰度键没打开设置面板');
      await stats.click();
      assert.equal(await stats.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#stage #playerStats').isVisible(), true, '统计面板没打开');
      assert.equal(await settings.getAttribute('aria-expanded'), 'false', '开统计时设置面板没收起');
      await settings.dispatchEvent('click');
      assert.equal(await page.locator('#stage #playerStats').isHidden(), true, '开设置面板时统计没收起');
      await settings.dispatchEvent('click');

      const theater = page.locator('#stage [data-player-theater]');
      await theater.dispatchEvent('click');
      assert.equal(await page.locator('#stage[data-theater]').count(), 1, '剧场键没切到剧场模式');
      assert.equal(await theater.getAttribute('aria-pressed'), 'true');
      await page.locator('#closeStage').focus();
      await page.keyboard.press('t');
      assert.equal(await page.locator('#stage[data-theater]').count(), 0, 'T 键没切回来');
      assert.equal(await theater.getAttribute('aria-pressed'), 'false');

      for (const size of [{ width: 1074, height: 884 }, { width: 390, height: 844 }, { width: 1320, height: 1088 }]) {
        await page.setViewportSize(size);
        await page.waitForFunction(() => {
          const media = document.querySelector('#stage [data-stage-media]')?.getBoundingClientRect();
          const controls = document.querySelector('#stage .vjs-control-bar')?.getBoundingClientRect();
          const timeline = document.querySelector('#stage .vjs-progress-control')?.getBoundingClientRect();
          return media && controls && timeline && controls.bottom <= media.bottom + 1
            && timeline.top >= media.top - 1 && timeline.right <= media.right + 1;
        });
      }
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });

      /* 桩里的片源放不出来，Video.js 停在错误态、控件条不接指针，悬停量不到；只量提示的内容。 */
      const tip = page.locator('#stage [data-player-theater] > .vjs-peach-tooltip');
      assert.equal(await theater.getAttribute('title'), null, '原生 title 与自绘提示会叠在一起');
      assert.deepEqual(await tip.evaluate((node) => [node.querySelector('.vjs-peach-tooltip-text')?.textContent,
        node.querySelector('kbd')?.textContent]), ['影院模式', 'T']);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('进度条画面预览：按时刻取格、靠边整块留在进度条里、每页拼图只取一次；小窗与触屏拖动同一块', { timeout: 60_000 }, async () => {
    let requested = new Map<number, number>();
    const opened = await openItemPage(browser, `/assets/${ITEM.plain}`, DESKTOP);
    try {
      const page = opened.page;
      // 桩条目 3600 秒，10 秒一帧共 360 帧、4 张拼图。挂上之后再进详情，播放器挂载时取索引。
      requested = await stubTimelineSheets(page, { frames: 360, interval: 10 });
      await page.reload({ waitUntil: 'load' });
      await page.locator(PLAYER).waitFor({ state: 'attached' });
      /* 桩片源放不出来，控件条不接指针：指针事件直接派到进度条上，量的是接线与几何。 */
      const point = (scope: string, type: string, at: number, pointerType = 'mouse') => page.evaluate(
        ([selector, kind, ratio, pointer]) => {
          const bar = document.querySelector<HTMLElement>(selector)!, box = bar.getBoundingClientRect();
          bar.dispatchEvent(new PointerEvent(kind, { bubbles: true, pointerType: pointer, clientX: box.left + box.width * ratio, clientY: box.top + 2 }));
        }, [scope, type, at, pointerType] as const);
      const measure = (scope: string) => page.evaluate((selector) => {
        const bar = document.querySelector<HTMLElement>(selector)!, preview = bar.querySelector<HTMLElement>('[data-player-seek-preview]')!;
        const image = preview.querySelector('img'), box = bar.getBoundingClientRect(), shown = preview.getBoundingClientRect();
        const frame = preview.querySelector('.vjs-peach-seek-frame')?.getBoundingClientRect();
        return { hidden: preview.hidden, left: shown.left - box.left, right: box.right - shown.right, width: shown.width,
          time: preview.querySelector('span')!.textContent, src: image?.getAttribute('src') ?? '', offset: image?.style.top ?? '',
          scale: image && frame?.width ? image.getBoundingClientRect().width / frame.width : 0,
          transition: getComputedStyle(preview).transitionDuration };
      }, scope);
      const progress = '#stage .vjs-progress-control';
      await point(progress, 'pointermove', .5);
      await page.waitForFunction(() => document.querySelector<HTMLImageElement>('#stage [data-player-seek-preview] img')?.complete);
      const middle = await measure(progress);
      assert.equal(middle.hidden, false);
      assert.equal(middle.time, '30:00');
      assert.equal(middle.src, `/timeline?id=${ITEM.plain}&s=1&source=peach`, '30 分钟是第 180 帧，落在第 2 张拼图');
      assert.equal(middle.offset, '-800%', '第 180 帧是第 2 张的第 80 格，第 9 行');
      assert.ok(Math.abs(middle.scale - 10) < .3, `拼图要放大到取景框的 10 倍才能只露一格：${middle.scale}`);
      assert.equal(middle.transition, '0s', '减少动态效果时预览不做位移动画');
      for (const at of [0, .01, .99, 1]) {
        await point(progress, 'pointermove', at);
        const edge = await measure(progress);
        assert.ok(edge.left >= -0.5 && edge.right >= -0.5, `靠边被裁：${JSON.stringify({ at, ...edge })}`);
      }
      for (let at = 0; at <= 1; at += .05) await point(progress, 'pointermove', at);
      assert.deepEqual([...requested.entries()].sort(), [[0, 1], [1, 1], [2, 1], [3, 1]], '拼图预热一次后不该随指针重取');
      await point(progress, 'pointerleave', 1);
      assert.equal((await measure(progress)).hidden, true);

      await toMiniplayer(page);
      const mini = '#miniplayer .vjs-progress-control';
      await point(mini, 'pointermove', .02);
      const inMini = await page.evaluate(() => {
        const frame = document.querySelector('[data-miniplayer-frame]')!.getBoundingClientRect();
        const preview = document.querySelector<HTMLElement>('#miniplayer [data-player-seek-preview]')!;
        const box = preview.getBoundingClientRect();
        const clock = document.querySelector('#miniplayer [data-miniplayer-time]');
        return { hidden: preview.hidden, display: getComputedStyle(preview).display,
          inside: box.left >= frame.left - .5 && box.right <= frame.right + .5 && box.top >= frame.top - .5, width: box.width,
          clock: clock ? getComputedStyle(clock).visibility : 'hidden' };
      });
      assert.deepEqual(inMini, { hidden: false, display: 'flex', inside: true, width: inMini.width, clock: 'hidden' }, JSON.stringify(inMini));
      assert.ok(inMini.width <= 170, `小窗里的预览没收到窄档：${inMini.width}`);

      await point(mini, 'pointerdown', .75, 'touch');
      assert.equal((await measure(mini)).time, '45:00');
      await point(mini, 'pointermove', .8, 'touch');
      assert.equal((await measure(mini)).time, '48:00');
      await point(mini, 'pointerup', .8, 'touch');
      assert.equal((await measure(mini)).hidden, true, '触屏抬手预览没收起');
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('右键菜单逐项：Escape 只关菜单；「迷你播放器」进小窗，小窗里的菜单换成「展开」', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, `/assets/${ITEM.plain}`, DESKTOP);
    try {
      const page = opened.page;
      await page.locator('#stage #playerStatsBtn').waitFor();
      const labels = () => page.locator('#playerMenu [data-player-menu] span').allInnerTexts();
      await page.locator('#stage .video-js').click({ button: 'right' });
      await page.locator('#stage #playerMenu:popover-open').waitFor();
      assert.deepEqual((await labels()).filter((label) => label !== '画中画'),
        ['循环播放', '迷你播放器', '复制视频网址', '复制当前时间的视频网址', '播放统计']);
      await page.keyboard.press('Escape');
      await page.locator('#playerMenu:popover-open').waitFor({ state: 'detached' }).catch(() => {});
      assert.equal(await page.locator('#playerMenu:popover-open').count(), 0, 'Escape 没关掉菜单');
      assert.equal(await page.locator('#stage[open]').count(), 1, 'Escape 连舞台一起关了');

      await page.locator('#stage .video-js').click({ button: 'right' });
      await page.locator('#playerMenu [data-player-menu]', { hasText: '迷你播放器' }).click();
      await page.locator('#miniplayer:not([hidden]) .video-js').waitFor({ timeout: 10_000 });
      await pathIs(page, '/');
      /* 小窗的按键层盖在画面上，右键直接派给播放器。 */
      await page.locator('#miniplayer .video-js').dispatchEvent('contextmenu', { clientX: 1000, clientY: 600 });
      await page.locator('#playerMenu:popover-open').waitFor();
      const mini = (await labels()).filter((label) => label !== '画中画');
      assert.deepEqual(mini, ['循环播放', '展开', '复制视频网址', '复制当前时间的视频网址'], '小窗里的菜单不对');
      await page.keyboard.press('Escape');
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('小窗展开回详情不重建播放器；拖到左上象限松手吸附到左上角', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, `/assets/${ITEM.plain}`, DESKTOP);
    try {
      const page = opened.page;
      await page.locator(PLAYER).waitFor({ state: 'attached' });
      await markPlayer(page, '#stage');
      await toMiniplayer(page);
      await pathIs(page, '/');
      assert.equal(await page.locator('#miniplayer .video-js[data-probe="kept"]').count(), 1, '进小窗换了一个播放器');
      assert.equal(await page.locator('#miniplayer').getAttribute('data-corner'), 'br');

      const info = await page.locator('#miniplayerInfo').boundingBox();
      assert.ok(info);
      await page.mouse.move(info.x + info.width / 2, info.y + info.height / 2);
      await page.mouse.down();
      await page.mouse.move(info.x - 200, info.y - 200, { steps: 6 });
      await page.mouse.move(120, 160, { steps: 6 });
      await page.mouse.up();
      await page.waitForFunction(() => document.getElementById('miniplayer')?.dataset.corner === 'tl', null, { timeout: 5_000 });
      assert.equal(await page.locator('#miniplayer').evaluate((node) => (node as HTMLElement).style.transform), '');
      await pathIs(page, '/');
      assert.equal(await page.locator('#stage[open]').count(), 0, '拖完松手那一下被当成了「展开」');

      // 小窗上的键只在指针落在小窗上时浮出来。
      let releaseRefresh = () => {};
      const refreshed = new Promise<void>(resolve => { releaseRefresh = resolve });
      await page.route(/\/api\/item\?id=11$/, async route => { await refreshed; await route.continue() });
      await page.locator('#miniplayerCard').hover();
      await page.locator('#miniplayerExpand').click();
      await pathIs(page, `/assets/${ITEM.plain}`);
      try {
        await page.locator(ITEM_READY).waitFor({ timeout: 3000 });
        assert.equal(await page.locator('#stage [data-skeleton="detail"]').count(), 0, '展开已加载的详情不该退回骨架');
      } finally { releaseRefresh() }
      await page.locator('#stage [data-item-media="video"] > .video-js[data-probe="kept"]').waitFor({ state: 'attached' });
      assert.equal(await page.locator('.video-js').count(), 1, '展开之后多出一个播放器');
      assert.equal(await page.locator('#miniplayer').isHidden(), true, '展开之后小窗还露着');
      assert.equal(await page.locator('#stage #playerStatsBtn').count(), 1);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('队列换条：旧播放器先拆，新播放器才挂，同一时刻只有一个', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, `/assets/${ITEM.plain}?mix=${ITEM.plain}`, DESKTOP);
    try {
      const page = opened.page;
      await page.locator(PLAYER).waitFor({ state: 'attached' });
      await markPlayer(page, '#stage');
      await page.evaluate(() => {
        const log = { live: document.querySelectorAll('div.video-js').length, most: 0, order: [] as string[] };
        const players = (nodes: NodeList) => [...nodes].filter((node): node is HTMLElement =>
          node instanceof HTMLElement && node.matches('div.video-js')).length;
        new MutationObserver((records) => {
          for (const record of records) {
            const gone = players(record.removedNodes), added = players(record.addedNodes);
            if (gone) { log.live -= gone; log.order.push('拆') }
            if (added) { log.live += added; log.order.push('挂') }
            log.most = Math.max(log.most, log.live);
          }
        }).observe(document.body, { childList: true, subtree: true });
        (window as unknown as { playerLog: typeof log }).playerLog = log;
      });
      const next = await page.locator('#stage [data-queue-item]:not([aria-current="true"])').first().getAttribute('data-queue-item');
      await page.locator(`#stage [data-queue-item="${next}"]`).click();
      await page.locator(`#stage [data-queue-item="${next}"][aria-current="true"]`).waitFor();
      await page.locator(PLAYER).waitFor({ state: 'attached' });
      const log = await page.evaluate(() => (window as unknown as { playerLog: { live: number; most: number; order: string[] } }).playerLog);
      assert.equal(log.most, 1, `换条时同时挂着 ${log.most} 个播放器`);
      assert.deepEqual(log.order.slice(0, 2), ['拆', '挂']);
      assert.equal(await page.locator('.video-js[data-probe="kept"]').count(), 0, '换条之后还是上一条的播放器');
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('编辑框的标签搜索框里按 Escape 只收起选择器；再按一下关编辑框，舞台始终留着', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, `/assets/${ITEM.plain}`, DESKTOP);
    try {
      const page = opened.page;
      const editor = page.locator('dialog[data-item-edit-dialog]');
      await page.locator('#stage [data-item-edit-open]').click();
      await editor.waitFor();
      await editor.locator('#tagPlus').click();
      await editor.locator('#tagPicker:not([hidden])').waitFor();
      await editor.locator('#tagPickSearch').focus();
      await page.keyboard.press('Escape');
      await editor.locator('#tagPicker').waitFor({ state: 'hidden' });
      assert.equal(await editor.count(), 1, 'Escape 连编辑框一起关了');
      await page.keyboard.press('Escape');
      await editor.waitFor({ state: 'detached' });
      assert.equal(await page.locator('#stage[open]').count(), 1, 'Escape 关编辑框时把舞台也关了');
      assert.equal(await page.evaluate(() => location.pathname), `/assets/${ITEM.plain}`);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('关注详情：/follow-qualities 挂住时视频照挂，海报挂载前后是同一张，统计键在同一个媒体框里', { timeout: 60_000 }, async () => {
    const opened = await openFollowFeed(browser, `/posts/${DETAIL.collection}`, DESKTOP, { ready: FOLLOW_READY });
    try {
      const page = opened.page;
      const frame = page.locator('#stage [data-follow-detail-media="video"]');
      await frame.locator('.video-js .vjs-control-bar').waitFor({ state: 'attached' });
      await frame.locator(':scope > #playerStatsBtn').waitFor();
      const poster = () => frame.locator('video.vjs-tech').getAttribute('poster');
      assert.match(await poster() || '', /\/stub-thumb\/5101$/, 'Video.js 挂上之后海报丢了');

      await page.route('**/follow-qualities**', () => {});
      await page.locator('[data-follow-queue-item="5102"]').click();
      await pathIs(page, '/posts/5102');
      await frame.locator('.video-js .vjs-control-bar').waitFor({ state: 'attached', timeout: 10_000 });
      assert.equal(await page.locator('#stage .video-js').count(), 1);
      assert.match(await poster() || '', /\/stub-thumb\/5102$/);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });

  it('手机 390：详情不横向溢出，播放器控件收成窄屏那一套；小窗落在视口里', { timeout: 60_000 }, async () => {
    const opened = await openItemPage(browser, `/assets/${ITEM.plain}`, MOBILE);
    try {
      const page = opened.page;
      await page.locator(PLAYER).waitFor({ state: 'attached' });
      await page.waitForFunction(() => document.querySelector('#stage .video-js')?.classList.contains('vjs-peach-xsmall'),
        null, { timeout: 5_000 });
      const measured = await layout(page);
      assert.equal(measured.scrollWidth, measured.viewportWidth, `横向溢出：${measured.offenders.join(', ')}`);
      await toMiniplayer(page);
      const box = await page.locator('#miniplayerCard').boundingBox();
      assert.ok(box);
      assert.ok(box.x >= 0 && box.x + box.width <= MOBILE.width, `小窗越出视口：${JSON.stringify(box)}`);
      assert.ok(box.y >= 0 && box.y + box.height <= MOBILE.height, `小窗越出视口：${JSON.stringify(box)}`);
      assert.deepEqual(withoutPlayer(opened.problems), []);
    } finally {
      await opened.close();
    }
  });
});
