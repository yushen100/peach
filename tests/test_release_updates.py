"""发行通道、故障状态和独立托盘检查的隔离回归。"""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import httpx

from peach import distribution, docker_update, interface_text, release_updates
from peach.http import HttpResponse
from peach.versioning import VersionManager


def release(version, **extra):
    return dict(tag_name=f"v{version}", prerelease=True, draft=False,
                assets=[{"name": f"Peach-{version}-windows-x64.zip", "state": "uploaded"}], **extra)


class ReleaseUpdateTests(unittest.TestCase):
    def setUp(self):
        # 选包跟着本机系统走；这一组用例按 Windows 包写，在 macOS runner 上同样要选 Windows 包。
        windows = patch.object(release_updates, "sys", SimpleNamespace(platform="win32"))
        windows.start()
        self.addCleanup(windows.stop)

    def test_r2_release_is_available_when_github_is_unavailable_and_uses_verified_digest(self):
        row = release("1.0.0")
        row["assets"][0].update(size=123, digest="sha256:" + "a" * 64,
                                browser_download_url="https://untrusted.invalid/package.zip")

        def transport(request, *_args):
            if request.url == release_updates.API_URL:
                raise httpx.ConnectError("GitHub unavailable")
            return HttpResponse(200, {}, json.dumps([row]).encode())

        with patch.object(release_updates, "__version__", "0.9.0"):
            result = release_updates.check(transport=transport)
        self.assertEqual(result["state"], "available")
        self.assertEqual(result["asset_url"], "https://downloads.peach.video/v1.0.0/Peach-1.0.0-windows-x64.zip")
        self.assertEqual(result["asset_digest"], "sha256:" + "a" * 64)
        self.assertEqual(result["release_url"], release_updates.RELEASES_URL + "/tag/v1.0.0")

    def test_latest_version_can_come_from_either_source_and_r2_requires_a_digest(self):
        r2 = release("1.0.0")
        github = release("2.0.0")

        def transport(request, *_args):
            row = r2 if request.url == release_updates.DOWNLOADS_API else github
            return HttpResponse(200, {}, json.dumps([row]).encode())

        self.assertEqual(release_updates.check(transport=transport)["latest_version"], "2.0.0")
        r2["assets"][0]["digest"] = "sha256:" + "a" * 64
        r2["tag_name"] = "v3.0.0"
        r2["assets"][0]["name"] = "Peach-3.0.0-windows-x64.zip"
        self.assertEqual(release_updates.check(transport=transport)["latest_version"], "3.0.0")

    def test_mirror_without_newer_release_cannot_confirm_current_or_ahead(self):
        for github_status, github_body in ((403, []), (200, {}), (200, []),
                                            (200, [dict(release("0.56.0"), assets=[])])):
            for mirror_version in ("0.50.0", "0.54.0"):
                with self.subTest(github_status=github_status, github_body=github_body,
                                  mirror_version=mirror_version):
                    row = release(mirror_version)
                    row["assets"][0]["digest"] = "sha256:" + "a" * 64

                    def transport(request, *_args, github_status=github_status,
                                  github_body=github_body, row=row):
                        if request.url == release_updates.API_URL:
                            return HttpResponse(github_status, {}, json.dumps(github_body).encode())
                        return HttpResponse(200, {}, json.dumps([row]).encode())

                    with patch.object(release_updates, "__version__", "0.54.0"):
                        result = release_updates.check(transport=transport)
                    self.assertEqual(result["state"], "error")
                    self.assertIsNone(result["latest_version"])
                    self.assertNotIn("asset_url", result)

    def test_current_macos_mirror_without_github_cannot_confirm_no_update(self):
        row = release("0.54.0")
        row["assets"].append({"name": "Peach-0.54.0-macos-arm64.dmg", "state": "uploaded",
                              "digest": "sha256:" + "a" * 64})

        def transport(request, *_args):
            return HttpResponse(403 if request.url == release_updates.API_URL else 200,
                                {}, json.dumps([row]).encode())

        with patch.object(release_updates, "__version__", "0.54.0"):
            result = release_updates.check(transport=transport, system="darwin", machine="arm64")
        self.assertEqual(result["state"], "error")
        self.assertIsNone(result["latest_version"])

    def check(self, rows, status=200):
        transport = Mock(return_value=HttpResponse(status, {}, json.dumps(rows).encode()))
        with patch.object(release_updates, "__version__", "0.9.0"):
            return release_updates.check(transport=transport)

    def test_channel_includes_prereleases_and_orders_versions_numerically(self):
        result = self.check([release("0.9.0"), release("0.10.0")])
        self.assertEqual((result["state"], result["latest_version"]), ("available", "0.10.0"))
        self.assertEqual(result["release_url"], release_updates.RELEASES_URL + "/tag/v0.10.0")

    def test_unpublished_or_incomplete_packages_are_not_offered(self):
        draft = release("8.0.0"); draft["draft"] = True
        incomplete = release("9.0.0"); incomplete["assets"] = []
        result = self.check([draft, incomplete, {"tag_name": "invalid"}, release("0.9.0")])
        self.assertEqual(result["state"], "current")
        self.assertEqual(self.check([release("0.8.0")])["state"], "ahead")
        self.assertEqual(self.check([])["state"], "empty")

    BODY = ("> Lead. / ignored\n\n### Highlights\n\n- **Subtitles**: Follow the [interface](https://x/y) language (#9).\n\n"
            "### Added\n\n- **Playback**: A full changelog entry (#9).\n\n<details>\n<summary>Downloads</summary>\n\n"
            "### Highlights\n\n- not a change\n\n</details>\n\n"
            "<details>\n<summary>简体中文</summary>\n\n> 导语。\n\n### 重点\n\n- **字幕**：跟随界面语言（#9）。\n\n"
            "### 新增\n\n- **播放**：完整变更条目（#9）。\n\n"
            "<details>\n<summary>下载</summary>\n\n### 重点\n\n- 不是条目\n\n</details>\n\n</details>\n\n"
            "[Full Changelog](https://x/compare)\n")

    def test_an_available_update_carries_only_the_highlights_of_every_newer_release(self):
        """检查到新版本时带上本机之后每一版的重点，新的在前；英文是正文、中文取折叠段，完整变更与下载段都不带。"""
        rows = [release("0.9.0", body=self.BODY), release("0.10.0", body=self.BODY), release("0.11.0", body=self.BODY)]
        notes = self.check(rows)["notes"]
        self.assertEqual([row["version"] for row in notes], ["0.11.0", "0.10.0"])
        self.assertEqual(notes[0]["url"], release_updates.RELEASES_URL + "/tag/v0.11.0")
        self.assertEqual(notes[0]["en"], [{"title": "Subtitles", "text": "Follow the interface language (#9)."}])
        self.assertEqual(notes[0]["zh-CN"], [{"title": "字幕", "text": "跟随界面语言（#9）。"}])
        self.assertNotIn("notes", self.check([release("0.9.0", body=self.BODY)]))

    def test_releases_without_highlights_are_left_out(self):
        """只有修复的版本和 0.59.0 之前的旧正文没有重点分组，不进检查结果。"""
        fixes_only = "### Fixed\n\n- **Interface**: One fix.\n\n<details>\n<summary>简体中文</summary>\n\n### 修复\n\n- x\n\n</details>\n"
        legacy = "### 修复\n\n- **界面**：修好一处。\n\n## 下载选择\n\n| 平台 |\n"
        for body in (None, "", fixes_only, legacy):
            self.assertIsNone(release_updates.changelog_notes(body))
        rows = [release("0.10.0", body=fixes_only), release("0.11.0", body=self.BODY)]
        self.assertEqual([row["version"] for row in self.check(rows)["notes"]], ["0.11.0"])

    def test_notes_follow_the_format_the_release_script_writes(self):
        """应用拆的就是 `changelog.py --notes` 生成的正文：重点就是那一版公告的 features，两边改格式要一起改。"""
        from scripts import changelog
        from scripts.package_windows_release import download_sections
        from peach import release_notices
        document = (Path(changelog.ROOT) / changelog.CHANGELOG).read_text(encoding="utf-8")
        version = "0.58.0"
        body = changelog.notes(document, version, download_sections(version, lite_installer=True))
        notes = release_updates.changelog_notes(body)
        features = release_notices.NOTICES[version]["features"]
        base = f"server:releaseNotes.v{version.replace('.', '-')}.items"
        for language in ("en", "zh-CN"):
            self.assertEqual([item["title"] for item in notes[language]],
                             [interface_text.text(f"{base}.{row['id']}.title", language=language) for row in features])
        for item, row in zip(notes["en"], features):
            self.assertTrue(all(ref in item["text"] for ref in row.get("refs", [])), item)

    def test_prefers_app_update_when_all_tool_assets_are_uploaded(self):
        row = release("1.0.0")
        row["assets"] += [
            {"name": "Peach-1.0.0-windows-x64-update.zip", "state": "uploaded", "size": 123, "digest": "sha256:" + "a" * 64},
            {"name": "Peach-1.0.0-windows-x64-setup.exe", "state": "uploaded"},
        ]
        self.assertEqual(self.check([row])["package_kind"], "full")
        row["assets"] += [{"name": f"Peach-1.0.0-windows-x64-tools-{tool}.zip", "state": "uploaded"}
                          for tool in ("ffmpeg", "untrunc", "cloudflared")]
        self.assertEqual(self.check([row])["package_kind"], "full", "缺人脸模型工具包时不能只下应用更新包")
        row["assets"].append({"name": "Peach-1.0.0-windows-x64-tools-face-models.zip", "state": "uploaded"})
        result = self.check([row])
        self.assertEqual(result["package_kind"], "update")
        self.assertTrue(result["asset_url"].endswith("-update.zip"))
        self.assertEqual(result["asset_size"], 123)
        self.assertEqual(result["full_url"], release_updates.RELEASES_URL + "/download/v1.0.0/Peach-1.0.0-windows-x64.zip",
                         "应用更新包准备不下去时改下的同版本完整包")
        row["assets"][1]["state"] = "new"
        self.assertEqual(self.check([row])["package_kind"], "full")
        row["assets"].pop(0)
        self.assertEqual(self.check([row])["state"], "empty")

    def test_failures_do_not_claim_current_or_keep_a_latest_version(self):
        self.assertEqual(self.check({}, status=429)["state"], "error")
        self.assertEqual(self.check({})["state"], "error")
        for cause in (httpx.ConnectError("offline"), httpx.ReadTimeout("timeout")):
            result = release_updates.check(transport=Mock(side_effect=cause))
            self.assertEqual(result["state"], "error")
            self.assertIsNone(result["latest_version"])

    def test_github_can_report_current_and_ahead_when_r2_is_unavailable(self):
        def transport(github_version):
            def answer(request, *_args):
                if request.url == release_updates.DOWNLOADS_API:
                    raise httpx.ConnectError("R2 unreachable")
                return HttpResponse(200, {}, json.dumps([release(github_version)]).encode())
            return answer

        with patch.object(release_updates, "__version__", "0.48.2"):
            for version, state in (("0.46.1", "ahead"), ("0.48.2", "current")):
                with self.subTest(github=version):
                    result = release_updates.check(transport=transport(version))
                    self.assertEqual(result["state"], state)
            self.assertEqual(release_updates.check(transport=transport("0.49.0"))["state"], "available",
                             "GitHub 上真有更新的版本时照样可以升")

    def test_identical_versions_prefer_github_downloads(self):
        row = release("1.0.0")
        row["assets"][0].update(size=123, digest="sha256:" + "a" * 64)
        calls = []

        def transport(request, *_args):
            calls.append(request.url)
            return HttpResponse(200, {}, json.dumps([row]).encode())

        result = release_updates.check(transport=transport)
        self.assertEqual(calls, [release_updates.API_URL, release_updates.DOWNLOADS_API])
        self.assertEqual(result["asset_url"], release_updates.RELEASES_URL + "/download/v1.0.0/Peach-1.0.0-windows-x64.zip")

    def test_tool_package_is_the_newest_release_carrying_that_tool_with_a_digest(self):
        def tools(version, digest=True):
            row = release(version)
            row["assets"].append({"name": f"Peach-{version}-windows-x64-tools-ffmpeg.zip", "state": "uploaded",
                                  "size": 42, **({"digest": "sha256:" + "b" * 64} if digest else {})})
            return row

        github = [tools("2.0.0", digest=False), tools("1.5.0"), release("3.0.0")]
        mirror = [tools("1.0.0")]

        def transport(request, *_args):
            rows = mirror if request.url == release_updates.DOWNLOADS_API else github
            return HttpResponse(200, {}, json.dumps(rows).encode())

        self.assertEqual(release_updates.tool_package("ffmpeg", transport=transport), {
            "url": release_updates.RELEASES_URL + "/download/v1.5.0/Peach-1.5.0-windows-x64-tools-ffmpeg.zip",
            "size": 42, "digest": "sha256:" + "b" * 64, "version": "1.5.0"})
        with self.assertRaisesRegex(ValueError, "工具包"):
            release_updates.tool_package("untrunc", transport=transport)

    def test_standalone_tray_checks_releases_without_git(self):
        execute = Mock(side_effect=AssertionError("Git must not run"))
        with patch("peach.distribution.standalone", return_value=True), patch.object(
                release_updates, "check", return_value=dict(state="available", latest_version="1.0.0", message="有新版本可下载。")) as check:
            result = VersionManager(execute=execute).check()
        check.assert_called_once()
        self.assertEqual(result.state, "available")
        self.assertIn("1.0.0", result.message)
        execute.assert_not_called()

    def test_macos_offers_the_dmg_for_its_own_architecture_without_in_app_install(self):
        row = release("1.0.0")
        row["assets"] += [
            {"name": "Peach-1.0.0-macos-arm64.dmg", "state": "uploaded", "size": 456, "digest": "sha256:" + "b" * 64},
            {"name": "Peach-1.0.0-macos-x86_64.dmg", "state": "uploaded", "size": 789},
        ]
        transport = Mock(return_value=HttpResponse(200, {}, json.dumps([row]).encode()))
        with patch.object(release_updates, "__version__", "0.9.0"):
            result = release_updates.check(transport=transport, system="darwin", machine="arm64")
            intel = release_updates.check(transport=transport, system="darwin", machine="x86_64")
        self.assertEqual(result["state"], "available")
        self.assertEqual(result["package_kind"], "installer")
        self.assertEqual(result["asset_url"], release_updates.RELEASES_URL + "/download/v1.0.0/Peach-1.0.0-macos-arm64.dmg")
        self.assertEqual(result["asset_size"], 456)
        self.assertTrue(intel["asset_url"].endswith("Peach-1.0.0-macos-x86_64.dmg"))
        with patch("peach.distribution.standalone", return_value=True):
            with patch.object(distribution, "sys", SimpleNamespace(platform="darwin")):
                self.assertFalse(release_updates.snapshot()["in_app_update"], "macOS 独立包没有应用内安装")
            with patch.object(distribution, "sys", SimpleNamespace(platform="win32")):
                self.assertTrue(release_updates.snapshot()["in_app_update"])

    def docker_check(self, digests, *, auth_status=200):
        """Release 列表给 1.0.0；镜像仓库按 `digests` 回各标签的摘要，缺的标签回 404。"""
        calls = []

        def transport(request, *_args):
            calls.append(request)
            if request.url.startswith(docker_update.REGISTRY_AUTH):
                return HttpResponse(auth_status, {}, json.dumps({"token": "anonymous"}).encode())
            if request.url.startswith(docker_update.REGISTRY):
                digest = digests.get(request.url.rsplit("/", 1)[1])
                return HttpResponse(200 if digest else 404, {"Docker-Content-Digest": digest} if digest else {}, b"")
            return HttpResponse(200, {}, json.dumps([release("1.0.0")]).encode())

        with patch.dict("os.environ", {"PEACH_DISTRIBUTION": "docker"}), \
                patch.object(release_updates, "__version__", "0.9.0"), \
                patch.object(docker_update, "status", return_value={"available": True, "reason": ""}):
            return release_updates.check(transport=transport, system="linux", machine="x86_64"), calls

    def test_docker_image_reports_itself_and_gives_host_steps_instead_of_a_package(self):
        same = "sha256:" + "a" * 64
        with patch.dict("os.environ", {"PEACH_DISTRIBUTION": "docker"}):
            snapshot = release_updates.snapshot()
        result, calls = self.docker_check({"1.0.0": same, "edge": same})
        self.assertEqual(snapshot["installation"], "Docker 镜像", "此前显示成「源码运行」")
        self.assertEqual([step["command"] for step in snapshot["steps"]],
                         ["docker compose pull", "docker compose up -d"])
        self.assertEqual((result["state"], result["latest_version"]), ("available", "1.0.0"))
        self.assertEqual(result["release_url"], release_updates.RELEASES_URL + "/tag/v1.0.0")
        self.assertNotIn("package_kind", result, "容器不下载 Windows 发行包")
        self.assertNotIn("asset_url", result)
        self.assertEqual(result["one_click"], {"available": True, "reason": ""})
        manifests = [request for request in calls if "/manifests/" in request.url]
        self.assertEqual({request.method for request in manifests}, {"HEAD"}, "只读摘要，不下载 manifest 正文与镜像层")
        self.assertTrue(all(request.headers["Authorization"] == "Bearer anonymous" for request in manifests))
        self.assertFalse(any("Authorization" in request.headers for request in calls if request not in manifests),
                         "匿名令牌只发给镜像仓库")
        with patch.dict("os.environ", {"PEACH_DISTRIBUTION": ""}):
            self.assertEqual(release_updates.snapshot()["steps"], [])

    def test_docker_release_waits_until_edge_points_at_the_pushed_version(self):
        old, new = "sha256:" + "a" * 64, "sha256:" + "b" * 64
        for digests in ({}, {"edge": old}, {"1.0.0": new, "edge": old}):
            with self.subTest(digests=digests):
                result, _ = self.docker_check(digests)
                self.assertEqual(result["state"], "pending", "Release 已建、镜像还没推送时不能提示拉取")
                self.assertEqual(result["latest_version"], "1.0.0")
                self.assertIn("镜像尚未发布", result["message"])
                self.assertNotIn("one_click", result, "镜像没推送时不给一键更新")
        result, _ = self.docker_check({"1.0.0": new, "edge": new}, auth_status=503)
        self.assertEqual(result["state"], "error", "读不到镜像仓库就是没查成，不当成有新版")

    def test_macos_skips_releases_without_its_dmg(self):
        transport = Mock(return_value=HttpResponse(200, {}, json.dumps([release("1.0.0")]).encode()))
        with patch.object(release_updates, "__version__", "0.9.0"):
            result = release_updates.check(transport=transport, system="darwin", machine="arm64")
        self.assertEqual(result["state"], "empty", "只有 Windows 包的版本不能提示 macOS 更新")


class DockerUpdateTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.enterContext(patch.dict("os.environ", {docker_update.IMAGE_TAG_ENV: "edge",
                                                    docker_update.UPDATE_DIR_ENV: str(self.root)}))

    def watchtower(self, post_status, *, reachable=True):
        """假 Watchtower：探测（GET）回 401 表示在线，更新请求（POST）回 `post_status`。"""
        requests = []

        def handler(request):
            requests.append(request)
            if not reachable:
                raise httpx.ConnectError("Name or service not known", request=request)
            return httpx.Response(401 if request.method == "GET" else post_status)
        return httpx.MockTransport(handler), requests

    def test_token_is_generated_once_and_kept(self):
        docker_update.ensure_token()
        path = self.root / docker_update.TOKEN_NAME
        first = path.read_text(encoding="utf-8")
        self.assertGreaterEqual(len(first), 40)
        docker_update.ensure_token()
        self.assertEqual(path.read_text(encoding="utf-8"), first, "Watchtower 只在启动时读一次，换了就对不上")
        with patch.dict("os.environ", {docker_update.UPDATE_DIR_ENV: ""}):
            docker_update.ensure_token()  # 不在官方镜像里：没有令牌目录，什么也不做

    def test_one_click_needs_a_rolling_tag_a_token_and_a_reachable_watchtower(self):
        transport, _ = self.watchtower(202)
        self.assertIn("令牌", docker_update.status(transport=transport)["reason"])
        docker_update.ensure_token()
        self.assertEqual(docker_update.status(transport=transport), {"available": True, "reason": ""})
        with patch.dict("os.environ", {docker_update.IMAGE_TAG_ENV: "latest"}):
            self.assertEqual(docker_update.status(transport=transport), {"available": True, "reason": ""},
                             "latest 与 edge 同时推送，NAS 面板按 latest 部署也能一键更新")
        self.assertEqual(docker_update.status(transport=self.watchtower(202, reachable=False)[0]),
                         {"available": False, "reason": ""}, "没启用 watchtower profile 时照常给两步命令，不报错")
        for tag, message in (("0.53.0", ".env"), ("", "compose.yaml")):
            with self.subTest(tag=tag), patch.dict("os.environ", {docker_update.IMAGE_TAG_ENV: tag}):
                state = docker_update.status(transport=transport)
                self.assertFalse(state["available"])
                self.assertIn(message, state["reason"], "旧 compose 没传标签时要指向 compose 文件，不是 .env")

    def test_trigger_posts_an_async_update_with_the_generated_token(self):
        docker_update.ensure_token()
        token = (self.root / docker_update.TOKEN_NAME).read_text(encoding="utf-8")
        transport, requests = self.watchtower(202)
        self.assertEqual(docker_update.trigger(transport=transport)["state"], "updating")
        posted = [request for request in requests if request.method == "POST"]
        self.assertEqual([str(request.url) for request in posted], [docker_update.WATCHTOWER_URL + "/v1/update?async=true"],
                         "同步请求的响应会被 Watchtower 停容器打断")
        self.assertEqual(posted[0].headers["Authorization"], f"Bearer {token}")
        self.assertFalse(any("Authorization" in request.headers for request in requests if request.method == "GET"),
                         "探测不带令牌")
        for status, message in ((401, "docker compose restart watchtower"), (429, "另一次更新"), (500, "HTTP 500")):
            with self.subTest(status=status), self.assertRaisesRegex((ValueError, OSError), message):
                docker_update.trigger(transport=self.watchtower(status)[0])

    def test_trigger_refuses_before_contacting_watchtower_when_it_cannot_update(self):
        transport, requests = self.watchtower(202)
        docker_update.ensure_token()
        with patch.dict("os.environ", {docker_update.IMAGE_TAG_ENV: "0.53.0"}), self.assertRaisesRegex(ValueError, "edge"):
            docker_update.trigger(transport=transport)
        self.assertEqual(requests, [], "换不到新版本时不打扰 Watchtower")
        with self.assertRaisesRegex(ValueError, "watchtower profile"):
            docker_update.trigger(transport=self.watchtower(202, reachable=False)[0])


