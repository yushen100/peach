/* 编辑与确认沿用 formModal / confirmModal，表单字段复用 BoardUI。 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UNSAFE_PortalProvider } from 'react-aria';
import { formModal } from '@peach/legacy/ui';
import { overlayHost } from '../components/overlay-host';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '../components/select';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiSend } from '../../api';
import { queryClient } from '../query';
import { showToast } from '../toaster';
import { runBulkAction, type BulkAction, type BulkHost, type BulkReversal } from '../components/bulk-action';
import { joinList, quoted, t } from '../../i18n';

export type TagId = number | string;
export type TagScope = 'local' | 'online';
export interface ManagedTag { entity_id?: number; id?: string; k: string; n: number; hidden: boolean; blocked?: boolean; aliases: string[]; cat?: string; favorite?: boolean }
export const managedTagId = (tag: ManagedTag): TagId => tag.id ?? tag.entity_id!;
export type Operation = 'rename' | 'merge' | 'hide' | 'restore' | 'repair' | 'block' | 'unblock' | 'delete';
export interface Command { operation: Operation; ids: TagId[]; name?: string; target_id?: TagId; scope?: TagScope }
interface Plan { token: string; ids?: TagId[]; name?: string; assets: number; overlap: number; tags: ManagedTag[] }
export const TAG_ACTION_LABELS: Record<Operation, string> = {
  rename: t('catalog:tagOperations.renameTag'), merge: t('catalog:tagOperations.mergeTags'), hide: t('catalog:tagOperations.hideTags'), restore: t('catalog:tagOperations.unhideTags'), repair: t('catalog:tagManager.mergeDuplicates'),
  block: t('catalog:tagManager.blockContent'), unblock: t('catalog:tagManager.unblockContent'), delete: t('catalog:tagManager.deleteTag'),
};
/** 操作做完后的提示，每种操作一句完成态。 */
const TAG_ACTION_DONE: Record<Operation, string> = {
  rename: t('catalog:tagOperations.doneRename'), merge: t('catalog:tagOperations.doneMerge'), hide: t('catalog:tagOperations.doneHide'), restore: t('catalog:tagOperations.doneUnhide'),
  repair: t('catalog:tagOperations.doneRepair'), block: t('catalog:tagOperations.doneBlock'), unblock: t('catalog:tagOperations.doneUnblock'),
  delete: t('catalog:tagOperations.doneDelete'),
};

/** 已隐藏、已屏蔽内容各有几个：标签页平时那排状态药丸与标签管理共用。写入后 `invalidateQueries()` 一并刷新。 */
export function useTagStatusCounts(scope: TagScope, enabled = true) {
  const count = (state: 'hidden' | 'blocked') => ({
    queryKey: ['tag-management', scope, 'count', state],
    queryFn: ({ signal }: { signal: AbortSignal }) => apiGet<{ total: number }>(
      `/api/tag-management?${new URLSearchParams({ scope, state, limit: '1' })}`, signal).then((page) => page.total),
  });
  const hidden = useQuery({ ...count('hidden'), enabled });
  const blocked = useQuery({ ...count('blocked'), enabled: enabled && scope === 'online' });
  // 还在取是 `null`（药丸上摆骨架），本地范围没有屏蔽这一档是 `undefined`。
  return { hiddenCount: hidden.data ?? (enabled ? null : undefined),
    blockedCount: scope === 'online' ? blocked.data ?? (enabled ? null : undefined) : undefined };
}

export const previewTagOperation = (command: Command, signal?: AbortSignal) =>
  apiSend<Plan>('/api/tag-management/preview', command, 'POST', signal);

const applyTagOperation = (command: Command, plan: Plan, signal?: AbortSignal) =>
  apiSend('/api/tag-management', { ...command, token: plan.token }, 'POST', signal);

