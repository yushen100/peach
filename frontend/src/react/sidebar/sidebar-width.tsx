import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMove } from 'react-aria';
import { t } from '../../i18n';

export const SIDEBAR_DEFAULT_WIDTH = 260;
export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_COLLAPSED_WIDTH = 60;
const STORAGE_KEY = 'peach.sidebar.width';
const SNAP_WIDTHS = [SIDEBAR_MIN_WIDTH, SIDEBAR_DEFAULT_WIDTH, 320, 400, SIDEBAR_MAX_WIDTH];
const SNAP_RADIUS = 20;
const SNAP_HOLD = 6;
const SNAP_RELEASE = 12;
const TOGGLE_DISTANCE = 16;
const COLLAPSE_THRESHOLD = SIDEBAR_MIN_WIDTH - TOGGLE_DISTANCE;

export function sidebarWidth(value: number, viewport: number): number {
  const maximum = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, viewport - 504));
  return Math.round(Math.max(SIDEBAR_MIN_WIDTH, Math.min(maximum, value)));
}

function nearbySnap(width: number, maximum: number, radius: number) {
  return SNAP_WIDTHS.find(value => value <= maximum && Math.abs(value - width) <= radius);
}

/** 磁吸区中间锁定宽度，两侧以连续曲线接回手指位置。 */
function magneticWidth(width: number, snap: number) {
  const offset = width - snap;
  const progress = Math.max(0, (Math.abs(offset) - SNAP_HOLD) / (SNAP_RADIUS - SNAP_HOLD));
  const ease = progress * progress * (3 - 2 * progress);
  return snap + offset * ease;
}

