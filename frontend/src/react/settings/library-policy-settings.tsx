/* 媒体库一级的来源色与处理方式，由「媒体库与目录」按媒体库分组时放在每个媒体库的标题行里，
 * 随「保存配置」写进 `media.library_catalog`（ADR-0116）。三档处理方式的说明在分组上方只写一次；
 * 只有选了「自定义」的媒体库才展开五个步骤。来源色默认不上色，点开色球选一档强调色。 */
import { useRef, useState } from 'react';
import { Dialog, Popover, VisuallyHidden } from 'react-aria-components';
import { UNSAFE_PortalProvider } from 'react-aria';

import { Checkbox } from '@/components/base/checkbox/checkbox';
import { MENU_POPOVER_SURFACE } from '@/components/base/dropdown/menu-styles';
import { Select, SelectItem } from '../components/select';
import { ACCENTS as ACCENT_CHOICES } from '../../appearance/home-glow';
import { previewLibraryColor } from '../components/library-tint';
import { overlayHost } from '../components/overlay-host';
import { Disclosure, Help } from './section';
import { POLICY_COLUMNS, POLICY_COVER_NOTE, POLICY_MATRIX, POLICY_SUMMARY } from './library-policy-copy';
import { t } from '../../i18n';
import '../components/glow-preset-grid.css';
import './library-policy-settings.css';

export type Preset = 'auto' | 'local' | 'custom';
export const STAGES = [
  ['probe', t('settings:libraryPolicy.stepProbe')],
  ['metadata', t('settings:libraryPolicy.stepMetadata')],
  ['cover', t('settings:libraryPolicy.stepCovers')],
  ['people', t('settings:libraryPolicy.stepAvatars')],
  ['preview', t('settings:libraryPolicy.stepContactSheet')],
] as const;
export type Stage = (typeof STAGES)[number][0];
export const AUTO_STAGES: readonly Stage[] = ['probe', 'metadata', 'cover', 'people', 'preview'];
const PRESETS: readonly (readonly [Preset, string, string])[] = [
  ['auto', t('settings:libraryPolicy.auto'), t('settings:libraryPolicy.autoHint')],
  ['local', t('settings:libraryPolicy.localOnly'), t('settings:libraryPolicy.localHint')],
  ['custom', t('settings:shared.custom'), t('settings:libraryPolicy.customHint')],
];

/** 三档处理方式的说明，分组上方只放一份：常显一句话，三档的差别收在可展开的对比表里。 */
export function PolicyLegend() {
  return (
    <div data-policy-legend="" className="flex flex-col gap-1">
      <Help>{POLICY_SUMMARY}</Help>
      <Disclosure summary={t('settings:libraryPolicy.compare')}>
        <table data-policy-matrix="" className="text-body-2-regular">
          <thead><tr><th scope="col"><VisuallyHidden>{t('settings:libraryPolicy.step')}</VisuallyHidden></th>
            {POLICY_COLUMNS.map(name => <th key={name} scope="col">{name}</th>)}</tr></thead>
          <tbody>{POLICY_MATRIX.map(([step, ...cells]) => <tr key={step}><th scope="row">{step}</th>
            {cells.map((cell, index) => <td key={POLICY_COLUMNS[index]} data-policy-cell={cell === '✓' ? 'on' : cell === '—' ? 'off' : 'choice'}>
              {cell === '✓' ? <span aria-label={t('settings:libraryPolicy.included')}>✓</span> : cell === '—' ? <span aria-label={t('settings:libraryPolicy.notIncluded')}>—</span> : cell}</td>)}</tr>)}</tbody>
        </table>
        <Help>{POLICY_COVER_NOTE}</Help>
      </Disclosure>
    </div>
  );
}

