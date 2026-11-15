/* 「云下载」：把磁力交给 115 或 PikPak 离线下载，文件落在已挂载的网盘目录，由推送发现入库。
 *
 * 两张卡。第一张是地址、令牌、目标目录与等待上限：115 走 CloudDrive2 的 gRPC，令牌在
 * CloudDrive2「设置 → API 令牌」里生成。检查去问 CloudDrive2 有没有离线权限、目标目录能不能
 * 离线、115 还剩几条配额，只读，不提交：地址和令牌都已保存时卡片一打开就按已保存的配置查一遍，
 * 「保存配置」的响应里也带着一份，「检查」键按此刻填的值重查。115 目标目录留空保存时，服务端按
 * 推送发现推一个目录，已经存在就直接存上。地址、还没存的目标目录与 PikPak 根留空时，检查把
 * 探测到的、按推送发现推出的值填回表单，点「保存配置」才落盘；推出的目录不存在时给一颗
 * 「新建这个目录」，只有点了才在 CloudDrive2 里建。第二张是 PikPak 账号，提供账号密码与浏览器登录。
 *
 * 令牌与密码只往本机凭据文件写，读接口只回「存没存过」，所以令牌框保存后清空、提示改成
 * 「已保存，留空不改」。PikPak 要人机验证时服务端回一个验证页地址，这里给出链接让用户在浏览器
 * 里完成，Peach 不替他过验证。 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/base/buttons/button';
import { Chip } from '@/components/base/badges/chip';
import { StatusLabel } from '../components/status-label';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '@/components/base/select/select';

import { apiGet, apiSend, errorMessage } from '../../api';
import type {
  ConfigurationPanel, DownloadCheckReport, DownloadConfig, DownloadSaveResult, DownloadSettingsState, PikPakLoginResult,
} from '../bundle';
import { ActivityStatus } from '../components/activity-motion';
import { Note } from '../components/note';
import { SourceLabel, providerIcon } from '../components/source-label';
import { groupRoot } from './configuration-panel';
import {
  ErrorText, ExternalLink, Fact, FactList, FieldLabel, Footer, Help, Section, Stack,
} from './section';
import { busyProps, useAction } from './use-action';
import { JavBrowserSettings } from './jav-browser-settings';
import { CLOUD_LOCATIONS } from '../../core/media-sources';
import { jobText, serverLabel } from '../../core/server-text';
import { pollUntil } from '../../polling';
import { t } from '../../i18n';

export const DOWNLOADS_URL = '/api/configuration/downloads';
const CHECK_URL = '/api/configuration/downloads/check';
const FOLDER_URL = '/api/configuration/downloads/folder';
const LOGIN_URL = '/api/configuration/downloads/pikpak/login';
const LOGOUT_URL = '/api/configuration/downloads/pikpak/logout';
const BROWSER_URL = '/api/configuration/downloads/pikpak/browser-login';
const POLL_MS = 2000;
/** 浏览器登录最多等这么久，过了由用户重新打开。 */
const BROWSER_LOGIN_LIMIT_MS = 15 * 60_000;
const PikPakIcon = providerIcon('pikpak');

/** 设置块与检查报告里的问题：`problems` 是服务端按 zh-CN 渲染的原句，`problem_codes` 与之一一对应，
 *  有译文用译文；缺 code 的旧原句照原文显示。 */
const problemTexts = (body: Pick<DownloadSettingsState, 'problems' | 'problem_codes'>): string[] =>
  (body.problems ?? []).map((problem, index) => {
    const coded = body.problem_codes?.[index];
    return coded?.code ? serverLabel(coded.code, problem, coded.params) : problem;
  });
/** 检查报告里缺的离线权限，`missing_codes` 与 `missing` 一一对应。 */
const missingTexts = (report: DownloadCheckReport): string[] =>
  report.missing.map((label, index) => serverLabel(report.missing_codes?.[index] ?? '', label));

/** 「下载渠道」分组：CloudDrive2 与 PikPak 账号。 */
export function DownloadGroup({ initial, receipt, panel, issues }: {
  initial?: DownloadSettingsState;
  receipt(message: string): void;
  panel?: ConfigurationPanel;
  issues?: ReactNode;
}) {
  return (
    <div {...groupRoot(panel)}>
      {issues}
      {initial ? <DownloadSettings initial={initial} receipt={receipt} /> : null}
    </div>
  );
}

