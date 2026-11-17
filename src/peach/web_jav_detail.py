"""库外 JAV 作品详情的只读投影，来源资料不构成 ledger 断言。"""
from __future__ import annotations

import re
import json
import base64
from datetime import datetime, timezone
from functools import wraps

from . import entities, interface_text, wants, web_catalog
from .catalog_rules import normalise_code_key, tag_cat
from .genre_decisions import load_genre_decisions
from .genre_taxonomy import resolve_genre
from .javdb_public import (MAX_REVIEW_PAGES, PAGE_SIZE, PUBLIC_API, PublicSourceUnavailable,
                          PublicIdentityAmbiguous, actor_gender, preview_video_url, public_image_url,
                          public_cache_scope, cache_checked_at, cache_error, cache_failure)
from .jav_discovery_metadata import discovery_metadata
from .metadata import relay_args
from .sources.javdb import maker_writing, page_reader
from .remote_media_cache import AVATAR_REFRESH_SECONDS, cache_for
from .preview_cache import PreviewCache
from .user_messages import UserValueError, message_fields


def detail_code(args) -> str:
    raw = str(args.get("code") or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{2,64}", raw):
        raise UserValueError("api.javDetail.invalidCode")
    return normalise_code_key(raw)


def discovery_cover_url(item, source) -> str:
    """卡片只显示 `/cover-image` 能代理的官方封面地址。"""
    from .jav_cover_fetch import proxyable_cover_url
    for value in (item.get('cover_url'), source.get('cover_url')):
        if proxyable_cover_url(value):
            return value
    return ''


def stored_cover_url(contract, code) -> str:
    """`/cover-image` 按番号取的上游地址；只读账本与已缓存的来源资料，不联网。
    官方只回占位图的那几部没有地址：代理缓存里存着的那张占位图也就不再给出去。"""
    from .feed_followup import awaiting_official_cover
    from .web_jav_discovery import _cached_movie
    with contract.database.read_connection() as connection:
        row = connection.execute("SELECT cover_url,release_date FROM feed_discovery WHERE code=? COLLATE NOCASE LIMIT 1",
                                 (code,)).fetchone()
    if row and awaiting_official_cover(contract, code, row["release_date"]):
        return ''
    return discovery_cover_url(dict(row) if row else {}, _cached_movie(code, contract))


def _refs(contract, connection, kind, names):
    refs = []
    for name in dict.fromkeys(str(name or "").strip() for name in names):
        if not name:
            continue
        lookup = maker_writing(name) if kind == "studio" else name
        entity = entities.resolve_entity(connection, kind, lookup)
        if entity is None and kind == "studio":
            matches = connection.execute(
                "SELECT DISTINCT e.* FROM entity e LEFT JOIN entity_alias a ON a.entity_id=e.id "
                "WHERE e.kind='studio' AND (e.canonical_name=? COLLATE NOCASE OR a.alias=? COLLATE NOCASE) "
                "ORDER BY e.id LIMIT 2", (lookup, lookup)).fetchall()
            entity = matches[0] if len(matches) == 1 else None
        refs.append(web_catalog.entity_ref(contract, kind, entity["id"], entity["canonical_name"])
                    if entity else {"id": None, "name": name, "has_image": False})
    return refs


def _jav_pages(contract):
    """接口要求登录时，作品身份与资料改读 javdb.com 网页；带用户的 JavDB Cookie。"""
    return page_reader(contract.follow_secrets_root)


def _source_cache(handler):
    @wraps(handler)
    def read(contract, args):
        with (public_cache_scope(contract.cover_root.parent / 'jav-public') as reads,
              _jav_pages(contract) as pages, PUBLIC_API.page_reader(pages)):
            payload = handler(contract, args)
            prefix ={'q_jav_reviews': ('reviews:',), 'q_jav_resources': ('reviews:', 'magnets:')}.get(
                handler.__name__, ('movie:',))
            selected = [row for row in reads if row['key'].startswith(prefix)]
            if selected:
                payload['checked_at'] = datetime.fromtimestamp(min(row['saved'] for row in selected), timezone.utc).isoformat()
            # 只报这个接口自己那份资料沿用旧快照时的失败。预告、图片这些别的键沿用了旧结果，
            # 页面上照样有东西可看，报出来就成了「明明能播却写着没取到」。
            owned = tuple(key.rstrip(':') for key in prefix)
            errors = list(dict.fromkeys(row['error'] for row in reads if row['error'] and row['key'].startswith(owned)))
            if errors:
                payload['cache_stale'] = True
                payload['message'] = '；'.join(errors)
                if 'warnings' in payload:
                    payload['warnings'].extend(errors)
            return payload
    return read


@_source_cache
def q_jav_detail(contract, args) -> dict:
    code = detail_code(args)
    with contract.database.read_connection() as connection:
        row = connection.execute("SELECT * FROM feed_discovery WHERE code=? COLLATE NOCASE LIMIT 1", (code,)).fetchone()
        item = dict(row) if row else {}
    source = None
    message = ""
    ambiguous = False
    stored, _ = discovery_metadata(contract).peek(code)
    try:
        PUBLIC_API.remember_movie_identity(code, stored or {})
        source = PUBLIC_API.movie(code, refresh=True) if args.get('refresh') == '1' else PUBLIC_API.movie(code)
        discovery_metadata(contract).remember(code, source, checked_at=cache_checked_at('movie:'))
        if cache_error('movie:' + code):
            discovery_metadata(contract).remember(code, error=cache_error('movie:' + code))
    except PublicSourceUnavailable as error:
        message = str(error)
        ambiguous = isinstance(error, PublicIdentityAmbiguous)
        discovery_metadata(contract).remember(code, error=message)
        if not ambiguous:
            source = _stand_in(contract, code, stored)
    if source:
        item.update(title=source.get("origin_title") or source.get("title") or item.get("title"),
                    release_date=source.get("release_date") or item.get("release_date"),
                    studio=source.get("maker_name") or item.get("studio"))
    payload = {"ok": True, "state": "ready" if source and not source.get("fallback_source") else "partial",
               "message": message,
               "code": code, "title": item.get("title") or code,
               "release_date": item.get("release_date"), "studio": item.get("studio")}
    with contract.database.read_connection() as connection:
        decisions = load_genre_decisions(connection)
    payload.update(_source_fields(source or {}, decisions))
    # 官方目录退路没有 JavDB 作品 id：样张、预告与来源链接只按 JavDB 那份算，退路只补标题、厂牌、类别与演员。
    javdb = source if source and source.get("id") else {}
    payload.update(_artwork_fields(contract, code, item, javdb, refresh=args.get('refresh') == '1',
                                   ambiguous=ambiguous))
    payload.update(_identity_fields(contract, code, item, source or {}))
    return payload


def _stand_in(contract, code, stored):
    """JavDB 没答上时的作品资料：边车里已有的官方目录资料，没有就现问 DMM、r18.dev（有码作品）。"""
    from .jav_discovery_metadata import official_movie
    if stored and stored.get("fallback_source"):
        return stored
    movie = official_movie(contract.follow_secrets_root, code)
    if movie:
        discovery_metadata(contract).remember(code, movie)
    return movie


def visible_actors(connection, source, excluded=None):
    """来源演员资料保持完整，使用时排除明确登记的男优。"""
    excluded = entities.male_performer_ids(connection) if excluded is None else excluded
    actors = []
    for actor in source.get('actors') or []:
        if not isinstance(actor, dict) or not actor.get('name') or actor_gender(actor) == 'male':
            continue
        entity = entities.resolve_entity(connection, 'performer', actor['name'])
        if entity is None or entity['id'] not in excluded:
            actors.append(actor)
    return actors


def _identity_fields(contract, code, item, source):
    with contract.database.read_connection() as connection:
        actors = visible_actors(connection, source)
        if 'actors' not in source:
            actors = [{'name': name} for name in re.split(r"[、,，]", str(item.get('performers') or ''))]
        performer_refs = source_performer_refs(contract, connection, actors)
        studio_refs = _refs(contract, connection, "studio", [item.get("studio")])
        for ref in studio_refs:
            ref["has_logo"] = contract.has_logo(ref["name"])
            ref["logo_version"] = contract.logo_version(ref["name"])
        series_refs = _refs(contract, connection, "series", [(source or {}).get("series_name")])
        wanted = code in wants.wanted_keys(connection, [code])
        want = connection.execute("SELECT id FROM want_item WHERE code_key=? AND state<>'acquired' LIMIT 1", (code,)).fetchone()
    return {"performers": "、".join(ref["name"] for ref in performer_refs),
            "performer_refs": performer_refs, "studio_refs": studio_refs, "series_refs": series_refs,
            "wanted": wanted, "want_id": int(want[0]) if want else None}


def source_performer_refs(contract, connection, actors):
    """详情与发现共用来源身份；头像是否可取不保存签名地址。"""
    refs = []
    for actor in actors:
        matched = _refs(contract, connection, 'performer', [actor.get('name')])
        if not matched:
            continue
        ref = matched[0]
        gender = actor_gender(actor)
        if gender == 'unknown' and ref.get('id'):
            local = connection.execute('SELECT metadata_json FROM entity WHERE id=?', (ref['id'],)).fetchone()
            try:
                metadata = json.loads(local[0] or '{}') if local else {}
                gender = actor_gender(metadata) if isinstance(metadata, dict) else 'unknown'
            except (ValueError, TypeError):
                pass
        if gender == 'male' or any(person['name'] == ref['name'] for person in refs):
            continue
        ref['gender'] = gender
        actor_id = str(actor.get('id') or '')
        if re.fullmatch(r'[A-Za-z0-9]{1,64}', actor_id):
            ref['source_actor_id'] = actor_id
            ref['source_avatar'] = (bool(actor['has_avatar']) if 'has_avatar' in actor
                                    else public_image_url(actor.get('avatar_url')) if 'avatar_url' in actor else True)
        refs.append(ref)
    return refs


def _artwork_fields(contract, code, item, source, *, refresh=False, ambiguous=False):
    from .jav_cover_fetch import OFFICIAL_PLACEHOLDER_ONLY_CODE, PLACEHOLDER_CODE, is_javdb_image
    source_cover = (source or {}).get('cover_url') or (source or {}).get('thumb_url')
    missing = {} if contract.has_cover(code) else _cover_reason(contract, code)
    # 取图记录认出官方地址只回「准备中」占位图：那张图不当封面放大摆出来，封面那格改说原因。
    placeholder = missing.get("cover_message_code") in (PLACEHOLDER_CODE, OFFICIAL_PLACEHOLDER_ONLY_CODE)
    return {"has_cover": not ambiguous and contract.has_cover(code), "cover_version": contract.cover_version(code),
            "cover_url": '' if ambiguous or placeholder else discovery_cover_url(item, source or {}),
            "source_image": bool(source_cover and not is_javdb_image(source_cover)),
            "preview_count": min(len(source.get("preview_images") or []), 30),
            **({'preview_video_url': '', 'preview_state': 'unavailable'} if ambiguous else
               _preview_fields(contract, code, source, refresh=refresh)),
            "source_url": '' if ambiguous else "https://javdb.com/v/" + str(source["id"]) if source else item.get("link") or "",
            **missing}


def _cover_reason(contract, code) -> dict:
    """本机没有封面时，上次取官方封面没取到的原因（取图记录，新作卡封面格说的同一句）；没取过、或上次取到了就不说。"""
    from .feed_followup import attempt_reason, cover_attempt
    attempt = cover_attempt(contract.cover_root, code)
    if not attempt or attempt.get('ok'):
        return {}
    reason = attempt_reason(attempt)
    if not isinstance(reason, dict):
        return {"cover_message": str(reason)}
    return {"cover_message": interface_text.text(f"server:{reason['code']}", reason['params']),
            "cover_message_code": reason['code'], "cover_message_params": reason['params']}


def _source_fields(source, decisions):
    tags = [str(tag.get("name") or "") if isinstance(tag, dict) else str(tag)
            for tag in source.get("tags", [])]
    tag_refs = []
    for raw in tags:
        label = resolve_genre(raw, decisions)
        if label is None:
            continue
        label = label or raw
        if label and all(ref["name"] != label for ref in tag_refs):
            tag_refs.append({"name": label, "category": tag_cat(label), "source_name": raw})
    return {"duration": source.get("duration"), "score": source.get("score"),
            "summary": source.get("summary") or "", "director": source.get("director_name") or "",
            "publisher": source.get("publisher_name") or "", "tags": [tag for tag in tags if tag],
            "tag_refs": tag_refs,
            "comments_count": int(source.get("comments_count") or 0)}


#: 评论没有用户名时显示的名字。
ANONYMOUS_CODE = "labels.webJavDetail.anonymousUser"


def _username(name) -> dict:
    """评论者：来源给的名字原样；没有名字时 `username` 是 zh-CN 原文，`username_code` 给界面取译文。"""
    if name:
        return {"username": str(name)}
    return {"username": interface_text.text(f"server:{ANONYMOUS_CODE}"), "username_code": ANONYMOUS_CODE}


@_source_cache
def q_jav_reviews(contract, args) -> dict:
    code = detail_code(args)
    page = int(args.get("page") or 1)
    try:
        if args.get('refresh') == '1':
            movie = PUBLIC_API.movie(code, refresh=True)
            rows = PUBLIC_API.reviews(code, page, refresh=True, movie=movie)
        else:
            rows = PUBLIC_API.reviews(code, page)
    except PublicSourceUnavailable as error:
        return {"ok": False, "items": [], "more": False, "message": str(error)}
    items = [{"id": str(row.get("id")), **_username(row.get("username")),
              "content": str(row.get("content") or ""), "score": row.get("score"),
              "created_at": str(row.get("created_at") or "")} for row in rows[:PAGE_SIZE] if isinstance(row, dict)]
    return {"ok": True, "items": items, "page": page,
            "more": len(items) == PAGE_SIZE and page < MAX_REVIEW_PAGES,
            "message": ""}


def w_jav_cover(contract, body) -> dict:
    """详情页「立即重试」与新作卡「优先处理」：按番号取官方封面装进本机封面目录，与后台补封面同一条路。

    只写封面目录与取图记录，不写账本；同步等到取完，`feed_followup.COVER_SECONDS` 封顶。
    取到时带上取景的两份边车，新作卡原地换图也按它取景。
    没取到时 `message` 是取图记录里那句去掉来源地址的原因。
    """
    from . import feed_followup
    code = detail_code(body)
    with contract.database.read_connection() as connection:
        row = connection.execute("SELECT cover_url FROM feed_discovery WHERE code=? COLLATE NOCASE LIMIT 1",
                                 (code,)).fetchone()
    message = ''
    try:
        feed_followup.ensure_cover(contract, code, row[0] if row else None)
    except Exception:  # noqa: BLE001 - 原因已写进取图记录，下面读它
        try:
            record = json.loads(feed_followup.cover_attempt_path(contract.cover_root, code).read_text(encoding='utf-8'))
        except (OSError, ValueError):
            record = {}
        message = str(record.get('reason') or '') if isinstance(record, dict) else ''
    contract.cache_bust()
    covered = contract.has_cover(code)
    # 取图记录里的原因没有 code，照原文给；没有原因时才用这句固定的话。
    missing = {} if covered or message else message_fields("api.javDetail.officialCoverMissing")
    return {"ok": True, "code": code, "has_cover": covered, "cover_version": contract.cover_version(code),
            "cover_frame": contract.cover_frame(code), "poster_box": contract.poster_box(code),
            "message": '' if covered else message, **missing}


#: 来源图片在浏览器里留多久。样张与来源封面落盘后不再刷新；来源头像在服务端按
#: `AVATAR_REFRESH_SECONDS` 换新，浏览器只留一天，换过的图第二天就看得到。
JAV_IMAGE_MAX_AGE = 30 * 86400
JAV_ACTOR_IMAGE_MAX_AGE = 86400


def jav_image(contract, args, *, defer=None) -> tuple[bytes, int]:
    """来源图片（样张、来源封面、来源头像）的字节，以及浏览器可以缓存的秒数。

    图片落进远程媒体缓存；传入 defer 时，过期头像先返回缓存并登记后续刷新。
    取不到抛 `PublicSourceUnavailable` 或
    `RemoteMediaUnavailable`；番号或图号不合法抛 `ValueError`，都在联网之前。
    """
    code = detail_code(args)
    index = str(args.get("image") or "cover")
    if (index != "cover" and not re.fullmatch(r"actor:[A-Za-z0-9]{1,64}", index)
            and (not index.isdigit() or not 0 <= int(index) < 30)):
        raise UserValueError("api.javDetail.previewImageMissing")
    actor = index.startswith("actor:")
    with (public_cache_scope(contract.cover_root.parent / 'jav-public'), _jav_pages(contract) as pages,
          PUBLIC_API.page_reader(pages)):
        cache = cache_for(contract)
        movie = None
        if not actor:
            stored, _ = discovery_metadata(contract).peek(code)
            PUBLIC_API.remember_movie_identity(code, stored or {})
            identity = PUBLIC_API.peek_movie_identity(code)
            if identity is not None:
                cached = cache.stored_bytes(f'jav:{code}:{identity}:image:{index}')
                if cached is not None:
                    return cached, JAV_IMAGE_MAX_AGE
            movie = PUBLIC_API.movie(code)
        key = f"jav:actor:{index.removeprefix('actor:')}" if actor else f"jav:{code}:{movie['id']}:image:{index}"
        body = cache.bytes(key,
            lambda: base64.b64decode(_fetch_image(contract, code, index, movie=movie).partition(',')[2], validate=True),
            ttl=AVATAR_REFRESH_SECONDS if actor else None,
            on_stale=(lambda: defer(lambda: jav_image(contract, args))) if actor and defer else None)
    return body, JAV_ACTOR_IMAGE_MAX_AGE if actor else JAV_IMAGE_MAX_AGE


def _fetch_image(contract, code, index, *, movie=None):
    stored, _ = discovery_metadata(contract).peek(code)
    PUBLIC_API.remember_movie_identity(code, stored or {})
    if index.startswith('actor:'):
        actor = next((person for person in (stored or {}).get('actors', [])
                      if isinstance(person, dict) and str(person.get('id')) == index.removeprefix('actor:')), {})
        if public_image_url(actor.get('avatar_image')):
            return PUBLIC_API.image_from_url(actor['avatar_image'])
    image = PUBLIC_API.image(code, index, movie=movie)
    if index.startswith('actor:'):
        movie = PUBLIC_API.peek_movie(code)
        if movie:
            discovery_metadata(contract).remember(code, movie, checked_at=cache_checked_at('movie:' + code + ':'))
    return image


def _preview_fields(contract, code, source, *, refresh=False):
    from .jav_official_preview import dmm_preview, javdb_preview, prestige_preview

    prestige = ('prestige' in str(source.get('maker_name') or '').casefold()
                or 'プレステージ' in str(source.get('maker_name') or ''))
    provider = 'prestige' if prestige else 'dmm'
    fetch = (lambda: prestige_preview(code, contract.follow_secrets_root)) if prestige else (
        lambda: dmm_preview(code, contract.follow_secrets_root))
    sources = [(provider, fetch), ('javdb', lambda: javdb_preview(code, source.get('id'), contract.follow_secrets_root))]
    url, errors = '', []
    for provider, fetch in sources:
        try:
            result = PUBLIC_API.official_preview(code, fetch, released=source.get('release_date'),
                                                 refresh=refresh, provider=provider,
                                                 **({'source_id': source.get('id')} if provider == 'javdb' else {}))
            url = result['url']
            failure = cache_failure(f'preview:{provider}:' + code)
            if failure and not url:
                raise PublicSourceUnavailable(*relay_args(failure))
        except PublicSourceUnavailable as error:
            errors.append(str(error))
        if url:
            break
    if not url:
        url = preview_video_url(source)
        if url and '?' in url:
            try:
                url = preview_video_url(PUBLIC_API.media_movie(code, movie=source)) or url
            except PublicSourceUnavailable as error:
                errors.append(str(error))
    if not url:
        return {'preview_video_url': '', 'preview_state': 'unavailable' if errors else 'missing',
                **({'preview_message': '；'.join(dict.fromkeys(errors))} if errors else {})}
    playlist = url.endswith('.m3u8') or '.m3u8?' in url
    ref = PreviewCache(cache_for(contract)).register(code, url, playlist=playlist,
                                                     media_type='' if playlist else 'video/mp4')
    return {'preview_video_url': f"/jav-preview/{code}/{ref}{'.m3u8' if playlist else ''}", 'preview_state': 'ready'}



def q_jav_resources(contract, args) -> dict:
    """公开资源列表；只返回候选，下载提交由既有入口接受用户选择。

    与想要清单同一份查询（`wants_magnets.MagnetSearch`）：manko、JavDB、sukebei、JavBus 四个磁链来源，
    加 JavDB 评论里的 ed2k 与网页链接。JavDB 不可用时其余来源照给；同时只查一部，其余返回 busy 由界面稍后再取。
    """
    from .wants_magnets import search_for

    code = detail_code(args)
    with public_cache_scope(contract.cover_root.parent / 'jav-public'), _jav_pages(contract) as pages, \
            PUBLIC_API.page_reader(pages):
        found = search_for(contract.follow_secrets_root).query(code, refresh=args.get('refresh') == '1')
    # 查询结果是共享缓存里的那一份，交出去的是副本。
    return {**found, "items": list(found.get("items") or []), "warnings": list(found.get("warnings") or [])}
