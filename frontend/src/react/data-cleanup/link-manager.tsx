/* 数据管理页上的「链接管理」。
 *
 * 三份真相三个键（见 `links.ts`）：库里链接的现状、那趟联网检查、那趟删除。检查与删除
 * 各是一趟后台任务，都走 `useBackgroundJob`。检查的结论是页面进来就要看的东西（上一趟判出
 * 的失效链接还等着删），所以画的是当前快照；删除只报本次跟完的那一趟。
 *
 * 结果分两张表不是为了好看：`linktr.ee` 回 403 是挡爬虫、`x.com` 回 500 是临时错误，
 * 链接本身好好的。混成一张会让人顺手把好链接一起删掉，所以「地址已失效」和「本次未
 * 访问成功」各占一张，只有前一张接得上删除。 */
import { useEffect, useState, type ReactNode } from 'react';
import { RiExternalLinkLine } from '@remixicon/react';
import { useQuery } from '@tanstack/react-query';
import { entityPath, esc, firstGrapheme } from '@peach/legacy/core';
import { entityFaceImg } from '@peach/card-art';

import { Button } from '@/components/base/buttons/button';
import { Chip } from '@/components/base/badges/chip';
import { StatusLabel } from '../components/status-label';

import { errorMessage } from '../../api';
import { ErrorExcerpt } from '../activity/error-excerpt';
import { useBackgroundJob } from '../background-job';
import { runBulkAction, type BulkAction } from '../components/bulk-action';
import { DataTable, type DataColumn } from '../components/data-table';
import type { DockAction } from '../components/selection-dock';
import {
  Fieldset, FieldsetTitle, RESULT_PANEL, RESULT_SECTION,
} from '../components/fieldset';
import { Note } from '../components/note';
import { SiteMark } from '../components/site-mark';
import { ColumnFilterAvatar } from '../components/column-filter-avatar';
import { TaskProgress } from '../components/task-progress';
import { activityKind } from '../../activity-kinds';
import { spriteGlyph } from '../components/sprite-glyph';
import { LEGACY_AVATAR_IMG } from '../components/legacy-avatar';
import { LinkCheckIcon } from './link-check-icon';
import { queryClient } from '../query';
import { busyProps } from '../settings/use-action';
import {
  checkLine, fetchLinkCheck, fetchLinkPrune, fetchLinkStats, LINK_CHECK_KEY, LINK_KINDS,
  LINK_PRUNE_KEY, LINKS_KEY, pruneText, startLinkCheck, startLinkPrune,
  type LinkCheckState, type LinkPruneState, type LinkRow,
} from './links';
import { jobText, serverLabel } from '../../core/server-text';
import { t } from '../../i18n';
import { linkLabel } from '../../core/stored-values';

const RETRY = spriteGlyph('rotate-cw');

const GONE_HINT = t('cleanup:links.goneHint');
/* 这一组大多是站点拒绝程序访问或一次抖动，换个时间再问一次就通了。 */
const UNCLEAR_HINT = t('cleanup:links.unclearHint');
const PRUNE_HINT = t('cleanup:links.pruneHint');
const DISCONNECTED = t('cleanup:shared.reconnecting');

const count = (value: number | undefined) => Number(value || 0).toLocaleString();

/** 一格读数：名目、数字、可选的一句注。每一类各占一格：挤成一行时标签和数字之间只剩
 *  间隔点，数字归谁全靠猜。 */
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption-1-regular leading-5 text-text-secondary">{label}</span>
      <b className="text-title-2-semibold font-bold leading-5 tabular-nums text-text-primary">{value}</b>
      {note ? <small className="text-caption-1-regular leading-5 text-text-secondary">{note}</small> : null}
    </div>
  );
}

