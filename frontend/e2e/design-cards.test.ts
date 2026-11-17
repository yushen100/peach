/* 设计决定：作品卡、管理页与复核。读 `getComputedStyle` 断言用户定过的外观；共用的桩与浏览器生命周期在 `design-fixture.ts`。 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Browser, Locator, Page } from 'playwright-core';
import { expectBody, settle, visit } from './harness.ts';
import {
  DESKTOP, MOBILE, tokenColor, openReview, REVIEW_ROW, lightness, WIDE, JUNK_COUNT, openJunk, junkItem, openJunkWith,
  openCatalog, openCatalogFixture, openFollowManage, stubFollowManage, holdApi, controlFaces, disabledTokens,
  waitingActionFaces, assertDisabledFace, installDesignBrowser, PIXEL,
} from './design-fixture.ts';

/** 每个视口从未阅读的进度开始；账本跨设备持久化由 API 回归验证。 */
async function freshTutorial(page: Page) {
  const state = { version: 1, campaign: 'browser-tutorial', invited: false, completed: false,
    chapters: {} as Record<string, { next: number; read: string[]; skipped: string[] }> };
  await page.route('**/api/tutorial-progress', async route => {
    if (route.request().method() === 'POST') {
      const action = route.request().postDataJSON();
      if (action.action === 'dismiss') state.invited = true;
      else if (action.action === 'complete' || action.action === 'reopen') {
        state.invited = true;
        state.completed = action.action === 'complete';
      } else {
        const row = state.chapters[action.chapter] ??= { next: 0, read: [], skipped: [] };
        row.next = action.next;
        if (action.action === 'step') {
          row.read = row.read.filter(step => step !== action.step);
          row.skipped = row.skipped.filter(step => step !== action.step);
          row[action.skipped ? 'skipped' : 'read'].push(action.step);
        }
      }
    }
    await route.fulfill({ json: state });
  });
}

// 监视器只保留框架异步收尾异常的调用栈，错误仍由 Node 判为失败。
process.on('uncaughtExceptionMonitor', error => console.error(error.stack));

