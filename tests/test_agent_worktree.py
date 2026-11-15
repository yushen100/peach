import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager, redirect_stdout
from pathlib import Path
from threading import Event
from unittest import mock

import psutil

from scripts import agent_worktree, check_public_text, release_tag, test_evidence
from scripts.agent_worktree import (
    WorkspaceError, _git, _lines, create, integrate, processes_under, prune, ready,
)
from scripts.version_bump import read_version
from support.gitrepo import seed_repository

#: 仓库里版本化的 git hook，测试原样装进临时仓库。
HOOKS = Path(__file__).resolve().parents[1] / agent_worktree.HOOKS_PATH
AUTHOR = "Co-Authored-By: Codex (GPT-6) <noreply@openai.com>"
MAINTAINER = sorted(agent_worktree.co_author.MAINTAINER_MAILS)[0]


def process_tree_ids(process: subprocess.Popen) -> set[int]:
    """包含 Windows venv 启动器后面的解释器进程。"""
    try:
        return {process.pid, *(child.pid for child in psutil.Process(process.pid).children(recursive=True))}
    except psutil.Error:
        return {process.pid}


def install_commit_hooks(repo: Path) -> None:
    hooks = repo / agent_worktree.HOOKS_PATH
    hooks.mkdir(parents=True)
    sources = list(HOOKS.iterdir())
    sources += [HOOKS.parent / name for name in
                ("check_commit_message.py", "check_readme_impact.py", "co_author.py")
                if (HOOKS.parent / name).is_file()]
    # 钩子的报错按本机语言渲染（`peach.interface_text.dev`），连同它读的语言资源一起装进去。
    package = HOOKS.parents[1] / "src" / "peach"
    sources += [package / name for name in ("interface_text.py", "project_root.py", "system_language.py")]
    sources += sorted((HOOKS.parent / "locales").glob("*/dev.json"))
    for source in sources:
        relative = source.relative_to(HOOKS.parent.parent)
        target = repo / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        target.chmod(0o755)
        _git(repo, "add", relative.as_posix())
    _git(repo, "commit", "-m", "hooks")

#: 版本号的唯一来源，`src/peach/__init__.py` 在测试仓库里的最小复刻。
VERSION_SEED = b'"""Peach application package."""\n\n__version__ = "0.7.14"\n'


class StuckRemoval:
    """复刻 2026-09-01 Windows 上的实测：目录句柄被别的进程占着，
    `git worktree remove` 报 Permission denied。

    `residue`：git 已经把文件删光、注册也摘掉了，只剩一个空目录删不掉。
    `stuck`：注册还在，工作树整个没摘掉。
    """

    def __init__(self, real, modes: dict[Path, str]):
        self.real = real
        self.modes = {path.resolve(): mode for path, mode in modes.items()}

    def __call__(self, repo, *args, **kwargs):
        mode = None
        if args[:2] == ("worktree", "remove"):
            mode = self.modes.get(Path(args[-1]).resolve())
        if mode is None:
            return self.real(repo, *args, **kwargs)
        path = Path(args[-1])
        if mode == "residue":
            self.real(repo, *args, check=False)
            path.mkdir(parents=True, exist_ok=True)
        return subprocess.CompletedProcess(
            list(args), 1, "", f"fatal: failed to delete '{path}': Permission denied")


def commit(repo: Path, message: str) -> None:
    _git(repo, "add", "tracked.txt", "worker.txt")
    _git(repo, "commit", "-m", message)


class _WorktreeCase(unittest.TestCase):
    mock_pull_request = True

    def setUp(self):
        self.verification = mock.patch.object(agent_worktree, "require_verified")
        self.verification.start()
        self.addCleanup(self.verification.stop)
        if self.mock_pull_request:
            pull_request = mock.patch.object(agent_worktree, "require_pull_request", side_effect=
                lambda worker, branch, target, head: {"url": "https://github.com/example/peach/pull/1",
                                                      "head": head, "base": target, "refs": []})
            pull_request.start()
            self.addCleanup(pull_request.stop)
        self.tmp = tempfile.TemporaryDirectory()
        # 先 resolve：prune 报告的是 git worktree list 给出的真实路径，而 CI runner 的
        # 临时目录是别名（macOS /var 软链到 /private/var，Windows 的 RUNNER~1 短名展开
        # 成 runneradmin）。拿未 resolve 的路径去比对，本机全绿、CI 全红。
        self.root = Path(self.tmp.name).resolve()
        self.repo = seed_repository(self.root / "repo", {
            ".gitignore": "build/\n",
            "tracked.txt": "base\n",
            "worker.txt": "base\n",
            "src/peach/__init__.py": VERSION_SEED,
        }, "base")

    def tearDown(self):
        self.tmp.cleanup()

class AgentWorktreeTests(_WorktreeCase):
    def test_document_integration_keeps_its_checks_without_waiting_for_full_suite(self):
        result = create(self.repo, "Codex", "readme", self.root / "worktrees")
        worker = Path(result["path"])
        (worker / "README.md").write_text("# Example\n", encoding="utf-8")
        _git(worker, "add", "README.md")
        _git(worker, "commit", "-m", "docs: example")
        folder = agent_worktree.test_evidence.evidence_dir(self.repo)
        with agent_worktree.test_evidence.held(folder / "full-suite.lock", scope="full"):
            report = integrate(self.repo, str(result["branch"]), lock_timeout=0)
        self.assertEqual(report["files"], ["README.md"])
        agent_worktree.require_verified.assert_called_once_with(worker, "master", {"README.md"})
        self.assertEqual((self.repo / "README.md").read_text(encoding="utf-8"), "# Example\n")

    def test_other_document_paths_use_the_same_checks_boundary(self):
        for index, name in enumerate(("CONTRIBUTING.md", ".github/PULL_REQUEST_TEMPLATE.md")):
            with self.subTest(path=name):
                result = create(self.repo, "Codex", f"document-{index}", self.root / "worktrees")
                worker = Path(result["path"])
                (worker / name).parent.mkdir(parents=True, exist_ok=True)
                (worker / name).write_text("# Example\n", encoding="utf-8")
                _git(worker, "add", name)
                _git(worker, "commit", "-m", "docs: example")
                folder = agent_worktree.test_evidence.evidence_dir(self.repo)
                with agent_worktree.test_evidence.held(folder / "full-suite.lock", scope="full"):
                    report = integrate(self.repo, str(result["branch"]), lock_timeout=0)
                self.assertEqual(report["files"], [name])

    def test_runtime_markdown_still_waits_for_full_suite(self):
        result = create(self.repo, "Codex", "runtime-document", self.root / "worktrees")
        worker = Path(result["path"])
        name = "frontend/src/react/boardui/ORIGIN.md"
        (worker / name).parent.mkdir(parents=True)
        (worker / name).write_text("# Origin\n", encoding="utf-8")
        _git(worker, "add", name)
        _git(worker, "commit", "-m", "docs: origin")
        folder = agent_worktree.test_evidence.evidence_dir(self.repo)
        with agent_worktree.test_evidence.held(folder / "full-suite.lock", scope="full"), \
                self.assertRaisesRegex(WorkspaceError, "全量验证"):
            integrate(self.repo, str(result["branch"]), lock_timeout=0)
        self.assertFalse((self.repo / name).exists())

    def test_waiting_code_integration_does_not_block_documents(self):
        """文档先合进去，排队的代码集成拿到锁后 rebase 到新的 master 上再合，不必回工作树重来。"""
        code = create(self.repo, "Codex", "queued-code", self.root / "worktrees")
        worker = Path(code["path"])
        (worker / "worker.txt").write_text("code\n", encoding="utf-8")
        commit(worker, "worker change")
        origin = self.root / "origin.git"
        subprocess.run(["git", "init", "--bare", "-q", str(origin)], check=True)
        _git(self.repo, "remote", "add", "origin", str(origin))
        _git(worker, "push", "-q", "origin", str(code["branch"]))
        for name in ("_verify_worker", "_await_pull_request_head"):
            patcher = mock.patch.object(agent_worktree, name)
            patcher.start()
            self.addCleanup(patcher.stop)
        docs = create(self.repo, "Codex", "parallel-docs", self.root / "worktrees")
        (Path(docs["path"]) / "README.md").write_text("# Example\n", encoding="utf-8")
        _git(Path(docs["path"]), "add", "README.md")
        _git(Path(docs["path"]), "commit", "-m", "docs: example")
        folder = agent_worktree.test_evidence.evidence_dir(self.repo)
        waiting = Event()
        held = agent_worktree.test_evidence.held

        @contextmanager
        def observed(lock, **kwargs):
            if kwargs.get("branch") == code["branch"] and lock.name == "full-suite.lock":
                waiting.set()
            with held(lock, **kwargs):
                yield

        with ThreadPoolExecutor() as executor, mock.patch.object(
                agent_worktree.test_evidence, "held", observed):
            with held(folder / "full-suite.lock", scope="full"):
                future = executor.submit(integrate, self.repo, str(code["branch"]), lock_timeout=120)
                self.assertTrue(waiting.wait(5), "代码集成尚未进入全量锁等待")
                report = integrate(self.repo, str(docs["branch"]), lock_timeout=0)
                self.assertEqual(report["files"], ["README.md"])
                self.assertFalse(future.done())
            queued = future.result(timeout=60)
            self.assertEqual(queued["files"], ["worker.txt"])
            self.assertIsNotNone(queued["refreshed"], "排队期间 master 前进，拿到锁后自动 rebase")
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "code\n")
        self.assertEqual((self.repo / "README.md").read_text(encoding="utf-8"), "# Example\n")

    def test_code_integration_waits_for_full_suite_without_changing_master(self):
        result = create(self.repo, "Codex", "code", self.root / "worktrees")
        worker = Path(result["path"])
        (worker / "worker.txt").write_text("worker\n", encoding="utf-8")
        (worker / "README.md").write_text("# Example\n", encoding="utf-8")
        _git(worker, "add", "README.md")
        commit(worker, "worker change")
        before = _git(self.repo, "rev-parse", "HEAD").stdout.strip()
        folder = agent_worktree.test_evidence.evidence_dir(self.repo)
        with agent_worktree.test_evidence.held(folder / "full-suite.lock", scope="full"), \
                self.assertRaisesRegex(WorkspaceError, "全量验证"):
            integrate(self.repo, str(result["branch"]), lock_timeout=0)
        self.assertEqual(_git(self.repo, "rev-parse", "HEAD").stdout.strip(), before)
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "base\n")
        self.assertFalse((self.repo / "README.md").exists())

    def test_create_ready_and_integrate_non_overlapping_branch(self):
        result = create(self.repo, "Claude", "metadata batch", self.root / "worktrees")
        worker = Path(result["path"])
        (worker / "worker.txt").write_text("worker\n", encoding="utf-8")
        commit(worker, "worker change")
        report = ready(worker)
        self.assertEqual(report["same_file_changes"], [])
        merged = integrate(self.repo, str(result["branch"]))
        self.assertIn("worker.txt", merged["files"])
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "worker\n")

    def test_ready_rejects_dirty_worker(self):
        result = create(self.repo, "Codex", "dirty task", self.root / "worktrees")
        worker = Path(result["path"])
        (worker / "worker.txt").write_text("dirty\n", encoding="utf-8")
        with self.assertRaisesRegex(WorkspaceError, "dirty"):
            ready(worker)

    def test_integrate_refuses_same_file_changed_on_both_branches(self):
        result = create(self.repo, "Claude", "overlap", self.root / "worktrees")
        worker = Path(result["path"])
        (worker / "tracked.txt").write_text("worker\n", encoding="utf-8")
        commit(worker, "worker overlap")
        (self.repo / "tracked.txt").write_text("main\n", encoding="utf-8")
        commit(self.repo, "main overlap")
        with self.assertRaisesRegex(WorkspaceError, "same-file"):
            integrate(self.repo, str(result["branch"]))
        self.assertEqual(_git(worker, "log", "-1", "--format=%s").stdout.strip(), "worker overlap",
                         "有重叠时不自动 rebase")


