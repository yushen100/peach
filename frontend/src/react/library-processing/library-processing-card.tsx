/* 数据管理页上的「扫描与采集」卡片。
 *
 * 卡片里讲的是那颗按钮此刻在做什么（进度或等待点）；结果和故障讲的是这一趟任务的下场，
 * 挂在卡片外面，和链接管理、资源同步那两块同一个写法。
 *
 * 写操作是 `useMutation`：服务端回的就是这一趟的新快照，用 `setQueryData` 换进缓存，
 * 再让这个键立刻重读一次接上轮询的节律。首屏读到的旧终态不冒充新结果——任务关掉页面
 * 照样在跑，状态里常年躺着上一趟的回执，判据在 `use-library-processing.ts`。 */
import { useEffect, useState } from 'react';
import { RiArrowRightLine } from '@remixicon/react';
import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { Select, SelectItem } from '@/components/base/select/select';
import { Chip } from '@/components/base/badges/chip';

import { apiSend, errorMessage } from '../../api';
import { SCAN_CARD_TEXT, scanCardSkeletonHtml } from '../../management';
import type { LibraryProcessingProps } from '../bundle';
import { Fieldset, FieldsetTitle } from '../components/fieldset';
import { IssueRow } from '../components/issue-row';
import { Note } from '../components/note';
import { RetryNote } from '../components/grid-reveal';
import { SkeletonContent } from '../components/skeleton-content';
import { StatusLabel } from '../components/status-label';
import { useOverlayScrollbar } from '../components/overlay-scrollbar';
import { PathLine } from '../components/path-line';
import { Disclosure } from '../settings/section';
import { queryClient } from '../query';
import {
  ALL_CONTENT_URL, busyText, DISCONNECTED_TEXT, issueDetails, LIBRARY_PROCESSING_KEY, LIBRARY_PROCESSING_URL, PARTIAL_RESULT_TEXT,
  notesLine, processingActive, processingHasPartialResult, remainingTime, slowItem, type LibraryProcessingCommand, type LibraryProcessingData,
} from './library-processing';
import { SlowItemNote } from './slow-item';
import { useLibraryProcessingJob } from './use-library-processing';
import { setProcessingNoticeVisible, useProcessingNoticeVisibility } from './processing-notice-visibility';
import { ProcessingActions } from './processing-actions';
import { ProcessingProgress } from './processing-line';
import { TrafficProgress } from './processing-traffic';
import { ProcessingControls } from './processing-controls';
import { downloadIssueList, exportProcessingIssues } from './issue-export';
import { busyProps, useAction } from '../settings/use-action';
import { useLibraryTints } from '../components/library-tint';
import { LibraryLabel } from '../components/library-label';
import { useOrderedLibraries } from '../components/library-order';
import { jobText } from '../../core/server-text';
import { t } from '../../i18n';

const ALL_LIBRARIES = { id: '', name: t('manage:scanFetch.allLibraries'), icon: 'database' };

/* 中文正文写成常量：JSX 里换行的文字会在接缝处多出一个空格，中文句子里看得见。
   卡片正文与首屏骨架共用 `SCAN_CARD_TEXT`（`management.ts`）。 */
const STALLED_TEXT = t('manage:scanFetch.stalled');
/* 补齐女优资料是落库之后的一步，一趟里常常什么都不用补，那时这句话不出现：
   四个读数全是 0 还写一句「别名 0 个」，读的人分不清是没得补还是这一步没跑。 */
const profileText = (state: LibraryProcessingData) => {
  const aliases = state.performer_aliases || 0;
  const avatars = state.performer_avatars || 0;
  const conflicts = state.performer_profile_conflicts || 0;
  const failed = state.performer_profile_failed || 0;
  if (!aliases && !avatars && !conflicts && !failed) return '';
  const parts = [t('manage:scanFetch.profilesFilled', { count: aliases, avatars })];
  if (conflicts) parts.push(t('manage:scanFetch.profileConflicts', { count: conflicts }));
  if (failed) parts.push(t('manage:scanFetch.avatarsNotFound', { count: failed }));
  return t('manage:scanFetch.profileSentence', { parts: parts.join(t('shell:format.clauseSeparator')) });
};

