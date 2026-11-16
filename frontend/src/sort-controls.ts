/** 筛选浮窗按内容类型保存排序项顺序与隐藏项，新排序项追加到末尾。 */
export const SORT_CONTROL_KEYS = {
  catalog: ['rating', 'o', 'plays', 'dur', 'size', 'new', 'played', 'release'],
  jav: ['release', 'rating', 'o', 'plays', 'dur', 'size', 'new', 'played'],
  follow: ['new', 'hot', 'dur'],
  releases: ['release_date', 'source_score', 'duration', 'code', 'taste'],
  discover: ['taste', 'release_date', 'source_score', 'duration', 'code'],
} as const;

export type SortControlGroup = keyof typeof SORT_CONTROL_KEYS;
export interface SortControlPreference { order: string[]; hidden: string[] }
export type SortControls = Partial<Record<SortControlGroup, SortControlPreference>>;

export function normalizeSortControl(group: SortControlGroup, value: unknown): SortControlPreference {
  const defaults: readonly string[] = SORT_CONTROL_KEYS[group];
  const saved = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<SortControlPreference> : {};
  const keys = (raw: unknown): string[] => Array.isArray(raw)
    ? [...new Set(raw.filter((key): key is string => typeof key === 'string' && defaults.includes(key)))] : [];
  return { order: [...new Set([...keys(saved.order), ...defaults])], hidden: keys(saved.hidden) };
}

export function normalizeSortControls(value: unknown): SortControls {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const saved = value as Record<string, unknown>;
  return Object.fromEntries((Object.keys(SORT_CONTROL_KEYS) as SortControlGroup[])
    .filter(group => Object.hasOwn(saved, group)).map(group => [group, normalizeSortControl(group, saved[group])]));
}

export function visibleSortControls<T extends { key: string }>(items: readonly T[], preference: SortControlPreference): T[] {
  return preference.order.flatMap(key => preference.hidden.includes(key) ? [] : items.filter(item => item.key === key));
}
