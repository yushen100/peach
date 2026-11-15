/* 配置页的骨架：整页静态骨架（React 包与 `/api/configuration` 回来之前）与各分区自己取数时的
 * 分区骨架都由这里的构件拼，按终态的结构画：列表画成行，表单画成「标签 + 输入框」，开关行画成
 * 「标题 + 说明 + 开关」，底栏画禁用的键。
 *
 * 行数有两种来路：
 * - 代码里的静态登记决定的（来源凭据的站点清单、各分区固定的设置行与字段名）直接照登记画，名字写真名；
 * - 随这台机器的配置变的（媒体库与文件夹、索引器、网盘账号、下载渠道、访问密码的状态等）照本机上次
 *   画好时记下的结构画：记的是行数与每行是否展开这类结构，不是高度。没有记录时按空集合或一行的最小结构画。 */
import { esc } from '@peach/legacy/core';
import { islandButton, islandGlyph, islandSelect } from './island-skeleton';
import { appSettingsStore } from './appearance/settings';
import { NAVIGATION_GROUPS, normalizeNavigationOrder } from './navigation-order';
import { diagnosticsSkeleton } from './diagnostics-skeleton';
import { LIBRARY_FOLDER_HELP, POLICY_SUMMARY } from './react/settings/library-policy-copy';
import { ENTRY_LINKS_HELP, ENTRY_LINKS_HINT } from './configuration-copy';
import { serverLabel } from './core/server-text';
import { t } from './i18n';
import { sectionId, sectionTitle } from './history/settings-route';
import CREDENTIAL_REGISTRY from './react/follow-manage/credential-providers.json' with { type: 'json' };

export const CLOUD_PROXY_HELP = t('settings:cloudProxy.help');

/* ---------- 本机记下的结构 ---------- */

export interface MediaShape { folders: number[]; cloud: boolean }
export interface DiscoveryShape { enabled: boolean; watchLocal: boolean; cloud: boolean; webhook: boolean; prefixes: number }
export interface CredentialsShape { done: string[] }
/** 每个索引器一项：是否默认展开（还没有地址的那条展开）。 */
export interface IndexersShape { open: boolean[] }
export interface JavBrowserShape { enabled: boolean; ready: boolean }
/** 每个网盘账号一项：[数据代理走代理, API 代理走代理]，走代理时多出地址、端口与认证三行。 */
export interface CloudProxyShape { configured: boolean; accounts: [boolean, boolean][]; unlinked: number }
export interface DownloadsShape { cloud: boolean; has115: boolean; pikpak: boolean; pikpakRoots: boolean; pikpakLoggedIn: boolean; browserLogin: boolean }
export interface NetworkShape { port: boolean; addresses?: number; networkEditable?: boolean; lan?: boolean; proxyAddress: boolean; access: string; tunnelNamed: boolean; tunnelNamedMode: boolean; tunnelNote: boolean }
/** 已登录的设备：行数，以及底栏有没有「撤销其他设备」。 */
export interface DevicesShape { rows: number; manageable: boolean }
export interface MaintenanceShape {
  releaseFacts: number; releaseNotes: number; autoUpdateHelp: boolean; startupNote: boolean; desktopNote: boolean;
  storageRows: number; storageNotes: number; reporting: boolean; reportingIdle: boolean; sharing: boolean;
  sharingNotice: boolean; sharingIdle: boolean; facts: string[]; uninstall: boolean; uninstallHelp: boolean;
}
export interface ConfigurationShape {
  media: MediaShape; discovery: DiscoveryShape; credentials: CredentialsShape; indexers: IndexersShape;
  javBrowser: JavBrowserShape; cloudProxy: CloudProxyShape; downloads: DownloadsShape; network: NetworkShape;
  devices: DevicesShape; maintenance: MaintenanceShape;
}
type Shapes = { [K in keyof ConfigurationShape]?: Partial<ConfigurationShape[K]> };

export const SHAPE_KEY = 'peach.configuration.shape.v1';

function shapes(): Shapes {
  try {
    const value = JSON.parse(localStorage.getItem(SHAPE_KEY) || '{}') as unknown;
    return value && typeof value === 'object' ? value as Shapes : {};
  } catch { return {} }
}

/** 记下一个分区这次画好时的结构，下次首屏骨架照它排。 */
export function rememberShape<K extends keyof ConfigurationShape>(key: K, value: ConfigurationShape[K]): void {
  try {
    const all = shapes();
    if (JSON.stringify(all[key]) === JSON.stringify(value)) return;
    localStorage.setItem(SHAPE_KEY, JSON.stringify({ ...all, [key]: value }));
  } catch { /* 下次按最小结构画。 */ }
}

/** 上次记下的结构；本机没有记录时是 `undefined`。取值时逐项校验，坏数据按没有处理。 */
export const rememberedShape = <K extends keyof ConfigurationShape>(key: K): Shapes[K] => shapes()[key];

const on = (value: unknown): boolean => value === true;
const count = (value: unknown, max: number): number => Number.isInteger(value) && (value as number) > 0 ? Math.min(value as number, max) : 0;
const list = <T>(value: unknown, max: number, item: (entry: unknown) => T): T[] => Array.isArray(value) ? value.slice(0, max).map(item) : [];

