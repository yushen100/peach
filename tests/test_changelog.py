import contextlib
import io
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts import changelog
from scripts.changelog import Commit, entry_for, group_entries, has_section, promote, render_body
from scripts.version_bump import VersionError

REPO = "owner/repo"

#: 一份最小的 `CHANGELOG.md`：头部、润色过的未发布节、一个发布节、底部链接块。
DOCUMENT = """# Changelog / 变更日志

Intro. / 说明段。

## [Unreleased]

### Added / 新增

- **Settings**: Settings add a desktop shortcut switch. / **配置**：配置页新增桌面快捷方式开关。

### Fixed / 修复

- **Interface**: Busy hints say what is running. / **界面**：忙态提示会说明正在进行的动作。

## [0.27.1] - 2026-09-06

> Fourth pre-release. / 第四个预发布。

[Unreleased]: https://github.com/owner/repo/compare/v0.27.1...HEAD
[0.27.1]: https://github.com/owner/repo/releases/tag/v0.27.1
"""

ADDED = "**Settings**: Settings add a desktop shortcut switch. / **配置**：配置页新增桌面快捷方式开关。"
FIXED = "**Interface**: Busy hints say what is running. / **界面**：忙态提示会说明正在进行的动作。"
#: 同一份文件，未发布节一条都没写。
BARE = DOCUMENT.replace(f"### Added / 新增\n\n- {ADDED}\n\n### Fixed / 修复\n\n- {FIXED}\n\n", "")


class EntryTests(unittest.TestCase):
    def test_only_user_facing_types_become_entries(self):
        self.assertEqual(entry_for(Commit("feat: 配置页并入管理菜单", "")),
                         ("Added", "配置页并入管理菜单"))
        self.assertEqual(entry_for(Commit("fix(web): 忙态提示说明在做什么", "")),
                         ("Fixed", "web：忙态提示说明在做什么"))
        self.assertEqual(entry_for(Commit("perf(media): 首段缩到 0.67 秒", "")),
                         ("Changed", "**Playback**: TODO / **播放**：首段缩到 0.67 秒"))
        for subject in ("docs: 记一笔", "test: 补断言", "chore(release): 版本 0.29.1",
                        "refactor(follow): 登记表收口", "style: 空行", "随手写的主题"):
            with self.subTest(subject=subject):
                self.assertIsNone(entry_for(Commit(subject, "")))

    def test_known_scopes_become_area_labels_and_unknown_ones_wait_for_a_human(self):
        self.assertEqual(entry_for(Commit("feat(review): 候选支持多选", "")),
                         ("Added", "**Review**: TODO / **复核**：候选支持多选"))
        self.assertEqual(entry_for(Commit("fix(avatars): 只装更大的那张", "")),
                         ("Fixed", "**Sourcing**: TODO / **采集**：只装更大的那张"))
        self.assertEqual(entry_for(Commit("fix(web): 忙态提示说明在做什么", "")),
                         ("Fixed", "web：忙态提示说明在做什么"))
        self.assertEqual(entry_for(Commit("feat: 没有 scope 就没有标签", "")),
                         ("Added", "没有 scope 就没有标签"))

    def test_every_mapped_label_is_in_the_closed_vocabulary(self):
        self.assertLessEqual(set(changelog.AREA_BY_SCOPE.values()),
                             set(changelog.AREAS))

    def test_development_only_scopes_stay_out_even_under_fix(self):
        self.assertIsNone(entry_for(Commit("fix(tests): 断言跟上新名字", "")))
        self.assertIsNone(entry_for(Commit("fix(docs): 链接失效", "")))

    def test_breaking_changes_are_told_by_the_bang_or_the_footer(self):
        self.assertEqual(entry_for(Commit("fix!: 数据库路径改成 location 键", "")),
                         ("Breaking", "数据库路径改成 location 键"))
        self.assertEqual(
            entry_for(Commit("feat(config): 换掉盘符键", "BREAKING CHANGE: 设置文件要重写")),
            ("Breaking", "**Settings**: TODO / **配置**：设置文件要重写"))

    def test_security_work_gets_its_own_group(self):
        self.assertEqual(entry_for(Commit("fix(security): 凭据不再进日志", "")),
                         ("Security", "凭据不再进日志"))

    def test_groups_keep_the_documented_order_and_drop_duplicates(self):
        grouped = group_entries([
            Commit("fix: 同一句", ""), Commit("feat: 新东西", ""),
            Commit("fix: 同一句", ""), Commit("fix!: 破坏性的", ""),
        ])
        self.assertEqual(list(grouped), ["Breaking", "Added", "Fixed"])
        self.assertEqual(grouped["Fixed"], ["同一句"])

    def test_the_body_is_markdown_with_one_blank_line_between_groups(self):
        body = render_body(group_entries([Commit("feat: 甲", ""), Commit("fix: 乙", "")]))
        self.assertEqual(body, "### Added / 新增\n\n- 甲\n\n### Fixed / 修复\n\n- 乙")


