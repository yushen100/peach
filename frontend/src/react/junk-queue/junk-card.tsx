/* 垃圾队列里的一张卡，排法同 JAV 探索卡（`../jav/discovery-card.tsx`）：上面 16:9 的预览格（没有
 * 预览时是类型字形），下面名字，一行类型与大小，判定理由落在标签行；底部一排动作键：打开位置、
 * 判断（不是垃圾／重新判断）、移入回收站，再一行状态。卡上不画勾选框：多选走浮层上的「全选」与
 * 右上角开关，进了多选点卡片就是切换选中，封面角上出勾。
 *
 * 卡片盒复用馆藏作品卡的钩子（`data-media-card`／`data-media-pic`／`data-media-badge`／
 * `data-media-check`）：预览格、来源角标、悬停面、选中描边与勾是同一套，Shift 连选时壳按
 * `[data-media-grid] > [data-media-card]` 数本页的卡，垃圾卡也在其中。
 *
 * 标题照遗留层写成转义后的 HTML：`data-middle-truncate` 由中段截断（`src/ui-kit/middle-truncate.ts`）按宽度
 * 从中间截断，它直接改写这一格的文字，交给 React 管的话下一次重画会和它互相覆盖。 */
import { memo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { RiFolderOpenLine } from '@remixicon/react';
import { esc, fmtSize } from '@peach/legacy/core';
import { Button } from '@/components/base/buttons/button';

import {
  junkDecision, junkKindMeta,
  type JunkItem, type JunkOperation, type JunkQueueActions, type JunkQueueHelpers, type JunkView,
} from './junk-queue';
import { CardTags, Icon } from '../components/card-meta';
import { suppressShiftTextSelection } from '../components/row-click';
import { useDense } from '../components/use-dense';
import { useLibraryTints } from '../components/library-tint';
import { ListLibrary } from '../catalog-grid/catalog-list-page';
import { busyProps } from '../settings/busy-props';
import { t } from '../../i18n';
import { partsLabel } from '../../core/server-text';

export interface JunkCardProps {
  item: JunkItem;
  view: JunkView;
  selected: boolean;
  selectMode: boolean;
  helpers: JunkQueueHelpers;
  actions: JunkQueueActions;
  copies?: { count: number; bytes: number; expanded: boolean; toggle(): void };
}

type Busy = '' | 'reveal' | JunkOperation;

const picking = (selectMode: boolean, event: MouseEvent) => selectMode || event.shiftKey || event.ctrlKey || event.metaKey;

/** 卡片与列表行共用的那三颗键与状态行：打开位置、判断（不是垃圾／重新判断）、移入回收站。
 *  写 ledger 的两颗成功后壳重读队列，这一条随之离开；失败由壳报，键恢复成可点。 */
export function useJunkActions(item: JunkItem, view: JunkView, actions: JunkQueueActions) {
  const [busy, setBusy] = useState<Busy>('');
  const [status, setStatus] = useState('');
  const reveal = (event?: MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (busy === 'reveal') return;
    setBusy('reveal');
    setStatus('');
    void actions.reveal(item).then(setStatus, () => {}).finally(() => setBusy(''));
  };
  const operate = (operation: JunkOperation) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy === operation) return;
    setBusy(operation);
    setStatus('');
    void actions.operate(item, operation).catch(() => {}).finally(() => setBusy(''));
  };
  return { busy, status, reveal, operate, decision: junkDecision(view) };
}

export function JunkActions({ state, compact }: { state: ReturnType<typeof useJunkActions>; compact: boolean }) {
  const { busy, status, reveal, operate, decision } = state;
  const size = compact ? 'small' : 'medium';
  return (
    <div data-jav-actions="" data-junk-actions="" data-compact={compact ? '' : undefined} data-has-source=""
      className="flex flex-wrap gap-2">
      <Button variant="secondary" size={size} data-junk-action="reveal" iconOnly={compact}
        leadingIcon={compact ? RiFolderOpenLine : undefined} title={t('cleanup:junk.revealTitle')} aria-label={t('cleanup:junk.revealTitle')}
        {...busyProps(busy === 'reveal')} onClick={reveal}>{compact ? null : t('cleanup:junk.reveal')}</Button>
      <Button variant="secondary" size={size} data-junk-action={decision.operation} title={decision.label}
        {...busyProps(busy === decision.operation)} onClick={operate(decision.operation)}>{decision.label}</Button>
      <Button variant="danger" size={size} data-junk-action="dispose" title={t('cleanup:duplicates.moveToTrash')}
        {...busyProps(busy === 'dispose')} onClick={operate('dispose')}>{t('cleanup:duplicates.moveToTrash')}</Button>
      <span data-junk-state="" aria-live="polite" className="basis-full text-caption-1-regular text-text-secondary empty:hidden">
        {status}</span>
    </div>
  );
}

