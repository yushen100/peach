import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cardArtwork, frameArtwork } from '@peach/card-art';

import { Button } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { RiArrowRightLine, RiCloseLine } from '@remixicon/react';
import { cx } from '@/utils/cx';

import { apiSend, errorMessage } from '../../api';
import type { MediaItem } from '../catalog-grid/types';
import { Note } from '../components/note';
import { queryClient } from '../query';
import {
  DISCONNECTED_TEXT, fetchLibraryProcessing, LIBRARY_PROCESSING_KEY, LIBRARY_PROCESSING_URL,
  processingActive, type LibraryProcessingCommand, type LibraryProcessingData,
} from './library-processing';
import { ProcessingActions } from './processing-actions';
import { confirmMeteredPreviews, startPreviews } from './metered-previews';
import { busyProps } from '../settings/use-action';
import { jobText } from '../../core/server-text';
import { t } from '../../i18n';
import { appSettingsStore } from '../../appearance/settings';

/** 缺图判据与卡面一致；没开流量保护的影片可抽帧，有番号的影片可补发行封面。 */
type PreviewItem = Pick<MediaItem, 'id' | 'name' | 'medium' | 'disposal' | 'location' | 'cost' | 'code' | 'is_jav'
  | 'has_cover' | 'cover_key' | 'has_thumb' | 'has_local_poster' | 'follow_thumb_url'>;

/** 卡面画不画得出来。`frames` 是竖屏格（竖屏带与筛竖屏的网格）：那里番号作品也只用视频帧，
 *  不借官方封面，判据同 `media-card.tsx` 的 `frameOnly`。 */
const pictured = (item: PreviewItem, javImage: string, frames: boolean) =>
  Boolean((frames && item.is_jav ? frameArtwork(item, false) : cardArtwork(item, 'small', false, javImage)).html);

/** 同步能补上图的缺图影片。番号作品补得到发行封面，所以 STRM 与流量保护目录里的也算；竖屏格
 *  要的是视频帧，封面画不进去，番号就不再替它们开脱。 */
export function missingPreviewIds(items: PreviewItem[], javImage: string, frames = false): number[] {
  const cover = (item: PreviewItem) => !frames && !!item.code;
  return [...new Set(items.filter(item => (!item.medium || item.medium === 'video')
    && (!/\.(strm|iso)$/i.test(item.name || '') || cover(item))
    && !item.disposal && item.location !== 'online' && (item.cost !== 'metered' || cover(item))
    && !pictured(item, javImage, frames)).map(item => item.id))];
}

/** 这一屏里没有图、开了流量保护的影片：同步时不读，单独一批、确认后才补预览。 */
export function meteredPreviewIds(items: PreviewItem[], javImage: string, frames = false): number[] {
  return [...new Set(items.filter(item => (!item.medium || item.medium === 'video')
    && !/\.(strm|iso)$/i.test(item.name || '')
    && !item.disposal && item.location !== 'online' && item.cost === 'metered'
    && !pictured(item, javImage, frames)).map(item => item.id))];
}

/** 单独一行；`className` 交给所在布局定外边距，列表页由父级间距负责。`meteredIds` 是开了流量保护、
 *  同步不读的那一批，和可同步的那批合在同一条里，多一颗先确认再只为它们补预览的次要按钮。
 *  条上的关闭钮写本机偏好 `completionPrompt`，网格、列表与详情里的这一条一起收起，设置里可以再打开。 */
export function LibraryCompletionPrompt({ assetIds, meteredIds = [], onComplete, className = 'mb-4' }: {
  assetIds: number[]; meteredIds?: number[]; onComplete?(): void; className?: string;
}) {
  const settings = appSettingsStore();
  useSyncExternalStore(settings.subscribe, settings.version);
  if (settings.value.completionPrompt === false || (!assetIds.length && !meteredIds.length)) return null;
  return <Completion assetIds={assetIds} meteredIds={meteredIds} onComplete={onComplete} className={className} />;
}