function LinkTable(
  { title, items, hint, picked, onPick, actions, controls, footer, confirmed = false }:
  {
    title: string; items: LinkRow[]; hint: string;
    picked: readonly number[]; onPick(next: number[]): void; footer?: ReactNode; confirmed?: boolean;
    actions?(chosen: LinkRow[]): readonly DockAction[]; controls?: ReactNode;
  },
) {
  if (!items.length) return null;
  const columns: DataColumn<LinkRow>[] = [
    { id: 'entity', label: t('cleanup:links.columnEntry'), width: 180, min: 128, value: (item) => item.entity,
      filter: { values: item => item.entity, option: (name, item) => ({
        leading: item && <ColumnFilterAvatar person={{ ...item.face, id: item.entity_id, name }}
          kind={item.entity_kind} markId={item.entity_kind === 'studio' || item.entity_kind === 'agency' ? item.id : null} /> }) },
      render: (item) => <a className="flex min-w-24 items-center gap-2 text-text-secondary hover:text-text-primary hover:underline"
        href={item.entity_id && item.entity_kind ? entityPath(item.entity_kind, item.entity, item.entity_id) : undefined} data-link-identity="">
        <span data-link-avatar="" className={`relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-primary ${LEGACY_AVATAR_IMG}`}
          aria-hidden dangerouslySetInnerHTML={{ __html: `<span>${esc(firstGrapheme(item.entity))}</span>` + entityFaceImg({
            kind: item.entity_kind, id: item.entity_id, hasImage: item.face?.has_image,
            version: item.face?.image_version, focus: item.face?.avatar_focus, thumb: true,
            mark: item.entity_kind === 'studio' || item.entity_kind === 'agency' ? item.id : null,
          }) }} />
        <span className="min-w-0 wrap-anywhere">{item.entity}</span>
      </a> },
    { id: 'kind', label: t('cleanup:shared.type'), width: 128, value: (item) => LINK_KINDS[item.link_kind] || item.link_kind,
      filter: { values: item => item.link_kind, option: kind => ({ label: LINK_KINDS[kind] || kind }) },
      render: (item) => LINK_KINDS[item.link_kind] || item.link_kind },
    { id: 'label', label: t('cleanup:links.columnName'), min: 128, value: (item) => linkLabel(item.label),
      filter: { values: item => linkLabel(item.label) || new URL(item.url).hostname,
        option: (_, item) => ({ leading: item && <SiteMark linkId={item.id} /> }) },
      render: (item) => <span className="flex min-w-24 items-center gap-2" data-link-name="">
        <span className="min-w-0 wrap-anywhere">{linkLabel(item.label) || new URL(item.url).hostname}</span></span> },
    { id: 'note', label: t('cleanup:links.columnResult'), width: 320, min: 192, value: (item) => item.note,
      filter: { values: item => serverLabel(item.note_code ?? '', item.note, item.note_params) },
      render: (item) => <div className="min-w-0 w-full" data-link-result={confirmed ? 'gone' : 'unclear'}>
        {/^(?:HTTP\s+)?[1-5]\d{2}$/.test(item.note.trim())
          ? <StatusLabel tone={confirmed || /^(?:HTTP\s+)?5\d{2}$/.test(item.note.trim()) ? 'error' : 'warning'} data-link-code="">{item.note.trim()}</StatusLabel>
          : <div className="flex flex-col items-start gap-1"><StatusLabel tone={confirmed ? 'error' : 'warning'}>{confirmed ? t('cleanup:links.dead') : t('cleanup:links.inconclusive')}</StatusLabel>
              <ErrorExcerpt text={serverLabel(item.note_code ?? '', item.note, item.note_params)} className="tabular-nums text-text-secondary" /></div>}
        {!confirmed && item.temporary && item.attempts
          ? <span data-link-rechecked="" className="mt-1 block text-body-2-regular text-text-secondary">{t('cleanup:links.rechecked', { count: item.attempts })}</span>
          : null}
      </div> },
    { id: 'url', label: t('cleanup:links.columnUrl'), width: 360, min: 180, value: (item) => item.url,
      filter: { values: item => new URL(item.url).hostname,
        option: (_, item) => ({ leading: item && <SiteMark linkId={item.id} /> }) },
      render: (item) => <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.url} data-link-address=""
        className="flex min-w-0 items-center gap-1 text-text-secondary hover:text-text-primary">
        <SiteMark linkId={item.id} />
        <span data-middle-truncate className="min-w-0 truncate">{item.url}</span>
        <RiExternalLinkLine aria-hidden className="size-(--icon-inline) shrink-0" />
      </a> },
  ];
  return (
    <div className={RESULT_SECTION} data-link-results={confirmed ? 'gone' : 'unclear'}>
      <DataTable label={title} items={items} columns={columns} rowId={(item) => String(item.id)}
        description={hint} unit={t('cleanup:links.unit')} panel={false} footerActions={footer}
        rowLabel={(item) => t('cleanup:links.rowLabel', { entity: item.entity, link: linkLabel(item.label) || item.url })}
        selected={picked.map(String)} onSelected={(ids) => onPick(ids.map(Number))}
        actions={(chosen) => actions?.(chosen) ?? []} controls={() => controls} />
    </div>
  );
}

