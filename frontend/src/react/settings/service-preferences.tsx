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
  FEED_SCHEDULE_KEY, FOLLOW_SCHEDULE_KEY, SCHEDULE_RUNS, SETTINGS_KEY, THUMBNAIL_JOBS_KEY, fetchFeedSchedule,
  fetchFollowSchedule, fetchSettings, fetchThumbnailJobs, schedulePollInterval, useRunSchedule,
  useSaveFollowSchedule, useSaveSettings, useSaveThumbnailMode, type FollowScheduleStatus,
} from '../settings-panel/settings-data';
import { ErrorText, Rows, Section, Stack, TaskCenterLink } from './section';
import { TaskProgress } from '../components/task-progress';
import { activityKind } from '../../activity-kinds';
import { busyProps } from './use-action';
import { ProcessingMode } from '../library-processing/processing-effort';
import { t } from '../../i18n';

const THUMBNAIL_OPTIONS = [['off', t('settings:timelineThumbnails.off')], ['precise', t('settings:timelineThumbnails.precise')], ['coarse', t('settings:timelineThumbnails.coarse')]] as const;

export function TaskSpeedSettings({ receipt }: { receipt(message: string): void }) {
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: ({ signal }) => fetchSettings(signal) });
  const save = useSaveSettings();
  const error = save.error || settings.error;
  return <Section title={t('settings:taskSpeed.title')}>
    <Rows><SettingsRow label={t('settings:taskSpeed.defaultSpeed')} description={t('settings:taskSpeed.defaultSpeedHelp')}>
      <ProcessingMode value={settings.data?.taskSpeedMode || 'standard'} busy={!settings.data || save.isPending}
        onChange={(mode) => save.mutate({ taskSpeedMode: mode }, { onSuccess: () => receipt(t('settings:taskSpeed.saved')) })} />
    </SettingsRow></Rows>
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
        <FollowScheduleRow />
        <FeedScheduleRow />
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

function FollowScheduleRow() {
  const status = useQuery({ queryKey: FOLLOW_SCHEDULE_KEY, queryFn: ({ signal }) => fetchFollowSchedule(signal),
    refetchOnMount: 'always', refetchInterval: schedulePollInterval });
  const save = useSaveFollowSchedule();
  const data = status.data;
  const remembered = useRef(boundedPreference(Number(localStorage.getItem('peach.number.followScheduleSetting')), 15, 10080, 60));
  const [draft, setDraft] = useState('60');
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
    localStorage.setItem('peach.number.followScheduleSetting', String(minutes));
    save.mutate(minutes);
  };
  const error = save.error || status.error;
  return (
    <>
      <SettingsRow label={t('settings:followFetch.autoCheck')} description={t('settings:followSchedule.autoCheckHelp')}>
        {/* 间隔框只在开着时出现；这一行按有框的高度留位，读回状态时下面几行不跟着动。
            控件这一侧不收缩：窄屏上让左边的说明换行，不让开关与间隔框压到说明上。 */}
        <div id="followScheduleSetting" className="flex min-h-9 shrink-0 flex-wrap items-center justify-end gap-2">
          <Switch aria-label={t('settings:followFetch.autoCheck')} isSelected={data?.enabled === true} isDisabled={blocked}
            onChange={(on) => {
              localStorage.setItem('peach.number.followScheduleSetting', String(remembered.current));
              save.mutate(on ? remembered.current : 0);
            }} />
          {data?.enabled ? <div className="flex items-center gap-2">
            <Input type="number" inputMode="numeric" name="follow-interval" autoComplete="off"
              aria-label={t('settings:followSchedule.autoCheckInterval')} className="w-21 sm:w-24"
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
          : <TaskProgress embedded kind={activityKind('follow-check')} label={t('settings:followSchedule.checking')} />}</Stack> : null}
      <ScheduleFailure kind="follow" status={data} title={t('settings:followSchedule.lastCheckFailed')} />
      {error ? <Stack><ErrorText>{errorMessage(error)}</ErrorText></Stack> : null}
    </>
  );
}

/* 订阅源定时拉取没有可调的档位，这一行只读出间隔与上一轮的失败。 */
function FeedScheduleRow() {
  const status = useQuery({ queryKey: FEED_SCHEDULE_KEY, queryFn: ({ signal }) => fetchFeedSchedule(signal),
    refetchOnMount: 'always', refetchInterval: schedulePollInterval });
  const data = status.data;
  /* 首次读取时先占住这一行：读数回来再填字，下面的行不往下跳。 */
  if (!data) {
    return status.isPending ? <SettingsRow label={t('settings:followFetch.feedSchedule')}>
      <span data-skeleton aria-busy="true" aria-label={t('settings:followSchedule.loadingFeedInterval')}
        className="block h-4 w-16 rounded-2lg bg-background-tertiary-default" />
    </SettingsRow> : null;
  }
  const minutes = data.interval_minutes;
  const interval = minutes % 60 ? t('settings:followSchedule.everyMinutes', { count: minutes }) : t('settings:followSchedule.everyHours', { count: minutes / 60 });
  return (
    <>
      <SettingsRow label={t('settings:followFetch.feedSchedule')}>
        <span id="feedScheduleSetting">{!data.available ? t('settings:followSchedule.primaryOnly') : data.enabled ? interval : t('settings:followSchedule.feedOff')}</span>
      </SettingsRow>
      {data.running ? <Stack><TaskProgress embedded kind={activityKind('feed-check')} label={t('settings:followSchedule.fetchingFeeds')} /></Stack> : null}
      <ScheduleFailure kind="feed" status={data} title={t('settings:followSchedule.lastFetchFailed')} />
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
