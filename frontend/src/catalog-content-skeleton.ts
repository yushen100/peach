import { skeletonHtml } from './ui-kit/skeleton';
import { catalogView } from './react/catalog-grid/catalog-view';
import { catalogTableSnapshot, type TableSnapshot } from './react/catalog-grid/catalog-table-columns';
import { esc } from './core';
import { COMPLETION_ROW_SKELETON_HTML, completionRowRemembered } from './react/library-processing/completion-row';

/** 列表骨架一格的内容，壳与列表岛共用：名称格是缩略图和两行标题，艺人格是圆头像加一条，媒体库、厂牌格是
 *  小标识加一条，其余列一条短条。 */
export function catalogListSkeletonCellHtml(column: string): string {
  if (column === 'name') return '<span data-list-skeleton-name><i class="skeleton-sheen"></i><span><i class="skeleton-sheen"></i><i class="skeleton-sheen"></i></span></span>';
  if (column === 'people' || column === 'library' || column === 'studio') return `<span data-list-skeleton-mark="${column}"><b class="skeleton-sheen"></b><i class="skeleton-sheen"></i></span>`;
  return '<i data-list-skeleton-bar class="skeleton-sheen"></i>';
}

/* 壳的列表骨架直接套真实表格的外框与 `bui-table` 类：工具栏一行、表头写真实列名、列宽按本机列偏好，
 * 列表岛接管后在真实表格里画同样的骨架行，数据到之前不换结构。 */
function catalogListSkeletonHtml(label: string): string {
  return `<div class="peach-react catalog-skeleton" data-skeleton="catalog/list" role="status" aria-busy="true" aria-label="${esc(label)}">`
    + listTableSkeletonHtml(catalogTableSnapshot(), completionRowRemembered() ? COMPLETION_ROW_SKELETON_HTML : '') + '</div>';
}

/** 工具栏一行加按列偏好排好的表格骨架；馆藏列表、JAV 新作列表与处理队列页列表共用，`between` 插在工具栏与表格之间。 */
export function listTableSkeletonHtml(columns: TableSnapshot, between = ''): string {
  const flexible = columns.some(column => column.width === null);
  const minimum = columns.reduce((sum, column) => sum + (column.width ?? column.min), 0);
  const cols = columns.map(column => column.width === null ? '<col>' : `<col style="width:${column.width}px">`).join('')
    + (flexible ? '' : '<col>');
  const head = columns.map(column => `<th>${esc(column.label)}</th>`).join('') + (flexible ? '' : '<th></th>');
  const row = `<tr>${columns.map(column => `<td>${catalogListSkeletonCellHtml(column.id)}</td>`).join('')}${flexible ? '' : '<td></td>'}</tr>`;
  return '<div data-list-skeleton aria-hidden="true"><div data-list-skeleton-tools><i class="skeleton-sheen"></i></div>' + between
    + `<div data-board-data-table><div class="w-full overflow-x-auto"><table class="bui-table bui-table-sm" style="table-layout:fixed;min-width:${minimum}px">`
    + `<colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${row.repeat(6)}</tbody></table></div></div></div>`;
}

/** 馆藏与资料页按当前列表偏好使用同一份作品等待态。 */
export function catalogContentSkeletonHtml(label: string, cardRatio: number): string {
  if (catalogView() === 'list') return catalogListSkeletonHtml(label);
  return skeletonHtml(label, { variant: 'cards', className: 'catalog-skeleton postercard-skeleton', cardRatio });
}
