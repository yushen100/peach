"""Read-only external metadata providers and Peach-owned candidate normalization."""
from __future__ import annotations

import re
from datetime import date
from functools import lru_cache
from urllib.parse import urlsplit

from .catalog_rules import (
    DIGIT_LABEL_PATTERN, same_release_code, code_query_variants, code_serial_pattern, normalise_code_key,
    tokyo_hot_code)
from .genre_taxonomy import map_genres, unmapped_genre_warning
from .http import body_text
from .javdb import LOGIN as JAVDB_LOGIN_PAGE
from .entities import (
    FORMER_PREFIX,
    KANA,
    KANJI,
    canonicalize_entity_name,
    collapse_repeated_entity_name,
    normalize_entity_name,
)
from .metadata_alias_resolve import is_descriptive, is_planning_alias
from . import interface_text
from .coded_text import Said, coded, parallel
from .user_messages import UserFacingError

#: 原样转述上游原文（上游网站与 amane 桥的报错、`HTTP 503` 这类状态说明）时用的 code，模板只有 `{{detail}}`。
#: 这类文字本来就没有译文；Peach 自己的说法一律有自己的 code。
RELAYED = "errors.metadata.relayed"


def relayed(text: object) -> tuple[str, dict]:
    """原样转述一句上游原文：展开给 `RelayableError` 一族的构造，`NotFound(*relayed("HTTP 404"))`。"""
    return RELAYED, {"detail": str(text)}


class RelayableError(UserFacingError):
    """来源与采集链上的失败：给人看的那句是 `server` 命名空间里的 code 与参数。

    转述上游原文要显式写成 `relayed(原文)`；构造时传别的字符串直接抛 `TypeError`，免得一句中文
    被当成原文透传、英文界面跟着露出中文。`pickle`、`copy` 走 `UserFacingError.__reduce__` 按状态复制，
    不经过这里。
    """

    def __init__(self, code: str, params: dict | None = None, *, status_code: int | None = None) -> None:
        if not (isinstance(code, str) and interface_text.has(f"server:{code}")):
            raise TypeError(f"{type(self).__name__} takes a server message code, not {code!r}; "
                            "relay upstream text with relayed(text)")
        super().__init__(code, params, status_code=status_code)

    @property
    def response_status(self) -> int:
        """漏到接口层时的状态：子类的 `status_code` 记的是上游网站的状态，不能当响应状态；
        按原来的内置基类算，`ValueError` 一族回 400，其余回 500。"""
        return 400 if isinstance(self, ValueError) else 500


def relay_args(error: BaseException) -> tuple[str, dict]:
    """另一个异常的说法交给 `RelayableError` 的构造参数：带 code 的照搬 code 与参数，别的按原文转述。"""
    if isinstance(error, UserFacingError):
        return error.code, dict(error.params)
    return relayed(str(error))


#: 日期式那一支两种分隔符都放行：`_` 是一本道等片商的标识，不是可替换的写法
#: （`catalog_rules._CODE_DATE`）。这里拦的是路径、URL 和任意文本，不是分隔符。
_SAFE_CODE = re.compile(
    r"^(?:FC2-PPV-\d{5,}|\d{3}[A-Z]{2,6}-\d{2,5}|[A-Z]{2,8}-\d{2,5}|\d{6}[-_]\d{2,4}|"
    rf"{DIGIT_LABEL_PATTERN}-\d{{2,5}})$")
CATALOG_EVIDENCE_FIELDS = (
    "title", "original_title", "runtime", "director", "label",
    "poster_url", "cover_url", "screenshot_urls", "trailer_url",
)
MAX_EVIDENCE_URLS = 24


