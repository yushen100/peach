"""在线标签的本机名称、归类与隐藏决定；来源 metadata 保持原词。"""
from __future__ import annotations

import hashlib
import html
import json
import unicodedata
from dataclasses import replace
from datetime import datetime, timezone

from .profiles import DEFAULT_PROFILE_ID, read_settings
from .user_messages import UserValueError

SETTINGS_KEY = 'online_tag_management'
ITEM_TAGS_KEY = 'online_item_tags'
ITEM_HIDDEN_TAGS_KEY = 'online_item_hidden_tags'
TYPE_RANK = {'general': 0, 'metadata': 1, 'copyright': 2, 'character': 3, 'artist': 4}


def tag_key(value: str) -> str:
    return unicodedata.normalize('NFKC', html.unescape(value)).strip().casefold()


class OnlineTagPolicy:
    def __init__(self, connection=None):
        settings = read_settings(connection) if connection is not None else {}
        self.groups = settings.get(SETTINGS_KEY, {})
        self.item_tags = settings.get(ITEM_TAGS_KEY, {})
        self.item_hidden_tags = settings.get(ITEM_HIDDEN_TAGS_KEY, {})
        self.members = {tag_key(member): group_id for group_id, group in self.groups.items()
                        for member in [*group['members'], *group['aliases'], group['name']]}

    @staticmethod
    def item_key(item) -> str:
        return f'{item.provider}:{item.external_id}'

    def custom_tags(self, item) -> list[str]:
        return self.item_tags.get(self.item_key(item), [])

    def with_custom_tags(self, item):
        """在读取副本中叠加用户标签，来源 metadata 保持独立。"""
        custom = self.custom_tags(item)
        hidden = self.item_hidden_tags.get(self.item_key(item), [])
        if not custom and not hidden:
            return item
        excluded = set()
        for tag in hidden:
            group = self.groups.get(self.identity(tag)[0], {})
            excluded.update(tag_key(word) for word in [tag, group.get('name', tag), *group.get('members', []), *group.get('aliases', [])])
        return replace(item, metadata={**item.metadata, '_user_tags': custom, '_user_hidden_tags': sorted(excluded)})

    def blocked(self, tags) -> bool:
        return any(self.groups.get(self.identity(tag)[0], {}).get('blocked', False) for tag in tags)

    def identity(self, tag: str) -> tuple[str, str, bool]:
        key = tag_key(tag)
        group_id = self.members.get(key, key)
        group = self.groups.get(group_id)
        return (group_id, group['name'], group['hidden']) if group else (key, tag, False)

    def query_name(self, tag: str) -> str:
        key = tag_key(tag)
        for group in self.groups.values():
            if key in {tag_key(word) for word in [group['name'], *group['aliases'], *group['members']]}:
                return group['name']
        return self.identity(tag)[1]

    def project(self, tags, *, include_hidden=False) -> list[str]:
        output, seen = [], set()
        for tag in tags:
            group_id, name, hidden = self.identity(tag)
            if group_id not in seen and (include_hidden or not hidden):
                seen.add(group_id)
                output.append(name)
        return output

    def types(self, types: dict[str, str]) -> dict[str, str]:
        output = {}
        for tag, kind in types.items():
            _group_id, name, hidden = self.identity(tag)
            if not hidden and TYPE_RANK[kind] >= TYPE_RANK.get(output.get(name), -1):
                output[name] = kind
        return output


def _validate_rename(connection, rows, ids, name):
    """在线名称须可用于筛选，并避开可见词表与已保存的归类。"""
    if len(ids) != 1 or not 0 < len(name) <= 80 or any(ord(char) < 32 for char in name) or ',' in name:
        raise UserValueError('errors.onlineTagManagement.nameInvalid')
    for row in rows:
        if row['id'] != ids[0] and tag_key(name) in {tag_key(word) for word in [row['k'], *row['aliases']]}:
            raise UserValueError('errors.onlineTagManagement.nameTaken', {'name': name, 'tag': row['k']})
    for group_id, group in OnlineTagPolicy(connection).groups.items():
        if group_id != ids[0] and tag_key(name) in {tag_key(word) for word in [group['name'], *group['aliases'], *group['members']]}:
            raise UserValueError('errors.onlineTagManagement.nameTaken', {'name': name, 'tag': group['name']})


