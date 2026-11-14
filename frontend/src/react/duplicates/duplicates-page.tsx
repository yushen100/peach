/* 重复文件页：同番号、时长相近、分卷标记一致的几份文件归成一组，每组挑一个留下。
 *
 * 顶上一块汇总、一条批量保留的玻璃条，下面每组一张卡：组头说明判据与可回收多少，行里是
 * 每一份文件。留谁由人点；其余的走 `/api/batch` 的 `dispose` 进回收站，回执上带撤销。
 * 几份都要留的点「都保留」，这组不再列出，组员有增减时自己回来。 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { confirmModal, MEDIA_SOURCE_ICONS } from '@peach/legacy/ui';
import { fmtDur, fmtSize, LOC } from '@peach/legacy/core';

import { Button } from '@/components/base/buttons/button';

import { errorMessage } from '../../api';
import type { DuplicatesProps } from '../bundle';
import { cardClass } from '../components/card';
import { CollectionSummary } from '../components/collection-summary';
import { EmptyState } from '../components/empty-state';
import { FilterGlass, GlassPill } from '../components/filter-glass';
import { Note } from '../components/note';
import { SourceLabel } from '../components/source-label';
import { spriteGlyph } from '../components/sprite-glyph';
import { TRASH_KEY } from '../data-cleanup/data-cleanup';
import { cloudLocations, fetchMediaSources, MEDIA_SOURCES_KEY } from '../media-sources';
import { queryClient } from '../query';
import { SourceMark } from '../settings/section';
import { busyProps } from '../settings/use-action';
import {
  batchOperate, bulkCloudPreferences, distinctName, DUPLICATES_KEY, duplicateVictims, fetchDuplicates, keepGroup, KEEP_LABELS,
  mixedCloudPreferences, sharedNamePrefix, victimBytes, type DuplicateFile, type DuplicateGroup, type KeepRule,
} from './duplicates';
import { t } from '../../i18n';

const PLAY = spriteGlyph('play');
const STACK = spriteGlyph('file-stack');

const GROUP = cardClass({
  padding: 'none', radius: 'surface',
  className: 'mb-6 overflow-hidden dark:bg-background-primary-default',
});
const MARK = 'rounded-sm px-1.5 py-px text-caption-1-regular leading-5';
const FLAG = 'rounded-sm px-2 py-0.5 text-caption-1-regular leading-5';
const MONO = 'font-mono text-caption-1-regular leading-5 text-text-secondary';

/** 改完之后要重读的两份：这一页本身，和数据管理页那张回收站读数。 */
const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: DUPLICATES_KEY, exact: true });
  void queryClient.invalidateQueries({ queryKey: TRASH_KEY, exact: true });
};

interface Disposal { groups: readonly DuplicateGroup[]; keep: KeepRule; key: string }

function evidenceFlag(group: DuplicateGroup) {
  if (group.identical) return <span className={`${FLAG} text-(--keep)`}>{t('cleanup:duplicates.sha1Match')}</span>;
  return <span className={`${FLAG} text-text-secondary`}>
    {group.evidence === 'same_code_short_copy' ? t('cleanup:duplicates.sameCodeShorter') : t('cleanup:duplicates.byDuration')}
  </span>;
}

