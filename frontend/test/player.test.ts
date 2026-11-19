/* 播放器模块（`src/player/`）里不依赖真 Video.js 的几块：片源判据、流会话取消、沉浸模式的每一格、观看上报、
 * 加载读数、画中画的 Media Session 与外挂字幕。挂上真 Video.js 的那一面在 `e2e/stage.test.ts`。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountPlayerMediaSession, mountPlayerQualityControl, mountPlayerSubtitles } from '../src/player/controls';
import { FIRST_FRAME_MS } from '../src/player/decode-support';
import { configurePlayer, type PlayerHost } from '../src/player/host';
import { averageBitrate, bufferedAhead, fmtLoadRate, pushPlayerStat } from '../src/player/stats';
import {
  cancelDetailStream, detailStreamSource, detailStreamSession, directStreamSource, playableStreamSource, streamFallbackChain,
} from '../src/player/stream';
import { mountPlayer } from '../src/player/detail-player';
import { beginPlayerGuidePreview } from '../src/player/guide-preview';
import { wireTelemetry } from '../src/player/telemetry';
import type { QualityLevel, QualityLevelList, VjsPlayer } from '../src/player/types';
import * as videojsLoader from '../src/player/videojs';
import { mountPlayerPipControl } from '../src/player/pip';
import { createV10Player } from '../src/player/v10-player';

type FetchCall = { url: string; init: RequestInit | undefined };

function stubFetch(reply: (url: string) => unknown): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply(url) ?? null), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const host = (seekSeconds = 10): PlayerHost => ({
  settings: () => ({ ambientMode: false, theaterMode: false, seekSeconds, miniplayer: true, detailAutoplay: false, javImage: 'cover' }),
  saveSettings: () => {},
  toast: () => {},
  loadSourceStatus: async () => ({}),
  offlineReason: () => '',
  stage: () => null,
});

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('播放器导览抑制片源与自动播放，结束后沿用已保存的播放偏好', async () => {
  const settings = { ...host().settings(), detailAutoplay: true };
  const saveSettings = vi.fn();
  configurePlayer({ ...host(), settings: () => settings, saveSettings });
  const sources = vi.fn(), play = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(videojsLoader, 'ensureVideojs').mockResolvedValue(vi.fn((video: HTMLVideoElement) => {
    const shell = document.createElement('div'); shell.append(video);
    let disposed = false;
    return {
      el: () => shell, on: () => {}, one: () => {}, ready: () => {},
      isDisposed: () => disposed, dispose: () => { disposed = true }, pause: () => {},
      src: sources, play, duration: () => 0, currentSource: () => ({}),
    } as unknown as VjsPlayer;
  }));
  const calls = stubFetch(() => ({ protocol: 'range', src: '/stream?id=42', mime_type: 'video/mp4' }));
  const finishGuide = beginPlayerGuidePreview();
  const releaseGuide = mountPlayer(document.createElement('video'), { kind: 'item', item: { id: 42 }, chrome: false });
  try {
    await flush(); await flush();
    expect(sources).not.toHaveBeenCalled(); expect(play).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  } finally { releaseGuide(); finishGuide() }
  const releaseNormal = mountPlayer(document.createElement('video'), { kind: 'item', item: { id: 42 }, chrome: false });
  try {
    await flush(); await flush();
    expect(sources).toHaveBeenCalled(); expect(play).toHaveBeenCalledOnce();
    expect(settings.detailAutoplay).toBe(true); expect(saveSettings).not.toHaveBeenCalled();
  } finally { releaseNormal(); configurePlayer(host()) }
});

describe('片源判据', () => {
  it('关闭详情后，迟到的原生兜底片源不会挂到视频', async () => {
    configurePlayer(host());
    vi.spyOn(videojsLoader, 'ensureVideojs').mockRejectedValueOnce(new Error('播放器未加载'));
    let deliver!: (response: Response) => void;
    const plan = new Promise<Response>((resolve) => { deliver = resolve });
    const fetcher = vi.fn(() => plan);
    vi.stubGlobal('fetch', fetcher);
    const video = document.createElement('video');
    const release = mountPlayer(video, { kind: 'item', item: { id: 3 }, chrome: false });
    await flush(); await flush();
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/stream-plan?id=3'), expect.anything());
    release();
    deliver(new Response(JSON.stringify({ src: '/stream?id=3', protocol: 'range' }), {
      headers: { 'Content-Type': 'application/json' },
    }));
    await flush();
    expect(video.hasAttribute('src')).toBe(false);
  });

  it('保存过的在线作品走关注条目的代理，不问 stream-plan', async () => {
    const calls = stubFetch(() => null);
    const source = await playableStreamSource({ id: 7, location: 'online', follow_item_id: 42 }, 's1');
    expect(source).toEqual({ src: '/follow-stream?id=42', type: 'video/mp4' });
    expect(calls).toEqual([]);
  });

  it('服务端要转码分片就给分片；计划取不到就带会话直读，webm 按扩展名给类型', async () => {
    stubFetch(() => ({ protocol: 'hls', src: '/stream/hls/3/index.m3u8' }));
    expect(await playableStreamSource({ id: 3 }, 's2'))
      .toEqual({ src: '/stream/hls/3/index.m3u8', type: 'application/vnd.apple.mpegurl' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }));
    expect(await playableStreamSource({ id: 3, name: 'a.WEBM' }, 's 2'))
      .toEqual({ src: '/stream?id=3&session=s%202', type: 'video/webm' });
    expect(directStreamSource({ id: 4 }, 'x').type).toBe('video/mp4');
  });

  it('兼容转码时先让浏览器试原画，失败再回退分片', async () => {
    stubFetch(() => ({ protocol: 'hls', src: '/stream/hls/3/index.m3u8', mime_type: 'application/vnd.apple.mpegurl',
      original_src: '/stream?id=3&session=s3', original_mime_type: 'video/mp4' }));

    expect(await playableStreamSource({ id: 3 }, 's3')).toEqual({
      src: '/stream?id=3&session=s3', type: 'video/mp4', trial: true,
      fallback: { src: '/stream/hls/3/index.m3u8', type: 'application/vnd.apple.mpegurl' },
    });
  });

  it('切不了分片时也先试原文件，放不了再要整片转换', async () => {
    stubFetch(() => ({ protocol: 'range', src: '/stream?id=3&original=1&session=s3', mime_type: 'video/x-matroska',
      fallback_src: '/stream?id=3&session=s3', fallback_mime_type: 'video/mp4' }));
    const original = await playableStreamSource({ id: 3 }, 's3');
    expect(original).toEqual({ src: '/stream?id=3&original=1&session=s3', type: 'video/x-matroska', trial: true,
      fallback: { src: '/stream?id=3&session=s3', type: 'video/mp4' } });
    expect((await streamFallbackChain(original)({ code: 4 }, original))?.src).toBe('/stream?id=3&session=s3');
  });

  it('MKV 保留原文件、无损封装和视频转码三条有序片源', async () => {
    stubFetch(() => ({ protocol: 'hls', src: '/remux.m3u8', mime_type: 'application/vnd.apple.mpegurl',
      original_src: '/original.mkv', original_mime_type: 'video/x-matroska', fallback_src: '/encode.m3u8' }));
    const original = await playableStreamSource({ id: 3 }, 's3');
    expect(original.type).toBe('video/x-matroska');
    const next = streamFallbackChain(original);
    expect(await next({ code: 2 }, original)).toBeNull();
    const remux = (await next({ code: 4 }, original))!;
    expect(remux.src).toBe('/remux.m3u8');
    // 同一次失败从媒体元素和播放器各报一遍：已经退过的那条不再前进。
    expect(await next({ code: 4 }, original)).toBeNull();
    // 分片的网络错误多半是服务端切不出来，也退到视频重编码。
    const encode = (await next({ code: 2 }, remux))!;
    expect(encode.src).toBe('/encode.m3u8');
    expect(await next({ code: 4 }, encode)).toBeNull();
  });

  it('回退链遇到重复地址时停止', async () => {
    const original = { src: '/a', type: 'video/mp4', fallback: { src: '/a', type: 'video/mp4' } };
    expect(await streamFallbackChain(original)({ code: 4 }, original)).toBeNull();
  });

  it('按能力直放的片子解不了：链走到头时换一份不报能力的计划，只换一次', async () => {
    const direct = { src: '/stream?id=3&session=s&decode=hevc', type: 'video/mp4', decode: 'hevc' };
    const retry = vi.fn(async () => ({ src: '/stream/hls/3/index.m3u8?session=s', type: 'application/vnd.apple.mpegurl' }));
    const next = streamFallbackChain(direct, retry);
    expect(await next({ code: 2 }, direct)).toBeNull();
    const hls = (await next({ code: 3 }, direct))!;
    expect(hls.src).toBe('/stream/hls/3/index.m3u8?session=s');
    expect(await next({ code: 4 }, hls)).toBeNull();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('详情兼容回退保留播放位置，网络错误不切换片源', async () => {
    configurePlayer(host());
    class Media extends HTMLElement {
      source: { src: string } | null = null;
      error: unknown = null;
      adapter = { destroy: () => {} };
    }
    if (!customElements.get('hlsjs-video')) customElements.define('hlsjs-video', Media);
    vi.spyOn(videojsLoader, 'ensureVideojs').mockResolvedValue(createV10Player);
    stubFetch((url) => url.startsWith('/api/stream-plan') ? {
      protocol: 'hls', src: '/remux.m3u8', original_src: '/original.mkv',
      original_mime_type: 'video/x-matroska', fallback_src: '/encode.m3u8',
    } : {});
    const video = document.createElement('video');
    document.body.append(video);
    const dispose = mountPlayer(video, { kind: 'item', item: { id: 3, duration: 100 },
      autoplay: false });
    await flush(); await flush();
    const media = document.querySelector('hlsjs-video') as Media;
    expect(media.source?.src).toContain('/original.mkv');
    media.error = { code: 2 }; media.dispatchEvent(new Event('error'));
    await flush();
    expect(media.source?.src).toContain('/original.mkv');
    for (const path of ['/remux.m3u8', '/encode.m3u8']) {
      video.currentTime = 62;
      media.error = { code: 4 }; media.dispatchEvent(new Event('error'));
      await flush();
      expect(media.source?.src).toContain(path);
      video.currentTime = 0; video.dispatchEvent(new Event('loadedmetadata'));
      expect(video.currentTime).toBe(62);
    }
    media.error = { code: 4 }; media.dispatchEvent(new Event('error'));
    await flush();
    expect(media.source?.src).toContain('/encode.m3u8');
    dispose();
  });

  it('详情这一路共用一个会话，取消时按会话通知服务端并清空', async () => {
    const calls = stubFetch(() => ({ cancelled: 1 }));
    await detailStreamSource({ id: 5 });
    const session = detailStreamSession();
    expect(session).not.toBe('');
    expect(calls[0]!.url).toBe(`/api/stream-plan?id=5&session=${encodeURIComponent(session)}`);
    cancelDetailStream();
    expect(detailStreamSession()).toBe('');
    const cancel = calls.at(-1)!;
    expect(cancel.url).toBe(`/api/stream-cancel?session=${encodeURIComponent(session)}`);
    expect(cancel.init).toMatchObject({ method: 'POST', keepalive: true });
    await flush(); await flush();
    expect(JSON.parse(document.documentElement.dataset.peachStreamCancel || 'null')).toEqual({ cancelled: 1 });
  });

  it('STRM 的文件类型使用服务端播放计划', async () => {
    stubFetch(() => ({ protocol: 'range', src: '/stream?id=6', mime_type: 'video/webm' }));
    expect(await playableStreamSource({ id: 6, name: 'ABC-123.strm' }, 'strm'))
      .toEqual({ src: '/stream?id=6', type: 'video/webm' });
  });
});

describe('观看上报', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('上一部作品的观看回执不会覆盖当前详情的读数', async () => {
    stubFetch(() => ({ real_ratio: .5, play_seconds: 50 }));
    const trace = document.createElement('div');
    trace.dataset.itemTrace = '9';
    trace.innerHTML = '<span id="realTxt">0%</span><u id="realBar"></u>';
    document.body.append(trace);
    try {
      const video = document.createElement('video');
      wireTelemetry({ id: 9, duration: 100 }, video);
      video.onended?.(new Event('ended'));
      trace.dataset.itemTrace = '11';
      await vi.advanceTimersByTimeAsync(0);
      expect(trace.querySelector('#realTxt')?.textContent).toBe('0%');
    } finally { trace.remove() }
  });

  it('离开详情时既不 pause 也不 ended：emptied 收尾停表', async () => {
    const calls = stubFetch(() => ({ real_ratio: .5 }));
    const video = document.createElement('video');
    wireTelemetry({ id: 9, duration: -1 }, video);
    video.onplay?.(new Event('play'));
    video.dispatchEvent(new Event('seeking'));
    vi.advanceTimersByTime(10_000);
    expect(calls.filter((call) => call.url === '/api/activity')).toHaveLength(1);
    video.dispatchEvent(new Event('emptied'));
    const settled = calls.length;
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(settled);
  });

  it('放完冲一次 ended，再交给调用方接着放下一条；-1 时长不画负比例', () => {
    const calls = stubFetch(() => null);
    const video = document.createElement('video');
    const ratio = document.createElement('span');
    ratio.id = 'ratioProbe';
    document.body.append(ratio);
    const onEnded = vi.fn();
    wireTelemetry({ id: 11, duration: -1 }, video, { ratio: '#ratioProbe', onEnded });
    expect(ratio.textContent).toBe('');
    video.onended?.(new Event('ended'));
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body).toMatchObject({ id: 11, ended: true, duration: 0 });
    expect(onEnded).toHaveBeenCalledOnce();
    ratio.remove();
  });
});

describe('沉浸模式的每一格', () => {
  /** 一个记账的 Video.js：记下挂了什么片源、`error` 一次性监听由用例触发。 */
  function fakeVideojs() {
    const made: { sources: unknown[]; disposed: boolean; plays: number; error?: () => void }[] = [];
    const factory = vi.fn((video: HTMLVideoElement) => {
      const record: (typeof made)[number] = { sources: [], disposed: false, plays: 0 };
      made.push(record);
      const shell = document.createElement('div');
      const container = document.createElement('media-container'); container.append(video); shell.append(container);
      Object.defineProperty(video, 'textTracks', { value: Object.assign([], new EventTarget(), {
        addEventListener: () => {}, removeEventListener: () => {},
      }) });
      const disposing: (() => void)[] = [];
      return {
        on: (event: string, handler: () => void) => {
          if (event === 'error') record.error = handler; else disposing.push(handler);
        },
        addRemoteTextTrack: () => {},
        src: (source: unknown) => { record.sources.push(source) },
        one: () => {},
        error: () => ({ code: 4 }),
        el: () => shell,
        isDisposed: () => record.disposed,
        pause: () => {},
        play: () => { record.plays++; return Promise.resolve() },
        playbackRate: (next?: number) => next === undefined ? video.playbackRate : (video.playbackRate = next),
        dispose: () => { record.disposed = true; disposing.forEach(handler => handler()) },
      } as unknown as VjsPlayer;
    });
    vi.spyOn(videojsLoader, 'ensureVideojs').mockResolvedValue(factory);
    return { factory, made };
  }

  it('片源按 stream-plan 交给裸播放器，分片出错退回直读；拆这一格时按会话取消并拆播放器', async () => {
    const calls = stubFetch((url) => url.startsWith('/api/player/memory') ? { selected: null, tracks: [] }
      : url.startsWith('/api/stream-plan') ? { protocol: 'hls', src: '/stream/hls/8/index.m3u8' } : { cancelled: 1 });
    const { factory, made } = fakeVideojs();
    const video = document.createElement('video');
    const onLoaded = vi.fn();
    const dispose = mountPlayer(video, { kind: 'immerse', item: { id: 8 }, session: 'imm-1', onLoaded });
    await flush(); await flush();
    expect(factory).toHaveBeenCalledWith(video, expect.objectContaining({ controls: false, controlBar: false }));
    expect(made[0]!.sources).toEqual([expect.objectContaining({ src: '/stream/hls/8/index.m3u8', type: 'application/vnd.apple.mpegurl' })]);
    expect(onLoaded).toHaveBeenCalledOnce();
    made[0]!.error!(); await flush();
    expect(made[0]!.sources.at(-1)).toEqual({ src: '/stream?id=8&session=imm-1', type: 'video/mp4' });
    dispose();
    dispose();
    expect(made[0]!.disposed).toBe(true);
    const cancels = calls.filter((call) => call.url.startsWith('/api/stream-cancel'));
    expect(cancels.map((call) => call.url)).toEqual(['/api/stream-cancel?session=imm-1']);
  });

  it('浏览器拒绝原画后，沉浸格改挂服务端给的分片回退', async () => {
    stubFetch(() => ({ protocol: 'hls', src: '/stream/hls/8/index.m3u8', mime_type: 'application/vnd.apple.mpegurl',
      original_src: '/stream?id=8&session=imm-3', original_mime_type: 'video/mp4' }));
    const { made } = fakeVideojs();
    const dispose = mountPlayer(document.createElement('video'), {
      kind: 'immerse', item: { id: 8 }, session: 'imm-3',
    });
    await flush(); await flush();
    expect(made[0]!.sources[0]).toEqual({ src: '/stream?id=8&session=imm-3', type: 'video/mp4', trial: true,
      fallback: { src: '/stream/hls/8/index.m3u8', type: 'application/vnd.apple.mpegurl' } });
    made[0]!.error!(); await flush();
    expect(made[0]!.sources.at(-1)).toEqual({ src: '/stream/hls/8/index.m3u8', type: 'application/vnd.apple.mpegurl' });
    dispose();
  });

  it('原文件试播时间在走却一帧没解出来，沉浸格也退到分片，并接着放', async () => {
    stubFetch(() => ({ protocol: 'hls', src: '/remux.m3u8', original_src: '/original.mkv',
      original_mime_type: 'video/x-matroska' }));
    const { made } = fakeVideojs();
    const video = document.createElement('video');
    const dispose = mountPlayer(video, { kind: 'immerse', item: { id: 8 }, session: 'imm-black' });
    await flush(); await flush();
    vi.useFakeTimers();
    try {
      Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
      Object.defineProperty(video, 'getVideoPlaybackQuality', { configurable: true,
        value: () => ({ totalVideoFrames: 0, droppedVideoFrames: 0 }) });
      video.dispatchEvent(new Event('playing'));
      video.currentTime = 3;
      vi.advanceTimersByTime(FIRST_FRAME_MS);
    } finally { vi.useRealTimers() }
    await flush();
    expect(made[0]!.sources.map((one) => (one as { src: string }).src)).toEqual(['/original.mkv', '/remux.m3u8']);
    expect(made[0]!.plays).toBe(1);
    dispose();
  });

  it('沉浸格按顺序尝试封装与编码回退，末端错误不再换源', async () => {
    stubFetch(() => ({ protocol: 'hls', src: '/remux.m3u8', original_src: '/original.mkv',
      original_mime_type: 'video/x-matroska', fallback_src: '/encode.m3u8' }));
    const { made } = fakeVideojs();
    const dispose = mountPlayer(document.createElement('video'), {
      kind: 'immerse', item: { id: 8 }, session: 'imm-chain',
    });
    await flush(); await flush();
    made[0]!.error!(); await flush();
    made[0]!.error!(); await flush();
    made[0]!.error!(); await flush();
    expect(made[0]!.sources.map((one) => (one as { src: string }).src))
      .toEqual(['/original.mkv', '/remux.m3u8', '/encode.m3u8']);
    dispose();
  });

  it('片源还没解析出来就拆掉：不再挂播放器，也不回调', async () => {
    stubFetch(() => ({ protocol: 'direct', src: '/stream?id=9' }));
    const { factory } = fakeVideojs();
    const onLoaded = vi.fn();
    const dispose = mountPlayer(document.createElement('video'), { kind: 'immerse', item: { id: 9 }, session: 'imm-2', onLoaded });
    dispose();
    await flush(); await flush();
    expect(factory).not.toHaveBeenCalled();
    expect(onLoaded).not.toHaveBeenCalled();
  });
});

