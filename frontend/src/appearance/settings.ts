/* 界面偏好的默认值、启动归一化与唯一 store（peach.settings.v1）。
 * Application、设置面板、侧栏与配色弹层通过共享源码读写同一个对象。
 * 首次 appSettingsStore() 从 localStorage 读取、归一化并创建实例，启动阶段同步就位。
 * 存量只接受形状与范围合法的值，单项非法时取该项默认值。 */
import { api } from '@peach/legacy/core';

import { isInterfaceLanguageChoice, matchInterfaceLanguage, type InterfaceLanguage, type InterfaceLanguageChoice } from '../i18n';
import { SETTINGS_KEY } from '../settings-key';

import { normalizeJavPreferences } from '../jav-artwork';
import { boundedPreference } from '../number-setting';
import { createSettingsStore, type SettingsStore } from '../settings-store';
import { MANAGE_MENU_SECTIONS, normalizeManageOrder } from '../application/navigation-items';
import { DEFAULT_SIDEBAR_ORDER, normalizeSidebarOrder } from '../sidebar';
import { normalizeNavigationOrders, type NavigationOrders } from '../navigation-order';
import { SORT_ALIASES, SORT_KEYS } from '../sort-preferences';
import { normalizeSortControls, type SortControls } from '../sort-controls';
import { DEFAULT_ACCENT, DEFAULT_HOME_GLOW, normalizeAccent, normalizeHomeGlow, type HomeGlow } from './home-glow';
import { NAME_LANGUAGES, type NameLanguage } from '../core/entity-names';
import { configureGestureSettings, normalizeGestures, type GestureSettings } from '../player/gesture-settings';

export { SETTINGS_KEY };
/* 主题三档，键名与 <html> 上的 data-theme 同一套写法：web/css/01-base.css 的色板
   已经按 `prefers-color-scheme` 和 `[data-theme]` 两条路径写好，这里只负责选哪一条。
   跟随系统是默认档，选它等于不写属性。 */
export const THEME_CHOICES: readonly string[] = ['system', 'light', 'dark'];
/** 关注首次采集往回取多少天；与数据库那一份同一张表。 */
export const FOLLOW_INITIAL_DAYS: readonly number[] = [0, 7, 30, 90];
/* 新作那一行收不收合集由服务端按数据库里的设置筛（列表、未读数、补封面同一份），这里只是
   镜像：开关的真相在 `/api/settings`。默认收起大合集与切片、单人合集照列。 */
/** 首页竖屏带一条放几张：默认与上下限，设置面板的数值框同一组数。 */
export const HOME_SHORTS_DEFAULT = 18;
export const HOME_SHORTS_MIN = 6;
export const HOME_SHORTS_MAX = 60;
export const FEED_COMPILATION_KEYS = ['feedHideGroupCompilations', 'feedHideSoloCompilations', 'feedHideExcerpts'] as const;
/** 播完一条之后怎么接：停下、顺序、列表循环、随机、单片循环。顺序与循环、随机只在播放列表和 Mix 队列里有下一条可接。 */
export const AFTER_PLAYBACK_CHOICES = ['stop', 'next', 'repeat-all', 'shuffle', 'repeat-one'] as const;
export type AfterPlayback = typeof AFTER_PLAYBACK_CHOICES[number];

