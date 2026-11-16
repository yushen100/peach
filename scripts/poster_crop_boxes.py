#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""给已落盘的封面算正封的取景框，写进边车。

用法（默认只看不写）：

    python scripts/poster_crop_boxes.py
    python scripts/poster_crop_boxes.py --apply
    python scripts/poster_crop_boxes.py --apply --redo

判据全在 `peach.jav_poster_crop`：番号形态决定该不该裁，Sobel 列梯度决定书脊折痕
在哪，找不到折痕就按正封宽高比的先验从右缘量回去。这里只负责遍历、统计和落盘。

**原图一个字节都不动。** 产物是 `<番号>.poster.json`，和人脸取景的
`<番号>.face.json` 同目录、同命名风格，各描述一件事。

可重入：默认只处理边车缺失、算法版本落后、源图尺寸对不上或不是按当前切点判据（`CROP_RULES`）
算的封面，所以中断之后再跑一遍就是续跑。封面被更大的那张替换过（`fetch_jav_covers.py --upgrade-existing`
只升不降）时尺寸对不上，同样会重算。`--redo` 无条件全部重算。

失败不写成正常值：图读不出来只计进 `unreadable` 并跳过，不留一个按零尺寸算出来的
框——那种框在页面上和真框看不出区别。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from peach import cover_repair, jav_poster_crop  # noqa: E402
from peach.interface_text import dev as t  # noqa: E402
from peach.config import COVER_DIR  # noqa: E402

#: 每处理这么多张报一次进度。封面目录是千张量级，一张一行会把日志淹掉。
PROGRESS_EVERY = 100
#: 每一档在报告里带几个样例路径，供人抽查。
SAMPLES = 3


def image_size(path: Path) -> tuple[int, int] | None:
    """封面的像素尺寸；读不出来返回 None。只读图头，不解全图。"""
    try:
        from PIL import Image
    except ImportError:                         # pragma: no cover - 基础依赖
        return None
    try:
        with Image.open(path) as image:
            return image.size
    except Exception:
        return None


def pending(covers: list[Path], redo: bool) -> list[tuple[Path, tuple[int, int]]]:
    """待处理的封面加它们的尺寸。读不出尺寸的留给主循环去计数。"""
    todo: list[tuple[Path, tuple[int, int]]] = []
    for path in covers:
        size = image_size(path)
        if size is None:
            todo.append((path, (0, 0)))
            continue
        if redo or cover_repair.crop_stale(path, size):
            todo.append((path, size))
    return todo


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=t("poster_crop_boxes.description"))
    parser.add_argument("--covers", type=Path, default=COVER_DIR)
    parser.add_argument("--redo", action="store_true",
                        help=t("poster_crop_boxes.redoHelp"))
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--apply", action="store_true", help=t("poster_crop_boxes.applyHelp"))
    return parser


def run(args: argparse.Namespace) -> int:
    covers = sorted(args.covers.glob("*.jpg")) if args.covers.is_dir() else []
    # 手工框只有用户自己能换：`--redo` 也不重算它。
    todo = [(path, size) for path, size in pending(covers, args.redo)
            if not jav_poster_crop.is_manual(jav_poster_crop.read_sidecar(path))]
    if args.limit:
        todo = todo[:args.limit]
    print(t("poster_crop_boxes.writingStart" if args.apply else "poster_crop_boxes.previewStart",
            covers=len(covers), todo=len(todo)), flush=True)

    if todo:  # 装封面只用本机已有的书脊识别模型，重算在这里取一次
        from peach import spine_label

        spine_label.default_reader(allow_download=True)
    methods = (jav_poster_crop.FOLD, jav_poster_crop.MATCH, jav_poster_crop.RATIO, jav_poster_crop.CENTER,
               jav_poster_crop.NONE)
    counts = {**dict.fromkeys(methods, 0), "unreadable": 0}
    samples: dict[str, list[str]] = {}
    for index, (path, (width, height)) in enumerate(todo, 1):
        if not width or not height:
            counts["unreadable"] += 1
            print(t("poster_crop_boxes.unreadable", index=index, total=len(todo), name=path.name), flush=True)
    readable = [(path, size) for path, size in todo if all(size)]

    def pace(index: int, first: bool) -> None:
        if index % PROGRESS_EVERY == 0:
            print(f"[{1 if first else 2}/2 {index}/{len(readable)}]", flush=True)

    # 两遍与模板的学法在 `cover_repair.recrop`，「修复与迁移」的封面一项用的是同一份。
    for path, record, _old in cover_repair.recrop(args.covers, readable, write=args.apply, pace=pace):
        method = record["box"]["method"]
        counts[method] += 1
        bucket = samples.setdefault(method, [])
        if len(bucket) < SAMPLES:
            bucket.append(f"{path.name} {record['px'][0]}×{record['px'][1]} → "
                          + " ".join(f"{key}={record['box'][key]}" for key in ("x0", "y0", "x1", "y1")))

    print("\n" + t("poster_crop_boxes.summary",
                    fold=counts[jav_poster_crop.FOLD], ratio=counts[jav_poster_crop.RATIO],
                    center=counts[jav_poster_crop.CENTER], none=counts[jav_poster_crop.NONE],
                    unreadable=counts["unreadable"]))
    for method in methods:
        for line in samples.get(method, []):
            print(f"  {method}: {line}")
    if not args.apply:
        print(t("poster_crop_boxes.previewOnly"))
    return 0


def main(argv: list[str] | None = None) -> int:
    return run(build_parser().parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main())
