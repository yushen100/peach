/* 来源和凭证：哪些站要登录、这台电脑上填没填、去哪儿取。
 *
 * 值不回显。服务端只报存在性，保存成功之后这一栏清空，看得到的只有字段名——凭据回到
 * 浏览器里就等于又多一处会被翻出来的副本。 */
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { confirmModal } from '@peach/legacy/ui';

import { Button } from '@/components/base/buttons/button';
import { Chip } from '@/components/base/badges/chip';
import { Input } from '@/components/base/input/input';

import { errorMessage } from '../../api';
import { rememberShape } from '../../configuration-skeleton';
import { cardClass } from '../components/card';
import { EmptyState } from '../components/empty-state';
import { Note } from '../components/note';
import { PathLine } from '../components/path-line';
import { queryClient } from '../query';
import { busyProps } from '../settings/use-action';
import { Disclosure, ErrorText, ExternalLink, Help, Section, Stack } from '../settings/section';
import {
  CREDENTIAL_STATE, credentialDone, FOLLOW_CREDENTIALS_KEY, saveCredential,
  type CredentialData, type CredentialRow,
} from './follow-manage';
import { SourceIcon } from './source-view';
import { RiKey2Line } from '@remixicon/react';
import { codedText, serverLabel } from '../../core/server-text';
import { joinList, t } from '../../i18n';

const CLEAR_BODY = t('follow:sourceCredentials.clearBody');
const WORLD_READABLE = t('follow:sourceCredentials.worldReadable');

/** 一个字段此刻的样子：共享回填的、本机存过的，还是从来没填过。 */
function fieldHint(row: CredentialRow, name: string): string {
  if ((row.shared_fields || []).includes(name)) return t('follow:sourceCredentials.fromSharedHint');
  return row.fields.includes(name) ? t('follow:sourceCredentials.savedHint') : t('follow:sourceCredentials.notSet');
}

function StateChip({ row }: { row: CredentialRow }) {
  const done = credentialDone(row);
  if (done) return <Chip variant="caption" color="lime">{t('follow:sourceCredentials.configured')}</Chip>;
  const color = row.requirement === 'required' ? 'yellow'
    : row.requirement === 'blocked' ? 'rose' : 'neutral';
  return <Chip variant="caption" color={color}>{CREDENTIAL_STATE[row.requirement] || ''}</Chip>;
}

