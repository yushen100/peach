"""发版前只读检查上游、依赖与参考项目，证据写入 build。"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.request import Request

if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = "scripts"
if str(Path(__file__).resolve().parents[1] / "src") not in sys.path:
    sys.path.insert(1, str(Path(__file__).resolve().parents[1] / "src"))
from peach.interface_text import dev as t

from . import check_reference_updates as references

ROOT = Path(__file__).resolve().parents[1]


def run(args: list[str], root: Path, *, allowed: tuple[int, ...] = (0,)) -> str:
    result = subprocess.run([shutil.which(args[0]) or args[0], *args[1:]], cwd=root,
                            capture_output=True, text=True, encoding="utf-8",
                            errors="replace", timeout=180)
    if result.returncode not in allowed:
        raise RuntimeError(t("release_review.commandFailed", command=' '.join(args),
                               detail=result.stderr.strip() or result.stdout.strip()))
    return result.stdout.strip()


def public_github_api(endpoint: str):
    """公开上游元数据使用匿名官方 API，不携带本机账号凭据。"""
    request = Request(f"https://api.github.com/{endpoint}",
                      headers={"Accept": "application/vnd.github+json", "User-Agent": references.USER_AGENT})
    from peach.peach_proxy import read_url
    return json.loads(read_url(request.full_url, headers=dict(request.header_items()), timeout=60))


def public_dependabot(repo: str) -> list[dict]:
    found = []
    for page in range(1, 11):
        batch = public_github_api(f"repos/{repo}/pulls?state=open&per_page=100&page={page}")
        found.extend({"number": item["number"], "title": item["title"], "url": item["html_url"]}
                     for item in batch if item.get("user", {}).get("login") == "dependabot[bot]")
        if len(batch) < 100:
            return found
    raise ValueError(t("release_review.tooManyPullRequests"))


def local_reference_files(values: list[str]) -> dict[str, Path]:
    """解析本次调用明确提供的参考正文，不改变登记表或快照。"""
    files = {}
    for value in values:
        source, separator, filename = value.partition("=")
        if not separator or not source or not filename or source in files:
            raise ValueError(t("release_review.evidenceFormat"))
        files[source] = Path(filename).resolve(strict=True)
    return files


def collect(root: Path, repo: str, *, public_github: bool = False,
            reference_evidence: dict[str, Path] | None = None) -> dict:
    registry = references.load_registry(root / "docs/reference-sources.json")
    problems = references.validate_registry(root, registry)
    if problems:
        raise ValueError(t("common.clauseSeparator").join(problems))
    evidence = reference_evidence or {}
    sources = references.selected_sources(registry, None)
    if unknown := evidence.keys() - {source["id"] for source in sources}:
        raise ValueError(t("release_review.unknownEvidence", sources=sorted(unknown)))
    report = {"checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
              "commit": run(["git", "rev-parse", "HEAD"], root),
              "checks": [], "complete": True}

    def check(label, action):
        print(t("release_review.checking", label=label), flush=True)
        try:
            report["checks"].append({"id": label, "status": "已取得", "result": action()})
        except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as exc:
            report["complete"] = False
            report["checks"].append({"id": label, "status": "未取得", "error": str(exc)})

    for label, args, allowed in (
        ("python", ["uv", "tree", "--locked", "--all-groups", "--outdated"], (0,)),
        ("amane-python", ["uv", "tree", "--project", "tools/amane-bridge", "--locked",
                          "--outdated"], (0,)),
        ("ocr-python", ["uv", "tree", "--project", "resources/ocr/environment", "--locked",
                        "--outdated"], (0,)),
        ("npm", ["npm", "outdated", "--json"], (0, 1)),
        ("frontend-npm", ["npm", "outdated", "--prefix", "frontend", "--json"], (0, 1)),
        ("dependabot", ["gh", "api", "--paginate", "--slurp",
                        f"repos/{repo}/pulls?state=open&per_page=100"], (0,)),
    ):
        def inspect_dependency(args=args, allowed=allowed, label=label):
            if label == "dependabot" and public_github:
                return public_dependabot(repo)
            output = run(args, root, allowed=allowed)
            if label == "dependabot":
                return [{"number": item["number"], "title": item["title"], "url": item["html_url"]}
                        for page in json.loads(output) for item in page
                        if item.get("user", {}).get("login") == "dependabot[bot]"]
            if label.endswith("npm"):
                payload = json.loads(output or "{}")
                if "error" in payload:
                    raise ValueError(str(payload["error"]))
                return payload
            return output
        check(label, inspect_dependency)

    revisions = {}

    def resolve(source):
        git = source.get("git")
        if not git:
            return None
        key = (git["repository"], git["ref"])
        if key not in revisions:
            revisions[key] = references.resolve_git_revision(source)
        return revisions[key]

    for pin in references.selected_sources(registry, None, key="pins"):
        check(pin["id"], lambda pin=pin: references.inspect_pin(root, pin))
        web = pin["repository"].removesuffix(".git")
        if web.startswith("https://github.com/"):
            upstream = web.removeprefix("https://github.com/")
            check(pin["id"] + "-release", lambda upstream=upstream:
                  public_github_api(f"repos/{upstream}/releases/latest") if public_github else json.loads(run(
                      ["gh", "api", f"repos/{upstream}/releases/latest"], root)))
    for source in sources:
        def inspect(source=source):
            supplied = evidence.get(source["id"])
            if supplied is None:
                result = references.inspect_source(root, source, revision_resolver=resolve)
            else:
                content = supplied.read_bytes()
                if not content.strip():
                    raise ValueError(t("release_review.evidenceEmpty"))
                result = references.inspect_source(root, source, revision_resolver=resolve,
                                                   fetcher=lambda _url: content)
                result["provenance"] = {"channel": "用户手动提供", "url": source["url"],
                                        "direct_fetch": "未取得", "sha256": references.sha256_bytes(content)}
            return {key: value for key, value in result.items() if key != "live"}
        check(source["id"], inspect)
    return report


def review(root: Path, repo: str, *, public_github: bool = False,
           reference_evidence: dict[str, Path] | None = None) -> dict:
    options = {"public_github": True} if public_github else {}
    if reference_evidence:
        options["reference_evidence"] = reference_evidence
    report = collect(root, repo, **options)
    path = root / "build/release-review.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not report["complete"]:
        missing = [item["id"] for item in report["checks"] if item["status"] == "未取得"]
        raise ValueError(t("release_review.incomplete", checks=list(missing), path=path))
    return {"report": str(path), "checks": len(report["checks"]), "complete": True}


def main() -> int:
    parser = argparse.ArgumentParser(description=t("release_review.description"))
    parser.add_argument("--repo", default="peach-mitao/peach")
    parser.add_argument("--public-github", action="store_true",
                        help=t("release_review.helpPublicGithub"))
    parser.add_argument("--reference-evidence", action="append", default=[], metavar="SOURCE=FILE",
                        help=t("release_review.helpReferenceEvidence"))
    args = parser.parse_args()
    try:
        options = {"public_github": True} if args.public_github else {}
        print(json.dumps(review(ROOT, args.repo,
                                reference_evidence=local_reference_files(args.reference_evidence),
                                **options), ensure_ascii=False))
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
