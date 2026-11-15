"""变更日志：从 Conventional Commits 起草，发布时把未发布节定版。

格式遵循 Keep a Changelog 1.1.0（https://keepachangelog.com/zh-CN/1.1.0/），版本号遵循
Semantic Versioning 2.0.0（https://semver.org/lang/zh-CN/spec/v2.0.0.html）：`## [Unreleased]`
常在，每个发布一节 `## [X.Y.Z] - YYYY-MM-DD`，分组标题固定，底部给 compare 链接。

草稿按提交主题分组，措辞要人改成使用者读得懂的话——规范的第一条原则就是变更日志写给
人看，不是 `git log` 的转储。只改开发过程的提交（`docs`、`test`、`chore`、`refactor`）
不进日志。定版时未发布节里人润色过的内容整段搬进版本节，那一节空着才用草稿兜底。

每个条目再带一个区域标签：分组标题按变化性质分，标签按使用者看到的区域分。认得的 scope
自动换成标签，草稿里还留着英文 scope 的条目就是等人定标签的。

每一行英文在前、中文在后，中间用 ` / ` 隔开（与 peach-userscript 同一写法）：
`### Added / 新增`、`- **Playback**: English (#1). / **播放**：中文（#1）。`。Release 正文与
应用内的更新说明都按第一个 ` / ` 拆成两种语言，英文是正文，中文进折叠的「简体中文」段。

    python scripts/changelog.py                                # 起草未发布区间
    python scripts/changelog.py --range v0.16.0..v0.27.1       # 起草任意区间
    python scripts/changelog.py --release 0.30.0 --apply       # 把未发布节定版为 0.30.0
    python scripts/changelog.py --notes 0.30.0 --to NOTES.md   # 生成这一版的 Release 正文
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = "scripts"
if str(Path(__file__).resolve().parents[1] / "src") not in sys.path:
    sys.path.insert(1, str(Path(__file__).resolve().parents[1] / "src"))
from peach import interface_text, release_notices, release_words
from peach.interface_text import dev as t

from . import version_bump

ROOT = Path(__file__).resolve().parents[1]
CHANGELOG = "CHANGELOG.md"

#: 未发布节的标题。Keep a Changelog 要求它常驻，让人随时知道主线上攒了什么。
UNRELEASED = "Unreleased"

#: 一行里英文与中文的分隔；只按第一个拆，中文里要写斜杠就用全角「／」。
SEPARATOR = " / "
#: Release 正文里中文那一段的折叠标题、下载段的折叠标题（英文，中文）与重点分组标题（英文，中文），
#: 应用读正文时认同一份（`peach.release_words`）。
CHINESE_SUMMARY = release_words.CHINESE_SUMMARY
DOWNLOADS_SUMMARY = release_words.DOWNLOAD_SUMMARIES
HIGHLIGHTS = release_words.HIGHLIGHTS

#: Conventional Commits 的主题形状：`type(scope)!: 描述`。
SUBJECT = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]*)\))?(?P<bang>!)?:\s*(?P<text>.+)$")

#: 破坏性变化的脚注写法，与主题里的 `!` 等效。
BREAKING_FOOTER = re.compile(r"^BREAKING[ -]CHANGE:\s*(?P<text>.+)$", re.M)

#: 提交类型到分组的映射。落在这里之外的类型只改开发过程，不进日志。
TYPE_GROUPS = {"feat": "Added", "feature": "Added", "fix": "Fixed", "perf": "Changed"}

#: 这些 scope 下的改动只动开发过程，即使打成 `fix` 也不进面向使用者的日志。
SILENT_SCOPES = frozenset({"tests", "test", "docs", "doc", "ci", "skills", "agents"})

#: 两个分组，`due()` 单独看它们：这两类拖着不发，代价落在使用者身上。
BREAKING = "Breaking"
SECURITY_GROUP = "Security"

#: 分组的渲染顺序与中文名，标题写成 `### Added / 新增`。空分组不渲染；
#: 「弃用」「移除」「安全」由人按需补，脚本不猜。
GROUPS = {BREAKING: "破坏性变化", "Added": "新增", "Changed": "变更", "Deprecated": "弃用",
          "Removed": "移除", "Fixed": "修复", SECURITY_GROUP: "安全"}
GROUP_ORDER = tuple(GROUPS)

#: 提交主题里点名 security 的那个词，与上面的分组标题不是一回事：这个是 type/scope。
SECURITY = "security"

#: 不等周期的两组：破坏性变化让人踩坑，安全问题让人暴露，都是越晚发代价越大。
URGENT = (BREAKING, SECURITY_GROUP)

#: 发布节奏：每周一次，攒够就提前，`URGENT` 那两组不等周期。
#:
#: 时间那一半有先例可依——Firefox 四周、Ubuntu 与 GNOME 半年都是把「要不要发」交给
#: 日历，到点看有没有面向使用者的变化，有就发。条数那一半没有可靠样本：已发四版各带
#: 6、8、6、9 条，可那是「每次集成推一格」时期的产物，反映的是那三天写了多少代码，
#: 不是「多少变化值得让人下载一次」。10 是没有样本时的保守起点，比历史单次量高一档，
#: 因为周期从一天放宽到了一周。`due()` 每次都报出实际攒了多少，几次真实发布之后拿那
#: 几个数回来校准这一行，别再拿旧机制的数字当依据。
DUE_DAYS = 7
DUE_ENTRIES = 10

#: 条目前缀用的区域标签，说的是使用者在哪儿看到这个变化。分组标题按变化性质
#: 分（规范这么定），标签按使用者看到的区域分，两维叠起来才既合规范又找得到东西。
#: 这个清单是封闭的：`tests/test_changelog.py` 拒绝清单外的标签，免得各写一套近义词。
#: 键是中文标签，值是同一行英文那半边用的标签。
AREAS = {"界面": "Interface", "播放": "Playback", "馆藏": "Library", "采集": "Sourcing", "复核": "Review",
         "关注": "Following", "配置": "Settings", "更新": "Updates", "桌面": "Desktop", "账本": "Ledger"}

#: 定版条目标签之后的长度上限：中文按字、英文按字符。条目给使用者扫读：一句话说清在哪儿变了什么，
#: 原因和实现细节留在提交与 PR。英文上限与 peach-userscript 相同。
ENTRY_LIMIT = 80
ENGLISH_LIMIT = 160

#: scope 到区域标签的映射，只收没有歧义的。`web` 故意不映射——它占了近八成提交，
#: 机械挂上「界面」等于给每条都贴同一个标签，标签就不再有区分力，留给人按条目内容定。
AREA_BY_SCOPE = {
    "ui": "界面", "cards": "界面", "detail": "界面",
    "media": "播放", "player": "播放",
    "library": "馆藏", "catalog": "馆藏", "names": "馆藏",
    "metadata": "采集", "sourcing": "采集", "avatars": "采集",
    "studios": "采集", "links": "采集",
    "review": "复核",
    "follow": "关注",
    "setup": "配置", "config": "配置", "auth": "配置",
    "update": "更新",
    "tray": "桌面", "desktop": "桌面", "ops": "桌面",
    "ledger": "账本", "migrations": "账本",
}

#: 未发布节：标题到下一节标题或底部链接块之间的全部内容。
UNRELEASED_BLOCK = re.compile(
    rf"^## \[{UNRELEASED}\]\n(?P<body>.*?)(?=^## \[|^\[{UNRELEASED}\]:|\Z)", re.M | re.S)

#: 底部那条未发布链接。定版时它跟着指向新标签，新版本的链接紧跟其后。
UNRELEASED_LINK = re.compile(rf"^\[{UNRELEASED}\]:.*$", re.M)


@dataclass(frozen=True)
class Commit:
    subject: str
    body: str


def read_commits(root: Path, spec: str) -> list[Commit]:
    raw = version_bump.git(root, "log", "--no-merges", "--format=%H%x1f%s%x1f%b%x00", spec)
    skipped = version_bump.recorded_only(root, spec)
    commits = []
    for record in raw.split("\0"):
        if not record.strip():
            continue
        commit, _, rest = record.strip("\n").partition("\x1f")
        if commit in skipped:
            continue
        subject, _, body = rest.partition("\x1f")
        commits.append(Commit(subject.strip(), body))
    return commits


def entry_for(commit: Commit) -> tuple[str, str] | None:
    """一个提交对应的（分组，条目文本）；不进日志的返回 None。"""
    match = SUBJECT.match(commit.subject)
    if match is None:
        return None
    kind, scope = match["type"], (match["scope"] or "").strip()
    if scope in SILENT_SCOPES:
        return None
    text = match["text"].strip().rstrip("。")
    footer = BREAKING_FOOTER.search(commit.body or "")
    if match["bang"] or footer:
        return BREAKING, _label(scope, footer["text"].strip() if footer else text)
    if SECURITY in (kind, scope):
        return SECURITY_GROUP, _label(scope if scope != SECURITY else "", text)
    group = TYPE_GROUPS.get(kind)
    return (group, _label(scope, text)) if group else None


def _label(scope: str, text: str) -> str:
    """条目前缀。认得的 scope 换成区域标签，认不出的原样留着英文等人定。

    提交主题是中文，英文那半边留 `TODO` 等人写；定版检查拒收 `TODO`。
    """
    area = AREA_BY_SCOPE.get(scope)
    if area:
        return f"**{AREAS[area]}**: TODO{SEPARATOR}**{area}**：{text}"
    return f"{scope}：{text}" if scope else text


def split(line: str) -> tuple[str, str]:
    """一行双语文字按第一个 ` / ` 拆成（英文，中文）；没有分隔的两边相同。"""
    english, found, chinese = line.partition(SEPARATOR)
    return (english.strip(), chinese.strip()) if found else (line.strip(), line.strip())


def group_entries(commits) -> dict[str, list[str]]:
    """按分组收条目，保留首次出现的顺序并去掉重复措辞。"""
    grouped: dict[str, list[str]] = {}
    for commit in commits:
        found = entry_for(commit)
        if found is None:
            continue
        group, text = found
        bucket = grouped.setdefault(group, [])
        if text not in bucket:
            bucket.append(text)
    return {group: grouped[group] for group in GROUP_ORDER if group in grouped}


def render_body(grouped: dict[str, list[str]]) -> str:
    """分组与条目，不含节标题。"""
    parts: list[str] = []
    for group, entries in grouped.items():
        parts.extend((f"### {group}{SEPARATOR}{GROUPS[group]}", ""))
        parts.extend(f"- {entry}" for entry in entries)
        parts.append("")
    return "\n".join(parts).rstrip("\n")


def draft(root: Path, spec: str) -> str:
    return render_body(group_entries(read_commits(root, spec)))


def _waiting_days(root: Path) -> int:
    """上一个版本标签到现在过了几天；还没有标签时从最早那个提交算。"""
    tag = version_bump.last_tag(root)
    ref = tag or version_bump.git(root, "rev-list", "--max-parents=0", "HEAD").split()[-1]
    stamp = int(version_bump.git(root, "log", "-1", "--format=%ct", ref))
    return max(0, int((time.time() - stamp) // 86400))


def due(root: Path) -> dict:
    """该不该发下一版，以及为什么。

    只看使用者那一侧：他们看得见几条变化、等了几天、里头有没有等不得的。提交数不作
    判据——一百个重构提交对使用者是零，那正是这份判据要跟「集成了多少次」分开的地方。
    """
    grouped = group_entries(read_commits(root, version_bump.release_range(root)))
    entries = sum(len(items) for items in grouped.values())
    days = _waiting_days(root)
    why = []
    if entries and days >= DUE_DAYS:
        why.append(t("changelog.dueByDays", days=days, entries=entries))
    if entries >= DUE_ENTRIES:
        why.append(t("changelog.dueByEntries", entries=entries))
    urgent = [group for group in URGENT if group in grouped]
    if urgent:
        why.append(t("changelog.dueUrgent", groups=list(urgent)))
    return {"entries": entries, "days": days, "due": bool(why), "why": why,
            "groups": {group: len(items) for group, items in grouped.items()}}


def compare_link(repo: str, previous: str | None, tag: str) -> str:
    base = f"https://github.com/{repo}"
    return f"{base}/compare/{previous}...{tag}" if previous else f"{base}/releases/tag/{tag}"


def has_section(document: str, version: str) -> bool:
    return re.search(rf"^## \[{re.escape(version)}\]", document, re.M) is not None


def section_of(document: str, version: str) -> str:
    """某个版本那一节的正文，不含标题；没有这一节时是空串。

    发布前要确认的就是这段文字，把它取出来带在命令输出里，确认的人不用再去翻文件。
    """
    found = re.search(rf"^## \[{re.escape(version)}\][^\n]*\n(?P<body>.*?)(?=^## \[|^\[|\Z)",
                      document, re.M | re.S)
    return found["body"].strip("\n") if found else ""


#: 条目句末带来源编号：issue 或 PR，跨仓库写 `owner/repo#编号`。
REFERENCE = re.compile(r"(?:^|[\s(,（、，])(?:[\w.-]+/[\w.-]+)?#\d+(?!\w)")
#: 0.58.0 及更早的版本不补编号；之后每一版与「未发布」段的条目都要带。
REFERENCES_SINCE = (0, 58, 0)


def needs_references(version: str) -> bool:
    if version == UNRELEASED:
        return True
    return tuple(int(part) for part in version.split(".")) > REFERENCES_SINCE


#: 一条条目：`- **英文标签**: 英文 / **中文标签**：中文`。
ENTRY = re.compile(r"^- \*\*(?P<english_area>[^*]+)\*\*: (?P<english>.+?) / \*\*(?P<area>[^*]+)\*\*：(?P<chinese>.+)$")


def visible(text: str) -> str:
    """读者看到的文字：去掉行首的条目符号与区域标签、加粗与代码标记，链接只留显示的文字。"""
    text = re.sub(r"^- ", "", text)
    text = re.sub(r"^\*\*[^*]+\*\*(?:: |：)", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    return text.replace("**", "").replace("`", "")


def _refuse(key: str, lines: list[str], *, width: int | None = None, **params) -> None:
    if not lines:
        return
    preview = t("common.clauseSeparator").join(line[:width] if width else line for line in lines[:3])
    remainder = t("changelog.moreEntries", count=len(lines) - 3) if len(lines) > 3 else ""
    raise version_bump.VersionError(t(key, file=CHANGELOG, preview=preview, remainder=remainder, **params))


def require_labeled_entries(document: str, version: str) -> None:
    """定版那一节每行都要英文在前、中文在后；条目用封闭的区域标签，两半标签对得上，
    不能把提交 scope 或 `TODO` 直接发给使用者。全部已发布版本的条目都不超过长度上限，改旧版本时也守住。"""
    lines = [line for line in section_of(document, version).splitlines() if line.strip()]
    entries = [line for line in lines if line.startswith("- ")]
    matched = [(line, ENTRY.match(line)) for line in entries]
    _refuse("changelog.unlabeledEntries", [line for line, found in matched
                                           if found is None or found["area"] not in AREAS
                                           or AREAS[found["area"]] != found["english_area"]], version=version)
    headings = [line for line in lines if line.startswith("### ")]
    known = {f"### {name}{SEPARATOR}{chinese}" for name, chinese in GROUPS.items()}
    paragraphs = [line for line in lines if not line.startswith(("- ", "### "))]
    _refuse("changelog.notBilingual",
            [line for line in headings if line not in known]
            + [line for line in paragraphs if SEPARATOR not in line]
            + [line for line, found in matched if found["english"].strip() in ("", "TODO")],
            width=60, version=version)
    if needs_references(version):
        def cited(text: str) -> set[str]:
            return {found.strip(" (,（、，") for found in REFERENCE.findall(text)}
        _refuse("changelog.entriesWithoutReference",
                [line for line, found in matched
                 if not cited(found["english"]) or cited(found["english"]) != cited(found["chinese"])],
                width=40, version=version)
    _refuse("changelog.entriesTooLong", _long_entries(document), limit=ENTRY_LIMIT, english_limit=ENGLISH_LIMIT)


def _too_long(line: str) -> bool:
    english, chinese = split(line)
    return len(visible(chinese)) > ENTRY_LIMIT or (SEPARATOR in line and len(visible(english)) > ENGLISH_LIMIT)


def _long_entries(document: str) -> list[str]:
    """全部已发布版本里超长的条目，按读到的长度算。"""
    return [t("changelog.longEntry", version=released, line=split(line)[1][:40])
            for released in re.findall(r"^## \[(\d+\.\d+\.\d+)\]", document, re.M)
            for line in section_of(document, released).splitlines()
            if line.startswith("- ") and _too_long(line)]


def bilingual(section: str) -> tuple[str, str]:
    """一节正文拆成英文与中文两份，空行与 `> ` 引用前缀两边都保留。"""
    english, chinese = [], []
    for line in section.splitlines():
        prefix = re.match(r"^(?:- |### |> )?", line)[0]
        if prefix == "### " or prefix == "- ":
            left, right = split(line[len(prefix):])
        else:
            left, right = split(line[len(prefix):]) if line.strip() else ("", "")
        english.append(prefix + left if line.strip() else "")
        chinese.append(prefix + right if line.strip() else "")
    return "\n".join(english).strip("\n"), "\n".join(chinese).strip("\n")


def fold(summary: str, body: str) -> str:
    return f"<details>\n<summary>{summary}</summary>\n\n{body.strip()}\n\n</details>"


def highlights(version: str) -> tuple[str, str] | None:
    """这一版升级公告的 `features` 写成英文、中文两段重点；没有公告条目时返回 None。

    每条是 `- **标题**: 说明 (#1).`，带 `refs` 的在句末附编号，GitHub 会把编号显示成链接。
    """
    features = release_notices.NOTICES.get(version, {}).get("features") or []
    if not features:
        return None
    base = f"server:releaseNotes.v{version.replace('.', '-')}.items"
    parts = []
    for language, heading, colon, refs, end in (("en", HIGHLIGHTS[0], ": ", " ({})", "."),
                                                ("zh-CN", HIGHLIGHTS[1], "：", "（{}）", "。")):
        joiner = ", " if language == "en" else "、"
        lines = [f"### {heading}", ""]
        for item in features:
            title = interface_text.text(f"{base}.{item['id']}.title", language=language)
            body = interface_text.text(f"{base}.{item['id']}.body", language=language)
            suffix = refs.format(joiner.join(item["refs"])) if item.get("refs") else ""
            lines.append(f"- **{title}**{colon}{body}{suffix}{end}")
        parts.append("\n".join(lines))
    return parts[0], parts[1]


def _before_groups(section: str, inserted: str) -> str:
    """把 `inserted` 放在开头说明段之后、第一个分组之前。"""
    found = re.search(r"^### ", section, re.M)
    if found is None:
        return f"{section.rstrip()}\n\n{inserted}"
    head = section[:found.start()].rstrip()
    return f"{head}\n\n{inserted}\n\n{section[found.start():]}" if head else f"{inserted}\n\n{section}"


def notes(document: str, version: str, downloads: tuple[str, str] | None = None) -> str:
    """Release 页的正文，按语言分开：外面是英文更新说明与折叠的 Downloads，中文更新说明与折叠的
    「下载」一起放进折叠的「简体中文」段，末尾是到上一版的完整变更链接。更新说明在开头说明段之后
    先列这一版公告的重点（`highlights()`），检查更新只显示这一组。

    `downloads` 是下载段的（英文，中文），由 `package_windows_release.download_sections()` 生成。
    使用者在 GitHub 上读到的就是这段，所以那一节或它的链接缺了不能静默发一段固定文案顶上，
    直接拒绝，让发布链停在这里。
    """
    section = section_of(document, version)
    if not section:
        raise version_bump.VersionError(t("changelog.noSectionForNotes", file=CHANGELOG, version=version))
    link = re.search(rf"^\[{re.escape(version)}\]:\s*(\S+)\s*$", document, re.M)
    if link is None:
        raise version_bump.VersionError(t("changelog.noLinkForNotes", file=CHANGELOG, version=version))
    english, chinese = bilingual(section)
    picked = highlights(version)
    if picked:
        english, chinese = _before_groups(english, picked[0]), _before_groups(chinese, picked[1])
    if downloads:
        english += "\n\n" + fold(DOWNLOADS_SUMMARY[0], downloads[0])
        chinese += "\n\n" + fold(DOWNLOADS_SUMMARY[1], downloads[1])
    return f"{english}\n\n{fold(CHINESE_SUMMARY, chinese)}\n\n[Full Changelog]({link[1]})\n"


def promote(document: str, version: str, *, date: str, repo: str, previous: str | None,
            fallback: str = "") -> str:
    """把未发布节定版成 `version` 一节，并在它上面留一个空的未发布节。

    人在未发布节里润色过的措辞整段搬下去；那一节没有条目时才用 `fallback` 兜底。
    """
    if has_section(document, version):
        raise version_bump.VersionError(t("changelog.sectionExists", file=CHANGELOG, version=version))
    match = UNRELEASED_BLOCK.search(document)
    if match is None:
        raise version_bump.VersionError(t("changelog.noUnreleasedSection", file=CHANGELOG, unreleased=UNRELEASED))
    body = match["body"].strip("\n")
    if "- " not in body:
        body = fallback.strip("\n")
    if not body.strip():
        raise version_bump.VersionError(t("changelog.unreleasedEmpty", unreleased=UNRELEASED))
    block = f"## [{UNRELEASED}]\n\n## [{version}] - {date}\n\n{body}\n\n"
    updated = document[:match.start()] + block + document[match.end():]
    return _relink(updated, repo=repo, version=version, previous=previous)


def _relink(document: str, *, repo: str, version: str, previous: str | None) -> str:
    tag = f"v{version}"
    if not UNRELEASED_LINK.search(document):
        raise version_bump.VersionError(t("changelog.noUnreleasedLink", file=CHANGELOG, unreleased=UNRELEASED))
    document = UNRELEASED_LINK.sub(f"[{UNRELEASED}]: {compare_link(repo, tag, 'HEAD')}",
                                   document, count=1)
    definition = f"[{version}]: {compare_link(repo, previous, tag)}"
    return UNRELEASED_LINK.sub(lambda found: f"{found[0]}\n{definition}", document, count=1)


def release(root: Path, version: str, *, repo: str, spec: str, today: str | None = None) -> None:
    """把 `CHANGELOG.md` 的未发布节定版并落盘。"""
    path = root / CHANGELOG
    previous = spec.split("..")[0] if ".." in spec else version_bump.last_tag(root)
    updated = promote(path.read_text(encoding="utf-8"), version,
                      date=today or dt.date.today().isoformat(), repo=repo,
                      previous=previous, fallback=draft(root, spec))
    path.write_bytes(updated.encode("utf-8"))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=t("changelog.description"),
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", default="peach-mitao/peach")
    parser.add_argument("--range", dest="spec", help=t("changelog.helpRange"))
    parser.add_argument("--release", help=t("changelog.helpRelease", unreleased=UNRELEASED))
    parser.add_argument("--apply", action="store_true", help=t("changelog.helpApply", file=CHANGELOG))
    parser.add_argument("--notes", metavar="VERSION", help=t("changelog.helpNotes"))
    parser.add_argument("--to", metavar="PATH", help=t("changelog.helpTo"))
    args = parser.parse_args(argv)
    try:
        if args.notes:
            # Release 正文带下载段：发布工作流都出轻量安装包。
            from .package_windows_release import download_sections
            text = notes((ROOT / CHANGELOG).read_text(encoding="utf-8"), args.notes,
                         download_sections(args.notes, lite_installer=True))
            if args.to:
                Path(args.to).write_bytes(text.encode("utf-8"))
            else:
                print(text, end="")
            return 0
        spec = args.spec or version_bump.release_range(ROOT)
        if not args.apply:
            heading = args.release or UNRELEASED
            body = draft(ROOT, spec) or t("changelog.noUserFacingChanges")
            print(f"## [{heading}]\n\n{body}")
            return 0
        if not args.release:
            raise version_bump.VersionError(t("changelog.applyNeedsRelease"))
        release(ROOT, args.release, repo=args.repo, spec=spec)
        print(t("changelog.released", file=CHANGELOG, unreleased=UNRELEASED, version=args.release))
        return 0
    except version_bump.VersionError as error:
        # 两条路各说自己没做成的事：起草或定版是「变更日志未更新」，--notes 是「Release 正文未生成」。
        what = t("changelog.notesNotGenerated") if args.notes else t("changelog.changelogNotUpdated")
        print(t("changelog.failed", what=what, error=error))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
