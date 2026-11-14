/* 横版视频在手机、平板上点播放时自动进全屏（#618，设置「横版视频自动全屏」，默认关）。
 *
 * 浏览器只许在用户操作之后进全屏，所以只认紧跟在一次触摸之后的 `play`：自动播放、键盘与鼠标都不触发。
 * 横竖按 `videoWidth/videoHeight` 判断，元数据还没到就不进。用户自己退出全屏后，同一片源不再自动进；
 * 换片源后重新算。进全屏走控制条上的全屏按钮，方向锁和 Safari 原生全屏由 `fullscreen.ts` 处理。 */
import { mobileScreen } from './fullscreen';
import { gestureSettings } from './gesture-settings';

/** 触摸抬起后多久之内的 `play` 算这次触摸引起的。 */
const GESTURE_MS = 1000;

export function mountAutoFullscreen(
  root: HTMLElement, video: HTMLVideoElement, isFullscreen: () => boolean, signal: AbortSignal,
): void {
  let touchedAt = -Infinity, done = false;
  root.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch') touchedAt = performance.now();
  }, { signal, capture: true });
  video.addEventListener('loadstart', () => { done = false }, { signal });
  video.addEventListener('play', () => {
    if (done || performance.now() - touchedAt > GESTURE_MS) return;
    if (!gestureSettings().autoFullscreen || !mobileScreen() || isFullscreen()) return;
    if (!video.videoWidth || video.videoWidth <= video.videoHeight) return;
    done = true;
    root.querySelector<HTMLElement>('media-fullscreen-button')?.click();
  }, { signal });
}
