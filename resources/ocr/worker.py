"""独立 Python 环境中的 RapidOCR，标准输入输出采用逐批 JSON 协议。"""
from contextlib import redirect_stdout
import json
import sys


def main():
    with redirect_stdout(sys.stderr):
        from rapidocr import RapidOCR
        import onnxruntime
        if sys.argv[1:] == ['--self-check']:
            result = {'ok': True, 'onnxruntime': onnxruntime.__version__}
        else:
            request = json.load(sys.stdin)
            engine = RapidOCR(params=request['parameters'])
            result = [{'path': path, 'text': ' '.join(engine(path).txts or ()), 'error': ''}
                      for path in request['paths']]
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
