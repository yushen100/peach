import { useRef } from 'react';
import { Button } from '@/components/base/buttons/button';
import { RatingStars } from '../components/rating-stars';
import { ratingStars } from '../components/rating-values';
import { Note } from '../components/note';
import { useAction } from '../settings/use-action';
import { queryClient } from '../query';
import { utcDate } from '../time';
import { replaceCatalogItem } from './catalog-grid';
import type { MediaCardActions, MediaItem } from './types';
import { interfaceLanguage, t } from '../../i18n';

export function CatalogRating({ item, actions }: { item: MediaItem; actions: Pick<MediaCardActions, 'rate'> }) {
  const { rating } = item;
  const action = useAction();
  const lastStar = useRef(0);
  const score = ratingStars(rating);
  const label = rating == null ? t('catalog:ratingControl.unrated') : t('catalog:ratingControl.rated', { score });
  const apply = (rating: number | null) => {
    replaceCatalogItem(item.id, { rating });
    queryClient.setQueryData<MediaItem>(['item', item.id], cached => cached ? { ...cached, rating } : cached);
  };
  const rate = (star: number) => {
    lastStar.current = star;
    void action.run(String(star), signal => actions.rate(item, star, apply, signal), () => {});
  };
  return <div data-catalog-rating="" role="group" aria-label={label} title={label}>
    <RatingStars value={score} onRate={rate} busyStar={action.busy ? Number(action.busy) : undefined} />
    {action.error ? <Note tone="error" action={<Button variant="secondary" size="small" aria-label={t('catalog:ratingControl.retry')} onClick={() => rate(lastStar.current)}>{t('catalog:shared.retryNow')}</Button>}>
      {action.error}
    </Note> : null}
  </div>;
}

export function catalogTableDate(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = /^\d+(?:\.\d+)?$/.test(text) ? new Date(Number(text) * 1000) : utcDate(text);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(interfaceLanguage, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
