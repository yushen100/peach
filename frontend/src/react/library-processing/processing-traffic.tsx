import { fmtSize } from '@peach/legacy/core';
import { useId, useState } from 'react';
import { RiGlobalLine, RiHardDrive3Line } from '@remixicon/react';
import { MenuChevron } from '../components/menu-chevron';
import { Button } from '@/components/base/buttons/button';
import type { ProcessingTraffic } from './library-processing';
import { cx } from '@/utils/cx';
import { CollapseRegion } from '../components/collapse-region';
import { useOverlayScrollbar } from '../components/overlay-scrollbar';
import { SourceLabel } from '../components/source-label';
import { SourceMark } from '../settings/section';
import { codedText } from '../../core/server-text';
import { t } from '../../i18n';

const size = (value: number) => fmtSize(value).replace(/\s/g, '');
const averageSize = (value: number) => value >= 1024 ** 2 && value < 1024 ** 3
  ? `${Number((value / 1024 ** 2).toFixed(1))}MB` : size(value);
const range = (low: number, high: number) => {
  if (low === high) return size(high);
  const [start, startUnit] = fmtSize(low).split(' ');
  const [end, endUnit] = fmtSize(high).split(' ');
  return startUnit === endUnit ? `${start}-${end}${endUnit}` : `${size(low)}-${size(high)}`;
};
const forecast = (expected: number | undefined, low: number, high: number) => expected === undefined
  ? range(low, high) : expected > 0 ? t('manage:processingTraffic.approxSize', { size: size(expected) }) : size(expected);

/** 确认弹窗、任务卡和管理页共用逐目录分账。`compact` 时只留文件计数与完整性提示，
 *  流量、占用与逐目录明细随任务卡一起收起。 */
