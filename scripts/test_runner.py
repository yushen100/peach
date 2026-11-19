"""Run Peach's unittest suite by a documented product scope."""
from __future__ import annotations

import argparse
import ast
import fnmatch
import importlib
import json
import math
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from collections.abc import Iterable
from contextlib import ExitStack, contextmanager, nullcontext
from functools import lru_cache, partial
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / "tests"

if not __package__:
    sys.path.insert(0, str(ROOT))
    __package__ = "scripts"
from . import change_impact, test_evidence, test_history, test_resume, test_run_progress, test_shard_results, test_slots
from .test_inputs import repository_paths_read_by as repository_paths_read_by

#: 给人看的输出用哪种语言。作为脚本运行时 `__main__` 在把测试固定到源语言之前记下本机语言；
#: 被导入时为空，跟当时的环境走。
OUTPUT_LANGUAGE: str | None = None


def t(key: str, **values) -> str:
    """开发工具文字（`scripts/locales/<语言>/dev.json`）。测试进程的 `PEACH_LANGUAGE` 固定为源语言，
    运行器自己的输出仍按 `OUTPUT_LANGUAGE` 显示。"""
    from peach.interface_text import DEV_LOCALES, local_language, text
    return text(f"dev:{key}", values, OUTPUT_LANGUAGE or local_language(), root=DEV_LOCALES)


#: 阶段名是测试记录 `phases` 的键，保持原样；给人看时换成当前语言。
PHASE_KEYS = {"输入快照": "phaseSnapshot", "历史记录": "phaseHistory", "恢复规划": "phasePlanning",
              "测试执行": "phaseExecution", "结束核验": "phaseVerification",
              "快速门槛": "phaseGates", "普通测试": "phaseRegular"}


def phase_label(name: str) -> str:
    return t(f"test_runner.{PHASE_KEYS[name]}") if name in PHASE_KEYS else name

COMMON_PATTERNS = ("test_context_budget.py", "test_test_collection.py", "test_complexity_ratchet.py",
                   "test_source_assertion_ratchet.py", "test_python_lint.py", "test_user_messages.py")

#: 域、补充用例、路径映射与 CI 职责的登记表在 `scripts/scope_registry.toml`：纯数据，只增登记不触发全量。
REGISTRY = change_impact.load_registry(ROOT / change_impact.REGISTRY)
SCOPES: dict[str, tuple[str, ...]] = {name: tuple(items) for name, items in REGISTRY["scopes"].items()}
SCOPE_TEST_IDS: dict[str, tuple[str, ...]] = {name: tuple(items) for name, items in REGISTRY["scope_test_ids"].items()}
AUTO_SCOPE_FILES: dict[str, tuple[str, ...]] = {path: tuple(items) for path, items in REGISTRY["auto_scope_files"].items()}
AUTO_SCOPE_PREFIXES: tuple[tuple[str, tuple[str, ...]], ...] = tuple(
    (prefix, tuple(items)) for prefix, items in REGISTRY["auto_scope_prefixes"])
CI_FRONTEND_TESTS = frozenset(REGISTRY["ci"]["frontend_tests"])
CI_BROWSER_TESTS = frozenset(REGISTRY["ci"]["browser_tests"])
TOOLING_WORKFLOWS = frozenset(REGISTRY["ci"]["tooling_workflows"])


# AGENTS.md 规定必须跑 `full` 的面：迁移、共享测试设施、依赖清单。命中任一个就不再选域。
FULL_ONLY_PREFIXES: tuple[str, ...] = (
    'frontend/node_modules/',
    "pyproject.toml",
    "scripts/test_runner.py", "scripts/test_evidence.py", "scripts/ci_test_evidence.py", "scripts/test.ps1", "scripts/test.sh",
    "scripts/ci_plan.py", "scripts/test_environment.py", "scripts/change_impact.py", "scripts/test_focus.py",
    "scripts/test_history.py", "uv.lock",
    "scripts/test_resume.py", "scripts/test_run_progress.py", "scripts/test_environment_identity.py",
    "scripts/test_shard_results.py", "scripts/test_inputs.py", "scripts/test_slots.py",
    "migrations/",
    "tests/support/",
    "package.json",
    "package-lock.json",
    "frontend/package.json",
    "frontend/package-lock.json",
)


def selected_files(scope: str, *, root: Path | None = None) -> tuple[Path, ...]:
    """一个域选中的测试文件。`auto` 也会按文件补选：这时 `scope` 就是测试文件名本身。"""
    tests = TESTS if root is None else root / "tests"
    if scope.endswith(".py"):
        return (tests / scope,) if (tests / scope).is_file() else ()
    if scope == "full":
        return tuple(sorted(tests.glob("test_*.py")))
    found: set[Path] = set()
    for pattern in (*COMMON_PATTERNS, *SCOPES[scope]):
        found.update(tests.glob(pattern))
    return tuple(sorted(found))


def scopes_of_test_file(name: str) -> tuple[str, ...]:
    """一个 `tests/test_*.py` 文件名登记在哪些域里；公共门槛文件归 tooling。"""
    scopes = tuple(scope for scope, patterns in SCOPES.items() if scope not in {"core", "packaging"}
                   if any(fnmatch.fnmatch(name, pattern) for pattern in patterns))
    if not scopes and any(fnmatch.fnmatch(name, pattern) for pattern in COMMON_PATTERNS):
        return ("tooling",)
    if not scopes:
        # 只登记在 core 或 packaging 的文件（如 `test_ledger_revision.py`）跑登记它的那个域。
        return tuple(scope for scope in ("core", "packaging")
                     if any(fnmatch.fnmatch(name, pattern) for pattern in SCOPES[scope]))
    return scopes


def scopes_of_module(stem: str) -> tuple[str, ...]:
    """`src/peach/<stem>.py` 按测试文件名推断域：`test_<stem>.py` 或 `test_<stem>_*.py`。"""
    exact, prefix = f"test_{stem}.py", f"test_{stem}_"
    return tuple(scope for scope, patterns in SCOPES.items() if scope not in {"core", "packaging"}
                 if any(fnmatch.fnmatch(exact, pattern) or pattern.startswith(prefix)
                        for pattern in patterns))


def _imported_modules(path: Path, *, root: Path | None = None) -> frozenset[str]:
    """一个 Python 文件导入了 `peach` 下哪些顶层模块（含函数里的延迟导入），以及 `scripts` 下的
    哪些模块（记作 `scripts.<名字>`）。"""
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError, UnicodeError, ValueError):
        return frozenset()
    root = ROOT if root is None else root
    return _imported_peach(tree, path, root) | _imported_scripts(tree, path.parent == root / "scripts")


def _imported_scripts(tree: ast.AST, inside: bool) -> frozenset[str]:
    """`import scripts.x`、`from scripts import x`、`from scripts.x import y`；脚本目录里另认 `from . import x`。"""
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(alias.name.split(".")[1] for alias in node.names if alias.name.startswith("scripts."))
            continue
        if not isinstance(node, ast.ImportFrom):
            continue
        module = node.module or ""
        if node.level == 1 and inside or node.level == 0 and module == "scripts":
            found.update([module.split(".")[0]] if module and node.level else (alias.name for alias in node.names))
        elif node.level == 0 and module.startswith("scripts."):
            found.add(module.split(".")[1])
    return frozenset("scripts." + name for name in found)


def _imported_peach(tree: ast.AST, path: Path, root: Path) -> frozenset[str]:
    source = root / "src" / "peach"
    depth = len(path.relative_to(source).parts) if path.is_relative_to(source) else None
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(alias.name.split(".")[1] for alias in node.names
                         if alias.name.startswith("peach."))
        elif isinstance(node, ast.ImportFrom):
            parts = (node.module or "").split(".") if node.module else []
            if node.level:
                # 相对导入回到 `peach` 包根要退的层数等于文件在包里的深度。
                if depth is None or node.level != depth:
                    continue
                parts = ["peach", *parts]
            if parts[:1] != ["peach"]:
                continue
            found.update([parts[1]] if len(parts) > 1 else (alias.name for alias in node.names))
    return frozenset(found)


