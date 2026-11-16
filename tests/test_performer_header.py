"""女优页头：五项资料与按名义分组的别名（ADR-0069），读的是 `performer_profile`（ADR-0067）。

全程临时账本，不联网。资料行由补女优资料后继的写入函数写下，页面是 minnano-av 504478
（篠田ゆう）与 494354（釈アリス）的真实页面裁剪而成，只留解析会读到的 canonical、`<h1>`
与资料表。
"""
import sqlite3
import tempfile
import unittest
from datetime import date
from pathlib import Path

from peach import minnano_av, performer_header, performer_name_display
from peach import web_contract as rm_web
from peach.entities import normalize_entity_name
from peach.genre_decisions import record_genre_decision
from peach.performer_profiles import read_profile, write_profile
from peach.web_entity import q_entity_shapes
from support.ledger import fresh_ledger

STAMP = "2026-09-24T00:00:00.000Z"
TODAY = date(2026, 9, 25)

SHINODA = """<!doctype html><html lang="ja"><head>
<link rel="canonical" href="https://www.minnano-av.com/actress504478.html">
</head><body>
<h1>篠田ゆう<span>しのだゆう / Shinoda Yu</span></h1>
<div class="act-profile">
<table width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td><h2>篠田ゆう （しのだゆう / Shinoda Yu）</h2></td></tr>
<tr><td><span>別名</span><p>篠崎ゆう子 （しのざきゆうこ / Shinozaki Yuuko）</p></td></tr>
<tr><td><span>別名</span><p>高木早希（ラグジュTV) （たかぎさき / Takagi Saki）</p></td></tr>
<tr><td><span>別名</span><p>桧山彩音（舞ワイフ） （ひやまあやね / Hiyama Ayane）</p></td></tr>
<tr><td><span>別名</span><p>橋本真紀（舞ワイフ） （はしもとまき / Hashimoto Maki）</p></td></tr>
<tr><td><span>別名</span><p>篠田杏奈（舞ワイフ） （しのだあんな / Shinoda Anna）</p></td></tr>
<tr><td><span>生年月日</span><p>1991年07月21日
  （現在 <a href="actress_list.php?birthday=1991-07-21">35歳</a>）かに座</td>		</p></td></tr>
<tr><td><span>サイズ</span><p>T155 / B86(<a href="actress_list.php?cup=F">Fカップ</a>) / W60 / H87 / S22</p></td></tr>
<tr><td><span>血液型</span><p><a href="actress_list.php?blood_type=O">O型</a></p></td></tr>
<tr><td><span>AV出演期間</span><p>2010年～2023年</p></td></tr>
<tr><td><span>デビュー作品</span><p>セキララ 〜今どき世代のゆるい性事情〜 03（2010年12月 02日）</p></td></tr>
<tr valign="top"><td><span>タグ</span><div class="tagarea">
<a href="actress_list.php?tag_a_id=28">美乳</a>
<a href="actress_list.php?tag_a_id=43">美尻</a>
<a href="actress_list.php?tag_a_id=238">レズ</a>
</td></tr>
</table></div></body></html>"""

ALICE = """<!doctype html><html lang="ja"><head>
<link rel="canonical" href="https://www.minnano-av.com/actress494354.html">
</head><body>
<h1>釈アリス<span>しゃくありす / Shaku Alice</span></h1>
<div class="act-profile">
<table width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td><span>サイズ</span><p>T169 / B88(<a href="actress_list.php?cup=E">Eカップ</a>) / W57 / H95 / S</p></td></tr>
<tr><td><span>AV出演期間</span><p>2024年-</p></td></tr>
</table></div></body></html>"""