/** 一份副本。`prefix` 是组内共有的名字开头，显示时用「…」顶替，整名在 title 里。 */
function FileRow({ file, prefix, openItem }: { file: DuplicateFile; prefix: string; openItem(id: number): void }) {
  const open = () => openItem(file.id);
  const location = LOC[file.location] || file.location || file.drive;
  return (
    <div className="duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4">
      {/* 封面格居中用 `inline-grid`：`grid` 与旧样式表同名，不生成这个工具类。 */}
      <button type="button" onClick={open} aria-label={t('cleanup:duplicates.previewFile', { name: file.name })}
        className="relative row-span-2 inline-grid aspect-16/10 w-full cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder text-text-secondary">
        <PLAY aria-hidden className="size-6" />
        <img src={`/thumb?id=${file.id}&c=4`} alt="" loading="lazy"
          onError={(event) => event.currentTarget.remove()}
          className="absolute inset-0 size-full object-contain" />
      </button>
      <span className="flex min-w-0 items-center gap-2 max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1">
        <button type="button" onClick={open} title={file.name} data-middle-truncate data-middle-truncate-within
          className="min-w-0 shrink cursor-pointer truncate text-left text-body-regular hover:text-text-secondary">
          {distinctName(file.name, prefix)}
        </button>
        {file.is_largest || file.is_longest
          ? <span className="flex flex-none gap-1">
              {file.is_largest ? <i className={`${MARK} not-italic bg-background-primary-hover text-text-secondary`}>{t('cleanup:duplicates.largest')}</i> : null}
              {file.is_longest ? <i className={`${MARK} not-italic bg-(--keep)/22 text-(--keep)`}>{t('cleanup:duplicates.longest')}</i> : null}
            </span>
          : null}
      </span>
      <span className={`${MONO} flex min-w-0 items-center gap-1.5`}>
        <SourceMark mark={MEDIA_SOURCE_ICONS[file.location] || 'database'} />
        <span title={location} className="min-w-0 truncate">{location}</span>
      </span>
      <span className={MONO}>{fmtSize(file.size || 0)}</span>
      <span className={MONO}>{fmtDur(file.duration)}</span>
      {/* 路径整条折行显示：同一组的几份常只在中段不同，截断会让它们看起来一模一样。 */}
      <span className={`${MONO} col-start-2 -col-end-1 min-w-0 pt-0.5 wrap-anywhere max-duplicate-narrow:col-span-full`}>
        {file.path ?? ''}
      </span>
    </div>
  );
}

