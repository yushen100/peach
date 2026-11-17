import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Switch } from '@/components/base/switch/switch';
import { apiGet, apiSend } from '../../api';
import { t } from '../../i18n';
import { CodeBlock } from '../components/code-block';
import { StatusLabel } from '../components/status-label';
import { Disclosure, ErrorText, Footer, Help, Rows, Section, Stack } from './section';
import { busyProps, useAction } from './use-action';

interface State {
  enabled: boolean; available: boolean; schema: number;
  last_attempt: { status?: string; period?: string };
  name_candidates?: { pending: number; adopted: number; withdrawn: number };
}
interface Preview { data: { claims: unknown[]; omitted: number }; token: string; schema: number; bytes: number }

export function SeedSharingSettings({ receipt }: { receipt(message: string): void }) {
  const read = useQuery({ queryKey: ['seed-sharing'], queryFn: ({ signal }) => apiGet<State>('/api/configuration/seed-sharing', signal) });
  const [saved, setSaved] = useState<State | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [consent, setConsent] = useState(false);
  const action = useAction();
  const value = saved ?? read.data;
  const save = (enabled: boolean) => void action.run('save', signal => apiSend<State>('/api/configuration/seed-sharing', {
    enabled, consent, preview_token: preview?.token, schema: value?.schema,
  }, 'POST', signal), result => {
    setSaved(result); setPreview(null); setConsent(false); receipt(t('settings:seedSharing.saved'));
  });
  const status = value?.last_attempt.status;
  return <Section id="seedSharing" title={t('settings:seedSharing.title')}>
    <Rows><SettingsRow label={t('settings:seedSharing.enable')} description={t('settings:seedSharing.description')}>
      <Switch aria-label={t('settings:seedSharing.enable')} isSelected={value?.enabled ?? false}
        isDisabled={!value} aria-busy={!!action.busy}
        onChange={on => {
          if (action.busy) return;
          if (on) void action.run('preview', signal => apiGet<Preview>('/api/configuration/seed-sharing/preview', signal),
            result => { setPreview(result); setConsent(false) });
          else save(false);
        }} />
    </SettingsRow></Rows>
    <Stack divided><Help>{t('settings:seedSharing.independent')}</Help>
      <Disclosure summary={t('settings:seedSharing.fields')}>
        <ul className="list-disc space-y-2 pl-5">
          {['works', 'entities', 'decisions', 'images', 'sources'].map(key => <li key={key}><Help>{t(`settings:seedSharing.${key}`)}</Help></li>)}
        </ul>
        <Help>{t('settings:seedSharing.excluded')}</Help>
      </Disclosure>
      <Help>{t('settings:seedSharing.notice')}</Help>
      {!value?.available && value ? <StatusLabel>{t('settings:seedSharing.unavailable')}</StatusLabel> : null}
      {status ? <StatusLabel tone={status === 'failed' ? 'error' : status === 'accepted' ? 'success' : 'neutral'}>
        {t(`settings:seedSharing.status.${status}`)}</StatusLabel> : null}
      {status === 'accepted' ? <Help>{t('settings:seedSharing.acceptedHelp')}</Help> : null}
      {value?.name_candidates && Object.values(value.name_candidates).some(Boolean)
        ? <Help>{t('settings:seedSharing.names', { ...value.name_candidates })}</Help> : null}
    </Stack>
    {preview ? <Stack divided>
      <Help>{t('settings:seedSharing.summary', { count: preview.data.claims.length, omitted: preview.data.omitted,
        size: (preview.bytes / 1024).toFixed(1) })}</Help>
      <Disclosure summary={t('settings:seedSharing.previewData')}>
        <CodeBlock code={JSON.stringify(preview.data, null, 2)} language="json" label={t('settings:seedSharing.previewData')} maxCharacters={24000} />
      </Disclosure>
      {!value?.enabled ? <Checkbox isSelected={consent} onChange={setConsent}>{t('settings:seedSharing.consent')}</Checkbox> : null}
    </Stack> : null}
    {read.isError || action.error ? <Stack divided><ErrorText>{action.error || t('settings:seedSharing.readFailed')}</ErrorText></Stack> : null}
    <Footer>
      <Button variant="secondary" onClick={() => void action.run('refresh', signal =>
        apiGet<State>('/api/configuration/seed-sharing', signal), setSaved)} {...busyProps(action.busy === 'refresh')}>
        {t('settings:seedSharing.refresh')}</Button>
      <Button variant="secondary" onClick={() => void action.run('preview',
        signal => apiGet<Preview>('/api/configuration/seed-sharing/preview', signal),
        result => { setPreview(result); setConsent(false) })} {...busyProps(action.busy === 'preview')}>
        {t('settings:seedSharing.preview')}</Button>
      {!value?.enabled && preview ? <Button variant="primary" disabled={!consent || !value?.available} onClick={() => save(true)}
        {...busyProps(action.busy === 'save')}>{t('settings:seedSharing.agree')}</Button> : null}
      {preview ? <Button variant="secondary" onClick={() => { setPreview(null); setConsent(false) }}>{t('settings:shared.cancel')}</Button> : null}
      {preview ? <Button variant="secondary" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(preview.data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'peach-seed-contributions-preview.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>{t('settings:seedSharing.download')}</Button> : null}
    </Footer>
  </Section>;
}
