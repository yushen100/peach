/* 管理区页头：管理条、面包屑与页面标题的视图模型与启动骨架。
 *
 * 页头归常驻组件 `manage-header`（`react/manage-header/`）。壳启动时同步把这里的骨架写进宿主
 * `[data-manage-header]`，React 包装载回来、路由树画上这一面的那一刻整块换掉；骨架与组件画的是同一份结构，
 * 判据（标题取哪个名字、哪几页画面包屑、标题在窄屏上收到哪一档）也只在这里写一次，两边共用。
 *
 * 当前在哪个管理区、菜单里列哪几项由壳算好推进来：路由表与 `/healthz` 的 `configurable` 都还在壳里。
 * 回收站的读数与「清空回收站」在它的筛选浮层里（`react/catalog-filter/`），不在页头。 */

/** `[键, 名称, 字形]`，同壳的 `MANAGE_SECTIONS`。 */
import { CLEANUP_CRUMB_PAGES } from './cleanup-tools';
import { REPAIR_CENTER_PATH } from './history/settings-route';
import { MANAGE_MENU_SECTIONS, normalizeManageOrder } from './application/navigation-items';
import { t } from './i18n';

export type ManageEntry = readonly [key: string, label: string, glyph: string];

export interface ManageHeaderProps {
  /** 当前管理区；空串时整块页头不画（首页、目录、关注页这些）。 */
  section: string;
  /** 解码过的 `location.pathname`。 */
  path: string;
  /** 全部管理区，标题按 `section` 从这里取名。 */
  sections: readonly ManageEntry[];
  /** 管理条上列的那几项（壳的 `manageMenuSections()`，「配置」只在本机列出）。 */
  menu: readonly ManageEntry[];
}

/* 数据管理那几张卡通往的子页（vercel.com/geist/breadcrumbs：有上一级页面的子页才画面包屑）。
   人工复核、回收站、高清版保留侧栏快捷入口；维护工具各有独立二级页。
   子页标题取这里的名字，「数据管理」显示在面包屑的上一级。 */
export const MANAGE_CRUMB_PAGES: Readonly<Record<string, string>> = {
  ...CLEANUP_CRUMB_PAGES,
  '/junk-files': t('manage:managePages.junkFiles'),
  '/duplicates': t('manage:managePages.duplicates'),
  '/review': t('manage:managePages.review'),
  '/trash': t('manage:managePages.trash'),
  '/quality-goals': t('manage:managePages.qualityGoals'),
  '/sources': t('manage:managePages.sources'),
  [REPAIR_CENTER_PATH]: t('manage:managePages.repairs'),
};

/** 面包屑的上一级：`key` 是管理条上按下的那一项。没写的子页都从数据管理进。 */
export interface CrumbParent { key: string; label: string; href: string }
const CLEANUP_PARENT: CrumbParent = { key: 'cleanup', label: t('manage:managePages.libraryTools'), href: '/data-cleanup' };
const CRUMB_PARENTS: Readonly<Record<string, CrumbParent>> = {
  [REPAIR_CENTER_PATH]: { key: 'configuration', label: t('manage:managePages.maintenance'), href: '/settings/maintenance' },
};
export const crumbParent = (path: string): CrumbParent => CRUMB_PARENTS[path] ?? CLEANUP_PARENT;

/* 窄屏（≤760px）上标题收一档到 22px 的页面：正文是 812px 窄列的数据管理 hub、来源和凭证与配置页。
   其余管理页跟全站页面标题走 24px。 */
const COMPACT_TITLE_PATHS = new Set(['/data-cleanup', '/sources']);

/** 管理条上按下哪一项。子页按上一级（多数是数据管理）；
 *  别的页按自己的管理区，管理条上没有这一项时就没有按下项。 */
export function pressedManageKey(props: Pick<ManageHeaderProps, 'section' | 'path' | 'menu'>): string {
  const key = MANAGE_CRUMB_PAGES[props.path] ? crumbParent(props.path).key : props.section;
  return props.menu.some(([entry]) => entry === key) ? key : '';
}

export interface ManageHeaderView {
  title: string;
  /** 管理条上按下的那一项；空串时没有按下项。 */
  pressed: string;
  /** 面包屑当前那一项的名字；空串时不画面包屑。 */
  crumb: string;
  parent: CrumbParent;
  compact: boolean;
}

/** 页头这一刻画什么；不在管理区时是 null。 */
export function manageHeaderView(props: ManageHeaderProps): ManageHeaderView | null {
  const entry = props.sections.find(([key]) => key === props.section);
  if (!entry) return null;
  const crumb = MANAGE_CRUMB_PAGES[props.path] ?? '';
  return {
    title: (props.section === crumbParent(props.path).key && crumb) || entry[1],
    pressed: pressedManageKey(props),
    crumb,
    parent: crumbParent(props.path),
    compact: COMPACT_TITLE_PATHS.has(props.path) || props.section === 'configuration',
  };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const glyph = (name: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${escape(name)}"/></svg>`;

/** 启动骨架：与岛同一份结构，岛接手时整块换掉。 */
export function manageHeaderSkeletonHtml(props: ManageHeaderProps): string {
  const view = manageHeaderView(props);
  if (!view) return '';
  const menu = props.menu.map(([key, label, mark]) => {
    const on = key === view.pressed;
    return `<button type="button" data-manage="${escape(key)}" aria-label="${escape(label)}" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" data-pill-variant="gray" aria-pressed="${on}"${on ? ' aria-current="page" data-pill-selected=""' : ''}>`
      + `${glyph(mark)}<span>${escape(label)}</span></button>`;
  }).join('');
  const crumb = view.crumb
    ? `<nav data-manage-crumb="" aria-label="${escape(t('manage:manageHeader.breadcrumbLabel'))}"><ol><li><a href="${escape(view.parent.href)}">${escape(view.parent.label)}</a>${glyph('chevron-right')}</li>`
      + `<li aria-current="true"><span>${escape(view.crumb)}</span></li></ol></nav>`
    : '';
  const keys = props.menu.map(([key]) => key);
  const reset = normalizeManageOrder(keys).join(',') === MANAGE_MENU_SECTIONS.join(',') ? ''
    : `<button type="button" disabled data-navigation-menu="" aria-label="${escape(t('shell:navigationOrder.menuLabel', { group: t('manage:manageHeader.menuOrderLabel') }))}" aria-haspopup="dialog" aria-expanded="false">${glyph('ellipsis')}</button>`;
  return `<nav data-manage-bar="" aria-label="${escape(t('manage:manageHeader.barLabel'))}"><div data-manage-menu="" data-pill-nav="" role="group">${menu}</div>${reset}<span data-manage-order-status="" role="status" aria-live="polite"></span></nav>`
    + crumb
    + `<h2 data-manage-title=""${view.compact ? ' data-compact=""' : ''}>${escape(view.title)}</h2>`;
}