class QueuedRebaseTests(_WorktreeCase):
    """排队等锁期间目标分支前进：拿到锁后把工作者分支 rebase 上去、补验、推送，再合入。"""

    def setUp(self):
        super().setUp()
        self.verifier = mock.patch.object(agent_worktree, "_verify_worker")
        self.verify = self.verifier.start()
        self.addCleanup(self.verifier.stop)
        head = mock.patch.object(agent_worktree, "_await_pull_request_head")
        self.head = head.start()
        self.addCleanup(head.stop)
        self.origin = self.root / "origin.git"
        subprocess.run(["git", "init", "--bare", "-q", str(self.origin)], check=True)
        _git(self.repo, "remote", "add", "origin", str(self.origin))

    def worker(self, name: str, path: str, text: str) -> tuple[Path, str]:
        result = create(self.repo, "Claude", name, self.root / "worktrees")
        worker = Path(result["path"])
        (worker / path).parent.mkdir(parents=True, exist_ok=True)
        (worker / path).write_text(text, encoding="utf-8")
        _git(worker, "add", path)
        _git(worker, "commit", "-m", f"fix(tooling): {name}")
        _git(worker, "push", "-q", "origin", str(result["branch"]))
        return worker, str(result["branch"])

    def test_a_target_that_moved_while_queued_is_rebased_verified_and_pushed(self):
        worker, branch = self.worker("queued", "worker.txt", "worker\n")
        before = _git(worker, "rev-parse", "HEAD").stdout.strip()
        (self.repo / "tracked.txt").write_text("main moved\n", encoding="utf-8")
        commit(self.repo, "main moved")
        report = integrate(self.repo, branch)
        after = _git(worker, "rev-parse", "HEAD").stdout.strip()
        self.assertEqual(report["refreshed"], {"from": before, "to": after})
        self.assertNotEqual(before, after)
        self.verify.assert_called_once_with(self.repo, worker, frontend=False)
        self.head.assert_called_once_with(worker, branch, after)
        self.assertEqual(_git(self.origin, "rev-parse", branch).stdout.strip(), after, "PR 分支推到 rebase 后的提交")
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "worker\n")
        self.assertEqual((self.repo / "tracked.txt").read_text(encoding="utf-8"), "main moved\n")

    def test_a_failed_reverification_merges_nothing(self):
        worker, branch = self.worker("red-after-rebase", "worker.txt", "worker\n")
        (self.repo / "tracked.txt").write_text("main moved\n", encoding="utf-8")
        commit(self.repo, "main moved")
        master = _git(self.repo, "rev-parse", "HEAD").stdout.strip()
        self.verify.side_effect = WorkspaceError("rebase 后补验未通过")
        with self.assertRaisesRegex(WorkspaceError, "补验未通过"):
            integrate(self.repo, branch)
        self.assertEqual(_git(self.repo, "rev-parse", "HEAD").stdout.strip(), master)
        self.assertEqual(_git(worker, "status", "--porcelain").stdout, "")
        self.head.assert_not_called()

    def test_an_up_to_date_branch_and_a_documents_branch_are_not_rebased(self):
        worker, branch = self.worker("current", "worker.txt", "worker\n")
        self.assertIsNone(integrate(self.repo, branch)["refreshed"])
        _, docs = self.worker("docs", "README.md", "# Example\n")
        (self.repo / "tracked.txt").write_text("main moved\n", encoding="utf-8")
        commit(self.repo, "main moved")
        self.assertIsNone(integrate(self.repo, docs)["refreshed"], "文档集成不持全量锁，不在锁内补验")
        self.verify.assert_not_called()

    def test_reverification_follows_the_test_entry_and_keeps_the_full_lock(self):
        self.verifier.stop()
        worker = self.root / "worker"
        calls = []
        with mock.patch.object(agent_worktree.subprocess, "run",
                               side_effect=lambda command, **kwargs: calls.append((command, kwargs))
                               or subprocess.CompletedProcess(command, 0)):
            agent_worktree._verify_worker(self.repo, worker, frontend=True)
        commands = [command for command, _ in calls]
        self.assertIn("scripts/test_environment.py", commands[0])
        self.assertEqual(commands[1][-3:], ["--prefix", "frontend", "ci"])
        self.assertEqual(commands[2][1:], ["scripts/test_runner.py", "--scope", "auto", "--jobs", "auto",
                                           "--full-lock-held"])
        self.assertTrue(all(kwargs["cwd"] == worker for _, kwargs in calls))
        self.assertEqual(calls[2][1]["env"]["PYTHONPATH"], str(worker / "src"))
        with mock.patch.object(agent_worktree.subprocess, "run",
                               return_value=subprocess.CompletedProcess([], 1)), \
                self.assertRaisesRegex(WorkspaceError, "integrate-verify.log"):
            agent_worktree._verify_worker(self.repo, worker, frontend=False)
        self.verifier.start()


#: 子进程里的运行器核对借来的全量锁：argv 依次是仓库根与证据目录，退出码 0 表示放行。
LENT_LOCK_PROBE = """
import argparse, sys
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, sys.argv[1])
from scripts import test_runner
test_runner.test_evidence.evidence_dir = lambda root: Path(sys.argv[2])
with test_runner.full_suite_guard(argparse.ArgumentParser(), SimpleNamespace(full_lock_held=True), ("auto",)):
    pass
"""
#: 照 Windows venv 的 python.exe 启动器：中间隔一层进程，才到真正的解释器。
LAUNCHER = "import subprocess, sys; sys.exit(subprocess.run(sys.argv[1:]).returncode)"


