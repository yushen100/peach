/* 复核筛选与批量动作：分组方式、分类筛选、全选本页留在吸顶栏，所选项目的判定动作
 * 使用首页同款底部悬浮框。
 *
 * 分组方式和筛选项按**整条队列**算，卡片只画当前这一页：筛选里的计数说的是队列，不是
 * 这一屏。筛选条高度保持不变，勾选项目时不会把下滑后吸顶的内容往下推。 */
import { useLayoutEffect, useRef, useState } from 'react';
import { RiCheckDoubleLine } from '@remixicon/react';

import { Button } from '@/components/base/buttons/button';
import { Select, SelectItem } from '../components/select';
import { exitPageSelection } from '../components/page-selection';
import { SelectionDock, type DockAction } from '../components/selection-dock';
import { FilterGlassRows } from '../components/filter-glass';
import { useViewGlide } from '../components/use-view-glide';
import type { ReviewGroup, ReviewGrouping, ReviewQueue, ReviewRow } from './review';
import { commonReviewSources, REVIEW_QUEUES, REVIEW_QUEUE_LABELS } from './review';
import { t } from '../../i18n';

export interface BulkToolbarProps {
  queueView?: ReviewQueue;
  queueCounts?: Record<ReviewQueue, number>;
  onQueueChange(queue: ReviewQueue): void;
  locked: boolean;
  fields: ReviewGroup[];
  fieldFilter: string;
  onFieldFilter(field: string): void;
  groupOptions: [ReviewGrouping, string][];
  groupBy: ReviewGrouping;
  onGroupBy(next: ReviewGrouping): void;
  groups: ReviewGroup[];
  filter: string;
  onFilter(next: string): void;
  /** 当前这一页上的行，全选就是全选它们。 */
  pageKeys: string[];
  selected: ReadonlySet<string>;
  /** 当前筛选下全部页的行；比本页多时给「全选全部」，一次选中跨页的整份。 */
  allKeys?: readonly string[];
  onSelected(next: Set<string>): void;
  /** 选中的那些行，用来算共同来源。 */
  selectedRows: ReviewRow[];
  metadata: boolean;
  busy: boolean;
  feedback: string;
  onUnifySource(source: string): void;
  /** 所选行上的判定键（忽略、稍后、放回待处理、通过），每颗都声明确认与撤销。 */
  actions: readonly DockAction[];
}

