import type { SVGProps } from 'react';
import { ChevronDownSmall } from '@/components/foundations/icons/chevrons';

export function MenuChevron(props: SVGProps<SVGSVGElement>) {
  return <ChevronDownSmall {...props} data-menu-chevron="" />;
}
