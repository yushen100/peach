"""垃圾复核展示、批量决定、物理清除与回收站。

`junk` 提供各流程共用的证据与隔离规则；本模块将评分转成页面数据，并执行用户的
批量决定。自动隔离只进入回收站，永久删除需要独立的确认与取证流程。

物理删除要清的引用表只写在 `personal_records.ASSET_REFERENCE_TABLES` 一处（删行走 `delete_asset_rows`）。本地文件先隔离，
账本失败时可以恢复；rclone FUSE 挂载直接删除，账本失败时保留回收站行供重试。
"""
from __future__ import annotations

import csv
import errno
import hashlib
import json
import logging
import os
import re
import stat
import shutil
import tempfile
import threading
import time
import uuid

from functools import partial
from pathlib import Path, PureWindowsPath
from typing import Sequence

from . import interface_text, junk
from .catalog_rules import duration_clusters, is_jav_code, normalise_code_key
from .catalog_vocabulary import KEEP_DUPLICATES_NOTE, NOT_JUNK_NOTE
from .config import GENERATED_DIR, LOCATION_ROOT_DECLARATIONS
from .field_owners import USER_MANUAL, write_owned_fields
from .media_sources import SCANNABLE_LOCATIONS
from .personal_records import VANISHED, delete_asset_rows
from .platform import is_unmapped, root_online, translate_ledger_path, within_root
from .regions import normalize_region
from .task_runs import TaskRunHandle
from .task_stages import batch_progress
from .web_activity import DEFAULT_PROFILE_ID
from .web_catalog import attach_card_performers
from .media_sources import cost_for
from .os_errors import CodedTimeoutError
from .user_messages import UserFacingError, UserOSError, UserValueError
from .web_resource_sync import _managed_cache_root, clean_purged_caches
from .web_state import WebContract

from .junk import (
    AD_DIRPACK as AD_DIRPACK,
    AD_DOMAIN as AD_DOMAIN,
    AUTO_TRASH_SCORE as AUTO_TRASH_SCORE,
    BUNDLE_DIR_ASSETS as BUNDLE_DIR_ASSETS,
    CONTENT_BYTES as CONTENT_BYTES,
    INTERNET_SHORTCUT_SUFFIXES as INTERNET_SHORTCUT_SUFFIXES,
    JUNK_KINDS as JUNK_KINDS,
    JUNK_REVIEW_SCORE as JUNK_REVIEW_SCORE,
    JUNK_VIDEO_MAX_BYTES as JUNK_VIDEO_MAX_BYTES,
    MEDIA_SIDECAR_SUFFIXES as MEDIA_SIDECAR_SUFFIXES,
    PART_MARK as PART_MARK,
    PROMO_CLUSTER_FILES as PROMO_CLUSTER_FILES,
    PROMO_DOMAIN as PROMO_DOMAIN,
    PROMO_FILLER as PROMO_FILLER,
    PROMO_PHRASE as PROMO_PHRASE,
    REAL_CODE as REAL_CODE,
    has_sibling_original as has_sibling_original,
    promo_residue as promo_residue,
)

LOGGER = logging.getLogger(__name__)

#: 垃圾评分读的账本表。不声明时任何一次提交（关注检查、任务记录）都让下一次打开当场重评
#: 十万行；声明后后台任务的提交先回上一份、后台重算（ADR-0146），前台写入照旧当场重算。
JUNK_SCORE_TABLES = ("asset", "review_decision", "download_task")

# Linux 容器可从 mountinfo 识别媒体实际所在的 FUSE 文件系统。
MOUNTINFO_PATH = Path("/proc/self/mountinfo")

#: 重复组「都保留」记在 `review_decision` 的这一类下，键是保留那一刻组员 id 升序连写。当前组员
#: 都在某一条记录里就算已保留：删掉或失联一份不会让它回来，只有新文件加入才重新列出（做法参考
#: SakuraMedia `608abc0bfb`，改成按子集判）。
DUPLICATE_KEEP_CATEGORY = "duplicate_group"


def duplicate_group_key(ids) -> str:
    return ",".join(str(asset_id) for asset_id in sorted(int(asset_id) for asset_id in ids))


def _kept_member_sets(keys) -> list[frozenset[int]]:
    """把「都保留」记录的键还原成组员集合；认不出的键跳过。"""
    sets = []
    for key in keys:
        try:
            sets.append(frozenset(int(part) for part in str(key).split(",") if part))
        except ValueError:
            continue
    return [members for members in sets if members]


def _covering_keep(members: frozenset[int], kept: list[frozenset[int]]) -> frozenset[int] | None:
    """包含当前全部组员的那条保留记录；没有时取交集最大的一条，用来标出新加入的副本。"""
    best: frozenset[int] | None = None
    for record in kept:
        if members <= record:
            return record
        if len(members & record) >= 2 and (best is None or len(members & record) > len(members & best)):
            best = record
    return best


