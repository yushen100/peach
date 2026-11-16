/* React 页面与卡片的首屏骨架：画在 `.peach-react` 里，按键照 Board UI `Button` 渲染出的静止态写。
 *
 * 骨架跑在 React 包加载之前，只能是一段 HTML。挂在 `.peach-react` 外面的话，卡面、字色与按键
 * 取的是遗留层那套 token，接管时底色、字号和按键的尺寸各跳一档。类名只取决定几何与颜色的
 * 那几项（`frontend/src/react/boardui/components/base/buttons/button.tsx` 的 size / variant /
 * icon / label 四张表），悬停、按下、焦点环留给接管后的真按键。 */

import { esc } from '@peach/legacy/core';
import { t } from './i18n';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'medium' | 'small';

const BASE = 'inline-flex items-center justify-center gap-0.5 whitespace-nowrap overflow-hidden font-sans';
const SIZE: Record<Size, string> = {
  medium: 'h-9 rounded-2lg p-2 text-body-medium',
  small: 'h-8 rounded-lg px-2 py-1.5 text-body-medium',
};
/* 小号纯图标键在 Board UI 里是强制 32×32、内边距归零（`size-8 p-0`）；中号纯图标沿用基础尺寸。 */
const ICON_ONLY: Record<Size, string> = { medium: SIZE.medium, small: 'size-8 rounded-lg p-0 text-body-medium' };
const ICON: Record<Size, string> = { medium: 'size-5 shrink-0', small: 'size-[18px] shrink-0' };
/* 带字按键的字形与文字同行，同 `Button` 的 `iconInline`：画框按所在文字字号缩放。 */
const ICON_INLINE = 'size-(--icon-inline) shrink-0';
const LABEL: Record<Size, string> = {
  medium: 'inline-flex items-center justify-center px-1 shrink-0',
  small: 'inline-flex items-center justify-center px-0.5 shrink-0',
};
const VARIANT: Record<Variant, string> = {
  primary: 'bg-button-primary text-text-white shadow-xs',
  secondary: 'bg-background-primary-default text-text-primary border border-border-button-default shadow-xs',
  ghost: 'bg-button-ghost-background text-button-ghost-foreground',
};

/** 岛里没有遗留层那条给 Lucide 字形描边的全局规则，描边跟 React 那侧一样写在 `svg` 自己身上。 */
export const islandGlyph = (name: string, cls: string): string =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** 收藏入口在页面等待阶段保留图标与尺寸，交互由已就绪的页面接管。玻璃筛选条里取紧凑档，
 *  实体页标题右侧的工具行取默认档，与 `react/styles.css` 里 `[data-filter-action]` 的两档同高。 */
export function islandShortcutsEntry(size: 'compact' | 'default' = 'compact'): string {
  return `<span data-shortcuts-entry class="inline-flex flex-none"><button type="button" data-shortcuts-trigger data-filter-action data-skeleton-action disabled tabindex="-1" aria-label="${t('settings:favoritesPanel.title')}" title="${t('settings:favoritesPanel.title')}" class="inline-grid ${size === 'default' ? 'size-9' : 'size-8'} flex-none place-items-center rounded-(--control-radius) border border-(--border-10) bg-(--surface) text-(--muted)">${islandGlyph('star', 'size-4')}</button></span>`;
}

/** 与 Board Input 的中号外框、前缀和正文使用相同几何。 */
export function islandSearchInput(placeholder: string, value = '', label = placeholder): string {
  return `<div data-input-size="medium" class="group flex h-max w-full flex-col items-start gap-1"><div data-rac class="relative flex w-full items-center rounded-2lg bg-background-tertiary-default text-foreground-icon-tertiary ring-2 ring-inset ring-transparent p-2"><div class="flex w-full items-center gap-2 min-w-0"><div class="flex flex-1 items-center gap-0.5 min-w-0">${islandGlyph('search', 'size-5 shrink-0')}<input type="search" enterkeyhint="search" readonly tabindex="-1" aria-label="${esc(label)}" value="${esc(value)}" placeholder="${esc(placeholder)}" class="min-w-0 flex-1 bg-transparent border-0 outline-none p-0 m-0 font-sans text-body-regular text-text-primary pl-1 placeholder:text-text-tertiary"></div></div></div></div>`;
}

export interface IslandButton {
  variant?: Variant;
  size?: Size;
  glyph?: string;
  label?: string;
  /** 追加在 `<button>` 上的原样属性，例如 `aria-disabled`、`aria-pressed`、`aria-label`。 */
  attrs?: string;
  /** 这颗键的字在窄工具行里收起、只留字形，对应 React 那侧按工具行宽度切换的 `iconOnly`。 */
  compact?: boolean;
}

