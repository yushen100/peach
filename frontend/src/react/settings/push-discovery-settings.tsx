/* 「推送发现」：新文件落地就进数据库，不必等下一轮全量扫描。
 *
 * 两条通道各一个开关。本地那条订阅本机文件夹的文件系统事件；网盘那条等 CloudDrive2 往
 * Peach 推一条通知，所以给出一段能整个贴进它「配置内容」的 TOML，外加一张「云端路径
 * 前缀 → 媒体根」的对应表。定期全量扫描不受这一页影响，它仍是漏发时的兜底。
 *
 * 地址、密钥不单独列成读数：它们只在那段配置里有用，抄两处只会抄漏一处。整段由服务端
 * 拼（`peach.push_discovery.clouddrive_config`）。
 *
 * 前缀怎么算合法、根是不是已声明过，同样由服务端判；这一页只把那句原因显示出来。
 *
 * 整块只有一种行：读数写在它所属那个开关的说明里，配置通过共用代码块展示与复制，
 * 前缀表排在最后。读数与配置跟着各自的开关收起：网盘通道关着时那段配置指向一件不会
 * 发生的事；本机监视在总开关关着时读作「没有运行」，分不出是没开还是坏了。 */
import { useState, type FormEvent } from 'react';
import { RiDeleteBinLine } from '@remixicon/react';

import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '../components/select';
import { Switch } from '@/components/base/switch/switch';
import { StatusLabel } from '../components/status-label';

import { apiSend, errorMessage } from '../../api';
import type { PushDiscoveryPrefix, PushDiscoveryState } from '../bundle';
import { CodeBlock } from '../components/code-block';
import { Note } from '../components/note';
import { Disclosure, ErrorText, FieldLabel, Footer, Help, Rows, Section, Stack } from './section';
import { busyProps, useAction } from './use-action';
import { codedText } from '../../core/server-text';
import { joinList, t } from '../../i18n';

const SAVE_URL = '/api/configuration/push-discovery';
const SECRET_URL = '/api/configuration/push-discovery/secret';