describe('加载读数', () => {
  const buffered = (ranges: [number, number][]) => ({
    length: ranges.length, start: (i: number) => ranges[i]![0], end: (i: number) => ranges[i]![1],
  });

  it('缓冲健康只数播放位置所在那一段；码率要有大小和真时长才算得出', () => {
    const video = { currentTime: 12, buffered: buffered([[0, 5], [10, 30]]) } as unknown as HTMLVideoElement;
    expect(bufferedAhead(video)).toBe(18);
    expect(averageBitrate(1_000_000, 8)).toBe(1_000_000);
    expect(averageBitrate(1_000_000, -1)).toBe(0);
  });

  it('码率未知时报还能往前放多久，不报「× 实时」这类要换算的口径', () => {
    expect(fmtLoadRate(0, 12.4)).toBe('已缓冲 12 秒');
    expect(fmtLoadRate(8 * 2048, 0)).toBe('2 KB/s');
    expect(fmtLoadRate(0, 0)).toBe('加载中…');
  });

  it('三条指标各留 24 个采样，坏值记成 0', () => {
    const samples: number[] = [];
    for (let i = 1; i <= 30; i++) pushPlayerStat(samples, i);
    pushPlayerStat(samples, Number.NaN);
    expect(samples).toHaveLength(24);
    expect(samples[0]).toBe(8);
    expect(samples.at(-1)).toBe(0);
  });
});

