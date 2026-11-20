/* 本地与在线详情共用标签外观与选择器。详情侧栏只读，增删在编辑框里做（`editable`）；
   标签本身的改名、合并在标签管理页。 */
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MenuChevron } from './menu-chevron';
import { spinnerHtml, wireAnchoredMenu } from '@peach/legacy/ui';
import { Button } from '@/components/base/buttons/button';
import { foldName, icon } from '@peach/legacy/core';
import { apiGet } from '../../api';
import { pickerSections, recentTags, type DetailTag, type TagCount } from '../item-detail/item-detail';
import { type ManagedTag, type TagScope } from '../index/tag-operations';
import { composingKey } from './ime';
import { Note } from './note';
import { useOverlayScrollbar } from './overlay-scrollbar';
import { busyProps } from '../settings/use-action';
import { t } from '../../i18n';

const Glyph = ({ name }: { name: string }) => <span className="contents" dangerouslySetInnerHTML={{ __html: icon(name) }} />;
/* 标签多时先露前面一截：在线来源一帖常挂上百个标签，全摊开会把侧栏推成一整屏胶囊。来源分类排在
   前面（作品、角色、作者），收起时留下的正是它们。只多出几个时不折，省得为三两个标签多点一下。 */
const TAGS_SHOWN = 20;
const TAGS_SLACK = 4;
interface DetailTagsProps {
  tags: DetailTag[]; candidates: readonly TagCount[]; scope?: TagScope; id?: string; adding?: boolean;
  /** 编辑框里传 true：每枚带移除键，行尾有「+」。侧栏不传，只能点开标签。 */
  editable?: boolean;
  /** 排在这一行最后的控件（关注详情的「编辑标签／完成」），与「还有 N 个」「+」同一行。 */
  trailing?: ReactNode;
  label(tag: string): string; onOpen?(tag: string): void; onAdd?(tag: string): void; onRemove?(tag: DetailTag): void;
  busyAttrs?(tag: string): { 'aria-busy'?: boolean; 'aria-disabled'?: boolean };
}

export function DetailTags({ tags, candidates, scope = 'local', id, adding, editable = false, trailing, label, onOpen, onAdd, onRemove, busyAttrs }: DetailTagsProps) {
  const [asked, setAsked] = useState(false);
  const inventory = useQuery({ queryKey:['tag-management', scope],
    queryFn:({ signal }) => apiGet<{ items:ManagedTag[] }>(`/api/tag-management${scope === 'online' ? '?scope=online' : ''}`, signal),
    enabled:editable && asked && (scope === 'online' || !candidates.length) });
  const options = inventory.data?.items?.filter(tag => !tag.hidden && !tag.blocked && (scope === 'online' || tag.cat !== 'meta')) || candidates;
  const [open, setOpen] = useState(false);
  /* 刚加上的标签按名字排进去，多半落在收起的那一截里，看着像没加上：收起时它们也露在外面。 */
  const [added, setAdded] = useState<readonly string[]>([]);
  const add = (tag: string) => { setAdded(keys => [...keys, foldName(tag)]); onAdd?.(tag) };
  const long = tags.length > TAGS_SHOWN + TAGS_SLACK;
  const shown = long && !open ? tags.filter((tag, index) => index < TAGS_SHOWN || added.includes(foldName(tag.k))) : tags;
  return <>
    <div data-stage-tags="" data-detail-tags="" data-tags-editable={editable ? '' : undefined} id={id}>
      {shown.map(tag => <span key={tag.k} data-detail-tag="" data-tag-cat={tag.cat}>
        {editable
          ? <span data-tag={tag.k} title={label(tag.k)}>{label(tag.k)}</span>
          : <button type="button" data-tag={tag.k} data-follow-tag={scope === 'online' ? tag.k : undefined}
            title={label(tag.k)} onClick={() => onOpen?.(tag.k)}>{label(tag.k)}</button>}
        {editable ? <button type="button" data-remove-tag={tag.k} title={t('shell:detailTags.hideTag')} aria-label={t('shell:detailTags.removeTagNamed', { tag: label(tag.k) })}
          {...busyAttrs?.(tag.k)} onClick={() => onRemove?.(tag)}><Glyph name="x" /></button> : null}
      </span>)}
      {long ? <Button variant="secondary" size="small" data-tags-more="" aria-expanded={open}
        trailingIcon={MenuChevron} onClick={() => setOpen(!open)}>
        {open ? t('shell:shared.collapse') : t('shell:detailTags.moreCount', { count: tags.length - shown.length })}</Button> : null}
      {editable ? <TagPicker tags={tags} candidates={options} label={label} onAdd={add} adding={adding} scope={scope}
        onOpen={() => setAsked(true)} loading={inventory.isFetching} /> : null}
      {trailing}
    </div>
    {inventory.isError ? <Note tone="error" action={<Button variant="secondary" onClick={() => void inventory.refetch()}>{t('shell:shared.retryNow')}</Button>}>{t('shell:detailTags.optionsLoadFailed')}</Note> : null}
  </>;
}

/* 标签选择器：最近使用 + 全部（或搜索结果），上下键挑、回车加，输入的词没有完全命中就多一格
   「新建」。开合走全站菜单那一对口（`presentMenu`／`dismissMenu`），`hidden` 由它们管。
   选字过程中框里是半截拼音，筛选按 `term` 走、组完字才跟上，不拿「zhon」去筛。 */
