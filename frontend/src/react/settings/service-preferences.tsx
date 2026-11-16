/* Peach 配置中的采集档位与来源更新偏好，读写复用设置接口和查询缓存。 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';

import { appSettingsStore } from '@peach/appearance';
import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Select, SelectItem } from '@/components/base/select/select';
import { Switch } from '@/components/base/switch/switch';
import { Input } from '@/components/base/input/input';
import { Button } from '@/components/base/buttons/button';

import { FOLLOW_INITIAL_RANGE_OPTIONS } from '../../application/initial-follow-ranges';
import { errorMessage } from '../../api';
import { boundedPreference } from '../../number-setting';
import { momentText } from '../activity/tasks';
import { Note } from '../components/note';
import {
  SCHEDULE_RUNS, SCHEDULES, SETTINGS_KEY, THUMBNAIL_JOBS_KEY, fetchSettings, fetchThumbnailJobs, schedulePollInterval,
  useRunSchedule, useSaveSchedule, useSaveSettings, useSaveThumbnailMode, type FollowScheduleStatus,
} from '../settings-panel/settings-data';
import { ErrorText, Rows, Section, Stack, TaskCenterLink } from './section';
import { TaskProgress } from '../components/task-progress';
import { activityKind } from '../../activity-kinds';
import { busyProps } from './use-action';
import { ProcessingMode } from '../library-processing/processing-effort';
import { t } from '../../i18n';

const THUMBNAIL_OPTIONS = [['off', t('settings:timelineThumbnails.off')], ['precise', t('settings:timelineThumbnails.precise')], ['coarse', t('settings:timelineThumbnails.coarse')]] as const;

/* 每趟采集上限三档，与服务端 `library_processing.SOURCE_BUDGET_CHOICES` 一致；没设过时显示默认档。 */
const SOURCE_BUDGET_ROWS = [
  { key: 'sourceBudgetRequests', fallback: 6000, choices: [1500, 3000, 6000, 12000, 24000, 48000],
    label: () => t('settings:sourceBudget.requests'), help: () => t('settings:sourceBudget.requestsHelp'),
    option: (count: number) => t('settings:sourceBudget.requestCount', { count }) },
  { key: 'sourceBudgetHours', fallback: 4, choices: [1, 2, 4, 8, 12, 24],
    label: () => t('settings:sourceBudget.hours'), help: () => undefined,
    option: (count: number) => t('settings:sourceBudget.hourCount', { count }) },
  { key: 'sourceBudgetGigabytes', fallback: 1, choices: [1, 2, 4, 8, 16],
    label: () => t('settings:sourceBudget.gigabytes'), help: () => undefined,
    option: (count: number) => t('settings:sourceBudget.gigabyteCount', { count }) },
] as const;

export function TaskSpeedSettings({ receipt }: { receipt(message: string): void }) {
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: ({ signal }) => fetchSettings(signal) });
  const save = useSaveSettings();
  const error = save.error || settings.error;
  const blocked = !settings.data || save.isPending;
  return <Section title={t('settings:taskSpeed.title')}>
    <Rows><SettingsRow label={t('settings:taskSpeed.defaultSpeed')} description={t('settings:taskSpeed.defaultSpeedHelp')}>
      <ProcessingMode value={settings.data?.taskSpeedMode || 'standard'} busy={blocked}
        onChange={(mode) => save.mutate({ taskSpeedMode: mode }, { onSuccess: () => receipt(t('settings:taskSpeed.saved')) })} />
    </SettingsRow>
    {SOURCE_BUDGET_ROWS.map((row) => <SettingsRow key={row.key} label={row.label()} description={row.help()}>
      <div id={`${row.key}Setting`} className="shrink-0">
        <Select aria-label={row.label()} selectedKey={String(settings.data?.[row.key] ?? row.fallback)} isDisabled={blocked}
          onSelectionChange={(key) => {
            if (key !== null) save.mutate({ [row.key]: Number(key) }, { onSuccess: () => receipt(t('settings:sourceBudget.saved')) });
          }}>
          {row.choices.map((count) => <SelectItem key={count} id={String(count)}>{row.option(count)}</SelectItem>)}
        </Select>
      </div>
    </SettingsRow>)}</Rows>
    {error ? <Stack divided><ErrorText>{errorMessage(error)}</ErrorText></Stack> : null}
  </Section>;
}

export function VideoThumbnailRow({ epoch = 0 }: { epoch?: number }) {
  return <Section guide="timeline" title={t('settings:timelineThumbnails.title')}><VideoThumbnailControls epoch={epoch} /></Section>;
}