function fakePlayer(state: { time: number; duration: number }) {
  const handlers = new Map<string, (() => void)[]>();
  const player = {
    on(events: string | string[], fn: () => void) {
      for (const event of [events].flat()) handlers.set(event, [...handlers.get(event) || [], fn]);
    },
    currentTime(value?: number) { if (value !== undefined) state.time = value; return state.time },
    duration: () => state.duration,
    playbackRate: () => 1,
    play: () => Promise.resolve(),
    pause: () => {},
    isDisposed: () => false,
    addRemoteTextTrack: vi.fn(),
  };
  const fire = (event: string) => handlers.get(event)?.forEach((fn) => fn());
  return { player: player as unknown as VjsPlayer, raw: player, fire };
}

it('画中画入口保持占位，媒体就绪后启用，浏览器不支持时保留原因并禁用', async () => {
  const root = document.createElement('div'), video = document.createElement('video'), button = document.createElement('button');
  root.append(video, button);
  let ready = 0;
  Object.defineProperties(video, { readyState: { get: () => ready }, videoWidth: { value: 1280 },
    webkitSetPresentationMode: { value: () => {} } });
  const original = vi.fn(async () => { throw new DOMException('Picture-in-Picture is not available', 'NotSupportedError') });
  const pip = Object.assign(button, { activate: original });
  const { player, fire } = fakePlayer({ time: 0, duration: 10 });
  Object.assign(player, { el: () => root });
  const label = vi.fn(), failure = vi.fn();
  mountPlayerPipControl(player, pip, label, failure);
  expect(pip.hasAttribute('data-peach-pip-supported')).toBe(true);
  expect(pip.disabled).toBe(true);
  ready = 4; video.dispatchEvent(new Event('loadedmetadata'));
  expect(pip.disabled).toBe(false);
  await (pip.activate as (media: unknown) => Promise<unknown>)({});
  expect(failure).toHaveBeenCalledWith('当前浏览器不支持画中画');
  expect(pip.disabled).toBe(true);
  expect(pip.getAttribute('label')).toBe('当前浏览器不支持画中画');
  fire('dispose');
  expect(pip.activate).toBe(original);
});

