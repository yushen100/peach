"""amane 刮削站点的 Peach 侧接入：起桥子进程、读一行 JSON、把结果翻成 Peach 候选（ADR-0043）。

桥本体在 `tools/amane-bridge/bridge.py`，运行环境由同目录的 `pyproject.toml` / `uv.lock`
钉死。桌面与 Docker 使用随包独立运行环境；源码与 wheel 在数据目录的工具区自动准备 venv。
本模块准备并启动桥子进程，把 amane 的 `MediaMetadata` 套进 `peach.sources` 契约的
`SiteRecord`，再投影成 `extract_peach_fields` 认得的 payload；把 amane 的 `FailureReason` 一对一映到
契约的 `FailureReason`，由它翻成 `MetadataProviderError` 现有的 `auth` / `unavailable` / `not_found`
三档，上游原样的 reason 留在 `detail` 里给冷却与快照回溯用。链上 `LibraryMetadataProvider` 拿到的
形状因此与自写站一致。

已复核 v0.28.0 的 freejavbt 身份校验与 makers 海报推导，字段、失败分档与总时限契约相同。
完整复核见 `docs/reference-snapshots/upstream-review.md`。

聚合不在这里：一站一份 payload 交给 `metadata_policy` / ADR-0038 的结算，不复制 amane 的
`aggregate`。升级也不在这里：钉的 sha 只在 `pyproject.toml` 一处，本模块读它，不另存一份。
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping, Sequence

from filelock import FileLock, Timeout

from . import interface_text
from .coded_text import Said, coded
from .metadata import MetadataProviderError, identifies_code, relay_args, relayed, validate_provider_code
from .sources.base import (COOLDOWN_ACTIONS, REASON_KINDS, FailureReason, SiteConfig, SiteRecord,
                           SourceFailure)
from .user_agent import USER_AGENT
from .settings_file import PROJECT_ROOT
from .task_control import run as run_task_process
from .user_messages import message_fields

AMANE_REPOSITORY = "https://github.com/sqzw-x/amane"
AMANE_LICENSE = "GPL-3.0"
#: 桥的源码目录：清单、锁与脚本位于此处，随包独立运行环境另附固定版本对应源码归档。
BRIDGE_ROOT = PROJECT_ROOT / "tools" / "amane-bridge"
BRIDGE_SCRIPT = BRIDGE_ROOT / "bridge.py"
#: 源码部署的桥 venv 位于数据目录的工具区，名字与源码目录一致。
BRIDGE_TOOL_NAME = "amane-bridge"
#: 一次子进程的总时限。单请求 30 秒，普通失败最多重试一次；403/406 可额外轮换三次指纹，
#: 搜索与详情共用这 60 秒，超时终止子进程并报可重试失败。
DEFAULT_TIMEOUT = 60

#: 经桥开放给 Peach 来源链的站，套 `peach.sources` 同一份配置形状。每个站只有一个归属（ADR-0048）：
#: 自写解析器已经答的站（r18dev、fc2、javbus、javdb）不经桥再问一遍，两条路径答同一站，分歧没人会去看。
#: 主域与 Cookie 由 amane 自己管，Peach 不持有，所以 `base_url` 与 `domains` 留空。档位两种：
#: 转载与索引站是 `amane`；片商官网与发行方自营店是 `official`，与 `SOURCE_SPECS` 里的分级同值，
#: 链上排在官方镜像 r18.dev 之前（`metadata_routes.AMANE_OFFICIAL_STAGE`）。
COMMUNITY_SITES = (("fc2club", "FC2Club"), ("freejavbt", "FreeJavBT"), ("airav", "AIRAV"), ("avsox", "AVSOX"))
#: `makers` 是 amane 的 `official`：按系列前缀路由到二十九家片商官网（S1、MOODYZ、IDEA POCKET……），
#: 前缀不在它的表里就不发请求。另外三家片商各有自己的解析器；MGStage 是 MGS 素人系的发行渠道。
OFFICIAL_SITES = (("makers", Said("labels.scrapingAccess.makers")), ("prestige", "Prestige"), ("faleno", "FALENO"),
                  ("dahlia", "DAHLIA"), ("mgstage", "MGStage"))
SITE_CONFIGS: dict[str, SiteConfig] = {
    name: SiteConfig(name=name, label=label, provider="amane-" + name, base_url="", domains=(), stage=stage)
    for sites, stage in ((COMMUNITY_SITES, "amane"), (OFFICIAL_SITES, "official"))
    for name, label in sites
}
#: 站名 → 界面上的名字，设置页那张卡与来源链按它取。
SITES: dict[str, str] = {name: config.label for name, config in SITE_CONFIGS.items()}
#: 这几站给的 `release` 不是发行日。Prestige 的作品 API 回的是 `mgsStartAt`（MGS 配信开始日），
#: 2026-09-23 实测比发行日早一个月：ABW-032 回 2020-11-11、ABF-246 回 2025-06-18，r18.dev 与账本
#: 都是 2020-12-11、2025-07-18。它不当 `release_date` 候选，只记在 `extra['delivery_date']`，发行日留给链上下一档。
DELIVERY_DATE_SITES = frozenset({"prestige"})

#: amane 的 `FailureReason`（桥脚本 `FAILURE_REASONS`）→ 契约的 `FailureReason`，一对一。
#: 三档分类、冷却动作与可否重试都由契约那张表定（`sources.base.REASON_KINDS` 等），这里只做名字翻译：
#: `cloudflare_blocked`（无挑战的 Ray ID 拦截页）与 `ip_banned` 同属出口被封，上游先认挑战页标记，带 Ray ID
#: 的挑战页报 `cloudflare_challenge`，两档冷却同为 `blocked`；`age_verification` 是要 Cookie 的门；
#: `http_error`、`empty_response`、`crawler_unavailable` 都是「桥那一侧这次没答上」，归服务端错误；
#: `unexpected` 归连接层，与它一样可重试。`http_error` 带 401/403 另算，见 `contract_reason`。
AMANE_REASONS: dict[str, FailureReason] = {
    "not_found": FailureReason.NOT_FOUND,
    "no_usable_metadata": FailureReason.NO_USABLE_METADATA,
    "rate_limited": FailureReason.RATE_LIMITED,
    "server_error": FailureReason.SERVER_ERROR,
    "timeout": FailureReason.TIMEOUT,
    "network": FailureReason.NETWORK,
    "http_error": FailureReason.SERVER_ERROR,
    "api_error": FailureReason.SERVER_ERROR,
    "empty_response": FailureReason.SERVER_ERROR,
    "unexpected": FailureReason.NETWORK,
    "crawler_unavailable": FailureReason.SERVER_ERROR,
    "parse_error": FailureReason.PARSE_ERROR,
    "cloudflare_challenge": FailureReason.CLOUDFLARE_CHALLENGE,
    "cloudflare_blocked": FailureReason.IP_BANNED,
    "ip_banned": FailureReason.IP_BANNED,
    "geo_restricted": FailureReason.GEO_RESTRICTED,
    "age_verification": FailureReason.AUTH_REQUIRED,
    "login_required": FailureReason.AUTH_REQUIRED,
}
#: `auth` 一档的措辞（code），按上游 reason 写。
AUTH_MESSAGES: dict[str, str] = {
    "age_verification": "labels.metadataAmane.auth.ageVerification",
    "login_required": "labels.metadataAmane.auth.loginRequired",
    "geo_restricted": "labels.metadataAmane.auth.geoRestricted",
    "cloudflare_challenge": "labels.metadataAmane.auth.cloudflareChallenge",
    "cloudflare_blocked": "labels.metadataAmane.auth.cloudflareBlocked",
    "ip_banned": "labels.metadataAmane.auth.ipBanned",
    "http_error": "labels.metadataAmane.auth.httpError",
}

Runner = Callable[..., subprocess.CompletedProcess[str]]


def contract_reason(reason: str, status: int = 0) -> FailureReason:
    """上游 reason 与状态码 → 契约细档。

    amane 只按正文认地区限制（「not available in your region」）；正文认不出、只回一个 401/403 的站，
    上游归 `http_error`。Prestige 在非日本出口上就是这样：CloudFront 回 403，正文里没有那句话。
    这种回答是「站方把这个出口挡在门外」，按 `auth_required` 记，不当成「这次没答上」去重试，
    也不当成「站上没有」冻进记忆。
    """
    if reason == "http_error" and status in (401, 403):
        return FailureReason.AUTH_REQUIRED
    return AMANE_REASONS.get(reason, FailureReason.NETWORK)


def pinned_revision(root: Path = BRIDGE_ROOT) -> str:
    """清单里钉的 amane sha。只认 40 位十六进制，短 sha 或分支名一律不算钉死。"""
    manifest = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    for requirement in manifest["project"]["dependencies"]:
        matched = re.fullmatch(r"amane\s*@\s*git\+\S+@([0-9a-f]{40})", requirement.strip())
        if matched:
            return matched.group(1)
    raise ValueError("amane bridge manifest doesn't pin an amane revision")


def locked_version(root: Path = BRIDGE_ROOT) -> str:
    """锁文件里 amane 那一条的版本号，只用于显示；锁不在就空串。"""
    try:
        lock = tomllib.loads((root / "uv.lock").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    for package in lock.get("package", []):
        if package.get("name") == "amane":
            return str(package.get("version") or "")
    return ""


def bridge_home(tools_root: Path) -> Path:
    return Path(tools_root) / BRIDGE_TOOL_NAME


def lock_fingerprint(root: Path = BRIDGE_ROOT) -> str:
    """独立运行环境所需的完整依赖锁标识。"""
    return hashlib.sha256((root / "uv.lock").read_bytes()).hexdigest()


def bridge_python(tools_root: Path) -> Path:
    home = bridge_home(tools_root) / ".venv"
    return home / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


class PreparationError(MetadataProviderError):
    """采集工具未就绪，保留任务范围供安装成功后重试。"""

    asset_ids: tuple[int, ...] = ()


class BridgeMissing(PreparationError):
    """没有可启动的桥解释器或随包运行环境。"""


def packaged_runtime(*, root: Path | None = None) -> tuple[Path, str] | None:
    """定位与桥清单版本、revision 一致的随包运行环境。"""
    bridge = root if root is not None else BRIDGE_ROOT
    runtime = Path(os.environ.get("PEACH_AMANE_RUNTIME") or bridge.parent / "amane-runtime")
    try:
        data = json.loads((runtime / "manifest.json").read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("executable"), str):
            return None
        relative = Path(data["executable"])
        if (data.get("revision") != pinned_revision(bridge) or data.get("version") != locked_version(bridge)
                or data.get("kind") not in {"python", "executable"}
                or relative.is_absolute() or relative.drive or ".." in relative.parts):
            return None
        program = runtime / relative
        # Python venv 可以使用系统解释器软链，独立可执行文件须完全位于随包目录内。
        boundary = program.parent.resolve() if data["kind"] == "python" else program.resolve()
        if boundary.is_relative_to(runtime.resolve()) and program.is_file():
            return program, data["kind"]
    except (OSError, ValueError, TypeError, KeyError):
        pass
    return None


def _ready(tools_root: Path, *, root: Path | None = None) -> bool:
    root = root or BRIDGE_ROOT
    if packaged_runtime(root=root):
        return True
    if _requires_packaged_runtime():
        return False
    if not bridge_python(tools_root).is_file() or installed_version(tools_root) != locked_version(root):
        return False
    try:
        data = json.loads((bridge_home(tools_root) / "installed.json").read_text(encoding="utf-8"))
        return (data.get("revision") == pinned_revision(root)
                and data.get("lock_sha256") == lock_fingerprint(root))
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return False


def _requires_packaged_runtime() -> bool:
    return bool(getattr(sys, "frozen", False)) or os.environ.get("PEACH_DISTRIBUTION") == "docker"


def find_uv() -> Path | None:
    """建 venv 用的 uv。托盘进程的 PATH 未必带 WinGet 的 Links 目录，所以多看一眼那里。"""
    explicit = os.environ.get("PEACH_UV", "").strip()
    candidates = [Path(explicit)] if explicit else []
    on_path = shutil.which("uv")
    if on_path:
        candidates.append(Path(on_path))
    local = os.environ.get("LOCALAPPDATA", "")
    if local:
        candidates.append(Path(local) / "Microsoft" / "WinGet" / "Links" / "uv.exe")
    return next((path for path in candidates if path.is_file()), None)


def rebuild_command(tools_root: Path, *, uv: Path, root: Path = BRIDGE_ROOT,
                    proxy_options: Mapping[str, object] | None = None) -> tuple[list[str], dict]:
    """按锁重建桥 venv 的命令与环境。`--locked` 让锁和清单不一致时直接失败，不悄悄改锁。"""
    command = [str(uv), "sync", "--locked", "--no-dev", "--python", "3.14",
               "--project", str(root)]
    env = {**os.environ, "UV_PROJECT_ENVIRONMENT": str(bridge_home(tools_root) / ".venv")}
    if proxy_options is None:
        from . import peach_proxy
        proxy_options = peach_proxy.client_options()
    if not proxy_options.get("trust_env", True):
        for key in list(env):
            if key.upper().endswith("_PROXY"):
                env.pop(key)
        address = str(proxy_options.get("proxy") or "")
        if address:
            env.update(HTTP_PROXY=address, HTTPS_PROXY=address, ALL_PROXY=address)
        # Git 配置可以覆盖环境代理；只给本次子进程增加一项，不改用户配置文件。
        count = int(env.get("GIT_CONFIG_COUNT", "0"))
        env.update({"GIT_CONFIG_COUNT": str(count + 1), f"GIT_CONFIG_KEY_{count}": "http.proxy",
                    f"GIT_CONFIG_VALUE_{count}": address})
    return command, env


def _bundle_problem(root: Path) -> tuple[str, dict] | None:
    """桥的清单与脚本读不全时的原因（code 与参数）；齐全返回 `None`。"""
    missing = [path for path in (root / "pyproject.toml", root / "bridge.py") if not path.is_file()]
    if missing:
        return "errors.metadataAmane.bundleFileMissing", {"path": str(missing[0])}
    try:
        pinned_revision(root)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return "errors.metadataAmane.manifestUnreadable", {"error": str(exc)}
    if _requires_packaged_runtime() and not packaged_runtime(root=root):
        return "errors.metadataAmane.packagedRuntimeProblem", {}
    return None


def bundle_problem(root: Path = BRIDGE_ROOT) -> str:
    """桥的清单与脚本读不全时给人看的原因；齐全返回空串。

    打包产物漏带 `tools/amane-bridge` 时三个文件都不在，设置页那张卡和重建都靠这句话说明，
    不把 `FileNotFoundError` 抛成读接口的 500。
    """
    problem = _bundle_problem(root)
    return interface_text.text(f"server:{problem[0]}", problem[1]) if problem else ""


def _said(key: str, code: str, params: dict | None = None) -> dict:
    """回执里的一句：`<key>` 是 zh-CN 原句，`<key>_code`、`<key>_params` 给界面取当前语言。"""
    values = dict(params or {})
    return {key: interface_text.text(f"server:{code}", values), f"{key}_code": code, f"{key}_params": values}


def _failed(code: str, params: dict | None = None) -> dict:
    """重建没成的回执：`error` 是 zh-CN 原句，`message_code` 与 `message_params` 给页面与 `prepare`。"""
    return {"ok": False, **message_fields(code, params, key="error")}


def rebuild(tools_root: Path, *, runner: Runner = run_task_process, timeout: int = 900,
            root: Path = BRIDGE_ROOT, proxy_options: Mapping[str, object] | None = None,
            force: bool = True) -> dict:
    """重建桥 venv，返回给设置页的回执。首次要下载约 98 MB，之后只校验。"""
    from .task_resources import unobserved_network
    unobserved_network(Said('labels.metadataAmane.trafficUnmetered'))
    if packaged_runtime(root=root):
        return {"ok": True, **_said("result", "labels.metadataAmane.bundled"),
                **describe(tools_root, root=root)}
    home = bridge_home(tools_root)
    try:
        home.mkdir(parents=True, exist_ok=True)
        with FileLock(str(home / "install.lock"), timeout=timeout):
            if not force and _ready(tools_root, root=root):
                return {"ok": True, **_said("result", "labels.metadataAmane.ready"), **describe(tools_root, root=root)}
            return _rebuild(tools_root, runner=runner, timeout=timeout, root=root,
                            proxy_options=proxy_options)
    except Timeout:
        return _failed("errors.metadataAmane.preparing")
    except OSError as error:
        from .error_reporting import redact
        return _failed("errors.metadataAmane.installDirUnwritable", {"error": redact(str(error))})


def _uv_failure(output: str, limit: int = 800) -> str:
    """uv 报错的首行说哪一步失败，末尾是 git 或构建的原始输出。太长时保留首行和末尾若干整行：
    任务卡用首行当摘要，按字符截会让它从半个词读起。"""
    lines = output.strip().splitlines()
    if len(output.strip()) <= limit or len(lines) < 2:
        return output.strip()[-limit:]
    tail, size = [], 0
    for line in reversed(lines[1:]):
        size += len(line) + 1
        if size > limit:
            break
        tail.append(line)
    return "\n".join([lines[0], "…", *reversed(tail)])


def _rebuild(tools_root, *, runner, timeout, root, proxy_options):
    from .error_reporting import redact
    if problem := _bundle_problem(root):
        return _failed(*problem)
    if packaged_runtime(root=root):
        return {"ok": True, **_said("result", "labels.metadataAmane.bundled"),
                **describe(tools_root, root=root)}
    uv = find_uv()
    if uv is None:
        return _failed("errors.metadataAmane.uvMissing")
    command, env = rebuild_command(tools_root, uv=uv, root=root, proxy_options=proxy_options)
    bridge_home(tools_root).mkdir(parents=True, exist_ok=True)
    (bridge_home(tools_root) / "installed.json").unlink(missing_ok=True)
    try:
        completed = runner(command, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=timeout, check=False, shell=False, env=env,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except subprocess.TimeoutExpired:
        return _failed("errors.metadataAmane.rebuildTimeout", {"timeout": timeout})
    except OSError as exc:
        return _failed("errors.metadataAmane.uvStartFailed", {"error": redact(str(exc))})
    if completed.returncode:
        detail = _uv_failure(completed.stderr or completed.stdout or "")
        return _failed("errors.metadataAmane.uvSyncFailed", {"exitCode": completed.returncode, "detail": redact(detail)})
    if not bridge_python(tools_root).is_file() or installed_version(tools_root) != locked_version(root):
        return _failed("errors.metadataAmane.installIncomplete")
    try:
        checked = runner([str(bridge_python(tools_root)), "-X", "utf8", str(root / "bridge.py"), "--self-check"],
                         capture_output=True, text=True, encoding="utf-8", errors="replace",
                         timeout=60, check=False, shell=False, env=env,
                         creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        check = json.loads(checked.stdout)
        if (checked.returncode or check.get("ok") is not True
                or check.get("amane", {}).get("version") != locked_version(root)
                or not set(SITES).issubset(check.get("sites", []))):
            return _failed("errors.metadataAmane.selfCheckFailed")
    except (OSError, subprocess.TimeoutExpired, ValueError, TypeError, AttributeError):
        return _failed("errors.metadataAmane.selfCheckUnfinished")
    from .fsutil import atomic_write_text
    atomic_write_text(bridge_home(tools_root) / "installed.json", json.dumps({
        "revision": pinned_revision(root), "version": installed_version(tools_root),
        "lock_sha256": lock_fingerprint(root)}))
    return {"ok": True, **_said("result", "labels.metadataAmane.rebuilt", {"revision": pinned_revision(root)[:12]}),
            **describe(tools_root, root=root)}


def ensure(tools_root: Path, *, runner: Runner = run_task_process,
           proxy_options: Mapping[str, object] | None = None, secrets_root: Path | None = None,
           progress=lambda: None) -> None:
    """按锁准备一次独立运行环境；安装失败由调用方保留尚未处理的范围。"""
    if _ready(tools_root):
        return
    progress()
    if proxy_options is None and secrets_root is not None:
        from . import peach_proxy
        try:
            proxy_options = peach_proxy.client_options(secrets_root)
        except ValueError as error:
            raise PreparationError(*relay_args(error)) from error
    result = rebuild(tools_root, runner=runner, proxy_options=proxy_options, force=False)
    if not result.get("ok"):
        if result.get("message_code"):
            raise PreparationError(result["message_code"], result.get("message_params"))
        raise PreparationError("errors.metadataAmane.runtimeUnavailable")


def describe(tools_root: Path, *, root: Path = BRIDGE_ROOT) -> dict:
    """设置页那张卡要的事实：钉的 sha、锁里的版本、venv 建没建、桥开了哪几站。

    清单读不全时 `bundled` 为假、`problem` 写原因，sha 与锁版本留空，卡片据此停用安装。
    """
    runtime = packaged_runtime(root=root)
    python = runtime[0] if runtime else bridge_python(tools_root)
    problem = bundle_problem(root)
    return {
        "repository": AMANE_REPOSITORY,
        "license": AMANE_LICENSE,
        "bundled": not problem,
        "problem": problem,
        "revision": "" if problem else pinned_revision(root),
        "version": "" if problem else locked_version(root),
        "installed": installed(tools_root, root=root),
        "installed_version": installed_version(tools_root),
        "python": str(python),
        "sites": [{"source": name, **coded("label", label)} for name, label in SITES.items()],
    }


def installed(tools_root: Path, *, root: Path | None = None) -> bool:
    """随包清单须匹配；本地环境须有解释器、固定版本与自检成功回执。"""
    return _ready(tools_root, root=root)


def _site_paths(tools_root):
    venv = bridge_home(tools_root) / ".venv"
    return [path for path in [venv / "Lib" / "site-packages", *venv.glob("lib/python*/site-packages")]
            if path.is_dir()]


def installed_version(tools_root: Path) -> str:
    """从独立运行环境的包元数据读取版本，不导入上游或启动子进程。"""
    from importlib.metadata import distributions
    if packaged_runtime():
        return locked_version()
    if _requires_packaged_runtime():
        return ""
    for distribution in distributions(path=[str(path) for path in _site_paths(tools_root)]):
        if distribution.metadata.get("Name", "").casefold() == "amane":
            return distribution.version
    return ""


#: 上游版本问不到时的那一句（`latest_upstream_tag` 回的是按 zh-CN 渲染、带着这个 code 的 `Said`）。
UPSTREAM_UNFETCHED = "labels.metadataAmane.latestUnfetched"


def latest_upstream_tag(client_options: Mapping[str, object], *, timeout: float = 10.0) -> str:
    """上游最新 release 的 tag，只读 GitHub API；取不到一律回「未取得」，不猜。"""
    import httpx
    try:
        with httpx.Client(**client_options, timeout=timeout,
                          headers={"Accept": "application/vnd.github+json",
                                   "User-Agent": USER_AGENT}) as client:
            response = client.get(f"https://api.github.com/repos/{AMANE_REPOSITORY.rsplit('/', 2)[-2]}/"
                                  f"{AMANE_REPOSITORY.rsplit('/', 1)[-1]}/releases/latest")
            if response.status_code != 200:
                return Said(UPSTREAM_UNFETCHED)
            tag = response.json().get("tag_name")
            return str(tag) if tag else Said(UPSTREAM_UNFETCHED)
    except Exception:  # noqa: BLE001 - 网络、代理、限额都是同一个答案
        return Said(UPSTREAM_UNFETCHED)


def proxy_argument(proxy_options: Mapping[str, object]) -> tuple[list[str], dict]:
    """把 `peach_proxy.client_options` 翻成桥的 `--proxy` 与子进程环境。

    三种模式：显式代理直接传；直连要把 `*_PROXY` 从环境里摘掉，否则 libcurl 自己会读；
    跟随环境就把环境里那一份显式传过去，行为与 POC 一致，不靠 libcurl 的隐式读取。
    """
    env = dict(os.environ)
    if proxy_options.get("proxy"):
        address = str(proxy_options["proxy"])
    elif proxy_options.get("trust_env", True):
        address = next((env[name] for name in ("HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy")
                        if env.get(name)), "")
    else:
        address = ""
    for name in list(env):
        if name.upper().endswith("_PROXY"):
            env.pop(name)
    return (["--proxy", address] if address else []), env


@dataclass(frozen=True)
class AmaneBridge:
    """起一次桥子进程：一次 `--output json`、stdout 一行 JSON；可注入 runner，单测不起真进程。"""

    python: Path
    script: Path | None = BRIDGE_SCRIPT
    timeout: int = DEFAULT_TIMEOUT
    runner: Runner = run_task_process

    @classmethod
    def create(cls, tools_root: Path, *, timeout: int = DEFAULT_TIMEOUT,
               runner: Runner = run_task_process) -> "AmaneBridge":
        packaged = packaged_runtime()
        if packaged:
            return cls(packaged[0], script=None if packaged[1] == "executable" else BRIDGE_SCRIPT,
                       timeout=timeout, runner=runner)
        if _requires_packaged_runtime():
            raise MetadataProviderError("errors.metadataAmane.packagedRuntimeProblem")
        python = bridge_python(tools_root)
        if not _ready(tools_root):
            raise BridgeMissing("errors.metadataAmane.bridgeMissing", {"python": str(python)})
        if not BRIDGE_SCRIPT.is_file():
            raise MetadataProviderError("errors.metadataAmane.bridgeScriptMissing", {"path": str(BRIDGE_SCRIPT)})
        return cls(python, BRIDGE_SCRIPT, timeout, runner)

    def query(self, code: str, sites: Sequence[str], *, language: str = "jp",
              proxy_options: Mapping[str, object] | None = None,
              direct_sites: Sequence[str] = (),
              timeout: float | None = None) -> dict:
        """问几站，返回桥的整份报告（`sites` 键下每站一条记录）。"""
        from .processing_traffic import unobserved
        unobserved(Said('labels.metadataAmane.trafficUnobserved'))
        number = validate_provider_code(code)
        names = [str(site).strip() for site in sites]
        unknown = [site for site in names if site not in SITES]
        if not names or unknown:
            raise ValueError("amane sites not enabled: " + ", ".join(unknown or ["(empty)"]))
        if set(direct_sites) - set(names):
            raise ValueError("direct sites must be among the queried sites")
        from .processing_control import low_mode, checkpoint
        if low_mode() and len(names) > 1:
            return self._serial_query(code, names, language=language, proxy_options=proxy_options,
                                      direct_sites=direct_sites, timeout=timeout)
        checkpoint('network')
        proxy_args, env = proxy_argument(proxy_options or {"trust_env": True})
        for key in list(env):
            if key.startswith('_PYI_') or key in {'PYTHONHOME', 'PYTHONPATH'}:
                env.pop(key)
        if self.script is None:
            env['PYINSTALLER_RESET_ENVIRONMENT'] = '1'
        env["PYTHONIOENCODING"] = "utf-8"
        command = [str(self.python), *(["-X", "utf8", str(self.script)] if self.script else []), "--number", number,
                   "--sites", ",".join(names), "--language", language, "--output", "json",
                   *proxy_args]
        if direct_sites:
            command.extend(["--direct-sites", ",".join(direct_sites)])
        try:
            completed = self.runner(
                command, capture_output=True, text=True, encoding="utf-8", errors="strict",
                timeout=min(timeout, self.timeout) if timeout else self.timeout,
                check=False, shell=False, env=env,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except UnicodeDecodeError as exc:
            # 不猜编码、不删除字节；保留可在诊断日志中定位的阶段和指纹，不记录正文或代理凭据。
            error = MetadataProviderError("errors.metadataAmane.stdioDecode", {
                "code": number, "sites": ','.join(names),
                "runtime": 'executable' if self.script is None else 'python',
                "bytes": len(exc.object), "start": exc.start, "end": exc.end,
                "sha256": hashlib.sha256(exc.object).hexdigest()}, kind="unavailable", detail="bridge_stdio_decode")
            logging.getLogger(__name__).warning('%s', error.message)
            raise error from exc
        except subprocess.TimeoutExpired as exc:
            raise MetadataProviderError("errors.metadataAmane.bridgeTimeout", kind="unavailable",
                                        retryable=True, temporary=True) from exc
        except OSError as exc:
            raise MetadataProviderError("errors.metadataAmane.bridgeStartFailed", {"error": str(exc)}) from exc
        return _bridge_report(completed, runtime='executable' if self.script is None else 'python')

    def _serial_query(self, code, sites, *, language, proxy_options, direct_sites, timeout):
        """低占用逐站启动桥查询，保留统一的整档时间预算。"""
        from .processing_control import checkpoint, deadline_after
        deadline = deadline_after(timeout) if timeout else None
        records = {}
        for site in sites:
            checkpoint('network')
            remaining = deadline - time.monotonic() if deadline is not None else None
            if remaining is not None and remaining <= 1:
                raise MetadataProviderError('errors.metadataAmane.bridgeTimeout', kind='unavailable',
                                            retryable=True, temporary=True)
            report = self.query(code, [site], language=language, proxy_options=proxy_options,
                                direct_sites=[site] if site in direct_sites else [], timeout=remaining)
            records.update(report.get('sites') or {})
        return {'number': code, 'sites': records}


def _bridge_report(completed, *, runtime: str) -> dict:
    """校验桥的 JSON 报告，并给各站快照附加有界的传输诊断。"""
    line = next((row for row in reversed(completed.stdout.splitlines()) if row.strip()), "")
    try:
        report = json.loads(line)
    except (TypeError, json.JSONDecodeError) as exc:
        detail = (completed.stderr or completed.stdout or "empty output").strip()[-800:]
        raise MetadataProviderError("errors.metadataAmane.bridgeNotJson", {"detail": detail}) from exc
    if not isinstance(report, dict) or "sites" not in report:
        message = report.get("error") if isinstance(report, dict) else ""
        if message:
            # 桥自己报的错（上游 amane 或桥脚本的原文），没有译文，原样转述。
            raise MetadataProviderError(*relayed(message))
        raise MetadataProviderError("errors.metadataAmane.bridgeFailed", {"exitCode": completed.returncode})
    transport = report.get('transport')
    transport = transport if isinstance(transport, dict) else {}
    amane = report.get('amane')
    amane = amane if isinstance(amane, dict) else {}
    diagnostics = {
        'stage': 'bridge_stdio_decode', 'status': 'ok', 'expected_encoding': 'utf-8',
        'runtime': runtime,
        'stdout_encoding': str(transport.get('stdout_encoding') or 'unknown')[:40],
        'stderr_encoding': str(transport.get('stderr_encoding') or 'unknown')[:40],
        'amane_version': str(amane.get('version') or 'unknown')[:64],
    }
    records = report['sites'] if isinstance(report['sites'], dict) else {}
    for record in records.values():
        if isinstance(record, dict):
            record['collection_diagnostics'] = dict(diagnostics)
    return report


def failure_error(site: str, record: Mapping[str, object]) -> MetadataProviderError:
    """桥记录里一站的失败 → Peach 的错误对象。上游 reason 留在 `detail`，措辞里也带着。"""
    return site_failure(site, record).provider_error(SITES.get(site, site))


def _label_param(site: str):
    """站名当报错参数：`片商官网` 那样有译文的写成嵌套的一句，界面按当前语言渲染；其余是站方原名。"""
    label = SITES.get(site, site)
    return label.phrase if isinstance(label, Said) else label


def site_failure(site: str, record: Mapping[str, object]) -> SourceFailure:
    """桥记录里一站的失败 → 契约的 `SourceFailure`。分档、冷却与可否重试都由契约那张表定。"""
    reason = str(record.get("reason") or "unexpected")
    status = diagnostic_status(record.get("http_status"))
    label = _label_param(site)
    translated = contract_reason(reason, status)
    kind = REASON_KINDS[translated]
    params: dict[str, object] = {"label": label, "reason": reason, "status": status}
    if kind == "auth":
        params["message"] = {"code": AUTH_MESSAGES.get(reason, AUTH_MESSAGES["http_error"])}
        code = "errors.metadataAmane.refusedWithStatus" if status else "errors.metadataAmane.refused"
    elif kind == "not_found":
        code = "errors.metadataAmane.notFound"
    else:
        text = str(record.get("detail") or "").strip()
        if text and reason in {"unexpected", "parse_error"}:
            params["detail"] = text[:160]
            code = ("errors.metadataAmane.unavailableWithStatusDetail" if status
                    else "errors.metadataAmane.unavailableDetail")
        else:
            code = "errors.metadataAmane.unavailableWithStatus" if status else "errors.metadataAmane.unavailable"
    return SourceFailure(translated, code, params, status_code=status, detail=reason)


def diagnostic_status(value: object) -> int:
    """HTTP 状态只接受有效整数；缺失或损坏的诊断字段记为未取得。"""
    try:
        status = int(value) if not isinstance(value, bool) else 0
        return status if 100 <= status <= 599 else 0
    except (ValueError, TypeError, OverflowError):
        return 0


def _dates(site: str, metadata: Mapping[str, object]) -> tuple[str, dict[str, str]]:
    """amane 的 `release` 落在哪：（`release_date`，放进 `extra` 的配信日）。见 `DELIVERY_DATE_SITES`。"""
    released = str(metadata.get("release") or "")
    if site in DELIVERY_DATE_SITES:
        return "", {"delivery_date": released}
    return released, {}


def _first(values: object) -> str:
    if isinstance(values, list):
        return str(next((value for value in values if value), "") or "")
    return str(values or "")


def to_record(site: str, metadata: Mapping[str, object]) -> SiteRecord:
    """amane `MediaMetadata` → 契约的 `SiteRecord`，与自写站交出的是同一种模型。

    amane 的 `publisher` 是レーベル，对应 `label` 而不是 `studio`；`external_id` 实测填的是详情页
    地址，不当身份——`code` 放站上读回的番号写法，`identifies_code` 拿它核身份，填成问的番号等于
    把这道闸拆掉，搜索首条命中的别的片会被当成这一部。男演员不进 `performers`：账本那一栏是出演
    女优。`thumb_urls` 整列进 `cover_urls`；只有 amane 才给的 `poster_url`、`screenshot_urls`、
    `trailer_url`、`plot` 与整份 `raw` 放 `extra`，随 `payload()` 原样带出。`DELIVERY_DATE_SITES`
    那几站的 `release` 是配信开始日，记进 `extra['delivery_date']`，`release_date` 留空。
    """
    actors = metadata.get("actors") if isinstance(metadata.get("actors"), list) else []
    performers = []
    for actor in actors:
        if isinstance(actor, str):
            actor = {"name": actor}
        if not isinstance(actor, dict) or str(actor.get("gender") or "") == "male":
            continue
        name = str(actor.get("name") or "").strip()
        if name:
            performers.append({"japanese_name": name})
    directors = metadata.get("directors") if isinstance(metadata.get("directors"), list) else []
    returned = str(metadata.get("number") or "")
    release_date, delivered = _dates(site, metadata)
    return SiteRecord(
        source=site, provenance=SITE_CONFIGS[site].provider if site in SITE_CONFIGS else "amane-" + site,
        code=returned,
        source_url=str(metadata.get("source_url") or metadata.get("external_id") or ""),
        title=str(metadata.get("title") or ""),
        performers=tuple(performers),
        studio=str(metadata.get("studio") or ""),
        label=str(metadata.get("publisher") or ""),
        series=str(metadata.get("series") or ""),
        director=_first(directors),
        release_date=release_date,
        runtime=metadata.get("runtime"),
        tags=tuple(str(tag) for tag in (metadata.get("tags") or []) if tag),
        cover_urls=tuple(str(url) for url in (metadata.get("thumb_urls") or []) if url),
        extra={
            "content_id": returned,
            "source": site,
            "poster_url": _first(metadata.get("poster_urls")),
            "screenshot_urls": [str(url) for url in (metadata.get("extrafanart") or []) if url],
            "trailer_url": _first(metadata.get("trailer_urls")),
            "plot": str(metadata.get("plot") or ""),
            **delivered,
            "raw": dict(metadata),
        })


def to_payload(site: str, code: str, metadata: Mapping[str, object]) -> dict:
    """amane `MediaMetadata` → `extract_peach_fields` / `extract_catalog_evidence` 认得的形状。

    键名沿用来源快照的写法（`maker`、`label`、`actresses[].japanese_name`、`genres`），
    这样候选、复核与自动落库那一路一行不用改。`code` 只用于调用方对账，payload 里的身份字段
    一律取站上读回的值（见 `to_record`）。
    """
    return to_record(site, metadata).payload()


def split_report(code: str, report: Mapping[str, object]) -> tuple[list[tuple[str, dict]], dict[str, MetadataProviderError]]:
    """桥的报告拆成两份：取到的 `[(站, payload)]`，与每站的失败。

    取回的商品必须认得出这个番号（`identifies_code`），否则按 `not_found` 记：站内搜索首条
    命中常常是别的片，这道闸和 r18.dev 那一路是同一道。
    """
    found: list[tuple[str, dict]] = []
    failures: dict[str, MetadataProviderError] = {}
    sites = report.get("sites") if isinstance(report.get("sites"), dict) else {}
    for site, record in sites.items():
        if not isinstance(record, dict):
            continue
        if record.get("status") == "found" and isinstance(record.get("metadata"), dict):
            payload = to_payload(site, code, record["metadata"])
            if record.get('collection_diagnostics'):
                payload['collection_diagnostics'] = dict(record['collection_diagnostics'])
            if identifies_code(code, payload):
                found.append((site, payload))
                continue
            failures[site] = MetadataProviderError(
                "errors.metadataAmane.productMismatch",
                {"label": _label_param(site), "code": code, "contentId": repr(payload['content_id'])},
                kind="not_found", detail="not_found")
            continue
        failures[site] = failure_error(site, record)
    return found, failures


def cooldown_action(error: MetadataProviderError) -> str:
    """这次失败要不要把整站停下：`blocked` 按 403 那一档翻倍，`rate_limited` 按 429 那一档，空串不停。

    `detail` 里是上游原样的 reason，先按 `contract_reason` 翻成契约细档，再查契约的 `COOLDOWN_ACTIONS`。
    细档不停而站方回的是 HTTP 403 时照样按 `blocked` 停：自写站那一路 `SourceTransport` 撞上 403 就是
    这么停的，两条路对同一种回答给同一种冷却。
    """
    detail = str(getattr(error, "detail", "") or "")
    if detail not in AMANE_REASONS:
        return ""
    status = int(getattr(error, "status_code", 0) or 0)
    return COOLDOWN_ACTIONS.get(contract_reason(detail, status), "") or ("blocked" if status == 403 else "")
