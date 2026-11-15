/* 实体资料页顶上那块资料卡，连同资料卡下面、作品上面那一行未入库的新作。
 *
 * 资料卡按 Board 的 profile 卡排：一块 secondary 底、18px 圆角的卡，正文是头像加身份三行
 * （名字、别名与归属、外链），女优有资料时右边再加一栏资料表，同台艺人收进卡底那条色阶带——
 * 那是这个人的附注，不是这一页的正文。卡外面的交集条、筛选条与内容区仍归壳。
 *
 * 头像、同台艺人的脸和新作卡是拼好的 HTML（大位与新作卡由壳给，同台艺人的脸取自 `@peach/card-art`）：
 * 取图失败时兜底链（`card-art/image-fallback.ts`）会把 `<img>`
 * 从 DOM 里摘掉、人脸放大（`avatarFrame`）往图上写内联尺寸、等待微光挂在图的父元素上，这几样
 * 都直接改节点，所以那几格用 `dangerouslySetInnerHTML`，React 不拥有里面的节点。 */
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { entityFaceImg, facePos } from '@peach/card-art';
import { entityPath, esc, firstGrapheme, icon } from '@peach/legacy/core';
import { textLang } from '../../core/text-lang';
import { entityDisplayName, nameLanguage } from '../../core/entity-names';
import { useEntityNames } from '../use-entity-names';

import { Button } from '@/components/base/buttons/button';

import { AvatarPicker } from '../avatar-picker/avatar-picker-page';
import { Note } from '../components/note';
import { PendingWork } from '../components/pending-work';
import { FavoriteButton } from '../library-shortcuts/shortcut-controls';
import { busyProps } from '../settings/busy-props';
import { FeedNewRow } from '../feed-new/feed-new-row';
import { Glyph } from './glyph';
import { FeedSwitch, MorePop } from './hero-pop';
import { NamePicker } from './name-picker';
import {
  COMPANY_ALIASES_SHOWN, agencyOf, companyFactRows, entityFeedTip, entryMarks, factRows, heroLinks, isCompany, isPeople, nameChoices, nameLine, shownTags,
  type EntityHeroActions, type EntityHeroData, type EntityHeroHelpers, type EntityHeroProps,
  type HeroCostar, type HeroFollow, type LinkMark, type LinkView,
} from './entity-hero';
import { codedText, serverLabels } from '../../core/server-text';
import { interfaceLanguage, t } from '../../i18n';

/** 译文里数字的占位记号：`{{num}}` 先代入它，再按它切开放进 `<b>`。 */
const NUM_MARK = '\u0001';

/** 数字加粗的计数：`text` 是用 `{ count, num: NUM_MARK }` 取好的译文，`{{num}}` 的位置换成 `<b>`；
 *  单复数仍按 `count` 选，英文语序由译文决定。 */
function BoldCount({ text, count }: { text: string; count: number }) {
  const [before, after = ''] = text.split(NUM_MARK);
  return <>{before}<b>{count.toLocaleString(interfaceLanguage)}</b>{after}</>;
}

/** 同台艺人圆框里那张图：实体图优先，退到代表作头像，按检出的人脸取景。 */
function costarImg(person: HeroCostar): string {
  return entityFaceImg({
    id: person.id, hasImage: person.has_image, version: person.image_version, rep: person.has_avatar ? person.rep : null,
    style: facePos(person.avatar_focus), focus: person.avatar_focus, standIn: person.avatar_stand_in,
  });
}