/** 归一化之后一定在的那几项。对象上还有别的字段（壳与各岛按需写入），这里不一一列出。 */
export interface AppSettings {
  [key: string]: unknown;
  batchSize: number;
  defaultSort: string;
  defaultSortDirection?: string;
  sortDefaultsVersion: number;
  hoverDelaySeconds: number;
  /** 卡片悬停时播放视频预览；关掉后悬停只显示静态图（#170）。 */
  hoverPreview: boolean;
  /** 播放器画面手势（触屏与鼠标的长按、拖动、双击）的总开关与数值，播放器经 `wireGestureSettings` 现读。 */
  touchGestures: boolean;
  holdRate: number;
  swipeMinutes: number;
  doubleTapPercent: number;
  /** 手机、平板上点播放时横版视频自动全屏（#618）。 */
  autoFullscreen: boolean;
  seekSeconds: number;
  searchHistoryLimit: number;
  relatedLimit: number;
  feedLimit: number;
  javLayout: string;
  homeLayout: string;
  javImage: string;
  performerNameLanguage: NameLanguage;
  interfaceLanguage: InterfaceLanguageChoice;
  /** 运行 Peach 的电脑的系统语言（服务端报来，缓存在本地）；「自动」时浏览器语言都对不上才看它。 */
  systemLanguage: InterfaceLanguage | null;
  followLayout: string;
  peopleLayout: string;
  photoSize: string;
  photoLayout?: string;
  followImagesOnly?: boolean;
  ambientMode: boolean;
  miniplayer: boolean;
  theaterMode: boolean;
  theme: string;
  groupCollapse: boolean;
  detailAutoplay: boolean;
  /** 没手动选过字幕的影片，打开时自动选同目录的中文字幕；默认关。 */
  autoChineseSubtitles: boolean;
  afterPlayback: AfterPlayback;
  /** 离片尾不到这个百分比就当看完，下次从头播；0 表示只有播完才从头。 */
  resumeRestartPercent: number;
  uiSounds: boolean;
  feedAutoScroll: boolean;
  /** 首页的新作那一行；人物页的那一行不归它管。 */
  feedNewRows: boolean;
  /** 首页竖屏带一条放几张；0 是不插带子，竖屏回到主网格里。 */
  homeShortsLimit: number;
  /** 首页顶上女优、厂牌两排头像。 */
  homeTiers: boolean;
  /** 首页默认只显示有预览图的作品；首页读数旁的「显示全部」临时看全部。 */
  homePreviewOnly: boolean;
  /** 网格、列表与详情里的缺图补全提示条；条上的关闭钮把它写成 false。 */
  completionPrompt: boolean;
  /** 聚焦空搜索框时的推荐栏、推荐词与轮换的占位字。 */
  searchRecommendations: boolean;
  /** 新文件入库、下载完成时的 toast。 */
  ingestNotices: boolean;
  feedHideGroupCompilations: boolean;
  feedHideSoloCompilations: boolean;
  feedHideExcerpts: boolean;
  followInitialDays: number;
  sidebarOrder: string[];
  manageOrder: string[];
  navigationOrders: NavigationOrders;
  sortControls: SortControls;
  libraryOrder: string[];
  homeGlow: HomeGlow;
  accent: string;
}

export const DEFAULT_SETTINGS = {
  batchSize: 60, defaultSort: 'seed', sortDefaultsVersion: 3, hoverDelaySeconds: 5, seekSeconds: 10,
  searchHistoryLimit: 10, relatedLimit: 20, feedLimit: 12, javLayout: 'big', homeLayout: 'small', javImage: 'cover',
  followLayout: 'default', peopleLayout: 'big', photoSize: 'small', ambientMode: true, miniplayer: true,
  theaterMode: false, theme: 'system', groupCollapse: true, sidebarOrder: [...DEFAULT_SIDEBAR_ORDER], manageOrder: [...MANAGE_MENU_SECTIONS],
  homeGlow: DEFAULT_HOME_GLOW, accent: DEFAULT_ACCENT, performerNameLanguage: 'zh-CN', interfaceLanguage: 'auto', systemLanguage: null,
  navigationOrders: {},
  sortControls: {},
  libraryOrder: [],
} as const;

/** 白名单里的值原样给回，否则给 `fallback`。 */
export const allowedSetting = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? value as T : fallback;

