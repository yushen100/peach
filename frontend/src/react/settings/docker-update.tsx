/* Docker 一键更新（ADR-0140）：点击后等新容器起来。
 *
 * 容器换不掉自己，Peach 只请同一 compose 里的 Watchtower 在后台拉镜像、重建容器；令牌与地址都由
 * compose 自动配好，页面没有设置项。请求发出后 Peach 会断开一会儿；每 3 秒问一次运行版本，
 * 连不上时按退避放慢、页面隐藏时暂停，换成新版本就提示刷新，15 分钟没换就报告未完成。 */
import { useEffect, useRef, useState } from 'react';

import { apiGet, apiSend } from '../../api';
import { pollUntil } from '../../polling';
import { CommandSteps, ErrorText, Help, Stack } from './section';
import { TaskProgress } from '../components/task-progress';
import { useAction } from './use-action';
import { t } from '../../i18n';

const POLL = 3000;
const GIVE_UP = 15 * 60 * 1000;

export type DockerJob = { state: 'idle' | 'updating' | 'done' | 'timeout'; version?: string };
type RuntimeVersion = { runtime?: { version?: string } };

/** 等运行版本换掉：每 3 秒问一次；重建期间连不上是常态，按退避放慢，页面隐藏时暂停。
 *  换成新版本返回 `done`，跑满 `limitMs` 还没换返回 `timeout`，中止时返回 null。 */
export async function waitForNewVersion(currentVersion: string, signal: AbortSignal, options: {
  limitMs: number;
  read?: (signal: AbortSignal) => Promise<RuntimeVersion>;
  pause?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<DockerJob | null> {
  let version = '';
  await pollUntil<RuntimeVersion>({
    read: options.read || ((inner) => apiGet<RuntimeVersion>('/api/client-updates', inner)),
    apply: (next) => {
      const value = next.runtime?.version;
      if (value && value !== currentVersion) version = value;
    },
    done: () => !!version,
    signal, everyMs: POLL, limitMs: Math.max(1, options.limitMs), pause: options.pause,
  });
  if (signal.aborted) return null;
  return version ? { state: 'done', version } : { state: 'timeout' };
}

/** 点击「一键更新」之后的进度：发请求、等运行版本变化。 */
export function useDockerUpdate(currentVersion: string) {
  const [job, setJob] = useState<DockerJob>({ state: 'idle' });
  const action = useAction();
  const started = useRef(0);

  useEffect(() => {
    if (job.state !== 'updating') return undefined;
    const controller = new AbortController();
    void waitForNewVersion(currentVersion, controller.signal, { limitMs: GIVE_UP - (Date.now() - started.current) })
      .then((next) => { if (next) setJob(next) });
    return () => controller.abort();
  }, [job.state, currentVersion]);

  const run = () => action.run('docker-update',
    (signal) => apiSend<{ state: string }>('/api/configuration/docker-update', {}, 'POST', signal),
    () => { started.current = Date.now(); setJob({ state: 'updating' }); });
  return { job, run, busy: action.busy === 'docker-update', error: action.error };
}

export function DockerUpdateProgress({ job }: { job: DockerJob }) {
  if (job.state === 'updating') {
    // 等 Watchtower 拉镜像、重建容器，再等服务回来：是在等外部，画 Clock。
    return <TaskProgress embedded kind="clock" label={t('settings:dockerUpdate.updating')} />;
  }
  if (job.state === 'done') return <Help role="status">{t('settings:dockerUpdate.done', { version: job.version })}</Help>;
  if (job.state === 'timeout') {
    return <Stack>
      <ErrorText>{t('settings:dockerUpdate.timeout')}</ErrorText>
      <CommandSteps label={t('settings:dockerUpdate.logsLabel')} steps={[{ text: t('settings:dockerUpdate.watchtowerLog'), command: 'docker compose logs watchtower' },
        { text: t('settings:dockerUpdate.peachLog'), command: 'docker compose logs peach' }]} />
    </Stack>;
  }
  return null;
}
