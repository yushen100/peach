# 参与 Peach

Issues and pull requests are welcome. Maintainer-authored changes follow the same PR workflow. Small fixes (bugs, copy, documentation, tests) can go straight to a PR; complex bugs and large changes — new features, default behavior, connectors, contract or data-layer changes, anything an ADR covers — should have an issue first. Read [`AGENTS.md`](AGENTS.md) before opening a PR: it is the single entry point for development rules, and reviews follow it. When you follow it, "I / the user", the ledger and production mean your own environment, and you commit under your own Git identity; fork PRs with commits authored as the maintainer fail CI. Issues follow the templates in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/); the terms and delivery format in `AGENTS.md` are for code changes only. Each platform has exactly one test entry point: `& .\scripts\test.ps1` on Windows and `./scripts/test.sh` on macOS/Linux. By submitting a contribution you agree to license it under AGPL-3.0-or-later. The rest of this document is in Chinese.

Peach 是单人自托管应用，由一个人维护。欢迎提 Issue 和 PR。维护者自己的改动也遵循同一套流程，通过 PR 保留审阅与验证记录。

- 小修（修缺陷、改文案、补文档、补测试）可以直接提 PR。
- 复杂缺陷和大改动（新功能、新页面、新连接器、默认行为、接口约定或数据层、涉及 ADR 的方向）先有 issue，复用已有问题记录。

提交贡献即表示同意以 AGPL-3.0-or-later 授权。

## 开 Issue

Issue 按 [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/) 的模板写：缺陷用 `bug_report.md`，建议用 `feature_request.md`。保留模板的章节标题和顺序，逐节填写；可选章节没有内容可以删掉，原因分析等额外信息放在模板章节之后。从网页「New issue」选模板最省事。用 AI 工具或命令行提交时，复制模板文件，去掉开头的 `---` 信息块和 `<!-- -->` 注释，填好后提交：

```text
gh issue create --repo peach-mitao/peach --title "<标题>" --type Bug --label area:web --body-file <填好的模板>
```

建议把 `Bug` 换成 `Feature`；没有设置类型的权限时省略 `--type`，按模板章节写的 issue 会自动补上类型。正文写给维护者和其他用户看，用通用技术说法；`AGENTS.md` 与技能里的术语和交付格式只用于改代码，不用于 issue。外部新 issue 无论通过网页、命令行还是 API 提交，缺少模板章节都会自动关闭；已有类型不豁免检查，按模板补齐章节后自动重开。

Write issues with the templates in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/): `bug_report.md` for bugs, `feature_request.md` for features. Keep the template headings in order and fill in each one; drop optional sections you have nothing for, and put extra material such as a root-cause analysis after the template sections. The web form under New issue is the easiest path. When an AI tool or the command line submits the issue, copy the template file, remove the leading `---` block and the `<!-- -->` comments, fill it in, and submit it with the command above; use `--type Feature` for features, and leave out `--type` if you lack permission to set it: issues that follow a template get their type automatically. Write for maintainers and other users in plain technical language; the terms and delivery format in `AGENTS.md` and the skills are for code changes, not issues. New external issues without template sections are closed automatically regardless of their submission method or existing type, and reopen once the sections are filled in.

模板检查只在新建或修改正文时执行，并在执行时读取当前正文和开闭状态。Issue 的看板变更每小时集中同步，新条目先通过模板检查再加入看板。已有条目因待补模板关闭时，关闭后的 2 小时内保持原位置；到期仍未补齐并重开，在后续同步时移到「已取消」。PR、主线提交与发布事件仍可触发同步，同样遵守这段缓冲。

