# ADR-0130：局域网监听改为双栈，IPv6 只收局域网来源

- 状态：已采纳
- 日期：2026-10-29
- 关系：补充 ADR-0004 的网络边界与 ADR-0009 的 mDNS 发布语义

## 背景

`0.0.0.0` 只收 IPv4，Windows 源码部署的 HTTPS 还绑在单个局域网 IPv4 上，mDNS 只发布 A 记录。只有 IPv6 地址或优先走 IPv6 的客户端连不上 `peach.local`。

把 `host` 改成 `::` 也解决不了：uvicorn 只建一个单栈套接字，asyncio 会给 IPv6 套接字强制打开 `IPV6_V6ONLY`，结果是换成只收 IPv6。IPv6 地址又是全球可路由的，没有家用 NAT 那层隔离，路由器放行时公网可以直接连到服务。

## 决策

1. `host` 为 `0.0.0.0` 或 `::` 时，Peach 用 `socket.create_server(dualstack_ipv6=True)` 绑一个 `::` 套接字交给 uvicorn，同时接收 IPv4 与 IPv6；系统没有 IPv6 时退回 `0.0.0.0`。`--ipv4-only` 保留旧行为。已有的 `0.0.0.0` 配置不需要修改就获得 IPv6。
2. 连接进入应用前统一经过一层连接边界：IPv4 映射地址还原成 IPv4，下游的本机与私网判断不变；IPv6 来源只接受回环、链路本地、ULA、本机网卡同一 /64 前缀和 `PEACH_LAN_IPV6_PREFIXES` 列出的前缀，其余返回 403。判据是 TCP 来源，排在代理头改写之前。
3. mDNS 只在监听套接字确实接收 IPv6 时发布 AAAA，地址取发布的 IPv4 所在网卡上的全球单播与 ULA 地址。Windows 与 Linux 沿用 `Zeroconf()` 全网卡发布；macOS 沿用 `dns-sd -P`，它只带一个地址，不发布 AAAA。
4. Windows 源码部署的 HTTPS 改为监听所有网卡，`--mdns-address` 只钉住发布的 IPv4 与健康检查地址。macOS 源码部署的 pf 转发只覆盖 IPv4，两条服务带 `--ipv4-only`。

## 已拒绝方案

- **只把默认 `host` 改成 `::`**：受 `IPV6_V6ONLY` 影响会丢掉 IPv4。
- **两个单栈套接字**：uvicorn 支持多个套接字，但两个套接字分别报告监听地址，mDNS、诊断与端口占用都要按两份处理；一个双栈套接字已经覆盖需求。
- **只靠访问密码保护 IPv6**：访问密码可以留空，ADR-0004 也要求应用本身不裸露公网端口。
- **macOS 再起一个 `dns-sd -R` 补 AAAA**：与 `dns-sd -P` 的主机名记录互判冲突，实测其中一方会因名称冲突被撤销。macOS 源码部署本来只转发 IPv4，暂不发布 AAAA。

## 后果

IPv6 客户端可以经 `peach.local` 和本机 IPv6 地址访问。证书只签局域网 IPv4，用 IPv6 字面地址访问 HTTPS 会报证书不匹配，`.local` 名称不受影响。运营商下发的前缀不是 /64、或局域网用了多个前缀时，需要用 `PEACH_LAN_IPV6_PREFIXES` 补充。Docker 默认网络没有 IPv6，容器看到的来源是网关；要看到真实 IPv6 来源须为网络开启 IPv6。
