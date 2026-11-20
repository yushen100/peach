import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/base/buttons/button';
import { StatusLabel } from '../components/status-label';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { confirmModal, spinnerHtml } from '@peach/legacy/ui';
import { esc } from '@peach/legacy/core';
import { apiSend, errorMessage } from '../../api';
import { queryClient } from '../query';
import { CodeBlock } from '../components/code-block';
import { ErrorText, FieldLabel, Footer, Help, Section, Stack } from '../settings/section';
import { busyProps, useAction } from '../settings/use-action';
import { composingKey } from '../components/ime';
import { SelectField } from '../components/select-field';
import { CUSTOM_SOURCES_URL as URL, CUSTOM_SOURCES_KEY as KEY, fetchCustomSources,
  type CustomSource as Source } from './custom-source-data';
import { t } from '../../i18n';

const FIELDS = [['code', t('manage:shared.code')], ['title', t('manage:shared.title')], ['studio', t('manage:customSources.fieldStudio')], ['series', t('manage:shared.series')],
  ['release_date', t('manage:shared.releaseDate')], ['performers', t('manage:customSources.fieldPerformers')], ['tags', t('manage:customSources.fieldTags')]] as const;
const TYPES = [['censored', t('manage:customSources.typeCensored')], ['amateur', t('manage:customSources.typeAmateur')], ['uncensored', t('manage:shared.uncensored')], ['fc2', 'FC2'],
  ['kmib', t('manage:customSources.typeKoreanMib')], ['other', t('manage:shared.other')], ['unsure', t('manage:customSources.typeUnverifiedCode')], ['unknown', t('manage:shared.unknown')]] as const;
const blank = (): Source => ({ name: '', endpoint: '', enabled: false, fields: { code: 'id', title: 'title' }, content_types: ['censored'] });

export function CustomSources({ receipt }: { receipt(message: string): void }) {
  const [editing, setEditing] = useState<Source | null>(null);
  const query = useQuery({ queryKey: KEY, queryFn: ({ signal }) => fetchCustomSources(signal) });
  const action = useAction();
  const changed = (result: { items: Source[] }) => queryClient.setQueryData(KEY, result);
  const hasContent = Boolean(query.isPending || query.error || query.data?.items.length || action.error);
  const add = <Button variant="secondary" onClick={() => setEditing(blank())}>{t('manage:customSources.addSource')}</Button>;
  return <Section id="custom-sources" title={t('manage:customSources.title')}>
    {hasContent ? <Stack>
      {query.isPending ? <div aria-busy="true" data-skeleton="" aria-label={t('manage:customSources.loading')} /> : null}
      {query.error ? <ErrorText>{errorMessage(query.error)}</ErrorText> : null}
      {query.data?.items.map((source) => <div key={source.id} className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">{source.name}</span>
        <StatusLabel tone={source.enabled ? 'success' : 'neutral'}>{source.enabled ? t('manage:customSources.enabled') : t('manage:customSources.disabled')}</StatusLabel>
        <Button variant="secondary" onClick={() => setEditing(source)}>{t('manage:shared.edit')}</Button>
        <Button variant="secondary" {...busyProps(action.busy === source.id)} onClick={() => void action.run(source.id!,
          (signal) => apiSend<{ items: Source[] }>(URL, { ...source, enabled: !source.enabled }, 'POST', signal),
          (result) => { changed(result); receipt(source.enabled ? t('manage:customSources.sourceDisabled') : t('manage:customSources.sourceEnabled')) })}>
          {source.enabled ? t('manage:customSources.disable') : t('manage:customSources.enable')}</Button>
        <Button variant="danger" onClick={() => confirmModal({ title: t('manage:customSources.deleteTitle'),
          body: t('manage:customSources.deleteBody', { name: esc(source.name) }), confirmLabel: t('manage:customSources.deleteConfirm'), danger: true,
          holdToConfirm: true,
          onConfirm: async () => { changed(await apiSend<{ items: Source[] }>(URL, { action: 'delete', id: source.id }));
            setEditing(null); receipt(t('manage:customSources.deleted')) } })}>{t('manage:shared.delete')}</Button>
      </div>)}
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
    </Stack> : null}
    {!editing ? hasContent ? <Footer>{add}</Footer> : <Stack><div className="flex justify-end">{add}</div></Stack> : null}
    {editing ? <SourceForm key={editing.id || 'new'} initial={editing} cancel={() => setEditing(null)}
      saved={(result) => { changed(result); setEditing(null); receipt(t('manage:customSources.saved')) }} /> : null}
  </Section>;
}

