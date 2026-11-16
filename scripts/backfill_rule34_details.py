#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""给已入库的 rule34.xxx 追更条目补上列表请求之外的细节。

posts DAPI 的默认 JSON 只回扁平标签和最后修改时间，三样东西要另外问：

- 标签类型（general／artist／character／copyright／metadata）：JSON 带
  `fields=tag_info`。帖子页 `#tag-sidebar` 自 2026-10-20 起被 Cloudflare 验证挡住，
  不再是来源。
- 上传时间：XML 的 `created_at`。DAPI 的 `change` 是最后一次修改：17361475
  五月上传、九月被改过标签，入库时记成了九月，卡片就排到了新内容里。
- 视频时长只在原文件头的 `mvhd` 里，接口都不给。

常规「检查更新」只看第一页，而且已经补齐过类型的条目不再进第二阶段，存量行靠
它永远改不过来。「设置 › 修复与迁移」里有同一项（只挑缺类型或缺时长的行），确认后在后台限速
跑完；这份脚本留给要先出复核 CSV、或要每条都核对上传时间的场合。判据（待补条目、`plan_update`、
连接器的 `_detail` 与 `_video_seconds`、写入）都在 `peach.follow_backfill`：判据只能有一处。

默认 dry-run，只写复核 CSV。`--apply` 必须同时给 `--backup`，与本仓库其它真实写入
脚本一致。`--resume` 跳过同一份 CSV 里已经写入的条目，中断后用原命令加它接着跑。

`--missing-types` 只挑账本里还没有标签类型的条目。帖子页被挡住的那段时间入库的行
正是这一批，它们的上传时间也还是 `change` 占位，一趟一起改正。

