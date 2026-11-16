"""账本与复核产物里的约定取值（ADR-0159 第四条：内容数据；ADR-0162）。

会被代码读回比对的取值用英文稳定 id，界面按 id 取语言；旧版写下的中文取值由文件末尾两节的对照表
在读入时归一，账本里的旧值由迁移改写。仍保留中文的是内容本身：写进 `review_decision.note` 的用户
决定备注、标签名、文件名里的后期处理标记等。改写法等于改数据格式，改之前先补旧值对照或迁移。
"""
from __future__ import annotations

import re

# 下面几项由 `catalog_rules` 定义（它是最底层纯规则，不能反过来导入这里），在这里对外提供：
# `PERFORMER_TAG_PREFIX` 是 `asset_tag` 里出演者标记的前缀，`performer:<名字>` 是出演者投影，不是内容标签；
# 版次 id 与 FC2 卷 id 的说明见下。
from .catalog_rules import (  # noqa: F401 —— 对外提供
    CHINESE_SUBTITLES, FC2_BONUS_PREFIX, FC2_MAIN_PART, PERFORMER_TAG_PREFIX, UNCENSORED, UNCENSORED_CRACK,
    UNCENSORED_LEAK,
)

#: `asset.ctx_orient` 的竖屏与横屏取值，由 `media_probe.context_fields` 写入；界面按语言显示。
PORTRAIT = "portrait"
LANDSCAPE = "landscape"

#: 版次 id（`catalog_rules.jav_edition_badges` 给出，除有码外定义在那里），界面按 `labels.catalogEdition.<id>` 显示。
#: 没有任何版次证据的正片按有码算。
CENSORED = "censored"
#: 版次的展示次序：正片在前，处理过的在后。这不是偏好排序，只是要一个稳定的锚点——卡片标题取
#: 第一个，次序一变卡片就换名字。
EDITION_ORDER = (CENSORED, CHINESE_SUBTITLES, UNCENSORED, UNCENSORED_LEAK, UNCENSORED_CRACK)

#: 版次的显示名 code 前缀，后接上面的 id。
EDITION_LABEL_CODE_PREFIX = "labels.catalogEdition."

#: FC2 合集的卷 id（`catalog_rules.fc2_collection_label`，定义在那里）：本篇是 `FC2_MAIN_PART`（`main`），
#: 特典是 `FC2_BONUS_PREFIX` 加序号（`bonus-<n>`），数字卷是数字本身。

#: 文件名里的后期处理标记，按子串认，认到的原样当版本说明。
PROCESSING_MARKERS = ("修复", "美颜")

#: 想要清单资源（`cache/want-resources.json` 与 `/api/jav/resources`）的取值：评论区链接的 `source`，
#: 以及 `attributes` 里的中字、高清标记。界面按 `source_code` 与属性 id 显示。中字与版次 id 同一个。
RESOURCE_COMMENT_SOURCE = "javdb-comments"
RESOURCE_CHINESE_SUBTITLES = CHINESE_SUBTITLES
RESOURCE_HD = "high-definition"

#: 西方身份候选 CSV（`babepedia-candidates.csv`）`verdict` 列的取值：命中、命中但要人看、站上确认没有档案、
#: 被限流没查成。由 `scripts/match_babepedia_creators.py` 写，复核页与两个取图脚本读。
WESTERN_IDENTITY_MATCHED = "matched"
WESTERN_IDENTITY_NEEDS_REVIEW = "needs-review"
WESTERN_IDENTITY_NO_PROFILE = "no-profile"
WESTERN_IDENTITY_RATE_LIMITED = "rate-limited"
#: 其中要人看的两种取值。
WESTERN_IDENTITY_REVIEW_VERDICTS = (WESTERN_IDENTITY_MATCHED, WESTERN_IDENTITY_NEEDS_REVIEW)
#: 旧版候选 CSV 写的中文取值，读入时先按它归一。
LEGACY_WESTERN_IDENTITY_VERDICTS = {
    "命中": WESTERN_IDENTITY_MATCHED, "需人工确认": WESTERN_IDENTITY_NEEDS_REVIEW,
    "确认无档案": WESTERN_IDENTITY_NO_PROFILE, "未取得:限流": WESTERN_IDENTITY_RATE_LIMITED,
}
#: 封面来源候选 CSV（批量封面日志）`result` 里「已取得」的取值，读入时先经 `fetch_result` 归一。
COVER_FETCHED = "found"

#: 写进 `review_decision.note` 的用户决定备注：垃圾队列里点「不是垃圾」、重复组里点「都保留」。
NOT_JUNK_NOTE = "用户确认不是垃圾"
KEEP_DUPLICATES_NOTE = "用户确认这组都保留"

#: 视频的时长与画质分档，顺序同 `media_probe.context_fields` 的判据：由短到长、由高到低。档名是账本
#: `ctx_length`、`ctx_quality` 的取值；时长档与最低一档画质的显示名由前端按取值给。
LENGTH_BANDS = ("quick", "short", "medium", "long")
QUALITY_BANDS = ("4K", "2K", "1080P", "720P", "low")

#: 素人发行的内容标签名（`asset_tag.tag` 与标签实体的规范名）。
AMATEUR_TAG = "素人"


# ── 旧版文件取值（ADR-0162）──────────────────────────────────────────────
#: 批量封面日志与 FC2 候选日志 `result` 列的英文 id。旧文件里写的是中文，读入时用 `fetch_result` 换成 id。
FETCH_FOUND, FETCH_MISSED = COVER_FETCHED, "missed"
_LEGACY_FETCH_RESULTS = {"取得": FETCH_FOUND, "未取得": FETCH_MISSED}


