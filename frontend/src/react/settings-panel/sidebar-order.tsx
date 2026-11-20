/* 左侧导航的顺序：直接拖动排序，逐行上移、下移、隐藏，再从下面那张页面清单里加回来。
 *
 * 写入与侧栏那一列的拖动共用 `sidebar/sidebar-order.ts`：先落本地那份（侧栏按 store 的通知当场
 * 重排），再写 `/api/settings`。 */
import { useRef, useState, type CSSProperties } from 'react';
import { VisuallyHidden } from 'react-aria-components';

import { useCommitNavigationOrder } from '../sidebar/sidebar-order';
import { useSidebarReorder } from '../sidebar/use-sidebar-reorder';
import { Icon } from './icon';
import type { SettingsPanelHost } from './settings-panel-api';
import { Button } from '@/components/base/buttons/button';
import { resetSidebarOrder } from '../../sidebar';
import { NavigationDropLine, restoreNavigationOrder } from '../components/navigation-order';
import { Select, SelectItem } from '../components/select';
import { t } from '../../i18n';

/* 首页那一项的键是空串；空串写进属性和 dataTransfer 都等于没写，给它一个占位。 */
const HOME = '__home__';
const optionKey = (key: string) => key === '' ? HOME : key;

export function SidebarOrder({ host }: { host: SettingsPanelHost }) {
  const commit = useCommitNavigationOrder(host.store);
  const order = host.store.value.sidebarOrder;
  const byKey = new Map(host.navCatalog.map((item) => [item[0], item]));
  const visible = order.map((key) => byKey.get(key)).filter((item) => item !== undefined);
  const available = host.navCatalog.filter(([key]) => !order.includes(key));
  const defaults = resetSidebarOrder(order);
  const [picked, setPicked] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const reorder = useSidebarReorder(list, order, commit, () => {}, 'y', 'tab');

  const step = (key: string, delta: number) => {
    const from = order.indexOf(key), to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    commit(next);
  };

  /* 清单里当前挑中的那一项；挑中的那一项被加进侧栏之后退回清单第一项。 */
  const chosen = available.find(([key]) => optionKey(key) === picked) ?? available[0];
  return (
    <div data-sidebar-order="" id="sidebarOrderSetting">
      <div ref={list} data-navigation-order="sidebar-settings" data-navigation-axis="y" data-navigation-rows=""
        data-reordering={reorder.picked ? '' : undefined} onClickCapture={reorder.clickCapture}>
      {visible.map(([key, label, glyph], index) => (
        <div key={optionKey(key)} data-sidebar-row={key} data-tab={key} {...reorder.bindings(key)}
          role="group" aria-label={label} tabIndex={0} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          data-dragging={reorder.picked?.key === key ? '' : undefined}
          style={{ '--navigation-picked-left': `${reorder.picked?.bounds.left || 0}px`,
            '--navigation-picked-top': `${reorder.picked?.bounds.top || 0}px`,
            '--navigation-picked-width': `${reorder.picked?.bounds.width || 0}px`,
            '--navigation-picked-offset': `${reorder.picked?.offset || 0}px`,
            '--sidebar-nudge': `${reorder.nudge(key).distance}px`, '--sidebar-delay': `${reorder.nudge(key).delay}ms` } as CSSProperties}>
          <span data-sidebar-label=""><i data-sidebar-grip="" aria-hidden="true"><Icon name="grip-vertical" /></i>
            <Icon name={glyph ?? ''} /><b>{label}</b></span>
          <span data-sidebar-actions="">
            <button type="button" data-sidebar-key={key} data-sidebar-move="-1" aria-label={t('settings:sidebarOrder.moveItemUp', { label })} title={t('settings:sidebarOrder.moveUp')}
              disabled={index === 0} onClick={() => step(key, -1)}><Icon name="chevron-up" /></button>
            <button type="button" data-sidebar-key={key} data-sidebar-move="1" aria-label={t('settings:sidebarOrder.moveItemDown', { label })} title={t('settings:sidebarOrder.moveDown')}
              disabled={index === visible.length - 1} onClick={() => step(key, 1)}><Icon name="chevron-down" /></button>
            <button type="button" data-sidebar-key={key} data-sidebar-hide="" aria-label={t('settings:sidebarOrder.hideItem', { label })} title={t('settings:sidebarOrder.hide')}
              disabled={visible.length === 1}
              onClick={() => { if (order.length > 1) commit(order.filter((item) => item !== key)) }}><Icon name="eye-off" /></button>
          </span>
        </div>
      ))}
      <NavigationDropLine reorder={reorder} />
      </div>
      <VisuallyHidden role="status" aria-live="polite">{reorder.announcement}</VisuallyHidden>
      <div data-sidebar-add-row="">
        <div className="peach-react min-w-0">
        <Select aria-label={t('settings:sidebarOrder.pickPage')} triggerClassName="h-(--control-h)"
          selectedKey={chosen ? optionKey(chosen[0]) : null} isDisabled={!chosen}
          renderValue={chosen ? undefined : t('settings:sidebarOrder.allShown')}
          onSelectionChange={(key) => setPicked(key === null ? null : String(key))}>
          {available.map(([key, label, glyph]) => (
            <SelectItem key={optionKey(key)} id={optionKey(key)} textValue={label}>
              <span data-sidebar-picker-icon="" className="inline-flex shrink-0"><Icon name={glyph ?? ''} /></span><span>{label}</span>
            </SelectItem>
          ))}
        </Select>
        </div>
        <button type="button" className="geist-button primary" data-sidebar-add="" disabled={!chosen}
          onClick={() => { if (chosen && !order.includes(chosen[0])) commit([...order, chosen[0]]) }}>{t('settings:shared.add')}</button>
      </div>
      {order.join(',') !== defaults.join(',') ? <div className="peach-react"><Button variant="secondary" size="small"
        onClick={() => restoreNavigationOrder({ label: t('settings:sidebarOrder.groupLabel'), keys: order, defaults, commit })}>{t('settings:sidebarOrder.reset')}</Button></div> : null}
    </div>
  );
}