export function VideoThumbnailControls({ epoch = 0, disabled = false }: { epoch?: number; disabled?: boolean }) {
  const status = useQuery({ queryKey: THUMBNAIL_JOBS_KEY, queryFn: ({ signal }) => fetchThumbnailJobs(signal), refetchOnMount: 'always' });
  const save = useSaveThumbnailMode();
  const reset = save.reset;
  useEffect(() => { reset() }, [epoch, reset]);
  const data = status.data;
  const error = save.error || status.error;
  return (
    <>
      <Rows>
        <SettingsRow label={t('settings:videoPreviews.timeline')} description={t('settings:videoPreviews.timelineHelp')}>
          <div id="videoThumbnailSetting">
            <Select aria-label={t('settings:timelineThumbnails.interval')} selectedKey={data?.mode || 'off'}
              isDisabled={disabled || !data || status.isFetching || save.isPending}
              onSelectionChange={(key) => { if (key !== null) save.mutate(String(key)) }}>
              {THUMBNAIL_OPTIONS.map(([key, label]) => <SelectItem key={key} id={key}>{label}</SelectItem>)}
            </Select>
          </div>
        </SettingsRow>
      </Rows>
      {save.isPending || data?.status === 'running'
        ? <Stack divided>
            {save.isPending ? <TaskProgress embedded kind="gather" label={t('settings:shared.saving')} />
              : <TaskProgress embedded kind={activityKind('timeline-thumbnails')} label={t('settings:timelineThumbnails.generating')} />}
            {save.isPending ? null : <TaskCenterLink />}
          </Stack>
        : null}
      {error ? <Stack divided><ErrorText>{errorMessage(error)}</ErrorText></Stack> : null}
    </>
  );
}

export function FollowPreferenceRows({ receipt }: { receipt(message: string): void }) {
  const store = appSettingsStore();
  useSyncExternalStore(store.subscribe, store.version);
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: ({ signal }) => fetchSettings(signal), refetchOnMount: 'always' });
  const initial = useSaveSettings();
  const initialDays = settings.data?.followInitialDays ?? store.value.followInitialDays;
  const error = initial.error || settings.error;
  return (
    <Section guide="follow-options" title={t('settings:followFetch.title')}>
      <Rows>
        <ScheduleRow kind="follow" />
        <ScheduleRow kind="feed" />
        <SettingsRow label={t('settings:followFetch.initialRange')} description={t('settings:followFetch.initialRangeHelp')}>
          <div id="followInitialDaysSetting" className="shrink-0">
            <Select aria-label={t('settings:followFetch.initialRange')} selectedKey={String(initialDays)}
              isDisabled={settings.isFetching || initial.isPending}
              onSelectionChange={(key) => {
                if (key === null) return;
                initial.mutate({ followInitialDays: Number(key) }, { onSuccess: (saved) => {
                  if (typeof saved.followInitialDays === 'number') store.value.followInitialDays = saved.followInitialDays;
                  store.save();
                  receipt(t('settings:followSchedule.initialRangeSaved'));
                } });
              }}>
              {FOLLOW_INITIAL_RANGE_OPTIONS.map(([key, label]) => <SelectItem key={key} id={key}>{label}</SelectItem>)}
            </Select>
          </div>
        </SettingsRow>
        <SettingsRow label={t('settings:followFetch.avatarRefresh')} description={t('settings:followFetch.avatarRefreshHelp')}><span className="shrink-0">{t('settings:followSchedule.avatarRefresh')}</span></SettingsRow>
        <SettingsRow label={t('settings:followFetch.faviconRefresh')} description={t('settings:followFetch.faviconRefreshHelp')}><span className="shrink-0">{t('settings:followSchedule.faviconRefresh')}</span></SettingsRow>
      </Rows>
      {error ? <Stack divided><ErrorText>{errorMessage(error)}</ErrorText></Stack> : null}
    </Section>
  );
}

/* 关注与订阅源两份定时共用的一行：开关加间隔分钟数。间隔框只在开着时出现；关掉再开填回关掉前的那个数，
   记在 `peach.number.<id>`，跟着这台浏览器走。 */
const SCHEDULE_ROWS = {
  follow: {
    id: 'followScheduleSetting', label: () => t('settings:followFetch.autoCheck'), help: () => t('settings:followSchedule.autoCheckHelp'),
    input: () => t('settings:followSchedule.autoCheckInterval'), name: 'follow-interval',
    running: () => t('settings:followSchedule.checking'), activity: 'follow-check', failure: () => t('settings:followSchedule.lastCheckFailed'),
  },
  feed: {
    id: 'feedScheduleSetting', label: () => t('settings:followFetch.feedSchedule'), help: () => t('settings:followSchedule.feedScheduleHelp'),
    input: () => t('settings:followSchedule.feedScheduleInterval'), name: 'feed-interval',
    running: () => t('settings:followSchedule.fetchingFeeds'), activity: 'feed-check', failure: () => t('settings:followSchedule.lastFetchFailed'),
  },
} as const;