def fetch_result(value: object) -> str:
    """日志 `result` 列的取值：旧中文值换成英文 id，其余原样。"""
    text = str(value or "")
    return _LEGACY_FETCH_RESULTS.get(text, text)


#: 想要清单资源缓存里旧版写的中文取值。读缓存时经 `resource_item` 换成 id。
_LEGACY_RESOURCE_SOURCES = {"JavDB 评论": RESOURCE_COMMENT_SOURCE}
_LEGACY_RESOURCE_ATTRIBUTES = {"中字": RESOURCE_CHINESE_SUBTITLES, "高清": RESOURCE_HD}


def _legacy_resource_value(table: dict[str, str], value: object) -> object:
    return table.get(value, value) if isinstance(value, str) else value


def resource_item(item: dict) -> dict:
    """资源缓存里的一条：旧版的来源与属性中文值换成 id，其余原样。"""
    attributes = item.get("attributes")
    source = _legacy_resource_value(_LEGACY_RESOURCE_SOURCES, item.get("source"))
    if isinstance(attributes, list):
        attributes = list(dict.fromkeys(
            _legacy_resource_value(_LEGACY_RESOURCE_ATTRIBUTES, value) for value in attributes))
    if source == item.get("source") and attributes == item.get("attributes"):
        return item
    return {**item, "source": source, "attributes": attributes}


# ---- 旧版账本取值 ----
# 旧版本写进账本的中文取值（ADR-0162）。迁移 `0057_stored_values_english_ids.sql` 把账本里的旧值
# 改成上面的 id；这里的对照只给账本之外还会带着旧值进来的入口用：旧书签与历史地址里的筛选参数、
# 随包种子里的链接名。

#: 旧版 `orient` 参数与 `ctx_orient` 取值。
LEGACY_ORIENTATIONS = {"竖屏": PORTRAIT, "横屏": LANDSCAPE}
#: 旧版 `len` 参数与 `ctx_length` 取值。
LEGACY_LENGTH_BANDS = dict(zip(("速食", "短", "中", "长"), LENGTH_BANDS))
#: 旧版 `ctx_quality` 的最低一档。
LEGACY_QUALITY_BANDS = {"低画质": QUALITY_BANDS[-1]}
#: 旧版出演者标记前缀。
LEGACY_PERFORMER_TAG_PREFIX = "演员:"
#: 旧版 `entity_link.label` 的通用链接名，值是 `content_words` 里的 id（这里写字面量，免得两份内容数据互相导入）。
LEGACY_LINK_LABELS = {"官方网站": "official-site", "官网": "official-site", "K-MIB 官网": "official-site",
                      "博客": "blog", "官方博客": "official-blog", "官方频道页": "official-channel",
                      "官方商店": "official-shop"}
#: 带专名的旧版通用链接名：`id:专名`，界面按 id 取当前语言的写法、专名原样代入。冒号前不在这里的
#: 链接名（平台名、公司名）界面原样显示，所以 id 只从这张表里来。
LEGACY_LINK_LABEL_PATTERNS = (
    (re.compile(r"官网存档（(\d{4}-\d{2})）"), "official-archive"),
    (re.compile(r"博客 (.+)"), "blog"),
    (re.compile(r"(.+) 作品页"), "catalog-page"),
    (re.compile(r"(.+) 厂牌页"), "label-page"),
    (re.compile(r"(.+) 系列页"), "series-page"),
    (re.compile(r"(.+) 作品列表"), "catalog-list"),
    (re.compile(r"粉丝社区 (.+)"), "fan-community"),
    (re.compile(r"(.+)（招募）"), "recruiting"),
    (re.compile(r"链接集（(.+)）"), "link-hub"),
)
#: 夹在专名里的「官方」：`nanairo 官方 X @_scute` 去掉它就是专名本身。
LEGACY_LINK_LABEL_OFFICIAL_INFIX = re.compile(r"^(\S.*?) 官方 (\S.*)$")


def current_orientation(value: str) -> str:
    """筛选参数里的画幅：旧版中文取值换成 id，其余原样。"""
    return LEGACY_ORIENTATIONS.get(value, value)


def current_length_band(value: str) -> str:
    """筛选参数里的时长档：旧版中文取值换成 id，其余原样。"""
    return LEGACY_LENGTH_BANDS.get(value, value)


def current_tag(value: str) -> str:
    """筛选或输入里的标签：旧版出演者前缀换成现在的前缀，其余原样。"""
    if value.startswith(LEGACY_PERFORMER_TAG_PREFIX):
        return PERFORMER_TAG_PREFIX + value[len(LEGACY_PERFORMER_TAG_PREFIX):]
    return value


def current_link_label(value: str) -> str:
    """链接名：旧版通用链接名换成 id（带专名的写成 `id:专名`），其余（平台名、公司名）原样。"""
    if value in LEGACY_LINK_LABELS:
        return LEGACY_LINK_LABELS[value]
    for pattern, label in LEGACY_LINK_LABEL_PATTERNS:
        if match := pattern.fullmatch(value):
            return f"{label}:{match.group(1)}"
    if match := LEGACY_LINK_LABEL_OFFICIAL_INFIX.fullmatch(value):
        return f"{match.group(1)} {match.group(2)}"
    return value


def is_performer_marker(value: str) -> bool:
    """这个标签是出演者标记吗（认现在与旧版两种前缀）：输入侧据此拒收，不当内容标签加。"""
    return current_tag(value).startswith(PERFORMER_TAG_PREFIX)
