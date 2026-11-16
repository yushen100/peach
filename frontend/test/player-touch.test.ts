import { afterEach, describe, expect, it, vi } from 'vitest';
import { wirePlayerInteractions } from '../src/player/touch-controls';
import { DEFAULT_GESTURES, configureGestureSettings, normalizeGestures } from '../src/player/gesture-settings';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren() });
function fixture(paused = false, touchEnabled = true) {
  vi.useFakeTimers();
  const root = document.createElement('div'); root.className = 'video-js vjs-user-active';
  root.innerHTML = '<media-container><video></video><div class="vjs-control-bar"><button>播放</button></div></media-container>';
  document.body.append(root);
  const video = root.querySelector('video')!;
  Object.defineProperties(video, { paused: { configurable: true, value: paused }, duration: { value: 7200 } });
  video.currentTime = 1200; video.volume = .5;
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, width: 1000, height: 600, left: 0, top: 0, right: 1000, bottom: 600, toJSON() {} });
  const abort = new AbortController(), interactions = wirePlayerInteractions(root, video, abort.signal, () => video.duration, touchEnabled);
  const pointer = (name: string, x = 500, y = 300, type = 'touch', id = 1, target: Element = video) => {
    target.dispatchEvent(new PointerEvent(name, { bubbles: true, cancelable: true, pointerType: type, pointerId: id, clientX: x, clientY: y }));
  };
  const click = () => video.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const tap = (x = 500) => { pointer('pointerdown', x); pointer('pointerup', x); click() };
  return { root, video, abort, interactions, pointer, tap, click,
    feedback: () => root.querySelector<HTMLElement>('.vjs-peach-gesture')! };
}

