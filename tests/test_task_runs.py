"""任务中心服务层：互斥、CAS、租约恢复与保留条数。"""
from contextlib import closing
import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from dataclasses import replace
from pathlib import Path
from unittest import mock

from peach.migrations import upgrade
from peach.jobs import process_matches
from peach.repository import LedgerDatabase
from peach.task_runs import (
    TaskRunConflict,
    TaskRunStore,
    item_progress,
    run_error,
    stamp,
    task_label,
)


MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"


class TaskRunStoreTests(unittest.TestCase):
    def test_pruning_a_finished_run_preserves_download_state_and_clears_its_old_link(self):
        run = self.store.start('download-postprocess', trigger='manual')
        self.store.finish(run.id, 'succeeded')
        with self.database.write_transaction(notify=False) as connection:
            connection.execute("INSERT INTO download_task(provider,source_uri,target,state,updated_at,"
                               "postprocess_state,postprocess_run_id,postprocess_detail) "
                               "VALUES('115','sample','/Movies','ingested','now','complete',?,'整理完成')", (run.id,))
        self.assertEqual(self.store.prune('download-postprocess', keep=0), 1)
        with self.database.read_connection() as connection:
            row = connection.execute('SELECT state,postprocess_state,postprocess_run_id,postprocess_detail '
                                     'FROM download_task').fetchone()
            self.assertEqual(tuple(row), ('ingested', 'complete', None, '整理完成'))

    def test_process_identity_preserves_owners_when_creation_time_is_unknown(self):
        started = stamp(datetime.now(timezone.utc))
        with mock.patch('peach.jobs.process_creation_time', return_value=None):
            self.assertTrue(process_matches(os.getpid(), started, alive=lambda _: True))
            self.assertFalse(process_matches(os.getpid(), started, alive=lambda _: False))

    def test_a_resumed_worker_with_current_heartbeat_is_not_reclaimed(self):
        run = self.store.start('library-processing', trigger='manual')
        earlier = datetime.now(timezone.utc) - timedelta(days=1)
        created = datetime.now(timezone.utc).timestamp() - 30
        with self.database.write_transaction(notify=False) as connection:
            connection.execute('UPDATE task_run SET pid=?,started_at=? WHERE id=?',
                               (os.getpid() + 1, stamp(earlier), run.id))
        with mock.patch('peach.task_runs.process_alive', return_value=True), \
                mock.patch('peach.jobs.process_creation_time', return_value=created):
            self.assertEqual(self.store.recover_interrupted(), [])
        self.assertEqual(self.store.get(run.id).status, 'running')

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Path(self.tmp.name).resolve() / "ledger.db"
        sqlite3.connect(self.db).close()
        upgrade(self.db, MIGRATIONS)
        self.database = LedgerDatabase(self.db)
        self.store = TaskRunStore(self.database, host="test-host")

    def test_a_started_run_is_running_and_readable(self):
        run = self.store.start("demo", trigger="manual", total=10, label="准备")
        self.assertIsNotNone(run)
        self.assertEqual(run.status, "running")
        self.assertEqual(run.trigger, "manual")
        self.assertEqual(run.progress_total, 10)
        self.assertEqual(run.pid, os.getpid())
        self.assertEqual(self.store.get(run.id).progress_label, "准备")

    def test_active_families_match_live_ids_and_each_runs_live_descendants(self):
        # 已结束的根 → 已结束的子 → 排队的孙；根下另一条在跑的子；独立的已失败与排队各一条。
        ids = [self.store.start("demo", trigger="manual").id for _ in range(6)]
        root, child, grandchild, runner, failed, alone = ids
        layout = {root: (None, "succeeded"), child: (root, "succeeded"), grandchild: (child, "pending"),
                  runner: (root, "running"), failed: (None, "failed"), alone: (None, "pending")}
        with closing(sqlite3.connect(self.db)) as connection, connection:
            for run_id, (parent, status) in layout.items():
                finished = None if status in ("pending", "running") else "2026-01-01T00:00:00Z"
                connection.execute("UPDATE task_run SET parent_run_id=?, status=?, finished_at=? WHERE id=?",
                                   (parent, status, finished, run_id))

        families = self.store.active_families()

        self.assertEqual(set(families), self.store.live_ids())
        self.assertEqual(families[root], [(grandchild, "pending"), (runner, "running")])
        self.assertEqual(families[child], [(grandchild, "pending")])
        self.assertEqual(families[alone], [(alone, "pending")])
        self.assertNotIn(failed, families)
        self.assertEqual(self.store.active_families([root, child, failed]),
                         {root: families[root], child: families[child]})
        for run_id, family in families.items():
            run = self.store.get(run_id)
            expected = ([run_id] if run.active else []) + [
                row.id for row in self.store.active_descendants(run_id)]
            self.assertEqual([member for member, _status in family], sorted(expected))

    def test_missing_empty_or_corrupt_ledgers_have_no_available_task_center(self):
        self.assertTrue(self.store.available())
        for state, content in (("missing", None), ("empty", b""), ("corrupt", b"not a sqlite database")):
            with self.subTest(state=state):
                path = self.db.parent / f"{state}.db"
                if content is not None:
                    path.write_bytes(content)
                store = TaskRunStore(LedgerDatabase(path), host="test-host")
                self.assertFalse(store.available())
                self.assertEqual(path.read_bytes() if path.exists() else None, content)

    def test_scheduled_conflict_is_skipped_and_says_who_blocked_it(self):
        first = self.store.start("demo", trigger="manual", mutex_key="demo")
        self.assertIsNone(self.store.start(
            "demo", trigger="scheduled", mutex_key="demo", conflict="skip"))
        skipped = self.store.query(status="cancelled")[0]
        self.assertEqual(skipped.trigger, "scheduled")
        self.assertEqual(skipped.result_summary["blocked_by"], first.id)
        self.assertEqual(skipped.error, f"与第 {first.id} 轮（手动触发）冲突，本次跳过")
        self.assertEqual((skipped.error_code, skipped.error_params),
                         ("taskRun.error.skippedBy", {"run": first.id, "trigger": "manual"}))
        # 跳过的那一轮从没开跑，所以没有开始时刻可报。
        self.assertIsNone(skipped.started_at)

    def test_a_progress_label_keeps_its_code_and_a_plain_one_clears_it(self):
        run = self.store.start("entity-avatar", trigger="manual", **item_progress("entity-avatar", "涼森れむ"))
        stored = self.store.get(run.id)
        self.assertEqual((stored.progress_label, stored.progress_code, stored.progress_params),
                         ("资料图片补全：涼森れむ", "taskRun.progress.item", {"name": "涼森れむ"}))
        self.assertTrue(self.store.progress(run.id, current=1, throttle=0))
        self.assertEqual(self.store.get(run.id).progress_code, "taskRun.progress.item")
        # 只给原文的那一句不能沿用上一句的 code，否则界面会把它译成上一句。
        self.assertTrue(self.store.progress(run.id, label="比对封面", throttle=0))
        self.assertEqual(self.store.get(run.id).payload()["progress_code"], "")
        self.store.suspend(run.id)
        waiting = self.store.get(run.id)
        self.assertEqual((waiting.progress_label, waiting.progress_code),
                         ("等待安装完成后继续", "taskRun.progress.waitingForUpdate"))

    def test_coded_text_is_not_stored_and_is_rendered_when_read(self):
        # ADR-0159：带 code 的说明与结束原因只存 code 与参数，读出时按资源渲染；没有 code 的原文照存。
        from peach.task_outcomes import part, said
        run = self.store.start("entity-avatar", trigger="manual", **item_progress("entity-avatar", "涼森れむ"))
        self.store.finish(run.id, "succeeded", summary={"name": "涼森れむ", **said(part("installed")),
                                                         **said(part("sourceCover", code="ABC-001"), field="source")})
        failed = self.store.start("demo", trigger="manual")
        self.store.finish(failed.id, "failed", error="RuntimeError: 原文")
        with closing(sqlite3.connect(self.db)) as connection:
            rows = dict(connection.execute("SELECT id, coalesce(progress_label,'') || '|' || coalesce(error,'') "
                                           "FROM task_run").fetchall())
        self.assertEqual(rows, {run.id: "|", failed.id: "|RuntimeError: 原文"})
        payload = self.store.get(run.id).payload()
        self.assertEqual(payload["progress_label"], "资料图片补全：涼森れむ")
        self.assertEqual((payload["result_summary"]["outcome"], payload["result_summary"]["source"]),
                         ("已保存资料图片", "作品封面 ABC-001"))
        self.assertEqual(payload["result_summary"]["outcome_parts"], [{"code": "installed", "params": {}}])

    def test_queued_followups_carry_the_code_of_their_label(self):
        from peach.followups import Followup
        parent = self.store.start("library-processing", trigger="manual")
        queued = self.store.enqueue_followups(parent.id, [
            Followup.item("entity-avatar:performer:1", "entity-avatar", "涼森れむ").as_row(),
            ("studio-mark:2", "studio-mark", "旧写法")])
        coded, plain = (self.store.get(run_id) for run_id in queued["queued"])
        self.assertEqual((coded.progress_code, coded.progress_params), ("taskRun.progress.item", {"name": "涼森れむ"}))
        self.assertEqual((plain.progress_label, plain.progress_code), ("旧写法", ""))
        self.assertEqual(run_error("unknownFollowup", "no-such-task")["error"], "没有登记 no-such-task 这种后继")

    def test_manual_conflict_raises_with_the_blocking_run_id(self):
        first = self.store.start("demo", trigger="scheduled", mutex_key="demo")
        with self.assertRaises(TaskRunConflict) as caught:
            self.store.start("demo", trigger="manual", mutex_key="demo",
                             conflict="raise")
        self.assertEqual(caught.exception.blocking_run_id, first.id)
        # 抛出的那次不留记录：用户当场看到了 409，再记一条只会把历史撑肿。
        self.assertEqual(self.store.query(status="cancelled"), [])

    def test_a_finished_run_releases_the_mutex_key(self):
        first = self.store.start("demo", trigger="manual", mutex_key="demo")
        self.store.finish(first.id, "succeeded")
        second = self.store.start("demo", trigger="manual", mutex_key="demo")
        self.assertIsNotNone(second)
        self.assertNotEqual(second.id, first.id)

    def test_runs_without_a_mutex_key_do_not_block_each_other(self):
        self.assertIsNotNone(self.store.start("demo", trigger="manual"))
        self.assertIsNotNone(self.store.start("demo", trigger="manual"))

    def test_finishing_twice_only_lands_once(self):
        run = self.store.start("demo", trigger="manual")
        self.assertTrue(self.store.finish(run.id, "succeeded", summary={"changed": 3}))
        self.assertFalse(self.store.finish(run.id, "failed", error="迟到的结算"))
        settled = self.store.get(run.id)
        self.assertEqual(settled.status, "succeeded")
        self.assertEqual(settled.result_summary, {"changed": 3})
        self.assertEqual(settled.error, "")

    def test_progress_stops_at_the_terminal_state(self):
        run = self.store.start("demo", trigger="manual")
        self.assertTrue(self.store.progress(run.id, current=4, total=9, throttle=0))
        self.store.finish(run.id, "succeeded")
        self.assertFalse(self.store.progress(run.id, current=9, throttle=0))
        self.assertEqual(self.store.get(run.id).progress_current, 4)

    def test_progress_is_throttled_by_wall_clock(self):
        run = self.store.start("demo", trigger="manual")
        self.assertTrue(self.store.progress(run.id, current=1, throttle=0))
        self.assertFalse(self.store.progress(run.id, current=2, throttle=60))
        self.assertEqual(self.store.get(run.id).progress_current, 1)

    def hold_write_lock(self) -> sqlite3.Connection:
        """另一个写入者占住账本的写锁，直到调用方 ROLLBACK。"""
        blocker = sqlite3.connect(self.db, isolation_level=None)
        self.addCleanup(blocker.close)
        blocker.execute("BEGIN IMMEDIATE")
        return blocker

    def test_progress_gives_up_quietly_while_another_writer_holds_the_ledger(self):
        run = self.store.start("demo", trigger="manual")
        blocker = self.hold_write_lock()
        with mock.patch("peach.task_runs.PROGRESS_LOCK_TIMEOUT", 0.05), \
                self.assertLogs("peach.task_runs", "WARNING") as logs:
            self.assertFalse(self.store.progress(run.id, current=3, throttle=0))
            self.assertFalse(self.store.heartbeat(run.id, throttle=0))
        # 一段连续失败只记一条，不让每两秒一次的进度把错误日志刷满。
        self.assertEqual(len(logs.records), 1)
        blocker.execute("ROLLBACK")
        self.assertTrue(self.store.progress(run.id, current=4, throttle=0))
        self.assertEqual(self.store.get(run.id).progress_current, 4)

    def test_progress_does_not_queue_behind_a_writer_in_the_same_process(self):
        run = self.store.start("demo", trigger="manual")
        with mock.patch("peach.task_runs.PROGRESS_LOCK_TIMEOUT", 0.05), \
                self.assertLogs("peach.task_runs", "WARNING"), self.database.write_lock:
            self.assertFalse(self.store.progress(run.id, current=3, throttle=0))
        self.assertTrue(self.store.progress(run.id, current=3, throttle=0))

    def test_a_stuck_writer_in_the_same_process_fails_other_writes_instead_of_freezing_them(self):
        import threading
        from peach.task_retry import transient_delay
        from peach.user_messages import UserFacingError
        run = self.store.start("demo", trigger="manual")
        holding, release = threading.Event(), threading.Event()

        def stuck():
            with self.database.write_transaction(notify=False):
                holding.set()
                release.wait(10)

        holder = threading.Thread(target=stuck, name="stuck-writer")
        holder.start()
        self.addCleanup(holder.join, 10)
        self.addCleanup(release.set)
        self.assertTrue(holding.wait(10))
        with mock.patch("peach.repository.WRITE_LOCK_SECONDS", 0.05), \
                self.assertLogs("peach.repository", "WARNING") as logs, \
                self.assertRaises(sqlite3.OperationalError) as caught:
            with self.database.write_transaction() as connection:
                connection.execute("UPDATE task_run SET progress_current=9 WHERE id=?", (run.id,))
        self.assertIn("stuck-writer", logs.output[0])
        # 超时发生在拿连接之前，这次写入一行都没有落；错误给人看得懂，重试分类按暂时故障处理。
        self.assertIsInstance(caught.exception, UserFacingError)
        self.assertEqual(caught.exception.code, "errors.ledger.writeBusy")
        self.assertEqual(transient_delay(caught.exception), 0.0)
        release.set()
        holder.join(10)
        self.assertNotEqual(self.store.get(run.id).progress_current, 9)

    def test_finish_retries_a_locked_ledger_and_then_lands(self):
        run = self.store.start("demo", trigger="manual", mutex_key="demo")
        real = self.store._update_active
        attempts = []

        def locked_once(*args, **kwargs):
            attempts.append(1)
            if len(attempts) == 1:
                raise sqlite3.OperationalError("database is locked")
            return real(*args, **kwargs)

        self.store.finish_retry_delays = (0,)
        with mock.patch.object(self.store, "_update_active", locked_once), \
                self.assertLogs("peach.task_runs", "WARNING"):
            self.assertTrue(self.store.finish(run.id, "succeeded"))
        self.assertEqual(len(attempts), 2)
        self.assertEqual(self.store.get(run.id).status, "succeeded")
        # 结算落地了，互斥键也就放开了，下一轮开得起来。
        self.assertIsNotNone(self.store.start("demo", trigger="manual", mutex_key="demo"))

    def test_finish_raises_once_its_retries_are_spent(self):
        run = self.store.start("demo", trigger="manual")
        self.store.finish_retry_delays = (0, 0)
        locked = mock.Mock(side_effect=sqlite3.OperationalError("database is locked"))
        with mock.patch.object(self.store, "_update_active", locked), \
                self.assertLogs("peach.task_runs", "WARNING"), \
                self.assertRaises(sqlite3.OperationalError):
            self.store.finish(run.id, "succeeded")
        self.assertEqual(locked.call_count, 3)
        self.assertEqual(self.store.get(run.id).status, "running")

    def test_an_unknown_status_or_trigger_is_refused_before_any_write(self):
        with self.assertRaises(ValueError):
            self.store.start("demo", trigger="webhook")
        with self.assertRaises(ValueError):
            self.store.finish(1, "done")
        self.assertEqual(self.store.query(), [])

    def test_recovery_marks_runs_of_a_dead_process_as_interrupted(self):
        run = self.store.start("demo", trigger="manual")
        with self.database.write_transaction(notify=False) as connection:
            connection.execute("UPDATE task_run SET pid=? WHERE id=?", (4294967294, run.id))
        self.assertEqual(self.store.recover_interrupted(), [run.id])
        recovered = self.store.get(run.id)
        self.assertEqual(recovered.status, "interrupted")
        self.assertEqual((recovered.error, recovered.error_code), ("服务重启，这一轮没有跑完", "taskRun.error.interrupted"))
        self.assertIsNotNone(recovered.finished_at)
        # 打断不是失败：任务没有得出坏结果，只是没跑完。
        self.assertNotEqual(recovered.status, "failed")

    def test_recovery_leaves_a_run_of_a_live_process_alone(self):
        run = self.store.start("demo", trigger="manual")
        with mock.patch("peach.task_runs.process_alive", return_value=True):
            with self.database.write_transaction(notify=False) as connection:
                connection.execute("UPDATE task_run SET pid=? WHERE id=?",
                                   (os.getpid() + 1, run.id))
            self.assertEqual(self.store.recover_interrupted(), [])
        self.assertEqual(self.store.get(run.id).status, "running")

    def test_recovery_does_not_treat_a_reused_pid_as_the_original_worker(self):
        run = self.store.start("library-processing", trigger="manual")
        old_start = stamp(datetime.now(timezone.utc) - timedelta(days=1))
        with self.database.write_transaction(notify=False) as connection:
            connection.execute("UPDATE task_run SET pid=?,started_at=?,heartbeat_at=? WHERE id=?",
                               (os.getpid() + 1, old_start, old_start, run.id))
        created_after_task = datetime.now(timezone.utc).timestamp()
        with mock.patch("peach.task_runs.process_alive", return_value=True), \
                mock.patch("peach.jobs.process_creation_time", return_value=created_after_task):
            self.assertEqual(self.store.recover_interrupted(), [run.id])
        self.assertEqual(self.store.get(run.id).status, "interrupted")

    def test_recovery_of_another_machine_waits_for_the_lease_to_expire(self):
        run = self.store.start("demo", trigger="manual")
        stale = stamp(datetime.now(timezone.utc) - timedelta(seconds=30))
        with self.database.write_transaction(notify=False) as connection:
            connection.execute("UPDATE task_run SET host='other',heartbeat_at=? WHERE id=?",
                               (stale, run.id))
        self.assertEqual(self.store.recover_interrupted(stale_after=300), [])
        self.assertEqual(self.store.recover_interrupted(stale_after=10), [run.id])

    def test_prune_keeps_the_most_recent_finished_runs_per_task(self):
        for _ in range(5):
            run = self.store.start("demo", trigger="manual")
            self.store.finish(run.id, "succeeded")
        other = self.store.start("other", trigger="cli")
        self.store.finish(other.id, "failed", error="坏了")
        live = self.store.start("demo", trigger="manual")
        self.assertEqual(self.store.prune("demo", keep=2), 3)
        remaining = [row.id for row in self.store.query(task_key="demo")]
        self.assertIn(live.id, remaining)
        self.assertEqual(len(remaining), 3)
        self.assertEqual(len(self.store.query(task_key="other")), 1)

    def test_prune_preserves_followups_with_only_existing_task_references(self):
        connect = self.database.connect
        for foreign_keys in (0, 1):
            with self.subTest(foreign_keys=foreign_keys):
                def configured_connect(*args, _foreign_keys=foreign_keys, **kwargs):
                    connection = connect(*args, **kwargs)
                    connection.execute(f'PRAGMA foreign_keys={_foreign_keys}')
                    return connection
                with mock.patch.object(self.database, 'connect', configured_connect):
                    key = f'parent-{foreign_keys}'
                    active = self.store.start(key, trigger='manual')
                    parent = self.store.start(key, trigger='manual')
                    children = self.store.enqueue_followups(parent.id, [
                        (f'{key}:running', f'child-{foreign_keys}', '正在处理'),
                        (f'{key}:finished', 'child', '已经处理'),
                        (f'{key}:pending', 'child', '等待处理'),
                    ])['queued']
                    self.store.claim_followup([f'child-{foreign_keys}'])
                    self.store.finish(children[1], 'succeeded', summary={'changed':2})
                    grandchild = self.store.enqueue_followups(children[0], [
                        (f'{key}:grandchild', 'grandchild', '后续处理')])['queued'][0]
                    self.store.finish(parent.id, 'succeeded')
                    kept = self.store.start(key, trigger='manual')
                    kept_child = self.store.enqueue_followups(kept.id, [
                        (f'{key}:kept', 'child', '保留关联')])['queued'][0]
                    self.store.finish(kept.id, 'succeeded')
                    snapshots = {run_id:self.store.get(run_id) for run_id in
                                 [active.id, kept.id, kept_child, grandchild, *children]}
                    self.assertEqual(self.store.prune(key, keep=1), 1)
                    self.assertIsNone(self.store.get(parent.id))
                    for run_id, before in snapshots.items():
                        expected = replace(before,
                            parent_run_id=None if before.parent_run_id==parent.id else before.parent_run_id,
                            root_run_id=None if before.root_run_id==parent.id else before.root_run_id)
                        self.assertEqual(self.store.get(run_id), expected)
                    with self.database.read_connection() as connection:
                        self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), [])
                    self.assertEqual(self.store.prune(key, keep=1), 0)
                    self.assertEqual(self.store.prune(key, keep=0), 1)
                    self.assertEqual(self.store.get(active.id), snapshots[active.id])
                    self.assertIsNone(self.store.get(kept_child).parent_run_id)
                    self.assertIsNone(self.store.get(kept_child).root_run_id)

    def test_task_reference_cleanup_rolls_back_with_a_batch_delete(self):
        parents = [self.store.start(f'parent-{i}', trigger='manual') for i in range(2)]
        for parent in parents:
            self.store.enqueue_followups(parent.id, [(f'child:{parent.id}', 'child', '待处理')])
            self.store.finish(parent.id, 'succeeded')
        with self.database.write_transaction(notify=False) as connection:
            before = connection.execute('SELECT * FROM task_run').fetchall()
            connection.execute('SAVEPOINT cleanup')
            connection.execute('DELETE FROM task_run WHERE id IN (?,?)', tuple(p.id for p in parents))
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), [])
            self.assertEqual(connection.execute('SELECT count(*) FROM task_run').fetchone()[0], 2)
            connection.execute('ROLLBACK TO cleanup')
            connection.execute('RELEASE cleanup')
            self.assertEqual(connection.execute('SELECT * FROM task_run').fetchall(), before)

    def test_query_filters_by_status_group_and_task(self):
        first = self.store.start("demo", trigger="manual")
        second = self.store.start("other", trigger="cli")
        self.store.finish(second.id, "failed", error="坏了")
        self.assertEqual([row.id for row in self.store.query(status="active")], [first.id])
        self.assertEqual([row.id for row in self.store.query(status="finished")], [second.id])
        self.assertEqual([row.id for row in self.store.query(task_key="other")], [second.id])
        with self.assertRaises(ValueError):
            self.store.query(status="done")

    def test_a_read_only_end_records_nothing_but_still_reads(self):
        existing = self.store.start("demo", trigger="manual")
        reader = TaskRunStore(self.database, enabled=False, host="reader")
        self.assertIsNone(reader.start("demo", trigger="manual"))
        self.assertFalse(reader.finish(existing.id, "succeeded"))
        self.assertEqual(reader.recover_interrupted(), [])
        self.assertEqual(reader.prune("demo", keep=0), 0)
        self.assertEqual([row.id for row in reader.query()], [existing.id])
        self.assertEqual(self.store.get(existing.id).status, "running")

    def test_track_settles_on_success_and_on_failure(self):
        with self.store.track("demo", trigger="cli") as handle:
            handle.progress(2, 4, "一半", throttle=0)
        finished = self.store.get(handle.run_id)
        self.assertEqual(finished.status, "succeeded")
        self.assertEqual(finished.progress_current, 2)
        with self.assertRaises(RuntimeError):
            with self.store.track("demo", trigger="cli") as failing:
                raise RuntimeError("source offline")
        broken = self.store.get(failing.run_id)
        self.assertEqual(broken.status, "failed")
        self.assertIn("source offline", broken.error)

    def test_track_hands_back_an_inert_handle_when_the_mutex_is_taken(self):
        self.store.start("demo", trigger="manual", mutex_key="demo")
        with self.store.track("demo", trigger="scheduled", mutex_key="demo") as handle:
            self.assertIsNone(handle.run_id)
            handle.progress(1, 2, throttle=0)
        self.assertEqual(len(self.store.query(status="running")), 1)

    def test_payload_reports_elapsed_time_and_a_readable_task_name(self):
        run = self.store.start("follow-check", trigger="scheduled")
        payload = self.store.get(run.id).payload()
        self.assertEqual(payload["task_label"], "追更检查")
        self.assertGreaterEqual(payload["elapsed_seconds"], 0)
        self.assertEqual(task_label("nothing-registered"), "nothing-registered")


if __name__ == "__main__":
    unittest.main()
