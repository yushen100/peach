/* 播放手势与触屏全屏的可调数值。设置页「浏览与播放 → 播放」保存在浏览器里，宿主经 `configureGestureSettings`
 * 交进来；没交时用这里的默认值。每次手势开始时现读，改设置不用重开播放器。 */
export interface GestureSettings {
  /** 触摸手势总开关；关掉后触摸只剩浏览器与控制条自带的操作。 */
  touchGestures: boolean;
  /** 长按画面、按住右方向键时的临时倍速。 */
  holdRate: number;
  /** 横向拖过一整个画面宽度对应多少分钟。 */
  swipeMinutes: number;
  /** 双击快进、快退的区域各占画面宽度的百分比，中间剩下的是双击暂停。 */
  doubleTapPercent: number;
  /** 双击与短按右方向键跳多少秒，沿用已有的「快进秒数」。 */
  seekSeconds: number;
  /** 手机、平板上点播放时，横版视频自动进全屏（#618），默认关。 */
  autoFullscreen: boolean;
}

export const DEFAULT_GESTURES: GestureSettings = {
  touchGestures: true, holdRate: 2, swipeMinutes: 20, doubleTapPercent: 35, seekSeconds: 10, autoFullscreen: false,
};

const bounded = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;

/** 把读进来的值收进可用范围；缺项或坏值用默认值。 */
export function normalizeGestures(raw: Partial<GestureSettings> = {}): GestureSettings {
  return {
    touchGestures: raw.touchGestures !== false,
    holdRate: bounded(raw.holdRate, 1.25, 4, DEFAULT_GESTURES.holdRate),
    swipeMinutes: bounded(raw.swipeMinutes, 1, 120, DEFAULT_GESTURES.swipeMinutes),
    doubleTapPercent: bounded(raw.doubleTapPercent, 15, 45, DEFAULT_GESTURES.doubleTapPercent),
    seekSeconds: bounded(raw.seekSeconds, 1, 300, DEFAULT_GESTURES.seekSeconds),
    autoFullscreen: raw.autoFullscreen === true,
  };
}

let provider: () => Partial<GestureSettings> = () => DEFAULT_GESTURES;

export function configureGestureSettings(next: () => Partial<GestureSettings>): void { provider = next }

export function gestureSettings(): GestureSettings {
  try { return normalizeGestures(provider()) } catch { return DEFAULT_GESTURES }
}
