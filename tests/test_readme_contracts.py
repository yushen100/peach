"""README 的安装要求、双语入口与下载直链版本。"""
from pathlib import Path
import tempfile
import unittest

from scripts.check_readme_impact import READMES, installation_contracts
from scripts.version_bump import README_FILES, readme_link_problems

ROOT = Path(__file__).resolve().parents[1]


class ReadmeContractsTests(unittest.TestCase):
    def test_repository_readmes_satisfy_installation_contracts(self):
        self.assertEqual(set(README_FILES), READMES)
        self.assertEqual(installation_contracts(ROOT), [])
        self.assertEqual(readme_link_problems(ROOT), [])

    def test_download_links_may_trail_by_one_release_but_no_more(self):
        """`--ship` 等制品齐了才换直链：定版后、换链前指向上一版是正常的，更旧就是漏换了。"""
        link = 'https://github.com/o/p/releases/download/v{0}/Peach-{0}-windows-x64-setup.exe'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'src/peach').mkdir(parents=True)
            (root / 'src/peach/__init__.py').write_text('__version__ = "0.8.0"\n', encoding='utf-8')
            (root / 'CHANGELOG.md').write_text('## [Unreleased]\n\n## [0.8.0] - 2026-11-08\n\n'
                                               '## [0.7.9] - 2026-11-01\n\n## [0.7.8] - 2026-10-20\n',
                                               encoding='utf-8')
            for version, problems in (('0.8.0', 0), ('0.7.9', 0), ('0.7.8', 2)):
                for name in READMES:
                    (root / name).write_text(f'[Installer]({link.format(version)})\n', encoding='utf-8')
                with self.subTest(version=version):
                    self.assertEqual(len(readme_link_problems(root)), problems)
            (root / 'README.md').write_text(f'[A]({link.format("0.8.0")}) [B]({link.format("0.7.9")})\n',
                                            encoding='utf-8')
            (root / 'README.zh-CN.md').write_text('没有直链\n', encoding='utf-8')
            self.assertEqual([problem.split(':')[0] for problem in readme_link_problems(root)],
                             ['README.md', 'README.zh-CN.md'])

    def test_installation_check_accepts_equivalent_floor_notation_and_reports_missing_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'pyproject.toml').write_text('[project]\nrequires-python = ">=3.14"\n', encoding='utf-8')
            for suffix in ('+', ' or newer', ' 或更高'):
                for name in READMES:
                    counterpart, = READMES - {name}
                    (root / name).write_text(f'Python 3.14{suffix}\n[Language]({counterpart})\n', encoding='utf-8')
                self.assertEqual(installation_contracts(root), [])
            (root / 'README.md').write_text('Python 3.13+\n', encoding='utf-8')
            self.assertEqual(installation_contracts(root), ['README.md: Python 下限须为 3.14',
                                                           'README.md: 缺少语言入口 README.zh-CN.md'])
