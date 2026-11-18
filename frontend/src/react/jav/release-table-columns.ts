/* JAV 新作列表的列定义与本机列偏好的存放位置。不依赖 React：路由骨架与列表读同一份。 */
import { tableSnapshot, type TableSnapshot } from '../catalog-grid/catalog-table-columns';
import type { ReleaseSort } from './discovery-sorts';
import { t } from '../../i18n';

export const RELEASE_COLUMN_WIDTHS_KEY = 'peach.table.jav-releases.widths.v1';
export const RELEASE_COLUMN_VISIBILITY_KEY = 'peach.table.jav-releases.visibility.v1';

const sizes: Record<string, { width: number; min: number; max: number }> = {
  name: { width: 300, min: 240, max: 2000 },
  people: { width: 220, min: 160, max: 400 },
  studio: { width: 128, min: 112, max: 320 },
  tags: { width: 156, min: 144, max: 560 },
  release: { width: 128, min: 128, max: 240 },
  dur: { width: 104, min: 104, max: 200 },
  score: { width: 128, min: 128, max: 200 },
  actions: { width: 184, min: 184, max: 320 },
  code: { width: 128, min: 112, max: 320 },
};
const labels: Record<string, string> = { name: t('catalog:shared.video'), people: t('catalog:shared.performers'), studio: t('catalog:shared.label'), tags: t('catalog:shared.tags'), code: t('catalog:shared.code'),
  dur: t('catalog:catalogList.duration'), score: t('catalog:javSort.siteRating'), release: t('catalog:catalogList.releaseDate'), actions: t('catalog:detailFeedback.genericAction') };

/** 表头点了能排序的列，对应到新作接口的排序键；其余列不排。 */
export const RELEASE_SORT_COLUMNS: Record<string, ReleaseSort> = { code: 'code', dur: 'duration', score: 'source_score', release: 'release_date' };

/* 列的先后：作品、艺人、厂牌、标签，再是新作最常按它挑的发行时间、时长、来源评分，操作收尾；番号标题里已有，
 * 默认收起。默认显示的这几列 1440 宽下正好放下。 */
export const releaseColumns = ['name', 'people', 'studio', 'tags', 'release', 'dur', 'score', 'actions', 'code']
  .map(id => ({ id, label: labels[id]!, ...sizes[id]!, flex: id === 'name', required: id === 'name', visible: id !== 'code' }));

export function releaseTableSnapshot(): TableSnapshot {
  return tableSnapshot(releaseColumns, RELEASE_COLUMN_WIDTHS_KEY, RELEASE_COLUMN_VISIBILITY_KEY);
}
