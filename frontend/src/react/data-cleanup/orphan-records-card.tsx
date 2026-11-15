/* 数据管理页上的「孤儿记录」：文件已不在盘上、带着个人记录的作品（ADR-0087）。
 *
 * 每行一条已消失的作品：快照图供认片，后面是它带的记录、在库里可能是它新版本的文件。
 * 选一个文件接过去，记录搬到那个文件上、旧行删掉，整批可按批次号撤回；彻底删除连记录一起
 * 删，过危险档确认弹层。没有已消失的作品时整块不出现。 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { confirmModal } from '@peach/legacy/ui';
import { LOC } from '@peach/legacy/core';

import { Button } from '@/components/base/buttons/button';
import { Select, SelectItem } from '../components/select';

import { errorMessage } from '../../api';
import { ORPHAN_RECORDS_TEXT } from '../../cleanup-tool-skeletons';
import { DataTable, type DataColumn } from '../components/data-table';
import { Fieldset, FieldsetTitle } from '../components/fieldset';
import { Note } from '../components/note';
import { SourceLabel } from '../components/source-label';
import { spriteGlyph } from '../components/sprite-glyph';
import { queryClient } from '../query';
import { busyProps } from '../settings/use-action';
import type { BulkAction } from '../components/bulk-action';
import {
  attachOrphan, candidateText, fetchOrphanRecords, ORPHAN_RECORDS_KEY, purgeOrphan, recordsText,
  type OrphanRecord,
} from './orphan-records';
import { t } from '../../i18n';

const PLAY = spriteGlyph('play');

const refresh = () => queryClient.invalidateQueries({ queryKey: ORPHAN_RECORDS_KEY, exact: true });

function OrphanActions({ item, toast }: { item: OrphanRecord; toast(message: string): void }) {
  const [target, setTarget] = useState<number | null>(item.candidates[0]?.id ?? null);
  const attach = useMutation({
    mutationFn: () => attachOrphan(item.id, Number(target)),
    onSuccess: () => {
      const destination = item.candidates.find((candidate) => candidate.id === target);
      toast(t('cleanup:orphans.attached', { name: item.name, target: destination?.name ?? t('cleanup:orphans.selectedFile') }));
      void refresh();
    },
    onError: (error) => toast(errorMessage(error)),
  });
  const purge = useMutation({
    mutationFn: () => purgeOrphan(item.id),
    onSuccess: (data) => {
      toast(data.blocked.length
        ? t('cleanup:orphans.fileRestored', { name: item.name })
        : t('cleanup:orphans.recordDeleted', { name: item.name }));
      void refresh();
    },
  });
  const remove = () => {
    void confirmModal({
      title: t('cleanup:orphans.deleteRecord'),
      body: recordsText(item.records)
        ? t('cleanup:orphans.deleteBodyWithActivity', { name: item.name, records: recordsText(item.records) })
        : t('cleanup:orphans.deleteBody', { name: item.name }),
      confirmLabel: t('cleanup:orphans.deleteRecord'),
      danger: true,
      onConfirm: () => purge.mutateAsync(),
    });
  };
  const busy = attach.isPending || purge.isPending;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
        <Button variant="danger" size="small" {...busyProps(busy)} onClick={remove}>{t('cleanup:orphans.deleteRecord')}</Button>
        {item.candidates.length
          ? <Select aria-label={t('cleanup:orphans.targetLabel', { name: item.name })} prefix={t('cleanup:orphans.targetPrefix')} className="w-52" selectedKey={target}
              onSelectionChange={(key) => { if (key !== null) setTarget(Number(key)) }}>
              {item.candidates.map((candidate) => (
                <SelectItem key={candidate.id} id={candidate.id} textValue={candidateText(candidate)}>
                  {candidateText(candidate)}
                </SelectItem>
              ))}
            </Select>
          : null}
        {item.candidates.length
          ? <Button variant="primary" size="small" disabled={target === null} {...busyProps(busy)}
              onClick={() => attach.mutate()}>{t('cleanup:orphans.moveActivity')}</Button>
          : null}
    </span>
  );
}

function OrphanIdentity({ item }: { item: OrphanRecord }) {
  return (
        <span className="flex min-w-0 items-center gap-3">
          {/* 快照图供认片；没有图或取不到时留一格带描边的占位，和重复文件页的封面格同一个样子。
              窄屏收起，把宽度让给名字与记录。 */}
          <span className="relative inline-grid aspect-16/10 w-24 flex-none place-items-center max-cleanup-tight:hidden overflow-hidden rounded-lg border border-separator-border bg-media-placeholder text-text-tertiary">
            <PLAY aria-hidden className="size-5" />
            {item.has_thumb
              ? <img src={`/thumb?id=${item.id}&c=4`} alt="" loading="lazy"
                  onError={(event) => event.currentTarget.remove()}
                  className="absolute inset-0 size-full object-contain" />
              : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span title={item.name} className="truncate text-body-regular text-text-primary">{item.name}</span>
            <small className="flex min-w-0 items-center gap-1.5 text-caption-1-regular text-text-secondary">
              {item.code ? <span className="shrink-0">{item.code}</span> : null}
              {item.code && item.location ? <span aria-hidden="true">·</span> : null}
              {item.location ? <SourceLabel source={item.location} label={LOC[item.location] || item.location} /> : null}
            </small>
          </span>
        </span>
  );
}

