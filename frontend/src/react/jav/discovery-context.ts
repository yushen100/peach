import { RiCheckboxLine, RiExternalLinkLine, RiPlayLine, RiSearchLine, RiStarLine } from '@remixicon/react';
import type { WorkContextOperation } from '../components/work-context-menu';
import type { Discovery } from './jav';
import type { useJavSelection } from './jav-selection';
import { t } from '../../i18n';

export function discoveryContext(item: Discovery, options: {
  navigate(path: string): void; readOnly: boolean; wanting: boolean;
  onWant(): void; onResource(): void; selection: ReturnType<typeof useJavSelection>;
}) {
  const operations: WorkContextOperation[] = [
    { id: 'open', label: t('catalog:mediaActions.open'), icon: RiPlayLine,
      run: () => options.navigate(item.asset_id ? `/assets/${item.asset_id}` : `/works/${encodeURIComponent(item.code)}`) },
    { id: 'want', label: t(item.asset_id ? 'catalog:javWant.imported' : item.wanted ? 'catalog:javWant.wanted' : 'catalog:javWant.want'), icon: RiStarLine,
      disabled: options.readOnly || options.wanting || !!item.wanted || !!item.asset_id, run: options.onWant },
    { id: 'resource', label: t('catalog:shared.searchTorrents'), icon: RiSearchLine, run: options.onResource },
  ];
  if (item.link) operations.push({ id: 'source', label: t('catalog:shared.viewOnSite'), icon: RiExternalLinkLine,
    run: () => { window.open(item.link, '_blank', 'noopener,noreferrer') } });
  if (options.selection) operations.push({ id: 'select',
    label: t(options.selection.selected.has(item.code) ? 'catalog:mediaActions.deselect' : 'catalog:mediaActions.select'),
    icon: RiCheckboxLine, run: () => options.selection?.toggle(item) });
  return { key: item.code, operations };
}