/** 隐藏与屏蔽是一对开关，撤销就是反向再做一次；改名、合并与删除会并掉或删掉标签，撤不回。 */
const INVERSE: Partial<Record<Operation, Operation>> = { hide: 'restore', restore: 'hide', block: 'unblock', unblock: 'block' };
export const TAG_REVERSAL: Record<Operation, BulkReversal> = {
  rename: 'irreversible', merge: 'irreversible', repair: 'irreversible', delete: 'irreversible',
  hide: 'undo', restore: 'undo', block: 'undo', unblock: 'undo',
};

function consequence(command: Command, plan: Plan): string {
  const names = joinList(plan.tags.map(tag => quoted(tag.k)));
  return command.operation === 'merge' || command.operation === 'repair'
    ? t('catalog:tagOperations.mergeConfirm', { count: plan.tags.length, assets: plan.assets, overlap: plan.overlap })
    : command.operation === 'rename' ? t('catalog:tagOperations.renameConfirm', { names, newName: quoted(plan.name || command.name || ''), count: plan.assets })
      : command.operation === 'delete' ? t('catalog:tagOperations.deleteConfirm', { count: plan.tags.length, assets: plan.assets })
      : command.operation === 'block' && command.name ? t('catalog:tagOperations.blockNameConfirm', { names, count: plan.assets })
      : command.operation === 'block' ? t('catalog:tagOperations.blockConfirm', { names, count: plan.assets })
        : command.operation === 'unblock' ? t('catalog:tagOperations.unblockConfirm', { names, count: plan.assets })
          : command.operation === 'hide' ? t('catalog:tagOperations.hideConfirm', { count: plan.tags.length, assets: plan.assets })
            : t('catalog:tagOperations.unhideConfirm', { count: plan.tags.length, assets: plan.assets });
}

/** 标签与名册批量动作的回执走全站 Toast；带撤销时撤销结果写回同一条。 */
export const toastHost: BulkHost = {
  receipt: (message, options) => {
    const id = `bulk-action-${Date.now()}`;
    const undo = options?.undo;
    showToast(id, { html: message, alert: false, timeout: undo ? 8000 : 6000, action: undo ? { label: t('shell:shared.undo'), run: () => {
      void undo().then(() => showToast(id, { html: t('shell:receipt.undone'), alert: false, timeout: 6000, action: null }),
        (error: unknown) => showToast(id, { html: t('shell:receipt.undoFailed', { message: error instanceof Error ? error.message : String(error) }),
          alert: true, timeout: 6000, action: null }));
    } } : null });
  },
};

/** 一次标签操作：先预览拿到影响范围与令牌再弹窗，确认后按令牌写入。`plan` 已经预览过时直接用。 */
export function tagOperation(command: Omit<Command, 'ids'>, label = TAG_ACTION_LABELS[command.operation], prepared?: Plan): BulkAction<TagId> {
  let plan: Plan | null = prepared ?? null;
  const op = command.operation;
  /* 「添加屏蔽标签」按名字写：页面没有 id（标签可能还没抓到过），写入照旧只带名字，回执与撤销用服务端认出来的那一条。 */
  const named = op === 'block' && !!command.name;
  const body = (ids: readonly TagId[]): Command => ({ ...command, ids: named ? [] : [...ids] });
  return {
    key: op, label, reversal: TAG_REVERSAL[op],
    confirm: async (ids) => {
      plan ??= await previewTagOperation(body(ids));
      return { title: TAG_ACTION_LABELS[op], body: consequence(body(ids), plan) };
    },
    run: async (ids) => {
      await applyTagOperation(body(ids), plan!);
      await queryClient.invalidateQueries();
      const inverse = INVERSE[op];
      if (!inverse) return;
      const done = [...ids];
      return async () => {
        const { name: _name, ...rest } = command;
        const back: Command = { ...rest, operation: inverse, ids: done };
        await applyTagOperation(back, await previewTagOperation(back));
        await queryClient.invalidateQueries();
      };
    },
    receipt: () => TAG_ACTION_DONE[op],
  };
}

export async function confirmTagOperation(command: Command, plan: Plan, signal?: AbortSignal) {
  if (signal?.aborted) return false;
  const { ids, ...rest } = command;
  return runBulkAction(tagOperation(rest, undefined, plan), ids.length ? ids : plan.ids ?? [], toastHost);
}

