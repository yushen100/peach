"""按模板整理：模板渲染、逃逸防护、计划生成、执行与回滚（ADR-0039）。"""
from __future__ import annotations

import os
import sqlite3
import json
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import ExitStack, closing, contextmanager
from pathlib import Path, PureWindowsPath
from unittest import mock

from peach import media_io, organize
from peach.organize_templates import (
    TemplateError, render, sanitise_component, validate_template, clean_filename,
)
from support.ledger import fresh_ledger

ROOT_DECLARATION = "R:\\media"
DECLARED = {"local": (ROOT_DECLARATION,)}

VALUES = {
    "code": "ABC-123", "title": "标题", "studio": "厂牌", "series": "系列",
    "year": "2024", "actors": "甲、乙", "cd": "2", "mosaic": "无码",
    "definition": "1080p",
}


class TemplateRenderTests(unittest.TestCase):
    CASES = [
        # (模板, 取值覆盖, 期望)
        ("{code}", {}, "ABC-123"),
        ("{code}[ {title}]", {}, "ABC-123 标题"),
        ("{number}", {}, "ABC-123"),
        ("{number} {title}", {}, "ABC-123 标题"),
        ("{number}[ {title}]", {"title": ""}, "ABC-123"),
        ("{number}[ {title}]", {}, "ABC-123 标题"),
        ("{number}[ CD{cd}]", {"cd": ""}, "ABC-123"),
        ("{number}[ CD{cd}]", {}, "ABC-123 CD2"),
        ("[{mosaic} ]{number}", {"mosaic": ""}, "ABC-123"),
        ("[{studio} ][{series} ]{number}", {"series": ""}, "厂牌 ABC-123"),
        ("{number} [{definition}]", {}, "ABC-123 1080p"),
        # 方括号是分组记号，不进结果；一个占位符都没有的分组就是一段普通字面量。
        ("{number} [完整版]", {}, "ABC-123 完整版"),
        # 转义写法给出字面的括号。
        ("{number} {{x}}", {}, "ABC-123 {x}"),
        ("{number} [[x]]", {}, "ABC-123 [x]"),
        # 出演者与年份是最常见的两组可选信息。
        ("{number}[ ({year})][ {actors}]", {"year": ""}, "ABC-123 甲、乙"),
    ]

    def test_render_table(self):
        for template, overrides, expected in self.CASES:
            with self.subTest(template=template, overrides=overrides):
                values = {**VALUES, **overrides}
                text, _missing = render(template, values)
                self.assertEqual(text, expected)

    def test_missing_required_field_is_reported(self):
        text, missing = render("{number} {title}", {**VALUES, "title": ""})
        self.assertEqual(missing, frozenset({"title"}))
        self.assertEqual(text, "ABC-123")

    def test_optional_field_is_not_required(self):
        _text, missing = render("{number}[ {title}]", {**VALUES, "title": ""})
        self.assertEqual(missing, frozenset())

    def test_directory_template_keeps_layers(self):
        text, _missing = render("{studio}/{number}", VALUES, directory=True)
        self.assertEqual(text, "厂牌/ABC-123")

    def test_presets_render_the_displayed_example_path(self):
        for preset in organize.PRESETS:
            with self.subTest(preset=preset["label"]):
                filename, missing = render(preset["file"], VALUES)
                directory, directory_missing = render(preset["dir"], VALUES, directory=True)
                self.assertFalse(missing | directory_missing)
                self.assertEqual("/".join(filter(None, (directory, filename + ".mp4"))), preset["example"])


class SanitiseTests(unittest.TestCase):
    def test_filename_symbols_and_invalid_unicode_are_removed(self):
        cases = {
            '01_First Part⧹⧹Second Part⧹⧹Last Scene.mp4':
                '01_First Part Second Part Last Scene.mp4',
            '★ 标题💎👑✨ → 片段 �.mp4': '标题 片段.mp4',
            '标题＼＼片段﹨补充／附录.mp4': '标题 片段 补充 附录.mp4',
            '标题\ue519\u200b\ufeff\x00片段.mp4': '标题片段.mp4',
            '👩🏽\u200d💻标题❤️\ufe0f.mp4': '标题.mp4',
            '【中日文】 café ガール 168㎝ 1920×1080 (2).mp4':
                '【中日文】 café ガール 168㎝ 1920×1080 (2).mp4',
            '★💎.mp4': '★💎.mp4',
            '★CON.mp4': '_CON.mp4',
        }
        for original, expected in cases.items():
            with self.subTest(original=original):
                self.assertEqual(clean_filename(original), expected)
                self.assertEqual(clean_filename(expected), expected)

    def test_illegal_characters_become_underscore(self):
        self.assertEqual(sanitise_component('a<b>c:d"e/f\\g|h?i*j'),
                         "a_b_c_d_e_f_g_h_i_j")

    def test_trailing_dot_and_space_are_dropped(self):
        self.assertEqual(sanitise_component("名字. "), "名字")

    def test_reserved_device_name_is_prefixed(self):
        self.assertEqual(sanitise_component("CON"), "_CON")
        self.assertEqual(sanitise_component("nul.mp4"), "_nul.mp4")

    def test_long_value_is_truncated_from_the_middle(self):
        value = sanitise_component("甲" * 400)
        self.assertLessEqual(len(value), 120)
        self.assertIn("…", value)


