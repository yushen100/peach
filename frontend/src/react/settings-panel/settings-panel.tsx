/* 设置面板：顶栏齿轮打开的那一屏浮层，左栏分区、右边一组组设置行。
 *
 * 常驻组件 `settings-panel`（`router/managed-routes.tsx` 的常驻表）：第一次打开时壳的 `loadSettingsPanel` 建一枚
 * `[data-settings-host]`，常驻组件的 `place` 把它放进 body 末尾，路由树在同一个任务里把面板画成它的子节点。
 * 之后开合只换 `hidden`，分区、滚动位置之外的状态跨次打开保留。壳经 `configureSettingsPanel` 给的句柄开合：
 * 句柄写本模块的 store 再 `flushSync` 通知，返回时面板已经画好，锁滚、取数与焦点紧跟在后面。界面偏好读写的是
 * 壳递进来的那一份 `appSettings`（`host.store`），改完一项用 `host.changed(effect)` 告诉壳跟着做什么；跟数据库走的
 * 那几项经 `/api/settings` 写（`settings-data.ts`）。
 *
 * 宿主不在 `.peach-react` 里：行、开关、下拉、拉条与色块都是全站共用的遗留控件，外观由
 * `settings-panel.css` 与遗留样式表给。
 *
 * 每次打开时共用控件重画、数值框回到当前值，并重取共享设置。
 * 焦点先交给关闭钮，Tab 在面板里转圈，关掉后还给打开前那一枚。 */
import {
  useLayoutEffect, useRef, useState, useSyncExternalStore,
  type CSSProperties, type KeyboardEvent, type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { VisuallyHidden } from 'react-aria-components';
import { ButtonLink } from '@/components/base/buttons/button';
import {
  attachOverlayScrollbar, closeAnchoredMenu, iconSwapHtml, moveGlidePane, revealTexts,
  setActionBusy, setIconSwap, wireHorizontalScroller,
} from '@peach/legacy/ui';

import { AFTER_PLAYBACK_CHOICES, allowedSetting } from '@peach/appearance';

import { INTERFACE_LANGUAGES, isInterfaceLanguageChoice, LANGUAGE_SELF_NAMES, t, type InterfaceLanguageChoice } from '../../i18n';
import { PREFERENCE_SECTIONS, sectionId } from '../../history/settings-route';
import { normalizeJavImage } from '../../jav-artwork';
import { boundedPreference } from '../../number-setting';
import { NAME_LANGUAGES, type NameLanguage } from '../../core/entity-names';
import { normalizeGestures } from '../../player/gesture-settings';
import { GlowSettings } from './glow-settings';
import { Icon, RemixIcon } from './icon';
import { IconSwitch, SelectField } from './legacy-controls';
import { NumberSetting } from './number-setting';
import type { Choice, PanelSettings, SettingsPanelApi, SettingsPanelHost } from './settings-panel-api';
import { fetchSettings, refreshPanelData, SETTINGS_KEY, useSaveSettings } from './settings-data';
import { Note } from '../components/note';
import { ShortcutSetting } from './shortcut-setting';
import { SidebarOrder } from './sidebar-order';
import { NavigationDropLine, NavigationOrderMenu, NavigationOrderPreferences, useNavigationOrder } from '../components/navigation-order';
import { useSidebarReorder } from '../sidebar/use-sidebar-reorder';
import { SettingsDialogClose } from '../components/settings-dialog-close';

/* 左栏的分区，顺序即右边各组的顺序。字形按条目自己的名字取：整列取自 Remix，一家画的笔画
   才一样粗。 */
const SECTIONS = [
  { id: 'appearance', route: 'appearance', title: PREFERENCE_SECTIONS.appearance, icon: 'ri-palette-line' },
  { id: 'browsing', route: 'playback', title: PREFERENCE_SECTIONS.playback, icon: 'ri-play-circle-line' },
  { id: 'jav', route: 'jav', title: PREFERENCE_SECTIONS.jav, icon: 'jav' },
  { id: 'search', route: 'search', title: PREFERENCE_SECTIONS.search, icon: 'ri-search-line' },
  { id: 'content', route: 'content', title: PREFERENCE_SECTIONS.content, icon: 'ri-shield-check-line' },
] as const;

const SORT_OPTIONS: readonly Choice[] = [
  ['seed', t('settings:shared.random')], ['rating', t('settings:shared.rating')], ['o', t('settings:shared.climaxCount')], ['plays', t('settings:shared.plays')],
  ['dur', t('settings:shared.duration')], ['size', t('settings:shared.fileSize')], ['new', t('settings:shared.dateAdded')], ['played', t('settings:shared.lastWatched')],
];
/* 「播完之后」各档的名字，键同 `AFTER_PLAYBACK_CHOICES`。 */
const afterPlaybackOptions = (): readonly Choice[] => [
  ['stop', t('settings:playbackEnd.stop')], ['next', t('settings:playbackEnd.next')], ['repeat-all', t('settings:playbackEnd.repeatAll')],
  ['shuffle', t('settings:playbackEnd.shuffle')], ['repeat-one', t('settings:playbackEnd.repeatOne')],
];
const DIRECTION_OPTIONS: readonly Choice[] =[['desc', t('settings:shared.descending')], ['asc', t('settings:shared.ascending')]];
const JAV_IMAGE_OPTIONS: readonly Choice[] = [['cover', t('settings:preferencesPanel.officialCover'), ''], ['thumbnail', t('settings:preferencesPanel.previewImage'), '']];
/* 新作那一行收不收合集由服务端按数据库里的设置筛，这里的开关只是镜像：真相在 `/api/settings`。 */
const FEED_COMPILATIONS = [
  ['feedHideGroupSetting', 'feedHideGroupCompilations', t('settings:feedCompilations.largeCompilations'), t('settings:feedCompilations.hideLarge')],
  ['feedHideSoloSetting', 'feedHideSoloCompilations', t('settings:feedCompilations.singleActress'), t('settings:feedCompilations.hideSingleActress')],
  ['feedHideExcerptSetting', 'feedHideExcerpts', t('settings:feedCompilations.clips'), t('settings:feedCompilations.hideClips')],
] as const;
type CompilationKey = typeof FEED_COMPILATIONS[number][1];

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]';

