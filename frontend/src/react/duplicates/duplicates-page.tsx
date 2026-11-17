/* 重复文件页：同番号、时长相近、分卷标记一致的几份文件归成一组，每组挑一个留下。
 *
 * 顶上一块汇总、一条批量保留的玻璃条，下面每组一张卡：组头有勾选框、判据与可回收多少，行里是
 * 每一份文件。这一页是处理队列，勾选框与「全选本页」直接显示；选中几组后底部条给成批的
 * 保留规则、都保留与整组回收。留谁由人点；其余的走 `/api/batch` 的 `dispose` 进回收站。
 *
 * 几份都要留的点「都保留」：这组不再列出，组里删掉或失联一份也不会回来，只有新文件加入才
 * 重新出现，并标出新加入的那几份。保留过的组在「已保留」视图里，能逐组或成批取消保留。
 * 所有成批的动作都先弹窗，回执带撤销（`components/bulk-action.ts`）。 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { confirmModal, MEDIA_SOURCE_ICONS } from '@peach/legacy/ui';
import { fmtDur, fmtSize, LOC } from '@peach/legacy/core';
import { coverUrl } from '@peach/card-art';

import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';

import { errorMessage } from '../../api';
import type { DuplicatesProps } from '../bundle';
import { runBulkAction, type BulkAction, type BulkHost } from '../components/bulk-action';
import { cardClass } from '../components/card';
import { EmptyState } from '../components/empty-state';
import { FilterGlassRows, FilterActionButton, SelectAllButton } from '../components/filter-glass';
import { useQueueSort } from '../components/queue-sort';
import { SortKeys } from '../entity-filter/entity-filter-page';
import { Note } from '../components/note';
import { enterPageSelection, exitPageSelection, usePageSelection } from '../components/page-selection';
import { SelectionDock } from '../components/selection-dock';
import { FilenameComparison } from '../components/filename-comparison';
import { ComparisonText } from '../review/comparison-text';
import { SourceLabel } from '../components/source-label';
import { spriteGlyph } from '../components/sprite-glyph';
import { TRASH_KEY } from '../data-cleanup/data-cleanup';
import { cloudLocations, fetchMediaSources, MEDIA_SOURCES_KEY } from '../media-sources';
import { queryClient } from '../query';
import { SourceMark } from '../settings/section';
import { busyProps } from '../settings/use-action';
import {
  batchOperate, bulkCloudPreferences, DUPLICATES_KEY, duplicateVictims, fetchDuplicates, fetchKeptDuplicates, groupKey,
  keepGroup, keepGroups, KEEP_LABELS, KEPT_DUPLICATES_KEY, mixedCloudPreferences, victimBytes,
  type DuplicateFile, type DuplicateGroup, type KeepRule,
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

/** 改完之后要重读的几份：待处理与已保留两份分组，和数据管理页那张回收站读数。 */
const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: DUPLICATES_KEY });
  void queryClient.invalidateQueries({ queryKey: TRASH_KEY, exact: true });
};

const fileCount = (groups: readonly DuplicateGroup[]) => groups.reduce((sum, group) => sum + group.files.length, 0);

/** 按一条保留规则成批回收：每组只留一个，其余进回收站，回执的撤销把它们原样还原。 */
function keepRuleAction(keep: KeepRule, label: string): BulkAction<DuplicateGroup> {
  let moved: number[] = [];
  return {
    key: `keep-${keep}`, label, reversal: 'undo', danger: keep === 'all', holdToConfirm: true,
    confirm: (groups) => {
      const ids = duplicateVictims(groups, keep);
      return { title: t('cleanup:duplicates.moveToTrash'), danger: keep === 'all',
        body: t('cleanup:duplicates.trashBody', { count: ids.length, groups: groups.length,
          keep: KEEP_LABELS[keep] ?? KEEP_LABELS.largest, size: fmtSize(victimBytes(groups, ids)) }) };
    },
    run: async (groups) => {
      moved = duplicateVictims(groups, keep);
      await batchOperate(moved, 'dispose');
      refresh();
      return async () => { await batchOperate(moved, 'restore'); refresh() };
    },
    receipt: () => t('cleanup:duplicates.movedToTrash', { count: moved.length }),
  };
}

