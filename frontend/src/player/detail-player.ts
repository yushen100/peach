/* 详情播放器：给舞台播放区的 `<video>` 挂 Video.js 与全部 Peach 控件。
 *
 * - `mountDetailPlayer` 挂一个 Video.js 实例：片源解析、时长校正、片源解不了时逐级回退（原文件 → 码流复制分片
 *   → 视频重编码，按能力直放的再换一份不报能力的计划）、脱盘判定，
 *   ready 之后挂设置菜单、拖动预览、Media Session、转圈与字幕。
 * - `attachPlayerChrome` 把统计面板、加载速度角标与氛围光接到一块媒体框上。播放器进小窗时摘下，
 *   展开回舞台时接到新的媒体框上，实例本身不重建。
 * - `mountPlayer` 是舞台播放区与沉浸模式每一格的入口：插氛围光画布与统计角标，按作品或关注条目
 *   给片源、海报与上报，返回拆掉这一个播放器的函数。 */
import { detailPosterUrl } from '@peach/card-art';
import { api, esc, fmtClock, fmtSize, icon, realDuration } from '@peach/legacy/core';

import {
  mountPlayerAmbient, mountPlayerMediaSession, mountPlayerQualityControl, mountPlayerSeekPreview,
  mountPlayerSpinner, mountPlayerSubtitles,
} from './controls';
import { disposePlayer } from './dispose';
import { playerHost } from './host';
import { mountImmersePlayer, type ImmersePlayerOptions } from './immerse-player';
import { wirePlayerContextMenu } from './menu';
import { detailPlayer, setDetailPlayer } from './registry';
import { playbackKey, playbackPosition, stopPlaybackPosition, trackPlaybackPosition } from './progress';
import {
  averageBitrate, bufferedAhead, createBufferMeter, fmtLoadRate, fmtSpeed, PLAYER_PANEL_EVENT,
  playerSpeedBits, playerStatsOverlayHtml, playerStatsPlot, pushPlayerStat, streamEntries,
} from './stats';
import { watchDecoding } from './decode-support';
import {
  detailFallbackSource, detailStreamSession, detailStreamSource, directDetailSource, streamFallbackChain, watchesDecoding,
} from './stream';
import { stopTelemetry, wireFollowTelemetry, wireTelemetry } from './telemetry';
import type { MediaFacts, PlayerItem, PlayerSource, SourceQuality, VjsPlayer } from './types';
import { ensureVideojs } from './videojs';
import { isPlayerGuidePreview } from './guide-preview';
import { interfaceLanguage, t } from '../i18n';

/** 从小窗展开回来或带 `?t=` 深链进来时接着放的那一刻。 */
export interface PlayerResume { time: number; autoplay: boolean }

export interface DetailPlayerOptions {
  released?: () => boolean;
  guidePreview?: boolean;
  playbackKey?: string;
  /** 给定片源（关注条目的 `/follow-stream`）；不给就按作品的来源解析。 */
  source?: PlayerSource;
  /** 播放出错时要不要查来源状态判脱盘。关注条目的片源不在本机来源里，不查。 */
  checkSourceStatus?: boolean;
  size?: number | null | undefined;
  poster?: string | undefined;
  qualities?: SourceQuality[] | null;
  /** 清晰度表与字节数，跟默认片源并行解析，回来得比挂载晚。 */
  mediaPromise?: Promise<MediaFacts | null>;
  resume?: PlayerResume | null;
}

/** 媒体框里那三块读数：统计键、统计面板与加载速度角标（`playerStatsOverlayHtml`）。 */
interface PlayerChrome {
  statsButton: HTMLElement | null;
  statsPanel: HTMLElement | null;
  netBadge: HTMLElement | null;
}

/** 一个播放器实例的读数来源。面板画在哪一块框里由 `chrome` 决定，换框时只换它。 */
interface PlayerSession {
  chrome: PlayerChrome | null;
  /** ready 之后统计键才露出来：控件条还没挂上时点它什么也读不到。 */
  ready: boolean;
  updateStats(): void;
}

const sessions = new WeakMap<VjsPlayer, PlayerSession>();

/* 统计面板与加载速度角标的定时器。它们画在舞台的媒体框里，播放器进小窗时跟着舞台一起停。 */
let statsTimer: ReturnType<typeof setInterval> | null = null;
let netTimer: ReturnType<typeof setInterval> | null = null;
let netHideTimer: ReturnType<typeof setTimeout> | null = null;

