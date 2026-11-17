"""物理媒体垃圾证据与复核评分；扫描、后处理和页面共用同一套规则。"""
from __future__ import annotations

import json
import re
import time
from functools import cache, lru_cache
from pathlib import PureWindowsPath

from . import interface_text
from .catalog_rules import (
    FC2_BONUS_PREFIX, _jav_code_pattern, fc2_collection_label, is_jav_code, promo_free_key,
    release_code_from_filename, without_store_prefix,
)
from .junk_words import (AD_BRAND, AD_BRAND_FORM, AD_DIR_BRAND_MEDIA, AD_DIR_FORM, PAGE_PROMO_CLAIM, PART_MARK,
                         PROMO_FILLER, PROMO_PHRASE)
from .media_sources import SCANNABLE_LOCATIONS
from .settings_file import PROJECT_ROOT
from .personal_records import record_holders
from .repository import LedgerDatabase

# 结尾不能用 \b：`uuc82.com_2` 里 `m` 和 `_` 都是词字符，构不成边界，域名会漏掉。
#: `manko.fun`、`58m.co` 是云下载包里的推广附件（2026-11-03 只读盘点）。
PROMO_DOMAIN = re.compile(
    r"(?:https?://)?(?:www\.)?[\w-]{2,}\.(?:com|net|me|la|xyz|cc|tv|top|vip|club|"
    r"info|org|pw|cn|app|site|online|shop|fun|live|co)(?![a-z0-9])", re.I)
# 真番号带厂牌前缀和连字号（ABW-153、259LUXU-1141）。RAIKUN325 这类没有连字号的
# 是被误填进 code 的创作者账号名，不能拿来做「同番号有完整版」的比较，
# 判据与 `is_jav_code` 同源：分隔符正是番号与账号名的唯一线索。
REAL_CODE = re.compile(r"^(?:\d{2,3})?[A-Za-z]{2,8}-\d{2,5}$|^FC2", re.I)
# 推广站目录的两种形态，与 `scripts/find_ads.py` 的判据 D/E 同源：
# 创作者位是旧导入器的目录名投影，`bbsxv.xyz-DOCP-324` 这类广告包会直接落在那里；
# 裸域名目录（98T.la@账号、huachishe.com@系列）是转载水印，不是广告，不能进判据。
AD_DOMAIN = re.compile(
    r"\b[0-9a-z][-0-9a-z]{1,20}\.(?:cc|xyz|xxx|com|net|la|me|top|vip|club|app|cn|pw|tv|gg|fun|live)\b", re.I)
AD_DIRPACK = re.compile(
    r"[0-9a-z][-0-9a-z]{1,20}\.[a-z]{2,10}[ \-_]+\[?[A-Za-z]{2,6}-?\d{2,5}", re.I)
