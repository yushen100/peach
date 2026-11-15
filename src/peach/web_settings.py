"""跟人走的界面设置。

大部分界面偏好留在浏览器本地就够了——悬停延迟、每批数量、默认排序，这些更像
「这台设备上顺手」而不是「我的习惯」，换台电脑重设一次也不奇怪。

侧栏不一样。左侧导航放哪些入口、什么顺序，是长出来的使用习惯；在 Windows 上排好，
到 Mac 上又是默认顺序，那不叫两台设备，叫两个应用。所以它跟着账本走。

名称显示语言也随用户走，落在现有的 `profile.settings_json` 中，不需要新增表或迁移。

写入受 ledger 只读闸门约束：reader（只读端）改不了顺序，但读到的是 writer 的那份，
这正是「同一份习惯」的意思。
"""
from __future__ import annotations

import json
import time
from typing import Protocol

from . import wants
from .catalog_rules import CodePatternError, compile_code_patterns
from .feeds import DEFAULT_HIDDEN_COMPILATIONS, EXCERPT, GROUP_COMPILATION, SOLO_COMPILATION
from .media_sources import SCANNABLE_LOCATIONS
from .remote_media_cache import AVATAR_REFRESH_SECONDS, FAVICON_REFRESH_SECONDS
from .system_language import system_language
from .user_messages import UserValueError

from .profiles import DEFAULT_PROFILE_ID

#: 默认就在侧栏里的入口，顺序即默认顺序。首页之后是关注（每天有新东西的那一屏），
#: 再是主库最常用的浏览模式 JAV，然后三个索引，回头找的已标记，管理垫底。
DEFAULT_SIDEBAR_ORDER = (
    "", "follow", "jav", "performers", "tags", "studios", "flagged", "manage",
)
#: 可以加进侧栏、但默认不在的入口。播放列表和沉浸模式都是从一条作品或一个索引里
#: 发起的动作，常驻一格换来的是每次都要跳过它，所以归到这里等人自己加。
OPTIONAL_SIDEBAR_KEYS = (
    "playlists", "immerse",
    "stats", "review", "data-cleanup", "trash", "follow-manage", "quality",
)
ALL_SIDEBAR_KEYS = frozenset(DEFAULT_SIDEBAR_ORDER) | frozenset(OPTIONAL_SIDEBAR_KEYS)
SIDEBAR_KEY_ALIASES = {"ads": "data-cleanup", "dupes": "data-cleanup"}

FOLLOW_INITIAL_DAYS = (0, 7, 30, 90)
DEFAULT_FOLLOW_INITIAL_DAYS = 30
#: 搜索框下拉里列几条最近搜索；0 是不记录。记录本身就在账本里（`/api/search-history`），
#: 上限跟着它走，否则同一份记录在两台设备上显示的条数不一样。
SEARCH_HISTORY_LIMIT_MAX = 50
#: 已登记上线的界面语言，与前端 `frontend/src/i18n/index.ts` 的 `INTERFACE_LANGUAGES` 逐项一致。
#: Weblate 新开的语言只有 `resources/locales/` 目录，翻到能用后两处一起登记。
INTERFACE_LANGUAGES = ("zh-CN", "en")
#: 设置里能存的值：`auto` 由每个浏览器按自己的语言偏好、再按运行 Peach 的电脑的系统语言选（默认）。
INTERFACE_LANGUAGE_CHOICES = ("auto", *INTERFACE_LANGUAGES)