/* ---------- 构件：类名与正式组件同几何 ---------- */

const wait = 'disabled data-skeleton-action';
const text = (width = '60%') => `<span class="skeleton skeleton-text" style="width:${width}"></span>`;
const input = (width = '100%') => `<span class="skeleton ui-configuration-skeleton-input" style="width:${width}"></span>`;
/** 图标、徽章这类定尺寸的块：只放在 flex 行里。 */
const block = (width: string, height: string) => `<span class="skeleton shrink-0" style="width:${width};height:${height}"></span>`;
const chip = (width = '3em') => block(width, '24px');
const icon = () => block('var(--icon-inline)', 'var(--icon-inline)');
const button = (label: string, variant: 'primary' | 'secondary' = 'primary', size: 'medium' | 'small' = 'medium') =>
  islandButton({ label, variant, size, attrs: wait });
const footer = (content: string, status = '') => `<div class="-ml-3 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-separator-border bg-card-footer px-3 py-3">${status ? `<div class="mr-auto min-w-0 text-body-2-regular text-text-secondary">${status}</div>` : ''}${content}</div>`;
const stack = (content: string, divided = false) => `<div class="flex flex-col gap-4 ${divided ? 'border-t border-separator-border ' : ''}py-4 pr-3">${content}</div>`;
const heading = (name: string, aside: string, mark: boolean) => {
  const label = `<p class="w-full px-3 text-body-2-medium text-text-secondary">${mark ? `<span class="inline-flex items-center gap-1.5">${icon()}${name}</span>` : name}</p>`;
  return aside ? `<div class="flex w-full flex-wrap items-center justify-between gap-2"><div class="min-w-40 flex-1">${label}</div><div class="flex min-w-0 max-w-full">${aside}</div></div>` : label;
};
const section = (name: string, content: string, actions = '', { aside = '', status = '', mark = false } = {}) =>
  `<section aria-label="${name}" class="flex w-full flex-col gap-2 wrap-anywhere">${heading(name, aside, mark)}<div class="flex w-full flex-col rounded-2xl bg-background-secondary-default pl-3">${content}${actions ? footer(actions, status) : ''}</div></section>`;
/** 同 BoardUI `SettingsRow`；`lead` 是行首图标的占位。 */
const controlRow = (label: string, description: string, control: string, lead = '') => {
  const body = `<div class="flex min-w-0 flex-col"><p class="text-body-regular text-text-primary">${label}</p>${description ? `<p class="text-body-2-regular text-text-secondary">${description}</p>` : ''}</div>`;
  return `<div class="flex min-h-[52px] w-full items-center justify-between gap-4 py-2.5 pr-2.5 border-b border-separator-border last:border-b-0">${lead ? `<div class="flex min-w-0 items-center gap-3">${lead}${body}</div>` : body}${control}</div>`;
};
const row = (label: string, description = '', control = 'ui-configuration-skeleton-toggle') => controlRow(label, description, `<span class="skeleton ${control}"></span>`);
/* 只读一句读数的行（「每 3 个月」）：右边是一段文字宽的占位，行高同开关行。 */
const valueRow = (label: string, description = '', width = '4em') => controlRow(label, description, text(width));
const help = (content: string) => `<p class="text-body-2-regular text-text-secondary">${content}</p>`;
const fieldLabel = (label: string) => `<p class="text-body-medium text-text-primary">${label}</p>`;
const inputField = (label: string, hint = '') => `<div class="flex w-full flex-col items-start gap-1"><span class="flex items-center gap-0.5 text-body-medium text-text-primary">${label}</span>${input()}${hint ? `<span class="pt-px text-caption-1-medium text-text-secondary">${hint}</span>` : ''}</div>`;
const selectField = (label: string) => `<div class="flex flex-col gap-1">${fieldLabel(label)}${islandSelect(text('8em'))}</div>`;
const check = (label: string) => `<span class="flex items-center gap-2 text-body-regular text-text-primary">${block('16px', '16px')}${label}</span>`;
const marked = (label: string) => `<span class="inline-flex items-center gap-1">${icon()}${label}</span>`;
/** 折叠行（`Disclosure` 的 summary）：箭头与名字；展开时箭头转下。 */
const summary = (label: string, open = false) => `<span class="flex w-fit items-center gap-1 text-body-2-medium text-text-secondary">${islandGlyph('chevron-right', `size-(--icon-inline) shrink-0${open ? ' rotate-90' : ''}`)}${label}</span>`;
/* 读数一行一条；缺工具的 FFmpeg、untrunc 两行是一段说明加一条下载链接，画成三行字。 */
const DEPENDENCY_FACTS = new Set(['FFmpeg', 'untrunc']);
const facts = (terms: string[]) => `<dl class="ui-settings-facts flex flex-col">${terms.map(term => `<div class="flex min-h-11 items-center justify-between gap-4 border-b border-separator-border py-2.5 pr-3 last:border-b-0"><dt class="flex max-w-1/2 min-w-0 shrink-0 items-center gap-2 text-body-regular text-text-secondary">${term}</dt><dd class="flex min-w-0 flex-wrap items-center justify-end gap-2 text-body-regular text-text-primary">${DEPENDENCY_FACTS.has(term) ? text('100%') + text('80%') + text('6em') : text('6em')}</dd></div>`).join('')}</dl>`;

