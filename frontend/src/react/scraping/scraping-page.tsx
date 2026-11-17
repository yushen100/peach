/* 来源和凭证页：每个采集来源怎么连、拿什么身份连，外加一趟按番号补高清封面。
 *
 * 这是第一个带写操作的 React 档，两件事在这里定型：
 * - **写操作是 `useMutation`**，不进 Query 的缓存节律。保存成功后用 `setQueryData` 把服务端
 *   回的那一条换进列表，而不是把整页重取一遍：用户可能正在填另一张卡，重取会把它一起重画。
 *   失败只在卡内留一句原因，缓存里的上一份数据不动。
 * - **后台任务走 `useBackgroundJob`**：跑起来两秒一次，停了就不问，首屏读到的旧终态不冒充
 *   新结果。轮询跟着组件走，遗留壳换页时卸根，它自己就停了。 */
import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { RiArrowRightLine } from '@remixicon/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Radio } from 'react-aria-components';

import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Button } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '@/components/base/select/select';

import { apiSend, errorMessage } from '../../api';
import { momentText } from '../activity/tasks';
import { useBackgroundJob } from '../background-job';
import type { ScrapingProps } from '../bundle';
import { IssueRow } from '../components/issue-row';
import { TaskProgress } from '../components/task-progress';
import { activityKind } from '../../activity-kinds';
import { Note } from '../components/note';
import { StatusLabel, type StatusTone } from '../components/status-label';
import { ConnectionStatus } from '../components/connection-status';
import { Page } from '../components/page';
import { SiteMark } from '../components/site-mark';
import { SectionToc } from '../components/section-toc';
import { SEGMENT, SEGMENTED_TRACK, SegmentedRadioGroup as RadioGroup } from '../components/segmented';
import { queryClient } from '../query';
import {
  Disclosure, ErrorText, ExternalLink, Fact, FactList, FieldLabel, Footer, Help, Rows, Section, Stack,
} from '../settings/section';
import { busyProps } from '../settings/use-action';
import { CustomSources } from './custom-sources';
import {
  AMANE_BRIDGE_CHECK_URL, AMANE_BRIDGE_KEY, AMANE_BRIDGE_REBUILD_URL, CHECK_ALL_KEY,
  checkText, COOKIE_TEXT_LIMIT, COVER_JOB_KEY, fetchAmaneBridge, fetchCheckAllJob, fetchCoverJob,
  fetchSources, SCRAPING_CHECK_ALL_URL, SCRAPING_CHECK_URL, SCRAPING_COVER_URL, SCRAPING_KEY,
  SCRAPING_SETTINGS_URL, type AmaneBridge, type Check, type CheckAllJob, type CheckOutcome,
  type CoverJob, type ReportedCheck, type ScrapingData, type Source, type SourceReport,
} from './scraping';
import { codedText, jobText, partsLabel, serverLabel } from '../../core/server-text';
import { interfaceLanguage, joinList, t } from '../../i18n';

const NETWORKS = [['peach', t('manage:customSources.peachProxy')], ['direct', t('manage:sourceSettings.direct')]] as const;

/** 连接方式的选项。数据库里存着这两种以外的值（旧版写下的、手改的）时把它原样列成一项，
 *  下拉框照实显示现在是什么，不落到空占位上。 */
export function networkOptions(current: string): (readonly [string, string])[] {
  return NETWORKS.some(([key]) => key === current) || !current ? [...NETWORKS] : [...NETWORKS, [current, current]];
}

/** 登录页外链只写主机名：整条地址在窄屏上会把分区标题挤成一字一行，路径也说明不了是哪个站。 */
export function linkHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
const COOKIE_METHODS = [['paste', t('manage:sourceSettings.pasteCookie')], ['file', t('manage:sourceSettings.uploadFile')]] as const;

function GitHubMark() {
  return <SiteMark source="github" />;
}