def q_ads(contract: WebContract, limit=200, offset=0, kind="", status="pending"):
    """疑似垃圾复核队列 —— **不自动删**，只排队让人看证据确认。

    没有可靠的单一判据（试过「同番号短版」会误伤 CD2/part1 分卷，
    试过「同名扩散」会误伤 001.mp4 这类通用名的真文件）。
    所以给的是**嫌疑分**，按分排序，人工看图定夺，确认的走既定 CSV 删除流程。

    2026-08-15 按用户标记的 21 条真广告重新标定：命中推广词本身不算证据，
    要看**剥掉推广词后还剩不剩内容**。三类实测误判据此排除：剧情里的「微信」、
    开头是盗版站域名但正文是真实描述、以及把创作者账号当成番号去比时长。

    2026-09-03 按用户复核的三类结果再调，判据从「只看文件名」扩到**看它的邻居**：
    手游插页靠 `PROMO_FILLER` 与不再补空格的残留计算入队，剩下几个残留仍高的靠
    `PROMO_CLUSTER_FILES`（同目录成群的同类推广名）补齐；同目录资产满
    `BUNDLE_DIR_ASSETS` 的成套资源包不再因整名是域名而入队；文件自己是真番号、
    自己超过 `CONTENT_BYTES`、或是同目录正片的封面／截图时，`AD_DIRPACK` 的目录
    证据不成立——蓝光原盘和它的海报都属于这一类。

    物理资源的类型不能成为免检条件。视频保留时长、体积和同番号长版证据；图片、
    音频、压缩包和其它文件走共用的推广名／推广目录证据；Windows ``.url`` 是网址
    快捷方式，在媒体目录中直接进入人工复核。在线资产不是待清理的物理文件，排除。

    广告包还有一类没有推广词的样本：目录名自曝（`一键约炮`、`-APP`、`論壇文宣`），
    整包只有一条正片加一张配套封面，其余是装饰符小图、品牌推广卡与网页存档。
    这几种形态各自独立计分，配套封面走正片配对豁免，推广目录里的长视频只加 30 分、
    要再叠一条时长或体积证据才到门槛。

    词库 `PROMO_NAMES_FILE` 里的固定命名，以及未探测时长视频的目录与体积证据，只够进队列：
    这部分分数单独凑够 `AUTO_TRASH_SCORE` 时压到线下，须有别的证据或人看过内容才进回收站。"""
    kind = str(kind or "").strip().casefold()
    status = str(status or "pending").strip().casefold()
    if kind and kind not in JUNK_KINDS:
        raise ValueError("invalid junk kind")
    if status not in {"pending", "dismissed"}:
        raise ValueError("invalid junk status")
    out, dismissed_ids = contract.cached_until_changed(
        "junk-scored", lambda: _scored_junk(contract), tables=JUNK_SCORE_TABLES)
    pending = [item for item in out if item["id"] not in dismissed_ids]
    dismissed = [item for item in out if item["id"] in dismissed_ids]
    pool = dismissed if status == "dismissed" else pending
    counts = {junk_kind: 0 for junk_kind in JUNK_KINDS}
    for item in pool:
        counts[item["junk_kind"]] += 1
    filtered = [item for item in pool if not kind or item["junk_kind"] == kind]
    # 缓存里那份是共享的，这一页的条目复制出来再挂演员，不改到下一次请求。
    items = [dict(item) for item in filtered[offset:offset + limit]]
    attach_card_performers(
        contract, [item for item in items if item.get("medium") == "video"])
    return {
        "total": len(filtered),
        "all_total": len(pool),
        "pending_total": len(pending),
        "dismissed_total": len(dismissed),
        "counts": counts,
        "kind": kind,
        "status": status,
        "items": items,
    }


def _scored_junk(contract: WebContract) -> tuple[list[dict], frozenset[int]]:
    """领域评分加上页面需要的成本与缩略图状态，路径留在服务内部。"""
    out, dismissed = junk.scored_candidates(contract)
    for item in out:
        item["cost"] = cost_for(item['location'], item.get('path'))
        item["has_thumb"] = contract.has_snapshot(item.pop("snapshot_path", None))
        item.pop("path", None)
    return out, dismissed


def _restore_staged_media(staged):
    """数据库失败时恢复隔离文件；本地备份带原路径与内容摘要。

    每一项带期限（`media_io.bounded`）：网盘答不上时抛超时，不把请求挂住。
    """
    from . import media_io
    for original, quarantine in reversed(staged):
        media_io.bounded(media_io.mount_key(original), _restore_one, original, quarantine,
                         timeout=media_io.TIMEOUT_SECONDS)


def _restore_one(original, quarantine) -> None:
    if quarantine.exists() and not original.exists():
        manifest = quarantine.parent / 'restore.json'
        if quarantine.name == 'content' and manifest.is_file():
            record = json.loads(manifest.read_text(encoding='utf-8'))
            if record['original'] != str(original):
                raise UserValueError('api.batch.quarantinePathMismatch')
            shutil.copyfile(quarantine, original)
            if hashlib.sha256(original.read_bytes()).hexdigest() != record['sha256']:
                raise UserValueError('api.batch.quarantineContentMismatch')
            quarantine.unlink()
            manifest.unlink()
            quarantine.parent.rmdir()
        else:
            quarantine.rename(original)


def _changed_within_deadline(key, change, undo):
    """带期限地改一次网盘上的文件（隔离改名、删除），超期抛超时。

    卡住的那次改动收不回来，可能过了期限才做成：这时请求已经把这一行记成删不了、账本行留着，
    读取线程做成后自己调 `undo` 撤回（隔离件改名放回原处），文件不会落在隐藏的临时名下。
    做成与放弃在同一把锁下判定，两边不会都以为对方没做。
    """
    from . import media_io
    guard = threading.Lock()
    state = {"abandoned": False, "settled": False, "value": None}

    def attempt():
        value = change()
        with guard:
            if not state["abandoned"]:
                state.update(settled=True, value=value)
                return value
        if undo is not None and value is not None:
            try:
                undo(value)
            except (OSError, ValueError):
                LOGGER.exception("Failed to undo a media change that finished after its deadline")
        return value
    try:
        return media_io.bounded(key, attempt, timeout=media_io.TIMEOUT_SECONDS)
    except TimeoutError:
        with guard:
            if state["settled"]:
                return state["value"]
            state["abandoned"] = True
        raise


def _mountinfo_field(value: str) -> str:
    """解码 mountinfo 中空白字符和反斜杠的八进制转义。"""
    return re.sub(r"\\([0-7]{3})", lambda match: chr(int(match.group(1), 8)), value)


def _is_rclone_mount(path: Path) -> bool:
    """按最深挂载点与覆盖关系识别 rclone 文件系统；不确定时保留隔离流程。"""
    from .smb_media import SmbResource
    if isinstance(path, SmbResource):
        return False
    try:
        lines = MOUNTINFO_PATH.read_text(encoding="utf-8", errors="surrogateescape").splitlines()
    except OSError:
        return False

    target = Path(os.path.abspath(path))
    matches = []
    for line in lines:
        before, separator, after = line.partition(" - ")
        if not separator:
            continue
        fields = before.split()
        filesystem = after.split(maxsplit=1)
        if len(fields) < 5 or not filesystem:
            continue
        try:
            mount_id, parent_id = int(fields[0]), int(fields[1])
        except ValueError:
            continue
        mountpoint = Path(os.path.abspath(_mountinfo_field(fields[4])))
        try:
            target.relative_to(mountpoint)
        except ValueError:
            continue
        matches.append((len(mountpoint.parts), mount_id, parent_id, filesystem[0]))
    if not matches:
        return False
    depth = max(item[0] for item in matches)
    deepest = [item for item in matches if item[0] == depth]
    covered = {item[2] for item in deepest if item[1] != item[2]}
    visible = [item for item in deepest if item[1] not in covered]
    return len(visible) == 1 and visible[0][3] == "fuse.rclone"


