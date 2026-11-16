/* 「存储空间」：数据目录在哪、所在磁盘还剩多少、各类数据各占多少，清理可重建的几类，
 * 或把整个数据目录迁到别的磁盘。
 *
 * 统计结果单独圈在一块面里：上面两张图（各类占比、磁盘占用），下面逐类一行。能清理的那几类
 * 行首有勾选框，勾几类一起清，或者「全部清理」；不能清理的勾选框禁用，行里写明为什么。
 *
 * 统计与清理在服务端后台线程里跑，进行中每 1.5 秒问一次状态。统计时按上次的文件数估进度，
 * 没统计过就只报走过多少文件。迁移请求被接受后服务会退出，
 * 页面只留一句回执：托盘完成迁移后会自己重新打开 Peach。 */
import { useEffect, useRef, useState } from 'react';
import { confirmModal } from '@peach/legacy/ui';
import { fmtSize } from '@peach/legacy/core';

import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';

import { ApiError, apiGet, apiSend, errorMessage } from '../../api';
import { PICK_FOLDER_URL } from '../../configuration-endpoints';
import { bodyFieldErrors, codedText, serverLabel, serverText } from '../../core/server-text';
import type { StorageCategory, StorageRelocation, StorageState } from '../bundle';
import { AnimatedNumber } from '../components/animated-number';
import { cardClass } from '../components/card';
import { ActivityStatus } from '../components/activity-motion';
import { PathLine } from '../components/path-line';
import { pickServerFolder, type FolderReply } from '../components/server-path-dialog';
import { Progress } from '../components/progress';
import { CommandSteps, ErrorText, Fact, FactList, Footer, Help, Stack, Section, translateWithNodes } from './section';
import { CATEGORY_SWATCH, REST_SWATCH, StorageOverview } from './storage-charts';
import { busyProps, useAction } from './use-action';
import { StorageBudgetSettings } from './storage-budget-settings';
import { pollUntil } from '../../polling';
import { interfaceLanguage, joinList, t } from '../../i18n';

const STORAGE_URL = '/api/configuration/storage';
const POLL_MS = 1500;
/** 一轮统计或清理最多跟这么久。 */
const POLL_LIMIT_MS = 60 * 60_000;
/** 迁移完成的回执留一天；之后只在还有要处理的事（备注）时显示。 */
const RESULT_MS = 24 * 3600 * 1000;

const targetReason = (cause: unknown) =>
  (cause instanceof ApiError && bodyFieldErrors<{ target?: string }>(cause.body)?.target)
  || errorMessage(cause);

function diskLine(storage: StorageState) {
  if (storage.free_bytes === null || storage.total_bytes === null) return t('settings:shared.notFound');
  const line = t('settings:storageSpace.diskFreeOfTotal', { free: fmtSize(storage.free_bytes), total: fmtSize(storage.total_bytes) });
  return storage.system_drive ? t('settings:storageSpace.systemDriveSuffix', { summary: line }) : line;
}

const cleanable = (category: StorageCategory) => category.cleanable && category.reclaimable > 0;
/** 类别名、说明与清理后果按 key 取当前界面语言，没有译文的照用服务端的中文。 */
const localizeCategory = (category: StorageCategory): StorageCategory => ({
  ...category,
  label: serverLabel(`storage.category.${category.key}.label`, category.label),
  description: serverLabel(`storage.category.${category.key}.description`, category.description),
  note: serverLabel(`storage.category.${category.key}.note`, category.note),
});

/** 迁移回执的原因与备注，按当前界面语言；`note_codes` 与 `notes` 同序，缺 code 的备注照原文。 */
const relocationLines = (last: StorageRelocation) =>
  [codedText(last, 'message'), ...(last.notes ?? []).map((note, index) =>
    serverLabel(last.note_codes?.[index]?.code ?? '', note, last.note_codes?.[index]?.params))];
/** 宿主机上的迁移步骤：说明与带占位名的命令都按当前界面语言。 */
const localizeStep = (step: { text: string; command: string }) =>
  ({ text: codedText(step, 'text'), command: codedText(step, 'command') });

/** 统计进行中：知道上次有多少文件就按它画一条估算的进度条（文案写明是估算），不知道就画检查动画、只说走过多少。 */
function Measuring({ job }: { job: StorageState['job'] }) {
  const files = job.files || 0;
  const expected = job.expected_files || 0;
  const nodes = { files: <AnimatedNumber value={files} />, size: <AnimatedNumber value={job.bytes || 0} format={fmtSize} /> };
  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {expected
        ? <>
            {/* 文件比上次多时进度条停在 99%，等结果出来。 */}
            <Progress label={t('settings:storageSpace.measureProgress')} value={Math.min(files, expected * 0.99)} max={expected} />
            <Help>{translateWithNodes('settings:storageSpace.measuringOfLast', { count: files, expected }, nodes)}</Help>
          </>
        : <ActivityStatus kind="radar" label={t('settings:storageSpace.measuringLabel')} />}
      {!expected ? <Help>{translateWithNodes('settings:storageSpace.measuring', { count: files }, nodes)}</Help> : null}
    </div>
  );
}

