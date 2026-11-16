/* YouTube 字幕列表与选项层级；本地文件和中文搜索接入同一条 TextTrack。 */
import { api, esc, icon } from '@peach/legacy/core';
import { setActionBusy, spinnerHtml } from '@peach/legacy/ui';
import { CAPTION_OPTIONS, mountCaptionStyle, type CaptionKey } from './subtitle-style';
import type { VjsPlayer } from './types';
import { SubtitleSession } from './subtitle-memory';
import { playerMemory } from './memory';
import { interfaceLanguage, t } from '../i18n';
import { serverText } from '../core/server-text';

export interface Panels {
  render(html: string, direction: number): HTMLElement;
  open(): void;
  close(): void;
  back(): void;
}
interface SearchResult { id: string; title: string; languages: string[]; format: string }
interface SubtitleFile { index: number; name: string; playable: boolean; language: string }

/** 在线字幕找界面语言的那一种：中文界面找简繁中文，其余找英文。服务端回语言标签，语言名按界面语言显示。 */
const SEARCH_LANGUAGE = interfaceLanguage === 'zh-CN' ? 'zh' : 'en';
const languageNames = new Intl.DisplayNames([interfaceLanguage], { type: 'language' });
/** 语言标签按界面语言说出的语言名；认不出的标签原样返回。 */
export const languageName = (tag: string): string => { try { return languageNames.of(tag) ?? tag } catch { return tag } };
/** 在线字幕记在播放记忆里的键；中文沿用改版前的写法，已加载过的不会重复下载。 */
const onlineKey = (id: string, file: SubtitleFile): string =>
  SEARCH_LANGUAGE === 'zh' ? `subtitlecat:${id}:${file.index}` : `subtitlecat:${id}:${SEARCH_LANGUAGE}:${file.index}`;
const fileNote = (file: SubtitleFile, loaded: boolean): string =>
  [languageName(file.language), loaded ? t('catalog:subtitles.loadedMark') : ''].filter(Boolean).join(' · ');

/** YouTube f572e43c 的 b$f：矩形实底与镂空 CC，使用原始 36 单位视框。 */
export const subtitleIcon = () => '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M11,11 C9.89,11 9,11.9 9,13 L9,23 C9,24.1 9.89,25 11,25 L25,25 C26.1,25 27,24.1 27,23 L27,13 C27,11.9 26.1,11 25,11 L11,11 Z M17,17 L15.5,17 L15.5,16.5 L13.5,16.5 L13.5,19.5 L15.5,19.5 L15.5,19 L17,19 L17,20 C17,20.55 16.55,21 16,21 L13,21 C12.45,21 12,20.55 12,20 L12,16 C12,15.45 12.45,15 13,15 L16,15 C16.55,15 17,15.45 17,16 L17,17 L17,17 Z M24,17 L22.5,17 L22.5,16.5 L20.5,16.5 L20.5,19.5 L22.5,19.5 L22.5,19 L24,19 L24,20 C24,20.55 23.55,21 23,21 L20,21 C19.45,21 19,20.55 19,20 L19,16 C19,15.45 19.45,15 20,15 L23,15 C23.55,15 24,15.45 24,16 L24,17 L24,17 Z"/></svg>';

export class SubtitleControls {
  private cleanup = new AbortController();
  private request: AbortController | null = null;
  private session: SubtitleSession;
  private last: TextTrack | null = null;
  private page = '';
  private generation = 0;
  private styles;
  private input = document.createElement('input');
  private cc: HTMLButtonElement;
  private query = '';
  private offset = 0;
  private results: SearchResult[] = [];
  private more = false;
  private searched = false;

