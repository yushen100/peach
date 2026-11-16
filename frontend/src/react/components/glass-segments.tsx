/* 玻璃浮层上的分段控件（版式、卡片／列表）：选中那一格底下垫一块滑动玻璃，换选项时滑过去，
 * 同首页上排「全部、没看过、稍后看」那一排（`./use-view-glide.ts`）。
 *
 * 玻璃挂在外面一层定位宿主上，不挂进 RadioGroup：`useViewGlide` 以玻璃的父元素为原点量位置，
 * 分段键是这一层的定位子孙。被选中那一格自己的底由 `../styles.css` 在这一层里撤掉，只留玻璃。 */
import { useRef, type ReactNode } from 'react';
import { RadioGroup, type RadioGroupProps } from 'react-aria-components';

import { useViewGlide } from './use-view-glide';

export function GlassSegmentGroup({ value, children, ...props }: Omit<RadioGroupProps, 'value' | 'children'>
  & { value: string; children: ReactNode } & Record<`data-${string}`, string>) {
  const pane = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useViewGlide(pane, track, '[data-selected]', value);
  return (
    <span data-glide-segments="" className="relative inline-flex flex-none">
      <span ref={pane} data-view-glide="" aria-hidden="true" />
      <RadioGroup ref={track} {...props} value={value}>{children}</RadioGroup>
    </span>
  );
}
