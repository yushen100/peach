"""公开候选、独立同意、跨周去重及显式复核的行为回归。"""
import gzip
import json
import hashlib
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from peach import seed_catalog, seed_contribution_archive as archive, seed_sharing
from peach.repository import LedgerDatabase
from peach.seed_contributions import Claim, Snapshot, claim_key, collect, public_url
from peach.settings_file import PeachConfig
from support.ledger import fresh_ledger


def name_claim(name='测试译名', source='user:public-name', url='https://example.com/performer/1'):
    return Claim(subject='performer:example:actress:1', field='chinese-name', value=name,
                 original='テスト', language='zh-CN', origin='manual', source=source, evidence_url=url,
                 refs=[{'provider': 'example', 'kind': 'actress', 'id': '1'}])


class ContributionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()

    def test_names_need_public_identity_and_cannot_publish_private_urls(self):
        for patch in ({'refs': []}, {'value': 'テスト'}, {'evidence_url': 'https://localhost/profile'},
                      {'evidence_url': 'https://example.com/profile?token=private'}, {'value': r'C:\private\name'}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                Claim.model_validate({**name_claim().model_dump(), **patch})
        self.assertEqual(public_url('https://example.com/profile?id=abc'), 'https://example.com/profile?id=abc')

    def test_personal_primary_name_does_not_leave_the_ledger_via_work_cast(self):
        ledger = LedgerDatabase(fresh_ledger(self.root))
        with ledger.write_transaction() as con:
            con.executemany("INSERT INTO asset(id,location,path,code,medium) VALUES(?,'example',?,?,'video')",
                            [(1, r'C:\example\one.mp4', 'TEST-001'), (2, r'C:\example\two.mp4', 'TEST-002')])
            con.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,metadata_json,created_at,updated_at)"
                        " VALUES(1,'performer','个人昵称','个人昵称',?,'2026-11-18','2026-11-18')",
                        (json.dumps({'name_preference': {'source': 'user:preferred-name'}}),))
            con.execute("INSERT INTO entity(id,kind,canonical_name,normalized_name,created_at,updated_at)"
                        " VALUES(2,'performer','公開名','公開名','2026-11-18','2026-11-18')")
            con.executemany("INSERT INTO asset_entity(asset_id,entity_id,role,source) VALUES(?,?,'performer','auto:test')",
                            [(1, 1), (1, 2), (2, 2)])
        config = PeachConfig(self.root, self.root / 'config.toml')
        contract = SimpleNamespace(read_connection=ledger.read_connection, cover_root=self.root)
        snapshot = collect(contract, config)
        self.assertEqual([(item.subject, item.value) for item in snapshot.claims if item.field == 'performers'],
                         [('TEST-002', ['公開名'])])
        self.assertEqual(snapshot.omitted, 1)

    def test_same_value_groups_across_sources_without_turning_votes_into_approval(self):
        first = name_claim(url=None)
        second = name_claim(source='review:example', url='https://other.example/profile/1')
        self.assertEqual(claim_key(first), claim_key(second))
        for instance, period, claims in [('a' * 32, '2026-W46', [first]),
                                         ('a' * 32, '2026-W47', [first, first]),
                                         ('b' * 32, '2026-W47', [second, name_claim('另一译名')])]:
            snapshot = Snapshot(period=period, claims=claims)
            path = self.root / 'attachment.gz'
            path.write_bytes(gzip.compress(snapshot.model_dump_json().encode()))
            archive.import_snapshot(self.root, path, instance=instance, received_at='2026-11-18T00:00:00+00:00')
        report = archive.summary(self.root)
        item = report['candidates'][claim_key(first)]
        self.assertEqual(item['supporting_instances'], 2)
        self.assertEqual(item['status'], 'candidate')
        self.assertEqual(item['evidence_urls'], ['https://other.example/profile/1'])
        self.assertEqual(item['source_domains'], ['other.example'])
        self.assertEqual(len(item['conflicts']), 1)

    def test_publication_requires_explicit_evidence_and_withdrawal_keeps_history(self):
        claim = name_claim(url=None)
        key = claim_key(claim)
        report = {'candidates': {key: {'claim': claim.model_dump(mode='json')}}}
        previous = self.root / 'seed.json'
        previous.write_text(seed_catalog.load().model_dump_json(), encoding='utf-8')
        with self.assertRaises(ValueError):
            archive.publish(report, [{'key': key, 'action': 'approve', 'reason': 'verified'}], previous, revision=2)
        pack = archive.publish(report, [{'key': key, 'action': 'approve', 'reason': 'Source links both names',
            'evidence_url': 'https://example.com/profile', 'preferred': True}], previous, revision=2)
        self.assertNotIn('supporting_instances', pack.model_dump_json())
        previous.write_text(pack.model_dump_json(), encoding='utf-8')
        withdrawn = archive.publish(report, [{'key': key, 'action': 'withdraw', 'reason': 'Wrong identity'}], previous, revision=3)
        self.assertNotIn(key, withdrawn.facts)
        self.assertIn(key, withdrawn.withdrawals)

    def test_default_off_never_collects_and_other_research_consent_is_unchanged(self):
        config = PeachConfig(self.root, self.root / 'config.toml')
        service = seed_sharing.Service(config, object())
        with mock.patch.object(seed_sharing, 'collect') as collect:
            service.attempt()
            collect.assert_not_called()
        self.assertFalse(service.snapshot()['enabled'])
        with self.assertRaises(ValueError):
            service.save({'enabled': True, 'consent': True, 'schema': 1, 'preview_token': 'stale'})
        self.assertFalse((config.directory('state') / 'library-sharing.json').exists())

    def test_a_reenabled_choice_does_not_reset_the_weekly_attempt(self):
        config = PeachConfig(self.root, self.root / 'config.toml')
        service = seed_sharing.Service(config, object())
        snapshot = Snapshot(period='2026-W47', claims=[name_claim()])
        with mock.patch.object(seed_sharing, 'collect', return_value=snapshot):
            preview = service.preview()
            service.save({'enabled': True, 'consent': True, 'schema': 1, 'preview_token': preview['token']})
            first = service.choice()
            service.save({'enabled': False})
            self.assertFalse(service.choice())
            preview = service.preview()
            service.save({'enabled': True, 'consent': True, 'schema': 1, 'preview_token': preview['token']})
            self.assertEqual(service.choice()['instance'], first['instance'])
            self.assertNotEqual(service.choice()['revision'], first['revision'])
        service.receipt_path.write_text(json.dumps({'period': seed_sharing.datetime.now(seed_sharing.timezone.utc).strftime('%G-W%V'),
                                                   'attempted': True, 'status': 'failed'}), encoding='utf-8')
        with mock.patch.object(seed_sharing.library_sharing, 'target', return_value='https://public@o1.ingest.sentry.io/2'), \
             mock.patch.object(seed_sharing, 'collect') as collect, mock.patch.object(seed_sharing.remote_reporting, '_disabled', False):
            service.attempt()
            collect.assert_not_called()

    def test_crop_matches_exact_bytes_and_does_not_reuse_another_image(self):
        body = b'synthetic cached image'
        claim = Claim(subject='TEST-001', field='cover-crop', origin='manual', source='user:crop', value={
            'image_sha256': hashlib.sha256(body).hexdigest(), 'width': 100, 'height': 80, 'box': (50, 0, 100, 80)})
        fact = seed_catalog.Fact(claim=claim, reason='Verified front panel', evidence_url='https://example.com/cover', preferred=True)
        with mock.patch.object(seed_catalog, 'indexes', return_value=({}, {'TEST-001': [fact]}, {})):
            self.assertIsNone(seed_catalog.crop('TEST-001', b'other image', (100, 80)))
            self.assertIsNone(seed_catalog.crop('TEST-001', body, (200, 160)))
            record = seed_catalog.crop('TEST-001', body, (100, 80))
        self.assertEqual(record['box']['x0'], 50)
        self.assertEqual(record['source'], 'auto:public-seed')

    def test_published_mapping_preserves_a_custom_name_and_raw_japanese(self):
        from peach.performer_name_display import writing
        page = {'name': 'テスト', 'aliases': [], 'seed_writings': {('测试译名', 'テスト'): 'https://example.com/name'},
                'seed_evidence': {('测试译名', 'テスト'): 'https://example.com/name'}}
        self.assertEqual(writing('テスト', page, '')['zh_cn'], '测试译名')
        self.assertEqual(writing('テスト', page, '')['ja'], 'テスト')
        self.assertEqual(writing('我的昵称', page, '')['zh_cn'], '我的昵称')

    def test_local_tag_decision_overrides_a_published_mapping(self):
        from peach.genre_taxonomy import resolve_genre, normalise_genre
        raw = 'example genre'
        with mock.patch.object(seed_catalog, 'indexes', return_value=({}, {}, {normalise_genre(raw): '巨乳'})):
            self.assertEqual(resolve_genre(raw), '巨乳')
            self.assertIsNone(resolve_genre(raw, {normalise_genre(raw): None}))

    def test_final_gate_rechecks_consent_before_mutating_an_unauthorized_envelope(self):
        config = PeachConfig(self.root, self.root / 'config.toml')
        service = seed_sharing.Service(config, object())
        snapshot = Snapshot(period=seed_sharing.datetime.now(seed_sharing.timezone.utc).strftime('%G-W%V'), claims=[name_claim()])
        with mock.patch.object(seed_sharing, 'collect', return_value=snapshot):
            preview = service.preview()
            service.save({'enabled': True, 'consent': True, 'schema': 1, 'preview_token': preview['token']})
        identity = {'revision': service.choice()['revision'], 'snapshot_id': 'c' * 32}
        receipt = {**identity, 'status': 'queued', 'attempted': False, 'period': snapshot.period}
        service.receipt_path.write_text(json.dumps(receipt), encoding='utf-8')
        event = {'event_id': 'd' * 32, 'user': {'email': 'private@example.invalid'}, 'extra': {'private': 'secret'}}
        envelope = SimpleNamespace(headers={'sdk': 'not public'}, items=[
            SimpleNamespace(type='event', get_event=lambda: event),
            SimpleNamespace(type='attachment', headers={'filename': 'peach-seed-contributions.json.gz'},
                payload=SimpleNamespace(get_bytes=lambda: gzip.compress(snapshot.model_dump_json().encode())))])
        service.save({'enabled': False})
        self.assertFalse(service._gate(identity, envelope))
        self.assertIn('user', event)

    def test_enabled_snapshot_reaches_the_sdk_transport_once_with_only_public_data(self):
        from sentry_sdk.transport import HttpTransport
        from peach.seed_contributions import FILENAME, parse_snapshot

        config = PeachConfig(self.root, self.root / 'config.toml')
        service = seed_sharing.Service(config, object())
        period = seed_sharing.datetime.now(seed_sharing.timezone.utc).strftime('%G-W%V')
        snapshot = Snapshot(period=period, claims=[name_claim(url=None)])
        sent = []
        with mock.patch.object(seed_sharing, 'collect', return_value=snapshot), \
             mock.patch.object(seed_sharing.library_sharing, 'target', return_value='https://public@o1.ingest.sentry.io/2'), \
             mock.patch.object(seed_sharing.remote_reporting, '_disabled', False), \
             mock.patch.object(HttpTransport, '_send_envelope', side_effect=sent.append):
            preview = service.preview()
            service.save({'enabled': True, 'consent': True, 'schema': 1, 'preview_token': preview['token']})
            service.attempt()
            seed_sharing.Service(config, object()).attempt()
        self.assertEqual(len(sent), 1)
        event, attachment = sent[0].items
        self.assertEqual(event.get_event()['tags']['purpose'], 'public-metadata-contributions')
        self.assertNotIn('user', event.get_event())
        self.assertEqual(attachment.headers['filename'], FILENAME)
        self.assertEqual(parse_snapshot(gzip.decompress(attachment.payload.get_bytes())), snapshot)


if __name__ == '__main__':
    unittest.main()
