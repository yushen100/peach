import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createV10Player } from '../src/player/v10-player';

const engine = () => ({ bandwidthEstimate: 8000000, currentLevel: -1,
  levels: [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }], on: vi.fn() });

class TestMedia extends HTMLElement {
  source: unknown = null;
  engine = engine();
  adapter = { destroy: vi.fn() };
}
beforeAll(() => {
  if (!customElements.get('hlsjs-video')) customElements.define('hlsjs-video', TestMedia);
  if (!customElements.get('dash-video')) customElements.define('dash-video', class extends TestMedia {});
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() });

function mounted() {
  const video = document.createElement('video'); document.body.append(video);
  const player = createV10Player(video, { controls: false });
  const media = player.el().querySelector('hlsjs-video') as TestMedia;
  return { video, player, media };
}

describe('Video.js 10 播放会话', () => {
  it('普通 HTTP 的随机源为无 ID 的视频创建独立播放器', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const first = mounted().player;
    const second = mounted().player;
    try {
      expect(first.el().id).toMatch(/^peach-player-/);
      expect(first.el().id).not.toBe(second.el().id);
    } finally { first.dispose(); second.dispose() }
  });

  it('片源交给异步 adapter 后立即播放，原生 play 使用已挂载的片源', async () => {
    const { video, player, media } = mounted();
    Object.defineProperty(media, 'source', { set: (value: { src: string }) => {
      queueMicrotask(() => { video.src = value.src });
    } });
    const play = vi.spyOn(video, 'play').mockImplementation(() => video.getAttribute('src')
      ? Promise.resolve() : Promise.reject(new DOMException('没有可播放的片源', 'NotSupportedError')));
    player.src({ src: '/example.mp4', type: 'video/mp4' });
    await expect(player.play()).resolves.toBeUndefined();
    expect(play).toHaveBeenCalledOnce();
    expect(video.src).toContain('/example.mp4');
    player.dispose();
  });

  it.each(['pause', 'source', 'dispose'] as const)('排队播放期间 %s 会取消该请求', async action => {
    const { video, player } = mounted();
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    const pending = player.play();
    if (action === 'pause') player.pause();
    else if (action === 'source') player.src({ src: '/next.mp4', type: 'video/mp4' });
    else player.dispose();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(play).not.toHaveBeenCalled();
    player.dispose();
  });

  it('媒体错误可补充来源状态文案，展示错误不会再次触发错误处理', () => {
    const { player, media } = mounted();
    const callback = vi.fn(() => player.error({ code: 2, message: '媒体目录无法访问' }));
    player.on('error', callback);
    media.dispatchEvent(new Event('error'));
    expect(callback).toHaveBeenCalledOnce();
    expect(player.error()).toEqual({ code: 2, message: '媒体目录无法访问' });
    player.dispose();
  });

  it('固定清晰度和自动码率使用同一条 HLS 引擎，带宽读取实际估计', async () => {
    const { player, media } = mounted();
    player.src({ src: '/example.m3u8', type: 'application/vnd.apple.mpegurl' });
    const levels = player.qualityLevels!();
    expect(levels.length).toBe(2);
    videoMetadata(player.el()); videoMetadata(player.el());
    expect(media.engine.on).toHaveBeenCalledTimes(2);
    levels[0]!.enabled = false; levels[1]!.enabled = true;
    await Promise.resolve(); expect(media.engine.currentLevel).toBe(1);
    levels[0]!.enabled = true; levels[1]!.enabled = true;
    await Promise.resolve(); expect(media.engine.currentLevel).toBe(-1);
    expect(player.bandwidth!()).toBe(8000000);
    player.dispose();
  });

  it('清晰度选择排队后切换片源或销毁，不再写入旧引擎', async () => {
    const { player, media } = mounted();
    player.src({ src: '/first.m3u8', type: 'application/vnd.apple.mpegurl' });
    const levels = player.qualityLevels!();
    levels[0]!.enabled = false; levels[1]!.enabled = true;
    player.src({ src: '/second.m3u8', type: 'application/vnd.apple.mpegurl' });
    await Promise.resolve(); expect(media.engine.currentLevel).toBe(-1);
    levels[0]!.enabled = false; levels[1]!.enabled = true;
    player.dispose();
    await Promise.resolve(); expect(media.engine.currentLevel).toBe(-1);
  });

  it('HLS 与 DASH 切源保留原生视频和字幕，销毁停播并解除事件', () => {
    const { video, player, media } = mounted();
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});
    const load = vi.spyOn(video, 'load').mockImplementation(() => {});
    const played = vi.fn(); player.on('play', played);
    video.dispatchEvent(new Event('play')); expect(played).toHaveBeenCalledOnce();
    const track = document.createElement('track'); track.label = '中文'; video.append(track);
    player.src({ src: '/example.mpd', type: 'application/dash+xml' });
    expect(media.adapter.destroy).toHaveBeenCalledOnce();
    expect(player.el().querySelector('dash-video > video')).toBe(video);
    expect(video.querySelector('track')).toBe(track);
    player.dispose(); player.dispose();
    expect(pause).toHaveBeenCalledOnce(); expect(load).toHaveBeenCalledOnce();
    video.dispatchEvent(new Event('play')); expect(played).toHaveBeenCalledOnce();
    expect(document.querySelector('.video-js')).toBeNull();
  });

  it('等待后播放时间往前走就收起转圈，缓冲还够时的 stalled 不显示转圈', () => {
    const { video, player } = mounted(), root = player.el();
    let time = 10, ready = 4;
    Object.defineProperty(video, 'currentTime', { get: () => time, configurable: true });
    Object.defineProperty(video, 'readyState', { get: () => ready, configurable: true });
    video.dispatchEvent(new Event('stalled'));
    expect(root.classList.contains('vjs-waiting')).toBe(false);
    ready = 2; video.dispatchEvent(new Event('waiting'));
    expect(root.classList.contains('vjs-waiting')).toBe(true);
    video.dispatchEvent(new Event('timeupdate'));
    expect(root.classList.contains('vjs-waiting')).toBe(true);
    time = 10.25; ready = 4; video.dispatchEvent(new Event('timeupdate'));
    expect(root.classList.contains('vjs-waiting')).toBe(false);
    player.dispose();
  });
});

