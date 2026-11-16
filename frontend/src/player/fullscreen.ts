/* 全屏入口由 Video.js 处理；这里同步 Peach 状态，并在触屏设备全屏期间请求横屏。 */
type OrientationLock = ScreenOrientation & { lock?(orientation: 'landscape'): Promise<void> };
type NativeVideo = HTMLVideoElement & { webkitDisplayingFullscreen?: boolean; webkitPresentationMode?: string };

// 方向锁属于整个文档。旧播放器的异步回执不能释放新播放器刚取得的锁。
let orientationOwner: symbol | null = null;

export function mobileScreen(): boolean {
  return matchMedia('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** 请求横屏，返回释放函数；不支持或被拒时安静失败。沉浸模式全屏也用它（#585）。 */
export function lockLandscape(): () => void {
  const orientation = screen.orientation as OrientationLock | undefined;
  if (typeof orientation?.lock !== 'function' || typeof orientation.unlock !== 'function') return () => {};
  const owner = Symbol();
  orientationOwner = owner;
  const unlock = () => {
    try { orientation.unlock() } catch { /* 页面隐藏或浏览器拒绝时保留系统方向。 */ }
  };
  void (async () => {
    try {
      await orientation.lock!('landscape');
      // 请求完成前已退出、销毁且没有新的锁持有者时，清理迟到的结果。
      if (orientationOwner === null) unlock();
    } catch {
      if (orientationOwner === owner) orientationOwner = null;
      // 不支持方向锁定或被系统拒绝时，全屏和播放照常可用。
    }
  })();
  return () => {
    if (orientationOwner !== owner) return;
    orientationOwner = null;
    unlock();
  };
}

export function mountPlayerFullscreen(
  root: HTMLElement, video: NativeVideo, changed: () => void, signal: AbortSignal,
): () => boolean {
  let active = false, nativeFullscreen = false;
  let releaseOrientation: (() => void) | undefined;
  const isFullscreen = () => {
    if (signal.aborted) return false;
    const element = document.fullscreenElement
      || (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;
    return !!(element && root.contains(element)) || nativeFullscreen
      || !!video.webkitDisplayingFullscreen || video.webkitPresentationMode === 'fullscreen';
  };
  const sync = () => {
    const next = isFullscreen();
    root.classList.toggle('vjs-fullscreen', next);
    if (next !== active) {
      active = next;
      releaseOrientation?.();
      releaseOrientation = next && mobileScreen() ? lockLandscape() : undefined;
    }
    changed();
  };
  for (const name of ['fullscreenchange', 'webkitfullscreenchange']) {
    document.addEventListener(name, sync, { signal });
  }
  video.addEventListener('webkitpresentationmodechanged', () => {
    nativeFullscreen = video.webkitPresentationMode === 'fullscreen';
    sync();
  }, { signal });
  video.addEventListener('webkitbeginfullscreen', () => { nativeFullscreen = true; sync() }, { signal });
  video.addEventListener('webkitendfullscreen', () => { nativeFullscreen = false; sync() }, { signal });
  signal.addEventListener('abort', () => { releaseOrientation?.(); root.classList.remove('vjs-fullscreen') }, { once: true });
  sync();
  return isFullscreen;
}
