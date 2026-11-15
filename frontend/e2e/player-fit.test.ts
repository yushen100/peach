/* 全屏画面适配不依赖资料库，直接用正式样式和浏览器全屏 API 验证。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { launch } from './harness.ts';

for (const stylesheet of ['../src/player/player.css', '../../web/dist/peach-app.css']) {
describe(`全屏画面比例：${stylesheet}`, () => {
  let browser: Browser;
  before(async () => { browser = await launch() });
  after(async () => { await browser?.close() });

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    it(`${viewport.width}×${viewport.height}：全屏与退出全屏均完整显示`, { timeout: 30_000 }, async () => {
      const page = await browser.newPage({ viewport });
      try {
        const css = readFileSync(new URL(stylesheet, import.meta.url), 'utf8');
        await page.setContent(`<style>${css}</style><div data-stage-media>
          <div class="video-js"><video-player><media-container>
            <video class="vjs-tech" width="1920" height="1080"></video>
            <button style="position:relative;z-index:1">全屏</button>
          </media-container></video-player></div></div>`);
        await page.locator('button').evaluate(button => {
          button.addEventListener('click', () => button.parentElement!.requestFullscreen());
        });
        const video = page.locator('video');
        assert.equal(await video.evaluate(node => getComputedStyle(node).objectFit), 'contain');
        await page.locator('button').click();
        await page.waitForFunction(() => !!document.fullscreenElement);
        const frame = await video.evaluate(node => {
          const rect = node.getBoundingClientRect();
          return { fit: getComputedStyle(node).objectFit,
            box: [rect.x, rect.y, rect.width, rect.height], viewport: [innerWidth, innerHeight] };
        });
        assert.equal(frame.fit, 'contain', '比例不同时保留完整画面和黑边');
        assert.deepEqual(frame.box, [0, 0, ...frame.viewport]);
        if (viewport.height > viewport.width) {
          await page.setViewportSize({ width: viewport.height, height: viewport.width });
          await page.waitForFunction(() => {
            const frame = document.querySelector('video')!.getBoundingClientRect();
            return innerWidth > innerHeight && frame.width === innerWidth && frame.height === innerHeight;
          });
          assert.equal(await video.evaluate(node => getComputedStyle(node).objectFit), 'contain', '横屏后继续显示完整画面');
        }
        await page.evaluate(() => document.exitFullscreen());
        for (const state of ['class', 'attribute', 'full-window']) {
          await page.locator('.video-js').evaluate((root, state) => {
            root.classList.toggle('vjs-fullscreen', state === 'class');
            root.toggleAttribute('data-peach-fullscreen', state === 'attribute');
            document.body.classList.toggle('vjs-full-window', state === 'full-window');
          }, state);
          assert.equal(await video.evaluate(node => getComputedStyle(node).objectFit), 'contain', state);
        }
        await page.locator('.video-js').evaluate(root => {
          root.classList.remove('vjs-fullscreen');
          root.removeAttribute('data-peach-fullscreen');
          document.body.classList.remove('vjs-full-window');
        });
        assert.equal(await video.evaluate(node => getComputedStyle(node).objectFit), 'contain');
      } finally { await page.close() }
    });
  }
});
}
