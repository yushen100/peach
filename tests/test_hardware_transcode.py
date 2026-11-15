"""硬件后端探测与整片、HLS 转码的失败回退。"""
import asyncio
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from peach.ffmpeg import BinaryChoice
from peach.hardware_transcode import HardwareEncoder, HardwareTranscoder
from peach.segments import HlsSegmentService
from peach.streaming import StreamSessionRegistry
from peach.transcodes import TranscodeService, _MediaProfile


class HardwareDetectionTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "auto", "PEACH_VAAPI_DEVICE": ""})
        environment.start()
        self.addCleanup(environment.stop)

    def test_linux_render_nodes_are_tried_until_one_encodes(self):
        commands = []

        def run(command, **kwargs):
            commands.append(command)
            self.assertEqual(kwargs["timeout"], 10)
            device = command[command.index("-vaapi_device") + 1]
            return subprocess.CompletedProcess(command, int(device.endswith("128")), stderr=b"no display")

        hardware = HardwareTranscoder()
        with patch("peach.hardware_transcode.sys.platform", "linux"), \
                patch.object(Path, "exists", return_value=False), \
                patch.object(Path, "glob", return_value=[Path("/dev/dri/renderD128"), Path("/dev/dri/renderD129")]), \
                patch("peach.hardware_transcode.subprocess.run", side_effect=run):
            encoders = hardware.encoders(Path("ffmpeg"))
            self.assertEqual(encoders, (HardwareEncoder("vaapi", "/dev/dri/renderD129"),))
            self.assertEqual(hardware.encoders(Path("ffmpeg")), encoders)
        self.assertEqual(len(commands), 2)
        self.assertTrue(all("h264_vaapi" in command for command in commands))
        self.assertTrue(all("format=nv12,hwupload" in command for command in commands))
        self.assertTrue(all(command[-2:] == ("null", "-") for command in commands))

    def test_explicit_device_and_backend_are_probed_without_gpu_listing(self):
        with patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "vaapi", "PEACH_VAAPI_DEVICE": "/dev/dri/renderD130"}):
            hardware = HardwareTranscoder()
        with patch("peach.hardware_transcode.subprocess.run", return_value=Mock(returncode=0)) as run:
            self.assertEqual(hardware.encoders(Path("ffmpeg")), (HardwareEncoder("vaapi", "/dev/dri/renderD130"),))
        self.assertIn("/dev/dri/renderD130", run.call_args.args[0])
        self.assertNotIn("h264_nvenc", run.call_args.args[0])

    def test_probe_errors_and_timeouts_are_cached_as_unavailable(self):
        for failure in (PermissionError("denied"), subprocess.TimeoutExpired("ffmpeg", 10)):
            with self.subTest(failure=failure), patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "nvenc"}):
                hardware = HardwareTranscoder()
                with patch("peach.hardware_transcode.subprocess.run", side_effect=failure) as run:
                    self.assertEqual(hardware.encoders(Path("ffmpeg")), ())
                    self.assertEqual(hardware.encoders(Path("ffmpeg")), ())
                    self.assertEqual(run.call_count, 1)

    def test_software_mode_and_disabled_preference_do_not_probe(self):
        for enabled, backend in ((True, "software"), (False, "auto")):
            with self.subTest(enabled=enabled, backend=backend), \
                    patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": backend}), \
                    patch("peach.hardware_transcode.subprocess.run") as run:
                self.assertEqual(HardwareTranscoder(enabled=enabled).encoders(Path("ffmpeg")), ())
                run.assert_not_called()

    def test_linux_without_devices_has_no_automatic_candidates(self):
        for platform in ("linux",):
            with self.subTest(platform=platform), patch("peach.hardware_transcode.sys.platform", platform), \
                    patch.object(Path, "exists", return_value=False), patch.object(Path, "glob", return_value=[]):
                self.assertEqual(HardwareTranscoder()._candidates(), ())

    def test_macos_probes_videotoolbox_and_uses_no_software_encoder_in_probe(self):
        with patch("peach.hardware_transcode.sys.platform", "darwin"), \
                patch("peach.hardware_transcode.subprocess.run", return_value=Mock(returncode=0)) as run:
            self.assertEqual(HardwareTranscoder().encoders(Path("ffmpeg")), (HardwareEncoder("videotoolbox"),))
        command = run.call_args.args[0]
        self.assertIn("h264_videotoolbox", command)
        self.assertEqual(command[command.index("-allow_sw") + 1], "0")

    def test_macos_av1_selects_native_decoder_for_hardware_and_keeps_software_decode_fallback(self):
        attempts = HardwareEncoder("videotoolbox").attempts("av1")
        self.assertEqual([attempt.name for attempt in attempts], ["videotoolbox", "videotoolbox-encode"])
        self.assertEqual(attempts[0].before_input, ("-hwaccel", "videotoolbox", "-c:v", "av1"))
        self.assertEqual(attempts[1].before_input, ())
        self.assertEqual(len(HardwareEncoder("videotoolbox").attempts("vc1")), 1)

    def test_linux_nvidia_device_enables_nvenc_probe(self):
        with patch("peach.hardware_transcode.sys.platform", "linux"), \
                patch.object(Path, "exists", return_value=True), patch.object(Path, "glob", return_value=[]), \
                patch("peach.hardware_transcode.subprocess.run", return_value=Mock(returncode=0)) as run:
            self.assertEqual(HardwareTranscoder().encoders(Path("ffmpeg")), (HardwareEncoder("nvenc"),))
        self.assertIn("h264_nvenc", run.call_args.args[0])

    def test_invalid_backend_has_an_actionable_error(self):
        with patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "typo"}):
            with self.assertRaisesRegex(ValueError, "PEACH_TRANSCODE_BACKEND"):
                HardwareTranscoder()

    def test_device_preference_can_switch_without_recreating_the_hardware_service(self):
        from peach.media_processing_policy import save_preferences
        with tempfile.TemporaryDirectory() as directory, \
                patch("peach.hardware_transcode.sys.platform", "darwin"), \
                patch("peach.hardware_transcode.subprocess.run", return_value=Mock(returncode=0)) as run:
            root = Path(directory).resolve()
            hardware = HardwareTranscoder(state_root=root)
            self.assertTrue(hardware.encoders(Path("ffmpeg")))
            save_preferences(root, {'playback_acceleration': 'software'})
            self.assertEqual(hardware.encoders(Path("ffmpeg")), ())
            save_preferences(root, {'preview_acceleration': 'software'})
            self.assertEqual(hardware.encoders(Path("ffmpeg")), ())
            save_preferences(root, {'playback_acceleration': 'auto'})
            self.assertTrue(hardware.encoders(Path("ffmpeg")))
            self.assertEqual(run.call_count, 1)

    def test_linux_frame_capture_uses_the_first_vaapi_node_that_initializes(self):
        from peach import hardware_transcode
        probes = []

        def probe(_ffmpeg, _label, arguments):
            probes.append(arguments)
            return arguments[1] == "vaapi=va:/dev/dri/renderD129"

        hardware_transcode._vaapi_device.cache_clear()
        self.addCleanup(hardware_transcode._vaapi_device.cache_clear)
        with tempfile.TemporaryDirectory() as directory:
            ffmpeg = Path(directory) / "ffmpeg"
            ffmpeg.write_bytes(b"")
            ffmpeg.with_name("ffprobe").write_bytes(b"")
            source = Path(directory) / "clip.mkv"
            source.write_bytes(b"fixture")
            with patch("peach.hardware_transcode.sys.platform", "linux"),                     patch.object(Path, "glob", return_value=[Path("/dev/dri/renderD128"), Path("/dev/dri/renderD129")]),                     patch.object(hardware_transcode, "_run_probe", side_effect=probe),                     patch("peach.media_processing_policy.acceleration", return_value="auto"):
                for codec, expected in (("hevc", ("-hwaccel", "vaapi", "-hwaccel_device", "/dev/dri/renderD129")),
                                        ("vc1", ())):
                    with self.subTest(codec=codec), patch.object(hardware_transcode, "_frame_codec", return_value=codec):
                        self.assertEqual(hardware_transcode.frame_decode_options(str(ffmpeg), str(source)), expected)
        self.assertEqual([arguments[:2] for arguments in probes],
                         [("-init_hw_device", "vaapi=va:/dev/dri/renderD128"), ("-init_hw_device", "vaapi=va:/dev/dri/renderD129")],
                         "渲染节点探测按 FFmpeg 缓存，第二部片不再探测")
        self.assertNotIn("-hwaccel_output_format", expected)

    def test_linux_frame_capture_without_render_nodes_stays_software_without_probing(self):
        from peach import hardware_transcode
        hardware_transcode._vaapi_device.cache_clear()
        self.addCleanup(hardware_transcode._vaapi_device.cache_clear)
        with tempfile.TemporaryDirectory() as directory:
            ffmpeg = Path(directory) / "ffmpeg"
            ffmpeg.write_bytes(b"")
            with patch("peach.hardware_transcode.sys.platform", "linux"), patch.object(Path, "glob", return_value=[]),                     patch.object(hardware_transcode, "_run_probe") as probe,                     patch("peach.media_processing_policy.acceleration", return_value="auto"):
                self.assertEqual(hardware_transcode.frame_decode_options(str(ffmpeg), str(ffmpeg)), ())
            probe.assert_not_called()


