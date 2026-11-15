import asyncio
import errno
import ipaddress
import socket
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from peach import listening
from peach.listening import LanBoundary


LAN = (ipaddress.IPv6Network("2001:db8:1:2::/64"),)


def _ipv6_available() -> bool:
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as probe:
            probe.bind(("::1", 0))
    except OSError:
        return False
    return True


class _Recorder:
    def __init__(self):
        self.scopes = []

    async def __call__(self, scope, receive, send):
        self.scopes.append(scope)
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})


def _call(boundary, client, *, kind="http", server=("::", 8900)):
    sent = []

    async def receive():
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    asyncio.run(boundary({"type": kind, "client": client, "server": server}, receive, send))
    return sent


class LoopbackTests(unittest.TestCase):
    def test_every_loopback_spelling_counts_as_this_machine(self):
        for host in ("127.0.0.1", "127.0.0.2", "::1", "[::1]", "localhost", "LOCALHOST",
                     "::ffff:127.0.0.1"):
            with self.subTest(host=host):
                self.assertTrue(listening.is_loopback(host))
        for host in ("0.0.0.0", "::", "[::]", "192.0.2.1", "fd00::1", "peach.local", ""):
            with self.subTest(host=host):
                self.assertFalse(listening.is_loopback(host))

    def test_tray_reaches_an_ipv6_only_loopback_service_over_ipv6(self):
        self.assertEqual(listening.loopback_origin_host("::1"), "[::1]")
        self.assertEqual(listening.loopback_origin_host("[::1]"), "[::1]")
        for host in ("127.0.0.1", "0.0.0.0", "::", "localhost"):
            with self.subTest(host=host):
                self.assertEqual(listening.loopback_origin_host(host), "127.0.0.1")