/* ---------- 来源凭据：站点清单是静态登记 ---------- */

interface CredentialProvider { provider: string; label: string; requirement: string; fields?: string[]; why?: string; where?: string; howto?: string }
/** 与 `/api/follow/credentials` 的静态部分一致，由 `tests/test_follow_web.py` 对照接口核对。 */
export const CREDENTIAL_PROVIDERS: readonly CredentialProvider[] = CREDENTIAL_REGISTRY;

export interface CredentialSkeletonRow extends CredentialProvider { done: boolean; open: boolean }

/** 凭据说明的当前语言：按 provider 取 `labels.followSecrets.<why|howto>.<provider>`，没有译文用登记里的原文。 */
const guide = (row: CredentialProvider, part: 'why' | 'howto'): string =>
  serverLabel(`labels.followSecrets.${part}.${row.provider}`, row[part] ?? '');

/** 骨架里每一行：站点、分组与要的字段取自登记；配好没有取自上次记录，没有记录时按都没配。
 *  展开规则与终态同一条：必填且没配好的展开。 */
export function credentialSkeletonRows(shape = rememberedShape('credentials')): CredentialSkeletonRow[] {
  const done = new Set(list(shape?.done, 64, String));
  return CREDENTIAL_PROVIDERS.map(entry => {
    const configured = done.has(entry.provider);
    return { ...entry, done: configured, open: entry.requirement === 'required' && !configured };
  });
}

function credentialRow(row: CredentialSkeletonRow): string {
  const fields = row.fields ?? [];
  const configurable = row.requirement !== 'none' && row.requirement !== 'blocked';
  /* 徽章位：状态一枚，没配好时每个缺的字段再一枚。 */
  const chips = chip() + (configurable && !row.done ? fields.map(() => chip('4.5em')).join('') : '');
  const head = `<span class="flex min-w-0 flex-wrap items-center gap-2">${block('14px', '14px')}<b class="min-w-0 text-body-medium wrap-anywhere text-text-primary">${esc(row.label)}</b>${chips}</span>`;
  if (!configurable) {
    return `<div class="flex flex-wrap items-center gap-3 border-b border-separator-border px-6 py-5 last:border-b-0 max-sm:px-4">${head}${row.requirement === 'blocked' && row.why ? help(esc(guide(row, 'why'))) : ''}</div>`;
  }
  const form = row.open ? '<div class="flex flex-col gap-2 pt-3"><div class="flex flex-col gap-3">'
    + help(`${esc(guide(row, 'why'))}${row.where ? ` ${t('follow:sourceCredentials.getCredentials')}` : ''}`) + (row.howto ? help(esc(guide(row, 'howto'))) : '')
    + `<div class="flex w-full flex-col gap-3">${fields.map(name => inputField(esc(name))).join('')}</div>`
    + `<div class="flex flex-wrap items-center gap-2">${button(t('settings:shared.saveSettings'))}</div>${summary(t('follow:sourceCredentials.credentialsFile'))}</div></div>` : '';
  return `<div class="flex flex-col gap-2 border-b border-separator-border px-6 py-5 last:border-b-0 max-sm:px-4">${head}<div>${summary(row.done ? t('follow:sourceCredentials.editCredentials') : t('follow:sourceCredentials.enterCredentials'), row.open)}${form}</div></div>`;
}

export function credentialsSkeleton(): string {
  const rows = credentialSkeletonRows();
  const pending = rows.filter(row => row.requirement === 'required' && !row.done).length;
  const groups = [
    [t('settings:sourceCredentials.groupSupported'), rows.filter(row => row.requirement !== 'none' && row.requirement !== 'blocked')],
    [t('settings:sourceCredentials.groupNotNeeded'), rows.filter(row => row.requirement === 'none')],
    [t('settings:sourceCredentials.groupUnsupported'), rows.filter(row => row.requirement === 'blocked')],
  ] as const;
  const body = groups.filter(([, items]) => items.length).map(([name, items]) => `<div class="flex flex-col gap-2"><h4 class="text-body-medium text-text-secondary">${name}</h4><div class="min-w-0 border border-separator-border bg-background-primary-default rounded-surface flex flex-col overflow-hidden">${items.map(credentialRow).join('')}</div></div>`).join('');
  return section(t('settings:sourceCredentials.title'), stack(`<div class="flex flex-col gap-4">${body}</div>`), '', { aside: pending ? text('5em') : '' });
}

/* ---------- 资源搜索：索引器条数随配置 ---------- */

