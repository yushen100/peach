from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time
from collections.abc import Iterable
from contextlib import nullcontext
from pathlib import Path

if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    sys.path.insert(1, str(Path(__file__).resolve().parents[1] / "src"))
    __package__ = "scripts"
from peach.interface_text import dev as t

from . import (changelog, check_pr_identity, check_public_text, co_author, commit_subject,
               test_evidence, test_runner, version_bump)
from .release_tag import MASTER_WRITER

#: `create` 的落点，建在主检出旁边（ADR-0017 的四个运行时目录之一）。
WORKTREE_ROOT = "peach-worktrees"

#: Claude Code 内置工作树的落点。分支集成后它自己不收：目录留在主检出里，成了一份看不出
#: 区别的旧副本（见 CLAUDE.md）。`tests/test_repo_hygiene.py` 拦得住，但拦住之后没有任何
#: 入口能清掉已经在那儿的，只能让人手删——`prune --apply` 顺带扫掉这块。
BUILTIN_WORKTREES = Path(".claude") / "worktrees"

#: `create` 加锁写的原因。锁只在 `integrate` 合入该分支时解开；批量集成、GitHub 上合入、
#: 中途放弃的工作树都不经过那一步，锁就永远留着。2026-11-12 清点：202 个锁定工作树里
#: 绝大多数早已闲置，占 163 GB。所以这个原因的锁闲置满 `IDLE_DAYS` 天后视为过期；
#: 人写了别的原因的锁表示有意保留，一律不碰。
ACTIVE_LOCK = "Peach active agent task"
IDLE_DAYS = 7

#: 测试入口的产物（测试记录、TAP、浏览器日志）。重跑就会再生成，不是会话的过程文件，
#: 不挡回收。2026-11-12 实测单个工作树里它能到 2–5 GB。
TEST_OUTPUT = Path("build") / "agent-verification"

#: 闲置工作树里能随时重装的依赖。`.venv` 不在这里：uv 把它硬链接到缓存，删了不省空间。
REBUILDABLE = (Path("frontend") / "node_modules",)

#: 回收闲置工作树时，`build/` 里会话留下的过程文件移到这里，不删。
BUILD_ARCHIVE = Path("attic") / "evidence" / "worktree-build"

#: `create` 顺带回收的间隔，记在 git common dir 里。
PRUNE_STAMP = "peach-prune-stamp"
PRUNE_INTERVAL_SECONDS = 24 * 3600


class WorkspaceError(RuntimeError):
    pass


#: 版本号推进与打标签的唯一入口。集成不碰 `__version__`：主线上每个提交由 commit 标识，
#: 版本号留给真正发出去的那些（ADR-0012）。集成结果里的 `version` 只是当前值，供人核对。
RELEASE_TAG_ENTRY = "scripts/release_tag.py"

#: 仓库自带的 git hook。`create` 与 `integrate` 每次都把 `core.hooksPath` 指到这里：
#: 哪台机器先走一遍工作流就在哪台装上，不靠人记着去配。
HOOKS_PATH = "scripts/githooks"


def _git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    command = [
        "git", "-c", f"safe.directory={repo.as_posix()}", "-C", str(repo), *args,
    ]
    result = subprocess.run(command, text=True, encoding="utf-8", errors="replace",
                            capture_output=True, check=False)
    if check and result.returncode:
        raise WorkspaceError((result.stderr or result.stdout).strip())
    return result


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    if not slug:
        raise WorkspaceError("agent/task must contain letters or numbers")
    return slug


