import type { ReactNode } from 'react';
import { Select, SelectItem } from './select';

type Choice = readonly [value: string, label: string, icon?: string];

/** 有本机标签的选择字段。值、选项变更和浮层行为由 BoardUI Select 管理。 */
export function SelectField({ id, label, options, value, disabled, busy, hidden, describedBy, epoch, onPick, renderValue }: {
  id: string; label: string; options: readonly Choice[]; value: string; disabled?: boolean; busy?: boolean;
  hidden?: boolean; describedBy?: string; epoch: number; onPick(value: string): void; renderValue?: ReactNode;
}) {
  const selected = options.some(([key]) => key === value) ? value : options[0]?.[0] ?? null;
  return (
    <div id={id} data-choice-field="" className="peach-react" hidden={hidden} aria-busy={busy || undefined}>
      {!hidden ? <Select key={epoch} aria-label={label} aria-describedby={describedBy}
        selectedKey={selected} isDisabled={disabled} renderValue={renderValue}
        className="min-w-0" triggerClassName="h-(--control-h)"
        onSelectionChange={(key) => { if (key !== null) onPick(String(key)) }}>
        {options.map(([key, text, mark]) =>
          <SelectItem key={key} id={key} textValue={text} data-select-option={key}>
            {mark?.startsWith('data:image/png;base64,')
              ? <img className="size-4 shrink-0 object-contain" src={mark} alt="" />
              : mark ? <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><use href={`#i-${mark}`} /></svg> : null}
            {text}
          </SelectItem>)}
      </Select> : null}
    </div>
  );
}
