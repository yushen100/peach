import { useEffect, useRef, useState } from 'react';
import { InputBase, TextField } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import type { SidebarHost, SidebarProps } from './sidebar-api';
import { t } from '../../i18n';

type Range = [number, number | null];
type End = 'min' | 'max';
const minutesOf = (seconds: unknown, fallback: number | null) =>
  seconds ? Number(seconds) / 60 : fallback;
const scaleFor = ([lo, hi]: Range) => Math.max(180, Math.ceil(Math.max(lo, hi ?? 0) / 60) * 60 + 60);

function DurationNumber({ end, value, apply }: { end: End; value: number | null; apply(value: number | null): void }) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(value === null ? '' : String(value)); setInvalid(false) }, [value]);
  const commit = (input: HTMLInputElement) => {
    if (!input.checkValidity()) { setInvalid(true); return }
    const next = draft === '' ? end === 'min' ? 0 : null : Number(draft);
    if (next !== null && !Number.isFinite(next)) { setInvalid(true); return }
    setInvalid(false);
    apply(next);
  };
  return <TextField size="small" value={draft} onChange={value => { setDraft(value); setInvalid(false) }}
    isInvalid={invalid} aria-label={t(`navigation:durationFilter.${end === 'min' ? 'minimum' : 'maximum'}`)}>
    <Label>{t(`navigation:durationFilter.${end === 'min' ? 'minimumLabel' : 'maximumLabel'}`)}</Label>
    <InputBase id={`dur${end === 'min' ? 'Min' : 'Max'}Number`} type="number" inputMode="decimal"
      min={end === 'min' ? 0 : 1 / 60} step="any" placeholder={t('navigation:durationFilter.noLimit')}
      onBlur={event => commit(event.currentTarget)}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); commit(event.currentTarget) }
        if (event.key === 'Escape') { setDraft(value === null ? '' : String(value)); setInvalid(false) }
      }} />
    {invalid ? <span role="alert" className="text-caption-1-regular text-text-error-primary">
      {t('navigation:durationFilter.invalid')}
    </span> : null}
  </TextField>;
}

/** 双滑块按分钟调节，数字输入保留小数分钟，空上限表示不限。 */
export function Duration({ host, filters, commit: onCommit = host.setDuration }: {
  host: SidebarHost; filters: SidebarProps['filters']; commit?: SidebarHost['setDuration'];
}) {
  const source = `${filters.dur_min ?? ''}:${filters.dur_max ?? ''}`;
  const fromFilters = (): Range => [minutesOf(filters.dur_min, 0)!, minutesOf(filters.dur_max, null)];
  const [seen, setSeen] = useState(source);
  const [range, setRange] = useState<Range>(fromFilters);
  const [scaleMax, setScaleMax] = useState(() => scaleFor(range));
  const [active, setActive] = useState<End>('max');
  if (seen !== source) {
    const next = fromFilters();
    setSeen(source);
    setRange(next);
    setScaleMax(scaleFor(next));
  }
  const [lo, hi] = range;
  const minInput = useRef<HTMLInputElement>(null);
  const maxInput = useRef<HTMLInputElement>(null);
  const latest = useRef(range);
  latest.current = range;
  const move = (end: End, value: number | null): Range => {
    let [nextLo, nextHi]: Range = end === 'min' ? [value ?? 0, hi] : [lo, value];
    if (nextHi !== null && nextLo > nextHi) {
      if (end === 'min') nextHi = nextLo;
      else nextLo = nextHi;
    }
    const next: Range = [nextLo, nextHi];
    latest.current = next;
    setActive(end);
    setRange(next);
    return next;
  };
  const applyNumber = (end: End, value: number | null) => {
    const next = move(end, value);
    setScaleMax(scaleFor(next));
    onCommit(...next);
  };
  useEffect(() => {
    const commit = () => onCommit(...latest.current);
    const inputs = [minInput.current, maxInput.current];
    inputs.forEach(input => input?.addEventListener('change', commit));
    return () => inputs.forEach(input => input?.removeEventListener('change', commit));
  }, [onCommit]);

  return <div data-sidebar-duration="">
    <div className="peach-react" data-sidebar-duration-numbers="">
      <DurationNumber end="min" value={lo} apply={value => applyNumber('min', value)} />
      <DurationNumber end="max" value={hi} apply={value => applyNumber('max', value)} />
    </div>
    <div data-sidebar-range="" id="durationRange" style={{ '--lo': `${lo / scaleMax * 100}%`,
      '--hi': `${(hi ?? scaleMax) / scaleMax * 100}%` } as React.CSSProperties}>
      <span data-sidebar-range-base="" /><span data-sidebar-range-fill="" />
      <input id="durMin" type="range" min="0" max={scaleMax} step="1" value={lo}
        aria-label={t('navigation:durationFilter.minimum')} ref={minInput}
        data-active={active === 'min' ? '' : undefined}
        onChange={event => move('min', Number(event.currentTarget.value))} />
      <input id="durMax" type="range" min="0" max={scaleMax} step="1" value={hi ?? scaleMax}
        aria-label={t('navigation:durationFilter.maximum')} ref={maxInput}
        aria-valuetext={hi === null ? t('navigation:durationFilter.noLimit') : t('navigation:durationFilter.minutes', { count: hi })}
        data-active={active === 'max' ? '' : undefined}
        onChange={event => move('max', Number(event.currentTarget.value) >= scaleMax ? null : Math.max(1 / 60, Number(event.currentTarget.value)))} />
    </div>
  </div>;
}