class LentFullLockTests(unittest.TestCase):
    """集成入口持锁补验时，它派出的运行器沿用全量锁；别的进程冒用这个开关一律拒绝。"""

    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.folder, ignore_errors=True)

    def probe(self, *, launcher: bool = False) -> subprocess.CompletedProcess:
        command = [sys.executable, "-c", LENT_LOCK_PROBE, str(Path(__file__).resolve().parents[1]),
                   str(self.folder)]
        if launcher:
            command = [sys.executable, "-c", LAUNCHER, *command]
        return subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=120)

    def test_the_holding_integration_lends_its_lock_through_a_launcher(self):
        with test_evidence.held(self.folder / "full-suite.lock", scope="integrate"):
            for launcher in (False, True):
                with self.subTest(launcher=launcher):
                    result = self.probe(launcher=launcher)
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_a_holder_outside_the_ancestry_or_no_holder_is_refused(self):
        sibling = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        self.addCleanup(sibling.wait)
        self.addCleanup(sibling.kill)
        holder = test_evidence.holder_path(self.folder / "full-suite.lock")
        holder.write_text(json.dumps({"pid": sibling.pid}), encoding="utf-8")
        result = self.probe(launcher=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("只供持有全量锁的集成入口", result.stderr)
        holder.unlink()
        self.assertNotEqual(self.probe().returncode, 0)


class PullRequestIntegrationTests(_WorktreeCase):
    mock_pull_request = False

    def setUp(self):
        super().setUp()
        result = create(self.repo, "Codex", "pr-boundary", self.root / "worktrees")
        self.worker = Path(result["path"])
        self.branch = result["branch"]
        (self.worker / "worker.txt").write_text("worker\n", encoding="utf-8")
        commit(self.worker, "fix(tooling): 示例变更")
        self.head = _git(self.worker, "rev-parse", "HEAD").stdout.strip()
        self.pr = {"url": "https://github.com/example/peach/pull/12", "state": "OPEN",
                   "headRefOid": self.head, "baseRefName": "master"}

    @contextmanager
    def github(self, stdout=None, returncode=0, stderr=""):
        run = subprocess.run
        query = mock.Mock(return_value=subprocess.CompletedProcess(
            ["gh"], returncode, json.dumps(self.pr) if stdout is None else stdout, stderr))

        def call(command, *args, **kwargs):
            return query(command, *args, **kwargs) if command[0] == "gh" else run(command, *args, **kwargs)

        with mock.patch.object(agent_worktree.subprocess, "run", side_effect=call):
            yield query

    def assert_refused(self, message):
        before = _git(self.repo, "rev-parse", "HEAD").stdout.strip()
        with self.assertRaisesRegex(WorkspaceError, message):
            integrate(self.repo, self.branch)
        self.assertEqual(_git(self.repo, "rev-parse", "HEAD").stdout.strip(), before)
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "base\n")
        entry = next(row for row in agent_worktree._worktree_entries(self.repo) if row.get("branch") == self.branch)
        self.assertIn("locked", entry)

    def test_missing_pull_request_preserves_master(self):
        with self.github(returncode=1, stderr="no pull requests found for branch"):
            self.assert_refused("未取得 PR")

    def test_open_matching_pull_request_is_bound_to_the_merge(self):
        with self.github() as query:
            result = integrate(self.repo, self.branch)
        self.assertEqual(result["pull_request"],
                         {"url": self.pr["url"], "head": self.head, "base": "master", "refs": [], "body": ""})
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "worker\n")
        command = query.call_args.args[0]
        self.assertEqual(command[:4], ["gh", "pr", "view", self.branch])
        self.assertEqual(query.call_args.kwargs["cwd"], self.worker)
        self.assertEqual(_git(self.repo, "log", "-1", "--format=%B").stdout.strip(),
                         f"Merge branch '{self.branch}' (#12)")

    def test_issue_link_lines_in_the_body_follow_into_the_merge_commit(self):
        body = ("排查记录里顺带提到 #3，不算关联。\n\nRefs #45\r\n"
                "  Refs peach-mitao/peach-roadmap#7\n"
                "Fixes https://github.com/example/peach/issues/8\n"
                "Refs Telegram 用户反馈（非 GitHub issue）\n")
        with self.github(json.dumps({**self.pr, "body": body})):
            result = integrate(self.repo, self.branch)
        refs = ["Refs #45", "Refs peach-mitao/peach-roadmap#7",
                "Fixes https://github.com/example/peach/issues/8"]
        self.assertEqual(result["pull_request"]["refs"], refs)
        self.assertEqual(_git(self.repo, "log", "-1", "--format=%B").stdout.strip(),
                         f"Merge branch '{self.branch}' (#12)\n\n" + "\n".join(refs))

    def test_library_lists_in_the_body_or_a_commit_message_are_refused(self):
        """PR 正文和提交说明公开在 GitHub 上，成串列出本机馆藏的不合入；问题需要的一两个例子照常合入。"""
        library = check_public_text.Library(codes={"ZZQ-101", "ZZQ-102", "ZZQ-103"}, names={"测试女优甲", "测试女优乙"})
        listed = "剩下要人判的：ZZQ-101、ZZQ-102、ZZQ-103。"
        with mock.patch.object(check_public_text, "load_library", return_value=library):
            with self.github(json.dumps({**self.pr, "body": listed})):
                self.assert_refused("PR 正文（番号 3 个")
            (self.worker / "worker.txt").write_text("worker again\n", encoding="utf-8")
            commit(self.worker, "fix(tooling): 测试女优甲与测试女优乙的别名")
            self.pr["headRefOid"] = _git(self.worker, "rev-parse", "HEAD").stdout.strip()
            with self.github(json.dumps({**self.pr, "body": "只修 ZZQ-101 的前缀。"})):
                self.assertRaisesRegex(WorkspaceError, "提交 [0-9a-f]+（人物 2 个", integrate, self.repo, self.branch)

    def test_a_fork_pull_request_committed_as_the_maintainer_is_refused(self):
        """贡献者照 `git log` 把作者配成维护者时，本机集成和 CI 一样拒收；同仓库分支不查。"""
        _git(self.worker, "-c", f"user.email={MAINTAINER}", "commit", "--allow-empty",
             "-m", "fix(tooling): 冒用维护者身份")
        self.pr["headRefOid"] = _git(self.worker, "rev-parse", "HEAD").stdout.strip()
        with self.github(json.dumps({**self.pr, "isCrossRepository": True})):
            self.assert_refused("作者是维护者")
        with self.github(json.dumps({**self.pr, "isCrossRepository": False})):
            integrate(self.repo, self.branch)
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "worker\n")

    def test_a_fork_pull_request_with_the_contributor_s_own_identity_integrates(self):
        with self.github(json.dumps({**self.pr, "isCrossRepository": True})) as query:
            integrate(self.repo, self.branch)
        self.assertIn("isCrossRepository", query.call_args.args[0][-1])
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "worker\n")

    def test_insider_terms_in_the_pr_body_are_refused_but_commit_messages_may_name_the_tooling(self):
        with mock.patch.object(check_public_text, "load_library", return_value=None):
            self.assertRaisesRegex(WorkspaceError, "内部用语.*合批", agent_worktree.require_public_text,
                                   self.repo, {"PR 正文": "合批验证：两处反馈修复。"})
            agent_worktree.require_public_text(self.repo, {"PR 正文": "两处反馈修复一起合入。",
                                                           "提交 abc1234": "fix(worktree): 工作树残留检查跳过空目录"})

    def test_a_single_example_or_a_machine_without_a_ledger_still_integrates(self):
        library = check_public_text.Library(codes={"ZZQ-101", "ZZQ-102", "ZZQ-103"})
        for loaded, body in ((library, "只修 ZZQ-101 的前缀。"), (None, "ZZQ-101、ZZQ-102、ZZQ-103")):
            with self.subTest(body=body), mock.patch.object(check_public_text, "load_library", return_value=loaded):
                agent_worktree.require_public_text(self.repo, {"PR 正文": body})

    def test_an_older_remote_head_and_another_base_are_refused(self):
        for field, value, message in (("headRefOid", "0" * 40, "提交.*不一致"),
                                      ("baseRefName", "other", "目标分支"),
                                      ("state", "CLOSED", "必须开放"),
                                      ("state", "MERGED", "必须开放")):
            with self.subTest(field=field, value=value), self.github(json.dumps({**self.pr, field: value})):
                self.assert_refused(message)

    def test_unreadable_or_invalid_receipts_never_count_as_a_pull_request(self):
        cases = (("", "有效 JSON"), ("{", "有效 JSON"), ("[]", "字段无效"),
                 (json.dumps({**self.pr, "headRefOid": None}), "字段无效"),
                 (json.dumps({**self.pr, "url": "file:///private"}), "链接无效"))
        for stdout, message in cases:
            with self.subTest(stdout=stdout), self.github(stdout):
                self.assert_refused(message)

    def test_an_unavailable_client_and_a_timeout_preserve_master(self):
        for error in (FileNotFoundError("gh"), subprocess.TimeoutExpired(["gh"], 60)):
            with self.subTest(error=type(error).__name__), self.github() as query:
                query.side_effect = error
                self.assert_refused("未取得 PR")

    def test_a_worker_change_during_the_remote_read_prevents_merge(self):
        before = _git(self.repo, "rev-parse", "HEAD").stdout.strip()
        with self.github() as query:
            reply = query.return_value

            def advance(*_args, **_kwargs):
                (self.worker / "worker.txt").write_text("parallel\n", encoding="utf-8")
                commit(self.worker, "fix(tooling): 并行变更")
                return reply

            query.side_effect = advance
            with self.assertRaisesRegex(WorkspaceError, "工作者分支改变"):
                integrate(self.repo, self.branch)
        self.assertEqual(_git(self.repo, "rev-parse", "HEAD").stdout.strip(), before)
        self.assertNotEqual(_git(self.worker, "rev-parse", "HEAD").stdout.strip(), self.head)

    def test_the_requested_target_branch_is_preserved(self):
        _git(self.repo, "branch", "-m", "master", "develop")
        with self.github(json.dumps({**self.pr, "baseRefName": "develop"})):
            result = integrate(self.repo, self.branch, "develop")
        self.assertEqual(result["pull_request"]["base"], "develop")


