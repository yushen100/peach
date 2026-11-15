/* 详情标题旁的「编辑资料」：一个弹层改完这部片的字段、归属和标签，点保存一次写进账本（ADR-0165）。
 *
 * 弹层沿用 `formModal`：遮罩、焦点、Escape 和失败时原因留在原位都由它给，这里只画字段。
 * 没改动时点空处就关；改了一半点空处不关，丢掉的是用户刚敲的一整份。
 * 草稿只在本地：保存时与打开那一刻比出差异交给 `/api/item-edit`，带上打开时读到的版本，
 * 这期间后台改过这一部就整份拒收。 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { UNSAFE_PortalProvider } from 'react-aria';
import { formModal } from '@peach/legacy/ui';
import { foldName, icon } from '@peach/legacy/core';
import { coverUrl, performerLabel } from '@peach/card-art';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '../components/select';
import { DetailTags } from '../components/detail-tags';
import { overlayHost } from '../components/overlay-host';
import { ScrapeSourceLabel } from '../components/source-label';
import { CollapseRegion } from '../components/collapse-region';
import { useHorizontalScroller } from '../components/use-horizontal-scroller';
import { composingKey } from '../components/ime';
import { apiGet, apiSend, apiSendBytes } from '../../api';
import { queryClient } from '../query';
import { detailTags, itemKey, type DetailEntityRef, type DetailItem, type DetailTag, type ItemDetailHelpers } from './item-detail';
import { t } from '../../i18n';

const Glyph = ({ name }: { name: string }) => <span className="contents" dangerouslySetInnerHTML={{ __html: icon(name) }} />;

export const ITEM_EDIT_URL = '/api/item-edit';
export const ITEM_COVER_URL = '/api/item-cover';
const TEXT_FIELDS = ['title', 'original_title', 'code', 'release_date'] as const;
type TextField = typeof TEXT_FIELDS[number];
const REGIONS = ['', 'jp', 'kr', 'cn', 'west', 'other'] as const;

export interface Choice { id: number | null; name: string; user_created?: boolean }
interface FieldSource { owner: string; source: string; source_code?: string; site?: string }
/** 封面这一项：不动、换成一张图（上传、播放器画面或样张）、换回刮削封面。 */
export type CoverDraft = { kind: 'keep' } | { kind: 'image'; blob: Blob; url: string; origin: 'upload' | 'frame' | 'sample' } | { kind: 'restore' };
interface Draft {
  text: Record<TextField, string>;
  region: string;
  studio: Choice | null;
  series: Choice | null;
  performers: Choice[];
  tags: DetailTag[];
  restore: string[];
  cover: CoverDraft;
}

const choice = (ref: DetailEntityRef | undefined): Choice | null =>
  ref && ref.name ? { id: ref.id ?? null, name: ref.name, ...(ref.user_created ? { user_created: true } : {}) } : null;

/** 打开那一刻的取值。番号、标题等读的是账本原列，不是详情上拼过版本标记的显示标题。 */
export function initialDraft(item: DetailItem, helpers: Pick<ItemDetailHelpers, 'tagLabel' | 'isDurationTag'>): Draft {
  const refs = item.entity_refs || {};
  const text = (key: string) => String(item[key] ?? '');
  const performers = refs.performer?.length
    ? refs.performer.map(ref => choice(ref)!).filter(Boolean)
    : (item.performers || []).map(name => ({ id: null, name }));
  return {
    text: { title: text('catalog_title'), original_title: text('original_title'), code: text('code'), release_date: text('release_date') },
    region: String(item.region || ''),
    studio: choice(refs.studio?.[0]) || (item.studio ? { id: null, name: String(item.studio) } : null),
    series: choice(refs.series?.[0]),
    performers,
    tags: detailTags(item, helpers),
    restore: [],
    cover: { kind: 'keep' },
  };
}

const sameChoice = (a: Choice | null, b: Choice | null) =>
  (!a && !b) || (!!a && !!b && (a.id != null && b.id != null ? a.id === b.id : foldName(a.name) === foldName(b.name)));
const ref = (value: Choice) => (value.id != null ? { id: value.id, name: value.name } : { name: value.name });

