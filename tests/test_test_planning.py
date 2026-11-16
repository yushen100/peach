"""验证选测边界、分片完整性与临时账本隔离。"""
from pathlib import Path
import contextlib
import io
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from scripts import ci_plan, test_runner as runner
from support.ledger import fresh_ledger


class CIFrontendOwnershipTests(unittest.TestCase):
    CI = {'GITHUB_ACTIONS': 'true', 'GITHUB_WORKFLOW': 'Test', 'GITHUB_JOB': 'python'}

    @staticmethod
    def ids(suite):
        for test in suite:
            if isinstance(test, unittest.TestSuite):
                yield from CIFrontendOwnershipTests.ids(test)
            else:
                yield test.id()

    def frontend_ids(self, environment, **shard):
        with patch.dict(os.environ, environment, clear=True), \
             patch.object(runner, 'selected_files', return_value=(runner.TESTS / 'test_frontend_build.py',
                                                                  runner.TESTS / 'test_frontend_preflight.py')):
            return list(self.ids(runner.build_suite('web', **shard)))

    def test_only_known_ci_jobs_delegate_exactly_the_node_backed_frontend_checks(self):
        local = set(self.frontend_ids({}))
        delegated = {'test_frontend_build.VitestTests.test_the_island_suite_passes',
                     'test_frontend_build.BundleFreshnessTests.test_the_committed_bundle_is_what_the_current_sources_build',
                     'test_frontend_preflight.FrontendPreflightTests.test_the_frontend_sources_typecheck',
                     'test_frontend_preflight.FrontendPreflightTests.test_frontend_sources_and_tests_pass_lint'}
        self.assertLessEqual(delegated, local)
        for job in ('python', 'web-e2e'):
            with self.subTest(job=job):
                selected = set(self.frontend_ids({**self.CI, 'GITHUB_JOB': job}))
                self.assertEqual(local - selected, delegated)
                self.assertEqual(selected - local, set())
                self.assertIn('test_frontend_build.VitestTests.test_the_island_suite_has_a_bounded_worker_pool', selected)
        for environment in ({}, {'GITHUB_ACTIONS': 'true'},
                            {**self.CI, 'GITHUB_ACTIONS': 'false'},
                            {**self.CI, 'GITHUB_WORKFLOW': 'Release'},
                            {**self.CI, 'GITHUB_JOB': 'another-job'}):
            with self.subTest(environment=environment):
                self.assertEqual(set(self.frontend_ids(environment)), local)

    def test_delegated_shards_cover_all_remaining_tests_once(self):
        serial = self.frontend_ids(self.CI)
        shards = [self.frontend_ids(self.CI, shard_index=index, shard_count=2) for index in range(2)]
        self.assertFalse(set(shards[0]) & set(shards[1]))
        self.assertCountEqual(serial, shards[0] + shards[1])
        self.assertEqual(len(serial), len(set(serial)))

    def test_python_jobs_delegate_browser_cases_and_keep_their_contract_tests(self):
        def collect(environment):
            with patch.dict(os.environ, environment, clear=True), patch.object(
                    runner, 'selected_files', return_value=(runner.TESTS / 'test_web_e2e.py',)):
                return set(self.ids(runner.build_suite('web')))
        local = collect({})
        selected = collect(self.CI)
        self.assertEqual(local - selected, {
            'test_web_e2e.WebE2ESmokeTests.test_every_route_holds_the_layout_and_runtime_invariants',
            'test_web_e2e.SetupE2ETests.test_the_first_run_page_writes_errors_back_and_finishes',
        })
        self.assertTrue(any('.MissingPrerequisiteTests.' in name for name in selected))
        for environment in ({**self.CI, 'GITHUB_JOB': 'web-e2e'},
                            {**self.CI, 'GITHUB_WORKFLOW': 'Release'}):
            self.assertEqual(collect(environment), local)

    def test_delegated_ci_returns_results_without_local_evidence(self):
        for scope in ('web', 'full'):
            for success, count, expected in ((True, 3, 0), (False, 3, 1), (True, 0, 1)):
                with self.subTest(scope=scope, success=success, count=count), \
                     patch.dict(os.environ, self.CI, clear=True), \
                     patch.object(runner, 'environment_preflight'), \
                     patch.object(runner, 'run_local_suite', return_value=(success, count, [])), \
                     patch.object(runner, 'verified_run', side_effect=AssertionError('CI 不签本机记录')), \
                     patch.object(runner.test_evidence, 'held', side_effect=AssertionError('CI 不取本机证据锁')), \
                     patch.object(runner.test_evidence, 'write', side_effect=AssertionError('CI 不写本机记录')), \
                     contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(runner.main(['--scope', scope]), expected)

    def test_local_runs_use_the_verification_path(self):
        with patch.dict(os.environ, {}, clear=True), \
             patch.object(runner, 'environment_preflight'), \
             patch.object(runner, 'verified_run', return_value=0) as verify, \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(runner.main(['--scope', 'web']), 0)
        verify.assert_called_once()


