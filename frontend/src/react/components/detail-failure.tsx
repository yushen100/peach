/* 详情弹层整页都没取到时的那一屏：图标、一句标题、原因，加一颗次要的「立即重试」，居中、不套框。
 * 馆藏、番号、关注三种详情共用。整个弹层就这一样东西，再画红色横条或空卡片只会显得像出了大事。 */
import { RiErrorWarningLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from './empty-state';
import { busyProps } from '../settings/use-action';
import { t } from '../../i18n';

export function DetailFailure({ detail, busy, onRetry }: { detail: string; busy?: boolean; onRetry(): void }) {
  return <EmptyState framed={false} icon={RiErrorWarningLine} title={t('shell:detailFailure.title')}
    actions={<Button size="small" variant="secondary" {...busyProps(!!busy)} onClick={onRetry}>{t('shell:shared.retryNow')}</Button>}>
    {detail}</EmptyState>;
}
