"""`peach.scan`：扫描写进账本的行必须能被读取侧翻译回同一个文件。

两种设置文件写法各一条：Windows 上 `[media.locations] local = <真实目录>`、挂载表为空；
macOS 上数据库路径前缀使用 `R:\\media`，`[media.mounts] local = <真实目录>`。两条都在临时目录里跑。

POSIX 形态那条平台无关，哪台机器上都跑。Windows 形态那条只在 Windows 上跑：它的前提是
配置中的路径前缀本身就是一个真实存在的盘符目录，而 POSIX 机器上造不出这种目录——拿 `/var/...` 配
`windows=True` 不是注入平台，是喂一个账本里不可能出现的形态，写入侧门槛会当场拒收。
"""
from __future__ import annotations

import io
import json
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing, redirect_stdout
from pathlib import Path, PureWindowsPath
from unittest.mock import patch

from peach import catalog_rules, scan
from support.ledger import fresh_ledger
from support.web import route_client

class _ScanCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.db = fresh_ledger(self.root)
        self.media = self.root / "media"
        (self.media / "创作者" / "sub").mkdir(parents=True)
        (self.media / "创作者" / "sub" / "a.mp4").write_bytes(b"0" * 10)
        (self.media / "cover.jpg").write_bytes(b"1" * 3)
        (self.media / "notes.txt").write_bytes(b"2")

    def _paths(self):
        connection = sqlite3.connect(self.db)
        try:
            return dict(connection.execute(
                "SELECT path,medium FROM asset WHERE location='local'").fetchall())
        finally:
            connection.close()

    def _scan(self, root, **kwargs):
        output = io.StringIO()
        with redirect_stdout(output):
            result = scan.scan_location(self.db, "local", root, **kwargs)
        return result, output.getvalue()


@unittest.skipUnless(os.name == "nt", "本用例需要真实存在的 Windows 盘符目录")
class WindowsShapeTests(_ScanCase):
    """Windows：配置的路径前缀就是真实目录，路径原样保存到数据库。"""

    def test_rows_are_written_under_the_declared_root(self):
        declared = {"local": (str(self.media),)}
        result, output = self._scan(str(self.media), declared_roots=declared, windows=True)
        self.assertEqual(result.files, 3)
        self.assertEqual(result.total_bytes, 14)
        self.assertEqual(result.gone, 0)
        self.assertIn("✓ local: 3 文件", output)
        rows = self._paths()
        self.assertEqual(rows[str(self.media / "创作者" / "sub" / "a.mp4")], "video")
        self.assertEqual(rows[str(self.media / "cover.jpg")], "image")
        self.assertEqual(rows[str(self.media / "notes.txt")], "other")
        # 读取侧：Windows 上账本路径就是本机路径，每一行都指向真实存在的文件。
        for path in rows:
            self.assertTrue(Path(path).is_file(), path)

    def test_scan_isolates_shortcuts_without_removing_files_or_media_sidecars(self):
        ad = self.media / '点击进入.url'
        ad.write_bytes(b'link')
        video = self.media / 'ABC-123.mp4'
        video.write_bytes(b'video')
        (self.media / 'ABC-123.nfo').write_text('<movie/>', encoding='utf-8')
        kwargs = dict(declared_roots={'local': (str(self.media),)}, windows=True)
        first, _ = self._scan(str(self.media), **kwargs)
        second, _ = self._scan(str(self.media), **kwargs)
        self.assertEqual((first.junk_isolated, second.junk_isolated), (1, 0))
        self.assertTrue(ad.is_file())
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute('SELECT disposal,disposal_reason FROM asset WHERE path=?',
                                               (str(ad),)).fetchone(), ('trash', 'junk'))
            self.assertEqual(connection.execute('SELECT disposal FROM asset WHERE path=?',
                                               (str(video),)).fetchone(), (None,))

    def test_scanned_video_is_visible_without_a_thumbnail_filter(self):
        from peach.api import create_app
        from peach.config import PeachSettings
        self._scan(str(self.media), declared_roots={"local": (str(self.media),)}, windows=True)
        with route_client(create_app(PeachSettings(db_path=self.db, configured=True, token=""))) as client:
            self.assertEqual(client.get('/api/items').json()['total'], 1)
            self.assertEqual(client.get('/api/items?thumb=0').json()['total'], 1)
            self.assertEqual(client.get('/api/items?thumb=1').json()['total'], 0)

    def test_a_subdirectory_of_the_declared_root_is_accepted(self):
        declared = {"local": (str(self.media),)}
        result, _ = self._scan(str(self.media / "创作者"), declared_roots=declared, windows=True)
        self.assertEqual(result.files, 1)

    def test_rescanning_refreshes_instead_of_duplicating_and_counts_the_gone(self):
        declared = {"local": (str(self.media),)}
        self._scan(str(self.media), declared_roots=declared, windows=True)
        (self.media / "notes.txt").unlink()
        (self.media / "cover.jpg").write_bytes(b"1" * 8)
        result, _ = self._scan(str(self.media), declared_roots=declared, windows=True)
        self.assertEqual(result.files, 2)
        self.assertEqual(len(self._paths()), 3, "没扫到的行留着，由资源同步对账处理")
        connection = sqlite3.connect(self.db)
        size = connection.execute("SELECT size FROM asset WHERE path=?",
                                  (str(self.media / "cover.jpg"),)).fetchone()[0]
        connection.close()
        self.assertEqual(size, 8)