export function PushDiscoveryForm({ initial, receipt }: {
  initial: PushDiscoveryState;
  receipt(message: string): void;
}) {
  const [state, setState] = useState(initial);
  const [rows, setRows] = useState<PushDiscoveryPrefix[]>(initial.prefixes);
  const [failure, setFailure] = useState('');
  const action = useAction();
  const roots = state.media_roots;
  /* 读数说的是服务端此刻在跑什么，所以按已保存的开关收放：拨一下开关它们就跟着出现的话，
     写的还是上一次的状态，「本机文件夹监视 · 没有运行」会被读成「打开了也没用」。
     要填的东西（前缀表）反过来跟着拨到哪儿走，否则得先保存一次才能填。 */
  const [live, setLive] = useState(initial);

  const settle = (next: PushDiscoveryState, message: string) => {
    setState(next);
    setLive(next);
    setRows(next.prefixes);
    setFailure('');
    receipt(message);
  };

  const edit = (index: number, patch: Partial<PushDiscoveryPrefix>) =>
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = {
      enabled: state.enabled, watch_local: state.watch_local, cloud: state.cloud, prefixes: rows,
    };
    void action.run('save', (signal) => apiSend<PushDiscoveryState>(SAVE_URL, body, 'POST', signal),
      (next) => settle(next, t('settings:shared.settingsSaved')), (cause) => setFailure(errorMessage(cause)));
  };

  const rotate = () => {
    void action.run('secret', (signal) => apiSend<PushDiscoveryState>(SECRET_URL, {}, 'POST', signal),
      (next) => settle(next, t('settings:pushDiscovery.secretRotated')), (cause) => setFailure(errorMessage(cause)));
  };

  const ingested = [
    t('settings:pushDiscovery.ingestedCount', { count: live.queue.ingested }),
    live.queue.failed ? t('settings:pushDiscovery.failedCount', { count: live.queue.failed }) : '',
    live.queue.pending ? t('settings:pushDiscovery.pendingCount', { count: live.queue.pending }) : '',
  ].filter(Boolean).join(t('shell:format.clauseSeparator'));
  const watching = live.local_running
    ? t('settings:pushDiscovery.monitoring', { paths: joinList(live.local_roots) }) : (live.local_message ? codedText(live, 'local_message') : '') || t('settings:pushDiscovery.notRunningDetail');

  return (
    <Section id="pushDiscovery" guide="discovery" title={t('settings:fileDiscovery.title')} onSubmit={submit}>
      <Stack>
        <div className="flex flex-wrap items-center gap-2"><span className="text-body-regular text-text-secondary">{t('settings:pushDiscovery.localMonitoring')}</span>
          <StatusLabel tone={!live.enabled || !live.watch_local ? 'neutral' : live.local_running ? 'progress' : 'warning'}>{!live.enabled || !live.watch_local ? t('settings:shared.notEnabled') : live.local_running ? t('settings:shared.running') : t('settings:pushDiscovery.notRunning')}</StatusLabel></div>
      </Stack>
      <Rows>
        <SettingsRow label={t('settings:fileDiscovery.autoImport')} description={live.enabled ? ingested : undefined}>
          <Switch aria-label={t('settings:fileDiscovery.autoImport')} isSelected={state.enabled} isDisabled={!state.available}
            onChange={(enabled) => setState({ ...state, enabled })} />
        </SettingsRow>
        <SettingsRow label={t('settings:fileDiscovery.monitorLocal')} description={live.enabled && live.watch_local ? watching : undefined}>
          <Switch aria-label={t('settings:fileDiscovery.monitorLocal')} isSelected={state.watch_local}
            isDisabled={!state.available || !state.enabled}
            onChange={(watchLocal) => setState({ ...state, watch_local: watchLocal })} />
        </SettingsRow>
        <SettingsRow label={t('settings:fileDiscovery.cloudNotify')} description={t('settings:fileDiscovery.cloudNotifyHelp')}>
          <Switch aria-label={t('settings:fileDiscovery.cloudNotify')} isSelected={state.cloud}
            isDisabled={!state.available || !state.enabled}
            onChange={(cloud) => setState({ ...state, cloud })} />
        </SettingsRow>
        {live.enabled && live.cloud ? (
          <SettingsRow label={t('settings:fileDiscovery.webhookConfig')} description={live.config_toml
            ? t('settings:pushDiscovery.webhookHelp')
            : live.origin
              ? t('settings:pushDiscovery.noSecret')
              : t('settings:pushDiscovery.needsLanUrl')}>
          </SettingsRow>
        ) : null}
      </Rows>
      {/* 原因是服务端记下的最近一次入库异常，下一个文件入库成功时清空；漏掉的那个文件由
          定期全量扫描补上，所以这里只报原因，不给重试。 */}
      {live.enabled && live.queue.last_error ? (
        <Stack divided>
          <Note tone="error" title={t('settings:pushDiscovery.lastImportFailed')}>{live.queue.last_error}</Note>
        </Stack>
      ) : null}
      {live.enabled && live.cloud && live.config_toml ? (
        <Stack divided>
          <div className="flex flex-col gap-3">
            {/* 收起来是因为抄它的人不用读它：三十行里只有地址和密钥两处跟这台机器有关，
                两处都已经填好了。展开是留给要核对推到哪儿的那一次。 */}
            <Disclosure summary={t('settings:fileDiscovery.viewConfig')}>
              <CodeBlock code={live.config_toml} language="toml" label={t('settings:pushDiscovery.configLabel')} bounded={false} copyLabel={t('settings:pushDiscovery.copyConfig')}
                onCopy={() => receipt(t('settings:pushDiscovery.configCopied'))} />
              <Help>{t('settings:pushDiscovery.invalidPasteHelp')}</Help>
            </Disclosure>
          </div>
        </Stack>
      ) : null}
      {/* 前缀表不只给云通知用：云下载按它推出网盘目标目录与落地路径，开关关着也在生效，所以一直摆出来。 */}
      <Stack divided>
          <div className="flex flex-col gap-3">
            <FieldLabel>{t('settings:pushDiscovery.cloudPrefixes')}</FieldLabel>
            <Help>{t('settings:pushDiscovery.cloudPrefixesHelp')}</Help>
            <div role="group" aria-label={t('settings:pushDiscovery.cloudPrefixes')} className="flex flex-col gap-3">
              {rows.map((row, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Input className="min-w-0 flex-1" aria-label={t('settings:pushDiscovery.prefixLabel', { index: index + 1 })}
                    placeholder="/115" autoComplete="off" maxLength={200} value={row.prefix}
                    onChange={(prefix) => edit(index, { prefix })} />
                  <Select aria-label={t('settings:pushDiscovery.prefixRootLabel', { index: index + 1 })} prefix={t('settings:pushDiscovery.mapsTo')} selectedKey={row.root}
                    onSelectionChange={(key) => { if (key !== null) edit(index, { root: String(key) }); }}>
                    {roots.map((root) => <SelectItem key={root} id={root}>{root}</SelectItem>)}
                  </Select>
                  <Button variant="danger" iconOnly leadingIcon={RiDeleteBinLine} aria-label={t('settings:pushDiscovery.removeRow')}
                    onClick={() => setRows((list) => list.filter((_row, i) => i !== index))} />
                </div>
              ))}
            </div>
            <div>
              <Button variant="secondary"
                onClick={() => setRows((list) => [...list, { prefix: '', root: roots[0] ?? '' }])}>
                {t('settings:pushDiscovery.addPrefix')}
              </Button>
            </div>
          </div>
      </Stack>
      {/* 保存失败的原因单独一块：域名或前缀写坏时，失败的正是刚按下的那颗「保存配置」。 */}
      {failure || action.error
        ? <Stack divided><ErrorText>{failure || action.error}</ErrorText></Stack> : null}
      <Footer>
        {live.enabled && live.cloud && live.config_toml ? (
          <Button variant="secondary" onClick={rotate} disabled={!state.available}
            {...busyProps(action.busy === 'secret')}>{t('settings:fileDiscovery.rotateSecret')}</Button>
        ) : null}
        <Button type="submit" disabled={!state.available} {...busyProps(action.busy === 'save')}>
          {t('settings:shared.saveSettings')}
        </Button>
      </Footer>
    </Section>
  );
}