export function DownloadSettings({ initial, receipt }: {
  initial: DownloadSettingsState;
  receipt(message: string): void;
}) {
  const [state, setState] = useState(initial);
  // 账号框放在上面这一层：云下载卡要知道用户有没有在用 PikPak，没在用就不报 PikPak 根的提示。
  const [username, setUsername] = useState('');
  useEffect(() => {
    setState(current => ({ ...current, media_sources: initial.media_sources, pikpak_roots: initial.pikpak_roots }));
  }, [initial.media_sources, initial.pikpak_roots]);
  const sources = state.media_sources ?? [];
  const hasPikPak = sources.includes('pikpak');
  const hasCloud = sources.some(source => CLOUD_LOCATIONS.includes(source));
  const pikpakAccount = hasPikPak && (state.pikpak.logged_in || Boolean(username.trim()));
  return (
    <>
      {hasCloud ? <DownloadForm state={state} settle={setState} receipt={receipt} pikpakAccount={pikpakAccount} /> : null}
      {hasPikPak ? <PikPakAccount state={state} settle={setState} receipt={receipt} username={username} setUsername={setUsername} /> : null}
      <JavBrowserSettings receipt={receipt} refreshKey={JSON.stringify([
        state.media_sources, state.config, state.token_set, state.pikpak.logged_in,
      ])} />
    </>
  );
}

interface CardProps {
  state: DownloadSettingsState;
  settle(next: DownloadSettingsState): void;
  receipt(message: string): void;
}

