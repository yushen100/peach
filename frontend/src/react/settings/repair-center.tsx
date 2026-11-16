/** 「应用与维护 › 修复与迁移」子页：升级后的各项修复做了什么、改了多少；开销大或可能改错的在这里等用户确认。
 *
 *  历史里列出每次修复前留下的账本备份：还在的去「账本备份」恢复，清退了的照实写。页头的面包屑由管理区页头画。
 *  首屏数据随路由预取（`repair-center-data.ts`），等待时画路由骨架；有项在跑或还在统计时每 2 秒重读，做完就停。
 *  等确认的项还没开始，只写待处理的量和「开始」；开始之后才有进度条，「开始」换成状态标签。
 *  各项按改动落在哪类数据上分组（服务端 `repair_center.GROUPS`），组内先列等确认、在跑与要重试的。
 *  一组里有两项以上等确认时标题旁给「开始这一组」，跨两组以上时页顶给「全部开始」；都先在一个弹层里逐项列出。
 *  补测有片子延后或失败时，说明下面另起一行写明延后几部、在等什么；没做完的只剩延后就标「已延后」，不报进行中。 */
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
import { interfaceLanguage, quoted, t } from '../../i18n';

const STATES: Record<string, [string, StatusTone]> = {
  done: [t('settings:shared.completed'), 'success'], succeeded: [t('settings:shared.completed'), 'success'], complete: [t('settings:shared.completed'), 'success'],
  running: [t('settings:shared.inProgress'), 'progress'], pending: [t('settings:repairCenter.queued'), 'neutral'], waiting: [t('settings:repairCenter.awaitingConfirmation'), 'warning'],
  deferred: [t('settings:repairCenter.deferred'), 'neutral'],
  failed: [t('settings:repairCenter.needsRetry'), 'error'], none: [t('settings:repairCenter.nothingToDo'), 'neutral'],
};
const GROUPS: Record<string, string> = {
  files: t('settings:repairCenter.groups.files'), catalog: t('settings:repairCenter.groups.catalog'),
  people: t('settings:repairCenter.groups.people'), follow: t('settings:repairCenter.groups.follow'),
  records: t('settings:repairCenter.groups.records'),
};
/** 服务端已按组排好序，这里只把相邻的同组项收成一段。 */
const grouped = (items: RepairItem[]) => items.reduce<[string, RepairItem[]][]>((groups, item) => {
  const last = groups[groups.length - 1];
  if (last && last[0] === item.group) last[1].push(item);
  else groups.push([item.group, [item]]);
  return groups;
}, []);
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

/** 延后原因码（mount / cooldown / cost）对应的说法；旧版延后时没记原因（空串），到时间会自己重派。 */
const DEFER_REASONS = new Set(['mount', 'cooldown', 'cost']);
const deferReason = (code: string) => t(`settings:repairCenter.deferReasons.${DEFER_REASONS.has(code) ? code : 'retry'}`);

/** 补测里延后与失败的片子：延后几部、各在等什么，以及等你重试的失败。都没有就不写。 */
function waitingNote(item: RepairItem) {
  const reasons = Object.entries(item.deferred || {}).filter(([, count]) => count > 0);
  const deferred = reasons.reduce((sum, [, count]) => sum + count, 0);
  const parts: string[] = [];
  if (deferred) {
    const reason = reasons.length === 1 ? deferReason(reasons[0][0])
      : reasons.map(([code, count]) => t('settings:repairCenter.deferReasonCount', { reason: deferReason(code), count }))
        .join(t('shell:format.clauseSeparator'));
    parts.push(t('settings:repairCenter.deferredNote', { count: deferred, reason }));
  }
  if (item.failed) {
    parts.push(t('settings:repairCenter.failedNote', { count: item.failed, place: quoted(t('settings:upgradeRepairs.title')) }));
  }
  return parts.length
    ? <span className="text-caption-1-regular text-text-secondary">{parts.join(t('shell:format.semicolonSeparator'))}</span> : null;
}

