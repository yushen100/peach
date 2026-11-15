"""公开测试版查询；传输复用共享 HTTPX，发行包支持 R2 与 GitHub。"""
from __future__ import annotations

import json
import platform
import re
import sys

import httpx

from . import __version__, distribution, docker_update
from .http import HttpRequest, HttpxTransport
from .update_packages import TOOL_PATHS
from . import interface_text, release_words
from .user_messages import UserValueError, message_fields

RELEASES_URL = "https://github.com/peach-mitao/peach/releases"
API_URL = "https://api.github.com/repos/peach-mitao/peach/releases?per_page=100"
DOWNLOADS_BASE = "https://downloads.peach.video"
DOWNLOADS_API = DOWNLOADS_BASE + "/releases.json"
#: 检查结果的形状；改了就让缓存的旧结果作废、后台按新规则重查一次。v2 起带更新说明 `notes`，
#: v3 起 `notes` 只有每版的重点。
LISTING_RULE = 'source-aware-v3'
#: 有新版本时最多列出几版的更新说明，更早的看 Release 页。
NOTES_LIMIT = 10
#: Release 正文里中文那一段的折叠块，标题与 `scripts/changelog.py` 的 `CHINESE_SUMMARY` 相同。
CHINESE_FOLD = re.compile(rf"<details>\s*<summary>{re.escape(release_words.CHINESE_SUMMARY)}</summary>"
                          r"(?P<body>.*?)</details>", re.S)
#: 下载段的折叠块（英文、中文各一个），不算更新说明；先于中文段去掉，中文段里就不再有嵌套。
DOWNLOADS_FOLD = re.compile(rf"<details>\s*<summary>(?:{'|'.join(map(re.escape, release_words.DOWNLOAD_SUMMARIES))})"
                            r"[^<]*</summary>.*?</details>", re.S)
#: 安装方式与更新通道：响应带 `installation_code`、`channel_code`，前端按它取译文和判断；
#: 同层的名字按 zh-CN 渲染（`server:release.installation.<id>`、`server:release.channel.<id>`）。
INSTALLATIONS = ("docker", "standalone", "source")
CHANNELS = ("test",)
#: 检查结果的一句话，`message_code` 是 `release.message.<键>`。
MESSAGES = ("unchecked", "empty", "error", "staleListing", "available", "ahead", "current", "imagePending",
            "imageAvailable")


def _message(key: str, **params) -> dict:
    return message_fields(f"release.message.{key}", params)


def download_sources(url: str) -> tuple[str, ...]:
    """发行包保留同版本、同文件名的另一公开源；校验沿用原发布摘要。"""
    github = RELEASES_URL + "/download/"
    mirror = DOWNLOADS_BASE + "/"
    for primary, backup in ((github, mirror), (mirror, github)):
        if url.startswith(primary):
            return url, backup + url.removeprefix(primary)
    return (url,)


#: 容器换新版在宿主机上做：拉镜像、重建容器，`/data` 卷保留。每步一个 id、一句说明加一条命令，
#: 命令按仓库的 compose.yaml 写（镜像标签取 `.env` 的 `PEACH_VERSION`，缺省是 `edge`）。
#: 说明在 `server:release.dockerStep.<id>`。
DOCKER_STEPS = (("pull", "docker compose pull"), ("recreate", "docker compose up -d"))


def snapshot() -> dict:
    docker = distribution.docker()
    installation = "docker" if docker else "standalone" if distribution.standalone() else "source"
    return {"current_version": __version__, "latest_version": None,
            "channel": interface_text.text("server:release.channel.test"), "channel_code": "test",
            "installation": interface_text.text(f"server:release.installation.{installation}"),
            "installation_code": installation,
            "in_app_update": distribution.in_app_update(),
            "steps": [{"id": step, "text": interface_text.text(f"server:release.dockerStep.{step}"), "command": command}
                      for step, command in DOCKER_STEPS]
            if docker else [],
            "state": "unchecked", **_message("unchecked"), "release_url": RELEASES_URL}


def _version(value: object) -> tuple[int, ...] | None:
    if not isinstance(value, str) or not re.fullmatch(r"v?\d+\.\d+\.\d+", value):
        return None
    return tuple(map(int, value.removeprefix("v").split(".")))