/** 成批标都保留：不删除任何文件，这些组不再列出；回执与「已保留」视图都能取消。 */
const keepAllAction = (label: string): BulkAction<DuplicateGroup> => ({
  key: 'keep-all', label, reversal: 'undo',
  confirm: (groups) => ({ title: t('cleanup:duplicates.markKeepAll'),
    body: t('cleanup:duplicates.keepAllBody', { count: groups.length, files: fileCount(groups) }),
    recovery: t('cleanup:duplicates.keepAllRecovery') }),
  run: async (groups) => {
    await keepGroups(groups, true);
    refresh();
    return async () => { await keepGroups(groups, false); refresh() };
  },
  receipt: (groups) => t('cleanup:duplicates.keptGroups', { count: groups.length }),
});

/** 「已保留」视图里取消保留：这些组回到待处理，不动任何文件。 */
const unkeepAction = (label: string): BulkAction<DuplicateGroup> => ({
  key: 'unkeep', label, reversal: 'undo',
  confirm: (groups) => ({ title: t('cleanup:duplicates.unkeep'),
    body: t('cleanup:duplicates.unkeepBody', { count: groups.length }) }),
  run: async (groups) => {
    await keepGroups(groups, false);
    refresh();
    return async () => { await keepGroups(groups, true); refresh() };
  },
  receipt: (groups) => t('cleanup:duplicates.unkeptGroups', { count: groups.length }),
});

interface Disposal { groups: readonly DuplicateGroup[]; keep: KeepRule; key: string }

function evidenceFlag(group: DuplicateGroup) {
  if (group.identical) return <span className={`${FLAG} text-(--keep)`}>{t('cleanup:duplicates.sha1Match')}</span>;
  return <span className={`${FLAG} text-text-secondary`}>
    {group.evidence === 'same_code_short_copy' ? t('cleanup:duplicates.sameCodeShorter') : t('cleanup:duplicates.byDuration')}
  </span>;
}