function CredentialForm({ row, readOnly, toast }:
{ row: CredentialRow; readOnly: boolean; toast(message: string): void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState('');
  const done = credentialDone(row);

  const write = useMutation({
    mutationFn: (next: Record<string, string>) => saveCredential(row.provider, next),
    onSuccess: (result, next) => {
      /* 共享盘不在时后端只撤掉了本机那一份，必须让用户看见：他以为撤干净了，等盘回来
         key 又被同步回来。 */
      if (result.note) { setProblem(serverLabel(result.note_code ?? '', result.note)); return }
      setProblem('');
      setValues({});
      void queryClient.invalidateQueries({ queryKey: FOLLOW_CREDENTIALS_KEY, exact: true });
      toast(Object.keys(next).length ? t('follow:sourceCredentials.saved') : t('follow:sourceCredentials.cleared'));
    },
    onError: (cause) => setProblem(errorMessage(cause)),
  });

  const save = () => {
    const filled = Object.fromEntries(
      Object.entries(values).map(([name, value]) => [name, value.trim()]).filter(([, value]) => value));
    if (!Object.keys(filled).length) { setProblem(t('follow:sourceCredentials.nothingEntered')); return }
    write.mutate(filled);
  };

  return (
    <div className="flex flex-col gap-3">
      <Help>
        {codedText(row, 'why')}
        {/* 「去取」跳到那个站自己的页面，会离开 Peach，所以带外链标。 */}
        {row.where ? <> <ExternalLink href={row.where}>{t('follow:sourceCredentials.getCredentials')}</ExternalLink></> : null}
      </Help>
      {row.howto ? <Help>{codedText(row, 'howto')}</Help> : null}
      <div className="flex w-full flex-col gap-3">
        {(row.needs || []).map((name) => (
          <Input key={name} type="password" label={name} placeholder={fieldHint(row, name)}
            autoComplete="off" spellCheck="false" isDisabled={readOnly}
            value={values[name] || ''} onChange={(value) => setValues({ ...values, [name]: value })}
            className="w-full min-w-0" />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {done ? (
          <Button variant="danger" disabled={readOnly} {...busyProps(write.isPending)}
            onClick={() => void confirmModal({
              title: t('follow:sourceCredentials.clearTitle'), body: CLEAR_BODY, confirmLabel: t('follow:sourceCredentials.clearTitle'), danger: true,
              holdToConfirm: true,
              onConfirm: () => write.mutateAsync({}),
            })}>{t('follow:shared.clear')}</Button>
        ) : null}
        <Button variant="primary" disabled={readOnly} {...busyProps(write.isPending)}
          onClick={save}>{t('follow:shared.saveSettings')}</Button>
      </div>
      {problem ? <ErrorText>{problem}</ErrorText> : null}
      {(row.shared_fields || []).length
        ? <Help>{t('follow:sourceCredentials.sharedFieldsHint', { count: row.shared_fields!.length, fields: joinList(row.shared_fields!) })}</Help>
        : null}
      {row.path
        ? <Disclosure summary={t('follow:sourceCredentials.credentialsFile')}><PathLine path={row.path} className="font-mono text-caption-1-regular text-text-tertiary" onRevealed={toast} /></Disclosure>
        : null}
    </div>
  );
}

function CredentialSection({ row, readOnly, toast }:
{ row: CredentialRow; readOnly: boolean; toast(message: string): void }) {
  const head = (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
        <SourceIcon provider={row.provider} />
      </span>
      <b className="min-w-0 text-body-medium wrap-anywhere text-text-primary">{row.provider_label}</b>
      <StateChip row={row} />
      {/* 每个缺的字段一枚标签：缺两项就是两枚，填上一项消掉一枚。 */}
      {row.missing.map(field => <Chip key={field} variant="caption" color="rose">{t('follow:sourceCredentials.missingField', { field })}</Chip>)}
    </span>
  );
  if (row.requirement === 'none' || row.requirement === 'blocked') {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-separator-border px-6 py-5 last:border-b-0 max-sm:px-4">
        {head}
        {row.requirement === 'blocked' ? <Help>{codedText(row, 'why')}</Help> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 border-b border-separator-border px-6 py-5 last:border-b-0 max-sm:px-4">
      {head}
      <Disclosure summary={credentialDone(row) ? t('follow:sourceCredentials.editCredentials') : t('follow:sourceCredentials.enterCredentials')}
        defaultOpen={row.requirement === 'required' && !credentialDone(row)}>
        <CredentialForm row={row} readOnly={readOnly} toast={toast} />
      </Disclosure>
      {row.world_readable ? <Note tone="error" title={t('follow:sourceCredentials.permissionsTooOpen')}>{WORLD_READABLE}</Note> : null}
    </div>
  );
}

export function Credentials(
  { data, readOnly, toast, embedded = false }:
  { data: CredentialData; readOnly: boolean; toast(message: string): void; embedded?: boolean },
) {
  const rows = data.providers || [];
  const pending = rows.filter((row) => row.requirement === 'required' && !credentialDone(row));
  /* 记下哪些来源已配好：配置页骨架据此画每行的徽章位与展开态（站点清单本身是静态登记）。 */
  useEffect(() => { rememberShape('credentials', { done: rows.filter(credentialDone).map(row => row.provider) }) }, [data]);
  if (!rows.length) {
    return <EmptyState size="compact" icon={RiKey2Line} title={t('follow:sourceCredentials.emptyTitle')}>{t('follow:sourceCredentials.emptyHint')}</EmptyState>;
  }
  const pendingLabel = pending.length ? <span className="text-body-2-regular text-text-error-primary">{t('follow:sourceCredentials.pendingCount', { count: pending.length })}</span> : null;
  const groups = <>{[
        { title: t('follow:sourceCredentials.groupSupported'), rows: rows.filter((row) => row.requirement !== 'none' && row.requirement !== 'blocked') },
        { title: t('follow:sourceCredentials.groupNotNeeded'), rows: rows.filter((row) => row.requirement === 'none') },
        { title: t('follow:sourceCredentials.groupUnsupported'), rows: rows.filter((row) => row.requirement === 'blocked') },
      ].filter((group) => group.rows.length).map((group) => (
        <section key={group.title} aria-label={group.title} className="flex flex-col gap-2">
          <h4 className="text-body-medium text-text-secondary">{group.title}</h4>
          <div className={cardClass({ variant: 'outlined', padding: 'none', className: 'flex flex-col overflow-hidden' })}>
            {group.rows.map((row) => (
              <CredentialSection key={row.provider} row={row} readOnly={readOnly} toast={toast} />
            ))}
          </div>
        </section>
      ))}</>;
  return embedded ? <Section guide="credentials" title={t('follow:sourceCredentials.sectionTitle')} aside={pendingLabel || undefined}>
    <Stack><div className="flex flex-col gap-4">{groups}</div></Stack>
  </Section> :
    <div className={cardClass({ padding: 'none', className: 'flex flex-col gap-4 px-6 py-5 max-sm:px-4' })}>
      <div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto text-title-2-medium text-text-primary">{t('follow:sourceCredentials.sectionTitle')}</h3>{pendingLabel}</div>
      {groups}
    </div>;
}
