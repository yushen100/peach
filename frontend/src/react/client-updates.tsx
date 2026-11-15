/** 应用级更新提示读取本机快照；刷新由用户明确触发。 */
import { useState, useSyncExternalStore, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, ButtonLink } from '@/components/base/buttons/button';

import { apiGet } from '../api';
import { jobText } from '../core/server-text';
import { CLIENT_UPDATES_EVENT } from '../core/service-status';
import type { ReleaseState, UpdateJob } from './bundle';
import { ActivityMotion, type ActivityKind } from './components/activity-motion';
import { ProgressRing } from './components/progress-ring';
import { t } from '../i18n';

export interface ClientUpdates {
  runtime: { version: string; build_id: string };
  release: ReleaseState;
  update_job: UpdateJob;
  userscript: { version: string; minimum_version: string; install_url: string };
  repairs: { state: string; available?: boolean; message?: string; items: {
    id: string; label: string; state: string; changed?: Record<string, number>;
    pending?: number; failed?: number; queued?: number; review_count?: number;
  }[] };
  /** 服务启动时的账本迁移：`running` 期间需要账本的请求回 503；旧服务没有这一项。
   *  进行中的 `stage`：`backup` 整份备份账本，`progress` 是备份的百分比；`apply` 执行迁移脚本，没有百分比。旧服务两项都没有。 */
  ledger_migration?: { state: 'idle' | 'running' | 'failed'; stage?: 'backup' | 'apply'; progress?: number;
    message?: string; message_code?: string; message_params?: Record<string, unknown> };
}

export const CLIENT_UPDATES_INTERVAL = 120_000;
/** 迁移或更新进行中时刷新进度的间隔（页面可见时）。 */
export const PROGRESS_INTERVAL = 2_000;
/** 连不上服务（或没取得快照）时的重试间隔；最后一档一直用到恢复，恢复后回到常规或进度间隔。 */
export const RECOVERY_DELAYS = [2_000, 4_000, 8_000, 16_000, 30_000] as const;
const REQUEST_TIMEOUT = 15_000;
const visible = () => document.visibilityState !== 'hidden';
const ACTIVE = new Set(['downloading', 'verifying', 'extracting', 'preparing', 'restarting', 'installing']);
/** Windows 更新器正在迁移账本时更新任务的说明（`standalone_update.migrate_database`）。 */
const UPDATING_DATABASE = 'jobMessage.standaloneUpdate.updatingDatabase';
export const RELEASE_UPDATES_PATH = '/settings/maintenance#releaseUpdates';

/** 服务端在迁移账本：启动迁移进行中，或更新器正在迁移。 */
const migrating = (snapshot: ClientUpdates): boolean => snapshot.ledger_migration?.state === 'running'
  || (ACTIVE.has(snapshot.update_job.state) && snapshot.update_job.message_code === UPDATING_DATABASE);
/** 迁移或更新正在推进：横幅显示进度，按 `PROGRESS_INTERVAL` 刷新。 */
const progressing = (snapshot: ClientUpdates): boolean => migrating(snapshot) || ACTIVE.has(snapshot.update_job.state);
const percent = (value: unknown): number => Math.round(Math.min(Math.max(Number(value) || 0, 0), 100));
/** 更新任务里没有真实进度的几步：连接发布源时还不知道包多大；重启与安装是在等服务回来，后端写的数值只是里程碑。 */
const WAITING = new Set(['restarting', 'installing']);
const CONNECTING = 'jobMessage.standaloneUpdate.connecting';
const jobPercent = (job: UpdateJob): number | null => typeof job.progress !== 'number' || WAITING.has(job.state)
  || job.message_code === CONNECTING ? null : percent(job.progress);

function pageRuntime(): ClientUpdates['runtime'] | null {
  try {
    const value = JSON.parse(document.getElementById('peach-client-runtime')?.textContent || 'null');
    return typeof value?.version === 'string' && typeof value?.build_id === 'string'
      ? { version: value.version, build_id: value.build_id } : null;
  } catch { return null; }
}

export interface ClientUpdatesView {
  snapshot: ClientUpdates | null;
  /** 运行标记变了，或看到过的迁移已结束：页面要刷新才用得上新版本。 */
  refresh: boolean;
  /** 连续没取得快照的次数；0 是连得上。 */
  failures: number;
}

const IDLE: ClientUpdatesView = { snapshot: null, refresh: false, failures: 0 };
let view = IDLE;
const listeners = new Set<() => void>();
let stop: (() => void) | undefined;

function publish(next: ClientUpdatesView) {
  view = next;
  for (const listener of listeners) listener();
}