function videoMetadata(root: HTMLElement) { root.querySelector('video')!.dispatchEvent(new Event('loadedmetadata')) }

describe('移动设备全屏方向', () => {
  afterEach(() => { Reflect.deleteProperty(document, 'fullscreenElement'); Reflect.deleteProperty(document, 'webkitFullscreenElement') });
  function environment(userAgent = 'Android', coarse = true, platform = 'Linux', touches = 5) {
    const lock = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(undefined);
    const unlock = vi.fn();
    vi.stubGlobal('screen', { orientation: { lock, unlock } });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
    vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(touches);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: coarse })));
    let fullscreen: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
    const enter = (element: Element | null) => {
      fullscreen = element;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    return { lock, unlock, enter };
  }

  it.each([
    ['Android phone', true, 'Linux'],
    ['Android tablet', false, 'Linux'],
    ['iPhone', true, 'iPhone'],
    ['Macintosh', false, 'MacIntel'],
  ] as const)('%s 进入自己的全屏后请求横屏，重复事件不重复锁定，退出时释放', async (ua, coarse, platform) => {
    const { lock, unlock, enter } = environment(ua, coarse, platform);
    const { player } = mounted();
    const changed = vi.fn(); player.on('fullscreenchange', changed);
    try {
      expect(lock).not.toHaveBeenCalled();
      enter(document.body);
      expect(player.isFullscreen()).toBe(false);
      expect(lock).not.toHaveBeenCalled();
      enter(player.el().querySelector('media-container'));
      expect(player.isFullscreen()).toBe(true);
      expect(player.el().classList.contains('vjs-fullscreen')).toBe(true);
      expect(lock).toHaveBeenCalledWith('landscape');
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(lock).toHaveBeenCalledOnce();
      await Promise.resolve();
      enter(null);
      expect(player.isFullscreen()).toBe(false);
      expect(player.el().classList.contains('vjs-fullscreen')).toBe(false);
      expect(unlock).toHaveBeenCalledOnce();
      expect(changed).toHaveBeenCalledTimes(4);
    } finally { player.dispose() }
  });

  it('桌面浏览器全屏同步状态但不改变方向', () => {
    const { lock, enter } = environment('Windows', false, 'Win32', 0);
    const { player } = mounted();
    try {
      enter(player.el());
      expect(player.isFullscreen()).toBe(true);
      expect(lock).not.toHaveBeenCalled();
    } finally { player.dispose() }
  });

  it.each(['missing', 'rejected', 'throws'] as const)('方向 API %s 时保持全屏且正常退出', async mode => {
    const { lock, unlock, enter } = environment();
    if (mode === 'missing') vi.stubGlobal('screen', {});
    else if (mode === 'rejected') lock.mockRejectedValue(new DOMException('', 'NotSupportedError'));
    else lock.mockImplementation(() => { throw new DOMException('', 'SecurityError') });
    const { player } = mounted();
    try {
      enter(player.el()); await Promise.resolve();
      expect(player.isFullscreen()).toBe(true);
      enter(null);
      expect(player.isFullscreen()).toBe(false);
      expect(unlock).not.toHaveBeenCalled();
    } finally { player.dispose() }
  });

  it.each(['exit', 'dispose'] as const)('锁定尚未完成时 %s 释放方向并清理迟到的成功回执', async action => {
    const { lock, unlock, enter } = environment();
    let resolve!: () => void;
    lock.mockReturnValue(new Promise<void>(done => { resolve = done }));
    const { player } = mounted();
    try {
      enter(player.el());
      if (action === 'exit') enter(null); else player.dispose();
      expect(unlock).toHaveBeenCalledOnce();
      resolve(); await Promise.resolve();
      expect(unlock).toHaveBeenCalledTimes(2);
      expect(player.isFullscreen()).toBe(false);
    } finally { player.dispose() }
  });

  it('快速切换播放器时旧请求的回执不释放新播放器的方向锁', async () => {
    const { lock, unlock, enter } = environment();
    let resolve!: () => void;
    lock.mockReturnValueOnce(new Promise<void>(done => { resolve = done }));
    const first = mounted().player, second = mounted().player;
    try {
      enter(first.el()); enter(second.el());
      expect(unlock).toHaveBeenCalledOnce();
      resolve(); await Promise.resolve();
      expect(unlock).toHaveBeenCalledOnce();
      expect(second.isFullscreen()).toBe(true);
      enter(null);
      expect(unlock).toHaveBeenCalledTimes(2);
    } finally { first.dispose(); second.dispose() }
  });

  it('Safari 原生全屏进入和退出与 Peach 状态一致，销毁后不再处理事件', async () => {
    const { lock, unlock } = environment('iPad');
    const { video, player } = mounted();
    video.dispatchEvent(new Event('webkitbeginfullscreen'));
    expect(player.isFullscreen()).toBe(true);
    expect(player.el().classList.contains('vjs-fullscreen')).toBe(true);
    expect(lock).toHaveBeenCalledWith('landscape');
    await Promise.resolve();
    video.dispatchEvent(new Event('webkitendfullscreen'));
    expect(player.isFullscreen()).toBe(false);
    expect(unlock).toHaveBeenCalledOnce();
    player.dispose();
    video.dispatchEvent(new Event('webkitbeginfullscreen'));
    expect(lock).toHaveBeenCalledOnce();
  });

  it('Safari 前缀全屏和 presentation mode 事件都同步状态', async () => {
    const { lock, unlock } = environment('iPad');
    const { video, player } = mounted();
    try {
      Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, value: player.el() });
      document.dispatchEvent(new Event('webkitfullscreenchange'));
      expect(player.isFullscreen()).toBe(true);
      await Promise.resolve();
      Reflect.deleteProperty(document, 'webkitFullscreenElement');
      document.dispatchEvent(new Event('webkitfullscreenchange'));
      expect(unlock).toHaveBeenCalledOnce();
      Object.assign(video, { webkitPresentationMode: 'fullscreen' });
      video.dispatchEvent(new Event('webkitbeginfullscreen'));
      video.dispatchEvent(new Event('webkitpresentationmodechanged'));
      expect(player.isFullscreen()).toBe(true);
      expect(lock).toHaveBeenCalledTimes(2);
      await Promise.resolve();
      Object.assign(video, { webkitPresentationMode: 'inline' });
      video.dispatchEvent(new Event('webkitpresentationmodechanged'));
      expect(player.isFullscreen()).toBe(false);
      expect(unlock).toHaveBeenCalledTimes(2);
    } finally { player.dispose() }
  });
});