`--duration-only` 只补 mp4 缺的时长：只挑 `duration` 为空的 mp4 条目，不问 dapi，
只读原文件头，也只写 `duration`。时长在视频 CDN 上，不受 dapi 每秒一次的限流牵连，
授权只覆盖时长时用它，别的列一格不动。
"""
from __future__ import annotations

import argparse
import sqlite3
import time
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
sys.path.append(str(Path(__file__).resolve().parent))

from peach.config import GENERATED_DIR, SECRETS_DIR, SHARED_CREDENTIAL_ROOT
from peach.follow_backfill import (
    MISSED, MISS_STREAK_LIMIT, NOTES, POST_COOLDOWN, POST_DELAY, YES,
    inspect_duration as _inspect_duration, inspect_post, post_pending, write_update,
)
from peach.follow_secrets import CredentialError, credential_store_for
from peach.follow_sources import build_connector
from peach.interface_text import dev as t
from peach.review_csv import read_rows, write_rows
from peach.scripting import (
    BACKUP_REQUIRED, add_ledger_write_args, open_for_write, open_readonly,
)
from legacy_values import RULE34_WRITTEN

FIELDS = ("item_id", "external_id", "result", "published_before", "published_after",
          "duration", "tag_types_added", "written", "note")
DEFAULT_DELAY = POST_DELAY
COOLDOWN_SECONDS = POST_COOLDOWN
#: 每这么多条落一次库、写一次 CSV。
FLUSH_EVERY = 50


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=t("backfill_rule34_details.description"))
    add_ledger_write_args(parser)
    parser.add_argument("--out", type=Path,
                        default=GENERATED_DIR / "rule34-detail-backfill.csv")
    parser.add_argument("--limit", type=int, default=0, help=t("backfill_rule34_details.limitHelp"))
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY)
    parser.add_argument("--resume", action="store_true",
                        help=t("backfill_rule34_details.resumeHelp"))
    parser.add_argument("--duration-only", action="store_true",
                        help=t("backfill_rule34_details.durationOnlyHelp"))
    parser.add_argument("--missing-types", action="store_true",
                        help=t("backfill_rule34_details.missingTypesHelp"))
    return parser


def written_ids(path: Path) -> set[int]:
    """上一趟已经写进账本的条目。只认 `written=yes`（旧版写「是」）：dry-run 与未取得的都要再问。"""
    return {int(row["item_id"]) for row in read_rows(path, missing_ok=True)
            if was_written(row) and str(row.get("item_id") or "").isdigit()}


def was_written(row: dict) -> bool:
    written = str(row.get("written") or "")
    return RULE34_WRITTEN.get(written, written) == YES


def pending_rows(connection: sqlite3.Connection, limit: int,
                 done: set[int] = frozenset(), *, duration_only: bool = False,
                 missing_types: bool = False) -> list[dict]:
    """待补条目：`follow_backfill.post_pending`，扣掉上一趟已经写入的。"""
    return post_pending(connection, limit, done, duration_only=duration_only,
                        missing_types=missing_types)


def _localized(result: tuple[dict, dict | None]) -> tuple[dict, dict | None]:
    entry, update = result
    if entry["note"] in NOTES:
        entry["note"] = t(f"backfill_rule34_details.{entry['note']}")
    return entry, update


def inspect_row(connector, row: dict) -> tuple[dict, dict | None]:
    """问一条（`follow_backfill.inspect_post`），固定原因换成界面语言。"""
    return _localized(inspect_post(connector, row))


def inspect_duration(connector, row: dict) -> tuple[dict, dict | None]:
    """只补时长（`follow_backfill.inspect_duration`）。"""
    return _localized(_inspect_duration(connector, row))


def _apply(writer: sqlite3.Connection, updates: list[tuple[int, dict]]) -> None:
    for item_id, update in updates:
        write_update(writer, item_id, update)
    writer.commit()


def run(args: argparse.Namespace) -> int:
    if args.apply and not args.backup:
        print(BACKUP_REQUIRED, file=sys.stderr)
        return 2
    done = written_ids(args.out) if args.resume else set()
    previous = [{**row, "written": YES} for row in read_rows(args.out, missing_ok=True)
                if was_written(row)] if args.resume else []
    with open_readonly(args.db) as reader:
        rows = pending_rows(reader, args.limit, done, duration_only=args.duration_only,
                            missing_types=args.missing_types)
        total = reader.execute(
            "SELECT COUNT(*) FROM follow_item i JOIN follow_source s ON s.id=i.source_id"
            " WHERE s.provider='rule34xxx'").fetchone()[0]
    print(t("backfill_rule34_details.pending", total=total, done=len(done), pending=len(rows)), flush=True)
    if not rows:
        return 0
    # dapi 要账号自己的 user_id + api_key；只读文件头不需要。缺凭据在备份与写入之前就停。
    credential = None
    if not args.duration_only:
        try:
            credential = credential_store_for(
                SECRETS_DIR, shared_root=SHARED_CREDENTIAL_ROOT).load("rule34xxx")
        except CredentialError as error:
            print(t("backfill_rule34_details.credentialUnavailable", error=error), file=sys.stderr)
            return 2
        if credential is None:
            print(t("backfill_rule34_details.credentialMissing"), file=sys.stderr)
            return 2

    writer: sqlite3.Connection | None = None
    before = 0
    if args.apply:
        # 备份在任何写入之前由 `open_for_write` 落；分批提交，中断一次不至于整趟白跑。
        writer = open_for_write(args)
        # 服务的关注检查同时在写 follow_item；它的事务很短，等它提交而不是 5 秒就报锁。
        writer.execute("PRAGMA busy_timeout=60000")
        print(t("backfill_rule34_details.backup", backup=args.backup), flush=True)
        before = writer.execute("SELECT COUNT(*) FROM follow_item").fetchone()[0]

    connector = build_connector("rule34xxx", credential=credential)
    log: list[dict] = []
    staged: list[tuple[int, dict]] = []
    staged_logs: list[dict] = []
    counts = {"published_at": 0, "duration": 0, "metadata_json": 0, MISSED: 0}
    miss_streak = 0
    next_detail = 0.0

    def flush() -> None:
        if writer is not None and staged:
            _apply(writer, staged)
            for entry in staged_logs:
                entry["written"] = YES
        staged.clear()
        staged_logs.clear()
        args.out.parent.mkdir(parents=True, exist_ok=True)
        write_rows(args.out, FIELDS, previous + log, atomic=True)

    for index, row in enumerate(rows, 1):
        # 间隔按 dapi 请求的起点算：文件头在另一个主机上，问它的时间落在这段间隔里。
        time.sleep(max(0.0, next_detail - time.monotonic()))
        next_detail = time.monotonic() + args.delay
        entry, update = (inspect_duration if args.duration_only else inspect_row)(connector, row)
        log.append(entry)
        if entry["result"] == MISSED:
            counts[MISSED] += 1
            miss_streak += 1
            if miss_streak >= MISS_STREAK_LIMIT:
                print(t("backfill_rule34_details.rateLimited", streak=miss_streak, seconds=f"{COOLDOWN_SECONDS:.0f}"), flush=True)
                flush()
                time.sleep(COOLDOWN_SECONDS)
                miss_streak = 0
            continue
        miss_streak = 0
        if update:
            for key in update:
                counts[key] += 1
            staged.append((row["id"], update))
            staged_logs.append(entry)
        if index % FLUSH_EVERY == 0:
            flush()
            print(t("backfill_rule34_details.progress", index=index, total=len(rows), publishedAt=counts['published_at'], duration=counts['duration'], types=counts['metadata_json'], missing=counts[MISSED]), flush=True)
    flush()
    summary = (t("backfill_rule34_details.summary", publishedAt=counts['published_at'], duration=counts['duration'], types=counts['metadata_json'], missing=counts[MISSED], out=args.out))
    if writer is None:
        print(t("backfill_rule34_details.dryRun", summary=summary), flush=True)
        return 0
    after = writer.execute("SELECT COUNT(*) FROM follow_item").fetchone()[0]
    writer.close()
    # 条数必须不变：这一趟只补已有条目的列，不新增也不删除条目。
    print(t("backfill_rule34_details.written", summary=summary, before=before, after=after), flush=True)
    return 0 if before == after else 1


def main(argv: list[str] | None = None) -> int:
    return run(build_parser().parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main())
