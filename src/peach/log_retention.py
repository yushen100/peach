"""`<Peach 数据目录>/logs` 里的日志默认保留半年，大小不设限。

保留天数在 Peach 配置里能改，存在本机的 `retention_settings`；调用方读出来传给 `sweep`。

托盘子服务、首次扫描和源码同步都把 stdout 直接追加进各自的 `.log`，不经 `logging`，
所以 `RotatingFileHandler` 用不上；这里只看文件本身的修改时间：

- 超过保留期没再写过的文件整份删掉——它里面没有一行是保留期内的。
- 还在写的文件按自然月切段：托盘启动时发现上次写入落在更早的月份，就把它改名成
  `<名字>.until-<最后写入日期>.log`，下一次写入从空文件开始。切下来的段再过保留期被第一条
  规则收走。

只用修改时间，不用创建时间：Windows 上追加写的文件 `st_ctime` 是创建时间，macOS 是
`st_birthtime`，Linux 常常两者都不可靠，而 `os.utime` 在三处都能改 mtime，测试才立得住。
必须在任何子进程打开日志之前跑：Windows 上被别的进程占着的文件改不了名也删不掉。
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from pathlib import Path

__all__ = ["RETENTION", "idle_process_log", "sweep"]

#: 默认保留期，约半年。
RETENTION = timedelta(days=183)

#: 切下来的段名里的标记；带它的文件不再二次切段。
_SEGMENT_MARK = ".until-"
#: 每个进程各一份的日志：`faulthandler` 的崩溃输出与本机事件日志（`error_reporting`）。
_PROCESS_LOG = re.compile(r"^(?:crash|errors)-(\d+)\.log$")
#: 只有启动记录的事件日志很小；超过这个大小一定写过别的，不必读。
_IDLE_LIMIT = 64 * 1024


def idle_process_log(path: Path) -> bool:
    """进程日志里没有任何问题：崩溃日志是空的，事件日志只有启动时那条 `entry` 记录。"""
    try:
        size = path.stat().st_size
        if size == 0 or path.name.startswith("crash-"):
            return size == 0
        if size > _IDLE_LIMIT:
            return False
        lines = path.read_text(encoding="utf-8").splitlines()
        return all(json.loads(line).get("stage") == "entry" for line in lines if line.strip())
    except (OSError, ValueError, AttributeError):
        return False


def _pid_alive(pid: int) -> bool:
    import psutil
    return psutil.pid_exists(pid)


def _remove_idle_process_logs(log_dir: Path, alive) -> list[str]:
    """已结束进程留下的空进程日志直接收走（#485）。短命子进程各留一个空崩溃日志和只有启动
    记录的事件日志，几天就是几万个文件；还在运行的进程的日志一律保留。"""
    removed, actions = 0, []
    for path in log_dir.glob("*.log"):
        process = _PROCESS_LOG.match(path.name)
        if not process or not idle_process_log(path) or alive(int(process.group(1))):
            continue
        try:
            path.unlink()
            removed += 1
        except OSError as error:
            actions.append(f"kept {path.name}: {error.strerror or error}")
    if removed:
        actions.append(f"removed {removed} idle process logs")
    return actions


def sweep(log_dir: Path, *, now: datetime | None = None, alive=_pid_alive,
          retention: timedelta = RETENTION) -> list[str]:
    """按上面两条规则整理一个日志目录，返回做过的事（供日志与测试）。先收走空进程日志。"""
    if not log_dir.is_dir():
        return []
    moment = now or datetime.now()
    actions: list[str] = _remove_idle_process_logs(log_dir, alive)
    for path in sorted(log_dir.glob("*.log")):
        try:
            modified = datetime.fromtimestamp(path.stat().st_mtime)
        except OSError:
            continue
        if moment - modified > retention:
            try:
                path.unlink()
            except OSError as error:
                actions.append(f"kept {path.name}: {error.strerror or error}")
                continue
            actions.append(f"deleted {path.name}")
            continue
        if _SEGMENT_MARK in path.name:
            continue
        if (modified.year, modified.month) < (moment.year, moment.month):
            segment = path.with_name(f"{path.stem}{_SEGMENT_MARK}{modified:%Y%m%d}{path.suffix}")
            if segment.exists():
                # 同一天切过两次只会发生在同一秒内重启两遍；后来的这份并进去比覆盖安全。
                try:
                    with segment.open("ab") as target, path.open("rb") as source:
                        target.write(source.read())
                    path.unlink()
                except OSError as error:
                    actions.append(f"kept {path.name}: {error.strerror or error}")
                    continue
            else:
                try:
                    path.replace(segment)
                except OSError as error:
                    actions.append(f"kept {path.name}: {error.strerror or error}")
                    continue
            actions.append(f"rotated {path.name} -> {segment.name}")
    return actions