describe('播放器按实际输入区分触摸和鼠标', () => {
  it('外部接管手势的无控制条播放器不接管触摸，画面单击也交给宿主', () => {
    const { video, root, pointer, click, abort } = fixture(false, false); const pause = vi.spyOn(video, 'pause');
    pointer('pointerdown', 100); pointer('pointermove', 800); pointer('pointerup', 800);
    expect(video.currentTime).toBe(1200); expect(root.dataset.playerInput).toBeUndefined();
    click(); expect(pause).not.toHaveBeenCalled(); abort.abort();
  });
  it('鼠标点击的中央提示在媒体状态切换前取值', () => {
    const { video, root, click, abort } = fixture(); let paused = false;
    Object.defineProperty(video, 'paused', { get: () => paused });
    vi.spyOn(video, 'pause').mockImplementation(() => { paused = true });
    const states: boolean[] = []; root.addEventListener('click', () => states.push(video.paused), true);
    click(); expect(states).toEqual([false]); expect(video.paused).toBe(true); abort.abort();
  });
  it('触摸仅切换控制条；合成点击不暂停、不触发中心暂停提示', () => {
    const { root, video, tap, abort } = fixture(); const pause = vi.spyOn(video, 'pause');
    const bezel = vi.fn(); root.addEventListener('click', bezel, true);
    tap(); vi.advanceTimersByTime(300); expect(root.classList.contains('vjs-user-inactive')).toBe(true);
    tap(); vi.advanceTimersByTime(300); expect(root.classList.contains('vjs-user-active')).toBe(true);
    expect(pause).not.toHaveBeenCalled(); expect(bezel).not.toHaveBeenCalled(); abort.abort();
  });
  it('暂停时轻触不播放，控制条持续显示；触摸按钮仍可点击', () => {
    const { root, video, tap, pointer, abort } = fixture(true); const play = vi.spyOn(video, 'play');
    tap(); vi.advanceTimersByTime(4000); expect(play).not.toHaveBeenCalled();
    expect(root.classList.contains('vjs-user-active')).toBe(true);
    const button = root.querySelector('button')!, action = vi.fn(); button.onclick = action;
    pointer('pointerdown', 10, 10, 'touch', 2, button); pointer('pointerup', 10, 10, 'touch', 2, button);
    button.click(); expect(action).toHaveBeenCalledOnce(); abort.abort();
  });
  it('横滑一屏跳二十分钟，预览期间不定位，松手提交，前后均限制在片内', () => {
    const { video, pointer, feedback, abort } = fixture(true);
    pointer('pointerdown', 100); pointer('pointermove', 600);
    expect(video.currentTime).toBe(1200); expect(feedback().textContent).toContain('30:00');
    expect(feedback().textContent).toContain('10:00'); pointer('pointerup', 600);
    expect(video.currentTime).toBe(1800); expect(video.paused).toBe(true);
    pointer('pointerdown', 900); pointer('pointermove', -10000); pointer('pointerup', -10000);
    expect(video.currentTime).toBe(0);
    pointer('pointerdown', 100); pointer('pointermove', 20000); pointer('pointerup', 20000);
    expect(video.currentTime).toBeCloseTo(7199.9); abort.abort();
  });
  it('双击左右区域快退／快进十秒，触摸双击不进入全屏', () => {
    const { video, tap, root, abort } = fixture();
    const fullscreen = document.createElement('media-fullscreen-button'); root.append(fullscreen);
    const enter = vi.fn(); fullscreen.onclick = enter;
    tap(100); tap(100); expect(video.currentTime).toBe(1190);
    video.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); expect(enter).not.toHaveBeenCalled();
    tap(900); tap(900); expect(video.currentTime).toBe(1200); abort.abort();
  });
  it.each(['pointerup', 'pointercancel', 'source', 'dispose', 'multitouch'])('长按结束（%s）恢复用户原来的倍速', ending => {
    const { video, pointer, abort } = fixture(); video.playbackRate = 1.5;
    pointer('pointerdown'); vi.advanceTimersByTime(500); expect(video.playbackRate).toBe(2);
    if (ending === 'source') video.dispatchEvent(new Event('loadstart'));
    else if (ending === 'dispose') abort.abort();
    else if (ending === 'multitouch') pointer('pointerdown', 700, 300, 'touch', 2);
    else pointer(ending);
    expect(video.playbackRate).toBe(1.5); abort.abort();
  });
  it('长按左侧回退：画面停住，目标每秒回退两秒，松手定位并接着播', () => {
    const { video, pointer, feedback, abort } = fixture();
    let paused = false;
    Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
    vi.spyOn(video, 'pause').mockImplementation(() => { paused = true });
    const play = vi.spyOn(video, 'play').mockImplementation(() => { paused = false; return Promise.resolve() });
    video.playbackRate = 1;
    pointer('pointerdown', 100); vi.advanceTimersByTime(500);
    expect(paused).toBe(true); expect(video.playbackRate).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(video.currentTime).toBe(1200); expect(feedback().textContent).toContain('19:54');
    pointer('pointerup', 100);
    expect(video.currentTime).toBeCloseTo(1194, 0); expect(play).toHaveBeenCalledOnce(); abort.abort();
  });
  it('长按左侧回退中途取消不定位；换片源取消时不再起播', () => {
    const { video, pointer, abort } = fixture();
    let paused = false;
    Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
    vi.spyOn(video, 'pause').mockImplementation(() => { paused = true });
    const play = vi.spyOn(video, 'play').mockImplementation(() => { paused = false; return Promise.resolve() });
    pointer('pointerdown', 100); vi.advanceTimersByTime(2000); pointer('pointercancel');
    expect(video.currentTime).toBe(1200); expect(play).toHaveBeenCalledOnce();
    pointer('pointerdown', 100); vi.advanceTimersByTime(2000); video.dispatchEvent(new Event('loadstart'));
    expect(video.currentTime).toBe(1200); expect(play).toHaveBeenCalledOnce(); abort.abort();
  });
  it('暂停时长按左侧也能回退，松手后保持暂停', () => {
    const { video, pointer, abort } = fixture(true); const play = vi.spyOn(video, 'play');
    pointer('pointerdown', 100); vi.advanceTimersByTime(5500); pointer('pointerup', 100);
    expect(video.currentTime).toBeCloseTo(1190, 0); expect(play).not.toHaveBeenCalled(); abort.abort();
  });
  it('滑动、系统取消与多指手势都不会提交待预览的跳转', () => {
    const { video, pointer, abort } = fixture();
    pointer('pointerdown'); pointer('pointermove', 900); pointer('pointercancel');
    expect(video.currentTime).toBe(1200);
    pointer('pointerdown'); pointer('pointermove', 900); pointer('pointerdown', 800, 300, 'touch', 2); pointer('pointerup', 900);
    expect(video.currentTime).toBe(1200); abort.abort();
  });
  it('全屏右侧竖滑调音量，普通页面竖滑保留滚动；取消恢复原音量', () => {
    const { root, video, pointer, abort } = fixture();
    pointer('pointerdown', 800); pointer('pointermove', 800, 100); pointer('pointerup', 800, 100);
    expect(video.volume).toBe(.5);
    root.classList.add('vjs-fullscreen'); pointer('pointerdown', 800); pointer('pointermove', 800, 180);
    expect(video.volume).toBeCloseTo(.7); pointer('pointercancel'); expect(video.volume).toBe(.5); abort.abort();
  });
  it('菜单、进度条操作期间不隐藏，打开的菜单外轻触只收起菜单', async () => {
    const { root, tap, interactions, pointer, abort } = fixture();
    const button = root.querySelector('button')!; button.setAttribute('aria-expanded', 'true');
    interactions.active(); vi.advanceTimersByTime(4000); expect(root.classList.contains('vjs-user-active')).toBe(true);
    pointer('pointerdown'); button.setAttribute('aria-expanded', 'false'); pointer('pointerup');
    vi.advanceTimersByTime(300); expect(root.classList.contains('vjs-user-active')).toBe(true);
    tap(); vi.advanceTimersByTime(300); expect(root.classList.contains('vjs-user-inactive')).toBe(true); abort.abort();
  });
  it('鼠标左键长按画面临时倍速，松手恢复，随后那一下 click 不切播放；没动过的单击照旧暂停', () => {
    const { video, pointer, click, abort } = fixture(); const pause = vi.spyOn(video, 'pause');
    video.playbackRate = 1.25;
    pointer('pointerdown', 600, 300, 'mouse'); vi.advanceTimersByTime(500);
    expect(video.playbackRate).toBe(2);
    pointer('pointerup', 600, 300, 'mouse'); click();
    expect(video.playbackRate).toBe(1.25); expect(pause).not.toHaveBeenCalled();
    pointer('pointerdown', 600, 300, 'mouse'); pointer('pointerup', 600, 300, 'mouse'); click();
    expect(pause).toHaveBeenCalledOnce(); abort.abort();
  });
  it('鼠标横向拖动画面预览定位，松手才跳；竖向拖动、右键与控件上按下都不起手势', () => {
    const { root, video, pointer, click, abort } = fixture(true); const play = vi.spyOn(video, 'play');
    pointer('pointerdown', 100, 300, 'mouse'); pointer('pointermove', 600, 300, 'mouse');
    expect(video.currentTime).toBe(1200);
    pointer('pointerup', 600, 300, 'mouse'); click();
    expect(video.currentTime).toBe(1800); expect(play).not.toHaveBeenCalled();
    pointer('pointerdown', 500, 100, 'mouse'); pointer('pointermove', 500, 500, 'mouse'); pointer('pointerup', 500, 500, 'mouse');
    expect(video.currentTime).toBe(1800);
    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 2, clientX: 600, clientY: 300 }));
    vi.advanceTimersByTime(600); expect(video.playbackRate).toBe(1);
    const button = root.querySelector('button')!;
    pointer('pointerdown', 10, 10, 'mouse', 1, button); pointer('pointermove', 600, 10, 'mouse', 1, button); pointer('pointerup', 600, 10, 'mouse', 1, button);
    expect(video.currentTime).toBe(1800); abort.abort();
  });
  it('关掉触摸手势后鼠标在画面上也不起手势', () => {
    configureGestureSettings(() => ({ touchGestures: false }));
    const { video, pointer, abort } = fixture();
    pointer('pointerdown', 600, 300, 'mouse'); vi.advanceTimersByTime(600);
    expect(video.playbackRate).toBe(1); pointer('pointerup', 600, 300, 'mouse');
    configureGestureSettings(() => DEFAULT_GESTURES); abort.abort();
  });
  it('触摸后用鼠标仍然点击暂停、双击全屏', () => {
    const { root, video, tap, pointer, click, abort } = fixture(); const pause = vi.spyOn(video, 'pause');
    tap(); pointer('pointerdown', 500, 300, 'mouse'); click(); expect(pause).toHaveBeenCalledOnce();
    const button = document.createElement('media-fullscreen-button'), enter = vi.fn(); button.onclick = enter; root.append(button);
    video.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); expect(enter).toHaveBeenCalledOnce(); abort.abort();
  });
});

