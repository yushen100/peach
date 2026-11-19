# ADR-0137：Windows 应用内更新校验发布摘要的 Ed25519 签名

- 状态：已采纳，客户端公钥已写入。首把公钥由 v0.59.0 发布作业输出，同版 GitHub 与 R2 清单均通过验签。
- 日期：2026-11-04
- 关系：补充 [ADR-0012](0012-version-and-update-boundary.md) 的更新边界、[ADR-0120](0120-standalone-update-client-compatibility.md) 的旧客户端兼容门槛与 [ADR-0127](0127-verified-release-artifact-promotion.md) 的晋级发布；macOS 的 Sparkle 签名见 [ADR-0130](0130-macos-sparkle-in-app-update.md)，两者密钥分开
- 参考：javm（MIT）提交 `db840dd` 与其 `docs/decisions/0035-auto-update.md`：发布清单 Ed25519 签名、公钥打进安装包、校验失败回退不升级。只借做法，不含其代码

## 背景

Windows 独立包的应用内更新由 `standalone_update.prepare` 完成：`release_updates.check` 合并 GitHub Releases API 与 `downloads.peach.video/releases.json` 两个来源，选出最高版本，给出更新包与完整包的地址、大小和 `sha256:` 摘要；下载后只核这份摘要。摘要与安装包来自同一渠道，渠道被篡改时（发布资产被替换、镜像被改写、受信任证书下的中间人）摘要会跟着一起换，校验拦不住。

两个来源的现状决定了签名对象：

- `releases.json` 由 `scripts/release_r2.py` 写，只在 GitGud 发布流程（`publish_gitlab_release.py`）里调用。10-28 发版回到 GitHub 后它不再更新，撰写时停在 0.50.0。签它保护不到当前任何一次更新。
- GitHub API 的资产行和 `digest` 由 GitHub 生成，Peach 签不了。
- 每个版本都有 `SHA256SUMS.txt`：`release.yml` 的 `release` 作业用 `sha256sum ./*.zip ./*-setup.exe ./*.dmg` 生成并上传，覆盖完整包、应用更新包、工具包、安装包与 DMG；`release_r2.py` 也给 R2 的每个版本目录写一份同格式的文件。

## 决策

**一、签名对象是每个版本的 `SHA256SUMS.txt`。** 签名写在同目录的 `SHA256SUMS.txt.sig`，与摘要文件一起作为 Release 资产上传。签名覆盖文件的原始字节，前面加固定前缀 `peach-release-sha256sums-v1\n`，同一把私钥签出的别的内容不会被当成发布摘要。签原始字节不需要规范化 JSON。文件名带版本号，旧版本的摘要文件列不出新版本的包；解压后 `build-info.json` 的版本还要与发布版本一致（已有检查）。

签名文件一行一个签名：`<公钥 base64> <签名 base64>`，都是 32 字节公钥与 64 字节签名的标准 base64。客户端只看公钥在受信任集合里的行，其余行跳过，所以轮换期可以并列新旧两把私钥的签名。

**二、公钥随源码发布。** `src/peach/release_signing.py` 的 `PUBLIC_KEYS` 是受信任公钥的元组，打包进独立包。格式与 Sparkle 的 `SUPublicEDKey` 相同（32 字节 Ed25519 公钥的 base64）。元组为空时更新器不要求签名，行为与之前一致；非空时这一版起的客户端只装签名验得过的版本。

**三、客户端在下载前校验。** `PUBLIC_KEYS` 非空时，`standalone_update.prepare` 在建事务目录、下载任何包之前取 `SHA256SUMS.txt` 与 `.sig`。两份文件按 `release_updates.download_sources` 的顺序，先取选中包所在的来源、再取另一个公开源的同版本目录，各自不超过 1 MB。有一个来源验得过，就用签过名的摘要替换更新包与完整包的 `asset_digest`、`full_digest`，API 行和 `releases.json` 给的摘要不再采信。工具包的摘要来自更新包内的 `update-manifest.json`，更新包验过之后它也随之可信。

两个来源都验不过，或摘要里没有选中的包，`prepare` 报「发布签名校验未通过，已停止更新；请到发布页手动下载新版本」，进入现有的 `error` 状态。已装版本、数据目录与事务目录都不动，用户可以重试，也可以从 `release_url` 手动下载。

校验放在 `prepare` 而不放在 `check`：`check` 被设置页与定时检查频繁调用，也被 ADR-0120 的 `update_compat.py` 拿旧版本代码原样调用。留在 `prepare` 里，定时检查不多发请求，兼容门槛也不需要签名私钥。代价是设置页可能先显示「有新版本」，点下载后才报签名错误；这只发生在渠道被篡改或发布出错时。

**四、发布端在 `release` 作业里签名。** 作业改用只允许 `v*` 标签部署的 `release` environment，私钥放在 secret `PEACH_RELEASE_SIGNING_KEY`（32 字节 seed 的 base64，与 Sparkle 私钥同一格式），经标准输入交给 `scripts/sign_release.py`，不落盘、不进日志。脚本的门槛：