class MetadataProviderError(RelayableError, RuntimeError):
    """来源没给出结果的原因。`kind` 是分类，不是措辞；措辞是 code 与参数（转述上游原文用 `relayed`）。

    `auth` 单列一档：登录墙、Cookie 过期和 401/403 与「这次没问出结果」不是一回事，
    和「这部片不存在」更不是。混在 `unavailable` 里的代价有两样：一是每个番号都要为
    同一把锁再付一次往返，本批几百次请求全部注定失败；二是批处理按 `unavailable` 退让
    几百秒后又回来重试，而凭据不换，重试多少次都是同一个结果。

    `auth` 固定 `retryable=False`（同一份凭据再问一次不会变）、`temporary=True`
    （换一份 Cookie 就能继续，所以不能作为定论冻进快照——`SETTLED_ERROR_KINDS`
    只收 `not_found`）。
    """

    def __init__(
        self, code: str, params: dict | None = None, *, kind: str = "unknown", status_code: int = 0,
        retryable: bool = False, temporary: bool = False, detail: str = "",
    ) -> None:
        super().__init__(code, params)
        self.kind = kind
        #: 上游答复的 HTTP 状态，不是接口响应的状态码。
        self.status_code = status_code
        self.retryable = retryable
        self.temporary = temporary
        #: 来源自己给的细档，比 `kind` 细一级。amane 桥把上游 `FailureReason`（如
        #: `cloudflare_blocked`、`rate_limited`）原样放在这里，`metadata_amane.cooldown_action`
        #: 据此决定冷却，不用再从 message 文本里猜。
        self.detail = detail


#: 站方在 HTTP 上直说「这份凭据不认」的状态码。401 的语义只有这一种。
CREDENTIAL_STATUS_CODES = frozenset({401})

#: 成因不止一种的状态码。403 在本项目的实测里多半不是凭据问题而是出口 IP 被封：
#: `docs/SOURCING.md` 记着 javbus 与 minnano-av 都发生过，javdb 那次封了 3～7 日，
#: 页面直接建议换节点。换 Cookie 对这一半没有用，只能等或换出口。响应本身分不开
#: 这两种成因，所以措辞不替用户下结论——「本批停止该来源」这个动作对两种都对，
#: 「换一份凭据」这句话只对其中一种。
AMBIGUOUS_AUTH_STATUS_CODES = frozenset({403})

#: 判据明确时给出的下一步。措辞只在 `labels.metadata.authWall.credentialAdvice` 一处，各句把它嵌进去。
CREDENTIAL_ADVICE_CODE = "labels.metadata.authWall.credentialAdvice"
#: 那一句按 zh-CN 渲染的原文：给还按文字判断的调用方（`reason_blames_credentials` 认旧理由）。
CREDENTIAL_ADVICE = interface_text.text(f"server:{CREDENTIAL_ADVICE_CODE}")
_ADVICE = {"code": CREDENTIAL_ADVICE_CODE}

#: 重定向终点落在这些路径上就是登录墙或年龄闸。站方不一定回 401：javdb 对未登录
#: 用户访问部分详情页直接 302 到 `/login`，DMM 把未过年龄闸的请求送去
#: `/age_check/`，跟完重定向拿到的都是一页 200。按状态码判会读成「取到了」，
#: 按正文判会读成「查无此片」，只有最终地址能把它认出来（NeoAVDC 的
#: `JavDbSource.ts` 用的也是这一条）。
LOGIN_LOCATIONS = re.compile(
    r"/(?:login|signin|sign_in|users/sign_in|account/login|auth/login|age_?check)(?:[/?.]|$)",
    re.IGNORECASE,
)

#: 站方自己给出的登录页标记。只认页面身份这种固定结构，不按「正文里出现登录二字」
#: 猜——搜索结果页和页脚都会出现那两个字。javdb 那条判据留在 `peach.javdb`，
#: 采集脚本按页判「这一页是不是登录墙」用的是同一份。
_AUTH_PAGE_MARKERS = ((JAVDB_LOGIN_PAGE, "labels.metadata.authWall.javdbLoginPage"),)


def auth_wall(*, status_code: int = 0, final_url: str = "", body: bytes | str = b"") -> dict | None:
    """这次响应是不是「要登录才给看」。是就返回写进错误消息的理由（`{"code", "params"}`，可以直接
    当另一句的参数），否则 `None`。

    四条判据各自对应真实存在的一种形态，缺一条就有来源漏判：明确的 401、跟完重定向
    后落在登录页或年龄闸、状态 200 但正文就是登录页，以及只剩状态码可看的 403。

    顺序不是随手排的：403 排在最后，因为同一次响应如果还带着登录页的地址或正文，
    那就不必按「成因不明」措辞了，直接说换凭据。
    """
    if status_code in CREDENTIAL_STATUS_CODES:
        return {"code": "labels.metadata.authWall.status", "params": {"status": status_code, "advice": _ADVICE}}
    path = urlsplit(str(final_url or "")).path
    if path and LOGIN_LOCATIONS.search(path):
        return {"code": "labels.metadata.authWall.redirect", "params": {"path": path, "advice": _ADVICE}}
    text = body_text(body) if isinstance(body, bytes) else str(body)
    for pattern, page in _AUTH_PAGE_MARKERS:
        if pattern.search(text):
            return {"code": "labels.metadata.authWall.loginPage", "params": {"page": {"code": page}, "advice": _ADVICE}}
    if status_code in AMBIGUOUS_AUTH_STATUS_CODES:
        return {"code": "labels.metadata.authWall.ambiguous", "params": {"status": status_code}}
    return None


