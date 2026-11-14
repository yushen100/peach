"""解析与匹配用的原文词表：来源页面上的字样、文件名与资源名里的记号、账本里的取值（ADR-0159 第四条，内容数据）。

这里的中文、日文是要在上游页面、文件名、网盘回执或账本里**认出来或照原样写进去**的原词，
不是给人看的界面文字，所以整份列入 `scripts/check_backend_copy.py` 的 `CONTENT_FILES`。界面文字不放这里。
"""
from __future__ import annotations

# ---- 文件名与资源名 ----

#: 字幕文件名末尾的中日韩文语言记号 → BCP 47 语言码（`subtitles.LANGUAGE_TOKENS` 的另一半）。
SUBTITLE_LANGUAGE_WORDS: dict[str, tuple[str, ...]] = {
    "zh-Hans": ("简体", "简中"),
    "zh-Hant": ("繁体", "繁體", "繁中"),
    "zh": ("中文", "中字"),
    "en": ("英文", "英语"),
    "ja": ("日文", "日语", "日本語"),
    "ko": ("韩文", "韩语"),
}
#: 预告片与样片的名字记号（种子名、磁力显示名、文件名）。
TRAILER_NAME = r"(?i)\b(?:sample|trailer|preview)\b|予告|预告|預告"
#: 种子名、磁力显示名或文件名里标明特典版的写法。
BONUS_EDITION = r"特典|special[\s._-]*edition"
#: 种子里夹带的引流与广告文件名（不含扩展名那几条）。
PROMO_NAME = r"manko\.fun|广告|廣告|扫码|掃碼|最新地址"
#: 资源名尾部的画质与版本标签（`resource_identification` 一层层剥掉）。
QUALITY_TAIL_WORDS = (r"uncensored|無修正|无码|無碼|破解|中文字幕|中字|中文|完整版|全集|"
                      r"原版|无水印|無水印|4k|2160p|1440p|1080p|720p|hd|fhd|sd|xxx|p2p|mp4|mov|avi|wmv")
#: 整理模板 `{mosaic}` 写进用户文件名的无码字样。
UNCENSORED_FILENAME_WORD = "无码"
#: 目录名里的月份写法（`2024年3月`、`03月`）与数量单位：判断目录名剩下的是不是结构词时剥掉。
DIRECTORY_MONTH = r"(?:\d{4}[年._-]?)?(?:0?[1-9]|1[0-2])月"
DIRECTORY_COUNT_UNITS = "部|集|个"
#: 合集目录名尾部的画质、整合标记、年月与体积（`… 合集 2024年3月`、`… 120v 300gb`）。
COLLECTION_SUFFIX = (
    r'(?:\s*(?:4k|6k|8k|2160p|1080p|720p|去重版|整合用|合集|合辑|全集)'
    r'|\s*(?:20\d{2}[.年_-](?:0?[1-9]|1[0-2])(?:月)?'
    r'|(?:0?[1-9]|1[0-2])月|20\d{2}年[一二三四五六七八九十]+月'
    r'|\d{4}\s*[一二三四五六七八九十]+月)'
    r'|(?:\s+|最新)\d+v(?:\s+\d+(?:\.\d+)?\s*(?:gb|g|tb))?'
    r'|\s+v\d+(?:\s+\d+(?:\.\d+)?\s*(?:gb|g|tb))?'
    r'|\s+\d+(?:\.\d+)?\s*(?:gb|tb)'
    r'|\s*[(（]\d+[)）])$')
#: 视频增强软件的模型代号（Topaz Video AI 的 Proteus `prob-4`、Chronos Fast `chf-3`、Iris `iris-3` 等）。
#: 处理后的文件名与收纳目录常带着它，它从来不是人名或账号名的一部分。
ENHANCEMENT_MODEL = (r"(?:prob|ahq|amq|alq|aaa|ghq|gcg|thd|thf|dtd|dtv|ddv|chf|chr|apo|apf|aion|iris|rhea"
                     r"|nyx|rxl|slf|slp)-?\d{1,2}")
ENHANCEMENT_SUFFIX = r"(?:[\s_.\-]+" + ENHANCEMENT_MODEL + r")+$"
#: 路径里出现就说明是 Peach 没接来源的体系（国产、网红）。
OTHER_SYSTEM_MARKS = ("国产", "國產", "网红", "網紅", "兔子先生", "麻豆")

