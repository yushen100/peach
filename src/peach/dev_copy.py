"""源码检出的改字工具：定位文案与数量模板，核对文件摘要后保存。"""
from __future__ import annotations
import ast
from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
from string import Formatter

from .user_messages import UserValueError


def files(root: Path):
    yield root / "web/index.html"
    yield root / "src/peach/library_sharing.py"
    yield root / "src/peach/library_processing.py"
    yield root / "src/peach/routes_pages.py"
    yield root / "src/peach/onboarding.py"
    yield root / "src/peach/media_sources.py"
    yield root / "src/peach/release_updates.py"
    yield from sorted((root / "frontend/src").rglob("*.js"))
    yield from sorted((root / "frontend/src").rglob("*.tsx"))
    yield from sorted((root / "frontend/src").rglob("*.ts"))
    # 抽进语言资源的界面文案（ADR-0156）：源文只在 zh-CN，改的是这一份；其他语言经翻译流程跟上。
    yield from sorted((root / "resources/locales/zh-CN").glob("*.json"))


def _template_parts(node: ast.JoinedStr):
    """占位符只命名已有表达式，格式与求值代码由 AST 保管。"""
    fields = {}
    parts = []
    for value in node.values:
        if isinstance(value, ast.Constant):
            parts.append(value.value.replace("{", "{{").replace("}", "}}"))
        else:
            name = value.value.id if isinstance(value.value, ast.Name) else f"value{len(fields) + 1}"
            while name in fields:
                name += "_"
            fields[name] = value
            parts.append("{" + name + "}")
    return "".join(parts), fields


def _python_candidates(source: str, original: str):
    tree = ast.parse(source)
    inside_template = {id(child) for node in ast.walk(tree) if isinstance(node, ast.JoinedStr)
                       for child in ast.walk(node) if child is not node}
    lines = source.splitlines(keepends=True)

    def offset(line, column):
        return sum(map(len, lines[:line - 1])) + len(lines[line - 1].encode("utf-8")[:column].decode("utf-8"))

    for node in ast.walk(tree):
        if id(node) in inside_template:
            continue
        extra = {}
        if isinstance(node, ast.JoinedStr):
            template, fields = _template_parts(node)
            parsed = list(Formatter().parse(template))
            if not any(literal.strip() for literal, _, _, _ in parsed):
                continue
            pattern = "".join(re.escape(literal) + (f"(?P<{name}>.*?)" if name else "")
                              for literal, name, _, _ in parsed)
            match = re.fullmatch(pattern, original, re.DOTALL)
            if not match or not fields:
                continue
            extra = {"template": template, "values": match.groupdict()}
        elif not isinstance(node, ast.Constant) or node.value != original:
            continue
        yield {"start": offset(node.lineno, node.col_offset),
               "end": offset(node.end_lineno, node.end_col_offset), "line": node.lineno,
               "quote": "", "python": True, **extra}


def _python_replacement(source: str, selected: dict, replacement: str):
    expression = source[selected["start"]:selected["end"]]
    if "template" not in selected:
        return (json.dumps(replacement, ensure_ascii=False) if expression.startswith('"') else repr(replacement)), replacement
    node = ast.parse("(" + expression + ")", mode="eval").body
    _, fields = _template_parts(node)
    values, rendered, used = [], [], []
    try:
        for literal, name, spec, conversion in Formatter().parse(replacement):
            if literal:
                values.append(ast.Constant(literal))
                rendered.append(literal)
            if name is not None:
                if name not in fields or spec or conversion:
                    raise ValueError("placeholder not in the original template")
                used.append(name)
                values.append(deepcopy(fields[name]))
                rendered.append(selected["values"][name])
    except ValueError as error:
        raise UserValueError("errors.devCopy.placeholdersChanged", {"open": "{{", "close": "}}"}) from error
    if Counter(used) != Counter(fields.keys()):
        raise UserValueError("errors.devCopy.placeholdersIncomplete")
    return ast.unparse(ast.JoinedStr(values)), "".join(rendered)


_LOCALE_VALUE = re.compile(r':\s*"(?P<raw>(?:[^"\\]|\\.)*)"')
_I18N_FIELD = re.compile(r"\{\{\s*(\w+)(?:\s*,\s*number)?\s*\}\}")


def _locale_candidates(source: str, original: str):
    """语言资源里带 {{名字}} 占位的值（ADR-0156）：按页面上显示的整句反查，编辑时占位写成 {名字}。"""
    for match in _LOCALE_VALUE.finditer(source):
        value = json.loads('"' + match.group("raw") + '"')
        if "{{" not in value:
            continue
        pieces = _I18N_FIELD.split(value)
        names = pieces[1::2]
        if not names or len(set(names)) != len(names) or not "".join(pieces[0::2]).strip():
            continue
        pattern = "".join(re.escape(piece) if i % 2 == 0 else f"(?P<{piece}>.*?)" for i, piece in enumerate(pieces))
        found = re.fullmatch(pattern, original, re.DOTALL)
        if not found:
            continue
        template = "".join(piece.replace("{", "{{").replace("}", "}}") if i % 2 == 0 else "{" + piece + "}"
                           for i, piece in enumerate(pieces))
        yield {"start": match.start("raw"), "end": match.end("raw"), "line": source[:match.start("raw")].count("\n") + 1,
               "quote": '"', "i18n": True, "template": template, "values": found.groupdict()}