def auth_wall_reason(*, status_code: int = 0, final_url: str = "",
                     body: bytes | str = b"") -> str:
    """`auth_wall` 那句按 zh-CN 渲染的原文；不是登录墙时是空串。"""
    reason = auth_wall(status_code=status_code, final_url=final_url, body=body)
    return interface_text.text(f"server:{reason['code']}", reason["params"]) if reason else ""


def reason_blames_credentials(reason: str | dict | None) -> bool:
    """这条理由有没有把成因锁死在凭据上。

    消费方要按这个分叉给出不同的下一步（去官网登录，还是先看站点要不要登录再决定
    换凭据还是等），判据就不能是各自到 `reason` 里找字眼——措辞改一次，找字眼的那
    几处会一起静默失准。
    """
    if isinstance(reason, dict):
        return reason.get("params", {}).get("advice") == _ADVICE
    return bool(reason) and CREDENTIAL_ADVICE in reason


def auth_error(source: str, reason: str | dict, *, status_code: int = 0,
               detail: str = "") -> MetadataProviderError:
    """把一次鉴权失败包成 `kind="auth"` 的错误。措辞只有这一处。`reason` 是 `auth_wall` 那样的一句
    （`{"code", "params"}`，按界面语言一起渲染），或上游给的原文。"""
    if isinstance(source, Said):
        source = source.phrase
    return MetadataProviderError(
        "errors.metadata.authRequired", {"source": source, "reason": reason}, kind="auth",
        status_code=status_code, retryable=False, temporary=True, detail=detail,
    )


def validate_provider_code(code: str) -> str:
    raw = str(code or "").strip()
    tokyo = tokyo_hot_code(raw)
    if tokyo:
        # Tokyo-Hot 的规范写法是小写（`catalog_rules._TOKYO_HOT_BODY`），
        # 跟着别的番号转大写就等于拿一个来源不认的写法去查。
        return tokyo
    value = raw.upper()
    if not _SAFE_CODE.fullmatch(value):
        raise ValueError("metadata provider only accepts normalized codes, not paths, URLs, or arbitrary text")
    return value


#: 番号在来源返回里的身份证据。`id`、`content_id` 和 `source_url` 至少有一处
#: 要认得出这个番号，否则拿到的是别的商品。
IDENTITY_FIELDS = ("id", "content_id", "source_url")


