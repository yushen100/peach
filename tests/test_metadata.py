import unittest

from peach.metadata import (
    identifies_code,
    CATALOG_EVIDENCE_FIELDS,
    CREDENTIAL_ADVICE,
    auth_error,
    auth_wall_reason,
    collapse_repeated_phrase,
    extract_catalog_evidence,
    extract_peach_fields,
    validate_provider_code,
)


class MetadataProviderTests(unittest.TestCase):
    def test_damaged_source_fields_leave_healthy_fields_available(self):
        fields = extract_peach_fields({'title':'壊\ufffdれた題名', 'maker':'正しいメーカー',
            'release_date':'2026-01-02', 'actresses':[{'japanese_name':'名前\ufffd'}],
            'genres':['未\ufffd分類']})
        self.assertNotIn('title', fields)
        self.assertNotIn('performers', fields)
        self.assertNotIn('tags', fields)
        self.assertEqual(fields['studio']['value'], '正しいメーカー')
        self.assertEqual(fields['release_date']['value'], '2026-01-02')
        self.assertNotIn('title', extract_catalog_evidence({'title':'壊\ufffdれた題名'}))

    def test_valid_non_latin_source_text_and_performer_aliases_remain_available(self):
        fields = extract_peach_fields({'title':'日本語 中文 café',
            'actresses':[{'japanese_name':'正常な名前','aliases':['別名\ufffd']}],
            'maker':'正常な会社'})
        self.assertEqual(fields['title']['value'], '日本語 中文 café')
        self.assertNotIn('performers', fields)
        self.assertEqual(fields['studio']['value'], '正常な会社')

    def test_all_unmapped_genres_are_reviewable_without_fabricated_tags(self):
        fields = extract_peach_fields({"genres": ["未知类别甲", "未知类别乙"]})
        self.assertEqual(fields["tags"]["value"], [])
        self.assertEqual(fields["tags"]["unmapped_genres"], ["未知类别甲", "未知类别乙"])
        self.assertTrue(fields["tags"]["warnings"])

    def test_the_gate_rejects_paths_and_urls(self):
        for unsafe in ("/media/IPX-535.mp4", r"R:\media\IPX-535.mp4", "https://x/IPX-535"):
            with self.subTest(unsafe=unsafe), self.assertRaises(ValueError):
                validate_provider_code(unsafe)

    def test_the_gate_passes_both_separators_of_a_dated_code(self):
        # `_` 是一本道等片商的标识（`catalog_rules._CODE_DATE`）。这道闸拦的是路径、
        # URL 和任意文本；连分隔符一起拦，这些片就一部都查不了。
        self.assertEqual(validate_provider_code("092415_001"), "092415_001")
        self.assertEqual(validate_provider_code("092415-001"), "092415-001")

    def test_the_gate_passes_registered_digit_labels_only(self):
        self.assertEqual(validate_provider_code("t28-612"), "T28-612")
        with self.assertRaises(ValueError):
            validate_provider_code("T29-612")

    def test_the_gate_keeps_tokyo_hot_lowercase(self):
        # Tokyo-Hot 的规范写法是小写（`catalog_rules._TOKYO_HOT_BODY`）；跟着别的番号
        # 转大写，拿去查的就是来源不认的写法，这些片一部都查不了。
        self.assertEqual(validate_provider_code("N0646"), "n0646")
        self.assertEqual(validate_provider_code("n646"), "n0646")
        self.assertEqual(validate_provider_code("RED123"), "red-123")

    def test_an_authentication_wall_is_its_own_error_kind(self):
        """401、403 与「跳到登录页」都判成 auth，别的失败不许蹭这一档。"""
        self.assertIn("401", auth_wall_reason(status_code=401))
        self.assertIn("403", auth_wall_reason(status_code=403))
        self.assertIn("/login", auth_wall_reason(
            status_code=200, final_url="https://javdb.com/login?next=/v/abc"))
        self.assertIn("/age_check", auth_wall_reason(
            status_code=200, final_url="https://www.dmm.co.jp/age_check/=/declared=yes/"))
        self.assertIn("javdb 登录页", auth_wall_reason(
            status_code=200, body="<title> 登入 | JavDB</title>".encode()))
        for benign in (dict(status_code=404),
                       dict(status_code=200, final_url="https://javdb.com/v/loginbait"),
                       dict(status_code=503),
                       dict(status_code=200, body=b"<title>ABW-220</title>")):
            with self.subTest(benign=benign):
                self.assertEqual(auth_wall_reason(**benign), "")

    def test_a_bare_403_does_not_tell_the_user_to_swap_credentials(self):
        """403 的成因不止一种，措辞就不许替用户断成因。

        `docs/SOURCING.md` 记着 javbus 与 minnano-av 的实测：那些 403 是出口 IP 被封，
        javdb 那次封了 3～7 日，换 Cookie 一点用没有。「本批停止该来源」这个动作对两种
        403 都对，「换一份凭据」这句话只对其中一种，说出口就是把人引去做错事。
        判据明确的那三种没有这个歧义，仍然直说。
        """
        bare = auth_wall_reason(status_code=403)
        self.assertIn("出口 IP", bare)
        self.assertNotIn(CREDENTIAL_ADVICE, bare)
        for confident in (dict(status_code=401),
                          dict(status_code=200, final_url="https://javdb.com/login"),
                          dict(status_code=200, body="<title>登入 | JavDB</title>".encode()),
                          # 403 也带着登录页的地址，成因就不含糊了。
                          dict(status_code=403, final_url="https://javdb.com/login")):
            with self.subTest(confident=confident):
                reason = auth_wall_reason(**confident)
                self.assertIn(CREDENTIAL_ADVICE, reason)
                self.assertNotIn("出口 IP", reason)

    def test_an_auth_error_is_not_retryable_and_not_a_verdict(self):
        """同一份凭据再问一次还是这个结果，所以不重试；换一份就能继续，所以不是定论。"""
        error = auth_error("mgstage", "来源返回 403", status_code=403)
        self.assertEqual((error.kind, error.status_code), ("auth", 403))
        self.assertFalse(error.retryable)
        self.assertTrue(error.temporary)
        self.assertIn("mgstage", str(error))

    def test_repeated_performer_is_collapsed_before_candidate_creation(self):
        self.assertEqual(collapse_repeated_phrase("木村さん 木村さん"), ("木村さん", True))
        fields = extract_peach_fields({
            "actresses": [
                {"dmm_id": 7, "japanese_name": "木村さん 木村さん"},
                {"dmm_id": 7, "japanese_name": "木村さん"},
                {"dmm_id": 8, "japanese_name": "画像を拡大する 画像を拡大する"},
            ],
            "maker": "Studio Studio", "series": "Series A",
            "release_date": "2020-09-13T00:00:00Z", "genres": ["Anal"],
        })
        self.assertEqual(fields["performers"]["value"], [
            {"name": "木村さん", "external_id": "7", "thumb_url": ""},
        ])
        self.assertEqual(fields["studio"]["value"], "Studio")
        self.assertEqual(fields["release_date"]["value"], "2020-09-13")
        self.assertIn("已规范化", fields["release_date"]["warnings"][0])
        self.assertEqual(fields["tags"]["value"], ["屁眼"])

    def test_performer_profile_names_are_aliases_not_separate_people(self):
        fields = extract_peach_fields({"actresses": [{
            "dmm_id": 1051912, "japanese_name": "涼森れむ",
            "name_kana": "すずもりれむ", "name_romaji": "Remu Suzumori",
            "thumb_url": "https://pics.dmm.co.jp/mono/actjpgs/suzumori_remu.jpg",
            "profile_source": "r18dev",
        }]})
        self.assertEqual(fields["performers"]["value"], [{
            "name": "涼森れむ", "external_id": "1051912",
            "thumb_url": "https://pics.dmm.co.jp/mono/actjpgs/suzumori_remu.jpg",
            "aliases": ["すずもりれむ", "Remu Suzumori"],
            "profile_source": "r18dev",
        }])

    def test_a_bare_name_list_is_read_as_performers(self):
        """只给名字的快照（fc2cmadb 2026-09-22 存下的 `["梨奈"]`）也要进演员候选，不能静默丢掉。"""
        fields = extract_peach_fields({"actresses": ["梨奈", {"japanese_name": "梨奈"}]})
        self.assertEqual(fields["performers"]["value"], [{"name": "梨奈", "external_id": "", "thumb_url": ""}])

    def test_series_and_studio_take_the_japanese_original(self):
        payload = {
            "maker": "Prestige",
            "series": "Prestige 20th Anniversary Special Event",
            "translations": [
                {"language": "en", "maker": "Prestige", "series": "Prestige 20th Anniversary Special Event"},
                {"language": "ja", "maker": "プレステージ", "series": "【プレステージ20周年特別企画】"},
            ],
        }
        fields = extract_peach_fields(payload)
        self.assertEqual(fields["series"]["value"], "【プレステージ20周年特別企画】")
        self.assertEqual(fields["studio"]["value"], "プレステージ")

    def test_catalog_titles_become_reviewable_truth_candidates(self):
        fields = extract_peach_fields({
            "title": "日本語タイトル", "original_title": "Original Title",
        })
        self.assertEqual(fields["title"]["value"], "日本語タイトル")
        self.assertEqual(fields["original_title"]["value"], "Original Title")

    def test_an_empty_japanese_side_keeps_the_brand_but_not_the_translated_series(self):
        """厂牌用品牌名，退回顶层；系列顶层是 r18 的英文译文，退回去就成了英文的系列实体。"""
        fields = extract_peach_fields({
            "maker": "FALENO",
            "series": "FALENO Compilation",
            "translations": [{"language": "ja", "maker": "", "series": ""}],
        })
        self.assertNotIn("series", fields)
        self.assertEqual(fields["studio"]["value"], "FALENO")

    def test_rich_catalog_fields_stay_source_evidence(self):
        evidence = extract_catalog_evidence({
            "title": "English title", "original_title": "原标题", "runtime": "121",
            "director": "Director A", "label": "Label A",
            "poster_url": "https://img.example/poster.jpg",
            "cover_url": "https://img.example/cover.jpg",
            "screenshot_urls": [
                "https://img.example/1.jpg", "https://img.example/1.jpg",
                "file:///private/2.jpg", "https://img.example/2.jpg",
            ],
            "trailer_url": "https://video.example/trailer.m3u8",
            "translations": [{
                "language": "ja", "title": "日本語タイトル", "label": "日本レーベル",
            }],
        })
        self.assertEqual(set(evidence), set(CATALOG_EVIDENCE_FIELDS))
        self.assertEqual(evidence["title"]["value"], "日本語タイトル")
        self.assertEqual(evidence["original_title"]["value"], "原标题")
        self.assertEqual(evidence["runtime"]["value"], 121)
        self.assertEqual(evidence["label"]["value"], "日本レーベル")
        self.assertEqual(evidence["screenshot_urls"]["value"], [
            "https://img.example/1.jpg", "https://img.example/2.jpg",
        ])
        self.assertIn("2 张截图", evidence["screenshot_urls"]["display_value"])

    def test_catalog_evidence_rejects_credentialed_and_non_http_urls(self):
        evidence = extract_catalog_evidence({
            "title": "Same", "original_title": "Same", "runtime": 0,
            "poster_url": "https://user:secret@example.test/poster.jpg",
            "cover_url": "R:/covers/ABC-001.jpg",
            "trailer_url": "javascript:alert(1)",
        })
        self.assertEqual(evidence, {"title": {
            "value": "Same", "display_value": "Same", "warnings": [],
        }})