interface View { open: boolean; closing: boolean; epoch: number; tab: number; configurable: boolean | null }

let host: SettingsPanelHost | null = null;
let view: View = { open: false, closing: false, epoch: 0, tab: 0, configurable: null };
let transition = 0;
let returnFocus: Element | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener) };
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/* 写进 store 当场画完：句柄返回时面板已经是新的样子，紧跟着的锁滚、取数与焦点读的都是画好的 DOM。
   这一面抛错、被错误边界卸掉之后没人订阅，写进来的只进 store，不画、不抛。 */
function update(patch: Partial<View>): void {
  view = { ...view, ...patch };
  flushSync(notify);
}

/* Peach 配置入口按当前设备的配置权限放行。 */
async function checkMachine(current: SettingsPanelHost): Promise<void> {
  const epoch = view.epoch;
  const configurable = await current.configurable();
  if (!view.open || view.epoch !== epoch) return;
  update({ configurable });
}

function open(section = ''): void {
  const current = host;
  if (!current) return;
  const requested = SECTIONS.findIndex(({ route }) => route === sectionId(section));
  if (view.open && !view.closing) {
    if (requested >= 0 && requested !== view.tab) update({ tab: requested });
    return;
  }
  /* 设置这一屏盖住整页，任何还开着的锚定弹层都得先收掉：设置有侧栏的设置钮、配色弹层的
     「详细设置」和快捷键几处入口，收在这里就不会漏掉哪一处。 */
  closeAnchoredMenu();
  transition += 1;
  returnFocus ||= document.activeElement;
  current.sound('whoosh');
  document.documentElement.style.overflow = 'hidden';
  document.body.classList.add('settings-open');
  /* 先发取数再画：第一次打开时查询还不存在，这一趟由 `fetchQuery` 建起来，组件画出来读到
     的就是在途的这一份，不会再发第二趟。 */
  const remote = refreshPanelData();
  update({ open: true, closing: false, configurable: null, epoch: view.epoch + 1, tab: requested >= 0 ? requested : view.tab });
  void remote.then((settings) => { if (settings) current.syncRemote(settings) });
  void checkMachine(current);
  queueMicrotask(() => document.getElementById('settingsClose')?.focus());
}

function close(notify = true): void {
  if (!view.open || view.closing) return;
  const ticket = ++transition;
  if (notify) host?.closed?.();
  update({ closing: true });
  const finish = () => {
    if (ticket !== transition || !view.closing) return;
    update({ open: false, closing: false });
    document.documentElement.style.overflow = '';
    document.body.classList.remove('settings-open');
    if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { queueMicrotask(finish); return }
  document.querySelector('#settingsPanel > [data-settings-card]')?.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 380);
}

const api: SettingsPanelApi = {
  open,
  close,
  isOpen: () => view.open,
  reveal: (selector) => queueMicrotask(() => document.querySelector(selector)?.scrollIntoView({ block: 'nearest' })),
};

/** 接上壳给的宿主，拿回设置面板的命令式入口。只调一次；壳的 `loadSettingsPanel` 接着在路由树里打开这一面，
 *  画上（收着的）面板之后才交出句柄。 */
export function configureSettingsPanel(next: SettingsPanelHost): SettingsPanelApi {
  host = next;
  return api;
}

/** 常驻表里的那一面：读本模块的 store，宿主还没接上时不画。 */
export function SettingsPanelSurface() {
  const shown = useSyncExternalStore(subscribe, () => view);
  return host ? <SettingsPanel host={host} view={shown} /> : null;
}

