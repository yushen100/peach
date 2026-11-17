import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { RiChat3Line, RiExternalLinkLine } from '@remixicon/react';
import { entityPath, icon } from '@peach/legacy/core';
import { tagLabel } from '@peach/legacy/tags';
import { mountPreviewPlayer } from '../../player';
import { apiGet, errorMessage } from '../../api';
import { textLang } from '../../core/text-lang';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { CloudDownloadDialog, type DownloadPrefill } from '../activity/cloud-download-dialog';
import { Note } from '../components/note';
import { DetailFailure } from '../components/detail-failure';
import { IdentityCell, IdentitySeries } from '../components/identity-cell';
import { SourceAvatar } from '../components/source-avatar';
import { SourcePicture as JavPicture } from '../components/source-picture';
import { MediaCarousel } from '../components/media-carousel';
import { RatingStars } from '../components/rating-stars';
import { CollapseChevron } from '../components/collapse-region';
import { useFoldedTitle } from '../components/folded-title';
import { busyProps, useAction } from '../settings/use-action';
import { Disclosure } from '../settings/section';
import { addWant, invalidateWants, removeWants } from '../wants/wants';
import { WantMagnets } from '../wants/want-magnets';
import type { DownloadsSnapshot } from '../bundle';
import { DOWNLOADS_KEY, DOWNLOADS_URL } from '../activity/downloads-panel';
import { queryClient } from '../query';
import { fetchJavDetail, fetchJavReviews, javDetailKey, nextReviewPage, type JavDetail, type JavDetailProps, type JavEntityRef, type JavReviews } from './jav-detail';
import { cachedReviews, rememberReviews, reviewsFresh } from './review-cache';
import { serverLabel } from '../../core/server-text';
import { t } from '../../i18n';

export function JavDetailPage(props: JavDetailProps) {
  const refresh = useRef(false);
  const result = useQuery({ queryKey: javDetailKey(props.code), queryFn: ({ signal }) => {
    const forced = refresh.current;
    refresh.current = false;
    return fetchJavDetail(props.code, signal, forced);
  }, staleTime: 6 * 3600_000 });
  const retry = () => { refresh.current = true; void result.refetch() };
  return <div data-jav-detail="" data-item-detail="" data-stage-grid="">
    {result.data ? <Work key={props.code} {...props} item={result.data} retry={retry} retrying={result.isFetching} /> : <div data-jav-failure="" data-detail-failure="">
      <Close close={props.actions.close} />
      {result.error ? <DetailFailure detail={`${props.code} · ${errorMessage(result.error)}`} busy={result.isFetching} onRetry={retry} /> : null}
    </div>}
  </div>;
}

const Close = ({ close }: { close(): void }) => <button type="button" data-stage-close="" id="closeStage"
  aria-label={t('catalog:shared.close')} title={t('catalog:shared.close')} onClick={close} dangerouslySetInnerHTML={{ __html: icon('x') }} />;