function reading(item: RepairItem) {
  if (item.estimating) return t('settings:repairCenter.estimating');
  if (item.state === 'failed' && item.error) return item.error;
  // 行里只写体积，手机宽度下才不挤说明列；文件数在确认弹层里点名。
  if (item.files) return t('settings:repairCenter.reclaimable', { size: fmtSize(item.bytes || 0) });
  if (item.state === 'pending' && item.online) return t('settings:repairCenter.pendingChecks', { count: item.pending || 0 });
  if (item.state === 'waiting' && item.backed_up) return t('settings:repairCenter.pendingFixes', { count: item.pending || 0 });
  if (item.covers) return t('settings:repairCenter.pendingCovers', { count: item.covers });
  if (item.state === 'waiting') return item.pending ? t('settings:repairCenter.pendingRecheck', { count: item.pending }) : '';
  if (progressing(item)) return '';
  if (item.total) return `${number(item.done)} / ${number(item.total)}`;
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

/** 说明下面那一块：在跑的画进度条，延后或失败的片子另起一行写明；两样都没有是 null，行里不留空白。 */
function detail(item: RepairItem) {
  const note = waitingNote(item);
  if (!progressing(item)) return note;
  return note ? <div className="flex flex-col gap-1.5"><ItemProgress item={item} />{note}</div> : <ItemProgress item={item} />;
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
      confirmLabel: t('settings:repairCenter.deleteSnapshots'), danger: true, holdToConfirm: true,
      onConfirm: async () => update(await post(item)),
    });
  /** 等确认、现在就能开始的项（还在统计的删除项除外）。 */
  const startable = (items: RepairItem[]) => items.filter(item => item.mode === 'confirm' && item.state === 'waiting' && !item.estimating);
  /** 一次开始几项：弹层逐项写名称与量，有删除项时按危险操作确认；依次开始，某项失败就停在那里、原因留在弹层里。 */
  const startMany = (items: RepairItem[], title: string) => void confirmModal({
    title, body: items.some(item => item.files !== undefined) ? t('settings:repairCenter.startManyBodyDelete') : t('settings:repairCenter.startManyBody'),
    items: items.map(item => t('settings:repairCenter.startManyItem', {
      title: item.title, amount: item.files !== undefined ? reclaimable(item) : reading(item) })),
    confirmLabel: t('settings:shared.start'), danger: items.some(item => item.files !== undefined),
    holdToConfirm: items.some(item => item.files !== undefined),
    onConfirm: async () => { for (const item of items) update(await post(item)); },
  });
  const backupNote = (row: RepairHistory) => !row.backups.length ? null : row.backups.some(backup => backup.exists)
    ? <LinkButton href="/settings/maintenance#ledgerBackups" size="small" trailingIcon={RiArrowRightLine}>{t('settings:repairCenter.preRepairBackup')}</LinkButton>
    : <span className="text-body-2-regular text-text-tertiary">{t('settings:repairCenter.backupCleaned')}</span>;
  const failure = action.error || (query.error ? query.error.message : '');

  const waiting = data ? startable(data.items) : [];
  const spread = new Set(waiting.map(item => item.group)).size;

  return <Page>
    {failure ? <Note tone="error">{failure}</Note> : null}
    {/* 跨两组以上才给「全部开始」；只在一组里时用那一组标题旁的按钮，不摆两个做同一件事的键。 */}
    {data && spread > 1 ? <Note tone="info" action={
      <Button size="small" disabled={!data.available || !!action.busy}
        onClick={() => startMany(waiting, t('settings:repairCenter.startAllTitle'))}>{t('settings:repairCenter.startAll')}</Button>}>
      {t('settings:repairCenter.waitingCount', { count: waiting.length })}</Note> : null}
    {!data?.items.length
      ? <section aria-labelledby="repair-items" className="flex flex-col gap-4">
        <SectionHeading id="repair-items">{t('settings:repairCenter.itemsHeading')}</SectionHeading>
        {!data
          // 预取失败后在页内重取：画与路由骨架同一份占位，不留一张空卡。
          ? <div className="contents" data-skeleton="" aria-busy="true" aria-label={t('settings:repairCenter.loadingItems')}
              dangerouslySetInnerHTML={{ __html: repairCenterPanelSkeleton() }} />
          : <p className="text-body-2-regular text-text-secondary">{t('settings:repairCenter.empty')}</p>}
      </section>
      : grouped(data.items).map(([group, items]) => (
        <section key={group} aria-labelledby={`repair-group-${group}`} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading id={`repair-group-${group}`}>{GROUPS[group] || group}</SectionHeading>
            {startable(items).length > 1
              ? <Button size="small" disabled={!data.available || !!action.busy}
                  onClick={() => startMany(startable(items), t('settings:repairCenter.startGroupTitle', { group: GROUPS[group] || group }))}>
                  {t('settings:repairCenter.startGroup')}</Button>
              : null}
          </div>
          <div className={RESULT_PANEL}>
            {items.map(item => {
              const [label, tone] = STATES[item.state] || STATES.none;
              const text = reading(item);
              return (
                <Row key={item.id} title={item.title} description={item.summary}
                  progress={detail(item)}>
                  {text ? <span className="text-body-2-regular text-text-secondary">{text}</span> : null}
                  {item.mode === 'confirm' && item.state === 'waiting'
                    ? <Button size="small" disabled={!data.available || !!action.busy || item.estimating}
                        onClick={() => start(item)}>{t('settings:shared.start')}</Button>
                    : <StatusLabel tone={tone}>{label}</StatusLabel>}
                </Row>
              );
            })}
          </div>
        </section>
      ))}
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
