"""用户脚本的人物补充：只读馆藏、元数据快照、详情页出演者与已安装头像，头像按人脸记录取景。"""
from __future__ import annotations

import base64
import io
import json
import re

from PIL import Image, ImageOps

from . import entities
from .jav_browser import code_key
from .previews import PreviewUnavailable
from .user_messages import UserValueError
from .web_jav_detail import visible_actors


def _snapshots(contract, codes):
    cached = getattr(contract, 'jav_discovery_metadata', None)
    if cached is not None:
        return {code: cached.peek(code)[0] for code in codes}
    path = contract.cover_root.parent / 'jav-discovery-metadata.json'
    try:
        if path.stat().st_size > 16 * 1024 * 1024:
            raise UserValueError("api.javBrowserPeople.snapshotTooLarge")
        payload = json.loads(path.read_text(encoding='utf-8'))
        if payload.get('version') != 1 or not isinstance(payload.get('records'), dict):
            raise UserValueError("api.javBrowserPeople.snapshotInvalid")
        records = payload['records']
        return {code: records.get(code, {}).get('movie', {}) for code in codes}
    except FileNotFoundError:
        return {}
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise UserValueError("api.javBrowserPeople.snapshotUnavailable") from error


#: 用户脚本的人物头像是 24 CSS px 圆框，返回 64 px 图；取景沿用 `frontend/src/card-art/face-frame.ts`。
FRAME_PX, OUTPUT_PX = 24, 64
FACE_TARGET, MIN_FACE_PX, FACE_CEILING = 0.32, 13, 0.6


def _face_zoom(box: dict) -> float:
    """与页面 `faceZoom` 同一判据：脸要够大、要摆正，不超过构图上限，也不上采样。"""
    base = max(FRAME_PX / box['imgW'], FRAME_PX / box['imgH'])
    shown = box['faceW'] * base
    if shown <= 0:
        return 1.0
    wanted = max(FACE_TARGET, MIN_FACE_PX / FRAME_PX) * FRAME_PX / shown
    edges = (min(box['cx'], 1 - box['cx']) * box['imgW'], min(box['cy'], 1 - box['cy']) * box['imgH'])
    centred = max(FRAME_PX / (2 * edge * base) if edge > 0 else float('inf') for edge in edges)
    lossless = box['faceW'] / (shown * OUTPUT_PX / FRAME_PX)
    return max(1.0, min(max(wanted, min(centred, FACE_CEILING * FRAME_PX / shown)), lossless))


def _framed(original: Image.Image, focus: dict | None) -> Image.Image:
    """按实体图的人脸记录裁出圆头像：有脸框时脸心对准框心再放大，只有取景轴时按 object-position 平移。

    记录的源图尺寸与文件对不上时退回几何居中，与页面核对 `naturalWidth` 的做法一致。
    """
    image = original.convert('RGB')
    box = (focus or {}).get('box')
    if box and (box['imgW'], box['imgH']) == image.size:
        zoom = _face_zoom(box)
        if zoom > 1:
            side = FRAME_PX / (max(FRAME_PX / box['imgW'], FRAME_PX / box['imgH']) * zoom)
            left = min(max(0.0, box['cx'] * box['imgW'] - side / 2), box['imgW'] - side)
            top = min(max(0.0, box['cy'] * box['imgH'] - side / 2), box['imgH'] - side)
            return image.resize((OUTPUT_PX, OUTPUT_PX), Image.LANCZOS, box=(left, top, left + side, top + side))
    centering = [0.5, 0.5]
    if focus and focus.get('axis') in {'x', 'y'}:
        centering[0 if focus['axis'] == 'x' else 1] = focus['pct'] / 100
    return ImageOps.fit(image, (OUTPUT_PX, OUTPUT_PX), centering=tuple(centering))