/** 停掉统计面板与角标的刷新。播放器本身不动。 */
export function stopPlayerPanels(): void {
  if (statsTimer) { clearInterval(statsTimer); statsTimer = null }
  if (netTimer) { clearInterval(netTimer); netTimer = null }
  if (netHideTimer) { clearTimeout(netHideTimer); netHideTimer = null }
}

export async function mountDetailPlayer(
  item: PlayerItem, video: HTMLVideoElement, autoplay: boolean, options: DetailPlayerOptions = {},
): Promise<VjsPlayer | null> {
  const existing = detailPlayer();
  if (existing && !existing.isDisposed()) return existing;
  const host = playerHost();
  const resume = options.resume ?? null;
  if (resume?.autoplay) autoplay = true;
  if (options.guidePreview) autoplay = false;
  const source = () => (options.source ? Promise.resolve(options.source) : detailStreamSource(item));
  /* 拉不到就退回原生 video，和「页面里没有 videojs」是同一个兜底出口。 */
  let videojs;
  try { videojs = await ensureVideojs() } catch {
    if (options.released?.()) return null;
    video.controls = true;
    if (options.guidePreview) return null;
    source().then((next) => {
      if (options.released?.()) return;
      video.addEventListener('loadedmetadata', () => {
        if (resume && resume.time > 0) video.currentTime = Math.min(resume.time, realDuration(video.duration) || resume.time);
      }, { once: true });
      video.src = next.src; if (autoplay) video.play().catch(() => {});
    }).catch(() => {});
    return null;
  }
  if (options.released?.()) return null;
  const player = videojs(video, {
    controls: true, preload: 'metadata', language: interfaceLanguage, responsive: true,
    /* 海报与作品当前封面偏好一致，交给原生视频显示。 */
    poster: options.poster || detailPosterUrl(item, host.settings().javImage),
    controlBar: {
      pictureInPictureToggle: true, currentTimeDisplay: false, timeDivider: false,
      durationDisplay: false, remainingTimeDisplay: false,
      // 时间与悬停预览归 Peach 控件，进度条只保留播放与拖动所需的组件。
      progressControl: { seekBar: { mouseTimeDisplay: false, playProgressBar: { timeTooltip: false } } },
    },
  });
  setDetailPlayer(player);
  player.peachItem = item;
  player.peachPlaybackKey = options.playbackKey || playbackKey('item', item);
  wirePlayerContextMenu(player);
  /* 手机上的画面格按视频自己的比例排（`--peach-video-ratio`）。 */
  player.on('loadedmetadata', () => {
    const tech = player.el()?.querySelector('video');
    if (tech?.videoWidth && tech.videoHeight) player.el().style.setProperty('--peach-video-ratio', `${tech.videoWidth}/${tech.videoHeight}`);
  });
  // 非正时长一律当未知。
  const expected = realDuration(item.duration);
  const statsHistory = { speed: [] as number[], activity: [] as number[], buffer: [] as number[] };
  /* 关注条目的字节数要回源 HEAD 才知道，跟清晰度表同一趟回来，比挂载晚。码率是速度读数的
     换算系数，所以留一个可以后填的口子，别把它固定在挂载那一刻。 */
  let mediaSize = Number(options.size ?? item.size) || 0;
  const meter = createBufferMeter(averageBitrate(mediaSize, item.duration));
  let statsLoaded = 0;
  let correcting = false;
  const live = () => detailPlayer() === player && !player.isDisposed();
  const enforceDuration = () => {
    if (!expected || correcting || !live()) return;
    const reported = Number(player.duration());
    if (!Number.isFinite(reported) || Math.abs(reported - expected) > Math.max(2, expected * .001)) {
      correcting = true; player.duration(expected); queueMicrotask(() => { correcting = false });
    }
  };
  const segmentedNow = () => String(player.currentSource()?.type || '').includes('mpegurl');
  const session: PlayerSession = { chrome: null, ready: false, updateStats: () => {} };
  sessions.set(player, session);
  session.updateStats = () => {
    const statsPanel = session.chrome?.statsPanel;
    if (!statsPanel || statsPanel.hidden || !live()) return;
    const quality = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
    const rect = video.getBoundingClientRect(), current = `${video.videoWidth || item.width || '?'}×${video.videoHeight || item.height || '?'}`;
    const segmented = segmentedNow();
    const stream = detailStreamSession();
    const resources = segmented ? streamEntries(item.id, stream) : [];
    const bytes = resources.reduce((n, entry) => n + (entry.transferSize || entry.encodedBodySize || 0), 0);
    const seconds = resources.reduce((n, entry) => n + (entry.duration || 0), 0) / 1000;
    meter.sample(video);
    const speed = playerSpeedBits(player, item.id, stream, segmented ? null : meter) || (seconds > 0 ? bytes * 8 / seconds : 0);
    /* 分片流按已完成请求的字节累计；渐进源没有这种请求，按前沿推进折算，码率未知时退到秒。 */
    const loaded = segmented ? bytes : (meter.bitrate > 0 ? meter.bytes() : meter.seconds);
    const activity = Math.max(0, loaded - statsLoaded); statsLoaded = loaded;
    const buffer = bufferedAhead(video);
    pushPlayerStat(statsHistory.speed, speed);
    pushPlayerStat(statsHistory.activity, activity);
    pushPlayerStat(statsHistory.buffer, buffer);
    /* 关注条目没有落盘文件名，容器格式只能从片源 MIME 反推；HLS 已经写在传输一侧，不重复。 */
    const named = String(item.name || '');
    const container = (named.includes('.') ? named.split('.').pop() || ''
      : segmented ? '' : String(player.currentSource()?.type || '').split('/').pop() || '').toUpperCase() || '—';
    const speedText = speed ? `${(speed / 1e6).toFixed(1)} Mbps` : '—';
    const byteScale = segmented || meter.bitrate > 0;
    const loadedRow: [string, string, string] = segmented
      ? [t('catalog:playerStats.networkActivity'), t('catalog:playerStats.networkValue', { size: bytes ? fmtSize(bytes) : '—', count: resources.length }),
        t('catalog:playerStats.networkLastSecond', { size: activity ? fmtSize(activity) : '0 B' })]
      : [t('catalog:playerStats.downloaded'), byteScale ? `${fmtSize(loaded)}${mediaSize > 0 ? ` / ${fmtSize(mediaSize)}` : ''}` : t('catalog:playerStats.seconds', { seconds: loaded.toFixed(0) }),
        byteScale ? t('catalog:playerStats.downloadedLastSecond', { size: activity ? fmtSize(activity) : '0 B' }) : t('catalog:playerStats.downloadedSecondsLastSecond', { seconds: activity.toFixed(1) })];
    const rows: [string, string, string?][] = [
      [t('catalog:playerStats.videoSession'), stream && !options.source ? `${item.id} / ${stream.slice(0, 8)}` : `${item.id}`],
      [t('catalog:playerStats.viewportFrames'), `${Math.round(rect.width)}×${Math.round(rect.height)} / ${quality ? `${quality.totalVideoFrames - quality.droppedVideoFrames} of ${quality.totalVideoFrames}` : '—'}`],
      [t('catalog:playerStats.resolution'), `${current} / ${item.width || video.videoWidth || '?'}×${item.height || video.videoHeight || '?'}`],
      [t('catalog:playerStats.formatTransport'), `${container} / ${segmented ? 'HLS' : 'HTTP Range'}`],
      [t('catalog:playerStats.connectionSpeed'), speedText,
        playerStatsPlot(statsHistory.speed, 'speed', Math.max(10e6, ...statsHistory.speed), t('catalog:playerStats.connectionSpeedPlot', { speed: speedText === '—' ? t('catalog:playerStats.noData') : speedText }))],
      [loadedRow[0], loadedRow[1],
        playerStatsPlot(statsHistory.activity, 'activity', Math.max(1, ...statsHistory.activity), loadedRow[2])],
      [t('catalog:playerStats.bufferHealth'), t('catalog:playerStats.seconds', { seconds: buffer.toFixed(1) }),
        playerStatsPlot(statsHistory.buffer, 'buffer', 30, t('catalog:playerStats.bufferAhead', { seconds: buffer.toFixed(1) }))],
      [t('catalog:playerStats.playbackTime'), `${fmtClock(video.currentTime)} / ${fmtClock(expected || player.duration())}`],
      [t('catalog:playerStats.date'), new Date().toLocaleString(interfaceLanguage)],
    ];
    statsPanel.innerHTML = `<dl>${rows.map(([key, value, plot]) =>
      `<dt>${esc(key)}</dt><dd${plot ? ' data-player-stats-metric=""' : ''}>${plot || ''}<span>${esc(value)}</span></dd>`).join('')}</dl>`;
  };
  player.on(['loadstart', 'loadedmetadata', 'durationchange', 'error'], enforceDuration);
  let takeFallback: (error: unknown, failed: PlayerSource) => Promise<PlayerSource | null> = async () => null;
  /** 挂在播放器上的那条片源与盯首帧的那一轮；换源时一起换。 */
  let mounted: PlayerSource | null = null, watching: AbortController | null = null;
  const mountSource = (next: PlayerSource) => {
    watching?.abort(); watching = null;
    mounted = next;
    if (watchesDecoding(next)) {
      const signal = (watching = new AbortController()).signal;
      watchDecoding(video, () => { void fallBack({ code: 3 }, next) }, signal);
    }
    player.src(next);
  };
  /** 片源解不了时换下一条，保留当前秒数；换成了返回 true。 */
  const fallBack = async (error: unknown, failed: PlayerSource | null): Promise<boolean> => {
    if (!failed || player.isDisposed()) return false;
    const resumeAt = video.currentTime, playing = autoplay || !video.paused;
    const next = await takeFallback(error, failed);
    if (!next || player.isDisposed() || mounted !== failed) return false;
    if (resumeAt > 0) player.one('loadedmetadata', () => { if (!player.isDisposed()) player.currentTime(resumeAt) });
    mountSource(next);
    if (playing) player.play()?.catch(() => {});
    return true;
  };
  player.on('dispose', () => { watching?.abort(); watching = null });
  const updateNet = () => {
    const netBadge = session.chrome?.netBadge;
    if (!netBadge || player.isDisposed()) return;
    const segmented = segmentedNow();
    if (!segmented) meter.sample(video);
    const bits = playerSpeedBits(player, item.id, detailStreamSession(), segmented ? null : meter);
    const rate = segmented ? fmtSpeed(bits) : fmtLoadRate(bits, bufferedAhead(video));
    netBadge.innerHTML = `${icon('gauge')}<span class="sr-only">${t('catalog:playerStats.loadSpeed')}</span><span>${esc(rate)}</span>`;
  };
  const showNet = () => {
    const netBadge = session.chrome?.netBadge;
    if (!netBadge || !netBadge.isConnected) return;
    netBadge.hidden = false; updateNet();
    if (netTimer) clearInterval(netTimer);
    netTimer = setInterval(updateNet, 500);
  };
  const hideNet = () => {
    const netBadge = session.chrome?.netBadge;
    if (!netBadge) return;
    if (netHideTimer) clearTimeout(netHideTimer);
    netHideTimer = setTimeout(() => { netBadge.hidden = true; if (netTimer) { clearInterval(netTimer); netTimer = null } }, 1400);
  };
  player.on(['loadstart', 'progress', 'waiting', 'stalled'], showNet);
  player.on(['canplay', 'playing'], () => { updateNet(); hideNet() });
  player.on('error', () => {
    if (player.isDisposed()) return;
    void fallBack(player.error(), mounted).then((switched) => {
      // 播到一半掉盘时 video 元素只报通用错误；来源状态才分得清脱盘和文件损坏。
      if (switched || options.checkSourceStatus === false || player.isDisposed()) return;
      return host.loadSourceStatus().then((status) => {
        if (status[String(item.root_id || item.location)] !== false || player.isDisposed()) return;
        player.error({ code: 2, message: t('catalog:playerControls.directoryOffline', { reason: host.offlineReason(String(item.root_id || item.location)) }) });
      });
    });
  });
  player.ready(() => {
    enforceDuration();
    const updateQualities = mountPlayerQualityControl(player, video, item, options.qualities ?? null);
    options.mediaPromise?.then((next) => {
      if (!live()) return;
      updateQualities?.(next?.qualities?.length ? next.qualities : null);
      const size = Number(next?.size) || 0;
      if (size > 0 && !mediaSize) { mediaSize = size; meter.bitrate = averageBitrate(size, item.duration) }
    }).catch(() => {});
    mountPlayerSeekPreview(player, item, { thumbnail: !options.source });
    if (!options.guidePreview) mountPlayerMediaSession(player, item);
    mountPlayerSpinner(player);
    if (!options.source) mountPlayerSubtitles(player, item.id);
    session.ready = true;
    if (session.chrome?.statsButton) session.chrome.statsButton.hidden = false;
  });
  if (!options.guidePreview) source().then((next) => {
    if (!live()) return;
    const segmented = String(next.type || '').includes('mpegurl');
    const first = { ...next, fallback: next.fallback ?? (segmented ? directDetailSource(item) : undefined) };
    takeFallback = streamFallbackChain(first, options.source ? undefined : () => detailFallbackSource(item));
    if (resume && resume.time > 0) player.one('loadedmetadata', () => {
      if (player.isDisposed()) return;
      const duration = realDuration(player.el().querySelector('video')?.duration) || realDuration(player.duration());
      player.currentTime(Math.min(resume.time, duration || resume.time));
    });
    mountSource(first);
    enforceDuration(); setTimeout(enforceDuration, 0); setTimeout(enforceDuration, 250);
    if (autoplay) player.play()?.catch(() => {});
  }).catch(() => {});
  return player;
}

