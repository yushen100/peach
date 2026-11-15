from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from . import __version__, interface_text, process_job
from .config import PROJECT_ROOT


def _say(name: str, **params) -> str:
    """版本信息只在托盘菜单与托盘通知里出现，跟本机语言（`tray.versions.<名字>`）。"""
    return interface_text.text(f"server:tray.versions.{name}", params, interface_text.local_language())


def discover_repository_root(
    resource_root: Path = PROJECT_ROOT,
    *,
    executable: Path | None = None,
) -> Path:
    """Find the source repository used by the tray without inventing one."""

    resource_root = resource_root.resolve()
    if (resource_root / ".git").exists():
        return resource_root

    executable = (executable or Path(sys.executable)).resolve()
    for parent in executable.parents:
        if (parent / ".git").exists():
            return parent
    return resource_root


#: `build_behind` 的取值：None 表示不适用（源码运行或独立测试包），`UNKNOWN_BUILD_AGE`
#: 表示托盘是打包的、却数不出它落后多少——身份未取得，或那个提交不在本检出的历史里。
#: 两种情况都当作陈旧：数不出来不等于没落后，而重建一次的代价只是一次构建。
UNKNOWN_BUILD_AGE = -1
#: git 超时被收掉时 `_git` 回的退出码，与 coreutils `timeout` 相同。
GIT_TIMED_OUT = 124


@dataclass(frozen=True)
class VersionSnapshot:
    package_version: str
    branch: str
    commit: str
    dirty: bool
    remote_configured: bool
    upstream: str | None
    #: 当前托盘 EXE 是从哪个提交打包出来的。源码运行、独立测试包与身份未取得时为 None。
    build_commit: str | None = None
    #: 那份构建落后检出多少个提交。
    build_behind: int | None = None

    @property
    def build_stale(self) -> bool:
        """打包托盘跑的是构建那一刻的代码副本；检出往前走了，它不会跟着变。"""
        return self.build_behind is not None and self.build_behind != 0

    @property
    def build_label(self) -> str:
        base = f"{self.branch}@{self.commit}"
        if self.dirty:
            base = _say("dirty", base=base)
        if not self.build_stale:
            return base
        if self.build_commit is None:
            return _say("buildUnknown", base=base)
        if self.build_behind is not None and self.build_behind > 0:
            return _say("buildBehind", base=base, build=self.build_commit[:8], count=self.build_behind)
        return _say("buildForeign", base=base, build=self.build_commit[:8])

    @property
    def channel_label(self) -> str:
        if self.commit == "release":
            return _say("channelRelease")
        if not self.remote_configured:
            return _say("channelLocal")
        if not self.upstream:
            return _say("channelUntracked")
        return _say("channel", upstream=self.upstream)


@dataclass(frozen=True)
class UpdateResult:
    state: str
    message: str
    snapshot: VersionSnapshot
    ahead: int = 0
    behind: int = 0
    #: 这次快进改动了哪些仓库相对路径。只有 `updated` 会非空，调用方据此判断
    #: 光重启子服务够不够。
    changed_paths: tuple[str, ...] = ()


