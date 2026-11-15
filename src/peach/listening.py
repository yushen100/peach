"""服务监听：IPv4/IPv6 双栈套接字，以及只放行局域网 IPv6 的连接边界。"""
from __future__ import annotations

import errno
import ipaddress
import json
import logging
import os
import socket
import threading
import time
from collections.abc import Callable

import ifaddr

from .user_messages import message_fields


LOGGER = logging.getLogger(__name__)

#: 这两个监听地址都表示「所有网卡」，统一绑成双栈。
ANY_HOSTS = frozenset({"0.0.0.0", "::", "[::]"})
#: 本机网卡前缀的缓存时间。换网络或拿到新前缀后，最多这么久才认得出新邻居。
PREFIX_SECONDS = 20.0
#: ULA（RFC 4193），家用路由器常给局域网分这一段，不会路由到公网。
UNIQUE_LOCAL = ipaddress.ip_network("fc00::/7")
#: 表示「这台机器没有可用 IPv6」的错误码；Windows 的 Winsock 码与 POSIX 不同，两套都认。
_NO_IPV6 = frozenset(code for name in (
    "EAFNOSUPPORT", "EADDRNOTAVAIL", "EPROTONOSUPPORT", "WSAEAFNOSUPPORT", "WSAEADDRNOTAVAIL",
) if (code := getattr(errno, name, None)) is not None)


def ipv6_unavailable(exc: OSError) -> bool:
    return exc.errno in _NO_IPV6


def _parse(host: str):
    text = (host or "").strip().lower()
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    try:
        return ipaddress.ip_address(text)
    except ValueError:
        return None


def is_loopback(host: str) -> bool:
    """`localhost` 与任一回环地址（含方括号写法）都算本机。"""
    if (host or "").strip().lower() == "localhost":
        return True
    address = _parse(host)
    return bool(address and address.is_loopback)


def loopback_origin_host(host: str) -> str:
    """托盘与健康检查访问本机服务时用的主机：只监听 `::1` 时走 IPv6 回环，其余走 IPv4。"""
    address = _parse(host)
    return "[::1]" if address is not None and address.version == 6 and address.is_loopback else "127.0.0.1"


def bind(host: str, port: int, *, ipv4_only: bool = False) -> tuple[socket.socket, bool]:
    """绑好监听套接字，返回套接字与是否接收 IPv6 连接。

    「所有网卡」绑一个双栈 `::` 套接字，IPv4 连接以 `::ffff:a.b.c.d` 进来；系统或容器
    关掉了 IPv6、或调用方要求 `ipv4_only` 时绑 `0.0.0.0`。uvicorn 自己按 `host` 只建一个
    单栈套接字，asyncio 还会给 IPv6 套接字强制打开 `IPV6_V6ONLY`，所以由这里建好再交给它。
    """
    if host.strip() in ANY_HOSTS:
        if not ipv4_only and socket.has_dualstack_ipv6():
            if port:
                # macOS 等 BSD 系统允许带 SO_REUSEADDR 的 `::` 叠在别人的 `0.0.0.0` 上，IPv4
                # 连接仍归对方。先按旧行为试绑一次 IPv4，端口被占就在这里报错。
                socket.create_server(("0.0.0.0", port)).close()
            try:
                return _inheritable(socket.create_server(
                    ("::", port), family=socket.AF_INET6, dualstack_ipv6=True)), True
            except OSError as exc:
                # 端口被占、权限不够换成 IPv4 也一样失败；只有地址族不可用才退回。
                if not ipv6_unavailable(exc):
                    raise
                LOGGER.info("IPv6 listening unavailable (%s); listening on IPv4 only", exc)
        return _inheritable(socket.create_server(("0.0.0.0", port))), False
    address = _parse(host)
    if address is None:
        family = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)[0][0]
        target = (host, port)
    else:
        family = socket.AF_INET6 if address.version == 6 else socket.AF_INET
        target = (str(address), port)
    return _inheritable(socket.create_server(target, family=family)), family == socket.AF_INET6


def _inheritable(sock: socket.socket) -> socket.socket:
    sock.set_inheritable(True)
    return sock


def _unmapped(pair):
    if not pair:
        return pair
    address = _parse(str(pair[0]))
    if address is not None and address.version == 6 and address.ipv4_mapped is not None:
        return (str(address.ipv4_mapped), *pair[1:])
    return pair


def local_ipv6_networks() -> tuple[ipaddress.IPv6Network, ...]:
    """本机各网卡上的 IPv6 前缀，按 /64 归并。

    Windows 把临时地址和 DHCPv6 地址报成 /128；同一链路上的邻居仍在它的 /64 里。
    """
    networks = set()
    for adapter in ifaddr.get_adapters():
        for entry in adapter.ips:
            if not entry.is_IPv6:
                continue
            address = ipaddress.IPv6Address(entry.ip[0].split("%", 1)[0])
            if address.is_loopback or address.is_link_local:
                continue
            prefix = min(entry.network_prefix, 64)
            networks.add(ipaddress.IPv6Network(f"{address}/{prefix}", strict=False))
    return tuple(sorted(networks))