class SourceIdentityTests(unittest.TestCase):
    def test_explicit_release_suffix_is_not_satisfied_by_a_plain_or_different_product(self):
        self.assertTrue(identifies_code("DANDY-851C", {"content_id": "1dandy00851c"}))
        self.assertFalse(identifies_code("DANDY-851C", {"content_id": "1dandy00851"}))
        self.assertFalse(identifies_code("DANDY-851C", {"content_id": "1dandy00851ch"}))
        self.assertFalse(identifies_code("DANDY-851", {"content_id": "1dandy00851c"}))

    def test_digit_label_matches_the_dmm_content_id_serial(self):
        self.assertTrue(identifies_code("T28-612", {"content_id": "55t2800612"}))
        self.assertFalse(identifies_code("T28-612", {"content_id": "55t2800611"}))
        self.assertFalse(identifies_code("T28-612", {"content_id": "55t3800612"}))

    def test_prefixed_release_requires_matching_product_evidence(self):
        dvd = {"id": "JAC-040", "content_id": "118jac040",
               "source_url": "https://www.dmm.co.jp/mono/dvd/-/detail/=/cid=118jac040/"}
        self.assertFalse(identifies_code("390JAC-040", dvd))
        self.assertTrue(identifies_code("JAC-040", dvd))
        self.assertTrue(identifies_code("390JAC-040", {
            "id": "JAC-040", "source_url": "https://www.mgstage.com/product/product_detail/390JAC-040/"}))

    def test_verified_mgstage_prefixes_match_the_bare_dmm_release(self):
        """2026-09-25 逐组核过的 MGStage 前缀与 DMM 裸编号是同一作品，同轮的反例仍拒。"""
        for code, payload in (
                ("476MLA-234", {"id": "MLA-234", "content_id": "mla234"}),
                ("428SUKE-080", {"id": "SUKE-080", "content_id": "h_1711suke00080"}),
                ("336KBI-010", {"id": "KBI-010", "content_id": "118kbi00010"}),
                ("762FKOS-001", {"id": "FKOS-001", "content_id": "h_1721fkos00001"})):
            self.assertTrue(identifies_code(code, payload), code)
        for code, payload in (
                ("348NTR-007", {"id": "NTR-007", "content_id": "1ntr00007"}),
                ("451HHH-022", {"id": "HHH-022", "content_id": "62hhh00022"}),
                ("550ENE-006", {"id": "ENE-006", "content_id": "ene006"})):
            self.assertFalse(identifies_code(code, payload), code)

    def test_a_registered_short_serial_rejects_the_padded_release(self):
        # #296：`MCDV-24` 与 `MCDV-024` 是两部片，DMM 按补零猜出的 `mcdv00024` 是后者。
        self.assertFalse(identifies_code("MCDV-24", {"content_id": "mcdv00024"}))
        self.assertTrue(identifies_code("MCDV-024", {"content_id": "mcdv00024"}))
        self.assertTrue(identifies_code("MCDV-24", {"id": "MCDV-24"}))

    def test_real_source_id_shapes_are_accepted(self):
        # DMM 带厂牌数字前缀，r18dev 对 IQQQ-026 会补零，259 系只在 URL 里出现番号。
        self.assertTrue(identifies_code("ABW-220", {"content_id": "118abw220"}))
        self.assertTrue(identifies_code("IQQQ-026", {"content_id": "h_086iqqq00026"}))
        self.assertTrue(identifies_code("MESU-088", {"id": "MESU-88"}))
        self.assertTrue(identifies_code("259LUXU-1475", {
            "source_url": "https://www.mgstage.com/product/product_detail/259LUXU-1475/",
        }))

    def test_unrelated_product_is_rejected_as_not_found(self):
        # dl.getchu 对 ABW-220 与 259LUXU-1475 都返回同一件同人商品 item33938。
        payload = {"id": "33938", "content_id": "33938",
                   "source_url": "https://dl.getchu.com/i/item33938"}
        self.assertFalse(identifies_code("ABW-220", payload))
        self.assertFalse(identifies_code("259LUXU-1475", payload))
        self.assertFalse(identifies_code("ABW-220", {}))
        # 番号相邻不等于同一部：ABW-2200 不能拿 ABW-220 的结果顶替。
        self.assertFalse(identifies_code("ABW-2200", {"content_id": "118abw220"}))
        self.assertFalse(identifies_code("IY-104", {
            "id": "DIY-104", "source_url": "https://www.javbus.com/ja/DIY-104"}))
        self.assertFalse(identifies_code("DB-202", {"id": "DDB-202"}))
        self.assertTrue(identifies_code("JBS-023", {
            "source_url": "https://www.javbus.com/ja/JBS-023"}))

    def test_fc2_bare_digits_are_the_same_release(self):
        """FC2 来源只给裸数字，那仍然是同一部作品。

        判据交给 `same_release_code`，它认得这种写法；照形状比对的那一套不认，
        于是 `FC2-PPV-3701252` 和来源返回的 `3701252` 被判成两部不同的作品。
        """
        for payload in (
            {"id": "3701252", "content_id": "3701252",
             "source_url": "https://fc2cmadb.com/articles/3701252"},
            {"content_id": "3701252"},
        ):
            self.assertTrue(identifies_code("FC2-PPV-3701252", payload))
        self.assertFalse(identifies_code("FC2-PPV-3701252", {"id": "3701253"}))

    def test_javbus_loose_search_results_are_a_different_release(self):
        """javbus 搜不到就返回首个近似命中，两个方向都要认出来。

        字母段被补长（`AR-101` 取回 `STAR-101`）和数字段被补长（`259LUXU-764`
        取回 `259LUXU-1764`）都是别的作品，来源自报的番号是唯一能认出它的证据。
        """
        for code, returned in (
            ("AR-101", "STAR-101"), ("AR-102", "ZMAR-102"), ("WX17", "WXSD-017"),
            ("CD-101", "BCDP-101"), ("259LUXU-764", "259LUXU-1764"),
            ("259LUXU-164", "259LUXU-1642"),
        ):
            self.assertFalse(identifies_code(code, {
                "id": returned, "content_id": returned,
                "source_url": f"https://www.javbus.com/ja/{returned}"}), f"{code} <- {returned}")



