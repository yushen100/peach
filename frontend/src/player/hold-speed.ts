/** 右键短按跳转、长按临时倍速；不写入播放器的持久速度偏好。 */
export function installHoldSpeed(options: {
  activeVideo: () => HTMLVideoElement | null;
  seek: (video: HTMLVideoElement) => void;
}): () => void {
  const lifetime = new AbortController();
  type Hold = {
    video: HTMLVideoElement; started: number; timer: ReturnType<typeof setTimeout>;
    release: AbortController; observer: MutationObserver; badge: HTMLElement | null;
    original: number | null; boosted: number | null;
  };
  let hold: Hold | null = null;
  const blocked = (event: Event) => event.composedPath().some(node => node instanceof HTMLElement
    && (node.isContentEditable || node.matches('input,textarea,select,[role="textbox"],[role="menu"],.vjs-peach-settings-menu,media-volume-slider')
      || (node.getAttribute('role') === 'slider' && !node.closest('media-time-slider'))));
  const consume = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() };
  const reset = () => {
    const current = hold;
    if (!current) return;
    hold = null;
    clearTimeout(current.timer); current.release.abort(); current.observer.disconnect(); current.badge?.remove();
    // 用户在长按期间主动改了速度时，不用旧值覆盖新的选择。
    if (current.original !== null && current.video.playbackRate === current.boosted) {
      current.video.playbackRate = current.original;
    }
  };
  const valid = (current: Hold) => current.video.isConnected && options.activeVideo() === current.video;
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowRight') { if (hold) reset(); return }
    if (hold) { consume(event); return }
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || blocked(event)) return;
    const video = options.activeVideo();
    if (!video || !video.isConnected) return;
    consume(event);
    // 失焦或暂停取消后收到的系统重复键不能重新进入长按。
    if (event.repeat) return;
    const release = new AbortController();
    const observer = new MutationObserver(() => { if (hold && !valid(hold)) reset() });
    const current: Hold = { video, release, observer, started: performance.now(),
      original: null, boosted: null, badge: null, timer: setTimeout(() => {
        if (hold !== current || !valid(current) || video.paused || video.ended) return;
        current.original = video.playbackRate;
        current.boosted = Math.max(2, current.original);
        video.playbackRate = current.boosted;
        const badge = document.createElement('span');
        badge.className = 'vjs-peach-hold-speed'; badge.setAttribute('role', 'status');
        badge.textContent = `${current.boosted}× 快进`;
        (video.closest('media-container') || video.closest('.video-js') || video.parentElement)?.append(badge);
        current.badge = badge;
      }, 350) };
    hold = current;
    for (const name of ['pause', 'ended', 'emptied', 'loadstart']) video.addEventListener(name, reset, { signal: release.signal });
    video.addEventListener('ratechange', () => {
      if (current.boosted !== null && video.playbackRate !== current.boosted) reset();
    }, { signal: release.signal });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  const keyup = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowRight' || !hold) return;
    consume(event);
    const current = hold;
    const short = performance.now() - current.started < 350 && current.original === null && valid(current)
      && !blocked(event) && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    reset();
    if (short) options.seek(current.video);
  };
  const signal = lifetime.signal;
  // 在滑块及站内快捷键之前接管右键，避免同一次按压既跳转又加速。
  window.addEventListener('keydown', keydown, { capture: true, signal });
  window.addEventListener('keyup', keyup, { capture: true, signal });
  window.addEventListener('blur', reset, { signal });
  window.addEventListener('pagehide', reset, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset() }, { signal });
  document.addEventListener('pointerdown', reset, { capture: true, signal });
  document.addEventListener('focusin', event => { if (blocked(event)) reset() }, { signal });
  return () => { reset(); lifetime.abort() };
}
