---
kind: howto
---

# 开发检索指南

从[代码知识库导航](CODEBASE_MAP.md)选择能力，再按端点、符号或错误定位。
以下只读查询在当前仓库或隔离工作树根目录执行，适用于 PowerShell；
`rg` 的退出码 1 表示未匹配，不能据此判断能力不存在。

## 按请求定位实现

已知 API 路径时，先在具名路由与分派表搜索，再检查前端调用方和测试。
例如定位影片详情：

```powershell
rg -n -F '/api/item' src/peach frontend/src tests frontend/test
rg -n 'q_item|GET_HANDLERS|dispatch_api_get' src/peach/web_router.py src/peach/web_catalog.py src/peach/routes_api.py
```

查询可能命中相邻端点。核对实际 handler 的键、参数与响应，别把函数名相似当作同一入口。
页面路径还要搜索 `frontend/src/react/router/`；服务端路由与客户端导航的职责见
[路由参考](ROUTES.md)和[前端文档](FRONTEND.md)。

## 按符号追踪定义与消费者

先限定能力对应目录，再扩大到调用方和测试。例如检查写入事务：

```powershell
rg -n 'class LedgerDatabase|def write_transaction' src/peach/repository.py src/peach/web_state.py
rg -n -F 'write_transaction(' src/peach/web_item_edit.py src/peach/field_owners.py tests/test_field_owners.py
```

若导入来自 `web_contract.py`，继续定位实际定义模块。设置 mock 时查看消费者在哪里查找该名字。
大文件先用 `rg -n` 定位，再读取相关函数及其调用上下文，避免一次输出整文件。

## 按能力找文件

优先使用文件名过滤，不递归输出依赖、构建产物或真实数据。

```powershell
rg --files src/peach tests -g '*metadata*' -g '*scraping*'
rg --files frontend/src frontend/test -g '*routes*' -g '*settings*'
rg -n '取消|暂停|task_control' docs src/peach/task_control.py tests/test_task_control.py
```

搜索未命中时，换用页面文字、API 路径、领域同义词或配置键；再查
[复用清单](REUSE.md)中的继任关系。确实需要历史证据时，用文件或符号限定范围：

```powershell
git log -5 --oneline -- src/peach/task_control.py
git log -5 --oneline -S 'READ_ONLY_POST_ROUTES' -- src/peach/web_router.py
```

## 从改动定位测试

测试归属查 [scope_registry.toml](../scripts/scope_registry.toml)，
选测逻辑查 [change_impact.py](../scripts/change_impact.py)和[test_runner.py](../scripts/test_runner.py)。
导航页列出的测试只是阅读起点；正式覆盖由当前登记、改动范围和测试入口决定。

```powershell
rg -n -F 'test_task_control.py' scripts/scope_registry.toml
rg -n 'task_control|web_tasks' scripts/scope_registry.toml
rg -n 'write_transaction|RevisionConflict' tests/test_field_owners.py
```

完成修改后，在已注册且依赖齐备的隔离工作树运行：

```powershell
& .\scripts\test.ps1 -Scope auto
```

依赖、共享设施和未知影响面使用 `full`；环境准备、定向调试、证明与交付按
[TESTING.md](TESTING.md)及 `peach-worktree` 执行，不从本页复制另一套执行流程。

## 代表性检索验收

用下列任务核对导航是否仍能找到证据；逐项记下实际路径和未取得的证据。

| 请求 | 导航起点 | 核对结果 |
| --- | --- | --- |
| 只改开发文档 | 开发交付与上下文检查 | 找到 `WRITING.md`、现有文档检查和正式测试入口 |
| 影片详情字段显示不正确 | JSON 端点、目录与前端 | 从端点找到 handler、实际定义、前端消费者及对应测试 |
| 后台任务暂停后状态不一致 | 后台任务 | 找到 HTTP 入口、控制状态、执行器检查点及行为测试 |
| 刮削修复对旧结果不生效 | 刮削与升级补修 | 同时定位来源处理、候选策略、缓存及补修回执 |
| 请求批量修改真实资料 | 数据库与字段写入 | 找到 `peach-ledger-write`，核对当轮授权与复核要求后再执行 |

评价速度时，以相同任务、相同源码版本，记录从请求到定位实现与测试的时间及读取量；
没有对照测量时，只报告导航可达性，不宣称速度提升比例。
