/* 浏览器真实解码、进度条焦点与应用快捷键共同工作的回归。 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Browser } from 'playwright-core';
import { launch, requiredEnv, visit, VIEWPORTS } from './harness.ts';

describe('右方向键临时二倍速', () => {
  let browser: Browser;
  let fixture: string;
  before(async () => {
    fixture = realpathSync(mkdtempSync(join(tmpdir(), 'peach-hold-speed-')));
    execFileSync(requiredEnv('PEACH_E2E_FFMPEG'), ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', 'testsrc2=size=160x90:rate=15', '-t', '30', '-an', '-c:v', 'libx264', '-g', '15',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(fixture, 'video.mp4')]);
    execFileSync(requiredEnv('PEACH_E2E_FFMPEG'), ['-hide_banner', '-loglevel', 'error',
      '-i', join(fixture, 'video.mp4'), '-c', 'copy', '-f', 'hls', '-hls_time', '1', '-hls_list_size', '0',
      '-hls_segment_filename', join(fixture, 'part-%d.ts'), join(fixture, 'video.m3u8')]);
    browser = await launch();
  });
  after(async () => { await browser?.close(); if (fixture) rmSync(fixture, { recursive: true, force: true }) });

  for (const protocol of ['mp4', 'hls'] as const) {
    it(`${protocol}：短按跳转，进度条焦点长按不跳转，松开及失焦恢复且不写入倍速记忆`, { timeout: 60_000 }, async () => {
      const savedRates: number[] = [];
      const opened = await visit(browser, `/assets/${requiredEnv('PEACH_E2E_ITEM')}`, VIEWPORTS[0]!, async page => {
        await page.route('**/api/player/memory?**', route => {
          if (route.request().method() === 'PUT') {
            const patch = route.request().postDataJSON();
            if (patch.rate !== undefined) savedRates.push(patch.rate);
          }
          return route.fulfill({ json: { selected: null, tracks: [], rate: 1.5 } });
        });
        await page.route('**/stream?**', route => route.fulfill({ body: readFileSync(join(fixture, 'video.mp4')), contentType: 'video/mp4' }));
        await page.route('**/hold-speed-fixture/**', route => {
          const name = basename(new URL(route.request().url()).pathname);
          assert.match(name, /^(video\.m3u8|part-\d+\.ts)$/);
          return route.fulfill({ body: readFileSync(join(fixture, name)),
            contentType: name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t' });
        });
      });
      const { page, problems } = opened;
      try {
        if (protocol === 'hls') {
          await page.locator('#stage hlsjs-video').evaluate(node => {
            (node as unknown as { source: { src: string; type: string } }).source = {
              src: '/hold-speed-fixture/video.m3u8', type: 'application/vnd.apple.mpegurl',
            };
          });
        }
        await page.waitForFunction(() => {
          const video = document.querySelector<HTMLVideoElement>('#stage video.vjs-tech');
          return video && video.readyState >= 2 && video.duration >= 29 && video.playbackRate === 1.5;
        });
        const video = page.locator('#stage video.vjs-tech');
        await video.evaluate((node: HTMLVideoElement) => { node.pause(); node.currentTime = 0; node.muted = true });
        const thumb = page.locator('#stage media-time-slider media-slider-thumb');
        await thumb.focus();
        await page.keyboard.down('ArrowRight');
        assert.ok(await video.evaluate((node: HTMLVideoElement) => node.currentTime < .2));
        await page.keyboard.up('ArrowRight');
        await page.waitForFunction(() => document.querySelector<HTMLVideoElement>('#stage video.vjs-tech')!.currentTime > 1);
        await video.evaluate((node: HTMLVideoElement) => { node.currentTime = 0; return node.play() });
        await page.waitForFunction(() => document.querySelector<HTMLVideoElement>('#stage video.vjs-tech')!.currentTime > .15);
        await thumb.focus();
        const start = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
        await page.keyboard.down('ArrowRight');
        await page.locator('.vjs-peach-hold-speed').waitFor({ state: 'visible' });
        for (let count = 0; count < 4; count++) await page.keyboard.down('ArrowRight');
        const holding = await video.evaluate((node: HTMLVideoElement) => ({ rate: node.playbackRate, time: node.currentTime }));
        assert.equal(holding.rate, 2);
        assert.ok(holding.time - start < 4, `长按误触跳转：${holding.time - start}`);
        await page.keyboard.up('ArrowRight');
        assert.equal(await video.evaluate((node: HTMLVideoElement) => node.playbackRate), 1.5);
        await page.locator('.vjs-peach-hold-speed').waitFor({ state: 'detached' });
        await page.keyboard.down('ArrowRight');
        await page.locator('.vjs-peach-hold-speed').waitFor({ state: 'visible' });
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await page.keyboard.up('ArrowRight');
        assert.equal(await video.evaluate((node: HTMLVideoElement) => node.playbackRate), 1.5);
        await video.evaluate((node: HTMLVideoElement) => node.pause());
        await page.locator('#closeStage').click();
        await page.locator('.video-js').waitFor({ state: 'detached' });
        assert.deepEqual(savedRates, []);
        assert.deepEqual(problems, []);
      } finally { await opened.close() }
    });
  }
});