function Work({ code, item, actions, readOnly, retry, retrying }: JavDetailProps & { item: JavDetail; retry(): void; retrying: boolean }) {
  useEffect(() => { actions.canonicalCode?.(item.code) }, [actions, item.code]);
  useEffect(() => { if (item.state === 'ready') void queryClient.invalidateQueries({ queryKey: ['jav-discoveries', 'external'] }) }, [item.code, item.state]);
  // 没有封面时仍停在封面那一格（说明与重试），不自动跳到样张：样张第一张常是来源的封面小图，放大满屏是糊的。
  const [preview, setPreview] = useState(-1);
  const media = [{ index: -1, label: t('catalog:shared.cover') }, ...Array.from({ length: item.preview_count }, (_, index) => ({ index, label: t('catalog:detailMedia.sampleNumber', { number: index + 1 }) })),
    ...(item.preview_video_url ? [{ index: -2, label: t('catalog:javDetail.sampleVideo'), video: true }] : [])];
  const [download, setDownload] = useState<DownloadPrefill | null>(null);
  const [wantId, setWantId] = useState(item.want_id);
  const want = useAction();
  const toggleWant = () => { void want.run('want', async signal => {
    if (wantId) { await removeWants([wantId], signal); return null }
    return (await addWant({ code: item.code }, signal)).want.id;
  }, id => {
    setWantId(id);
    queryClient.setQueryData<JavDetail>(javDetailKey(code), current => current ? { ...current, wanted: !!id, want_id: id } : current);
    actions.receipt(id ? t('catalog:javWant.added') : t('catalog:javWant.removed'));
    void invalidateWants();
    void queryClient.invalidateQueries({ queryKey: ['feed-new'] });
    void queryClient.invalidateQueries({ queryKey: ['jav-discoveries'] });
  }) };
  return <>
    <div data-stage-media="" data-jav-art="" data-jav-playing={preview === -2 ? '' : undefined}>
      <Close close={actions.close} />
      {item.preview_video_url ? <button type="button" data-jav-preview-toggle="" aria-pressed={preview === -2}
        onClick={() => setPreview(preview === -2 ? -1 : -2)}><Glyph name={preview === -2 ? 'image' : 'play'} />{preview === -2 ? t('catalog:detailMedia.viewImages') : t('catalog:javDetail.sampleVideo')}</button>
        // 预告没取到：说在预告本来出现的位置，点一下就重取，原因在悬停提示里。
        : item.preview_message ? <button type="button" data-jav-preview-toggle="" data-unavailable="" title={item.preview_message}
          aria-label={t('catalog:javDetail.retryPreview', { reason: item.preview_message })} {...busyProps(retrying)} onClick={retry}>
          <Glyph name="play" />{t('catalog:javDetail.sampleVideoFailed')}</button> : null}
      {preview === -2 && item.preview_video_url ? <PreviewVideo key={item.preview_video_url} src={item.preview_video_url} />
        : <JavPicture key={item.code} item={item} image={preview === -1 ? 'cover' : String(preview)} />}
      <MediaCarousel items={media} position={Math.max(0, media.findIndex(entry => entry.index === preview))} onSelect={setPreview}
        below renderThumbnail={entry => <JavPicture item={item} image={entry.index < 0 ? 'cover' : String(entry.index)} thumbnail />} />
    </div>
    <aside data-stage-side=""><div data-stage-side-content="" data-jav-info="">
      <JavTitle item={item} />
      {Number(item.score) > 0 ? <SourceRating score={Number(item.score)} /> : null}
      <div className="mono" data-stage-meta="" data-reveal-line="">
        <Spec glyph="calendar" label={t('catalog:javDetail.releaseDate')} value={item.release_date} />
        <Spec glyph="clock" label={t('catalog:catalogList.duration')} value={item.duration ? t('catalog:javDetail.minutes', { count: item.duration }) : undefined} />
      </div>
      <JavIdentity item={item} navigate={actions.navigate} />
      <div data-jav-facts="">
        <Spec glyph="briefcase" label={t('catalog:entityFacts.distributor')} value={item.publisher} />
        <Spec glyph="clapperboard" label={t('catalog:javDetail.director')} value={item.director} />
      </div>
      {(item.tag_refs?.length ?? item.tags.length) > 0 ? <div data-stage-tags="" data-detail-tags="" data-jav-tags="">{(item.tag_refs || item.tags.map(name => ({ name, category: 'general', source_name: name }))).map(tag =>
        <span data-detail-tag="" data-tag-cat={tag.category} key={tag.name}><button type="button" data-tag={tag.name}
          title={tagLabel(tag.name)} onClick={() => actions.openTag(tag.name)}>{tagLabel(tag.name)}</button></span>)}</div> : null}
      {item.summary ? <p data-jav-summary="" data-long-text="" lang={textLang(item.summary)}>{item.summary}</p> : null}
      {item.message ? <Note tone="neutral" action={<Button variant="secondary" {...busyProps(retrying)} onClick={retry}>{t('catalog:shared.retryNow')}</Button>}>{item.message}</Note> : null}
      <div data-jav-actions="">
        {item.source_url ? <ButtonLink data-button-link="" variant="secondary" trailingIcon={RiExternalLinkLine}
          href={item.source_url} target="_blank" rel="noopener noreferrer">{t('catalog:shared.viewOnSite')}</ButtonLink> : null}
        <Button variant="secondary" disabled={readOnly} aria-pressed={!!wantId} {...busyProps(!!want.busy)} onClick={toggleWant}>{wantId ? t('catalog:javWant.remove') : t('catalog:javWant.want')}</Button>
        <Button variant="primary" onClick={() => setDownload({ code: item.code, title: item.title, performers: item.performers,
          studio: item.studio, release_date: item.release_date, origin: `jav:${item.code}` })}>{t('catalog:shared.searchTorrents')}</Button>
      </div>
      {want.error ? <Note tone="error">{want.error}</Note> : null}
      <Reviews code={item.code} count={item.comments_count} released={item.release_date} />
      <Resources item={item} actions={actions} readOnly={readOnly} />
    </div></aside>
    <CloudDownloadDialog prefill={download} close={() => setDownload(null)} receipt={actions.receipt} />
  </>;
}

