import { useMemo, useState } from 'react';
import { RiDeleteBinLine } from '@remixicon/react';
import { useQuery } from '@tanstack/react-query';
import { entityFaceImg } from '@peach/card-art';
import { entityPath, esc, firstGrapheme, fmtSize } from '@peach/legacy/core';
import { Button } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';

import { errorMessage } from '../../api';
import { BATCH_DELETE_TEXT, cleanupToolSkeletonHtml } from '../../cleanup-tool-skeletons';
import { entityDisplayName } from '../../core/entity-names';
import type { BulkAction } from '../components/bulk-action';
import { DataTable, type DataColumn } from '../components/data-table';
import { ColumnFilterAvatar } from '../components/column-filter-avatar';
import { Fieldset, FieldsetTitle } from '../components/fieldset';
import { LEGACY_AVATAR_IMG } from '../components/legacy-avatar';
import { Note } from '../components/note';
import { IndexSearch } from '../index/index-search';
import { queryClient } from '../query';
import { useEntityNames } from '../use-entity-names';
import { TRASH_KEY } from './data-cleanup';
import {
  deletePerformerVideos, fetchDeletePerformers, fetchDeletePlan, PERFORMER_DELETE_KEY,
  type DeletePerformer, type PerformerDeletePlan, type PerformerDeleteResult,
} from './performer-delete';
import { serverLabel } from '../../core/server-text';
import { t } from '../../i18n';

function PerformerName({ person }: { person: DeletePerformer }) {
  const name = entityDisplayName('performer', person.k, person.entity_id);
  return <a href={entityPath('performer', person.k, person.entity_id)} title={name}
    className="flex min-w-0 items-center gap-3 text-text-primary">
    <span aria-hidden className={cx('relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium', LEGACY_AVATAR_IMG)}
      dangerouslySetInnerHTML={{ __html: `<span>${esc(firstGrapheme(name))}</span>` + entityFaceImg({
        kind: 'performer', id: person.entity_id, hasImage: person.has_image, version: person.image_version,
        focus: person.avatar_focus, thumb: true,
      }) }} />
    <span className="min-w-0 wrap-anywhere">{name}</span>
  </a>;
}

/** 确认框正文：前五个名字和前五个番号，多出来的只报总数；英文句子之间留空格。 */
function performerDeleteBody(names: string[], examples: string[], plan: { total: number; bytes: number; shared: number }): string {
  const list = (items: string[]) => items.slice(0, 5).join(t('cleanup:shared.listSeparator'));
  const who = names.length > 5 ? t('cleanup:performerDelete.moreNames', { names: list(names), total: names.length }) : list(names);
  const which = examples.length > 5 ? t('cleanup:performerDelete.moreExamples', { examples: list(examples), total: examples.length }) : list(examples);
  return [
    t('cleanup:performerDelete.bodyScope', { names: who, count: plan.total, size: fmtSize(plan.bytes) }),
    t('cleanup:performerDelete.bodyWarning'),
    ...(plan.shared ? [t('cleanup:performerDelete.sharedFiles', { count: plan.shared })] : []),
    t('cleanup:performerDelete.bodyExamples', { examples: which }),
  ].join(t('cleanup:shared.sentenceGap'));
}