class PosixShapeTests(_ScanCase):
    """macOS：账本里写 `R:\\media\\...`，遍历的是挂载点，读取侧按挂载表翻回去。"""

    def test_webm_is_registered_as_video_and_full_scan_repairs_existing_rows(self):
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        (self.media / 'clip.WeBM').write_bytes(b'webm')
        self._scan('R:\\media', **options)
        with closing(sqlite3.connect(self.db)) as connection, connection:
            asset_id, medium = connection.execute(
                "SELECT id,medium FROM asset WHERE name='clip.WeBM'").fetchone()
            self.assertEqual(medium, 'video')
            connection.execute("UPDATE asset SET medium='other',rating=5 WHERE id=?", (asset_id,))
        self._scan('R:\\media', **options)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute(
                "SELECT id,medium,rating FROM asset WHERE name='clip.WeBM'").fetchall(),
                [(asset_id, 'video', 5)])

    def test_file_identity_preserves_id_and_personal_fields_after_external_rename(self):
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        first, _ = self._scan('R:\\media', **options)
        old = self.media / '创作者/sub/a.mp4'
        with closing(sqlite3.connect(self.db)) as connection, connection:
            asset_id = connection.execute("SELECT id FROM asset WHERE medium='video'").fetchone()[0]
            connection.execute("UPDATE asset SET rating=5,catalog_title='人工标题' WHERE id=?", (asset_id,))
        old.rename(self.media / 'changed.mp4')
        second, _ = self._scan('R:\\media', **options, new_only=True)
        self.assertEqual(second.new_ids, ())
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute('SELECT id,name,rating,catalog_title FROM asset WHERE medium=\'video\'').fetchall(),
                             [(asset_id,'changed.mp4',5,'人工标题')])

    def test_same_size_copy_and_hardlink_are_separate_files(self):
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        self._scan('R:\\media', **options)
        old = self.media / '创作者/sub/a.mp4'
        (self.media / 'copy.mp4').write_bytes(old.read_bytes())
        os.link(old, self.media / 'hardlink.mp4')
        result, _ = self._scan('R:\\media', **options, new_only=True)
        self.assertEqual(len(result.new_ids), 2)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM asset WHERE medium='video'").fetchone()[0], 3)

    def test_same_second_scan_returns_only_exact_insertions(self):
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        with patch('peach.scan.time.strftime', return_value='2026-10-27 12:00:00'):
            self._scan('R:\\media', **options)
            (self.media / 'new.mp4').write_bytes(b'new-video')
            result, _ = self._scan('R:\\media', **options, new_only=True)
        self.assertEqual(len(result.new_ids), 1)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute('SELECT name FROM asset WHERE id=?', result.new_ids).fetchone()[0], 'new.mp4')

    def test_repeated_scan_in_one_second_keeps_completed_videos_out_of_the_new_queue(self):
        from peach.library_new_assets import pending, remember
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        with patch('peach.scan.time.strftime', return_value='2026-10-27 12:00:00'):
            self._scan('R:\\media', **options)
            queued = pending(self.db)
            self.assertEqual(len(queued), 1)
            remember(self.db, completed=queued)
            self._scan('R:\\media', **options)
            self.assertEqual(pending(self.db), [])

    def test_committed_scan_batch_is_pending_when_the_next_checkpoint_is_interrupted(self):
        from peach.file_identity import FileIdentityIndex
        from peach.library_new_assets import pending
        from peach.library_processing import _initial_processing_scope

        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        original = FileIdentityIndex.save

        def stop_after_video_commit(index):
            if 'video' in self._paths().values():
                raise SystemExit()
            return original(index)

        with patch.object(FileIdentityIndex, 'save', stop_after_video_commit), self.assertRaises(SystemExit):
            self._scan('R:\\media', **options)
        result, _ = self._scan('R:\\media', **options, new_only=True)
        queued = pending(self.db)
        self.assertEqual(len(queued), 1)
        self.assertTrue(set(result.new_ids).isdisjoint(queued))
        self.assertEqual(
            _initial_processing_scope(self.db, None, None, True, {'incremental_ids': []}),
            (None, queued),
        )

    def test_windows_mount_mapping_has_the_same_ledger_path_contract(self):
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=True)
        self.assertEqual(scan.walk_root_for('local', 'R:\\media\\创作者', **options), self.media / '创作者')
        self.assertEqual(scan.ledger_root_for('local', self.media / '创作者', **options), 'R:\\media\\创作者')

    def test_root_case_changes_preserve_asset_identity_and_personal_records(self):
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        self._scan('R:\\media', **options)
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute("UPDATE asset SET rating=4,play_count=7")
            before = list(connection.execute("SELECT id,path,rating,play_count FROM asset ORDER BY id"))
        self._scan('r:\\MEDIA', **options)
        with closing(sqlite3.connect(self.db)) as connection, connection:
            self.assertEqual(list(connection.execute("SELECT id,path,rating,play_count FROM asset ORDER BY id")), before)

    def test_conflicting_paths_preserve_each_record_and_allow_other_files_to_register(self):
        paths = ('R:\\media\\copy.mp4', 'r:/MEDIA/COPY.MP4')
        (self.media / 'copy.mp4').write_bytes(b'present')
        with closing(sqlite3.connect(self.db)) as connection, connection:
            for path, rating, plays, disposal in zip(paths, (2, 5), (3, 9), ('vanished', 'trash')):
                connection.execute(
                    'INSERT INTO asset(location,path,name,medium,size,first_seen,last_seen,rating,play_count,disposal) '
                    "VALUES('local',?,'copy.mp4','video',99,'2000-01-01','2000-01-01',?,?,?)",
                    (path, rating, plays, disposal))
            before = list(connection.execute('SELECT id,path,size,rating,play_count,disposal FROM asset ORDER BY id'))
        issues = []
        with patch.object(scan, 'BATCH_SIZE', 1):
            result, output = self._scan('R:\\media', declared_roots={'local': ('R:\\media',)},
                                       mounts={'local': (self.media,)}, windows=False, onerror=issues.append)
        self.assertEqual((result.files, result.path_conflicts, result.gone), (3, 1, 0))
        self.assertEqual(len(result.new_ids), 2)
        self.assertEqual(len(issues), 1)
        self.assertIsInstance(issues[0], scan.ScanPathConflict)
        self.assertEqual(issues[0].paths, paths)
        self.assertEqual(issues[0].asset_ids, (1, 2))
        self.assertIn('路径重复待复核 1 组', output)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(list(connection.execute(
                'SELECT id,path,size,rating,play_count,disposal FROM asset WHERE id<=2 ORDER BY id')), before)
            self.assertEqual(connection.execute('SELECT count(*) FROM asset').fetchone()[0], 4)
            self.assertTrue(all(row[0] > '2000-01-01' for row in connection.execute(
                'SELECT last_seen FROM asset WHERE id<=2')))

    def test_missing_conflict_records_remain_unobserved_and_do_not_block_another_root(self):
        (self.root / 'other').mkdir()
        (self.root / 'other' / 'new.mp4').write_bytes(b'new')
        with closing(sqlite3.connect(self.db)) as connection, connection:
            for path in ('R:\\media\\missing.mp4', 'r:\\MEDIA\\MISSING.mp4'):
                connection.execute("INSERT INTO asset(location,path,name,medium,last_seen) "
                                   "VALUES('local',?,'missing.mp4','video','2000-01-01')", (path,))
        options = dict(declared_roots={'local': ('R:\\media', 'S:\\other')},
                       mounts={'local': (self.media, self.root / 'other')}, windows=False)
        first, _ = self._scan('R:\\media', **options)
        second, _ = self._scan('S:\\other', **options)
        self.assertEqual((first.path_conflicts, first.gone), (1, 2))
        self.assertEqual((second.path_conflicts, second.files, second.gone), (0, 1, 0))
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(list(connection.execute('SELECT last_seen FROM asset WHERE id<=2')),
                             [('2000-01-01',), ('2000-01-01',)])

    def test_subtitles_do_not_choose_between_conflicting_video_records(self):
        (self.media / 'copy.mp4').write_bytes(b'present')
        (self.media / 'copy.srt').write_text('subtitle', encoding='utf-8')
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        self._scan('R:\\media', **options)
        with closing(sqlite3.connect(self.db)) as connection, connection:
            before = list(connection.execute('SELECT id,asset_id,path,pairing FROM asset_subtitle'))
            self.assertEqual(len(before), 1)
            connection.execute("INSERT INTO asset(location,path,name,medium) "
                               "VALUES('local','r:\\MEDIA\\COPY.mp4','copy.mp4','video')")
        (self.media / 'copy.en.srt').write_text('another subtitle', encoding='utf-8')
        result, _ = self._scan('R:\\media', **options)
        self.assertEqual(result.path_conflicts, 1)
        self._scan('R:\\media', **options, resume_state={'mapping': str(self.media), 'pending': [],
                       'current_directory': str(self.media), 'cursor': 'copy.srt',
                       'here': {'copy.mp4': (7, '2000-01-01'), 'copy.srt': (8, '2000-01-01')}})
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(list(connection.execute('SELECT id,asset_id,path,pairing FROM asset_subtitle')), before)

    def test_relocated_mount_restarts_traversal_and_preserves_file_id(self):
        saved = []
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        self._scan('R:\\media', save_checkpoint=lambda value: saved.append(value), **options)
        with closing(sqlite3.connect(self.db)) as connection, connection:
            before = list(connection.execute("SELECT id,path FROM asset ORDER BY id"))
        moved = self.root / 'moved'
        self.media.rename(moved)
        (moved / 'new.mp4').write_bytes(b'new')
        self._scan('R:\\media', resume_state=saved[-1], **{**options, 'mounts': {'local': (moved,)}})
        with closing(sqlite3.connect(self.db)) as connection, connection:
            self.assertEqual(list(connection.execute("SELECT id,path FROM asset ORDER BY id LIMIT 3")), before)
            self.assertEqual(connection.execute('SELECT count(*) FROM asset').fetchone()[0], 4)

    def test_scanning_one_root_does_not_count_other_roots_as_missing(self):
        options = dict(declared_roots={'local': ('R:\\media', 'S:\\other')},
                       mounts={'local': (self.media, self.root / 'other')}, windows=False)
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute("INSERT INTO asset(location,path,name,medium,last_seen) VALUES('local','S:\\other\\copy.mp4','copy.mp4','video','2000-01-01')")
        result, _ = self._scan('R:\\media', **options)
        self.assertEqual(result.gone, 0)
        self.assertEqual(len(result.new_ids), 3)

    def test_resume_skips_committed_directories_and_retains_subtitles_and_new_ids(self):
        (self.media / '创作者/sub/a.srt').write_text('subtitle', encoding='utf-8')
        saved = {}
        def save(state):
            saved.clear()
            saved.update(json.loads(json.dumps(state)))
            if state.get('files') == 2:
                raise InterruptedError('simulated service exit')
        options = dict(declared_roots={'local': ('R:\\media',)},
                       mounts={'local': (self.media,)}, windows=False)
        with self.assertRaises(InterruptedError):
            self._scan('R:\\media', save_checkpoint=save, **options)
        visited = []
        scandir = os.scandir
        def walk(path):
            visited.append(Path(path))
            return scandir(path)
        with patch.object(scan.os, 'scandir', side_effect=walk):
            result, _ = self._scan('R:\\media', resume_state=saved, **options)
        self.assertNotIn(self.media, visited)
        self.assertEqual((result.files, result.total_bytes, result.subtitles), (4, 22, 1))
        self.assertEqual(len(result.new_ids), 4)
        self.assertEqual(len(self._paths()), 4)

    def test_finished_root_checkpoint_does_not_enumerate_the_tree(self):
        saved = []
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        first, _ = self._scan('R:\\media', save_checkpoint=lambda value: saved.append(value), **options)
        with patch.object(scan.os, 'scandir', side_effect=AssertionError('已完成的根不应再次枚举')):
            second, _ = self._scan('R:\\media', resume_state=json.loads(json.dumps(saved[-1])), **options)
        self.assertEqual(second, first)

    def test_release_checkpoint_without_conflict_count_preserves_completed_work(self):
        saved = []
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        first, _ = self._scan('R:\\media', save_checkpoint=lambda value: saved.append(value), **options)
        released = json.loads(json.dumps(saved[-1]))
        del released['result']['path_conflicts']
        with closing(sqlite3.connect(self.db)) as connection:
            before = list(connection.execute('SELECT id,path,first_seen,last_seen FROM asset ORDER BY id'))
        with patch.object(scan.os, 'scandir', side_effect=AssertionError('已完成目录保留扫描结果')):
            resumed, _ = self._scan('R:\\media', resume_state=released, **options)
        self.assertEqual(resumed, first)
        self.assertEqual(resumed.path_conflicts, 0)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(list(connection.execute('SELECT id,path,first_seen,last_seen FROM asset ORDER BY id')), before)

    def test_file_batch_cursor_resumes_inside_a_directory(self):
        saved = {}
        def save(state):
            saved.update(json.loads(json.dumps(state)))
            if state.get('cursor'):
                raise InterruptedError('simulated exit after a file batch commit')
        options = dict(declared_roots={'local': ('R:\\media',)}, mounts={'local': (self.media,)}, windows=False)
        with patch.object(scan, 'BATCH_SIZE', 1), self.assertRaises(InterruptedError):
            self._scan('R:\\media', save_checkpoint=save, **options)
        self.assertEqual(saved['files'], 1)
        (self.media / saved['cursor']).write_bytes(b'changed after checkpoint')
        progress = []
        result, _ = self._scan('R:\\media', resume_state=saved,
                               progress=lambda count, size: progress.append((count, size)), **options)
        self.assertEqual((result.files, result.total_bytes), (3, 14))
        self.assertTrue(all(count >= 1 for count, _ in progress))
        self.assertEqual(len(self._paths()), 3)

    def test_structured_progress_reports_discovered_files_and_bytes(self):
        progress = []
        result, _ = self._scan('R:\\media', declared_roots={'local': ('R:\\media',)},
                               mounts={'local': (str(self.media),)}, windows=False,
                               progress=lambda files, size: progress.append((files, size)))
        self.assertEqual(progress[0][0], 1)
        self.assertEqual(progress[-1], (3, 14))
        self.assertEqual(progress[-1], (result.files, result.total_bytes))

    DECLARED = {"local": (r"R:\media",)}

    def test_rows_keep_the_ledger_shape_and_translate_back_to_real_files(self):
        mounts = {"local": (self.media,)}
        result, _ = self._scan(r"R:\media", declared_roots=self.DECLARED, mounts=mounts,
                               windows=False)
        self.assertEqual(result.files, 3)
        rows = self._paths()
        self.assertEqual(set(rows), {r"R:\media\创作者\sub\a.mp4", r"R:\media\cover.jpg",
                                     r"R:\media\notes.txt"})
        # 与 `platform.translate_ledger_path` 一致：路径前缀后的层级拼到本机媒体目录。
        for path in rows:
            tail = PureWindowsPath(path).relative_to(PureWindowsPath(r"R:\media")).parts
            self.assertTrue(self.media.joinpath(*tail).is_file(), path)

    def test_a_local_directory_is_converted_to_the_ledger_shape(self):
        mounts = {"local": (str(self.media),)}
        root = scan.ledger_root_for("local", self.media / "创作者",
                                    declared_roots=self.DECLARED, mounts=mounts, windows=False)
        self.assertEqual(root, r"R:\media\创作者")
        result, _ = self._scan(root, declared_roots=self.DECLARED, mounts=mounts, windows=False)
        self.assertEqual(set(self._paths()), {r"R:\media\创作者\sub\a.mp4"})

    def test_a_source_without_a_mount_is_refused_before_touching_the_ledger(self):
        with self.assertRaises(scan.ScanTargetError) as caught:
            self._scan(r"R:\media", declared_roots=self.DECLARED, mounts={}, windows=False)
        self.assertIn("media.mounts", str(caught.exception))
        self.assertEqual(self._paths(), {})

    def test_a_second_root_maps_to_its_own_mount(self):
        """两个目录都是 `local`：第二个挂载目录对应第二个数据库路径前缀。"""
        second = self.root / "more"
        (second / "deep").mkdir(parents=True)
        (second / "deep" / "c.mp4").write_bytes(b"2")
        declared = {"local": (r"R:\media", r"R:\media2")}
        mounts = {"local": (str(self.media), str(second))}
        root = scan.ledger_root_for("local", second / "deep", declared_roots=declared,
                                    mounts=mounts, windows=False)
        self.assertEqual(root, r"R:\media2\deep")
        result, _ = self._scan(root, declared_roots=declared, mounts=mounts, windows=False)
        self.assertEqual(result.files, 1)
        self.assertEqual(set(self._paths()), {r"R:\media2\deep\c.mp4"})
        # 第二个路径前缀没有对应的挂载目录时拒绝扫描，不能读取第一个目录。
        with self.assertRaises(scan.ScanTargetError) as caught:
            scan.walk_root_for("local", r"R:\media2", declared_roots=declared,
                               mounts={"local": (str(self.media),)}, windows=False)
        self.assertIn("第 2 个数据库路径前缀", str(caught.exception))

    def test_a_directory_outside_the_mount_is_refused(self):
        with self.assertRaises(scan.ScanTargetError) as caught:
            scan.ledger_root_for("local", "/somewhere/else", declared_roots=self.DECLARED,
                                 mounts={"local": (str(self.media),)}, windows=False)
        self.assertIn("挂载点", str(caught.exception))

    def test_a_directory_outside_every_root_is_refused_before_touching_the_ledger(self):
        """#591：Windows 挂载表为空时曾在取挂载表时越界（IndexError）。"""
        with self.assertRaises(scan.ScanTargetError) as caught:
            self._scan(r"Q:\elsewhere", declared_roots=self.DECLARED, mounts={}, windows=True)
        self.assertIn("不在任何已配置的媒体目录下", str(caught.exception))
        self.assertEqual(self._paths(), {})


