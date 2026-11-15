/** 外网连不上时的通栏横幅：读服务端按 Peach 代理探测的快照，联网后自己消失。 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/base/buttons/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api';
import { withBackoff } from '../polling';
import { t } from '../i18n';

export interface NetworkStatus { state: 'checking' | 'online' | 'offline' | 'unknown'; checked_at: number | null }

export const NETWORK_STATUS_KEY = ['network-status'] as const;
export const NETWORK_OFFLINE_TEXT = t('shell:networkBanner.offline');

/** 服务端的复查节律（`network_reachability.py` 的 `HEALTHY_INTERVAL`／`DEGRADED_INTERVAL`）：
 *  联网时十分钟一次，断网或待定时一分钟一次。 */
const SERVER_PERIOD = { online: 600_000, other: 60_000 };
/** 服务端那一轮探测本身要几秒（两个地址、各 5 秒超时、否定后隔一秒复查），晚这么久再读。 */
const PROBE_SLACK_MS = 5_000;
/** 下一次快照该到却还没到（探测还在跑，或两边时钟对不上）时的重读间隔，也是还没有快照时的。 */
const OVERDUE_MS = { online: 120_000, other: 30_000 };

/** 按服务端快照的 `checked_at` 加它的复查间隔算下一次什么时候读：快照不变就不重复读。 */
export function networkPollInterval(data?: NetworkStatus, now = Date.now()): number {
  const online = data?.state === 'online';
  const period = online ? SERVER_PERIOD.online : SERVER_PERIOD.other;
  const overdue = online ? OVERDUE_MS.online : OVERDUE_MS.other;
  if (typeof data?.checked_at !== 'number') return overdue;
  const wait = data.checked_at * 1000 + period - now;
  if (wait <= 0) return overdue;
  return Math.min(wait, period) + PROBE_SLACK_MS;
}

export function NetworkBanner() {
  const query = useQuery({
    queryKey: NETWORK_STATUS_KEY,
    queryFn: ({ signal }) => apiGet<NetworkStatus>('/api/network-status', signal),
    refetchInterval: withBackoff<NetworkStatus>((data) => networkPollInterval(data)),
    retry: false,
  });
  /* 关掉只管这一段断网：快照离开 offline（恢复联网或探测结论变了）就撤销，下次再断照样出来。 */
  const [dismissed, setDismissed] = useState(false);
  const offline = query.data?.state === 'offline';
  if (!offline && dismissed) setDismissed(false);
  const host = document.querySelector('[data-network-banner]');
  if (!offline || dismissed || !host) return null;
  return createPortal(
    <aside className="ui-project-banner ui-project-banner-warning" role="status" data-network-offline="">
      <div><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-alert" /></svg><p>{NETWORK_OFFLINE_TEXT}</p></div>
      <a href="/settings/network#peachProxy">{t('shell:networkBanner.checkProxy')}</a>
      <Button variant="secondary" size="xs" onClick={() => setDismissed(true)}>{t('shell:networkBanner.dismiss')}</Button>
    </aside>,
    host,
  );
}
