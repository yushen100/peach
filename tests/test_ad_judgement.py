"""广告复核队列的判据回归。

样本全部来自 2026-08-15 的真实误判与用户手工标记的真广告：命中推广词本身
不是证据，要看剥掉推广词后还剩不剩内容。
"""
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest import mock

from peach import junk, web_batch
from peach.web_contract import (
    BUNDLE_DIR_ASSETS,
    CONTENT_BYTES,
    PART_MARK,
    PROMO_CLUSTER_FILES,
    PROMO_DOMAIN,
    PROMO_PHRASE,
    REAL_CODE,
    WebContract,
    has_sibling_original,
    promo_residue,
    q_ads,
    q_items,
    w_batch,
)
from support.ledger import fresh_ledger


def promo_hit(name: str) -> bool:
    return bool(PROMO_PHRASE.search(name) or PROMO_DOMAIN.search(name))


class AdJudgementTests(unittest.TestCase):
    #: 用户手工标记为待删的真广告，名字剥完应当基本不剩内容。
    REAL_ADS = (
        "点击观看 房间火爆",
        "国产大片",
        "女神在线视频www.55h.me",
        "澳门皇冠赌场~vip0955.com",
        "tuu26.com",
        "极欲鬼滅之刃366gm.com",
        "苍老师强力推荐",
        "全中文AV在线观看【9se.tv】",
        "【91狼友之家91home.cc】4",
    )

    #: 真实内容，只是被打了站点水印或剧情里出现了推广同形词。
    REAL_CONTENT = (
        "1248 - #饭饭吖 NTR剧情_给单男口交深喉，被母狗式爆操，还要微信跟老公汇报战果",
        "236953.xyz 推特新晋4年绿帽美腿淫妻网黄「一个ren」《榨精美足》"
        "谁能在这美妙的裸足压榨下保持不败",
        "No.017 - 서서 펠라_뒤치기【02분 34초】",
    )

    def test_real_ads_have_nothing_left_after_stripping_promo(self):
        for name in self.REAL_ADS:
            with self.subTest(name=name):
                self.assertTrue(promo_hit(name), "应命中推广词或域名")
                self.assertLess(promo_residue(name), 14,
                                "广告名剥完不应还剩大段实质描述")

    def test_watermarked_content_keeps_its_description(self):
        """名字里有域名/推广同形词，但正文是真实描述，必须留下足够残留。"""
        for name in self.REAL_CONTENT:
            with self.subTest(name=name):
                self.assertGreaterEqual(
                    promo_residue(name), 14,
                    "真实内容剥完仍应剩下可观描述，否则会被当成广告")

    def test_plot_word_is_not_a_contact_method(self):
        """“微信跟老公汇报战果”是剧情；“加微信”“微信号”才是联系方式。"""
        self.assertIsNone(PROMO_PHRASE.search("还要微信跟老公汇报战果"))
        self.assertIsNotNone(PROMO_PHRASE.search("加微信看完整版"))
        self.assertIsNotNone(PROMO_PHRASE.search("微信号：abc123"))

    def test_domain_is_detected_when_followed_by_a_word_character(self):
        """`uuc82.com_2` 用 \\b 收尾会漏：m 与 _ 都是词字符，构不成边界。"""
        self.assertIsNotNone(PROMO_DOMAIN.search("妹妹在精彩表演 哥哥快来大饱眼福uuc82.com_2"))
        self.assertIsNotNone(PROMO_DOMAIN.search("星空天使ccc.18my.cc"))
        self.assertIsNone(PROMO_DOMAIN.search("普通标题 没有站点"))

    def test_only_real_codes_drive_the_longer_version_rule(self):
        """RAIKUN325 是被误填进 code 的创作者账号，不能拿来比时长。"""
        self.assertIsNone(REAL_CODE.match("RAIKUN325"))
        self.assertIsNotNone(REAL_CODE.match("ABW-153"))
        self.assertIsNotNone(REAL_CODE.match("259LUXU-1141"))
        self.assertIsNotNone(REAL_CODE.match("FC2-PPV-1234567"))

    def test_disposal_marks_mix_two_different_intents(self):
        """`disposal` 同时承载“这是广告”和“这个我不喜欢”，不能当纯广告标注集。

        用户 2026-08-15 澄清：`1726897607_*` 那批 10 个时间戳命名的长录像被标删，
        是因为不喜欢该来源，与广告无关。判据不该、也不可能识别出这类。
        """
        for name in ("1726897607_1726897607_20250831-214903",
                     "1726897607_1726897607_20250823-215124"):
            with self.subTest(name=name):
                self.assertFalse(promo_hit(name), "时间戳文件名不含推广特征")

    def test_part_markers_still_protect_split_volumes(self):
        for name in ("Movie CD2", "feature part1", "作品 分卷", "title-2", "title (3)"):
            with self.subTest(name=name):
                self.assertIsNotNone(PART_MARK.search(name))

    def test_game_interstitial_padding_does_not_count_as_content(self):
        """手游插页的残留全是固定套话，2026-09-03 之前它们把分数压到门槛以下。

        `WAAA-415-uncensored-HD` 目录里这批图命中「扫码」，可剥完剩下的是
        「免费18禁手游」「安装」——一个内容字都没有，却让残留数越算越高。
        """
        for name in ("爱姬远征-免费18禁手游-扫码安装",
                     "天下布魔-免费18禁手游-扫码安装",
                     "工口.R18-成人遊戲-免费18禁手游-扫码安装",
                     "工口MH-扫描访问",
                     "QR CODE--扫一扫"):
            with self.subTest(name=name):
                self.assertTrue(promo_hit(name), "应命中推广词")
                self.assertLess(promo_residue(name), 6,
                                "剥完只剩游戏名，不该算作实质描述")

    def test_filler_words_alone_are_not_evidence(self):
        """「免费」「手游」「安装」只降低残留，自己不构成命中。

        真片名里也有这些词（`免费` 尤其常见），拿它们当命中依据就等于按题材删片。
        """
        for name in ("免费的午后 上门安装师傅", "手游主播的私拍"):
            with self.subTest(name=name):
                self.assertFalse(promo_hit(name))

    def test_shot_tail_only_strips_the_thumbnail_suffix(self):
        """`MIAD573_02_s` 要退回 `MIAD573_02`，不能退到 `MIAD573`：那是另一条正片。"""
        self.assertTrue(has_sibling_original("MIAD573_02_s", {"miad573_02"}))
        self.assertTrue(has_sibling_original("BNST-033-cover", {"bnst-033"}))
        self.assertFalse(has_sibling_original("MIAD573_02_s", {"miad573"}))
        self.assertFalse(has_sibling_original("别的广告图", {"miad573_02"}))

    def test_poster_suffix_pairs_with_the_disc_it_belongs_to(self):
        """`pl`／`ps` 是 JAV 海报的通用写法，`lxvs006pl` 要配上 `LXVS006-BD`。

        配对时剥掉的载体尾巴（`-BD`）在索引一侧完成，这里只验证海报尾巴。
        """
        self.assertTrue(has_sibling_original("lxvs006pl", {"lxvs006"}))
        self.assertTrue(has_sibling_original("lxvs006ps", {"lxvs006"}))
        self.assertFalse(has_sibling_original("lxvs006pl", {"cawd241"}))

    def test_content_threshold_is_far_above_any_promo_image(self):
        """插页整包加起来不到 10 MB；判据只要不把这类体积算成内容就够。"""
        self.assertGreaterEqual(CONTENT_BYTES, 512 * 1024**2)