/** 一个来源一张卡：怎么连、拿什么身份连，底下三个动作。 */
function SourceCard({ source, toast }: { source: Source } & ScrapingProps) {
  const [network, setNetwork] = useState(source.network);
  const [cookie, setCookie] = useState('');
  const [cookieText, setCookieText] = useState('');
  const [method, setMethod] = useState<string>(COOKIE_METHODS[0][0]);
  const [fileName, setFileName] = useState('');
  const [fileProblem, setFileProblem] = useState('');
  const file = useRef<HTMLInputElement>(null);

  /* 秘密只在提交那一刻存在于页面上：保存回来之后输入框清空，页面上不再留着刚交上去的
     那一份。文件选择器自己也要清，否则同名文件再选一次不会触发 change。 */
  function forgetSecrets() {
    setCookie('');
    setCookieText('');
    setFileName('');
    setFileProblem('');
    if (file.current) file.current.value = '';
  }

  const save = useMutation({
    mutationFn: (revoke: boolean) => apiSend<{ saved: Source }>(SCRAPING_SETTINGS_URL, {
      source: source.source, network, cookie, cookies_text: cookieText, revoke,
    }),
    onSuccess: (result, revoke) => {
      // 服务端回的就是这一条的新样子，换进列表即可，不为一次保存把整页重取一遍。
      queryClient.setQueryData<ScrapingData>(SCRAPING_KEY, (current) => current && {
        ...current,
        sources: current.sources.map(
          (row) => (row.source === result.saved.source ? result.saved : row)),
      });
      forgetSecrets();
      toast(revoke ? t('manage:sourceSettings.cookieRevoked') : t('manage:sourceSettings.saved'));
    },
  });
  const check = useMutation({
    mutationFn: () => apiSend<{ results: Check[] }>(SCRAPING_CHECK_URL, { source: source.source }),
  });
  // 一张卡上三个动作互斥：它们改的是同一份凭据，谁先落地都会让另一次的结果说不清楚。
  const busy = save.isPending || check.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    check.reset();
    save.mutate(false);
  };
  const revoke = () => {
    if (busy) return;
    check.reset();
    save.mutate(true);
  };
  const connect = () => {
    if (busy) return;
    save.reset();
    check.mutate();
  };

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = input.files?.[0];
    setCookieText('');
    setFileProblem('');
    if (!selected) {
      setFileName('');
      return;
    }
    if (selected.size > COOKIE_TEXT_LIMIT) {
      // 超限的多半根本不是 Cookie 文件。在浏览器里就拦住，不拿它去占一次请求。
      input.value = '';
      setFileName('');
      setFileProblem(t('manage:sourceSettings.cookieTooLarge'));
      return;
    }
    try {
      const text = await selected.text();
      setCookieText(text);
      setFileName(selected.name);
    } catch {
      setFileProblem(t('manage:sourceSettings.cookieFileUnread'));
    }
  }

  const problem = fileProblem
    || (save.error ? errorMessage(save.error) : '')
    || (check.error ? errorMessage(check.error) : '');
  const results = check.data?.results ?? [];
  // 这一块空着时连同它那道分隔线一起不画：直连、又不收 Cookie 的来源只有一行连接方式。
  const detailed = network === 'peach' || source.accepts_cookie || source.browser || !!problem || results.length > 0;

  return (
    <Section id={`source-${source.source}`} title={codedText(source, 'label')} onSubmit={submit} aside={
      <span className="flex min-w-0 items-center gap-1">
        <SiteMark source={source.source} />
        {source.login ? <ExternalLink href={source.login}>{linkHost(source.login)}</ExternalLink> : null}
      </span>
    }>
      <Rows>
        <SettingsRow label={t('manage:sourceSettings.connectionMode')}>
          {/* 定宽：数据库里的长取值按内容撑宽会把左边的「连接方式」挤成竖排，定宽后取值在框里截断。 */}
          <Select aria-label={t('manage:sourceSettings.connectionMode')} className="w-44 min-w-0" selectedKey={network}
            onSelectionChange={(key) => { if (key !== null) setNetwork(String(key)) }}>
            {networkOptions(network).map(([key, name]) => <SelectItem key={key} id={key}>{name}</SelectItem>)}
          </Select>
        </SettingsRow>
      </Rows>
      {source.cooldown_until && source.cooldown_until > Date.now() / 1000 ? (
        <Note tone="warning"><span className="inline-flex flex-wrap items-center gap-2"><StatusLabel tone="warning">{t('manage:sourceSettings.coolingDown')}</StatusLabel><span>{t('manage:sourceSettings.retryAfter', { time: new Date(source.cooldown_until * 1000).toLocaleString(interfaceLanguage) })}</span></span></Note>
      ) : null}
      {detailed ? <Stack divided>
        {network === 'peach'
          ? <span className="self-start">
              <LinkButton href="/settings/library#peachProxy" size="small" trailingIcon={RiArrowRightLine}>
                {t('manage:sourceSettings.setUpProxy')}
              </LinkButton>
            </span>
          : null}
        {/* 由本机浏览器过验证的来源不收 Cookie：浏览器自己带着会话。留着「撤销 Cookie」让人清掉旧的。 */}
        {source.browser
          ? <p className="text-body-2-regular text-text-secondary">
              {t('manage:sourceSettings.browserVerification')}
            </p>
          : null}
        {source.accepts_cookie && !source.browser ? <>
          <div className="flex flex-col gap-2"><span className="self-start"><StatusLabel tone={source.cookie_saved ? 'success' : 'neutral'}>{source.cookie_saved ? t('manage:sourceSettings.cookieSaved') : t('manage:sourceSettings.cookieNotSet')}</StatusLabel></span>
            <p className="text-body-2-regular text-text-secondary">{source.cookie_saved ? t('manage:sourceSettings.signInUnverified') : t('manage:sourceSettings.provideCookieHint')}</p></div>
          {/* 两种方式互斥，交上去的只能是其中一种：切换时把另一种的输入清掉，
              不让看不见的那一份跟着提交。 */}
          <RadioGroup aria-label={t('manage:sourceSettings.cookieMethod')} value={method}
            onChange={(next) => { setMethod(next); forgetSecrets() }}
            className={SEGMENTED_TRACK}>
            {COOKIE_METHODS.map(([value, label]) => (
              <Radio key={value} value={value} className={SEGMENT}>
                {label}
              </Radio>
            ))}
          </RadioGroup>
          {method === 'paste'
            ? <Input type="password" label="Cookie" autoComplete="off" value={cookie} onChange={setCookie} />
            : <div className="flex flex-col gap-2">
                <FieldLabel>{t('manage:sourceSettings.cookieFileLabel')}</FieldLabel>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={() => file.current?.click()}>{t('manage:sourceSettings.chooseFile')}</Button>
                  <span className="min-w-0 text-body-2-regular break-all text-text-secondary">
                    {fileName || t('manage:sourceSettings.noFileChosen')}
                  </span>
                </div>
                {/* 原生文件选择器长相不可控，按钮归 BoardUI，输入框只留着接文件。 */}
                <input ref={file} type="file" accept=".txt" tabIndex={-1} aria-hidden
                  className="hidden" onChange={(event) => { void pickFile(event) }} />
              </div>}
        </> : null}
        {problem ? <ErrorText>{problem}</ErrorText> : null}
        {results.map((result) => {
          const tone = result.kind === 'unchecked' ? 'neutral' : result.ok ? 'success' : 'error';
          const status = result.kind === 'unchecked' ? t('manage:sourceSettings.unchecked')
            : result.ok ? t('manage:sourceSettings.reachable') : t('manage:sourceSettings.connectionFailed');
          return <Note key={result.label} tone={tone}>
            <span className="flex flex-col items-start gap-1"><ConnectionStatus tone={tone}>{status}</ConnectionStatus><span>{checkText(result, codedText(source, 'label'))}</span></span>
          </Note>;
        })}
      </Stack> : null}
      {/* 主体动作在最右。次级动作先出现，`保存` 是这张卡唯一的写入，放在一行的末尾；
          表单里只有它一个 `type=submit`，所以挪位置不影响回车提交。 */}
      <Footer>
        {source.accepts_cookie && source.cookie_saved
          ? <Button variant="secondary" onClick={revoke} {...busyProps(busy)}>{t('manage:sourceSettings.revokeCookie')}</Button>
          : null}
        <Button variant="secondary" onClick={connect} {...busyProps(busy)}>{t('manage:sourceSettings.testConnection')}</Button>
        <Button type="submit" {...busyProps(busy)}>{t('manage:shared.save')}</Button>
      </Footer>
    </Section>
  );
}