/** 一类数据一行：勾选框、色块、名字与说明、大小。不能清理的勾选框禁用，说明里写原因。 */
function CategoryRow(
  { category, selected, disabled, onToggle }:
  { category: StorageCategory; selected: boolean; disabled: boolean; onToggle(next: boolean): void },
) {
  const able = cleanable(category);
  const reason = category.cleanable
    ? category.reclaimable > 0 ? t('settings:storageSpace.afterCleanup', { effect: category.note }) : t('settings:storageSpace.nothingToClean')
    : t('settings:storageSpace.cannotClean', { reason: category.note });
  return (
    <div data-category={category.key}
      className="flex min-h-13 w-full items-start gap-3 border-b border-separator-border py-2.5 pr-3 last:border-b-0">
      <Checkbox aria-label={t('settings:storageSpace.cleanCategory', { category: category.label })} isSelected={selected} isDisabled={!able || disabled}
        onChange={onToggle} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex items-center gap-2 text-body-regular text-text-primary">
          <i aria-hidden className={`size-2.5 shrink-0 rounded-xs ${CATEGORY_SWATCH[category.key] || REST_SWATCH}`} />
          {category.label}
        </p>
        <p className="text-body-2-regular text-text-secondary">{category.description}</p>
        <p className="text-caption-1-regular text-text-tertiary">{reason}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <AnimatedNumber value={category.bytes} format={fmtSize} className="text-body-regular text-text-primary" />
        {able ? <span className="text-caption-1-regular text-text-secondary">{t('settings:storageSpace.canFree')} {fmtSize(category.reclaimable)}</span> : null}
      </div>
    </div>
  );
}