function ScheduleRow({ kind }: { kind: keyof typeof SCHEDULES }) {
  const row = SCHEDULE_ROWS[kind];
  const { key, fetch, fallback } = SCHEDULES[kind];
  const status = useQuery({ queryKey: key, queryFn: ({ signal }) => fetch(signal),
    refetchOnMount: 'always', refetchInterval: schedulePollInterval });
  const save = useSaveSchedule(kind);
  const data = status.data;
  const storage = `peach.number.${row.id}`;
  const remembered = useRef(boundedPreference(Number(localStorage.getItem(storage)), 15, 10080, fallback));
  const [draft, setDraft] = useState(String(fallback));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (data?.enabled) {
      remembered.current = data.interval_minutes;
      setDraft(String(data.interval_minutes));
    }
  }, [data]);
  const blocked = !data?.available || status.isFetching || save.isPending;
  const commit = () => {
    const minutes = Number(draft);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 10080) { setInvalid(true); return }
    setInvalid(false);
    if (!data?.enabled || blocked || minutes === data.interval_minutes) return;
    remembered.current = minutes;
    localStorage.setItem(storage, String(minutes));
    save.mutate(minutes);
  };
  const error = save.error || status.error;
  /* 只读端没有定时：说一句「只在主设备上运行」，不画开关。 */
  const description = data && !data.available ? t('settings:followSchedule.primaryOnly') : row.help();
  return (
    <>
      <SettingsRow label={row.label()} description={description}>
        {/* 间隔框只在开着时出现；这一行按有框的高度留位，读回状态时下面几行不跟着动。
            控件这一侧不收缩：窄屏上让左边的说明换行，不让开关与间隔框压到说明上。 */}
        <div id={row.id} className="flex min-h-9 shrink-0 flex-wrap items-center justify-end gap-2">
          <Switch aria-label={row.label()} isSelected={data?.enabled === true} isDisabled={blocked}
            onChange={(on) => {
              localStorage.setItem(storage, String(remembered.current));
              save.mutate(on ? remembered.current : 0);
            }} />
          {data?.enabled ? <div className="flex items-center gap-2">
            <Input type="number" inputMode="numeric" name={row.name} autoComplete="off"
              aria-label={row.input()} className="w-21 sm:w-24"
              value={draft} onChange={(value) => { setDraft(value); setInvalid(false) }} onBlur={commit}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } }}
              isDisabled={blocked} isInvalid={invalid} />
            <span className="text-body-2-regular text-text-secondary">{t('settings:numberSetting.unitMinutes')}</span>
          </div> : null}
        </div>
      </SettingsRow>
      {invalid ? <Stack><ErrorText>{t('settings:followSchedule.invalidInterval')}</ErrorText></Stack> : null}
      {save.isPending || data?.running
        ? <Stack>{save.isPending ? <TaskProgress embedded kind="gather" label={t('settings:shared.saving')} />
          : <TaskProgress embedded kind={activityKind(row.activity)} label={row.running()} />}</Stack> : null}
      <ScheduleFailure kind={kind} status={data} title={row.failure()} />
      {error ? <Stack><ErrorText>{errorMessage(error)}</ErrorText></Stack> : null}
    </>
  );
}

/* 每轮开始时服务端清空上一轮的原因，所以正在跑的那一轮不显示；下一轮成功同样清空。
   「立即重试」让调度自己提前跑一轮：手动检查不经过调度，跑完了这条原因也不会消失。 */
function ScheduleFailure({ kind, status, title }: {
  kind: keyof typeof SCHEDULE_RUNS; status: FollowScheduleStatus | undefined; title: string;
}) {
  const run = useRunSchedule(kind);
  if (!status?.enabled || status.running || !status.last_error) return null;
  const failures = status.consecutive_failures ?? 0;
  const next = momentText(status.next_run_at);
  const detail = [failures > 1 ? t('settings:followSchedule.consecutiveFailures', { count: failures }) : '', next ? t('settings:followSchedule.nextRun', { time: next }) : '']
    .filter(Boolean).join(t('shell:format.clauseSeparator'));
  const reason = [status.last_error, detail, run.error ? t('settings:followSchedule.retryFailed', { error: errorMessage(run.error) }) : '']
    .filter(Boolean).join('\n');
  return (
    <Stack>
      <Note tone="error" title={title} action={<Button variant="secondary" size="small"
        disabled={!status.available} {...busyProps(run.isPending)} onClick={() => run.mutate()}>{t('settings:shared.retryNow')}</Button>}>
        {reason}
      </Note>
    </Stack>
  );
}
