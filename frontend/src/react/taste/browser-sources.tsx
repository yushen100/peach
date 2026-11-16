import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RiPauseLine, RiPlayLine, RiDeleteBinLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { confirmModal } from '@peach/legacy/ui';
import { errorMessage } from '../../api';
import { cardClass } from '../components/card';
import { BrowserIcon } from '../components/browser-icon';
import { Note } from '../components/note';
import { queryClient } from '../query';
import { busyProps } from '../settings/use-action';
import { configureTasteBrowser, tasteKey, type BrowserSource, type TasteSource } from './taste';
import { t } from '../../i18n';

export const SOURCE_TILE = 'flex min-w-0 items-center gap-3 rounded-xl bg-background-primary-default p-3';

export function BrowserSources({ browsers, sources, range, children }:
  { browsers: BrowserSource[]; sources: TasteSource[]; range: string; children?: ReactNode }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const change = useMutation({
    mutationFn: (body: Parameters<typeof configureTasteBrowser>[0]) => configureTasteBrowser(body, range),
    onSuccess: result => {
      queryClient.setQueryData(tasteKey(range), result.dashboard);
      setAdding(false); setName(''); setPath('');
    },
  });
  return <section className={`${cardClass()} flex flex-col gap-4`} aria-label={t('manage:tasteSources.dataSources')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-title-2-medium text-text-primary">{t('manage:tasteSources.dataSources')}</h3>
      <Button variant="secondary" onClick={() => setAdding(true)} disabled={adding}>{t('manage:tasteSources.addBrowser')}</Button>
    </div>
    {change.error ? <Note tone="error">{errorMessage(change.error)}</Note> : null}
    {adding ? <form className="flex flex-col gap-3" onSubmit={event => {
      event.preventDefault(); if (!change.isPending) change.mutate({ operation: 'add', name, path });
    }}>
      <Input label={t('manage:tasteSources.browserName')} value={name} onChange={setName} maxLength={80} isRequired isDisabled={change.isPending} />
      <Input label={t('manage:tasteSources.profilePath')} value={path} onChange={setPath} maxLength={1024} isRequired isDisabled={change.isPending}
        hint={t('manage:tasteSources.profilePathHint')} />
      <div className="flex gap-2">
        <Button variant="ghost" disabled={change.isPending} onClick={() => { setAdding(false); change.reset() }}>{t('manage:shared.cancel')}</Button>
        <Button type="submit" variant="secondary" disabled={!name.trim() || !path.trim()} {...busyProps(change.isPending)}>{t('manage:shared.add')}</Button>
      </div>
    </form> : null}
    <div className="inline-grid w-full min-w-0 gap-2 sm:grid-cols-2">
      {children}
      {browsers.map(browser => {
        const records = sources.filter(source => browser.source_keys?.includes(source.source_key));
        const visits = records.reduce((total, source) => total + (source.visits || 0), 0);
        const bookmarks = records.reduce((total, source) => total + (source.bookmarks || 0), 0);
        return <div key={browser.id} data-taste-source="browser" className={SOURCE_TILE}>
        <span className="inline-grid size-8 shrink-0 place-items-center rounded-lg text-text-secondary">
          <BrowserIcon name={browser.name} />
        </span>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <b className="text-body-2-medium break-words text-text-primary">{browser.name}</b>
          <span className="break-all text-caption-1-regular text-text-secondary">{browser.path}</span>
          <span className="text-caption-1-regular text-text-secondary">{!browser.enabled ? t('manage:tasteSources.readingStopped') : !browser.available ? t('manage:tasteSources.profileUnavailable') : t('manage:tasteSources.profileCount', { count: browser.profiles })}</span>
          {records.length ? <span className="text-caption-1-regular text-text-secondary">{t('manage:tasteSources.historyCount', { count: visits })} · {t('manage:tasteSources.bookmarkCount', { count: bookmarks })}</span> : null}
        </div>
        <span className="flex shrink-0 gap-1">
        <Button variant="secondary" size="small" {...busyProps(change.isPending)} iconOnly
          leadingIcon={browser.enabled ? RiPauseLine : RiPlayLine}
          aria-label={`${browser.enabled ? t('manage:tasteSources.stopReading') : t('manage:customSources.enable')} ${browser.name}`} onClick={() => {
            if (!browser.enabled) change.mutate({ operation: 'enable', id: browser.id });
            else void confirmModal({ title: t('manage:tasteSources.stopReadingTitle', { browser: browser.name }), body: t('manage:tasteSources.stopReadingBody'), confirmLabel: t('manage:tasteSources.stopReading'),
              onConfirm: () => change.mutateAsync({ operation: 'disable', id: browser.id }) });
          }} />
        <Button variant="secondary" size="small" iconOnly leadingIcon={RiDeleteBinLine} {...busyProps(change.isPending)}
          aria-label={t('manage:tasteSources.deleteBrowserTitle', { browser: browser.name })} onClick={() => {
            void confirmModal({ title: t('manage:tasteSources.deleteBrowserTitle', { browser: browser.name }), body: t('manage:tasteSources.deleteBrowserBody'),
              confirmLabel: t('manage:tasteSources.deleteBrowser'), danger: true, holdToConfirm: true,
              onConfirm: () => change.mutateAsync({ operation: 'delete_browser', id: browser.id }) });
          }} />
        </span>
      </div>})}
    </div>
  </section>;
}