def _quarantine_media(original: Path, *, location: str | None = None) -> Path:
    """同目录改名不支持时，小文件先保留本地完整备份再删除原文件。"""
    from .smb_media import SmbResource
    key = uuid.uuid4().hex
    name = (f'peach-purge-{key}.peach-quarantine'
            if location == 'pikpak'
            else f'.{original.name}.peach-purge-{key}.tmp')
    quarantine = original.with_name(name)
    if isinstance(original, SmbResource):
        original.rename(quarantine)
        return quarantine
    try:
        os.rename(original, quarantine)
        return quarantine
    except OSError as error:
        if getattr(error, 'winerror', None) != 50 or original.is_symlink():
            raise
        stat = original.stat()
        if stat.st_size > 1024 * 1024:
            raise
    staging = GENERATED_DIR / 'purge-staging'
    staging.mkdir(parents=True, exist_ok=True)
    folder = Path(tempfile.mkdtemp(prefix='purge-', dir=staging))
    quarantine = folder / 'content'
    manifest = folder / 'restore.json'
    try:
        shutil.copyfile(original, quarantine)
        body = quarantine.read_bytes()
        current = original.stat()
        if len(body) != stat.st_size or (current.st_size, current.st_mtime_ns) != (stat.st_size, stat.st_mtime_ns):
            raise UserOSError("errors.webBatch.changedDuringQuarantine")
        record = dict(original=str(original), size=len(body),
                      sha256=hashlib.sha256(body).hexdigest())
        manifest.write_text(json.dumps(record, ensure_ascii=False), encoding='utf-8')
        original.unlink()
        return quarantine
    except BaseException:
        if original.exists():
            quarantine.unlink(missing_ok=True)
            manifest.unlink(missing_ok=True)
            folder.rmdir()
        raise


def _online_source_roots(online=None) -> dict[str, tuple[Path, ...]]:
    """Return only declared physical roots that can be enumerated now, per source.

    `online(root)` 换掉在线判断，例如交给可终止的读取子进程（`_bounded_online`）；
    不给时在本进程里带期限地问（`_online_within_deadline`）。
    """
    roots: dict[str, tuple[Path, ...]] = {}
    for location, declarations in LOCATION_ROOT_DECLARATIONS.items():
        found = []
        for declaration in declarations:
            from .smb_media import resolve
            remote = resolve(declaration)
            root = remote or translate_ledger_path(declaration)
            if remote is None and is_unmapped(root):
                continue
            if not (online or _online_within_deadline)(root):
                continue
            found.append(root)
        if found:
            roots[location] = tuple(found)
    return roots


def _remove_empty_ancestors(parent: Path, source_roots: Sequence[Path]) -> list[Path]:
    """Remove empty parents up to, but never including, a declared source root."""
    source_root = next(
        (root for root in sorted(source_roots, key=lambda item: len(item.parts), reverse=True)
         if within_root(parent, root)),
        None,
    )
    if source_root is None:
        return []
    removed: list[Path] = []
    current = parent
    while current != source_root and within_root(current, source_root):
        if current.is_symlink():
            break
        next_parent = current.parent
        try:
            current.rmdir()
        except FileNotFoundError:
            # CloudDrive may collapse an empty layer as soon as its last file vanishes.
            current = next_parent
            continue
        except OSError:
            # Non-empty, offline, or protected directories are a normal stop boundary.
            break
        removed.append(current)
        current = next_parent
    return removed


def _remove_empty_ancestors_bounded(parents: Sequence, source_roots: Sequence[Path]) -> list[Path]:
    """`_remove_empty_ancestors` 的同一范围，删除交给可终止的子进程（`media_io.remove_directories`）。

    各级上级目录从深到浅一起交出去：`rmdir` 只删得掉空目录，不空的、目录链接照旧留着，
    下级没删掉时上级自然也不空。网盘上卡住的那个只是没删，剩下的照删。SMB 上的照旧走自己的连接。
    """
    from contextlib import closing

    from . import media_io
    from .smb_media import SmbResource
    removed: list[Path] = []
    targets: set[Path] = set()
    for parent in parents:
        if isinstance(parent, SmbResource):
            removed.extend(_remove_empty_ancestors(parent, source_roots))
            continue
        source_root = next(
            (root for root in sorted(source_roots, key=lambda item: len(item.parts), reverse=True)
             if within_root(parent, root)),
            None,
        )
        current = parent
        while source_root is not None and current != source_root and within_root(current, source_root):
            targets.add(current)
            current = current.parent
    ordered = sorted(targets, key=lambda item: len(item.parts), reverse=True)
    with closing(media_io.remove_directories(ordered)) as results:
        removed.extend(Path(path) for path, result in results if result == "removed")
    return removed


def purge_vanished_rows(contract: WebContract, rows) -> dict:
    """永久删除文件已不在盘上的这些行，连同引用与派生产物；返回 `_finish_purge` 的回执。

    带个人记录的在库行到不了这里：资源同步先把它们标「已消失」（ADR-0087）。

    `missing_only`：到了删的这一刻文件又在了（复核之后网盘才同步回来），这一行整条
    跳过进 `blocked`，媒体文件一个字节都不碰。这一批要删的只是账本行。
    """
    contract.cache_bust()
    return _finish_purge(_purge_outside_lock(contract, rows, missing_only=True), contract, bounded=True)


def _purge_outside_lock(contract: WebContract, rows, *, missing_only: bool = False,
                        eligible=None, verify=None) -> dict:
    """网盘上的 stat 与隔离在写事务外做（`stage_purge`），开事务复核后删行（`commit_purge`）。

    `verify(connection)` 在同一事务里先跑，用来核对调用方的前提（删除清单的口令）；抛错就整批
    放弃，隔离文件全部放回。返回已提交、尚未 `_finish_purge` 的回执。
    """
    outcome = stage_purge(rows, missing_only=missing_only)
    try:
        with contract.write_transaction() as connection:
            if verify is not None:
                verify(connection)
            commit_purge(connection, outcome, eligible=eligible)
    except BaseException:
        _restore_staged_media(outcome["_staged"])
        raise
    return outcome


def _purge_receipt(contract: WebContract, outcome: dict, **fields) -> dict:
    """删完之后的回执：清隔离件、放回复核没过的、只清这几部的派生产物。"""
    purged = outcome.get("_codes", [])
    result = {"ok": True, **fields, **_finish_purge(outcome, contract)}
    result.update(clean_purged_caches(contract, purged))
    return result


