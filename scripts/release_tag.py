"""版本号推进与版本标签：发布的唯一入口。

一次发布走两条命令，中间夹一次人的确认：

    python scripts/release_tag.py --bump auto --apply   # 推版本号、起草那一节
    #  → 人看一眼 `CHANGELOG.md` 新那一节的措辞，这是使用者唯一读到的说明
    python scripts/release_tag.py --ship --apply        # 提交、推送、等 CI、打标签，
                                                        # 制品齐了再把 README 直链换到新版本

确认点只有一个，剩下的判据都由脚本挡：`--ship` 拒绝夹带别的改动，拒绝在 Test 转绿前
打标签，中途停下再跑一次就接着走。人要决定的只是措辞对不对，不是流程走到哪一步了。

版本号只在这里动：每个 `X.Y.Z` 都对应一份可下载的制品，日常集成的提交由 commit
标识（ADR-0012）。
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time

if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = "scripts"
if str(Path(__file__).resolve().parents[1] / "src") not in sys.path:
    sys.path.insert(1, str(Path(__file__).resolve().parents[1] / "src"))
from peach.interface_text import dev as t

from . import changelog, github_release_candidate, version_bump

ROOT = Path(__file__).resolve().parents[1]
GITLAB = None

#: 主检出的 master 上该落提交的只有本脚本与 `agent_worktree.py integrate`。它们调用 git 时
#: 带上这个配置，`scripts/githooks/pre-commit` 据此放行，别的提交与手工 merge 一律拒收。
#: 它住在这里而不是 `agent_worktree`：`--verify-sha` 跟着 Release 工作流跑，那一步只有裸
#: Python，依赖要到后面的构建步骤才装；反过来引用就把 `test_evidence` 那条链（filelock）拘进来，
#: 标签推上去也发不出东西。
MASTER_WRITER = "peach.masterWriter"

#: 定版只该改这两份：版本号一行，变更日志一节。`--ship` 拒绝夹带别的文件。
#: README 下载直链不在其中：制品上传完之前换过去就是 404，它们等 Release 齐了单独提交。
RELEASE_FILES = (version_bump.VERSION_FILE, changelog.CHANGELOG)
README_SUBJECT = "docs(readme): 下载直链指向 {tag}"

#: `--ship` 等 Test 工作流的默认秒数上限，以及两次查询之间的间隔。版本提交的流水线里还有发布
#: 演练（macOS 两个架构从源码编译，作业时限 2 小时），所以按整条演练定。
TEST_TIMEOUT = 4 * 3600.0
TEST_POLL = 30.0
#: 任务排队多久仍没开始就判定等不到。空闲 runner 几秒内轮询接单，GitLab Runner 默认
#: 3 秒一轮，平台创建流水线也只要几秒；五分钟还没动静就不是正常排队，而是 runner
#: 不在线或一直被占着，继续等只会把总超时耗完。推送后迟迟没有 Test 记录也按这个数判。
STALL_SECONDS = 300.0


def command(*args: str, strip: bool = True) -> str:
    """`strip=False` 给首列本身就是空格的输出用：`git status --porcelain` 的第一行是
    ` M CHANGELOG.md`，整体 strip 会连状态列的空格一起吃掉，按列取路径就少一个字。"""
    output = subprocess.run(args, cwd=ROOT, check=True, capture_output=True,
                            text=True, encoding="utf-8").stdout
    return output.strip() if strip else output


def api(repo: str, endpoint: str):
    return json.loads(command("gh", "api", f"repos/{repo}/{endpoint}"))


def master_sha(repo: str) -> str:
    return GITLAB.master_sha(repo) if GITLAB else api(repo, "git/ref/heads/master")["object"]["sha"]


def remote_url(repo: str) -> str:
    return GITLAB.remote_url(repo) if GITLAB else f"https://github.com/{repo}.git"


def release_url(repo: str, tag: str) -> str:
    return GITLAB.release_url(repo, tag) if GITLAB else f"https://github.com/{repo}/releases/tag/{tag}"


def latest_run(runs: list[dict], sha: str) -> dict | None:
    """这个提交在 master 上最新的一次 Test；没有记录时是 None。"""
    matching = [run for run in runs if run.get("head_sha") == sha
                and run.get("head_branch") == "master" and run.get("event") == "push"]
    if not matching:
        return None
    return max(matching, key=lambda run: (run["id"], run.get("run_attempt", 1)))


def require_success(runs: list[dict], sha: str) -> dict:
    latest = latest_run(runs, sha)
    if latest is None:
        raise ValueError(t("release_tag.noTestRun"))
    if latest.get("status") != "completed" or latest.get("conclusion") != "success":
        raise ValueError(t("release_tag.testNotPassed", url=latest.get('html_url', '')))
    return latest


def test_runs(repo: str, sha: str) -> list[dict]:
    if GITLAB:
        return GITLAB.test_runs(repo, sha)
    endpoint = f"actions/workflows/test.yml/runs?head_sha={sha}&event=push&per_page=100"
    runs = api(repo, endpoint)["workflow_runs"]
    latest = latest_run(runs, sha)
    if latest is not None and latest.get("status") != "completed":
        latest["queued_jobs"] = github_queued_jobs(repo, latest["id"])
    return runs


def github_queued_jobs(repo: str, run_id: int) -> list[dict]:
    """GitHub 上排着队、没有 runner 接走的自建 runner 任务，字段与 GitLab 一侧一致。

    只看 `queued` 且没有 `runner_id` 的；`waiting` 是在等环境审批。托管 runner
    （`ubuntu-latest`、`macos-15` 这类）排队是平台容量问题，迟早会接，不在这里下结论。
    """
    jobs = api(repo, f"actions/runs/{run_id}/jobs?per_page=100")["jobs"]
    waiting = [job for job in jobs if job.get("status") == "queued" and not job.get("runner_id")
               and "self-hosted" in {label.lower() for label in job.get("labels") or ()}]
    if not waiting:
        return []
    try:
        # 列 runner 要仓库管理员权限；读不到就只按排队时长判断。
        runners = api(repo, "actions/runners?per_page=100")["runners"]
    except (subprocess.CalledProcessError, OSError, ValueError, KeyError):
        runners = None
    result = []
    for job in waiting:
        labels = {label.lower() for label in job["labels"]}
        matching = [runner for runner in runners or ()
                    if labels <= {item["name"].lower() for item in runner.get("labels") or ()}]
        if any(runner.get("status") == "online" for runner in matching):
            continue
        result.append({"id": job["id"], "name": job["name"], "tags": sorted(job["labels"]),
                       "queued": None, "runners": "offline" if matching else "unknown"})
    return result


def _stalled(queued: list[dict], first_seen: dict, now: float) -> list[str]:
    """排队任务里已经可以判定等不到的，每项一句说明。"""
    lines = []
    for job in queued:
        seen = first_seen.setdefault(job["id"], now)
        waited = max(job.get("queued") or 0.0, now - seen)
        tags = list(job["tags"]) or t("release_tag.noTags")
        if job["runners"] == "offline":
            lines.append(t("release_tag.jobStalledOffline", job=job['name'], tags=tags, minutes=f"{waited / 60:.0f}"))
        elif waited >= STALL_SECONDS:
            lines.append(t("release_tag.jobStalledUnknown", job=job['name'], tags=tags, minutes=f"{waited / 60:.0f}"))
    return lines


def await_test(repo: str, sha: str, *, timeout: float = TEST_TIMEOUT, poll: float = TEST_POLL,
               sleep=time.sleep, clock=time.monotonic) -> dict:
    """等这个提交的 Test 出结果。

    能确定等不到结果的立刻抛，不耗到超时：跑完了但不是绿的、必需任务已经失败的、
    任务排着队却没有 runner 能接的、推送后迟迟没有 Test 记录的。正常运行中的继续等，
    超时也抛。无论哪种，版本提交都已经在 master 上，处理好之后再跑一次
    `--ship --apply` 就接着走。
    """
    start = clock()
    deadline = start + timeout
    first_seen: dict = {}
    while True:
        runs = test_runs(repo, sha)
        latest = latest_run(runs, sha)
        now = clock()
        if latest is None:
            if now - start >= STALL_SECONDS:
                raise ValueError(t("release_tag.noTestRunAfterPush", minutes=f"{(now - start) / 60:.0f}", sha=sha[:8]))
        elif latest.get("status") == "completed":
            return require_success(runs, sha)
        else:
            url = latest.get("html_url", "")
            if latest.get("failed_jobs"):
                raise ValueError(t("release_tag.requiredJobsFailed", sha=sha[:8],
                                   jobs=list(latest['failed_jobs']), url=url))
            stalled = _stalled(latest.get("queued_jobs") or [], first_seen, now)
            if stalled:
                raise ValueError(t("release_tag.testStalled", minutes=f"{(now - start) / 60:.0f}", sha=sha[:8],
                                   jobs=t("common.clauseSeparator").join(stalled), url=url))
        if now >= deadline:
            raise ValueError(t("release_tag.testTimedOut", minutes=f"{timeout / 60:.0f}", sha=sha[:8]))
        sleep(poll)


def require_rehearsal(repo: str, sha: str, checked: dict, *, timeout: float = TEST_TIMEOUT,
                      poll: float = TEST_POLL, sleep=time.sleep, clock=time.monotonic) -> None:
    """版本提交的发布演练全部通过才打标签（ADR-0121）。

    GitGud 上演练就在版本提交自己的主线流水线里，Test 绿了以后再核对演练作业都在、都成功；
    GitHub 上演练是同一提交推送触发的 Release 工作流（不带标签时只构建、验收不发布），等它跑完。
    """
    if GITLAB:
        GITLAB.require_rehearsal(repo, checked["id"])
        return
    start = clock()
    while True:
        runs = api(repo, f"actions/workflows/release.yml/runs?head_sha={sha}&event=push&per_page=100")["workflow_runs"]
        latest = latest_run(runs, sha)
        now = clock()
        if latest is not None and latest.get("status") == "completed":
            if latest.get("conclusion") != "success":
                raise ValueError(t("release_tag.rehearsalFailed", url=latest.get('html_url', '')))
            return
        if latest is None and now - start >= STALL_SECONDS:
            raise ValueError(t("release_tag.noRehearsalAfterPush", minutes=f"{(now - start) / 60:.0f}", sha=sha[:8]))
        if now - start >= timeout:
            raise ValueError(t("release_tag.rehearsalTimedOut", minutes=f"{timeout / 60:.0f}", sha=sha[:8]))
        sleep(poll)


def verify(repo: str, sha: str) -> dict:
    if GITLAB:
        GITLAB.require_ancestor(repo, sha)
    else:
        comparison = api(repo, f"compare/master...{sha}")
        if comparison["status"] not in {"identical", "behind"}:
            raise ValueError(t("release_tag.notOnMaster"))
    checked = require_success(test_runs(repo, sha), sha)
    return {"sha": sha, "test": checked["html_url"]}


def _require_clean_master() -> None:
    if command("git", "status", "--porcelain"):
        raise ValueError(t("release_tag.dirty"))
    if command("git", "branch", "--show-current") != "master":
        raise ValueError(t("release_tag.runFromMaster"))


def _require_free_tag(repo: str, tag: str) -> None:
    if GITLAB:
        GITLAB.require_free_tag(repo, tag)
        return
    # matching-refs 返回空列表代表不存在；网络或权限错误不能被当成空列表。
    if any(ref["ref"] == f"refs/tags/{tag}" for ref in api(repo, f"git/matching-refs/tags/{tag}")):
        raise ValueError(t("release_tag.tagExists", tag=tag))


def require_clean_dependencies(root: Path = None) -> None:
    """标签前复核依赖审计：标签流水线第一件事就是同一套 npm 审计，新公布的高危漏洞
    会让已经打出去的标签什么也发不出。在打标签之前先查，有漏洞就不定版、不打标签。"""
    from . import npm_audit
    root = root or ROOT
    failed = [str(project.relative_to(root)) or "." for project in (root, root / "frontend")
              if npm_audit.audit(project) != 0]
    if failed:
        raise ValueError(t("release_tag.auditFailed", projects=list(failed)))


def require_release_notice(root: Path, version: str, part: str) -> None:
    """minor 及以上的版本必须先写好更新公告（`src/peach/release_notices.py`），升级后的弹窗靠它。

    补丁版可以不写：没有公告就不弹，只在设置页留记录。"""
    if part not in ("minor", "major"):
        return
    import ast
    tree = ast.parse((root / "src/peach/release_notices.py").read_text(encoding="utf-8"))
    notices = next(ast.literal_eval(node.value) for node in tree.body
                   if isinstance(node, ast.AnnAssign) and getattr(node.target, "id", "") == "NOTICES")
    if version not in notices:
        raise version_bump.VersionError(
            t("release_tag.noticeMissing", version=version))
    if tuple(int(part) for part in version.split(".")) > tuple(int(part) for part in NOTICE_REVIEW_SINCE.split(".")):
        require_notice_review(root, version, notices[version])


#: 从这一版之后，minor 定版前要有智能体对公告的逐条审阅（`release_notices` 模块说明的规则）。
NOTICE_REVIEW_SINCE = "0.58.0"
#: 审阅记录的位置；`build/` 不进 Git，审阅只对这次定版有效。
NOTICE_REVIEW = Path("build/release-notice-review.json")
#: 每条理由至少写这么多字，挡住只填「是」「合理」的空审阅。
NOTICE_REVIEW_MIN_REASON = 12


def notice_digest(root: Path, version: str, notice: dict) -> str:
    """公告条目与它两种语言的文字合在一起的摘要；审阅之后任何一处改动都让审阅失效。"""
    key = "v" + version.replace(".", "-")
    texts = {}
    for language in ("zh-CN", "en"):
        path = root / "resources/locales" / language / "server.json"
        if path.is_file():
            texts[language] = json.loads(path.read_text(encoding="utf-8")).get("releaseNotes", {}).get(key)
    payload = json.dumps({"notice": notice, "text": texts}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def require_notice_review(root: Path, version: str, notice: dict) -> None:
    """公告要先由智能体逐条审过：每条为什么使用者能明显感知、图标的登记含义为什么贴切，
    以及看过更新日志后其余条目为什么不进公告。记录对不上当前公告就拒绝定版。"""
    digest = notice_digest(root, version, notice)
    path = root / NOTICE_REVIEW
    if not path.is_file():
        raise version_bump.VersionError(t("release_tag.noticeReviewMissing", version=version,
                                          path=NOTICE_REVIEW.as_posix(), digest=digest))
    review = json.loads(path.read_text(encoding="utf-8"))
    if review.get("version") != version or review.get("digest") != digest:
        raise version_bump.VersionError(t("release_tag.noticeReviewStale", version=version, digest=digest))
    ids = [item["id"] for group in ("features", "automatic", "attention") for item in notice.get(group, [])]
    items = review.get("items") or {}

    def reasoned(value) -> bool:
        return isinstance(value, str) and len(value.strip()) >= NOTICE_REVIEW_MIN_REASON

    missing = [item for item in ids if not (isinstance(items.get(item), dict)
                                            and reasoned(items[item].get("perceptible"))
                                            and reasoned(items[item].get("icon")))]
    if not reasoned(review.get("omitted")):
        missing.append("omitted")
    if missing:
        raise version_bump.VersionError(t("release_tag.noticeReviewIncomplete", version=version,
                                          items=t("common.clauseSeparator").join(missing)))


def prepare(repo: str, part: str, *, apply: bool,
            reference_evidence: dict[str, Path] | None = None) -> dict:
    """为下一次发布推进版本号并起草变更日志。

    只写文件，不提交：变更日志的措辞要人过一遍，脚本自己提交等于鼓励不看。
    """
    _require_clean_master()
    planned = version_bump.plan_bump(ROOT, part)
    version = str(planned["version"])
    tag = f"v{version}"
    _require_free_tag(repo, tag)
    if planned["range"] != "HEAD":
        require_readme_links(str(planned["current"]))
    require_release_notice(ROOT, version, str(planned["bump"]))
    result = {**planned, "tag": tag, "repo": repo, "applied": apply}
    if not apply:
        return result
    require_clean_dependencies()
    from .release_review import review
    options = {"public_github": True} if GITLAB else {}
    if reference_evidence:
        options["reference_evidence"] = reference_evidence
    result["upstream_review"] = review(ROOT, repo, **options)
    version_bump.write_version(ROOT, str(planned["bump"]))
    changelog.release(ROOT, version, repo=repo, spec=str(planned["range"]))
    # 那一节原样带在输出里：确认措辞的人不该再去翻文件才知道自己在确认什么。
    result["section"] = changelog.section_of(
        (ROOT / changelog.CHANGELOG).read_text(encoding="utf-8"), version)
    result["next"] = [
        t("release_tag.nextReview", version=version),
        t("release_tag.nextShip"),
    ]
    return result


def _require_master() -> None:
    if command("git", "branch", "--show-current") != "master":
        raise ValueError(t("release_tag.runFromMaster"))


def _pending_files() -> list[str]:
    """工作区里有改动的文件名，按 `git status --porcelain` 的第三列取。"""
    return sorted(line[3:].strip().strip('"')
                  for line in command("git", "status", "--porcelain", strip=False).splitlines()
                  if line.strip())


def _staged_release(repo: str) -> tuple[str, str, list[str]]:
    """定版是否成立：版本号、标签，以及等着提交的文件。

    四道判据一起看：在 master 上、变更日志有这一节、标签本地远端都空着、工作区除了
    那两份定版文件没有别的。最后一条是为了不把顺手改的东西夹进发布提交——发布提交
    是标签指向的那一个，夹带什么就等于发出去什么。
    """
    _require_master()
    version = version_bump.read_version(ROOT)
    tag = "v" + version
    document = (ROOT / changelog.CHANGELOG).read_text(encoding="utf-8")
    if not changelog.has_section(document, version):
        raise ValueError(t("release_tag.sectionMissing", file=changelog.CHANGELOG, version=version))
    changelog.require_labeled_entries(document, version)
    _require_free_tag(repo, tag)
    if command("git", "tag", "--list", tag):
        raise ValueError(t("release_tag.localTagExists", tag=tag))
    pending = _pending_files()
    if pending and pending != sorted(RELEASE_FILES):
        raise ValueError(t("release_tag.extraChanges", files=list(pending)))
    return version, tag, pending


def ship(repo: str, *, apply: bool, timeout: float = TEST_TIMEOUT) -> dict:
    """把定好版的工作区一路送到标签：提交、推送、等 Test 转绿、打标签。

    每一步先看当下的状态再决定做不做，所以中途停下（网络断、CI 还在跑、超时）再跑一次
    就接着走：已提交的不重提，已推送的不重推，Test 没绿绝不打标签。
    """
    version, tag, pending = _staged_release(repo)
    head = command("git", "rev-parse", "HEAD")
    remote = master_sha(repo)
    result = {"version": version, "tag": tag, "repo": repo, "applied": apply,
              "commit": bool(pending), "push": bool(pending) or remote != head}
    if not apply:
        return result
    if pending:
        command("git", "add", *RELEASE_FILES)
        command("git", "-c", f"{MASTER_WRITER}=release", "commit",
                "-m", f"chore(release): 版本 {version}")
    sha = command("git", "rev-parse", "HEAD")
    if master_sha(repo) != sha:
        command("git", "push", remote_url(repo), "refs/heads/master")
    checked = await_test(repo, sha, timeout=timeout)
    require_rehearsal(repo, sha, checked, timeout=timeout)
    require_clean_dependencies()
    command("git", "tag", "-a", tag, sha, "-m", f"Peach {tag} Windows 测试版")
    command("git", "push", remote_url(repo), f"refs/tags/{tag}")
    readme = point_readme(repo, apply=True, timeout=timeout)
    return {**result, "sha": sha, "test": checked["html_url"],
            "release": release_url(repo, tag), "readme": readme["readme"],
            "readme_sha": readme["readme_sha"]}


def release_assets(repo: str, tag: str) -> set[str]:
    """这个标签的 GitHub Release 已上传完的制品名；Release 还没建或仍是草稿时为空。"""
    try:
        release = api(repo, f"releases/tags/{tag}")
    except subprocess.CalledProcessError:
        return set()
    if release.get("draft"):
        return set()
    return {asset["name"] for asset in release.get("assets") or ()
            if asset.get("state") == "uploaded"}


def require_readme_links(version: str, *, revision: str | None = None) -> None:
    problems = version_bump.readme_link_problems(ROOT, version=version, revision=revision)
    if problems:
        detail = t("common.clauseSeparator").join(problems)
        raise ValueError(f"{detail}\n{t('release_tag.nextPointReadme')}")


def point_readme(repo: str, *, apply: bool, timeout: float = TEST_TIMEOUT, poll: float = TEST_POLL,
                 sleep=time.sleep, clock=time.monotonic) -> dict:
    """等这一版 README 直链要下载的制品都上传完，再把直链换过去、提交并推送 master。

    `--ship` 打完标签后接着跑；中途停下就单独跑 `--point-readme --apply`，已换的不重换，
    已提交未推送的只补推送。等待期间 README 仍指向上一版，读者拿到的始终是能下载的链接。
    """
    _require_master()
    version = version_bump.read_version(ROOT)
    tag = "v" + version
    pending = _pending_files()
    if not set(pending) <= set(version_bump.README_FILES):
        raise ValueError(t("release_tag.extraReadmeChanges", files=list(pending)))
    names = version_bump.readme_assets(ROOT, version)
    if not names:
        raise ValueError(t("release_tag.noReadmeLinks"))
    result = {"version": version, "tag": tag, "assets": names, "applied": apply, "readme": []}
    if not apply:
        return result
    start = clock()
    while missing := sorted(set(names) - release_assets(repo, tag)):
        if clock() - start >= timeout:
            raise ValueError(t("release_tag.assetsMissing", minutes=f"{timeout / 60:.0f}", tag=tag,
                               assets=list(missing)))
        sleep(poll)
    changed = version_bump.point_readmes(ROOT, version)
    subject = README_SUBJECT.format(tag=tag)
    if changed or pending:
        command("git", "add", *version_bump.README_FILES)
        command("git", "-c", f"{MASTER_WRITER}=release", "commit", "-m", subject)
    head = command("git", "rev-parse", "HEAD")
    remote = master_sha(repo)
    # HEAD 是这次的 README 提交才推送；中断后 master 上又落了别的提交，就交给集成方推送。
    if command("git", "log", "-1", "--format=%s", head) == subject and remote != head:
        command("git", "push", remote_url(repo), "refs/heads/master")
        remote = master_sha(repo)
    if remote != head:
        command("git", "fetch", "--no-tags", "--no-write-fetch-head", remote_url(repo), remote)
    require_readme_links(version, revision=remote)
    return {**result, "readme": changed, "readme_sha": remote}


def plan(repo: str) -> dict:
    _require_clean_master()
    sha = command("git", "rev-parse", "HEAD")
    if master_sha(repo) != sha:
        raise ValueError(t("release_tag.headMismatch"))
    version = version_bump.read_version(ROOT)
    tag = "v" + version
    document = (ROOT / changelog.CHANGELOG).read_text(encoding="utf-8")
    if not changelog.has_section(document, version):
        raise ValueError(t("release_tag.sectionMissing", file=changelog.CHANGELOG, version=version))
    _require_free_tag(repo, tag)
    if command("git", "tag", "--list", tag):
        raise ValueError(t("release_tag.localTagExists", tag=tag))
    return {**verify(repo, sha), "tag": tag, "repo": repo}


def plan_commit(repo: str, sha: str) -> dict:
    """发布明确选定的主线提交，版本与说明均取自这个提交。"""
    _require_clean_master()
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError(t("release_tag.releaseShaFormat"))
    if command("git", "rev-parse", f"{sha}^{{commit}}") != sha:
        raise ValueError(t("release_tag.releaseShaCommit"))
    text = command("git", "show", f"{sha}:{version_bump.VERSION_FILE}")
    match = version_bump.VERSION_PATTERN.search(text)
    if match is None:
        raise ValueError(t("release_tag.noVersion"))
    version = ".".join(match.group(index) for index in (2, 3, 4))
    document = command("git", "show", f"{sha}:{changelog.CHANGELOG}")
    if not changelog.has_section(document, version):
        raise ValueError(t("release_tag.selectedSectionMissing", file=changelog.CHANGELOG, version=version))
    changelog.require_labeled_entries(document, version)
    tag = f"v{version}"
    _require_free_tag(repo, tag)
    if command("git", "tag", "--list", tag):
        raise ValueError(t("release_tag.localTagExists", tag=tag))
    return {**verify(repo, sha), **require_candidate(repo, sha), "tag": tag, "version": version,
            "repo": repo, "section": changelog.section_of(document, version)}


def require_candidate(repo: str, sha: str) -> dict:
    """补打标签沿用标签工作流的晋级判据，取不到演练产物时不留下无法发布的标签。"""
    if GITLAB:
        return {}
    run = github_release_candidate.select(repo, sha)
    return {"rehearsal": f"https://github.com/{repo}/actions/runs/{run['run_id']}"}


def main(argv=None) -> int:
    global GITLAB
    parser = argparse.ArgumentParser(description=t("release_tag.description"),
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", default="peach-mitao/peach")
    parser.add_argument("--gitlab-host", help=t("release_tag.helpGitlabHost"))
    parser.add_argument("--reference-evidence", action="append", default=[], metavar="SOURCE=FILE",
                        help=t("release_tag.helpReferenceEvidence"))
    parser.add_argument("--apply", action="store_true",
                        help=t("release_tag.helpApply"))
    parser.add_argument("--timeout", type=float, default=TEST_TIMEOUT,
                        help=t("release_tag.helpTimeout", seconds=f"{TEST_TIMEOUT:.0f}"))
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--bump", choices=("auto", "patch", "minor", "major"),
                      help=t("release_tag.helpBump"))
    mode.add_argument("--ship", action="store_true",
                      help=t("release_tag.helpShip"))
    mode.add_argument("--point-readme", action="store_true",
                      help=t("release_tag.helpPointReadme"))
    mode.add_argument("--verify-sha", help=t("release_tag.helpVerifySha"))
    mode.add_argument("--release-sha", help=t("release_tag.helpReleaseSha"))
    args = parser.parse_args(argv)
    try:
        from .release_forge import GitLabForge
        GITLAB = GitLabForge(args.gitlab_host, command) if args.gitlab_host else None
        if args.reference_evidence and not args.bump:
            raise ValueError(t("release_tag.referenceEvidenceBumpOnly"))
        if args.verify_sha:
            print(json.dumps(verify(args.repo, args.verify_sha), ensure_ascii=False, indent=2))
            return 0
        if args.bump:
            from .release_review import local_reference_files
            options = ({"reference_evidence": local_reference_files(args.reference_evidence)}
                       if args.reference_evidence else {})
            print(json.dumps(prepare(args.repo, args.bump, apply=args.apply, **options),
                             ensure_ascii=False, indent=2))
            return 0
        if args.ship:
            print(json.dumps(ship(args.repo, apply=args.apply, timeout=args.timeout),
                             ensure_ascii=False, indent=2))
            return 0
        if args.point_readme:
            print(json.dumps(point_readme(args.repo, apply=args.apply, timeout=args.timeout),
                             ensure_ascii=False, indent=2))
            return 0
        result = (plan_commit(args.repo, args.release_sha)
                  if args.release_sha is not None else plan(args.repo))
        if args.apply:
            # 固定提交在动手前复核归属、CI、版本说明与标签占用。
            if args.release_sha is not None:
                result = plan_commit(args.repo, args.release_sha)
            elif master_sha(args.repo) != result["sha"]:
                raise ValueError(t("release_tag.masterMoved"))
            command("git", "tag", "-a", result["tag"], result["sha"],
                    "-m", f"Peach {result['tag']} Windows 测试版")
            command("git", "push", remote_url(args.repo),
                    f"refs/tags/{result['tag']}")
            result["next"] = t("release_tag.nextPointReadme")
        print(json.dumps({**result, "applied": args.apply}, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, version_bump.VersionError, subprocess.CalledProcessError) as exc:
        detail = exc.stderr if isinstance(exc, subprocess.CalledProcessError) else str(exc)
        print(t("release_tag.checkFailed", detail=detail))
        return 1
    finally:
        GITLAB = None


if __name__ == "__main__":
    raise SystemExit(main())