function trapTab(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab') return;
  /* 没选中的分区整块 hidden，里面的控件拿不到焦点；圈的两头只在看得见的控件里找。 */
  const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter((node) => node.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

const tabId = (index: number) => `settings-tab-${index}`;
const groupId = (index: number) => `settings-group-${index}`;

/* 左栏当前项由一块滑过去的玻璃标出来，和左侧抽屉是同一件事的两种形态。坐标取 `offsetTop`
   不取屏幕坐标：面板开合自带一段缩放动画，量屏幕坐标会把正在走的那一下吃进来。玻璃跟着指针走，
   指针离开这一列就滑回当前那格；触点没有悬停，碰一下就滑过去等于替用户点了一次，所以挡在外面。 */
function SettingsNav({ tab, epoch, configurable, openConfiguration, onSelect }: {
  tab: number; epoch: number; configurable: boolean | null; openConfiguration(): void; onSelect(index: number): void;
}) {
  const nav = useRef<HTMLDivElement | null>(null);
  const order = useNavigationOrder('preferences');
  const items = order.keys.map(key => {
    const index = SECTIONS.findIndex(section => section.id === key);
    return { ...SECTIONS[index]!, index };
  });
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width:760px)').matches);
  useLayoutEffect(() => {
    const media = matchMedia('(max-width:760px)');
    const changed = () => setNarrow(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const glide = useRef<HTMLSpanElement | null>(null);
  const box = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const shown = useRef(tab);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const place = (active: HTMLElement | null | undefined, animate: boolean) => {
    const pane = glide.current;
    if (!pane) return;
    if (!active || !active.offsetHeight) { pane.hidden = true; return }
    pane.hidden = false;
    const next = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
    const from = box.current;
    box.current = next;
    moveGlidePane(pane, animate ? from : null, next, 'y');
  };
  const placeRef = useRef(place);
  placeRef.current = place;
  const reorder = useSidebarReorder(nav, order.keys, order.commit,
    () => requestAnimationFrame(() => placeRef.current(buttons.current[shown.current], false)), narrow ? 'x' : 'y', 'tab');

  useLayoutEffect(() => {
    const node = nav.current;
    if (!node) return undefined;
    wireHorizontalScroller(node);
    /* 面板收着时这一栏是零尺寸，量不到落点；露出来那一帧、窄屏断点换宽度时都由这一条对齐。 */
    const observer = new ResizeObserver(() => placeRef.current(buttons.current[shown.current], false));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const moved = shown.current !== tab;
    shown.current = tab;
    placeRef.current(buttons.current[tab], moved);
  }, [tab, epoch, order.keys.join(',')]);

  const keys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey) return;
    const count = items.length;
    const position = items.findIndex(item => item.index === index);
    let next = position;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (position + 1) % count;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (position + count - 1) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return;
    event.preventDefault();
    onSelect(items[next].index);
    buttons.current[items[next].index]?.focus();
  };

  /* 整块是一个 tablist：小标题写成 presentation，不占 tab 的位置，方向键从头走到尾。 */
  return (
    <div data-settings-nav="" data-glass-pane="" role="tablist" aria-label={t('settings:preferencesPanel.sectionsLabel')} ref={nav}
      data-navigation-order="preferences" data-navigation-axis={narrow ? 'x' : 'y'} data-reordering={reorder.picked ? '' : undefined}
      onClickCapture={reorder.clickCapture}
      onPointerLeave={(event) => { if (event.pointerType !== 'touch') place(buttons.current[shown.current], true) }}>
      <span data-settings-glide="" aria-hidden="true" hidden ref={glide} />
      <p data-settings-nav-caption="" role="presentation">{t('settings:preferencesPanel.navCaption')}</p>
      {items.map(({ id, title, icon, index }) => (
        <button type="button" role="tab" key={title} id={tabId(index)} aria-controls={groupId(index)}
          data-tab={id} data-dragging={reorder.picked?.key === id ? '' : undefined}
          style={{ '--navigation-picked-left': `${reorder.picked?.bounds.left || 0}px`,
            '--navigation-picked-top': `${reorder.picked?.bounds.top || 0}px`,
            '--navigation-picked-width': `${reorder.picked?.bounds.width || 0}px`,
            '--navigation-picked-offset': `${reorder.picked?.offset || 0}px`,
            '--sidebar-nudge': `${reorder.nudge(id).distance}px`, '--sidebar-delay': `${reorder.nudge(id).delay}ms` } as CSSProperties}
          {...reorder.bindings(id)} aria-keyshortcuts={narrow ? 'Alt+ArrowLeft Alt+ArrowRight' : 'Alt+ArrowUp Alt+ArrowDown'}
          aria-selected={index === tab} tabIndex={index === tab ? 0 : -1}
          ref={(node) => { buttons.current[index] = node }}
          onClick={() => onSelect(index)} onKeyDown={(event) => { reorder.bindings(id).onKeyDown(event); keys(event, index) }}
          onPointerEnter={(event) => { if (event.pointerType !== 'touch') place(event.currentTarget, true) }}>
          {icon === 'jav' ? <Icon name={icon} /> : <RemixIcon name={icon} />}{title}
        </button>
      ))}
      <NavigationDropLine reorder={reorder} />
      <VisuallyHidden role="status" aria-live="polite">{reorder.announcement}</VisuallyHidden>
      <NavigationOrderMenu order={order} />
      <div data-settings-service="" role="presentation">
        <button type="button" disabled={configurable !== true} onClick={openConfiguration}
          title={configurable === false ? t('settings:preferencesPanel.settingsServerOnly') : undefined}>
          <Icon name="folder-cog" />{t('settings:preferencesPanel.openSettings')}<Icon name="chevron-right" />
        </button>
      </div>
    </div>
  );
}

function Group({ index, tab, children, cards = false }: { index: number; tab: number; children: ReactNode; cards?: boolean }) {
  return (
    <section data-setting-group="" data-setting-layout={cards ? 'cards' : undefined}
      id={groupId(index)} role="tabpanel" aria-labelledby={tabId(index)} hidden={index !== tab}>
      <h3>{SECTIONS[index].title}</h3>
      {children}
    </section>
  );
}

/** 一行开关：整行是 label，点哪儿都切。说明那一句的 id 默认取开关 id 去掉 `Setting` 再接 `Description`。 */
function ToggleRow({ id, title, description, describedBy = `${id.replace(/Setting$/, '')}Description`, checked, onToggle }: {
  id: string; title: string; description?: string; describedBy?: string; checked: boolean; onToggle(on: boolean): void;
}) {
  return (
    <label data-setting-row="">
      <span><b>{title}</b>{description ? <small id={describedBy}>{description}</small> : null}</span>
      <input data-toggle="" type="checkbox" id={id} role="switch" aria-describedby={description ? describedBy : undefined}
        checked={checked} onChange={(event) => onToggle(event.target.checked)} />
    </label>
  );
}

function Row({ title, description, kind, children }: {
  title: string; description?: ReactNode; kind?: 'sort' | 'related'; children: ReactNode;
}) {
  return (
    <div data-setting-row="" data-setting-sort={kind === 'sort' ? '' : undefined}
      data-setting-related={kind === 'related' ? '' : undefined}>
      <span><b>{title}</b>{typeof description === 'string' ? <small>{description}</small> : description}</span>
      {children}
    </div>
  );
}

function SettingsPanel({ host: current, view: shown }: { host: SettingsPanelHost; view: View }) {
  /* 订阅只为重画：读的是活对象 `store.value`，版本号本身不用。 */
  useSyncExternalStore(current.store.subscribe, current.store.version);
  const settings = current.store.value;
  const panel = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const head = useRef<HTMLDivElement | null>(null);
  const scroll = useRef<HTMLDivElement | null>(null);
  const resync = useRef<(() => void) | null>(null);
  const lastTab = useRef(shown.tab);

  /* 标题下那道影子的门槛是那段留白自己：它长在这一栏的上内边距上，滚掉它就等于两块重合，
     差 4px 时点亮。留白的值只写在 `--settings-gap` 一处，这里读它。 */
  const fade = () => {
    const [box, body] = [card.current, scroll.current];
    if (!box || !body) return;
    const gap = parseFloat(getComputedStyle(box).getPropertyValue('--settings-gap')) || 0;
    box.toggleAttribute('data-scrolled', body.scrollTop > Math.max(gap - 4, 0));
  };
  const fadeRef = useRef(fade);
  fadeRef.current = fade;

  useLayoutEffect(() => {
    const body = scroll.current;
    if (!body || !panel.current) return undefined;
    resync.current = attachOverlayScrollbar(body) ?? resync.current;
    current.attached(panel.current);
    const listener = () => fadeRef.current();
    body.addEventListener('scroll', listener, { passive: true });
    return () => body.removeEventListener('scroll', listener);
  }, [current]);
  /* 换分区、每次打开都回到顶上；换了分区时标题逐字揭示，只开合不放。 */
  useLayoutEffect(() => {
    const moved = lastTab.current !== shown.tab;
    lastTab.current = shown.tab;
    if (scroll.current) scroll.current.scrollTop = 0;
    if (moved && head.current) revealTexts(head.current, 'h2');
    fadeRef.current();
  }, [shown.tab, shown.epoch]);
  /* 换分区、展开收起一组都只切 `hidden`，滚动条的观察器只看子树增删，内容长短变了它不知道。
     每次画完按新的内容长度重量一遍滑块和两端渐隐。 */
  useLayoutEffect(() => { resync.current?.() });

  const epoch = shown.epoch;
  const select = (index: number) => { if (index !== view.tab) { update({ tab: index }); current.selectSection?.(SECTIONS[index].title) } };
  const save = () => current.store.save();

  return (
    <section data-settings-panel="" id="settingsPanel" hidden={!shown.open} aria-modal="true" role="dialog"
      aria-labelledby="settingsTitle" data-closing={shown.closing ? '' : undefined} ref={panel} onKeyDown={trapTab}
      onClick={(event) => { if (event.target === event.currentTarget) close() }}>
      <div data-settings-card="" ref={card}>
        <div data-settings-head="" ref={head}>
          <h2 id="settingsTitle">{SECTIONS[shown.tab].title}</h2>
            <SettingsDialogClose id="settingsClose" label={t('settings:preferencesPanel.close')} onPress={() => close()} />
        </div>
        <SettingsNav tab={shown.tab} epoch={epoch} configurable={shown.configurable} onSelect={select}
          openConfiguration={() => { close(false); current.openConfiguration() }} />
        <div data-settings-scroll="" ref={scroll}>
          <Group index={0} tab={shown.tab} cards>
            <div data-setting-card="">
            <Row title={t('settings:preferencesPanel.theme')}>
              <IconSwitch id="themeSetting" name="theme" legend={t('settings:preferencesPanel.theme')} options={current.themeOptions} value={settings.theme}
                attr="data-theme-choice" variant="themeswitch" epoch={epoch}
                onChoose={(choice) => { settings.theme = choice; save(); current.changed('theme') }} />
            </Row>
            <InterfaceLanguageSetting host={current} epoch={epoch} />
            <div data-setting-row="">
              <label htmlFor="glassContrastSetting"><b>{t('settings:preferencesPanel.increaseContrast')}</b></label>
              <input type="checkbox" id="glassContrastSetting" data-toggle="" role="switch" checked={current.highContrast()}
                onChange={(event) => current.setHighContrast(event.target.checked)} />
            </div>
            <ToggleRow id="uiSoundsSetting" title={t('settings:preferencesPanel.interfaceSounds')} checked={settings.uiSounds}
              onToggle={(on) => { settings.uiSounds = on; save(); current.changed('uiSounds') }} />
            <ToggleRow id="ingestNoticesSetting" title={t('settings:preferencesPanel.ingestNotices')} checked={settings.ingestNotices}
              onToggle={(on) => { settings.ingestNotices = on; save() }} />
            <ToggleRow id="homeGlowSetting" title={t('settings:preferencesPanel.sidebarGlow')} checked={settings.homeGlow.on}
              onToggle={(on) => { settings.homeGlow.on = on; save(); current.changed('glow') }} />
            </div>
            <GlowSettings host={current} />
            <section data-setting-block="" aria-labelledby="sidebarOrderTitle">
              <h4 data-settings-subheading="" id="sidebarOrderTitle">{t('settings:preferencesPanel.navigationOrder')}</h4>
              <div data-setting-card="">
                <section data-sidebar-setting=""><SidebarOrder host={current} /></section>
              </div>
              <div data-setting-card="">
                <section data-sidebar-setting=""><NavigationOrderPreferences /></section>
              </div>
            </section>
          </Group>
          <BrowseGroup host={current} tab={shown.tab} epoch={epoch} />
          <JavGroup host={current} tab={shown.tab} epoch={epoch} />
          <Group index={3} tab={shown.tab}>
            <SearchHistoryRow host={current} epoch={epoch} />
            <ToggleRow id="searchRecommendationsSetting" title={t('settings:preferencesPanel.searchRecommendations')}
              checked={settings.searchRecommendations}
              onToggle={(on) => { settings.searchRecommendations = on; save(); current.changed('searchRecommendations') }} />
            <Row title={t('settings:preferencesPanel.relatedLimit')}>
              <div id="relatedLimitSetting">
                <NumberSetting key={epoch} id="relatedLimitSetting" label={t('settings:preferencesPanel.relatedLimit')} value={settings.relatedLimit}
                  onApply={(value) => { settings.relatedLimit = value; save() }} />
              </div>
            </Row>
            <Row title={t('settings:preferencesPanel.tasteAndHistory')}><div className="peach-react"><ButtonLink variant="secondary" href="/taste" onClick={() => close(false)}>{t('settings:preferencesPanel.openTaste')}</ButtonLink></div></Row>
          </Group>
          <Group index={4} tab={shown.tab}>
            <ToggleRow id="censorSetting" title={t('settings:preferencesPanel.sfwMode')} describedBy="sfwDescription" checked={current.censored()}
              description={t('settings:preferencesPanel.sfwModeHelp')}
              onToggle={(on) => current.setCensored(on)} />
            <ShortcutSetting current={current.sfwShortcut()} onChange={current.setSfwShortcut} />
          </Group>
        </div>
      </div>
    </section>
  );
}

interface GroupProps { host: SettingsPanelHost; tab: number; epoch: number }

/* 排序方向那一格叠着两枚箭头，换的只是方向这一件事：整格重写会把旧字形连同它的动画一起丢掉，
   读出来是一次硬切，所以只在这一格还没建起来时写一次。 */
function decorateDirection(field: HTMLElement, ascending: boolean): void {
  const mark = field.querySelector('[data-select-label]');
  if (!mark) return;
  if (!mark.querySelector('[data-icon-swap]')) {
    mark.innerHTML = iconSwapHtml('arrow-up', 'arrow-down', 'a', { className: 'gselectmark', iconClass: 'gselectmark' })
      + '<span data-sort-direction-label></span>';
  }
  setIconSwap(mark, ascending ? 'a' : 'b');
  const label = mark.querySelector('[data-sort-direction-label]');
  if (label) label.textContent = ascending ? t('settings:shared.ascending') : t('settings:shared.descending');
}

/* 「浏览与播放」分两段：作品列表（网格、排序、卡片与悬停）在前，播放在后。转码方式写的是运行 Peach
   那台电脑的配置，在 Peach 配置「应用与维护 → 视频播放」，不在这里（ADR-0103）。 */
function BrowseGroup({ host: current, tab, epoch }: GroupProps) {
  const settings = current.store.value;
  const save = () => current.store.save();
  const random = settings.defaultSort === 'seed';
  const ascending = settings.defaultSortDirection === 'asc';
  return (
    <Group index={1} tab={tab}>
      <h4 data-settings-subheading="">{t('settings:preferencesPanel.videoList')}</h4>
      <Row title={t('settings:preferencesPanel.batchSize')}>
        <div id="batchSizeSetting">
          <NumberSetting key={epoch} id="batchSizeSetting" label={t('settings:preferencesPanel.batchSizeInput')} value={settings.batchSize}
            onApply={(value) => { settings.batchSize = value || 60; save(); current.changed('batchSize') }} />
        </div>
      </Row>
      <Row title={t('settings:preferencesPanel.defaultSort')} kind="sort">
        <div data-setting-sort-controls="">
          <SelectField id="defaultSortSetting" label={t('settings:preferencesPanel.defaultSort')} options={SORT_OPTIONS} value={settings.defaultSort} epoch={epoch}
            onPick={(value) => { settings.defaultSort = value; save(); current.changed('defaultSort') }} />
          <SelectField id="defaultSortDirectionSetting" label={t('settings:preferencesPanel.defaultSortDirection')} options={DIRECTION_OPTIONS}
            value={ascending ? 'asc' : 'desc'} hidden={random} disabled={random} epoch={epoch}
            onPick={(value) => { settings.defaultSortDirection = value; save(); current.changed('sortDirection') }}
            decorate={(field) => decorateDirection(field, ascending)} />
        </div>
      </Row>
      <Row title={t('settings:preferencesPanel.videoCardSize')}>
        <IconSwitch id="javSizeSetting" name="video-size" legend={t('settings:preferencesPanel.videoCardSize')} options={current.videoLayouts}
          value={current.videoLayout()} attr="data-video-layout" variant="javimageswitch" text epoch={epoch}
          onChoose={(layout) => current.setVideoLayout(layout)} />
      </Row>
      <label data-setting-row=""><span><b>{t('settings:preferencesPanel.groupEditions')}</b></span>
        <input type="checkbox" id="groupCollapseSetting" data-toggle="" role="switch" checked={settings.groupCollapse}
          onChange={(event) => { settings.groupCollapse = event.target.checked; save(); current.changed('groupCollapse') }} />
      </label>
      <ToggleRow id="hoverPreviewSetting" title={t('settings:preferencesPanel.hoverPreview')} checked={settings.hoverPreview}
        onToggle={(on) => { settings.hoverPreview = on; save(); current.changed('hoverPreview') }} />
      {/* SFW 模式与关掉悬停预览时延迟不起作用：禁用，SFW 另加说明。 */}
      <Row title={t('settings:preferencesPanel.hoverDelay')}
        description={current.censored() ? t('settings:preferencesPanel.hoverDelaySfw') : undefined}>
        <div id="hoverDelaySetting">
          <NumberSetting key={epoch} id="hoverDelaySetting" label={t('settings:preferencesPanel.hoverDelay')} value={settings.hoverDelaySeconds}
            disabled={current.censored() || !settings.hoverPreview}
            onApply={(value) => {
              settings.hoverDelaySeconds = boundedPreference(value, 0, 60, 5); save(); current.changed('hoverDelay');
            }} />
        </div>
      </Row>
      <Row title={t('settings:preferencesPanel.homeShorts')}>
        <div id="homeShortsSetting">
          <NumberSetting key={epoch} id="homeShortsSetting" label={t('settings:preferencesPanel.homeShorts')} value={settings.homeShortsLimit}
            onApply={(value) => { settings.homeShortsLimit = value; save(); current.changed('homeShorts') }} />
        </div>
      </Row>
      <ToggleRow id="homeTiersSetting" title={t('settings:preferencesPanel.homeTiers')} checked={settings.homeTiers}
        onToggle={(on) => { settings.homeTiers = on; save(); current.changed('homeTiers') }} />
      <ToggleRow id="homePreviewOnlySetting" title={t('settings:preferencesPanel.homePreviewOnly')} checked={settings.homePreviewOnly}
        onToggle={(on) => { settings.homePreviewOnly = on; save(); current.changed('homePreviewOnly') }} />
      <ToggleRow id="completionPromptSetting" title={t('settings:preferencesPanel.completionPrompt')} checked={settings.completionPrompt}
        onToggle={(on) => { settings.completionPrompt = on; save() }} />
      <h4 data-settings-subheading="">{t('settings:preferencesPanel.playbackHeading')}</h4>
      <PlaybackRows host={current} epoch={epoch} />
    </Group>
  );
}

function JavGroup({ host: current, tab, epoch }: GroupProps) {
  const settings = current.store.value;
  const save = () => current.store.save();
  return (
    <Group index={2} tab={tab}>
      <h4 data-settings-subheading="">{t('settings:preferencesPanel.videoDisplay')}</h4>
      <NameLanguageSetting host={current} epoch={epoch} />
      <Row title={t('settings:preferencesPanel.defaultImage')}>
        <IconSwitch id="javImageSetting" name="jav-image" legend={t('settings:preferencesPanel.defaultImage')} options={JAV_IMAGE_OPTIONS}
          value={settings.javImage} attr="data-jav-image-choice" variant="javimageswitch" text epoch={epoch}
          onChoose={(choice) => { settings.javImage = normalizeJavImage(choice); save(); current.changed('javImage') }} />
      </Row>
      <h4 data-settings-subheading="">{t('settings:preferencesPanel.newReleases')}</h4>
      <ToggleRow id="feedNewRowsSetting" title={t('settings:preferencesPanel.feedNewRows')} checked={settings.feedNewRows}
        onToggle={(on) => { settings.feedNewRows = on; save(); current.changed('feedNewRows') }} />
      {/* 数量与自动滚动只作用于首页和人物页的新作行：行关了就收起；合集开关还管「JAV → 新作」与未读数，照常显示。 */}
      {settings.feedNewRows ? <>
        <Row title={t('settings:preferencesPanel.feedLimit')}>
          <div id="feedLimitSetting">
            <NumberSetting key={epoch} id="feedLimitSetting" label={t('settings:preferencesPanel.feedLimitInput')} value={settings.feedLimit}
              onApply={(value) => { settings.feedLimit = boundedPreference(value, 1, 100, 12); save(); current.changed('feedLimit') }} />
          </div>
        </Row>
        <ToggleRow id="feedAutoScrollSetting" title={t('settings:preferencesPanel.autoScroll')} checked={settings.feedAutoScroll}
          onToggle={(on) => { settings.feedAutoScroll = on; save(); current.changed('feedAutoScroll') }} />
      </> : null}
      {FEED_COMPILATIONS.map(([id, key, label, title]) => (
        <CompilationToggle key={id} host={current} id={id} settingKey={key} label={label} title={title} />
      ))}
    </Group>
  );
}
/* 「自动」只写一个词：手机上选择框窄，括号里再带语言名会把标题挤成两行，页面本身已经在用探测出的语言。 */
const languageChoices = (): readonly (readonly [InterfaceLanguageChoice, string])[] =>
  [['auto', t('settings:interfaceLanguage.auto')], ...INTERFACE_LANGUAGES.map(code => [code, LANGUAGE_SELF_NAMES[code]] as const)];
/* 存进数据库、回来交壳对账；壳发现本地那份变了就整页重载，换成新语言。 */
function InterfaceLanguageSetting({ host: current, epoch }: { host: SettingsPanelHost; epoch: number }) {
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: ({ signal }) => fetchSettings(signal), staleTime: 0 });
  const save = useSaveSettings();
  const [pending, setPending] = useState<InterfaceLanguageChoice | null>(null);
  const language = query.data?.interfaceLanguage;
  const choices = languageChoices();
  return <>
    <Row title={t('settings:interfaceLanguage.title')}
      description={<small>{t('settings:interfaceLanguage.help')}</small>}>
      <SelectField id="interfaceLanguageSetting" label={t('settings:interfaceLanguage.title')} epoch={epoch}
        options={choices}
        value={pending ?? language ?? current.store.value.interfaceLanguage}
        disabled={query.isPending || query.isError || save.isPending || !language} busy={save.isPending}
        onPick={(value) => {
          if (save.isPending || !isInterfaceLanguageChoice(value) || value === language) return;
          setPending(value);
          save.mutate({ interfaceLanguage: value }, {
            onSuccess: (saved) => { current.receipt(t('settings:interfaceLanguage.saved')); current.syncRemote(saved) },
            onError: (error) => current.failure(t('settings:interfaceLanguage.saveFailed'), error),
            onSettled: () => setPending(null),
          });
        }} />
    </Row>
    {query.isError ? <Note tone="error">{t('settings:interfaceLanguage.unavailable')}</Note> : null}
  </>;
}
function NameLanguageSetting({ host: current, epoch }: { host: SettingsPanelHost; epoch: number }) {
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: ({ signal }) => fetchSettings(signal), staleTime: 0 });
  const save = useSaveSettings();
  const [pending, setPending] = useState<NameLanguage | null>(null);
  const language = query.data?.performerNameLanguage;
  return <>
    <Row title={t('settings:performerNameLanguage.title')} description={<small data-copy-key="performer-name-language-help">{t('settings:performerNameLanguage.help')}</small>}>
      <SelectField id="performerNameLanguageSetting" label={t('settings:performerNameLanguage.title')} epoch={epoch}
        options={[["zh-CN", t('settings:performerNameLanguage.chinese')], ["ja", t('settings:performerNameLanguage.japanese')],
          ["en", t('settings:performerNameLanguage.romaji')], ["ja-local", t('settings:performerNameLanguage.japaneseThenLocal')],
          ["local-ja", t('settings:performerNameLanguage.localThenJapanese')]]}
        value={pending ?? language ?? current.store.value.performerNameLanguage}
        disabled={query.isPending || query.isError || save.isPending || !language} busy={save.isPending}
        onPick={(value) => {
          const choice = value as NameLanguage;
          if (save.isPending || !NAME_LANGUAGES.includes(choice) || choice === language) return;
          setPending(choice);
          save.mutate({ performerNameLanguage: choice }, {
            onSuccess: (saved) => { current.syncRemote(saved); current.receipt(t('settings:performerNameLanguage.saved')) },
            onError: (error) => current.failure(t('settings:performerNameLanguage.saveFailed'), error),
            onSettled: () => setPending(null),
          });
        }} />
    </Row>
    {query.isError ? <Note tone="error">{t('settings:performerNameLanguage.unavailable')}</Note> : null}
  </>;
}
/* 合集开关由服务端判，列表、未读数和补封面排队都跟着它，所以先存到服务端再重画；往返期间开关
   停在新位置、挂忙态，失败退回原位。 */
