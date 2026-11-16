/* 批量条（常驻组件 `batch-dock`，`batch-dock-island.tsx`）对壳的契约，以及每种语境下列哪几颗键。
 *
 * 多选的状态归共享 shell store 与 application/selection.js：开关、选中集、Shift 连选与切页退出只有一份。壳每次重画
 * 选中态时把计数与语境推进来；这一面只负责画底部那块浮条（共用的 `SelectionDock`）。点下去回到壳的
 * `run`：确认弹层、写接口、回执与撤销是壳里按分组分派的那几条流程，忙态挂在传回去的那颗键上。
 *
 * 每颗会写数据的键都在这里声明确认弹窗写什么（`confirm`）和做完怎么回去（`reversal`，见
 * `components/bulk-action.ts`）；壳的流程照这份声明弹窗、补「能否撤销」那一句、决定回执带不带撤销。 */
import { t } from '../../i18n';
import type { BulkReversal } from '../components/bulk-action';

/** 目录（含资料页与标签页）、回收站、垃圾文件、关注页。 */
export type BatchContext = 'catalog' | 'trash' | 'junk' | 'follow';

/** 一颗键回到壳的哪条流程：`batch` 走 `/api/batch`，`region` 是判定产地的弹层，`follow` 写关注条目，
 *  `junk` 是垃圾文件的判定，`clear` 退出多选。 */
export type BatchGroup = 'batch' | 'region' | 'follow' | 'junk' | 'clear';

/** 确认弹窗：标题与按钮同一个动词，正文写范围与做什么；能否撤销那一句由 `reversal` 补。 */
export interface BatchConfirm {
  title: string;
  body(count: number): string;
  /** 能撤销、但撤销不完全时换掉默认那一句。 */
  recovery?: string;
}

export interface BatchAction {
  group: BatchGroup;
  operation: string;
  label: string;
  glyph: string;
  danger?: boolean;
  holdToConfirm?: boolean;
  /** 会写数据的键必填；「取消」不写数据，两项都没有。 */
  confirm?: BatchConfirm;
  reversal?: BulkReversal;
}

export interface BatchDockProps {
  /** 选中了几项；0 时浮条收起。 */
  count: number;
  context: BatchContext;
  /** 垃圾文件页此刻看的是「已排除」那一份：那里给「重新判断」，待判断那一份给「不是垃圾」。 */
  junkDismissed: boolean;
}

export interface BatchDockHost {
  /** 这一面画进去的那一层（`[data-batch-dock]`，本身 `display: contents`），也就是常驻组件的宿主。 */
  root: HTMLElement;
  run(group: BatchGroup, operation: string, button: HTMLButtonElement): void;
}

export interface BatchDockApi {
  render(props: BatchDockProps): void;
}

const CLEAR: BatchAction = { group: 'clear', operation: 'clear', label: t('manage:batchDock.clearSelection'), glyph: 'x' };

const confirm = (title: string, body: string, recovery?: string): BatchConfirm =>
  ({ title, body: (count) => t(body, { count }), ...(recovery ? { recovery } : {}) });

/** 这一语境下浮条上的键，按从左到右的顺序。「取消」总在最后。 */
export function batchActions(context: BatchContext, junkDismissed = false): BatchAction[] {
  switch (context) {
    case 'trash':
      return [
        { group: 'batch', operation: 'restore', label: t('manage:shared.restore'), glyph: 'rotate-ccw', reversal: 'undo',
          confirm: confirm(t('shell:batchCatalog.restoreSelected'), 'shell:batchCatalog.confirmRestore') },
        { group: 'batch', operation: 'delete', label: t('manage:batchDock.deletePermanently'), glyph: 'trash', danger: true, reversal: 'irreversible', holdToConfirm: true,
          confirm: confirm(t('shell:batchCatalog.deleteSelected'), 'shell:batchCatalog.confirmDelete') },
        CLEAR,
      ];
    case 'junk':
      return [
        junkDismissed
          ? { group: 'junk', operation: 'reconsider-junk', label: t('manage:batchDock.recheck'), glyph: 'rotate-ccw', reversal: 'undo',
              confirm: confirm(t('shell:batchJunk.recheckFiles'), 'shell:batchJunk.confirmRecheck') }
          : { group: 'junk', operation: 'dismiss-junk', label: t('manage:batchDock.notJunk'), glyph: 'check', reversal: 'undo',
              confirm: confirm(t('shell:batchJunk.markNotJunk'), 'shell:batchJunk.confirmNotJunk') },
        { group: 'junk', operation: 'dispose', label: t('manage:shared.moveToTrash'), glyph: 'trash', danger: true, reversal: 'undo', holdToConfirm: true,
          confirm: confirm(t('shell:shared.moveToTrash'), 'shell:batchJunk.confirmDispose') },
        CLEAR,
      ];
    case 'follow':
      return [
        { group: 'follow', operation: 'save', label: t('manage:batchDock.saveToDatabase'), glyph: 'bookmark-plus', reversal: 'irreversible',
          confirm: confirm(t('shell:batchFollow.saveSelected'), 'shell:batchFollow.confirmSave') },
        { group: 'follow', operation: 'seen', label: t('manage:batchDock.markWatched'), glyph: 'eye', reversal: 'undo',
          confirm: confirm(t('follow:followDetail.markSeen'), 'shell:batchFollow.confirmSeen') },
        { group: 'follow', operation: 'ignored', label: t('manage:shared.ignore'), glyph: 'eye-off', reversal: 'undo',
          confirm: confirm(t('shell:batchFollow.ignoreSelected'), 'shell:batchFollow.confirmIgnore', t('shell:batchFollow.ignoreRecovery')) },
        CLEAR,
      ];
    default:
      return [
        { group: 'batch', operation: 'like', label: t('manage:shared.like'), glyph: 'thumbs-up', reversal: 'undo',
          confirm: confirm(t('shell:batchCatalog.likeSelected'), 'shell:batchCatalog.confirmLike') },
        { group: 'batch', operation: 'seen', label: t('manage:batchDock.seen'), glyph: 'eye', reversal: 'undo',
          confirm: confirm(t('shell:batchCatalog.markWatched'), 'shell:batchCatalog.confirmSeen') },
        { group: 'batch', operation: 'later', label: t('manage:shared.watchLater'), glyph: 'bookmark-plus', reversal: 'undo',
          confirm: confirm(t('shell:batchCatalog.addToWatchLater'), 'shell:batchCatalog.confirmLater') },
        { group: 'region', operation: 'region', label: t('manage:batchDock.setRegion'), glyph: 'globe', reversal: 'irreversible',
          confirm: confirm(t('shell:batchRegion.title'), 'shell:batchRegion.hint') },
        { group: 'batch', operation: 'dispose', label: t('manage:shared.moveToTrash'), glyph: 'trash', danger: true, reversal: 'undo', holdToConfirm: true,
          confirm: confirm(t('shell:shared.moveToTrash'), 'shell:batchCatalog.confirmDispose') },
        CLEAR,
      ];
  }
}

/** 这一语境下这个操作的声明；壳的流程按它弹窗与回执。 */
export function batchAction(context: BatchContext, operation: string, junkDismissed = false): BatchAction | undefined {
  return batchActions(context, junkDismissed).find((action) => action.operation === operation);
}