class PromoteTests(unittest.TestCase):
    def promoted(self, document: str = DOCUMENT, **overrides) -> str:
        options = {"date": "2026-09-07", "repo": REPO, "previous": "v0.27.1"}
        return promote(document, overrides.pop("version", "0.28.0"),
                       **{**options, **overrides})

    def test_the_unreleased_wording_moves_into_the_new_section(self):
        updated = self.promoted()
        self.assertIn("## [0.28.0] - 2026-09-07", updated)
        self.assertIn("/ **配置**：配置页新增桌面快捷方式开关。", updated.split("## [0.28.0]")[1])
        self.assertTrue(has_section(updated, "0.28.0"))

    def test_an_empty_unreleased_section_is_left_behind_at_the_top(self):
        updated = self.promoted()
        between = updated.split(f"## [{changelog.UNRELEASED}]")[1].split("## [0.28.0]")[0]
        self.assertEqual(between.strip(), "")

    def test_the_sections_stay_in_descending_order(self):
        updated = self.promoted()
        self.assertLess(updated.index("## [0.28.0]"), updated.index("## [0.27.1]"))

    def test_both_compare_links_are_written(self):
        updated = self.promoted()
        self.assertIn("[Unreleased]: https://github.com/owner/repo/compare/v0.28.0...HEAD", updated)
        self.assertIn("[0.28.0]: https://github.com/owner/repo/compare/v0.27.1...v0.28.0",
                      updated)
        self.assertIn("[0.27.1]: https://github.com/owner/repo/releases/tag/v0.27.1", updated)

    def test_the_first_release_links_to_its_own_tag(self):
        document = DOCUMENT.replace(
            "## [0.27.1] - 2026-09-06\n\n> Fourth pre-release. / 第四个预发布。\n\n", "").replace(
            "[0.27.1]: https://github.com/owner/repo/releases/tag/v0.27.1\n", "").replace(
            "compare/v0.27.1...HEAD", "compare/v0.1.0...HEAD")
        updated = self.promoted(document, version="0.1.0", previous=None)
        self.assertIn("[0.1.0]: https://github.com/owner/repo/releases/tag/v0.1.0", updated)

    def test_a_draft_fills_in_when_nobody_wrote_the_unreleased_section(self):
        updated = promote(BARE, "0.28.0", date="2026-09-07", repo=REPO, previous="v0.27.1",
                          fallback="### Added / 新增\n\n- 起草出来的那条")
        self.assertIn("- 起草出来的那条", updated)

    def test_a_release_with_nothing_to_say_is_refused(self):
        with self.assertRaisesRegex(VersionError, "没有可记录的变化"):
            promote(BARE, "0.28.0", date="2026-09-07", repo=REPO, previous="v0.27.1")

    def test_the_same_version_cannot_be_promoted_twice(self):
        with self.assertRaisesRegex(VersionError, "已经有 0.27.1"):
            self.promoted(version="0.27.1")

    def test_a_document_without_the_required_anchors_is_refused(self):
        with self.assertRaisesRegex(VersionError, "Unreleased"):
            self.promoted("# Changelog\n\n## [0.27.1] - 2026-09-06\n")
        without_link = DOCUMENT.replace(
            "[Unreleased]: https://github.com/owner/repo/compare/v0.27.1...HEAD\n", "")
        with self.assertRaisesRegex(VersionError, "链接"):
            self.promoted(without_link)