describe('设计决定：作品卡、管理页与复核', () => {
  let browser: Browser;
  installDesignBrowser((next) => { browser = next; });

  /* 骨架是列表回来之前那一屏的形状预告：JAV 默认大图，卡片是 3:4 的正封，骨架照 16:9
     铺的话，内容一到整屏卡片都被拉高一截。把列表请求扣住，只看骨架本身。 */
  it('作品骨架的封面比例跟当前版式走：JAV 大图 3:4，首页小图 16:9', { timeout: 60_000 }, async () => {
    const opened = await visit(browser, '/', DESKTOP);
    const { page } = opened;
    await page.route(/\/api\/items\?/, () => {});
    /* 骨架挂上的那一帧可能还没排版（宽高都是 0），量出来是 NaN。等它有了尺寸、且连续两帧
       比例不变再读：量的是这一屏落定后的形状，不是插进 DOM 的那一瞬。 */
    const skeletonRatio = async (path: string) => {
      await page.goto(new URL(path, page.url()).href, { waitUntil: 'load' });
      const handle = await page.waitForFunction(() => {
        const cover = document.querySelector('#grid .catalog-skeleton .skeletoncard i');
        const box = cover?.getBoundingClientRect();
        if (!box || !box.width || !box.height) return false;
        const ratio = box.width / box.height;
        const holder = window as unknown as { skeletonRatioSeen?: number };
        const settled = holder.skeletonRatioSeen === ratio;
        holder.skeletonRatioSeen = ratio;
        return settled && ratio;
      }, undefined, { polling: 'raf', timeout: 15_000 });
      return Number(await handle.jsonValue());
    };
    try {
      assert.ok(Math.abs(await skeletonRatio('/?jav=1') - 0.75) < 0.05, 'JAV 大图下骨架封面不是正封比例');
      assert.ok(Math.abs(await skeletonRatio('/') - 16 / 9) < 0.05, '首页小图下骨架封面不是 16:9');
    } finally {
      await opened.close();
    }
  });

  it('卡片悬停反馈不在封面像素上描边', { timeout: 60_000 }, async () => {
    const opened = await openCatalog(browser);
    try {
      const card = opened.page.locator('#grid [data-media-card]').first();
      const picture = card.locator('[data-media-pic]');
      await card.hover();
      const overlay = await picture.evaluate((element) => {
        const style = getComputedStyle(element, '::after');
        return { content: style.content, borderWidth: style.borderTopWidth };
      });
      assert.equal(overlay.content, 'none', '悬停伪元素仍覆盖在封面像素上');
      assert.equal(overlay.borderWidth, '0px', '悬停边线仍污染圆角边缘像素');
      assert.match(await card.evaluate((element) => getComputedStyle(element).boxShadow),
        /0px 0px 0px 8px/, '悬停底色没有在卡片四周向外多铺 8px');
      assert.equal(await card.locator('[data-media-later]').evaluate(
        (element) => getComputedStyle(element).opacity), '1', '移除描边后没有保留悬停反馈');
    } finally {
      await opened.close();
    }
  });

  it('长悬浮主控在窄卡同步缩小，两颗角落按钮保持同档且不覆盖主控', { timeout: 60_000 }, async () => {
    const opened = await openCatalog(browser);
    try {
      const card = opened.page.locator('#grid [data-media-card]:has([data-media-seek])').first();
      for (const [width, main, corner] of [[470, 58, 36], [200, 36, 30]]) {
        await card.evaluate((node, size) => {
          const element = node as HTMLElement;
          element.style.width = `${size}px`;
          element.style.minWidth = `${size}px`;
          element.style.maxWidth = `${size}px`;
          element.dataset.longhover = '';
        }, width!);
        await opened.page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const geometry = await card.evaluate(node => {
          const primary = [...node.querySelectorAll('[data-media-seek] button')];
          const corners = [...node.querySelectorAll('[data-media-preview], [data-media-later] button')];
          const sizes = (nodes: Element[]) => nodes.map(button => {
            const style = getComputedStyle(button);
            return [parseFloat(style.width), parseFloat(style.height)];
          });
          const overlaps = corners.some(corner => primary.some(button => {
            const a = corner.getBoundingClientRect(), b = button.getBoundingClientRect();
            return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          }));
          return { primary: sizes(primary), corners: sizes(corners), overlaps };
        });
        assert.deepEqual(geometry.primary, Array.from({ length: 3 }, () => [main, main]));
        assert.deepEqual(geometry.corners, [[corner, corner], [corner, corner]]);
        assert.equal(geometry.overlaps, false, JSON.stringify({ width, geometry }));
      }
    } finally { await opened.close() }
  });

  it('馆藏卡片的字取页面正文那一档，角标、悬停控件、进度条、竖屏带、Mix 与回收站卡面按定下的样子画', { timeout: 90_000 }, async () => {
    /* 演示库凑不出回收站里的非视频资源：回收站那一页把第二条换成一个压缩包。
       目录那一页给前三条挂半程观看进度，量进度条的颜色。 */
    const opened = await openCatalogFixture(browser, (payload, url) => {
      if (url.searchParams.get('state') !== 'trash') {
        if (!url.searchParams.has('orient')) assert.ok(payload.items.length >= 8, 'Mix 外观夹具至少提供八张作品');
        for (const item of payload.items.slice(0, 3)) Object.assign(item, { duration: 600, play_seconds: 300 });
        return;
      }
      const item = payload.items[1];
      if (!item) throw new Error('演示目录不够两条');
      Object.assign(item, { medium: 'archive', name: '演示资料.zip', disposal: 'trash' });
      Object.assign(payload.items[0], { disposal: 'trash', is_jav: false, has_cover: false, has_thumb: true });
    }, { completeFirstPage: true });
    const { page } = opened;
    await page.route('**/poster**', (route) => route.fulfill({
      status: 200, contentType: 'image/png', body: Buffer.from(PIXEL, 'base64'),
    }));
    /* 岛根是 `line-height:1.5`，卡里没写行高的格子会继承它；旧卡读的是页面正文 14px/20px。
       取值用同一个岛根下的空元素量 token，不在断言里抄像素。 */
    const readStyles = (selectors: Record<string, string>) => page.evaluate((wanted) => {
      const root = document.querySelector('#grid .peach-react')!;
      const pick = (element: Element | null) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        return { fontSize: style.fontSize, lineHeight: style.lineHeight, fontFamily: style.fontFamily,
          letterSpacing: style.letterSpacing, minHeight: style.minHeight, padding: style.padding,
          display: style.display, place: `${style.alignItems} ${style.justifyItems}`, color: style.color,
          background: style.backgroundColor, borderWidth: style.borderTopWidth, borderColor: style.borderTopColor,
          leftRadius: style.borderTopLeftRadius, width: style.width, opacity: style.opacity };
      };
      const probe = (css: string) => {
        const element = document.createElement('div');
        element.style.cssText = css;
        root.append(element);
        const value = pick(element)!;
        element.remove();
        return value;
      };
      return {
        body: probe('font: var(--board-body)'), caption: probe('font: var(--board-caption)'),
        md: probe('font-size: var(--fs-md)'), muted: probe('color: var(--muted)'), text: probe(''),
        ground: probe('background: var(--ground)'), tungsten: probe('background: var(--tungsten)'),
        overlay: probe('background: var(--overlay-5); border: 1px solid var(--border-10)'),
        ...Object.fromEntries(Object.entries(wanted).map(([key, selector]) => [key, pick(root.querySelector(selector))])),
      };
    }, selectors);
    try {
      await page.locator('#grid [data-shorts-strip]').first().waitFor({ timeout: 10_000 });
      await page.locator('#grid [data-media-grid] > [data-media-card] [data-media-progress]').first().waitFor({ timeout: 10_000 });
      // 本例检查外观，夹具提供完整首页，Mix 按累计八张的真实规则插入。
      await page.locator('#grid [data-mix-glyph]').first().waitFor({ state: 'attached' });
      const catalog = await readStyles({
        card: '[data-media-grid] > [data-media-card]',
        badge: '[data-media-grid] > [data-media-card] [data-media-badge]',
        shorts: '[data-shorts-strip] > h2',
        mix: '[data-media-grid] > [data-mix-card]',
        mixTitle: '[data-media-grid] > [data-mix-card] [data-mix-title]',
        mixGlyph: '[data-media-grid] > [data-mix-card] [data-mix-glyph]',
        strip: '[data-shorts-strip]',
        progress: '[data-media-grid] > [data-media-card] [data-media-progress] > i',
        seekGlyph: '[data-media-grid] > [data-media-card] [data-media-seek] svg',
        laterButton: '[data-media-grid] > [data-media-card] [data-media-later] button',
        laterGlyph: '[data-media-grid] > [data-media-card] [data-media-later] svg',
      });
      const { body, caption, md, card, badge, shorts, mix, mixTitle } = catalog;
      /* 竖屏带靠底色和网格区分，不描线；宽屏上往左铺过侧栏轨道，贴视口那一侧不留圆角。 */
      assert.deepEqual([catalog.strip?.background, catalog.strip?.borderWidth], [catalog.ground.background, '0px'],
        '竖屏带不是页面底色那一张面，或者描了一圈线');
      assert.equal(catalog.strip?.leftRadius, '0px', '宽屏上竖屏带贴视口的那一侧还留着圆角');
      const edges = await page.evaluate(() => ({
        strip: document.querySelector('#grid [data-shorts-strip]')!.getBoundingClientRect().left,
        grid: document.querySelector('#grid [data-media-grid]')!.getBoundingClientRect().left,
      }));
      assert.ok(edges.strip < edges.grid, `竖屏带左缘 ${edges.strip} 没有越过网格左缘 ${edges.grid} 铺到侧栏底下`);
      /* 沉浸模式是一叠竖着翻的卡，入口用叠卡那一枚字形，不和别的动作共用。 */
      assert.equal(await page.locator('#grid [data-shorts-enter] svg use').first().getAttribute('href'), '#i-gallery-vertical-end',
        '竖屏带的「进入沉浸模式」换了字形');
      const immerse = page.locator('#grid [data-shorts-enter]').first();
      await immerse.scrollIntoViewIfNeeded();
      const measureImmerse = () => immerse.evaluate((node) => {
        const button = node.getBoundingClientRect();
        const strip = node.closest('[data-shorts-strip]')!.getBoundingClientRect();
        return { x: button.x - strip.x, y: button.y - strip.y,
          width: button.width, height: button.height, transform: getComputedStyle(node).transform };
      });
      const resting = await measureImmerse();
      await immerse.hover();
      await page.waitForTimeout(180);
      const hovering = await measureImmerse();
      assert.deepEqual(hovering, resting, '沉浸入口悬停保持原位与尺寸');
      const shortCard = page.locator('#grid [data-shorts-row] [data-media-card]').first();
      await shortCard.hover();
      await page.waitForTimeout(180);
      const feedback = await shortCard.evaluate(node => {
        const card = node.getBoundingClientRect(), row = node.closest('[data-shorts-row]')!.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, shadow: style.boxShadow, top: card.top - row.top,
          bottom: row.bottom - card.bottom, strip: getComputedStyle(node.closest('[data-shorts-strip]')!).backgroundColor };
      });
      assert.notEqual(feedback.background, 'rgba(0, 0, 0, 0)');
      assert.notEqual(feedback.shadow, 'none');
      /* 浅色下全站悬停面与带子底色同为 #F7F7F7，铺出去等于没铺。 */
      assert.notEqual(feedback.background, feedback.strip, '竖屏带里卡片的悬停面和带子底色同色');
      assert.ok(feedback.top >= 8 && feedback.bottom >= 8, JSON.stringify(feedback));
      /* 长悬停上移再放大，连同外铺的悬停面都要落在横滚行的裁切框里。 */
      const lifted = await shortCard.evaluate(async node => {
        node.setAttribute('data-longhover', '');
        await Promise.all(node.getAnimations().map(animation => { animation.finish(); return animation.finished }));
        const card = node.getBoundingClientRect(), row = node.closest('[data-shorts-row]')!.getBoundingClientRect();
        const spread = parseFloat(getComputedStyle(node).boxShadow.split(' ').at(-1)!) * 1.065;
        node.removeAttribute('data-longhover');
        return { top: card.top - spread - row.top, bottom: row.bottom - card.bottom - spread };
      });
      assert.ok(lifted.top >= 0 && lifted.bottom >= 0, `放大的竖屏卡被横滚行裁掉：${JSON.stringify(lifted)}`);
      await page.mouse.move(0, 0);
      assert.equal(catalog.progress?.background, catalog.tungsten.background, '观看进度条不是钨丝蓝');
      assert.deepEqual([catalog.mixGlyph?.background, catalog.mixGlyph?.borderWidth, catalog.mixGlyph?.borderColor],
        [catalog.overlay.background, '1px', catalog.overlay.borderColor], 'Mix 署名位那枚字形不是半透明底加细边');
      /* 主控保持 58px 配 34px 图标；角落动作取同一档 36px 配 18px 图标。 */
      assert.deepEqual([catalog.seekGlyph?.width, catalog.laterButton?.width, catalog.laterGlyph?.width], ['34px', '36px', '18px'],
        '悬停控件的尺寸和图标比例变了');
      const denseShort = await page.evaluate(() => {
        document.body.dataset.density = 'dense';
        const width = getComputedStyle(document.querySelector('#grid [data-shorts-strip] [data-media-card]')!).width;
        delete document.body.dataset.density;
        return width;
      });
      assert.equal(denseShort, '107px', '密集模式下竖屏带里的卡没有跟着缩到 214px 的一半');
      assert.deepEqual([card?.fontSize, card?.lineHeight], ['14px', '20px'], '作品卡的字不是页面正文那一档，岛根的 1.5 行高漏了进来');
      assert.deepEqual([badge?.fontSize, badge?.lineHeight], [caption.fontSize, caption.lineHeight], '来源角标的字不是 caption 那一档');
      assert.equal(badge?.minHeight, '24px', '来源角标矮于 24px');
      assert.deepEqual([shorts?.fontFamily, shorts?.lineHeight], [body.fontFamily, '20px'], '竖屏带标题的字体或行高不同页面正文');
      assert.ok(mix && mixTitle, '夹具目录里没有插进 Mix');
      assert.deepEqual([mix.fontSize, mix.lineHeight], ['14px', '20px'], '网格里的 Mix 卡没取页面正文那一档');
      assert.equal(mixTitle.letterSpacing, 'normal', '网格里的 Mix 标题带着字距');
      assert.ok(Math.abs(parseFloat(mixTitle.lineHeight) - parseFloat(md.fontSize) * 1.45) < .5,
        `网格里的 Mix 标题行高 ${mixTitle.lineHeight}，不是 --fs-md 的 1.45 倍`);

      await page.goto(new URL('/trash', page.url()).href, { waitUntil: 'load' });
      await page.locator('#grid [data-media-card][data-variant="resource"]').first().waitFor({ timeout: 15_000 });
      await settle(page);
      const trash = await readStyles({
        meta: '[data-media-grid] > [data-media-card] [data-media-meta]',
        glyph: '[data-variant="resource"] [data-media-glyph]',
        kind: '[data-variant="resource"] [data-media-kind-glyph]',
      });
      /* 回收站卡是 JAV 探索卡那一副：卡面不描边，头像与封面左缘齐平；标题统一两行、头像对齐标题顶部，
         归入原因在标签行，下面隔开一段才是卡底那颗「还原」，键行贴着卡的下缘。 */
      const inset = await page.locator('#grid [data-media-card][data-variant="resource"]').first().evaluate((card) => {
        const box = (selector: string) => card.querySelector(selector)!.getBoundingClientRect();
        const frame = card.getBoundingClientRect();
        const [pic, avatar, title, reason, actions] = ['[data-media-pic]', '[data-media-avatar]', '[data-media-title]',
          '[data-media-disposal-reason]', '[data-jav-actions]'].map(box);
        return { left: avatar.left - frame.left, top: title.top - pic.bottom, gap: actions.top - reason.bottom,
          bottom: Math.abs(frame.bottom - actions.bottom), edge: getComputedStyle(card).borderTopWidth,
          title: title.height, lineHeight: parseFloat(getComputedStyle(card.querySelector('[data-media-title]')!).lineHeight),
          skew: Math.abs(avatar.top - title.top) };
      });
      assert.deepEqual([inset.edge, inset.left], ['0px', 0], `回收站卡描了边或头像没和封面左缘齐平：${JSON.stringify(inset)}`);
      assert.ok(inset.top >= 8 && inset.gap >= 8 && inset.bottom < 1,
        `回收站卡的标题贴着封面、归入原因贴着键行，或键行没落在卡底：${JSON.stringify(inset)}`);
      assert.ok(Math.abs(inset.title - inset.lineHeight * 2) < 1, `回收站标题未预留两行：${JSON.stringify(inset)}`);
      assert.ok(inset.skew <= 3, `头像没有位于标题区顶部，偏 ${inset.skew}px`);
      assert.deepEqual([trash.glyph?.display, trash.glyph?.place, trash.glyph?.color], ['grid', 'center center', trash.muted.color],
        '回收站资源卡封面格里的字形没有居中或不是次要文字色');
      assert.deepEqual([trash.kind?.display, trash.kind?.place, trash.kind?.color], ['grid', 'center center', trash.text.color],
        '回收站资源卡头像位的字形没有居中或不是正文色');
      /* 悬停扫视层是壳插进封面格的 `img.ui-hvframes`：待删卡的灰化要连它一起，否则悬停时整卡「复活」成正常色。 */
      const scan = await page.locator('#grid [data-media-card][data-pending-delete]:not([data-variant="resource"]) [data-media-pic]')
        .first().evaluate((pic) => {
          const layer = document.createElement('img');
          layer.className = 'ui-hvframes';
          pic.append(layer);
          const filter = getComputedStyle(layer).filter;
          layer.remove();
          return filter;
        });
      assert.match(scan, /grayscale\(0\.9\)/, '待删卡的悬停扫视层没有跟着灰化');
      /* 待删卡的封面与补底压暗；元信息区同探索卡照常画，不跟着压暗。 */
      const pending = await page.locator('#grid [data-media-card][data-pending-delete]:not([data-variant="resource"])')
        .first().evaluate((card) => ({
          meta: getComputedStyle(card.querySelector('[data-media-meta]')!).opacity,
          backdrop: getComputedStyle(card.querySelector('[data-media-pic]')!, '::before').filter,
          image: getComputedStyle(card.querySelector('[data-media-pic] img')!).filter,
        }));
      assert.equal(pending.meta, '1', '待删卡的元信息区被压暗了，读不清标题与归入原因');
      assert.match(pending.backdrop, /blur\(26px\) grayscale\(0\.9\) brightness\(0\.27\)/, '待删卡的模糊补底跟随封面灰化');
      assert.match(pending.image, /grayscale\(0\.9\) brightness\(0\.54\)/, '待删卡封面没有跟着灰化');
    } finally {
      await opened.close();
    }
  });

  it('回收站的骨架和落地同一副几何，筛选浮层在两种主题下都和页面底色分得开', { timeout: 90_000 }, async () => {
    /* 回收站多是图片与压缩包，骨架照资源卡排：夹具把回收站那一页全换成图片。 */
    const opened = await openCatalogFixture(browser, (payload, url) => {
      if (url.searchParams.get('state') !== 'trash') return;
      for (const [at, item] of payload.items.entries()) {
        Object.assign(item, { medium: 'image', name: `演示图片-${at}.jpg`, disposal: 'trash' });
      }
    });
    const { page } = opened;
    const measure = () => page.evaluate(() => {
      const box = (element: Element | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return [Math.round(rect.top), Math.round(rect.height)];
      };
      const frame = document.querySelector<HTMLElement>('#trashFilter [data-catalog-frame]');
      /* 落地后骨架那一层藏着留在网格里，量的是看得见的那一张。 */
      const card = [...document.querySelectorAll(
        '#grid [data-jav-skeleton-card], #grid [data-media-card][data-variant="resource"]',
      )].find(node => !node.closest('[data-content-skeleton][aria-hidden="true"], [data-content-current][aria-hidden="true"]')
        && getComputedStyle(node).visibility === 'visible') ?? null;
      /* 读数与「清空回收站」各自的竖直中线：两者说的是同一批文件，同在浮层下排一行里。 */
      const middle = (element: Element | null | undefined) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return Math.round(rect.top + rect.height / 2);
      };
      const readout = frame?.querySelector('[data-catalog-readout]');
      return { frame: box(frame), card: box(card),
        placeholder: readout?.querySelectorAll('[data-skeleton="count"]').length ?? 0,
        text: readout?.textContent ?? null,
        row: [middle(readout), middle(frame?.querySelector('[data-empty-trash]'))] };
    });
    try {
      const release = await holdApi(page);
      await page.goto(new URL('/trash', page.url()).href, { waitUntil: 'load' });
      await page.locator('#grid [data-jav-skeleton-card]').first().waitFor({ timeout: 15_000 });
      const waiting = await measure();
      release();
      await page.locator('#grid [data-media-card][data-variant="resource"]').first().waitFor({ timeout: 15_000 });
      await settle(page);
      const landed = await measure();
      assert.ok(waiting.frame, '回收站骨架期间没有筛选浮层，读数到了才冒出来把网格往下推');
      assert.equal(waiting.placeholder, 1, `骨架期间读数那一格不是占位：${JSON.stringify(waiting)}`);
      assert.match(landed.text ?? '', /个符合 · 显示 \d+/, `读数没有落进浮层：${JSON.stringify(landed)}`);
      assert.equal(landed.placeholder, 0, '读数落地后占位还在');
      const [textMiddle, buttonMiddle] = landed.row;
      assert.ok(textMiddle != null && buttonMiddle != null && Math.abs(textMiddle - buttonMiddle) <= 1,
        `读数和清空键没并在浮层下排同一行：${JSON.stringify(landed.row)}`);
      assert.deepEqual(waiting.frame, landed.frame, `筛选浮层落地时位置或高度跳了：${JSON.stringify({ waiting, landed })}`);
      assert.deepEqual(waiting.card, landed.card, `回收站首张卡落地时位置或高度跳了：${JSON.stringify({ waiting, landed })}`);
      /* 同一历史条目保留读数和卡片，不重取也不重新铺占位。 */
      await page.evaluate(() => {
        const flags = window as unknown as { trashLedeFlashed?: boolean };
        flags.trashLedeFlashed = false;
        new MutationObserver(() => {
          if (document.querySelector('#trashFilter [data-skeleton="count"]')) flags.trashLedeFlashed = true;
        }).observe(document.querySelector('#trashFilter')!, { childList: true, subtree: true });
      });
      const rereads: string[] = [];
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname === '/api/items' && url.searchParams.get('state') === 'trash') rereads.push(url.href);
      });
      await page.evaluate(() => dispatchEvent(new PopStateEvent('popstate')));
      await page.locator('#grid [data-media-card][data-variant="resource"]').first().waitFor({ timeout: 15_000 });
      await settle(page);
      const holding = await measure();
      assert.deepEqual(rereads, [], '同一历史条目重复取数');
      assert.deepEqual([holding.placeholder, holding.text], [0, landed.text], `同页重画时读数回到了占位：${JSON.stringify(holding)}`);
      assert.equal(await page.evaluate(() => (window as unknown as { trashLedeFlashed?: boolean }).trashLedeFlashed), false,
        '同页重画期间读数闪回了占位');
      const surfaces = await page.evaluate(() => {
        const root = document.documentElement;
        const before = root.dataset.theme;
        const read = (theme: string) => {
          root.dataset.theme = theme;
          return [getComputedStyle(document.querySelector('#trashFilter [data-catalog-frame]')!).backgroundColor,
            getComputedStyle(document.body).backgroundColor];
        };
        const result = { light: read('light'), dark: read('dark') };
        if (before === undefined) delete root.dataset.theme;
        else root.dataset.theme = before;
        return result;
      });
      for (const [theme, [frame, ground]] of Object.entries(surfaces)) {
        assert.notEqual(frame, ground, `${theme} 主题下回收站筛选浮层和页面同一个底色：${frame}`);
      }
    } finally {
      await opened.close();
    }
  });

  it('批量条的键是行内字形、计数是 --ink-2；批量条与清空回收站两颗危险键读同一组红', { timeout: 90_000 }, async () => {
    const opened = await openCatalogFixture(browser, (payload, url) => {
      if (url.searchParams.get('state') !== 'trash') return;
      for (const item of payload.items) Object.assign(item, { disposal: 'trash' });
    });
    const { page } = opened;
    try {
      await page.goto(new URL('/trash', page.url()).href, { waitUntil: 'load' });
      const cards = page.locator('#grid [data-media-card][data-id]');
      await cards.nth(1).waitFor({ timeout: 15_000 });
      await page.locator('#trashFilter [data-empty-trash]').waitFor({ timeout: 15_000 });
      for (const at of [0, 1]) await cards.nth(at).click({ modifiers: ['Control'], position: { x: 20, y: 20 } });
      await page.locator('[data-batch-dock] [data-selection-dock]').waitFor({ timeout: 10_000 });
      await settle(page);
      const read = await page.evaluate(() => {
        const dock = document.querySelector('[data-batch-dock] [data-selection-dock]')!;
        /* 两颗危险键的静止面与悬停层各自读出来，再与直接解析 token 的探针比：同一份定义才会三者一致。 */
        const probe = (token: string) => {
          const node = document.createElement('div');
          node.style.background = `var(${token})`;
          document.body.append(node);
          const value = getComputedStyle(node).backgroundImage;
          node.remove();
          return value;
        };
        /* 渐变里各个色标换成像素再比：BoardUI 危险键用 oklch 写、`--board-red` 用 rgb 写，字面不同不等于颜色不同。 */
        const stops = (gradient: string) => (gradient.match(/(?:rgba?|oklch|oklab|hsla?)\([^)]*\)/g) ?? []).map((color) => {
          const context = document.createElement('canvas').getContext('2d')!;
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].join(',');
        });
        const paint = (key: Element) => [getComputedStyle(key).backgroundImage, getComputedStyle(key, '::before').backgroundImage].map(stops);
        return {
          // 与文字同行的字形取 `--icon-inline`（1.2em），按所在文字字号算出应有的边长。
          glyphs: [...dock.querySelectorAll('button svg')].map((svg) => {
            const box = svg.getBoundingClientRect();
            const inline = parseFloat(getComputedStyle(svg).fontSize) * 1.2;
            return [Math.abs(box.width - inline) < 0.5, Math.abs(box.height - inline) < 0.5];
          }),
          count: getComputedStyle(dock.querySelector('[role="status"]')!).color,
          batch: paint(dock.querySelector('[data-batch-action="delete"]')!),
          empty: paint(document.querySelector('#trashFilter [data-empty-trash]')!),
          raw: probe('--board-red'),
          tokens: [probe('--board-red'), probe('--board-red-hover')].map(stops),
        };
      });
      assert.deepEqual(read.glyphs, [[true, true], [true, true], [true, true]], `批量条的字形没按行内字号缩放：${JSON.stringify(read.glyphs)}`);
      assert.equal(read.count, await tokenColor(page, 'body', '--ink-2'), '批量条的计数不是次级墨色');
      assert.match(read.raw, /^linear-gradient/, `--board-red 没解析成渐变：${read.raw}`);
      assert.ok(read.tokens[0]!.length >= 2, `--board-red 的色标没读出来：${JSON.stringify(read.tokens)}`);
      assert.deepEqual(read.batch, read.tokens, `批量条「彻底删除」的红不是 --board-red 那一组：${JSON.stringify(read)}`);
      assert.deepEqual(read.empty, read.tokens, `「清空回收站」的红不是 --board-red 那一组：${JSON.stringify(read)}`);
    } finally {
      await opened.close();
    }
  });

  it('管理导航、面包屑与标题按层级排列，导航选中态使用中性填充', { timeout: 60_000 }, async () => {
    const opened = await visit(browser, '/duplicates', DESKTOP);
    try {
      const { page } = opened;
      await page.locator('[data-manage-crumb] [aria-current="true"]').waitFor({ timeout: 15_000 });
      await settle(page);
      const [ink, muted, fill] = await Promise.all(['--ink', '--muted', '--hover'].map((token) => tokenColor(page, 'body', token)));
      const read = await page.evaluate(() => {
        const items = [...document.querySelectorAll<HTMLElement>('[data-manage-crumb] li')];
        const pressed = document.querySelector<HTMLElement>('[data-manage][aria-pressed="true"]')!;
        const thumb = pressed.parentElement!.querySelector('[data-pill-thumb]')!;
        const selectedBox = pressed.getBoundingClientRect(), thumbBox = thumb.getBoundingClientRect();
        return {
          colors: items.map((item) => getComputedStyle(item).color),
          separators: items.map((item) => item.querySelector('svg') ? getComputedStyle(item.querySelector('svg')!).stroke : null),
          gap: getComputedStyle(document.querySelector('[data-manage-crumb] ol')!).columnGap,
          tab: getComputedStyle(pressed).color,
          fill: getComputedStyle(thumb).backgroundColor,
          buttonFill: getComputedStyle(pressed).backgroundColor,
          selectionDelta: [thumbBox.left - selectedBox.left, thumbBox.top - selectedBox.top,
            thumbBox.width - selectedBox.width, thumbBox.height - selectedBox.height],
          navBeforeCrumb: document.querySelector('[data-manage-bar]')!.getBoundingClientRect().bottom <= document.querySelector('[data-manage-crumb]')!.getBoundingClientRect().top,
          crumbBeforeTitle: document.querySelector('[data-manage-crumb]')!.getBoundingClientRect().bottom <= document.querySelector('[data-manage-title]')!.getBoundingClientRect().top,
          titleLeft: Math.round(document.querySelector('[data-manage-title]')!.getBoundingClientRect().left - document.querySelector('#grid')!.getBoundingClientRect().left),
        };
      });
      assert.deepEqual(read.colors, [muted, ink], '上一级不是 --muted，或当前项没升到 --ink');
      assert.deepEqual(read.separators, [muted, null], '分隔符跟着当前项提亮了，或最后一项也带了分隔符');
      assert.equal(read.gap, '6px');
      assert.deepEqual([read.tab, read.fill], [ink, fill]);
      assert.equal(read.buttonFill, 'rgba(0, 0, 0, 0)');
      assert.ok(read.selectionDelta.every(value => Math.abs(value) < 1), '选中底板没有对齐当前导航项');
      assert.equal(read.navBeforeCrumb, true);
      assert.equal(read.crumbBeforeTitle, true);
      assert.equal(read.titleLeft, 0);
      assert.deepEqual(opened.problems.filter((line) => !line.includes('/api/links/check')), []);
    } finally {
      await opened.close();
    }
  });

  it('分卷卡不翻卡、悬停走分段预览，叠层纸边和封面同一档圆角', { timeout: 60_000 }, async () => {
    /* 各卷共用同一个番号的封套，翻过去还是那张图。演示库没有分卷，给首张卡挂一个。 */
    const opened = await openCatalogFixture(browser, (payload) => {
      const [first, second] = payload.items;
      payload.items[0] = { ...first, part_group: {
        key: 'DEMO-PART', title: 'DEMO-PART', count: 2, seed_id: first.id,
        item_ids: [first.id, second.id], total_duration: 120, total_size: 1 } };
    });
    try {
      const shapeOf = (selector: string) => opened.page.locator(selector).first().evaluate((element) => {
        const stack = element.querySelector('[data-media-stack],[data-mix-stack]')!;
        const cover = element.querySelector('[data-media-pic],[data-mix-cover]')!;
        return {
          // 封面格的圆角由 clip-path 裁出来（media-card.css），格子本身不写 border-radius。
          cover: getComputedStyle(cover).clipPath.match(/round (\S+)\)$/)?.[1] ?? '0px',
          ground: getComputedStyle(cover).backgroundColor,
          layers: ['::before', '::after'].map((pseudo) => getComputedStyle(stack, pseudo).borderTopLeftRadius),
          faces: element.querySelectorAll('[data-mix-faces]').length,
          preview: Boolean(element.querySelector('[data-media-preview]')),
        };
      });
      await opened.page.locator('[data-media-card][data-part-seed]').first().waitFor({ timeout: 10_000 });
      const part = await shapeOf('[data-media-card][data-part-seed]');
      assert.notEqual(part.cover, '0px', '封面没有圆角，比对失去意义');
      assert.deepEqual(part.layers, [part.cover, part.cover], '分卷卡的叠层纸边和封面不是同一档圆角');
      // 封面格背后压着纸边：格子是空的，纸边线条就从封面没盖住的地方透出来。
      assert.notEqual(part.ground, 'rgba(0, 0, 0, 0)', '叠层卡的封面格是透明的，纸边会透进封面');
      assert.equal(part.faces, 0, '分卷卡仍挂着翻卡面板');
      assert.ok(part.preview, '分卷卡悬停没有分段预览入口');
      if (await opened.page.locator('#grid [data-mix-card]').count()) {
        const mix = await shapeOf('#grid [data-mix-card]');
        assert.deepEqual(mix.layers, [mix.cover, mix.cover], 'Mix 卡的叠层纸边和封面不是同一档圆角');
      }
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('分卷计数在悬停与键盘聚焦时淡出，右上角让给倒计时圈', { timeout: 60_000 }, async () => {
    const opened = await openCatalogFixture(browser, (payload) => {
      const [first, second] = payload.items;
      payload.items[0] = { ...first, part_group: {
        key: 'DEMO-PART', title: 'DEMO-PART', count: 2, seed_id: first.id,
        item_ids: [first.id, second.id], total_duration: 120, total_size: 1 } };
    });
    try {
      const page = opened.page;
      const card = page.locator('[data-media-card][data-part-seed]').first();
      await card.waitFor({ timeout: 10_000 });
      const read = () => card.evaluate(async (element) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const group = element.querySelector<HTMLElement>('[data-media-group]')!;
        const box = group.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return {
          group: [getComputedStyle(group).opacity, getComputedStyle(group).visibility],
          later: getComputedStyle(element.querySelector('[data-media-later]')!).opacity,
          hitGroup: hit?.closest('[data-media-group]') === group,
        };
      });
      await page.mouse.move(0, 0);
      assert.deepEqual(await read(), { group: ['1', 'visible'], later: '0', hitGroup: true }, '不悬停时分卷计数没有照常显示');

      await card.locator('[data-media-pic]').hover();
      assert.deepEqual(await read(), { group: ['0', 'hidden'], later: '1', hitGroup: false },
        '悬停时分卷计数没有淡出，或仍压在右上角的悬停工具上');

      await page.mouse.move(0, 0);
      const opener = card.locator('[data-media-open]');
      await opener.focus();
      assert.equal(await opener.evaluate((element) => element.matches(':focus-visible')), true);
      assert.deepEqual(await read(), { group: ['0', 'hidden'], later: '1', hitGroup: false }, '键盘聚焦时分卷计数没有淡出');
      assert.equal(await card.locator('[data-media-preview]').evaluate((element) => getComputedStyle(element).opacity), '1',
        '键盘聚焦时右上角没有打开预览的键');
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('抬起与推开只属于作品卡的共演头像', { timeout: 60_000 }, async () => {
    const opened = await openCatalog(browser);
    try {
      await opened.page.emulateMedia({ reducedMotion: 'no-preference' });
      for (const selector of ['[data-tier-performer]', '[data-tier-studio]']) {
        const entry = opened.page.locator(selector).first();
        if (!await entry.count()) continue;
        await entry.hover();
        await opened.page.waitForTimeout(320);
        assert.equal(await entry.evaluate((element) => getComputedStyle(element).transform), 'none',
          `${selector} 仍套用了作品共演头像的抬起效果`);
      }
    } finally {
      await opened.close();
    }
  });

  it('视频卡整块是入口且内部链接保持独立', { timeout: 60_000 }, async () => {
    const opened = await openCatalogFixture(browser, (payload) => {
      payload.items[0] = { ...payload.items[0], tags: ['演示标签'] };
    });
    try {
      const card = opened.page.locator('#grid [data-media-card][data-id]').first();
      const opener = card.locator('[data-media-open]');
      const boxes = await Promise.all([card.boundingBox(), opener.boundingBox()]);
      assert.deepEqual(boxes[1], boxes[0], '全卡入口没有覆盖图片、文字与卡内空白');
      await card.hover();
      assert.notEqual(await card.evaluate((element) => getComputedStyle(element).backgroundColor),
        'rgba(0, 0, 0, 0)', '悬停整卡没有灰色反馈');

      await opened.page.setViewportSize({ width: 390, height: 844 });
      const narrow = await Promise.all([card.boundingBox(), opener.boundingBox()]);
      assert.deepEqual(narrow[1], narrow[0], '390px 下全卡入口没有覆盖完整卡片');
      assert.ok((narrow[0]?.x || 0) >= 0 && (narrow[0]?.x || 0) + (narrow[0]?.width || 0) <= 390,
        '390px 下视频卡越出视口');

      const nested = card.locator('button[data-media-tag]').first();
      const tag = await nested.getAttribute('data-tag');
      assert.ok(tag, '演示卡没有可操作的内部标签');
      await nested.focus();
      assert.equal(await nested.evaluate((element) => element.matches(':focus-visible')), true,
        '卡内链接不能用键盘聚焦');
      await nested.press('Enter');
      await opened.page.waitForURL((url) => url.searchParams.get('tag') === tag, { timeout: 10_000 });
      assert.doesNotMatch(opened.page.url(), /\/item\//, '卡内链接冒泡打开了视频');
    } finally {
      await opened.close();
    }
  });

  for (const [label, viewport] of [['390px', MOBILE], ['宽屏', DESKTOP]] as const) {
    it(`${label} 下教程中心可阅读、关闭与重开，不提交业务写入`, { timeout: 60_000 }, async () => {
      const opened = await visit(browser, '/', viewport, freshTutorial);
      try {
        const page = opened.page;
        await expectBody(page, '/', [page.locator('#grid')]);
        await settle(page);
        const writes: string[] = [];
        const streams: string[] = [];
        page.on('request', request => {
          if (/^\/(?:stream|api\/stream-plan)/.test(new URL(request.url()).pathname)) streams.push(request.url());
          if (new URL(request.url()).pathname === '/api/diagnostics/client-error' && request.postDataJSON()?.kind === 'context') return;
          if (new URL(request.url()).pathname.startsWith('/api/') && new URL(request.url()).pathname !== '/api/tutorial-progress' && !['GET', 'HEAD'].includes(request.method())) {
            writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
          }
        });
        const opener = page.locator('#tutorialBtn');
        await page.locator('.peach-guide-popover').getByRole('heading', { name: '从这里打开新手教程' }).waitFor();
        assert.ok(await opener.evaluate(node => node.classList.contains('driver-active-element')));
        await opener.click();
        const dialog = page.getByRole('dialog', { name: '新手教程', exact: true });
        await dialog.waitFor();
        const tabTops = new Set<number>();
        for (const name of ['开始使用', '界面导览', '设置导览']) {
          await dialog.locator('label').filter({ has: page.getByRole('radio', { name, exact: true }) }).click();
          // 窗口高度跟着这一页的内容走：没到上限时正文不滚也不留空；顶边不动，页签不跟着跳。
          const fit = await page.locator('.peach-guide-center').evaluate((surface) => {
            const body = surface.querySelector('.peach-guide-body')!;
            return { capped: surface.getBoundingClientRect().height >= parseFloat(getComputedStyle(surface).maxHeight) - 1,
              slack: body.clientHeight - body.scrollHeight };
          });
          if (!fit.capped) assert.ok(Math.abs(fit.slack) <= 1, `${name} 窗口没贴合内容：空出 ${fit.slack}px`);
          tabTops.add(Math.round((await dialog.getByRole('radiogroup', { name: '教程路径' }).boundingBox())!.y));
          assert.equal(await dialog.locator('[data-guide-banner]').count(), 1, `${name} 缺少共用引导区`);
          assert.equal(await dialog.locator('[data-guide-banner] .peach-guide-topic-icon svg').count(), 1, `${name} 缺少图标`);
          const indent = (await dialog.locator('[data-guide-banner] .peach-guide-topic-icon').boundingBox())!.x
            - (await dialog.getByRole('radiogroup', { name: '教程路径' }).boundingBox())!.x;
          assert.ok(Math.abs(indent) <= 1, `${name} 引导区比页签缩进 ${indent}px`);
          const action = (await dialog.locator('[data-guide-banner] button').first().boundingBox())!.x
            - (await dialog.locator('[data-guide-banner] .peach-guide-topic-icon').boundingBox())!.x;
          assert.ok(Math.abs(action) <= 1, `${name} 引导区的行动键没有靠左：偏 ${action}px`);
        }
        assert.equal(tabTops.size, 1, `切页签时页签上下跳动：${[...tabTops].join(', ')}`);
        const box = await dialog.boundingBox();
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height,
          '教程中心越出视口');
        await dialog.locator('label').filter({ has: page.getByRole('radio', { name: '设置导览', exact: true }) }).click();
        const segments = await dialog.getByRole('radiogroup', { name: '教程路径' }).evaluate(node => {
          const surface = node.querySelector('[data-moving-surface]')!;
          const first = node.querySelector('label')!;
          return { position: getComputedStyle(surface).position, inset: first.getBoundingClientRect().left - node.getBoundingClientRect().left };
        });
        assert.equal(segments.position, 'absolute', '选中底板不应占据分段器的排列空间');
        assert.ok(segments.inset <= 8, `首个选项前出现 ${segments.inset}px 空白`);
        const scroller = dialog.locator('.peach-guide-body');
        assert.equal(await scroller.evaluate(node => getComputedStyle(node).scrollbarWidth), 'none', '正文应使用共享覆盖式滚动条');
        const headerTop = (await dialog.locator('header').boundingBox())!.y;
        await scroller.evaluate(node => { node.scrollTop = node.scrollHeight });
        assert.equal((await dialog.locator('header').boundingBox())!.y, headerTop, '标题栏随正文滚走了');
        await dialog.getByRole('searchbox', { name: '搜索教程' }).fill('不存在的功能xyz');
        await dialog.getByRole('heading', { name: '没有匹配的教程', exact: true }).waitFor();
        await dialog.getByRole('button', { name: '关闭新手教程', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement === document.getElementById('tutorialBtn'));
        await opener.click();
        await dialog.waitFor();
        const inside = (await dialog.locator('header').boundingBox())!;
        await page.mouse.move(inside.x + 40, inside.y + 20);
        await page.mouse.down();
        await page.mouse.move(2, 2);
        await page.mouse.up();
        assert.ok(await dialog.isVisible(), '从正文拖到遮罩不应关闭教程');
        await page.mouse.click(2, 2);
        await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement === document.getElementById('tutorialBtn'));
        await opener.click();
        await dialog.waitFor();
        await dialog.locator('label').filter({ has: page.getByRole('radio', { name: '界面导览', exact: true }) }).click();
        assert.equal(await dialog.locator('[data-guide-topic]').count(), 4);
        await dialog.locator('[data-guide-topic="browse"] > details > summary').click();
        await dialog.getByRole('button', { name: /找到并播放/ }).click();
        await page.locator('.peach-guide-popover').waitFor();
        assert.equal(await dialog.isVisible(), false, '章节点击后仍停留在中间介绍页');
        const playbackGuide = page.locator('.peach-guide-popover');
        for (let step = 0; step < 4; step += 1) await playbackGuide.getByRole('button', { name: '下一步', exact: true }).click();
        await page.locator('#stage .vjs-control-bar.driver-active-element').waitFor();
        assert.deepEqual(await page.locator('#stage video.vjs-tech').evaluate(video => ({ paused: (video as HTMLVideoElement).paused, src: (video as HTMLVideoElement).currentSrc })), { paused: true, src: '' });
        await playbackGuide.getByRole('button', { name: '下一步', exact: true }).click();
        await page.locator('#stage [data-player-subtitles].driver-active-element').waitFor();
        await playbackGuide.locator('#driver-popover-description').click();
        assert.equal(await page.locator('#stage .vjs-peach-settings-toggle').getAttribute('aria-expanded'), 'true', '点击说明关闭了正在讲解的菜单');
        await page.waitForFunction(() => {
          const panel = document.querySelector('.peach-guide-popover')?.getBoundingClientRect();
          return document.querySelector('.driver-overlay')?.parentElement?.id === 'stage'
            && panel && panel.left >= 0 && panel.right <= innerWidth && panel.top >= 0 && panel.bottom <= innerHeight;
        });
        await playbackGuide.getByRole('button', { name: '下一步', exact: true }).click();
        await page.locator('#stage [data-local-playback-row].driver-active-element').waitFor();
        await playbackGuide.getByRole('button', { name: '完成本章', exact: true }).click();
        await page.locator('#stage[open]').waitFor({ state: 'hidden' });
        assert.deepEqual(streams, [], '导览请求了视频正片');
        await dialog.waitFor();
        await dialog.getByRole('button', { name: '开始快速导览', exact: true }).click();
        const guide = page.locator('.peach-guide-popover');
        await guide.waitFor();
        await settle(page, '.peach-guide-popover');
        const guideBox = (await guide.boundingBox())!;
        assert.ok(guideBox.x >= 8 && guideBox.x + guideBox.width <= viewport.width - 8, '导览说明卡贴住了视口边缘');
        assert.ok(await guide.evaluate(node => node.contains(document.activeElement)), '导览焦点未停留在说明卡内');
        const resized = viewport.width === 390 ? { width: 1280, height: 800 } : { width: 390, height: 844 };
        await page.setViewportSize(resized);
        await page.waitForFunction(() => {
          const box = document.querySelector('.peach-guide-popover')?.getBoundingClientRect();
          const target = document.querySelector('.driver-active-element')?.getBoundingClientRect();
          return box && target && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
            && target.width > 0 && target.right > 0 && target.left < innerWidth;
        });
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.mouse.click(2, viewport.height - 2);
        await guide.waitFor({ state: 'hidden' });
        await dialog.waitFor();
        await dialog.getByRole('button', { name: '继续快速导览', exact: true }).click();
        await guide.waitFor();
        await page.keyboard.press('Escape');
        await guide.waitFor({ state: 'hidden' });
        await dialog.waitFor();
        await dialog.getByRole('button', { name: '继续快速导览', exact: true }).click();
        await guide.getByRole('button', { name: '跳过本章', exact: true }).click();
        await dialog.waitFor();
        assert.equal(await guide.isVisible(), false, '跳过本章后仍停在步骤中');
        assert.equal(await dialog.locator('[data-guide-banner][data-guide-completed]').count(), 0, '跳过误记为完成');
        await dialog.locator('label').filter({ has: page.getByRole('radio', { name: '设置导览', exact: true }) }).click();
        await dialog.getByRole('button', { name: '了解常用设置', exact: true }).click();
        await guide.waitFor();
        for (let step = 0; step < 4; step += 1) await guide.getByRole('button', { name: '下一步', exact: true }).click();
        await guide.getByRole('button', { name: '完成本章', exact: true }).click();
        await dialog.waitFor();
        await page.locator('#settingsPanel').waitFor({ state: 'hidden' });
        assert.equal(new URL(page.url()).pathname, '/', '设置导览完成后未返回开始前的页面');
        assert.ok(await dialog.getByRole('radio', { name: '设置导览', exact: true }).isChecked());
        await dialog.getByRole('searchbox', { name: '搜索教程' }).fill('媒体库');
        await dialog.getByRole('button', { name: /媒体库与入库 媒体库/ }).click();
        await guide.waitFor();
        for (let step = 0; step < 8; step += 1) await guide.getByRole('button', { name: '下一步', exact: true }).click();
        await guide.getByRole('button', { name: '完成本章', exact: true }).click();
        await dialog.waitFor();
        assert.equal(new URL(page.url()).pathname, '/', '页面导览完成后未返回开始前的页面');
        assert.ok(await dialog.getByRole('searchbox', { name: '搜索教程' }).isVisible());
        await dialog.locator('label').filter({ has: page.getByRole('radio', { name: '界面导览', exact: true }) }).click();
        await dialog.getByRole('button', { name: '继续快速导览', exact: true }).click();
        for (let step = 0; step < 3; step += 1) await guide.getByRole('button', { name: '下一步', exact: true }).click();
        await guide.getByRole('button', { name: '完成本章', exact: true }).click();
        await dialog.waitFor();
        await opener.waitFor({ state: 'hidden' });
        assert.ok(await dialog.getByRole('button', { name: '再看一遍', exact: true }).isVisible());
        assert.equal(await dialog.locator('[data-guide-banner][data-guide-completed]').count(), 1);
        await page.reload();
        await page.locator('#grid').waitFor();
        assert.equal(await opener.isVisible(), false, '完成快速导览后刷新又显示了教程按钮');
        assert.deepEqual(writes, [], '只读教程触发了业务写入');
        await page.goto(new URL('/settings/maintenance', page.url()).href);
        await page.getByRole('region', { name: '新手教程', exact: true }).getByRole('button', { name: '重新打开', exact: true }).click();
        await dialog.waitFor();
        assert.equal(await opener.evaluate(node => (node as HTMLElement).hidden), false, '设置重新打开后没有恢复右上角入口');
        assert.ok(writes.every(write => write === 'POST /api/configuration/storage/measure'),
          `正常进入维护页只允许自动统计占用：${JSON.stringify(writes)}`);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
  }

  it('复核筛选条上的下拉和按钮一样高', { timeout: 60_000 }, async () => {
    const opened = await openReview(browser);
    try {
      /* BoardUI 的 Button 和 Input 都写死 h-8／h-9，Select 的 trigger 只有内边距，
         自己撑到 28px／38px。三颗并排时那 4px 一眼就看得见。量的是整条筛选条上每一颗
         控件，而不是点名某一颗：这一排以后加什么，都得落在同一档上。 */
      const heights = await opened.page.locator('[data-review-filter]')
        .evaluate((bar) => [...bar.querySelectorAll('button')]
          .map((node) => Math.round(node.getBoundingClientRect().height)));
      assert.ok(heights.length >= 2, `筛选条上只量到 ${heights.length} 颗控件`);
      assert.deepEqual([...new Set(heights)], [heights[0]],
        `筛选条上的控件高度不齐：${heights.join(' / ')}`);
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('复核卡的勾选框和标题共用一条中线', { timeout: 60_000 }, async () => {
    const opened = await openReview(browser);
    try {
      /* 勾选框 16px、标题那行 24px（字段名是一枚 caption Chip）。两个高度不同的东西
         顶对顶排在一起，读的人看到的是勾选框比标题高出一截，而它们说的是同一张卡。 */
      const offset = await opened.page.locator('section[data-review-key] header').first()
        .evaluate((element) => {
          const middle = (node: Element) => {
            const box = node.getBoundingClientRect();
            return box.top + box.height / 2;
          };
          return middle(element.querySelector('label > span[aria-hidden="true"]')!) - middle(element.querySelector('h4')!);
        });
      assert.ok(Math.abs(offset) <= 1, `勾选框比标题偏了 ${offset.toFixed(1)}px，不在同一条中线上`);
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('来源依据使用无下划线的展开按钮，文字差异清晰可见', { timeout: 60_000 }, async () => {
    const row = { ...REVIEW_ROW, field: 'title', field_label: '标题', current_value: '共同旧标题。',
      candidates: ['dmm', 'javdb'].map(source => ({ candidate_key: `${source}:title`, source,
        display_value: '共同新标题。', catalog_evidence: { title: { display_value: '共同新标题。' } } })) };
    const opened = await openReview(browser, [row]);
    try {
      const card = opened.page.locator('section[data-review-key]').first();
      const toggle = card.getByRole('button', { name: '展开 dmm 的来源依据', exact: true });
      await toggle.hover();
      const observed = await toggle.evaluate(node => ({ tag: node.tagName,
        underline: [node, ...node.querySelectorAll('*')].some(element =>
          getComputedStyle(element).textDecorationLine.includes('underline')) }));
      assert.deepEqual(observed, { tag: 'BUTTON', underline: false });
      const mark = card.locator('label:has(input[type="radio"]) mark').first();
      assert.equal(await mark.textContent(), '新');
      const color = await mark.evaluate(node => ({ text: getComputedStyle(node).color,
        parent: getComputedStyle(node.parentElement!).color, background: getComputedStyle(node).backgroundColor }));
      assert.notEqual(color.text, color.parent);
      assert.notEqual(color.background, 'rgba(0, 0, 0, 0)');
      assert.deepEqual(opened.problems, []);
    } finally { await opened.close() }
  });

  for (const viewport of [DESKTOP, MOBILE]) {
    it(`复核长资料只在正文滚动，卡头和判断操作仍在卡内 ${viewport.width}`, { timeout: 60_000 }, async () => {
      const row = { ...REVIEW_ROW, current_value: '当前已登记的完整资料。'.repeat(20),
        candidates: ['dmm', 'javdb'].map(source => ({ candidate_key: `${source}:studio`, source,
          content_id: 'very-long-content-identifier'.repeat(8),
          display_value: '来源提供的长资料。'.repeat(30) })) };
      const opened = await openReview(browser, [row], viewport);
      try {
        const geometry = await opened.page.locator('section[data-review-key]').first().evaluate(node => {
          const box = node.getBoundingClientRect();
          const body = node.querySelector('[data-overlay-scrollbar]')!;
          const footer = node.querySelector('footer')!.getBoundingClientRect();
          return { areas: node.querySelectorAll('[data-overlay-scrollbar]').length,
            scrolls: body.scrollHeight > body.clientHeight,
            footerInside: footer.top >= box.top && footer.bottom <= box.bottom + 1,
            overflow: node.scrollWidth > node.clientWidth,
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            currentInBody: body.contains(node.querySelector('[aria-label="当前信息"]')),
            sourceOverflow: [...node.querySelectorAll('label:has(input[type="radio"])')]
              .some(label => label.scrollWidth > label.clientWidth + 1) };
        });
        assert.deepEqual(geometry, { areas: 1, scrolls: true, footerInside: true,
          overflow: false, pageOverflow: false, currentInBody: true, sourceOverflow: false });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });

    it(`未收录词条之间使用分隔线 ${viewport.width}`, { timeout: 60_000 }, async () => {
      const row = { ...REVIEW_ROW, candidates: [{ ...REVIEW_ROW.candidates[0]!,
        unmapped_genres: ['アクメ・オーガズム', '美少女電影'] }] };
      const opened = await openReview(browser, [row], viewport);
      try {
        const group = opened.page.getByRole('group', { name: '未收录 genre', exact: true });
        const rows = group.getByRole('listitem');
        assert.equal(await rows.count(), 2);
        const dividers = await rows.evaluateAll(nodes => nodes.map(node => {
          const style = getComputedStyle(node);
          const parent = getComputedStyle(node.closest('[role="group"]')!);
          return { width: style.borderTopWidth, solid: style.borderTopStyle === 'solid',
            visible: style.borderTopColor !== parent.backgroundColor && style.borderTopColor !== 'rgba(0, 0, 0, 0)' };
        }));
        assert.deepEqual(dividers.map(row => row.width), ['0px', '1px']);
        assert.ok(dividers[1]!.solid && dividers[1]!.visible, '词条分隔线不可见');
        assert.equal(await rows.nth(0).getByRole('button', { name: '收录', exact: true }).count(), 1);
        assert.equal(await rows.nth(1).getByRole('button', { name: '不是内容', exact: true }).count(), 1);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });

    it(`复核来源切换只滚动证据正文，卡头与操作条固定 ${viewport.width}`, { timeout: 60_000 }, async () => {
      const row = { ...REVIEW_ROW, candidates: ['dmm', 'javdb', 'mgs'].map(source => ({
        candidate_key: `${source}:studio`, source, display_value: 'プレステージ',
        catalog_evidence: {
          title: { display_value: '隣の人妻と過ごす休日' },
          runtime: { display_value: '120 分钟' },
          director: { display_value: '田中' },
          label: { display_value: 'プレステージ' },
        },
      })) };
      const opened = await openReview(browser, [row], viewport);
      try {
        const card = opened.page.locator('section[data-review-key]').first();
        const scroller = card.locator('div[data-overlay-scrollbar]').first();
        const choices = card.locator('label:has(input[type="radio"])');
        await card.scrollIntoViewIfNeeded();
        const geometry = () => card.evaluate(node => {
          const rect = (element: Element) => {
            const box = element.getBoundingClientRect();
            return { top: box.top, height: box.height };
          };
          return { page: window.scrollY, scroll: node.scrollTop, card: rect(node),
            header: rect(node.querySelector('header')!), footer: rect(node.querySelector('footer')!) };
        });
        const before = await geometry();
        const unanchored = await card.locator('input[type="radio"], input[type="checkbox"]')
          .evaluateAll(inputs => inputs.flatMap(input => {
            const native = input.getBoundingClientRect();
            const label = input.closest('label')!.getBoundingClientRect();
            const inside = native.top >= label.top - 1 && native.bottom <= label.bottom + 1
              && native.left >= label.left - 1 && native.right <= label.right + 1;
            return inside ? [] : [{type:(input as HTMLInputElement).type,native:native.toJSON(),label:label.toJSON(),parent:input.parentElement?.outerHTML.slice(0,500)}];
          }));
        assert.deepEqual(unanchored, [], '隐藏输入框未随所属单选或复选标签定位');
        for (const at of [1, 2, 0]) {
          const choice = choices.nth(at);
          await choice.evaluate(node => {
            const body = node.closest('div[data-overlay-scrollbar]')!;
            body.scrollTop += node.getBoundingClientRect().top - body.getBoundingClientRect().top;
          });
          await choice.click();
          assert.equal(await choice.locator('input').isChecked(), true);
          assert.deepEqual(await geometry(), before, '点击来源移动了页面、卡片或操作条');
        }
        await choices.first().locator('input').focus();
        for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp']) {
          await opened.page.keyboard.press(key);
          assert.deepEqual(await geometry(), before, '方向键移动了页面、卡片或操作条');
          const visible = await scroller.evaluate(node => {
            const input = node.querySelector<HTMLInputElement>('input:checked')!;
            const box = input.getBoundingClientRect();
            const body = node.getBoundingClientRect();
            return box.top >= body.top - 1 && box.bottom <= body.bottom + 1;
          });
          assert.ok(visible, '键盘选中的来源没有进入正文可见区域');
        }
        const selected = await choices.locator('input').evaluateAll(inputs =>
          inputs.map(input => (input as HTMLInputElement).checked));
        for (const source of ['javdb', 'mgs']) {
          await opened.page.keyboard.press('Tab');
          const evidence = card.getByRole('button', { name: new RegExp(`^(展开|收起) ${source} 的来源依据$`) });
          assert.equal(await evidence.evaluate(node => node === document.activeElement), true,
            'Tab 应按文档顺序访问独立的来源依据');
          await opened.page.keyboard.press('Space');
          assert.equal(await evidence.getAttribute('aria-expanded'), 'true');
          await opened.page.keyboard.press('Space');
          assert.equal(await evidence.getAttribute('aria-expanded'), 'false');
          assert.deepEqual(await choices.locator('input').evaluateAll(inputs =>
            inputs.map(input => (input as HTMLInputElement).checked)), selected,
            '展开依据不得改变已选来源');
        }
        await opened.page.keyboard.press('Tab');
        assert.equal(await card.locator('footer').evaluate(node => node.contains(document.activeElement)), true,
          '访问依据后 Tab 应离开正文并进入判断操作');
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close() }
    });
  }

  it('复核滚动边缘按方向出现，当前信息与候选共用正文滚动', { timeout: 60_000 }, async () => {
    const opened = await openReview(browser);
    try {
      const card = opened.page.locator('section[data-review-key]').first();
      const scroller = card.locator('div[data-overlay-scrollbar]').first();
      // 增加候选内容，覆盖图片加载或队列更新后的溢出重算。
      await scroller.evaluate((node) => {
        const content = document.createElement('div');
        content.style.cssText = 'height:1000px;flex-shrink:0';
        content.dataset.scrollTest = '';
        node.append(content);
      });
      const edges = scroller.locator('..').locator('.ui-ov-edges');
      await opened.page.waitForFunction(() => !!document.querySelector('[data-review-key] .ui-can-scroll-bottom'));
      assert.equal(await edges.evaluate((node) => node.classList.contains('ui-can-scroll-top')), false);
      await scroller.evaluate((node) => { node.scrollTop = 100 });
      await opened.page.waitForFunction(() => !!document.querySelector('[data-review-key] .ui-can-scroll-top.ui-can-scroll-bottom'));
      assert.equal(await edges.evaluate((node) => getComputedStyle(node).pointerEvents), 'none');
      assert.equal(await edges.locator('.ui-ov-edge-top').evaluate((node) => getComputedStyle(node).backdropFilter), 'blur(2px)');
      const track = scroller.locator('..').locator('.ovtrack.ov-y');
      for (const viewport of [DESKTOP, MOBILE]) {
        await opened.page.setViewportSize({ width: viewport.width, height: viewport.height });
        const bounds = await track.evaluate((node) => {
          const scroll = node.parentElement!.querySelector('[data-overlay-scrollbar]')!.getBoundingClientRect();
          const rail = node.getBoundingClientRect();
          const card = node.closest('section')!.getBoundingClientRect();
          return { gap: rail.left - scroll.right, inset: card.right - rail.right };
        });
        assert.ok(bounds.gap >= -1, `滚动条命中区覆盖正文：${JSON.stringify(bounds)}`);
        assert.ok(bounds.inset >= 1, `滚动条越出卡片：${JSON.stringify(bounds)}`);
      }
      await opened.page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      const thumb = await track.locator('.ovthumb').boundingBox();
      assert.ok(thumb);
      await opened.page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
      await opened.page.mouse.down();
      await opened.page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2 + 30);
      await opened.page.mouse.up();
      assert.ok(await scroller.evaluate((node) => node.scrollTop > 100), '右侧轨道拖动没有滚动正文');
      await scroller.evaluate((node) => { node.scrollTop = node.scrollHeight });
      await opened.page.waitForFunction(() => !document.querySelector('[data-review-key] .ui-can-scroll-bottom'));
      await scroller.locator('[data-scroll-test]').evaluate((node) => node.remove());
      await opened.page.waitForFunction(() => !document.querySelector('[data-review-key] [data-scroll-edges]'));
      const current = await card.getByRole('region', { name: '当前信息' }).evaluate((node) => {
        const style = getComputedStyle(node);
        return { inBody: !!node.closest('[data-overlay-scrollbar]'), overflow: style.overflowY,
          areas: node.closest('section[data-review-key]')!.querySelectorAll('[data-overlay-scrollbar]').length };
      });
      assert.equal(current.inBody, true, '当前资料不在候选共用的正文里');
      assert.equal(current.areas, 1, '一张卡片出现多个独立滚动区');
      assert.notEqual(current.overflow, 'auto', '当前资料不应再次单独滚动');
      assert.deepEqual(opened.problems, []);
    } finally { await opened.close() }
  });

  it('暗色下没选中的勾选框边线不比浅色下更弱', { timeout: 60_000 }, async () => {
    const opened = await openReview(browser);
    try {
      /* 这颗框的底和卡面同色，所以整个形状全靠那一圈 1px 的边说话。浅色下它是白底上的
         浅灰线，暗色下必须至少同样清楚——否则卡上看着就是「没有框」。 */
      /* 计算值是 `oklch()` 原样，解析不出通道；画进 1×1 的画布再读回来就是 RGBA。 */
      const edge = () => opened.page.locator('section[data-review-key] header label > span').first()
        .evaluate((node) => {
          const context = document.createElement('canvas').getContext('2d')!;
          const paint = (color: string) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data];
          };
          const style = getComputedStyle(node);
          return [paint(style.borderTopColor), paint(style.backgroundColor)] as const;
        });
      const [lightEdge, lightFace] = await edge();
      // `web/app.js` 的 `applyTheme('dark')` 就是这两句；这里只借它换一次配色。
      await opened.page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
        document.documentElement.classList.add('dark');
      });
      const [darkEdge, darkFace] = await edge();
      const light = Math.abs(lightness(lightEdge) - lightness(lightFace));
      const dark = Math.abs(lightness(darkEdge) - lightness(darkFace));
      assert.ok(dark >= light,
        `暗色下边线与框内只差 ${dark.toFixed(1)} 个明度，浅色下有 ${light.toFixed(1)}`);
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('暗色下分隔线在两种卡面上都不比浅色更弱', { timeout: 60_000 }, async () => {
    const opened = await openReview(browser);
    try {
      /* 量的是 token 对而不是某一条线：`separator-border` 画在哪种面上由各处自己决定，
         复核卡页头与候选块之间那条线落在 `primary`，脚注带那条落在 `secondary`。逐条去点名，
         新加一处就得记得再补一条用例，而漏补和「这处本来就没线」在屏幕上看不出区别。
         末尾再核一次复核卡里的分隔线确实取的就是这个 token，免得两档都合格却根本没落到现场。 */
      const read = () => opened.page.locator('section[data-review-key]').first()
        .evaluate((node) => {
          const context = document.createElement('canvas').getContext('2d')!;
          const paint = (color: string) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data];
          };
          const style = getComputedStyle(node);
          const token = (name: string) => paint(style.getPropertyValue(name).trim());
          return {
            line: token('--color-separator-border'),
            card: token('--color-background-primary-default'),
            filled: token('--color-background-secondary-default'),
            edge: paint(getComputedStyle(node.querySelector('.border-separator-border')!).borderBottomColor),
          };
        });
      const before = await read();
      // `web/app.js` 的 `applyTheme('dark')` 就是这两句；这里只借它换一次配色。
      await opened.page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
        document.documentElement.classList.add('dark');
      });
      const after = await read();
      for (const [face, label] of [['card', '描边卡面'], ['filled', '填充卡面']] as const) {
        const light = Math.abs(lightness(before.line) - lightness(before[face]));
        const dark = Math.abs(lightness(after.line) - lightness(after[face]));
        assert.ok(dark >= light,
          `暗色下分隔线压在${label}上只差 ${dark.toFixed(1)} 个明度，浅色下有 ${light.toFixed(1)}`);
      }
      assert.deepEqual(after.edge, after.line, '复核卡里的分隔线没走 separator-border');
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('垃圾文件的筛选浮层与正文同宽，标题位于内容左上角', { timeout: 60_000 }, async () => {
    const opened = await openJunk(browser);
    try {
      /* 标题对齐内容左边缘；筛选浮层（上排分类、下排读数与排序）与网格共用正文宽度。 */
      const box = await opened.page.evaluate(() => {
        // 浅色是两块面最容易消失的那一档：深色下 primary 本来就比页面亮一级。
        document.documentElement.dataset.theme = 'light';
        document.documentElement.classList.remove('dark');
        const span = (selector: string) => {
          const rect = document.querySelector(selector)!.getBoundingClientRect();
          return { left: Math.round(rect.left), width: Math.round(rect.width) };
        };
        const face = (selector: string) =>
          getComputedStyle(document.querySelector(selector)!).backgroundColor;
        return {
          title: span('[data-manage-title]'),
          main: span('#main'),
          filters: span('#count [data-junk-filters-frame]'),
          readout: span('#count [data-junk-filters-frame] [data-catalog-readout]'),
          grid: span('#grid'),
          filtersFace: face('#count [data-junk-filters-frame]'),
          page: getComputedStyle(document.body).backgroundColor,
        };
      });
      assert.ok(box.readout.width > 0, '读数被挤成 0 宽，宽屏上看不见');
      assert.deepEqual(box.title, box.grid);
      assert.equal(box.title.width, box.grid.width);
      assert.deepEqual(box.filters, box.grid,
        `筛选浮层和正文网格不同宽：${box.filters.left}+${box.filters.width} 对 ${box.grid.left}+${box.grid.width}`);
      assert.notEqual(box.filtersFace, box.page, '筛选浮层和页面底色同色，整块看不见');
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('垃圾文件等数据时画的仍是它自己那条计数行', { timeout: 60_000 }, async () => {
    const opened = await visit(browser, '/junk-files', WIDE);
    try {
      /* 把等待态停在屏幕上：让这一页唯一那次取数挂着不回。等的只有读数，分类切换由
         URL 决定、此刻就画得出最终样子；画成目录那条的话，等待期间摆着一个这一页根本
         没有的「换一批」，数据到货整行再换成另一种东西。 */
      await opened.page.route('**/api/ads?**', () => {});
      await opened.page.reload({ waitUntil: 'load' });
      // 等 island 接管：壳铺的骨架和它等数据时那一版相同，接管之后仍是这一版才算数。
      await opened.page.locator(`${JUNK_COUNT} [data-junk-filters]`).waitFor({ timeout: 15_000 });
      const row = await opened.page.locator('#count').evaluate((node) => ({
        busy: node.getAttribute('aria-busy'),
        filters: node.querySelectorAll('[data-junk-filters] a').length,
        placeholder: node.querySelectorAll('[data-catalog-readout] [data-skeleton="count"]').length,
        shuffle: node.querySelectorAll('[data-entity-batch]').length,
      }));
      assert.equal(row.busy, 'true', '等待态没有对辅助技术公开');
      assert.ok(row.filters > 0, '等待期间这一行没有分类切换');
      assert.equal(row.placeholder, 1, '占位没有落在读数那一格');
      assert.equal(row.shuffle, 0, '等待期间摆着这一页没有的「换一批」');
    } finally {
      await opened.close();
    }
  });

  it('垃圾卡处置发出一条批量请求、卡随之离开；换分类不整页跳转', { timeout: 90_000 }, async () => {
    const opened = await openJunkWith(browser, [
      junkItem(9101, 'archive', '推广合集.zip'), junkItem(9102, 'url', '官网.url'), junkItem(9103, 'audio', '广告.mp3'),
    ]);
    try {
      const page = opened.page;
      const cards = page.locator('#grid [data-junk-card]');
      assert.equal(await cards.count(), 3);
      await cards.first().locator('[data-junk-action="dispose"]').press('Enter', { delay: 2100 });
      await page.waitForFunction(() => document.querySelectorAll('#grid [data-junk-card]').length === 2, null,
        { timeout: 10_000 });
      assert.deepEqual(opened.state.batches, [{ ids: [9101], operation: 'dispose', disposal_reason: 'junk' }]);
      await page.getByText('已移入回收站', { exact: true }).first().waitFor({ timeout: 5_000 });

      // 分类是 `<a href>`，普通左键由壳改地址重读：整页重载的话，页面上记的这个标记会丢。
      await page.evaluate(() => { (window as { junkStay?: boolean }).junkStay = true });
      await page.locator(`${JUNK_COUNT} [data-junk-kind-link="url"]`).click();
      await page.waitForFunction(() => location.search === '?type=url'
        && document.querySelectorAll('#grid [data-junk-card]').length === 1, null, { timeout: 10_000 });
      assert.equal(await page.evaluate(() => (window as { junkStay?: boolean }).junkStay), true, '换分类整页重载了');
      assert.match(opened.state.reads.at(-1)!, /kind=url/);
      assert.equal(await page.locator(`${JUNK_COUNT} [data-junk-kind-link="url"]`).getAttribute('aria-current'), 'page');
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('垃圾卡复用探索卡，键行同高居中，单击回收使用标准危险按钮', { timeout: 90_000 }, async () => {
    const opened = await openJunkWith(browser, [junkItem(9201, 'archive', '推广.zip'), junkItem(9202, 'url', '官网.url')]);
    try {
      const page = opened.page;
      const read = () => page.evaluate(() => {
        const card = document.querySelector('#grid [data-junk-card]')!;
        const keys = [...card.querySelectorAll('[data-junk-action]')].map((button) => {
          const style = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return {
            action: (button as HTMLElement).dataset.junkAction, height: Math.round(rect.height),
            justify: style.justifyContent, paint: [style.backgroundImage, getComputedStyle(button, '::before').backgroundImage],
            ink: style.color, background: style.backgroundColor, hold: button.hasAttribute('data-hold-confirm'),
            before: getComputedStyle(button, '::before').content, text: button.textContent ?? '',
          };
        });
        const rect = (node: Element | null) => {
          if (!node) return null;
          const { left, top, width, height } = node.getBoundingClientRect();
          return [left, top, width, height].map(Math.round);
        };
        const links = [...document.querySelectorAll('#count [data-junk-filters] a')].map((link) => ({
          current: link.getAttribute('aria-current') === 'page', face: getComputedStyle(link).backgroundColor,
          height: Math.round(link.getBoundingClientRect().height), box: rect(link),
        }));
        // 计数徽标到货时玻璃带动画重新落位：跑完再量，量的是它停下的地方。
        document.querySelector('#count [data-view-glide]')?.getAnimations().forEach((one) => one.finish());
        const glide = rect(document.querySelector('#count [data-view-glide]:not([hidden])'));
        /* 两颗危险键的静止面与悬停层各自读出来，再与直接解析 token 的探针比：同一份定义才会一致。 */
        const probe = (token: string) => {
          const node = document.createElement('div');
          node.style.background = `var(${token})`;
          document.body.append(node);
          const value = getComputedStyle(node).backgroundImage;
          node.remove();
          return value;
        };
        /* 渐变里各个色标换成像素再比：BoardUI 危险键用 oklch 写、`--board-red` 用 rgb 写，字面不同不等于颜色不同。 */
        const stops = (gradient: string) => (gradient.match(/(?:rgba?|oklch|oklab|hsla?)\([^)]*\)/g) ?? []).map((color) => {
          const context = document.createElement('canvas').getContext('2d')!;
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].join(',');
        });
        const style = getComputedStyle(card);
        return { edge: style.borderTopWidth, face: style.backgroundColor, keys: keys.map((key) => ({ ...key, paint: key.paint.map(stops) })),
          links, glide, raw: probe('--board-red'),
          red: [probe('--board-red'), probe('--board-red-hover')].map(stops),
          actionsBottom: Math.abs(card.getBoundingClientRect().bottom - card.querySelector('[data-junk-actions]')!.getBoundingClientRect().bottom) };
      });
      const wide = await read();
      // 卡面同 JAV 探索卡：轮廓靠封面格，卡本身不描边、不铺底；键行落在卡底。
      assert.deepEqual([wide.edge, wide.face], ['0px', 'rgba(0, 0, 0, 0)'], '垃圾卡描了边或铺了底，不是探索卡那一副');
      assert.ok(wide.actionsBottom < 1, `键行没落在卡底：${wide.actionsBottom}`);
      assert.deepEqual(wide.keys.map((key) => key.action), ['reveal', 'dismiss-junk', 'dispose']);
      for (const key of wide.keys) {
        assert.equal(key.justify, 'center', `${key.action} 的图标与标签没有居中`);
        assert.equal(key.height, 36, `${key.action} 高 ${key.height}`);
      }
      const dispose = wide.keys.find((key) => key.action === 'dispose')!;
      assert.match(wide.raw, /^linear-gradient/, `--board-red 没解析成渐变：${wide.raw}`);
      assert.ok(wide.red[0]!.length >= 2, `--board-red 的色标没读出来：${JSON.stringify(wide.red)}`);
      assert.equal(dispose.hold, false);
      assert.deepEqual(dispose.paint, wide.red);
      assert.equal(dispose.ink, await tokenColor(page, '#grid [data-junk-card]', '--color-text-white'));
      for (const key of wide.keys.filter((one) => one.action !== 'dispose')) {
        assert.notDeepEqual(key.paint, wide.red, `${key.action} 也画成了红键`);
      }
      const current = wide.links.filter((link) => link.current);
      assert.equal(current.length, 1);
      // 分类条是首页筛选条那一副：键自己不铺底，当前那一类底下垫的是那块滑动玻璃。
      assert.ok(wide.links.every((link) => link.face === 'rgba(0, 0, 0, 0)'), '分类键自己铺了底，不是首页那副滑动玻璃');
      assert.deepEqual(wide.glide, current[0]!.box, '滑动玻璃没有落在当前那一类上');

      // 紧凑密度下键缩一档，「查看位置」只剩图标，判断与移入回收站仍写字。
      await page.evaluate(() => { document.body.dataset.density = 'dense' });
      await page.waitForFunction(() => document.querySelector('#grid [data-junk-card] [data-junk-actions]')?.hasAttribute('data-compact'));
      const dense = await read();
      assert.deepEqual(dense.keys.map((key) => key.text.trim() === ''), [true, false, false], `紧凑密度下键上的字：${JSON.stringify(dense.keys)}`);
      assert.ok(dense.keys.every((key) => key.height < 36), `紧凑密度下键没缩：${dense.keys.map((key) => key.height)}`);
      await page.evaluate(() => { delete document.body.dataset.density });

      // 手机上分类够手指点，到 44px；卡底的键同探索卡，不比桌面矮。
      await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
      const narrow = await read();
      assert.ok(narrow.keys.every((key) => key.height >= 36), `手机上键高 ${narrow.keys.map((key) => key.height)}`);
      assert.ok(narrow.links.every((link) => link.height >= 44), `手机上分类高 ${narrow.links.map((link) => link.height)}`);
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  it('关注列表工具行里的主动作、版式开关、排序框和方向键同高', { timeout: 60_000 }, async () => {
    const opened = await openFollowManage(browser);
    try {
      const page = opened.page;
      const controls = {
        检查全部: page.locator('button[aria-label="检查全部"]'),
        // 两枚图标键拼成一组，对齐的是整组的外框，不是组里单个键。
        版式开关: page.locator('[aria-label="关注列表版式"]'),
        排序框: page.locator('button[aria-label="关注列表排序"]'),
        方向键: page.locator('button[aria-label^="按检查时间"]'),
      };
      const heights: Record<string, number> = {};
      for (const [name, control] of Object.entries(controls)) {
        heights[name] = (await control.boundingBox())!.height;
      }
      assert.equal(new Set(Object.values(heights)).size, 1, `同一排控件高度不一：${JSON.stringify(heights)}`);
      assert.deepEqual(opened.problems, []);
    } finally {
      await opened.close();
    }
  });

  for (const viewport of [DESKTOP, MOBILE]) {
    it(`关注列表骨架的偏好控件和接管后同一副长相，等数据的操作键是禁用态（${viewport.name}）`, { timeout: 60_000 }, async () => {
      /* 骨架与真页面各量一遍。版式、排序和方向是这台浏览器的偏好，骨架里就是最终那一档；
         检查全部、全部收起和行尾的移除键要等名单，骨架里是禁用态，只有尺寸与接管后一致。
         窄屏上工具行收成纯图标，两边按同一条线收，尺寸也要对得上。 */
      const opened = await visit(browser, '/subscriptions', viewport);
      try {
        const page = opened.page;
        await stubFollowManage(page);
        const release = await holdApi(page);
        await page.reload({ waitUntil: 'load' });
        await page.locator('[data-skeleton="board/subscriptions"] .ui-follow-skeleton-toolbar').waitFor({ timeout: 15_000 });
        const toolbar = '[data-skeleton] .ui-follow-skeleton-toolbar';
        const skeleton = await controlFaces(page, {
          检查全部: `${toolbar} [data-follow-toolbar-actions] > button:nth-of-type(1)`,
          默认视图: `${toolbar} [data-button-group] > button:first-child`,
          表格视图: `${toolbar} [data-button-group] > button:last-child`,
          排序框: `${toolbar} button[aria-haspopup="listbox"]`,
          方向键: `${toolbar} [data-follow-toolbar-controls] > span:last-of-type > button:last-child`,
          全部收起: `${toolbar} [data-follow-toolbar-controls] > button`,
          移除来源: '[data-skeleton] .follow-skeleton-source [data-follow-source-controls] > span:last-child > button:last-child',
        });
        const expected = await disabledTokens(page);
        const waiting = await waitingActionFaces(page, '[data-skeleton] [data-skeleton-action]');
        assert.ok(waiting.length >= 3, '关注列表骨架里没有标出等数据的操作键');
        for (const face of waiting) assertDisabledFace(face, expected);
        release();
        await page.locator('section[aria-label="kou 的关注来源"]').waitFor({ timeout: 15_000 });
        await settle(page);
        const final = await controlFaces(page, {
          检查全部: 'button[aria-label="检查全部"]',
          默认视图: '[aria-label="关注列表版式"] > button:first-child',
          表格视图: '[aria-label="关注列表版式"] > button:last-child',
          排序框: 'button[aria-label="关注列表排序"]',
          方向键: 'button[aria-label^="按检查时间"]',
          全部收起: 'button[aria-label="全部收起"]',
          移除来源: '[data-source-divider] [data-follow-source-controls] > span:last-child > button:last-child',
        });
        const waitsForData = new Set(['检查全部', '全部收起', '移除来源']);
        for (const name of Object.keys(final)) {
          assert.ok(final[name], `接管后找不到 ${name}`);
          if (waitsForData.has(name)) {
            assert.equal(skeleton[name]!.size, final[name]!.size, `${name} 接管时尺寸跳了`);
            continue;
          }
          assert.deepEqual(skeleton[name], final[name], `${name} 在骨架里和接管后长得不一样`);
        }
        assert.equal(final['默认视图']!.pressed, 'true', '默认版式下选中的不是网格那颗');
      } finally {
        await opened.close();
      }
    });
  }

  /* 整行都能点选之后，指着哪一行得看得出来。卡片视图的来源行和表格行走同一条规则；选中行
     有自己的底色，指着它时不换。 */
  it('关注列表指着哪一行哪一行换底色，两种视图都是，选中行的底色不被 hover 盖掉', { timeout: 60_000 }, async () => {
    const opened = await openFollowManage(browser);
    try {
      const page = opened.page;
      const background = (locator: Locator) => locator.evaluate((element) => {
        for (const animation of element.getAnimations()) animation.finish();
        return getComputedStyle(element).backgroundColor;
      });
      /* 勾选框的 input 视觉隐藏在画出来的方框底下，点它要 force，和上面选中底色那条用例一样。 */
      const select = () => page.getByRole('checkbox', { name: '选择 kou · Kemono' })
        .check({ force: true, timeout: 5_000 });
      const card = page.locator('[data-source-divider] > div').first();
      const cardRested = await background(card);
      await card.hover();
      assert.notEqual(await background(card), cardRested, '指着卡片视图的来源行时底色没换');
      await select();
      const cardSelectedHovered = await background(card);
      await page.mouse.move(0, 0);
      const cardSelectedRested = await background(card);
      assert.equal(cardSelectedHovered, cardSelectedRested, '卡片视图选中行指着时换了底色，盖掉了选中态');
      assert.notEqual(cardSelectedRested, cardRested, '卡片视图选中行没有自己的底色');

      await page.locator('button[aria-label="表格视图"]').click({ timeout: 5_000 });
      const row = page.locator('[data-board-data-table] tbody tr').first();
      await row.waitFor({ timeout: 15_000 });
      await page.mouse.move(0, 0);
      const selectedRested = await background(row);
      await row.hover();
      assert.equal(await background(row), selectedRested, '表格视图选中行指着时换了底色，盖掉了选中态');
      await page.getByRole('checkbox', { name: '选择 kou · Kemono' }).uncheck({ force: true, timeout: 5_000 });
      await page.mouse.move(0, 0);
      const rested = await background(row);
      assert.notEqual(selectedRested, rested, '表格视图选中行没有自己的底色');
      await row.hover();
      assert.notEqual(await background(row), rested, '指着表格行时底色没换');
    } finally {
      await opened.close();
    }
  });
});