def _compact(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


#: URL 里可能承载番号的片段。路径段与查询值都可能是它，`combined=ene009` 这种
#: 还要按 `=` 再切一层才拿得到右边那一半。
_URL_TOKEN = re.compile(r"[A-Za-z0-9_]+(?:-[A-Za-z0-9]+)*")


def _release_writings(payload: dict) -> list[str]:
    """payload 里所有可能是番号写法的片段，逐个交给 `same_release_code` 比。"""
    values = [str(payload.get(field) or "") for field in ("id", "content_id")]
    url = urlsplit(str(payload.get("source_url") or ""))
    blob = f"{url.path.replace('/', ' ')} {url.query.replace('&', ' ')}"
    for chunk in blob.split():
        values.extend(_URL_TOKEN.findall(chunk))
        if "=" in chunk:
            values.append(chunk.split("=", 1)[-1])
    return [value for value in values if value]


def identifies_code(code: str, payload: dict) -> bool:
    """来源返回的是不是这个番号本身。

    2026-09-01 实测：dl.getchu 对 `ABW-220` 和 `259LUXU-1475` 都返回同一件同人
    商品 `item33938`（`Gカップ黒髪ぱっつん美少女レイヤー05華仙`）。适配器取的是
    站内搜索首条命中，站里没有这个番号时它不报「查无此片」，而是把不相干的商品
    当结果交出来。没有这道闸，那件商品的 genre 会变成三个番号的官方标签。

    真实来源的写法要容得下：DMM 的 `118abw220` 带厂牌数字前缀，r18dev 的
    `h_086iqqq00026` 对 `IQQQ-026` 多补了零，`259LUXU-1475` 只在 URL 里出现。
    实测 800 条成功快照里，除 dl.getchu 的 3 条错配外全部命中。

    先问 `same_release_code`，它认得 FC2 的裸数字写法和登记过的前缀别名；下面那套
    正则不认，于是把 `FC2-PPV-3701252` 和来源返回的 `3701252` 判成两部作品。2026-09-09
    实测候选池里 450 条 fc2 候选全部因此被误判为错配，占当时判否总数的一半以上。
    两条判据取并集：`same_release_code` 严格但不认厂牌数字前缀（`MAAN-545` 与
    `300MAAN-545`），正则宽松但认得，去掉任何一条都有 16 条合法候选被误拒。
    """
    return _identifies_code(str(code or ""), *(str(payload.get(field) or "") for field in IDENTITY_FIELDS))


#: 复核队列整页核对时，同一番号与同一组来源编号要比好几万次；判据只看这几样原文，按原文缓存。
@lru_cache(maxsize=65536)
def _identifies_code(code: str, provider_id: str, content_id: str, source_url: str) -> bool:
    payload = {"id": provider_id, "content_id": content_id, "source_url": source_url}
    if any(same_release_code(code, writing) for writing in _release_writings(payload)):
        return True
    if re.match(r"^\d{3}[A-Z]", str(code or "").upper()):
        url = urlsplit(str(payload.get("source_url") or ""))
        product = re.fullmatch(r"/product/product_detail/([^/]+)/?", url.path)
        returned = str(payload.get("id") or payload.get("content_id") or "")
        if url.hostname in {"mgstage.com", "www.mgstage.com"} and product:
            product_code = product.group(1)
            return same_release_code(code, product_code) and (
                not returned or same_release_code(product_code, returned)
                or normalise_code_key(returned) in code_query_variants(product_code))
        return any(same_release_code(code, payload.get(field)) for field in ("id", "content_id"))
    blob = "|".join(_compact(payload.get(field)) for field in IDENTITY_FIELDS)
    if not blob.strip("|"):
        return False
    value = str(code or "").upper()
    matched = re.fullmatch(rf"(?:\d{{3,6}})?([A-Z]{{2,8}}|{DIGIT_LABEL_PATTERN})-?(\d{{2,5}})([A-Z]{{0,2}})", value)
    if matched:
        letters, digits = matched.group(1).lower(), code_serial_pattern(matched.group(1), matched.group(2))
        suffix = matched.group(3).lower()
        return any(re.search(rf"(?<![a-z]){letters}[-_]?{digits}{suffix}(?![a-z0-9])",
                             str(payload.get(field) or "").lower()) is not None
                   for field in IDENTITY_FIELDS)
    return _compact(value) in blob





def collapse_repeated_phrase(value: str) -> tuple[str, bool]:
    """Compatibility wrapper around Peach's shared entity-name gate."""
    original = str(value or "").strip()
    cleaned = collapse_repeated_entity_name(original)
    return cleaned, cleaned != original


#: DMM 系来源把改过名的女优写成「现名（旧名）」：r18dev 给的是 `美谷朱音（美谷朱里）`。
#: 罗马字那一格同一个渲染格式由 `entities.split_composite_person_name` 拆。
_CURRENT_AND_FORMER = re.compile(r"(.+?)\s*[（(]([^（()）、，,/]+)[）)]")
_JAPANESE = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff\u3005]")


def split_former_name(name: str) -> tuple[str, str]:
    """(现名, 旧名)；不是这种写法时旧名为空串，现名就是原文。

    两边都得像日文艺名才拆：`Mana(23)` 括号里是年龄，`みく（素人）` 括号里是描述，
    整串照原样收。整串当名字收下，就对不上账本里早已登记的那一位，另建出一条重复实体。
    """
    matched = _CURRENT_AND_FORMER.fullmatch(str(name or "").strip())
    if matched is None:
        return name, ""
    current, former = matched.group(1).strip(), FORMER_PREFIX.sub("", matched.group(2)).strip()
    for part in (current, former):
        if (len(part) < 2 or not _JAPANESE.search(part) or re.search(r"\d", part)
                or is_descriptive(part) or is_planning_alias(part)):
            return name, ""
    return current, former


