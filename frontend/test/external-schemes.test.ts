import { expect, it } from 'vitest';
import { androidIntent, clientPlatform, schemePlayers } from '../src/player/external-schemes';

const url = 'https://192.0.2.10:8443/external-stream/3?ticket=a%2Bb&origin=https%3A%2F%2F192.0.2.10%3A8443';
const links = (platform: Parameters<typeof schemePlayers>[0]) =>
  Object.fromEntries(schemePlayers(platform).map(player => [player.id, player.link(url)]));

it('按 UA 区分客户端平台，iPadOS 桌面 UA 靠触点数认成 iOS', () => {
  expect(clientPlatform('Mozilla/5.0 (Linux; Android 15) Mobile')).toBe('android');
  expect(clientPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)')).toBe('ios');
  expect(clientPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
  expect(clientPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('mac');
  expect(clientPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
  expect(clientPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
  expect(clientPlatform('Mozilla/5.0 (win32) jsdom/26')).toBe('other');
});

it('各平台的协议链接按播放器的写法包装播放地址', () => {
  expect(links('windows')).toEqual({ potplayer: `potplayer://${url}`, vlc: `vlc://${url}` });
  expect(links('mac')).toEqual({
    iina: `iina://weblink?url=${encodeURIComponent(url)}`, vlc: `vlc://${url}`,
    infuse: `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`,
  });
  expect(links('ios')).toEqual({
    vlc: `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`,
    infuse: `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`, nplayer: `nplayer-${url}`,
  });
  expect(links('linux')).toEqual({ vlc: `vlc://${url}` });
  expect(links('other')).toEqual({});
  expect(schemePlayers('windows', ['potplayer']).map(player => player.id)).toEqual(['vlc']);
});

it('Android intent 保留主机、端口、路径与查询，只把协议挪进 scheme 字段', () => {
  expect(androidIntent(url)).toBe('intent://192.0.2.10:8443/external-stream/3?ticket=a%2Bb&origin=https%3A%2F%2F192.0.2.10%3A8443'
    + '#Intent;scheme=https;action=android.intent.action.VIEW;type=video/*;end');
  expect(androidIntent('http://198.51.100.2:8099/external-stream/3?ticket=t', 'com.mxtech.videoplayer.ad'))
    .toBe('intent://198.51.100.2:8099/external-stream/3?ticket=t#Intent;scheme=http;action=android.intent.action.VIEW;'
      + 'type=video/*;package=com.mxtech.videoplayer.ad;end');
});
