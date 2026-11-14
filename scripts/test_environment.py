"""正式测试入口的依赖准备，只在隔离工作树自动同步环境。"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "src") not in sys.path:
    sys.path.insert(0, str(ROOT / "src"))

from peach.interface_text import dev as t
from peach.runtime_prepare import Dependencies, find_uv


def frontend_drift(root: Path) -> str | None:
    """`frontend/node_modules` 与前端锁文件对不上时返回第一个对不上的包，对得上返回 None。

    比对 npm 装完写下的 `node_modules/.package-lock.json`：装着的包版本都要与锁文件一致，
    锁文件里的必需包都要装着；可选包（别的平台的原生绑定）没装不算。没装过前端依赖时返回
    `node_modules`。
    """
    lock = root / "frontend" / "package-lock.json"
    if not lock.is_file():
        return None
    try:
        wanted = json.loads(lock.read_text(encoding="utf-8"))["packages"]
        installed = json.loads((root / "frontend" / "node_modules" / ".package-lock.json")
                               .read_text(encoding="utf-8"))["packages"]
    except FileNotFoundError:
        return "node_modules"
    except (OSError, ValueError, KeyError, TypeError):
        return "node_modules/.package-lock.json"
    for name, entry in installed.items():
        if name and wanted.get(name, {}).get("version") != entry.get("version"):
            return name
    for name, entry in wanted.items():
        if name and name not in installed and not (
                entry.get("optional") or entry.get("devOptional") or entry.get("peer")):
            return name
    return None


def prepare(root: Path, main: Path, *, run=subprocess.run, which=shutil.which,
            environ=None) -> None:
    """准备完成才允许加载测试运行器；主检出依赖只读检查。"""
    root, main = root.resolve(), main.resolve()
    if not (root / "uv.lock").is_file():
        raise RuntimeError(t("test_environment.lockMissing", path=root / "uv.lock"))
    environment = dict(os.environ if environ is None else environ)
    for name in ("VIRTUAL_ENV", "UV_PROJECT_ENVIRONMENT"):
        environment.pop(name, None)
    if root == main:
        step = Dependencies(root, run=run, which=which, environ=environment, frozen=False).check()
        if step.state != "current":
            raise RuntimeError(t("test_environment.mainNotReady", message=step.message))
        print(step.message, flush=True)
        return
    if (root / ".venv").resolve() != root / ".venv":
        raise RuntimeError(t("test_environment.venvOutside"))
    uv = find_uv(which=which, environ=environment)
    if uv is None:
        raise RuntimeError(t("test_environment.uvMissing"))
    print(t("test_environment.syncing", path=root / ".venv"), flush=True)
    result = run([str(uv), "sync", "--locked", "--all-extras", "--python", sys.executable,
                  "--project", str(root)], cwd=str(root), env=environment, check=False)
    if result.returncode:
        raise RuntimeError(t("test_environment.syncFailed", code=result.returncode))
    # Python 依赖上面自动同步；前端依赖装一次要一两分钟，不替人装，只在开跑前拦下，
    # 免得跑满一轮才在前端用例上整组失败。
    drift = frontend_drift(root)
    if drift is not None:
        raise RuntimeError(t("test_environment.frontendDrift", package=drift,
                             command=f'npm ci --prefix "{root / "frontend"}"'))


def main(argv=None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description=t("test_environment.description"))
    parser.add_argument("root", type=Path)
    parser.add_argument("main_root", type=Path)
    args = parser.parse_args(argv)
    try:
        prepare(args.root, args.main_root)
    except (RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr, flush=True)
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
