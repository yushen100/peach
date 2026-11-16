"""书脊番号：番号比对的容错，按番号框定折痕，以及装封面时把番号框写进边车。"""
from __future__ import annotations

import unittest

from peach import jav_poster_crop, spine_label
from peach.jav_poster_crop import FOLD, ColumnProfile, PortraitMatch, SLEEVE


class CodePatternTests(unittest.TestCase):
    def test_a_dropped_or_confused_character_still_matches(self):
        """识别偶尔丢字或认混：CEAD-731 读成 cead31，UNT-017 读成 unto17。"""
        for code, word in (("CEAD-731", "cead31"), ("UNT-017", "unto17"), ("NAMH-042", "namho42"),
                           ("JBS-016", "jbs016"), ("118ABW-232", "abw232"), ("SSIS-001", "xxssis00001yy")):
            with self.subTest(code=code):
                self.assertTrue(spine_label.CodePattern(code).matches(word))

    def test_the_letters_must_appear_as_printed(self):
        """字母段不能凑：封底小字里碰巧的数字串、另一部作品的番号都不算。"""
        pattern = spine_label.CodePattern("JUR-908")
        for word in ("908", "jr908", "jux908", "jur123"):
            with self.subTest(word=word):
                self.assertFalse(pattern.matches(word))
        self.assertFalse(spine_label.CodePattern("").matches("abc123"))


class LabelFoldTests(unittest.TestCase):
    def profile(self, seams: dict[int, float], width: int = 2184) -> ColumnProfile:
        found = ColumnProfile([0.1] * width, [0.3] * width)
        for column, coverage in seams.items():
            found.seams[column] = coverage
        return found

    def test_the_first_full_height_edge_right_of_the_label_is_the_fold(self):
        """JBS-016 型：番号框 1796～1964，书脊右缘 1977；正封里的闪粉框 2023 不算。"""
        profile = self.profile({1977: .86, 2023: .86}, width=3762)
        self.assertEqual(jav_poster_crop.label_fold(3762, 2535, profile, (1796, 1964), 1977), 1978)

    def test_without_a_measurable_edge_the_standard_position_is_used(self):
        """JUR-908 型：书脊与正封色差太小测不出边，标准位置落在番号框右侧就用它。"""
        self.assertEqual(jav_poster_crop.label_fold(2184, 1468, self.profile({}), (1045, 1139), 1151), 1151)

    def test_a_label_on_the_back_cover_does_not_move_the_cut(self):
        """封底靠书脊那一角的番号：右边最近的边是书脊左缘，离标准位置太远，不采信。"""
        profile = self.profile({1036: .9})
        self.assertIsNone(jav_poster_crop.label_fold(2184, 1468, profile, (960, 1030), 1151))

    def test_a_photo_edge_inside_the_label_slack_is_not_the_fold(self):
        """MIDV-922 型：框右缘 1137，往左 4 列是书脊照片的右缘（0.61），真书脊右缘在 1150（0.94）。"""
        profile = self.profile({1132: .61, 1150: .94})
        self.assertEqual(jav_poster_crop.label_fold(2184, 1468, profile, (1040, 1137), 1152), 1151)

    def test_a_clear_edge_just_inside_the_label_is_still_the_fold(self):
        """AARM-001 型：框比书脊宽出几列，书脊右缘落在框右缘左边，边够明显照样认。"""
        profile = self.profile({1138: .81, 1149: .85})
        self.assertEqual(jav_poster_crop.label_fold(2184, 1468, profile, (1040, 1142), 1152), 1139)

    def test_an_unmeasurable_edge_trusts_the_old_fold_when_a_template_agrees(self):
        """VEC-789 型：书脊与正封同为深色测不出边，原有判据 1163 与同前缀实测样本推出的 1165 吻合，不退标准位置。"""
        width, height = 2184, 1474
        profile = ColumnProfile([0.1] * width, [0.2] * width)
        profile[1162], profile.seams[1162] = 3.0, .35
        templates = jav_poster_crop.learn_templates([("VEC-762", {"px": [width, height], "spine": [1044, 1140],
                                                                  "box": {"x0": 1165, "method": FOLD}})])
        self.assertEqual(templates, {}, "一张样本不单独当模板用")
        record = jav_poster_crop.crop_record("VEC-789", width, height, profile, spine=(1044, 1139), templates=templates)
        self.assertEqual((record["box"]["x0"], record["spine_edge"]), (1163, False))
        alone = jav_poster_crop.crop_record("VEC-789", width, height, profile, spine=(1044, 1139))
        self.assertNotEqual(alone["box"]["x0"], 1163, "没有印证的依据照旧退标准位置")

    def test_the_label_overrides_the_gradient_guess_and_is_recorded(self):
        found = PortraitMatch(SLEEVE, .99, 950, 1800)
        profile = self.profile({953: .96, 954: .96, 971: .7}, width=1800)
        record = jav_poster_crop.crop_record("UNT-017", 1800, 1196, profile, portrait=found, spine=(858, 941))
        self.assertEqual((record["box"]["method"], record["box"]["x0"]), (FOLD, 955))
        self.assertEqual(jav_poster_crop.spine_of(record), (858, 941))

    def test_a_label_that_moves_nothing_is_not_recorded(self):
        """番号框没定下切点（封底那一角）就不记：模板只从按书脊番号定了切点的封面学。"""
        record = jav_poster_crop.crop_record("JUR-908", 2184, 1468, self.profile({1036: .9}), spine=(960, 1030))
        self.assertNotIn("spine", record)

    def test_a_poster_ignores_a_stray_label(self):
        found = PortraitMatch(jav_poster_crop.POSTER, .1, 900, 1990)
        record = jav_poster_crop.crop_record("START-404", 2184, 1542, self.profile({1150: .9}),
                                             portrait=found, spine=(1050, 1140))
        self.assertEqual(record["box"]["method"], jav_poster_crop.NONE)


