/* 「应用与维护」的后半段：存储空间、数据上传、运行信息、新手教程与卸载。少改的隐私开关和只读信息在后，
 * 卸载是不可逆动作，留在整组最后。 */
import { useState, type FormEvent } from 'react';
import { confirmModal } from '@peach/legacy/ui';

import { SettingsCard, SettingsRow } from '@/components/application/settings/settings-rows';
import { Button } from '@/components/base/buttons/button';
import { Select, SelectItem } from '@/components/base/select/select';
import { Switch } from '@/components/base/switch/switch';

import { apiSend } from '../../api';
import type {
  AutomaticUpdateState, ConfigurationFact, ConfigurationGroupProps, ConfigurationProps, UninstallState,
} from '../bundle';
import { PathLine } from '../components/path-line';
import { groupRoot } from './configuration-panel';
import { LedgerBackupSettings } from './ledger-backup-settings';
import { RetentionSettings } from './retention-settings';
import { LibrarySharingSettings } from './library-sharing-settings';
import { RemoteReportingSettings } from './remote-reporting-settings';
import { Disclosure, ErrorText, ExternalLink, Fact, FactList, Footer, Help, Rows, Section, Stack } from './section';
import { StorageSettings } from './storage-settings';
import { busyProps, useAction } from './use-action';
import { localizedFact } from './coded-text';
import { codedText, serverText } from '../../core/server-text';
import { t } from '../../i18n';

const INTERVALS = [['6', t('settings:automaticUpdates.every6Hours')], ['24', t('settings:automaticUpdates.daily')], ['168', t('settings:automaticUpdates.weekly')]] as const;

export function MaintenanceSettings(
  { data, receipt, reopenTutorial, panel }: ConfigurationGroupProps & Pick<ConfigurationProps, 'reopenTutorial'>,
) {
  return (
    <div {...groupRoot(panel)}>
      {data.storage ? <StorageSettings initial={data.storage} receipt={receipt} /> : null}
      {data.storage ? <LedgerBackupSettings receipt={receipt} /> : null}
      {data.storage ? <RetentionSettings receipt={receipt} /> : null}
      {data.remote_reporting || data.library_sharing ? <Section id="librarySharing" guide="reporting" title={t('settings:dataSharing.title')}>
        {data.remote_reporting ? <RemoteReportingSettings initial={data.remote_reporting} receipt={receipt} /> : null}
        {data.library_sharing ? <div className="border-t border-separator-border">
          <LibrarySharingSettings initial={data.library_sharing} receipt={receipt} />
        </div> : null}
      </Section> : null}
      <Facts facts={data.facts} receipt={receipt} />
      <TutorialSettings receipt={receipt} reopenTutorial={reopenTutorial} />
      {data.uninstall ? <UninstallSettings uninstall={data.uninstall} receipt={receipt} /> : null}
    </div>
  );
}

/** 恢复账本共享的教程入口，保留首次设置与章节进度。 */
export function TutorialSettings({ reopenTutorial }: ConfigurationProps) {
  return (
    <section aria-label={t('settings:tour.guidedTour')} className="w-full"><SettingsCard>
      <Rows><SettingsRow label={t('settings:tour.guidedTour')} description={t('settings:tour.reopenDescription')}>
        <Button variant="secondary" onClick={() => void reopenTutorial()}>{t('settings:tour.reopen')}</Button>
      </SettingsRow></Rows>
    </SettingsCard></section>
  );
}

export function AutomaticUpdates({ initial, receipt }: { initial: AutomaticUpdateState; receipt(message: string): void }) {
  const [mode, setMode] = useState(initial.mode);
  const [hours, setHours] = useState(initial.interval_hours);
  const action = useAction(initial.error ? codedText(initial, 'error') : initial.error);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!initial.available) return;
    void action.run('save', (signal) => apiSend<AutomaticUpdateState>('/api/configuration/automatic-updates',
      { mode, interval_hours: hours }, 'POST', signal), () => receipt(t('settings:shared.settingsSaved')));
  };

  const help = !initial.available
    ? t('settings:automaticUpdates.needsTray')
    : initial.download_available
      ? t('settings:automaticUpdates.confirmInstall')
      : undefined;
  return (
    <Section id="automaticUpdates" guide="automatic-updates" title={t('settings:autoUpdate.title')} onSubmit={submit}>
      <Rows>
        <SettingsRow label={t('settings:autoUpdate.autoCheck')}>
          <Switch aria-label={t('settings:autoUpdate.autoCheck')} isSelected={mode !== 'off'} isDisabled={!initial.available}
            onChange={(on) => setMode(on ? 'check' : 'off')} />
        </SettingsRow>
        <SettingsRow label={t('settings:autoUpdate.autoDownload')} description={t('settings:autoUpdate.autoDownloadHelp')}>
          <Switch aria-label={t('settings:autoUpdate.autoDownload')} isSelected={mode === 'download'}
            isDisabled={!initial.available || !initial.download_available || mode === 'off'}
            onChange={(on) => setMode(on ? 'download' : 'check')} />
        </SettingsRow>
        <SettingsRow label={t('settings:autoUpdate.frequency')} description={help}>
          <Select aria-label={t('settings:autoUpdate.frequency')} selectedKey={String(hours)} isDisabled={!initial.available}
            onSelectionChange={(key) => { if (key !== null) setHours(Number(key)); }}>
            {INTERVALS.map(([key, name]) => <SelectItem key={key} id={key}>{name}</SelectItem>)}
          </Select>
        </SettingsRow>
      </Rows>
      {action.error ? <Stack divided><ErrorText>{action.error}</ErrorText></Stack> : null}
      <Footer>
        <Button type="submit" disabled={!initial.available} {...busyProps(action.busy === 'save')}>{t('settings:shared.saveSettings')}</Button>
      </Footer>
    </Section>
  );
}