describe('播放器清晰度', () => {
  function menu(entries: QualityLevel[], selectedIndex = 0, size: { width?: number; height?: number } = { width: 3840, height: 2160 }) {
    configurePlayer(host());
    const root = document.createElement('div'), bar = document.createElement('div'), video = document.createElement('video');
    bar.className = 'vjs-control-bar';
    bar.innerHTML = '<div class="vjs-subtitles-control vjs-control"><button type="button">CC</button></div>';
    const container = document.createElement('media-container'); container.append(video, bar);
    root.append(container); document.body.append(root);
    const { player, fire } = fakePlayer({ time: 0, duration: 100 });
    const events = new Map<string, () => void>();
    const levels = Object.assign(entries, { selectedIndex, on: (names: string | string[], fn: () => void) => {
      for (const name of [names].flat()) events.set(name, fn);
    } }) as QualityLevelList;
    Object.assign(player, { el: () => root, qualityLevels: () => levels,
      paused: () => true, ended: () => false, isFullscreen: () => false, muted: () => false, volume: () => 1, trigger: () => {} });
    mountPlayerQualityControl(player, video, size);
    const open = () => {
      bar.querySelector<HTMLButtonElement>('.vjs-peach-settings-toggle')!.click();
      bar.querySelector<HTMLButtonElement>('[data-player-quality-view]')!.click();
    };
    const labels = () => [...bar.querySelectorAll('[data-player-quality-option]')].map((node) => node.textContent);
    return { bar, video, levels, open, labels, change: () => events.get('change')?.(), notify: (name: string) => events.get(name)?.(),
      close: () => { fire('dispose'); root.remove() } };
  }

  it('设置菜单选择四个方向并可恢复原始画面', () => {
    const view = menu([]);
    try {
      Object.defineProperties(view.video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 },
        clientWidth: { value: 640 }, clientHeight: { value: 360 } });
      Object.defineProperties(view.video.closest('media-container')!, { clientWidth: { value: 640 }, clientHeight: { value: 360 } });
      view.bar.querySelector<HTMLButtonElement>('.vjs-peach-settings-toggle')!.click();
      for (const angle of [90, 180, 270, 0]) {
        view.bar.querySelector<HTMLButtonElement>('[data-player-rotation]')!.click();
        expect(view.bar.querySelectorAll('[data-player-rotation-option]')).toHaveLength(4);
        view.bar.querySelector<HTMLButtonElement>(`[data-player-rotation-option="${angle}"]`)!.click();
        expect(view.video.style.transform).toBe(angle % 180 ? `translate(-50%, -50%) rotate(${angle}deg)` : angle ? `rotate(${angle}deg)` : '');
        expect(view.video.style.width).toBe(angle % 180 ? '360px' : '');
        expect(view.video.style.height).toBe(angle % 180 ? '640px' : '');
      }
    } finally { view.close() }
    expect(view.video.style.transform).toBe('');
  });

  it('单档 HLS 用实际视频尺寸命名，不展示轨道地址或虚构自动档', () => {
    const view = menu([{ id: '0-https://example.test/index.m3u8?session=private', enabled: true }]);
    try {
      Object.defineProperties(view.video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
      view.video.dispatchEvent(new Event('loadedmetadata'));
      view.open();
      expect(view.labels()).toEqual(['1080p']);
      expect(view.bar.querySelector('[data-player-quality-option]')?.getAttribute('aria-checked')).toBe('true');
      expect(view.bar.querySelector('[data-player-quality-badge]')?.textContent).toBe('HD');
      view.bar.querySelector<HTMLButtonElement>('[data-player-quality-option]')!.click();
      expect(view.levels[0]!.enabled).toBe(true);
    } finally { view.close() }
  });

  it('尺寸未取得的单档不拿源文件高度猜清晰度', () => {
    const view = menu([{ id: 'private-stream-url', enabled: true }]);
    try {
      view.open();
      expect(view.labels()).toEqual(['当前画质']);
      expect(view.bar.querySelector<HTMLElement>('[data-player-quality-badge]')!.hidden).toBe(true);
    } finally { view.close() }
  });

  it('轨道逐个加入时保留自动选择', () => {
    const entries = [{ width: 640, height: 360, enabled: true }];
    const view = menu(entries);
    try {
      view.open();
      entries.push({ width: 1920, height: 1080, enabled: true });
      view.notify('addqualitylevel');
      expect(view.labels()).toEqual(['自动', '360p', '1080p']);
      expect(view.bar.querySelector('[data-player-quality-option="auto"]')?.getAttribute('aria-checked')).toBe('true');
    } finally { view.close() }
  });

  it('自动档的角标跟随正在播放的轨道，未知档位使用线路名', () => {
    const view = menu([{ width: 640, height: 360, enabled: true }, { width: 3840, height: 2160, enabled: true },
      { id: 'private-url', enabled: true }]);
    try {
      view.open();
      expect(view.labels()).toEqual(['自动', '360p', '2160p', '线路 3']);
      const badge = view.bar.querySelector<HTMLElement>('[data-player-quality-badge]')!;
      expect(badge.hidden).toBe(true);
      view.levels.selectedIndex = 1; view.change();
      expect(badge.textContent).toBe('4K');
      expect(badge.hidden).toBe(false);
    } finally { view.close() }
  });

  it('菜单开着时换轨与尺寸变化只就地更新清晰度面板，焦点留在原档', () => {
    const entries = [{ width: 640, height: 360, enabled: true }, { width: 1920, height: 1080, enabled: true }];
    const view = menu(entries);
    try {
      view.open();
      view.bar.querySelector<HTMLElement>('[data-player-quality-option="1"]')!.focus();
      view.levels.selectedIndex = 1; view.change();
      view.video.dispatchEvent(new Event('resize'));
      entries.push({ width: 3840, height: 2160, enabled: true });
      view.notify('addqualitylevel');
      const panel = view.bar.querySelector('.vjs-peach-settings-menu')!.lastElementChild!;
      expect(panel.querySelector('strong')?.textContent).toBe('清晰度');
      expect([...panel.querySelectorAll('[data-player-quality-option]')].map((node) => node.textContent))
        .toEqual(['自动', '360p', '1080p', '2160p']);
      expect((document.activeElement as HTMLElement).dataset.playerQualityOption).toBe('1');
    } finally { view.close() }
  });

  it('视频还没读到尺寸时按账本宽高的短边写档位，竖屏不写成 1920p', () => {
    const view = menu([], 0, { width: 1080, height: 1920 });
    try {
      view.open();
      expect(view.labels()).toEqual(['1080p']);
    } finally { view.close() }
  });

  it('点进清晰度时菜单按填好档位的面板高度过渡，不先缩成只剩标题栏', async () => {
    const view = menu([{ width: 640, height: 360, enabled: true }, { width: 1920, height: 1080, enabled: true }]);
    // 原型链上 Element 那一层的 scrollHeight 不动，这里只在 HTMLElement 上遮一层，用完删掉。一行 40px：标题栏一行，再加面板里此刻已有的每一档。
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) {
      return 40 * (this.querySelectorAll('.vjs-peach-panel-header').length + this.querySelectorAll('[data-player-quality-option]').length);
    } });
    try {
      view.open();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(view.labels()).toEqual(['自动', '360p', '1080p']);
      expect(view.bar.querySelector<HTMLElement>('.vjs-peach-settings-menu')!.style.height).toBe('160px');
    } finally {
      delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
      view.close();
    }
  });

  it('主菜单开着时尺寸变化只改清晰度那一行的读数', () => {
    const view = menu([{ id: 'private-stream-url', enabled: true }]);
    try {
      view.bar.querySelector<HTMLButtonElement>('.vjs-peach-settings-toggle')!.click();
      const row = view.bar.querySelector('[data-player-quality-view]')!;
      expect(row.querySelector('b')?.textContent).toBe('当前画质');
      Object.defineProperties(view.video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
      view.video.dispatchEvent(new Event('resize'));
      expect(view.bar.querySelector('[data-player-quality-view]')).toBe(row);
      expect(row.querySelector('b')?.textContent).toBe('1080p');
    } finally { view.close() }
  });
});