/** 全页只有一份更新快照：横幅、设置页的「检查更新」与「升级补修」读同一份，第一个读者挂上时开始查，最后一个卸下时停下并清空。
 *
 *  文档携带加载时的运行标记，后台标签和首次断连也保留同一份基线。
 *  平时每 2 分钟读一次；请求入口遇到迁移期间的 503 或连不上服务时派发 `peach:client-updates`，这里立即查一次。
 *  迁移或更新进行中每 `PROGRESS_INTERVAL` 读一次刷新进度，期间的事件不插队；结束即回到常规节奏。
 *  同一时刻只有一个检查在飞，连不上服务时按 `RECOVERY_DELAYS` 退避，退避期间的事件不再插队。
 *  看到过迁移的页面在迁移结束后提示刷新：迁移期间取到的数据不完整，运行标记即使没变也要重新加载。 */
function start(): () => void {
  let baseline = pageRuntime();
  let sawMigration = false;
  let migrated = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  let failures = 0;
  /** 上一份快照里迁移或更新正在推进。 */
  let active = false;
  const changed = (snapshot: ClientUpdates | null) => publish({ snapshot, failures, refresh: !!snapshot
    && (migrated || (!!baseline && (snapshot.runtime.version !== baseline.version || snapshot.runtime.build_id !== baseline.build_id))) });
  const schedule = () => {
    clearTimeout(timer);
    if (disposed || !visible()) return;
    timer = setTimeout(poll, failures ? RECOVERY_DELAYS[Math.min(failures, RECOVERY_DELAYS.length) - 1]
      : active ? PROGRESS_INTERVAL : CLIENT_UPDATES_INTERVAL);
  };
  const poll = async () => {
    if (disposed || !visible() || request) return;
    clearTimeout(timer);
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
    let received: ClientUpdates | null = null;
    try {
      const next = await apiGet<ClientUpdates>('/api/client-updates', controller.signal);
      if (!disposed && !controller.signal.aborted && typeof next?.runtime?.version === 'string'
        && typeof next.runtime.build_id === 'string') {
        baseline ??= { ...next.runtime };
        received = next;
        active = progressing(next);
        if (migrating(next)) sawMigration = true;
        else if (sawMigration) migrated = true;
      }
    } catch {
      // 服务重启、断连和未取得快照都保留当前提示，按退避再查。
    } finally {
      clearTimeout(timeout);
      if (request === controller && !disposed) {
        request = undefined;
        failures = received ? 0 : failures + 1;
        changed(received ?? view.snapshot);
        schedule();
      }
    }
  };
  const visibility = () => {
    clearTimeout(timer);
    request?.abort();
    request = undefined;
    if (visible()) void poll();
  };
  /** 请求入口报告服务用不了：正常状态下立即查一次；在飞、正在退避或按进度节奏查时由那一次接着查。 */
  const notice = () => {
    if (!failures && !active) void poll();
  };
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener(CLIENT_UPDATES_EVENT, notice);
  void poll();
  return () => {
    disposed = true;
    clearTimeout(timer);
    request?.abort();
    document.removeEventListener('visibilitychange', visibility);
    document.removeEventListener(CLIENT_UPDATES_EVENT, notice);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  stop ??= start();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    stop?.();
    stop = undefined;
    view = IDLE;
  };
}

/** 本页的更新快照；没有别的读者时由这里开始查。 */
export function useClientUpdates(): ClientUpdatesView {
  return useSyncExternalStore(subscribe, () => view);
}

/** 本页刚发起了更新、重启或补修：立即查一次，看到进行中就换成进度节奏。 */
export function checkClientUpdates(): void {
  document.dispatchEvent(new Event(CLIENT_UPDATES_EVENT));
}

type BannerKind = 'migrating' | 'refresh' | 'ready' | 'preparing' | 'available';

/** 横幅那一句与它的文案键后缀。迁移按阶段报备份百分比或「正在应用迁移」，旧服务不报阶段就只说正在更新；
 *  更新器迁移账本与更新进行中都报更新任务的当前步骤与百分比。 */
function bannerMessage(kind: BannerKind, snapshot: ClientUpdates, version: string | null | undefined): [string, string] {
  const { ledger_migration: migration, update_job: job } = snapshot;
  if (kind === 'migrating' && migration?.state === 'running') {
    if (migration.stage === 'backup') return ['backup', t('shell:clientUpdate.migratingBackup', { percent: percent(migration.progress) })];
    if (migration.stage === 'apply') return ['apply', t('shell:clientUpdate.migratingApply')];
    return ['message', t('shell:clientUpdate.migrating')];
  }
  if (kind === 'migrating' || kind === 'preparing') {
    const share = jobPercent(job);
    const params = { version, step: jobText(job), percent: share };
    if (share === null) return ['progress', version ? t('shell:clientUpdate.updatingStep', params) : t('shell:clientUpdate.updatingStepUnversioned', params)];
    return ['progress', version ? t('shell:clientUpdate.updating', params) : t('shell:clientUpdate.updatingUnversioned', params)];
  }
  return ['message', t(kind === 'refresh' ? 'shell:clientUpdate.refreshReady'
    : kind === 'ready' ? 'shell:clientUpdate.restartReady' : 'shell:clientUpdate.available')];
}