class CaseOnlyRenameTests(_ScanCase):
    """只改大小写的文件与目录（#487）：扫描跟随磁盘上的实际写法，资产 id 与个人资料不变。"""

    options = dict(declared_roots={'local': (r'R:\media',)}, windows=False)

    def scan(self):
        return self._scan(r'R:\media', **self.options, mounts={'local': (self.media,)})

    def video(self):
        with closing(sqlite3.connect(self.db)) as connection:
            return connection.execute("SELECT id,path,name,rating FROM asset WHERE medium='video'").fetchall()

    def test_a_file_renamed_only_in_case_keeps_its_id_and_follows_the_new_spelling(self):
        self.scan()
        with closing(sqlite3.connect(self.db)) as connection, connection:
            asset_id = connection.execute("SELECT id FROM asset WHERE medium='video'").fetchone()[0]
            connection.execute('UPDATE asset SET rating=4 WHERE id=?', (asset_id,))
        sub = self.media / '创作者' / 'sub'
        os.rename(sub / 'a.mp4', sub / 'A.mp4')
        self.scan()
        self.assertEqual(self.video(), [(asset_id, r'R:\media\创作者\sub\A.mp4', 'A.mp4', 4)])

    def test_a_directory_renamed_only_in_case_moves_the_files_under_it(self):
        self.scan()
        asset_id = self.video()[0][0]
        os.rename(self.media / '创作者' / 'sub', self.media / '创作者' / 'SUB')
        self.scan()
        self.assertEqual([row[:2] for row in self.video()], [(asset_id, r'R:\media\创作者\SUB\a.mp4')])

    def test_both_spellings_present_on_a_case_sensitive_disk_are_left_alone(self):
        sub = self.media / '创作者' / 'sub'
        (sub / 'A.mp4').write_bytes(b'1' * 10)
        if not (sub / 'a.mp4').exists() or (sub / 'A.mp4').samefile(sub / 'a.mp4'):
            self.skipTest('文件系统不区分大小写，两种写法是同一个文件')
        self.scan()
        paths = sorted(row[1] for row in self.video())
        self.assertIn(r'R:\media\创作者\sub\a.mp4', paths)


