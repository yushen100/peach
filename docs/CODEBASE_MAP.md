# 代码导航

按能力查源码入口和对应测试，再用[开发检索指南](CODE_SEARCH.md)里的示例追踪调用方。任务约束见 [AGENTS.md](../AGENTS.md)，正式测试范围以[测试登记](../scripts/scope_registry.toml)和[测试入口](TESTING.md)为准。

## 能力与源码

表中源码路径相对于仓库根目录；测试列可作为文件名检索词。

| 能力与常见检索词 | 源码起点 | 测试起点 | 参考 |
| --- | --- | --- | --- |
| 命令行、服务启动、升级前迁移 | [cli.py](../src/peach/cli.py)、[server.py](../src/peach/server.py)、[runtime_prepare.py](../src/peach/runtime_prepare.py) | `test_cli.py`、`test_server.py` | [运行配置](OPERATIONS.md) |
| Web 服务装配、认证、健康检查 | [api.py](../src/peach/api.py)、[routes_auth.py](../src/peach/routes_auth.py)、[health.py](../src/peach/health.py) | `test_fastapi_api.py` | [架构](ARCHITECTURE.md)、[安全](../SECURITY.md) |
| JSON 端点、只读端、写入冲突 | [routes_api.py](../src/peach/routes_api.py)、[web_router.py](../src/peach/web_router.py)、[web_state.py](../src/peach/web_state.py) | `test_fastapi_api.py`、`test_field_owners.py` | [路由](ROUTES.md) |
| 目录、筛选、搜索、影片详情 | [web_catalog.py](../src/peach/web_catalog.py)、[web_search.py](../src/peach/web_search.py)、[catalog_rules.py](../src/peach/catalog_rules.py) | 搜索 `q_items`、`q_facets`、`q_item` | [目录浏览](DIRECTORY_BROWSING.md) |
| 扫描、入库、文件身份、路径映射 | [scan.py](../src/peach/scan.py)、[file_identity.py](../src/peach/file_identity.py)、[platform.py](../src/peach/platform.py)、[media_libraries.py](../src/peach/media_libraries.py) | `test_scan.py`、`test_platform.py` | [架构](ARCHITECTURE.md)、[运行配置](OPERATIONS.md) |
| 数据库、事务、字段归属、迁移 | [repository.py](../src/peach/repository.py)、[field_owners.py](../src/peach/field_owners.py)、[migrations.py](../src/peach/migrations.py)、[migrations/](../migrations/) | `test_field_owners.py` | [总体架构](ARCHITECTURE.md)；真实操作读 `peach-ledger-write` |
| 刮削、资料来源、候选、人工复核 | [metadata.py](../src/peach/metadata.py)、[metadata_routes.py](../src/peach/metadata_routes.py)、[metadata_policy.py](../src/peach/metadata_policy.py)、[web_scraping.py](../src/peach/web_scraping.py)、[review_csv.py](../src/peach/review_csv.py) | `test_metadata_routes.py`、`test_metadata_policy.py`、`test_metadata_replay.py` | [采集](SOURCING.md)、[自定义来源](CUSTOM_SOURCES.md) |
| 人物、厂牌、身份合并、标签 | [entities.py](../src/peach/entities.py)、[web_entity.py](../src/peach/web_entity.py)、[web_tags.py](../src/peach/web_tags.py)、[tag_management.py](../src/peach/tag_management.py) | `test_entity_merge.py`、`test_entity_classification.py` | [标签管理](TAG_MANAGEMENT.md) |
| 封面、头像、取景、缓存 | [cover_artwork.py](../src/peach/cover_artwork.py)、[jav_cover_fetch.py](../src/peach/jav_cover_fetch.py)、[avatar_provider.py](../src/peach/avatar_provider.py)、[jav_poster_crop.py](../src/peach/jav_poster_crop.py) | 搜索 `cover_artwork`、`poster_crop`、`avatar` | [封面](COVER_ARTWORK.md)、[媒体缓存](MEDIA_CACHE.md) |
| 播放、Range、转码、外部播放器、字幕 | [routes_media.py](../src/peach/routes_media.py)、[media.py](../src/peach/media.py)、[streaming.py](../src/peach/streaming.py)、[external_playback.py](../src/peach/external_playback.py)、[routes_subtitles.py](../src/peach/routes_subtitles.py) | `test_streaming.py`、`test_stream_lifecycle.py` | [外部播放器](EXTERNAL_PLAYERS.md)、[预览](VIDEO_PREVIEWS.md) |
| 关注、追更、来源连接器 | [web_follow.py](../src/peach/web_follow.py)、[follow.py](../src/peach/follow.py)、[follow_scheduler.py](../src/peach/follow_scheduler.py)、[follow_providers.py](../src/peach/follow_providers.py)、[sources/](../src/peach/sources/) | `test_follow_web.py`、`test_follow_scheduler.py`、`test_follow_providers.py` | [采集](SOURCING.md) |
| 想要、资源搜索、网盘下载、整理 | [wants.py](../src/peach/wants.py)、[resource_search.py](../src/peach/resource_search.py)、[downloads.py](../src/peach/downloads.py)、[download_postprocess.py](../src/peach/download_postprocess.py)、[organize.py](../src/peach/organize.py) | `test_downloads.py`、`test_downloads_postprocess.py` | [资源搜索](RESOURCE_SEARCH.md)、[CloudDrive](CLOUDDRIVE.md) |
| 后台任务、暂停、取消、资源与断点 | [jobs.py](../src/peach/jobs.py)、[task_runs.py](../src/peach/task_runs.py)、[task_control.py](../src/peach/task_control.py)、[web_tasks.py](../src/peach/web_tasks.py)、[job_recovery.py](../src/peach/job_recovery.py) | `test_jobs.py`、`test_task_control.py`、`test_task_center_integration.py` | `peach-batch-jobs` 技能 |
| 双机同步、唯一写入端 | [sync.py](../src/peach/sync.py)、[ledger_backups.py](../src/peach/ledger_backups.py) | `test_sync.py`、`test_sync_dirty.py` | [运行配置](OPERATIONS.md)、[运行边界 ADR](adr/0017-dual-host-local-runtime-and-sync-boundaries.md) |
| 升级、旧数据补修、修复回执 | [upgrade_repairs.py](../src/peach/upgrade_repairs.py)、[upgrade_rules.py](../src/peach/upgrade_rules.py)、[update_tasks.py](../src/peach/update_tasks.py) | `test_upgrade_repairs.py`、`test_update_tasks.py` | [测试](TESTING.md)、[运行配置](OPERATIONS.md) |
| React 页面、导航、共享状态、请求缓存 | [bootstrap.tsx](../frontend/src/react/bootstrap.tsx)、[application.tsx](../frontend/src/react/application.tsx)、[router/](../frontend/src/react/router/)、[application/](../frontend/src/application/)、[query/](../frontend/src/query/)、[shell/](../frontend/src/shell/) | [frontend/test/](../frontend/test/)、`test_frontend_build.py` | [前端](FRONTEND.md)、[组件契约](UI_COMPONENT_CONTRACTS.md) |
| 开发交付、选测、文档与上下文检查 | [agent_worktree.py](../scripts/agent_worktree.py)、[scope_registry.toml](../scripts/scope_registry.toml)、[check_context_budget.py](../scripts/check_context_budget.py)、[seiso.toml](../seiso.toml) | `test_context_budget.py`、`test_repo_hygiene.py` | [测试](TESTING.md)、[写作](WRITING.md)、[贡献](../CONTRIBUTING.md) |