def normalized_performers(raw: object) -> tuple[list[dict], list[str]]:
    performers: list[dict] = []
    warnings: list[str] = []
    seen: set[str] = set()
    for item in raw if isinstance(raw, list) else []:
        # 只有一个名字的来源交的是一串字符串（fc2cmadb 2026-09-22 存下的快照就是 `["梨奈"]`），
        # 和只带 `japanese_name` 的那一格是同一件事。
        if isinstance(item, str):
            item = {"japanese_name": item}
        if not isinstance(item, dict):
            continue
        preferred = item.get("japanese_name") or " ".join(
            part for part in (item.get("last_name"), item.get("first_name")) if part
        )
        original = str(preferred or "").strip()
        current, former = split_former_name(original)
        name = canonicalize_entity_name("performer", current)
        repeated = bool(name and name != current)
        if repeated:
            warnings.append(Said("labels.metadata.warning.performerRepeated", original=preferred, name=name))
        key = normalize_entity_name(name)
        if not name or key in seen:
            continue
        seen.add(key)
        aliases: list[str] = []
        for alias in (
            former,
            *(item.get("aliases") if isinstance(item.get("aliases"), list) else []),
            item.get("name_kana"), item.get("name_romaji"),
        ):
            cleaned = canonicalize_entity_name("performer", alias)
            if (cleaned and normalize_entity_name(cleaned) != key
                    and normalize_entity_name(cleaned) not in {
                        normalize_entity_name(value) for value in aliases}):
                aliases.append(cleaned)
        performer = {
            "name": name,
            # `dmm_id` 是 r18/DMM 那一路的写法；别的来源给的是同一件东西的通用写法，
            # 两个键在这里合成一个字段，落库时跟着 `profile_source` 走。
            "external_id": str(item.get("dmm_id") or item.get("external_id") or ""),
            "thumb_url": str(item.get("thumb_url") or ""),
        }
        if aliases:
            performer["aliases"] = aliases
        if former:
            # 现名在账本里还没登记、旧名已经登记过时，落库挂到旧名那一位身上。
            performer["former_names"] = [canonicalize_entity_name("performer", former)]
        if item.get("profile_source"):
            performer["profile_source"] = str(item["profile_source"])
        performers.append(performer)
    return performers, warnings


def normalized_release_date(raw: object) -> tuple[str, list[str]]:
    value = str(raw or "").strip()
    if not value:
        return "", []
    candidate = value[:10]
    try:
        normalized = date.fromisoformat(candidate).isoformat()
    except ValueError:
        return "", [Said("labels.metadata.warning.releaseDateInvalid", value=value)]
    warnings = [] if value == normalized else [
        Said("labels.metadata.warning.releaseDateNormalized", value=value, normalized=normalized)]
    return normalized, warnings


def japanese_view(payload: dict) -> dict:
    """Return the Japanese translation bundled in an r18dev payload."""
    for translation in payload.get("translations") or []:
        if not isinstance(translation, dict):
            continue
        if str(translation.get("language") or "").lower().startswith("ja"):
            return translation
    return {}


def r18_english_page(payload: dict) -> bool:
    """这份快照是不是 r18.dev 英文那一页的形态：地址在 r18.dev，却没有日文视图。

    日文那一页没取到时 `sources.r18dev` 交出的就是这种，磁盘缓存里也还留着这种形态的旧快照；
    顶层的标题、系列是 r18 的英文译文，演员是罗马字。
    """
    return "r18.dev" in str(payload.get("source_url") or "") and not japanese_view(payload)


def _in_japanese_script(text: str) -> bool:
    return bool(KANA.search(text) or KANJI.search(text))


def original_cast(payload: dict) -> object:
    """交给 `normalized_performers` 的演员行。r18.dev 英文页那份只留名字带假名或汉字的人，
    罗马字的进了候选就成了罗马字的女优实体。"""
    actresses = payload.get("actresses")
    if not r18_english_page(payload) or not isinstance(actresses, list):
        return actresses
    return [row for row in actresses
            if _in_japanese_script(str((row.get("japanese_name") if isinstance(row, dict) else row) or ""))]


