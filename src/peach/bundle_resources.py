"""源码、wheel 与桌面构建共用的只读运行资源清单。"""
from pathlib import Path


def data_files(root):
    root = Path(root).resolve()
    seed = root / 'resources/seed/entities.json'
    if not seed.is_file():
        raise FileNotFoundError(f'public entity seed pack is missing: {seed}')
    metadata = root / 'resources/seed/metadata.json'
    if not metadata.is_file():
        raise FileNotFoundError(f'public metadata seed pack is missing: {metadata}')
    resources = [(root / name, name) for name in ('web', 'migrations', 'resources')]
    resources += [(root / 'tools/amane-bridge' / name, 'tools/amane-bridge')
                  for name in ('bridge.py', 'pyproject.toml', 'uv.lock')]
    for source, _target in resources:
        if not source.exists():
            raise FileNotFoundError(source)
    return resources


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, type=Path)
    args = parser.parse_args()
    for source, target in data_files(args.root):
        print(f'{source};{target}')
