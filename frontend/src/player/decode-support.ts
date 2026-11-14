/* 这台浏览器能解哪些视频编码，报给 `/api/stream-plan` 的 `decode=`（ADR-0163）。
 *
 * 服务端知道片子是什么编码，不知道对面能不能解；能解的 HEVC 直接放原文件，不占服务端 CPU。
 * 探测只做一次：`canPlayType` 先筛，有 `mediaCapabilities` 时再确认。报能解却解不出来时由播放器调
 * `rememberDecodeFailure`，此后 30 天这台浏览器不再报 HEVC，直接走转码。 */

/** 「HEVC 播放方式」：自动按探测结果；总是转码不报 HEVC；总是直放三项都报。 */
export type HevcPlayback = 'auto' | 'transcode' | 'direct';

const MAIN = 'hvc1.1.6.L153.B0';
const MAIN10 = 'hvc1.2.4.L153.B0';
const HEV1 = 'hev1.1.6.L153.B0';
const ALL = ['hevc', 'hevc10', 'hev1'];
const FAILURE_KEY = 'peach.decode-fallback.v1';
export const FAILURE_DAYS = 30;
/** 起播后这么久仍没解出一帧，算解不出来。 */
export const FIRST_FRAME_MS = 4000;

let probed: Promise<string[]> | null = null;

async function decodes(video: HTMLVideoElement, codec: string): Promise<boolean> {
  const type = `video/mp4; codecs="${codec}"`;
  try { if (!video.canPlayType(type)) return false } catch { return false }
  const capabilities = (navigator as Navigator & { mediaCapabilities?: MediaCapabilities }).mediaCapabilities;
  if (typeof capabilities?.decodingInfo !== 'function') return true;
  try {
    const result = await capabilities.decodingInfo({
      type: 'file', video: { contentType: type, width: 1920, height: 1080, bitrate: 8_000_000, framerate: 30 },
    });
    return result.supported;
  } catch { return false }
}

async function probe(): Promise<string[]> {
  const video = document.createElement('video');
  if (!await decodes(video, MAIN)) return [];
  const found = ['hevc'];
  if (await decodes(video, MAIN10)) found.push('hevc10');
  if (await decodes(video, HEV1)) found.push('hev1');
  return found;
}

function failedRecently(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(FAILURE_KEY));
    return Number.isFinite(at) && at > 0 && now - at < FAILURE_DAYS * 86_400_000;
  } catch { return false }
}

/** `decode=` 的值；空串表示什么都不报，服务端照旧转码。 */
export async function decodeParam(mode: HevcPlayback = 'auto'): Promise<string> {
  if (mode === 'transcode') return '';
  if (mode === 'direct') return ALL.join(',');
  if (failedRecently()) return '';
  return (await (probed ??= probe())).join(',');
}

export function rememberDecodeFailure(): void {
  try { localStorage.setItem(FAILURE_KEY, String(Date.now())) } catch { /* 写不进去时下次照样先试直放。 */ }
}

/** 测试用：丢掉这一页里已探测的结果。 */
export function resetDecodeProbe(): void { probed = null }

type DecodingVideo = HTMLVideoElement & { webkitDecodedFrameCount?: number };

function decodedFrames(video: DecodingVideo): number | null {
  if (typeof video.getVideoPlaybackQuality === 'function') return video.getVideoPlaybackQuality().totalVideoFrames;
  return typeof video.webkitDecodedFrameCount === 'number' ? video.webkitDecodedFrameCount : null;
}

/** 盯住一次直放：报解码或格式错误，或者时间在走却一帧都没解出来，就回调一次 `failed`。
 *
 *  第二种是静默黑屏（ADR-0016 背景里见过）：不报 error，只能看帧数。起播 4 秒后检查，
 *  播放时间前进超过 1 秒而解码帧数为 0、或者画面宽度仍是 0，算解不出来。 */
export function watchDecoding(video: DecodingVideo, failed: () => void, signal: AbortSignal): void {
  let done = false, timer: ReturnType<typeof setTimeout> | undefined, startedAt = 0;
  const fail = () => {
    if (done || signal.aborted) return;
    done = true; clearTimeout(timer);
    failed();
  };
  video.addEventListener('error', () => {
    // 3 是 MEDIA_ERR_DECODE、4 是 MEDIA_ERR_SRC_NOT_SUPPORTED；网络错误（2）与中止（1）不算解不了。
    if (video.error?.code === 3 || video.error?.code === 4) fail();
  }, { signal });
  video.addEventListener('playing', () => {
    if (done || timer) return;
    startedAt = video.currentTime;
    timer = setTimeout(() => {
      timer = undefined;
      if (done || signal.aborted || video.paused || video.currentTime - startedAt < 1) return;
      const frames = decodedFrames(video);
      if (frames === 0 || !video.videoWidth) fail(); else done = true;
    }, FIRST_FRAME_MS);
  }, { signal });
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
}