/** 进行中那一步有没有确定的百分比：迁移的备份阶段与更新任务下载、校验、解包时有；应用迁移、旧服务不报阶段、
 *  连接发布源、重启与安装时没有（`jobPercent`）。 */
function bannerMeter(kind: BannerKind, snapshot: ClientUpdates): number | null {
  const { ledger_migration: migration, update_job: job } = snapshot;
  if (kind === 'migrating' && migration?.state === 'running') return migration.stage === 'backup' ? percent(migration.progress) : null;
  if (kind === 'migrating' || kind === 'preparing') return jobPercent(job);
  return null;
}

/** 没有百分比时那一步做的是哪一类事：迁移账本是整理，连发布源、下载还没有总量是传输，校验是检查，
 *  解包是整理，重启与安装是在等服务回来。 */
function bannerActivity(kind: BannerKind, snapshot: ClientUpdates): ActivityKind {
  const { ledger_migration: migration, update_job: job } = snapshot;
  if (kind === 'migrating' && (migration?.state === 'running' || job.message_code === UPDATING_DATABASE)) return 'blocks';
  if (job.state === 'restarting' || job.state === 'installing') return 'clock';
  if (job.state === 'verifying') return 'radar';
  if (job.state === 'extracting') return 'blocks';
  return 'linear-dots';
}

/** 横幅关掉时记下的那个状态（种类与版本）：刷新后同一状态不再出，出了新版本或换了状态再出。 */
const DISMISSED_KEY = 'peach.client-update.dismissed.v1';
const readDismissed = (): string => { try { return localStorage.getItem(DISMISSED_KEY) || '' } catch { return '' } };

/** 横幅复用项目 Banner，动作用 BoardUI 的小号描边按钮，和横幅里的文字一眼分得开；关闭只作用于当前状态。进行中有确定百分比时左侧换成小环形进度，
 *  没有百分比时换成那一步的语义动画（`bannerActivity`）；完成、可更新、已就绪是信息图标。 */
export function ClientUpdateBanner({ navigate }: { navigate(path: string): void }) {
  const { snapshot, refresh } = useClientUpdates();
  const [dismissed, setDismissed] = useState(readDismissed);
  const host = document.querySelector('[data-network-banner]');
  if (!snapshot || !host) return null;
  const { release, update_job: job, runtime } = snapshot;
  const kind = migrating(snapshot) ? 'migrating' : refresh ? 'refresh' : job.state === 'ready' ? 'ready'
    : ACTIVE.has(job.state) ? 'preparing' : release.state === 'available' && release.latest_version ? 'available' : null;
  if (!kind) return null;
  const version = job.state === 'ready' || ACTIVE.has(job.state) ? job.version || release.latest_version : release.latest_version;
  const identity = JSON.stringify(kind === 'refresh' ? [kind, runtime.version, runtime.build_id] : [kind, version]);
  if (identity === dismissed) return null;
  const [copy, message] = bannerMessage(kind, snapshot, version);
  const meter = bannerMeter(kind, snapshot);
  const busy = (kind === 'migrating' || kind === 'preparing') && meter === null;
  const openUpdates = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(RELEASE_UPDATES_PATH);
  };
  return createPortal(
    <aside key={identity} className="ui-project-banner peach-react" role="status" data-client-update={kind}>
      <div>{meter !== null ? <ProgressRing label={message} value={meter} />
        : busy ? <ActivityMotion kind={bannerActivity(kind, snapshot)} /> : <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-info" /></svg>}
        <p><span data-copy-key={`clientUpdates.${kind}.${copy}`}>{message}</span>
          {(kind === 'ready' || kind === 'available') && version ? <span data-copy-ignore=""> Peach {version}</span> : null}</p></div>
      <div className="flex-wrap">
        {kind === 'migrating' ? null : kind === 'refresh'
          ? <Button variant="secondary" size="xs" onClick={() => window.location.reload()}
            data-copy-key="clientUpdates.refresh.action">{t('shell:clientUpdate.refreshPage')}</Button>
          : <ButtonLink variant="secondary" size="xs" href={RELEASE_UPDATES_PATH} onClick={openUpdates}
            data-copy-key={`clientUpdates.${kind}.action`}>{kind === 'preparing' ? t('shell:clientUpdate.viewProgress') : t('shell:clientUpdate.viewUpdate')}</ButtonLink>}
        {/* 迁移、更新进行中是几秒到几分钟的过程，横幅在解释页面为什么暂时不正常，不给收起；
            其余状态是用户可以晚点再处理的事。 */}
        {kind === 'migrating' || kind === 'preparing' ? null
          : <Button variant="secondary" size="xs" onClick={() => {
            setDismissed(identity);
            try { localStorage.setItem(DISMISSED_KEY, identity) } catch { /* 存不下就只管这一页。 */ }
          }}
            data-copy-key={`clientUpdates.${kind}.later`}>{t('shell:clientUpdate.later')}</Button>}
      </div>
    </aside>, host,
  );
}
