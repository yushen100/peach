/* 字幕恢复与用户新选择的先后关系，不依赖浏览器解码器。 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubtitleSession } from '../src/player/subtitle-memory';
import type { VjsPlayer } from '../src/player/types';
import { mountPlaybackRate, playerMemory } from '../src/player/memory';
import { mountPlayerRotation } from '../src/player/rotation';
import { mountCaptionStyle } from '../src/player/subtitle-style';
import { configurePlayer } from '../src/player/host';

function mounted() {
  const video = document.createElement('video'), events = new EventTarget();
  const tracks = Object.assign([] as TextTrack[], {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  });
  Object.defineProperty(video, 'textTracks', { value: tracks });
  const disposing: (() => void)[] = [];
  const root = document.createElement('div'); root.innerHTML = '<media-container></media-container>';
  let rate = 1;
  const player = { peachItem: { id: 1 }, on: (_event: string, callback: () => void) => disposing.push(callback),
    el: () => root, playbackRate: (next?: number) => next === undefined ? rate : (rate = next),
    isDisposed: () => false } as unknown as VjsPlayer;
  return { video, tracks, player,
    add: (id: string) => {
      const track = Object.assign(new EventTarget(), { id, kind: 'subtitles', label: id, language: 'zh', mode: 'disabled' }) as TextTrack;
      tracks.push(track); events.dispatchEvent(new Event('addtrack')); return track;
    }, dispose: () => disposing.forEach(callback => callback()) };
}
afterEach(() => vi.unstubAllGlobals());

describe('统一播放文件记忆', () => {
  const observer = () => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  it('字幕、旋转、倍速与外观共用一次读取，关闭播放器后由新会话恢复', async () => {
    observer();
    let saved = { selected: 'sidecar:2', tracks: [], rotation: 270, rate: 1.75, caption_style: { size: '150' } };
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') saved = { ...saved, ...JSON.parse(String(init.body)) };
      return new Response(JSON.stringify(saved));
    });
    vi.stubGlobal('fetch', fetcher);
    const view = mounted(), memory = playerMemory(view.player);
    const rotation = mountPlayerRotation(view.player, view.video);
    const setRate = mountPlaybackRate(view.player, view.video);
    const cleanup = new AbortController();
    const style = mountCaptionStyle(view.player.el(), view.video, cleanup.signal, memory);
    const subtitles = new SubtitleSession(view.player, view.video);
    await subtitles.ready;
    expect(fetcher).toHaveBeenCalledOnce();
    expect(rotation.angle()).toBe(270); expect(view.player.playbackRate()).toBe(1.75);
    expect(view.video.defaultPlaybackRate).toBe(1.75);
    expect(style.current().size).toBe('150'); expect(view.add('sidecar:2').mode).toBe('showing');
    rotation.set(90); setRate.set(2); style.set('size', '200'); subtitles.select(null);
    view.video.playbackRate = view.video.defaultPlaybackRate;
    view.video.dispatchEvent(new Event('loadedmetadata'));
    expect(setRate.current()).toBe(2); expect(view.video.defaultPlaybackRate).toBe(2);
    await flush(); view.dispose(); cleanup.abort();
    const reopened = mounted();
    const restored = mountPlayerRotation(reopened.player, reopened.video);
    mountPlaybackRate(reopened.player, reopened.video);
    await playerMemory(reopened.player).load(); await flush();
    expect(restored.angle()).toBe(90); expect(reopened.player.playbackRate()).toBe(2);
    expect(saved.selected).toBeNull(); expect(saved.caption_style.size).toBe('200');
    reopened.dispose();
  });

  it('读取期间修改设置，迟到的记录只恢复尚未操作的字段', async () => {
    observer();
    let loaded!: (response: Response) => void;
    const response = new Promise<Response>(resolve => { loaded = resolve });
    const writes: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') { writes.push(JSON.parse(String(init.body))); return new Response('{}') }
      return response;
    }));
    const view = mounted(), memory = playerMemory(view.player);
    const rotation = mountPlayerRotation(view.player, view.video), rate = mountPlaybackRate(view.player, view.video);
    const cleanup = new AbortController();
    const style = mountCaptionStyle(view.player.el(), view.video, cleanup.signal, memory);
    await Promise.resolve();
    rotation.set(180); rate.set(1.25); style.set('size', '200');
    loaded(new Response(JSON.stringify({ selected: null, tracks: [], rotation: 90, rate: 2,
      caption_style: { size: '150', color: 'yellow' } })));
    await memory.load(); await flush();
    expect(rotation.angle()).toBe(180); expect(view.player.playbackRate()).toBe(1.25);
    expect(style.current()).toMatchObject({ size: '200', color: 'yellow' });
    expect(writes).toEqual([{ rotation: 180 }, { rate: 1.25 }, { caption_style: { size: '200' } }]);
    view.dispose(); cleanup.abort();
  });

  it('失败的字段可重试，其他设置不会覆盖未保存的值', async () => {
    const writes: unknown[] = [];
    let fail = true;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'PUT') return new Response('{"selected":null,"tracks":[]}');
      writes.push(JSON.parse(String(init.body)));
      return fail ? new Response('{"error":"磁盘不可写"}', { status: 503 }) : new Response('{}');
    }));
    const view = mounted(), memory = playerMemory(view.player);
    await expect(memory.save({ rotation: 90 })).rejects.toThrow('磁盘不可写');
    fail = false;
    await memory.save({ rate: 2 });
    expect(writes).toEqual([{ rotation: 90 }, { rotation: 90, rate: 2 }]);
    expect(memory.error).toBe(''); view.dispose();
  });
});

describe('每部视频的字幕选择', () => {
  it('登记轨道的选择可通过字幕别名恢复', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ selected: 'sidecar:2', tracks: [] }))));
    const view = mounted(), session = new SubtitleSession(view.player, view.video);
    await session.ready;
    const track = view.add('sidecar:local:stable');
    const node = document.createElement('track'); node.dataset.subtitleAlias = 'sidecar:2';
    Object.defineProperty(node, 'track', { value: track }); view.video.append(node);
    view.video.dispatchEvent(new Event('loadedmetadata'));
    expect(track.mode).toBe('showing');
    view.dispose();
  });

  it('按身份恢复晚到的旁挂轨道，列表顺序不参与选择', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ selected: 'sidecar:2', tracks: [] })));
    vi.stubGlobal('fetch', fetcher);
    const view = mounted(), session = new SubtitleSession(view.player, view.video);
    await session.ready;
    const second = view.add('sidecar:2'), first = view.add('sidecar:1');
    expect(second.mode).toBe('showing'); expect(first.mode).toBe('disabled');
    expect(fetcher).toHaveBeenCalledOnce();
    view.dispose();
  });

  it('读取记忆期间选择关闭，迟到的响应和轨道都不能重新开启字幕', async () => {
    let loaded!: (response: Response) => void;
    const response = new Promise<Response>(resolve => { loaded = resolve });
    const writes: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') { writes.push(JSON.parse(String(init.body))); return new Response('{}') }
      return response;
    }));
    const view = mounted(), session = new SubtitleSession(view.player, view.video);
    await Promise.resolve();
    session.select(null);
    loaded(new Response(JSON.stringify({ selected: 'sidecar:2', tracks: [] })));
    await session.ready;
    const track = view.add('sidecar:2');
    expect(track.mode).toBe('disabled');
    expect(writes).toEqual([{ selected: null }]);
    view.dispose();
  });
});

describe('自动中文字幕设置', () => {
  it('设置打开时读记忆带 auto=zh，由服务端推导中文轨；关着或没接宿主时不带', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return new Response(JSON.stringify({ selected: null, tracks: [] })) }));
    let auto = false;
    configurePlayer({ stage: () => null, settings: () => ({ ambientMode: false, theaterMode: false, miniplayer: false, detailAutoplay: false,
      javImage: 'cover', seekSeconds: 10, autoChineseSubtitles: auto }), saveSettings: () => {}, toast: () => {},
    loadSourceStatus: async () => ({}), offlineReason: () => '' });
    for (const value of [false, true]) {
      auto = value;
      const view = mounted();
      await playerMemory(view.player).load();
      view.dispose();
    }
    expect(urls).toEqual(['/api/player/memory?video=item%3A1', '/api/player/memory?video=item%3A1&auto=zh']);
  });
});

describe('原生全屏的字幕显示', () => {
  it('iOS 原生全屏时交还原生字幕轨道，回到页面内再由网页层绘制', () => {
    const view = mounted(), cleanup = new AbortController(), root = view.player.el();
    let mode = 'inline';
    Object.defineProperty(view.video, 'webkitPresentationMode', { get: () => mode });
    mountCaptionStyle(root, view.video, cleanup.signal);
    expect(root.dataset.peachCaptions).toBe('');
    mode = 'fullscreen'; view.video.dispatchEvent(new Event('webkitpresentationmodechanged'));
    expect(root.dataset.peachCaptions).toBeUndefined();
    mode = 'inline'; view.video.dispatchEvent(new Event('webkitpresentationmodechanged'));
    expect(root.dataset.peachCaptions).toBe('');
    cleanup.abort();
  });
});