class ReleaseNoticeTests(unittest.TestCase):
    """更新公告：新安装不弹，上一版升级弹当前版，跳版补列错过的要点，按平台与本机数据挑条目。"""

    def setUp(self):
        import sqlite3
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.connection = sqlite3.connect(Path(temporary.name) / 'ledger.db')
        self.addCleanup(self.connection.close)
        self.connection.executescript("""
            CREATE TABLE profile(id TEXT PRIMARY KEY,settings_json TEXT,updated_at TEXT);
            INSERT INTO profile VALUES('local-default','{"sidebarOrder":["tags"]}','');
            CREATE TABLE schema_migration(version TEXT PRIMARY KEY,name TEXT,checksum TEXT,applied_at TEXT);
        """)

    def migrations(self, *rows):
        self.connection.executemany("INSERT INTO schema_migration VALUES(?,?,?,?)",
                                    [(version, 'm', 'c', stamp) for version, stamp in rows])

    def snapshot(self, **options):
        from peach import release_notice
        options.setdefault('tokens', {'windows', 'standalone'})
        options.setdefault('current', '0.57.0')
        return release_notice.snapshot(self.connection, **options)

    def seen(self, version):
        self.connection.execute("UPDATE profile SET settings_json=?",
                                (json.dumps({'sidebarOrder': ['tags'], 'release_notice': {'seen': version}}),))

    def test_a_fresh_install_is_not_shown_an_update_notice(self):
        self.migrations(('0001', '2026-11-07T01:00:00+00:00'), ('0052', '2026-11-07T01:00:05+00:00'))
        result = self.snapshot()
        self.assertEqual(result['kind'], 'new-install')
        self.assertFalse(result['show'])

    def test_an_upgrade_from_the_previous_release_shows_the_current_notice_only(self):
        self.seen('0.56.0')
        result = self.snapshot()
        self.assertEqual((result['kind'], result['show'], result['missed']), ('upgrade', True, []))
        self.assertIn('容量保护', [item['title'] for item in result['notice']['features']])

    def test_skipping_releases_lists_what_was_missed_newest_first_and_skips_quiet_ones(self):
        self.seen('0.53.0')
        result = self.snapshot()
        self.assertEqual(result['kind'], 'skipped')
        self.assertEqual([row['version'] for row in result['missed']], ['0.56.0', '0.55.0', '0.54.0'])

    def test_a_ledger_without_a_record_estimates_the_previous_release_from_its_migrations(self):
        self.migrations(('0001', '2026-08-01T00:00:00+00:00'), ('0050', '2026-10-27T00:00:00+00:00'),
                        ('0052', '2026-11-08T00:00:00+00:00'))
        result = self.snapshot()
        self.assertEqual((result['kind'], result['previous'], result['estimated']), ('upgrade', '0.51.0', True))
        self.assertTrue(result['show'])
        self.assertEqual(result['missed'][0]['version'], '0.56.0')

    def test_items_follow_the_platform_and_the_data_on_this_machine(self):
        self.seen('0.53.0')
        windows = self.snapshot()
        docker = self.snapshot(tokens={'linux', 'docker'}, facts={'system_files': {'count': 12}})
        titles = lambda result, version: [row['title'] for row in result['missed']
                                          if row['version'] == version for row in row['features']]
        self.assertNotIn('Docker 首次设置', titles(windows, '0.56.0'))
        self.assertIn('Docker 首次设置', titles(docker, '0.56.0'))
        self.assertNotIn('macOS 应用内更新', titles(windows, '0.54.0'))
        self.assertEqual(windows['notice']['automatic'], [])
        self.assertEqual(docker['notice']['automatic'],
                         [{'id': 'system-files', 'icon': 'server', 'title': '移出系统附属文件',
                           'progress': {'count': 12}, 'body': docker['notice']['automatic'][0]['body']}])

    def test_acknowledging_only_moves_forward_and_hides_the_notice(self):
        from peach import release_notice
        self.seen('0.56.0')
        release_notice.acknowledge(self.connection, '0.57.0')
        release_notice.acknowledge(self.connection, '0.56.0')
        stored = json.loads(self.connection.execute('SELECT settings_json FROM profile').fetchone()[0])
        self.assertEqual(stored['release_notice']['seen'], '0.57.0')
        self.assertEqual(stored['sidebarOrder'], ['tags'])
        self.assertEqual((self.snapshot()['kind'], self.snapshot()['show']), ('seen', False))

    def test_every_notice_uses_known_platforms_conditions_and_levels(self):
        from peach import release_notice
        from peach.release_notices import NOTICES
        for version, notice in NOTICES.items():
            self.assertIn(notice['level'], {'notice', 'quiet'}, version)
            for section in ('features', 'automatic', 'attention'):
                for item in notice.get(section, []):
                    tokens = {part for token in item.get('platforms', []) for part in token.split('+')}
                    self.assertLessEqual(tokens, release_notice.PLATFORM_TOKENS, (version, item['id']))
                    self.assertIn(item.get('when', 'display_reprobe'), release_notice.FACTS, (version, item['id']))


