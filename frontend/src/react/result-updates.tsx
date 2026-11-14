/** 页面持续读取已提交结果；仅使发生变化的资料缓存失效。新到的入库通知弹 toast。
 *  这也是全站唯一常驻的那一处检查：在排在跑的任务（`running_tasks`）由它带来，别的页面只读缓存
 *  （`running-tasks.ts`），据此决定要不要开始盯自己那份进度。 */
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ShellActions } from './router/shell-actions';

import {
  fetchResultUpdates, RESULT_BUSY_POLL_MS, RESULT_IDLE_POLL_MS, RESULT_UPDATES_KEY, type ActivityData, type IngestNotice,
  type ResultUpdatesData,
} from './activity/tasks';
import { withBackoff } from '../polling';
import { queryClient } from './query';
import { showToast } from './toaster';
import { t } from '../i18n';
import { appSettingsStore } from '../appearance/settings';

const CATALOG = ['catalog-grid', 'catalog-folders', 'item', 'item-related', 'item-queue',
  'entity', 'entity-items', 'entity-photos', 'entity-route', 'index', 'stats',
  'quality-goals', 'duplicates', 'orphan-records', 'trash-summary', 'junk-summary', 'immerse-list'];
const FOLLOW = ['follow-feed', 'follow-item', 'follow-manage', 'follow', 'entity', 'index'];
const DISCOVERIES = ['feed-new', 'jav-discoveries', 'jav-releases', 'jav-detail', 'wants', 'index'];
/* 每个版本键刷新的页面，要覆盖服务端按表缓存的那几页实际读到的表：统计页读关注条目与来源
   算在线播放，口味页读关注来源推账号，所以它们也跟着 `follow` 刷新。对照见
   `tests/test_ledger_revision.py` 的 `ResultVersionTablesTests`。 */
const READINGS: Record<string, string[]> = {
  catalog: [...CATALOG, ...FOLLOW, 'review', 'taste'],
  follow: [...FOLLOW, 'stats', 'taste'],
  discoveries: DISCOVERIES,
  review: ['review'],
  artwork: [...CATALOG, ...FOLLOW, ...DISCOVERIES, 'avatar-choices'],
};

export function createResultRefresher() {
  const pending = new Set<string>();
  let running: Promise<void> | null = null;
  return (before: Record<string, string>, next: Record<string, string>): Promise<void> => {
    for (const key of Object.keys(next)) {
      if (next[key] !== before[key]) for (const head of READINGS[key] || []) pending.add(head);
    }
    if (!running && pending.size) {
      running = (async () => {
        while (pending.size) {
          const heads = new Set(pending);
          pending.clear();
          const filters = { predicate: (query: { queryKey: readonly unknown[] }) => heads.has(String(query.queryKey[0]))
            && (query.queryKey[0] !== 'follow-manage' || query.queryKey.length === 1 || query.queryKey[1] === 'feeds') };
          const inFlight = queryClient.getQueryCache().findAll(filters)
            .some(query => query.isActive() && query.state.fetchStatus === 'fetching');
          await queryClient.invalidateQueries(filters, { cancelRefetch: false });
          if (inFlight) for (const head of heads) pending.add(head);
        }
      })().finally(() => { running = null });
    }
    return running || Promise.resolve();
  };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** 一轮轮询里到了超过这么多部就合成一条，同步一批文件时不刷屏。 */
const NOTICE_BURST = 3;

const noticeText = (item: IngestNotice) => {
  const name = escape(item.label || t('shell:ingestToast.fallbackName'));
  return item.kind === 'download' ? t('shell:ingestToast.downloadDone', { name }) : t('shell:ingestToast.newFile', { name });
};

/** 新到的入库通知弹成 toast，点「打开」进这部作品。首轮与服务重启后（`epoch` 变了）只记基线，不补弹。
 *  `show` 为假（设置里关掉了入库通知）时照样往前记基线、不弹：再打开时不把关着那段的补弹出来。 */
export function announceIngests(seen: { epoch: string; last: number } | null,
  notices: ActivityData['ingest_notices'], openItem: ShellActions['openItem'], show = true): { epoch: string; last: number } | null {
  if (!notices) return seen;
  const last = notices.items.reduce((max, item) => Math.max(max, item.id), 0);
  if (!seen || seen.epoch !== notices.epoch) return { epoch: notices.epoch, last };
  const fresh = show ? notices.items.filter((item) => item.id > seen.last) : [];
  if (fresh.length > NOTICE_BURST) {
    showToast(`ingest-${notices.epoch}-${last}`, { html: t('shell:ingestToast.burst', { count: fresh.length }), alert: false, timeout: 8000, action: null });
  } else {
    for (const item of fresh) {
      showToast(`ingest-${notices.epoch}-${item.id}`, { html: noticeText(item), alert: false, timeout: 8000,
        action: { label: t('shell:shared.open'), run: () => openItem(item.asset_id) } });
    }
  }
  return { epoch: notices.epoch, last: Math.max(seen.last, last) };
}

/** 有任务在排在跑时五秒一次，闲着十秒一次；读失败按 4、8、16、30 秒退避，成功一次就回到常规间隔。 */
export const resultUpdatesInterval = withBackoff<ResultUpdatesData>((data) =>
  (data?.busy ? RESULT_BUSY_POLL_MS : RESULT_IDLE_POLL_MS));

export function ResultUpdates({ openItem }: Pick<ShellActions, 'openItem'>) {
  const query = useQuery({ queryKey: RESULT_UPDATES_KEY, queryFn: ({ signal }) => fetchResultUpdates(signal),
    refetchInterval: resultUpdatesInterval });
  const previous = useRef<Record<string, string> | undefined>(undefined);
  const announced = useRef<{ epoch: string; last: number } | null>(null);
  const [refresh] = useState(createResultRefresher);
  const versions = query.data?.result_versions;
  const notices = query.data?.ingest_notices;
  useEffect(() => {
    if (!versions) return;
    if (previous.current) void refresh(previous.current, versions);
    previous.current = versions;
  }, [versions, refresh]);
  useEffect(() => {
    announced.current = announceIngests(announced.current, notices, openItem, appSettingsStore().value.ingestNotices !== false);
  }, [notices, openItem]);
  return null;
}