/** 读回的那份存量归一化成完整的偏好对象。`migrated` 为真表示改写了旧键，要落一次盘。 */
export function normalizeAppSettings(raw: unknown): { settings: AppSettings; migrated: boolean } {
  const saved = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const settings = { ...DEFAULT_SETTINGS, ...saved } as Record<string, unknown>;
  settings.followInitialDays = FOLLOW_INITIAL_DAYS.includes(+(settings.followInitialDays as number))
    ? +(settings.followInitialDays as number) : 30;
  delete settings.rotateMinutes;
  /* 迁移只碰默认值本身：把界面上已经不存在的键换成当前键，用户主动选过的排序不动。
     不迁移的话白名单会把它静默打回随机。 */
  let migrated = false;
  const version = +(settings.sortDefaultsVersion as number) || 0;
  if (version < 2 && settings.defaultSort === 'new') { settings.defaultSort = 'seed'; migrated = true }
  const alias = SORT_ALIASES[settings.defaultSort as string];
  if (version < 3 && alias) { settings.defaultSort = alias[0]; migrated = true }
  settings.sortDefaultsVersion = 3;
  settings.batchSize = boundedPreference(+(settings.batchSize as number), 1, 200, 60);
  settings.defaultSort = allowedSetting(settings.defaultSort, SORT_KEYS, 'seed');
  settings.hoverDelaySeconds = boundedPreference(+(settings.hoverDelaySeconds as number), 0, 60, 5);
  settings.hoverPreview = settings.hoverPreview !== false;
  const gestures = normalizeGestures(settings as Partial<GestureSettings>);
  settings.touchGestures = gestures.touchGestures;
  settings.holdRate = gestures.holdRate;
  settings.swipeMinutes = gestures.swipeMinutes;
  settings.doubleTapPercent = gestures.doubleTapPercent;
  settings.autoFullscreen = gestures.autoFullscreen;
  settings.seekSeconds = boundedPreference(+(settings.seekSeconds as number), 1, 300, 10);
  delete settings.loginDays;
  delete settings.metadataRefreshDays;
  settings.ambientMode = settings.ambientMode !== false;
  settings.theaterMode = settings.theaterMode === true;
  settings.groupCollapse = settings.groupCollapse !== false;
  settings.detailAutoplay = settings.detailAutoplay !== false;
  settings.autoChineseSubtitles = settings.autoChineseSubtitles === true;
  settings.afterPlayback = allowedSetting(settings.afterPlayback, AFTER_PLAYBACK_CHOICES, 'next');
  settings.resumeRestartPercent = boundedPreference(+(settings.resumeRestartPercent as number), 0, 20, 5);
  settings.miniplayer = settings.miniplayer !== false;
  settings.uiSounds = settings.uiSounds !== false;
  settings.feedAutoScroll = settings.feedAutoScroll !== false;
  settings.feedNewRows = settings.feedNewRows !== false;
  settings.homeShortsLimit = settings.homeShortsLimit === 0 ? 0
    : boundedPreference(+(settings.homeShortsLimit as number), HOME_SHORTS_MIN, HOME_SHORTS_MAX, HOME_SHORTS_DEFAULT);
  settings.homeTiers = settings.homeTiers !== false;
  settings.homePreviewOnly = settings.homePreviewOnly === true;
  settings.completionPrompt = settings.completionPrompt !== false;
  settings.searchRecommendations = settings.searchRecommendations !== false;
  settings.ingestNotices = settings.ingestNotices !== false;
  settings.feedHideGroupCompilations = settings.feedHideGroupCompilations !== false;
  settings.feedHideSoloCompilations = settings.feedHideSoloCompilations === true;
  settings.feedHideExcerpts = settings.feedHideExcerpts !== false;
  settings.searchHistoryLimit = boundedPreference(+(settings.searchHistoryLimit as number), 0, 50, 10);
  settings.relatedLimit = boundedPreference(+(settings.relatedLimit as number), 0, 60, 20);
  settings.feedLimit = boundedPreference(+(settings.feedLimit as number), 1, 100, 12);
  Object.assign(settings, normalizeJavPreferences(settings));
  settings.theme = allowedSetting(settings.theme, THEME_CHOICES, 'system');
  settings.performerNameLanguage = allowedSetting(settings.performerNameLanguage, NAME_LANGUAGES, 'zh-CN');
  settings.interfaceLanguage = isInterfaceLanguageChoice(settings.interfaceLanguage) ? settings.interfaceLanguage : 'auto';
  settings.systemLanguage = matchInterfaceLanguage(settings.systemLanguage);
  settings.homeGlow = normalizeHomeGlow(settings.homeGlow);
  settings.accent = normalizeAccent(settings.accent);
  settings.sidebarOrder = normalizeSidebarOrder(settings.sidebarOrder);
  settings.manageOrder = normalizeManageOrder(settings.manageOrder);
  settings.navigationOrders = normalizeNavigationOrders(settings.navigationOrders);
  settings.sortControls = normalizeSortControls(settings.sortControls);
  settings.libraryOrder = Array.isArray(settings.libraryOrder) ? [...new Set(settings.libraryOrder.filter(key => typeof key === 'string'))] : [];
  return { settings: settings as AppSettings, migrated };
}

/** 从 `storage` 读回并归一化；存的不是合法 JSON 时当作什么都没存。 */
export function readAppSettings(storage: Pick<Storage, 'getItem'>): { settings: AppSettings; migrated: boolean } {
  let raw: unknown = {};
  try { raw = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}') } catch { /* 坏掉的存量按空的算 */ }
  return normalizeAppSettings(raw);
}

let store: SettingsStore<AppSettings> | null = null;

/** 整页那一份偏好 store。第一次调用时读回、归一化；改写过旧键就当场落一次盘。 */
export function appSettingsStore(): SettingsStore<AppSettings> {
  if (store) return store;
  const { settings, migrated } = readAppSettings(localStorage);
  store = createSettingsStore(SETTINGS_KEY, settings);
  if (migrated) store.save();
  return store;
}

/** 播放器的手势数值读这份偏好：交一个现读的取值函数，设置面板改完不用再通知播放器，下一次手势就用新值。
 *  跳转秒数沿用「快进 / 快退步长」那一项。 */
export function wireGestureSettings(target: SettingsStore<AppSettings> = appSettingsStore()): void {
  configureGestureSettings(() => target.value);
}

/** 数据库那一份要求某个壳侧效果跟着做时报的名字（同设置面板的效果名）。 */
export type SyncedEffect = 'searchHistoryLimit' | 'performerNameLanguage' | 'interfaceLanguage';