const Glyph = ({ name }: { name: string }) => <span className="contents" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon(name) }} />;
const Spec = ({ glyph, label, value }: { glyph: string; label: string; value?: string }) => value ? <span data-spec-item="" title={label}><Glyph name={glyph} /><span>{value}</span></span> : null;

function JavTitle({ item }: { item: JavDetail }) {
  const { text, expanded, foldable, toggle } = useFoldedTitle(item.title);
  const title = item.title === item.code ? '' : item.title;
  return <div data-item-title=""><h1 data-stage-title="" data-title-line="" data-reveal-line=""><span ref={text} data-detail-title=""
    data-expanded={expanded ? '' : undefined} data-foldable={foldable ? '' : undefined}
    onClick={() => { if (foldable && !String(getSelection() || '')) toggle() }}><b>{item.code}</b>{title ? <>{' '}<span lang={textLang(title)}>{title}</span></> : null}</span></h1>
    <span data-title-tools=""><button type="button" data-title-fold="" hidden={!foldable} aria-expanded={expanded}
      aria-label={expanded ? t('catalog:titleFold.collapse') : t('catalog:titleFold.expand')} title={expanded ? t('catalog:titleFold.collapse') : t('catalog:titleFold.expandFull')} onClick={toggle}><CollapseChevron /></button></span>
  </div>;
}

function SourceRating({ score, review = false }: { score: number; review?: boolean }) {
  return <div data-item-rating="" data-jav-rating="" data-review-rating={review ? '' : undefined} role="img" aria-label={review ? t('catalog:javComments.ratingLabel', { score }) : t('catalog:javScore.siteRatingNamed', { site: 'JavDB', score })}>
    <RatingStars value={score} />
    <span data-rating-value="">{score.toFixed(1)} / 5</span>
  </div>;
}

function JavIdentity({ item, navigate }: { item: JavDetail; navigate(path: string): void }) {
  const onOpen = (kind: string, name: string) => navigate(entityPath(kind, name));
  const group = (kind: string, label: string, refs: JavEntityRef[], gender?: string) => refs.length ? <section data-id-group={kind} data-id-gender={gender}>
    <h5 data-id-label="">{label}</h5><div data-id-row="">{refs.map(person => <IdentityCell key={person.name} kind={kind}
      person={{ ...person, id: person.id ?? null }} onOpen={onOpen}
      face={kind === 'performer' && !person.has_image && !person.has_avatar && person.source_avatar && person.source_actor_id
        ? <SourceAvatar code={item.code} person={person} detail /> : undefined} />)}</div>
  </section> : null;
  return <div data-item-identity=""><div data-identity-primary="">
    {group('performer', t('catalog:shared.actresses'), item.performer_refs.filter(person => person.gender === 'female'), 'female')}
    {group('performer', t('catalog:javDetail.performers'), item.performer_refs.filter(person => !person.gender || person.gender === 'unknown'), 'unknown')}
    {group('studio', t('catalog:shared.label'), item.studio_refs)}</div>
    <IdentitySeries people={item.series_refs.map(person => ({ ...person, id: person.id ?? null }))} onOpen={onOpen} /></div>;
}

function PreviewVideo({ src }: { src: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    if (failed) return;
    const node = frame.current!;
    const video = document.createElement('video');
    video.className = 'video-js vjs-big-play-centered';
    video.controls = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', t('catalog:javDetail.sampleVideo'));
    node.append(video);
    return mountPreviewPlayer(video, { src, type: /\.m3u8(?:\?|$)/i.test(src) ? 'application/x-mpegURL' : 'video/mp4' }, () => setFailed(true));
  }, [src, failed]);
  return <div ref={frame} data-jav-video="">{failed ? <Note tone="neutral" action={<Button variant="secondary" onClick={() => setFailed(false)}>{t('catalog:shared.retryNow')}</Button>}>{t('catalog:javDetail.sampleVideoFailed')}</Note> : null}</div>;
}