function CompilationToggle({ host: current, id, settingKey, label, title }: {
  host: SettingsPanelHost; id: string; settingKey: CompilationKey; label: string; title: string;
}) {
  const save = useSaveSettings();
  const [pending, setPending] = useState<boolean | null>(null);
  const box = useRef<HTMLInputElement | null>(null);
  const settings: PanelSettings = current.store.value;
  const toggle = (on: boolean) => {
    setPending(on);
    setActionBusy(box.current);
    save.mutate({ [settingKey]: on }, {
      onSuccess: (saved) => {
        settings[settingKey] = saved[settingKey] === true;
        current.store.save();
        current.changed('feedCompilations');
        current.receipt(on ? t('settings:feedCompilations.hidden', { label }) : t('settings:feedCompilations.shown', { label }));
      },
      onError: (error) => current.failure(t('settings:feedCompilations.saveFailed', { label }), error),
      onSettled: () => { setPending(null); setActionBusy(box.current, false) },
    });
  };
  return (
    <label data-setting-row="">
      <span><b>{title}</b></span>
      <input data-toggle="" type="checkbox" id={id} role="switch" ref={box}
        checked={pending ?? settings[settingKey]} onChange={(event) => toggle(event.target.checked)} />
    </label>
  );
}

/** 长按倍速的几档；归一化范围是 1.25～4（`normalizeGestures`）。 */
const HOLD_RATES = [1.5, 2, 3, 4] as const;

