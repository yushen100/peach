import { beforeEach, expect, it, vi } from 'vitest';
import { ExternalPlayback } from '../../src/react/item-detail/external-playback';
import { choose, click, mount, settle } from './render';

const playerSelect = (host: ParentNode) => host.querySelector('button[aria-haspopup="listbox"]');

beforeEach(() => {
  for (const key of ['peach.local-player.v1', 'peach.playback-target.v1']) localStorage.removeItem(key);
  // 链接调起的播放器按 UA 给；默认用认不出平台的 UA，只列检测到的程序和网络方式。
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (test)');
});

it('外部播放器只在用户请求后签发链接，并保留网络地址供 VR 播放器使用', async () => {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url === '/api/local-players' ? { players: [] } : ({
    url: '/external-stream/1?ticket=short', playlist: '/external-playlist/1.m3u?ticket=short',
  }) }));
  vi.stubGlobal('fetch', fetcher);
  const host = await mount(<ExternalPlayback id={1} />);
  await settle();
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/local-players']);
  await choose(playerSelect(host), '网络播放地址 / VR');
  await click(host.querySelector('[aria-label="使用外部播放器打开"]'));
  await settle();
  expect(fetcher.mock.calls).toHaveLength(2);
  expect(host.querySelectorAll('[data-local-playback-row]')).toHaveLength(1);
  expect(host.querySelector('details')).toBeNull();
  expect(host.querySelector('input')?.value).toContain('/external-stream/1?ticket=short');
});

it('播放器菜单只列检测到的程序和通用网络播放方式', async () => {
  localStorage.setItem('peach.playback-target.v1', 'iina');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ players: [
    { id: 'default', label: '系统默认播放器' }, { id: 'potplayer', label: 'PotPlayer' },
  ] }))));
  const host = await mount(<ExternalPlayback id={3} />);
  await settle();
  expect(playerSelect(host)?.textContent?.trim()).toBe('系统默认播放器');
  await click(playerSelect(host));
  expect([...document.querySelectorAll('[role="option"]')].map(node => node.textContent?.trim())).toEqual([
    '系统默认播放器', 'PotPlayer', 'M3U 播放列表', '网络播放地址 / VR',
  ]);
});

it('本机可选择已安装播放器并在打开成功后回执，失败保留原因', async () => {
  const opened = vi.fn();
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/local-players'
    ? { players: [{ id: 'default', label: '系统默认播放器' }, { id: 'vlc', label: 'VLC' }] } : { opened: true })));
  vi.stubGlobal('fetch', fetcher);
  const host = await mount(<ExternalPlayback id={7} onOpened={opened} />);
  await settle();
  expect(host.textContent).toContain('系统默认播放器');
  await click(host.querySelector('[aria-label="使用外部播放器打开"]'));
  expect(fetcher).toHaveBeenLastCalledWith('/api/local-playback?id=7&player=default', expect.objectContaining({ method: 'POST' }));
  expect(opened).toHaveBeenCalledOnce();
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ detail: '无法打开播放器' }), { status: 503 }));
  await click(host.querySelector('[aria-label="使用外部播放器打开"]'));
  expect(host.textContent).toContain('无法打开播放器');
  expect(opened).toHaveBeenCalledOnce();
});

it('M3U 与本机播放器共用打开入口，切换方式时清除网络地址', async () => {
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/local-players'
    ? { players: [{ id: 'default', label: '系统默认播放器' }] }
    : { url: '/external-stream/9?ticket=short', playlist: '/external-playlist/9.m3u?ticket=short' })));
  vi.stubGlobal('fetch', fetcher);
  let downloadUrl = '';
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloadUrl = this.href;
  });
  const host = await mount(<ExternalPlayback id={9} />);
  await settle();
  await choose(playerSelect(host), 'M3U 播放列表');
  expect(localStorage.getItem('peach.playback-target.v1')).toBe('m3u');
  await click(host.querySelector('[aria-label="使用外部播放器打开"]'));
  expect(fetcher).toHaveBeenLastCalledWith('/api/external-playback?id=9', expect.objectContaining({ method: 'POST' }));
  expect(download).toHaveBeenCalledOnce();
  expect(downloadUrl).toContain('/external-playlist/9.m3u?ticket=short');
  expect(host.querySelector('input')?.value).toContain('/external-stream/9?ticket=short');
  await choose(playerSelect(host), '系统默认播放器');
  expect(host.querySelector('input')).toBeNull();
});

it('本机检测失败时保留网络方式，重新检测后可以选择本机播放器', async () => {
  let attempts = 0;
  vi.stubGlobal('fetch', vi.fn(async () => {
    attempts++;
    return attempts === 1
      ? new Response(JSON.stringify({ detail: '检测暂不可用' }), { status: 503 })
      : new Response(JSON.stringify({ players: [{ id: 'potplayer', label: 'PotPlayer' }] }));
  }));
  const host = await mount(<ExternalPlayback id={5} />);
  await settle();
  expect(host.querySelector('[aria-label="使用外部播放器打开"]')?.hasAttribute('disabled')).toBe(false);
  expect(host.textContent).toContain('检测暂不可用');
  await click([...host.querySelectorAll('button')].find(node => node.textContent === '重新检测播放器'));
  await settle();
  await choose(playerSelect(host), 'PotPlayer');
  expect(localStorage.getItem('peach.playback-target.v1')).toBe('local:potplayer');
  expect(host.textContent).not.toContain('检测暂不可用');
});

it('手机上按平台列出链接调起的播放器，打开时把签发的播放地址包进对应协议', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/150.0 Mobile Safari/537.36');
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/local-players'
    ? { players: [] } : { url: '/external-stream/4?ticket=short&origin=x', playlist: '/external-playlist/4.m3u?ticket=short' })));
  vi.stubGlobal('fetch', fetcher);
  let opened = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { opened = this.href });
  const host = await mount(<ExternalPlayback id={4} />);
  await settle();
  await click(playerSelect(host));
  expect([...document.querySelectorAll('[role="option"]')].map(node => node.textContent?.trim())).toEqual([
    '系统选择播放器', 'VLC', 'MX Player', 'M3U 播放列表', '网络播放地址 / VR',
  ]);
  await choose(playerSelect(host), 'VLC');
  expect(localStorage.getItem('peach.playback-target.v1')).toBe('scheme:vlc');
  await click(host.querySelector('[aria-label="使用外部播放器打开"]'));
  await settle();
  const origin = new URL(location.href);
  expect(opened).toBe(`intent://${origin.host}/external-stream/4?ticket=short&origin=x#Intent;scheme=${origin.protocol.slice(0, -1)};`
    + 'action=android.intent.action.VIEW;type=video/*;package=org.videolan.vlc;end');
  expect(host.querySelector('input')?.value).toContain('/external-stream/4?ticket=short');
  expect(host.textContent).toContain('没有反应说明这台设备没装该播放器');
});

it('本机已检测到的播放器不再重复列出链接调起的同名项', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150.0 Safari/537.36');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ players: [
    { id: 'default', label: '系统默认播放器' }, { id: 'potplayer', label: 'PotPlayer' },
  ] }))));
  const host = await mount(<ExternalPlayback id={6} />);
  await settle();
  await click(playerSelect(host));
  expect([...document.querySelectorAll('[role="option"]')].map(node => node.textContent?.trim())).toEqual([
    '系统默认播放器', 'PotPlayer', 'VLC', 'M3U 播放列表', '网络播放地址 / VR',
  ]);
});