def _finish_purge(outcome, contract=None, *, bounded: bool = False):
    """Delete committed quarantine files; report any residue for explicit cleanup.

    同时撤下钉着这些资产的资料候选（#486）。撤不成不影响删除结果：复核页按路径改挂或剔掉
    悬空行；处理任务正拿着候选表时，它下一次写表也可能把这几行写回去。

    事务里复核没过、没删的行（`commit_purge`），它们的隔离文件在这里放回原处。

    删隔离件、放回隔离件都带期限，答不上的进 `cleanup_pending`；删空的上级目录交给可终止的
    子进程（`media_io.remove_directories`）。`bounded`：来源在线判断也交给子进程（只删账本行的
    那一批用）；不给时在本进程里带期限地问。
    """
    _restore_staged_media(outcome.pop("_returned", []))
    outcome.pop("_items", None)
    outcome.pop("_codes", None)
    ids = outcome.pop("_ids", [])
    candidate_root = getattr(contract, "candidate_root", None)
    # 只改这本账自己数据目录里的候选件：临时账本配上默认目录时，那是本机真实的候选表。
    if ids and candidate_root is not None and _managed_cache_root(contract, candidate_root):
        from .stale_candidates import withdraw_purged_rows
        try:
            withdraw_purged_rows(candidate_root, ids)
        except (OSError, ValueError, csv.Error):
            LOGGER.exception("Failed to withdraw metadata candidates of deleted assets")
    from . import media_io
    cleanup_pending = []
    for _original, quarantine in outcome.pop("_staged"):
        try:
            media_io.bounded(media_io.mount_key(quarantine), _drop_quarantine, quarantine,
                             timeout=media_io.TIMEOUT_SECONDS)
        except OSError as error:
            cleanup_pending.append({
                "path": str(quarantine), "reason": error.strerror or str(error),
            })
    for snapshot in outcome.pop("_snapshots"):
        try:
            snapshot.unlink(missing_ok=True)
        except OSError:
            pass
    parents = outcome.pop("_parents")
    removed_directories: set[Path] = set()
    if parents:
        source_roots = tuple(root for roots in _online_source_roots(_bounded_online if bounded else None).values()
                             for root in roots)
        removed_directories.update(_remove_empty_ancestors_bounded(parents, source_roots))
    outcome["cleanup_pending"] = cleanup_pending
    outcome["empty_dirs_removed"] = len(removed_directories)
    return outcome


def _drop_quarantine(quarantine) -> None:
    quarantine.unlink(missing_ok=True)
    manifest = quarantine.parent / 'restore.json'
    if quarantine.name == 'content' and manifest.is_file():
        manifest.unlink()
        quarantine.parent.rmdir()


def _purge_media_path(row, online_roots: dict[str, tuple[Path, ...]], *,
                      missing_only: bool = False, online=root_online) -> Path:
    """核对永久删除目标的路径映射和来源可读性，失败时拒绝删除。

    `missing_only` 只删账本行：媒体目录已从设置里移除时，这一行不在任何来源根下，
    所在的盘可读就交给调用方 `stat`，文件确实不在才删。要删媒体文件的仍只认在线来源根。
    `online(root)` 判断来源根此刻是否可读。
    """
    media = row["path"]
    from .smb_media import resolve
    if remote := resolve(media):
        return remote
    translated = translate_ledger_path(media)
    if is_unmapped(translated):
        raise UserOSError("errors.webBatch.pathUnmapped")
    if PureWindowsPath(str(media)).drive:
        location = row["location"] if "location" in row.keys() else None
        if any(within_root(translated, root) and online(root)
               for root in online_roots.get(location, ())):
            return translated
        if missing_only and not _inside_declared_root(translated) and online(Path(translated.anchor)):
            return translated
        raise UserOSError("errors.webBatch.storageOffline")
    return translated


def _inside_declared_root(path: Path) -> bool:
    """路径是否落在设置里任一来源根下，包括此刻离线的根。SMB 根下的行由 `resolve` 先接走。"""
    from .smb_media import resolve
    return any(within_root(path, translate_ledger_path(declaration))
               for declarations in LOCATION_ROOT_DECLARATIONS.values()
               for declaration in declarations if resolve(declaration) is None)


def purge_assets(connection, rows, *, missing_only: bool = False):
    """删除媒体和账本行，调用方提交后清理隔离文件：`stage_purge` 加 `commit_purge`。

    服务里的删除不走这里：先在写事务外 `stage_purge`，再开事务 `commit_purge`，网盘上逐个
    stat、改名不占着写锁（`_purge_outside_lock`）。
    """
    outcome = stage_purge(rows, missing_only=missing_only)
    try:
        commit_purge(connection, outcome)
    except BaseException:
        _restore_staged_media(outcome["_staged"])
        raise
    return outcome


def _blocked(asset_id, path, error: OSError | None = None, *, code: str | None = None) -> dict:
    """删不掉的一条：`reason` 是 zh-CN 原文；带 code 的原因另给 `reason_code` 与 `reason_params`，
    界面按它取译文。系统报的错（权限、占用）只有原文。"""
    item = {"id": asset_id, "path": path}
    if code is not None:
        return {**item, "reason": interface_text.text(f"server:{code}"), "reason_code": code, "reason_params": {}}
    if isinstance(error, UserFacingError):
        return {**item, "reason": error.message, "reason_code": error.code, "reason_params": dict(error.params)}
    return {**item, "reason": error.strerror or str(error)}


def stage_purge(rows, *, missing_only: bool = False) -> dict:
    """在写事务外处理媒体文件：核对路径与来源、stat、同目录隔离。

    本地文件同目录隔离，账本事务失败时恢复。rclone FUSE 直接删除，避免远端改名
    触发复制；账本事务失败时保留记录供重试，已经删除的远端媒体无法恢复。先删文件再删行
    的次序不变（`peach-ledger-write`「删除」）。

    网盘上每次 stat 和改名都是网络往返，一批几百个能走上几分钟；放在写事务里，期间播放
    计数、评分等所有写入都排在后面。这一步不碰账本，`commit_purge` 在事务里复核后再删行。

    ``missing_only`` 删的只是账本行：文件还在（或答不上在不在）的行进 ``blocked``。
    """
    if missing_only:
        return _stage_missing_rows(rows)
    from . import media_io
    checked: dict[str, bool] = {}

    def online(root) -> bool:
        key = str(root)
        if key not in checked:
            checked[key] = _online_within_deadline(root)
        return checked[key]
    items, blocked = [], []
    online_roots = None
    for row in rows:
        media = row["path"]
        translated = None
        if media:
            try:
                if online_roots is None and PureWindowsPath(str(media)).drive:
                    online_roots = _online_source_roots(online)
                translated = _purge_media_path(row, online_roots or {}, online=online)
            except OSError as error:
                blocked.append(_blocked(row["id"], media, error))
                continue
        media_stat = None
        if media:
            try:
                media_stat = media_io.bounded(media_io.mount_key(translated), translated.stat)
            except FileNotFoundError:
                pass
            except OSError as error:
                blocked.append(_blocked(row["id"], media, error))
                continue
        staged = None
        if media:
            original = translated
            key = media_io.mount_key(original)
            try:
                if media_stat is not None and not stat.S_ISREG(media_stat.st_mode):
                    raise OSError("not a regular file")
                if media_stat is not None:
                    if _is_rclone_mount(original):
                        # 删了就收不回来：过了期限才删成的，这一行留着，资源同步下次按已消失处理。
                        _changed_within_deadline(key, original.unlink, None)
                    else:
                        location = row['location'] if 'location' in row.keys() else None
                        # 撤回可能在循环走到后面几行时才跑：路径要绑定在这一行上。
                        quarantine = _changed_within_deadline(
                            key, partial(_quarantine_media, original, location=location),
                            partial(_restore_one, original))
                        staged = (original, quarantine)
            except OSError as error:
                blocked.append(_blocked(row["id"], media, error))
                continue
        items.append(_purge_item(row, translated, staged))
    return _staged_outcome(items, blocked)


