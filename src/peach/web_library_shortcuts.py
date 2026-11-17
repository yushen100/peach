"""收藏与命名筛选；偏好保存在当前 profile，同一事务内按动作修改。"""
from __future__ import annotations

import json
import time
import uuid
from urllib.parse import parse_qsl, urlencode, urlsplit

from . import interface_text
from .catalog_rules import solo_performer_clause
from .library_favorites import KEY, favorite_entry, favorite_entries, favorite_entities
from .profiles import DEFAULT_PROFILE_ID, read_settings
from .user_messages import UserValueError
from .web_catalog import VISIBLE_CATALOG_ASSET, entity_ref

QUERY_KEYS = frozenset({"loc", "creator", "studio", "owner", "tag", "tag_match", "len",
                        "dur_min", "dur_max", "orient", "region", "year", "sort", "dir", "q", "jav", "thumb", "state",
                        "browse", "folder", "folder_recursive"})
PATHS = frozenset({"/", "/unseen", "/watch-later", "/flagged"})


def _snapshot(c, settings):
    stored = settings.get(KEY)
    stored = stored if isinstance(stored, dict) else {}
    favorites = favorite_entries(c, settings)
    raw_filters = stored.get("filters", [])
    filters = []
    for item in (raw_filters if isinstance(raw_filters, list) else [])[:100]:
        if not isinstance(item, dict) or not all(isinstance(item.get(key), str) for key in ("id", "name", "href")):
            continue
        try:
            href = clean_href(item["href"])
        except ValueError:
            continue
        filters.append({"id": item["id"][:80], "name": item["name"][:80], "href": href})
    return {"favorites": favorites, "filters": filters}


def clean_href(raw):
    if not isinstance(raw, str) or len(raw) > 4096:
        raise UserValueError("api.libraryShortcuts.invalidFilterHref")
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc or parsed.fragment or parsed.path not in PATHS:
        raise UserValueError("api.libraryShortcuts.collectionFiltersOnly")
    pairs = parse_qsl(parsed.query, keep_blank_values=True, max_num_fields=40)
    if any(key not in QUERY_KEYS or len(value) > 1000 for key, value in pairs):
        raise UserValueError("api.libraryShortcuts.unsupportedFilterCondition")
    query = urlencode(dict(pairs))
    return parsed.path + ("?" + query if query else "")


def q_library_shortcuts(contract, _args=None):
    with contract.read_connection() as c:
        data = _snapshot(c, read_settings(c))
        _attach_art(contract, c, data["favorites"])
        return data


def _attach_art(contract, connection, rows):
    """收藏复用实体图、厂牌标识与可取得的代表作头像。"""
    rows = [row for row in rows if 'entity_id' in row]
    if not rows:
        return
    ids = [row["entity_id"] for row in rows]
    marks = ','.join('?' for _ in ids)
    representatives = {row[0]: (row[1], row[2]) for row in connection.execute(
        "SELECT entity_id,id,snapshot_path FROM (SELECT ae.entity_id,a.id,a.snapshot_path,"
        "ROW_NUMBER() OVER (PARTITION BY ae.entity_id ORDER BY a.size DESC,a.id) rank "
        "FROM asset_entity ae JOIN asset a ON a.id=ae.asset_id JOIN entity e ON e.id=ae.entity_id "
        f"WHERE ae.entity_id IN ({marks}) AND {VISIBLE_CATALOG_ASSET} "
        "AND a.snapshot_path IS NOT NULL AND (e.kind<>'performer' OR (" +
        solo_performer_clause('a.id', 'ae.entity_id') + ")) ) WHERE rank=1", ids)}
    for row in rows:
        _favorite_art(contract, row, representatives.get(row['entity_id']))


def _favorite_art(contract, row, representative):
    ref = entity_ref(contract, row['kind'], row['entity_id'], row['name'])
    row['image_url'], row['image_label'] = '', row['name']
    if row['kind'] == 'studio' and contract.has_logo(row['name']):
        row['image_url'] = '/logo?' + urlencode({'studio': row['name'], 'variant': 'icon', 'v': contract.logo_version(row['name'])})
    elif ref['has_image']:
        row['image_url'] = '/entity-image?' + urlencode({'kind': row['kind'], 'id': row['entity_id'], 'thumb': 1, 'v': ref.get('image_version', '')})
    elif row['kind'] not in {'studio', 'agency'} and representative and contract.has_avatar(*representative):
        row['image_url'] = f'/avatar?id={representative[0]}'
        params = {'name': row['name']}
        row['image_label'] = interface_text.text('server:labels.webLibraryShortcuts.representativeImage', params)
        row['image_label_code'], row['image_label_params'] = 'labels.webLibraryShortcuts.representativeImage', params
    elif ref.get('source_avatar_url'):
        row['image_url'] = ref['source_avatar_url']
        row['image_fallbacks'] = ref.get('source_avatar_fallbacks', [])


def favorite_ids(connection):
    return {row["entity_id"] for row in favorite_entities(connection)}


def _reorder_filters(rows, ids):
    by_id = {row["id"]: row for row in rows}
    if (not isinstance(ids, list) or any(not isinstance(key, str) for key in ids)
            or len(ids) != len(by_id) or set(ids) != set(by_id)):
        raise UserValueError("api.libraryShortcuts.filtersChanged")
    return [by_id[key] for key in ids]


def w_library_shortcuts(contract, body):
    action = body.get("action")
    with contract.write_transaction() as c:
        settings = read_settings(c)
        data = _snapshot(c, settings)
        if action == "favorite":
            item = favorite_entry(c, body)
            if item is None or not isinstance(body.get("on"), bool):
                raise UserValueError("api.libraryShortcuts.invalidFavorite")
            if item.get('scope') == 'online' and body['on']:
                from .web_follow import online_tag_inventory
                tag = next((row for row in online_tag_inventory(c) if row['id'] == item['tag_id']), None)
                if tag is None:
                    raise UserValueError("api.libraryShortcuts.onlineTagMissing")
                item['name'] = tag['k']
            data["favorites"] = [row for row in data["favorites"] if row["key"] != item["key"]]
            if body["on"]:
                if len(data["favorites"]) >= 1000:
                    raise UserValueError("api.libraryShortcuts.favoritesLimit")
                data["favorites"].append(item)
        elif action == "save_filter":
            name = body.get("name")
            if not isinstance(name, str) or not 0 < len(name.strip()) <= 80:
                raise UserValueError("api.libraryShortcuts.filterNameLength")
            if len(data["filters"]) >= 100:
                raise UserValueError("api.libraryShortcuts.filtersLimit")
            data["filters"].append({"id": uuid.uuid4().hex, "name": name.strip(), "href": clean_href(body.get("href"))})
        elif action == "delete_filter":
            data["filters"] = [row for row in data["filters"] if row["id"] != body.get("id")]
        elif action == "reorder_filters":
            data["filters"] = _reorder_filters(data["filters"], body.get("ids"))
        else:
            raise UserValueError("api.libraryShortcuts.unsupportedAction")
        settings[KEY] = data
        updated = c.execute("UPDATE profile SET settings_json=?,updated_at=? WHERE id=?",
                            (json.dumps(settings, ensure_ascii=False), time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), DEFAULT_PROFILE_ID)).rowcount
        if not updated:
            raise UserValueError("api.libraryShortcuts.profileMissing")
    return {"ok": True, **q_library_shortcuts(contract)}