const AMBIENT_CANVAS = '<canvas data-ambient-canvas="" width="32" height="18"></canvas>';

/** 氛围光放在媒体框首部；作品详情的统计键与速率挂到 React 留出的工具栏插槽，统计面板留在框内。
 *  关注详情没有工具栏，读数插在 `before` 前面。已有读数时保留当前节点与事件。 */
export function preparePlayerFrame(frame: HTMLElement, before: Element | null = null): void {
  if (!frame.querySelector(':scope > [data-ambient-canvas]')) frame.insertAdjacentHTML('afterbegin', AMBIENT_CANVAS);
  if (frame.querySelector('#playerStatsBtn')) return;
  const overlay = document.createElement('template');
  overlay.innerHTML = playerStatsOverlayHtml();
  const toolbar = frame.querySelector(':scope > [data-player-toolbar]');
  if (toolbar) {
    toolbar.querySelector('[data-player-stats-slot]')!.append(overlay.content.querySelector('#playerStatsBtn')!);
    toolbar.querySelector('[data-player-net-slot]')!.append(overlay.content.querySelector('#playerNet')!);
  }
  frame.insertBefore(overlay.content, before);
}

/** 把统计面板、加载速度角标与氛围光接到 `frame` 上（它先经过 `preparePlayerFrame`）。返回摘下的
 *  函数：进小窗时摘，播放器销毁时自己摘。 */