def _purge_item(row, translated, staged=None) -> dict:
    snapshot = row["snapshot_path"]
    return {"id": row["id"], "path": row["path"], "staged": staged,
            "snapshot": Path(snapshot) if snapshot else None,
            "parent": translated.parent if row["path"] else None}


def _staged_outcome(items, blocked) -> dict:
    return {"purged": 0, "blocked": blocked, "_items": items,
            "_staged": [item["staged"] for item in items if item["staged"]],
            "_returned": [], "_snapshots": [], "_parents": [], "_ids": [], "_codes": []}


def _online_within_deadline(root) -> bool:
    """根目录此刻可读：本进程里带期限地问（`media_io.bounded`），卡住超过期限算不在线。"""
    from . import media_io
    try:
        return bool(media_io.bounded(media_io.mount_key(root),
                                     lambda: root.is_dir() and root_online(root)))
    except OSError:
        return False


def _bounded_online(root) -> bool:
    """在可终止的读取子进程里确认根目录可读；卡住超过期限算不在线。"""
    from . import media_io
    try:
        return bool(media_io.root_online(root))
    except OSError:
        return False


def _stage_missing_rows(rows) -> dict:
    """只删账本行的那一批：文件还在、答不上在不在、或问的途中来源掉线的行进 ``blocked``。

    这一批多半来自资源同步的执行，路径都在网盘上。来源在线与文件在不在都交给可终止的读取
    子进程问（`media_io`）：网盘卡住时只是这几行删不了，整趟照常完成。文件在不在一批一起问，
    问前问后各确认一次来源在线：问的途中掉线的盘，答的「不在」不作数。
    """
    from . import media_io
    from .smb_media import SmbResource
    checked: dict[str, bool] = {}

    def online(root) -> bool:
        key = str(root)
        if key not in checked:
            checked[key] = _bounded_online(root)
        return checked[key]
    items, blocked, asking = [], [], []
    online_roots = None
    for row in rows:
        media = row["path"]
        if not media:
            items.append(_purge_item(row, None))
            continue
        try:
            if online_roots is None and PureWindowsPath(str(media)).drive:
                online_roots = _online_source_roots(online)
            asking.append((row, _purge_media_path(row, online_roots or {}, missing_only=True, online=online)))
        except OSError as error:
            blocked.append(_blocked(row["id"], media, error))
    answers = media_io.paths_present([translated for _row, translated in asking]) if asking else []
    checked.clear()
    for (row, translated), answer in zip(asking, answers):
        media = row["path"]
        if answer is True:
            blocked.append(_blocked(row["id"], media, code="labels.webBatch.stillOnDisk"))
        elif answer is None:
            blocked.append(_blocked(row["id"], media, CodedTimeoutError(
                errno.ETIMEDOUT, "errors.mediaIo.readTimedOut", filename=str(translated))))
        elif not isinstance(translated, SmbResource) and not _purge_root_online(row, translated, online):
            blocked.append(_blocked(row["id"], media, UserOSError("errors.webBatch.storageOffline")))
        else:
            items.append(_purge_item(row, translated))
    return _staged_outcome(items, blocked)


def _purge_root_online(row, translated: Path, online) -> bool:
    """这一行所在的来源根（或来源外那一行所在的盘）此刻还在不在线。"""
    location = row["location"] if "location" in row.keys() else None
    for declaration in LOCATION_ROOT_DECLARATIONS.get(location, ()):
        root = translate_ledger_path(declaration)
        if within_root(translated, root):
            return online(root)
    return online(Path(translated.anchor))


def commit_purge(connection, outcome: dict, *, eligible=None) -> None:
    """在写事务里删 `stage_purge` 处理过的行；先复核每一行。

    隔离与删行之间不再持锁，这段时间里行可能被改：还原出回收站、换了路径、已被别处删掉。
    `eligible(row)` 是调用方的删除条件（`row` 带 `id,path,disposal,code`），路径必须和隔离
    时一致。复核不过的行不删，进 `blocked`，它的隔离文件留到提交后由 `_finish_purge` 放回原处。
    异常时不改 `outcome`，调用方按 `_staged` 恢复全部隔离文件。
    """
    items = outcome["_items"]
    current = {}
    if items:
        marks = ",".join("?" * len(items))
        current = {row["id"]: row for row in connection.execute(
            f"SELECT id,path,disposal,code FROM asset WHERE id IN ({marks})",
            [item["id"] for item in items])}
    kept, returned = [], []
    for item in items:
        row = current.get(item["id"])
        if row is not None and row["path"] == item["path"] and (eligible is None or eligible(row)):
            kept.append(item)
        else:
            returned.append(item)
    purged = [item["id"] for item in kept]
    delete_asset_rows(connection, purged)
    outcome["blocked"].extend(_blocked(item["id"], item["path"], code="labels.webBatch.changedDuringDelete")
                              for item in returned)
    outcome.update(
        purged=len(purged), _ids=purged,
        _codes=[(item["id"], current[item["id"]]["code"]) for item in kept],
        _staged=[item["staged"] for item in kept if item["staged"]],
        _returned=[item["staged"] for item in returned if item["staged"]],
        _snapshots=[item["snapshot"] for item in kept if item["snapshot"]],
        _parents=[item["parent"] for item in kept if item["parent"]],
    )


def w_empty_trash(contract: WebContract):
    """永久清空回收站：只处理 disposal='trash' 的资产，其余一律不碰。"""
    contract.cache_bust()
    with contract.read_connection() as connection:
        rows = connection.execute(
            "SELECT id,location,path,snapshot_path FROM asset WHERE disposal='trash'",
        ).fetchall()
    # 这期间被还原出回收站的，事务里复核时留下，文件放回原处。
    outcome = _purge_outside_lock(contract, rows, eligible=lambda row: row["disposal"] == "trash")
    return _purge_receipt(contract, outcome, operation="empty-trash")


def _batch_region_value(body) -> str | None:
    """批量判定产地要写进真相字段的值；`None` 表示退回未判定。

    `none` 是「撤回这个判定」。认不出的写法一律拒绝，而不是按 `normalize_region`
    的习惯当成未判定——那会把一次拼错的批量操作变成一次静默的清空。
    """
    requested = str(body.get("region") or "").strip().lower()
    value = normalize_region(requested)
    if not value and requested != "none":
        raise ValueError("unsupported region")
    return value or None