/** 一份副本，名称与路径沿用复核页的差异高亮。 */
function FileRow({ file, reference, openItem, selected, onSelect }: {
  file: DuplicateFile; reference?: DuplicateFile; openItem(id: number): void;
  selected: boolean; onSelect?: (on: boolean) => void;
}) {
  const open = () => openItem(file.id);
  const location = LOC[file.location] || file.location || file.drive;
  const thumbnail = `/thumb?id=${file.id}&c=4`;
  return (
    <div className="duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4">
      {/* 封面格居中用 `inline-grid`：`grid` 与旧样式表同名，不生成这个工具类。 */}
      <button type="button" onClick={open} aria-label={t('cleanup:duplicates.previewFile', { name: file.name })}
        className="relative row-span-2 inline-grid aspect-16/10 w-full cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder text-text-secondary">
        <PLAY aria-hidden className="size-6" />
        <img key={file.cover_version || thumbnail} src={file.has_cover ? coverUrl(file, 2) : thumbnail} alt="" loading="lazy"
          data-drop="self" data-fallbacks={file.has_cover ? thumbnail : undefined}
          className="absolute inset-0 size-full object-contain" />
      </button>
      <span className="flex min-w-0 items-center gap-2 max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1">
        {onSelect ? <Checkbox slot={null} aria-label={t('cleanup:duplicates.selectFile', { name: file.name })}
          isSelected={selected} onChange={onSelect} /> : null}
        <FilenameComparison value={file.name} reference={reference?.name} onOpen={open} />
        {file.is_largest || file.is_longest || file.is_new
          ? <span className="flex flex-none gap-1">
              {file.is_new ? <i className={`${MARK} not-italic bg-background-primary-hover text-text-primary`}>{t('cleanup:duplicates.newCopy')}</i> : null}
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
        <ComparisonText value={file.path ?? ''} reference={reference?.path ?? undefined} />
      </span>
    </div>
  );
}

export function DuplicatesPage({ openItem, toast, failure }: DuplicatesProps) {
  const [view, setView] = useState<'pending' | 'kept'>('pending');
  const duplicates = useQuery({ queryKey: DUPLICATES_KEY, queryFn: ({ signal }) => fetchDuplicates(signal) });
  const kept = useQuery({ queryKey: KEPT_DUPLICATES_KEY, queryFn: ({ signal }) => fetchKeptDuplicates(signal), enabled: view === 'kept' });
  const sources = useQuery({ queryKey: MEDIA_SOURCES_KEY, queryFn: ({ signal }) => fetchMediaSources(signal) });
  const [pending, setPending] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [pickedFiles, setPickedFiles] = useState<ReadonlySet<number>>(new Set());
  usePageSelection(() => { setPicked(new Set()); setPickedFiles(new Set()) });
  const host: BulkHost = { receipt: toast, failure: (cause) => failure(t('cleanup:duplicates.bulkFailed'), cause) };
  const dispose = useMutation({
    mutationFn: (ids: readonly number[]) => batchOperate(ids, 'dispose'),
    onSuccess: (_result, ids) => {
      setPickedFiles((current) => new Set([...current].filter((id) => !ids.includes(id))));
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
  // 单组的「都保留」与「取消保留」不弹窗：一组一键，回执上就能撤销。
  const keep = useMutation({
    mutationFn: ({ group, on }: { group: DuplicateGroup; on: boolean }) => keepGroup(group.files.map((file) => file.id), on),
    onSuccess: (_result, { group, on }) => {
      refresh();
      toast(t(on ? 'cleanup:duplicates.keptAll' : 'cleanup:duplicates.unkeptOne', { code: group.code }), {
        undo: async () => {
          try {
            await keepGroup(group.files.map((file) => file.id), !on);
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

  /* 浮层上的排序键：按每组可回收的体积排，在本页排，不发请求。 */
  const order = useQueueSort<DuplicateGroup>('duplicates', { size: (group) => Number(group.reclaimable || 0) });
  const keptView = view === 'kept';
  const data = keptView ? kept.data : duplicates.data;
  const failed = keptView ? kept.error : duplicates.error;
  if (!data) {
    if (keptView && kept.isPending) return <div className="mx-auto w-full max-w-board" />;
    return (
      <div className="mx-auto w-full max-w-board">
        <Note tone="error" title={t('cleanup:duplicates.loadFailed')}>{failed ? errorMessage(failed) : t('cleanup:duplicates.listUnavailable')}</Note>
      </div>
    );
  }
  const groups = order.sort(data.groups ?? []);
  const keptCount = Number(duplicates.data?.kept ?? data.kept ?? 0);
  const configured = cloudLocations(sources.data);
  const chosen = groups.filter((group) => picked.has(groupKey(group)));
  const switchView = (next: 'pending' | 'kept') => { setPicked(new Set()); setPickedFiles(new Set()); setView(next) };
  const toggle = (group: DuplicateGroup, on: boolean) => {
    if (on) enterPageSelection();
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(groupKey(group)); else next.delete(groupKey(group));
      return next;
    });
  };
  const runAll = (action: BulkAction<DuplicateGroup>, key: string) => {
    if (pending) return;
    setPending(key);
    void runBulkAction(action, groups, host).catch(host.failure).finally(() => setPending(''));
  };

  const run = ({ groups: chosenGroups, keep: rule, key }: Disposal) => {
    if (dispose.isPending) return;
    const ids = duplicateVictims(chosenGroups, rule);
    if (!ids.length) return;
    void confirmModal({
      title: t('cleanup:duplicates.moveToTrash'),
      body: t('cleanup:duplicates.trashBody', {
        count: ids.length, groups: chosenGroups.length, keep: KEEP_LABELS[rule] ?? KEEP_LABELS.largest, size: fmtSize(victimBytes(chosenGroups, ids)) })
        + t('shell:bulkAction.canUndo'),
      confirmLabel: t('cleanup:duplicates.moveToTrash'),
      holdToConfirm: true,
      onConfirm: () => { setPending(key); return dispose.mutateAsync(ids) },
    });
  };
  const selectFile = (id: number, on: boolean) => {
    if (on) enterPageSelection();
    setPickedFiles((current) => {
      const next = new Set(current);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };
  const runFiles = (group: DuplicateGroup, key: string) => {
    if (pending) return;
    const ids = group.files.filter((file) => pickedFiles.has(file.id)).map((file) => file.id);
    if (!ids.length) return;
    void confirmModal({
      title: t('cleanup:duplicates.moveToTrash'),
      body: t('cleanup:duplicates.selectedTrashBody', {
        count: ids.length, remaining: group.files.length - ids.length, size: fmtSize(victimBytes([group], ids)),
      }) + t('shell:bulkAction.canUndo'),
      confirmLabel: t('cleanup:duplicates.moveToTrash'), holdToConfirm: true,
      onConfirm: () => { setPending(key); return dispose.mutateAsync(ids) },
    });
  };
  const busy = (key: string) => busyProps(pending === key && (dispose.isPending || keep.isPending));
  const keepOne = (group: DuplicateGroup, key: string, on: boolean) => {
    if (keep.isPending || dispose.isPending) return;
    setPending(key);
    keep.mutate({ group, on });
  };
  const selectPage = <SelectAllButton label={t('cleanup:duplicates.selectPage')} picked={chosen.length} total={groups.length}
    onChange={(on) => { if (on) enterPageSelection(); setPicked(on ? new Set(groups.map(groupKey)) : new Set()) }} />;
  const dockActions = keptView
    ? [unkeepAction(t('cleanup:duplicates.unkeep'))]
    : [
        keepRuleAction('largest', t('cleanup:duplicates.keepLargest')),
        keepRuleAction('longest', t('cleanup:duplicates.keepLongest')),
        ...bulkCloudPreferences(chosen, configured).map((location) =>
          keepRuleAction(location, t('cleanup:duplicates.keepStorage', { storage: LOC[location] || location }))),
        keepAllAction(t('cleanup:duplicates.keepAll')),
        keepRuleAction('all', t('cleanup:duplicates.trashGroup')),
      ];

  return (
    <div className="mx-auto w-full max-w-board pb-10.5">
      {/* 首页那副两排玻璃浮层：上排批量动作与换视图，下排读数加「全选本页」。 */}
      <FilterGlassRows label={keptView ? t('cleanup:duplicates.keptLabel') : t('cleanup:duplicates.bulkKeep')}
        topLabel={keptView ? t('cleanup:duplicates.keptLabel') : t('cleanup:duplicates.bulkKeep')}
        attrs={{ 'data-catalog-frame': '', 'data-filter-frame': '', 'data-duplicates-frame': '' }} bottomClassName="min-h-12"
        top={keptView
          ? <>
              {groups.length
                ? <FilterActionButton busy={pending === 'all:unkeep'} onPress={() => runAll(unkeepAction(t('cleanup:duplicates.allUnkeep')), 'all:unkeep')}>
                    {t('cleanup:duplicates.allUnkeep')}
                  </FilterActionButton>
                : null}
              <span className="ml-auto" />
              <FilterActionButton onPress={() => switchView('pending')}>{t('cleanup:duplicates.backToPending')}</FilterActionButton>
            </>
          : <>
              {groups.length ? <>
                <FilterActionButton busy={pending === 'all:largest'} onPress={() => runAll(keepRuleAction('largest', ''), 'all:largest')}>
                  {t('cleanup:duplicates.allKeepLargest')}
                </FilterActionButton>
                <FilterActionButton busy={pending === 'all:longest'} onPress={() => runAll(keepRuleAction('longest', ''), 'all:longest')}>
                  {t('cleanup:duplicates.allKeepLongest')}
                </FilterActionButton>
                {bulkCloudPreferences(groups, configured).map((location) => (
                  <FilterActionButton key={location} busy={pending === `all:${location}`}
                    onPress={() => runAll(keepRuleAction(location, ''), `all:${location}`)}>
                    <SourceLabel source={location} label={t('cleanup:duplicates.allPreferStorage', { storage: LOC[location] || location })} />
                  </FilterActionButton>
                ))}
                <FilterActionButton busy={pending === 'all:keep'} onPress={() => runAll(keepAllAction(''), 'all:keep')}>
                  {t('cleanup:duplicates.allKeepAll')}
                </FilterActionButton>
              </> : null}
              <span className="ml-auto" />
              <FilterActionButton onPress={() => switchView('kept')}>{t('cleanup:duplicates.viewKept', { count: keptCount })}</FilterActionButton>
            </>}
        bottom={<><span data-catalog-summary="">
          <span data-catalog-readout="" role="status">
            {keptView ? t('cleanup:duplicates.keptLabel') : t('cleanup:duplicates.summaryLabel')} · {t('cleanup:duplicates.groupCount', { count: Number(data.total || 0) })}
            {' · '}{keptView ? t('cleanup:duplicates.keptDetail', { count: Number(data.files || 0) })
              : t('cleanup:duplicates.summaryDetail', { count: Number(data.files || 0), size: fmtSize(data.reclaimable) })}
          </span>
          {groups.length ? selectPage : null}
        </span>
        <span data-entity-sorts=""><SortKeys sorts={order.sorts} onSort={order.onSort} /></span></>} />
      <SelectionDock label={t('cleanup:duplicates.dockLabel')} visible={chosen.length > 0}
        count={t('cleanup:duplicates.selectedGroups', { count: chosen.length })}
        actions={dockActions.map((action) => ({ action, items: chosen, host, done: () => setPicked(new Set()) }))}>
        <Button variant="ghost" size="small" onClick={exitPageSelection}>{t('cleanup:duplicates.clearSelection')}</Button>
      </SelectionDock>
      {dispose.isError
        ? <div className="mb-5"><Note tone="error" title={t('cleanup:duplicates.trashFailed')}>{errorMessage(dispose.error)}</Note></div>
        : null}
      {groups.length
        ? groups.map((group, index) => {
            const one = [group];
            const key = (rule: string) => `${index}:${rule}`;
            return (
              <section key={groupKey(group)} aria-label={group.code} className={GROUP}
                data-board-selected={picked.has(groupKey(group)) || undefined}>
                <div className="flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default">
                  <Checkbox slot={null} aria-label={t('cleanup:duplicates.selectGroup', { code: group.code })}
                    isSelected={picked.has(groupKey(group))} onChange={(on) => toggle(group, on)} />
                  <b className="text-title-2-medium text-text-primary">{group.code}</b>
                  <span className="font-mono text-caption-1-regular leading-5 text-text-primary">
                    {t('cleanup:duplicates.groupDetail', { count: Number(group.count || 0), size: fmtSize(group.reclaimable) })}
                  </span>
                  {evidenceFlag(group)}
                  {group.new_files
                    ? <span className={`${FLAG} text-text-primary`}>{t('cleanup:duplicates.newFiles', { count: group.new_files })}</span>
                    : null}
                  {group.cross_drive
                    ? <span className={`${FLAG} text-text-secondary`}>{t('cleanup:duplicates.crossDrive', { drives: group.drives.join(' ') })}</span>
                    : null}
                  <span className="ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full">
                    {keptView
                      ? <Button variant="secondary" size="small" {...busy(key('unkeep'))}
                          onClick={() => keepOne(group, key('unkeep'), false)}>{t('cleanup:duplicates.unkeep')}</Button>
                      : <>
                          <Button variant="danger" size="small" {...busy(key('files'))}
                            disabled={pending !== '' || !group.files.some((file) => pickedFiles.has(file.id))}
                            onClick={() => runFiles(group, key('files'))}>
                            {t('cleanup:duplicates.trashSelectedFiles', { count: group.files.filter((file) => pickedFiles.has(file.id)).length })}
                          </Button>
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
                            onClick={() => keepOne(group, key('keep'), true)}>{t('cleanup:duplicates.keepAll')}</Button>
                          <Button variant="danger" size="small" {...busy(key('all'))}
                            onClick={() => run({ groups: one, keep: 'all', key: key('all') })}>{t('cleanup:duplicates.trashGroup')}</Button>
                        </>}
                  </span>
                </div>
                <div>{group.files.map((file) => <FileRow key={file.id} file={file}
                  reference={group.files.find(other => other.id !== file.id)} openItem={openItem}
                  selected={pickedFiles.has(file.id)} onSelect={keptView ? undefined : (on) => selectFile(file.id, on)} />)}</div>
              </section>
            );
          })
        : keptView
          ? <EmptyState icon={STACK} title={t('cleanup:duplicates.keptEmptyTitle')}>{t('cleanup:duplicates.keptEmptyBody')}</EmptyState>
          : <EmptyState icon={STACK} title={t('cleanup:duplicates.emptyTitle')}>{t('cleanup:duplicates.emptyBody')}</EmptyState>}
      {groups.length > 0 && data.total > groups.length
        ? <p className="text-center text-caption-1-regular text-text-secondary">
            {t('cleanup:duplicates.topGroups', { shown: groups.length.toLocaleString(), count: Number(data.total) })}
          </p>
        : null}
    </div>
  );
}
