/* 在线标签的多选浮条：隐藏标签与屏蔽内容，和标签管理里的同一对写入键（`tag-operations.tsx`）。
 *
 * 浏览词表只列没隐藏、没屏蔽的标签，所以这里只有「隐藏」「屏蔽内容」两个方向；恢复在标签管理的
 * 「已隐藏」「已屏蔽内容」里做，回执上也带撤销。 */
import { Button } from '@/components/base/buttons/button';
import { SelectionDock } from '../components/selection-dock';
import { tagOperation, toastHost, type TagId } from './tag-operations';
import type { IndexTag } from './index-data';
import { t } from '../../i18n';

export function OnlineTagDock({ tags, pageTags, visible, onPick, exit }: {
  tags: readonly IndexTag[]; pageTags: readonly IndexTag[]; visible: boolean;
  onPick(keys: string[]): void; exit(): void;
}) {
  const ids: TagId[] = tags.map((tag) => tag.id || tag.k);
  const all = pageTags.length > 0 && tags.length === pageTags.length;
  /* 每次画都新建：`tagOperation` 把预览到的计划记在闭包里，换了所选就得换一份。 */
  const actions = [
    tagOperation({ operation: 'hide', scope: 'online' }, t('catalog:tagManager.hide')),
    tagOperation({ operation: 'block', scope: 'online' }, t('catalog:tagManager.blockContent')),
  ];
  return (
    <SelectionDock visible={visible} label={t('catalog:tagFilters.selectionActions')}
      count={t('catalog:tagFilters.selectedCount', { count: tags.length })}
      actions={actions.map((action) => ({ action, items: ids, host: toastHost, done: () => onPick([]) }))}
      leading={<Button size="small" variant="secondary" disabled={!pageTags.length}
        onClick={() => onPick(all ? [] : pageTags.map((tag) => tag.k))}>
        {all ? t('catalog:rosterActions.deselectAll') : t('catalog:rosterActions.selectAll')}</Button>}>
      <Button size="small" variant="ghost" onClick={exit}>{t('catalog:rosterActions.exit')}</Button>
    </SelectionDock>
  );
}