def _release_candidates(rows: list, endpoint: str, system: str = "win32", machine: str = "") -> list[tuple]:
    """从一个公开发行源选择本机平台的完整包，并构造受信任的下载地址。

    macOS 选与本机架构同名的 DMG（`build_macos_standalone.py` 按 `platform.machine()` 命名），
    没有分包与工具包；其余平台沿用 Windows 包判断有无新版本。
    """
    releases = []
    for row in rows:
        if not isinstance(row, dict) or row.get("draft"):
            continue
        version = _version(row.get("tag_name"))
        if version is None:
            continue
        tag = row["tag_name"]
        assets = row.get("assets") or []
        uploaded = {a.get("name"): a for a in assets if isinstance(a, dict) and a.get("state") == "uploaded"}
        if system == "darwin":
            full = asset = uploaded.get(f"Peach-{tag.removeprefix('v')}-macos-{machine}.dmg")
            if full is None:
                continue
        else:
            prefix = f"Peach-{tag.removeprefix('v')}-windows-x64"
            full = uploaded.get(prefix + ".zip")
            if full is None:
                continue
            complete_tools = all(prefix + f"-tools-{tool}.zip" in uploaded for tool in TOOL_PATHS)
            asset = uploaded.get(prefix + "-update.zip", full) if complete_tools else full
        if endpoint == DOWNLOADS_API:
            if not all(re.fullmatch(r"sha256:[0-9a-f]{64}", item.get("digest") or "") for item in (asset, full)):
                continue
            directory = f"{DOWNLOADS_BASE}/{tag}"
        else:
            directory = f"{RELEASES_URL}/download/{tag}"
        release_url = f"{RELEASES_URL}/tag/{tag}"
        releases.append((version, tag, asset, full, directory, release_url))
    return releases


def _highlights(text: str, heading: str) -> list[dict]:
    """一种语言里重点分组的条目：`- **标题**: 说明 (#1).` 拆成标题与说明。链接只留显示的文字，
    编号与反引号留给前端显示成链接与代码。"""
    items, inside = [], False
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("### "):
            inside = line[4:].strip() == heading
        elif inside and line.startswith("- "):
            line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line[2:])
            found = re.match(r"^\*\*(?P<title>[^*]+)\*\*\s*[:：]\s*(?P<text>.+)$", line)
            items.append({"title": found["title"], "text": found["text"]} if found else {"title": "", "text": line})
    return items


def changelog_notes(body: object) -> dict | None:
    """Release 正文里这一版的重点，英文与中文各一份（格式见 `scripts/changelog.py`）。

    英文是正文，中文在「简体中文」折叠段里；重点分组之外的完整变更不显示，去 Release 页看。
    没有重点分组的版本（只有修复，或 0.59.0 之前的旧正文）返回 None。
    """
    if not isinstance(body, str) or not body.strip():
        return None
    body = DOWNLOADS_FOLD.sub("", body.replace("\r\n", "\n"))
    folded = CHINESE_FOLD.search(body)
    english = CHINESE_FOLD.sub("", body) if folded else body
    notes = {"en": _highlights(english, release_words.HIGHLIGHTS[0]),
             "zh-CN": _highlights(folded["body"] if folded else "", release_words.HIGHLIGHTS[1])}
    return notes if any(notes.values()) else None


def _release_notes(rows: list, current: tuple[int, ...], latest: tuple[int, ...]) -> list[dict]:
    """本机版本之后、最新版本及之前每一版的更新说明，新的在前，最多 `NOTES_LIMIT` 版。"""
    found = {}
    for row in rows:
        if not isinstance(row, dict) or row.get("draft"):
            continue
        version = _version(row.get("tag_name"))
        if version is None or not current < version <= latest or version in found:
            continue
        notes = changelog_notes(row.get("body"))
        if notes:
            found[version] = {"version": row["tag_name"].removeprefix("v"),
                              "url": f"{RELEASES_URL}/tag/{row['tag_name']}", **notes}
    return [found[version] for version in sorted(found, reverse=True)[:NOTES_LIMIT]]


def _listings(client):
    """两个公开发行源的发布列表，取不到的源跳过：逐个给出 `(endpoint, rows)`。"""
    for endpoint in (API_URL, DOWNLOADS_API):
        try:
            headers = {"Accept": "application/json"}
            if endpoint == API_URL:
                headers.update(Accept="application/vnd.github+json", **{"X-GitHub-Api-Version": "2022-11-28"})
            response = client(HttpRequest("GET", endpoint, headers), 12.0, 2_000_000)
            if response.status != 200:
                continue
            rows = json.loads(response.body)
        except (OSError, ValueError, TypeError, TimeoutError, httpx.HTTPError):
            continue
        if isinstance(rows, list):
            yield endpoint, rows