#: 同一目录里有这么多资产，它就是成套下载的资源包，不是塞进别人目录的插页。
#:
#: `jitumi.pw(77).gif` 与 `【91狼友之家91home.cc】19.jpg` 剥完只剩域名，是最硬的
#: 「整名推广语」信号，可它们分别躺在 `森萝财团 X-019 肉丝换白丝 [103P1V-1.39GB]`
#: （同目录 107 项）和 `赠送-稀缺整合【91home.cc】\海角\新建文件夹`（同目录 24 项）里：
#: 域名在这里是打包渠道给整包起的名，几十上百张成套的图本身就是要留的资源。
#: 广告插页反过来，是一两张挤在别人的番号目录里——WAAA-415 那个目录只有 13 项。
BUNDLE_DIR_ASSETS = 20
#: 同一目录里有这么多同类推广名，它们就是成群塞进来的插页。
#:
#: 与 `BUNDLE_DIR_ASSETS` 正好对称：资源是成套的正片与图集，插页是成群的同一段套话。
#: `三国志侵略版-免费18禁手游-扫码安装.png` 剥完仍剩 6 个字的游戏名，单看名字只够
#: 中间档；但同目录另外 10 个文件挂着一模一样的推广尾巴，谁都不是正片的一部分。
PROMO_CLUSTER_FILES = 3
#: 缩略图与封面相对正片的固定尾巴（`MIAD573_02.wmv` ↔ `MIAD573_02_s.jpg`，
#: `LXVS006-BD.iso` ↔ `lxvs006pl.jpg`）。`pl`／`ps` 是 JAV 大小海报的通用写法。
#: 不剥数字：剥了 `MIAD573_02_s` 会退到 `MIAD573`，那已经不是同一条正片。
SHOT_TAIL = re.compile(r"[-_. ]?(?:s|t|pl|ps|thumb|poster|cover|fanart|big|small)$", re.I)
#: 正片自己带的画质与载体尾巴，只在配对时剥，用来让海报对上原盘。
DISC_TAIL = re.compile(r"[-_. ]?(?:bd|bdmv|bdiso|bdrip|dvd|dvdiso|iso|uhd|fhd|hd)$", re.I)
#: 超过这个体积的文件自己就是内容，不必再看目录名。
#:
#: `javme.me_LXVS-006-BD\LXVS006-BD.iso` 是 19.8 GB 的蓝光原盘，却因为住在
#: 「域名+番号」的目录里被判 45 分。广告不会有大文件：整包插页加起来都不到 10 MB，
#: 一个上 GB 的文件是资源站给自己的资源改了目录名，不是资源站塞进来的推广。
CONTENT_BYTES = 1024 ** 3
INTERNET_SHORTCUT_SUFFIXES = frozenset({".url"})
#: 保存下来的网页。`.mhtml` 是 Edge 的整页存档，媒体目录里的这份没有内容价值；
#: 它和 `.url` 一样是「导航页」而不是媒体，不给体积兜底留机会。
PAGE_ARCHIVE_SUFFIXES = frozenset({".mhtml", ".mht", ".htm", ".html"})
#: 品牌推广图的体积上限。`蜜桃影像传媒.png` 18 KB、`東方秋白…169BBS…` 75 KB，
#: 而任何一张内容图都在 MB 量级；品牌名 + 这种体积才是广告卡，不是作品套图。
BRAND_TINY_BYTES = 300 * 1024
#: 装饰符名（`❤91短视频❤.jpg`）：两侧都挂或挂多个爱心的小图，名字里没有实质描述。
DECOR_MARKS = "❤♥❥♡💕💗💖💘💝"
#: 装饰图体积上限。`❤草榴视频❤.jpg` 705 KB 是广告卡；同名配套封面（2 MB 级）不算，
#: 它走 `has_sibling_original` 的正片配对豁免。
DECORATED_MAX_BYTES = 1536 * 1024
#: `APP` 按词匹配：`Happy` 里也藏着 `app`，裸子串会把正常目录卷进来；
#: `.app` 是域名后缀，`bkm9.app` 那类推广目录靠目录里其他证据，不靠这一条。
AD_DIR_APP = re.compile(r"(?:^|[^A-Za-z.])APP(?:[^A-Za-z.]|$)", re.I)
JUNK_KINDS = frozenset({"video", "image", "audio", "archive", "url", "other"})
#: 达到这个体积的视频不再当广告残留。这个值与原有「小于 120 MB」证据同源；
#: 较大的同番号短版本属于重复清理问题，由 ``q_duplicates`` 承接。
JUNK_VIDEO_MAX_BYTES = 120 * 1024**2
MEDIA_SIDECAR_SUFFIXES = frozenset({".nfo", ".srt", ".ass", ".ssa", ".vtt", ".sub", ".idx"})
INSTALLER_SUFFIXES = frozenset({".apk", ".exe", ".msi"})
#: 按固定命名识别的推广附件。名字和体积只能说明「像」，内容要人看过才算数。
PROMO_NAMES_FILE = PROJECT_ROOT / "resources" / "junk" / "promo_attachment_names.json"
#: 进入垃圾复核队列的分数线。
JUNK_REVIEW_SCORE = 40
#: `scripts/trash_junk.py --apply` 默认的自动移入回收站分数线。只能复核的证据
#: （固定命名、未探测时长视频的目录与体积证据）单独凑不到这一档。
AUTO_TRASH_SCORE = 60
#: 极短附件的结构证据只进入复核：目录中须有同名长正片，且附件相对它足够短、小。
SHORT_ATTACHMENT_SECONDS = 30
SHORT_ATTACHMENT_BYTES = 32 * 1024**2
SHORT_ATTACHMENT_CLUSTER = 3
#: 「来源站名 + 序号」也用于正常短片；站点水印不能成为自动隔离依据。
NUMBERED_SOURCE_VIDEO = re.compile(r"^(?:\[[^\]]+\]|【[^】]+】)[\s._-]*\d+(?:[\s._-]*\(\d+\))?$")
PAGE_COMPONENT_SUFFIXES = frozenset({".js", ".css", ".aspx"})
PAGE_CHROME_IMAGE = re.compile(r"^(?:banner(?:_[bs])?|1000x90(?:yunding)?|count\d*|logo|lan\d*|you|zuo|zuoxia)$", re.I)
#: 云下载包里的附带视频按这个时长以内、且正片至少长这么多倍认定。
#:
#: 2026-11-03 只读盘点：364 个已入库下载任务留下 142 个附属文件，推广视频全在 27~157 秒
#: （`人间尤物.mp4` 61 秒、`manko.fun.mp4` 157 秒），正片都是一两个小时。
DOWNLOAD_ATTACHMENT_SECONDS = 240
DOWNLOAD_MAIN_RATIO = 20
#: 媒体中心约定的作品图名，下载包自带时属于本片资料，不当附件。
ARTWORK_NAME = re.compile(
    r"^(?:poster|fanart|thumb|cover|folder|landscape|backdrop|clearlogo|clearart)(?:[-_ ]?\d+)?$", re.I)
#: 同名同体积的文件散布在这么多个目录，就是被成批塞进不同发行包的同一份附件。
REPEATED_COPY_FOLDERS = 3
REPEATED_COPY_MAX_BYTES = 16 * 1024**2


@lru_cache(maxsize=1 << 18)
def _windows_path(text: str) -> PureWindowsPath:
    """账本路径的解析结果。一次评分要过十万行，每行在多处判据里各解析同一条路径好几次。

    `PureWindowsPath` 不可变，按字符串缓存与当场构造等价。
    """
    return PureWindowsPath(text)


@lru_cache(maxsize=1 << 18)
def _windows_parent(text: str) -> PureWindowsPath:
    """`_windows_path(text).parent`；`parent` 每次访问都新造一个路径对象。"""
    return _windows_path(text).parent


@lru_cache(maxsize=1 << 16)
def _promo_directory_parts(parts: tuple[str, ...]) -> bool:
    """`_promo_directory` 按目录分量缓存：同一目录下的几百个文件判的是同一组分量。"""
    for text in parts:
        if AD_DIR_FORM.search(text) or (AD_DIR_APP.search(text) and AD_BRAND.search(text)):
            return True
        if AD_BRAND.search(text) and AD_DIR_BRAND_MEDIA.search(text):
            return True
    return False


def despaced(name: str) -> str:
    """把逐字加空格的推广名（`x u u 6 2 . c o m`、`最 新 位 址 獲 取`）合回去。

    这种写法专门用来躲关键词与域名匹配。七成以上的分段只有一两个字符才合并，
    正常标题里的空格分隔的是词，不会这样碎。
    """
    tokens = str(name or "").split()
    if len(tokens) >= 5 and sum(len(token) <= 2 for token in tokens) >= len(tokens) * 0.7:
        return "".join(tokens)
    return str(name or "")


