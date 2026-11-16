/** 导航保存稳定 ID；显示名称、默认次序与固定首项集中维护。 */
import { t } from './i18n';
export const NAVIGATION_GROUPS = {
  review: { label: t('navigation:navigationGroups.review'), items: [
    ['metadata_fields', t('navigation:reviewCategories.metadataFields')], ['creator_tags', t('navigation:reviewCategories.creatorTags')], ['code_creators', t('navigation:reviewCategories.codeDirectories')],
    ['western_identity', t('navigation:reviewCategories.westernIdentities')], ['performer_avatars', t('navigation:reviewCategories.actressAvatars')], ['studio_logos', t('navigation:reviewCategories.labelLogos')],
    ['fc2_markings', t('navigation:reviewCategories.fc2CommentFlags')], ['fc2_similarity', t('navigation:reviewCategories.fc2SimilarCodes')], ['video_endcards', t('navigation:reviewCategories.endCardEvidence')],
  ] },
  configuration: { label: t('navigation:manage.configuration'), items: [
    ['library', t('navigation:configurationSections.library')], ['sources', t('navigation:configurationSections.feeds')], ['downloads', t('navigation:configurationSections.downloads')],
    ['network', t('navigation:configurationSections.network')], ['maintenance', t('navigation:configurationSections.maintenance')], ['diagnostics', t('navigation:configurationSections.diagnostics')],
  ] },
  favorites: { label: t('navigation:navigationGroups.favorites'), items: [
    ['all', t('navigation:shared.all')], ['filters', t('navigation:favoritesTabs.savedFilters')], ['performer', t('navigation:sidebar.performers')], ['creator', t('navigation:favoritesTabs.creators')],
    ['tag', t('navigation:sidebar.tags')], ['series', t('navigation:favoritesTabs.series')], ['studio', t('navigation:favoritesTabs.studios')], ['agency', t('navigation:favoritesTabs.agencies')],
  ] },
  jav: { label: t('navigation:navigationGroups.jav'), items: [['library', t('navigation:javTabs.collection')], ['wants', t('navigation:javTabs.wanted')], ['releases', t('navigation:javTabs.newReleases')], ['discover', t('navigation:javTabs.discover')]] },
  follow: { label: t('navigation:manage.subscriptions'), items: [['list', t('navigation:followTabs.follows')], ['add', t('navigation:followTabs.newFollow')]] },
  tags: { label: t('navigation:navigationGroups.tagVocabulary'), items: [['local', t('navigation:tagTabs.localLabel')], ['online', t('navigation:tagTabs.online')]] },
  preferences: { label: t('navigation:navigationGroups.preferences'), items: [
    ['appearance', t('navigation:preferenceSections.appearance')], ['browsing', t('navigation:preferenceSections.playback')], ['jav', t('navigation:preferenceSections.jav')],
    ['search', t('navigation:preferenceSections.search')], ['content', t('navigation:preferenceSections.content')],
  ] },
} as const;

export type NavigationGroup = keyof typeof NAVIGATION_GROUPS;
export type NavigationOrders = Partial<Record<NavigationGroup, string[]>>;
export const navigationDefaults = (group: NavigationGroup): string[] => NAVIGATION_GROUPS[group].items.map(([key]) => key);
export const navigationFixedKeys = (group: NavigationGroup | undefined): readonly string[] => group === 'favorites' ? ['all'] : [];

export function normalizeNavigationOrder(group: NavigationGroup, value: unknown): string[] {
  const defaults = navigationDefaults(group);
  const keys = Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string' && defaults.includes(key)) : [];
  return [...new Set([...navigationFixedKeys(group), ...keys, ...defaults])];
}

export function normalizeNavigationOrders(raw: unknown): NavigationOrders {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const saved = raw as Record<string, unknown>;
  return Object.fromEntries((Object.keys(NAVIGATION_GROUPS) as NavigationGroup[])
    .filter(group => Array.isArray(saved[group]))
    .map(group => [group, normalizeNavigationOrder(group, saved[group])]));
}
