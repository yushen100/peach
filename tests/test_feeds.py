"""番号发现源：解析、两层去重、已读与忽略、空壳与真实资产的边界（ADR-0042）。"""
from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from peach import feeds  # noqa: E402
from peach.migrations import upgrade  # noqa: E402
from peach.repository import LedgerDatabase  # noqa: E402
from peach.sources.dmm import ActressWorks, ListedWork  # noqa: E402

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"

JAVDB_ACTOR = """
<div class="movie-list h cols-4 vcols-8">
  <div class="item">
    <a href="/v/5nr8mp" class="box" title="ignored">
      <div class="cover"><img src="x.jpg" /></div>
      <div class="video-title"><strong>PBD-528</strong> 気高きお姉さん達</div>
      <div class="score"><span class="value">4.0分</span></div>
      <div class="meta">
        2026-10-20
      </div>
    </a>
  </div>
  <div class="item">
    <a href="/v/RkPb5z" class="box" title="ignored">
      <div class="cover"><img src="y.jpg" /></div>
      <div class="video-title"><strong>BBSS-106</strong> 別の作品</div>
      <div class="meta">
        2026-10-13
      </div>
    </a>
  </div>
  <div class="item">
    <a href="/v/Zx9Qa1" class="box" title="ignored">
      <div class="cover"><img src="z.jpg" /></div>
      <div class="video-title"><strong></strong> 合集 30 部打包</div>
      <div class="meta">
        2026-10-01
      </div>
    </a>
  </div>
</div>
"""

#: 旧艺名那一页：`/actors/MmbDR`（白石アイリ）2026-09-28 抓回来的标题栏与空列表。
JAVDB_EMPTY_ACTOR = """
<div class="columns is-desktop section-columns">
  <div class="column section-title">
    <h2 class="title is-4 has-text-justified">
      <span class="actor-section-name">白石アイリ</span>
      <br>
      <span class="section-meta">0 部影片</span>
    </h2>
  </div>
</div>
  <div class="empty-message">暂无内容</div>
"""

#: 本名那一页（`/actors/bkxd`）的标题栏：别名一行在前，作品数一行在后。
JAVDB_ACTOR_HEADER = """
    <h2 class="title is-4 has-text-justified">
      <span class="actor-section-name">森日向子</span>
        <br>
        <span class="section-meta">朝比奈えみり, ひー, ひなこちゃん, 雛子ちゃん, 日向結衣</span>
      <br>
      <span class="section-meta">1060 部影片</span>
    </h2>
"""


def _database(root: Path) -> LedgerDatabase:
    path = root / "ledger.db"
    upgrade(path, MIGRATIONS)
    return LedgerDatabase(path)