export function EntityHeroPage({ kind, name, entity, feedNew, feedHost, feedError, retryFeed, actions, helpers }: EntityHeroProps) {
  useEntityNames();
  const displayName = entityDisplayName(kind, entity.canonical_name, Number(entity.id));
  const people = isPeople(kind);
  const company = isCompany(kind);
  const facts = people ? factRows(entity.profile) : company ? companyFactRows(entity.company_profile) : [];
  const links = heroLinks(entity, kind);
  const marks = entryMarks(entity);
  const costars = kind === 'agency' ? [] : (entity.related_performers || []);
  const linkRow = useRef<HTMLDivElement>(null);
  const costarRow = useRef<HTMLDivElement>(null);
  /* 同台艺人与窄屏那排外链都是 `overflow-x:auto` 加隐藏滚动条：能滚，但鼠标没有一个够得着的
     入口，所以登记全站横向行那套拖动加滚轮映射。外链那排宽屏下换行，组件量得出不溢出。 */
  useEffect(() => { helpers.wireScroller(linkRow.current) }, [helpers, links.length]);
  useEffect(() => { helpers.wireScroller(costarRow.current) }, [helpers, costars.length]);

  return (
    <>
      <section data-entity-card="" aria-label={t('catalog:entityHero.profile')}>
        <div data-entity-profile={facts.length ? 'facts' : ''}>
          <div data-entity-portrait-wrap="">
            <Portrait kind={kind} name={displayName} helpers={helpers} people={people} company={company} />
            {people && entity.id ? (
              <span data-avatar-picker="">
                <AvatarPicker kind={kind} entityId={Number(entity.id)} name={displayName || name}
                  onPicked={actions.avatarPicked} />
              </span>
            ) : null}
          </div>
          <div data-entity-identity="">
            <div data-entity-title="">
              <h2 lang={textLang(displayName)}>{displayName}</h2>
              {kind !== 'tag' ? <NamePicker current={entity.canonical_name} choices={nameChoices(entity, nameLanguage())}
                onChoose={actions.chooseName} onAddAlias={actions.addAlias} onMerge={actions.mergeDuplicate} /> : null}
              {entity.id ? <FavoriteButton item={{ entity_id: Number(entity.id), kind, name: entity.canonical_name || name, favorite: entity.favorite }} /> : null}
            </div>
            <PendingWork work={entity.pending_work} />
            <AliasLine kind={kind} entity={entity} actions={actions} />
            {entity.related_identities?.length ? (
              <div className="flex min-w-0 flex-wrap gap-2 text-caption-1-regular text-text-secondary">
                {/* 账号名常是一长串无空格的英文，窄屏下得能在任意处折行。 */}
                {entity.related_identities.map((identity) => {
                  const name = entityDisplayName(identity.kind, identity.canonical_name, identity.id);
                  const text = identity.relation === 'same_person' ? t('catalog:entityHero.samePersonIdentity', { name }) : t('catalog:entityHero.linkedAccount', { name });
                  return (
                    <button type="button" key={identity.id} title={text}
                      className="min-w-0 max-w-full text-text-primary underline wrap-anywhere"
                      onClick={() => actions.openEntity(identity.kind, identity.canonical_name)}>
                      {text}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {links.length ? (
              <div ref={linkRow} data-entity-links="">{links.map((link, at) => <HeroLinkView key={at} link={link} />)}</div>
            ) : null}
            {marks.length || entity.feed ? <EntryMarks entity={entity} actions={actions} helpers={helpers} /> : null}
            {entity.follow?.held.length ? <HeldAuthors follow={entity.follow} displayName={displayName} actions={actions} /> : null}
          </div>
          {facts.length ? (
            <dl data-entity-facts="">
              {facts.map((row) => (
                <FactRowView key={row.label} glyph={row.glyph} label={row.label} clip={row.clip}>
                  {row.tags ? <FactTags tags={row.tags} />
                    : row.parts.map((part, at) => (
                      <span key={at} data-fact-tone={part.tone === 'plain' ? undefined : part.tone}>
                        {at ? ' ' : ''}{part.text}
                      </span>
                    ))}
                </FactRowView>
              ))}
            </dl>
          ) : null}
        </div>
        {costars.length ? (
          <div data-entity-foot="" aria-label={t('catalog:entityHero.costars')}>
            <div ref={costarRow} data-related-people="">
              {costars.map((person) => (
                <button key={person.k} type="button" data-related-performer={person.k}
                  onClick={() => actions.openEntity('performer', person.k)}>
                  <span data-hero-ring="" dangerouslySetInnerHTML={{
                    __html: `<span>${esc(firstGrapheme(entityDisplayName('performer', person.k, person.id)))}</span>${costarImg(person)}` }} />
                  <span data-hero-costar-name="">{entityDisplayName('performer', person.k, person.id)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      {/* 新作那一行摆在壳留好的 `section.feednew[data-feed-new]` 里，与首页那一行同一个组件。 */}
      {feedHost ? createPortal(<FeedNewRow feedNew={feedNew} host={feedHost} wire={helpers.wireFeedRow}
        act={(feedId, action) => actions.feedAction(feedId, action)} error={feedError} retry={retryFeed} />, feedHost) : null}
    </>
  );
}

/** 大位：公司取自己的标识（方框），人取实体图或代表作头像（圆框）；一环都取不到就只剩首字母。 */
function Portrait({ kind, name, helpers, people, company }: {
  kind: string; name: string; helpers: EntityHeroHelpers; people: boolean; company: boolean;
}) {
  /* 图只拼一次：兜底链摘掉的 `<img>`、人脸放大写进去的尺寸都留在节点上，重画时不能按
     同一段 HTML 再盖回去（`dangerouslySetInnerHTML` 只在字符串变了时才重写）。 */
  const portrait = useRef<HTMLDivElement>(null);
  const [html] = useState(() => `${helpers.portraitImg()}<span data-portrait-initial="">${esc(firstGrapheme(name))}</span>`);
  useLayoutEffect(() => {
    const initial = portrait.current?.querySelector('[data-portrait-initial]');
    if (initial) initial.textContent = firstGrapheme(name);
    for (const image of portrait.current?.querySelectorAll<HTMLImageElement>('img[alt]') || []) {
      if (image.alt) image.alt = name;
    }
  }, [name]);
  return (
    <div data-entity-portrait={people ? 'round' : 'square'} data-fit-native={company ? 'mark' : 'portrait'}
      ref={portrait} data-entity-kind={kind} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** 身份资料各项带图标；别名独立排列，归属有实体时提供站内入口。 */
function AliasLine({ kind, entity, actions }: { kind: string; entity: EntityHeroData; actions: EntityHeroActions }) {
  const agency = agencyOf(entity);
  const go = (target: string, to: string) => (event: MouseEvent) => {
    event.preventDefault();
    actions.openEntity(target, to);
  };
  const agencyNode = agency ? (agency.linked
    ? <a href={entityPath('agency', agency.name, agency.id)} data-agency={agency.name} onClick={go('agency', agency.name)}>{agency.name}</a>
    : agency.name) : null;
  const count = <BoldCount text={t('catalog:entityHero.videoCountBold', { count: entity.asset_count, num: NUM_MARK })} count={entity.asset_count} />;
  if (kind === 'performer' || kind === 'creator') {
    const groups = entity.name_display?.groups[nameLanguage()] ?? entity.name_groups;
    const line = nameLine(groups);
    return (
      <div data-entity-alias="meta">
        <IdentityMeta entity={entity} />
        <span data-meta-item="" title={t('catalog:shared.videos')}><Glyph name="film" /><span>{count}</span></span>
        {entity.follow?.key ? <FollowMeta follow={entity.follow} actions={actions} /> : null}
        {agencyNode ? <span data-meta-item="" title={t('catalog:shared.agencies')}><Glyph name="briefcase" /><span>{agencyNode}</span></span> : null}
        {line ? (
          <div data-meta-item="names">
            <Glyph name="id-card" />
            <span data-alias-names="" title={t('catalog:entityHero.aliases')}>{line.names.map((one, at) => <span key={at} lang={textLang(one)}>{one}</span>)}</span>
            {line.rest > 0 ? (
              <MorePop id="entityAliasPop" hook="alias" rest={line.rest} label={t('catalog:entityHero.moreAliases', { count: line.rest })}
                heading={t('catalog:entityHero.aliasCount', { count: line.total })}>
                <dl>
                  {(groups?.groups || []).map((group, at) => (
                    <NameGroup key={at} label={codedText(group, 'label')} names={group.names} />
                  ))}
                </dl>
              </MorePop>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  const aliases = entity.display_aliases || [];
  /* 事务所页数的是人，不是片；片商页同理，旗下有几个 label 是它自己的读数（ADR-0051）。 */
  const members = kind === 'agency'
    ? <> · <BoldCount text={t('catalog:entityHero.performerCountBold', { count: entity.member_count || 0, num: NUM_MARK })} count={entity.member_count || 0} /></>
    : (entity.labels || []).length
      ? <> · <BoldCount text={t('catalog:entityHero.labelCountBold', { count: entity.labels!.length, num: NUM_MARK })} count={entity.labels!.length} /></> : null;
  const maker = entity.maker;
  return (
    <div data-entity-alias="meta">
      {kind === 'creator' ? <IdentityMeta entity={entity} /> : null}
      <span data-meta-item="" title={t('catalog:shared.videos')}><Glyph name="film" /><span>{count}{members}</span></span>
      {agencyNode ? <span data-meta-item="" title={t('catalog:shared.agencies')}><Glyph name="briefcase" /><span>{agencyNode}</span></span> : null}
      {maker ? <span data-meta-item="" title={t('catalog:entityHero.studio')}><Glyph name="clapperboard" /><a href={entityPath('studio', maker.name, maker.id)} data-studio-link={maker.name}
        onClick={go('studio', maker.name)}>{maker.name}</a></span> : null}
      {aliases.length ? <CompanyAliases aliases={aliases} /> : null}
    </div>
  );
}

/** 公司别名：先列几个，余下的收进「+N」，浮层里一个名字一行。片商改过几轮名、挂过一串
 *  label 时别名能有三十多个，全摊开会占掉资料卡十几行。 */
function CompanyAliases({ aliases }: { aliases: string[] }) {
  const { shown, rest } = shownTags(aliases, COMPANY_ALIASES_SHOWN);
  return (
    <div data-meta-item="names" data-company-names="">
      <Glyph name="id-card" />
      <span data-alias-names="" title={t('catalog:entityHero.aliases')}>{shown.map((name, at) => <span key={at}>{name}</span>)}</span>
      {rest ? (
        <MorePop id="entityAliasPop" hook="alias" rest={rest} label={t('catalog:entityHero.moreAliases', { count: rest })}
          heading={t('catalog:entityHero.aliasCount', { count: aliases.length })}>
          <dl><NameGroup names={aliases.map((name) => ({ name }))} /></dl>
        </MorePop>
      ) : null}
    </div>
  );
}

/** 关注里绑在这位名下的来源：读数是还没入库的更新，整段是站内去处（同事务所链接的钨蓝），
 *  点开切到这一页的在线视图。 */
function FollowMeta({ follow, actions }: { follow: HeroFollow; actions: EntityHeroActions }) {
  const from = follow.providers.join(' · ');
  return (
    <span data-meta-item="" data-entity-follow="" title={from ? t('catalog:entityHero.followingFrom', { source: from }) : t('catalog:entityHero.following')}>
      <Glyph name="rss" />
      <a href="?media=online" onClick={(event) => { event.preventDefault(); actions.openFollowAuthor(follow.key) }}>
        {t('catalog:entityHero.updateCount', { count: follow.n })}
      </a>
    </span>
  );
}

/** 关注里有同名作者、还没认是不是同一个人：每组一条提示，认了才把那组来源绑到这位名下。
 *  名字相同不算证据（ADR-0095），所以这里只问，不替人绑。 */
function HeldAuthors({ follow, displayName, actions }: {
  follow: HeroFollow; displayName: string; actions: EntityHeroActions;
}) {
  const [busy, setBusy] = useState('');
  const confirm = async (key: string, name: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await actions.confirmFollowAuthor(key, name);
    } catch {
      /* 失败回执由壳发，按钮回到可按。 */
    } finally {
      setBusy('');
    }
  };
  return (
    <div data-entity-held="" className="flex flex-col gap-2">
      {follow.held.map((group) => (
        <Note key={group.key} tone="info" title={t('catalog:entityHero.sameNameAuthor', { name: group.name })}
          action={<Button size="small" {...busyProps(busy === group.key)}
            onClick={() => { void confirm(group.key, group.name) }}>{t('catalog:entityHero.samePerson')}</Button>}>
          {t('catalog:entityHero.samePersonAsk', {
            details: [group.providers.join(' · '), t('catalog:entityHero.updateCount', { count: group.n })].filter(Boolean).join(' · '), name: displayName,
          })}
        </Note>
      ))}
    </div>
  );
}

/** 分类位于身份行的第一项。 */
function IdentityMeta({ entity }: { entity: EntityHeroData }) {
  if (!entity.identity_labels?.length) return null;
  return (
    <span data-meta-item="classification" data-identity-classification="">
      <Glyph name="user-round" /><span>{serverLabels('identity.category', entity.identity_categories, entity.identity_labels).join(' · ')}</span>
    </span>
  );
}

/** 浮层里的一组名字：一个名字一行，读音排在它下面一行。串成一段的话，名字和读音分不清各属于谁。 */
function NameGroup({ label, names }: { label?: string; names: { name: string; reading?: string }[] }) {
  return (
    <>
      {label ? <dt>{label}</dt> : null}
      <dd data-wide={label ? undefined : ''}>
        {names.map((entry, at) => (
          <span key={at} data-pop-name="" lang={textLang(entry.name)}>{entry.name}{entry.reading ? <small>{entry.reading}</small> : null}</span>
        ))}
      </dd>
    </>
  );
}

function FactRowView({ glyph, label, clip, children }: { glyph: string; label: string; clip?: string; children: ReactNode }) {
  return (
    <>
      <dt><Glyph name={glyph} />{label}</dt>
      <dd data-fact={glyph === 'tags' ? 'tags' : clip ? 'clip' : glyph === 'calendar-range' ? 'num' : undefined}
        title={clip}>{children}</dd>
    </>
  );
}

/** 站上的标签只是读数，不是这一页的筛选，所以是标签的脸、不接点击。 */
function FactTags({ tags }: { tags: string[] }) {
  const { shown, rest } = shownTags(tags);
  return (
    <>
      {shown.map((tag) => <span key={tag} data-fact-tag="" title={tag}>{tag}</span>)}
      {rest ? (
        <MorePop id="entityTagPop" hook="fact" rest={rest} label={t('catalog:entityHero.moreTags', { count: rest })}
          heading={t('catalog:peopleIndex.tagCount', { count: tags.length })}>
          <div data-fact-tags="">{tags.map((tag) => <span key={tag} data-fact-tag="" title={tag}>{tag}</span>)}</div>
        </MorePop>
      ) : null}
    </>
  );
}

/** 链接前那枚圆标。站点圆标是别人服务器上的位图，取不到时 `data-drop="self"` 把 img 撤掉、
 *  露出底下那枚地球，所以这一格是遗留层的 HTML。 */
function LinkIcon({ mark }: { mark: LinkMark }) {
  if ('brand' in mark) return <span data-link-icon="brand"><Glyph name={mark.brand} /></span>;
  const html = icon('globe') + ('site' in mark
    ? `<img src="${esc(mark.site)}" alt="" width="20" height="20" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-drop="self">` : '');
  return <span data-link-icon="" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 外链排成一行次级按钮：36px 高、一圈线。纯图标的链接自己不带可读文字，名字留在 title 与
 *  读屏名称里；官网那种「点之前看不出是谁」的链接才写字。 */
function HeroLinkView({ link }: { link: LinkView }) {
  switch (link.type) {
    case 'icon':
      return (
        <a data-link="icon" href={link.url} target="_blank" rel="noopener noreferrer" title={link.title} aria-label={link.title}>
          <LinkIcon mark={link.mark} />
        </a>
      );
    case 'gone':
      /* 已隐退女优的失效链接留在原位、不可点：去敲一个停放域名只会招来杀毒软件告警。 */
      return (
        <span data-link="gone" tabIndex={0} title={link.title} aria-label={link.title}>
          <LinkIcon mark={{ globe: true }} />
        </span>
      );
    case 'private':
      return (
        <span data-link="private" title={link.sources ? link.sources.join('\n') : link.label}>
          <LinkIcon mark={{ globe: true }} />
          <span data-link-label="">{link.sources ? link.label : t('catalog:entityHero.sourceLink', { site: link.label })}</span>
        </span>
      );
    default:
      return (
        <a data-link="url" href={link.url} target="_blank" rel="noopener noreferrer" title={link.title}>
          <LinkIcon mark={link.mark} /><span data-link-label="">{link.text}</span>
          <svg className="ui-externalmark" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-external-link" /></svg>
        </a>
      );
  }
}

/** 看片的那一行：JavDB 与 MISSAV 两站自己的标识，后面是订阅新作的开关。
 *
 *  MISSAV 站上没有图形标识，它的标题就是排出来的字：Halant 500、`MISS` 跟页面墨色、`AV` 用
 *  它的粉。一位女优在 javdb 有两个演员页是常事，第二枚在标识后面缀服务端编好的序号。 */
function EntryMarks({ entity, actions, helpers }: {
  entity: EntityHeroData; actions: EntityHeroActions; helpers: EntityHeroHelpers;
}) {
  const [following, setFollowing] = useState(!!entity.feed?.following);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  /* 写回失败时开关留在原位，失败回执由壳发；成功才发过去时的回执，撤销是另一次真实写回。 */
  const write = async (on: boolean): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      await actions.follow(on);
      setFollowing(on);
      return true;
    } catch {
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const toggle = async (on: boolean) => {
    if (!await write(on)) return;
    helpers.receipt(on ? t('catalog:entityHero.newReleasesOn') : t('catalog:entityHero.newReleasesOff'), { undo: async () => { await write(!on) } });
    if (on) actions.refreshFeedAfterCheck();
  };
  return (
    <div data-entry-marks="">
      {entryMarks(entity).map((mark, at) => (
        <a key={at} data-entry-mark="" href={mark.url} target="_blank" rel="noopener noreferrer" title={mark.label} aria-label={mark.label}>
          {mark.mark ? <Glyph name={mark.mark} /> : <span data-missav-mark=""><span>MISS</span><span>AV</span></span>}
          {mark.ordinal ? <span data-entry-ordinal="">{mark.ordinal}</span> : null}
        </a>
      ))}
      {entity.feed ? <FeedSwitch following={following} busy={busy} onToggle={(on) => { void toggle(on) }}
        tip={entityFeedTip(following)} /> : null}
    </div>
  );
}
