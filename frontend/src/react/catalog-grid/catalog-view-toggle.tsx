import { Radio } from 'react-aria-components';
import { RiLayoutGridLine, RiListUnordered } from '@remixicon/react';
import { SEGMENTED_GLASS_TRACK, SEGMENT_GLASS } from '../components/segmented';
import { GlassSegmentGroup } from '../components/glass-segments';
import { setCatalogView, useCatalogView } from './catalog-view';
import { t } from '../../i18n';

export function CatalogViewToggle() {
  const view = useCatalogView();
  return <GlassSegmentGroup aria-label={t('catalog:catalogList.viewMode')} orientation="horizontal" value={view} onChange={setCatalogView}
    data-entity-layout="" className={SEGMENTED_GLASS_TRACK}>
    <Radio value="cards" aria-label={t('catalog:catalogList.viewCards')} className={SEGMENT_GLASS} data-glass-segment="">
      <span title={t('catalog:catalogList.viewCards')} className="pointer-events-none contents"><RiLayoutGridLine aria-hidden="true" className="size-4" /></span>
    </Radio>
    <Radio value="list" aria-label={t('catalog:catalogList.viewList')} className={SEGMENT_GLASS} data-glass-segment="">
      <span title={t('catalog:catalogList.viewList')} className="pointer-events-none contents"><RiListUnordered aria-hidden="true" className="size-4" /></span>
    </Radio>
  </GlassSegmentGroup>;
}
