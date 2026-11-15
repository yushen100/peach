import os
import shutil
import socket
import ssl
import subprocess
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

from peach.certs import (
    CERT_DAYS,
    CertificateFiles,
    create_local_ca,
    ensure_certificate,
    not_after,
    reissue,
    reissue_reason,
    subject_alt_names,
)


def make_ca(tls_dir: Path) -> CertificateFiles:
    files = CertificateFiles.under(tls_dir)
    tls_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256",
         "-days", "3650", "-subj", "/CN=Test Local CA/O=Peach",
         "-keyout", str(files.ca_key), "-out", str(files.ca_cert)],
        check=True, capture_output=True)
    return files


class CertificateTests(unittest.TestCase):
    def test_missing_openssl_reports_the_required_tool_before_launch(self):
        from peach import certs
        with mock.patch.object(certs.shutil, 'which', return_value=None), \
                mock.patch.object(certs.Path, 'is_file', return_value=False), \
                mock.patch.object(certs.subprocess, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, '未找到 OpenSSL'):
                certs.require_openssl()
            run.assert_not_called()

    def test_openssl_hides_its_windows_console_and_preserves_output(self):
        from peach import certs
        result = subprocess.CompletedProcess(['openssl'], 0, 'certificate output', '')
        with mock.patch.object(certs.subprocess, 'run', return_value=result) as run:
            self.assertEqual(certs._openssl('version'), 'certificate output')
        expected = subprocess.CREATE_NO_WINDOW if certs.os.name == 'nt' else 0
        self.assertEqual(run.call_args.kwargs['creationflags'], expected)
        result.returncode, result.stderr = 1, 'test failure'
        with mock.patch.object(certs.subprocess, 'run', return_value=result):
            with self.assertRaisesRegex(RuntimeError, 'test failure'):
                certs._openssl('version')

    def test_openssl_never_waits_on_a_prompt_or_forever(self):
        """不给输入时 stdin 是 DEVNULL，要口令的提示立刻读到 EOF；卡住到期按失败报。"""
        from peach import certs
        result = subprocess.CompletedProcess(['openssl'], 0, 'ok', '')
        with mock.patch.object(certs.subprocess, 'run', return_value=result) as run:
            certs._openssl('version')
        self.assertIs(run.call_args.kwargs['stdin'], subprocess.DEVNULL)
        self.assertEqual(run.call_args.kwargs['timeout'], certs.OPENSSL_SECONDS)
        with mock.patch.object(certs.subprocess, 'run', return_value=result) as run:
            certs._openssl('x509', stdin=b'pem')
        self.assertIsNone(run.call_args.kwargs['stdin'])
        self.assertEqual(run.call_args.kwargs['input'], b'pem')
        hung = subprocess.TimeoutExpired(['openssl'], certs.OPENSSL_SECONDS)
        with mock.patch.object(certs.subprocess, 'run', side_effect=hung):
            with self.assertRaisesRegex(RuntimeError, 'timed out'):
                certs._openssl('version')

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tls = (Path(self._tmp.name) / "tls").resolve()
        self.files = make_ca(self.tls)
        self.addCleanup(self._tmp.cleanup)

    def test_missing_certificate_needs_reissue(self):
        self.assertEqual(
            reissue_reason(self.files, {"peach.local"}, {"127.0.0.1"}),
            "server certificate missing")

    def test_reissue_writes_every_requested_name(self):
        reissue(self.files, "peach.local", {"peach.local", "localhost"},
                {"127.0.0.1", "192.0.2.10"})
        names, addresses = subject_alt_names(self.files.cert)
        self.assertEqual(names, {"peach.local", "localhost"})
        self.assertEqual(addresses, {"127.0.0.1", "192.0.2.10"})
        self.assertIsNone(
            reissue_reason(self.files, {"peach.local"}, {"127.0.0.1", "192.0.2.10"}))

    def test_reissue_stays_under_apples_398_day_ceiling(self):
        """Apple 从 2020-09 起拒绝有效期超过 398 天的 TLS 服务器证书。

        iOS 上即使根证书已被完全信任也照样报「不受信任」，而且错误信息看不出是有效期
        的问题——所以这条必须由测试守住，不能靠记忆。
        """
        reissue(self.files, "peach.local", {"peach.local"}, {"127.0.0.1"})
        expiry = not_after(self.files.cert)
        self.assertIsNotNone(expiry)
        span = (expiry - datetime.now(timezone.utc)).days
        self.assertLessEqual(span, 398)
        self.assertGreater(span, 360)
        self.assertEqual(CERT_DAYS, 397)

    def test_a_new_address_triggers_reissue(self):
        """局域网地址随 DHCP 变化，证书的 SAN 是签死的——这正是要自动化的那一步。"""
        reissue(self.files, "peach.local", {"peach.local"}, {"127.0.0.1", "192.0.2.10"})
        self.assertIsNone(
            reissue_reason(self.files, {"peach.local"}, {"127.0.0.1", "192.0.2.10"}))
        reason = reissue_reason(self.files, {"peach.local"}, {"127.0.0.1", "198.51.100.7"})
        self.assertIn("198.51.100.7", reason or "")

    def test_reissue_writes_key_identifiers_for_strict_verification(self):
        """叶子证书携带密钥标识，满足严格链验证。"""
        files = CertificateFiles.under((Path(self._tmp.name) / "strict").resolve())
        create_local_ca(files)
        reissue(files, "peach.local", {"peach.local", "localhost"}, {"127.0.0.1"})
        text = subprocess.run(["openssl", "x509", "-in", str(files.cert), "-noout", "-text"],
                              check=True, capture_output=True, text=True, encoding="utf-8").stdout
        self.assertIn("Authority Key Identifier", text)
        self.assertIn("Subject Key Identifier", text)
        self.assert_strict_tls(files)

    def test_a_certificate_without_key_identifier_triggers_reissue(self):
        """缺少颁发者密钥标识的存量叶子按现有 CA 自动补签。"""
        work = Path(self._tmp.name).resolve()
        files = CertificateFiles.under(work / "legacy")
        create_local_ca(files)
        version = subprocess.run(["openssl", "version"], check=True, capture_output=True,
                                 text=True, encoding="utf-8").stdout
        identifiers = "" if "LibreSSL" in version else (
            "subjectKeyIdentifier = none\nauthorityKeyIdentifier = none\n")
        (work / "leaf.cnf").write_text(
            "[req]\ndistinguished_name = dn\nprompt = no\n[dn]\nCN = peach.local\n"
            "[ext]\nsubjectAltName = DNS:peach.local,DNS:localhost,IP:127.0.0.1\n"
            "basicConstraints = critical, CA:FALSE\nkeyUsage = critical,digitalSignature,keyEncipherment\n"
            "extendedKeyUsage = serverAuth\n" + identifiers, encoding="utf-8")
        subprocess.run(["openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes",
                        "-keyout", str(files.key), "-out", str(work / "leaf.csr"),
                        "-config", str(work / "leaf.cnf")], check=True, capture_output=True)
        subprocess.run(["openssl", "x509", "-req", "-in", str(work / "leaf.csr"),
                        "-CA", str(files.ca_cert), "-CAkey", str(files.ca_key), "-CAcreateserial",
                        "-out", str(files.cert), "-days", "397", "-extfile", str(work / "leaf.cnf"),
                        "-extensions", "ext"], check=True, capture_output=True)
        text = subprocess.run(["openssl", "x509", "-in", str(files.cert), "-noout", "-text"],
                              check=True, capture_output=True, text=True, encoding="utf-8").stdout
        self.assertNotIn("Authority Key Identifier", text)
        original_ca = (files.ca_cert.read_bytes(), files.ca_key.read_bytes())
        original_leaf = files.cert.read_bytes()
        self.assertEqual(reissue_reason(files, {"peach.local", "localhost"}, {"127.0.0.1"}),
                         "certificate lacks an authority key identifier")
        self.assertEqual(ensure_certificate(files.cert.parent, "peach.local", set()),
                         "certificate lacks an authority key identifier")
        self.assertEqual((files.ca_cert.read_bytes(), files.ca_key.read_bytes()), original_ca)
        self.assertNotEqual(files.cert.read_bytes(), original_leaf)
        self.assertEqual(next(files.cert.parent.glob("peach.crt.bak.*")).read_bytes(), original_leaf)
        self.assert_strict_tls(files)
        refreshed = (files.cert.read_bytes(), files.key.read_bytes())
        self.assertIsNone(ensure_certificate(files.cert.parent, "peach.local", set()))
        self.assertEqual((files.cert.read_bytes(), files.key.read_bytes()), refreshed)

    def assert_strict_tls(self, files):
        """通过回环握手验证项目 CA、主机名与严格 X.509 校验。"""
        server = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        server.load_cert_chain(files.cert, files.key)
        client = ssl.create_default_context(cafile=str(files.ca_cert))
        client.verify_flags |= ssl.VERIFY_X509_STRICT
        failures = []
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(1)
            listener.settimeout(5)

            def accept():
                try:
                    connection, _ = listener.accept()
                    with connection, server.wrap_socket(connection, server_side=True) as secured:
                        secured.sendall(b"verified")
                except Exception as exc:
                    failures.append(exc)

            worker = threading.Thread(target=accept)
            worker.start()
            try:
                with socket.create_connection(listener.getsockname(), timeout=5) as connection:
                    with client.wrap_socket(connection, server_hostname="peach.local") as secured:
                        self.assertEqual(secured.recv(8), b"verified")
            finally:
                worker.join(6)
            self.assertFalse(worker.is_alive())
            self.assertEqual(failures, [])

    @unittest.skipUnless(os.name == "nt", "需要 Windows PowerShell 签发入口")
    def test_powershell_setup_issues_a_strict_leaf(self):
        tls = (Path(self._tmp.name) / "powershell").resolve()
        script = Path(__file__).resolve().parents[1] / "scripts" / "setup_local_tls.ps1"
        result = subprocess.run(
            [shutil.which("pwsh"), "-NoProfile", "-File", str(script), "-Address", "127.0.0.1",
             "-DnsName", "peach.local", "-OutDir", str(tls)],
            capture_output=True, text=True, encoding="utf-8", timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assert_strict_tls(CertificateFiles.under(tls))

    @unittest.skipIf(os.name == "nt", "需要 POSIX 签发入口")
    def test_shell_setup_preserves_ca_and_issues_a_strict_leaf(self):
        tls = (Path(self._tmp.name) / "shell").resolve()
        files = CertificateFiles.under(tls)
        create_local_ca(files)
        ca = (files.ca_cert.read_bytes(), files.ca_key.read_bytes())
        script = Path(__file__).resolve().parents[1] / "scripts" / "setup_local_tls.sh"
        result = subprocess.run(
            ["/bin/sh", str(script)], env={**os.environ, "PEACH_TLS_DIR": str(tls),
                "PEACH_LAN_IP": "none", "PEACH_MDNS_NAME": "peach"},
            capture_output=True, text=True, encoding="utf-8", timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((files.ca_cert.read_bytes(), files.ca_key.read_bytes()), ca)
        self.assert_strict_tls(files)

    def test_near_expiry_triggers_reissue(self):
        reissue(self.files, "peach.local", {"peach.local"}, {"127.0.0.1"})
        soon = datetime.now(timezone.utc) + timedelta(days=CERT_DAYS - 5)
        reason = reissue_reason(self.files, {"peach.local"}, {"127.0.0.1"}, now=soon)
        self.assertIn("expires", reason or "")

    def test_ensure_keeps_the_ca_untouched(self):
        """只重签叶子证书。连 CA 一起换的话，每台设备都要重新装一遍信任。"""
        before = self.files.ca_cert.read_bytes()
        ensure_certificate(self.tls, "peach.local", {"192.0.2.10"})
        self.assertEqual(self.files.ca_cert.read_bytes(), before)
        names, addresses = subject_alt_names(self.files.cert)
        self.assertIn("peach.local", names)
        # 回环永远带上：健康检查走它，换网络也不受影响。
        self.assertIn("127.0.0.1", addresses)
        self.assertIn("192.0.2.10", addresses)

    def test_ensure_is_a_no_op_when_the_certificate_already_covers_everything(self):
        ensure_certificate(self.tls, "peach.local", {"192.0.2.10"})
        first = self.files.cert.read_bytes()
        self.assertIsNone(ensure_certificate(self.tls, "peach.local", {"192.0.2.10"}))
        self.assertEqual(self.files.cert.read_bytes(), first)

    def test_ensure_does_nothing_without_a_local_ca(self):
        """没有 CA 就没法签。这不是错误——macOS 那份可以只跑 HTTP。"""
        empty = Path(self._tmp.name) / "empty"
        empty.mkdir()
        self.assertIsNone(ensure_certificate(empty, "peach.local", {"192.0.2.10"}))


if __name__ == "__main__":
    unittest.main()