def original_wording(payload: dict, key: str) -> str:
    """标题、系列这类会被来源自己译一层的字段，取原文那一侧。

    r18.dev 的快照（以及 Javinizer-Go 的 r18dev 快照）顶层是 r18 自己译的英文，标题与系列多是
    机翻；系列一旦取了它，就成了系列实体的规范名（ABW-358 的 `HOW TO SEX! The Infirmary
    Teacher…`）。所以日文视图给了就用它；日文视图空着或整份没有，顶层值只有本身带假名或汉字
    才用，纯拉丁字母的那份就是译文，宁可空着让来源链去问下一家。别的来源（javbus、DMM）
    没有日文视图，顶层本来就是原文，照旧取顶层。
    """
    japanese = japanese_view(payload)
    written = _normalized_text(japanese.get(key))
    top = _normalized_text(payload.get(key))
    if written or not (japanese or r18_english_page(payload)):
        return written or top
    return top if _in_japanese_script(top) else ""


def _normalized_text(raw: object) -> str:
    return " ".join(str(raw or "").split())


def _text_evidence(raw: object) -> dict | None:
    value = _normalized_text(raw)
    if not value:
        return None
    return {"value": value, "display_value": value, "warnings": []}


def _runtime_evidence(raw: object) -> dict | None:
    if isinstance(raw, bool) or raw is None:
        return None
    try:
        minutes = float(raw)
    except (TypeError, ValueError):
        return None
    if not 0 < minutes <= 24 * 60:
        return None
    value: int | float = int(minutes) if minutes.is_integer() else round(minutes, 2)
    return {"value": value, "display_value": Said("labels.metadata.evidence.runtime", minutes=f"{value:g}"),
            "warnings": []}


def _safe_evidence_url(raw: object) -> str:
    value = str(raw or "").strip()
    try:
        parsed = urlsplit(value)
    except ValueError:
        return ""
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username is not None or parsed.password is not None):
        return ""
    return value


def _url_evidence(raw: object, code: str) -> dict | None:
    """一个链接的证据：`code` 是「海报（主机）」那样的一句。"""
    value = _safe_evidence_url(raw)
    if not value:
        return None
    host = urlsplit(value).hostname or Said("labels.metadata.evidence.externalSource")
    return {"value": value, "display_value": Said(code, host=host), "warnings": []}


def _url_list_evidence(raw: object) -> dict | None:
    """截图那一列链接的证据。"""
    if not isinstance(raw, list):
        return None
    values = list(dict.fromkeys(
        value for value in (_safe_evidence_url(item) for item in raw) if value
    ))
    if not values:
        return None
    warnings = []
    if len(values) > MAX_EVIDENCE_URLS:
        warnings.append(Said("labels.metadata.warning.tooManyLinks", count=len(values), limit=MAX_EVIDENCE_URLS))
        values = values[:MAX_EVIDENCE_URLS]
    hosts = list(dict.fromkeys(urlsplit(value).hostname or Said("labels.metadata.evidence.externalSource")
                               for value in values))
    code = "labels.metadata.evidence.screenshotsMore" if len(hosts) > 2 else "labels.metadata.evidence.screenshots"
    return {
        "value": values,
        "display_value": Said(code, count=len(values), hosts=hosts[:2]),
        "warnings": warnings,
    }


def with_codes(evidence: dict) -> dict:
    """候选里给人看的两样带上 code：`display_value` 配 `display_value_code`／`_params`，`warnings` 配并行的
    `warning_codes`／`warning_params`。原句照旧，界面按 code 取当前语言。"""
    out = dict(evidence)
    if "display_value" in evidence:
        out.update(coded("display_value", evidence["display_value"]))
    out.update(parallel("warning", evidence.get("warnings") or ()))
    return out


def contains_replacement_character(value: object) -> bool:
    """来源解码已丢失的字符不能作为文字证据，保留原始快照供重新取证。"""
    if isinstance(value, str):
        return '\ufffd' in value
    if isinstance(value, dict):
        return any(contains_replacement_character(item) for item in value.values())
    if isinstance(value, (list, tuple)):
        return any(contains_replacement_character(item) for item in value)
    return False


def candidate_text_is_valid(candidate: dict) -> bool:
    """候选正文与未映射标签均须可解码；来源路径和诊断文字不参与判定。"""
    return not any(contains_replacement_character(candidate.get(key))
                   for key in ('value', 'display_value', 'unmapped_genres'))