#: 定版检查用的一节：英文在前、中文在后的单条修复。
def section(version: str, entry: str, *, date: str = "2026-09-19") -> str:
    heading = f"## [{version}]" + ("" if version == changelog.UNRELEASED else f" - {date}")
    return f"{heading}\n\n### Fixed / 修复\n\n- {entry}\n"


class SectionTests(unittest.TestCase):
    """取出一节的正文：发布前要人确认的就是这段文字。"""

    def test_a_section_stops_at_the_next_heading(self):
        self.assertEqual(changelog.section_of(DOCUMENT, changelog.UNRELEASED),
                         "### Added / 新增\n\n- " + ADDED + "\n\n### Fixed / 修复\n\n- " + FIXED)

    def test_the_last_section_stops_before_the_link_block(self):
        self.assertEqual(changelog.section_of(DOCUMENT, "0.27.1"), "> Fourth pre-release. / 第四个预发布。")

    def test_a_version_without_a_section_yields_nothing(self):
        self.assertEqual(changelog.section_of(DOCUMENT, "0.28.0"), "")

    def test_a_release_refuses_raw_commit_scopes_before_it_is_shipped(self):
        with self.assertRaisesRegex(VersionError, "未归类.*web"):
            changelog.require_labeled_entries(section("0.8.0", "web：修好一处界面"), "0.8.0")
        changelog.require_labeled_entries(
            section("0.8.0", "**Interface**: Fixed a page. / **界面**：修好一处界面。"), "0.8.0")

    def test_both_halves_carry_matching_area_tags(self):
        """中文标签与英文标签对得上；只写一种语言、英文标签对错了都拒绝。"""
        for entry in ("**界面**：修好一处界面。", "**Playback**: Fixed a page. / **界面**：修好一处界面。",
                      "**Interface**: Fixed a page."):
            with self.subTest(entry=entry), self.assertRaisesRegex(VersionError, "未归类"):
                changelog.require_labeled_entries(section("0.8.0", entry), "0.8.0")

    def test_every_line_puts_english_first_and_the_draft_todo_is_refused(self):
        """分组标题、说明段都要英文在前；草稿留的 `TODO` 没写就不能定版。"""
        cases = (
            "## [0.8.0] - 2026-09-19\n\n### 修复\n\n- **Interface**: Fixed. / **界面**：修好。\n",
            "## [0.8.0] - 2026-09-19\n\n只有中文的说明。\n\n### Fixed / 修复\n\n- **Interface**: Fixed. / **界面**：修好。\n",
            section("0.8.0", "**Interface**: TODO / **界面**：修好一处界面。"),
        )
        for document in cases:
            with self.subTest(document=document), self.assertRaisesRegex(VersionError, "英文 / 中文"):
                changelog.require_labeled_entries(document, "0.8.0")
        changelog.require_labeled_entries(
            "## [0.8.0] - 2026-09-19\n\n> A note. / 说明。\n\n### Fixed / 修复\n\n"
            "- **Interface**: Fixed. / **界面**：修好。\n", "0.8.0")

    def test_a_release_refuses_an_entry_longer_than_one_sentence(self):
        """条目给使用者扫读：标签之后中文超过 80 字、英文超过 160 个字符就拒绝定版，正好到上限的照常通过。"""
        def entry(english: str, chinese: str) -> str:
            return section("0.8.0", f"**Interface**: {english} / **界面**：{chinese}")
        changelog.require_labeled_entries(entry("a" * changelog.ENGLISH_LIMIT, "字" * changelog.ENTRY_LIMIT), "0.8.0")
        for document in (entry("a", "字" * (changelog.ENTRY_LIMIT + 1)),
                         entry("a" * (changelog.ENGLISH_LIMIT + 1), "字")):
            with self.subTest(document=document[-40:]), self.assertRaisesRegex(VersionError, "一句话"):
                changelog.require_labeled_entries(document, "0.8.0")
        # 链接地址、加粗与代码标记读者看不到，只计显示的文字。
        changelog.require_labeled_entries(
            entry("a" * (changelog.ENGLISH_LIMIT - 9) + "`code` **[Docs](docs/DOCKER.md#watchtower)**",
                  "字" * (changelog.ENTRY_LIMIT - 2) + "[说明](docs/DOCKER.md#一键更新可选-watchtower)"), "0.8.0")

    def test_entries_after_0_58_0_must_cite_an_issue_or_pull_request(self):
        """0.58.0 之后与 Unreleased 段的条目两半句末都带同样的 issue 或 PR 编号；跨仓库写 owner/repo#编号；更早的不追补。"""
        bare = "**Interface**: Fixed a page. / **界面**：修好一处界面。"
        for version in ("0.58.1", "0.59.0", changelog.UNRELEASED):
            with self.subTest(version=version), self.assertRaisesRegex(VersionError, "来源编号"):
                changelog.require_labeled_entries(section(version, bare), version)
        for english, chinese in (("(#651).", "（#651）。"), ("(#650, #651).", "（#650、#651）。"),
                                 ("(peach-mitao/peach-userscript#28).", "（peach-mitao/peach-userscript#28）。")):
            with self.subTest(cited=english):
                changelog.require_labeled_entries(
                    section("0.59.0", f"**Interface**: Fixed a page {english} / **界面**：修好一处界面{chinese}"),
                    "0.59.0")
        # 只有一半带编号、两半编号不同、色号与锚点里的 # 都不算；0.58.0 及更早照旧放行。
        for entry in ("**Interface**: Fixed a page. / **界面**：修好一处界面（#651）。",
                      "**Interface**: Fixed a page (#650). / **界面**：修好一处界面（#651）。",
                      "**Interface**: Accent is #0043ce, see [docs](docs/A.md#b). / **界面**：强调色改成 #0043ce，见 [说明](docs/A.md#b)。"):
            with self.subTest(entry=entry), self.assertRaisesRegex(VersionError, "来源编号"):
                changelog.require_labeled_entries(section("0.59.0", entry), "0.59.0")
        changelog.require_labeled_entries(section("0.58.0", bare, date="2026-11-14"), "0.58.0")

    def test_an_overlong_entry_in_an_older_release_also_blocks_the_release(self):
        """旧版本改写时也守住上限：任一已发布版本有超长条目，新版本就不能定版；旧版本没有标签也照样按字数算。"""
        current = section("0.8.0", "**Interface**: Fixed a page. / **界面**：修好一处界面。") + "\n"
        older = "## [0.7.0] - 2026-09-01\n\n### Fixed / 修复\n\n- " + "字" * (changelog.ENTRY_LIMIT + 1) + "\n"
        with self.assertRaisesRegex(VersionError, "0.7.0："):
            changelog.require_labeled_entries(current + older, "0.8.0")
        changelog.require_labeled_entries(current + older.replace("字", "", 1), "0.8.0")