export function LinkManager() {
  const stats = useQuery({ queryKey: LINKS_KEY, queryFn: ({ signal }) => fetchLinkStats(signal) });
  const [picked, setPicked] = useState<number[]>([]);
  const [gonePicked, setGonePicked] = useState<number[]>([]);
  const prune = useBackgroundJob<LinkPruneState, { checkId: string; ids?: number[] }>({
    queryKey: LINK_PRUNE_KEY,
    queryFn: ({ signal }) => fetchLinkPrune(signal),
    start: startLinkPrune,
    /* 删完之后库里的链接少了，那两块读数跟着重取。 */
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: LINKS_KEY, exact: true });
      void queryClient.invalidateQueries({ queryKey: LINK_CHECK_KEY, exact: true });
    },
  });
  const check = useBackgroundJob<LinkCheckState, { retry?: readonly number[]; checkId?: string }>({
    queryKey: LINK_CHECK_KEY,
    queryFn: ({ signal }) => fetchLinkCheck(signal),
    start: startLinkCheck,
    /* 又起了一趟检查：上一趟删除的回执说的是旧清单，勾选的行号也不再指向任何东西。 */
    onStarted: () => { prune.dismiss(); setPicked([]); setGonePicked([]) },
  });

  const state = check.job;
  const checkId = state?.check_id ?? '';
  useEffect(() => { setPicked([]); setGonePicked([]) }, [checkId]);

  const running = check.running || check.start.isPending;
  const removing = prune.running || prune.start.isPending;
  const actionsReady = !!check.job && !!prune.job;
  const done = state?.status === 'complete';
  const gone = state?.gone ?? [];
  const unclear = state?.unclear ?? [];
  const retryable = done ? unclear : [];
  const selectedGone = gone.filter((item) => gonePicked.includes(item.id)).map((item) => item.id);
  const selectedRetryable = retryable.filter((item) => picked.includes(item.id)).map((item) => item.id);
  const info = stats.data;
  const hosts = (info?.top_hosts ?? []).slice(0, 3);

  const run = (retry?: readonly number[]) => {
    if (!actionsReady || running || (retry && !retry.length)) return;
    check.start.mutate(retry ? { retry, checkId } : {});
  };
  /* 删除是一趟后台任务，结论由任务那块回执说；删了撤不回，弹窗写明。`all` 时不带 id，删整份清单。 */
  const removeGone = (label: string, all = false): BulkAction<LinkRow> => ({
    key: all ? 'prune-all' : 'prune', label, reversal: 'irreversible', danger: true, holdToConfirm: true,
    confirm: (rows) => ({ title: t('cleanup:links.deleteDead'), danger: true,
      body: t('cleanup:links.deleteDeadBody', { count: rows.length }) }),
    run: async (rows) => { await prune.start.mutateAsync({ checkId, ids: all ? undefined : rows.map((row) => row.id) }) },
    receipt: () => '',
  });
  const host = { receipt: () => {} };
  const removeAll = () => {
    if (!actionsReady || removing || !gone.length) return;
    void runBulkAction(removeGone(t('cleanup:links.deleteDead'), true), gone, host);
  };

  /* 删除那一趟跑完，结论就是那一句回执：旧清单里的行已经删掉或者确认保留了。 */
  const pruned = prune.outcome;
  const startError = check.start.error ?? prune.start.error;
  let progress: ReactNode = null;
  let result: ReactNode = null;
  if (pruned?.status === 'failed') {
    result = <Note tone="error" title={t('cleanup:links.pruneIncomplete')}>{jobText(pruned, 'error') || t('cleanup:links.checkTaskLog')}</Note>;
  } else if (pruned && !gone.length && !unclear.length) {
    result = <Note tone="success" title={t('cleanup:links.pruneDone')}>{pruneText(pruned)}</Note>;
  } else if (startError) {
    result = <Note tone="error" title={t('cleanup:links.checkFailed')}>{errorMessage(startError)}</Note>;
  } else if (check.query.isError && state) {
    result = <Note tone="neutral" title={t('cleanup:shared.taskStatus')}>{DISCONNECTED}</Note>;
  } else if (state?.status === 'failed') {
    result = <Note tone="error" title={t('cleanup:links.checkFailed')}>{jobText(state, 'error') || t('cleanup:links.checkFailed')}</Note>;
  } else if (state && state.status !== 'idle') {
    progress = <>
      {state.status === 'running'
        ? <TaskProgress embedded kind={activityKind('link-check')} label={checkLine(state)} value={Math.min(state.checked || 0, state.total || 0)} total={state.total} />
        : null}
      {removing
        ? <TaskProgress embedded kind={activityKind('link-prune')} label={jobText(prune.job) || t('cleanup:links.pruning')}
            value={Math.min(prune.job?.checked || 0, prune.job?.total || 0)} total={prune.job?.total} />
        : null}
    </>;
    const pickedLabel = t('cleanup:links.retrySelected', { count: selectedRetryable.length });
    result = done || gone.length || unclear.length ? (
      <div className={RESULT_PANEL}>
        {pruned?.status === 'complete' ? <Note tone="success" title={t('cleanup:links.pruneDone')}>{pruneText(pruned)}</Note> : null}
        <LinkTable title={t('cleanup:links.dead')} items={gone} hint={GONE_HINT} picked={gonePicked} onPick={setGonePicked} confirmed
          footer={done && gone.length ? <>
            <p className="mr-auto min-w-0 text-caption-1-regular text-text-secondary">{PRUNE_HINT}</p>
            <Button variant="danger" {...busyProps(removing)} onClick={removeAll}>
              {t('cleanup:links.deleteDeadCount', { count: gone.length })}
            </Button>
          </> : null}
          actions={(chosen) => [{ action: removeGone(t('cleanup:links.deleteSelected', { count: selectedGone.length })),
            items: chosen, host, disabled: !done || removing }]} />
        <LinkTable title={t('cleanup:links.unreached')} items={unclear} hint={UNCLEAR_HINT}
          picked={picked} onPick={setPicked} footer={retryable.length
            ? <Button variant="primary" leadingIcon={RETRY} {...busyProps(running)}
                onClick={() => run(retryable.map((item) => item.id))}>{t('cleanup:links.retryAll', { count: retryable.length })}</Button>
            : null}
          controls={retryable.length
            ? <Button variant="secondary" leadingIcon={RETRY} disabled={!selectedRetryable.length} {...busyProps(running)}
                onClick={() => run(selectedRetryable)}>{pickedLabel}</Button>
            : null} />
        {done && !gone.length && !unclear.length
          ? <p className={`${RESULT_SECTION} text-body-regular text-notification-success-foreground`}>{t('cleanup:links.allReachable')}</p>
          : null}
      </div>
    ) : null;
  }

  return (
    <section id="link-manager" aria-labelledby="link-manager-title" className="flex scroll-mt-20 flex-col gap-4">
      <Fieldset layout="stack" labelledBy="link-manager-title" footer={
        <Button data-link-check="" leadingIcon={LinkCheckIcon} disabled={!actionsReady} {...busyProps(running)} onClick={() => run()}>
          {running ? t('cleanup:links.checking') : done ? t('cleanup:links.checkAgain') : t('cleanup:links.checkLinks')}
        </Button>
      }>
        <FieldsetTitle id="link-manager-title" gap="small">{t('cleanup:tools.links')}</FieldsetTitle>
        {stats.isError
          ? <Note tone="error" title={t('cleanup:links.statsLoadFailed')}>{errorMessage(stats.error)}</Note>
          : info
            ? <>
                <div className="link-stat-grid mt-4 gap-x-8 gap-y-3">
                  <Stat label={t('cleanup:links.totalLinks')} value={count(info.total)}
                    note={t('cleanup:links.entitySpread', { count: Number(info.entities || 0) })} />
                  {Object.entries(info.by_kind ?? {}).map(([kind, value]) => (
                    <Stat key={kind} label={LINK_KINDS[kind] || kind} value={count(value)} />
                  ))}
                </div>
                {hosts.length
                  ? <div className="mt-4 flex min-w-0 flex-col gap-0.5">
                      <span className="text-caption-1-regular text-text-secondary">{t('cleanup:links.topSites')}</span>
                      <div className="flex min-w-0 flex-wrap gap-x-5 gap-y-2">
                        {hosts.map(([host, n]) => <span key={host} data-top-host="" className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                          <a href={`https://${host}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex min-w-0 items-center gap-1.5 text-body-2-medium text-text-primary">
                            <SiteMark linkId={info.top_host_link_ids?.[host]} /><span className="min-w-0 wrap-anywhere">{host}</span>
                            <RiExternalLinkLine aria-hidden className="size-(--icon-inline) shrink-0" />
                          </a>
                          <Chip variant="caption" color="neutral"><span className="tabular-nums">{count(n)}</span></Chip>
                        </span>)}
                      </div>
                    </div>
                  : null}
              </>
            : null}
        <div aria-live="polite" className="mt-4 flex flex-col gap-3 empty:hidden">{progress}</div>
      </Fieldset>
      <div aria-live="polite" className="empty:hidden">{result}</div>
    </section>
  );
}
