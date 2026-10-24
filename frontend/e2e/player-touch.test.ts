/* 真触摸输入验证浏览器的合成 click、方向锁定和指针捕获，不读取个人资料库。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { stripTypeScriptTypes } from 'node:module';
import { launch } from './harness.ts';

for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
it(`${viewport.width}×${viewport.height} 触摸：控制条、横滑预览、倍速、音量与鼠标切换`, { timeout: 30_000 }, async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport, hasTouch: true });
  const page = await context.newPage();
  try {
    const css = readFileSync(new URL('../src/player/player.css', import.meta.url), 'utf8');
    const script = stripTypeScriptTypes(readFileSync(new URL('../src/player/touch-controls.ts', import.meta.url), 'utf8')).replace('export function', 'function');
    await page.setContent(`<style>${css}</style><div data-stage-media><div class="video-js vjs-playing vjs-user-active vjs-fullscreen">
      <video-player><media-container><video class="vjs-tech"></video><div class="vjs-control-bar"><button class="vjs-button">播放</button></div></media-container></video-player></div></div>`);
    await page.addScriptTag({ content: `${script}
      const root = document.querySelector('.video-js'), video = document.querySelector('video');
      let pauses = 0; video.pause = () => { pauses++ };
      Object.defineProperties(video, { duration: { value: 7200 }, paused: { value: false } });
      video.currentTime = 1200; video.volume = .5;
      wirePlayerInteractions(root, video, new AbortController().signal);
      window.fixture = { root, video, pauses: () => pauses };
    ` });
    const session = await context.newCDPSession(page);
    const middle = viewport.width / 2, right = viewport.width * .85;
    const touch = (type: string, x = middle, y = 300) => session.send('Input.dispatchTouchEvent',
      { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }] });
    const tap = async (x: number) => { await touch('touchStart', x); await touch('touchEnd') };
    await tap(middle); await page.waitForTimeout(350);
    assert.equal(await page.locator('.video-js').evaluate(root => root.classList.contains('vjs-user-inactive')), true);
    await tap(middle); await page.waitForTimeout(350);
    assert.equal(await page.locator('.video-js').evaluate(root => root.classList.contains('vjs-user-active')), true);
    assert.equal(await page.evaluate('fixture.pauses()'), 0);
    await touch('touchStart', viewport.width * .1); await touch('touchMove', viewport.width * .6);
    assert.equal(await page.evaluate('fixture.video.currentTime'), 1200);
    assert.match(await page.locator('.vjs-peach-gesture').innerText(), /30:00/);
    await touch('touchEnd'); assert.ok(Math.abs(Number(await page.evaluate('fixture.video.currentTime')) - 1800) < .01);
    await tap(right); await tap(right); assert.ok(Math.abs(Number(await page.evaluate('fixture.video.currentTime')) - 1810) < .01);
    await touch('touchStart'); await page.waitForTimeout(550);
    assert.equal(await page.evaluate('fixture.video.playbackRate'), 2);
    await touch('touchEnd'); assert.equal(await page.evaluate('fixture.video.playbackRate'), 1);
    await touch('touchStart', right); await touch('touchMove', right, 300 - viewport.height * .2);
    assert.ok(Math.abs(Number(await page.evaluate('fixture.video.volume')) - .7) < .01);
    await touch('touchCancel'); assert.equal(await page.evaluate('fixture.video.volume'), .5);
    await page.mouse.click(middle, 300); assert.equal(await page.evaluate('fixture.pauses()'), 1);
    assert.equal(await page.locator('.video-js').getAttribute('data-player-input'), 'mouse');
  } finally { await context.close(); await browser.close() }
});
}