class TemplateEscapeTests(unittest.TestCase):
    REJECTED = [
        "..\\{number}",
        "../{number}",
        "C:\\{number}",
        "/{number}",
        "{number}/{title}",          # 文件名模板不带分隔符
        "{unknown}",
        "{number",
        "{number}]",
        "[{number}",
    ]

    def test_escaping_templates_are_rejected(self):
        for template in self.REJECTED:
            with self.subTest(template=template):
                with self.assertRaises(TemplateError):
                    validate_template(template)

    def test_directory_template_may_layer_but_not_escape(self):
        self.assertEqual(validate_template("{studio}\\{number}", directory=True),
                         "{studio}/{number}")
        with self.assertRaises(TemplateError):
            validate_template("{studio}/../{number}", directory=True)

    def test_value_cannot_introduce_a_layer(self):
        text, _missing = render("{title}", {"title": "a/../b"})
        self.assertEqual(text, "a_.._b")


def _seed(db_path: Path, rows: list[dict]) -> None:
    with closing(sqlite3.connect(db_path)) as connection:
        for row in rows:
            connection.execute(
                "INSERT INTO asset(id,location,path,name,medium,code,catalog_title,"
                "studio,series,release_date,width,height) "
                "VALUES(:id,'local',:path,:name,'video',:code,:title,:studio,NULL,"
                ":release_date,:width,:height)",
                {"series": None, "code": None, "title": None, "studio": None,
                 "release_date": None, "width": None, "height": None, **row})
        connection.commit()


@contextmanager
def hung_mount(stuck, *functions):
    """模拟挂死的挂载：本进程与媒体子进程里，`functions`（如 `os.rename`、`builtins.open`）
    碰到 `stuck` 里的路径都卡住。

    本进程只卡 30 秒，好让旧写法下的用例以超时失败而不是一直挂着；子进程卡 60 秒，
    由父进程按期限结束。产出拉起过的子进程。
    """
    import builtins
    stuck = sorted(str(path) for path in stuck)
    script = ('import builtins, os, sys, time\n'
              f'sys.path[:0] = {sys.path!r}\n'
              'import peach.media_io as m\n'
              f'stuck = {stuck!r}\n'
              'def hang(original):\n'
              '    def call(path, *args, **kwargs):\n'
              '        if isinstance(path, (str, os.PathLike)) and os.fspath(path) in stuck: time.sleep(60)\n'
              '        return original(path, *args, **kwargs)\n'
              '    return call\n'
              + ''.join(f'{name} = hang({name})\n' for name in functions)
              + 'sys.exit(m.main(sys.argv[1:]))\n')
    children, original_popen = [], subprocess.Popen

    def spawn(command, **options):
        if '-m' in command and 'peach.media_io' in command:
            # venv 的 python.exe 是转发器：结束它不一定结束真正的解释器，这里直接起基础解释器。
            command = [sys._base_executable, '-c', script, *command[command.index('peach.media_io') + 1:]]
        child = original_popen(command, **options)
        children.append(child)
        return child

    def hang(original):
        def call(path, *args, **kwargs):
            if isinstance(path, (str, os.PathLike)) and os.fspath(path) in stuck:
                time.sleep(30)
            return original(path, *args, **kwargs)
        return call

    modules = {'os': os, 'os.path': os.path, 'builtins': builtins}
    with ExitStack() as stack:
        stack.enter_context(mock.patch.object(media_io, 'TIMEOUT_SECONDS', 1.0))
        stack.enter_context(mock.patch.object(media_io.subprocess, 'Popen', side_effect=spawn))
        for name in functions:
            module, _, attribute = name.rpartition('.')
            target = modules[module]
            stack.enter_context(mock.patch.object(target, attribute, hang(getattr(target, attribute))))
        try:
            yield children
        finally:
            for child in children:
                if child.poll() is None:
                    child.kill()
                child.wait(timeout=10)