def source_text_is_valid(payload: dict) -> bool:
    """来源文字必须完整；原始旁证、路径和诊断文字不决定缓存有效性。"""
    return not any(contains_replacement_character(payload.get(key)) for key in (
        'title', 'original_title', 'actresses', 'actors', 'performers', 'maker', 'studio',
        'label', 'series', 'genres', 'tags', 'director'))


def extract_catalog_evidence(payload: dict) -> dict[str, dict]:
    """Preserve source-only catalog fields without mapping them to ledger truth.

    MetaTube's richer movie DTO is used as a fixed-revision checklist. These
    values stay attached to the source candidate: ``label`` is not silently
    folded into Peach ``studio``; catalog runtime never overrides probed media
    duration; remote media URLs are evidence only and are not downloaded here.
    """
    japanese = japanese_view(payload)
    out: dict[str, dict] = {}
    text_fields = {
        "title": original_wording(payload, "title"),
        "original_title": original_wording(payload, "original_title"),
        "director": japanese.get("director") or payload.get("director"),
        "label": japanese.get("label") or payload.get("label"),
    }
    for field, raw in text_fields.items():
        evidence = _text_evidence(raw)
        if evidence is not None:
            out[field] = evidence
    if (out.get("original_title", {}).get("value")
            == out.get("title", {}).get("value")):
        out.pop("original_title", None)
    runtime = _runtime_evidence(payload.get("runtime"))
    if runtime is not None:
        out["runtime"] = runtime
    for field, code in {
        "poster_url": "labels.metadata.evidence.poster", "cover_url": "labels.metadata.evidence.cover",
        "trailer_url": "labels.metadata.evidence.trailer",
    }.items():
        evidence = _url_evidence(payload.get(field), code)
        if evidence is not None:
            out[field] = evidence
    screenshots = _url_list_evidence(payload.get("screenshot_urls"))
    if screenshots is not None:
        out["screenshot_urls"] = screenshots
    return {field: with_codes(value) for field, value in out.items() if candidate_text_is_valid(value)}


def extract_peach_fields(payload: dict, genre_decisions=None) -> dict[str, dict]:
    """Map raw provider data to reviewable Peach truth-field candidates.

    `genre_decisions` 是用户在复核页收录过的来源 genre（见 `genre_taxonomy.map_genres`）。
    """
    out: dict[str, dict] = {}
    catalog = extract_catalog_evidence(payload)
    for field in ("title", "original_title"):
        if field in catalog:
            out[field] = dict(catalog[field])
    performers, warnings = normalized_performers(original_cast(payload))
    if performers:
        out["performers"] = {
            "value": performers,
            "display_value": "、".join(item["name"] for item in performers),
            "warnings": warnings,
        }
    japanese = japanese_view(payload)
    for field in ("studio", "series"):
        key = "maker" if field == "studio" else field
        # 厂牌不走 `original_wording`：账本的厂牌实体用品牌名（`Prestige`），见 `sources.r18dev`。
        raw_name = (original_wording(payload, key) if field == "series"
                    else str(japanese.get(key) or "").strip() or payload.get(key))
        name, repeated = collapse_repeated_phrase(str(raw_name or ""))
        if name:
            out[field] = {
                "value": name,
                "display_value": name,
                "warnings": ([Said("labels.metadata.warning.valueRepeated", original=raw_name, name=name)]
                             if repeated else []),
            }
    release_date, date_warnings = normalized_release_date(payload.get("release_date"))
    if release_date:
        out["release_date"] = {
            "value": release_date,
            "display_value": release_date,
            "warnings": date_warnings,
        }
    # 未收录的 genre 跟着候选一起进复核队列。丢掉它们等于把「这个来源给了值但
    # Peach 还没决定怎么归类」伪装成「来源没给标签」，正是官方 tag 长期缺口的成因。
    # 原文另存一份结构化的：复核页要拿它做「收录成哪个中文标签」的按钮，从那句中文
    # 提示里再拆回词来是把显示当接口用。
    mapped, unmapped = map_genres(payload.get("genres") or [], genre_decisions)
    if mapped or unmapped:
        out["tags"] = {
            "value": mapped,
            "display_value": "、".join(mapped),
            "unmapped_genres": unmapped,
            "warnings": [unmapped_genre_warning(unmapped)] if unmapped else [],
        }
    return {field: with_codes(value) for field, value in out.items() if candidate_text_is_valid(value)}
