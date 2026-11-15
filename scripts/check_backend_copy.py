"""源码里的中文字符串逐文件只减不增（ADR-0159 第六条）。

界面文字只在 `resources/locales/` 里，日志与命令行用英文，所以 `src/peach/` 里的中文字符串都在计数之内：
带不带 code、是报错、日志还是命令行输出都算。docstring 不算；内容数据文件（`CONTENT_FILES`：标签词表、
汉字转换表、番号与标题规则的词表、页面原词与账本取值）整份不算。内容数据文件只放数据，按 `src/peach/` 下的
相对路径登记：带逻辑的模块整份列入，以后在里面新加的界面文字就拦不住了，数据要拆到这些文件里再导入。

`scripts/` 下的开发工具同一口径另记一份：输出文字在 `scripts/locales/<语言>/dev.json`，日志固定英文，
脚本里剩下的中文是内容数据（匹配词表、写进账本或被读回比对的取值）与读不到资源的几个脚本；
上限记在 `scripts/dev-copy-baseline.json`，整份只有数据的脚本登记在 `DEV_CONTENT_FILES`。

用法：
  python scripts/check_backend_copy.py          列出超过基线的文件，有就以 1 退出
  python scripts/check_backend_copy.py --write  按当前计数收紧基线：只调低、删掉归零的文件，不调高
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "peach"
BASELINE = ROOT / "scripts" / "backend-copy-baseline.json"
DEV_BASELINE = ROOT / "scripts" / "dev-copy-baseline.json"
SERVER_LOCALES = ROOT / "resources" / "locales"
if str(SOURCE.parent) not in sys.path:
    sys.path.insert(0, str(SOURCE.parent))
from peach.interface_text import dev as t  # noqa: E402

HAN = re.compile(r"[㐀-鿿]")
#: 内容数据：词表与规则里的中文是数据本身，不是界面文字。键是 `src/peach/` 下的相对路径。
CONTENT_FILES = {
    "genre_taxonomy.py",      # 标签的中文规范名、别名与分组
    "javdb_genres.py",        # JavDB 类别名到本地标签的对照
    "kanji.py",               # 繁简与日文汉字转换表
    "catalog_rules.py",       # 番号、标题、转载站与特典版的识别词
    "catalog_vocabulary.py",  # 账本与复核产物里的约定取值：标签前缀、画幅与版次取值、分档、决定备注
    "content_words.py",       # 文件名、目录名、网盘回执与来源页面里认的原词，账本里的通用链接标签
    "source_page_words.py",   # 资料站页面上的原文栏名、站名、记号与日期写法
    "studio_words.py",        # 厂牌官网与公司资料判据的页面原词、复核判词与按厂牌名索引的取图来源
    "taste_words.py",         # 口味维度匹配词、停用词、馆藏规范标签名与成人站标题记号
    "junk_words.py",          # 推广套话、推广品牌、推广目录形态与分卷标记
    "release_words.py",       # GitHub Release 正文里认的折叠标题与旧版下载段标题
}
#: 开发工具里整份只有数据的脚本，键是 `scripts/` 下的相对路径；数据和输出混在一起的脚本照常计数。
DEV_CONTENT_FILES = {
    "legacy_values.py",  # 旧版复核产物与续跑日志里的中文取值到英文 id 的对照
    "release_download_text.py",  # Release 正文下载段的中英文模板
}
CODE_KEYWORDS = {"code", "message_code"}
CODED_CALLS = {"message_fields", "UserFacingError", "UserValueError", "UserRuntimeError", "UserPermissionError",
               "UserOSError", "UserTimeoutError", "UserInterruptedError", "CodePatternError"}
#: 一个 code 是用点分开的 camelCase 段，末段可以是带连字符的显示表 id。
CODE_SHAPE = re.compile(r"^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9][A-Za-z0-9-]*)+$")


def _call_name(call: ast.Call) -> str:
    func = call.func
    return func.attr if isinstance(func, ast.Attribute) else func.id if isinstance(func, ast.Name) else ""


def _docstrings(tree: ast.AST) -> set[int]:
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.body:
            first = node.body[0]
            if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
                found.add(id(first.value))
    return found


def count_literals(name: str, source: str, content: set[str] = CONTENT_FILES) -> int:
    """一个模块里的中文字符串条数（`name` 是相对 `content` 那一侧根目录的路径）。f-string 整条算一处；内容数据文件记 0。"""
    if Path(name).as_posix() in content:
        return 0
    tree = ast.parse(source)
    parents = {id(child): node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
    skip = _docstrings(tree)
    total = 0
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if id(node) in skip or isinstance(parents.get(id(node)), ast.JoinedStr) or not HAN.search(node.value):
                continue
        elif isinstance(node, ast.JoinedStr):
            if not any(isinstance(part, ast.Constant) and HAN.search(str(part.value)) for part in node.values):
                continue
        else:
            continue
        total += 1
    return total


def scan(root: Path = ROOT) -> dict[str, int]:
    """`src/peach/` 各模块的中文字符串条数。"""
    counts = {}
    for path in sorted((root / "src" / "peach").rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        found = count_literals(path.relative_to(root / "src" / "peach").as_posix(), path.read_text(encoding="utf-8"))
        if found:
            counts[path.relative_to(root).as_posix()] = found
    return counts


def scan_scripts(root: Path = ROOT) -> dict[str, int]:
    """`scripts/` 下各开发工具的中文字符串条数，同一口径，内容数据看 `DEV_CONTENT_FILES`。"""
    counts = {}
    for path in sorted((root / "scripts").glob("*.py")):
        found = count_literals(path.name, path.read_text(encoding="utf-8"), DEV_CONTENT_FILES)
        if found:
            counts[path.relative_to(root).as_posix()] = found
    return counts


def raised(counts: dict[str, int], baseline: dict[str, int]) -> dict[str, int]:
    """超过基线的文件；不在基线里的文件上限是 0。"""
    return {name: count for name, count in counts.items() if count > baseline.get(name, 0)}


def tightened(counts: dict[str, int], baseline: dict[str, int] | None) -> dict[str, int]:
    """收紧后的基线：每个文件取当前计数与原上限的较小值，归零的删掉；还没有基线时按当前计数记第一份。"""
    if baseline is None:
        return dict(counts)
    return {name: min(count, baseline[name]) for name, count in counts.items() if name in baseline}


def codes_in(source: str) -> set[str]:
    """源码里写死的 message code：`code=`／`message_code=` 关键字、`message_fields`、`UserFacingError` 及其子类的第一个参数、
    字典里 `message_code` 键的值，以及名字以 `_CODE` 结尾的常量。"""
    found = set()
    tree = ast.parse(source)
    # 同一模块里继承 `UserFacingError` 的异常类，构造方式与它相同。
    coded = CODED_CALLS | {node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)
                           and any(isinstance(base, ast.Name) and base.id in CODED_CALLS for base in node.bases)}
    for node in ast.walk(tree):
        values: list[ast.AST] = []
        if isinstance(node, ast.Call):
            values += [kw.value for kw in node.keywords if kw.arg in CODE_KEYWORDS]
            if _call_name(node) in coded and node.args:
                values.append(node.args[0])
        elif isinstance(node, ast.Dict):
            values += [value for key, value in zip(node.keys, node.values)
                       if isinstance(key, ast.Constant) and key.value == "message_code"]
        elif isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id.endswith("_CODE") for target in node.targets):
                values.append(node.value)
        found |= {value.value for value in values
                  if isinstance(value, ast.Constant) and isinstance(value.value, str) and CODE_SHAPE.match(value.value)}
    return found


def used_codes(root: Path = ROOT) -> set[str]:
    return set().union(*(codes_in(path.read_text(encoding="utf-8"))
                         for path in (root / "src" / "peach").rglob("*.py") if "__pycache__" not in path.parts))


def server_keys(language: str, root: Path = ROOT) -> set[str]:
    """`server` 命名空间里的全部键，写成点分路径。"""
    def walk(tree: dict, prefix: str = "") -> set[str]:
        keys = set()
        for key, value in tree.items():
            keys |= walk(value, f"{prefix}{key}.") if isinstance(value, dict) else {prefix + key}
        return keys
    locales = SERVER_LOCALES if root == ROOT else root / "resources" / "locales"
    return walk(json.loads((locales / language / "server.json").read_text(encoding="utf-8")))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=t("check_backend_copy.description"))
    parser.add_argument("--write", action="store_true", help=t("check_backend_copy.writeHelp"))
    args = parser.parse_args(argv)
    failed = False
    for path, counts in ((BASELINE, scan()), (DEV_BASELINE, scan_scripts())):
        baseline = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None
        over = raised(counts, baseline or {}) if baseline is not None else {}
        for name, count in over.items():
            print(t("check_backend_copy.raised", file=name, count=count, baseline=(baseline or {}).get(name, 0)))
        failed = failed or bool(over)
        if args.write:
            limits = tightened(counts, baseline)
            path.write_text(json.dumps(limits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
            print(t("check_backend_copy.written", path=path.relative_to(ROOT).as_posix(), files=len(limits),
                    count=sum(limits.values())))
    if not failed and not args.write:
        print(t("check_backend_copy.clean"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