export function OrphanRecordsCard({ toast }: { toast(message: string): void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const query = useQuery({ queryKey: ORPHAN_RECORDS_KEY, queryFn: ({ signal }) => fetchOrphanRecords(signal) });
  const items = query.data?.items ?? [];
  const host = { receipt: toast };
  /* 永久删除撤不回：弹窗写明，回执只报删了几条、几条没删成。 */
  const purgeSelected = (count: number): BulkAction<OrphanRecord> => {
    let outcome: Awaited<ReturnType<typeof purgeOrphan>> | null = null;
    return {
      key: 'purge', label: t('cleanup:orphans.deleteSelectedCount', { count }), reversal: 'irreversible', danger: true,
      confirm: (chosen) => ({ title: t('cleanup:orphans.deleteSelectedTitle'), danger: true,
        body: t('cleanup:orphans.deleteSelectedBody', { count: chosen.length }), items: chosen.map((item) => item.name) }),
      run: async (chosen) => { outcome = await purgeOrphan(chosen.map((item) => item.id)) },
      receipt: () => outcome ? t('cleanup:orphans.purged', { count: outcome.purged })
        + (outcome.blocked.length ? t('cleanup:orphans.purgedBlocked', { count: outcome.blocked.length }) : '') : '',
    };
  };
  const columns: DataColumn<OrphanRecord>[] = [
    { id: 'item', label: t('cleanup:shared.video'), width: 480, min: 320, value: (item) => item.name, render: (item) => <OrphanIdentity item={item} /> },
    { id: 'records', label: t('cleanup:orphans.columnActivity'), width: 176, min: 144, value: (item) => recordsText(item.records),
      render: (item) => <span className="block min-w-0 whitespace-normal wrap-anywhere">{recordsText(item.records) || t('cleanup:shared.none')}</span> },
    { id: 'target', label: t('cleanup:shared.actions'), width: items.some(item => item.candidates.length) ? 360 : 128, min: 128, value: (item) => item.candidates.length,
      render: (item) => <OrphanActions item={item} toast={toast} /> },
  ];
  return (
    <section id="orphan-records" aria-labelledby="orphan-records-title" className="flex scroll-mt-20 flex-col gap-4">
        {query.isError
          ? <Fieldset layout="stack" labelledBy="orphan-records-title">
              <FieldsetTitle id="orphan-records-title">{t('cleanup:tools.orphanRecords')}</FieldsetTitle>
              <Note tone="error" title={t('cleanup:orphans.loadFailed')}>{errorMessage(query.error)}</Note>
            </Fieldset>
          : <DataTable label={t('cleanup:orphans.tableLabel')} items={items} columns={columns}
              title={t('cleanup:tools.orphanRecords')} titleId="orphan-records-title" unit={t('cleanup:orphans.unit')}
              description={ORPHAN_RECORDS_TEXT}
              rowId={(item) => String(item.id)} rowLabel={(item) => item.name}
              selected={selected} onSelected={setSelected}
              actions={(chosen) => [{ items: chosen, host,
                action: purgeSelected(chosen.length),
                done: () => { setSelected([]); void refresh() } }]} />}
    </section>
  );
}