class FeedParsingTest(unittest.TestCase):
    def test_code_is_found_inside_a_title_full_of_prose(self):
        # 整段丢给 `release_code_from_text` 认不出来，词元扫描才认得出。
        title = "HMN-071 新人 帶來超稀有妹子 戶川步[有碼高清中文字幕]"
        self.assertEqual(feeds.scan_code(title), "HMN-071")
        self.assertEqual(feeds.scan_code("[H265 1080p] DSOD-114 花宮京子"), "DSOD-114")
        self.assertIsNone(feeds.scan_code("合集 30 部打包"))

    def test_javdb_actor_page_reads_code_and_release_date(self):
        parsed = feeds.parse_javdb_actor(JAVDB_ACTOR, "https://javdb.com/actors/pRMq")
        self.assertEqual([entry.item_key for entry in parsed.entries],
                         ["/v/5nr8mp", "/v/RkPb5z", "/v/Zx9Qa1"])
        self.assertEqual(parsed.entries[0].code, "PBD-528")
        self.assertEqual(parsed.entries[0].link, "https://javdb.com/v/5nr8mp")
        self.assertEqual(parsed.entries[0].published_at, "2026-10-20T00:00:00.000Z")
        self.assertIsNone(parsed.entries[2].code)

    def test_an_unknown_kind_is_a_parse_failure(self):
        # 账本里若留着别的类型，拉取把原因写在那一行上，不拿演员页的解析器硬读。
        self.assertIsNone(feeds.parse("rss", JAVDB_ACTOR.encode("utf-8"),
                                      "https://example.test/rss"))

    def test_a_page_without_any_work_is_a_failure_not_an_empty_poll(self):
        # 带查询串的演员页会回一份不含作品的页面。当成「这次没有新作」会让一个坏掉的
        # 订阅永远不报错。
        self.assertIsNone(feeds.parse_javdb_actor("<html>nothing</html>",
                                                  "https://javdb.com/actors/pRMq"))

    def test_a_page_that_says_it_has_no_work_is_a_quiet_source(self):
        # 旧艺名页常年是空的；页面自报 0 部，它就是一个没有作品的真实源。
        parsed = feeds.parse_javdb_actor(JAVDB_EMPTY_ACTOR, "https://javdb.com/actors/MmbDR")
        self.assertEqual((parsed.title, parsed.entries), ("白石アイリ", ()))

    def test_a_page_that_claims_works_but_lists_none_is_still_a_failure(self):
        self.assertIsNone(feeds.parse_javdb_actor(
            JAVDB_ACTOR_HEADER + '<div class="empty-message">暂无内容</div>',
            "https://javdb.com/actors/bkxd"))

    def test_the_page_name_is_read_from_the_title_bar(self):
        parsed = feeds.parse_javdb_actor(JAVDB_ACTOR_HEADER + JAVDB_ACTOR,
                                         "https://javdb.com/actors/bkxd")
        self.assertEqual(parsed.title, "森日向子")
        self.assertEqual(len(parsed.entries), 3)


class CompilationTest(unittest.TestCase):
    """标题与名单取自一份订阅实际抓回的壳。"""

    def test_marked_titles_and_long_cast_lists_are_group_compilations(self):
        cast = "、".join(f"女優{index}" for index in range(8))
        for title, performers in (
                ("ひくひくアナル丸見え！デカ尻バック激ピストンBEST", "奏音かのん、丘えりな"),
                ("乱交ベスト", ""),
                ("主観手コキ50連発", ""),
                ("絶対忠実秘書 BEST 8時間 Vol.01", "八掛うみ、野々浦暖"),
                ("季刊性年KMP 花火 ノーカット 1397分", ""),
                ("レス界隈奥さん他人棒で淫乱覚醒する巨乳人妻", cast)):
            with self.subTest(title=title):
                self.assertEqual(feeds.compilation_kind(title, performers), feeds.GROUP_COMPILATION)

    def test_one_listed_performer_with_a_marked_title_is_a_solo_compilation(self):
        for title in ("涼森れむ 8時間 BEST PRESTIGE PREMIUM RESTRICTED vol.12",
                      "涼森れむ 480分 総集編"):
            with self.subTest(title=title):
                self.assertEqual(feeds.compilation_kind(title, "涼森れむ"), feeds.SOLO_COMPILATION)

    def test_a_few_co_stars_and_ordinary_titles_are_not_compilations(self):
        for title, performers in (
                ("初めてのセックスが大優勝 ～神女優で童貞卒業～", "鈴村あいり、涼森れむ、八掛うみ"),
                ("月刊ハメ撮り 本能剥き出し3本番 涼森れむ", "涼森れむ"),
                ("BESTIE と過ごす2時間", ""),
                (None, None)):
            with self.subTest(title=title):
                self.assertIsNone(feeds.compilation_kind(title, performers))

    def test_the_highlight_studio_is_an_excerpt_whatever_the_title_says(self):
        self.assertEqual(feeds.compilation_kind("愛する妻が…", "篠田ゆう", "ハイライト"),
                         feeds.EXCERPT)
        self.assertEqual(feeds.compilation_kind("涼森れむ 480分 総集編", "涼森れむ", "ハイライト"),
                         feeds.EXCERPT)
        self.assertIsNone(feeds.compilation_kind("愛する妻が…", "篠田ゆう", "マドンナ"))


