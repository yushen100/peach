"""版本号档位判定与写入，供发布入口调用。

版本号只在发布点动：每个 `X.Y.Z` 都对应一个真实发布物，minor 位记的是「第几批带新
功能的发布」。日常集成的提交由 commit 标识——`build-info.json` 随包走，托盘按 commit
算自己落后几个提交——它们不需要各自占掉一个版本号。

档位判定的输入是「上一个版本标签到 HEAD」这段区间：`feat`／破坏性标记／新增迁移推
minor，其余推 patch，major 只在 1.0 那一次手工给（ADR-0012）。
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from peach.interface_text import dev as t  # noqa: E402

#: 版本号的唯一来源。GitHub Release 的 `v<版本>` tag 必须与它相等。
VERSION_FILE = "src/peach/__init__.py"
VERSION_PATTERN = re.compile(r'(__version__\s*=\s*")(\d+)\.(\d+)\.(\d+)(")')

#: README 的下载直链带着版本号；靠人记得改，曾在 v0.50.0 停了六个版本。`--ship` 在 Release
#: 制品齐了以后才把它们换到新版本，发布前后读者都拿得到能下载的链接。
README_FILES = ("README.md", "README.zh-CN.md")
DOWNLOAD_LINK = re.compile(r"releases/download/v(\d+\.\d+\.\d+)/Peach-(\d+\.\d+\.\d+)-([^)\s]+)")

#: 版本标签的形状。`--match` 用它排除别的标签，免得把某个临时标签当成上一个发布点。
TAG_GLOB = "v[0-9]*.[0-9]*.[0-9]*"

#: 决定运行时代码、依赖与发布构建的输入。清单之外的开发过程文件不触发版本发布。
#: 清单与 `WINDOWS_TRAY_INPUTS` 各自服务不同的问题：
#: 那份决定要不要重建 EXE，这份决定这批改动够不够格成为一个新版本。
RUNTIME_INPUTS = (
    "src/peach/",
    "web/",
    "frontend/",
    "migrations/",
    "resources/",
    "scripts/build_app_entry.py",
    "scripts/build_windows.ps1",
    "scripts/fetch_cloudflared.ps1",
    "scripts/cloudflared-windows.json",
    "scripts/build_macos_app.py",
    "scripts/build_macos_standalone.py",
    "scripts/build_macos_media.py",
    "scripts/setup_macos_media_tools.py",
    "scripts/fetch_cloudflared_macos.py",
    "scripts/cloudflared-macos.json",
    "scripts/fetch_sparkle_macos.py",
    "scripts/sparkle-macos.json",
    "scripts/media_tool_bundle.py",
    "scripts/fetch_ffmpeg_sources.py",
    "scripts/fetch_untrunc_sources.py",
    "scripts/ffmpeg-sources.json",
    "scripts/untrunc-sources.json",
    "scripts/peach_macos.spec",
    "scripts/package_windows_release.py",
    "scripts/installer/",
    "scripts/ci_windows.ps1",
    "scripts/ci_macos.sh",
    "pyproject.toml",
    "uv.lock",
    ".github/workflows/release.yml",
    ".gitlab-ci.yml",
)

#: Conventional Commits 的功能类型；`!` 是破坏性标记。pre-1.0 阶段两者都只推 minor。
FEATURE_SUBJECT = re.compile(r"^(feat|feature)(\(.*\))?!?:|^\w+(\(.*\))?!:")


class VersionError(RuntimeError):
    pass


def git(root: Path, *args: str) -> str:
    """在 `root` 上跑一条只读 git，返回 stdout。失败即抛，不静默当成空结果。"""
    done = subprocess.run(["git", *args], cwd=str(root), capture_output=True,
                          text=True, encoding="utf-8", check=False)
    if done.returncode != 0:
        raise VersionError(t("version_bump.gitFailed", command=" ".join(args), error=done.stderr.strip()))
    return done.stdout.strip()


def lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if line.strip()]


def last_tag(root: Path) -> str | None:
    """最近一个版本标签；一个都没有时返回 None。"""
    done = subprocess.run(["git", "describe", "--tags", "--abbrev=0", "--match", TAG_GLOB],
                          cwd=str(root), capture_output=True, text=True,
                          encoding="utf-8", check=False)
    tag = done.stdout.strip()
    return tag if done.returncode == 0 and tag else None


def release_range(root: Path) -> str:
    """上一个版本标签到 HEAD。没有标签时是整段历史。"""
    tag = last_tag(root)
    return f"{tag}..HEAD" if tag else "HEAD"


def recorded_only(root: Path, spec: str) -> set[str]:
    """`git merge -s ours` 记入的那一侧：合并前后树不变，对方的提交只进历史、不进代码。

    记入社区 PR 是为了署名（贡献约定），那些提交的改动没有一行留在主线上，算进版本级别
    或变更日志就是在报告没发生的变化。只算对方那一侧独有的提交：对方分支合过的主线提交
    从第一父提交也到得了，照常计入。
    """
    excluded: set[str] = set()
    for line in lines(git(root, "log", "--merges", "--format=%T %P", spec)):
        tree, first, *others = line.split()
        if others and git(root, "rev-parse", f"{first}^{{tree}}") == tree:
            excluded.update(git(root, "rev-list", *others, f"^{first}").split())
    return excluded


def subjects_in(root: Path, spec: str) -> list[str]:
    """区间里的提交主题，合并提交和只记入历史的提交不算——前者的主题只说明分支名。"""
    skipped = recorded_only(root, spec)
    rows = (line.split(" ", 1) for line in lines(git(root, "log", "--no-merges", "--format=%H %s", spec)))
    return [row[1] if len(row) > 1 else "" for row in rows if row[0] not in skipped]


def changed_in(root: Path, spec: str) -> list[str]:
    return lines(git(root, "diff", "--name-only", _diff_spec(spec)))


def added_in(root: Path, spec: str) -> list[str]:
    return lines(git(root, "diff", "--name-only", "--diff-filter=A", _diff_spec(spec)))


#: 空树的对象名，git 里的常量。一个版本标签都没有时，「这批改动」就是整段历史。
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"


def _diff_spec(spec: str) -> str:
    """`A..B` 交给 diff 时写成 `A...B`：只看这条线自己带来的改动。"""
    return spec.replace("..", "...") if ".." in spec else f"{EMPTY_TREE}..{spec}"


def runtime_inputs_changed(paths) -> bool:
    """这批改动里有没有会进到运行时产物的。"""
    normalized = [str(path).replace("\\", "/").strip("/") for path in paths]
    return any(path == prefix.rstrip("/") or path.startswith(prefix)
               for path in normalized for prefix in RUNTIME_INPUTS)


def bump_part_for(subjects, added_paths) -> str:
    """这批提交该推版本号的哪一位。

    有功能提交（`feat:`）或破坏性标记（`type!:`），或者新增了迁移文件，就是 minor；
    其余（修复、重构、文案、构建）是 patch。major 只在 1.0 那一次手工给，这里不判。
    """
    if any(FEATURE_SUBJECT.match(subject.strip()) for subject in subjects):
        return "minor"
    normalized = [str(path).replace("\\", "/").strip("/") for path in added_paths]
    if any(path.startswith("migrations/") for path in normalized):
        return "minor"
    return "patch"


def bump_version(text: str, part: str) -> tuple[str, str]:
    """把 `__version__` 那一行往前推一格，返回新正文与新版本号。

    纯函数，只认那一行：整份文件其余部分逐字节保留，换行也不碰。
    """
    match = VERSION_PATTERN.search(text)
    if match is None:
        raise VersionError(f"{VERSION_FILE} does not declare __version__")
    major, minor, patch = (int(match.group(index)) for index in (2, 3, 4))
    if part == "major":
        major, minor, patch = major + 1, 0, 0
    elif part == "minor":
        minor, patch = minor + 1, 0
    elif part == "patch":
        patch += 1
    else:
        raise VersionError(f"unknown bump part: {part}")
    version = f"{major}.{minor}.{patch}"
    updated = text[:match.start()] + f"{match.group(1)}{version}{match.group(5)}" \
        + text[match.end():]
    return updated, version


def read_version(root: Path) -> str:
    match = VERSION_PATTERN.search((root / VERSION_FILE).read_bytes().decode("utf-8"))
    if match is None:
        raise VersionError(f"{VERSION_FILE} does not declare __version__")
    return f"{match.group(2)}.{match.group(3)}.{match.group(4)}"


def point_downloads_at(text: str, version: str) -> str:
    """把正文里每条 Release 下载直链换到 `version`，其余字节不动。"""
    return DOWNLOAD_LINK.sub(
        lambda match: f"releases/download/v{version}/Peach-{version}-{match.group(3)}", text)


def readme_assets(root: Path, version: str) -> list[str]:
    """README 直链要下载的制品文件名，按 `version` 拼出。"""
    names = set()
    for name in README_FILES:
        text = (root / name).read_bytes().decode("utf-8")
        names.update(f"Peach-{version}-{suffix}" for *_, suffix in DOWNLOAD_LINK.findall(text))
    return sorted(names)


def readme_link_problems(root: Path, *, version: str | None = None, revision: str | None = None) -> list[str]:
    """发布核对指定版本。常规测试允许定版后、制品上传前暂时指向上一版。"""
    allowed = [version] if version is not None else _readme_transition_versions(root)
    problems = []
    for name in README_FILES:
        text = git(root, "show", f"{revision}:{name}") if revision else (root / name).read_text(encoding="utf-8")
        links = DOWNLOAD_LINK.findall(text)
        versions = {version for tag, asset, _ in links for version in (tag, asset)}
        if not links:
            problems.append(t("version_bump.readmeNoLinks", name=name))
        elif len(versions) != 1 or not versions <= set(allowed):
            problems.append(t("version_bump.readmeStaleLinks", name=name,
                              versions=sorted(versions),
                              allowed=t("version_bump.or").join(allowed)))
    return problems


def _readme_transition_versions(root: Path) -> list[str]:
    current = read_version(root)
    released = re.findall(r"^## \[(\d+\.\d+\.\d+)\]", (root / "CHANGELOG.md").read_text(encoding="utf-8"), re.M)
    return released[released.index(current):][:2] if current in released else [current]


def point_readmes(root: Path, version: str) -> list[str]:
    """把两份 README 的下载直链换到 `version`，返回实际改动的文件。不提交。"""
    changed = []
    for name in README_FILES:
        readme = root / name
        text = readme.read_bytes().decode("utf-8")
        if (pointed := point_downloads_at(text, version)) != text:
            readme.write_bytes(pointed.encode("utf-8"))
            changed.append(name)
    return changed


def write_version(root: Path, part: str) -> str:
    """把新版本号写进版本文件并返回它。不提交——发布提交由调用方连同变更日志一起做。"""
    path = root / VERSION_FILE
    updated, version = bump_version(path.read_bytes().decode("utf-8"), part)
    path.write_bytes(updated.encode("utf-8"))
    return version


def plan_bump(root: Path, part: str = "auto") -> dict[str, object]:
    """算出这次发布该用哪一档、推到哪个版本号。只读，不写文件。"""
    spec = release_range(root)
    subjects = subjects_in(root, spec)
    if not subjects:
        raise VersionError(t("version_bump.noCommits", range=spec))
    if not runtime_inputs_changed(changed_in(root, spec)):
        raise VersionError(t("version_bump.devOnly", range=spec))
    chosen = bump_part_for(subjects, added_in(root, spec)) if part == "auto" else part
    current = read_version(root)
    return {
        "range": spec,
        "bump": chosen,
        "current": current,
        "version": bump_version(f'__version__ = "{current}"', chosen)[1],
        "commits": len(subjects),
    }
