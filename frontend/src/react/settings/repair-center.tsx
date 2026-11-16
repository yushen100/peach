/** 「应用与维护 › 修复与迁移」子页：升级后的各项修复做了什么、改了多少；开销大或可能改错的在这里等用户确认。
 *
 *  历史里列出每次修复前留下的账本备份：还在的去「账本备份」恢复，清退了的照实写。页头的面包屑由管理区页头画。
 *  首屏数据随路由预取（`repair-center-data.ts`），等待时画路由骨架；有项在跑或还在统计时每 2 秒重读，做完就停。
 *  等确认的项还没开始，只写待处理的量和「开始」；开始之后才有进度条，「开始」换成状态标签。 */
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RiArrowRightLine } from '@remixicon/react';
import { fmtSize } from '@peach/legacy/core';
import { confirmModal } from '@peach/legacy/ui';
import { Button } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { apiSend } from '../../api';
import { withBackoff } from '../../polling';
import { repairCenterPanelSkeleton } from '../../management-skeletons';
import { RESULT_PANEL, RESULT_SECTION, SectionHeading } from '../components/fieldset';
import { Note } from '../components/note';
import { Page } from '../components/page';
import { Progress } from '../components/progress';
import { StatusLabel, type StatusTone } from '../components/status-label';
import { queryClient } from '../query';
import {
  fetchRepairs, localizeRepairs, REPAIRS_KEY, type RepairCenterData, type RepairHistory, type RepairItem,
} from './repair-center-data';
import { useAction } from './use-action';
import { interfaceLanguage, t } from '../../i18n';

