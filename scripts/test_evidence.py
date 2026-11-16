"""本机测试证据：代码内容、依赖环境和验证范围共同决定有效性。"""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import math
import os
import platform
import re
import shutil
import stat
import subprocess
import sys
import time
import uuid
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from filelock import FileLock, Timeout
if str(Path(__file__).resolve().parents[1] / "src") not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from peach.interface_text import dev as t, list_separator, local_language  # noqa: E402

from . import change_impact, test_environment_identity


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-c", f"safe.directory={root.as_posix()}", "-C", str(root), *args],
        capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout.strip()


def evidence_dir(root: Path) -> Path:
    common = Path(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    return common.parent / "build" / "agent-verification"


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


_STATE = re.compile(r"[0-9a-f]{64}")
VALID_SECONDS = 86400


def manifest(root: Path) -> dict:
    names = git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
    stages = git(root, "ls-files", "--stage", "-z").split("\0")
    modes = {entry.split("\t", 1)[1]: entry.split(" ", 1)[0] for entry in stages if "\t" in entry}
    # 未跟踪文件按 Git 的 filemode 策略预估暂存模式，暂存本身不使内容记录失效。
    policy = git(root, "config", "--get", "--default", "true", "core.filemode") == "true"
    files, signatures = {}, {}
    for name in sorted(set(names.split("\0")) - {""}):
        path = root / name
        if path.is_symlink():
            files[name] = "link:" + os.readlink(path)
        elif path.is_file():
            content = path.read_bytes()
            mode = stat.S_IMODE(path.stat().st_mode)
            index_mode = modes.get(name, "100755" if policy and mode & 0o111 else "100644")
            files[name] = [mode, hashlib.sha256(content).hexdigest(), index_mode]
            if name.endswith(".py") or name in {*change_impact.PACKAGE_FILES, "pyproject.toml", change_impact.REGISTRY}:
                try:
                    signatures[name] = change_impact.signatures(name, content.decode("utf-8"))
                except UnicodeError:
                    pass
        elif not path.exists():
            continue
        else:
            raise ValueError(t("test_evidence.snapshotFailed", name=name))
    version = root / "src/peach/__init__.py"
    body = version.read_text(encoding="utf-8") if version.is_file() else ""
    body = re.sub(r'(?m)^__version__ = "\d+\.\d+\.\d+"$', '__version__ = "VERSION"', body)
    return {"files": files, "signatures": signatures, "version_body": digest(body)}


def snapshot(root: Path) -> str:
    return digest(manifest(root))


def interpreter(root: Path) -> Path:
    suffix = Path("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    local = root / ".venv" / suffix
    if local.is_file():
        return local.absolute()
    common = Path(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    shared = common.parent / ".venv" / suffix
    return shared.absolute() if shared.is_file() else Path(sys.executable).absolute()


@lru_cache(maxsize=16)
def python_identity(executable: str, stamp: int) -> dict:
    return json.loads(subprocess.run(
        [executable, "-c", "import json,sys,site,sysconfig,pathlib; "
         "library=pathlib.Path(sysconfig.get_config_var('LIBDIR') or pathlib.Path(sys._base_executable).parent)"
         "/(sysconfig.get_config_var('LDLIBRARY') or 'python'+str(sys.version_info.major)+str(sys.version_info.minor)+'.dll'); "
         "print(json.dumps({'version':sys.version,'sites':site.getsitepackages(),"
         "'implementation':sys.implementation.name,'cache_tag':sys.implementation.cache_tag,"
         "'base_executable':sys._base_executable,'library':str(library) if library.is_file() else None}))"],
        check=True, capture_output=True, text=True, encoding="utf-8").stdout)


#: 外部工具的版本探针。工具身份取它自报的版本，不取 PATH 解析到的路径和文件字节：
#: 同一套 Git 安装在 PowerShell 里解析到 `Git\cmd\git.exe`、在 Git Bash 里解析到
#: `Git\mingw64\bin\git.exe`，两个前端字节不同、版本相同、行为也相同。按路径记身份的
#: 后果是记录绑在 shell 上——在一个 shell 里跑出记录，在另一个 shell 里 `integrate`
#: 就报「缺少有效测试记录」，而回到工作树跑 `auto` 又说「复用记录」，两句查的是两个键。
#: 探针只用最短的那条：`openssl version -a` 会连 OPENSSLDIR 一起打出来，那又是路径。
TOOL_PROBES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("uv", ("--version",)),
    ("node", ("--version",)),
    ("npm", ("--version",)),
    ("git", ("--version",)),
    ("ffmpeg", ("-version",)),
    ("ffprobe", ("-version",)),
    ("openssl", ("version",)),
)

#: 探到、但不进环境指纹的工具。uv 只负责建环境，装出来的解释器与包已经逐个进了指纹；
#: 把它自己的版本也记进去，winget 每升一次 uv 就让全部测试记录同时失效，而被验证的
#: 那套环境一个字节都没变。它仍然参与探针，启动受限时照样报得出来。
FINGERPRINT_EXCLUDED = ("uv",)


@lru_cache(maxsize=32)
def tool_identity(executable: str, stamp: int, probe: tuple[str, ...]) -> str:
    """工具自报的版本摘要。`stamp` 只用于让缓存跟着文件改动失效。

    非零退出码连着输出一起进摘要：探针不成立的工具彼此仍要能区分开，那本身就是环境差异。
    """
    try:
        done = subprocess.run([executable, *probe], capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=60)
    except (OSError, subprocess.SubprocessError):
        return "unspawnable"
    return digest([done.returncode, done.stdout.strip(), done.stderr.strip()])


def tool_identities() -> dict[str, str | None]:
    """PATH 上外部工具的可执行身份；存在但启动受限时明确记作 unspawnable。"""
    tools = {}
    for name, probe in TOOL_PROBES:
        executable = shutil.which(name)
        if not executable and name == "openssl" and sys.platform == "win32":
            bundled = Path("C:/Program Files/Git/usr/bin/openssl.exe")
            executable = str(bundled) if bundled.is_file() else None
        if not executable:
            tools[name] = None
            continue
        try:
            stamp = Path(executable).stat().st_mtime_ns
        except OSError:
            stamp = 0
        tools[name] = tool_identity(executable, stamp, probe)
    return tools


def unspawnable_tools() -> tuple[str, ...]:
    """返回能解析到路径、但当前进程权限无法启动的外部工具。"""
    return tuple(name for name, identity in tool_identities().items()
                 if identity == "unspawnable")


def environment(root: Path) -> str:
    tools = {name: identity for name, identity in tool_identities().items()
             if name not in FINGERPRINT_EXCLUDED}
    # 同一个目录可在 sys.path 中出现多次；依赖身份取集合，版本变化仍改变指纹。
    python = interpreter(root)
    identity = python_identity(str(python), python.stat().st_mtime_ns)
    installed = test_environment_identity.package_identity(
        importlib.metadata.distributions(path=identity["sites"]))
    node_lock = root / "frontend/node_modules/.package-lock.json"
    return digest({
        "schema": 8, "python": test_environment_identity.runtime_identity(identity, python),
        "platform": platform.platform(), "packages": installed, "tools": tools,
        "node_modules": test_environment_identity.install_identity(node_lock),
        "browser": test_environment_identity.file_identity(test_environment_identity.chrome_executable()),
        # 测试入口强制设置防外发标记与本次运行独占的临时目录；入口源码已进快照，它们不是调用方
        # 选择的运行环境。临时目录每次都是新路径，算进来的话签出的记录键在 ready 时永远对不上。
        "flags": test_environment_identity.environment_flags(),
    })


def key(root: Path) -> str:
    return digest([snapshot(root), environment(root)])


def inputs(root: Path) -> dict:
    content, dependencies = manifest(root), environment(root)
    return {"manifest": content, "environment": dependencies,
            "state": digest([digest(content), dependencies])}


def recent_records(folder: Path, limit: int | None = None) -> list[Path]:
    """最近写入的测试记录。同目录还有持锁说明 `*.lock.holder.json`，名字不是 state 摘要，
    不算记录；记录和说明都会被别的进程随时删掉，列出后才消失的文件跳过。"""
    found = []
    for path in folder.glob("*.json"):
        if not _STATE.fullmatch(path.stem):
            continue
        try:
            found.append((path.stat().st_mtime, path))
        except FileNotFoundError:
            continue
    ordered = sorted(found, reverse=True)
    return [path for _, path in (ordered[:limit] if limit is not None else ordered)]


def baselines(root: Path, current: dict, *, partial: bool = False):
    for path in recent_records(evidence_dir(root)):
        record = read(root, path.stem)
        if not (record.get("passed") or (partial and record.get("coverage"))) \
                or (not partial and "full" not in record["passed"]) \
                or record.get("environment") != current["environment"]:
            continue
        old = record.get("manifest", {})
        new = current["manifest"]
        if not isinstance(old.get("files"), dict):
            continue
        changed = sorted(name for name in old["files"].keys() | new["files"].keys()
                         if old["files"].get(name) != new["files"].get(name))
        version = "src/peach/__init__.py"
        version_only = version in changed and change_impact.version_only(old, new)
        if version_only:
            changed.remove(version)
        yield record, changed, version_only


def prune_expired(folder: Path, now: float | None = None) -> int:
    """清退过期的记录、持锁说明和写到一半的临时文件，返回删掉的个数。

    判据是文件修改时间超过有效期。记录里的每个时间戳都不晚于写盘时刻，所以这样的记录已经
    没有可复用的域或文件结果，失败记录的 `failed_scopes` 也照样保留满一个有效期。
    `<state>.lock` 不在此列：POSIX 加锁不刷新修改时间，删掉一把正被持有的旧锁会破坏互斥。
    """
    now = time.time() if now is None else now
    removed = 0
    for path in folder.glob("*"):
        if path.suffix not in {".json", ".tmp"} or not _STATE.fullmatch(path.name.partition(".")[0]):
            continue
        try:
            if path.is_file() and now - path.stat().st_mtime >= VALID_SECONDS:
                path.unlink()
                removed += 1
        except OSError:
            continue
    return removed


def read(root: Path, state: str) -> dict:
    try:
        record = json.loads((evidence_dir(root) / f"{state}.json").read_text(encoding="utf-8"))
        if (not isinstance(record, dict) or not isinstance(record.get("validated"), dict)
                or not isinstance(record.get("coverage", {}), dict)
                or not valid_manifest(record.get('manifest'))
                or not isinstance(record.get("environment"), str)
                or not isinstance(record.get('units', {}), dict)
                or not valid_record_fields(record)):
            return {}
        expected = digest([digest(record['manifest']), record['environment']])
        if record.get("state") == state == expected:
            record["passed"] = [scope for scope, stamp in record["validated"].items()
                                if isinstance(stamp, (float, int)) and 0 <= time.time() - stamp < VALID_SECONDS]
            record["coverage"] = {name: stamp for name, stamp in record.get("coverage", {}).items()
                                  if isinstance(stamp, (float, int)) and 0 <= time.time() - stamp < VALID_SECONDS}
            units = live_units(record.get('units', {}))
            if units is None:
                return {}
            record['units'] = units
            return record
    except (OSError, ValueError, KeyError, TypeError, RecursionError):
        pass
    return {}


def valid_record_fields(record) -> bool:
    scopes = record.get('failed_scopes', [])
    cohort = record.get('cohort')
    finished = record.get('finished', 0)
    return (isinstance(scopes, list) and all(isinstance(scope, str) for scope in scopes)
            and all(isinstance(scope, str) for scope in record['validated'])
            and (cohort is None or isinstance(cohort, str) and bool(_STATE.fullmatch(cohort)))
            and type(finished) in (int, float) and math.isfinite(finished))


def valid_manifest(manifest) -> bool:
    if not isinstance(manifest, dict) or not isinstance(manifest.get('files'), dict):
        return False
    if not isinstance(manifest.get('signatures', {}), dict):
        return False
    for name, value in manifest['files'].items():
        if not isinstance(name, str):
            return False
        if isinstance(value, str) and (value == 'deleted' or value.startswith('link:')):
            continue
        if (not isinstance(value, list) or len(value) != 3 or type(value[0]) is not int
                or not isinstance(value[1], str) or not _STATE.fullmatch(value[1])
                or value[2] not in {'100644', '100755'}):
            return False
    return all(isinstance(name, str) and isinstance(value, dict)
               and all(isinstance(key, str) and (
                           key == 'registry' and name == change_impact.REGISTRY
                           and change_impact.valid_registry(stamp)
                           or isinstance(stamp, str) and _STATE.fullmatch(stamp))
                       for key, stamp in value.items())
               for name, value in manifest.get('signatures', {}).items())


def live_units(units: dict) -> dict | None:
    now, kept = time.time(), {}
    for name, row in units.items():
        if (not isinstance(name, str) or not isinstance(row, dict)
                or row.get('outcome') not in {'pass', 'fail', 'unknown'}
                or type(row.get('at')) not in (int, float) or not math.isfinite(row['at'])):
            return None
        if 0 <= now - row['at'] < VALID_SECONDS:
            kept[name] = row
    return kept


def candidates(root: Path, current: dict):
    """同环境的有效记录，包括需要继续阻止旧结果复活的失败记录。"""
    for path in recent_records(evidence_dir(root)):
        record = read(root, path.stem)
        if record.get('environment') == current['environment']:
            yield record


def covers(record: dict, scopes: tuple[str, ...]) -> bool:
    passed = set(record.get("passed", ()))
    return "full" in passed or set(scopes).issubset(passed)


def write(root: Path, state: str, scopes: tuple[str, ...], *, success: bool,
          elapsed: float, slowest: list, count: int, previous: dict | None = None,
          context: dict | None = None, baseline: dict | None = None,
          cohort: str | None = None, coverage: dict | None = None, flaky: list | None = None,
          units: dict | None = None, phases: dict | None = None) -> None:
    folder = evidence_dir(root)
    folder.mkdir(parents=True, exist_ok=True)
    prior = previous if previous is not None else read(root, state)
    failed = set(prior.get("failed_scopes", ()))
    if success:
        failed = set() if "full" in scopes else failed - set(scopes)
    else:
        failed.update(scopes)
    validated = dict(prior.get("validated", {}))
    if not success:
        validated = {scope: stamp for scope, stamp in validated.items()
                     if "full" not in scopes and scope != "full" and scope not in scopes}
    if success:
        if baseline:
            validated.update(baseline["validated"])
        validated.update({scope: time.time() for scope in scopes})
    record = {**(context or inputs(root)), "state": state, "validated": validated, "finished": time.time(),
              "cohort": cohort, "coverage": coverage or {},
              'units': ({} if scopes else prior.get('units', {})) if units is None else units,
              "baseline": baseline.get("state") if baseline else None,
              "failed_scopes": sorted(failed),
              "elapsed": elapsed, "count": count, "slowest": slowest, "phases": dict(phases or {}),
              # 全量里失败、单独重跑通过的用例；记录照样算通过，但名字留在这里可查。
              "flaky": list(flaky or [])}
    temporary = folder / f"{state}.{os.getpid()}.tmp"
    temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(folder / f"{state}.json")
    prune_expired(folder)


def holder_path(lock_path: Path) -> Path:
    return lock_path.with_name(lock_path.name + ".holder.json")


QUEUE_POLL_SECONDS = 0.1
#: 没有 psutil 判不了票主是否还活着时，票的最长寿命。
QUEUE_TICKET_SECONDS = 7200


def queue_path(lock_path: Path) -> Path:
    return lock_path.with_name(lock_path.name + ".queue")


def _process_started(pid: int) -> float | None:
    try:
        import psutil
    except ImportError:
        return None
    try:
        return psutil.Process(pid).create_time()
    except psutil.Error:
        return -1.0


def process_alive(note: dict, now: float) -> bool:
    """记录里的进程还在；同一 pid 被别的进程复用时创建时刻对不上，算已退出。

    `note` 是票或持有记录：`pid`、`created` 与 `process_started`。读不出字段时抛 KeyError、ValueError 或 TypeError。"""
    pid, created = int(note["pid"]), float(note["created"])
    started = _process_started(pid)
    if started is None:
        return now - created < QUEUE_TICKET_SECONDS
    recorded = note.get("process_started")
    return started >= 0 and (not isinstance(recorded, (int, float)) or abs(started - recorded) < 1)


def _ticket_alive(path: Path, now: float) -> bool:
    """票主进程还在就算活票。"""
    try:
        return process_alive(json.loads(path.read_text(encoding="utf-8")), now)
    except FileNotFoundError:
        return False
    except (OSError, ValueError, KeyError, TypeError):
        # 写到一半或正被别的进程读写：先当它还在，下一轮再看。
        return True


def take_ticket(lock_path: Path, **note: object) -> Path:
    """在 `<锁>.queue/` 里放一张以纳秒时刻开头的排队票，返回票的路径。"""
    queue = queue_path(lock_path)
    ticket = queue / f"{time.time_ns():020d}-{os.getpid()}-{uuid.uuid4().hex[:8]}.json"
    pending = ticket.with_suffix(".tmp")
    content = json.dumps({"pid": os.getpid(), "created": time.time(),
                          "process_started": _process_started(os.getpid()),
                          "started_at": time.strftime("%Y-%m-%d %H:%M:%S"), **note},
                         ensure_ascii=False, default=str)
    for attempt in range(3):
        # 队列空了的那一刻，撤票的人会顺手删掉目录；碰上就重建再写。
        queue.mkdir(parents=True, exist_ok=True)
        try:
            pending.write_text(content, encoding="utf-8")
            pending.replace(ticket)
            break
        except FileNotFoundError:
            if attempt == 2:
                raise
    return ticket


def drop_ticket(ticket: Path) -> None:
    """撤票；队列空了顺手删掉目录。"""
    ticket.unlink(missing_ok=True)
    try:
        ticket.parent.rmdir()
    except OSError:
        # 还有别人在排队，目录留给他们。
        pass


def tickets_ahead(lock_path: Path, mine: str) -> list[Path]:
    """排在 `mine` 前面的活票，按到达先后；死票顺手清掉。"""
    now, ahead = time.time(), []
    for path in sorted(queue_path(lock_path).glob("*.json")):
        if path.name >= mine:
            break
        if _ticket_alive(path, now):
            ahead.append(path)
        else:
            path.unlink(missing_ok=True)
    return ahead


@contextmanager
def held(lock_path: Path, *, wait_seconds: float = 0, **note: object):
    """拿锁，并在旁边留下「谁在持有」的记录，让等锁的人知道在等什么。

    互斥只靠 filelock：锁是操作系统层面的句柄，只能被活着的进程持有，进程退出就释放。
    记录是旁证，不参与互斥。持有者正常退出就删掉它；异常退出留下的旧记录会被下一位
    持有者进门时覆盖，而等锁那一侧只在锁真的被占着时才去读，所以读到的总是当前持有者。

    等锁按到达先后排队：每个等待者在 `<锁>.queue/` 里放一张以纳秒时刻开头的票，只有前面
    没有活票时才去抢锁，拿到就撤票。没有排队时，锁一空出来谁轮询得快谁拿到，几个会话轮番
    抢的结果是有人连等几轮、满 30 分钟退出。票主进程退出后它的票由后面的人清掉。
    """
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock = FileLock(lock_path)
    ticket = take_ticket(lock_path, **note)
    deadline = time.monotonic() + max(wait_seconds, 0)
    announced = None
    try:
        while True:
            ahead = tickets_ahead(lock_path, ticket.name)
            if not ahead:
                try:
                    lock.acquire(timeout=0)
                    break
                except Timeout:
                    pass
            if wait_seconds <= 0 or time.monotonic() >= deadline:
                raise Timeout(str(lock_path))
            if announced != len(ahead):
                announced = len(ahead)
                place = t("test_evidence.queueAhead", count=announced) if announced else ""
                limit = t("test_evidence.waitLimit", seconds=f"{wait_seconds:g}") if math.isfinite(wait_seconds)                     else t("test_evidence.waitQueued")
                print(t("test_evidence.waiting", lock=lock_path.name, holder=describe_holder(lock_path), place=place,
                        limit=limit), file=sys.stderr, flush=True)
            time.sleep(min(QUEUE_POLL_SECONDS, max(0.0, deadline - time.monotonic())))
    finally:
        drop_ticket(ticket)
    try:
        record = holder_path(lock_path)
        record_lock = FileLock(record.with_suffix(".lock"), timeout=5)
        with record_lock:
            record.write_text(json.dumps({
                "pid": os.getpid(),
                "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                **note,
            }, ensure_ascii=False), encoding="utf-8")
        try:
            yield
        finally:
            with record_lock:
                record.unlink(missing_ok=True)
    finally:
        lock.release()


def describe_holder(lock_path: Path) -> str:
    """等锁时打印用：`pid 8772、01:54:39 起、scope full、root C:\\…`。"""
    try:
        record = holder_path(lock_path)
        with FileLock(record.with_suffix(".lock"), timeout=1):
            note = json.loads(record.read_text(encoding="utf-8"))
    except Timeout:
        return t("test_evidence.holderUnknown")
    except (OSError, ValueError):
        return t("test_evidence.holderGone")
    parts = [f"pid {note.get('pid')}", t("test_evidence.holderSince", time=note.get('started_at'))]
    parts.extend(f"{key} {note[key]}" for key in ("scope", "branch", "root") if note.get(key))
    return list_separator(local_language()).join(parts)


def run_lock(repo: Path, state: str, **note: object):
    return held(evidence_dir(repo) / f"{state}.lock", **note)
