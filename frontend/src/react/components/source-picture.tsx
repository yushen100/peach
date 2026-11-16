import { useLayoutEffect, useRef, useState } from 'react';
import { RiImageLine } from '@remixicon/react';
import { coverUrl } from '@peach/card-art';
import { Button } from '@/components/base/buttons/button';
import { apiSend } from '../../api';
import { queryClient } from '../query';
import { busyProps, useAction } from '../settings/use-action';
import type { JavDetail } from '../jav-detail/jav-detail';
import { codedText } from '../../core/server-text';
import { t } from '../../i18n';

/** 来源图片（样张、来源封面、来源头像）的地址。服务端取过一次就落盘，回的是图片本身，
 *  浏览器按 ETag 与私有时效缓存；`attempt` 让重试换一个地址，不复用刚失败的那一次。 */
export const javImageUrl = (code: string, image: string, attempt = 0): string =>
  `/jav-image?code=${encodeURIComponent(code)}&image=${encodeURIComponent(image)}${attempt ? `&attempt=${attempt}` : ''}`;

interface CoverRetry { has_cover: boolean; cover_version: string; message: string }

/** 图片没取到时占住舞台那一格：图标、一句说明和原因，加一颗次要的「立即重试」。
 *  舞台恒为黑底，不套空态卡片（亮色主题下那是一张浮在黑底上的白卡），字色取 `--on-media`。 */
function PictureMissing({ title, detail, busy, onRetry }: { title: string; detail?: string; busy?: boolean; onRetry(): void }) {
  return <div data-jav-picture-wait="" data-jav-picture-gap="" role="status">
    <RiImageLine aria-hidden data-gap-glyph="" />
    <strong>{title}</strong>
    {detail ? <p>{detail}</p> : null}
    <Button size="small" variant="secondary" {...busyProps(!!busy)} onClick={onRetry}>{t('shell:shared.retryNow')}</Button>
  </div>;
}

/** 缩略条里没图的那一格：只放图标，说明放在悬停提示里；一行字挤在 88px 的格子里读不清。 */
const ThumbnailGap = ({ label }: { label: string }) =>
  <span data-thumbnail-gap="" role="img" aria-label={label} title={label}><RiImageLine aria-hidden /></span>;

/** 本机没有封面、来源也没给能代理的地址：服务端按番号重取官方封面，取到后详情换成本机那张。
 *  `known` 是详情接口带来的上次没取到的原因（取图记录）。 */
function CoverMissing({ code, known }: { code: string; known: string }) {
  const action = useAction();
  const [reason, setReason] = useState(known);
  const retry = () => { void action.run('cover', signal => apiSend<CoverRetry>('/api/jav/cover', { code }, 'POST', signal), result => {
    if (!result.has_cover) { setReason(result.message); return }
    queryClient.setQueriesData<JavDetail>({ queryKey: ['jav-detail'] }, current => current?.code === code
      ? { ...current, has_cover: true, cover_version: result.cover_version } : current);
  }) };
  return <PictureMissing title={t('shell:artworkGap.coverNotFound')} detail={action.error || reason} busy={!!action.busy} onRetry={retry} />;
}

/** 比这还窄的来源图（来源把封面小图列进样张，147×200 那种）在大图位置按原尺寸摆，不拉满舞台：拉大了只是一片糊。 */
const NATIVE_SIZE_BELOW = 400;
const markNativeSize = (node: HTMLImageElement) => node.toggleAttribute('data-native-size', node.naturalWidth < NATIVE_SIZE_BELOW);

/** 来源图片：本地有封面用本地那张，否则经 `/jav-image` 取。 */
export function SourcePicture({ item, image, thumbnail = false }: {
  item: Pick<JavDetail, 'code' | 'has_cover' | 'source_image' | 'cover_url' | 'cover_version'>
    & Partial<Pick<JavDetail, 'cover_message' | 'cover_message_code' | 'cover_message_params'>>;
  image: string; thumbnail?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ src: string; alt: string } | null>(null);
  const [failed, setFailed] = useState('');
  const picture = useRef<HTMLImageElement>(null);
  const local = image === 'cover' && item.has_cover;
  const remote = !local && (image !== 'cover' || item.source_image);
  const alt = thumbnail ? '' : image === 'cover' ? t('shell:sourcePicture.coverAlt', { code: item.code }) : t('shell:sourcePicture.previewAlt', { code: item.code, index: Number(image) + 1 });
  const src = remote ? javImageUrl(item.code, image, attempt) : local ? coverUrl(item, true) : item.cover_url || '';
  useLayoutEffect(() => {
    const node = picture.current;
    if (node?.complete && node.naturalWidth > 0) setLoaded({ src, alt });
  }, [src, alt]);
  if (!remote) {
    if (src) return <img ref={picture} data-jav-picture={thumbnail ? undefined : ''} src={src} alt={alt} referrerPolicy="no-referrer"
      onLoad={event => { if (!thumbnail) markNativeSize(event.currentTarget); setLoaded({ src, alt }) }} />;
    return thumbnail ? <ThumbnailGap label={t('shell:artworkGap.coverNotFound')} />
      : <CoverMissing code={item.code} known={codedText(item, 'cover_message')} />;
  }
  if (failed === src) {
    if (thumbnail) return <ThumbnailGap label={t('shell:artworkGap.previewNotFound')} />;
    return <PictureMissing title={t('shell:sourcePicture.imageNotFound')} onRetry={() => setAttempt((value) => value + 1)} />;
  }
  const ready = loaded?.src === src;
  const reveal = async (node: HTMLImageElement) => {
    try { await node.decode() } catch { return }
    if (!thumbnail) markNativeSize(node);
    if (picture.current === node && node.getAttribute('src') === src) setLoaded({ src, alt });
  };
  return <>
    {ready || loaded ? null : thumbnail
      ? <span className="relative block h-full w-full skeleton-sheen" aria-label={t('shell:sourcePicture.loadingPreview')} />
      : <div data-jav-picture-wait="" data-skeleton="image" role="status" aria-label={t('shell:sourcePicture.loadingImage')}><span className="relative skeleton-sheen" /></div>}
    {!ready && loaded ? <img data-jav-picture={thumbnail ? undefined : ''} data-source-picture="" src={loaded.src}
      alt={loaded.alt} referrerPolicy="no-referrer" /> : null}
    <img ref={picture} data-jav-picture={thumbnail ? undefined : ''} data-source-picture="" src={src} alt={alt} referrerPolicy="no-referrer"
      hidden={!ready} onLoad={event => { void reveal(event.currentTarget) }} onError={() => setFailed(src)} />
  </>;
}