def _plan(db_path: Path, **kwargs) -> dict:
    with closing(sqlite3.connect(db_path)) as connection:
        return organize.build_plan(connection, location="local", roots=DECLARED,
                                   online=True, **kwargs)


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.holder = Path(tempfile.mkdtemp(prefix="peach-organize-")).resolve()
        self.addCleanup(lambda: __import__("shutil").rmtree(self.holder, ignore_errors=True))
        self.db_path = fresh_ledger(self.holder)

    def test_online_root_does_not_hide_another_roots_offline_state(self):
        _seed(self.db_path, [
            dict(id=1, path='R:\\media\\a.mp4', name='a.mp4', code='ABC-001'),
            dict(id=2, path='S:\\media\\b.mp4', name='b.mp4', code='ABC-002'),
        ])
        with closing(sqlite3.connect(self.db_path)) as connection, \
                mock.patch.object(organize, 'translate_ledger_path', side_effect=lambda root: root), \
                mock.patch.object(organize, 'root_online', side_effect=lambda root: str(root).startswith('R:')):
            result = organize.build_plan(connection, location='local', roots={'local': ('R:\\media', 'S:\\media')},
                                         file_template='{number}')
        self.assertEqual(result['counts']['change'], 1)
        self.assertEqual(result['counts']['skip'], 1)
        self.assertEqual(result['rows'][1]['reason'], organize.SKIP_OFFLINE)

    def test_a_hung_root_is_offline_after_the_deadline_and_the_other_root_is_planned(self):
        online, hung = self.holder / 'online', self.holder / 'hung'
        online.mkdir()
        hung.mkdir()
        _seed(self.db_path, [
            dict(id=1, path='R:\\media\\a.mp4', name='a.mp4', code='ABC-001'),
            dict(id=2, path='S:\\media\\b.mp4', name='b.mp4', code='ABC-002'),
        ])
        roots = {'R:\\media': online, 'S:\\media': hung}
        started = time.monotonic()
        with closing(sqlite3.connect(self.db_path)) as connection, \
                mock.patch.object(organize, 'translate_ledger_path', side_effect=lambda root: roots[root]), \
                hung_mount([hung], 'os.scandir') as children:
            result = organize.build_plan(connection, location='local', roots={'local': ('R:\\media', 'S:\\media')},
                                         file_template='{number}')
        self.assertLess(time.monotonic() - started, 15)
        self.assertEqual((result['counts']['change'], result['counts']['skip']), (1, 1))
        self.assertEqual(result['rows'][1]['reason'], organize.SKIP_OFFLINE)
        self.assertEqual(len(children), 2)

    def test_rename_in_place_and_move_into_template_directory(self):
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\旧\\[site.com]abc123.mp4",
             "name": "[site.com]abc123.mp4", "code": "ABC-123", "title": "标题",
             "studio": "厂牌"},
        ])
        plan = _plan(self.db_path, file_template="{number}[ {title}]")
        self.assertEqual(plan["counts"]["change"], 1)
        self.assertEqual(plan["rows"][0]["action"], "rename")
        self.assertEqual(plan["rows"][0]["target_path"],
                         "R:\\media\\旧\\ABC-123 标题.mp4")

        plan = _plan(self.db_path, file_template="{number}", dir_template="{studio}")
        self.assertEqual(plan["rows"][0]["action"], "move")
        self.assertEqual(plan["rows"][0]["target_path"], "R:\\media\\厂牌\\ABC-123.mp4")

    def test_directory_scope_includes_descendants_and_excludes_prefix_siblings(self):
        _seed(self.db_path, [
            {'id': 1, 'path': r'R:\media\合集\a.mp4', 'name': 'a.mp4', 'code': 'ABC-001'},
            {'id': 2, 'path': r'R:\media\合集\子目录\b.mp4', 'name': 'b.mp4', 'code': 'ABC-002'},
            {'id': 3, 'path': r'R:\media\合集2\c.mp4', 'name': 'c.mp4', 'code': 'ABC-003'},
        ])
        plan = _plan(self.db_path, file_template='{number}', path='r:/MEDIA/合集/')
        self.assertEqual([row['asset_id'] for row in plan['rows']], [1, 2])
        self.assertEqual(plan['counts']['total'], 2)
        self.assertEqual(_plan(self.db_path, file_template='{number}', path='')['counts']['total'], 3)

    def test_scope_rejects_relative_outside_and_parent_paths(self):
        for path in ('合集', r'S:\media', r'R:\media2', r'R:\media\..\other'):
            with self.subTest(path=path), self.assertRaisesRegex(organize.OrganizeError, '整理路径'):
                _plan(self.db_path, file_template='{number}', path=path)

    def test_directory_template_uses_scope_as_base_and_checks_outside_scope_collisions(self):
        _seed(self.db_path, [
            {'id': 1, 'path': r'R:\media\合集\旧\a.mp4', 'name': 'a.mp4', 'code': 'ABC-001', 'studio': '厂牌'},
            {'id': 2, 'path': r'R:\media\合集\厂牌\ABC-001.mp4', 'name': 'ABC-001.mp4', 'code': 'ABC-001'},
        ])
        plan = _plan(self.db_path, file_template='{number}', dir_template='{studio}', path=r'R:\media\合集', asset_ids=[1])
        self.assertEqual(plan['counts']['skip'], 1)
        self.assertEqual(plan['rows'][0]['reason'], organize.SKIP_TARGET_EXISTS)
        self.assertEqual(plan['rows'][0]['target_path'], r'R:\media\合集\厂牌\ABC-001.mp4')

    def test_local_mount_scope_is_translated_to_ledger_shape(self):
        mount = self.holder / 'mounted'
        mount.mkdir()
        with mock.patch.object(organize, 'location_mounts', return_value={'local': (mount,)}):
            self.assertEqual(organize.scope_path('local', str(mount / '合集'), DECLARED), r'R:\media\合集')

    def test_filename_cleanup_needs_no_template_or_metadata(self):
        _seed(self.db_path, [{'id': 1, 'path': r'R:\media\★标题⧹⧹片段.mp4',
                             'name': '★标题⧹⧹片段.mp4'}])
        plan = _plan(self.db_path)
        self.assertEqual(plan['rows'][0]['target_path'], r'R:\media\标题 片段.mp4')

    def test_template_values_share_filename_symbol_cleanup(self):
        _seed(self.db_path, [{'id': 1, 'path': r'R:\media\old.mp4', 'name': 'old.mp4',
                             'code': 'ABC-123', 'title': '★标题💎'}])
        plan = _plan(self.db_path, file_template='{number} {title}')
        self.assertEqual(plan['rows'][0]['target_path'], r'R:\media\ABC-123 标题.mp4')

    def test_row_already_named_as_asked_is_not_listed(self):
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\ABC-123.mp4", "name": "ABC-123.mp4",
             "code": "ABC-123"},
        ])
        plan = _plan(self.db_path, file_template="{number}")
        self.assertEqual(plan["counts"]["unchanged"], 1)
        self.assertEqual(plan["rows"], [])

    def test_missing_field_skips_the_row(self):
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\x.mp4", "name": "x.mp4", "code": None},
        ])
        plan = _plan(self.db_path, file_template="{number}")
        self.assertEqual(plan["rows"][0]["action"], "skip")
        self.assertEqual(plan["rows"][0]["reason"], organize.SKIP_MISSING_FIELD)

    def test_two_rows_landing_on_one_name_keep_the_first(self):
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\a.mp4", "name": "a.mp4", "code": "ABC-123"},
            {"id": 2, "path": "R:\\media\\b.mp4", "name": "b.mp4", "code": "ABC-123"},
        ])
        plan = _plan(self.db_path, file_template="{number}")
        self.assertEqual(plan["counts"]["change"], 1)
        skipped = [row for row in plan["rows"] if row["action"] == "skip"]
        self.assertEqual(skipped[0]["reason"], organize.SKIP_TARGET_EXISTS)

    def test_scoped_plan_only_contains_requested_assets(self):
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\a.mp4", "name": "a.mp4", "code": "ABC-123"},
            {"id": 2, "path": "R:\\media\\b.mp4", "name": "b.mp4", "code": "DEF-456"},
        ])
        plan = _plan(self.db_path, file_template="{number}", asset_ids=[2])
        self.assertEqual(plan["counts"], {"total": 1, "unchanged": 0, "change": 1, "skip": 0})
        self.assertEqual([row["asset_id"] for row in plan["rows"]], [2])

    def test_offline_source_skips_every_row(self):
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\a.mp4", "name": "a.mp4", "code": "ABC-123"},
        ])
        with closing(sqlite3.connect(self.db_path)) as connection:
            plan = organize.build_plan(connection, location="local", roots=DECLARED,
                                       online=False, file_template="{number}")
        self.assertEqual(plan["counts"]["skip"], 1)
        self.assertEqual(plan["reasons"], {organize.SKIP_OFFLINE: 1})
        # 计划里记 id、界面按 code 取语言；写给人看的计划 CSV 按本机语言写成一句话。
        self.assertEqual((organize.SKIP_OFFLINE, plan["reason_codes"]), ("offline", {"offline": "labels.organize.skip.offline"}))
        path = organize.write_plan(self.holder / "plan.csv", plan["rows"])
        self.assertIn("来源未挂载", path.read_text(encoding="utf-8-sig"))

    def test_path_outside_the_declared_root_is_skipped(self):
        _seed(self.db_path, [
            {"id": 1, "path": "B:\\其它\\a.mp4", "name": "a.mp4", "code": "ABC-123"},
        ])
        plan = _plan(self.db_path, file_template="{number}")
        self.assertEqual(plan["rows"][0]["reason"], organize.SKIP_OUTSIDE_ROOT)

    def test_plan_csv_carries_every_column(self):
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\a.mp4", "name": "a.mp4", "code": "ABC-123"},
        ])
        plan = _plan(self.db_path, file_template="{number}")
        path = organize.write_plan(self.holder / "plan.csv", plan["rows"])
        header = path.read_text(encoding="utf-8-sig").splitlines()[0]
        self.assertEqual(header.split(","), organize.PLAN_FIELDS)


