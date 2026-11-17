from __future__ import annotations

import logging
import socket
import subprocess
import sys
import threading
import time
import ipaddress
from collections.abc import Callable

import ifaddr
from zeroconf import ServiceInfo, Zeroconf


LOGGER = logging.getLogger(__name__)

HTTP_SERVICE_TYPE = "_http._tcp.local."
HTTPS_SERVICE_TYPE = "_https._tcp.local."

#: 重新解析本机地址的间隔。换 Wi-Fi、DHCP 续租换地址、插拔网线都只改地址，
#: 不会通知进程；不复查的话 `peach.local` 会一直指向旧地址。
REFRESH_SECONDS = 20.0


def _normalized_name(name: str) -> str:
    normalized = name.strip().lower().removesuffix(".local")
    if not normalized or any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-" for ch in normalized):
        raise ValueError("mDNS name must contain only letters, digits, and hyphens")
    return normalized


def lan_ipv4() -> str:
    """从本机接口选择可发布地址，优先沿用有效物理接口的路由。"""
    benchmark = ipaddress.ip_network("198.18.0.0/15")
    candidates = []
    for adapter in ifaddr.get_adapters():
        name = (adapter.name + " " + adapter.nice_name).casefold()
        if any(marker in name for marker in ("tunnel", "tailscale", "host-only", "host only", "hyper-v virtual ethernet")) \
                or name.split(" ", 1)[0].startswith(("utun", "tun", "tap", "veth", "docker", "br-")):
            continue
        for entry in adapter.ips:
            if not entry.is_IPv4:
                continue
            address = ipaddress.IPv4Address(entry.ip)
            if (address in benchmark or address.is_loopback or address.is_link_local
                    or address.is_unspecified or address.is_multicast):
                continue
            candidates.append(str(address))

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("192.0.2.1", 80))
        routed = str(sock.getsockname()[0])
        if routed in candidates:
            return routed
    except OSError:
        pass
    finally:
        sock.close()
    if not candidates:
        raise RuntimeError("no publishable LAN IPv4 address; pass --mdns-address")
    # 默认路由落到 TUN 时，各私网段同等对待，沿用非网关端点优先的选择。
    return max(candidates, key=lambda value: (
        ipaddress.IPv4Address(value).is_private, int(value.rsplit('.', 1)[1]) not in {1, 2}, value))


def lan_ipv6(ipv4: str) -> tuple[str, ...]:
    """与 `ipv4` 同一块网卡上可发布的 IPv6：全球单播与 ULA，不含链路本地。

    链路本地地址要带网卡序号才能连，浏览器的地址栏用不了，所以不发布。
    """
    found: set[str] = set()
    for adapter in ifaddr.get_adapters():
        if not any(entry.is_IPv4 and entry.ip == ipv4 for entry in adapter.ips):
            continue
        for entry in adapter.ips:
            if not entry.is_IPv6:
                continue
            address = ipaddress.IPv6Address(entry.ip[0].split("%", 1)[0])
            if address.is_loopback or address.is_link_local or address.is_multicast:
                continue
            found.add(str(address))
    return tuple(sorted(found))


def _explicit_resolver(address: str) -> Callable[[], str]:
    parsed = ipaddress.ip_address(address)
    if not isinstance(parsed, ipaddress.IPv4Address):
        raise ValueError("mDNS address must be IPv4")
    if parsed.is_loopback or parsed.is_multicast or parsed.is_unspecified:
        raise ValueError("mDNS address must be a publishable interface IPv4")
    return lambda: str(parsed)



def answers_on_network(hostname: str, timeout: float = 2.0) -> bool:
    """本机的 mDNS 记录在网上真的有人应答吗。**只能从有本地网络权限的进程调用。**

    注册成功不等于对外可见：macOS 的「本地网络」隐私门会**静默**掐掉多播。从终端起的
    进程继承终端已获授权的身份，launchd 起的作业是另一个主体、没有弹窗可点，于是
    zeroconf 自认为注册成功，实际一个包都发不出去——`/healthz` 报着 `peach.local`，
    手机却怎么都解析不到。所以要自己发一次查询验一验。
    """
    query = b"\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00"
    for label in hostname.split("."):
        query += bytes([len(label)]) + label.encode()
    query += b"\x00\x00\x01\x00\x01"
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    except OSError:
        return False
    probe.settimeout(timeout)
    try:
        probe.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)
        probe.sendto(query, ("224.0.0.251", 5353))
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                payload, _ = probe.recvfrom(2048)
            except socket.timeout:
                return False
            if hostname.split(".")[0].encode() in payload:
                return True
    except OSError:
        return False
    finally:
        probe.close()
    return False