const STATES: Record<string, [string, StatusTone]> = {
  done: [t('settings:shared.completed'), 'success'], succeeded: [t('settings:shared.completed'), 'success'], complete: [t('settings:shared.completed'), 'success'],
  running: [t('settings:shared.inProgress'), 'progress'], pending: [t('settings:repairCenter.queued'), 'neutral'], waiting: [t('settings:repairCenter.awaitingConfirmation'), 'warning'],
  failed: [t('settings:repairCenter.needsRetry'), 'error'], none: [t('settings:repairCenter.nothingToDo'), 'neutral'],
};
const number = (value = 0) => value.toLocaleString();
const stamp = (seconds: number) => new Date(seconds * 1000).toLocaleString(interfaceLanguage, {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const reclaimable = (item: RepairItem) => t('settings:repairCenter.filesAndSize', { count: item.files || 0, size: fmtSize(item.bytes || 0) });
/** 在跑且知道总量的项画进度条；件数写在条旁边，右侧只留状态，手机宽度下才不挤说明列。 */
const progressing = (item: RepairItem) => item.state === 'running' && !!item.total;
/** 页面开着时要跟进的后台进度：在跑的项与还在统计的删除类确认项。补测要跑几天，正因为久才要看得到进度。 */
const inFlight = (item: RepairItem) => !!item.estimating || item.state === 'running';
/** 有修复在估算或在跑时每 2 秒读一次，都停了就停；读失败按连续失败次数退避。 */
export const repairsInterval = withBackoff<RepairCenterData>((data) => (data?.items.some(inFlight) ? 2000 : false));

function reading(item: RepairItem) {
  if (item.estimating) return t('settings:repairCenter.estimating');
  if (item.state === 'failed' && item.error) return item.error;
  // 行里只写体积，手机宽度下才不挤说明列；文件数在确认弹层里点名。
  if (item.files) return t('settings:repairCenter.reclaimable', { size: fmtSize(item.bytes || 0) });
  if (item.state === 'waiting' && item.backed_up) return t('settings:repairCenter.pendingFixes', { count: item.pending || 0 });
  if (item.state === 'waiting') return item.pending ? t('settings:repairCenter.pendingRecheck', { count: item.pending }) : '';
  if (progressing(item)) return '';
  if (item.total) return `${number(item.done)} / ${number(item.total)}`;
  if (item.mode === 'confirm') return '';
  return item.changed ? t('settings:repairCenter.changedCount', { count: item.changed }) : '';
}

function Row({ title, description, progress, children }: {
  title: string; description: string; progress?: ReactNode; children: ReactNode;
}) {
  return (
    <div className={`${RESULT_SECTION} flex flex-wrap items-center justify-between gap-x-4 gap-y-2`}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-medium text-text-primary">{title}</span>
        <span className="text-body-2-regular text-text-secondary">{description}</span>
        {progress ? <div className="pt-2">{progress}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

function ItemProgress({ item }: { item: RepairItem }) {
  return <div className="flex items-center gap-3">
    <div className="min-w-0 flex-1"><Progress label={t('settings:repairCenter.itemProgress', { title: item.title })} value={item.done || 0} max={item.total} /></div>
    <span className="shrink-0 text-caption-1-regular text-text-secondary tabular-nums">
      {number(item.done)} / {number(item.total)}</span>
  </div>;
}

export function RepairCenterPage() {
  const query = useQuery({
    queryKey: REPAIRS_KEY,
    queryFn: ({ signal }) => fetchRepairs(signal),
    refetchInterval: repairsInterval,
  });
  const data = query.data;
  const action = useAction();
  const update = (next: RepairCenterData) => queryClient.setQueryData(REPAIRS_KEY, next);
  const post = async (item: RepairItem, signal?: AbortSignal) => localizeRepairs(await apiSend<RepairCenterData>(
    `/api/configuration/repairs/${item.id}`, {}, 'POST', signal));
  const start = (item: RepairItem) => item.backed_up
    ? void confirmModal({
      title: t('settings:repairCenter.applyTitle', { title: item.title }),
      body: t('settings:repairCenter.applyBody', { count: item.pending || 0 }),
      confirmLabel: t('settings:shared.start'),
      onConfirm: async () => update(await post(item)),
    })
    : item.files === undefined
    ? void action.run(item.id, signal => post(item, signal), update)
    : void confirmModal({
      title: t('settings:repairCenter.deleteTitle', { title: item.title }),
      body: t('settings:repairCenter.deleteBody', { amount: reclaimable(item) }),
      confirmLabel: t('settings:repairCenter.deleteSnapshots'), danger: true,
      onConfirm: async () => update(await post(item)),
    });
  const backupNote = (row: RepairHistory) => !row.backups.length ? null : row.backups.some(backup => backup.exists)
    ? <LinkButton href="/settings/maintenance#ledgerBackups" size="small" trailingIcon={RiArrowRightLine}>{t('settings:repairCenter.preRepairBackup')}</LinkButton>
    : <span className="text-body-2-regular text-text-tertiary">{t('settings:repairCenter.backupCleaned')}</span>;
  const failure = action.error || (query.error ? query.error.message : '');

  return <Page>
    {failure ? <Note tone="error">{failure}</Note> : null}
    <section aria-labelledby="repair-items" className="flex flex-col gap-4">
      <SectionHeading id="repair-items">{t('settings:repairCenter.itemsHeading')}</SectionHeading>
      {!data
        // 预取失败后在页内重取：画与路由骨架同一份占位，不留一张空卡。
        ? <div className="contents" data-skeleton="" aria-busy="true" aria-label={t('settings:repairCenter.loadingItems')}
            dangerouslySetInnerHTML={{ __html: repairCenterPanelSkeleton() }} />
        : !data.items.length
        ? <p className="text-body-2-regular text-text-secondary">{t('settings:repairCenter.empty')}</p>
        : <div className={RESULT_PANEL}>
        {data.items.map(item => {
          const [label, tone] = STATES[item.state] || STATES.none;
          const text = reading(item);
          return (
            <Row key={item.id} title={item.title} description={item.summary}
              progress={progressing(item) ? <ItemProgress item={item} /> : null}>
              {text ? <span className="text-body-2-regular text-text-secondary">{text}</span> : null}
              {item.mode === 'confirm' && item.state === 'waiting'
                ? <Button size="small" disabled={!data.available || !!action.busy || item.estimating}
                    onClick={() => start(item)}>{t('settings:shared.start')}</Button>
                : <StatusLabel tone={tone}>{label}</StatusLabel>}
            </Row>
          );
        })}
      </div>}
    </section>
    {data?.history.length ? <section aria-labelledby="repair-history" className="flex flex-col gap-4">
      <SectionHeading id="repair-history">{t('settings:repairCenter.history')}</SectionHeading>
      <div className={RESULT_PANEL}>
        {data.history.map(row => (
          <Row key={row.id} title={row.title}
            description={`${stamp(row.at)} · ${row.changed ? t('settings:repairCenter.changedCount', { count: row.changed }) : t('settings:repairCenter.noChanges')}`}>
            {backupNote(row)}
          </Row>
        ))}
      </div>
    </section> : null}
  </Page>;
}