class PreflightTests(_WorktreeCase):
    def worker(self):
        item = create(self.repo, "Codex", "preflight", self.root / "worktrees")
        worker = Path(item["path"])
        path = worker / "src/peach/module.py"
        path.write_text("VALUE = 1\n", encoding="utf-8")
        _git(worker, "add", "src/peach/module.py")
        _git(worker, "commit", "-m", "fix(tooling): 示例规则", "-m", AUTHOR)
        return worker

    def test_the_cli_checks_metadata_without_reading_or_signing_test_proof(self):
        worker = self.worker()
        output = io.StringIO()
        with mock.patch.object(sys, "argv", ["agent_worktree.py", "--repo", str(worker), "preflight"]), \
                mock.patch.object(agent_worktree.test_evidence, "key") as key, redirect_stdout(output):
            self.assertEqual(agent_worktree.main(), 0)
        result = json.loads(output.getvalue())
        self.assertEqual((result["action"], result["metadata"], result["tests"]),
                         ("preflight", "passed", "not_checked"))
        self.assertEqual(result["head"], _git(worker, "rev-parse", "HEAD").stdout.strip())
        key.assert_not_called()
        agent_worktree.require_verified.assert_not_called()
        agent_worktree.require_pull_request.assert_not_called()
        self.assertFalse((self.repo / "build/agent-verification").exists())

    def test_single_readme_change_passes_preflight_with_authorship_only(self):
        worker = self.worker()
        (worker / 'README.md').write_text('# Example\n', encoding='utf-8')
        _git(worker, 'add', 'README.md')
        _git(worker, 'commit', '-m', 'docs: 更新说明', '-m', AUTHOR)
        with mock.patch.object(agent_worktree.test_evidence, "key") as key:
            result = agent_worktree.preflight(worker)
        self.assertEqual(result['metadata'], 'passed')
        key.assert_not_called()

    def test_dirty_content_and_a_newer_target_require_preparation(self):
        worker = self.worker()
        path = worker / "src/peach/module.py"
        path.write_text("VALUE = 2\n", encoding="utf-8")
        with self.assertRaisesRegex(WorkspaceError, "dirty"):
            agent_worktree.preflight(worker)
        path.write_text("VALUE = 1\n", encoding="utf-8")
        (self.repo / "tracked.txt").write_text("parallel\n", encoding="utf-8")
        commit(self.repo, "docs(tooling): 并行变更")
        with self.assertRaisesRegex(WorkspaceError, "已前进"):
            agent_worktree.preflight(worker)


class MasterCommitGuardTests(_WorktreeCase):
    """主检出的 master 只收 `integrate` 与 `release_tag.py` 的提交。

    2026-09 进 master 的五个红提交，四个是在主检出上直接提交，一个是手工 merge，
    都没经过 ready / integrate 的检查。这里用仓库里那份 hook 原样装进测试仓库。
    """

    def setUp(self):
        super().setUp()
        install_commit_hooks(self.repo)
        environment = mock.patch.dict(os.environ, {"PATH": str(Path(sys.executable).parent)
                                                  + os.pathsep + os.environ.get("PATH", "")})
        environment.start()
        self.addCleanup(environment.stop)
        result = create(self.repo, "Claude", "guarded", self.root / "worktrees")
        self.worker, self.branch = Path(result["path"]), str(result["branch"])
        (self.worker / "worker.txt").write_text("worker\n", encoding="utf-8")
        commit(self.worker, "test: worker change\n\n" + AUTHOR)

    def test_create_points_the_repository_at_the_versioned_hooks(self):
        self.assertEqual(_git(self.repo, "config", "core.hooksPath").stdout.strip(),
                         agent_worktree.HOOKS_PATH)

    def test_a_direct_commit_on_master_in_the_main_checkout_is_refused(self):
        before = _git(self.repo, "rev-parse", "HEAD").stdout
        (self.repo / "tracked.txt").write_text("main\n", encoding="utf-8")
        with self.assertRaisesRegex(WorkspaceError, "主检出只做集成"):
            commit(self.repo, "direct")
        self.assertEqual(_git(self.repo, "rev-parse", "HEAD").stdout, before)

    def test_a_hand_made_merge_into_master_is_refused(self):
        before = _git(self.repo, "rev-parse", "HEAD").stdout
        with self.assertRaisesRegex(WorkspaceError, "主检出只做集成"):
            _git(self.repo, "merge", "--no-ff", "-m", "merge by hand", self.branch)
        self.assertEqual(_git(self.repo, "rev-parse", "HEAD").stdout, before)

    def test_integrate_still_merges_the_worker_branch(self):
        self.assertEqual(_git(self.worker, "status", "--porcelain").stdout, "")
        integrate(self.repo, self.branch)
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "worker\n")

    def test_the_release_commit_carries_the_pass(self):
        """`release_tag.py` 发出的实际参数由 `test_scripts.ShipTests` 钉住。"""
        (self.repo / "tracked.txt").write_text("release\n", encoding="utf-8")
        _git(self.repo, "add", "tracked.txt")
        _git(self.repo, "-c", f"{release_tag.MASTER_WRITER}=release", "commit", "-m", "release")
        self.assertEqual(_git(self.repo, "log", "-1", "--format=%s").stdout.strip(), "release")


class CommitMessageGuardTests(_WorktreeCase):
    def setUp(self):
        super().setUp()
        install_commit_hooks(self.repo)
        environment = mock.patch.dict(os.environ, {"PATH": str(Path(sys.executable).parent)
                                                  + os.pathsep + os.environ.get("PATH", "")})
        environment.start()
        self.addCleanup(environment.stop)
        result = create(self.repo, "codex", "message", self.root / "worktrees with spaces")
        self.worker = Path(result["path"])
        (self.worker / "worker.txt").write_text("worker\n", encoding="utf-8")
        _git(self.worker, "add", "worker.txt")

    def attempt(self, message):
        path = self.worker / "message.txt"
        path.write_text(message, encoding="utf-8")
        return _git(self.worker, "commit", "-F", str(path), check=False)

    def test_a_missing_or_invalid_author_refuses_the_commit_and_keeps_the_index(self):
        before = _git(self.worker, "rev-parse", "HEAD").stdout
        for trailer in ("", "Co-Authored-By: Codex <noreply@openai.com>",
                        "Co-Authored-By: Codex (GPT-6) <wrong@example.com>"):
            with self.subTest(trailer=trailer):
                result = self.attempt("test: check\n\n" + trailer)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("署名" if trailer else "Co-Authored-By", result.stderr)
                self.assertEqual(_git(self.worker, "rev-parse", "HEAD").stdout, before)
                self.assertEqual(_git(self.worker, "diff", "--cached", "--name-only").stdout.strip(),
                                 "worker.txt")

    def test_optional_readme_trailers_are_accepted_as_commit_text(self):
        for declaration in ("README-Impact: none; 内部测试\n\n", "README-Impact: none\n",
                            "README-Impact: none; 内部测试\nREADME-Impact: updated; 文档\n",
                            "README-Reviewed: README.zh-CN.md; 已核对\n\n",
                            "README-Reviewed: README.zh-CN.md;\n", "README-Reviewed: unknown.md; 已核对\n"):
            with self.subTest(declaration=declaration):
                self.assertEqual(check_commit_message.check(self.worker, "test: check\n\n" + declaration + AUTHOR), [])

    def test_valid_trailers_and_amend_preserve_the_message(self):
        message = ("test: 中文提交\n\nREADME-Impact: updated; 两种语言\n" + AUTHOR
                   + "\nCo-Authored-By: Claude Code (Opus 5) <noreply@anthropic.com>\n")
        result = self.attempt(message)
        self.assertEqual(result.returncode, 0, result.stderr)
        amended = _git(self.worker, "commit", "--amend", "--no-edit", check=False)
        self.assertEqual(amended.returncode, 0, amended.stderr)
        self.assertEqual(_git(self.worker, "show", "-s", "--format=%B").stdout.strip(), message.strip())

    def test_human_and_agent_trailers_are_preserved_in_the_commit(self):
        message = ("test: 共同作者署名\n\n" + AUTHOR
                   + "\nCo-Authored-By: Contributor <contributor@example.invalid>\n")
        result = self.attempt(message)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(_git(self.worker, "show", "-s", "--format=%B").stdout.strip(), message.strip())

    def test_commit_accepts_authorship_without_readme_trailers(self):
        result = self.attempt("test: intermediate\n\n" + AUTHOR)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_author_lines_separated_into_different_blocks_are_rejected(self):
        result = self.attempt("test: authors\n\n" + AUTHOR + "\n\n"
                              "Co-Authored-By: Claude Code (Opus 5) <noreply@anthropic.com>")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Co-Authored-By", result.stderr)

    def test_git_comment_lines_do_not_count_as_declarations(self):
        result = self.attempt("test: comments\n\n" + AUTHOR + "\n\n# Co-Authored-By: example\n")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_merge_messages_are_exempt_from_authorship_trailers(self):
        result = self.attempt("test: worker\n\n" + AUTHOR)
        self.assertEqual(result.returncode, 0, result.stderr)
        _git(self.repo, "switch", "-c", "parallel")
        (self.repo / "tracked.txt").write_text("parallel\n", encoding="utf-8")
        _git(self.repo, "add", "tracked.txt")
        _git(self.repo, "commit", "-m", "test: parallel")
        merged = _git(self.worker, "merge", "--no-ff", "-m", "Merge parallel", "parallel", check=False)
        self.assertEqual(merged.returncode, 0, merged.stderr)


if __name__ == "__main__":
    unittest.main()