type FormDialog = ReturnType<typeof formModal>;
/** 改名、合并，以及在线标签的「添加屏蔽标签」（`block`：填一个名字，还没抓到过的标签也能先屏蔽）。 */
export type EditorOperation = 'rename' | 'merge' | 'block';
export function TagEditor({ operation, selected, close, done, scope = 'local' }: {
  operation: EditorOperation; selected: ManagedTag[]; close(): void; done(): void; scope?: TagScope;
}) {
  const initial = useRef({ operation, selected, close, done, scope });
  const draft = useRef({ name: operation === 'block' ? '' : selected[0]?.k || '', target_id: selected[0] ? managedTagId(selected[0]) : 0 });
  const [view, setView] = useState<{ host: Element; dialog: FormDialog } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const given = initial.current;
    const dialog = formModal({ title: given.operation === 'block' ? t('catalog:tagManager.blockByName') : TAG_ACTION_LABELS[given.operation],
      confirmLabel: t('catalog:tagOperations.previewImpact'), confirmDisabled: true,
      body: '<div class="peach-react" data-tag-editor-fields></div>',
      onConfirm: async () => {
        const command: Command = { operation: given.operation, ids: given.operation === 'block' ? [] : given.selected.map(managedTagId),
          ...(given.scope === 'online' ? { scope: given.scope } : {}),
          ...(given.operation === 'merge' ? { target_id: draft.current.target_id } : { name: draft.current.name.trim() }) };
        const plan = await previewTagOperation(command, controller.signal);
        return { command, plan };
      } });
    setView({ host: dialog.dialog.querySelector('[data-tag-editor-fields]')!, dialog });
    void dialog.done.then(async result => {
      if (controller.signal.aborted) return;
      if (result.confirmed) {
        const prepared = result.result as { command: Command; plan: Plan };
        if (await confirmTagOperation(prepared.command, prepared.plan, controller.signal)) given.done();
      }
      if (!controller.signal.aborted) given.close();
    });
    return () => { controller.abort(); dialog.close() };
  }, []);
  /* 「保留哪一个」的下拉挂进这个弹层自己的 dialog：落在 body 或详情舞台上会被后开的模态框盖住，看起来是空下拉。 */
  return view ? createPortal(<UNSAFE_PortalProvider getContainer={() => overlayHost(view.dialog.dialog)}>
    <TagFields operation={initial.current.operation} selected={initial.current.selected} dialog={view.dialog}
      update={value => { draft.current = value }} />
  </UNSAFE_PortalProvider>, view.host) : null;
}

function TagFields({ operation, selected, dialog, update }: {
  operation: EditorOperation; selected: ManagedTag[]; dialog: FormDialog;
  update(value: { name: string; target_id: TagId }): void;
}) {
  const [name, setName] = useState(operation === 'block' ? '' : selected[0]?.k || '');
  const [target, setTarget] = useState<TagId>(selected[0] ? managedTagId(selected[0]) : 0);
  useEffect(() => {
    update({ name, target_id: target });
    dialog.confirmButton.disabled = operation === 'block' ? !name.trim()
      : operation === 'rename' && (!name.trim() || name.trim() === selected[0]?.k);
  }, [name, target, dialog, operation, selected, update]);
  return operation !== 'merge' ? <Input autoFocus aria-label={t('catalog:tagOperations.tagName')} value={name} onChange={setName} maxLength={80} />
    : <Select aria-label={t('catalog:tagOperations.tagToKeep')} prefix={t('catalog:tagOperations.keep')} selectedKey={String(target)} onSelectionChange={key => {
      const row = selected.find(tag => String(managedTagId(tag)) === String(key)); if (row) setTarget(managedTagId(row));
    }}>
      {selected.map(row => <SelectItem key={managedTagId(row)} id={String(managedTagId(row))}>{row.k}</SelectItem>)}
    </Select>;
}