class NotesTests(unittest.TestCase):
    """Release 页的更新说明：英文在前、中文折叠、末尾完整变更链接；缺那一节或链接就拒绝。"""

    def test_the_notes_put_english_first_and_fold_the_chinese(self):
        self.assertEqual(changelog.notes(DOCUMENT, "0.27.1"),
                         "> Fourth pre-release.\n\n<details>\n<summary>简体中文</summary>\n\n> 第四个预发布。\n\n"
                         "</details>\n\n[Full Changelog](https://github.com/owner/repo/releases/tag/v0.27.1)\n")

    def test_downloads_fold_per_language_with_english_outside(self):
        """按语言分开：外面是英文说明与折叠的 Downloads；中文说明与折叠的「下载」都在「简体中文」里。"""
        body = changelog.notes(DOCUMENT, "0.27.1", ("English downloads.", "中文下载。"))
        self.assertEqual(body,
                         "> Fourth pre-release.\n\n<details>\n<summary>Downloads</summary>\n\nEnglish downloads.\n\n"
                         "</details>\n\n<details>\n<summary>简体中文</summary>\n\n> 第四个预发布。\n\n"
                         "<details>\n<summary>下载</summary>\n\n中文下载。\n\n</details>\n\n</details>\n\n"
                         "[Full Changelog](https://github.com/owner/repo/releases/tag/v0.27.1)\n")

    def test_the_upgrade_notice_features_lead_each_language_as_highlights(self):
        """这一版公告的 features 写成重点，放在开头说明段之后，带 refs 的附编号；没有公告的版本不加。"""
        notice = {"0.27.1": {"level": "notice", "features": [{"id": "subtitles", "refs": ["#9", "owner/other#3"]},
                                                               {"id": "faster"}]}}
        def text(key, language):
            return f"{language} {key.rsplit('.', 2)[-2]} {key.rsplit('.', 1)[-1]}"
        with mock.patch.dict(changelog.release_notices.NOTICES, notice, clear=True), \
                mock.patch.object(changelog.interface_text, "text", side_effect=text):
            body = changelog.notes(DOCUMENT, "0.27.1")
        self.assertIn("> Fourth pre-release.\n\n### Highlights\n\n"
                      "- **en subtitles title**: en subtitles body (#9, owner/other#3).\n"
                      "- **en faster title**: en faster body.\n\n<details>", body)
        self.assertIn("> 第四个预发布。\n\n### 重点\n\n"
                      "- **zh-CN subtitles title**：zh-CN subtitles body（#9、owner/other#3）。\n"
                      "- **zh-CN faster title**：zh-CN faster body。\n\n</details>", body)
        with mock.patch.dict(changelog.release_notices.NOTICES, {}, clear=True):
            self.assertNotIn("###", changelog.notes(DOCUMENT, "0.27.1"))

    def test_groups_and_entries_split_at_the_first_separator(self):
        """分组标题、条目、说明段都按第一个 ` / ` 拆开；中文里的全角斜杠留在中文那边。"""
        english, chinese = changelog.bilingual(
            "Lead. / 导语。\n\n### Fixed / 修复\n\n- **Interface**: Pages A/B fixed (#1). / **界面**：甲／乙页修好（#1）。")
        self.assertEqual(english, "Lead.\n\n### Fixed\n\n- **Interface**: Pages A/B fixed (#1).")
        self.assertEqual(chinese, "导语。\n\n### 修复\n\n- **界面**：甲／乙页修好（#1）。")

    def test_a_version_without_a_section_cannot_be_released(self):
        with self.assertRaisesRegex(VersionError, "0.28.0"):
            changelog.notes(DOCUMENT, "0.28.0")

    def test_a_section_without_its_link_cannot_be_released(self):
        unlinked = DOCUMENT.replace("[0.27.1]: https://github.com/owner/repo/releases/tag/v0.27.1\n", "")
        with self.assertRaisesRegex(VersionError, r"\[0\.27\.1\]:"):
            changelog.notes(unlinked, "0.27.1")

    def test_the_command_line_names_what_it_failed_to_produce(self):
        """`--notes` 失败说的是 Release 正文，不借用定版那条「变更日志未更新」。"""
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / changelog.CHANGELOG).write_text(DOCUMENT, encoding="utf-8")
            out = io.StringIO()
            with mock.patch.object(changelog, "ROOT", Path(folder)), \
                    contextlib.redirect_stdout(out):
                code = changelog.main(["--notes", "0.28.0"])
        self.assertEqual(code, 1)
        self.assertTrue(out.getvalue().startswith("Release 正文未生成："), out.getvalue())
        self.assertNotIn("变更日志未更新", out.getvalue())

    def test_the_release_workflow_reads_the_notes_it_does_not_inline_them(self):
        """固定文案只活在 `changelog.py` 与 `download_sections()`；工作流在标签提交上生成文件再交给 gh。"""
        workflow = (Path(changelog.ROOT) / ".github/workflows/release.yml").read_text(encoding="utf-8")
        self.assertIn("scripts/changelog.py --notes", workflow)
        self.assertIn("--to release/RELEASE_NOTES.md", workflow)
        self.assertIn("--notes-file RELEASE_NOTES.md", workflow)
        self.assertNotIn("--notes 'Windows", workflow)
        self.assertNotIn("DOWNLOADS.md", workflow)