class ApplyTests(unittest.TestCase):
    """执行与回滚都真的动文件：`translate_ledger_path` 指到临时目录，两个平台一致。"""

    def test_committed_moves_keep_one_journal_and_resume_without_renaming_twice(self):
        for index in (1, 2):
            self._file(f'old/{index}.mp4')
        _seed(self.db_path, [dict(id=index, path=f'R:\\media\\old\\{index}.mp4',
                                  name=f'{index}.mp4', code=f'ABC-00{index}') for index in (1, 2)])
        plan = _plan(self.db_path, file_template='{number}')
        def stop(**fields):
            raise InterruptedError('simulated organize interruption')
        with closing(sqlite3.connect(self.db_path)) as connection, self.assertRaises(InterruptedError):
            organize.apply_plan(connection, plan['rows'], generated_root=self.holder, stamp='resume', progress=stop)
        with closing(sqlite3.connect(self.db_path)) as connection:
            result = organize.apply_plan(connection, plan['rows'], generated_root=self.holder, stamp='resume')
        self.assertEqual((result['moved'], result['failed']), (2, 0))
        journal = json.loads(Path(result['log_path']).read_text(encoding='utf-8'))
        self.assertEqual(len(journal['entries']), 2)
        self.assertEqual(len(list(organize.batch_log_dir(self.holder).glob('*.json'))), 1)

    def test_only_the_latest_batch_journals_are_kept_after_a_run(self):
        folder = organize.batch_log_dir(self.holder)
        folder.mkdir(parents=True)
        for day in range(1, 7):
            (folder / f'organize-2026010{day}-000000.json').write_text('{"entries": []}', encoding='utf-8')
        self._file('old/1.mp4')
        _seed(self.db_path, [dict(id=1, path='R:\\media\\old\\1.mp4', name='1.mp4', code='ABC-001')])
        plan = _plan(self.db_path, file_template='{number}')
        with closing(sqlite3.connect(self.db_path)) as connection:
            result = organize.apply_plan(connection, plan['rows'], generated_root=self.holder, stamp='20260201-000000')
        self.assertEqual(organize.latest_batch(self.holder).name, result['batch'])
        self.assertEqual(sorted(path.name for path in folder.glob('*.json')),
                         [f'organize-2026010{day}-000000.json' for day in range(3, 7)]
                         + ['organize-20260201-000000.json'])

    def setUp(self):
        self.holder = Path(tempfile.mkdtemp(prefix="peach-organize-apply-")).resolve()
        self.addCleanup(lambda: __import__("shutil").rmtree(self.holder, ignore_errors=True))
        self.media = self.holder / "media"
        self.media.mkdir()
        self.db_path = fresh_ledger(self.holder)
        patcher = mock.patch.object(organize, "translate_ledger_path", self._translate)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _translate(self, raw) -> Path:
        return self.media.joinpath(*PureWindowsPath(str(raw)).parts[2:])

    def _file(self, relative: str) -> Path:
        path = self.media / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("x", encoding="utf-8")
        return path

    def _apply(self, plan):
        with closing(sqlite3.connect(self.db_path)) as connection:
            return organize.apply_plan(connection, plan["rows"],
                                       generated_root=self.holder)

    def _three_rows(self):
        for name in ('a', 'b', 'c'):
            self._file(f'old/{name}.mp4')
        _seed(self.db_path, [dict(id=index, path=f'R:\\media\\old\\{name}.mp4', name=f'{name}.mp4',
                                  code=f'ABC-00{index}') for index, name in enumerate('abc', 1)])
        return _plan(self.db_path, file_template='{number}')

    def test_a_hung_rename_fails_only_that_row_and_the_rest_are_moved_by_a_new_worker(self):
        plan = self._three_rows()
        started = time.monotonic()
        with hung_mount([self.media / 'old/b.mp4'], 'os.rename') as children:
            result = self._apply(plan)
        self.assertLess(time.monotonic() - started, 15)
        self.assertEqual((result['moved'], result['failed']), (2, 1))
        failure = result['failures'][0]
        self.assertEqual((failure['asset_id'], failure['reason_code'], failure['retryable']),
                         (2, 'labels.organize.failure.renameFailed', True))
        self.assertEqual(sorted(path.name for path in (self.media / 'old').iterdir()),
                         ['ABC-001.mp4', 'ABC-003.mp4', 'b.mp4'])
        with closing(sqlite3.connect(self.db_path)) as connection:
            self.assertEqual(connection.execute('SELECT path FROM asset WHERE id=2').fetchone()[0],
                             'R:\\media\\old\\b.mp4')
        journal = json.loads(Path(result['log_path']).read_text(encoding='utf-8'))
        self.assertEqual([entry['asset_id'] for entry in journal['entries']], [1, 3])
        self.assertEqual(len(children), 2, '卡住的那一条之后换一个新的子进程接着做')

    def test_a_hung_rollback_keeps_that_entry_for_the_next_rollback(self):
        result = self._apply(self._three_rows())
        self.assertEqual(result['moved'], 3)
        batch = organize.latest_batch(self.holder)
        with closing(sqlite3.connect(self.db_path)) as connection, \
                hung_mount([self.media / 'old/ABC-002.mp4'], 'os.rename'):
            result = organize.rollback_batch(connection, batch)
        self.assertEqual((result['restored'], result['failed']), (2, 1))
        remaining = json.loads(batch.read_text(encoding='utf-8'))['entries']
        self.assertEqual([entry['asset_id'] for entry in remaining], [2])
        with closing(sqlite3.connect(self.db_path)) as connection:
            result = organize.rollback_batch(connection, batch)
        self.assertEqual((result['restored'], result['failed']), (3, 0))
        self.assertEqual(sorted(path.name for path in (self.media / 'old').iterdir()), ['a.mp4', 'b.mp4', 'c.mp4'])

    def test_cancel_takes_effect_before_the_next_row(self):
        plan = self._three_rows()
        seen = []

        def cancel(**fields):
            seen.append(fields['checked'])
            raise KeyboardInterrupt('simulated cancel')
        with closing(sqlite3.connect(self.db_path)) as connection, self.assertRaises(KeyboardInterrupt):
            organize.apply_plan(connection, plan['rows'], generated_root=self.holder, stamp='cancel',
                                progress=cancel)
        self.assertEqual(seen, [1])
        self.assertEqual(sorted(path.name for path in (self.media / 'old').iterdir()),
                         ['ABC-001.mp4', 'b.mp4', 'c.mp4'])

    def test_apply_moves_the_file_and_updates_the_ledger(self):
        self._file("旧/abc123.mp4")
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\旧\\abc123.mp4", "name": "abc123.mp4",
             "code": "ABC-123", "studio": "厂牌"},
        ])
        plan = _plan(self.db_path, file_template="{number}", dir_template="{studio}")
        result = self._apply(plan)
        self.assertEqual((result["moved"], result["failed"]), (1, 0))
        self.assertTrue((self.media / "厂牌" / "ABC-123.mp4").is_file())
        self.assertFalse((self.media / "旧" / "abc123.mp4").exists())
        with closing(sqlite3.connect(self.db_path)) as connection:
            row = connection.execute("SELECT path,name FROM asset WHERE id=1").fetchone()
        self.assertEqual(row, ("R:\\media\\厂牌\\ABC-123.mp4", "ABC-123.mp4"))

    def test_a_disposed_asset_in_a_saved_plan_is_left_on_disk(self):
        original = self._file('old/title.mp4')
        _seed(self.db_path, [dict(id=1, path=r'R:\media\old\title.mp4', name='title.mp4', code='ABC-123')])
        plan = _plan(self.db_path, file_template='{number}')
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute("UPDATE asset SET disposal='trash' WHERE id=1")
            connection.commit()
        result = self._apply(plan)
        self.assertEqual((result['moved'], result['failed']), (0, 1))
        self.assertTrue(original.is_file())

    def test_case_only_rename_updates_spelling_and_can_be_rolled_back(self):
        self._file('old/abc-123.mp4')
        original = r'R:\media\old\abc-123.mp4'
        target = r'R:\media\old\ABC-123.mp4'
        _seed(self.db_path, [dict(id=1, path=original, name='abc-123.mp4', code='ABC-123')])
        plan = _plan(self.db_path, file_template='{number}')
        result = self._apply(plan)
        self.assertEqual((result['moved'], result['failed']), (1, 0))
        self.assertEqual([path.name for path in (self.media / 'old').iterdir()], ['ABC-123.mp4'])
        with closing(sqlite3.connect(self.db_path)) as connection:
            self.assertEqual(connection.execute('SELECT path,name FROM asset').fetchone(),
                             (target, 'ABC-123.mp4'))
            result = organize.rollback_batch(connection, organize.latest_batch(self.holder))
            self.assertEqual((result['restored'], result['failed']), (1, 0))
            self.assertEqual(connection.execute('SELECT path,name FROM asset').fetchone(),
                             (original, 'abc-123.mp4'))
        self.assertEqual([path.name for path in (self.media / 'old').iterdir()], ['abc-123.mp4'])

    def test_case_only_move_committed_before_journal_is_not_renamed_again(self):
        self._file('old/ABC-123.mp4')
        original = r'R:\media\old\abc-123.mp4'
        target = r'R:\media\old\ABC-123.mp4'
        _seed(self.db_path, [dict(id=1, path=target, name='ABC-123.mp4', code='ABC-123')])
        plan = {'rows': [dict(asset_id=1, action='rename', current_path=original, target_path=target)]}
        with mock.patch.object(organize, '_rename', side_effect=AssertionError('已提交的行不应再次改名')):
            result = self._apply(plan)
        self.assertEqual((result['moved'], result['failed']), (1, 0))

    def test_scoped_symbol_cleanup_and_rollback_preserve_unselected_files(self):
        self._file('合集/★标题⧹⧹片段.mp4')
        self._file('合集2/★标题.mp4')
        _seed(self.db_path, [
            {'id': 1, 'path': r'R:\media\合集\★标题⧹⧹片段.mp4', 'name': '★标题⧹⧹片段.mp4'},
            {'id': 2, 'path': r'R:\media\合集2\★标题.mp4', 'name': '★标题.mp4'},
        ])
        plan = _plan(self.db_path, path=r'R:\media\合集')
        result = self._apply(plan)
        self.assertEqual((result['moved'], result['failed']), (1, 0))
        self.assertTrue((self.media / '合集/标题 片段.mp4').exists())
        self.assertTrue((self.media / '合集2/★标题.mp4').exists())
        with closing(sqlite3.connect(self.db_path)) as connection:
            self.assertEqual(connection.execute('SELECT name FROM asset WHERE id=1').fetchone()[0], '标题 片段.mp4')
            result = organize.rollback_batch(connection, organize.latest_batch(self.holder))
        self.assertEqual((result['restored'], result['failed']), (1, 0))
        self.assertTrue((self.media / '合集/★标题⧹⧹片段.mp4').exists())

    def test_rollback_puts_everything_back(self):
        self._file("旧/abc123.mp4")
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\旧\\abc123.mp4", "name": "abc123.mp4",
             "code": "ABC-123", "studio": "厂牌"},
        ])
        self._apply(_plan(self.db_path, file_template="{number}", dir_template="{studio}"))
        batch = organize.latest_batch(self.holder)
        self.assertIsNotNone(batch)
        with closing(sqlite3.connect(self.db_path)) as connection:
            result = organize.rollback_batch(connection, batch)
        self.assertEqual((result["restored"], result["failed"]), (1, 0))
        self.assertTrue((self.media / "旧" / "abc123.mp4").is_file())
        with closing(sqlite3.connect(self.db_path)) as connection:
            path = connection.execute("SELECT path FROM asset WHERE id=1").fetchone()[0]
        self.assertEqual(path, "R:\\media\\旧\\abc123.mp4")
        # 整批退回去之后它不该再出现在「回滚上一批」里。
        self.assertIsNone(organize.latest_batch(self.holder))

    def test_target_taken_on_disk_fails_only_that_row(self):
        self._file("旧/abc123.mp4")
        self._file("ABC-123.mp4")
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\旧\\abc123.mp4", "name": "abc123.mp4",
             "code": "ABC-123"},
        ])
        plan = {"rows": [{"asset_id": 1, "action": "move",
                          "current_path": "R:\\media\\旧\\abc123.mp4",
                          "target_path": "R:\\media\\ABC-123.mp4"}]}
        result = self._apply(plan)
        self.assertEqual((result["moved"], result["failed"]), (0, 1))
        self.assertEqual(result["failures"][0]["reason_code"], organize.SKIP_REASON_CODES[organize.SKIP_TARGET_EXISTS])
        self.assertTrue((self.media / "旧" / "abc123.mp4").is_file())

    def test_cross_volume_row_is_refused(self):
        self._file("旧/abc123.mp4")
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\旧\\abc123.mp4", "name": "abc123.mp4",
             "code": "ABC-123"},
        ])
        plan = {"rows": [{"asset_id": 1, "action": "move",
                          "current_path": "R:\\media\\旧\\abc123.mp4",
                          "target_path": "B:\\media\\ABC-123.mp4"}]}
        result = self._apply(plan)
        self.assertEqual(result["failures"][0]["reason_code"], organize.SKIP_REASON_CODES[organize.SKIP_CROSS_VOLUME])
        self.assertTrue((self.media / "旧" / "abc123.mp4").is_file())

    def _pikpak_plan(self):
        self._file("旧/abc123.mp4")
        _seed(self.db_path, [
            {"id": 1, "path": "A:\\x\\旧\\abc123.mp4", "name": "abc123.mp4", "code": "ABC-123"},
        ])
        roots = mock.patch.object(organize, "location_roots",
                                  lambda: {"local": (ROOT_DECLARATION,), "pikpak": ("A:\\",)})
        roots.start()
        self.addCleanup(roots.stop)
        return {"rows": [{"asset_id": 1, "action": "rename",
                          "current_path": "A:\\x\\旧\\abc123.mp4",
                          "target_path": "A:\\x\\旧\\ABC-123.mp4"}]}

    def test_pikpak_batch_without_a_verified_rename_is_refused_whole(self):
        plan = self._pikpak_plan()
        with self.assertRaisesRegex(organize.OrganizeError, "pikpak"):
            self._apply(plan)
        self.assertTrue((self.media / "旧" / "abc123.mp4").is_file())
        with self.assertRaises(organize.UnverifiedRename):
            organize._rename("A:\\x\\旧\\abc123.mp4", "A:\\x\\旧\\ABC-123.mp4")
        self.assertTrue((self.media / "旧" / "abc123.mp4").is_file())

    def test_injected_verified_rename_carries_pikpak_rows(self):
        plan = self._pikpak_plan()
        calls = []

        def verified(source, target):
            calls.append((source, target))
            self._translate(source).rename(self._translate(target))

        with organize.verified_renames("pikpak", verified):
            result = self._apply(plan)
        self.assertEqual((result["moved"], result["failed"]), (1, 0))
        self.assertEqual(calls, [("A:\\x\\旧\\abc123.mp4", "A:\\x\\旧\\ABC-123.mp4")])
        self.assertTrue((self.media / "旧" / "ABC-123.mp4").is_file())
        self.assertTrue(organize.unverified_location("pikpak"))

    def test_missing_source_is_reported_not_raised(self):
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\旧\\abc123.mp4", "name": "abc123.mp4",
             "code": "ABC-123"},
        ])
        plan = _plan(self.db_path, file_template="{number}")
        result = self._apply(plan)
        self.assertEqual((result["moved"], result["failed"]), (0, 1))
        self.assertEqual(result["failures"][0]["reason"], "源文件不存在")


