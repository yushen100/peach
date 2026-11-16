import { useEffect, useState } from 'react';
import { ComboBox, ListBox, Popover } from 'react-aria-components';
import { useQuery } from '@tanstack/react-query';
import { RiSearchLine } from '@remixicon/react';
import { InputBase } from '@/components/base/input/input';
import { SelectItem } from '@/components/base/select/select';
import { Button } from '@/components/base/buttons/button';
import { MENU_ITEMS_CONTAINER, MENU_POPOVER_SURFACE } from '@/components/base/dropdown/menu-styles';
import { cx } from '@/utils/cx';
import { spinnerHtml } from '@peach/legacy/ui';
import { apiGet } from '../../api';
import { t } from '../../i18n';
import { Note } from '../components/note';
import type { ManagedTag } from './tag-operations';

function TagLoadingIcon({ className }: { className?: string }) {
  return <span className={cx(className, 'flex items-center justify-center')}
    dangerouslySetInnerHTML={{ __html: spinnerHtml(t('shell:tagPicker.loading')) }} />;
}

/** 按现有在线词表补全名称与别名，选择候选只填写名称。 */
export function TagNameInput({ value, onChange }: { value: string; onChange(value: string): void }) {
  const [term, setTerm] = useState('');
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    if (composing || !value.trim()) { setTerm(''); return }
    const timer = setTimeout(() => setTerm(value.trim()), 250);
    return () => clearTimeout(timer);
  }, [value, composing]);
  const current = !!term && term === value.trim() && !composing;
  const suggestions = useQuery({
    queryKey: ['tag-management', 'online', 'suggest', term],
    queryFn: ({ signal }) => apiGet<{ items: ManagedTag[] }>(
      `/api/tag-management?${new URLSearchParams({ scope: 'online', q: term, limit: '8' })}`, signal),
    enabled: current,
  });
  const options = current ? suggestions.data?.items ?? [] : [];
  const busy = current && suggestions.isFetching;
  return <>
    <ComboBox aria-label={t('catalog:tagOperations.tagName')} className="w-full"
      allowsCustomValue allowsEmptyCollection={!!value.trim() && !composing && suggestions.isPending}
      inputValue={value} onInputChange={onChange} items={options}>
      <InputBase autoFocus maxLength={80} leadingIcon={busy ? TagLoadingIcon : RiSearchLine}
        placeholder={t('shell:tagPicker.searchPlaceholder')}
        onKeyDownCapture={event => {
          if (event.key === 'Escape' && event.currentTarget.getAttribute('aria-expanded') === 'true') event.preventDefault();
        }}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} />
      <Popover isNonModal placement="bottom start" offset={4}
        className={cx(MENU_POPOVER_SURFACE, 'flex w-(--trigger-width) flex-col overflow-hidden p-0')}>
        <ListBox aria-label={t('shell:tagPicker.results')} className={cx(MENU_ITEMS_CONTAINER, 'min-h-0 max-h-65 overflow-auto overscroll-contain p-2.5 pe-4')}
          renderEmptyState={() => <span className="px-2 py-1.5 text-body-2-regular text-text-tertiary">
            {current && !suggestions.isPending ? t('catalog:tagManager.noMatches') : t('shell:tagPicker.loading')}
          </span>}>
          {(tag: ManagedTag) => <SelectItem id={tag.k} textValue={tag.k}>
            <span className="min-w-0 grow truncate">{tag.k}</span>
            <span className="shrink-0 text-caption-1-regular tabular-nums text-text-tertiary">{tag.n.toLocaleString()}</span>
          </SelectItem>}
        </ListBox>
      </Popover>
    </ComboBox>
    {current && suggestions.isError ? <Note tone="error" action={<Button variant="secondary" onClick={() => void suggestions.refetch()}>{t('shell:shared.retryNow')}</Button>}>
      {t('shell:detailTags.optionsLoadFailed')}
    </Note> : null}
  </>;
}