def entity_avatar(contract, preview, entity_id: int) -> str | None:
    """已安装头像按人脸取景成小图 data URI；没装头像是空串，装了却读不出是 None。"""
    if not contract.has_entity_image('performer', entity_id):
        return ''
    try:
        path, _ = preview.entity_image('performer', entity_id)
        with Image.open(path) as original:
            image = _framed(original, contract.avatar_focus('performer', entity_id))
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=75)
        return 'data:image/jpeg;base64,' + base64.b64encode(output.getvalue()).decode('ascii')
    except (PreviewUnavailable, OSError, ValueError):
        return None


def _page_names(performers) -> list[str]:
    """详情页出演者原文：去掉 ♀ 标记，男演员（♂）不参与；只在查询单个番号时使用。"""
    names = [str(name).strip() for name in performers or ()]
    if len(names) > 10 or any(not name or len(name) > 60 for name in names):
        raise UserValueError("api.javBrowserPeople.performersLimit")
    return [name.replace('♀', '').strip() for name in names if '♂' not in name]


def _page_person(connection, name: str) -> dict:
    """「河北彩花（河北彩伽）」先按括号外的名字，再按括号里的别名匹配本地人物；都未匹配时只留名字。"""
    base = re.sub(r'[（(][^）)]*[）)]', '', name).strip() or name
    for candidate in (base, *re.findall(r'[（(]([^（）()]+)[）)]', name)):
        found = entities.resolve_entity(connection, 'performer', candidate.strip())
        if found:
            return {'id': found['id'], 'name': found['canonical_name']}
    return {'id': None, 'name': base}


def cached_people(contract, preview, value: str, performers=()) -> dict:
    raw = value.split(',')
    if not 1 <= len(raw) <= 50:
        raise UserValueError("api.javBrowserPeople.codesLimit")
    codes = list(dict.fromkeys(code_key(code) for code in raw))
    page_names = _page_names(performers)
    if page_names and len(codes) != 1:
        raise UserValueError("api.javBrowserPeople.performersNeedSingleCode")
    items, avatars = {}, {}
    snapshots = _snapshots(contract, codes)
    with contract.database.read_connection() as connection:
        excluded = entities.male_performer_ids(connection)
        for code in codes:
            people = {}
            for row in connection.execute(
                    "SELECT DISTINCT e.id,e.canonical_name FROM asset a "
                    "JOIN asset_entity ae ON ae.asset_id=a.id JOIN entity e ON e.id=ae.entity_id "
                    "WHERE normalise_code_key(a.code)=? AND a.medium='video' AND a.disposal IS NULL "
                    "AND e.kind='performer' ORDER BY e.canonical_name", (code,)):
                if row['id'] not in excluded:
                    people[entities.normalize_entity_name(row['canonical_name'])] = {
                        'id': row['id'], 'name': row['canonical_name']}
            source = snapshots.get(code, {})
            for actor in visible_actors(connection, source or {}, excluded):
                name = actor['name'].strip()
                key = entities.normalize_entity_name(name)
                if key and key not in people:
                    found = entities.resolve_entity(connection, 'performer', name)
                    people[key] = {'id': found['id'] if found else None, 'name': name}
            # 详情页的出演者名只给账本与发现资料都没有人物的作品兜底：素人作品入库后账本记的是资料站认出的
            # 真名，页面仍写店铺艺名，两者对不上时不能把艺名算成第二个人。
            for name in page_names if not people else ():
                person = _page_person(connection, name)
                key = entities.normalize_entity_name(person['name'])
                if key and key not in people and person['id'] not in excluded:
                    people[key] = person
            for person in people.values():
                entity_id = person['id']
                if entity_id is None or not contract.has_entity_image('performer', entity_id):
                    continue
                if entity_id not in avatars:
                    avatars[entity_id] = entity_avatar(contract, preview, entity_id)
                    if avatars[entity_id] is None:
                        person['avatar_unavailable'] = True
                if avatars[entity_id]:
                    person['avatar'] = avatars[entity_id]
            items[code] = list(people.values())
    return {'ok': True, 'source': 'local-cache', 'items': items}