class PruneTests(_WorktreeCase):
    """回收已经并入 master 的隔离工作树。

    `create` 一直有人用，回收却从来没有入口——2026-08-29 清到 3 个，两天后长回 74 个、
    占 868 MB。一次性清理解决不了这个问题，所以把回收做成命令，并在这里锁住它的边界。
    """

    def _integrated(self, name: str) -> Path:
        result = create(self.repo, "Codex", name, self.root / "worktrees")
        worker = Path(result["path"])
        (worker / "worker.txt").write_text(name + " done\n", encoding="utf-8")
        commit(worker, f"{name} change")
        integrate(self.repo, str(result["branch"]))
        return worker

    def test_reporting_does_not_remove_anything(self):
        """默认只报告。回收不可逆，不该是运行一下就顺手做了的事。"""
        worker = self._integrated("reportable")
        report = prune(self.repo)
        self.assertIn(str(worker), report["reclaimed"])
        self.assertFalse(report["applied"])
        self.assertTrue(worker.is_dir(), "没给 --apply 就不该动手")

    def test_apply_reclaims_the_worktree_and_its_branch(self):
        worker = self._integrated("reclaimable")
        branch = _git(self.repo, "branch", "--list", "agent/codex/reclaimable").stdout
        self.assertIn("reclaimable", branch)
        prune(self.repo, apply=True)
        self.assertFalse(worker.exists(), "工作树应当被回收")
        self.assertNotIn("reclaimable",
                         _git(self.repo, "branch", "--list", "agent/codex/reclaimable").stdout,
                         "已并入的分支也应一并删掉")

    def test_a_worktree_with_files_under_build_is_kept_even_when_clean_and_merged(self):
        """`build/` 被 Git 忽略，`status` 看不见它；里面却是会话的日志、报告和派单，删了没有备份。"""
        (self.repo / ".git" / "info").mkdir(exist_ok=True)
        (self.repo / ".git" / "info" / "exclude").write_text("build/\n", encoding="utf-8")
        worker = self._integrated("has-build")
        (worker / "build").mkdir()
        (worker / "build" / "report.md").write_text("复盘报告\n", encoding="utf-8")
        report = prune(self.repo, apply=True)
        self.assertTrue((worker / "build" / "report.md").is_file())
        self.assertEqual(report["reclaimed"], [])
        self.assertIn("build/", next(row["why"] for row in report["kept"] if row["path"] == str(worker)))

    def test_a_worktree_a_process_is_working_in_is_kept(self):
        """会话、终端或预览服务还开在里面的工作树不回收：分支合入了，人还在用。"""
        worker = self._integrated("in-use")
        process = subprocess.Popen([sys.executable, "-c", "import sys; sys.stdin.read()"],
                                   cwd=worker, stdin=subprocess.PIPE)
        try:
            report = prune(self.repo, apply=True)
            pids = process_tree_ids(process)
        finally:
            process.communicate(timeout=15)
        self.assertTrue(worker.is_dir())
        why = next(row["why"] for row in report["kept"] if row["path"] == str(worker))
        self.assertTrue(any(f"PID {pid}" in why for pid in pids), why)

    def test_a_dirty_worktree_is_refused_even_when_its_branch_is_merged(self):
        """分支已合入不等于工作区里没东西。

        实测就有这样的工作树：分支早已并入 master，里面却躺着一份成形的未提交改动
        （按钮等待态改用 aria-busy，还配了对应的测试）。所以脏的一律拒收并单独列出，
        交给人看，不给 --force 这个口子。
        """
        worker = self._integrated("has-wip")
        (worker / "worker.txt").write_text("未提交的后续改动\n", encoding="utf-8")
        report = prune(self.repo, apply=True)
        self.assertTrue(worker.is_dir(), "脏工作树不能被回收")
        self.assertEqual([row["path"] for row in report["dirty"]], [str(worker)])
        self.assertEqual(report["reclaimed"], [])

    def test_an_unmerged_branch_is_kept_with_a_reason(self):
        result = create(self.repo, "Codex", "still-open", self.root / "worktrees")
        worker = Path(result["path"])
        (worker / "worker.txt").write_text("still open wip\n", encoding="utf-8")
        commit(worker, "still open")
        report = prune(self.repo, apply=True)
        self.assertTrue(worker.is_dir())
        self.assertEqual([row["branch"] for row in report["kept"]], ["agent/codex/still-open"])

    def test_the_main_worktree_is_never_a_candidate(self):
        self._integrated("bystander")
        report = prune(self.repo)
        listed = report["reclaimed"] + [row["path"] for row in report["dirty"] + report["kept"]]
        self.assertNotIn(str(self.repo), listed, "主检出不能出现在回收清单里")

    def test_a_directory_git_could_not_delete_is_deleted_by_the_script(self):
        """git 摘了注册却删不掉目录时，脚本自己把目录删掉，不留给人。

        2026-09-01 实测：连跑 5 次 prune --apply 才把 5 个工作树摘完，5 条分支一条没删，
        最后是手工 `git branch -d` 收的尾——因为 remove 一失败就抛错中止了整轮。分支的
        那半边当时补上了，目录这半边还写着「待人工清理」，于是残留目录照样留在原地：
        长得和真工作树一样，在里面跑 git 全作用于主检出的 master。
        """
        worker = self._integrated("stuck-handle")
        with mock.patch.object(agent_worktree, "_git",
                               StuckRemoval(agent_worktree._git, {worker: "residue"})):
            report = prune(self.repo, apply=True)
        self.assertTrue(report["ok"], "一个目录删不掉不该把整轮判成失败")
        self.assertFalse(worker.exists(), "git 删不掉的空目录由脚本删掉")
        self.assertEqual(report["residue"], [], "删掉了就不是残留")
        self.assertEqual(report["reclaimed"], [str(worker)])
        self.assertNotIn("stuck-handle",
                         _git(self.repo, "branch", "--list", "agent/codex/stuck-handle").stdout,
                         "注册已经摘掉了，分支就该跟着删")

    def test_a_directory_nobody_can_delete_is_reported_with_the_reason(self):
        """脚本也删不掉才算残留：报出原因交给人，分支照删。"""
        worker = self._integrated("locked-handle")
        with mock.patch.object(agent_worktree, "_git",
                               StuckRemoval(agent_worktree._git, {worker: "residue"})), \
                mock.patch.object(agent_worktree, "_delete_tree",
                                  return_value="PermissionError: 目录被别的进程占着"):
            report = prune(self.repo, apply=True)
        self.assertTrue(worker.is_dir(), "删不掉就还在原地")
        self.assertEqual([row["path"] for row in report["residue"]], [str(worker)])
        self.assertIn("目录被别的进程占着", report["residue"][0]["why"])
        self.assertEqual(report["reclaimed"], [])
        self.assertNotIn("locked-handle",
                         _git(self.repo, "branch", "--list", "agent/codex/locked-handle").stdout)

    def test_one_stuck_worktree_does_not_block_the_others(self):
        """回收失败只波及它自己，剩下的工作树照常处理，不用人反复重跑。"""
        stuck = self._integrated("stuck-first")
        other = self._integrated("second-in-line")
        with mock.patch.object(agent_worktree, "_git",
                               StuckRemoval(agent_worktree._git, {stuck: "stuck"})):
            report = prune(self.repo, apply=True)
        self.assertEqual(report["reclaimed"], [str(other)])
        self.assertFalse(other.exists())
        self.assertNotIn("second-in-line",
                         _git(self.repo, "branch", "--list", "agent/codex/second-in-line").stdout)
        self.assertEqual([row["branch"] for row in report["failed"]], ["agent/codex/stuck-first"])
        self.assertTrue(stuck.is_dir())
        self.assertIn("stuck-first",
                      _git(self.repo, "branch", "--list", "agent/codex/stuck-first").stdout,
                      "注册还在就是没回收成，分支不能删")