if __name__ == "__main__":
    unittest.main()


class MetadataInterfaceTextTests(unittest.TestCase):
    """登录墙的理由与候选旁证的说法带 code，英文界面按 code 拿到英文（ADR-0159）。"""

    def test_an_authentication_wall_reason_renders_in_the_interface_language(self):
        from peach import interface_text
        from peach.metadata import auth_wall, reason_blames_credentials
        reason = auth_wall(status_code=401)
        self.assertEqual(interface_text.text(f"server:{reason['code']}", reason["params"], language="en"),
                         "The source returned 401; rerun with different credentials")
        self.assertTrue(reason_blames_credentials(reason))
        self.assertFalse(reason_blames_credentials(auth_wall(status_code=403)))
        # 当作鉴权报错的参数时，整句跟着同一语言渲染。
        error = auth_error("javdb", reason, status_code=401)
        self.assertEqual(interface_text.text(f"server:{error.code}", error.params, language="en").split(": ", 1)[1],
                         "The source returned 401; rerun with different credentials")

    def test_catalog_evidence_carries_codes_beside_the_original_wording(self):
        from peach import interface_text
        evidence = extract_catalog_evidence({
            "runtime": 120,
            "screenshot_urls": [f"https://img{index}.example/{index}.jpg" for index in range(30)],
        })
        screenshots = evidence["screenshot_urls"]
        self.assertTrue(screenshots["display_value"].endswith("张截图（img0.example、img1.example 等）"))
        self.assertEqual(
            interface_text.text(f"server:{screenshots['display_value_code']}",
                                {**screenshots["display_value_params"], "hosts": "img0.example, img1.example"},
                                language="en"),
            f"{len(screenshots['value'])} screenshots (img0.example, img1.example and more)")
        self.assertEqual(len(screenshots["warning_codes"]), len(screenshots["warnings"]))
        self.assertEqual(
            interface_text.text(f"server:{screenshots['warning_codes'][0]}", screenshots["warning_params"][0],
                                language="en").split(".")[0],
            "The source returned 30 links")
        self.assertEqual(evidence["runtime"]["display_value"], "120 分钟")
        self.assertEqual(interface_text.text(f"server:{evidence['runtime']['display_value_code']}",
                                             evidence["runtime"]["display_value_params"], language="en"), "120 min")
