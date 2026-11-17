# 界面组件契约

本文件维护组件选择与交互约束；执行流程见 [界面技能](../.claude/skills/peach-web-ui/SKILL.md)，层级与布局原则见 [设计准则](DESIGN_GUIDELINES.md)。按当前任务读取对应章节。

## 适用组件体系

React 与 BoardUI 的组件、颜色和尺寸采用 [BoardUI 适配](BOARD_UI.md) 与 ADR-0031，保留既定蓝色主动作和原始组件约束。遗留 Geist 的 `--ink`、`--ground`、`--tungsten` 和 DOM class 只约束使用这些词汇的既有控件，不覆盖 BoardUI token。

下表的 Switch、Toggle 和 DOM helper 名称需结合体系理解：BoardUI Switch 是布尔输入，遗留 Switch 是 radio 分段器。修改既有控件复用其实现，不能为满足旧命名规则重写另一体系。涉及数值、媒体比例与取景时，以当前实现及对应测试为准。

## 组件选择

| 需求 | 使用 | 不要使用 |
| --- | --- | --- |
| 字段、卡片、分区旁的持久反馈 | Note | Toast、空状态 |
| 页面／系统级问题与恢复动作 | Banner | Note |
| 短暂操作回执 | Toast | 持久 Note |
| 写操作前的确认 | `confirmModal()` | 原生 `confirm()`、Toast |
| 一个主动作加 1–4 个近亲做法 | Split Button（主动作在左，第一项菜单项与它同名同事） | 把变体摊平成并排按钮、把破坏性动作当主动作 |
| 一行内的重排 | `wireDragReorder()` 拖动 | 上下移动按钮 |
| 已知总量的进行状态 | 整行宽用 Progress；图标大小的位置（状态行前导、横幅、通知卡图标位）用 ProgressRing | 装饰性蓝条、各写一套圆环 |
| 用户触发动作等待结果 | Spinner | 旋转原操作图标、语义动画 |
| 后台任务仍在推进、没有分母 | 按语义选 loading.dev 动画（`activity-kinds.ts` 一张表），后台任务整体用 `TaskProgress` | Spinner、假百分比、三颗点 |
| 整页或大区块首次等待内容结构 | Skeleton | Spinner、语义动画 |
| 2–3 个互斥视图 | 遗留 Switch（radio）或现有分段组件 | Toggle |
| 布尔开关 | 遗留 Toggle 或 BoardUI Switch | radio 分段器 |
| 无布局高度变化的菜单 | Menu／Listbox；开合走 `presentMenu`／`dismissMenu`，动效只在 Board 层那一份 | Collapse 动画、自己再写一份 150ms |
| 带搜索语义的输入 | Search Input（搜索图标前缀；搜索中原位换 Spinner） | 无图标裸输入 |
| 全屏命令／设置覆盖层 | 有锁定证据的 Dialog motion | 把同一动画套给普通菜单 |
| 展开正文或分组 | Collapse | 自造 easing |
| 一组输入／候选及其底部动作 | Fieldset | 自造卡片 Footer |
| 固定高度区域中的溢出内容 | Scroller | 页面级滚动或嵌套滚动区 |
| 没有数据或结果 | Empty State（图标、标题、说明同组） | 裸灰字或把说明拆到组件外 |
| 图标含义与补充说明 | Tooltip | 让浮层撑宽页面 |

## 组件与视觉

