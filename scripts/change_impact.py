"""比较检查输入的有效内容；解析失败与执行权限变化保留完整验证。"""
from __future__ import annotations

import ast
from functools import lru_cache
import hashlib
import json
from pathlib import PurePosixPath
import re
import tomllib


PACKAGE_FILES = frozenset({"package.json", "frontend/package.json"})
DISPLAY_FIELDS = frozenset({"description", "keywords"})


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def dependency_inputs(source: str) -> dict:
    """提取 Python 构建、解释器与依赖输入。"""
    data = tomllib.loads(source)
    project = data.get("project", {})
    uv = dict(data.get("tool", {}).get("uv", {}))
    uv.pop("required-version", None)
    return {"build": data.get("build-system"), "requires-python": project.get("requires-python"),
            "dependencies": project.get("dependencies"), "extras": project.get("optional-dependencies"),
            "groups": data.get("dependency-groups"), "uv": uv}


@lru_cache(maxsize=2048)
def signatures(path: str, source: str) -> dict[str, object]:
    """返回可比较的内容指纹；docstring、类型注释和运行时字串参与比较。"""
    try:
        if path.endswith(".py"):
            tree = ast.parse(source, type_comments=True)
            return {"behavior": digest(ast.dump(tree, include_attributes=False))}
        if path == REGISTRY:
            entries = registry(source)
            return {"behavior": digest(entries), "registry": entries}
        if path in PACKAGE_FILES:
            data = json.loads(source)
            if not isinstance(data, dict):
                return {}
            return {"behavior": digest({key: value for key, value in data.items() if key not in DISPLAY_FIELDS})}
        if path == "pyproject.toml":
            return {"behavior": digest(tomllib.loads(source)), "dependencies": digest(dependency_inputs(source))}
    except (ValueError, TypeError, SyntaxError, RecursionError):
        return {}
    return {}


#: 选测登记表：纯数据，`test_runner` 读取；不属于执行协议，按登记差异选测（ADR-0151 修订）。
REGISTRY = "scripts/scope_registry.toml"
REGISTRY_SECTIONS = ("scopes", "scope_test_ids", "auto_scope_files", "auto_scope_prefixes", "ci")
EXACT_TEST = re.compile(r"test_[A-Za-z0-9_]+\.py")
_NAME = re.compile(r"[a-z]+")


def _strings(value) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _named_lists(value, *, names: bool) -> bool:
    return isinstance(value, dict) and all(isinstance(key, str) and (not names or _NAME.fullmatch(key))
                                           and _strings(items) for key, items in value.items())


def valid_registry(value) -> bool:
    """登记表的规范形状：域名为小写字母，前缀表是有序的 `[前缀, [域…]]`。"""
    if not isinstance(value, dict) or tuple(value) != REGISTRY_SECTIONS:
        return False
    prefixes = value["auto_scope_prefixes"]
    return (_named_lists(value["scopes"], names=True) and _named_lists(value["scope_test_ids"], names=True)
            and _named_lists(value["auto_scope_files"], names=False) and _named_lists(value["ci"], names=False)
            and isinstance(prefixes, list) and all(
                isinstance(row, list) and len(row) == 2 and isinstance(row[0], str) and _strings(row[1])
                for row in prefixes))


def registry(source: str) -> dict:
    """解析登记表为规范形状；结构不对抛 ValueError。"""
    data = tomllib.loads(source)
    if not isinstance(data, dict) or set(data) != set(REGISTRY_SECTIONS):
        raise ValueError("scope registry sections")
    rows = data["auto_scope_prefixes"]
    if not isinstance(rows, list) or not all(isinstance(row, dict) and set(row) == {"prefix", "scopes"} for row in rows):
        raise ValueError("scope registry prefixes")
    entries = {name: data[name] for name in REGISTRY_SECTIONS}
    entries["auto_scope_prefixes"] = [[row["prefix"], row["scopes"]] for row in rows]
    if not valid_registry(entries):
        raise ValueError("scope registry shape")
    return entries


def load_registry(path) -> dict:
    return registry(path.read_text(encoding="utf-8"))


def _first_match(rows: list, path: str) -> list[str]:
    return next((scopes for prefix, scopes in rows if path.startswith(prefix)), [])