export function PerformerDeleteCard({ toast }: { toast(message: string): void }) {
  useEntityNames();
  const query = useQuery({ queryKey: PERFORMER_DELETE_KEY, queryFn: ({ signal }) => fetchDeletePerformers(signal) });
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<PerformerDeleteResult | null>(null);
  const [error, setError] = useState('');
  const host = { receipt: toast, failure: (cause: unknown) => setError(errorMessage(cause)) };

  const columns = useMemo<DataColumn<DeletePerformer>[]>(() => [
    { id: 'name', label: t('cleanup:shared.actress'), width: 280, min: 160, value: person => person.k,
      filter: { values: person => person.k, option: (name, person) => ({
        label: entityDisplayName('performer', name, person?.entity_id), searchTerms: person?.aliases,
        leading: person && <ColumnFilterAvatar person={{ ...person, id: person.entity_id, name }} /> }) },
      render: person => <PerformerName person={person} /> },
    { id: 'works', label: t('cleanup:shared.videos'), width: 104, min: 80, value: person => person.n,
      render: person => t('cleanup:performerDelete.videoCount', { count: person.n }) },
    { id: 'files', label: t('cleanup:shared.files'), width: 104, min: 80, value: person => person.file_count,
      render: person => t('cleanup:performerDelete.fileCount', { count: person.file_count }) },
    { id: 'bytes', label: t('cleanup:performerDelete.columnSize'), width: 136, min: 104, value: person => person.bytes,
      render: person => fmtSize(person.bytes) },
  ], []);
  const needle = search.toLocaleLowerCase();
  const items = (query.data?.items || []).filter(person => !needle || [person.k,
    entityDisplayName('performer', person.k, person.entity_id), ...person.aliases,
  ].some(name => name.toLocaleLowerCase().includes(needle)));

  /* 先向服务端要删除计划再弹窗：弹窗点名范围与番号。删了就撤不回，弹窗写明。 */
  const deleteVideos = (): BulkAction<DeletePerformer> => {
    let plan: PerformerDeletePlan | null = null;
    let outcome: PerformerDeleteResult | null = null;
    return {
      key: 'performer-delete', label: t('cleanup:performerDelete.deleteSelected'), reversal: 'irreversible', danger: true, holdToConfirm: true,
      confirm: async (chosen) => {
        setError('');
        const next = await fetchDeletePlan(chosen.map(person => person.entity_id));
        if (!next.total) throw new Error(t('cleanup:performerDelete.nothingToDelete'));
        plan = next;
        const names = next.performers.map(person => entityDisplayName('performer', person.name, person.id));
        const examples = [...new Set(next.items.map(item => item.code || item.name || `#${item.id}`))];
        return { title: t('cleanup:performerDelete.confirmTitle'), confirmLabel: t('cleanup:performerDelete.confirm'), danger: true,
          body: performerDeleteBody(names, examples, next) };
      },
      run: async () => {
        outcome = await deletePerformerVideos(plan!);
        setResult(outcome);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: PERFORMER_DELETE_KEY, exact: true }),
          queryClient.invalidateQueries({ queryKey: TRASH_KEY, exact: true }),
        ]);
      },
      receipt: () => outcome ? t('cleanup:performerDelete.purged', { count: outcome.purged })
        + (outcome.blocked.length ? t('cleanup:performerDelete.doneBlocked', { count: outcome.blocked.length }) : '') : '',
    };
  };

  const failures = result ? [
    ...result.blocked.map(item => ({ path: item.path, reason: serverLabel(item.reason_code ?? '', item.reason, item.reason_params) })),
    ...result.cleanup_pending,
    ...result.cache_blocked.map(item => ({ path: item.name, reason: item.reason })),
  ] : [];
  return <section id="batch-delete" className="flex min-w-0 scroll-mt-20 flex-col gap-3" aria-label={t('cleanup:tools.bulkDelete')}>
    {query.isPending ? <div dangerouslySetInnerHTML={{ __html: cleanupToolSkeletonHtml('batch-delete') }} />
      : query.isError ? <Fieldset layout="stack" labelledBy="batch-delete-title">
      <FieldsetTitle id="batch-delete-title">{t('cleanup:tools.bulkDelete')}</FieldsetTitle>
      <Note tone="error" title={t('cleanup:performerDelete.loadFailed')}
        action={<Button variant="secondary" size="small" onClick={() => void query.refetch()}>{t('cleanup:shared.retry')}</Button>}>
        {errorMessage(query.error)}</Note>
    </Fieldset> : <DataTable label={t('cleanup:performerDelete.tableLabel')} title={t('cleanup:tools.bulkDelete')} titleId="batch-delete-title" unit={t('cleanup:performerDelete.unit')}
      description={BATCH_DELETE_TEXT} items={items} columns={columns}
      rowId={person => String(person.entity_id)} rowLabel={person => entityDisplayName('performer', person.k, person.entity_id)}
      selected={selected} onSelected={setSelected}
      toolbarActions={<IndexSearch label={t('cleanup:performerDelete.search')} value={search} onQuery={value => { setSearch(value); setSelected([]) }} />}
      actions={(chosen, clear) => [{ action: deleteVideos(), items: chosen, host, done: clear,
        rowAction: { label: t('cleanup:performerDelete.deleteVideosForRow'), icon: RiDeleteBinLine } }]} />}
    {error ? <Note tone="error" title={t('cleanup:performerDelete.planFailed')}>{error}</Note> : null}
    {result ? <Note tone={failures.length ? 'warning' : 'info'} title={t('cleanup:performerDelete.purged', { count: result.purged })}
      extra={failures.length ? <div className="flex flex-col gap-2 text-body-2-regular wrap-anywhere">
        {failures.slice(0, 5).map((item, index) => <p key={index}>{t('shell:format.withNote', { text: item.path, note: item.reason })}</p>)}
      </div> : null}>
      {failures.length
        ? t('cleanup:performerDelete.partialFailure', { count: result.blocked.length, quarantined: result.cleanup_pending.length, cacheFiles: result.cache_blocked.length })
        : t('cleanup:performerDelete.done')}
    </Note> : null}
  </section>;
}
