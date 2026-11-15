/* 标签管理：预览影响范围，确认后提交；来源证据与隐藏决定由服务端保存。 */
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/base/buttons/button';
import { apiGet } from '../../api';
import { tagSkeletonHtml, TAG_PAGE_SIZES } from '../../tag-skeleton';
import { DataTableFooter } from '../components/table-controls';
import { IndexSearch } from './index-search';
import { useTagPageBounds, useTagPagination } from './tag-pagination';
import { GlassPill } from '../components/filter-glass';
import { Note } from '../components/note';
import { enterPageSelection, exitPageSelection, usePageSelection } from '../components/page-selection';
import { SelectionDock } from '../components/selection-dock';
import { useAction } from '../settings/use-action';
import { ONLINE_TAG_CATEGORIES, TAG_CATEGORIES, tagGroups, type TagView } from './index-data';
import { TagAlphabet, TagCloud, TagFilters } from './index-tags';
import { TagEditor, useTagStatusCounts, confirmTagOperation, managedTagId, previewTagOperation, toastHost, tagOperation, type Command, type EditorOperation, type ManagedTag, type TagId, type TagScope } from './tag-operations';
import { contentTrashAction } from './roster-actions';
import { t } from '../../i18n';

export type { ManagedTag } from './tag-operations';
interface TagInventory { items: ManagedTag[]; duplicate_groups: number[][]; total: number; categories: Record<string, number> }

