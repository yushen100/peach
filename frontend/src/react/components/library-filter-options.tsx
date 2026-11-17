import { useQuery } from '@tanstack/react-query';
import { fetchMediaSources, MEDIA_SOURCES_KEY } from '../media-sources';
import { useLibraryTints } from './library-tint';
import { SourceMark } from '../settings/section';
import { t } from '../../i18n';
import type { ColumnFilterOption } from './table-column-filter';

/** 媒体库菜单与侧栏共用根目录探测结果，所有根明确离线时置灰。 */
export function useLibraryFilterOptions(enabled = true): ReadonlyMap<string, ColumnFilterOption> {
  const libraries = useLibraryTints({ names: enabled });
  const sources = useQuery({ queryKey: MEDIA_SOURCES_KEY, queryFn: ({ signal }) => fetchMediaSources(signal), enabled });
  return new Map([...libraries.values()].filter(library => library.name).map(library => {
    const offline = !!library.roots?.length && library.roots.every(root => {
      const source = sources.data?.sources.find(source => source.location === root.location);
      const status = root.root_id ? source?.roots?.find(status => status.root_id === root.root_id) : source;
      return status?.online === false;
    });
    return [library.id, { id: library.id, label: library.name, disabled: offline,
      title: offline ? t('shell:sourceTools.libraryOffline') : undefined,
      leading: <SourceMark mark={library.icon} /> }];
  }));
}