class NameEntryTests(unittest.TestCase):
    def test_alias_annotation_cells_have_no_names(self):
        for marker in ("(注)", "（注）", "【注】"):
            with self.subTest(marker=marker):
                self.assertEqual(minnano_av.name_entries(
                    f"<p>{marker}現在は”楓カレン”が正式女優名です。…復活！！ （ / ）</p>"), [])

    def test_alias_cells_split_names_and_carry_their_channel_note(self):
        self.assertEqual(
            [(entry["name"], entry["note"], entry["reading"]) for entry in
             minnano_av.name_entries("<p>橋本真紀&amp;桧山彩音（舞ワイフ名義）</p>")],
            [("橋本真紀", "舞ワイフ", ""), ("桧山彩音", "舞ワイフ", "")])
        # 读音栏里填的是店名：按注记收，不当读音。
        self.assertEqual(minnano_av.name_entries("<p>あいな （吉原ソープ 薔薇の園 / Aina）</p>"),
                         [{"name": "あいな", "reading": "", "romaji": "Aina",
                           "note": "吉原ソープ 薔薇の園"}])
        self.assertEqual(minnano_av.name_entries("美雲そら【旧名】 （みくもそら / Mikumo Sora）")[0]
                         ["note"], "")

    def test_the_raw_cells_keep_the_main_name_of_the_page(self):
        """现名那一组要页面主名；它不在资料表里，另记在原文的「名前」下。"""
        self.assertEqual(minnano_av.profile(SHINODA)["raw"]["名前"], "篠田ゆう")