export function attachPlayerChrome(player: VjsPlayer, frame: HTMLElement): () => void {
  const session = sessions.get(player);
  if (!session || player.isDisposed()) return () => {};
  const find = (id: string) => frame.querySelector<HTMLElement>(`#${id}`);
  const chrome: PlayerChrome = { statsButton: find('playerStatsBtn'), statsPanel: find('playerStats'), netBadge: find('playerNet') };
  session.chrome = chrome;
  const { statsButton, statsPanel } = chrome;
  let offPanels = () => {};
  if (statsButton && statsPanel) {
    statsButton.hidden = !session.ready;
    const closeStats = () => {
      if (statsPanel.hidden) return;
      statsPanel.hidden = true; statsButton.setAttribute('aria-pressed', 'false');
      if (statsTimer) { clearInterval(statsTimer); statsTimer = null }
    };
    statsButton.onclick = () => {
      if (!statsPanel.hidden) { closeStats(); return }
      document.dispatchEvent(new CustomEvent(PLAYER_PANEL_EVENT, { detail: 'stats' }));
      statsPanel.hidden = false; statsButton.setAttribute('aria-pressed', 'true');
      session.updateStats();
      if (statsTimer) clearInterval(statsTimer);
      statsTimer = setInterval(session.updateStats, 1000);
    };
    const closeStatsForOtherPanel = (event: Event) => { if ((event as CustomEvent<string>).detail !== 'stats') closeStats() };
    document.addEventListener(PLAYER_PANEL_EVENT, closeStatsForOtherPanel);
    offPanels = () => document.removeEventListener(PLAYER_PANEL_EVENT, closeStatsForOtherPanel);
  }
  const tech = player.el().querySelector('video');
  const stopAmbient = tech ? mountPlayerAmbient(tech) : () => {};
  let attached = true;
  const detach = () => {
    if (!attached) return;
    attached = false;
    offPanels(); stopAmbient();
    if (session.chrome === chrome) { session.chrome = null; stopPlayerPanels() }
  };
  player.one('dispose', detach);
  return detach;
}