class SidecarTests(_ScanCase):
    """刮削器与截图工具写在正片旁边的附属文件不登记，图集里同名的图照常登记。"""

    DECLARED = {"local": (r"R:\media",)}

    def _layout(self, files):
        for name in files:
            path = self.media.joinpath(*name.split("/"))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"0")

    def test_a_kodi_movie_folder_registers_only_the_video(self):
        self._layout(["FC2-1/FC2-1-CD1.mp4", "FC2-1/FC2-1-CD1.nfo", "FC2-1/poster.jpg",
                      "FC2-1/fanart.jpg", "FC2-1/thumb.jpg", "FC2-1/extrafanart/1.jpg",
                      "FC2-1/FC2-1-CD1-landscape.jpg",
                      "thumbs_new/detailed/FC2-1_4x4_thumb.jpg", "ABC-1.mp4_thumbs.jpg"])
        result, output = self._scan(r"R:\media", declared_roots=self.DECLARED,
                                    mounts={"local": (self.media,)}, windows=False)
        self.assertEqual(result.sidecars, 8)
        self.assertIn("附属文件未登记 8 个", output)
        self.assertEqual(set(self._paths()), {
            r"R:\media\FC2-1\FC2-1-CD1.mp4", r"R:\media\创作者\sub\a.mp4",
            r"R:\media\cover.jpg", r"R:\media\notes.txt"})

    def test_artwork_names_without_a_video_beside_them_are_photos(self):
        self._layout(["写真/cover.jpg", "写真/extrafanart/1.jpg", "写真/poster-1.jpg"])
        self._scan(r"R:\media\写真", declared_roots=self.DECLARED,
                   mounts={"local": (self.media,)}, windows=False)
        self.assertEqual(set(self._paths()), {
            r"R:\media\写真\cover.jpg", r"R:\media\写真\extrafanart\1.jpg",
            r"R:\media\写真\poster-1.jpg"})

    def test_movie_trailers_are_sidecars_and_short_main_features_are_kept(self):
        self._layout(['ABC-123/ABC-123.mp4', 'ABC-123/ABC-123-trailer.mp4',
                      'ABC-123/ABC-123.nfo', 'ABC-123/ABC-123-poster.jpg',
                      'ABC-123/extrafanart/1.jpg', 'ABC-123/short-film.mp4'])
        result, _ = self._scan(r'R:\media\ABC-123', declared_roots=self.DECLARED,
                               mounts={'local': (self.media,)}, windows=False)
        self.assertEqual((result.files, result.sidecars), (2, 4))
        self.assertEqual(set(self._paths()), {
            r'R:\media\ABC-123\ABC-123.mp4', r'R:\media\ABC-123\short-film.mp4'})
        self.assertTrue((self.media / 'ABC-123/ABC-123-trailer.mp4').is_file())

    def test_trailer_names_use_an_explicit_terminal_marker(self):
        self.assertEqual(scan.video_stems(['ABC-123.mp4', 'ABC-123-trailer.mp4']),
                         frozenset({'abc-123'}))
        for name in ('ABC-123-trailer.mp4', 'ABC-123.TRAILER.MKV', 'ABC-123_trailer.mov',
                     'ABC-123 trailer.m4v', 'trailer.mp4'):
            with self.subTest(name=name):
                self.assertTrue(scan.is_sidecar(name, frozenset()))
        for name in ('ABC-123.mp4', 'Trailer Park.mp4', 'ABC-123-trailer-park.mp4',
                     'ABC-123trailer.mp4', 'ABC-123-trailer.mp4.bak', 'trailer.jpg'):
            with self.subTest(name=name):
                self.assertFalse(scan.is_sidecar(name, frozenset()))

    def test_media_server_extras_and_nested_directories_are_not_registered(self):
        paths = ['Film/Film.mkv', 'Film/Trailer 1-trailer.MP4', 'Film/Interview-interview2.mkv',
                 'Film/trailers/Teaser.mp4', 'Film/Extras/Trailers/Trailer 2.mkv',
                 'Film/behind the scenes/Making of.mp4', 'Film/deleted scenes/Ending.mp4',
                 'Film/shorts/Bonus.mp4', 'Film/specials/Bonus.mp4',
                 'Film/backdrops/Menu.mkv', 'Film/theme-music/Score.flac', 'Film/theme.mp3']
        self._layout(paths)
        result, _ = self._scan(r'R:\media\Film', declared_roots=self.DECLARED,
                               mounts={'local': (self.media,)}, windows=False)
        self.assertEqual((result.files, result.sidecars), (1, len(paths) - 1))
        self.assertEqual(self._paths(), {r'R:\media\Film\Film.mkv': 'video'})
        self.assertTrue(all((self.media / name).is_file() for name in paths))

    def test_a_declared_shorts_root_contains_independent_features(self):
        self._layout(['Shorts/One.mp4', 'Shorts/Film/extras/Making of.mp4'])
        result, _ = self._scan(r'R:\media\Shorts', declared_roots={'local': (r'R:\media\Shorts',)},
                               mounts={'local': (self.media / 'Shorts',)}, windows=False)
        self.assertEqual((result.files, result.sidecars), (1, 1))
        self.assertEqual(self._paths(), {r'R:\media\Shorts\One.mp4': 'video'})