#: 只有这些键跟着账本走。白名单而不是黑名单：将来往设置里加字段的人必须显式表态
#: 它该不该跨机同步，而不是默认就同步过去。
#: `postSetupTutorialDone` 说的是「这套馆藏已经装完了」，不是「这台设备看过教程」——
#: 装完就是装完，换台设备打开不该再被教一遍，所以它也跟着账本走。
#: 整理模板（ADR-0039）同理：它是「我要我的库长什么样」，不是这台设备上的顺手。
#: 新作那一行收不收合集（`feeds.compilation_kind`）同样是服务端行为：列表、未读数和
#: 替哪些壳补封面都按它算，所以跟着账本走。
#: 番号识别规则描述的是这套馆藏的命名，处理任务按它往账本里写番号，同样跟着账本走。
#: 界面语言（ADR-0156）是用这套馆藏的那个人读的语言，每个部署只有一人，换台设备不该再选一遍。
#: 浏览器入库没搜到资源时加不加入想要（ADR-0161）是服务端在入库队列里做的事，同样跟着账本走。
#: 「想要」老片多久查一次、查几次放弃（`wants.cadence`）是定时查找读的，同样跟着账本走。
SYNCED_SETTING_KEYS = frozenset({
    "sidebarOrder", "manageOrder", "navigationOrders", "libraryOrder", "followInitialDays", "postSetupTutorialDone",
    "organizeTemplates", "feedHideGroupCompilations", "feedHideSoloCompilations",
    "feedHideExcerpts", "searchHistoryLimit", "codePatterns", "performerNameLanguage", "taskSpeedMode",
    "interfaceLanguage", "javBrowserWantOnNoMatch", "wantStaleSearchDays", "wantStaleAttemptLimit",
})
#: 「想要」两项节奏设置的键、档位校验与报错 code。
WANT_CADENCE_KEYS = (
    ("wantStaleSearchDays", wants.normalise_stale_search_days, wants.STALE_SEARCH_DAY_CHOICES),
    ("wantStaleAttemptLimit", wants.normalise_stale_attempt_limit, wants.STALE_ATTEMPT_LIMITS),
)
#: 三个收起开关的键与各自对应的那一类，缺省值取 `feeds.DEFAULT_HIDDEN_COMPILATIONS`。
FEED_COMPILATION_SWITCHES = (
    ("feedHideGroupCompilations", GROUP_COMPILATION),
    ("feedHideSoloCompilations", SOLO_COMPILATION),
    ("feedHideExcerpts", EXCERPT),
)


class SettingsContract(Protocol):
    def read_connection(self): ...
    def write_transaction(self): ...


DEFAULT_MANAGE_ORDER = ('stats', 'taste', 'cleanup', 'follow', 'activity', 'configuration')
NAVIGATION_ORDERS = {
    'review': ('metadata_fields', 'creator_tags', 'code_creators', 'western_identity', 'performer_avatars',
               'studio_logos', 'fc2_markings', 'fc2_similarity', 'video_endcards'),
    'configuration': ('library', 'sources', 'downloads', 'network', 'maintenance', 'diagnostics'),
    'favorites': ('all', 'filters', 'performer', 'creator', 'tag', 'series', 'studio', 'agency'),
    'jav': ('library', 'wants', 'releases', 'discover'),
    'follow': ('list', 'add', 'tags'),
    'tags': ('local', 'online'),
    'preferences': ('appearance', 'browsing', 'jav', 'search', 'content'),
}


def normalise_navigation_orders(raw):
    """按组归一化已存顺序，新入口追加至个人顺序末尾。"""
    if not isinstance(raw, dict):
        return {}
    result = {}
    for group, defaults in NAVIGATION_ORDERS.items():
        entries = raw.get(group)
        if isinstance(entries, list):
            fixed = ['all'] if group == 'favorites' else []
            result[group] = list(dict.fromkeys(fixed + [key for key in entries if isinstance(key, str) and key in defaults]
                                              + list(defaults)))
    return result


def navigation_orders_patch(raw):
    if not isinstance(raw, dict) or set(raw) - NAVIGATION_ORDERS.keys():
        raise UserValueError('api.settings.navigationOrdersInvalid')
    if any(not isinstance(entries, list) or any(not isinstance(key, str) or key not in NAVIGATION_ORDERS[group]
                                               for key in entries) for group, entries in raw.items()):
        raise UserValueError('api.settings.navigationOrderUnknownEntry')
    return normalise_navigation_orders(raw)


def normalise_manage_order(raw):
    entries = raw if isinstance(raw, list) else []
    return list(dict.fromkeys([value for value in entries if isinstance(value, str) and value in DEFAULT_MANAGE_ORDER]
                             + list(DEFAULT_MANAGE_ORDER)))