class TestPlanningTests(unittest.TestCase):
    def test_additive_exact_test_registration_selects_affected_domains_and_collection_guards(self):
        from scripts import change_impact
        before = ("SCOPES = {'checks': ('test_context_budget.py',), "
                  "'tooling': ('test_scripts.py',), 'catalog': ('test_search_suggest.py',)}\n"
                  "AUTO_SCOPE_FILES = {}\ndef execute(): return 1\n")
        after = before.replace("'test_scripts.py',", "'test_scripts.py', 'test_new_script.py',")
        contents = {'scripts/test_runner.py': (before, after)}
        self.assertEqual(runner.scopes_for_changes(contents, contents=contents)[0], ('checks', 'tooling'))
        planned = ci_plan.plan('pull_request', list(contents), contents)
        self.assertFalse(planned['wide'])
        self.assertFalse(planned['browser'])
        first = change_impact.signatures('scripts/test_runner.py', before)
        second = change_impact.signatures('scripts/test_runner.py', after)
        from scripts import test_evidence
        self.assertTrue(test_evidence.valid_manifest({'files': {}, 'signatures': {'scripts/test_runner.py': first}}))
        for entries in ({}, [['tooling', [None]]], [['tooling', []], ['tooling', []]]):
            self.assertFalse(test_evidence.valid_manifest({'files': {}, 'signatures': {
                'scripts/test_runner.py': {**first, 'scope_entries': entries}}}))
        self.assertFalse(test_evidence.valid_manifest({'files': {}, 'signatures': {'other.py': first}}))
        paths, kinds = change_impact.delta(
            {'files': {'scripts/test_runner.py': [420, 'before', '100644']}, 'signatures': {'scripts/test_runner.py': first}},
            {'files': {'scripts/test_runner.py': [420, 'after', '100644']}, 'signatures': {'scripts/test_runner.py': second}})
        self.assertEqual(runner.scopes_for_changes(paths, kinds=kinds)[0], ('checks', 'tooling'))
        catalog = before.replace("'test_search_suggest.py',", "'test_search_suggest.py', 'test_new_catalog.py',")
        self.assertEqual(runner.scopes_for_changes(['scripts/test_runner.py'], contents={
            'scripts/test_runner.py': (before, catalog)})[0], ('checks', 'catalog', 'tooling'))

    def test_registration_narrowing_does_not_hide_changes_to_existing_coverage_or_execution(self):
        before = ("SCOPES = {'checks': ('test_context_budget.py',), "
                  "'tooling': ('test_scripts.py',), 'catalog': ('test_search_suggest.py',)}\n"
                  "AUTO_SCOPE_FILES = {}\ndef execute(): return 1\n")
        changed = [before.replace("'test_scripts.py',", ''),
                   before.replace("'test_scripts.py',", "'test_scripts.py', 'test_*.py',"),
                   before.replace("'test_scripts.py',", "'test_scripts.py', '../outside.py',"),
                   before.replace("'test_scripts.py',", "'test_new_script.py', 'test_scripts.py',"),
                   before.replace('return 1', 'return 2'),
                   before.replace('AUTO_SCOPE_FILES = {}', "AUTO_SCOPE_FILES = {'x.py': ('checks',)}"),
                   before + "SCOPES['tooling'] = ()\n",
                   before.replace("'catalog':", "'new_scope':")]
        for after in changed:
            with self.subTest(after=after):
                self.assertEqual(runner.scopes_for_changes(['scripts/test_runner.py'], contents={
                    'scripts/test_runner.py': (before, after)})[0], ('full',))

    def test_checks_ci_omits_runtime_tool_installation_and_keeps_platforms(self):
        for path in ("README.md", "CONTRIBUTING.md", ".github/PULL_REQUEST_TEMPLATE.md", "docs/TESTING.md"):
            with self.subTest(path=path):
                result = ci_plan.plan("push", [path])
                rows = result["matrix"]["include"]
                self.assertEqual({row["os"] for row in rows}, {"windows-latest", "macos-latest"})
                self.assertTrue(all(not row["runtime_tools"] for row in rows))
                self.assertIn("python", result["required_jobs"])
                self.assertFalse(result["browser"])
        for event, paths in (("workflow_dispatch", ["README.md"]),
                             ("push", ["README.md", "src/peach/server.py"]),
                             ("push", ["frontend/src/react/boardui/ORIGIN.md"]),
                             ("push", ["unknown.runtime"])):
            self.assertTrue(all(row["runtime_tools"] for row in ci_plan.plan(event, paths)["matrix"]["include"]))

    def test_comments_and_display_metadata_select_checks_without_hiding_logic(self):
        fixtures = {
            'tests/support/ledger.py': ('x = 1\n', '# 说明\nx = 1\n'),
            'scripts/test_runner.py': ('x = 1\n', 'x = 1 # 说明\n'),
            'frontend/package.json': ('{"description":"a","scripts":{"test":"x"}}',
                                      '{"description":"b","scripts":{"test":"x"}}'),
            'pyproject.toml': ('[project]\ndependencies=[]\n', '# 说明\n[project]\ndependencies=[]\n'),
        }
        for path, content in fixtures.items():
            with self.subTest(path=path):
                self.assertEqual(runner.scopes_for_changes([path], contents={path: content})[0], ('checks',))
                plan = ci_plan.plan('pull_request', [path], {path: content})
                self.assertFalse(plan['browser'])
                self.assertFalse(plan['frontend'])
        for content in (('x = 1', 'x = 2'), ('"help a"', '"help b"'), ('x = 1', 'x = (')):
            self.assertEqual(runner.scopes_for_changes(['tests/support/ledger.py'],
                                                     contents={'tests/support/ledger.py': content})[0], ('full',))

    def test_ci_jobs_follow_their_own_inputs(self):
        for path in ('tests/test_follow_store.py', 'tests/test_metadata_sources.py',
                     '.github/workflows/project-board.yml'):
            with self.subTest(path=path):
                plan = ci_plan.plan('pull_request', [path])
                self.assertFalse(plan['browser'])
                self.assertFalse(plan['wheel'])
        for path in ('src/peach/server.py', 'src/peach/auth.py', 'frontend/src/core/index.ts',
                     'tests/test_web_e2e.py', 'frontend/e2e/setup.test.ts'):
            with self.subTest(path=path):
                self.assertTrue(ci_plan.plan('pull_request', [path])['browser'])
        self.assertTrue(ci_plan.plan('pull_request', ['.github/workflows/release.yml'])['wheel'])
        self.assertTrue(ci_plan.plan('pull_request', ['.github/workflows/upgrade-smoke.yml'])['wheel'])
        self.assertTrue(ci_plan.plan('pull_request', ['.github/workflows/unknown.yml'])['wide'])

    def test_chart_workflow_checks_tooling_and_preserves_mixed_runtime_coverage(self):
        path = '.github/workflows/star-history.yml'
        self.assertEqual(runner.scopes_for_changes([path])[0], ('tooling',))
        plan = ci_plan.plan('pull_request', [path])
        for job in ('wide', 'browser', 'frontend', 'vendor', 'wheel'):
            with self.subTest(job=job):
                self.assertFalse(plan[job])
        self.assertTrue(ci_plan.plan('pull_request', [path, 'src/peach/server.py'])['browser'])

    def setUp(self):
        environment = patch.dict(os.environ, {'PEACH_TEST_FOCUS': '', 'PEACH_E2E_FILES': ''})
        environment.start()
        self.addCleanup(environment.stop)

    def test_every_supplementary_test_id_names_a_real_test(self):
        """域的补充用例按名字装载：被引用的用例改名后，装进来的是一个必然报错的占位用例，
        选到这一域的 auto 都签不出记录。在这里按名字装一遍，改名当场就红。"""
        loader = unittest.TestLoader()
        sys.path[:0] = [str(runner.ROOT), str(runner.TESTS)]
        try:
            for scope, test_ids in runner.SCOPE_TEST_IDS.items():
                for test_id in test_ids:
                    with self.subTest(scope=scope, test_id=test_id):
                        loaded = list(loader.loadTestsFromName(test_id))
                        self.assertEqual([test.id().split(".", 1)[1] for test in loaded], [test_id.split(".", 1)[1]])
        finally:
            del sys.path[:2]

    def test_unspawnable_tools_stop_before_any_test_shard_starts(self):
        output = io.StringIO()
        with patch.object(runner.test_evidence, 'unspawnable_tools', return_value=('uv',)), \
             patch.object(runner, 'build_suite', side_effect=AssertionError('环境不成立时不应加载测试')), \
             contextlib.redirect_stdout(output):
            with self.assertRaisesRegex(SystemExit, '3'):
                runner.main(['--scope', 'checks'])
        self.assertIn('uv', output.getvalue())
        self.assertIn('正常 PowerShell 权限', output.getvalue())

    def test_a_tool_this_scope_never_starts_only_warns(self):
        """受限环境里起不动的工具，只有本次真会用到时才判失败。

        `checks` 一个媒体用例都不加载，让媒体工具的权限错误挡住它，等于把人赶出正式
        入口去手拼命令。工具仍然报出来，后面真出问题时看得见这一行。
        """
        # 名字拼出来：判据是「选中的测试源码里出现了这个工具名」，而本文件自己就在
        # `checks` 域里，直接写出来这一域就自证需要它了。
        blocked = 'ff' + 'mpeg'
        self.assertNotIn(blocked, runner.tools_needed_by(('checks',)))
        self.assertIn(blocked, runner.tools_needed_by(('media',)))
        output = io.StringIO()
        with patch.object(runner.test_evidence, 'unspawnable_tools', return_value=(blocked,)), \
             contextlib.redirect_stdout(output):
            runner.environment_preflight(('checks',))
            with self.assertRaisesRegex(SystemExit, '3'):
                runner.environment_preflight(('media',))
        self.assertIn('本次范围不需要', output.getvalue())

    def test_shards_and_the_explicit_switch_skip_the_preflight(self):
        """分片子进程的域由父进程定下，父进程已经查过同一套工具；开关留给判断过的人。"""
        with patch.object(runner.test_evidence, 'unspawnable_tools', return_value=('git',)), \
             contextlib.redirect_stdout(io.StringIO()):
            runner.environment_preflight(('checks',), shard_count=2)
            with self.assertRaisesRegex(SystemExit, '3'):
                runner.environment_preflight(('checks',), shard_count=1)
        switched = io.StringIO()
        with patch.object(runner.test_evidence, 'unspawnable_tools', return_value=('git',)), \
             patch.dict(os.environ, {'PEACH_SKIP_PREFLIGHT': '1'}), \
             contextlib.redirect_stdout(switched):
            runner.environment_preflight(('checks',))
        self.assertIn('PEACH_SKIP_PREFLIGHT=1', switched.getvalue())

    def test_dependency_changes_require_full_but_tool_version_does_not(self):
        source = '[project]\nrequires-python=">=3.12"\ndependencies=["demo==1"]\n[tool.uv]\nrequired-version="==1"\n'
        for replacement, expected in ((source.replace('==1"\n', '==2"\n'), ('packaging',)),
                                      (source.replace('demo==1', 'demo==2'), ('full',)),
                                      (source.replace('>=3.12', '>=3.14'), ('full',)),
                                      ('[invalid', ('full',))):
            with self.subTest(replacement=replacement):
                scopes, _ = runner.scopes_for_changes(['pyproject.toml'], contents={
                    'pyproject.toml': (source, replacement)})
                self.assertEqual(scopes, expected)
        self.assertEqual(runner.scopes_for_changes(['pyproject.toml'])[0], ('full',))

    def test_matrix_keeps_full_manual_and_platform_coverage(self):
        result = ci_plan.plan('workflow_dispatch', ['web/app.js'])
        rows = result['matrix']['include']
        self.assertEqual(len([r for r in rows if r['scope'] == 'full']), 6)
        self.assertEqual({r['os'] for r in rows}, {'windows-latest', 'macos-latest'})
        self.assertEqual({r['python'] for r in rows}, {'3.14'})
        self.assertTrue(all(r['scope'] == 'full' for r in rows))
        self.assertEqual(len(result['wheel_matrix']['include']), 2)

    def test_browser_partitions_cover_every_file_once_and_balance_recorded_duration(self):
        matrix = ci_plan.browser_matrix()['include']
        groups = [json.loads(row['files']) for row in matrix]
        expected = {path.relative_to(runner.ROOT).as_posix()
                    for path in (runner.ROOT / 'frontend/e2e').rglob('*.test.ts')}
        collected = [name for group in groups for name in group]
        self.assertEqual(set(collected), expected)
        self.assertEqual(len(collected), len(set(collected)))
        self.assertTrue(all(groups))
        costs = [row['estimated_seconds'] for row in matrix]
        self.assertLess(max(costs) - min(costs), 60)

    def test_windows_python_partitions_balance_recorded_cost_and_keep_every_case(self):
        seconds = json.loads((runner.ROOT / 'scripts/ci-python-timings.json').read_text(encoding='utf-8'))['seconds']
        files = runner.selected_files('full')
        with patch.dict(os.environ, {**CIFrontendOwnershipTests.CI, 'RUNNER_OS': 'Windows'}):
            groups = [runner.assigned_files(files, index, 4) for index in range(4)]
            serial = list(CIFrontendOwnershipTests.ids(runner.build_suite('full')))
            collected = [name for index in range(4) for name in CIFrontendOwnershipTests.ids(
                runner.build_suite('full', shard_index=index, shard_count=4))]
        self.assertCountEqual(serial, collected)
        self.assertEqual(len(collected), len(set(collected)))
        self.assertCountEqual(files, [path for group in groups for path in group])
        costs = [sum(seconds.get(path.stem, 1) for path in group) for group in groups]
        self.assertLess(max(costs) - min(costs), 5)
        self.assertGreater(len(groups[0]), 1)

    def test_unassigned_ci_and_macos_keep_filename_partitions(self):
        files = [runner.TESTS / f'test_selected_{index}.py' for index in range(8)]
        for environment in ({'RUNNER_OS': 'Windows'}, {**CIFrontendOwnershipTests.CI, 'RUNNER_OS': 'macOS'}):
            with self.subTest(environment=environment), patch.dict(os.environ, environment, clear=True):
                self.assertEqual(runner.assigned_files(files, 1, 4), set(files[1::4]))

    def test_broad_auto_matrix_keeps_each_selected_test_once(self):
        for paths in (['src/peach/mp4repair.py', 'src/peach/web_media_repair.py'],
                      ['src/peach/web_catalog.py']):
            with self.subTest(paths=paths):
                scopes, _ = runner.scopes_for_changes(paths)
                plan = ci_plan.plan('push', paths)
                self.assertFalse(plan['wide'])
                for system, count, runner_os in (('windows-latest', 4, 'Windows'),
                                                 ('macos-latest', 2, 'macOS')):
                    with self.subTest(system=system):
                        rows = [row for row in plan['matrix']['include'] if row['os'] == system]
                        self.assertEqual(len(rows), count)
                        self.assertTrue(all(row['scope'] == 'auto' for row in rows))
                        with patch.dict(os.environ, {**CIFrontendOwnershipTests.CI, 'RUNNER_OS': runner_os}):
                            serial = list(CIFrontendOwnershipTests.ids(runner.build_suite(*scopes)))
                            collected = [name for row in rows for name in CIFrontendOwnershipTests.ids(
                                runner.build_suite(*scopes, shard_index=row['shard_index'],
                                                   shard_count=row['shard_count']))]
                        self.assertTrue(serial)
                        self.assertEqual(len(serial), len(set(serial)))
                        self.assertCountEqual(serial, collected)

    def test_auto_partition_threshold_counts_unique_selected_files(self):
        for count, windows_count, macos_count in ((149, 1, 1), (150, 4, 2)):
            with self.subTest(count=count), patch.object(runner, 'selected_files', return_value=tuple(
                    runner.TESTS / f'test_selected_{index}.py' for index in range(count))):
                plan = ci_plan.plan('pull_request', ['src/peach/web_catalog.py'])
                self.assertFalse(plan['wide'])
                for system, expected in (('windows-latest', windows_count), ('macos-latest', macos_count)):
                    with self.subTest(system=system):
                        rows = [row for row in plan['matrix']['include'] if row['os'] == system]
                        self.assertEqual(len(rows), expected)
                        self.assertTrue(all(row['scope'] == 'auto' for row in rows))

    def test_explicit_roots_use_their_own_browser_files_and_weights_for_full_and_auto(self):
        with tempfile.TemporaryDirectory() as directory:
            for name, seconds in (('main', {'alpha': 7}), ('worker', {'beta': 40, 'gamma': 90})):
                root = (Path(directory) / name).resolve()
                (root / 'frontend/e2e').mkdir(parents=True)
                (root / 'scripts').mkdir()
                weights = {f'frontend/e2e/{name}.test.ts': value for name, value in seconds.items()}
                for path in weights:
                    (root / path).touch()
                (root / 'scripts/ci-browser-timings.json').write_text(
                    json.dumps({'seconds': weights}), encoding='utf-8')
                for event, count, scope in (('pull_request', 2, 'auto'), ('workflow_dispatch', 6, 'full')):
                    with self.subTest(root=root.name, event=event):
                        planned = ci_plan.plan(event, [next(iter(weights))], root=root)
                        rows = planned['matrix']['include']
                        self.assertEqual(len(rows), count)
                        self.assertTrue(all(row['scope'] == scope for row in rows))
                        browsers = planned['browser_matrix']['include']
                        self.assertCountEqual([path for row in browsers for path in json.loads(row['files'])], weights)
                        self.assertCountEqual([row['estimated_seconds'] for row in browsers], seconds.values())

    def test_explicit_roots_count_their_python_files_at_the_auto_partition_threshold(self):
        with tempfile.TemporaryDirectory() as directory:
            for name, count, windows_count, macos_count in (('main', 149, 1, 1), ('worker', 150, 4, 2)):
                root = (Path(directory) / name).resolve()
                (root / 'tests').mkdir(parents=True)
                (root / 'frontend/e2e').mkdir(parents=True)
                (root / 'frontend/e2e/smoke.test.ts').touch()
                for index in range(count):
                    (root / f'tests/test_follow_generated_{index}.py').touch()
                for scope in ('full', 'follow'):
                    selected = runner.selected_files(scope, root=root)
                    self.assertEqual(len(selected), count)
                    self.assertTrue(all(path.parent == root / 'tests' for path in selected))
                planned = ci_plan.plan('pull_request', ['src/peach/follow.py'], root=root)
                self.assertFalse(planned['wide'])
                for system, expected in (('windows-latest', windows_count), ('macos-latest', macos_count)):
                    with self.subTest(root=root.name, system=system):
                        rows = [row for row in planned['matrix']['include'] if row['os'] == system]
                        self.assertEqual(len(rows), expected)
                        self.assertTrue(all(row['scope'] == 'auto' for row in rows))

    def test_explicit_roots_keep_separate_test_consumers_and_relative_source_importers(self):
        with tempfile.TemporaryDirectory() as directory:
            roots = [(Path(directory) / name).resolve() for name in ('main', 'worker')]
            files = ({'tests/test_follow_web.py': 'from peach import media\n',
                      'src/peach/web_reader.py': 'from . import unmapped_hub\n'},
                     {'tests/test_code_creators.py': 'from peach import media, unmapped_hub\n'})
            for root, contents in zip(roots, files):
                for name, source in contents.items():
                    path = root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(source, encoding='utf-8')
                (root / 'src/peach').mkdir(parents=True, exist_ok=True)
                (root / 'src/peach/unmapped_hub.py').touch()
            for index in (0, 1, 0):
                root = roots[index]
                with self.subTest(root=root.name):
                    scopes = runner.scopes_for_changes(['src/peach/media.py'], root=root)[0]
                    self.assertEqual(scopes, (('follow', 'media', 'web'), ('media', 'metadata'))[index])
                    hub_scopes = runner.scopes_for_changes(['src/peach/unmapped_hub.py'], root=root)[0]
                    self.assertEqual(hub_scopes, (('catalog',), ('metadata',))[index])
                    self.assertEqual(ci_plan.browser_input('src/peach/media.py', root=root), index == 0)

    def test_document_changes_avoid_optional_jobs_and_unknown_changes_require_them(self):
        documents = ci_plan.plan('pull_request', ['docs/TESTING.md'])
        self.assertEqual(documents['required_jobs'], ['plan', 'python', 'workflow-lint', 'frontend-ready'])
        unknown = ci_plan.plan('pull_request', ['unknown.file'])
        self.assertLessEqual({'web-e2e', 'web-bundle', 'web-vendor', 'wheel-smoke'},
                             set(unknown['required_jobs']))
        mainline = ci_plan.plan('push', ['docs/TESTING.md'])
        self.assertFalse(mainline['wide'])
        self.assertEqual(mainline['required_jobs'], documents['required_jobs'])
        manual = ci_plan.plan('workflow_dispatch', ['docs/TESTING.md'])
        self.assertTrue(manual['wide'])
        self.assertLessEqual({'web-e2e', 'web-bundle', 'web-vendor', 'wheel-build', 'wheel-smoke'},
                             set(manual['required_jobs']))

    def test_result_gate_rejects_missing_failed_cancelled_or_required_skipped_jobs(self):
        required = ['plan', 'python', 'workflow-lint', 'frontend-ready', 'web-e2e']
        passed = {name: {'result': 'success'} for name in required}
        ci_plan.validate_results({**passed, 'web-vendor': {'result': 'skipped'}}, required)
        for result in ('failure', 'cancelled', 'skipped'):
            with self.subTest(result=result), self.assertRaises(ValueError):
                ci_plan.validate_results({**passed, 'web-e2e': {'result': result}}, required)
        with self.assertRaises(ValueError):
            ci_plan.validate_results({name: value for name, value in passed.items() if name != 'python'}, required)
        with self.assertRaises(ValueError):
            ci_plan.validate_results(passed, [])

    def test_result_gate_names_the_failed_upstream_when_no_plan_was_produced(self):
        results = {'workflow-lint': {'result': 'failure'}, 'plan': {'result': 'skipped'}}
        with patch.object(sys, 'argv', ['ci_plan.py', '--verify-results']), \
                patch.dict(ci_plan.os.environ, {'RESULTS': json.dumps(results), 'REQUIRED_JOBS': ''}), \
                self.assertRaises(SystemExit) as stopped:
            ci_plan.main()
        self.assertIn("'workflow-lint': 'failure'", str(stopped.exception.code))

    def test_frontend_gate_requires_only_the_selected_frontend_jobs(self):
        required = ci_plan.plan('push', ['frontend/package-lock.json'])['required_jobs']
        passed = {name: {'result': 'success'} for name in ('plan', 'web-bundle', 'web-vendor')}
        ci_plan.validate_results(passed, required, phase='frontend')
        for name in ('web-bundle', 'web-vendor'):
            for result in ('missing', 'failure', 'cancelled', 'skipped'):
                results = dict(passed)
                if result == 'missing':
                    results.pop(name)
                else:
                    results[name] = {'result': result}
                with self.subTest(name=name, result=result), self.assertRaises(ValueError):
                    ci_plan.validate_results(results, required, phase='frontend')

    def test_frontend_gate_allows_document_plans_and_rejects_an_invalid_plan(self):
        required = ci_plan.plan('pull_request', ['docs/TESTING.md'])['required_jobs']
        results = {'plan': {'result': 'success'}, 'web-bundle': {'result': 'skipped'},
                   'web-vendor': {'result': 'skipped'}}
        ci_plan.validate_results(results, required, phase='frontend')
        for result in ('failure', 'cancelled', 'skipped'):
            with self.subTest(result=result), self.assertRaises(ValueError):
                ci_plan.validate_results({**results, 'plan': {'result': result}}, required, phase='frontend')
        with self.assertRaises(ValueError):
            ci_plan.validate_results(results, [], phase='frontend')
        with self.assertRaises(ValueError):
            ci_plan.validate_results(results, required, phase='unknown')

    def test_dependency_and_manual_runs_cover_both_systems(self):
        for event, paths in [('push', ['uv.lock']), ('pull_request', ['migrations/0025.sql']),
                             ('workflow_dispatch', [])]:
            result = ci_plan.plan(event, paths)
            self.assertTrue(result['wide'])
            self.assertEqual({r['os'] for r in result['matrix']['include'] if r['scope'] == 'full'},
                             {'macos-latest', 'windows-latest'})
            wheels = result['wheel_matrix']['include']
            self.assertCountEqual(wheels, [{'os': 'windows-latest', 'python': '3.14'},
                                          {'os': 'macos-latest', 'python': '3.14'}])

    def test_pull_request_uses_changed_domains(self):
        rows = ci_plan.plan('pull_request', ['src/peach/follow_store.py'])['matrix']['include']
        self.assertTrue(any(r['scope'] == 'auto' for r in rows))
        self.assertFalse(any(r['scope'] == 'full' for r in rows))
        self.assertEqual(runner.scopes_for_changes(['scripts/localize_performer_names.py'])[0],
                         ('metadata', 'tooling'))
        self.assertEqual(runner.scopes_for_changes(['README.md'])[0], ('checks',))
        for document in ('docs/TESTING.md', 'docs/CLOUDDRIVE.md', 'docs/OPERATIONS.md'):
            with self.subTest(document=document):
                self.assertEqual(runner.scopes_for_changes([document])[0], ('checks',))

    def test_library_processing_selects_the_domains_that_exercise_it(self):
        """`library_processing.py` 的模块名与测试文件名对不上，按名字推不出域。

        验它的测试是 `test_metadata_library.py`（metadata 与 web 都登记）、
        `test_stale_candidates.py`（metadata）和 `test_web_e2e.py`（web）；
        映射缺了这一条，改处理任务就整轮退化成 `full`。
        """
        scopes, _ = runner.scopes_for_changes(['src/peach/library_processing.py'])
        self.assertLessEqual({'metadata', 'web'}, set(scopes))
        selected = {path.name for scope in scopes for path in runner.selected_files(scope)}
        self.assertLessEqual({'test_metadata_library.py', 'test_stale_candidates.py',
                              'test_web_e2e.py'}, selected)

    def test_missing_git_base_selects_wide_matrix(self):
        with patch.object(sys, 'argv', ['ci_plan.py', '--event', 'pull_request', '--base', 'missing']), \
             patch.object(runner, 'changed_files', side_effect=subprocess.CalledProcessError(1, 'git')), \
             patch.dict(ci_plan.os.environ, {}, clear=True), contextlib.redirect_stdout(io.StringIO()) as output:
            ci_plan.main()
        self.assertTrue(ci_plan.json.loads(output.getvalue())['wide'])

    def test_mainline_plan_passes_the_verified_baseline_to_test_jobs_and_falls_back_when_missing(self):
        for baseline, wide in (('verified', False), (ValueError('未取得'), True)):
            with self.subTest(baseline=baseline), \
                    patch.object(sys, 'argv', ['ci_plan.py', '--event', 'push', '--base', 'unverified']), \
                    patch.object(ci_plan, 'github_verified_base', **({'side_effect': baseline} if isinstance(baseline, Exception) else {'return_value': baseline})), \
                    patch.object(runner, 'changed_files', return_value=['README.md']) as changed, \
                    patch.object(runner, 'changed_contents', return_value={}), \
                    contextlib.redirect_stdout(io.StringIO()) as output:
                ci_plan.main()
            result = json.loads(output.getvalue())
            self.assertEqual(result['wide'], wide)
            if not wide:
                self.assertEqual(result['base'], 'verified')
                self.assertEqual(changed.call_args.args[1], 'verified')

    def test_github_baseline_accepts_only_successful_push_ancestors(self):
        runs = [{'head_sha': sha, 'conclusion': result, 'event': 'push', 'head_branch': 'master'}
                for sha, result in (('failed', 'failure'), ('diverged', 'success'), ('ancestor', 'success'))]
        with patch.dict(os.environ, {'GITHUB_REPOSITORY':'peach-mitao/peach'}), \
                patch.object(ci_plan.subprocess, 'check_output', side_effect=[json.dumps({'workflow_runs':runs}), 'head']), \
                patch('scripts.ci_scope.ancestor_of_head', return_value=lambda sha:sha=='ancestor'):
            self.assertEqual(ci_plan.github_verified_base(runner.ROOT), 'ancestor')

    def test_actions_output_passes_a_git_revision_and_json_values_to_downstream_jobs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()

            (root / 'frontend/e2e').mkdir(parents=True)
            (root / 'frontend/e2e/smoke.test.ts').touch()

            def git(*args):
                return subprocess.check_output(
                    ['git', '-C', str(root), '-c', 'user.name=Test',
                     '-c', 'user.email=test@example.invalid', *args],
                    text=True, encoding='utf-8').strip()

            git('init', '--quiet')
            readme = root / 'README.md'
            readme.write_text('first\n', encoding='utf-8')
            git('add', 'README.md')
            git('commit', '--quiet', '-m', 'first')
            base = git('rev-parse', 'HEAD')
            readme.write_text('second\n', encoding='utf-8')
            git('add', 'README.md')
            git('commit', '--quiet', '-m', 'second')
            output_file = root / 'actions-output'
            with patch.object(sys, 'argv', ['ci_plan.py', '--event', 'push', '--base', base]), \
                    patch.object(ci_plan, '__file__', str(root / 'scripts' / 'ci_plan.py')), \
                    patch.object(ci_plan, 'github_verified_base', return_value=base), \
                    patch.dict(os.environ, {'GITHUB_OUTPUT': str(output_file)}), \
                    contextlib.redirect_stdout(io.StringIO()) as output:
                ci_plan.main()
            values = dict(line.split('=', 1) for line in output_file.read_text('utf-8').splitlines())
            self.assertEqual(values['base'], base)
            self.assertEqual(git('diff', '--name-only', values['base'] + '...HEAD'), 'README.md')
            result = json.loads(output.getvalue())
            for key in result.keys() - {'base'}:
                self.assertEqual(json.loads(values[key]), result[key])

    def test_venv_interpreter_path_keeps_environment_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            suffix = 'Scripts/python.exe' if sys.platform == 'win32' else 'bin/python'
            executable = root / '.venv' / suffix
            executable.parent.mkdir(parents=True)
            executable.touch()
            with patch.object(Path, 'resolve', side_effect=AssertionError('不能解引用 venv 解释器')):
                self.assertEqual(runner.test_evidence.interpreter(root), executable)

    def test_shards_cover_every_case_once_including_supplements(self):
        def ids(suite):
            for case in suite:
                if isinstance(case, unittest.TestSuite):
                    yield from ids(case)
                else:
                    yield case.id()
        # 使用实际域注册验证交集和补充用例，不执行其中的测试。
        serial = list(ids(runner.build_suite('follow', 'tooling')))
        shards = [list(ids(runner.build_suite('follow', 'tooling', shard_index=i, shard_count=2)))
                  for i in range(2)]
        self.assertEqual(len(serial), len(set(serial)))
        self.assertFalse(set(shards[0]) & set(shards[1]))
        self.assertCountEqual(serial, shards[0] + shards[1])

    def test_modules_without_a_namesake_test_run_where_their_importers_are_tested(self):
        """按名字推不出测试的模块，跟着直接导入它的测试与源码文件选域；推不出时仍是 full。"""
        index = (
            {'test_follow_web.py': frozenset({'hub', 'ring_b'})},
            {'src/peach/hub.py': frozenset(), 'src/peach/web_reader.py': frozenset({'hub'}),
             'src/peach/lonely.py': frozenset(), 'src/peach/orphan_user.py': frozenset({'lonely'}),
             'src/peach/ring_a.py': frozenset({'ring_b'}), 'src/peach/ring_b.py': frozenset({'ring_a'}),
             'src/peach/shared.py': frozenset(), 'src/peach/web_ring.py': frozenset({'ring_a'})},
            frozenset({'shared'}),
        )

        def scopes(path):
            return runner.scopes_for_changes([path])[0]
        with patch.object(runner, '_import_index', return_value=index):
            # 测试 test_follow_web（follow、web）直接导入；源码 web_reader 按前缀归 catalog。
            self.assertEqual(scopes('src/peach/hub.py'), ('follow', 'catalog', 'web'))
            # 唯一的导入者自己也推不出域：未知面。
            self.assertEqual(scopes('src/peach/lonely.py'), ('full',))
            # 互相导入的一组合起来算：ring_b 的测试与 ring_a 的外部导入者都算进来。
            self.assertEqual(scopes('src/peach/ring_a.py'), ('follow', 'catalog', 'web'))
            self.assertEqual(scopes('src/peach/ring_b.py'), ('follow', 'catalog', 'web'))
            # 共享测试设施导入的模块影响所有用例。
            self.assertEqual(scopes('src/peach/shared.py'), ('full',))
        self.assertEqual(scopes('tests/test_ledger_revision.py'), ('core',))
        self.assertEqual(scopes('.gitlab-ci.yml'), ('tooling', 'packaging'))
        self.assertEqual(scopes('src/peach/not_a_module.py'), ('full',))

    def test_relative_and_absolute_imports_name_the_peach_module(self):
        with tempfile.TemporaryDirectory() as directory:
            nested = runner.ROOT / 'src' / 'peach' / 'sources'
            path = Path(directory) / 'sample.py'
            path.write_text('from peach import alpha, beta\nimport peach.gamma.sub\n'
                            'def later():\n    from peach.delta import thing\n', encoding='utf-8')
            self.assertEqual(runner._imported_modules(path), {'alpha', 'beta', 'gamma', 'delta'})
        # 包内相对导入按文件深度回到 `peach`；子包里的单点相对导入指子包自己，不算。
        with patch.object(Path, 'read_text', return_value='from . import alpha\nfrom .. import beta\nfrom ..gamma import x\n'):
            self.assertEqual(runner._imported_modules(nested / 'example.py'), {'beta', 'gamma'})
            self.assertEqual(runner._imported_modules(runner.ROOT / 'src' / 'peach' / 'example.py'), {'alpha'})

    def test_timed_shard_plan_covers_every_file_once_and_starts_with_the_longest(self):
        names = [f'test_{letter}.py' for letter in 'abcdefg'] + ['test_web_e2e.py']
        seconds = {'test_a': 300.0, 'test_b': 120.0, 'test_c': 100.0, 'test_d': 90.0, 'test_e': 10.0,
                   'test_f': 10.0, 'test_g': 50.0, 'test_web_e2e': 1000.0}
        plan = runner.shard_plan(names, 4, seconds)
        self.assertEqual(len(plan), 4)
        self.assertCountEqual([name for shard in plan for name in shard], names)
        self.assertEqual(plan[0], ['test_web_e2e.py'], '最重的文件独占一片并第一个派发')

        def total(shard):
            return sum(seconds[name.removesuffix('.py')] for name in shard)
        totals = [total(shard) for shard in plan]
        self.assertEqual(totals, sorted(totals, reverse=True))
        self.assertLessEqual(max(totals[1:]) - min(totals[1:]), 120.0)
        # 本机还没有实测表：按个数均分，浏览器冒烟照样独占首片。
        empty = runner.shard_plan(names, 4, {})
        self.assertEqual(empty[0], ['test_web_e2e.py'])
        self.assertEqual(sorted(len(shard) for shard in empty[1:]), [2, 2, 3])

    def test_zero_duration_files_fill_each_shard_and_run_once(self):
        for size in (2, 5, 9):
            names = [f'test_{index}.py' for index in range(size)]
            seconds = {name.removesuffix('.py'): 0.0 for name in names}
            for count in (1, 2, 4, 12):
                with self.subTest(size=size, count=count):
                    plan = runner.shard_plan(names, count, seconds)
                    self.assertEqual(len(plan), min(size, count))
                    self.assertTrue(all(plan))
                    self.assertCountEqual([name for group in plan for name in group], names)
                    self.assertLessEqual(max(map(len, plan)) - min(map(len, plan)), 1)
            seconds['test_0'] = 10.0
            plan = runner.shard_plan(names, size, seconds)
            self.assertTrue(all(plan))
            self.assertCountEqual([name for group in plan for name in group], names)

    def test_planned_shards_cover_every_case_once_and_reject_foreign_files(self):
        def ids(suite):
            for case in suite:
                if isinstance(case, unittest.TestSuite):
                    yield from ids(case)
                else:
                    yield case.id()
        scopes = ('follow', 'tooling')
        serial = list(ids(runner.build_suite(*scopes)))
        names = {path.name for scope in scopes for path in runner.selected_files(scope)}
        plan = runner.shard_plan(names, 3, {'test_scripts': 500.0})
        shards = [list(ids(runner.build_suite(*scopes, shard_index=index, shard_count=3,
                                              assigned_names=plan[index]))) for index in range(3)]
        self.assertCountEqual(serial, [case for shard in shards for case in shard])
        with self.assertRaisesRegex(ValueError, '范围以外'):
            runner.build_suite('checks', assigned_names=['test_scripts.py'])

    def test_a_planned_shard_runs_the_files_its_parent_assigned(self):
        with tempfile.TemporaryDirectory() as directory:
            plan = Path(directory) / 'plan.json'
            plan.write_text(json.dumps([['test_scripts.py'], ['test_http.py', 'test_follow_web.py']]),
                            encoding='utf-8')
            report = Path(directory) / 'shard.json'
            suite = unittest.TestSuite([unittest.FunctionTestCase(lambda: None)])
            with patch.object(runner, 'build_suite', return_value=suite) as build, \
                 contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(runner.main(['--scope', 'follow', '--scope', 'tooling',
                                              '--shard-index', '1', '--shard-count', '2',
                                              '--timings', str(report), '--shard-plan', str(plan)]), 0)
            build.assert_called_once_with('follow', 'tooling', shard_index=1, shard_count=2,
                                          assigned_names=['test_http.py', 'test_follow_web.py'])

    def test_parallel_shards_hand_every_child_the_same_plan_in_dispatch_order(self):
        class Done:
            returncode = 0

            def poll(self):
                return 0

        seen = []

        def spawn(command, *, stdout, stderr, cwd):
            index = int(command[command.index('--shard-index') + 1])
            plan = json.loads(Path(command[command.index('--shard-plan') + 1]).read_text(encoding='utf-8'))
            seen.append((index, plan[index]))
            Path(command[command.index('--timings') + 1]).write_text(
                json.dumps({'complete': True, 'success': True, 'count': 1, 'timings': []}), encoding='utf-8')
            return Done()

        plan = [['test_web_e2e.py'], ['test_a.py', 'test_b.py'], ['test_c.py']]
        with contextlib.redirect_stdout(io.StringIO()):
            runner.run_shards(('full',), jobs=1, shard_count=3, spawn=spawn, plan=plan)
        self.assertEqual(seen, list(enumerate(plan)))
        with self.assertRaisesRegex(ValueError, '片数'):
            runner.run_shards(('full',), jobs=1, shard_count=2, spawn=spawn, plan=plan)

    def test_partial_run_does_not_issue_verification_record(self):
        with patch.object(runner, 'build_suite', return_value=unittest.TestSuite([unittest.FunctionTestCase(lambda: None)])), \
             patch.object(runner.test_evidence, 'inputs', side_effect=AssertionError('分片不能签发证据')):
            self.assertEqual(runner.main(['--scope', 'full', '--shard-count', '2']), 0)

    def test_a_shard_writes_its_outcome_for_the_parent_to_merge(self):
        """分片子进程不签记录，只把成败、用例数和逐用例耗时写给父进程；域可以给多个。"""
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / 'shard.json'
            suite = unittest.TestSuite([unittest.FunctionTestCase(lambda: None)])
            with patch.object(runner, 'build_suite', return_value=suite) as build, \
                 patch.object(runner.test_evidence, 'inputs', side_effect=AssertionError('分片不能签发证据')), \
                 contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(runner.main(['--scope', 'follow', '--scope', 'tooling',
                                              '--shard-index', '1', '--shard-count', '2',
                                              '--timings', str(report)]), 0)
            build.assert_called_once_with('follow', 'tooling', shard_index=1, shard_count=2)
            payload = json.loads(report.read_text(encoding='utf-8'))
            self.assertTrue(payload['success'])
            self.assertEqual(payload['count'], 1)
            self.assertEqual(len(payload['timings']), 1)

    def test_parallel_shards_are_merged_and_one_red_shard_fails_the_run(self):
        """父进程只汇总：每片的结论来自子进程写的文件，片数比并发多时先完成的接着领。"""
        class Done:
            def __init__(self, code):
                self.returncode = code

            def poll(self):
                return self.returncode

        def launcher(failing: int | None):
            launched = []

            def spawn(command, *, stdout, stderr, cwd):
                launched.append(command)
                index = int(command[command.index('--shard-index') + 1])
                report = Path(command[command.index('--timings') + 1])
                report.write_text(json.dumps({'complete': True, 'success': index != failing, 'count': 10 + index,
                                              'timings': [[0.5, f'test_{index}']],
                                              'files': {f'test_{index}': 1.0 + index}}), encoding='utf-8')
                stdout.write(f'分片 {index} 的输出\n')
                return Done(0 if index != failing else 1)
            return launched, spawn

        slots = tempfile.TemporaryDirectory()
        self.addCleanup(slots.cleanup)
        launched, spawn = launcher(failing=None)
        measured = {}
        with contextlib.redirect_stdout(io.StringIO()) as output:
            passed, count, timings = runner.run_shards(('follow', 'tooling'), jobs=2, shard_count=3,
                                                       spawn=spawn, measured=measured)
        self.assertTrue(passed)
        self.assertEqual(measured, {'test_0': 1.0, 'test_1': 2.0, 'test_2': 3.0})
        self.assertEqual(count, 10 + 11 + 12)
        self.assertEqual(sorted(name for _, name in timings), ['test_0', 'test_1', 'test_2'])
        self.assertEqual(sorted(int(c[c.index('--shard-index') + 1]) for c in launched), [0, 1, 2])
        for command in launched:
            self.assertEqual(command[:2], [sys.executable, str(runner.ROOT / 'scripts' / 'test_runner.py')])
            self.assertEqual(command[2:6], ['--scope', 'follow', '--scope', 'tooling'])
            self.assertEqual(command[command.index('--shard-count') + 1], '3')
        for index in range(3):
            self.assertIn(f'分片 {index} 的输出', output.getvalue())

        _, spawn = launcher(failing=2)
        with contextlib.redirect_stdout(io.StringIO()):
            passed, count, _ = runner.run_shards(('checks',), jobs=4, shard_count=3,
                                                 spawn=spawn)
        self.assertFalse(passed)
        self.assertEqual(count, 10 + 11 + 12, '失败那片的用例数也要算进总数，记录里的 count 才是实跑数')

    def test_file_wall_time_includes_class_setup_and_merges_into_the_table(self):
        """分片均衡按整份文件占多久排：类级准备发生在首条用例开始前，也要算进它的文件。"""
        def case(module):
            return type('Case', (unittest.TestCase,), {'__module__': module, 'test_x': lambda self: None})('test_x')
        first, second = case('test_alpha'), case('test_beta')
        # 构造 0；开跑 0；alpha 的类准备到 5 才开始首条，6 结束；beta 的类准备 6→9，10 结束。
        clock = iter([0.0, 0.0, 5.0, 6.0, 9.0, 10.0])
        with patch.object(runner.time, 'monotonic', side_effect=lambda: next(clock)):
            result = runner.TimedResult(unittest.runner._WritelnDecorator(io.StringIO()), True, 0)
            result.startTestRun()
            for test in (first, second):
                result.startTest(test)
                result.stopTest(test)
            result.stopTestRun()
        self.assertEqual(result.files, {'test_alpha': 6.0, 'test_beta': 4.0})
        self.assertEqual([seconds for seconds, _ in result.timings], [1.0, 1.0])
        with tempfile.TemporaryDirectory() as directory:
            table = Path(directory) / 'timings.json'
            runner.save_file_seconds({'test_alpha': 6.0, 'test_beta': 4.0}, table)
            runner.save_file_seconds({'test_alpha': 2.5}, table)
            self.assertEqual(runner.load_file_seconds(table), {'test_alpha': 2.5, 'test_beta': 4.0})
            table.write_text('不是 JSON', encoding='utf-8')
            self.assertEqual(runner.load_file_seconds(table), {})

    def test_background_thread_exceptions_fail_the_suite_and_restore_the_hook(self):
        import threading
        previous = threading.excepthook
        def crash():
            raise RuntimeError('background fixture failed')
        class Case(unittest.TestCase):
            def runTest(self):
                thread = threading.Thread(target=crash, name='fixture-worker')
                thread.start()
                thread.join()
        with patch.object(threading, 'excepthook') as original_hook:
            result = unittest.TextTestRunner(stream=io.StringIO(), resultclass=runner.TimedResult).run(
                unittest.TestSuite([Case()]))
            self.assertIs(threading.excepthook, original_hook)
            original_hook.assert_called_once()
        self.assertIs(threading.excepthook, previous)
        self.assertFalse(result.wasSuccessful())
        self.assertEqual(len(result.errors), 1)
        self.assertIn('background fixture failed', result.errors[0][1])
        self.assertTrue(any(row['outcome'] == 'error' for row in result.results))

    def test_jobs_accepts_auto_or_a_positive_integer(self):
        self.assertEqual(runner.resolve_jobs('3'), 3)
        self.assertTrue(1 <= runner.resolve_jobs('auto') <= runner.DEFAULT_JOBS)
        for bad in ('0', '-1', 'many'):
            with self.subTest(bad=bad), self.assertRaises(runner.argparse.ArgumentTypeError):
                runner.resolve_jobs(bad)

    def test_a_test_reading_a_repository_file_runs_when_that_file_changes(self):
        """读了仓库里某个文件的测试，必须登记在改那个文件会选到的域里。

        域表是人手维护的，漏登记不会报错，只会在 CI 上红：`tests/test_follow_web.py` 读
        `web/app.js`，却只登记在 follow 域，于是改了 `web/app.js` 跑 `auto` 时它根本不在
        选中的文件里。这一条按测试源码里真实存在的路径拼接反查，把漏登记变成本地就红。

        判据覆盖整棵树。同一个漏洞在 `scripts/` 与 `docs/` 上一样成立：`test_babepedia_match.py`
        读 `scripts/match_babepedia_creators.py` 却只登记在 metadata 域，改那个脚本时 `auto`
        选的是 tooling。补法是 `AUTO_SCOPE_FILES` 与 `AUTO_SCOPE_PREFIXES` 让一个文件落到多个域，
        而不是把测试重复登记到不相干的域里。
        """
        for path in sorted((runner.ROOT / 'tests').glob('test_*.py')):
            read = [item for item in runner.repository_paths_read_by(path.read_text(encoding='utf-8'))
                    if not item.startswith('tests/')
                    and not any(item.startswith(prefix) for prefix in runner.FULL_ONLY_PREFIXES)]
            for item in read:
                scopes, why = runner.scopes_for_changes([item])
                selected = {chosen.name for scope in scopes for chosen in runner.selected_files(scope)}
                self.assertIn(path.name, selected, f'{path.name} 读 {item}，但 {why} 选不到它')

    def test_template_copies_have_independent_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            first, second = fresh_ledger(root, 'first.db'), fresh_ledger(root, 'second.db')
            for path in (first, second):
                connection = sqlite3.connect(path)
                try:
                    self.assertEqual(connection.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                    if path == first:
                        connection.execute('CREATE TABLE isolation_probe(value TEXT)')
                        connection.commit()
                    else:
                        self.assertIsNone(connection.execute("SELECT name FROM sqlite_master WHERE name='isolation_probe'").fetchone())
                finally:
                    connection.close()


class GateAndFlakyRerunTests(unittest.TestCase):
    """全量先过秒级门槛；全量里失败的少数文件单独重跑，过了记为偶发，并排整机锁。"""

    @staticmethod
    def failed_row(test_id):
        return {'id': test_id, 'outcome': 'fail', 'seconds': 1.0, 'message': 'x'}

    def test_failed_rows_name_the_files_to_rerun_and_refuse_what_cannot_be_isolated(self):
        rows = [self.failed_row('e2e:e2e/folder-layout.test.ts > 目录 > 滚到底'),
                self.failed_row('test_web_e2e.WebE2ESmokeTests.test_every_route_holds_the_layout_and_runtime_invariants'),
                self.failed_row('vitest:test/react/follow-feed.test.tsx > 页面 > 加载更多'),
                self.failed_row(runner.VITEST_CONTAINER),
                self.failed_row('test_feeds_web.FeedsWebTests.test_second_round'),
                {'id': 'test_ok.Case.test_pass', 'outcome': 'pass', 'seconds': 0.1}]
        self.assertEqual(runner.rerun_selectors(rows), [
            'test_feeds_web.FeedsWebTests.test_second_round', 'frontend/e2e/folder-layout.test.ts',
            'frontend/test/react/follow-feed.test.tsx'])
        self.assertEqual(runner.rerun_selectors([self.failed_row('setUpClass (test_web_e2e.WebE2ESmokeTests)')]),
                         ['test_web_e2e'], '类级准备失败选择所属模块')
        self.assertIsNone(runner.rerun_selectors([self.failed_row(
            'test_web_e2e.WebE2ESmokeTests.test_every_route_holds_the_layout_and_runtime_invariants')]),
            '浏览器容器失败却没有逐条结果：说不清是哪个文件')
        many = [self.failed_row(f'e2e:e2e/page-{index}.test.ts > 用例') for index in range(runner.RERUN_LIMIT + 1)]
        self.assertIsNone(runner.rerun_selectors(many), '失败面大多半是真回归，不再重跑一轮')
        self.assertIsNone(runner.rerun_selectors([]))

    def test_a_rerun_that_passes_is_recorded_as_flaky_and_one_that_fails_stays_red(self):
        class Done:
            def __init__(self, code):
                self.returncode = code

        rows = [self.failed_row('e2e:e2e/folder-layout.test.ts > 目录 > 滚到底')]
        commands = []
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertTrue(runner.rerun_failures(rows, spawn=lambda command, **_: commands.append(command) or Done(0)))
        self.assertEqual(runner.FLAKY, ['frontend/e2e/folder-layout.test.ts'])
        self.assertEqual(commands[0][-2:], ['--focus', 'frontend/e2e/folder-layout.test.ts'])
        runner.FLAKY.clear()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(runner.rerun_failures(rows, spawn=lambda command, **_: Done(1)))
        self.assertEqual(runner.FLAKY, [])

    def test_a_flaky_pass_is_recorded_and_shown_on_the_github_run(self):
        with tempfile.TemporaryDirectory() as folder:
            summary = Path(folder) / 'summary.md'
            with patch.object(runner.test_history, 'nested', return_value=False), \
                    patch.object(runner.test_history, 'append_flaky') as recorded, \
                    patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'GITHUB_STEP_SUMMARY': str(summary)}), \
                    contextlib.redirect_stdout(io.StringIO()) as output:
                runner.report_flaky(['frontend/e2e/search.test.ts'])
            recorded.assert_called_once_with(runner.ROOT, ['frontend/e2e/search.test.ts'])
            self.assertIn('::warning title=偶发失败::', output.getvalue())
            self.assertIn('`frontend/e2e/search.test.ts`', summary.read_text(encoding='utf-8'))

    @staticmethod
    def red_suite():
        case = type('Red', (unittest.TestCase,), {'__module__': 'test_sample',
                                                  'test_red': lambda self: self.assertEqual(1, 2)})
        return unittest.defaultTestLoader.loadTestsFromTestCase(case)

    def test_ci_shards_and_focused_browser_runs_rerun_their_failed_files_once(self):
        """CI 的独立分片和浏览器分片也先单独重跑失败文件，不让一个偶发把整片判红。"""
        from types import SimpleNamespace
        from scripts import test_focus
        for flag, expected in ((True, 0), (False, 1)):
            with self.subTest(rerun_failures=flag), \
                    patch.object(test_focus, 'selection', return_value=(self.red_suite(), (), ())), \
                    patch.object(runner.test_history, 'append'), \
                    patch.object(runner, 'rerun_failures', return_value=True) as rerun, \
                    contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(test_focus.run(runner, SimpleNamespace(focus=['test_sample'], rerun_failures=flag)),
                                 expected)
            self.assertEqual(rerun.call_count, int(flag))
        shard = SimpleNamespace(shard_plan=None, resume_plan=None, timings=None, shard_index=0, shard_count=2)
        for passes, expected in ((True, 0), (False, 1)):
            with self.subTest(rerun_passes=passes), \
                    patch.object(runner, 'build_suite', return_value=self.red_suite()), \
                    patch.object(runner, 'assigned_files', return_value=[]), \
                    patch.object(runner.test_history, 'append'), \
                    patch.object(runner, 'rerun_failures', return_value=passes) as rerun, \
                    contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(runner.run_shard_child(shard, ('auto',), ('core',), set()), expected)
            self.assertEqual(rerun.call_args.args[0][0]['outcome'], 'fail')
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            runner.main(['--rerun-failures'])

    def test_the_gate_runs_first_and_a_red_gate_skips_the_other_shards(self):
        files = [runner.TESTS / name for name in ('test_script_policy.py', 'test_media.py', 'test_scan.py')]
        plans = []

        def shards(scopes, *, jobs, shard_count, measured, plan, outcomes):
            plans.append(plan)
            return (False, 1, []) if plan == [['test_script_policy.py']] else (True, 2, [])

        with patch.object(runner, 'selected_files', return_value=files), \
             patch.object(runner, 'run_shards', side_effect=shards), \
             patch.object(runner, 'save_file_seconds'), patch.object(runner.test_history, 'append'), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(runner.run_local_suite(('full',), jobs=2), (False, 1, []))
        self.assertEqual(plans, [[['test_script_policy.py']]], '门槛没过就不起其余分片')

        plans.clear()
        with patch.object(runner, 'selected_files', return_value=files), \
             patch.object(runner, 'run_shards', side_effect=lambda *a, **k: plans.append(k['plan']) or (True, 2, [])), \
             patch.object(runner, 'save_file_seconds'), patch.object(runner.test_history, 'append'), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertTrue(runner.run_local_suite(('full',), jobs=2)[0])
        self.assertEqual(plans[0], [['test_script_policy.py']])
        self.assertEqual(sorted(name for shard in plans[1] for name in shard), ['test_media.py', 'test_scan.py'],
                         '门槛里的文件不再进后面的分片')

    def test_focus_runs_without_serializing_other_worktrees(self):
        from scripts import test_focus
        with patch.object(runner.test_evidence, 'held', side_effect=AssertionError('定向调试不取得共享锁')), \
                patch.object(test_focus, 'run', return_value=0) as focused:
            self.assertEqual(runner.main(['--focus', 'frontend/e2e/design-people.test.ts']), 0)
        self.assertEqual(focused.call_count, 1)

    def test_named_modules_include_their_direct_behavior_consumers(self):
        for module, consumers in (
            ('http', {'test_processing_traffic.py', 'test_metadata_sources.py'}),
            ('ffmpeg', {'test_frame_capture.py', 'test_hardware_transcode.py'}),
        ):
            with self.subTest(module=module):
                scopes, _ = runner.scopes_for_changes([f'src/peach/{module}.py'])
                selected = {path.name for scope in scopes for path in runner.selected_files(scope)}
                self.assertLessEqual(consumers, selected)

    def test_repository_reads_exclude_fixture_paths_and_write_operations(self):
        source = ('from pathlib import Path\nROOT = Path(__file__).resolve().parents[1]\n'
                  'DOCS = ROOT / "docs"\n'
                  '(worker / "README.zh-CN.md").write_text("fixture")\n'
                  '(ROOT / "README.md").write_text("fixture")\n'
                  '(DOCS / "TESTING.md").read_text()\n')
        self.assertEqual(runner.repository_paths_read_by(source), ('docs/TESTING.md',))

    def test_focus_accepts_vitest_files_and_hands_them_to_the_island_suite(self):
        from scripts import test_focus
        suite, browsers, islands = test_focus.selection(runner.ROOT, ['frontend/test/jav-card-title.test.ts'])
        self.assertEqual((browsers, islands), ((), ('test/jav-card-title.test.ts',)))
        self.assertEqual([test.id() for test in suite], [test_focus.VITEST_SUITE])
        with self.assertRaises(ValueError):
            test_focus.selection(runner.ROOT, ['frontend/test/../../scripts/test_runner.py'])

    def test_focus_accepts_comma_separated_file_arguments_without_losing_or_repeating_tests(self):
        from scripts import test_focus
        first = 'test_test_planning.TestPlanningTests'
        second = 'test_test_planning.GateAndFlakyRerunTests'
        expected, _, _ = test_focus.selection(runner.ROOT, [first, second])
        actual, browsers, islands = test_focus.selection(runner.ROOT, [f'{first}, {second}', first])
        self.assertEqual([test.id() for test in actual], [test.id() for test in expected])
        self.assertEqual((browsers, islands), ((), ()))
        _, browsers, islands = test_focus.selection(runner.ROOT, [
            'frontend/e2e/search.test.ts,frontend/test/jav-card-title.test.ts'])
        self.assertEqual(browsers, ('e2e/search.test.ts',))
        self.assertEqual(islands, ('test/jav-card-title.test.ts',))
        for invalid in (f'{first},', ', ', f'{first},../outside.py'):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                test_focus.selection(runner.ROOT, [invalid])