class LocalExtraNamingTests(unittest.TestCase):
    def test_movie_and_episode_suffixes_and_numbered_bare_names(self):
        examples = {
            'trailer.mp4': 'trailer', 'trailer2.MKV': 'trailer', 'sample1.mp4': 'sample',
            'Film-trailer1.mp4': 'trailer', 'Film.trailer2.mkv': 'trailer',
            'Film_trailer3.mov': 'trailer', 'Film trailer4.m4v': 'trailer',
            'Film- trailer5.mp4': 'trailer', 'Film-sample1.mp4': 'sample',
            'Film.sample2.mkv': 'sample', 'Film_sample3.mov': 'sample',
            'Film sample4.mp4': 'sample', 'Film- sample5.mp4': 'sample',
            'Performance Capture-behindthescenes.mkv': 'behindthescenes',
            'Ending-deleted.mp4': 'deleted', 'Ending-deletedscene2.mp4': 'deleted',
            'Special Effects-featurette.mp4': 'featurette', 'Actor-interview.mp4': 'interview',
            'Arrival-scene.mp4': 'scene', 'Moment-clip.mp4': 'clip',
            'Bonus-short.mp4': 'short', 'Bonus-extra.mp4': 'other', 'Bonus-other.mp4': 'other',
            'Show - S01E01 - Episode-deleted2.mkv': 'deleted', 'theme.flac': 'themeaudio',
        }
        for name, expected in examples.items():
            with self.subTest(name=name):
                self.assertEqual(catalog_rules.local_extra_type(name), expected)
                self.assertTrue(scan.is_sidecar(name, frozenset()))

    def test_exact_markers_preserve_titles_and_unsupported_files(self):
        for name in ('Short Film.mp4', 'Trailer Park.mp4', 'Interview.mp4', 'Sample Story.mp4',
                     'Filmtrailer.mp4', 'Film-short-story.mp4', 'Film-deleted-scenes.mp4',
                     'Film-trailerA.mp4', 'Film-trailer.mp4.bak', 'Film-trailer.jpg',
                     'Film-interview.mp3', 'theme.mp4', '', None):
            with self.subTest(name=name):
                self.assertIsNone(catalog_rules.local_extra_type(name))

    def test_dedicated_directories_are_case_insensitive_and_allow_nesting(self):
        directories = {'Trailers': 'trailer', 'Behind The Scenes': 'behindthescenes',
            'Deleted Scenes': 'deleted', 'Interviews': 'interview', 'Scenes': 'scene',
            'Samples': 'sample', 'Sample': 'sample', 'Shorts': 'short',
            'Featurettes': 'featurette', 'Clips': 'clip', 'Other': 'other',
            'Extras': 'other', 'Extra': 'other', 'Specials': 'other', 'Backdrops': 'themevideo'}
        for directory, expected in directories.items():
            for path in (f'R:/Movies/Film/{directory}/Clip.mp4',
                         f'R:/Movies/Film/{directory}/Disc 1/Clip.mp4'):
                with self.subTest(path=path):
                    self.assertEqual(catalog_rules.local_extra_type('Clip.mp4', path,
                                     library_roots=('R:/Movies',)), expected)
        self.assertEqual(catalog_rules.local_extra_type('Score.opus', '/movies/Film/theme-music/Score.opus'),
                         'themeaudio')
        self.assertIsNone(catalog_rules.local_extra_type('Score.opus', '/movies/Film/trailers/Score.opus'))
        self.assertEqual(catalog_rules.local_extra_type('Clip.mp4', '/movies/Film/Extras/theme-music/Clip.mp4'),
                         'other')
        self.assertEqual(catalog_rules.local_extra_type('Score.opus', '/movies/Film/theme-music/clips/Score.opus'),
                         'themeaudio')

    def test_longest_library_root_is_the_directory_boundary(self):
        for path, roots in ((r'R:\Shorts\Film.mp4', ('R:/Shorts',)),
                            ('/Movies/Extras/Film.mp4', ('/Movies', '/Movies/Extras')),
                            (r'\\server\Shorts\Film.mp4', (r'\\server\Shorts',))):
            with self.subTest(path=path):
                self.assertIsNone(catalog_rules.local_extra_type('Film.mp4', path, library_roots=roots))
        self.assertEqual(catalog_rules.local_extra_type('Clip.mp4', 'R:/Shorts/Film/Extras/Clip.mp4',
                         library_roots=('r:/shorts',)), 'other')

    def test_sqlite_classifier_uses_configured_library_boundaries(self):
        from peach.repository import LedgerDatabase
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary).resolve() / 'ledger.db'
            sqlite3.connect(path).close()
            database = LedgerDatabase(path, media_roots=('R:/Movies', 'R:/Movies/Shorts'))
            with database.read_connection() as connection:
                values = [connection.execute("SELECT peach_is_local_extra('Film.mp4',?)", (value,)).fetchone()[0]
                          for value in ('R:/Movies/Shorts/Film.mp4', 'R:/Movies/Shorts/Film/Extras/Film.mp4')]
            self.assertEqual(values, [0, 1])

    def test_the_rule_reads_names_only(self):
        videos = scan.video_stems(["ABC-1.mp4", "notes.txt"])
        self.assertEqual(videos, frozenset({"abc-1"}))
        sidecar = {name: scan.is_sidecar(name, videos) for name in (
            "x.NFO", "Poster.JPG", "ABC-1-fanart.jpg", "ABC-1.jpg", "OTHER-fanart.jpg",
            "a.png.thumb.png", "ABC-1_3x3_thumbs.jpg", "ABC-1.srt", "001.jpg")}
        self.assertEqual({name for name, hit in sidecar.items() if hit}, {
            "x.NFO", "Poster.JPG", "ABC-1-fanart.jpg", "a.png.thumb.png",
            "ABC-1_3x3_thumbs.jpg"})