/** 草稿与打开时比出要交的那一份；什么都没改返回 null。 */
export function editBody(item: DetailItem, before: Draft, after: Draft): Record<string, unknown> | null {
  const fields: Record<string, unknown> = {};
  for (const key of TEXT_FIELDS) if (after.text[key].trim() !== before.text[key].trim()) fields[key] = after.text[key];
  if (after.region !== before.region) fields.region = after.region;
  if (!sameChoice(after.studio, before.studio)) fields.studio = after.studio ? ref(after.studio) : null;
  if (!sameChoice(after.series, before.series)) fields.series = after.series ? ref(after.series) : null;
  const restore = after.restore.filter(key => !(key in fields));
  const kept = (list: Choice[], value: Choice) => list.some(other => sameChoice(other, value));
  const performers = {
    add: after.performers.filter(value => !kept(before.performers, value)).map(ref),
    remove: before.performers.filter(value => !kept(after.performers, value)).map(ref),
  };
  const has = (list: DetailTag[], tag: DetailTag) => list.some(other => foldName(other.k) === foldName(tag.k));
  const tags = {
    add: after.tags.filter(tag => !has(before.tags, tag)).map(tag => tag.k),
    remove: before.tags.filter(tag => !has(after.tags, tag)).map(tag => tag.k),
  };
  const changed = Object.keys(fields).length || restore.length || performers.add.length || performers.remove.length
    || tags.add.length || tags.remove.length;
  return changed ? {
    id: item.id, expected_revision: item.mutation_revision, fields, restore, performers, tags,
  } : null;
}

/** 字段旁那句来源：谁写的这一个值。改过的字段多一个「恢复」。 */
function sourceText(source: FieldSource | undefined): string {
  if (!source?.owner) return '';
  const name = source.source_code ? t(`server:${source.source_code}`) : source.source;
  if (source.owner === 'user') return t('catalog:itemEdit.sourceUser');
  if (source.owner === 'scan') return t('catalog:itemEdit.sourceScan');
  if (source.owner === 'review') return t('catalog:itemEdit.sourceReview', { source: name });
  if (source.owner === 'script') return t('catalog:itemEdit.sourceScript', { source: name });
  return name;
}

/** 控件下面那行来源：采集来的带站标与站名，其余（你改过、文件名）只有字。 */
function sourceNote(source: FieldSource | undefined): ReactNode {
  const text = sourceText(source);
  if (!text) return null;
  return source?.site && source.owner !== 'user' ? <ScrapeSourceLabel source={source.site} label={text} /> : text;
}