class WindowsBackendTests(unittest.TestCase):
    def setUp(self):
        for active in (patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "auto"}),
                       patch("peach.hardware_transcode.sys.platform", "win32")):
            active.start()
            self.addCleanup(active.stop)

    @staticmethod
    def _machine(working):
        """按命令里的编码器或设备判定成败，模拟一台 NVIDIA 默认、AMD 在第二个序号的机器。"""
        def run(command, **kwargs):
            joined = " ".join(command)
            return subprocess.CompletedProcess(command, 0 if any(item in joined for item in working) else 1,
                                               stderr=b"unavailable")
        return run

    def test_automatic_mode_probes_every_windows_encoder_and_d3d11_decode(self):
        self.assertEqual(HardwareTranscoder()._candidates(), (
            HardwareEncoder("nvenc"), HardwareEncoder("amf"), HardwareEncoder("qsv"),
            HardwareEncoder("d3d11va")))
        with patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "amf"}):
            self.assertEqual(HardwareTranscoder()._candidates(), (HardwareEncoder("amf"),))

    def test_amf_binds_to_the_adapter_it_can_derive_and_keeps_software_decode(self):
        working = ("-pix_fmt nv12", "d3d11va=peach:1", "-init_hw_device d3d11va -f")
        hardware = HardwareTranscoder()
        with patch("peach.hardware_transcode.subprocess.run", side_effect=self._machine(working)) as run:
            encoders = hardware.encoders(Path("ffmpeg"))
            self.assertEqual(hardware.decode_options(Path("ffmpeg"), "hevc"), ("-hwaccel", "d3d11va"))
        self.assertIn(HardwareEncoder("amf", "1"), encoders)
        self.assertNotIn(HardwareEncoder("d3d11va"), encoders)
        self.assertFalse(any("d3d11va=peach:2" in " ".join(call.args[0]) for call in run.call_args_list))
        attempts = HardwareEncoder("amf", "1").attempts("hevc")
        self.assertEqual([attempt.name for attempt in attempts], ["d3d11va-amf", "amf"])
        self.assertEqual(attempts[0].before_input, ("-hwaccel", "d3d11va", "-hwaccel_device", "1"))
        self.assertEqual(attempts[1].before_input, ())
        self.assertEqual([attempt.name for attempt in HardwareEncoder("amf", "1").attempts("vc1")], ["amf"])

    def test_d3d11_decode_feeds_libx264_when_no_encoder_works(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch("peach.hardware_transcode.subprocess.run",
                      side_effect=self._machine(("-init_hw_device d3d11va -f",))):
            root = Path(directory).resolve()
            source = root / "clip.mkv"
            source.write_bytes(b"fixture")
            resolver = Mock(ffmpeg=lambda: BinaryChoice(Path("ffmpeg"), "test"), ffprobe=lambda: None)
            service = TranscodeService(resolver, root / "full")
            for codec, expected in (("hevc", ["d3d11va-libx264", "libx264"]), ("vc1", ["libx264"])):
                with self.subTest(codec=codec):
                    attempts = list(service._attempts(Path("ffmpeg"), source, root / "out.mp4",
                                                      _MediaProfile(codec, "yuv420p", "aac")))
                    self.assertEqual([attempt.name for attempt in attempts], expected)
                    command = attempts[0].command
                    self.assertEqual("-hwaccel" in command, codec == "hevc")
                    self.assertNotIn("-hwaccel_output_format", command)
                    self.assertIn("libx264", command)
            hls = HlsSegmentService(resolver, root / "hls", hardware=service.hardware)
            names = [name for name, _ in hls._attempts(Path("ffmpeg"), source, 12, 6, True, "hevc")]
            self.assertEqual(names, ["d3d11va-libx264", "libx264"])
            command = hls._attempts(Path("ffmpeg"), source, 12, 6, True, "hevc")[0][1](root / "seg.ts")
            self.assertLess(command.index("d3d11va"), command.index("-i"))
            self.assertEqual(command[command.index("-threads") + 1], "2")

    def test_software_playback_setting_turns_off_d3d11_decode_too(self):
        from peach.media_processing_policy import save_preferences
        with tempfile.TemporaryDirectory() as directory, \
                patch("peach.hardware_transcode.subprocess.run", return_value=Mock(returncode=0)) as run:
            root = Path(directory).resolve()
            save_preferences(root, {"playback_acceleration": "software"})
            hardware = HardwareTranscoder(state_root=root)
            self.assertEqual(hardware.decode_options(Path("ffmpeg"), "hevc"), ())
            self.assertEqual(hardware.encoders(Path("ffmpeg")), ())
            run.assert_not_called()

    def test_frame_capture_uses_d3d11_only_for_listed_codecs_and_follows_preview_setting(self):
        from peach import hardware_transcode
        with tempfile.TemporaryDirectory() as directory:
            ffmpeg = Path(directory) / "ffmpeg.exe"
            ffmpeg.write_bytes(b"")
            ffmpeg.with_name("ffprobe.exe").write_bytes(b"")
            source = Path(directory) / "clip.mkv"
            source.write_bytes(b"fixture")
            for codec, preview, expected in (("hevc", "auto", ("-hwaccel", "d3d11va")),
                                             ("vc1", "auto", ()), ("hevc", "software", ())):
                with self.subTest(codec=codec, preview=preview), \
                        patch.object(hardware_transcode, "_d3d11va_ready", return_value=True), \
                        patch.object(hardware_transcode, "_frame_codec", return_value=codec) as probe, \
                        patch("peach.media_processing_policy.acceleration", return_value=preview):
                    self.assertEqual(hardware_transcode.frame_decode_options(str(ffmpeg), str(source)), expected)
                    if preview == "auto":
                        self.assertEqual(Path(probe.call_args.args[0]).name, "ffprobe.exe")


class VideoToolboxConsumerTests(unittest.TestCase):
    def test_full_file_and_hls_fall_back_from_decode_to_encode_to_software(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "videotoolbox"}), \
                patch.object(HardwareTranscoder, "_probe", return_value=True):
            root = Path(directory).resolve()
            source = root / "sample.mkv"
            source.write_bytes(b"fixture")
            resolver = Mock(ffmpeg=lambda: BinaryChoice(Path("ffmpeg"), "test"), ffprobe=lambda: None)
            for failures in (0, 1, 2):
                with self.subTest(failures=failures):
                    service = TranscodeService(resolver, root / f"full-{failures}")
                    captured = []
                    def execute(command, *, captured=captured, failures=failures, **kwargs):
                        captured.append((kwargs['label'], command))
                        if len(captured) <= failures:
                            return 1, b"", b"unavailable"
                        Path(command[-1]).write_bytes(b"result")
                        return 0, b"", b""
                    with patch.object(service, "_probe", return_value=_MediaProfile("av1", "yuv420p", "aac")), \
                            patch.object(service, "_execute", side_effect=execute):
                        service.browser_path(1, source)
                    self.assertEqual([name for name, _ in captured],
                                     ["videotoolbox", "videotoolbox-encode", "libx264"][:failures + 1])
                    self.assertIn("av1", captured[0][1])
                    if failures:
                        self.assertNotIn("-hwaccel", captured[1][1])

                    async def drive(failures=failures):
                        hls = HlsSegmentService(resolver, root / f"hls-{failures}", hardware=HardwareTranscoder())
                        commands = []
                        async def run(command, session, registry):
                            commands.append(command)
                            if len(commands) <= failures:
                                return 1, b"unavailable"
                            Path(command[-1]).write_bytes(b"segment")
                            return 0, b""
                        with patch.object(hls, "video_codec", return_value="av1"), patch.object(hls, "_run", side_effect=run):
                            await hls.generate(source, 12, 6, asset_id=1, index=2,
                                               session="test", registry=StreamSessionRegistry(), transcode=True)
                        self.assertEqual(len(commands), failures + 1)
                        for command in commands:
                            self.assertEqual(command[command.index("-output_ts_offset") + 1], "12.000")
                            self.assertIn("aac", command)
                    asyncio.run(drive())


class VaapiConsumerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.source = self.root / "clip.mkv"
        self.source.write_bytes(b"source")
        self.resolver = Mock(ffmpeg=lambda: BinaryChoice(Path("ffmpeg"), "test"), ffprobe=lambda: None)
        environment = patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "vaapi", "PEACH_VAAPI_DEVICE": "/dev/dri/renderD128"})
        environment.start()
        self.addCleanup(environment.stop)
        probe = patch.object(HardwareTranscoder, "_probe", return_value=True)
        probe.start()
        self.addCleanup(probe.stop)

    def test_full_file_tries_vaapi_then_hardware_encode_then_software(self):
        for failures, expected in ((0, ["vaapi"]), (1, ["vaapi", "vaapi-encode"]),
                                   (2, ["vaapi", "vaapi-encode", "libx264"])):
            with self.subTest(failures=failures):
                service = TranscodeService(self.resolver, self.root / f"cache{failures}")
                captured = []

                def execute(command, *, captured=captured, failures=failures, **kwargs):
                    captured.append((kwargs["label"], command))
                    if len(captured) <= failures:
                        return 1, b"", b"hardware failed"
                    Path(command[-1]).write_bytes(b"mp4")
                    return 0, b"", b""

                profile = _MediaProfile("hevc", "yuv420p10le", "aac")
                with patch.object(service, "_probe", return_value=profile), \
                        patch.object(service, "_execute", side_effect=execute):
                    target, converted = service.browser_path(95, self.source)
                self.assertTrue(converted)
                self.assertEqual(target.read_bytes(), b"mp4")
                self.assertEqual([name for name, _ in captured], expected)
                command = captured[0][1]
                self.assertLess(command.index("-hwaccel"), command.index("-i"))
                self.assertIn("scale_vaapi=format=nv12", command)
                self.assertIn("h264_vaapi", command)
                self.assertIn("+faststart", command)
                if failures:
                    self.assertNotIn("-hwaccel", captured[1][1])
                    self.assertIn("format=nv12,hwupload", captured[1][1])

    def test_video_copy_does_not_probe_hardware(self):
        service = TranscodeService(self.resolver, self.root / "cache")
        commands = service._attempts(Path("ffmpeg"), self.source, self.root / "out.mp4",
                                     _MediaProfile("h264", "yuv420p", "aac"))
        with patch.object(service.hardware, "encoders") as encoders:
            self.assertEqual(next(commands).name, "video-copy")
            encoders.assert_not_called()

    def test_hls_vaapi_failures_preserve_seek_timestamps_and_audio(self):
        async def drive(failures):
            service = HlsSegmentService(self.resolver, self.root / f"hls{failures}",
                                        hardware=HardwareTranscoder())
            captured = []

            async def run(command, session, registry):
                captured.append(command)
                if len(captured) <= failures:
                    return 1, b"hardware failed"
                Path(command[-1]).write_bytes(b"ts")
                return 0, b""

            with patch.object(service, "_run", side_effect=run), \
                    patch.object(service, "video_codec", return_value="hevc"):
                target = await service.generate(self.source, 12, 6, asset_id=95, index=2,
                                                session="test", registry=StreamSessionRegistry(), transcode=True)
            self.assertEqual(target.read_bytes(), b"ts")
            self.assertEqual(len(captured), failures + 1)
            for command in captured:
                self.assertEqual(command[command.index("-ss") + 1], "12.000")
                self.assertEqual(command[command.index("-t") + 1], "6.000")
                self.assertEqual(command[command.index("-output_ts_offset") + 1], "12.000")
                self.assertEqual(command[command.index("-c:a") + 1], "aac")
                self.assertEqual(command[command.index("-f") + 1], "mpegts")
            self.assertIn("scale_vaapi=format=nv12", captured[0])
            if failures:
                self.assertIn("format=nv12,hwupload", captured[1])
            if failures == 2:
                self.assertIn("libx264", captured[2])

        for failures in (0, 1, 2):
            with self.subTest(failures=failures):
                asyncio.run(drive(failures))

    def test_hls_remux_does_not_probe_hardware(self):
        service = HlsSegmentService(self.resolver, self.root / "hls", hardware=HardwareTranscoder())
        with patch.object(service.hardware, "encoders") as encoders:
            attempts = service._attempts(Path("ffmpeg"), self.source, 0, 6, False)
        encoders.assert_not_called()
        self.assertEqual([name for name, _ in attempts], ["copy"])