/** 固定侧栏复用 React Aria 的鼠标、触屏和键盘移动，松手后保存浏览器偏好。 */
export function SidebarWidth({ drawer, openDrawer }: { drawer: HTMLElement; openDrawer: (open: boolean) => void }) {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(saved) && saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH
      ? saved : SIDEBAR_DEFAULT_WIDTH;
  });
  const [maximum, setMaximum] = useState(() => sidebarWidth(SIDEBAR_MAX_WIDTH, innerWidth));
  const isOpen = () => drawer.classList.contains('open');
  const [expanded, setExpanded] = useState(isOpen);
  const gesture = useRef({
    raw: width, start: width, startedOpen: expanded, pulling: false, canceled: false, keyboard: false,
  });
  const live = useRef(width);
  const preferred = useRef(width);
  const root = document.documentElement;

  const show = (value: number) => {
    live.current = sidebarWidth(value, innerWidth);
    root.style.setProperty('--sidebar-width', `${live.current}px`);
    setWidth(live.current);
  };
  const save = (value: number) => {
    show(value);
    preferred.current = live.current;
    localStorage.setItem(STORAGE_KEY, String(live.current));
  };
  const reset = () => {
    if (isOpen()) save(SIDEBAR_DEFAULT_WIDTH);
    else openDrawer(true);
  };
  const syncSettling = () => {
    const moving = drawer.getAnimations().some(animation =>
      animation instanceof CSSTransition && animation.transitionProperty === 'width');
    root.toggleAttribute('data-sidebar-settling', moving);
  };
  const settleDrawer = (open: boolean) => {
    if (!root.hasAttribute('data-sidebar-settling')) {
      // 让抽屉、正文与拖柄先落在同一帧，再切换到可重定向的宽度过渡。
      drawer.getBoundingClientRect();
      root.setAttribute('data-sidebar-settling', '');
    }
    openDrawer(open);
  };
  const showDragWidth = (raw: number) => {
    const clamped = sidebarWidth(raw, innerWidth);
    const snap = nearbySnap(clamped, maximum, SNAP_RADIUS);
    show(snap === undefined ? clamped : magneticWidth(clamped, snap));
    root.toggleAttribute('data-sidebar-snapped', live.current === snap);
  };
  const finishDrag = () => {
    root.removeAttribute('data-sidebar-resizing');
    root.removeAttribute('data-sidebar-settling');
    root.removeAttribute('data-sidebar-snapped');
    root.style.removeProperty('--sidebar-pull-width');
  };

  useLayoutEffect(() => {
    const resize = () => {
      setMaximum(sidebarWidth(SIDEBAR_MAX_WIDTH, innerWidth));
      show(preferred.current);
    };
    resize();
    const syncExpanded = () => setExpanded(isOpen());
    syncExpanded();
    document.addEventListener('board:sidebar', syncExpanded);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('board:sidebar', syncExpanded);
      window.removeEventListener('resize', resize);
      finishDrag();
      root.style.removeProperty('--sidebar-width');
    };
  }, []);

  const { moveProps } = useMove({
    onMoveStart(event) {
      const startedOpen = isOpen();
      const keyboard = event.pointerType === 'keyboard';
      const pulling = !startedOpen && !keyboard;
      gesture.current = {
        raw: pulling ? drawer.getBoundingClientRect().width : live.current,
        start: live.current, startedOpen, pulling, canceled: false, keyboard,
      };
      if (!keyboard) {
        if (!pulling) syncSettling();
        root.setAttribute('data-sidebar-resizing', '');
      }
    },
    onMove(event) {
      const drag = gesture.current;
      if (drag.canceled) return;
      if (drag.keyboard) {
        show(live.current + event.deltaX * (event.shiftKey ? 10 : 1));
        return;
      }
      if (drag.pulling) {
        // 从折叠侧抓住时按实际宽度跟手，达到最小展开宽度才交给普通调宽。
        drag.raw += event.deltaX;
        if (drag.raw < SIDEBAR_MIN_WIDTH) {
          const pulled = Math.max(SIDEBAR_COLLAPSED_WIDTH, drag.raw);
          root.style.setProperty('--sidebar-pull-width', `${pulled}px`);
        } else {
          drag.pulling = false;
          root.style.removeProperty('--sidebar-pull-width');
          showDragWidth(drag.raw);
          openDrawer(true);
        }
        return;
      }
      if (root.hasAttribute('data-sidebar-settling')) syncSettling();
      // 在最窄的展开宽度和折叠之间保留一段拖动距离。
      drag.raw = Math.max(COLLAPSE_THRESHOLD, drag.raw + event.deltaX);
      if (isOpen()) {
        if (drag.raw === COLLAPSE_THRESHOLD) {
          settleDrawer(false);
          root.setAttribute('data-sidebar-snapped', '');
        } else showDragWidth(drag.raw);
      } else if (drag.raw >= SIDEBAR_MIN_WIDTH) {
        settleDrawer(true);
        showDragWidth(drag.raw);
      } else {
        root.setAttribute('data-sidebar-snapped', '');
      }
    },
    onMoveEnd() {
      const drag = gesture.current;
      if (drag.pulling && !drag.canceled) {
        drawer.getBoundingClientRect();
        finishDrag();
        if (drag.raw >= SIDEBAR_COLLAPSED_WIDTH + TOGGLE_DISTANCE) {
          save(SIDEBAR_MIN_WIDTH);
          openDrawer(true);
        }
        return;
      }
      finishDrag();
      if (drag.canceled) return;
      if (!isOpen()) {
        show(preferred.current);
        return;
      }
      const clamped = sidebarWidth(drag.raw, innerWidth);
      const snap = drag.keyboard ? undefined : nearbySnap(clamped, maximum, SNAP_RELEASE);
      // 先让拖动的最后一帧落位，再启用松手吸附的过渡。
      drawer.getBoundingClientRect();
      save(drag.keyboard ? live.current : snap ?? clamped);
    },
  });

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !root.hasAttribute('data-sidebar-resizing')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      gesture.current.canceled = true;
      drawer.getBoundingClientRect();
      finishDrag();
      show(gesture.current.start);
      if (isOpen() !== gesture.current.startedOpen) openDrawer(gesture.current.startedOpen);
    };
    document.addEventListener('keydown', cancel, true);
    return () => document.removeEventListener('keydown', cancel, true);
  }, []);

  return createPortal(<div {...moveProps} data-sidebar-resize="" role="separator" tabIndex={0}
    aria-label={t(expanded ? 'navigation:sidebarWidth.label' : 'shell:sidebar.expand')}
    aria-controls={drawer.id} aria-orientation="vertical"
    aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={expanded ? width : 0}
    aria-valuetext={expanded ? t('navigation:sidebarWidth.pixels', { count: width }) : undefined}
    aria-keyshortcuts={expanded ? 'ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Home End Enter' : 'ArrowRight Enter'}
    onDoubleClick={reset} onKeyDown={event => {
      if (!isOpen()) {
        if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); openDrawer(true) }
      }
      else if (event.key === 'Enter') { event.preventDefault(); reset() }
      else if (event.key === 'Home') { event.preventDefault(); save(SIDEBAR_MIN_WIDTH) }
      else if (event.key === 'End') { event.preventDefault(); save(maximum) }
      else moveProps.onKeyDown?.(event);
    }}>
    <span data-sidebar-resize-line="" />
    <span data-sidebar-resize-hint="" aria-hidden="true">
      {expanded ? <>{t('navigation:sidebarWidth.pixels', { count: width })}<span>{t('navigation:sidebarWidth.resetHint')}</span></>
        : t('shell:sidebar.expand')}
    </span>
  </div>, document.body);
}