class IdleWorktreeTests(_WorktreeCase):
    """锁只在 `integrate` 时解开，批量集成和弃置的工作树就一直锁着、一直占地方。

    2026-11-12 清点：367 个工作树占 276 GB，其中 202 个锁定，大多早已没人碰。
    """

    def _created(self, name: str) -> Path:
        return Path(create(self.repo, "Codex", name, self.root / "worktrees")["path"])

    def _age(self, worker: Path, days: int = agent_worktree.IDLE_DAYS + 1) -> None:
        then = time.time() - days * 86400
        admin = Path(_git(worker, "rev-parse", "--path-format=absolute", "--git-dir").stdout.strip())
        reflog = admin / "logs" / "HEAD"
        entries = []
        for line in reflog.read_text(encoding="utf-8").splitlines():
            head, _, message = line.partition("\t")
            fields = head.split()
            fields[-2] = str(int(then))
            entries.append(" ".join(fields) + "\t" + message)
        reflog.write_text("".join(entry + "\n" for entry in entries), encoding="utf-8")
        for path in [admin / "HEAD", reflog, *worker.rglob("*")]:
            if path.exists():
                os.utime(path, (then, then))

    def test_an_idle_worktree_with_the_task_lock_is_reclaimed(self):
        worker = self._created("abandoned")
        self._age(worker)
        report = prune(self.repo, apply=True)
        self.assertIn(str(worker), report["reclaimed"])
        self.assertFalse(worker.exists())

    def test_touching_the_reflog_file_does_not_count_as_activity(self):
        """reflog 文件被批量操作碰过，mtime 刷新了，记录里的时间仍是旧的。"""
        worker = self._created("touched-reflog")
        self._age(worker)
        admin = Path(_git(worker, "rev-parse", "--path-format=absolute", "--git-dir").stdout.strip())
        os.utime(admin / "logs" / "HEAD")
        report = prune(self.repo, apply=True)
        self.assertIn(str(worker), report["reclaimed"])

    def test_an_emptied_reflog_falls_back_to_the_commit_time(self):
        worker = self._created("emptied-reflog")
        old = time.time() - (agent_worktree.IDLE_DAYS + 1) * 86400
        (worker / "worker.txt").write_text("old change\n", encoding="utf-8")
        with mock.patch.dict(os.environ, {"GIT_COMMITTER_DATE": f"{int(old)} +0000"}):
            commit(worker, "old change")
        _git(self.repo, "merge", "--no-ff", "-m", "merge old change", "agent/codex/emptied-reflog")
        self._age(worker)
        admin = Path(_git(worker, "rev-parse", "--path-format=absolute", "--git-dir").stdout.strip())
        (admin / "logs" / "HEAD").write_text("", encoding="utf-8")
        report = prune(self.repo, apply=True)
        self.assertIn(str(worker), report["reclaimed"])

    def test_an_emptied_reflog_on_a_recent_commit_is_kept(self):
        worker = self._created("recent-commit")
        (worker / "worker.txt").write_text("fresh change\n", encoding="utf-8")
        commit(worker, "fresh change")
        self._age(worker)
        admin = Path(_git(worker, "rev-parse", "--path-format=absolute", "--git-dir").stdout.strip())
        (admin / "logs" / "HEAD").write_text("", encoding="utf-8")
        report = prune(self.repo, apply=True)
        self.assertTrue(worker.is_dir())
        self.assertEqual(report["reclaimed"], [])

    def test_deleting_old_files_under_build_does_not_count_as_activity(self):
        """清理删掉旧文件会把目录 mtime 刷成今天；工作树本身仍然闲置。"""
        worker = self._created("cleaned-up")
        logs = worker / agent_worktree.TEST_OUTPUT / "browser" / "network"
        logs.mkdir(parents=True)
        (logs / "network-1.json").write_text("{}", encoding="utf-8")
        (logs / "network-2.json").write_text("{}", encoding="utf-8")
        self._age(worker)
        (logs / "network-2.json").unlink()
        report = prune(self.repo, apply=True)
        self.assertIn(str(worker), report["reclaimed"])

    def test_a_recent_worktree_with_the_task_lock_is_kept(self):
        worker = self._created("in-progress")
        report = prune(self.repo, apply=True)
        self.assertTrue(worker.is_dir())
        self.assertEqual(next(row["why"] for row in report["kept"] if row["path"] == str(worker)),
                         "工作树被活动任务锁定")

    def test_a_lock_with_another_reason_is_never_expired(self):
        worker = self._created("kept-on-purpose")
        _git(self.repo, "worktree", "unlock", str(worker))
        _git(self.repo, "worktree", "lock", "--reason", "保留：用户已确认的预览", str(worker))
        self._age(worker)
        report = prune(self.repo, apply=True)
        self.assertTrue(worker.is_dir())
        self.assertEqual(report["reclaimed"], [])

    def test_test_output_alone_does_not_hold_back_reclaiming(self):
        """测试入口的产物能重跑生成，单个工作树里却能到几 GB。"""
        worker = self._created("tested")
        records = worker / agent_worktree.TEST_OUTPUT / "browser" / "network"
        records.mkdir(parents=True)
        (records / "network-1.json").write_text("{}", encoding="utf-8")
        self._age(worker)
        report = prune(self.repo, apply=True)
        self.assertIn(str(worker), report["reclaimed"])
        self.assertEqual(report["archived"], [])

    def test_session_files_of_an_idle_worktree_move_to_attic(self):
        worker = self._created("coordinated")
        (worker / "build").mkdir()
        (worker / "build" / "report.md").write_text("复盘报告\n", encoding="utf-8")
        (worker / agent_worktree.TEST_OUTPUT).mkdir(parents=True)
        (worker / agent_worktree.TEST_OUTPUT / "auto.json").write_text("{}", encoding="utf-8")
        self._age(worker)
        report = prune(self.repo, apply=True)
        self.assertFalse(worker.exists())
        moved = Path(report["archived"][0]["to"])
        self.assertEqual(moved, self.repo.parent / agent_worktree.BUILD_ARCHIVE / worker.name)
        self.assertEqual((moved / "report.md").read_text(encoding="utf-8"), "复盘报告\n")
        self.assertFalse((moved / "agent-verification").exists())

    def test_an_idle_unmerged_worktree_keeps_its_work_but_drops_rebuildable_dependencies(self):
        worker = self._created("unmerged")
        (worker / "worker.txt").write_text("还没合入的改动\n", encoding="utf-8")
        commit(worker, "unmerged change")
        modules = worker / "frontend" / "node_modules" / "left-pad"
        modules.mkdir(parents=True)
        (modules / "index.js").write_text("module.exports = 1\n", encoding="utf-8")
        self._age(worker)
        report = prune(self.repo, apply=True)
        self.assertTrue((worker / "worker.txt").is_file())
        self.assertFalse((worker / "frontend" / "node_modules").exists())
        self.assertEqual(report["slimmed"], [str(worker / "frontend" / "node_modules")])

    def test_create_prunes_at_most_once_a_day(self):
        abandoned = self._created("first")
        self._age(abandoned)
        (self.repo / ".git" / agent_worktree.PRUNE_STAMP).unlink()
        second = create(self.repo, "Codex", "second", self.root / "worktrees")
        self.assertEqual(second["pruned"]["reclaimed"], 1)
        self.assertFalse(abandoned.exists())
        self.assertIsNone(create(self.repo, "Codex", "third", self.root / "worktrees")["pruned"])


class UnregisteredLeftoverTests(_WorktreeCase):
    """清掉两个工作树落点里已经不登记的残留目录。

    `create` 的落点和 Claude Code 内置的落点都会留下这种目录：它不在
    `git worktree list` 里，所以按登记项遍历的那轮回收永远碰不到它；人却会走进去当
    工作树用，而在里面跑 git 全部作用于主检出的 master。两处同一条规则，只盖其中
    一处的话，另一处的残留就只能靠人想起来。
    """

    def roots(self) -> tuple[Path, ...]:
        """`create` 建在主检出旁边，Claude Code 建在主检出里。"""
        return (self.repo.parent / agent_worktree.WORKTREE_ROOT,
                self.repo / agent_worktree.BUILTIN_WORKTREES)

    def leftover(self, root: Path, name: str) -> Path:
        path = root / name
        path.mkdir(parents=True)
        return path

    def test_an_unregistered_empty_leftover_is_swept(self):
        for root in self.roots():
            with self.subTest(root=root.name):
                empty = self.leftover(root, "distracted-lamarr")
                report = prune(self.repo, apply=True)
                self.assertEqual(report["swept"], [str(empty)])
                self.assertFalse(empty.exists())

    def test_reporting_lists_the_leftover_without_deleting_it(self):
        for root in self.roots():
            with self.subTest(root=root.name):
                empty = self.leftover(root, "reportable-leftover")
                report = prune(self.repo)
                self.assertEqual(report["swept"], [str(empty)])
                self.assertTrue(empty.is_dir(), "没给 --apply 就不该动手")
                shutil.rmtree(empty)

    def test_a_leftover_that_still_holds_files_is_left_alone(self):
        """空目录才扫。里面还有文件就可能是别人正开着的检出或没提交的东西。"""
        for root in self.roots():
            with self.subTest(root=root.name):
                used = self.leftover(root, "sweet-newton")
                (used / "worker.txt").write_text("别人正在用\n", encoding="utf-8")
                report = prune(self.repo, apply=True)
                self.assertEqual(report["swept"], [])
                self.assertTrue(used.is_dir())
                self.assertEqual([row["path"] for row in report["kept"]], [str(used)])
                shutil.rmtree(used)

    def test_a_registered_worktree_under_either_root_is_not_swept(self):
        """登记着的工作树归上面那轮按分支状态处理，扫残留这步不许碰。"""
        for index, root in enumerate(self.roots()):
            with self.subTest(root=root.name):
                task = f"in-place-{index}"
                result = create(self.repo, "Claude", task, root)
                worker = Path(result["path"])
                (worker / "worker.txt").write_text("还在做\n", encoding="utf-8")
                commit(worker, f"{task} wip")
                report = prune(self.repo, apply=True)
                self.assertEqual(report["swept"], [])
                self.assertTrue(worker.is_dir())
                self.assertIn(f"agent/claude/{task}",
                              [row["branch"] for row in report["kept"]])


class LeftoverProcessTests(_WorktreeCase):
    """找出工作树落点下还活着的进程：谁占着删不掉的目录、机器变卡时谁是自己的残留。"""

    def sleeper(self, cwd: Path) -> subprocess.Popen:
        cwd.mkdir(parents=True, exist_ok=True)
        child = subprocess.Popen([sys.executable, "-c", "import sys; sys.stdin.read()"],
                                 cwd=cwd, stdin=subprocess.PIPE)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            rows = processes_under([cwd])
            if any(row["pid"] in process_tree_ids(child) for row in rows):
                break
            time.sleep(0.1)
        return child

    def stop(self, child: subprocess.Popen) -> None:
        # EOF 让解释器自己退出；Windows venv 启动器也会等其子进程结束。
        child.communicate(timeout=10)

    def test_a_process_working_in_a_worktree_is_listed_with_its_details(self):
        child = self.sleeper(self.repo.parent / agent_worktree.WORKTREE_ROOT / "busy")
        try:
            report = agent_worktree.processes(self.repo)
            pids = process_tree_ids(child)
        finally:
            self.stop(child)
        row = next(row for row in report["processes"] if row["pid"] in pids)
        self.assertFalse(row["orphan"], "父进程（测试本身）还在")
        self.assertFalse(row["caller"])
        self.assertGreaterEqual(row["age_minutes"], 0)
        self.assertIn("cpu_percent", row)
        self.assertIn("memory_percent", report["machine"])

    def test_the_caller_and_processes_elsewhere_are_told_apart(self):
        child = self.sleeper(self.root / "elsewhere")
        try:
            rows = processes_under([self.root / "elsewhere", Path(os.getcwd())])
            pids = process_tree_ids(child)
        finally:
            self.stop(child)
        self.assertTrue(any(row["pid"] in pids for row in rows))
        self.assertFalse(any(row["pid"] in pids for row in processes_under([self.repo])))
        mine = [row for row in rows if row["pid"] == os.getpid()]
        self.assertEqual([row["caller"] for row in mine], [True], "调用者自己这条链要标出来")

    def test_a_directory_nobody_can_delete_names_the_process_holding_it(self):
        held = self.repo / agent_worktree.BUILTIN_WORKTREES / "held-open"
        child = self.sleeper(held)
        try:
            with mock.patch.object(agent_worktree, "_delete_tree",
                                   return_value="PermissionError: 目录被别的进程占着"):
                report = prune(self.repo, apply=True)
            pids = process_tree_ids(child)
        finally:
            self.stop(child)
        self.assertEqual([row["path"] for row in report["residue"]], [str(held)])
        self.assertTrue(any(row["pid"] in pids for row in report["residue"][0]["holders"]))

    def test_without_psutil_the_scan_says_it_was_not_obtained(self):
        with mock.patch.dict(sys.modules, {"psutil": None}):
            self.assertTrue(processes_under([self.repo]).startswith("未取得"))
            report = create(self.repo, "Codex", "no-psutil", self.root / "worktrees")
        self.assertTrue(report["orphan_processes"].startswith("未取得"))


