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
  return {
    src: `/stream?id=${item.id}&session=${encodeURIComponent(session)}`,
    type: String(item.name || '').toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4',
  };
}

const isSegmented = (source: PlayerSource): boolean => String(source.type || '').includes('mpegurl');

/** 要不要盯着首帧：原文件试播与按能力直放的片子，浏览器解不了时可能不报错，只出声音或黑屏。 */
export const watchesDecoding = (source: PlayerSource): boolean => Boolean(source.trial || source.decode);

/** 换源用的那类错误：3 解码、4 格式不支持。分片地址的网络错误（2）也算：hls.js 重试过才报致命，
 *  多半是服务端切不出这一段（503），换到下一种处理方式才有救；原文件的网络错误不换，
 *  断网时退到转码只会白占服务端。中止（1）一律不算。 */
function fallbackError(error: unknown, failed: PlayerSource): boolean {
  const code = Number((error as { code?: number } | null)?.code);
  return code === 3 || code === 4 || (code === 2 && isSegmented(failed));
}

/** 片源失败时顺次取下一条：原文件 → 保留视频码流的分片 → 视频重编码，同一地址只试一次。
 *
 *  `failed` 是出错时挂着的那条片源：同一次失败常从媒体元素和播放器各报一遍，只有挂着的
 *  正是链上当前那条才前进，重复的那次拿到 null。按能力直放（带 `decode`）的片子链走到头时，
 *  调 `retry`（`fallbackStreamSource`：记下这台浏览器解不了，换一份不报能力的计划）接着退。 */
export function streamFallbackChain(
  source: PlayerSource, retry?: () => Promise<PlayerSource>,
): (error: unknown, failed: PlayerSource) => Promise<PlayerSource | null> {
  const tried = new Set([source.src]);
  let current = source, pending = retry, spent: PlayerSource | null = null;
  return async (error, failed) => {
    if (failed !== current || spent === current || !fallbackError(error, failed)) return null;
    spent = current;
    let next = current.fallback;
    if (!next && current.decode && pending) {
      const load = pending;
      pending = undefined;
      next = await load().catch(() => undefined);
    }
    if (!next || tried.has(next.src)) return null;
    tried.add(next.src);
    current = next;
    return next;
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
        fallback_src?: string; fallback_mime_type?: string } | null;
    if (plan?.src) {
      const hls = plan.protocol === 'hls';
      const original = !hls && plan.src.includes('original=1');
      const planned: PlayerSource = { src: plan.src, type: plan.mime_type || (hls ? 'application/vnd.apple.mpegurl' : 'video/mp4'),
        ...(decode && !hls ? { decode } : {}), ...(original ? { trial: true } : {}) };
      if (plan.fallback_src) {
        planned.fallback = { src: plan.fallback_src, type: plan.fallback_mime_type || 'application/vnd.apple.mpegurl' };
      }
      if (plan.original_src) {
        return { src: plan.original_src, type: plan.original_mime_type || 'video/mp4', trial: true, fallback: planned };
      }
      return planned;
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
export const detailFallbackSource = (item: PlayerItem): Promise<PlayerSource> => fallbackStreamSource(item, ensureDetailSession());

export function cancelDetailStream(): void {
  const session = detailSession;
  if (!session) return;
  detailSession = '';
  cancelStreamSession(session);
}