| 源码的 `PUBLIC_KEYS` | secret | 结果 |
| --- | --- | --- |
| 空 | 空 | 跳过签名，只上传摘要，与之前一致 |
| 空 | 有 | 签名并用这次的公钥自验；用于第一个带公钥版本之前先发签名 |
| 非空 | 空 | 失败，不创建 Release：这一版起的客户端再也装不上未签名的版本 |
| 非空 | 有 | 每把私钥的公钥都须在 `PUBLIC_KEYS` 里，签完用客户端的 `verify` 按源码公钥核对 |

**五、轮换。** 允许多把公钥并存：

1. 生成新密钥；新公钥追加进 `PUBLIC_KEYS`，secret 里同时放新旧两把私钥（一行一把），签名文件各写一行。
2. 等仍要自动升级的客户端都升到带新公钥的版本（下限与 ADR-0120 的 `OLDEST_CLIENT` 同样显式决定），secret 只留新私钥，`PUBLIC_KEYS` 删掉旧公钥。
3. 旧私钥泄露时直接删旧公钥并停用旧私钥；只认旧公钥的客户端要手动装一次新版本，变更日志写明受影响的版本。

**六、过渡期。** 已装的 0.54.0 及更早版本、以及 `PUBLIC_KEYS` 为空时构建的版本不读 `.sig`，照旧按摘要升级；多出的两个 Release 资产不影响它们选包（`update_compat.py` 门槛照常运行）。第一个 `PUBLIC_KEYS` 非空的版本必须本身已签名，由第四条门槛保证。带公钥的客户端只会装比自己新的版本，它们都在门槛之后发布，所以不存在需要放行的未签名旧版本，客户端也不设「缺签名则放行」的分支，否则剥掉签名就能绕过。

R2 发布在同版本目录一并上传签名文件。签名缺失或未通过验签时，该来源不能提供可信摘要，客户端会尝试另一来源；两路都失败才停止更新。

**七、防护边界。** 签名挡得住发布资产被替换、镜像被改写和传输途中的篡改，挡不住能在 `release` environment 里运行标签工作流的人：他拿得到私钥，签出的版本客户端照样认。仓库与 environment 的访问控制仍是信任根的一部分。

## 依赖

Ed25519 用已锁定的 `cryptography==50.0.2`。它原是 `smbprotocol` 的传递依赖，Windows 独立包里已经带着；现在在 `pyproject.toml` 直接声明并登记导入归属。[REUSE](../REUSE.md) 里 `certs.py` 不用 `cryptography` 的理由是证书生命周期策略与 CA 安装方式，与签名校验无关。

## 已拒绝方案

- **签整份 `releases.json`。** 当前发布流程不写它，GitHub API 的行也不归 Peach 生成；签了也保护不到在用的来源，还要先定 JSON 的规范化字节。
- **在 `check` 里校验。** 见第三条：定时检查每次多两个请求，ADR-0120 的兼容门槛要为旧客户端代签，私钥就得进构建作业。
- **复用 Sparkle 的私钥。** 不用新配 secret，但 ADR-0130 写明那把公钥在 ad-hoc 签名下无法轮换；Windows 的信任根绑上去，泄露时两个平台一起失效，也失去本 ADR 的轮换能力。
- **minisign、signify 或 SSHSIG 格式。** 能用现成命令行验签，但客户端要多带一个解析器或外部工具；这里只需验一种文件，`cryptography` 已在包里。
- **GPG 签名。** 客户端要带 GnuPG 或 OpenPGP 解析库，密钥管理也比单个 Ed25519 seed 重。

## 需要维护者授权或决定的步骤

代码 PR 不生成、不保存、不上传正式私钥，也不改 GitHub secret。维护者按顺序完成：

1. 生成密钥对：在主检出运行 `scripts/sign_release.py --generate-key <私钥文件>`，私钥只写进该文件，输出只有公钥。私钥文件放进离线备份，不进仓库与数据根。
2. 把私钥写进 GitHub `peach-mitao/peach` 的 `release` environment secret `PEACH_RELEASE_SIGNING_KEY`（用 `gh secret set` 从标准输入读）。
3. 发布一个版本，确认 Release 资产里有 `SHA256SUMS.txt.sig`。
4. 把公钥写进 `PUBLIC_KEYS`，经 PR 合入。之后的版本由第四条门槛保证带签名。

## 未取得的证据

- **独立包里的 `cryptography` 能否导入 Ed25519。** `release_signing` 的导入写在函数里，PyInstaller 的静态分析会收集；`smbprotocol` 本已带入 `cryptography`。本地没有构建 Windows 独立包验证：未取得。
- **`release` environment 的保护规则。** 运维文档写明只允许 `v*` 标签部署；是否另有需要人工批准的规则（会让标签作业等待）：未取得。