export function indexersSkeleton(): string {
  const open = list(rememberedShape('indexers')?.open, 20, on);
  const rows = open.map(expanded => `<div class="min-w-0 border-t border-separator-border pt-2"><span class="flex w-full min-w-0 items-center gap-1 text-body-2-medium">${islandGlyph('chevron-right', `size-(--icon-inline) shrink-0 text-text-secondary${expanded ? ' rotate-90' : ''}`)}${text('6em')}${text('12em')}</span>`
    + (expanded ? `<div class="flex flex-col gap-2 pt-3"><div class="flex min-w-0 flex-col gap-4">${inputField(t('settings:shared.name'))}${inputField(t('settings:indexers.torznabUrl'))}${inputField('API key')}<div class="flex flex-wrap items-center gap-x-6 gap-y-2">${check(t('settings:shared.enable'))}${button(t('settings:shared.remove'), 'secondary', 'small')}</div></div></div>` : '')
    + '</div>').join('');
  return section(t('settings:indexers.title'), stack(`<div class="flex min-w-0 flex-col gap-4">${summary(t('settings:indexers.connectHelp'))}${rows}</div>`), button(t('settings:indexers.add'), 'secondary') + button(t('settings:shared.saveSettings')));
}

/* ---------- 浏览器添加 JAV ---------- */

export function javBrowserSkeleton(): string {
  const shape = rememberedShape('javBrowser');
  const enabled = on(shape?.enabled);
  const status = '<div class="min-w-0 bg-background-primary-default rounded-2xl shadow-card p-5 border border-border-button-default flex flex-col gap-3">'
    + `<div class="flex flex-wrap items-center justify-between gap-3"><span class="text-body-medium text-text-primary">${t('settings:userscriptStatus.title')}</span>${text('4em')}</div>`
    + `<div class="flex flex-wrap items-center justify-between gap-3"><span class="text-body-regular text-text-secondary">${t('settings:userscriptStatus.addFromBrowser')}</span>${chip()}</div>`
    + `<p class="text-caption-1-regular text-text-secondary">${text('70%')}</p>`
    + `<div class="flex flex-wrap items-center gap-2">${button(t('settings:userscriptStatus.checkAgain'), 'secondary')}</div></div>`;
  return section(t('settings:javBrowser.title'), stack(`<div class="flex min-w-0 flex-col gap-4">${status}${selectField(t('settings:browserAdd.channel'))}`
    + `${on(shape?.ready) ? '' : help(t('settings:browserAdd.needsCloudDrive'))}`
    + `<div>${row(t('settings:browserAdd.wantOnNoMatch'), t('settings:browserAdd.wantOnNoMatchHelp'))}</div>${inputField(t('settings:browserAdd.peachUrl'))}</div>`),
  (enabled ? button(t('settings:javBrowser.disable'), 'secondary') : '') + button(enabled ? t('settings:javBrowser.updateChannelToken') : t('settings:javBrowser.enable')));
}

/* ---------- CloudDrive 代理：账号数随配置 ---------- */

const proxyEditor = (label: string, proxy: boolean) => `<div class="flex min-w-0 flex-col gap-3">${fieldLabel(label)}${islandSelect(text('6em'))}`
  + (proxy ? `<div class="flex flex-wrap gap-3"><div class="min-w-40 flex-1">${inputField(t('settings:cloudProxy.host', { label }))}</div><div class="w-full sm:w-28">${inputField(t('settings:cloudProxy.port', { label }))}</div></div>${summary(t('settings:cloudProxy.authentication'))}` : '') + '</div>';

export function cloudProxySkeleton(): string {
  const shape = rememberedShape('cloudProxy');
  const accounts = list(shape?.accounts, 12, entry => Array.isArray(entry) ? [on(entry[0]), on(entry[1])] as const : [false, false] as const);
  const unlinked = count(shape?.unlinked, 12);
  const body = accounts.length || unlinked
    ? Array.from({ length: unlinked }, () => `<div class="flex min-w-0 flex-col gap-1">${fieldLabel(marked(text('6em')))}${help(text('9em'))}</div>`).join('')
      + accounts.map(([data, api]) => `<div class="flex min-w-0 flex-col gap-4 border-t border-separator-border pt-4">${fieldLabel(marked(text('8em')))}${help(text('50%'))}${proxyEditor(t('settings:cloudProxy.dataProxy'), data)}${proxyEditor(t('settings:cloudProxy.apiProxy'), api)}<div class="flex justify-end">${button(t('settings:shared.saveSettings'))}</div></div>`).join('')
    : help(text('60%'));
  return section(t('settings:cloudProxy.title'), stack(`${help(CLOUD_PROXY_HELP)}<div class="flex min-w-0 flex-col gap-4">${body}</div>`), button(t('settings:shared.reload'), 'secondary'));
}

/* ---------- 媒体库与入库 ---------- */

const field = (label: string, control: string, className: string) =>
  `<div class="flex min-w-0 flex-col gap-1 ${className}"><span class="flex items-center gap-0.5 text-body-medium text-text-primary" aria-hidden="true">${label}</span>${control}</div>`;
const folderRow = (libraries: number) => `<div data-folder-row class="@container flex flex-col gap-2 rounded-2lg border border-separator-border bg-background-primary-default p-3">
    <div class="flex items-start gap-2"><span class="min-w-0 flex-1">${input()}</span>${islandButton({ glyph: 'folder-search', variant: 'secondary', attrs: wait })}</div>
    <div class="flex flex-wrap items-end gap-2"><div class="flex w-full flex-wrap items-start gap-2">${field(t('settings:folderRow.storage'), islandSelect(text('6em')), 'w-full @lg:w-60')}${field(t('settings:folderRow.readPolicy'), islandSelect(text('4em')), 'w-full @lg:w-32')}${libraries > 1 ? field(t('settings:mediaLibraries.moveTo'), islandSelect(text('4em')), 'w-full @lg:w-48') : ''}</div></div>
  </div>`;
