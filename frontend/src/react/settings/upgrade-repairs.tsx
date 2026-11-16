/** 升级补修与程序安装分别显示；复核和重试都由用户明确发起。进度读页面顶部横幅那份更新快照，本页不另查。 */
import { useEffect, useState } from 'react';
import { RiArrowRightLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { REPAIR_CENTER_PATH } from '@peach/history';
import { apiSend } from '../../api';
import { checkClientUpdates, useClientUpdates } from '../client-updates';
import type { ClientUpdates } from '../client-updates';
import { AnimatedNumber } from '../components/animated-number';
import { StatusLabel } from '../components/status-label';
import { ErrorText, ExternalLink, Fact, FactList, Footer, Help, Section, Stack, TaskCenterLink, translateWithNodes } from './section';
import { useAction } from './use-action';
import { codedText } from '../../core/server-text';
import { t } from '../../i18n';

const LABELS: Record<string, string> = { pending: t('settings:upgradeRepairs.pending'), running: t('settings:upgradeRepairs.repairing'), failed: t('settings:repairCenter.needsRetry'),
  deferred: t('settings:repairCenter.deferred'), review: t('settings:upgradeRepairs.needsReview'), complete: t('settings:shared.completed'), unavailable: t('settings:upgradeRepairs.unavailable') };

/** 一格读数：滚动的数字加「项」。 */
const itemCount = (value: number) => translateWithNodes('settings:upgradeRepairs.itemCount', { count: value }, { value: <AnimatedNumber value={value} /> });

export function UpgradeRepairs() {
  const { snapshot } = useClientUpdates();
  const [saved, setSaved] = useState<ClientUpdates['repairs'] | null>(null);
  const action = useAction();
  useEffect(() => setSaved(null), [snapshot]);
  const data = saved ?? snapshot?.repairs;
  const state = data?.state || 'pending';
  const pending = data?.items.reduce((count, row) => count + (row.pending || 0), 0) || 0;
  const failed = data?.items.reduce((count, row) => count + (row.failed || 0), 0) || 0;
  const deferred = data?.items.reduce((count, row) => count + (row.deferred || 0), 0) || 0;
  const review = data?.items.reduce((count, row) => count + (row.review_count || 0), 0) || 0;
  const retry = () => void action.run('retry', signal => apiSend<ClientUpdates['repairs']>(
    '/api/configuration/upgrade-repairs/retry', {}, 'POST', signal), next => {
    setSaved(next);
    checkClientUpdates();
  });
  return <Section id="upgradeRepairs" title={t('settings:upgradeRepairs.title')} aside={<StatusLabel
    tone={state === 'failed' ? 'error' : state === 'running' ? 'progress' : state === 'review' ? 'warning'
      : state === 'complete' ? 'success' : 'neutral'}><span key={state}
        data-copy-key={`upgradeRepairs.${state}.status`}>{LABELS[state] || t('settings:shared.notFound')}</span></StatusLabel>}>
    <FactList>
      <Fact term={t('settings:upgradeRepairs.toDo')}><span>{itemCount(pending)}</span></Fact>
      <Fact term={t('settings:shared.failed')}><span>{itemCount(failed)}</span></Fact>
      {deferred ? <Fact term={t('settings:upgradeRepairs.deferred')}><span>{itemCount(deferred)}</span></Fact> : null}
      <Fact term={t('settings:upgradeRepairs.toReview')}><span>{itemCount(review)}</span></Fact>
    </FactList>
    {data?.message || action.error ? <Stack><ErrorText>{action.error || codedText(data, 'message')}</ErrorText></Stack> : null}
    {state === 'running' ? <Stack><Help>{t('settings:upgradeRepairs.runningHelp')}</Help><TaskCenterLink /></Stack> : null}
    {state === 'deferred' ? <Stack><Help>{t('settings:upgradeRepairs.deferredHelp')}</Help></Stack> : null}
    <Footer status={review ? <ExternalLink href="/api/configuration/upgrade-repairs/review">{t('settings:upgradeRepairs.downloadReviewLog')}</ExternalLink> : null}>
      <LinkButton href={REPAIR_CENTER_PATH} size="small" trailingIcon={RiArrowRightLine}>{t('settings:upgradeRepairs.repairCenterLink')}</LinkButton>
      <Button size="small" variant="secondary" disabled={!data?.available || state === 'running' || !!action.busy || (!failed && state !== 'failed')}
        onClick={retry}>{t('settings:upgradeRepairs.retryFailed')}</Button>
    </Footer>
  </Section>;
}
