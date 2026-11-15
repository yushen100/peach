import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { ApiError, apiGet, apiSend } from '../../api';
import { diagnosticHeaders } from '../../browser-diagnostics';
import { withBackoff } from '../../polling';
import { Fieldset, FieldsetTitle } from '../components/fieldset';
import { Note } from '../components/note';
import { TaskProgress } from '../components/task-progress';
import { activityKind } from '../../activity-kinds';
import { queryClient } from '../query';
import { busyProps, useAction } from '../settings/use-action';
import { t } from '../../i18n';
import { stageText } from '../../core/server-text';

const URL = '/api/diagnostics/exports';
const KEY = ['diagnostic-export'] as const;
interface ExportState {
  job_id?: string; kind?: 'support' | 'scraping';
  status: 'idle' | 'running' | 'cancelling' | 'complete' | 'cancelled' | 'failed';
  stage?: string; stage_code?: string; done?: number; total?: number; files?: number; rows?: number; bytes?: number;
  download_url?: string; error?: string;
}
/** 导出在跑或在取消时每秒读一次进度，结束就停；读失败按连续失败次数退避。 */
export const exportInterval = withBackoff<ExportState>((data) =>
  (['running', 'cancelling'].includes(data?.status || '') ? 1000 : false));

/** 导出按钮与它的进度、回执。刮削记录在卡片底栏里，进度复用卡片；诊断报告摆在页头，进度自己带框，
 *  `children` 是页头同一排的其他按钮。 */
export function DiagnosticExportAction({ kind, codes = '', children }: {
  kind: 'support' | 'scraping'; codes?: string; children?: ReactNode;
}) {
  const action = useAction();
  const query = useQuery({ queryKey: KEY, queryFn: ({ signal }) => apiGet<ExportState>(URL, signal),
    refetchInterval: exportInterval });
  const state = query.data;
  const mine = state?.kind === kind;
  const active = state?.status === 'running' || state?.status === 'cancelling';
  const label = kind === 'support' ? t('manage:diagnosticsExport.downloadReport') : t('manage:diagnosticsExport.exportFetchLog');
  const update = (next: ExportState) => { queryClient.setQueryData(KEY, next) };
  const start = () => void action.run('start', async signal => {
    const response = await fetch(URL, { method: 'POST', signal, credentials: 'same-origin',
      headers: { ...await diagnosticHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, codes }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(result?.detail || result?.error || t('manage:diagnosticsExport.startFailed'), response.status, result);
    if (!result || !result.job_id) throw new Error(t('manage:diagnosticsExport.statusNotFound'));
    return result as ExportState;
  }, update);
  const cancel = () => void action.run('cancel', signal => apiSend<ExportState>(
    `${URL}/${state!.job_id}/cancel`, {}, 'POST', signal), update);
  return <div className="flex min-w-0 flex-col gap-3">
    <div className={kind === 'support' ? 'flex flex-wrap justify-end gap-2' : 'flex flex-wrap gap-2'}>
      <Button type="button" variant="secondary" disabled={active} {...busyProps(action.busy === 'start')} onClick={start}>{label}</Button>
      {mine && active ? <Button type="button" variant="secondary" disabled={state.status === 'cancelling'}
        {...busyProps(action.busy === 'cancel')} onClick={cancel}>{t('manage:diagnosticsExport.cancelExport')}</Button> : null}
      {mine && state.status === 'complete' && state.download_url ? <ButtonLink variant="secondary"
        href={state.download_url}>{t('manage:diagnosticsExport.downloadFile')}</ButtonLink> : null}
      {children}
    </div>
    {mine && active ? <TaskProgress embedded={kind === 'scraping'} kind={activityKind('diagnostic-export', state.stage_code)} value={state.done || 0} total={state.total}
      label={state.total ? t('manage:diagnosticsExport.progress', { stage: stageText(state), done: state.done || 0, count: state.total })
        : [stageText(state) || t('manage:diagnosticsExport.preparing'), state.rows ? t('manage:diagnosticsExport.candidateCount', { count: state.rows }) : '',
          state.files ? t('manage:diagnosticsExport.fileCount', { count: state.files }) : ''].filter(Boolean).join(' · ')} /> : null}
    {mine && state.status === 'complete' ? <p role="status" className="text-body-2-regular text-text-secondary">
      {t('manage:diagnosticsExport.completedSize', { size: ((state.bytes || 0) / 1024 / 1024).toFixed(2) })}</p> : null}
    {mine && state.status === 'cancelled' ? <Note tone="neutral">{t('manage:diagnosticsExport.canceled')}</Note> : null}
    {query.isError ? <Note tone="error" action={<Button type="button" variant="secondary"
      {...busyProps(query.isFetching)} onClick={() => { void query.refetch() }}>{t('manage:diagnosticsExport.reload')}</Button>}>{t('manage:diagnosticsExport.progressNotFound')}</Note> : null}
    {action.error || mine && state.status === 'failed' ? <Note tone="error">{action.error || state?.error}</Note> : null}
  </div>;
}

export function ScrapingExport() {
  const [codes, setCodes] = useState('');
  return <Fieldset layout="stack" labelledBy="scraping-export-title" footer={<DiagnosticExportAction kind="scraping" codes={codes} />}>
    <div className="flex min-w-0 flex-col gap-4" aria-label={t('manage:diagnosticsExport.exportFetchLog')}>
      <FieldsetTitle id="scraping-export-title">{t('manage:diagnosticsExport.fetchLogTitle')}</FieldsetTitle>
      <p className="text-body-2-regular text-text-secondary">{t('manage:diagnosticsExport.fetchLogHint')}</p>
      <Input label={t('manage:diagnosticsExport.codesLabel')} name="scraping-codes" value={codes} onChange={setCodes}
        autoComplete="off" spellCheck="false" maxLength={1300}
        placeholder={t('manage:diagnosticsExport.codesPlaceholder')} hint={t('manage:diagnosticsExport.codesHint')} />
    </div>
  </Fieldset>;
}
