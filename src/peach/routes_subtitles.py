"""播放器字幕文件转换与中文在线搜索。"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from starlette.concurrency import run_in_threadpool

from . import subtitle_memory, subtitle_search, subtitles
from .routes_auth import require_auth
from .user_messages import error_fields, message_fields

router = APIRouter(dependencies=[Depends(require_auth)])


def _error(error: Exception):
    return JSONResponse(error_fields(error), status_code=400)


def _track(text: str):
    return PlainTextResponse(text, media_type="text/vtt", headers={"Cache-Control": "no-store"})


@router.post("/api/subtitles/convert")
async def convert_subtitle(request: Request, name: str = ""):
    """上传文件转换为播放器支持的 WebVTT。"""
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > subtitle_search.MAX_BYTES:
            return JSONResponse(message_fields("api.subtitles.fileTooLarge", key="error"), status_code=413)
    try:
        return _track(subtitle_search.convert(bytes(data), subtitles.subtitle_format(name)))
    except (subtitle_search.SubtitleSearchError, subtitles.SubtitleUndecodable) as error:
        return _error(error)


def _memory(request: Request, video: str) -> subtitle_memory.SubtitleMemory:
    state = request.app.state
    if not subtitle_memory.VIDEO_KEY.fullmatch(video):
        raise HTTPException(400, message_fields("api.subtitles.invalidVideo"))
    kind, identity, *_ = video.split(":")
    table = "asset" if kind == "item" else "follow_item"
    with state.database.read_connection() as connection:
        if not connection.execute(f"SELECT 1 FROM {table} WHERE id=?", (int(identity),)).fetchone():
            raise HTTPException(404, message_fields("api.subtitles.videoMissing"))
    return subtitle_memory.SubtitleMemory(state.web_contract.follow_state_root / "player-subtitles", video)


def _memory_payload(request: Request, video: str, value: dict, auto: str = "") -> dict:
    """播放记忆给播放器的那份。`auto=zh`（设置里打开了自动中文字幕）且这部还没手动选过字幕时，
    `selected` 换成可播放的中文轨；只是推导，不写记忆文件。"""
    selected = value["selected"]
    if auto == "zh" and not value["selection_explicit"] and video.startswith("item:"):
        from .web_subtitle_tracks import preferred_chinese
        selected = preferred_chinese(request.app.state, int(video.split(":")[1]))
    return {**{key: value[key] for key in subtitle_memory.PREFERENCES if key in value},
            "selected": selected, "tracks": [
        {"key": row["key"], "name": row["name"],
         "src": f"/api/subtitles/memory/track/{row['file']}?video={video}"}
        for row in value["tracks"]]}


@router.get("/api/subtitles/memory")
@router.get("/api/player/memory")
def remembered_subtitles(request: Request, video: str, auto: str = ""):
    return JSONResponse(_memory_payload(request, video, _memory(request, video).read(), auto),
                        headers={"Cache-Control": "no-store"})


@router.put("/api/subtitles/memory")
@router.put("/api/player/memory")
async def remember_subtitles(request: Request, video: str, auto: str = ""):
    memory = _memory(request, video)
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > subtitle_memory.MAX_BYTES * 2:
            return JSONResponse(message_fields("api.subtitles.memoryTooLarge", key="error"), status_code=413)
    try:
        value = json.loads(data)
        saved = await run_in_threadpool(memory.patch, value)
        payload = await run_in_threadpool(_memory_payload, request, video, saved, auto)
        return JSONResponse(payload, headers={"Cache-Control": "no-store"})
    except (ValueError, TypeError) as error:
        return _error(error)


@router.get("/api/subtitles/memory/track/{filename}")
def remembered_subtitle_track(request: Request, filename: str, video: str):
    path = _memory(request, video).track_path(filename)
    if path is None:
        raise HTTPException(404, message_fields("api.subtitles.trackMissing"))
    return FileResponse(path, media_type="text/vtt", headers={"Cache-Control": "private, no-cache"})


@router.get("/api/subtitles/search")
def search_subtitles(q: str = "", offset: int = 0, language: str = "zh"):
    try:
        return subtitle_search.search(q, offset, language)
    except subtitle_search.SubtitleSearchError as error:
        return _error(error)


@router.get("/api/subtitles/subtitlecat/{subtitle_id}")
def subtitle_files(subtitle_id: str, language: str = "zh"):
    try:
        return subtitle_search.files(subtitle_id, language)
    except subtitle_search.SubtitleSearchError as error:
        return _error(error)


@router.get("/api/subtitles/subtitlecat/{subtitle_id}/{index}")
def online_subtitle(subtitle_id: str, index: int, language: str = "zh"):
    try:
        return _track(subtitle_search.load(subtitle_id, index, language))
    except (subtitle_search.SubtitleSearchError, subtitles.SubtitleUndecodable) as error:
        return _error(error)
