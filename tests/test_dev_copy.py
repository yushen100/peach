"""改字工具保存源文案与动态模板，冲突与代码路径不能误写。"""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import threading
import time
import os
from peach import dev_copy
from support.processes import finishes_within, grandchild_alive, hanging_program, kill_grandchild


class DevCopyTests(unittest.TestCase):
    def test_python_copy_sources_can_be_saved_with_digest_protection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root / 'src/peach').mkdir(parents=True)
            for name in ('routes_pages.py', 'onboarding.py', 'media_sources.py', 'release_updates.py'):
                with self.subTest(name=name):
                    path = root / 'src/peach' / name
                    path.write_text("LABEL = '设置说明'", encoding='utf-8')
                    candidate = next(row for row in dev_copy.candidates(root, '设置说明') if row['file'].endswith(name))
                    dev_copy.save(root, {'original': '设置说明', 'replacement': '媒体设置说明', 'candidate': candidate})
                    self.assertEqual(path.read_text(encoding='utf-8'), "LABEL = '媒体设置说明'")
                    with self.assertRaises(ValueError):
                        dev_copy.save(root, {'original': '设置说明', 'replacement': '无效修改', 'candidate': candidate})

    def test_extracted_copy_is_saved_into_the_source_language_file_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            for language, text in (('zh-CN', '首页'), ('en', 'Home')):
                (root / 'resources/locales' / language).mkdir(parents=True)
                (root / 'resources/locales' / language / 'navigation.json').write_text(
                    '{\n  "sidebar": { "home": "%s" }\n}\n' % text, encoding='utf-8')
            candidate, = dev_copy.candidates(root, '首页')
            self.assertEqual(candidate['file'], 'resources/locales/zh-CN/navigation.json')
            self.assertEqual(dev_copy.candidates(root, 'Home'), [])
            dev_copy.save(root, {'original': '首页', 'replacement': '主页 "精选"', 'candidate': candidate})
            saved = json.loads((root / candidate['file']).read_text(encoding='utf-8'))
            self.assertEqual(saved, {'sidebar': {'home': '主页 "精选"'}})

    def test_interpolated_locale_copy_is_found_by_its_rendered_text_and_keeps_placeholders(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root / 'resources/locales/zh-CN').mkdir(parents=True)
            path = root / 'resources/locales/zh-CN/cleanup.json'
            path.write_text('{\n  "trash": { "count": "{{count}} 项在回收站" }\n}\n', encoding='utf-8')
            candidate, = dev_copy.candidates(root, '12 项在回收站')
            self.assertEqual(candidate['template'], '{count} 项在回收站')
            self.assertEqual(candidate['values'], {'count': '12'})
            with self.assertRaises(ValueError):
                dev_copy.save(root, {'original': '12 项在回收站', 'replacement': '回收站里有若干项', 'candidate': candidate})
            result = dev_copy.save(root, {'original': '12 项在回收站', 'replacement': '回收站里有 {count} 项', 'candidate': candidate})
            self.assertEqual(result['text'], '回收站里有 12 项')
            self.assertEqual(json.loads(path.read_text(encoding='utf-8')), {'trash': {'count': '回收站里有 {{count}} 项'}})

    def test_number_formatted_locale_copy_preserves_the_formatter_when_saved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            path = root / 'resources/locales/zh-CN/cleanup.json'
            path.parent.mkdir(parents=True)
            path.write_text('{"selectAll": "全选（{{count, number}} 个）"}', encoding='utf-8')
            candidate, = dev_copy.candidates(root, '全选（1,234 个）')
            self.assertEqual(candidate['template'], '全选（{count} 个）')
            result = dev_copy.save(root, {'original': '全选（1,234 个）',
                'replacement': '选择全部 {count} 个', 'candidate': candidate})
            self.assertEqual(result['text'], '选择全部 1,234 个')
            self.assertEqual(json.loads(path.read_text(encoding='utf-8')),
                             {'selectAll': '选择全部 {{count, number}} 个'})

    def test_status_recovers_from_a_short_read_lock_and_preserves_persistent_denial(self):
        from peach import dev_copy_runtime as runtime
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            with patch.object(Path, 'read_text', side_effect=[PermissionError('sharing'), '{"state":"ready"}']), \
                    patch.object(runtime.time, 'sleep') as sleep:
                self.assertEqual(runtime.status(root)['state'], 'ready')
                sleep.assert_called_once()
            with patch.object(Path, 'read_text', side_effect=PermissionError('denied')) as read, \
                    patch.object(runtime.time, 'sleep') as sleep, self.assertRaises(PermissionError):
                runtime.status(root)
            self.assertEqual(read.call_count, 5)
            self.assertEqual(sleep.call_count, 4)

    def test_static_text_can_be_deleted_and_dynamic_placeholders_are_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root / 'frontend/src').mkdir(parents=True)
            path = root / 'frontend/src/copy.tsx'
            path.write_text("const a = '说明'; const b = <p>正文</p>;", encoding='utf-8')
            for original in ('说明', '正文'):
                candidate, = dev_copy.candidates(root, original)
                result = dev_copy.save(root, {'original': original, 'replacement': '', 'candidate': candidate})
                self.assertEqual(result['text'], '')
            self.assertEqual(path.read_text(encoding='utf-8'), "const a = ''; const b = <p></p>;")
            (root / 'src/peach').mkdir(parents=True)
            dynamic = root / 'src/peach/library_processing.py'
            dynamic.write_text('message = f"待处理 {count} 项"', encoding='utf-8')
            candidate, = dev_copy.candidates(root, '待处理 5 项')
            with self.assertRaises(ValueError):
                dev_copy.save(root, {'original': '待处理 5 项', 'replacement': '', 'candidate': candidate})
            self.assertEqual(dynamic.read_text(encoding='utf-8'), 'message = f"待处理 {count} 项"')

    def test_build_failure_preserves_served_files_and_can_be_retried(self):
        from peach import dev_copy_runtime as runtime
        from subprocess import CompletedProcess
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root / 'frontend/src').mkdir(parents=True)
            path = root / 'frontend/src/copy.ts'
            path.write_text("const title = '说明';", encoding='utf-8')
            (root / 'web/dist').mkdir(parents=True)
            served = root / 'web/dist/peach-app.js'
            served.write_text('有效产物', encoding='utf-8')
            candidate, = dev_copy.candidates(root, '说明')
            with patch('peach.dev_copy_runtime.process_job.run', return_value=CompletedProcess([], 1, '', '语法错误')):
                result = runtime.submit(root, {'original': '说明', 'replacement': '新说明', 'candidate': candidate})
                self._wait_for_state(runtime, root, 'error')
            self.assertEqual(served.read_text(encoding='utf-8'), '有效产物')
            self.assertEqual(path.read_text(encoding='utf-8'), "const title = '新说明';")
            self.assertIn('语法错误', runtime.status(root)['message'])
            with patch('peach.dev_copy_runtime.build_frontend'):
                retry = runtime.submit(root, {'id': result['apply']['id']}, retry=True)
                self._wait_for_state(runtime, root, 'ready')
            self.assertNotEqual(result['apply']['id'], retry['apply']['id'])

    def test_tray_reload_obeys_task_gate_and_releases_ownership_lock(self):
        from peach import dev_copy_runtime as runtime
        from peach.runtime_prepare import TaskGate, ActiveRun, Step
        from unittest.mock import Mock
        for blocked in (True, False):
            with self.subTest(blocked=blocked), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve()
                (root / 'src/peach').mkdir(parents=True)
                path = root / 'src/peach/library_processing.py'
                path.write_text("TITLE = '说明'", encoding='utf-8')
                candidate, = dev_copy.candidates(root, '说明')
                runtime.submit(root, {'original': '说明', 'replacement': '新说明', 'candidate': candidate})
                with self.assertRaises(ValueError):
                    runtime.submit(root, {})
                tray = SimpleNamespace(_action_lock=threading.Lock(), manager=Mock(),
                                       _readiness=lambda: Step('readiness', 'current', '服务已就绪'))
                gate = TaskGate(blocking=(ActiveRun(1, 'test', 'manual', 'running', os.getpid(), None),)) if blocked else TaskGate()
                locked_at_terminal = []
                def recording_write(target, data, write=runtime._write, lock=tray._action_lock, seen=locked_at_terminal):
                    if data.get('state') in ('ready', 'error'):
                        seen.append(lock.locked())
                    return write(target, data)
                with patch('peach.runtime_prepare.task_gate', return_value=gate), \
                        patch.object(runtime, '_write', side_effect=recording_write):
                    runtime.poll(tray, root)
                    self._wait_for_state(runtime, root, 'error' if blocked else 'ready')
                self.assertEqual(tray.manager.restart.call_count, 0 if blocked else 1)
                if not blocked:
                    tray.manager.restart.assert_called_once_with(reason='source copy edit built, reloading services')
                # 终态写盘时托盘动作锁已经释放，看到终态的调用方不会抢在释放之前。
                self.assertEqual(locked_at_terminal, [False])
                self.assertFalse(tray._action_lock.locked())

    @staticmethod
    def _wait_for_state(runtime, root, state):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if runtime.status(root).get('state') == state:
                return
            time.sleep(.01)
        raise AssertionError(runtime.status(root))

    def test_saved_frontend_copy_is_built_and_published(self):
        from peach import dev_copy_runtime
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root / 'web/dist').mkdir(parents=True)
            (root / 'web/dist/peach-app.js').write_text('现有产物', encoding='utf-8')
            def build(argv, **kwargs):
                from subprocess import CompletedProcess
                stage = Path(kwargs['env']['PEACH_FRONTEND_OUT_DIR'])
                for name in dev_copy_runtime.BUNDLES:
                    (stage / name).write_text('有效产物', encoding='utf-8')
                self.assertEqual((root / 'web/dist/peach-app.js').read_text(encoding='utf-8'), '现有产物')
                return CompletedProcess(argv, 0, stdout='构建完成', stderr='')
            with patch('peach.dev_copy_runtime.process_job.run', side_effect=build):
                dev_copy_runtime.build_frontend(root)
            self.assertEqual((root / 'web/dist/peach-app.js').read_text(encoding='utf-8'), '有效产物')

    def test_frontend_copy_publishes_new_chunks_and_drops_the_previous_ones(self):
        """主包按页拆出的 chunk 名字带哈希（ADR-0118）：新的一批跟入口一起发出，上一批随后删掉。"""
        from peach import dev_copy_runtime
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            dist = root / 'web/dist'
            dist.mkdir(parents=True)
            (dist / 'peach-app.stats-page-Old00000.js').write_text('旧 chunk', encoding='utf-8')
            def build(argv, **kwargs):
                from subprocess import CompletedProcess
                stage = Path(kwargs['env']['PEACH_FRONTEND_OUT_DIR'])
                for name in (*dev_copy_runtime.BUNDLES, 'peach-app.stats-page-New11111.js'):
                    (stage / name).write_text(name, encoding='utf-8')
                (stage / 'peach-app.stats-page-New11111.js.map').write_text('{}', encoding='utf-8')
                return CompletedProcess(argv, 0, stdout='构建完成', stderr='')
            with patch('peach.dev_copy_runtime.process_job.run', side_effect=build):
                dev_copy_runtime.build_frontend(root)
            self.assertEqual(sorted(path.name for path in dist.iterdir()),
                             sorted([*dev_copy_runtime.BUNDLES, 'peach-app.stats-page-New11111.js']))
            self.assertEqual((dist / 'peach-app.stats-page-New11111.js').read_text(encoding='utf-8'),
                             'peach-app.stats-page-New11111.js')

    def test_a_build_that_never_returns_is_stopped_and_keeps_the_served_files(self):
        """npm 再起 node 占着输出管道：到期收掉整棵进程树，按构建失败报，现有产物不动。"""
        from peach import dev_copy_runtime
        from peach.user_messages import UserValueError
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as programs:
            root, programs = Path(tmp).resolve(), Path(programs)
            self.addCleanup(kill_grandchild, programs)
            (root / 'web/dist').mkdir(parents=True)
            (root / 'web/dist/peach-app.js').write_text('现有产物', encoding='utf-8')
            npm = hanging_program(programs)
            with patch('peach.dev_copy_runtime.shutil.which', return_value=str(npm)), \
                    patch.object(dev_copy_runtime, 'BUILD_SECONDS', 2):
                with self.assertRaisesRegex(UserValueError, 'timed out after 2s'):
                    finishes_within(lambda: dev_copy_runtime.build_frontend(root), 30)
            self.assertEqual((root / 'web/dist/peach-app.js').read_text(encoding='utf-8'), '现有产物')
            deadline = time.monotonic() + 10
            while grandchild_alive(programs) and time.monotonic() < deadline:
                time.sleep(0.1)
            self.assertFalse(grandchild_alive(programs), '构建进程树还活着')

    def test_processing_template_keeps_live_values_and_validates_placeholders(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            package = root / "src/peach"
            package.mkdir(parents=True)
            path = package / "library_processing.py"
            source = ("# 中文说明\n"
                      "def summary(problems, paused):\n"
                      "    return (f'{problems} 项需要处理，其中 {paused} 项是来源限流；'\n"
                      "            '其余可重试。')\n")
            path.write_text(source, encoding="utf-8")
            original = "768 项需要处理，其中 533 项是来源限流；其余可重试。"
            candidate, = dev_copy.candidates(root, original)
            self.assertEqual(candidate["template"], "{problems} 项需要处理，其中 {paused} 项是来源限流；其余可重试。")
            for replacement in ["处理 {problems} 项", "处理 {unknown} 项", "处理 {problems!r}、{paused}", "{problems} {paused} {paused}"]:
                with self.assertRaises(ValueError):
                    dev_copy.save(root, {"original": original, "replacement": replacement, "candidate": candidate})
                self.assertEqual(path.read_text(encoding="utf-8"), source)
            result = dev_copy.save(root, {"original": original,
                "replacement": "来源限流 {paused} 项，共 {problems} 项待处理。", "candidate": candidate})
            self.assertEqual(result["text"], "来源限流 533 项，共 768 项待处理。")
            namespace = {}
            exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), namespace)
            self.assertEqual(namespace["summary"](10, 3), "来源限流 3 项，共 10 项待处理。")
            self.assertEqual(len(list((root / "build/copy-editor/backups").rglob(path.name))), 1)
            with self.assertRaises(ValueError):
                dev_copy.save(root, {"original": original, "replacement": "{problems} {paused}", "candidate": candidate})

    def test_template_preserves_expressions_formatting_and_literal_braces(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            package = root / "src/peach"
            package.mkdir(parents=True)
            path = package / "library_processing.py"
            path.write_text("def summary(total):\n    return f'共 {{数量}} {total + 1:04d} 项'\n", encoding="utf-8")
            candidate, = dev_copy.candidates(root, "共 {数量} 0003 项")
            self.assertEqual(candidate["template"], "共 {{数量}} {value1} 项")
            dev_copy.save(root, {"original": "共 {数量} 0003 项", "replacement": "{{总数}} '{value1}' 项", "candidate": candidate})
            namespace = {}
            exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), namespace)
            self.assertEqual(namespace["summary"](4), "{总数} '0005' 项")

    def test_library_notice_is_editable_and_other_python_files_are_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            package = root / "src/peach"
            package.mkdir(parents=True)
            notice = package / "library_sharing.py"
            notice.write_text('NOTICE = "上传说明"\n', encoding="utf-8")
            (package / "config.py").write_text('SECRET = "上传说明"\n', encoding="utf-8")
            candidate, = dev_copy.candidates(root, "上传说明")
            self.assertEqual(candidate["file"], "src/peach/library_sharing.py")
            dev_copy.save(root, {"original": "上传说明", "replacement": "新的说明", "candidate": candidate})
            self.assertEqual(notice.read_text(encoding="utf-8"), 'NOTICE = "新的说明"\n')
            self.assertEqual((package / "config.py").read_text(encoding="utf-8"), 'SECRET = "上传说明"\n')

    def test_jsx_text_keeps_braces_literal_and_invalid_values_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "frontend/src").mkdir(parents=True)
            path = root / "frontend/src/example.tsx"
            path.write_text('<p>示例</p>', encoding="utf-8")
            candidate, = dev_copy.candidates(root, "示例")
            dev_copy.save(root, {"original": "示例", "replacement": "文字{原样}", "candidate": candidate})
            self.assertEqual(path.read_text(encoding="utf-8"), '<p>文字&#123;原样&#125;</p>')
            for body in [[], {"original": None, "replacement": "文字"}]:
                with self.assertRaises(ValueError):
                    dev_copy.save(root, body)

    def test_save_preserves_code_and_records_the_original_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root / "frontend/src/application").mkdir(parents=True)
            path = root / "frontend/src/application/tutorial.js"
            path.write_text("const label='示例文字';", encoding="utf-8")
            candidate, = dev_copy.candidates(root, "示例文字")
            result = dev_copy.save(root, {"original": "示例文字", "replacement": "新的'文字", "candidate": candidate})
            self.assertTrue(result["ok"])
            self.assertTrue(result["needs_build"])
            self.assertEqual(path.read_text(encoding="utf-8"), "const label='新的\\'文字';")
            self.assertEqual(len(list((root / "build/copy-editor/backups").rglob("tutorial.js"))), 1)
            with self.assertRaises(ValueError):
                dev_copy.save(root, {"original": "示例文字", "replacement": "错误", "candidate": candidate})

    def test_ambiguous_labels_require_a_specific_unchanged_candidate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "web").mkdir()
            path = root / "web/index.html"
            path.write_text('<p>示例</p><button>示例</button>', encoding="utf-8")
            choices = dev_copy.candidates(root, "示例")
            self.assertEqual(len(choices), 2)
            dev_copy.save(root, {"original": "示例", "replacement": "按钮", "candidate": choices[1]})
            self.assertEqual(path.read_text(encoding="utf-8"), '<p>示例</p><button>按钮</button>')
            with self.assertRaises(ValueError):
                dev_copy.save(root, {"original": "示例", "replacement": "错误", "candidate": {"file": "../secret"}})