def labelled(code: str, width: int, height: int, x0: int) -> tuple[str, dict]:
    return code, {"px": [width, height], "box": {"x0": x0, "method": FOLD}, "spine": [x0 - 90, x0 - 10]}


class TemplateTests(unittest.TestCase):
    def test_a_small_cover_takes_the_fold_its_label_shows_on_large_covers(self):
        """同前缀同比例：大图上认出番号的 1150 列，按正封宽高比换算到 800 宽的小图是 421 列。"""
        templates = jav_poster_crop.learn_templates([labelled("SSNI-001", 2184, 1468, 1150),
                                                     labelled("SSNI-002", 2184, 1468, 1152)])
        profile = ColumnProfile([0.1] * 800, [0.3] * 800)
        profile.seams[416] = .9
        record = jav_poster_crop.crop_record("SSNI-495", 800, 538, profile, templates=templates)
        self.assertEqual((record["box"]["method"], record["box"]["x0"]), (FOLD, 421))

    def test_disagreeing_samples_teach_nothing(self):
        templates = jav_poster_crop.learn_templates([labelled("ABC-001", 2184, 1468, 1150),
                                                     labelled("ABC-002", 2184, 1468, 1190)])
        self.assertEqual(templates, {})

    def test_one_sample_or_unlabelled_records_teach_nothing(self):
        unlabelled = ("ABC-003", {"px": [2184, 1468], "box": {"x0": 1150, "method": FOLD}})
        self.assertEqual(jav_poster_crop.learn_templates([labelled("ABC-001", 2184, 1468, 1150), unlabelled]), {})

    def test_another_prefix_or_ratio_is_another_template(self):
        templates = jav_poster_crop.learn_templates([labelled("SSNI-001", 2184, 1468, 1150),
                                                     labelled("SSNI-002", 2184, 1468, 1150)])
        self.assertIsNone(jav_poster_crop.template_fold("SSIS-001", 2184, 1468, templates))
        self.assertIsNone(jav_poster_crop.template_fold("SSNI-003", 2184, 1542, templates))


