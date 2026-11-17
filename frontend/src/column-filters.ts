export type ColumnFilterKey = 'people' | 'library' | 'studio' | 'tags' | 'rating' | 'resolution';
export type ColumnSelection = string[] | { exclude: string[] };
export type ColumnFilters = Partial<Record<ColumnFilterKey, ColumnSelection>>;

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
      const values = Array.isArray(selection) ? selection : selection && typeof selection === 'object' ? selection.exclude : null;
      return ['people', 'library', 'studio', 'tags', 'rating', 'resolution'].includes(key) && Array.isArray(values)
        && values.every(value => typeof value === 'string' && value.trim());
    }));
  } catch { return {} }
}

export function writeColumnFilters(current: ColumnFilters, column: ColumnFilterKey, values: ColumnSelection | undefined): string {
  const next = { ...current, [column]: values };
  const selected = Object.fromEntries(Object.entries(next).filter(([, values]) => values !== undefined));
  return Object.keys(selected).length ? JSON.stringify(selected) : '';
}
