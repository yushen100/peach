"""维护者导入私有贡献附件、导出候选汇总并显式复核公共种子。"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from peach import seed_contribution_archive as archive
from peach.seed_catalog import load
from peach.fsutil import atomic_write_text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    ingest = commands.add_parser('import')
    ingest.add_argument('--archive', type=Path, required=True)
    ingest.add_argument('--attachment', type=Path, required=True)
    ingest.add_argument('--instance', required=True)
    ingest.add_argument('--received-at', required=True)
    summarize = commands.add_parser('summary')
    summarize.add_argument('--archive', type=Path, required=True)
    summarize.add_argument('--out', type=Path, required=True)
    review = commands.add_parser('review')
    review.add_argument('--report', type=Path, required=True)
    review.add_argument('--decisions', type=Path, required=True)
    review.add_argument('--previous', type=Path, required=True)
    review.add_argument('--out', type=Path, required=True)
    review.add_argument('--revision', type=int, required=True)
    validate = commands.add_parser('validate')
    validate.add_argument('--pack', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'import':
        print(json.dumps(archive.import_snapshot(args.archive, args.attachment, instance=args.instance,
                                               received_at=args.received_at)))
    elif args.command == 'summary':
        atomic_write_text(args.out, json.dumps(archive.summary(args.archive.resolve()), ensure_ascii=False, indent=2) + '\n')
    elif args.command == 'review':
        report = json.loads(args.report.read_text(encoding='utf-8'))
        decisions = json.loads(args.decisions.read_text(encoding='utf-8'))
        pack = archive.publish(report, decisions, args.previous, revision=args.revision)
        atomic_write_text(args.out, json.dumps(pack.model_dump(mode='json', exclude_none=True), ensure_ascii=False, indent=2) + '\n')
    else:
        pack = load(args.pack)
        print(json.dumps({'revision': pack.revision, 'facts': len(pack.facts), 'withdrawals': len(pack.withdrawals)}))


if __name__ == '__main__':
    main()
