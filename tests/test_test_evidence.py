from __future__ import annotations

import json
import io
import os
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

from scripts import agent_worktree as coordinator
from scripts import test_evidence as evidence
from scripts import test_runner as runner
from scripts import test_resume
from scripts import test_run_progress
from scripts import test_shard_results
from support.gitrepo import seed_repository


def fixture_process(command, root, env):
    process = subprocess.Popen(command, cwd=root, env=env, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, encoding='utf8')
    try:
        output, _ = process.communicate(timeout=180)
    finally:
        if process.poll() is None:
            test_shard_results.stop_process_tree(process)
    return process.returncode, output



class ParallelShardTests(unittest.TestCase):
    def test_nested_parallel_containers_have_separate_batches_without_losing_files(self):
        names = ['test_frontend_preflight.py', 'test_reference_updates.py', 'test_frontend_build.py',
                 'test_web_e2e.py', 'test_catalog.py', 'test_media.py']
        with mock.patch.object(runner, 'load_file_seconds', return_value={}):
            batches = runner.local_batches(names, 7)
        self.assertCountEqual([name for _, plan, _ in batches for shard in plan for name in shard], names)
        self.assertEqual(set(batches[0][1][0]), {'test_frontend_preflight.py', 'test_reference_updates.py'})
        self.assertEqual(batches[1][2], 7)
        for _, plan, jobs in batches[2:]:
            self.assertEqual((len(plan), len(plan[0]), jobs), (1, 1, 1))

    def test_failed_gate_stops_serial_and_parallel_behavior_tests(self):
        names = [Path('test_frontend_preflight.py'), Path('test_web_e2e.py')]
        for jobs in (1, 4):
            with self.subTest(jobs=jobs), mock.patch.object(runner, 'selected_files', return_value=names), \
                    mock.patch.object(runner, 'run_shards', return_value=(False, 2, [])) as execute, \
                    mock.patch.object(runner, 'run_serial_suite', return_value=(False, 2, [])) as serial, \
                    mock.patch.object(runner, 'save_file_seconds'), mock.patch.object(runner.test_history, 'append'), \
                    redirect_stdout(io.StringIO()):
                self.assertEqual(runner.run_local_suite(('web',), jobs), (False, 2, []))
            if jobs == 1:
                serial.assert_called_once()
                self.assertEqual(serial.call_args.args[1], {Path('test_frontend_preflight.py')})
                execute.assert_not_called()
            else:
                execute.assert_called_once()
                self.assertEqual(execute.call_args.kwargs['plan'], [['test_frontend_preflight.py']])

    def test_phase_timings_include_failed_work(self):
        timings = {}
        with mock.patch.object(test_run_progress.time, 'monotonic', side_effect=[10, 12, 20, 23]):
            with test_run_progress.phase(timings, '规划'):
                pass
            with self.assertRaises(ValueError), test_run_progress.phase(timings, '规划'):
                raise ValueError('失败仍计时')
        self.assertEqual(timings, {'规划': 5})

    def test_checkpoint_exit_status_must_match_the_report(self):
        def exercise(success, code):
            observed = []
            def spawn(command, **kwargs):
                report = Path(command[command.index('--timings') + 1])
                report.write_text(json.dumps({'complete': True, 'success': success, 'count': 1, 'timings': []}), encoding='utf8')
                return mock.Mock(returncode=code, poll=lambda: code)
            def checkpoint(assigned, report, normal):
                observed.append(normal)
                return True
            output = io.StringIO()
            with redirect_stdout(output):
                passed, _, _ = runner.run_shards(('checks',), jobs=1, shard_count=1, plan=[['test_a.py']],
                                                spawn=spawn, checkpoint=checkpoint)
            self.assertEqual(passed, success and code == 0)
            if not passed:
                row = next(line for line in output.getvalue().splitlines() if line.startswith('分片失败明细：'))
                details = json.loads(row.removeprefix('分片失败明细：'))
                self.assertEqual(details['exit_code'], code)
                self.assertEqual(details['files'], ['test_a.py'])
                self.assertEqual(details['reported_success'], success)
            return observed
        for success, code, expected in ((False, 1, True), (False, 15, False), (True, 1, False), (True, 0, True)):
            with self.subTest(success=success, code=code):
                self.assertEqual(exercise(success, code), [expected])

    def test_imported_verification_code_belongs_to_this_workspace(self):
        self.assertEqual(Path(runner.__file__).resolve().parents[1], Path(__file__).resolve().parents[1])
        self.assertEqual(Path(evidence.__file__).resolve().parents[1], Path(__file__).resolve().parents[1])

    def test_a_zero_exit_with_incomplete_coverage_reports_the_missing_proof(self):
        def spawn(command, **kwargs):
            path = Path(command[command.index('--timings') + 1])
            path.write_text(json.dumps({'complete': True, 'success': True, 'count': 1,
                                        'timings': [], 'files': {}, 'results': []}), encoding='utf8')
            return mock.Mock(returncode=0, poll=lambda: 0)
        output = io.StringIO()
        with redirect_stdout(output):
            passed, _, _ = runner.run_shards(('checks',), jobs=1, shard_count=1,
                plan=[['test_a.py']], spawn=spawn, checkpoint=lambda *_: False)
        self.assertFalse(passed)
        row = next(line for line in output.getvalue().splitlines() if line.startswith('分片失败明细：'))
        details = json.loads(row.removeprefix('分片失败明细：'))
        self.assertEqual(details['exit_code'], 0)
        self.assertTrue(details['reported_success'])
        self.assertFalse(details['coverage_complete'])

    def test_requested_parallelism_has_no_machine_slot_ceiling(self):
        live, peak = set(), [0]
        class Shard:
            def __init__(self, command):
                report = Path(command[command.index('--timings') + 1])
                report.write_text(json.dumps({'complete': True, 'success': True, 'count': 1, 'timings': []}), encoding='utf-8')
                self.polls, self.returncode = 0, None
                live.add(self)
                peak[0] = max(peak[0], len(live))
            def poll(self):
                self.polls += 1
                if self.polls >= 2:
                    live.discard(self)
                    self.returncode = 0
                return self.returncode
        def spawn(command, **kwargs):
            return Shard(command)
        with redirect_stdout(io.StringIO()):
            passed, count, _ = runner.run_shards(('checks',), jobs=6, shard_count=12, spawn=spawn)
        self.assertTrue(passed)
        self.assertEqual(count, 12)
        self.assertEqual(peak[0], 6)


class EnvironmentIdentityTests(unittest.TestCase):
    def test_gitlab_transport_credentials_rotate_without_changing_environment(self):
        from scripts.test_environment_identity import environment_flags
        base = {'CI_JOB_NAME': 'verify-windows', 'PEACH_CI_COVERAGE': 'full',
                'CI_JOB_TOKEN': 'fixture-password-one', 'CI_REGISTRY_PASSWORD': 'fixture-password-one',
                'CI_DEPENDENCY_PROXY_PASSWORD': 'fixture-password-one',
                'CI_REPOSITORY_URL': 'https://gitlab-ci-token:fixture-password-one@forge.invalid/group/app.git'}
        rotated = {**base, 'CI_JOB_ID': 'another', 'CI_JOB_STARTED_AT': 'another',
                   'CI_JOB_TOKEN': 'fixture-password-two', 'CI_REGISTRY_PASSWORD': 'fixture-password-two',
                   'CI_DEPENDENCY_PROXY_PASSWORD': 'fixture-password-two',
                   'CI_REPOSITORY_URL': base['CI_REPOSITORY_URL'].replace('password-one', 'password-two')}
        flags = environment_flags(base)
        self.assertEqual(flags, environment_flags(rotated))
        self.assertNotIn('fixture-password-', json.dumps(flags))
        for changes in ({'CI_JOB_NAME': 'verify-macos'}, {'PEACH_CI_COVERAGE': 'changed'},
                        {'CI_REPOSITORY_URL': base['CI_REPOSITORY_URL'].replace('/app.git', '/other.git')},
                        {'CI_REPOSITORY_URL': base['CI_REPOSITORY_URL'].replace('forge.invalid', 'other.invalid')},
                        {'CI_REPOSITORY_URL': base['CI_REPOSITORY_URL'].replace('gitlab-ci-token:', 'other-user:')}):
            with self.subTest(changes=changes):
                self.assertNotEqual(flags, environment_flags({**base, **changes}))

    def test_invalid_gitlab_clone_urls_keep_distinct_environment_identity(self):
        from scripts.test_environment_identity import environment_flags
        self.assertNotEqual(environment_flags({'CI_REPOSITORY_URL': 'https://[invalid-one'}),
                            environment_flags({'CI_REPOSITORY_URL': 'https://[invalid-two'}))

    def test_ci_commit_metadata_and_credential_rotation_preserve_environment(self):
        from scripts.test_environment_identity import environment_flags
        base = {'GITHUB_ACTIONS': 'true', 'GITHUB_JOB': 'python', 'GITHUB_TOKEN': 'fixture-one'}
        rotated = {**base, 'GITHUB_TOKEN': 'fixture-two', 'CI_JOB_STARTED_AT': 'another',
                   'CI_COMMIT_MESSAGE': 'another message'}
        self.assertEqual(environment_flags(base), environment_flags(rotated))
        self.assertNotEqual(environment_flags(base), environment_flags({'GITHUB_ACTIONS': 'true', 'GITHUB_JOB': 'python'}))
        self.assertEqual(environment_flags({'CI_JOB_TOKEN': ''}), environment_flags({}))

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.python = self.root / 'python.exe'
        self.python.write_bytes(b'runtime-fixture')
        self.enterContext(mock.patch.dict(os.environ, {}, clear=True))
        self.enterContext(mock.patch.object(evidence, 'interpreter', return_value=self.python))
        self.enterContext(mock.patch.object(evidence, 'python_identity', return_value={
            'version': 'fixture-python', 'sites': []}))
        self.enterContext(mock.patch.object(evidence, 'tool_identities', return_value={}))
        self.enterContext(mock.patch.object(evidence.platform, 'platform', return_value='fixture-platform'))
        self.packages = self.enterContext(mock.patch.object(evidence.importlib.metadata, 'distributions', return_value=[]))

    def test_equivalent_interpreters_in_separate_worktrees_share_identity(self):
        other = self.root / 'other/python.exe'
        other.parent.mkdir()
        other.write_bytes(self.python.read_bytes())
        first = evidence.environment(self.root)
        with mock.patch.object(evidence, 'interpreter', return_value=other):
            self.assertEqual(evidence.environment(self.root), first)
        stamp = other.stat()
        other.write_bytes(b'another-runtime')
        os.utime(other, ns=(stamp.st_atime_ns, stamp.st_mtime_ns))
        with mock.patch.object(evidence, 'interpreter', return_value=other):
            self.assertNotEqual(evidence.environment(self.root), first)

    def test_install_lock_identity_uses_json_content(self):
        lock = self.root / 'frontend/node_modules/.package-lock.json'
        lock.parent.mkdir(parents=True)
        lock.write_text('{"name":"app","packages":{"one":{"version":"1"}}}', encoding='utf8')
        first = evidence.environment(self.root)
        lock.write_text('{\n "packages": {"one": {"version": "1"}}, "name": "app"\n}', encoding='utf8')
        self.assertEqual(evidence.environment(self.root), first)
        lock.write_text('{"name":"app","packages":{"one":{"version":"2"}}}', encoding='utf8')
        self.assertNotEqual(evidence.environment(self.root), first)

    def test_ci_run_metadata_preserves_identity_and_job_selection_changes_it(self):
        os.environ.update(GITHUB_RUN_ID='one', GITHUB_RUN_NUMBER='1', GITHUB_JOB='python')
        first = evidence.environment(self.root)
        os.environ.update(GITHUB_RUN_ID='two', GITHUB_RUN_NUMBER='2')
        self.assertEqual(evidence.environment(self.root), first)
        os.environ['GITHUB_JOB'] = 'web-e2e'
        self.assertNotEqual(evidence.environment(self.root), first)

    def test_gitlab_retry_metadata_preserves_runtime_identity_and_job_selection(self):
        os.environ.update(CI_JOB_NAME='verify-macos', CI_JOB_RETRY_COUNT='0',
                          CI_JOB_STARTED_AT_SLUG='first-start', CI_BUILD_NETWORK_NAME='network-one',
                          CI_TRACEPARENT='00-' + '1' * 32 + '-' + '2' * 16 + '-01',
                          CI_TRACESTATE='gitlab=pipeline:1;job:2')
        first = evidence.environment(self.root)
        os.environ.update(CI_JOB_RETRY_COUNT='1', CI_JOB_STARTED_AT_SLUG='next-start',
                          CI_BUILD_NETWORK_NAME='network-two',
                          CI_TRACEPARENT='00-' + '1' * 32 + '-' + '3' * 16 + '-01',
                          CI_TRACESTATE='gitlab=pipeline:1;job:3')
        self.assertEqual(evidence.environment(self.root), first)
        os.environ['CI_JOB_NAME'] = 'verify-linux'
        self.assertNotEqual(evidence.environment(self.root), first)

    def test_distribution_names_have_canonical_identity(self):
        from types import SimpleNamespace
        self.packages.return_value = [SimpleNamespace(metadata={'Name': 'Some_Pkg'}, version='1')]
        first = evidence.environment(self.root)
        self.packages.return_value = [SimpleNamespace(metadata={'Name': 'some-pkg'}, version='1')]
        self.assertEqual(evidence.environment(self.root), first)
        self.packages.return_value = [SimpleNamespace(metadata={'Name': 'some-pkg'}, version='2')]
        self.assertNotEqual(evidence.environment(self.root), first)

    def test_browser_paths_share_identity_and_binary_changes_invalidate_it(self):
        first, second = self.root / 'chrome-one', self.root / 'chrome-two'
        first.write_bytes(b'browser-fixture')
        second.write_bytes(first.read_bytes())
        os.environ['PEACH_E2E_CHROME'] = str(first)
        identity = evidence.environment(self.root)
        os.environ['PEACH_E2E_CHROME'] = str(second)
        self.assertEqual(evidence.environment(self.root), identity)
        second.write_bytes(b'another-browser')
        self.assertNotEqual(evidence.environment(self.root), identity)


class RecordSelectionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.now = time.time()
        self.enterContext(mock.patch.object(evidence, 'evidence_dir', return_value=self.root))

    def record(self, index, *, success=True, **changes):
        manifest = {'files': {'marker': [420, f'{index:064x}', '100644']}, 'signatures': {}}
        context = {'manifest': manifest, 'environment': 'fixture'}
        state = evidence.digest([evidence.digest(manifest), context['environment']])
        value = {**context, 'state': state, 'validated': {'catalog': self.now} if success else {},
                 'coverage': {}, **changes}
        path = self.root / f'{state}.json'
        path.write_text(json.dumps(value), encoding='utf8')
        os.utime(path, (self.now - 100 + index, self.now - 100 + index))
        return context, state, path

    def test_live_baseline_survives_newer_failed_records(self):
        context, _, _ = self.record(0)
        for index in range(1, 34):
            self.record(index, success=False)
        self.assertEqual(len(list(evidence.baselines(self.root, context, partial=True))), 1)

    def test_malformed_record_does_not_hide_other_candidates(self):
        context, _, _ = self.record(0)
        self.record(1, coverage=[])
        self.assertEqual(len(list(evidence.baselines(self.root, context, partial=True))), 1)

    def test_record_content_is_bound_to_its_identity(self):
        _, state, path = self.record(0)
        record = json.loads(path.read_text(encoding='utf8'))
        record['environment'] = 'another'
        path.write_text(json.dumps(record), encoding='utf8')
        self.assertEqual(evidence.read(self.root, state), {})

    def test_malformed_optional_fields_do_not_stop_candidate_selection(self):
        context, _, _ = self.record(0)
        for index, fields in enumerate(({'failed_scopes': {}}, {'finished': []}, {'cohort': {}},
                                       {'units': {'test_a.py': {'outcome': 'pass', 'at': float('nan')}}}), 1):
            self.record(index, **fields)
        self.assertEqual(len(list(evidence.candidates(self.root, context))), 1)


class ReceiptFixture:
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.now = time.time()
        self.mapping = {'catalog': (Path('test_catalog.py'),), 'web': (Path('test_web.py'),),
                        'checks': (), 'full': (Path('test_catalog.py'), Path('test_web.py'))}
        self.context = {'environment': 'same', 'manifest': {'files': {}, 'signatures': {}}}

    def resolve(self, paths, **kwargs):
        return (('catalog',), 'fixture')

    def unit(self, outcome='pass', offset=0):
        return {'outcome': outcome, 'at': self.now + offset}

    def record(self, units, **changes):
        return {**self.context, 'units': units, **changes}


class ReceiptTests(ReceiptFixture, unittest.TestCase):
    def test_history_planning_parses_each_test_once_and_rebuilds_for_new_inputs(self):
        tests = self.root / 'tests'
        tests.mkdir()
        (tests / 'test_catalog.py').write_text('VALUE = 1\n', encoding='utf8')
        consumer = tests / 'test_web.py'
        consumer.write_text('VALUE = 2\n', encoding='utf8')
        old = {'files': {'tests/test_catalog.py': [1, 'old', '100644']}, 'signatures': {}}
        current = {'files': {'tests/test_catalog.py': [1, 'new', '100644']}, 'signatures': {}}
        records = [self.record({'test_catalog.py': self.unit(), 'test_web.py': self.unit()}, manifest=old)] * 30
        with mock.patch.object(test_resume.ast, 'parse', wraps=test_resume.ast.parse) as parse:
            kept = test_resume.combine(self.root, records, {**self.context, 'manifest': current},
                                      {'test_catalog.py', 'test_web.py'}, self.resolve, self.mapping.__getitem__)
        self.assertEqual(parse.call_count, 2)
        self.assertEqual(set(kept), {'test_web.py'})
        consumer.write_text('import test_catalog\n', encoding='utf8')
        kept = test_resume.combine(self.root, records, {**self.context, 'manifest': current},
                                  {'test_catalog.py', 'test_web.py'}, self.resolve, self.mapping.__getitem__)
        self.assertEqual(kept, {})

    def test_isolated_pages_keep_main_browser_proof_and_shared_changes_invalidate_it(self):
        for name in ('setup', 'smoke'):
            path = self.root / 'frontend/e2e' / f'{name}.test.ts'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('', encoding='utf8')
        mapping = {'web': (Path('test_web_e2e.py'), Path('test_frontend_build.py')), 'checks': ()}
        units = test_resume.scope_units(self.root, 'web', mapping.__getitem__)
        main = 'case:test_web_e2e.WebE2ESmokeTests.test_every_route_holds_the_layout_and_runtime_invariants'
        resolve = lambda *args, **kwargs: (('web',), '')
        setup = 'frontend/src/react/pages/setup/setup.css'
        for paths, mode, environment, preserved in (
                ([setup], '100644', 'same', True),
                (['resources/setup/macbook.png', 'web/dist/peach-pages.js'], '100644', 'same', True),
                ([setup, 'web/dist/peach-app.css'], '100644', 'same', False),
                ([setup], '100755', 'same', False),
                ([setup], '100644', 'changed', False)):
            with self.subTest(paths=paths, mode=mode, environment=environment):
                old = {'files': {path: [1, 'old', '100644'] for path in paths}, 'signatures': {}}
                current = {'files': {path: [1, 'new', mode] for path in paths}, 'signatures': {}}
                record = self.record({unit: self.unit() for unit in units}, manifest=old)
                kept = test_resume.combine(self.root, [record], {**self.context, 'manifest': current,
                                            'environment': environment}, units, resolve, mapping.__getitem__)
                self.assertEqual('frontend/e2e/smoke.test.ts' in kept, preserved)
                self.assertEqual(main in kept, preserved)
                self.assertNotIn('frontend/e2e/setup.test.ts', kept)
                self.assertNotIn('test_frontend_build.py', kept)

    def test_a_failed_file_preserves_successful_sibling_files(self):
        report = {'success': False, 'count': 2, 'results': [
            {'id': 'test_catalog.Suite.test_value', 'outcome': 'pass'},
            {'id': 'test_web.Suite.test_value', 'outcome': 'fail'}]}
        units = test_resume.report_units(self.mapping['full'], report, clean_exit=True, stamp=self.now)
        self.assertEqual(units['test_catalog.py']['outcome'], 'pass')
        self.assertEqual(units['test_web.py']['outcome'], 'fail')

    def test_latest_failure_blocks_an_older_success_from_another_record(self):
        records = [self.record({'test_web.py': self.unit('fail')}),
                   self.record({'test_web.py': self.unit(offset=-10)})]
        kept = test_resume.combine(self.root, records, self.context, {'test_web.py'}, self.resolve, self.mapping.__getitem__)
        self.assertEqual(kept['test_web.py']['outcome'], 'fail')

    def test_compatible_records_cover_scopes_without_claiming_full(self):
        records = [self.record({'test_web.py': self.unit()}), self.record({'test_catalog.py': self.unit(offset=-10)})]
        kept = test_resume.combine(self.root, records, self.context,
                                  {'test_web.py', 'test_catalog.py'}, self.resolve, self.mapping.__getitem__)
        requirements = {scope: {path.name for path in files} for scope, files in self.mapping.items()}
        validated = test_resume.validated(kept, requirements)
        self.assertEqual(set(validated), {'catalog', 'web'})
        self.assertEqual(validated['catalog'], self.now - 10)

    def test_a_test_file_change_preserves_an_independent_test_file(self):
        old = {'files': {'tests/test_catalog.py': [420, 'old', '100644']}, 'signatures': {}}
        current = {'files': {'tests/test_catalog.py': [420, 'new', '100644']}, 'signatures': {}}
        record = self.record({'test_web.py': self.unit(), 'test_catalog.py': self.unit()}, manifest=old)
        kept = test_resume.combine(self.root, [record], {**self.context, 'manifest': current},
                                  {'test_web.py', 'test_catalog.py'}, self.resolve, self.mapping.__getitem__)
        self.assertEqual(set(kept), {'test_web.py'})

    def test_actual_source_changes_invalidate_their_domain(self):
        old = {'files': {'src/peach/catalog.py': [420, 'old', '100644']}, 'signatures': {}}
        current = {'files': {'src/peach/catalog.py': [420, 'new', '100644']}, 'signatures': {}}
        record = self.record({'test_web.py': self.unit(), 'test_catalog.py': self.unit()}, manifest=old)
        kept = test_resume.combine(self.root, [record], {**self.context, 'manifest': current},
                                  {'test_web.py', 'test_catalog.py'}, self.resolve, self.mapping.__getitem__)
        self.assertEqual(set(kept), {'test_web.py'})

    def test_missing_or_unclean_completion_cannot_produce_success(self):
        for report, clean in (({'success': True, 'count': 0}, True),
                              ({'success': True, 'count': 1}, False)):
            with self.subTest(report=report, clean=clean):
                units = test_resume.report_units(['test_web.py'], report, clean_exit=clean, stamp=self.now)
                self.assertEqual(units['test_web.py']['outcome'], 'unknown')

    def test_browser_failure_retains_other_browser_file_results(self):
        folder = self.root / 'frontend/e2e'
        folder.mkdir(parents=True)
        for name in ('one.test.ts', 'two.test.ts'):
            (folder / name).write_text('fixture', encoding='utf8')
        report = {'success': False, 'count': 1, 'results': [
            {'id': 'test_web_e2e.Suite.test_browser', 'outcome': 'fail'},
            {'id': 'e2e:e2e/one.test.ts > value', 'outcome': 'pass'},
            {'id': 'e2e:e2e/one.test.ts > 文件结果', 'outcome': 'pass', 'file_complete': True},
            {'id': 'e2e:e2e/two.test.ts > value', 'outcome': 'fail'}]}
        units = test_resume.report_units(['test_web_e2e.py'], report, clean_exit=True, stamp=self.now)
        plan = test_resume.external_plan(self.root, ['test_web_e2e.py'], units)
        self.assertEqual(plan, {'test_web_e2e.py': ['frontend/e2e/two.test.ts']})

    def test_partial_external_output_does_not_prove_file_completion(self):
        report = {'success': False, 'count': 1, 'results': [
            {'id': 'e2e:e2e/one.test.ts > first', 'outcome': 'pass'}]}
        units = test_resume.report_units(['test_web_e2e.py'], report, clean_exit=True, stamp=self.now)
        self.assertEqual(units['frontend/e2e/one.test.ts']['outcome'], 'unknown')

    def test_imported_test_helpers_invalidate_transitive_consumers(self):
        folder = self.root / 'tests'
        folder.mkdir()
        (folder / 'test_middle.py').write_text('from tests import test_catalog\n', encoding='utf8')
        (folder / 'test_outer.py').write_text('from . import test_middle\n', encoding='utf8')
        self.assertEqual(test_resume.test_importers(self.root, 'test_catalog.py'),
                         {'test_catalog.py', 'test_middle.py', 'test_outer.py'})

    def test_comment_only_test_changes_preserve_behavior_coverage(self):
        behavior = evidence.digest('same')
        old = {'files': {'tests/test_catalog.py': [420, 'old', '100644']},
               'signatures': {'tests/test_catalog.py': {'behavior': behavior}}}
        current = {'files': {'tests/test_catalog.py': [420, 'new', '100644']},
                   'signatures': old['signatures']}
        resolve = lambda paths, **kwargs: (('checks',), 'fixture')
        record = self.record({'test_catalog.py': self.unit()}, manifest=old)
        kept = test_resume.combine(self.root, [record], {**self.context, 'manifest': current},
                                  {'test_catalog.py'}, resolve, self.mapping.__getitem__)
        self.assertEqual(set(kept), {'test_catalog.py'})

    def test_container_class_skip_is_an_environment_bound_result(self):
        case = next(case for case in test_resume.CONTAINERS if '.WebE2E' in case)
        report = {'success': True, 'count': 1, 'results': [
            {'id': 'setUpClass (test_web_e2e.WebE2ESmokeTests)', 'outcome': 'skip'},
            {'id': 'test_web_e2e.Policy.test_value', 'outcome': 'pass'}]}
        units = test_resume.report_units(['test_web_e2e.py'], report, clean_exit=True, cases={case})
        self.assertEqual(units['case:' + case]['outcome'], 'pass')

    def test_class_and_module_cleanup_failures_invalidate_container_proof(self):
        case = next(case for case in test_resume.CONTAINERS if '.WebE2E' in case)
        for holder in ('tearDownClass (test_web_e2e.WebE2ESmokeTests)', 'tearDownModule (test_web_e2e)'):
            report = {'success': False, 'count': 1, 'results': [
                {'id': case, 'outcome': 'pass'}, {'id': holder, 'outcome': 'error'}]}
            with self.subTest(holder=holder):
                units = test_resume.report_units(['test_web_e2e.py'], report, clean_exit=True, cases={case})
                self.assertEqual(units['case:' + case]['outcome'], 'fail')
                self.assertEqual(units['test_web_e2e.py']['outcome'], 'fail')

    def test_explicit_case_success_survives_an_unrelated_failure_in_its_module(self):
        case = 'case:test_catalog.Suite.test_value'
        proof = {'test_catalog.py': self.unit('fail'), case: self.unit()}
        kept = test_resume.combine(self.root, [self.record(proof)], self.context, set(proof),
                                  self.resolve, self.mapping.__getitem__)
        self.assertEqual(kept[case]['outcome'], 'pass')

    def test_module_aggregation_does_not_refresh_an_explicit_case_timestamp(self):
        case = 'case:test_catalog.Suite.test_value'
        proof = {'test_catalog.py': self.unit(), case: self.unit(offset=-100)}
        kept = test_resume.combine(self.root, [self.record(proof)], self.context, set(proof),
                                  self.resolve, self.mapping.__getitem__)
        self.assertEqual(kept[case]['at'], self.now - 100)

    def test_shared_inputs_invalidate_supplemental_cases_with_their_module(self):
        case = 'case:test_catalog.Suite.test_value'
        proof = {'test_catalog.py': self.unit(), case: self.unit()}
        context = {**self.context, 'manifest': {'files': {'scripts/test_runner.py': [420, 'changed', '100644']}}}
        kept = test_resume.combine(self.root, [self.record(proof)], context, set(proof),
                                  lambda paths, **kwargs: (('full',), 'fixture'), self.mapping.__getitem__)
        self.assertEqual(kept, {})

    def test_zero_executed_tests_do_not_produce_positive_coverage(self):
        case = 'test_catalog.Suite.test_value'
        report = {'success': False, 'count': 0, 'results': [
            {'id': 'setUpClass (test_catalog.Suite)', 'outcome': 'skip'}]}
        units = test_resume.report_units(['test_catalog.py'], report, clean_exit=False, cases={case})
        self.assertEqual(test_resume.passed_units(units), set())

    def test_unattributed_failure_prevents_success_from_being_inferred(self):
        report = {'success': False, 'count': 1, 'results': [
            {'id': 'test_catalog.Suite.test_value', 'outcome': 'pass'},
            {'id': 'executor bootstrap', 'outcome': 'error'}]}
        units = test_resume.report_units(['test_catalog.py'], report, clean_exit=False)
        self.assertEqual(units['test_catalog.py']['outcome'], 'unknown')

    def test_abnormal_exit_does_not_preserve_positive_rows_in_a_failed_report(self):
        report = {'success': False, 'count': 2, 'results': [
            {'id': 'test_catalog.Suite.test_value', 'outcome': 'pass'},
            {'id': 'test_web.Suite.test_value', 'outcome': 'fail'}]}
        units = test_resume.report_units(['test_catalog.py', 'test_web.py'], report, clean_exit=False)
        self.assertEqual(test_resume.passed_units(units), set())
        self.assertEqual(units['test_web.py']['outcome'], 'fail')


