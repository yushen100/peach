import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { RangeSlider } from '@/components/base/slider/slider';
import { type ColumnRange, type RangeBounds, type RangeKind, type RangeScalar, validRange } from '../../column-filters';
import { t } from '../../i18n';
import { MenuDialog } from './menu-dialog';
import { ColumnFilterPopover } from './table-column-filter';
import { TableDateBound } from './table-date-bound';

const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
type SizeUnit = 'MiB' | 'GiB';
const unitBytes = { MiB, GiB };
const sliderScales = {
  duration: { step: 60, initialMax: 180 * 60, extension: 60 * 60 },
  size: { step: MiB, initialMax: 10 * GiB, extension: 5 * GiB },
  count: { step: 1, initialMax: 10, extension: 1 },
  score: { step: 0.1, initialMax: 5, extension: 0 },
};

function extendSlider(maximum: number, bound: number, extension: number): number {
  return bound < maximum ? maximum : (Math.floor(bound / extension) + 1) * extension;
}

function dateText(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayBound(text: string, through: boolean): number {
  const day = new Date(`${text}T00:00:00`);
  if (through) day.setDate(day.getDate() + 1);
  return day.getTime() / 1000;
}

/** 按界面显示的本地日期筛选 UTC 时刻，含结束日期的整天。 */
function asBound(kind: RangeKind, input: string, through: boolean, unit: SizeUnit): RangeScalar | undefined {
  const text = input.trim().normalize('NFKC');
  if (!text) return undefined;
  if (kind === 'date') return text;
  if (kind === 'timestamp') return dayBound(text, through);
  if (!/^\d+(?:[.,]\d*)?$|^[.,]\d+$/.test(text)) return NaN;
  const value = Number(text.replace(',', '.'));
  if (kind === 'size') return value * unitBytes[unit];
  if (kind === 'duration') return value * 60;
  return kind === 'count' && !Number.isInteger(value) ? NaN : value;
}

function inputText(kind: RangeKind, value: RangeScalar | undefined, through: boolean, unit: SizeUnit): string {
  if (value === undefined) return '';
  if (kind === 'timestamp') return dateText(new Date((Number(value) - Number(through)) * 1000));
  if (kind === 'size') return String(Number(value) / unitBytes[unit]);
  if (kind === 'duration') return String(Number(value) / 60);
  return String(value);
}

function sizeUnitForRange(range?: RangeBounds): SizeUnit {
  return Object.values(range ?? {}).some(bound => Number(bound) >= GiB) ? 'GiB' : 'MiB';
}

export function columnRangeSummary(kind: RangeKind, range: RangeBounds): string {
  const unit = sizeUnitForRange(range);
  const start = inputText(kind, range.min, false, unit);
  const end = inputText(kind, range.max, true, unit);
  const text = start && end ? (start === end ? start : `${start}–${end}`) : start ? `≥ ${start}` : `≤ ${end}`;
  if (kind === 'date' || kind === 'timestamp') return text.replaceAll('-', '/');
  const suffix = kind === 'size' ? unit : kind === 'duration' ? t('catalog:rangeFilter.minutesUnit') : '';
  return suffix ? `${text} ${suffix}` : text;
}

function presets(kind: RangeKind): { label: string; range: RangeBounds }[] {
  if (kind === 'date' || kind === 'timestamp') {
    const today = new Date();
    const end = dateText(today);
    const range = (start: Date) => ({
      min: asBound(kind, dateText(start), false, 'MiB'), max: asBound(kind, end, true, 'MiB'),
    });
    return [
      ...[7, 30, 90].map(days => {
        const start = new Date(today);
        start.setDate(start.getDate() - days + 1);
        return { label: t('catalog:rangeFilter.lastDays', { count: days }), range: range(start) };
      }),
      { label: t('catalog:rangeFilter.thisYear'), range: range(new Date(today.getFullYear(), 0, 1)) },
    ];
  }
  if (kind === 'size') return [
    { label: t('catalog:rangeFilter.atMost', { value: '100 MiB' }), range: { max: 100 * MiB } },
    { label: '100 MiB – 1 GiB', range: { min: 100 * MiB, max: GiB } },
    { label: '1–5 GiB', range: { min: GiB, max: 5 * GiB } },
    { label: t('catalog:rangeFilter.atLeast', { value: '5 GiB' }), range: { min: 5 * GiB } },
  ];
  if (kind === 'duration') return [
    { label: t('catalog:rangeFilter.atMost', { value: t('catalog:rangeFilter.minutes', { count: 10 }) }), range: { max: 600 } },
    { label: t('catalog:rangeFilter.minuteSpan', { min: 10, max: 30 }), range: { min: 600, max: 1800 } },
    { label: t('catalog:rangeFilter.minuteSpan', { min: 30, max: 60 }), range: { min: 1800, max: 3600 } },
    { label: t('catalog:rangeFilter.atLeast', { value: t('catalog:rangeFilter.minutes', { count: 60 }) }), range: { min: 3600 } },
  ];
  return [];
}

interface RangeFilterProps {
  id: string;
  label: string;
  kind: RangeKind;
  value?: ColumnRange;
  rangeValues?: readonly RangeScalar[];
  rangeQuery?: { key: readonly unknown[]; load(signal: AbortSignal): Promise<readonly RangeScalar[]> };
  onChange(value: ColumnRange | undefined): void;
}

export function TableColumnRange(props: RangeFilterProps) {
  const dates = props.kind === 'date' || props.kind === 'timestamp';
  return <ColumnFilterPopover id={props.id} label={props.label} active={!!props.value}
    shouldCloseOnInteractOutside={dates ? element => !element.closest('[data-trigger="table-date-bound"]') : undefined}>
    {close => <RangeMenu {...props} onChange={value => { props.onChange(value); close() }} />}
  </ColumnFilterPopover>;
}

function RangeMenu({ label, kind, value, rangeValues, rangeQuery, onChange }: RangeFilterProps) {
  const dates = kind === 'date' || kind === 'timestamp';
  const slider = dates ? undefined : sliderScales[kind];
  const [manualBound, setManualBound] = useState(() => slider?.extension
    ? Math.max(Number(value?.range.min ?? 0), Number(value?.range.max ?? 0))
    : 0);
  const [unit, setUnit] = useState<SizeUnit>(() => sizeUnitForRange(value?.range));
  const [min, setMin] = useState(() => inputText(kind, value?.range.min, false, unit));
  const [max, setMax] = useState(() => inputText(kind, value?.range.max, true, unit));
  const range = { min: asBound(kind, min, false, unit), max: asBound(kind, max, true, unit) };
  const valid = validRange(kind, range);
  const { data, isPending } = useQuery({
    queryKey: rangeQuery?.key ?? ['table-column-range-values'], enabled: !!rangeQuery,
    queryFn: ({ signal }) => rangeQuery!.load(signal), staleTime: 30_000,
  });
  const values = data ?? rangeValues;
  const loadingScale = !!rangeQuery && isPending;
  const years = new Set<number>();
  let latest = '';
  let largestCount = 0;
  for (const entry of values ?? []) {
    if (dates) {
      const day = typeof entry === 'number' ? new Date(entry * 1000) : undefined;
      const iso = day && !Number.isNaN(day.getTime()) ? dateText(day) : typeof entry === 'string' ? entry : '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && +iso.slice(0, 4) > 0) {
        years.add(+iso.slice(0, 4));
        if (iso > latest) latest = iso;
      }
    } else if (kind === 'count' && typeof entry === 'number' && Number.isSafeInteger(entry)) {
      largestCount = Math.max(largestCount, entry);
    }
  }
  const availableYears = [...years].sort((left, right) => left - right);
  const choices = presets(kind);
  const units = kind === 'size' ? unit : kind === 'duration' ? t('catalog:rangeFilter.minutesUnit') : '';
  const minLabel = t(dates ? 'catalog:rangeFilter.start' : units ? 'catalog:rangeFilter.minWithUnit' : 'catalog:rangeFilter.min', { unit: units });
  const maxLabel = t(dates ? 'catalog:rangeFilter.end' : units ? 'catalog:rangeFilter.maxWithUnit' : 'catalog:rangeFilter.max', { unit: units });
  const noLimit = t('catalog:rangeFilter.noLimit');
  const sliderUnit = kind === 'size' ? unitBytes[unit] : kind === 'duration' ? 60 : 1;
  // 计数轨末端额外留一格表示「不限」，仍然可以选中实际最大值。
  const baseMaximum = kind === 'count' && values ? largestCount + 1 : slider?.initialMax ?? 0;
  const sliderMaximum = slider?.extension ? extendSlider(baseMaximum, manualBound, slider.extension) : baseMaximum;
  const sliderEnd = sliderMaximum / sliderUnit;
  const position = (bound: RangeScalar | undefined, fallback: number) =>
    typeof bound === 'number' && Number.isFinite(bound) && bound >= 0 ? Math.min(bound, sliderMaximum) / sliderUnit : fallback;
  const lower = position(range.min, 0);
  const upper = Math.max(lower, position(range.max, sliderEnd));
  const changeBound = (text: string, upperBound: boolean) => {
    (upperBound ? setMax : setMin)(text);
    if (!slider?.extension) return;
    const bound = asBound(kind, text, upperBound, unit);
    if (typeof bound === 'number' && validRange(kind, { min: bound })) {
      setManualBound(current => Math.max(current, bound));
    }
  };
  const chooseUnit = (next: SizeUnit) => {
    if (Number.isFinite(range.min)) setMin(inputText(kind, range.min, false, next));
    if (Number.isFinite(range.max)) setMax(inputText(kind, range.max, true, next));
    setUnit(next);
  };
  return <MenuDialog aria-label={t('catalog:columnFilter.label', { column: label })} className="max-h-80 overflow-y-auto outline-none">
    <form className="flex flex-col gap-3 p-3" noValidate data-copy-interact=""
      onSubmit={event => { event.preventDefault(); if (valid) onChange({ range }) }}>
      {choices.length ? <div className="inline-grid grid-cols-2 gap-1.5" role="group" aria-label={t('catalog:rangeFilter.presets')}>
        {choices.map(preset => {
          const active = preset.range.min === value?.range.min && preset.range.max === value?.range.max;
          return <Button key={preset.label} type="button" size="small" variant={active ? 'primary' : 'secondary'}
            aria-pressed={active} onClick={() => onChange({ range: preset.range })}>{preset.label}</Button>;
        })}
      </div> : null}
      {kind === 'size' ? <div className="flex gap-1.5" role="group" aria-label={t('catalog:rangeFilter.sizeUnit')}>
        {(['MiB', 'GiB'] as const).map(choice => <Button key={choice} type="button" size="small"
          variant={choice === unit ? 'primary' : 'secondary'} aria-pressed={choice === unit}
          onClick={() => chooseUnit(choice)}>{choice}</Button>)}
      </div> : null}
      {slider ? <div className="px-2.5">
        <RangeSlider aria-label={label} thumbLabels={[minLabel, maxLabel]} showTooltip={false}
          minValue={0} maxValue={sliderEnd} step={slider.step / sliderUnit} value={[lower, upper]} isDisabled={loadingScale}
          onChange={([nextMin, nextMax]) => {
            if (nextMin !== lower) setMin(nextMin === 0 ? '' : String(nextMin));
            if (nextMax !== upper) setMax(kind !== 'score' && nextMax === sliderEnd ? '' : String(nextMax));
          }} />
        <div aria-hidden="true" className="flex justify-between text-caption-1-regular text-text-secondary tabular-nums">
          <span>0</span>
          {kind !== 'count' || sliderEnd > 1 ? <span>{kind === 'count' ? Math.floor(sliderEnd / 2) : sliderEnd / 2}</span> : null}
          <span>{kind === 'score' ? sliderEnd : noLimit}</span>
        </div>
      </div> : null}
      <div className="inline-grid grid-cols-2 gap-2">
        {dates ? <>
          <TableDateBound label={minLabel} value={min} years={availableYears} latest={latest} loading={loadingScale} onChange={setMin} />
          <TableDateBound label={maxLabel} value={max} years={availableYears} latest={latest} loading={loadingScale} onChange={setMax} />
        </> : <>
        <Input size="small" className="min-w-0" inputClassName="min-w-0"
          inputMode={kind === 'count' ? 'numeric' : 'decimal'}
          label={minLabel} placeholder={slider ? noLimit : undefined}
          value={min} onChange={text => changeBound(text, false)} />
        <Input size="small" className="min-w-0" inputClassName="min-w-0"
          inputMode={kind === 'count' ? 'numeric' : 'decimal'}
          label={maxLabel} placeholder={slider ? noLimit : undefined}
          value={max} onChange={text => changeBound(text, true)} />
        </>}
      </div>
      {(min || max) && !valid ? <span role="status" className="text-caption-1-regular text-text-error-primary">{t('catalog:rangeFilter.invalid')}</span> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="small" disabled={!value} onClick={() => onChange(undefined)}>{t('catalog:rangeFilter.clear')}</Button>
        <Button type="submit" variant="primary" size="small" disabled={!valid}>{t('catalog:rangeFilter.apply')}</Button>
      </div>
    </form>
  </MenuDialog>;
}