class VersionManager:
    """Read-only Git/package version inspection and explicit update checks."""

    def __init__(
        self,
        root: Path | None = None,
        *,
        execute: Callable[..., subprocess.CompletedProcess[str]] = process_job.run,
    ) -> None:
        self.root = (root if root is not None else discover_repository_root()).resolve()
        self._execute = execute

    def _git(self, *args: str, timeout: float = 8.0) -> subprocess.CompletedProcess[str]:
        """超时按失败返回：`fetch` 起的传输进程连同 git 一起被收掉，调用方照常走失败分支。"""
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        command = ["git", "-c", f"safe.directory={self.root.as_posix()}", "-C", str(self.root), *args]
        try:
            return self._execute(
                command,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                check=False,
                creationflags=creationflags,
            )
        except subprocess.TimeoutExpired:
            return subprocess.CompletedProcess(command, GIT_TIMED_OUT, "", f"git timed out after {timeout:g}s")

    def _text(self, *args: str) -> str:
        result = self._git(*args)
        return result.stdout.strip() if result.returncode == 0 else ""

    def inspect(self) -> VersionSnapshot:
        package_version = __version__
        from .distribution import standalone
        if standalone():
            return VersionSnapshot(package_version, _say("testPackage"), "release", False, False, None)
        commit = self._text("rev-parse", "--short=8", "HEAD") or "unknown"
        branch = self._text("branch", "--show-current") or "detached"
        dirty = bool(self._text("status", "--porcelain"))
        remote_configured = self._git("remote", "get-url", "origin").returncode == 0
        upstream = self._text("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}") or None
        if remote_configured and upstream is None and branch != "detached":
            candidate = f"origin/{branch}"
            if self._git("show-ref", "--verify", f"refs/remotes/{candidate}").returncode == 0:
                upstream = candidate
        build_commit, build_behind = self.build_age()
        return VersionSnapshot(package_version, branch, commit, dirty, remote_configured,
                               upstream, build_commit, build_behind)

    def head_commit(self) -> str:
        """检出当前的 HEAD 完整 sha。只读本地，不联网，够廉价到能反复问。"""
        return self._text("rev-parse", "HEAD")

    def build_age(self) -> tuple[str | None, int | None]:
        """当前进程的构建提交，以及它落后检出多少个提交。

        源码运行的托盘没有第二个版本：它 import 的就是检出里的模块，永远不落后。
        """
        from .buildinfo import frozen_build
        if not getattr(sys, "frozen", False):
            return None, None
        info = frozen_build()
        commit = info.commit if info else None
        if not commit or not self._known_commit(commit):
            return commit, UNKNOWN_BUILD_AGE
        counted = self._text("rev-list", "--count", f"{commit}..HEAD")
        return commit, int(counted) if counted.isdigit() else UNKNOWN_BUILD_AGE

    def _known_commit(self, commit: str) -> bool:
        return self._git("cat-file", "-e", f"{commit}^{{commit}}").returncode == 0

    def stale_build_paths(self, build_commit: str | None) -> tuple[str, ...]:
        """从构建那个提交到现在，检出改了哪些仓库相对路径。

        数不出来时返回 `src/peach/`：它必然命中 `WINDOWS_TRAY_INPUTS`，于是「身份未取得」
        走的是重建而不是静悄悄地跳过。托盘旧着不动才是真正会骗人的那个结果。
        """
        if not build_commit or not self._known_commit(build_commit):
            return ("src/peach/",)
        return tuple(
            line for line in
            self._text("diff", "--name-only", f"{build_commit}..HEAD").splitlines()
            if line
        )

    def check(self) -> UpdateResult:
        before = self.inspect()
        from .distribution import standalone
        if standalone():
            from .release_updates import check
            release = check()
            language = interface_text.local_language()
            outcome = interface_text.text(f"server:{release['message_code']}", release.get("message_params"), language) \
                if release.get("message_code") else release["message"]
            message = _say("releaseLatest" if release['latest_version'] else "release", current=before.package_version,
                            latest=release['latest_version'], message=outcome)
            return UpdateResult(release["state"], message, before)
        if not before.remote_configured:
            return UpdateResult("unconfigured", _say("unconfigured", version=before.package_version,
                                                      build=before.build_label), before)
        fetched = self._git("fetch", "--quiet", "--prune", "origin", timeout=30)
        if fetched.returncode != 0:
            return UpdateResult("error", _say("fetchFailed"), before)
        current = self.inspect()
        if not current.upstream:
            return UpdateResult("untracked", _say("untracked"), current)
        counts = self._text("rev-list", "--left-right", "--count", f"HEAD...{current.upstream}").split()
        if len(counts) != 2 or not all(value.isdigit() for value in counts):
            return UpdateResult("error", _say("compareFailed"), current)
        ahead, behind = map(int, counts)
        if behind and ahead:
            state = "diverged"
            message = _say("diverged", ahead=ahead, behind=behind)
        elif behind:
            state = "available"
            message = _say("available", behind=behind)
        elif ahead:
            state = "ahead"
            message = _say("ahead", ahead=ahead)
        else:
            state = "current"
            message = _say("current", version=current.package_version)
        return UpdateResult(state, message, current, ahead=ahead, behind=behind)

    def update(self) -> UpdateResult:
        """把本地检出快进到更新通道，只做快进。

        不 stash、不 rebase、不 `--force`：并行工作树和主检出共用同一个对象库与
        reflog，任何一种改写历史的「顺手解决」都会把别的分支一起拖下水。凡是快进
        做不到的，一律原样报出来交给人。

        `check()` 已经 fetch 过并给出了状态，这里只在 `available` 时才动工作区；
        其余状态（未配置、无跟踪分支、已最新、本地领先、两边分叉）直接透传，
        调用方不需要再分一次类。
        """
        checked = self.check()
        from .distribution import standalone
        if standalone():
            return checked
        if checked.state != "available":
            return checked
        snapshot = checked.snapshot
        if snapshot.dirty:
            return UpdateResult("blocked", _say("dirtyBlocked", behind=checked.behind),
                                snapshot, behind=checked.behind)
        before = self._text("rev-parse", "HEAD")
        merged = self._git("merge", "--ff-only", str(snapshot.upstream), timeout=60)
        if merged.returncode != 0:
            return UpdateResult("blocked", _say("fastForwardFailed", upstream=snapshot.upstream),
                                snapshot, behind=checked.behind)
        current = self.inspect()
        changed = tuple(
            line for line in self._text("diff", "--name-only", f"{before}..HEAD").splitlines()
            if line
        )
        return UpdateResult(
            "updated",
            _say("updated", count=checked.behind, before=before[:8], after=current.commit),
            current, behind=checked.behind, changed_paths=changed,
        )