def normalise_sidebar_order(raw) -> list[str]:
    """把任意输入收敛成一份合法的侧栏顺序。

    数组同时表达顺序和显隐：在里面就显示，不在就不显示。所以「取消显示」和
    「调整顺序」是同一个写入，不需要两个字段。

    不认识的键直接丢掉——它可能来自旧版本或者手改的载荷，留着会让前端渲染出
    一个点不开的入口。全部丢光时回落到默认顺序，空侧栏没有可用性可言。
    """
    if not isinstance(raw, list):
        return list(DEFAULT_SIDEBAR_ORDER)
    seen: list[str] = []
    for raw_key in raw:
        if not isinstance(raw_key, str):
            continue
        key = SIDEBAR_KEY_ALIASES.get(raw_key, raw_key)
        if key not in ALL_SIDEBAR_KEYS or key in seen:
            continue
        seen.append(key)
    return seen or list(DEFAULT_SIDEBAR_ORDER)


def normalise_follow_initial_days(raw) -> int:
    """首次采集的历史天数；0 表示不限时间。"""
    if isinstance(raw, bool):
        return DEFAULT_FOLLOW_INITIAL_DAYS
    try:
        days = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_FOLLOW_INITIAL_DAYS
    return days if days in FOLLOW_INITIAL_DAYS else DEFAULT_FOLLOW_INITIAL_DAYS


def follow_initial_days(contract: SettingsContract) -> int:
    return normalise_follow_initial_days(_stored(contract).get("followInitialDays"))


def normalise_search_history_limit(raw) -> int | None:
    """0 到上限之间的整数原样收下，其余一律当没设置过。

    没设置过读出来是 None 而不是默认值：前端据此把各浏览器本地记着的那个数同步上来一次。
    """
    if isinstance(raw, bool) or not isinstance(raw, (int, float, str)):
        return None
    if isinstance(raw, float) and not raw.is_integer():
        return None
    try:
        limit = int(raw)
    except (TypeError, ValueError):
        return None
    return limit if 0 <= limit <= SEARCH_HISTORY_LIMIT_MAX else None


def normalise_organize_templates(raw) -> dict:
    """收敛整理模板：`{来源: {"file": 模板, "dir": 模板}}`。

    模板在这里就要过一遍 `validate_template`：它决定文件会被改成什么名字、放到哪一层，
    一个带 `..` 的模板存进去、等到执行那一刻才拒绝，用户已经点过确认了。
    """
    from .organize_templates import validate_template
    if not isinstance(raw, dict):
        return {}
    clean: dict[str, dict[str, str]] = {}
    for location, entry in raw.items():
        if location not in SCANNABLE_LOCATIONS or not isinstance(entry, dict):
            continue
        # 模板不合法时 `TemplateError` 原样抛给调用方：它是 `ValueError`，API 翻成 400
        # 并把那句中文交给用户，而不是把这一份悄悄丢掉。
        file_template = validate_template(str(entry.get("file") or ""))
        dir_template = validate_template(str(entry.get("dir") or ""), directory=True)
        if file_template or dir_template:
            clean[location] = {"file": file_template, "dir": dir_template}
    return clean


def organize_templates(contract: SettingsContract) -> dict:
    """服务端读到的整理模板。没配过就是空字典，整理端点据此拒绝执行。"""
    return normalise_organize_templates(_stored(contract).get("organizeTemplates"))


def normalise_code_patterns(raw) -> list[str]:
    """收敛番号识别规则：一组正则，去掉空行。

    存之前就编译一遍：写错的规则在保存那一刻报给用户（带 code 的 `UserValueError`，API 翻成 400），
    不等到下一次处理时才在后台悄悄失效。
    """
    try:
        compile_code_patterns(raw)
    except CodePatternError as error:
        raise UserValueError(error.code, error.params) from None
    return [str(rule).strip() for rule in raw or () if str(rule or "").strip()]