const receiptText = (state: LibraryProcessingData) =>
  state.requested_stage === 'previews' ? t('manage:scanFetch.previewsGenerated', { count: state.previews || 0 })
  : state.requested_stage === 'covers' ? t('manage:scanFetch.coversFetched', { count: state.covers || 0 })
  : [
    t('manage:scanFetch.receipt', { count: state.scanned || 0, identified: state.identified || 0, candidates: state.candidates || 0, autoApplied: state.auto_applied || 0 }),
    state.previews ? t('manage:scanFetch.previewsGenerated', { count: state.previews }) : '',
    profileText(state),
  ].filter(Boolean).join(t('shell:format.sentenceGap'));

/** 卡片外面那一块：这一趟怎么了。逐条明细要展开才读，完整清单在状态给出的日志文件里。 */
function Outcome(
  { state, problem, settled, onRetry, toast }:
  {
    state: LibraryProcessingData; problem: string;
    settled: LibraryProcessingData | null; onRetry(): void; toast(message: string): void;
  },
) {
  const details = issueDetails(state);
  const exporter = useAction();
  const archive = useAction();
  /* 「已归档」那句只给刚点了归档的人看，带着撤销；刷新后服务端只剩 `archived`，整块都不再出现。 */
  const [archivedHere, setArchivedHere] = useState('');
  const active = processingActive(state);
  const retryable = state.status === 'failed' && !!state.retryable_asset_ids?.length;
  const notes = notesLine(state.notes || {});
  const failed = !!problem || (!state.archived && state.status === 'failed');
  const partial = !problem && !state.archived && processingHasPartialResult(state);
  /* 这一趟的问题收在同一块里：结论、「7 天内不再问」、清单、日志。分成几块同色的提示，
     读的人分不清哪句跟着哪个按钮。 */
  const issues = failed || (!state.archived && !active && (!!notes || !!state.issue_count));
  const archivable = !active && !!state.job_id && !state.archived;
  const log = state.issues_log || '';
  const slow = slowItem(state);
  /* 清单是这一页唯一自己滚的块，原生滚动条在这儿就是一条系统灰柱子。 */
  const list = useOverlayScrollbar<HTMLUListElement>();
  const setArchived = (archived: boolean) => void archive.run(archived ? 'archive' : 'unarchive',
    signal => apiSend<LibraryProcessingData>(LIBRARY_PROCESSING_URL,
      { action: archived ? 'archive' : 'unarchive', job_id: state.job_id }, 'POST', signal),
    next => {
      queryClient.setQueryData(LIBRARY_PROCESSING_KEY, next);
      setArchivedHere(archived ? state.job_id! : '');
    });
  const exportButton = state.issue_count && !active
    ? <Button variant="secondary" size="small" {...busyProps(!!exporter.busy)} onClick={() => void exporter.run('export',
        signal => exportProcessingIssues(state, signal), contents => {
          downloadIssueList(state.job_id!, contents); toast(t('manage:scanFetch.issuesExported'));
        })}>{t('manage:scanFetch.exportIssues')}</Button>
    : null;
  const body = failed
    ? [problem || jobText(state, 'error') || t('manage:scanFetch.failedRetry'), partial ? PARTIAL_RESULT_TEXT : '', notes].filter(Boolean).join('\n')
    : notes || t('manage:scanFetch.runIssues', { count: state.issue_count || 0 });
  return (
    /* 空着时整块收起：`aria-live` 的容器留着一条空轨道，卡片底下就凭空多出一个间距。 */
    <div aria-live="polite" className="flex flex-col gap-4 empty:hidden">
      {slow
        ? <SlowItemNote state={state} slow={slow} />
        : state.status === 'running' && state.stalled
        ? <Note tone="warning" title={t('manage:scanFetch.slowTitle')}>{STALLED_TEXT}</Note>
        : null}
      {settled?.status === 'complete'
        ? <Note tone="success" title={t('manage:taskOutcome.complete')}>{receiptText(settled)}</Note>
        : null}
      {/* 取消不止是眼前点的那一下：命令行、任务中心取消的、重开页面才读到的，都留这一句。 */}
      {(settled ?? state).status === 'cancelled' && !state.archived ? <Note tone="neutral" title={t('manage:scanFetch.canceledTitle')}>
        {t('manage:scanFetch.canceledBody')}
      </Note> : null}
      {issues
        ? <Note tone={!failed ? 'neutral' : partial ? 'warning' : 'error'} className="gap-0 p-3"
            title={!failed ? undefined : partial ? t('manage:taskOutcome.partial') : t('manage:scanFetch.failedTitle')}
            action={<div className="flex flex-wrap items-center gap-2">
              {partial ? <LinkButton href={ALL_CONTENT_URL} size="small" trailingIcon={RiArrowRightLine}>{t('manage:scanFetch.viewAllContent')}</LinkButton> : null}
              {retryable ? <Button variant="secondary" size="small" aria-label={t('manage:scanFetch.retryNowLabel')} onClick={onRetry}>{t('manage:shared.retryNow')}</Button> : null}
              {archivable ? <Button variant="secondary" size="small" aria-label={t('manage:scanFetch.archiveLabel')} {...busyProps(!!archive.busy)}
                onClick={() => setArchived(true)}>{t('manage:scanFetch.archive')}</Button> : null}
            </div>}
            extra={<>
              {/* 三层东西叠在同一块提示里：一句结论、一份清单、一条日志地址。各自之间
                  横一条自己颜色的发丝线，读的人才看得出哪一段结束了——只靠间距的话，
                  几十条同样长短的明细会连成一片。 */}
              {details ? <div className="-mx-3 mt-3 border-t border-current/20 px-3 pt-3">
                  <Disclosure summary={details.label} contentClassName="gap-0">
                    {/* 轨道是滚动容器的兄弟，得有一层只裹着清单的定位祖先给它落脚。 */}
                    <div className="relative -mr-3">
                      <ul ref={list} className="max-h-96 overflow-y-auto">
                        {details.items.map((item) => (
                          <IssueRow key={item.key} title={item.label} href={item.href}>
                            <span className="text-caption-1-regular">{item.note}</span>
                            {item.hint ? <code className="text-caption-1-regular break-all">{item.hint}</code> : null}
                          </IssueRow>
                        ))}
                      </ul>
                    </div>
                  </Disclosure>
                </div> : null}
              {/* 日志地址与分隔线使用次级文字色；导出读的是同一份记录，排在打开位置旁边。 */}
              {log ? <div className="-mx-3 mt-3 border-t border-current/20 px-3 pt-3 text-text-secondary">
                  <PathLine path={log} prefix={t('manage:scanFetch.fullLogPrefix')} className="text-caption-1-regular"
                    action={exportButton} onRevealed={toast} />
                </div>
              : exportButton ? <div className="-mx-3 mt-3 flex justify-end border-t border-current/20 px-3 pt-3">{exportButton}</div>
              : null}
            </>}>
            {body}
          </Note>
        : null}
      {state.archived && archivedHere === state.job_id && !problem
        ? <Note tone="neutral" action={<Button variant="secondary" size="small" {...busyProps(!!archive.busy)}
              onClick={() => setArchived(false)}>{t('manage:shared.undo')}</Button>}>
            {t('manage:scanFetch.archivedBody')}
          </Note>
        : null}
      {exporter.error || archive.error ? <Note tone="warning">{exporter.error || archive.error}</Note> : null}
    </div>
  );
}

