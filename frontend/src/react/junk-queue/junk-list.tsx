/* 垃圾文件的列表版式：首页列表那一副（`../components/queue-table.tsx`），一行一条，列是文件、类型、判定理由、
 * 体积与那三颗键。点名字或缩略图同点卡片：视频与图片打开预览，别的同「查看位置」。 */
import { Button } from '@/components/base/buttons/button';
import { fmtSize } from '@peach/legacy/core';

import { CardTags, Icon } from '../components/card-meta';
import { QueueIdentity, QueuePicture, QueueTable } from '../components/queue-table';
import { ListLibrary } from '../catalog-grid/catalog-list-page';
import type { useQueueSort } from '../components/queue-sort';
import { JunkActions, junkContextOperations, junkOpenable, junkPreview, junkReasons, useJunkActions } from './junk-card';
import { junkKindMeta, type JunkItem, type JunkQueueActions, type JunkView } from './junk-queue';
import { t } from '../../i18n';
import type { RemoteTableFilters } from '../components/use-table-filters';
import { partsLabel } from '../../core/server-text';

type Copies = { count: number; bytes: number; expanded: boolean; toggle(): void };

function JunkName({ item, view, actions, copies }: { item: JunkItem; view: JunkView; actions: JunkQueueActions; copies?: Copies }) {
  const state = useJunkActions(item, view, actions);
  const [, glyph] = junkKindMeta(item);
  const preview = junkPreview(item);
  const name = String(item.name || '') || t('cleanup:junk.untitled');
  const open = () => {
    if (!junkOpenable(item)) { state.reveal(); return }
    const row = document.querySelector<HTMLElement>(`[data-queue-table] [data-id="${item.id}"]`);
    if (row) actions.open(item, row);
  };
  return <div>
    <QueueIdentity name={name} onOpen={open} picture={<QueuePicture src={preview} glyph={glyph} />} />
    {copies ? <div className="flex flex-wrap items-center gap-2 text-caption-1-regular text-text-secondary">
      <span>{t('cleanup:junk.copies', { count: copies.count, size: fmtSize(copies.bytes) })}</span>
      <Button variant="ghost" size="small" onClick={(event) => { event.stopPropagation(); copies.toggle() }}>
        {t(copies.expanded ? 'cleanup:junk.hideCopies' : 'cleanup:junk.showCopies')}
      </Button>
    </div> : null}
  </div>;
}

function JunkRowActions({ item, view, actions }: { item: JunkItem; view: JunkView; actions: JunkQueueActions }) {
  return <JunkActions state={useJunkActions(item, view, actions)} compact />;
}

export function JunkList({ items, view, selected, selecting, actions, order, copies, filters, busy }: {
  items: readonly JunkItem[]; view: JunkView; selected: ReadonlySet<number>; selecting: boolean; actions: JunkQueueActions;
  order: ReturnType<typeof useQueueSort<JunkItem>>;
  copies?: (item: JunkItem) => Copies | undefined;
  filters: RemoteTableFilters;
  busy: boolean;
}) {
  return (
    <QueueTable table="junk-files" label={t('cleanup:junk.categories')} items={items} selected={selected} selecting={selecting}
      contextOperations={item => junkContextOperations(item, view, selected.has(item.id), actions)}
      filters={filters} busy={busy} filterColumns={{
        kind: { values: item => item.junk_kind || 'other', option: kind => {
          const [label, glyph] = junkKindMeta({ id: 0, junk_kind: kind });
          return { label, leading: <Icon name={glyph} /> };
        } },
        why: { values: junkReasons, option: value => ({ label: value === 'none' ? t('cleanup:shared.none') : partsLabel([JSON.parse(value)], value) }) },
      }}
      sort={{ options: order.sorts.map(({ key, label }) => ({ id: key, label })), sorting: order.sorting, onChange: order.setSorting }}
      rowLabel={(item) => t('cleanup:junk.selectFile', { name: item.name || t('cleanup:junk.untitled') })}
      onPick={(item) => actions.toggleSelection(item.id, false)}
      onPickAll={(on) => actions.selectAll(items.map((item) => item.id), on)}
      cells={{
        name: (item) => <JunkName item={item} view={view} actions={actions} copies={copies?.(item)} />,
        library: (item) => <ListLibrary item={{ library_id: item.library_id }} />,
        kind: (item) => junkKindMeta(item)[0],
        why: (item) => {
          const reasons = junkReasons(item);
          return reasons.length ? <CardTags tags={reasons} label={(tag) => tag} readOnly data-list-tags="" /> : '—';
        },
        size: (item) => Number(item.size) > 0 ? fmtSize(Number(item.size)) : '—',
        actions: (item) => <JunkRowActions item={item} view={view} actions={actions} />,
      }} />
  );
}
