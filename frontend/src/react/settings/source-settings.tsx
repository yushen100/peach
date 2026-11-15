/* 来源凭据、订阅采集、资源搜索与作品资料站点共用一个 Peach 配置分区。凭据与关注采集是这一组的本体，
 * 排在前面；资源搜索与只换镜像地址的资料站点少改，排在后面。 */
import { useQuery } from '@tanstack/react-query';
import { ButtonLink } from '@/components/base/buttons/button';
import type { ConfigurationGroupProps } from '../bundle';
import { Credentials } from '../follow-manage/credentials';
import { fetchCredentials, FOLLOW_CREDENTIALS_KEY } from '../follow-manage/follow-manage';
import { Note } from '../components/note';
import { errorMessage } from '../../api';
import { credentialsSkeleton } from '../../configuration-skeleton';
import { groupRoot } from './configuration-panel';
import { EntryLinksForm } from './entry-links-settings';
import { IndexerSettings } from './indexer-settings';
import { SectionSkeleton } from './section';
import { FollowPreferenceRows } from './service-preferences';
import { WantSearchSettings } from './want-search-settings';
import { t } from '../../i18n';

export function SourceSettings({ data, receipt, panel, issues }: ConfigurationGroupProps) {
  const credentials = useQuery({ queryKey: FOLLOW_CREDENTIALS_KEY,
    queryFn: ({ signal }) => fetchCredentials(signal), enabled: panel?.active !== false, refetchOnMount: 'always' });
  return <div {...groupRoot(panel)}>
    {issues}
    <div data-guide-target="sources"><ButtonLink href="/sources" variant="secondary">{t('settings:sourceSettings.sourcesLink')}</ButtonLink></div>
    {credentials.data
      ? <Credentials data={credentials.data} readOnly={Boolean(data.ledger_read_only)} toast={receipt} embedded />
      : credentials.error
        ? <Note tone="error" title={t('settings:sourceSettings.credentialsFailed')}>{errorMessage(credentials.error)}</Note>
        : panel?.active !== false ? <SectionSkeleton label={t('settings:sourceSettings.loadingCredentials')} html={credentialsSkeleton} /> : null}
    <FollowPreferenceRows receipt={receipt} />
    <WantSearchSettings receipt={receipt} />
    <IndexerSettings receipt={receipt} />
    {data.entry_links ? <EntryLinksForm initial={data.entry_links} receipt={receipt} /> : null}
  </div>;
}
