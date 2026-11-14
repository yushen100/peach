/* 复核页元数据分类下的「自动写入的资料」（ADR-0141）。
 *
 * 资料处理按确定判据自动写下的标题、发行日期与标签，一行一条：先看是哪部作品、写了什么、
 * 原来是什么，规则与时间排在后面。勾选后先读一次撤回预览，弹层里逐条列出会改回的值、会删的
 * 标签和之后被人改过、不动的作品，确认后才写账本。撤回的回执留在表上方，被跳过的作品可以
 * 点开核对。没有自动写入也没有回执时整块不出现。 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { VisuallyHidden } from 'react-aria-components';
import { confirmModal } from '@peach/legacy/ui';

import { Button } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { errorMessage } from '../../api';
import { DataTable, type DataColumn } from '../components/data-table';
import { Note } from '../components/note';
import { queryClient } from '../query';
import { busyProps } from '../settings/use-action';
import {
  AUTO_LANDINGS_KEY, fetchAutoLandings, fieldName, previewAutoLandings, previewBody, previewLines, previousText,
  resultText, revertAutoLandings, ruleName, workLabel, writeTime, writtenText,
  type AutoLandingResult, type AutoLandingWrite,
} from './auto-landings';
import { REVIEW_KEY } from './review';
import { t } from '../../i18n';

const DESCRIPTION = t('manage:autoLandings.description');

function Work({ item, openItem }: { item: AutoLandingWrite; openItem(id: number): void }) {
  const open = item.asset_id && !item.gone ? () => openItem(item.asset_id!) : undefined;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <button type="button" disabled={!open} onClick={open}
        className="flex aspect-card-cover w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-media-placeholder outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default">
        {item.preview_url
          ? <img src={item.preview_url} alt="" loading="lazy" className="size-full object-cover" />
          : <span className="text-caption-1-regular text-text-secondary">{t('manage:shared.noCover')}</span>}
        <VisuallyHidden>{t('manage:autoLandings.openVideo', { name: workLabel(item) })}</VisuallyHidden>
      </button>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body-medium text-text-primary">
          {workLabel(item)}
          {item.assets > 1 ? <small className="ml-1 text-caption-1-regular text-text-secondary">{t('manage:autoLandings.fileCount', { count: item.assets })}</small> : null}
        </span>
        <small title={item.name} className="truncate text-caption-1-regular text-text-secondary">
          {item.gone ? t('manage:autoLandings.videoGone') : item.name}
        </small>
      </span>
    </span>
  );
}

function Written({ item }: { item: AutoLandingWrite }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span title={writtenText(item)} className="truncate text-body-regular text-text-primary">
        <span className="text-text-secondary">{t('shell:format.labelPrefix', { label: fieldName(item) })}</span>{writtenText(item)}
      </span>
      <small title={previousText(item)} className="truncate text-caption-1-regular text-text-secondary">{previousText(item)}</small>
    </span>
  );
}

export function AutoLandingsCard(
  { locked, openItem, toast }: { locked: boolean; openItem(id: number): void; toast(message: string): void },
) {
  const [selected, setSelected] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<AutoLandingResult | null>(null);
  const query = useQuery({ queryKey: AUTO_LANDINGS_KEY, queryFn: ({ signal }) => fetchAutoLandings(signal) });
  const items = query.data?.items ?? [];
  const revert = useMutation({
    mutationFn: async (keys: string[]) => {
      const preview = await previewAutoLandings(keys);
      const { confirmed, result } = await confirmModal({
        title: t('manage:autoLandings.revertTitle'), body: previewBody(preview), items: previewLines(preview),
        confirmLabel: t('manage:shared.revert'), onConfirm: () => revertAutoLandings(preview.items, preview.token),
      });
      return confirmed ? result as AutoLandingResult : null;
    },
    onSuccess: (result) => {
      if (!result) return;
      setReceipt(result);
      setSelected([]);
      toast(resultText(result));
      void queryClient.invalidateQueries({ queryKey: REVIEW_KEY });
    },
    onError: (error) => toast(errorMessage(error)),
  });
  if (!items.length && !receipt && !query.isError) return null;
  const columns: DataColumn<AutoLandingWrite>[] = [
    { id: 'work', label: t('manage:shared.video'), width: 300, min: 240, value: (item) => workLabel(item),
      render: (item) => <Work item={item} openItem={openItem} /> },
    { id: 'written', label: t('manage:autoLandings.columnWritten'), width: 320, min: 220, value: (item) => `${fieldName(item)}${writtenText(item)}`,
      render: (item) => <Written item={item} /> },
    // 规则与时间是次要信息，叠成一列，桌面宽度下整张表不必横向滚动。
    { id: 'rule', label: t('manage:autoLandings.columnRuleTime'), width: 176, min: 144, value: (item) => item.at ?? 0,
      render: (item) => (
        <span title={item.batch} className="flex min-w-0 flex-col gap-0.5 text-text-secondary">
          <span className="truncate text-body-2-regular">{ruleName(item)}</span>
          <small className="tabular-nums text-caption-1-regular">{writeTime(item) || t('manage:autoLandings.timeUnknown')}</small>
        </span>
      ) },
  ];
  return (
    <section aria-labelledby="auto-landings-title" className="flex flex-col gap-4">
      {receipt ? (
        <Note tone="success" title={resultText(receipt)}>
          <p className="text-body-2-regular">{t('manage:autoLandings.backupDone', { path: receipt.backup })}</p>
          {receipt.changed.length ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-2-regular">
              {t('manage:autoLandings.leftUnchanged', { count: receipt.changed.length })}
              {receipt.changed.map((row) => row.gone ? (
                <span key={`${row.asset_id}:${row.field}`} className="text-text-secondary">{t('manage:autoLandings.deletedAsset', { id: row.asset_id })}</span>
              ) : (
                <LinkButton key={`${row.asset_id}:${row.field}`} size="small" onClick={() => openItem(row.asset_id)}>
                  {workLabel(row)}
                </LinkButton>
              ))}
            </p>
          ) : null}
        </Note>
      ) : null}
      {query.isError ? (
        <Note tone="error" title={t('manage:autoLandings.loadFailed')}>{errorMessage(query.error)}</Note>
      ) : items.length ? (
        <DataTable label={t('manage:autoLandings.title')} items={items} columns={columns}
          title={t('manage:autoLandings.title')} titleId="auto-landings-title" unit={t('manage:autoLandings.unit')}
          description={DESCRIPTION}
          rowId={(item) => item.item_key} rowLabel={(item) => `${workLabel(item)} ${fieldName(item)}`}
          selected={selected} onSelected={setSelected}
          actions={(chosen) => (
            <Button variant="secondary" size="small" disabled={locked || !chosen.length}
              {...busyProps(revert.isPending)} onClick={() => revert.mutate(chosen.map((item) => item.item_key))}>
              {t('manage:autoLandings.revertSelected', { count: chosen.length })}
            </Button>
          )} />
      ) : null}
    </section>
  );
}