class IntegrationVersionTests(_WorktreeCase):
    """集成报告版本号，但把推进它的权力留给发布入口。

    一天几十次集成共用一个版本号：跑着的是哪一份由 commit 认定，`build-info.json`
    随包走，托盘按它算自己落后多少个提交。版本号一次发布推一格，于是每个 `X.Y.Z`
    都对应一份能下载到的制品（ADR-0012）。
    """

    def worker_touching(self, name: str, path: str, text: str = "改了\n", *,
                        subject: str | None = None) -> str:
        result = create(self.repo, "Claude", name, self.root / "worktrees")
        worker = Path(result["path"])
        target = worker / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        _git(worker, "add", path)
        _git(worker, "commit", "-m", subject or f"fix: {name}")
        return str(result["branch"])

    def test_a_runtime_fix_merges_without_touching_the_version(self):
        branch = self.worker_touching("runtime-change", "src/peach/module.py")
        report = integrate(self.repo, branch)
        self.assertEqual(report["version"], "0.7.14")
        self.assertEqual(read_version(self.repo), "0.7.14")
        self.assertEqual(_git(self.repo, "log", "-1", "--format=%s").stdout.strip(),
                         f"Merge branch '{branch}' (#1)")
        touched = _lines(_git(self.repo, "show", "--name-only", "--format=", "HEAD"))
        self.assertNotIn("src/peach/__init__.py", touched)

    def test_a_feature_commit_stays_on_the_same_version_too(self):
        """`feat` 决定的是发布时推哪一位，不是集成时推不推。"""
        branch = self.worker_touching("feature-work", "src/peach/module.py", subject="feat: 新功能")
        report = integrate(self.repo, branch)
        self.assertEqual(report["version"], "0.7.14")
        self.assertEqual(read_version(self.repo), "0.7.14")

    def test_a_new_migration_stays_on_the_same_version_too(self):
        branch = self.worker_touching("schema", "migrations/0099_new.sql", subject="fix: 补一列")
        self.assertEqual(integrate(self.repo, branch)["version"], "0.7.14")
        self.assertEqual(read_version(self.repo), "0.7.14")

    def test_integration_never_creates_a_version_tag_itself(self):
        """打标签只有 `scripts/release_tag.py` 一个入口，它遇到同名本地标签就拒绝。

        集成这一步再造一个本地标签，等于把唯一的发布入口挡在门外。
        """
        branch = self.worker_touching("taggable", "src/peach/module.py")
        report = integrate(self.repo, branch)
        self.assertEqual(report["release_tag_entry"], "scripts/release_tag.py")
        self.assertEqual(_lines(_git(self.repo, "tag", "--list")), [])

    def test_every_integration_reports_whether_a_release_is_due(self):
        """判断挂在集成的输出里，不靠谁记着去查——「记着」正是它要替掉的东西。"""
        branch = self.worker_touching("user-visible", "src/peach/module.py",
                                      subject="fix(web): 修一处使用者看得见的")
        report = integrate(self.repo, branch)
        self.assertEqual(report["release"]["entries"], 1)
        self.assertEqual(report["release"]["groups"], {"Fixed": 1})
        self.assertIn("due", report["release"])

    def test_development_only_work_never_asks_for_a_release(self):
        branch = self.worker_touching("inside-only", "src/peach/module.py",
                                      subject="refactor(web): 只动开发过程")
        report = integrate(self.repo, branch)
        self.assertEqual((report["release"]["entries"], report["release"]["due"]), (0, False))


from scripts.check_readme_impact import git


from scripts import check_commit_message, co_author


class CoAuthorTests(unittest.TestCase):
    """交付提交的署名。追责要落到具体的模型，所以工具名单独一个词不够。"""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name).resolve()
        git(self.repo, "init", "-b", "master")
        git(self.repo, "config", "user.name", "Test")
        git(self.repo, "config", "user.email", "test@example.invalid")
        git(self.repo, "commit", "--allow-empty", "-m", "base")
        git(self.repo, "checkout", "-b", "worker")

    def signed(self, *trailers):
        git(self.repo, "commit", "--allow-empty", "-m", "测试", "-m", "\n".join(trailers))
        return co_author.check(self.repo, "master")

    def test_an_unsigned_commit_cannot_be_traced_back_to_a_model(self):
        self.assertTrue(self.signed())

    def test_the_tool_alone_does_not_say_which_model_wrote_it(self):
        self.assertTrue(self.signed("Co-Authored-By: Claude Code <noreply@anthropic.com>"))

    def test_each_registered_tool_passes_with_its_own_vendor(self):
        self.assertEqual(
            self.signed("Co-Authored-By: Claude Code (Opus 5) <noreply@anthropic.com>"), [])
        self.assertEqual(
            self.signed("Co-Authored-By: Codex (GPT-5.5) <noreply@openai.com>"), [])
        self.assertEqual(
            self.signed("Co-Authored-By: opencode (GLM 5.3 Flash) <noreply@opencode.ai>"), [])

    def test_an_address_that_does_not_belong_to_the_tool_is_rejected(self):
        self.assertTrue(self.signed("Co-Authored-By: Codex (GPT-5.5) <noreply@anthropic.com>"))

    def test_an_unregistered_tool_waits_until_someone_registers_it(self):
        """名单在 `co_author.VENDORS`：换用别的智能体是要动一行代码的决定，不是随手写。"""
        self.assertTrue(self.signed("Co-Authored-By: Gemini CLI (3.5) <noreply@google.com>"))

    def test_two_agents_writing_one_commit_may_both_sign(self):
        self.assertEqual(
            self.signed("Co-Authored-By: Claude Code (Opus 5) <noreply@anthropic.com>",
                        "Co-Authored-By: Codex (GPT-5.5) <noreply@openai.com>"), [])

    def test_human_and_agent_coauthors_share_one_commit(self):
        human = "Co-Authored-By: Contributor <contributor@example.invalid>"
        agent = "Co-Authored-By: Codex (GPT-6) <noreply@openai.com>"
        for signatures in ((human, agent), (agent, human)):
            with self.subTest(signatures=signatures):
                self.assertEqual(self.signed(*signatures), [])

    def test_human_coauthor_requires_an_agent_signature(self):
        self.assertTrue(self.signed("Co-Authored-By: Contributor <contributor@example.invalid>"))

    def contributed(self, *trailers):
        """采纳的社区补丁：作者是贡献者本人，不是本机提交者。"""
        git(self.repo, "commit", "--allow-empty", "-m", "测试", "-m", "\n".join(trailers) or "说明",
            "--author", "Contributor <contributor@example.invalid>")
        return co_author.check(self.repo, "master")

    def test_a_contributor_commit_is_not_given_an_agent_signature_it_never_had(self):
        """外部贡献者是否用了 AI 由本人说明；门槛不能逼维护者替他补一行 AI 署名。"""
        self.assertEqual(self.contributed(), [])

    def test_a_contributor_may_name_a_tool_the_maintainer_has_not_registered(self):
        """工具名单约束的是本机智能体，贡献者用什么工具是他自己的事。"""
        self.assertEqual(self.contributed("Co-Authored-By: Qoder (Qwen 3) <noreply@qoder.com>"), [])

    def test_a_contributor_signature_still_has_to_be_well_formed(self):
        self.assertTrue(self.contributed("Co-Authored-By: Codex (GPT-6) <noreply@anthropic.com>"))
        self.assertTrue(co_author.problems("测试", ["Codex <someone@example.invalid>"], own=False))

    def test_the_local_committer_signs_even_beside_an_adopted_commit(self):
        self.contributed()
        self.assertEqual(len(self.signed()), 1)

    def test_an_unknown_local_identity_is_treated_as_the_local_committer(self):
        """取不到本机邮箱时无法判断作者是谁，按本机提交从严检查。"""
        self.assertTrue(co_author.is_own("contributor@example.invalid", ""))
        self.assertFalse(co_author.is_own("contributor@example.invalid", "test@example.invalid"))
        self.assertTrue(co_author.is_own("Test@Example.invalid", "test@example.invalid"))

    def test_the_commit_hook_reads_the_author_actually_used(self):
        self.assertEqual(check_commit_message.author_mail(self.repo), "test@example.invalid")
        self.assertEqual(check_commit_message.check(self.repo, "测试\n", own=False), [])
        self.assertTrue(check_commit_message.check(self.repo, "测试\n", own=True))

    def test_human_coauthor_requires_a_name_and_email(self):
        agent = "Co-Authored-By: Codex (GPT-6) <noreply@openai.com>"
        for human in ("Contributor", "Contributor <invalid>", "<contributor@example.invalid>"):
            with self.subTest(human=human):
                self.assertTrue(co_author.problems("测试", [agent, human]))

    def test_registered_agent_and_vendor_addresses_require_model_metadata(self):
        agent = "Codex (GPT-6) <noreply@openai.com>"
        for signature in ("Codex <someone@example.invalid>",
                          "Contributor <noreply@openai.com>"):
            with self.subTest(signature=signature):
                self.assertTrue(co_author.problems("测试", [agent, signature]))

    def test_every_commit_on_the_branch_is_checked_not_only_head(self):
        """一次交付常常是好几个提交。只判尖端等于只判收尾那一次签得对不对，
        而要追的恰恰是写出某一行的那个提交，所以问题里要报出它的短 hash 和主题。
        """
        self.signed("Co-Authored-By: Gemini CLI (3.5) <noreply@google.com>")
        problems = self.signed(
            "Co-Authored-By: Claude Code (Opus 5) <noreply@anthropic.com>")
        self.assertEqual(len(problems), 1)
        self.assertIn(git(self.repo, "log", "-1", "--format=%h", "HEAD~1").strip(),
                      problems[0])
        self.assertIn("Gemini CLI", problems[0])

    def test_merges_from_the_target_branch_are_not_the_worker_s_commits(self):
        """目标分支上的提交由它自己那次交付负责，合进来不等于这个分支重写了一遍。"""
        git(self.repo, "checkout", "master")
        git(self.repo, "commit", "--allow-empty", "-m", "上游的提交")
        git(self.repo, "checkout", "worker")
        self.signed("Co-Authored-By: Claude Code (Opus 5) <noreply@anthropic.com>")
        git(self.repo, "merge", "--no-ff", "-m", "Merge branch 'master' into worker",
            "master")
        self.assertEqual(co_author.check(self.repo, "master"), [])

    def test_a_commit_already_on_the_remote_master_cannot_be_signed_any_more(self):
        """网页上直接改的那条已经在 `origin/master` 上，分支并回它时改写 hash 只能强推；
        没有远端引用时什么都不豁免。"""
        git(self.repo, "commit", "--allow-empty", "-m", "Remove section from README")
        published = git(self.repo, "rev-parse", "HEAD").strip()
        self.signed("Co-Authored-By: Claude Code (Opus 5) <noreply@anthropic.com>")
        self.assertEqual(len(co_author.check(self.repo, "master")), 1)
        git(self.repo, "update-ref", "refs/remotes/origin/master", published)
        self.assertEqual(co_author.check(self.repo, "master"), [])

    def test_the_signature_gate_runs_before_the_test_evidence_is_read(self):
        """署名在读取测试记录前检查。"""
        (self.repo / "tests").mkdir()
        (self.repo / "tests" / "example.py").write_text("x = 1\n", encoding="utf-8")
        git(self.repo, "add", "--", "tests/example.py")
        git(self.repo, "commit", "-m", "测试")
        with mock.patch.object(agent_worktree.test_evidence, "key") as key:
            with self.assertRaisesRegex(agent_worktree.WorkspaceError, "Co-Authored-By"):
                agent_worktree.require_verified(self.repo, "master", {"tests/example.py"})
            key.assert_not_called()