  constructor(private player: VjsPlayer, private video: HTMLVideoElement, private panels: Panels, cc?: HTMLButtonElement) {
    this.styles = mountCaptionStyle(player.el(), video, this.cleanup.signal, playerMemory(player));
    /* 沉浸这类没有控制条的宿主自带按钮传进来；舞台照旧取控制条里那枚 CC。 */
    this.cc = cc || player.el().querySelector<HTMLButtonElement>('.vjs-subtitles-control > button')!;
    this.cc.innerHTML = subtitleIcon();
    this.cc.onclick = () => {
      const showing = this.tracks().find(track => track.mode === 'showing');
      if (showing) { this.last = showing; this.select(null) }
      else if (this.tracks().length) this.select(this.last && this.tracks().includes(this.last) ? this.last : this.tracks()[0]!);
      else this.show();
    };
    this.input.type = 'file'; this.input.accept = '.srt,.ass,.ssa,.vtt'; this.input.hidden = true;
    this.input.setAttribute('aria-label', t('catalog:subtitles.loadFile')); player.el().append(this.input);
    this.input.addEventListener('change', () => {
      const file = this.input.files?.[0]; this.input.value = '';
      if (file) void this.importFile(file);
    }, { signal: this.cleanup.signal });
    video.textTracks.addEventListener('change', () => this.sync(), { signal: this.cleanup.signal });
    video.textTracks.addEventListener('removetrack', () => { this.sync(); if (this.page === 'tracks') this.show(0) }, { signal: this.cleanup.signal });
    player.on('dispose', () => {
      this.hide(); this.cleanup.abort();
    });
    this.session = new SubtitleSession(player, video, () => { this.sync(); if (this.page === 'tracks') this.show(0) });
    this.sync();
  }

  private tracks() { return [...this.video.textTracks].filter(track => ['subtitles', 'captions'].includes(track.kind)) }
  label() { return this.tracks().find(track => track.mode === 'showing')?.label || t('catalog:subtitles.off') }
  hide() { this.request?.abort(); this.page = ''; this.generation++ }
  private sync() {
    const active = this.tracks().find(track => track.mode === 'showing');
    this.cc.setAttribute('aria-pressed', String(!!active));
    this.cc.setAttribute('aria-label', active ? t('catalog:subtitles.turnOff') : t('catalog:subtitles.turnOn'));
    if (active) this.last = active;
  }
  private select(track: TextTrack | null) {
    this.request?.abort();
    this.session.select(track);
    this.sync();
  }
  private header(title: string, extra = '') {
    return `<div class="vjs-peach-panel-header"><button type="button" class="vjs-peach-menu-back" data-subtitle-back aria-label="${t('catalog:playerQuality.backMenu')}">${icon('player-menu-back')}</button><strong>${esc(title)}</strong>${extra}</div>`;
  }
  private panel(html: string, back: () => void, direction = 1) {
    this.generation++; this.panels.open();
    const panel = this.panels.render(html, direction);
    panel.querySelector<HTMLButtonElement>('[data-subtitle-back]')!.onclick = back;
    return panel;
  }

  show(direction = 1) {
    this.page = 'tracks';
    const tracks = this.tracks();
    const choices = [null, ...tracks];
    const panel = this.panel(this.header(t('catalog:playerControls.subtitles'), `<button type="button" class="vjs-peach-caption-options" data-subtitle-options aria-label="${t('catalog:subtitles.options')}">${icon('settings')}</button>`) +
      `<div class="vjs-peach-panel-menu">${choices.map((track, index) => {
        const selected = track ? track.mode === 'showing' : tracks.every(row => row.mode !== 'showing');
        return `<button type="button" class="vjs-peach-menu-option" role="menuitemradio" aria-checked="${selected}" data-subtitle-track="${index}"><span class="vjs-peach-option-check">${selected ? icon('check') : ''}</span><span class="vjs-peach-option-label">${esc(track?.label || track?.language || (track ? t('catalog:playerControls.subtitles') : t('catalog:subtitles.off')))}</span></button>`;
      }).join('')}<button type="button" class="vjs-peach-caption-action" data-subtitle-file>${t('catalog:subtitles.loadFile')}</button><button type="button" class="vjs-peach-caption-action" data-subtitle-search>${t('catalog:subtitles.searchOnline')}</button></div><p class="vjs-peach-subtitle-status" data-subtitle-status role="status" hidden></p>`, () => { this.page = ''; this.panels.back() }, direction);
    panel.querySelector<HTMLButtonElement>('[data-subtitle-options]')!.onclick = () => this.options();
    panel.querySelector<HTMLButtonElement>('[data-subtitle-file]')!.onclick = () => this.input.click();
    panel.querySelector<HTMLButtonElement>('[data-subtitle-search]')!.onclick = () => { void this.searchPanel() };
    panel.querySelectorAll<HTMLButtonElement>('[data-subtitle-track]').forEach(button => {
      button.onclick = () => { this.select(choices[Number(button.dataset.subtitleTrack)]!); this.show(0) };
    });
    if (this.session.error) {
      this.status(this.session.error, true);
      panel.querySelector('[data-subtitle-status]')!.insertAdjacentHTML('beforeend', `<button type="button" class="vjs-peach-caption-action" data-subtitle-memory-retry>${t('catalog:shared.retryNow')}</button>`);
      panel.querySelector<HTMLButtonElement>('[data-subtitle-memory-retry]')!.onclick = () => { void this.session.retry() };
    }
  }

