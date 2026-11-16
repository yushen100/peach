/* 用 URL Scheme 调起这台设备上的第三方播放器（手机、平板、另一台电脑）。
 *
 * 播放地址仍是 `/api/external-playback` 签发的 `/external-stream` 短期链接，这里只按客户端平台
 * 包一层播放器认的协议链接。浏览器不报告链接有没有被接住：没装播放器时点了没反应，
 * 网络播放地址照常显示，可以复制给别的播放器。 */

export type ClientPlatform = 'windows' | 'mac' | 'ios' | 'android' | 'linux' | 'other';

export interface SchemePlayer {
  /** 下拉里的键，存进 `peach.playback-target.v1` 时前面加 `scheme:`。 */
  id: string;
  /** 播放器名；空串是 Android 的系统选择器，显示名由界面按语言给。 */
  label: string;
  link(url: string): string;
}

/** 按 UA 判断平台。大小写敏感：jsdom 的 `(win32)`、`(linux)` 不算任何平台。 */
export function clientPlatform(agent: string = navigator.userAgent, touchPoints: number = navigator.maxTouchPoints || 0): ClientPlatform {
  if (/Android/.test(agent)) return 'android';
  if (/iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && touchPoints > 1)) return 'ios';
  if (/Macintosh|Mac OS X/.test(agent)) return 'mac';
  if (/Windows NT/.test(agent)) return 'windows';
  if (/Linux|X11/.test(agent)) return 'linux';
  return 'other';
}

/** Android Chrome 的 intent 链接：`intent://主机/路径#Intent;scheme=https;…;end`，`package` 为空时弹系统选择器。 */
export function androidIntent(url: string, pack = ''): string {
  const parsed = new URL(url);
  const target = `${parsed.host}${parsed.pathname}${parsed.search}`;
  const scheme = parsed.protocol.replace(/:$/, '');
  return `intent://${target}#Intent;scheme=${scheme};action=android.intent.action.VIEW;type=video/*;`
    + `${pack ? `package=${pack};` : ''}end`;
}

const encoded = (url: string) => encodeURIComponent(url);
const VLC: SchemePlayer = { id: 'vlc', label: 'VLC', link: url => `vlc://${url}` };
const INFUSE: SchemePlayer = { id: 'infuse', label: 'Infuse', link: url => `infuse://x-callback-url/play?url=${encoded(url)}` };

const PLAYERS: Record<ClientPlatform, readonly SchemePlayer[]> = {
  windows: [{ id: 'potplayer', label: 'PotPlayer', link: url => `potplayer://${url}` }, VLC],
  mac: [{ id: 'iina', label: 'IINA', link: url => `iina://weblink?url=${encoded(url)}` }, VLC, INFUSE],
  ios: [
    { id: 'vlc', label: 'VLC', link: url => `vlc-x-callback://x-callback-url/stream?url=${encoded(url)}` },
    INFUSE,
    { id: 'nplayer', label: 'nPlayer', link: url => `nplayer-${url}` },
  ],
  android: [
    { id: 'android', label: '', link: url => androidIntent(url) },
    { id: 'vlc', label: 'VLC', link: url => androidIntent(url, 'org.videolan.vlc') },
    { id: 'mxplayer', label: 'MX Player', link: url => androidIntent(url, 'com.mxtech.videoplayer.ad') },
  ],
  linux: [VLC],
  other: [],
};

/** 这个平台能用链接调起的播放器；`exclude` 里是服务端已检测到、能直接在本机打开的播放器。 */
export function schemePlayers(platform: ClientPlatform = clientPlatform(), exclude: readonly string[] = []): readonly SchemePlayer[] {
  return PLAYERS[platform].filter(player => !exclude.includes(player.id));
}
