"""给已装的 DMM 封面补判版式：取配套竖版图重装取景边车，独立海报装成竖版正封。

新装的封面在 `install_cover` 里当场判；这个脚本补判装在这之前的那些。默认只挑可能判错的：比例
不是标准 DVD 封套、没找到折痕、被判成整幅画面或标题带 VR 的；`--all` 连标准封套一起判。不带
`--apply` 只列候选。每个番号写一份结果到 `--report`，原有整组文件先备份到 `--report/originals`。
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from peach import jav_poster_crop as crop
from peach.cover_artwork import cover_group, install_cover, is_user_cover
from peach.fsutil import atomic_write_text
from peach.images import measure_image_file
from peach.interface_text import dev as t
from peach.jav_cover_fetch import HostLimitedTransport, dmm_portrait, dmm_portrait_url
from peach.scraping_access import SourceTransport


def read(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def doubtful(record: dict, face: dict, size: tuple[int, int], title: str) -> bool:
    """原有判据可能判错的封面：比例不标准、没找到折痕、判成整幅画面，或标题带 VR。

    标准比例上找到折痕的封套抽查几百张都切对了，默认不为它们取图。
    """
    ratio = size[0] / size[1]
    method = (record.get('box') or {}).get('method')
    return (not crop.RATIO_FALLBACK_MIN <= ratio <= crop.RATIO_FALLBACK_MAX
            or method != crop.FOLD
            or 'still' in (record.get('layout'), face.get('layout'))
            or crop.is_vr_title(title))


def eligible(path: Path, *, every: bool, named: bool) -> dict | None:
    """这张封面要不要补判；要的话给出补判要用的来源证据。"""
    evidence = read(path.with_suffix('.scraping.json'))
    url = str(evidence.get('source_url') or '')
    size = measure_image_file(path)
    record = crop.read_sidecar(path) or {}
    if not size or not dmm_portrait_url(url) or is_user_cover(path) or crop.is_manual(record):
        return None
    if named:
        return evidence
    if size[0] / size[1] < crop.SLEEVE_RATIO_MIN:
        return None  # 本机装的已经是竖版正封，没有横图要判
    if 'portrait' in record and crop.is_current(record, *size):
        return None
    face = read(path.with_suffix('.face.json'))
    return evidence if every or doubtful(record, face, size, str(evidence.get('title') or record.get('title') or '')) else None


def judge(path: Path, evidence: dict, transport, report: Path) -> dict:
    portrait = dmm_portrait(transport, str(evidence['source_url']))
    if portrait is None:
        return {'code': path.stem, 'status': 'no_portrait'}
    backup = report / 'originals'
    for member in cover_group(path):
        saved = backup / member.relative_to(path.parent)
        if member.exists() and not saved.exists():
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(member, saved)
    size = measure_image_file(path)
    install_cover(path, path.stem, path.read_bytes(), size, evidence=evidence, portrait=portrait)
    record = crop.read_sidecar(path) or {}
    found = crop.portrait_of(record)
    return {'code': path.stem, 'status': 'judged', 'verdict': found.verdict if found else None,
            'score': found.score if found else None, 'method': (record.get('box') or {}).get('method'),
            'front': record.get('front')}


def main() -> int:
    parser = argparse.ArgumentParser(description=t('judge_cover_portraits.description'))
    parser.add_argument('--data-root', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--code', action='append', default=[])
    parser.add_argument('--all', action='store_true', help=t('judge_cover_portraits.allHelp'))
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--retry-failures', action='store_true')
    parser.add_argument('--covers', type=Path, help=t('judge_cover_portraits.coversHelp'))
    args = parser.parse_args()
    root = args.covers or args.data_root / 'generated/covers'
    paths = [root / (code + '.jpg') for code in args.code] if args.code else sorted(root.glob('*.jpg'))
    args.report.mkdir(parents=True, exist_ok=True)
    transport = HostLimitedTransport(SourceTransport(args.data_root / 'secrets'), 1.0)
    results = []
    try:
        for path in paths:
            checkpoint = args.report / (path.stem + '.json')
            if args.apply and checkpoint.exists() and not (
                    args.retry_failures and read(checkpoint).get('status') in ('failed', 'no_portrait')):
                results.append(read(checkpoint))
                continue
            evidence = eligible(path, every=args.all, named=bool(args.code)) if path.is_file() else None
            if evidence is None:
                continue
            if not args.apply:
                print(json.dumps({'code': path.stem, 'eligible': True}, ensure_ascii=False), flush=True)
                results.append({'code': path.stem, 'status': 'eligible'})
                continue
            try:
                result = judge(path, evidence, transport, args.report)
            except Exception as error:  # 一部失败记下继续，`--retry-failures` 重试
                transport.renew()
                result = {'code': path.stem, 'status': 'failed', 'error': f'{type(error).__name__}: {error}'}
            results.append(result)
            atomic_write_text(checkpoint, json.dumps(result, ensure_ascii=False, indent=2))
            print(json.dumps(result, ensure_ascii=False), flush=True)
    finally:
        transport.close()
    summary = {status: sum(r.get('status') == status for r in results)
               for status in ('eligible', 'judged', 'no_portrait', 'failed')}
    summary.update(posters=sum(r.get('verdict') == crop.POSTER for r in results),
                   sleeves=sum(r.get('verdict') == crop.SLEEVE for r in results),
                   fronts=sum(bool(r.get('front')) for r in results))
    if args.apply:
        atomic_write_text(args.report / 'results.json', json.dumps(results, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False), flush=True)
    return 1 if summary['failed'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