class ResourceJunkQueueTests(unittest.TestCase):
    """物理资源都要经过垃圾判断，类型不能成为免检条件。"""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.db_path = fresh_ledger(Path(self.temporary.name).resolve())
        self.contract = WebContract(self.db_path)

    def add(self, asset_id, location, path, medium, size=1000, duration=None,
            creator=None, disposal=None, code=None):
        connection = sqlite3.connect(self.db_path)
        try:
            connection.execute(
                "INSERT INTO asset(id,location,path,name,medium,size,duration,creator,disposal,code) "
                "VALUES(?,?,?,?,?,?,?,?,?,?)",
                (asset_id, location, path, path.rsplit("\\", 1)[-1], medium,
                 size, duration, creator, disposal, code),
            )
            connection.commit()
        finally:
            connection.close()

    def test_automatic_isolation_requires_a_scope_and_observes_source_and_directory_boundaries(self):
        for aid, location, folder in ((1, 'local', 'media'), (2, 'local', 'media2'), (3, '115', 'media')):
            self.add(aid, location, rf'R:\{folder}\点击进入.url', 'other')
        with self.assertRaises(ValueError):
            junk.isolate(self.db_path)
        self.assertEqual(junk.isolate(self.db_path, asset_ids=[])['isolated'], 0)
        self.assertEqual(junk.isolate(self.db_path, roots=[])['isolated'], 0)
        checked = junk.isolate(self.db_path, roots=[('local', r'r:\MEDIA')])
        self.assertEqual(checked['ids'], [1])
        self.assertEqual(junk.isolate(self.db_path, roots=[('local', r'R:\media')])['isolated'], 0)
        with self.contract.read_connection() as connection:
            self.assertEqual([tuple(row) for row in connection.execute(
                'SELECT id,disposal,disposal_reason FROM asset ORDER BY id')],
                [(1, 'trash', 'junk'), (2, None, None), (3, None, None)])

    def test_automatic_isolation_preserves_user_choices_records_subtitles_and_main_identity(self):
        for aid in range(1, 8):
            self.add(aid, 'local', rf'R:\media\{aid}\点击进入.url', 'other')
        self.add(8, 'local', r'R:\media\123.com-ABC-123.mp4', 'video', 2000, 5)
        with self.contract.database.write_transaction() as connection:
            connection.execute("UPDATE asset SET feedback='like' WHERE id=1")
            connection.execute('UPDATE asset SET play_count=1 WHERE id=2')
            connection.execute("INSERT INTO watch_queue(profile_id,asset_id,added_at) VALUES('local-default',3,'now')")
            connection.execute("INSERT INTO asset_subtitle(asset_id,location,path,name,format,pairing,first_seen,last_seen) "
                               "VALUES(4,'local','R:\\media\\sub.srt','sub.srt','srt','exact','now','now')")
        w_batch(self.contract, {'ids': [5], 'operation': 'dismiss-junk'})
        checked = junk.isolate(self.contract.database, asset_ids=list(range(1, 9)), protected_ids=[6])
        self.assertEqual(checked['ids'], [7])
        w_batch(self.contract, {'ids': [7], 'operation': 'restore'})
        w_batch(self.contract, {'ids': [7], 'operation': 'dismiss-junk'})
        self.assertEqual(junk.isolate(self.db_path, asset_ids=[7])['isolated'], 0)

    def test_isolation_rechecks_evidence_after_scoring(self):
        self.add(1, 'local', r'R:\media\点击进入.url', 'other')
        original = junk.scored_candidates
        def score_then_change(*args, **options):
            result = original(*args, **options)
            with self.contract.database.write_transaction() as connection:
                connection.execute("UPDATE asset SET name='notes.txt' WHERE id=1")
            return result
        with mock.patch.object(junk, 'scored_candidates', side_effect=score_then_change):
            self.assertEqual(junk.isolate(self.db_path, asset_ids=[1])['isolated'], 0)

    def test_unmeasured_and_failed_videos_await_review(self):
        for aid, duration in enumerate((None, 0, -1), 1):
            self.add(aid, 'local', rf'R:\media\{aid}\点击进入.mp4', 'video', 1000, duration)
        result = junk.isolate(self.db_path, asset_ids=[1, 2, 3])
        self.assertEqual((result['isolated'], result['review']), (0, 3))

    def test_short_attachment_structure_stays_in_review_during_automatic_processing(self):
        self.release_with_shorts(r'B:\发行物\正片标题')
        checked = junk.isolate(self.db_path, roots=[('115', r'B:\发行物')])
        self.assertEqual((checked['isolated'], checked['review']), (0, 3))

    def test_video_image_audio_archive_and_url_shortcut_are_all_judged(self):
        self.add(1, "115", r"B:\广告\tuu26.com.mp4", "video",
                 10 * 1024**2, 60)
        self.add(2, "115", r"B:\番号\CAWD-241\亚博体育hayob9.com.jpg", "image", 28725)
        self.add(3, "pikpak", r"A:\资源\点击这里.url", "other", 128)
        self.add(4, "local", r"R:\media\福利群vip0955.com.zip", "archive", 2048)
        self.add(5, "local", r"R:\media\苍老师强力推荐.mp3", "audio", 4096)
        # 域名属于作品出处且仍有长内容描述，不是推广垃圾。
        self.add(
            6, "115",
            r"B:\创作者\Dakota Doll - [LegalPorno.com] - [2024] - Breakfast Sex.mp4.jpg",
            "image", 280000, creator="Dakota Doll",
        )
        # online 的 path 本来就是 URL，不是等待清理的物理快捷方式。
        self.add(7, "online", "https://example.com/post/1.url", "other", 0)

        result = q_ads(self.contract, limit=200)

        self.assertEqual(result["total"], 5)
        self.assertEqual(
            {item["medium"] for item in result["items"]},
            {"video", "image", "audio", "archive", "other"},
        )
        by_id = {item["id"]: item for item in result["items"]}
        self.assertIn("网址快捷方式", by_id[3]["why"])
        self.assertEqual(by_id[3]["junk_kind"], "url")
        self.assertIn("整个名字都是推广语", by_id[2]["why"])
        self.assertNotIn(6, by_id)
        self.assertNotIn(7, by_id)
        self.assertTrue(all("path" not in item for item in result["items"]))

    def test_each_page_names_its_media_library_from_the_current_settings(self):
        self.add(3, "pikpak", r"A:\资源\点击这里.url", "other", 128)

        def owned_by(library):
            return lambda config, path: {"library_id": library} if path == r"A:\资源\点击这里.url" else {}

        with mock.patch.object(web_batch.settings_file, "active", return_value=object()), \
                mock.patch("peach.media_identity.ownership", side_effect=owned_by("lib-a")):
            first = q_ads(self.contract)["items"]
        # 评分缓存只随账本表失效；媒体库归属按取页那一刻的设置算，换了设置下一次取就跟着换。
        with mock.patch.object(web_batch.settings_file, "active", return_value=object()), \
                mock.patch("peach.media_identity.ownership", side_effect=owned_by("lib-b")):
            second = q_ads(self.contract)["items"]
        self.assertEqual([item["library_id"] for item in first], ["lib-a"])
        self.assertEqual([item["library_id"] for item in second], ["lib-b"])
        self.assertTrue(all("path" not in item and "_path" not in item for item in first + second))

    def disposals(self):
        with closing(sqlite3.connect(self.db_path)) as connection:
            return dict(connection.execute("SELECT id, disposal_reason FROM asset WHERE disposal='trash'").fetchall())

    def test_dispose_all_moves_every_undecided_item_of_the_kind_beyond_one_page(self):
        # 网址快捷方式在媒体目录里直接进待判断：造 205 条，比页面一次取回的 200 条多。
        for asset_id in range(1000, 1205):
            self.add(asset_id, "local", rf"R:\media\入口{asset_id}.url", "other", 128)
        self.add(2000, "local", r"R:\下载\福利群vip0955.com.zip", "archive", 2048)
        self.assertEqual(q_ads(self.contract, kind="url")["total"], 205)

        result = web_batch.w_ads_dispose_all(self.contract, {"kind": "url", "status": "pending", "expected": 205})

        self.assertEqual(result["changed"], 205)
        self.assertEqual(sorted(result["ids"]), list(range(1000, 1205)))
        # 只动这一类；归入原因记垃圾，撤销按返回的 id 还原。
        self.assertEqual(self.disposals(), {asset_id: "junk" for asset_id in range(1000, 1205)})
        self.assertEqual(q_ads(self.contract, kind="url")["total"], 0)
        self.assertEqual({item["id"] for item in q_ads(self.contract)["items"]}, {2000})
        # 撤销把这一整批原样还原，同样不分段。
        restored = web_batch.w_ads_restore_all(self.contract, {"ids": result["ids"]})
        self.assertEqual(restored["changed"], 205)
        self.assertEqual(self.disposals(), {})
        self.assertEqual(q_ads(self.contract, kind="url")["total"], 205)

    def test_dispose_all_refuses_a_count_the_user_did_not_confirm_and_the_excluded_view(self):
        self.add(3, "pikpak", r"A:\资源\点击这里.url", "other", 128)
        self.add(4, "local", r"R:\media\福利群vip0955.com.zip", "archive", 2048)
        # 确认框给人看的是 1 条，队列里实际是 2 条：整批拒绝，一条不动。
        with self.assertRaises(ValueError):
            web_batch.w_ads_dispose_all(self.contract, {"kind": "", "status": "pending", "expected": 1})
        with self.assertRaises(ValueError):
            web_batch.w_ads_dispose_all(self.contract, {"kind": "", "status": "dismissed", "expected": 2})
        with self.assertRaises(ValueError):
            web_batch.w_ads_dispose_all(self.contract, {"kind": "", "status": "pending"})
        self.assertEqual(self.disposals(), {})

    def test_game_download_promo_name_enters_review_without_automatic_trash(self):
        name = "18+游戏大全(996gg.cc)-七龍珠H版-三國志H版-三國群淫傳等.mp4"
        self.add(80, "115", "B:\\云下载\\MNGS-071\\" + name, "video", 2001226, 11.378005)
        self.add(81, "115", "B:\\云下载\\ROYD-358\\" + name, "video", 2001226)
        self.add(82, "115", "B:\\游戏录像\\" + name, "video", 5 * 1024**2, 11)
        self.add(83, "115", "B:\\游戏录像\\七龍珠H版游戏实况.mp4", "video", 2001226, 11)
        self.add(84, "115", "B:\\完整录像\\" + name, "video", 2001226, 3600)
        candidates = {row["id"]: row for row in q_ads(self.contract)["items"]}
        self.assertEqual(set(candidates), {80, 81})
        for row in candidates.values():
            self.assertIn("游戏下载站推广视频", row["why"])
            self.assertGreaterEqual(row["score"], web_batch.JUNK_REVIEW_SCORE)
            self.assertLess(row["score"], web_batch.AUTO_TRASH_SCORE)
        self.assertEqual(junk.isolate(self.db_path, asset_ids=list(candidates))['isolated'], 0)

    def release_with_shorts(self, base, first_id=300, names=None, **short_values):
        self.add(first_id, "115", base + "\\" + base.rsplit("\\", 1)[-1] + ".mp4",
                 "video", 1103584330, 3264.96)
        for offset, name in enumerate(names or ("附件甲", "附件乙", "附件丙"), 1):
            values = dict(size=24880490, duration=19.319002)
            values.update(short_values)
            self.add(first_id + offset, "115", base + "\\" + name + ".mp4", "video", **values)

    def test_short_attachment_cluster_is_reviewed_without_promo_words(self):
        self.release_with_shorts(r"B:\发行物\正片标题", names=(
            "海贼王3D版 成人欲海狂潮 黄 游", "附件甲", "附件乙", "附件丙", "附件丁", "附件戊"))
        items = q_ads(self.contract)["items"]
        self.assertEqual({row["id"] for row in items}, set(range(301, 307)))
        self.assertTrue(all("6 条极短小附件" in row["why"] for row in items))
        self.assertTrue(all(web_batch.JUNK_REVIEW_SCORE <= row["score"] < web_batch.AUTO_TRASH_SCORE
                            for row in items))
        self.assertEqual(junk.isolate(self.db_path, asset_ids=[row['id'] for row in items])['isolated'], 0)

    def test_a_pair_of_shorts_and_standalone_animation_loops_stay_out(self):
        self.release_with_shorts(r"B:\发行物\正片标题", names=("附件甲", "附件乙"))
        for asset_id in range(310, 316):
            self.add(asset_id, "115", rf"B:\画师作品集\动画{asset_id}.mp4", "video", 24880490, 19.319002)
        self.assertEqual(q_ads(self.contract)["items"], [])

    def test_short_attachment_identity_and_measurements_must_be_eligible(self):
        cases = (
            ({"duration": None}, None), ({"duration": 0}, None), ({"duration": -1}, None),
            ({"duration": 31}, None), ({"size": 0}, None),
            ({"size": 33 * 1024**2}, None), ({"creator": "示例画师"}, None),
            ({}, ("作品 CD1", "作品 part2", "作品 分卷")),
            ({}, ("ABW-153", "ABW-154", "ABW-155")),
        )
        for index, (values, names) in enumerate(cases):
            self.release_with_shorts(rf"B:\发行物\正片{index}", 400 + index * 10,
                                     names=names, **values)
        self.assertEqual(q_ads(self.contract)["items"], [])

    def test_short_attachments_can_have_inherited_directory_codes(self):
        self.release_with_shorts(r"B:\发行物\ABW-153", code="ABW-153")
        self.assertEqual({row["id"] for row in q_ads(self.contract)["items"]}, {301, 302, 303})

    def test_mixed_folder_or_inactive_main_cannot_support_attachment_evidence(self):
        for index, main_values in enumerate((
                {"path": r"B:\发行物\正片0\别的标题.mp4"}, {"disposal": "trash"}, {"location": "online"},
                {"duration": 1100}, {"size": 40 * 1024**2})):
            main_id = 500 + index * 10
            self.release_with_shorts(rf"B:\发行物\正片{index}", main_id)
            with closing(sqlite3.connect(self.db_path)) as connection:
                for column, value in main_values.items():
                    connection.execute(f"UPDATE asset SET {column}=? WHERE id=?", (value, main_id))
                connection.commit()
        self.assertEqual(q_ads(self.contract)["items"], [])

    def test_cross_release_spread_uses_measurements_with_different_names(self):
        for index in range(3):
            self.release_with_shorts(rf"B:\发行物\正片{index}", 600 + index * 10,
                                     names=(f"无推广字样的名字{index}",))
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute("UPDATE asset SET width=1920,height=1080")
            connection.commit()
        items = q_ads(self.contract)["items"]
        self.assertEqual({row["id"] for row in items}, {601, 611, 621})
        self.assertTrue(all("3 个发行目录" in row["why"] for row in items))
        self.assertEqual(junk.isolate(self.db_path, asset_ids=[row['id'] for row in items])['isolated'], 0)

    def test_cross_release_spread_requires_full_matching_measurements(self):
        for index in range(3):
            self.release_with_shorts(rf"B:\发行物\正片{index}", 600 + index * 10, names=("附件",))
        self.assertEqual(q_ads(self.contract)["items"], [])
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute("UPDATE asset SET width=1920,height=1080")
            connection.execute("UPDATE asset SET duration=20 WHERE id=621")
            connection.commit()
        self.assertEqual(q_ads(self.contract)["items"], [])

    def test_dismissed_short_attachment_can_be_reconsidered(self):
        self.release_with_shorts(r"B:\发行物\正片标题")
        w_batch(self.contract, {"ids": [301], "operation": "dismiss-junk"})
        self.assertEqual({row["id"] for row in q_ads(self.contract)["items"]}, {302, 303})
        w_batch(self.contract, {"ids": [301], "operation": "reconsider-junk"})
        self.assertEqual({row["id"] for row in q_ads(self.contract)["items"]}, {301, 302, 303})

    def test_domain_watermarked_release_volumes_are_not_junk(self):
        names = ("www.98T.la@FC2-1529680-CD2.mp4", "www.example.com_ABW-153-part1.mp4",
                 "FC2-PPV-1234567-2.mp4", "ABW-153 (3).mp4")
        for asset_id, name in enumerate(names, 700):
            self.add(asset_id, "115", "B:\\发行物\\" + name, "video", 10 * 1024**2, 400)
        self.assertEqual(q_ads(self.contract)["items"], [])
        self.assertEqual(junk.isolate(self.db_path, asset_ids=range(700, 704))['isolated'], 0)

    def test_numbered_source_watermarks_only_enter_review(self):
        for asset_id, name in enumerate(("【来源站example.com】1", "[example.com]84 (2)"), 710):
            self.add(asset_id, "115", "B:\\短片\\" + name + ".mp4", "video", 5 * 1024**2, 10)
        items = q_ads(self.contract)["items"]
        self.assertEqual({row["id"] for row in items}, {710, 711})
        self.assertTrue(all(row["score"] < web_batch.AUTO_TRASH_SCORE for row in items))
        self.assertEqual(junk.isolate(self.db_path, asset_ids=[row['id'] for row in items])['isolated'], 0)

    def test_non_video_trash_items_remain_visible_and_recoverable(self):
        self.add(10, "115", r"B:\番号\广告图.jpg", "image", disposal="trash")
        self.add(11, "115", r"B:\番号\备用网址.url", "other", disposal="trash")
        self.add(12, "115", r"B:\番号\正片.mp4", "video", 1024, 60)

        result = q_items(self.contract, {
            "state": "trash", "limit": "60", "thumb": "1",
            "exclude_vertical": "1", "dur_min": "3600", "jav": "1",
        })

        self.assertEqual(result["total"], 2)
        self.assertEqual(
            {(item["id"], item["medium"]) for item in result["items"]},
            {(10, "image"), (11, "other")},
        )

    def test_nfo_and_large_same_code_clips_never_enter_the_junk_queue(self):
        """NFO 是资料边车；达到 120 MB 的同番号短版本归重复清理，不归垃圾。"""
        self.add(13, "local", r"R:\番号\点击观看.nfo", "other", 4096)
        self.add(14, "local", r"R:\番号\FC2-PPV-1110408.mp4", "video",
                 4 * 1024**3, 50 * 60, code="FC2-PPV-1110408")
        self.add(15, "local", r"R:\番号\FC2-PPV-1110408-2-4K修复.mp4", "video",
                 488 * 1024**2, 3 * 60, code="FC2-PPV-1110408")

        self.assertEqual(q_ads(self.contract, limit=200)["items"], [])

    def test_mib_archives_can_be_excluded_and_reconsidered_per_asset(self):
        """域名文件名可能是真资源；“不是垃圾”必须可持久排除且能撤销。"""
        self.add(20, "115", r"B:\\MIB\\Mib19.com.zip", "archive", 14 * 1024**3)
        self.add(21, "115", r"B:\\MIB\\Mib19.com(2).zip", "archive", 15 * 1024**3)
        self.add(22, "115", r"B:\\广告\\hayob9.com.jpg", "image", 28000)

        pending = q_ads(self.contract, limit=200)
        self.assertEqual(pending["counts"]["archive"], 2)
        self.assertEqual([item["id"] for item in q_ads(
            self.contract, limit=200, kind="archive")["items"]], [21, 20])

        changed = w_batch(self.contract, {"ids": [20], "operation": "dismiss-junk"})
        self.assertEqual(changed["changed"], 1)
        self.assertEqual(q_ads(self.contract, limit=200)["pending_total"], 2)
        dismissed = q_ads(self.contract, limit=200, status="dismissed")
        self.assertEqual([item["id"] for item in dismissed["items"]], [20])
        self.assertEqual(dismissed["counts"]["archive"], 1)

        w_batch(self.contract, {"ids": [20], "operation": "reconsider-junk"})
        self.assertEqual(q_ads(self.contract, limit=200)["pending_total"], 3)

    def test_one_scoring_serves_every_kind_status_and_page(self):
        """打分与类型、状态、分页无关：算一次，各种切法共用；一页里的条目改不到下一页。"""
        self.add(30, "115", r"B:\\广告\\hayob9.com.jpg", "image", 28000)
        self.add(31, "115", r"B:\\MIB\\Mib19.com.zip", "archive", 14 * 1024**3)
        with mock.patch.object(web_batch, "_scored_junk", wraps=web_batch._scored_junk) as scored:
            first = q_ads(self.contract, limit=1)
            archives = q_ads(self.contract, limit=200, kind="archive")
            dismissed = q_ads(self.contract, limit=200, status="dismissed")
        self.assertEqual(scored.call_count, 1)
        self.assertEqual(first["total"], 2)
        self.assertEqual([item["id"] for item in archives["items"]], [31])
        self.assertEqual(dismissed["items"], [])
        first["items"][0]["why"] = ["被改过"]
        self.assertNotEqual(q_ads(self.contract, limit=1)["items"][0]["why"], ["被改过"])
        self.assertEqual(q_ads(
            self.contract, limit=200, status="dismissed")["items"], [])

    def test_game_interstitials_in_a_release_directory_all_enter_the_queue(self):
        """`WAAA-415-uncensored-HD` 那批插页此前一张都没到门槛，只有正片自己入队。"""
        release = r"B:\番号\Wanz Factory\WAAA-415\WAAA-415-uncensored-HD"
        titles = ("爱姬远征", "天下布魔", "奇迹少女", "星隕計畫", "樱境物语",
                  "欲神幻想", "腥空幻想", "工口.R18-成人遊戲", "三国志侵略版")
        for offset, title in enumerate(titles):
            self.add(30 + offset, "115",
                     rf"{release}\{title}-免费18禁手游-扫码安装.jpg", "image", 1024**2)
        self.add(50, "115", rf"{release}\工口MH-扫描访问.png", "image", 966 * 1024)
        # 正片本体：体积与时长都在候选范围外，进不了队列，只作为目录里的邻居存在。
        self.add(51, "115", rf"{release}\WAAA-415-UNCENSORED.mp4", "video",
                 4 * 1024**3, 8888)

        result = q_ads(self.contract, limit=200)

        self.assertEqual(result["total"], 10)
        self.assertNotIn(51, {item["id"] for item in result["items"]})
        by_id = {item["id"]: item for item in result["items"]}
        # 游戏名有六个字，单看名字只够中间档；同目录另外九个同类推广名补齐证据。
        self.assertIn("同目录另有 9 个同类推广名", by_id[38]["why"])
        self.assertIn("整个名字都是推广语", by_id[30]["why"])

    def test_bundled_photo_set_is_a_resource_not_an_ad(self):
        """域名+序号是打包渠道给整包起的名；几十上百张成套的图是资源。"""
        gallery = r"A:\创作者\森萝财团 整合用\森萝财团 X-019 肉丝换白丝 [103P1V-1.39GB]"
        for offset in range(BUNDLE_DIR_ASSETS):
            self.add(60 + offset, "local", rf"{gallery}\jitumi.pw({offset}).gif",
                     "image", 5 * 1024**2)
        # 同样的名字只有一两张挤在别人的番号目录里，那就是插页。
        self.add(90, "115", r"B:\番号\CAWD-241\jitumi.pw(1).gif", "image", 5 * 1024**2)

        result = q_ads(self.contract, limit=200)

        self.assertEqual([item["id"] for item in result["items"]], [90])

    def test_cover_and_screenshot_outlive_their_promo_directory(self):
        """目录名带域名只说明从哪个站下的，说明不了目录里的图是广告。"""
        # 正片本体的体积在候选范围外，这里只作为截图的对照存在。
        self.add(70, "115", r"B:\云下载\Jav.li_MIAD573_HD\MIAD573_02.wmv", "video",
                 800 * 1024**2, 3600, creator="Jav.li_MIAD573_HD")
        self.add(71, "115", r"B:\云下载\Jav.li_MIAD573_HD\MIAD573_02_s.jpg", "image",
                 40000, creator="Jav.li_MIAD573_HD")
        self.add(72, "115", r"B:\创作者\BNST033\aaxv.xyz-BNST033\BNST-033(1).jpg",
                 "image", 40000, code="BNST-033")
        # 同一个广告包目录里，与番号无关的推广图仍然是广告。
        self.add(73, "115", r"B:\创作者\BNST033\aaxv.xyz-BNST033\点击进入.jpg",
                 "image", 40000)

        result = q_ads(self.contract, limit=200)

        self.assertEqual([item["id"] for item in result["items"]], [73])

    def test_bluray_disc_image_and_its_poster_are_not_ads(self):
        """19.8 GB 的原盘和它的海报都是资源；同目录那个推广 rar 仍然是广告。

        样本是 `B:\\云下载\\javme.me_LXVS-006-BD` 的实际三项。原盘在账本里是
        `other`、没有 code、也没有时长，光看名字和目录只剩「域名+番号」这一条证据。
        """
        pack = r"B:\云下载\javme.me_LXVS-006-BD"
        self.add(91, "115", rf"{pack}\LXVS006-BD.iso", "other", 19778371584)
        self.add(92, "115", rf"{pack}\lxvs006pl.jpg", "image", 134351)
        self.add(93, "115", rf"{pack}\九色腾免费高清五码自拍在线观看不卡。.rar",
                 "archive", 1362754)

        result = q_ads(self.contract, limit=200)

        self.assertEqual([item["id"] for item in result["items"]], [93])

    def test_promo_cluster_needs_more_than_a_couple_of_neighbours(self):
        """两张同类插页不构成成群；`PROMO_CLUSTER_FILES` 是这条判据的下限。"""
        self.assertGreaterEqual(PROMO_CLUSTER_FILES, 3)
        release = r"B:\番号\Faleno\FSDSS-258\FSDSS-258.HD"
        for offset in range(PROMO_CLUSTER_FILES - 1):
            self.add(80 + offset, "115",
                     rf"{release}\逆王传说 - 入侵女兒國{offset}-免费18禁手游-扫码安装.jpg",
                     "image", 1024**2)

        result = q_ads(self.contract, limit=200)

        self.assertEqual(result["items"], [])

    def test_ad_flooded_folder_keeps_video_and_its_cover_only(self):
        """用户实例 `B:\\xxr\\0208 (23)`：整包只有正片和它的同名 PNG 是资源。

        26 条广告各有各的自曝形态：装饰符小图、品牌推广卡、`.mhtml` 网页存档、
        目录名自曝（`-APP`、`一键约炮`、`論壇文宣`）里的推广图。
        """
        base = r"B:\xxr\0208 (23)"
        self.add(100, "115", rf"{base}\梓怡-背著老公.mp4", "video",
                 985 * 1024**2, 1647)
        self.add(101, "115", rf"{base}\梓怡-背著老公.png", "image", 2379 * 1024)
        self.add(102, "115", rf"{base}\❤91短视频❤.jpg", "image", 600 * 1024)
        self.add(103, "115", rf"{base}\全国外围-一键约炮.jpg", "image", 606 * 1024)
        self.add(104, "115", rf"{base}\❤成人游戏-导航-.mhtml", "other", 6615 * 1024)
        self.add(105, "115", rf"{base}\_含羞草APP\❤含 羞 草❤.png", "image", 8 * 1024)
        self.add(106, "115",
                 rf"{base}\論壇文宣\(_0高清国产精品资源获取.png", "image", 18 * 1024)

        result = q_ads(self.contract, limit=200)

        self.assertEqual(
            {item["id"] for item in result["items"]},
            {102, 103, 104, 105, 106},
        )
        by_id = {item["id"]: item for item in result["items"]}
        self.assertIn("装饰符小图", by_id[102]["why"])
        self.assertIn("推广品牌名", by_id[103]["why"])
        self.assertIn("网页存档", by_id[104]["why"])

    def test_brand_word_in_a_video_title_is_not_promo_by_itself(self):
        """`麻豆传媒` 一类品牌词也可以是正片标题的一部分，视频单独命中不算证据。"""
        self.add(110, "115", r"B:\番号\麻豆传媒 背著老公的妻子.mp4", "video",
                 400 * 1024**2, 900)

        result = q_ads(self.contract, limit=200)

        self.assertEqual(result["items"], [])

    def test_invalid_junk_filters_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "invalid junk kind"):
            q_ads(self.contract, kind="document")
        with self.assertRaisesRegex(ValueError, "invalid junk status"):
            q_ads(self.contract, status="deleted")

    def test_small_installer_archive_name_enters_review_with_release_code(self):
        path = r'B:\MVP\Tokyo-Hot n1025-FHD\1024核工厂.rar'
        self.add(211, '115', path, 'archive', 4111)
        with closing(sqlite3.connect(self.db_path)) as db:
            db.execute('UPDATE asset SET code=? WHERE id=?', ('n1025', 211))
            db.commit()
        items = q_ads(self.contract, limit=200)['items']
        self.assertEqual([item['id'] for item in items], [211])
        self.assertIn('推广安装包', items[0]['why'])
        self.assertEqual(junk._promo_name_reason('.rar', path, 128 * 1024), '')
        self.assertEqual(junk._promo_name_reason('.rar', r'B:\MVP\n1025.rar', 4111), '')

    def test_creator_folder_promotional_video_names_enter_review(self):
        names = (
            '美女荷官在线发牌_vip5678.mp4',
            '激情隨時看.mp4',
            'N房间的精彩直播 只有你想不到的刺激.mp4',
        )
        for asset_id, name in enumerate(names, 1):
            self.add(asset_id, '115', rf'B:\创作者\示例作者\作品\{name}', 'video',
                     8 * 1024**2, 90, creator='示例作者')

        items = q_ads(self.contract, limit=200)['items']
        self.assertEqual({item['id'] for item in items}, {1, 2, 3})
        for item in items:
            self.assertGreaterEqual(item['score'], junk.JUNK_REVIEW_SCORE)
            self.assertLess(item['score'], junk.AUTO_TRASH_SCORE)
            self.assertIn('推广视频的固定命名', item['why'])
        checked = junk.isolate(self.db_path, asset_ids=[1, 2, 3])
        self.assertEqual((checked['isolated'], checked['review']), (0, 3))

        w_batch(self.contract, {'ids': [1], 'operation': 'dismiss-junk'})
        self.assertEqual({item['id'] for item in q_ads(self.contract)['items']}, {2, 3})
        w_batch(self.contract, {'ids': [1], 'operation': 'reconsider-junk'})
        self.assertEqual({item['id'] for item in q_ads(self.contract)['items']}, {1, 2, 3})

    def test_creator_video_promo_names_require_matching_name_and_small_size(self):
        for asset_id, name, size in (
            (1, '美女荷官剧情片.mp4', 8 * 1024**2),
            (2, '6月28日(1).mov', 12 * 1024**2),
            (3, '美女荷官在线发牌_vip5678.mp4', 32 * 1024**2 + 1),
        ):
            self.add(asset_id, '115', rf'B:\创作者\示例作者\作品\{name}', 'video',
                     size, 90, creator='示例作者')
        self.assertEqual(q_ads(self.contract)['items'], [])

    def test_promotional_page_navigation_images_with_inherited_release_code(self):
        base = r'B:\MVP\1pon-092415_001-fhd'
        page = base + r'\花一分钟记住我们的网址 - sex5.xxx_files'
        self.add(201, '115', page + r'\banner_b.jpg', 'image', 312739)
        self.add(202, '115', base + r'\img\001.jpg', 'image', 46234)
        self.add(203, '115', page + r'\001.jpg', 'image', 46234)
        self.add(204, '115', base + r'\movie_files\logo.gif', 'image', 3439)
        with closing(sqlite3.connect(self.db_path)) as db:
            db.execute('UPDATE asset SET code=? WHERE id IN (201,202,203,204)', ('092415-001',))
            db.commit()
        items = q_ads(self.contract, limit=200)['items']
        self.assertEqual([item['id'] for item in items], [201])
        self.assertIn('导航图片', items[0]['why'])
        self.assertEqual(junk._attachment_junk_reason('.gif', page + r'\1.gif', 974),
                         '推广网页存档的横幅、标志或导航图片')
        self.assertEqual(junk._attachment_junk_reason('.gif', page + r'\1.gif', 6000), '')
        self.assertTrue(junk._attachment_junk_reason('.gif', page + r'\1000x90yunding.gif', 97843))

    def add_download(self, task_id, code, folder, main):
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO download_task(id,provider,source_uri,target,code,state,ledger_path,asset_id,updated_at) "
                "VALUES(?,'pikpak','magnet:?xt=urn:btih:fixture',?,?,'ingested',?,?,'now')",
                (task_id, f'115-{task_id}', code, folder, main))

    def test_download_package_attachments_are_isolated_while_release_files_stay(self):
        # 样本取自 2026-11-03 的只读盘点：整理把正片移走后，推广附件留在落地目录。
        self.add(1, '115', r'B:\S1\SSIS-839\SSIS-839 标题.mp4', 'video', 5 * 1024**3, 7200)
        self.add_download(1, 'SSIS-839', r'B:\云下载\SSIS-839', 1)
        base = r'B:\云下载\SSIS-839' + '\\'
        self.add(2, '115', base + '人间尤物.mp4', 'video', 78893257, 61)
        self.add(3, '115', base + '好站全在这.txt', 'other', 470)
        self.add(4, '115', base + r'其他作品合集\kpkp3.com_259LUXU-1555.jpg', 'image', 258032)
        self.add(5, '115', base + 'hjd2048.com-0907ssis839pl.jpg', 'image', 176840)
        self.add(6, '115', base + 'poster.jpg', 'image', 180000)
        self.add(7, '115', base + '回家指南综合包.zip', 'archive', 3165927)
        self.add(8, '115', base + '特典映像.mp4', 'video', 90 * 1024**2, 600)
        self.add(9, '115', base + '未探测.mp4', 'video', 4650760)
        # 落地目录就是下载根时，不能把根下所有文件都当成这个种子的附件。
        self.add(10, '115', r'B:\云下载\notes.txt', 'other', 470)
        self.add_download(2, 'ABP-616', r'B:\云下载', 1)
        items = {item['id']: item for item in q_ads(self.contract, limit=200)['items']}
        self.assertEqual(set(items), {2, 3, 4, 7})
        self.assertIn('SSIS-839 下载包里的附带短视频，正片长 120 分', items[2]['why'])
        self.assertIn('附带压缩包', items[7]['why'])
        self.assertLess(items[7]['score'], web_batch.AUTO_TRASH_SCORE)
        checked = junk.isolate(self.contract.database, asset_ids=list(range(1, 11)), protected_ids=[1])
        self.assertEqual(sorted(checked['ids']), [2, 3, 4])

    def test_untracked_folders_under_the_download_root_use_their_own_release_video(self):
        # 下载根由已有任务确定；没有任务行的旧下载按目录名里的番号认正片。
        self.add(1, '115', r'B:\S1\SSIS-839\SSIS-839.mp4', 'video', 5 * 1024**3, 7200)
        self.add_download(1, 'SSIS-839', r'B:\云下载\SSIS-839', 1)
        base = r'B:\云下载\第一會所新片@SIS001@DDH-454' + '\\'
        self.add(10, '115', base + 'DDH-454.mp4', 'video', 3271300936, 4221.9)
        self.add(11, '115', base + '[资源推荐]！下载地址.txt', 'other', 154647)
        self.add(12, '115', base + '推特新晋约啪大神原创约炮自拍.jpg', 'image', 1410048)
        self.add(13, '115', base + 'cap_e_3_ddh-454.jpg', 'image', 275947)
        # 目录名带番号却找不到同番号正片的不算下载包；下载根以外的目录也不算。
        self.add(20, '115', r'B:\云下载\ABC-123 合集\片段.mp4', 'video', 3 * 1024**3, 7200)
        self.add(21, '115', r'B:\云下载\ABC-123 合集\说明.txt', 'other', 400)
        self.add(30, '115', r'B:\日本\DDH-455\DDH-455.mp4', 'video', 3 * 1024**3, 4000)
        self.add(31, '115', r'B:\日本\DDH-455\推特新晋约啪大神原创约炮自拍.jpg', 'image', 1410048)
        items = {item['id']: item for item in q_ads(self.contract, limit=200)['items']}
        self.assertEqual(set(items), {11, 12})
        self.assertIn('DDH-454 下载包里的附带文件', items[12]['why'])
        checked = junk.isolate(self.contract.database, asset_ids=[10, 11, 12, 13, 20, 21, 30, 31])
        self.assertEqual(sorted(checked['ids']), [11, 12])

    def test_download_attachment_rules_need_a_bound_main_and_a_long_enough_release(self):
        self.add(1, '115', r'B:\云下载\IPX-867\IPX-867.mp4', 'video', 300 * 1024**2, 1200)
        self.add_download(1, 'IPX-867', r'B:\云下载\IPX-867', 1)
        self.add(2, '115', r'B:\云下载\IPX-867\片头.mp4', 'video', 20 * 1024**2, 90)
        self.add(3, '115', r'B:\云下载\SONE-136\好站全在这.txt', 'other', 470)
        with self.contract.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO download_task(id,provider,source_uri,target,code,state,ledger_path,updated_at) "
                "VALUES(2,'pikpak','magnet:?xt=urn:btih:unbound','115-2','SONE-136','ingested',?,'now')",
                (r'B:\云下载\SONE-136',))
        self.assertEqual(junk.isolate(self.contract.database, asset_ids=[1, 2, 3], protected_ids=[1])['ids'], [])

    def test_release_names_match_compact_padded_and_store_prefixed_spellings(self):
        for stem, code in (('hjd2048.com-0907mide580-h264', 'MIDE-580'), ('tkmj001jp', 'TKMJ-001'),
                           ('hhd800.com@FC2-PPV-2753986_2', 'FC2-PPV-2753986'), ('STZY-019', '107STZY-019')):
            with self.subTest(stem=stem):
                self.assertTrue(junk.names_release(stem, code))
        for stem, code in (('offkab@sukebei', 'FC2-PPV-4330669'), ('kpkp3.com_259LUXU-1555', 'SGKX-016'),
                           ('MIDE5800', 'MIDE-580')):
            with self.subTest(stem=stem):
                self.assertFalse(junk.names_release(stem, code))

    def test_identical_small_copies_across_release_folders_are_junk_evidence(self):
        for offset, folder in enumerate(('MIDA-117-UC', 'MIDA-154-UC', 'MIDA-234-UC')):
            self.add(20 + offset, '115', rf'B:\云下载\{folder}\情報.mp4', 'video', 11057812, 157.28)
            self.add(30 + offset, '115', rf'B:\云下载\{folder}\说明.txt', 'other', 136)
            self.add(40 + offset, '115', rf'B:\云下载\{folder}\ABC-123.jpg', 'image', 52000)
        self.add(50, '115', r'B:\云下载\MIDA-117-UC\片段.mp4', 'video', 2001226, 11)
        self.add(51, '115', r'B:\云下载\MIDA-154-UC\片段.mp4', 'video', 2001226, 11)
        self.add(52, '115', r'B:\云下载\MIDA-234-UC\片段.mp4', 'video', 2001226, 3600)
        # 创作者目录里每期都带的同一段片头不算：目录名不是发行包。
        for offset, folder in enumerate(('第一期', '第二期', '第三期')):
            self.add(70 + offset, '115', rf'B:\创作者\{folder}\片头.mp4', 'video', 3000000, 8)
        items = {item['id']: item for item in q_ads(self.contract, limit=200)['items']}
        self.assertEqual(set(items), {20, 21, 22, 30, 31, 32})
        self.assertIn('同名同体积的副本散布在 3 个目录', items[20]['why'])
        self.assertGreaterEqual(items[20]['score'], web_batch.AUTO_TRASH_SCORE)
        self.assertLess(items[30]['score'], web_batch.AUTO_TRASH_SCORE)

    def test_letter_spaced_promo_names_are_read_as_one_word(self):
        self.assertEqual(junk.despaced('x u u 6 2 . c o m'), 'xuu62.com')
        self.assertEqual(junk.despaced('最 新 位 址 獲 取'), '最新位址獲取')
        self.assertEqual(junk.despaced('No.017 - 서서 펠라_뒤치기'), 'No.017 - 서서 펠라_뒤치기')
        self.add(60, '115', r'B:\资源\x u u 9 2 .c o m.mp4', 'video', 23141112, 88.7)
        self.add(61, '115', r'B:\资源\最 新 位 址 獲 取：489155.com 收藏不迷路.txt', 'other', 136)
        self.add(62, '115', r'B:\资源\manko.fun.mp4', 'video', 11057812, 157.28)
        items = {item['id']: item for item in q_ads(self.contract, limit=200)['items']}
        self.assertEqual(set(items), {60, 61, 62})
        self.assertTrue(all(item['score'] >= web_batch.AUTO_TRASH_SCORE for item in items.values()))


if __name__ == "__main__":
    unittest.main()
