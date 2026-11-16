/* 管理区页头（ADR-0031 第 11g 步）：管理条、面包屑与页面标题。
 *
 * 常驻组件 `manage-header`（`router/managed-routes.tsx` 的常驻表）：路由树把它画进壳常驻的
 * `[data-manage-header]`（`display: contents`，四块直接落在 `main` 的流里），宿主就是那个节点本身。壳启动时
 * 先同步在宿主里写一份同结构的骨架（`manageHeaderSkeletonHtml`）；打开这一面时 `place` 清掉骨架，路由树在
 * 同一个任务里画出首帧。首帧还没有 props，画成空，壳拿到句柄就把手上那份推进来。之后壳只经
 * `configureManageHeader` 给的句柄推 props：句柄写本模块的 store 再 `flushSync` 通知，返回时已经画好——壳紧接着
 * 就读 `[data-manage-title]` 做标题揭示。换页都落在同一个组件上，导航选中态随地址同步。
 *
 * 宿主不包 `.peach-react`：这一块一直在 Preflight 之外，按钮与字号继承的是遗留层的全局规则，样式全在
 * `manage-header.css`，不用工具类。 */
import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';

import { manageHeaderView, type ManageHeaderProps, type ManageHeaderView } from '../../manage-header';
import { MANAGE_MENU_SECTIONS, normalizeManageOrder } from '../../application/navigation-items';
import { useSidebarReorder } from '../sidebar/use-sidebar-reorder';
import { useCommitNavigationOrder } from '../sidebar/sidebar-order';
import { Icon } from '../settings-panel/icon';
import { PillTabList } from '../components/pill-tabs';
import { NavigationOrderMenu } from '../components/navigation-order';
import type { ManageHeaderApi, ManageHeaderHost } from './manage-header-api';
import { t } from '../../i18n';
import './manage-header.css';

let host: ManageHeaderHost | null = null;
let props: ManageHeaderProps | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener) };
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/* 这一面抛错、被错误边界卸掉之后没人订阅，推进来的只写进 store，不画、不抛。 */
const api: ManageHeaderApi = {
  render(next) { props = next; flushSync(notify) },
};

/** 接上壳给的宿主，拿回页头的命令式入口。只调一次；壳的 `loadManageHeader` 接着在路由树里打开这一面，
 *  画上之后才交出句柄，壳随即把手上那份 props 推进来。 */
export function configureManageHeader(next: ManageHeaderHost): ManageHeaderApi {
  host = next;
  props = null;
  return api;
}

/** 常驻表里的那一面：读本模块的 store，宿主还没接上或壳还没推 props 时不画。 */
export function ManageHeaderSurface() {
  const current = useSyncExternalStore(subscribe, () => props);
  return host && current ? <ManageHeader host={host} props={current} /> : null;
}

function ManageHeader({ host: at, props: current }: { host: ManageHeaderHost; props: ManageHeaderProps }) {
  const view = manageHeaderView(current);
  if (!view) return null;
  return (
    <>
      <ManageBar host={at} pressed={view.pressed} menu={current.menu} />
      {view.crumb ? <Crumb host={at} label={view.crumb} parent={view.parent} /> : null}
      <h2 data-manage-title="" data-compact={view.compact ? '' : undefined}>{view.title}</h2>
    </>
  );
}

/** 管理导航使用中性填充选中态；切换后把当前项滚入可见区域。 */
function ManageBar({ host: at, pressed: key, menu }: Pick<ManageHeaderProps, 'menu'> & { host: ManageHeaderHost; pressed: string }) {
  const row = useRef<HTMLDivElement>(null);
  useSyncExternalStore(at.store.subscribe, at.store.version);
  const order = normalizeManageOrder(at.store.value.manageOrder);
  const commit = useCommitNavigationOrder(at.store, 'manageOrder');
  const reorder = useSidebarReorder(row, order, commit, () => {}, 'x', 'manage');
  const items = order.flatMap(entry => menu.filter(([value]) => value === entry));

  useLayoutEffect(() => {
    const group = row.current;
    const pressed = group?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!group || !pressed) return;
    const left = pressed.offsetLeft, right = left + pressed.offsetWidth;
    if (left < group.scrollLeft) group.scrollLeft = left;
    else if (right > group.scrollLeft + group.clientWidth) group.scrollLeft = right - group.clientWidth;
  }, [key, menu, order.join(",")]);

  return (
    <nav data-manage-bar="" aria-label={t('manage:manageHeader.barLabel')}>
      <PillTabList ref={row} data-manage-menu="" data-pill-nav="" data-reordering={reorder.picked ? '' : undefined}
        onClickCapture={reorder.clickCapture}>
        {items.map(([entry, label, glyph]) => {
          const on = entry === key;
          const nudge = reorder.nudge(entry);
          return (
            <button key={entry} type="button" data-manage={entry} aria-label={label}
              data-dragging={reorder.picked?.key === entry ? '' : undefined}
              style={{ '--manage-picked-left': `${reorder.picked?.bounds.left || 0}px`,
                '--manage-picked-top': `${reorder.picked?.bounds.top || 0}px`,
                '--manage-picked-width': `${reorder.picked?.bounds.width || 0}px`,
                '--sidebar-nudge': `${nudge.distance}px`, '--sidebar-delay': `${nudge.delay}ms` } as CSSProperties}
              aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
              {...reorder.bindings(entry)} aria-pressed={on} aria-current={on ? 'page' : undefined}
              data-pill-selected={on ? '' : undefined} data-pill-variant="gray"
              onClick={() => at.openManage(entry)}>
              <Icon name={glyph} /><span>{label}</span>
            </button>
          );
        })}
        {reorder.hint ? <span data-manage-drop-line="" aria-hidden="true"
          style={{ '--manage-line-left': `${reorder.linePosition}px` } as CSSProperties}><span /></span> : null}
      </PillTabList>
      <NavigationOrderMenu order={{ label: t('manage:manageHeader.menuOrderLabel'), keys: order, defaults: MANAGE_MENU_SECTIONS, commit }} />
      <span data-manage-order-status="" role="status" aria-live="polite">{reorder.announcement}</span>
    </nav>
  );
}

/* ── 面包屑 ──
   Geist Breadcrumbs：上一级是链接、当前页是纯文本并带 `aria-current="true"`。href 留给新标签页与右键
   菜单；普通左键走路由，整页重载会丢掉返回表面与已读位置。 */
function Crumb({ host: at, label, parent }: { host: ManageHeaderHost; label: string; parent: ManageHeaderView['parent'] }) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
    event.preventDefault();
    at.openPath(parent.href);
  };
  return (
    <nav data-manage-crumb="" aria-label={t('manage:manageHeader.breadcrumbLabel')}>
      <ol>
        <li><a href={parent.href} onClick={follow}>{parent.label}</a><Icon name="chevron-right" /></li>
        <li aria-current="true"><span>{label}</span></li>
      </ol>
    </nav>
  );
}

