"""测试运行时的内容身份与浏览器定位。"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import urlsplit, urlunsplit


RUN_METADATA = frozenset({
    'GITHUB_RUN_ID', 'GITHUB_RUN_NUMBER', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKSPACE',
    'GITHUB_SHA', 'GITHUB_REF', 'GITHUB_REF_NAME', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF',
    'GITHUB_OUTPUT', 'GITHUB_ENV', 'GITHUB_STEP_SUMMARY', 'GITHUB_PATH',
    'CI_JOB_ID', 'CI_JOB_URL', 'CI_PIPELINE_ID', 'CI_PIPELINE_IID', 'CI_PIPELINE_URL',
    'CI_PROJECT_DIR', 'CI_COMMIT_SHA', 'CI_COMMIT_SHORT_SHA', 'CI_COMMIT_REF_NAME',
    'CI_COMMIT_TIMESTAMP', 'CI_PIPELINE_CREATED_AT',
    'CI_JOB_STARTED_AT', 'CI_JOB_STARTED_AT_SLUG', 'CI_JOB_RETRY_COUNT', 'CI_BUILD_NETWORK_NAME',
    'CI_TRACEPARENT', 'CI_TRACESTATE',
    'CI_COMMIT_BEFORE_SHA', 'CI_COMMIT_MESSAGE', 'CI_COMMIT_TITLE',
    'CI_COMMIT_DESCRIPTION', 'CI_COMMIT_AUTHOR', 'CI_CONCURRENT_ID', 'CI_CONCURRENT_PROJECT_ID',
})
CREDENTIAL_FLAGS = frozenset({'GITHUB_TOKEN', 'CI_JOB_TOKEN', 'CI_REGISTRY_PASSWORD',
                              'CI_DEPENDENCY_PROXY_PASSWORD'})
ENTRY_FLAGS = frozenset({'PYTHONPATH', 'PEACH_REPORTING_TEST_MODE', 'PEACH_TEST_RUN_TEMP',
                         'PEACH_E2E_CHROME', 'PEACH_LANGUAGE'})
#: 整机名额的个数与持有标记只决定何时开跑，不改变被验证的环境；算进来的话，名额设置不同的两个会话
#: 签出的记录互不承认，持有名额期间核对的键也会和开跑前对不上。
SCHEDULING_FLAGS = frozenset({'PEACH_TEST_SLOTS', 'PEACH_TEST_SLOTS_HELD'})


def _file_digest(path: str) -> str:
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def file_identity(path) -> dict:
    if not path:
        return {'available': False}
    try:
        item = Path(path)
        return {'sha256': _file_digest(str(item))}
    except OSError as error:
        return {'unavailable': type(error).__name__}


def runtime_identity(identity: dict, executable: Path) -> dict:
    return {'version': identity['version'], 'implementation': identity.get('implementation'),
            'cache_tag': identity.get('cache_tag'),
            'binary': file_identity(identity.get('base_executable') or executable),
            'library': file_identity(identity.get('library'))}


def package_identity(distributions) -> list:
    return sorted({(re.sub(r'[-_.]+', '-', item.metadata.get('Name', '')).casefold(), item.version)
                   for item in distributions if item.metadata.get('Name', '').casefold() != 'peach'})


def install_identity(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding='utf8'))
        if not isinstance(data, dict):
            raise ValueError('安装锁必须为对象')
        return {'lock': data}
    except FileNotFoundError:
        return {'available': False}
    except (OSError, ValueError, UnicodeError):
        return {'invalid': file_identity(path)}


def flag_identity(key: str, value: str):
    if key in CREDENTIAL_FLAGS:
        return bool(value)
    if key != 'CI_REPOSITORY_URL':
        return value
    try:
        parsed = urlsplit(value)
    except ValueError:
        return {'invalid': hashlib.sha256(value.encode('utf8')).hexdigest()}
    public = parsed._replace(netloc=parsed.netloc.rsplit('@', 1)[-1])
    return {'url': urlunsplit(public), 'username': parsed.username, 'credential': bool(parsed.password)}


def environment_flags(environ=None) -> dict:
    values = os.environ if environ is None else environ
    return {key: flag_identity(key, value) for key, value in values.items()
            if key.startswith(('PEACH_', 'CI', 'GITHUB_', 'PYTHON'))
            and key not in RUN_METADATA | ENTRY_FLAGS | SCHEDULING_FLAGS and (key not in CREDENTIAL_FLAGS or value)}


def chrome_executable() -> str | None:
    """读取显式浏览器路径，否则查找各平台安装位置。"""
    explicit = os.environ.get('PEACH_E2E_CHROME', '').strip()
    if explicit:
        return explicit if Path(explicit).is_file() else None
    candidates = []
    if os.name == 'nt':
        for variable in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
            base = os.environ.get(variable)
            if base:
                candidates.append(Path(base) / 'Google/Chrome/Application/chrome.exe')
    elif sys.platform == 'darwin':
        candidates.append(Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
    else:
        candidates.extend(Path(found) for name in ('google-chrome', 'google-chrome-stable')
                          if (found := shutil.which(name)))
    return next((str(path) for path in candidates if path.is_file()), None)
