import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { RiArrowGoBackLine, RiBookmarkLine, RiCheckLine, RiCheckboxLine, RiDeleteBinLine, RiPlayLine } from '@remixicon/react';
import { IconButton } from '@/components/base/buttons/icon-button';
import { useWorkContextMenu } from './work-context-menu';
import type { MediaCardActions, MediaItem } from '../catalog-grid/types';
import { t } from '../../i18n';

interface MediaActionProps {
  item: MediaItem;
  actions: MediaCardActions;
  selected: boolean;
  onOpen(item: MediaItem, anchor: HTMLElement): void;
  onLaterChange?(on: boolean): void;
}

function useMediaOperations({ item, actions, selected, onOpen, onLaterChange }: MediaActionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [later, setLater] = useState(!!item.watch_later);
  useEffect(() => setLater(!!item.watch_later), [item.id, item.watch_later]);
  const trash = item.disposal === 'trash';
  const operations = [
    { id: 'open', label: t('catalog:mediaActions.open'), icon: RiPlayLine },
    ...(!trash ? [{ id: 'later', label: t(later ? 'catalog:mediaActions.removeLater' : 'catalog:shared.watchLater'), icon: later ? RiCheckLine : RiBookmarkLine }] : []),
    { id: 'select', label: t(selected ? 'catalog:mediaActions.deselect' : 'catalog:mediaActions.select'), icon: RiCheckboxLine },
    { id: 'trash', label: t(trash ? 'catalog:mediaActions.restore' : 'catalog:mediaActions.delete'), icon: trash ? RiArrowGoBackLine : RiDeleteBinLine },
  ];
  const run = async (id: string, anchor: HTMLElement, done?: () => void) => {
    if (busy) return;
    setError('');
    if (id === 'open') { done?.(); onOpen(item, anchor); return }
    if (id === 'select') { done?.(); actions.toggleSelection(item.id, false); return }
    setBusy(true);
    try {
      if (id === 'later') await actions.watchLater(item, on => { setLater(on); onLaterChange?.(on) });
      else await actions.resourceOperation(item, trash ? 'restore' : 'dispose');
      done?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('catalog:mediaActions.failed'));
    } finally { setBusy(false) }
  };
  return { operations, run, busy, error };
}

/** 行内操作与右键菜单共用馆藏的写入及撤销入口。 */
export function MediaRowActions(props: MediaActionProps & { disabled?: boolean }) {
  const { operations, run, busy, error } = useMediaOperations(props);
  return <div className="flex flex-col gap-1" data-media-row-actions="" onClick={event => event.stopPropagation()}>
    <div role="group" aria-label={t('catalog:mediaActions.label')} className="flex items-center gap-1">
      {operations.filter(operation => operation.id !== 'select').map(operation => <IconButton key={operation.id}
        icon={operation.icon} size="small" aria-label={operation.label}
        title={operation.id === 'trash' && props.item.disposal !== 'trash' ? t('catalog:shared.moveToTrash') : operation.label}
        disabled={props.disabled || busy} aria-busy={busy || undefined}
        onClick={event => { void run(operation.id, event.currentTarget) }} />)}
    </div>
    {error ? <span role="alert" className="text-caption-1-regular text-text-error-primary">{error}</span> : null}
  </div>;
}

/** 只在作品上接管右键；页面其他区域保留浏览器菜单。 */
export function useMediaContextMenu() {
  const menu = useWorkContextMenu();
  const context = ({ item, actions, selected, onOpen, onLaterChange }: MediaActionProps) => {
    const trash = item.disposal === 'trash';
    return { key: item.id, operations: [
      { id: 'open', label: t('catalog:mediaActions.open'), icon: RiPlayLine, run: (anchor: HTMLElement) => onOpen(item, anchor) },
      ...(!trash ? [{ id: 'later', label: t(item.watch_later ? 'catalog:mediaActions.removeLater' : 'catalog:shared.watchLater'),
        icon: item.watch_later ? RiCheckLine : RiBookmarkLine, run: () => actions.watchLater(item, on => onLaterChange?.(on)) }] : []),
      { id: 'select', label: t(selected ? 'catalog:mediaActions.deselect' : 'catalog:mediaActions.select'), icon: RiCheckboxLine,
        run: () => actions.toggleSelection(item.id, false) },
      { id: 'trash', label: t(trash ? 'catalog:mediaActions.restore' : 'catalog:mediaActions.delete'), icon: trash ? RiArrowGoBackLine : RiDeleteBinLine,
        danger: !trash, run: () => actions.resourceOperation(item, trash ? 'restore' : 'dispose') },
    ] };
  };
  return {
    onContextMenu: (event: MouseEvent<HTMLElement>, props: MediaActionProps) => menu.onContextMenu(event, context(props)),
    onKeyDown: (event: KeyboardEvent<HTMLElement>, props: MediaActionProps, anchor?: HTMLElement) => {
      menu.onKeyDown(event, context(props), anchor);
    },
    menu: menu.menu,
  };
}
