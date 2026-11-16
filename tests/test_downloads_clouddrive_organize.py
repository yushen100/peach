"""已声明来源的官方移动：冲突、成员核验、确定性拒绝与状态未知、路径边界。"""
import ssl
import unittest
from pathlib import PureWindowsPath
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.parse import unquote, urlsplit

import httpx
import grpc

from peach.organize_clouddrive import (ACCEPTED, DAV_ORIGIN, REJECTED, MoveNotExecuted, PikPakDav,
                                       UnconfirmedMove)
from peach import organize_clouddrive
from peach.task_retry import transient_delay
from peach.os_errors import UserFileNotFoundError

MAPPING = organize_clouddrive.PikPakPaths('A:\\', '/Pikpak')


class Status(grpc.RpcError):
    def __init__(self, code):
        self._code = code

    def code(self):
        return self._code


class ConfiguredPaths(unittest.TestCase):
    def setUp(self):
        self.mapping = organize_clouddrive.PikPakPaths('P:\\Library', '/My cloud/Movies', '/Movies')

    def test_parent_creation_keeps_server_retry_after_but_stops_for_authentication(self):
        for status, delay in ((429, 1200), (503, 1200), (401, None), (403, None)):
            with self.subTest(status=status), httpx.Client(transport=httpx.MockTransport(
                    lambda request, status=status: httpx.Response(status, headers={'Retry-After': '1200'}))) as http:
                dav = PikPakDav(http, self.mapping, Mock(), listing=lambda path: [], rename=Mock(), move_remote=Mock())
                with self.assertRaises(OSError) as failure:
                    dav.ensure_parent('P:\\Library\\new\\film.mp4')
                self.assertEqual(transient_delay(failure.exception), delay)

    def test_certificate_failure_does_not_become_a_retryable_file_error(self):
        error = httpx.ConnectError('证书校验失败')
        error.__cause__ = ssl.SSLCertVerificationError('证书不可信')
        with httpx.Client(transport=httpx.MockTransport(Mock(side_effect=error))) as http:
            dav = PikPakDav(http, self.mapping, Mock(), listing=lambda path: [], rename=Mock(), move_remote=Mock())
            with self.assertRaises(OSError) as failure:
                dav.ensure_parent('P:\\Library\\new\\film.mp4')
            self.assertIsNone(transient_delay(failure.exception))

    def test_directory_network_failure_retries_but_permission_failure_stops(self):
        for code, delay in ((grpc.StatusCode.UNAVAILABLE, 0), (grpc.StatusCode.DEADLINE_EXCEEDED, 0),
                            (grpc.StatusCode.PERMISSION_DENIED, None)):
            with self.subTest(code=code):
                stream = Mock()
                stream.__iter__ = Mock(side_effect=Status(code))
                cloud = Mock(token='test-token')
                cloud.channel.unary_stream.return_value.return_value = stream
                with self.assertRaises(OSError) as failure:
                    organize_clouddrive._cloud_listing(cloud, 'P:\\Library', self.mapping)
                self.assertEqual(transient_delay(failure.exception), delay)
                stream.cancel.assert_called_once()

    def test_custom_drive_subdirectory_and_remote_name(self):
        self.assertEqual(self.mapping.cloud_path('p:\\library\\人名\\a.mp4'), '/My cloud/Movies/人名/a.mp4')
        self.assertEqual(self.mapping.dav_path('P:\\Library\\人名\\a.mp4'), '/Movies/人名/a.mp4')
        dav = PikPakDav(Mock(), self.mapping, Mock(), listing=Mock(), rename=Mock(), move_remote=Mock())
        self.assertEqual(unquote(dav.url('P:\\Library\\a b.mp4')), DAV_ORIGIN + '/Movies/a b.mp4')
        dav.ensure_parent('P:\\Library\\a.mp4')
        dav.listing.assert_not_called()

    def test_paths_outside_the_declared_directory_are_rejected(self):
        for path in ('A:\\a.mp4', 'P:\\LibraryOther\\a.mp4', 'P:\\Library\\..\\a.mp4',
                     'P:Library\\a.mp4', 'P:\\Library\\a.mp4:secret'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.mapping.cloud_path(path)

    def test_mapping_comes_from_the_samples_declared_root(self):
        roots = {'pikpak': ('P:\\Library', 'Q:\\Second')}
        prefixes = (organize_clouddrive.CloudPrefix('/My cloud/Movies', 'P:\\Library'),
                    organize_clouddrive.CloudPrefix('/Another account', 'Q:\\Second'))
        selected = organize_clouddrive._configured_paths('Q:\\Second\\a.mp4', roots, prefixes)
        self.assertEqual((selected.root, selected.remote), ('Q:\\Second', '/Another account'))
        for mappings in ((), prefixes + (organize_clouddrive.CloudPrefix('/Duplicate', 'Q:\\Second'),)):
            with self.subTest(mappings=mappings), self.assertRaises(ValueError):
                organize_clouddrive._configured_paths('Q:\\Second\\a.mp4', roots, mappings)

    def test_protocol_requests_use_the_configured_remote_directory(self):
        cloud = Mock(token='test-token')
        cloud.channel.unary_unary.return_value.return_value = SimpleNamespace(success=True)
        organize_clouddrive._move_remote(cloud, 'P:\\Library\\old\\a.mp4',
                                        'P:\\Library\\new\\a.mp4', self.mapping)
        request = cloud.channel.unary_unary.return_value.call_args.args[0]
        self.assertEqual(list(request.theFilePaths), ['/My cloud/Movies/old/a.mp4'])
        self.assertEqual(request.destPath, '/My cloud/Movies/new')
        organize_clouddrive._rename_remote(cloud, 'P:\\Library\\old\\a.mp4',
                                          'P:\\Library\\old\\b.mp4', self.mapping)
        request = cloud.channel.unary_unary.return_value.call_args.args[0]
        self.assertEqual((request.path, request.newName), ('/My cloud/Movies/old/a.mp4', 'b.mp4'))

    def test_custom_root_directory_listing_stays_within_mapping(self):
        cloud = Mock(token='test-token')
        stream = OfficialDirectoryEvidence.Stream([
            SimpleNamespace(fullPathName='/My cloud/Movies/a.mp4', size=20, isDirectory=False)])
        cloud.channel.unary_stream.return_value.return_value = stream
        self.assertEqual(organize_clouddrive._cloud_listing(cloud, 'P:\\Library', self.mapping),
                         [dict(path='P:\\Library\\a.mp4', size=20, directory=False)])
        request = cloud.channel.unary_stream.return_value.call_args.args[0]
        self.assertEqual(request.path, '/My cloud/Movies')
        self.assertTrue(stream.cancelled)

    def test_custom_root_authentication_checks_account_relative_path(self):
        cloud = Mock(token='test-token')
        cloud.channel.unary_unary.return_value.return_value = SimpleNamespace(
            directUrl=DAV_ORIGIN + '/Movies/a.mp4', userAgent='',
            additionalHeaders={'Authorization': 'test-credential'})
        headers = organize_clouddrive._download_headers(cloud, 'P:\\Library\\a.mp4', self.mapping)
        self.assertEqual(headers, {'Authorization': 'test-credential'})
        request = cloud.channel.unary_unary.return_value.call_args.args[0]
        self.assertEqual(request.path, '/My cloud/Movies/a.mp4')

    def test_declared_root_cannot_be_a_move_target(self):
        cloud = Mock(token='test-token')
        with self.assertRaises(ValueError):
            organize_clouddrive._move_remote(cloud, 'P:\\Library\\nested\\Library',
                                            'P:\\Library', self.mapping)
        cloud.channel.unary_unary.assert_not_called()

    def test_channel_uses_the_configured_webdav_account_subdirectory(self):
        from peach import downloads_clouddrive_pb2 as pb
        roots = {'pikpak': ('P:\\Library',)}
        prefix = organize_clouddrive.CloudPrefix('/Renamed account/Movies', 'P:\\Library')
        with patch.object(organize_clouddrive, 'PushDiscoverySettings') as settings, \
                patch.object(organize_clouddrive, 'CredentialStore') as credentials, \
                patch.object(organize_clouddrive, 'DownloadSettings') as downloads, \
                patch.object(organize_clouddrive, 'CloudDriveClient') as client, \
                patch.object(organize_clouddrive, '_download_headers', return_value={}) as headers, \
                patch.object(organize_clouddrive, 'http_client'), \
                patch.object(organize_clouddrive.organize, 'verified_renames'):
            settings.return_value.load.return_value = SimpleNamespace(prefixes=(prefix,))
            credentials.return_value.load.return_value = SimpleNamespace(values={'token': 'test-token'})
            downloads.return_value.load.return_value = SimpleNamespace(clouddrive_address='http://example.test')
            cloud = client.return_value.__enter__.return_value
            cloud.root = '/'
            cloud.find.return_value = pb.CloudDriveFile(isDirectory=True,
                CloudAPI=pb.CloudAPI(name='WebDAV', path='/Renamed account'))
            with organize_clouddrive.pikpak_renames('P:\\Library\\a.mp4', roots) as dav:
                self.assertEqual(dav.url('P:\\Library\\a.mp4'), DAV_ORIGIN + '/Movies/a.mp4')
            cloud.find.assert_called_once_with('/Renamed account/Movies')
            self.assertEqual(headers.call_args.args[2].dav_root, '/Movies')

            cloud.root = '/Renamed account'
            cloud.find.reset_mock()
            with self.assertRaises(organize_clouddrive.UserValueError) as raised:
                with organize_clouddrive.pikpak_renames('P:\\Library\\a.mp4', roots):
                    pass
            self.assertEqual(raised.exception.code, 'errors.organizeClouddrive.tokenRootRestricted')
            cloud.find.assert_not_called()


class OfficialMoves(unittest.TestCase):
    def setUp(self):
        self.entries = {'A:\\old': True, 'A:\\old\\film.mp4': 20, 'A:\\new': True}
        self.requests = []
        self.refresh = Mock()
        self.http = httpx.Client(transport=httpx.MockTransport(self.handle), follow_redirects=False)
        self.addCleanup(self.http.close)
        self.dav = PikPakDav(self.http, MAPPING, self.refresh, listing=self.listing,
                             rename=Mock(side_effect=self.relocate),
                             move_remote=Mock(side_effect=self.relocate))

    def handle(self, request):
        path = 'A:' + unquote(urlsplit(str(request.url)).path).replace('/', '\\').rstrip('\\')
        self.requests.append((request.method, path))
        if request.method != 'MKCOL':
            return httpx.Response(405)
        self.entries[path] = True
        return httpx.Response(201)

    def listing(self, path):
        if path != 'A:\\' and self.entries.get(path) is not True:
            raise UserFileNotFoundError('errors.organizeClouddrive.cloudParentMissing')
        return [dict(path=name, size=0 if value is True else value, directory=value is True)
                for name, value in self.entries.items()
                if name != path and str(PureWindowsPath(name).parent) == path]

    def relocate(self, source, target):
        for name in list(self.entries):
            if name == source or name.startswith(source + '\\'):
                self.entries[target + name[len(source):]] = self.entries.pop(name)
        return ACCEPTED

    def test_official_move_preserves_size_and_refreshes_both_parents(self):
        self.dav.move('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
        self.assertEqual(self.entries['A:\\new\\film.mp4'], 20)
        self.assertNotIn('A:\\old\\film.mp4', self.entries)
        self.dav.move_remote.assert_called_once_with('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
        self.dav.rename.assert_not_called()
        self.assertEqual({c.args[0] for c in self.refresh.call_args_list}, {'A:\\old', 'A:\\new'})

    def test_target_collision_never_submits_move(self):
        self.entries['A:\\new\\film.mp4'] = 40
        with self.assertRaises(FileExistsError):
            self.dav.move('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
        self.dav.move_remote.assert_not_called()
        self.assertEqual(self.entries['A:\\new\\film.mp4'], 40)

    def test_rejected_submission_is_a_failure_with_the_source_in_place(self):
        self.dav.move_remote = Mock(return_value=REJECTED)
        self.dav.confirm_attempts = 4
        with patch.object(organize_clouddrive.time, 'sleep') as sleep, self.assertRaises(MoveNotExecuted):
            self.dav.move('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
        self.dav.move_remote.assert_called_once()
        sleep.assert_not_called()
        self.assertEqual(self.entries['A:\\old\\film.mp4'], 20)

    def test_unchanged_source_after_the_confirmation_budget_is_a_failure(self):
        for status in (None, ACCEPTED):
            with self.subTest(status=status):
                self.dav.move_remote = Mock(return_value=status)
                self.dav.confirm_attempts = 4
                with patch.object(organize_clouddrive.time, 'sleep') as sleep, \
                        self.assertRaises(MoveNotExecuted):
                    self.dav.move('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
                self.dav.move_remote.assert_called_once()
                self.assertEqual(sleep.call_count, 3)
                self.assertEqual(self.entries['A:\\old\\film.mp4'], 20)

    def test_rename_acknowledgement_without_path_change_is_a_failure(self):
        self.dav.rename = Mock(return_value=ACCEPTED)
        with self.assertRaises(MoveNotExecuted):
            self.dav.move('A:\\old\\film.mp4', 'A:\\old\\title.mp4')
        self.dav.rename.assert_called_once()
        self.assertEqual(self.entries['A:\\old\\film.mp4'], 20)

    def test_same_parent_rename_uses_the_official_rename(self):
        self.dav.move('A:\\old\\film.mp4', 'A:\\old\\title.mp4')
        self.dav.rename.assert_called_once_with('A:\\old\\film.mp4', 'A:\\old\\title.mp4')
        self.dav.move_remote.assert_not_called()
        self.assertEqual(self.entries['A:\\old\\title.mp4'], 20)

    def test_collection_move_checks_all_members(self):
        self.dav.move('A:\\old', 'A:\\new\\old')
        self.assertEqual(self.entries['A:\\new\\old\\film.mp4'], 20)
        self.assertNotIn('A:\\old', self.entries)

    def test_incomplete_collection_stops_without_repeating_move(self):
        def lossy(source, target):
            self.relocate(source, target)
            self.entries.pop(target + '\\film.mp4')
            return ACCEPTED
        self.dav.move_remote = Mock(side_effect=lossy)
        with self.assertRaises(UnconfirmedMove):
            self.dav.move('A:\\old', 'A:\\new\\old')
        self.dav.move_remote.assert_called_once()

    def test_source_and_target_both_present_stop_the_batch(self):
        def copy(source, target):
            self.entries[target] = self.entries[source]
            return ACCEPTED
        self.dav.move_remote = Mock(side_effect=copy)
        with self.assertRaises(UnconfirmedMove):
            self.dav.move('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
        self.dav.move_remote.assert_called_once()

    def test_source_and_target_both_absent_stop_the_batch(self):
        def lose(source, target):
            self.entries.pop(source)
            return None
        self.dav.move_remote = Mock(side_effect=lose)
        with self.assertRaises(UnconfirmedMove):
            self.dav.move('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
        self.dav.move_remote.assert_called_once()

    def test_empty_collection_requires_destination_entry(self):
        del self.entries['A:\\old\\film.mp4']
        self.dav.move('A:\\old', 'A:\\new\\old')
        self.assertIs(self.entries['A:\\new\\old'], True)

    def test_nested_parent_is_created_in_order(self):
        self.dav.move('A:\\old\\film.mp4', 'A:\\deep\\nested\\film.mp4')
        self.assertEqual([r[1] for r in self.requests if r[0] == 'MKCOL'], ['A:\\deep', 'A:\\deep\\nested'])

    def test_cross_drive_is_rejected_before_network(self):
        with self.assertRaises(ValueError):
            self.dav.move('A:\\old\\film.mp4', 'R:\\film.mp4')
        self.assertFalse(self.requests)

    def test_cross_parent_rename_is_rejected_before_submission(self):
        with self.assertRaises(ValueError):
            self.dav.move('A:\\old\\film.mp4', 'A:\\new\\title.mp4')
        self.dav.move_remote.assert_not_called()
        self.dav.rename.assert_not_called()
        self.assertFalse(self.requests)

    def test_unicode_path_is_utf8_percent_encoded(self):
        self.assertEqual(self.dav.url('A:\\创作者\\a b.mp4'), DAV_ORIGIN + '/%E5%88%9B%E4%BD%9C%E8%80%85/a%20b.mp4')

    def test_creator_handle_keeps_the_literal_at_sign(self):
        self.assertEqual(self.dav.url('A:\\old\\creator@handle'), DAV_ORIGIN + '/old/creator@handle')

    def test_delayed_listing_only_rechecks_the_single_submitted_move(self):
        self.dav.move_remote = Mock(return_value=ACCEPTED)
        self.dav.confirm_attempts = 4
        reads = 0
        def refresh(path):
            nonlocal reads
            reads += 1
            if reads == 3:
                self.entries['A:\\new\\film.mp4'] = self.entries.pop('A:\\old\\film.mp4')
        self.dav.refresh = refresh
        with patch.object(organize_clouddrive.time, 'sleep'):
            self.dav.move('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
        self.dav.move_remote.assert_called_once()
        self.assertEqual(self.entries['A:\\new\\film.mp4'], 20)

    def test_cache_failure_after_submission_preserves_intent(self):
        self.dav.move_remote = Mock(return_value=ACCEPTED)
        self.dav.refresh = Mock(side_effect=OSError('connection refused'))
        with self.assertRaises(UnconfirmedMove):
            self.dav.move('A:\\old\\film.mp4', 'A:\\new\\film.mp4')
        self.dav.move_remote.assert_called_once()


class OfficialMoveProtocol(unittest.TestCase):
    def test_conflict_skip_and_false_optional_flags_are_encoded(self):
        cloud = Mock(token='test-token')
        cloud.channel.unary_unary.return_value.return_value = SimpleNamespace(success=True)
        self.assertEqual(organize_clouddrive._move_remote(cloud, 'A:\\old\\film.mp4', 'A:\\new\\film.mp4', MAPPING), ACCEPTED)
        request = cloud.channel.unary_unary.return_value.call_args.args[0]
        self.assertEqual(list(request.theFilePaths), ['/Pikpak/old/film.mp4'])
        self.assertEqual(request.destPath, '/Pikpak/new')
        self.assertEqual(request.conflictPolicy, 2)
        for flag in ('moveAcrossClouds', 'handleConflictRecursively'):
            self.assertTrue(request.HasField(flag))
            self.assertFalse(getattr(request, flag))

    def test_path_boundaries_stop_before_rpc(self):
        cloud = Mock(token='test-token')
        for target in ('R:\\film.mp4', 'A:\\new\\other.mp4', 'A:\\old\\film.mp4', 'A:\\new\\..\\film.mp4'):
            with self.subTest(target=target), self.assertRaises(ValueError):
                organize_clouddrive._move_remote(cloud, 'A:\\old\\film.mp4', target, MAPPING)
        for target in ('A:\\new\\title.mp4', 'R:\\old\\title.mp4'):
            with self.subTest(target=target), self.assertRaises(ValueError):
                organize_clouddrive._rename_remote(cloud, 'A:\\old\\film.mp4', target, MAPPING)
        cloud.channel.unary_unary.assert_not_called()

    def test_rpc_timeout_has_no_automatic_resubmission(self):
        for submit in (organize_clouddrive._move_remote, organize_clouddrive._rename_remote):
            with self.subTest(submit=submit.__name__):
                cloud = Mock(token='test-token')
                cloud.channel.unary_unary.return_value.side_effect = Status(grpc.StatusCode.DEADLINE_EXCEEDED)
                target = 'A:\\new\\film.mp4' if submit is organize_clouddrive._move_remote else 'A:\\old\\title.mp4'
                self.assertIsNone(submit(cloud, 'A:\\old\\film.mp4', target, MAPPING))
                cloud.channel.unary_unary.return_value.assert_called_once()

    def test_request_rejections_are_deterministic(self):
        for code in (grpc.StatusCode.INVALID_ARGUMENT, grpc.StatusCode.PERMISSION_DENIED):
            for submit, target in ((organize_clouddrive._move_remote, 'A:\\new\\film.mp4'),
                                   (organize_clouddrive._rename_remote, 'A:\\old\\title.mp4')):
                with self.subTest(code=code, submit=submit.__name__):
                    cloud = Mock(token='test-token')
                    cloud.channel.unary_unary.return_value.side_effect = Status(code)
                    self.assertEqual(submit(cloud, 'A:\\old\\film.mp4', target, MAPPING), REJECTED)

    def test_rename_reply_maps_to_submission_status(self):
        for success, expected in ((True, ACCEPTED), (False, REJECTED)):
            with self.subTest(success=success):
                cloud = Mock(token='test-token')
                cloud.channel.unary_unary.return_value.return_value = SimpleNamespace(success=success)
                self.assertEqual(organize_clouddrive._rename_remote(cloud, 'A:\\old\\film.mp4', 'A:\\old\\title.mp4', MAPPING), expected)
                request = cloud.channel.unary_unary.return_value.call_args.args[0]
                self.assertEqual((request.path, request.newName), ('/Pikpak/old/film.mp4', 'title.mp4'))

    def test_cache_scope_rejects_another_drive(self):
        cloud = Mock(token='test-token')
        with self.assertRaises(ValueError):
            organize_clouddrive._refresh_listing(cloud, 'B:\\MVP', MAPPING)
        cloud.channel.unary_unary.assert_not_called()


class OfficialDirectoryEvidence(unittest.TestCase):
    class Stream:
        def __init__(self, rows):
            self.rows, self.cancelled = rows, False
        def __iter__(self):
            yield SimpleNamespace(subFiles=self.rows)
        def cancel(self):
            self.cancelled = True

    def setUp(self):
        self.paths, self.streams = [], []
        self.entries = {'/Pikpak': [('old', True, 0)], '/Pikpak/old': [('creator@handle', True, 0)],
                        '/Pikpak/old/creator@handle': [('film.mp4', False, 20)]}
        def read(request, **kwargs):
            self.paths.append((request.path, request.forceRefresh))
            rows = [SimpleNamespace(fullPathName=request.path + '/' + name, isDirectory=directory, size=size)
                    for name, directory, size in self.entries[request.path]]
            stream = self.Stream(rows)
            self.streams.append(stream)
            return stream
        self.cloud = Mock(token='test-token')
        self.cloud.channel.unary_stream.return_value = read

    def test_ancestor_listings_confirm_the_complete_unicode_directory(self):
        rows = organize_clouddrive._cloud_listing(self.cloud, 'A:\\old\\creator@handle', MAPPING)
        self.assertEqual(rows, [dict(path='A:\\old\\creator@handle\\film.mp4', directory=False, size=20)])
        self.assertEqual(self.paths, [('/Pikpak', True), ('/Pikpak/old', True), ('/Pikpak/old/creator@handle', True)])
        self.assertTrue(all(stream.cancelled for stream in self.streams))

    def test_missing_ancestor_does_not_read_an_unverified_child(self):
        self.entries['/Pikpak/old'] = []
        with self.assertRaises(FileNotFoundError):
            organize_clouddrive._cloud_listing(self.cloud, 'A:\\old\\creator@handle', MAPPING)
        self.assertEqual(len(self.paths), 2)

    def test_foreign_drive_never_uses_the_existing_credential(self):
        with self.assertRaises(ValueError):
            organize_clouddrive._cloud_listing(self.cloud, 'R:\\Media', MAPPING)
        self.assertFalse(self.paths)

    def test_duplicate_members_stop_and_cancel_the_stream(self):
        self.entries['/Pikpak/old/creator@handle'] *= 2
        with self.assertRaises(ValueError):
            organize_clouddrive._cloud_listing(self.cloud, 'A:\\old\\creator@handle', MAPPING)
        self.assertTrue(all(stream.cancelled for stream in self.streams))


class AuthenticationSamples(unittest.TestCase):
    class Missing(grpc.RpcError):
        def code(self):
            return grpc.StatusCode.NOT_FOUND

    def test_moved_sample_uses_existing_catalog_sample(self):
        cloud = Mock(token='test-token')
        reply = SimpleNamespace(directUrl=DAV_ORIGIN + '/available/image.jpg', userAgent='', additionalHeaders={'Authorization': 'test-credential'})
        stub = cloud.channel.unary_unary.return_value
        stub.side_effect = [self.Missing(), reply]
        with patch.object(organize_clouddrive, '_fallback_samples', return_value=['A:\\available\\image.jpg']):
            headers = organize_clouddrive._download_headers(cloud, 'A:\\moved\\image.jpg', MAPPING)
        self.assertEqual(headers, {'Authorization': 'test-credential'})
        self.assertEqual([c.args[0].path for c in stub.call_args_list], ['/Pikpak/moved/image.jpg', '/Pikpak/available/image.jpg'])

    def test_missing_samples_stop_after_three_calls(self):
        cloud = Mock(token='test-token')
        stub = cloud.channel.unary_unary.return_value
        stub.side_effect = self.Missing()
        with patch.object(organize_clouddrive, '_fallback_samples', return_value=['A:\\first.jpg', 'A:\\second.jpg']), self.assertRaises(ValueError):
            organize_clouddrive._download_headers(cloud, 'A:\\moved.jpg', MAPPING)
        self.assertEqual(stub.call_count, 3)

    def test_foreign_download_source_is_rejected(self):
        cloud = Mock(token='test-token')
        cloud.channel.unary_unary.return_value.return_value = SimpleNamespace(directUrl='https://example.test/image.jpg', additionalHeaders={}, userAgent='')
        with self.assertRaises(ValueError):
            organize_clouddrive._download_headers(cloud, 'A:\\image.jpg', MAPPING)
