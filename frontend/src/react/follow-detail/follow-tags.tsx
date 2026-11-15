/* 在线标签复用本地详情的标签行与选择器。 */
import { useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { apiSend } from '../../api';
import { collectionItems, replaceFollowItem, type FollowGroup } from '../follow-feed/follow-feed';
import { DetailTags } from '../components/detail-tags';
import { Note } from '../components/note';
import { rememberTag } from '../item-detail/item-detail';
import { busyProps, useAction } from '../settings/use-action';
import { queryClient } from '../query';
import { detailTags, tagCategory, type FollowDetailActions, type FollowDetailData, type FollowDetailItem } from './follow-detail';
import { t } from '../../i18n';

export function FollowTags({ item, label, actions }: { item: FollowDetailItem; label(tag: string): string; actions: FollowDetailActions }) {
  const action = useAction();
  const refresh = () => queryClient.invalidateQueries({
    predicate: query => ['follow-feed', 'follow', 'tag-management'].includes(String(query.queryKey[0])),
  });
  const apply = (result: { item: FollowDetailItem; group: FollowGroup }) => {
    replaceFollowItem(result.item);
    queryClient.setQueriesData<FollowDetailData>({ queryKey: ['follow-item'] }, current => {
      if (!current) return current;
      const member = collectionItems(result.group).find(value => value.id === current.item.id);
      return member ? { ...current, item: member as FollowDetailItem, group: result.group } : current;
    });
  };
  const write = (operation: 'add' | 'remove', tag: string) => { void action.run(`${operation}:${tag}`, async signal => {
    const result = await apiSend<{ item: FollowDetailItem; group: FollowGroup }>('/api/follow/tag', { id: item.id, operation, tag }, 'POST', signal);
    apply(result); await refresh();
  }, () => {
    if (operation === 'add') rememberTag(tag);
    const inverse = operation === 'add' ? 'remove' : item.custom_tags?.includes(tag) ? 'add' : 'restore';
    actions.toast(operation === 'add' ? t('follow:followDetail.tagAdded', { tag: label(tag) }) : t('follow:followDetail.tagRemoved', { tag: label(tag) }), {
      undo: async () => {
        const result = await apiSend<{ item: FollowDetailItem; group: FollowGroup }>('/api/follow/tag', { id: item.id, operation: inverse, tag });
        apply(result); await refresh();
      },
    });
  }) };
  /* 平时只读，点得开；行尾一枚编辑键切到增删，与作品详情「编辑资料」里的标签同一套控件。 */
  const [editing, setEditing] = useState(false);
  return <section aria-label={t('follow:followDetail.contentTags')} data-follow-tag-editor="" data-follow-detail-tags="">
    <DetailTags tags={detailTags(item, label).map(k => ({ k, cat: tagCategory(item, k) }))} scope="online" adding={!!action.busy}
      candidates={[]} editable={editing}
      label={label} onOpen={actions.openTag} onAdd={tag => write('add', tag)} onRemove={tag => write('remove', tag.k)}
      busyAttrs={() => busyProps(!!action.busy)}
      trailing={<Button variant="secondary" size="small" data-follow-tags-edit="" aria-pressed={editing} onClick={() => setEditing(!editing)}>
        {editing ? t('follow:followDetail.tagsDone') : t('follow:followDetail.editTags')}</Button>} />
    {action.error ? <Note tone="error">{action.error}</Note> : null}
  </section>;
}
