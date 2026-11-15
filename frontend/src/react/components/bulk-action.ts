/* 批量动作的统一契约：先弹确认、做完给回执，能原样撤回的回执带撤销，撤不回的在弹窗里写明。
 *
 * 每颗批量键都要声明两件事：确认弹窗写什么（范围、做什么、保留什么），以及做完以后怎么回去
 * （`undo` 由 `run` 交回撤销函数，`irreversible` 弹窗补一句「不能撤销」）。能否恢复那一句由
 * 这里按声明补上，调用处不各写一份，也就不会有哪颗键悄悄省掉。`assertBulkAction` 是同一条
 * 约定的运行时门槛：浮条与批量条挂键时逐个过一遍，缺项直接报错。 */
import { confirmModal } from '@peach/legacy/ui';
import { t } from '../../i18n';

/** 做完以后怎么回去：`undo` 是回执上带撤销；`irreversible` 是真的撤不回，弹窗写明。 */
export type BulkReversal = 'undo' | 'irreversible';
export const BULK_REVERSALS: readonly BulkReversal[] = ['undo', 'irreversible'];

export type BulkUndo = () => Promise<void>;

/** 确认弹窗的标题与正文。正文写范围（N 项）、做什么、保留什么；能否恢复由 `reversal` 补。 */
export interface BulkConfirm {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  /** 能撤销、但撤销不完全（或在别处恢复）时换掉默认那一句；撤不回的一律写「不能撤销」，不能换。 */
  recovery?: string;
  /** 弹窗里列出的条目名。 */
  items?: readonly string[];
}

export interface BulkAction<T> {
  key: string;
  label: string;
  reversal: BulkReversal;
  danger?: boolean;
  /** 弹窗文案；要先向服务端要一份清单（删除计划、预览）时可以是异步的，拒绝就不弹窗。 */
  confirm(items: readonly T[]): BulkConfirm | Promise<BulkConfirm>;
  /** 写入；`reversal` 为 `undo` 时必须交回撤销函数。 */
  run(items: readonly T[]): Promise<BulkUndo | void>;
  /** 过去时回执；交回空串时不发（后台任务的结论由任务自己的回执说）。 */
  receipt(items: readonly T[], result: { undo?: BulkUndo }): string;
}

/** 带撤销的过去时回执，页面从壳那里接过来的那一份。 */
export type Receipt = (message: string, options?: { undo?: BulkUndo }) => void;

export interface BulkHost {
  receipt(message: string, options?: { undo?: BulkUndo }): void;
  /** 弹窗之前就失败了（取清单失败、没有可处理的）：原因交给页面放在原位置。 */
  failure?(error: unknown): void;
}

/** 声明不全就拒绝：确认文案与撤销方式都是必填。 */
export function assertBulkAction(action: Partial<BulkAction<unknown>> & { key?: string }): void {
  const name = action.key || action.label || '?';
  if (typeof action.confirm !== 'function') throw new Error(`bulk action ${name} has no confirmation`);
  if (!BULK_REVERSALS.includes(action.reversal as BulkReversal)) throw new Error(`bulk action ${name} does not declare how to undo`);
}

/** 弹窗正文末尾那一句：能不能恢复。 */
export const reversalNote = (reversal: BulkReversal) =>
  reversal === 'undo' ? t('shell:bulkAction.canUndo') : t('shell:bulkAction.cannotUndo');

/** 弹窗正文：调用方的那句加上能否恢复。 */
export const confirmBody = (body: string, reversal: BulkReversal, recovery?: string) =>
  `${body}${reversal === 'undo' && recovery ? recovery : reversalNote(reversal)}`;

/** 确认、写入、回执一条走完。取消时回 `false`；写入失败时弹窗留着、原因写在正文下面。 */
export async function runBulkAction<T>(action: BulkAction<T>, items: readonly T[], host: BulkHost): Promise<boolean> {
  assertBulkAction(action as Partial<BulkAction<unknown>>);
  if (!items.length) return false;
  const confirm = await action.confirm(items);
  let undo: BulkUndo | undefined;
  const { confirmed } = await confirmModal({
    title: confirm.title,
    body: confirmBody(confirm.body, action.reversal, confirm.recovery),
    items: confirm.items,
    confirmLabel: confirm.confirmLabel ?? confirm.title,
    danger: confirm.danger ?? action.danger ?? false,
    onConfirm: async () => {
      const result = await action.run(items);
      if (action.reversal === 'undo') {
        if (typeof result !== 'function') throw new Error(`bulk action ${action.key} returned no undo`);
        undo = result;
      }
    },
  });
  if (!confirmed) return false;
  const message = action.receipt(items, { undo });
  // 后台任务那种写入，结论由任务自己的回执说，这里不再补一条。
  if (!message) return true;
  if (undo) host.receipt(message, { undo });
  else host.receipt(message);
  return true;
}
