import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { moveSidebarKey } from './sidebar-order';
import { t } from '../../i18n';
import './navigation-reorder.css';

interface Picked {
  key: string;
  origin: number;
  slot: number | null;
  offset: number;
  bounds: { left: number; top: number; width: number };
}
interface Gesture {
  key: string;
  node: HTMLElement;
  pointer: number;
  x: number;
  y: number;
  keys: string[];
  started: boolean;
  minHeight: string;
  cursor: string;
}

/** 玻璃背景和弹层变换会成为 fixed 的定位容器，拾起坐标须换算到该容器。 */
function floatingBounds(node: HTMLElement) {
  const bounds = node.getBoundingClientRect();
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.transform !== 'none' || style.filter !== 'none' || style.backdropFilter !== 'none'
      || style.perspective !== 'none' || /paint|layout|strict|content/.test(style.contain)) {
      const origin = parent.getBoundingClientRect();
      return { left: bounds.left - origin.left - parent.clientLeft + parent.scrollLeft,
        top: bounds.top - origin.top - parent.clientTop + parent.scrollTop, width: bounds.width };
    }
  }
  return { left: bounds.left, top: bounds.top, width: bounds.width };
}

/** 导航只在松手时保存顺序；指针移动只更新浮起项和插入位置。 */
export function useSidebarReorder(column: RefObject<HTMLElement | null>, order: readonly string[],
  commit: (next: string[]) => void, settled: () => void, axis: 'x' | 'y' = 'y', attribute = 'nav', fixed: readonly string[] = []) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [announcement, announce] = useState('');
  const gesture = useRef<Gesture | null>(null);
  const before = useRef<Map<HTMLElement, DOMRect> | null>(null);
  const ignoreClick = useRef(false);
  const latest = useRef({ order, commit, settled, picked });
  latest.current = { order, commit, settled, picked };
  const rows = () => [...column.current!.querySelectorAll<HTMLElement>(`:scope > [data-${attribute}]`)];
  const capture = () => { before.current = new Map(rows().map(node => [node, node.getBoundingClientRect()])) };

  useLayoutEffect(() => {
    const snapshot = before.current;
    before.current = null;
    if (!snapshot || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const css = getComputedStyle(column.current!);
    for (const node of rows()) {
      if (node.dataset[attribute] === picked?.key) continue;
      const old = snapshot.get(node);
      if (!old) continue;
      const now = node.getBoundingClientRect(), dx = old.left - now.left, dy = old.top - now.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      node.getAnimations().filter(animation => animation.id === 'sidebar-reorder').forEach(animation => animation.cancel());
      node.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }], {
        id: 'sidebar-reorder', duration: parseFloat(css.getPropertyValue('--sidebar-reorder-ms')),
        easing: css.getPropertyValue('--spring-press').trim(),
      });
    }
  });

  const finish = (accept: boolean) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    if (!active.started) return;
    const mark = latest.current.picked!;
    const remaining = active.keys.filter(key => key !== active.key);
    const slot = accept ? mark.slot : null;
    const next = slot === null || slot === mark.origin ? null : moveSidebarKey(latest.current.order, active.key,
      remaining[Math.min(slot, remaining.length - 1)]!, slot === remaining.length);
    capture();
    column.current!.style.minHeight = active.minHeight;
    document.body.style.cursor = active.cursor;
    active.node.style.removeProperty('--sidebar-drag-x');
    active.node.style.removeProperty('--sidebar-drag-y');
    ignoreClick.current = true;
    flushSync(() => {
      setPicked(null);
      if (next) latest.current.commit(next);
      announce(next ? t('navigation:sidebarReorder.moved', { label: active.node.ariaLabel, position: slot! + 1 })
        : accept && slot === mark.origin ? t('navigation:sidebarReorder.unchanged') : t('navigation:sidebarReorder.canceled'));
    });
    latest.current.settled();
  };

  useLayoutEffect(() => {
    const cancel = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') finish(false) };
    const abort = () => finish(false);
    window.addEventListener('keydown', cancel);
    window.addEventListener('blur', abort);
    return () => {
      window.removeEventListener('keydown', cancel);
      window.removeEventListener('blur', abort);
      const active = gesture.current;
      if (active?.started) {
        document.body.style.cursor = active.cursor;
        if (column.current) column.current.style.minHeight = active.minHeight;
      }
    };
  }, []);

  const pointerDown = (event: PointerEvent<HTMLElement>, key: string) => {
    if (event.button !== 0 || !event.isPrimary || fixed.includes(key)) return;
    ignoreClick.current = false;
    const control = (event.target as Element).closest('button,input,select,a');
    if (control && control !== event.currentTarget) return;
    const node = event.currentTarget;
    gesture.current = { key, node, pointer: event.pointerId, x: event.clientX, y: event.clientY,
      keys: rows().map(row => row.dataset[attribute]!), started: false,
      minHeight: column.current!.style.minHeight, cursor: document.body.style.cursor };
    node.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    if (!active.started) {
      if (Math.hypot(dx, dy) < 6) return;
      active.started = true;
      capture();
      column.current!.style.minHeight = `${column.current!.offsetHeight}px`;
      document.body.style.cursor = 'grabbing';
      const offset = axis === 'x' ? active.node.offsetLeft : active.node.offsetTop;
      const { left, top, width } = floatingBounds(active.node);
      const origin = active.keys.indexOf(active.key);
      flushSync(() => setPicked({ key: active.key, offset, origin, slot: origin, bounds: { left, top, width } }));
    }
    event.preventDefault();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.node.style.setProperty('--sidebar-drag-x', `${reduced ? 0 : dx + (axis === 'y' ? 18 : 0)}px`);
    active.node.style.setProperty('--sidebar-drag-y', `${reduced ? 0 : dy + (axis === 'x' ? 18 : 0)}px`);
    const box = column.current!.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right
      && event.clientY >= box.top && event.clientY <= box.bottom;
    let slot: number | null = null;
    if (inside) {
      const remaining = rows().filter(row => row !== active.node);
      const at = remaining.findIndex(row => axis === 'x'
        ? event.clientX - box.left + column.current!.scrollLeft < row.offsetLeft + row.offsetWidth / 2
        : event.clientY - box.top < row.offsetTop + row.offsetHeight / 2);
      slot = Math.max(active.keys.filter(key => fixed.includes(key)).length, at < 0 ? remaining.length : at);
    }
    if (slot !== latest.current.picked?.slot) flushSync(() => setPicked(mark => mark && { ...mark, slot }));
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, key: string) => {
    const previousKey = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
    if (!event.altKey || (event.key !== previousKey && event.key !== nextKey)) return;
    event.preventDefault();
    event.stopPropagation();
    const visible = rows().map(row => row.dataset[attribute]!);
    const at = visible.indexOf(key), down = event.key === nextKey;
    const target = visible[at + (down ? 1 : -1)];
    if (target === undefined || fixed.includes(key) || fixed.includes(target)) return;
    const next = moveSidebarKey(order, key, target, down);
    if (!next) return;
    capture();
    flushSync(() => commit(next));
    announce(t('navigation:sidebarReorder.moved', { label: event.currentTarget.ariaLabel, position: at + (down ? 2 : 0) }));
    settled();
  };

  const remaining = picked ? rows().filter(row => row.dataset[attribute] !== picked.key) : [];
  const hint = !!picked && picked.slot !== null && picked.slot !== picked.origin;
  const position = (node: HTMLElement) => axis === 'x' ? node.offsetLeft : node.offsetTop;
  const size = (node: HTMLElement) => axis === 'x' ? node.offsetWidth : node.offsetHeight;
  const linePosition = hint ? (picked.slot === remaining.length
    ? position(remaining.at(-1)!) + size(remaining.at(-1)!) + 1.5
    : position(remaining[picked.slot!]!) - 1.5) : 0;
  const nudge = (key: string) => {
      const at = remaining.findIndex(row => row.dataset[attribute] === key);
      if (!hint || at < 0) return { distance: 0, delay: 0 };
      const above = at < picked!.slot!, n = above ? picked!.slot! - at - 1 : at - picked!.slot!;
      return { distance: (above ? -1 : 1) * 10 * 0.7 ** n, delay: 24 * n };
  };
  return {
    picked, announcement, linePosition, hint, nudge,
    bindings(key: string) {
      return { onPointerDown: (event: PointerEvent<HTMLElement>) => pointerDown(event, key),
        onPointerMove: pointerMove,
        onPointerUp: (event: PointerEvent<HTMLElement>) => { if (gesture.current?.pointer === event.pointerId) finish(true) },
        onPointerCancel: () => finish(false),
        onLostPointerCapture: () => finish(false), onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboard(event, key),
        onDragStart: (event: { preventDefault(): void }) => event.preventDefault() };
    },
    clickCapture(event: { preventDefault(): void; stopPropagation(): void }) {
      if (!ignoreClick.current) return;
      ignoreClick.current = false;
      event.preventDefault();event.stopPropagation();
    },
  };
}
