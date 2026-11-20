---
kind: howto
---

# 开发检索指南

从[代码导航](CODEBASE_MAP.md)选择能力，再按端点、符号或错误定位。
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

环境准备、选测和交付见[测试与依赖](TESTING.md)。
