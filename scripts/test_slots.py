"""整机测试名额：几个工作树、几个会话同时跑测试时按名额排队，不让整机被压满（ADR-0172）。

名额是锁目录里的 `slot-<n>.lock`，所有工作树与检出共用一个目录。`auto` 与含浏览器用例的定向调试占 1 个，
全量从 1 号起按顺序逐个取满全部名额。占名额靠操作系统的文件锁，进程退出（含被强行结束）就自动释放；
旁边的持有记录只用来告诉等待者谁占着，进程已退出或 pid 被复用的记录不算数。

排队复用 `test_evidence` 的票：等待者在 `slots.lock.queue/` 里放一张以纳秒时刻开头的票，只有排在最前面的
才去取名额，全量取到一部分时也留着票，后来的 `auto` 不能插到它前面。
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
from contextlib import contextmanager
from pathlib import Path

from filelock import FileLock, Timeout

from . import test_evidence
from .test_evidence import t

#: 名额数。各会话应使用同一个值；不进测试记录的环境指纹。
SLOTS_VARIABLE = "PEACH_TEST_SLOTS"
#: 持有名额的运行把自己的 pid 写进这个变量，它派出的分片与隔离重跑看到就不再排队，免得自己等自己。
HELD_VARIABLE = "PEACH_TEST_SLOTS_HELD"
DEFAULT_SLOTS = 2
#: 定向调试不含浏览器用例、且只点了这么多个测试文件以内时不占名额。
FOCUS_FREE_FILES = 10
#: 默认一直排队、按先后取；只有 `machine_lock.py --wait` 这类显式时限才会超时退出。
WAIT_SECONDS = math.inf
REPORT_SECONDS = 60
POLL_SECONDS = 0.2


class SlotTimeout(Exception):
    """等满时限仍没取得所需名额。"""


def slot_dir() -> Path:
    """整机共用的名额目录，不随工作树或检出变化。

    不放进应用自己的 `%LOCALAPPDATA%\\Peach`：那是已装 Peach 的目录，测试设施不往里写。"""
    base = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "state")
    return Path(base) / "peach-test-locks" / "slots"


def slot_count(environ=None) -> int:
    raw = (os.environ if environ is None else environ).get(SLOTS_VARIABLE, "").strip()
    if not raw:
        return DEFAULT_SLOTS
    if not raw.isdigit() or int(raw) < 1:
        raise ValueError(t("test_slots.badCount", variable=SLOTS_VARIABLE, value=raw))
    return int(raw)


def exempt(environ=None) -> bool:
    """CI 每个作业一台机器，不排队；父进程已持有名额时，子进程沿用。"""
    values = os.environ if environ is None else environ
    return values.get("CI") == "true" or bool(values.get(HELD_VARIABLE))


def focus_needs_slot(selectors: list[str]) -> bool:
    """定向调试是否占名额：含浏览器用例，或点到的测试文件超过 `FOCUS_FREE_FILES` 个。"""
    parts = {part.strip() for value in selectors for part in value.split(",") if part.strip()}
    if any(part.startswith("frontend/e2e/") for part in parts):
        return True
    files = {part if part.startswith("frontend/") else part.removeprefix("tests/").removesuffix(".py").split(".")[0]
             for part in parts}
    return len(files) > FOCUS_FREE_FILES


def _slot_path(folder: Path, number: int) -> Path:
    return folder / f"slot-{number}.lock"


def _take(folder: Path, total: int, need: int, taken: list[FileLock]) -> None:
    """要 1 个时取任意空闲名额；要多个时从 1 号起按顺序取，前一个没到手不碰后一个，两个全量不会互相卡住。"""
    numbers = range(1, total + 1) if need == 1 else range(len(taken) + 1, need + 1)
    for number in numbers:
        lock = FileLock(_slot_path(folder, number))
        try:
            lock.acquire(timeout=0)
        except Timeout:
            if need == 1:
                continue
            return
        taken.append(lock)
        if len(taken) == need:
            return


def holders(folder: Path, total: int, now: float | None = None) -> list[dict]:
    """当前还活着的名额持有者，按名额编号。"""
    now = time.time() if now is None else now
    found = []
    for number in range(1, total + 1):
        try:
            note = json.loads(test_evidence.holder_path(_slot_path(folder, number)).read_text(encoding="utf-8"))
            if test_evidence.process_alive(note, now):
                found.append({**note, "slot": number})
        except (OSError, ValueError, KeyError, TypeError):
            continue
    return found


def describe(folder: Path, total: int, need: int, ahead: int, remaining: float, now: float | None = None) -> str:
    """等待提示：要几个、前面排几个、谁占着、各自跑了多久。"""
    now = time.time() if now is None else now
    place = t("test_evidence.queueAhead", count=ahead) if ahead else ""
    head = t("test_slots.waiting", need=need, total=total, place=place)
    if math.isfinite(remaining):
        head += t("test_slots.waitLimit", minutes=max(1, round(remaining / 60)))
    lines = [head]
    found = holders(folder, total, now)
    for note in found:
        lines.append("  " + t("test_slots.holder", slot=note["slot"], scope=note.get("scope") or "?", pid=note["pid"],
                       root=note.get("root") or "?", since=note.get("started_at") or "?",
                       minutes=max(0, int((now - float(note["created"])) // 60))))
    if not found:
        lines.append("  " + t("test_slots.holdersUnknown"))
    return "\n".join(lines)


def _publish(taken: list[FileLock], note: dict) -> list[Path]:
    records = []
    for lock in taken:
        record = test_evidence.holder_path(Path(lock.lock_file))
        pending = record.with_suffix(".tmp")
        try:
            pending.write_text(json.dumps(note, ensure_ascii=False), encoding="utf-8")
            pending.replace(record)
            records.append(record)
        except OSError:
            # 记录只是旁证；正被别人读着写不进去时，等待者看到的是「信息暂未取得」。
            pending.unlink(missing_ok=True)
    return records


def _wait(folder: Path, total: int, need: int, ticket: Path, wait_seconds: float, report_seconds: float,
          taken: list[FileLock]) -> None:
    anchor = folder / "slots.lock"
    deadline = time.monotonic() + max(wait_seconds, 0)
    next_report = time.monotonic()
    while True:
        ahead = test_evidence.tickets_ahead(anchor, ticket.name)
        if not ahead:
            _take(folder, total, need, taken)
            if len(taken) == need:
                return
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise SlotTimeout(t("test_slots.timedOut", minutes=f"{wait_seconds / 60:g}"))
        if time.monotonic() >= next_report:
            print(describe(folder, total, need, len(ahead), remaining), file=sys.stderr, flush=True)
            next_report = time.monotonic() + report_seconds
        time.sleep(min(POLL_SECONDS, remaining))


@contextmanager
def held(need: int, *, total: int, scope: str, root: str, folder: Path | None = None,
         wait_seconds: float = WAIT_SECONDS, report_seconds: float = REPORT_SECONDS):
    """按到达先后排队取 `need` 个名额，持有期间把本进程 pid 写进 `HELD_VARIABLE`。"""
    folder = slot_dir() if folder is None else folder
    folder.mkdir(parents=True, exist_ok=True)
    need = max(1, min(need, total))
    ticket = test_evidence.take_ticket(folder / "slots.lock", scope=scope, root=root, need=need)
    taken: list[FileLock] = []
    try:
        _wait(folder, total, need, ticket, wait_seconds, report_seconds, taken)
    except BaseException:
        for lock in reversed(taken):
            lock.release()
        raise
    finally:
        test_evidence.drop_ticket(ticket)
    # 开始时刻记取到名额的那一刻，等待者看到的「已运行」不含它自己排队的时间。
    records = _publish(taken, {"pid": os.getpid(), "created": time.time(),
                               "process_started": test_evidence._process_started(os.getpid()),
                               "started_at": time.strftime("%Y-%m-%d %H:%M:%S"), "scope": scope, "root": root})
    previous = os.environ.get(HELD_VARIABLE)
    os.environ[HELD_VARIABLE] = str(os.getpid())
    try:
        yield [int(Path(lock.lock_file).stem.removeprefix("slot-")) for lock in taken]
    finally:
        if previous is None:
            os.environ.pop(HELD_VARIABLE, None)
        else:
            os.environ[HELD_VARIABLE] = previous
        for record in records:
            record.unlink(missing_ok=True)
        for lock in reversed(taken):
            lock.release()