def tool_package(tool: str, *, transport=None) -> dict:
    """最新公开版本里的 Windows 工具包 `Peach-<版本>-windows-x64-tools-<tool>.zip`。

    源码运行的版本号不一定有同名发布（主线可能已在下一版），所以不按本机版本拼地址，
    取两个源里最新的那份；工具包与程序版本无关，包内 `manifest.json` 自带工具版本。
    返回 `url`、`size`、`digest`（`sha256:` 前缀）与 `version`；两个源都没有时抛 ValueError。
    """
    client = transport or HttpxTransport()
    try:
        found = []
        for endpoint, rows in _listings(client):
            for row in rows:
                version = _version(row.get("tag_name")) if isinstance(row, dict) and not row.get("draft") else None
                if version is None:
                    continue
                tag = row["tag_name"]
                name = f"Peach-{tag.removeprefix('v')}-windows-x64-tools-{tool}.zip"
                asset = next((a for a in row.get("assets") or [] if isinstance(a, dict)
                              and a.get("name") == name and a.get("state") == "uploaded"), None)
                if (asset is None or not re.fullmatch(r"sha256:[0-9a-f]{64}", asset.get("digest") or "")
                        or not isinstance(asset.get("size"), int)):
                    continue
                directory = f"{DOWNLOADS_BASE}/{tag}" if endpoint == DOWNLOADS_API else f"{RELEASES_URL}/download/{tag}"
                found.append((version, {"url": f"{directory}/{name}", "size": asset["size"],
                                        "digest": asset["digest"], "version": tag.removeprefix("v")}))
        if not found:
            raise UserValueError("errors.releaseUpdates.toolPackageNotFound")
        return max(found, key=lambda item: item[0])[1]
    finally:
        if transport is None:
            client.close()


def check(*, transport=None, system: str | None = None, machine: str | None = None) -> dict:
    result = snapshot()
    system = system or sys.platform
    machine = machine or platform.machine()
    client = transport or HttpxTransport()
    try:
        releases = []
        github_releases = []
        listed = []
        obtained = False
        for endpoint, rows in _listings(client):
            obtained = True
            listed.extend(rows)
            try:
                candidates = _release_candidates(rows, endpoint, system, machine)
                releases.extend(candidates)
                if endpoint == API_URL:
                    github_releases = candidates
            except (ValueError, TypeError):
                continue
        if not releases:
            return dict(result, state="empty" if obtained else "error", **_message("empty" if obtained else "error"))
        version, tag, asset, full, directory, release_url = max(releases, key=lambda item: item[0])
        current = _version(result["current_version"])
        if current is None:
            raise ValueError("current version required")
        if version <= current and not github_releases:
            return dict(result, state="error", **_message("staleListing"))
        state = "available" if version > current else "ahead" if version < current else "current"
        message = _message(state)
        if state == "available":
            result["notes"] = _release_notes(listed, current, version)
        if distribution.docker():
            # 版本号跟着 Windows 包判；镜像在 Release 之后才推送，空窗里拉到的还是旧镜像，
            # 所以以 Docker Hub 上版本号标签与 edge 指向同一镜像为准（ADR-0140）。
            latest = tag.removeprefix("v")
            if state == "available" and not docker_update.published(client, latest):
                state, message = "pending", _message("imagePending", version=latest)
            extra = {"one_click": docker_update.status()} if state == "available" else {}
            return dict(result, latest_version=latest, state=state, release_url=release_url, **extra,
                        **(_message("imageAvailable") if state == "available" else message))
        return dict(result, latest_version=tag.removeprefix("v"), state=state, **message,
                    asset_url=f"{directory}/{asset['name']}",
                    asset_size=asset.get("size", 0), asset_digest=asset.get("digest"),
                    package_kind="installer" if system == "darwin" else "update" if asset is not full else "full",
                    # 应用更新包准备不下去（清单或工具包与本版更新器对不上）时改下的同版本完整包。
                    full_url=f"{directory}/{full['name']}", full_size=full.get("size", 0),
                    full_digest=full.get("digest"),
                    release_url=release_url)
    except (OSError, ValueError, TypeError, TimeoutError, httpx.HTTPError):
        return dict(result, state="error", **_message("error"))
    finally:
        if transport is None:
            client.close()
