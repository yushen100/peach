import type { ReactNode } from 'react';
import { esc, firstGrapheme, icon, leadingGraphemes, registerEntityLink } from '@peach/legacy/core';
import { entityFaceImg, logoUrl } from '@peach/card-art';
import type { DetailEntityRef } from '../item-detail/item-detail';
import { entityDisplayName } from '../../core/entity-names';
import { useEntityNames } from '../use-entity-names';
import { UserCreatedChip } from './user-created-mark';
import { t } from '../../i18n';

/** 详情署名共用实体头像、厂牌标识与首字回退。 */
export function IdentityCell({ kind, person, onOpen, hidden, overflow, face }: {
  kind: string; person: DetailEntityRef; onOpen(kind: string, name: string): void;
  hidden?: boolean; overflow?: boolean; face?: ReactNode;
}) {
  useEntityNames();
  const displayName = entityDisplayName(kind, person.name, person.id);
  const image = kind === 'performer' || kind === 'creator'
    ? <span data-id-face="" dangerouslySetInnerHTML={{ __html: `<span>${esc(firstGrapheme(displayName))}</span>`
      + entityFaceImg({ kind, id: person.id, hasImage: person.has_image, version: person.image_version,
        focus: person.avatar_focus, rep: person.has_avatar ? person.rep : null, standIn: person.avatar_stand_in }) }} />
    : <span data-id-face=""><span>{kind === 'studio' ? leadingGraphemes(person.name, 2) : firstGrapheme(person.name)}</span>
      {kind === 'studio' && person.has_logo ? <img src={logoUrl(person.name, 'icon', person.logo_version)} alt="" width={128} height={128} loading="lazy" decoding="async" data-drop="self" /> : null}</span>;
  /* 用户自建的档案（ADR-0165）在头像底边挂「自建」小标签；名字一栏窄、会截省略号，放在那里会被一起裁掉。 */
  const mark = person.user_created ? <UserCreatedChip data-id-badge="" /> : null;
  const content = <>{face ?? image}{mark}<span data-id-name="">{displayName}</span></>;
  const attrs = { 'data-id-cell': kind, title: displayName, hidden, 'data-castoverflow': overflow ? '' : undefined };
  return person.id ? <button type="button" {...attrs} data-entity-kind={kind} data-entity-name={person.name}
    onClick={() => { registerEntityLink(kind, person.name, person.id); onOpen(kind, person.name) }}>{content}</button> : <span {...attrs}>{content}</span>;
}

export function IdentitySeries({ people, onOpen }: {
  people: readonly DetailEntityRef[]; onOpen(kind: string, name: string): void;
}) {
  if (!people.length) return null;
  const content = (person: DetailEntityRef) => <><span className="contents" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon('tags') }} /><span>{person.name}</span>
    {person.user_created ? <UserCreatedChip className="ms-1.5" /> : null}</>;
  return <section data-id-group="series"><h5 data-id-label="">{t('shell:shared.series')}</h5><div data-series-rows="">
    {people.map(person => person.id ? <button key={person.name} type="button" data-series-link="" data-entity-kind="series"
      data-entity-name={person.name} title={person.name} onClick={() => { registerEntityLink('series', person.name, person.id); onOpen('series', person.name) }}>{content(person)}</button>
      : <span key={person.name} data-series-link="" title={person.name}>{content(person)}</span>)}
  </div></section>;
}