export function TagManager({ search, category = 'all', view = 'cloud', onCategory, onView, onJump, scope = 'local', state = 'active' }:
  { search?: string; category?: string; view?: TagView; scope?: TagScope; onCategory?(category: string): void; onView?(view: TagView): void; onJump?(at: number): void;
    /** 从标签页平时那排状态药丸点进来时，直接落在「已隐藏」或「已屏蔽内容」。 */
    state?: 'active' | 'hidden' | 'blocked' }) {
  const online = scope === 'online';
  const root = useRef<HTMLElement>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [localCategory, setLocalCategory] = useState(category);
  const [localView, setLocalView] = useState(view);
  const activeCategory = onCategory ? category : localCategory;
  const activeView = onView ? view : localView;
  const query = search ?? localSearch;
  const [hidden, setHidden] = useState(state === 'hidden');
  const [blocked, setBlocked] = useState(state === 'blocked');
  const counts = useTagStatusCounts(scope);
  const filter = JSON.stringify([scope, query, activeCategory, activeView, hidden, blocked]);
  const { pagination, onChange: changePage } = useTagPagination(filter);
  const params = new URLSearchParams({ limit:String(pagination.pageSize), offset:String(pagination.pageIndex * pagination.pageSize),
    q:query, category:activeCategory, view:activeView, state:blocked ? 'blocked' : hidden ? 'hidden' : 'active', scope });
  const inventory = useQuery({ queryKey:['tag-management', scope, 'page', params.toString()],
    queryFn:({ signal }) => apiGet<TagInventory>(`/api/tag-management?${params}`, signal) });
  useTagPageBounds(inventory.data?.total, pagination, changePage);
  const [selection, setPicked] = useState<ReadonlyMap<string, ManagedTag>>(new Map());
  useEffect(() => { setPicked(new Map()) }, [filter]);
  /* 管理模式的勾选接右上角多选开关：勾了就进入多选，点开关退出时清空。 */
  usePageSelection(() => setPicked(new Map()), { topbar: true });
  useEffect(() => { if (selection.size) enterPageSelection() }, [selection]);
  const picked = new Set(selection.keys());
  const [editing, setEditing] = useState<EditorOperation | null>(null);
  const action = useAction();
  const rows = inventory.data?.items || [];
  const visible = rows;
  const categories = (online ? ONLINE_TAG_CATEGORIES : TAG_CATEGORIES).filter(([key]) => key === 'all' || key === activeCategory || inventory.isPending || Number(inventory.data?.categories[key]) > 0);
  const tags = visible.map(row => ({ ...row, label: row.k }));
  const groups = activeView === 'alphabet' ? tagGroups(tags, key => key) : [];
  const selected = [...selection.values()];
  const run = (command: Command) => { void action.run(command.operation, async signal => {
    const scoped = online ? { ...command, scope } : command;
    const plan = await previewTagOperation(scoped, signal);
    return confirmTagOperation(scoped, plan, signal);
  }, changed => { if (changed) setPicked(new Map()) }) };
  const ids = selected.map(managedTagId);
  const actions = { online, favorites: online, picked,
    edit: (key: string) => { const row = rows.find(row => row.k === key); if (row) { setPicked(new Map([[key, row]])); setEditing('rename') } },
    press: (key: string) => setPicked(current => {
      const next = new Map(current); const row = rows.find(row => row.k === key); if (!next.delete(key) && row) next.set(key, row); return next;
    }) };

  return <section ref={root} aria-label={t('catalog:tagManager.label')} data-tag-manager="" className="flex min-w-0 flex-col">
    {search === undefined ? <div className="mb-4 flex"><IndexSearch label={t('catalog:tagManager.filterTags')} value={localSearch} onQuery={setLocalSearch} /></div> : null}
    <TagFilters categories={categories} category={activeCategory} online={online} readout={inventory.data ? t('catalog:peopleIndex.tagCount', { count: inventory.data.total }) : inventory.isError ? '' : undefined}
      letters={groups.map(([letter]) => letter)} view={activeView} onCategory={next => { setLocalCategory(next); onCategory?.(next) }}
      onView={next => { setLocalView(next); onView?.(next) }} onJump={at => onJump ? onJump(at) : root.current?.querySelector(`[data-alpha-group="${at}"]`)?.scrollIntoView({ block:'start', behavior:'smooth' })} status={{ hidden, blocked, ...counts,
        onChange: value => { setHidden(value); setBlocked(false) },
        ...(online ? { onBlocked: () => { setBlocked(true); setHidden(false) } } : {}) }}
      actions={<>
        {/* 「添加屏蔽标签」在线范围三档都在：还没抓到过的标签不在任何一档里，得有个地方直接填名字。 */}
        {online ? <GlassPill onPress={() => setEditing('block')}>{t('catalog:tagManager.blockByName')}</GlassPill> : null}
        {inventory.data?.duplicate_groups.length ? <GlassPill busy={action.busy === 'repair'} onPress={() => run({ operation: 'repair', ids: [] })}>{t('catalog:tagManager.mergeDuplicates')}</GlassPill> : null}
        {/* 标签还没到时也摆着（按不动），取到以后这一排不再长出一颗键把旁边的挤开。 */}
        {inventory.isPending || visible.length ? <GlassPill busy={!visible.length} onPress={() => setPicked(current => new Map([...current, ...visible.map(row => [row.k, row] as const)]))}>{t('catalog:tagManager.selectPage')}</GlassPill> : null}
        {picked.size ? <GlassPill onPress={exitPageSelection}>{t('catalog:tagManager.clearSelection')}</GlassPill> : null}
      </>} />
    {inventory.isPending ? <div dangerouslySetInnerHTML={{ __html:tagSkeletonHtml({ mode:activeView, pageSize:pagination.pageSize }) }} />
      : inventory.isError ? <Note tone="error" action={<Button variant="secondary" onClick={() => void inventory.refetch()}>{t('catalog:shared.retryNow')}</Button>}>{t('catalog:tagManager.loadFailed')}</Note>
        : visible.length ? (activeView === 'alphabet' ? <TagAlphabet groups={groups} actions={actions} /> : <TagCloud tags={tags} actions={actions} />)
          : <Note tone="neutral">{t('catalog:tagManager.noMatches')}</Note>}
    {inventory.data ? <div className="mt-5"><DataTableFooter label={t('catalog:tagManager.label')} total={inventory.data.total} pagination={pagination}
      onChange={changePage} unit={t('catalog:peopleIndex.footerUnit')} pageUnit={t('catalog:peopleIndex.footerPageUnit')} pageSizes={TAG_PAGE_SIZES} /></div> : null}
    {action.error ? <Note tone="error">{action.error}</Note> : null}
    <SelectionDock label={t('catalog:tagManager.actions')} count={t('catalog:tagFilters.selectedCount', { count: picked.size })} visible={picked.size > 0}
      actions={[
        { action: tagOperation({ operation: hidden ? 'restore' : 'hide', ...(online ? { scope } : {}) },
          hidden ? t('catalog:tagManager.unhide') : t('catalog:tagManager.hide')), items: ids, host: toastHost, done: () => setPicked(new Map()) },
        ...(online ? [{ action: tagOperation({ operation: blocked ? 'unblock' : 'block', scope },
          blocked ? t('catalog:tagManager.unblockContent') : t('catalog:tagManager.blockContent')), items: ids, host: toastHost, done: () => setPicked(new Map()) }] : []),
        /* 本地标签的两种删除分开：删标签本身（关联去掉、作品留着，撤不回），删标签下的作品（进回收站，能撤销）。 */
        ...(online ? [] : [
          { action: { ...tagOperation({ operation: 'delete' }), danger: true }, items: ids, host: toastHost, done: () => setPicked(new Map()) },
          { action: contentTrashAction<TagId>(t('catalog:tagManager.deleteContent'), Number,
            (count, assets) => t('catalog:rosterActions.tagTrashConfirm', { count, assets })), items: ids, host: toastHost, done: () => setPicked(new Map()) },
        ]),
      ]}>
      <Button variant="secondary" size="small" disabled={selected.length !== 1} onClick={() => setEditing('rename')}>{t('catalog:shared.rename')}</Button>
      <Button variant="secondary" size="small" disabled={selected.length < 2 || (online && new Set(selected.map(row => row.cat)).size > 1)} onClick={() => setEditing('merge')}>{t('catalog:shared.merge')}</Button>
    </SelectionDock>
    {editing ? <TagEditor key={editing} operation={editing} selected={selected} scope={scope}
      close={() => setEditing(null)} done={() => setPicked(new Map())} /> : null}
  </section>;
}
