"""占满整机测试名额运行一条命令，结束后释放。

本机 CI runner 的构建、冒烟与镜像作业用它和本机测试排同一组名额（`scripts/test_slots.py`，ADR-0172），
像全量一样取满全部名额；命令里再调用测试入口时，入口看到名额已被父进程持有，不会再排一次。

用法：python scripts/machine_lock.py [--wait 秒] -- 命令 参数...
"""
from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
if not __package__:
    sys.path.insert(0, str(ROOT))
    __package__ = "scripts"

SRC_DIR = ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from peach.interface_text import dev as t  # noqa: E402

from . import test_slots  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=t("machine_lock.description"),
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--wait", type=float, default=3600, help=t("machine_lock.waitHelp"))
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error(t("machine_lock.commandMissing"))
    try:
        total = test_slots.slot_count()
    except ValueError as error:
        parser.error(str(error))
    try:
        with test_slots.held(total, total=total, scope=" ".join(command)[:120], root=str(ROOT),
                             wait_seconds=args.wait):
            return subprocess.run(command, check=False).returncode
    except test_slots.SlotTimeout as error:
        print(error, flush=True)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