def _resolve(address_resolver: Callable[[], str],
             ipv6_resolver: Callable[[str], tuple[str, ...]] | None) -> tuple[str, tuple[str, ...]]:
    """本轮要发布的 IPv4 与同网卡 IPv6。读不到 IPv6 只少发 AAAA，不影响 A 记录。"""
    address = address_resolver()
    if ipv6_resolver is None:
        return address, ()
    try:
        return address, tuple(ipv6_resolver(address))
    except OSError:
        LOGGER.warning("Could not read interface IPv6 addresses; publishing IPv4 only this round", exc_info=True)
        return address, ()


class MdnsPublisher:
    """Publish Peach exactly like the verified pre-migration web server.

    ``Zeroconf()`` deliberately listens on all eligible interfaces. Restricting it to
    one IPv4 interface during the FastAPI migration made publication unreliable on
    this Windows host, while Windows ``DnsServiceRegister`` advertised discovery but
    could not create the branded ``peach.local`` host record.
    """

    backend = "zeroconf-all-interfaces"

    def __init__(
        self,
        name: str,
        port: int,
        secure: bool = False,
        address_resolver: Callable[[], str] = lan_ipv4,
        refresh_seconds: float = REFRESH_SECONDS,
        ipv6_resolver: Callable[[str], tuple[str, ...]] | None = None,
    ) -> None:
        self.name = _normalized_name(name)
        self.port = port
        self.secure = secure
        self._address_resolver = address_resolver
        self._ipv6_resolver = ipv6_resolver
        self._zeroconf: Zeroconf | None = None
        self._info: ServiceInfo | None = None
        self.address: str | None = None
        self.ipv6_addresses: tuple[str, ...] = ()
        self.status = "pending"
        self.refresh_seconds = refresh_seconds
        self._stop = threading.Event()
        self._watcher: threading.Thread | None = None

    @property
    def hostname(self) -> str:
        return f"{self.name}.local"

    def start(self) -> None:
        # 起不来也要把复查线程挂上：开机时网络还没就绪是常态，下一轮就能恢复。
        try:
            self._register()
        finally:
            self._start_watcher()

    def _register(self, current: tuple[str, tuple[str, ...]] | None = None) -> None:
        if self._zeroconf is not None:
            return
        address, ipv6 = current or _resolve(self._address_resolver, self._ipv6_resolver)
        service_type = HTTPS_SERVICE_TYPE if self.secure else HTTP_SERVICE_TYPE
        # AAAA 记录同样经 IPv4 组播应答；监听语义不变，仍是 ADR-0009 的全网卡 `Zeroconf()`。
        info = ServiceInfo(
            service_type,
            f"{self.name}.{service_type}",
            addresses=[socket.inet_aton(address)]
            + [socket.inet_pton(socket.AF_INET6, item) for item in ipv6],
            port=self.port,
            properties={"path": "/", "scheme": "https" if self.secure else "http"},
            server=f"{self.hostname}.",
        )
        zeroconf = Zeroconf()
        try:
            zeroconf.register_service(info, allow_name_change=True)
        except Exception:
            zeroconf.close()
            raise
        self._zeroconf = zeroconf
        self._info = info
        self.address = address
        self.ipv6_addresses = ipv6
        self.status = self.hostname

    def stop(self) -> None:
        self._stop.set()
        watcher, self._watcher = self._watcher, None
        if watcher is not None:
            watcher.join(timeout=self.refresh_seconds + 5)
        self._unregister()

    def _start_watcher(self) -> None:
        if self.refresh_seconds <= 0 or self._watcher is not None:
            return
        self._watcher = threading.Thread(target=self._watch, name="peach-mdns", daemon=True)
        self._watcher.start()

    def _watch(self) -> None:
        while not self._stop.wait(self.refresh_seconds):
            try:
                self.refresh()
            except Exception:
                LOGGER.exception("mDNS address recheck failed")

    def refresh(self) -> str:
        """本机地址变了就重新广播。

        换网络时 zeroconf 的套接字也绑在旧接口上，所以是整体重建而不是只改地址。
        地址解析不出来（没网）就先撤掉广播，等下一轮恢复——留着一条指向旧地址的
        记录比没有记录更糟，客户端会一直连一个不存在的地方。
        """
        try:
            current = _resolve(self._address_resolver, self._ipv6_resolver)
        except (OSError, RuntimeError):
            if self._zeroconf is not None:
                self._unregister()
                self.status = "unavailable"
            return "unavailable"
        if self._zeroconf is not None and current == (self.address, self.ipv6_addresses):
            return "unchanged"
        self._unregister()
        self._register(current)
        return "republished"

    def _unregister(self) -> None:
        if self._zeroconf is None:
            return
        try:
            if self._info is not None:
                self._zeroconf.unregister_service(self._info)
        finally:
            self._zeroconf.close()
            self._zeroconf = None
            self._info = None
            self.address = None
            self.ipv6_addresses = ()
            self.status = "stopped"