公开截图、录屏和附件使用不含露骨画面的演示资料，并遮盖隐私信息；不要上传影片、封面原图或数据库。公开内容与素材许可要求见[文档规范](docs/WRITING.md#公开与私有记录)。

Use demo data without sexually explicit imagery in public screenshots, recordings and attachments. Redact private information, and do not upload videos, original cover images or databases.

- **报缺陷**：写清 Peach 版本或构建、系统版本及架构、安装方式、复现步骤、期望结果和实际结果，附上完整报错。无法稳定复现时说明发生条件，不要求自行判断根因。Python 版本仅用于源码部署，可选；`/healthz` 返回也可选，服务无法启动时写「无法访问」即可。贴日志或诊断报告前先遮盖本机路径、网络地址、账号及凭据。
- **提需求**：写清问题和使用场景。开放需求见 [公开路线图](https://github.com/orgs/peach-mitao/projects/7)，设计边界见 [总体架构](docs/ARCHITECTURE.md#明确不做)。涉及多用户、云托管、微服务或 PostgreSQL 的提案，先讨论是否需要新增 ADR。
- **安全问题**：不要开公开 issue，按 [`SECURITY.md`](SECURITY.md) 私下报告。

## Issue 处理规范

维护者和协助维护的智能体按本节处理 issue。回复跟随报告者的语言；提交模板及标签说明提供中英文。未经明确授权，不修改他人 issue 的标题、正文或评论；需要归纳时另写维护者摘要。已有 issue 的分类、关联、负责人和开关操作按当前任务授权执行，不因整理规范批量修改。

### 回复、提及与格式

- 首次回复简短确认问题，说明已确认的事实或尚待验证的判断，再给出下一步。需要补充信息时一次列出必要项目，不要求用户完成与问题无关的环境自查。
- 修复回复说明原因、修复内容、可下载的版本链接及验证范围。代码通过测试与原用户环境复测分别说明，不把推测写成已确认原因。
- 只有需要指定的人补资料、复测或处理时才 `@mention`，并说明具体动作；普通回复不重复提及，避免无关人员和团队通知。
- 标题简短描述现象，不堆叠类型、状态或版本前缀。正文用短段落和必要列表；日志用代码块，长日志用 `<details>` 折叠。截图、日志和诊断报告都先检查隐私信息。
- 链接使用明确文字，例如「0.40.1 下载」「修复 PR #123」；关联其他 issue 时说明关系。

### 右侧字段

| 字段 | 约定 |
| --- | --- |
| Type | `Bug`：异常行为；`Feature`：功能建议；`Task`：明确的维护任务。缺陷和需求模板分别设置 `Bug`、`Feature`，维护者创建的维护任务使用 `Task`。 |
| Labels | 按需补充 `platform:*` 平台、`area:*` 模块及 `status:*` 处理条件。多个受影响平台或模块可并列；不要猜测未确认的影响面。标签定义见 [标签清单](.github/labels.json)。 |
| Assignees | 指定实际认领并处理的人；未认领时留空，不把报告者当作负责人。 |
| Milestone | 只关联已确定的目标版本或阶段；没有发布承诺时留空。修复已发布版本同时在回复中给出链接。 |
| Projects / Priority | 仅在实际使用项目排期时维护；状态和优先级各选一个记录位置，不同时用项目字段和 label 重复表达。 |
| Relationships | 仅记录明确的父子任务和阻塞关系，不能根据相似标题推断依赖。 |
| Development | 关联实际修复该问题的 PR，不关联仅供参考或比较的 PR。 |

`status:needs-info` 表示缺少定位所需的信息，回复中应列明具体缺口；`status:needs-verification` 表示修复已有可下载版本，等待目标环境验证。两者互斥，条件消失时移除。未处理、处理中、已关闭不另设状态标签。没有明确影响的平台或模块可以留空。

`bug`、`enhancement` 保留给 PR 和未设置 Type 的 issue；使用 Type 的新 issue 不重复添加同义标签。`dependencies`、`javascript`、`github_actions`、`python:uv`、`docker` 用于对应依赖更新，`documentation`、`accessibility` 等按实际内容使用。标签名称保持稳定，颜色和双语说明以清单为准；修改清单时同步 GitHub 并回读核对，不批量删除或重命名已有标签。

维护者和协助维护的智能体在创建 issue 时选好 Type 和目标仓库中适用的标签。示例中的 `area:web` 适用于网页界面，其他问题按已确认的模块和平台选择。创建后读取 GitHub 右侧字段，确认 Type、标签与预期一致。若创建入口只能设置部分字段，创建成功后补齐剩余字段并回读。

Maintainers and their agents select an issue type and applicable labels from the target repository when opening issues. Use `area:web` for web interface work and choose platform labels only for confirmed impact. Verify the saved type and labels. If the creation tool cannot set all fields, update them after creating the issue and verify again.

### 关闭、重开与关联

- 修复已发布且有相应验证依据后，回复解决版本和验证结果，再以 Completed 关闭。原用户环境仍待确认时保持 Open，并使用 `status:needs-verification`；仅合并 PR 不作为已解决的依据。
- 同一问题在修复版本仍可复现时重开，补充版本与复现证据；不同问题另开 issue 并相互引用。
- 重复问题先链接到继续跟踪的 issue，说明重复依据，再以 Not planned 关闭；明确不在项目范围或不计划处理时说明原因，也以 Not planned 关闭，不把这些情况标成已修复。
- 等待信息时保持 Open，不因暂时没有回复自动关闭；不设置自动过期或批量关单流程。
- 修复 PR 和提交用普通编号引用，例如 `Refs #123`。本项目按发布与验证结果手动关闭 issue，不使用会在合入默认分支时触发自动关闭的 `Fixes #123`、`Closes #123` 或 `Resolves #123`。

GitHub 的字段与模板机制见 [Issue types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization)、[Issue 模板配置](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository) 和 [PR 与 issue 关联](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)。

## 提 PR 之前

先读 [`AGENTS.md`](AGENTS.md)，它是开发规则的唯一入口，PR 评审也按它执行。分支、暂存与提交的细则见 [`.claude/skills/peach-worktree/SKILL.md`](.claude/skills/peach-worktree/SKILL.md)。最容易踩到的三条：

1. 不用 `git add .`、`git add -A`、目录路径或通配符，只暂存这次改动的文件。
2. 实现和它的测试放在同一个提交里。
3. 一个 PR 对应可独立验收的目标。同一目标的实现、测试及必要的 CI、升级补修放在同一个 PR，按逻辑分提交并共享验证；无关需求独立评审，确需拆分时说明独立交付或隔离的理由。在「影响面」表里说明数据层、API、页面、契约、测试和文档的实际影响，不适用的写明原因。

### 创建 PR 时添加标签

维护者和协助维护的智能体按实际 diff 选择目标仓库已有的标签。缺陷修复用 `bug`，功能变化用 `enhancement`，纯文档用 `documentation`，依赖更新用 `dependencies` 及相应生态标签。补充已确认的 `area:*` 和 `platform:*`。用 `gh pr create` 时传入 `--label`，Draft 也一样。创建后回读 GitHub 标签。入口无法设置时立即用 `gh pr edit --add-label` 补齐，再回读。

Maintainers and their agents label pull requests, including drafts, according to the actual diff. Use labels available in the target repository, set them with `gh pr create --label`, and verify the saved labels. If creation cannot set labels, add them immediately after opening the PR.

### 变更性质与行为边界

修复说明具体触发、实际错误和既有预期的依据；新功能、主动调整默认行为或设计时说明使用场景、现有能力的不足与取舍，取得维护者对方向的确认。恢复已确认预期的修复按常规验证与集成流程处理。混合 PR 分别说明各部分，不能仅凭 `fix` 标题或测试通过判定为修复。

范围按实际资源和操作判断：同一作品不代表所有版本共享同一份图片；共享资源与独立资源分别验证。改变图片内容、数据归属或处理范围时说明对既有用户的影响，控制项按实际场景设计，不要求所有行为都新增开关。

### AI 参与与提交责任

允许 AI 辅助方案、代码、测试、文档和 PR 文字。使用时简短说明参与范围，以及提交者实际检查的内容；不要求提供提示词或模型名称。直接用 Git 提交时不需要加 AI 署名。

提交一律用你自己的 Git 身份（`user.name`、`user.email`），不要照仓库历史配成维护者。来自 fork 的 PR 里出现以维护者为作者的提交，CI 会拒收并给出重写命令。`AGENTS.md` 里的「我 / 用户」、ledger、生产和主检出，对你来说都指你自己的环境；你的 `integrate` 只合进你自己的 master，进上游仍要开 PR。

你也可以照维护者的工作树流程（`scripts/agent_worktree.py`）开发。这时署名门槛同样检查你自己的提交，要求写明智能体工具与模型，形如 `Co-Authored-By: 工具 (模型) <厂商 noreply 地址>`。所用工具未在 `scripts/co_author.py` 的 `VENDORS` 登记时，先单独提交一次登记（工具名加厂商公开的 noreply 地址，不用个人邮箱），并在 PR 里说明。

维护者采纳社区补丁时保留原作者为提交作者，用 `Source-PR`、`Original-Commit` 记录来源，不替贡献者补加 AI 署名。提交里的智能体署名表示提交者一侧智能体的改写或补充，只在它确实改动了代码时出现。署名门槛只检查本机提交者自己的提交，采纳的他人提交不检查，见工作树交付约定。

提交者对最终内容负责，能够解释设计与取舍，并核对代码、说明和验证结果。未运行的测试、跳过项、未取得的样本和待原环境验收的部分在「测试结果」中明确标注，不把推测写成已验证结论。维护者按影响和风险评审，授权与确认边界见 `AGENTS.md`。

是否使用 AI 不凭文风、标签或提交通道推断；反馈按事实、上下文和可追查证据处理。报告者无需先使用 AI 排查，也无需自行确定根因。

## 测试

每个平台只有一个测试入口：

```powershell
& .\scripts\test.ps1            # Windows
```

```bash
./scripts/test.sh               # macOS / Linux
```

不带参数时按改动的文件自动选测试范围，判断不了就跑全量。也可以手动指定范围，例如 `-Scope follow`（macOS/Linux 写 `./scripts/test.sh follow`），可选 `follow`、`catalog`、`media`、`sync`、`metadata`、`web`、`tooling` 等。跨多个范围、改数据库迁移、改共享测试设施、改依赖或大面积改动时，请用 `full` 跑全量。

脚本会自己找到虚拟环境并核对导入路径，不要手动拼 venv 路径或另写测试命令。测试框架是标准库 `unittest`。

## 前端改动

`frontend/` 需要 Node 24 或更高版本。

Node 脚本与测试写成 `.ts`（前端源码另有 `.tsx` 与少量 `.js`），由 Node 24 的类型擦除直接运行，不新建 `.mjs`、`.cjs`；本地模块按完整文件名导入，例如 `'../scripts/copy-check.ts'`。`tests/test_repo_hygiene.py` 会拦下 `.mjs`、`.cjs`。

运行 Peach 时不需要 Node，Python 服务和安装包直接读取构建好的 `web/dist/`，所以它要提交进 Git。改了 `frontend/src` 后，在同一个 PR 里运行 `npm --prefix frontend run build` 并提交 `web/dist/`；CI 的 `web-bundle` 任务会检查构建结果和源码是否一致。目录结构与样式约定见 [`docs/FRONTEND.md`](docs/FRONTEND.md)。

## 提交说明与变更日志

- 提交主题使用 `type(scope): 中文描述`，例如 `fix(web): 修正列表滚动`；类型与范围按项目提交检查器核对。
- 破坏性变化在主题里加 `!`，或写 `BREAKING CHANGE:` 脚注。
- PR 不用改 [`CHANGELOG.md`](CHANGELOG.md)。版本、变更日志与发布统一由 `scripts/release_tag.py` 处理，流程见 [运行与配置](docs/OPERATIONS.md)。

## 文案

- 文档职责、事实归属和界面提示遵循 [文档与界面文案](docs/WRITING.md)。正式测试入口执行 seiso 稳定规则；预览规则供人工复核。
- 文档、注释、界面文字和测试名一律用中文；代码标识、命令、协议名和库名保留英文。
- `scripts/` 下开发工具的新输出用 `t()`（`from peach.interface_text import dev as t`），文字写进 `scripts/locales/zh-CN/dev.json` 和 `scripts/locales/en/dev.json`，中英两份在同一个 PR 里写；写进日志文件的那一行用同一个键经 `dev_log` 渲染成英文。`tests/test_dev_text.py` 检查两份对得上。
- 只写现在的状态，不写「改动前后」的对比，也不保留被否掉的做法。`tests/test_copy_final_state.py` 会检查这一条；确实需要记录的事故原文，逐行加 `copy-lint-disable-line` 放行。
- 不要提交媒体、数据库、凭据、日志、构建缓存和个人信息（局域网地址、主机名、账号名、个人目录）。

## 翻译

界面翻译在 [Hosted Weblate](https://hosted.weblate.org/projects/peach/) 上进行，不用改代码，注册 Weblate 账号即可参与。

- 源语言是简体中文。英文由改代码的人随功能写进仓库；现有英文是 AI 初稿，在 Weblate 上带「AI draft」标签。发现不准确的地方，可以提建议，也可以给别人的建议投票，由审核者采纳。
- 其他语言直接在 Weblate 上翻译，没有的语言可以新建。翻到能用后，由维护者登记到设置的界面语言里。
- 术语按项目术语表（Weblate 上的 Glossary 组件）翻译，不用标为禁用的写法。新语言的术语表会自动列出全部定稿术语，建议先翻术语再翻界面。对术语有不同意见，在该条目下评论并说明理由。
- `{{count}}` 这类插值占位原样保留，不翻译，也不增删。占位不对的译文，Weblate 不会保存。
- 译文文件不要绕过 Weblate 直接改了提 PR，否则改动会和 Weblate 上的译文冲突。改代码时新增的界面文字按上一节，在同一个 PR 里写中文和英文。

Weblate 以 PR 的形式把译文推回仓库，提交作者是各位译者。这类 PR 只改 `resources/locales/` 下的译文文件，CI 通过后由维护者合入；不要压缩合并，以保留每位译者的署名。

Interface translation happens on [Hosted Weblate](https://hosted.weblate.org/projects/peach/); no code changes are needed. Simplified Chinese is the source language. English is written into the repository together with each feature; the current English is an AI draft and carries the "AI draft" label on Weblate, so suggest improvements or vote on other people's suggestions, and reviewers approve them. Other languages are translated directly on Weblate, and you can start a new one there; once it is usable, the maintainer adds it to the interface language setting. Follow the project glossary (the Glossary component on Weblate) and avoid terms marked forbidden; every new language gets all the approved terms in its glossary, so translating them first is a good start. If you disagree with a term, comment on it and explain why. Keep placeholders such as `{{count}}` exactly as they are; Weblate rejects translations with broken placeholders. Do not edit translation files in a PR that bypasses Weblate. Weblate sends translations back as pull requests authored by the translators; they only touch files under `resources/locales/`, and the maintainer merges them once CI passes, without squashing, so every translator keeps the credit.
