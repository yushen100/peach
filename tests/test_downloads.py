"""云下载的任务模型：磁力解析、状态机、幂等接管、拉黑、退避、停滞与落地登记。

远端一律是假 provider，账本是临时库。落地那几条用真实的推送发现服务与临时目录：
远端完成之后账本里有没有那个文件，走的是和推送通知同一段登记。
"""
from __future__ import annotations

import json
import os
import sqlite3
import tempfile
import threading
import unittest
from contextlib import closing
from pathlib import Path, PureWindowsPath
from unittest.mock import patch

from peach import downloads as dl
from peach import interface_text
from peach import push_discovery as push
from peach import wants
from peach.follow_secrets import CredentialStore
from peach.repository import LedgerDatabase
from support.ledger import fresh_ledger

HASH = "c9e15763f722f23e98a29decdfae341b98d53056"
MAGNET = f"magnet:?xt=urn:btih:{HASH}&dn=ABC-123"
CLOUD_LEDGER_ROOT = "B:\\"
UNREACHABLE = "查离线任务时连不上 CloudDrive2：Deadline Exceeded"


def unreachable() -> dl.DownloadError:
    """一次瞬时网络故障，渲染出来就是 `UNREACHABLE`。"""
    return dl.DownloadError("network", "errors.downloadsClouddrive.unreachable",
                            {"action": "查离线任务", "details": "Deadline Exceeded"})


class FakeProvider:
    """记下每一次调用；`statuses` 依次吐出，吐完就重复最后一个。"""

    def __init__(self, key="115"):
        self.key = key
        self.submitted: list[tuple[str, str]] = []
        self.cancelled: list[int] = []
        self.submit_result: dl.RemoteStatus | Exception = dl.RemoteStatus(dl.RUNNING, "r1", "ABC-123")
        self.statuses: list[dl.RemoteStatus | Exception] = [dl.RemoteStatus(dl.RUNNING, "r1", "ABC-123", 0.2)]
        self.is_landed = False

    def submit(self, magnet, target):
        self.submitted.append((magnet.info_hash, target))
        if isinstance(self.submit_result, Exception):
            raise self.submit_result
        return self.submit_result

    def status(self, task):
        item = self.statuses[0] if len(self.statuses) == 1 else self.statuses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    def landed(self, task):
        return self.is_landed

    def cancel(self, task):
        self.cancelled.append(task.id)