export function StorageSettings({ initial, receipt }: { initial: StorageState; receipt(message: string): void }) {
  const [storage, setStorage] = useState(initial);
  const [accepted, setAccepted] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const action = useAction();
  const running = storage.job.state !== 'idle';
  const reported = useRef(running);

  useEffect(() => {
    if (initial.usage || initial.job.state !== 'idle' || document.body.classList.contains('peach-guiding')) return;
    void action.run('measure', signal => apiSend<StorageState>(`${STORAGE_URL}/measure`, {}, 'POST', signal), setStorage);
  }, []);

  /* 有一轮在跑时 1.5 秒读一次，读失败退避，页面不可见时暂停，跑满上限就停。 */
  useEffect(() => {
    if (!running) return;
    const controller = new AbortController();
    void pollUntil({
      signal: controller.signal, everyMs: POLL_MS, limitMs: POLL_LIMIT_MS,
      read: (signal) => apiGet<StorageState>(STORAGE_URL, signal),
      apply: setStorage,
      done: (next) => next.job.state === 'idle',
    });
    return () => controller.abort();
  }, [running]);

  // 一轮统计或清理结束：成功的回执走 Toast，失败的原因留在分区里；清掉的类别不再勾着。
  useEffect(() => {
    if (running) { reported.current = true; return; }
    if (!reported.current) return;
    reported.current = false;
    setPicked(new Set());
    if (!storage.job.error) receipt(codedText(storage.job, 'message') || t('settings:storageSpace.measured'));
  }, [running]);

  const measure = () => void action.run('measure', (signal) =>
    apiSend<StorageState>(`${STORAGE_URL}/measure`, {}, 'POST', signal), setStorage);

  const usage = storage.usage && { ...storage.usage, categories: storage.usage.categories.map(localizeCategory) };
  const available = usage?.categories.filter(cleanable) ?? [];
  const chosen = available.filter((category) => picked.has(category.key));

  const clean = (targets: StorageCategory[], title: string) => {
    if (!targets.length) return;
    const total = targets.reduce((sum, category) => sum + category.reclaimable, 0);
    void confirmModal({
      title,
      body: t('settings:storageSpace.cleanBody', { size: fmtSize(total), items: joinList(targets.map((category) =>
        t('settings:storageSpace.cleanItem', { label: category.label, size: fmtSize(category.reclaimable), effect: category.note }))) }),
      confirmLabel: t('settings:storageSpace.cleanSize', { size: fmtSize(total) }),
      holdToConfirm: true,
      danger: targets.some((category) => category.key === 'backups'),
      onConfirm: async () => setStorage(await apiSend<StorageState>(`${STORAGE_URL}/clean`,
        { categories: targets.map((category) => category.key) })),
    });
  };

  const relocate = () => void action.run('relocate', async (signal) => {
    const target = await pickServerFolder(storage.data_root,
      body => apiSend<FolderReply>(PICK_FOLDER_URL, body, 'POST', signal), 'data');
    if (!target) return;
    const size = storage.usage ? fmtSize(storage.usage.total_bytes) : '';
    await confirmModal({
      title: t('settings:storageSpace.moveDataDirectory'),
      body: t('settings:storageSpace.moveConfirm', { size, from: storage.data_root, to: target }),
      confirmLabel: t('settings:storageSpace.moveDataDirectory'),
      onConfirm: async () => {
        try {
          setAccepted(serverText(await apiSend<{ message: string }>(`${STORAGE_URL}/relocate`, { target })));
        } catch (cause) {
          throw new Error(targetReason(cause));
        }
      },
    });
  }, () => undefined);

  const last = storage.relocation.last;
  const recent = last && (last.state === 'error' || (last.notes?.length ?? 0) > 0
    || Date.now() - last.finished_at * 1000 < RESULT_MS);
  const cleaningLabel = usage?.categories.find((category) => category.key === storage.job.category)?.label;
  const status = accepted
    || (storage.job.state === 'cleaning' ? t('settings:storageSpace.cleaningCategory', { category: cleaningLabel || '' })
      : storage.job.state === 'measuring' ? t('settings:storageSpace.measuringStatus')
        : chosen.length ? t('settings:storageSpace.selectedSummary', { count: chosen.length, size: fmtSize(chosen.reduce((sum, item) => sum + item.reclaimable, 0)) })
          : usage ? t('settings:storageSpace.measuredAt', { time: new Date(usage.measured_at * 1000).toLocaleString(interfaceLanguage) }) : '');
  const locked = running || Boolean(accepted);
  const toggle = (key: string) => (next: boolean) => setPicked((current) => {
    const copy = new Set(current);
    if (next) copy.add(key); else copy.delete(key);
    return copy;
  });
  return (<>
    <Section id="storageSettings" guide="storage" title={t('settings:diskUsage.title')}>
      <FactList>
        <Fact term={t('settings:shared.dataDirectory')}>
          <PathLine path={storage.data_root} className="text-body-regular text-text-primary" onRevealed={receipt} />
        </Fact>
        <Fact term={t('settings:diskUsage.disk')}>{diskLine(storage)}</Fact>
      </FactList>
      <Stack divided>
        {storage.job.state === 'measuring' ? <Measuring job={storage.job} /> : null}
        {usage?.capacity_error ? <ErrorText>{t('settings:storageSpace.capacityIncomplete')}{usage.capacity_error}</ErrorText> : null}
        {usage?.allocated_bytes != null ? <Help>{t('settings:storageSpace.allocatedOnDisk')} {fmtSize(usage.allocated_bytes)}</Help> : null}
        {usage
          ? <div data-storage-result="" className={cardClass({ variant: 'outlined', padding: 'none', className: 'flex flex-col' })}>
              <div className="border-b border-separator-border p-4"><StorageOverview storage={usage ? { ...storage, usage } : storage} /></div>
              <div className="flex flex-col pl-4">
                {usage.categories.map((category) => (
                  <CategoryRow key={category.key} category={category} selected={picked.has(category.key)}
                    disabled={locked} onToggle={toggle(category.key)} />
                ))}
              </div>
            </div>
          : storage.job.state === 'measuring' ? null
            : <Help>{t('settings:diskUsage.emptyHelp')}</Help>}
        {!storage.relocation.available ? <Help>{codedText(storage.relocation, 'message')}</Help> : null}
        {/* 设置页迁移不了的部署（容器）：宿主机上该做的几步，每步一句说明加一条可照抄的命令。 */}
        {!storage.relocation.available && storage.relocation.steps?.length
          ? <CommandSteps label={t('settings:storageSpace.moveOnHost')} steps={storage.relocation.steps.map(localizeStep)} />
          : null}
        {storage.job.error ? <ErrorText>{codedText(storage.job, 'message')}</ErrorText> : null}
        {action.error ? <ErrorText>{action.error}</ErrorText> : null}
        {recent && last ? (last.state === 'error'
          ? <ErrorText>{relocationLines(last).join(t('shell:format.semicolonSeparator'))}</ErrorText>
          : <Help>{relocationLines(last).join(t('shell:format.semicolonSeparator'))}</Help>) : null}
      </Stack>
      <Footer status={status ? <p role={accepted ? 'status' : undefined}>{status}</p> : null}>
        {usage ? <>
          <Button variant="secondary" disabled={locked || !chosen.length}
            {...busyProps(storage.job.state === 'cleaning' && chosen.length > 0)}
            onClick={() => clean(chosen, t('settings:storageSpace.cleanSelectedTitle'))}>{t('settings:storageSpace.cleanSelected')}</Button>
          <Button variant="secondary" disabled={locked || !available.length}
            onClick={() => clean(available, t('settings:storageSpace.cleanAllTitle'))}>{t('settings:storageSpace.cleanAll')}</Button>
        </> : null}
        <Button variant="secondary" disabled={locked || !storage.relocation.available || !usage}
          onClick={relocate} {...busyProps(action.busy === 'relocate')}>{t('settings:diskUsage.changeLocation')}</Button>
        <Button disabled={Boolean(accepted) || storage.job.state === 'cleaning'} onClick={measure}
          {...busyProps(action.busy === 'measure' || storage.job.state === 'measuring')}>
          {usage ? t('settings:diskUsage.measureAgain') : t('settings:diskUsage.measure')}
        </Button>
      </Footer>
    </Section>
    {storage.budget ? <StorageBudgetSettings initial={storage.budget} after={setStorage} receipt={receipt} /> : null}
    </>
  );
}
