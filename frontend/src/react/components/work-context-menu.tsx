import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { RiCheckboxLine } from '@remixicon/react';
import { mergeProps, Overlay, useOverlay, useOverlayPosition } from 'react-aria';
import { Menu, MenuItem } from 'react-aria-components';
import { MENU_ITEM, MENU_ITEM_ACTIVE, MENU_ITEMS_CONTAINER, MENU_POPOVER_SURFACE } from '@/components/base/dropdown/menu-styles';
import { cx } from '@/utils/cx';
import { t } from '../../i18n';

export interface WorkContextOperation {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  disabled?: boolean;
  danger?: boolean;
  run(anchor: HTMLElement): void | Promise<void>;
}
export function rowSelectionOperation(selected: boolean, toggle: () => void): WorkContextOperation {
  return { id: 'select', label: t(selected ? 'shell:dataTable.clearSelection' : 'shell:dataTable.selectColumn'),
    icon: RiCheckboxLine, run: toggle };
}

export interface WorkContext { key: string | number; operations: WorkContextOperation[] }
interface Target extends WorkContext { anchor: HTMLElement; x: number; y: number }

/** 右键与键盘共用菜单定位，实际动作由作品所在页面提供。 */
export function useWorkContextMenu() {
  const [target, setTarget] = useState<Target | null>(null);
  const open = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, context: WorkContext, anchor = event.currentTarget) => {
    if (!context.operations.length) return;
    event.preventDefault(); event.stopPropagation();
    (anchor as HTMLElement & { _stopHover?: () => void })._stopHover?.();
    const rect = anchor.getBoundingClientRect();
    const pointer = 'clientX' in event && (event.clientX !== 0 || event.clientY !== 0);
    setTarget({ ...context, anchor, x: pointer ? event.clientX : rect.left + 16, y: pointer ? event.clientY : rect.top + 16 });
  };
  return {
    onContextMenu: open,
    onKeyDown: (event: KeyboardEvent<HTMLElement>, context: WorkContext, anchor?: HTMLElement) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) open(event, context, anchor);
    },
    menu: target ? <WorkContextMenu key={`${target.key}:${target.x}:${target.y}`} target={target}
      close={() => setTarget(current => current === target ? null : current)} /> : null,
  };
}

export function useRowWorkContext<T>(findRow: (key: string) => T | undefined, operations?: (item: T) => WorkContextOperation[]) {
  const menu = useWorkContextMenu();
  return {
    menu: menu.menu,
    onContextMenu: operations ? (event: MouseEvent<HTMLElement>, item: T, key: string) =>
      menu.onContextMenu(event, { key, operations: operations(item) }) : undefined,
    onKeyDown: operations ? (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
      const row = (event.target as Element).closest<HTMLElement>('[data-work-context-row]');
      const key = row?.dataset.workContextRow;
      if (!row || !key || !event.currentTarget.contains(row)) return;
      const item = findRow(key);
      if (item) menu.onKeyDown(event, { key, operations: operations(item) }, row);
    } : undefined,
  };
}

function WorkContextMenu({ target, close }: { target: Target; close(): void }) {
  const trigger = useRef<HTMLSpanElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const textEdit = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { overlayProps } = useOverlay({ isOpen: true, isDismissable: true, shouldCloseOnBlur: true, onClose: close,
    shouldCloseOnInteractOutside: element => !element.closest('[data-copy-editor]') }, surface);
  // 固定坐标的菜单在文案编辑器获取焦点时保持打开，页面滚轮和触摸滚动仍可关闭。
  const { overlayProps: positionProps, placement } = useOverlayPosition({
    targetRef: trigger, overlayRef: surface, placement: 'bottom start', containerPadding: 8, onClose: null,
  });
  useEffect(() => {
    const scroll = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-work-context-menu]')) close();
    };
    window.addEventListener('wheel', scroll, { capture: true, passive: true });
    window.addEventListener('touchmove', scroll, { capture: true, passive: true });
    window.addEventListener('blur', close);
    return () => { window.removeEventListener('wheel', scroll, true); window.removeEventListener('touchmove', scroll, true); window.removeEventListener('blur', close) };
  }, [close]);
  const run = async (id: string) => {
    const operation = target.operations.find(operation => operation.id === id);
    if (busy || !operation || operation.disabled) return;
    setBusy(true); setError('');
    try { const result = operation.run(target.anchor); if (result) await result; close() }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('catalog:mediaActions.failed')) }
    finally { setBusy(false) }
  };
  return <>
    <span ref={trigger} aria-hidden="true" className="pointer-events-none fixed left-(--context-menu-x) top-(--context-menu-y) size-px"
      style={{ '--context-menu-x': `${target.x}px`, '--context-menu-y': `${target.y}px` } as CSSProperties} />
    <Overlay>
      <div {...mergeProps(overlayProps, positionProps)} ref={surface}
        data-placement={placement} data-work-context-menu="" data-media-context-menu=""
        className={cx(MENU_POPOVER_SURFACE, 'peach-react w-60 overscroll-contain')}
        onClick={event => event.stopPropagation()} onContextMenu={event => event.preventDefault()}>
      <div className="contents" onKeyDownCapture={event => { textEdit.current = event.altKey }}>
      <Menu aria-label={t('shell:dataTable.contextActions')} autoFocus="first" data-copy-interact=""
        onPointerDownCapture={event => { textEdit.current = event.altKey }}
        disabledKeys={target.operations.filter(operation => busy || operation.disabled).map(operation => operation.id)}
        className={MENU_ITEMS_CONTAINER} onAction={id => { if (!textEdit.current) void run(String(id)) }}>
        {target.operations.map(operation => <MenuItem key={operation.id} id={operation.id} textValue={operation.label} shouldCloseOnSelect={false}
          className={({ isFocused, isDisabled }) => cx(MENU_ITEM, 'text-body-regular', isFocused && MENU_ITEM_ACTIVE,
            isDisabled && 'cursor-default text-text-tertiary', operation.danger && !isDisabled && 'text-text-error-primary')}>
          <operation.icon aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0">{operation.label}</span>
        </MenuItem>)}
      </Menu>
      </div>
      {error ? <p role="alert" className="px-2 pt-2 text-caption-1-regular text-text-error-primary">{error}</p> : null}
      </div>
    </Overlay>
  </>;
}