SCALE_720 = "w='if(gt(iw,ih),-2,min(iw,720))':h='if(gt(iw,ih),min(ih,720),-2)'"


class QualityCapTests(unittest.TestCase):
    """画质上限给每种编码器生成的参数。本机实跑见 PR 说明；这里钉住命令本身。"""

    def outputs(self, encoder: HardwareEncoder, max_height: int, codec: str = "hevc") -> dict:
        return {attempt.name: attempt.output for attempt in encoder.attempts(codec, max_height)}

    def test_original_quality_keeps_every_encoder_command_unchanged(self):
        for encoder in (HardwareEncoder("nvenc"), HardwareEncoder("amf", "1"), HardwareEncoder("qsv"),
                        HardwareEncoder("videotoolbox"), HardwareEncoder("vaapi", "/dev/dri/renderD128")):
            with self.subTest(backend=encoder.backend):
                self.assertEqual(encoder.attempts("hevc", 0), encoder.attempts("hevc"))
                joined = " ".join(item for attempt in encoder.attempts("hevc") for item in attempt.output)
                self.assertNotIn("-maxrate", joined)
                self.assertNotIn("min(", joined)
        from peach.hardware_transcode import software_video_output
        self.assertEqual(software_video_output(0), ("-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
                                                    "-pix_fmt", "yuv420p"))

    def test_libx264_scales_in_software_and_caps_the_peak_rate(self):
        from peach.hardware_transcode import software_video_output
        self.assertEqual(software_video_output(720, threads="2"), (
            "-vf", f"scale={SCALE_720}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
            "-maxrate", "4M", "-bufsize", "8M", "-pix_fmt", "yuv420p", "-threads", "2"))
        self.assertIn("-maxrate", software_video_output(480))
        self.assertEqual(software_video_output(480)[software_video_output(480).index("-maxrate") + 1], "2M")

    def test_nvenc_scales_on_the_gpu_when_cuda_decodes_and_in_software_otherwise(self):
        outputs = self.outputs(HardwareEncoder("nvenc"), 720)
        rate = ("-c:v", "h264_nvenc", "-preset", "p1", "-tune", "hq", "-rc", "vbr", "-cq", "21", "-b:v", "0",
                "-maxrate", "4M", "-bufsize", "8M")
        self.assertEqual(outputs["cuda-nvenc"], ("-vf", f"scale_cuda={SCALE_720}:format=nv12", *rate))
        self.assertEqual(outputs["nvenc"], ("-vf", f"scale={SCALE_720}", *rate, "-pix_fmt", "yuv420p"))
        self.assertEqual(list(self.outputs(HardwareEncoder("nvenc"), 720, "vc1")), ["nvenc"])

    def test_amf_and_qsv_switch_to_peak_limited_vbr_after_a_software_scale(self):
        amf = self.outputs(HardwareEncoder("amf", "1"), 720)
        self.assertEqual(amf["d3d11va-amf"], amf["amf"])
        self.assertEqual(amf["amf"], ("-vf", f"scale={SCALE_720}", "-c:v", "h264_amf", "-quality", "speed",
                                      "-rc", "vbr_peak", "-b:v", "3M", "-maxrate", "4M", "-pix_fmt", "nv12"))
        qsv = self.outputs(HardwareEncoder("qsv"), 1080)
        self.assertEqual(qsv["qsv"][:2], ("-vf", f"scale={SCALE_720.replace('720', '1080')}"))
        self.assertEqual(qsv["qsv"][2:], ("-c:v", "h264_qsv", "-preset", "veryfast", "-b:v", "6M",
                                          "-maxrate", "8M", "-pix_fmt", "nv12"))

    def test_vaapi_scales_on_the_gpu_or_before_upload_with_vbr(self):
        outputs = self.outputs(HardwareEncoder("vaapi", "/dev/dri/renderD128"), 480)
        scale = SCALE_720.replace("720", "480")
        rate = ("-c:v", "h264_vaapi", "-rc_mode", "VBR", "-b:v", "1500k", "-maxrate", "2M")
        self.assertEqual(outputs["vaapi"], ("-vf", f"scale_vaapi={scale}:format=nv12", *rate))
        self.assertEqual(outputs["vaapi-encode"], ("-vf", f"scale={scale},format=nv12,hwupload", *rate))

    def test_videotoolbox_scales_in_software_and_lowers_its_bitrate(self):
        outputs = self.outputs(HardwareEncoder("videotoolbox"), 720)
        self.assertEqual(outputs["videotoolbox"], outputs["videotoolbox-encode"])
        self.assertEqual(outputs["videotoolbox"], ("-vf", f"scale={SCALE_720}", "-c:v", "h264_videotoolbox",
                                                   "-allow_sw", "0", "-b:v", "3M", "-pix_fmt", "yuv420p"))

    def test_the_setting_reaches_full_file_and_hls_and_keys_their_caches(self):
        from peach.media_processing_policy import playback_max_height, save_preferences
        with tempfile.TemporaryDirectory() as directory, \
                patch.dict(os.environ, {"PEACH_TRANSCODE_BACKEND": "software"}):
            root = Path(directory).resolve()
            source = root / "clip.mkv"
            source.write_bytes(b"fixture")
            resolver = Mock(ffmpeg=lambda: BinaryChoice(Path("ffmpeg"), "test"), ffprobe=lambda: None)
            service = TranscodeService(resolver, root / "full", state_root=root)
            hls = HlsSegmentService(resolver, root / "hls", hardware=service.hardware)
            original_segment = hls.cached_path(source, 7, 0, transcode=True)
            with self.assertRaises(ValueError):
                save_preferences(root, {"playback_max_height": 900})
            save_preferences(root, {"playback_max_height": 720})
            self.assertEqual(playback_max_height(root), 720)
            captured = []

            def execute(command, **kwargs):
                captured.append(command)
                Path(command[-1]).write_bytes(b"mp4")
                return 0, b"", b""
            with patch.object(service, "_probe", return_value=_MediaProfile("hevc", "yuv420p", "aac")), \
                    patch.object(service, "_execute", side_effect=execute):
                target, converted = service.browser_path(7, source)
            self.assertTrue(converted and target.name.endswith("-720p.mp4"))
            self.assertIn(f"scale={SCALE_720}", captured[0])
            path, hit, max_height = hls._cached_target(source, 7, 0, True)
            self.assertEqual((hit, max_height, path.parent.name.endswith("-h264-v2-720p")), (False, 720, True))
            self.assertNotEqual(path, original_segment)
            self.assertFalse(original_segment.parent.name.endswith("p"))
            self.assertEqual(hls._cached_target(source, 7, 0, False)[2], 0)
            command = hls._attempts(Path("ffmpeg"), source, 12, 6, True, "hevc", max_height)[-1][1](root / "s.ts")
            self.assertIn(f"scale={SCALE_720}", command)
            self.assertNotIn("scale", " ".join(hls._attempts(Path("ffmpeg"), source, 0, 6, False)[0][1](root / "c.ts")))