class ScanTargetTests(unittest.TestCase):
    """写入侧门槛：`location` 与扫描根必须对得上（ADR-0023 第 2 阶段），口径与脚本时期一致。"""

    DECLARED = {"local": (r"R:\media",), "115": ("B:/",)}

    def test_the_declared_root_and_its_subdirectories_are_accepted(self):
        for location, root in (("local", r"R:\media"), ("local", r"R:\media\创作者"),
                               ("115", "B:/x")):
            self.assertIsNone(scan.check_scan_target(location, root,
                                                     declared_roots=self.DECLARED))

    def test_a_root_belonging_to_another_source_is_refused(self):
        with self.assertRaises(scan.ScanTargetError) as caught:
            scan.check_scan_target("115", r"R:\media\创作者", declared_roots=self.DECLARED)
        self.assertIn("115", str(caught.exception))
        self.assertIn("local", str(caught.exception))

    def test_a_root_outside_every_declared_root_is_refused(self):
        with self.assertRaises(scan.ScanTargetError) as caught:
            scan.check_scan_target("local", r"R:\Resources\Intake", declared_roots=self.DECLARED)
        self.assertIn(r"R:\media", str(caught.exception))

    def test_an_undeclared_source_is_refused_and_lists_the_known_ones(self):
        with self.assertRaises(scan.ScanTargetError) as caught:
            scan.check_scan_target("nas", "N:/", declared_roots=self.DECLARED)
        self.assertIn("nas", str(caught.exception))
        self.assertIn("local", str(caught.exception))

    def test_a_subdirectory_maps_to_its_own_root_without_mounts(self):
        """#591：Windows 挂载表为空、来源有多个根时，根下子目录原样作为扫描目录。"""
        declared = {"local": (r"R:\media", r"S:\more")}
        self.assertEqual(scan.walk_root_for("local", r"S:\more\演员\作品", declared_roots=declared,
                                            mounts={}, windows=True), Path(r"S:\more\演员\作品"))

    def test_a_directory_outside_every_root_is_a_readable_error_not_an_index_error(self):
        """#591：不在任何根下时报可读错误；挂载表非空时也不能落到最后一个挂载点上。"""
        for mounts, windows in (({}, True), ({"local": ("/mnt/media",)}, False)):
            with self.subTest(mounts=mounts), self.assertRaises(scan.ScanTargetError) as caught:
                scan.walk_root_for("local", r"Q:\elsewhere\作品", declared_roots=self.DECLARED,
                                   mounts=mounts, windows=windows)
            self.assertIn("不在任何已配置的媒体目录下", str(caught.exception))

    def test_medium_is_decided_by_extension(self):
        self.assertEqual([scan.medium_of(name) for name in
                          ("a.MP4", "b.webp", "c.flac", "d.7z", "e.nfo")],
                         ["video", "image", "audio", "archive", "other"])


