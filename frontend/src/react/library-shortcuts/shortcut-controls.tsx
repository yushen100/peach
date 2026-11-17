import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { VisuallyHidden } from 'react-aria-components';
import { attachOverlayScrollbar, revealTexts, spinnerHtml, wireHorizontalScroller } from '@peach/legacy/ui';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { ObjectOrderDialog } from '../components/object-order-dialog';
import { errorMessage } from '../../api';
import { entityDisplayName } from '../../core/entity-names';
import { useEntityNames } from '../use-entity-names';
import { ModalFrame } from '../components/modal-frame';
import { Note } from '../components/note';
import { FilterIconButton } from '../components/filter-glass';
import { EmptyState } from '../components/empty-state';
import { spriteGlyph } from '../components/sprite-glyph';
import { SettingsDialogClose } from '../components/settings-dialog-close';
import { useViewGlide } from '../components/use-view-glide';
import { NavigationDropLine, NavigationOrderMenu, useNavigationOrder } from '../components/navigation-order';
import { useSidebarReorder } from '../sidebar/use-sidebar-reorder';
import { busyProps } from '../settings/busy-props';
import { favoriteHref, isFavorite, useShortcuts, useShortcutWrite, type Favorite } from './library-shortcuts';
import { t } from '../../i18n';
import { codedText } from '../../core/server-text';
import './shortcuts.css';

const Star = spriteGlyph('star');
const Bookmark = spriteGlyph('bookmark-plus');
const ChevronRight = spriteGlyph('chevron-right');
const LABELS: Record<string, string> = { performer: t('settings:favoritesPanel.performers'), creator: t('settings:favoritesPanel.creators'), studio: t('settings:favoritesPanel.studios'), series: t('settings:favoritesPanel.series'), agency: t('settings:favoritesPanel.agencies'), tag: t('settings:favoritesPanel.tags') };
/** 行里名字下方的类型说明，单数。 */
const KIND_LABELS: Record<string, string> = { performer: t('settings:favoriteKinds.performer'), creator: t('settings:favoriteKinds.creator'), studio: t('settings:favoriteKinds.studio'), series: t('settings:favoriteKinds.series'), agency: t('settings:favoriteKinds.agency'), tag: t('settings:favoriteKinds.tag') };
const GLYPHS = { all: spriteGlyph('star'), performer: spriteGlyph('user-round'), creator: spriteGlyph('user-round'), studio: spriteGlyph('clapperboard'), series: spriteGlyph('film'), agency: spriteGlyph('briefcase'), tag: spriteGlyph('tags'), filters: spriteGlyph('list-filter') };
const SCOPES = [['all', t('settings:shared.all')], ...Object.entries(LABELS), ['filters', t('settings:favoritesPanel.savedFilters')]];

/** 实体行内的图标动作，共用收藏按钮的尺寸、悬停与焦点反馈。 */
export function EntityActionButton({ label, children, ...props }: ComponentProps<'button'> & { label: string }) {
  return <button type="button" {...props} data-entity-action="" aria-label={label} title={props.title || label}>{children}</button>;
}

export function FavoriteButton({ item }: { item: Favorite }) {
  return <FavoriteChoice key={`${item.scope || 'local'}:${item.kind}:${item.tag_id || item.entity_id}:${item.name}`} item={item} />;
}

function FavoriteChoice({ item }: { item: Favorite }) {
  useEntityNames();
  const query = useShortcuts(false);
  const initial = useRef(query.data);
  const write = useShortcutWrite();
  const selected = query.data && query.data !== initial.current
    ? isFavorite(query.data.favorites || [], item)
    : item.favorite ?? (query.data ? isFavorite(query.data.favorites || [], item) : false);
  return <span className="inline-flex min-w-0 flex-col gap-1">
    <EntityActionButton data-favorite="" aria-pressed={!!selected}
      label={t(selected ? 'settings:favoritesPanel.unfavoriteLabel' : 'settings:favoritesPanel.favoriteLabel', { name: entityDisplayName(item.kind, item.name, item.entity_id) })}
      {...busyProps(write.isPending)} onClick={() => {
        if (!write.isPending) write.mutate({ action: 'favorite', ...item, on: !selected });
      }}>{write.isPending ? <span aria-hidden dangerouslySetInnerHTML={{ __html: spinnerHtml('') }} /> : <Star />}</EntityActionButton>
    {write.isError ? <Note tone="error">{errorMessage(write.error)}</Note> : null}
    {query.isError ? <Button variant="secondary" size="small" aria-label={t('settings:favoritesPanel.retryLoadLabel')} onClick={() => void query.refetch()}>{t('settings:shared.retryNow')}</Button> : null}
  </span>;
}

