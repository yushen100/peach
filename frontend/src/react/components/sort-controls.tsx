import { useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Popover, VisuallyHidden } from 'react-aria-components';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Button } from '@/components/base/buttons/button';
import { MENU_POPOVER_SURFACE } from '@/components/base/dropdown/menu-styles';
import { cx } from '@/utils/cx';
import { appSettingsStore } from '../../appearance/settings';
import { normalizeSortControl, visibleSortControls, type SortControlGroup, type SortControlPreference } from '../../sort-controls';
import { t } from '../../i18n';
import { useSaveSettings } from '../settings-panel/settings-data';
import { useSidebarReorder } from '../sidebar/use-sidebar-reorder';
import type { EntitySortKey } from '../entity-filter/entity-filter';
import { NavigationDropLine, NavigationOrderRows } from './navigation-order';
import { FilterIconButton } from './filter-glass';
import { IconSwap } from './icon-swap';
import { MenuDialog } from './menu-dialog';
import { Note } from './note';
import { spriteGlyph } from './sprite-glyph';
import { errorMessage } from '../../api';
import './sort-controls.css';

const More = spriteGlyph('ellipsis');
const Up = spriteGlyph('arrow-up');
const Down = spriteGlyph('arrow-down');

/** 排序行与自定义菜单共用侧栏拖拽，显隐与顺序按内容类型保存。 */
export function SortKeys({ sorts, onSort, group = 'catalog', follow = false }: {
  sorts: readonly EntitySortKey[]; onSort(key: string): void; group?: SortControlGroup; follow?: boolean;
}) {
  const store = appSettingsStore();
  useSyncExternalStore(store.subscribe, store.version);
  const preference = normalizeSortControl(group, store.value.sortControls?.[group]);
  const save = useSaveSettings('sort-controls');
  const commit = (next: SortControlPreference) => {
    const value = normalizeSortControl(group, next);
    store.value.sortControls = { ...store.value.sortControls, [group]: value };
    store.save();
    save.mutate({ sortControls: { [group]: value } });
  };
  const list = useRef<HTMLSpanElement>(null);
  const reorder = useSidebarReorder(list, preference.order, order => commit({ ...preference, order }), () => {}, 'x', 'tab');
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const labels = Object.fromEntries(sorts.map(sort => [sort.key, sort.label]));
  const visible = visibleSortControls(sorts, preference);
  const defaults = normalizeSortControl(group, null);
  const customized = JSON.stringify(preference) !== JSON.stringify(defaults);
  return <>
    <span ref={list} data-sort-controls={group} data-navigation-order={`sort-${group}`} data-navigation-axis="x"
      data-reordering={reorder.picked ? '' : undefined} onClickCapture={reorder.clickCapture}>
      {visible.map(sort => <button key={sort.key} type="button" data-entity-sort={sort.key} data-entity-press=""
        data-follow-sort={follow ? sort.key : undefined} data-tab={sort.key}
        aria-pressed={sort.pressed} aria-label={sort.ariaLabel || sort.label}
        aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" data-dragging={reorder.picked?.key === sort.key ? '' : undefined}
        style={{ '--navigation-picked-left': `${reorder.picked?.bounds.left || 0}px`,
          '--navigation-picked-top': `${reorder.picked?.bounds.top || 0}px`,
          '--navigation-picked-width': `${reorder.picked?.bounds.width || 0}px`,
          '--sidebar-nudge': `${reorder.nudge(sort.key).distance}px`, '--sidebar-delay': `${reorder.nudge(sort.key).delay}ms` } as CSSProperties}
        {...reorder.bindings(sort.key)} onClick={() => onSort(sort.key)}>
        {sort.label}{sort.pressed && sort.dir ? <IconSwap a={Up} b={Down} state={sort.dir === 'asc' ? 'a' : 'b'} className="size-(--icon-inline)" /> : null}
      </button>)}
      <NavigationDropLine reorder={reorder} />
    </span>
    <FilterIconButton ref={trigger} data-sort-settings={group} label={t('catalog:sortControls.customize')}
      icon={More} aria-haspopup="dialog" aria-expanded={open} onPress={() => setOpen(true)} />
    <Popover triggerRef={trigger} isOpen={open} onOpenChange={setOpen} placement="bottom end" offset={4}
      className={cx('peach-react w-80', MENU_POPOVER_SURFACE)}>
      <MenuDialog aria-label={t('catalog:sortControls.customize')} data-sort-settings-dialog="" className="flex flex-col gap-3 overflow-y-auto p-3 outline-none">
        <h3 className="text-body-medium">{t('catalog:sortControls.title')}</h3>
        <NavigationOrderRows reset={false} labels={labels}
          order={{ label: t('catalog:sortControls.title'), keys: preference.order, defaults: defaults.order,
            commit: order => commit({ ...preference, order }) }}
          render={key => <Checkbox size="sm" isSelected={!preference.hidden.includes(key)}
            onPointerDown={event => event.stopPropagation()}
            onChange={shown => commit({ ...preference,
              hidden: shown ? preference.hidden.filter(item => item !== key) : [...preference.hidden, key] })}>
            {labels[key]}
          </Checkbox>} />
        {customized ? <Button variant="secondary" size="small"
          onClick={() => commit(defaults)}>{t('catalog:sortControls.reset')}</Button> : null}
        {save.isError ? <Note tone="error">{t('catalog:sortControls.syncFailed', { error: errorMessage(save.error) })}</Note> : null}
      </MenuDialog>
    </Popover>
    <VisuallyHidden role="status" aria-live="polite">{reorder.announcement}</VisuallyHidden>
  </>;
}
