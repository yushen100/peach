"""任务结果摘要里给人看的句子（ADR-0159）：按段存 code 与参数，文字只在语言资源里。

一句话存成 `<字段>_parts`（`outcome_parts`、`source_parts`），每一段是 `{"code", "params"}`，
文字在 `server:outcome.<code>`；「，」「；」这类连接也是一段。参数的值可以又是一串段落
（例如延后的原因），渲染时一并换成文字。

库里的结果摘要与后继的补全记录只存段落；`rendered` 在接口出口处按语言资源补上同名的一句话
（`outcome`、`source`），没更新的前端和用户脚本照旧读得到。判断结论按 code（`is_outcome`），
不拿文字比。
"""
from __future__ import annotations

from . import interface_text

#: 摘要里按段存的字段。
FIELDS = ("outcome", "source")

#: 全部段落 code，按用到它的模块分组。新的一段先登记在这里，再在 `resources/locales/<语言>/server.json`
#: 的 `outcome` 下写中英文；`tests/test_user_messages.py` 逐个核对。
CODES = (
    # 连接
    "semicolon", "comma", "listComma",
    # 通用
    "gone", "unfetched", "needsReview", "registered", "installed",
    # 创作者身份
    "hasIdentity", "noVideoLists", "changedElsewhere", "isStudioOrSeries",
    # 女优别名与资料
    "merged", "aliasesAdded", "noNewAliases", "noMatchTwo", "noMatchThree", "noMatch",
    "siteSaved", "siteLinked", "stillCurrent",
    # 厂牌官网与标识
    "officialSite", "hasMark", "noSiteLink", "faceGateOff", "stillWordmark", "onlySmallIcon",
    "paddedWordmark", "sharedIcon", "portraitNotMark",
    # 头像
    "hasAvatar", "galleryIndexUnfetched", "galleryMissing", "galleryTooSmall", "imageTooSmall",
    "smallImageKept", "galleryMatchUnavailable", "galleryNoMatch", "galleryUnsure", "galleryDisagree",
    "faceModelUnavailable", "matchModelUnavailable", "noCoverFace", "clearestCoverFace", "coverCutFailed",
    "noIdentity", "noSheetFace", "sheetFacesUnconfirmed", "clearestSheetFace", "sheetCutFailed",
    "offsiteUnfetched", "offsiteNoWorks", "offsiteNoFace", "offsiteFacesUnconfirmed",
    "sourceGalleryByCovers", "sourceGalleryByGallery", "sourceGallerySmall", "sourceCover", "sourceOffsiteCover",
    "sourceSheet",
    # 番号样张
    "noCodes", "samplesLanded", "noSamples", "skipped", "skipNoSite", "skipRecentMiss", "skipPaused",
    "skipDeferred", "remainingNext", "remainingLater",
    # 种子导入
    "seedAliases", "seedRefs", "seedLinks", "seedProfiles", "seedMemberships", "seedMakers", "seedRefreshed",
    "seedWithdrawn", "seedNames", "seedConflicts", "seedDuplicates", "seedWithdrawalConflicts", "seedNothing",
    # 自动修复
    "scheduled", "videoUpgraded", "videosUpgraded", "videosDeferred", "videosMalformed", "dimensionsMeasured",
    "deferredBy", "deferMountMedia", "deferMountDimensions", "deferBilling", "deferCooling",
    # 人脸模型
    "faceModelFetched", "matchModelFetched", "faceModelsReady",
)
_KNOWN = frozenset(CODES)


def part(code: str, /, **params) -> dict:
    """一段。code 不在 `CODES` 里直接报错：错字不该等到界面上缺译文才发现。"""
    if code not in _KNOWN:
        raise KeyError(f"unknown outcome code: {code}")
    return {"code": code, "params": params}


def parts(*items) -> list[dict]:
    """每一项是 code、`part(...)`，或者已经是一串段落（原样展开）。"""
    out: list[dict] = []
    for item in items:
        if isinstance(item, list):
            out += item
        elif isinstance(item, dict):
            out.append(item)
        else:
            out.append(part(item))
    return out


def joined(items, separator: str = "semicolon") -> list[dict]:
    """几项之间插入连接段；每一项可以是 code、一段或一串段落，空的那一项连同连接一起略过。"""
    out: list[dict] = []
    for item in items:
        if item in ([], None, ""):
            continue
        if out:
            out.append(part(separator))
        out += parts(item)
    return out


def said(*items, field: str = "outcome") -> dict:
    """摘要里的一句：`{"<字段>_parts": [...]}`，直接展开进摘要。"""
    return {f"{field}_parts": parts(*items)}


def _value(value, language):
    return render(value, language) if _is_parts(value) else value


def _is_parts(value) -> bool:
    return isinstance(value, list) and all(isinstance(item, dict) and "code" in item for item in value)


def render(items: list[dict], language: str = interface_text.SOURCE_LANGUAGE) -> str:
    return "".join(interface_text.text(
        f"server:outcome.{item['code']}",
        {key: _value(value, language) for key, value in (item.get("params") or {}).items()},
        language=language) for item in items)


def codes(summary: dict | None, field: str = "outcome") -> list[str]:
    value = summary.get(f"{field}_parts") if isinstance(summary, dict) else None
    return [item.get("code") for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def is_outcome(summary: dict | None, *items) -> bool:
    """结论是不是正好这一句（按各段的 code 比）。"""
    return codes(summary) == [item["code"] for item in parts(*items)]


def outcome_parts(summary: dict | None) -> list[dict]:
    value = summary.get("outcome_parts") if isinstance(summary, dict) else None
    return list(value) if isinstance(value, list) else []


def rendered(summary: dict, language: str = interface_text.SOURCE_LANGUAGE) -> dict:
    """接口出口：按段存的字段补上渲染好的一句。段落对不上资源（被别处改坏）时只去掉段落。"""
    if not isinstance(summary, dict) or not any(f"{field}_parts" in summary for field in FIELDS):
        return summary
    out = dict(summary)
    for field in FIELDS:
        value = out.get(f"{field}_parts")
        if value is None:
            continue
        try:
            out[field] = render(value, language)
        except (KeyError, TypeError, AttributeError, interface_text.InterfaceTextMissing):
            out.pop(f"{field}_parts")
    return out