class FeedPhaseTest(unittest.TestCase):
    """下次拉取按源的相位排（ADR-0134）：同时加的源错开，跳与跳之间的延迟不累积。"""

    MOMENT = datetime(2026, 11, 3, 3, 28, 57, tzinfo=timezone.utc)
    PERIOD = timedelta(minutes=feeds.DEFAULT_INTERVAL_MINUTES)

    def test_sources_fetched_together_spread_over_the_window(self):
        upcoming = sorted(feeds.next_fetch(source_id, self.MOMENT, feeds.DEFAULT_INTERVAL_MINUTES)
                          for source_id in range(1, 12))
        for moment in upcoming:
            self.assertGreaterEqual(moment, self.MOMENT + self.PERIOD / 2)
            self.assertLessEqual(moment, self.MOMENT + self.PERIOD * 1.5)
        slots = {int((moment.timestamp() % self.PERIOD.total_seconds())
                     // timedelta(minutes=feeds.TICK_MINUTES).total_seconds()) for moment in upcoming}
        # 11 个源落进 12 个半小时档里的至少 9 个：一跳最多拉两三个，而不是 11 个一起。
        self.assertGreaterEqual(len(slots), 9)

    def test_tick_lag_does_not_drift_the_schedule(self):
        """到期之后要等到下一跳才拉，拉完排的下次仍回到同一个相位，周期保持一个间隔。"""
        moment = self.MOMENT
        due = feeds.next_fetch(7, moment, feeds.DEFAULT_INTERVAL_MINUTES)
        for lag in (timedelta(minutes=29), timedelta(minutes=3), timedelta(minutes=17)):
            fetched = due + lag
            following = feeds.next_fetch(7, fetched, feeds.DEFAULT_INTERVAL_MINUTES)
            self.assertAlmostEqual((following - due).total_seconds(),
                                   self.PERIOD.total_seconds(), places=2)
            due = following


class HistoricalFeedOverflowRepairTest(unittest.TestCase):
    """旧版已经把超过 20 条的作品记为已见时，只按确定证据补建。"""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.database = _database(Path(self._tmp.name))

    def _old_batch(self, connection, source_id, *, count=35, shells=20,
                   moment="2026-10-25T00:00:00.000Z"):
        entries = tuple(feeds.FeedEntry(
            f"/v/old{source_id}-{i}", f"PBD-{100 + i:03d}",
            f"https://javdb.com/v/old{source_id}-{i}") for i in range(count))
        for entry in reversed(entries):
            feeds.record_entry(connection, source_id, entry,
                               code=entry.code, now=moment)
        for entry in entries[:shells]:
            feeds.create_shell(connection, entry.code, source_id=source_id,
                               title=entry.title, link=entry.link, now=moment)
        return entries

    def test_old_overflow_restores_fifteen_shells_and_is_idempotent(self):
        from peach import feed_overflow_repair

        with self.database.write_transaction() as connection:
            source = feeds.add_source(connection, url="https://javdb.com/actors/ab1")
            entries = self._old_batch(connection, source)
            planned = feed_overflow_repair.candidates(connection)
            self.assertEqual({row["code"] for row in planned},
                             {entry.code for entry in entries[20:]})
            outcome = feed_overflow_repair.repair(connection)
            repeated = feed_overflow_repair.repair(connection)
        self.assertEqual(outcome["candidates"], 15)
        self.assertEqual(len(outcome["created"]), 15)
        self.assertIsNone(repeated)
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM feed_item").fetchone()[0], 35)
            self.assertEqual(connection.execute("SELECT count(*) FROM feed_discovery").fetchone()[0], 35)
            self.assertEqual(feed_overflow_repair.candidates(connection), [])
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM ledger_upgrade_repair WHERE id=?",
                (feed_overflow_repair.RECEIPT_KEY,)).fetchone()[0], 1)
            self.assertEqual(connection.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_excludes_library_ignored_and_hidden_compilations(self):
        from peach import feed_overflow_repair

        with self.database.write_transaction() as connection:
            source = feeds.add_source(connection, url="https://javdb.com/actors/ab1")
            self._old_batch(connection, source)
            connection.execute(
                "INSERT INTO asset(location,path,name,medium,code) "
                "VALUES('R','R:\\\\video\\\\old.mp4','old.mp4','video','PBD-132')")
            other = feeds.add_source(connection, url="https://javdb.com/actors/ab2")
            ignored = feeds.create_shell(connection, "PBD-133", source_id=other,
                                         now="2026-10-24T00:00:00.000Z")
            connection.execute("UPDATE feed_discovery SET ignored_at=? WHERE id=?",
                               (feeds.stamp(), ignored))
            connection.execute("UPDATE feed_item SET title='PBD-134 BEST 総集編'"
                               " WHERE source_id=? AND code='PBD-134'", (source,))
            planned = feed_overflow_repair.candidates(connection)
            self.assertEqual({row["code"] for row in planned},
                             {f"PBD-{n:03d}" for n in range(120, 132)})
            outcome = feed_overflow_repair.repair(connection)
        self.assertEqual(len(outcome["created"]), 12)
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute(
                "SELECT ignored_at FROM feed_discovery WHERE id=?", (ignored,)).fetchone()[0] is not None,
                True)
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_discovery").fetchone()[0], 33)

    def test_incomplete_batch_and_disabled_source_are_not_repaired(self):
        from peach import feed_overflow_repair

        with self.database.write_transaction() as connection:
            incomplete = feeds.add_source(connection, url="https://javdb.com/actors/ab1")
            self._old_batch(connection, incomplete, shells=19)
            disabled = feeds.add_source(connection, url="https://javdb.com/actors/ab2")
            self._old_batch(connection, disabled)
            feeds.set_enabled(connection, disabled, False)
            self.assertEqual(feed_overflow_repair.candidates(connection), [])
            outcome = feed_overflow_repair.repair(connection)
        self.assertEqual(outcome["created"], [])

class FeedStoreTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.database = _database(self.root)
        self.addCleanup(self._tmp.cleanup)

    def _source(self, **kwargs) -> int:
        with self.database.write_transaction() as connection:
            return feeds.add_source(connection,
                                    url=kwargs.pop("url", "https://javdb.com/actors/pRMq"),
                                    **kwargs)

    def _poll(self, source_id: int) -> dict:
        parsed = feeds.parse_javdb_actor(JAVDB_ACTOR, "https://javdb.com/actors/pRMq")
        with self.database.write_transaction() as connection:
            source = connection.execute("SELECT * FROM feed_source WHERE id=?",
                                        (source_id,)).fetchone()
            return feeds.poll(connection, source, parsed)

    def test_https_only(self):
        with self.assertRaises(ValueError):
            feeds.normalize_url("http://example.test/rss")

    def test_same_url_twice_is_refused(self):
        self._source()
        with self.assertRaises(ValueError):
            self._source()

    def test_first_poll_records_every_entry_and_shells_the_coded_ones(self):
        source_id = self._source()
        outcome = self._poll(source_id)
        self.assertEqual(outcome["seen"], 3)
        self.assertEqual(outcome["fresh"], 3)
        # 解不出番号的条目照样记一行，只是不建壳。
        self.assertEqual(outcome["without_code"], 1)
        self.assertEqual(sorted(code for _id, code in outcome["created"]),
                         ["BBSS-106", "PBD-528"])
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_item").fetchone()[0], 3)

    def test_more_than_twenty_new_works_all_have_shells_and_keep_backlog(self):
        # 一页 35 部新作：仅 20 部进入本轮后继，另外 15 部不能只记为已见。
        from peach import feed_followup

        source_id = self._source()
        entries = tuple(feeds.FeedEntry(
            f"/v/test{index}", f"FNS-{index + 100:03d}",
            f"https://javdb.com/v/test{index}") for index in range(35))
        parsed = feeds.ParsedFeed("测试演员", entries)
        with self.database.write_transaction() as connection:
            source = connection.execute(
                "SELECT * FROM feed_source WHERE id=?", (source_id,)).fetchone()
            first = feeds.poll(connection, source, parsed)
            second = feeds.poll(connection, source, parsed)

        self.assertEqual(first["fresh"], 35)
        self.assertEqual(len(first["created"]), feeds.MAX_NEW_PER_POLL)
        self.assertEqual(second["fresh"], 0)
        self.assertEqual(second["created"], [])
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_item WHERE source_id=?",
                (source_id,)).fetchone()[0], 35)
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_discovery").fetchone()[0], 35)
            first_codes = [code for _id, code in first["created"]]
            backlog = feed_followup.scrape_batch(connection, exclude=first_codes)
            self.assertEqual(len(backlog), 15)
            self.assertTrue(set(backlog).isdisjoint(first_codes))

    def test_second_poll_of_the_same_document_creates_nothing(self):
        source_id = self._source()
        self._poll(source_id)
        outcome = self._poll(source_id)
        self.assertEqual(outcome["fresh"], 0)
        self.assertEqual(outcome["created"], [])

    def test_two_sources_reporting_one_code_share_a_single_shell(self):
        first = self._source(url="https://javdb.com/actors/pRMq")
        second = self._source(url="https://javdb.com/actors/d45k9")
        self._poll(first)
        outcome = self._poll(second)
        # 源内那一层是各自的，所以第二个源仍然把三条都记成新条目……
        self.assertEqual(outcome["fresh"], 3)
        # ……但全局那一层只认番号，壳一个都不再建。
        self.assertEqual(outcome["created"], [])
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_discovery").fetchone()[0], 2)
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_item").fetchone()[0], 6)

    def test_a_code_already_in_the_library_gets_no_shell(self):
        with self.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO asset(location,path,name,medium,code) "
                "VALUES('R','R:\\\\media\\\\pbd528.mp4','pbd528.mp4','video','pbd00528')")
        source_id = self._source()
        outcome = self._poll(source_id)
        # 归一化之后 `pbd00528` 与 `PBD-528` 是同一部片。
        self.assertEqual([code for _id, code in outcome["created"]], ["BBSS-106"])

    def test_read_and_ignore_are_independent_and_do_not_touch_dedupe(self):
        source_id = self._source()
        created = self._poll(source_id)["created"]
        discovery_id = created[0][0]
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE feed_discovery SET read_at=? WHERE id=?",
                               (feeds.stamp(), discovery_id))
            connection.execute("UPDATE feed_discovery SET ignored_at=? WHERE id=?",
                               (feeds.stamp(), discovery_id))
            row = connection.execute(
                "SELECT read_at,ignored_at FROM feed_discovery WHERE id=?",
                (discovery_id,)).fetchone()
        self.assertIsNotNone(row["read_at"])
        self.assertIsNotNone(row["ignored_at"])
        # 忽略之后再拉一轮，这条既不重建也不变回未忽略。
        outcome = self._poll(source_id)
        self.assertEqual(outcome["created"], [])
        with self.database.read_connection() as connection:
            row = connection.execute(
                "SELECT ignored_at FROM feed_discovery WHERE id=?",
                (discovery_id,)).fetchone()
        self.assertIsNotNone(row["ignored_at"])

    def test_settle_writes_the_next_time_on_every_path(self):
        source_id = self._source()
        with self.database.write_transaction() as connection:
            feeds.settle(connection, source_id, error="来源回了 HTTP 503",
                         interval_minutes=60)
        with self.database.read_connection() as connection:
            row = connection.execute("SELECT * FROM feed_source WHERE id=?",
                                     (source_id,)).fetchone()
        self.assertEqual(row["last_error"], "来源回了 HTTP 503")
        self.assertIsNotNone(row["next_fetch_at"])
        self.assertGreater(row["next_fetch_at"], row["last_fetched_at"])

    def test_disabled_sources_are_never_due(self):
        source_id = self._source()
        with self.database.write_transaction() as connection:
            feeds.set_enabled(connection, source_id, False)
        with self.database.read_connection() as connection:
            self.assertEqual(feeds.due_sources(connection), [])

    def test_the_longest_waiting_source_is_due_first(self):
        first = self._source(url="https://javdb.com/actors/a1")
        second = self._source(url="https://javdb.com/actors/a2")
        fresh = self._source(url="https://javdb.com/actors/a3")
        with self.database.write_transaction() as connection:
            feeds.defer(connection, first, datetime(2026, 11, 3, 2, tzinfo=timezone.utc))
            feeds.defer(connection, second, datetime(2026, 11, 3, 1, tzinfo=timezone.utc))
        with self.database.read_connection() as connection:
            due = [int(row["id"]) for row in feeds.due_sources(connection, "2026-11-03T03:00:00Z")]
        self.assertEqual(due, [fresh, second, first])

    def test_settle_after_a_cooldown_retries_at_its_end(self):
        source_id = self._source()
        until = datetime(2026, 11, 3, 3, 15, tzinfo=timezone.utc)
        with self.database.write_transaction() as connection:
            feeds.settle(connection, source_id, error="来源拒绝访问", interval_minutes=360,
                         now=datetime(2026, 11, 3, 3, tzinfo=timezone.utc), retry_at=until)
            row = connection.execute("SELECT next_fetch_at FROM feed_source WHERE id=?",
                                     (source_id,)).fetchone()
        self.assertEqual(row[0], feeds.stamp(until))

    def test_performer_names_match_existing_entities_only(self):
        with self.database.write_transaction() as connection:
            connection.execute(
                "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
                " VALUES('performer','深田えいみ',peach_normalize('深田えいみ'),?,?)",
                (feeds.stamp(), feeds.stamp()))
        with self.database.read_connection() as connection:
            found = feeds.match_performers(connection, ["深田えいみ", "查无此人"])
        self.assertEqual(len(found), 1)


