"""「修复与迁移」里两项 rule34 补填：升级后自动在后台限速补、回执记原值、中断续跑；页面的分组与排序。

用临时账本和假连接器，不访问真实站点。等待只记秒数不真睡。
"""
import json
import tempfile
import unittest
from pathlib import Path

from peach import follow_backfill, repair_center
from peach.follow_backfill import Backfill
from peach.follow_sources import Rule34VideoConnector
from peach.http import HttpResponse
from peach.repository import LedgerDatabase
from peach.task_runs import TaskRunStore
from peach.user_messages import UserValueError
from support.ledger import fresh_ledger

#: 这一版第一次启动补修旧版数据的时刻（`legacy_repairs.RULES` 的回执），之后首次入库的条目不用问。
UPGRADED = 1_790_000_000.0  # 2026-09-21T...Z
BEFORE, AFTER = "2026-08-01T00:00:00Z", "2026-12-01T00:00:00Z"

CHARACTER_PAGE = (
    b'<html><body><div class="vp-group vp-group--characters">'
    b'<a class="tag_item" href="https://rule34video.com/tags/h/">harry potter (harry potter)</a></div>'
    b'<div class="vp-group"><a class="tag_item" href="https://rule34video.com/tags/s/">sex</a></div></body></html>')
PLAIN_PAGE = (b'<html><body><div class="vp-group">'
              b'<a class="tag_item" href="https://rule34video.com/tags/s/">sex</a></div></body></html>')


class FollowBackfillTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.path = fresh_ledger(self.root)
        self.database = LedgerDatabase(self.path)
        self.runs = TaskRunStore(self.database)
        self.waits: list[float] = []
        with self.database.write_transaction() as connection:
            connection.execute("INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)",
                               ("entity-link-values-1", str(UPGRADED), '{"changed": 0}'))

    # ---- 准备 ----

    def source(self, provider: str) -> int:
        with self.database.write_transaction() as connection:
            return connection.execute(
                "INSERT INTO follow_source(provider,ref,label,url,semantics,created_at,updated_at)"
                " VALUES(?,?,?,?,'work',?,?)",
                (provider, provider, provider, f"https://{provider}.test/", BEFORE, BEFORE)).lastrowid

    def item(self, source_id: int, external_id: str, *, url=None, media_url=None, published_at=None,
             duration=None, metadata=None, first_seen=BEFORE) -> int:
        with self.database.write_transaction() as connection:
            return connection.execute(
                "INSERT INTO follow_item(source_id,external_id,title,url,media_url,published_at,duration,release_key,"
                "metadata_json,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (source_id, external_id, external_id, url, media_url, published_at, duration, external_id,
                 json.dumps(metadata or {}), first_seen, first_seen)).lastrowid

    def metadata(self, item_id: int) -> dict:
        with self.database.read_connection() as connection:
            return json.loads(connection.execute("SELECT metadata_json FROM follow_item WHERE id=?",
                                                 (item_id,)).fetchone()[0])

    def backfill(self, connector, *, credential=None) -> Backfill:
        store = type("Store", (), {"load": lambda _self, provider: credential})()
        return Backfill(self.database, runs=self.runs, credentials=store, sleep=self.waits.append,
                        connector_factory=lambda provider, **_: connector,
                        backup=lambda prefix: self.root / f"ledger.pre-{prefix}.db")

    def settle(self, backfill: Backfill) -> None:
        for worker in list(backfill.workers.values()):
            worker.join(30)
            self.assertFalse(worker.is_alive())

    def center_item(self, backfill: Backfill, item: str) -> tuple[dict | None, dict]:
        with self.database.read_connection() as connection:
            center = repair_center.snapshot(connection, {}, cloud_pending=0,
                                            follow_backfill_status=backfill.snapshot(connection))
        return next((row for row in center["items"] if row["id"] == item), None), center

    def receipt(self, job) -> tuple[str, dict]:
        with self.database.read_connection() as connection:
            return follow_backfill.receipts(connection, job)[0]

    # ---- rule34video ----

    def test_video_characters_start_by_themselves_and_retype_only_the_site_character_group(self):
        source_id = self.source("rule34video")
        old = {"tags": ["harry potter (harry potter)", "sex"],
               "tag_types": {"harry potter (harry potter)": "general", "sex": "general"}}
        retyped = self.item(source_id, "1", url="https://rule34video.com/video/1/a/", metadata=old)
        plain = self.item(source_id, "2", url="https://rule34video.com/video/2/b/",
                          metadata={"tag_types": {"sex": "general"}})
        gone = self.item(source_id, "3", url="https://rule34video.com/video/3/c/",
                         metadata={"tag_types": {"sex": "general"}})
        limited = self.item(source_id, "4", url="https://rule34video.com/video/4/d/", metadata=old)
        # 不用问的：已经有角色的（现行解析或补填过）、没有类型的（常规检查补）、升级之后才入库的。
        self.item(source_id, "5", url="https://rule34video.com/video/5/e/",
                  metadata={"tag_types": {"x (y)": "character"}})
        self.item(source_id, "6", url="https://rule34video.com/video/6/f/", metadata={"tags": []})
        self.item(source_id, "7", url="https://rule34video.com/video/7/g/", metadata=old, first_seen=AFTER)
        pages = {"1": [HttpResponse(200, {}, CHARACTER_PAGE)], "2": [HttpResponse(200, {}, PLAIN_PAGE)],
                 "3": [HttpResponse(404, {}, b"")],
                 "4": [HttpResponse(429, {}, b""), HttpResponse(200, {}, CHARACTER_PAGE)]}
        asked = []

        def transport(request, _timeout, _limit):
            video = request.url.split("/")[4]
            asked.append(video)
            return pages[video].pop(0)

        backfill = self.backfill(Rule34VideoConnector(transport=transport, sleeper=lambda _: None))
        # 判据确定、只补缺的、回执记着原值：不等确认，账本就绪就自动开始。
        queued, _ = self.center_item(backfill, "rule34video-characters")
        self.assertEqual((queued["mode"], queued["group"], queued["state"], queued["pending"], queued["online"]),
                         ("auto", "follow", "pending", 4, True))
        backfill.start()
        self.settle(backfill)
        # 每条 1 次详情页；429 静默 120 秒后重问同一条。
        self.assertEqual(asked, ["1", "2", "3", "4", "4"])
        self.assertGreaterEqual(sum(self.waits), follow_backfill.VIDEO_COOLDOWN)
        expected = {**old, "tag_types": {**old["tag_types"], "harry potter (harry potter)": "character"}}
        self.assertEqual(self.metadata(retyped), expected)
        self.assertEqual(self.metadata(limited), expected)
        self.assertEqual(self.metadata(plain), {"tag_types": {"sex": "general"}})
        self.assertEqual(self.metadata(gone), {"tag_types": {"sex": "general"}})

        # 回执记改动前的类型和问定的条目，备份路径也在；没有剩下的，这一项报改了几处。
        receipt_id, receipt = self.receipt(follow_backfill.VIDEO)
        self.assertTrue(receipt_id.startswith("rule34video-characters-"))
        self.assertEqual(receipt["state"], "done")
        self.assertEqual(sorted(receipt["checked"]), [retyped, plain, gone, limited])
        self.assertEqual(receipt["rows"], [{"item_id": retyped, "tag_types": old["tag_types"]},
                                           {"item_id": limited, "tag_types": old["tag_types"]}])
        self.assertEqual(receipt["backup"], str(self.root / "ledger.pre-rule34video-characters-.db"))
        done, center = self.center_item(backfill, "rule34video-characters")
        self.assertEqual((done["state"], done["changed"]), ("done", 2))
        self.assertIn(("rule34video 的角色分类", 2), [(row["title"], row["changed"]) for row in center["history"]])
        run = self.runs.query(task_key="follow-backfill")[0]
        self.assertEqual((run.status, run.progress_current, run.progress_total), ("succeeded", 4, 4))

    def test_video_misses_stay_pending_and_repeated_rate_limits_stop_the_run(self):
        source_id = self.source("rule34video")
        typed = {"tag_types": {"sex": "general"}}
        first = self.item(source_id, "1", url="https://rule34video.com/video/1/a/", metadata=typed)
        self.item(source_id, "2", url="https://rule34video.com/video/2/b/", metadata=typed)
        # 5xx 由连接器自己重试 5 次，仍不行才算这一条取不到。
        answers = [HttpResponse(503, {}, b"")] * 5 + [HttpResponse(429, {}, b"")] * 3

        backfill = self.backfill(Rule34VideoConnector(transport=lambda *_: answers.pop(0), sleeper=lambda _: None))
        backfill.begin("rule34video-characters")
        self.settle(backfill)
        _, receipt = self.receipt(follow_backfill.VIDEO)
        # 5xx 取不到的下一趟再问；连着三次 429 停下，剩下的也留着。
        self.assertEqual((receipt["state"], receipt["checked"], receipt["missed"]), ("failed", [], [first]))
        queued, _ = self.center_item(backfill, "rule34video-characters")
        self.assertEqual((queued["state"], queued["pending"]), ("pending", 2))
        self.assertEqual(self.runs.query(task_key="follow-backfill")[0].status, "failed")
        # 下次启动再补，接着用第一趟的备份，不再备份账本。
        answers.extend([HttpResponse(200, {}, PLAIN_PAGE)] * 2)
        backups = []
        backfill.backup = backups.append
        backfill.start()
        self.settle(backfill)
        self.assertEqual(backups, [])
        self.assertEqual(self.center_item(backfill, "rule34video-characters")[0], None)

    # ---- rule34.xxx ----

    def test_post_details_fill_only_the_gaps_and_keep_the_previous_values(self):
        source_id = self.source("rule34xxx")
        untyped = self.item(source_id, "100", media_url="https://cdn.test/a.mp4",
                            published_at="2026-09-14T03:02:05Z", metadata={"tags": "a b"})
        no_length = self.item(source_id, "101", media_url="https://cdn.test/b.mp4", published_at=BEFORE,
                              metadata={"tag_types": {"b": "general"}})
        complete = self.item(source_id, "102", media_url="https://cdn.test/c.jpeg", published_at=BEFORE,
                             metadata={"tag_types": {"c": "general"}})
        detail_asked, heads = [], []

        class Connector:
            def _detail(self, post_id):
                detail_asked.append(post_id)
                return {"tag_types": {"a": "artist"}, "published_at": "2026-05-01T16:32:21Z"}

            def _video_seconds(self, url):
                heads.append(url)
                return 60.054

        # 没有 dapi 凭据就起不来：页面报原因，不联网。
        backfill = self.backfill(Connector())
        backfill.start()
        self.settle(backfill)
        with self.assertRaises(UserValueError) as missing:
            backfill.begin("rule34-details")
        self.assertEqual(missing.exception.code, "errors.followBackfill.credentialMissing")
        blocked, _ = self.center_item(backfill, "rule34-details")
        self.assertEqual((blocked["state"], blocked["pending"]), ("failed", 2))
        self.assertIn("API", blocked["error"])
        self.assertEqual(detail_asked, [])

        backfill = self.backfill(Connector(), credential=object())
        backfill.begin("rule34-details")
        self.settle(backfill)
        # 缺类型的问 dapi，只缺时长的只读文件头；齐全的不问。每条间隔 2.2 秒。
        self.assertEqual(detail_asked, ["100"])
        self.assertEqual(heads, ["https://cdn.test/a.mp4", "https://cdn.test/b.mp4"])
        self.assertAlmostEqual(sum(self.waits), follow_backfill.POST_DELAY, delta=0.2)
        with self.database.read_connection() as connection:
            rows = {row[0]: tuple(row[1:]) for row in connection.execute(
                "SELECT id, published_at, published_precision, duration, metadata_json FROM follow_item")}
        self.assertEqual(rows[untyped], ("2026-05-01T16:32:21Z", "exact", 60.054,
                                         json.dumps({"tags": "a b", "tag_types": {"a": "artist"}})))
        self.assertEqual(rows[no_length][2], 60.054)
        self.assertEqual(rows[no_length][0], BEFORE)
        self.assertIsNone(rows[complete][2])
        _, receipt = self.receipt(follow_backfill.POST)
        self.assertEqual(receipt["rows"], [
            {"item_id": untyped, "published_at": "2026-09-14T03:02:05Z", "duration": None, "tag_types": None},
            {"item_id": no_length, "published_at": BEFORE, "duration": None, "tag_types": {"b": "general"}}])
        done, _ = self.center_item(backfill, "rule34-details")
        self.assertEqual((done["state"], done["changed"]), ("done", 2))

    def test_post_miss_streak_cools_down_and_retries_the_streak_once(self):
        source_id = self.source("rule34xxx")
        ids = [self.item(source_id, str(200 + index), media_url="https://cdn.test/x.jpeg")
               for index in range(follow_backfill.MISS_STREAK_LIMIT + 1)]
        asked, last = [], str(200 + follow_backfill.MISS_STREAK_LIMIT)

        class Connector:
            def _detail(self, post_id):
                asked.append(post_id)
                # 头一轮全被挡回来；冷却之后都取得到，最后一条是删了的帖子。
                if len(asked) <= follow_backfill.MISS_STREAK_LIMIT or post_id == last:
                    return {}
                return {"tag_types": {"t": "general"}}

            def _video_seconds(self, url):
                return None

        backfill = self.backfill(Connector(), credential=object())
        backfill.begin("rule34-details")
        self.settle(backfill)
        self.assertGreaterEqual(sum(self.waits), follow_backfill.POST_COOLDOWN)
        self.assertEqual(len(asked), follow_backfill.MISS_STREAK_LIMIT * 2 + 1)
        _, receipt = self.receipt(follow_backfill.POST)
        self.assertEqual(receipt["state"], "done")
        self.assertEqual(receipt["changed"], follow_backfill.MISS_STREAK_LIMIT)
        # 零星取不到的（帖子删了）记进 missed，不再算待处理。
        self.assertEqual(receipt["missed"], [ids[-1]])
        done, _ = self.center_item(backfill, "rule34-details")
        self.assertEqual((done["state"], done["changed"]), ("done", follow_backfill.MISS_STREAK_LIMIT))

    # ---- 中断与续跑 ----

    def test_an_interrupted_run_resumes_on_start_and_skips_what_it_already_checked(self):
        source_id = self.source("rule34video")
        typed = {"tag_types": {"harry potter (harry potter)": "general"}}
        first = self.item(source_id, "1", url="https://rule34video.com/video/1/a/", metadata=typed)
        second = self.item(source_id, "2", url="https://rule34video.com/video/2/b/", metadata=typed)
        with self.database.write_transaction() as connection:
            connection.execute("INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)",
                               ("rule34video-characters-1", "1790000100", json.dumps(
                                   {"state": "running", "checked": [first], "missed": [], "rows": [],
                                    "changed": 0, "backup": "ledger.pre-x.db"})))
        asked = []

        def transport(request, _timeout, _limit):
            asked.append(request.url)
            return HttpResponse(200, {}, CHARACTER_PAGE)

        backfill = self.backfill(Rule34VideoConnector(transport=transport, sleeper=lambda _: None))
        backfill.start()
        self.settle(backfill)
        self.assertEqual(asked, ["https://rule34video.com/video/2/b/"])
        receipt_id, receipt = self.receipt(follow_backfill.VIDEO)
        # 接着写同一张回执：问定的合在一起，备份仍是第一次开始前那份。
        self.assertEqual(receipt_id, "rule34video-characters-1")
        self.assertEqual((receipt["state"], receipt["checked"], receipt["backup"]),
                         ("done", [first, second], "ledger.pre-x.db"))
        self.assertEqual(self.metadata(first), typed)
        # 不是本机写入端时启动不续跑。
        with self.database.write_transaction() as connection:
            connection.execute("UPDATE ledger_upgrade_repair SET result_json=json_set(result_json,'$.state','running')"
                               " WHERE id='rule34video-characters-1'")
        idle = Backfill(self.database, available=lambda: False)
        idle.start()
        self.assertEqual(idle.workers, {})

    def test_service_shutdown_stops_between_items_and_leaves_the_receipt_resumable(self):
        source_id = self.source("rule34video")
        typed = {"tag_types": {"sex": "general"}}
        for index in range(3):
            self.item(source_id, str(index), url=f"https://rule34video.com/video/{index}/a/", metadata=typed)
        asked = []

        def transport(request, _timeout, _limit):
            asked.append(request.url)
            if len(asked) == 2:
                backfill._stopping.set()
            return HttpResponse(200, {}, PLAIN_PAGE)

        backfill = self.backfill(Rule34VideoConnector(transport=transport, sleeper=lambda _: None))
        backfill.begin("rule34video-characters")
        self.settle(backfill)
        self.assertEqual(len(asked), 2)
        _, receipt = self.receipt(follow_backfill.VIDEO)
        self.assertEqual((receipt["state"], len(receipt["checked"])), ("running", 2))
        with self.database.read_connection() as connection:
            self.assertEqual(len(follow_backfill.pending(connection, follow_backfill.VIDEO)), 1)


    # ---- 页面分组 ----

    def test_every_repair_item_sits_in_one_group_and_items_needing_attention_lead_each_group(self):
        from peach import legacy_repairs
        placed = [item for item, _, _ in repair_center.ITEMS]
        self.assertEqual(len(placed), len(set(placed)))
        self.assertLessEqual({*(rule.item for rule in legacy_repairs.RULES), *(rule.item for rule in legacy_repairs.CONFIRMS),
                              *(job.item for job in follow_backfill.JOBS)}, set(placed))
        modes = {item: mode for item, mode, _ in repair_center.ITEMS}
        self.assertEqual({item for item, mode in modes.items() if mode == "confirm"},
                         {"display-cloud", "follow-evidence", *(rule.item for rule in legacy_repairs.CONFIRMS)})
        # 关注组里补填在跑、旧快照等确认、蓝光去重做完：等确认的排最前，做完的垫底；组按登记顺序。
        with self.database.write_transaction() as connection:
            connection.execute("INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)",
                               ("feed-bluray-duplicates-1", "1", '{"changed": 3}'))
            connection.execute("INSERT INTO ledger_upgrade_repair(id,applied_at,result_json) VALUES(?,?,?)",
                               ("interface-text-codes-1", "1", '{"rows": [1]}'))
        with self.database.read_connection() as connection:
            center = repair_center.snapshot(
                connection, {}, cloud_pending=0, follow_evidence_status={"phase": "ready", "files": 4, "bytes": 9},
                follow_backfill_status={"rule34video-characters": {"phase": "running", "done": 1, "total": 3}})
        self.assertEqual([(row["group"], row["id"], row["state"]) for row in center["items"]], [
            ("follow", "follow-evidence", "waiting"), ("follow", "rule34video-characters", "running"),
            ("follow", "bluray-duplicates", "done"), ("records", "interface-text", "done")])


if __name__ == "__main__":
    unittest.main()
