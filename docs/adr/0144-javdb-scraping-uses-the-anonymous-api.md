# ADR-0144：JavDB 刮削改用匿名接口，类别按 id 换回详情页原词

- 状态：已采纳
- 日期：2026-11-04
- 关系：刮削一侧取代 `sources/javdb.py` 详情页解析的取法；沿用 [ADR-0034](0034-lone-community-source-fills-and-javdb-settles.md) 的 javdb 结算地位、[ADR-0100](0100-censored-javdb-content-tags.md) 的有码内容标签与 [ADR-0052](0052-entity-results-land-when-evidence-is-sufficient.md) 的按来源撤回；第五条的冷却范围由 [ADR-0148](0148-javdb-api-host-and-signature-fallback.md) 改为按接口主机；第一条「详情页解析只留给视频预览」由 [ADR-0160](0160-javdb-scraping-falls-back-to-detail-pages.md) 修订：接口冷却或未取得时刮削也读详情页；作品快照的保留期由 [ADR-0167](0167-less-reliance-on-javdb.md) 修订：发行后取齐的固定，发行前取齐的留到发行日

## 背景

JavDB 刮削读 javdb.com 的搜索页与详情页，要用户贴 Cookie，受登录墙和按出口 IP 计的配额约束（403 封 3～7 天）。
新作页、发现、订阅与待找磁链已经走公开 Web 前端的匿名接口（`peach.javdb_public.PUBLIC_API`），签名常量运行时
从前端 JS 读取，不带 Cookie。

2026-11-04 用 61 部配对作品（已有快照 18 部、实测 43 部，覆盖有码、无码、FC2、素人）对照两种取法投影出的候选值：

- 原标题、发行日期、系列、发行、导演、片长逐部一致，女优姓名与演员 id 一致；
- 接口的类别名是按作品给的译名，同一个（作品类型，类别 id）在不同作品上会写成不同的词（类别 `57` 有时是
  `美臀`、有时是 `屁股`，`74` 有时是 `肛門・肛交`、有时是 `肛交`），带 `Accept-Language` 或 `locale` 参数都不变。
  直接交给 `genre_taxonomy`，ADR-0100 的自动重判会撤下样本里 15 行已落库标签，并把 `肛門・肛交` 落成「肛交」；
- 接口里 FC2 的卖家写在 `maker_name`；259LUXU 等番号记作 `LUXU-xxx`，带前缀搜索返回空列表；
- 两种取法列女优的次序有 5 部不同。

比对表与取证在数据根之外的复核记录里，不进仓库。

## 决策

**一、刮削走匿名接口。** `SITE_SOURCES['javdb']` 登记 `JavDBPublicSource`：一问经 `PUBLIC_API.movie()` 取作品，
`public_record` 投影成与详情页同形的 `SiteRecord`。来源名仍是 `javdb`，结算地位、链上位置与字段优先级不变；
解析器名改为 `javdb-api`，候选与账本证据分得清取法。`source_url` 仍写 `https://javdb.com/v/<id>`。
详情页解析 `JavDBSource` 只留给视频预览，那条路仍用 Cookie 和 `javdb` 的来源冷却；资源区与评论已走匿名接口。

**二、类别按 id 换回详情页原词。** `javdb_genres.GENRES` 以 `<作品类型>:<类别 id>` 为键，值是详情页 `?locale=zh`
的原词，由 `scripts/generate_javdb_genres.py` 把同一作品的详情页快照与接口资料按位置对齐生成；同一个 id 对到两个
原词的整项不收。作品里有表外 id 时这一站这次不给标签：只交认得出的那几个会让 ADR-0100 撤掉那个类别此前落下的
标签，交接口译名会按另一个词落库。接口给、详情页不显示的 `299`（`数位马赛克`）不投出，保持与既有落库一致。

**三、番号身份按发行身份认。** 搜索词用 `release_identity`（去掉来源不记的 MGS 数字前缀），搜索结果、详情与已知
身份的核对用 `same_release_code`。这一条同样作用于新作页、发现与资源。

**四、失败分档。** 搜索无此番号归 `not_found`，进 7 天缺失记忆；同番号多个作品归 `parse_error`（`identity_ambiguous`）；
接口冷却期内抛 `SourcePaused`，本趟记作没轮到；其余未取得归 `network`。接口的问题不写 `javdb` 的来源冷却，
接口自己的间隔、失败冷却与每问 4 次请求的预算在 `PUBLIC_API`。接口主机 `jdforrepam.com` 与详情页主机不在一条队：
`SOURCE_LIMITER` 只管 `javdb.com` 与 `jdbstatic.com`，接口请求与新作页、发现、找资源排 `PUBLIC_API` 自己的队。
资料处理把快照写进 `<生成目录>/jav-public`，与新作页、发现共用，发行满一个月的作品不再重取。

**五、接口间隔 0.5 秒。** 用户 2026-11-05 定。同日在同一出口实测：间隔从 2 秒逐档降到 0.25 秒、每档 40 次，再按
0.5 秒连发 600 次（5 分钟），共 840 次请求全部 HTTP 200 且业务成功，延迟中位数约 230～260 毫秒。对照 javdb.com
网页每分钟 40～50 页就封 3～7 天，接口的限速宽得多。撞上 403/429 时接口整源冷却 15 分钟，刮削记作没轮到。
更长时间的累计配额未测；接口与新作页、发现、找资源共用出口，被限时这几处一起冷却。

**六、字段写法。** FC2 作品（`type` 3）的 `maker_name` 是卖家，按 `peach.sources.fc2` 的约定进只作证据的 `label`，
不进厂牌。女优按接口的明确性别字段认。同一来源再给的出演者只换了次序时沿用候选文件里上一份的次序，候选身份不变，
已批准的那一行不会被重新摆回复核页。接口图床可能给 XOR 包装的封面，社区封面印证先按公开前端的包装解开。

## 影响

- 刮削不再需要 JavDB Cookie，也不占 javdb.com 的出口配额；按天累计的访问上限未测。
- 单部是搜索加详情两次请求，按 0.5 秒间隔约 1 秒一部；已知来源 id 或快照命中时更少。刮削与新作页、发现共用 `PUBLIC_API` 的一条间隔。
- 已落库的 javdb 值与新取法逐字段相同，不需要失效旧快照或重算；`sources/library-metadata/<番号>-javdb.json`
  下次刮削时按同一形状覆盖，旧快照仍是有效证据。撤回脚本按 `source` 与 `batch` 认行，与解析器名无关。
- 表外类别的作品暂不出标签候选，补齐对照表后恢复；对照表覆盖要随新类别出现定期重生成。
