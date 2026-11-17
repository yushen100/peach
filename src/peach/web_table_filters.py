"""内存清单在截断前应用列筛选，并按其他列的条件计算选项。"""
from collections import Counter

from .web_catalog import column_filters


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