# ---- 网盘回执 ----

#: 115 对违规内容的离线拦截：码或「违规」「敏感」字样。
CLOUD_BLOCKED = r"50038|违规|敏感"
#: 远端只给一句话时按字面归类的词（大小写不敏感，与英文写法放在一起）。
CLOUD_QUOTA_WORDS = ("配额", "quota", "次数", "上限", "limit")
CLOUD_DUPLICATE_WORDS = ("已存在", "exist", "重复", "duplicate")
CLOUD_INVALID_LINK_WORDS = ("链接", "无效", "invalid", "url", "格式")
#: 网盘报「空间不足」的原话与错误号（`downloads.storage_full`），按正则匹配、不分大小写。
CLOUD_STORAGE_FULL = r"190031|空间不足|空间已满|space_not_enough|insufficient (storage|space)|storage (is )?full"

# ---- 来源页面 ----

#: Cloudflare 验证页与拦截页的标题：英文界面、中文界面与按规则拦下的那一页。
CLOUDFLARE_CHALLENGE_TITLES = ("Just a moment...", "请稍候…", "Attention Required! | Cloudflare")
#: 浏览器传输认验证页的字串：Cloudflare 的标题（英文与中文界面），以及它脚本与文案里的固定字串。
BROWSER_CHALLENGE_MARKS = ("Just a moment", "请稍候", "cf-chl-", "challenge-platform",
                           "Verifying you are human", "Attention Required")
#: 站方按地区拒绝出口时说明页上的话（DMM 系英文页、日本站日文页、JavDB 中英双语页）。
GEO_REFUSAL_PHRASES = ("not available in your region", "お住まいの地域からはご利用になれません",
                       "access to this site is prohibited in the country", "本站禁止了你的網路所在國家的訪問")
#: 年龄确认页上「18 岁以上、进入」那颗按钮的字样。
AGE_GATE_BUTTON = r"18|はい|入場|同意|以上|Enter|Yes"
#: X 登出页在账号封停或不存在时正文里会出现的字样（英文、日文两种界面）。
X_GONE_MARKERS = ("Account suspended", "アカウントは凍結", "This account doesn’t exist",
                  "This account doesn't exist", "このアカウントは存在しません")
#: JavDB 演员页标题栏里自报的作品数。
JAVDB_WORK_COUNT = r'<span class="section-meta">\s*(\d+)\s*部影片\s*</span>'
#: 合集的标题记号：精选、总集、连发。`BEST` 前后不许紧挨字母，`BESTIE` 那种词不算。
COMPILATION_TITLE = r"(?<![A-Za-z])BEST(?![A-Za-z])|ベスト|総集編|傑作選|\d+\s*連発"
#: DMM 片单里的片长写法。
DMM_HOURS = r"(\d+)\s*時間"
DMM_MINUTES = r"(\d{3,})\s*分"

# ---- 账本里的取值 ----

#: 资料页链接没有平台名可写时的通用标签：写进 `entity_link.label` 的是 id，界面按语言显示；
#: `social_links.host_owners` 按它认出「没有归属」的那些。欧美资料站那一行官网链接也写它。
LINK_LABEL_BLOG = "blog"
LINK_LABEL_OFFICIAL = "official-site"
#: 资料快照 `raw` 里名字与别名的键：与 minnano-av 快照同一种写法，读快照的地方按它取。
RAW_NAME_KEY = "名前"
RAW_ALIASES_KEY = "別名"
#: 用户在目录规则里确认「这是卖家目录」时写进身份断言的依据前缀，后接目录路径。
SELLER_FOLDER_EVIDENCE = "用户确认目录用途："
#: 旧版本把「远端任务列表里找不到」记成 `no_source` 时写进 `download_task.failure_detail` 的原文开头；
#: `jav_browser` 按它认出这批旧任务。
LEGACY_REMOTE_MISSING = "远端任务列表里找不到这个任务"
#: 一本道的站名与厂牌名：账本里这家厂牌就叫这个，来源设置页的卡片同名。
ONEPONDO_NAME = "一本道"
#: 115 目标目录留空时，在 115 前缀下建议新建的目录名（建出来就是网盘上的真实路径）。
SUGGESTED_CLOUD_FOLDER = "云下载"