- React 页面优先扩展现有 BoardUI 组合件；遗留 DOM 页面复用 `frontend/src/ui-kit/`，不为同一语义复制一次性 class 与模板。
- 需要全集排序、分页、跨页选择与批量操作的数据表复用 TanStack Table、BoardUI Table、`DataTableFrame` 与 `SelectionDock`；少量静态关系沿用现有简单表格，不强加分页与选择。默认页大小与选择范围以实际页面契约为准。
- 管理页单面板分区的标题放在面板内，不在框外重复；多卡片分组可用框外标题。同级分区标题用 `text-title-2-medium`，加载态与内容态共用 500 字重、20px 字号和 26px 行高。
- 控件高度只取 `--control-h-inline`／`-compact`／`--control-h`／`-large` 四档，同一行的同类控件同档；与文字同行的图标用 `--icon-inline`，单独图标按控件档取固定值；下拉不点开也要看得出在选什么（上方标签、触发键前缀或格子选择器的弹层标题三选一）。判据与坏例见 `docs/DESIGN_GUIDELINES.md` 第 2、10、11 节。
- React 使用 BoardUI 语义 token，遗留样式使用对应 `:root` token；新增 token 须说明现有词汇无法表达的语义。
- 无图头像、首字母与默认人像复用 [BoardUI 无图头像规范](BOARD_UI.md#无图头像与浮卡子页)，同时核对承载面的深浅主题、悬停和选中态；不能把数据未取得当作动作禁用而降低前景对比度。表格、表单与浮卡使用完整字阶和对应间距，复用快照须包含 Peach 已登记的暗色例外。
- 字重只有 400／500／600 三档，标题按既定层级选择 medium 或 semibold；圆角只用 `--badge-radius`／`--control-radius`／`--surface-radius`／`--floating-radius`／`--pill-radius` 加 `50%` 与 `0`，带边框容器里的头尾条用 `calc(… - 1px)` 保持同心。两者的字面值由 `tests/test_web_ui.py` 拒绝，归属判据见 `:root` 注释。
- 遗留 Geist 层单色优先：`--tungsten` 只给焦点环、链接、进度／数据与 Toggle 开态。主动作用 `--ink` 底 `--ground` 字且每屏最多一个。标题悬停下划线不变蓝，计数徽章中性灰。其它选择器引用 `--tungsten` 由 `tests/test_web_ui.py` 拒绝；实测见 `vercel-geist-semantics-measured.md`「选中态与开关色」「Button 全变体与状态」。
- 选中态只有填充：一律 `--hover` 底 `--ink` 字，不加边框、不加 `inset` 一圈线、不加字重（Geist Switch／Tabs 的类名里三样都没有）。填充既然专属选中，**同一排横向**互斥选项的未选中项悬停就只提文字色到 `--ink`；没有选中态的按钮和没有并排邻居的孤立开关悬停照旧抬填充。侧栏导航（`.edge`／`.dnav`）分工相反：实测 Geist 左栏是悬停抬填充、当前项握着文字与图标色，别把横排那条推广过去。清单见同一份快照的「选中态与它的悬停」和「侧栏导航是例外」。
- 按钮悬停只抬填充：次级到 `color-mix(in srgb,var(--ink) 8%,var(--ground))`（Geist gray-200 那一档，全站同一个值），主动作到 `color-mix(in srgb,var(--ink) 88%,var(--ground))`，边框与文字色都不动。主动作那条悬停规则要自己写上 `color:var(--ground)`，否则同组更宽的通用 hover 里那句 `color:var(--ink)` 无人竞争，浅色实底上落成白字白底。禁用走 `--surface` 底、`--border-15` 边、`--muted` 字，不用 `opacity`；按下不加 `scale`。三条都有 Geist Button 源规则佐证。
- `outline:0`／`outline:none` 只允许出现在同一规则给出替代焦点样式的地方（`box-shadow` 或子元素 outline），或输入框由带 `:focus-within` 的容器接管焦点时；reduced motion 由全局 `@media (prefers-reduced-motion:reduce)` 统一关闭，不逐处补。
- 危险入口的悬停态使用当前组件体系的红色填充与白字。媒体、整份资料、完整来源及大范围清理的删除执行键使用共用长按控件，静止态红字、悬停态浅红背景，按住时红色填充显示两秒进度。提前松开用 200ms 复位，完整按满两秒才提交。取消想要、移除列表成员、单条搜索历史、作品标签、别名、已选项、保存的筛选与未保存的设置行使用普通单击；已有范围确认和撤销继续保留。参考见 [长按删除取证](reference-snapshots/emil-hold-to-delete.md)。
- 按钮的前置图标只在图标指向对象（来源站点、当前选中项、平台）或形态方向（触发器右侧的 `chevron-down`）时出现；文字已经把动词说完的不加，`+ 添加`、`↻ 刷新`、`✓ 保存` 这枚多余字形会把同一行主次动作的视觉重量拉平。图标键必须给 `aria-label`，名称点出动作和对象、不描述图标形状。判据与 Geist Button 文档正文见 `docs/reference-snapshots/vercel-geist-button-icons.md`；官方 Geist 图标 SVG 没有可直取的入口，同一份快照记了原因。
- 同一行里的输入框和按钮共用 `--control-h`，不各写一个像素数：两个控件差 3px 就不是一行了，而差值往往来自窄屏那条防放大规则只抬其中一个。
- 一枚字形只代表一个意思，同一个意思也只有一枚字形。取字形先问它指的是哪个名词或哪个方向：文件类型取 `file-*`，本地取 `hard-drive`、订阅源取 `rss`，往下接一页取 `chevron-down`，原地换一批取 `shuffle`，`refresh-cw` 只归「去问一遍来源有没有更新」；筛不出结果和一次比对没有发现是两个空态，不能共用一枚。图标语义结合控件的可访问名称与实际操作复核。没有使用者的 symbol 从 `scripts/vendor_web_dependencies.ts` 的名单和雪碧图里一起删，用户点名留的备用件在名单旁说明用途。
- 没有直接证据不得新增动效。菜单开合的证据是 boardui `menu-styles.ts`（`docs/BOARD_UI.md`），已落在 board.css 的共用规则里；旧版 Geist 层仍无动画。
- 界面优先显示读数、当前状态与可执行动作，省略无助于决策的实现细节。费用、估算限制、隐私上传同意与不可逆操作的范围必须保留；单位跟随数字，必要口径放适当帮助入口。

## 等待与回执

- Progress 必须有真实 `value/max`、可见单位与 `aria-valuemin/max/now`；分隔线放在完整指标（含进度条）之后。
- 等待按顺序判断：有真实分母就画确定进度（整行宽 `Progress`，图标大小的位置 `ProgressRing`）；没有分母、是用户刚点下的那一下（保存、定位、换页键、搜索框查询）用 Spinner，等待留在触发点；其余后台推进按做的事选 loading.dev 语义动画——排队与等外部 Clock，搜索、检查与探测 Radar，传输 LinearDots（也兼做语义不明的通用后台推进），写入入库 Gather，整理与分析 Blocks。任务类型与后端阶段 code 到动画只查 `frontend/src/activity-kinds.ts`，不在调用处另起判断。
- Spinner 只反馈用户直接触发的动作，触发器统一调用 `setActionBusy()`：写入 `aria-busy=true` 与 `aria-disabled=true`、视觉变灰、拦截重复触发，同时保持可聚焦；请求等待期不得再用原生 `disabled`，它只留给缺输入、无权限等动作确实不可执行的状态。整页或大区块首次取数使用 Skeleton 预留最终结构。Spinner 与语义动画保留可见状态文字；Skeleton 只保留给辅助技术的状态名，不另画「正在读取」文案。三者都尊重 reduced motion：语义动画与骨架微光停在静帧。
- 后台任务的进度提示全站一套结构，即 `TaskProgress`：一行说明，加横条或语义动画，失败时同一位置换成 `Note`；独立任务带框，卡片或分区里的任务用所在容器。遗留层不能直接用 React 组件时，只给出要画的内容，由页面用同一组件画，不另画一套盒子。
- 语义动画与小环形的尺寸跟所在那一行的字号走：行内与旁边的图标同为 `--icon-inline`，区块正中的等待大一档，封面格按卡片角标的档并随网格密度变；颜色取强调色，与进度条填充一致。封面网格里只有正在抓的卡片在动，排队的卡片是静止的 Clock。估算出来的分母（按上次文件数推的进度）在文案里写明「估算」。
- 「换一批」描线、资源同步「检查文件」与链接检查键的忙态动画是按钮自带的例外；沉浸页等媒体加载与播放器缓冲共用一枚转圈。
- 用户写操作只在服务端终态成功后调用共享 `actionReceipt()` 发一条过去时 Toast；可由安全逆操作完整恢复的状态提供 8 秒「撤销」，永久删除、凭据、保存到账本等不伪造撤销。仅打开面板／菜单／Dialog 不算操作完成，不发 Toast；失败除短 Toast 外仍在原位置保留原因与重试入口。
- 同一次页面进入只呈现一段等待态；深链启动与页面取数复用同一个 Skeleton，禁止 Spinner 再切换成 Loading Dots 或 Skeleton。
- 页面顶边的换页进度条（`navigation-progress.ts`）顶替单页换页时不再出现的浏览器加载条，属于壳，不算页面的等待态：壳在取某一页首屏、或屏上组件在等第一份数据时亮，200ms 内画完不出现，出现后至少停 400ms。它只是不定进度，不报百分比，也不替代 Skeleton。
- Skeleton 只覆盖真正等待的内容区；静态标题、导航和能同步得到的筛选控件立即显示。骨架必须复用最终容器的宽度、列数与对齐方式：卡片网格横向铺满，居中面板仍居中，不得用一列通用占位替代不同页面结构。
- 骨架里的占位不接指针、没有任何悬停反馈（`09-skeleton.css` 一处关掉）；要等数据才能执行的键用原生 `disabled` 加 `data-skeleton-action`，呈全站共用的禁用面（`--surface` 底、`--border-15` 环、`--muted` 字、not-allowed），不用 opacity，也不伪装成可点的最终档。
- 分页末尾、空页和「没有更多内容」是中性终止状态，用可关闭 Note；只有需要恢复或处理的故障才能进入红色 error Note。
- 上一次跑完的结果不常态显示。它是那一刻的快照，进页面就铺开会被读成现在的状态，而页面上没有任何东西说它是旧的；只有仍在进行的任务才自动接管页面。
- Empty State 的标题和说明必须同处组件内；全页空态与上方工具条统一留 16px，不得再套一层空卡片。

## 表单与浮层

- 遗留 Switch 分段器共享 radio `name`、初始一个 `checked` 并支持键盘；布尔状态使用对应体系的布尔控件，BoardUI Switch 不采用 radio 契约。
- 菜单每项包含与入口相同的图标和文字，菜单内部滚动、`overscroll-behavior:contain`，不得把浏览器页面撑出滚动条。锚定菜单一律走 `wireAnchoredMenu`：高度压到触发钮那一侧真正剩下的空间（上沿是 `--topH` 顶栏下缘），装不下就在菜单内滚，不横跨触发钮；页面滚动关掉菜单，菜单自身的滚动不关。
- 只读查询（搜索、筛选）不配提交按钮：回车即执行，忙态落在表单自己身上（`form[aria-busy]` 加前缀原位换 Spinner）。有副作用的提交必须有按钮，且回车同样要能提交。表单里除这个输入框外还有别的字段时浏览器不做隐式提交，回车要自己接管 `requestSubmit()` 并跳过 `isComposing`。判据与实测见 `docs/reference-snapshots/vercel-forms-submit-affordance.md`。
- 确认弹层一律走 `confirmModal()`：原生 `<dialog>` 承载，标题是陈述句，正文先说后果并点名
  涉及的两个值，主按钮是与标题同一动词的「动词+名词」，取消键就写「取消」，成功 Toast 与主
  按钮的动词一一对应。写入交给 `onConfirm`，忙态落在主按钮上，失败时弹层不关、原因留在正文
  下方等重试。形状与文案判据见 `docs/reference-snapshots/vercel-geist-modal-measured.md`。
- 媒体、整份资料、完整来源及大范围清理的删除保留范围说明弹窗，执行键接入 `holdToConfirm`。同一档案的三个删除范围使用 `choices`，每项展示后果与长按执行键，取消键在右侧。未提交时点击遮罩或按 Escape 关闭，同时取消长按。此类直接删除入口复用同一长按逻辑，键盘支持按住 Enter 或空格两秒。轻量移除按「组件与视觉」中的普通单击约定执行。
- 下拉框的用途用框内左侧 16px 前缀图标标明，不在同一行挂一个文字标签：Geist 的文字 Label 是块级、排在控件上方，行内并排那种写法它没有，而工具行没有上方空间。无障碍名称改由 `aria-label` 承担。
- 弹层标题栏与滚动正文分层：标题分隔线属于卡片全宽，滚动条只属于正文。
- Fieldset 的正文统一 20px 内边距；标题条与底部操作条同为 `--fieldset-bar-h`（52px）、竖直居中、左 20px 右 16px。标题放在框体里，不用原生 `<legend>`：它会在上边框上开缺口，同组卡片内容高度不同时缺口位置也跟着不齐。同组卡片必须同高，变化内容只放一个纵向 Scroller。

## 媒体与页面状态

- 关注来源标签先服从来源记录的类型：只有明确标为 `general` 的标签才能进入卡片、顶部筛选和在线标签页，`artist`／`character`／`copyright`／`metadata` 与未知类型不得靠词形猜成 `general`。通用词清理是第二道门槛，只处理已经确认的 `general`；详情可显示全部来源标签，并按真实类型着色。
- 播放器控制条的窄屏折叠按播放器自身宽度判定（`ResizeObserver` 观察 `player.el()`），不用媒体查询：同一个视口下影院模式和普通视图的播放器宽度差一大截，用视口判据会在影院模式下白折叠、在普通视图下继续超框。门槛与提示外观见 `youtube-player-controls-user-screenshot.md`。
- 任何先请求再重绘整页的入口都必须绑定导航代际；只比较 `location.pathname` 不能防住「离开后快速返回同一路径」的旧响应。

