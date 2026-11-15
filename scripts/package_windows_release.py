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
    一张三平台的表、其余文件、已装版本的更新方式、macOS 首次安装与 Docker 标签。文字在 `release_download_text`。"""
    from . import release_download_text as text
    directory = (download_base or f"https://github.com/peach-mitao/peach/releases/download/v{version}").rstrip('/')
    base = f"{directory}/Peach-{version}-windows-x64"
    tools = (f"[FFmpeg]({base}-tools-ffmpeg.zip)", f"[untrunc]({base}-tools-untrunc.zip)",
             f"[cloudflared]({base}-tools-cloudflared.zip)")
    fields = {"docs": DOCS, "macos_guide": f"{DOCS}/{text.MACOS_GUIDE_ANCHOR}", "directory": directory, "base": base,
              "version": version, "images": f"`longmeidao/peach:{version}`<br>`ghcr.io/peach-mitao/peach:{version}`",
              "face": f"{base}-tools-face-models.zip",
              "quarantine": '`sudo /usr/bin/xattr -rd com.apple.quarantine "/Applications/Peach.app"`'}
    english, chinese = (text.SECTION[language].format(
        **fields, tools=text.TOOL_SEPARATOR[language].join(tools),
        lite=text.LITE_ROW[language].format(base=base) if lite_installer else "") for language in ("en", "zh-CN"))
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