@lru_cache(maxsize=None)
def _import_index(root: Path = ROOT) -> tuple[dict[str, frozenset[str]], dict[str, frozenset[str]], frozenset[str]]:
    """测试文件、`src/peach` 下的文件与 `tests/support` 各自导入的 `peach` 模块。"""
    tests = {path.name: _imported_modules(path, root=root) for path in (root / "tests").glob("test_*.py")}
    sources = {path.relative_to(root).as_posix(): _imported_modules(path, root=root)
               for path in (root / "src" / "peach").rglob("*.py")}
    support = frozenset(name for path in (root / "tests/support").glob("*.py")
                        for name in _imported_modules(path, root=root))
    return tests, sources, support


@lru_cache(maxsize=None)
def script_consumers(root: Path = ROOT) -> dict[str, frozenset[str]]:
    """`scripts/<stem>.py` → 导入它的测试文件，沿 `scripts/` 内部的导入链传递。

    与 `src/peach` 不同，脚本之间的导入链有界（单个脚本最多牵到十来个测试文件），传递下去才不会
    漏掉经 `agent_worktree` 用到 `co_author` 这类间接消费者。不穿过 `peach` 包。"""
    scripts = {path.stem: {name.removeprefix("scripts.") for name in _imported_modules(path, root=root)
                           if name.startswith("scripts.")} for path in (root / "scripts").glob("*.py")}
    tests, _, _ = _import_index(root)
    found: dict[str, set[str]] = {}
    for name, modules in tests.items():
        todo = [module.removeprefix("scripts.") for module in modules if module.startswith("scripts.")]
        seen: set[str] = set()
        while todo:
            stem = todo.pop()
            if stem in scripts and stem not in seen:
                seen.add(stem)
                todo.extend(scripts[stem])
        for stem in seen:
            found.setdefault(stem, set()).add(name)
    return {stem: frozenset(names) for stem, names in found.items()}


_LOCALE_FILE = re.compile(r"resources/locales/[^/]+/(?:server|cli)\.json")
_PLACEHOLDER = re.compile(r"\{\{[^}]*\}\}")


def locale_file(path: str) -> bool:
    """后端语言资源：经 `interface_text` 渲染给 API、托盘与命令行的文字。"""
    return bool(_LOCALE_FILE.fullmatch(path))


def _flat_texts(source: str | None) -> dict[str, str]:
    try:
        data = json.loads(source) if source else {}
    except ValueError:
        return {}
    found, todo = {}, [("", data)]
    while todo:
        prefix, node = todo.pop()
        if isinstance(node, dict):
            todo.extend((f"{prefix}{key}.", value) for key, value in node.items())
        elif isinstance(node, str):
            found[prefix[:-1]] = node
    return found


@lru_cache(maxsize=None)
def _test_literals(root: Path) -> dict[str, tuple[str, ...]]:
    """各测试文件源码里的字符串字面量：条目键与断言里的原文都写在这里。"""
    found = {}
    for path in (root / "tests").glob("test_*.py"):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except (OSError, SyntaxError, UnicodeError, ValueError):
            found[path.name] = (path.read_text(encoding="utf-8", errors="replace"),)
            continue
        found[path.name] = tuple(node.value for node in ast.walk(tree)
                                 if isinstance(node, ast.Constant) and isinstance(node.value, str))
    return found


def _mentions(literals: tuple[str, ...], index: dict[str, list[str]]) -> bool:
    """字面量里是否出现任一要找的片段；按片段前 6 个字符建索引，逐位查表再核对整段。"""
    for literal in literals:
        for start in range(len(literal) - 5):
            for needle in index.get(literal[start:start + 6], ()):
                if literal.startswith(needle, start):
                    return True
    return False


@lru_cache(maxsize=64)
def locale_readers(root: Path, before: str | None, after: str | None) -> frozenset[str]:
    """改动的语言条目的读者：源码里写了条目键，或在断言里写了旧原文片段的测试文件。

    没有前后内容时按整份文件的全部条目算，宁多勿漏。"""
    old, new = _flat_texts(before), _flat_texts(after)
    keys = {key for key in old.keys() | new.keys() if old.get(key) != new.get(key)} if before and after         else set(old) | set(new)
    needles = {key for key in keys if len(key) >= 6}
    short = {key for key in keys if len(key) < 6}
    for key in keys:
        needles.update(piece.strip() for piece in _PLACEHOLDER.split(old.get(key) or new.get(key) or "")
                       if len(piece.strip()) >= 6)
    index: dict[str, list[str]] = {}
    for needle in needles:
        index.setdefault(needle[:6], []).append(needle)
    return frozenset(name for name, literals in _test_literals(root).items()
                     if _mentions(literals, index) or any(key in literal for key in short for literal in literals))


def file_consumers(path: str, kind: str, contents: dict | None, root: Path) -> frozenset[str]:
    """按文件补选的测试：导入改动脚本的测试，以及读改动语言条目的测试。"""
    if kind in {"unsafe", "prose"}:
        return frozenset()
    if path.startswith("scripts/") and path.endswith(".py") and "/" not in path.removeprefix("scripts/"):
        return script_consumers(root).get(path.removeprefix("scripts/").removesuffix(".py"), frozenset())
    if locale_file(path):
        before, after = (contents or {}).get(path, (None, None))
        if before is None and after is None and (root / path).is_file():
            after = (root / path).read_text(encoding="utf-8")
        return locale_readers(root, before, after)
    return frozenset()


def scopes_of_importers(stem: str, seen: frozenset[str] = frozenset(), *,
                        root: Path = ROOT) -> tuple[str, ...]:
    """按名字推不出测试的 `src/peach/<stem>.py`：取直接导入它的测试所在的域，加上直接导入它
    的源码文件按本表推出的域。

    和按名字推断同一层级：认的是「谁直接用它」，不沿导入链一路扩散——函数里的延迟导入把几乎
    所有模块连成一团，传递闭包等于全量。导入者自己也推不出域时，按同一规则继续往上取，
    互相导入的一组模块合起来算。
    共享测试设施 `tests/support` 用到它、或者谁都不直接导入它，返回空，由调用方按未知面跑 full。
    """
    tests, sources, support = _import_index(root)
    if stem in support:
        return ()
    found: set[str] = set()
    for name, modules in tests.items():
        if stem in modules:
            found.update(scopes_of_test_file(name))
    for path, modules in sources.items():
        if stem in modules and path != f"src/peach/{stem}.py":
            importer = path.rsplit("/", 1)[-1].removesuffix(".py")
            nested = "/" in path.removeprefix("src/peach/")
            if not nested and importer in seen:
                # 互相导入的一组模块：正在求值的那一层已经在收它自己的导入者。
                continue
            scopes = mapped_scopes(path, seen | {stem}, root=root) if nested or importer != "__init__" else ()
            if not scopes:
                return ()
            found.update(scopes)
    return tuple(scope for scope in SCOPES if scope in found)


def dependency_inputs(source: str) -> dict:
    """提取依赖输入，供调用方比较构建与运行环境。"""
    return change_impact.dependency_inputs(source)


def changed_contents(root: Path, base: str, paths: Iterable[str]) -> dict:
    result = {}
    for path in paths:
        if not (path.endswith(".py") or path in {*change_impact.PACKAGE_FILES, "pyproject.toml", change_impact.REGISTRY}
                or locale_file(path)):
            continue
        try:
            raw = "\n".join((
                test_evidence.git(root, "diff", "--raw", base, "--", path),
                test_evidence.git(root, "diff", "--raw", "--cached", base, "--", path),
            ))
            modes = [[part.lstrip(":") for part in row.split()[:2]] for row in raw.splitlines()]
            if any("120000" in pair or (len(pair) == 2 and "000000" not in pair and pair[0] != pair[1])
                   for pair in modes):
                result[path] = (None, None)
                continue
            result[path] = (test_evidence.git(root, "show", f"{base}:{path}"),
                            (root / path).read_text(encoding="utf-8"))
        except (OSError, subprocess.CalledProcessError):
            pass
    return result


