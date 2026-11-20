"""缓存图像的本机 OCR；Windows 与 macOS 使用系统引擎，Linux 使用 RapidOCR。"""
from __future__ import annotations

import json
import locale
import os
from pathlib import Path
import shutil
import subprocess
import sys

from .project_root import PROJECT_ROOT
from .user_messages import UserFacingError

MODEL_ROOT = 'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0/onnx/'
MODEL_SPECS = (
    ('Det', 'PP-OCRv6/det/PP-OCRv6_det_small.onnx',
     '090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f'),
    ('Cls', 'PP-OCRv4/cls/ch_ppocr_mobile_v2.0_cls_mobile.onnx',
     'e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c'),
    ('Rec', 'PP-OCRv6/rec/PP-OCRv6_rec_small.onnx',
     '6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884'),
)


class OcrUnavailable(UserFacingError, RuntimeError):
    """引擎、语言或识别结果未取得。"""

    def __init__(self, reason):
        super().__init__('errors.junkVisual.ocrUnavailable', {'reason': str(reason)})


class ImageReader:
    """批量识别缓存帧，按平台选用本机引擎。"""

    def __init__(self, tools_root: Path, *, platform: str | None = None):
        self.tools_root = Path(tools_root)
        self.platform = sys.platform if platform is None else platform
        self.parameters = None

    def read(self, paths: list[Path]) -> list[str]:
        try:
            if self.platform == 'win32':
                return self._windows(paths)
            if self.platform == 'darwin':
                return self._macos(paths)
            return self._portable(paths)
        except (ImportError, OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
            if isinstance(error, OcrUnavailable):
                raise
            raise OcrUnavailable(error) from error

    def _portable(self, paths):
        from .avatar_watermark import ensure_model
        from .ocr_runtime import python
        if self.parameters is None:
            root = self.tools_root / 'rapidocr'
            parameters = {'Global.model_root_dir': str(root)}
            for kind, relative, sha256 in MODEL_SPECS:
                model = ensure_model(root / Path(relative).name, url=MODEL_ROOT + relative, sha256=sha256)
                parameters[f'{kind}.model_path'] = str(model)
            self.parameters = parameters
        return self._process([str(python(self.tools_root)), '-X', 'utf8',
                              str(PROJECT_ROOT / 'resources/ocr/worker.py')], paths,
                             {'parameters': self.parameters})

    @staticmethod
    def _macos(paths):
        import objc
        from Foundation import NSURL
        import Vision
        texts = []
        for path in paths:
            with objc.autorelease_pool():
                request = Vision.VNRecognizeTextRequest.alloc().init()
                request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
                request.setRecognitionLanguages_(['zh-Hans', 'zh-Hant', 'en-US'])
                request.setUsesLanguageCorrection_(False)
                handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(
                    NSURL.fileURLWithPath_(str(path)), {})
                ok, error = handler.performRequests_error_([request], None)
                if not ok:
                    raise OcrUnavailable(error)
                lines = [observation.topCandidates_(1) for observation in request.results() or ()]
                texts.append(' '.join(str(line[0].string()) for line in lines if line))
        return texts

    def _windows(self, paths):
        executable = shutil.which('powershell.exe')
        if executable is None:
            raise OcrUnavailable('Windows PowerShell unavailable')
        helper = PROJECT_ROOT / 'resources/ocr/windows.ps1'
        # 执行策略只对运行随包助手的这一个 PowerShell 进程生效。
        return self._process([executable, '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                              '-File', str(helper)], paths, {'language': 'zh-Hans-CN'},
                             stderr_encoding=locale.getencoding())

    @staticmethod
    def _process(command, paths, parameters, *, stderr_encoding='utf-8'):
        from .task_control import run
        result = run(command,
                     input=json.dumps({'paths': [str(path) for path in paths],
                                       **parameters}).encode('utf-8'),
                     capture_output=True, timeout=120,
                     creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        if result.returncode:
            # PowerShell 可能在助手把输出切到 UTF-8 之前就拒绝加载脚本。
            try:
                reason = result.stderr.decode('utf-8-sig')
            except UnicodeDecodeError:
                reason = result.stderr.decode(stderr_encoding, 'replace')
            raise OcrUnavailable(reason.strip())
        try:
            entries = json.loads(result.stdout.decode('utf-8-sig'))
        except (ValueError, UnicodeError) as error:
            raise OcrUnavailable(error) from error
        if not isinstance(entries, list) or len(entries) != len(paths):
            raise OcrUnavailable('OCR result count differs from requested images')
        texts = []
        for path, entry in zip(paths, entries):
            if (not isinstance(entry, dict) or entry.get('error') or not isinstance(entry.get('text'), str)
                    or not isinstance(entry.get('path'), str)
                    or Path(entry.get('path', '')).resolve() != path.resolve()):
                raise OcrUnavailable(entry.get('error') if isinstance(entry, dict) else 'Invalid OCR entry')
            texts.append(entry['text'])
        return texts