export function TrafficProgress({ traffic, initial = false, compact = false, detailsOpen, onDetailsChange }: {
  traffic?: ProcessingTraffic; initial?: boolean; compact?: boolean; detailsOpen?: boolean; onDetailsChange?(open: boolean): void;
}) {
  const list = useOverlayScrollbar<HTMLUListElement>();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const open = detailsOpen ?? expanded;
  if (!traffic) return null;
  const counted = !!traffic.workload || !!(traffic.inventory && !traffic.inventory.complete)
    || !!(traffic.unknown_files && traffic.inventory?.complete !== false) || !!traffic.inventory?.errors;
  /* 计数与预估之间的间距放进折叠区里层：写成外层的 gap，收起过渡走完那一刻会再跳一下。 */
  return <div data-processing-traffic="" className="flex min-w-0 flex-col text-caption-1-regular text-text-secondary tabular-nums wrap-anywhere">
    <div className="flex min-w-0 flex-col gap-2 empty:hidden">
    {traffic.workload ? <p className="flex flex-wrap gap-x-3 gap-y-1">
      <span>{t(traffic.unknown_files ? 'manage:processingTraffic.videosFoundCount' : 'manage:processingTraffic.videosInScopeCount', { count: traffic.workload.video_files })}</span>
      <span>{t('manage:processingTraffic.javFilesCount', { count: traffic.workload.jav_files })} · {t('manage:processingTraffic.uniqueCodesCount', { count: traffic.workload.jav_titles })}</span>
    </p> : null}
    {traffic.inventory && !traffic.inventory.complete ? <p role="status">{t('manage:processingTraffic.inventoryRunning')}</p> : null}
    {traffic.unknown_files && traffic.inventory?.complete !== false ? <p role="status">{t('manage:processingTraffic.unknownFiles')}</p> : null}
    {traffic.inventory?.errors ? <p role="status">{t('manage:processingTraffic.unreadableDirs')}</p> : null}
    </div>
    <CollapseRegion open={!compact} data-processing-estimate=""><div className={cx('flex min-w-0 flex-col gap-2', counted && 'pt-2')}>
    <div className="inline-grid grid-cols-2 gap-6 py-2">
      <section aria-label={t('manage:processingTraffic.dataUsageLabel')} className="flex min-w-0 flex-col gap-1">
        <p className="inline-flex items-center gap-1.5"><RiGlobalLine aria-hidden className="size-(--icon-inline) shrink-0" />
          {traffic.inventory && !traffic.inventory.complete ? t('manage:processingTraffic.dataUsageKnown') : t('manage:processingTraffic.dataUsageEstimated')}</p>
        <p className="text-title-3-semibold text-text-primary">{forecast(traffic.estimated_bytes, traffic.estimated_min_bytes, traffic.estimated_max_bytes)}</p>
        <p>{traffic.unknown_route_estimated_bytes ? t('manage:processingTraffic.confirmedProxy') : t('manage:shared.proxy')} {forecast(traffic.metered_estimated_bytes, traffic.metered_estimated_min_bytes, traffic.metered_estimated_max_bytes)}</p>
        {!initial ? <p>{t('manage:processingTraffic.usedWithProxy', {
          used: traffic.partial ? t('manage:processingTraffic.approxSize', { size: size(traffic.used_bytes) }) : size(traffic.used_bytes),
          proxy: size(traffic.metered_used_bytes),
        })}</p> : null}
      </section>
      {traffic.disk ? <section aria-label={t('manage:processingTraffic.diskLabel')} className="flex min-w-0 flex-col gap-1">
        <p className="inline-flex items-center gap-1.5"><RiHardDrive3Line aria-hidden className="size-(--icon-inline) shrink-0" />
          {traffic.inventory && !traffic.inventory.complete ? t('manage:processingTraffic.diskKnown') : t('manage:processingTraffic.diskEstimated')}</p>
        <p className="text-title-3-semibold text-text-primary">{t('manage:processingTraffic.approxSize', { size: size(traffic.disk.estimated_bytes) })}</p>
        {traffic.disk.temporary_bytes > 0 ? <p>{t('manage:processingTraffic.tempFilesSize', { size: averageSize(traffic.disk.temporary_bytes) })}</p> : null}
        {traffic.disk.volumes.map(volume => <div key={volume.path} className="flex min-w-0 flex-col gap-1">
          <p>{volume.free_bytes == null ? t('manage:processingTraffic.volumeFreeUnknown', { path: volume.path })
            : t('manage:processingTraffic.volumeFree', { path: volume.path, size: size(volume.free_bytes) })}</p>
          {volume.can_fit === false ? <p role="status">{t('manage:processingTraffic.shortfallSize', { size: size(volume.shortfall_bytes || 0) })}</p> : null}
        </div>)}
        {traffic.disk.cache_unknown ? <p role="status">{t('manage:processingTraffic.cacheUnknown')}</p> : null}
      </section> : null}
    </div>
    <Button variant="secondary" size="small" className="self-start" aria-expanded={open} aria-controls={detailsId}
      trailingIcon={MenuChevron} onClick={() => {
        setExpanded(!open);
        onDetailsChange?.(!open);
      }}>{open ? t('manage:processingTraffic.hideBreakdown') : t('manage:processingTraffic.showBreakdown')}</Button>
    <div id={detailsId} hidden={!open}>
      <div className="relative min-w-0">
      <ul ref={initial ? undefined : list} className={`flex flex-col pr-2${initial ? '' : ' max-h-48 overflow-y-auto overscroll-contain'}`}>
        {traffic.sources.map(source => <li key={source.key} className="flex min-w-0 flex-col gap-1 border-b border-separator-border py-2 last:border-b-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            {source.root ? <SourceLabel source={source.location} label={source.label} />
              : <span className="inline-flex min-w-0 items-center gap-1.5"><SourceMark mark="globe" />{codedText(source, 'label')}</span>}
            <span className="shrink-0">{source.connection === 'system' ? t('manage:processingTraffic.connectionSystem') : source.connection === 'unknown' ? t('manage:processingTraffic.connectionUnknown') : source.metered ? t('manage:shared.proxy') : t('manage:processingTraffic.connectionDirect')}</span>
          </div>
          {source.workload?.video_files ? <p className="text-text-tertiary">{t('manage:processingTraffic.sourceVideoCount', { count: source.workload.video_files })} · {t('manage:processingTraffic.sourceJavCount', { count: source.workload.jav_files })}</p> : null}
          {source.workload?.pending_jav_titles ? <p className="text-text-tertiary">{t('manage:processingTraffic.pendingMetadataCount', { count: source.workload.pending_jav_titles, size: averageSize(source.workload.metadata_average_bytes || 0) })}</p> : null}
          <div className="flex flex-wrap justify-between gap-x-4 text-text-tertiary">
            {!initial ? <span>{t(source.unobserved.length ? 'manage:processingTraffic.usedApproxSize' : 'manage:processingTraffic.usedSize', { size: size(source.used_bytes) })}</span> : null}
            <span>{t('manage:processingTraffic.estimatedSize', { size: forecast(source.estimated_bytes, source.estimated_min_bytes, source.estimated_max_bytes) })}</span>
          </div>
        </li>)}
      </ul>
      </div>
    </div>
    </div></CollapseRegion>
  </div>;
}
