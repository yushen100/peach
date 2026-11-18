import { useRef, useState } from 'react';
import { getLocalTimeZone, parseDate, today } from '@internationalized/date';
import { RiCalendarLine, RiCloseLine } from '@remixicon/react';
import { UNSAFE_PortalProvider } from 'react-aria';
import { Button as AriaButton, Calendar, CalendarMonthPicker, Dialog, Popover } from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { ChevronLeft16, ChevronRight16, MonthPanel, popoverClassName } from '@/components/base/date-picker/shared';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '@/components/base/select/select';
import { t } from '../../i18n';

function selectedDate(value: string) {
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return null;
  const iso = value.replaceAll('/', '-');
  try {
    const date = parseDate(iso);
    return date.toString() === iso ? date : null;
  } catch { return null }
}

function CalendarSelect({ label, value, items, renderValue, onChange }: {
  label: string;
  value: string | number;
  items: { id: number; formatted: string }[];
  renderValue?: string;
  onChange(value: number): void;
}) {
  return <Select aria-label={label} size="sm" selectedKey={value} renderValue={renderValue} isDisabled={!items.length} popoverClassName="w-36"
    onSelectionChange={key => { if (key !== null) onChange(Number(key)) }}>
    {items.map(item => <SelectItem key={item.id} id={item.id}>{item.formatted}</SelectItem>)}
  </Select>;
}

function DateCalendar({ label, value, years, latest, close, onChange }: {
  label: string;
  value: string;
  years: readonly number[];
  latest: string;
  close(): void;
  onChange(value: string): void;
}) {
  const [draft, setDraft] = useState(() => value.replaceAll('-', '/'));
  const chosen = selectedDate(draft);
  const [focused, setFocused] = useState(() => chosen ?? selectedDate(latest.replaceAll('-', '/')) ?? today(getLocalTimeZone()));
  const yearText = (year: number) => t('catalog:rangeFilter.yearOption', { year });
  const calendarDialog = useRef<HTMLElement>(null);
  const apply = () => {
    if (!chosen) return;
    onChange(chosen.toString());
    close();
  };
  return <Dialog ref={calendarDialog} aria-label={label} className="outline-none" data-copy-interact="">
    <Calendar aria-label={label} value={chosen} focusedValue={focused} onFocusChange={setFocused}
      onChange={next => setDraft(next.toString().replaceAll('-', '/'))}>
      <div className="flex flex-col gap-2 p-2">
        <div className="flex items-center justify-between gap-2 px-2">
          <AriaButton slot="previous" className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            <ChevronLeft16 />
          </AriaButton>
          <div className="flex min-w-0 items-center gap-1.5">
            <UNSAFE_PortalProvider getContainer={() => calendarDialog.current}>
              <CalendarSelect label={t('catalog:rangeFilter.year')} value={focused.year} renderValue={yearText(focused.year)}
                items={years.map(year => ({ id: year, formatted: yearText(year) }))}
                onChange={year => setFocused(current => current.set({ year }))} />
              <CalendarMonthPicker format="long">{props => (
                <CalendarSelect label={props['aria-label']} value={props.value} items={props.items} onChange={props.onChange} />
              )}</CalendarMonthPicker>
            </UNSAFE_PortalProvider>
          </div>
          <AriaButton slot="next" className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            <ChevronRight16 />
          </AriaButton>
        </div>
        <MonthPanel offset={0} hideHeader />
        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <div className="w-32 min-w-0">
            <Input size="small" aria-label={t('catalog:rangeFilter.date')} placeholder="YYYY/MM/DD" dir="ltr"
              value={draft} onChange={text => {
                setDraft(text);
                const date = selectedDate(text);
                if (date) setFocused(date);
              }} onKeyDown={event => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  apply();
                }
              }} />
          </div>
          <div className="flex gap-2">
            <Button size="small" type="button" variant="secondary" onClick={close}>{t('shell:shared.cancel')}</Button>
            <Button size="small" type="button" onClick={apply} disabled={!chosen}>{t('catalog:rangeFilter.chooseDate')}</Button>
          </div>
        </div>
      </div>
    </Calendar>
  </Dialog>;
}

export function TableDateBound({ label, value, years, latest, loading, onChange }: {
  label: string;
  value: string;
  years: readonly number[];
  latest: string;
  loading: boolean;
  onChange(value: string): void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const displayed = value.replaceAll('-', '/');
  return <div className="flex min-w-0 flex-col gap-1">
    <span className="text-body-medium text-text-primary">{label}</span>
    <div className="flex min-w-0 items-center gap-1">
      <Button ref={trigger} type="button" size="small" variant="secondary" leadingIcon={RiCalendarLine}
        className="min-w-0 flex-1 justify-start" aria-label={value ? `${label} ${displayed}` : label}
        aria-haspopup="dialog" aria-expanded={open} aria-busy={loading || undefined} disabled={loading}
        onClick={() => setOpen(current => !current)}>
        <span className="truncate tabular-nums">{displayed || t('catalog:rangeFilter.noLimit')}</span>
      </Button>
      {value ? <Button type="button" size="small" variant="ghost" iconOnly leadingIcon={RiCloseLine}
        aria-label={t('catalog:rangeFilter.clearDate', { label })} onClick={() => { onChange(''); trigger.current?.focus() }} /> : null}
    </div>
    <Popover trigger="table-date-bound" triggerRef={trigger} isOpen={open}
      onOpenChange={setOpen} offset={4} placement="bottom end" className={popoverClassName}>
      <DateCalendar label={label} value={value} years={years} latest={latest} close={close} onChange={onChange} />
    </Popover>
  </div>;
}
