/* 带单位、可选开关与字段错误反馈的数值设置。
 *
 * 可选的那几项（悬停放大、相关推荐、搜索记录、关注自动更新）前面有一枚开关：关掉就是 0，
 * 数字框收起来；再打开时填回关掉前的那个数。那个数记在 `peach.number.<id>`，跟着这台浏览器走。
 * 提交时机跟原生数字框的 `change` 一致：失焦或回车，打字途中不提交。 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { boundedPreference } from '../../number-setting';
import { HOME_SHORTS_DEFAULT, HOME_SHORTS_MAX, HOME_SHORTS_MIN } from '../../appearance/settings';
import { t } from '../../i18n';

export type NumberUnit = 'items' | 'seconds' | 'videos' | 'entries' | 'minutes' | 'percent';
export interface NumberSpec { min: number; max: number; unit: NumberUnit; optional?: boolean; fallback: number }

/** 数字框后面的单位文字。 */
const UNIT_LABELS: Record<NumberUnit, string> = {
  items: t('settings:numberSetting.unitItems'), seconds: t('settings:numberSetting.unitSeconds'), videos: t('settings:numberSetting.unitVideos'),
  entries: t('settings:numberSetting.unitEntries'), minutes: t('settings:numberSetting.unitMinutes'),
  percent: t('settings:numberSetting.unitPercent'),
};

export const NUMBER_SPECS = {
  batchSizeSetting: { min: 1, max: 200, unit: 'items', fallback: 60 },
  hoverDelaySetting: { min: 1, max: 60, unit: 'seconds', optional: true, fallback: 5 },
  seekSecondsSetting: { min: 1, max: 300, unit: 'seconds', fallback: 10 },
  /* 上下限同 `player/gesture-settings.ts` 的归一化。 */
  swipeMinutesSetting: { min: 1, max: 120, unit: 'minutes', fallback: 20 },
  doubleTapPercentSetting: { min: 15, max: 45, unit: 'percent', fallback: 35 },
  resumeRestartSetting: { min: 1, max: 20, unit: 'percent', optional: true, fallback: 5 },
  relatedLimitSetting: { min: 1, max: 60, unit: 'items', optional: true, fallback: 20 },
  /* 上限跟 `/api/feeds/discoveries` 一致，服务端多于 100 也只回 100 部。 */
  feedLimitSetting: { min: 1, max: 100, unit: 'videos', fallback: 12 },
  searchHistoryLimitSetting: { min: 1, max: 50, unit: 'entries', optional: true, fallback: 10 },
  /* 关掉是 0：首页不插竖屏带，竖屏回主网格。上下限同 `appearance/settings.ts` 的归一化。 */
  homeShortsSetting: { min: HOME_SHORTS_MIN, max: HOME_SHORTS_MAX, unit: 'items', optional: true, fallback: HOME_SHORTS_DEFAULT },
  followScheduleSetting: { min: 15, max: 10080, unit: 'minutes', optional: true, fallback: 60 },
} as const satisfies Record<string, NumberSpec>;

export type NumberSettingId = keyof typeof NUMBER_SPECS;

const storageKey = (id: string) => `peach.number.${id}`;

/** 以分钟计的间隔满一天时，单位旁边再说一遍是几天：「10080 分钟」读不出是一周。
 *  `unit` 是 `NumberUnit`；不满一天、不是整数或不是分钟的读数返回空串。 */
export function dayReading(value: number, unit: string): string {
  if (unit !== 'minutes' || !Number.isInteger(value) || value < 1440) return '';
  const days = value / 1440;
  return Number.isInteger(days) ? t('settings:numberSetting.days', { count: days }) : t('settings:numberSetting.aboutDays', { count: Math.round(days * 10) / 10 });
}

export function NumberSetting({ id, label, value, disabled = false, onApply }: {
  id: NumberSettingId; label: string;
  /** 当前值；null 表示还没取到（关注自动更新那一项），此时整块禁用、不改显示。 */
  value: number | null;
  disabled?: boolean;
  onApply(value: number): void;
}) {
  const spec: NumberSpec = NUMBER_SPECS[id];
  const { min, max, fallback } = spec;
  const unit = UNIT_LABELS[spec.unit];
  const optional = spec.optional === true;
  const remembered = useRef(0);
  if (!remembered.current) {
    remembered.current = boundedPreference(Number(localStorage.getItem(storageKey(id))), min, max,
      value && value > 0 ? value : fallback);
  }
  const [shown, setShown] = useState(value ?? 0);
  const [draft, setDraft] = useState(String(value && value > 0 ? value : remembered.current));
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement | null>(null);
  const apply = useRef(onApply);
  apply.current = onApply;

  /* 外面换了值（数据库对账、另一台设备改过、请求回来）就跟上；null 只禁用，不动显示。 */
  useLayoutEffect(() => {
    if (value === null) return;
    setShown(value);
    if (value > 0) setDraft(String(value));
  }, [value]);

  const commit = () => {
    const node = input.current;
    if (!node) return;
    if (!node.value || !node.checkValidity()) {
      node.setAttribute('aria-invalid', 'true');
      setError(t('settings:numberSetting.rangeError', { min, max, unit }));
      return;
    }
    node.removeAttribute('aria-invalid');
    setError('');
    remembered.current = Number(node.value);
    localStorage.setItem(storageKey(id), String(remembered.current));
    apply.current(remembered.current);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  /* 原生 `change`：React 的 onChange 是每一次按键的 `input`。 */
  useEffect(() => {
    const node = input.current;
    if (!node) return undefined;
    const listener = () => commitRef.current();
    node.addEventListener('change', listener);
    return () => node.removeEventListener('change', listener);
  }, []);

  const on = shown > 0;
  const toggle = () => {
    const node = input.current;
    node?.removeAttribute('aria-invalid');
    setError('');
    if (!on) {
      setShown(remembered.current);
      setDraft(String(remembered.current));
      apply.current(remembered.current);
      return;
    }
    if (node && node.value && node.checkValidity()) remembered.current = Number(node.value);
    localStorage.setItem(storageKey(id), String(remembered.current));
    setShown(0);
    apply.current(0);
  };

  const blocked = disabled || value === null;
  return (
    <div data-number-setting="">
      {optional
        ? <input type="checkbox" data-toggle="" role="switch" aria-label={t('settings:numberSetting.enableToggle', { label })}
            checked={on} disabled={blocked} onChange={toggle} />
        : null}
      <div data-number-fields="" hidden={optional && !on}>
        <div data-number-control="">
          <input ref={input} type="number" inputMode="numeric" className="geist-input" min={min} max={max} step={1}
            value={draft} disabled={blocked} aria-label={label} aria-describedby={`${id}-error`}
            onChange={(event) => {
              setDraft(event.target.value);
              if (event.target.value && event.target.checkValidity()) {
                event.target.removeAttribute('aria-invalid');
                setError('');
              }
            }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} />
          <span aria-hidden="true">{unit}{dayReading(Number(draft), spec.unit) ? ` · ${dayReading(Number(draft), spec.unit)}` : ''}</span>
        </div>
        <small id={`${id}-error`} data-number-error="" role="status" hidden={!error}>{error}</small>
      </div>
    </div>
  );
}
