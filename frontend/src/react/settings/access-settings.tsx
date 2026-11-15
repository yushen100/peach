/* 本机访问密码，由 BoardUI 原版组件组合；表单值只留在提交期间的组件内存中。
 *
 * 字段是 BoardUI `Input`（React Aria TextField），开关是 BoardUI `Checkbox`，提交键是 BoardUI `Button`；
 * 新密码与确认两框是与首启页共用的 `./password-pair`，分区外框与提示用配置页共用的 `./section`。 */
import { useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';

import { ApiError, apiSend, errorMessage } from '../../api';
import type { AccessSettingsProps, AccessState } from '../bundle';
import { Note } from '../components/note';
import { PasswordPair } from './password-pair';
import { ErrorText, Footer, Help, Section, Stack } from './section';
import { busyProps, useAction } from './use-action';
import { bodyFieldErrors } from '../../core/server-text';
import { t } from '../../i18n';

type FieldErrors = Partial<Record<'current_password' | 'password' | 'confirmation', string>>;

const HELP: Partial<Record<AccessState['mode'], string>> = {
  legacy: t('settings:accessPassword.legacyHelp'),
  locked: t('settings:accessPassword.lockedHelp'),
  password: t('settings:accessPassword.passwordHelp'),
};

export function AccessSettings({ initial, receipt, devices, after, onSaved }: AccessSettingsProps) {
  const [state, setState] = useState(initial);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [disable, setDisable] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const body = useRef<HTMLDivElement>(null);
  const action = useAction();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const issues: FieldErrors = {};
    if (state.mode === 'password' && !current) issues.current_password = t('settings:accessPassword.enterCurrent');
    if (!disable) {
      if (password.length < 8 || password.length > 256) issues.password = t('settings:accessPassword.lengthError');
      if (password !== confirmation) issues.confirmation = t('settings:accessPassword.mismatch');
    }
    setFields(issues);
    if (Object.keys(issues).length) {
      requestAnimationFrame(() => body.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus());
      return;
    }
    void action.run('save', (signal) => apiSend<AccessState>('/api/configuration/access', {
      revision: state.revision, action: disable ? 'disable' : 'set', confirm_disable: disable,
      current_password: current, password: disable ? '' : password, confirmation: disable ? '' : confirmation,
    }, 'POST', signal), (next) => {
      setState(next); setCurrent(''); setPassword(''); setConfirmation(''); setDisable(false); setFields({});
      onSaved?.(next);
      receipt(next.mode === 'open' ? t('settings:accessPassword.turnedOff') : t('settings:shared.settingsSaved'));
    }, (cause) => {
      const payload = cause instanceof ApiError ? cause.body as { detail?: unknown } : null;
      const errors = bodyFieldErrors<FieldErrors>(payload) || bodyFieldErrors<FieldErrors>(payload?.detail);
      if (errors) setFields(errors); else action.setError(errorMessage(cause));
    });
  };

  const help = HELP[state.mode];
  const editable = state.mode !== 'locked';
  return (<>
    <Section guide="access" title={t('settings:accessPassword.title')} onSubmit={submit}>
      <div ref={body}>
        <Stack>
          {help ? <Help>{help}</Help> : null}
          {state.mode === 'open'
            ? <Note tone="warning" title={t('settings:accessPassword.notSet')}>{t('settings:accessPassword.openWarning')}</Note>
            : null}
          {state.mode === 'password' || state.mode === 'legacy'
            ? <Checkbox isSelected={disable} onChange={setDisable}>{t('settings:accessPassword.turnOff')}</Checkbox>
            : null}
          {state.mode === 'password'
            ? <Input id="access-current" type="password" label={t('settings:accessPassword.current')} autoComplete="current-password" maxLength={256}
                value={current} onChange={setCurrent} isRequired validationBehavior="aria"
                isInvalid={Boolean(fields.current_password)} hint={fields.current_password} />
            : null}
          {editable && !disable
            ? <PasswordPair label={state.mode === 'password' ? t('settings:accessPassword.new') : t('settings:accessPassword.set')}
                password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation}
                passwordError={fields.password} confirmationError={fields.confirmation}
                passwordHint={t('settings:accessPassword.newHelp')} />
            : null}
          {disable ? <Note tone="warning" title={t('settings:accessPassword.scope')}>{t('settings:accessPassword.disableWarning')}</Note> : null}
          {action.error ? <ErrorText>{action.error}</ErrorText> : null}
        </Stack>
      </div>
      {editable
        ? <Footer><Button type="submit" {...busyProps(action.busy === 'save')}>{t('settings:shared.saveSettings')}</Button></Footer>
        : null}
    </Section>
    {devices && (state.mode === 'password' || state.mode === 'legacy') ? devices(state) : null}
    {after ? after(state) : null}
  </>);
}