/* 媒体库卡与 `cardClass({ variant: 'raised', padding: 'none' })` 同一组类名。 */
const libraryBlock = (folders: number, libraries: number) => `<div data-library-block class="min-w-0 bg-background-primary-default rounded-2xl shadow-card flex flex-col p-2">
    <div data-library-head>${islandButton({ label: t('settings:libraryIcons.auto'), variant: 'secondary', attrs: wait })}${input()}<span class="skeleton ui-configuration-skeleton-input" style="width:136px"></span>${islandSelect(text('4em'), { prefix: t('settings:libraryPolicy.mode') })}</div>
    <div data-library-folders>${folderRow(libraries).repeat(folders)}<div class="flex">${islandButton({ label: t('settings:mediaLibraries.addDirectory'), variant: 'secondary', attrs: wait })}</div></div></div>`;
/* 说明区是固定文字：常显那一句照原文写，对比表收着，只画它的展开行。 */
const legend = `<div data-policy-legend class="flex flex-col gap-1"><p class="text-body-2-regular text-text-secondary">${POLICY_SUMMARY}</p>`
  + `<span class="flex items-center gap-1 text-body-2-medium text-text-secondary">${t('settings:libraryPolicy.compare')}</span></div>`;
const cloudHelp = `<p class="text-body-2-regular text-text-secondary">${t('settings:folderRow.readPolicyHelp')}</p>`
  + `<div class="flex flex-col gap-3"><span class="flex items-center gap-1 text-body-2-medium text-text-secondary">${t('settings:cloudDriveGuide.title')}</span></div>`;

/** 每个媒体库几个文件夹：上次的记录，没有时一组一个文件夹。 */
export function mediaSkeletonShape(shape = rememberedShape('media')): MediaShape {
  const folders = list(shape?.folders, 12, entry => count(entry, 50)).filter(Boolean);
  return folders.length ? { folders, cloud: on(shape?.cloud) } : { folders: [1], cloud: false };
}

/** 自动发现新文件：三行开关是固定的；开着时的说明、Webhook 行与前缀表随配置。 */
export function discoverySkeleton(): string {
  const shape = rememberedShape('discovery');
  const enabled = on(shape?.enabled);
  const cloud = enabled && on(shape?.cloud);
  const webhook = cloud && on(shape?.webhook);
  const prefixRow = `<div class="flex items-start gap-2"><span class="min-w-0 flex-1">${input()}</span>${islandSelect(text('4em'), { prefix: t('settings:pushDiscovery.mapsTo') })}${islandButton({ glyph: 'trash', variant: 'secondary', attrs: wait })}</div>`;
  return section(t('settings:fileDiscovery.title'), stack(`<div class="flex flex-wrap items-center gap-2"><span class="text-body-regular text-text-secondary">${t('settings:pushDiscovery.localMonitoring')}</span>${chip()}</div>`)
    + row(t('settings:fileDiscovery.autoImport'), enabled ? text('10em') : '') + row(t('settings:fileDiscovery.monitorLocal'), enabled && on(shape?.watchLocal) ? text('12em') : '')
    + row(t('settings:fileDiscovery.cloudNotify'), t('settings:fileDiscovery.cloudNotifyHelp')) +(cloud ? controlRow(t('settings:fileDiscovery.webhookConfig'), text('20em'), '') : '')
    + (webhook ? stack(summary(t('settings:fileDiscovery.viewConfig')), true) : '')
    + (cloud ? stack(`<div class="flex flex-col gap-3">${fieldLabel(t('settings:pushDiscovery.cloudPrefixes'))}<div class="flex flex-col gap-3">${prefixRow.repeat(count(shape?.prefixes, 20))}</div><div>${button(t('settings:pushDiscovery.addPrefix'), 'secondary')}</div></div>`, true) : ''),
  (webhook ? button(t('settings:fileDiscovery.rotateSecret'), 'secondary') : '') + button(t('settings:shared.saveSettings')));
}

/** 媒体库与目录：图例、每个媒体库的标题行、文件夹行与它自己的添加键，最下面添加媒体库与底部动作。 */
const media = () => {
  const shape = mediaSkeletonShape();
  return section(t('settings:libraryFolders.title'), stack(`${legend}<div class="flex flex-col gap-4">${shape.folders.map(folders => libraryBlock(folders, shape.folders.length)).join('')}</div>
  <div class="self-start">${button(t('settings:mediaLibraries.addLibrary'), 'secondary')}</div>
  <p class="text-body-2-regular text-text-secondary">${LIBRARY_FOLDER_HELP}</p>
  ${shape.cloud ? cloudHelp : ''}<span class="text-body-medium text-text-primary">${text('15em')}</span>`),
  button(t('settings:shared.saveSettings')), { status: t('settings:libraryFolders.restartNotice') })
  + (shape.cloud ? cloudProxySkeleton() : '')
  + discoverySkeleton()
  + section(t('settings:codePatterns.title'), stack(`${text('90%')}${text('60%')}<span class="skeleton ui-configuration-skeleton-input" style="width:100%;height:88px"></span>`), button(t('settings:shared.saveSettings')))
  + section(t('settings:videoPreviews.title'), row(t('settings:videoPreviews.generate'), t('settings:videoPreviews.generateHelp'))
    + row(t('settings:videoPreviews.timeline'), t('settings:videoPreviews.timelineHelp'), 'ui-configuration-skeleton-select')
    + row(t('settings:videoPreviews.decoder'), t('settings:videoPreviews.decoderHelp'), 'ui-configuration-skeleton-select'));
};