function TagPicker({ tags, candidates, label, onAdd, adding, scope, onOpen, loading }: Pick<DetailTagsProps, 'tags' | 'candidates' | 'label' | 'adding' | 'scope'> & { onAdd(tag: string): void; onOpen():void; loading:boolean }) {
  const plus = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const body = useOverlayScrollbar<HTMLDivElement>();
  const search = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(-1);
  const latest = useRef({ adding, query, tags, onOpen });
  latest.current = { adding, query, tags, onOpen };
  const floating = useRef<ReturnType<typeof wireAnchoredMenu> | null>(null);
  const close = useCallback(() => {
    floating.current?.setOpen(false);
    setOpen(false);
  }, []);
  useLayoutEffect(() => {
    const [button, menu] = [plus.current, picker.current];
    if (!button || !menu) return undefined;
    if ('showPopover' in menu) menu.setAttribute('popover', 'manual');
    const control = wireAnchoredMenu(button.parentElement!, button, menu);
    floating.current = control;
    const opened = () => {
      const current = latest.current;
      if (current.adding) { control.setOpen(false); setOpen(false); return }
      const opening = control.isOpen(); setOpen(opening);
      if (!opening) return;
      current.onOpen();
      if (!current.query.trim() || current.tags.some(tag => foldName(tag.k) === foldName(current.query.trim()))) { setQuery(''); setTerm('') }
      setActive(-1);
      requestAnimationFrame(() => search.current?.focus({ preventScroll:true }));
    };
    button.addEventListener('click', opened);
    const observer = new MutationObserver(() => setOpen(control.isOpen()));
    observer.observe(button, { attributes:true, attributeFilter:['aria-expanded'] });
    return () => { observer.disconnect(); button.removeEventListener('click', opened); control.dispose(); floating.current = null };
  }, []);
  useLayoutEffect(() => {
    if (!open || !picker.current || !floating.current?.isOpen()) return;
    picker.current.style.maxHeight = '';
    floating.current.setOpen(true);
  }, [open, term, candidates.length]);
  const sections = open ? pickerSections(term, candidates, recentTags()) : { recent: [], results: [], create: '' };
  const options = [...sections.recent, ...sections.results, ...(sections.create ? [{ k: sections.create, n: -1 }] : [])];
  const pick = (tag: TagCount, selected: boolean) => {
    close();
    if (!selected) onAdd(tag.k);
  };
  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    /* 选字那一下的回车是定字，不是「新建这个标签」——半截拼音会真的建成标签。 */
    if (composingKey(event.nativeEvent)) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); plus.current?.focus(); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!options.length) return;
      const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      setActive(next);
      picker.current?.querySelectorAll('[data-pick]')[next]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = active >= 0 ? options[active] : null;
      if (chosen) pick(chosen, chosen.n !== -1 && tags.some(tag => tag.k === chosen.k));
      else if (query.trim()) { close(); onAdd(query.trim()) }
    }
  };
  let index = -1;
  const button = (tag: TagCount) => {
    index += 1;
    const at = index;
    const selected = tags.some(value => foldName(value.k) === foldName(tag.k));
    const category = tag.cat || tags.find(value => foldName(value.k) === foldName(tag.k))?.cat || 'unknown';
    const color = category === 'unknown' ? 'r34-unknown'
      : scope === 'online' && ['general', 'artist', 'character', 'copyright', 'metadata'].includes(category) ? `r34-${category}` : category;
    return (
      <button key={`${at}:${tag.k}`} type="button" data-pick={tag.k} data-active={at === active ? '' : undefined}
        data-tag-cat={color}
        aria-pressed={selected} onClick={() => pick(tag, selected)}>
        <Glyph name={selected ? 'check' : 'tags'} /><span data-pick-name="">{label(tag.k)}</span>
        <span data-pick-count="">{(tag.n || 0).toLocaleString()}</span>
      </button>
    );
  };
  return (
    <>
      <button ref={plus} type="button" id="tagPlus" data-tag-plus="" title={t('shell:tagPicker.addTag')} aria-label={t('shell:tagPicker.addTag')} aria-expanded={open}
        {...busyProps(!!adding)}><Glyph name="plus" /></button>
      <div ref={picker} id="tagPicker" data-tag-picker="" role="dialog" aria-label={t('shell:tagPicker.addTag')} hidden>
        <label data-tag-search="">
          {loading ? <span className="contents" dangerouslySetInnerHTML={{ __html:spinnerHtml(t('shell:tagPicker.loading')) }} /> : <Glyph name="search" />}
          <input ref={search} id="tagPickSearch" maxLength={80} placeholder={t('shell:tagPicker.searchPlaceholder')} autoComplete="off" value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(-1); if (!composing.current) setTerm(event.target.value) }}
            onCompositionStart={() => { composing.current = true }}
            onCompositionEnd={(event) => { composing.current = false; setTerm(event.currentTarget.value) }} onKeyDown={keydown} />
        </label>
        <div data-tag-scroll-frame=""><div ref={body} id="tagPickBody" data-tag-body="">
          {open && sections.recent.length ? (
            <section data-tag-section=""><h4>{t('shell:tagPicker.recent')}</h4><div data-tag-grid="">{sections.recent.map(button)}</div></section>
          ) : null}
          {open ? (
            <section data-tag-section="">
              <h4>{term.trim() ? t('shell:tagPicker.results') : t('shell:tagPicker.allTags')}</h4>
              <div data-tag-grid="">
                {sections.results.map(button)}
                {sections.create ? (() => {
                  index += 1;
                  const at = index;
                  return (
                    <button key="create" type="button" data-pick={sections.create} data-active={at === active ? '' : undefined}
                      onClick={() => { close(); onAdd(sections.create) }}>
                      <Glyph name="plus" /><span data-pick-name="">{t('shell:tagPicker.createNamed', { tag: sections.create })}</span>
                    </button>
                  );
                })() : null}
              </div>
            </section>
          ) : null}
        </div></div>
      </div>
    </>
  );
}
