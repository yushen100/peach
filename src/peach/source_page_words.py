"""资料站页面上的原文字段名、记号与匹配正则（ADR-0159 第四条，内容数据）。

解析器要在 minnano-av、Seesaa Wiki、JavDB、JavBus、FC2 系、AVWikiDB 等站的页面里**认出**这些原词：
栏名、站名、标记与日期写法。它们跟着上游页面走，不是给人看的界面文字，所以整份列入
`scripts/check_backend_copy.py` 的 `CONTENT_FILES`。界面文字不放这里；解析逻辑留在各站模块里。
"""
from __future__ import annotations

# ---- minnano-av 女优资料表 ----

#: 资料表 `act-profile` 里的栏名（`minnano_av.profile` 逐格读）。
MINNANO_FIELDS = {
    "aliases": "別名",
    "birth_date": "生年月日",
    "sizes": "サイズ",
    "blood_type": "血液型",
    "birthplace": "出身地",
    "hobbies": "趣味・特技",
    "active_period": "AV出演期間",
    "debut": "デビュー作品",
    "blog": "ブログ",
    "site": "公式サイト",
    "tags": "タグ",
    "production": "所属事務所",
}
#: 日文日期与出演期间（`2001年 3月 9日`、`2019年 - 2023年`）。
MINNANO_DATE = r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日"
MINNANO_PERIOD = r"(\d{4})\s*年?\s*[-－~〜～]\s*(?:(\d{4})\s*年?)?"
#: 血型一格：`AB型`。
MINNANO_BLOOD = r"^(AB|A|B|O)\s*型$"
#: 「別名」一格里说「这是她的旧名字」的注记，与注记末尾的「名義」。
MINNANO_FORMER_NOTES = frozenset({"旧名", "旧名義", "旧芸名", "旧"})
MINNANO_NOTE_SUFFIX = "名義"
#: 「別名」一格以这个注记开头时，整格是更名、复出说明。
MINNANO_REMARK_NOTE = "注"

# ---- Seesaa Wiki（素人系総合 Wiki 与两个认人 Wiki） ----

#: 三站的站名，也是来源设置与处理记录里显示的来源名（`library_processing.SOURCE_LABELS` 与之逐字一致）。
SEESAA_LABEL = "素人系総合 Wiki"
AV_NEME_LABEL = "このAV女優の名前教えてwiki"
AV_NAME_LABEL = "AV女優の名前特定wiki"
#: 出演栏里说明名单不确定的写法。`▲` 是 av_neme 站方说明里的不确定标记。
SEESAA_UNCERTAIN_NAME = r"[?？�▲]|不明|未確認"
#: 链接名摘掉之后剩下的分隔符与「出演順」。
SEESAA_SEPARATORS = r"[\s／/、,・]+|出演順"
#: 认人 Wiki 的出演行开头：av_name 写「出演女優:」，av_neme 写「名前(女優名)：」。
SEESAA_CAST_LABEL = r"^\s*(?:出演女優|名前\s*[(（]女優名[)）])\s*[:：]?"
#: 人物页上链到厂牌目录页的链接字样。
SEESAA_LABEL_INDEX = "レーベル一覧"
#: 作品表里番号与出演那两栏的表头。
SEESAA_CODE_HEADER = "品番"
SEESAA_CAST_HEADER = "出演女優"
#: av_neme 人物页「プロフィール」一节里的名字栏。
SEESAA_PERSON_MAIN_LABEL = "名前(女優名)"
SEESAA_PERSON_NAME_LABELS = ("旧名義&別名", "名前(別名)")
#: 改名页的说明：`…から【新しい名前】へ変更`。
SEESAA_RENAMED = r"から【([^【】]+)】へ変更"

# ---- JavDB ----

#: 演员页 `section-meta` 里的作品数（`323 部影片`），它不是名字。
JAVDB_COUNT = r"^\d+\s*部影片$"
#: 要登录才给的资料页回的是登入页。
JAVDB_LOGIN = r"<title>\s*登入\s*\|"
#: 同一位女优按记录类型分开的那几条，现名后面挂的标记。
JAVDB_RECORD_KIND = r"[(（](?:無碼|无码|有碼|有码|流出|破解|中文字幕)[)）]\s*$"
#: 無碼那条卡片上的标记：繁体界面写 `無碼`，简体界面写 `无码`。
JAVDB_UNCENSORED = frozenset({"無碼", "无码"})
#: 作品详情面板的栏名（`?locale=zh` 的繁体原词）。
JAVDB_FIELDS = {
    "runtime": "時長",
    "genres": "類別",
    "code": "番號",
    "actors": "演員",
    "studio": "片商",
    "label": "發行",
    "series": "系列",
    "director": "導演",
    "release_date": "日期",
}
#: FANZA 限定版带生写真特典的原题：`【FANZA限定】<原题> 生写真N枚付き`。
FANZA_LIMITED_PREFIX = "【FANZA限定】"
FANZA_PHOTO_BONUS_TITLE = r"【FANZA限定】(.+) 生写真[1-9]\d?枚付き"

