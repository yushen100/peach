import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountAutoFullscreen } from '../src/player/auto-fullscreen';
import { DEFAULT_GESTURES, configureGestureSettings } from '../src/player/gesture-settings';

function fixture({ enabled = true, coarse = true, width = 1920, height = 1080 } = {}) {
  configureGestureSettings(() => ({ autoFullscreen: enabled }));
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: coarse })));
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(coarse ? 'Android' : 'Windows');
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(coarse ? 5 : 0);
  const root = document.createElement('div');
  root.innerHTML = '<video></video><media-fullscreen-button></media-fullscreen-button>';
  document.body.append(root);
  const video = root.querySelector('video')!;
  Object.defineProperties(video, { videoWidth: { value: width }, videoHeight: { value: height } });
  const button = root.querySelector<HTMLElement>('media-fullscreen-button')!;
  const enter = vi.fn(); button.addEventListener('click', enter);
  let fullscreen = false;
  const abort = new AbortController();
  mountAutoFullscreen(root, video, () => fullscreen, abort.signal);
  const touchPlay = (type = 'touch') => {
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: type }));
    video.dispatchEvent(new Event('play'));
  };
  return { video, enter, touchPlay, abort, setFullscreen: (value: boolean) => { fullscreen = value } };
}

afterEach(() => {
  configureGestureSettings(() => DEFAULT_GESTURES);
  vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren();
});

describe('横版视频自动全屏', () => {
  it('触屏上点播放的横版视频进全屏一次；退出后同一片源不再进，换片源后重新算', () => {
    const { video, enter, touchPlay, abort } = fixture();
    touchPlay(); expect(enter).toHaveBeenCalledOnce();
    touchPlay(); expect(enter).toHaveBeenCalledOnce();
    video.dispatchEvent(new Event('loadstart'));
    touchPlay(); expect(enter).toHaveBeenCalledTimes(2);
    abort.abort();
  });

  it.each([
    ['默认关', { enabled: false }],
    ['竖版视频', { width: 1080, height: 1920 }],
    ['桌面浏览器', { coarse: false }],
  ] as const)('%s不进全屏', (_name, options) => {
    const { enter, touchPlay, abort } = fixture(options);
    touchPlay(); expect(enter).not.toHaveBeenCalled(); abort.abort();
  });

  it('不是紧跟触摸的播放（自动播放、鼠标）与已在全屏时都不进', () => {
    const { video, enter, touchPlay, setFullscreen, abort } = fixture();
    video.dispatchEvent(new Event('play'));
    touchPlay('mouse');
    setFullscreen(true); touchPlay();
    expect(enter).not.toHaveBeenCalled(); abort.abort();
  });
});