class ReleaseNoticeFactsTests(unittest.TestCase):
    """公告条目的显示条件只读本机回执：移出过系统文件、解除过乱码人物关联才显示对应条目。"""

    def test_counts_come_from_the_latest_upgrade_receipts(self):
        import sqlite3
        from peach import routes_configuration
        connection = sqlite3.connect(':memory:')
        self.addCleanup(connection.close)
        connection.execute('CREATE TABLE ledger_upgrade_repair(id TEXT, result_json TEXT, applied_at TEXT)')
        connection.executemany('INSERT INTO ledger_upgrade_repair VALUES(?,?,?)', [
            ('a', json.dumps({'discovery-system-files-3': {'isolated': [{'id': 1}, {'id': 2}]}}), '1'),
            ('b', json.dumps({'garbled_people': {'links': [{'asset_id': 7}], 'tags': [], 'entities': []}}), '2'),
            ('javdb-actor-records-1', json.dumps({'rule': 1, 'recorded': [{}, {}, {}],
                                                  'hidden': [{}, {}], 'disabled_feeds': [{}]}), '3'),
        ])
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
            upgrade_repairs=SimpleNamespace(available=False))))
        facts = routes_configuration._release_notice_facts(request, connection)
        self.assertEqual(facts, {'system_files': {'count': 2}, 'garbled_performers': {'count': 1},
                                 'javdb_entries': {'count': 3}})


