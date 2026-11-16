"""给已装的 DMM 封面补判版式：取配套竖版图重装取景边车，独立海报装成竖版正封。

新装的封面在 `install_cover` 里当场判；这个脚本补判装在这之前的那些。默认只挑可能判错的：比例
不是标准 DVD 封套、没找到折痕、被判成整幅画面或标题带 VR 的；`--all` 连标准封套一起判。不带
`--apply` 只列候选。每个番号写一份结果到 `--report`，原有整组文件先备份到 `--report/originals`。

判据与补判步骤在 `peach.cover_repair`，「设置 › 修复与迁移」的封面一项用的是同一份。
来源记录（`.scraping.json`）里的 DMM 横图地址推出竖版图与 DVD 封套地址。没有来源记录的（2026-09
之前装的封面不记来源）按番号查 DMM 目录拿横图地址；换成 DVD 封套时写入它的来源记录，没换图就不写：
那张老图从哪儿来的不知道，不能记成查到的地址。来源记录写明是别家的（JavBus、MGS 等）不碰。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from peach import jav_poster_crop as crop, spine_label
from peach.cover_repair import eligible, judge, read
from peach.fsutil import atomic_write_text
from peach.interface_text import dev as t
from peach.jav_cover_fetch import HostLimitedTransport
from peach.scraping_access import SourceTransport


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
    if args.apply:  # 装封面只用本机已有的书脊识别模型，补判在这里取一次
        spine_label.default_reader(allow_download=True)
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
                result = judge(path, evidence, transport, args.report / 'originals')
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
