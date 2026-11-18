export type ColumnFilterKey = 'people' | 'library' | 'studio' | 'tags' | 'rating' | 'resolution';
export type ColumnSelection = string[] | { exclude: string[] };
export const columnRangeKinds = {
  size: 'size', dur: 'duration', plays: 'count', o: 'count', release: 'date', new: 'timestamp', played: 'timestamp', score: 'score',
} as const;
export type ColumnRangeKey = keyof typeof columnRangeKinds;
export type RangeKind = typeof columnRangeKinds[ColumnRangeKey];
export type RangeScalar = string | number;
export interface RangeBounds { min?: RangeScalar; max?: RangeScalar }
export interface ColumnRange { range: RangeBounds }
export type ColumnFilterValue = ColumnSelection | ColumnRange;
export type ColumnFilters = Partial<Record<ColumnFilterKey, ColumnSelection> & Record<ColumnRangeKey, ColumnRange>>;

export function isColumnRange(value: ColumnFilterValue | undefined): value is ColumnRange {
  return !!value && !Array.isArray(value) && 'range' in value;
}

export function isColumnRangeKey(key: string): key is ColumnRangeKey {
  return Object.hasOwn(columnRangeKinds, key);
}

function validBound(kind: RangeKind, value: unknown): value is RangeScalar {
  if (kind === 'date') return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER
    && (kind === 'timestamp' || value >= 0);
}

export function validRange(kind: RangeKind, range: RangeBounds): boolean {
  const { min, max } = range;
  if (min === undefined && max === undefined) return false;
  if ((min !== undefined && !validBound(kind, min)) || (max !== undefined && !validBound(kind, max))) return false;
  return min === undefined || max === undefined || (kind === 'timestamp' ? min < max : min <= max);
}

// 时间上限是下一个本地自然日的起点，其他量使用闭区间。
export function withinColumnRange(kind: RangeKind, { min, max }: RangeBounds, value: RangeScalar | undefined | null): boolean {
  return validBound(kind, value) && (min === undefined || value >= min)
    && (max === undefined || (kind === 'timestamp' ? value < max : value <= max));
}

export function columnValueSelected(selection: ColumnSelection | undefined, value: string): boolean {
  return selection === undefined || (Array.isArray(selection) ? selection.includes(value) : !selection.exclude.includes(value));
}

export function toggleColumnValue(selection: ColumnSelection | undefined, value: string, on: boolean): ColumnSelection | undefined {
  if (Array.isArray(selection)) return on ? [...new Set([...selection, value])] : selection.filter(item => item !== value);
  const excluded = selection?.exclude || [];
  const next = on ? excluded.filter(item => item !== value) : [...new Set([...excluded, value])];
  return next.length ? { exclude: next } : undefined;
}

export function mapColumnSelection(selection: ColumnSelection | undefined, map: (value: string) => string): ColumnSelection | undefined {
  if (selection === undefined) return undefined;
  return Array.isArray(selection) ? selection.map(map) : { exclude: selection.exclude.map(map) };
}

/** 地址与表格状态共用列多选形状，未通过校验的地址仍由接口报告错误。 */
export function readColumnFilters(raw: string | undefined): ColumnFilters {
  try {
    const value = JSON.parse(raw || '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, selection]) => {
      if (isColumnRangeKey(key)) {
        const range = selection?.range;
        return range && typeof range === 'object' && validRange(columnRangeKinds[key], range);
      }
      const values = Array.isArray(selection) ? selection : selection && typeof selection === 'object' ? selection.exclude : null;
      return ['people', 'library', 'studio', 'tags', 'rating', 'resolution'].includes(key) && Array.isArray(values)
        && values.every(value => typeof value === 'string' && value.trim());
    }));
  } catch { return {} }
}

export function writeColumnFilters<K extends keyof ColumnFilters>(current: ColumnFilters, column: K, values: ColumnFilters[K]): string {
  const next = { ...current, [column]: values };
  const selected = Object.fromEntries(Object.entries(next).filter(([, values]) => values !== undefined));
  return Object.keys(selected).length ? JSON.stringify(selected) : '';
}