/** 搜索记录条数在 `/api/settings` 上的形状：还没定过时是 null。 */
export interface SyncedSettings {
  performerNameLanguage?: unknown;
  interfaceLanguage?: unknown;
  systemLanguage?: unknown;
  followInitialDays?: unknown;
  feedHideGroupCompilations?: unknown;
  feedHideSoloCompilations?: unknown;
  feedHideExcerpts?: unknown;
  searchHistoryLimit?: unknown;
  sidebarOrder?: unknown;
  manageOrder?: unknown;
  navigationOrders?: unknown;
  sortControls?: unknown;
  libraryOrder?: unknown;
}

/* 数据库那一份落进本地缓存。启动时壳取一次、设置面板每次打开再取一次，都交到这里；开着的面板与
   侧栏经 store 通知跟上：侧栏顺序变了，它当场按新顺序重排。搜索记录条数变了要推给搜索岛，那一下
   由 `changed` 交回壳。 */
export function applySyncedSettings(
  remote: SyncedSettings | null | undefined, changed: (effect: SyncedEffect) => void,
  target: SettingsStore<AppSettings> = appSettingsStore(),
): void {
  const settings = target.value;
  const language = remote?.performerNameLanguage;
  if (NAME_LANGUAGES.includes(language as NameLanguage) && language !== settings.performerNameLanguage) {
    settings.performerNameLanguage = language as NameLanguage;
    target.save();
    changed('performerNameLanguage');
  }
  /* 界面语言在页面载入时就定了（`i18n` 模块）。数据库里的选择或服务端报的系统语言变了，交给壳判断要不要整页重载。 */
  const choice = remote?.interfaceLanguage;
  const system = remote && 'systemLanguage' in remote ? matchInterfaceLanguage(remote.systemLanguage) : settings.systemLanguage;
  const nextChoice = isInterfaceLanguageChoice(choice) ? choice : settings.interfaceLanguage;
  if (nextChoice !== settings.interfaceLanguage || system !== settings.systemLanguage) {
    settings.interfaceLanguage = nextChoice;
    settings.systemLanguage = system;
    target.save();
    changed('interfaceLanguage');
  }
  const initial = remote && remote.followInitialDays;
  if (FOLLOW_INITIAL_DAYS.includes(initial as number)) { settings.followInitialDays = initial as number; target.save() }
  for (const key of FEED_COMPILATION_KEYS) {
    if (typeof remote?.[key] !== 'boolean' || remote[key] === settings[key]) continue;
    settings[key] = remote[key] as boolean; target.save();
  }
  /* 数据库里还没有条数时，这台设备本地改过的那个数替所有访问端先定下来，只送这一次。 */
  const limit = remote && remote.searchHistoryLimit;
  if (Number.isInteger(limit) && (limit as number) >= 0 && (limit as number) <= 50) {
    if (limit !== settings.searchHistoryLimit) {
      settings.searchHistoryLimit = boundedPreference(limit as number, 0, 50, 10); target.save();
      changed('searchHistoryLimit');
    }
  } else if (remote && remote.searchHistoryLimit === null
    && settings.searchHistoryLimit !== DEFAULT_SETTINGS.searchHistoryLimit) postSearchHistoryLimit(target);
  if (Array.isArray(remote?.manageOrder)) {
    const manageOrder = normalizeManageOrder(remote.manageOrder);
    if (manageOrder.join(',') !== settings.manageOrder.join(',')) { settings.manageOrder = manageOrder; target.save() }
  }
  const order = Array.isArray(remote && remote.sidebarOrder) ? remote!.sidebarOrder as string[] : null;
  if (Array.isArray(remote?.libraryOrder) && remote.libraryOrder.every(key => typeof key === 'string')
    && remote.libraryOrder.join(',') !== settings.libraryOrder.join(',')) {
    settings.libraryOrder = remote.libraryOrder;
    target.save();
  }
  if (remote?.navigationOrders) {
    const navigationOrders = normalizeNavigationOrders(remote.navigationOrders);
    if (JSON.stringify(navigationOrders) !== JSON.stringify(settings.navigationOrders)) {
      settings.navigationOrders = navigationOrders;
      target.save();
    }
  }
  if (remote?.sortControls) {
    const sortControls = normalizeSortControls(remote.sortControls);
    if (JSON.stringify(sortControls) !== JSON.stringify(settings.sortControls)) {
      settings.sortControls = sortControls;
      target.save();
    }
  }
  if (!order || !order.length || order.join(',') === settings.sidebarOrder.join(',')) return;
  settings.sidebarOrder = order;
  target.save();
}

/** 把本地那个搜索记录条数送上数据库；失败不报，下次对账再送。 */
export function postSearchHistoryLimit(target: SettingsStore<AppSettings> = appSettingsStore()): Promise<unknown> {
  return api('/api/settings', {
    method: 'POST', body: JSON.stringify({ searchHistoryLimit: target.value.searchHistoryLimit }),
  }).catch(() => {});
}