def configured_ipv6_networks(text: str) -> tuple[ipaddress.IPv6Network, ...]:
    """`PEACH_LAN_IPV6_PREFIXES` 里逗号分隔的额外局域网前缀。

    Docker 开了 IPv6 的网络里，容器自己的前缀是 Docker 分配的 ULA，宿主机局域网的
    前缀不在网卡上，需要在这里写明。
    """
    networks = []
    for item in text.split(","):
        if not item.strip():
            continue
        try:
            network = ipaddress.ip_network(item.strip(), strict=False)
        except ValueError:
            raise ValueError(f"PEACH_LAN_IPV6_PREFIXES: {item.strip()} is not an IPv6 prefix") from None
        if network.version != 6:
            raise ValueError(f"PEACH_LAN_IPV6_PREFIXES: {item.strip()} is not an IPv6 prefix")
        networks.append(network)
    return tuple(networks)


class LanBoundary:
    """连接层的入口：还原 IPv4 映射地址，拒绝来自局域网以外的 IPv6 连接。

    IPv4 走家用 NAT，外网进不来；IPv6 地址则是全球可路由的，路由器放行就能直连。
    所以 IPv6 只收回环、链路本地、ULA 与本机网卡同前缀的邻居，其余一律 403。判据是
    TCP 连接的真实来源，必须放在代理头改写之前：Tunnel 的边缘头会把来源换成公网访客。
    """

    def __init__(self, app, networks: Callable[[], tuple] = local_ipv6_networks,
                 refresh_seconds: float = PREFIX_SECONDS, extra: tuple = ()) -> None:
        self.app = app
        self._networks = networks
        self._extra = extra
        self._refresh_seconds = refresh_seconds
        self._cached: tuple = ()
        self._stamp = float("-inf")
        self._lock = threading.Lock()

    def _local_networks(self, *, fresh: bool = False) -> tuple:
        with self._lock:
            now = time.monotonic()
            if fresh or now - self._stamp >= self._refresh_seconds:
                try:
                    self._cached = self._networks()
                except OSError:
                    LOGGER.warning("Could not read local IPv6 prefixes", exc_info=True)
                self._stamp = now
            return self._cached

    def allows(self, host: str) -> bool:
        address = _parse(host)
        if address is None or address.version == 4:
            return True
        if address.is_loopback or address.is_link_local or address in UNIQUE_LOCAL:
            return True
        if any(address in network for network in self._extra):
            return True
        if any(address in network for network in self._local_networks()):
            return True
        # 刚换网络时缓存里还是旧前缀，拒绝之前重读一次。
        return any(address in network for network in self._local_networks(fresh=True))

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return
        scope["client"] = _unmapped(scope.get("client"))
        scope["server"] = _unmapped(scope.get("server"))
        client = scope.get("client")
        if client and not self.allows(str(client[0])):
            LOGGER.warning("Refused IPv6 connection from outside the local network: %s", client[0])
            if scope["type"] == "websocket":
                await send({"type": "websocket.close", "code": 1008})
                return
            body = json.dumps(message_fields("api.listening.outsideLan", key="error"), ensure_ascii=False).encode()
            await send({"type": "http.response.start", "status": 403,
                        "headers": [(b"content-type", b"application/json; charset=utf-8"),
                                    (b"content-length", str(len(body)).encode()),
                                    (b"cache-control", b"no-store")]})
            await send({"type": "http.response.body", "body": body})
            return
        await self.app(scope, receive, send)


def serve(app, sock: socket.socket, **options) -> None:
    """在 `bind` 绑好的套接字上运行 ASGI 应用。启动失败按 uvicorn 的约定退出。

    先在 uvicorn 的事件循环上装好 Peach 的 asyncio 处理器。处理器拿着 Server：Windows 上客户端
    在 accept 完成前断开时，标准库会关掉监听套接字，`error_reporting.asyncio_handler` 靠它按原地址重新监听。
    """
    import asyncio
    import functools

    import uvicorn
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

    from .error_reporting import asyncio_handler
    try:
        extra = configured_ipv6_networks(os.environ.get("PEACH_LAN_IPV6_PREFIXES", ""))
    except ValueError as exc:
        raise SystemExit(str(exc)) from None
    # 代理头在连接边界之内处理，保持 uvicorn 默认只信任 127.0.0.1 的口径。
    trusted = os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1")
    config = uvicorn.Config(
        LanBoundary(ProxyHeadersMiddleware(app, trusted_hosts=trusted), extra=extra),
        host=str(sock.getsockname()[0]), port=int(sock.getsockname()[1]),
        workers=1, proxy_headers=False, **options,
    )
    server = uvicorn.Server(config)

    async def run():
        asyncio.get_running_loop().set_exception_handler(
            functools.partial(asyncio_handler, uvicorn_server=server))
        await server.serve(sockets=[sock])

    try:
        asyncio.run(run(), loop_factory=config.get_loop_factory())
    except KeyboardInterrupt:
        pass
    if not server.started:
        raise SystemExit(uvicorn.config.STARTUP_FAILURE)