def _list_growth(before: dict, after: dict, *, exact: bool) -> set[str] | None:
    """按域比较 `{域: [条目]}`：只许每个域的条目变多；返回条目变多的域。"""
    if not set(before) <= set(after):
        return None
    grown = set()
    for name, items in after.items():
        old = before.get(name, [])
        added = set(items) - set(old)
        if not set(old) <= set(items) or (exact and not all(EXACT_TEST.fullmatch(item) for item in added)):
            return None
        if added:
            grown.add(name)
    return grown


def _prefix_growth(before: list, after: list) -> set[str] | None:
    """前缀表只许插入新前缀、扩大已有前缀的域；删除、改序或让后面的已有前缀失效都不算。"""
    known = [prefix for prefix, _ in before]
    kept = [row for row in after if row[0] in known]
    if [prefix for prefix, _ in kept] != known or len({prefix for prefix, _ in after}) != len(after):
        return None
    affected: set[str] = set()
    for (_, old), (_, new) in zip(before, kept):
        if not set(old) <= set(new):
            return None
        affected.update(set(new) - set(old))
    for index, (prefix, scopes) in enumerate(after):
        if prefix in known:
            continue
        if any(later.startswith(prefix) for later, _ in after[index + 1:] if later in known):
            return None
        affected.update(scopes, _first_match(before, prefix))
    return affected


def registry_growth(before: dict, after: dict) -> tuple[str, ...] | None:
    """登记表只增不减时返回相关的新旧域；任何删除、缩小、改序或 `[ci]` 变化返回 None。"""
    if not valid_registry(before) or not valid_registry(after) or before["ci"] != after["ci"]             or list(before["scopes"]) != list(after["scopes"]):
        return None
    scopes = _list_growth(before["scopes"], after["scopes"], exact=True)
    cases = _list_growth(before["scope_test_ids"], after["scope_test_ids"], exact=False)
    files = _list_growth(before["auto_scope_files"], after["auto_scope_files"], exact=False)
    prefixes = _prefix_growth(before["auto_scope_prefixes"], after["auto_scope_prefixes"])
    if scopes is None or cases is None or files is None or prefixes is None:
        return None
    affected = scopes | cases | prefixes
    for path in files | (set(after["auto_scope_files"]) - set(before["auto_scope_files"])):
        old = before["auto_scope_files"].get(path) or _first_match(before["auto_scope_prefixes"], path)
        affected.update(after["auto_scope_files"][path], old)
    if not affected <= set(after["scopes"]):
        return None
    return tuple(name for name in after["scopes"] if name in affected)


def kind(path: str, before: str | None, after: str | None) -> str:
    if before is None or after is None:
        return "unsafe"
    return signature_kind(signatures(path, before), signatures(path, after))


def signature_kind(before: dict, after: dict) -> str:
    if before.get("behavior") and before.get("behavior") == after.get("behavior"):
        return "prose"
    if before.get("dependencies") and before.get("dependencies") == after.get("dependencies"):
        return "metadata"
    if (scopes := registry_growth(before.get("registry"), after.get("registry"))) is not None:
        return "registration:" + ",".join(scopes)
    return "logic"


def delta(before: dict, after: dict) -> tuple[list[str], dict[str, str]]:
    """比较两个完整快照，并保留文件执行模式与删除信息。"""
    old, new = before["files"], after["files"]
    paths = sorted(name for name in old.keys() | new.keys() if old.get(name) != new.get(name))
    kinds = {}
    for name in paths:
        first, second = old.get(name), new.get(name)
        if isinstance(first, list) and isinstance(second, list) and first[0] == second[0] and first[2:] == second[2:]:
            kinds[name] = signature_kind(before.get("signatures", {}).get(name, {}),
                                         after.get("signatures", {}).get(name, {}))
        elif isinstance(first, list) and isinstance(second, list):
            kinds[name] = "unsafe"
    if "src/peach/__init__.py" in paths and version_only(before, after):
        kinds["src/peach/__init__.py"] = "version"
    return paths, kinds


def version_only(before: dict, after: dict) -> bool:
    path = "src/peach/__init__.py"
    first, second = before["files"].get(path), after["files"].get(path)
    return isinstance(first, list) and isinstance(second, list) and first[0] == second[0] and first[2:] == second[2:] \
        and before.get("version_body") is not None and before.get("version_body") == after.get("version_body")


def documentation(path: str) -> bool:
    return PurePosixPath(path).suffix == ".md"
