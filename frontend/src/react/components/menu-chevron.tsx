import type { SVGProps } from 'react';
import { ChevronDownSmall } from '@/components/foundations/icons/chevrons';
import { cx } from '@/utils/cx';

export function MenuChevron({ className, ...props }: SVGProps<SVGSVGElement>) {
  return <ChevronDownSmall {...props} className={cx('peach-menu-chevron transition-transform duration-200 ease', className)} />;
}