function Completion({ assetIds, meteredIds, onComplete, className }: {
  assetIds: number[]; meteredIds: number[]; onComplete?(): void; className: string;
}) {
  /* 只读缓存：这个键的轮询由壳里常驻的停靠栏一处驱动（`use-library-processing.ts`）。 */
  const job = useQuery({ queryKey: LIBRARY_PROCESSING_KEY,
    queryFn: ({ signal }) => fetchLibraryProcessing(signal) });
  const [started, setStarted] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');
  const completed = useRef<string | null>(null);
  const start = useMutation({
    mutationFn: (command: LibraryProcessingCommand | 'metered') => command === 'metered'
      ? startPreviews(meteredIds, true)
      : apiSend<LibraryProcessingData>(LIBRARY_PROCESSING_URL, { ...command, asset_ids: assetIds }),
    onSuccess: next => {
      setStarted(next.job_id || null);
      queryClient.setQueryData(LIBRARY_PROCESSING_KEY, next);
      void queryClient.invalidateQueries({ queryKey: LIBRARY_PROCESSING_KEY });
    },
  });
  const state = job.data;
  useEffect(() => {
    if (!state || !started || state.job_id !== started || processingActive(state)
      || completed.current === started) return;
    completed.current = started;
    if (state.status === 'complete') {
      setOutcome(t('manage:completionPrompt.done', { count: state.covers || 0, previews: state.previews || 0 }));
    }
    void queryClient.invalidateQueries({ queryKey: ['catalog-grid'] });
    onComplete?.();
  }, [state, started, onComplete]);
  // 运行时保留缺图数量；新范围等待当前任务结束，不隐式追加或替换。
  const busy = start.isPending || processingActive(state);
  const problem = start.error ? errorMessage(start.error) : job.error ? DISCONNECTED_TEXT
    : started && state?.job_id === started && state.status === 'failed' ? jobText(state, 'error') || t('manage:completionPrompt.failed') : '';
  const later = processingActive(state) ? t('manage:completionPrompt.afterCurrentTask') : '';
  const total = new Set([...assetIds, ...meteredIds]).size;
  const metered = meteredIds.length;
  const summary = !assetIds.length
    ? t('manage:completionPrompt.allMetered', { count: metered, tail: later || t('manage:completionPrompt.tailPreviews') })
    : metered
      ? t('manage:completionPrompt.someMetered', { count: total, metered, tail: later || t('manage:completionPrompt.tailMetadata') })
      : t('manage:completionPrompt.noPreviews', { count: total, tail: later || t('manage:completionPrompt.tailMetadata') });
  const message = problem || (start.isPending ? t('manage:completionPrompt.starting') : outcome || summary);
  const meteredRun = async () => {
    if (busy || !await confirmMeteredPreviews(meteredIds.length)) return;
    setOutcome('');
    start.mutate('metered');
  };
  const blocked = state?.metadata_only ? t('manage:completionPrompt.previewsDisabled') : '';
  const dismiss = () => { const settings = appSettingsStore(); settings.value.completionPrompt = false; settings.save() };
  // 主按钮在最右：两批都有时「同步这些影片」是主操作，流量保护那批是它左边的次要按钮。
  return <section aria-label={t('manage:completionPrompt.regionLabel')} aria-live="polite" data-library-completion="" className={cx('@container', className)}>
    <Note tone={problem ? 'warning' : 'neutral'} action={<div className="flex flex-wrap items-center gap-2">
      {meteredIds.length ? <Button variant={assetIds.length ? 'secondary' : 'primary'} disabled={!!blocked}
        title={blocked || undefined} {...busyProps(busy)} onClick={() => { void meteredRun() }}>
        {assetIds.length ? t('manage:completionPrompt.fillMetered', { count: metered }) : t('manage:completionPrompt.fillThese', { count: metered })}</Button> : null}
      {assetIds.length ? <ProcessingActions busy={busy} metadataOnly={state?.metadata_only} onRun={command => {
        if (busy) return;
        setOutcome('');
        start.mutate(command);
      }} /> : null}
      <Button variant="ghost" size="small" iconOnly leadingIcon={RiCloseLine} data-completion-dismiss=""
        aria-label={t('manage:completionPrompt.dismiss')} title={t('manage:completionPrompt.dismiss')} onClick={dismiss} />
    </div>}>
      {message}{' '}<LinkButton href="/data-cleanup#libraryProcessing" size="small" trailingIcon={RiArrowRightLine}>
      {problem ? t('manage:completionPrompt.openScanFetch') : t('manage:completionPrompt.viewDetails')}
    </LinkButton></Note>
  </section>;
}
