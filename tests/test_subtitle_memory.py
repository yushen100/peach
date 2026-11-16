"""字幕内容、关闭状态与视频身份的持久化行为。"""
from __future__ import annotations

import asyncio
import json
import tempfile
import unittest
from unittest import mock
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path

from peach.subtitle_memory import SubtitleMemory
from peach.subtitles import SidecarListings

VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n字幕\n"


class SubtitleMemoryTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()

    def test_local_online_and_off_survive_new_store_instances(self):
        store = SubtitleMemory(self.root, "item:1")
        for key, name in (("file:local", "本地.srt"), ("subtitlecat:42:0", "在线.srt")):
            store.update(key, {"key": key, "name": name, "text": VTT})
        reopened = SubtitleMemory(self.root, "item:1")
        self.assertEqual(reopened.read()["selected"], "subtitlecat:42:0")
        self.assertEqual(len(reopened.read()["tracks"]), 2)
        for track in reopened.read()["tracks"]:
            self.assertEqual(reopened.track_path(track["file"]).read_text(encoding="utf-8"), VTT)
        reopened.update("file:local")
        self.assertEqual(store.read()["selected"], "file:local")
        reopened.update(None)
        self.assertIsNone(store.read()["selected"])
        self.assertEqual(len(store.read()["tracks"]), 2)

    def test_video_and_post_media_have_independent_selections(self):
        for index, video in enumerate(("item:1", "item:2", "follow:1:main", "follow:1:0", "follow:1:1")):
            key = f"file:{index}"
            SubtitleMemory(self.root, video).update(key, {"key": key, "name": "字幕.srt", "text": VTT})
        for index, video in enumerate(("item:1", "item:2", "follow:1:main", "follow:1:0", "follow:1:1")):
            self.assertEqual(SubtitleMemory(self.root, video).read()["selected"], f"file:{index}")

    def test_same_import_is_idempotent_and_sidecar_identity_is_retained(self):
        store = SubtitleMemory(self.root, "item:1")
        for _ in range(2):
            store.update("file:local", {"key": "file:local", "name": "同名.srt", "text": VTT})
        store.update("sidecar:12")
        self.assertEqual(store.read()["selected"], "sidecar:12")
        self.assertEqual(len(store.read()["tracks"]), 1)

    def test_unregistered_tracks_and_path_traversal_are_rejected(self):
        store = SubtitleMemory(self.root, "item:1")
        with self.assertRaises(ValueError):
            store.update("file:missing")
        self.assertIsNone(store.track_path("../../private.vtt"))
        with self.assertRaises(ValueError):
            SubtitleMemory(self.root, "item:../../private")
        with self.assertRaises(ValueError):
            store.update("file:invalid", {"key": "file:invalid", "name": "a.srt", "text": "invalid"})
        for key in ("sidecar:local:../private", "sidecar:local:" + "a" * 63, "sidecar:local:" + "g" * 64):
            with self.subTest(key=key), self.assertRaises(ValueError):
                store.update(key)

    def test_playback_preferences_share_subtitle_file_and_survive_partial_writes(self):
        store = SubtitleMemory(self.root, "item:1")
        store.update("file:local", {"key": "file:local", "name": "字幕.srt", "text": VTT})
        with ThreadPoolExecutor() as executor:
            list(executor.map(store.patch, [{"rotation": 90}, {"rate": 1.75},
                                           {"caption_style": {"size": "150"}},
                                           {"caption_style": {"color": "yellow"}}]))
        saved = SubtitleMemory(self.root, "item:1").read()
        self.assertEqual((saved["rotation"], saved["rate"]), (90, 1.75))
        self.assertEqual(saved["caption_style"], {"size": "150", "color": "yellow"})
        self.assertEqual(saved["selected"], "file:local")
        self.assertEqual(store.track_path(saved["tracks"][0]["file"]).read_text(encoding="utf-8"), VTT)
        store.update(None)
        self.assertEqual(store.read()["rotation"], 90)
        self.assertNotIn("rotation", SubtitleMemory(self.root, "item:2").read())
        store.patch({"rotation": 0, "rate": 1})
        self.assertEqual((store.read()["rotation"], store.read()["rate"]), (0, 1))

    def test_invalid_preferences_cannot_change_saved_memory(self):
        store = SubtitleMemory(self.root, "item:1")
        store.patch({"rotation": 180, "rate": 1.5})
        saved = store.manifest.read_bytes()
        for patch in ({}, {"rotation": True}, {"rotation": 45}, {"rate": True}, {"rate": 0},
                      {"rate": float("nan")}, {"rate": float("inf")}, {"rate": 3.1},
                      {"caption_style": {"color": "url(private)"}}, {"caption_style": {"size": []}},
                      {"caption_style": {"unknown": "white"}}, {"tracks": []}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                store.patch(patch)
            self.assertEqual(store.manifest.read_bytes(), saved)


class SubtitleMemoryApiTests(unittest.TestCase):
    def setUp(self):
        from peach.api import create_app
        from peach.config import PeachSettings
        from tests.support.ledger import fresh_ledger
        from tests.support.web import route_client
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.media = self.root / "media"
        self.media.mkdir()
        for name in ("sample.mp4", "other.mp4"):
            (self.media / name).write_bytes(b"sample")
        self.app = create_app(PeachSettings(db_path=fresh_ledger(self.root), configured=True,
                                            follow_state_root=self.root / "state", token="",
                                            allowed_media_roots=(self.media,)))
        with self.app.state.database.write_transaction() as connection:
            for identity, name in enumerate(("sample.mp4", "other.mp4"), 1):
                connection.execute("INSERT INTO asset(id,location,path,name,medium) VALUES(?,'local',?,?,'video')",
                                   (identity, str(self.media / name), name))
        self.client = route_client(self.app)

    def test_manual_sidecar_selection_survives_reopening_without_automatic_chinese(self):
        """手动选的同目录字幕用稳定文件身份保存，重开照样恢复；没打开自动中文时首次打开不选字幕。"""
        for language in ("chs", "jp"):
            (self.media / f"sample.{language}.vtt").write_text(VTT, encoding="utf-8")
        url = "/api/player/memory?video=item:1"
        with self.client as client:
            tracks = client.get("/api/assets/1/subtitles").json()["subtitles"]
            japanese = next(row for row in tracks if row["language"] == "ja")
            self.assertIsNone(client.get(url).json()["selected"])
            self.assertEqual(client.put(url, json={"selected": japanese["id"]}).status_code, 200)
            self.assertEqual(client.get(url).json()["selected"], japanese["id"])
            self.assertEqual(client.get(url + "&auto=zh").json()["selected"], japanese["id"])

    def test_chinese_sidecar_opens_by_default_and_manual_selection_survives_reopening(self):
        for language in ("chs", "cht", "jp"):
            (self.media / f"sample.{language}.vtt").write_text(VTT, encoding="utf-8")
        url = "/api/player/memory?video=item:1&auto=zh"
        with self.client as client:
            tracks = client.get("/api/assets/1/subtitles").json()["subtitles"]
            chinese = next(row for row in tracks if row["language"] == "zh-Hans")
            japanese = next(row for row in tracks if row["language"] == "ja")
            self.assertEqual(client.get(url).json()["selected"], chinese["id"])
            self.assertIn("字幕", client.get(chinese["src"]).text)
            memory = SubtitleMemory(self.root / "state/player-subtitles", "item:1")
            self.assertFalse(memory.manifest.exists())
            self.assertEqual(client.put(url, json={"selected": chinese["id"]}).status_code, 200)
            self.assertEqual(client.get(url).json()["selected"], chinese["id"])
            self.assertEqual(client.put(url, json={"selected": japanese["id"]}).status_code, 200)
            self.assertEqual(client.get(url).json()["selected"], japanese["id"])
            self.assertEqual(SubtitleMemory(memory.root.parent, "item:1").read()["selected"], japanese["id"])
            self.assertEqual(client.put(url, json={"selected": None}).status_code, 200)
            self.assertEqual(client.put(url, json={"rate": 2, "rotation": 180}).status_code, 200)
            self.assertIsNone(client.get(url).json()["selected"])
            self.assertIsNone(SubtitleMemory(memory.root.parent, "item:1").read()["selected"])

    def test_preference_only_writes_preserve_automatic_choice_and_later_subtitle_discovery(self):
        url = "/api/player/memory?video=item:1&auto=zh"
        with self.client as client:
            self.assertIsNone(client.get(url).json()["selected"])
            client.put(url, json={"rate": 1.5, "rotation": 90, "caption_style": {"size": "150"}})
            (self.media / "sample.chs.vtt").write_text(VTT, encoding="utf-8")
            # 目录列举缓存两分钟（`SidecarListings`），这里当作缓存已过期。
            self.app.state.sidecar_listings = SidecarListings()
            chosen = client.get("/api/assets/1/subtitles").json()["subtitles"][0]["id"]
            self.assertEqual(client.get(url).json()["selected"], chosen)
            self.assertEqual(client.put(url, json={"rate": 2}).json()["selected"], chosen)
            (self.media / "new.mp4").write_bytes(b"sample")
            (self.media / "new.zh.vtt").write_text(VTT, encoding="utf-8")
            with self.app.state.database.write_transaction() as connection:
                connection.execute("INSERT INTO asset(id,location,path,name,medium) VALUES(3,'local',?,'new.mp4','video')",
                                   (str(self.media / "new.mp4"),))
            self.assertIsNotNone(client.get("/api/player/memory?video=item:3&auto=zh").json()["selected"])
            with self.app.state.database.read_connection() as connection:
                self.assertEqual(connection.execute("SELECT COUNT(*) FROM asset_subtitle").fetchone()[0], 0)

    def test_existing_explicit_off_and_non_chinese_or_unplayable_tracks_stay_off(self):
        (self.media / "sample.chs.vtt").write_text(VTT, encoding="utf-8")
        memory = SubtitleMemory(self.root / "state/player-subtitles", "item:1")
        memory.root.mkdir(parents=True)
        memory.manifest.write_text(json.dumps({"selected": None, "tracks": [], "rate": 1.5}), encoding="utf-8")
        (self.media / "other.jp.vtt").write_text(VTT, encoding="utf-8")
        (self.media / "other.vtt").write_text(VTT, encoding="utf-8")
        (self.media / "other.chs.sub").write_bytes(b"graphic")
        (self.media / "other.cht.srt").write_bytes(b"\x81\x20\x81\x20")
        with self.client as client:
            self.assertIsNone(client.get("/api/player/memory?video=item:1&auto=zh").json()["selected"])
            self.assertIsNone(client.get("/api/player/memory?video=item:2&auto=zh").json()["selected"])

    def test_preference_put_resolves_subtitle_files_outside_the_event_loop(self):
        from peach.web_subtitle_tracks import preferred_chinese
        (self.media / "sample.chs.vtt").write_text(VTT, encoding="utf-8")
        inspected = []

        def resolve(*args):
            with self.assertRaises(RuntimeError):
                asyncio.get_running_loop()
            inspected.append(True)
            return preferred_chinese(*args)

        with self.client as client, mock.patch("peach.web_subtitle_tracks.preferred_chinese", side_effect=resolve):
            response = client.put("/api/player/memory?video=item:1&auto=zh", json={"rate": 1.5})
            self.assertEqual(response.status_code, 200)
            self.assertIsNotNone(response.json()["selected"])
        self.assertTrue(inspected)

    def test_simplified_region_tag_precedes_generic_chinese_with_existing_language_records(self):
        for name in ("sample.chinese.vtt", "sample.zh-CN.vtt", "sample.zh-TW.vtt"):
            path = self.media / name
            path.write_text(VTT, encoding="utf-8")
            with self.app.state.database.write_transaction() as connection:
                connection.execute("""INSERT INTO asset_subtitle(asset_id,location,path,name,language,format,
                    pairing,first_seen,last_seen) VALUES(1,'local',?,?,'zh','vtt','suffix','2026-11-05','2026-11-05')""",
                                   (str(path), name))
        with self.client as client:
            tracks = client.get("/api/assets/1/subtitles").json()["subtitles"]
            simplified = next(track for track in tracks if track["name"] == "sample.zh-CN.vtt")
            self.assertEqual(simplified["language"], "zh-Hans")
            self.assertEqual(client.get("/api/player/memory?video=item:1&auto=zh").json()["selected"], simplified["id"])
        with self.app.state.database.read_connection() as connection:
            self.assertEqual({row[0] for row in connection.execute("SELECT language FROM asset_subtitle")}, {"zh"})

    def test_legacy_nonempty_choice_is_preserved_when_chinese_is_available(self):
        (self.media / "sample.chs.vtt").write_text(VTT, encoding="utf-8")
        memory = SubtitleMemory(self.root / "state/player-subtitles", "item:1")
        memory.root.mkdir(parents=True)
        with self.client as client:
            for selected in ("sidecar:12", "native:subtitles:ja:1"):
                memory.manifest.write_text(json.dumps({"selected": selected, "tracks": []}), encoding="utf-8")
                self.assertEqual(client.get("/api/player/memory?video=item:1&auto=zh").json()["selected"], selected)

    def test_authenticated_memory_roundtrip_and_video_isolation(self):
        with self.client as client:
            url = "/api/subtitles/memory?video=item:1"
            self.assertEqual(client.get(url).json(), {"selected": None, "tracks": []})
            saved = client.put(url, json={"selected": "file:local", "track": {
                "key": "file:local", "name": "字幕.srt", "text": VTT}})
            self.assertEqual(saved.status_code, 200)
            track_url = saved.json()["tracks"][0]["src"]
            self.assertEqual(client.get(track_url).text, VTT)
            self.assertEqual(client.get(url).json()["selected"], "file:local")
            self.assertEqual(client.get("/api/subtitles/memory?video=item:2").json()["tracks"], [])
            self.assertEqual(client.get(track_url.replace("item:1", "item:2")).status_code, 404)
            self.assertEqual(client.put(url, json={"selected": None}).status_code, 200)
            self.assertIsNone(client.get(url).json()["selected"])
            self.app.state.settings = replace(self.app.state.settings, token="private")
            self.assertEqual(client.get(url).status_code, 401)
            self.assertEqual(client.put(url, json={"selected": None}).status_code, 401)
            self.assertEqual(client.get(track_url).status_code, 401)

    def test_missing_video_invalid_payload_and_missing_track(self):
        with self.client as client:
            self.assertEqual(client.get("/api/subtitles/memory?video=item:999").status_code, 404)
            self.assertEqual(client.get("/api/subtitles/memory?video=invalid").status_code, 400)
            url = "/api/subtitles/memory?video=item:1"
            self.assertEqual(client.put(url, json={"selected": "file:missing"}).status_code, 400)
            self.assertEqual(client.put(url, json=[]).status_code, 400)

    def test_player_memory_and_subtitle_routes_share_preferences_and_authorization(self):
        with self.client as client:
            url = "/api/player/memory?video=item:1"
            self.assertEqual(client.put(url, json={"rotation": 270, "rate": 2}).status_code, 200)
            subtitle_url = "/api/subtitles/memory?video=item:1"
            self.assertEqual(client.put(subtitle_url, json={"selected": "native:subtitles:zh:1"}).status_code, 200)
            self.assertEqual(client.get(url).json(), {"rotation": 270, "rate": 2,
                             "selected": "native:subtitles:zh:1", "tracks": []})
            self.assertEqual(client.put(url, json={"rotation": 360}).status_code, 400)
            self.assertNotIn("rotation", client.get("/api/player/memory?video=item:2").json())
            self.assertEqual(client.put("/api/player/memory?video=item:999", json={"rate": 1}).status_code, 404)
            self.app.state.settings = replace(self.app.state.settings, token="private")
            self.assertEqual(client.get(url).status_code, 401)
            self.assertEqual(client.put(url, json={"rate": 1}).status_code, 401)
