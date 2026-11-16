import { useContext, useState } from 'react';
import { flushSync } from 'react-dom';
import { Heading } from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { Select, SelectItem } from '@/components/base/select/select';
import { confirmModal, spinnerHtml } from '@peach/legacy/ui';
import { pageOpens, writeShell } from '@peach/shell';
import { apiSend } from '../../api';
import { ModalFrame } from '../components/modal-frame';
import { Note } from '../components/note';
import { SettingsDialogClose } from '../components/settings-dialog-close';
import { queryClient } from '../query';
import { busyProps, useAction } from '../settings/use-action';
import { Disclosure } from '../settings/section';
import { ShellActionsContext } from '../router/router';
import { PURPOSES, type FolderPurpose, type FolderRule, type MediaFolder } from './catalog-folders';
import { t } from '../../i18n';
import { serverLabel } from '../../core/server-text';

interface Preview {
  plan_version: string; total: number; applicable: number; withdrawn: number;
  /** `reason` 是服务端按 zh-CN 渲染的原因，`reason_code` 给当前语言取译文。 */
  conflicts: { id: number; name: string; reason: string; reason_code?: string }[];
  sample: { id: number; name: string }[];
}

export function FolderRuleDialog({ folder, rule, revision, close }: {
  folder: MediaFolder; rule: FolderRule | null; revision: number; close(): void;
}) {
  const actions = useContext(ShellActionsContext);
  const action = useAction();
  const [purpose, setPurpose] = useState<FolderPurpose>(rule?.purpose || 'category');
  const [name, setName] = useState(rule?.name || '');
  const [recursive, setRecursive] = useState(rule?.recursive ?? true);
  const [future, setFuture] = useState(rule?.future ?? false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const body = { folder: folder.id, purpose, name, recursive, future };
  const dirty = () => { setPreview(null); action.setError(''); };
  const finished = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['catalog-folders'] });
    actions?.receipt(message);
    close();
    writeShell({ pageOpens: pageOpens + 1 });
  };
  const showPreview = () => action.run('preview', signal => apiSend<Preview>('/api/folders/preview', body, 'POST', signal), setPreview);
  const save = () => {
    if (!preview) return;
    void action.run('save', signal => apiSend<{ applied: number; conflicts: number }>('/api/folders/rule', {
      ...body, action: 'save', plan_version: preview.plan_version, expected_revision: revision,
    }, 'POST', signal), result => finished(result.applied ? t('catalog:folderRule.savedApplied', { count: result.applied }) : t('catalog:folderRule.saved')));
  };
  const remove = async () => {
    flushSync(() => setConfirming(true));
    const result = await confirmModal({
      title: t('catalog:folderRule.removeRule'), body: t('catalog:folderRule.removeConfirm', { name: folder.name }), confirmLabel: t('catalog:folderRule.removeRule'),
      holdToConfirm: true,
      onConfirm: () => apiSend('/api/folders/rule', { folder: folder.id, action: 'remove', expected_revision: revision }),
    });
    if (result.confirmed) finished(t('catalog:folderRule.removed')); else setConfirming(false);
  };
  const busy = !!action.busy;
  const waiting = (key: string, label: string) => action.busy === key
    ? <><span dangerouslySetInnerHTML={{ __html: spinnerHtml(label) }} />{label}</> : null;
  if (confirming) return null;
  return <ModalFrame isOpen onOpenChange={open => { if (!open && !busy) close() }} width="form" label={t('catalog:catalogFolders.setPurpose')}>
    <div className="peach-react">
      <div className="flex items-start justify-between gap-4 border-b border-separator-border p-5">
        <div className="min-w-0"><Heading slot="title" className="text-title-2-medium">{t('catalog:catalogFolders.setPurpose')}</Heading>
          <p className="mt-1 text-body-2-regular text-text-secondary wrap-anywhere">{folder.path}</p></div>
        <SettingsDialogClose label={t('catalog:folderRule.close')} onPress={() => { if (!busy) close() }} />
      </div>
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1"><Label>{t('catalog:folderRule.usedFor')}</Label>
          <Select aria-label={t('catalog:folderRule.usedFor')} selectedKey={purpose} isDisabled={busy}
            onSelectionChange={key => { setPurpose(key as FolderPurpose); dirty() }}>
            {Object.entries(PURPOSES).map(([key, label]) => <SelectItem key={key} id={key}>{label}</SelectItem>)}
          </Select>
        </div>
        {purpose !== 'category' ? <Input label={t('catalog:folderRule.linkedName')} value={name} onChange={value => { setName(value); dirty() }}
          placeholder={t('catalog:folderRule.namePlaceholder')} maxLength={200} isDisabled={busy} isRequired /> : null}
        <Checkbox isSelected={recursive} isDisabled={busy} onChange={value => { setRecursive(value); dirty() }}>{t('catalog:folderRule.applyToSubfolders')}</Checkbox>
        <Checkbox isSelected={future} isDisabled={busy} onChange={value => { setFuture(value); dirty() }}>{t('catalog:folderRule.applyToNewFiles')}</Checkbox>
        {preview ? <section aria-label={t('catalog:folderRule.impact')} className="flex flex-col gap-3">
          <p className="text-body-medium">{t('catalog:folderRule.previewSummary', { count: preview.total, applicable: preview.applicable })}{preview.conflicts.length ? t('catalog:folderRule.previewConflicts', { count: preview.conflicts.length }) : ''}</p>
          {preview.withdrawn ? <p className="text-body-2-regular text-text-secondary">{t('catalog:folderRule.withdrawNote', { count: preview.withdrawn })}</p> : null}
          {preview.sample.length ? <ul className="flex flex-col gap-1 text-body-2-regular text-text-secondary">
            {preview.sample.map(item => <li className="wrap-anywhere" key={item.id}>{item.name}</li>)}
          </ul> : null}
          {preview.conflicts.length ? <Note tone="warning" extra={<Disclosure summary={t('catalog:catalogFolders.viewConflicts')}>
            <ul className="mt-2 flex flex-col gap-2">{preview.conflicts.slice(0, 30).map(item => <li className="wrap-anywhere" key={item.id}>{t('shell:format.labelValue', { label: item.name, value: serverLabel(item.reason_code ?? '', item.reason) })}</li>)}</ul>
          </Disclosure>}>{t('catalog:folderRule.conflictNote')}</Note> : null}
        </section> : null}
        {action.error ? <Note tone="error">{action.error}</Note> : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-separator-border p-4">
        {rule ? <Button variant="ghost" className="mr-auto" onClick={() => { if (!busy) void remove() }} {...busyProps(action.busy === 'remove')}>{t('catalog:folderRule.remove')}</Button> : null}
        <Button variant="secondary" onClick={() => { if (!busy) close() }}>{t('catalog:shared.cancel')}</Button>
        {preview ? <Button variant="primary" {...busyProps(action.busy === 'save')} onClick={save}>{waiting('save', t('catalog:folderRule.saving')) || t('catalog:folderRule.save')}</Button>
          : <Button variant="primary" disabled={purpose !== 'category' && !name.trim()} {...busyProps(action.busy === 'preview')}
            onClick={() => { void showPreview() }}>{waiting('preview', t('catalog:folderRule.previewing')) || t('catalog:folderRule.preview')}</Button>}
      </div>
    </div>
  </ModalFrame>;
}