  private options(direction = 1) {
    this.page = 'options';
    const current = this.styles.current();
    const panel = this.panel(this.header(t('catalog:subtitles.options')) + `<div class="vjs-peach-panel-menu">${Object.entries(CAPTION_OPTIONS).map(([key, option]) => {
      const label = option.values.find(([value]) => value === current[key as CaptionKey])?.[1] || '';
      return `<button type="button" class="vjs-peach-caption-setting" data-subtitle-style="${key}"><span>${esc(option.label)}</span><b>${esc(label)}</b>${icon('player-menu-next')}</button>`;
    }).join('')}<button type="button" class="vjs-peach-caption-action" data-subtitle-reset>${t('catalog:subtitles.resetStyle')}</button></div>`, () => this.show(-1), direction);
    panel.querySelectorAll<HTMLButtonElement>('[data-subtitle-style]').forEach(button => {
      button.onclick = () => this.styleOptions(button.dataset.subtitleStyle as CaptionKey);
    });
    panel.querySelector<HTMLButtonElement>('[data-subtitle-reset]')!.onclick = () => { this.styles.reset(); this.options(0) };
  }

  private styleOptions(key: CaptionKey) {
    this.page = 'style';
    const option = CAPTION_OPTIONS[key];
    const panel = this.panel(this.header(option.label) + `<div class="vjs-peach-panel-menu">${option.values.map(([value, label]) => {
      const selected = this.styles.current()[key] === value;
      return `<button type="button" class="vjs-peach-menu-option" role="menuitemradio" aria-checked="${selected}" data-subtitle-value="${esc(value!)}"><span class="vjs-peach-option-check">${selected ? icon('check') : ''}</span><span class="vjs-peach-option-label">${esc(label!)}</span></button>`;
    }).join('')}</div>`, () => this.options(-1));
    panel.querySelectorAll<HTMLButtonElement>('[data-subtitle-value]').forEach(button => {
      button.onclick = () => { this.styles.set(key, button.dataset.subtitleValue!); this.options(-1) };
    });
  }

