/* Cloudflare Tunnel：临时链接显示服务实际返回的随机入口，命名隧道显示配置好的公开主机名。
 *
 * 临时链接没有稳定域名和独立身份层，服务端会在 `open` 模式下拒绝启动。命名隧道多一份
 * 隧道令牌：它只往服务端去，回来的只有「存过没有」，这里任何时候都不显示令牌本身。
 * 模式选择只在源码开发环境出现，独立包收到的 `named_available` 是 false。 */
import { useEffect, useState, type FormEvent } from 'react';
import { Radio } from 'react-aria-components';

import { Button } from '@/components/base/buttons/button';
import { StatusLabel } from '../components/status-label';
import { Input } from '@/components/base/input/input';

import { ApiError, apiSend, errorMessage } from '../../api';
import type { ConfigurationData, TunnelState } from '../bundle';
import { Note } from '../components/note';
import { queryClient } from '../query';
import { SEGMENT, SEGMENTED_TRACK, SegmentedRadioGroup as RadioGroup } from '../components/segmented';
import { CONFIGURATION_KEY, fetchConfiguration } from './configuration';
import { ExternalLink, ErrorText, Footer, Help, Section, Stack } from './section';
import { busyProps, useAction } from './use-action';
import { bodyFieldErrors, codedText } from '../../core/server-text';
import { pollUntil } from '../../polling';
import { t } from '../../i18n';

/** 连接握手在服务端进行，页面按固定间隔重问，直到拿到入口或失败原因；读失败退避，页面不可见时暂停。 */
const POLL_INTERVAL = 2000;
/** 握手最多等这么久，过了由用户重新打开。 */
const POLL_LIMIT_MS = 5 * 60_000;

const MODES: [TunnelState['mode'], string][] = [['quick', t('settings:cloudflareTunnel.quick')], ['named', t('settings:cloudflareTunnel.named')]];

const HELP: Record<TunnelState['mode'], string> = {
  quick: t('settings:remoteAccess.quickHelp'),
  named: t('settings:remoteAccess.namedHelp'),
};

type FieldErrors = Partial<Record<'hostname' | 'mode', string>>;