function DownloadForm({ state, settle, receipt, pikpakAccount }: CardProps & { pikpakAccount: boolean }) {
  const [config, setConfig] = useState<DownloadConfig>(state.config);
  const [token, setToken] = useState('');
  const [hours, setHours] = useState(String(state.config.wait_hours));
  const [report, setReport] = useState<DownloadCheckReport | null>(null);
  const [detected, setDetected] = useState('');
  const [suggested, setSuggested] = useState<Suggestions>(NO_SUGGESTIONS);
  const [failure, setFailure] = useState('');
  const [saveBlocked, setSaveBlocked] = useState(false);
  const action = useAction();
  const sources = state.media_sources ?? [];
  const has115 = sources.includes('115');
  const hasPikPak = sources.includes('pikpak');
  const target = (key: '115' | 'pikpak') => config.targets[key] ?? '';
  const setTarget = (key: '115' | 'pikpak', value: string) =>
    setConfig({ ...config, targets: { ...config.targets, [key]: value } });
  // 检查标为不存在、用户也没改过的那个目录，存下来提交时只会报「没有这个文件夹」。
  const missing = has115 && Boolean(suggested.target && !suggested.target.exists && target('115') === suggested.target.path);

  // 把一份检查报告落到表单上：留空的地址、115 目标目录与 PikPak 根填建议值，用户填过的不覆盖。
  // `saved` 是服务端保存时已经存上的 115 目标目录，它不再填回、也不再说「保存配置后生效」。
  const show = (next: DownloadCheckReport, blank: Blanks, saved = '') => {
    const folder = blank.target ? next.suggested_target : null;
    const stored = Boolean(folder && saved && folder.path === saved);
    const root = blank.root ? next.suggested_pikpak_root : '';
    setConfig((current) => ({
      ...current,
      clouddrive_address: blank.address && next.address ? next.address : current.clouddrive_address,
      targets: folder && !stored ? { ...current.targets, '115': folder.path } : current.targets,
      pikpak_root: root || current.pikpak_root,
    }));
    setReport(next);
    setDetected(blank.address ? next.address : '');
    setSuggested({ target: folder, root, saved: stored });
    setSaveBlocked(false);
    setFailure('');
  };

  // 地址和令牌都已保存时，卡片一打开就按已保存的配置查一遍；令牌只在服务端取，不经页面。
  useEffect(() => {
    if (!state.available || !state.config.clouddrive_address || !state.token_set) return;
    const blank = { address: false, target: !state.config.targets['115'], root: !state.config.pikpak_root };
    void action.run('auto', (signal) => apiGet<DownloadCheckReport>(CHECK_URL, signal),
      (next) => show(next, blank), (cause) => setFailure(errorMessage(cause)));
    // 只在挂载时查这一次，之后由「保存配置」与「检查」接手。
  }, []);

  // 保存的响应里带着按已保存配置做的检查报告，直接渲染；115 目标目录留空时服务端已按推送发现填上。
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (missing) {
      setSaveBlocked(true);
      return;
    }
    const blankTarget = !target('115').trim();
    const body = { ...config, wait_hours: hours, token, pikpak_account: pikpakAccount };
    void action.run('save', (signal) => apiSend<DownloadSaveResult>(DOWNLOADS_URL, body, 'POST', signal),
      (next) => {
        const { report: checked, ...settings } = next;
        settle(settings);
        setConfig(settings.config);
        setHours(String(settings.config.wait_hours));
        setToken('');
        if (checked) {
          show(checked, { address: !settings.config.clouddrive_address, target: blankTarget,
            root: !settings.config.pikpak_root }, settings.config.targets['115'] ?? '');
        } else {
          setReport(null);
          setDetected('');
          setSuggested(NO_SUGGESTIONS);
          setSaveBlocked(false);
          setFailure('');
        }
        receipt(t('settings:shared.settingsSaved'));
      }, (cause) => setFailure(errorMessage(cause)));
  };

  // 「检查」按此刻填的值重查：地址留空时服务端探测本机端口，目录留空时按推送发现推建议值。
  const check = () => {
    const blank = { address: !config.clouddrive_address.trim(), target: !target('115').trim(),
      root: !config.pikpak_root };
    const body = { clouddrive_address: config.clouddrive_address, token, target: target('115'),
      pikpak_root: config.pikpak_root, pikpak_account: pikpakAccount };
    void action.run('check', (signal) => apiSend<DownloadCheckReport>(CHECK_URL, body, 'POST', signal),
      (next) => show(next, blank), (cause) => setFailure(errorMessage(cause)));
  };

  // 只在用户点了「新建这个目录」时调 CloudDrive2 建目录，建好后服务端按这个目录再检查一遍。
  const create = (path: string) => {
    const body = { clouddrive_address: config.clouddrive_address, token, path, pikpak_root: config.pikpak_root,
      pikpak_account: pikpakAccount };
    void action.run('folder', (signal) => apiSend<DownloadCheckReport>(FOLDER_URL, body, 'POST', signal),
      (next) => {
        setReport(next);
        setSuggested((current) => ({ ...current, target: { path, exists: true } }));
        setSaveBlocked(false);
        setFailure('');
        receipt(t('settings:cloudDownload.directoryCreated'));
      }, (cause) => setFailure(errorMessage(cause)));
  };

  return (
    <Section guide="download" title={t('settings:cloudDownload.title')} onSubmit={submit}>
      {state.problems?.length ? <Stack><Note tone="error" title={t('settings:cloudDownload.needsAttention')}>{problemTexts(state).join('\n')}</Note></Stack> : null}
      <Stack>
        <Input label={t('settings:cloudDownload.cloudDriveUrl')} placeholder={t('settings:cloudDownload.addressPlaceholder')} autoComplete="off" maxLength={200}
          value={config.clouddrive_address} isDisabled={!state.available}
          onChange={(value) => setConfig({ ...config, clouddrive_address: value })} />
        <Input label={t('settings:cloudDownload.apiToken')} type="password" autoComplete="off" maxLength={400}
          placeholder={state.token_set ? t('settings:shared.savedLeaveBlank') : t('settings:cloudDownload.tokenPlaceholder')}
          hint={t('settings:cloudDownload.apiTokenHelp')}
          value={token} isDisabled={!state.available} onChange={setToken} />
        {has115 ? <Input label={<SourceLabel source="115" label={t('settings:cloudDownload.target115')} />} placeholder={t('settings:cloudDownload.targetPlaceholder')} autoComplete="off" maxLength={300}
          validationBehavior="aria" isInvalid={missing}
          hint={missing ? (saveBlocked ? t('settings:cloudDownload.createOrPick') : t('settings:cloudDownload.directoryMissing')) : t('settings:cloudDownload.target115Help')}
          value={target('115')} isDisabled={!state.available} onChange={(value) => setTarget('115', value)} /> : null}
        {hasPikPak ? <><Input label={<SourceLabel source="pikpak" label={t('settings:cloudDownload.targetPikpak')} />} placeholder={t('settings:cloudDownload.pikpakPathPlaceholder')} autoComplete="off" maxLength={300}
          hint={t('settings:cloudDownload.targetPikpakHelp')}
          value={target('pikpak')} isDisabled={!state.available} onChange={(value) => setTarget('pikpak', value)} />
        <div className="flex flex-col gap-1">
          <FieldLabel><SourceLabel source="pikpak" label={t('settings:cloudDownload.pikpakRootDirectory')} /></FieldLabel>
          {state.pikpak_roots.length ? (
            /* 根目录只给登录后的 PikPak 直连与 PikPak 任务落地用：没登录、也没填账号时变灰。
               上面的目标目录经 CloudDrive 转存时也要用，不跟着变灰。 */
            <Select aria-label={t('settings:cloudDownload.pikpakRootDirectory')} selectedKey={config.pikpak_root || null}
              isDisabled={!state.available || !pikpakAccount} placeholder={t('settings:cloudDownload.rootPlaceholder')}
              onSelectionChange={(key) => setConfig({ ...config, pikpak_root: key === null ? '' : String(key) })}>
              {state.pikpak_roots.map((root) => <SelectItem key={root} id={root}>{root}</SelectItem>)}
            </Select>
          ) : (
            <Help>{t('settings:cloudDownload.addPikpakMount')}</Help>
          )}
        </div></> : null}
        <Input label={t('settings:cloudDownload.maxWait')} type="number" inputMode="numeric" autoComplete="off"
          hint={t('settings:cloudDownload.waitHint', { max: state.max_wait_hours })}
          value={hours} isDisabled={!state.available} onChange={setHours} />
      </Stack>
      {action.busy === 'auto' ? <Stack divided><ActivityStatus kind="radar" label={t('settings:cloudDownload.checking')} /></Stack> : null}
      {report ? (
        <CheckReport report={report} detected={detected} suggested={suggested}
          create={state.available ? create : undefined} creating={action.busy === 'folder'} />
      ) : null}
      {failure || action.error ? <Stack divided><ErrorText>{failure || action.error}</ErrorText></Stack> : null}
      <Footer status={state.available ? undefined : t('settings:cloudDownload.primaryOnly')}>
        <Button variant="secondary" onClick={check} disabled={!state.available} {...busyProps(action.busy === 'check')}>{t('settings:cloudDownload.testConnection')}</Button>
        <Button type="submit" disabled={!state.available} {...busyProps(action.busy === 'save')}>{t('settings:shared.saveSettings')}</Button>
      </Footer>
    </Section>
  );
}

