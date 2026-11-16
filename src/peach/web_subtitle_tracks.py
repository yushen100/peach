"""播放器的字幕轨：账本登记的与同目录发现的字幕行、每条能不能播，以及还没选过时默认打开的中文轨。

媒体路由（列字幕、取一条字幕）与字幕记忆路由（自动中文字幕）都要这份清单，放在 web 层，两个路由各自来取。
"""
from __future__ import annotations

from pathlib import Path

from . import interface_text, media_io, subtitles
from .media import bounded_normalized_path, normalized_path
from .platform import within_root
from .scan import VIDEO


#: 单份字幕的读取上限。两小时的片子字幕撑死几百 KB；比这更大的多半不是字幕，
#: 整份读进内存的代价不该由播放器那一次请求承担。
SUBTITLE_BYTE_LIMIT = 4 * 1024 * 1024


def _subtitle_rows(state, asset_id: int):
    """资产本身加它的字幕行。资产不存在时抛 `MediaNotFound`，由 `api.py` 收口。

    同目录发现要列正片目录（POSIX 上连路径解析也要问盘），网盘在期限内答不上时只列账本里登记的。
    """
    asset = state.media_engine.asset(asset_id)
    with state.database.read_connection() as connection:
        rows = [dict(row) for row in subtitles.subtitles_for(connection, asset_id)]
    if asset.path:
        try:
            rows.extend(_sidecar_rows(state, asset, rows))
        except TimeoutError:
            pass
    return asset, rows


def _sidecar_rows(state, asset, rows) -> list[dict]:
    video = bounded_normalized_path(asset.path)
    if not any(within_root(video, root) for root in state.media_engine.filesystem.allowed_roots):
        return []
    known = media_io.bounded(media_io.mount_key(video), lambda: {
        str(normalized_path(row["path"])).casefold() for row in rows})
    # 列表一次、每条轨各一次都走这里；目录列举按视频路径缓存，网盘目录不每次列一遍。
    listings = getattr(state, "sidecar_listings", None)
    found = (listings.discover(video, VIDEO) if listings is not None
             else subtitles.discover_sidecars(video, VIDEO))
    return [row for row in found if row["path"].casefold() not in known]


def _subtitle_path(state, asset, row) -> Path | None:
    """字幕文件在本机的位置；逃出正片所在目录或授权根一律拒绝。

    路径来自账本或同目录发现，这一层仍核对当前媒体授权根。
    """
    if not asset.path:
        return None
    directory = bounded_normalized_path(asset.path).parent
    path = bounded_normalized_path(row["path"])
    if str(path.parent).casefold() != str(directory).casefold():
        return None
    if not any(within_root(path, root)
               for root in state.media_engine.filesystem.allowed_roots):
        return None
    return path


def _subtitle_bytes(state, asset, row) -> tuple[bytes | None, str]:
    """字幕文件的内容，以及取不到时的原因 id（`labels.routesMedia.subtitle.<id>`）。原因进列表给人看。"""
    try:
        path = _subtitle_path(state, asset, row)
    except OSError:
        return None, "notFound"
    if path is None:
        return None, "outsideFolder"
    def read() -> bytes | None:
        if path.stat().st_size > SUBTITLE_BYTE_LIMIT:
            return None
        return path.read_bytes()

    try:
        data = media_io.bounded(media_io.mount_key(path), read)
    except OSError:
        return None, "notFound"
    return (None, "tooLarge") if data is None else (data, "")


def _subtitle_note(state, asset, row) -> str:
    """这一条为什么不能播的原因 id；能播返回空串。"""
    if not subtitles.is_playable_format(row["format"]):
        return "imageBased"
    data, note = _subtitle_bytes(state, asset, row)
    if data is None:
        return note
    try:
        subtitles.decode(data)
    except subtitles.SubtitleUndecodable:
        return "encodingUnknown"
    return ""


def subtitle_tracks(state, asset_id: int) -> list[dict]:
    """播放器可用的字幕轨：稳定文件身份、旧登记身份、地址与不能播的原因。"""
    asset, rows = _subtitle_rows(state, asset_id)
    tracks = []
    for index, row in enumerate(rows):
        note = _subtitle_note(state, asset, row)
        # 账本里登记成通用中文（`zh`）的旧行，文件名写明简繁（`zh-CN`、`zh-TW`）时按文件名细分，不改账本。
        language = row["language"]
        named = subtitles.language_of(row["name"])
        if not language or (language == "zh" and named.startswith("zh-")):
            language = named or language
        tracks.append({
            "id": f"sidecar:{subtitles.file_key(row['name'])}",
            "legacy_id": f"sidecar:{row['id']}" if isinstance(row["id"], int) else None,
            "index": index,
            "name": row["name"],
            "format": row["format"],
            "language": language,
            "label": subtitles.track_label(row["name"], language, asset.name),
            "pairing": row["pairing"],
            "note": interface_text.text(f"server:labels.routesMedia.subtitle.{note}") if note else "",
            "note_code": f"labels.routesMedia.subtitle.{note}" if note else "",
            "playable": not note,
            "src": f"/api/assets/{asset_id}/subtitles/{index}?track={subtitles.file_key(row['name'])}",
        })
    return tracks


def preferred_chinese(state, asset_id: int) -> str | None:
    """还没选过字幕时默认打开哪一条：可播放的中文轨，按简体、通用中文、繁体的顺序。"""
    candidates = [track for track in subtitle_tracks(state, asset_id)
                  if track["playable"] and (track["language"] or "").lower().split("-")[0] == "zh"]
    order = {"zh-hans": 0, "zh-cn": 0, "zh-sg": 0, "zh": 1}
    chosen = min(candidates, key=lambda track: order.get(track["language"].lower(), 2), default=None)
    return chosen["id"] if chosen else None
