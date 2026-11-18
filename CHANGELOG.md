# Changelog / 变更日志

Notable changes in each Peach release. English and Chinese describe the same behavior: every line puts English first, then ` / `, then Chinese. Release notes and the in-app update notes split each line at the first ` / `, so English is the main text and Chinese sits in a folded 简体中文 section. / 本文件记录 Peach 每个发布版本里值得使用者知道的变化，中英文说同一件事：每行英文在前，` / ` 之后是中文。Release 正文与应用内的更新说明都按第一个 ` / ` 拆开，英文是正文，中文折叠在「简体中文」段里。

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). Groups are `Added / 新增`, `Changed / 变更`, `Deprecated / 弃用`, `Removed / 移除`, `Fixed / 修复` and `Security / 安全`. / 格式遵循 [Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/spec/v2.0.0.html)；分组标题见上。

Each entry starts with an area tag on both sides; groups sort by the nature of the change, tags by where users see it. Tags are limited to Interface / 界面, Playback / 播放, Library / 馆藏, Sourcing / 采集, Review / 复核, Following / 关注, Settings / 配置, Updates / 更新, Desktop / 桌面 and Ledger / 账本. / 每个条目两半都带区域标签：分组按变化性质分，标签按使用者看到的区域分，取值限于上面十个。

Version numbers move only at release points: every `X.Y.Z` has downloadable artifacts, and other commits on the main line are identified by commit (ADR-0012). `## [Unreleased]` collects changes already merged but not yet shipped. `0.7.0`–`0.7.2` predate the release workflow, and versions within `0.8`–`0.29` came from local integration bumps; neither has artifacts, so see Git history for those. / 版本号只在发布点推进，每个 `X.Y.Z` 都对应可下载的制品，主线其它提交由 commit 标识（ADR-0012）。`## [Unreleased]` 收已进主线、还没发出去的变化。`0.7.0`–`0.7.2` 早于发布工作流，`0.8`–`0.29` 的版本号由本地集成推进产生，都没有制品，逐条变化见 Git 历史。

`python scripts/changelog.py` drafts entries from commit subjects; a person rewrites them for users, including the English half the draft leaves as `TODO`. Commits that only touch development (docs, tests, refactors, builds) stay out. / 条目草稿由 `python scripts/changelog.py` 从提交主题生成，措辞由人改成使用者读得懂的话，草稿留作 `TODO` 的英文也由人写；只改开发过程的提交（文档、测试、重构、构建）不进本文件。