function PlaybackRows({ host: current, epoch }: Omit<GroupProps, 'tab'>) {
  const settings = current.store.value;
  const save = () => current.store.save();
  return (
    <>
      <ToggleRow id="detailAutoplaySetting" title={t('settings:preferencesPanel.detailAutoplay')} checked={settings.detailAutoplay}
        onToggle={(on) => { settings.detailAutoplay = on; save() }} />
      <ToggleRow id="autoChineseSubtitlesSetting" title={t('settings:preferencesPanel.autoChineseSubtitles')}
        description={t('settings:preferencesPanel.autoChineseSubtitlesHelp')}
        checked={settings.autoChineseSubtitles} onToggle={(on) => { settings.autoChineseSubtitles = on; save() }} />
      <Row title={t('settings:playbackEnd.title')}>
        <SelectField id="afterPlaybackSetting" label={t('settings:playbackEnd.title')} options={afterPlaybackOptions()} value={settings.afterPlayback} epoch={epoch}
          onPick={(value) => { settings.afterPlayback = allowedSetting(value, AFTER_PLAYBACK_CHOICES, 'next'); save() }} />
      </Row>
      <Row title={t('settings:playbackEnd.restart')} description={t('settings:playbackEnd.restartHelp')}>
        <div id="resumeRestartSetting">
          <NumberSetting key={epoch} id="resumeRestartSetting" label={t('settings:playbackEnd.restart')} value={settings.resumeRestartPercent}
            onApply={(value) => { settings.resumeRestartPercent = boundedPreference(value, 0, 20, 5); save() }} />
        </div>
      </Row>
      <ToggleRow id="miniplayerSetting" title={t('settings:preferencesPanel.miniPlayer')} checked={settings.miniplayer}
        onToggle={(on) => { settings.miniplayer = on; save(); current.changed('miniplayer') }} />
      <Row title={t('settings:preferencesPanel.seekStep')}>
        <div id="seekSecondsSetting">
          <NumberSetting key={epoch} id="seekSecondsSetting" label={t('settings:preferencesPanel.seekStepInput')} value={settings.seekSeconds}
            onApply={(value) => { settings.seekSeconds = value || 10; save(); current.changed('seekSeconds') }} />
        </div>
      </Row>
      {/* 长按倍速也管右方向键，不随画面手势开关收起；拖动与双击区只在画面手势开着时有用。 */}
      <Row title={t('settings:playbackGestures.holdRate')}>
        <SelectField id="holdRateSetting" label={t('settings:playbackGestures.holdRate')} epoch={epoch}
          options={HOLD_RATES.map((rate) => [String(rate), `${rate}×`] as Choice)} value={String(settings.holdRate)}
          onPick={(value) => { settings.holdRate = normalizeGestures({ holdRate: Number(value) }).holdRate; save() }} />
      </Row>
      <ToggleRow id="touchGesturesSetting" title={t('settings:playbackGestures.touch')} checked={settings.touchGestures}
        onToggle={(on) => { settings.touchGestures = on; save() }} />
      {settings.touchGestures ? <>
        <Row title={t('settings:playbackGestures.swipeMinutes')}>
          <div id="swipeMinutesSetting">
            <NumberSetting key={epoch} id="swipeMinutesSetting" label={t('settings:playbackGestures.swipeMinutes')} value={settings.swipeMinutes}
              onApply={(value) => { settings.swipeMinutes = normalizeGestures({ swipeMinutes: value }).swipeMinutes; save() }} />
          </div>
        </Row>
        <Row title={t('settings:playbackGestures.doubleTapPercent')}>
          <div id="doubleTapPercentSetting">
            <NumberSetting key={epoch} id="doubleTapPercentSetting" label={t('settings:playbackGestures.doubleTapPercent')} value={settings.doubleTapPercent}
              onApply={(value) => { settings.doubleTapPercent = normalizeGestures({ doubleTapPercent: value }).doubleTapPercent; save() }} />
          </div>
        </Row>
      </> : null}
      <ToggleRow id="autoFullscreenSetting" title={t('settings:playbackGestures.autoFullscreen')} checked={settings.autoFullscreen}
        onToggle={(on) => { settings.autoFullscreen = on; save() }} />
    </>
  );
}

function SearchHistoryRow({ host: current, epoch }: { host: SettingsPanelHost; epoch: number }) {
  const settings = current.store.value;
  const save = useSaveSettings();
  /* 条数跟着数据库走（`/api/settings`），所有访问端看到同一个数；本地那份只是镜像。 */
  return (
    <Row title={t('settings:preferencesPanel.searchHistoryLimit')}>
      <div id="searchHistoryLimitSetting">
        <NumberSetting key={epoch} id="searchHistoryLimitSetting" label={t('settings:preferencesPanel.searchHistoryInput')} value={settings.searchHistoryLimit}
          onApply={(value) => {
            settings.searchHistoryLimit = boundedPreference(value, 0, 50, 10);
            current.store.save();
            current.changed('searchHistoryLimit');
            save.mutate({ searchHistoryLimit: settings.searchHistoryLimit }, { onError: () => {} });
          }} />
      </div>
    </Row>
  );
}