class RecordedMergeTests(unittest.TestCase):
    """`merge -s ours` 只为署名记入社区提交，那些改动不在主线上，不进日志也不抬版本级别。"""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.git("init", "-q", "-b", "master")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "user.name", "Test")
        self.commit("chore: 起点")
        self.git("tag", "v0.1.0")

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, check=True, capture_output=True,
                              text=True, encoding="utf-8").stdout

    def commit(self, subject):
        name = f"{len(list(self.root.glob('*.txt')))}.txt"
        (self.root / name).write_text(subject, encoding="utf-8")
        self.git("add", "--", name)
        self.git("commit", "-q", "-m", subject)

    def test_only_commits_whose_changes_reached_master_are_drafted(self):
        self.git("checkout", "-q", "-b", "community")
        self.commit("feat(web): 对方的整套译文")
        self.git("checkout", "-q", "master")
        self.git("merge", "-q", "-s", "ours", "--no-ff", "-m", "chore(i18n): 记入社区译法", "community")
        self.git("checkout", "-q", "-b", "worker")
        self.commit("fix(web): 正常合入的修复")
        self.git("checkout", "-q", "master")
        self.git("merge", "-q", "--no-ff", "-m", "Merge branch 'worker'", "worker")
        self.commit("fix(web): 主线上的修复")
        expected = ["fix(web): 主线上的修复", "fix(web): 正常合入的修复"]
        self.assertEqual([c.subject for c in changelog.read_commits(self.root, "v0.1.0..HEAD")], expected)
        self.assertEqual(changelog.version_bump.subjects_in(self.root, "v0.1.0..HEAD"), expected)

    def test_master_commits_the_recorded_branch_merged_in_still_count(self):
        self.commit("fix(web): 标签之后的主线修复")
        self.git("checkout", "-q", "-b", "community")
        self.git("merge", "-q", "--no-ff", "-m", "Merge master into community", "master")
        self.commit("feat(web): 对方的整套译文")
        self.git("checkout", "-q", "master")
        self.git("merge", "-q", "-s", "ours", "--no-ff", "-m", "chore(i18n): 记入社区译法", "community")
        self.assertEqual([c.subject for c in changelog.read_commits(self.root, "v0.1.0..HEAD")],
                         ["fix(web): 标签之后的主线修复"])