class EndpointTests(unittest.TestCase):
    """整理端点：预览只读、执行要确认、模板跟着账本走。"""

    def setUp(self):
        from peach.web_state import WebContract

        self.holder = Path(tempfile.mkdtemp(prefix="peach-organize-web-")).resolve()
        self.addCleanup(lambda: __import__("shutil").rmtree(self.holder, ignore_errors=True))
        self.db_path = fresh_ledger(self.holder)
        _seed(self.db_path, [
            {"id": 1, "path": "R:\\media\\旧\\abc123.mp4", "name": "abc123.mp4",
             "code": "ABC-123", "title": "标题"},
        ])
        self.contract = WebContract(self.db_path, candidate_root=self.holder)
        for target, value in (("location_roots", lambda: DECLARED),
                              ("root_online", lambda _root: True)):
            patcher = mock.patch.object(organize, target, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_preview_writes_a_plan_and_counts_changes(self):
        from peach.web_organize import w_organize_preview

        result = w_organize_preview(self.contract, {
            "location": "local", "file_template": "{number}[ {title}]"})
        self.assertEqual(result["counts"]["change"], 1)
        self.assertEqual(result["rows"][0]["target_path"], "R:\\media\\旧\\ABC-123 标题.mp4")
        self.assertTrue(Path(result["plan_csv"]).is_file())

    def test_write_reports_existing_foreign_keys_and_rejects_new_violations(self):
        from peach.web_organize import _run_write
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute("INSERT INTO media_binding(asset_id,backend,external_id) VALUES(99999,'test','old')")
            connection.commit()
        self.assertEqual(_run_write(self.contract, 'test', lambda _: {})['existing_foreign_keys'], 1)
        def introduce(connection):
            connection.execute("INSERT INTO media_binding(asset_id,backend,external_id) VALUES(99998,'test','new')")
            connection.commit()
            return {}
        with self.assertRaisesRegex(RuntimeError, 'new_foreign_keys=1'):
            _run_write(self.contract, 'test-new', introduce)

    def test_apply_without_confirmation_is_refused(self):
        from peach.web_organize import w_organize_apply

        with self.assertRaises(ValueError):
            w_organize_apply(self.contract, {"location": "local",
                                             "file_template": "{number}"})

    def test_preview_and_apply_share_validated_scope_and_recovery_parameters(self):
        from peach.web_organize import w_organize_preview, w_organize_apply

        request = {'location': 'local', 'path': r'R:\media\旧', 'file_template': '{number}', 'dir_template': ''}
        plan = w_organize_preview(self.contract, request)
        self.assertEqual(plan['path'], request['path'])
        self.assertEqual(plan['counts']['total'], 1)
        with mock.patch.object(self.contract.organize_job, 'start', return_value={'status': 'running'}) as start:
            w_organize_apply(self.contract, {**request, 'confirm': True})
        self.assertEqual(start.call_args.kwargs['recovery']['path'], request['path'])
        self.assertEqual(start.call_args.kwargs['initial']['path'], request['path'])
        for body in ({**request, 'path': r'S:\outside'}, {**request, 'path': ['R:\\media']}):
            with self.subTest(body=body), self.assertRaisesRegex(organize.OrganizeError, '整理路径'):
                w_organize_preview(self.contract, body)
            with self.subTest(body=body), self.assertRaisesRegex(organize.OrganizeError, '整理路径'):
                w_organize_apply(self.contract, {**body, 'confirm': True})

    def test_a_scope_outside_the_source_is_a_bad_request_not_a_server_error(self):
        """整理路径填错是参数问题：接口回 400 并带原因，不是 500。"""
        from peach.api import create_app
        from peach.config import PeachSettings
        from support.web import route_client

        app = create_app(PeachSettings(db_path=self.db_path, configured=True, token=""))
        with route_client(app) as client:
            for route in ("/api/organize/preview", "/api/organize/apply"):
                with self.subTest(route=route):
                    response = client.post(route, json={"location": "local", "path": r"S:\outside",
                                                        "file_template": "{number}", "confirm": True})
                    self.assertEqual(response.status_code, 400)
                    self.assertIn("整理路径不在所选来源内", response.json()["error"])

    def test_apply_on_a_source_without_verified_rename_is_refused(self):
        from peach.web_organize import w_organize_apply

        with self.assertRaisesRegex(ValueError, "pikpak"):
            w_organize_apply(self.contract, {"location": "pikpak", "confirm": True,
                                             "file_template": "{number}"})

    def test_rollback_without_a_batch_is_refused(self):
        from peach.web_organize import w_organize_rollback

        with self.assertRaises(ValueError):
            w_organize_rollback(self.contract, {"confirm": True})

    def test_templates_round_trip_through_the_ledger(self):
        from peach.web_settings import organize_templates, w_settings

        w_settings(self.contract, {"organizeTemplates": {
            "115": {"file": "{number}[ {title}]", "dir": "{studio}"}}})
        self.assertEqual(organize_templates(self.contract),
                         {"115": {"file": "{number}[ {title}]", "dir": "{studio}"}})

    def test_escaping_template_is_refused_on_save(self):
        from peach.web_settings import w_settings

        with self.assertRaises(TemplateError):
            w_settings(self.contract, {"organizeTemplates": {
                "115": {"file": "{number}", "dir": "../{studio}"}}})

    def test_status_lists_placeholders_and_presets(self):
        from peach.web_organize import q_organize

        payload = q_organize(self.contract)
        self.assertEqual(payload["status"], "idle")
        self.assertTrue(payload["presets"])
        self.assertIn("code", [item["key"] for item in payload["placeholders"]])
        self.assertNotIn("number", [item["key"] for item in payload["placeholders"]])

    def test_custom_template_example_uses_the_registered_read_route(self):
        from peach.web_router import dispatch_api_get

        output = dispatch_api_get(None, "/api/organize/example", {
            "file_template": "自定义_{code}[_{definition}]", "dir_template": "{year}/{studio}"})
        self.assertEqual(output, {"ok": True, "example": "2024/厂牌/自定义_ABC-123_1080p.mp4"})
        invalid = dispatch_api_get(None, "/api/organize/example", {"file_template": "{code"})
        self.assertFalse(invalid["ok"])
        self.assertEqual(invalid["field"], "file")
        self.assertIn("没有配对", invalid["error"])


if __name__ == "__main__":
    unittest.main()