/* ---------- 来源与订阅 ---------- */

const subscriptions = () => `<div>${button(t('settings:sourceSettings.sourcesLink'), 'secondary')}</div>`
  + credentialsSkeleton()
  + section(t('settings:followFetch.title'), controlRow(t('settings:followFetch.autoCheck'), '', `<span class="flex items-center gap-2"><span class="skeleton ui-configuration-skeleton-toggle"></span><span class="skeleton ui-configuration-skeleton-input" style="width:96px"></span></span>`)
    + valueRow(t('settings:followFetch.feedSchedule')) + row(t('settings:followFetch.initialRange'), t('settings:followFetch.initialRangeHelp'), 'ui-configuration-skeleton-select')
    + valueRow(t('settings:followFetch.avatarRefresh'), t('settings:followFetch.avatarRefreshHelp')) + valueRow(t('settings:followFetch.faviconRefresh'), t('settings:followFetch.faviconRefreshHelp')))
  + section(t('settings:wantSearch.title'), row(t('settings:wantSearch.interval'), t('settings:wantSearch.intervalHelp'), 'ui-configuration-skeleton-select')
    + row(t('settings:wantSearch.giveUp'), t('settings:wantSearch.giveUpHelp'), 'ui-configuration-skeleton-select'))
  + indexersSkeleton()
  + section(t('settings:entryLinks.title'), stack(`<p class="text-body-2-regular text-text-secondary">${ENTRY_LINKS_HELP}</p>${inputField(marked(t('settings:entryLinks.siteAddress', { site: 'JavDB' })), ENTRY_LINKS_HINT)}${inputField(marked(t('settings:entryLinks.siteAddress', { site: 'MISSAV' })), ENTRY_LINKS_HINT)}`), button(t('settings:shared.saveSettings')));

/* ---------- 下载渠道：云下载与 PikPak 两块随媒体库里的网盘出现 ---------- */

const downloads = () => {
  const shape = rememberedShape('downloads');
  const pikpak = on(shape?.pikpak);
  const roots = on(shape?.pikpakRoots) ? selectField(marked(t('settings:cloudDownload.pikpakRootDirectory')))
    : `<div class="flex flex-col gap-1">${fieldLabel(marked(t('settings:cloudDownload.pikpakRootDirectory')))}${help(t('settings:cloudDownload.addPikpakMount'))}</div>`;
  const cloud = on(shape?.cloud) ? section(t('settings:cloudDownload.title'), stack(inputField(t('settings:cloudDownload.cloudDriveUrl')) + inputField(t('settings:cloudDownload.apiToken'), t('settings:cloudDownload.apiTokenHelp'))
    + (on(shape?.has115) ? inputField(marked(t('settings:cloudDownload.target115')), t('settings:cloudDownload.target115Help')) : '')
    + (pikpak ? inputField(marked(t('settings:cloudDownload.targetPikpak')), t('settings:cloudDownload.targetPikpakHelp')) + roots : '')
    + inputField(t('settings:cloudDownload.maxWait'), text('14em'))), button(t('settings:cloudDownload.testConnection'), 'secondary') + button(t('settings:shared.saveSettings'))) : '';
  const loggedIn = on(shape?.pikpakLoggedIn);
  const account = pikpak ? section(t('settings:pikpakAccount.title'), loggedIn ? facts([t('settings:shared.account'), text('4em')]) : stack(inputField(t('settings:shared.account')) + inputField(t('settings:shared.password')) + check(t('settings:pikpakAccount.rememberPassword'))),
    loggedIn ? button(t('settings:shared.signOut'), 'secondary') : (on(shape?.browserLogin) ? button(t('settings:pikpakAccount.browserSignIn'), 'secondary') : '') + button(t('settings:shared.signIn')), { aside: chip(), mark: true }) : '';
  return cloud + account + javBrowserSkeleton();
};

/* ---------- 网络与访问 ---------- */

const ACCESS_HELP: Record<string, string> = {
  legacy: t('settings:accessPassword.legacyHelp'),
  locked: t('settings:accessPassword.lockedHelp'),
  password: t('settings:accessPassword.passwordHelp'),
};
const TUNNEL_HELP = {
  quick: t('settings:remoteAccess.quickHelp'),
  named: t('settings:remoteAccess.namedHelp'),
};

/* 必填框的标签后面跟一枚星号，同终态 Input 的 isRequired。 */
const required = (label: string) => `${label} *`;