/** 实体收藏、作品清单与保存筛选的管理入口。 */
export function LibraryShortcuts({ currentHref, kind }: { currentHref?: () => string; kind?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <span data-shortcuts-entry=""><FilterIconButton data-shortcuts-trigger="" label={t('settings:favoritesPanel.title')} icon={Star}
      aria-haspopup="dialog" aria-expanded={open} onPress={() => setOpen(true)} /></span>
    <ModalFrame isOpen={open} onOpenChange={setOpen} width="collections" label={t('settings:favoritesPanel.title')}>
      {open ? <ShortcutContents currentHref={currentHref} kind={kind} close={() => setOpen(false)} /> : null}
    </ModalFrame>
  </>;
}

function ShortcutContents({ currentHref, kind, close }: { currentHref?: () => string; kind?: string; close(): void }) {
  useEntityNames();
  const query = useShortcuts();
  const write = useShortcutWrite();
  const [name, setName] = useState('');
  const [scope, setScope] = useState(kind || 'all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [sorting, setSorting] = useState(false);
  const id = useId();
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const changed = () => setNarrow(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const navigation = useRef<HTMLDivElement>(null);
  const order = useNavigationOrder('favorites');
  const scopes = order.keys.flatMap(key => SCOPES.filter(([value]) => value === key));
  const head = useRef<HTMLDivElement>(null);
  const previousScope = useRef(scope);
  const pane = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const scroll = useRef<(() => void) | null>(null);
  const glide = useViewGlide(pane, navigation, '[role="tab"][aria-selected="true"]', `${scope}:${order.keys.join(',')}`, { axis: narrow ? 'x' : 'y' });
  const reorder = useSidebarReorder(navigation, order.keys, order.commit, () => requestAnimationFrame(glide.sync), narrow ? 'x' : 'y', 'tab', ['all']);
  useLayoutEffect(() => { if (content.current) scroll.current = attachOverlayScrollbar(content.current) || null }, []);
  useLayoutEffect(() => {
    const scroller = wireHorizontalScroller(navigation.current);
    return () => scroller?.destroy();
  }, []);
  useLayoutEffect(() => { if (content.current) content.current.scrollTop = 0 }, [scope]);
  useLayoutEffect(() => {
    if (previousScope.current !== scope) revealTexts(head.current, 'h2');
    previousScope.current = scope;
  }, [scope]);
  useLayoutEffect(() => { scroll.current?.() });
  const label = SCOPES.find(([value]) => value === scope)?.[1] || t('settings:shared.all');
  const selectWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey) return;
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % tabs.length
      : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index + tabs.length - 1) % tabs.length : -1;
    if (next < 0) return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!currentHref || !name.trim() || write.isPending) return;
    write.mutate({ action: 'save_filter', name: name.trim(), href: currentHref() }, {
      onSuccess: () => { setName(''); setMessage(t('settings:favoritesPanel.filterSaved')) },
    });
  };
  const data = query.data;
  const searchName = search.trim().toLocaleLowerCase();
  const rows = (data?.favorites || []).filter((row) => (scope === 'all' || row.kind === scope)
    && (row.name.toLocaleLowerCase().includes(searchName)
      || entityDisplayName(row.kind, row.name, row.entity_id).toLocaleLowerCase().includes(searchName)));
  return <div data-shortcuts-panel="">
    <div ref={head} data-shortcuts-head="">
      <h2 className="text-title-2-semibold text-text-primary">{label}</h2>
      <SettingsDialogClose label={t('settings:favoritesPanel.close')} onPress={close} />
    </div>
      <aside data-shortcuts-sidebar="" data-settings-nav="" data-glass-pane={narrow ? undefined : ''}>
      <div ref={navigation} data-shortcuts-categories="" data-glass-pane={narrow ? '' : undefined} role="tablist" aria-label={t('settings:favoritesPanel.typesLabel')}
        data-navigation-order="favorites" data-navigation-axis={narrow ? 'x' : 'y'} data-reordering={reorder.picked ? '' : undefined}
        onClickCapture={reorder.clickCapture} onKeyDown={selectWithKeys} onPointerLeave={glide.leave}>
        <span ref={pane} data-view-glide="" data-shortcuts-glide="" aria-hidden="true" hidden />
        <p data-shortcuts-caption="" role="presentation">{t('settings:favoritesPanel.title')}</p>
        {scopes.map(([value, label]) => {
          const Glyph = GLYPHS[value as keyof typeof GLYPHS] || Star;
          const count = value === 'filters' ? data?.filters.length || 0 : (data?.favorites || []).filter(row => value === 'all' || row.kind === value).length;
          return <button key={value} type="button" role="tab" id={`${id}-${value}`} aria-controls={`${id}-content`}
            data-tab={value} data-dragging={reorder.picked?.key === value ? '' : undefined}
            style={{ '--navigation-picked-left': `${reorder.picked?.bounds.left || 0}px`,
              '--navigation-picked-top': `${reorder.picked?.bounds.top || 0}px`,
              '--navigation-picked-width': `${reorder.picked?.bounds.width || 0}px`,
              '--navigation-picked-offset': `${reorder.picked?.offset || 0}px`,
              '--sidebar-nudge': `${reorder.nudge(value).distance}px`, '--sidebar-delay': `${reorder.nudge(value).delay}ms` } as CSSProperties}
            {...reorder.bindings(value)}
            aria-keyshortcuts={narrow ? 'Alt+ArrowLeft Alt+ArrowRight' : 'Alt+ArrowUp Alt+ArrowDown'}
            aria-label={label} aria-selected={scope === value} tabIndex={scope === value ? 0 : -1} onPointerEnter={glide.hover} onClick={() => setScope(value)}>
            <Glyph aria-hidden className="size-(--icon-inline)" /><span>{label}</span><span data-shortcuts-count="">{count}</span>
          </button>;
        })}
        <NavigationDropLine reorder={reorder} />
      </div>
      <NavigationOrderMenu order={order} />
      <VisuallyHidden role="status" aria-live="polite">{reorder.announcement}</VisuallyHidden>
      <nav data-shortcuts-footer="" aria-label={t('settings:favoritesPanel.videoListsLabel')}>
        <a href="/flagged" onClick={close}><Star aria-hidden />{t('settings:favoritesPanel.flagged')}<ChevronRight aria-hidden /></a>
        <a href="/watch-later" onClick={close}><Bookmark aria-hidden />{t('settings:favoritesPanel.watchLater')}<ChevronRight aria-hidden /></a>
      </nav>
      </aside>
      <div ref={content} data-shortcuts-content="" role="tabpanel" id={`${id}-content`} aria-labelledby={`${id}-${scope}`} tabIndex={0} className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain">
    {query.isPending ? <div aria-busy="true" data-skeleton="" className="relative h-12 rounded-lg skeleton-sheen" /> : null}
    {query.isError ? <Note tone="error" action={<Button variant="secondary" onClick={() => void query.refetch()}>{t('settings:shared.retryNow')}</Button>}>{errorMessage(query.error)}</Note> : null}
    {write.isError ? <Note tone="error">{errorMessage(write.error)}</Note> : null}
    {data ? scope !== 'filters' ? <>
      <Input aria-label={t('settings:favoritesPanel.search')} placeholder={t('settings:favoritesPanel.search')} leadingIcon={spriteGlyph('search')} value={search} onChange={setSearch} />
      {!rows.length ? <EmptyState size="compact" icon={Star} title={search ? t('settings:favoritesPanel.noMatches') : (data.favorites.length ? t('settings:favoritesPanel.emptyType') : t('settings:favoritesPanel.empty'))}
        actions={search ? <Button size="small" onClick={() => setSearch('')}>{t('settings:favoritesPanel.clearSearch')}</Button>
          : data.favorites.length ? <Button size="small" onClick={() => setScope('all')}>{t('settings:favoritesPanel.viewAll')}</Button>
          : <ButtonLink size="small" href="/" onClick={close}>{t('settings:favoritesPanel.browseCollection')}</ButtonLink>}>
        {search ? t('settings:favoritesPanel.tryOtherName') : t('settings:favoritesPanel.emptyHelp')}
      </EmptyState> : null}
      <div data-shortcuts-list="">{rows.map((row) => <div key={row.key} data-shortcuts-row="" className="flex min-w-0 items-center justify-between gap-3">
        <a href={favoriteHref(row)} aria-label={entityDisplayName(row.kind, row.name, row.entity_id)} onClick={close} className="flex min-w-0 flex-1 items-center gap-3 text-body-regular text-text-primary">
          <FavoriteAvatar key={row.image_url} item={row} />
          <span className="flex min-w-0 flex-col gap-1"><span className="truncate">{entityDisplayName(row.kind, row.name, row.entity_id)}</span>
            <span className="text-caption-1-regular text-text-secondary">{row.scope === 'online' ? t('settings:favoritesPanel.onlineTag') : KIND_LABELS[row.kind]}</span></span>
        </a>
        <Button variant="secondary" size="small" aria-label={t('settings:favoritesPanel.unfavoriteLabel', { name: entityDisplayName(row.kind, row.name, row.entity_id) })} {...busyProps(write.isPending)}
          onClick={() => { if (!write.isPending) write.mutate({ action: 'favorite', ...row, on: false }) }}>{t('settings:favoritesPanel.unfavorite')}</Button>
      </div>)}</div>
    </> : <>
      {data.filters.length > 1 ? <Button variant="secondary" size="small" onClick={() => setSorting(true)}>{t('settings:favoritesPanel.reorderFilters')}</Button> : null}
      {sorting ? <ObjectOrderDialog title={t('settings:favoritesPanel.reorderFilters')} items={data.filters} close={() => setSorting(false)}
        save={async ids => { await write.mutateAsync({ action: 'reorder_filters', ids }); setMessage(t('settings:favoritesPanel.filterOrderSaved')) }} /> : null}
      {!data.filters.length ? <EmptyState size="compact" icon={spriteGlyph('list-filter')} title={t('settings:favoritesPanel.noSavedFilters')}
        actions={<ButtonLink size="small" href="/" onClick={close}>{t('settings:favoritesPanel.browseCollection')}</ButtonLink>}>{t('settings:favoritesPanel.noSavedFiltersHelp')}</EmptyState> : null}
      {data.filters.map((row) => <div key={row.id} className="flex min-w-0 items-center justify-between gap-2">
        <a href={row.href} onClick={close} className="min-w-0 flex-1 break-all text-body-regular text-text-primary underline">{row.name}</a>
        <Button variant="secondary" size="small" aria-label={t('settings:favoritesPanel.deleteFilterLabel', { name: row.name })} {...busyProps(write.isPending)}
          onClick={() => { if (!write.isPending) write.mutate({ action: 'delete_filter', id: row.id }) }}>{t('settings:shared.delete')}</Button>
      </div>)}
      {currentHref ? <form onSubmit={submit} className="flex flex-col gap-3" aria-label={t('settings:favoritesPanel.saveCurrentFilter')}>
        <Input label={t('settings:favoritesPanel.filterName')} value={name} onChange={setName} maxLength={80} />
        <Button type="submit" disabled={!name.trim()} {...busyProps(write.isPending)}>{t('settings:favoritesPanel.saveCurrentFilter')}</Button>
        {message ? <span role="status" className="text-body-2-regular text-text-secondary">{message}</span> : null}
      </form> : null}
    </> : null}
      </div>
  </div>;
}

function FavoriteAvatar({ item }: { item: Favorite }) {
  const Glyph = GLYPHS[item.kind as keyof typeof GLYPHS] || Star;
  return <span data-shortcuts-avatar="" title={codedText(item, 'image_label') || item.name}>
    {item.image_url ? <img src={item.image_url} alt="" loading="lazy" decoding="async"
      data-drop="self" data-fallbacks={item.image_fallbacks?.join('|') || undefined} /> : null}
    <Glyph aria-hidden className="size-5" />
  </span>;
}
