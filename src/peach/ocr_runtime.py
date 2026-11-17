"""Linux OCR 使用锁定的 Python 3.14 环境，随 Docker 预装或在工具目录准备。"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

from filelock import FileLock

from .fsutil import atomic_write_text
from .project_root import PROJECT_ROOT

RUNTIME = PROJECT_ROOT / 'resources/ocr/environment'


def python(tools_root: Path) -> Path:
    explicit = os.environ.get('PEACH_OCR_PYTHON', '').strip()
    if explicit:
        executable = Path(explicit)
        if not executable.is_file():
            raise RuntimeError(f'OCR Python unavailable: {executable}')
        return executable
    from .runtime_prepare import find_uv
    from .task_control import run
    from .peach_proxy import client_options
    uv = find_uv()
    if uv is None:
        raise RuntimeError('uv unavailable for OCR Python 3.14 preparation')
    home = Path(tools_root) / 'ocr-runtime'
    home.mkdir(parents=True, exist_ok=True)
    executable = home / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    fingerprint = hashlib.sha256(b''.join((RUNTIME / name).read_bytes()
                                         for name in ('pyproject.toml', 'uv.lock'))).hexdigest()
    marker = home / 'installed.sha256'
    with FileLock(str(home / 'install.lock'), timeout=900):
        if executable.is_file() and marker.is_file() and marker.read_text() == fingerprint:
            return executable
        environment = {**os.environ, 'UV_PROJECT_ENVIRONMENT': str(home / '.venv')}
        options = client_options()
        if not options.get('trust_env', True):
            environment = {key: value for key, value in environment.items()
                           if not key.upper().endswith('_PROXY')}
            address = str(options.get('proxy') or '')
            if address:
                environment.update(HTTP_PROXY=address, HTTPS_PROXY=address, ALL_PROXY=address)
        result = run([str(uv), 'sync', '--locked', '--no-dev', '--python', '3.14',
                      '--project', str(RUNTIME)], env=environment, capture_output=True, timeout=900)
        if result.returncode:
            raise RuntimeError(result.stderr.decode('utf-8', 'replace').strip())
        if not executable.is_file():
            raise RuntimeError('OCR environment preparation returned no Python executable')
        atomic_write_text(marker, fingerprint)
    return executable
