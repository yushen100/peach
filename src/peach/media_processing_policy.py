"""本机视频预览与播放转码偏好；资料管理模式保留媒体探测、关闭视频抽帧。"""
from __future__ import annotations

import json
from pathlib import Path
from filelock import FileLock

from .fsutil import atomic_write_text
from .user_messages import UserValueError

FILENAME = 'media-processing.json'
#: 播放转码的画质上限（短边像素）；0 是原画，转码不缩放、不限码率。
PLAYBACK_QUALITY_CHOICES = (0, 1080, 720, 480)


def metadata_only(state_root: Path | None = None) -> bool:
    if state_root is None:
        from .settings_file import active
        state_root = active().directory('state')
    try:
        payload = json.loads((Path(state_root) / FILENAME).read_text(encoding='utf-8'))
    except FileNotFoundError:
        return False
    except (OSError, ValueError):
        return True
    return not isinstance(payload, dict) or payload.get('metadata_only') is not False


def save(state_root: Path, value: bool) -> None:
    if not isinstance(value, bool):
        raise UserValueError('errors.mediaProcessingPolicy.previewStateRequired')
    save_preferences(state_root, {'metadata_only': value})


def acceleration(state_root: Path | None = None, *, purpose: str = 'playback') -> str:
    if purpose not in ('preview', 'playback'):
        raise ValueError('invalid media acceleration purpose')
    if state_root is None:
        from .settings_file import active
        state_root = active().directory('state')
    try:
        payload = json.loads((Path(state_root) / FILENAME).read_text(encoding='utf-8'))
        return 'software' if isinstance(payload, dict) and payload.get(f'{purpose}_acceleration') == 'software' else 'auto'
    except (OSError, ValueError):
        return 'auto'


def playback_max_height(state_root: Path | None = None) -> int:
    """播放转码的画质上限（短边像素），0 为原画；读不出来或不在档位里都按原画。"""
    if state_root is None:
        from .settings_file import active
        state_root = active().directory('state')
    try:
        payload = json.loads((Path(state_root) / FILENAME).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return 0
    value = payload.get('playback_max_height') if isinstance(payload, dict) else 0
    return value if type(value) is int and value in PLAYBACK_QUALITY_CHOICES else 0


def save_preferences(state_root: Path, body: dict) -> None:
    patch = {}
    if 'playback_max_height' in body:
        value = body['playback_max_height']
        if type(value) is not int or value not in PLAYBACK_QUALITY_CHOICES:
            raise UserValueError('errors.mediaProcessingPolicy.qualityRequired',
                                 {'choices': '/'.join(map(str, PLAYBACK_QUALITY_CHOICES))})
        patch['playback_max_height'] = value
    if 'metadata_only' in body:
        if not isinstance(body['metadata_only'], bool):
            raise UserValueError('errors.mediaProcessingPolicy.previewStateRequired')
        patch['metadata_only'] = body['metadata_only']
    for key in ('preview_acceleration', 'playback_acceleration'):
        if key in body:
            if body[key] not in ('auto', 'software'):
                raise UserValueError('errors.mediaProcessingPolicy.accelerationModeRequired')
            patch[key] = body[key]
    if not patch:
        raise UserValueError('errors.mediaProcessingPolicy.choiceRequired')
    path = Path(state_root) / FILENAME
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path) + '.lock', timeout=5):
        try:
            existing = json.loads(path.read_text(encoding='utf-8'))
            existing = existing if isinstance(existing, dict) else {'metadata_only': True}
        except FileNotFoundError:
            existing = {'metadata_only': False}
        except (OSError, ValueError):
            existing = {'metadata_only': True}
        atomic_write_text(path, json.dumps({**existing, **patch}) + '\n')