class OffRatioFoldTests(unittest.TestCase):
    def test_a_weak_fold_on_a_promotional_ratio_shows_the_whole_picture(self):
        """4:3 的整幅宣传图：人物轮廓被当成折痕，切点处满高覆盖只有 0.2，整幅显示（FKOS-005）。"""
        profile = ColumnProfile([0.1] * 2184, [0.2] * 2184)
        profile[1021] = 3.0
        found = jav_poster_crop.crop_record("FKOS-005", 2184, 1639, profile)
        self.assertEqual(found["box"]["method"], jav_poster_crop.NONE)

    def test_a_full_height_fold_on_an_off_ratio_sleeve_still_cuts(self):
        """SOD 1.416 的封套书脊右缘满高（STZY-019）：照样切。"""
        width, height = 2184, 1542
        profile = ColumnProfile([0.1] * width, [0.1] * width)
        for column in (1094, 1205):
            profile[column], profile.seams[column] = 3.0, 1.0
        found = jav_poster_crop.crop_record("STZY-019", width, height, profile)
        self.assertEqual(found["box"]["method"], FOLD)


class TextAcrossTests(unittest.TestCase):
    def test_only_wide_text_reaching_well_past_both_sides_counts(self):
        """图高 1000、切线 1100：伸出两边各 40 像素以上的横排框才算。"""
        boxes = [(900, 50, 400, 80),     # 大标题横跨：算
                 (1000, 900, 300, 60),   # 底部宣传语横跨：算
                 (1080, 300, 60, 300),   # 竖排框（书脊字连着正封标题）：不算
                 (1070, 600, 200, 40),   # 左边只伸出 30：不算
                 (1200, 700, 300, 50)]   # 整个在正封里：不算
        self.assertEqual(spine_label.count_across(boxes, 1100, 1000), 2)

    def test_text_across_the_cut_shows_the_whole_picture(self):
        """MXDLP-318 型：标准封套比例、没有书脊，「中出し」和底部宣传语横跨切线。"""
        record = jav_poster_crop.crop_record("MXDLP-318", 2184, 1472, ColumnProfile([0.1] * 2184, [0.3] * 2184),
                                             text_across=lambda cut: 5)
        self.assertEqual(record["box"]["method"], jav_poster_crop.NONE)

    def test_one_crossing_or_a_read_spine_keeps_the_cut(self):
        profile = ColumnProfile([0.1] * 2184, [0.3] * 2184)
        once = jav_poster_crop.crop_record("SSIS-001", 2184, 1468, profile, text_across=lambda cut: 1)
        self.assertNotEqual(once["box"]["method"], jav_poster_crop.NONE)
        labelled = jav_poster_crop.crop_record("JUR-908", 2184, 1468, profile, spine=(1045, 1139),
                                               text_across=lambda cut: 9)
        self.assertEqual((labelled["box"]["method"], labelled["box"]["x0"]), (FOLD, 1151))


def reader_available() -> bool:
    return spine_label.default_reader() is not None


@unittest.skipUnless(reader_available(), "本机没有书脊识别模型")
class ReaderTests(unittest.TestCase):
    def test_a_printed_code_on_a_drawn_spine_is_found(self):
        """合成一条书脊：深色竖带上竖排印着番号，识别框落在竖带里。"""
        import cv2
        import numpy

        image = numpy.full((1468, 2184, 3), 200, numpy.uint8)
        image[:, 1040:1151] = (40, 40, 40)
        label = numpy.full((40, 420, 3), 40, numpy.uint8)
        cv2.putText(label, "JUR-908", (8, 32), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)
        image[900:1320, 1075:1115] = cv2.rotate(label, cv2.ROTATE_90_CLOCKWISE)
        box = spine_label.default_reader().code_box(image, "JUR-908", 1151)
        self.assertIsNotNone(box)
        self.assertTrue(1040 <= box[0] < box[1] <= 1151, box)


if __name__ == "__main__":
    unittest.main()
