#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""把已入库的 rule34video 追更条目里站方单列的角色改记成 `character`。

「设置 › 修复与迁移」里有同一项，确认后在后台限速跑完；这份脚本留给要先出复核 CSV 的场合。
判据（待问条目、详情页解析、改记规则、写入前重读）都在 `peach.follow_backfill`，这里只管
CSV、dry-run 与续跑：判据只能有一处。

只改一件事：站方列进 Characters 组、库里已经记过类型的名字改成 `character`。别的类型、
标签列表、封面与日期一格不动；库里还没有 `tag_types` 的行留给常规检查补。

默认 dry-run，只写复核 CSV。`--apply` 必须同时给 `--backup`。`--resume` 跳过同一份
CSV 里已经写入或确认无需改动的条目。
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
sys.path.append(str(Path(__file__).resolve().parent))

from peach.config import GENERATED_DIR
from peach.follow_backfill import (
    FOUND, GONE, MISSED, NOTES, SKIPPED, UNCHANGED, VIDEO_COOLDOWN, VIDEO_DELAY,
    VIDEO_RATE_LIMIT_STOP, YES, apply_characters, inspect_video, video_pending,
)
from peach.follow_sources import FollowSourceRateLimited, build_connector
from peach.interface_text import dev as t
from peach.review_csv import read_rows, write_rows
from peach.scripting import (
    BACKUP_REQUIRED, add_ledger_write_args, open_for_write, open_readonly,
)
from legacy_values import RULE34VIDEO_RESULTS, RULE34VIDEO_WRITTEN

FIELDS = ("item_id", "external_id", "result", "characters", "written", "note")
DEFAULT_DELAY = VIDEO_DELAY
FLUSH_EVERY = 50
#: 续跑跳过的结果：写过的，以及问过确认没有要改的、站方已经删了的。
SETTLED = frozenset({UNCHANGED, GONE})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=t("backfill_rule34video_characters.description"))
    add_ledger_write_args(parser)
    parser.add_argument("--out", type=Path,
                        default=GENERATED_DIR / "rule34video-character-backfill.csv")
    parser.add_argument("--limit", type=int, default=0, help=t("backfill_rule34video_characters.limitHelp"))
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY)
    parser.add_argument("--resume", action="store_true",
                        help=t("backfill_rule34video_characters.resumeHelp"))
    return parser


def settled_ids(path: Path) -> set[int]:
    """上一趟问定的条目：写过的，或确认没有要改的；旧版日志的中文取值先归一。"""
    return {int(row["item_id"]) for row in read_rows(path, missing_ok=True)
            if settled(row) and str(row.get("item_id") or "").isdigit()}


def settled(row: dict) -> bool:
    written, result = str(row.get("written") or ""), str(row.get("result") or "")
    return (RULE34VIDEO_WRITTEN.get(written, written) == YES
            or RULE34VIDEO_RESULTS.get(result, result) in SETTLED)


def pending_rows(connection: sqlite3.Connection, limit: int,
                 done: set[int] = frozenset()) -> list[dict]:
    """待问条目：`follow_backfill.video_pending`，扣掉上一趟问定的。"""
    return video_pending(connection, limit, done)


def _apply(writer: sqlite3.Connection, item_id: int, characters: list[str]) -> bool:
    """一条一个写事务；重读与改记在 `follow_backfill.apply_characters` 里。"""
    writer.execute("BEGIN IMMEDIATE")
    changed = apply_characters(writer, item_id, characters) is not None
    writer.commit()
    return changed


def inspect_row(connector, row: dict) -> tuple[dict, list[str]]:
    """问一条详情页（`follow_backfill.inspect_video`），固定原因换成界面语言。"""
    entry, names = inspect_video(connector, row)
    if entry["note"] in NOTES:
        entry["note"] = t(f"backfill_rule34video_characters.{entry['note']}")
    return entry, names


def run(args: argparse.Namespace) -> int:
    if args.apply and not args.backup:
        print(BACKUP_REQUIRED, file=sys.stderr)
        return 2
    done = settled_ids(args.out) if args.resume else set()
    previous = [row for row in read_rows(args.out, missing_ok=True)
                if int(row.get("item_id") or 0) in done] if args.resume else []
    for row in previous:
        row["written"] = RULE34VIDEO_WRITTEN.get(row.get("written") or "", row.get("written") or "")
        row["result"] = RULE34VIDEO_RESULTS.get(row.get("result") or "", row.get("result") or "")
    reader = open_readonly(args.db)
    rows = pending_rows(reader, args.limit, done)
    print(t("backfill_rule34video_characters.pending", done=len(done), pending=len(rows)),
          flush=True)
    if not rows:
        reader.close()
        return 0
    writer: sqlite3.Connection | None = None
    before = 0
    if args.apply:
        writer = open_for_write(args)
        writer.isolation_level = None
        writer.execute("PRAGMA busy_timeout=60000")
        print(t("backfill_rule34video_characters.backup", backup=args.backup), flush=True)
        before = writer.execute("SELECT COUNT(*) FROM follow_item").fetchone()[0]

    connector = build_connector("rule34video")
    log: list[dict] = []
    counts = {FOUND: 0, UNCHANGED: 0, MISSED: 0, SKIPPED: 0, GONE: 0, "names": 0}
    limited = 0
    next_request = 0.0

    def flush() -> None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        write_rows(args.out, FIELDS, previous + log, atomic=True)

    stopped = False
    for index, row in enumerate(rows, 1):
        time.sleep(max(0.0, next_request - time.monotonic()))
        next_request = time.monotonic() + args.delay
        try:
            entry, names = inspect_row(connector, row)
            limited = 0
        except FollowSourceRateLimited as error:
            limited += 1
            if limited >= VIDEO_RATE_LIMIT_STOP:
                print(t("backfill_rule34video_characters.stopped", limited=limited, index=index),
                      flush=True)
                stopped = True
                break
            wait = max(VIDEO_COOLDOWN, float(error.retry_after or 0))
            print(t("backfill_rule34video_characters.cooldown", wait=f"{wait:.0f}"), flush=True)
            time.sleep(wait)
            continue
        counts[entry["result"]] += 1
        if names:
            counts["names"] += len(names)
            if writer is not None and _apply(writer, row["id"], names):
                entry["written"] = YES
        log.append(entry)
        if index % FLUSH_EVERY == 0:
            flush()
            print(t("backfill_rule34video_characters.progress", index=index, total=len(rows), found=counts[FOUND], names=counts['names'], unchanged=counts[UNCHANGED], missing=counts[MISSED]), flush=True)
    flush()
    reader.close()
    summary = (t("backfill_rule34video_characters.summary", found=counts[FOUND], names=counts['names'], unchanged=counts[UNCHANGED], missing=counts[MISSED], skipped=counts[SKIPPED] + counts[GONE], out=args.out))
    if writer is None:
        print(t("backfill_rule34video_characters.dryRun", summary=summary), flush=True)
        return 1 if stopped else 0
    after = writer.execute("SELECT COUNT(*) FROM follow_item").fetchone()[0]
    writer.close()
    # 条数必须不变：这一趟只改已有条目的一列。
    print(t("backfill_rule34video_characters.written", summary=summary, before=before, after=after), flush=True)
    return 0 if before == after and not stopped else 1


def main(argv: list[str] | None = None) -> int:
    return run(build_parser().parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main())