export function ItemEditButton({ item, helpers, onSaved }: {
  item: DetailItem; helpers: ItemDetailHelpers; onSaved(item: DetailItem): void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" data-item-edit-open="" title={t('catalog:itemEdit.open')} aria-label={t('catalog:itemEdit.open')}
      aria-haspopup="dialog" onClick={() => setOpen(true)}><Glyph name="pencil" /></button>
    {open ? <ItemEditDialog item={item} helpers={helpers} close={() => setOpen(false)} onSaved={onSaved} /> : null}
  </>;
}

type FormDialog = ReturnType<typeof formModal>;

function ItemEditDialog({ item, helpers, close, onSaved }: {
  item: DetailItem; helpers: ItemDetailHelpers; close(): void; onSaved(item: DetailItem): void;
}) {
  /* 打开那一刻的这一部与草稿起点只取一次：开着的时候详情在后台重取（补全进度、播放上报），
     不能因此重建弹层、丢掉正在填的那一份。 */
  const given = useRef({ item, close, onSaved, before: initialDraft(item, helpers) });
  const before = given.current.before;
  const draft = useRef(before);
  const [view, setView] = useState<{ host: Element; dialog: FormDialog } | null>(null);
  useEffect(() => {
    const { item: opened, close: done, onSaved: saved, before: start } = given.current;
    const dialog = formModal({
      title: t('catalog:itemEdit.title'), confirmLabel: t('catalog:itemEdit.save'), deferShow: true,
      backdropCloses: () => draft.current.cover.kind === 'keep' && !editBody(opened, start, draft.current),
      body: '<div class="peach-react" data-item-edit-fields></div>',
      onConfirm: async () => {
        /* 封面先写：它不推这一部的版本号，后面字段那一份带的打开时版本仍然有效。封面写成、字段被拒时
           原因留在弹层里，再点保存会把同一张图再装一次，结果不变。 */
        const cover = draft.current.cover;
        let saved: { item: DetailItem } | null = null;
        if (cover.kind === 'image') {
          saved = await apiSendBytes<{ item: DetailItem }>(`${ITEM_COVER_URL}?id=${opened.id}&origin=${cover.origin}`, cover.blob);
        } else if (cover.kind === 'restore') {
          saved = await apiSend<{ item: DetailItem }>(`${ITEM_COVER_URL}/restore`, { id: opened.id });
        }
        const body = editBody(opened, start, draft.current);
        return body ? apiSend<{ item: DetailItem }>(ITEM_EDIT_URL, body) : saved;
      },
    });
    dialog.dialog.setAttribute('data-item-edit-dialog', '');
    setView({ host: dialog.dialog.querySelector('[data-item-edit-fields]')!, dialog });
    void dialog.done.then(result => {
      const response = result.result as { item?: DetailItem } | null | undefined;
      if (result.confirmed && response?.item) saved(response.item);
      done();
    });
    return () => dialog.close();
  }, []);
  /* 表单整张渲染好再弹出：先弹出再渲染，那一下主线程卡住会把进场动效吃掉。 */
  useEffect(() => { view?.dialog.show() }, [view]);
  /* 下拉、提示这些弹层挂进编辑框自己的 dialog：经 portal 挂过来的子树仍继承舞台那一层的容器，
     弹层会落进舞台，被压在这个后开的模态框底下，看起来就是一个空下拉。 */
  return view ? createPortal(<UNSAFE_PortalProvider getContainer={() => overlayHost(view.dialog.dialog)}>
    <EditFields item={given.current.item} helpers={helpers} initial={before}
      update={value => { draft.current = value }} />
  </UNSAFE_PortalProvider>, view.host) : null;
}

function EditFields({ item, helpers, initial, update }: {
  item: DetailItem; helpers: ItemDetailHelpers; initial: Draft; update(value: Draft): void;
}) {
  const [draft, setDraft] = useState(initial);
  useEffect(() => { update(draft) }, [draft, update]);
  const sources = (item.field_sources || {}) as Record<string, FieldSource>;
  const set = (patch: Partial<Draft>) => setDraft(now => ({ ...now, ...patch }));
  const restoring = (key: string) => draft.restore.includes(key);
  const toggleRestore = (key: string) => set({ restore: restoring(key) ? draft.restore.filter(value => value !== key) : [...draft.restore, key] });
  const row = (key: string, label: string, control: ReactNode) => {
    const source = sources[key];
    const user = source?.owner === 'user';
    const note = restoring(key) ? <>{t('catalog:itemEdit.restorePending')}
      <Button variant="ghost" size="xs" data-edit-restore="" onClick={() => toggleRestore(key)}>{t('catalog:itemEdit.undoRestore')}</Button></>
      : sourceNote(source) && <>{sourceNote(source)}{user ? <Button variant="ghost" size="xs" data-edit-restore="" title={t('catalog:itemEdit.restoreTip')}
        onClick={() => toggleRestore(key)}>{t('catalog:itemEdit.restore')}</Button> : null}</>;
    /* 来源写在控件下面一行，没有来源的字段不占位置：弹层不必为一列多半空着的来源留宽。 */
    return (
      <div data-edit-row={key} key={key}>
        <span data-edit-label="" id={`item-edit-${key}`}>{label}</span>
        <div data-edit-control="">
          {control}
          {note ? <span data-edit-source="" data-owner={source?.owner || undefined}>{note}</span> : null}
        </div>
      </div>
    );
  };
  const text = (key: TextField, label: string, extra: { placeholder?: string; maxLength?: number } = {}) => row(key, label,
    <Input aria-labelledby={`item-edit-${key}`} value={draft.text[key]} maxLength={extra.maxLength ?? 1000} placeholder={extra.placeholder}
      onChange={value => set({ text: { ...draft.text, [key]: value } })} />);
  const regionLabel = (value: string) => t(`server:labels.regions.${value || 'none'}`);
  return (
    <div data-item-edit="">
      <section data-edit-section="">
        <h4>{t('catalog:itemEdit.sectionBasic')}</h4>
        <CoverRow item={item} value={draft.cover} onChange={cover => set({ cover })} />
        {text('code', t('catalog:itemEdit.fieldCode'), { maxLength: 80 })}
        {text('title', t('catalog:itemEdit.fieldTitle'))}
        {text('original_title', t('catalog:itemEdit.fieldOriginalTitle'))}
        {text('release_date', t('catalog:itemEdit.fieldReleaseDate'), { placeholder: t('catalog:itemEdit.datePlaceholder'), maxLength: 10 })}
        {row('region', t('catalog:itemEdit.fieldRegion'),
          <Select aria-labelledby="item-edit-region" selectedKey={draft.region || 'none'}
            onSelectionChange={key => set({ region: key === 'none' ? '' : String(key) })}>
            {REGIONS.map(value => <SelectItem key={value || 'none'} id={value || 'none'}>{regionLabel(value)}</SelectItem>)}
          </Select>)}
      </section>
      <section data-edit-section="">
        <h4>{t('catalog:itemEdit.sectionCredits')}</h4>
        {row('performers', performerLabel(item),
          <EntityChips kind="performer" values={draft.performers} labelledBy="item-edit-performers"
            onChange={performers => set({ performers })} />)}
        {row('studio', t('catalog:itemEdit.fieldStudio'),
          <EntityChips kind="studio" single values={draft.studio ? [draft.studio] : []} labelledBy="item-edit-studio"
            onChange={values => set({ studio: values[0] || null })} />)}
        {row('series', t('catalog:itemEdit.fieldSeries'),
          <EntityChips kind="series" single values={draft.series ? [draft.series] : []} labelledBy="item-edit-series"
            onChange={values => set({ series: values[0] || null })} />)}
      </section>
      <section data-edit-section="">
        <h4>{t('catalog:itemEdit.sectionTags')}</h4>
        <DetailTags editable tags={draft.tags} candidates={helpers.tagCandidates()} label={helpers.tagLabel}
          onAdd={tag => { if (!draft.tags.some(value => foldName(value.k) === foldName(tag))) set({ tags: [...draft.tags, { k: tag, cat: 'general' }] }) }}
          onRemove={tag => set({ tags: draft.tags.filter(value => value.k !== tag.k) })} />
      </section>
    </div>
  );
}

/** 播放器停在哪一帧就取哪一帧：详情舞台里的那个 `<video>`，流是同源的，画布读得出像素。 */
function playerFrame(): Promise<Blob> {
  const video = document.querySelector<HTMLVideoElement>('#stage video');
  if (!video || video.readyState < 2 || !video.videoWidth) return Promise.reject(new Error(t('catalog:itemEdit.coverNoFrame')));
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error(t('catalog:itemEdit.coverNoFrame')))), 'image/jpeg', 0.95));
}