def special_scopes(path: str, kind: str) -> tuple[str, ...] | None:
    """内容类型、共享设施和工作流职责的优先边界。"""
    if path == change_impact.REGISTRY:
        if kind.startswith("registration:"):
            added = [scope for scope in kind.removeprefix("registration:").split(",") if scope]
            if all(scope in SCOPES for scope in added):
                # checks 里的选测计划与登记完整性门槛核对新增登记。
                return tuple(scope for scope in SCOPES if scope in {"checks", *added})
        return ("checks",) if kind == "prose" else ("full",)
    if kind == "unsafe":
        return ("full",)
    if kind == "prose":
        return ("checks",)
    if kind == "metadata":
        return ("packaging",)
    if kind == "version":
        return ("tooling",)
    if path == "scripts/copy-rules.json":
        return ("checks", "web")
    if change_impact.documentation(path):
        return AUTO_SCOPE_FILES.get(path, ("checks",))
    if path.startswith(("scripts/build_", "scripts/release_")) \
            or path in {".github/workflows/release.yml", ".github/workflows/upgrade-smoke.yml"}:
        return ("packaging", "tooling")
    if path.startswith(".github/workflows/"):
        return ("tooling",) if path in TOOLING_WORKFLOWS else ("full",)
    if path.rsplit("/", 1)[-1] == "conftest.py" or any(path.startswith(p) for p in FULL_ONLY_PREFIXES):
        return ("full",)
    return None


def mapped_scopes(path: str, seen: frozenset[str] = frozenset(), *, root: Path = ROOT) -> tuple[str, ...]:
    """按显式映射、测试归属、模块测试名和直接导入者定位功能域。"""
    name = path.rsplit("/", 1)[-1]
    if path in AUTO_SCOPE_FILES:
        return AUTO_SCOPE_FILES[path]
    if path.startswith("tests/test_") and path.endswith(".py"):
        return scopes_of_test_file(name)
    for prefix, scope in AUTO_SCOPE_PREFIXES:
        if path.startswith(prefix):
            return (scope,) if isinstance(scope, str) else scope
    if path.startswith("src/peach/") and path.endswith(".py"):
        stem = name.removesuffix(".py")
        by_name = scopes_of_module(stem)
        if by_name or "/" in path.removeprefix("src/peach/") or stem == "__init__":
            return by_name
        return scopes_of_importers(stem, seen, root=root)
    return ()


def scopes_for_changes(paths: Iterable[str], *, contents: dict | None = None,
                       kinds: dict | None = None, root: Path | None = None) -> tuple[tuple[str, ...], str]:
    """由目标源码树、改动清单与可选内容差异选择验证范围。"""
    root = ROOT if root is None else root
    picked: dict[str, list[str]] = {}
    full_reasons = []
    for raw in paths:
        path = raw.replace("\\", "/").strip("/")
        if not path:
            continue
        kind = (kinds or {}).get(path, "logic")
        if contents and path in contents:
            kind = change_impact.kind(path, *contents[path])
        scopes = special_scopes(path, kind)
        if scopes is None:
            scopes = mapped_scopes(path, root=root)
        if kind not in {"unsafe", "prose"} and path.startswith("src/peach/") and path.endswith(".py") \
                and scopes and "full" not in scopes:
            stem = path.removeprefix("src/peach/").split("/", 1)[0].removesuffix(".py")
            tests, _, _ = _import_index(root)
            consumers = {scope for name, modules in tests.items() if stem in modules
                         for scope in scopes_of_test_file(name)}
            scopes = tuple(scope for scope in SCOPES if scope in {*scopes, *consumers})
        if not scopes:
            full_reasons.append(t("test_runner.noDomain", path=path))
        elif "full" in scopes:
            full_reasons.append(t("test_runner.fullSurface", path=path))
        else:
            for scope in (*scopes, *sorted(file_consumers(path, kind, contents, root))):
                picked.setdefault(scope, []).append(path)
    if full_reasons:
        return ("full",), "Peach auto scope: full <- " + "; ".join(full_reasons)
    if not picked:
        return ("checks",), "Peach auto scope: checks <- " + t("test_runner.noChanges")
    ordered = ordered_scopes(picked, root)
    detail = "; ".join(f"{scope}: {', '.join(picked[scope])}" for scope in ordered)
    return ordered, f"Peach auto scope: {', '.join(ordered)} <- {detail}"


def ordered_scopes(picked, root: Path) -> tuple[str, ...]:
    """域按登记顺序在前，按文件补选的测试名排在后面；已被选中的域覆盖的测试名不再单列。"""
    domains = tuple(scope for scope in SCOPES if scope in picked)
    covered = {path.name for scope in domains for path in selected_files(scope, root=root)}
    return domains + tuple(sorted(scope for scope in picked if scope.endswith(".py") and scope not in covered))


def changed_files(root: Path = ROOT, base: str = "master") -> list[str]:
    """分支相对 `base` 的提交、工作区已改动的文件和未跟踪文件，三者并集。"""
    commands = (
        ("git", "diff", "--name-only", "-z", f"{base}...HEAD"),
        ("git", "diff", "--name-only", "-z", "HEAD"),
        ("git", "ls-files", "--others", "--exclude-standard", "-z"),
    )
    found: set[str] = set()
    for command in commands:
        command = ("git", "-c", f"safe.directory={root.as_posix()}", *command[1:])
        output = subprocess.run(command, cwd=root, capture_output=True, text=True,
                                encoding="utf-8", check=True).stdout
        found.update(part for part in output.split("\0") if part)
    return sorted(found)


def resolve_auto_scope() -> tuple[tuple[str, ...], str]:
    try:
        paths = changed_files()
    except (OSError, subprocess.CalledProcessError) as error:
        return ("full",), "Peach auto scope: full <- " + t("test_runner.gitUnavailable", error=error)
    return scopes_for_changes(paths, contents=changed_contents(ROOT, "master", paths))


def ci_frontend_delegated() -> bool:
    """Test 工作流的 Python 与浏览器任务由 web-bundle 承担前端工具检查。"""
    return (os.environ.get("GITHUB_ACTIONS") == "true"
            and os.environ.get("GITHUB_WORKFLOW") == "Test"
            and os.environ.get("GITHUB_JOB") in {"python", "web-e2e"})


def without_ci_frontend_tests(suite: unittest.TestSuite) -> unittest.TestSuite:
    """按完整用例 ID 分配 CI 职责，保留同模块的产物与样式契约。"""
    selected = unittest.TestSuite()
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            selected.addTests(without_ci_frontend_tests(test))
        elif test.id() not in CI_FRONTEND_TESTS and not (
                os.environ.get("GITHUB_JOB") == "python" and test.id() in CI_BROWSER_TESTS):
            selected.addTest(test)
    return selected


def build_suite(*scopes: str, shard_index: int = 0, shard_count: int = 1,
                assigned_names: Iterable[str] | None = None) -> unittest.TestSuite:
    """本片的用例；本机父进程或 Windows CI 按耗时分配，其余按文件名轮转。"""
    loader = unittest.defaultTestLoader
    suite = unittest.TestSuite()
    files = sorted({path for scope in scopes for path in selected_files(scope)})
    if assigned_names is None:
        assigned = assigned_files(files, shard_index, shard_count)
    else:
        assigned = {TESTS / name for name in assigned_names}
        if not assigned <= set(files):
            raise ValueError(t("test_runner.shardOutsideScope",
                               files=str(sorted(p.name for p in assigned - set(files)))))
    sys.path[:0] = [str(ROOT), str(TESTS)]
    try:
        for path in sorted(assigned):
            suite.addTests(loader.loadTestsFromModule(importlib.import_module(path.stem)))
        for scope in scopes:
            for test_id in SCOPE_TEST_IDS.get(scope, ()):
                # 补充用例以模块名稳定分配；每个 shard 只运行自己的一份。
                module = TESTS / (test_id.split(".", 1)[0] + ".py")
                if module not in files and sum(test_id.split(".", 1)[0].encode()) % shard_count == shard_index:
                    suite.addTests(loader.loadTestsFromName(test_id))
    finally:
        del sys.path[:2]
    return without_ci_frontend_tests(suite) if ci_frontend_delegated() else suite


