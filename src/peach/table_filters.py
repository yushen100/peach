"""列多选解析、截断前筛选和分面计数共用的纯规则。"""
import json
from collections import Counter

from .user_messages import UserValueError


def column_filters(raw, allowed):
    """解析列头多选，缺少分组表示全选，空数组表示不选，exclude 保存排除项。"""
    if raw is None or raw == '':
        return {}
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        raise UserValueError('api.catalog.invalidColumnFilters') from None
    if not isinstance(value, dict) or set(value) - set(allowed):
        raise UserValueError('api.catalog.invalidColumnFilters')
    selected = {}
    for column, selection in value.items():
        exclude = isinstance(selection, dict)
        if exclude and set(selection) != {'exclude'}:
            raise UserValueError('api.catalog.invalidColumnFilters')
        values = selection['exclude'] if exclude else selection
        if not isinstance(values, list) or any(not isinstance(item, str) or not item.strip() for item in values):
            raise UserValueError('api.catalog.invalidColumnFilters')
        if column == 'people' and any(
                ':' not in item or item.split(':', 1)[0] not in {'performer', 'creator', 'owner'}
                or not item.split(':', 1)[1] or (item.startswith('owner:') and item != 'owner:none') for item in values):
            raise UserValueError('api.catalog.invalidColumnFilters')
        unique = list(dict.fromkeys(values))
        selected[column] = {'exclude': unique} if exclude else unique
    return selected


def filter_rows(rows, raw, columns):
    selected = column_filters(raw, columns)
    values = [{key: set(read(row)) or {"none"} for key, read in columns.items()} for row in rows]

    def matches(value, except_column=None):
        for key, selection in selected.items():
            if key == except_column:
                continue
            exclude = isinstance(selection, dict)
            overlap = bool(value[key].intersection(selection["exclude"] if exclude else selection))
            if overlap == exclude:
                return False
        return True

    facets = {}
    for key in columns:
        counts = Counter(option for value in values if matches(value, key) for option in value[key])
        facets[key] = [{"id": option, "count": count} for option, count in sorted(counts.items())]
    return [row for row, value in zip(rows, values) if matches(value)], facets
