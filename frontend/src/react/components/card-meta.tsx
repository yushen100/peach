/* 作品卡（`./media-card.tsx`）与关注卡（`../follow-feed/follow-card.tsx`）文字栏里共用的几格：署名里的名字、
 * 日期与标签行。两张卡的数据和动作不同，整张卡不合并；这几格的结构、字形与样式钩子只写这一份，
 * 区别经参数进来——名字外面包按钮还是链接由调用方给，标签能不能点由 `readOnly` 定。
 * 几何与配色都在 `./media-card.css` 的 `data-media-*` 上。 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/** 雪碧图里的一枚字形，写法同遗留层 `icon()`：尺寸与描边由 `./media-card.css` 按位置给。 */
export function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
}

/** 署名里的名字：人像字形加名字。外层元素（`data-media-who` 的按钮、链接或纯文本）归调用方。 */
export function WhoLabel({ name }: { name: ReactNode }) {
  return <><Icon name="user-round" /><span>{name}</span></>;
}

/** 署名行末尾的日期：日历字形加日期，收在 `data-media-facts` 里，窄卡上随它换到下一行。 */
export function CardDate({ value, label, title }: { value: string; label: string; title?: string }) {
  return <time data-media-release="" dateTime={value} title={title || label}><Icon name="calendar" />{label}</time>;
}

/** 卡片的标签行：最多三枚。能点的是筛选键（按钮，带 `data-tag`）；只读的是同一张脸的文字，
 *  不是禁用的按钮——它本来就不可操作，读屏不该念成「按钮，不可用」，也不该被当成控件选中。 */
export function CardTags({ tags, label, readOnly = false, attrs, lead, ...row }: {
  tags: readonly string[]; label(tag: string): string; readOnly?: boolean;
  /** 每一枚额外的属性：关注卡写上来源类型与自己的选择器钩子。 */
  attrs?(tag: string): Record<string, string | undefined>;
  /** 排在标签前面的那一枚（回收站卡放归入原因）。 */
  lead?: ReactNode;
} & ComponentPropsWithoutRef<'div'>) {
  return (
    <div {...row} data-media-tags="">
      {lead}
      {tags.map((tag) => readOnly
        ? <span key={tag} data-media-tag="" {...attrs?.(tag)}>{label(tag)}</span>
        : <button key={tag} type="button" data-media-tag="" data-tag={tag} {...attrs?.(tag)}>{label(tag)}</button>)}
    </div>
  );
}
