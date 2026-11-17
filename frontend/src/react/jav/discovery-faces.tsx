import { avatarInner } from '../../card-art/markup';
import { entityPath } from '@peach/legacy/core';
import { SourceAvatar } from '../components/source-avatar';
import { entityDisplayName } from '../../core/entity-names';
import { useEntityNames } from '../use-entity-names';
import type { Discovery } from './jav';

/** 发现人物使用馆藏的共演头像几何与悬停动作。 */
export function DiscoveryFaces({ item }: { item: Discovery }) {
  useEntityNames();
  const people: NonNullable<Discovery['performer_refs']> = item.performer_refs?.length ? item.performer_refs
    : [...new Set(item.performers.split(/[,，、;/]/).filter(Boolean))].map(name => ({ name }));
  const faces = people.slice(0, 5).map((person, index) => {
    const style = { '--media-avatar-index': index } as CSSProperties;
    const face = person.source_avatar && person.source_actor_id && !person.has_image && !person.has_avatar
      ? { children: <SourceAvatar code={item.code} person={person} /> }
      : { dangerouslySetInnerHTML: { __html: avatarInner(person.name, person, null) } };
    return person.id
      ? <a key={person.name} data-media-avatar="" style={style} href={entityPath('performer', person.name, person.id)} aria-label={t('catalog:javDiscovery.openActress', { name: entityDisplayName('performer', person.name, person.id) })} {...face} />
      : <span key={person.name} data-media-avatar="" style={style} title={entityDisplayName('performer', person.name)} {...face} />;
  });
  return people.length > 1 ? <div data-media-avatars="" style={{ '--media-avatar-count': Math.min(5, people.length) } as CSSProperties}>{faces}</div> : faces[0] || null;
}
import type { CSSProperties } from 'react';
import { t } from '../../i18n';