class DnsSdPublisher:
    """macOS：把广播交给系统的 mDNSResponder，不自己跑一套 mDNS 栈。

    自带 zeroconf 在 launchd 起的进程里会被「本地网络」隐私门静默拒绝——注册看着成功，
    实际一个多播包都发不出去（见 `answers_on_network`）。而 `dns-sd` 只是通过 UNIX 套接字
    请求系统那个本来就在跑、本来就有权限的 mDNSResponder 代发，同样由 launchd 启动却一切
    正常，实测过。

    这本来也是 macOS 上更正确的做法：一台机器不该跑两套 mDNS 响应器。
    """

    backend = "dns-sd-proxy"

    def __init__(
        self,
        name: str,
        port: int,
        secure: bool = False,
        address_resolver: Callable[[], str] = lan_ipv4,
        refresh_seconds: float = REFRESH_SECONDS,
    ) -> None:
        self.name = _normalized_name(name)
        self.port = port
        self.secure = secure
        self._address_resolver = address_resolver
        self.refresh_seconds = refresh_seconds
        self.address: str | None = None
        self.status = "pending"
        self._process: subprocess.Popen | None = None
        self._stop = threading.Event()
        self._watcher: threading.Thread | None = None

    @property
    def hostname(self) -> str:
        return f"{self.name}.local"

    def _register(self) -> None:
        if self._process is not None and self._process.poll() is None:
            return
        address = self._address_resolver()
        service = "_https._tcp" if self.secure else "_http._tcp"
        self._process = subprocess.Popen(
            ["/usr/bin/dns-sd", "-P", self.name, service, "local",
             str(self.port), self.hostname, address],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        self.address = address
        # 不在这里自证可达：本进程由 launchd 启动，「本地网络」隐私门挡的正是自己发多播，
        # 探针必然收不到回应，会把好的判成 unreachable。记录是系统 mDNSResponder 发的，
        # `dns-sd` 子进程还活着就说明注册仍在生效——这是本进程能拿到的最强证据。
        # 真要验，用 `scripts/check_mdns.py`，它从终端跑、有权限。
        self.status = self.hostname

    def _unregister(self) -> None:
        process, self._process = self._process, None
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        self.address = None
        self.status = "stopped"

    def start(self) -> None:
        try:
            self._register()
        finally:
            if self.refresh_seconds > 0 and self._watcher is None:
                self._watcher = threading.Thread(
                    target=self._watch, name="peach-mdns", daemon=True)
                self._watcher.start()

    def stop(self) -> None:
        self._stop.set()
        watcher, self._watcher = self._watcher, None
        if watcher is not None:
            watcher.join(timeout=self.refresh_seconds + 5)
        self._unregister()

    def refresh(self) -> str:
        """地址变了、或 dns-sd 自己退了，就重新注册。"""
        try:
            address = self._address_resolver()
        except (OSError, RuntimeError):
            if self._process is not None:
                self._unregister()
                self.status = "unavailable"
            return "unavailable"
        alive = self._process is not None and self._process.poll() is None
        if alive and address == self.address:
            return "unchanged"
        self._unregister()
        self._register()
        return "republished"

    def _watch(self) -> None:
        while not self._stop.wait(self.refresh_seconds):
            try:
                self.refresh()
            except Exception:
                LOGGER.exception("mDNS address recheck failed")


def create_mdns_publisher(
    name: str, port: int, secure: bool = False, address: str | None = None,
    refresh_seconds: float = REFRESH_SECONDS, ipv6: bool = False,
) -> MdnsPublisher:
    """`address` 显式钉住时 IPv4 不再变化，复查只跟随同网卡的 IPv6 前缀。

    `ipv6` 表示服务确实在收 IPv6 连接，只有这时才发布 AAAA 记录。macOS 走系统
    mDNSResponder（`DnsSdPublisher`），`dns-sd -P` 只带一个地址，不发布 AAAA；
    其余平台用进程内的 zeroconf。
    """
    resolver = _explicit_resolver(address) if address else lan_ipv4
    if sys.platform == "darwin":
        return DnsSdPublisher(name, port, secure=secure, address_resolver=resolver,
                              refresh_seconds=refresh_seconds)
    return MdnsPublisher(
        name, port, secure=secure, address_resolver=resolver,
        refresh_seconds=refresh_seconds, ipv6_resolver=lan_ipv6 if ipv6 else None,
    )