export function DuplicatesPage({ openItem, toast, failure }: DuplicatesProps) {
  const duplicates = useQuery({ queryKey: DUPLICATES_KEY, queryFn: ({ signal }) => fetchDuplicates(signal) });
  const sources = useQuery({ queryKey: MEDIA_SOURCES_KEY, queryFn: ({ signal }) => fetchMediaSources(signal) });
  const [pending, setPending] = useState('');
  const dispose = useMutation({
    mutationFn: (ids: readonly number[]) => batchOperate(ids, 'dispose'),
    onSuccess: (_result, ids) => {
      refresh();
      toast(t('cleanup:duplicates.movedToTrash', { count: ids.length }), {
        undo: async () => {
          try {
            await batchOperate(ids, 'restore');
          } catch (cause) {
            failure(t('cleanup:duplicates.undoTrash'), cause);
          } finally {
            refresh();
          }
        },
      });
    },
    onSettled: () => setPending(''),
  });
  // 「都保留」不进回收站，只是让这组不再列出；回执上撤销就把它放回来。
  const keep = useMutation({
    mutationFn: (group: DuplicateGroup) => keepGroup(group.files.map((file) => file.id), true),
    onSuccess: (_result, group) => {
      refresh();
      toast(t('cleanup:duplicates.keptAll', { code: group.code }), {
        undo: async () => {
          try {
            await keepGroup(group.files.map((file) => file.id), false);
          } catch (cause) {
            failure(t('cleanup:duplicates.undoKeepAll'), cause);
          } finally {
            refresh();
          }
        },
      });
    },
    onError: (cause) => failure(t('cleanup:duplicates.markKeepAll'), cause),
    onSettled: () => setPending(''),
  });

  const data = duplicates.data;
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-board">
        <Note tone="error" title={t('cleanup:duplicates.loadFailed')}>{duplicates.error ? errorMessage(duplicates.error) : t('cleanup:duplicates.listUnavailable')}</Note>
      </div>
    );
  }
  const groups = data.groups ?? [];
  const configured = cloudLocations(sources.data);

  const run = ({ groups: chosen, keep, key }: Disposal) => {
    if (dispose.isPending) return;
    const ids = duplicateVictims(chosen, keep);
    if (!ids.length) return;
    void confirmModal({
      title: t('cleanup:duplicates.moveToTrash'),
      body: t('cleanup:duplicates.trashBody', {
        count: ids.length, keep: KEEP_LABELS[keep] ?? KEEP_LABELS.largest, size: fmtSize(victimBytes(chosen, ids)) }),
      confirmLabel: t('cleanup:duplicates.moveToTrash'),
      onConfirm: () => { setPending(key); return dispose.mutateAsync(ids) },
    });
  };
  const busy = (key: string) => busyProps(pending === key && (dispose.isPending || keep.isPending));
  const keepAll = (group: DuplicateGroup, key: string) => {
    if (keep.isPending || dispose.isPending) return;
    setPending(key);
    keep.mutate(group);
  };

  return (
    <div className="mx-auto w-full max-w-board pb-10.5">
      <CollectionSummary label={t('cleanup:duplicates.summaryLabel')} figure={t('cleanup:duplicates.groupCount', { count: Number(data.total || 0) })}
        detail={t('cleanup:duplicates.summaryDetail', { count: Number(data.files || 0), size: fmtSize(data.reclaimable) })} />
      {groups.length
        ? <FilterGlass title={t('cleanup:duplicates.bulkKeep')}>
            <GlassPill busy={pending === 'all:largest'} onPress={() => run({ groups, keep: 'largest', key: 'all:largest' })}>
              {t('cleanup:duplicates.allKeepLargest')}
            </GlassPill>
            <GlassPill busy={pending === 'all:longest'} onPress={() => run({ groups, keep: 'longest', key: 'all:longest' })}>
              {t('cleanup:duplicates.allKeepLongest')}
            </GlassPill>
            {bulkCloudPreferences(groups, configured).map((location) => (
              <GlassPill key={location} busy={pending === `all:${location}`}
                onPress={() => run({ groups, keep: location, key: `all:${location}` })}>
                <SourceLabel source={location} label={t('cleanup:duplicates.allPreferStorage', { storage: LOC[location] || location })} />
              </GlassPill>
            ))}
          </FilterGlass>
        : null}
      {dispose.isError
        ? <div className="mb-5"><Note tone="error" title={t('cleanup:duplicates.trashFailed')}>{errorMessage(dispose.error)}</Note></div>
        : null}
      {groups.length
        ? groups.map((group, index) => {
            const one = [group];
            const prefix = sharedNamePrefix(group.files.map((file) => file.name));
            const key = (keep: string) => `${index}:${keep}`;
            return (
              <section key={`${group.code}-${index}`} aria-label={group.code} className={GROUP}>
                <div className="flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default">
                  <b className="text-title-2-medium text-text-primary">{group.code}</b>
                  <span className="font-mono text-caption-1-regular leading-5 text-text-primary">
                    {t('cleanup:duplicates.groupDetail', { count: Number(group.count || 0), size: fmtSize(group.reclaimable) })}
                  </span>
                  {evidenceFlag(group)}
                  {group.cross_drive
                    ? <span className={`${FLAG} text-text-secondary`}>{t('cleanup:duplicates.crossDrive', { drives: group.drives.join(' ') })}</span>
                    : null}
                  <span className="ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full">
                    <Button variant="secondary" size="small" {...busy(key('largest'))}
                      onClick={() => run({ groups: one, keep: 'largest', key: key('largest') })}>{t('cleanup:duplicates.keepLargest')}</Button>
                    <Button variant="secondary" size="small" {...busy(key('longest'))}
                      onClick={() => run({ groups: one, keep: 'longest', key: key('longest') })}>{t('cleanup:duplicates.keepLongest')}</Button>
                    {mixedCloudPreferences(group.files, configured).map((location) => (
                      <Button key={location} variant="secondary" size="small" {...busy(key(location))}
                        onClick={() => run({ groups: one, keep: location, key: key(location) })}>
                        <SourceLabel source={location} label={t('cleanup:duplicates.keepStorage', { storage: LOC[location] || location })} />
                      </Button>
                    ))}
                    <Button variant="secondary" size="small" {...busy(key('keep'))}
                      onClick={() => keepAll(group, key('keep'))}>{t('cleanup:duplicates.keepAll')}</Button>
                    <Button variant="danger" size="small" {...busy(key('all'))}
                      onClick={() => run({ groups: one, keep: 'all', key: key('all') })}>{t('cleanup:duplicates.trashGroup')}</Button>
                  </span>
                </div>
                <div>{group.files.map((file) => <FileRow key={file.id} file={file} prefix={prefix} openItem={openItem} />)}</div>
              </section>
            );
          })
        : <EmptyState icon={STACK} title={t('cleanup:duplicates.emptyTitle')}>
            {t('cleanup:duplicates.emptyBody')}
          </EmptyState>}
      {groups.length > 0 && data.total > groups.length
        ? <p className="text-center text-caption-1-regular text-text-secondary">
            {t('cleanup:duplicates.topGroups', { shown: groups.length.toLocaleString(), count: Number(data.total) })}
          </p>
        : null}
      {data.kept
        ? <p className="mt-2 text-center text-caption-1-regular text-text-secondary">
            {t('cleanup:duplicates.keptHidden', { count: data.kept })}
          </p>
        : null}
    </div>
  );
}
