"""amane 桥脚本本身：一次子进程、一行 JSON、退出码分档。不装 amane，塞假的 Runtime 进去。"""
from __future__ import annotations

import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "amane-bridge" / "bridge.py"


def load_bridge():
    spec = importlib.util.spec_from_file_location("amane_bridge_under_test", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    # dataclass 解析 `from __future__ import annotations` 下的字段类型要在 sys.modules 里找到它。
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


bridge = load_bridge()


class FakeSourceError(Exception):
    def __init__(self, reason, *, http_status=None, detail="", url=""):
        super().__init__(detail)
        self.reason, self.http_status, self.detail, self.url = reason, http_status, detail, url


class FakeMetadata:
    def __init__(self, **fields):
        self.fields = fields

    def model_dump(self, mode="json"):
        return dict(self.fields)


def make_runtime(outcomes):
    """`outcomes[站名]` 是要返回的资料、None（没有）或要抛的异常。"""
    class Crawler:
        site = ""

        def __init__(self, *, client, config):
            self.client, self.config = client, config

        async def fetch(self, query, options):
            outcome = outcomes[self.site]
            if isinstance(outcome, BaseException):
                raise outcome
            return outcome

    def crawler(site):
        return type(f"{site}Crawler", (Crawler,), {"site": site})

    return bridge.Runtime(
        crawler=crawler, make_client=lambda proxy, timeout, rate: {"proxy": proxy},
        query=lambda number: {"number": number}, options=lambda language: {"language": language},
        source_error=FakeSourceError, version="0.16.1")


def run_main(argv, runtime):
    out = io.StringIO()
    code = bridge.main(argv, runtime=runtime, out=out)
    lines = [line for line in out.getvalue().splitlines() if line.strip()]
    return code, lines


class BridgeContractTests(unittest.TestCase):
    def test_cli_outputs_utf8_even_when_redirected_streams_start_as_gbk(self):
        wrapper = (
            "import runpy, sys; "
            "sys.stdout.reconfigure(encoding='gbk'); "
            "sys.stderr.reconfigure(encoding='gbk'); "
            "sys.argv = sys.argv[1:]; "
            "runpy.run_path(sys.argv[0], run_name='__main__')"
        )
        for arguments in ([], ['--未知参数']):
            with self.subTest(arguments=arguments):
                result = subprocess.run([sys.executable, '-I', '-c', wrapper, str(SCRIPT), *arguments],
                                        capture_output=True, check=False, timeout=30)
                self.assertEqual(result.returncode, bridge.EXIT_USAGE)
                if not arguments:
                    self.assertEqual(json.loads(result.stdout.decode('utf-8')),
                                     {'error': '番号与站名都不能为空'})
                else:
                    self.assertIn('--未知参数', result.stderr.decode('utf-8'))

    def test_self_check_loads_every_site_without_creating_a_client(self):
        runtime = make_runtime({})
        factory = mock.Mock(side_effect=AssertionError("离线自检不能创建 HTTP 客户端"))
        crawler = mock.Mock(side_effect=runtime.crawler)
        runtime = bridge.Runtime(crawler=crawler, make_client=factory, query=runtime.query,
                                 options=runtime.options, source_error=runtime.source_error,
                                 version="0.20.0")
        code, lines = run_main(["--self-check"], runtime)
        self.assertEqual(code, 0)
        self.assertEqual(len(lines), 1)
        self.assertEqual(json.loads(lines[0]), {
            "ok": True, "amane": {"version": "0.20.0"}, "sites": list(bridge.SITES)})
        self.assertEqual(crawler.call_args_list, [mock.call(site) for site in bridge.SITES])
        factory.assert_not_called()

    def test_self_check_reports_missing_site_dependencies(self):
        runtime = make_runtime({})
        runtime = bridge.Runtime(crawler=mock.Mock(side_effect=ImportError("missing parser")),
                                 make_client=runtime.make_client, query=runtime.query,
                                 options=runtime.options, source_error=runtime.source_error)
        code, lines = run_main(["--self-check"], runtime)
        self.assertEqual(code, bridge.EXIT_FAILED)
        self.assertFalse(json.loads(lines[0])["ok"])
        self.assertIn("ImportError: missing parser", json.loads(lines[0])["error"])

    def test_mixed_site_networks_use_the_requested_client(self):
        seen = {}
        class Crawler:
            def __init__(self, *, client, config):
                self.client = client
            async def fetch(self, query, options):
                seen[self.site] = self.client['proxy']
                return None
        runtime = bridge.Runtime(
            crawler=lambda site: type(site, (Crawler,), {"site": site}),
            make_client=lambda proxy, timeout, rate: {"proxy": proxy},
            query=lambda number: number, options=lambda language: None,
            source_error=FakeSourceError)
        code, _ = run_main(["--number", "ABW-032", "--sites", "airav,freejavbt",
                            "--proxy", "http://127.0.0.1:7890", "--direct-sites", "airav"], runtime)
        self.assertEqual(code, bridge.EXIT_NOT_FOUND)
        self.assertEqual(seen, {"airav": None, "freejavbt": "http://127.0.0.1:7890"})

    def test_failure_reasons_have_unique_values(self):
        self.assertEqual(len(bridge.FAILURE_REASONS), 18)
        self.assertEqual(len(set(bridge.FAILURE_REASONS)), 18)

    def test_a_login_requirement_keeps_its_failure_reason(self):
        runtime = make_runtime({"airav": FakeSourceError("login_required", detail="login page")})
        code, lines = run_main(["--number", "ABW-032", "--sites", "airav"], runtime)
        self.assertEqual(code, bridge.EXIT_FAILED)
        record = json.loads(lines[0])["sites"]["airav"]
        self.assertEqual(record["status"], "failed")
        self.assertEqual(record["reason"], "login_required")
        self.assertEqual(record["detail"], "login page")

    def test_a_hit_prints_one_json_line_and_exits_zero(self):
        runtime = make_runtime({
            "fc2club": FakeMetadata(number="FC2-PPV-1", title="標題", actors=[{"name": "A", "gender": "female"}]),
            "avsox": None,
        })
        code, lines = run_main(["--number", "FC2-PPV-1", "--sites", "fc2club,avsox"], runtime)
        self.assertEqual(code, bridge.EXIT_FOUND)
        self.assertEqual(len(lines), 1)
        report = json.loads(lines[0])
        self.assertEqual(report["number"], "FC2-PPV-1")
        self.assertEqual(report["amane"], {"version": "0.16.1"})
        self.assertEqual(report["sites"]["fc2club"]["status"], "found")
        self.assertEqual(report["sites"]["fc2club"]["metadata"]["title"], "標題")
        self.assertEqual(report["sites"]["avsox"], {"status": "not_found", "reason": "not_found",
                                                   "elapsed_s": report["sites"]["avsox"]["elapsed_s"]})

    def test_all_misses_exit_two_and_any_error_without_a_hit_exits_three(self):
        runtime = make_runtime({"avsox": None, "airav": None})
        code, _ = run_main(["--number", "ABW-1", "--sites", "avsox,airav"], runtime)
        self.assertEqual(code, bridge.EXIT_NOT_FOUND)
        runtime = make_runtime({
            "avsox": None,
            "airav": FakeSourceError("cloudflare_blocked", http_status=403, detail="blocked", url="https://x/y"),
        })
        code, lines = run_main(["--number", "ABW-1", "--sites", "avsox,airav"], runtime)
        self.assertEqual(code, bridge.EXIT_FAILED)
        record = json.loads(lines[0])["sites"]["airav"]
        self.assertEqual(record["status"], "failed")
        self.assertEqual(record["reason"], "cloudflare_blocked")
        self.assertEqual(record["http_status"], 403)
        self.assertEqual(record["url"], "https://x/y")

    def test_an_unknown_reason_is_kept_in_detail_under_unexpected(self):
        record = bridge.failure_record(FakeSourceError("brand_new_reason", detail="x" * 600))
        self.assertEqual(record["reason"], "unexpected")
        self.assertTrue(record["detail"].startswith("brand_new_reason: xxx"))
        self.assertLessEqual(len(record["detail"]), 500)

    def test_a_crash_inside_one_site_does_not_take_the_batch_down(self):
        runtime = make_runtime({"avsox": RuntimeError("boom"), "freejavbt": FakeMetadata(number="ABW-1", title="t")})
        code, lines = run_main(["--number", "ABW-1", "--sites", "avsox,freejavbt"], runtime)
        self.assertEqual(code, bridge.EXIT_FOUND)
        report = json.loads(lines[0])
        self.assertEqual(report["sites"]["avsox"]["reason"], "unexpected")
        self.assertIn("RuntimeError: boom", report["sites"]["avsox"]["detail"])

    def test_usage_errors_exit_four_with_a_json_error(self):
        runtime = make_runtime({})
        code, lines = run_main(["--number", "ABW-1", "--sites", "nosuchsite"], runtime)
        self.assertEqual(code, bridge.EXIT_USAGE)
        self.assertEqual(json.loads(lines[0]), {"error": "未知站名：nosuchsite"})
        code, lines = run_main(["--number", "  ", "--sites", "avsox"], runtime)
        self.assertEqual(code, bridge.EXIT_USAGE)
        self.assertIn("error", json.loads(lines[0]))
        code, _ = run_main(["--sites", "avsox"], runtime)
        self.assertEqual(code, bridge.EXIT_USAGE)

    def test_the_proxy_reaches_the_client_factory(self):
        seen = {}

        def make_client(proxy, timeout, rate):
            seen.update(proxy=proxy, timeout=timeout, rate=rate)
            return None

        runtime = make_runtime({"avsox": None})
        runtime = bridge.Runtime(crawler=runtime.crawler, make_client=make_client, query=runtime.query,
                                 options=runtime.options, source_error=runtime.source_error)
        run_main(["--number", "ABW-1", "--sites", "avsox", "--proxy", "http://127.0.0.1:7897",
                  "--timeout", "12", "--rate", "1.5"], runtime)
        self.assertEqual(seen, {"proxy": "http://127.0.0.1:7897", "timeout": 12.0, "rate": 1.5})


class OfficialSiteTests(unittest.TestCase):
    """官方档的五站（ADR-0048）走同一份 JSON 契约；`makers` 是 amane 的 `official` 模块。"""

    def test_the_official_sites_name_their_amane_crawlers(self):
        self.assertEqual(bridge.SITES["makers"], ("official", "OfficialCrawler"))
        self.assertEqual(bridge.SITES["prestige"], ("prestige", "PrestigeCrawler"))
        self.assertEqual(bridge.SITES["faleno"], ("faleno", "FalenoCrawler"))
        self.assertEqual(bridge.SITES["dahlia"], ("dahlia", "DahliaCrawler"))
        self.assertEqual(bridge.SITES["mgstage"], ("mgstage", "MGStageCrawler"))
        self.assertNotIn("official", bridge.SITES)

    def test_each_official_site_reports_hit_miss_and_refusal_on_its_own(self):
        runtime = make_runtime({
            "makers": FakeMetadata(number="SSIS-057", title="標題", studio="S1 NO.1 STYLE", release="2021-05-07"),
            "prestige": FakeSourceError("http_error", http_status=403, detail="Forbidden",
                                        url="https://www.prestige-av.com/api/product/search"),
            "faleno": None,
            "dahlia": FakeSourceError("geo_restricted", http_status=403, detail="not available in your region"),
            "mgstage": FakeSourceError("age_verification", detail="adc cookie"),
        })
        code, lines = run_main(["--number", "SSIS-057", "--sites", "makers,prestige,faleno,dahlia,mgstage"],
                               runtime)
        self.assertEqual(code, bridge.EXIT_FOUND)
        sites = json.loads(lines[0])["sites"]
        self.assertEqual(sites["makers"]["metadata"]["studio"], "S1 NO.1 STYLE")
        self.assertEqual((sites["prestige"]["reason"], sites["prestige"]["http_status"]), ("http_error", 403))
        self.assertEqual(sites["faleno"]["status"], "not_found")
        self.assertEqual(sites["dahlia"]["reason"], "geo_restricted")
        self.assertEqual(sites["mgstage"]["reason"], "age_verification")

    def test_a_refused_maker_site_alone_is_a_failure_not_a_miss(self):
        """被挡与没有分开报：只问 Prestige 且被 403 挡住时退出码是 3，不是 2。"""
        runtime = make_runtime({"prestige": FakeSourceError("http_error", http_status=403)})
        code, _ = run_main(["--number", "ABW-032", "--sites", "prestige"], runtime)
        self.assertEqual(code, bridge.EXIT_FAILED)


class RuntimePackagingTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location(
            "amane_runtime_builder_under_test", ROOT / "scripts/build_amane_runtime.py")
        self.builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.builder)
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name).resolve()

    def manifest(self, kind):
        facts = {**self.builder.locked_amane(), "kind": kind,
                 "executable": "runtime.exe" if kind == "executable" else ".venv/bin/python"}
        (self.root / "manifest.json").write_text(json.dumps(facts), encoding="utf-8")
        return facts

    def test_locked_runtime_uses_the_existing_revision_and_build_toolchain(self):
        facts = self.builder.locked_amane()
        self.assertEqual(facts, {"revision": "391af4fdc9fec4c7eb279ce8de53fbf693f09d5a",
                                 "version": "0.28.0"})
        requirements = self.builder.build_requirements()
        self.assertIn("pyinstaller==6.22.3", requirements)
        self.assertTrue(all("==" in item for item in requirements))
        self.assertNotIn("packaging", [item.split("==")[0] for item in requirements])

    def test_runtime_self_check_dispatches_both_packaging_kinds(self):
        for kind in ("python", "executable"):
            facts = self.manifest(kind)
            report = {"ok": True, "amane": {"version": facts["version"]}, "sites": list(bridge.SITES)}
            with mock.patch.object(self.builder.subprocess, "run", return_value=mock.Mock(
                    stdout=json.dumps(report))) as run:
                self.assertEqual(self.builder.verify(self.root), report)
            command = run.call_args.args[0]
            self.assertEqual(command[0], str(self.root / facts["executable"]))
            self.assertEqual(command[-1], "--self-check")
            self.assertEqual("-X" in command, kind == "python")
            self.assertNotIn("PYTHONPATH", run.call_args.kwargs["env"])
            self.assertEqual(run.call_args.kwargs["env"]["PATH"], "")
            self.assertEqual(run.call_args.kwargs["env"]["PYINSTALLER_RESET_ENVIRONMENT"], "1")

    def test_desktop_smoke_requires_the_service_to_use_the_bundled_runtime(self):
        from scripts import smoke_desktop
        manifest = self.manifest('executable')
        facts = {'installed': True, 'problem': '', 'revision': manifest['revision'],
                 'installed_version': manifest['version'], 'python': str(self.root / manifest['executable'])}
        opener = mock.Mock()
        with mock.patch.dict(sys.modules, {'build_amane_runtime': self.builder}), \
                mock.patch.object(self.builder, 'verify') as verify:
            opener.open.return_value = io.StringIO(json.dumps(facts))
            smoke_desktop.assert_amane_runtime(opener, 'http://127.0.0.1:8900', self.root)
            verify.assert_called_once_with(self.root)
            opener.open.assert_called_once_with('http://127.0.0.1:8900/api/scraping/amane-bridge', timeout=15)
            for change in ({'installed': False}, {'revision': 'foreign'}, {'installed_version': 'unknown'},
                           {'python': str(self.root / 'user-python')}, {'problem': '缺少运行环境'}):
                with self.subTest(change=change):
                    opener.open.return_value = io.StringIO(json.dumps({**facts, **change}))
                    with self.assertRaises(AssertionError):
                        smoke_desktop.assert_amane_runtime(opener, 'http://127.0.0.1:8900', self.root)

    def test_runtime_self_check_rejects_wrong_versions_and_process_failures(self):
        self.manifest("executable")
        with mock.patch.object(self.builder.subprocess, "run", return_value=mock.Mock(
                stdout=json.dumps({"ok": True, "amane": {"version": "unknown"}}))):
            with self.assertRaises(ValueError):
                self.builder.verify(self.root)
        with mock.patch.object(self.builder.subprocess, "run", side_effect=
                subprocess.CalledProcessError(3, ["runtime.exe"])):
            with self.assertRaises(subprocess.CalledProcessError):
                self.builder.verify(self.root)

    def test_runtime_self_check_rejects_foreign_revision_and_path_escape(self):
        for change in ({"revision": "0" * 40}, {"executable": "../outside.exe"}, {"kind": "shell"}):
            facts = {**self.manifest("executable"), **change}
            (self.root / "manifest.json").write_text(json.dumps(facts), encoding="utf-8")
            with mock.patch.object(self.builder.subprocess, "run") as run:
                with self.assertRaises(ValueError):
                    self.builder.verify(self.root)
            run.assert_not_called()

    def test_build_rejects_work_inside_the_distribution(self):
        with mock.patch.object(self.builder.subprocess, "run") as run:
            with self.assertRaises(ValueError):
                self.builder.build(self.root, work=self.root / "work")
        run.assert_not_called()

    def test_build_preserves_an_unowned_nonempty_destination(self):
        private_file = self.root / "keep.txt"
        private_file.write_text("keep", encoding="utf-8")
        with mock.patch.object(self.builder.subprocess, "run") as run:
            with self.assertRaises(ValueError):
                self.builder.build(self.root, work=self.root.parent / "work")
        run.assert_not_called()
        self.assertEqual(private_file.read_text(encoding="utf-8"), "keep")

    def test_docker_smoke_checks_the_bundled_runtime_and_matching_api_facts(self):
        from scripts import smoke_docker
        manifest = {**self.builder.locked_amane(), "kind": "python", "executable": ".venv/bin/python"}
        report = {"ok": True, "amane": {"version": manifest["version"]}, "sites": list(bridge.SITES)}
        description = {"python": "/app/amane-runtime/.venv/bin/python", "installed": True,
                       "revision": manifest["revision"]}
        with mock.patch.object(smoke_docker, "docker", side_effect=[json.dumps(manifest), json.dumps(report)]) as docker, \
                mock.patch.object(smoke_docker, "request", return_value=json.dumps(description)):
            smoke_docker.amane_checks("fixture")
        self.assertEqual(docker.call_args_list[1], mock.call(
            "exec", "--user", "1000:1000", "fixture",
            "/app/amane-runtime/.venv/bin/python", "-X", "utf8",
            "/app/tools/amane-bridge/bridge.py", "--self-check"))

    def test_windows_application_and_lite_payloads_keep_the_complete_bridge(self):
        from peach.update_packages import TOOL_PATHS
        from scripts.package_windows_release import package, build_lite_installer
        payload = self.root / "Peach"
        (payload / "_internal").mkdir(parents=True)
        (payload / "Peach.exe").write_bytes(b"application")
        (payload / "_internal/standalone.txt").touch()
        runtime_files = {"amane-bridge.exe", "manifest.json", "LICENSE-amane.txt",
                         "amane-corresponding-source.zip", "_internal/python314.dll"}
        runtime = payload / "_internal/tools/amane-runtime"
        for name in runtime_files:
            target = runtime / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(name.encode())
        for prefix, required in TOOL_PATHS.values():
            for name in required:
                target = payload / prefix / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(b"tool")
        release = self.root / "release"
        package(payload, release, "1.0.0")
        expected = {"Peach/_internal/tools/amane-runtime/" + name for name in runtime_files}
        for suffix in (".zip", "-update.zip"):
            with zipfile.ZipFile(release / f"Peach-1.0.0-windows-x64{suffix}") as archive:
                self.assertTrue(expected <= set(archive.namelist()))
        for tool in TOOL_PATHS:
            with zipfile.ZipFile(release / f"Peach-1.0.0-windows-x64-tools-{tool}.zip") as archive:
                self.assertFalse(expected & set(archive.namelist()))

        def compile_installer(command, **kwargs):
            source = Path(next(arg.removeprefix("/DSourceDir=") for arg in command
                               if arg.startswith("/DSourceDir=")))
            for name in runtime_files:
                self.assertEqual((source / "_internal/tools/amane-runtime" / name).read_bytes(), name.encode())
            self.assertIn("/DLiteInstaller=1", command)
            (release / "Peach-1.0.0-windows-x64-lite-setup.exe").write_bytes(b"installer")

        with mock.patch("scripts.package_windows_release.subprocess.run", side_effect=compile_installer):
            self.assertTrue(build_lite_installer(release, "1.0.0", self.root / "ISCC.exe").is_file())


if __name__ == "__main__":
    unittest.main()