export function LibraryProcessingCard(props: LibraryProcessingProps) {
  const { toast, onComplete } = props;
  const [libraryId, setLibraryId] = useState('');
  const tints = useLibraryTints({ names: true });
  const libraries = useOrderedLibraries([...tints.values()].filter(library => library.name), library => library.id);
  const selectedLibrary = libraryId
    ? tints.get(libraryId) || { id: libraryId, name: t('manage:scanFetch.libraryMissing'), icon: 'database' }
    : ALL_LIBRARIES;
  const { job, settled, forget } = useLibraryProcessingJob(props);
  const start = useMutation({
    mutationFn: (command: LibraryProcessingCommand) =>
      apiSend<LibraryProcessingData>(LIBRARY_PROCESSING_URL, command),
    onSuccess: (next) => {
      forget();
      // 回的就是这一趟的新快照，换进缓存即可；节律由这个键说了算，让它立刻重读一次接上。
      queryClient.setQueryData(LIBRARY_PROCESSING_KEY, next);
      void queryClient.invalidateQueries({ queryKey: LIBRARY_PROCESSING_KEY });
    },
  });
  // 这一趟跑完了就让遗留层重画数据管理页那几个计数：复核与候选的读数跟着它变。
  useEffect(() => { if (settled) onComplete?.() }, [settled, onComplete]);

  const state = job.data ?? { status: 'idle' };
  const noticeKey = state.job_id || 'unavailable';
  const { hidden } = useProcessingNoticeVisibility(noticeKey);
  const problem = start.error ? errorMessage(start.error)
    : job.isError ? (job.data ? DISCONNECTED_TEXT : errorMessage(job.error))
    : '';
  const busy = start.isPending || processingActive(state);

  const run = async (command: LibraryProcessingCommand) => {
    if (busy) return;
    start.reset();
    await start.mutateAsync(command);
  };
  const retry = () => {
    if (!state.job_id || !state.retryable_asset_ids?.length) return;
    void run({ job_id: state.job_id, retry: state.retryable_asset_ids }).catch(() => {});
  };

  if (!job.data) return job.isError
    ? <RetryNote message={errorMessage(job.error)} onRetry={() => { void job.refetch() }} />
    : <SkeletonContent pending skeletonHtml={scanCardSkeletonHtml}>{null}</SkeletonContent>;

  return (
    <div className="flex flex-col gap-4">
      <Fieldset layout="stack" label={t('manage:scanFetch.title')} footer={
        <>
          <LinkButton href="/sources" size="small" trailingIcon={RiArrowRightLine}>{t('manage:managePages.sources')}</LinkButton>
          <LinkButton href="/settings/diagnostics" size="small" trailingIcon={RiArrowRightLine}>{t('manage:managePages.diagnostics')}</LinkButton>
          {state.candidates
            ? <LinkButton href="/review" size="small" trailingIcon={RiArrowRightLine}>{t('manage:scanFetch.reviewMetadata')}</LinkButton>
            : null}
          {/* 日常同步保留独立入口，原任务的定向重试只处理该任务的失败项。 */}
          <ProcessingActions scan libraryId={libraryId} libraryName={libraryId ? selectedLibrary.name : undefined} busy={start.isPending} occupied={processingActive(state)} metadataOnly={state?.metadata_only}
            speedMode={state.speed_mode} pendingCount={state.new_asset_count} onRun={run} onOccupied={() => toast(busyText(state))} />
        </>
      }>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <FieldsetTitle>{t('manage:scanFetch.title')}</FieldsetTitle>
              {state.new_asset_count ? <Chip variant="caption" color="blue">
                <span className="tabular-nums">{t(libraryId ? 'manage:scanFetch.allLibrariesPending' : 'manage:scanFetch.pendingCount', { count: state.new_asset_count })}</span>
              </Chip> : null}
            </div>
            {hidden && (processingActive(state) || state.status === 'failed' || job.isError)
              ? <Button variant="secondary" size="small" onClick={() => setProcessingNoticeVisible(noticeKey, true)}>
                  {t('manage:scanFetch.showProgressPanel')}
                </Button> : null}
          </div>
          <p className="text-body-2-regular text-text-secondary">{SCAN_CARD_TEXT}</p>
          <div className="w-full max-w-80">
            <p id="processingLibraryLabel" className="mb-1 text-body-2-medium text-text-secondary">{t('manage:shared.library')}</p>
            <Select aria-labelledby="processingLibraryLabel" selectedKey={libraryId || 'all'} isDisabled={start.isPending || !libraries.length}
              renderValue={<LibraryLabel library={selectedLibrary} />}
              onSelectionChange={key => { if (key !== null) setLibraryId(key === 'all' ? '' : String(key)) }}>
              <SelectItem id="all" textValue={t('manage:scanFetch.allLibraries')}><LibraryLabel library={ALL_LIBRARIES} /></SelectItem>
              {libraries.map(library => <SelectItem id={library.id} key={library.id} textValue={library.name}>
                <LibraryLabel library={library} />
              </SelectItem>)}
            </Select>
          </div>
          {processingActive(state) && state.library_name ? <p className="text-body-2-regular text-text-secondary">
            {t('manage:scanFetch.currentLibraryName', { name: state.library_name })}
          </p> : null}
          {state.status === 'paused' && !state.total
            ? <span className="self-start"><StatusLabel>{t('manage:taskStatus.paused')}</StatusLabel></span>
            : processingActive(state)
            ? <ProcessingProgress state={state} />
            : null}
          {processingActive(state) ? <p className="text-body-2-regular text-text-secondary tabular-nums" data-processing-eta="">
            {remainingTime(state)}
          </p> : null}
          {processingActive(state) ? <TrafficProgress traffic={state.traffic} /> : null}
          {processingActive(state) ? <ProcessingControls state={state} /> : null}
        </div>
      </Fieldset>
      <Outcome state={state} problem={problem} settled={settled} onRetry={retry} toast={toast} />
    </div>
  );
}