function Reviews({ code, count, released }: { code: string; count: number; released?: string }) {
  const client = useQueryClient();
  const [opened, setOpened] = useState(false);
  const cached = useMemo(() => cachedReviews(code, released), [code, released]);
  const refresh = useRef(false);
  const result = useInfiniteQuery({ queryKey: ['jav-reviews', code], enabled: opened, initialPageParam: 1,
    initialData: cached ? { pages: cached.pages, pageParams: cached.pageParams } : undefined,
    initialDataUpdatedAt: cached?.saved,
    staleTime: state => reviewsFresh(state.state.data?.pages || [], state.state.dataUpdatedAt, released) ? Infinity : 0,
    gcTime: 86_400_000, refetchOnWindowFocus: false,
    queryFn: async ({ signal, pageParam }) => {
      const page = await fetchJavReviews(code, pageParam, signal, refresh.current);
      rememberReviews(code, page);
      if (!page.ok || page.cache_stale) {
        const previous = client.getQueryData<InfiniteData<JavReviews>>(['jav-reviews', code])?.pages.find(row => row.page === pageParam);
        if (previous?.ok) return { ...previous, cache_stale: true, message: page.message || t('catalog:javComments.failed') };
      }
      return page;
    }, getNextPageParam: nextReviewPage });
  useEffect(() => { if (!result.isFetching) refresh.current = false }, [result.isFetching]);
  const pages = result.data?.pages || [];
  const items = [...new Map(pages.flatMap(page => page.items).map(item => [item.id, item])).values()];
  const failure = result.error ? errorMessage(result.error) : pages.find(page => !page.ok || page.cache_stale)?.message;
  return <section data-jav-reviews="">
    <Disclosure trailing summary={<><RiChat3Line aria-hidden />{t('catalog:javComments.title')}{count > 0 ? ` · ${count}` : ''}</>}
      onOpenChange={setOpened}>
    {opened && result.isPending ? <div data-skeleton="reviews" role="status" aria-label={t('catalog:javComments.loading')} className="flex flex-col gap-4 py-3">
      {[0, 1, 2].map(row => <div key={row} data-jav-review-skeleton="" aria-hidden="true" className="flex flex-col gap-3 py-2">
        <div className="flex items-center gap-3"><span className="relative block h-4 w-20 rounded-md skeleton-sheen" /><span className="relative block h-3 w-24 rounded-md skeleton-sheen" /></div>
        <div className="flex flex-col gap-2"><span className="relative block h-3 w-full rounded-md skeleton-sheen" /><span className="relative block h-3 w-full rounded-md skeleton-sheen" /><span className="relative block h-3 w-3/4 rounded-md skeleton-sheen" /></div>
      </div>)}
    </div> : null}
    {opened || result.data ? <>
      {items.map(item => <article key={item.id} data-jav-review=""><div data-jav-review-meta=""><b>{serverLabel(item.username_code ?? '', item.username)}</b>
        {Number(item.score) > 0 ? <SourceRating score={Number(item.score)} review /> : null}
        <time dateTime={item.created_at} title={item.created_at}>{item.created_at.slice(0, 10)}</time></div><p data-long-text="" lang={textLang(item.content)}>{item.content}</p></article>)}
      {failure ? <Note tone="neutral" action={<Button variant="secondary" {...busyProps(result.isFetching)} onClick={() => { refresh.current = true; void result.refetch() }}>{t('catalog:shared.retryNow')}</Button>}>{failure}</Note>
        : !result.isPending && !items.length ? <Note tone="neutral">{t('catalog:javComments.empty')}</Note> : null}
      {!failure && pages.length ? <Button variant="secondary" {...busyProps(result.isFetching)}
        onClick={() => { refresh.current = true; void result.refetch() }}>{t('catalog:javComments.refresh')}</Button> : null}
      {result.hasNextPage ? <Button variant="secondary" {...busyProps(result.isFetchingNextPage)} onClick={() => { if (!result.isFetchingNextPage) void result.fetchNextPage() }}>{t('catalog:javComments.more')}</Button> : null}
      {!failure && pages.at(-1)?.page === 8 && count > items.length ? <Note tone="neutral">{t('catalog:javComments.shown', { count: items.length })}</Note> : null}
    </> : null}
    </Disclosure>
  </section>;
}

function Resources({ item, actions, readOnly }: { item: JavDetail; actions: JavDetailProps['actions']; readOnly: boolean }) {
  const [opened, setOpened] = useState(false);
  const downloads = useQuery({ queryKey: DOWNLOADS_KEY, enabled: opened,
    queryFn: ({ signal }) => apiGet<DownloadsSnapshot>(`${DOWNLOADS_URL}?limit=50`, signal) });
  const provider = downloads.data?.providers.find(row => row.configured)?.key || '';
  const [loaded, setLoaded] = useState(false);
  return <section data-jav-resources="">
    <Disclosure trailing summary={<><Glyph name="link" />{t('catalog:javDetail.resources')}</>} onOpenChange={value => { setOpened(value); if (value) setLoaded(true) }}>
    {loaded ? <WantMagnets want={{ id: 0, code: item.code, title: item.title, release_date: item.release_date || null }}
      queryUrl={`/api/jav/resources?code=${encodeURIComponent(item.code)}`} readOnly={readOnly}
      downloads={downloads.data} provider={provider} toast={actions.receipt} />
      : null}
    </Disclosure>
  </section>;
}
