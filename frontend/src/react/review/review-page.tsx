/* 人工复核页：把带出处的候选摆到人面前，等一次明确的批准或否决。
 *
 * ADR-0018 的确定项在扫描与资料处理任务结束时已经落库；这一页只读取剩下的判断题，
 * 打开页面不会再触发一次写操作。
 *
 * 地址栏与组件状态的分界（ADR-0031「迁移桥接」）：
 * - `category` 与 `queue` 在地址栏上，分类和处理状态都能通过链接及刷新还原，
 *   刷新也要还原——判到一半按了刷新却被扔回元数据字段，等于重新找位置。
 * - 分组、筛选、页码是组件状态。复核队列是消耗性的：判一条它就少一条，第 3 页指的是
 *   哪二十行随每一次判定而变，写进地址栏分享出去只会指向另一批东西。换分类、换分组、
 *   换筛选都回第 1 页，也正说明页码依附于此刻这一屏的看法，不是这一页的身份。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RiCheckboxCircleLine } from '@remixicon/react';

import { Button } from '@/components/base/buttons/button';
import type { ReviewProps } from '../bundle';
import { errorMessage } from '../../api';
import type { BulkAction } from '../components/bulk-action';
import { DataTableFooter } from '../components/table-controls';
import { queryClient } from '../query';
import { enterPageSelection, usePageSelection } from '../components/page-selection';
import { EmptyState } from '../components/empty-state';
import { Note } from '../components/note';
import { Page } from '../components/page';
import { SortableBoardTabs, useNavigationOrder } from '../components/navigation-order';
import { ExternalLink } from '../settings/section';
import { AutoLandingsCard } from './auto-landings-card';
import { BulkToolbar } from './bulk-toolbar';
import { GenreTagList } from './candidate-form';
import { ReviewCard } from './review-card';
import type { DecisionStatus, ReviewCategory, ReviewData, ReviewGrouping, ReviewQueue, ReviewRow, RowChoice } from './review';
import {
  canApprove, currentReviewRow, DEFAULT_CATEGORY, decisionPayload, decisionReceipt, defaultChoice,
  fetchReview, filterReviewRows, groupReviewRows, isReviewCategory, mirrorText,
  REVIEW_CATEGORIES, REVIEW_KEY, REVIEW_LABELS, reviewGroupingOptions,
  REVIEW_QUEUES, reviewQueueData, reviewQueueOf,
  reviewWindow, selectReviewRange, settleReviewRows, submitDecision,
} from './review';
import { t } from '../../i18n';

// 与配置页共用 BoardUI gray PillTab 样式；保留 tabpanel 与复核队列计数。
const TAB_CLASS = 'flex cursor-pointer items-center justify-between gap-2';

export function ReviewPage(props: ReviewProps) {
  const categoryOrder = useNavigationOrder('review').keys.filter(isReviewCategory);
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width:900px)').matches);
  useEffect(() => {
    const query = matchMedia('(max-width:900px)');
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const {
    route, openItem, openEntity, revealSource, toast,
    readOnly, readOnlyMessage, writerUrl,
  } = props;
  const [category, setCategory] = useState<ReviewCategory>(
    isReviewCategory(props.category) ? props.category : DEFAULT_CATEGORY);
  const [queueView, setQueueView] = useState<ReviewQueue>(() => reviewQueueOf(props.queue));
  const [groupBy, setGroupBy] = useState<ReviewGrouping>('candidates');
  const [filter, setFilter] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  /* 勾选、选中的来源值、勾上的作品样本、失败原因，身份都是 `item_key`：翻页、换分组
     之后手里还是同一批东西。它们不进地址栏——那是这一刻手里的一批，不是这一页的身份。 */
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set<string>());
  usePageSelection(() => setSelected(new Set<string>()));
  // 直接勾某一项等于进入多选（右上角开关同一份状态）。
  useEffect(() => { if (selected.size) enterPageSelection() }, [selected]);
  const [choices, setChoices] = useState<ReadonlyMap<string, RowChoice>>(new Map());
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const [feedback, setFeedback] = useState('');
  /* 区间多选的锚点：Shift 从上一次点过的那一格算起，与馆藏页同一套语义。 */
  const anchor = useRef<string | null>(null);
  const [revealing, setRevealing] = useState(0);
  const [revealNote, setRevealNote] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false }, []);

  const review = useQuery({ queryKey: REVIEW_KEY, queryFn: ({ signal }) => fetchReview(signal) });

  const data: ReviewData = review.data || { sections: {}, counts: {},
    queues: { later: { sections: {}, counts: {} }, ignored: { sections: {}, counts: {} } } };
  const snapshot = reviewQueueData(data, queueView);
  const queueCounts = review.data ? Object.fromEntries(REVIEW_QUEUES.map(key => [key,
    REVIEW_CATEGORIES.reduce((sum, category) =>
      sum + Number(reviewQueueData(data, key).counts[category] || 0), 0)])) as Record<ReviewQueue, number> : undefined;
  const queue = snapshot.sections[category] || [];
  const metadata = category === 'metadata_fields';
  const locked = readOnly;

  useEffect(() => {
    const available = new Set(queue.map(row => row.item_key));
    setSelected(current => {
      const kept = [...current].filter(key => available.has(key));
      return kept.length === current.size ? current : new Set(kept);
    });
    setChoices(current => {
      const kept = [...current].filter(([key]) => available.has(key));
      return kept.length === current.size ? current : new Map(kept);
    });
    setErrors(current => {
      const kept = [...current].filter(([key]) => available.has(key));
      return kept.length === current.size ? current : new Map(kept);
    });
  }, [queue]);

  const fields = useMemo(() => metadata ? groupReviewRows(queue, 'field') : [], [queue, metadata]);
  const activeField = fields.some(field => field.key === fieldFilter) ? fieldFilter : '';
  const fieldQueue = useMemo(() => metadata ? filterReviewRows(queue, 'field', activeField) : queue,
    [queue, metadata, activeField]);
  const groupOptions = useMemo(() => reviewGroupingOptions(fieldQueue, metadata), [fieldQueue, metadata]);
  const activeGroupBy: ReviewGrouping =
    groupOptions.some(([key]) => key === groupBy) ? groupBy : 'candidates';
  const groups = useMemo(() => groupReviewRows(fieldQueue, activeGroupBy), [fieldQueue, activeGroupBy]);
  const activeFilter = groups.some((group) => group.key === filter) ? filter : '';
  const filteredRows = useMemo(() => filterReviewRows(fieldQueue, activeGroupBy, activeFilter),
    [fieldQueue, activeGroupBy, activeFilter]);
  const win = useMemo(() => reviewWindow(filteredRows, page, pageSize), [filteredRows, page, pageSize]);
  const pageKeys = win.rows.map((row) => row.item_key);
  const onPage = new Set(pageKeys);
  /* 这一页上一张都没有的组不画分组条：条子底下空着，读起来像加载坏了。 */
  const pageGroups = groups
    .map((group) => ({ ...group, rows: group.rows.filter((row) => onPage.has(row.item_key)) }))
    .filter((group) => group.rows.length);

  const choiceOf = (row: ReviewRow): RowChoice => choices.get(row.item_key) || defaultChoice(row);
  const selectedRows = useMemo(() => queue.filter((row) => selected.has(row.item_key)), [queue, selected]);

  const forget = (keys: string[]) => {
    const gone = new Set(keys);
    setSelected((now) => new Set([...now].filter((key) => !gone.has(key))));
    setChoices((now) => new Map([...now].filter(([key]) => !gone.has(key))));
    setErrors((now) => new Map([...now].filter(([key]) => !gone.has(key))));
  };
  const fail = (key: string, message: string) =>
    setErrors((now) => new Map(now).set(key, message));

  /* 换分类就是换一条队列：上一条队列里的勾选、选中的来源和失败原因都不再有对应的行，
     留着只会让工具条报一个算不出来的数。 */
  const resetView = () => {
    setGroupBy('candidates');
    setFilter('');
    setFieldFilter('');
    setPage(1);
    setSelected(new Set());
    setChoices(new Map());
    setErrors(new Map());
    setFeedback('');
    anchor.current = null;
  };
  const goCategory = (next: ReviewCategory) => {
    setCategory(next);
    resetView();
    route({ category: next === DEFAULT_CATEGORY ? '' : next, queue: queueView === 'pending' ? '' : queueView });
  };
  const goQueue = (next: ReviewQueue) => {
    setQueueView(next);
    resetView();
    route({ category: category === DEFAULT_CATEGORY ? '' : category, queue: next === 'pending' ? '' : next });
  };

  const decide = useMutation({
    mutationFn: ({ row, status, category: target }: { row: ReviewRow; status: DecisionStatus; category: ReviewCategory }) =>
      submitDecision(decisionPayload(target, currentReviewRow(target, row), status, choiceOf(row))),
    onSuccess: (result, { row, status, category: target }) => {
      if (!result.ok) { fail(row.item_key, result.error || t('manage:reviewPage.decisionRejected')); return }
      settleReviewRows(target, [row.item_key], status);
      forget([row.item_key]);
      toast(decisionReceipt(status));
    },
    onError: (cause, { row }) => fail(row.item_key, errorMessage(cause)),
  });

  /* 批量逐条提交：失败的留在屏幕上供重试，成功的立刻从队列里摘掉。整批一次性交上去的话，
     中间任何一条被服务端拒绝，用户都不知道前面几条到底写没写。 */
  const bulk = useMutation({
    mutationFn: async ({ status, category: target, rows }: {
      status: DecisionStatus; category: ReviewCategory; rows: ReviewRow[];
    }) => {
      const done: string[] = [];
      const failures: [string, string][] = [];
      for (const [at, row] of rows.entries()) {
        if (!alive.current) break;
        setFeedback(t('manage:reviewPage.processingProgress', { current: at, total: rows.length }));
        try {
          const result = await submitDecision(decisionPayload(target, currentReviewRow(target, row), status, choiceOf(row)));
          if (!result.ok) throw new Error(result.error || t('manage:reviewPage.itemNotAccepted'));
          done.push(row.item_key);
        } catch (cause) {
          failures.push([row.item_key, errorMessage(cause)]);
        }
      }
      return { status, category: target, done, failures };
    },
    onSuccess: ({ status, category: target, done, failures }) => {
      settleReviewRows(target, done, status);
      forget(done);
      failures.forEach(([key, message]) => fail(key, message));
      setFeedback('');
    },
    onError: (cause) => { setFeedback(errorMessage(cause)) },
  });

  /* 判定键：忽略与稍后能放回待处理，放回待处理能按原来的队列改回去；通过会写进真相字段，撤不回。
     撤销只动这一批里真的写成了的那几条。 */
  const host = { receipt: toast, failure: (cause: unknown) => setFeedback(errorMessage(cause)) };
  const back: Partial<Record<ReviewQueue, DecisionStatus>> = { ignored: 'rejected', later: 'skipped' };
  const decideMany = (status: DecisionStatus, label: string): BulkAction<ReviewRow> => {
    let outcome = { done: [] as string[], failures: [] as unknown[] };
    return {
    key: status, label, reversal: status === 'approved' ? 'irreversible' : 'undo', danger: false,
    confirm: (rows) => {
      if (status === 'approved' && metadata && rows.some((row) => !choiceOf(row).candidateKey)) {
        throw new Error(t('manage:reviewPage.chooseSourceFirst'));
      }
      setFeedback('');
      return { title: label, body: t(`manage:reviewPage.confirm.${status}`, { count: rows.length }) };
    },
    run: async (rows) => {
      outcome = await bulk.mutateAsync({ status, category, rows: [...rows] });
      const { done } = outcome;
      if (status === 'approved') return;
      const target = category;
      const settled = rows.filter((row) => done.includes(row.item_key));
      const previous = status === 'restore' ? back[queueView] : 'restore';
      return async () => {
        for (const row of settled) {
          await submitDecision(decisionPayload(target, currentReviewRow(target, row), previous as DecisionStatus, choiceOf(row)));
        }
        await queryClient.invalidateQueries({ queryKey: REVIEW_KEY });
      };
    },
    receipt: () => t({ approved: 'manage:reviewPage.approvedCount', rejected: 'manage:reviewPage.ignoredCount',
      skipped: 'manage:reviewPage.laterCount', restore: 'manage:reviewPage.pendingCount' }[status], { count: outcome.done.length })
      + (outcome.failures.length ? t('manage:reviewPage.notCompletedSuffix', { count: outcome.failures.length }) : ''),
    };
  };
  const approvable = selectedRows.every((row) => canApprove(category, row));
  const bulkActions = [
    ...(queueView !== 'ignored' ? [decideMany('rejected', t('manage:reviewToolbar.ignoreSelected'))] : []),
    queueView === 'pending' ? decideMany('skipped', t('manage:reviewToolbar.laterSelected')) : decideMany('restore', t('manage:reviewToolbar.restoreSelected')),
    ...(queueView !== 'ignored' ? [decideMany('approved', t('manage:reviewToolbar.approveSelected'))] : []),
  ].map((action) => ({ action, items: selectedRows, host,
    disabled: bulk.isPending || decide.isPending || (action.key === 'approved' && !approvable) }));

  /* 统一选择来源只动所选那几行的选中项，不替人按下「通过」：改的是要写什么，判断仍归人。 */
  const unifySource = (source: string) => {
    setChoices((now) => {
      const next = new Map(now);
      for (const row of selectedRows) {
        const candidate = row.candidates?.find((item) => item.source === source);
        if (candidate) next.set(row.item_key, { ...choiceOf(row), candidateKey: candidate.candidate_key });
      }
      return next;
    });
    setFeedback(t('manage:reviewPage.sourceChosen', { source }));
  };

  const reveal = async (id: number) => {
    if (revealing) return;
    setRevealing(id);
    setRevealNote('');
    const note = await revealSource(id);
    if (!alive.current) return;
    setRevealing(0);
    setRevealNote(note);
  };

  const mirror = mirrorText(data.mirror, readOnlyMessage);
  const genreTags = data.genre_tags || [];
  const handlers = {
    openItem, openEntity, onReveal: reveal, revealing, revealNote, toast,
  };

  return (
    <Page>
      <div className="flex flex-col gap-5 pb-10">
      {locked ? (
        <Note tone="warning" title={t('manage:reviewPage.readOnly')}
          extra={writerUrl
            ? <p className="text-body-2-regular">
                <ExternalLink href={writerUrl}>{t('manage:reviewPage.goToPrimary')}</ExternalLink>
              </p>
            : undefined}>
          {mirror}
        </Note>
      ) : null}
      <GenreTagList tags={genreTags} />

      {/* 分类目录位于正文左侧；窄屏使用正文上方的导航。 */}
      <div className="flex flex-col gap-5 review-split:flex-row review-split:items-start review-split:gap-6">
        <div data-section-nav className="w-full min-w-0 review-split:sticky review-split:top-topbar review-split:w-review-tabs review-split:shrink-0">
          <h2 id="reviewcategories">{t('manage:reviewPage.categories')}</h2>
          <SortableBoardTabs group="review" label={t('manage:reviewPage.categories')} value={category} onChange={goCategory}
            orientation={narrow ? 'horizontal' : 'vertical'} panelPrefix="review" sectionItems
            className="" itemClassName={TAB_CLASS} disabled={decide.isPending || bulk.isPending}
            tabs={REVIEW_CATEGORIES.map((key) => {
              const count = Number(snapshot.counts[key] || 0);
              return { value: key, label: REVIEW_LABELS[key], badge: count
                    ? <span className="tabular-nums text-caption-1-medium text-text-secondary">
                        {count.toLocaleString()}
                      </span>
                    : null };
            })} />
        </div>

        <div role="tabpanel" id={`review-panel-${category}`} aria-labelledby={`review-tab-${category}`}
          className="flex min-w-0 flex-1 flex-col gap-5">
            <BulkToolbar queueView={queueView} queueCounts={queueCounts} onQueueChange={goQueue} locked={locked}
              fields={fields} fieldFilter={activeField}
              onFieldFilter={(next) => { setFieldFilter(next); setFilter(''); setPage(1) }}
              groupOptions={groupOptions} groupBy={activeGroupBy}
              onGroupBy={(next) => { setGroupBy(next); setFilter(''); setPage(1) }}
              groups={groups} filter={activeFilter}
              onFilter={(next) => { setFilter(next); setPage(1) }}
              pageKeys={pageKeys} allKeys={filteredRows.map((row) => row.item_key)} selected={selected} onSelected={setSelected}
              selectedRows={selectedRows} metadata={metadata}
              busy={bulk.isPending || decide.isPending} feedback={feedback}
              onUnifySource={unifySource} actions={bulkActions} />

          {win.rows.length ? pageGroups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              {pageGroups.length > 1 || activeGroupBy !== 'candidates' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-body-medium text-text-primary">
                    {`${group.title} · ${group.rows.length}`}
                  </h3>
                  {locked ? null : (
                    <Button variant="ghost" size="small" onClick={() => {
                      const keys = group.rows.map((row) => row.item_key);
                      const all = keys.every((key) => selected.has(key));
                      const next = new Set(selected);
                      for (const key of keys) { if (all) next.delete(key); else next.add(key) }
                      setSelected(next);
                    }}>
                      {group.rows.every((row) => selected.has(row.item_key)) ? t('manage:reviewPage.clearGroup') : t('manage:reviewPage.selectGroup')}
                    </Button>
                  )}
                </div>
              ) : null}
              <div className="review-grid gap-5">
                {group.rows.map((row) => (
                  <ReviewCard key={row.item_key} category={category} row={row} queueView={queueView}
                    choice={choiceOf(row)}
                    onChoice={(next) => setChoices((now) => new Map(now).set(row.item_key, next))}
                    selected={selected.has(row.item_key)}
                    onSelect={(range, checked) => setSelected((now) => {
                      const next = new Set(now);
                      anchor.current = selectReviewRange(
                        next, pageKeys, anchor.current, row.item_key, range, checked);
                      return next;
                    })}
                    locked={locked}
                    busy={bulk.isPending || decide.isPending && decide.variables?.row.item_key === row.item_key}
                    problem={errors.get(row.item_key) || ''}
                    genreTags={genreTags}
                    onDecide={(status) => {
                      if (decide.isPending || bulk.isPending) return;
                      setErrors((now) => new Map([...now].filter(([key]) => key !== row.item_key)));
                      decide.mutate({ row, status, category });
                    }}
                    handlers={handlers} />
                ))}
              </div>
            </section>
          )) : review.isError && !review.data ? (
            /* 读不到队列和队列是空的不是一回事：说清楚是读取失败，给一颗重试键。 */
            <Note tone="error" title={t('manage:reviewPage.queueLoadFailed')} action={
              <Button variant="secondary" size="small" disabled={review.isFetching} onClick={() => void review.refetch()}>{t('manage:shared.retryNow')}</Button>
            }>
              {errorMessage(review.error)}
            </Note>
          ) : (
            <EmptyState icon={RiCheckboxCircleLine} title={t({ pending: 'manage:reviewPage.emptyPending', later: 'manage:reviewPage.emptyLater', ignored: 'manage:reviewPage.emptyIgnored' }[queueView])}
              actions={REVIEW_CATEGORIES.some(key => key !== category && Number(snapshot.counts[key] || 0) > 0)
                ? <Button size="small" onClick={() => {
                    const next = categoryOrder.find(key => key !== category && Number(snapshot.counts[key] || 0) > 0);
                    if (next) goCategory(next);
                  }}>{t('manage:reviewPage.viewOtherCategories')}</Button> : undefined}>
              {queueView === 'pending' ? t('manage:reviewPage.switchCategoryHint') : t(queueView === 'later' ? 'manage:reviewPage.laterKeptHint' : 'manage:reviewPage.ignoredKeptHint')}
            </EmptyState>
          )}

          {filteredRows.length ? <DataTableFooter label={t('manage:reviewPage.footerLabel')} total={filteredRows.length}
            pagination={{ pageIndex: win.page - 1, pageSize }}
            onChange={(next) => { setPage(next.pageIndex + 1); setPageSize(next.pageSize) }} /> : null}
          {metadata && queueView === 'pending'
            ? <AutoLandingsCard locked={locked} openItem={openItem} toast={toast} />
            : null}
        </div>
      </div>
      </div>
    </Page>
  );
}