class NasDirectoryTests(unittest.TestCase):
    def test_system_directories_are_skipped_and_similarly_named_files_are_kept(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            for name in ("#recycle", "#RECYCLE", "@eaDir", "@snapshot", "@Recycle",
                         "@Recently-Snapshot", ".@__thumb", ".@__qini", ".@upload_cache", ".streams",
                         ".zfs", ".snapshot", ".snapshots", "~snapshot", ".recycle", ".Trash", ".Trash-1000",
                         ".TemporaryItems", ".AppleDouble", ".AppleDB", ".@#local",
                         ".AppleDesktop", "Network Trash Folder", ".Spotlight-V100", ".Trashes",
                         ".fseventsd", "__MACOSX", "$Recycle.Bin", "System Volume Information",
                         ".DocumentRevisions-V100", ".DocumentRevisions-V100-bad-1",
                         ".wfm_upload123", "normal", "@creator", ".hidden"):
                folder = root / name
                folder.mkdir(exist_ok=True)
                (folder / "sample.mp4").write_bytes(b"x")
            for name in ("@video.mp4", "#recycle.mp4"):
                (root / name).write_bytes(b"x")
            files = [Path(entry.path).relative_to(root).as_posix()
                     for _, entries in scan._walk(root) for entry in entries]
        self.assertEqual(set(files), {"normal/sample.mp4", "@creator/sample.mp4", ".hidden/sample.mp4",
                                      "@video.mp4", "#recycle.mp4"})


class LedgerReopenTests(_ScanCase):
    """#138：开写事务时打不开事务侧文件，重开连接重试当前批次，而不是整轮失败。"""

    OPTIONS = dict(declared_roots={'local': ('R:\\media',)}, windows=False)

    def test_a_batch_that_cannot_open_the_journal_is_retried_on_a_fresh_connection(self):
        real = scan._upsert_records
        calls = []

        def flaky(connection, *args, **kwargs):
            calls.append(connection)
            inserted = real(connection, *args, **kwargs)
            if len(calls) == 1:
                raise sqlite3.OperationalError("unable to open database file")
            return inserted

        with patch.object(scan, '_upsert_records', flaky), patch.object(scan.time, 'sleep') as slept, \
                self.assertLogs('peach.scan', level='WARNING') as logs:
            result, _ = self._scan('R:\\media', mounts={'local': (self.media,)}, **self.OPTIONS)
        self.assertEqual(result.files, 3)
        self.assertEqual(len(result.new_ids), 3)
        self.assertIsNot(calls[0], calls[1])
        slept.assert_called_once_with(scan.REOPEN_DELAYS[0])
        self.assertIn('retrying', logs.output[0])
        self.assertEqual(len(self._paths()), 3)

    def test_other_operational_errors_and_exhausted_retries_are_raised(self):
        for message, attempts in (("database is locked", 1), ("unable to open database file",
                                                               len(scan.REOPEN_DELAYS) + 1)):
            with self.subTest(message), patch.object(
                    scan, '_upsert_records', side_effect=sqlite3.OperationalError(message)) as upsert, \
                    patch.object(scan.time, 'sleep'), self.assertLogs('peach.scan', level='WARNING') as logs:
                with self.assertRaises(sqlite3.OperationalError):
                    self._scan('R:\\media', mounts={'local': (self.media,)}, **self.OPTIONS)
                scan.LOGGER.warning('marker')
            self.assertEqual(upsert.call_count, attempts)
            self.assertEqual(len(logs.output), attempts)

    def test_a_journal_mode_other_than_wal_is_logged(self):
        with self.assertLogs('peach.scan', level='WARNING') as logs:
            scan._open_ledger(':memory:').close()
        self.assertIn('instead of wal', logs.output[0])


class UnreadableRootTests(unittest.TestCase):
    def test_an_unreadable_root_raises_while_unreadable_subdirectories_are_skipped(self):
        """#693：根目录读不了就什么都没枚举到，不能当成空来源；子目录读不了照旧跳过。"""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            (root / "bad").mkdir()
            (root / "good").mkdir()
            (root / "good" / "a.mp4").write_bytes(b"x")
            refused = {str(root / "bad")}

            def read_directory(directory):
                if directory in refused:
                    raise PermissionError(13, "denied", directory)
                with os.scandir(directory) as entries:
                    return list(entries)

            errors = []
            files = [entry.name for _, entries in scan._walk(root, read_directory=read_directory,
                                                              onerror=errors.append) for entry in entries]
            self.assertEqual((files, len(errors)), (["a.mp4"], 1))
            refused.add(str(root))
            with self.assertRaises(scan.ScanRootUnreadable) as caught:
                list(scan._walk(root, read_directory=read_directory, onerror=errors.append))
            self.assertEqual(caught.exception.code, "errors.scan.rootUnreadable")
            self.assertEqual(len(errors), 1)


class SystemMetadataTests(_ScanCase):
    def test_a_system_directory_scan_root_is_skipped_before_mapping_or_listing(self):
        options = dict(declared_roots={'local': (r'R:\media\.snapshots',)},
                       mounts={'local': (self.media,)}, windows=False)
        progress = []
        with patch.object(scan, 'walk_root_for') as mapped, patch.object(scan, '_walk') as walked:
            result, output = self._scan(r'R:\media\.snapshots', **options,
                                       progress=lambda files, total: progress.append((files, total)))
        self.assertEqual((result.files, result.total_bytes, result.gone), (0, 0, 0))
        self.assertEqual(progress, [(0, 0)])
        self.assertIn('0 文件', output)
        mapped.assert_not_called()
        walked.assert_not_called()
        self.assertEqual(self._paths(), {})
        with self.assertRaises(scan.ScanTargetError):
            self._scan(r'R:\media\.snapshots', declared_roots={})

    def test_system_walk_roots_and_resumed_directories_are_not_listed(self):
        system = self.media / '.Trash-1000'
        system.mkdir()
        (system / 'movie.mp4').write_bytes(b'media')
        with patch.object(scan.os, 'scandir') as listed:
            self.assertEqual(list(scan._walk(system)), [])
            self.assertEqual(list(scan._walk(self.media, [str(system)])), [])
        listed.assert_not_called()

    def test_full_scan_and_direct_ingest_share_metadata_file_rules(self):
        names = ('desktop.ini', 'Thumbs.db', '.DS_Store', '._movie.mp4', '.SYNOPPSDB123',
                 '.wfm_upload123.mp4', 'movie.mp4@SynoEAStream')
        for name in names:
            (self.media / name).write_bytes(b'metadata')
        (self.media / '@creator').mkdir()
        (self.media / '@creator' / '.hidden.mp4').write_bytes(b'media')
        options = dict(declared_roots={'local': (r'R:\media',)},
                       mounts={'local': (self.media,)}, windows=False)
        for name in names:
            result = scan.ingest_path(self.db, 'local', str(PureWindowsPath(r'R:\media', name)), **options)
            self.assertEqual((result.found, result.sidecar, result.asset_id), (True, True, None), name)
        self.assertEqual(self._paths(), {})
        cover = scan.ingest_path(self.db, 'local', r'R:\media\cover.jpg', **options)
        self.assertEqual((cover.found, cover.sidecar), (True, False))
        result, _ = self._scan(r'R:\media', **options)
        self.assertEqual(result.files, 4)
        self.assertIn(r'R:\media\@creator\.hidden.mp4', self._paths())
        self.assertTrue(all((self.media / name).is_file() for name in names))


if __name__ == "__main__":
    unittest.main()
