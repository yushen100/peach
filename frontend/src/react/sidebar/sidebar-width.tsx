import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMove } from 'react-aria';
import { t } from '../../i18n';

export const SIDEBAR_DEFAULT_WIDTH = 260;
export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 480;
const STORAGE_KEY = 'peach.sidebar.width';
const SNAP_WIDTHS = [SIDEBAR_MIN_WIDTH, SIDEBAR_DEFAULT_WIDTH, 320, 400, SIDEBAR_MAX_WIDTH];

export function sidebarWidth(value: number, viewport: number): number {
  const maximum = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, viewport - 504));
  return Math.round(Math.max(SIDEBAR_MIN_WIDTH, Math.min(maximum, value)));
}

/** 固定侧栏复用 React Aria 的鼠标、触屏和键盘移动，松手后保存浏览器偏好。 */
export function SidebarWidth({ drawer }: { drawer: HTMLElement }) {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(saved) && saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH
      ? saved : SIDEBAR_DEFAULT_WIDTH;
  });
  const [maximum, setMaximum] = useState(() => sidebarWidth(SIDEBAR_MAX_WIDTH, innerWidth));
  const gesture = useRef({ raw: width, start: width, canceled: false, keyboard: false });
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
  const reset = () => save(SIDEBAR_DEFAULT_WIDTH);

  useLayoutEffect(() => {
    const resize = () => {
      setMaximum(sidebarWidth(SIDEBAR_MAX_WIDTH, innerWidth));
      show(preferred.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      root.removeAttribute('data-sidebar-resizing');
      root.style.removeProperty('--sidebar-width');
    };
  }, []);

  const { moveProps } = useMove({
    onMoveStart(event) {
      gesture.current = { raw: live.current, start: live.current, canceled: false, keyboard: event.pointerType === 'keyboard' };
      if (event.pointerType !== 'keyboard') root.setAttribute('data-sidebar-resizing', '');
    },
    onMove(event) {
      if (gesture.current.canceled) return;
      gesture.current.raw += event.deltaX * (event.pointerType === 'keyboard' && event.shiftKey ? 10 : 1);
      show(gesture.current.raw);
      if (event.pointerType === 'keyboard') gesture.current.raw = live.current;
    },
    onMoveEnd() {
      root.removeAttribute('data-sidebar-resizing');
      if (gesture.current.canceled) return;
      const snap = gesture.current.keyboard ? undefined
        : SNAP_WIDTHS.find(value => value <= maximum && Math.abs(value - live.current) <= 8);
      // 先让拖动的最后一帧落位，再启用松手吸附的过渡。
      drawer.getBoundingClientRect();
      save(snap ?? live.current);
    },
  });

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !root.hasAttribute('data-sidebar-resizing')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      gesture.current.canceled = true;
      root.removeAttribute('data-sidebar-resizing');
      show(gesture.current.start);
    };
    document.addEventListener('keydown', cancel, true);
    return () => document.removeEventListener('keydown', cancel, true);
  }, []);

  return createPortal(<div {...moveProps} data-sidebar-resize="" role="separator" tabIndex={0}
    aria-label={t('navigation:sidebarWidth.label')} aria-controls={drawer.id} aria-orientation="vertical"
    aria-valuemin={SIDEBAR_MIN_WIDTH} aria-valuemax={maximum} aria-valuenow={width}
    aria-valuetext={t('navigation:sidebarWidth.pixels', { count: width })}
    aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Home End Enter"
    onDoubleClick={reset} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); reset() }
      else if (event.key === 'Home') { event.preventDefault(); save(SIDEBAR_MIN_WIDTH) }
      else if (event.key === 'End') { event.preventDefault(); save(maximum) }
      else moveProps.onKeyDown?.(event);
    }}>
    <span data-sidebar-resize-line="" />
    <span data-sidebar-resize-hint="" aria-hidden="true">
      {t('navigation:sidebarWidth.pixels', { count: width })}<span>{t('navigation:sidebarWidth.resetHint')}</span>
    </span>
  </div>, document.body);
}
