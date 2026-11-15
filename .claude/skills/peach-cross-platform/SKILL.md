---
name: peach-cross-platform
description: macOS、跨平台路径与挂载、双机任务交接或 Git 状态异常时使用。
---

# 跨平台路径与部署核对

最后复核：2026-10-26
证据来源：`peach.platform`、`peach.scan`、`peach.ffmpeg`、ADR-0017、独立包与 Git 状态复核。

## 路径与部署

- ledger 路径保持 Windows 形态，不改写成 POSIX，也不从 macOS 写 `asset.path`；映射由 `asset.location` 和媒体配置声明，不从盘符猜来源。操作细节按 [路径配置](../../../docs/OPERATIONS.md#在-macos-上对应-windows-路径mediamounts)。
- 读取复用 `peach.platform`：授权根比较只看路径文字、不碰盘（Windows 与 macOS 不分大小写），挂载在线以目录实际可读判断，磁盘闸门用 `system_volume()`。脱盘是来源级状态，媒体缺失、来源离线与权限错误分别处理。
- 先确认源码部署、独立包或 Docker。媒体工具由 `FFmpegResolver` 按显式配置、随包工具、数据目录和 PATH 查找；独立 macOS 包不要求 Homebrew，源码开发外壳的 LaunchAgent 不能推广到所有安装方式。
- 安装、端口、工具与启动方式以 `docs/OPERATIONS.md` 和 `docs/DOCKER.md` 当前章节为准，现场核对，不复制另一部署的目录。

## 代码与账本交接

- 每台机器独立持有代码、venv、数据与工作树；任务分支提交、推送后在对端 fetch 并创建本机工作树，不复制 `.git` 指针或运行目录。
- 先用 `scripts/sync_status.sh` 核对代码与账本状态；代码落后时保护当前改动再更新，不能把 pull/rebase 作为无条件开工命令。
- 双机复制按 [ADR-0017](../../../docs/adr/0017-dual-host-local-runtime-and-sync-boundaries.md) 和运行文档：唯一写入端、显式复制与接管、冲突由用户选边，不做 SQLite 三方合并。
- 复制使用 SQLite backup API，活跃 WAL 数据库不直接复制文件；SMB 传输副本不能当运行账本，macOS 只以 immutable 方式读取已关闭快照。同步点不可达不等于本地媒体脱盘。
- mDNS 名取本机配置且两端不同。按 `peach.mdns` 的平台发布路径处理，用终端的 `scripts/check_mdns.py` 和 `/healthz` 验证；服务自己探测不能证明局域网可达。权限排查按当前主机运维参考。

## 测试与 Git

- 测试使用项目正式入口，涉及跨平台行为须取得 Windows 与 macOS 的适用证据；缺少一端就明确未验证，不伪造平台跳过结果。
- 临时根先 `.resolve()`，覆盖短路径、junction 与 `/var` 等别名；PID 存活探测复用 `peach.jobs.process_alive`，不在调用方重复实现 Windows 或 POSIX 判断。
- 换行由 `.gitattributes` 决定。状态异常时联合核对 `git status`、工作区与暂存 diff、内容哈希和未跟踪文件；`git diff HEAD` 不能代替未跟踪文件检查。
- exFAT 权限或 stat 缓存异常时，先证明内容与 HEAD 一致，再逐文件刷新索引；仍遵守任务归属与暂存边界，不以批量 add 修复状态。