#: 还原与永久删除只对这两档成立：回收站里的，和文件已不在盘上、带着个人记录的
#: （`vanished`，ADR-0087）。还原是清掉 `disposal`，永久删除走 `purge_assets`。
DISPOSED = frozenset({"trash", VANISHED})


def _reject_ineligible_targets(operation: str, rows) -> None:
    """选中集合与操作对不上就拒绝整批，不做部分生效。"""
    if operation in {"restore", "delete"} and any(row["disposal"] not in DISPOSED for row in rows):
        raise ValueError("restore/delete is only allowed for recycle-bin or vanished assets")
    # 已消失的行文件不在盘上：进回收站再还原就成了在库，只能在孤儿记录里接回或彻底删除。
    if operation == "dispose" and any(row["disposal"] == VANISHED for row in rows):
        raise ValueError("vanished assets cannot be moved to the recycle bin")
    if operation in {"dismiss-junk", "reconsider-junk"} and any(
            row["location"] not in SCANNABLE_LOCATIONS
            or row["disposal"] is not None for row in rows):
        raise ValueError("junk decisions are only allowed for active physical assets")
    if operation in {"keep-duplicates", "reconsider-duplicates"} and (
            len(rows) < 2 or any(row["disposal"] is not None for row in rows)):
        raise ValueError("duplicate decisions need a whole group of active assets")


def _batch_duplicate_groups(body) -> list[list[int]] | None:
    """「都保留」与「取消保留」一次带几组时的 `groups`：每组至少两份，组间不重叠。"""
    raw = body.get("groups")
    if raw is None:
        return None
    if body.get("operation") not in {"keep-duplicates", "reconsider-duplicates"}:
        raise ValueError("groups only apply to duplicate decisions")
    if not isinstance(raw, list) or not raw or any(not isinstance(group, list) for group in raw):
        raise TypeError("groups must be a list of id lists")
    groups = [list(dict.fromkeys(int(item) for item in group)) for group in raw]
    seen: set[int] = set()
    for group in groups:
        if len(group) < 2 or seen & set(group):
            raise ValueError("duplicate decisions need a whole group of active assets")
        seen.update(group)
    return groups


def _batch_disposal_reason(body):
    """移入回收站的原因；显式空值用于撤销未记录原因的条目。"""
    if body.get("operation") != "dispose":
        return None
    reason = body.get("disposal_reason", "manual")
    if reason not in (None, "manual", "junk", "duplicate", "missing"):
        raise ValueError("unsupported disposal reason")
    return reason


#: 批量「喜欢」「看过」「稍后看」的撤回：按那一批写入前交回的原值写回去。
REVERTS = frozenset({"revert-like", "revert-seen", "revert-later"})


def _batch_previous(body, ids) -> dict[int, object]:
    """撤回时带回来的原值，键是资产 id；只认这一批里的 id。"""
    raw = body.get("previous")
    if not isinstance(raw, dict):
        raise TypeError("previous must map asset ids to their earlier values")
    wanted = set(ids)
    previous = {int(key): value for key, value in raw.items()}
    if set(previous) - wanted:
        raise ValueError("previous lists assets outside this batch")
    return previous


def _snapshot_marks(connection, operation, ids) -> dict:
    """写入前记下原值，回执交给前端，撤销时原样带回来。"""
    marks = ",".join("?" * len(ids))
    if operation == "like":
        rows = dict(connection.execute(
            f"SELECT asset_id,liked FROM asset_preference WHERE profile_id=? AND asset_id IN ({marks})",
            [DEFAULT_PROFILE_ID, *ids]).fetchall())
        return {"previous": {str(i): rows.get(i) for i in ids}}
    if operation == "seen":
        rows = dict(connection.execute(
            f"SELECT id,feedback FROM asset WHERE id IN ({marks})", ids).fetchall())
        return {"previous": {str(i): rows.get(i) for i in ids}}
    if operation == "later":
        queued = {row[0] for row in connection.execute(
            f"SELECT asset_id FROM watch_queue WHERE profile_id=? AND asset_id IN ({marks})",
            [DEFAULT_PROFILE_ID, *ids])}
        return {"previous": {str(i): i in queued for i in ids}}
    return {}


def _write_revert(connection, operation, previous: dict[int, object]) -> None:
    """把「喜欢」「看过」「稍后看」写回那一批之前的样子。"""
    if operation == "revert-like":
        for asset_id, liked in previous.items():
            if liked is None:
                connection.execute("DELETE FROM asset_preference WHERE profile_id=? AND asset_id=?",
                                   (DEFAULT_PROFILE_ID, asset_id))
            else:
                connection.execute(
                    "UPDATE asset_preference SET liked=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') "
                    "WHERE profile_id=? AND asset_id=?", (1 if liked else 0, DEFAULT_PROFILE_ID, asset_id))
    elif operation == "revert-seen":
        for asset_id, feedback in previous.items():
            if feedback not in (None, "seen", "dislike"):
                raise ValueError("unsupported feedback value")
            connection.execute("UPDATE asset SET feedback=? WHERE id=?", (feedback, asset_id))
    else:
        dropped = [asset_id for asset_id, queued in previous.items() if not queued]
        connection.executemany("DELETE FROM watch_queue WHERE profile_id=? AND asset_id=?",
                               [(DEFAULT_PROFILE_ID, asset_id) for asset_id in dropped])


#: 只在 `review_decision` 里记一笔或撤一笔、不碰 asset 行的几种批量操作。
REVIEW_MARKS = frozenset({"dismiss-junk", "reconsider-junk", "keep-duplicates", "reconsider-duplicates"})


def _write_review_mark(connection, operation, ids, now, groups=None):
    """「不是垃圾」按文件一条；「都保留」按整组一条，键随组员走。`groups` 是一次带上的几组。"""
    groups = groups or [ids]
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
    upsert = ("INSERT INTO review_decision(category,item_key,status,note,updated_at) "
              "VALUES(?,?,'rejected',?,?) ON CONFLICT(category,item_key) DO UPDATE SET "
              "status='rejected',note=excluded.note,updated_at=excluded.updated_at")
    remove = "DELETE FROM review_decision WHERE category=? AND item_key=?"
    if operation == "dismiss-junk":
        connection.executemany(upsert, [("junk_file", str(i), NOT_JUNK_NOTE, stamp) for i in ids])
    elif operation == "reconsider-junk":
        connection.executemany(remove, [("junk_file", str(i)) for i in ids])
    elif operation == "keep-duplicates":
        connection.executemany(upsert, [(DUPLICATE_KEEP_CATEGORY, duplicate_group_key(group), KEEP_DUPLICATES_NOTE, stamp)
                                        for group in groups])
    else:
        # 取消保留：这组此刻是靠哪几条记录藏起来的（包含全部当前组员），就撤哪几条。
        keys = [row[0] for row in connection.execute(
            "SELECT item_key FROM review_decision WHERE category=?", (DUPLICATE_KEEP_CATEGORY,))]
        doomed = {duplicate_group_key(group) for group in groups}
        for key in keys:
            record = _kept_member_sets([key])
            if record and any(frozenset(group) <= record[0] for group in groups):
                doomed.add(key)
        connection.executemany(remove, [(DUPLICATE_KEEP_CATEGORY, key) for key in sorted(doomed)])


