/* 处理队列页（垃圾文件、高清版）列表版式的列：名字、默认宽与拖宽上下限、能不能点列头排序、默认收不收起。
 * 不依赖 React：列表（`react/components/queue-table.tsx`）往上挂单元格，壳的首屏骨架（`queue-skeleton.ts`）
 * 按同一份列与本机列偏好排版，接管那一拍列不跳。第一列是名称列，承接剩余宽度、不能收起。 */
import { tableSnapshot, type SnapshotColumn, type TableSnapshot } from './react/catalog-grid/catalog-table-columns';
import { t } from './i18n';

export type QueueTablePage = 'junk-files' | 'quality-goals';
export interface QueueColumnSpec {
  id: string; header: string; width: number; min: number; max: number; sortable?: boolean; hidden?: boolean;
}

export const QUEUE_COLUMNS: Readonly<Record<QueueTablePage, () => QueueColumnSpec[]>> = {
  'junk-files': () => [
    { id: 'name', header: t('cleanup:shared.files'), width: 300, min: 240, max: 2000 },
    { id: 'library', header: t('catalog:shared.library'), width: 112, min: 96, max: 320 },
    { id: 'kind', header: t('cleanup:shared.type'), width: 96, min: 80, max: 200 },
    { id: 'why', header: t('cleanup:junk.listReason'), width: 220, min: 160, max: 560 },
    { id: 'size', header: t('settings:shared.fileSize'), width: 96, min: 88, max: 240, sortable: true },
    { id: 'actions', header: t('cleanup:shared.actions'), width: 280, min: 260, max: 400 },
  ],
  'quality-goals': () => [
    { id: 'name', header: t('manage:shared.video'), width: 300, min: 240, max: 2000 },
    { id: 'library', header: t('catalog:shared.library'), width: 112, min: 96, max: 320 },
    { id: 'source', header: t('navigation:sidebarFilters.storage'), width: 112, min: 96, max: 240, hidden: true },
    { id: 'dur', header: t('settings:shared.duration'), width: 88, min: 80, max: 240, sortable: true },
    { id: 'size', header: t('settings:shared.fileSize'), width: 96, min: 88, max: 240, sortable: true },
    { id: 'reason', header: t('manage:hdUpgrades.listReason'), width: 180, min: 140, max: 480 },
    { id: 'actions', header: t('cleanup:shared.actions'), width: 220, min: 200, max: 360 },
  ],
};

/** 列偏好存在本机的键，同 `react/components/table-column-preferences.ts` 的 `useTablePreferences` 默认那一对。 */
export const queueTableKeys = (page: QueueTablePage) =>
  ({ widths: `peach.table.queue-${page}.widths.v1`, visibility: `peach.table.queue-${page}.visibility.v1` });

/** 首屏骨架按当前列偏好排版的那一份列。 */
export function queueTableSnapshot(page: QueueTablePage): TableSnapshot {
  const columns: SnapshotColumn[] = QUEUE_COLUMNS[page]().map((column, index) => ({
    id: column.id, label: column.header, width: column.width, min: column.min, max: column.max,
    flex: index === 0, required: index === 0, visible: !column.hidden,
  }));
  const keys = queueTableKeys(page);
  return tableSnapshot(columns, keys.widths, keys.visibility);
}
