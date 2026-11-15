/* 「网络与访问」分组：本机端口、Peach 代理、访问密码与已登录的设备、访问口令、HTTPS 证书、公网入口。 */
import { useState, type FormEvent } from 'react';

import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Button } from '@/components/base/buttons/button';

import { apiSend } from '../../api';
import type { ConfigurationGroupProps, PeachProxyState } from '../bundle';
import { Note } from '../components/note';
import { AccessSettings } from './access-settings';
import { ApiTokenSettings } from './api-token-settings';
import { CertificateTrust } from './certificate-trust';
import { groupRoot } from './configuration-panel';
import { DeviceSessions } from './device-sessions';
import { PortSettings } from './port-settings';
import { ProxyAddressField, ProxyModeSelect } from './peach-proxy-fields';
import { TunnelSettings } from './tunnel-settings';
import { ErrorText, Footer, Rows, Section, Stack } from './section';
import { busyProps, useAction } from './use-action';
import { t } from '../../i18n';

export function NetworkSettings({ data, receipt, panel, issues }: ConfigurationGroupProps) {
  /* 远程访问要求先设访问密码：访问方式跟着密码卡的保存结果走，关掉密码时服务端也会顺手停掉隧道。 */
  const [accessMode, setAccessMode] = useState(data.access?.mode);
  const tunnelBlocked = accessMode === 'open' || accessMode === 'locked';
  return (
    <div {...groupRoot(panel)}>
      {issues}
      {data.network || (data.editable && data.port_editable !== false && !data.section_errors?.media_sources)
        ? <PortSettings data={data} receipt={receipt} /> : null}
      {data.access
        ? <AccessSettings initial={data.access} receipt={receipt} onSaved={(state) => setAccessMode(state.mode)}
            devices={(state) => <DeviceSessions revision={state.revision} receipt={receipt} />}
            after={data.api_token
              ? (state) => <ApiTokenSettings initial={data.api_token!} mode={state.mode} receipt={receipt} />
              : undefined} />
        : null}
      {data.certificate ? <CertificateTrust initial={data.certificate} /> : null}
      {data.tunnel ? <TunnelSettings revision={data.revision} initial={data.tunnel} receipt={receipt} blocked={tunnelBlocked} /> : null}
      {data.peach_proxy ? <PeachProxy initial={data.peach_proxy} receipt={receipt} /> : null}
    </div>
  );
}

export function PeachProxy({ initial, receipt }: { initial: PeachProxyState; receipt(message: string): void }) {
  const [saved, setSaved] = useState(initial);
  const [mode, setMode] = useState(initial.mode);
  const [address, setAddress] = useState('');
  const action = useAction();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void action.run('save', (signal) => apiSend<PeachProxyState>('/api/configuration/peach-proxy', { mode, proxy: address }, 'POST', signal),
      (next) => { setSaved(next); setAddress(''); receipt(t('settings:shared.settingsSaved')); });
  };

  return (
    <Section id="peachProxy" guide="proxy" title={t('settings:peachProxy.title')} onSubmit={submit}>
      <Rows>
        <SettingsRow label={t('settings:peachProxy.mode')} description={t('settings:peachProxy.modeHelp')}>
          <ProxyModeSelect mode={mode} onChange={setMode} />
        </SettingsRow>
      </Rows>
      {mode === 'proxy' || saved.needs_selection || action.error ? (
        <Stack divided>
          {mode === 'proxy'
            ? <ProxyAddressField id="peachProxyAddress" value={address} onChange={setAddress} saved={saved.proxy_saved} />
            : null}
          {saved.needs_selection ? <Note tone="warning" title={t('settings:peachProxy.chooseMode')}>{t('settings:peachProxy.modeConflict')}</Note> : null}
          {action.error ? <ErrorText>{action.error}</ErrorText> : null}
        </Stack>
      ) : null}
      <Footer>
        <Button type="submit" {...busyProps(action.busy === 'save')}>{t('settings:shared.saveSettings')}</Button>
      </Footer>
    </Section>
  );
}