## 关键调用路径

以下是追踪起点；分支、异常和具体状态转换继续读实现。

### HTTP 与 JSON

`api.create_app` 装配服务与路由。具名媒体、配置、字幕等路由先注册，
`routes_api` 的 catch-all 最后注册。多数 JSON 请求继续进入
`web_router.dispatch_api_get` / `dispatch_api_post`，经 `GET_HANDLERS` /
`POST_HANDLERS` 找到 `web_catalog`、`web_entity`、`web_follow` 等域处理器。
读写行为还受 `routes_api`、`READ_ONLY_POST_ROUTES` 和字段修订检查约束。

`web_contract.py` 主要是兼容再导出。查实现或设置 mock 时，继续追到定义该符号的域模块；
服务共享状态与 `WebContract` 本体在 `web_state.py`。

### 前端启动与页面请求

`frontend/src/react/bootstrap.tsx` → `mountApplication` → Application 与路由树。
页面实现从 `frontend/src/react/router/managed-routes.tsx` 继续追踪；
请求封装在 `frontend/src/api.ts`，应用控制器在 `frontend/src/application/`。
历史、Query 客户端和 shell 状态分别位于 `history/`、`query/`、`shell/`，
具体挂载与共享约束见 [FRONTEND.md](FRONTEND.md)。首启、登录、错误页另走独立页面包。

### 入库与字段写入

扫描入口包括 `scan_location` 和 `ingest_path`；ledger 与本机路径转换查 `platform.py`。
Web 处理器持有的 `WebContract.write_transaction` 委托给 `LedgerDatabase.write_transaction`；
字段级归属与修订冲突查 `field_owners.py`。来源证据、候选与人工结论的处理继续查
`metadata_policy.py`、`review_csv.py` 和对应域处理器，不能从“已获取资料”推断“已批准写入”。

### 后台任务与升级补修

任务 HTTP 入口从 `web_tasks.py` 追踪到 `jobs.py`、`task_runs.py` 和 `task_control.py`，
再追踪具体任务执行器及其检查点。升级补修由 `api.py` 装配 `UpgradeRepairs`，
规则标识与版本位于 `upgrade_rules.py`，执行与回执判断位于 `upgrade_repairs.py`。
修复旧结果时同时查生成者、缓存和补修回执，不能只验证新输入。

移动源码或改变入口时，核对对应导航行。架构和设计理由分别维护在 [ARCHITECTURE.md](ARCHITECTURE.md) 与 ADR 中。查找现有实现时可先看[复用清单](REUSE.md)。
