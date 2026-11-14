"""生成完整免安装包、应用更新包及按工具拆分的 ZIP。"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from peach.interface_text import dev as t
from peach.update_packages import MANIFEST, TOOL_PATHS, digest, read_manifest


def archive(destination: Path, root: Path, files: list[Path], manifest: dict | None = None) -> None:
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as package:
        for path in files:
            if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
                raise ValueError(t("package_windows_release.linkOrOutsideFile"))
            package.write(path, "Peach/" + path.relative_to(root).as_posix())
        if manifest is not None:
            package.writestr("Peach/" + MANIFEST, json.dumps(manifest, ensure_ascii=False, sort_keys=True))


DOCS = "https://github.com/peach-mitao/peach/blob/master/docs"
def download_sections(version: str, *, lite_installer: bool = False,
                      download_base: str | None = None) -> tuple[str, str]:
    """Release 正文下载段的英文与中文两份，不含折叠标签（由 `changelog.notes()` 分别折叠）：
    一张三平台的表、其余文件、已装版本的更新方式、macOS 首次安装与 Docker 标签。"""
    directory = (download_base or f"https://github.com/peach-mitao/peach/releases/download/v{version}").rstrip('/')
    base = f"{directory}/Peach-{version}-windows-x64"
    images = f"`longmeidao/peach:{version}`<br>`ghcr.io/peach-mitao/peach:{version}`"
    tools = (f"[FFmpeg]({base}-tools-ffmpeg.zip)", f"[untrunc]({base}-tools-untrunc.zip)",
             f"[cloudflared]({base}-tools-cloudflared.zip)")
    quarantine = '`sudo /usr/bin/xattr -rd com.apple.quarantine "/Applications/Peach.app"`'
    macos_guide = f"{DOCS}/OPERATIONS.md#macos-独立测试包"
    english = (
        "Windows installers, the portable ZIP and macOS DMGs bundle Python, FFmpeg, untrunc, cloudflared and the face "
        "models, so they work right after installing; the Docker image suits NAS and Linux servers. See the "
        f"[Windows guide]({DOCS}/TESTING_DESKTOP.md), [macOS guide]({macos_guide}) and "
        f"[Docker deployment]({DOCS}/DOCKER.md).\n\n"
        "| Platform | Download | Notes |\n| --- | --- | --- |\n"
        f"| Windows x64 | [Installer]({base}-setup.exe) | Recommended for a first install |\n"
        + (f"| Windows x64 | [Lite installer]({base}-lite-setup.exe) | Without tools; reuses installed ones or "
           "downloads them during setup |\n" if lite_installer else "")
        + f"| Windows x64 | [Portable ZIP]({base}.zip) | Extract and run `Peach.exe` |\n"
        f"| macOS Apple Silicon | [DMG]({directory}/Peach-{version}-macos-arm64.dmg) | M-series chips |\n"
        f"| macOS Intel | [DMG]({directory}/Peach-{version}-macos-x86_64.dmg) | Intel processors |\n"
        f"| Docker / NAS | {images} | Same image; use ghcr.io when Docker Hub pulls are limited |\n\n"
        f"You do not need the other files: the Windows updater fetches `update.zip` and the {', '.join(tools)} and "
        f"[face model]({base}-tools-face-models.zip) tool packages as needed; `*-corresponding-source.zip` is the "
        "corresponding source of third-party tools; `SHA256SUMS.txt` verifies the files.\n\n"
        "### Updating an existing install\n\n"
        "| Platform | How |\n| --- | --- |\n"
        "| Windows | Settings → App and maintenance → Check for updates, then confirm the restart; or run the new "
        "installer |\n"
        "| macOS | Menu bar → Version and updates → Check for updates; 0.53.0 and earlier install the new DMG once by "
        "hand |\n"
        "| Docker | Pull the new image and recreate the container; with Watchtower, Settings offers one-click "
        f"updates. See [Docker deployment]({DOCS}/DOCKER.md) |\n\n"
        "### macOS first install\n\n"
        "Check the chip under About This Mac: Apple M-series takes Apple Silicon, Intel processors take Intel. Open "
        "the DMG, drag Peach into Applications, then open it to finish setup.\n\n"
        "The app is ad-hoc signed and not yet notarized by Apple. If macOS says it is damaged and cannot be opened, "
        f"run {quarantine} in Terminal and open it again; the password asked for is this Mac's login password and "
        "does not show while you type. The command only removes Peach's quarantine flag. Run it again after "
        "dragging in a new version by hand; installs through the in-app updater do not need it.\n\n"
        "### Docker\n\n"
        "The `edge` tag always points to the newest release; pin a version with the versioned tags in the table "
        f"above. See [Docker deployment]({DOCS}/DOCKER.md) for setup, updates and rollback."
    )
    chinese = (
        "Windows 安装包、免安装包和 macOS DMG 都内置 Python、FFmpeg、untrunc、cloudflared 和人脸模型，装好即可使用；"
        "Docker 镜像适合 NAS 与 Linux 服务器。安装与使用见 "
        f"[Windows 使用说明]({DOCS}/TESTING_DESKTOP.md)、[macOS 使用说明]({macos_guide})和 "
        f"[Docker 部署]({DOCS}/DOCKER.md)。\n\n"
        "| 平台 | 下载 | 说明 |\n| --- | --- | --- |\n"
        f"| Windows x64 | [安装包]({base}-setup.exe) | 首次安装推荐 |\n"
        + (f"| Windows x64 | [轻量安装包]({base}-lite-setup.exe) | 不含工具，复用已装的或安装时联网下载 |\n"
           if lite_installer else "")
        + f"| Windows x64 | [免安装包（ZIP）]({base}.zip) | 解压后运行 `Peach.exe` |\n"
        f"| macOS Apple Silicon | [DMG]({directory}/Peach-{version}-macos-arm64.dmg) | M 系列芯片 |\n"
        f"| macOS Intel | [DMG]({directory}/Peach-{version}-macos-x86_64.dmg) | Intel 处理器 |\n"
        f"| Docker / NAS | {images} | 同一镜像，Docker Hub 拉取受限时用 ghcr.io |\n\n"
        f"其余文件不用手动下载：`update.zip` 和 {'、'.join(tools)}、[人脸模型]({base}-tools-face-models.zip) 工具包"
        "由 Windows 更新器按需取用；`*-corresponding-source.zip` 是第三方工具的对应源码；`SHA256SUMS.txt` 用来核对文件。\n\n"
        "### 更新已有安装\n\n"
        "| 平台 | 方法 |\n| --- | --- |\n"
        "| Windows | 「配置 → 应用与维护」检查更新，下载完成后确认重启；也可以直接运行新安装包 |\n"
        "| macOS | 菜单栏「版本与更新」>「检查更新」；0.53.0 及更早版本先手动装一次新 DMG |\n"
        f"| Docker | 拉取新镜像后重建容器，启用 Watchtower 时可在配置页一键更新，见 [Docker 部署]({DOCS}/DOCKER.md) |\n\n"
        "### macOS 首次安装\n\n"
        "不确定选哪个 DMG，在「关于本机」看芯片：Apple M 系列选 Apple Silicon，Intel 处理器选 Intel。"
        "打开 DMG，把 Peach 拖进「应用程序」，再打开应用完成首次设置。\n\n"
        f"安装包使用 ad-hoc 签名，还没有完成 Apple 公证。提示「已损坏，无法打开」时，在终端执行 {quarantine} 后重新打开；"
        "要求输入的是这台 Mac 的登录密码，输入时屏幕不显示字符。这条命令只移除 Peach 的隔离标记。"
        "手动拖入新版本后要再执行一次，经应用内更新安装的不需要。\n\n"
        "### Docker\n\n"
        f"`edge` 标签始终指向最新一版，要固定版本就用上表里带版本号的标签。部署、更新与回滚见 [Docker 部署]({DOCS}/DOCKER.md)。"
    )
    return english, chinese


def build_lite_installer(output: Path, version: str, compiler: Path | None = None) -> Path:
    """将应用更新包及其工具清单编入按需下载工具的安装器。"""
    from peach.standalone_update import extract
    output = output.resolve()
    if compiler is None:
        candidates = [os.environ.get('PEACH_ISCC'), shutil.which('ISCC.exe'),
                      str(Path(os.environ.get('ProgramFiles(x86)', 'C:/Program Files (x86)')) / 'Inno Setup 6/ISCC.exe'),
                      str(Path(os.environ.get('LOCALAPPDATA', '')) / 'Programs/Inno Setup 6/ISCC.exe')]
        compiler = next((Path(item) for item in candidates if item and Path(item).is_file()), None)
    if compiler is None:
        raise ValueError(t('package_windows_release.innoSetupMissing'))
    with tempfile.TemporaryDirectory(prefix='peach-lite-installer-') as folder:
        source = extract(output / f'Peach-{version}-windows-x64-update.zip', Path(folder).resolve(), lambda *_: None)
        read_manifest(source, version)
        subprocess.run([str(compiler), '/Q', f'/DAppVersion={version}',
                        f'/DSourceDir={source}', f'/DOutputDir={output}', '/DLiteInstaller=1',
                        str(Path(__file__).resolve().parent / 'installer/peach.iss')], check=True)
    target = output / f'Peach-{version}-windows-x64-lite-setup.exe'
    if not target.is_file():
        raise ValueError(t('package_windows_release.liteInstallerMissing'))
    return target


def package(root: Path, output: Path, version: str) -> dict:
    import re
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError(t("package_windows_release.invalidVersion"))
    root, output = root.resolve(), output.resolve()
    if output.is_relative_to(root):
        raise ValueError(t("package_windows_release.outputInsideSource"))
    if not (root / "Peach.exe").is_file() or not (root / "_internal/standalone.txt").is_file():
        raise ValueError(t("package_windows_release.notStandalone"))
    output.mkdir(parents=True, exist_ok=True)
    files = sorted(path for path in root.rglob("*") if path.is_file())
    if any(path.name == MANIFEST for path in files):
        raise ValueError(t("package_windows_release.manifestInFullPackage"))
    tools = {}
    tool_files: set[Path] = set()
    for tool, (prefix, required) in TOOL_PATHS.items():
        selected = [path for path in files if (path.is_relative_to(root / prefix) if prefix
                    else path.relative_to(root).as_posix() in required)]
        names = {path.relative_to(root).as_posix(): digest(path) for path in selected}
        expected = {f"{prefix}/{name}" if prefix else name for name in required}
        if not expected.issubset(names):
            raise ValueError(t("package_windows_release.toolFilesMissing", tool=tool))
        name = f"Peach-{version}-windows-x64-tools-{tool}.zip"
        archive(output / name, root, selected)
        tools[tool] = {"files": names, "asset": {"name": name, "size": (output / name).stat().st_size,
                                              "sha256": digest(output / name)}}
        tool_files.update(selected)
    manifest = {"format": 1, "version": version, "tools": tools}
    # 用运行时的同一判据验证生成结果，不在完整包内留下更新专用文件。
    with tempfile.TemporaryDirectory() as temp:
        check = Path(temp).resolve()
        (check / MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")
        read_manifest(check, version)
    archive(output / f"Peach-{version}-windows-x64.zip", root, files)
    archive(output / f"Peach-{version}-windows-x64-update.zip", root,
            [path for path in files if path not in tool_files], manifest)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=t("package_windows_release.description"))
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--lite-installer", action="store_true", help=t("package_windows_release.helpLiteInstaller"))
    parser.add_argument("--iscc", type=Path, help=t("package_windows_release.helpIscc"))
    args = parser.parse_args()
    manifest = package(args.source, args.output, args.version)
    if args.lite_installer:
        build_lite_installer(args.output, args.version, args.iscc)
    print(json.dumps({"version": manifest["version"], "tools": list(manifest["tools"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
