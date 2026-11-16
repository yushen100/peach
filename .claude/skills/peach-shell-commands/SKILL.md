---
name: peach-shell-commands
description: 编写 Peach shell 命令、多行内容，处理路径、编码或测试临时目录时使用。
---

# Peach 命令与路径

最后复核：2026-10-28
证据来源：命令故障记录、迁回流程中的原生命令失败掩盖与输出截断、正式测试入口和 Windows 权限边界。

## 执行前

- 确认当前主机与 shell；本机 PowerShell 使用 7.x，默认单引号，需要展开时才用双引号。交给用户的命令另按用户级 `user-terminal-commands` 核对，Windows 为 PowerShell、Mac 为 zsh。
- 用户终端目录不确定时，项目 venv 与脚本写绝对路径或先进入已核实的项目目录。不要把自己的 shell 写法直接交给用户。
- 参数查当前入口，不凭记忆：集成需要 `integrate --branch`，手动迁移使用 `migrate upgrade --yes`。备份文件名含时间戳，重跑不覆盖已生成备份。
- `rg` 路径参数不含通配符，筛文件用 `-g`；退出码 1 表示无匹配。Python CLI 加 `-X utf8`，PowerShell 读取 UTF-8 文本加 `-Encoding utf8`。
- PowerShell 复合命令同时启用 `$ErrorActionPreference='Stop'` 与 `$PSNativeCommandUseErrorActionPreference=$true`；`rg` 无匹配和 Git 祖先判断等布尔退出码单独解释，不让后续成功掩盖前一步失败。
- 长任务先保存完整工具响应和会话标识，再输出摘要；每次日志读取限于当前阶段。启动回执不作成功证明，依赖结果时取得最终退出码并核对产物；项目测试仍直接走正式入口。

## 文件与转义

- 修改用编辑工具。多行命令、消息与文档先保存成 UTF-8 文件再交入口读取，不用 heredoc 或多层 shell 转义拼接。
- 跨 shell 路径使用正斜杠；变量使用任务专属名称，不覆盖系统变量。PowerShell 的 `foreach` 结果先保存，再交管道格式化。
- 测试临时目录先 `.resolve()` 再交给被测代码和断言，避免 runner 路径别名产生假差异。
- 递归删除或移动前核对绝对目标与归属，保留运行中的终端目录、真实数据与他人文件；按本任务 PID 清理，不按进程名批量结束。

## Windows 权限与失败

- Git common directory 写入、项目测试与构建需要正常权限时，从首次调用走受控授权和窄命令，不把隔离模式当管理员权限。
- 创建子进程或 `index.lock` 拒绝访问时，原样重跑正式入口；不拆测试、不改断言、不跳过门槛。不修改 ACL 或关闭隔离来绕过失败。
- 主检出依赖同步可能被运行中的 `peach.exe` 占用；按重启入口处理，工作树使用自己的 venv。`restart_windows_tray.py` 先确认托盘确实在运行。
- Node 依赖替换先按用户级 `local-operations.md` 执行占用预检；活动预览使用隔离工作树或隔离安装，不先删除其依赖树再处理原生文件占用。
- 测试、构建与媒体直接使用项目入口，不外套 CPU、内存、线程或进程数限制，整机名额由测试入口排；本机任务范围与取消按用户级 `resource-budget.md`。
