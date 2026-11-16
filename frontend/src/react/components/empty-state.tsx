/* 没有数据或结果时的空态：图标、标题、说明同处一个组件里（`peach-web-ui`）。
 *
 * 注册表里没有空态条目。标题是真的标题元素，冒烟用例按它认页面主体：一片白和「画出来了、
 * 只是没有内容」在别的断言下长得一模一样。根上的 `data-empty-state` 是给冒烟与外观用例认的
 * 钩子，不参与样式。标准与紧凑两档共用图标、字体、背景和边框。
 *
 * 空态常替卡片落进网格里（外层常是 `display: contents` 的包裹），所以自己铺满整行、
 * 跨满所有列，同旧版 `.ui-emptystate`；不然只占一列卡宽，旁边空出一大片。 */
import type { ComponentType, ReactNode } from 'react';
import { Button } from '@/components/base/buttons/button';

type Glyph = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

const SIZE = {
  standard: 'min-h-80 px-6 py-12',
  compact: 'min-h-60 px-4 py-6',
} as const;

/** 把空态的添加入口接到页面已有表单。 */
export function EmptyFocusButton({ target, children }: { target: string; children: ReactNode }) {
  return <Button size="small" variant="secondary" onClick={() => document.querySelector<HTMLElement>(target)?.focus()}>{children}</Button>;
}

/** `framed` 为否时不画外框和底色：空态本身就是整个弹层或整页的内容时，再套一层框只是多一张空卡片。 */
export function EmptyState(
  { icon: Icon, title, actions, children, size = 'standard', framed = true }:
  { icon: Glyph; title: string; actions?: ReactNode; children: ReactNode;
    size?: keyof typeof SIZE; framed?: boolean },
) {
  return (
    <div data-empty-state="" data-empty-size={size} data-empty-framed={framed ? '' : undefined} className={`col-span-full flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-2 text-center ${
      framed ? 'rounded-floating border border-separator-border bg-background-secondary-default ' : ''}${SIZE[size]}`}>
      <span aria-hidden className="mb-2 flex size-empty-glyph shrink-0 items-center justify-center rounded-floating border border-text-primary/15 p-2.5 text-text-secondary">
        <Icon aria-hidden className="size-8 shrink-0" />
      </span>
      <h3 className="text-body-semibold text-pretty text-text-primary">{title}</h3>
      {children != null ? <p className="max-w-empty-copy text-body-2-regular leading-empty-copy text-text-secondary">{children}</p> : null}
      {/* 去处属于这一块，不摆到框外面：「还没有内容」和一个不知道属于谁的按钮分开放时，
          读者要先把两样东西连起来才知道按下去做什么。 */}
      {actions ? <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