function accessBody(mode: string): string {
  const pair = mode === 'locked' ? '' : inputField(required(mode === 'password' ? t('settings:accessPassword.new') : t('settings:accessPassword.set')), t('settings:accessPassword.newHelp'))
    + inputField(required(t('settings:accessPassword.confirm')));
  return (ACCESS_HELP[mode] ? help(ACCESS_HELP[mode]) : '') + (mode === 'open' ? block('100%', '64px') : '')
    + (mode === 'password' || mode === 'legacy' ? check(t('settings:accessPassword.turnOff')) : '')
    + (mode === 'password' ? inputField(required(t('settings:accessPassword.current'))) : '') + pair;
}

/** 已登录的设备：分区自己取数时也画这一份。没有记录时按一行（本机）画。 */
export function devicesSkeleton(): string {
  const shape = rememberedShape('devices');
  const rows = Array.from({ length: Math.max(1, count(shape?.rows, 8)) }, () => controlRow(text('8em'), text('14em'), text('3em'), block('20px', '20px'))).join('');
  return section(t('settings:signedInDevices.title'), rows, on(shape?.manageable) ? button(t('settings:signedInDevices.revokeOthers'), 'secondary') : '',
    on(shape?.manageable) ? { status: t('settings:signedInDevices.passwordChangeNotice') } : {});
}

/** 账本备份：分区自己首次取数时画这一份。备份行数随机器变、首次读回前不知道，按三行画。 */
export function ledgerBackupsSkeleton(): string {
  const rows = Array.from({ length: 3 }, () => controlRow(text('9em'), text('14em'), button(t('settings:databaseBackups.restore'), 'secondary'))).join('');
  return section(t('settings:databaseBackups.title'), stack(help(t('settings:databaseBackups.help')))
    + `<div class="border-t border-separator-border">${rows}</div>`, button(t('settings:databaseBackups.backUpNow')), { status: text('5em') });
}

const network = () => {
  const shape = rememberedShape('network');
  /* 没有记录时按服务端的默认状态画：没有访问设置文件就是 `legacy`（系统生成的口令）。 */
  const mode = typeof shape?.access === 'string' && shape.access ? shape.access : 'legacy';
  const named = on(shape?.tunnelNamed);
  const tunnel = (named && on(shape?.tunnelNamedMode)
    ? help(TUNNEL_HELP.named) + inputField(t('settings:remoteAccess.hostname'), t('settings:remoteAccess.hostnameHelp')) + inputField(t('settings:remoteAccess.tunnelToken'), text('16em'))
    : help(TUNNEL_HELP.quick)) + (on(shape?.tunnelNote) ? block('100%', '64px') : '');
  const addresses = count(shape?.addresses, 3);
  const addressFields = Array.from({ length: addresses }, (_, i) => `<div class="flex min-w-0 flex-wrap items-end gap-2"><div class="min-w-0 flex-1">${inputField([t('settings:accessAddress.localUrl'), t('settings:accessAddress.phoneUrl'), t('settings:accessAddress.alternateIp')][i]!)}</div>${button(t('settings:accessAddress.copyUrl'), 'secondary')}</div>`).join('');
  return (addresses || on(shape?.port) ? section(t('settings:accessUrls.title'), stack(addressFields + (addresses ? block('100%', '40px') : '')
      + (on(shape?.networkEditable) ? `<div class="flex flex-col gap-1.5">${fieldLabel(t('settings:accessAddress.whoCanConnect'))}${block('min(100%, 20em)', '36px')}</div>` + (on(shape?.lan) ? inputField(t('settings:accessUrls.lanUrl')) : '') : '')
      + (on(shape?.port) ? inputField(t('settings:accessUrls.port')) : '')), on(shape?.port) ? button(t('settings:shared.saveSettings')) : '',
      on(shape?.port) ? { status: t('settings:accessUrls.restartNotice') } : {}) : '')
    + section(t('settings:accessPassword.title'), stack(accessBody(mode)), mode === 'locked' ? '' : button(t('settings:shared.saveSettings')))
    + (mode === 'password' || mode === 'legacy' ? devicesSkeleton() : '')
    + section(t('settings:remoteAccess.title'), stack((named ? block('10.5em', '36px') : '') + tunnel),
      button(t('settings:remoteAccess.start'), named ? 'secondary' : 'primary') + (named ? button(t('settings:shared.saveSettings')) : ''), { aside: chip() })
    + section(t('settings:peachProxy.title'), row(t('settings:peachProxy.mode'), t('settings:peachProxy.modeHelp'), 'ui-configuration-skeleton-select') + (on(shape?.proxyAddress) ? stack(inputField(t('settings:peachProxy.url')), true) : ''), button(t('settings:shared.saveSettings')));
};

/* ---------- 应用与维护 ---------- */

/** 运行信息里总在的几项；FFmpeg、untrunc 缺失时才多一行，按上次记录。 */
const RUNTIME_FACTS = [t('settings:runtimeInfo.version'), t('settings:runtimeInfo.os'), t('settings:shared.dataDirectory'), t('settings:runtimeInfo.settingsFile'), t('settings:runtimeInfo.logDirectory')];

