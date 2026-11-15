"""编辑资料里换封面：用户给的图装成这一部的封面，原来那组留一份备份，可以恢复（ADR-0165）。

封面按 `artwork_key` 存：有番号的同番号各版本、分卷共用一张，没有番号的按资产存。装上的那组
`.scraping.json` 记 `source: user:manual`，`cover_settled` 认它为定稿、`install_cover` 挡自动来源，
后台择优不会把它换掉。备份只在第一次替换时做：连换几次，恢复回去的仍是刮削来的那张。
"""
from __future__ import annotations

import hashlib
import io
import os
import time
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from . import jav_poster_crop
from .cover_artwork import USER_COVER_SOURCE, install_cover, is_user_cover
from .user_messages import UserValueError
from .western_artwork import artwork_key

MAX_BYTES = 32 * 1024 * 1024
MAX_PIXELS = 80_000_000
MIN_SIDE = 200
ORIGINALS = ".user-cover-originals"
SIDECARS = (".face.json", jav_poster_crop.SIDECAR_SUFFIX, ".scraping.json")


def _group(target: Path) -> list[Path]:
    return [target, *(target.with_suffix(suffix) for suffix in SIDECARS)]


def cover_target(contract, asset_id: int) -> tuple[Path, str]:
    """这一部封面文件的位置与封面键。"""
    with contract.read_connection() as connection:
        row = connection.execute("SELECT code FROM asset WHERE id=?", (int(asset_id),)).fetchone()
    if row is None:
        raise UserValueError("errors.itemEdit.assetMissing")
    key = artwork_key(int(asset_id), row[0])
    return Path(contract.cover_root) / f"{key}.jpg", key


def _backup_dir(target: Path) -> Path:
    return target.parent / ORIGINALS


def cover_state(cover_root: Path, key: str) -> dict:
    """详情要的两样：现在这张是不是用户换上的，有没有可以恢复的原封面。"""
    target = Path(cover_root) / f"{key}.jpg"
    user = is_user_cover(target)
    return {"cover_user": user, "cover_restorable": user}


def _encode(data: bytes) -> tuple[bytes, tuple[int, int]]:
    """读得出、不太小、不炸内存的图，统一转成 JPEG。"""
    if not data:
        raise UserValueError("errors.itemCover.empty")
    if len(data) > MAX_BYTES:
        raise UserValueError("errors.itemCover.tooLarge")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            width, height = probe.size
            if width * height > MAX_PIXELS:
                raise UserValueError("errors.itemCover.tooLarge")
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            rgb = image.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise UserValueError("errors.itemCover.unreadable") from exc
    if min(rgb.size) < MIN_SIDE:
        raise UserValueError("errors.itemCover.tooSmall")
    out = io.BytesIO()
    rgb.save(out, "JPEG", quality=92, optimize=True)
    return out.getvalue(), rgb.size


def set_user_cover(contract, asset_id: int, data: bytes, *, origin: str = "upload") -> dict:
    """把用户给的图装成这一部的封面；原来不是用户封面的那组先挪进备份目录。"""
    payload, size = _encode(data)
    target, key = cover_target(contract, asset_id)
    moved: list[tuple[Path, Path]] = []
    if target.is_file() and not is_user_cover(target):
        backup = _backup_dir(target)
        backup.mkdir(parents=True, exist_ok=True)
        for current in _group(target):
            if current.exists():
                os.replace(current, backup / current.name)
                moved.append((backup / current.name, current))
    evidence = {"source": USER_COVER_SOURCE, "origin": origin if origin in {"upload", "frame", "sample"} else "upload",
                "width": size[0], "height": size[1], "asset_id": int(asset_id),
                "raw_sha256": hashlib.sha256(payload).hexdigest(), "checked_at": time.time()}
    try:
        install_cover(target, key, payload, size, evidence=evidence)
    except BaseException:
        # 装不上就把原来那组放回去，不能让这一部变成没有封面。
        for kept, current in moved:
            os.replace(kept, current)
        raise
    return {"key": key, "width": size[0], "height": size[1]}


def restore_user_cover(contract, asset_id: int) -> dict:
    """换回刮削封面：有备份就放回去，没有就撤掉用户那张，等下一次采集补上。"""
    target, key = cover_target(contract, asset_id)
    if not is_user_cover(target):
        raise UserValueError("errors.itemCover.nothingToRestore")
    backup = _backup_dir(target)
    saved = [backup / current.name for current in _group(target)]
    for current in _group(target):
        current.unlink(missing_ok=True)
    restored = False
    for kept, current in zip(saved, _group(target)):
        if kept.exists():
            os.replace(kept, current)
            restored = restored or current == target
    return {"key": key, "restored": restored}
