/* 名册的多选：进了右上角的多选模式才显示勾选与浮条，浮条上先是「全选」，再是写入键。
 *
 * 索引页的名册与资料页的名册视图（事务所旗下艺人、片商旗下厂牌）共用这一份。选择集归页面，
 * 按实体 id 记；多选模式关掉时清空。 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { SelectionDock } from '../components/selection-dock';
import { toastHost } from './tag-operations';
import { rosterActions, type RosterKind } from './roster-actions';
import type { IndexPerson } from './index-data';
import { t } from '../../i18n';

const personId = (item: IndexPerson) => item.entity_id ?? item.id ?? 0;

/** 名册格要的那一份：此刻选了谁、点一格怎么切换。不在多选模式时是 `undefined`，格子照常打开资料页。 */
export interface RosterPicks {
  picked: ReadonlySet<number>;
  toggle(id: number): void;
}

export function useRosterSelection(selectMode: boolean, items: readonly IndexPerson[]) {
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => { if (!selectMode) setPicked(new Set()) }, [selectMode]);
  const picks = useMemo<RosterPicks | undefined>(() => selectMode ? {
    picked,
    toggle: (id) => setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    }),
  } : undefined, [picked, selectMode]);
  const chosen = useMemo(() => items.filter((item) => picked.has(personId(item))), [items, picked]);
  return { picks, chosen, clear: () => setPicked(new Set()), setAll: (on: boolean) => setPicked(new Set(on ? items.map(personId) : [])) };
}

export function RosterDock({ kind, hiddenView, selection, total, visible, exit }: {
  kind: RosterKind; hiddenView: boolean; selection: ReturnType<typeof useRosterSelection>; total: number;
  visible: boolean;
  /** 「退出」键；资料页没有，退出走右上角的多选开关。 */
  exit?(): void;
}) {
  const { chosen, clear, setAll } = selection;
  const all = total > 0 && chosen.length === total;
  const actions = useMemo(() => rosterActions(kind, hiddenView), [kind, hiddenView]);
  return (
    <SelectionDock visible={visible} label={t('catalog:rosterActions.dockLabel')}
      count={t('catalog:rosterActions.selectedCount', { count: chosen.length })}
      actions={actions.map((action) => ({ action, items: chosen, host: toastHost, done: clear }))}
      leading={<Button size="small" variant="secondary" disabled={!total} onClick={() => setAll(!all)}>
        {all ? t('catalog:rosterActions.deselectAll') : t('catalog:rosterActions.selectAll')}</Button>}>
      {exit ? <Button size="small" variant="ghost" onClick={exit}>{t('catalog:rosterActions.exit')}</Button> : null}
    </SelectionDock>
  );
}