def promo_residue(name: str) -> int:
    """剥掉域名和推广套话后，还剩多少实质描述字符。

    这是区分「广告」与「正片被打了站点水印」的关键：
    `点击观看 房间火爆` 剥完什么都不剩；
    `236953.xyz 推特新晋4年绿帽美腿淫妻网黄「一个ren」…` 剥完仍有大段内容描述。

    剥掉的词替换成空串而不是空格：空格自己也在计数字符集里，换成空格等于每剥一个
    词就补回一个残留。`爱姬远征-免费18禁手游-扫码安装` 剥掉四段套话后只剩四个字，
    却因为补进来的四个空格数成 8，正好卡在门槛外——剥得越干净残留越高。
    """
    text = PROMO_DOMAIN.sub("", name or "")
    text = PROMO_PHRASE.sub("", text)
    text = PROMO_FILLER.sub("", text)
    # 只数中日韩文字与字母，忽略编号、扩展名和标点。
    return len(re.findall(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af A-Za-z]", text))


def _folder_index(connection, *, roots=None) -> tuple[dict[str, int], dict[str, set[str]]]:
    """每个目录里有多少资产，以及其中正片的文件名主体。

    两条判据都要看候选的邻居而不只是它自己：成套资源看目录规模，封面与截图看
    同目录有没有同名正片。`rsplit` 而不是 `PureWindowsPath`：ledger 路径统统是
    Windows 形态，这里要跑全表七万多行，只取目录名不值得为每行造一个路径对象。

    正片不限于 `medium='video'`：蓝光原盘在账本里是 `other`，它同样是海报要配的那份
    内容。用体积兜住这一类，不去猜扩展名——`.iso`、`.mds`、`BDMV` 之外还有什么，
    库里下一份原盘才知道。
    """
    counts: dict[str, int] = {}
    videos: dict[str, set[str]] = {}
    scope, parameters = _scope_clause(roots=roots)
    for path, medium, size in connection.execute(
            "SELECT path,medium,size FROM asset WHERE path IS NOT NULL AND path<>''" + scope, parameters):
        folder, _, filename = str(path).rpartition("\\")
        counts[folder] = counts.get(folder, 0) + 1
        if medium == "video" or (size or 0) >= CONTENT_BYTES:
            stem = filename.rsplit(".", 1)[0] if "." in filename else filename
            key = stem.casefold()
            videos.setdefault(folder, set()).add(key)
            trimmed = DISC_TAIL.sub("", key)
            if trimmed:
                videos[folder].add(trimmed)
    return counts, videos


def has_sibling_original(stem: str, sibling_videos: set[str]) -> bool:
    """True 表示同目录里有一条与它同名的正片，它是那条正片的封面或截图。"""
    key = str(stem or "").casefold()
    if not key:
        return False
    return key in sibling_videos or SHOT_TAIL.sub("", key) in sibling_videos


def is_decorated_name(stem: str) -> bool:
    """名字挂着两个以上装饰符，没有任何实质描述。

    样本是 `B:\\xxr\\0208 (23)` 里那批 7~20 KB 的 `❤91短视频❤.png`。
    只挂一个爱心不算：Telegram 导出与正常标题里单个爱心常见，两个以上才是装饰性命名。
    """
    return sum(str(stem or "").count(mark) for mark in DECOR_MARKS) >= 2


def _promo_directory(parts) -> bool:
    """路径里有任意一层目录自曝是推广包。

    三种形态：`APP` 词形（`_含羞草APP`）、促销目录名（`一键约炮`、`論壇文宣`）、
    品牌名叠加媒体词（`_草榴视频`）。只看目录分量，文件名自己是不是推广由调用方判。
    """
    return _promo_directory_parts(tuple(str(part) for part in parts))


def _scope_clause(*, asset_ids=None, roots=None):
    """显式空范围只匹配空集，目录比较包含来源及分隔符边界。"""
    if asset_ids is not None:
        ids = tuple(dict.fromkeys(int(value) for value in asset_ids))
        return " AND id IN (SELECT value FROM json_each(?))", (json.dumps(ids),)
    if roots is None:
        return "", ()
    clauses, values = [], []
    for location, root in roots:
        root = str(PureWindowsPath(root)).rstrip("\\")
        prefix = root + "\\"
        clauses.append("(location=? AND (path=? COLLATE NOCASE OR substr(path,1,?)=? COLLATE NOCASE))")
        values.extend((location, root, len(prefix), prefix))
    return (" AND (" + " OR ".join(clauses) + ")", tuple(values)) if clauses else (" AND 0", ())


def _junk_rows(connection, *, asset_ids=None, roots=None, visual_ids=()):
    """读取物理候选及有视觉证据的视频；字幕与 NFO 在外层排除。"""
    marks = ",".join("?" for _ in SCANNABLE_LOCATIONS)
    scope, parameters = _scope_clause(asset_ids=asset_ids, roots=roots)
    rows = connection.execute(
        "SELECT id,location,name,medium,creator,code,size,duration,width,height,snapshot_path,"
        "feedback,disposal,play_count,leave_ratio,o_count,studio,ctx_orient,path "
        f"FROM asset WHERE location IN ({marks}) AND disposal IS NULL "
        "AND (COALESCE(medium,'other')<>'video' OR (size < ? "
        "AND (duration IS NULL OR duration <= 1200)) OR id IN (SELECT value FROM json_each(?)))" + scope,
        (*SCANNABLE_LOCATIONS, JUNK_VIDEO_MAX_BYTES, json.dumps(tuple(visual_ids)), *parameters)).fetchall()
    # NFO 是媒体资料边车，不是等待清理的物理内容；即使名字或所在目录带推广词，
    # 也应由资料读取报告解析问题，不能进入会把文件移入回收站的垃圾队列。
    return [row for row in rows if _junk_file_eligible(row)]


def _junk_file_eligible(row) -> bool:
    """保护资料边车、STRM 指针、带番号的作品图片和视频分卷。"""
    item = _windows_path(row["name"] or row["path"] or "")
    # STRM 的大小与名字描述的是链接文件，不能作为远端影片的垃圾证据。
    if item.suffix.casefold() in MEDIA_SIDECAR_SUFFIXES or item.suffix.casefold() == '.strm':
        return False
    if (row['medium'] == 'image' and release_code_from_filename(item.stem)
            and not PROMO_PHRASE.search(PROMO_DOMAIN.sub('', item.stem))):
        return False
    if not (row["medium"] == "video" and PART_MARK.search(item.stem)):
        return True
    identity = PART_MARK.sub("", PROMO_DOMAIN.sub("", item.stem)).strip("@._- ")
    return not release_code_from_filename(identity)


def _promo_neighbour_counts(rows) -> dict[str, int]:
    """统计同目录中缺少内容描述的推广名。"""
    counts: dict[str, int] = {}
    for row in rows:
        name = row["name"] or _windows_path(row["path"] or "").name
        stem = _windows_path(name).stem
        if not (PROMO_PHRASE.search(stem) or PROMO_DOMAIN.search(stem)):
            continue
        if promo_residue(stem) >= 14:
            continue
        folder = str(row["path"] or name).rpartition("\\")[0]
        counts[folder] = counts.get(folder, 0) + 1
    return counts


@cache
def promo_name_rules() -> tuple[dict, ...]:
    """读取 `PROMO_NAMES_FILE` 的推广附件命名规则；文件缺失或格式不对直接报错。"""
    data = json.loads(PROMO_NAMES_FILE.read_text(encoding="utf-8"))
    rules = []
    for entry in data["rules"]:
        names = frozenset(re.sub(r"\s", "", name).casefold() for name in entry.get("names", ()))
        patterns = tuple(re.compile(pattern, re.I) for pattern in entry.get("patterns", ()))
        if not entry["reason"] or not (names or patterns) or int(entry["max_bytes"]) <= 0:
            raise ValueError(f"incomplete promotional attachment rule: {entry}")
        rules.append({
            "reason": str(entry["reason"]),
            "suffixes": frozenset(str(suffix).casefold() for suffix in entry["suffixes"]),
            "max_bytes": int(entry["max_bytes"]),
            "parent_is_name": bool(entry.get("parent_is_name")),
            "names": names,
            "patterns": patterns,
        })
    return tuple(rules)


def _promo_name_reason(suffix: str, path: str, size: int) -> str:
    """命中词库里推广附件固定命名的理由；只够进复核队列，见 `AUTO_TRASH_SCORE`。"""
    item = _windows_path(path)
    stem = item.stem
    compact = None
    for rule in promo_name_rules():
        if suffix not in rule["suffixes"] or not 0 < size <= rule["max_bytes"]:
            continue
        if rule["parent_is_name"] and _windows_parent(path).name != stem:
            continue
        if compact is None:
            compact = re.sub(r"\s", "", stem).casefold()
        if compact in rule["names"] or any(pattern.fullmatch(stem) for pattern in rule["patterns"]):
            return rule["reason"]
    return ""


class _Reason(str):
    """一条判为垃圾的理由。字符串本身是 zh-CN 原文（`why` 照旧用它拼），另带 code 与参数给 `why_parts`；
    文字在 `server:labels.junk.<名字>`（ADR-0159）。"""

    def __new__(cls, name: str, **params):
        code = f"labels.junk.{name}"
        value = super().__new__(cls, interface_text.text(f"server:{code}", params))
        value.code, value.params = code, params
        return value


def why_parts(why) -> list[dict]:
    """`why` 按段写给前端：带 code 的理由给 code 与参数，词库里的固定说法（内容数据）原样给 `text`。"""
    parts: list[dict] = []
    for index, reason in enumerate(why):
        if index:
            parts.append({"text": " · "})
        parts.append({"code": reason.code, "params": reason.params} if isinstance(reason, _Reason)
                     else {"text": str(reason)})
    return parts


def _attachment_junk_reason(suffix: str, path: str, size: int) -> str:
    """区分安装附件与网页存档组件。"""
    if suffix in INSTALLER_SUFFIXES and size < 64 * 1024**2:
        return _Reason("installerAttachment")
    item = _windows_path(path)
    folder = _windows_parent(path)
    if suffix in PAGE_COMPONENT_SUFFIXES and any(
            part.casefold().endswith("_files") for part in folder.parts):
        return _Reason("pageArchiveAsset")
    parent = folder.name
    if (parent.casefold().endswith('_files') and PAGE_PROMO_CLAIM.search(parent)
            and AD_DOMAIN.search(parent[:-len('_files')]) and suffix in {'.gif', '.jpg', '.png'}
            and size < 2 * 1024**2
            and (PAGE_CHROME_IMAGE.fullmatch(item.stem)
                 or (item.name.casefold() == '1.gif' and size <= 4096))):
        return _Reason("promoPageImage")
    return ""


def _short_attachment(row) -> bool:
    """有测量值、没有自身作品身份或分卷标记的极短视频。"""
    stem = _windows_path(row["name"] or row["path"] or "").stem
    owner = row["creator"] or ""
    return (row["medium"] == "video"
            and 0 < (row["duration"] or 0) <= SHORT_ATTACHMENT_SECONDS
            and 0 < (row["size"] or 0) <= SHORT_ATTACHMENT_BYTES
            and not (owner and not AD_DOMAIN.search(owner))
            and not PART_MARK.search(stem)
            and not release_code_from_filename(stem))


def _release_main_videos(connection, *, roots=None) -> dict[str, list[tuple[float, int]]]:
    """按活动物理文件建立发行目录的长正片索引；普通混合目录不算发行目录。"""
    mains: dict[str, list[tuple[float, int]]] = {}
    marks = ",".join("?" for _ in SCANNABLE_LOCATIONS)
    scope, parameters = _scope_clause(roots=roots)
    for path, duration, size in connection.execute(
            "SELECT path,duration,size FROM asset WHERE disposal IS NULL AND medium='video' "
            f"AND location IN ({marks}) AND duration>=1200 AND size>=? AND path IS NOT NULL" + scope,
            (*SCANNABLE_LOCATIONS, JUNK_VIDEO_MAX_BYTES, *parameters)):
        item = PureWindowsPath(path)
        key = promo_free_key(item.stem)
        if key and key == promo_free_key(item.parent.name):
            mains.setdefault(str(item.parent).casefold(), []).append((duration, size))
    return mains


def _short_attachment_reasons(connection, rows, *, roots=None) -> dict[int, str]:
    """从正片与附件的量级关系、同目录成群和跨发行目录扩散生成复核证据。

    不读媒体，也不按题材、游戏名或推广词命中。相同测量值只是扩散线索，不能证明内容相同。
    """
    mains = _release_main_videos(connection, roots=roots)
    folders: dict[str, set[str]] = {}
    signatures: dict[tuple, set[str]] = {}
    candidates = []
    for row in rows:
        if not _short_attachment(row):
            continue
        path = PureWindowsPath(row["path"] or "")
        folder = str(path.parent).casefold()
        if not any(duration >= row["duration"] * 40 and size >= row["size"] * 10
                   for duration, size in mains.get(folder, ())):
            continue
        signature = (row["size"], round(row["duration"], 3), row["width"], row["height"])
        folders.setdefault(folder, set()).add(str(path).casefold())
        if (row["width"] or 0) > 0 and (row["height"] or 0) > 0:
            signatures.setdefault(signature, set()).add(folder)
        candidates.append((row["id"], folder, signature))
    reasons = {}
    for asset_id, folder, signature in candidates:
        count = len(folders[folder])
        spread = len(signatures.get(signature, ()))
        if count >= SHORT_ATTACHMENT_CLUSTER:
            reasons[asset_id] = _Reason("shortAttachmentCluster", count=count)
        elif spread >= SHORT_ATTACHMENT_CLUSTER:
            reasons[asset_id] = _Reason("shortAttachmentSpread", count=spread)
    return reasons


def names_release(stem: str, code: str | None) -> bool:
    """名字里带着这部作品的番号：`hjd2048.com-0907mide580-h264`、`tkmj001jp`、`kpkp3.com_483SGKX-016B`。"""
    for variant in dict.fromkeys((code, without_store_prefix(code))):
        pattern = _jav_code_pattern(variant)
        if pattern and re.search(rf"(?<![A-Z]){pattern}(?!\d)", str(stem or ""), re.I):
            return True
    return False


def _download_folders(connection) -> dict[str, tuple[str, int, float]]:
    """已入库且绑定了正片的云下载目录 → （番号，正片 id，正片时长）。

    目录至少在下载根之下一层：这个目录是这一个种子落地的地方，不是共用的下载根。
    """
    folders, roots = {}, set()
    for path, code, main, duration in connection.execute(
            "SELECT t.ledger_path,t.code,t.asset_id,a.duration FROM download_task t "
            "LEFT JOIN asset a ON a.id=t.asset_id WHERE t.state='ingested' "
            "AND t.asset_id IS NOT NULL AND t.code IS NOT NULL AND t.ledger_path IS NOT NULL"):
        folder = PureWindowsPath(path)
        if len(folder.parts) >= 3:
            folders[str(folder).casefold()] = (code, main, duration or 0)
            roots.add(str(folder.parent))
    folders.update(_untracked_download_folders(connection, roots, folders))
    return folders


def _untracked_download_folders(connection, roots, tracked) -> dict[str, tuple[str, int, float]]:
    """下载根下一层、没有任务记录的落地目录 → （番号，正片 id，正片时长）。

    任务表之前就落地的下载、失败后又落地的下载都没有任务行，可目录名带着正片的番号：
    目录里最长的、自身番号出现在目录名里的视频就是正片（2026-11-03 只读盘点：
    `第一會所新片@SIS001@DDH-454` 里 12 张推广图与下载地址文本全部漏判）。从视频反查
    目录名，而不是从目录名取番号：论坛前缀 `SIS001` 自己也长得像番号。
    """
    found: dict[str, tuple[str, int, float]] = {}
    for root in roots:
        prefix = root.rstrip("\\") + "\\"
        for asset_id, path, duration in connection.execute(
                "SELECT id,path,duration FROM asset WHERE disposal IS NULL AND medium='video' "
                "AND duration>0 AND substr(path,1,?)=? COLLATE NOCASE", (len(prefix), prefix)):
            name, _, rest = str(path)[len(prefix):].partition("\\")
            key = (prefix + name).casefold()
            code = rest and key not in tracked and release_code_from_filename(PureWindowsPath(rest).stem)
            if code and names_release(name, code) and duration > found.get(key, ("", 0, 0.0))[2]:
                found[key] = (code, asset_id, duration)
    return found


def _download_attachment_reasons(connection, rows) -> dict[int, tuple[str, bool]]:
    """云下载包里正片以外、名字不带本片番号的附带文件 → （理由，是否够自动隔离）。

    这是来源事实而不是名字猜测：下载任务记着这包是为哪部作品下的、哪一条是正片，
    整理把正片移走后留在落地目录里的推广视频、网址文本、二维码图都与这部作品无关。
    带本片番号的封面、截图和分卷，以及媒体中心作品图名不算附件。压缩包可能装着
    正片的资料，只进复核；视频要有测量值、足够短，且正片远长于它。
    """
    folders = _download_folders(connection)
    reasons = {}
    if not folders:
        return reasons
    for row in rows:
        path = PureWindowsPath(row["path"] or "")
        task = next((folders[key] for key in (str(parent).casefold() for parent in path.parents)
                     if key in folders), None)
        if task is None or row["id"] == task[1]:
            continue
        code, _main, main_duration = task
        if names_release(path.stem, code) or ARTWORK_NAME.fullmatch(path.stem):
            continue
        if row["medium"] == "video":
            duration = row["duration"] or 0
            if 0 < duration < DOWNLOAD_ATTACHMENT_SECONDS and main_duration >= duration * DOWNLOAD_MAIN_RATIO:
                reasons[row["id"]] = (_Reason("downloadShortVideo", code=code, minutes=f"{main_duration / 60:.0f}"), True)
        elif row["medium"] == "archive":
            reasons[row["id"]] = (_Reason("downloadArchive", code=code), False)
        else:
            reasons[row["id"]] = (_Reason("downloadFile", code=code), True)
    return reasons


def _software_file(path: str) -> bool:
    """包管理器内部文件、软件元数据和动态库不参与媒体垃圾判断。"""
    item = _windows_path(path)
    name = item.name.casefold()
    return ('node_modules' in {part.casefold() for part in item.parts}
            or name in {'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'}
            or (item.suffix.casefold() in {'', '.txt', '.json', '.rst'}
                and name.startswith(('readme', 'license', 'licence', 'notice')))
            or item.suffix.casefold() in {'.md', '.dll'})


def _repeated_copies(connection, *, roots=None) -> dict[tuple[str, int], int]:
    """同名同体积的小文件各出现在多少个发行包目录；只统计到达门槛的组合。

    推广附件是同一份文件被成批塞进不同发行包：`manko.fun.mp4`（11 MB、157 秒）出现在
    10 个下载目录，`最 新 位 址 獲 取.txt`（136 字节）出现在 7 个。名字和体积都一致是
    文件层面的事实，和只比测量值的极短附件扩散（`_short_attachment_reasons`）不同。
    只数目录名自己带番号的发行包：创作者目录里每期都带的同一段片头不是被塞进来的。
    """
    marks = ",".join("?" for _ in SCANNABLE_LOCATIONS)
    scope, parameters = _scope_clause(roots=roots)
    folders: dict[tuple[str, int], set[str]] = {}
    releases: dict[str, bool] = {}
    for path, name, size in connection.execute(
            f"SELECT path,name,size FROM asset WHERE disposal IS NULL AND location IN ({marks}) "
            "AND size>0 AND size<? AND path IS NOT NULL "
            "AND (COALESCE(medium,'other')<>'video' OR duration IS NULL OR duration<=1200)" + scope,
            (*SCANNABLE_LOCATIONS, JUNK_VIDEO_MAX_BYTES, *parameters)):
        if _software_file(str(path)):
            continue
        folder = str(path).rpartition("\\")[0]
        if folder not in releases:
            releases[folder] = bool(release_code_from_filename(folder.rpartition("\\")[2]))
        if not releases[folder]:
            continue
        key = (str(name or "").casefold(), int(size))
        folders.setdefault(key, set()).add(folder.casefold())
    return {key: len(found) for key, found in folders.items() if len(found) >= REPEATED_COPY_FOLDERS}


def _repeated_copy_reason(row, copies: dict[tuple[str, int], int]) -> str:
    """散布在多个目录的同一份小附件；带作品番号的文件与作品图名不算。"""
    item = _windows_path(row["name"] or row["path"] or "")
    size = int(row["size"] or 0)
    count = copies.get((item.name.casefold(), size), 0)
    if (not count or (row["medium"] != "video" and size > REPEATED_COPY_MAX_BYTES)
            or ARTWORK_NAME.fullmatch(item.stem) or release_code_from_filename(item.stem)):
        return ""
    return _Reason("repeatedCopies", count=count)


def _attachment_evidence(row, suffix: str, name: str, download_attachments: dict,
                         copies: dict) -> tuple[int, int, list[str]]:
    """附件证据：词库里的固定命名、下载包附带文件、同一份文件散布在多个发行包。

    返回（其中只够复核的分数，分数，理由）。固定命名只够复核；下载包附带的视频与散布
    副本只给 45 分，要再叠上时长与体积证据才到自动线；下载包里的压缩包只进复核。
    """
    score, review_only, why = 0, 0, []
    named = _promo_name_reason(suffix, row.get("path") or name, row.get("size") or 0)
    if named:
        score += JUNK_REVIEW_SCORE; review_only += JUNK_REVIEW_SCORE; why.append(named)
    reason, automatic = download_attachments.get(row["id"], ("", False))
    if reason:
        points = 45 if row.get("medium") == "video" else AUTO_TRASH_SCORE if automatic else JUNK_REVIEW_SCORE
        score += points; why.append(reason)
        if not automatic:
            review_only += points
    copied = _repeated_copy_reason(row, copies)
    if copied:
        score += 45; why.append(copied)
    return review_only, score, why


def _video_evidence(row, stem: str, longer: dict, promo_dir: bool,
                    directory_points: int, attachment_reason: str = "") -> tuple[int, int, list[str]]:
    """视频自己的证据：同番号完整版、时长、体积与推广目录。

    返回（分数，其中只够复核的分数，理由）。时长没探测到的视频可能就是正片：
    推广创作者位或「域名+番号」目录（`directory_points`）、推广目录与体积只说明它住在哪、
    有多大，说明不了它是广告，这些分数只够进复核队列。
    """
    score, why = 0, []
    code = (row["code"] or "").strip()
    duration = row["duration"]
    longest = longer.get(code)
    if longest and REAL_CODE.match(code) and duration is not None and 0 < duration < longest * 0.2 \
            and not PART_MARK.search(stem) and not fc2_collection_label(row).startswith(FC2_BONUS_PREFIX):
        # 分卷和特典已排除，同番号下不到两成时长的其余短版进入片段复核。
        # 用户标记的 `反抗不如享受.mp4`（ABW-220，244 秒）正好卡在旧的 35 分门外。
        score += 40; why.append(_Reason("fullVersionExists", minutes=f"{longest/60:.0f}"))
    if duration is not None and 0 < duration < 240:
        score += 15; why.append(_Reason("underFourMinutes"))
    context = directory_points
    if (row["size"] or 0) < JUNK_VIDEO_MAX_BYTES:
        score += 10; context += 10; why.append(_Reason("under120Mb"))
    if promo_dir:
        # 30 分单独不构成删片理由：正片也可能躺在别人起错名的目录里，
        # 要再叠一条时长或体积证据才到门槛。
        score += 30; context += 30; why.append(_Reason("promoDirectory"))
    probed = duration is not None and duration > 0
    review_only = 0 if probed else context
    if NUMBERED_SOURCE_VIDEO.fullmatch(stem) and PROMO_DOMAIN.search(stem):
        review_only += AUTO_TRASH_SCORE
        why.append(_Reason("numberedSourceVideo"))
    if attachment_reason:
        score += JUNK_REVIEW_SCORE; review_only += JUNK_REVIEW_SCORE; why.append(attachment_reason)
    return score, review_only, why


def _judgement_inputs(database, *, asset_ids, roots):
    """读取同一账本快照中的候选、用户决定、作品版本与目录上下文。"""
    from . import junk_visual
    visual = junk_visual.read(database)
    with database.read_connection() as c:
        rows = _junk_rows(c, asset_ids=asset_ids, roots=roots, visual_ids=visual)
        if not rows:
            return [], {}, frozenset(), {}, {}, {}, {}, {}, visual
        # 同番号是否存在明显更长的版本；只在 code 是真番号时才有意义。
        longer = {r[0]: r[1] for r in c.execute(
            "SELECT code, max(duration) FROM asset WHERE medium='video' AND code IS NOT NULL "
            "AND code<>'' AND duration IS NOT NULL GROUP BY code")}
        dismissed_keys = [str(row[0]) for row in c.execute(
            "SELECT item_key FROM review_decision "
            "WHERE category='junk_file' AND status='rejected'"
        )]
        dismissed_ids = {int(key) for key in dismissed_keys if key.isdigit()}
        # 显式资产可以横跨全库；邻居一次读取，避免把成千目录拼成 SQL OR 表达式。
        context = None if asset_ids is not None else roots
        folder_assets, folder_videos = _folder_index(c, roots=context)
        context_rows = _junk_rows(c, roots=context) if asset_ids is not None else rows
        short_attachments = _short_attachment_reasons(c, context_rows, roots=context)
        download_attachments = _download_attachment_reasons(c, rows)
        copies = _repeated_copies(c, roots=context)
    return (rows, longer, frozenset(dismissed_ids), folder_assets, folder_videos, short_attachments,
            download_attachments, copies, visual)


def scored_candidates(database, *, asset_ids=None, roots=None) -> tuple[list[dict], frozenset[int]]:
    """候选按嫌疑分从高到低排序，连同用户已确认不是垃圾的 id。

    路径与目录分量的缓存只在一次评分里有用，评完就清掉，不让十几万条路径常驻服务进程。
    """
    try:
        return _scored_candidates(database, asset_ids=asset_ids, roots=roots)
    finally:
        _windows_path.cache_clear()
        _windows_parent.cache_clear()
        _promo_directory_parts.cache_clear()


def _non_video_evidence(item, stem, suffix, *, self_evident, promo_directory):
    """非视频推广形态的分数与理由，配套作品文件及已单独计分的网页附件不叠加。"""
    if (item.get('medium') == 'video' or self_evident
            or suffix in PAGE_ARCHIVE_SUFFIXES or suffix in INTERNET_SHORTCUT_SUFFIXES):
        return 0, []
    if is_decorated_name(stem) and (item.get('size') or 0) <= DECORATED_MAX_BYTES:
        return 60, [_Reason('decoratedImage')]
    if AD_BRAND.search(stem) and (AD_BRAND_FORM.search(stem)
            or (item.get('medium') == 'image' and (item.get('size') or 0) <= BRAND_TINY_BYTES)):
        return 60, [_Reason('promoBrand')]
    if promo_directory:
        return 50, [_Reason('promoDirectory')]
    return 0, []


def _scored_candidates(database, *, asset_ids, roots) -> tuple[list[dict], frozenset[int]]:
    from . import junk_visual
    (rows, longer, dismissed_ids, folder_assets, folder_videos, short_attachments,
     download_attachments, copies, visual) = _judgement_inputs(database, asset_ids=asset_ids, roots=roots)
    # 每个目录里挂着推广名的候选有多少个；插页判据要看它有没有同伙。
    promo_neighbours = _promo_neighbour_counts(rows)
    out = []
    for r in rows:
        d = dict(r)
        if _software_file(d.get('path') or d.get('name') or ''):
            continue
        s, why = 0, []
        name = d.get("name") or _windows_path(d.get("path") or "").name
        name_path = _windows_path(name)
        nm = name_path.stem
        suffix = name_path.suffix.casefold()
        d["junk_kind"] = (
            "url" if suffix in INTERNET_SHORTCUT_SUFFIXES
            else (d.get("medium") if d.get("medium") in JUNK_KINDS else "other")
        )
        spoken = despaced(nm)
        residue = promo_residue(spoken)
        promo = bool(PROMO_PHRASE.search(spoken) or PROMO_DOMAIN.search(spoken))
        page_archive = suffix in PAGE_ARCHIVE_SUFFIXES
        if suffix in INTERNET_SHORTCUT_SUFFIXES:
            s += 60; why.append(_Reason("internetShortcut"))
        elif page_archive:
            s += 60; why.append(_Reason("pageArchive"))
        attachment_reason = _attachment_junk_reason(suffix, d.get("path") or name, d.get("size") or 0)
        if attachment_reason:
            s += 60; why.append(attachment_reason)
        # 只够进复核队列的分数：固定命名、下载包里的压缩包，和未探测时长视频的目录与体积证据。
        review_only, attachment_points, attachment_reasons = _attachment_evidence(
            d, suffix, name, download_attachments, copies)
        s += attachment_points; why.extend(attachment_reasons)
        # 目录维度的证据：广告包的文件名往往干净（`极道世界.mp4`），唯一线索在旧导入器
        # 从目录名投影出来的创作者位或路径里。creator 位本身是推广站域名时，它就不再是
        # 「有归属所以是正片」的证据，下面两处对 creator 的信任都必须先排除这种情况。
        owner = d.get("creator") or ""
        owner_is_promo = bool(AD_DOMAIN.search(owner))
        real_owner = bool(owner) and not owner_is_promo
        # ledger 路径在两个平台都是 Windows 形态。`rpartition` 没有平台依赖，
        # 键也与 `_folder_index` 完全同源；`os.path.dirname` 在 macOS 会把整条
        # 反斜杠路径当成文件名。
        folder = str(d.get("path") or name).rpartition("\\")[0]
        # 成套下载的资源包里，域名是打包渠道给整包起的名，不是插页的自我暴露。
        bundled = folder_assets.get(folder, 0) >= BUNDLE_DIR_ASSETS
        # 目录名带推广站域名只说明「从哪个站下的」，说明不了这个文件是广告。
        # 文件自己是真番号、自己就有内容级的体积、或者是同目录正片的封面／截图时，
        # 目录证据就不成立。
        #
        # 只放非视频：广告包里的视频本来就叫 `极道世界.mp4`，它的 code 是旧导入器从
        # `bbsxv.xyz-DOCP-324` 目录名投影出来的真番号形状，而它自己就在同目录的正片
        # 名单里——两条豁免对视频都会自动成立，`AD_DIRPACK` 这条判据就没了。
        self_evident = d.get("medium") != "video" and (
            is_jav_code(d.get("code"))
            or (d.get("size") or 0) >= CONTENT_BYTES
            or has_sibling_original(nm, folder_videos.get(folder, frozenset()))
        )
        promo_dir = _promo_directory(_windows_parent(d.get("path") or name).parts)
        if promo and residue < 6 and not bundled:
            # 名字剥完只剩广告本身，这是最硬的信号。
            s += 60; why.append(_Reason("wholeNamePromo"))
        elif promo and residue < 14 and not real_owner and not bundled:
            s += 30; why.append(_Reason("mostlyPromo"))
            neighbours = promo_neighbours.get(folder, 0)
            if neighbours >= PROMO_CLUSTER_FILES:
                s += 30
                why.append(_Reason("promoNeighbours", count=neighbours - 1))
        directory_points = 0
        if owner_is_promo:
            directory_points = 50; why.append(_Reason("promoCreator"))
        elif AD_DIRPACK.search(folder) and not self_evident:
            directory_points = 45; why.append(_Reason("promoDirectoryPack"))
        s += directory_points
        points, reasons = _non_video_evidence(d, nm, suffix, self_evident=self_evident, promo_directory=promo_dir)
        s += points; why.extend(reasons)
        if d.get("medium") == "video":
            points, weak, reasons = _video_evidence(
                d, nm, longer, promo_dir, directory_points, short_attachments.get(d["id"], ""))
            s += points; review_only += weak; why.extend(reasons)
        # 有真实创作者归属、且名字剥完仍有实质描述的，是被打了水印的正片，不是广告。
        if real_owner and residue >= 14 and not (attachment_reason or attachment_reasons):
            s -= 45
        s, weak, reasons = junk_visual.adjust_score(d, visual.get(d['id']), s)
        review_only += weak
        why.extend(reasons)
        if review_only and s - review_only < AUTO_TRASH_SCORE:
            s = min(s, AUTO_TRASH_SCORE - 1)
        if s >= JUNK_REVIEW_SCORE:
            if _repeated_copy_reason(d, copies):
                d['copy_group'] = json.dumps([name.casefold(), int(d['size']), d['junk_kind']], ensure_ascii=False)
            d["score"] = s; d["why"] = " · ".join(why); d["why_parts"] = why_parts(why)
            out.append(d)
    out.sort(key=lambda x: (-x["score"], -(x["size"] or 0)))
    return out, frozenset(dismissed_ids)


def isolate(database, *, asset_ids=None, roots=None, protected_ids=()) -> dict:
    """将明确范围内的高分垃圾移入可还原回收站，不读取或删除媒体。

    人工保留、个人记录、文件自身作品身份和调用方点名的正片受保护。写入前重查评分依据，
    扫描或人工操作在计算期间改变了资产时留待下一次判定。
    """
    from . import junk_visual
    if asset_ids is None and roots is None:
        raise ValueError("automatic junk check needs asset ids or source roots")
    if not isinstance(database, LedgerDatabase):
        database = LedgerDatabase(database)
    scored, dismissed = scored_candidates(database, asset_ids=asset_ids, roots=roots)
    protected = set(protected_ids) | set(dismissed)
    chosen = [row for row in scored if row['score'] >= AUTO_TRASH_SCORE and row['id'] not in protected]
    isolated = []
    if not chosen:
        return {'candidates': len(scored), 'review': sum(row['id'] not in dismissed for row in scored),
                'isolated': 0, 'ids': []}
    with database.write_transaction() as connection:
        connection.execute('BEGIN IMMEDIATE')
        holders = record_holders(connection, [row['id'] for row in chosen])
        for row in chosen:
            current = connection.execute("SELECT * FROM asset WHERE id=?", (row['id'],)).fetchone()
            if not _can_isolate(connection, current, row, holders) or junk_visual.preserves_intro(database, current):
                continue
            connection.execute(
                "UPDATE asset SET disposal='trash',disposal_reason='junk',feedback_at=? WHERE id=? AND disposal IS NULL",
                (time.time(), row['id']))
            isolated.append(row['id'])
    return {'candidates': len(scored), 'review': sum(row['id'] not in dismissed for row in scored
                                                   if row['id'] not in isolated),
            'isolated': len(isolated), 'ids': isolated}


def _can_isolate(connection, current, evidence, holders) -> bool:
    """当前资产仍符合已算出的证据，且没有用户保留意图或自身作品身份。"""
    if current is None or current['disposal'] is not None or current['id'] in holders:
        return False
    if current['feedback'] == 'like' or any(current[key] != evidence[key] for key in
            ('location', 'path', 'name', 'size', 'duration', 'creator', 'code', 'medium')):
        return False
    if connection.execute("SELECT 1 FROM review_decision WHERE category='junk_file' AND status='rejected' "
                          "AND item_key=?", (str(current['id']),)).fetchone():
        return False
    if connection.execute("SELECT 1 FROM asset_subtitle WHERE asset_id=?", (current['id'],)).fetchone():
        return False
    if current['medium'] == 'video' and (current['duration'] is None or current['duration'] <= 0):
        return False
    stem = PureWindowsPath(current['name'] or current['path'] or '').stem
    identity = PART_MARK.sub('', PROMO_DOMAIN.sub('', stem)).strip('@._- ')
    return not (current['medium'] == 'video' and release_code_from_filename(identity))