class Case(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.db = fresh_ledger(self.root)
        self.connection = sqlite3.connect(self.db)
        self.addCleanup(self.connection.close)

    def entity(self, name: str, *aliases) -> int:
        with self.connection:
            cursor = self.connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer',?,?,?,?)", (name, normalize_entity_name(name), STAMP, STAMP))
            entity_id = int(cursor.lastrowid)
            for written, source in aliases:
                self.connection.execute(
                    "INSERT INTO entity_alias(entity_id,alias,normalized_alias,source)"
                    " VALUES(?,?,?,?)", (entity_id, written, normalize_entity_name(written), source))
        return entity_id

    def land(self, entity_id: int, page: str) -> None:
        with self.connection:
            write_profile(self.connection, entity_id, minnano_av.profile(page),
                          source="auto:performer-profile@1", source_url="https://example.invalid/",
                          fetched_at=STAMP)

    def header(self, entity_id: int, canonical: str) -> dict:
        return performer_header.header(self.connection, entity_id, canonical, today=TODAY)


class HeaderTests(Case):
    def test_chinese_display_keeps_original_stage_names_and_only_changes_confirmed_glyphs(self):
        for original, chinese in [('宮澤寧音', '宫泽宁音'), ('山田鈴奈', '山田铃奈'),
                                  ('本郷愛', '本乡爱'), ('天使萌', '天使萌'),
                                  ('篠田优', '篠田优'), ('槙泉奈', '槙泉奈')]:
            with self.subTest(original=original):
                page = {'name': original, 'aliases': []}
                result = performer_name_display.writing(original, page, 'https://example.invalid/')
                self.assertEqual(result['zh_cn'], chinese)
                self.assertEqual(result['ja'], original)
                self.assertEqual(page['name'], original)

    def test_display_writings_keep_stage_names_and_raw_aliases_separate(self):
        aliases = [('楓カレン', 'avdb'), ('田中柠檬', 'user:alias'),
                   ('田中レモン', 'avdb'), ('かえでかれん', 'r18:performer'),
                   ('Kaede Karen', 'r18:performer'), ('FC2', 'avdb'),
                   ('楓カレン（旧名）', 'avdb')]
        entity_id = self.entity('枫花恋', *aliases)
        profile = {'kana': 'かえでかれん', 'raw': {'名前': '楓カレン', '別名': [
            '楓カレン （かえでかれん / Kaede Karen）',
            '田中レモン(旧名) （たなかれもん / Tanaka Remon）']}}
        with self.connection:
            write_profile(self.connection, entity_id, profile, source='auto:performer-profile@1',
                          source_url='https://example.invalid/', fetched_at=STAMP)
        before = list(self.connection.iterdump())
        rows = [{'alias': name, 'source': source} for name, source in aliases]
        result = performer_name_display.display(self.connection, entity_id, '枫花恋', rows,
                                                self.header(entity_id, '枫花恋')['name_groups'])
        self.assertEqual(result['choices']['zh-CN'], [
            {'value': '枫花恋', 'label': '枫花恋'}, {'value': '田中柠檬', 'label': '田中柠檬'}])
        self.assertEqual(result['choices']['ja'], [
            {'value': '枫花恋', 'label': '楓カレン'}, {'value': '田中レモン', 'label': '田中レモン'}])
        self.assertEqual(result['groups']['zh-CN']['shown'], ['田中柠檬'])
        self.assertEqual(result['current']['ja'], '楓カレン')
        historical = performer_name_display.display(self.connection, entity_id, '田中柠檬', rows, None)
        self.assertEqual(historical['current']['ja'], '田中レモン')
        self.assertEqual(before, list(self.connection.iterdump()))
        with self.connection:
            self.connection.execute('INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id) '
                                    "VALUES(?,'javdb','performer','sample')", (entity_id,))
        self.connection.row_factory = sqlite3.Row
        variants = performer_name_display.variants(self.connection)
        self.assertEqual([(row['id'], row['canonical_name'], row['zh_cn'], row['ja']) for row in variants],
                         [(entity_id, '枫花恋', '枫花恋', '楓カレン')])

    def test_variants_carry_the_profile_romaji_as_english_display(self):
        """`en` 取资料罗马字，资料没有时取登记的拉丁别名；都没有的人明确留空。"""
        named = self.entity('楓カレン', ('Kaede Karen', 'user:alias'))
        plain = self.entity('篠田ゆう')
        with self.connection:
            write_profile(self.connection, named,
                          {'romaji': 'Karen Kaide', 'raw': {'名前': '楓カレン', '別名': []}},
                          source='auto:performer-profile@1', source_url='https://example.invalid/',
                          fetched_at=STAMP)
            for person in (named, plain):
                self.connection.execute(
                    'INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id) '
                    "VALUES(?,'javdb','performer',?)", (person, f'sample{person}'))
        self.connection.row_factory = sqlite3.Row
        variants = {row['id']: row for row in performer_name_display.variants(self.connection)}
        self.assertEqual(variants[named]['en'], 'Karen Kaide')
        self.assertIsNone(variants[plain]['en'])

    def test_missing_translation_keeps_current_spelling_and_latin_stage_names(self):
        entity_id = self.entity('篠田ゆう', ('Alice', 'user:alias'))
        self.land(entity_id, SHINODA)
        result = performer_name_display.display(self.connection, entity_id, '篠田ゆう',
                                                [{'alias': 'Alice', 'source': 'user:alias'}], None)
        self.assertIsNone(result['current']['zh_cn'])
        self.assertEqual(result['choices']['zh-CN'][0], {'value': '篠田ゆう', 'label': '篠田ゆう'})
        latin = performer_name_display.writing('Alice', {'name': '', 'aliases': []}, '')
        self.assertEqual((latin['zh_cn'], latin['ja']), ('Alice', 'Alice'))

    def test_cached_alias_annotations_stay_in_raw_profile_only(self):
        entity_id = self.entity("枫花恋", ("楓カレン", "avdb"),
                                ("田中レモン", "auto:performer-alias@1"))
        annotation = '(注)現在は”楓カレン”が正式女優名です。…復活！！ （ / ）'
        profile = {
            "kana": "かえでかれん", "raw": {
                "名前": "楓カレン", "別名": [
                    "楓カレン （かえでかれん / Kaede Karen）",
                    "田中レモン(旧名) （たなかれもん / Tanaka Remon）", annotation]}}
        with self.connection:
            write_profile(self.connection, entity_id, profile,
                          source="auto:performer-profile@1", source_url="https://example.invalid/",
                          fetched_at=STAMP)
        groups = self.header(entity_id, "枫花恋")["name_groups"]
        self.assertEqual(groups["shown"], ["楓カレン", "田中レモン"])
        self.assertEqual(groups["total"], 2)
        self.assertEqual([(group["label"], [entry["name"] for entry in group["names"]])
                          for group in groups["groups"]],
                         [("现名", ["楓カレン"]), ("旧名义", ["田中レモン"])])
        raw = read_profile(self.connection, entity_id)["raw"]
        self.assertIn(annotation, raw["別名"])

    def test_five_facts_and_the_name_groups_of_the_header(self):
        shinoda = self.entity(
            "篠田优", ("篠田ゆう", "avdb"), ("Yu Shinoda", "r18:performer"),
            ("しのだゆう", "r18:performer"), ("篠田杏奈", "user:alias"), ("城田優子", "auto:x@1"),
            ("ゆうちゃん企画", "javinizer:planning-alias"))
        self.land(shinoda, SHINODA)
        head = self.header(shinoda, "篠田优")
        self.assertEqual(head["profile"], {
            "birth_date": "1991-07-21", "age": 35, "height": 155, "bust": 86, "waist": 60,
            "hip": 87, "cup": "F", "debut_date": "2010-12-02",
            "debut_title": "セキララ 〜今どき世代のゆるい性事情〜 03",
            "active": {"from": 2010, "to": 2023}, "tags": ["美乳", "美臀", "百合"]})
        groups = head["name_groups"]
        self.assertEqual(groups["reading"], "しのだゆう")
        self.assertEqual(groups["shown"], ["篠田ゆう", "篠崎ゆう子", "高木早希"])
        self.assertEqual(groups["total"], 7)
        self.assertEqual([(group["label"], [entry["name"] for entry in group["names"]])
                          for group in groups["groups"]],
                         [("现名", ["篠田ゆう"]), ("旧名义", ["篠崎ゆう子"]),
                          ("舞ワイフ", ["桧山彩音", "橋本真紀", "篠田杏奈"]),
                          ("ラグジュTV", ["高木早希"]), ("其它", ["城田優子"])])
        self.assertEqual(groups["groups"][0]["names"][0]["reading"], "しのだゆう")

    def test_an_open_ended_period_is_still_active(self):
        alice = self.entity("释爱丽丝")
        self.land(alice, ALICE)
        profile = self.header(alice, "释爱丽丝")["profile"]
        self.assertEqual(profile["active"], {"from": 2024, "ongoing": True})
        self.assertEqual((profile["height"], profile["cup"]), (169, "E"))
        self.assertNotIn("birth_date", profile)

    def test_without_a_profile_the_ledger_aliases_form_one_untitled_group(self):
        alice = self.entity("释爱丽丝", ("Alice Shaku", "avdb"), ("しゃくありす", "avdb"),
                            ("釈アリス", "avdb"))
        head = self.header(alice, "释爱丽丝")
        self.assertEqual(head["profile"], {})
        self.assertEqual(head["name_groups"], {
            "reading": "しゃくありす", "shown": ["釈アリス"], "total": 1,
            "groups": [{"label": "", "names": [{"name": "釈アリス"}]}]})

    def test_site_tags_speak_peach_chinese_and_follow_the_user_decisions(self):
        raw = ["美人", "美少女", "清楚", "巨尻", "美尻", "ロリ→ギャル", "美乳美尻",
               "カリビアン", "まだ知らない分類", "  "]
        self.assertEqual(performer_header.site_tags(raw),
                         ["高颜值", "清纯", "巨臀", "美臀", "萝莉→辣妹", "美乳", "まだ知らない分類"])
        with self.connection:
            record_genre_decision(self.connection, "剛毛", "浓密阴毛", STAMP)
            record_genre_decision(self.connection, "美尻", None, STAMP)
        shinoda = self.entity("篠田优")
        self.land(shinoda, SHINODA.replace(">レズ<", ">剛毛<"))
        self.assertEqual(self.header(shinoda, "篠田优")["profile"]["tags"], ["美乳", "浓密阴毛"])

    def test_age_turns_on_the_birthday(self):
        self.assertEqual(performer_header.age_on("1991-07-21", date(2026, 7, 20)), 34)
        self.assertEqual(performer_header.age_on("1991-07-21", date(2026, 7, 21)), 35)
        self.assertIsNone(performer_header.age_on("1991-07", date(2026, 7, 21)))

    def test_a_ledger_before_migration_0036_still_serves_the_header(self):
        shinoda = self.entity("篠田优", ("篠田ゆう", "avdb"))
        with self.connection:
            self.connection.execute("DROP TABLE performer_profile")
        head = self.header(shinoda, "篠田优")
        self.assertEqual(head["profile"], {})
        self.assertEqual(head["name_groups"]["shown"], ["篠田ゆう"])
        self.assertEqual(performer_header.profiled(self.connection), set())


class ApiTests(Case):
    def test_the_entity_api_and_the_skeleton_shapes_carry_the_profile(self):
        shinoda = self.entity("篠田优", ("篠田ゆう", "avdb"))
        self.land(shinoda, SHINODA)
        (self.root / "logos").mkdir()
        (self.root / "avatars").mkdir()
        contract = rm_web.WebContract(self.db, avatar_root=self.root / "avatars",
                                      logo_root=self.root / "logos")
        page = rm_web.q_entity(contract, {"kind": "performer", "name": "篠田优"})
        self.assertEqual(page["profile"]["cup"], "F")
        self.assertEqual(page["name_groups"]["shown"][0], "篠田ゆう")
        shapes = q_entity_shapes(contract, {})
        parts = {item["id"]: item["parts"] for item in shapes["entities"]}
        self.assertIn("facts", parts[shinoda])

    def test_aliases_the_user_added_show_in_both_name_languages(self):
        """手添的别名在名称菜单和名字那一行里两种语言都列；采集来的读音、罗马字、括号写法照旧不列。"""
        added = ["ゆうちゃん", "篠田小优", "Yuu S", "篠田（旧）"]
        scraped = ["Yu Shinoda", "しのだゆう", "篠田ゆう（企画）", "FC2"]
        (self.root / "logos").mkdir()
        (self.root / "avatars").mkdir()
        contract = rm_web.WebContract(self.db, avatar_root=self.root / "avatars",
                                      logo_root=self.root / "logos")
        for profiled in (True, False):
            canonical = "篠田优" if profiled else "新人优"
            with self.subTest(profile=profiled):
                person = self.entity(canonical, ("篠田ゆう", "avdb"), ("Yu Shinoda", "avdb"),
                                     ("しのだゆう", "r18:performer"), ("篠田ゆう（企画）", "avdb"),
                                     ("FC2", "avdb"))
                with self.connection:
                    self.connection.execute(
                        "INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id)"
                        " VALUES(?,'javdb','performer',?)", (person, f"sample-{person}"))
                if profiled:
                    self.land(person, SHINODA)
                for alias in added:
                    receipt = rm_web.w_entity_alias(
                        contract, {"kind": "performer", "name": canonical, "alias": alias})
                    self.assertTrue(receipt["added"])
                page = rm_web.q_entity(contract, {"kind": "performer", "name": canonical})
                display = page["name_display"]
                for language in ("zh-CN", "ja"):
                    labels = [choice["label"] for choice in display["choices"][language]]
                    values = [choice["value"] for choice in display["choices"][language]]
                    groups = display["groups"][language]
                    line = [entry["name"] for group in groups["groups"] for entry in group["names"]]
                    for alias in added:
                        self.assertIn(alias, labels, language)
                        self.assertIn(alias, values, language)
                        self.assertIn(alias, line, language)
                    for alias in scraped:
                        self.assertNotIn(alias, labels, language)
                        self.assertNotIn(alias, line, language)
                    self.assertEqual(groups["total"], len(line))
                    self.assertEqual(len(line), len(set(line)), language)
                if profiled:
                    # 资料页上的名义照旧在前，手添的接在「其它」组里。
                    ja = display["groups"]["ja"]
                    self.assertEqual(ja["shown"], ["篠田ゆう", "篠崎ゆう子", "桧山彩音"])
                    self.assertEqual((ja["groups"][-1]["label"],
                                      sorted(entry["name"] for entry in ja["groups"][-1]["names"])),
                                     ("其它", sorted(added)))


if __name__ == "__main__":
    unittest.main()