/* 缺的媒体工具在能装的平台上带「安装」：下载、校验、解压都在那一次请求里做完，回来的运行信息整块
 * 替换，刚装好的那一行直接写着版本。其余平台没有发布的工具包，仍是官方下载外链。 */
function Facts({ facts: loaded, receipt }: { facts: ConfigurationFact[]; receipt(message: string): void }) {
  const [installed, setInstalled] = useState<ConfigurationFact[] | null>(null);
  const facts = installed ?? loaded;
  const action = useAction();
  const install = (tool: string) => void action.run(tool, (signal) => apiSend<{ message: string; facts: ConfigurationFact[] }>(
    '/api/configuration/media-tools', { tool }, 'POST', signal), (result) => {
    setInstalled(result.facts.map(localizedFact));
    receipt(serverText(result) || result.message);
  });
  return (
    <Section guide="facts" title={t('settings:runtimeInfo.title')}>
      <FactList>
        {facts.map(({ term, value, install_tool: tool, download_url: url, download_label: label }) => (
          <Fact key={term} term={term}>
            {/* 「安装」钉在说明右边：说明在自己那一栏里折行，按钮不被挤到下一行。 */}
            {tool ? <span className="flex min-w-0 items-center gap-3">
              <span className="min-w-0">{value}</span>
              <Button size="small" className="shrink-0" onClick={() => install(tool)}
                {...busyProps(action.busy === tool)}>{t('settings:shared.install')}</Button>
            </span> : <>
              {value}
              {url ? <ExternalLink href={url}>{label}</ExternalLink> : null}
            </>}
          </Fact>
        ))}
      </FactList>
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
    </Section>
  );
}

export function UninstallSettings(
  { uninstall, receipt }: { uninstall: UninstallState; receipt(message: string): void },
) {
  const [removeData, setRemoveData] = useState(false);
  const [accepted, setAccepted] = useState('');
  const remove = () => void confirmModal({
    title: t('settings:uninstall.title'),
    danger: true,
    body: removeData
      ? t('settings:uninstall.confirmFull')
      : t('settings:uninstall.confirmAppOnly'),
    confirmLabel: t('settings:uninstall.title'),
    onConfirm: async () => {
      const result = await apiSend<{ message: string }>('/api/configuration/uninstall', { delete_data: removeData, confirmation: 'uninstall-peach' }); // 服务端校验的确认值，用户不输入
      setAccepted(serverText(result) || result.message);
    },
  });
  // 底栏左边一句说这颗按钮此刻意味着什么：拦住卸载的理由（源码安装、更新还在跑）和按下去
  // 之后的回执都在答「这颗现在能不能按」，摆在正文末尾就得先读完整段说明才找得到。
  const status = accepted || codedText(uninstall, 'message');
  const paths = [...new Set([uninstall.data_root, ...uninstall.directories])];
  return (
    <Section id="uninstallPeach" guide="uninstall" title={t('settings:uninstall.title')}>
      {uninstall.available ? <Stack><Help>{t('settings:uninstall.help')}</Help></Stack> : null}
      <Rows>
        <SettingsRow label={t('settings:uninstall.full')} description={t('settings:uninstall.fullHelp')}>
          <Switch aria-label={t('settings:uninstall.full')} isSelected={removeData} isDisabled={!uninstall.full_available || Boolean(accepted)} onChange={setRemoveData} />
        </SettingsRow>
      </Rows>
      <Stack divided>
        <Disclosure summary={t('settings:shared.dataDirectory')}>
          {paths.map((path) => (
            <PathLine key={path} path={path} className="text-body-2-regular text-text-secondary" onRevealed={receipt} />
          ))}
        </Disclosure>
      </Stack>
      <Footer status={status ? <p role={accepted ? 'status' : undefined}>{status}</p> : null}>
        <Button variant="danger" disabled={!uninstall.available || Boolean(accepted)} onClick={remove}>{t('settings:uninstall.title')}</Button>
      </Footer>
    </Section>
  );
}
