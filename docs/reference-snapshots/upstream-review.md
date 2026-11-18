# 上游依赖与参考来源复核

各节分别记录复核日期（Asia/Taipei）。本文件是人工复核笔记，不登记为可覆盖的上游快照；原文字节、哈希与 revision 见 [来源登记](../reference-sources.json)。

## amane 桥

### 采用稳定版 v0.28.0

2026-11-18 复核官方 [v0.28.0](https://github.com/sqzw-x/amane/releases/tag/v0.28.0)，固定到标签提交 `391af4fdc9fec4c7eb279ce8de53fbf693f09d5a`。[相对现有 v0.27.1 的差集](https://github.com/sqzw-x/amane/compare/ffaedbcdfa170c158bf457128f534f5b59365ec7...391af4fdc9fec4c7eb279ce8de53fbf693f09d5a)共 9 个提交。

桥的来源链消费两处修复。freejavbt 从 canonical 或 og:url 提取页面番号并与请求核对，拦住素人日期号重定向到另一来源作品的错配。makers（上游 official）增加 `_2.jpg` 横版封面到 `_1.jpg` 竖版海报的推导，继续支持 `-pl.jpg` 到 `-ps.jpg`，哈希文件名与其他序号不推导。Peach 继续把海报写入候选 extra，不更改身份核对、字段优先级与复核规则。

avbase、javdb 与 gfriends 的变更由 Peach 自有来源或演员层负责，桥只在自检中载入前两站。演员推送、图片裁切、桌面与 Docker 构建变化没有桥调用方。上游清单仅改版本并移除 only-managed 解释器偏好，字段模型、失败枚举及依赖约束相同。桥继续排除语义模型依赖，watchdog 受上游 `<7` 约束。

存量缓存没有绑定 amane 版本：正向快照只记 `PROVIDER_EVIDENCE`，无结果按站记在格式 3 的文件中。旧 freejavbt 从请求 URL 回报番号，日期号跨来源重定向后仍能通过客户端身份检查。升级补修 `amane-source-cache-1` 单独失效 freejavbt 下划线日期号快照、makers 缺少 `_2.jpg` 对应海报的快照及相应来源和封面缺失记忆，其他缓存保留；正文保留，未批准的旧 freejavbt 候选撤下并原样记入回执，人工候选和批准结果保留。已有升级回执也执行该规则，以独立任务键重新派发受影响作品，强制重采产生候选，真相字段继续按现有复核规则处理。回执先保存计划，文件处理失败后继续同一计划，随后取得的新快照与人工批准保留。平台制品和完整回归仍待安全审计通过后验证。

### 采用稳定版 v0.27.1

2026-11-14 固定到官方 [v0.27.1](https://github.com/sqzw-x/amane/releases/tag/v0.27.1)，提交 `ffaedbcdfa170c158bf457128f534f5b59365ec7`。[相对 v0.22.1 的差集](https://github.com/sqzw-x/amane/compare/fd9294fbe5b4aa88ce1df84d534f6816ad9460d5...ffaedbcdfa170c158bf457128f534f5b59365ec7)含 96 个提交。按桥开放给来源链的九站逐站读 diff：

| 站 | 上游改动 | Peach 侧 |
| --- | --- | --- |
| makers（`official`） | 新增 `plot`、`directors`（去掉 `---` 占位）、`extrafanart`；旧图片目录按 `-pl.jpg` → `-ps.jpg` 推导 `poster_urls`；单图条目从 `img/@src` 取封面 | 映射不变：导演进 `director`，剧情、海报、剧照进 `extra`，剧照可作样张来源 |
| mgstage | 前导数字番号检索落空时按尾号再检；`number` 仍取详情页地址里的品番 | 映射不变；`529STCV-605` 对 `STCV-605` 照常过身份核对 |
| airav | 番号比对与取值前剥除 caribbeancom、1pondo 等来源名前缀 | 映射不变；`number` 不再带来源名 |
| avsox、faleno、dahlia | 响应模型改用容忍 null 的 `ResponseModel` | 无影响 |
| prestige、fc2club、freejavbt | 无改动 | 无影响 |

桥另外登记的 11 站（dmm、giga、jav321、javbus、javlibrary、xcity 等）只在自检时载入类，不在来源链上。`MediaMetadata` 字段不变；`FailureReason` 取值不变，新增的 `EgressRejected` 只在 URL 协议不是 http(s) 时抛出，归 `unexpected`。桥不带浏览器后端，挑战页仍报 `cloudflare_challenge`。

运行依赖：numpy、onnxruntime、tokenizers 与 macOS CoreML 只被 `amane.semantic` 与 `amane.db.embeddings` 导入，桥清单用 uv 的 `exclude-dependencies` 排除；Windows 实测桥 venv 约 125 MB，与 v0.22.1 持平，不排除时为 242 MB。zhconv 换成 amane 包内字典，`scripts/amane_bridge.spec` 不再收集 zhconv，对应源码不再附 zhconv 的 sdist。watchdog 保持 6.0.0。

存量：受影响的采集字段只来自 mgstage、airav 的番号匹配。旧的「没有」记忆与来源快照都在 7 天后到期重问，不另做升级补修。

验证：清空 PATH 后离线自检载入全部 20 个站点类；真实查询 SSIS-001（makers、airav、avsox）与 STCV-605（mgstage），经 `split_report` 后 makers 给出导演、10 张剧照与剧情，mgstage 由尾号检索取回 `529STCV-605`。macOS 与 Docker 制品未在本机构建。

### 稳定版 v0.27.1 暂不采用

2026-11-14 复核官方 [v0.27.1](https://github.com/sqzw-x/amane/releases/tag/v0.27.1)，提交 `ffaedbcdfa170c158bf457128f534f5b59365ec7`。[相对 v0.26.0 的差集](https://github.com/sqzw-x/amane/compare/v0.26.0...v0.27.1)含 25 个提交。桥消费的站点类中，上文记为只在 main 分支头的修复已进入稳定版：makers（`official`）补剧情、导演、剧照与单图封面回退，mgstage 前导数字番号按尾号反查；javbus 改了无码海报，Peach 的 JavBus 走自有来源。运行依赖与 v0.26.0 相同，numpy、onnxruntime（macOS 以外）、tokenizers 与 macOS CoreML 仍为强制依赖，watchdog 仍为 `<7`。

继续固定 v0.22.1，恢复条件同 v0.26.0。本次在约束内更新桥锁：fastapi 0.162.7、anthropic 2.8.0、openai 3.51.0、pydantic-ai-slim 与 pydantic-graph 2.68.0、genai-prices 0.2.3、logfire-api 5.6.0、regex 2026.11.9、pydantic-settings 2.16.3、sqlmodel 0.0.50、annotated-doc 0.0.6；croniter 升到 7.0.0（MIT）。croniter 7 的大版本改的是调度表达式语义，只有 amane 调度器使用，桥自检路径不导入 croniter、watchdog、anthropic 或 openai。watchdog 保持 6.0.0。Windows 上按新锁构建独立可执行文件，清空 PATH 后离线自检载入全部 20 个站点类；macOS 与 Docker 制品未在本机构建。

### 稳定版 v0.26.0 暂不采用

2026-11-09 复核官方 [v0.26.0](https://github.com/sqzw-x/amane/releases/tag/v0.26.0)，提交 `faa389707325a80e13ce85fe149be94eb0cb61bb`。[相对现固定提交的差集](https://github.com/sqzw-x/amane/compare/fd9294fbe5b4aa88ce1df84d534f6816ad9460d5...faa389707325a80e13ce85fe149be94eb0cb61bb)含 71 个提交，其中 v0.25.0 之后 20 个。v0.25.0 之后桥消费的站点类只有 makers（`official`）一处提交：旧图片目录按 `-pl.jpg` → `-ps.jpg` 推导竖版海报，属于字段增强。发版审阅报告的 `1177fc57ee75a35032b4c0306f617cc255862bb3` 是 main 分支头，没有任何标签包含它；官网剧情、导演、剧照与单图封面回退，mgstage 前导数字番号按尾号反查，jav321、giga、xcity 的字段补全都只在该分支头，不在稳定版里。运行依赖与 v0.25.0 相同：numpy、onnxruntime（macOS 以外）、tokenizers 与 macOS CoreML 仍为强制依赖，watchdog 限制为 `<7`，zhconv 改为随包字典。

继续固定 v0.22.1；语义检索依赖改为可选，或桥接站点的修复进入稳定版后再升级。届时同批改 `scripts/amane_bridge.spec` 与 `scripts/build_amane_runtime.py` 中的 zhconv 收集和对应源码。桥环境的 watchdog 保持 6.0.0：上游自 [#560](https://github.com/sqzw-x/amane/pull/560) 起因 Windows 观察器依赖私有字段与 `stop()` 时序而声明 `<7`，现在升到 7.1.0，接入新版时必然退回；上游撤掉该上限后再升。桥不导入 watchdog。

本次在约束内更新桥锁：fastapi 0.162.2、pydantic 2.14.3、pydantic-core 2.50.4、click 8.5.1、anthropic 2.6.0、openai 3.46.0、jiter 0.19.0、logfire-api 5.5.0、regex 2026.11.7、w3lib 2.6.0。w3lib 2.6.0 新增 Zyte 的 [frostwork](https://github.com/scrapy/frostwork) 0.2.2（Apache-2.0，abi3 二进制，覆盖 Windows、macOS、Linux glibc 与 musl），用于编码探测；parsel 只用 w3lib 的 `replace_entities` 与 `HTML5_WHITESPACE`，amane 不直接引用 w3lib。Windows 上用 `build_amane_runtime.py --kind executable` 按新锁构建独立可执行文件，frostwork 已随包，清空 PATH 后离线自检载入全部 20 个站点类通过；macOS 与 Docker 制品未在本机构建。

### 稳定版 v0.25.0 暂不采用

2026-11-04 复核官方 [v0.25.0](https://github.com/sqzw-x/amane/releases/tag/v0.25.0)，提交 `f6c1cc9f54bca0fa5381a26d4b2e259df7f58a0a`。[相对现固定提交的差集](https://github.com/sqzw-x/amane/compare/fd9294fbe5b4aa88ce1df84d534f6816ad9460d5...f6c1cc9f54bca0fa5381a26d4b2e259df7f58a0a)含 51 个提交。桥消费的站点类中，`airav` 比对番号前先剥除 caribbeancom、1pondo 等来源名前缀；`avsox` 与 faleno、dahlia 共用的 `wp_works` 改用容忍 null 字段的 `ResponseModel`；makers（`official`）、prestige、mgstage、fc2club、freejavbt 没有提交。`amane.net` 新增出站通道与浏览器后端，桥不使用。运行依赖仍强制安装 numpy、onnxruntime（macOS 以外）、tokenizers 与 macOS CoreML，watchdog 限制为 `<7`，zhconv 改为随包字典。

继续固定 v0.22.1；语义检索依赖改为可选，或桥接站点出现必须的修复后再升级。本次在约束内把 pydantic-ai-slim、pydantic-graph 更新到 2.65.0，anthropic 到 2.4.0，openai 到 3.43.0，桥不调用它们的模型服务；watchdog 与上游一致保持 6.0.0。清空 PATH 后离线自检载入全部 20 个站点类通过。

### 稳定版 v0.24.1 暂不采用

2026-11-02 复核官方 [v0.24.1](https://github.com/sqzw-x/amane/releases/tag/v0.24.1)，提交 `7d037a44b17a147df1db20989ab96047f0935933`。[相对现固定提交的差集](https://github.com/sqzw-x/amane/compare/fd9294fbe5b4aa88ce1df84d534f6816ad9460d5...7d037a44b17a147df1db20989ab96047f0935933)含 31 个提交。桥消费的站点类中只有 `avsox` 改动，响应模型改为容忍 null 字段；`amane.net` 新增 BrowserSkill 浏览器后端，桥不使用。0.24 新增 numpy、onnxruntime、tokenizers 与 macOS CoreML 的语义检索运行依赖，会显著增大随包 amane 环境，上游同时把 watchdog 限制为 `<7`。继续固定 v0.22.1；桥接站点出现必须的修复，或语义检索依赖改为可选后再升级。本次在约束内更新传递依赖，watchdog 与上游一致保持 6.0.0；python-dateutil 升至 4.0.0 只经 croniter 进入调度器，桥消费的站点与网络模块不引用。清空 PATH 后离线自检载入全部站点类通过。

### 稳定版 v0.23.0 暂不采用

2026-10-30 复核官方 [v0.23.0](https://github.com/sqzw-x/amane/releases/tag/v0.23.0)，提交 `4230de458c3197e1e17b6c5b42cc385fc6961d15`。[相对现固定提交的差集](https://github.com/sqzw-x/amane/compare/fd9294fbe5b4aa88ce1df84d534f6816ad9460d5...4230de458c3197e1e17b6c5b42cc385fc6961d15)含 16 个提交、142 个文件，爬虫只改了 `theporndb`；桥消费的 makers、prestige、faleno、dahlia、mgstage、fc2club、freejavbt、airav、avsox 站点类和 `amane.net` 都没有变化，其余是 CLI、服务端与图片代理。继续固定 v0.22.1；桥接站点或网络接口出现修复时再升级。本次更新其约束允许的传递依赖，并核对独立环境的离线类加载。

### 稳定版 v0.22.1 的桥接范围

2026-10-26 静态复核官方 [v0.22.1](https://github.com/sqzw-x/amane/releases/tag/v0.22.1)，固定提交 `fd9294fbe5b4aa88ce1df84d534f6816ad9460d5`。[相对固定基线的差集](https://github.com/sqzw-x/amane/compare/cc42cee6ecf290cf05af1caa347d2dc2d5aeffcd...fd9294fbe5b4aa88ce1df84d534f6816ad9460d5)含 55 个提交。按桥直接消费的模型、站点、检索身份与网络接口判断采用范围；上游 main 的未发布提交不作为稳定发行依赖。

- `SearchQuery`、`FetchOptions`、`MediaMetadata` 与爬虫构造接口继续适用。AIRAV、FreeJavBT 的 FC2 写法，以及 MGStage 的数字前缀检索、简介、剧照和海报由桥消费；Peach 的独立 DMM、JavBus、JavDB、FC2 来源保持各自归属。
- 上游新增 `login_required`。桥保留这个原因，Peach 映射为 `auth_required`，使用既有认证等待与冷却契约；凭据缺失不写入确定无结果记忆。
- MGStage 的封面与海报分别投影；缺少字段不清空已有人工资料。素人条目的站点代名不产生规范人物身份。
- `WebClient.download` 的分块参数归属调整不影响桥使用的 HTML/JSON 查询接口；Peach 继续限制整个查询子进程的总时限，不引入上游下载、数据库、聚合或任务中心。

验收覆盖桥的离线类加载、失败分类、精确检索与候选投影，联网查询和报告者原场景分别记录；源码复核不表示全站或所有作品的可用性已验证。GPL-3.0、独立运行环境、子进程与对应源码分发边界沿用 ADR-0043、ADR-0124。

### v0.20.0 复核记录（2026-10-13）

采用 [amane 0.20.0](https://github.com/sqzw-x/amane/releases/tag/v0.20.0)，固定 revision `cc42cee6ecf290cf05af1caa347d2dc2d5aeffcd`，GPL-3.0。Python 下限仍为 3.14，桥以独立 venv 和子进程消费；不引入其数据库、整理、任务中心或界面。

[源码差异](https://github.com/sqzw-x/amane/compare/7a980aff9c503f7a5815864d62a6ef309a27808a...cc42cee6ecf290cf05af1caa347d2dc2d5aeffcd)共 29 个提交。适用于 Peach 的变化是 FreeJavBT、AIRAV 精确检索，AIRAV 详情解析及网络层指纹轮换。演员、kin8、giga、字幕、整理与超分的变化不扩展 Peach 来源链；每站唯一归属、身份核对、候选与结算仍由 Peach 管理。

实测：所有 20 个桥声明的爬虫类可导入，`SearchQuery`、`FetchOptions`、`MediaMetadata` 与 17 档失败原因兼容。真实解析器配合合成页面确认 AIRAV、FreeJavBT 精确命中 `ABW-032`，查 `ABW-03` 时不取相近条目；AIRAV 的标题、演员、厂牌、发行日、标签、剧情与封面可解析，片长为空，不采用固定试看时长。

只读在线查询 `ABW-032`：Prestige 2.48 秒、AIRAV 2.54 秒取得同一番号，FreeJavBT 5.32 秒明确未命中。Prestige 返回片长 190 分钟，AIRAV 不给片长；Prestige 配信日与发行日的分离仍按 Peach 既有规则处理。上游测试数据仓库请求为 HTTP 404，真实 fixture 未取得，合成页面不能作为该站所有作品均可抓取的证据。

`max_retries=1` 限普通失败重试；403/406 另可轮换三次 TLS 指纹，单个地址最多五次请求。Peach 保持整次查询 60 秒子进程总时限，超时终止并报可重试失败，不按尝试次数推导完成时长；桥不启用浏览器或 solver。公开请求的 TLS 行为沿用上游，未用于证明 Peach 生产 HTTPS 验收。

桥锁文件同时覆盖 PR #40、#42 的传递依赖要求：Mako 1.4.3、pydantic-ai-slim / pydantic-graph 2.55.0。没有新增直接依赖；传递更新包括 anthropic、openai、genai-prices，桥不调用它们的模型服务。

## amane 0.21.0 采用范围

2026-10-17 复核稳定版 [v0.21.0](https://github.com/sqzw-x/amane/releases/tag/v0.21.0)，
提交 `a2d45880e83df7047d461452965919692701e8c9`；桥清单仍固定 0.20.0，未执行运行依赖升级。
从固定提交到该版本的源码差异覆盖 DMM 图片路径、CID、数字前缀与 MGStage 搜索；
版本检查与实际接入必须分开判断。

| 能力 | 上游修复与 Peach 消费者 | 判断 |
| --- | --- | --- |
| 高清图片 | amane 生成 legacy 高清候选；Peach `jav_cover_fetch` 同时测 modern、legacy 与原始图的真实像素面积，保留最大官方图 | 保留 Peach 选图策略；上游补充的 mono/movie 分类目录与剧照路径可单独补回归 |
| DMM CID | amane 区分通贩与配信 CID，剥离门店前缀；Peach 正式 DMM 来源独立使用 GraphQL 与 `makerContentId` 核对 | 升级桥不会替换 Peach DMM；不直接套用全局去数字规则 |
| MGStage 搜索 | amane 生成搜索变体，精确命中优先，只有一个候选时才允许单边数字前缀差异；Peach 正式来源通过桥调用 MGStage | 桥升级的有效收益，须在独立升级中验证字段与错误契约 |
| 聚合与产品功能 | Peach 经桥使用 4 个社区站、5 个官方来源入口，不调用 amane 聚合、任务中心或前端 | 沿用固定上游版本加 Peach 领域策略，无需维护完整 fork |

pnpm 管理 amane 的前端依赖，Justfile 编排 uv、前端、测试与打包；它们不是桥运行依赖。
Peach 继续使用现有 npm 清单与项目命令入口。pnpm 的多工作树安装收益需实测，just 暂无独立消费者。

## Dependabot PR

PR #41、#43、#44、#45、#46、#47、#48 在隔离工作树按项目接管入口处理，保持一 PR 一提交。PR #43 的锁冲突保留主线 `pyahocorasick` 并采用 Pydantic 2.14.0，`uv lock --check` 通过。npm vendor、主界面与独立页面包按清单重建。

Motion 14.0.0 的大版本删除内部兼容 API。Peach 只通过 `motion` 公共入口使用，没有直接引用 `framer-motion`、`motion-dom`、`motion-utils` 或被移除的 timeline 内部 API；版本由其内部精确依赖保持一致，类型检查、组件与浏览器回归由项目完整测试入口核验。

轮播箭头几何用例在图片就绪后等待渲染阶段，再读位置；`ResizeObserver` 的异步测量不能由图片 `complete` 代替。位置、尺寸、黑边中心和桌面／手机断言保持完整。

## 依赖与参考来源判断（2026-11-14）

本次发版前审阅覆盖 weekly、monthly、quarterly，两份 npm 高危审计为零。Dependabot #520（Watchtower 1.24.0）保留原提交接管；对照两版源码，更新接口仍是 `POST /v1/update?async=true` 回 202，处理器只改内部包名，Peach 用到的四项设置不受新版启动校验影响。

Python 侧 fastapi 0.162.7（取消请求时的依赖清理修复）、filelock 4.2.10（含 GitLab CI 三处 `--with`）、sentry-sdk 2.75.0（新增 Bedrock 集成，锁内没有 boto3）、ruff 0.17.5，锁内 soupsieve 4.1、annotated-doc 0.0.6、pyinstaller-hooks-contrib 2026.10、urllib3-future 2.25.906 跟随。前端 Video.js 10.4.0（新增文本轨与进度条标记，修正跨包占位识别）、Lucide 1.72.0（所用 127 个图形字节不变）、driver.js 1.14.0、i18next 27.1.1、Motion 14.14.0、Vite 8.3.8、Oxlint 1.93.0、oxc-parser 0.158.0、Sentry Vite 插件 11.12.0、Playwright Core 1.65.1。driver.js 1.12.1 起新弹层默认聚焦「下一步」，Enter 不再结束引导。amane 桥见上文 v0.27.1。

| 来源 | 实测变化 | Peach 判断 |
| --- | --- | --- |
| amane 内容路由 | JavBus 封面与海报按根一一对应，跨根拼出的地址是另一部作品；厂牌官网竖版另有 `_2` → `_1` 推导 | 接受原文。Peach 的 JavBus 来源只取 `/pics/cover/` 封面，不做跨根海报推导 |
| BoardUI 主题 | 新增 `--color-kbd-subtle-background` | 接受原文。Peach 只取 `border-button-active`，该档未变 |
| Immich README | 标志图包一层链接并改 alt | 接受原文，无运行影响 |
| SakuraMedia README | 要求前后端同步升到 v0.15.0；macOS 安装包改为固定自签名证书 | 同类产品信息，接受原文 |
| Atlas README | v1.7.0 改为馆藏优先检索、标签推荐与单 Worker 部署 | 同类产品信息，接受原文 |

OpenAver 从 `32134b0ced66b4dbd8bf9da614a49900f73b7442` 前移到 `0079767e8dd2e33cb533ef91b7b1e42497544531`，62 个提交；相似推荐改为排除同一作品的其他版本并按作品去重，IDF 标签排除来源的 4K 标记。Peach 的相关推荐已由 `_one_card_per_release` 排除源作品番号并按发行合并，这次复核不改代码。PixivUtil2 仍停在 `46bb910cd60c213c9199d939859670a044450239`。FANBOX、OpenAver 两份人工笔记照旧不执行 `accept`。

## 依赖与参考来源判断（2026-11-09）

0.57.0 发版前审阅覆盖 weekly、monthly、quarterly。依赖按约束内最新稳定版更新：Python 侧 fastapi 0.162.2、pydantic 2.14.3（pydantic-core 2.50.4）、sentry-sdk 2.74.0、watchdog 7.1.0、zeroconf 0.154.0、filelock 4.2.9（含 GitLab CI 三处 `--with`）、ruff 0.17.4，锁内 click 8.5.1、pycryptodome 4.4.0 跟随。watchdog 7.1.0 的修正集中在 inotify 与 fsevents，`BaseObserver` 改用 `on_thread_start()`；推送发现只实例化 `Observer()`，不继承。filelock 4.2.9 只收紧读写锁的 `blocking` 参数类型，Peach 不用读写锁。pycryptodome 只经 maintenance-115 进入。前端 Lucide 1.70.0（所用 127 个图形字节不变）、Tailwind CSS 4.3.5（产物样式除版本头外不变）、TanStack Query 5.107.1、Motion 14.10.1、Vite 8.3.6、Oxlint 1.92.0、Playwright Core 1.65.0、Sentry Vite 插件 11.11.0。amane 桥见上文 v0.26.0。

| 来源 | 实测变化 | Peach 判断 |
| --- | --- | --- |
| amane 内容路由 | jav321 首图是竖版缩略、横版封面在快照序列；mgstage 前导数字番号按尾号反查；厂牌官网改述为有剧情与导演、旧目录可推导竖版、空导演写 `---`；xcity 需要站内 Referer；删去 giga 标签恒空的缺口说明 | 接受原文。描述的是上游 main 分支头的行为，桥仍固定 v0.22.1，运行时不受影响；Peach 来源链与 `docs/SOURCING.md` 没有引用被改写的断言 |
| OpenAver README | 新增 Linux 伺服器版、韩文界面与 AI 安装指引，删去部分功能说明 | 同类产品信息，接受原文 |
| SakuraMedia README | 加入 Star 链接 | 同类产品信息，接受原文 |
| JavBoss README | 下载链接升到 v2.1.5，新增应用内检查更新 | 同类产品信息，接受原文 |
| Atlas README | v1.6.0 新增统一通知中心、帮助中心与邮件队列，工作区改用 npm | 同类产品信息，接受原文 |

OpenAver 从 `67c410ca4465d4d107f940d9f0a9ece8395f0ad8` 前移到 `32134b0ced66b4dbd8bf9da614a49900f73b7442`，95 个提交；`core/similar/` 没有变化，相似推荐只有前端 `showcase/state-similar.js` 在隐藏未连线硬盘时保留另一份可用副本，Peach 没有这个概念，这次复核不改代码。PixivUtil2 仍停在 `46bb910cd60c213c9199d939859670a044450239`。FANBOX、OpenAver 两份人工笔记照旧不执行 `accept`。

## 依赖与参考来源判断（2026-11-05）

0.55.0 发版前审阅覆盖 weekly、monthly、quarterly。依赖按约束内最新稳定版更新：Python 侧 filelock 4.2.8（含 GitLab CI 三处 `--with`），锁内 soupsieve 4.0.1、typing-inspection 0.4.5 跟随；amane 桥锁内 pydantic-ai-slim、pydantic-graph 2.66.0，openai 3.45.0，SQLAlchemy 2.1.8，离线自检载入全部 20 个站点类；前端 Video.js 10.3.0（等待自动播放显示为正在起播、可配置倍速档位、嵌入适配器补缓冲条，Peach 不用嵌入适配器），Lucide 1.68.0（所用图形字节不变），Motion 14.9.1。amane 继续固定 v0.22.1，理由同上文 v0.25.0。

Dependabot #400（Docker 镜像内 uv 0.13.7）与 #401（watchdog 7.0.0）按接管入口各一提交。watchdog 7 的不兼容项不影响推送发现：本地通道不用模式匹配，只收 `created`、`modified`、`moved`、`closed`，新增的 `attrib` 事件被忽略。Windows 本地目录实测：7.0.0 送达事件比 6.0.0 晚约 1 秒，观察器停止前尚未送达的事件会丢；推送发现只缩短发现时间，定期全量扫描兜底，停止只发生在退出与改设置时，这个延迟可以接受。

| 来源 | 实测变化 | Peach 判断 |
| --- | --- | --- |
| Javinizer-Go README | `actress` 子命令新增 list、search 与 credit add | 同类产品信息，接受原文 |
| Atlas README | 原 `v3` 分支已删，改跟默认分支 `main`；版本号由 v4.x 重排为 v1.x，能力描述不变；`jav-utils.ts` 移到 `backend/src/services/` | 更新登记的分支与文件路径后接受原文 |
| JAVM README | 仓库 `ddmoyu/javm` 整个返回 404（删除或转为私有） | 保留 2026-11-04 的最后快照，档位改为 `manual`，只在点名时检查 |

OpenAver 从 `118f19330c49414a6b9dfa94581e3f731e4f8e5f` 前移到 `67c410ca4465d4d107f940d9f0a9ece8395f0ad8`，32 个提交；相关推荐的变化只在 `core/ai_services/` 的向量索引与设置页，Peach 没有向量路，这次复核不改代码。PixivUtil2 停在上次复核的 `46bb910cd60c213c9199d939859670a044450239`。FANBOX、OpenAver 两份人工笔记照旧不执行 `accept`。

## 参考来源判断（2026-11-04）

0.54.0 发版前审阅覆盖 weekly、monthly、quarterly，17 个来源报告漂移，另有 amane 运行依赖前移（见上文 v0.25.0）。15 份原文按完整 SHA-256 与 Git revision 接受；FANBOX、OpenAver 两份人工笔记不执行 `accept`。仅 revision 前移、内容相同的来源不重新登记。

| 来源 | 实测变化 | Peach 判断 |
| --- | --- | --- |
| Fluid tabs | 由带轨道的分段控件改为横向页签导航：改用索引 API，移除 surface 上下文，增加 `activeLabel`；选中面仍为 `spring.moderate`，悬停面仍为 `spring.fast` | 接受原文。Peach 只采用独立选中面与弹簧参数，两者未变；`segmented.tsx` 不跟随改成页签导航 |
| BoardUI input | 增加 `errorMessage`（React Aria `FieldError`）、`trailingAddon`，样式类抽成 `inputFieldClassName`、`hintTextClassName`；类名与状态配色不变 | 接受原文，Peach 消费的输入框配色与状态未变 |
| evilcharts registry | 新增 ECharts、Recharts 两套日历热力图组件与示例 | 接受原文；Peach 现有图表不使用热力图，留作候选 |
| amane 内容路由 | JavDB 无码条目与演员档案要求登录；jav321 改为 POST 检索并核对品番；AIRAV 收进 FC2 链尾并剥除来源名前缀；MGStage 竖版海报由封面地址推导；giga 同时只允许一个请求 | 接受原文。Peach 自有 JavDB 来源已识别登录页并上报 `auth_required`；桥仍固定 v0.22.1，不随文档切换路由 |
| amane README | 改为元数据服务定位，列出 25 个站点、Docker 与 Android | 同类产品信息，接受原文 |
| SakuraMediaBE README | 改为英文，新增 PolyForm Noncommercial 1.0.0 许可声明 | 接受原文。Peach 只引用行为证据，不复制其源码 |
| SakuraMedia README | 改为英文 | 同类产品信息，接受原文 |
| Javdex README | 许可证由 MIT 改为 GPL-3.0-or-later；新增 NAS 常驻、libmpv 播放与本地字幕生成说明 | 无直接消费者，接受原文 |
| JAVM README | 桌面宿主由 Tauri 改为 Neutralinojs，界面改为 React + Mantine，补充安装与迁移说明 | 同类产品信息，接受原文 |
| OpenAver README | 新增 AI 可写的自定义 YAML 来源与 NAS 片库连接，测试数改写为 3,300+ | 同类产品信息，接受原文 |
| Javinizer-Go README | `--force` 刷新保留人工选择，新增 `JAVINIZER_HOME` 与目标冲突文档 | 同类产品信息，接受原文 |
| JavBoss、AMMDS DOC、Immich、javranking-extension README | 下载版本号、文档目录、语言链接与仓库地址更新 | 接受原文，无运行影响 |

PixivUtil2 自上次复核的 `22b5fdc9fc83a976d8f4f6f6acbb4d2d3d542f21` 前移到 `46bb910cd60c213c9199d939859670a044450239`，五个提交为依赖更新与动态 GIF 头像，`PixivBrowserFactory.py` 没有变化；FANBOX 传输边界不变。

OpenAver 从 `502278a3e09c7520838ffb00b2ff080323a4cdcb` 前移到 `118f19330c49414a6b9dfa94581e3f731e4f8e5f`。相关推荐源码有变化：`3230465ce1` 在开关开启且有向量时，用 RRF 融合规则前 100 与向量前 30 后再做 MMR；`0347ac95e0`、`20f148dafe` 让 IDF 与倒排索引计入用户标签，并跳过非字符串标签。Peach 的 `related.py` 按账本中作品的标签实体计算 IDF，不区分来源标签与用户标签，也没有向量路；向量融合是否值得引入留作后续单独评估，这次复核不改代码。

## 参考来源判断（2026-10-13）

运行项目 `check_reference_updates.py check --diff`，覆盖 weekly、monthly、quarterly；manual 不在这次复核范围。47 个来源中 28 个未变化，19 个报告漂移，另有 amane 运行依赖前移。14 份原文按完整 SHA-256 与 Git revision 接受；5 份人工笔记保留。

| 来源 | 实测变化 | Peach 判断 |
| --- | --- | --- |
| Fluid springs、tabs | 名称与 import 从 Framer Motion 改为 Motion；弹簧参数未变 | 接受原文，Peach 已用 `motion` |
| Vercel report-design | 增加 Vercel 官方 Logo 下载说明 | 上游品牌专属，不采用其 Logo |
| Vercel web-interface-guidelines | 增加细指针设备页面 overscroll 建议与混合输入限制 | 保留现有滚动行为，这次复核不扩展为界面改动 |
| Bruno README | 增加 Hindi 翻译链接 | 接受原文，无运行影响 |
| amane 路由与 README | kin8 欧美归类、giga 会话与 Referer、欧美日期号年份形态及称呼 | 锁定证据，Peach 仅使用已接入来源 |
| OpenAver README | 女优排行 Top 25 | 原文接受，不改 Peach 排行数量 |
| SakuraMediaBE README | 新增番号解析开源项目致谢 | 仅参考出处，不新增依赖 |
| SakuraMedia README | VR 外部播放与插件市场说明 | 同类产品信息，不导入其播放协议 |
| JavBoss README | v2.1.2 下载与设置路径说明 | 同类产品信息，不改变 Peach 部署 |
| MDCz README | 平台、安装包、便携数据与自动更新说明 | 保留 Peach 既有分发和运行边界 |
| Cuelume README | press/release、unlock、卸载绑定与关闭声音语义 | 候选参考，无直接消费者，不安装 |
| Atlas README | 女优资料来源改用 JavBus，注明 minnano-av 反爬 | Peach 有自己的传输与来源冷却，不以 README 声明推断本机站点故障 |

PixivUtil2 从 `fc0f9adf44e590dde9242b3755b53528f159720a` 前移到 `22b5fdc9fc83a976d8f4f6f6acbb4d2d3d542f21`，三个提交处理 FFmpeg 8+ 动图转换、`x-userid` 登录身份和独立错误日志。`PixivBrowserFactory.py` 只增登录 ID 赋值，Peach 采用的公开 FANBOX 传输边界不变；保留既有取证 revision，不复制登录逻辑。

OpenAver 从 `8cc17e50453d9f69a81f5fee1a072df80f7aab73` 前移到 `502278a3e09c7520838ffb00b2ff080323a4cdcb`，共 318 个提交；相关推荐源码未变化。DMM 采用代理 session、连通探测与失败分类，GraphQL 查询取法不变；Peach 参考声明式来源和公网目标守卫，使用受限 JSON 适配器。桌面路径继续由 `platform` 处理，相关推荐保留固定算法证据。

`fiu758-studio-logo-discovery`、`rule34-follow-tags-and-collections` 的漂移是人工笔记与动态 HTML 的比较；`f95-masked-gofile-media` 返回的脚本哈希与笔记记录相同，协议未变化。这三份和 FANBOX、OpenAver 的人工笔记均不执行 `accept`，避免被网页或脚本字节覆盖。

## 采用的应用行为

| 能力 | Peach 实现与边界 |
| --- | --- |
| 实体收藏与命名筛选 | 资料页、标签页和目录入口；复用 `profile.settings_json`，收藏跟随规范身份与合并事务，筛选可保存、打开和删除 |
| 来源诊断 | 正式 amane 来源逐站选择直连或公共代理；连接结果区分代理、超时、限流、验证页与服务错误，显示耗时和冷却；诊断把连接与解析分开 |
| 比较图按需请求 | 复核卡点击后加载，30 秒超时可重试；换来源重置请求状态 |
| 声明式来源 | [单步 JSON 配置](../CUSTOM_SOURCES.md)，公网地址固定连接、严格 TLS、响应番号核对、低置信度候选；不复制 OpenAver 的 HTML/YAML 规则 |
| 外部播放器与 VR | [限时网络链接与 M3U](../EXTERNAL_PLAYERS.md)，设备可使用 VLC/IINA 协议；实际投影与解码由播放器负责 |
| 分卷与整理 | 复用同一版本分卷连播、模板预览、目标冲突跳过和整批回滚，不引入第二个规划器 |

Python 最低与默认版本为 3.14；CI 保留 Windows/macOS 系统与独立 wheel 消费，前端类型、lint、
组件验证在 `web-bundle` 集中执行，本机正式入口完整验证。amane 仍使用独立锁与子进程，
只消费爬虫和网络层；其任务中心、数据库、整理、超分和 AI 服务没有接入 Peach。

本任务未执行真实数据整理、合并或删除。静态、组件、桌面及手机浏览器和生产运行的验收结果
以项目验证记录及 [运行与配置](../OPERATIONS.md) 为准。