class CheckpointTests(ReceiptFixture, unittest.TestCase):
    def setUp(self):
        super().setUp()
        manifest = self.context['manifest']
        self.context['state'] = evidence.digest([evidence.digest(manifest), self.context['environment']])
        self.enterContext(mock.patch.object(evidence, 'evidence_dir', return_value=self.root / 'records'))
        self.enterContext(mock.patch.object(evidence, 'inputs', return_value=self.context))

    def progress(self, scopes=('full',), **kwargs):
        return test_run_progress.RunProgress(self.root, self.context, scopes, self.mapping.__getitem__,
                self.resolve, ('catalog', 'web', 'checks'), **kwargs)

    def report(self, *names, failure=None):
        return {'complete': True, 'success': failure is None, 'count': len(names), 'results': [
            {'id': name.removesuffix('.py') + '.Suite.test_value',
             'outcome': 'fail' if name == failure else 'pass'} for name in names]}

    def test_interruption_keeps_completed_shards_and_their_original_age(self):
        progress = self.progress()
        progress.start()
        progress.checkpoint(['test_catalog.py'], self.report('test_catalog.py'), True)
        saved = evidence.read(self.root, self.context['state'])
        resumed = self.progress(records=[saved])
        self.assertEqual(resumed.pending, {'test_web.py'})
        stamp = saved['units']['test_catalog.py']['at']
        resumed.start()
        resumed.checkpoint(['test_web.py'], self.report('test_web.py'), True)
        resumed.persist(final=True, success=resumed.complete())
        result = evidence.read(self.root, self.context['state'])
        self.assertTrue(evidence.covers(result, ('full',)))
        self.assertEqual(result['validated']['full'], stamp)

    def test_failed_batch_resumes_only_failed_files_without_full_until_complete(self):
        progress = self.progress()
        progress.start()
        progress.checkpoint(self.mapping['full'], self.report('test_catalog.py', 'test_web.py', failure='test_web.py'), True)
        progress.persist(final=True, success=False)
        saved = evidence.read(self.root, self.context['state'])
        self.assertFalse(evidence.covers(saved, ('full',)))
        self.assertTrue(evidence.covers(saved, ('catalog',)))
        self.assertEqual(self.progress(records=[saved]).pending, {'test_web.py'})

    def test_fresh_discards_positive_coverage_in_the_requested_scope(self):
        record = self.record({'test_catalog.py': self.unit(), 'test_web.py': self.unit()})
        progress = self.progress(('catalog',), records=[record], force=True)
        self.assertEqual(progress.pending, {'test_catalog.py'})
        self.assertEqual(progress.units['test_web.py']['outcome'], 'pass')

    def test_partial_runs_do_not_supply_full_batch_provenance(self):
        records = [self.record({'test_catalog.py': self.unit()}), self.record({'test_web.py': self.unit()})]
        progress = self.progress(records=records)
        self.assertEqual(progress.pending, {'test_catalog.py', 'test_web.py'})
        progress.persist(final=True, success=True)
        self.assertFalse(evidence.covers(evidence.read(self.root, self.context['state']), ('full',)))

    def test_nonfinal_report_cannot_supply_a_checkpoint(self):
        progress = self.progress()
        report = self.report('test_catalog.py')
        report.pop('complete')
        self.assertFalse(progress.checkpoint(['test_catalog.py'], report, True))
        self.assertFalse(progress.units)

    def test_coverage_that_expires_during_execution_requires_revalidation(self):
        record = self.record({'test_catalog.py': self.unit()})
        progress = self.progress(('catalog',), records=[record])
        self.assertTrue(progress.complete())
        with mock.patch.object(evidence.time, 'time', return_value=self.now + 86401):
            self.assertFalse(progress.complete())

    def test_cached_external_files_require_current_complete_proof(self):
        folder = self.root / 'frontend/e2e'
        folder.mkdir(parents=True)
        for name in ('one.test.ts', 'two.test.ts'):
            (folder / name).write_text('export {};', encoding='utf8')
        self.mapping['web'] = (Path('test_web_e2e.py'),)
        proof = {'frontend/e2e/one.test.ts': self.unit()}
        progress = self.progress(('web',), records=[self.record(proof)])
        plan = progress.child_plan()
        self.assertEqual(plan['external']['test_web_e2e.py'], ['frontend/e2e/two.test.ts'])
        test_resume.validate_child_plan(self.root, plan, state=self.context['state'], valid_seconds=86400)
        for bad in ({**plan, 'cached': {}}, {**plan, 'state': 'another'},
                    {**plan, 'cached': {name: {**row, 'at': self.now - 86401} for name, row in proof.items()}}):
            with self.subTest(plan=bad), self.assertRaises(ValueError):
                test_resume.validate_child_plan(self.root, bad, state=self.context['state'], valid_seconds=86400)

    def test_completed_container_updates_the_next_stage_plan_without_refreshing_its_proof(self):
        for name in ('frontend/test/component.test.ts', 'frontend/e2e/smoke.test.ts', 'frontend/e2e/setup.test.ts'):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('export {};', encoding='utf8')
        self.mapping['full'] = self.mapping['web'] = (Path('test_frontend_build.py'), Path('test_web_e2e.py'))
        progress = self.progress()
        progress.start()
        for module in ('test_frontend_build.py', 'test_web_e2e.py'):
            plan = progress.child_plan()
            test_resume.validate_child_plan(self.root, plan, state=self.context['state'], valid_seconds=86400)
            report = {'complete': True, 'success': True, 'count': 1, 'results': [
                {'id': case, 'outcome': 'pass'} for case in test_resume.CONTAINERS
                if test_resume.owner('case:' + case) == module]}
            self.assertTrue(progress.checkpoint([module], report, True))
            stamp = progress.units['frontend/test/component.test.ts']['at']
            updated = progress.child_plan()
            test_resume.validate_child_plan(self.root, updated, state=self.context['state'], valid_seconds=86400)
            self.assertEqual(updated['external'][module], [])
            self.assertEqual(updated['cached']['frontend/test/component.test.ts']['at'], stamp)
        self.assertTrue(progress.complete())

    def test_unrelated_python_failure_survives_browser_aggregation(self):
        smoke = next(case for case in runner.CI_BROWSER_TESTS if '.WebE2E' in case)
        ids = ['e2e:e2e/smoke.test.ts > failure', smoke,
               'test_web_e2e.SourcePolicyTests.test_contract']
        selectors = runner.rerun_selectors([{'id': name, 'outcome': 'fail'} for name in ids])
        self.assertEqual(selectors, ['test_web_e2e.SourcePolicyTests.test_contract', 'frontend/e2e/smoke.test.ts'])

    def test_setup_failure_selects_the_whole_module(self):
        self.assertEqual(runner.rerun_selectors([{'id': 'setUpClass (test_catalog.Suite)', 'outcome': 'error'}]),
                         ['test_catalog'])

    def test_external_success_cannot_hide_python_container_postcondition_failure(self):
        folder = self.root / 'frontend/e2e'
        folder.mkdir(parents=True)
        for name in ('one.test.ts', 'setup.test.ts'):
            (folder / name).write_text('export {};', encoding='utf8')
        self.mapping['web'] = (Path('test_web_e2e.py'),)
        smoke = next(case for case in test_resume.CONTAINERS if '.WebE2E' in case)
        setup = next(case for case in test_resume.CONTAINERS if '.SetupE2E' in case)
        proof = {name: self.unit() for name in test_resume.external_files(self.root, 'test_web_e2e.py')}
        proof.update({'case:' + smoke: self.unit(), 'case:' + setup: self.unit('fail')})
        plan = self.progress(('web',), records=[self.record(proof)]).child_plan()
        self.assertEqual(plan['skip_cases'], [smoke])
        self.assertIn(setup, plan['cases'])
        test_resume.validate_child_plan(self.root, plan, state=self.context['state'], valid_seconds=86400)
        self.assertIsNone(runner.rerun_selectors([
            {'id': setup, 'outcome': 'fail'}, {'id': 'e2e:e2e/smoke.test.ts > error', 'outcome': 'fail'}]))

    def test_input_change_after_a_failure_retains_unaffected_success(self):
        progress = self.progress()
        progress.start()
        progress.checkpoint(self.mapping['full'], self.report('test_catalog.py', 'test_web.py', failure='test_catalog.py'), True)
        manifest = {'files': {'src/peach/catalog.py': [420, evidence.digest('changed'), '100644']}, 'signatures': {}}
        current = {**self.context, 'manifest': manifest,
                   'state': evidence.digest([evidence.digest(manifest), self.context['environment']])}
        with mock.patch.object(evidence, 'inputs', return_value=current):
            self.assertEqual(progress.retain_current(), 1)
        record = evidence.read(self.root, current['state'])
        self.assertEqual(record['units']['test_web.py']['outcome'], 'pass')
        self.assertNotIn('test_catalog.py', record['units'])

    def test_narrow_resume_plan_excludes_unselected_containers(self):
        folder = self.root / 'frontend/e2e'
        folder.mkdir(parents=True)
        (folder / 'one.test.ts').write_text('export {};', encoding='utf8')
        self.mapping['full'] = (Path('test_catalog.py'), Path('test_web_e2e.py'))
        self.mapping['web'] = (Path('test_web_e2e.py'),)
        all_units = test_resume.scope_units(self.root, 'full', self.mapping.__getitem__)
        proof = {name: {**self.unit(), 'cohort': self.context['state']} for name in all_units}
        proof['test_catalog.py']['outcome'] = 'fail'
        progress = self.progress(records=[self.record(proof, cohort=self.context['state'])])
        plan = progress.child_plan(('catalog',))
        self.assertEqual(plan['case_universe'], [])
        test_resume.validate_child_plan(self.root, plan, state=self.context['state'], valid_seconds=86400)

    def test_cached_supplement_in_a_resumed_full_run_requires_its_proof(self):
        case = 'test_extra.Suite.test_value'
        self.mapping['full'] += (Path('test_extra.py'),)
        self.mapping['checks'] = (Path('test_catalog.py'),)
        proof = {name: {**self.unit(), 'cohort': self.context['state']}
                 for name in ('test_catalog.py', 'test_web.py', 'test_extra.py')}
        proof['test_catalog.py']['outcome'] = 'fail'
        progress = self.progress(records=[self.record(proof, cohort=self.context['state'])],
                                 supplements={'checks': (case,)})
        plan = progress.child_plan(('checks',))
        self.assertEqual(plan['case_universe'], [case])
        self.assertEqual(plan['cases'], [])
        test_resume.validate_child_plan(self.root, plan, state=self.context['state'], valid_seconds=86400)
        with self.assertRaises(ValueError):
            test_resume.validate_child_plan(self.root, {**plan, 'case_cached': {}},
                                           state=self.context['state'], valid_seconds=86400)
        test_type = type('Suite', (unittest.TestCase,), {'__module__': 'test_extra', 'test_value': lambda self: None})
        selected = test_resume.filter_suite(unittest.TestSuite([test_type('test_value')]), plan,
                                            {'test_catalog.py'}, unittest.TestSuite)
        self.assertEqual(selected.countTestCases(), 0)

    def test_successful_whole_module_rerun_restores_its_nested_coverage(self):
        folder = self.root / 'frontend/e2e'
        folder.mkdir(parents=True)
        (folder / 'one.test.ts').write_text('export {};', encoding='utf8')
        self.mapping['web'] = (Path('test_web_e2e.py'),)
        progress = self.progress(('web',))
        progress.start()
        progress.checkpoint(['test_web_e2e.py'], {'complete': True, 'success': False, 'count': 0,
            'results': [{'id': 'setUpClass (test_web_e2e.WebE2ESmokeTests)', 'outcome': 'error'}]}, True)
        self.assertFalse(progress.complete())
        progress.accept_success(['test_web_e2e'])
        self.assertTrue(progress.complete())

    def test_failed_full_file_preserves_the_successful_supplement_it_executed(self):
        case = 'test_extra.Suite.test_value'
        self.mapping['full'] += (Path('test_extra.py'),)
        supplements = {'checks': (case,)}
        progress = self.progress(supplements=supplements)
        progress.start()
        progress.checkpoint(['test_extra.py'], {'complete': True, 'success': False, 'count': 2, 'results': [
            {'id': case, 'outcome': 'pass'}, {'id': 'test_extra.Suite.test_other', 'outcome': 'fail'}]}, True)
        saved = evidence.read(self.root, self.context['state'])
        self.assertEqual(saved['units']['case:' + case]['outcome'], 'pass')
        resumed = self.progress(('checks',), records=[saved], supplements=supplements)
        self.assertTrue(resumed.complete())

    def test_fresh_file_verification_also_invalidates_its_supplement_receipts(self):
        case = 'test_catalog.Suite.test_value'
        record = self.record({'test_catalog.py': self.unit(), 'case:' + case: self.unit()})
        progress = self.progress(('catalog',), records=[record], supplements={'checks': (case,)}, force=True)
        self.assertNotIn('case:' + case, progress.units)

    def test_case_only_rerun_does_not_certify_its_entire_module(self):
        case = 'test_extra.Suite.test_value'
        self.mapping['full'] += (Path('test_extra.py'),)
        progress = self.progress(('catalog',), supplements={'catalog': (case,)})
        progress.start()
        progress.checkpoint(['test_catalog.py'], {'complete': True, 'success': False, 'count': 2, 'results': [
            {'id': 'test_catalog.Suite.test_value', 'outcome': 'pass'}, {'id': case, 'outcome': 'fail'}]}, True)
        progress.accept_success([case])
        self.assertTrue(progress.complete())
        self.assertNotIn('test_extra.py', progress.units)

    def test_serial_failure_preserves_the_successful_file(self):
        progress = self.progress()
        progress.start()
        def exercise(case):
            if type(case).__module__ == 'test_web':
                case.fail('fixture')
        suite = unittest.TestSuite(type('Suite', (unittest.TestCase,),
            {'__module__': name.removesuffix('.py'), 'test_value': exercise})('test_value')
            for name in ('test_catalog.py', 'test_web.py'))
        chosen = set(self.mapping['full'])
        with mock.patch.object(runner, 'build_suite', return_value=suite), \
                mock.patch.object(runner, 'save_file_seconds'), mock.patch.object(runner.test_history, 'append'), \
                redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertFalse(runner.run_serial_suite(('full',), chosen, chosen, progress, 'fixture')[0])
        self.assertEqual(progress.units['test_catalog.py']['outcome'], 'pass')
        self.assertEqual(progress.units['test_web.py']['outcome'], 'fail')