def _stored_code_patterns(payload: dict) -> list[str]:
    """存进去之后又被手改坏的规则当没设置过：页面照常打开，处理也不因此中断。"""
    try:
        return normalise_code_patterns(payload.get("codePatterns"))
    except (TypeError, ValueError):
        return []


def _feed_switches(payload: dict) -> dict[str, bool]:
    return {key: payload[key] if isinstance(payload.get(key), bool)
            else kind in DEFAULT_HIDDEN_COMPILATIONS
            for key, kind in FEED_COMPILATION_SWITCHES}


def hidden_compilations(contract: SettingsContract) -> frozenset[str]:
    """新作那一行收起哪几类合集。"""
    switches = _feed_switches(_stored(contract))
    return frozenset(kind for key, kind in FEED_COMPILATION_SWITCHES if switches[key])


def _stored(contract: SettingsContract) -> dict:
    with contract.read_connection() as connection:
        row = connection.execute(
            "SELECT settings_json FROM profile WHERE id=?", (DEFAULT_PROFILE_ID,),
        ).fetchone()
    if row is None:
        return {}
    try:
        payload = json.loads(row["settings_json"] or "{}")
    except (TypeError, ValueError):
        # 载荷坏了就当没设置过：这是界面偏好，不值得让页面打不开。
        return {}
    return payload if isinstance(payload, dict) else {}


def q_settings(contract: SettingsContract, _args=None) -> dict:
    """读取跟人走的那部分设置。缺省时返回默认值，不返回空。"""
    payload = _stored(contract)
    cadence = wants.cadence_from(payload)
    return {
        "sidebarOrder": normalise_sidebar_order(payload.get("sidebarOrder")),
        **({"manageOrder": normalise_manage_order(payload["manageOrder"])} if "manageOrder" in payload else {}),
        **({"navigationOrders": normalise_navigation_orders(payload["navigationOrders"])} if "navigationOrders" in payload else {}),
        **({"libraryOrder": payload["libraryOrder"]} if isinstance(payload.get("libraryOrder"), list) else {}),
        "avatarRefreshDays": AVATAR_REFRESH_SECONDS // 86400,
        "faviconRefreshDays": FAVICON_REFRESH_SECONDS // 86400,
        "followInitialDays": normalise_follow_initial_days(payload.get("followInitialDays")),
        "postSetupTutorialDone": payload.get("postSetupTutorialDone") is True,
        "organizeTemplates": normalise_organize_templates(payload.get("organizeTemplates")),
        "codePatterns": _stored_code_patterns(payload),
        **_feed_switches(payload),
        "searchHistoryLimit": normalise_search_history_limit(payload.get("searchHistoryLimit")),
        "performerNameLanguage": "ja" if payload.get("performerNameLanguage") == "ja" else "zh-CN",
        "interfaceLanguage": payload["interfaceLanguage"] if payload.get("interfaceLanguage") in INTERFACE_LANGUAGE_CHOICES else "auto",
        "systemLanguage": system_language(),
        "taskSpeedMode": payload.get("taskSpeedMode", "standard"),
        "javBrowserWantOnNoMatch": payload.get("javBrowserWantOnNoMatch") is not False,
        "wantStaleSearchDays": cadence.stale_every.days,
        "wantStaleAttemptLimit": cadence.attempt_limit,
    }


def _want_cadence_patch(body):
    """「想要」两项节奏设置：只收列出的档位，不在档位里的值整次拒收。"""
    patch = {}
    for key, normalise, choices in WANT_CADENCE_KEYS:
        if key in body:
            value = normalise(body[key])
            if value is None:
                raise UserValueError("api.settings.choiceInvalid",
                                     {"key": key, "choices": "/".join(map(str, choices))})
            patch[key] = value
    return patch


def _navigation_patch(body):
    patch = {}
    if "navigationOrders" in body:
        patch["navigationOrders"] = navigation_orders_patch(body["navigationOrders"])
    if "libraryOrder" in body:
        order = body["libraryOrder"]
        if (not isinstance(order, list) or len(order) > 1000
                or any(not isinstance(key, str) or not key or len(key) > 120 for key in order)
                or len(set(order)) != len(order)):
            raise UserValueError("api.settings.libraryOrderInvalid")
        patch["libraryOrder"] = order
    return patch


