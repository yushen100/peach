import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installHoldSpeed } from '../src/player/hold-speed';

let dispose: () => void;
let video: HTMLVideoElement;
let active: HTMLVideoElement | null;
let seek = vi.fn<(video: HTMLVideoElement) => void>();
function key(type: string, target: EventTarget = document.body, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent(type, { key: 'ArrowRight', bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event); return event;
}
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div class="video-js"><video></video></div>';
  video = document.querySelector('video')!;
  vi.spyOn(video, 'paused', 'get').mockReturnValue(false);
  video.playbackRate = 1.5;
  active = video; seek = vi.fn<(video: HTMLVideoElement) => void>();
  dispose = installHoldSpeed({ activeVideo: () => active, seek });
});
afterEach(() => { dispose(); vi.restoreAllMocks(); vi.useRealTimers(); document.body.replaceChildren() });

describe('右键临时倍速', () => {
  it('短按松开才跳一次，按下时不改变位置或速度', () => {
    expect(key('keydown').defaultPrevented).toBe(true);
    expect(seek).not.toHaveBeenCalled(); expect(video.playbackRate).toBe(1.5);
    vi.advanceTimersByTime(100); key('keyup');
    expect(seek).toHaveBeenCalledExactlyOnceWith(video);
    vi.advanceTimersByTime(500); expect(video.playbackRate).toBe(1.5);
  });
  it('长按及系统重复键只加速，松开恢复原速，不触发跳转', () => {
    key('keydown'); vi.advanceTimersByTime(350);
    expect(video.playbackRate).toBe(2);
    expect(document.querySelector('.vjs-peach-hold-speed')?.textContent).toBe('2× 快进');
    for (let i = 0; i < 5; i++) key('keydown', document.body, { repeat: true });
    key('keyup');
    expect(video.playbackRate).toBe(1.5); expect(seek).not.toHaveBeenCalled();
    expect(document.querySelector('.vjs-peach-hold-speed')).toBeNull();
  });
  it.each(['blur', 'pagehide'])('%s 恢复速度，后续重复键不重新启动', event => {
    key('keydown'); vi.advanceTimersByTime(350); window.dispatchEvent(new Event(event));
    key('keydown', document.body, { repeat: true }); vi.advanceTimersByTime(500); key('keyup');
    expect(video.playbackRate).toBe(1.5); expect(seek).not.toHaveBeenCalled();
  });
  it.each(['pause', 'ended', 'emptied', 'loadstart'])('%s 中断时恢复并取消跳转', event => {
    key('keydown'); vi.advanceTimersByTime(350); video.dispatchEvent(new Event(event)); key('keyup');
    expect(video.playbackRate).toBe(1.5); expect(seek).not.toHaveBeenCalled();
  });
  it('未达到阈值就失焦不会意外跳转', () => {
    key('keydown'); vi.advanceTimersByTime(100); window.dispatchEvent(new Event('blur'));
    key('keyup'); expect(seek).not.toHaveBeenCalled();
  });
  it('暂停时长按不启动播放、不加速也不跳转', () => {
    vi.spyOn(video, 'paused', 'get').mockReturnValue(true);
    const play = vi.spyOn(video, 'play');
    key('keydown'); vi.advanceTimersByTime(500); key('keyup');
    expect(video.playbackRate).toBe(1.5); expect(seek).not.toHaveBeenCalled(); expect(play).not.toHaveBeenCalled();
  });
  it('原速高于二倍时不会减速，退出保留原速', () => {
    video.playbackRate = 3; key('keydown'); vi.advanceTimersByTime(350);
    expect(video.playbackRate).toBe(3); key('keyup'); expect(video.playbackRate).toBe(3);
  });
  it.each(['input', 'select', 'textarea', 'div[contenteditable]', 'div[role="menu"]', 'media-volume-slider'])('不抢占 %s', selector => {
    const el = document.createElement(selector.split('[')[0]!);
    if (selector.includes('contenteditable')) el.setAttribute('contenteditable', 'true');
    if (selector.includes('role=')) el.setAttribute('role', 'menu');
    document.body.append(el);
    expect(key('keydown', el).defaultPrevented).toBe(false);
    vi.advanceTimersByTime(500); key('keyup', el);
    expect(video.playbackRate).toBe(1.5); expect(seek).not.toHaveBeenCalled();
  });
  it('进度条上的长按在滑块捕获事件前接管，不触发滑块跳转', () => {
    const slider = document.createElement('media-time-slider');
    const thumb = document.createElement('span'); thumb.setAttribute('role', 'slider');
    slider.append(thumb); document.body.append(slider);
    const slide = vi.fn(); slider.addEventListener('keydown', slide, true);
    key('keydown', thumb); vi.advanceTimersByTime(350); key('keyup', thumb);
    expect(slide).not.toHaveBeenCalled(); expect(seek).not.toHaveBeenCalled();
  });
  it('切换当前视频后恢复旧视频，不影响新视频', async () => {
    key('keydown'); vi.advanceTimersByTime(350);
    active = document.createElement('video'); document.body.append(active);
    await Promise.resolve(); key('keyup');
    expect(video.playbackRate).toBe(1.5); expect(seek).not.toHaveBeenCalled();
  });
  it('销毁期间恢复原速，清除所有按键处理', () => {
    key('keydown'); vi.advanceTimersByTime(350); dispose();
    expect(video.playbackRate).toBe(1.5);
    expect(key('keydown').defaultPrevented).toBe(false);
  });
  it('临时倍速期间主动改速不被松键覆盖', () => {
    key('keydown'); vi.advanceTimersByTime(350); video.playbackRate = 1.25;
    video.dispatchEvent(new Event('ratechange')); key('keyup');
    expect(video.playbackRate).toBe(1.25);
    expect(document.querySelector('.vjs-peach-hold-speed')).toBeNull();
  });
});
