/* 垃圾文件的列表版式：首页列表那一副（`../components/queue-table.tsx`），一行一条，列是文件、类型、判定理由、
 * 体积与那三颗键。点名字或缩略图同点卡片：视频与图片打开预览，别的同「查看位置」。 */
import { fmtSize } from '@peach/legacy/core';

import { CardTags } from '../components/card-meta';
import { QueueIdentity, QueuePicture, QueueTable } from '../components/queue-table';
import { ListLibrary } from '../catalog-grid/catalog-list-page';
import type { useQueueSort } from '../components/queue-sort';
import { JunkActions, junkOpenable, junkPreview, junkReasons, useJunkActions } from './junk-card';
import { junkKindMeta, type JunkItem, type JunkQueueActions, type JunkView } from './junk-queue';
import { t } from '../../i18n';

function JunkName({ item, view, actions }: { item: JunkItem; view: JunkView; actions: JunkQueueActions }) {
  const state = useJunkActions(item, view, actions);
  const [, glyph] = junkKindMeta(item);
  const preview = junkPreview(item);
  const name = String(item.name || '') || t('cleanup:junk.untitled');
  const open = () => {
    if (!junkOpenable(item)) { state.reveal(); return }
    const row = document.querySelector<HTMLElement>(`[data-queue-table] [data-id="${item.id}"]`);
    if (row) actions.open(item, row);
  };
  return <QueueIdentity name={name} onOpen={open}
    picture={<QueuePicture src={preview} glyph={glyph} />} />;
}

function JunkRowActions({ item, view, actions }: { item: JunkItem; view: JunkView; actions: JunkQueueActions }) {
  return <JunkActions state={useJunkActions(item, view, actions)} compact />;
}

export function JunkList({ items, view, selected, selecting, actions, order }: {
  items: readonly JunkItem[]; view: JunkView; selected: ReadonlySet<number>; selecting: boolean; actions: JunkQueueActions;
  order: ReturnType<typeof useQueueSort<JunkItem>>;
}) {
  return (
    <QueueTable table="junk-files" label={t('cleanup:junk.categories')} items={items} selected={selected} selecting={selecting}
      sort={{ options: order.sorts.map(({ key, label }) => ({ id: key, label })), sorting: order.sorting, onChange: order.setSorting }}
      rowLabel={(item) => t('cleanup:junk.selectFile', { name: item.name || t('cleanup:junk.untitled') })}
      onPick={(item) => actions.toggleSelection(item.id, false)}
      onPickAll={(on) => actions.selectAll(items.map((item) => item.id), on)}
      cells={{
        name: (item) => <JunkName item={item} view={view} actions={actions} />,
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
