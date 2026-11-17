import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { formModal } from '@peach/legacy/ui';
import { UNSAFE_PortalProvider } from 'react-aria';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { Select, SelectItem } from '@/components/base/select/select';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { apiGet, apiSend, errorMessage } from '../../api';
import { t } from '../../i18n';
import { Disclosure } from '../settings/section';
import { overlayHost } from '../components/overlay-host';

interface Plan { canonical_name: string; original_names: string[]; eligible: boolean;
  refs: { provider: string; kind: string; id: string }[] }
interface Draft { name: string; original: string; language: 'zh-CN' | 'zh-Hant'; evidence_url?: string }

export function NameContributionDialog({ entityId, close, saved }: {
  entityId: number; close(): void; saved(): void;
}) {
  const submit = useRef<(() => Draft | null) | null>(null);
  const [modal, setModal] = useState<ReturnType<typeof formModal> | null>(null);
  const callbacks = useRef({ close, saved });
  useEffect(() => {
    let draft: Draft | null = null;
    const dialog = formModal({ title: t('catalog:seedName.title'), confirmLabel: t('catalog:seedName.save'),
      backdropCloses: false, confirmDisabled: true,
      body: '<div class="peach-react" data-name-contribution-fields></div>',
      onConfirm: () => apiSend('/api/configuration/seed-sharing/name', { entity_id: entityId, ...draft }),
    });
    const validate = (event: Event) => {
      if (dialog.confirmButton.disabled) return;
      draft = submit.current?.() ?? null;
      if (draft === null) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    dialog.dialog.setAttribute('data-name-contribution-dialog', '');
    dialog.dialog.addEventListener('submit', validate, true);
    setModal(dialog);
    void dialog.done.then(result => { if (result.confirmed) callbacks.current.saved(); callbacks.current.close() });
    return () => {
      dialog.dialog.removeEventListener('submit', validate, true);
      dialog.close();
    };
  }, [entityId]);
  const host = modal?.dialog.querySelector('[data-name-contribution-fields]');
  return modal && host ? createPortal(<UNSAFE_PortalProvider getContainer={() => overlayHost(modal.dialog)}>
    <Fields entityId={entityId} submit={submit} confirmButton={modal.confirmButton} />
  </UNSAFE_PortalProvider>, host) : null;
}

function Fields({ entityId, submit, confirmButton }: {
  entityId: number; submit: { current: (() => Draft | null) | null }; confirmButton: HTMLButtonElement;
}) {
  const read = useQuery({ queryKey: ['seed-name-plan', entityId],
    queryFn: ({ signal }) => apiGet<Plan>(`/api/configuration/seed-sharing/name?entity_id=${entityId}`, signal) });
  const [name, setName] = useState('');
  const [original, setOriginal] = useState('');
  const [url, setUrl] = useState('');
  const [traditional, setTraditional] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const originalField = useRef<HTMLDivElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const evidenceField = useRef<HTMLInputElement>(null);
  const originalName = original || (read.data?.original_names.length === 1 ? read.data.original_names[0] : '') || '';
  const chinese = name.trim();
  const evidence = url.trim();
  const nameError = !chinese ? t('catalog:seedName.nameRequired') :
    !/[\u3400-\u9fff]/u.test(chinese) || /[\u3040-\u30ff]/u.test(chinese) ? t('catalog:seedName.nameInvalid') : '';
  const evidenceError = evidence && (!evidence.startsWith('https://') || !URL.canParse(evidence))
    ? t('catalog:seedName.evidenceInvalid') : '';
  const originalMissing = attempted && !originalName;
  const eligible = Boolean(read.data?.eligible);

  useLayoutEffect(() => { confirmButton.disabled = !eligible; }, [confirmButton, eligible]);
  useLayoutEffect(() => {
    submit.current = () => {
      if (!eligible) return null;
      const firstError = !originalName ? originalField.current?.querySelector<HTMLButtonElement>('button') :
        nameError ? nameField.current : evidenceError ? evidenceField.current : null;
      if (!originalName || nameError || evidenceError) {
        setAttempted(true);
        firstError?.focus();
        return null;
      }
      return { name: chinese, original: originalName, language: traditional ? 'zh-Hant' : 'zh-CN',
        ...(evidence ? { evidence_url: evidence } : {}) };
    };
    return () => { submit.current = null; };
  }, [submit, eligible, originalName, nameError, evidenceError, chinese, traditional, evidence]);

  return <div className="flex flex-col gap-3 text-body-2-regular text-text-secondary">
    <div>{t('catalog:seedName.description')}</div>
    {read.data ? <>
      <div className="text-headline-medium text-text-primary">{read.data.canonical_name}</div>
      <Disclosure summary={t('catalog:seedName.identity')}>
        <p>{read.data.refs.map(ref => `${ref.provider}: ${ref.id}`).join(' · ')}</p>
      </Disclosure>
      {read.data.eligible ? <>
        <div className="flex flex-col gap-1" data-seed-name-stage-field>
          <Label id="seed-name-original-label" isRequired>{t('catalog:seedName.original')}</Label>
          <Select ref={originalField} aria-labelledby="seed-name-original-label"
            aria-describedby={originalMissing ? 'seed-name-original-error' : undefined}
            isRequired isInvalid={originalMissing} validationBehavior="aria" selectedKey={originalName || null}
            renderValue={originalName || <span className={originalMissing ? 'text-text-error-primary' : 'text-text-secondary'}>
              {t('catalog:seedName.originalPlaceholder')}
            </span>}
            onSelectionChange={key => { if (key !== null) setOriginal(String(key)) }}>
            {read.data.original_names.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}
          </Select>
          {originalMissing && <div id="seed-name-original-error" className="text-caption-1-medium text-text-error-primary" role="alert">
            {t('catalog:seedName.originalRequired')}
          </div>}
        </div>
        <Input ref={nameField} label={t('catalog:seedName.chinese')} value={name} onChange={setName}
          maxLength={40} isRequired validationBehavior="aria" isInvalid={attempted && Boolean(nameError)}
          hint={attempted && nameError ? <span className="text-text-error-primary" role="alert">{nameError}</span> : undefined} />
        <Checkbox isSelected={traditional} onChange={setTraditional}>{t('catalog:seedName.traditional')}</Checkbox>
        <Input ref={evidenceField} label={t('catalog:seedName.evidence')} value={url} onChange={setUrl} type="url"
          validationBehavior="aria" isInvalid={attempted && Boolean(evidenceError)}
          hint={attempted && evidenceError
            ? <span className="text-text-error-primary" role="alert">{evidenceError}</span>
            : t('catalog:seedName.evidenceHelp')} />
      </> : <p>{t('catalog:seedName.noIdentity')}</p>}
    </> : read.isError ? <p role="alert">{errorMessage(read.error)}</p> : <p>{t('catalog:seedName.loading')}</p>}
    <div>{t('catalog:seedName.delivery')}</div>
  </div>;
}