def _write_batch_state(connection, rows, operation, now, disposal_reason):
    """同一事务写入反馈或回收站状态，并保留还原操作的撤销信息。"""
    ids = [row["id"] for row in rows]
    marks = ",".join("?" * len(ids))
    if operation == "restore":
        connection.execute(
            f"UPDATE asset SET disposal=NULL,disposal_reason=NULL,feedback_at=? WHERE id IN ({marks})",
            [now, *ids],
        )
        return {"restored_reasons": {str(row["id"]): row["disposal_reason"] for row in rows}}
    if operation == "dispose":
        connection.execute(
            f"UPDATE asset SET disposal='trash',disposal_reason=?,feedback_at=? WHERE id IN ({marks})",
            [disposal_reason, now, *ids],
        )
    else:
        connection.execute(f"UPDATE asset SET feedback='seen',feedback_at=? WHERE id IN ({marks})", [now, *ids])
    return {}


def w_batch(contract: WebContract, body):
    """Apply one explicit, reversible marker to a bounded selected set."""
    groups = _batch_duplicate_groups(body)
    raw_ids = [asset_id for group in groups for asset_id in group] if groups else body.get("ids")
    if not isinstance(raw_ids, list):
        raise TypeError("ids must be a list")
    ids = list(dict.fromkeys(int(item) for item in raw_ids))
    if not ids or len(ids) > 200:
        raise ValueError("batch requires 1 to 200 assets")
    operation = body.get("operation")
    if operation not in {
        "like", "seen", "later", "dispose", "restore", "delete", "region", *REVIEW_MARKS, *REVERTS,
    }:
        raise ValueError("unsupported batch operation")
    previous = _batch_previous(body, ids) if operation in REVERTS else None
    # 产地的取值在这里就要认出来，别等到写库那一步才发现拼错了。
    region_value = _batch_region_value(body) if operation == "region" else None
    disposal_reason = _batch_disposal_reason(body)
    marks = ",".join("?" * len(ids))
    contract.cache_bust()
    purge_outcome = None
    state_receipt = {}
    # 批量是一次写、几秒就完的事，但删除那一支会真的动磁盘：事后「刚才那一批到底
    # 删了多少、有没有半路失败」只有这条记录答得出。不声明互斥——两批不同的资产
    # 各改各的，互斥只会把正常的连续操作挡住。
    run = contract.task_runs.start("batch", trigger="manual", total=len(ids),
                                   **batch_progress(operation))
    handle = TaskRunHandle(contract.task_runs, run.id if run else None)
    from .task_control import bind, Cancelled
    try:
        with bind(contract.task_runs, handle.run_id):
            try:
                if operation == "delete":
                    purge_outcome, valid_ids = _batch_purge(contract, ids)
                else:
                    with contract.write_transaction() as connection:
                        found = connection.execute(
                            f"SELECT id,path,snapshot_path,disposal,disposal_reason,location FROM asset WHERE id IN ({marks})", ids,
                        ).fetchall()
                        valid_ids = [row["id"] for row in found]
                        if not valid_ids:
                            raise ValueError("assets not found")
                        _reject_ineligible_targets(operation, found)
                        if groups and operation in REVIEW_MARKS and len(valid_ids) != len(ids):
                            raise ValueError("duplicate decisions need a whole group of active assets")
                        state_receipt = _write_batch_operation(
                            connection, operation, found, valid_ids,
                            groups=groups, previous=previous,
                            region_value=region_value, disposal_reason=disposal_reason,
                        )
            except BaseException as error:
                handle.finish("cancelled" if isinstance(error, Cancelled) else "failed",
                              error="" if isinstance(error, Cancelled) else f"{type(error).__name__}: {error}")
                raise
            if purge_outcome is not None:
                result = _purge_receipt(contract, purge_outcome, operation=operation)
                handle.finish("succeeded", summary={"operation": operation,
                                                    "changed": len(valid_ids)})
                return result
            handle.finish("succeeded", summary={"operation": operation,
                                                "changed": len(valid_ids)})
            return {"ok": True, "operation": operation, "changed": len(valid_ids), **state_receipt}
    except Cancelled:
        handle.finish('cancelled', summary={'cancelled_by_user': True})
        raise


def _write_batch_operation(connection, operation: str, found, valid_ids: list[int], *,
                           groups, previous, region_value, disposal_reason) -> dict:
    """在写事务里按操作写入选中的行，返回撤销要用的状态回执。"""
    now = time.time()
    state_receipt = _snapshot_marks(connection, operation, valid_ids)
    if operation in REVERTS:
        _write_revert(connection, operation, previous)
    elif operation in {"restore", "seen", "dispose"}:
        state_receipt.update(_write_batch_state(connection, found, operation, now, disposal_reason))
    elif operation in REVIEW_MARKS:
        _write_review_mark(connection, operation, valid_ids, now, groups)
    elif operation == "region":
        # 走 `write_owned_fields` 而不是直接 UPDATE：产地是真相字段，用户这一
        # 笔要压得住后面每一轮刮削与推断，归属列是它唯一的凭据。
        write_owned_fields(connection, valid_ids, {"region": region_value}, USER_MANUAL)
    elif operation == "later":
        connection.executemany(
            "INSERT OR IGNORE INTO watch_queue(profile_id,asset_id,added_at,source) "
            f"VALUES('{DEFAULT_PROFILE_ID}',?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'web-batch')",
            [(asset_id,) for asset_id in valid_ids],
        )
    else:
        connection.executemany(
            "INSERT INTO asset_preference(profile_id,asset_id,liked,reason,source,updated_at) "
            f"VALUES('{DEFAULT_PROFILE_ID}',?,1,'','web-batch',strftime('%Y-%m-%dT%H:%M:%fZ','now')) "
            "ON CONFLICT(profile_id,asset_id) DO UPDATE SET liked=1,source='web-batch',"
            "updated_at=excluded.updated_at",
            [(asset_id,) for asset_id in valid_ids],
        )
    return state_receipt