class Clock:
    def __init__(self, start=1_800_000_000.0):
        self.now = start

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class MagnetTests(unittest.TestCase):
    def test_payload_exposes_a_display_code_without_changing_the_task(self):
        task = dl.DownloadTask(id=1, info_hash=HASH, provider="115", source_uri=MAGNET,
                               display_name="ABC-123.mp4", target="/cloud", state=dl.SUBMITTED)
        self.assertEqual(task.payload()["display_code"], "ABC-123")
        self.assertIsNone(task.code)
        task.remote_name = "XYZ-999.mp4"
        self.assertIsNone(task.payload()["display_code"])
        task.remote_name = None
        task.display_name = "无编号作品.mp4"
        self.assertIsNone(task.payload()["display_code"])

    def test_hex_and_base32_spellings_are_one_key(self):
        base32 = "ZHQVOY7XELZD5GFCTXWN7LRUDOMNKMCW"
        self.assertEqual(dl.normalise_info_hash(base32), HASH)
        self.assertEqual(dl.parse_magnet(f"magnet:?xt=urn:btih:{base32}").info_hash, HASH)
        self.assertEqual(dl.parse_magnet(HASH.upper()).info_hash, HASH)

    def test_the_display_name_comes_from_dn(self):
        magnet = dl.parse_magnet(MAGNET)
        self.assertEqual((magnet.info_hash, magnet.name, magnet.uri), (HASH, "ABC-123", MAGNET))

    def test_scrambled_trackers_are_dropped_before_submission(self):
        # DASD-911 的原始磁力：最后一个 tracker 被打乱，115 因此整条判为「错误的链接」。
        good = "&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce"
        raw = f"magnet:?xt=urn:btih:{HASH}&dn=ABC-123{good}&tr=udp%3A%2F%2FexoduecnuonnaF2%9696A3%moc.cnysed.s"
        self.assertEqual(dl.parse_magnet(raw).uri, f"magnet:?xt=urn:btih:{HASH}&dn=ABC-123{good}")
        self.assertEqual(dl.parse_magnet(MAGNET).uri, MAGNET)

    def test_links_without_a_btih_are_refused(self):
        for bad in ("", "magnet:?dn=x", "magnet:?xt=urn:btmh:1220abcd", "https://example.com/a",
                    "abc"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                dl.parse_magnet(bad)

    def test_remote_messages_are_sorted_into_the_twelve_kinds(self):
        cases = {
            "errno 50038 涉嫌违规": ("rejected", True),
            "本月离线配额已用完": ("quota", False),
            "code: 190031, message: 云空间不足，请扩容空间或升级VIP": ("storage", False),
            "任务已存在": ("duplicate", False),
            "链接无效": ("invalid_link", False),
            "something else": ("rejected", False),
        }
        for message, (failure, block) in cases.items():
            with self.subTest(message=message):
                error = dl.classify_remote_message(message)
                self.assertEqual((error.failure, error.block), (failure, block))
        self.assertEqual(set(dl.FAILURE_KINDS), {
            "config", "quota", "storage", "rejected", "invalid_link", "no_source", "duplicate",
            "not_landed", "mismatch", "network", "not_accepted", "removed"})
        self.assertEqual([key for key, kind in dl.FAILURE_KINDS.items() if kind.retryable],
                         ["network"])


class _Deployment(unittest.TestCase):
    """临时账本、一个 115 网盘来源和真实的推送发现服务。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.db = fresh_ledger(self.root)
        self.cloud = self.root / "cloud"
        (self.cloud / "云下载").mkdir(parents=True)
        if os.name == "nt":
            self.declared, self.mounts = {"115": (str(self.cloud),)}, {}
        else:
            self.declared, self.mounts = {"115": (CLOUD_LEDGER_ROOT,)}, {"115": (str(self.cloud),)}
        self.push = push.PushDiscoveryService(
            state_root=self.root / "state", secrets_root=self.root / "secrets", db_path=self.db,
            declared_roots=self.declared, mounts=self.mounts)
        self.addCleanup(self.push.stop)
        self.push.save({"enabled": False, "cloud": False, "watch_local": False, "prefixes": [
            {"prefix": "/115", "root": self.declared["115"][0]}]})
        self.provider = FakeProvider()
        self.clock = Clock()
        self.credentials = CredentialStore(self.root / "secrets")
        self.service = dl.DownloadService(
            database=LedgerDatabase(self.db), state_root=self.root / "state",
            credentials=self.credentials, providers=lambda key: self.provider,
            landing=dl.Landing(self.push), clock=self.clock)
        self.service.save_settings({"targets": {"115": "/115/云下载"}}, self.declared)

    def ledger(self, *parts) -> str:
        return str(PureWindowsPath(self.declared["115"][0]).joinpath(*parts))

    def submissions(self) -> list[tuple]:
        connection = sqlite3.connect(self.db)
        try:
            return connection.execute(
                "SELECT outcome,failure,provider,origin FROM download_submission ORDER BY id").fetchall()
        finally:
            connection.close()

    def submit(self, **overrides):
        body = {"magnet": MAGNET, "provider": "115", "origin": "paste", **overrides}
        return dl.submit_offline_download(self.service, **body)

    def tick(self, seconds):
        self.clock.advance(seconds)
        return self.service.poll_once()


class SubmitTests(_Deployment):
    def test_a_submission_is_recorded_and_checked_after_ten_seconds(self):
        result = self.submit(code="ABC-123")
        self.assertEqual(result["outcome"], "submitted")
        task = result["task"]
        self.assertEqual((task["state"], task["info_hash"], task["target"], task["code"]),
                         (dl.SUBMITTED, HASH, "/115/云下载", "ABC-123"))
        self.assertEqual(self.provider.submitted, [(HASH, "/115/云下载")])
        self.assertEqual(self.tick(9), 0)
        self.assertEqual(self.tick(1), 1)
        self.assertEqual(self.service.store.get(task["id"]).state, dl.REMOTE_RUNNING)
        self.assertEqual(self.submissions(), [("submitted", None, "115", "paste")])

    def test_the_same_infohash_is_taken_over_instead_of_submitted_again(self):
        first = self.submit()
        second = self.submit(magnet=HASH, origin="wishlist:7")
        self.assertEqual(second["outcome"], "adopted")
        self.assertEqual(second["task"]["id"], first["task"]["id"])
        self.assertEqual(len(self.provider.submitted), 1)
        self.assertEqual([row[0] for row in self.submissions()], ["submitted", "adopted"])

    def test_a_task_already_in_the_remote_folder_is_adopted_without_spending_quota(self):
        self.provider.submit_result = dl.RemoteStatus(dl.RUNNING, "r9", "ABC-123", adopted=True)
        self.assertEqual(self.submit()["outcome"], "adopted_remote")

    def test_a_failed_task_can_be_submitted_again_and_keeps_one_row(self):
        self.provider.submit_result = dl.DownloadError("quota", "errors.downloads.remoteQuota", {"text": "本月离线配额已用完"})
        failed = self.submit()
        self.assertEqual((failed["outcome"], failed["task"]["state"], failed["task"]["failure"]),
                         ("failed", dl.FAILED, "quota"))
        self.assertTrue(failed["task"]["resubmittable"])
        self.provider.submit_result = dl.RemoteStatus(dl.RUNNING, "r1", "ABC-123")
        again = self.submit()
        self.assertEqual((again["outcome"], again["task"]["id"]), ("submitted", failed["task"]["id"]))
        self.assertIsNone(again["task"]["failure"])
        self.assertEqual([row[:2] for row in self.submissions()],
                         [("failed", "quota"), ("submitted", None)])

    def test_full_storage_raises_a_channel_alert_until_the_next_successful_submission(self):
        self.provider.submit_result = dl.classify_remote_message("code: 190031, message: 云空间不足")
        failed = self.submit()
        self.assertEqual((failed["task"]["failure"], failed["task"]["failure_label"]), ("storage", "网盘空间不足"))
        alerts = self.service.snapshot()["channel_alerts"]
        self.assertEqual([(alert["provider"], alert["provider_label"], alert["failure"], alert["message_code"])
                          for alert in alerts], [("115", "115", "storage", "errors.downloads.remoteStorageFull")])
        # 资源本身的问题不算渠道告警，也不撤掉已有的告警。
        self.provider.submit_result = dl.classify_remote_message("链接无效")
        self.submit(magnet="b" * 40)
        self.assertEqual(self.service.channel_alert("115")["failure"], "storage")
        self.provider.submit_result = dl.RemoteStatus(dl.RUNNING, "r1", "ABC-123")
        self.assertEqual(self.submit()["outcome"], "submitted")
        self.assertIsNone(self.service.channel_alert("115"))
        self.assertEqual(self.service.snapshot()["channel_alerts"], [])

    def test_broken_settings_and_an_unreachable_service_are_channel_alerts_but_timeouts_are_not(self):
        self.provider.submit_result = dl.DownloadError("config", "errors.downloadsClouddrive.tokenMissing")
        self.submit()
        self.assertEqual(self.service.channel_alert("115")["failure"], "config")
        self.provider.submit_result = unreachable()
        self.submit(magnet="b" * 40)
        self.assertEqual(self.service.channel_alert("115")["failure"], "config")
        self.provider.submit_result = dl.DownloadError(
            "network", "errors.downloadsClouddrive.unreachable", {"action": "查离线任务", "details": "Connection refused"},
            channel_down=True)
        pending = self.submit(magnet="c" * 40)
        self.assertEqual((pending["outcome"], self.service.channel_alert("115")["failure"]), ("deferred", "network"))
        # 那条等待重新提交的任务交上之后，告警随之撤掉。
        self.provider.submit_result = dl.RemoteStatus(dl.RUNNING, "r1", "ABC-123")
        self.tick(dl.POLL_DELAYS[1])
        self.assertEqual(self.service.store.get(pending["task"]["id"]).state, dl.SUBMITTED)
        self.assertIsNone(self.service.channel_alert("115"))

    def test_a_network_failure_while_submitting_is_submitted_again_by_the_poller(self):
        self.provider.submit_result = unreachable()
        deferred = self.submit(code="ABC-123")
        task = deferred["task"]
        self.assertEqual((deferred["outcome"], task["state"], task["failure"], task["cancellable"]),
                         ("deferred", dl.SUBMIT_PENDING, None, True))
        self.assertEqual(task["failure_detail"], "查离线任务时连不上 CloudDrive2：Deadline Exceeded")
        # 同一番号或磁力在等待期间再提交，接管这一条，不另交一次。
        self.assertEqual(self.submit(magnet=HASH)["outcome"], "adopted")
        self.assertEqual(self.tick(29), 0)
        self.assertEqual(self.tick(1), 1)
        self.assertEqual(self.service.store.get(task["id"]).state, dl.SUBMIT_PENDING)
        self.provider.submit_result = dl.RemoteStatus(dl.RUNNING, "r1", "ABC-123")
        self.tick(dl.poll_delay(2))
        again = self.service.store.get(task["id"])
        self.assertEqual((again.state, again.checks, again.failure_detail, again.submitted_at),
                         (dl.SUBMITTED, 0, None, dl.iso(self.clock())))
        self.assertEqual(len(self.provider.submitted), 3)
        self.assertEqual([row[:2] for row in self.submissions()],
                         [("deferred", "network"), ("adopted", None), ("submitted", None)])
        self.tick(10)
        self.assertEqual(self.service.store.get(task["id"]).state, dl.REMOTE_RUNNING)

    def test_failure_reasons_keep_their_code_in_the_ledger_for_the_interface_language(self):
        from peach import interface_text
        self.provider.submit_result = dl.DownloadError("rejected", "errors.downloads.remoteRejectedNoReason")
        task_id = self.submit()["task"]["id"]
        stored = self.service.store.get(task_id).payload()
        self.assertEqual(stored["failure_detail_code"], "errors.downloads.remoteRejectedNoReason")
        self.assertEqual(interface_text.text(f"server:{stored['failure_detail_code']}", stored["failure_detail_params"], "en"),
                         "The remote side rejected this task without giving a reason")
        submitted = self.service.store.submissions(task_id)[-1]
        self.assertEqual((submitted["detail"], submitted["detail_code"]),
                         (stored["failure_detail"], "errors.downloads.remoteRejectedNoReason"))

    def test_a_submission_that_never_gets_through_fails_after_an_hour(self):
        self.provider.submit_result = unreachable()
        task_id = self.submit()["task"]["id"]
        while self.service.store.get(task_id).state == dl.SUBMIT_PENDING:
            self.tick(dl.POLL_DELAYS[-1])
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure), (dl.FAILED, "network"))
        self.assertGreaterEqual(self.clock() - 1_800_000_000.0, dl.SUBMIT_RETRY_WINDOW)
        self.assertRegex(task.failure_detail, r"^查离线任务时连不上 CloudDrive2：Deadline Exceeded（自动重试 \d+ 次后仍未提交）$")
        self.assertEqual((task.failure_detail.code, task.failure_detail.params["detail"]["code"]),
                         ("errors.downloads.retriesExhausted", "errors.downloadsClouddrive.unreachable"))
        self.assertTrue(task.payload()["resubmittable"])
        self.assertEqual(self.submissions()[-1][:2], ("failed", "network"))

    def test_reconciliation_during_a_slow_submission_does_not_mark_it_accepted(self):
        # 2026-11-12 的现场：提交线程卡在网盘接口上，后台对账读到这条「已提交」去查离线列表；
        # 查询期间提交超时、记成等待重新提交，对账随后把读到的旧状态写回，磁力从没交出去就被判网盘没收下。
        entered, release = threading.Event(), threading.Event()
        result = {}

        def slow_submit(magnet, target):
            self.provider.submitted.append((magnet.info_hash, target))
            entered.set()
            release.wait(5)
            raise unreachable()

        def status_while_submitting(task):
            release.set()
            worker.join(5)
            return dl.RemoteStatus(dl.MISSING)

        self.provider.submit, self.provider.status = slow_submit, status_while_submitting
        worker = threading.Thread(target=lambda: result.update(self.submit()))
        worker.start()
        self.assertTrue(entered.wait(5))
        self.service.poll_once()
        release.set()
        worker.join(5)
        task_id = result["task"]["id"]
        self.assertEqual(self.service.store.get(task_id).state, dl.SUBMIT_PENDING)
        # 到期后照常再交一次，这次交上了。
        self.provider.submit = FakeProvider.submit.__get__(self.provider)
        self.provider.status = FakeProvider.status.__get__(self.provider)
        self.tick(dl.POLL_DELAYS[1])
        self.assertEqual(self.service.store.get(task_id).state, dl.SUBMITTED)
        self.assertEqual(len(self.provider.submitted), 2)

    def test_a_task_waiting_to_be_submitted_again_is_cancelled_locally(self):
        self.provider.submit_result = unreachable()
        task_id = self.submit()["task"]["id"]
        self.assertEqual(self.service.cancel(task_id).state, dl.CANCELLED)
        self.assertEqual(self.provider.cancelled, [])
        self.assertEqual(self.tick(dl.POLL_DELAYS[-1]), 0)
        self.assertEqual(len(self.provider.submitted), 1)

    def test_a_blocked_infohash_is_refused_forever(self):
        self.provider.submit_result = dl.classify_remote_message("50038 违规")
        blocked = self.submit()
        self.assertTrue(blocked["task"]["blocked"])
        self.assertFalse(blocked["task"]["resubmittable"])
        self.assertEqual(self.submit()["outcome"], "refused")
        self.assertEqual(len(self.provider.submitted), 1)

    def test_bad_input_is_refused_before_anything_is_recorded(self):
        for overrides in ({"magnet": "not a magnet"}, {"provider": "thunder"},
                          {"target": "/"}, {"target": "/a/../b"}):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                self.submit(**overrides)
        self.assertEqual(self.submissions(), [])

    def test_the_reader_never_submits(self):
        self.service.available = False
        with self.assertRaisesRegex(ValueError, "只在允许修改数据库的设备上可用"):
            self.submit()


class PollingTests(_Deployment):
    def test_the_poll_interval_backs_off_and_caps(self):
        self.assertEqual([dl.poll_delay(n) for n in (0, 1, 2, 6, 40)], [10, 30, 60, 900, 900])
        task_id = self.submit()["task"]["id"]
        for _ in range(4):
            self.tick(dl.POLL_DELAYS[-1])
        task = self.service.store.get(task_id)
        self.assertEqual(task.checks, 4)
        self.assertEqual(dl.parse_iso(task.next_check_at) - self.clock(), dl.poll_delay(4))

    def test_a_network_blip_is_retried_and_other_failures_stop(self):
        task_id = self.submit()["task"]["id"]
        self.provider.statuses = [unreachable(),
                                  dl.RemoteStatus(dl.ERROR, "r1", "ABC-123", 0.1, "种子无人做种")]
        self.tick(10)
        self.assertEqual(self.service.store.get(task_id).state, dl.SUBMITTED)
        self.tick(30)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure), (dl.FAILED, "rejected"))

    def test_a_network_blip_reason_lasts_only_until_the_next_good_poll(self):
        task_id = self.submit()["task"]["id"]
        self.provider.statuses = [unreachable(), dl.RemoteStatus(dl.MISSING)]
        self.tick(10)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure, task.failure_detail), (dl.SUBMITTED, None, UNREACHABLE))
        # 远端列表里暂时没有、还在宽限期里：这一次查通了，上一次的连不上不再是现状。
        self.tick(30)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure_detail), (dl.SUBMITTED, None))

    def test_a_failure_reported_without_remote_text_keeps_the_channel_reason(self):
        task_id = self.submit()["task"]["id"]
        code = "errors.downloadsClouddrive.offlineFailed"
        self.provider.statuses = [dl.RemoteStatus(dl.ERROR, "r1", "", None, "ignored", message_code=code)]
        self.tick(10)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure), (dl.FAILED, "rejected"))
        self.assertEqual(task.failure_detail, "远端拒绝了这个任务：115 报告离线失败，多半是资源无人做种或被拒")

    def test_a_block_seen_while_polling_also_blacklists(self):
        task_id = self.submit()["task"]["id"]
        self.provider.statuses = [dl.RemoteStatus(dl.ERROR, "r1", "", None, "50038")]
        self.tick(10)
        self.assertTrue(self.service.store.get(task_id).blocked_at)

    def test_a_task_that_never_finishes_stalls_after_the_wait_limit(self):
        self.service.save_settings({"targets": {"115": "/115/云下载"}, "wait_hours": 1},
                                   self.declared)
        task_id = self.submit()["task"]["id"]
        self.tick(10)
        self.tick(3600)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure), (dl.STALLED, "no_source"))

    def test_a_stalled_task_that_finishes_later_still_lands(self):
        self.service.save_settings({"targets": {"115": "/115/云下载"}, "wait_hours": 1},
                                   self.declared)
        task_id = self.submit()["task"]["id"]
        self.tick(10)
        self.tick(3600)
        # 判停滞之后不再按秒级轮询，六小时看一眼。
        self.provider.statuses = [dl.RemoteStatus(dl.DONE, "r1", "ABC-123", 1.0)]
        self.assertEqual(self.tick(dl.STALL_RECHECK - 1), 0)
        self.tick(1)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure, task.finished_at), (dl.REMOTE_DONE, None, None))

    def test_stalled_rechecks_stop_after_the_horizon(self):
        self.service.save_settings({"targets": {"115": "/115/云下载"}, "wait_hours": 1},
                                   self.declared)
        task_id = self.submit()["task"]["id"]
        self.tick(10)
        self.tick(3600)
        checks = 0
        while self.service.store.get(task_id).next_check_at:
            checks += self.tick(dl.STALL_RECHECK)
        self.assertEqual(checks, int(dl.STALL_RECHECK_HORIZON // dl.STALL_RECHECK))
        self.assertEqual(self.service.store.get(task_id).state, dl.STALLED)

    def test_a_task_stalled_before_rechecks_existed_is_picked_up_within_the_horizon(self):
        """升级前判停滞的旧任务没有复查时间；停滞还没满期限的照样复查，满了的不再碰。"""
        self.service.save_settings({"targets": {"115": "/115/云下载"}, "wait_hours": 1},
                                   self.declared)
        recent, old = (self.submit(code=code, magnet=f"magnet:?xt=urn:btih:{digest}")["task"]["id"]
                       for code, digest in (("ABC-123", "a" * 40), ("ABC-456", "b" * 40)))
        self.tick(10)
        self.tick(3600)
        for task_id, age in ((recent, 3600.0), (old, dl.STALL_RECHECK_HORIZON)):
            task = self.service.store.get(task_id)
            self.assertEqual(task.state, dl.STALLED)
            task.next_check_at = None
            task.finished_at = dl.iso(self.clock() - age)
            self.service.store.save(task)
        self.assertEqual(self.service.store.next_due(self.clock()), 0.0)
        self.provider.statuses = [dl.RemoteStatus(dl.DONE, "r1", "ABC-123", 1.0)]
        self.assertEqual(self.tick(1), 1)
        self.assertEqual(self.service.store.get(recent).state, dl.REMOTE_DONE)
        untouched = self.service.store.get(old)
        self.assertEqual((untouched.state, untouched.next_check_at), (dl.STALLED, None))
        self.assertNotIn(old, [task.id for task in self.service.store.due(self.clock() + dl.STALL_RECHECK)])

    def test_a_task_the_cloud_never_listed_waits_longer_then_fails_as_not_accepted(self):
        # 真实的 CloudDrive2 提交不回远端编号，编号要等离线列表里看见任务才有。
        self.provider.submit_result = dl.RemoteStatus(dl.RUNNING, name="ABC-123")
        task_id = self.submit()["task"]["id"]
        self.provider.statuses = [dl.RemoteStatus(dl.MISSING)]
        self.tick(10)
        self.tick(dl.MISSING_GRACE)
        self.assertEqual(self.service.store.get(task_id).state, dl.SUBMITTED)
        self.tick(dl.UNSEEN_GRACE)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure), (dl.FAILED, "not_accepted"))

    def test_a_listed_task_that_disappears_fails_as_removed(self):
        task_id = self.submit()["task"]["id"]
        self.provider.statuses = [dl.RemoteStatus(dl.RUNNING, "r1", "ABC-123", 0.2), dl.RemoteStatus(dl.MISSING)]
        self.tick(10)
        self.assertEqual(self.service.store.get(task_id).state, dl.REMOTE_RUNNING)
        self.tick(dl.MISSING_GRACE)
        self.tick(dl.MISSING_GRACE)
        self.assertEqual(self.service.store.get(task_id).failure, "removed")

    def test_a_task_missing_from_the_list_with_files_in_the_folder_counts_as_done(self):
        task_id = self.submit()["task"]["id"]
        self.provider.statuses = [dl.RemoteStatus(dl.MISSING)]
        self.provider.is_landed = True
        self.tick(10)
        self.assertEqual(self.service.store.get(task_id).state, dl.REMOTE_DONE)

    def test_cancelling_asks_the_remote_and_ends_tracking(self):
        task_id = self.submit()["task"]["id"]
        task = self.service.cancel(task_id)
        self.assertEqual((task.state, self.provider.cancelled), (dl.CANCELLED, [task_id]))
        self.assertEqual(self.tick(900), 0)
        with self.assertRaisesRegex(ValueError, "已经结束"):
            self.service.cancel(task_id)


class LandingTests(_Deployment):
    def test_metadata_subtrees_and_files_do_not_consume_the_landing_limit(self):
        folder = self.cloud / '云下载' / 'package'
        (folder / '.AppleDouble').mkdir(parents=True)
        (folder / '.AppleDouble' / 'movie.mp4').write_bytes(b'metadata')
        (folder / '._movie.mp4').write_bytes(b'metadata')
        (folder / '@creator').mkdir()
        (folder / '@creator' / '.hidden.mp4').write_bytes(b'media')
        from peach import media_io
        original = media_io.directory_entries
        visited = []

        def scandir(path):
            visited.append(Path(path).name)
            return original(path)

        with patch.object(dl, 'MAX_LANDED_FILES', 1), patch.object(media_io, 'directory_entries', side_effect=scandir):
            self.assertTrue(self.service.landing.ingest('115', self.ledger('云下载', 'package')))
        self.assertIn('package', visited)
        self.assertNotIn('.AppleDouble', visited)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute('SELECT path FROM asset').fetchall(),
                             [(self.ledger('云下载', 'package', '@creator', '.hidden.mp4'),)])

    def test_a_hung_mount_does_not_hold_the_reconciliation_thread(self):
        """网盘挂载在本进程里一碰就卡住：判类型、列目录与登记都走读取子进程，对账照常登记。"""
        folder = self.cloud / '云下载' / 'ABC-123'
        folder.mkdir()
        (folder / 'ABC-123.mp4').write_bytes(b'main')
        release = threading.Event()
        prefix = os.path.normcase(str(self.cloud))

        def hang(real):
            def call(path, *args, **kwargs):
                if isinstance(path, (str, os.PathLike)) and os.path.normcase(os.fspath(path)).startswith(prefix):
                    release.wait(60)
                return real(path, *args, **kwargs)
            return call
        outcome = []
        worker = threading.Thread(target=lambda: outcome.append(
            self.service.landing.ingest('115', self.ledger('云下载', 'ABC-123'))), daemon=True)
        with patch.object(os, 'stat', hang(os.stat)), patch.object(os, 'scandir', hang(os.scandir)), \
                patch.object(os.path, 'isdir', hang(os.path.isdir)), \
                patch.object(os.path, 'isfile', hang(os.path.isfile)):
            try:
                worker.start()
                worker.join(30)
                self.assertFalse(worker.is_alive(), '云下载对账卡在了本进程的读盘上')
            finally:
                release.set()
                worker.join(30)
        self.assertEqual(outcome, [True])
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute('SELECT path FROM asset').fetchall(),
                             [(self.ledger('云下载', 'ABC-123', 'ABC-123.mp4'),)])

    def test_a_system_directory_download_target_is_not_traversed(self):
        (self.cloud / '云下载' / '@eaDir').mkdir()
        with patch('peach.scan._walk') as walk:
            self.assertFalse(self.service.landing.ingest('115', self.ledger('云下载', '@eaDir')))
        walk.assert_not_called()

    def finish(self):
        task_id = self.submit()["task"]["id"]
        self.provider.statuses = [dl.RemoteStatus(dl.DONE, "r1", "ABC-123", 1.0)]
        self.tick(10)
        self.assertEqual(self.service.store.get(task_id).state, dl.REMOTE_DONE)
        return task_id

    def test_a_folder_the_push_channel_missed_is_registered_after_the_grace(self):
        task_id = self.finish()
        folder = self.cloud / "云下载" / "ABC-123"
        folder.mkdir()
        (folder / "ABC-123.mp4").write_bytes(b"0" * 8)
        (folder / "ABC-123.nfo").write_bytes(b"x")
        self.tick(dl.LANDING_GRACE)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.ledger_path), (dl.INGESTED, self.ledger("云下载", "ABC-123")))
        connection = sqlite3.connect(self.db)
        try:
            paths = [row[0] for row in connection.execute("SELECT path FROM asset")]
        finally:
            connection.close()
        self.assertEqual(paths, [self.ledger("云下载", "ABC-123", "ABC-123.mp4")])
        self.assertEqual(task.asset_id is not None, True)

    def test_a_remote_refresh_exposes_the_folder_before_ingesting(self):
        task_id = self.finish()
        refreshed = []

        def landed(task):
            refreshed.append(task.id)
            folder = self.cloud / '云下载' / 'ABC-123'
            folder.mkdir()
            (folder / 'ABC-123.mp4').write_bytes(b'main')
            return True

        self.provider.landed = landed
        self.tick(dl.LANDING_GRACE)
        task = self.service.store.get(task_id)
        self.assertEqual(refreshed, [task_id])
        self.assertEqual(task.state, dl.INGESTED)
        self.assertIsNotNone(task.asset_id)

    def test_the_main_video_is_bound_instead_of_the_first_promo_file(self):
        task_id = self.submit(code="ABC-123")["task"]["id"]
        self.provider.statuses = [dl.RemoteStatus(dl.DONE, "r1", "ABC-123", 1.0)]
        self.tick(10)
        folder = self.cloud / "云下载" / "ABC-123"
        folder.mkdir()
        (folder / "manko.fun.mp4").write_bytes(b"ad")
        (folder / "ABC-123.mp4").write_bytes(b"main")
        self.tick(dl.LANDING_GRACE)
        task = self.service.store.get(task_id)
        with closing(sqlite3.connect(self.db)) as connection:
            name = connection.execute("SELECT name FROM asset WHERE id=?", (task.asset_id,)).fetchone()[0]
        self.assertEqual(name, "ABC-123.mp4")
        self.assertEqual(task.postprocess_state, dl.POSTPROCESS_PENDING)

    def test_folder_assets_include_attachments_without_treating_them_as_the_main_video(self):
        task_id = self.submit(code="ABC-123")["task"]["id"]
        self.provider.statuses = [dl.RemoteStatus(dl.DONE, "r1", "ABC-123", 1.0)]
        self.tick(10)
        folder = self.cloud / "云下载" / "ABC-123"
        folder.mkdir()
        (folder / "ABC-123.mp4").write_bytes(b"main")
        self.tick(dl.LANDING_GRACE)
        task = self.service.store.get(task_id)
        attachment = self.ledger("云下载", "ABC-123", "推广页.url")
        with closing(sqlite3.connect(self.db)) as connection:
            connection.execute(
                "INSERT INTO asset(location,path,name,medium,size) VALUES(?,?,?,?,?)",
                ("115", attachment, "推广页.url", "other", 128))
            connection.commit()
        rows = self.service.store.assets_under("115", task.ledger_path)
        self.assertEqual({row["medium"] for row in rows}, {"video", "other"})
        self.assertEqual(self.service.store.asset_under("115", task.ledger_path, "ABC-123"),
                         task.asset_id)

    def test_a_wishlist_download_that_lands_marks_the_want_acquired(self):
        with closing(sqlite3.connect(self.db)) as connection:
            want_id = wants.add_code(connection, "ABC-123")["id"]
            connection.commit()
        task_id = self.submit(code="ABC-123", origin=f"wishlist:{want_id}")["task"]["id"]
        self.provider.statuses = [dl.RemoteStatus(dl.DONE, "r1", "ABC-123", 1.0)]
        self.tick(10)
        folder = self.cloud / "云下载" / "ABC-123"
        folder.mkdir()
        (folder / "ABC-123.mp4").write_bytes(b"0" * 8)
        self.tick(dl.LANDING_GRACE)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.origin), (dl.INGESTED, f"wishlist:{want_id}"))
        with closing(sqlite3.connect(self.db)) as connection:
            connection.row_factory = sqlite3.Row
            want = wants.get(connection, want_id)
        self.assertEqual((want["state"], want["acquired_asset_id"], want["acquired_source"]),
                         (wants.ACQUIRED, task.asset_id, wants.AUTO_SOURCE))

    def test_a_file_already_registered_by_the_push_channel_is_not_registered_twice(self):
        task_id = self.finish()
        folder = self.cloud / "云下载" / "ABC-123"
        folder.mkdir()
        (folder / "a.mp4").write_bytes(b"0" * 8)
        self.assertTrue(self.push.ingest_now("115", self.ledger("云下载", "ABC-123", "a.mp4")))
        calls = []
        original = self.push.ingest_now
        self.push.ingest_now = lambda *args: calls.append(args) or original(*args)
        self.tick(dl.LANDING_GRACE)
        self.assertEqual(self.service.store.get(task_id).state, dl.INGESTED)
        self.assertEqual(calls, [])

    def test_a_file_that_never_appears_ends_as_not_landed(self):
        task_id = self.finish()
        self.tick(dl.LANDING_GRACE)
        self.assertEqual(self.service.store.get(task_id).state, dl.REMOTE_DONE)
        self.tick(dl.LANDING_TIMEOUT)
        self.assertEqual(self.service.store.get(task_id).failure, "not_landed")

    def test_a_target_outside_the_cloud_prefixes_is_reported_not_guessed(self):
        self.push.save({"enabled": False, "prefixes": []})
        task_id = self.finish()
        self.tick(dl.LANDING_GRACE)
        task = self.service.store.get(task_id)
        self.assertEqual((task.state, task.failure), (dl.FAILED, "not_landed"))
        self.assertIn("云端路径前缀", task.failure_detail)


class SettingsTests(_Deployment):
    def test_service_addresses_validate_ports_and_preserve_supported_hosts(self):
        for address in ("http://127.0.0.1:abc", "http://localhost:0", "http://localhost:65536",
                        "http://localhost:", "http://localhost:19798#fragment", "http://[::1",
                        "http://127.0.0.1:19 798", "http://@localhost:19798", "http://localhost\x00:19798",
                        "C:\\CloudDrive2\\CloudDrive2.exe"):
            with self.subTest(address=address), self.assertRaises(ValueError):
                dl.clean_address(address)
        for source, expected in (("localhost:19798", "http://localhost:19798"),
                                 ("http://[::1]:19798", "http://[::1]:19798"),
                                 ("https://example.test", "https://example.test")):
            with self.subTest(source=source):
                self.assertEqual(dl.clean_address(source), expected)

    def test_invalid_saved_address_is_editable_and_preserves_other_preferences(self):
        path = self.service.settings.path
        path.parent.mkdir(parents=True, exist_ok=True)
        stored = {"clouddrive_address": "http://localhost:bad-port", "targets": {"115": "/115/Movies"},
                  "pikpak_root": "P:\\", "wait_hours": 48}
        payload = json.dumps(stored).encode()
        path.write_bytes(payload)
        loaded = self.service.settings.load()
        self.assertEqual(loaded.payload(), stored)
        self.assertIn("端口", loaded.problems[0])
        self.assertEqual(dl.problem_codes(loaded.problems), [{"code": "errors.downloads.addressPortInvalidIpv6", "params": {}}])
        self.assertEqual(path.read_bytes(), payload)
        corrected = self.service.settings.save({**stored, "clouddrive_address": "localhost:19798"}, None)
        self.assertEqual(corrected.problems, ())
        self.assertEqual(corrected.targets, stored["targets"])

    def test_a_scheduled_postprocess_retry_is_labelled_with_its_attempt(self):
        task = dl.DownloadTask(1, HASH, "115", "magnet:", "", "/115", dl.INGESTED,
                               postprocess_state=dl.POSTPROCESS_PENDING, next_check_at="2026-11-13T00:00:00+00:00",
                               postprocess_retries=1)
        payload = task.payload()
        self.assertEqual(payload["postprocess_label"], f"等待自动重试（1/{len(dl.RETRY_DELAYS)}）")
        self.assertEqual((payload["postprocess_label_code"], payload["postprocess_label_params"]),
                         ("labels.downloads.postprocessRetrying", {"retries": 1, "limit": len(dl.RETRY_DELAYS)}))
        english = interface_text.text(f"server:{payload['postprocess_label_code']}",
                                      payload["postprocess_label_params"], language="en")
        self.assertEqual(english, f"Waiting to retry automatically (1/{len(dl.RETRY_DELAYS)})")

    def test_snapshot_hides_remote_cancel_when_the_channel_cannot_cancel(self):
        task_id = self.submit()["task"]["id"]
        self.service.channel_catalog = lambda: {"providers": [{
            "key": "115", "label": "影片库", "can_cancel": False}], "problems": []}
        task = self.service.snapshot()["tasks"][0]
        self.assertEqual(task["provider_label"], "影片库")
        self.assertFalse(task["cancellable"])
        stored = self.service.store.get(task_id)
        stored.state = dl.REMOTE_DONE
        self.service.store.save(stored)
        self.assertTrue(self.service.snapshot()["tasks"][0]["cancellable"])

    def test_settings_hold_no_credentials_and_check_the_pikpak_root(self):
        with self.assertRaisesRegex(ValueError, "不是已声明的 PikPak 媒体根"):
            self.service.save_settings({"pikpak_root": "Z:\\"}, self.declared)
        config = self.service.save_settings({
            "clouddrive_address": "127.0.0.1:19798", "targets": {"115": "115/云下载/"},
            "wait_hours": 48, "token": "secret-token"}, self.declared)
        self.assertEqual((config.clouddrive_address, config.targets, config.wait_hours),
                         ("http://127.0.0.1:19798", {"115": "/115/云下载"}, 48))
        stored = (self.root / "state" / dl.SETTINGS_FILENAME).read_text(encoding="utf-8")
        self.assertNotIn("secret-token", stored)
        self.assertEqual(json.loads(stored)["targets"], {"115": "/115/云下载"})

    def test_an_address_with_a_path_or_credentials_is_refused(self):
        for bad in ("http://u:p@127.0.0.1:19798", "http://127.0.0.1:19798/api", "ftp://x"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.service.save_settings({"clouddrive_address": bad}, self.declared)

    def test_the_snapshot_reports_which_providers_are_ready(self):
        self.service.save_settings({"clouddrive_address": "127.0.0.1"}, self.declared)
        self.credentials.save(dl.CLOUDDRIVE_CREDENTIAL, {"token": "t"})
        providers = {row["key"]: row["configured"] for row in self.service.snapshot()["providers"]}
        self.assertEqual(providers, {"115": True, "pikpak": False})

    def test_snapshot_pages_keep_submission_order_during_status_updates(self):
        for number in range(5):
            self.service.store.save(dl.DownloadTask(
                id=0, info_hash=f"{number:040x}", provider="115", source_uri=MAGNET,
                display_name="ABC-123", target="/cloud", state=dl.SUBMITTED))
        first = self.service.snapshot(2)
        self.assertEqual([row["id"] for row in first["tasks"]], [5, 4])
        self.assertTrue(first["has_more"])
        changed = self.service.store.get(3)
        changed.updated_at = "2099-01-01T00:00:00Z"
        self.service.store.save(changed)
        second = self.service.snapshot(2, before_id=first["next_before_id"])
        self.assertEqual([row["id"] for row in second["tasks"]], [3, 2])
        last = self.service.snapshot(2, before_id=second["next_before_id"])
        self.assertEqual([row["id"] for row in last["tasks"]], [1])
        self.assertFalse(last["has_more"])


class CredentialSaveTests(unittest.TestCase):
    def test_saving_overwrites_the_local_copy_and_drops_empty_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CredentialStore(Path(tmp))
            store.save("download-pikpak", {"refresh_token": "a", "password": "p"})
            store.save("download-pikpak", {"refresh_token": "b", "password": ""})
            self.assertEqual(store.load("download-pikpak").values, {"refresh_token": "b"})


if __name__ == "__main__":
    unittest.main()