class BindTests(unittest.TestCase):
    """绑定必须真的建出套接字：双栈与否只能由内核回答，不能由选项推断。"""

    @unittest.skipUnless(_ipv6_available(), "本机没有 IPv6 回环")
    def test_all_interfaces_accept_ipv4_and_ipv6_on_one_socket(self):
        sock, ipv6 = listening.bind("0.0.0.0", 0)
        with sock:
            self.assertTrue(ipv6)
            self.assertEqual(sock.family, socket.AF_INET6)
            self.assertEqual(sock.getsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY), 0)
            sock.listen()
            port = sock.getsockname()[1]
            for family, address in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
                with self.subTest(address=address), socket.socket(family, socket.SOCK_STREAM) as client:
                    client.settimeout(2)
                    client.connect((address, port))
                    accepted, peer = sock.accept()
                    accepted.close()
                    self.assertTrue(listening.is_loopback(peer[0]))

    def test_ipv4_only_keeps_the_previous_wildcard_socket(self):
        sock, ipv6 = listening.bind("0.0.0.0", 0, ipv4_only=True)
        with sock:
            self.assertFalse(ipv6)
            self.assertEqual(sock.family, socket.AF_INET)
            self.assertEqual(sock.getsockname()[0], "0.0.0.0")

    def test_a_host_without_ipv6_falls_back_to_ipv4(self):
        real = socket.create_server

        def no_ipv6(address, *, family=socket.AF_INET, **kwargs):
            if family == socket.AF_INET6:
                raise OSError(errno.EAFNOSUPPORT, "Address family not supported")
            return real(address, family=family, **kwargs)

        with patch("peach.listening.socket.create_server", side_effect=no_ipv6):
            sock, ipv6 = listening.bind("::", 0)
        with sock:
            self.assertFalse(ipv6)
            self.assertEqual(sock.family, socket.AF_INET)

    @unittest.skipUnless(_ipv6_available(), "本机没有 IPv6 回环")
    def test_a_taken_port_is_reported_instead_of_silently_dropping_ipv6(self):
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as holder:
            holder.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            holder.bind(("::", 0))
            holder.listen()
            with self.assertRaises(OSError) as raised:
                listening.bind("0.0.0.0", holder.getsockname()[1])
        self.assertEqual(raised.exception.errno, errno.EADDRINUSE)

    def test_a_port_held_by_another_program_is_refused_not_shared(self):
        """Windows 的 SO_REUSEADDR 会让第二个监听者抢走一半连接；占用必须如实报错。"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as holder:
            holder.bind(("0.0.0.0", 0))
            holder.listen()
            with self.assertRaises(OSError):
                sock, _ = listening.bind("0.0.0.0", holder.getsockname()[1])
                sock.close()

    def test_a_specific_address_binds_only_that_family(self):
        sock, ipv6 = listening.bind("127.0.0.1", 0)
        with sock:
            self.assertFalse(ipv6)
            self.assertEqual(sock.getsockname()[0], "127.0.0.1")


class LanBoundaryTests(unittest.TestCase):
    def boundary(self, networks=lambda: LAN, **options):
        app = _Recorder()
        return LanBoundary(app, networks=networks, **options), app

    def test_ipv4_peers_keep_their_ipv4_form(self):
        """双栈套接字把 IPv4 连接报成 `::ffff:a.b.c.d`；下游的本机、私网判断都按 IPv4 写的。"""
        boundary, app = self.boundary()
        sent = _call(boundary, ("::ffff:192.0.2.7", 5000), server=("::ffff:192.0.2.1", 8900))
        self.assertEqual(sent[0]["status"], 204)
        self.assertEqual(app.scopes[0]["client"], ("192.0.2.7", 5000))
        self.assertEqual(app.scopes[0]["server"], ("192.0.2.1", 8900))

    def test_lan_ipv6_peers_reach_the_app(self):
        boundary, app = self.boundary()
        for peer in ("::1", "fe80::1", "fd12:3456::9", "2001:db8:1:2::abcd"):
            with self.subTest(peer=peer):
                self.assertEqual(_call(boundary, (peer, 5000))[0]["status"], 204)
        self.assertEqual(len(app.scopes), 4)

    def test_public_ipv6_peers_are_refused_before_the_app_runs(self):
        """IPv6 没有 NAT，路由器放行就是公网直连；只凭口令守门不够。"""
        boundary, app = self.boundary()
        sent = _call(boundary, ("2001:db8:ffff::1", 5000))
        self.assertEqual(sent[0]["status"], 403)
        self.assertIn("局域网".encode(), sent[1]["body"])
        self.assertEqual(app.scopes, [])

    def test_public_ipv6_websockets_are_closed(self):
        boundary, app = self.boundary()
        sent = _call(boundary, ("2001:db8:ffff::1", 5000), kind="websocket")
        self.assertEqual(sent, [{"type": "websocket.close", "code": 1008}])
        self.assertEqual(app.scopes, [])

    def test_a_new_prefix_is_read_again_before_refusing(self):
        """换网络后缓存里还是旧前缀；拒绝之前要重读一次网卡。"""
        current = [()]
        boundary, _ = self.boundary(networks=lambda: current[0], refresh_seconds=3600)
        self.assertFalse(boundary.allows("2001:db8:1:2::abcd"))
        current[0] = LAN
        self.assertTrue(boundary.allows("2001:db8:1:2::abcd"))

    def test_configured_prefixes_cover_docker_hosts(self):
        """容器里只看得到 Docker 分配的 ULA，宿主机局域网的前缀由部署者写明。"""
        extra = listening.configured_ipv6_networks(" 2001:db8:9::/64 ,")
        boundary, _ = self.boundary(networks=lambda: (), extra=extra)
        self.assertTrue(boundary.allows("2001:db8:9::5"))
        self.assertFalse(boundary.allows("2001:db8:a::5"))
        for bad in ("192.0.2.0/24", "not-a-prefix"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                listening.configured_ipv6_networks(bad)

    def test_unreadable_interfaces_keep_the_last_known_prefixes(self):
        calls = iter([LAN])

        def networks():
            try:
                return next(calls)
            except StopIteration:
                raise OSError("adapter enumeration failed") from None

        boundary, _ = self.boundary(networks=networks, refresh_seconds=0)
        self.assertTrue(boundary.allows("2001:db8:1:2::1"))
        self.assertTrue(boundary.allows("2001:db8:1:2::1"))

    def test_lifespan_passes_through_untouched(self):
        boundary, app = self.boundary()
        scope = {"type": "lifespan"}

        async def receive():
            return {}

        async def send(_message):
            return None

        async def recorded(received_scope, _receive, _send):
            app.scopes.append(received_scope)

        boundary.app = recorded
        asyncio.run(boundary(scope, receive, send))
        self.assertIs(app.scopes[0], scope)


class InterfacePrefixTests(unittest.TestCase):
    def test_temporary_addresses_widen_to_their_link_prefix(self):
        """Windows 把临时地址报成 /128；同链路的邻居在它的 /64 里。"""
        adapters = [SimpleNamespace(ips=[
            SimpleNamespace(is_IPv6=True, ip=("2001:db8:1:2::9", 0, 0), network_prefix=128),
            SimpleNamespace(is_IPv6=True, ip=("fe80::1", 0, 3), network_prefix=64),
            SimpleNamespace(is_IPv6=True, ip=("::1", 0, 0), network_prefix=128),
            SimpleNamespace(is_IPv6=False, ip="192.0.2.9", network_prefix=24),
            SimpleNamespace(is_IPv6=True, ip=("2001:db8:7::1", 0, 0), network_prefix=48),
        ])]
        with patch("peach.listening.ifaddr.get_adapters", return_value=adapters):
            self.assertEqual(listening.local_ipv6_networks(), (
                ipaddress.IPv6Network("2001:db8:1:2::/64"),
                ipaddress.IPv6Network("2001:db8:7::/48"),
            ))


if __name__ == "__main__":
    unittest.main()
