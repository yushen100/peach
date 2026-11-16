/* 沉浸模式每一格的播放器：只留媒体本身。进度条、加载提示与动作键都由沉浸岛自己画，所以 Video.js
 * 挂成裸的一层，没有控件条、海报、转圈与错误层。
 *
 * 片源与详情同一个判据（`playableStreamSource`）；编码兼容性转码先让浏览器试原画，失败改挂分片。
 * 每格一个流会话，由调用方建好传进来：拆这一格时按会话取消，
 * 离开页面时调用方也按它取消。 */
import { disposePlayer } from './dispose';
import { cancelStreamSession, directStreamSource, playableStreamSource, streamFallbackChain } from './stream';
import { stopTelemetry, wireTelemetry } from './telemetry';
import type { PlayerItem, VjsPlayer } from './types';
import { ensureVideojs } from './videojs';
import { mountPlayerSubtitles } from './controls';
import { playbackKey } from './progress';
import { SubtitleSession } from './subtitle-memory';
import { mountCaptionStyle } from './subtitle-style';
import { mountPlaybackRate, playerMemory } from './memory';
import { mountPlayerRotation } from './rotation';

export interface ImmersePlayerOptions {
  kind: 'immerse';
  item: PlayerItem;
  /** 这一格的流会话（`newStreamSession()`）。 */
  session: string;
  /** 放完之后（沉浸模式接着放下一条）。 */
  onEnded?: () => void;
  /** 片源已经交给 video：调用方从这一刻起等它可以出画。拆得比片源解析快时不回调。 */
  onLoaded?: () => void;
}

const BARE = {
  controls: false, preload: 'auto', posterImage: false, titleBar: false, textTrackDisplay: false, loadingSpinner: false,
  bigPlayButton: false, controlBar: false, errorDisplay: false, textTrackSettings: false,
};

export function mountImmersePlayer(video: HTMLVideoElement, options: ImmersePlayerOptions): () => void {
  const { item, session } = options;
  let player: VjsPlayer | null = null, released = false;
  void Promise.all([playableStreamSource(item, session), ensureVideojs().catch(() => null)]).then(([source, vjs]) => {
    if (released) return;
    const direct = directStreamSource(item, session);
    const segmented = String(source.type || '').includes('mpegurl');
    const takeFallback = streamFallbackChain({ ...source, fallback: source.fallback ?? (segmented ? direct : undefined) });
    // 播放器脚本拉不到时退回原生 video；原生元素播不了分片，只能直读。
    if (!vjs) video.src = (segmented ? direct : source).src;
    else {
      const mounted = vjs(video, BARE);
      player = mounted;
      mounted.peachItem = item;
      mounted.peachPlaybackKey = playbackKey('item', item);
      const captions = new AbortController();
      mountCaptionStyle(mounted.el(), video, captions.signal, playerMemory(mounted));
      mountPlayerRotation(mounted, video);
      mountPlaybackRate(mounted, video);
      mounted.on('dispose', () => captions.abort());
      new SubtitleSession(mounted, video);
      mountPlayerSubtitles(mounted, item.id);
      mounted.on('error', () => {
        if (released) return;
        const next = takeFallback(mounted.error());
        if (!next) return;
        const at = video.currentTime, playing = !video.paused || video.autoplay;
        if (at > 0) mounted.one('loadedmetadata', () => { if (!released) mounted.currentTime(at) });
        mounted.src(next);
        if (playing) mounted.play()?.catch(() => {});
      });
      mounted.src(source);
    }
    wireTelemetry(item, video, options.onEnded ? { onEnded: options.onEnded } : {});
    options.onLoaded?.();
  });
  return () => {
    if (released) return;
    released = true;
    cancelStreamSession(session);
    if (player) disposePlayer(player);
    else { video.pause(); stopTelemetry(video); video.removeAttribute('src'); video.load() }
  };
}
