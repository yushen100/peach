/* 作品列表的列定义与本机列偏好的存放位置。不依赖 React：壳的首屏骨架与列表岛读同一份。 */
import { t } from '../../i18n';

export const CATALOG_COLUMN_WIDTHS_KEY = 'peach.catalog-column-widths.v1';
export const CATALOG_COLUMN_VISIBILITY_KEY = 'peach.catalog-column-visibility.v1';

export const columnSizes: Record<string, { width: number; min: number; max: number }> = {
  select: { width: 48, min: 48, max: 48 },
  actions: { width: 128, min: 128, max: 128 },
  name: { width: 300, min: 240, max: 2000 },
  people: { width: 220, min: 160, max: 400 },
  library: { width: 112, min: 96, max: 320 },
  tags: { width: 156, min: 144, max: 560 },
  dur: { width: 88, min: 80, max: 240 },
  rating: { width: 168, min: 168, max: 320 },
  plays: { width: 96, min: 96, max: 240 },
  new: { width: 152, min: 144, max: 320 },
  release: { width: 120, min: 112, max: 320 },
  played: { width: 152, min: 144, max: 320 },
  o: { width: 96, min: 96, max: 240 },
  resolution: { width: 120, min: 112, max: 320 },
  size: { width: 96, min: 88, max: 240 },
  code: { width: 144, min: 112, max: 400 },
};

/* 默认显示浏览时常看的：作品、艺人、媒体库、标签、时长、评分、观看次数、入库时间，1440 宽下正好放下；
 * 发行时间、观看时间、高潮计数、分辨率、体积、番号（标题里已有）默认收起，在「显示列」里打开。
 * 列的先后也按这个顺序，表格与骨架都照 `catalogColumns` 排。 */
export const defaultColumnVisibility: Record<string, boolean> = { release: false, played: false, o: false, resolution: false, size: false, code: false };
const labels: Record<string, string> = { select: t('catalog:catalogList.selectColumn'), name: t('catalog:shared.video'), dur: t('catalog:catalogList.duration'), size: t('catalog:catalogList.size'), resolution: t('catalog:catalogList.resolution'),
  rating: t('catalog:shared.rating'), o: t('catalog:catalogList.climaxCount'), plays: t('catalog:catalogList.plays'), new: t('catalog:catalogList.dateAdded'), played: t('catalog:catalogList.lastWatched'), release: t('catalog:catalogList.releaseDate'), code: t('catalog:shared.code'), tags: t('catalog:shared.tags'),
  library: t('catalog:shared.library'), people: t('catalog:shared.performers'), actions: t('catalog:mediaActions.label') };
export const catalogColumns = ['select', 'name', 'actions', 'people', 'library', 'tags', 'dur', 'rating', 'plays', 'new', 'release', 'played', 'o', 'resolution', 'size', 'code']
  .map(id => ({ id, label: labels[id]!, ...columnSizes[id]!, flex: id === 'name', required: id === 'select' || id === 'name' || id === 'actions', visible: defaultColumnVisibility[id] !== false }));

function stored(key: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {} }
}

export interface SnapshotColumn { id: string; label: string; width: number; min: number; max: number; flex: boolean; required: boolean; visible: boolean }
export type TableSnapshot = { id: string; label: string; width: number | null; min: number }[];

/** 首屏骨架按当前列偏好排版：只读存下来的宽度与可见性，与表格的取值规则一致；
 *  `width` 为空的是承接剩余宽度的那一列，`min` 是它不再缩小的宽度。勾选列只在选择模式出现，不画。 */
export function catalogTableSnapshot(): TableSnapshot {
  return tableSnapshot(catalogColumns, CATALOG_COLUMN_WIDTHS_KEY, CATALOG_COLUMN_VISIBILITY_KEY);
}

/** 同上，给别的表（JAV 新作列表）按它自己的列定义与偏好键取一份。 */
export function tableSnapshot(columns: readonly SnapshotColumn[], widthsKey: string, visibilityKey: string): TableSnapshot {
  const widths = stored(widthsKey);
  const shown = stored(visibilityKey);
  return columns
    .filter(column => column.id !== 'select'
      && (column.required || (typeof shown[column.id] === 'boolean' ? shown[column.id] === true : column.visible)))
    .map(column => {
      const saved = widths[column.id];
      const custom = typeof saved === 'number' && Number.isFinite(saved) && !(column.flex && saved === column.width);
      return {
        id: column.id, label: column.label, min: column.width,
        width: custom ? Math.max(column.min, Math.min(column.max, saved)) : column.flex ? null : column.width,
      };
    });
}
