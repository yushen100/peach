"""本机的保留期限：写入前的账本自动备份留几份、`logs` 里的日志留多少天。

两项都在读不到账本的时候用：日志在托盘拉起任何子进程之前整理，那时还没迁移、也还没打开账本；
账本备份清退在启动、手动备份与恢复之后跑，恢复失败时账本本身可能就读不出来。所以存在实例状态
目录的 `retention.json`，不跟账本走——它说的是这台电脑的磁盘留多少，本来也是本机的事。

只收列出的几档；文件缺失、存坏或手改成别的值时一律按默认（备份 5 份、日志半年）。
"""
from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path

from filelock import FileLock

from .fsutil import atomic_write_text
from .user_messages import UserValueError

FILENAME = "retention.json"

#: 写入前自动备份的最近几份一定留（`ledger_backups.KEEP_RECENT` 的默认值）。
DEFAULT_BACKUP_KEEP = 5
BACKUP_KEEP_CHOICES = (2, 5, 10, 20)
#: 日志多少天没再写过就整份删掉（`log_retention.RETENTION` 的默认值，约半年）。
DEFAULT_LOG_DAYS = 183
LOG_DAY_CHOICES = (30, 90, 183, 365)

_FIELDS = {
    "backup_keep": (BACKUP_KEEP_CHOICES, DEFAULT_BACKUP_KEEP),
    "log_days": (LOG_DAY_CHOICES, DEFAULT_LOG_DAYS),
}


def _valid(value, choices: tuple[int, ...]) -> bool:
    return type(value) is int and value in choices


def read(state_root: Path) -> dict:
    """两项当前的值；没设过或读不出来的用默认值。"""
    try:
        payload = json.loads((Path(state_root) / FILENAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        payload = {}
    payload = payload if isinstance(payload, dict) else {}
    return {key: payload[key] if _valid(payload.get(key), choices) else default
            for key, (choices, default) in _FIELDS.items()}


def backup_keep(state_root: Path) -> int:
    return read(state_root)["backup_keep"]


def log_retention(state_root: Path) -> timedelta:
    return timedelta(days=read(state_root)["log_days"])


def save(state_root: Path, body: dict) -> dict:
    """合并写入请求里出现的项，返回写完后的两项。不在档位里的值整次拒收。"""
    patch = {}
    for key, (choices, _default) in _FIELDS.items():
        if key in (body or {}):
            if not _valid(body[key], choices):
                raise UserValueError("errors.retentionSettings.choiceInvalid",
                                     {"key": key, "choices": "/".join(map(str, choices))})
            patch[key] = body[key]
    if not patch:
        raise UserValueError("errors.retentionSettings.empty")
    path = Path(state_root) / FILENAME
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path) + ".lock", timeout=5):
        merged = {**read(state_root), **patch}
        atomic_write_text(path, json.dumps(merged) + "\n")
    return merged