  private status(message: string, error = false, busy = false) {
    const target = this.player.el().querySelector<HTMLElement>('.vjs-peach-panel:not(.vjs-peach-panel-leaving) [data-subtitle-status]');
    if (target) { target.hidden = false; target.innerHTML = `${busy ? spinnerHtml('') : ''}<span>${esc(message)}</span>`; target.toggleAttribute('data-error', error) }
  }
  private busy() { this.request?.abort(); this.request = new AbortController(); return this.request.signal }
  private async text(response: Response) {
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(serverText(payload) || t('catalog:subtitles.loadFailed'));
    }
    return response.text();
  }
  private async importFile(file: File) {
    this.show(0);
    if (!/\.(srt|ass|ssa|vtt)$/i.test(file.name) || file.size > 4 * 1024 * 1024) { this.status(t('catalog:subtitles.fileRequirements'), true); return }
    const signal = this.busy(); this.status(t('catalog:subtitles.loading'), false, true);
    try {
      await this.session.ready;
      if (signal.aborted) return;
      const text = await this.text(await fetch(`/api/subtitles/convert?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file, signal }));
      const key = `file:${file.name}:${file.size}:${file.lastModified}`;
      await this.session.import(text, file.name, key, signal);
      if (!signal.aborted) { this.show(0); this.status(t('catalog:subtitles.loaded', { fileName: file.name })) }
    } catch (error) { if (!signal.aborted) this.status(error instanceof Error ? error.message : t('catalog:subtitles.loadFailed'), true) }
  }

  private searchPanel() {
    this.request?.abort();
    this.page = 'search';
    const item = this.player.peachItem;
    const query = String(item?.code || item?.title || String(item?.name || '').replace(/\.(mp4|mkv|avi|mov|webm|m4v|ts|wmv)$/i, '')).trim().slice(0, 200);
    if (query !== this.query) { this.query = query; this.offset = 0; this.results = []; this.searched = false }
    const panel = this.panel(this.header(t('catalog:subtitles.searchOnline')) + '<div class="vjs-peach-subtitle-search"><p class="vjs-peach-subtitle-status" data-subtitle-status role="status" hidden></p><div data-subtitle-results></div><a href="https://www.subtitlecat.com" target="_blank" rel="noopener noreferrer">' + t('catalog:subtitles.providedBy') + icon('external-link', 'ui-externalmark') + '</a></div>', () => { this.request?.abort(); this.show(-1) });
    if (query.length < 3) { this.status(t('catalog:subtitles.nothingToSearch')); return }
    if (this.searched) this.searchResults(panel);
    else void this.runSearch(panel, 0);
  }

  private searchResults(panel: HTMLElement) {
    const list = panel.querySelector<HTMLElement>('[data-subtitle-results]')!;
    list.innerHTML = this.results.map((row, index) => `<button type="button" class="vjs-peach-subtitle-result" data-subtitle-result="${index}"><span>${esc(row.title)}</span><small>${esc([row.languages.map(languageName).join(' / '), row.format].filter(Boolean).join(' · '))}</small></button>`).join('') +
      (this.more ? `<button type="button" class="vjs-peach-caption-action" data-subtitle-more>${t('catalog:subtitles.more')}</button>` : '');
    list.querySelectorAll<HTMLButtonElement>('[data-subtitle-result]').forEach(button => { button.onclick = () => { void this.showFiles(this.results[Number(button.dataset.subtitleResult)]!) } });
    list.querySelector<HTMLButtonElement>('[data-subtitle-more]')?.addEventListener('click', () => { void this.runSearch(panel, this.offset + 6) });
    this.status(this.results.length ? t('catalog:subtitles.foundOnline', { count: this.results.length }) : this.more ? t('catalog:subtitles.noneInBatch') : t('catalog:subtitles.noneOnline'));
  }

  private async runSearch(panel: HTMLElement, offset = this.offset) {
    if (panel.getAttribute('aria-busy') === 'true') return;
    const signal = this.busy(), generation = this.generation;
    const trigger = panel.querySelector<HTMLButtonElement>('[data-subtitle-more],[data-subtitle-retry]');
    const list = panel.querySelector<HTMLElement>('[data-subtitle-results]')!;
    panel.setAttribute('aria-busy', 'true'); if (trigger) setActionBusy(trigger); list.inert = true; this.status(t('catalog:subtitles.searching'), false, true);
    try {
      const payload = await api(`/api/subtitles/search?q=${encodeURIComponent(this.query)}&offset=${offset}&language=${SEARCH_LANGUAGE}`, { signal }) as { results: SearchResult[]; more: boolean };
      if (signal.aborted || generation !== this.generation) return;
      this.offset = offset; this.results.push(...payload.results); this.more = payload.more; this.searched = true;
      this.searchResults(panel);
    } catch (error) {
      if (!signal.aborted && generation === this.generation) {
        this.status(error instanceof Error ? error.message : t('catalog:subtitles.searchFailed'), true);
        list.querySelector('[data-subtitle-more]')?.remove();
        list.querySelector('[data-subtitle-retry]')?.remove();
        list.insertAdjacentHTML('beforeend', `<button type="button" class="vjs-peach-caption-action" data-subtitle-retry>${t('catalog:shared.retryNow')}</button>`);
        list.querySelector<HTMLButtonElement>('[data-subtitle-retry]')!.onclick = () => { void this.runSearch(panel, offset) };
      }
    } finally { panel.removeAttribute('aria-busy'); if (trigger) setActionBusy(trigger, false); list.inert = false }
  }

  private async showFiles(result: SearchResult) {
    this.page = 'files';
    /* 与搜索面板同一个容器：状态行在列表上方，左边距和列表文字对齐。 */
    const panel = this.panel(this.header(t('catalog:subtitles.chooseFile')) + '<div class="vjs-peach-subtitle-search"><p class="vjs-peach-subtitle-status" data-subtitle-status role="status"></p><div data-subtitle-files></div></div>', () => { void this.searchPanel() });
    const signal = this.busy(), generation = this.generation; this.status(t('catalog:subtitles.readingFiles'), false, true);
    try {
      const payload = await api(`/api/subtitles/subtitlecat/${result.id}?language=${SEARCH_LANGUAGE}`, { signal }) as { files: SubtitleFile[] };
      if (signal.aborted || generation !== this.generation) return;
      const files = payload.files.filter(file => file.playable);
      await this.session.ready;
      panel.querySelector('[data-subtitle-files]')!.innerHTML = files.map(file => {
        const loaded = this.session.has(onlineKey(result.id, file));
        return `<button type="button" class="vjs-peach-subtitle-result" data-subtitle-online="${file.index}"${loaded ? ' data-subtitle-loaded=""' : ''}><span>${esc(file.name)}</span><small>${esc(fileNote(file, loaded))}</small></button>`;
      }).join('');
      this.status(files.length ? t('catalog:subtitles.chooseToLoad') : t('catalog:subtitles.noTextSubtitles'));
      panel.querySelectorAll<HTMLButtonElement>('[data-subtitle-online]').forEach(button => {
        button.onclick = () => { const file = files.find(row => row.index === Number(button.dataset.subtitleOnline))!; void this.loadOnline(result.id, file, button) };
      });
    } catch (error) { if (!signal.aborted && generation === this.generation) this.status(error instanceof Error ? error.message : t('catalog:subtitles.fileNotFound'), true) }
  }

  /* 点一个文件：这一行转忙、其余行暂停，状态行先报抓取、再报载入；完成后留在这一页，这一行标「已加载」，不跳走。 */
  private async loadOnline(id: string, file: SubtitleFile, button: HTMLButtonElement) {
    const signal = this.busy();
    const list = button.closest<HTMLElement>('[data-subtitle-files]');
    setActionBusy(button); if (list) list.inert = true;
    try {
      await this.session.ready;
      if (signal.aborted) return;
      const key = onlineKey(id, file);
      if (this.session.has(key)) this.session.selectImported(key);
      else {
        this.status(t('catalog:subtitles.fetching'), false, true);
        const text = await this.text(await fetch(`/api/subtitles/subtitlecat/${id}/${file.index}?language=${SEARCH_LANGUAGE}`, { signal }));
        if (signal.aborted) return;
        this.status(t('catalog:subtitles.applying'), false, true);
        await this.session.import(text, file.name, key, signal);
      }
      if (signal.aborted) return;
      button.toggleAttribute('data-subtitle-loaded', true);
      button.querySelector('small')!.textContent = fileNote(file, true);
      this.status(t('catalog:subtitles.loaded', { fileName: file.name }));
    } catch (error) { if (!signal.aborted) this.status(error instanceof Error ? error.message : t('catalog:subtitles.loadFailed'), true) }
    finally { setActionBusy(button, false); if (list) list.inert = false }
  }

}

/** 沉浸这类没有设置菜单的宿主：一个单层面板容器加打开、关闭与返回，够 `SubtitleControls` 用（#585）。
 *  面板内容复用设置菜单那套类名与样式（`vjs-peach-panel*`），点外面收起。容器随宿主的生命周期走，
 *  `signal` 中止时摘掉点外面收起的监听。 */
export function subtitlePanels(menu: HTMLElement, signal: AbortSignal): Panels {
  const close = () => { menu.hidden = true };
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target as Node)) close();
  }, { signal });
  return {
    render(html: string): HTMLElement {
      const panel = document.createElement('div');
      panel.className = 'vjs-peach-panel';
      panel.innerHTML = html;
      menu.replaceChildren(panel);
      return panel;
    },
    open: () => { menu.hidden = false },
    close,
    back: close,
  };
}