/** 关注条目里的一份媒体（组里的第几条视频）。 */
export interface PlayerMedia { index: number; media_type?: string; size?: number | null }

export interface MountPlayerOptions {
  kind: 'item' | 'follow';
  item: PlayerItem;
  media?: PlayerMedia | null;
  /** 不给就按设置（`detailAutoplay`）。 */
  autoplay?: boolean | undefined;
  resume?: PlayerResume | null;
  /** 挂载之前在媒体框里插氛围光画布与统计角标。默认插；小窗里换片不要这些。 */
  chrome?: boolean;
  /** 挂上之后把实例交出去：小窗与展开要认得这一个。挂不上（Video.js 拉不到、退回原生 video）
   *  给 null。拆得比挂载快时不回调。 */
  onPlayer?: (player: VjsPlayer | null) => void;
  /** 这个播放器已经被小窗接走：拆播放区时不销毁它。 */
  handedOff?: (player: VjsPlayer) => boolean;
}

/** 舞台播放区的入口：给播放区里的 `<video>` 挂播放器，返回拆掉它的函数。
 *
 *  氛围光画布与统计角标在挂载之前插进媒体框：Video.js 一包，`video` 的父级就换成它自己的那层了。
 *  - 作品（`item`）：片源由 `mountDetailPlayer` 按来源解析，海报是本地图，这一次挂载第一次开播时
 *    记一次播放，离开位置与真实观看由 `wireTelemetry` 随播放写回侧栏。
 *  - 关注（`follow`）：片源是 `/follow-stream`，清晰度与字节数（`/follow-qualities`）跟默认片源并行
 *    解析——它要回源抓详情、再 HEAD 一次正片，不能挡住播放器挂载。
 *  - 沉浸模式的一格（`immerse`）：裸 Video.js、这一格自己的流会话，见 `immerse-player.ts`。
 *  返回的清理在舞台卸下这块媒体区时调：换一份媒体只拆这一个播放器；被小窗接走的只摘读数。 */
