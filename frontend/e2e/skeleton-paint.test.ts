import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import { launch, layout, requiredEnv, VIEWPORTS } from './harness.ts';

const routes = ['/', '/?browse=folders', '/jav', '/jav?tab=discover', '/jav?tab=releases', '/jav?tab=wants', '/follow', '/subscriptions', '/settings/maintenance/repairs', '/performers', '/creators', '/studios', '/agencies', '/series', '/tags',
  '/performers/演示艺人', '/creators/演示创作者', '/studios/演示厂牌', '/series/演示系列', '/agencies/演示事务所', '/tags/演示标签',
  '/stats', '/taste', '/data-cleanup', '/tasks', '/duplicates', '/quality-goals', '/playlists', '/review', '/sources',
  '/settings/library', '/settings/subscriptions', '/settings/downloads', '/settings/network', '/settings/maintenance', '/settings/diagnostics',
  '/unseen', '/watch-later', '/flagged', '/junk-files', '/trash', '/assets/1', '/posts/1', '/works/EXM-001'];

/** 两块骨架条之间至少留 1px，否则圆角贴在一起看着就是压住了；被设了 overflow 的父框纵向截掉的条同样算。
 *  骨架条认两种：挂了 `.skeleton`／`.skeleton-sheen` 的，和骨架容器里没有子元素、没有文字、自己涂了底色的空块
 *  （`skeletoncard` 的 i/b/em、统计页的指标格之类）。横向滚动的那一排条本来就会被截在可视区外，只量纵向。 */
function skeletonCollisions(): string[] {
  const painted = (node: Element) => {
    const css = getComputedStyle(node);
    return css.backgroundImage !== 'none' || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(css.backgroundColor);
  };
  const bars = [...document.querySelectorAll('.skeleton,.skeleton-sheen,:is([data-skeleton],[data-skeleton-tier],[class*="skeleton"]) *')]
    .filter(node => node.matches('.skeleton,.skeleton-sheen') || (!node.children.length && !node.textContent?.trim() && painted(node)))
    // 屏外卡的元信息区由 `content-visibility: auto` 跳过渲染、按估计高度占位，里面被压扁的样子不会画出来。
    .filter(node => node.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }))
    .map(node => ({ node, box: node.getBoundingClientRect() })).filter(({ box }) => box.width > 0 && box.height > 0);
  const name = (node: Element) => {
    const marks = [...node.attributes].filter(attr => attr.name.startsWith('data-')).map(attr => `[${attr.name}]`).join('');
    const parent = node.parentElement ? [...node.parentElement.attributes].filter(attr => attr.name.startsWith('data-')).map(attr => `[${attr.name}]`).join('') : '';
    return `${parent} > ${node.tagName.toLowerCase()}${marks}`;
  };
  const found: string[] = [];
  for (const [index, a] of bars.entries()) for (const b of bars.slice(index + 1)) {
    if (a.node.contains(b.node) || b.node.contains(a.node)) continue;
    const gapX = Math.max(a.box.left, b.box.left) - Math.min(a.box.right, b.box.right);
    const gapY = Math.max(a.box.top, b.box.top) - Math.min(a.box.bottom, b.box.bottom);
    if (gapX < 1 && gapY < 1) found.push(`相接 ${name(a.node)} ↔ ${name(b.node)} (${gapX.toFixed(1)}, ${gapY.toFixed(1)})`);
  }
  for (const { node, box } of bars) {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const overflow = getComputedStyle(parent).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      if (overflow === 'visible') continue;
      const frame = parent.getBoundingClientRect();
      if (box.top < frame.top - 1 || box.bottom > frame.bottom + 1) found.push(`截掉 ${name(node)} 在 ${name(parent)} (${(box.bottom - frame.bottom).toFixed(1)})`);
      break;
    }
  }
  return found;
}

describe('各页骨架的显示门槛与绘制边界', () => {
  let browser: Browser;
  before(async () => { browser = await launch() });
  after(async () => { await browser.close() });
  for (const viewport of VIEWPORTS) for (const theme of ['light', 'dark']) for (const [index, path] of routes.entries()) {
    it(`${viewport.name} ${theme} ${path} 隐藏时不泄露微光，显示时不越出视口`, async () => {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      let release = () => {};
      const held = new Promise<void>(resolve => { release = resolve });
      try {
        await context.addInitScript(theme => localStorage.setItem('peach.settings.v1', JSON.stringify({ theme, detailAutoplay: false })), theme);
        const page = await context.newPage();
        await page.route('**/api/**', async route => {
          const url = new URL(route.request().url());
          const overlay = /^\/(assets|posts|works)\//.test(path);
          const pending = overlay ? ['/api/item', '/api/follow', '/api/jav/detail'].includes(url.pathname)
            : !['/api/settings', '/api/entity/shapes'].includes(url.pathname);
          if (route.request().method() === 'GET' && pending) await held;
          await route.continue();
        });
        await page.goto(requiredEnv('PEACH_E2E_ORIGIN') + path, { waitUntil: 'load' });
        await page.locator('[data-skeleton]:visible,[data-skeleton-tier]:visible').first().waitFor();
        const leaks = await page.evaluate(() => {
          const roots = [...document.querySelectorAll('[data-skeleton],[data-skeleton-tier]')];
          const marked = roots.filter(node => !node.classList.contains('skeleton-awaiting'));
          marked.forEach(node => node.classList.add('skeleton-awaiting'));
          const leaks = roots.flatMap(root => [root, ...root.querySelectorAll('*')].flatMap(node =>
            ['', '::before', '::after'].filter(pseudo => {
              const css = getComputedStyle(node, pseudo || null);
              return (!pseudo || !['none', 'normal'].includes(css.content)) && css.visibility !== 'hidden';
            }).map(pseudo => `${node.tagName}.${node.className}${pseudo}`)));
          marked.forEach(node => node.classList.remove('skeleton-awaiting'));
          return leaks;
        });
        assert.deepEqual(leaks, []);
        const missing = await page.locator('[data-skeleton] svg use,[data-skeleton-tier] svg use,[data-skeleton-control] svg use').evaluateAll(nodes =>
          nodes.map(node => node.getAttribute('href') || '').filter(href => href.startsWith('#') && !document.getElementById(href.slice(1))));
        assert.deepEqual(missing, [], '骨架使用了未提供的图标');
        const scrollbars = await page.locator('[data-skeleton],[data-skeleton-tier]').evaluateAll(roots =>
          roots.flatMap(root => [root,...root.querySelectorAll('*')]).filter(node => {
            const style=getComputedStyle(node);
            return /^(auto|scroll)$/.test(style.overflowX) || /^(auto|scroll)$/.test(style.overflowY);
          }).filter(node => getComputedStyle(node).scrollbarWidth !== 'none')
            .map(node => `${node.tagName}.${node.className}`));
        assert.deepEqual(scrollbars, [], '骨架显示了原生滚动条');
        assert.deepEqual((await layout(page)).offenders, []);
        const density = await page.evaluate(() => document.body.dataset.density);
        for (const value of ['roomy', 'dense']) {
          await page.evaluate(next => new Promise(resolve => {
            document.body.dataset.density = next;
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }), value);
          assert.deepEqual(await page.evaluate(skeletonCollisions), [], `${value} 档骨架条相互压住或被父框截掉`);
        }
        await page.evaluate(previous => { if (previous) document.body.dataset.density = previous }, density);
        const evidence = process.env.PEACH_SKELETON_EVIDENCE;
        if (evidence) await page.screenshot({ path: join(evidence, `${viewport.name}-${theme}-${index}.png`) });
      } finally { release(); await context.close() }
    });
  }
});