export function BulkToolbar(props: BulkToolbarProps) {
  const {
    groupOptions, groupBy, onGroupBy, groups, filter, onFilter, pageKeys, allKeys = pageKeys, selected, onSelected,
    selectedRows, metadata, busy, feedback, onUnifySource, actions, queueView = 'pending',
    queueCounts, onQueueChange, locked, fields, fieldFilter, onFieldFilter,
  } = props;
  const shown = pageKeys.filter((key) => selected.has(key));
  const allShown = shown.length > 0 && shown.length === pageKeys.length;
  const everything = allKeys.length > pageKeys.length && allKeys.every((key) => selected.has(key));
  const sources = commonReviewSources(selectedRows);
  const needsSource = metadata && selectedRows.some((row) => (row.candidates?.length || 0) > 1);
  const sourceLabel = sources.length ? t('manage:reviewToolbar.sourceForAll') : t('manage:reviewToolbar.noCommonSource');
  const statePane = useRef<HTMLSpanElement>(null);
  const stateRow = useRef<HTMLDivElement>(null);
  const controlRow = useRef<HTMLDivElement>(null);
  const [joinedRows, setJoinedRows] = useState(false);
  const stateGlide = useViewGlide(statePane, stateRow, '[data-entity-state][aria-pressed="true"]', queueView);
  useLayoutEffect(() => {
    const states = stateRow.current, controls = controlRow.current;
    const statusLine = states?.parentElement;
    const frame = states?.closest<HTMLElement>('[data-review-filter]');
    if (!states || !controls || !statusLine || !frame) return;
    const measure = () => setJoinedRows(controls.offsetHeight > 0
      && Math.abs(statusLine.getBoundingClientRect().top - controls.getBoundingClientRect().top) < 1);
    const observer = new ResizeObserver(measure);
    for (const element of [frame, states, controls]) observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const toggleAll = () => {
    const next = new Set(selected);
    for (const key of pageKeys) { if (allShown) next.delete(key); else next.add(key) }
    onSelected(next);
  };

  return (
    <>
      <FilterGlassRows label={t('manage:reviewToolbar.filters')} topLabel={t('manage:reviewToolbar.processingStatus')} attrs={{ 'data-review-filter': '' }}
        className="mb-0 flex-row flex-wrap" topClassName="max-w-full flex-none"
        bottomClassName={pageKeys.length ? 'min-h-12 max-w-full flex-none flex-wrap' : 'hidden'}
        bottomRef={controlRow}
        panes={<span ref={statePane} data-view-glide="" aria-hidden="true" />}
        top={<div ref={stateRow} role="group" aria-label={t('manage:reviewToolbar.reviewStatus')} data-entity-states=""
          onPointerLeave={stateGlide.leave}>
          {REVIEW_QUEUES.map(key => <button key={key} type="button" data-entity-state={key} data-entity-press=""
            disabled={busy} aria-pressed={queueView === key} onPointerEnter={stateGlide.hover}
            onClick={() => { if (key !== queueView) onQueueChange(key) }}>
            <span data-copy-key={`review.queue.${key}`}>{REVIEW_QUEUE_LABELS[key]}</span>{' '}
            <span className="ms-1.5 tabular-nums text-caption-1-medium text-text-secondary">
              {queueCounts ? queueCounts[key].toLocaleString() : '…'}
            </span>
          </button>)}
          <span data-entity-sep="" aria-hidden="true" className={joinedRows ? undefined : 'invisible'} />
        </div>}
        bottom={pageKeys.length ? <>
        {metadata && fields.length ? <Select aria-label={t('manage:reviewToolbar.filterField')} size="sm"
          prefix={<span data-copy-key="review.filter.field" className="pointer-events-auto">{t('manage:reviewToolbar.field')}</span>}
          selectedKey={fieldFilter || '*'} isDisabled={busy}
          onSelectionChange={(key) => { if (key !== null) onFieldFilter(String(key) === '*' ? '' : String(key)) }}>
          <SelectItem id="*">{t('manage:shared.all')}</SelectItem>
          {fields.map(field => <SelectItem key={field.key} id={field.key}>
            {`${field.title} · ${field.rows.length}`}
          </SelectItem>)}
        </Select> : null}
        <Select aria-label={t('manage:reviewToolbar.groupBy')} size="sm" selectedKey={groupBy}
          onSelectionChange={(key) => { if (key !== null) onGroupBy(String(key) as ReviewGrouping) }}>
          {groupOptions.map(([key, name]) => <SelectItem key={key} id={key}>{name}</SelectItem>)}
        </Select>
        {/* 只有一组时没什么可筛的：一个「全部分类」的下拉读起来像坏了。 */}
        {groups.length > 1 ? (
          <Select aria-label={groupBy === 'field' ? t('manage:reviewToolbar.filterFieldGroup') : t('manage:reviewToolbar.filterGroup')} size="sm" prefix={t('manage:reviewToolbar.group')}
            selectedKey={filter || '*'}
            onSelectionChange={(key) => { if (key !== null) onFilter(String(key) === '*' ? '' : String(key)) }}>
            <SelectItem id="*">{t('manage:shared.all')}</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.key} id={group.key}>
                {`${group.title} · ${group.rows.length}`}
              </SelectItem>
            ))}
          </Select>
        ) : null}
        {locked ? null : <Button variant="secondary" size="small" leadingIcon={RiCheckDoubleLine}
          aria-pressed={allShown} disabled={busy} onClick={toggleAll}>
          {allShown ? t('manage:reviewToolbar.clearSelection') : filter ? t('manage:reviewToolbar.selectGroup') : t('manage:reviewToolbar.selectPage')}
        </Button>}
        {locked || allKeys.length <= pageKeys.length || everything ? null : <Button variant="secondary" size="small"
          disabled={busy} onClick={() => onSelected(new Set([...selected, ...allKeys]))}>
          {t('manage:reviewToolbar.selectAll', { count: allKeys.length })}
        </Button>}
        </> : null} />

        <SelectionDock label={t('manage:reviewToolbar.selectedDock')} visible={!locked && selected.size > 0} count={t('manage:reviewToolbar.selectedCount', { count: selected.size })}
          actions={actions}
          leading={needsSource && queueView !== 'ignored' ? (
            <Select aria-label={t('manage:reviewToolbar.sourceForAll')} size="sm" selectedKey=""
              isDisabled={busy || !sources.length}
              onSelectionChange={(key) => { if (key !== null && key !== '') onUnifySource(String(key)) }}>
              <SelectItem id="">{sourceLabel}</SelectItem>
              {sources.map((source) => <SelectItem key={source} id={source}>{source}</SelectItem>)}
            </Select>
          ) : null}>
          <Button variant="ghost" size="small" disabled={busy}
            onClick={exitPageSelection}>{t('manage:reviewToolbar.deselect')}</Button>
          {feedback
            ? <p role="status" className="w-full text-body-2-regular text-text-secondary">{feedback}</p>
            : null}
        </SelectionDock>
    </>
  );
}
