import { CLEANUP_HASH_REDIRECTS } from '../cleanup-routes';

/** 产品地址规范化，API 与媒体端点使用自己的契约。 */
export function canonicalPath(path: string): string {
  const url = new URL(path, 'https://peach.invalid');
  const details: [RegExp, string][] = [[/^\/item\/(\d+)$/, '/assets/'],
    [/^\/follow\/item\/(\d+)$/, '/posts/'], [/^\/jav\/movie\/([A-Za-z0-9_-]{2,64})$/, '/works/']];
  for (const [pattern, prefix] of details) {
    const match = pattern.exec(url.pathname);
    if (match) { url.pathname = prefix + (prefix === '/works/' ? match[1]!.toUpperCase() : match[1]); break }
  }
  const queue = /^\/(mix|parts|editions|playlists)\/(\d+)\/(\d+)$/.exec(url.pathname);
  if (queue) {
    url.pathname = `/assets/${queue[3]}`;
    url.searchParams.set(queue[1] === 'playlists' ? 'playlist' : queue[1]!, queue[2]!);
  }
  const pages: Record<string, string> = { '/activity': '/tasks', '/scraping': '/sources',
    '/follow-manage': '/subscriptions', '/configuration': '/settings/library', '/diagnostics': '/settings/diagnostics' };
  url.pathname = pages[url.pathname] || url.pathname;
  if (url.pathname === '/subscriptions' && url.searchParams.get('tab') === 'tags') {
    url.pathname = '/tags';
    for (const key of ['tab', 'page', 'sort', 'dir']) url.searchParams.delete(key);
    url.searchParams.set('scope', 'online');
  }
  const cleanup = url.pathname === '/data-cleanup' ? CLEANUP_HASH_REDIRECTS[url.hash] : undefined;
  if (cleanup) {
    url.pathname = cleanup;
    url.hash = '';
  }
  return url.pathname + url.search + url.hash;
}