/** 标题行里的处理方式下拉：弹层顶部写明在选什么，每档带一句话；收起时只显示档名。 */
export function PresetSelect({ name, value, onChange }: { name: string; value: Preset; onChange(value: Preset): void }) {
  return (
    <Select data-guide-target="library-policy" className="w-full" aria-label={t('settings:libraryPolicy.modeLabel', { name })} selectedKey={value} prefix={t('settings:libraryPolicy.mode')}
      renderValue={<span className="truncate">{PRESETS.find(([key]) => key === value)?.[1]}</span>}
      onSelectionChange={key => onChange(String(key) as Preset)}>
      {PRESETS.map(([key, label, hint]) => (
        <SelectItem key={key} id={key} textValue={label}>
          <span className="flex min-w-0 flex-col">
            <span>{label}</span>
            <span className="text-body-2-regular text-text-secondary whitespace-normal">{hint}</span>
          </span>
        </SelectItem>
      ))}
    </Select>
  );
}

/** `previewsOff`：「视频预览」卡关掉了预览生成，服务端跳过九宫格这一步，这一格变灰并说明。勾选值照旧保留，打开预览后按原样生效。 */
export function StageChooser({ name, value, onChange, previewsOff = false }: {
  name: string; value: readonly Stage[]; onChange(value: readonly Stage[]): void; previewsOff?: boolean;
}) {
  return (
    <Disclosure defaultOpen summary={t('settings:libraryPolicy.stepsSummary', { name, selected: value.length, total: STAGES.length })}>
      <div className="flex flex-wrap gap-x-6 gap-y-2" role="group" aria-label={t('settings:libraryPolicy.stepsLabel', { name })}>
        {STAGES.map(([key, label]) => (
          <Checkbox key={key} isSelected={value.includes(key)} isDisabled={previewsOff && key === 'preview'}
            onChange={(on) => onChange(on ? [...value, key] : value.filter(stage => stage !== key))}>
            {label}
          </Checkbox>
        ))}
      </div>
      {previewsOff ? <Help>{t('settings:libraryPolicy.previewsOff')}</Help> : null}
    </Disclosure>
  );
}

/** 一颗显示当前来源色的球；点开是「无颜色」加十二档强调色。 */
export function LibraryColorPicker({ id, name, value: color, onChange }: {
  id: string; name: string; value: string; onChange(color: string): void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const label = ACCENT_CHOICES.find(([key]) => key === color)?.[1] || t('settings:libraryColor.none');
  const choose = (next: string) => { onChange(next); previewLibraryColor(id, next); setOpen(false) };
  return <>
    <button ref={trigger} type="button" className="text-body-medium" data-glow-chip="" data-library-color-trigger="" aria-haspopup="dialog"
      aria-expanded={open} aria-label={t('settings:libraryColor.triggerLabel', { name: name || t('settings:mediaLibraries.untitled'), color: label })} title={label} onClick={() => setOpen(true)}>
      <span aria-hidden className="text-text-tertiary">{t('settings:libraryColor.label')}</span>
      {color
        ? <span data-glow-ball="" aria-hidden="true" data-accent-ball={color} />
        : <span data-glow-ball="" data-library-none="" aria-hidden="true" />}
      <span>{label}</span>
    </button>
    <UNSAFE_PortalProvider getContainer={() => overlayHost(trigger.current)}>
      <Popover triggerRef={trigger} isOpen={open} onOpenChange={setOpen} placement="bottom start" offset={8}
        containerPadding={12} className={MENU_POPOVER_SURFACE}>
        <Dialog aria-label={t('settings:libraryColor.dialogLabel', { name: name || t('settings:mediaLibraries.untitled') })} className="outline-none">
          <p className="px-1 pb-2 text-body-medium text-text-primary">{t('settings:libraryColor.choose')}</p>
          <div data-accent-grid="" data-library-colors="" role="group">
            <button type="button" data-glow-chip="" aria-pressed={!color} title={t('settings:libraryColor.none')} aria-label={t('settings:libraryColor.none')}
              onClick={() => choose('')}>
              <span data-glow-ball="" data-library-none="" aria-hidden="true" />
            </button>
            {ACCENT_CHOICES.map(([key, choice]) => (
              <button type="button" key={key} data-glow-chip="" aria-pressed={key === color} title={choice} aria-label={choice}
                onClick={() => choose(key)}>
                <span data-glow-ball="" aria-hidden="true" data-accent-ball={key} />
              </button>
            ))}
          </div>
        </Dialog>
      </Popover>
    </UNSAFE_PortalProvider>
  </>;
}