export function TunnelSettings({ revision: initialRevision, initial, receipt, blocked = false }: {
  revision: string;
  initial: TunnelState;
  receipt(message: string): void;
  /** 没设访问密码（或被锁定）：服务端拒绝启动，这里不让按、不让填；关掉密码时服务端已停掉隧道。 */
  blocked?: boolean;
}) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    if (blocked) setState((current) => current.state === 'stopped' ? current : { ...current, enabled: false, state: 'stopped', url: '' });
  }, [blocked]);
  const [revision, setRevision] = useState(initialRevision);
  const [mode, setMode] = useState<TunnelState['mode']>(initial.mode);
  const [hostname, setHostname] = useState(initial.hostname);
  const [token, setToken] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const action = useAction();
  const active = state.state === 'starting' || state.state === 'running';
  const named = state.named_available && mode === 'named';

  useEffect(() => {
    if (state.state !== 'starting') return undefined;
    const controller = new AbortController();
    void pollUntil<ConfigurationData>({
      signal: controller.signal, everyMs: POLL_INTERVAL, limitMs: POLL_LIMIT_MS,
      read: (signal) => fetchConfiguration(signal),
      apply: (next) => {
        if (!next.tunnel) return;
        // 取回来的是整份配置，换进整页那一个键：屏幕上只有一份真相。
        queryClient.setQueryData(CONFIGURATION_KEY, next);
        setState(next.tunnel);
        setRevision(next.revision);
      },
      done: (next) => !!next.tunnel && next.tunnel.state !== 'starting',
    });
    return () => controller.abort();
  }, [state.state]);

  /** 开关和保存走同一个端点：形态与开关状态一次提交，服务端据此构造启动计划。 */
  const send = (key: 'save' | 'toggle', enabled: boolean, done: (next: TunnelState) => void) => {
    setFields({});
    void action.run(key, (signal) => apiSend<TunnelState & { revision: string }>(
      '/api/configuration/tunnel',
      { revision, enabled, mode, hostname, token }, 'POST', signal,
    ), (next) => {
      setState(next);
      setRevision(next.revision);
      setMode(next.mode);
      setHostname(next.hostname);
      // 令牌交上去之后草稿就清掉：页面上不留一份明文，回来的也只有「存过没有」。
      setToken('');
      done(next);
    }, (cause) => {
      const payload = cause instanceof ApiError ? cause.body as { detail?: unknown } : null;
      const errors = bodyFieldErrors<FieldErrors>(payload) || bodyFieldErrors<FieldErrors>(payload?.detail);
      if (errors) setFields(errors); else action.setError(errorMessage(cause));
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send('save', active, () => receipt(t('settings:shared.settingsSaved')));
  };

  const toggle = () => send('toggle', !active, (next) => receipt(
    next.enabled ? t('settings:cloudflareTunnel.started') : t('settings:cloudflareTunnel.stopped'),
  ));

  return (
    <Section id="tunnel" guide="tunnel" title={t('settings:remoteAccess.title')} onSubmit={submit} aside={<StatusLabel tone={state.error ? 'error' : active ? 'progress' : 'neutral'}>
      {state.error ? t('settings:cloudflareTunnel.connectionFailed') : state.state === 'running' ? t('settings:shared.running') : state.state === 'starting' ? t('settings:cloudflareTunnel.connectingStatus') : t('settings:shared.stopped')}</StatusLabel>}>
      <Stack>
        {state.named_available
          ? <RadioGroup aria-label={t('settings:cloudflareTunnel.modeLabel')} value={mode} isDisabled={active || blocked}
              onChange={(next) => setMode(next as TunnelState['mode'])} className={SEGMENTED_TRACK}>
              {MODES.map(([value, label]) => (
                <Radio key={value} value={value} className={SEGMENT}>{label}</Radio>
              ))}
            </RadioGroup>
          : null}
        <Help>{HELP[named ? 'named' : 'quick']}</Help>
        {named ? <>
          <Input id="tunnel-hostname" label={t('settings:remoteAccess.hostname')} autoComplete="off" maxLength={253}
            value={hostname} onChange={setHostname} isDisabled={active || blocked} validationBehavior="aria"
            isInvalid={Boolean(fields.hostname)}
            hint={fields.hostname || t('settings:remoteAccess.hostnameHelp')} />
          <Input id="tunnel-token" type="password" label={t('settings:remoteAccess.tunnelToken')} autoComplete="off" maxLength={2048}
            value={token} onChange={setToken} isDisabled={active || blocked} validationBehavior="aria"
            hint={state.token_set
              ? t('settings:cloudflareTunnel.tokenSaved')
              : t('settings:cloudflareTunnel.tokenHint')} />
        </> : null}
        {!state.available
          ? <Note tone="warning" title={t('settings:cloudflareTunnel.binaryMissing')}>{t('settings:cloudflareTunnel.binaryMissingHelp')}</Note>
          : null}
        {state.state === 'running' && state.url
          ? <Note tone="info" title={t('settings:cloudflareTunnel.publicUrl')}><ExternalLink href={state.url}>{state.url}</ExternalLink></Note>
          : null}
        {state.state === 'starting' ? <Note tone="info" title={t('settings:cloudflareTunnel.connectingTitle')}>{t('settings:cloudflareTunnel.connectingHelp')}</Note> : null}
        {state.error ? <ErrorText>{codedText(state, 'error')}</ErrorText> : null}
        {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      </Stack>
      <Footer>
        <Button variant={state.named_available ? 'secondary' : 'primary'} onClick={toggle} {...busyProps(action.busy === 'toggle')}
          disabled={blocked && !active}>
          {active ? t('settings:cloudflareTunnel.stop') : t('settings:remoteAccess.start')}
        </Button>
        {state.named_available
          ? <Button type="submit" {...busyProps(action.busy === 'save')}>{t('settings:shared.saveSettings')}</Button>
          : null}
      </Footer>
    </Section>
  );
}