const maintenance = () => {
  const shape = rememberedShape('maintenance');
  const releaseFacts = [t('settings:releaseUpdates.currentVersion'), t('settings:releaseUpdates.installation'), t('settings:releaseUpdates.channel'), t('settings:releaseUpdates.latestVersion'), t('settings:releaseUpdates.package')].slice(0, Math.max(4, count(shape?.releaseFacts, 5)));
  const releaseNotes = count(shape?.releaseNotes, 4);
  const storageRows = count(shape?.storageRows, 12);
  const storageNotes = count(shape?.storageNotes, 3);
  const runtime = list(shape?.facts, 12, entry => esc(String(entry)));
  const idle = `<span class="self-start">${chip('6em')}</span>`;
  /* 数据上传与卸载两块服务端总会给；没有记录时也画上，只是不画随状态出现的提示。 */
  const given = (value: unknown) => shape ? on(value) : true;
  const reporting = given(shape?.reporting) ? row(t('settings:dataSharing.reportErrors'), t('settings:dataSharing.reportErrorsHelp')) + (on(shape?.reportingIdle) ? stack(idle, true) : '') : '';
  const sharing = given(shape?.sharing) ? `<div class="border-t border-separator-border">${row(t('settings:librarySharing.uploadDetails'), on(shape?.sharingNotice) ? text('12em') : '')}${on(shape?.sharingIdle) ? stack(idle, true) : ''}${footer(button(t('settings:librarySharing.preview'), 'secondary'))}</div>` : '';
  return section(t('settings:releaseUpdates.check'), facts(releaseFacts) + (releaseNotes ? stack(help(text('50%')).repeat(releaseNotes), true) : ''),
    button(t('settings:releaseUpdates.check')), { aside: chip('4em'), status: text('5em') })
    + section(t('settings:autoUpdate.title'), row(t('settings:autoUpdate.autoCheck')) + row(t('settings:autoUpdate.autoDownload'), t('settings:autoUpdate.autoDownloadHelp')) +row(t('settings:autoUpdate.frequency'), on(shape?.autoUpdateHelp) ? text('12em') : '', 'ui-configuration-skeleton-select'), button(t('settings:shared.saveSettings')))
    + section(t('settings:startup.title'), row(t('settings:startup.launchAtStartup')) + row(t('settings:startup.trayOnly'), t('settings:startup.trayOnlyHelp')) +row(t('settings:startup.desktopShortcut'), on(shape?.desktopNote) ? text('12em') : '')
      + (on(shape?.startupNote) ? stack(help(text('60%')), true) : ''), button(t('settings:shared.saveSettings')))
    + section(t('settings:transcoding.title'), row(t('settings:transcoding.mode'), t('settings:transcoding.modeHelp'), 'ui-configuration-skeleton-select')
      + row(t('settings:transcoding.quality'), t('settings:transcoding.qualityHelp'), 'ui-configuration-skeleton-select'))
    + section(t('settings:diskUsage.title'), facts([t('settings:shared.dataDirectory'), t('settings:diskUsage.disk')])
      + (storageRows ? Array.from({ length: storageRows }, () => controlRow(text('6em'), '', text('4em'))).join('') : stack(help(t('settings:diskUsage.emptyHelp')), true))
      + (storageNotes ? stack(help(text('80%')).repeat(storageNotes), true) : ''),
    button(t('settings:diskUsage.changeLocation'), 'secondary') + button(storageRows ? t('settings:diskUsage.measureAgain') : t('settings:diskUsage.measure')))
    + (reporting || sharing ? section(t('settings:dataSharing.title'), reporting + sharing) : '')
    + section(t('settings:runtimeInfo.title'), facts(runtime.length ? runtime : RUNTIME_FACTS))
    + `<section aria-label="${t('settings:tour.guidedTour')}" class="w-full"><div class="flex w-full flex-col rounded-2xl bg-background-secondary-default pl-3">${controlRow(t('settings:tour.guidedTour'), t('settings:tour.reopenDescription'), button(t('settings:tour.reopen'), 'secondary'))}</div></section>`
    + (given(shape?.uninstall) ? section(t('settings:uninstall.title'), (on(shape?.uninstallHelp) ? stack(help(t('settings:uninstall.help'))) : '')
      + row(t('settings:uninstall.full'), t('settings:uninstall.fullHelp')) + stack(summary(t('settings:shared.dataDirectory')), true), button(t('settings:uninstall.title')), { status: text('16em') }) : '');
};

/** 各分区复用正式表单的 Section、Stack 与 SettingsRow 几何。 */
export function configurationContentSkeleton(chosen: string): string {
  switch (sectionId(chosen)) {
    case 'diagnostics': return diagnosticsSkeleton();
    case 'subscriptions': return subscriptions();
    case 'downloads': return downloads();
    case 'network': return network();
    case 'maintenance': return maintenance();
    default: return media();
  }
}

export function configurationSkeleton(chosen = 'library'): string {
  const titles = normalizeNavigationOrder('configuration', appSettingsStore().value.navigationOrders.configuration)
    .map(key => NAVIGATION_GROUPS.configuration.items.find(([id]) => id === key)![1]);
  const nav = `<div class="ui-board-local-nav" data-section-nav data-section-items>${titles.map(title => `<button type="button" tabindex="-1" aria-selected="${title === sectionTitle(chosen)}">${title}</button>`).join('')}</div>`;
  return `<div class="peach-react"><div class="ui-configpage">${nav}<div class="flex min-w-0 flex-col gap-6">${configurationContentSkeleton(chosen)}</div></div></div>`;
}
