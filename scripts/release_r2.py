"""将通过验收的发行包上传到 R2，并发布可公开校验的下载清单。"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import quote, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from peach import release_signing
from peach.interface_text import dev as t
from peach.user_agent import USER_AGENT
from peach.peach_proxy import http_client

#: 索引里每一版的 `html_url`：版本在 GitHub 发布，镜像只转存同一份制品。
RELEASE_PAGE = "https://github.com/peach-mitao/peach/releases/tag/"
#: 镜像只为更新兜底：留最新几个版本，更老的版本目录在新版登记后删除，GitHub 上的制品仍在。
KEEP = 3


def inventory(root: Path, version: str) -> list[dict]:
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError(t("release_r2.versionFormat"))
    paths = sorted(path for path in root.iterdir() if path.is_file()
                   and path.suffix in {".zip", ".exe", ".dmg"})
    required = {f"Peach-{version}-windows-x64{suffix}" for suffix in (".zip", "-setup.exe", "-lite-setup.exe", "-update.zip")}
    required.update(f"Peach-{version}-macos-{arch}.dmg" for arch in ("arm64", "x86_64"))
    if not required.issubset(path.name for path in paths):
        raise ValueError(t("release_r2.artifactsIncomplete"))
    items = []
    for path in paths:
        if path.is_symlink() or not re.fullmatch(r"[A-Za-z0-9_.-]+", path.name) or not path.stat().st_size:
            raise ValueError(t("release_r2.invalidArtifact", name=path.name))
        with path.open("rb") as source:
            checksum = hashlib.file_digest(source, "sha256").hexdigest()
        items.append({"name": path.name, "size": path.stat().st_size, "sha256": checksum})
    return items


def describe(path: Path) -> dict:
    with path.open("rb") as source:
        return {"name": path.name, "size": path.stat().st_size, "sha256": hashlib.file_digest(source, "sha256").hexdigest()}


def release_sums(root: Path, items: list[dict], scratch: Path) -> list[Path]:
    """随版本上传的摘要文件。GitHub 发布作业生成并签过名的摘要与签名原样转存：`.sig` 签的是
    这份字节（ADR-0137），且必须与制品逐项一致；目录里没有摘要时按制品清单在 `scratch` 生成一份。
    """
    sums = root / release_signing.SUMS
    if not sums.is_file():
        generated = scratch / release_signing.SUMS
        generated.write_text("".join(f"{item['sha256']}  {item['name']}\n" for item in items), encoding="utf-8")
        return [generated]
    if release_signing.parse(sums.read_bytes()) != {item["name"]: item["sha256"] for item in items}:
        raise ValueError(t("release_r2.sumsMismatch"))
    signature = root / release_signing.SIGNATURE
    return [sums, signature] if signature.is_file() else [sums]


def verify_download(url: str, item: dict) -> None:
    checksum = hashlib.sha256()
    size = 0
    with http_client(follow_redirects=True, timeout=120) as client, client.stream("GET", url, headers={"User-Agent": USER_AGENT}) as response:
        if response.status_code != 200:
            raise ValueError(t("release_r2.downloadIncomplete", name=item['name']))
        for chunk in response.iter_bytes(1024 * 1024):
            size += len(chunk)
            checksum.update(chunk)
    if size != item["size"] or checksum.hexdigest() != item["sha256"]:
        raise ValueError(t("release_r2.downloadMismatch", name=item['name']))


def rclone_environment() -> dict:
    environment = os.environ.copy()
    for key in ("PEACH_R2_ACCESS_KEY_ID", "PEACH_R2_SECRET_ACCESS_KEY", "PEACH_R2_ENDPOINT", "PEACH_R2_BUCKET", "PEACH_R2_PUBLIC_BASE"):
        if not environment.get(key):
            raise ValueError(t("release_r2.missingVariable", name=key))
    endpoint = urlsplit(environment["PEACH_R2_ENDPOINT"])
    public = urlsplit(environment["PEACH_R2_PUBLIC_BASE"])
    if endpoint.scheme != "https" or not endpoint.hostname or not endpoint.hostname.endswith(".r2.cloudflarestorage.com"):
        raise ValueError(t("release_r2.endpointNotR2"))
    if public.scheme != "https" or not public.hostname or public.username or public.password:
        raise ValueError(t("release_r2.publicUrlUnsafe"))
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", environment["PEACH_R2_BUCKET"]):
        raise ValueError(t("release_r2.invalidBucket"))
    environment.update({"RCLONE_CONFIG_PEACH_TYPE": "s3", "RCLONE_CONFIG_PEACH_PROVIDER": "Cloudflare",
                        "RCLONE_CONFIG_PEACH_ACCESS_KEY_ID": environment["PEACH_R2_ACCESS_KEY_ID"],
                        "RCLONE_CONFIG_PEACH_SECRET_ACCESS_KEY": environment["PEACH_R2_SECRET_ACCESS_KEY"],
                        "RCLONE_CONFIG_PEACH_ENDPOINT": environment["PEACH_R2_ENDPOINT"],
                        "RCLONE_CONFIG_PEACH_REGION": "auto", "RCLONE_CONFIG_PEACH_NO_CHECK_BUCKET": "true"})
    return environment


def _version(tag: object) -> tuple[int, ...] | None:
    if not isinstance(tag, str) or not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
        return None
    return tuple(map(int, tag[1:].split(".")))


def retention(existing: list[dict], releases: object, tag: str) -> tuple[list[str], list[str]]:
    """本次发布后保留的版本（连同本次按版本号取最新 `KEEP` 个，新版在前）与要删除的版本目录。"""
    if not isinstance(releases, list) or not all(isinstance(item, dict) and _version(item.get("tag_name"))
                                                  for item in releases):
        raise ValueError(t("release_r2.invalidIndex"))
    kept = sorted({*(item["tag_name"] for item in releases), tag}, key=_version, reverse=True)[:KEEP]
    if tag not in kept:
        raise ValueError(t("release_r2.tooOld", tag=tag, keep=KEEP))
    folders = {item["Path"].split("/", 1)[0] for item in existing if "/" in item["Path"]}
    return kept, sorted({name for name in folders if _version(name)} - set(kept), key=_version)


def require_capacity(existing: list[dict], items: list[dict], tag: str, limit: int) -> int:
    """保留已有版本，超出本桶发布预算时拒绝上传。"""
    current = {item["Path"]: item["Size"] for item in existing if not item.get("IsDir")}
    projected = sum(current.values()) + sum(item["size"] for item in items
                                          if f"{tag}/{item['name']}" not in current) + 1_000_000
    if limit <= 0 or projected > limit:
        raise ValueError(t("release_r2.overCapacity", projected=projected, limit=limit))
    return projected


def publish(root: Path, version: str, *, apply: bool = False, notes: str = "") -> dict:
    """`notes` 是 `changelog.py --notes` 的更新说明，写进索引的 `body`，GitHub 取不到时应用照样能读。"""
    items = inventory(root, version)
    result = {"version": version, "files": items, "applied": apply}
    if not apply:
        return result
    environment = rclone_environment()
    published_at = environment.get("CI_COMMIT_TIMESTAMP")
    if not published_at:
        raise ValueError(t("release_r2.timestampRequired"))
    sha = environment.get("CI_COMMIT_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError(t("release_r2.commitShaRequired"))
    executable = environment.get("PEACH_RCLONE") or shutil.which("rclone")
    if not executable:
        raise ValueError(t("release_r2.rcloneRequired"))
    tag = "v" + version
    prefix = f"peach:{environment['PEACH_R2_BUCKET']}/{tag}"
    base = environment["PEACH_R2_PUBLIC_BASE"].rstrip("/")

    def upload(path: Path, target: str, *, immutable: bool = True) -> None:
        command = [executable, "copyto", str(path), target, "--checksum", "--config", str(configuration),
                   "--header-upload", "Cache-Control: public, max-age=" + ("31536000, immutable" if immutable else "60")]
        if immutable:
            command.append("--immutable")
        subprocess.run(command, env=environment, check=True)

    with tempfile.TemporaryDirectory(prefix="peach-release-publish-") as directory:
        temporary = Path(directory)
        configuration = temporary / "rclone.conf"
        configuration.touch()
        listing = subprocess.check_output([executable, "lsjson", f"peach:{environment['PEACH_R2_BUCKET']}",
                                           "--recursive", "--files-only", "--config", str(configuration)],
                                          env=environment, text=True, encoding="utf-8")
        existing = json.loads(listing)
        releases = []
        if any(item["Path"] == "releases.json" for item in existing):
            releases = json.loads(subprocess.check_output(
                [executable, "cat", f"peach:{environment['PEACH_R2_BUCKET']}/releases.json",
                 "--config", str(configuration)], env=environment, text=True, encoding="utf-8"))
        kept, stale = retention(existing, releases, tag)
        result["projected_bucket_bytes"] = require_capacity(
            [item for item in existing if item["Path"].split("/", 1)[0] not in stale], items, tag,
            int(environment.get("PEACH_R2_MAX_BYTES", "8000000000")))
        manifests = release_sums(root, items, temporary)
        sources = {item["name"]: root / item["name"] for item in items}
        sources.update((path.name, path) for path in manifests)
        assets = [*items, *(describe(path) for path in manifests)]
        for item in assets:
            upload(sources[item["name"]], f"{prefix}/{item['name']}")
            item["browser_download_url"] = f"{base}/{tag}/{quote(item['name'])}"
            verify_download(item["browser_download_url"], item)
            item["state"] = "uploaded"
            item["digest"] = "sha256:" + item["sha256"]
        release = {"tag_name": tag, "commit_sha": sha, "name": f"Peach {version}", "draft": False, "prerelease": True,
                   "html_url": RELEASE_PAGE + tag, "published_at": published_at, "assets": assets,
                   **({"body": notes} if notes else {})}
        release_file = temporary / "release.json"
        release_file.write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        upload(release_file, f"{prefix}/release.json")
        rows = {item["tag_name"]: item for item in releases if item["tag_name"] in kept}
        rows[tag] = release
        index = temporary / "releases.json"
        index.write_text(json.dumps([rows[name] for name in kept if name in rows], ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")
        upload(index, f"peach:{environment['PEACH_R2_BUCKET']}/releases.json", immutable=False)
        verify_download(f"{base}/releases.json?release={tag}", describe(index))
        # 索引已不再指向这些版本，才删它们的目录；GitHub Release 上的同版本制品不受影响。
        for name in stale:
            subprocess.run([executable, "purge", f"peach:{environment['PEACH_R2_BUCKET']}/{name}",
                            "--config", str(configuration)], env=environment, check=True)
        result["pruned"] = stale
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=t("release_r2.description"))
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--notes", type=Path)
    args = parser.parse_args(argv)
    try:
        notes = args.notes.read_text(encoding="utf-8") if args.notes else ""
        result = publish(args.root.resolve(), args.version, apply=args.apply, notes=notes)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(t("release_r2.failed", error=error))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