def dmm_works(*rows) -> ActressWorks:
    """DMM 片单：每行（cid, 官方番号, 发售日, 预购, 出演）。"""
    return ActressWorks(name="森日向子", total=len(rows), works=tuple(
        ListedWork(cid=cid, title="作品タイトル", maker_code=code, release_date=date,
                   pre_order=pre_order, performers=tuple(cast), studio="ムーディーズ")
        for cid, code, date, pre_order, cast in rows))


#: 2026-11-04 实测片单里的几种：预购的单体作品、和 JavDB 同一部、分卷、几十人的合集。
DMM_WORKS = dmm_works(
    ("mikr00133", "MIKR-133", "2026-11-13", True, ["森日向子"]),
    ("pbd00528", "PBD-528", "2026-10-20", False, ["森日向子", "共演者"]),
    ("h_068mxdlp00343", "MXDLP-0343", "2026-10-01", False, ["森日向子"]),
    ("h_1454jksr74802", "JKSR-748-02", "2026-09-01", False, ["森日向子"]),
    ("mizd00570", "MIZD-570", "2026-11-27", True, [f"女優{index}" for index in range(37)]),
)


class DmmActressFeedTest(unittest.TestCase):
    """DMM 按女优编号的片单当第二个发现源：番号写法、跨源去重、合集与补订（ADR-0135）。"""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.database = _database(Path(self._tmp.name))
        with self.database.write_transaction() as connection:
            self.performer = self._performer(connection, "森日向子", [("r18dev", "1061586")])

    @staticmethod
    def _performer(connection, name, refs) -> int:
        entity_id = int(connection.execute(
            "INSERT INTO entity(kind,canonical_name,normalized_name,created_at,updated_at)"
            " VALUES('performer',?,peach_normalize(?),?,?)",
            (name, name, feeds.stamp(), feeds.stamp())).lastrowid)
        for provider, external_id in refs:
            connection.execute(
                "INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id)"
                " VALUES(?,?,'performer',?)", (entity_id, provider, external_id))
        return entity_id

    def _poll(self, source_id, parsed, hidden=feeds.DEFAULT_HIDDEN_COMPILATIONS) -> dict:
        with self.database.write_transaction() as connection:
            source = connection.execute("SELECT * FROM feed_source WHERE id=?", (source_id,)).fetchone()
            return feeds.poll(connection, source, parsed, hidden)

    def _add(self, url) -> int:
        with self.database.write_transaction() as connection:
            return feeds.add_source(connection, url=url, entity_id=self.performer)

    def test_entries_carry_the_official_code_in_the_same_spelling_as_javdb(self):
        parsed = feeds.parse_dmm_actress(DMM_WORKS)
        self.assertEqual(parsed.title, "森日向子")
        self.assertEqual([entry.code for entry in parsed.entries],
                         ["MIKR-133", "PBD-528", "MXDLP-343", None, "MIZD-570"])
        head = parsed.entries[0]
        self.assertEqual((head.item_key, head.link, head.published_at[:10], head.title),
                         ("mikr00133", "https://video.dmm.co.jp/av/content/?id=mikr00133",
                          "2026-11-13", "MIKR-133 作品タイトル"))
        # 官方番号没问到时不回头从标题里找。
        blank = feeds.parse_dmm_actress(dmm_works(("x1", "", "", False, [])))
        self.assertIsNone(blank.entries[0].code)

    def test_dmm_and_javdb_reporting_one_work_share_a_single_shell(self):
        javdb = self._add("https://javdb.com/actors/pRMq")
        self._poll(javdb, feeds.parse_javdb_actor(JAVDB_ACTOR, "https://javdb.com/actors/pRMq"))
        dmm = self._add(feeds.dmm_actress_url("1061586"))
        outcome = self._poll(dmm, feeds.parse_dmm_actress(DMM_WORKS))
        # 预购的 MIKR-133 与 MXDLP-343 建壳；PBD-528 已有 JavDB 的壳；分卷认不出番号；合集收起。
        self.assertEqual([code for _id, code in outcome["created"]], ["MIKR-133", "MXDLP-343"])
        self.assertEqual((outcome["fresh"], outcome["without_code"], outcome["compilations"]), (5, 1, 1))
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_discovery WHERE code='PBD-528'").fetchone()[0], 1)
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_item WHERE code='PBD-528'").fetchone()[0], 2)
            shell = connection.execute(
                "SELECT release_date,performers,studio FROM feed_discovery WHERE code='MIKR-133'").fetchone()
        self.assertEqual(tuple(shell), ("2026-11-13", "森日向子", "ムーディーズ"))
        # 合集开关打开时那一部照常建壳。
        other = self._add(feeds.dmm_actress_url("1047128"))
        shown = self._poll(other, feeds.parse_dmm_actress(DMM_WORKS), hidden=frozenset())
        self.assertEqual([code for _id, code in shown["created"]], ["MIZD-570"])

    def test_actress_ids_come_from_dmm_and_r18dev_evidence(self):
        with self.database.write_transaction() as connection:
            for provider, value in (("dmm", "1061586"), ("dmm", "1047128"), ("javdb", "bkxd"),
                                    ("avwikidb", "5555"), ("dmm", "not-a-number")):
                connection.execute(
                    "INSERT OR IGNORE INTO entity_external_ref(entity_id,provider,external_kind,external_id)"
                    " VALUES(?,?,'performer',?)", (self.performer, provider, value))
            ids = feeds.dmm_actress_ids(connection, self.performer)
        self.assertEqual(ids, ["1047128", "1061586"])
        self.assertEqual(feeds.dmm_actress_id(feeds.dmm_actress_url("1061586")), "1061586")
        self.assertEqual(feeds.dmm_actress_id("https://javdb.com/actors/pRMq"), "")
        self.assertEqual(feeds.kind_of(feeds.dmm_actress_url("1061586")), feeds.KIND_DMM_ACTRESS)
        with self.assertRaises(ValueError):
            feeds.dmm_actress_url("1061586&x=1")

    def test_sync_adds_dmm_sources_only_for_followed_people_with_an_id(self):
        with self.database.write_transaction() as connection:
            nameless = self._performer(connection, "編号なし", [("javdb", "Zz9")])
            # 有 DMM 编号但没订阅的人不补。
            self._performer(connection, "未订阅", [("r18dev", "1000001")])
            for entity_id, page in ((self.performer, "pRMq"), (nameless, "Zz9")):
                feeds.add_source(connection, url=f"https://javdb.com/actors/{page}", entity_id=entity_id)
            created = feeds.sync_dmm_sources(connection)
            rows = connection.execute(
                "SELECT kind,url,entity_id FROM feed_source WHERE id IN (%s)" % ",".join("?" * len(created)),
                created).fetchall()
        self.assertEqual([tuple(row) for row in rows],
                         [(feeds.KIND_DMM_ACTRESS, "https://video.dmm.co.jp/av/list/?actress=1061586",
                           self.performer)])
        # 用户单独停掉的 DMM 那一条不会被重新打开，也不另建一条。
        with self.database.write_transaction() as connection:
            feeds.set_enabled(connection, created[0], False)
            self.assertEqual(feeds.sync_dmm_sources(connection), [])
            self.assertTrue(feeds.entity_following(connection, self.performer))
            feeds.unfollow_entity(connection, self.performer)
            self.assertFalse(feeds.entity_following(connection, self.performer))
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_source WHERE enabled=1").fetchone()[0], 1)