def preview(connection, body, rows):
    operation = body.get('operation')
    if operation not in {'rename', 'merge', 'hide', 'restore', 'block', 'unblock'}:
        raise ValueError('unknown online tag operation')
    if operation == 'block' and 'name' in body and not body.get('ids'):
        rows, group_id = _with_named_row(connection, rows, body.get('name'))
        body = {**body, 'ids': [group_id]}
    ids = body.get('ids')
    if not isinstance(ids, list) or not 0 < len(ids) <= 2000 or any(not isinstance(value, str) or not value for value in ids):
        raise UserValueError('errors.onlineTagManagement.selectionInvalid')
    ids = sorted(set(ids))
    selected = [row for row in rows if row['id'] in ids]
    if len(selected) != len(ids):
        raise UserValueError('errors.onlineTagManagement.tagsChanged')
    name = unicodedata.normalize('NFKC', str(body.get('name', ''))).strip()
    target = body.get('target_id')
    if operation == 'rename':
        _validate_rename(connection, rows, ids, name)
    if operation == 'merge':
        if len(ids) < 2 or target not in ids:
            raise UserValueError('errors.onlineTagManagement.mergeSelection')
        if len({row['cat'] for row in selected}) > 1:
            raise UserValueError('errors.onlineTagManagement.mergeSameType')
    releases = {key for row in selected for key in row['_releases']}
    state = read_settings(connection).get(SETTINGS_KEY, {})
    token = hashlib.sha256(json.dumps([operation, ids, name, target, selected, state], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return {'operation': operation, 'ids': ids, 'name': name, 'target_id': target,
            'tags': [{key: value for key, value in row.items() if not key.startswith('_')} for row in selected],
            'assets': len(releases), 'overlap': sum(row['n'] for row in selected) - len(releases), 'token': token}


def _with_named_row(connection, rows, raw):
    """按名字屏蔽：词表里已有的就是那一条，没有的（还没抓到过）先记一条空的，以后抓到同名标签
    就落进这一组。返回补过的词表和要屏蔽的那一条的 id。"""
    name = unicodedata.normalize('NFKC', str(raw or '')).strip()
    if not 0 < len(name) <= 80 or ',' in name or any(ord(char) < 32 for char in name):
        raise UserValueError('errors.onlineTagManagement.nameInvalid')
    group_id = OnlineTagPolicy(connection).identity(name)[0]
    if any(row['id'] == group_id for row in rows):
        return rows, group_id
    return [*rows, {'id': group_id, 'k': name, 'n': 0, 'cat': 'general', 'hidden': False, 'blocked': False,
                    'aliases': [], 'members': [tag_key(name)], '_releases': [], 'named': True}], group_id


def apply_plan(connection, body, rows):
    plan = preview(connection, body, rows)
    if plan['token'] != body.get('token'):
        raise UserValueError('errors.onlineTagManagement.previewStale')
    settings = read_settings(connection)
    groups = settings.setdefault(SETTINGS_KEY, {})
    rows = {row['id']: row for row in plan['tags']}
    for group_id, row in rows.items():
        groups.setdefault(group_id, {'name': row['k'], 'hidden': row['hidden'], 'members': row['members'], 'aliases': row['aliases'], 'cat': row['cat'], 'blocked': row.get('blocked', False),
                                     **({'named': True} if row.get('named') else {})})
    if plan['operation'] == 'rename':
        group = groups[plan['ids'][0]]
        group['aliases'] = sorted(set([*group['aliases'], group['name']]))
        group['name'] = plan['name']
    elif plan['operation'] == 'merge':
        target = groups[plan['target_id']]
        for group_id in plan['ids']:
            if group_id == plan['target_id']:
                continue
            source = groups.pop(group_id)
            target['members'] = sorted(set([*target['members'], *source['members']]))
            target['aliases'] = sorted(set([*target['aliases'], source['name'], *source['aliases']]))
            target['blocked'] = target.get('blocked', False) or source.get('blocked', False)
    elif plan['operation'] in {'block', 'unblock'}:
        for group_id in plan['ids']:
            groups[group_id]['blocked'] = plan['operation'] == 'block'
            # 按名字记下、一条内容都还没抓到的那一组，解除屏蔽后不再留一条空标签。
            group = groups[group_id]
            if plan['operation'] == 'unblock' and group.get('named') and not group['hidden'] and not rows[group_id]['n']:
                groups.pop(group_id)
    else:
        for group_id in plan['ids']:
            groups[group_id]['hidden'] = plan['operation'] == 'hide'
    _save_settings(connection, settings)
    return {'ok': True, 'operation': plan['operation'], 'assets': plan['assets']}


def _save_settings(connection, settings):
    changed = connection.execute('UPDATE profile SET settings_json=?,updated_at=? WHERE id=?',
        (json.dumps(settings, ensure_ascii=False), datetime.now(timezone.utc).isoformat(), DEFAULT_PROFILE_ID)).rowcount
    if not changed:
        raise ValueError('current profile settings do not exist')


def write_item_tag(connection, item, body):
    """保存在线条目的手动标签与单条隐藏决定，保留来源证据。"""
    operation = body.get('operation')
    name = unicodedata.normalize('NFKC', str(body.get('tag') or '')).strip()
    if operation not in {'add', 'remove', 'restore'}:
        raise ValueError('unknown manual tag operation')
    if not 0 < len(name) <= 80 or ',' in name or any(ord(char) < 32 for char in name):
        raise UserValueError('errors.onlineTagManagement.nameInvalid')
    settings = read_settings(connection)
    policy = OnlineTagPolicy(connection)
    canonical = policy.query_name(name)
    key = policy.identity(canonical)[0]
    all_tags = settings.setdefault(ITEM_TAGS_KEY, {})
    all_hidden = settings.setdefault(ITEM_HIDDEN_TAGS_KEY, {})
    tags = list(all_tags.get(policy.item_key(item), []))
    hidden = [tag for tag in all_hidden.get(policy.item_key(item), []) if policy.identity(tag)[0] != key]
    tags = [tag for tag in tags if policy.identity(tag)[0] != key]
    if operation == 'add':
        if len(tags) >= 100:
            raise UserValueError('errors.onlineTagManagement.itemTagLimit')
        tags.append(canonical)
    elif operation == 'remove':
        hidden.append(canonical)
    if tags:
        all_tags[policy.item_key(item)] = tags
    else:
        all_tags.pop(policy.item_key(item), None)
    if hidden:
        all_hidden[policy.item_key(item)] = hidden
    else:
        all_hidden.pop(policy.item_key(item), None)
    _save_settings(connection, settings)
