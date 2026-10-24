/* 触摸手势使用原生媒体状态；拖动只预览，松手才定位，避免远程片源反复缓冲。 */
export function wirePlayerInteractions(root: HTMLElement, video: HTMLVideoElement, signal: AbortSignal,
  duration: () => number = () => video.duration, touchEnabled = true) {
  const feedback = document.createElement('div');
  feedback.className = 'vjs-peach-gesture'; feedback.hidden = true;
  feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  root.querySelector('media-container')?.append(feedback);
  let idle: ReturnType<typeof setTimeout> | undefined;
  let hold: ReturnType<typeof setTimeout> | undefined;
  let tap: ReturnType<typeof setTimeout> | undefined;
  let message: ReturnType<typeof setTimeout> | undefined;
  let lastTap: { at: number; zone: number } | null = null;
  let ignoreClickUntil = 0;
  const pointers = new Set<number>();
  let gesture: { id: number; x: number; y: number; width: number; height: number; from: number;
    volume: number; muted: boolean; axis: '' | 'seek' | 'volume' | 'scroll' | 'hold'; to?: number | undefined; rate?: number;
    menu: boolean; visible: boolean; volumeSupported?: boolean } | null = null;
  const clock = (seconds: number) => {
    const value = Math.max(0, Math.round(seconds));
    return `${Math.floor(value / 3600) ? `${Math.floor(value / 3600)}:` : ''}${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };
  const menuOpen = () => !!root.querySelector('[aria-expanded="true"]');
  const show = () => { root.classList.add('vjs-user-active'); root.classList.remove('vjs-user-inactive') };
  const hide = () => { root.classList.remove('vjs-user-active'); root.classList.add('vjs-user-inactive') };
  const active = () => {
    show(); clearTimeout(idle);
    if (!video.paused && !video.ended) idle = setTimeout(() => {
      if (gesture || pointers.size || menuOpen()) { active(); return }
      hide();
    }, root.dataset.playerInput === 'touch' ? 3000 : 2500);
  };
  const tell = (text: string, persistent = false) => {
    clearTimeout(message); feedback.textContent = text; feedback.hidden = false;
    if (!persistent) message = setTimeout(() => { feedback.hidden = true }, 1000);
  };
  const surface = (event: Event) => !event.composedPath().some(node => node instanceof Element &&
    node !== root && node.matches('.vjs-control-bar,.vjs-peach-settings,.vjs-peach-panel,[role="menu"],button,a,input,select,textarea,[role="slider"],[role="button"],media-slider-thumb'));
  const clamp = (time: number) => {
    const total = duration();
    if (!Number.isFinite(total) || total <= 0) return null;
    const bounded = Math.min(Math.max(0, time), Math.max(0, total - .1));
    const ranges = video.seekable;
    if (!ranges.length) return bounded;
    let nearest = bounded, distance = Infinity;
    for (let at = 0; at < ranges.length; at++) {
      const point = Math.min(Math.max(ranges.start(at), bounded), Math.max(ranges.start(at), ranges.end(at) - .1));
      if (Math.abs(point - bounded) < distance) { nearest = point; distance = Math.abs(point - bounded) }
    }
    return nearest;
  };
  const seek = (time: number) => {
    const target = clamp(time);
    if (target === null) { tell('时长尚未取得，暂时无法跳转'); return }
    try { video.currentTime = target } catch { tell('暂时无法跳转，请稍后重试'); return }
    tell(`跳转到 ${clock(target)}`);
  };
  const cancel = () => {
    clearTimeout(hold); clearTimeout(tap); lastTap = null;
    if (gesture?.rate !== undefined) video.playbackRate = gesture.rate;
    if (gesture?.axis === 'volume') { video.volume = gesture.volume; video.muted = gesture.muted }
    gesture = null; pointers.clear(); feedback.hidden = true; clearTimeout(message);
    active();
  };
  root.addEventListener('pointerdown', event => {
    if (!touchEnabled) return;
    if (event.pointerType !== 'touch') {
      cancel(); root.dataset.playerInput = 'mouse'; ignoreClickUntil = 0; active(); return;
    }
    const visible = root.classList.contains('vjs-user-active');
    root.dataset.playerInput = 'touch'; pointers.add(event.pointerId); active();
    if (pointers.size !== 1) { cancel(); pointers.add(event.pointerId); return }
    if (!surface(event)) return;
    ignoreClickUntil = Date.now() + 1000;
    const rect = root.getBoundingClientRect();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1), from: video.currentTime, volume: video.volume, muted: video.muted,
      axis: '', menu: menuOpen(), visible };
    root.setPointerCapture?.(event.pointerId);
    if (gesture.menu) return;
    hold = setTimeout(() => {
      if (!gesture || gesture.axis || video.paused || video.ended) return;
      clearTimeout(tap); lastTap = null;
      gesture.axis = 'hold'; gesture.rate = video.playbackRate;
      video.playbackRate = Math.max(2, gesture.rate); tell(`${video.playbackRate}× 倍速 · 松手恢复`, true);
    }, 500);
  }, { signal, capture: true });
  root.addEventListener('pointermove', event => {
    if (!touchEnabled || event.pointerType !== 'touch') { active(); return }
    const current = gesture;
    if (!current || current.id !== event.pointerId || current.menu || current.axis === 'hold') return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (!current.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      clearTimeout(hold); clearTimeout(tap); lastTap = null;
      const full = !!document.fullscreenElement && root.contains(document.fullscreenElement)
        || root.matches('.vjs-fullscreen,.vjs-full-window,[data-peach-fullscreen]') || document.body.classList.contains('vjs-full-window');
      current.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'seek'
        : full && current.x - root.getBoundingClientRect().left > current.width / 2 ? 'volume' : 'scroll';
    }
    if (current.axis === 'seek') {
      event.preventDefault(); current.to = clamp(current.from + dx / current.width * 1200) ?? undefined;
      if (current.to === undefined) { tell('时长尚未取得，暂时无法跳转', true); return }
      const delta = current.to - current.from;
      tell(`${delta >= 0 ? '快进' : '快退'} ${clock(Math.abs(delta))}　${clock(current.to)} / ${clock(duration())} · 松手跳转`, true);
    } else if (current.axis === 'volume') {
      event.preventDefault();
      const volume = Math.max(0, Math.min(1, current.volume - dy / current.height));
      try { video.volume = volume; video.muted = volume === 0 } catch { /* 部分移动浏览器仅支持系统音量键。 */ }
      current.volumeSupported = Math.abs(video.volume - volume) < .01;
      tell(current.volumeSupported ? `音量 ${Math.round(video.volume * 100)}%` : '此浏览器请用设备音量键', true);
    }
  }, { signal, passive: false });
  window.addEventListener('pointerup', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (event.pointerType !== 'touch') return;
    const current = gesture;
    if (!current || current.id !== event.pointerId) { active(); return }
    clearTimeout(hold); gesture = null; ignoreClickUntil = Date.now() + 1000;
    root.releasePointerCapture?.(event.pointerId);
    if (current.rate !== undefined) video.playbackRate = current.rate;
    if (current.axis === 'seek' && current.to !== undefined) seek(current.to);
    else if (current.axis === 'hold' || current.axis === 'volume') {
      message = setTimeout(() => { feedback.hidden = true }, 700);
    } else if (!current.axis && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 12) {
      if (current.menu) { active(); return }
      const position = (current.x - root.getBoundingClientRect().left) / current.width;
      const zone = position < .35 ? -1 : position > .65 ? 1 : 0;
      if (lastTap && Date.now() - lastTap.at < 300 && lastTap.zone === zone) {
        clearTimeout(tap); lastTap = null; if (zone) seek(video.currentTime + zone * 10);
      } else {
        clearTimeout(tap); lastTap = { at: Date.now(), zone };
        tap = setTimeout(() => {
          lastTap = null;
          if (!video.paused && !video.ended && current.visible && !menuOpen()) { clearTimeout(idle); hide() } else active();
        }, 300);
      }
    }
    // 单击的显隐由双击窗口结束后决定，其余手势结束重新开始隐藏计时。
    if (!lastTap) active();
  }, { signal });
  root.addEventListener('pointercancel', () => { ignoreClickUntil = Date.now() + 1000; cancel() }, { signal });
  root.addEventListener('lostpointercapture', () => { if (gesture) cancel() }, { signal });
  root.addEventListener('click', event => {
    if (!touchEnabled) return;
    if (!surface(event)) { active(); return }
    if ((event as PointerEvent).pointerType === 'touch' || Date.now() < ignoreClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
  }, { signal, capture: true });
  video.addEventListener('click', () => {
    if (video.paused) void video.play().catch(() => {}); else video.pause();
  }, { signal });
  root.addEventListener('dblclick', event => {
    if (!surface(event)) return;
    if (Date.now() < ignoreClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return }
    if (event.target === video) root.querySelector<HTMLElement>('media-fullscreen-button')?.click();
  }, { signal, capture: true });
  root.addEventListener('focusin', active, { signal });
  root.addEventListener('peach-touch-cancel', cancel, { signal });
  root.addEventListener('contextmenu', event => {
    if (root.dataset.playerInput === 'touch' && surface(event)) event.preventDefault();
  }, { signal });
  window.addEventListener('blur', cancel, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel() }, { signal });
  for (const name of ['loadstart', 'emptied']) video.addEventListener(name, cancel, { signal });
  const observer = new MutationObserver(() => { if (menuOpen()) active() });
  observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
  signal.addEventListener('abort', () => {
    cancel(); clearTimeout(idle); observer.disconnect(); feedback.remove();
  }, { once: true });
  return { active, cancel };
}