class ReleaseNoticeContentRuleTests(unittest.TestCase):
    """公告只放使用者能明显感知的几条，图标按登记的含义挑（`release_notices` 模块说明）。"""

    def setUp(self):
        from peach import release_notice, release_notices
        self.notice, self.notices = release_notice, release_notices
        self.checked = {version: entry for version, entry in release_notices.NOTICES.items()
                        if release_notice.version_key(version) >= release_notice.version_key(release_notices.RULES_SINCE)}
        self.assertIn(release_notices.RULES_SINCE, self.checked)

    def test_the_frontend_draws_exactly_the_registered_icons(self):
        import re
        source = (Path(__file__).resolve().parents[1] / 'frontend/src/react/release-notice.tsx').read_text(encoding='utf-8')
        block = re.search(r'const ICONS: Record<string, RemixiconComponentType> = \{(.*?)\};', source, re.S)
        self.assertIsNotNone(block)
        self.assertEqual(set(re.findall(r'(\w+): Ri\w+', block[1])), set(self.notices.ICON_MEANINGS))

    def test_every_notice_icon_is_registered_and_new_ones_avoid_generic_icons(self):
        for version, entry in self.notices.NOTICES.items():
            for group in ('features', 'automatic', 'attention'):
                for item in entry.get(group, []):
                    if 'icon' not in item:
                        continue
                    with self.subTest(version=version, item=item['id']):
                        self.assertIn(item['icon'], self.notices.ICON_MEANINGS)
                        if version in self.checked:
                            self.assertNotIn(item['icon'], self.notices.GENERIC_ICONS)

    def test_no_platform_sees_more_features_than_the_limit(self):
        systems, installs = ('windows', 'macos', 'linux'), ('docker', 'standalone', 'source')
        for version, entry in self.checked.items():
            for tokens in ({system, install} for system in systems for install in installs):
                shown = [item for item in entry.get('features', []) if self.notice.applies(item, tokens, {})]
                with self.subTest(version=version, tokens=sorted(tokens)):
                    self.assertLessEqual(len(shown), self.notices.FEATURE_LIMIT)

    def test_feature_refs_are_issue_or_pull_request_numbers(self):
        """`refs` 进 Release 正文的重点，GitHub 和检查更新页都按 `#123`、`owner/repo#123` 认链接。"""
        import re
        for version, entry in self.notices.NOTICES.items():
            for item in entry.get('features', []):
                with self.subTest(version=version, item=item['id']):
                    self.assertTrue(all(re.fullmatch(r'(?:[\w.-]+/[\w.-]+)?#[1-9]\d*', ref) for ref in item.get('refs', [])))

    def test_automatic_items_only_show_where_the_upgrade_changed_data(self):
        for version, entry in self.checked.items():
            for item in entry.get('automatic', []):
                with self.subTest(version=version, item=item['id']):
                    self.assertIn(item.get('when'), self.notice.FACTS)