# ---- JavBus ----

#: JavBus 磁链表里标在名称后的「字幕」按钮：这条磁力带中文字幕。
JAVBUS_SUBTITLES = "字幕"
#: 作品页 `<span class="header">` 的栏名（繁体原词）。
JAVBUS_FIELDS = {
    "code": "識別碼",
    "runtime": "長度",
    "studio": "製作商",
    "label": "發行商",
    "series": "系列",
    "director": "導演",
    "release_date": "發行日期",
}

# ---- FC2 系 ----

#: FC2 商品页的販売日一行。
FC2_SOLD_ON = r"販売日\s*[:：]\s*(\d{4})/(\d{2})/(\d{2})"
#: FC2PPV-DB `<meta name="description">` 末尾那三项。
FC2PPVDB_META_TAIL = (r"販売者:\s*(?P<seller>.*?)\s*/\s*公開日:\s*(?P<date>[^/]*?)\s*/\s*"
                      r"再生時間:\s*(?P<runtime>[\d:]+)\s*$")
FC2PPVDB_JAPANESE_DATE = r"(\d{4})年(\d{1,2})月(\d{1,2})日"
#: FC2PPV-DB 页面上的栏名与标记。
FC2PPVDB_NO_INFORMATION = "情報がありません"
FC2PPVDB_CAST = "出演女優"
FC2PPVDB_SELLER = "販売者"
FC2PPVDB_TAGS = "タグ"
FC2PPVDB_SOLD_ON = "販売日"
FC2PPVDB_LEAKED = "流出あり"
FC2PPVDB_NOT_LEAKED = "流出なし"

# ---- JavArchive ----

#: 正文那块资料：`标签：A｜B｜C`、`日期：2023/11/21`、`时长：50:03`。
JAVARCHIVE_ROWS = {
    "genres": r"标签\s*[:：]\s*([^<]*)",
    "release_date": r"日期\s*[:：]\s*(\d{4})/(\d{2})/(\d{2})",
    "runtime": r"时长\s*[:：]\s*([\d:]+)",
}

# ---- 一本道 ----

#: 一本道自己在页面、作品目录与文件名里的写法。
ONEPONDO_MARKS = ("1pon", "一本道", "1pondo")

# ---- AVWikiDB ----

#: 女优页「身長・スリーサイズ」那一格。
AVWIKIDB_SIZES_CELL = r"身長・スリーサイズ\s*</p>\s*<p[^>]*>([^<]*)<"

# ---- 出演者栏与资料原文 ----

#: 艺名到年龄标记为止，后面是介绍（`はな（19歳）…`）。
PERFORMER_INTRO = r"[\s　]*[（(]?\d+\s*歳.*$"
#: 斜杠分段里单独成段的年龄。
AGE_SEGMENT = r"\s*\d+\s*歳\s*"
#: 描述性称呼：身高、人数、外貌、身份与宣传语，不是谁的艺名（站上出演者栏里的原词）。
DESCRIPTIVE_NAME = (
    r"\d+\s*(?:cm|CM|㎝|センチ|名|人)|[!！]"
    r"|身長|長身|スレンダー|爆乳|巨乳|美乳|美脚|美尻|色白|パイパン|くびれ|クビレ"
    r"|女子|下級生|上級生|女優|グラドル|現役|看板娘|先生|少女|お嬢様|嬢$|美女|美人|ギャル|OL"
    r"|人妻|熟女|素人|店員|主婦|新人|の様な|のような|みたいな|働く|平凡|人気|伝説|抜群"
    r"|きれいな|綺麗な|可愛い|かわいい"
    r"|[A-Za-zＡ-Ｚ]カップ|変態|従事者|事務所|活躍|後輩|先輩|地元|大生|声優|究極|顔の|メンヘラ"
    r"|天真爛漫|^超美$|^牛逼$")
#: 资料原文里混进名字栏的说明文字。
PROFILE_SENTENCE = r"中に.+ながらも|を実現して|を我慢でき|現在は|正式女優名"
#: 已核对的同一艺名中日译写。仅当资料原文含对应日文写法时使用，不把新旧艺名当作语言对应。
REVIEWED_WRITINGS = (
    ("枫花恋", "楓カレン"),
    ("田中柠檬", "田中レモン"),
    ("松永纱奈", "松永さな"),
    ("森泽佳奈", "森沢かな"),
)