describe('手势数值按设置', () => {
  afterEach(() => configureGestureSettings(() => DEFAULT_GESTURES));
  it('长按倍速、拖动比例、双击区域与跳转秒数都读设置', () => {
    configureGestureSettings(() => ({ holdRate: 3, swipeMinutes: 10, doubleTapPercent: 20, seekSeconds: 30 }));
    const { video, pointer, tap, abort } = fixture();
    pointer('pointerdown', 500); vi.advanceTimersByTime(500);
    expect(video.playbackRate).toBe(3); pointer('pointerup', 500);
    expect(video.playbackRate).toBe(1);
    pointer('pointerdown', 100); pointer('pointermove', 600); pointer('pointerup', 600);
    expect(video.currentTime).toBe(1500);
    tap(250); tap(250); expect(video.currentTime).toBe(1500);
    tap(150); tap(150); expect(video.currentTime).toBe(1470);
    tap(900); tap(900); expect(video.currentTime).toBe(1500);
    abort.abort();
  });
  it('双击中间切换播放', () => {
    const { video, tap, abort } = fixture();
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});
    tap(500); tap(500); expect(pause).toHaveBeenCalledOnce(); abort.abort();
  });
  it('关掉触摸手势后拖动与长按都不接管，轻点照鼠标单击切换播放', () => {
    configureGestureSettings(() => ({ touchGestures: false }));
    const { video, pointer, tap, abort } = fixture();
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});
    pointer('pointerdown', 100); vi.advanceTimersByTime(600); pointer('pointermove', 600); pointer('pointerup', 600);
    expect(video.currentTime).toBe(1200); expect(video.playbackRate).toBe(1);
    tap(500); expect(pause).toHaveBeenCalledOnce();
    abort.abort();
  });
  it('坏值收回可用范围', () => {
    expect(normalizeGestures({ holdRate: 99, swipeMinutes: -1, doubleTapPercent: Number.NaN }))
      .toEqual({ ...DEFAULT_GESTURES, holdRate: 4, swipeMinutes: 1 });
  });
});

describe('指针捕获失败', () => {
  it('系统已收回指针、捕获抛错时长按与拖动照常完成', () => {
    const { root, video, pointer, abort } = fixture();
    const lost = () => { throw new DOMException('', 'NotFoundError') };
    Object.assign(root, { setPointerCapture: lost, releasePointerCapture: lost });
    pointer('pointerdown', 500); vi.advanceTimersByTime(500);
    expect(video.playbackRate).toBe(2); pointer('pointerup', 500);
    expect(video.playbackRate).toBe(1);
    pointer('pointerdown', 100); pointer('pointermove', 600); pointer('pointerup', 600);
    expect(video.currentTime).toBe(1800);
    abort.abort();
  });
});