def _locale_replacement(selected: dict, replacement: str, expression: str):
    """占位按原文写回，保留数字格式声明，各出现一次。"""
    tokens = {match[1]: match[0] for match in _I18N_FIELD.finditer(json.loads('"' + expression + '"'))}
    values, rendered, used = [], [], []
    try:
        for literal, name, spec, conversion in Formatter().parse(replacement):
            values.append(literal)
            rendered.append(literal)
            if name is not None:
                if name not in selected["values"] or spec or conversion:
                    raise ValueError("placeholder not in the original template")
                used.append(name)
                values.append(tokens[name])
                rendered.append(selected["values"][name])
    except ValueError as error:
        raise UserValueError("errors.devCopy.placeholdersChanged", {"open": "{{", "close": "}}"}) from error
    if Counter(used) != Counter(selected["values"].keys()):
        raise UserValueError("errors.devCopy.placeholdersIncomplete")
    return json.dumps("".join(values), ensure_ascii=False)[1:-1], "".join(rendered)


def candidates(root: Path, original: str) -> list[dict]:
    if not isinstance(original, str) or not original.strip() or len(original) > 2000:
        raise UserValueError("errors.devCopy.textTooLong")
    found = []
    for path in files(root):
        if not path.is_file() or ".test." in path.name:
            continue
        source = path.read_text(encoding="utf-8")
        if len(source) > 2_000_000:
            continue
        if path.suffix == ".py":
            found.extend({"file": path.relative_to(root).as_posix(),
                          "hash": hashlib.sha256(source.encode()).hexdigest(), **candidate}
                         for candidate in _python_candidates(source, original))
            continue
        if path.suffix == ".json":
            found.extend({"file": path.relative_to(root).as_posix(),
                          "hash": hashlib.sha256(source.encode()).hexdigest(), **candidate}
                         for candidate in _locale_candidates(source, original))
        # 只定位完整文字节点或完整字符串，避免改到标识和代码的一部分。
        pattern = re.compile(r"(?P<quote>['\"`])" + re.escape(original) + r"(?P=quote)|>\s*(?P<jsx>" + re.escape(original) + r")\s*<")
        for match in pattern.finditer(source):
            start = match.start("jsx") if match.group("jsx") else match.start() + 1
            end = start + len(original)
            found.append({"file": path.relative_to(root).as_posix(), "start": start, "end": end,
                          "hash": hashlib.sha256(source.encode()).hexdigest(),
                          "line": source[:start].count("\n") + 1,
                          "quote": match.group("quote") or ""})
    return found[:100]


def save(root: Path, body: dict) -> dict:
    if not isinstance(body, dict):
        raise ValueError("edit body must be an object")
    original, replacement = body.get("original", ""), body.get("replacement", "")
    if not isinstance(replacement, str) or len(replacement) > 2000:
        raise UserValueError("errors.devCopy.replacementInvalid")
    selected = body.get("candidate")
    if selected not in candidates(root, original):
        raise UserValueError("errors.devCopy.sourceChanged")
    path = (root / selected["file"]).resolve()
    if path not in {p.resolve() for p in files(root)}:
        raise UserValueError("errors.devCopy.fileNotEditable")
    source = path.read_text(encoding="utf-8")
    quote = selected["quote"]
    text = replacement
    if selected.get("python"):
        escaped, text = _python_replacement(source, selected, replacement)
    elif selected.get("i18n"):
        escaped, text = _locale_replacement(selected, replacement, source[selected['start']:selected['end']])
    elif quote:
        escaped = replacement.replace("\\", "\\\\").replace(quote, "\\" + quote).replace("\n", "\\n").replace("\r", "\\r")
        if quote == "`":
            escaped = escaped.replace("${", "\\${")
    else:
        escaped = replacement.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if path.suffix == ".tsx":
            escaped = escaped.replace("{", "&#123;").replace("}", "&#125;")
    backup = root / "build/copy-editor/backups" / selected["hash"] / selected["file"]
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        backup.write_text(source, encoding="utf-8")
    path.write_text(source[:selected["start"]] + escaped + source[selected["end"]:], encoding="utf-8")
    record = root / "build/copy-editor/edits.json"
    edits = json.loads(record.read_text(encoding="utf-8")) if record.exists() else {}
    edits[original] = text
    record.write_text(json.dumps(edits, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "file": selected["file"], "text": text,
            "needs_build": selected["file"].startswith("frontend/")}