/** 这一次检查推出的建议值。目标目录不存在时也填回去，表单把它标成无效；`saved` 为真时目标目录
 *  已经由保存配置存上。 */
interface Suggestions {
  target: DownloadCheckReport['suggested_target'];
  root: string;
  saved: boolean;
}

const NO_SUGGESTIONS: Suggestions = { target: null, root: '', saved: false };

/** 哪些字段留空，留空的才填建议值。 */
interface Blanks {
  address: boolean;
  target: boolean;
  root: boolean;
}

function CheckReport({ report, detected, suggested, create, creating }: {
  report: DownloadCheckReport;
  detected: string;
  suggested: Suggestions;
  create?: (path: string) => void;
  creating: boolean;
}) {
  const folder = suggested.target;
  const hasFacts = Boolean(detected || folder || suggested.root || report.permissions.length || report.folder || report.quota);
  if (!hasFacts && !report.problems.length) return null;
  return (
    <Stack divided>
      {hasFacts ? <FactList>
        {detected ? <Fact term={t('settings:cloudDownload.cloudDriveUrl')}>{t('settings:cloudDownload.detectedAddress', { address: detected })}</Fact> : null}
        {folder?.exists ? (
          <Fact term={<SourceLabel source="115" label={t('settings:cloudDownload.target115')} />}>
            {suggested.saved ? t('settings:cloudDownload.filledSaved', { path: folder.path }) : t('settings:cloudDownload.filledPending', { path: folder.path })}
          </Fact>
        ) : null}
        {folder && !folder.exists ? (
          <Fact term={<SourceLabel source="115" label={t('settings:cloudDownload.target115')} />}>
            {t('settings:cloudDownload.pathMissing', { path: folder.path })}
            {create ? <Button variant="secondary" size="small" onClick={() => create(folder.path)} {...busyProps(creating)}>{t('settings:cloudDownload.createDirectory')}</Button> : null}
          </Fact>
        ) : null}
        {suggested.root ? <Fact term={<SourceLabel source="pikpak" label={t('settings:cloudDownload.pikpakRoot')} />}>{t('settings:cloudDownload.filledPending', { path: suggested.root })}</Fact> : null}
        {report.permissions.length ? (
          <Fact term={t('settings:cloudDownload.offlinePermissions')}>
            {report.missing.length
              ? missingTexts(report).map(permission => <Chip key={permission} variant="caption" color="yellow">{t('settings:cloudDownload.missingPermission', { permission })}</Chip>)
              : <Chip variant="caption" color="lime">{t('settings:cloudDownload.permissionsComplete')}</Chip>}
          </Fact>
        ) : null}
        {report.folder ? (
          <Fact term={t('settings:cloudDownload.targetDirectory')}>{report.folder.can_offline ? t('settings:cloudDownload.offlineSupported', { path: report.folder.path }) : t('settings:cloudDownload.offlineUnsupported', { path: report.folder.path })}</Fact>
        ) : null}
        {report.quota ? (
          <Fact term={<SourceLabel source="115" label={t('settings:cloudDownload.quota115')} />}>{t('settings:cloudDownload.quotaLeft', { count: report.quota.left, total: report.quota.total })}</Fact>
        ) : null}
      </FactList> : null}
      {problemTexts(report).map((problem) => <ErrorText key={problem}>{problem}</ErrorText>)}
    </Stack>
  );
}