class DueTests(unittest.TestCase):
    """该不该发下一版。判据只看使用者那一侧，不看集成了多少次。"""

    def _due(self, subjects, *, days):
        commits = [Commit(subject, "") for subject in subjects]
        with mock.patch.object(changelog, "read_commits", return_value=commits), \
                mock.patch.object(changelog, "_waiting_days", return_value=days), \
                mock.patch.object(changelog.version_bump, "release_range",
                                  return_value="v0.1.0..HEAD"):
            return changelog.due(Path("."))

    def test_a_hundred_refactors_are_zero_changes_to_a_user(self):
        """这条判据要跟「集成了多少次」分开，不然又变成按工作量发版。"""
        found = self._due([f"refactor(web): 第 {n} 次收口" for n in range(100)], days=30)
        self.assertEqual((found["entries"], found["due"], found["why"]), (0, False, []))

    def test_the_weekly_slot_needs_something_to_put_in_it(self):
        subjects = ["fix(web): 修一处"]
        self.assertFalse(self._due(subjects, days=changelog.DUE_DAYS - 1)["due"])
        ripe = self._due(subjects, days=changelog.DUE_DAYS)
        self.assertTrue(ripe["due"])
        self.assertIn(f"距上一版 {changelog.DUE_DAYS} 天", ripe["why"][0])

    def test_enough_entries_do_not_wait_for_the_slot(self):
        subjects = [f"feat(web): 第 {n} 件事" for n in range(changelog.DUE_ENTRIES)]
        found = self._due(subjects, days=0)
        self.assertTrue(found["due"])
        self.assertIn("不必等满周期", found["why"][0])

    def test_breaking_changes_and_security_fixes_never_wait(self):
        for subject, group in (("feat(config)!: 换掉盘符键", changelog.BREAKING),
                               ("fix(security): 凭据不再进日志", changelog.SECURITY_GROUP)):
            with self.subTest(group=group):
                found = self._due([subject], days=0)
                self.assertTrue(found["due"])
                self.assertIn(group, found["why"][-1])
                self.assertIn("不等周期", found["why"][-1])

    def test_the_counts_it_reports_are_what_calibrates_the_threshold(self):
        """阈值是没有样本时的起点，所以每次都要把实际值报出来。"""
        found = self._due(["feat: 甲", "fix: 乙", "fix: 丙"], days=2)
        self.assertEqual((found["entries"], found["days"]), (3, 2))
        self.assertEqual(found["groups"], {"Added": 1, "Fixed": 2})


