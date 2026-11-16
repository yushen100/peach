import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowDownSLine, RiArrowRightLine } from '@remixicon/react';
import { Dialog, Popover } from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { MENU_ITEM, MENU_ITEM_INTERACTIVE, MENU_POPOVER_SURFACE } from '@/components/base/dropdown/menu-styles';
import { cx } from '@/utils/cx';
import { formModal } from '@peach/legacy/ui';
import { useMovingSurface } from '../components/use-moving-surface';
import { busyProps } from '../settings/use-action';
import { errorMessage } from '../../api';
import { fetchProcessingEstimate, type LibraryProcessingCommand, type ProcessingSpeed, type ProcessingTraffic } from './library-processing';
import { ProcessingEffort } from './processing-effort';
import { TrafficProgress } from './processing-traffic';
import { quoted, t } from '../../i18n';

interface ProcessingOption {
  label: string; description: string; command: LibraryProcessingCommand; disabled?: boolean;
}

function ProcessingMenuGroup({ label, maintenance = false, children }: {
  label: string; maintenance?: boolean; children: ReactNode;
}) {
  const ref = useMovingSurface('hover');
  return <div ref={ref} role="group" aria-label={label} data-processing-maintenance={maintenance || undefined}
    className={cx('flex flex-col gap-1', maintenance && 'mt-2')}>
    {children}
  </div>;
}

function ProcessingMenuOption({ option, metadataOnly, onRun }: {
  option: ProcessingOption; metadataOnly: boolean; onRun(command: LibraryProcessingCommand): void;
}) {
  const blocked = metadataOnly && option.command.stage === 'previews';
  const disabled = blocked || option.disabled;
  return <button type="button" disabled={disabled}
    title={blocked ? t('manage:completionPrompt.previewsDisabled') : undefined}
    className={cx(MENU_ITEM, disabled ? 'cursor-not-allowed opacity-50' : MENU_ITEM_INTERACTIVE, 'text-body-2-medium')}
    onClick={() => onRun(option.command)}><span className="flex min-w-0 flex-col gap-1">
      <span>{option.label}</span><span className="text-caption-1-regular text-text-secondary">{option.description}</span>
    </span></button>;
}

function ProcessingPrompt({ command, speed, dialog, onSpeed, busy, libraryName }: {
  libraryName?: string;
  command: LibraryProcessingCommand; speed: ProcessingSpeed; dialog: ReturnType<typeof formModal>;
  onSpeed(value: ProcessingSpeed): void; busy: boolean;
}) {
  const [mode, setMode] = useState(speed);
  const [traffic, setTraffic] = useState<ProcessingTraffic>();
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async (inventory?: string) => {
      try {
        const result = await fetchProcessingEstimate(command, controller.signal, inventory);
        if (!result.traffic) throw new Error(t('manage:syncPrompt.noEstimate'));
        if (controller.signal.aborted) return;
        setTraffic(result.traffic);
        dialog.confirmButton.disabled = false;
        if (result.traffic.inventory?.token) timer = setTimeout(() => { void load(result.traffic.inventory?.token) }, 250);
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailure(errorMessage(error));
          dialog.confirmButton.disabled = false;
        }
      }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer) };
  }, [command, dialog]);
  const scope = command.incremental ? command.stage === 'scan' ? t('manage:syncPrompt.scopeNewFiles') : t('manage:syncPrompt.scopeNewAndPending')
    : command.scope === 'new' ? t('manage:syncPrompt.scopePending')
    : command.stage === 'previews' ? t('manage:syncPrompt.scopePreviews') : t('manage:syncPrompt.scopeAll');
  return <div className="flex flex-col gap-4">
    <p data-processing-scope className="text-body-2-medium text-text-primary">{t('manage:syncPrompt.scopeLine', { library: libraryName || t('manage:scanFetch.allLibraries'), scope })}</p>
    <div className="flex justify-center"><ProcessingEffort value={mode} busy={busy} onChange={value => { setMode(value); onSpeed(value) }} /></div>
    {traffic ? <TrafficProgress traffic={traffic} initial /> : null}
    {failure || !traffic ? <p role="status" className="text-body-2-regular text-text-secondary">{failure ? t('manage:syncPrompt.estimateFailed', { error: failure }) : t('manage:syncPrompt.estimating')}</p> : null}
  </div>;
}