export function mountPlayer(video: HTMLVideoElement, options: MountPlayerOptions | ImmersePlayerOptions): () => void {
  if (options.kind === 'immerse') return mountImmersePlayer(video, options);
  const { kind, item, media = null, handedOff, onPlayer } = options;
  const guidePreview = isPlayerGuidePreview();
  const host = playerHost();
  const frame = options.chrome === false ? null : video.parentElement;
  if (frame) preparePlayerFrame(frame, video);
  const key = playbackKey(kind, item, media?.index ?? null);
  let detail: DetailPlayerOptions = { guidePreview, playbackKey: key, resume: guidePreview ? null : options.resume ?? { time: playbackPosition(key, item, host.settings().resumeRestartPercent), autoplay: false } };
  if (kind === 'follow') {
    detail = {
      ...detail,
      source: { src: `/follow-stream?id=${item.id}${media ? `&media=${media.index}` : ''}`, type: media?.media_type || item.media_type || 'video/mp4' },
      checkSourceStatus: false, size: media?.size, poster: item.thumb_url,
      mediaPromise: (api(`/follow-qualities?id=${encodeURIComponent(item.id)}`) as Promise<MediaFacts | null>).catch(() => null),
    };
  } else {
    const poster = detailPosterUrl(item, host.settings().javImage);
    if (poster) video.poster = poster;
  }
  let player: VjsPlayer | null = null, released = false, detachChrome = () => {}, trackedVideo = video;
  const release = () => {
    detachChrome();
    if (player && handedOff?.(player)) return;
    stopPlaybackPosition(trackedVideo);
    if (!player) {
      stopTelemetry(trackedVideo);
      if (trackedVideo.hasAttribute('src')) {
        trackedVideo.pause();
        trackedVideo.removeAttribute('src');
        trackedVideo.load();
      }
      return;
    }
    if (detailPlayer() === player) { setDetailPlayer(null); stopPlayerPanels() }
    disposePlayer(player);
  };
  void mountDetailPlayer(item, video, guidePreview ? false : options.autoplay ?? host.settings().detailAutoplay,
    { ...detail, released: () => released }).then((mounted) => {
    player = mounted;
    // 挂载还没回来媒体区就换了：这一个一出来就拆掉。
    if (released) { release(); return }
    trackedVideo = mounted?.el().querySelector('video') ?? video;
    if (guidePreview) {
      mounted?.el().setAttribute('data-player-guide', '');
      onPlayer?.(mounted); return;
    }
    trackPlaybackPosition(key, trackedVideo);
    if (kind === 'follow') wireFollowTelemetry(item, trackedVideo);
    else {
      trackedVideo.addEventListener('play', () => {
        void (api('/api/play', { method: 'POST', body: JSON.stringify({ id: item.id }) }) as Promise<unknown>).catch(() => {});
      }, { once: true });
      wireTelemetry(item, trackedVideo, { watched: '#watched', mark: '#mark', ratio: '#ratioTxt' });
    }
    if (!mounted) { onPlayer?.(null); return }
    if (frame) detachChrome = attachPlayerChrome(mounted, frame);
    onPlayer?.(mounted);
  });
  return () => { released = true; release() };
}