function SourceForm({ initial, cancel, saved }: {
  initial: Source; cancel(): void; saved(result: { items: Source[] }): void;
}) {
  const [source, setSource] = useState(initial);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<string>('');
  const revision = useRef(0);
  const action = useAction();
  const change = (patch: Partial<Source>) => { revision.current++; setSource((current) => ({ ...current, ...patch })); setPreview('') };
  return <form aria-label={t('manage:customSources.formLabel')} aria-busy={action.busy === 'preview'} onSubmit={(event) => {
    event.preventDefault();
    void action.run('save', (signal) => apiSend<{ items: Source[] }>(URL, source, 'POST', signal), saved);
  }}>
    <Stack>
      <Input label={t('manage:customSources.name')} value={source.name} maxLength={80} onChange={(name) => change({ name })} />
      <Input label={t('manage:customSources.endpoint')} value={source.endpoint} maxLength={2048}
        placeholder="https://example.com/api/movies/{code}" onChange={(endpoint) => change({ endpoint })} />
      <div className="flex flex-col gap-2">
        <FieldLabel>{t('manage:customSources.network')}</FieldLabel>
        <SelectField id="custom-source-network" label={t('manage:customSources.network')} epoch={0} value={source.network || 'direct'}
          options={[["direct", t('manage:processingTraffic.connectionDirect')], ["peach_proxy", t('manage:customSources.peachProxy')]]} onPick={(network) => change({ network })} />
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>{t('manage:customSources.codeFormat')}</FieldLabel>
        <SelectField id="custom-source-code-format" label={t('manage:customSources.codeFormat')} epoch={0} value={source.code_format || 'original'}
          options={[["original", t('manage:customSources.codeAsIs')], ["lowercase", t('manage:customSources.codeLowercase')], ["compact", t('manage:customSources.codeNoHyphens')], ["underscore", t('manage:customSources.codeUnderscores')]]}
          onPick={(code_format) => change({ code_format })} />
      </div>
      <Help>{t('manage:customSources.help')}</Help>
      {FIELDS.map(([field, label]) => <Input key={field} label={t('manage:customSources.fieldPath', { field: label })} value={source.fields[field] || ''}
        onChange={(path) => { const fields = { ...source.fields }; if (path) fields[field] = path; else delete fields[field]; change({ fields }) }} />)}
      <div className="flex flex-wrap gap-3" role="group" aria-label={t('manage:customSources.contentTypes')}>
        {TYPES.map(([type, label]) => <Checkbox key={type} isSelected={source.content_types.includes(type)}
          onChange={(checked) => change({ content_types: checked ? [...source.content_types, type] : source.content_types.filter((kind) => kind !== type) })}>{label}</Checkbox>)}
      </div>
      <Checkbox isSelected={source.enabled} onChange={(enabled) => change({ enabled })}>{t('manage:customSources.enableSource')}</Checkbox>
      <Input label={t('manage:customSources.testCode')} value={code} onChange={(value) => {
        revision.current++; setCode(value); setPreview('');
      }} onKeyDown={(event) => {
        if (event.key !== 'Enter' || composingKey(event.nativeEvent)) return;
        event.preventDefault();
        const current = revision.current;
        void action.run('preview', (signal) => apiSend<{ record: unknown }>(URL,
          { ...source, code, action: 'preview' }, 'POST', signal), (result) => {
            if (current === revision.current) setPreview(JSON.stringify(result.record, null, 2));
          }, (cause) => { if (current === revision.current) action.setError(errorMessage(cause)) });
      }} />
      {action.busy === 'preview' ? <Help role="status"><span dangerouslySetInnerHTML={{ __html: spinnerHtml(t('manage:customSources.testing')) }} />{t('manage:customSources.testing')}</Help> : null}
      {preview ? <CodeBlock code={preview} language="json" label={t('manage:customSources.response')} /> : null}
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
    </Stack>
    <Footer><Button variant="secondary" type="button" onClick={cancel}>{t('manage:shared.cancel')}</Button>
      <Button type="submit" {...busyProps(action.busy === 'save')}>{t('manage:customSources.saveSource')}</Button></Footer>
  </form>;
}