def _main_worktree(repo: Path) -> Path:
    common = Path(_git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir").stdout.strip())
    return common.parent if common.name == ".git" else common


def _lines(result: subprocess.CompletedProcess[str]) -> list[str]:
    return [line for line in result.stdout.splitlines() if line]


def _install_hooks(main: Path) -> None:
    _git(main, "config", "core.hooksPath", HOOKS_PATH)


def create(repo: Path, agent: str, task: str, root: Path | None = None) -> dict[str, object]:
    main = _main_worktree(repo)
    agent_slug, task_slug = _slug(agent), _slug(task)
    branch = f"agent/{agent_slug}/{task_slug}"
    target_root = root or (main.parent / WORKTREE_ROOT)
    target = target_root / f"{agent_slug}-{task_slug}"
    if target.exists():
        raise WorkspaceError(f"target exists: {target}")
    if _git(main, "show-ref", "--verify", f"refs/heads/{branch}", check=False).returncode == 0:
        raise WorkspaceError(f"branch exists: {branch}")
    target_root.mkdir(parents=True, exist_ok=True)
    _git(main, "worktree", "add", "--lock", "--reason", ACTIVE_LOCK,
         "-b", branch, str(target), "HEAD")
    _install_hooks(main)
    # 开工前就报出父进程已经不在的残留进程：别的会话还在跑的进程有父进程，不在这里出现。
    found = processes_under(_worktree_roots(main))
    return {
        "pruned": _scheduled_prune(main),
        "ok": True,
        "action": "create",
        "path": str(target),
        "branch": branch,
        "base": _git(target, "rev-parse", "HEAD").stdout.strip(),
        "main_dirty": bool(_git(main, "status", "--porcelain").stdout.strip()),
        "orphan_processes": found if isinstance(found, str) else
                            [row for row in found if row["orphan"]],
    }


def _scheduled_prune(main: Path) -> dict[str, object] | None:
    """`create` 每天顺带跑一次 `prune --apply`，只回收入口判定安全的。

    回收从前只靠人记着跑，结果工作树一路涨到 367 个、276 GB。挂在 `create` 上是因为它
    是每个代码任务都必经的一步；间隔一天，免得每次开工都多等一轮全量检查。回收失败只
    报告，不挡开工。
    """
    common = Path(_git(main, "rev-parse", "--path-format=absolute", "--git-common-dir").stdout.strip())
    stamp = common / PRUNE_STAMP
    try:
        if time.time() - stamp.stat().st_mtime < PRUNE_INTERVAL_SECONDS:
            return None
    except OSError:
        pass
    stamp.touch()
    try:
        report = prune(main, apply=True)
    except Exception as error:  # noqa: BLE001 — 回收失败不挡开工，原样报出来
        return {"ok": False, "error": str(error)}
    return {key: len(value) for key, value in report.items() if isinstance(value, list)}


def _worker_delivery(repo: Path, target_branch: str) -> dict[str, object]:
    branch = _git(repo, "branch", "--show-current").stdout.strip()
    if not branch.startswith("agent/"):
        raise WorkspaceError("preflight/ready must run from an agent/* branch")
    dirty = _lines(_git(repo, "status", "--porcelain"))
    if dirty:
        raise WorkspaceError("worktree is dirty; commit only owned paths first")
    base = _git(repo, "merge-base", target_branch, "HEAD").stdout.strip()
    commits = _lines(_git(repo, "rev-list", "--reverse", f"{base}..HEAD"))
    if not commits:
        raise WorkspaceError("branch has no commits")
    worker_files = set(_lines(_git(repo, "diff", "--name-only", f"{base}..HEAD")))
    target_files = set(_lines(_git(repo, "diff", "--name-only", f"{base}..{target_branch}")))
    return {
        "branch": branch,
        "base": base,
        "head": _git(repo, "rev-parse", "HEAD").stdout.strip(),
        "commits": commits,
        "files": sorted(worker_files),
        "same_file_changes": sorted(worker_files & target_files),
    }


def preflight(repo: Path, target_branch: str = "master") -> dict[str, object]:
    """快速核对当前交付提交；不读取或签发测试证明，也不查询 PR。"""
    report = _worker_delivery(repo, target_branch)
    if require_metadata(repo, target_branch) != report["head"]:
        raise WorkspaceError(t("agent_worktree.branchChangedPreflight"))
    return {"ok": True, "action": "preflight", **report,
            "metadata": "passed", "tests": "not_checked", "pull_request": "not_checked"}


def ready(repo: Path, target_branch: str = "master", *, ci_run: int | None = None) -> dict[str, object]:
    report = _worker_delivery(repo, target_branch)
    proof = require_verified(repo, target_branch, set(report["files"]), ci_run=ci_run)
    if _git(repo, "rev-parse", "HEAD").stdout.strip() != report["head"]:
        raise WorkspaceError(t("agent_worktree.branchChangedVerification"))
    return {"ok": True, "action": "ready", **report, "verification": proof}


def require_metadata(worker: Path, target_branch: str) -> str:
    """干净交付内容、目标祖先与提交声明的共用判据。"""
    head = _git(worker, "rev-parse", "HEAD").stdout.strip()
    if _git(worker, "status", "--porcelain").stdout.strip():
        raise WorkspaceError(t("agent_worktree.worktreeMustBeClean"))
    if _git(worker, "merge-base", "--is-ancestor", target_branch, "HEAD", check=False).returncode:
        raise WorkspaceError(t("agent_worktree.targetAdvanced"))
    problems = (co_author.check(worker, target_branch)
                + commit_subject.check(worker, target_branch))
    if problems:
        raise WorkspaceError("; ".join(problems))
    if _git(worker, "rev-parse", "HEAD").stdout.strip() != head or \
            _git(worker, "status", "--porcelain").stdout.strip():
        raise WorkspaceError(t("agent_worktree.worktreeChangedMetadata"))
    return head


def require_verified(worker: Path, target_branch: str, paths: Iterable[str], *,
                     ci_run: int | None = None) -> dict:
    head = require_metadata(worker, target_branch)
    scopes, _ = test_runner.scopes_for_changes(paths, contents=test_runner.changed_contents(worker, target_branch, paths),
                                              root=worker)
    from . import ci_test_evidence
    proof, ci_error = None, None
    try:
        run_id = ci_run if ci_run is not None else ci_test_evidence.remembered(worker)
        if run_id is not None:
            proof = ci_test_evidence.verify(worker, run_id, scopes, target_branch)
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        ci_error = error
    if proof is None and ci_run is None:
        state = test_evidence.key(worker)
        if test_evidence.covers(test_evidence.read(worker, state), scopes):
            proof = {"source": "local", "state": state, "scopes": list(scopes)}
    if proof is None:
        if ci_error is not None:
            raise WorkspaceError(t("agent_worktree.ciProofInvalid", error=ci_error)) from ci_error
        raise WorkspaceError(t("agent_worktree.noTestRecord"))
    if _git(worker, "rev-parse", "HEAD").stdout.strip() != head or \
            _git(worker, "status", "--porcelain").stdout.strip():
        raise WorkspaceError(t("agent_worktree.worktreeChangedVerification"))
    if proof['source'] == 'github':
        ci_test_evidence.remember(worker, proof)
    return proof


ISSUE_LINK = re.compile(
    r"(?:Refs|Close[sd]?|Fix(?:e[sd])?|Resolve[sd]?)[ \t]+"
    r"(?:(?:[\w.-]+/[\w.-]+)?#[1-9]\d*|https://github\.com/[\w.-]+/[\w.-]+/issues/[1-9]\d*)",
    re.IGNORECASE)


def require_pull_request(worker: Path, branch: str, target_branch: str, head: str) -> dict[str, object]:
    """用工作树的 GitHub 仓库上下文取得当前分支 PR，绑定精确提交与目标分支。

    正文里独占一行的 issue 关联行原样带出，写进合并提交；正文中顺带提到的编号不算。
    来自 fork 的 PR 还要核对提交作者不是维护者，判据同 CI 的 `check_pr_identity.py`。
    """
    fields = ("url", "state", "headRefOid", "baseRefName")
    try:
        options = ["--json", ",".join((*fields, "body", "isCrossRepository"))]
        kwargs = dict(cwd=worker, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
        result = subprocess.run(["gh", "pr", "view", branch, *options], **kwargs)
        if result.returncode and "no pull requests found for branch" in result.stderr:
            # 无显式分支名时，gh 会读取工作树的跟踪配置，识别来自 fork 的 PR。
            result = subprocess.run(["gh", "pr", "view", *options], **kwargs)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise WorkspaceError(t("agent_worktree.pullRequestUnavailable", error=error)) from error
    if result.returncode:
        raise WorkspaceError(t("agent_worktree.pullRequestUnavailable", error=(result.stderr or result.stdout).strip()))
    try:
        pr = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise WorkspaceError(t("agent_worktree.pullRequestNotJson")) from error
    if not isinstance(pr, dict) or any(not isinstance(pr.get(key), str) or not pr[key] for key in fields):
        raise WorkspaceError(t("agent_worktree.pullRequestBadFields"))
    if not re.fullmatch(r"https://[^/\s]+/[^/\s]+/[^/\s]+/pull/[1-9]\d*", pr["url"]):
        raise WorkspaceError(t("agent_worktree.pullRequestBadUrl"))
    if pr["state"] != "OPEN":
        raise WorkspaceError(t("agent_worktree.pullRequestNotOpen", state=pr['state']))
    if pr["headRefOid"] != head:
        raise WorkspaceError(t("agent_worktree.pullRequestHeadMismatch"))
    if pr["baseRefName"] != target_branch:
        raise WorkspaceError(t("agent_worktree.pullRequestWrongBase", branch=target_branch))
    if pr.get("isCrossRepository") is True:
        impersonated = check_pr_identity.problems(worker, target_branch, head)
        if impersonated:
            raise WorkspaceError(check_pr_identity.explain(impersonated))
    body = pr.get("body") if isinstance(pr.get("body"), str) else ""
    refs = [line.strip() for line in body.splitlines() if ISSUE_LINK.fullmatch(line.strip())]
    return {"url": pr["url"], "head": head, "base": target_branch, "refs": refs, "body": body}


def require_public_text(repo: Path, texts: dict[str, str]) -> None:
    """PR 正文与提交说明都公开在 GitHub 上：成串列出本机馆藏细节的拒收；PR 正文还不收内部用语。

    判据在 `scripts/check_public_text.py`：馆藏细节只读本机账本，没有账本的机器放行；内部用语
    只查 PR 正文，提交说明写给开发者，改工作树脚本的提交本来就要写工作树。
    """
    library = check_public_text.load_library(repo)
    found = [t("agent_worktree.publicTextItem", name=name,
               problems=t("common.clauseSeparator").join(problems))
             for name, text in texts.items()
             for problems in [check_public_text.problems(text, library)] if problems]
    if found:
        raise WorkspaceError(t("agent_worktree.publicTextListsLibrary",
                               items=t("common.commaSeparator").join(found)))
    insider = check_public_text.insider_terms(texts.get(t("agent_worktree.prBodyLabel"), ""))
    if insider:
        raise WorkspaceError(t("agent_worktree.prBodyInsiderTerms",
                               terms=t("common.clauseSeparator").join(insider),
                               hint=check_public_text.insider_hint()))


def merge_message(branch: str, pull_request: dict[str, object]) -> str:
    """合并提交带 PR 号与 issue 关联行，从 `git log` 就能追到交付与反馈。"""
    number = str(pull_request["url"]).rsplit("/", 1)[1]
    subject = f"Merge branch '{branch}' (#{number})"
    refs = pull_request["refs"]
    return f"{subject}\n\n" + "\n".join(refs) if refs else subject


def integrate(repo: Path, worker_branch: str, target_branch: str = "master", *,
              lock_timeout: float = 1800) -> dict[str, object]:
    folder = test_evidence.evidence_dir(repo)
    folder.mkdir(parents=True, exist_ok=True)
    try:
        documents = _documents_only(repo, worker_branch, target_branch)
        guard = nullcontext() if documents else test_evidence.held(
            folder / "full-suite.lock", wait_seconds=lock_timeout,
            scope="integrate", branch=worker_branch, root=str(repo))
        with guard:
            with test_evidence.held(folder / "integration.lock",
                                    branch=worker_branch, root=str(repo)):
                if documents and not _documents_only(repo, worker_branch, target_branch):
                    raise WorkspaceError(t("agent_worktree.surfaceChangedWhileWaiting"))
                refreshed = _refresh_worker(repo, worker_branch, target_branch, documents=documents)
                return {**_integrate_locked(repo, worker_branch, target_branch), "refreshed": refreshed}
    except test_evidence.Timeout as error:
        raise WorkspaceError(
            t("agent_worktree.integrationBusy",
              holder=test_evidence.describe_holder(Path(error.lock_file)))) from error


def _refresh_worker(main: Path, worker_branch: str, target_branch: str, *,
                    documents: bool) -> dict[str, str] | None:
    """排队期间目标分支前进时，持锁把工作者分支 rebase 到目标上、补验并推送。

    拿到全量锁之后才做：此刻别的集成和全量验证都插不进来，补验通过就一定合得进去，不会再像
    在锁外 rebase 那样被后到先合的任务挤掉、反复重来。冲突时撤回 rebase，交工作者处理。
    文档集成不持全量锁，补验若升级成全量会和持锁的集成互等，所以保持原来的拒收。
    """
    if documents or not _git(main, "merge-base", "--is-ancestor", target_branch, worker_branch,
                             check=False).returncode:
        return None
    workers = [Path(item["path"]) for item in _worktree_entries(main) if item.get("branch") == worker_branch]
    if len(workers) != 1 or _git(workers[0], "status", "--porcelain").stdout.strip():
        raise WorkspaceError(t("agent_worktree.workerWorktreeRequired"))
    worker = workers[0]
    before = _git(worker, "rev-parse", "HEAD").stdout.strip()
    old_base = _git(worker, "merge-base", target_branch, "HEAD").stdout.strip()
    moved = set(_lines(_git(worker, "diff", "--name-only", old_base, target_branch)))
    overlap = sorted(moved & set(_lines(_git(worker, "diff", "--name-only", old_base, "HEAD"))))
    if overlap:
        # 两边改了同一个文件要人看过再合，不能让 rebase 把重叠悄悄抹平。
        raise WorkspaceError("same-file review required: " + ", ".join(overlap))
    if _git(worker, "rebase", target_branch, check=False).returncode:
        _git(worker, "rebase", "--abort", check=False)
        raise WorkspaceError(t("agent_worktree.rebaseConflict"))
    print(t("agent_worktree.rebasedReverifying", branch=target_branch), file=sys.stderr, flush=True)
    _verify_worker(main, worker, frontend="frontend/package-lock.json" in moved)
    after = _git(worker, "rev-parse", "HEAD").stdout.strip()
    pushed = _git(worker, "push", f"--force-with-lease={worker_branch}:{before}", "origin",
                  f"{worker_branch}:{worker_branch}", check=False)
    if pushed.returncode:
        raise WorkspaceError(t("agent_worktree.rebasedPushFailed", error=(pushed.stderr or pushed.stdout).strip()))
    _await_pull_request_head(worker, worker_branch, after)
    return {"from": before, "to": after}


def _venv_python(root: Path) -> Path:
    return root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def _verify_worker(main: Path, worker: Path, *, frontend: bool) -> None:
    """照统一测试入口的步骤补验：同步依赖，再以 auto 签发记录。

    直接派出工作树的解释器而不经 test.ps1/test.sh：运行器要核对全量锁的持有者是自己的祖先进程；
    环境沿用本进程，测试记录的环境指纹才与随后的核验一致。输出写进工作树日志，不混进回执。
    """
    environment = {**os.environ, "PYTHONPATH": str(worker / "src")}
    starter = _venv_python(worker) if _venv_python(worker).is_file() else _venv_python(main)
    steps = [[str(starter), "-X", "utf8", "scripts/test_environment.py", str(worker), str(main)]]
    if frontend:
        steps.append([shutil.which("npm") or "npm", "--prefix", "frontend", "ci"])
    steps.append([str(_venv_python(worker)), "scripts/test_runner.py", "--scope", "auto",
                  "--jobs", "auto", "--full-lock-held"])
    log = worker / "build" / "integrate-verify.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("w", encoding="utf-8") as stream:
        for command in steps:
            if subprocess.run(command, cwd=worker, env=environment, stdout=stream, stderr=subprocess.STDOUT,
                              check=False).returncode:
                raise WorkspaceError(t("agent_worktree.reverifyFailed", log=log))


def _await_pull_request_head(worker: Path, branch: str, head: str, *, attempts: int = 12) -> None:
    """推送后 GitHub 要过几秒才把 PR 头换成新提交；等它跟上再进合入核验。"""
    for _ in range(attempts):
        result = subprocess.run(["gh", "pr", "view", branch, "--json", "headRefOid", "--jq", ".headRefOid"],
                                cwd=worker, capture_output=True, text=True, encoding="utf-8", timeout=60)
        if result.returncode == 0 and result.stdout.strip() == head:
            return
        time.sleep(5)
    raise WorkspaceError(t("agent_worktree.pullRequestHeadLagging"))


def _documents_only(repo: Path, worker_branch: str, target_branch: str) -> bool:
    """文档沿用选测的显式覆盖；需要运行时验收的 Markdown 仍取得全量锁。"""
    from . import change_impact
    base = _git(repo, "merge-base", target_branch, worker_branch).stdout.strip()
    files = _lines(_git(repo, "diff", "--name-only", f"{base}..{worker_branch}"))
    return bool(files) and all(change_impact.documentation(path) for path in files) \
        and test_runner.scopes_for_changes(files)[0] == ("checks",)


def _integrate_locked(repo: Path, worker_branch: str,
                      target_branch: str = "master") -> dict[str, object]:
    """把工作者分支并进 target。

    这台机器既是开发机又是生产机：提交先落本地再推 GitHub，本地永远领先。跑着的是哪一份
    由 commit 认定——`build-info.json` 随包走，托盘按它算自己落后多少个提交——所以集成
    不碰版本号，它在 `RELEASE_TAG_ENTRY` 那里一次发布推一格。
    """
    main = _main_worktree(repo)
    if repo.resolve() != main.resolve():
        raise WorkspaceError("integrate must run from the main integration worktree")
    if _git(main, "branch", "--show-current").stdout.strip() != target_branch:
        raise WorkspaceError(f"checkout {target_branch} before integrate")
    if _git(main, "status", "--porcelain").stdout.strip():
        raise WorkspaceError("integration worktree is dirty")
    before = _git(main, "rev-parse", "HEAD").stdout.strip()
    base = _git(main, "merge-base", target_branch, worker_branch).stdout.strip()
    worker_files = set(_lines(_git(main, "diff", "--name-only", f"{base}..{worker_branch}")))
    target_files = set(_lines(_git(main, "diff", "--name-only", f"{base}..{target_branch}")))
    overlap = sorted(worker_files & target_files)
    if overlap:
        raise WorkspaceError("same-file review required: " + ", ".join(overlap))
    workers = [Path(item["path"]) for item in _worktree_entries(main)
               if item.get("branch") == worker_branch]
    if len(workers) != 1 or _git(workers[0], "status", "--porcelain").stdout.strip():
        raise WorkspaceError(t("agent_worktree.workerWorktreeRequired"))
    worker_head = _git(main, "rev-parse", worker_branch).stdout.strip()
    require_verified(workers[0], target_branch, worker_files)
    pull_request = require_pull_request(workers[0], worker_branch, target_branch, worker_head)
    commits = _git(main, "log", "--format=%h%x00%B%x1e", f"{base}..{worker_head}").stdout
    require_public_text(main, {t("agent_worktree.prBodyLabel"): str(pull_request.get("body") or ""), **{
        t("agent_worktree.commitLabel", sha=sha): message for sha, _, message in
        (entry.strip().partition("\0") for entry in commits.split("\x1e") if entry.strip())}})
    if _git(main, "rev-parse", worker_branch).stdout.strip() != worker_head or \
            _git(workers[0], "rev-parse", "HEAD").stdout.strip() != worker_head:
        raise WorkspaceError(t("agent_worktree.branchChangedVerification"))
    if _git(main, "rev-parse", "HEAD").stdout.strip() != before or \
            _git(main, "status", "--porcelain").stdout.strip():
        raise WorkspaceError(t("agent_worktree.integrationWorktreeChanged"))
    _install_hooks(main)
    _git(main, "-c", f"{MASTER_WRITER}=integrate", "merge", "--no-ff", "--no-edit",
         "-m", merge_message(worker_branch, pull_request), worker_head)
    _git(main, "worktree", "unlock", str(workers[0]), check=False)
    return {
        "ok": True,
        "action": "integrate",
        "branch": worker_branch,
        "before": before,
        "after": _git(main, "rev-parse", "HEAD").stdout.strip(),
        "files": sorted(worker_files),
        "pull_request": pull_request,
        "version": version_bump.read_version(main),
        "release_tag_entry": RELEASE_TAG_ENTRY,
        # 发布提示挂在这里，是因为集成的输出是人和智能体每次都会读的那一份。挂在别处
        # 就得有谁记着去查，而「记着」正是这条判据要替掉的东西。
        "release": changelog.due(main),
    }


def _worktree_entries(main: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    entry: dict[str, str] = {}
    for line in _lines(_git(main, "worktree", "list", "--porcelain")):
        if line.startswith("worktree "):
            entry = {"path": line[len("worktree "):]}
            entries.append(entry)
        elif line.startswith("branch "):
            entry["branch"] = line[len("branch "):].replace("refs/heads/", "")
        elif line.startswith("locked"):
            entry["locked"] = line
    return entries


def _force_writable(func, path, _exc) -> None:
    Path(path).chmod(stat.S_IWRITE)
    func(path)


def _delete_tree(path: Path) -> str:
    """删掉回收之后剩下的目录。删掉了返回空串，否则返回失败原因。

    Windows 上删不掉多半不是权限而是句柄：另一个进程正把它当工作目录开着。短暂重试
    能等到杀毒、索引器一类的临时句柄放手，等不到一个 cd 在里面的 shell——所以只重试
    很短一会儿就如实报出来，不做无限等待，也不去猜是谁占着。
    """
    why = ""
    for attempt in range(4):
        if not path.exists():
            return ""
        try:
            shutil.rmtree(path, onexc=_force_writable)
            return ""
        except OSError as error:
            why = f"{type(error).__name__}: {error}"
            time.sleep(0.2 * (attempt + 1))
    return why


def _worktree_roots(main: Path) -> tuple[Path, Path]:
    return main.parent / WORKTREE_ROOT, main / BUILTIN_WORKTREES


def _under(value: str, roots: list[str]) -> bool:
    if not value:
        return False
    here = os.path.normcase(os.path.normpath(value))
    return any(here == root or here.startswith(root + os.sep) for root in roots)


def processes_under(roots: Iterable[Path], *, sample: float = 0.0) -> list[dict] | str:
    """列出当前目录或命令行落在 roots 下的进程。

    工作树里起的调试服务、浏览器守护进程和挂在 stdin 上的 shell，在会话结束后照样活着：
    2026-09-07、09-21、09-22 三次都是它们占住目录，`prune --apply` 删不掉，整洁门槛报红，
    而当时只能手工读进程的 PEB 才找得到是谁。生产托盘与 serve 从主检出起，不在这两个落点下。

    先按当前目录和命令行筛（全机扫一遍约 0.1 秒），只对命中的进程取启动时间、父进程和
    内存：Windows 上对全部进程取这几项要十几秒，慢在拒绝访问的系统进程上。
    `caller` 标出调用者自己这条进程链，`orphan` 是父进程已经不在的进程——会话关掉后
    留下的多半是这种。`sample` 大于 0 时再采一次 CPU。缺 psutil 返回「未取得」说明。
    """
    try:
        import psutil
    except ImportError:
        return t("agent_worktree.psutilMissing")
    prefixes = [os.path.normcase(os.path.normpath(str(root))) for root in roots]
    caller: set[int] = set()
    try:
        link = psutil.Process()
        while link is not None and link.pid not in caller:
            caller.add(link.pid)
            link = link.parent()
    except psutil.Error:
        pass
    hits = []
    for process in psutil.process_iter(["cwd", "cmdline"]):
        cwd = process.info.get("cwd") or ""
        cmdline = process.info.get("cmdline") or []
        if _under(cwd, prefixes) or any(_under(arg, prefixes) for arg in cmdline):
            hits.append((process, cwd, cmdline))
    if sample > 0:
        for process, _cwd, _cmdline in hits:
            try:
                process.cpu_percent(None)
            except psutil.Error:
                pass
        time.sleep(sample)
    rows = []
    now = time.time()
    for process, cwd, cmdline in hits:
        try:
            with process.oneshot():
                started = process.create_time()
                row = {
                    "pid": process.pid,
                    "name": process.name(),
                    "cmdline": " ".join(cmdline)[:300],
                    "cwd": cwd,
                    "age_minutes": round((now - started) / 60, 1),
                    "rss_mb": round(process.memory_info().rss / 2**20, 1),
                    "ppid": process.ppid(),
                    "orphan": process.parent() is None,
                    "caller": process.pid in caller,
                }
                if sample > 0:
                    row["cpu_percent"] = process.cpu_percent(None)
        except psutil.Error:
            continue
        rows.append(row)
    return sorted(rows, key=lambda row: row["rss_mb"], reverse=True)


def processes(repo: Path) -> dict[str, object]:
    """机器变卡或回收前，看两个工作树落点下还活着哪些进程。只报告，不结束任何进程。"""
    main = _main_worktree(repo)
    roots = _worktree_roots(main)
    report: dict[str, object] = {"ok": True, "action": "processes",
                                 "roots": [str(root) for root in roots]}
    try:
        import psutil
        memory = psutil.virtual_memory()
        report["machine"] = {"cpu_percent": psutil.cpu_percent(0.5),
                             "memory_percent": memory.percent,
                             "memory_available_gb": round(memory.available / 2**30, 1)}
    except ImportError:
        pass
    report["processes"] = processes_under(roots, sample=0.5)
    return report


def _session_files(path: Path) -> list[Path]:
    """`build/` 里会话留下的过程文件；测试入口的产物不算。"""
    build = path / "build"
    if not build.is_dir():
        return []
    output = path / TEST_OUTPUT
    return [child for child in build.rglob("*")
            if child.is_file() and output not in child.parents]


def _reflog_time(log: Path) -> float | None:
    """reflog 最后一条记下的时间；没有记录或读不出时返回 None。"""
    try:
        lines = log.read_text(encoding="utf-8", errors="replace").splitlines()
        return float(lines[-1].split("\t", 1)[0].split()[-2]) if lines else None
    except (OSError, ValueError, IndexError):
        return None


def _idle(path: Path) -> bool:
    """最近 `IDLE_DAYS` 天里没有提交、切换分支、改动文件，也没往 `build/` 写东西。

    不看 index 的 mtime：`git status` 会顺手刷新 index，一次只读检查就能把它刷成今天。
    也不看目录的 mtime：清理时删掉目录里的旧文件会把目录刷成今天，2026-11-12 清网络日志
    之后，187 个早已没人碰的工作树因此全被当成还在用。
    HEAD 的活动取 reflog 最后一条记下的时间，reflog 为空时取 HEAD 提交的提交时间，都不看
    `logs/HEAD` 的 mtime：同一天实测所有工作树的 reflog 曾被整体清空，文件 mtime 全刷成了
    清空那一刻。
    """
    stamps: list[float] = []
    admin = _git(path, "rev-parse", "--path-format=absolute", "--git-dir", check=False).stdout.strip()
    moved = _reflog_time(Path(admin) / "logs" / "HEAD") if admin else None
    if moved is None:
        committed = _git(path, "log", "-1", "--format=%ct", "HEAD", check=False).stdout.strip()
        moved = float(committed) if committed.isdigit() else None
    if moved is not None:
        stamps.append(moved)
    candidates: list[Path] = []
    if (path / "build").is_dir():
        candidates.extend(child for child in (path / "build").rglob("*") if child.is_file())
    for line in _lines(_git(path, "status", "--porcelain", "--untracked-files=all", check=False)):
        candidates.append(path / line[3:].strip('"'))
    for candidate in candidates:
        try:
            stamps.append(candidate.stat().st_mtime)
        except OSError:
            pass
    return bool(stamps) and time.time() - max(stamps) >= IDLE_DAYS * 86400


def _holders(path: Path) -> str:
    holders = processes_under([path])
    if isinstance(holders, str):
        return t("agent_worktree.holdersUnknown", reason=holders)
    others = [row for row in holders if not row["caller"]]
    if others:
        return t("agent_worktree.holdersPresent",
                 pids=list(str(row["pid"]) for row in others[:5]))
    return ""


def _slim(path: Path) -> list[str]:
    """闲置又没进程在用的工作树，删掉能重装的依赖；返回删掉的目录。"""
    removed = []
    for relative in REBUILDABLE:
        target = path / relative
        if target.is_dir() and not _delete_tree(target):
            removed.append(str(target))
    return removed


def _archive_build(main: Path, path: Path) -> str:
    """把会话的过程文件整体移到 attic，返回落点；测试入口的产物随工作树删掉。"""
    build = path / "build"
    destination = main.parent / BUILD_ARCHIVE / path.name
    suffix = 1
    while destination.exists():
        suffix += 1
        destination = main.parent / BUILD_ARCHIVE / f"{path.name}-{suffix}"
    for child in list(build.iterdir()):
        if child == path / TEST_OUTPUT:
            continue
        destination.mkdir(parents=True, exist_ok=True)
        shutil.move(str(child), str(destination / child.name))
    return str(destination)


def _in_use(path: Path, *, idle: bool = False) -> str:
    """还在用的工作树不回收：返回保留的理由，空串表示可以回收。

    分支已合入、工作区干净，不等于没人在用。2026-10-24 一次 `prune --apply` 回收了一个
    Claude 会话正开着的工作树：它的分支早已并入 master，被 Git 忽略的 `build/` 里却放着
    那个会话的协调脚本、几十份测试与流水线日志和复盘报告，`git worktree remove` 连同它们
    一起删了，没有备份。所以 `build/` 里有会话文件、或者还有进程在里面（会话、终端、预览
    服务），一律留着报出来。判断不了有没有进程时也留着：删错了没法撤回。

    闲置满 `IDLE_DAYS` 天的例外：会话文件由 `_archive_build` 移进 attic 后再回收。
    """
    if not idle and _session_files(path):
        return t("agent_worktree.sessionFiles")
    return _holders(path)


def _reclaim(main: Path, path: Path, branch: str) -> tuple[str, dict[str, str]]:
    """回收单个工作树，把结果归到 reclaimed / residue / failed 之一。

    2026-09-01 实测：Windows 上 `.claude/worktrees/*` 的目录句柄被别的进程占着，
    `git worktree remove` 报 Permission denied，而 git 已经把文件删光、注册也摘掉了，
    只剩一个空目录。所以失败只波及它自己：注册已经摘掉的照常删分支，目录自己再删一遍；
    注册还在才算真没回收成。这一步抛错中止整轮的话，分支一条没删、后面的工作树一个没碰，
    要靠人反复重跑 prune，跑一次才推进一个。

    「注册摘了、目录还在」不该留给人：那个目录在主检出里长得和真工作树一模一样，`git`
    在里面全作用于主检出的 master。git 删不动就自己删，删完才算回收；真删不掉才进
    residue，那时候确实需要人去看是谁占着。
    """
    removal = _git(main, "worktree", "remove", str(path), check=False)
    why = (removal.stderr or removal.stdout).strip()
    registered = {Path(item["path"]).resolve() for item in _worktree_entries(main)}
    if removal.returncode and path.resolve() in registered:
        return "failed", {"path": str(path), "branch": branch, "why": why}
    if branch:
        _git(main, "branch", "-d", branch, check=False)
    if removal.returncode:
        left = _delete_tree(path)
        if left:
            return "residue", {"path": str(path), "branch": branch,
                               "why": t("agent_worktree.residueAfterUnregister", left=left, why=why),
                               "holders": processes_under([path])}
    return "reclaimed", {"path": str(path), "branch": branch}


def _sweep_unregistered(main: Path, here: Path, *, apply: bool
                        ) -> tuple[list[str], list[dict[str, str]], list[dict[str, str]]]:
    """扫掉两个工作树落点里已经不登记的空目录。

    两个落点都要扫：`create` 建工作树的 `WORKTREE_ROOT`，和 Claude Code 内置的
    `BUILTIN_WORKTREES`。这些目录不在 `git worktree list` 里，上面那轮按登记项遍历的
    回收永远碰不到它们，人却会走进去当工作树用——而在里面跑 git 全作用于主检出的
    master。漏掉 `create` 那一侧最贵：那里是智能体被告知要去干活的地方。
    2026-09-13 清点：`peach-worktrees/` 下四个未登记目录共 246 MB，两份是带 `.venv`
    的整树副本，其中一份的句柄还被一个跑在 8931 端口的预览服务占着。  # copy-lint-disable-line

    只删空的：里面还有文件就可能是别人正在用的检出，或者是没提交的东西，那种一律
    留着报出来，不替人做判断。
    """
    swept: list[str] = []
    residue: list[dict[str, str]] = []
    kept: list[dict[str, str]] = []
    registered = {Path(item["path"]).resolve() for item in _worktree_entries(main)}
    for root in _worktree_roots(main):
        if not root.is_dir():
            continue
        for path in sorted(root.iterdir()):
            if not path.is_dir() or path.resolve() in registered or path.resolve() == here:
                continue
            if any(child.is_file() for child in path.rglob("*")):
                kept.append({"path": str(path), "branch": "",
                             "why": t("agent_worktree.unregisteredWithFiles")})
                continue
            if not apply:
                swept.append(str(path))
                continue
            left = _delete_tree(path)
            if left:
                residue.append({"path": str(path), "branch": "", "why": t("agent_worktree.cannotDelete", left=left),
                                "holders": processes_under([path])})
            else:
                swept.append(str(path))
    return swept, residue, kept


def prune(repo: Path, target_branch: str = "master", *,
          apply: bool = False) -> dict[str, object]:
    """回收分支已并入 target、且工作区干净的隔离工作树。

    这个命令存在的理由：`create` 一直有人用，回收却从来没有入口。2026-08-29 清过一次
    到 3 个，两天后又长回 74 个、占 868 MB——因为那次是一次性动作，不是常设机制。

    默认只报告不动手。回收不可逆，而「分支已合入」并不等于「工作区里没有东西」：
    实测就有工作树的分支早已并入 master，里面却躺着一份成形的未提交改动。所以脏的
    一律拒收并单独列出，交给人看，不给 `--force` 这个口子。

    单个工作树回收失败不影响其它工作树：结果分成 reclaimed / swept / residue / failed /
    dirty / kept 六组，整轮照样 ok。理由见 `_reclaim`。`swept` 是两个工作树落点里
    已经不登记的空目录，见 `_sweep_unregistered`。
    """
    main = _main_worktree(repo)
    merged = {line.strip().lstrip("+* ") for line in
              _lines(_git(main, "branch", "--merged", target_branch,
                          "--format=%(refname:short)"))}
    merged.discard(target_branch)
    here = repo.resolve()

    reclaimed: list[str] = []
    residue: list[dict[str, str]] = []
    failed: list[dict[str, str]] = []
    dirty: list[dict[str, str]] = []
    kept: list[dict[str, str]] = []

    slimmed: list[str] = []
    archived: list[dict[str, str]] = []

    def keep(group: list, path: Path, branch: str, why: str, idle: bool) -> None:
        group.append({"path": str(path), "branch": branch, "why": why})
        # 留下来的闲置工作树也不该整份占着：依赖能重装，删掉不丢任何东西。
        if idle and not _holders(path):
            slimmed.extend(_slim(path) if apply else
                           [str(path / rel) for rel in REBUILDABLE if (path / rel).is_dir()])

    for item in _worktree_entries(main):
        path = Path(item["path"])
        branch = item.get("branch", "")
        if path.resolve() == main.resolve() or path.resolve() == here:
            continue
        lock = item.get("locked", "")
        expired = lock == f"locked {ACTIVE_LOCK}"
        if lock and not expired:
            kept.append({"path": str(path), "branch": branch, "why": t("agent_worktree.manualLock")})
            continue
        idle = path.is_dir() and _idle(path)
        if lock and not idle:
            kept.append({"path": str(path), "branch": branch, "why": t("agent_worktree.activeLock")})
            continue
        if branch not in merged:
            keep(kept, path, branch, t("agent_worktree.notMerged", branch=target_branch), idle)
            continue
        if _git(main, "-C", str(path), "status", "--porcelain",
                check=False).stdout.strip():
            keep(dirty, path, branch, t("agent_worktree.uncommittedChanges"), idle)
            continue
        busy = _in_use(path, idle=idle)
        if busy:
            kept.append({"path": str(path), "branch": branch, "why": busy})
            continue
        if not apply:
            reclaimed.append(str(path))
            continue
        if lock:
            _git(main, "worktree", "unlock", str(path), check=False)
        if _session_files(path):
            archived.append({"path": str(path), "to": _archive_build(main, path)})
        group, record = _reclaim(main, path, branch)
        if group == "reclaimed":
            reclaimed.append(str(path))
        elif group == "residue":
            residue.append(record)
        else:
            failed.append(record)

    swept, swept_residue, swept_kept = _sweep_unregistered(main, here, apply=apply)

    return {
        "ok": True,
        "action": "prune",
        "applied": apply,
        "reclaimed": sorted(reclaimed),
        "swept": sorted(swept),
        "residue": residue + swept_residue,
        "failed": failed,
        "dirty": dirty,
        "kept": kept + swept_kept,
        "slimmed": slimmed,
        "archived": archived,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Isolated Peach agent worktree coordinator")
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    sub = parser.add_subparsers(dest="command", required=True)
    start = sub.add_parser("create")
    start.add_argument("--agent", required=True)
    start.add_argument("--task", required=True)
    start.add_argument("--root", type=Path)
    for name in ("preflight", "ready"):
        inspect = sub.add_parser(name)
        inspect.add_argument("--target", default="master")
        if name == 'ready':
            inspect.add_argument('--ci-run', type=int, help=t("agent_worktree.helpCiRun"))
    merge = sub.add_parser("integrate")
    merge.add_argument("--branch", required=True)
    merge.add_argument("--target", default="master")
    sweep = sub.add_parser("prune")
    sweep.add_argument("--target", default="master")
    sweep.add_argument("--apply", action="store_true",
                       help=t("agent_worktree.helpApply"))
    sub.add_parser("processes", help=t("agent_worktree.helpProcesses"))
    args = parser.parse_args()
    try:
        if args.command == "create":
            result = create(args.repo, args.agent, args.task, args.root)
        elif args.command == "preflight":
            result = preflight(args.repo, args.target)
        elif args.command == "ready":
            result = ready(args.repo, args.target, ci_run=args.ci_run)
        elif args.command == "prune":
            result = prune(args.repo, args.target, apply=args.apply)
        elif args.command == "processes":
            result = processes(args.repo)
        else:
            result = integrate(args.repo, args.branch, args.target)
    except WorkspaceError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    os.environ["PYTHONIOENCODING"] = "utf-8"
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="backslashreplace")
    raise SystemExit(main())