def assigned_files(files: Iterable[Path], index: int, count: int) -> set[Path]:
    """Windows 独立 CI 分片共用固定耗时表，本机与未知任务保持原分配。"""
    files = sorted(files)
    if (count > 1 and ci_frontend_delegated() and os.environ.get("GITHUB_JOB") == "python"
            and os.environ.get("RUNNER_OS") == "Windows"):
        seconds = json.loads((ROOT / "scripts/ci-python-timings.json").read_text(encoding="utf-8"))["seconds"]
        groups = shard_plan((path.name for path in files), count, seconds, prior_seconds={})
        return {TESTS / name for name in groups[index]} if index < len(groups) else set()
    return set(files[index::count])


class TimedResult(unittest.TextTestResult):
    """逐用例耗时，外加逐文件墙钟。

    文件墙钟按「本条结束距上一条结束」累计：类级 `setUpClass` 发生在首条用例开始之前，
    只量用例本身会漏掉建库、起服务那一段，而分片均衡要的正是整份文件占多久。
    """

    def __init__(self, *args, selection=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.timings = []
        self.files: dict[str, float] = {}
        self.results: list[dict] = []
        self.outcome: dict[str, tuple[str, str | None]] = {}
        self.last = time.monotonic()
        self.selection = selection or {}
        self.selection_context = None

    def startTestRun(self):
        self.last = time.monotonic()
        self.thread_errors = []
        self.previous_thread_hook = threading.excepthook
        threading.excepthook = self._thread_error
        super().startTestRun()

    def _thread_error(self, args):
        self.thread_errors.append((args.thread.name, (args.exc_type, args.exc_value, args.exc_traceback)))
        self.previous_thread_hook(args)

    def stopTestRun(self):
        threading.excepthook = self.previous_thread_hook
        for name, error in self.thread_errors:
            self.addError(unittest.suite._ErrorHolder(f"background thread {name}"), error)
        self.thread_errors.clear()
        super().stopTestRun()

    def startTest(self, test):
        if self.selection and test.id() in test_resume.CONTAINERS:
            self.selection_context = test_resume.selection_environment(
                self.selection, test_resume.owner('case:' + test.id()))
            self.selection_context.__enter__()
        self.started = time.monotonic()
        super().startTest(test)

    def stopTest(self, test):
        try:
            now = time.monotonic()
            self.timings.append((round(now - self.started, 3), test.id()))
            outcome, message = self.outcome.pop(test.id(), ("pass", None))
            self.results.append(test_history.result(test.id(), outcome, now - self.started, message))
            module = type(test).__module__
            self.files[module] = round(self.files.get(module, 0.0) + now - self.last, 3)
            self.last = now
            super().stopTest(test)
        finally:
            if self.selection_context is not None:
                self.selection_context.__exit__(None, None, None)
                self.selection_context = None

    def _mark(self, test, outcome: str, err=None) -> None:
        message = f"{err[0].__name__}: {err[1]}" if err else None
        if type(test).__name__ == "_ErrorHolder":
            # 类级或模块级准备失败：没有对应的 startTest/stopTest，直接记一条。
            self.results.append(test_history.result(test.id(), outcome, 0.0, message))
            return
        if self.outcome.get(test.id(), ("pass",))[0] in {"pass", "skip"}:
            self.outcome[test.id()] = (outcome, message)

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self._mark(test, "fail", err)

    def addError(self, test, err):
        super().addError(test, err)
        self._mark(test, "error", err)

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self._mark(test, "skip")

    def addUnexpectedSuccess(self, test):
        super().addUnexpectedSuccess(test)
        self._mark(test, "fail", (AssertionError, "预期失败的用例通过了"))

    def addSubTest(self, test, subtest, err):
        super().addSubTest(test, subtest, err)
        if err is not None:
            self._mark(test, "fail" if issubclass(err[0], test.failureException) else "error", err)


TIMINGS_FILE = "test-timings.json"


def file_seconds_path() -> Path:
    """本机各测试文件的实测墙钟，存在共享记录目录：不进 Git，也不进代码快照。"""
    return test_evidence.evidence_dir(ROOT) / TIMINGS_FILE


def load_file_seconds(path: Path | None = None) -> dict[str, float]:
    try:
        path = file_seconds_path() if path is None else path
        seconds = json.loads(path.read_text(encoding="utf-8")).get("seconds", {})
    except (OSError, ValueError, AttributeError, subprocess.CalledProcessError):
        return {}
    return {name: float(value) for name, value in seconds.items()
            if isinstance(name, str) and isinstance(value, (int, float)) and value >= 0}


def save_file_seconds(measured: dict[str, float], path: Path | None = None) -> None:
    """把本次实测并进表里；没跑到的文件保留旧值。几个会话同时写时后到的覆盖，只影响排序。"""
    if not measured or (path is None and test_history.nested()):
        return
    try:
        path = file_seconds_path() if path is None else path
        merged = {**load_file_seconds(path), **{name: round(value, 3) for name, value in measured.items()}}
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
        temporary.write_text(json.dumps({"seconds": dict(sorted(merged.items()))}, indent=1),
                             encoding="utf-8")
        temporary.replace(path)
    except (OSError, subprocess.CalledProcessError):
        pass


DEFAULT_JOBS = 4


def resolve_jobs(value: str) -> int:
    """`--jobs` 的取值：正整数照收，`auto` 使用本机默认并发；显式值无机器级上限。"""
    if value == "auto":
        return max(1, min(DEFAULT_JOBS, (os.cpu_count() or 1) // 2))
    try:
        jobs = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError(t("test_runner.jobsInvalid")) from None
    if jobs < 1:
        raise argparse.ArgumentTypeError(t("test_runner.jobsTooLow"))
    return jobs


def shard_command(scopes: tuple[str, ...], index: int, count: int, timings: Path,
                  plan: Path | None = None, resume_plan: Path | None = None) -> list[str]:
    command = [sys.executable, str(ROOT / "scripts" / "test_runner.py"),
            *(item for scope in scopes for item in ("--scope", scope)),
            "--shard-index", str(index), "--shard-count", str(count),
            "--timings", str(timings)]
    if plan is not None:
        command += ["--shard-plan", str(plan)]
    if resume_plan is not None:
        command += ['--resume-plan', str(resume_plan)]
    return command


#: 没有本机实测时的先验秒数。浏览器冒烟一条用例占十几分钟，必须独占一片并第一个派发，
#: 否则排在中间的那片开跑时其余分片已过半，它一个人拖尾。
PRIOR_SECONDS = {"test_web_e2e.py": 900.0}


def file_weights(names: Iterable[str], seconds: dict[str, float],
                 prior_seconds: dict[str, float] | None = None) -> dict[str, float]:
    """各测试文件的预计秒数：取本机实测，没测过的取已测文件的中位数，再不低于先验值。"""
    known = sorted(value for value in seconds.values() if value > 0)
    default = known[len(known) // 2] if known else 1.0
    priors = PRIOR_SECONDS if prior_seconds is None else prior_seconds
    return {name: max(seconds.get(name.removesuffix(".py"), default), priors.get(name, 0.0)) for name in names}


#: 待跑文件的预计串行耗时达到全量的这个比例，就和全量一样占满整机名额（ADR-0172）。
#: 只看标签不够：`auto` 选中多个域时跑的文件数接近全量，负载也一样。
FULL_LOAD_SHARE = 0.6


def takes_every_slot(names: Iterable[str]) -> bool:
    seconds = load_file_seconds()
    total = sum(file_weights([path.name for path in selected_files("full")], seconds).values())
    return total > 0 and sum(file_weights(names, seconds).values()) >= FULL_LOAD_SHARE * total


def shard_plan(names: Iterable[str], shard_count: int,
               seconds: dict[str, float], *, prior_seconds: dict[str, float] | None = None) -> list[list[str]]:
    """按预计秒数把测试文件装进分片：先长后短，每个文件放进当前最空的一片。

    返回的分片按预计总时长降序排列，派发按这个顺序，最长的先开跑。等负载时按文件数择空。
    实测表按模块名记，
    没测过的文件取已测文件的中位数；表是空的时所有文件等重，相当于按个数均分。
    """
    names = sorted(names)
    weight = file_weights(names, seconds, prior_seconds)
    groups: list[list[str]] = [[] for _ in range(max(1, min(shard_count, len(names))))]
    totals = [0.0] * len(groups)
    for name in sorted(names, key=lambda item: (-weight[item], item)):
        slot = min(range(len(groups)), key=lambda index: (totals[index], len(groups[index]), index))
        groups[slot].append(name)
        totals[slot] += weight[name]
    order = sorted(range(len(groups)), key=lambda index: (-totals[index], index))
    return [sorted(groups[index]) for index in order]


def run_shards(scopes: tuple[str, ...], *, jobs: int, shard_count: int,
               spawn=subprocess.Popen, measured: dict | None = None,
               plan: list[list[str]] | None = None,
               outcomes: list | None = None, checkpoint=None,
               resume_plan: dict | None = None) -> tuple[bool, int, list]:
    """运行独立分片并汇总证明；并发取调用方的 jobs，取消时清理自己的子进程。

    `plan` 是父进程定下的逐片文件名，写成文件交给每个子进程，父子用同一份划分；
    片号即派发顺序。`measured` 收各片报回的逐文件墙钟，`outcomes` 收逐条结果。
    """
    folder = Path(tempfile.mkdtemp(prefix="peach-shards-"))
    plan_path = None
    resume_path = None
    if resume_plan is not None:
        resume_path = folder / 'resume.json'
        resume_path.write_text(json.dumps(resume_plan), encoding='utf8')
    if plan is not None:
        if len(plan) != shard_count:
            raise ValueError(t("test_runner.shardPlanMismatch"))
        plan_path = folder / "plan.json"
        plan_path.write_text(json.dumps(plan), encoding="utf-8")
    pending = list(range(shard_count))
    running = {}
    completed_at, forced = {}, set()
    passed, count, timings = True, 0, []
    try:
        while pending or running:
            while pending and len(running) < jobs:
                index = pending.pop(0)
                log = open(folder / f"{index}.log", "w+", encoding="utf-8", errors="replace")
                try:
                    process = spawn(shard_command(scopes, index, shard_count, folder / f"{index}.json",
                                                  plan_path, resume_path),
                                    stdout=log, stderr=subprocess.STDOUT, cwd=str(ROOT))
                except BaseException:
                    log.close()
                    raise
                running[index] = (process, log)
            finished = test_shard_results.completed_processes(running, folder, completed_at,
                                                               now=time.monotonic(), forced=forced)
            if not finished:
                time.sleep(0.2)
                continue
            for index in finished:
                process, log = running.pop(index)
                log.flush()
                log.seek(0)
                sys.stdout.write(log.read())
                log.close()
                report_path = folder / f"{index}.json"
                report = test_shard_results.read_report(report_path)
                ok = process.returncode == 0 and bool(report.get("success"))
                assigned = plan[index] if plan is not None else sorted({path.name for scope in scopes
                           for path in selected_files(scope)})[index::shard_count]
                complete = None
                if checkpoint is not None:
                    complete = checkpoint(assigned, report, process.returncode == (0 if report.get('success') else 1))
                    ok = ok and complete
                passed = passed and ok
                count += int(report.get("count", 0))
                timings.extend(tuple(item) for item in report.get("timings", []))
                if measured is not None:
                    measured.update(report.get("files", {}))
                if outcomes is not None:
                    outcomes.extend(report.get("results", []))
                coverage = ("coverageComplete" if complete else "coverageIncomplete" if complete is False
                            else "coverageNotRequested")
                print(t("test_runner.shardDone", index=index + 1, count=shard_count,
                        status=t("test_runner.shardPassed" if ok else "test_runner.shardFailed"),
                        cases=report.get('count', 0), code=process.returncode,
                        report=t("test_runner.reportPresent" if report.get('complete') else "test_runner.reportMissing"),
                        coverage=t(f"test_runner.{coverage}")), flush=True)
                if not ok:
                    details = {'files': assigned, 'exit_code': process.returncode,
                               'forced_cleanup': index in forced, 'report_error': report.get('report_error'),
                               'reported_success': report.get('success'), 'coverage_complete': complete,
                               'reported_results': len(report.get('results', []))}
                    print(t("test_runner.shardFailureDetails", details=json.dumps(details, ensure_ascii=False)),
                          flush=True)
    finally:
        for process, log in running.values():
            if process.poll() is None:
                test_shard_results.stop_process_tree(process)
            log.close()
        shutil.rmtree(folder, ignore_errors=True)
    return passed, count, timings


def tools_needed_by(scopes: tuple[str, ...]) -> frozenset[str]:
    """本次选中的测试文件真正会用到的外部工具。

    判据是「选中的源码里出现了这个工具名」，不是一张手写的域到工具的表：测试搬域、
    新测试引入新工具时，手写的表会静静过期，而过期的表比没有表更坏——它会拿一个
    本次根本不启动的工具去挡住一次只改文档的 `checks`。
    """
    if scopes == ('checks',):
        # 文档与仓库契约仅启动 Git 和依赖入口；业务工具名也会出现在调度器的模拟用例中。
        return frozenset({'git', 'uv'})
    names = tuple(name for name, _ in test_evidence.TOOL_PROBES)
    needed: set[str] = set()
    for path in {path for scope in scopes for path in selected_files(scope)}:
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        needed.update(name for name in names if name in source)
    return frozenset(needed)


def environment_preflight(scopes: tuple[str, ...], timings: Path | None = None,
                          *, shard_count: int = 1) -> None:
    """外部工具若被执行权限挡住，在创建测试分片前给出一条可操作的结论。

    只有本次真的会用到的工具才判失败。受限环境里 ffmpeg 起不来是事实，但它不该挡住
    一次只改文档的 `checks`：那一轮一个媒体用例都不加载，硬失败只是把人赶出正式入口。
    其余工具仍然报出来，免得后面的失败被当成别的原因。

    分片子进程直接返回：域由父进程定下，它在切片前查过同一套工具，每片各查一遍只会
    把同一条结论打印 N 遍。
    """
    if shard_count > 1:
        return
    blocked = test_evidence.unspawnable_tools()
    if not blocked:
        return
    if os.environ.get("PEACH_SKIP_PREFLIGHT") == "1":
        print(t("test_runner.preflightSkipped", tools=blocked), flush=True)
        return
    needed = tools_needed_by(scopes)
    fatal = tuple(name for name in blocked if name in needed)
    spared = tuple(name for name in blocked if name not in needed)
    if spared:
        print(t("test_runner.toolsSpared", tools=spared), flush=True)
    if not fatal:
        return
    print(t("test_runner.toolsBlocked", tools=fatal), flush=True)
    if timings is not None:
        timings.write_text(json.dumps({"success": False, "count": 0, "timings": []}),
                           encoding="utf-8")
    raise SystemExit(3)


#: 分片之前单独先跑的秒级检查（合计约 1 分钟）：仓库策略、ADR 编号、复杂度与依赖清单。
#: 这几类问题以前要等 20 分钟的全量才报出来；有一项不过就不再起其余分片。
GATE_TESTS = frozenset({
    "test_script_policy", "test_subprocess_encoding", "test_copy_final_state", "test_context_budget",
    "test_source_assertion_ratchet", "test_complexity_ratchet", "test_python_lint",
    "test_outbound_proxy_policy", "test_repo_hygiene", "test_dependency_policy",
    "test_reference_updates", "test_frontend_preflight",
})
#: 失败后单独重跑的文件数上限。失败面更大多半是真回归，重跑只会再白等一轮。
RERUN_LIMIT = 6
#: 浏览器与 vitest 的容器用例：它们的失败由各自的逐条结果说明，重跑只重跑那几个文件。
E2E_CONTAINER = "test_web_e2e."
VITEST_CONTAINER = "test_frontend_build.VitestTests.test_the_island_suite_passes"
#: 本次运行里失败、单独重跑通过的用例；`verified_run` 写进测试记录。
FLAKY: list[str] = []


def rerun_selectors(rows: list[dict]) -> list[str] | None:
    """失败的逐条结果对应的定向选择器；分不出具体文件或失败面过大时返回 None。"""
    failed = [str(row.get("id", "")) for row in rows if row.get("outcome") in {"fail", "error"}]
    e2e = sorted({item.split(" > ")[0].removeprefix("e2e:") for item in failed if item.startswith("e2e:")})
    vitest = sorted({item.split(" > ")[0].removeprefix("vitest:") for item in failed if item.startswith("vitest:")})
    python = []
    for item in failed:
        if item.startswith(("e2e:", "vitest:")):
            continue
        name = item.split(" ")[0]
        if (name in CI_BROWSER_TESTS and any('frontend/' + path in test_resume.container_files(ROOT, name)
                                              for path in e2e)) or (name == VITEST_CONTAINER and vitest):
            continue
        if not re.fullmatch(r"test_\w+(?:\.\w+)+", name):
            holder = re.search(r'\((test_\w+)(?:\.\w+)?\)', item)
            if holder:
                python.append(holder.group(1))
                continue
            return None
        if name in CI_BROWSER_TESTS or name == VITEST_CONTAINER:
            # 类级准备失败、或浏览器容器整个没起来：没有可单独重跑的那一条。
            return None
        python.append(name)
    if not failed or len({name.split(".")[0] for name in python}) + len(e2e) + len(vitest) > RERUN_LIMIT:
        return None
    return [*dict.fromkeys(python), *(f"frontend/{name}" for name in e2e), *(f"frontend/{name}" for name in vitest)]


def rerun_failures(rows: list[dict], spawn=subprocess.run) -> bool:
    """把全量里失败的文件单独重跑一次：通过的记为偶发，仍失败或无法隔离的照常算失败。"""
    selectors = rerun_selectors(rows)
    if not selectors:
        return False
    print(t("test_runner.rerunning", count=len(selectors), tests=', '.join(selectors)), flush=True)
    command = [sys.executable, str(ROOT / "scripts" / "test_runner.py"),
               *(item for selector in selectors for item in ("--focus", selector))]
    # 重跑要在低负载下进行：本次运行已持有名额时就在它的名额里跑（分片此时都已结束），
    # 没有名额的定向调试先排 1 个，不和别的会话的重负载同时跑。
    with machine_slots("rerun", full=False):
        returncode = spawn(command, cwd=str(ROOT), check=False).returncode
    if returncode != 0:
        print(t("test_runner.rerunStillFailed"), flush=True)
        return False
    FLAKY[:] = selectors
    print(t("test_runner.flakyPassed", tests=', '.join(selectors)), flush=True)
    report_flaky(selectors)
    return True


def report_flaky(selectors: list[str]) -> None:
    """偶发写进测试历史供排行；在 GitHub Actions 上同时标成警告并写进作业摘要，PR 上看得见。"""
    if test_history.nested():
        return
    test_history.append_flaky(ROOT, selectors)
    if not os.environ.get("GITHUB_ACTIONS"):
        return
    print(f"::warning title={t('test_runner.flakyTitle')}::"
          + t("test_runner.flakyWarning", tests=', '.join(selectors)), flush=True)
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write(f"### {t('test_runner.flakySummaryHeading')}\n\n"
                         + "".join(f"- `{name}`\n" for name in selectors) + "\n")


def local_batches(names, jobs):
    """先跑快速检查与前端容器，再跑普通分片。每个文件只分配一次。"""
    gate = sorted(name for name in names if name.removesuffix('.py') in GATE_TESTS)
    heavy = sorted(name for name in names if name.removesuffix('.py') in HEAVY_FILES and name not in gate)
    light = sorted(set(names) - set(gate) - set(heavy))
    batches = [('快速门槛', [gate], 1)] if gate else []
    batches.extend((name.removesuffix('.py'), [[name]], 1) for name in heavy)
    if light:
        batches.append(('普通测试', shard_plan(light, min(len(light), 4 * jobs), load_file_seconds()), jobs))
    return batches


def run_local_suite(scopes: tuple[str, ...], jobs: int, label: str | None = None,
                    *, progress=None) -> tuple[bool, int, list]:
    """按调用方选择的并发运行，串行全量通过分片释放测试缓存。"""
    chosen = {path for scope in scopes for path in selected_files(scope)}
    original = set(chosen)
    progress_args = {}
    if progress is not None:
        chosen = {path for path in chosen if path.name in progress.modules}
        progress_args = {'checkpoint': progress.checkpoint, 'resume_plan': progress.child_plan(scopes)}
    FLAKY.clear()
    if len(chosen) > 1:
        measured: dict[str, float] = {}
        rows: list[dict] = []
        passed, count, timings = True, 0, []
        for stage, plan, concurrency in local_batches([path.name for path in chosen], jobs):
            print(t("test_runner.stageStart", stage=phase_label(stage), shards=len(plan),
                    processes=min(concurrency, len(plan))), flush=True)
            with test_run_progress.phase(progress.phases if progress is not None else {}, stage):
                if jobs == 1 and 'full' not in scopes:
                    assigned = {path for path in chosen if path.name in {name for group in plan for name in group}}
                    ok, more, slow = run_serial_suite(scopes, assigned, original, progress, label)
                else:
                    ok, more, slow = run_shards(scopes, jobs=concurrency, shard_count=len(plan), measured=measured,
                                                plan=plan, outcomes=rows, **progress_args)
            passed, count, timings = passed and ok, count + more, [*timings, *slow]
            if not ok and stage == '快速门槛':
                print(t("test_runner.gatesFailed"), flush=True)
                save_file_seconds(measured)
                test_history.append(ROOT, scope=label or " ".join(scopes), rows=rows,
                                    files=[name.removesuffix(".py") for name in plan[0]])
                return False, count, timings
            if progress is not None:
                progress_args['resume_plan'] = progress.child_plan(scopes)
        save_file_seconds(measured)
        test_history.append(ROOT, scope=label or " ".join(scopes), rows=rows,
                            files=[path.stem for path in sorted(chosen)])
        if not passed and rows:
            passed = rerun_failures(rows)
        return passed, count, timings
    return run_serial_suite(scopes, chosen, original, progress, label)


def run_serial_suite(scopes, chosen, original, progress, label):
    """串行执行同一恢复计划，提交与分片相同的文件结果。"""
    selection = progress.child_plan(scopes) if progress is not None else {}
    planned = {'assigned_names': [path.name for path in sorted(chosen)]} if chosen != original else {}
    suite = build_suite(*scopes, **planned)
    if progress is not None:
        suite = test_resume.filter_suite(suite, selection, {path.name for path in chosen}, unittest.TestSuite)
    with test_history.running():
        result = unittest.TextTestRunner(verbosity=2, resultclass=partial(TimedResult, selection=selection)).run(suite)
    save_file_seconds(result.files)
    rows = result.results + test_history.take_external()
    test_history.append(ROOT, scope=label or " ".join(scopes), rows=rows,
                        files=[path.stem for path in sorted(chosen)])
    passed = result.wasSuccessful() and result.testsRun > 0
    if progress is not None:
        complete = progress.checkpoint([path.name for path in chosen], {
            'success': passed, 'count': result.testsRun, 'files': result.files, 'results': rows,
            'complete': True}, True)
        passed = passed and complete
    return passed, result.testsRun, result.timings


def run_shard_child(args, requested, scopes, files) -> int:
    """分片子进程：跑父进程（或 CI）分给本片的文件，把成败、耗时与逐条结果写给父进程。"""
    planned = {}
    if args.shard_plan is not None:
        planned["assigned_names"] = json.loads(
            args.shard_plan.read_text(encoding="utf-8"))[args.shard_index]
    selection = {}
    if args.resume_plan is not None:
        selection = test_resume.validate_child_plan(ROOT,
            json.loads(args.resume_plan.read_text(encoding='utf8')),
            state=test_evidence.key(ROOT), valid_seconds=test_evidence.VALID_SECONDS)
        allowed = {name for scope in scopes for name in SCOPE_TEST_IDS.get(scope, ())}
        allowed.update(name for names in SCOPE_TEST_IDS.values() for name in names
                       if test_resume.owner('case:' + name) in {path.name for path in files})
        allowed.update(case for case in test_resume.CONTAINERS
                       if test_resume.owner('case:' + case) in {path.name for path in files})
        if not set(selection.get('case_universe', ())) <= allowed:
            raise ValueError(t("test_runner.resumePlanOutside"))
    suite = build_suite(*scopes, shard_index=args.shard_index, shard_count=args.shard_count, **planned)
    if selection:
        suite = test_resume.filter_suite(suite, selection, set(planned.get('assigned_names', ())), unittest.TestSuite)
    with test_history.running():
        result = unittest.TextTestRunner(verbosity=2, resultclass=partial(TimedResult, selection=selection)).run(suite)
    success = result.wasSuccessful() and result.testsRun > 0
    rows = result.results + test_history.take_external()
    if args.timings is not None:
        temporary = args.timings.with_suffix('.json.tmp')
        temporary.write_text(json.dumps({"success": success, "count": result.testsRun,
                                            "timings": result.timings, "files": result.files,
                                            "results": rows, 'complete': True}, ensure_ascii=False),
                                encoding="utf-8")
        temporary.replace(args.timings)
    if args.shard_plan is None:
        # CI 的独立分片没有父进程替它汇总，自己写一次历史。
        names = sorted(path.name for path in assigned_files(files, args.shard_index, args.shard_count))
        test_history.append(ROOT, scope=f"{' '.join(requested)}:{' '.join(scopes)} "
                            f"shard {args.shard_index + 1}/{args.shard_count}",
                            rows=rows, files=[name.removesuffix(".py") for name in names])
        # 独立分片同样先把失败文件单独重跑一次，不让一个负载偶发把整片判红、只能整片重跑。
        if not success and rows:
            success = rerun_failures(rows)
    return 0 if success else 1


def scope_name(value: str) -> str:
    """`--scope` 的取值：`full`、`auto`、登记的域，或 `auto` 按文件补选的测试文件名。"""
    if value in ("full", "auto", *SCOPES) or change_impact.EXACT_TEST.fullmatch(value) and (TESTS / value).is_file():
        return value
    raise argparse.ArgumentTypeError(t("test_runner.unknownScope", scope=value))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    # `--scope` 可重复：本机并行的父进程把 `auto` 算出来的几个域原样交给每个分片子进程。
    parser.add_argument("--scope", action="append", dest="scopes", type=scope_name)
    reuse = parser.add_mutually_exclusive_group()
    reuse.add_argument("--fresh", action="store_true", help=t("test_runner.helpFresh"))
    reuse.add_argument("--resume", action="store_true", help=t("test_runner.helpResume"))
    parser.add_argument("--focus", action="append", default=[], help=t("test_runner.helpFocus"))
    parser.add_argument("--rerun-failures", action="store_true",
                        help=t("test_runner.helpRerunFailures"))
    parser.add_argument("--full-lock-held", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--lock-timeout", type=float, default=math.inf,
                        help=t("test_runner.helpLockTimeout"))
    parser.add_argument("--base", default="master", help=t("test_runner.helpBase"))
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--timings", type=Path, default=None,
                        help=t("test_runner.helpTimings"))
    parser.add_argument("--shard-plan", type=Path, default=None,
                        help=t("test_runner.helpShardPlan"))
    parser.add_argument('--resume-plan', type=Path, default=None, help=argparse.SUPPRESS)
    parser.add_argument("--jobs", type=resolve_jobs, default=1,
                        help=t("test_runner.helpJobs"))
    parser.add_argument("--list-scopes", action="store_true")
    args = parser.parse_args(argv)
    if not args.lock_timeout >= 0:
        parser.error(t("test_runner.lockTimeoutRange"))
    if args.shard_count < 1 or not 0 <= args.shard_index < args.shard_count:
        parser.error(t("test_runner.shardRange"))
    if args.list_scopes:
        print("\n".join(("full", "auto", *SCOPES)))
        return 0
    if args.resume_plan is not None and args.shard_plan is None:
        parser.error(t("test_runner.resumePlanParentOnly"))
    if args.rerun_failures and not args.focus:
        parser.error(t("test_runner.rerunFailuresFocusOnly"))
    try:
        test_slots.slot_count()
    except ValueError as error:
        parser.error(str(error))
    if args.focus:
        return run_focus(parser, args)
    if os.environ.get("PEACH_TEST_FOCUS") or os.environ.get("PEACH_E2E_FILES") or os.environ.get("PEACH_VITEST_FILES"):
        parser.error(t("test_runner.focusEnvironment"))
    requested: tuple[str, ...] = tuple(dict.fromkeys(args.scopes or ("auto",)))
    if "auto" in requested and len(requested) > 1:
        parser.error(t("test_runner.autoAlone"))
    scopes = requested
    if requested == ("auto",):
        if args.base == "master":
            scopes, explanation = resolve_auto_scope()
        else:
            paths = changed_files(ROOT, args.base)
            scopes, explanation = scopes_for_changes(paths, contents=changed_contents(ROOT, args.base, paths))
        print(explanation, flush=True)
    environment_preflight(scopes, args.timings, shard_count=args.shard_count)
    files = {path for scope in scopes for path in selected_files(scope)}
    print(f"Peach test scope: {' '.join(scopes)} ({len(files)} files)", flush=True)
    if args.shard_count > 1 or args.shard_plan is not None:
        # CI 的每片独立 runner，或父进程派出的分片（含只有一片的快速门槛）；分片绝不签发本机记录。
        return run_shard_child(args, requested, scopes, files)
    if ci_frontend_delegated():
        print(t("test_runner.ciFrontendDelegated"), flush=True)
        success, count, _ = run_local_suite(scopes, args.jobs, f"{' '.join(requested)}:{' '.join(scopes)}")
        return 0 if success and count > 0 else 1
    try:
        with full_suite_guard(parser, args, scopes):
            return verified_run(args, requested, scopes, files)
    except test_evidence.Timeout as error:
        return busy(error)
    except test_slots.SlotTimeout as error:
        print(error, flush=True)
        return 2


def full_suite_guard(parser, args, scopes):
    """全量验证取得仓库的全量锁。集成入口持锁补验时，由它派出的运行器沿用那把锁，
    否则子进程会等父进程放锁、父进程等子进程结束，互等到超时。"""
    if args.full_lock_held:
        lock = test_evidence.evidence_dir(ROOT) / "full-suite.lock"
        try:
            holder = json.loads(test_evidence.holder_path(lock).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            holder = {}
        if not _is_ancestor(holder.get("pid")):
            parser.error(t("test_runner.fullLockHeldOnly"))
        return nullcontext()
    if "full" not in scopes:
        return nullcontext()
    return test_evidence.held(test_evidence.evidence_dir(ROOT) / "full-suite.lock", wait_seconds=args.lock_timeout,
                              scope=" ".join(scopes), root=str(ROOT))


def _is_ancestor(pid: object) -> bool:
    """持锁的集成进程是否在本进程的祖先链上。

    Windows 的 venv `python.exe` 是启动器，会再派出真正的解释器：直接父进程是那层启动器，
    持锁的集成进程还在它上面。"""
    if not isinstance(pid, int):
        return False
    if pid == os.getppid():
        return True
    import psutil
    try:
        return any(parent.pid == pid for parent in psutil.Process().parents())
    except psutil.Error:
        return False


def run_focus(parser, args) -> int:
    """定向调试不签发记录；含浏览器用例或点了较多文件时占 1 个整机名额。"""
    if args.shard_count != 1:
        parser.error(t("test_runner.focusWithShards"))
    from . import test_focus
    guard = machine_slots("focus", full=False) if test_slots.focus_needs_slot(args.focus) else nullcontext()
    try:
        with guard:
            return test_focus.run(sys.modules[__name__], args)
    except test_slots.SlotTimeout as error:
        print(error, flush=True)
        return 2


def machine_slots(scope: str, *, full: bool):
    """整机测试名额（ADR-0172）：全量取满，其余取 1 个。

    CI、持有名额的运行派出的子进程，以及用例里调用运行器时都不排队，否则会自己等自己。"""
    if test_slots.exempt() or test_history.nested():
        return nullcontext()
    total = test_slots.slot_count()
    return test_slots.held(total if full else 1, total=total, scope=scope, root=str(ROOT))


#: 内部并行的前端与浏览器容器，和普通分片按阶段执行。
HEAVY_FILES = frozenset({"test_web_e2e", "test_frontend_build"})


def busy(error) -> int:
    lock = Path(error.lock_file)
    what = t("test_runner.busyFullSuite" if lock.name == "full-suite.lock" else "test_runner.busySameState")
    print(t("test_runner.busy", what=what, holder=test_evidence.describe_holder(lock)), flush=True)
    return 2


def verified_run(args, requested, scopes, files) -> int:
    """在调用方持有的全量锁内取得快照、验证并签发记录。"""
    started = time.monotonic()
    phases = {}
    force = args.fresh or ('full' in requested and not args.resume)
    with test_run_progress.phase(phases, '输入快照'):
        context = test_evidence.inputs(ROOT)
    state = context["state"]
    with test_evidence.run_lock(ROOT, state, scope=" ".join(scopes), root=str(ROOT)), ExitStack() as slots:
        if not force and test_evidence.covers(
                test_evidence.read(ROOT, state), scopes):
            print(t("test_runner.reused"), flush=True)
            return 0
        with test_run_progress.phase(phases, '历史记录'):
            previous = test_evidence.read(ROOT, state)
            records = list(test_evidence.candidates(ROOT, context))
        with test_run_progress.phase(phases, '恢复规划'):
            progress = test_run_progress.RunProgress(ROOT, context, scopes, selected_files, scopes_for_changes, SCOPES,
                       supplements=SCOPE_TEST_IDS, records=records, previous=previous,
                       force=force)
            if requested == ('auto',) and not force:
                choices = ('full', *SCOPES) if 'full' in scopes else scopes
                scopes = test_resume.choose_scopes(progress.pending, progress.requirements, choices)
        progress.phases = phases
        actual = len(progress.modules)
        print(t("test_runner.actualRun", scopes=' '.join(scopes) or t("test_runner.nothingToRun"), count=actual),
              flush=True)
        if records and not force:
            print(t("test_runner.coverage", reused=len(progress.required) - len(progress.pending),
                    pending=len(progress.pending)), flush=True)
        if progress.pending:
            # 锁的顺序固定：全量锁、同状态锁、整机名额；只有真要跑用例时才排名额。
            pending = {path.name for scope in scopes for path in selected_files(scope)} & set(progress.modules)
            slots.enter_context(machine_slots(" ".join(requested), full=takes_every_slot(pending)))
        progress.start()
        FLAKY.clear()
        with test_run_progress.phase(phases, '测试执行'):
            passed, count, timings = run_local_suite(scopes, args.jobs, f"{' '.join(requested)}:{' '.join(scopes)}",
                                                    progress=progress) if progress.pending else (True, 0, [])
        if passed:
            progress.accept_success(FLAKY)
        with test_run_progress.phase(phases, '结束核验'):
            stable = state == test_evidence.key(ROOT)
            success = passed and stable and progress.complete()
        slowest = sorted(timings, reverse=True)[:20]
        progress.persist(final=True, success=success, elapsed=time.monotonic() - started,
                         slowest=slowest, count=count, flaky=FLAKY if success else None)
        print(t("test_runner.phaseTimings", phases=t("common.clauseSeparator").join(
            f'{phase_label(name)} {seconds:.2f}s' for name, seconds in phases.items())), flush=True)
        for seconds, name in slowest[:5]:
            print(t("test_runner.slowTest", seconds=f"{seconds:.3f}", name=name), flush=True)
        if not stable:
            kept = progress.retain_current()
            print(t("test_runner.inputsChanged", kept=kept), flush=True)
            return 4
        return 0 if success else 1


RUN_TEMP = "PEACH_TEST_RUN_TEMP"
RUN_TEMP_PREFIX = "peach-test-run-"
TEMP_VARIABLES = ("TEMP", "TMP", "TMPDIR")


def _force_remove(function, path, _error) -> None:
    """Windows 上 Git 对象是只读文件，去掉只读再删一次；仍删不掉就留给下一次清扫。"""
    try:
        os.chmod(path, stat.S_IWRITE)
        function(path)
    except OSError:
        pass


def sweep_stale_runs(base: Path, now: float | None = None) -> None:
    """被强行结束的运行来不及删自己的目录；目录名里记着创建时刻，超过一天的整个删掉。"""
    now = time.time() if now is None else now
    for path in base.glob(f"{RUN_TEMP_PREFIX}*"):
        stamp = re.match(rf"{RUN_TEMP_PREFIX}(\d+)-", path.name)
        if stamp and path.is_dir() and now - int(stamp.group(1)) > 86400:
            shutil.rmtree(path, onexc=_force_remove)


@contextmanager
def isolated_temp(base: Path | None = None):
    """本次运行专用的临时目录，结束时整个删掉。

    TEMP、TMP、TMPDIR 与 `tempfile.tempdir` 都指向它，用例和它们起的子进程（含本机分片）
    建的临时文件全落在里面，个别用例漏了回收也不会堆进系统 Temp。分片子进程继承父进程的
    目录，不再套一层。
    """
    inherited = os.environ.get(RUN_TEMP)
    if inherited and Path(inherited).is_dir():
        yield Path(inherited)
        return
    base = Path(tempfile.gettempdir()) if base is None else base
    sweep_stale_runs(base)
    saved = {name: os.environ.get(name) for name in (RUN_TEMP, *TEMP_VARIABLES)}
    previous = tempfile.tempdir
    with tempfile.TemporaryDirectory(prefix=f"{RUN_TEMP_PREFIX}{int(time.time())}-", dir=base,
                                     ignore_cleanup_errors=True) as folder:
        os.environ.update(dict.fromkeys((RUN_TEMP, *TEMP_VARIABLES), folder))
        tempfile.tempdir = folder
        try:
            yield Path(folder)
        finally:
            tempfile.tempdir = previous
            for name, value in saved.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value


if __name__ == "__main__":
    # 故障注入的默认错误日志属于当前测试进程，不能写进真实数据目录。
    os.environ["PEACH_REPORTING_TEST_MODE"] = "1"
    # 命令行跟系统语言（ADR-0159 第三条）；测试按源语言断言，不随跑测试那台机器的语言变。
    # 运行器自己的输出仍跟本机语言，先记下来再固定。
    from peach.interface_text import local_language
    OUTPUT_LANGUAGE = local_language()
    os.environ["PEACH_LANGUAGE"] = "zh-CN"
    from peach import error_reporting, remote_reporting
    remote_reporting.disable_for_process()
    with isolated_temp(), tempfile.TemporaryDirectory(prefix='peach-test-errors-') as error_logs:
        error_reporting._log_dir = Path(error_logs)
        raise SystemExit(main())