describe('画中画的快进快退', () => {
  it('逐个登记动作，一个不认不带走其余；步长取设置；换片时整组摘掉', () => {
    configurePlayer(host(15));
    const handlers = new Map<string, MediaSessionActionHandler | null>();
    const positions: unknown[] = [];
    vi.stubGlobal('navigator', { mediaSession: {
      setActionHandler(action: string, handler: MediaSessionActionHandler | null) {
        if (action === 'seekto' && handler) throw new TypeError('unsupported');
        handlers.set(action, handler);
      },
      setPositionState(state?: unknown) { positions.push(state) },
    } });
    const state = { time: 100, duration: 600 };
    const { player, fire } = fakePlayer(state);
    mountPlayerMediaSession(player, { id: 1, duration: 600 });
    expect([...handlers.keys()]).toEqual(['play', 'pause', 'seekbackward', 'seekforward']);
    handlers.get('seekforward')!({ action: 'seekforward' });
    expect(state.time).toBe(115);
    handlers.get('seekbackward')!({ action: 'seekbackward', seekOffset: 200 });
    expect(state.time).toBe(0);
    expect(positions[0]).toEqual({ duration: 600, position: 100, playbackRate: 1 });
    state.time = 700; fire('timeupdate');
    expect(positions).toHaveLength(1);
    fire('dispose');
    expect([...handlers.values()].every((handler) => handler === null)).toBe(true);
  });
});

describe('外挂字幕', () => {
  it('能播的轨全挂上，一条都不预先打开；认出语言的按语言码说语言名', async () => {
    stubFetch(() => ({ subtitles: [
      { id: 'sidecar:1', playable: true, src: '/sub/1.vtt', language: 'zh', label: '简体' },
      { id: 'sidecar:2', playable: false, src: '/sub/2.ass', language: 'ja', label: '日语' },
      { id: 'sidecar:3', playable: true, src: '/sub/3.vtt', label: '繁体' },
    ] }));
    const { player, raw } = fakePlayer({ time: 0, duration: 0 });
    mountPlayerSubtitles(player, 21);
    await flush(); await flush();
    expect(raw.addRemoteTextTrack.mock.calls).toEqual([
      [{ id: 'sidecar:1', kind: 'subtitles', src: '/sub/1.vtt', srclang: 'zh',
        label: new Intl.DisplayNames(['zh-CN'], { type: 'language' }).of('zh'), default: false }, true],
      [{ id: 'sidecar:3', kind: 'subtitles', src: '/sub/3.vtt', srclang: '', label: '繁体', default: false }, true],
    ]);
  });
});
