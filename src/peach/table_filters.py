"""列筛选解析、截断前匹配和分面计数。"""
import json
from collections import Counter
from datetime import date

from .user_messages import UserValueError

MEDIA_RANGE_READERS = {
    "size": lambda row: row.get("size"),
    "dur": lambda row: row.get("duration") or None,
}


def _range_bound(value, kind):
    if kind == "date" and isinstance(value, str):
        try:
            return date.fromisoformat(value).isoformat() == value
        except ValueError:
            return False
    return (type(value) in (int, float) and -(2**53 - 1) <= value <= 2**53 - 1
            and kind != "date" and (kind == "timestamp" or value >= 0))


def _read_range(selection, kind):
    bounds = selection.get("range") if isinstance(selection, dict) and set(selection) == {"range"} else None
    if not isinstance(bounds, dict) or not bounds or set(bounds) - {"min", "max"}:
        raise UserValueError("api.catalog.invalidColumnFilters")
    if not all(_range_bound(value, kind) for value in bounds.values()):
        raise UserValueError("api.catalog.invalidColumnFilters")
    if "min" in bounds and "max" in bounds:
        lower, upper = bounds["min"], bounds["max"]
        if lower > upper or (kind == "timestamp" and lower == upper):
            raise UserValueError("api.catalog.invalidColumnFilters")
    return {"range": bounds}


def range_limits(bounds, kind):
    """时间上限是下个自然日的起点，其余上限含边界。"""
    return [(op, bounds[key]) for key, op in (("min", ">="), ("max", "<" if kind == "timestamp" else "<="))
            if key in bounds]


def in_range(value, bounds, kind="number"):
    if not _range_bound(value, kind):
        return False
    lower, upper = bounds.get("min"), bounds.get("max")
    return (lower is None or value >= lower) and (
        upper is None or (value < upper if kind == "timestamp" else value <= upper))


def column_filters(raw, allowed, ranges=None):
    """多选保留包含、排除语义。只有声明为范围的列接受范围。"""
    if raw is None or raw == '':
        return {}
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        raise UserValueError('api.catalog.invalidColumnFilters') from None
    ranges = ranges or {}
    if not isinstance(value, dict) or set(value) - (set(allowed) | set(ranges)):
        raise UserValueError('api.catalog.invalidColumnFilters')
    selected = {}
    for column, selection in value.items():
        if column in ranges:
            selected[column] = _read_range(selection, ranges[column])
            continue
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


def filter_rows(rows, raw, columns, *, ranges=None):
    """按原始字节或秒数筛选后再分页，未取得的体积和时长保留为空。"""
    ranges = ranges or {}
    selected = column_filters(raw, columns, dict.fromkeys(ranges, "number"))
    values = [{key: set(read(row)) or {"none"} for key, read in columns.items()} for row in rows]

    def matches(row, value, except_column=None):
        for key, selection in selected.items():
            if key == except_column:
                continue
            if key in ranges:
                if not in_range(ranges[key](row), selection["range"]):
                    return False
                continue
            exclude = isinstance(selection, dict)
            overlap = bool(value[key].intersection(selection["exclude"] if exclude else selection))
            if overlap == exclude:
                return False
        return True

    facets = {}
    for key in columns:
        counts = Counter(option for row, value in zip(rows, values) if matches(row, value, key) for option in value[key])
        facets[key] = [{"id": option, "count": count} for option, count in sorted(counts.items())]
    return [row for row, value in zip(rows, values) if matches(row, value)], facets