def w_settings(contract: SettingsContract, body) -> dict:
    """写入跟人走的设置；只认白名单里的键。

    合并而不是整体替换：请求里没提到的键保持原样，这样将来新增同步字段时，
    旧版本前端提交的载荷不会把它抹掉。
    """
    if not isinstance(body, dict):
        raise TypeError("settings body must be an object")
    unknown = set(body) - SYNCED_SETTING_KEYS
    if unknown:
        raise UserValueError("api.settings.unknownKeys", {"keys": str(sorted(unknown))})
    if not body:
        raise UserValueError("api.settings.empty")

    merged = _stored(contract)
    merged.update(_navigation_patch(body))
    merged.update(_want_cadence_patch(body))
    if "taskSpeedMode" in body:
        from .processing_control import valid_mode
        merged["taskSpeedMode"] = valid_mode(body["taskSpeedMode"])
    if "performerNameLanguage" in body:
        language = body["performerNameLanguage"]
        if language not in ("zh-CN", "ja"):
            raise UserValueError("api.settings.performerNameLanguageInvalid")
        merged["performerNameLanguage"] = language
    if "interfaceLanguage" in body:
        if body["interfaceLanguage"] not in INTERFACE_LANGUAGE_CHOICES:
            raise UserValueError("api.settings.interfaceLanguageInvalid",
                                 {"choices": "、".join(INTERFACE_LANGUAGE_CHOICES)})
        merged["interfaceLanguage"] = body["interfaceLanguage"]
    if "manageOrder" in body:
        merged["manageOrder"] = normalise_manage_order(body["manageOrder"])
    if "sidebarOrder" in body:
        merged["sidebarOrder"] = normalise_sidebar_order(body["sidebarOrder"])
    if "followInitialDays" in body:
        merged["followInitialDays"] = normalise_follow_initial_days(body["followInitialDays"])
    if "postSetupTutorialDone" in body:
        merged["postSetupTutorialDone"] = body["postSetupTutorialDone"] is True
    if "organizeTemplates" in body:
        merged["organizeTemplates"] = normalise_organize_templates(body["organizeTemplates"])
    if "codePatterns" in body:
        merged["codePatterns"] = normalise_code_patterns(body["codePatterns"])
    if "searchHistoryLimit" in body:
        limit = normalise_search_history_limit(body["searchHistoryLimit"])
        if limit is None:
            raise UserValueError("api.settings.searchHistoryLimitInvalid", {"max": SEARCH_HISTORY_LIMIT_MAX})
        merged["searchHistoryLimit"] = limit
    for key in [key for key, _kind in FEED_COMPILATION_SWITCHES] + ["javBrowserWantOnNoMatch"]:
        if key in body:
            if not isinstance(body[key], bool):
                raise UserValueError("api.settings.switchNotBoolean", {"key": key})
            merged[key] = body[key]
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with contract.write_transaction() as connection:
        row = connection.execute("SELECT settings_json FROM profile WHERE id=?", (DEFAULT_PROFILE_ID,)).fetchone()
        try:
            current = json.loads(row[0] or "{}") if row else {}
        except (TypeError, ValueError):
            current = {}
        current = current if isinstance(current, dict) else {}
        patch = {key: merged[key] for key in body}
        if "navigationOrders" in patch:
            patch["navigationOrders"] = {**normalise_navigation_orders(current.get("navigationOrders")),
                                         **patch["navigationOrders"]}
        current.update(patch)
        updated = connection.execute(
            "UPDATE profile SET settings_json=?, updated_at=? WHERE id=?",
            (json.dumps(current, ensure_ascii=False), stamp, DEFAULT_PROFILE_ID),
        ).rowcount
        if not updated:
            raise UserValueError("api.settings.profileMissing", {"profile": DEFAULT_PROFILE_ID})
    return {"ok": True, **q_settings(contract)}
