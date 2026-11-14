"""发布通过验收的制品，在 GitGud 与 R2 保存可校验的下载副本。"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import quote, urlencode, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
if not __package__:
    sys.path.insert(0, str(ROOT))
    __package__ = "scripts"
from peach.interface_text import dev as t
from peach.user_agent import USER_AGENT
from peach.peach_proxy import read_url


def verify_local_assets(root: Path, assets: list[dict]) -> None:
    """核对发行清单中的本地文件、大小与 SHA-256。"""
    for asset in assets:
        path = root / asset['name']
        if (not re.fullmatch(r'[A-Za-z0-9_.-]+', asset['name']) or path.is_symlink()
                or not path.is_file() or path.stat().st_size != asset['size']):
            raise ValueError(t("publish_gitlab_release.assetMismatch"))
        with path.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != asset['sha256']:
                raise ValueError(t("publish_gitlab_release.assetDigestMismatch"))


def gitgud_package_links(root: Path, release: dict, project_url: str) -> list[dict]:
    """复用官方 glab 上传；同版本同名文件必须具有相同字节与摘要。"""
    from .release_forge import GitLabForge

    tag = release['tag_name']
    if not re.fullmatch(r'v\d+\.\d+\.\d+', tag):
        raise ValueError(t("publish_gitlab_release.mirrorNeedsTag"))
    project = urlsplit(project_url)
    if project.scheme != 'https' or not project.hostname or project.username or project.password:
        raise ValueError(t("publish_gitlab_release.projectUrlUnsafe"))
    repo = project.path.strip('/')
    executable = os.environ.get('PEACH_GLAB', 'glab')
    forge = GitLabForge(project.netloc, lambda *args: subprocess.check_output(
        args, text=True, encoding='utf-8', stderr=subprocess.PIPE))
    assets = release['assets']
    verify_local_assets(root, assets)

    def package_files() -> list[dict]:
        query = urlencode({'package_type': 'generic', 'package_name': 'peach-release', 'package_version': tag})
        packages = forge.api(repo, 'packages?' + query)
        result = []
        for package in packages:
            if package['name'] != 'peach-release' or package.get('version') != tag:
                continue
            for page in range(1, 11):
                batch = forge.api(repo, f"packages/{package['id']}/package_files?per_page=100&page={page}")
                result.extend(batch)
                if len(batch) < 100:
                    break
            else:
                raise ValueError(t("publish_gitlab_release.tooManyPackageFiles"))
        return result

    def matches(asset: dict, files: list[dict]) -> bool:
        rows = [row for row in files if row['file_name'] == asset['name']]
        if any(row['size'] != asset['size'] or row.get('file_sha256') != asset['sha256'] for row in rows):
            raise ValueError(t("publish_gitlab_release.packageConflict", name=asset['name']))
        return bool(rows)

    existing = package_files()
    for asset in assets:
        if not matches(asset, existing):
            subprocess.run([executable, 'packages', 'upload', str(root / asset['name']),
                            '--repo', project_url, '--name', 'peach-release', '--version', tag], check=True)
    for attempt in range(3):
        current = package_files()
        if all(matches(asset, current) for asset in assets):
            break
        if attempt == 2:
            raise ValueError(t("publish_gitlab_release.packagesNotRegistered"))
        time.sleep(attempt + 1)
    prefix = f"https://{project.netloc}/api/v4/projects/{quote(repo, safe='')}/packages/generic/peach-release/{tag}"
    return [{'name': asset['name'] + ' · GitGud', 'url': prefix + '/' + quote(asset['name']),
             'link_type': 'package', 'direct_asset_path': '/gitgud/' + asset['name']} for asset in assets]


def r2_release_notes(body: str, version: str, base: str, project_url: str) -> str:
    from .package_windows_release import DOWNLOADS_SUMMARY, download_notes
    text = body.split('\n' + DOWNLOADS_SUMMARY, 1)[0].rstrip() + '\n'
    text = text.replace('https://github.com/peach-mitao/peach/blob/master/',
                        f'{project_url.rstrip("/")}/-/blob/v{version}/')
    return text + download_notes(version, lite_installer=True, download_base=f'{base.rstrip("/")}/v{version}')


def publish(root: Path = Path('release')) -> None:
    tag = os.environ["CI_COMMIT_TAG"]
    sha = os.environ["CI_COMMIT_SHA"]
    if not re.fullmatch(r"v\d+\.\d+\.\d+", tag) or not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError(t("publish_gitlab_release.releaseNeedsTagAndSha"))
    actual = subprocess.check_output(["git", "rev-parse", f"refs/tags/{tag}^{{commit}}"],
                                     text=True, encoding="utf-8").strip()
    if actual != sha:
        raise ValueError(t("publish_gitlab_release.tagMismatch"))
    notes = root / 'RELEASE_NOTES.md'
    if not notes.is_file() or not notes.stat().st_size:
        raise ValueError(t("publish_gitlab_release.notesMissing"))
    command = [os.environ.get("PEACH_GLAB", "glab"), "release", "create", tag,
                    "--repo", os.environ["CI_PROJECT_URL"], "--ref", sha,
                    "--name", tag,
                    "--notes-file", str(notes), "--no-close-milestone"]
    backend = os.environ.get("PEACH_DOWNLOAD_BACKEND", "gitgud")
    if backend in {"r2", "both"}:
        subprocess.run([sys.executable, "scripts/release_r2.py", "--root", str(root), "--version", tag[1:], "--apply"], check=True)
        base = os.environ["PEACH_R2_PUBLIC_BASE"].rstrip("/")
        release = json.loads(read_url(f"{base}/{tag}/release.json", headers={"User-Agent": USER_AGENT}, timeout=60))
        if (release["tag_name"] != tag or release.get("commit_sha") != sha or not release["assets"]
                or any(item["state"] != "uploaded" or not item["browser_download_url"].startswith(f"{base}/{tag}/")
                       for item in release["assets"])):
            raise ValueError(t("publish_gitlab_release.r2NotReady"))
        links = [{"name": item["name"], "url": item["browser_download_url"], "link_type": "package",
                  "direct_asset_path": "/" + item["name"]} for item in release["assets"]]
        if backend == 'both':
            from .release_r2 import inventory
            files = inventory(root, tag[1:])
            (root / 'SHA256SUMS.txt').write_text(''.join(
                f"{item['sha256']}  {item['name']}\n" for item in files), encoding='utf-8')
            links.extend(gitgud_package_links(root, release, os.environ['CI_PROJECT_URL']))
        notes.write_text(r2_release_notes(notes.read_text(encoding='utf-8'), tag[1:], base,
                                         os.environ['CI_PROJECT_URL']), encoding='utf-8')
        command.extend(["--assets-links", json.dumps(links)])
    elif backend == "gitgud":
        from .release_r2 import inventory
        files = inventory(root, tag[1:])
        sums = root / 'SHA256SUMS.txt'
        sums.write_text("".join(f"{item['sha256']}  {item['name']}\n" for item in files), encoding="utf-8")
        command.extend([*(str(root / item["name"]) for item in files), str(sums),
                        "--use-package-registry", "--package-name", "peach-release"])
    else:
        raise ValueError(t("publish_gitlab_release.unknownBackend"))
    subprocess.run(command, check=True)


if __name__ == "__main__":
    publish()