/** 报告口径的着色：要人去处理的标黄，连不上的标红，片商官网那种不在这里查的标灰。 */
const OUTCOME_TONES: Record<CheckOutcome, StatusTone> = {
  ok: 'success', auth: 'warning', http: 'error', cooldown: 'warning', network: 'error', skipped: 'neutral',
};
/** 摘要里各口径的先后：先可连接，再按要人动手的程度排。 */
const OUTCOME_ORDER: CheckOutcome[] = ['ok', 'auth', 'cooldown', 'http', 'network', 'skipped'];

/** 一项检查的名字：只查一跳的来源就是它本身。 */
function targetName(report: SourceReport, check: ReportedCheck): string {
  const source = codedText(report, 'label');
  return check.target === 'cdn' ? t('manage:connectionCheck.hdImages', { source }) : source;
}

/** 全部来源一次检查完，与 `peach check-sources` 同一检查、同一报告口径。这一趟在后台跑，
 *  离开页面再回来，读到的是服务端留着的那一份结果。 */
function CheckAllCard({ toast }: ScrapingProps) {
  const { job, running, start, query: taskQuery } = useBackgroundJob<CheckAllJob>({
    queryKey: CHECK_ALL_KEY,
    queryFn: ({ signal }) => fetchCheckAllJob(signal),
    start: () => apiSend<CheckAllJob>(SCRAPING_CHECK_ALL_URL, {}),
    onFinish: (state) => {
      // 限流与拒绝访问会记下冷却，各来源卡上的「冷却中」跟着重读。
      void queryClient.invalidateQueries({ queryKey: SCRAPING_KEY, exact: true });
      if (state.status === 'complete') toast(state.failed ? t('manage:connectionCheck.doneWithFailures', { count: state.failed }) : t('manage:connectionCheck.doneAllReachable'));
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taskQuery.data || running || start.isPending) return;
    start.mutate();
  };

  const checks = (job?.results ?? []).flatMap(
    (report) => report.results.map((check) => ({ source: report.source, name: targetName(report, check), check })));
  // 站标跟名字走，同来源卡标题旁的那一枚。
  const titled = (source: string, name: string) =>
    <span className="inline-flex min-w-0 items-center gap-1.5"><SiteMark source={source} />{name}</span>;
  const passed = checks.filter(({ check }) => check.outcome === 'ok');
  // 按口径成组，组内保持来源顺序：要人去登录的排前面，不在这里查的片商官网垫底。
  const problems = checks.filter(({ check }) => check.outcome !== 'ok').sort(
    (a, b) => OUTCOME_ORDER.indexOf(a.check.outcome) - OUTCOME_ORDER.indexOf(b.check.outcome));
  const problem = start.error ? errorMessage(start.error)
    : taskQuery.error ? errorMessage(taskQuery.error)
    : job?.status === 'failed' ? (jobText(job, 'error') || t('manage:connectionCheck.notFinished')) : '';
  const finished = job?.status === 'complete' && job.completed_at
    ? [momentText(new Date(job.completed_at * 1000).toISOString()),
       job.elapsed_s !== undefined ? t('manage:connectionCheck.elapsed', { seconds: job.elapsed_s.toFixed(1) }) : ''].filter(Boolean).join(' · ')
    : '';

  return (
    <Section id="check-all" title={t('manage:connectionCheck.title')} onSubmit={submit}>
      <Stack>
        {taskQuery.isPending ? <div role="status" aria-label={t('manage:connectionCheck.loadingStatus')} data-skeleton="" className="skeleton-sheen h-6 rounded-md" /> : null}
        {/* 说明写在一行里：拆行的 JSX 文本渲染时多出空格，改字工具就对不上源码。 */}
        <Help>{t('manage:connectionCheck.help')}</Help>
        {running
          ? <TaskProgress embedded kind="radar" value={job?.checked ?? 0} total={job?.total ?? 0}
              label={t('manage:connectionCheck.checkedCount', { checked: job?.checked ?? 0, count: job?.total ?? 0 })} />
          : null}
        {problem ? <Note tone="error">{problem}</Note> : null}
        {checks.length
          ? <div className="flex flex-wrap gap-2">
              {OUTCOME_ORDER.map((key) => {
                const count = checks.filter(({ check }) => check.outcome === key).length;
                return count ? <StatusLabel key={key} tone={OUTCOME_TONES[key]}>
                  {codedText(checks.find(({ check }) => check.outcome === key)?.check, 'outcome_label')} {count}
                </StatusLabel> : null;
              })}
            </div>
          : null}
        {problems.length
          ? <ul className="flex min-w-0 flex-col">
              {problems.map(({ source, name, check }) => (
                <IssueRow key={name} title={titled(source, name)}>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusLabel tone={OUTCOME_TONES[check.outcome]}>{codedText(check, 'outcome_label')}</StatusLabel>
                    {check.message
                      ? <span className="text-body-2-regular text-text-secondary">{codedText(check, 'message')}</span>
                      : null}
                  </span>
                </IssueRow>
              ))}
            </ul>
          : null}
        {passed.length
          ? <Disclosure summary={t('manage:connectionCheck.reachableCount', { count: passed.length })}>
              <FactList>
                {passed.map(({ source, name, check }) => (
                  <Fact key={name} term={titled(source, name)}>
                    {[check.width ? `${check.width} × ${check.height}` : '',
                      check.elapsed_s !== undefined ? t('manage:connectionCheck.seconds', { seconds: check.elapsed_s.toFixed(2) }) : ''].filter(Boolean).join(' · ')}
                  </Fact>
                ))}
              </FactList>
            </Disclosure>
          : null}
      </Stack>
      <Footer status={finished ? t('manage:connectionCheck.lastChecked', { time: finished }) : undefined}>
        <Button type="submit" disabled={!taskQuery.data} {...busyProps(running || start.isPending)}>{t('manage:connectionCheck.checkAll')}</Button>
      </Footer>
    </Section>
  );
}

/** 封面任务成功那一句。 */
const coverResult = (job: CoverJob) => serverLabel(job.result_code ?? '', job.result ?? '', job.result_params);

/** 封面任务失败那一句：由几段拼成的逐段取译文，缺一段译文就整句用服务端原文。 */
const coverFailure = (job: CoverJob): string => partsLabel(job.error_parts, jobText(job, 'error'));

/** 按番号补一张高清封面。这一趟在后台跑，页面上留状态。 */
function CoverCard({ toast }: ScrapingProps) {
  const [code, setCode] = useState('');
  const { running, outcome, start, query: taskQuery } = useBackgroundJob<CoverJob>({
    queryKey: COVER_JOB_KEY,
    queryFn: ({ signal }) => fetchCoverJob(signal),
    start: () => apiSend<CoverJob>(SCRAPING_COVER_URL, { code }),
    onFinish: (state) => {
      if (state.status === 'complete') toast(coverResult(state) || t('manage:hdCover.fetched'));
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taskQuery.data || running || start.isPending || !code.trim()) return;
    start.mutate();
  };

  const problem = start.error ? errorMessage(start.error)
    : taskQuery.error ? errorMessage(taskQuery.error)
    : outcome?.status === 'failed' ? (coverFailure(outcome) || t('manage:hdCover.notFound')) : '';
  return (
    <Section id="hd-cover" title={t('manage:hdCover.title')} onSubmit={submit}>
      <Stack>
        {taskQuery.isPending ? <div role="status" aria-label={t('manage:hdCover.loadingStatus')} data-skeleton="" className="skeleton-sheen h-6 rounded-md" /> : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input aria-label={t('manage:hdCover.codeLabel')} isRequired isDisabled={running} value={code} onChange={setCode}
              placeholder={t('manage:hdCover.codePlaceholder')} />
          </div>
            <Button type="submit" disabled={!taskQuery.data || !code.trim()} {...busyProps(running || start.isPending)}>
            {t('manage:hdCover.fetchCover')}
          </Button>
        </div>
        {/* 这一趟要挨个问几家站点、还可能走代理，没有可数的总量，也不能编一个百分比出来。
            关掉页面它照样在跑，回来能接上，所以状态得留在页面上，而不是只让按钮转一下。 */}
        {running ? <TaskProgress embedded kind={activityKind('scraping-cover')} label={t('manage:hdCover.fetching')} /> : null}
        {problem ? <Note tone="error">{problem}</Note> : null}
        {outcome?.status === 'complete'
          ? <Note tone="success">{coverResult(outcome) || t('manage:hdCover.fetched')}</Note>
          : null}
      </Stack>
    </Section>
  );
}

/** amane 桥：钉在哪个 revision、venv 建没建、上游最新到哪。升级是人读 diff 之后改清单，
 *  这张卡只做两件事：问一下上游最新版，和按钉住的版本重建 venv。 */
function AmaneBridgeCard({ toast }: ScrapingProps) {
  const { query: bridge, running, outcome, start: rebuild } = useBackgroundJob<CoverJob, void, AmaneBridge>({
    queryKey: AMANE_BRIDGE_KEY,
    queryFn: ({ signal }) => fetchAmaneBridge(signal),
    start: () => apiSend<CoverJob>(AMANE_BRIDGE_REBUILD_URL, {}),
    // 这个键缓存的是整张卡，这一趟的快照只换进 `job` 那一格。
    jobOf: (card) => card.job,
    withJob: (card, started) => card && { ...card, job: started },
    onFinish: (state) => {
      if (state.status === 'complete') toast(codedText(state, 'result') || t('manage:amaneRuntime.rebuilt'));
    },
  });
  const check = useMutation({
    mutationFn: () => apiSend<{ latest: string; latest_code?: string }>(AMANE_BRIDGE_CHECK_URL, {}),
  });

  const data = bridge.data;

  if (!data) {
    return bridge.error
      ? <Section id="amane" title="amane"><Stack><Note tone="error">{errorMessage(bridge.error)}</Note></Stack></Section>
      : null;
  }
  const busy = running || rebuild.isPending || check.isPending;
  const problem = rebuild.error ? errorMessage(rebuild.error)
    : check.error ? errorMessage(check.error)
    : outcome?.status === 'failed' ? (jobText(outcome, 'error') || t('manage:amaneRuntime.rebuildNotFinished')) : '';
  return (
    <Section id="amane" title="amane" aside={<ExternalLink href={data.repository} leadingIcon={GitHubMark}>{data.repository}</ExternalLink>}>
      <FactList>
        <Fact term={t('manage:amaneRuntime.installedVersion')}>{data.installed_version || t('manage:amaneRuntime.notInstalled')}</Fact>
        <Fact term={t('manage:amaneRuntime.latestVersion')}>{check.data ? codedText(check.data, 'latest') : t('manage:amaneRuntime.notChecked')}</Fact>
        <Fact term={t('manage:amaneRuntime.runtime')}>{data.installed ? t('manage:amaneRuntime.installed') : t('manage:amaneRuntime.notInstalled')}</Fact>
        <Fact term={t('manage:amaneRuntime.builtInSites')}>{t('manage:amaneRuntime.siteCount', { count: data.sites.length })}</Fact>
      </FactList>
      <Stack divided>
        {data.sites.length
          ? <Disclosure summary={t('manage:amaneRuntime.showSites')}>
              <p className="text-body-2-regular text-text-secondary">{joinList(data.sites.map((site) => codedText(site, 'label')))}</p>
            </Disclosure>
          : null}
        {data.problem
          ? <Note tone="error">{data.problem}</Note>
          : <Help>{t('manage:amaneRuntime.help', { license: data.license, version: data.version })}</Help>}
        {running ? <TaskProgress embedded kind={activityKind('amane-bridge')} label={t('manage:amaneRuntime.rebuilding')} /> : null}
        {problem ? <Note tone="error">{problem}</Note> : null}
        {outcome?.status === 'complete' ? <Note tone="success">{codedText(outcome, 'result') || t('manage:amaneRuntime.rebuilt')}</Note> : null}
      </Stack>
      <Footer>
        <Button variant="secondary" onClick={() => { if (!busy) check.mutate() }} {...busyProps(check.isPending)}>
          {t('manage:amaneRuntime.checkUpstream')}
        </Button>
        <Button disabled={Boolean(data.problem)} onClick={() => { if (!busy) rebuild.mutate() }}
          {...busyProps(running || rebuild.isPending)}>
          {data.installed ? t('manage:amaneRuntime.reinstall') : t('manage:amaneRuntime.install')}
        </Button>
      </Footer>
    </Section>
  );
}

export function ScrapingPage({ toast }: ScrapingProps) {
  const sources = useQuery({ queryKey: SCRAPING_KEY, queryFn: ({ signal }) => fetchSources(signal) });
  const data = sources.data;
  if (!data) {
    return (
      <Page>
        <Note tone="error" title={t('manage:scrapingSources.loadFailedTitle')}>
          {sources.error ? errorMessage(sources.error) : t('manage:scrapingSources.loadFailed')}
        </Note>
      </Page>
    );
  }
  return (
    <Page>
      <p className="text-body-2-regular text-text-secondary">{t('manage:scrapingSources.proxyHint')}</p>
      <SectionToc label={t('manage:scrapingSources.contents')} entries={[
        { id: 'check-all', label: t('manage:connectionCheck.title') },
        { id: 'hd-cover', label: t('manage:hdCover.title') },
        { id: 'custom-sources', label: t('manage:customSources.title') },
        ...(data.sources || []).map(source => ({ id: `source-${source.source}`,
          label: codedText(source, 'label'), icon: source.source === 'makers' ? undefined : <SiteMark source={source.source} /> })),
        { id: 'source-amane', label: 'amane' },
      ]}>
        <CheckAllCard toast={toast} />
        <CoverCard toast={toast} />
        <CustomSources receipt={toast} />
        {(data.sources || []).map(
          (source) => <SourceCard key={source.source} source={source} toast={toast} />)}
        <div id="source-amane"><AmaneBridgeCard toast={toast} /></div>
      </SectionToc>
    </Page>
  );
}