/** PikPak 账号卡。主路径是「用浏览器登录」（ADR-0093）：服务端拉起一个 Peach 专用的浏览器窗口，
 *  用户在里面登录，Peach 取走网页端会话后关窗，之后只由 Peach 续期。这里拉起后每两秒读一次状态，
 *  直到登好、取消、超时或失败。账号密码表单直接显示，登录方式在底栏选择。 */
function PikPakAccount({ state, settle, receipt, username, setUsername }: CardProps & {
  username: string;
  setUsername(value: string): void;
}) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [failure, setFailure] = useState('');
  // 只报这一页里拉起的那次登录怎么收场；服务端留着的上一次结果不当成新消息。
  const [outcome, setOutcome] = useState('');
  const action = useAction();
  const account = state.pikpak;
  const browser = state.pikpak_browser;
  const waiting = browser.state === 'waiting';

  /* 等浏览器里那次登录：两秒读一次，读失败退避，页面不可见时暂停，等满上限就停。 */
  useEffect(() => {
    if (!waiting) return;
    const controller = new AbortController();
    void pollUntil({
      signal: controller.signal, everyMs: POLL_MS, limitMs: BROWSER_LOGIN_LIMIT_MS,
      read: (signal) => apiGet<DownloadSettingsState>(BROWSER_URL, signal),
      apply: (next) => {
        settle(next);
        if (next.pikpak_browser.state === 'done') receipt(t('settings:pikpakAccount.signedInReceipt'));
        else if (next.pikpak_browser.state !== 'waiting') setOutcome(jobText(next.pikpak_browser));
      },
      done: (next) => next.pikpak_browser.state !== 'waiting',
      failed: (cause) => setFailure(errorMessage(cause)),
    });
    return () => controller.abort();
  }, [waiting]);

  const openBrowser = () => {
    setOutcome('');
    void action.run('browser', (signal) => apiSend<DownloadSettingsState>(BROWSER_URL, {}, 'POST', signal),
      (next) => { settle(next); setFailure(''); }, (cause) => setFailure(errorMessage(cause)));
  };

  const cancelBrowser = () => {
    void action.run('cancel', (signal) => apiSend<DownloadSettingsState>(`${BROWSER_URL}/cancel`, {}, 'POST', signal),
      (next) => { settle(next); setFailure(''); setOutcome(jobText(next.pikpak_browser)); },
      (cause) => setFailure(errorMessage(cause)));
  };

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (account.logged_in) return;
    const body = { username, password, remember };
    void action.run('login', (signal) => apiSend<PikPakLoginResult>(LOGIN_URL, body, 'POST', signal),
      (result) => {
        settle(result.settings);
        setFailure('');
        if (!result.ok) {
          setCaptcha(result.captcha_url ?? '');
          return;
        }
        setCaptcha('');
        setPassword('');
        receipt(t('settings:pikpakAccount.signedInReceipt'));
      }, (cause) => setFailure(errorMessage(cause)));
  };

  const logout = () => {
    void action.run('logout', (signal) => apiSend<DownloadSettingsState>(LOGOUT_URL, {}, 'POST', signal),
      (next) => { settle(next); setFailure(''); receipt(t('settings:pikpakAccount.signedOutReceipt')); },
      (cause) => setFailure(errorMessage(cause)));
  };

  const passwordForm = (
    <>
      <Input label={t('settings:shared.account')} placeholder={t('settings:pikpakAccount.usernamePlaceholder')} autoComplete="username" maxLength={200}
        value={username} isDisabled={!state.available} onChange={setUsername} />
      <Input label={t('settings:shared.password')} type="password" autoComplete="current-password" maxLength={200}
        value={password} isDisabled={!state.available} onChange={setPassword} />
      <Checkbox isSelected={remember} isDisabled={!state.available} onChange={setRemember}>
        {t('settings:pikpakAccount.rememberPassword')}
      </Checkbox>
      {captcha ? (
        <Note tone="warning" title={t('settings:pikpakAccount.captchaTitle')}
          extra={<div className="pt-2"><ExternalLink href={captcha}>{t('settings:pikpakAccount.openCaptcha')}</ExternalLink></div>}>
          {t('settings:pikpakAccount.captchaHelp')}
        </Note>
      ) : null}
    </>
  );
  const passwordLogin = (
    <Button type="submit" variant="primary" disabled={!state.available || waiting} {...busyProps(action.busy === 'login')}>{t('settings:shared.signIn')}</Button>
  );
  const outcomeFailed = browser.state === 'timeout' || browser.state === 'failed';

  return (
    <Section guide="pikpak" title={t('settings:pikpakAccount.title')} icon={<PikPakIcon />} onSubmit={login}
      aside={<StatusLabel tone={account.logged_in ? 'success' : waiting ? 'progress' : outcomeFailed ? 'error' : 'neutral'}>
        {account.logged_in ? t('settings:pikpakAccount.signedIn') : waiting ? t('settings:pikpakAccount.waiting') : outcomeFailed ? t('settings:pikpakAccount.incomplete') : t('settings:pikpakAccount.notSignedIn')}</StatusLabel>}>
      {account.logged_in ? (
        <FactList>
          <Fact term={t('settings:shared.account')}>{account.username || t('settings:pikpakAccount.signedIn')}</Fact>
          {account.method === 'browser' ? (
            <Fact term={t('settings:pikpakAccount.method')}>{t('settings:pikpakAccount.browserMethod')}</Fact>
          ) : (
            <Fact term={t('settings:shared.password')}>{account.remember ? t('settings:pikpakAccount.passwordSaved') : t('settings:pikpakAccount.passwordNotSaved')}</Fact>
          )}
        </FactList>
      ) : (
        <Stack>
          {outcome ? (outcomeFailed ? <ErrorText>{outcome}</ErrorText> : <Help role="status">{outcome}</Help>) : null}
          {passwordForm}
        </Stack>
      )}
      {failure || action.error ? <Stack divided><ErrorText>{failure || action.error}</ErrorText></Stack> : null}
      <Footer status={!account.logged_in && waiting
        ? <ActivityStatus kind="clock" label={jobText(browser) || t('settings:pikpakAccount.waitingBrowser')} /> : null}>
        {account.logged_in ? (
          <Button variant="secondary" onClick={logout} disabled={!state.available} {...busyProps(action.busy === 'logout')}>{t('settings:shared.signOut')}</Button>
        ) : <>{!browser.available ? null : waiting ? (
          <Button variant="secondary" type="button" onClick={cancelBrowser} {...busyProps(action.busy === 'cancel')}>{t('settings:shared.cancel')}</Button>
        ) : (
          <Button variant="secondary" type="button" onClick={openBrowser} disabled={!state.available}
            {...busyProps(action.busy === 'browser')}>{t('settings:pikpakAccount.browserSignIn')}</Button>
        )}{passwordLogin}</>}
      </Footer>
    </Section>
  );
}
