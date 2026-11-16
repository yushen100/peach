/* 流会话与片源判据。
 *
 * 每一路播放带一个会话号，服务端按它登记在途的读取；切走、关闭、离开页面时按会话取消，
 * 已经没人看的读取不再占着 115 或本地盘。详情与沉浸模式共用这一套（沉浸模式每格一个会话）。 */
import { api } from '@peach/legacy/core';

import { randomId } from '../core/random-id';
import { decodeParam, rememberDecodeFailure, type HevcPlayback } from './decode-support';
import type { PlayerItem, PlayerSource } from './types';

export function newStreamSession(): string {
  return randomId();
}

export function directStreamSource(item: PlayerItem, session: string): PlayerSource {
  const mkv = String(item.name || '').toLowerCase().endsWith('.mkv');
  return {
    src: `/stream?id=${item.id}&session=${encodeURIComponent(session)}${mkv ? '&original=1' : ''}`,
    type: mkv ? 'video/x-matroska' : String(item.name || '').toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4',
  };
}

/** 媒体不兼容时顺次取下一条片源，同一地址只尝试一次；网络故障不消耗兼容回退。 */
export function streamFallbackChain(source: PlayerSource): (error: unknown) => PlayerSource | null {
  const tried = new Set([source.src]);
  let next = source.fallback;
  return (error) => {
    const code = Number((error as { code?: number } | null)?.code);
    if (![3, 4].includes(code) || !next || tried.has(next.src)) return null;
    const selected = next;
    tried.add(selected.src);
    next = selected.fallback;
    return selected;
  };
}

/* 在线作品的 `path` 是来源作品页，不是可播地址。能播的那条代理在 `/follow-stream?id=<follow_item>`，
   保存时写了 `follow_item.asset_id`，`/api/item` 反查后回传 `follow_item_id`。 */
function followStreamSource(item: PlayerItem): PlayerSource | null {
  return item.location === 'online' && item.follow_item_id
    ? { src: `/follow-stream?id=${item.follow_item_id}`, type: 'video/mp4' } : null;
}

/** 起播片源只有这一个判据，详情和沉浸模式共用：服务端说要转码分片就给分片，否则直读。
 *  编码兼容性转码附带原画试播地址，让当前浏览器自己做最终判断；缺 ctts 的文件不走试播，
 *  先等文件头修复或兼容分片。
 *
 *  计划带上这台浏览器的解码能力（`decode=`，ADR-0163）：报了能解 HEVC，HEVC 片子直放原文件。
 *  回来的片源记着报了什么（`decode`），播放器据此决定要不要盯着首帧、解不出来时换 `fallbackStreamSource`。 */
export async function playableStreamSource(
  item: PlayerItem, session: string, hevc: HevcPlayback = 'auto',
): Promise<PlayerSource> {
  const proxied = followStreamSource(item);
  if (proxied) return proxied;
  const decode = await decodeParam(hevc).catch(() => '');
  try {
    const plan = await api(`/api/stream-plan?id=${item.id}&session=${encodeURIComponent(session)}`
      + (decode ? `&decode=${decode}` : '')) as
      { protocol?: string; src?: string; mime_type?: string; original_src?: string; original_mime_type?: string;
        fallback_src?: string } | null;
    if (plan?.src) {
      const hls = plan.protocol === 'hls';
      const segmented: PlayerSource = { src: plan.src, type: plan.mime_type || (hls ? 'application/vnd.apple.mpegurl' : 'video/mp4'),
        ...(decode && !hls ? { decode } : {}) };
      if (plan.fallback_src) segmented.fallback = { src: plan.fallback_src, type: 'application/vnd.apple.mpegurl' };
      if (plan.original_src) {
        return { src: plan.original_src, type: plan.original_mime_type || 'video/mp4', fallback: segmented };
      }
      return segmented;
    }
  } catch { /* 取不到计划就直读 */ }
  return directStreamSource(item, session);
}

/** 报了能解却解不出来：这台浏览器记下失败（此后 30 天不再报 HEVC），换一份不报能力的计划。 */
export function fallbackStreamSource(item: PlayerItem, session: string): Promise<PlayerSource> {
  rememberDecodeFailure();
  return playableStreamSource(item, session, 'transcode');
}

/** 通知服务端放掉这一路读取。结果写到 `<html data-peach-stream-cancel>` 上，e2e 据此核对。 */
export function cancelStreamSession(session: string): void {
  if (!session) return;
  fetch(`/api/stream-cancel?session=${encodeURIComponent(session)}`, {
    method: 'POST', credentials: 'same-origin', keepalive: true,
  }).then((response) => response.json()).then((result: unknown) => {
    document.documentElement.dataset.peachStreamCancel = JSON.stringify(result);
  }).catch(() => {});
}

/* ── 详情这一路 ──
   舞台与小窗同一时刻只放一条，共用一个会话：从详情进小窗时读取接着用，小窗里换片或关掉时
   才取消。 */
let detailSession = '';

export function detailStreamSession(): string { return detailSession }

function ensureDetailSession(): string {
  if (!detailSession) detailSession = newStreamSession();
  return detailSession;
}

export const directDetailSource = (item: PlayerItem): PlayerSource => directStreamSource(item, ensureDetailSession());
export const detailStreamSource = (item: PlayerItem): Promise<PlayerSource> => playableStreamSource(item, ensureDetailSession());

export function cancelDetailStream(): void {
  const session = detailSession;
  if (!session) return;
  detailSession = '';
  cancelStreamSession(session);
}
