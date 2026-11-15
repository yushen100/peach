/* 名册多选的写入键：订阅或取消订阅新作、从名册隐藏或恢复、名下作品移进回收站。
 *
 * 都走 `/api/entity-batch`（`src/peach/web_entity_batch.py`）。服务端回执只列这一批里真正变了的
 * 那几项，撤销按它原样反向做：原本就订着、就隐藏着、就在回收站里的，撤销时不会被一起改掉。 */
import { apiGet, apiSend } from '../../api';
import { queryClient } from '../query';
import type { BulkAction } from '../components/bulk-action';
import type { IndexKind, IndexPerson } from './index-data';
import { t } from '../../i18n';

export type RosterKind = Exclude<IndexKind, 'tags'>;

interface BatchResult { entity_ids?: number[]; asset_ids?: number[]; skipped: { id: number; name: string }[] }

const send = (body: Record<string, unknown>) => apiSend<BatchResult>('/api/entity-batch', body, 'POST');
const personId = (item: IndexPerson) => item.entity_id ?? item.id ?? 0;
const ids = (items: readonly IndexPerson[]) => items.map(personId).filter(Boolean);
const refresh = () => queryClient.invalidateQueries();

/** 一对能互相撤销的实体动作（订阅↔取消订阅、隐藏↔恢复）。 */
function entityAction(key: string, inverse: string, label: string, body: (count: number) => string,
  done: (count: number, skipped: number) => string): BulkAction<IndexPerson> {
  let result: BatchResult = { skipped: [] };
  return {
    key, label, reversal: 'undo',
    confirm: (items) => ({ title: label, body: body(items.length) }),
    run: async (items) => {
      result = await send({ operation: key, entity_ids: ids(items) });
      await refresh();
      const changed = result.entity_ids ?? [];
      return async () => {
        if (changed.length) await send({ operation: inverse, entity_ids: changed });
        await refresh();
      };
    },
    receipt: () => done(result.entity_ids?.length ?? 0, result.skipped.length),
  };
}

/** 名下（或标签下）作品移进回收站：弹窗前先问服务端一共几部，撤销把这一批原样移出来。
 *  名册与标签管理共用，`body` 是各自那句弹窗正文。 */
export function contentTrashAction<T>(label: string, idOf: (item: T) => number,
  body: (count: number, assets: number) => string): BulkAction<T> {
  let moved: number[] = [];
  const entityIds = (items: readonly T[]) => items.map(idOf).filter(Boolean);
  return {
    key: 'trash', label, reversal: 'undo', danger: true,
    confirm: async (items) => {
      const plan = await apiGet<{ assets: number }>(`/api/entity-batch/plan?ids=${entityIds(items).join(',')}`);
      return { title: label, body: body(items.length, plan.assets),
        recovery: t('catalog:rosterActions.trashRecovery'), danger: true };
    },
    run: async (items) => {
      moved = (await send({ operation: 'trash', entity_ids: entityIds(items) })).asset_ids ?? [];
      await refresh();
      return async () => {
        if (moved.length) await send({ operation: 'restore', asset_ids: moved });
        await refresh();
      };
    },
    receipt: () => t('catalog:rosterActions.trashDone', { count: moved.length }),
  };
}

/** 这一种名册在这一档（名册或「已隐藏」）能用的写入键。艺人才有新作订阅；事务所名下是成员拍的片，
 *  不给一键移走。 */
export function rosterActions(kind: RosterKind, hiddenView: boolean): BulkAction<IndexPerson>[] {
  const visibility = hiddenView
    ? entityAction('unhide', 'hide', t('catalog:rosterActions.unhide'),
      (count) => t('catalog:rosterActions.unhideConfirm', { count }), (count) => t('catalog:rosterActions.unhideDone', { count }))
    : entityAction('hide', 'unhide', t('catalog:rosterActions.hide'),
      (count) => t('catalog:rosterActions.hideConfirm', { count }), (count) => t('catalog:rosterActions.hideDone', { count }));
  const feed = kind === 'performers' && !hiddenView ? [
    entityAction('follow', 'unfollow', t('catalog:entityHero.subscribeNewReleases'),
      (count) => t('catalog:rosterActions.followConfirm', { count }),
      (count, skipped) => skipped ? t('catalog:rosterActions.followDonePartly', { count, skipped }) : t('catalog:rosterActions.followDone', { count })),
    entityAction('unfollow', 'follow', t('catalog:entityPage.unsubscribeNewReleases'),
      (count) => t('catalog:rosterActions.unfollowConfirm', { count }), (count) => t('catalog:rosterActions.unfollowDone', { count })),
  ] : [];
  const trash = contentTrashAction<IndexPerson>(t('catalog:rosterActions.trash'), personId,
    (count, assets) => t('catalog:rosterActions.trashConfirm', { count, assets }));
  return [...feed, visibility, ...(kind === 'agencies' ? [] : [trash])];
}