/** 一颗与 Board UI `Button` 同尺寸、同变体的静止态按键。有字没图标、有图标没字、两者都有三种都按原组件排。 */
export function islandButton(
  { variant = 'primary', size = 'medium', glyph, label, attrs = '', compact = false }: IslandButton,
): string {
  const shape = label ? SIZE[size] : ICON_ONLY[size];
  /* `compact` 的键带着字（窄行里由样式收起），按带字的那一版排。 */
  const icon = glyph ? islandGlyph(glyph, label ? ICON_INLINE : ICON[size]) : '';
  const text = label ? `<span class="${LABEL[size]}"${compact ? ' data-compact-label' : ''}>${label}</span>` : '';
  return `<button type="button" class="${BASE} ${shape} ${VARIANT[variant]}"${attrs ? ` ${attrs}` : ''}>${icon}${text}</button>`;
}

type SelectSize = 'md' | 'sm';
const SELECT: Record<SelectSize, { box: string; value: string; chevron: string }> = {
  md: { box: 'gap-1.5 px-2.5 py-2 text-body-medium', value: 'gap-[5px]', chevron: 'size-4' },
  sm: { box: 'gap-1 px-[7px] py-1 text-body-2-medium', value: 'gap-1', chevron: 'size-3.5' },
};

/** Board UI `Select` 的静止态：外层 `group flex flex-col`，里面一颗带 `aria-haspopup="listbox"`
 *  的触发键。高度由 `react/styles.css` 按这个标记统一补齐，骨架用同一个元素和标记才吃得到那条规则。
 *  `label` 可以是一截等数据的占位条；`className` 落在外层，与组件的 `className` 同位。 */
export function islandSelect(
  label: string, { size = 'md', className = '', attrs = '', prefix = '' }:
  { size?: SelectSize; className?: string; attrs?: string; prefix?: string } = {},
): string {
  const shape = SELECT[size];
  /* `prefix` 与组件的同名参数同位：值前一截浅色的名字。 */
  const value = `<span class="flex min-w-0 items-center truncate ${shape.value}">${label}</span>`;
  const body = prefix
    ? `<span class="flex min-w-0 items-center ${size === 'sm' ? 'gap-1.5' : 'gap-2'}"><span aria-hidden="true" class="shrink-0 text-text-tertiary">${prefix}</span>${value}</span>`
    : value;
  return `<div class="group flex flex-col${className ? ` ${className}` : ''}"><button type="button" aria-haspopup="listbox"${attrs ? ` ${attrs}` : ''} class="flex w-full items-center justify-between rounded-2lg border border-border-button-default bg-background-primary-default shadow-xs text-text-primary ${shape.box}">${body}${islandGlyph('chevron-down', `shrink-0 text-text-secondary ${shape.chevron}`)}</button></div>`;
}

/** 处理队列页（垃圾文件、高清版、重复文件）的筛选浮层等数据时那一版，结构与类同
 *  `react/components/filter-glass.tsx` 的 `FilterGlassRows`：上排照给的 HTML 画（不给就不出这一行），
 *  下排读数的名目此刻就有，数字那一格是一条微光，右边是 `controls`（卡片／列表与排序键的等待态）。
 *  「全选」要等条数，骨架里不占位，它排在读数后面、不挤动右边那组。 */
export function islandGlassRows({ label, top = '', attrs = '', controls = '', className = '' }:
  { label: string; top?: string; attrs?: string; controls?: string; className?: string }): string {
  return `<div role="group" data-filter-glass="" data-glass-pane="" data-catalog-frame=""${attrs} class="sticky top-topbar z-10 mb-5.5 flex flex-col${className ? ` ${className}` : ''}">`
    + (top ? `<div data-filter-row="top" class="flex h-12 min-w-0 items-center gap-1.75 overflow-x-auto overscroll-x-contain px-3 py-2">${top}</div>` : '')
    + `<div data-filter-row="bottom" aria-busy="true" class="flex min-w-0 items-center gap-3 px-3 py-2 min-h-12">`
    + `<span data-catalog-summary=""><span data-catalog-readout="">${label} · <span data-skeleton="count" aria-hidden="true"`
    + ` class="relative inline-block h-3.5 w-12 rounded-md align-middle skeleton-sheen"></span></span></span>${controls}</div></div>`;
}