Entries are written for users to scan: one sentence each, saying where something changed and what you now see; reasons, implementation and edge cases stay in commits and PRs. Changes to one feature become one entry, bigger ones first within each group. After the area tag, English stays within 160 characters and Chinese within 80, counting only displayed text; `release_tag.py` refuses to release while any released entry is longer. Release titles carry only the tag name, and the body ends with the Full Changelog link to the previous release. Entries after 0.58.0 end with their source number (#issue, or the PR number without an issue; `owner/repo#number` for other repositories) on both sides, including the Unreleased section; tests and releases refuse entries without one. / 条目给使用者扫读：每条一句话，写在哪儿看到了什么变化，原因、实现和边界情况留在提交与 PR。同一功能的几处改动合成一条，每组里影响大的排前面。标签之后英文不超过 160 个字符、中文不超过 80 字，只算显示出来的文字；任一已发布条目超长，`release_tag.py` 都拒绝定版。Release 标题只写标签名，正文末尾附到上一版的完整变更链接。0.58.0 之后的条目两半句末都带来源编号（#issue，没有 issue 就写 PR 编号；别的仓库写 `owner/repo#编号`），「Unreleased」段写进去时就要带，缺了测试与定版都会拒绝。

## [Unreleased]

### Added / 新增

- **Interface**: Right-click cards and table rows for item actions, use the Library action column, or delete from the icon group under a work's title (#773). / **界面**：卡片与表格行可右键操作，馆藏列表新增操作栏，作品详情的删除入口放在标题下方的按钮组（#773）。

## [0.59.0] - 2026-11-18

### Added / 新增

- **Sourcing**: Opt in to sharing public metadata and submit Chinese performer names for review before they enter the public seed pack (#768). / **采集**：可预览并自愿贡献公开元信息，也可提交女优中文名，经复核后随种子分发（#768）。
- **Review**: Select individual duplicate files for Trash, confirm the remaining count, and undo the selected disposal (#739). / **复核**：重复文件可逐份勾选回收，确认时显示保留数，处置后可撤销（#739）。
- **Review**: Junk files with the same name and size collapse into expandable groups while retaining individual actions (#719). / **复核**：垃圾队列将同名同大小的候选折叠展示，展开后可逐份处理（#719）。
- **Interface**: Searchable column filters extend to subscriptions, aliases, cleanup, review and diagnostics tables, with rating and resolution filters in Library (#754). / **界面**：订阅、别名、清理、复核和诊断表格补齐列头筛选，馆藏新增评分与分辨率筛选（#754）。
- **Review**: Junk review combines video frames, promo text, QR codes, size and duration, with protection for advertising intros (#750). / **复核**：垃圾复核综合多帧画面、推广文字、二维码、大小和时长，保护带广告片头的视频（#750）。
- **Library**: Table headers offer multi-select filters with search, pagination, select-all and exclusion controls (#744). / **馆藏**：列表列头支持搜索、多选、分页、全选与排除筛选（#744）。
- **Interface**: Customize and reorder sorting options across library and discovery views, with release-date sorting on Home (#744). / **界面**：馆藏与发现页可自定义排序项及顺序，首页支持按发行时间排序（#744）。
- **Library**: Delete profiles individually or in batches, with choices to keep works, move them to Trash or permanently delete their media (#738). / **馆藏**：资料页与名册多选支持删除档案，可选择保留作品、移入回收站或连同媒体永久删除（#738）。
- **Interface**: Deleting media, whole profiles, full sources or large cleanup batches needs a two-second hold with progress fill and release to cancel (#738). / **界面**：删除媒体、整份资料、完整来源或大批清理项需按住两秒，按钮显示进度，提前松开可取消（#738）。
- **Interface**: Click to remove list members, tags, history entries and draft rows, with existing confirmation and undo actions (#738). / **界面**：列表成员、标签、单条历史和草稿行用单击移除，保留现有确认和撤销操作（#738）。
- **Following**: A SimpCity post with several images shows all of them in Following details, in post order, with the existing image carousel (#575). / **关注**：SimpCity 一层楼有多张图时，关注详情按正文顺序列出全部图片，可以轮播切换（#575）。
- **Sourcing**: Scan and collection can Fill in covers only without metadata lookups, and Background tasks settings cap each run's requests, time and downloads (#589). / **采集**：扫描与采集新增「仅补全封面」，不查影片资料；「后台任务」里可调每趟的请求次数、时长和下载上限（#589）。
- **Library**: Details can re-collect one video's metadata from every source without the cache; fields you edited or approved stay (#208). / **馆藏**：详情页可对单部作品重新采集资料，不用缓存，你改过或批准过的字段不被覆盖（#208）。
- **Sourcing**: An optional setting uses JavDB's watermarked image when no other cover exists; official and local covers still come first (#531). / **采集**：新增可选设置：没有别的封面时用 JavDB 带水印的图补上，官方与本地封面始终优先（#531）。
- **Library**: See performer names in Japanese, romanization or the interface language, or show Japanese and localized names together in either order (#682). / **馆藏**：女优名可显示日语原文、罗马音或随界面语言变化的译名，也可任选顺序并列显示原文和译名（#682）。
- **Review**: Review can select every item in the current filter across pages with Select all, not just the page on screen (#216). / **复核**：人工复核可用「全选全部」一次选中当前筛选下所有页的项目，不再只能选本页（#216）。
- **Interface**: Settings can make Home show only videos with a preview image, kept after refresh and when returning Home; Show all next to the count shows everything (#196). / **界面**：设置里可让首页只显示有预览图的作品，刷新与回首页后仍生效；读数旁的「显示全部」可临时看全部（#196）。
- **Interface**: Settings > Playback can turn off hover previews on cards; hovering then shows only the still image and requests no stream (#170). / **界面**：设置「浏览与播放」可关掉「卡片悬停时播放视频预览」，关掉后悬停只显示静态图，不再请求视频流（#170）。
- **Library**: Junk files can move every undecided file in the current category to Trash at once, beyond the 200 loaded, with undo (#218). / **馆藏**：垃圾文件可把当前分类的待判断文件一次全部移入回收站，不限已载入的 200 条，可撤销（#218）。
- **Interface**: Resize the sidebar with pointer or keyboard and remember its width, with reset and cancel controls (#743). / **界面**：侧栏支持拖动与键盘调宽、记忆宽度、重置与取消操作（#743）。
- **Library**: Duration filters offer one-minute sliders and decimal-minute inputs, with explicit upper limits from 180 minutes onward (#743). / **馆藏**：时长筛选提供一分钟步长与小数分钟输入，明确的 180 分钟及以上上限保持有效（#743）。
- **Library**: Profile name menus can merge duplicate actress, label, creator, series and agency profiles; a new alias that another profile already uses offers it too (#207). / **馆藏**：女优、厂牌、创作者、系列与事务所的名字菜单可合并重复档案，添加的别名已被另一份档案使用时也会提示合并（#207）。
- **Library**: Edit details next to the title changes the code, title, date, region, performers, label, series and tags; edited values aren't overwritten by collection (#187). / **馆藏**：详情标题旁新增「编辑资料」，可改番号、标题、日期、产地、演员、厂牌、系列与标签，改过的值不再被采集覆盖（#187）。
- **Library**: Performers, labels and series not found in Edit details can be created on the spot and carry a Custom tag in rosters and details (#549). / **馆藏**：编辑资料里搜不到的演员、厂牌、系列可直接新建，名册与详情上带「自建」标记（#549）。
- **Library**: Edit details can replace the cover with an upload, the player's current frame or a sample; it stays in place and the scraped cover can be restored (#187). / **馆藏**：编辑资料可换封面：上传图片、取播放器当前画面或选样张，换上的封面不再被替换，可恢复刮削封面（#187）。
- **Updates**: When an update is available, Check for updates lists each newer release's highlights with linked issues, in the interface language (#680). / **更新**：检查到新版本时，「检查更新」按界面语言列出之后每一版的重点，附 issue 链接（#680）。
- **Sourcing**: Wants checks for sources on a schedule; cards with no result show the check date, and found links are listed on the card (#650). / **采集**：「想要」清单定时给待找作品查资源，没查到的卡片注明日期，查到的链接直接列在卡片上（#650）。
- **Playback**: On phones and remote devices, the detail page's external player menu lists that platform's players, such as VLC, MX Player or Infuse (#584). / **播放**：手机和远程设备上，详情页的外部播放器菜单按平台列出 VLC、MX Player、Infuse 等，点开即调起（#584）。
- **Playback**: Playlists and Mix move on to the next item; Settings > After playback can stop, loop the list, shuffle or repeat one (#659). / **播放**：播放列表和 Mix 播完一条自动接下一条，设置「播完之后」可改为停下、列表循环、随机或单片循环（#659）。
- **Interface**: Settings can turn off new releases on home and person pages, the shorts strip, avatar rows, missing-art hints, empty-search picks and import notices (#660). / **界面**：设置里可分别关掉首页与人物页的新作、竖屏短片带、头像两排、缺图补全提示、空搜索推荐与入库通知，横幅关掉后不再反复出现（#660）。
- **Settings**: Settings that depend on a switch collapse or gray out when it is off, and remote access cannot start without an access password (#660). / **配置**：上级开关关掉后，依赖它的设置随之收起或变灰；未设访问密码时远程访问不能启动（#660）。
- **Settings**: Subscription feed fetching can be turned off or given its own interval, like automatic checks for follows (#661). / **配置**：Peach 配置里的「订阅源拉取」可以关掉或改间隔，和关注的自动检查一样（#661）。
- **Settings**: First-time setup offers the interface language on its first page and switches the page right away; the choice carries over to Peach (#709). / **配置**：首次设置第一页即可选界面语言，选后整页换成该语言，进入 Peach 后沿用（#709）。
- **Settings**: Wants recheck interval and give-up count, ledger backup count, log retention days and the transcode quality cap are adjustable (#661). / **配置**：「想要」老片的再查间隔与放弃次数、账本备份份数、日志保留天数和播放转码的画质上限都能在 Peach 配置里调了（#661）。
- **Playback**: On phones and tablets, tap shows controls, double-tap seeks or pauses, long-press plays at 2x, and dragging sideways previews a seek (#156). / **播放**：手机和平板上轻点显示控制条，双击两侧快进快退、中间暂停，长按临时 2 倍速，横向拖动预览后跳转（#156）。
- **Playback**: On phones and tablets, holding the left double-tap area pauses the picture and rewinds the target 2 seconds per second, jumping there on release (#684). / **播放**：手机和平板上按住画面左侧双击区，画面停住、目标每秒回退 2 秒，松手跳过去（#684）。
- **Playback**: With a mouse, holding the left button on the picture speeds up (or rewinds on the left side) and dragging sideways previews a seek, like touch (#585). / **播放**：鼠标左键按住画面同样临时倍速（左侧为回退），横向拖动预览定位，和触屏一套手势（#585）。
- **Playback**: Immersive mode gains hold-to-speed-up, a subtitles menu and a full-screen button that turns landscape videos sideways, and Back now leaves it (#585). / **播放**：沉浸模式可长按临时倍速，新增字幕菜单与全屏键（横版片自动横屏），返回键也能退出沉浸（#585）。
- **Playback**: Playback settings adjust hold speed, drag span and double-tap width, disable gestures, or auto-fullscreen landscape videos on phones (#156, #618). / **播放**：「浏览与播放」可调长按倍速、拖动跳转幅度和双击区宽度，关闭手势，或在手机上自动全屏播放横版视频（#156、#618）。
- **Playback**: Settings > Playback can turn on Chinese subtitles from the video's directory for videos whose subtitles you haven't picked yet; off by default (#428). / **播放**：设置「播放」里可打开「没选过字幕的影片自动打开同目录的中文字幕」，默认关（#428）。
- **Playback**: Holding the Right arrow key plays at 2x until released (#275). / **播放**：按住右方向键临时 2 倍速，松开恢复原来的速度（#275）。
- **Library**: Duplicates supports multi-select; kept groups no longer come back when a copy goes missing, and can be restored from Kept (#690). / **馆藏**：重复文件页支持多选，保留过的组不再因少一份而重新出现，可在「已保留」里取消（#690）。
- **Interface**: Wants, HD upgrades, junk files, the profile online view, rosters and online tags support multi-select; the queue page gets the select toggle (#690). / **界面**：想要、高清升级、垃圾文件、资料页在线视图、名册与在线标签支持多选，处理队列页接入右上角多选开关（#690）。
- **Sourcing**: With Browsing history checked in the userscript, works and performers you open count toward discovery recommendations, as do downloads you add (#691). / **采集**：用户脚本勾选「浏览记录」后，打开过的作品、女优计入发现页推荐，用户脚本加入下载的作品也算（#691）。
- **Sourcing**: Find sources also lists JavBus magnets, merged with the other sources by hash (#704). / **采集**：查找资源新增 JavBus 磁链，与其他来源按哈希去重合并（#704）。
- **Desktop**: With LAN access on, Peach also accepts IPv6 connections from the local network and publishes the .local name over IPv6 (#239). / **桌面**：开放局域网访问时同时接受局域网内的 IPv6 连接，.local 名字也能解析到 IPv6 地址（#239）。

### Changed / 变更

- **Interface**: Junk files, HD upgrades, Duplicates and Trash use the home filter bar, discovery cards and list, with a Library column and sortable size and duration (#737). / **界面**：垃圾文件、高清版、重复文件与回收站改用首页的筛选浮层、探索卡与列表表格，可按体积和时长排序并显示媒体库（#737）。
- **Interface**: Tag management moves to Tags, and adding a blocked tag suggests existing names and aliases (#740). / **界面**：标签管理统一到「标签」页，添加屏蔽标签时按名称和别名显示候选（#740）。
- **Sourcing**: Resources on out-of-library details come from every magnet source, not only JavDB, and still load while JavDB is down (#717). / **采集**：库外详情的资源改查全部磁链来源，JavDB 不可用时照样列出（#717）。
- **Sourcing**: New FC2 works take details from FC2 and its archives, and FC2, uncensored and amateur covers fall back to issuer and community pictures (#717). / **采集**：FC2 新作资料先问 FC2 与存档站；FC2、无码与素人新作封面可改用发行方与社区图源（#717）。
- **Interface**: When JavDB doesn't answer, discovery cards and out-of-library details fill in from DMM and r18.dev (#717). / **界面**：JavDB 没答上时，发现页卡片与库外详情改用 DMM、r18.dev 的资料（#717）。
- **Library**: Official sample images for censored works come from r18.dev when DMM has none (#717). / **馆藏**：有码作品的官方样张在 DMM 没有时改从 r18.dev 补（#717）。
- **Interface**: Work details note what's missing in place (cover, sample video or details) instead of a red banner; a failed page shows a centered empty state (#722). / **界面**：作品详情取不到的内容改在缺的那块说明（封面、预告或资料），不再显示红色横条；整页失败显示居中空状态（#722）。
- **Following**: Subscriptions skip an actress's JavDB censored page while her DMM catalogue fetches fine (#704). / **关注**：女优的 DMM 片单抓取正常时，订阅跳过她在 JavDB 的有码页（#704）。
- **Sourcing**: Scheduled Wants checks skip JavDB once manko already has 1080p or better (#704). / **采集**：「想要」定时查找在 manko 已有 1080p 以上时不再问 JavDB（#704）。
- **Sourcing**: Complete work details fetched after release are kept as local metadata instead of being refetched (#704). / **采集**：发行后取齐的作品资料留作本地资料，不再定期重取（#704）。
- **Sourcing**: Single and batch connection checks test r18.dev, JavDB, JavBus and MGStage image hosts and mark sources without a fixed host as unchecked (#377). / **采集**：「检查连接」与「全部检查」也查 r18.dev、JavDB、JavBus 和 MGStage 的图片主机，没有固定图片主机的来源标为未检查（#377）。
- **Library**: Tags in details and Following details are read-only; add or remove them in Edit details, or with Edit tags at the end of the tag row (#187). / **馆藏**：详情与关注详情的标签平时只读，增删分别移到「编辑资料」和标签行尾的「编辑标签」里（#187）。
- **Interface**: Regions read Japanese, Korean, Chinese and Western in the English interface (#187). / **界面**：英文界面的产地统一写作 Japanese、Korean、Chinese、Western（#187）。
- **Interface**: Batch actions ask for confirmation first, and the reversible ones offer Undo (#690). / **界面**：批量操作都先确认再执行，能撤回的带撤销（#690）。
- **Playback**: Titles closed near the end start from the beginning next time; the threshold is in Settings > Restart near end (#659). / **播放**：接近片尾时关掉的作品，下次打开从头播；剩余比例在设置「片尾从头播」里调（#659）。
- **Playback**: When the browser can decode HEVC, the original file plays directly instead of being transcoded first (#616). / **播放**：浏览器能解 HEVC 时直接播放原文件，不再先在服务端转码（#616）。
- **Playback**: On Windows with Intel graphics, transcoding keeps decoding, scaling and encoding on the GPU, using far less CPU (#238). / **播放**：Windows 上用 Intel 显卡转码时，解码、缩放与编码全程在显卡上完成，CPU 占用大幅下降（#238）。
- **Playback**: TS and M2TS recordings with browser-playable video are repackaged as MP4 once instead of being re-encoded during playback (#220). / **播放**：视频流浏览器能解的 TS、M2TS 录像整片换封装成 MP4 播放，不再边播边重新编码（#220）。
- **Playback**: MKV and other H.264 videos with an unsupported container or audio try the original file first, then keep the video stream instead of re-encoding (#158). / **播放**：容器或音轨不兼容的 MKV 等 H.264 视频先试原文件，放不了再改用保留视频码流的分片，不再整段重新编码（#158）。
- **Playback**: Immersive mode in the top bar picks videos from the current page and returns there when closed; Trash no longer plays trashed files (#669). / **播放**：顶栏的沉浸模式按当前页面抽片，关掉后回到原页；回收站页不再播回收站里的文件（#669）。
- **Playback**: Software transcoding of a whole video uses at most half the CPU cores, so other playing videos are not slowed down (#174). / **播放**：服务端软件转码整部视频时最多占一半 CPU 核，同时在播的视频不再被拖慢（#174）。
- **Playback**: New videos start at the volume last set in this browser instead of 100% (#161). / **播放**：新打开的视频从这台浏览器上次调过的音量起播，不再每次都是 100%（#161）。
- **Updates**: The changelog and release pages put English first; Chinese notes and downloads are folded by language (#680). / **更新**：更新日志与发布页改为英文在前，中文说明和下载说明按语言折叠（#680）。
- **Sourcing**: Bundled userscript 0.7.18 shows the source, Peach’s retry reason and local time, for example “tonight 21:39” (peach-mitao/peach-userscript#40). / **采集**：随附用户脚本 0.7.18 显示重试来源、Peach 给的原因和时间，如「今晚 21:39」（peach-mitao/peach-userscript#40）。
- **Sourcing**: The userscript gives the main button its own row and pairs other actions with icons, two to a row (peach-mitao/peach-userscript#38). / **采集**：用户脚本浮卡主按钮单独一行，其余操作带图标两个一行（peach-mitao/peach-userscript#38）。
- **Sourcing**: The userscript puts notices at the top of its floating cards and every button at the bottom (peach-mitao/peach-userscript#37). / **采集**：用户脚本浮卡里的提示统一排在最上方，按钮都在最下面（peach-mitao/peach-userscript#37）。
- **Sourcing**: The userscript scrolls codes and performer names that don't fit back and forth within the panel row (peach-mitao/peach-userscript#34). / **采集**：用户脚本浮卡里放不下的番号、女优名改为在行内来回滚动（peach-mitao/peach-userscript#34）。
- **Updates**: Repairs and migrations is grouped by kind, and repairs awaiting your OK can be started all at once or a group at a time (#723). / **更新**：「修复与迁移」按类分组，等确认的修复可一次全部开始或按组开始（#723）。

### Fixed / 修复

- **Sourcing**: Retry affected FreeJavBT matches and maker posters after upgrading the metadata bridge (#772). / **采集**：升级资料桥后，定向重采受影响的 FreeJavBT 匹配和片商海报（#772）。
- **Desktop**: LAN discovery selects a real interface when a tunnel owns the default route and keeps valid private-network routes (#726). / **桌面**：局域网发现避开占用默认路由的隧道接口，保留有效私网路由（#726）。
- **Sourcing**: Local NFO files accept unescaped ampersands while preserving UTF-16, CDATA text and original file bytes (#725). / **采集**：本地 NFO 可读取未转义的 &，保留 UTF-16、CDATA 文本和原始文件字节（#725）。
- **Review**: Duplicate review shows covers and full filenames when space allows, with highlighted name and path differences (#739). / **复核**：重复文件显示已有封面，空间足够时显示完整文件名，名称和路径差异按复核样式高亮（#739）。
- **Review**: Software dependency files and ordinary course folders containing “App” stay out of promotional junk candidates (#719). / **复核**：软件依赖文件和名称含普通 App 字样的课程目录不再误判为推广垃圾（#719）。
- **Library**: Junk review preserves release artwork and FC2 bonus clips alongside the main movie (#752). / **馆藏**：垃圾复核保留作品封面、九宫格和与正片并存的 FC2 特典（#752）。
- **Interface**: Filter text actions use standard buttons. Single-file trash uses a click, bulk trash confirms with a hold, and number labels remain editable (#752). / **界面**：筛选文字动作统一标准按钮，单文件单击回收，整批确认长按执行，带数字的按钮文案可编辑（#752）。

- **Library**: Starting playback reuses catalog, folder and junk caches while watched counts stay current; repairs follow configured roots (#718). / **馆藏**：起播复用编目、目录和垃圾缓存，观看统计及时更新，补修只处理当前配置的媒体根（#718）。
- **Settings**: When the data folder can't be written to, diagnostics no longer resend the same error every time it happens (#331). / **配置**：数据目录写不进去时，错误诊断不再在每次发生时重复上传同一个错误（#331）。

- **Interface**: Table filters gray out offline libraries and show standard loading feedback at the bottom while fetching options (#751). / **界面**：表格筛选中的离线媒体库置灰，下拉读取与续页时在列表底部显示标准加载态（#751）。
- **Interface**: Multi-select action bars stay above the sidebar and page content (#690). / **界面**：多选操作浮条置于侧栏和页面内容上方（#690）。
- **Interface**: The userscript's floating panel keeps its position and appearance on pages with sidebar styles (peach-mitao/peach-userscript#41). / **界面**：网页的侧栏样式不再挤压用户脚本的悬浮面板（peach-mitao/peach-userscript#41）。

- **Sourcing**: Retrying download organization keeps completed previews and metadata and reports the current attempt's result (#730). / **采集**：重试下载后的整理会保留已完成的预览和资料，并按本次处理结果结算（#730）。
- **Library**: Upgrading fixes profile links containing `&amp;` and shows archive, blog and catalog link names in the interface language (#715). / **馆藏**：升级会修正地址含 `&amp;` 的资料页链接，官网存档、博客、作品页等链接名随界面语言显示（#715）。
- **Updates**: Upgrading fixes FC2 sellers saved as labels, garbled FC2 titles, labels and series saved under aliases, and retired and old NFO tags (#715). / **更新**：升级会修正记成厂牌的 FC2 卖家、乱码 FC2 标题、写成别名的厂牌和系列，以及退役标签与旧 NFO 标签（#715）。
- **Updates**: Upgrading fixes duplicate Blu-rays in New releases, Wants a cover marked as acquired, and stale cloud download notes (#715). / **更新**：升级会修正「新作」里的重复蓝光版、因封面误标为已到手的「想要」和过时的云下载说明（#715）。
- **Updates**: Repairs and migrations asks you to approve fixes for unverified FC2 cast from JavDB, descriptions saved as performers and code folders saved as creators (#715). / **更新**：「修复与迁移」在确认后才修正 JavDB 填入但未核实的 FC2 演员、误作女优的描述和误作创作者的番号目录（#715）。
- **Updates**: Peach backs up the ledger before fixing confirmed duplicates in file records or r18.dev profiles created from English names (#715). / **更新**：确认后修正重复文件记录和 r18.dev 英文名建成的重复实体，执行这些修复前会备份账本（#715）。
- **Interface**: The guided tour lines up with its tabs, keeps its buttons on the left and fits each tab's content; subscription stat figures sit on one line (#729). / **界面**：新手教程的引导区与页签对齐、按钮统一靠左，窗口高度随页签内容伸缩；关注管理顶部读数的数字对齐在同一条线上（#729）。
- **Following**: Older rule34video characters and rule34.xxx tag types, upload times and video lengths are filled in the background after upgrade (#723). / **关注**：旧版漏记的 rule34video 角色与 rule34.xxx 标签分类、上传时间和视频时长，升级后在后台自动补齐（#723）。

- **Settings**: Cloud download works with a CloudDrive2 token limited to a folder instead of saying the folder or offline capability is missing (#211). / **配置**：CloudDrive2 令牌限定了根目录时云下载照常可用，不再报找不到文件夹或云下载能力未取得（#211）。
- **Library**: NFO files, posters and screenshot thumbnails that older versions listed as works leave the collection on upgrade; the files stay on disk (#715). / **馆藏**：旧版当成作品登记的 NFO、海报和截图缩略图升级后移出馆藏，盘上文件不动（#715）。
- **Library**: Avatars installed while the face model was unavailable get face framing after upgrade, using only local images (#715). / **馆藏**：人脸模型不可用时装上的头像，升级后补上按脸取景，只读本机图片（#715）。
- **Ledger**: Docker and peach serve also prune old ledger backups, and one upgrade writes a single pre-upgrade backup instead of one per repair (#715). / **账本**：Docker 与 peach serve 也按保留份数清理账本备份，一次升级只写一份升级前备份（#715）。
- **Ledger**: Failed task records, empty crash logs, repair resume files and processing state files no longer pile up; upgrading clears the backlog (#715). / **账本**：失败的任务记录、空崩溃日志、补修续跑文件和处理状态文件不再越积越多，升级时清掉旧版积下的（#715）。
- **Desktop**: If resuming interrupted tasks gets stuck, Peach sets that round aside after five minutes and keeps resuming the other tasks (#144). / **桌面**：接回中断任务卡住时，五分钟后放下那一轮，其余任务照常接回（#144）。
- **Sourcing**: DMM and FANZA connection checks use the same catalog API as collection, so age-check redirects no longer appear as sign-in requirements (#144). / **采集**：DMM 与 FANZA 的连接检查使用与采集相同的目录 API，年龄确认跳转不再被误判为需要登录（#144）。
- **Sourcing**: Videos that already have a usable cover no longer re-ask every source each run when an official source is blocked; they wait a week and log a note (#144). / **采集**：已有可用封面的影片在官方来源被拦时，不再每趟把来源全问一遍，改为一周后再试并留一条告知（#144）。
- **Library**: Link check retries links that time out, are throttled or hit a server error a few times, and marks the ones still failing as temporary (#566). / **馆藏**：链接检查对超时、限流和服务器故障的链接自动再试几轮，仍打不开的注明是临时故障（#566）。
- **Sourcing**: When one source answers, the reasons other sources failed (timeout, throttling, refusal, image download) stay in the run log and diagnostics (#573). / **采集**：有来源答上时，其余来源超时、限流、被拒或图片下载失败的原因照样留在运行日志和诊断里（#573）。
- **Sourcing**: The background collection browser no longer jumps to the front; Sources settings can switch it to no window, where a failed check pauses that source (#309). / **采集**：后台采集浏览器不再跳到前台；「来源与采集」里可改为无窗口，验证过不了就暂停该来源（#309）。
- **Interface**: Wide or edge-to-edge site icons in round slots keep their whole mark instead of losing both ends or the corners (#576). / **界面**：横向或顶到边的站点图标放进圆形位置时完整显示，不再被裁掉两头或四角（#576）。
- **Sourcing**: Background jobs no longer use your JavDB account, so it isn't suspended for browsing too fast; a suspension shows its resume time (#702). / **采集**：后台任务读 JavDB 不再带登录账号，免得账号被判浏览过快停用；账号被停时提示停的是账号和恢复时间（#702）。
- **Sourcing**: When browser adds pause for search, they name the source being waited for, and account suspensions say resume times like "at 21:39 tonight" (#716). / **采集**：浏览器添加因搜索暂停时点名在等哪个来源，账号停用的恢复时间写成「今晚 21:39」（#716）。
- **Sourcing**: Refused sources show who and for how long instead of asking for a new cookie, and one paused source no longer stalls a browser batch (#702). / **采集**：来源被拒时点名并写明暂停多久，不再一律让人更新 Cookie；某个来源暂停时浏览器添加不再整批干等一天（#702）。
- **Library**: Once every video with a problem in the last scan has been cleaned up by Resource sync or marked missing, its alert and floating notice go away (#166). / **馆藏**：上一趟扫描出问题的影片都被资源同步清掉或标为已消失后，那条告警和悬浮提示自动撤下（#166）。
- **Sourcing**: Retry and later processing runs skip Check companion files for videos whose folders haven't changed, instead of rereading every NFO (#587). / **采集**：「立即重试」和之后的处理任务里，文件夹没变过的影片不再重读 NFO，「检查配套文件」快很多（#587）。
- **Sourcing**: Garbled titles left by older versions are repaired or re-collected after upgrading, including ones with no recorded source or approved in review (#208). / **采集**：旧版留下的乱码标题升级后自动修复或重新采集，含没记来源和复核时批准过的（#208）。
- **Following**: Sources of one author whose name is only kana, such as on fanbox and pawchive, group together again after upgrading (#290). / **关注**：作者名只含假名时，同一作者在不同站上的来源归回一组，升级后自动合并（#290）。
- **Library**: Directory-site profile matching ignores Japanese and Chinese character forms (有岡 and 有冈); people are never merged automatically (#559). / **馆藏**：目录站人物资料匹配不再受日文与中文字形差异影响（有岡与有冈），不会自动合并人物（#559）。
- **Library**: A creator nickname followed by digits in a creator folder is no longer recorded as a release code without other release evidence (#572). / **馆藏**：创作者目录里的「昵称加数字」没有其他发行证据时，不再被记成番号（#572）。
- **Library**: Avatar crops follow their source picture, so a replaced cover drops the old crop; a merged entry's old avatars become choices (#565). / **馆藏**：头像裁剪框跟着源图走，封面换图后不再套用旧框；合并人物后可选被合并条目的旧头像（#565）。
- **Library**: Recognize codes such as S2M-009, S2MCR-08, CW3D2DBD-14 and IBW-483z from filenames, and collect KIRARI MKD-S codes (#124). / **馆藏**：文件名可识别 S2M-009、S2MCR-08、CW3D2DBD-14 和 IBW-483z，也可采集 KIRARI MKD-S（#124）。
- **Playback**: A subtitle picked by hand from the video's directory is remembered for that video again; before, the choice failed to save (#428). / **播放**：手动选的同目录字幕重新能按影片记住，之前这一选择存不上（#428）。
- **Library**: JAV details no longer fail with an error while JavDB is cooling down; they keep earlier data and offer a retry (#701). / **馆藏**：JavDB 冷却期间打开 JAV 详情不再报错，沿用上次取到的资料并可重试（#701）。
- **Library**: DMM video previews in JAV details play again after DMM moved them to a new host (#697). / **馆藏**：DMM 换了预告视频的主机后，JAV 详情里的 DMM 视频预览重新能播（#697）。
- **Library**: Spineless covers (VR, streaming-only sets, SOD two-panel art) are no longer cut in half; large cards use DMM's portrait, and SOD prefers the DVD sleeve (#538). / **馆藏**：VR、配信限定合集、SOD 双栏这类没有书脊的封面不再被切掉一半，大图改用 DMM 竖版正封，SOD 优先用 DVD 封套（#538）。
- **Library**: Cover crops follow the code printed on the spine, so the front panel no longer keeps a strip of spine or loses its left edge (#538). / **馆藏**：正封按书脊上印的番号定位切点，不再带进一截书脊或切掉正封左边（#538）。
- **Library**: Promotional covers with titles crossing the fold show in full, and large cards frame the largest person in the image (#538). / **馆藏**：标题横跨切线的宣传封面整张显示，大卡对准画面里最大的人物主体（#538）。
- **Library**: Upgrading re-crops old covers with the new rules and uses DVD sleeves in the background, with progress in Repairs and migrations (#538). / **馆藏**：升级后在后台按新规则重切旧封面并换用 DVD 封套，可在「修复与迁移」查看进度（#538）。
- **Sourcing**: Blu-ray editions in New releases merge into their DMM streaming edition, so they get the official cover and no longer appear twice (#694). / **采集**：新作里的蓝光版并入 DMM 配信版，能取到官方封面，也不再和配信版重复列出（#694）。
- **Playback**: In immersive mode, clicking the video with a mouse pauses and resumes again; the click used to toggle twice and do nothing (#585). / **播放**：沉浸模式用鼠标点画面重新能暂停与继续，此前一下单击切两次等于没切（#585）。
- **Sourcing**: New releases keeps all results when a subscription finds more than 20, and upgrades restore works dropped by the old limit (#667). / **采集**：订阅单次查到超过 20 部新作时全部保留，升级会补回曾被旧上限截掉的作品（#667）。
- **Interface**: Idle text placeholders no longer run their shimmer, so phones stop warming up on pages full of cards (#675). / **界面**：文字占位不在加载时不再跑微光动画，满屏卡片的页面不再让手机持续发热（#675）。
- **Interface**: Cards in JAV Discover and New releases no longer grow as they scroll into view, so the page stops jumping (#594). / **界面**：JAV 发现与新作往下滚时，卡片不再进屏才长高，页面不会被挤得跳动（#594）。
- **Library**: The Keep dropdown in Merge tags under tag management shows its options again (#187). / **馆藏**：标签管理里「合并标签」的「保留」下拉能看到选项了（#187）。
- **Playback**: When a cloud drive hangs, playback, thumbnails, subtitles, Show in folder and delete fail within 10 seconds instead of spinning or stalling the server (#689). / **播放**：网盘卡住时，播放、缩略图、字幕、打开所在位置和删除都在 10 秒内报错，不再一直转圈，也不再拖垮整个服务（#689）。
- **Ledger**: Play counts, ratings and task progress keep updating when a cloud rename hangs, a writer stalls or a JavDB lookup's task is paused (#683). / **账本**：网盘改名卡住、写入方卡死或 JavDB 查询所在任务被暂停时，播放计数、评分和任务进度不再跟着停住（#683）。
- **Desktop**: Tray startup, ledger sync, update checks and shutdown time out on a hung subprocess or drive instead of never starting or stopping (#687). / **桌面**：托盘启动、同步 Ledger、检查更新和服务关停遇到卡住的子进程或网盘时到期中止，不再一直起不来或停不下（#687）。
- **Library**: With a hung drive, organize, rollback, batch intro fixes and timeline thumbnails fail the stuck title, finish the rest and honor cancel (#688). / **馆藏**：网盘挂死时整理、回滚、批量修复片头和时间轴缩略图不再一直停在运行中，卡住的那部记失败、其余照做，取消也能生效（#688）。
- **Library**: Resource sync checks and runs no longer stay running; unreadable folders are skipped, progress moves per folder and cancel takes effect (#655, #668). / **馆藏**：资源同步的检查与执行不再卡在运行中，读不了的网盘目录记为读不了并跳过，进度按目录更新，取消能及时生效（#655、#668）。
- **Library**: A scan or backfill cancelled from the recovery entry no longer makes a later Backfill library finish immediately (#668). / **馆藏**：在恢复入口取消过的扫描与补全，不再让之后的「补全已入库影片」一点就结束（#668）。
- **Library**: A hung drive mount no longer stalls new-file discovery and cloud-download import, and a paused follow or feed round no longer blocks later checks (#685). / **馆藏**：网盘挂载卡住时新文件发现与云下载入库不再停摆，关注、订阅有一轮被暂停也不再挡住之后的定时检查（#685）。
- **Library**: The post-upgrade repair that copies details between copies of a code scans the library once and no longer holds the ledger for long (#690). / **馆藏**：升级后的同番号照抄补修整库只扫一遍番号，不再长时间占住账本写入（#690）。
- **Playback**: Fullscreen on phones and tablets rotates to landscape and restores on exit; iPhone native fullscreen stays in sync (#664). / **播放**：手机和平板点全屏后自动转成横屏，退出时恢复；iPhone 原生全屏的状态也能同步（#664）。
- **Interface**: Cover, avatar and photo placeholders no longer match the surface they sit on in the dark theme (#690). / **界面**：封面、头像与照片格的占位底在暗色下不再和所在的面同色（#690）。
- **Sourcing**: The userscript no longer reports words like File05 in titles, or uncensored codes on MISSAV and Jable, as conflicts (peach-mitao/peach-userscript#34). / **采集**：用户脚本不再把标题中 File05 这类词及 MISSAV、Jable 无码番号误报为冲突（peach-mitao/peach-userscript#34）。
- **Sourcing**: MGStage codes with an extra numeric prefix and AIRAV codes carrying the source name are found; studio sites add director, plot and stills (#653). / **采集**：MGStage 番号前多一段数字、AIRAV 番号带来源名的作品能查到了，片商官网另取导演、剧情与剧照（#653）。
- **Sourcing**: DMM titles sold in parts (such as SORA-613A) are searched and added by the full-title code, and codes with a trailing letter reach source search (#662). / **采集**：DMM 分段发售的作品（如 SORA-613A）按整片番号搜资源和添加，带尾字母的番号能进资源搜索（#662）。
- **Updates**: Check for updates hides unusable packages for source, Docker and up-to-date installs, and leaves space above the installer note (#663). / **更新**：源码运行、Docker 或已是最新版时隐藏用不上的下载内容，安装包下载说明与上一行留出间距（#663）。
- **Library**: TMA codes like `T28-612` and `T38-076` are recognized; such videos already in the library get their code and metadata on the next processing (#656). / **馆藏**：认出 TMA 的 `T28-612`、`T38-076` 这类番号，已入库的此类影片下次处理时补上番号和资料（#656）。
- **Sourcing**: The userscript recognizes codes starting with T28 and T38 on pages such as JAVtiful (peach-mitao/peach-userscript#35). / **采集**：用户脚本能认出 JAVtiful 等页面上 T28、T38 开头的番号（peach-mitao/peach-userscript#35）。
- **Library**: Later copies of the same title get its cast and creators, FC2 titles get their seller after metadata lands, and existing ones are filled on upgrade (#681). / **馆藏**：同一部片后入库的副本补上演员和创作者，FC2 作品资料落库后自动挂上卖家，已入库的升级后补一次（#681）。
- **Review**: Performers written as "family given" on studio sites, and Western stage names, land automatically instead of holding the row in Review (#681). / **复核**：片商官网写成「姓 名」的演员与欧美艺名能自动落库，不再整行留在复核队列（#681）。
- **Library**: Video enhancement model tags such as `_prob4` no longer become part of creator names, aliases or search terms (#681). / **馆藏**：视频增强软件的模型代号（如 `_prob4`）不再算进创作者名，也不再登记成别名和搜索词（#681）。
- **Sourcing**: Codes left with only a cover image after the video is deleted can be added to Wants, and an early cover no longer marks a want as acquired (#681). / **采集**：视频删掉后只剩封面图的番号能加入「想要」，先到的封面图也不再把想要标成已到手（#681）。
- **Sourcing**: Mark all as read in the userscript's other tasks no longer hides failed or not-found items; those are dismissed one by one (#686). / **采集**：用户脚本「其他任务」的全部标为已读不再收起失败和未找到资源的项，这类要逐条确认（#686）。
- **Desktop**: Peach starts again when the browser adding queue file is unreadable; bad rows are dropped and the original file is kept beside it (#548). / **桌面**：浏览器添加队列文件读不懂时 Peach 照常启动，无效行丢弃，原文件留在旁边（#548）。
- **Library**: `peach scan` reads SMB storage set in media.mounts, and a folder that can't be listed stops with an error instead of reporting 0 files and missing items (#693). / **馆藏**：`peach scan` 能读 media.mounts 里的 SMB 来源；目录列不出来时报错，不再报 0 个文件并把已有影片算作消失（#693）。
- **Settings**: Running from source on macOS or Linux with LAN access, first-run setup reports a missing OpenSSL instead of returning to setup each time (#395). / **配置**：macOS、Linux 源码运行并对局域网开放时，首次设置缺 OpenSSL 会直接报出，不再反复回到设置页（#395）。
- **Library**: Large scans retry a batch on a fresh ledger connection when the journal file is briefly blocked, instead of failing with unable to open database file (#138). / **馆藏**：大目录扫描遇到账本日志文件被短暂占用时换新连接重试当前批次，不再报 unable to open database file 中断（#138）。
- **Playback**: Followed media and previews cached on disk stay intact when two requests save the same item at once or the cache folder is cleaned meanwhile (#521). / **播放**：两个请求同时缓存同一段媒体，或缓存目录正被清理时，缓存不再错配或让播放失败（#521）。
- **Playback**: JAV previews play again when Peach's data folder sits in a long Windows path (#521). / **播放**：数据目录在 Windows 较深的路径下时，JAV 预告片重新能播（#521）。
- **Library**: Setting an actress avatar no longer fails when the avatar cache is cleaned at the same moment (#521). / **馆藏**：设置女优头像时缓存恰好被清理，不再让设置失败（#521）。
- **Updates**: Repairs and migrations says how many videos are postponed and why, and marks an item Deferred instead of In progress when only postponed ones are left (#734). / **更新**：「修复与迁移」写明补测延后了几部、在等什么，只剩延后时标「已延后」，不再一直报「进行中」（#734）。
- **Updates**: Upgrade repairs fail videos whose path can't be recognized and give the reason, instead of postponing them every half hour (#734). / **更新**：路径写法无法识别的影片补修按失败结算并写明原因，不再每半小时延后一次（#734）。
- **Updates**: Upgrade repairs no longer replan every minute when a video also has a queued or cancelled fill-in (#734). / **更新**：同一部片有排队或已取消的补全时，升级补修不再每分钟白白重排一轮（#734）。
- **Updates**: Repairs and migrations opens with the old snapshot estimate ready after a restart instead of showing Calculating (#734). / **更新**：重启后第一次打开「修复与迁移」就有关注旧快照的估算，不再先显示「正在统计」（#734）。
- **Playback**: Playback starts without waiting for the first hardware probe. Transcoding skips recently failed probes, and shutdown frees streaming threads (#734). / **播放**：起播无需等待首次硬件探测，转码跳过刚失败的探测，关闭服务时释放送流线程（#734）。
- **Library**: An item being permanently deleted from a cloud drive can't be restored from the bin midway, so no entry is left without its file (#734). / **馆藏**：网盘上永久删除期间不能再把同一部还原出回收站，不会留下没有文件的条目（#734）。
- **Following**: Searching and paging online tags no longer recount every followed item, dropping from about 3 seconds to instant (#734). / **关注**：在线标签页的搜索与翻页不再每次重算全部关注条目，从约 3 秒降到瞬时（#734）。
- **Sourcing**: The directory link harvesting script and the server share one JavDB pace, staying under 20 pages a minute together (#734). / **采集**：目录链接采集脚本与服务同时访问 JavDB 时共用一份间隔，合计不超过每分钟 20 页（#734）。

## [0.58.0] - 2026-11-14

> Peach now has a full English interface. It follows your browser language automatically; if you picked Chinese under Settings → Interface language before, switch it back to Auto or English. Titles, names and tags stay in their original language. Docker images were not published for 0.58.0; they ship with 0.59.0, including linux/arm64 and the `latest` tag. / Peach 现在有完整的英文界面，默认自动跟随浏览器语言；如果之前在「设置 → 界面语言」里选过中文，请改回「自动」或英文。作品标题、人名和标签保持原语言。0.58.0 没有发布 Docker 镜像，镜像随 0.59.0 发布，包含 linux/arm64 和 `latest` 标签。

### Added / 新增

- **Sourcing**: When browser add finds no source, the video code goes to Wants (turn off in Add from browser settings); the userscript can add to Wants directly (#638). / **采集**：浏览器入库没搜到资源时自动把番号加入「想要」，可在浏览器添加设置里关闭；用户脚本也能直接加入想要（#638）。
- **Sourcing**: For DMM titles with a bonus edition, browser add lets you pick the bonus or regular edition, and downloads prefer the chosen one. / **采集**：DMM 作品有特典版时，浏览器入库可选特典版或通常版，下载优先所选版本。
- **Sourcing**: Queued browser add tasks can use Prioritize to jump to the front of the search queue. / **采集**：浏览器入库排队中的任务可以「提前处理」，排到搜索队列最前面。
- **Sourcing**: Bundled userscript 0.7.9 reads video codes on FANZA clip pages, stops false conflicts on DMM and MGS pages, and counts Other tasks failures separately in red. / **采集**：随附用户脚本更新至 0.7.9，识别 FANZA 剪辑页的番号，DMM、MGS 页不再误判冲突，其他任务把失败单独计数并标红。
- **Sourcing**: The userscript lists all Other tasks with failures first; Peach unreachable, paused channels and update notices show as toasts (#624). / **采集**：用户脚本的其他任务全部列出、失败项在前，连不上 Peach、渠道暂停与更新提醒都用提示框显示（#624）。
- **Sourcing**: The userscript's on-page video code list sorts ascending or descending; progress pages for codes already in the library offer Open in library. / **采集**：用户脚本的本页番号列表可按番号升序、倒序排列；已入库番号的进度页可直接「打开馆藏」。
- **Sourcing**: Click the video code in the userscript's floating card or progress page title to copy it. / **采集**：用户脚本浮卡与进度页标题上的番号点一下即复制。
- **Interface**: In the English UI, the frontend's own pages, menus, hints and tutorials are all in English; titles, names, tags and server-sent text stay original. / **界面**：英文界面下，前端自己的页面、菜单、提示和教程全部换成英文；作品标题、人名、标签和服务端下发的文字仍是原文。
- **Interface**: In the English UI, common server errors, Repairs and migrations items and install methods are in English; English messages no longer turn into Request failed. / **界面**：英文界面下，常见的服务端报错、「修复与迁移」各项和安装方式显示英文，页面上的英文提示不再被换成「请求失败」。
- **Interface**: English UI translates task names, cloud download status, storage classes, backup uses, person categories, update results and release notes; dates are localized. / **界面**：英文界面下，任务名、云下载状态、存储类别、备份用途、人物分类、检查更新结果和更新说明显示英文，日期按界面语言排版。
- **Interface**: In the English UI, Tasks shows in English what metadata fill-in tasks are working on and why they were skipped or stopped. / **界面**：英文界面下，任务中心里补资料一类任务在做哪一项、为什么跳过或中断显示英文。
- **Interface**: In the English UI, current stages and batch action names for scan and sourcing, ledger backup, diagnostics export, Organize and media repair are in English. / **界面**：英文界面下，扫描与采集、账本备份、诊断导出、整理、媒体修复等任务的当前阶段和批量操作名显示英文。
- **Interface**: In the English UI, Tasks shows results and image sources in English for avatar, alias, metadata, studio logo and sample image fill-in tasks. / **界面**：英文界面下，任务中心里补头像、别名、资料、厂牌标识、样张等任务的结论与图片来源显示英文。
- **Interface**: In the English UI, errors and action hints on Settings, First-time setup, Review, Organize, Following and Downloads pages are in English. / **界面**：英文界面下，设置、首次设置、复核、整理、关注、下载等页面的报错与操作提示显示英文。
- **Interface**: In the English UI, tray menu and notifications, sign-in, taste analysis, task progress and results, download settings and avatar change help are in English. / **界面**：英文界面下，托盘菜单与通知、登录页、口味分析、各后台任务的进度与结果、下载设置和换头像的说明显示英文。
- **Updates**: Docker image releases also push the `latest` tag, so NAS container panels can flag new versions (#586). / **更新**：Docker 镜像发布时同时推送 `latest` 标签，NAS 容器面板能提示新版本（#586）。
- **Updates**: Docker images also ship for linux/arm64, so ARM NAS devices can pull them directly (#152). / **更新**：Docker 镜像同时提供 linux/arm64，ARM NAS 可以直接拉取（#152）。
- **Settings**: Docker can set the run-as user with `PEACH_UID` and `PEACH_GID`; existing data volumes have their owner migrated on startup (#203, #277). / **配置**：Docker 可用 `PEACH_UID`、`PEACH_GID` 指定运行身份，已有数据卷启动时自动迁移所有者（#203、#277）。
- **Settings**: The Docker image includes a NAS Compose generator, and the amd64 image ships Intel iGPU drivers (#375, #378). / **配置**：Docker 镜像内置 NAS Compose 生成器，amd64 镜像带 Intel 核显驱动（#375、#378）。
- **Settings**: Headless deployments can pick server folders and view file locations in the web UI (#376, #381). / **配置**：无桌面部署可在网页里选择服务端目录、查看文件位置（#376、#381）。

### Changed / 变更

- **Sourcing**: Browser add magnets that fail on the cloud drive (rejected, invalid, unseeded, mismatched) switch to the next, up to 3 times; no more Try another magnet (#634). / **采集**：浏览器入库的磁力在网盘失败（拒收、链接无效、没人做种、内容不符）时自动换下一个磁力，最多 3 次，不用再手点「换一个磁力」（#634）。
- **Interface**: Task waits use five animations (queued, checking, transferring, writing, organizing); progress hints share one style and stay still with reduced motion. / **界面**：后台任务的等待按做的事换成排队、检查、传输、写入、整理五种动画，进度提示全站同一种样式，减少动效时一律静止。
- **Updates**: Post-upgrade database migration keeps the web UI open with Updating the local database, backup progress and a refresh prompt; updates show the step and percent. / **更新**：升级后迁移数据库期间网页照常打开，顶部提示「正在更新本地数据库」并显示备份进度，完成后提示刷新；更新进行中的提示显示当前步骤与百分比。
- **Settings**: `peach` CLI messages follow the system display language, English on non-Chinese systems, set with `PEACH_LANGUAGE`; logs are always in English. / **配置**：`peach` 命令行的提示跟系统显示语言，非中文系统显示英文，可用 `PEACH_LANGUAGE` 指定；日志固定用英文。
- **Playback**: In the English UI, the player's online subtitle search looks for English subtitles and shows language names in the UI language. / **播放**：英文界面下，播放器的在线字幕搜索改找英文字幕，语言名也按界面语言显示。
- **Interface**: Long descriptions and confirmation dialogs in Settings, Manage, Following, title details and First-time setup are shorter. / **界面**：设置、管理区、关注、作品详情与首次设置里偏长的说明和确认框改短。
- **Interface**: Idle or background pages send fewer requests and slow retries when the server is unreachable; an idle server stops checking for resumable tasks every second. / **界面**：页面闲着或在后台时少发请求，连不上服务时逐步放慢重试；服务闲着时也不再每秒检查待恢复的任务。
- **Sourcing**: Bundled userscript 0.7.12 stops polling Peach with no active tasks or in background tabs; progress pages put retry first, card buttons sit below Other tasks. / **采集**：随附用户脚本更新至 0.7.12，没有进行中的任务或页面在后台时不再定时查询 Peach；进度页以重试等主要动作为主按钮，浮卡按钮统一排在「其他任务」下方。
- **Sourcing**: Userscript performer pages show a pressed Subscribed to new releases after subscribing, hover to cancel; Settings hides Check for updates once an update shows. / **采集**：用户脚本女优页订阅后显示按下态的「已订阅新作」，悬停可取消；设置页已提示可更新时不再显示「检查更新」。
- **Ledger**: Aspect, duration and quality tiers, generic link names and performer flags use English ids, migrated on upgrade and shown in English UI; old bookmarks work. / **账本**：画幅、时长与画质分档、通用链接名和出演者标记改存英文 id，升级时自动迁移；英文界面下这几处显示英文，旧书签照常可用。
- **Interface**: In the English UI, edition badges, version names, FC2 part names, untitled galleries, tablet device names and taste bookmark sources no longer show Chinese. / **界面**：英文界面下，版次徽章、版本名、FC2 分卷名、未命名图集、平板设备名与口味书签来源不再显示中文。
- **Settings**: Version stats and error reports sends only type, code location and count for offline drives, damaged media, full disks or busy databases, not full diagnostics. / **配置**：「版本统计与错误诊断」对盘掉线、媒体损坏、磁盘满和数据库忙这类环境问题只上报类别、代码位置和次数，不再发完整诊断。
- **Interface**: Messages for failed requests, dropped connections and unmounted sources no longer mention the tray or drive letters. / **界面**：请求失败、连接中断与来源未挂载的提示不再提托盘和盘符。
- **Settings**: The Compose and Docker docs open with NAS LAN access and the first-time setup password (#125). / **配置**：Compose 与 Docker 文档开头写明 NAS 局域网访问和首次设置密码（#125）。

### Fixed / 修复

- **Playback**: Cached images, video sizes and generated stills are reused before online reads or frame extraction (#754). / **播放**：图片、视频大小和已生成静帧优先复用本地缓存（#754）。
- **Sourcing**: Wants distinguishes source failures from empty results, reads JavDB pages when its API requires login and restores confirmed resources (#717). / **采集**：想要区分来源失败与正常空结果，JavDB 接口要求登录时读取作品页，并恢复已确证资源的误放弃状态（#717）。
- **Following**: Leaving Home unmounts its new-release row and prevents late requests from showing it on other pages (#744). / **关注**：离开首页时卸载新作行，迟到请求不会再将它显示到其他页面（#744）。
- **Desktop**: On macOS, opening Peach while it is running opens the web UI, so you can get in even when the system hides the menu bar icon. / **桌面**：macOS 上 Peach 已在运行时再点开应用会打开网页，菜单栏图标被系统折叠时也能进入。
- **Updates**: Auto-repair speed set in Tasks applies to later batches and persists across restarts (#535). / **更新**：在任务中心调整自动修复的速度后，之后各批沿用这个速度，重启后仍保留（#535）。
- **Library**: 1920×1080 and similar videos are rated 1080P instead of 2K; existing videos are corrected after upgrading (#583). / **馆藏**：1920×1080 等视频的画质分档改为 1080P，不再算作 2K；已有视频升级后自动更正（#583）。
- **Library**: WebM files register as videos; ones registered as other files are fixed on upgrade, with duration, previews and metadata filled in (#551). / **馆藏**：WebM 视频登记为视频；以前登记成其他文件的，升级后自动改正并补时长、预览与资料（#551）。
- **Playback**: In iPhone Safari, the buffering spinner no longer stays on while a video is playing normally (#169). / **播放**：iPhone Safari 上视频正常在播时，缓冲转圈不再一直显示（#169）。
- **Playback**: Subtitles show in iPhone Safari native fullscreen and picture-in-picture instead of disappearing entirely (#617). / **播放**：iPhone Safari 原生全屏和画中画播放时显示字幕，不再整段消失（#617）。
- **Interface**: The Content tags ranking and coverage on Stats count tags from metadata scraping and are no longer always empty (#596). / **界面**：统计页的「内容标签」排行与覆盖率计入刮削补来的标签，不再一直为空（#596）。
- **Library**: Scanning large folders on network drives no longer times out the whole folder with 0 files; reading continues while entries keep coming (#272). / **馆藏**：网络盘上条目很多的目录扫描时不再整目录判超时、扫出 0 个文件，只要还在返回条目就继续读（#272）。
- **Library**: CLI scans of a folder outside every media folder show a message instead of raising IndexError (#591). / **馆藏**：命令行扫描不在任何媒体目录下的目录时给出提示，不再报 IndexError（#591）。
- **Following**: When connected to an older Peach server, opening Following still shows the progress of running checks. / **关注**：连着版本较旧的 Peach 服务时，关注页进页仍会显示正在进行的检查进度。
- **Sourcing**: When cloud drive space or quota runs out, browser add pauses with a notice atop Cloud downloads and resumes on its own instead of failing repeatedly (#624). / **采集**：网盘空间或额度不足时，浏览器入库暂停、云下载段顶部给出提示，恢复后自动继续，不再一连串失败（#624）。
- **Sourcing**: Browser add no longer loses no-source-found records when the queue is full, and the userscript's Other tasks lists every failure. / **采集**：浏览器入库的「未找到资源」不再在队列满时丢失记录，用户脚本的其他任务能列出全部失败项。
- **Sourcing**: When sources like JavDB fail, browser add retries after cooldown instead of logging no source found and adding to Wants; mislogged ones are rechecked (#646). / **采集**：浏览器入库遇到 JavDB 等来源没查成时按冷却自动重试，不再误记为未找到资源并加入想要；已误记的会自动重查（#646）。
- **Sourcing**: Userscripts installed from Peach no longer warn about an update and a changed download URL on every Sleazy update. / **采集**：从 Peach 安装的用户脚本经 Sleazy 更新时，不再每次提示更新与下载地址被更换。
- **Interface**: After closing title details or filtering on JAV and Manage pages, no leftover blank space stays at the bottom, and late content no longer shifts the viewport. / **界面**：关掉作品详情、在 JAV 与管理区页内筛选之后，页面底部不再留着上一屏的空白，晚到的内容也不再把视口顶走。
- **Sourcing**: With the JavDB API now requiring sign-in, library sourcing reads javdb.com title pages, so metadata, tags and cover checks still work (#599, #614). / **采集**：JavDB 接口要求登录后，馆藏采集改读 javdb.com 作品页，资料、标签与封面印证照常取得（#599、#614）。
- **Interface**: With the JavDB API requiring sign-in, out-of-library title details, reviews, magnets and the wanted list identify titles via javdb.com pages as before (#614). / **界面**：JavDB 接口要求登录后，库外作品详情、评论、磁链资源与待找清单改从 javdb.com 网页认作品，照常显示（#614）。
- **Sourcing**: DMM pages for SOD bonus editions are matched by the regular edition code (e.g. SDJS-304) instead of reporting that no video code was found. / **采集**：DMM 上 SOD 特典版的作品页按通常版番号识别（如 SDJS-304），不再报未识别到作品番号。
- **Sourcing**: A site verification window waiting during a scan that gets minimized from the taskbar is moved back on screen, no right-click Maximize needed. / **采集**：扫描中等待的站点验证页从任务栏点到最小化后，会自动放到屏幕内，不必再右键最大化。
- **Interface**: In relaxed density, scrolling Library and Following no longer makes cards grow as they enter view and push the viewport down. / **界面**：宽松档下滚动馆藏与关注，卡片不再进屏才长高、把视口往下挤。
- **Playback**: Opening Quality in the settings menu no longer shrinks it to a strip before springing back; portrait videos no longer show the tier as 1920p. / **播放**：设置菜单点进「清晰度」不再先缩成一条再弹回原高；竖屏片不再把档位写成 1920p。
- **Library**: 4K from metadata sites means an official 4K release and is no longer added as a title tag; such tags are removed on upgrade. / **馆藏**：资料站标的「4K」指官方出过 4K 版，不再挂成作品标签；升级后自动解除已挂上的这类标签。
- **Interface**: Space used on Stats counts several media folders on one disk as one volume with its capacity once, instead of multiplying by folder count. / **界面**：统计页的使用空间里，同一块盘上的几个媒体文件夹只算一次容量和一个卷，不再按文件夹数翻倍。
- **Interface**: When performer names display in Chinese or Japanese, the name menu and alias line below the name no longer miss manually added aliases. / **界面**：女优名称显示为中文或日文时，名字菜单和名字下方的别名行不再漏掉手动添加的别名。
- **Interface**: The media library column in Diagnostics Collection health shows library names with icons, long titles cut at two lines; nav ordering and others add icons too. / **界面**：系统诊断「库健康」的媒体库列改为带图标的媒体库名，长标题两行截尾；导航排序等处的媒体库也补上图标。
- **Library**: A corrupted state file for newly added videos no longer makes metadata processing keep erroring; it is renamed and kept, and a rescan recovers. / **馆藏**：记录新入库影片的状态文件损坏后，资料处理不再一直报错；损坏的文件改名留存，重新扫描即可恢复。
- **Updates**: Successful in-app updates delete the ~1 GB update temp folder beside the install and keep only the last two database backups; old leftovers go too (#534). / **更新**：应用内更新成功后删掉安装目录旁约 1 GB 的更新临时目录，数据库备份只留最近两次；以前更新留下的也一并清掉（#534）。

### Security / 安全

- **Interface**: External link icons are fetched only from public HTTPS addresses; private or plain HTTP addresses in the target page are no longer requested (#131). / **界面**：外链圆标只从公网 HTTPS 地址取图，对方页面里写的内网或明文地址不再被访问（#131）。

## [0.57.0] - 2026-11-09

### Added / 新增

- **Settings**: New capacity protection caps data and cache; over the cap it clears the oldest playback cache first and pauses background tasks, without blocking playback. / **配置**：新增容量保护，可给数据和缓存设上限，超限时先清最旧的播放缓存、暂停后台任务，不挡播放。
- **Settings**: Settings adds Repairs and migrations, listing post-upgrade repair progress, items awaiting your confirmation and history. / **配置**：设置里新增「修复与迁移」，列出升级后各项修复的进度、等你确认的项和历史记录。
- **Updates**: After an upgrade, release notes pop up listing only entries relevant to this machine; reopen them from Check for updates. / **更新**：升级后弹出这一版的更新说明，只列和这台机器有关的条目，检查更新里可以再次打开。
- **Interface**: Sidebar and Manage menu items can be reordered by dragging, and each group can reset to its default order. / **界面**：侧栏和管理菜单可以拖动排序，每个分组都能恢复默认顺序。
- **Library**: Scan and sourcing can target a single media library. / **馆藏**：扫描与采集可以只选一个媒体库。
- **Sourcing**: The JAV New releases page supports multi-select to add to Wants or search for sources in bulk. / **采集**：JAV 新作页可以多选，批量加入想要或查找资源。
- **Interface**: Background tasks share a three-level speed control; activity history, cloud downloads, New releases, Wants and review lists get full pagination. / **界面**：后台任务统一用三档速度调节，活动历史、云下载、新作、想要与复核列表都有完整分页栏。
- **Sourcing**: Adding cloud download tasks retries a limited number of times on temporary errors and shows accurate results when done. / **采集**：云下载添加任务遇到暂时性错误时自动有限重试，结束后显示准确的结果。
- **Interface**: Title cards without an image say what is missing and why, and can fetch the cover, fill in previews for that title or retry on the spot. / **界面**：作品卡没有图时写明缺的是什么、为什么缺，可当场抓取封面、补全这一部的预览或重试。
- **Interface**: New performer, studio and title detail pages show Filling in while metadata completes, then refresh avatars and metadata without a page reload. / **界面**：刚入库的女优、厂牌页与作品详情在资料补全期间显示「正在补全」，补完自动刷新头像与资料，不用刷新页面。
- **Interface**: UI language follows browser and system; in English, sidebar and Manage menu come first, other pages follow over time; pin it under Appearance. / **界面**：界面语言默认跟随浏览器与系统语言，英文环境下侧栏和管理菜单先显示英文，其余页面逐步补齐；可在「外观与导航」里固定。
- **Interface**: In the English UI, Library tools, Junk files, Duplicates and Media repair pages are in English. / **界面**：英文界面下，数据管理、垃圾文件、重复文件与媒体修复几页换成英文。
- **Settings**: Docker Compose deployments can set health check interval and container log rotation via env vars; logs default to 10 MB each, 3 kept (#502). / **配置**：Docker Compose 部署可以用环境变量调整健康检查间隔和容器日志轮转，容器日志默认单个 10 MB、保留 3 份（#502）。

### Changed / 变更

- **Playback**: Cloud drive videos aren't batch-measured for display size on upgrade; it starts once confirmed in Repairs and migrations and pauses on low system disk (#452). / **播放**：网盘里的视频不随升级批量补测显示尺寸，改在「修复与迁移」确认后才开始，系统盘不足时整批暂停（#452）。
- **Library**: Preview fill-in is no longer local-only and also extracts frames in free cloud drive folders; targeted fill-in on data saver folders asks first. / **馆藏**：补全预览不再只限本地，免费网盘目录一起抽帧；开了流量保护的目录点名补全时先确认。
- **Interface**: Descriptions and confirmations on Library tools pages are shorter, keeping only scope, whether it can be undone and what is kept. / **界面**：数据管理几页的说明和确认框改短，只留做决定需要的范围、能否恢复和保留什么。
- **Settings**: Upload collection and taste details adds capacity and playback activity summaries; if you enabled it before, agree again under Data sharing. / **配置**：「上传馆藏与口味明细」增加容量与播放活跃的汇总，之前开启过的要在「数据上传」里重新同意。
- **Interface**: Removes hints explaining internals, such as No verified Chinese spelling yet under names, missing-duration reasons and the Stats header. / **界面**：去掉名字下方「暂无已核对的中文写法」、无时长原因、统计页抬头等解释内部机制的提示文字。

### Fixed / 修复

- **Playback**: Orientation uses display aspect ratio (SAR), so landscape videos with non-square pixels aren't treated as portrait; old videos are rechecked on upgrade (#433). / **播放**：横竖屏改按显示宽高比（SAR）判定，非方形像素的横屏片不再被当成竖屏，旧视频升级后自动补测（#433）。
- **Library**: Synology `@eaDir`, fnOS metadata and macOS `._` system files are no longer added; ones already added move to Trash on upgrade (#432). / **馆藏**：群晖 `@eaDir`、飞牛元数据和 macOS `._` 等系统附属文件不再入库，已入库的升级后自动移进回收站（#432）。
- **Library**: Scans skip the macOS `.DocumentRevisions-V100` store at external drive roots instead of erroring when it can't be read. / **馆藏**：扫描跳过外接盘根目录下 macOS 的 `.DocumentRevisions-V100` 版本库，不再因读不了它报错。
- **Library**: When only a file name's case changes, scans follow the on-disk spelling and Organize can change case alone, without file-not-found errors (#487). / **馆藏**：文件只改了大小写时，扫描跟随磁盘上的实际写法，整理也能只改大小写，不再报文件不存在（#487）。
- **Review**: Candidates left by a permanently deleted asset move to the same file's new id, unmatched ones are withdrawn, ending No matching available asset errors (#486). / **复核**：资产永久删除后留下的候选改挂到同一文件的新编号，对不上的撤下，不再报「没有匹配的可用资产」（#486）。
- **Review**: Approve on tag candidates with only unlisted genres closes them directly instead of reporting Tag candidate is empty (#486). / **复核**：只剩未收录 genre 的标签候选点「通过」直接结案，不再报「标签候选为空」（#486）。
- **Library**: Upgrading removes performer links left by garbled early sourcing and re-fetches performers. / **馆藏**：升级时解除早期采集乱码留下的人物关联，并重新补采演员。
- **Following**: New entries from background sync appear in the Following list again (regression from 0.56.0). / **关注**：后台同步来的新条目重新出现在关注页列表里（0.56.0 引入的问题）。
- **Playback**: Header repair on long videos detects stalls by decoding progress instead of failing at a fixed 900-second timeout (#434). / **播放**：长片修复文件头时按解码进度判断是否卡住，不再固定 900 秒超时失败（#434）。
- **Sourcing**: Once a run's budget is spent, sourcing stops idling for hours; the task card shows how many remain for the next run, and the issue list logs one entry (#513). / **采集**：整趟采集预算用完后不再逐部空转几个小时，任务卡写明还剩几部没问、再跑一次接着采，问题清单只记一条（#513）。
- **Interface**: Performer pages no longer link or subscribe to empty JavDB pages of old names matched by name; uncensored pages stay; upgrade checks local cache only. / **界面**：人物页不再给出按名字对上的旧艺名空 JavDB 页，订阅新作也不再拉它，同一人的无码页照常保留；升级时按本机缓存判断，缓存里没有的保持原样。
- **Sourcing**: When JavDB, DMM, MGS or other sites reject the current proxy exit, subscription and source checks say to switch exits instead of No entries could be read. / **采集**：JavDB、DMM、MGS 等站拒绝当前代理出口时，订阅与来源检查直接说明要换出口，不再报「解不出任何条目」。
- **Updates**: When Check for updates can't reach GitHub, it reads the version from the download mirror, no longer stuck at 0.50.0 or calling the current version newer (#454). / **更新**：检查更新连不上 GitHub 时改从下载镜像取版本，不再停在 0.50.0 或说当前版本比最新版还新（#454）。
- **Sourcing**: When JavDB has both FANZA-exclusive and regular editions of a video code, metadata scraping picks the regular one instead of reporting unclear identity (#431). / **采集**：JavDB 同一番号同时有 FANZA 限定版与通常版时，刮削认通常版，不再报身份不明（#431）。
- **Sourcing**: FC2 title performers are checked by identity; JavDB performers with unconfirmed identity are no longer filled in automatically. / **采集**：FC2 作品的演员按身份核对，身份待确认的 JavDB 演员不再自动填入。
- **Sourcing**: After a cloud download finishes, the cloud drive folder is refreshed and import continues instead of stopping at unregistered. / **采集**：云下载完成后刷新网盘目录接着入库，不再停在未登记。
- **Library**: Interrupted scan tasks can restart when their process ID is taken by another program, instead of being treated as still running (#268). / **馆藏**：进程号被别的程序占用后，中断的扫描任务可以重新启动，不再被当成还在运行（#268）。
- **Following**: Each source keeps only its latest 3 raw snapshots plus those entries reference; older buildup can be deleted after confirming in Repairs and migrations. / **关注**：每个来源的原始快照只留最近 3 份和条目引用的，旧版积下的可在「修复与迁移」确认后删除。
- **Updates**: Background tasks no longer leave state files in the data folder, and upgrading cleans up the tens of thousands left by older versions. / **更新**：后台任务结束后不再在数据目录留下状态文件，升级时自动清掉旧版积下的几万个。
- **Updates**: Video fill-in deletes its progress files when done, and upgrading cleans up the over ten thousand left by older versions. / **更新**：影片补全做完后删掉自己的进度文件，升级时自动清掉旧版留下的上万个。
- **Updates**: Empty crash logs are deleted on normal exit, and upgrading cleans up empty logs left by older versions (#485). / **更新**：进程正常退出时删掉空的崩溃日志，升级时清掉旧版积下的空日志文件（#485）。
- **Updates**: Post-upgrade repairs wait when cloud drives are unmounted, sites cool down or capacity is over the cap; failed ones can be retried in Repairs and migrations. / **更新**：升级补修遇到网盘未挂载、站点冷却或容量超限时延后再派，失败的可在「修复与迁移」重试。
- **Library**: New files reported by push but still being written are registered after a server restart instead of being dropped. / **馆藏**：推送发现已收到、还在等文件写完的新文件，服务重启后接着登记，不再丢掉。
- **Following**: Mark all watched and Ignore all no longer miss items beyond 1000; they now commit in batches of 1000. / **关注**：「全部标记已看」「全部忽略」超过 1000 条时不再漏标，改为每 1000 条一批提交。
- **Following**: Source backoff and cooldown persist across restarts, so rate-limited sites aren't retried right after a restart. / **关注**：来源的退避与冷却跨重启保留，重启后不再马上重试被限流的站点。
- **Sourcing**: Performer metadata fill-in, metadata processing and video trailers share one javdb rate limit, at most 20 pages per minute in total. / **采集**：补女优资料、资料处理与视频预告同时访问 javdb 时共用一份间隔，合计不超过每分钟 20 页。
- **Playback**: Streaming no longer competes with page requests for threads, and playback heartbeats no longer make other pages reload. / **播放**：播放时送流不再和页面请求抢线程，播放心跳也不再让其他页面重新读取。
- **Playback**: Browsing the image wall or opening videos with subtitles skips the cloud drive when the local cache has a hit. / **播放**：浏览图片墙、打开带字幕的视频时，命中本机缓存就不再访问网盘。
- **Interface**: Library, Review, duplicates and junk score pages open and page faster in large libraries (#298). / **界面**：馆藏、复核、重复项与垃圾评分页在大馆藏里打开和翻页更快（#298）。
- **Interface**: While background tasks run, home, profile and Stats pages no longer refetch everything every two seconds, refreshing at most every half minute. / **界面**：后台任务在跑时，首页、资料页与统计不再每两秒整组重新读取，至多半分钟刷新一次。
- **Interface**: JAV Discover and New releases pages no longer recompute the whole page every 3 seconds while reading title metadata. / **界面**：JAV 发现页与新作页读取作品资料时不再每 3 秒整页重算。
- **Interface**: Opening the search box no longer fires a dozen stats requests; tasks with thousands of items list only running ones and the latest 50 in Tasks. / **界面**：点开搜索框不再发十几次统计请求；任务中心展开上千项的任务只列在跑的与最近 50 项。
- **Settings**: When a cloud drive hangs, Settings no longer stays loading; media folder online status comes from background checks. / **配置**：网盘卡住时设置页不再一直停在加载，媒体目录的在线状态改读后台检测结果。
- **Updates**: While post-upgrade metadata fill-in is scheduled, the per-minute background check no longer rereads the seed pack, checks each performer or reads avatars. / **更新**：升级后安排补资料期间，每分钟的后台检查不再整包重读种子包、逐位查女优和读头像。
- **Ledger**: Errors midway through migrations, deletions and ledger restores roll back the whole step, leaving no mismatched references. / **账本**：迁移、删除与账本恢复中途出错时整步回滚，不再留下对不上的引用。
- **Settings**: If HTTPS certificate issuance fails during First-time setup, it can be retried instead of staying half done. / **配置**：首次设置里 HTTPS 证书签发失败时可以重试，不再卡在半完成状态。
- **Interface**: Import notifications open title details directly, and the details tab shows the video code and file name. / **界面**：入库通知点开直接进作品详情，详情标签页显示番号和文件名。
- **Interface**: Profile tabs opened by ID show the person's name, and Trash, JAV, portrait and search result tabs get their own titles. / **界面**：按 ID 打开的资料页标签页标题显示人名，回收站、JAV、竖屏与搜索结果也有各自的标题。
- **Interface**: When a video preview fails to load, a retry hint shows inside the original frame instead of breaking the layout. / **界面**：视频预览加载失败时在原画框里显示可重试的提示，不再撑乱布局。
- **Interface**: Closing a popover with Esc no longer collapses the sidebar, and section pages no longer jump while loading. / **界面**：按 Esc 关掉弹层时不再顺带收起侧栏，分区页加载时不再跳动。
- **Sourcing**: Social media avatars are read from the person's own profile page, and title and new release cards update when the avatar changes. / **采集**：社交平台头像改读本人资料页，换头像后作品与新作卡片同步更新。
- **Playback**: JavDB trailers play when the local proxy uses Fake-IP. / **播放**：本机代理用 Fake-IP 时，JavDB 预告片也能正常播放。
- **Following**: The Iwara source icon is visible in the light theme. / **关注**：Iwara 来源图标在浅色主题下看得见。
- **Interface**: In the light theme, local and online source icons at the top left of title cards are no longer too faint to see. / **界面**：浅色主题下作品卡左上角的本地、在线来源图标不再淡得看不见。

## [0.56.0] - 2026-11-05

### Added / 新增

- **Updates**: Docker images are also published to `ghcr.io/peach-mitao/peach`, an alternative when Docker Hub pulls are limited. / **更新**：Docker 镜像同时发布到 `ghcr.io/peach-mitao/peach`，Docker Hub 拉取受限时可以改用。
- **Settings**: A fresh Docker install opens the same First-time setup as desktop, where you set a password or skip sign-in, with no access code needed. / **配置**：全新 Docker 首次打开走与桌面相同的首次设置，可设密码或免登录，不再要口令。

### Fixed / 修复

- **Library**: For re-saved, very short or tail-damaged videos, undecodable late contact sheet frames use earlier frames instead of staying in Needs attention (#392). / **馆藏**：转存、极短或尾部损坏的视频，九宫格靠后几格解不出时改取更早的画面，不再一直挂在「需要处理」（#392）。
- **Sourcing**: If one JavDB anonymous API host is unreachable, the next is tried; metadata scraping pauses only when all three fail (#315). / **采集**：JavDB 匿名接口的一个主机连不上时自动换下一个，三个都不通才暂停刮削（#315）。
- **Review**: Review no longer shows old-code metadata for videos back on a short code (e.g. `MCDV-24`); upgrade re-fetches by current code, keeping approved fields (#296). / **复核**：番号改回短号的影片（如 `MCDV-24`）复核页不再摆出按旧番号取到的资料，升级时撤下并按现番号重采，已批准的字段不动（#296）。
- **Library**: Matching performers and studios is faster for import, sourcing, and JAV New releases and Discover. / **馆藏**：入库、采集和 JAV 新作、发现页认女优与厂牌更快。
- **Interface**: While background tasks write metadata and after restarts, directory, index and Stats pages open without waiting for recomputation. / **界面**：后台任务写入资料时和重启后，目录、索引与统计页打开不再等重算。
- **Interface**: Tasks opens in about 0.1 s instead of about 1.7 s. / **界面**：任务中心打开从约 1.7 秒缩短到约 0.1 秒。
- **Interface**: While background tasks run, opening a page no longer recomputes search suggestions every time. / **界面**：后台任务运行时，打开页面不再每次都重新计算搜索推荐。
- **Following**: New release lists no longer show NOW PRINTING placeholders; unreleased titles without a cover are listed once the official cover is out. / **关注**：新作列表不再显示「NOW PRINTING」占位图，还没出封面的未发售新作等官方出图后再列出。

## [0.55.1] - 2026-11-05

### Fixed / 修复

- **Interface**: After background tasks write in batches, Stats, title lists, indexes, JAV New releases and search suggestions open faster the first time. / **界面**：后台任务成批写入后，统计、作品列表、索引、JAV 新作和搜索推荐首次打开更快。
- **Updates**: Mac standalone packages of 0.54.0 and 0.55.0 now get new versions from in-app Check for updates. / **更新**：装了 0.54.0、0.55.0 的 Mac 独立包，在应用内检查更新能收到新版了。

## [0.55.0] - 2026-11-05

### Added / 新增

- **Interface**: When a title is added, open pages show a notification; click Open to go straight to it. / **界面**：作品入库后，打开着的页面弹出通知，点「打开」直达这部作品。
- **Updates**: Docker deployments can update in one click from Settings after enabling optional Watchtower; see [Docker deployment](docs/DOCKER.md#一键更新可选-watchtower). / **更新**：Docker 部署可在配置页一键更新，需先启用可选的 Watchtower，见 [Docker 部署](docs/DOCKER.md#一键更新可选-watchtower)。
- **Following**: JAV subscriptions add DMM/FANZA lists; the userscript can subscribe directly from performer pages on JavDB, DMM and MISSAV. / **关注**：JAV 订阅增加 DMM／FANZA 片单；用户脚本可在 JavDB、DMM、MISSAV 的女优页直接订阅。
- **Sourcing**: Amateur titles missing performers get stage names from 素人系総合 Wiki; performers not on minnano-av get metadata from avbase. / **采集**：素人片缺演员时查素人系総合 Wiki 补上艺名；minnano-av 没收录的女优从 avbase 补资料。
- **Sourcing**: Sources can check in one click whether each metadata source and image CDN is reachable; on the CLI use `peach check-sources` (#382). / **采集**：「来源和凭证」可一键检查各资料源与图片 CDN 能否连上，命令行用 `peach check-sources`（#382）。
- **Settings**: Network lets you change the access code, distribute HTTPS certificates and revoke signed-in devices one by one; source installs can install FFmpeg in one click. / **配置**：「网络与访问」可更换访问口令、分发 HTTPS 证书、逐台撤销已登录设备；源码运行可一键装 FFmpeg。
- **Ledger**: Maintenance can back up the ledger now or restore from any backup. / **账本**：「应用与维护」可立即备份账本，或从任一份备份恢复。
- **Library**: Uncensored editions split into uncensored, uncensored leak and uncensored crack; Duplicates can mark a group as Keep all. / **馆藏**：无码版次分为无码、无码流出、无码破解三档；重复文件页可把一组标为「都保留」。
- **Interface**: Shift+S toggles SFW mode anytime; slow page changes show a progress bar along the top edge. / **界面**：Shift+S 随时开关 SFW 模式；换页较慢时页面顶边显示进度条。

### Changed / 变更

- **Sourcing**: The JavDB step of metadata scraping and source search uses the public anonymous API, with no cookie needed and no Cloudflare impact (#315). / **采集**：刮削和找资源的 JavDB 一环改用公开匿名接口，不再需要 Cookie，也不受 Cloudflare 影响（#315）。
- **Review**: Metadata differing only in spelling or disputed only by community sites skips review; auto-written metadata can be withdrawn item by item on Review. / **复核**：只差写法或只有社区站异议的资料不再进复核；自动写入的资料可在复核页逐条撤回。
- **Playback**: Titles opened in mpv, VLC or IINA are recorded as watched; seek bars in mini player and immersive mode preview frames. / **播放**：用 mpv、VLC、IINA 打开的作品也记下观看；小窗和沉浸模式的进度条可预览画面。
- **Following**: Feeds fetch at staggered times, long-quiet sources are checked less and less often, and JavDB refetches automatically after cooldown. / **关注**：订阅源错开时间拉取，久未更新的来源逐级放慢检查，JavDB 冷却结束后自动重拉。
- **Sourcing**: Bundled userscript 0.7.4 keeps finished tasks on the floating card until marked read and recognizes DMM amateur and FC2 product pages. / **采集**：随附用户脚本更新至 0.7.4，任务结束后留在浮卡直到标为已读，并识别 DMM 素人与 FC2 商品页。

### Fixed / 修复

- **Interface**: With many tasks, Stats, New releases and first screens no longer lag by seconds or more; Tasks merges same-type tasks into one card. / **界面**：任务多时，统计页、新作页和各页首屏不再被拖慢几秒到十几秒；任务中心同类任务合成一张卡。
- **Updates**: Post-upgrade auto-repairs dispatch in batches instead of queuing the whole library at once or reprocessing every cloud drive video. / **更新**：升级后的自动修复分批派发，不再一次排满整个媒体库，也不再把网盘影片全部重新处理。
- **Following**: New releases missing only a cover say why and can fetch images first; deleted covers of out-of-library titles can be restored in original HD. / **关注**：只缺封面的新作写明原因、可优先取图；库外作品封面被删后能取回原来的高清图。
- **Sourcing**: Offline first processing finishes local steps and the rest once online; stalled cloud downloads keep being rechecked and resubmitted if the drive hangs. / **采集**：首次处理时断网，本地部分照常完成、联网后补齐；云下载停滞后继续复查，网盘无响应时自动重交。
- **Sourcing**: HEYZO codes below 1000 are recognized again (#354), r18.dev covers work again, and source search explains why when all results are filtered out. / **采集**：HEYZO 小于 1000 的编号恢复识别（#354），r18.dev 封面恢复可用，找资源全被筛掉时说明原因。
- **Library**: Codes misread from file names are cleared; uncensored-only studios are queried as uncensored; offline cloud drives no longer cause false missing-folder errors. / **馆藏**：清除从文件名误认出的番号；只出无码的厂牌直接按无码查询；网盘掉线时不再误报目录不存在。
- **Playback**: Seek bar previews show only the frame at the pointer, no longer cropped at either end, and show just the time without thumbnails. / **播放**：进度条预览只显示指向时刻那一格，两端不再被裁掉，没有缩略图时只显示时间。
- **Interface**: Performer page links no longer point to old stage names (#271), the home skeleton shows only once, and Safari IME Enter no longer submits early. / **界面**：人物页入口不再指向旧艺名（#271），首页骨架只出一轮，Safari 输入法回车不再提前提交。
- **Desktop**: Diagnostic bundles record why the service was relaunched each time and its startup time, to help troubleshoot Services are not running. / **桌面**：诊断包记下每次重新拉起服务的原因和启动耗时，便于排查「服务未运行」。

## [0.54.0] - 2026-11-04

### Added / 新增

- **Following**: The JAV page adds a New releases section of subscribed titles not yet in the library, with sorting, filters, and a list view; Home adds View all new releases. / **关注**：JAV 页新增「新作」分区，列出订阅到、还没入库的新作，可排序、筛选、切成列表；首页加「查看全部新作」。
- **Updates**: The standalone macOS app gets in-app updates: Check for updates downloads and verifies the new version, then replaces and reopens the app once you confirm. / **更新**：macOS 独立包带上应用内更新，「检查更新」下载并核对新版本，确认后替换应用并重新打开。

### Changed / 变更

- **Interface**: The title list splits Library and Performers into two columns you can hide and resize, with new default columns; the JAV page filter moves beside its title. / **界面**：作品列表的媒体库与艺人拆成单独两列，可隐藏、调宽，默认显示的列也有调整；JAV 页的筛选框移到页头标题行右侧。
- **Interface**: Empty search box suggestions load ahead, each group can Shuffle, and placeholder terms rotate; the search results title shows your query. / **界面**：空搜索框的推荐提前取好、每组可单独「换一批」，占位推荐词轮换；搜索结果页标题写出搜索词。
- **Interface**: Task cards get category icons, follow-ups are named object + action, zero readings show Idle, video repair cards list their files; cards lose the outline. / **界面**：任务卡按类别加图标，后续任务改用「对象 + 动作」的名字，读数为 0 写「未使用」，视频修复卡列出正在修复的文件；各页卡片去掉外圈描边。
- **Interface**: The video wall zooms around the pointer on scroll, `+`/`-` zoom and `0` resets; the tool panel becomes two round buttons at the top left. / **界面**：播放墙滚轮改为以指针为中心缩放，键盘 `+`／`-` 缩放、`0` 回到起点；工具面板拆成左上角两枚圆键。
- **Interface**: Up next shows rare tags the two titles share, with unified cards; details pages collapse tags beyond 24 behind an N more link. / **界面**：「接着看」写出两部作品共有的少见标签，卡片统一；详情页标签超过 24 枚时先折叠，点「还有 N 个」展开。
- **Sourcing**: The bundled userscript updates to 0.7.1: the floating card can retry organizing and list other tasks, and source pages share task progress. / **采集**：随附用户脚本更新至 0.7.1，浮卡可「重试整理」、列出其他任务，多个来源页共享任务进度。
- **Sourcing**: Scan and fetch issue notices merge into one box with Won't ask again for 7 days, the full log, and export; archiving can be undone. / **采集**：扫描与采集的问题提示合成一块，「7 天内不再问」、完整记录和导出都在同一个框里，归档可撤销。
- **Settings**: Version stats and error reports upload far less data; Settings descriptions sit directly under each option. / **配置**：「版本统计与错误诊断」大幅减少上传量；配置页的说明直接写在每一项设置下方。
- **Updates**: App, sourcing bridge, and interface dependencies update for compatibility, keeping current source APIs, web metadata parsing, and file locking. / **更新**：更新应用、采集桥与界面的兼容依赖，保持现有来源接口、网页资料解析和文件锁行为。

### Fixed / 修复

- **Interface**: Task cards, receipts, and failure notices at the bottom right share one notification stack instead of overlapping; failed task cards show a red border again. / **界面**：右下角的任务卡、回执和失败提示排进同一个通知栈，不再叠在一处；失败的任务卡重新显示红色框线。
- **Library**: SMB share scans reuse one connection per run and are much faster; folders renamed with a new encoding keep their records instead of adding duplicates. / **馆藏**：扫描 SMB 共享时整趟共用一条连接，明显加快；目录改名换编码后沿用原记录，不再多出重复条目。
- **Sourcing**: A partly unreachable cover source no longer counts as Won't ask again for 7 days; one rate-limited site no longer fails a whole cloud download organize. / **采集**：封面来源只是部分连不上时不再记成「7 天内不再问」；云下载整理不再因一个资料站限流就整条失败。
- **Library**: Stop task for scan and fetch becomes Cancel task, Sync explains why it waits while a task runs, and command-line scans show file counts. / **馆藏**：扫描与采集的「停止任务」改为「取消任务」，任务未结束时点同步会说明原因，命令行扫描显示文件数。
- **Library**: Promo clips, URL text files, and QR code images in cloud download folders move to the Trash automatically instead of entering the library. / **馆藏**：云下载落地目录里的推广短视频、网址文本和二维码图片自动移入回收站，不再混进馆藏。
- **Interface**: Video wall, Home, and Library tools skeletons match their pages; video wall dragging is smoother and narrow screens no longer go black on return. / **界面**：播放墙、首页和数据管理各页的加载骨架与页面一致；播放墙拖动更顺，窄屏重新进入不再整面黑屏。
- **Sourcing**: The bundled userscript updates to 0.6.11: floating cards switch without flicker, comment bylines aren't read as codes, and amateur avatars show one person. / **采集**：随附用户脚本更新至 0.6.11，浮卡切换不再闪，不把评论署名当番号，素人作品的头像不再变成两个人。
- **Following**: Deleting titles or emptying the Trash no longer removes New releases and Wants covers as cache; missing creator avatars fall back to the archive site's copy. / **关注**：删除作品或清空回收站后，新作与想要清单的封面不再被当成缓存删掉；作者头像取不到时改用归档站那张。
- **Desktop**: Local proxy or security software rewrites no longer trigger a false Submit from the Peach setup page; Windows relistens right after a client disconnects early. / **桌面**：本机代理或安全软件改写请求时，不再误报「请从 Peach 设置页提交」；Windows 上客户端提前断开后服务立即重新监听。
- **Library**: `MCDV-24` (uncensored) and `MCDV-024` (censored) are no longer treated as the same title; each gets its own metadata and cover. / **馆藏**：`MCDV-24`（无码）与 `MCDV-024`（有码）不再被当成同一部，资料和封面各取各的。
- **Interface**: Title details without a cover offer Retry now; the sidebar Home link works after a search; Discover and Diagnostics progress bars sit inside their frames. / **界面**：作品详情缺封面时可点「立即重试」；搜索后点侧栏「首页」能回到首页；发现页与诊断页的进度条放进框里。
- **Library**: Resource sync clears stale records after a media folder is removed; reading the new import range skips files being written, and bad organize paths explain why. / **馆藏**：移除媒体目录后资源同步能清掉失效记录；读取新入库范围不再撞上写入中的文件，整理路径有误时说明原因。
- **Sourcing**: `YUJ` codes aren't skipped as Korean MIB titles; corrupt videos and 10k-title backfills don't fail whole tasks; amane bridge rebuild errors start at line one. / **采集**：`YUJ` 开头的番号不再被当成韩国 MIB 片跳过；损坏视频和上万部批量补资料不再让任务整项失败；重建 amane 桥的报错从第一行写起。
- **Following**: rule34video characters go into the genre row; existing entries are backfilled with `scripts/backfill_rule34video_characters.py`. / **关注**：rule34video 的角色归入题材一排，已入库条目用 `scripts/backfill_rule34video_characters.py` 补上。
- **Following**: New rule34.xxx entries regain tag categories and use upload times; follow card tags move to the text column on a neutral fill; empty filter states span the row. / **关注**：rule34.xxx 新条目恢复标签分类、按上传时刻显示时间；关注卡的标签移入文字栏、用中性底色，筛选无结果时空状态铺满整行。
- **Settings**: Saving library settings during a scan asks first; when a running task blocks uninstall, the message names the task. / **配置**：有扫描任务时保存媒体库设置会先确认；卸载被在跑的任务拦下时写出是哪个任务。
- **Settings**: Canceling folder selection on Chinese macOS no longer errors; Peach says it's unsupported when no dialog can open or PowerShell is missing. / **配置**：macOS 中文系统里取消选择文件夹不再报错；无法弹出对话框或找不到 PowerShell 时提示不支持。
- **Review**: Fields auto-written from official sources no longer enter the review queue when only community sources spell them differently. / **复核**：官方来源自动写入的字段，只有社区来源给出不同写法时不再进复核队列。
- **Interface**: Stats donut charts show actual video counts on hover; truncated CJK file names containing English keep their ending, and window resizing is faster. / **界面**：统计页环图悬停显示实际视频数；中日文夹英文的文件名省略时末尾不再被裁掉，调整窗口更快。
- **Interface**: External link badges no longer return a server error for invalid redirect URLs; Wants page links missing a size show Unknown size. / **界面**：外链圆标遇到不合法的跳转地址不再报服务器错误；想看页的资源链接缺少大小时显示「大小未知」。
- **Playback**: Titles on SMB shares find external subtitles in the same folder, and the subtitle list no longer errors. / **播放**：SMB 共享上的作品能找到同目录的外挂字幕，字幕列表不再报错。

## [0.53.0] - 2026-11-02

The author started playing Phantom Blade Zero on October 29, 2026; updates and maintenance slow down until it's finished. / 作者从 2026 年 10 月 29 日开始游玩《影之刃零》，通关前会暂缓更新和维护。

### Added / 新增

- **Interface**: Tutorial center (Get started, Interface tour, Settings tour) at top right prompts once after upgrade, then hides; reopen in Settings. Progress is LAN-shared. / **界面**：新增教程中心，包含开始使用、界面导览和设置导览。升级后会提示一次，从右上角进入；看完后入口收起，可在设置中重新打开。阅读进度保存在本实例，局域网内各设备共用。
- **Library**: Tasks can pause, resume, and cancel tasks; parent cards control a whole batch of follow-ups; each task shows its own CPU, GPU, disk, and network readings. / **馆藏**：任务中心可暂停、继续和取消任务，父任务卡可控制整批后续任务；每个任务显示自身的 CPU、GPU、磁盘与网络读数。
- **Library**: Library tools can preview and permanently delete a performer's videos in bulk after confirming the scope, cancelable from Tasks; each tool now has its own page. / **馆藏**：数据管理可按女优预览并批量永久删除影片，执行前确认范围，执行中可在任务中心取消。数据管理的各项工具改为独立二级页。
- **Desktop**: The macOS menu bar adds Check for updates and Export diagnostics report; with start at login on, a crashed menu bar app restarts itself from the next login. / **桌面**：macOS 菜单栏新增「检查更新」和「导出诊断报告」；开启开机自启时，菜单栏程序异常退出后会自动重新启动，下次登录后生效。
- **Playback**: Linux and Docker installs with a usable GPU decode covers, contact sheets, and timeline frames with VAAPI, falling back to software decoding. / **播放**：Linux 和 Docker 部署在有可用显卡时，封面、九宫格和时间轴抽帧使用 VAAPI 硬件解码，不可用时回到软件解码。

### Changed / 变更

- **Updates**: The standalone macOS app downloads the DMG for your architecture to drag into Applications; on macOS the auto-download setting only checks for new versions. / **更新**：macOS 独立包改为下载对应本机架构的 DMG，拖入「应用程序」替换；自动下载设置在 macOS 上只检查新版本。
- **Updates**: Bundled userscript 0.6.10: the install page offers a refresh and a reload prompt after confirming; MGStage codes with store prefixes are recognized. / **更新**：随附用户脚本更新至 0.6.10：打开安装入口后提供刷新操作，确认新版后提示刷新本页；MGStage 带店铺前缀的番号也能识别。
- **Playback**: Contact sheets for the same video reuse the existing decode probe, cutting repeated work. / **播放**：同一部影片生成九宫格时复用已取得的解码探测，减少重复开销。
- **Updates**: App, sourcing bridge, and interface dependencies update for compatibility, keeping current source APIs, file watching, and metadata protection rules. / **更新**：更新应用、采集桥与界面的兼容依赖，保持现有来源接口、文件监视和资料保护规则。
- **Updates**: watchdog 7, pyobjc-core 13, and amane 0.24.1 are held back this release; the sourcing bridge stays on amane 0.22.1. / **更新**：watchdog 7、pyobjc-core 13 与 amane 0.24.1 三项依赖本版暂缓升级，采集桥继续使用 amane 0.22.1。

### Fixed / 修复

- **Interface**: Page switches restore scroll position per URL and history and keep loaded lists; first visits to Following, index, and manage pages no longer jump to the top. / **界面**：切换页面时按地址和浏览记录恢复各自的滚动位置，保留已加载的列表；首次进入关注、索引和管理页时，短骨架不再先把位置拉回顶部。
- **Sourcing**: MGStage SOD product pages (such as `107STZY-019`) normalize to the bare code, so library titles are recognized and magnet searches find results. / **采集**：MGStage 的 SOD 商品页（如 `107STZY-019`）归一为裸番号，馆藏已有的影片能正确识别，磁力搜索不再落空。
- **Sourcing**: When one cover source enters cooldown, other candidates keep being compared instead of the whole cover run stopping. / **采集**：取封面时某个来源进入冷却，其他候选来源继续比较，不再中断整趟取图。
- **Desktop**: The tray waits for a slow-starting server and records late readiness, no longer reporting a false startup failure. / **桌面**：托盘等待启动较慢的服务就绪，并补记迟到的就绪状态，不再误报启动失败。
- **Settings**: When the ledger is missing, corrupt, or failed to migrate, the Settings page still opens and explains the state. / **配置**：账本缺失、损坏或迁移异常时，配置页仍可打开并说明状态。
- **Desktop**: Uninstall instructions for the standalone macOS app list the steps the usual move-to-Trash way. / **桌面**：macOS 独立包的卸载说明按废纸篓惯例列出步骤。
- **Interface**: The copy editor toolbar floats page-wide and drags from blank or status areas with buttons still clickable; styles are unified and extra dialog padding is gone. / **界面**：改字工具条在整个网页上悬浮，空白和状态区域可直接拖动，按钮保持正常点击；统一状态文字与控件样式，移除设置弹窗内多余的底部占位。

## [0.52.0] - 2026-10-30

The author started playing Phantom Blade Zero on October 29, 2026; updates and maintenance slow down until it's finished. / 作者从 2026 年 10 月 29 日开始游玩《影之刃零》，通关前会暂缓更新和维护。

### Added / 新增

- **Interface**: Settings → JAV can show performer names in Chinese or original Japanese, shared via the database; only display changes, falling back to the current name. / **界面**：女优名称可在设置的「JAV 与新作」中切换中文或日文原文，偏好随数据库共享。切换只改变当前所选艺名的显示写法，缺少对应时保留当前名称，不改写人物或作品资料。

### Fixed / 修复

- **Library**: While upgrade backfill runs, scan and fetch wait for background tasks instead of failing on a held lock; tasks can still be stopped while waiting. / **馆藏**：升级补全正在运行时，扫描与采集等待后台任务让路，避免因处理锁被占用而立即失败；等待期间仍可停止任务。
- **Updates**: App and sourcing bridge dependencies update for compatibility, keeping current source APIs and metadata protection rules. / **更新**：更新应用与采集桥的兼容依赖，保持现有来源接口和资料保护规则。
- **Sourcing**: The bundled userscript updates to 0.6.8: Codes on this page checks real status, so owned titles and running tasks no longer show as pending or count in Add all. / **采集**：随附用户脚本更新至 0.6.8，「本页番号」先查询真实状态，已有影片与进行中任务不再显示「待加入」或计入「全部加入」。更新脚本并刷新来源页面后生效。
- **Playback**: Title detail stats, image links, and load speed controls share one height, sitting side by side when there's room and wrapping when there isn't. / **播放**：作品详情的统计、图片入口与加载速度控件保持同高，宽度足够时并排显示，空间不足时自动换行。
- **Library**: Performer and studio rollups at the top of Home and the JAV page are no longer slow under some database statistics. / **馆藏**：修复部分数据库统计下首页和 JAV 页顶部人物、厂牌聚合过慢的问题。
- **Playback**: MP4s missing a display timestamp table with a trailing index get a rebuilt playback header; old failed caches recheck, and unclear edit starts still transcode. / **播放**：缺少显示时间戳表的 MP4 可在索引位于文件末尾时重建播放头；旧版失败缓存会重新检查这类布局，无法判断编辑起点的文件继续转码。
- **Playback**: Fixes double shifts from some MP4 edit lists and timestamp rounding; affected old playback headers are corrected in place, keeping originals and valid caches. / **播放**：修正部分 MP4 编辑列表与时间戳舍入造成的重复平移，读取适用的旧播放头时定向修正，保留原片与正常缓存。
- **Interface**: New release and local detail tags match, and Escape closes the topmost popup first. / **界面**：新作与本地详情的标签保持一致，Escape 优先关闭当前最上层浮窗。
- **Library**: Performer aliases no longer pick up rename notes. / **馆藏**：人物别名不再混入更名说明。
- **Settings**: Same-origin checks treat HTTP and HTTPS default ports alike, so URLs with an explicit `:80` or `:443` are no longer rejected. / **配置**：同源检查统一识别 HTTP、HTTPS 的默认端口，避免地址显式包含 `:80` 或 `:443` 时被误拒绝。
- **Library**: Failed processing stays stopping until thread cleanup ends, so instant retries don't hit a held lock; startup failures show this run's error, not the last one. / **馆藏**：处理失败后的线程清理完成前保留停止中状态，避免立即重试撞上仍持有的处理锁；起步失败时显示本次错误，不再退回上一轮结果。
- **Sourcing**: If cloud download can't be verified, local diagnostics log the token, mount, or folder probe stage and failure type to separate setup from network issues. / **采集**：云下载能力未取得时，在本机诊断记录保留令牌、挂载点或目录探测阶段及失败分类，便于区分配置与网络问题。

### Security / 安全

- **Settings**: Client address headers are trusted only on the tunnel's local forwarded connections, so direct clients can't spoof their origin to bypass login rate limits. / **配置**：仅对隧道的本机转发连接采用有效的客户端地址头，防止直接连接的客户端伪造来源绕过登录限速。

## [0.51.0] - 2026-10-28

The author started playing Phantom Blade Zero on October 29, 2026; updates and maintenance slow down until it's finished. / 作者从 2026 年 10 月 29 日开始游玩《影之刃零》，通关前会暂缓更新和维护。

### Added / 新增

- **Settings**: Disk usage shows each data type's share with cleanup checkboxes; moving the data directory works for source and headless installs; Docker shows host-side steps. / **配置**：存储空间页显示各类数据的占用比例，可勾选清理；更改数据目录位置支持源码运行和无桌面服务部署，Docker 部署在界面上给出宿主机的迁移步骤。
- **Review**: Review can filter by field and highlights text differences between candidate and current values. / **复核**：可按字段筛选，候选值与当前值的文字差异高亮显示。
- **Review**: Pending items can be marked Later or Ignore, each counted separately with restore history kept. / **复核**：待处理条目可标为「稍后」或「忽略」，分别计数并保留恢复记录。
- **Sourcing**: The browser userscript supports manual video code entry and local performer profiles, and adds bulk add and appearance settings. / **采集**：浏览器脚本支持手动填写番号、查看本地人物资料，并加入批量添加与外观设置。
- **Sourcing**: Failed JAV browser adds say whether magnet or cloud drive failed; retry with another unused magnet; details match local performers by name or bracketed alias. / **采集**：浏览器添加 JAV 失败时分清是磁力还是网盘的问题；可以换一个磁力重新搜索，用过的磁力不再选；详情页按出演者名字匹配本地人物，括号里的别名也认。
- **Library**: Syncing new files and browsing the library use the same media library scope. / **馆藏**：同步新增文件与馆藏浏览使用同一个媒体库范围。

### Changed / 变更

- **Review**: Large review queues load faster with less repeated parsing and candidate transfer. / **复核**：大队列加载更快，减少重复解析和候选传输。
- **Updates**: Update checks prefer GitHub and can switch between two release sources for the same version; the maintenance page links Tasks and GitHub Releases. / **更新**：检查更新优先使用 GitHub，同一版本可在两个发布源之间切换；维护页提供任务中心入口和 GitHub 发布页。
- **Updates**: App, sourcing bridge, and frontend dependencies update; Docker builds use uv 0.13.6. / **更新**：更新应用、采集桥与前端的依赖，Docker 构建使用 uv 0.13.6。

### Fixed / 修复

- **Sourcing**: Garbled text from sources is no longer used; upgrades invalidate damaged old snapshots and refetch, repairing saved titles, performers, and other fields. / **采集**：来源返回损坏的文字时不再采用；升级时让受损的旧快照失效并重新采集，补修已入库的标题、人物等字段。
- **Sourcing**: When one code maps to several titles, other titles' metadata no longer mixes in and the original title is kept; upgrades refetch affected old metadata. / **采集**：同一番号对应多部作品时不再混入其他作品的资料，保留原标题；升级时定向重采受影响的旧资料。
- **Sourcing**: JavDB's new anonymous signature is supported, restoring download links on detail pages. / **采集**：适配 JavDB 新的匿名签名，详情页的资源链接恢复。
- **Sourcing**: Mixed local and SMB media roots fetch normally; STRM files are no longer treated as junk videos; fetch failures record full diagnostic evidence. / **采集**：本地与 SMB 混合的媒体根能正常采集；STRM 文件不再被当成垃圾视频；采集失败时记录完整的取证信息。
- **Sourcing**: Scan and fetch tasks stop safely and fill in the new import range and issue list. / **采集**：扫描与采集任务可以安全终止，补齐新入库范围与问题清单。
- **Sourcing**: The browser userscript gets 0.6.4–0.6.7 fixes: auto lookup, magnet switching, full-page scans, install file updates, list page panel, FANZA settings bar. / **采集**：浏览器脚本同步 0.6.4 至 0.6.7 的修正，包括自动查询、换磁力、整页扫描、安装文件更新、列表页入口面板和 FANZA 页设置底栏。
- **Sourcing**: Garbled magnet trackers are dropped so 115 accepts cloud downloads; refused tasks can retry; magnet swaps check all sources; browser-added avatars crop to face. / **采集**：云下载提交前去掉磁力里的乱码 tracker，115 不再拒收；网盘没收下的任务可原样重试；换磁力时查完所有来源；浏览器添加的人物头像按人脸取景。
- **Library**: Filters no longer stall when database statistics drift, and use the cache even with no tag selected. / **馆藏**：筛选项在数据库统计偏差时不再卡顿，未选标签时也使用缓存。
- **Library**: File monitoring ignores events from before startup; face models load from paths with Chinese characters. / **馆藏**：文件监控忽略启动前的历史事件；人脸模型放在中文路径下也能加载。
- **Playback**: Shared transcodes and child processes are reclaimed after playback ends or segment requests drop, leaving no stray ffmpeg. / **播放**：播放结束或分片请求断开后，回收共享的转码任务和子进程，不再残留 ffmpeg。
- **Review**: Scroll track stays in the card; filter groups are clearer, keep their buttons, match Home; upgraded old libraries reset caches and can restore past versions. / **复核**：滚动轨道收回卡片内；筛选分组区分清楚，保留原操作按钮，样式与首页筛选一致；旧库升级后缓存正确失效，可恢复历史版本。
- **Interface**: Tasks merges auto-repair batches, done or not, into one card; details no longer scroll sideways; dense cards get proper spacing; menu hover follows the theme. / **界面**：任务中心把自动修复的各批派发合成一张卡片，做完的批次也合并显示；详情页滚动条与加载占位不再出现横向滚动；密集卡片的行距补足，维护菜单的悬停色跟随主题。
- **Ledger**: Clearing task history no longer leaves broken references. / **账本**：清理任务历史后不再留下失效的引用。
- **Updates**: Upgrade text repairs dispatch only affected titles and keep existing task state. / **更新**：升级时的文字补修只派发相关作品，并保留已有的任务状态。

## [0.50.0] - 2026-10-26

### Added / 新增

- **Settings**: First-time setup has four steps (welcome, media folders, access, confirm), can add libraries later or reuse a data directory, and keeps input when you go back. / **配置**：首次设置分为欢迎、媒体目录、访问范围和确认四步，支持稍后添加媒体库与连接已有数据目录；返回上一步保留输入。
- **Updates**: Startup runs old metadata repairs, keeping manual edits and personal records; backfill follows library settings and read cost; app and userscript prompt update. / **更新**：启动时自动执行适用的旧资料修复，保留人工编辑和个人记录；后台补全遵守媒体库设置与读取成本。应用与浏览器脚本提供更新和刷新提示。

### Changed / 变更

- **Sourcing**: amane updates to 0.22.1 with site parser fixes and separates sources that need a login; existing bridge environments check and update against the lockfile. / **采集**：amane 更新到 0.22.1，纳入站点解析修正，并区分需要登录的来源；已有桥环境按依赖锁文件检查并更新。
- **Updates**: Player, image processing, and network service dependencies update; Docker uses Python 3.15.1. / **更新**：更新播放器、图片处理和网络服务依赖；Docker 使用 Python 3.15.1。

### Fixed / 修复

- **Library**: Scans hitting old duplicate paths isolate the conflicting records and keep registering other files; conflicts and personal records are kept for review. / **馆藏**：扫描遇到历史重复路径时隔离冲突记录，继续登记其他文件；冲突记录和个人记录保留待复核。
- **Library**: After switching media libraries, lists and filters share the same scope, and the details API returns the title's existing media types. / **馆藏**：媒体库切换后的列表与筛选使用同一范围，详情接口提供作品已有的媒体类型。
- **Sourcing**: Cover source errors fall through to other candidates, keeping the existing cover; not found and confirmed no image log apart; old no-image caches get rechecked. / **采集**：封面来源连接异常时继续核对其他候选，保留已有封面；未取得结果与确认无图分别记录，适用的旧无图缓存可在后续查询重新核验。
- **Desktop**: Local HTTPS certificates gain key identifiers; affected old certificates are reissued with the original CA, compatible with macOS LibreSSL. / **桌面**：本地 HTTPS 证书补齐密钥标识，适用的旧证书自动补签并保留原 CA，兼容 macOS LibreSSL。
- **Playback**: Fullscreen shows the whole video at its original aspect ratio, with black bars when the screen ratio differs. / **播放**：全屏按原比例完整显示视频，屏幕与视频比例不同时保留黑边。
- **Interface**: Canceled requests are handled correctly when switching pages, so Library tools no longer errors on empty counts. / **界面**：切换页面时正确处理取消的请求，避免数据管理页因空计数报错。
- **Settings**: The maintenance page links the website, GitHub, and GitGud release pages, with GitHub marked as not available for updates yet. / **配置**：应用维护页提供官网、GitHub 与 GitGud 发布页入口，GitHub 标注「暂无法更新」。

### Security / 安全

- **Sourcing**: The browser transport updates to curl_cffi 0.17.0, picking up security fixes for bundled Brotli and Windows certificate revocation checks. / **采集**：浏览器传输更新到 curl_cffi 0.17.0，纳入内置 Brotli 和 Windows 证书撤销检查的安全修复。

## [0.49.1] - 2026-10-25

### Added / 新增

- **Playback**: On Windows and macOS, details can open videos in the system default or an installed player; remote devices and Docker get a network stream URL and M3U. / **播放**：Windows、macOS 本机可在详情页选择系统默认播放器或已安装播放器打开视频；远程设备与 Docker 提供网络播放地址和 M3U。
- **Playback**: The web player can rotate video and remembers rotation, speed, subtitle choice, and appearance per video across details, the mini player, and immersive mode. / **播放**：网页播放器支持画面旋转，按视频记住旋转、倍速、字幕选择和外观，详情、小窗与沉浸播放共用。
- **Library**: Connect to SMB shares directly: test, then scan, play, organize, and delete within the share account's rights; NAS compatibility needs real-device testing. / **馆藏**：支持直接连接 SMB 共享，测试连接后扫描、播放，并按共享账号权限整理和删除文件；具体 NAS 的兼容性需实机验证。
- **Playback**: The progress bar can reuse existing Jellyfin Trickplay, BIF, WebVTT, HLS, and DASH image previews. / **播放**：进度条可复用已有的 Jellyfin Trickplay、BIF、WebVTT、HLS 与 DASH 图片预览。
- **Following**: Subscribe to Iwara creators and play on demand; online content takes manual tags, and you can hide content by tag and restore it. / **关注**：支持订阅 Iwara 视频作者并按需播放；在线内容可添加手动标签，按标签屏蔽内容并恢复。
- **Library**: Local and online tags support search, filters, and paged management; details pages share add, rename, and hide actions. / **馆藏**：本地与在线标签支持搜索、筛选和分页管理，详情页共用添加、改名与隐藏入口。
- **Sourcing**: When metadata or cover fetching waits long, skip the current video and continue; existing results are kept and unfinished items can retry after the task. / **采集**：取资料或封面等待较久时，可跳过当前影片继续处理；已有结果保留，未完成项可在任务结束后重试。
- **Settings**: Diagnostics and fetch logs build in the background with progress, cancel, download; Network lists local and phone URLs; desktop can edit access and LAN name. / **配置**：诊断报告与刮削记录在后台生成，提供进度、取消和下载；网络与访问页显示本机及手机连接地址，独立桌面部署可修改访问范围和局域网名称。

### Changed / 变更

- **Interface**: Japanese titles, summaries, aliases use Japanese glyphs; CJK is spaced from Latin and digits; summaries, comments, follow excerpts get looser, justified lines. / **界面**：日文片名、简介与别名按日文字形显示；汉字与英文、数字之间自动留出间距；作品简介、评论与关注摘要行距放宽，中日文段落两端对齐。
- **Settings**: First-time setup can save a Peach proxy for metadata scraping and dependency downloads. / **配置**：首次设置可保存 Peach 代理，用于资料采集与依赖下载。
- **Sourcing**: Scans recognize companion file naming from major media servers, keeping bundled metadata and previews. / **采集**：扫描识别主流媒体服务器的附属文件命名，保留配套资料与预览。
- **Sourcing**: JAV browser add submits cloud downloads in the background; the userscript shows task stage and progress and keeps the last confirmed state on connection errors. / **采集**：浏览器添加 JAV 在后台提交云下载，脚本显示任务阶段与进度，连接异常时保留最近一次确认的状态。

### Fixed / 修复

- **Updates**: Update packages that don't match the installed updater fall back to the full package, not an invalid tool manifest error; tool changes won't block updates. / **更新**：应用更新包与已装版本的更新器对不上时，改为下载同版本的完整包，不再停在「更新包工具清单无效」；以后随包工具增减也不会卡住自动更新。
- **Updates**: When the official download site is unreachable, update checks say Couldn't get version info instead of claiming you're up to date from an old GitHub version. / **更新**：官方下载站暂时连不上时，检查更新提示「未能取得版本信息，请重试」，不再拿 GitHub 上的旧版本误报「已是最新」。
- **Interface**: Chinese text in settings dialogs and other new UI uses YaHei, PingFang, or Source Han Sans, no longer mixing in blurry JhengHei on Traditional Chinese systems. / **界面**：设置弹窗等新界面的中文统一用雅黑、苹方或思源黑体显示，繁体系统上不再混用正黑体而显得发虚。
- **Sourcing**: Windows, macOS, and Docker bundle the scraping runtime, so no separate uv, Python, or Git is needed; missing sourcing tools prompt a reinstall. / **采集**：Windows、macOS 与 Docker 随包分发刮削运行环境，无需另装 uv、Python 或 Git；缺少采集工具时提示重新安装。
- **Interface**: Closed search suggestions stay closed, reappearing when you keep typing or refocus. / **界面**：搜索建议关闭后保持收起，继续输入或再次聚焦时显示建议。
- **Interface**: The player entry, bottom cover, and sample image switching on details pages stay consistent; samples can switch while loading. / **界面**：详情页的播放器入口、底部封面与样图切换保持一致；样图加载期间仍可切换。
- **Sourcing**: Product codes are checked per source and full title identity is kept; performer Chinese names and gallery avatar handling are filled in. / **采集**：按来源核对商品号并保留完整作品身份；补齐女优中文名与图库头像处理。
- **Settings**: Diagnostics reports keep the actual host and browser time zones and add local environment and playback failure records. / **配置**：诊断报告保留主机与浏览器的实际时区，补充本机环境和播放故障记录。

## [0.48.2] - 2026-10-24

Windows installs: run the full installer once by hand. Face models now ship with it and the old updater can't cross this upgrade; auto-update resumes after. / 已安装的 Windows 版请手动下载并运行一次完整安装包：人脸模型改随安装包分发，旧版自动更新器跨不过这次升级，之后照常自动更新。

### Added / 新增

- **Desktop**: Face models ship with the installer and Docker image, so face detection works out of the box; the macOS app bundles media tools. / **桌面**：人脸模型随安装包与 Docker 镜像分发，装好即可识别人脸；macOS 应用自带媒体工具。
- **Playback**: Windows gets D3D11VA hardware decoding, bundled FFmpeg adds AMF and QSV encoding; macOS gets hardware acceleration, set apart for frames and playback. / **播放**：Windows 支持 D3D11VA 硬件解码，随包 FFmpeg 支持 AMF 与 QSV 硬件编码；macOS 接入硬件加速，抽帧与播放分开设置。
- **Library**: Custom video code rules are supported, and codes are recognized from file names that include titles. / **馆藏**：支持自定义番号识别规则，能从带片名的文件名识别番号。
- **Settings**: The data directory can be changed in first-time setup and Settings, with usage stats and cleanup. / **配置**：数据目录可在首次设置与设置页更改，并能统计与清理占用。
- **Settings**: Each media library can set its own source color and processing, run per library; the number of new releases shown is adjustable in Settings. / **配置**：每个媒体库可单独设置来源色与处理方式，处理流程按库执行；新作显示数量可在设置里调整。
- **Interface**: List view shows tags, progress, avatars; Tasks collects background issues, failed cards link fixes, face models can re-download; a banner shows when offline. / **界面**：列表视图显示标签、观看进度与头像；任务中心汇总后台问题，失败卡附处理入口，人脸模型下载失败时可重新下载；连不上外网时页面顶部给出提示。
- **Sourcing**: Public entity data ships with each release. / **采集**：公共实体资料随版本分发。
- **Updates**: macOS installers also offer the matching FFmpeg and untrunc source downloads. / **更新**：macOS 安装包同时提供 FFmpeg 与 untrunc 的对应源码下载。

### Changed / 变更

- **Interface**: Pages load faster: avatars, covers, and site icons load at display size, cutting Home image data by about 70%, and rarely used pages load on demand. / **界面**：页面加载更快。头像、封面与站标按显示尺寸取图，首页图片总量约减少七成；不常用的页面按需加载。
- **Interface**: Scrolling, carousels, the video wall, and sidebar toggling are smoother, and idle pages no longer keep using the CPU. / **界面**：滚动、横向轮播、播放墙与侧栏开合更流畅，页面空闲时不再持续占用处理器。
- **Following**: Following and taste analysis are much faster; taste analysis shows the last result first and updates when the background run finishes. / **关注**：关注页与口味分析明显加快；口味分析先显示上次结果，后台算完自动更新。
- **Library**: Stats, filter options, performer and studio rosters, and folder view recompute only after data changes; folder view opens about 10x faster. / **馆藏**：统计、筛选项、人物与厂牌名册、文件夹视图只在资料变化后重算，文件夹视图打开快约十倍。
- **Settings**: Settings are regrouped: transcoding moves to Maintenance → Playback, and Group parts and editions to Playback in the settings panel. / **配置**：设置项重新分组排序：转码方式在「应用与维护 → 视频播放」，「合并分卷与版本」在设置面板「浏览与播放」。
- **Interface**: Primary actions sit right, links left; scoped retries all say Retry now; loading is an animation with Loading; row controls match height, inline icons scale. / **界面**：按钮统一为主动作在右、链接在左；带范围的重试统一叫「立即重试」；加载状态统一为动画加「载入中」；同一行控件等高，行内图标随字号缩放。
- **Settings**: All outbound requests follow the Peach proxy setting; PikPak organizing and browser control no longer use the system proxy. / **配置**：所有外部请求遵循 Peach 代理设置，PikPak 整理与浏览器控制也不再走系统代理。
- **Ledger**: Only the 5 most recent pre-organize ledger backups are kept. / **账本**：整理前的账本备份只保留最近 5 份。

### Fixed / 修复

- **Interface**: Popovers and notices such as Search torrents appear above details, and the Prefer dropdown matches the input width. / **界面**：详情页里「查找资源」等弹层与操作提示显示在详情之上，「优先寻找」下拉与输入框同宽。
- **Interface**: Load more no longer stalls at the bottom of Home. / **界面**：首页滚到底时「加载更多」不再卡住。
- **Interface**: The vertical video area shows only its own videos and parts, no duplicate titles; light theme gets hover, zoom isn't clipped, card edges lose color lines. / **界面**：竖屏视频区只显示视频自己的画面与竖屏分卷，同一作品不再重复出卡；浅色主题下有悬停效果，放大不被裁切，卡片边缘不再出现色线。
- **Interface**: The settings page shows placeholders in the real layout, so it no longer jumps when data arrives; persistent task cards aren't dismissed early on cold start. / **界面**：设置页加载时按真实布局显示占位，数据回来时不再大幅跳动；冷启动时常驻任务卡不再被提前收走。
- **Playback**: Hover previews no longer start uncancelable full transcodes; dropped segment requests also end their transcode processes. / **播放**：悬停预览不再启动无法取消的整片转码；分片请求断开时同时结束对应的转码进程。
- **Following**: Covers for new releases outside the library load through the Peach proxy per outbound settings, showing Cover not found when unavailable. / **关注**：库外新作封面经 Peach 代理按出网设置取图，取不到时显示「封面未取得」。
- **Sourcing**: Resumed metadata fetches retry only remaining codes; new release covers aren't sent twice; missing bridge parts rebuild or explain why; JavBus uses Chinese. / **采集**：取资料续跑只重试剩下的番号，补新作封面不再重复派发；安装包或 Docker 缺资料桥组件时能重建或说明原因；JavBus 请求统一使用中文语言偏好。
- **Library**: The Trash maps file paths through mounts, so unreadable media isn't treated as deletable; permanent deletion follows the mount type. / **馆藏**：回收站按挂载映射文件路径，读不到的媒体文件不会被当成可删除；永久删除按挂载类型执行。
- **Library**: Local trailers no longer show as separate title cards; file names with forum wrappers or Remux are recognized for video codes. / **馆藏**：本地预告片不再单独显示成一张作品卡；带论坛包装或 Remux 字样的文件名也能识别出番号。
- **Updates**: Install or update fails right away when the old tray can't be stopped, instead of waiting. / **更新**：安装或更新时停不下旧托盘会立即报错，不再空等。
- **Settings**: Settings no longer errors over LAN HTTP; public endpoint handshakes run in the background so offline local access works; the old config stays until first save. / **配置**：局域网 HTTP 访问时配置页不再出错；公网入口握手放到后台，断网时本机访问不受影响；首次保存配置前保留原配置。
- **Interface**: Avatar changes accept common image formats and explain failures; external links open in a new tab; face models and site icons retry after the network returns. / **界面**：更换头像支持常见图片格式并说明失败原因；站外链接一律在新标签页打开；断网后人脸模型与站点图标自动重试。

### Security / 安全

- **Settings**: Transcoding and thumbnail tiers can only be changed on the computer running Peach, not from LAN or public devices. / **配置**：转码方式与缩略图档位只接受运行 Peach 的电脑修改，局域网或公网访问的设备不能改。
- **Settings**: Diagnostics bundles redact field names and record API rejection reasons. / **配置**：诊断包对字段名脱敏，并记录接口拒收原因。

## [0.48.1] - 2026-10-24

No artifacts for this release: the tag pipeline's audit found a high-severity happy-dom flaw (test-only, not shipped). See 0.48.2 for installers and notes. / 这一版没有发布制品：标签流水线的依赖审计发现 happy-dom 的高危漏洞（只用于测试，不进安装包）；安装包与完整的变化说明见 0.48.2。

## [0.48.0] - 2026-10-23

This release shipped only the Docker image; see 0.48.1 for Windows and macOS installers and full notes. / 这一版只发布了 Docker 镜像；Windows 与 macOS 安装包和完整的变化说明见 0.48.1。

## [0.47.3] - 2026-10-21

### Added / 新增

- **Desktop**: Standalone macOS apps and DMGs for Apple Silicon and Intel run without Python or a source folder. / **桌面**：提供 Apple Silicon 与 Intel 两种 macOS 独立应用及 DMG，运行时无需 Python 或源码目录。
- **Updates**: GitGud releases and R2 downloads are supported; update checks read both R2 and GitHub and pick the installer by version. / **更新**：支持 GitGud 发版与 R2 下载；更新检查同时读取 R2 和 GitHub，按版本选择安装包。
- **Library**: Tag management unifies tag identity, aliases, and interactions. / **馆藏**：提供标签管理，统一标签身份、别名与交互。
- **Sourcing**: Before a run, traffic and disk needs are estimated per folder; runs show per-disk usage, accounting for pending items and caches. / **采集**：启动前按目录预估流量与磁盘需求，运行中展示逐盘用量，并考虑待处理项与缓存。
- **Interface**: Copy can be edited in place, with link check results and feedback. / **界面**：支持原位编辑文案，提供链接检查结果与反馈。

### Changed / 变更

- **Library**: Organize templates improve, organizing a chosen folder and cleaning file name symbols; tables support column resizing, kept sorting, and horizontal scroll. / **馆藏**：完善整理模板，支持指定目录整理并清理文件名符号；表格支持调整列宽、保留排序与横向滚动。
- **Sourcing**: Cloud download channels are built from media library and cloud drive capabilities, and browser add settings match the download channels. / **采集**：云下载渠道按媒体库与网盘能力生成，浏览器添加设置与下载渠道一致。
- **Interface**: Cards, loading skeletons, empty states, and mobile settings are unified, with better task results, folder browsing, and detail links. / **界面**：统一卡片、加载骨架、空状态与移动端设置交互，完善任务结果、文件夹浏览和详情入口。

### Fixed / 修复

- **Playback**: Subtitle choice is saved per video, the hardware transcode backend is auto-detected, and Linux VAAPI is supported. / **播放**：保存每部视频的字幕选择，自动探测硬件转码后端，支持 Linux VAAPI。
- **Sourcing**: Junk checks use media and folder evidence to spot short ads, protect parts and source watermarks, and unify media processing order. / **采集**：垃圾检查结合媒体与目录证据识别短广告，保护分卷和来源水印，并统一媒体处理顺序。
- **Sourcing**: r18 title candidates are reviewed against source text snapshots, keeping the matching evidence. / **采集**：r18 标题候选按来源原文快照复核，保留对应证据。
- **Settings**: CloudDrive2 notification config is generated from the app service protocol, syncing the cloud drive proxy setting. / **配置**：按应用服务协议生成 CloudDrive2 通知配置，同步网盘代理设置。
- **Settings**: Diagnostics tell expected disconnects from real failures, fully log browser and transcode errors, and show this week's research upload status and receipts. / **配置**：诊断区分预期断连与实际故障，完整记录浏览器及转码异常，并展示当前周研究上传状态与传输回执。
- **Desktop**: macOS disk images keep Japanese resource names, symlinks, and app signatures. / **桌面**：macOS 安装镜像保留日文资源名、软链及应用签名。
- **Updates**: Lightweight installers fetch same-version tools from R2 first and verify size and SHA-256 against the bundled manifest. / **更新**：轻量安装包优先从 R2 获取同版本工具，按内置清单校验大小与 SHA-256。

## [0.46.1] - 2026-10-19

### Added / 新增

- **Settings**: New Send version stats and error reports (recommended) option, on by default, off in installer or Settings; reports hold version, OS, fault, code site, counts. / **配置**：提供「发送版本统计与错误诊断（推荐）」选项，安装时默认勾选，可在安装器和配置页关闭；错误诊断包含版本、系统、故障类型、代码位置和汇总次数。
- **Library**: Adds an off-by-default library and taste upload that previews local data and sends weekly after consent; tags are only manual or explicitly favorited ones. / **馆藏**：提供独立、默认关闭的馆藏与口味上传选项，预览本机数据并明确同意后按周发送；标签仅使用手动标记和明确收藏的标签。
- **Library**: Long tasks save persistent checkpoints and resume unfinished work after a service restart; taste analysis reads local browser bookmarks and bookmark files. / **馆藏**：长时任务保存持久检查点，服务重启后继续未完成部分；口味分析支持本机浏览器书签和书签文件。
- **Playback**: Chinese subtitle search with one subtitle menu, loading state and cancel; SubtitleCat subtitles match by release identity; YouTube subtitle settings improve. / **播放**：支持搜索中文字幕，提供统一的字幕菜单、加载状态与取消操作，按发行身份匹配 SubtitleCat 字幕；完善 YouTube 字幕设置。
- **Sourcing**: The browser sourcing userscript has separate standalone and Sleazy install links. / **采集**：浏览器采集脚本提供独立安装与 Sleazy 安装入口。

### Changed / 变更

- **Sourcing**: Scanning and sourcing run faster, estimate remaining time from whole-run progress, and share one set of speed tiers and task controls. / **采集**：加快扫描与采集，按整趟任务进度估算剩余时间，统一处理速度档位与任务控件。
- **Settings**: Upload previews use copy- and download-ready code blocks with counts, size and data notes, collapsing on consent; CloudDrive config and custom metadata too. / **配置**：上传预览使用可复制、可下载完整内容的代码块，数量、大小与个人数据说明集中显示；同意后收起预览。CloudDrive 配置与自定义元数据响应共用代码块。
- **Library**: The public request board and roadmap share one entry, and feedback and planning use the same board. / **馆藏**：统一公开需求看板与路线图入口，反馈和规划使用同一看板。

### Fixed / 修复

- **Desktop**: Builds and acceptance use only public release resources; the installer no longer includes local entity exports. / **桌面**：构建与验收仅使用公开发行资源，安装包不包含本机实体导出。
- **Settings**: Expected states (filter cancels, normal disconnects, stdlib cleanup) keep local evidence; real faults are aggregated; the installer helper keeps local options. / **配置**：筛选取消、正常断连和标准库资源清理等预期状态，保留本机诊断证据，并聚合需要开发处理的故障次数；安装辅助进程仅保存本机选项。
- **Interface**: Diagnostics refines its title table, status badges, scroll nav and source site icons; confirm-list scrolling, task icons and data table panels are unified. / **界面**：完善系统诊断中的作品表格、状态标识、滚动导航和来源站图标；统一确认清单滚动、任务图标与数据表面板。
- **Interface**: Cover padding matches large-cover framing; search suggestions and preview frame persist after the IME closes; standalone pages isolate request error handling. / **界面**：封面补底与大封取景保持一致；输入法收起后保留搜索建议与预览画框；独立页面隔离请求错误依赖。

## [0.45.0] - 2026-10-18

### Added / 新增

- **Desktop**: A lightweight installer verifies and reuses existing media tools, downloading only if missing or changed; setup can retry and existing installs keep working. / **桌面**：提供轻量安装包，安装时校验并复用已有媒体工具，仅在缺失或版本变化时下载；工具准备失败可重试，现有安装保持可用。
- **Sourcing**: Userscript: Add to Peach on supported sites sends the video code to the default cloud drive for the usual import; Settings installs it and manages its token. / **采集**：提供浏览器用户脚本，在支持站点点击「加入 Peach」后按番号搜索并提交到默认网盘，沿用现有下载与入库流程；配置页可安装脚本并管理专用令牌。

## [0.43.0] - 2026-10-18

### Added / 新增

- **Library**: Scan and sourcing tasks get a persistent task card, three processing levels, pause control and time estimates; scans show found file count and size as they go. / **馆藏**：扫描与采集任务提供常驻任务卡、三档处理强度、暂停控制和预估耗时；扫描过程中持续显示已发现的文件数与大小。
- **Playback**: Mounted cloud drives get unified read-write access and complete brand icons / **播放**：统一开放挂载网盘读写并补齐品牌图标

### Fixed / 修复

- **Library**: Taste import reads 115 Browser `HistoryEx` history files by their actual table layout, supports multiple profile folders and keeps a manually set profile root. / **馆藏**：口味导入支持 115 浏览器的 `HistoryEx` 历史文件，按实际表结构读取访问记录，兼容多个资料目录并保留手动指定的资料根。
- **Interface**: Task controls use one neutral style; light and dark popovers, scan steps and task status display are refined. / **界面**：任务控件使用统一的中性样式，完善深浅色浮层、扫描步骤与任务状态显示。
- **Playback**: Adds AV1 software decoding and end-to-end diagnostics / **播放**：补齐 AV1 软件解码与全链路诊断
- **Interface**: Notifications use a shared screen-reader announcement and appear once their position settles. / **界面**：通知使用共享读屏提示，定位稳定后显示。
- **Updates**: Update protection tasks unregister in order. / **更新**：更新保护任务按顺序撤下登记。
- **Library**: Long-running tasks keep showing confirmed results. / **馆藏**：长跑任务持续显示已确认的结果。
- **Following**: Following sourcing results save item by item and keep progress after interruption / **关注**：逐项保存关注采集结果并保留中断进度
- **Sourcing**: Checks local NFO metadata and fixes version conflicts in consecutive reviews / **采集**：核查本地 NFO 资料并修复连续复核版本冲突

## [0.42.0] - 2026-10-17

### Added / 新增

- **Updates**: Full installer, full portable and update packages; updates reuse verified tools, fetching tool packs only when needed; old updaters get the full package once. / **更新**：提供完整安装包、完整免安装包和应用更新包。自动更新校验并复用已安装工具，仅在工具缺失、损坏或版本变化时下载对应工具包；旧版更新器首次升级仍下载完整包。
- **Library**: STRM files play on demand; mounted Guangya, OneDrive and other cloud drive folders can be registered and managed read-only. / **馆藏**：支持 STRM 文件按需播放；支持登记已挂载的光鸭、OneDrive 和其他网盘目录，按只读方式管理。
- **Settings**: Each cloud drive folder, PikPak included, can use Normal or Data saver reading; the mount tool handles the actual proxy. / **配置**：网盘目录可分别选择「正常读取」或「代理流量保护」，包括 PikPak；实际代理由挂载工具配置。
- **Settings**: Generate previews controls contact sheets and timeline frames; when off, duration and resolution are still probed by source rules. Timeline previews start off. / **配置**：「生成视频预览」统一控制九宫格与时间轴抽帧；关闭后仍按来源规则探测时长与分辨率。时间轴预览默认关闭。

### Changed / 变更

- **Playback**: The player moves to Video.js 10 with unified playback sessions and resume handling. / **播放**：播放器采用 Video.js 10，统一播放会话与续播处理。

### Fixed / 修复

- **Playback**: Playback waits for media mounts to be ready; media reads and CLI frame extraction follow folder read policies and video preview settings. / **播放**：播放前等待媒体来源挂载就绪；媒体读取与命令行抽帧遵循目录读取策略和视频预览设置。
- **Library**: Read-only mounted folders disable writes such as file renames and index repairs. / **馆藏**：只读挂载目录禁用文件改名与索引修复等写入操作。
- **Sourcing**: Browser sourcing respects Peach's explicit direct-connection settings. / **采集**：浏览器采集遵循 Peach 的显式直连设置。
- **Interface**: Detail pages show video thumbnails; data tables get an overlay horizontal scrollbar; horizontal nav, admin levels, Settings and empty source lists align. / **界面**：详情页显示视频缩略图；数据表支持横向覆盖式滑块，横向导航、管理页层级、配置页与来源空列表使用一致的布局。

First install: `Peach-0.42.0-windows-x64-setup.exe`; portable: full ZIP. Skip the third-party `*-corresponding-source.zip`; the updater fetches `tools-*.zip` itself. / 首次安装请选择 `Peach-0.42.0-windows-x64-setup.exe`，免安装使用请选择完整 ZIP。`ffmpeg-corresponding-source.zip` 和 `untrunc-corresponding-source.zip` 是第三方工具的对应源码，普通使用无需下载；`tools-*.zip` 由更新器按需下载，无需手动选择。

## [0.41.0] - 2026-10-17

### Added / 新增

- **Library**: Browse titles by original folder via folder tree and breadcrumbs; preview and confirm a folder's purpose and whether new files inherit its rules. / **馆藏**：支持按原目录浏览作品，通过目录树和面包屑限定范围；可预览并确认目录用途，选择是否让新文件沿用归属规则。
- **Interface**: Library and profile pages switch between cards and tables; tables sort, page and bulk-select across pages, and narrow screens lay out by available space. / **界面**：馆藏与资料页支持卡片、表格切换；表格提供排序、分页和跨页批量选择，窄屏按可用空间排列内容。
- **Desktop**: Windows installer and portable builds bundle FFmpeg, ffprobe and untrunc for transcoding, thumbnails and broken MP4 index repair; the release page links source. / **桌面**：Windows 安装版与免安装版携带 FFmpeg、ffprobe 和 untrunc，可用于转码、缩略图和损坏 MP4 索引修复；发布页提供媒体工具对应源码。

### Fixed / 修复

- **Sourcing**: Cover fetching queries the real official catalog and picks by actual resolution; titles lacking source snapshots can be rechecked; transient failures retry. / **采集**：封面抓取查询实际官方目录，按候选图像的实际分辨率择优；支持补查缺少来源快照的作品，并重试暂时失败的连接。
- **Sourcing**: Official covers and fallback sources both exclude JavDB images, keeping watermarked covers out of the gallery. / **采集**：正式封面与备用来源均排除 JavDB 图像，避免水印封面进入图库。
- **Library**: Covers are classic sleeve, centered front and spineless large cover, fixing spine and edge crops; large covers frame the face or show whole on plain cards. / **馆藏**：按版式区分传统封套、居中正封与无书脊大封，修正书脊和左侧边缘裁切；大封竖版围绕主要人脸取景，横版完整显示原图，卡片使用纯色底。
- **Library**: Stale face and crop caches are recomputed automatically; manually picked frames are kept. / **馆藏**：自动重算过期的人脸与裁切缓存，保留手动选帧。
- **Interface**: Returning from details keeps the list page and sort; filter buttons, Explore profile actions and Shuffle share consistent sizing and action styles. / **界面**：从详情返回列表时保留页码与排序；筛选按钮、探索页资料动作和「换一批」使用一致的尺寸与动作样式。
- **Following**: Narrow-screen cards size their height by visible text and tags. / **关注**：窄屏卡片按可见文字与标签分配高度。
- **Updates**: Sourcing pauses during install and resumes after it ends or is canceled; shutdown waits for tasks to release the ledger, and tasks start once it is ready. / **更新**：安装期间暂停采集并保存进度，安装完成或取消后续跑；服务关停时等待后台任务释放账本，后台任务按账本就绪状态启动。
- **Library**: Public metadata seeds are checked by version and content, retracting only their wrong assertions and keeping other sources' attributions; legacy tables migrate. / **馆藏**：公开资料种子按版本和内容校验，精确撤回其错误断言并保留其他来源的归属；支持历史表迁移。
- **Desktop**: The diagnostics report window can close and open the report; release page install notes mention the bundled media tools. / **桌面**：诊断报告窗口支持关闭和打开报告；发布页安装提示说明随包媒体工具。

## [0.40.1] - 2026-10-16

This is the first Windows test build of the 0.40 series and includes all app changes recorded for 0.40.0. / 本版是 0.40 系列首个 Windows 测试包，包含 0.40.0 记录的全部应用改动。

### Fixed / 修复

- **Desktop**: Windows installer and portable packages build from the full locked dependencies; the installer lets you choose the program folder. / **桌面**：Windows 安装包与免安装包使用完整的锁定依赖构建；安装包支持选择程序目录。
- **Desktop**: The tray starts on its own when the Windows desktop is in a shared Job and keeps running after the terminal or agent exits. / **桌面**：Windows 桌面处于共享 Job 时可独立启动托盘，终端或智能体退出后保持运行。
- **Desktop**: Shortcut operation timeouts show the wait time and a retry hint. / **桌面**：快捷方式操作超时会显示等待时长和重试提示。
- **Settings**: First-run setup can reconnect an existing data folder; upgrades keep settings, ledger and access password and remember the data folder. / **配置**：首次设置可接回已有数据目录；升级沿用配置、账本和访问密码，并记住数据目录。
- **Settings**: Media folder validation keeps drive-letter paths for mapped NAS drives. / **配置**：媒体目录校验保留 NAS 映射盘的盘符路径。

### Added / 新增

- **Desktop**: Startup failures show an error log, and a redacted diagnostics bundle can be exported from the tray or the Diagnostics page. / **桌面**：启动失败可查看错误日志，并从托盘或系统诊断页导出脱敏诊断包。
- **Playback**: One metadata completion entry handles online metadata and local preview frames, with a menu to pick a method on its own. / **播放**：资料补全入口统一处理在线资料与本地抽帧预览，可通过菜单单独选择补全方式。

### Changed / 变更

- **Interface**: Data tables support sorting, paging and floating bulk actions. / **界面**：数据表支持排序、分页和浮动批量操作。

## [0.40.0] - 2026-10-15

### Added / 新增

- **Desktop**: The Windows installer lets you choose the program folder. / **桌面**：Windows 安装包支持选择程序目录。
- **Desktop**: Startup failures capture error evidence and a redacted diagnostics bundle; the tray and Diagnostics page can export the report. / **桌面**：启动失败时提供错误取证和脱敏诊断包；托盘和系统诊断页可导出报告。
- **Playback**: Metadata completion and local video previews share one task entry with a choice of method. / **播放**：资料补全和本地视频预览使用统一任务入口，可选择补全方式。
- **Settings**: Adds a Linux amd64 Docker image with automated publishing; CloudDrive2 runs separately; ARM NAS and real cloud drive mounts need checks on the target machine. / **配置**：提供 Linux amd64 Docker 镜像与自动发布入口；CloudDrive2 单独运行，ARM NAS 和真实网盘挂载需在目标机器验收。

### Fixed / 修复

- **Settings**: Saves a custom data folder and switches to it once the tray finishes setup; the setup service runs only what configuration needs. / **配置**：保存自选数据目录，托盘完成设置后切换到该目录；设置服务只运行配置所需功能。
- **Settings**: The first-run setup page can reconnect an existing data folder, keeping settings, ledger and access password. / **配置**：首次设置页可接回已有数据目录，沿用配置、账本和访问密码。
- **Updates**: Update transactions keep the current data folder; deployments that open the library from a specified data folder remember it after upgrading. / **更新**：更新事务沿用当前数据目录；通过指定数据目录进入馆藏的部署，升级后可记住该位置。
- **Desktop**: Supports Windows desktop Jobs that allow breakaway, so the tray runs independently of the terminal or agent that launched it. / **桌面**：兼容允许脱离的 Windows 桌面 Job，托盘独立于启动它的终端或智能体运行。
- **Playback**: Windows probing, frame extraction, previews and media repair run as silent subprocesses, so no console window pops up. / **播放**：Windows 探测、抽帧、预览和媒体修复使用静默子进程，避免前台弹出控制台。
- **Interface**: Data tables support paging, sorting and bulk actions; the method menu stays closed while processing and hints wrap to the available width. / **界面**：数据表支持分页、排序和批量处理；补全方式菜单在处理中保持关闭，提示随可用宽度排列。
- **Interface**: Media navigation uses scroll dots and edge hints, and Following details share the nav backdrop; official trailers and cover fallbacks are filled in. / **界面**：媒体导航使用滚动圆点和边缘提示，关注详情共用导航底衬；补齐官方预告与封面回退。
- **Following**: Keeps task cards, Following cards and lookup input; tidies task records, diagnostic priorities and the Following hierarchy. / **关注**：保留任务卡片、关注卡片和查找输入，整理任务记录、诊断优先级与关注层级。
- **Library**: MISSAV performer links follow its directory with kanji, kana and space variants, hiding failed ones; original glyphs kept; links and Chinese names reviewed. / **馆藏**：按站点名录生成 MISSAV 艺人入口，匹配汉字、假名和空白变体，隐藏验证失败的入口；保留姓名原字形，复核艺人外部入口与中文名。
- **Library**: Adjusts avatar placeholders, auto profile thumbnails, wide sleeve framing and local processing of online covers. / **馆藏**：调整头像占位、自动档案缩略图、宽封套取景和在线封面的本地处理。
- **Interface**: Deep links show a matching loading state and reuse the detail cache; hints follow visible content; filter skeletons and Following cards share a neutral style. / **界面**：深链首屏使用对应内容的等待态并复用详情缓存；提示按可见内容定位，筛选骨架和关注卡片使用一致的中性样式。

If first-run setup appears though you have a library, choose Use existing data and enter its peach-data folder. Deployments without a known folder pick it once. / 已有馆藏却出现首次设置页时，可选择“使用已有数据目录”，填入保存馆藏的 peach-data 目录。未取得目录位置的部署需要选择一次。

This release includes local diagnostics; remote telemetry and feedback upload are not wired up yet. / 本版包含本地诊断能力；远程遥测和问题反馈上传尚未接入。

## [0.39.0] - 2026-10-14

### Added / 新增

- **Library**: The JAV section offers Library, Discover and Wants; titles outside the library show details, samples, previews, reviews and resources, explorable by taste. / **馆藏**：JAV 分区提供馆藏、发现与想要入口；库外作品可在站内查看详情、样张、预览、评论和资源，并按口味探索作品。
- **Interface**: Favorites gathers performers, creators, makers and studios, series, agencies and tags with saved filters; its popover reuses the Settings glass and navigation. / **界面**：「我的收藏」集中管理艺人、创作者、片商与厂牌、系列、事务所和标签，支持保存命名筛选；弹层沿用配置页的液态玻璃与导航。
- **Playback**: A standalone video wall supports auto-continue, scope filters and immersive browsing; external players can use time-limited signed links. / **播放**：提供独立视频播放墙，支持自动接续播放、范围筛选和沉浸浏览；可通过限时签名链接使用外部播放器。
- **Sourcing**: Supports restricted custom sources, source diagnostics, magnet fetching and post-import processing; fetched remote media is cached locally. / **采集**：支持受限自定义来源、来源诊断、磁力抓取与入库后处理；已取得的远程媒体保存在本地缓存中。
- **Interface**: Search suggestions show title covers and author avatars, and single-type results scroll; Following detail recommendations cover videos and images. / **界面**：搜索推荐展示作品封面与作者头像，单类结果可滚动查看；关注详情推荐覆盖视频和图片。
- **Settings**: Preferences and service entries are organized by use case, taste dimensions and browser source management expand, and a JAV workbench is added. / **配置**：按使用场景组织偏好与服务入口，扩展多维口味与浏览器来源管理，并提供 JAV 工作台。

### Changed / 变更

- **Interface**: Assets, titles and Following posts use `/assets/:id`, `/works/:code` and `/posts/:id`; old URLs redirect. / **界面**：资产、作品与关注条目分别使用 `/assets/:id`、`/works/:code` 和 `/posts/:id`，旧地址可跳转。
- **Sourcing**: Title metadata, reviews and resources cache by release date: new titles refresh, month-old ones keep a fixed cache, and failed refreshes keep fetched data. / **采集**：作品资料、评论与资源按发行日期复用缓存；新作定期更新，已发行超过一个月的作品保留固定缓存，刷新失败时保留已取得内容。
- **Library**: New-release tags use unified Simplified Chinese names and local synonyms and drop non-content tags; resource links in reviews join the title's resource list. / **馆藏**：新作标签统一简体名称与本地同义映射，并过滤非内容标签；评论中的资源链接汇入作品资源列表。

### Fixed / 修复

- **Playback**: Official previews load via a browser-compatible connection and refresh signed playlists periodically; ABF-383 plays and MIKR-122 keeps loading later segments. / **播放**：官方预览可通过浏览器兼容连接取得视频，并定期更新带签名的播放清单；ABF-383 可播放，MIKR-122 可继续读取后续分片。
- **Playback**: Following and library videos keep resume time on exit; theater mode expands inside the detail frame and hides thumbnails, and arrow keys seek during playback. / **播放**：关注与馆藏视频退出后保留续播时间；影院模式在详情框体内展开并隐藏缩略图，播放时方向键控制快退与快进。
- **Interface**: Closing Explore details restores filters, list and scroll position; review loading shows only a local rounded skeleton and details stay visible. / **界面**：关闭探索详情时恢复原有筛选、列表与浏览位置；评论加载只显示局部圆角骨架，详情信息保持可见。
- **Interface**: Favorites entry, light nav icons, shadows and settings entry match; card hover backgrounds, source icons, recommendations and narrow-screen buttons look right. / **界面**：收藏入口、亮色导航图标、阴影与配置入口保持一致；卡片悬停背景、来源图标、推荐布局和窄屏操作按钮正常显示。
- **Library**: New releases show all cast members and online creator avatars, library details reuse the title's source samples, and unregistered studios show name only. / **馆藏**：补齐新作多位出演者与在线创作者头像，馆藏详情沿用作品来源样图；未登记的厂牌只显示名称。
- **Following**: Cover retries, image sizes and masonry positions stay stable, tasks stay busy from submit to polling, and non-media responses stay out of the browser cache. / **关注**：封面重试、图片尺寸和瀑布流位置保持稳定，任务从提交到轮询保持忙态；非媒体响应不会进入浏览器缓存。
- **Library**: Merges keep favorite references; tag data respects hidden scopes; trash shows why items are there and restores videos; same-name files of other durations stay. / **馆藏**：实体合并保留收藏引用，标签资料遵守隐藏范围；回收站显示归入原因并支持视频还原，时长不同的同名文件分别保留。

## [0.38.0] - 2026-10-10

### Added / 新增

- **Following**: Online authors get a profile page with local and online works, filtered by video, image, source and duration; going back to Following restores scroll position. / **关注**：在线作者拥有独立资料页，可切换本地与在线作品，并按视频、图片、来源和时长筛选；返回关注页时恢复浏览位置。
- **Library**: Avatars come from gallery portraits, title frames, local images or URLs, with crop and full preview; accounts lacking identity proof show a labeled sample. / **馆藏**：头像可从图库人像、作品画面、本机图片和图片地址选择，支持裁剪与整图预览；缺少本人身份依据的账号展示代表作画面并标明用途。
- **Following**: Wants supports to-find and on-hold states, with resource search, source info and library reconciliation. / **关注**：想要清单支持待找与暂时放弃，提供资源搜索、来源信息和入库对账。
- **Sourcing**: Resource search supports custom indexers and torrent links; cloud download supports 115 and PikPak (browser sign-in); CloudDrive2's local port is auto-detected. / **采集**：资源搜索支持自配索引器和种子链接，云下载支持 115 与 PikPak；PikPak 可通过浏览器登录，CloudDrive2 可自动探测本机端口。
- **Settings**: The Diagnostics page and local doctor command run tiered health checks, and media mount failures show the specific cause. / **配置**：系统诊断页与本机 doctor 提供分级健康检查，媒体挂载故障显示具体原因。
- **Library**: Data management lists orphan records and links them to new files; old links to merged entities redirect to the merged one. / **馆藏**：数据管理可查看孤儿记录并连接到新文件；实体合并后的旧链接可跳转到合并后的实体。

### Changed / 变更

- **Interface**: Library, Following, profile, management and Settings pages use React routing; detail popovers, the player and persistent controls share navigation state. / **界面**：馆藏、关注、资料、管理与设置页面统一使用 React 路由入口；详情浮窗、播放器和常驻控件共享导航状态。
- **Settings**: Settings is organized into five groups; first-run, sign-in and error pages share UI components. / **配置**：配置页按五组组织，首启、登录与错误页面共用界面组件。
- **Playback**: Player styles load on demand, and detail scrolling and playback layout do less repeated work. / **播放**：播放器样式按需加载，详情滚动与播放布局减少重复计算。
- **Desktop**: The tray runs independently of the terminal; restarts sync dependencies, run ledger migrations and check for running tasks. / **桌面**：托盘独立于终端运行；重启时同步依赖、执行账本迁移并检查正在运行的任务。

### Fixed / 修复

- **Interface**: Switching parts, versions and history in details keeps the popover and focus; closing details returns to the source page; stale page requests are canceled. / **界面**：详情中切换分卷、版本及历史条目时保留浮窗与焦点，关闭详情可返回对应来源页面；过期的页面请求会取消。
- **Interface**: Long titles, large numbers and narrow layouts stay readable; gallery keyboard nav, long-press copy and search controls respond correctly. / **界面**：长标题、大读数与窄屏布局保持可读，图库键盘导航、长按复制和搜索控件正常响应。
- **Library**: Account categories and avatar picks follow identity sources, aliases keep only identity names, and company data and public profiles keep reviewable evidence. / **馆藏**：账号分类与头像选择遵循身份来源，人物别名仅保留身份名称；公司资料与公开档案保留可复核依据。
- **Library**: When media disappears and is re-registered, uniquely matchable personal records are kept and reattached; title counts and part folding use the same criteria. / **馆藏**：媒体消失与重新登记时保留并接回可唯一匹配的个人记录，作品计数与分卷折叠使用一致判据。
- **Following**: Images reserve space by aspect ratio and stale ones clear on avatar and cover updates; video post detection, cover fallback and rate limiting are consistent. / **关注**：图片按比例预留空间，更新头像与封面时清理过期图像；视频帖识别、封面回退与来源限流处理保持一致。
- **Sourcing**: Tag attribution and synonym mapping follow source criteria, scans reuse merged performer identities, and progress write failures no longer stop tasks. / **采集**：标签归属与同义映射遵循来源判据，扫描沿用已合并的艺人身份；进度写入失败不会中断任务。

## [0.37.0] - 2026-10-01

### Added / 新增

- **Desktop**: Windows adds an installer, `Peach-<version>-windows-x64-setup.exe`, that needs no admin rights; the portable zip remains and both share one data set. / **桌面**：Windows 版多了安装包 `Peach-<版本>-windows-x64-setup.exe`，无需管理员权限；免安装 zip 仍提供，两种共用一份数据。
- **Following**: JAV subscriptions can be added by performer name; the subscription list shows performer photos with paging and bulk actions. / **关注**：JAV 订阅支持按女优名添加，订阅列表显示人物资料图，并提供分页与批量操作。
- **Library**: Performer photo sets show samples grouped by title; resource sync checks and cleans up dead records and empty folders. / **馆藏**：女优照片档按作品分段展示样张；资源同步可检查并清理失效记录与空文件夹。

### Changed / 变更

- **Interface**: Toasts use Sonner's stacked style: several at once stack up, expand on hover and can be swiped away. / **界面**：操作提示改用 Sonner 的堆叠样式，几条同时出现时叠成一摞，鼠标移上去展开，可以滑动关掉。
- **Interface**: Library, Following, index, data management and playlists share cards, tables, filters and action bars. / **界面**：馆藏、关注、索引、数据管理和播放列表使用统一的卡片、表格、筛选与操作底栏。

### Fixed / 修复

- **Library**: Old DVD sleeves with thick spines and vertical titles no longer show a strip of spine on the left of the card front. / **馆藏**：书脊较厚、印着竖排片名的老式 DVD 封套，卡片正封左边不再带着一截书脊。
- **Interface**: While the setup guide card sits in the bottom right, toasts appear above it instead of covering it. / **界面**：安装教程卡还在右下角时，操作提示改为显示在它上方，不再挡住教程。
- **Interface**: The stats page shows the selected charts and rankings on first load, refresh skeletons line up with content, and storage usage shows in true proportion. / **界面**：统计页首次显示就包含所选图表和排行，刷新时骨架与内容对齐；使用空间按真实比例显示。
- **Interface**: Home shows a loading skeleton only if new releases exist; video skeletons follow the large or small setting; new-release loading and cover framing stay stable. / **界面**：首页根据是否有新作显示加载骨架，视频骨架跟随大图、小图设置；新作加载与封面取景保持稳定。
- **Interface**: Default video cover size matches between settings and the filter bar, large view uses one frame, and undo in toasts follows the accent color. / **界面**：视频封面默认大小在设置和筛选条中一致，大图统一画面框；提示中的撤销操作跟随强调色。
- **Settings**: Source credentials get site icons, the GitHub link icon sits on the same line as the external-link icon, and credential inputs fill the available width. / **配置**：来源凭据补齐站点图标，GitHub 链接的图标与外链图标同行，凭据输入框铺满可用宽度。
- **Sourcing**: Codes and tags match by source identity; r18.dev English names stay out of title, series and cast candidates; performer completion can bind JavDB pages by name. / **采集**：番号与标签按来源身份匹配，r18.dev 的英文译名不进入标题、系列和演员候选；补女优资料可按名字绑定 JavDB 演员页。
- **Review**: Manually approved tags merge as a union, keeping existing approvals; metadata follow-ups and processing tasks continue in Tasks. / **复核**：人工批准的标签按并集补齐，保留已有批准内容；资料后继与处理任务在任务中心接续。

## [0.36.0] - 2026-09-26

### Added / 新增

- **Interface**: Search dropdown tabs cover performers, studios, series, titles and more, two columns when wide, with avatars and recent titles for people, covers for titles. / **界面**：搜索下拉按女优、厂牌、系列、作品等分页签，宽屏分两栏，人名带头像和近作，作品带封面。
- **Interface**: Stats charts are redone with duration and quality distribution, a play-time heatmap and play-count buckets; Taste page radar and ranking bars share one style. / **界面**：统计页图表换新：补上时长与画质分布、播放时段热力图和播放次数分档；口味页的雷达与排行条同一套画法。
- **Interface**: The home page adds a large and small view toggle. / **界面**：首页加大图小图切换。
- **Sourcing**: Dead links of retired performers remain as unclickable badges so profiles show an official site or social account once existed; parked pages count as dead. / **采集**：已隐退女优的失效链接留成一枚不可点的标记，资料页看得出这里曾有官网或社媒；停放页也判为失效。
- **Following**: Cards and details mark dubbed and silent versions; booru posts credit the actual poster by source account; next-day reuploads of the same work group together. / **关注**：卡片与详情标出配音版和无声版；booru 帖子按出处账号署名真正的发布者；隔天重传的同一作品归进同一组。

### Changed / 变更

- **Interface**: Page summaries are cached while ledger and files are unchanged; studio index and agency and maker queries take about ten ms; Following management opens faster. / **界面**：页面汇总数据在账本和文件没变时走缓存，厂牌索引页与事务所、片商资料页的查询回到十毫秒量级，关注管理页打开更快。
- **Interface**: The Taste page re-parses browsing history only when history files change and preloads it in the background after startup. / **界面**：口味页读浏览历史只在历史文件变化时重新解析，开机后在后台预先读好。
- **Library**: The bundled entity seed drops dead agency links. / **馆藏**：随版本附带的实体种子去掉已失效的事务所链接。

### Fixed / 修复

- **Following**: Dubbed, silent, WIP and version numbers move before the title, merge counts move to the card's top right, and rule34video name lookups work. / **关注**：配音版、无声版、WIP 与版本号排到标题前面，合并计数挪到卡片右上角；按名字查 rule34video 查得到。
- **Interface**: Typing in the search box after scrolling down no longer scrolls the page back one character at a time. / **界面**：往下翻过之后在搜索框里打字，页面不再一个字一个字地往回滚。
- **Interface**: Profile galleries count by image without duplicates; the taste radar uses a square-root scale so small values spread out; phone play-count labels don't crowd. / **界面**：资料页的图集按张数计，同一张图不再重复计数；口味雷达改用平方根刻度，小值不再挤在中心；手机上统计页播放次数的末档名字不再和前一档挤在一起。
- **Sourcing**: Dead link cleanup can target a single site. / **采集**：死链清理可以只清一个站。
- **Desktop**: Ending processes before uninstall only targets Peach's own processes. / **桌面**：卸载前结束进程只认 Peach 自己的进程。

## [0.35.0] - 2026-09-25

### Added / 新增

- **Library**: The performer header shows name with +N aliases, icon-only external links and a three-column, five-field profile table, with data from avwikidb and minnano-av. / **馆藏**：女优页头改成名字与「+N」别名、纯图标外链、五项资料表三栏，资料从 avwikidb 与 minnano-av 取回。
- **Library**: Files and folders can be organized by template with preview and rollback; push discovery imports new files in seconds; import reads duration and resolution. / **馆藏**：按模板整理文件名与目录，可预览可回滚；开启推送发现后新文件秒级入库；入库时读出时长与分辨率。
- **Library**: Studios gain a label layer, maker pages total their titles, and closed companies' official sites can be registered as archive snapshots. / **馆藏**：厂牌加一层 label 归属，片商页合计旗下作品；关门公司的官网可以登记存档快照。
- **Library**: Bundled performer, studio and agency seeds fill the ledger after scans; the tag vocabulary is reorganized, separating breast shape from body traits. / **馆藏**：随版本附带女优、厂牌与事务所的实体事实种子，扫描后自动补进账本；标签词表重整，乳型与身体特征分开。
- **Sourcing**: Source chains pick sources and order by content type and settle conflicts by field priority, leaving only identity to review; a link audit yields a repair plan. / **采集**：来源链按内容类型决定问谁、按什么顺序，分歧按字段优先级自动结算，复核只留身份类；全库审计外部入口并产出修复计划。
- **Sourcing**: FC2 codes query the publisher and mirror sites, FC2PPV-DB and JAVten load through the local browser, and Cloudflare checks no longer need pasted cookies. / **采集**：FC2 番号改问发行方与镜像站，FC2PPV-DB 与 JAVten 由本机浏览器取页，Cloudflare 验证不再要贴 Cookie。
- **Sourcing**: 1pondo, DMM and amane maker parsers join the source chain; av_neme and av_name join scraping; confirmed stage names register and same-person entries merge. / **采集**：一本道、DMM 与 amane 厂商解析器接入来源链；av_neme、av_name 接入刮削，确定的艺名自动登记、同人自动合并。
- **Sourcing**: Avatar completion finds performers by cover faces; avatars and covers can be cropped from frames; romanized studio names revert to Japanese; UA is Chrome 153. / **采集**：补头像按封面人脸认出本人，头像与封面可在作品画面里框取；罗马音厂牌名换回日文原名，抓取 UA 换成 Chrome 153。
- **Following**: Feeds that find a video code create a Not in library new release; person pages subscribe in one click; booru and rule34video post series merge into one card. / **关注**：订阅源发现番号即建「未入库」新作，人物页一键订阅；booru 与 rule34video 的连发帖归成一张卡。
- **Interface**: Person pages link straight to JavDB, minnano-av and MISSAV; login uses a single field; Settings, media repair and feeds each get their own page. / **界面**：人物页给出 JavDB、minnano-av 与 MISSAV 直达入口；登录页改成单字段，配置、媒体修复与订阅源各归整页。
- **Interface**: Recently completed in Tasks loads older entries, local paths get an Open in Explorer button, and the issue list separates rate limits from real fetch failures. / **界面**：活动页「最近完成」可往前加载，本机路径旁有打开资源管理器的键，问题清单把来源限流和真取不到分开报。
- **Review**: The alias review sheet can record the real source or drop wrongly matched spellings; duplicate identity merges can run only manually named pairs. / **复核**：别名复核表可记真实来源，也可摘掉判错的写法；重复身份合并支持只执行人工点名的对子。
- **Playback**: Settings unify media repair per media library, and MP4s missing an index are rebuilt with untrunc. / **播放**：设置里统一成按媒体库的媒体修复，缺索引的 MP4 用 untrunc 重建。
- **Settings**: Adds Cloudflare Quick Tunnel and named tunnel mode for source installs; the whole site opts out of search engine indexing. / **配置**：接入 Cloudflare Quick Tunnel 与源码环境的命名隧道模式；整站拒绝搜索引擎收录。

### Changed / 变更

- **Interface**: Cold start is faster, with the skeleton's first frame over 100 ms earlier; profile, library and Following cards skip offscreen rendering. / **界面**：冷启动更快，骨架首帧提前一百多毫秒；资料页、馆藏与关注卡片屏外跳过渲染。
- **Sourcing**: The cover step reuses metadata snapshots, failure memory is per site, javdb spacing becomes 3 seconds, and FC2 product IDs no longer query AVBase and JavBus. / **采集**：封面步复用资料步的快照，失败记忆按站记；javdb 间隔改 3 秒，FC2 商品号不再问 AVBase 和 JavBus。

### Fixed / 修复

- **Sourcing**: Cloudflare challenge checkboxes now appear, once per site; per-run caps rise to 6000 requests, 4 hours and 1 GiB; stopped runs no longer write or fetch images. / **采集**：Cloudflare 验证窗口的勾选框能出来了，同一站只弹一次；一趟采集上限提到 6000 次／4 小时／1 GiB；采集停止后不再写库取图。
- **Sourcing**: Covers skip animated and other titles' images, portrait posters aren't thumbnails, Blu-ray wide sleeves crop to the front by ratio, and small faces are found. / **采集**：封面不收动图和别片的图，竖版海报不再当缩略图，Blu-ray 宽封套按比例切出正封；全身照上的小脸也认得出。
- **Sourcing**: FC2 sellers become labels, not performers; fc2cmadb is asked when cast is missing; obfuscation strings javdb inserts into FC2 titles are no longer stored. / **采集**：FC2 卖家记进 label、不再建成女优，缺演员时问 fc2cmadb；javdb 插进 FC2 标题的混淆串不再落库。
- **Sourcing**: Registers 9 MGStage prefix spellings so folder names aren't scraped as codes; six studios get official wordmarks; archive badges come from the original site. / **采集**：登记 9 个 MGStage 前缀写法，目录名不再当番号刮削；六家厂牌换官网字标，存档链接的圆标按原站取。
- **Library**: Scans no longer register NFOs, posters, stills and screenshot thumbnails as titles; adds logos for Mousouzoku, KMP, OFFICE K'S and Luminous. / **馆藏**：扫描不再把 NFO、海报、剧照和截图缩略图登记成作品；补妄想族、KMP、OFFICE K'S 与 Luminous 标识。
- **Following**: Same-site identical files merge by content hash and post series group more fully; the new-release row loads once; retired performers' solo titles are fetched. / **关注**：同站同一文件按内容哈希并成一个媒体，连发帖归组更全；新作那一行只等一遍，隐退女优补拉单体作品。
- **Interface**: Stacked part and version cards no longer repeat one image; dark mode shadows, borders and dividers render right; profile refresh shows new-release skeletons. / **界面**：分卷与版本叠层卡不再翻同一张图；暗色下阴影、描边和分隔线正常；资料页直接刷新时骨架带上新作行。
- **Interface**: Settings blocks start collapsed and dropdowns return to two heights; Tasks follow-ups page with their parent, and the guide popup returns to the bottom right. / **界面**：配置块默认收起，下拉框回到两档高度；活动页后继随父任务成页，教程浮窗贴回右下角。
- **Review**: The FC2 cast review list remembers codes the site lacks; manual merges let one kept side absorb several old names; review no longer misreads health reports. / **复核**：FC2 演员复核清单记住站上没有的番号；人工合并允许一个保留侧收走多个旧艺名；复核页不再误读健康报告。
- **Desktop**: Tray restart waits for the old service to exit fully and refuses up front if an orphan holds the port; uninstall deletes only settings backups it created. / **桌面**：托盘重启先等旧服务退净，端口被孤儿进程占着时开工前就拒绝；卸载只删自己生成的设置备份。
- **Settings**: Whole-form errors echo verbatim, LAN access turns on a password by default first; Cloudflare Tunnel start, stop and source detection are tightened. / **配置**：整表错误照原样回显，局域网默认先开访问密码；Cloudflare Tunnel 的启停与来源判定收紧。
- **Ledger**: Task wrap-up clears the run id under the same lock as the end write, so an immediate manual rerun no longer hits the mutex key. / **账本**：任务收尾摘 run id 与写结束同锁，紧跟着的手动重来不再撞互斥键。

## [0.34.2] - 2026-09-20

### Fixed / 修复

- **Interface**: After first-time setup, a setup guide stays bottom-right across pages without flicker; six tasks check off by real state or can be skipped, then it closes. / **界面**：完成首次设置后，右下角会跨页面无闪烁地显示安装教程；六项任务按真实状态自动打勾，也可逐项跳过，全部处理后自动消失。
- **Library**: New imports normalize NFO tags and add aliases and a first avatar for exactly matched performers. / **馆藏**：新导入会规范 NFO 标签，并为精确匹配的女优补别名与首次头像。

## [0.34.1] - 2026-09-20

### Fixed / 修复

- **Desktop**: The standalone test package can allow LAN access; other devices open it at the configured port and `.local` address. / **桌面**：独立测试包可选择局域网访问，其他设备通过配置的端口与 `.local` 地址打开。
- **Library**: After a scan, metadata that passes the safety rules is saved right away; other candidates stay in review. / **馆藏**：扫描结束后立即落库符合安全规则的资料，其余候选继续留在复核。
- **Library**: NFO files and videos over 120 MiB no longer land in the junk queue; large short versions with the same video code are grouped as duplicates. / **馆藏**：NFO 与 120 MiB 以上视频不再误入垃圾队列，同番号的大体积短版本归入重复项。
- **Settings**: First-time setup uses BoardUI section levels, spacing, and buttons; Access password is a toggle, and access addresses are shown by scope. / **配置**：首次设置按 BoardUI 统一分类层级、间距与按钮，访问密码改为开关，访问地址按范围显示。
- **Desktop**: Full uninstall removes settings backups and extracted directories. / **桌面**：完全卸载清理设置备份与解压目录。

## [0.34.0] - 2026-09-19

### Added / 新增

- **Interface**: Avatar lift, clear-dissolve, badge pop, and title reveal motion come to directory pages, search, readouts, and details. / **界面**：头像抬起、清空溶解、徽标弹出与标题揭示落到目录、搜索、读数与详情
- **Interface**: Six levels of in-place state-change motion apply to glyphs, readouts, skeletons, switches, and success and failure feedback. / **界面**：原地换态的六档动效落到字形、读数、骨架、开关与成败反馈
- **Review**: The manual review page moves fully to React; a decision updates only the affected rows in the cache. / **复核**：人工复核整页归 React，判定只改缓存里那几行
- **Library**: Clearing a folder also deletes ledger rows whose files are already gone. / **馆藏**：清空文件夹时连文件已消失的账本行一起删
- **Interface**: The glow extends to every glass surface, and the color button also picks the accent color. / **界面**：光晕铺到每一块玻璃，配色钮同时挑强调色
- **Sourcing**: javbus becomes a fallback source; when only the official source provides a value, it replaces the current one. / **采集**：javbus 降为兜底来源，官方单独说话时直接替换现值
- **Interface**: Interface sounds: buttons, switches, menus, popovers, and status notifications each play a soft sound, which can be turned off in settings. / **界面**：界面音效：按钮、开关、菜单、弹层与状态通知各配一声轻响，设置里可关
- **Following**: The Subscriptions page moves fully to React, with the table view built on TanStack Table. / **关注**：关注管理整页归 React，表格视图交给 TanStack Table
- **Interface**: The drifting light spots on the sidebar glass become a glow in your own color scheme. / **界面**：侧栏玻璃上那几团漂动的光改成自己配色的光晕
- **Review**: Video-code directories are confirmed by runtime, and that review category is renamed Unrecognized. / **复核**：番号目录按片长确认，复核那一类改叫无法识别
- **Review**: A single community source can now fill empty fields; when community sources disagree, javdb wins. / **复核**：只有一家社区来源也补空，社区来源不一时取 javdb
- **Settings**: Demo library visuals use manually reviewed gallery portraits. / **配置**：演示库画面改用人工复核过的图库人像
- **Library**: Recognizes another stage name of the same performer from review candidates. / **馆藏**：从复核候选里认出同一位出演者的另一个艺名
- **Library**: Studio names written in both Japanese and English are matched to the right studio. / **馆藏**：日英并写的厂牌名认得出是哪一家
- **Interface**: Home glow presets move to the round sidebar button; the parameter area uses custom sliders and a swatch popover. / **界面**：首页光晕预设搬到侧栏圆钮，参数区改为自绘拉条与色板弹层
- **Interface**: The Taste page moves fully to React; the analysis scope is part of the query key, and all charts are React components. / **界面**：口味页整页归 React，分析范围写进键里、图表都是 React 组件
- **Library**: English-only sources are mapped into the same Chinese tag set. / **馆藏**：只出英文的来源也收进同一套中文标签
- **Interface**: The home glow is parameterized and can be customized in a settings panel. / **界面**：首页光晕改为参数化并开放设置面板自定义
- **Interface**: The Stats page moves fully to React, including stat cards that double as tabs, the ring inventory chart, and rankings. / **界面**：统计页整页归 React，读数卡兼页签、环形库存图与排行都在 React 层
- **Settings**: The Settings page and avatar changer move fully to React, leaving the frontend with a single rendering layer. / **配置**：配置页与换头像整页归 React，前端只剩一档渲染层
- **Sourcing**: Scan and sourcing cards and banners move to React. / **采集**：扫描与采集的卡片和横幅改为 React 档
- **Settings**: The sources and credentials page moves to React. / **配置**：来源和凭证页改为 React 档
- **Playback**: Settings adds a Playback compatibility repair button that fixes MP4s missing timestamp tables in the background, in batches. / **播放**：设置里加一颗「播放兼容修复」，后台批量修缺时间戳表的 MP4
- **Sourcing**: The HD upgrades page moves to React, and the island on the management content area unmounts when switching pages. / **采集**：高清版目标页迁到 React 档，换页时卸下管理区正文上的 island
- **Interface**: React subtrees share one TanStack Query client. / **界面**：React 子树共用一个 TanStack Query 客户端
- **Playback**: MP4s missing ctts play losslessly with a rebuilt header instead of being transcoded live. / **播放**：缺 ctts 的 MP4 改为重建头无损播，不再实时转码
- **Sourcing**: JavBus is added as a third community source, and a cover is installed even when only one image source has it. / **采集**：JavBus 作第三个社区来源，封面只有一个图源时照样装上
- **Following**: The first fetch fills up to 30 items; lookup reads the F95 profile card first and saves aliases when the follow is added. / **关注**：首次采集补足 30 条，查找先读 F95 名片并随登记写下别名
- **Settings**: Access password is the pilot for React with stock BoardUI components. / **配置**：访问密码试点改用 React 与 BoardUI 原版组件
- **Sourcing**: When official sources come up empty, AVBase and javdb fill in metadata and covers, and a notification reports when sourcing finishes. / **采集**：官方渠道落空时用 AVBase 与 javdb 补资料和封面，采集完成用通知报

### Changed / 变更

- **Interface**: Library grid cards outside the viewport skip rendering. / **界面**：馆藏网格视口外的卡片跳过渲染

### Fixed / 修复

- **Interface**: Fixes cover framing and the title card entry point. / **界面**：修正封面取景与作品卡入口
- **Interface**: Adds the missing in-place state-change motion on directory pages. / **界面**：补齐目录页的原地换态动效
- **Playback**: In fullscreen, clicking the right part of the progress bar no longer closes the details. / **播放**：全屏播放时点进度条右段不再关掉详情
- **Interface**: The color button keeps its palette glyph, light glass returns to blue-gray with the glow off, and the title can be clicked open. / **界面**：配色钮留住调色盘字形，关光晕后浅色玻璃回到蓝灰，标题可点开
- **Interface**: The avatar changer covers the whole page, the detail overlay makes room for Up next, and theater mode fills the screen. / **界面**：换头像弹层盖住整页，详情浮窗让出「接着看」，影院画面撑满
- **Interface**: Turning off the glow hides its orbs, and the detail overlay uses the site-wide scrollbar. / **界面**：关掉光晕就收起那一组球，详情浮窗的滚动条归全站那一条
- **Interface**: The eight pages migrated to React match their pre-migration Board styling again. / **界面**：已迁 React 的八页外观对回迁移前的 Board 样式
- **Library**: Each file is rechecked before it is marked as missing. / **馆藏**：判定文件已消失前逐条复核一次
- **Settings**: Opening settings closes any anchored popover still open. / **配置**：打开设置时收掉还开着的锚定弹层
- **Library**: An entity keeps one external ID per source; a second one is dropped instead of raising an error. / **馆藏**：同一实体在一家来源只留一个外部 id，第二个丢掉而不是抛异常
- **Library**: Long-running batch jobs no longer pick up rows in the trash. / **馆藏**：长跑批处理不再领回收站里的行
- **Library**: Video codes from video-code directories are filled only into main videos. / **馆藏**：番号目录的番号只补给正片
- **Library**: Runtime also prefers javdb. / **馆藏**：片长也按 javdb 优先取
- **Review**: Studios and series resolve to canonical names through ledger aliases. / **复核**：厂牌与系列按账本别名落到规范名
- **Settings**: Demo portrait downloads use the shared browser User-Agent. / **配置**：演示人像下载用共用的浏览器 User-Agent
- **Review**: Performers are compared by person, not by spelling. / **复核**：出演者按人比对，不按写法比对
- **Library**: Project-specific names no longer challenge the primary stage name in the ledger. / **馆藏**：企划名义不再挑战账本里的主艺名
- **Review**: The Current ledger value in the review queue reflects the ledger as it is now. / **复核**：复核队列的「账本现值」按账本此刻算
- **Review**: Reseller-store wording and studio aliases no longer take up the review queue. / **复核**：转售店口径和厂牌别名不再占复核队列
- **Library**: Video codes are recognized in file names delivered by the release site itself. / **馆藏**：发行站自己交付的文件名也认得出番号
- **Review**: The auto-save notice on the Review page has spacing from the queue below. / **复核**：复核页自动落库提示与下面的队列留出行距
- **Library**: Importing taste data refreshes the cache before switching scope, so returning to a viewed scope shows post-import numbers. / **馆藏**：导入口味数据先换缓存再切范围，回到看过的范围读的是导入后的数
- **Interface**: The home glow keeps only the light-spot layer and uses a default palette without teal. / **界面**：首页光晕只留光斑层并换成不含青绿的默认配色
- **Sourcing**: Performer markers no longer count as content tags, so sourcing sees their genres again. / **采集**：演员标记不算内容标签，采集重新看得见它们的 genre
- **Library**: Genres spelled the same in both languages no longer count as stuck in English. / **馆藏**：两边写法一样的 genre 不算停在英文
- **Library**: Compilation and dirty talk each map to one name; genre candidates stuck in English are dropped and fetched again. / **馆藏**：合集与淫语各归一个名字，停在英文的 genre 候选摘掉重抓
- **Library**: English spellings map the same way as the Japanese originals, and word boundaries are no longer a backspace character. / **馆藏**：英文写法与日文原词同去向，词边界不再是退格符
- **Library**: Genres use the Japanese originals; tags are deduplicated and use common translations. / **馆藏**：genre 取日语原词，标签去重并改成通行译名
- **Review**: The video-code directory review queue is computed live instead of read from a CSV snapshot. / **复核**：番号目录那一类复核队列改为现算，不再读 CSV 快照
- **Library**: Directories with a video code wrapped in a site name count as release directories, not creators. / **馆藏**：站名包着番号的目录也认作发行目录，不是创作者
- **Review**: The Review page reports auto-save results, and field name badges are visible in light mode. / **复核**：复核页报出自动落库结果，字段名徽章在亮色下看得见
- **Library**: Volume numbers with leading zeros are recognized as volumes. / **馆藏**：前导零的卷号也认作分卷
- **Playback**: VC-1 and similar codecs use software decoding, so segments no longer start with green frames. / **播放**：VC-1 等编码走软件解码，分片开头不再出绿帧
- **Library**: A source reporting no result counts as one informational item instead of filling the issue list. / **馆藏**：来源说「没有」按告知项报一个数，不占问题清单
- **Sourcing**: AVBase picks the product number that matches the video code, so compilations no longer replace the title's own metadata. / **采集**：AVBase 取商品号认得出番号的那条，合集不再顶替本作资料
- **Sourcing**: Directory names used as the code in the ledger are treated as having no video code and are no longer reported as issues. / **采集**：账本里当 code 用的目录名按无番号处理，不再报成问题项
- **Playback**: The background header-repair task uses the correct ffprobe path. / **播放**：修复头的后台任务取错了 ffprobe 的路径
- **Sourcing**: Sourcing for existing libraries reads the correct credentials root, so cookies pasted in sourcing settings are applied. / **采集**：既有库采集读对凭据根，采集设置里贴的 Cookie 才跟着走
- **Sourcing**: Online sources fill only fields the ledger has no value for, and candidates with the same value skip review. / **采集**：联网来源只补账本没有值的字段，同值候选不进复核
- **Playback**: MP4s with B-frames but no ctts are transcoded. / **播放**：有 B 帧却没有 ctts 的 MP4 改走转码
- **Library**: In numbered image sets, the image named like the main video is not used as the local poster. / **馆藏**：连号图集里和正片同名的那张不当本地海报
- **Settings**: Save buttons on the Settings page are all named Save settings, and action buttons use the primary style. / **配置**：设置页保存键统一叫保存配置，操作键改用主按钮
- **Sourcing**: Cover failure reasons distinguish removed-listing placeholders, a single image source, and disagreeing image sources. / **采集**：封面失败原因分清下架占位图、单一图源与图源不一致
- **Settings**: Collapsible sections in Settings animate height again, and the check frequency note sits inline. / **配置**：设置页折叠恢复高度动画，检查频率说明并进行内
- **Settings**: Switch rows in each settings group sit on gray cards, with white blocks inside each card. / **配置**：设置弹层各组开关行坐上灰卡，卡内分块改白底
- **Interface**: The library icon panel returns to a seven-column grid, and React class names avoid the old stylesheet. / **界面**：媒体库图标面板恢复七列网格，React 类名避开旧样式表
- **Interface**: Collapsing a ranking keeps the expand button in place, so the page no longer jumps up and back. / **界面**：收起排名时展开键钉在原位，页面不再先上移再回滚
- **Interface**: Rankings and sidebar lists expand with Collapse height transitions, so the animation is visible. / **界面**：排名与侧栏名单展开改走 Collapse 的高度过渡，展开时看得见动画
- **Interface**: Rankings on the Stats and Taste pages animate height when expanding and collapsing. / **界面**：统计与口味页的排名展开收起带上高度过渡
- **Interface**: React style output targets the Tailwind browser baseline, so CI rebuilds match the committed files. / **界面**：React 样式产物按 Tailwind 浏览器基线输出，CI 重建与提交一致
- **Interface**: React subtrees declare BoardUI tokens with their original values, so text color in system dark mode matches manual dark mode. / **界面**：React 子树按 BoardUI 原值声明同名 token，跟随系统的深色文字色与手动深色一致
- **Interface**: The iOS status bar is solid again, and the filter bar reveals on scroll-up on the compositor thread without stutter. / **界面**：iOS 状态栏回到实色，筛选条上滚放出改走合成线程不再卡顿
- **Interface**: The top bar is fixed on narrow screens, so Safari no longer scrolls the page up when the search box gets focus on phones. / **界面**：窄屏顶栏改为 fixed，手机聚焦搜索框时页面不再被 Safari 往上滚
- **Sourcing**: Fields from local NFO files fill empty values without review, r18 metadata uses Japanese spellings, and candidate card highlights cover the right-side dot. / **采集**：本地 NFO 给出的字段免复核补空，r18 资料取日文写法；候选卡片高亮盖住右侧圆点
- **Interface**: The sidebar overlay no longer tints the iOS status bar, the filter box is full width again, and Up next is hidden when empty. / **界面**：侧栏遮罩不再给 iOS 状态栏变色，筛选框恢复全宽，接着看无内容时整块不出现
- **Interface**: The top bar shell is ignored by iOS status bar color sampling, so content still shows through the status bar after scrolling. / **界面**：顶栏外壳对 iOS 状态栏取色不可见，滚动后状态栏仍透出内容
- **Following**: A creator's versions across sites merge into one card, lists paginate by group, and the phone search keyboard no longer pushes the top bar off screen. / **关注**：同一作者跨站的版本合成一张卡、列表按组分页；手机搜索键盘不再把顶栏推出屏幕
- **Interface**: Content still shows through the iOS status bar after scrolling past the sticky filter box, toggling drawers, or opening details. / **界面**：iOS 状态栏滚过吸顶筛选框、开合抽屉、打开详情后仍透出内容
- **Following**: Versions posted separately at the same time group by similar titles, backfill no longer replays the first page, and profile avatars add X and Patreon. / **关注**：同期分帖的版本按相似标题归组，回抓不再原地重放首页，名片头像补上 X 与 Patreon
- **Interface**: Closed overlays leave the render tree, so content shows through the iOS status and address bars; card titles are capped at two lines. / **界面**：收起的遮罩退出渲染树，iOS 状态栏与地址栏透出内容；卡片标题封顶两行
- **Interface**: iOS glass no longer blows out into HDR highlights; phone details scroll with a larger player, and Up next scrolls sideways. / **界面**：iOS 玻璃不再冲成 HDR 高亮，手机详情能滚、画面更大，接着看能横滑
- **Following**: Creator, source, and topic filters show only what you select. / **关注**：作者、来源、题材筛选点什么就只看什么
- **Following**: Multi-attachment posts from archive sites open in the detail carousel, and dimensions are filled only for image cards. / **关注**：归档站多附件帖进详情轮播，宽高只补图片卡面
- **Following**: Details fall back to the thumbnail when the original image is unavailable, and card aspect ratios, videos included, are measured from thumbnails. / **关注**：详情原图取不到时退回缩略图，卡面比例连视频也按缩略图量
- **Following**: Identity keys keep Unicode letters and digits, so Chinese and Japanese names are no longer reduced to empty strings. / **关注**：身份键按 Unicode 留字母数字，中日文名不再被抹成空串
- **Following**: Refetching existing rows rejects check parameters other than older, and the approach is recorded in the reuse list. / **关注**：存量行重抓的检查参数离开 older 时拒收，做法写进复用清单
- **Following**: Name lookup results include every name the add dialog's dropdown offered. / **关注**：按名字查找的结果收下添加框下拉给过的每个名字
- **Following**: Rewriting a whole row keeps the learned dimensions of every image in the list. / **关注**：整行重写保留清单里每张图学到的宽高
- **Following**: Items with all images hidden no longer show a hidden image on the card. / **关注**：图片全隐藏的条目卡面不再挂着被隐藏的图
- **Following**: Name lookup on rule34.xxx also lists prefix-matching tags as candidates. / **关注**：按名字查找 rule34.xxx 时前缀命中的标签也列为候选

## [0.33.0] - 2026-09-14

### Added / 新增

- **Following**: fanbox follows can be fully backfilled with covers for body media and cards; Poll posts skip the leading chart as cover, and failed media loads are explained. / **关注**：fanbox 的关注可以从头全量回抓，正文里的媒体和卡面都补收封面图；Poll 帖不拿首位的图表当封面，媒体加载不出来时给出说明。
- **Following**: Follow items can hide and restore individual images instead of deleting the whole item. / **关注**：关注条目可以按单张图隐藏与恢复，不用整条删掉。
- **Following**: Following adds a row of topics grouped into series, each with the library's most popular image and a face-framed icon, refreshed each visit. / **关注**：关注页顶上多一排题材：题材归成系列、配本库里最热的那张代表图，圆标按检出的人脸取景，每进一次页面换一批；本库挑不出够清楚的头像时去站点找。
- **Following**: New follow suggests as you type, grouping local and site tags; F95 reads creator names and avatars from title conventions and the first-post card. / **关注**：「添加关注」边敲字边出建议，本机已有的和站上的标签分两组；F95 按标题约定和首楼名片认作者名与头像。
- **Following**: The follow list has default and table views with sortable columns; creator and source filters are multi-select, with Select all and Select none at the top. / **关注**：关注列表分默认视图与表格视图，表格的列可排序；作者与来源筛选可以多选，行首有「全选」「全不选」。
- **Following**: Filters add an Unseen time range option. / **关注**：筛选多一档「未看时间范围」。
- **Following**: Peach stores creator avatars and source icons locally instead of loading them from sites, so they show when a site is down; videos and images aren't stored. / **关注**：作者头像与来源图标由 Peach 取回保存在本机，页面不直接向对方站点要图；站点打不开时继续显示已保存的那张。视频与图片仍不保存。
- **Following**: You can enter creator aliases yourself, and the first fetch range is set in the same form. / **关注**：创作者别名可以自己输入，首次采集的范围在同一张表单里设。
- **Library**: Origin becomes its own dimension (JAV is one projection of it), used by filters, detail links, and batch decisions; Korean MIB no longer counts as JAV. / **馆藏**：产地成为独立的一个维度（JAV 只是它的一种投影），筛选项、详情入口和批量判定都认它；韩国 MIB 不再算 JAV。
- **Library**: Scanning and sourcing run separately, each with its own entry and progress; progress lists the current item, and only failed items can be retried. / **馆藏**：扫描和采集可以分开跑，各自有入口与进度；进度里列出当前项、失败项可以只重试这些。
- **Library**: External subtitles are saved and converted to WebVTT for the player. / **馆藏**：外挂字幕落库并转成 WebVTT 挂进播放器。
- **Library**: Video code parsing recognizes Tokyo-Hot and Western date formats. / **馆藏**：番号解析认 Tokyo-Hot 与西片的日期写法。
- **Library**: Ad bundles go to the junk review queue based on their structure, and high-confidence ones can be moved to the trash in bulk. / **馆藏**：广告包按形态证据进垃圾复核队列，高置信的那些可以批量入回收站。
- **Playback**: Thumbnails are pre-extracted by timestamp so the progress bar previews each moment; frame density is set in settings. / **播放**：视频按时间点预抽缩略图，进度条上就能看到那一刻的画面；抽帧密度在设置里选。
- **Sourcing**: Title metadata, covers, performers, and studio logos can be sourced from the MIB official site. / **采集**：可以从 MIB 官网采集作品资料、封面、演员与厂牌标识。
- **Sourcing**: javdb sourcing also produces Chinese alias candidates in the same pass; saved values are signed by batch and can be rolled back as a batch. / **采集**：javdb 采集同一趟产出中文别名候选，落库按批次署名、整批撕得回。
- **Sourcing**: Performer avatars with one gallery match install in bulk, others go to a comparison sheet for manual picks; site watermarks on avatars are removed. / **采集**：图库里只命中一张的女优头像批量装上，其余产一份对照表等人挑；头像上的站点水印会被检出并移除。
- **Sourcing**: JAV landscape covers are cropped to 2:3 posters; large cards show only the front cover right of the spine fold, padded with a blurred background. / **采集**：JAV 的横版封面按 2:3 取竖海报，大图卡片只显示书脊折痕右侧的正封，两侧用模糊背景垫。
- **Sourcing**: Videos without a video code can be identified online or use an image from the same directory as the local poster. / **采集**：没有番号的视频可以联网识别，也可以拿同目录的图片当本地海报。
- **Sourcing**: Authentication failures get their own category, and blocked sources aren't queried again in the same batch. / **采集**：鉴权失败单列一档，撞墙的来源这一批不再重复问。
- **Sourcing**: While HD covers are extracted, the page shows Fetching cover; after leaving and returning, a run still in progress keeps showing. / **采集**：抽取高清封面时页面上写着「正在抓取封面」；离开这一页再回来，还在跑的那一趟接着显示。
- **Sourcing**: 198 studio logos ship with the repository and are used as a fallback when an image can't be fetched. / **采集**：198 张厂牌标识随仓库分发，取不到图时回落到内置资源。
- **Review**: Review cards can add unlisted genres in place, and candidates become single-choice cards. / **复核**：复核卡上可以就地收录未收录的 genre，候选改成单选卡片。
- **Ledger**: Each metadata field records its source and write sequence; approval uses optimistic concurrency, so a later conflicting edit is blocked, not silently applied. / **账本**：资料字段记录每个字段的来源与写入序号，批准支持乐观并发：同一条被两头同时改时，后一次会被挡下而不是静默覆盖。
- **Interface**: Home, index pages, the tag alphabet, profile pages, Following, and Library tools are re-laid out in Board style; Home and profile pages share a filter bar. / **界面**：首页、索引页、标签字母表、资料页、关注页和数据管理都按 Board 重排，首页与资料页共用一套筛选条。
- **Interface**: The search bar suggests library identities and titles as you type. / **界面**：搜索栏边敲字边补出馆藏里的身份与作品。
- **Interface**: Clicking outside the detail overlay closes it, and the local cover fills the poster slot while it opens. / **界面**：详情点浮窗外面就退出，开场先挂本地封面占住海报位。
- **Interface**: The activity page lays out Tasks on one screen, covering background tasks, batch jobs, and command-line runs. / **界面**：活动页把任务中心摊在一屏，后台任务、批处理和命令行跑的活儿都在里面。
- **Interface**: You can change avatars on profile pages, and avatars across the site are framed on detected faces. / **界面**：资料页可以自己换头像；全站头像按检出的人脸取景。
- **Interface**: Without an access password, a warning stays on the card. / **界面**：没设访问密码时，卡片里常驻一条警示。
- **Interface**: Unreachable external links can be selected for retry; sources on Library tools show official site icons, and action buttons use the primary style. / **界面**：取不到的外链可以勾选重试；数据管理页的来源标官方站标，操作键统一成主按钮。
- **Interface**: Social media badges use each brand's color, with icons from an icon library for the seven most common. / **界面**：社媒标记取各家品牌色，常见七家走图标库。
- **Settings**: Settings add Auto-update and Avatar and site icon refresh (weekly, monthly, quarterly, or never) for creator avatars, source icons, and profile link icons. / **配置**：设置里提供自动更新选项；新增「头像与站点图标刷新」，可选每周、每月、每季或从不，作者头像、来源图标和资料页外链圆标都按它重取。
- **Updates**: GitHub Release notes come from the matching section of this file, and no release is published without it. / **更新**：GitHub Release 的正文取自本文件对应那一节，缺这一节就不发。

### Changed / 变更

- **Interface**: The whole interface switches to Board style with translucent glass top bar, sidebar, and sticky overlays; Increase contrast uses solid backgrounds. / **界面**：整套界面换成 Board 风格，顶栏、侧栏和吸顶浮层是半透明玻璃；设置里的「增加对比度」改用实色背景。
- **Settings**: The configuration page moves into Settings at the top right as This computer, split into General, Media, Network & access, and Updates & maintenance. / **配置**：配置页搬进右上角的设置里，成为「这台电脑」这一块，按「通用／媒体／网络与访问／更新与维护」分开列。
- **Playback**: Segment re-encoding uses NVENC with one FFmpeg per segment; incompatible sources are segmented even without a ledger duration, not transcoded whole. / **播放**：分片重编码走 NVENC，同一分片只起一个 FFmpeg；不兼容的片源即使账本没有时长也按片切，不整片转码。
- **Sourcing**: Codes a source reports as missing aren't queried for 7 days, videos without a code aren't issues, and FC2 codes query covers only, not r18.dev metadata. / **采集**：来源说「没有」的番号 7 天内不再问，没有番号的视频不列成问题项；FC2 的番号只问封面，资料不再向 r18.dev 要。
- **Library**: Scans register files using the size and time from directory listings, and sourcing-only runs skip complete rows. / **馆藏**：扫描按目录列表自带的大小与时间登记文件，只采集跳过齐全的那些行。
- **Following**: When a site is unreachable, suggestions and icon fill-in return empty right away instead of waiting for a timeout. / **关注**：站点不通时，联想和圆标补全立刻回空，不担超时的等待。
- **Settings**: Startup item status is cached by shortcut fingerprint and preloaded when the service starts, so opening settings doesn't wait. / **配置**：开机启动项的状态按快捷方式指纹留存，服务起来时就预热好，点开设置不用等。

### Fixed / 修复

- **Interface**: The filter overlay on performer, studio, and other profile pages uses the same glass as Home, with aligned tags, counts, sort keys, and edge fades. / **界面**：女优、厂牌等资料页顶上那块筛选浮层改成和首页同一块玻璃——标签、计数和排序键的大小、间距、圆角全部对齐，标签一行滚到头时两端渐隐，不吸顶时也不再显出上下两层。
- **Interface**: Glass, the selection indicator, and overlays share one system: positions use the settled layout, overshoot scales with the jump, and overlay gaps are even. / **界面**：玻璃、骰架与浮层收归一套：滚动时按落定后的布局算位置，选中那块按跳的跳幅决定冲过头多少，骰架按页面结构画并跟着容器走，浮层上下留一样宽的空隙。
- **Interface**: On narrow screens, toggling search doesn't scroll the page, the filter sticks by scroll direction, profile links scroll sideways, and overflow fades at edges. / **界面**：窄屏上搜索开合的聚焦不带着页面滚，筛选框按滚动方向切换吸顶，资料页那排外链改横滚；会横向溢出的层一律配滚轮映射与两端渐隐。
- **Interface**: The photo wall uses an equal-width grid with columns starting at the top, and the Following image masonry no longer reflows as images load. / **界面**：照片墙改等宽网格、各列从顶上开始排，关注图片墙的瀑布流不随图片加载重排。
- **Interface**: Studio logos fit round slots without gaps or clipped corners; logos smaller than the small circle are padded to 64 physical pixels with their own background. / **界面**：厂牌标识摆进圆形图位不发空也不被切角，比小圆片还小的用自己的底色补到 64 实像素。
- **Interface**: Descriptions on Library tools and Following are rewritten plainly, covering link categories, check result groups, file checks, and follow credentials. / **界面**：数据管理页和关注页的几处说明改成读得懂的话，链接分类、检查结果分组、文件检查和关注凭据都写清楚了。
- **Review**: The Review page toolbar and group bar are glass from the start, merged into one block aligned with the title and cards; the tabs above share the same left edge. / **复核**：复核页顶上的工具条和分组条从进页面起就是玻璃，两条合成一块，左右和标题、卡片同一条边；上面那排页签也回到同一条左边。
- **Review**: Video codes reported by a source are verified before a candidate is saved. / **复核**：候选落库前核验来源自报的番号。
- **Playback**: Face detection runs at three scales and uses the median score, so icons no longer frame torsos; Range responses stop reading files when the client disconnects. / **播放**：人脸检出跳三个尺度各检一次、分数取中位数，圆标不再框在躯干上；客户端断开后 Range 响应停止读文件。
- **Following**: Icons are framed on faces: unclear faces show the full body, source black borders are cropped before saving, and small faces are enlarged to a pixel minimum. / **关注**：圆标取景按人脸：脸不够清楚就摆全身，落盘前裁掉源图自留的黑边，小圆标里的脸按像素下限放大。
- **Following**: Lookup progress fills by planned source count, handle IDs are case-insensitive, and compilations are counted by the creator of the same footage. / **关注**：查找进度按计划的来源数走满，手柄型 id 不分大小写；合辑按同一份画面作者计数。
- **Sourcing**: The spine fold is detected by the front-cover shape, so the front cover's left edge no longer overlaps the spine; Korean MIB doesn't ask JAV sources for covers. / **采集**：书脊折痕按正封形状认，切点走到斜坡尽头，正封左缘不再压着书脊；韩国 MIB 不向 JAV 来源要封面。
- **Sourcing**: The video code gate keeps Tokyo-Hot's lowercase form and accepts both separators in date-style codes. / **采集**：番号闸门保住 Tokyo-Hot 的小写写法，也认日期式的两种分隔符。
- **Sourcing**: A bare 403 no longer implies a cause or asks you to sign in; Gfriends warns when falling back to an old index cache, and not listed isn't treated as a verdict. / **采集**：只凭状态码判出的 403 不替你断定成因，采集检查的裸 403 不再要求去登录；Gfriends 索引退回旧缓存时告警，未收录不记成结论。
- **Sourcing**: Dead scan and sourcing tasks are marked interrupted, so the interface no longer flips back and forth. / **采集**：扫描与采集的死任务状态写回中断，界面不再来回跳。
- **Library**: Two files with the same name under one video code count as one duplicate; date-style code separators are part of the identity and no longer collapsed. / **馆藏**：同一番号下文件名一样的两份算同一条重复；日期式番号的分隔符进身份，不再折叠。
- **Ledger**: Pruning ledger backups also removes orphaned `-wal`/`-shm` files. / **账本**：清退账本备份时顺手扫掉无主的 `-wal`/`-shm`。

## [0.31.0] - 2026-09-08

### Added / 新增

- **Following**: SimpCity threads can be follow sources; guests can't read threads, so put your own login cookie in the credentials file. Peach doesn't solve bot challenges. / **关注**：SimpCity 线程可以作为关注来源。站点不让游客读帖，需要把你自己的登录 Cookie 写进凭据文件；Peach 不解任何机器人质询。
- **Following**: Name lookup in New follow also searches SimpCity thread titles with your cookie, and results include forum section tags. / **关注**：在「添加关注」里查找名字时，也会用你的 Cookie 搜 SimpCity 站内线程标题，结果带上版块标签。
- **Following**: The source filter menu adds Select all and Select none. / **关注**：来源筛选菜单新增「全选」与「全不选」。

### Fixed / 修复

- **Following**: Cloud drive links in SimpCity posts (Gofile, Pixeldrain, etc.) become buttons, images open in details, and proxy fetches skip login state and internal hosts. / **关注**：SimpCity 帖子里的网盘链接（Gofile、Pixeldrain 等）还原成按钮，图片可在详情页就地查看，代取不带登录态、不取内网地址。

## [0.30.0] - 2026-09-08

### Added / 新增

- **Settings**: A desktop shortcut switch creates or removes the desktop icon. / **配置**：新增桌面快捷方式开关，可直接创建或移除桌面图标。
- **Interface**: Collapsible section headings all show an expand arrow. / **界面**：可折叠的区块标题统一带上展开箭头。

### Removed / 移除

- **Following**: The `peach follow` CLI subcommand is removed; adding, checking, reviewing, and saving all happen on the Subscriptions page. / **关注**：命令行的 `peach follow` 子命令删除；登记、检查、复核与保存全部在关注管理页完成。

### Fixed / 修复

- **Sourcing**: Vector studio logos also normalize into padded squares and stay vector; white-text logos get a dark background so they stay visible on light backgrounds. / **采集**：矢量的厂牌标识也能归一成带边距的方图，仍然是矢量；白字标配深底，不会在浅底上看不见。
- **Sourcing**: Studio logos sit squarely in round slots: extra whitespace is trimmed, edge-to-edge logos get padding, and corners aren't clipped; pixels aren't scaled. / **采集**：厂牌标识在圆形图位里摆得端正：自带大留白的裁掉多余空白，顶到边的补足四周，标识的四角不再被圆形切掉。像素不缩放，清晰度不变。
- **Sourcing**: Light-stroke bitmap logos also get a dark background, logos with a solid backing stay as is, and renormalizing installed logos starts from backed-up originals. / **采集**：浅色笔画的位图标识同样配深底；自带整块底的标识保持原样。已装的标识重跑归一时从备份原图开始，算法的改进也能落到它们身上。
- **Sourcing**: The logo search also covers studios whose logo is too small to fill the round slot, swapping in a sharper copy if found; otherwise it only notes it for review. / **采集**：找厂牌标识时也收录「装着的那张太小、放大才铺满圆形图位」的厂牌，站点上有更清晰的就换上；找不到只在复核件留一行判词，原图不动。
- **Sourcing**: Logos smaller than the small circle are padded to its pixel size with their own background, so the browser doesn't upscale them and strokes stay unscaled. / **采集**：比小圆片还小的厂牌标识用自己的底色补到圆片要的实像素，浏览器不再放大整张图；笔画不缩放，圆片里的标识变清楚了。
- **Settings**: When creating or removing the desktop shortcut fails, the actual reason is reported instead of a generic failure. / **配置**：桌面快捷方式创建或移除失败时报出真实原因，而不是只说失败。
- **Interface**: Dangerous actions (such as removing a media directory) use the same confirmation step. / **界面**：危险操作（移除媒体文件夹等）统一走同一个二次确认。
- **Interface**: Busy indicators describe the action in progress, and disabled switches and buttons show the correct color and cursor. / **界面**：忙态提示会说明正在进行的动作；禁用的开关与按钮给出正确的颜色和光标。
- **Following**: Clicking a Suggested chip when adding a source fills the input correctly. / **关注**：登记来源时点「猜你喜欢」的推荐芯片能正常填进输入框。

## [0.27.1] - 2026-09-07

### Added / 新增

- **Playback**: Leaving the detail page shrinks the video to a corner and keeps playing, with rewind, fast-forward, and the player context menu. / **播放**：离开详情页后视频缩到角落继续播，带快退、快进与播放器右键菜单。
- **Review**: Candidates support multi-select and group adoption, show identity evidence and local files, and fill-empty candidates with matching values are saved directly. / **复核**：候选支持多选与按组采用，看得到身份证据和本机文件，取值一致的补空候选直接落库。
- **Library**: Scans detect and import existing NFO metadata. / **馆藏**：扫描时识别并导入已有的 NFO 资料。
- **Updates**: The standalone package can download and install updates from the page, with progress, a database backup before install, and rollback on failure. / **更新**：独立包可以在页面里下载并安装更新，显示进度、安装前备份数据库、失败回滚到旧版。
- **Settings**: Adds a public proxy setting, Startup, and standalone package uninstall. / **配置**：新增公共代理、开机自启与独立包卸载。
- **Interface**: Background tasks show their current stage and counts. / **界面**：后台任务显示所在阶段与计数。

### Fixed / 修复

- **Sourcing**: Avatars without a detectable real face are no longer installed automatically. / **采集**：检不出真人脸的头像不再自动安装。
- **Updates**: When an update fails, the database connection is closed before exiting. / **更新**：更新过程出错时先关闭数据库连接再退出。
- **Interface**: The search dropdown, settings groups, dangerous action prompts, and several empty states follow one consistent standard. / **界面**：搜索下拉栏、设置分组、危险操作提示与多处空态按统一规范收齐。

## [0.16.0] - 2026-09-06

### Added / 新增

- **Settings**: Optional access password and device session lifetime; the sign-in page lets you choose how long to stay signed in. / **配置**：可选的访问密码与设备会话期限，登录页可选择保持登录时间。
- **Library**: Five-star ratings on the detail page, saved to the library. / **馆藏**：详情页五星评分，写进馆藏。
- **Interface**: JAV covers and thumbnails can each use the official cover or a preview image. / **界面**：JAV 封面与缩略图各自可选官方封面或预览图。
- **Interface**: The sidebar is reordered to follow everyday use. / **界面**：侧栏顺序按日常动线重排。

### Fixed / 修复

- **Sourcing**: Avatars are framed on detected faces, and title covers no longer replace portraits. / **采集**：头像按检出的人脸取景，作品封面不再覆盖人像。
- **Settings**: Management actions show based on what the cloud drive actually supports. / **配置**：管理操作按网盘实际能力显示。

## [0.11.2] - 2026-09-06

### Added / 新增

- **Settings**: CloudDrive source setup guide, mount mapping, and status settings. / **配置**：CloudDrive 来源引导、挂载映射与状态配置。
- **Settings**: Multiple media directories can be declared at once. / **配置**：媒体文件夹可以一次声明多个。
- **Sourcing**: HD cover sourcing and local source settings. / **采集**：高清封面采集与本机来源配置。
- **Playback**: Formats the browser can't play are transcoded on demand. / **播放**：浏览器不兼容的格式按需转码后播放。
- **Library**: Performer affiliations are reconfirmed by agency and written back to entities. / **馆藏**：按事务所重新确认女优所属，结果写回实体。
- **Interface**: Scrollbars use overlay style, so pages and drawers no longer reserve a column for them. / **界面**：站内滚动条改成覆盖式，整页与抽屉都不再占一列宽度。

### Fixed / 修复

- **Sourcing**: Link reachability checks tolerate TLS hiccups, so one failed handshake doesn't mark a site unreachable. / **采集**：链接可达性探测扛住 TLS 抖动，一次握手失败不判定站点不可达。
- **Interface**: Fixes controls, spacing, and visual hierarchy across the first-time setup and settings pages. / **界面**：首次设置页与配置页的控件、间距与视觉层次成批修正。

## [0.7.14] - 2026-09-05

First Windows standalone test package. Earlier development (from 2026-08-14, including the macOS menu bar stage) has no builds; see Git history for changes. / 首个 Windows 独立测试包。在它之前的开发（2026-08-14 起，含 macOS 菜单栏阶段）没有制品，逐条变化见 Git 历史。

### Added / 新增

- **Desktop**: Windows standalone test package with out-of-box setup; the tray starts setup on first run, the first-run page is a form, and `peach init` asks in the terminal. / **桌面**：Windows 独立测试包与单机开箱配置，托盘首启拉起引导服务，首次运行页改成表单，`peach init` 提供终端问答。
- **Library**: Agencies become their own entities; studios and agencies each get index and profile pages, with logos sourced automatically. / **馆藏**：事务所成为独立实体，厂牌与事务所各有索引页和资料页，标识自动采集。
- **Ledger**: Backups carry retention rules and are pruned by them when the tray starts. / **账本**：备份自带保留规则，托盘启动时按规则清退。
- **Settings**: Startup is refused when binding a non-loopback address without an access password. / **配置**：绑定非回环地址却没有设置访问口令时拒绝启动。

### Fixed / 修复

- **Desktop**: The standalone package writes startup logs in UTF-8. / **桌面**：独立包使用 UTF-8 启动日志。
- **Settings**: The redirect after first-time setup uses a freshly read mDNS name. / **配置**：首次设置后的跳转目标取新鲜读到的 mDNS 名。

[Unreleased]: https://github.com/peach-mitao/peach/compare/v0.59.0...HEAD
[0.59.0]: https://github.com/peach-mitao/peach/compare/v0.58.0...v0.59.0
[0.58.0]: https://github.com/peach-mitao/peach/compare/v0.57.0...v0.58.0
[0.57.0]: https://github.com/peach-mitao/peach/compare/v0.56.0...v0.57.0
[0.56.0]: https://github.com/peach-mitao/peach/compare/v0.55.1...v0.56.0
[0.55.1]: https://github.com/peach-mitao/peach/compare/v0.55.0...v0.55.1
[0.55.0]: https://github.com/peach-mitao/peach/compare/v0.54.0...v0.55.0
[0.54.0]: https://github.com/peach-mitao/peach/compare/v0.53.0...v0.54.0
[0.53.0]: https://github.com/peach-mitao/peach/compare/v0.52.0...v0.53.0
[0.52.0]: https://github.com/peach-mitao/peach/compare/v0.51.0...v0.52.0
[0.51.0]: https://github.com/peach-mitao/peach/compare/v0.50.0...v0.51.0
[0.50.0]: https://github.com/peach-mitao/peach/compare/v0.49.1...v0.50.0
[0.49.1]: https://github.com/peach-mitao/peach/compare/v0.48.2...v0.49.1
[0.48.2]: https://github.com/peach-mitao/peach/compare/v0.48.1...v0.48.2
[0.48.1]: https://github.com/peach-mitao/peach/compare/v0.48.0...v0.48.1
[0.48.0]: https://github.com/peach-mitao/peach/compare/v0.47.3...v0.48.0
[0.47.3]: https://github.com/peach-mitao/peach/compare/v0.46.1...v0.47.3
[0.46.1]: https://github.com/peach-mitao/peach/compare/v0.45.0...v0.46.1
[0.45.0]: https://github.com/peach-mitao/peach/compare/v0.43.0...v0.45.0
[0.43.0]: https://github.com/peach-mitao/peach/compare/v0.42.0...v0.43.0
[0.42.0]: https://github.com/peach-mitao/peach/compare/v0.41.0...v0.42.0
[0.41.0]: https://github.com/peach-mitao/peach/compare/v0.40.1...v0.41.0
[0.40.1]: https://github.com/peach-mitao/peach/compare/v0.40.0...v0.40.1
[0.40.0]: https://github.com/peach-mitao/peach/compare/v0.39.0...v0.40.0
[0.39.0]: https://github.com/peach-mitao/peach/compare/v0.38.0...v0.39.0
[0.38.0]: https://github.com/peach-mitao/peach/compare/v0.37.0...v0.38.0
[0.37.0]: https://github.com/peach-mitao/peach/compare/v0.36.0...v0.37.0
[0.36.0]: https://github.com/longmeidao/peach/compare/v0.35.0...v0.36.0
[0.35.0]: https://github.com/longmeidao/peach/compare/v0.34.2...v0.35.0
[0.34.2]: https://github.com/longmeidao/peach/compare/v0.34.1...v0.34.2
[0.34.1]: https://github.com/longmeidao/peach/compare/v0.34.0...v0.34.1
[0.34.0]: https://github.com/longmeidao/peach/compare/v0.33.0...v0.34.0
[0.33.0]: https://github.com/longmeidao/peach/compare/v0.31.0...v0.33.0
[0.31.0]: https://github.com/longmeidao/peach/compare/v0.30.0...v0.31.0
[0.30.0]: https://github.com/longmeidao/peach/compare/v0.27.1...v0.30.0
[0.27.1]: https://github.com/longmeidao/peach/compare/v0.16.0...v0.27.1
[0.16.0]: https://github.com/longmeidao/peach/compare/v0.11.2...v0.16.0
[0.11.2]: https://github.com/longmeidao/peach/compare/v0.7.14...v0.11.2
[0.7.14]: https://github.com/longmeidao/peach/releases/tag/v0.7.14