class ShellBoundaryTest(unittest.TestCase):
    """壳不进 asset，所以整理、抽帧与馆藏统计看不到它（ADR-0042 第二条）。"""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.database = _database(Path(self._tmp.name))
        self.addCleanup(self._tmp.cleanup)

    def _poll_once(self, connection) -> int:
        source_id = feeds.add_source(connection, url="https://javdb.com/actors/pRMq")
        feeds.poll(connection, connection.execute(
            "SELECT * FROM feed_source WHERE id=?", (source_id,)).fetchone(),
            feeds.parse_javdb_actor(JAVDB_ACTOR, "https://javdb.com/actors/pRMq"))
        return source_id

    def test_a_shell_adds_no_asset_row(self):
        with self.database.write_transaction() as connection:
            self._poll_once(connection)
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM asset").fetchone()[0], 0)
            self.assertGreater(connection.execute(
                "SELECT count(*) FROM feed_discovery").fetchone()[0], 0)

    def test_the_shell_table_is_not_an_asset_reference(self):
        # 物理删除资产时要清的引用名单里没有它：壳不引用 asset，两者只按番号对上。
        from peach.web_batch import ASSET_REFERENCE_TABLES
        self.assertNotIn("feed_discovery", ASSET_REFERENCE_TABLES)
        self.assertNotIn("feed_item", ASSET_REFERENCE_TABLES)

    def test_deleting_a_source_takes_its_items_but_leaves_the_shell(self):
        # 壳是「这个番号还没入库」，它不该随着某个订阅被删而消失。连接和服务一样不开
        # 外键：子表靠 `remove_source` 自己处理，不靠建表时的 CASCADE 声明。
        with self.database.write_transaction() as connection:
            feeds.remove_source(connection, self._poll_once(connection))
        with self.database.read_connection() as connection:
            self.assertEqual(connection.execute(
                "SELECT count(*) FROM feed_item").fetchone()[0], 0)
            self.assertEqual(tuple(connection.execute(
                "SELECT count(*), count(source_id) FROM feed_discovery").fetchone()), (2, 0))
            self.assertEqual(connection.execute("PRAGMA foreign_key_check").fetchall(), [])


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