from scripts import check_pr_identity


class PullRequestIdentityTests(unittest.TestCase):
    """fork PR 的提交不得记在维护者名下；维护者已在目标分支上的提交不算。"""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name).resolve()
        git(self.repo, "init", "-b", "master")
        git(self.repo, "config", "user.name", "Contributor")
        git(self.repo, "config", "user.email", "contributor@example.invalid")
        git(self.repo, "-c", f"user.email={MAINTAINER}", "commit", "--allow-empty", "-m", "base")
        git(self.repo, "checkout", "-b", "worker")

    def test_the_contributor_s_own_commits_pass(self):
        git(self.repo, "commit", "--allow-empty", "-m", "fix(web): 贡献者自己的提交")
        self.assertEqual(check_pr_identity.problems(self.repo, "master"), [])

    def test_the_maintainer_as_author_is_refused(self):
        git(self.repo, "commit", "--allow-empty", "-m", "作者冒用",
            "--author", f"Maintainer <{MAINTAINER.upper()}>")
        found = check_pr_identity.problems(self.repo, "master")
        self.assertEqual(len(found), 1)
        self.assertTrue(found[0].endswith("作者冒用"), found)

    def test_the_maintainer_rebasing_a_contributor_s_commit_is_not_impersonation(self):
        git(self.repo, "-c", f"user.email={MAINTAINER}", "commit", "--allow-empty", "-m", "维护者 rebase 过",
            "--author", "Contributor <contributor@example.invalid>")
        self.assertEqual(check_pr_identity.problems(self.repo, "master"), [])

    def test_maintainer_commits_merged_from_the_target_branch_are_not_the_contributor_s(self):
        git(self.repo, "checkout", "master")
        git(self.repo, "-c", f"user.email={MAINTAINER}", "commit", "--allow-empty", "-m", "上游的提交")
        git(self.repo, "checkout", "worker")
        git(self.repo, "commit", "--allow-empty", "-m", "贡献者自己的提交")
        git(self.repo, "-c", f"user.email={MAINTAINER}", "merge", "--no-ff", "-m", "Merge master", "master")
        self.assertEqual(check_pr_identity.problems(self.repo, "master"), [])

    def test_the_ci_entry_runs_as_a_bare_script_and_explains_the_fix_in_the_local_language(self):
        script = Path(__file__).resolve().parents[1] / "scripts" / "check_pr_identity.py"

        def run(language="en"):
            return subprocess.run([sys.executable, str(script), "--base", "master"], cwd=self.repo,
                                  capture_output=True, text=True, encoding="utf-8",
                                  env={**os.environ, "PYTHONIOENCODING": "utf-8", "PEACH_LANGUAGE": language})

        self.assertEqual(run().returncode, 0)
        git(self.repo, "-c", f"user.email={MAINTAINER}", "commit", "--allow-empty", "-m", "冒用")
        for language, said in (("en", "authored as the maintainer"), ("zh-CN", "作者是维护者")):
            result = run(language)
            self.assertEqual(result.returncode, 1, result.stderr)
            for expected in (said, "--reset-author", "冒用"):
                self.assertIn(expected, result.stderr)


from scripts import commit_subject


class CommitSubjectTests(unittest.TestCase):
    """提交主题的形状。变更日志按它分组，写歪的提交不报错，只是静默漏掉。"""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name).resolve()
        git(self.repo, "init", "-b", "master")
        git(self.repo, "config", "user.name", "Test")
        git(self.repo, "config", "user.email", "test@example.invalid")
        git(self.repo, "commit", "--allow-empty", "-m", "base")
        git(self.repo, "checkout", "-b", "worker")

    def titled(self, *subjects):
        for subject in subjects:
            git(self.repo, "commit", "--allow-empty", "-m", subject)
        return commit_subject.check(self.repo, "master")

    def test_a_conventional_subject_passes_with_or_without_scope(self):
        self.assertEqual(self.titled("fix(web): 补齐图标声明", "docs: 补记四个版本",
                                     "refactor(media)!: 删掉旧快照根"), [])

    def test_a_bare_sentence_is_not_a_subject(self):
        self.assertTrue(self.titled("修复关注页按手柄查不到"))

    def test_the_space_after_the_colon_is_part_of_the_shape(self):
        self.assertTrue(self.titled("fix(web):保留必需凭据"))

    def test_an_unlisted_type_waits_until_someone_lists_it(self):
        """清单在 `commit_subject.TYPES`：加类型要先想清它在变更日志里归哪一组。"""
        problems = self.titled("release(app): 版本 0.30.0")
        self.assertEqual(len(problems), 1)
        self.assertIn("release", problems[0])

    def test_every_commit_on_the_branch_is_checked_not_only_head(self):
        problems = self.titled("补齐 JAV 元数据", "fix(web): 后面这条是对的")
        self.assertEqual(len(problems), 1)
        self.assertIn("补齐 JAV 元数据", problems[0])

    def test_merges_from_the_target_branch_are_not_the_worker_s_subjects(self):
        git(self.repo, "checkout", "master")
        git(self.repo, "commit", "--allow-empty", "-m", "chore(deps-dev): bump vitest")
        git(self.repo, "checkout", "worker")
        git(self.repo, "commit", "--allow-empty", "-m", "fix(web): 自己的提交")
        git(self.repo, "merge", "--no-ff", "-m", "Merge branch 'master' into worker", "master")
        self.assertEqual(commit_subject.check(self.repo, "master"), [])

    def test_an_adopted_community_commit_keeps_its_own_subject(self):
        """`merge -s ours` 记入的社区提交原样保留，主题门槛只管本机提交者写的。"""
        git(self.repo, "checkout", "-b", "community", "master")
        git(self.repo, "-c", "user.email=someone@users.noreply.github.com", "commit", "--allow-empty",
            "-m", "Translate frontend UI to English")
        git(self.repo, "checkout", "worker")
        git(self.repo, "merge", "-s", "ours", "--no-ff", "-m", "chore(i18n): 记入社区译法", "community")
        self.assertEqual(commit_subject.check(self.repo, "master"), [])
        self.assertTrue(self.titled("Translate it myself"))

    def test_a_subject_already_on_the_remote_master_is_not_the_worker_s_to_fix(self):
        problems = self.titled("Remove section from README", "docs(readme): 并回网页上的改动")
        self.assertEqual(len(problems), 1)
        git(self.repo, "update-ref", "refs/remotes/origin/master",
            git(self.repo, "rev-parse", "HEAD~1").strip())
        self.assertEqual(commit_subject.check(self.repo, "master"), [])

    def test_the_subject_gate_runs_before_the_test_evidence_is_read(self):
        (self.repo / "tests").mkdir()
        (self.repo / "tests" / "example.py").write_text("x = 1\n", encoding="utf-8")
        git(self.repo, "add", "--", "tests/example.py")
        git(self.repo, "commit", "-m", "加个测试", "-m",
            "Co-Authored-By: Claude Code (Opus 5) <noreply@anthropic.com>")
        with mock.patch.object(agent_worktree.test_evidence, "key") as key:
            with self.assertRaisesRegex(agent_worktree.WorkspaceError, "提交主题"):
                agent_worktree.require_verified(self.repo, "master", {"tests/example.py"})
            key.assert_not_called()