/** 扫描和已有作品补全共用资料流水线，视频预览由媒体库设置决定。
 *
 * `busy` 是这次启动还在路上，按钮标 `aria-busy`，点击由共享的忙碌拦截吞掉。`occupied` 是已有
 * 任务在跑：按钮只标 `aria-disabled`，点击仍会到达，由 `onOccupied` 告诉人为什么没有开始。 */
export function ProcessingActions({ busy, occupied = false, scan = false, metadataOnly = false, speedMode = 'standard', pendingCount = 0, libraryId, libraryName, onRun, onOccupied }: {
  libraryId?: string; libraryName?: string;
  busy: boolean; occupied?: boolean; scan?: boolean; metadataOnly?: boolean; speedMode?: ProcessingSpeed; pendingCount?: number;
  onRun(command: LibraryProcessingCommand): void | Promise<unknown>;
  onOccupied?(): void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const prompt = useRef<ReturnType<typeof formModal> | null>(null);
  const [promptView, setPromptView] = useState<{ host: HTMLElement; footer: HTMLElement; dialog: ReturnType<typeof formModal>; command: LibraryProcessingCommand } | null>(null);
  const selectedSpeed = useRef(speedMode);
  useEffect(() => () => prompt.current?.close(), []);
  const [open, setOpen] = useState(false);
  const primary: ProcessingOption = { label: scan ? t('manage:syncMenu.syncNewFiles') : t('manage:syncMenu.syncTheseVideos'), description: '',
    command: scan ? {incremental:true} : { stage: 'collect' as const } };
  const dailyOptions: ProcessingOption[] = [
    {label:t('manage:syncMenu.findNewOnly'), description:t('manage:syncMenu.findNewOnlyHint'), command:{stage:'scan',incremental:true}},
    {label:t('manage:syncMenu.fillPending'), description:libraryId ? t('manage:syncMenu.fillPendingHintLibrary')
      : pendingCount ? t('manage:syncMenu.fillPendingHintCount', { count: pendingCount }) : t('manage:syncMenu.noPending'),
      command:{stage:'collect',scope:'new'}, disabled:!pendingCount},
  ];
  const options: ProcessingOption[] = [
    ...(scan ? [{label:libraryId ? t('manage:syncMenu.syncSelectedLibrary') : t('manage:syncMenu.syncAllLibraries'),description:t('manage:syncMenu.syncLibraryHint'),command:{}}] : []),
    ...(scan ? [{ label: t('manage:syncMenu.scanOnly'), description: t('manage:syncMenu.scanOnlyHint'), command: { stage: 'scan' as const } }] : []),
    ...(scan ? [{ label: t('manage:syncMenu.fillMetadataPreviews'), description: metadataOnly ? t('manage:syncMenu.fillMetadataHintNoPreviews') : t('manage:syncMenu.fillMetadataHint'), command: { stage: 'collect' as const } }] : []),
    { label: t('manage:syncMenu.metadataOnly'), description: t('manage:syncMenu.metadataOnlyHint'), command: { stage: 'metadata' as const } },
    { label: t('manage:syncMenu.coversOnly'), description: t('manage:syncMenu.coversOnlyHint'), command: { stage: 'covers' as const } },
    { label: t('manage:syncMenu.previewsOnly'), description: t('manage:syncMenu.previewsOnlyHint'), command: { stage: 'previews' as const } },
  ];
  const blocked = busy || occupied;
  const blockedProps = busy ? busyProps(true) : occupied ? { 'aria-disabled': true } as const : {};
  const run = (command: LibraryProcessingCommand) => {
    if (busy) return;
    if (occupied) { onOccupied?.(); return }
    command = { ...command, ...(libraryId ? { library_id: libraryId } : {}) };
    setOpen(false);
    if (!scan) {
      void Promise.resolve(onRun(command)).catch(() => { /* 错误由任务入口留在原位 */ });
      return;
    }
    if (prompt.current) return;
    selectedSpeed.current = speedMode;
    const previews = command.stage === 'previews';
    const title = command.scope === 'new' ? t('manage:syncMenu.fillPending')
      : command.incremental ? command.stage === 'scan' ? t('manage:syncMenu.findNewTitle') : t('manage:syncMenu.syncNewFiles')
      : previews ? t('manage:syncMenu.previewsOnly') : command.stage === 'scan' ? t('manage:syncMenu.scanAllTitle')
      : command.stage === 'metadata' ? t('manage:syncMenu.metadataOnly') : command.stage === 'covers' ? t('manage:syncMenu.coversOnly')
      : command.stage === 'collect' ? t('manage:syncMenu.fillImportedTitle')
      : libraryId ? t('manage:syncMenu.syncSelectedLibrary') : t('manage:syncMenu.syncAllLibraries');
    const work = command.scope === 'new' ? t('manage:syncMenu.workPending')
      : command.incremental
      ? command.stage === 'scan' ? t('manage:syncMenu.workFindNew')
      : metadataOnly ? t('manage:syncMenu.workSyncNewNoPreviews') : t('manage:syncMenu.workSyncNew')
      : previews ? t('manage:syncMenu.workPreviews')
      : command.stage === 'scan' ? t('manage:syncMenu.workScan')
      : command.stage === 'metadata' ? t('manage:syncMenu.workMetadata')
      : command.stage === 'covers' ? t('manage:syncMenu.workCovers')
      : command.stage === 'collect'
        ? metadataOnly ? t('manage:syncMenu.workCollectNoPreviews') : t('manage:syncMenu.workCollect')
        : metadataOnly ? t('manage:syncMenu.workFullNoPreviews') : t('manage:syncMenu.workFull');
    const dialog = formModal({
      title,
      description: t('manage:syncPrompt.description', {
        scope: libraryName ? t('manage:syncPrompt.namedLibrary', { name: quoted(libraryName) }) : t('manage:scanFetch.allLibraries'), work,
      }),
      body: '<div class="peach-react" data-processing-prompt></div>',
      confirmLabel: title,
      confirmDisabled: true,
      onConfirm: async () => {
        await onRun({ ...command, ...(selectedSpeed.current === speedMode ? {} : { speed_mode: selectedSpeed.current }) });
      },
    });
    const footer = document.createElement('span');
    footer.className = 'peach-react flex items-center';
    dialog.confirmButton.before(footer);
    prompt.current = dialog;
    setPromptView({ host: dialog.dialog.querySelector<HTMLElement>('[data-processing-prompt]')!, footer, dialog, command });
    void dialog.done.then(() => { if (prompt.current === dialog) { prompt.current = null; setPromptView(null) } });
  };
  return <>
    {promptView ? createPortal(<ProcessingPrompt libraryName={libraryName} command={promptView.command} dialog={promptView.dialog}
      speed={speedMode} busy={blocked} onSpeed={value => { selectedSpeed.current = value }} />, promptView.host) : null}
    {promptView ? createPortal(<LinkButton href="/settings/library" size="small" variant="primary" trailingIcon={RiArrowRightLine} disabled={blocked}
      onClick={event => {
        if (promptView.dialog.confirmButton.getAttribute('aria-busy') === 'true') { event.preventDefault(); return }
        promptView.dialog.close();
      }}>{t('manage:syncMenu.manageLibraries')}</LinkButton>, promptView.footer) : null}
    <span data-button-group data-split-button data-variant="primary">
      <Button {...blockedProps} onClick={() => run(primary.command)}>{primary.label}</Button>
      <Button ref={trigger} iconOnly leadingIcon={RiArrowDownSLine} aria-label={t('manage:syncMenu.moreOptions')}
        aria-haspopup="dialog" aria-expanded={open} {...blockedProps} onClick={() => {
          if (busy) return;
          if (occupied) onOccupied?.(); else setOpen(!open);
        }} />
    </span>
    <Popover triggerRef={trigger} isOpen={open} onOpenChange={setOpen} placement="bottom end" offset={4}
      className={MENU_POPOVER_SURFACE}>
      <Dialog aria-label={t('manage:syncMenu.optionsLabel')} className="flex w-80 flex-col gap-1 outline-none">
        {scan ? <ProcessingMenuGroup label={t('manage:syncMenu.routineGroup')}>
          <p className="px-2 py-1 text-caption-1-medium text-text-secondary">{t('manage:syncMenu.routineGroup')}</p>
          {dailyOptions.map(option => <ProcessingMenuOption key={option.label} option={option} metadataOnly={metadataOnly} onRun={run} />)}
        </ProcessingMenuGroup> : null}
        <ProcessingMenuGroup label={scan ? t('manage:syncMenu.maintenanceGroup') : t('manage:syncMenu.fillGroup')} maintenance={scan}>
          {scan ? <p className="px-2 py-1 text-caption-1-medium text-text-secondary">{t('manage:syncMenu.maintenanceGroup')}</p> : null}
          {options.map(option => <ProcessingMenuOption key={option.label} option={option} metadataOnly={metadataOnly} onRun={run} />)}
        </ProcessingMenuGroup>
      </Dialog>
    </Popover>
  </>;
}