class ShippedChangelogTests(unittest.TestCase):
    """仓库里那份 `CHANGELOG.md` 自己要符合脚本认的形状。"""

    def setUp(self):
        self.document = (Path(changelog.ROOT) / changelog.CHANGELOG).read_text(encoding="utf-8")

    def test_the_anchors_the_release_entry_needs_are_all_present(self):
        self.assertRegex(self.document, r"(?m)^## \[Unreleased\]$")
        self.assertRegex(self.document, r"(?m)^\[Unreleased\]: https://github\.com/")
        self.assertIn("keepachangelog.com", self.document)
        self.assertIn("semver.org", self.document)

    def test_every_released_section_carries_an_iso_date(self):
        headings = [line for line in self.document.splitlines()
                    if line.startswith("## [") and not line.startswith(f"## [{changelog.UNRELEASED}]")]
        self.assertTrue(headings, "至少要留一节已发布版本，compare 链条才接得上")
        for heading in headings:
            with self.subTest(heading=heading):
                self.assertRegex(heading, r"^## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}$")

    def _released_versions(self):
        return re.findall(r"(?m)^## \[(\d+\.\d+\.\d+)\]", self.document)

    def test_every_released_section_has_its_compare_link(self):
        for version in self._released_versions():
            with self.subTest(version=version):
                self.assertRegex(self.document,
                                 rf"(?m)^\[{re.escape(version)}\]: https://github\.com/")

    def test_the_unreleased_section_already_passes_the_release_checks(self):
        """分支写进「未发布」的条目在合入前就按定版的检查过一遍，缺编号、超长不留到发版时才发现。"""
        changelog.require_labeled_entries(self.document, changelog.UNRELEASED)

    def test_every_released_section_passes_the_bilingual_checks(self):
        """历史版本也是英文在前：应用和 Release 页按同一规则拆分，旧版本不留只有中文的行。"""
        for version in self._released_versions():
            with self.subTest(version=version):
                changelog.require_labeled_entries(self.document, version)

    def test_released_sections_run_newest_first(self):
        keys = [tuple(int(part) for part in version.split("."))
                for version in self._released_versions()]
        self.assertEqual(keys, sorted(keys, reverse=True))


if __name__ == "__main__":
    unittest.main()
