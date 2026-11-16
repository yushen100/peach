import { avatarInner, type FaceRef } from '../../card-art/markup';
import { SourceAvatar } from './source-avatar';
import './table-column-filter.css';

/** 列头菜单复用卡片的实体取景、来源头像与首字回落。 */
export function ColumnFilterAvatar({ person, kind = 'performer' }: {
  person: FaceRef & { name: string; source_avatar?: boolean; source_actor_id?: string; avatar_code?: string };
  kind?: string;
}) {
  return person.source_avatar && person.source_actor_id && person.avatar_code && !person.has_image
    ? <span data-column-filter-avatar="" aria-hidden="true"><SourceAvatar code={person.avatar_code} person={person} /></span>
    : <span data-column-filter-avatar="" aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: avatarInner(person.name, person, null, kind) }} />;
}