/* 封面是「基本」里的第一行，与下面的字段同一套两列：缩略图（或选好待保存的那张），状态与几种换法
   贴着缩略图底边排。选好只在本地预览，点保存才写。
   换上的封面后台不再替换；「恢复刮削封面」放回第一次替换前的那张。 */
function CoverRow({ item, value, onChange }: { item: DetailItem; value: CoverDraft; onChange(value: CoverDraft): void }) {
  const file = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState('');
  const [picking, setPicking] = useState(false);
  /* 样张一排：指针在上面时竖向滚轮也横着滚，两头有渐隐提示，与站内横向导航同一套。 */
  const samplesRef = useHorizontalScroller<HTMLDivElement>();
  /* 账本里登记了样张、本机却没缓存到的那几张取图会失败：失败的格子直接收掉，不留空框。 */
  const [missing, setMissing] = useState<ReadonlySet<number>>(() => new Set());
  const samples = (item.sample_images || []).filter(sample => sample.n > 0);
  const shownSamples = samples.filter(sample => !missing.has(sample.n));
  useEffect(() => () => { if (value.kind === 'image') URL.revokeObjectURL(value.url) }, [value]);
  const image = (blob: Blob, origin: 'upload' | 'frame' | 'sample') => {
    setFailure(''); setPicking(false);
    onChange({ kind: 'image', blob, url: URL.createObjectURL(blob), origin });
  };
  const sample = async (n: number) => {
    try {
      const response = await fetch(`/sample-image?code=${encodeURIComponent(item.code || '')}&n=${n}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(t('catalog:catalogPicture.previewNotFound'));
      image(await response.blob(), 'sample');
    } catch (error) { setFailure(error instanceof Error ? error.message : String(error)) }
  };
  const current = value.kind === 'image' ? value.url : value.kind === 'restore' || !item.has_cover ? '' : coverUrl(item, true);
  const state = value.kind === 'image' ? t('catalog:itemEdit.coverPending')
    : value.kind === 'restore' ? t('catalog:itemEdit.coverRestorePending')
      : item.cover_user ? t('catalog:itemEdit.sourceUser') : item.has_cover ? '' : t('catalog:itemEdit.coverNone');
  return (
    <div data-edit-row="cover" data-edit-cover="">
      <span data-edit-label="" id="item-edit-cover">{t('catalog:itemEdit.sectionCover')}</span>
      <div data-edit-control="">
        <div data-cover-row="">
          <span data-cover-preview="" data-empty={current ? undefined : ''} data-pending={value.kind === 'image' ? '' : undefined}>{current ? <img src={current} alt="" /> : <Glyph name="image-off" />}</span>
          <div data-cover-actions="">
            <div data-cover-buttons="">
              <Button variant="secondary" size="small" data-cover-upload="" onClick={() => file.current?.click()}>{t('catalog:itemEdit.coverUpload')}</Button>
              <Button variant="secondary" size="small" data-cover-frame="" onClick={() => {
                playerFrame().then(blob => image(blob, 'frame'), error => setFailure(error instanceof Error ? error.message : String(error)));
              }}>{t('catalog:itemEdit.coverFrame')}</Button>
              {samples.length ? <Button variant="secondary" size="small" data-cover-samples="" aria-expanded={picking}
                onClick={() => setPicking(!picking)}>{t('catalog:itemEdit.coverSample')}</Button> : null}
              {item.cover_user && value.kind !== 'restore' ? <Button variant="ghost" size="small" data-cover-restore=""
                onClick={() => { setFailure(''); onChange({ kind: 'restore' }) }}>{t('catalog:itemEdit.coverRestore')}</Button> : null}
              {value.kind !== 'keep' ? <Button variant="ghost" size="small" data-cover-undo=""
                onClick={() => { setFailure(''); onChange({ kind: 'keep' }) }}>{t('catalog:itemEdit.undoRestore')}</Button> : null}
            </div>
            {state ? <span data-edit-source="" data-owner={item.cover_user && value.kind === 'keep' ? 'user' : undefined}>{state}</span> : null}
            {failure ? <span data-cover-failure="" role="alert">{failure}</span> : null}
          </div>
        </div>
        {samples.length ? <CollapseRegion open={picking} data-cover-samples-region="">
          {shownSamples.length ? <div ref={samplesRef} data-cover-samples-grid="">
            {shownSamples.map(entry => <button type="button" key={entry.n} data-cover-sample={entry.n}
              aria-label={t('catalog:detailMedia.sampleNumber', { number: entry.n })} onClick={() => void sample(entry.n)}>
              <img src={`/sample-thumb?code=${encodeURIComponent(item.code || '')}&n=${entry.n}`} alt="" loading="lazy"
                onError={() => setMissing(now => new Set([...now, entry.n]))} />
            </button>)}
          </div> : <span data-edit-source="">{t('catalog:catalogPicture.previewNotFound')}</span>}
        </CollapseRegion> : null}
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden data-cover-file=""
          onChange={event => { const chosen = event.target.files?.[0]; event.target.value = ''; if (chosen) image(chosen, 'upload') }} />
      </div>
    </div>
  );
}

/** 已选的几个身份排成胶囊，后面跟一个搜索框；单选的（厂牌、系列）选了一个就收起搜索框。
 *  资料页「合并重复档案」也用它单选另一份，`picker` 透传给搜索框（不新建、不列当前这份）。 */
export function EntityChips({ kind, values, single = false, labelledBy, onChange, picker }: {
  kind: string; values: Choice[]; single?: boolean; labelledBy: string; onChange(values: Choice[]): void;
  picker?: { allowCreate?: boolean; exclude?: number; placeholder?: string };
}) {
  const pick = (value: Choice) => {
    if (values.some(other => sameChoice(other, value))) return;
    onChange(single ? [value] : [...values, value]);
  };
  return (
    <div data-entity-chips="">
      {values.map(value => (
        <span key={`${value.id ?? ''}:${value.name}`} data-entity-chip="" data-user-created={value.user_created ? '' : undefined}>
          <span data-entity-name="" title={value.name}>{value.name}</span>
          {value.user_created ? <span data-user-created-mark="">{t('catalog:itemEdit.userCreated')}</span> : null}
          <button type="button" data-entity-remove="" aria-label={t('catalog:itemEdit.removeNamed', { name: value.name })}
            title={t('catalog:itemEdit.removeNamed', { name: value.name })}
            onClick={() => onChange(values.filter(other => !sameChoice(other, value)))}><Glyph name="x" /></button>
        </span>
      ))}
      {single && values.length ? null : <EntityPicker kind={kind} labelledBy={labelledBy} onPick={pick} {...picker} />}
    </div>
  );
}

interface SuggestItem { value: string; n: number; entity_id: number | null }
interface SuggestResponse { groups?: { kind: string; items: SuggestItem[] }[] }

/** 输入名字搜馆藏里已有的档案（名称与别名都认），列表最后一格是「新建」。搜的是 `/api/suggest`，
 *  与搜索栏同一条判据。回车挑高亮那一项，没有高亮就按输入新建。资料页的「合并重复档案」也用它：
 *  那里不新建（`allowCreate`），也不列出当前这份（`exclude`）。 */
export function EntityPicker({ kind, labelledBy, onPick, allowCreate = true, exclude, placeholder }: {
  kind: string; labelledBy: string; onPick(value: Choice): void;
  allowCreate?: boolean; exclude?: number; placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const term = query.trim();
  const found = useQuery({
    queryKey: ['item-edit-suggest', kind, term],
    queryFn: ({ signal }) => apiGet<SuggestResponse>(`/api/suggest?q=${encodeURIComponent(term)}&kind=${kind}&limit=8`, signal),
    enabled: term.length > 0, staleTime: 30_000,
  });
  const items = (found.data?.groups || []).find(group => group.kind === kind)?.items || [];
  const exact = items.some(item => foldName(item.value) === foldName(term));
  const options: Choice[] = [
    ...items.filter(item => exclude == null || item.entity_id !== exclude).map(item => ({ id: item.entity_id, name: item.value })),
    ...(allowCreate && term && !exact ? [{ id: null, name: term }] : []),
  ];
  const choose = (value: Choice) => { onPick(value); setQuery(''); setActive(0) };
  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composingKey(event.nativeEvent)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length) setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Enter') {
      // 表单里的回车会提交整个弹层；在这个框里它只是挑一项。
      event.preventDefault();
      const chosen = options[active];
      if (chosen) choose(chosen);
    } else if (event.key === 'Escape' && query) {
      event.preventDefault(); event.stopPropagation(); setQuery('');
    }
  };
  return (
    <div data-entity-picker="">
      <Input aria-labelledby={labelledBy} value={query} maxLength={200} placeholder={placeholder ?? t('catalog:itemEdit.searchOrCreate')}
        onChange={value => { setQuery(value); setActive(0) }} onKeyDown={keydown} />
      {term ? (
        <div role="listbox" aria-labelledby={labelledBy} data-entity-options="" aria-busy={found.isFetching || undefined}>
          {options.map((option, index) => (
            <button type="button" role="option" key={`${option.id ?? 'new'}:${option.name}`} aria-selected={index === active}
              data-entity-option={option.id ?? 'new'} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
              {option.id == null ? <><Glyph name="plus" /><span>{t('catalog:itemEdit.createNamed', { name: option.name })}</span></>
                : <span>{option.name}</span>}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 保存成功：这一部的缓存换成接口回的那份，其余页面的数据作废、按需重取。 */
export function applySavedItem(saved: DetailItem): void {
  queryClient.setQueryData(itemKey(saved.id), saved);
  void queryClient.invalidateQueries({ predicate: query => !(query.queryKey[0] === 'item' && query.queryKey[1] === saved.id) });
}