def _batch_purge(contract: WebContract, ids: list[int]):
    """批量永久删除：选中的行先读出来，网盘操作在写事务外做，事务里复核仍在回收站或已消失。"""
    marks = ",".join("?" * len(ids))
    with contract.read_connection() as connection:
        found = connection.execute(
            f"SELECT id,path,snapshot_path,disposal,disposal_reason,location FROM asset WHERE id IN ({marks})", ids,
        ).fetchall()
    valid_ids = [row["id"] for row in found]
    if not valid_ids:
        raise ValueError("assets not found")
    _reject_ineligible_targets("delete", found)
    # 已消失的行文件本来就不在了，只删账本行；文件又回到盘上的那几条留着，
    # 下一轮扫描会把它们接回在库。选中里有一条已消失的，整批都按这条口径删。
    outcome = _purge_outside_lock(contract, found, missing_only=any(row["disposal"] == VANISHED for row in found),
                                  eligible=lambda row: row["disposal"] in DISPOSED)
    return outcome, valid_ids


def _add_large_short_copy_cluster(items: list[dict], clusters: list[list[dict]]):
    """把同番号的大体积短版本并到完整版所在组，返回这个组。"""
    claimed = {item["id"] for cluster in clusters for item in cluster}
    full = max(items, key=lambda item: item.get("duration") or 0)
    full_duration = float(full.get("duration") or 0)
    short_copies = [item for item in items
                    if item["id"] not in claimed and item["id"] != full["id"]
                    and (item.get("size") or 0) >= JUNK_VIDEO_MAX_BYTES
                    and 0 < float(item.get("duration") or 0) < full_duration * 0.2
                    and not PART_MARK.search(PureWindowsPath(
                        str(item.get("name") or "")).stem)]
    if not short_copies:
        return None
    cluster = next((candidate for candidate in clusters if any(
        item["id"] == full["id"] for item in candidate)), None)
    if cluster is None:
        cluster = [full]
        clusters.append(cluster)
    cluster.extend(short_copies)
    return cluster


def _duplicate_groups(grouped: dict[str, list[dict]]):
    """把已按番号归组的资产整理成重复项 API 结果。"""
    groups = []
    for code, items in grouped.items():
        if len(items) < 2:
            continue
        clusters = [cluster for cluster in duration_clusters(items) if len(cluster) >= 2]
        short_copy_cluster = _add_large_short_copy_cluster(items, clusters)
        for cluster in clusters:
            largest = max(cluster, key=lambda x: x.get("size") or 0)
            longest = max(cluster, key=lambda x: x.get("duration") or 0)
            hashes_present = [x["hash"] for x in cluster if x["hash"]]
            hashes = set(hashes_present)
            for item in cluster:
                item["is_largest"] = item["id"] == largest["id"]
                item["is_longest"] = item["id"] == longest["id"]
                item.pop("hash", None)
                item.pop("disposal", None)
            groups.append({
                "code": code,
                "files": sorted(cluster, key=lambda x: -(x.get("size") or 0)),
                "count": len(cluster),
                "evidence": "same_code_short_copy" if cluster is short_copy_cluster
                else "duration",
                # 必须每个文件都有 sha1 且完全相同才算确证字节一致。缺一个哈希
                # 就只是「时长相近」的推断，不能对外宣称已确证。
                "identical": len(hashes) == 1 and len(hashes_present) == len(cluster),
                "drives": sorted({x["drive"] for x in cluster}),
                "cross_drive": len({x["drive"] for x in cluster}) > 1,
                "reclaimable": sum(x.get("size") or 0 for x in cluster)
                - (largest.get("size") or 0),
            })
    return groups


#: 重复项分组读的账本表。整库十万条视频逐条判番号、按时长聚簇要一两秒，页面每翻一页、每次
#: 轮询都重来一遍；声明后只在这两张表变了才重算，后台任务的提交先回上一份（ADR-0146）。
DUPLICATE_TABLES = ("asset", "review_decision")


def q_duplicates(contract: WebContract, args):
    """按番号 + 时长找真重复，也收同番号的大体积短版本。`view=kept` 列标过「都保留」的组。"""
    limit = min(max(int(args.get("limit", "60")), 1), 300)
    offset = max(int(args.get("offset", "0")), 0)
    pending, kept = contract.cached_until_changed(
        "duplicate-groups", lambda: _duplicate_listing(contract), tables=DUPLICATE_TABLES)
    groups = kept if args.get("view") == "kept" else pending
    window = groups[offset:offset + limit]
    return {
        "total": len(groups),
        "files": sum(g["count"] for g in groups),
        "reclaimable": sum(g["reclaimable"] for g in groups),
        "groups": window,
        "has_more": offset + limit < len(groups),
        # 标过「都保留」、当前组员都在保留记录里的组数；待处理那一份的各项不含它们。
        "kept": len(kept),
    }


def _duplicate_listing(contract: WebContract) -> tuple[list[dict], list[dict]]:
    """待处理与已保留两份重复组，都按可腾出空间从大到小，各页共用这一份。

    当前组员都在某条保留记录里就算已保留；不在时这组回到待处理，比那条记录多出来的几份标
    `is_new`，组上记 `new_files`。"""
    with contract.read_connection() as connection:
        rows = connection.execute(
            "SELECT id,code,location,path,name,size,duration,hash,disposal "
            "FROM asset WHERE medium='video' AND code IS NOT NULL AND code<>'' "
            "AND disposal IS NULL"
        ).fetchall()
        kept_sets = _kept_member_sets(row[0] for row in connection.execute(
            "SELECT item_key FROM review_decision WHERE category=? AND status='rejected'",
            (DUPLICATE_KEEP_CATEGORY,)))

    grouped: dict[str, list[dict]] = {}
    for row in rows:
        if not is_jav_code(row["code"]):
            continue
        item = dict(row)
        # 盘符只用于判定跨盘；重复项页面还要显示完整路径，不能在契约层丢掉。
        item["drive"] = str(item.get("path") or "")[:2].upper()
        grouped.setdefault(normalise_code_key(row["code"]), []).append(item)

    pending: list[dict] = []
    kept: list[dict] = []
    for group in _duplicate_groups(grouped):
        members = frozenset(int(item["id"]) for item in group["files"])
        record = _covering_keep(members, kept_sets)
        if record is not None and members <= record:
            kept.append(group)
            continue
        if record is not None:
            for item in group["files"]:
                item["is_new"] = int(item["id"]) not in record
            group["new_files"] = len(members - record)
        pending.append(group)
    pending.sort(key=lambda g: -g["reclaimable"])
    kept.sort(key=lambda g: -g["reclaimable"])
    return pending, kept