/** 浏览器里看得了的两类：视频进详情，图片开原图。 */
export const junkOpenable = (item: JunkItem) => item.junk_kind === 'video' || item.junk_kind === 'image';
/** 判定理由按段拆成几枚只读标签。 */
export const junkReasons = (item: JunkItem) => (item.why ? partsLabel(item.why_parts, item.why).split(' · ').filter(Boolean) : []);
/** 预览图地址：视频取第 4 帧，图片取缩略图，别的没有。 */
export const junkPreview = (item: JunkItem) =>
  item.junk_kind === 'video' ? `/thumb?id=${item.id}&c=4` : item.junk_kind === 'image' ? `/photo-thumb?id=${item.id}` : '';

function JunkCardView({ item, view, selected, selectMode, helpers, actions, copies }: JunkCardProps) {
  const card = useRef<HTMLElement | null>(null);
  const dense = useDense();
  const state = useJunkActions(item, view, actions);
  const kind = item.junk_kind || 'other';
  const [label, glyph] = junkKindMeta(item);
  const name = String(item.name || '');
  const preview = junkPreview(item);
  const reasons = junkReasons(item);
  /* 媒体库来源色同首页作品卡：用户给这个媒体库选了颜色时整张卡铺淡色（`../components/media-card.css`）。 */
  const tints = useLibraryTints();
  const library = typeof item.library_id === 'string' && tints.get(item.library_id)?.color ? item.library_id : undefined;

  /* 多选与修饰键优先：点在卡上任何地方（键行除外）都是切换选中。不在多选里时点卡片是先看清再判断：
     视频与图片打开预览，浏览器里看不了的那几类同「查看位置」。勾选框只有它自己那一格。 */
  const clickCard = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('[data-junk-actions]')) return;
    if (picking(selectMode, event)) {
      event.preventDefault();
      actions.toggleSelection(item.id, event.shiftKey);
      return;
    }
    if (!junkOpenable(item)) { state.reveal(event); return }
    if (card.current) actions.open(item, card.current);
  };

  return (
    <article ref={card} data-media-card="" data-jav-card="" data-queue-card="" data-junk-card="" data-id={item.id} data-junk-kind={kind}
      data-library={library}
      data-selected={selected ? '' : undefined}
      onClick={clickCard} onMouseDown={suppressShiftTextSelection}>
      <div data-media-pic="" style={{ '--card-ratio': String(16 / 9) } as CSSProperties}>
        <span data-media-glyph=""><Icon name={glyph} /><b>{label}</b></span>
        {preview
          ? <span data-media-art="thumb" dangerouslySetInnerHTML={{
            __html: `<img class="poster" src="${preview}" width="640" height="360" alt="" loading="lazy" data-drop="self">`,
          }} />
          : null}
        <div data-media-badge="" dangerouslySetInnerHTML={{ __html: helpers.badgeHtml(item.location || '', item.cost || '') }} />
        <span data-media-check=""><Icon name="check" /></span>
      </div>
      <div data-media-meta="">
        <div data-media-text="">
          <span data-media-title="" data-junk-title="" data-middle-truncate="" title={name}
            dangerouslySetInnerHTML={{ __html: esc(name || t('cleanup:junk.untitled')) }} />
          <div data-media-byline="">
            <span data-media-who=""><Icon name={glyph} /><span>{label}</span></span>
            {typeof item.library_id === 'string' && item.library_id
              ? <ListLibrary item={{ library_id: item.library_id }} /> : null}
            <span data-media-facts=""><span data-media-size=""><Icon name="hard-drive" />
              {Number(item.size) > 0 ? fmtSize(Number(item.size)) : t('cleanup:junk.unknownSize')}</span></span>
          </div>
          <CardTags tags={reasons} label={(tag) => tag} readOnly title={reasons.join(' · ') || undefined} />
        </div>
      </div>
      {copies ? <div data-junk-actions="" className="flex flex-wrap items-center gap-2 px-4 py-2 text-caption-1-regular text-text-secondary">
        <span>{t('cleanup:junk.copies', { count: copies.count, size: fmtSize(copies.bytes) })}</span>
        <Button variant="ghost" size="small" onClick={(event) => { event.stopPropagation(); copies.toggle() }}>
          {t(copies.expanded ? 'cleanup:junk.hideCopies' : 'cleanup:junk.showCopies')}
        </Button>
      </div> : null}
      <JunkActions state={state} compact={dense} />
    </article>
  );
}

/** 一屏上百张，选择之外的重画不该连带每一张：比较的都是引用，壳递进来的助手与动作身份不变。 */
export const JunkCard = memo(JunkCardView);