class ShardReportTests(unittest.TestCase):
    def test_malformed_reports_are_failures(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'report.json'
            base = {'complete': True, 'success': True, 'count': 1, 'timings': [], 'files': {}, 'results': []}
            invalid = [{'complete': False}, {'count': -1}, {'timings': [[float('nan'), 'id']]},
                       {'timings': ['invalid']}, {'files': {'test_a': 'invalid'}}, {'results': [None]},
                       {'results': [{'id': 'test_a.Suite.test_value', 'outcome': 'fail'}]}]
            for fields in invalid:
                with self.subTest(fields=fields):
                    path.write_text(json.dumps({**base, **fields}), encoding='utf8')
                    self.assertFalse(test_shard_results.read_report(path)['success'])

    def test_a_completed_child_with_a_live_thread_is_reaped(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / '0.json'
            script = Path(folder) / 'child.py'
            script.write_text("import json,pathlib,sys,threading\n"
                "threading.Thread(target=threading.Event().wait).start()\n"
                "pathlib.Path(sys.argv[1]).write_text(json.dumps({"
                "'complete': True,'success': True,'count': 1,'timings': []}))\n", encoding='utf8')
            process = subprocess.Popen([sys.executable, '-X', 'utf8', str(script), str(path)])
            try:
                deadline = time.monotonic() + 10
                while not path.exists() and time.monotonic() < deadline:
                    time.sleep(.02)
                self.assertTrue(path.exists())
                self.assertIsNone(process.poll())
                forced = set()
                with redirect_stdout(io.StringIO()):
                    finished = test_shard_results.completed_processes({0: (process, None)}, Path(folder),
                        {0: 0}, now=test_shard_results.EXIT_GRACE_SECONDS + 1, forced=forced)
                self.assertEqual(finished, [0])
                self.assertEqual(forced, {0})
                self.assertIsNotNone(process.poll())
            finally:
                if process.poll() is None:
                    test_shard_results.stop_process_tree(process)


class SubprocessResumeTests(unittest.TestCase):
    def invoke(self, repo, scope, *options):
        # 夹具仓库的运行只验证续跑，不去排本机真实的整机名额。
        env = {**os.environ, 'GITHUB_ACTIONS': 'false', 'CI': '', 'PEACH_TEST_SLOTS_HELD': str(os.getpid())}
        for key in ('PEACH_TEST_FOCUS', 'PEACH_E2E_FILES', 'PEACH_VITEST_FILES'):
            env.pop(key, None)
        return fixture_process([sys.executable, '-X', 'utf8', str(repo / 'entry.py'),
                                '--scope', scope, '--jobs', 'auto', *options], repo, env)

    def test_real_parent_and_children_resume_only_the_failed_file(self):
        self.check_resume_after_failure('auto')

    def test_real_full_resume_preserves_coverage_and_requires_current_environment(self):
        self.check_resume_after_failure('full', '--resume', check_full_modes=True)

    def check_resume_after_failure(self, scope, *options, check_full_modes=False):
        source = Path(__file__).resolve().parents[1]
        modules = ('test_runner', 'test_evidence', 'test_history', 'test_resume', 'test_run_progress',
                   'test_shard_results', 'test_environment_identity', 'test_focus', 'change_impact', 'test_inputs',
                   'test_slots')
        files = {'scripts/__init__.py': '', '.gitignore': 'build/\nruntime/\n__pycache__/\n*.pyc\n',
                 '.gitattributes': '* text=auto eol=lf\n'}
        files.update({'scripts/' + name + '.py': (source / 'scripts' / (name + '.py')).read_text(encoding='utf8')
                      for name in modules})
        # 运行器在导入时读选测登记表。
        files['scripts/scope_registry.toml'] = (source / 'scripts/scope_registry.toml').read_text(encoding='utf8')
        files['entry.py'] = (
            'from scripts import test_runner as runner\nraise SystemExit(runner.main())\n')
        sample = ('from pathlib import Path\nimport unittest\nclass Suite(unittest.TestCase):\n'
                  '    def test_value(self):\n        root=Path(__file__).resolve().parents[1]/"runtime"\n'
                  '        with (root/(__name__+".calls")).open("a", encoding="utf8") as output:\n'
                  '            output.write("called\\n")\n'
                  '        if __name__ == "test_web_library_shortcuts":\n'
                  '            self.assertFalse((root/"fail").exists())\n')
        for name in ('test_ad_judgement', 'test_web_library_shortcuts'):
            files['tests/' + name + '.py'] = sample
        with tempfile.TemporaryDirectory() as folder:
            repo = seed_repository(Path(folder).resolve() / 'repo', files, 'fixture')
            evidence.git(repo, 'checkout', '-b', 'fixture')
            (repo / 'shared-input').write_text('fixture', encoding='utf8')
            evidence.git(repo, 'add', 'shared-input')
            evidence.git(repo, 'commit', '-m', 'fixture')
            runtime = repo / 'runtime'
            runtime.mkdir()
            marker = runtime / 'fail'
            marker.touch()
            code, output = self.invoke(repo, 'full')
            self.assertEqual(code, 1, output)
            record_file = next(path for path in (repo / 'build/agent-verification').glob('*.json')
                               if len(path.stem) == 64)
            before = json.loads(record_file.read_text(encoding='utf8'))
            self.assertEqual(before['units']['test_ad_judgement.py']['outcome'], 'pass')
            stamp = before['units']['test_ad_judgement.py']['at']
            successful_calls = (runtime / 'test_ad_judgement.calls').read_text(encoding='utf8')
            failed_calls = (runtime / 'test_web_library_shortcuts.calls').read_text(encoding='utf8').splitlines()
            marker.unlink()
            code, output = self.invoke(repo, scope, *options)
            self.assertEqual(code, 0, output)
            after = json.loads(record_file.read_text(encoding='utf8'))
            self.assertEqual(after['units']['test_ad_judgement.py']['at'], stamp)
            self.assertEqual(after['validated']['full'], stamp)
            self.assertEqual((runtime / 'test_ad_judgement.calls').read_text(encoding='utf8'), successful_calls)
            self.assertEqual(len((runtime / 'test_web_library_shortcuts.calls').read_text(encoding='utf8').splitlines()),
                             len(failed_calls) + 1)
            if check_full_modes:
                paths = [runtime / (name + '.calls') for name in ('test_ad_judgement', 'test_web_library_shortcuts')]
                completed = [path.read_text(encoding='utf8') for path in paths]
                code, output = self.invoke(repo, 'full', '--resume')
                self.assertEqual(code, 0, output)
                self.assertEqual([path.read_text(encoding='utf8') for path in paths], completed)
                cached = json.loads(record_file.read_text(encoding='utf8'))
                self.assertEqual(cached['validated']['full'], stamp)
                (record_file.parent / 'test-timings.json').write_text(json.dumps({
                    'seconds': {path.stem: 0.0 for path in paths}}), encoding='utf8')
                with mock.patch.dict(os.environ, {'PEACH_TEST_RESUME_FIXTURE': 'another-environment'}):
                    code, output = self.invoke(repo, 'full', '--resume')
                self.assertEqual(code, 0, output)
                self.assertEqual([len(path.read_text(encoding='utf8').splitlines()) for path in paths],
                                 [len(body.splitlines()) + 1 for body in completed])
                for flags in ((), ('--fresh',)):
                    counts = [len(path.read_text(encoding='utf8').splitlines()) for path in paths]
                    code, output = self.invoke(repo, 'full', *flags)
                    self.assertEqual(code, 0, output)
                    self.assertEqual([len(path.read_text(encoding='utf8').splitlines()) for path in paths],
                                     [count + 1 for count in counts])


class SelectionEnvironmentTests(unittest.TestCase):
    VARIABLES = ('PEACH_TEST_FOCUS', 'PEACH_E2E_FILES', 'PEACH_VITEST_FILES')

    def setUp(self):
        self.enterContext(mock.patch.dict(os.environ))
        for key in self.VARIABLES:
            os.environ.pop(key, None)

    def suite(self, captured, fail_container=False):
        def observe(case):
            captured.append((case.id(), {key: os.environ.get(key) for key in self.VARIABLES}))
            if fail_container and case.id() in test_resume.CONTAINERS:
                case.fail('fixture')
        backend = type('Backend', (unittest.TestCase,), {'__module__': __name__,
                       'test_before': observe, 'test_after': observe})
        container = type('VitestTests', (unittest.TestCase,), {'__module__': 'test_frontend_build',
                         'test_the_island_suite_passes': observe})
        return unittest.TestSuite([backend('test_before'), container('test_the_island_suite_passes'), backend('test_after')])

    def assert_isolated(self, captured, *, focus):
        for _, values in (captured[0], captured[2]):
            self.assertEqual(values, dict.fromkeys(self.VARIABLES))
        values = captured[1][1]
        self.assertEqual(json.loads(values['PEACH_VITEST_FILES']), ['test/example.test.ts'])
        self.assertIsNone(values['PEACH_E2E_FILES'])
        self.assertEqual(values['PEACH_TEST_FOCUS'], '1' if focus else None)
        self.assertTrue(all(os.environ.get(key) is None for key in self.VARIABLES))

    def test_serial_formal_selection_only_applies_to_its_container(self):
        captured = []
        selection = {'external': {'test_frontend_build.py': ['frontend/test/example.test.ts'],
                                  'test_web_e2e.py': ['frontend/e2e/example.test.ts']}}
        progress = mock.Mock()
        progress.child_plan.return_value = selection
        progress.checkpoint.return_value = True
        chosen = {Path('test_frontend_build.py'), Path('test_test_evidence.py')}
        with mock.patch.object(runner, 'build_suite', return_value=self.suite(captured)), \
                mock.patch.object(runner, 'save_file_seconds'), mock.patch.object(runner.test_history, 'append'), \
                redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertTrue(runner.run_serial_suite(('full',), chosen, chosen, progress, 'fixture')[0])
        self.assert_isolated(captured, focus=False)

    def test_mixed_focus_selection_does_not_leak_into_backend_cases(self):
        from scripts import test_focus
        captured = []
        args = runner.argparse.Namespace(focus=['fixture'])
        with mock.patch.object(test_focus, 'selection', return_value=(self.suite(captured), (), ('test/example.test.ts',))), \
                mock.patch.object(runner.test_history, 'append'), \
                redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(test_focus.run(runner, args), 0)
        self.assert_isolated(captured, focus=True)

    def test_container_failure_restores_selection_before_the_next_case(self):
        captured = []
        selection = {'external': {'test_frontend_build.py': ['frontend/test/example.test.ts']}}
        progress = mock.Mock()
        progress.child_plan.return_value = selection
        progress.checkpoint.return_value = True
        chosen = {Path('test_frontend_build.py'), Path('test_test_evidence.py')}
        with mock.patch.object(runner, 'build_suite', return_value=self.suite(captured, fail_container=True)), \
                mock.patch.object(runner, 'save_file_seconds'), mock.patch.object(runner.test_history, 'append'), \
                redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertFalse(runner.run_serial_suite(('full',), chosen, chosen, progress, 'fixture')[0])
        self.assert_isolated(captured, focus=False)


class ShardProtocolTests(unittest.TestCase):
    def test_backend_shard_runs_with_the_full_parent_browser_plan(self):
        root = Path(__file__).resolve().parents[1]
        progress = test_run_progress.RunProgress(root, evidence.inputs(root), ('full',),
            runner.selected_files, runner.scopes_for_changes, runner.SCOPES, supplements=runner.SCOPE_TEST_IDS)
        with tempfile.TemporaryDirectory() as folder:
            temporary = Path(folder).resolve()
            shard = temporary / 'plan.json'
            shard.write_text(json.dumps([['test_test_planning.py']]), encoding='utf8')
            resume = temporary / 'resume.json'
            resume.write_text(json.dumps(progress.child_plan()), encoding='utf8')
            report = temporary / 'report.json'
            code, output = fixture_process([sys.executable, '-X', 'utf8', str(root / 'scripts/test_runner.py'),
                '--scope', 'full', '--shard-plan', str(shard), '--resume-plan', str(resume),
                '--timings', str(report)], root, dict(os.environ))
            self.assertEqual(code, 0, output)
            result = test_shard_results.read_report(report)
            self.assertTrue(result['success'], output)
            self.assertGreater(result['count'], 0)


class VerificationTests(unittest.TestCase):
    def setUp(self):
        # 这组用例模拟本机验收，运行它的 CI job 身份不属于临时仓库。
        self.enterContext(mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "false"}))
        self.enterContext(mock.patch.object(coordinator, "require_pull_request", side_effect=
            lambda worker, branch, target, head: {"url": "https://github.com/example/peach/pull/1",
                                                  "head": head, "base": target, "refs": []}))
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.repo = seed_repository(self.root / "repo", {
            ".gitignore": "build/\n",
            "README.md": "内容\n",
            "src/peach/__init__.py": '__version__ = "0.7.30"\n',
        }, "seed")

    def git(self, *args):
        return evidence.git(self.repo, *args)

    def worker(self):
        item = coordinator.create(self.repo, "codex", "verification", self.root / "worktrees")
        worker = Path(item["path"])
        (worker / "README.md").write_text("测试内容\n", encoding="utf-8")
        (worker / "README.zh-CN.md").write_text("Test content\n", encoding="utf-8")
        evidence.git(worker, "add", "README.md", "README.zh-CN.md")
        evidence.git(worker, "commit", "-m", "docs: test", "-m",
                     "Co-Authored-By: Codex (GPT-5.5) <noreply@openai.com>")
        return worker, item["branch"]

    def certify(self, worker, scopes=("checks", "tooling"), success=True):
        state = evidence.key(worker)
        evidence.write(worker, state, scopes, success=success, elapsed=1, slowest=[], count=1)
        return state

    def scope_suite(self, *scopes, fail=False, **planned):
        suite = unittest.TestSuite()
        selected = {path for scope in scopes for path in runner.selected_files(scope)}
        assigned = planned.get('assigned_names')
        def exercise(case):
            if fail:
                case.fail('fixture')
        for path in sorted(selected):
            if assigned is None or path.name in assigned:
                case = type('Suite', (unittest.TestCase,), {'__module__': path.stem, 'test_value': exercise})
                suite.addTest(case('test_value'))
        return suite

    def test_gate_requires_matching_successful_coverage(self):
        worker, branch = self.worker()
        before = self.git("rev-parse", "HEAD")
        with self.assertRaisesRegex(coordinator.WorkspaceError, "有效测试记录"):
            coordinator.integrate(self.repo, branch)
        self.certify(worker, ("web",))
        with self.assertRaisesRegex(coordinator.WorkspaceError, "有效测试记录"):
            coordinator.ready(worker)
        self.certify(worker, success=False)
        self.assertEqual(self.git("rev-parse", "HEAD"), before)
        coordinator.require_pull_request.assert_not_called()
        self.certify(worker)
        coordinator.ready(worker)
        result = coordinator.integrate(self.repo, branch)
        self.assertTrue(result["ok"])
        entries = coordinator._worktree_entries(self.repo)
        self.assertFalse(next(e for e in entries if e.get("branch") == branch).get("locked"))

    def test_target_advance_requires_combined_tree_verification(self):
        worker, branch = self.worker()
        self.certify(worker)
        (self.repo / "another.md").write_text("并行任务\n", encoding="utf-8")
        self.git("add", "another.md")
        self.git("commit", "-m", "docs: parallel")
        with self.assertRaisesRegex(coordinator.WorkspaceError, "已前进"):
            coordinator.integrate(self.repo, branch)

    def test_reporting_guard_preserves_verification_and_environment_selection_invalidates_it(self):
        worker, _ = self.worker()
        with mock.patch.dict(os.environ, {"PEACH_REPORTING_TEST_MODE": "1",
                                         "PEACH_REPORTING_ENVIRONMENT": "production"}):
            state = self.certify(worker)
        with mock.patch.dict(os.environ, {"PEACH_REPORTING_ENVIRONMENT": "production"}):
            os.environ.pop("PEACH_REPORTING_TEST_MODE", None)
            self.assertEqual(evidence.key(worker), state)
            coordinator.ready(worker)
            with mock.patch.dict(os.environ, {"PEACH_REPORTING_ENVIRONMENT": "test"}):
                self.assertNotEqual(evidence.key(worker), state)
                with self.assertRaisesRegex(coordinator.WorkspaceError, "有效测试记录"):
                    coordinator.ready(worker)

    def test_the_run_scoped_temp_folder_does_not_enter_the_environment_fingerprint(self):
        worker, _ = self.worker()
        with mock.patch.dict(os.environ, {"PEACH_TEST_RUN_TEMP": str(self.root / "peach-test-run-1")}):
            state = self.certify(worker)
        os.environ.pop("PEACH_TEST_RUN_TEMP", None)
        self.assertEqual(evidence.key(worker), state)
        coordinator.ready(worker)

    def test_target_change_during_verification_prevents_merge(self):
        worker, branch = self.worker()
        self.certify(worker)
        verify = coordinator.require_verified
        def advance(*args):
            verify(*args)
            (self.repo / "parallel.md").write_text("并发改动\n", encoding="utf-8")
            self.git("add", "parallel.md")
            self.git("commit", "-m", "docs: concurrent")
        with mock.patch.object(coordinator, "require_verified", side_effect=advance):
            with self.assertRaisesRegex(coordinator.WorkspaceError, "集成工作树改变"):
                coordinator.integrate(self.repo, branch)
        self.assertEqual((self.repo / "README.md").read_text(encoding="utf-8"), "内容\n")

    def test_scope_refresh_preserves_expiry_of_other_scopes(self):
        state = evidence.key(self.repo)
        with mock.patch.object(evidence.time, "time", return_value=100):
            self.certify(self.repo, ("full",))
        with mock.patch.object(evidence.time, "time", return_value=86450):
            self.certify(self.repo, ("checks",))
        with mock.patch.object(evidence.time, "time", return_value=86550):
            record = evidence.read(self.repo, state)
            self.assertTrue(evidence.covers(record, ("checks",)))
            self.assertFalse(evidence.covers(record, ("web",)))

    def test_snapshot_tracks_untracked_deleted_and_modified_content(self):
        baseline = evidence.snapshot(self.repo)
        path = self.repo / "extra.md"
        path.write_text("未跟踪\n", encoding="utf-8")
        self.assertNotEqual(baseline, evidence.snapshot(self.repo))
        path.unlink()
        self.assertEqual(baseline, evidence.snapshot(self.repo))
        (self.repo / "README.md").unlink()
        self.assertNotEqual(baseline, evidence.snapshot(self.repo))

    def test_committing_a_deleted_file_preserves_the_verified_snapshot(self):
        original = evidence.manifest(self.repo)
        (self.repo / 'README.md').unlink()
        removed = evidence.manifest(self.repo)
        paths, _ = runner.change_impact.delta(original, removed)
        self.assertIn('README.md', paths)
        self.git('add', '--', 'README.md')
        self.git('commit', '-m', 'test: remove fixture document')
        self.assertEqual(removed, evidence.manifest(self.repo))

    def test_git_execute_mode_changes_require_full_even_without_content_changes(self):
        original = evidence.manifest(self.repo)
        self.git("update-index", "--chmod=+x", "README.md")
        current = evidence.manifest(self.repo)
        paths, kinds = runner.change_impact.delta(original, current)
        self.assertEqual(kinds["README.md"], "unsafe")
        self.assertEqual(runner.scopes_for_changes(paths, kinds=kinds)[0], ("full",))

    def test_known_file_addition_and_deletion_follow_their_domain(self):
        name = "src/peach/web_follow.py"
        path = self.repo / name
        path.write_text("value = 1\n", encoding="utf-8")
        self.git("add", "--", name)
        contents = runner.changed_contents(self.repo, "HEAD", [name])
        with mock.patch.object(runner, '_import_index', return_value=({}, {}, frozenset())):
            self.assertEqual(runner.scopes_for_changes([name], contents=contents)[0], ("follow",))
        self.git("commit", "-m", "test: fixture")
        path.unlink()
        contents = runner.changed_contents(self.repo, "HEAD", [name])
        with mock.patch.object(runner, '_import_index', return_value=({}, {}, frozenset())):
            self.assertEqual(runner.scopes_for_changes([name], contents=contents)[0], ("follow",))

    def test_known_python_file_execute_mode_requires_full(self):
        name = "src/peach/web_follow.py"
        (self.repo / name).write_text("value = 1\n", encoding="utf-8")
        self.git("add", "--", name)
        self.git("commit", "-m", "test: fixture")
        self.git("update-index", "--chmod=+x", name)
        contents = runner.changed_contents(self.repo, "HEAD", [name])
        self.assertEqual(runner.scopes_for_changes([name], contents=contents)[0], ("full",))

    def test_python_symlinks_require_full_for_each_change_kind(self):
        name = "src/peach/web_follow.py"
        for modes in (":000000 120000", ":120000 120000", ":120000 000000"):
            with self.subTest(modes=modes), mock.patch.object(evidence, "git", return_value=modes):
                contents = runner.changed_contents(self.repo, "HEAD", [name])
            self.assertEqual(runner.scopes_for_changes([name], contents=contents)[0], ("full",))

    def test_repeated_import_path_preserves_dependency_identity(self):
        site = self.root / "site"
        metadata = site / "peach_evidence_probe-1.0.dist-info" / "METADATA"
        metadata.parent.mkdir(parents=True)
        metadata.write_text("Metadata-Version: 2.1\nName: peach-evidence-probe\nVersion: 1.0\n")
        with mock.patch.object(evidence, "python_identity", return_value={
                "version": sys.version, "sites": [str(site), str(site)]}):
            baseline = evidence.environment(self.repo)
            with mock.patch.object(sys, "path", [str(site), *sys.path]):
                self.assertEqual(evidence.environment(self.repo), baseline)
            metadata.write_text("Metadata-Version: 2.1\nName: peach-evidence-probe\nVersion: 2.0\n")
            self.assertNotEqual(evidence.environment(self.repo), baseline)

    def test_the_same_tool_reached_by_another_path_keeps_one_identity(self):
        """工具身份是它自报的版本，不是 PATH 解析到的那条路径。

        记录因此不再绑在 shell 上。同一套 Git 安装，PowerShell 解析到 `Git\\cmd\\git.exe`、
        Git Bash 解析到 `Git\\mingw64\\bin\\git.exe`，两个前端字节不同、`git --version`
        相同。把路径和字节记进指纹的话，在一个 shell 里跑出的记录到另一个 shell 里就查
        不到：`integrate` 报「缺少有效测试记录」，回到工作树跑 `auto` 又说「复用记录」，
        两句查的是两个键，代价是白跑一遍全量。
        """
        here = Path(sys.executable)
        detour = here.parent / ".." / here.parent.name / here.name
        self.assertNotEqual(str(detour), str(here))
        probe = ("--version",)
        self.assertEqual(evidence.tool_identity(str(here), here.stat().st_mtime_ns, probe),
                         evidence.tool_identity(str(detour), 0, probe))
        with mock.patch.object(evidence, "tool_identity", return_value="v1") as probed:
            with mock.patch.object(evidence.shutil, "which", side_effect=lambda name: f"/a/{name}"):
                baseline = evidence.environment(self.repo)
            probed.reset_mock()
            with mock.patch.object(evidence.shutil, "which", side_effect=lambda name: f"/b/{name}"):
                self.assertEqual(evidence.environment(self.repo), baseline)
            self.assertEqual({call.args[0] for call in probed.call_args_list},
                             {f"/b/{name}" for name, _ in evidence.TOOL_PROBES},
                             "每个探针都要被问到，不能有工具悄悄不进指纹")
        with mock.patch.object(evidence.shutil, "which", side_effect=lambda name: f"/a/{name}"):
            with mock.patch.object(evidence, "tool_identity", return_value="v2"):
                self.assertNotEqual(evidence.environment(self.repo), baseline)
        with mock.patch.object(evidence.shutil, "which", return_value=None):
            self.assertNotEqual(evidence.environment(self.repo), baseline)

    def test_a_newer_uv_keeps_the_environment_fingerprint_stable(self):
        """uv 只负责建环境，它自己的版本不进指纹。

        winget 会自动升级 uv，而它装出来的解释器与包已经逐个进了指纹。把 uv 的版本也
        记进去的话，升级当天全部测试记录一起失效，被验证的那套环境却一个字节都没变，
        代价是每台机器重跑一遍全量。
        """
        def probe_as(uv: str, others: str):
            return mock.patch.object(
                evidence, "tool_identity",
                side_effect=lambda executable, stamp, probe:
                uv if executable.endswith("uv") else others)

        with mock.patch.object(evidence.shutil, "which", side_effect=lambda name: f"/a/{name}"):
            with probe_as("uv-1", "ok"):
                baseline = evidence.environment(self.repo)
            with probe_as("uv-2", "ok"):
                self.assertEqual(evidence.environment(self.repo), baseline)
            with probe_as("uv-1", "changed"):
                self.assertNotEqual(evidence.environment(self.repo), baseline)

    def test_an_unspawnable_tool_is_not_the_same_as_a_missing_one(self):
        """探针跑不起来和工具不在 PATH 上是两种环境，指纹要能分开。"""
        absent = self.root / "no-such-tool"
        self.assertEqual(evidence.tool_identity(str(absent), 0, ("--version",)), "unspawnable")
        with mock.patch.object(evidence.shutil, "which", side_effect=lambda name: str(absent)):
            broken = evidence.environment(self.repo)
        with mock.patch.object(evidence.shutil, "which", return_value=None):
            self.assertNotEqual(evidence.environment(self.repo), broken)

    def test_unspawnable_tools_names_every_resolved_tool_blocked_by_permissions(self):
        """入口需要工具名来给出一条明确结论，不能等测试分片各自抛 CreateProcess。"""
        with mock.patch.object(evidence.shutil, "which", side_effect=lambda name: f"/tools/{name}"), \
                mock.patch.object(evidence, "tool_identity",
                                  side_effect=lambda executable, stamp, probe:
                                  "unspawnable" if executable.endswith(("uv", "git")) else "ok"), \
                mock.patch.object(evidence.Path, "stat", return_value=mock.Mock(st_mtime_ns=1)):
            self.assertEqual(evidence.unspawnable_tools(), ("uv", "git"))

    def test_commit_metadata_preserves_content_record(self):
        worker, _ = self.worker()
        state = self.certify(worker)
        evidence.git(worker, "commit", "--amend", "-m", "docs: wording")
        self.assertEqual(evidence.key(worker), state)
        self.assertTrue(evidence.covers(evidence.read(worker, state), ("checks",)))
        (worker / "README.md").write_text("不同内容\n", encoding="utf-8")
        self.assertNotEqual(evidence.key(worker), state)

    def test_environment_change_expiry_and_failure_invalidate_records(self):
        state = self.certify(self.repo, ("full",))
        with mock.patch.object(evidence, "environment", return_value="different"):
            self.assertNotEqual(evidence.key(self.repo), state)
        with mock.patch.object(evidence.time, "time", return_value=10**12):
            self.assertFalse(evidence.covers(evidence.read(self.repo, state), ("web",)))
        self.certify(self.repo, ("web",), success=False)
        self.assertFalse(evidence.covers(evidence.read(self.repo, state), ("web",)))

    def test_cross_process_integration_lock_refuses_mutation(self):
        _, branch = self.worker()
        folder = evidence.evidence_dir(self.repo)
        folder.mkdir(parents=True)
        before = self.git("rev-parse", "HEAD")
        command = [sys.executable, str(Path(coordinator.__file__)), "--repo", str(self.repo),
                   "integrate", "--branch", branch]
        with evidence.held(folder / "integration.lock", branch="agent/x/other"):
            result = subprocess.run(command, capture_output=True, text=True,
                                    encoding="utf-8", timeout=15,
                                    env={**os.environ, "PYTHONIOENCODING": "gbk"})
        self.assertEqual(result.returncode, 2, result.stderr)
        error = json.loads(result.stdout)["error"]
        self.assertIn("另一任务正在集成", error)
        self.assertIn(f"pid {os.getpid()}", error, "被拒的一方要能看到在等谁")
        self.assertIn("branch agent/x/other", error)
        self.assertEqual(self.git("rev-parse", "HEAD"), before)

    def test_a_held_lock_leaves_a_holder_note_only_while_it_is_held(self):
        """三个会话同时在等锁时，光看进程列表判断不出谁在测；记录要说清 pid、时间和范围。"""
        lock = evidence.evidence_dir(self.repo) / "full-suite.lock"
        with evidence.held(lock, scope="full"):
            note = json.loads(evidence.holder_path(lock).read_text(encoding="utf-8"))
            self.assertEqual(note["pid"], os.getpid())
            self.assertEqual(note["scope"], "full")
            self.assertIn("pid", evidence.describe_holder(lock))
            self.assertIn("scope full", evidence.describe_holder(lock))
        self.assertFalse(evidence.holder_path(lock).exists())
        self.assertIn("刚退出或没留记录", evidence.describe_holder(lock))

    def test_holder_note_cleanup_waits_for_a_reader_to_close_the_file(self):
        lock = evidence.evidence_dir(self.repo) / "full-suite.lock"
        note = evidence.holder_path(lock)
        owner_ready = threading.Event()
        reader_open = threading.Event()
        owner_close = threading.Event()
        owner_exiting = threading.Event()
        reader_close = threading.Event()
        original = Path.read_text

        def read_note(path, *args, **kwargs):
            if path != note:
                return original(path, *args, **kwargs)
            with path.open(encoding="utf-8") as handle:
                reader_open.set()
                if not reader_close.wait(5):
                    raise TimeoutError("测试读者没有收到关闭信号")
                return handle.read()

        def own():
            with evidence.held(lock, scope="full"):
                owner_ready.set()
                if not owner_close.wait(5):
                    raise TimeoutError("测试持有者没有收到退出信号")
                owner_exiting.set()

        with ThreadPoolExecutor(max_workers=2) as pool, mock.patch.object(Path, "read_text", new=read_note):
            owner = pool.submit(own)
            try:
                self.assertTrue(owner_ready.wait(5))
                reader = pool.submit(evidence.describe_holder, lock)
                self.assertTrue(reader_open.wait(5))
                owner_close.set()
                self.assertTrue(owner_exiting.wait(5))
                with self.assertRaises(TimeoutError):
                    owner.result(timeout=0.1)
                self.assertTrue(note.exists())
            finally:
                owner_close.set()
                reader_close.set()
            owner.result(timeout=5)
            self.assertIn("scope full", reader.result(timeout=5))
        self.assertFalse(note.exists())


    def test_waiters_get_the_lock_in_arrival_order_and_see_their_place(self):
        lock = evidence.evidence_dir(self.repo) / "full-suite.lock"
        queue = evidence.queue_path(lock)
        order, errors = [], io.StringIO()

        def wait(name):
            with evidence.held(lock, wait_seconds=20, scope=name):
                order.append(name)
                time.sleep(0.3)

        def queued(count):
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                if len(list(queue.glob("*.json"))) == count:
                    return True
                time.sleep(0.05)
            return False

        with redirect_stderr(errors), ThreadPoolExecutor(max_workers=2) as pool:
            with evidence.held(lock, scope="holder"):
                first = pool.submit(wait, "first")
                self.assertTrue(queued(1))
                second = pool.submit(wait, "second")
                self.assertTrue(queued(2))
            first.result(timeout=20)
            second.result(timeout=20)
        self.assertEqual(order, ["first", "second"])
        self.assertIn("前面还有 1 个在排队", errors.getvalue())
        self.assertEqual(list(queue.glob("*.json")), [], "拿到锁或放弃等待都要撤票")
        self.assertFalse(queue.exists(), "最后一位撤票后不留空的排队目录，每次验证的状态锁也走这里")

    def test_a_live_ticket_ahead_keeps_newcomers_out_and_a_dead_one_is_cleared(self):
        lock = evidence.evidence_dir(self.repo) / "full-suite.lock"
        queue = evidence.queue_path(lock)
        queue.mkdir(parents=True, exist_ok=True)
        live = queue / "00000000000000000001-live.json"
        live.write_text(json.dumps({"pid": os.getpid(), "created": time.time(),
                                    "process_started": evidence._process_started(os.getpid())}),
                        encoding="utf-8")
        with self.assertRaises(evidence.Timeout):
            with evidence.held(lock, wait_seconds=0):
                pass
        live.unlink()
        finished = subprocess.run([sys.executable, "-c", "import os; print(os.getpid())"],
                                  capture_output=True, text=True, encoding="utf-8", check=True)
        dead = queue / "00000000000000000001-dead.json"
        dead.write_text(json.dumps({"pid": int(finished.stdout), "created": time.time() - 60,
                                    "process_started": time.time() - 60}), encoding="utf-8")
        with evidence.held(lock, wait_seconds=0, scope="after-dead"):
            self.assertFalse(dead.exists())

    def test_the_waiting_runner_names_the_holder_of_the_full_suite_lock(self):
        lock = evidence.evidence_dir(self.repo) / "full-suite.lock"
        output = io.StringIO()
        with evidence.held(lock, scope="full", root="elsewhere"), \
                redirect_stderr(io.StringIO()), redirect_stdout(output), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "build_suite", side_effect=AssertionError("不该开跑")):
            self.assertEqual(runner.main(["--scope", "full", "--lock-timeout", "0"]), 2)
        self.assertIn("本仓库全量测试正在运行", output.getvalue())
        self.assertIn(f"pid {os.getpid()}", output.getvalue())
        self.assertIn("root elsewhere", output.getvalue())

    def test_full_verification_waits_and_snapshots_after_the_holder_releases(self):
        lock = evidence.evidence_dir(self.repo) / "full-suite.lock"
        waiting = threading.Event()
        describe = evidence.describe_holder

        def describe_wait(path):
            waiting.set()
            return describe(path)

        output, errors = io.StringIO(), io.StringIO()
        with redirect_stderr(errors), redirect_stdout(output), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(evidence, "describe_holder", side_effect=describe_wait), \
                mock.patch.object(runner, "environment_preflight"), \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])) as run, \
                ThreadPoolExecutor(max_workers=1) as pool:
            with evidence.held(lock, scope="integrate"):
                future = pool.submit(runner.main, ["--scope", "full", "--lock-timeout", "5"])
                self.assertTrue(waiting.wait(5), "验证应等待持锁的集成")
                run.assert_not_called()
                (self.repo / "README.md").write_text("集成完成\n", encoding="utf-8")
            self.assertEqual(future.result(timeout=15), 0)
        self.assertIn("等待 full-suite.lock", errors.getvalue())
        self.assertNotIn("等待 full-suite.lock", output.getvalue())
        self.assertTrue(evidence.covers(evidence.read(self.repo, evidence.key(self.repo)), ("full",)))

    def test_full_verification_holds_the_lock_through_record_publication(self):
        before = self.git("rev-parse", "HEAD")
        publish = evidence.write

        def publish_locked(*args, **kwargs):
            with self.assertRaisesRegex(coordinator.WorkspaceError, "全量验证"):
                coordinator.integrate(self.repo, "master", lock_timeout=0)
            return publish(*args, **kwargs)

        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(evidence, "write", side_effect=publish_locked) as written, \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])):
            self.assertEqual(runner.main(["--scope", "full"]), 0)
        self.assertGreaterEqual(written.call_count, 2)
        self.assertEqual(self.git("rev-parse", "HEAD"), before)

    def test_integration_excludes_full_verification(self):
        def merge(*_):
            self.assertEqual(runner.main(["--scope", "full", "--lock-timeout", "0"]), 2)
            return {"ok": True}

        with redirect_stdout(io.StringIO()), mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "run_local_suite") as run, \
                mock.patch.object(coordinator, "_integrate_locked", side_effect=merge):
            self.assertTrue(coordinator.integrate(self.repo, "master")["ok"])
        run.assert_not_called()

    def test_integration_waits_for_full_verification_before_mutation(self):
        lock = evidence.evidence_dir(self.repo) / "full-suite.lock"
        waiting = threading.Event()
        describe = evidence.describe_holder

        def describe_wait(path):
            waiting.set()
            return describe(path)

        with redirect_stdout(io.StringIO()), \
                mock.patch.object(evidence, "describe_holder", side_effect=describe_wait), \
                mock.patch.object(coordinator, "_integrate_locked", return_value={"ok": True}) as merge, \
                ThreadPoolExecutor(max_workers=1) as pool:
            with evidence.held(lock, scope="full"):
                future = pool.submit(coordinator.integrate, self.repo, "master", lock_timeout=5)
                self.assertTrue(waiting.wait(5), "集成应等待全量记录写入完成")
                merge.assert_not_called()
            self.assertTrue(future.result(timeout=15)["ok"])
        merge.assert_called_once()

    def test_empty_active_worktree_survives_prune(self):
        item = coordinator.create(self.repo, "codex", "active", self.root / "worktrees")
        report = coordinator.prune(self.repo, apply=True)
        self.assertTrue(Path(item["path"]).is_dir())
        self.assertTrue(any(row["path"] == item["path"] for row in report["kept"]))

    def test_auto_uses_scope_union_and_full_for_shared_inputs(self):
        self.assertEqual(runner.scopes_for_changes([])[0], ("checks",))
        self.assertEqual(runner.scopes_for_changes(["docs/HANDOFF.md"])[0], ("checks",))
        self.assertEqual(runner.scopes_for_changes(["web/app.js", "src/peach/follow.py"])[0],
                         ("follow", "web"))
        for path in ("pyproject.toml", "scripts/test_runner.py", "scripts/test_evidence.py", 'scripts/test_focus.py',
                     "scripts/test_slots.py", "uv.lock", "src/peach/unknown.py"):
            self.assertEqual(runner.scopes_for_changes([path])[0], ("full",))

    def test_runner_reuses_success_and_fresh_failure_invalidates_it(self):
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "build_suite", side_effect=self.scope_suite) as build:
            self.assertEqual(runner.main(["--scope", "checks"]), 0)
            calls = build.call_count
            self.assertEqual(runner.main(["--scope", "checks"]), 0)
            self.assertGreater(calls, 0)
            self.assertEqual(build.call_count, calls)
            def failing(*scopes, **planned):
                return self.scope_suite(*scopes, fail=True, **planned)
            build.side_effect = failing
            self.assertEqual(runner.main(["--scope", "checks", "--fresh"]), 1)
            self.assertFalse(evidence.covers(evidence.read(self.repo, evidence.key(self.repo)), ("checks",)))

    def test_fresh_and_resume_are_mutually_exclusive(self):
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            runner.main(['--scope', 'full', '--fresh', '--resume'])
        self.assertEqual(error.exception.code, 2)

    def test_a_parallel_run_signs_one_record_from_the_merged_shards(self):
        """并行时父进程不自己跑用例，只按分片汇总签一份记录；一片红就没有记录。"""
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "build_suite", side_effect=AssertionError("父进程不该自己跑")), \
                mock.patch.object(runner, "GATE_TESTS", frozenset()), \
                mock.patch.object(runner, "run_shards", return_value=(True, 3, [(0.5, "x"), (0.1, "y")])) as shards:
            self.assertEqual(runner.main(["--scope", "checks", "--jobs", "2"]), 0)
        shards.assert_called_once()
        self.assertEqual(shards.call_args.args, (("checks",),))
        self.assertEqual(shards.call_args.kwargs["jobs"], 2)
        self.assertGreater(shards.call_args.kwargs["shard_count"], 1)
        record = evidence.read(self.repo, evidence.key(self.repo))
        self.assertTrue(evidence.covers(record, ("checks",)))
        self.assertEqual(record["count"], 3)
        self.assertEqual(record["slowest"][0], [0.5, "x"])
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "run_shards", return_value=(False, 3, [])):
            self.assertEqual(runner.main(["--scope", "checks", "--jobs", "2", "--fresh"]), 1)
        self.assertFalse(evidence.covers(evidence.read(self.repo, evidence.key(self.repo)), ("checks",)))

    def test_serial_full_run_releases_memory_between_shards(self):
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "build_suite", side_effect=AssertionError("父进程不加载全量用例")), \
                mock.patch.object(runner, "GATE_TESTS", frozenset()), \
                mock.patch.object(runner, "run_shards", return_value=(True, 7, [])) as shards:
            self.assertEqual(runner.main(["--scope", "full", "--jobs", "1"]), 0)
        self.assertEqual([call.kwargs['shard_count'] for call in shards.call_args_list], [4, 1, 1])
        self.assertTrue(all(call.kwargs['jobs'] == 1 for call in shards.call_args_list))
        self.assertCountEqual([name for call in shards.call_args_list for group in call.kwargs['plan'] for name in group],
                              [path.name for path in runner.selected_files('full')])
        record = evidence.read(self.repo, evidence.key(self.repo))
        self.assertTrue(evidence.covers(record, ("full",)))
        self.assertEqual(record["count"], 21)
        self.assertLessEqual({'输入快照', '历史记录', '恢复规划', '测试执行', '结束核验'}, record['phases'].keys())
        self.assertGreaterEqual(record['elapsed'], sum(record['phases'][name] for name in
                                                     ('输入快照', '历史记录', '恢复规划', '测试执行', '结束核验')))

    def test_a_failure_that_passes_alone_signs_the_record_and_names_the_flaky_file(self):
        """全量里挂、单独重跑过的：记录照样算通过，偶发的文件名留在记录里；单独也挂就没有记录。"""
        def shards(*_args, outcomes, **_kwargs):
            outcomes.append({"id": "e2e:e2e/folder-layout.test.ts > 目录 > 滚到底", "outcome": "fail",
                             "seconds": 2.0, "message": "height 0"})
            return False, 7, []

        rerun = runner.rerun_failures
        for code, signed in ((0, True), (1, False)):
            spawn = mock.Mock(return_value=mock.Mock(returncode=code))
            with self.subTest(rerun_exit=code), \
                    redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                    mock.patch.object(runner, "ROOT", self.repo), \
                    mock.patch.object(runner, "GATE_TESTS", frozenset()), \
                    mock.patch.object(runner, "run_shards", side_effect=shards), \
                    mock.patch.object(runner, "rerun_failures", lambda rows, spawn=spawn: rerun(rows, spawn=spawn)):
                self.assertEqual(runner.main(["--scope", "full", "--jobs", "1", "--fresh"]), 0 if signed else 1)
            record = evidence.read(self.repo, evidence.key(self.repo))
            self.assertEqual(evidence.covers(record, ("full",)), signed)
            if signed:
                self.assertEqual(record["flaky"], ["frontend/e2e/folder-layout.test.ts"])

    def test_full_baseline_requires_only_new_scopes_without_extending_its_age(self):
        original = self.certify(self.repo, ("full",))
        stamp = evidence.read(self.repo, original)["validated"]["full"]
        (self.repo / "README.md").write_text("集成差异\n", encoding="utf-8")
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("full",), "fixture")), \
                mock.patch.object(runner, "build_suite", side_effect=self.scope_suite) as build:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
        self.assertTrue(build.called)
        self.assertTrue(all(call.args == ('checks',) for call in build.call_args_list))
        record = evidence.read(self.repo, evidence.key(self.repo))
        self.assertEqual(record["baseline"], original)
        self.assertEqual(record["validated"]["full"], stamp)
        self.assertTrue(evidence.covers(record, ("full",)))

    def test_full_baseline_cannot_cover_shared_or_unknown_changes(self):
        self.certify(self.repo, ("full",))
        (self.repo / "pyproject.toml").write_text("# shared\n")
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("full",), "fixture")), \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])) as run:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
        run.assert_called_once()
        self.assertEqual(run.call_args.args[:2], (("full",), 1))

    def test_baseline_does_not_expand_a_small_requested_scope(self):
        self.certify(self.repo, ("full",))
        (self.repo / "src/peach/__init__.py").write_text('__version__ = "0.7.31"\n')
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("checks",), "fixture")), \
                mock.patch.object(runner, "build_suite", side_effect=self.scope_suite) as build:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
        self.assertTrue(build.called)
        for call in build.call_args_list:
            self.assertEqual(call.args, ('checks',))
            self.assertLessEqual(set(call.kwargs.get('assigned_names', ())),
                                {path.name for path in runner.selected_files('checks')})

    def test_baseline_distinguishes_version_assignment_and_package_logic(self):
        self.certify(self.repo, ("full",))
        version = self.repo / "src/peach/__init__.py"
        version.write_text('__version__ = "0.7.31"\n')
        candidates = list(evidence.baselines(self.repo, evidence.inputs(self.repo)))
        self.assertTrue(candidates[0][2])
        version.write_text('__version__ = "0.7.31"\nflag = True\n')
        candidates = list(evidence.baselines(self.repo, evidence.inputs(self.repo)))
        self.assertFalse(candidates[0][2])
        self.assertIn("src/peach/__init__.py", candidates[0][1])

    def test_holder_notes_never_crowd_the_full_baseline_out_of_the_scan(self):
        self.certify(self.repo, ("full",))
        folder = evidence.evidence_dir(self.repo)
        for index in range(40):
            (folder / f"{index:064x}.lock.holder.json").write_text("{}", encoding="utf-8")
        candidates = list(evidence.baselines(self.repo, evidence.inputs(self.repo)))
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0][1], [])

    def test_a_record_deleted_while_the_folder_is_scanned_is_skipped(self):
        self.certify(self.repo, ("full",))
        gone = evidence.evidence_dir(self.repo) / f"{'0' * 64}.json"
        gone.write_text("{}", encoding="utf-8")
        stat = Path.stat

        def vanished(path, *args, **kwargs):
            if path.name == gone.name:
                raise FileNotFoundError(path)
            return stat(path, *args, **kwargs)

        with mock.patch.object(Path, "stat", vanished):
            candidates = list(evidence.baselines(self.repo, evidence.inputs(self.repo)))
        self.assertEqual(len(candidates), 1)

    def test_runner_rejects_changes_during_verification(self):
        def mutate():
            (self.repo / "README.md").write_text("测试期间改动\n", encoding="utf-8")
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "build_suite", return_value=unittest.TestSuite([
                    unittest.FunctionTestCase(mutate)])):
            self.assertEqual(runner.main(["--scope", "checks"]), 4)
        self.assertFalse(evidence.covers(evidence.read(self.repo, evidence.key(self.repo)), ("checks",)))

    def test_full_run_retains_unaffected_files_then_completes_with_auto(self):
        mapping = {"full": ("test_checks.py", "test_web.py"), "checks": ("test_checks.py",),
                   "web": ("test_web.py",)}
        select = lambda scope, **_: tuple(Path(name) for name in mapping.get(scope, ()))

        def mutate(*args, **kwargs):
            (self.repo / "README.md").write_text("检查期间的文档修订\n", encoding="utf-8")
            return True, 2, []

        with redirect_stdout(io.StringIO()), mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "selected_files", side_effect=select), \
                mock.patch.object(runner, "environment_preflight"), \
                mock.patch.object(runner, "run_local_suite", side_effect=mutate):
            self.assertEqual(runner.main(["--scope", "full"]), 4)
        current = evidence.key(self.repo)
        record = evidence.read(self.repo, current)
        self.assertEqual(set(record["coverage"]), {"test_web.py"})
        self.assertFalse(evidence.covers(record, ("full",)))
        stamp = record["coverage"]["test_web.py"]
        with redirect_stdout(io.StringIO()), mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "selected_files", side_effect=select), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("full",), "fixture")), \
                mock.patch.object(runner, "environment_preflight"), \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])) as run:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
        run.assert_called_once()
        self.assertEqual(run.call_args.args[:2], (("checks",), 1))
        record = evidence.read(self.repo, current)
        self.assertTrue(evidence.covers(record, ("full",)))
        self.assertEqual(record["validated"]["full"], stamp)

    def test_shared_logic_and_environment_changes_discard_inflight_coverage(self):
        context = evidence.inputs(self.repo)
        source = {**context, "cohort": context["state"], "coverage": {"test_web.py": 100}}
        select = lambda scope: (Path("test_web.py"),)
        changed = self.repo / "tests/support/shared.py"
        changed.parent.mkdir(parents=True)
        changed.write_text("value = 1\n", encoding="utf-8")
        self.assertEqual(test_resume.combine(self.repo, [source], evidence.inputs(self.repo), {'test_web.py'},
                         runner.scopes_for_changes, select), {})
        changed.unlink()
        other = {**context, "environment": "different"}
        self.assertEqual(test_resume.combine(self.repo, [source], other, {'test_web.py'}, runner.scopes_for_changes, select), {})
        self.assertEqual(test_resume.combine(self.repo, [{**source, 'cohort': None}], context, {'test_web.py'},
                         runner.scopes_for_changes, select), {})

    def test_content_signatures_preserve_narrow_comment_and_metadata_deltas(self):
        path = self.repo / "tests/support/shared.py"
        path.parent.mkdir(parents=True)
        path.write_text("value = 1\n", encoding="utf-8")
        original = evidence.inputs(self.repo)
        path.write_text("# 说明\nvalue = 1\n", encoding="utf-8")
        _, kinds = runner.change_impact.delta(original["manifest"], evidence.inputs(self.repo)["manifest"])
        self.assertEqual(kinds["tests/support/shared.py"], "prose")
        self.assertEqual(runner.scopes_for_changes(kinds, kinds=kinds)[0], ("checks",))
        original = evidence.manifest(self.repo)
        (self.repo / "src/peach/__init__.py").write_text('__version__ = "0.7.31"\n', encoding="utf-8")
        paths, kinds = runner.change_impact.delta(original, evidence.manifest(self.repo))
        self.assertEqual(runner.scopes_for_changes(paths, kinds=kinds)[0], ("tooling",))

    def test_expired_file_results_cannot_complete_full_coverage(self):
        state = evidence.key(self.repo)
        with mock.patch.object(evidence.time, "time", return_value=100):
            evidence.write(self.repo, state, (), success=False, elapsed=0, slowest=[], count=1,
                           cohort=state, coverage={"test_web.py": 100})
        with mock.patch.object(evidence.time, "time", return_value=86501):
            self.assertEqual(evidence.read(self.repo, state)["coverage"], {})

    def test_pending_coverage_chooses_the_smallest_file_union(self):
        mapping = {"full": ("a", "b", "c", "d"), "catalog": ("a", "b", "d"),
                   "media": ("b", "c", "d"), "web": ("a", "b", "c")}
        select = lambda scope: tuple(Path(name) for name in mapping[scope])
        requirements = {scope: {path.name for path in select(scope)} for scope in mapping}
        self.assertEqual(test_resume.choose_scopes({'a', 'b', 'c'}, requirements,
                         ('catalog', 'media', 'web')), ('web',))

    def test_partial_baseline_preserves_unaffected_scopes_and_their_age(self):
        original = self.certify(self.repo, ("catalog", "metadata", "web"))
        stamps = evidence.read(self.repo, original)["validated"]
        changed = self.repo / "frontend/src/react/example.tsx"
        changed.parent.mkdir(parents=True)
        changed.write_text("export const value = 1;\n", encoding="utf-8")
        with redirect_stdout(io.StringIO()), mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "environment_preflight"), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("catalog", "metadata", "web"), "fixture")), \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])) as run:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
        run.assert_called_once()
        self.assertEqual(run.call_args.args[:2], (("web",), 1))
        record = evidence.read(self.repo, evidence.key(self.repo))
        self.assertTrue(evidence.covers(record, ("catalog", "metadata", "web")))
        self.assertNotIn("full", record["validated"])
        self.assertEqual(record["validated"]["catalog"], stamps["catalog"])
        self.assertEqual(record["validated"]["metadata"], stamps["metadata"])

    def test_partial_baseline_cannot_cover_shared_changes_or_full_validation(self):
        self.certify(self.repo, ("catalog", "web"))
        changed = self.repo / "scripts/test_runner.py"
        changed.parent.mkdir(parents=True)
        changed.write_text("# fixture\n", encoding="utf-8")
        with redirect_stdout(io.StringIO()), mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "environment_preflight"), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("full",), "fixture")), \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])) as run:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
        run.assert_called_once()
        self.assertEqual(run.call_args.args[:2], (("full",), 1))

    def test_same_state_only_runs_missing_scopes_and_failed_state_runs_all(self):
        self.certify(self.repo, ("catalog",))
        with redirect_stdout(io.StringIO()), mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "environment_preflight"), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("catalog", "web"), "fixture")), \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])) as run:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
            run.assert_called_once()
            self.assertEqual(run.call_args.args[:2], (("web",), 1))
            run.reset_mock()
            self.certify(self.repo, ("full",), success=False)
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
            run.assert_called_once()
            self.assertEqual(run.call_args.args[:2], (("catalog", "web"), 1))

    def test_partial_baseline_requires_live_timestamps_and_matching_environment(self):
        original = self.certify(self.repo, ("catalog",))
        path = evidence.evidence_dir(self.repo) / f"{original}.json"
        record = json.loads(path.read_text(encoding="utf-8"))
        for changes in ({"validated": {"catalog": 0}}, {"environment": "another"}):
            path.write_text(json.dumps({**record, **changes}), encoding="utf-8")
            self.assertEqual(list(evidence.baselines(self.repo, evidence.inputs(self.repo), partial=True)), [])

    def test_failed_domain_preserves_other_domains_and_requires_its_own_revalidation(self):
        self.certify(self.repo, ("catalog", "metadata", "web"))
        state = evidence.key(self.repo)
        stamps = evidence.read(self.repo, state)["validated"]
        self.certify(self.repo, ("web",), success=False)
        failed = evidence.read(self.repo, state)
        self.assertTrue(evidence.covers(failed, ("catalog", "metadata")))
        self.assertFalse(evidence.covers(failed, ("web",)))
        with redirect_stdout(io.StringIO()), mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "environment_preflight"), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("catalog", "metadata", "web"), "fixture")), \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])) as run:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
        run.assert_called_once()
        self.assertEqual(run.call_args.args[:2], (("web",), 1))
        self.assertEqual(evidence.read(self.repo, state)["validated"]["catalog"], stamps["catalog"])

    def test_success_of_another_domain_cannot_restore_a_failed_domain_from_an_older_baseline(self):
        self.certify(self.repo, ("full",))
        (self.repo / "README.md").write_text("fixture difference\n", encoding="utf-8")
        self.certify(self.repo, ("catalog", "web"))
        self.certify(self.repo, ("web",), success=False)
        self.certify(self.repo, ("checks",))
        record = evidence.read(self.repo, evidence.key(self.repo))
        self.assertEqual(record["failed_scopes"], ["web"])
        with redirect_stdout(io.StringIO()), mock.patch.object(runner, "ROOT", self.repo), \
                mock.patch.object(runner, "environment_preflight"), \
                mock.patch.object(runner, "resolve_auto_scope", return_value=(("checks", "catalog", "web"), "fixture")), \
                mock.patch.object(runner, "run_local_suite", return_value=(True, 1, [])) as run:
            self.assertEqual(runner.main(["--scope", "auto"]), 0)
        run.assert_called_once()
        self.assertEqual(run.call_args.args[:2], (("web",), 1))

    def test_focus_never_publishes_evidence_and_formal_run_rejects_focus_environment(self):
        selector = self.repo / "tests/test_focus_sample.py"
        selector.parent.mkdir(parents=True)
        selector.write_text("import unittest\nclass Sample(unittest.TestCase):\n def test_value(self): self.assertEqual(1,1)\n", encoding="utf-8")
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()), \
                mock.patch.object(runner, "ROOT", self.repo), mock.patch.object(evidence, "write") as write:
            self.assertEqual(runner.main(["--focus", "test_focus_sample"]), 0)
            write.assert_not_called()
            with mock.patch.dict(os.environ, {"PEACH_E2E_FILES": "[]"}):
                with self.assertRaises(SystemExit) as stopped:
                    runner.main(["--scope", "checks"])
            self.assertEqual(stopped.exception.code, 2)

    def test_focus_rejects_missing_files_and_path_escape(self):
        from scripts import test_focus
        for selector in ("test_missing", "frontend/e2e/../../other.test.ts", "scripts/test_runner.py"):
            with self.subTest(selector=selector), self.assertRaises(ValueError):
                test_focus.selection(self.repo, [selector])


class EvidenceExpiryTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.folder = Path(temporary.name)
        self.old, self.live = "a" * 64, "b" * 64
        self.stale = time.time() - evidence.VALID_SECONDS - 60

    def place(self, name: str, *, stale: bool) -> Path:
        path = self.folder / name
        path.write_text("{}", encoding="utf-8")
        if stale:
            os.utime(path, (self.stale, self.stale))
        return path

    def test_expired_records_notes_and_partial_writes_go_while_live_records_and_locks_stay(self):
        gone = [self.place(name, stale=True) for name in
                (f"{self.old}.json", f"{self.old}.lock.holder.json", f"{self.old}.4242.tmp")]
        kept = [self.place(f"{self.live}.json", stale=False),
                self.place(f"{self.old}.lock", stale=True),
                self.place(f"{self.old}.lock.holder.lock", stale=True),
                self.place("full-suite.lock", stale=True),
                self.place("release-notes.json", stale=True)]
        task_folder = self.folder / f"{'c' * 64}.json"
        task_folder.mkdir()
        os.utime(task_folder, (self.stale, self.stale))

        self.assertEqual(evidence.prune_expired(self.folder), 3)

        self.assertEqual([path for path in gone if path.exists()], [])
        self.assertEqual([path for path in kept if not path.exists()], [])
        self.assertTrue(task_folder.is_dir())

    def test_signing_a_record_prunes_expired_ones_and_keeps_a_fresh_failure(self):
        expired = self.place(f"{self.old}.json", stale=True)
        manifest = {'files': {}, 'signatures': {}}
        context = {'manifest': manifest, 'environment': 'fixture'}
        state = evidence.digest([evidence.digest(manifest), context['environment']])
        with mock.patch.object(evidence, "evidence_dir", return_value=self.folder):
            evidence.write(self.folder, state, ("checks",), success=False, elapsed=0,
                           slowest=[], count=0, previous={}, context=context)
            record = evidence.read(self.folder, state)

        self.assertFalse(expired.exists())
        self.assertEqual(record["failed_scopes"], ["checks"])


class RunTemporaryFolderTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name).resolve()
        # 运行本文件的测试进程自己就在一个运行目录里；这里要验证的是新开一个。
        self.enterContext(mock.patch.dict(os.environ))
        os.environ.pop(runner.RUN_TEMP, None)

    def test_temporary_files_of_the_run_and_its_children_are_removed_with_it(self):
        previous = tempfile.tempdir
        with runner.isolated_temp(self.base) as folder:
            leaked = Path(tempfile.mkdtemp(prefix="peach-seed-"))
            (leaked / "ledger.db").write_bytes(b"x")
            (leaked / "ledger.db").chmod(stat.S_IREAD)
            child = subprocess.run([sys.executable, "-c", "import tempfile; print(tempfile.gettempdir())"],
                                   capture_output=True, text=True, encoding="utf-8", check=True)
            self.assertEqual(leaked.parent, folder)
            self.assertEqual(Path(child.stdout.strip()).resolve(), folder.resolve())

        self.assertEqual(list(self.base.iterdir()), [])
        self.assertEqual(tempfile.tempdir, previous)
        self.assertNotIn(runner.RUN_TEMP, os.environ)

    def test_shard_children_share_the_parent_folder(self):
        with runner.isolated_temp(self.base) as folder, runner.isolated_temp(self.base) as nested:
            self.assertEqual(nested, folder)
            self.assertEqual(len(list(self.base.iterdir())), 1)
        self.assertEqual(list(self.base.iterdir()), [])

    def test_folders_left_by_killed_runs_are_swept_after_a_day(self):
        now = time.time()
        stale = self.base / f"{runner.RUN_TEMP_PREFIX}{int(now) - 2 * 86400}-abc"
        recent = self.base / f"{runner.RUN_TEMP_PREFIX}{int(now) - 3600}-def"
        unrelated = self.base / "peach-seed-old"
        for folder in (stale / "repo", recent, unrelated):
            folder.mkdir(parents=True)
        (stale / "repo" / "object").write_bytes(b"x")
        (stale / "repo" / "object").chmod(stat.S_IREAD)

        runner.sweep_stale_runs(self.base, now)

        self.assertFalse(stale.exists())
        self.assertTrue(recent.is_dir())
        self.assertTrue(unrelated.is_dir())


if __name__ == "__main__":
    unittest.main()
