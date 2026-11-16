"""GitGud 主线流水线的选测：相对上一次已验证主线的改动域，加上各平台的平台敏感用例。

输出给 CI 脚本逐行读：第一行是 `full`，或已验证基线的提交；基线可用时，其后每行一个
`-Focus` 选择器。取不到基线、基线不在当前历史上、改动落到必须 full 的面，一律 `full`。
标签流水线不经过这里，直接跑全量（ADR-0119）。
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections.abc import Callable, Iterable
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
if not __package__:
    sys.path.insert(0, str(ROOT))
    __package__ = "scripts"
sys.path.insert(0, str(ROOT / "src"))
from peach.interface_text import dev as t  # noqa: E402

#: 三个平台都要验的面：路径与数据目录、证书与权限、首次设置拉起服务、调用本机 ffmpeg，
#: 以及在本平台浏览器里走首启、播放链和普通 HTTP 来源。
_SHARED = (
    "test_platform", "test_fsutil", "test_folder_picker", "test_certs", "test_auth", "test_onboarding",
    "test_media", "test_media_probe", "test_frame_capture",
    "test_data_storage", "test_task_resources", "test_resource_platform",
    "frontend/e2e/setup.test.ts", "frontend/e2e/playback-resume.test.ts",
    "frontend/e2e/player-v10.test.ts", "frontend/e2e/http-configuration.test.ts",
)
#: 代码按平台分叉、或调用平台专属程序与系统接口的测试；只是在某平台下拼路径的不算。
PLATFORM_TESTS: dict[str, tuple[str, ...]] = {
    "windows": (*_SHARED,
                "test_tray", "test_tray_detached", "test_tray_diagnostics", "test_tray_lifecycle",
                "test_restart_windows_tray", "test_process_job", "test_windows_update",
                "test_desktop_settings", "test_desktop_installer", "test_standalone_update",
                "test_interaction", "test_jobs", "test_scan", "test_media_tool_import",
                "test_listening", "frontend/e2e/external-playback.test.ts"),
    "macos": (*_SHARED,
              "test_tray", "test_mount", "test_netwatch", "test_mdns", "test_listening", "test_macos_standalone", "test_macos_media",
              "frontend/e2e/external-playback.test.ts"),
    "linux": (*_SHARED, "test_mdns", "test_listening"),
}
#: 基线只在最近这么多条成功的主线流水线里找；更早的通过记录覆盖不到之后的改动。
PIPELINE_WINDOW = 20
#: 流水线定义本身：改了作业、镜像或环境，三个平台都要按新定义完整跑一遍。本机 auto 把它
#: 归 packaging 与 tooling，主线选测在这里单独退回全量。
PIPELINE_DEFINITIONS = frozenset({".gitlab-ci.yml"})


def verified_base(pipelines: Iterable[dict], current: str, usable: Callable[[str], bool]) -> str | None:
    """最近一条成功的主线流水线里，不是本提交、且是本提交祖先的那个提交。

    强推之后旧提交不再是祖先，取不到就返回 None，由调用方退回全量；不拿推送前的提交
    顶替：上一轮红了的话，那个提交从没被验证过。
    """
    for pipeline in pipelines:
        sha = pipeline.get("sha") or ""
        if pipeline.get("status") == "success" and sha and sha != current and usable(sha):
            return sha
    return None


def successful_pipelines(environ: dict[str, str]) -> list[dict]:
    """匿名读本项目主线的成功流水线；项目公开，作业里不需要任何凭据。"""
    from peach.peach_proxy import read_url
    from peach.user_agent import USER_AGENT
    query = urlencode({"ref": environ.get("CI_DEFAULT_BRANCH") or "master", "status": "success",
                       "order_by": "id", "sort": "desc", "per_page": PIPELINE_WINDOW})
    url = f"{environ['CI_API_V4_URL'].rstrip('/')}/projects/{environ['CI_PROJECT_ID']}/pipelines?{query}"
    payload = json.loads(read_url(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT}, timeout=60))
    if not isinstance(payload, list):
        raise ValueError(t("ci_scope.pipelinesNotArray"))
    return payload


def ancestor_of_head(root: Path) -> Callable[[str], bool]:
    def usable(sha: str) -> bool:
        command = ["git", "-c", f"safe.directory={root.as_posix()}", "-C", str(root), "merge-base", "--is-ancestor", sha, "HEAD"]
        return subprocess.run(command, capture_output=True, check=False).returncode == 0
    return usable


def plan(platform: str, root: Path, environ: dict[str, str], *,
         pipelines: Callable[[dict[str, str]], list[dict]] = successful_pipelines) -> tuple[list[str], str]:
    """返回输出行与原因。改动域交给 `test_runner` 的 auto 规则判，这里只预判会不会退成全量。"""
    from . import test_runner as runner
    current = environ.get("CI_COMMIT_SHA", "")
    try:
        base = verified_base(pipelines(environ), current, ancestor_of_head(root))
    except (OSError, KeyError, ValueError) as error:
        return ["full"], t("ci_scope.noVerifiedPipeline", error=error)
    if base is None:
        return ["full"], t("ci_scope.noVerifiedAncestor")
    try:
        paths = runner.changed_files(root, base)
        scopes, explanation = runner.scopes_for_changes(paths, contents=runner.changed_contents(root, base, paths))
    except (OSError, subprocess.CalledProcessError) as error:
        return ["full"], t("ci_scope.cannotCompare", base=base[:12], error=error)
    if definitions := sorted(PIPELINE_DEFINITIONS.intersection(paths)):
        return ["full"], t("ci_scope.pipelineChanged", files=list(definitions))
    if "full" in scopes:
        return ["full"], explanation
    return [base, *PLATFORM_TESTS[platform]], t("ci_scope.baseline", base=base[:12], explanation=explanation)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=t("ci_scope.description"))
    parser.add_argument("--platform", choices=tuple(PLATFORM_TESTS), required=True)
    args = parser.parse_args(argv)
    lines, reason = plan(args.platform, ROOT, dict(os.environ))
    print(t("ci_scope.selection", reason=reason), file=sys.stderr, flush=True)
    print("\n".join(lines), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
