"""扫描、本地资料和缺失元数据采集共用一次有状态的处理任务。"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import sqlite3
import subprocess
import tempfile
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from contextlib import closing, contextmanager, nullcontext
from contextvars import copy_context
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from dataclasses import dataclass
from functools import partial
from pathlib import Path, PureWindowsPath
from urllib.parse import urlparse

from filelock import FileLock, Timeout
from PIL import Image

from .catalog_rules import (compile_code_patterns, is_jav_code, is_local_extra, normalise_code_key,
                            release_code_from_filename, same_release_code, scrapes_as_jav)
from .catalog_vocabulary import PERFORMER_TAG_PREFIX
from .field_owners import SCAN_FILENAME, write_owned_fields
from .profiles import read_settings
from .images import measure_image_file
from .jav_cover_fetch import MIN_WIDTH, DeadlineExceeded, NotFound
from .sources.base import SourceFailure
from .library_nfo import sidecars, SidecarIndex
from .media_io import directory_files, read_nfo, local_art, root_online, directory_entries, file_stat
from .genre_decisions import load_genre_decisions
from .metadata import (candidate_text_is_valid, source_text_is_valid,
                       extract_catalog_evidence, extract_peach_fields, relay_args,
                       validate_provider_code)
from . import metadata_routes
from . import media_identity
from .library_processing_scope import scoped_config, scoped_assets
from . import junk
from . import sample_followup
from .metadata_policy import SOURCE_SPECS, preferred_tag_source
from .platform import translate_ledger_path as _local_ledger_path
from .review_csv import read_rows_shared, write_rows
from .scan import scan_location
from .fsutil import atomic_write_text
from . import artifact_rules, upgrade_rules
from .ffmpeg import FFmpegResolver
from .jobs import JobDeferred, JobPolicyError
from .storage_budget import CapacityGuard
from .media_probe import probe_unmeasured
from .media_sources import cost_for
from .media_processing_policy import metadata_only
from .scripting import HostLimiter
from .strm import skip_background_read
from .record_rehome import reattach_in
from .processing_traffic import ProcessingTraffic
from .processing_control import (task_control, bind_control, checkpoint_values,
                                 initial_estimate, ProcessingEstimate, interrupted_state,
                                 deadline_after, resume_fields, processing_item, ItemSkipped)
from .task_stages import stage as stage_fields, stage_code
from .user_messages import UserFacingError, UserInterruptedError, UserOSError, UserValueError
from . import interface_text


def translate_ledger_path(raw):
    from .smb_media import resolve
    return resolve(raw) or _local_ledger_path(raw)


FIELDS = ('item_key', 'code', 'query', 'asset_id', 'asset_path', 'field', 'field_label', 'current_value',
          'candidates_json', 'source_count', 'source_profile', 'policy_version', 'status',
          'size_gb', 'videos', 'fetched_at')
#: 采集字段的显示名（`server.json` 的 code，与自动写入页同一份）。候选表的 `field_label` 列存按 zh-CN 渲染的原文。
FIELD_CODES = {'title': 'labels.webAutoLandings.fieldTitle', 'original_title': 'labels.webAutoLandings.fieldOriginalTitle',
               'performers': 'labels.webAutoLandings.fieldPerformers', 'studio': 'labels.webAutoLandings.fieldStudio',
               'series': 'labels.webAutoLandings.fieldSeries', 'release_date': 'labels.webAutoLandings.fieldReleaseDate',
               'tags': 'labels.webAutoLandings.fieldTags'}
LABELS = {field: interface_text.text(f'server:{code}') for field, code in FIELD_CODES.items()}

#: 状态里最多保留这么多条问题；完整问题写在任务专属 JSONL 里，接口分页读取。
ISSUE_PREVIEW_LIMIT = 20

#: 扫描、资料与预览共用的阶段名，同时用于接口和页面。
SCAN_STAGE, COLLECT_STAGE, ALL_STAGES = 'scan', 'collect', 'all'
METADATA_STAGE, PREVIEWS_STAGE = 'metadata', 'previews'
STAGES = (ALL_STAGES, SCAN_STAGE, COLLECT_STAGE, METADATA_STAGE, PREVIEWS_STAGE)

#: 没有动作截止时间的阶段（本地读取）超过这么久没有心跳就在页面上预警。
STALL_AFTER_SECONDS = 120.0

#: 单项外部动作预算：资料查询覆盖一次请求加一轮重试，封面覆盖证据查询与候选往返。
#: 到点只结束当前项目并记为可重试，不让一个来源拖住整批任务。
ACTION_BUDGETS = {'querying_metadata': 90.0, 'fetching_cover': 240.0}

#: 来源明确答复「没有」之后多久不再问。「没有」不是永久的：来源会补录，片子可能后来上架。
MISS_TTL_SECONDS = 7 * 24 * 3600

#: 主机间隔。默认 2 秒；javdb 按出口 IP 计配额，这一档由用户定（2026-09-22 定为 3 秒，
#: 每分钟 20 页）。参照面：每分钟 40～50 页实测会招来 3～7 天的封 IP，`harvest_directory_links`
#: 那条批量线仍按 5 秒跑。撞上 403 不再是盲等 24 小时——`scraping_access.FIRST_BLOCKED_PAUSE`
#: 先停 15 分钟，连着再撞才翻倍，所以这一档收紧的代价是有限且可观测的（docs/SOURCING.md）。
SOURCE_INTERVALS = {'javdb.com': 3.0, 'jdbstatic.com': 3.0}
#: 按 `SOURCE_INTERVALS` 等的那一份间隔，整个进程共用。想要作品资料采集、新作资料采集、资料处理
#: 各起各的 provider，间隔若各算各的，几条同时跑时问同一主机的请求就叠在一起，配额照样按
#: 出口 IP 一份算。补女优资料的 javdb 女优页、详情页视频预告与订阅源取页也等这一份。
SOURCE_LIMITER = HostLimiter(SOURCE_INTERVALS, default_interval=2.0)
#: 认人 Wiki 的取页层自己不再等主机间隔：它的传输就是 provider 的 `transport`，那里已经按
#: `SOURCE_LIMITER` 等过一次，再等一遍每页就要 4 秒。
_NO_WAIT = HostLimiter({}, default_interval=0.0)
#: 一个 provider 里每个认人 Wiki 的请求上限。一部片至多十几页，真正的闸门是动作预算与本趟预算；
#: 这一条只挡住同一批里失控地翻页。
WIKI_MAX_REQUESTS = 2000
SOURCE_LABELS = {'r18dev': 'r18.dev', 'dmm': 'DMM / FANZA', 'avbase': 'AVBase', 'javbus': 'JavBus', 'javdb': 'javdb',
                 'fc2': 'FC2', 'fc2cmadb': 'FC2CMADB', 'fc2ppvdb': 'FC2PPV-DB', 'javten': 'JAVten',
                 'javarchive': 'JavArchive',
                 '1pondo': '一本道', 'local_nfo': '本地 NFO',
                 # 经 amane 桥问的几站（`metadata_amane.SITES`）。
                 'makers': '片商官网', 'prestige': 'Prestige', 'faleno': 'FALENO',
                 'dahlia': 'DAHLIA', 'mgstage': 'MGStage',
                 'fc2club': 'FC2Club', 'freejavbt': 'FreeJavBT',
                 'airav': 'AIRAV', 'avsox': 'AVSOX',
                 # Seesaa 的几个 Wiki（`sources.seesaa`）。前两个在素人链上（`metadata_routes.WIKI_STAGE`），
                 # av_name 只由 `scrape_codes` 点名。
                 'sougouwiki': '素人系総合 Wiki', 'av_neme': 'このAV女優の名前教えてwiki',
                 'av_name': 'AV女優の名前特定wiki'}
#: `SOURCE_LABELS` 里要随界面语言换写法的几项：放进句子时用 `source_name` 交嵌套的那一句。
SOURCE_NAME_CODES = {'1pondo': 'labels.libraryProcessing.source.onePondo',
                     'local_nfo': 'labels.libraryProcessing.source.localNfo',
                     'makers': 'labels.libraryProcessing.source.makers'}
PROVIDER_NAMES = {'local_nfo': 'local-nfo', 'r18dev': 'r18-json', 'dmm': 'dmm-graphql', 'avbase': 'avbase-search',
                  'javbus': 'javbus-page', 'javdb': 'javdb-api', 'fc2': 'fc2-article',
                  'fc2cmadb': 'fc2cmadb-article', 'fc2ppvdb': 'fc2ppvdb-page', 'javten': 'javten-page',
                  'javarchive': 'javarchive-page',
                  '1pondo': '1pondo-json',
                  'makers': 'amane-makers', 'prestige': 'amane-prestige',
                  'faleno': 'amane-faleno', 'dahlia': 'amane-dahlia', 'mgstage': 'amane-mgstage',
                  'fc2club': 'amane-fc2club',
                  'freejavbt': 'amane-freejavbt', 'airav': 'amane-airav', 'avsox': 'amane-avsox',
                  'sougouwiki': 'sougouwiki', 'av_neme': 'av_neme', 'av_name': 'av_name'}


def phrase(code, params=None):
    """问题项与汇总句里的一句：`{code, params}`，与 `interface_text.nested` 同形，可以再嵌进别的句子当参数。"""
    return {'code': code, 'params': dict(params or {})}


def phrase_text(said):
    """一句的 zh-CN 原文：`phrase` 按资源渲染，纯文本（异常原文、文件名）原样。"""
    if isinstance(said, dict):
        return interface_text.text(f"server:{said['code']}", said.get('params'))
    return str(said)


def joined_phrases(phrases):
    """几处原因连成一句：`errors.libraryProcessing.problems` 一层套一层，分隔符在资源里，各语言自己定。"""
    said = phrases[-1]
    for head in reversed(phrases[:-1]):
        said = phrase('errors.libraryProcessing.problems', {'first': head, 'rest': said})
    return said


def source_name(source):
    """放进句子的来源名：要翻译的那几项是嵌套的一句，别的是站名原文。"""
    code = SOURCE_NAME_CODES.get(source)
    return phrase(code) if code else SOURCE_LABELS.get(source, source)


def said_of(error):
    """异常写进问题项与参数：带 code 的交 `phrase`，别的交原文。"""
    return phrase(error.code, error.params) if isinstance(error, UserFacingError) else str(error)


def _error_fields(said):
    """状态里的失败原因：`error` 是 zh-CN 原文，`error_code`／`error_params` 供界面翻译；没有原因时一起清空。"""
    if not said:
        return {'error': '', 'error_code': None, 'error_params': None}
    return {'error': phrase_text(said), 'error_code': said['code'], 'error_params': dict(said.get('params') or {})}


def is_missing(error):
    """来源明确说「没有」：传输层的 `NotFound`，或契约里 `not_found` 那一档的 `SourceFailure`。"""
    return isinstance(error, NotFound) or (isinstance(error, SourceFailure) and error.kind == 'not_found')


def _again(error):
    """缓存着的失败再抛一次时交一个同类同措辞的新实例；`SourceFailure` 连细档与状态码一起带上。"""
    from .user_messages import UserFacingError
    if isinstance(error, UserFacingError):
        # 带 code 的异常第一个参数是 code，不能拿原句重建：复制一份，code、参数与状态码原样带上。
        again = copy.copy(error)
        if isinstance(error, SourceFailure):
            # 新实例还没记过冷却（`SiteSource.holding`）。
            again.held = False
        return again
    again = type(error)(str(error))
    if hasattr(error, 'sites'):
        again.sites = error.sites
    return again


def _extended(deadline, extra):
    """把单调时钟上的截止时刻往后推 `extra` 秒；没有截止时刻就还是没有。"""
    return None if deadline is None else deadline + extra


def _excused(provider):
    """provider 累计等人点验证的秒数（`LibraryMetadataProvider.excused`）；没有这一项的 provider 按 0 算。"""
    value = getattr(provider, 'excused', 0.0)
    return value if isinstance(value, (int, float)) else 0.0


def _unreached(problems):
    """几处没问成的原因 `[(原因, 是否冷却)]` 合成一个异常：全是冷却就是本趟没轮到（`SourcePaused`），
    有一处是别的原因就是 `Unavailable`。

    每处原因已是问题清单那一句（`describe_failure` 给的 `phrase`）；一处就照搬它的 code，
    几处按 `joined_phrases` 连成一句，每处仍是自己的 code 与参数。"""
    from .jav_cover_fetch import Unavailable
    from .scraping_access import SourcePaused
    kind = SourcePaused if all(paused for _, paused in problems) else Unavailable
    said = joined_phrases([said for said, _ in problems])
    return kind(said['code'], said['params'])


def _fc2_official_images(payload):
    """FC2 来源快照只提取发行方存储原件，并附发行方 Referer。"""
    from .jav_cover_fetch import Candidate, IMAGE_URL
    from .scripting import host_under, hostname_of
    from .sources.fc2 import FC2, storage_original
    found = []
    for raw in payload.get('cover_urls') or ():
        if not isinstance(raw, str):
            continue
        original = storage_original(raw)
        if not IMAGE_URL.fullmatch(original):
            continue
        host = hostname_of(original)
        if host_under(host, ('contents.fc2.com',)) or re.fullmatch(r'contents-thumbnail\d*\.fc2\.com', host):
            found.append(Candidate(host, original, FC2.referer))
    return found


def _official_evidence(snapshots, absent=()):
    """片商、发行方与官方镜像快照里的封面候选，交给 `best_cover` 的 `known`。

    r18.dev 那份原样带着作品 JSON（`raw`），按 `r18_payload_evidence` 读；DMM 那份给的是
    `cover_urls` 与 `content_id`。r18.dev 在 `absent` 里（一周内说过没有、或不在这个番号的链上）
    也记进 `sources`：`best_cover` 见到它就不再问 r18.dev。两样都没有时交 `None`，与不给同义。
    """
    from .jav_cover_fetch import (IMAGE_URL, MetadataEvidence, content_id_images, dmm_cdn_images,
                                  r18_payload_evidence)
    found, makers, sources = [], set(), set()
    for name, payload in snapshots:
        if name == 'r18dev' and isinstance(payload.get('raw'), dict):
            evidence = r18_payload_evidence(payload['raw'])
            found += evidence.candidates
            makers |= evidence.makers
        elif name in ('r18dev', 'dmm'):
            # 没有作品 JSON 的快照只在确实给出图址时才算证据，否则照旧去问。
            images = [image for url in payload.get('cover_urls') or ()
                      if isinstance(url, str) and IMAGE_URL.fullmatch(url) for image in dmm_cdn_images(url)]
            images += content_id_images(str(payload.get('content_id') or ''))
            if not images:
                continue
            found += images
        elif name in metadata_routes.AMANE_OFFICIAL_STAGE:
            from .jav_cover_fetch import candidate_for
            found += [candidate_for(url) for url in payload.get('cover_urls') or ()
                      if isinstance(url, str) and IMAGE_URL.fullmatch(url)]
            found += content_id_images(str(payload.get('content_id') or ''))
            makers |= {str(payload[field]).strip().casefold() for field in ('maker', 'studio', 'label')
                       if isinstance(payload.get(field), str) and payload[field].strip()}
        elif name in metadata_routes.FC2_STAGE:
            found += _fc2_official_images(payload)
        else:
            continue
        sources.add(name)
    sources |= {'r18dev'} & set(absent)
    return MetadataEvidence(tuple(found), frozenset(makers), frozenset(sources)) if sources else None


def artwork_title(snapshots):
    """封面版次使用来源标题与明确的 Blu-ray 标签。"""
    from .jav_poster_crop import is_vr_title
    titles = [str(payload.get('title') or '') for _, payload in snapshots if payload.get('title')]
    title = next((value for value in titles if is_vr_title(value)), next(iter(titles), ''))
    edition = any(re.search(r'ブルーレイ|blu[\s-]?ray', str(payload.get('genres') or ''), re.I)
                  for _, payload in snapshots)
    if edition and not re.search(r'ブルーレイ|blu[\s-]?ray', title, re.I):
        title += ' Blu-ray'
    return title


def _said_no(code, sites):
    """合档的「没有」：带上说了没有的是哪几站（`sites`），失败记忆按站记（`_MissCache`）。"""
    error = NotFound(code)
    error.sites = tuple(sites)
    return error


def describe_failure(error):
    """把来源失败写成问题清单里能直接读懂的一句（`phrase`）。"""
    import httpx
    from .avatar_picker import PickerError
    from .jav_cover_fetch import Unavailable
    from .scraping_access import SourcePaused
    text = str(error).strip()
    if isinstance(error, (Unavailable, SourceFailure)) and text.startswith('HTTP '):
        return phrase('errors.libraryProcessing.sourceReturned', {'status': text})
    # 这几个的消息本来就是写给人看的，照用；别的只报类型，免得把内部细节贴到界面上。
    if isinstance(error, (Unavailable, SourceFailure, SourcePaused, PickerError, httpx.TransportError)) and text:
        return phrase(*relay_args(error))
    return phrase('errors.libraryProcessing.processingError', {'type': type(error).__name__})


def _source_failure_details(error, code, action, *, source=None):
    """采集问题保留脱敏异常链和阶段，页面摘要不暴露内部错误正文。"""
    from .error_reporting import exception_facts, scrub
    from .task_retry import transient_delay
    return scrub({'stage': action, 'code': code, 'source': source,
                  'automatic_retry_delay': transient_delay(error), **exception_facts(error)})
#: 来源说「没有」不是待办：馆藏里本来就有大量独立资源和创作者作品，任何目录站都收不到
#: 它们。逐条记在日志里备查，界面只按这两类各报一个数（`state['notes']`），不进问题清单。
MISS_MESSAGES = {'querying_metadata': phrase('errors.libraryProcessing.missMetadata'),
                 'fetching_cover': phrase('errors.libraryProcessing.missCover')}
#: 日志里的 code 反查回上面的键，界面按键取自己的短标签。
NOTE_KEYS = {said['code']: key for key, said in MISS_MESSAGES.items()}
#: 外网不通时要出网的那些行不去问，直接记这一句；联网之后可以重试（`network_reachability`）。
OFFLINE_MESSAGE = phrase('errors.libraryProcessing.offline')


def _note_key(record):
    """这条记录是哪一类告知项，不是就返回 None。升级前的日志只有原文，按 zh-CN 渲染的那句认。"""
    code = record.get('message_code')
    if code:
        return NOTE_KEYS.get(code)
    message = record.get('message')
    return next((key for key, said in MISS_MESSAGES.items() if message == phrase_text(said)), None)


def _message_fields(message):
    """问题项那一句写进记录的字段：`phrase` 存 zh-CN 原文与 `message_code`／`message_params`，纯文本只存原文。"""
    if isinstance(message, dict):
        return {'message': phrase_text(message), 'message_code': message['code'],
                'message_params': dict(message.get('params') or {})}
    return {'message': str(message)}

#: 状态文件与候选 CSV 的落盘节流。页面轮询读的是内存里的任务快照，文件只为进程没了
#: 之后还能看到最后状态；候选 CSV 随处理进度越写越大，每条资产都重写一遍是平方级开销。
STATE_FLUSH_SECONDS = 0.5
CANDIDATE_FLUSH_SECONDS = 5.0
#: 两次写候选 CSV 之间至少隔上一次写入耗时的这么多倍。七十多 MB 的表整份写一次要三四秒，
#: 只按 5 秒节流的话处理线程一半时间在写文件、占着解释器锁拖慢页面；按耗时放大间隔，
#: 写文件压在一成上下。没落盘的那几部片不提交进度检查点，中断后照旧重做，不会丢。
CANDIDATE_FLUSH_COST_RATIO = 10

#: 采集要补的字段，以及它们在 `asset` 表里的列名（没列出的与字段同名或不在表里）。
COLLECTED_FIELDS = ('title', 'performers', 'studio', 'release_date', 'tags')
COLUMN_OF = {'title': 'catalog_title'}

#: 一趟任务向外部来源要的总量。三条闸门里谁先到谁生效，之后每部片只记「本趟…已用完」。
#: 一部片问三家目录站、每家 1～2 次，所以 6000 次约等于 1500 部。请求是一条接一条发的，
#: 同一主机两问之间隔着主机间隔（默认 2 秒，javdb 3 秒，见 `SOURCE_INTERVALS`），不同主机的间隔
#: 互不阻塞；6000 次按 2 秒算也要三个多小时，和 4 小时的时间闸门同一量级，哪条先到都说得通。
#: 封面与资料页合计每次约 250 KB，1 GiB 装得下这 6000 次。
MAX_SOURCE_REQUESTS = 6000
MAX_SOURCE_BYTES = 1024 * 1024 * 1024
MAX_SOURCE_SECONDS = 4 * 3600


class CoverKept(NotFound):
    """每个来源都问成了，给得出的封面却不比本机那张宽。按「没有」记进记忆，一周内不再问，
    也不算问题项。"""


def cover_settled(path):
    """网络封面按 1600px 判断高清；用户提供的本地图片和 FC2 商品图保留尺寸门槛。"""
    size = measure_image_file(path)
    if size is None:
        return False
    try:
        evidence = json.loads(Path(path).with_suffix('.scraping.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        evidence = {}
    from .community_catalog import origin_of
    if origin_of(str(evidence.get('source_url') or '')) in ('javdb', 'javbus'):
        return False
    if not evidence.get('source_url') or str(Path(path).stem).upper().startswith('FC2'):
        return max(size) >= MIN_WIDTH
    return max(size) >= 1600


def _corrects_kept_cover(target, candidate, data, verified_by):
    """本机那张更宽，却是没经印证的另一张图，而问来的这张经过了印证：照样换。

    官方那一档只按尺寸挑图，挑中的可能是正片截图：`FC2-PPV-3264420` 装上的是 JavArchive
    转存的 605×364 截图，真正的商品图是同页 510×616 那张竖版，javdb 的方图与它对得上。
    按宽度比，截图永远留着。所以本机那张 `.scraping.json` 里没有印证图源、和问来的这张
    又不是同一张图时，印证过的这张胜出；FC2 官方存储上的图是卖家自己传的商品图，不当错图换，
    没有来路记录的也不动。
    """
    from .community_catalog import picture, same_picture
    from .scripting import host_under, hostname_of
    if not verified_by:
        return False
    try:
        evidence = json.loads(target.with_suffix('.scraping.json').read_text(encoding='utf-8'))
        kept = picture(candidate, target.read_bytes())
        fresh = picture(candidate, data)
    except (OSError, ValueError, Image.DecompressionBombError):
        return False
    if not isinstance(evidence, dict) or evidence.get('verified_by'):
        return False
    if host_under(hostname_of(str(evidence.get('source_url') or '')), ('contents.fc2.com',)):
        return False
    return not same_picture(kept, fresh)


class _BudgetedPages:
    """认人 Wiki 的取页层套一层动作预算：每取一页前看一眼还剩多少。

    `WikiPages` 把传输层抛的 `RuntimeError` 一律记成「网络未取得」，预算用尽的 `DeadlineExceeded`
    也是 `RuntimeError`，所以要在它外面判，不能交给传输层。"""

    def __init__(self, pages):
        self.pages = pages
        self.deadline = None

    def get(self, url):
        from .jav_cover_fetch import DeadlineExceeded
        # 用减法判：`processing_control.ActiveDeadline` 在减法里扣掉暂停的那段。
        if self.deadline is not None and self.deadline - time.monotonic() <= 0:
            raise DeadlineExceeded('errors.libraryProcessing.deadlineRetryLater')
        return self.pages.get(url)


class LibraryMetadataProvider:
    """来源链各档的入口：按来源配置的传输，站经 `sources.SITE_SOURCES` 问（`site`），封面走 `cover`。

    `secrets_root` 是凭据根本身（`peach-data/secrets`），不是它底下的 `follow`：
    `CredentialStore` 自己会拼上那一层。多给一层的表现不是报错，是每个来源都读成
    「没有凭据」——采集设置里贴好的 JavBus、javdb Cookie 一条都不会被带上。

    `public_cache` 是匿名 JavDB 资料的快照目录（`<生成目录>/jav-public`），与新作页、发现共用；
    不给就只在本进程内存里复用。
    """
    def __init__(self, secrets_root, *, tools_root=None, public_cache=None, wiki_root=None):
        from .scraping_access import SourceTransport
        from .jav_cover_fetch import HostLimitedTransport
        self.secrets_root = Path(secrets_root)
        #: amane 桥的 venv 所在的工具区（`<Peach 数据目录>/tools`）；不给就用配置里的默认位置。
        self.tools_root = Path(tools_root) if tools_root is not None else None
        self.public_cache = Path(public_cache) if public_cache is not None else None
        #: 认人 Wiki 的页缓存（`wiki`）。不给就放在凭据根旁边的 `sources/library-metadata/seesaa-pages`：
        #: 凭据根是数据目录下的 `secrets`。
        self.wiki_root = (Path(wiki_root) if wiki_root is not None
                          else self.secrets_root.parent / 'sources' / 'library-metadata' / 'seesaa-pages')
        self.transport = HostLimitedTransport(
            SourceTransport(secrets_root, max_requests=MAX_SOURCE_REQUESTS,
                            max_bytes=MAX_SOURCE_BYTES, max_seconds=MAX_SOURCE_SECONDS),
            2.0, limiter=SOURCE_LIMITER)

    #: 匿名 JavDB 资料的快照目录；没有时只在进程内存里复用。
    public_cache = None

    #: 由本机浏览器过验证的来源累计等人点验证的秒数（`_excuse`）。调用方拿它前后相减，把这段时间
    #: 从单项动作预算里扣掉：一个站第一次弹验证窗口时，那一问要等 `min(40, timeout) + 120` 秒，
    #: 超过一部片 90 秒的资料预算，不扣掉的话这部片会被记成「预算内未取得」（ADR-0065 第二条）。
    excused = 0.0

    def _excuse(self, source, started):
        """`source` 是浏览器来源、这一问超过了 `BROWSER_REQUEST_TIMEOUT`：超出的那段按等人点验证算。"""
        from .jav_cover_fetch import BROWSER_REQUEST_TIMEOUT
        from .scraping_access import SOURCES
        spent = time.monotonic() - started
        if SOURCES.get(source, {}).get('browser') and spent > BROWSER_REQUEST_TIMEOUT:
            self.excused += spent - BROWSER_REQUEST_TIMEOUT

    def amane(self, code, *, deadline=None, route=()):
        """经 amane 桥问 `route` 里那几站，一次子进程并发问完，返回 `[(来源, 资料)]`。

        桥与映射在 `metadata_amane`（ADR-0043）。正在冷却的站不带进子进程；桥报的限流与
        封禁按站写回 `scraping_access` 那份冷却记录，和 httpx 那条路读写同一份。几站都明确
        说没有才是 `NotFound`；有一站出错且谁都没给资料时带着原因报 `Unavailable`；要问的
        站全在冷却才报 `SourcePaused`——那不是没取到，是本趟没轮到。
        """
        from . import metadata_amane
        from .scraping_access import SourcePaused, paused_until
        cache = self.__dict__.setdefault('_amane', {})
        key = (code, tuple(route))
        if key not in cache:
            sites = [site for site in route if site in metadata_amane.SITES]
            open_sites = [site for site in sites if not paused_until(self.secrets_root, site)]
            if not sites:
                cache[key] = NotFound('errors.libraryProcessing.noAmaneSites')
            elif not open_sites:
                cache[key] = SourcePaused('errors.scrapingAccess.coolingDown')
            else:
                cache[key] = self._amane_query(code, open_sites, deadline)
        if isinstance(cache[key], Exception):
            raise _again(cache[key])
        return cache[key]

    def _amane_query(self, code, sites, deadline):
        """起一次桥子进程并把报告翻成这一档的结果或异常（异常作为返回值，由调用方缓存后再抛）。"""
        from . import metadata_amane, peach_proxy
        from .config import TOOLS_DIR
        from .jav_cover_fetch import Unavailable
        from .scraping_access import SourcePaused, pause_source, values_for, record_source_check
        from .processing_control import checkpoint
        checkpoint('network')
        timeout = None
        if deadline is not None:
            timeout = deadline - time.monotonic()
            if timeout <= 1.0:
                raise DeadlineExceeded('errors.libraryProcessing.deadline')
        try:
            tools = self.tools_root if self.tools_root is not None else TOOLS_DIR
            try:
                bridge = metadata_amane.AmaneBridge.create(tools)
            except metadata_amane.BridgeMissing:
                if previous := self.__dict__.get('_amane_preparation_error'):
                    raise previous
                started = time.monotonic()
                try:
                    metadata_amane.ensure(tools, secrets_root=self.secrets_root)
                except metadata_amane.PreparationError as error:
                    self._amane_preparation_error = error
                    raise
                finally:
                    elapsed = time.monotonic() - started
                    self.excused += elapsed
                bridge = metadata_amane.AmaneBridge.create(tools)
            direct_sites = [site for site in sites if values_for(self.secrets_root, site).get('network') == 'direct']
            report = bridge.query(code, sites, timeout=timeout,
                                  proxy_options={'trust_env': False} if len(direct_sites) == len(sites)
                                  else peach_proxy.client_options(self.secrets_root), direct_sites=direct_sites)
        except Exception as error:  # noqa: BLE001 - 桥没装、venv 坏了、超时：整档未取得，原因给人看
            _raise_task_failure(error)
            said = said_of(error) if isinstance(error, UserFacingError) else str(error).strip() or describe_failure(error)
            return Unavailable('errors.libraryProcessing.amaneBridgeFailed', {'error': said})
        raw_sites = report.get('sites')
        raw_sites = raw_sites if isinstance(raw_sites, dict) else {}
        reports = {site: raw_sites[site] if isinstance(raw_sites.get(site), dict) else {
            'status': 'failed', 'reason': 'parse_error', 'detail': 'bridge returned no record for this site',
        } for site in sites}
        found, failures = metadata_amane.split_report(code, {**report, 'sites': reports})
        for site, result in reports.items():
            error = failures.get(site)
            record_source_check(self.secrets_root, site, 'metadata', {
                'checked_at': time.time(), 'ok': result.get('status') == 'found' and error is None,
                'kind': error.kind if error else 'ok',
                'reason': error.detail if error else 'parsed',
                'status': metadata_amane.diagnostic_status(result.get('http_status')),
                'elapsed_s': result.get('elapsed_s', 0),
            })
        problems, held = [], 0
        for site, error in failures.items():
            action = metadata_amane.cooldown_action(error)
            if action:
                pause_source(self.secrets_root, site, refused=action == 'blocked')
                held += 1
            if error.kind != 'not_found':
                problems.append(error)
        if found:
            return found
        if not problems:
            return _said_no('errors.libraryProcessing.amaneSitesSaidNo', sites)
        # 一站出错就照搬它的 code；几站都出错时按 `joined_phrases` 连成一句，每站仍是自己的 code。
        combined = joined_phrases([phrase(*relay_args(problem)) for problem in problems])
        said = combined['code'], combined['params']
        # 出错的站全都进了冷却，这一档就是「本趟没轮到」；只要有一站是别的原因就是「未取得」。
        if held and held == len(problems):
            return SourcePaused(*said)
        return Unavailable(*said)

    def community(self, code, *, deadline=None, route=None, known=(), absent=(), received=lambda found: None):
        """官方渠道落空时问综合索引那一档，返回 `[(来源, 资料)]`。

        问哪几家按 `community_catalog.community_sources_for`，它转手问
        `metadata_routes.community_route`：有码与素人问 AVBase、JavBus 与 javdb，
        FC2 的商品号只问 javdb。`route` 是调用方已经算好的那一档成员，给了就不再算
        （那一步要本机证据，provider 手上没有）。资料和封面两步都可能要它，同一个
        番号只问一次：javdb 的配额经不起每部片问两遍。`known` 是调用方手上已有的几家快照
        （资料那一步取回的、磁盘缓存里还新鲜的），算作答上、不再问；`absent` 是一周内说过
        「没有」的几家，也不再问。
        几家都明确说没有才是 `NotFound`；有一家出错且谁都没给资料时，出错的几家全在冷却就报
        `SourcePaused`（本趟没轮到），否则带着原因报 `Unavailable`。
        """
        from .community_catalog import community_sources_for
        have = dict(known)
        cache = self.__dict__.setdefault('_community', {})
        if code not in cache:
            asked = [source for source in community_sources_for(code, route=route)
                     if source not in have and source not in absent]
            cache[code] = self._ask_community(code, asked, deadline, received)
        if isinstance(cache[code], Exception):
            if have:
                return list(have.items())
            raise _again(cache[code])
        return [*have.items(), *((source, payload) for source, payload in cache[code] if source not in have)]

    def community_problems(self, code):
        """`community` 问这个番号时没问成的几家 `[(原因, 是否冷却)]`，别的几家照常答上时也留着。

        封面那一步据此不下「没有」的结论（#342）：JavBus 断线、javdb 答上时，只剩 javdb 带水印的那张，
        印证不了也用不了，可 JavBus 那张下次可能就取到了。"""
        return list(self.__dict__.get('_community_problems', {}).get(code, ()))

    def _ask_community(self, code, sources, deadline, received):
        """逐家问 `sources`，交出答上的 `[(来源, 资料)]`，或一个待缓存再抛的异常（见 `community`）。"""
        found, problems, said_no = [], [], []
        self.__dict__.setdefault('_community_problems', {})[code] = problems
        for source in sources:
            try:
                payload = self.site(source, code, deadline=deadline)
            except DeadlineExceeded:
                if found:
                    return found
                raise
            except Exception as error:
                _raise_task_failure(error)
                if is_missing(error):
                    said_no.append(source)
                    continue
                said = describe_failure(error)
                problems.append((said if phrase_text(said).startswith(SOURCE_LABELS[source]) else phrase(
                    'errors.libraryProcessing.sourceProblem', {'source': source_name(source), 'problem': said}),
                    source_paused(error)))
                continue
            found.append((source, payload))
            received([(source, payload)])
        if found or not problems:
            return found or _said_no('errors.libraryProcessing.communitySaidNo', said_no)
        return _unreached(problems)

    def fc2(self, code, *, deadline=None, route=None, covers=False, required=(), known=(), received=lambda found: None):
        """FC2 自己那一页，下架了就依次问几个存档站；返回沿路答上的每一档 `[(来源, 资料)]`。

        五站各是契约下的一站（`sources/fc2.py`、`sources/fc2cmadb.py`、`sources/fc2ppvdb.py`、
        `sources/javten.py`、`sources/javarchive.py`），先后问、取齐即停由这里管。资料和封面两步都要它，
        同一档只问一次：商品页约 300 KB，问两遍白花一份流量。已下架的商品仍回 200，站里认不出那份
        Product 就归 `not_found`——那不是抓取失败，是这部片在站上没有了。本地这批没封面的 FC2 多数是
        这种，所以接着问 fc2cmadb：它留着下架作品的标题、卖家、标签与封面原图。再往下是 FC2PPV-DB
        （女优、卖家、販売日与流出标记，不给封面）与 JAVten（日文标题、标签与存储原件地址），这两站
        在 Cloudflare 验证后面，经本机浏览器过验证（ADR-0065）；验证没过就整站冷却，链照常往下走。
        浏览器那一问里等人点验证的时间记进 `excused`，不算进这部片的动作预算。最后才落到 JavArchive，
        那一档只给标题和一张转存封面，比官方原图差一档（2026-09-22 实测 `FC2-PPV-4137487`
        在 fc2cmadb 是 404，JavArchive 上有）；它的每一条转存各交一份（`records()`）。几处都
        没有才按 `NotFound` 交出去，记进「没有」的记忆，一周内不再问。

        资料那一步答上就停，只有一处例外：这一行还缺演员（`required`）而答上的几档都没给，
        就接着问有女优栏的那几站（`metadata_routes.FC2_CAST_SITES`）。发行方商品页没有演员栏，
        镜像站与 FC2PPV-DB 那一栏是这条链上对得上人的地方；JAVten 与 JavArchive 不给演员，照旧不问。
        `known` 是缓存里已经答过的几档快照，算作答上，但不再交出去；有它在时这一档问不出东西就交空列表，
        不报「没有」。

        封面那一步（`covers`）把链问到底。给出地址的那一档常常下不来
        图：站上标着没有商品图，或者地址还在、FC2 的存储上那张已经删了——而这一层判不出
        来，能不能用要等 `best_cover` 量过才知道（2026-09-22 实测 `FC2-PPV-3232110` 从
        fc2cmadb 拿到的地址是 404，JavArchive 上另有一张 1417×829）。所以封面要的是链上
        全部图源，由它择优；多问那一档顺带多一批标签（ADR-0030）。

        `route` 是这个番号的完整来源链（`metadata_routes.route_for_code`）：链上摘掉哪一处
        就不问哪一处，不给就按 `metadata_routes.FC2_STAGE` 的顺序都问。
        """
        from .sources import SITE_SOURCES, Session
        from .sources.fc2 import UNRECOGNISED, video_id
        if not video_id(code):
            raise NotFound(UNRECOGNISED)
        cache = self.__dict__.setdefault('_fc2', {})
        state = cache.setdefault(code, {'found': [], 'problems': [], 'asked': set()})
        mark = self.excused
        for name in metadata_routes.FC2_STAGE:
            if (route is not None and name not in route) or name in state['asked']:
                continue
            answered = [*known, *(payload for _, payload in state['found'])]
            if answered and not covers and not (name in metadata_routes.FC2_CAST_SITES
                                                and _lacks_performers(required, answered)):
                continue
            state['asked'].add(name)
            started = time.monotonic()
            additions = []
            try:
                session = Session(self.transport, _extended(deadline, self.excused - mark))
                additions = [(name, record.payload())
                             for record in SITE_SOURCES[name]().records(code, session=session)]
                state['found'] += additions
            except DeadlineExceeded:
                # 前面已经答上时预算用尽只是「没再往下问」，不是这个番号没取到。
                if not state['found']:
                    raise
                break
            except Exception as error:  # noqa: BLE001 - 原因由调用方汇总成一句话
                _raise_task_failure(error)
                if not is_missing(error):
                    state['problems'].append(error)
            finally:
                self._excuse(name, started)
            received(additions)
        if state['found'] or known:
            return state['found']
        # 一处报错、另一处说没有时报错误：那个番号在报错那处有没有，还没问出来。
        if state['problems']:
            raise _again(state['problems'][0])
        raise _said_no('errors.libraryProcessing.fc2ArchivesSaidNo', sorted(state['asked']))

    def one_pondo(self, code, *, deadline=None):
        """一本道自己那份作品 JSON（`sources/onepondo.py`），返回 `[('1pondo', 资料)]`。

        资料和封面两步都要它，同一个番号只问一次，失败也记着。下架的作品官网直接回 404，
        那就是「站上没有」，记进「没有」的记忆，一周内不再问。
        """
        from .sources import ONEPONDO
        cache = self.__dict__.setdefault('_1pondo', {})
        if code not in cache:
            try:
                cache[code] = [(ONEPONDO.name, self.site(ONEPONDO.name, code, deadline=deadline))]
            except Exception as error:  # noqa: BLE001 - 原因由调用方汇总成一句话
                _raise_task_failure(error)
                cache[code] = error
        if isinstance(cache[code], Exception):
            raise _again(cache[code])
        return cache[code]

    def _official_candidates(self, code, evidence=(), *, deadline=None, known=(), absent=()):
        """发行方自己那张封面，交给 `best_cover` 当候选。

        只有 FC2 和一本道走这里：别的番号的官方面 `best_cover` 自己会找（r18、MGS、
        Prestige），这两家它一处都不问。资料那步问过的档这里不再发请求，FC2 链上它没
        走到的那几档要补问：图源要凑齐了交给 `best_cover` 量，它才挑得出能用的那张。

        一页上有几个图位就都交下去，不只交排头那张。JavArchive 的作品页收了两处——
        `div.fisrst_sc` 那张排前，schema.org 的 `image` 排后——而转存者存的图会失效：
        只交排头那张的话，它 404 就整条落空，同一页上还在的那张连量都没量过。

        `known` 是资料那一步已经取到的快照 `[(来源, 资料)]`，这一档里有的站不再问；`absent` 里
        的站一周内说过没有，也不再问。
        """
        from functools import partial

        from .jav_cover_fetch import Candidate, Unavailable
        from .scraping_access import SourcePaused
        from .sources import FC2, ONEPONDO
        sources = _sources_for(code, *evidence)
        have = [(name, payload) for name, payload in known if name in (*metadata_routes.FC2_STAGE, '1pondo')]
        skip = {name for name, _ in have} | set(absent)
        if 'fc2' in sources:
            source, referer = 'fc2', FC2.referer
            ask = partial(self.fc2, covers=True, known=[payload for _, payload in have],
                          route=tuple(name for name in metadata_routes.FC2_STAGE if name not in skip))
        elif '1pondo' in sources:
            source, referer = '1pondo', ONEPONDO.referer
            ask = self.one_pondo if '1pondo' not in skip else lambda code, deadline: []
        else:
            return ()
        try:
            found = [*have, *ask(code, deadline=deadline)]
        except DeadlineExceeded:
            raise
        except Exception as error:  # noqa: BLE001 - 交给 `cover()` 汇总成一句话
            _raise_task_failure(error)
            # 「没有」交回 `cover()` 时是传输层那一档的 `NotFound`：它按这一档跳到社区来源。
            if is_missing(error):
                raise NotFound(*relay_args(error)) from error
            raise (SourcePaused if source_paused(error) else Unavailable)(
                'errors.libraryProcessing.sourceProblem',
                {'source': source_name(source), 'problem': describe_failure(error)}) from error
        addresses = []
        for _, payload in found:
            for url in payload.get('cover_urls') or [payload.get('cover_url')]:
                if url and url not in addresses:
                    addresses.append(url)
        return tuple(Candidate(urlparse(url).netloc.lower(), url, referer) for url in addresses)

    def site(self, source, code, *, deadline=None):
        """经契约问 `SITE_SOURCES` 里的一站，交出来源快照那份 dict（`SiteRecord.payload()`）。

        没取到抛的是 `SourceFailure`：`not_found` 那一档由 `is_missing` 认，其余由 `describe_failure`
        写成一句。冷却、动作预算与连接失败由传输层抛出、原样放过。
        """
        from .javdb_public import public_cache_scope
        from .sources import SITE_SOURCES, Session
        with public_cache_scope(self.public_cache) if self.public_cache is not None else nullcontext():
            return SITE_SOURCES[source]().query(code, session=Session(self.transport, deadline)).payload()

    def wiki(self, source, code, *, deadline=None):
        """素人链上的认人 Wiki（`metadata_routes.WIKI_STAGE`，ADR-0145），返回 `[(来源, 资料)]`。

        一个 provider 里每站只建一个 `SeesaaSource`：素人系総合 Wiki 一张厂牌表列着几十上百部，
        读过的表记在实例里，同厂牌的下一部不再搜索。取页层是 `sources.seesaa.WikiPages`（落盘页缓存），
        传输用这条链的 `transport`，所以照「Peach 代理」出网、按主机冷却、计进本趟预算，主机间隔与
        别的站共用 `SOURCE_LIMITER`。一部片最多十几页，每取一页前看这部片的动作预算。

        站内搜索范围里没找到（`incomplete_search`）按「没有」交出去，记进一周的「没有」记忆：Wiki
        条目是社区陆续补的，一周后再问；别的失败（断线、撞墙、限额）照常是问题，不记「没有」。
        """
        from .jav_cover_fetch import Unavailable
        from .metadata import MetadataProviderError
        from .sources import Session
        from .sources.seesaa import WIKI_SOURCES, WikiPages
        sites = self.__dict__.setdefault('_wiki', {})
        if source not in sites:
            site = WIKI_SOURCES[source]()
            pages = WikiPages(self.wiki_root, config=site.config, transport=self.transport,
                              limiter=_NO_WAIT, max_requests=WIKI_MAX_REQUESTS)
            sites[source] = (site, _BudgetedPages(pages))
        site, pages = sites[source]
        pages.deadline = deadline
        try:
            record = site.query(code, session=Session(pages, deadline))
        except MetadataProviderError as error:
            # 原因里不带站名：`_metadata` 记问题时会给单家来源补上。
            if error.kind == 'incomplete_search':
                raise NotFound(*relay_args(error)) from error
            raise Unavailable(*relay_args(error)) from error
        return [(source, record.payload())]

    def query(self, code, source='r18dev', *, deadline=None):
        """有码与素人链上逐个成档的官方来源：默认是 r18.dev（`sources/r18dev.py`），有码链上它之后是 DMM 的
        GraphQL（`sources/dmm.py`，ADR-0059）。"""
        return self.site(source, code, deadline=deadline)

    def cover(self, code, cover_root, *, deadline=None, evidence=(), snapshots=(), absent=()):
        """官方大图优先；没有就用社区来源里两个图源对得上的那张；再没有就用官方小图。

        小图也比没有封面强（素人系官方图只有 300×300），但社区来源的大图只有被另一个
        图源印证过才用，官方小图本身也算一个图源（ADR-0030）。

        FC2 与一本道的那张走官方这一档而不是社区那一档：`storage*.contents.fc2.com` 上的图
        是卖家自己传的商品图（实测 2350×2352），一本道那张是站点自己的剧照（960×540），
        两处都是发行方，没有第二个图源可印证也不该被扣住。`evidence` 见 `_sources_for`。

        `snapshots` 是资料那一步这一趟已经取到、或磁盘缓存里还新鲜的快照 `[(来源, 资料)]`，
        `absent` 是一周内说过没有、或不在这个番号链上的站：两者都不再问。r18.dev 与 DMM 的快照
        给出官方候选（`_official_evidence`），并与 `best_cover` 在线官方候选一起比较尺寸；
        社区那几家的快照直接交给图源印证，JavDB 图片仅用作比对证据。
        几处没问成且全是冷却时报 `SourcePaused`（本趟没轮到），否则报 `Unavailable`。
        """
        from .community_catalog import verified_cover
        from .jav_cover_fetch import SMALL_MIN_WIDTH, Unavailable, best_cover
        from .scraping_access import SourcePaused
        target = cover_root / (code + '.jpg')
        if cover_settled(target):
            return False
        kept = measure_image_file(target)
        mark = self.excused
        official, verified_by, problems, siblings = None, (), [], ()
        try:
            siblings = self._official_candidates(code, evidence, deadline=deadline, known=snapshots, absent=absent)
            official = best_cover(self.transport, code, 0, deadline=_extended(deadline, self.excused - mark),
                                  prior_candidates=siblings, minimum_width=SMALL_MIN_WIDTH,
                                  known=_official_evidence(snapshots, absent))
        except NotFound:
            pass
        except (Unavailable, SourcePaused) as error:
            problems.append((describe_failure(error), source_paused(error)))
        chosen = official
        if official is None or official[1][0] < MIN_WIDTH:
            try:
                answers = self.community(code, deadline=_extended(deadline, self.excused - mark), absent=absent,
                                         known=[(name, payload) for name, payload in snapshots
                                                if name in metadata_routes.COMMUNITY_STAGE])
                problems += self.community_problems(code)
                *picked, verified_by = verified_cover(self.transport, code, answers,
                                                      reference=official, siblings=siblings if official else (),
                                                      deadline=_extended(deadline, self.excused - mark))
                chosen = tuple(picked)
            except NotFound:
                pass
            except (Unavailable, SourcePaused) as error:
                problems.append((describe_failure(error), source_paused(error)))
        if chosen is None:
            raise _unreached(problems) if problems else NotFound('errors.libraryProcessing.noCover')
        candidate, size, data = chosen
        # 官方图可替换社区转存图；同类来源按像素面积升级。
        from .community_catalog import origin_of
        official_replacement = False
        if official is not None and chosen is official:
            try:
                prior = json.loads(target.with_suffix('.scraping.json').read_text(encoding='utf-8'))
                official_replacement = origin_of(str(prior.get('source_url') or '')) in ('javdb', 'javbus')
            except (OSError, ValueError):
                pass
        improves = kept is None or (size[0] > kept[0] if code.upper().startswith('FC2')
                                    else size[0] * size[1] > kept[0] * kept[1] * 1.01)
        if (not improves and not official_replacement
                and not _corrects_kept_cover(target, candidate, data, verified_by)):
            if problems:
                # 有来源这一趟没问成（冷却、配额、超时），它那里可能有原图：不能记成一周不问。
                raise _unreached(problems)
            raise CoverKept('errors.libraryProcessing.coverNotImproved', {'width': size[0], 'height': size[1]})
        from .cover_artwork import install_cover
        title = artwork_title(snapshots)
        install_cover(target, code, data, size, evidence=dict(source=candidate.source, title=title,
            source_url=candidate.url, width=size[0], height=size[1], verified_by=list(verified_by),
            raw_sha256=hashlib.sha256(data).hexdigest(), checked_at=time.time()))
        return True

    def reset(self):
        """丢弃可能卡住的连接；下一个项目从新传输开始。换连接不重置本趟预算。"""
        self.transport.renew()

    def budget_spent(self):
        """本趟采集预算（`MAX_SOURCE_*`）到顶时的说明，没到顶是空串。"""
        return self.transport.exhausted()

    def close(self):
        self.transport.close()


def state_path(config):
    return config.directory('state') / 'library-processing.json'


#: 等着全库处理锁的前台处理有几轮。后台定向任务看到它不为零就让路。
_waiting_foreground = 0
_waiting_guard = threading.Lock()
#: 前台处理等锁时多久再试一次。
LOCK_RETRY_SECONDS = 0.5


def _foreground_waiting() -> bool:
    with _waiting_guard:
        return _waiting_foreground > 0


def _lock_free(config) -> bool:
    try:
        with FileLock(str(state_path(config)) + '.lock', timeout=0):
            return True
    except Timeout:
        return False


class ProcessingBusy(UserFacingError, JobDeferred):
    """全库处理锁被占着，或者有用户发起的处理在等它；后台定向任务回到队列。"""

    def __init__(self, config):
        super().__init__('jobMessage.libraryProcessing.waitingForProcessing')
        self.config = config

    def ready(self) -> bool:
        return not _foreground_waiting() and _lock_free(self.config)


@contextmanager
def _processing_lock(config, *, background, active):
    """持有全库处理锁，返回本轮该用的 `active`。

    共享候选文件整份读改写，同一时刻只能有一轮处理在写。用户发起的处理（不带
    `state_file`）等锁，并让在跑的后台定向任务在下一个检查点退出；后台任务碰上锁被占
    或有人在等，就抛 `ProcessingBusy` 回到队列，凭各自的进度文件续跑。
    """
    global _waiting_foreground
    lock = FileLock(str(state_path(config)) + '.lock', timeout=0)
    if background:
        if _foreground_waiting():
            raise ProcessingBusy(config)
        try:
            lock.acquire()
        except Timeout:
            raise ProcessingBusy(config) from None
        try:
            yield lambda: active() and not _foreground_waiting()
        except InterruptedError:
            if active() and _foreground_waiting():
                raise ProcessingBusy(config) from None
            raise
        finally:
            lock.release()
        return
    with _waiting_guard:
        _waiting_foreground += 1
    try:
        while True:
            try:
                lock.acquire()
                break
            except Timeout:
                if not active():
                    raise UserInterruptedError('errors.libraryProcessing.stopped') from None
                time.sleep(LOCK_RETRY_SECONDS)
        try:
            yield active
        finally:
            lock.release()
    finally:
        with _waiting_guard:
            _waiting_foreground -= 1


def issues_path(config, job_id):
    return config.directory('state') / f'library-processing-{job_id}.issues.jsonl'


def misses_path(config):
    return config.directory('state') / 'library-metadata-misses.json'


def _save(path, payload):
    # 进度条轮询会在写入间隙打开这份状态，Windows 上替换被占着的目标会拒绝访问，
    # 交给 fsutil 等读者放手。
    atomic_write_text(path, json.dumps(payload, ensure_ascii=False))


def decorate(state, *, now=None):
    """把状态投影成当前契约，并给运行中的副本补上等待时长与「长时间没有进展」标记。

    旧状态文件把完整问题存在 `issues` 数组里；投影只留计数与前 20 条预览，
    其余照旧可读，也不把上千条问题重新塞回每次轮询的响应。读取只改副本，
    写入者还拿着锁时 GET 不会把任务改成失败，慢与卡死由人判断。
    """
    state = dict(state)
    legacy = state.pop('issues', None)
    if legacy and 'issue_count' not in state:
        state['issue_count'] = len(legacy)
        state['issue_preview'] = [dict(asset_id=row.get('asset_id'), title=str(row.get('title') or ''),
                                       path=str(row.get('path') or ''), message=str(row.get('message') or ''))
                                  for row in legacy[:ISSUE_PREVIEW_LIMIT]]
        state['issues_truncated'] = len(legacy) > ISSUE_PREVIEW_LIMIT
    # 完整走完各阶段且留有问题的历史快照仍可展示已取得的结果。
    if state.get('status') == 'failed' and 'outcome' not in state:
        state['outcome'] = ('partial' if stage_code(state) == 'library.finished'
                            and state.get('completed_at') and state.get('issue_count')
                            else 'interrupted')
    if state.get('status') != 'running' or state.get('waiting_for_update'):
        return state
    now = time.time() if now is None else now
    started = state.get('current_started_at') or state.get('last_progress_at') or state.get('started_at')
    if started:
        state['waited_seconds'] = max(0, int(now - started))
    deadline = state.get('current_deadline_at')
    last = state.get('last_progress_at') or state.get('started_at')
    if deadline:
        state['stalled'] = now >= deadline
    else:
        state['stalled'] = bool(last and now - last >= STALL_AFTER_SECONDS)
    if state['stalled']:
        state.update(eta_seconds_min=None, eta_seconds_max=None)
    return state


def source_paused(error):
    """这次失败是不是「来源被限住了」——按异常类型判，不按话术。

    限流和取不到是两回事，处理它们的动作也不是一个：来源正在冷却或本趟配额用完时，
    这部片的资料站上有没有还没问出来，等一会儿重跑就有；站上确实没有那张图，重跑
    多少遍都一样。混在一句「未取得」里，读的人分不出哪些值得再等。

    自写来源的验证页、封禁、地区限制与限流（`SourceFailure.cooldown_action` 非空）同样算：
    来源层已经把那一站写进冷却，这一问站上有没有这部片还没问出来。
    """
    from .scraping_access import SourcePaused
    return isinstance(error, SourcePaused) or bool(getattr(error, 'cooldown_action', ''))


def issue_summary(problems, paused=0):
    """问题清单顶上那一句（`phrase`，没有问题时是 None）：几项要处理，其中几项只是等来源放开。

    两类的下一步动作不同。限流那些现在按多少次重试都是同一句「来源正在冷却」，得等；
    其余是这一部片自己的事，当场重试就有结果。数混在一起报，等的人会一直点重试。
    """
    if not problems:
        return None
    if paused >= problems:
        return phrase('labels.libraryProcessing.issuesAllPaused', {'count': problems})
    if paused:
        return phrase('labels.libraryProcessing.issuesSomePaused', {'count': problems, 'paused': paused})
    return phrase('labels.libraryProcessing.issues', {'count': problems})


def _issue_classification(record, retryable, paused):
    """这条记录写进日志的级别，以及它值不值得重试。告知项两样都不是问题。"""
    note = _note_key(record)
    return ('info' if note else 'paused' if paused else 'error'), retryable and not note


def _record_issue(state, log_path, record, *, diagnostics=None):
    """把一条记录写进日志，并按类型计进状态。

    告知项只按类型各记一个数：它们占着那 20 条预览的话，一条真问题就被几百条
    「来源没有这部片」挤出屏幕，而全库有大量片子任何目录站都收不到。
    """
    if diagnostics is not None:
        record['diagnostics'] = diagnostics
    with open(log_path, 'a', encoding='utf-8') as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + '\n')
    note = _note_key(record)
    if note:
        state['notes'][note] = state['notes'].get(note, 0) + 1
        return
    state['issue_count'] += 1
    if record['severity'] == 'paused':
        state['paused_count'] = state.get('paused_count', 0) + 1
    if len(state['issue_preview']) < ISSUE_PREVIEW_LIMIT:
        state['issue_preview'].append({key: record[key] for key in
                                       ('asset_id', 'title', 'path', 'message', 'message_code', 'message_params',
                                        'severity') if key in record})
    else:
        state['issues_truncated'] = True
    asset_id = record['asset_id']
    if record['retryable'] and asset_id is not None and asset_id not in state['retryable_asset_ids']:
        state['retryable_asset_ids'].append(asset_id)
    # 卡在来源冷却上的是哪几部：升级补全据此把它们延后，而不是按失败结算。
    paused = state.setdefault('paused_asset_ids', [])
    if record['severity'] == 'paused' and asset_id is not None and asset_id not in paused:
        paused.append(asset_id)


def snapshot(config):
    try:
        state = json.loads(state_path(config).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {'status': 'idle'}
    if state.get('status') == 'running':
        try:
            # 锁覆盖 CLI 与 HTTP；进程退出后系统会释放它。
            with FileLock(str(state_path(config)) + '.lock', timeout=0):
                state = json.loads(state_path(config).read_text(encoding='utf-8'))
                if state.get('status') == 'running':
                    # 拿得到锁说明写入者已经不在了。结论写回文件：只改副本的话，另一个读取者
                    # 正好短暂占着锁时会读到原样的「运行中」，界面就在两种状态之间来回跳。
                    state.update(status='failed', outcome='interrupted',
                                 **_error_fields(phrase('errors.libraryProcessing.interrupted')),
                                 completed_at=state.get('last_progress_at') or time.time())
                    _save(state_path(config), state)
        except Timeout:
            pass
    # 状态文件没有 `notes` 时按日志重算：每条记录都在日志里，告知项和问题分得开。
    # 行数对不上说明日志被截断过，那时宁可原样显示。
    if 'notes' not in state and state.get('status') in ('complete', 'failed') and state.get('job_id'):
        try:
            count, problems, notes, retryable = 0, 0, {}, set()
            with issues_path(config, state['job_id']).open(encoding='utf-8') as handle:
                for line in handle:
                    item = json.loads(line)
                    count += 1
                    key = _note_key(item)
                    if key:
                        notes[key] = notes.get(key, 0) + 1
                        continue
                    problems += 1
                    if item.get('retryable') and item.get('asset_id') is not None:
                        retryable.add(item['asset_id'])
            if count == state.get('issue_count'):
                preview = [item for item in state.get('issue_preview', [])
                           if _note_key(item) is None]
                state.update(notes=notes, issue_count=problems, issue_preview=preview,
                             issues_truncated=problems > len(preview),
                             retryable_asset_ids=sorted(retryable))
                # 这条兼容路径读的是没有 `notes` 的旧状态，那一版还不分限流，所以只按项数写。
                if state.get('error') == phrase_text(issue_summary(count) or ''):
                    state['status'] = 'failed' if problems else 'complete'
                    state.update(_error_fields(issue_summary(problems)))
        except (OSError, ValueError, TypeError):
            pass
    return decorate(state)


def _queue_local_poster(video, code, cover_root, payload=None, posters=None, *, enqueue, generated=False):
    """`posters` 是调用方已经从同目录索引里挑出的海报候选，给了就不再列目录。"""
    target = cover_root / (code + '.jpg')
    if target.is_file() and (not generated or artifact_rules.current(
            target, upgrade_rules.LOCAL_POSTERS, source_required=True)):
        return
    if posters is None:
        _, posters = sidecars(video)
    posters = list(posters)
    reference = local_art(video, payload or {})
    if reference:
        posters.insert(0, reference)
    if not posters:
        return
    enqueue(posters[0], code, target)


def _read_local_posters(jobs, state, *, update, issue, generated_root=None):
    """按档位领取配套图片，空闲后补位；主线程保存结果并经过安全停点。"""
    from .cover_artwork import install_cover
    from .local_poster import read_jpeg, TIMEOUT_SECONDS
    def read(source, derived):
        stamp = artifact_rules.fingerprint(source) if derived else None
        return (*read_jpeg(source, isolated=True), stamp)
    failed = set()
    done = submitted = 0
    futures = {}
    with ThreadPoolExecutor(max_workers=4, thread_name_prefix='PeachLocalPoster') as executor:
        while submitted < len(jobs) or futures:
            row, started = (jobs[submitted][0], time.time()) if not futures else (
                next(iter(futures.values()))[0], next(iter(futures.values()))[4])
            update(**stage_fields('library.readImages'), checked=done, total=len(jobs), current_action='reading_local_cover',
                   current_asset_id=row['id'], current_asset_name=row['name'],
                   current_started_at=started, current_deadline_at=started + TIMEOUT_SECONDS)
            workers = {'low': 1, 'standard': 2, 'high': 4}[state['speed_mode']]
            while submitted < len(jobs) and len(futures) < workers:
                row, source, code, target = jobs[submitted]
                derived = generated_root is not None and target.parent == generated_root
                futures[executor.submit(copy_context().run, read, source, derived)] = (
                    row, code, target, source, time.time())
                submitted += 1
            completed, _ = wait(futures, return_when=FIRST_COMPLETED)
            for future in completed:
                row, code, target, source, _ = futures.pop(future)
                try:
                    data, size, stamp = future.result()
                    derived = generated_root is not None and target.parent == generated_root
                    if derived and stamp != artifact_rules.fingerprint(source):
                        raise OSError('companion image changed while being read')
                except InterruptedError:
                    raise
                except (OSError, ValueError, subprocess.TimeoutExpired) as error:
                    failed.add(row['id'])
                    message = phrase('errors.libraryProcessing.companionImageTimeout'
                                     if isinstance(error, subprocess.TimeoutExpired)
                                     else 'errors.libraryProcessing.companionImageUnreadable')
                    issue(row, message, action='reading_local_cover', retryable=True)
                else:
                    if not target.is_file() or derived:
                        install_cover(target, code, data, size)
                        if derived and not artifact_rules.remember(
                                target, upgrade_rules.LOCAL_POSTERS, source=source, source_fingerprint=stamp):
                            raise UserOSError('errors.libraryProcessing.companionImageChangedOnSave')
                        state['covers'] += 1
                done += 1
                update(checked=done, covers=state['covers'])
    return failed


def _fields(payload, genre_decisions=None):
    fields = extract_peach_fields(payload, genre_decisions)
    evidence = extract_catalog_evidence(payload)
    for key in ('title', 'original_title'):
        if key in evidence:
            fields[key] = evidence[key]
    if payload.get('local_tags'):
        from .entities import canonicalize_entity_name
        from .genre_taxonomy import UNMAPPED, resolve_genre
        # NFO 的 tag 既可能是来源 genre，也可能是用户自己的本地标签。认得出的统一
        # 投影成 Peach 中文标签，明确的画质／促销／发行属性丢掉；词表不认识的原样
        # 保留，不能把用户自己的分类当成「未知 genre」静默吞掉。
        values = []
        for raw in payload['local_tags']:
            resolved = resolve_genre(raw, genre_decisions)
            if resolved is None:
                continue
            value = raw if resolved == UNMAPPED else resolved
            value = canonicalize_entity_name('tag', value)
            if value and value not in values:
                values.append(value)
        values = [value for value in values if value]
        if values:
            fields['tags'] = dict(value=values, display_value='、'.join(values), warnings=[])
    return {field: value for field, value in fields.items() if candidate_text_is_valid(value)}


def _require_writer(config, db_path):
    if config.replication.enabled:
        from .sync import writer_device
        device_path = config.directory('state') / 'device-id'
        device = device_path.read_text(encoding='utf-8').strip() if device_path.is_file() else ''
        if not device or writer_device(Path(db_path), config.shared_root / 'database' / 'ledger.db') != device:
            raise UserValueError('errors.libraryProcessing.readOnlyDevice')


def _text(raw):
    """比对取值用的写法：空白差异和大小写不算两个值。"""
    return ' '.join(str(raw or '').split()).casefold()


def _provider_code(raw):
    """能拿去问来源的番号；不是发行番号的写法返回空串。

    `asset.code` 可能存放目录名、创作者账号、片源站编号或创作者自编号。
    这些值按没有番号处理，仅登记本地海报，不生成发行番号校验问题。
    """
    if not is_jav_code(raw):
        return ''
    try:
        return validate_provider_code(normalise_code_key(raw))
    except ValueError:

        return ''


def _candidate_identity(source, value):
    """候选的身份：来源加取值。取值变了身份就得跟着变，否则「批准的是哪一版」答不出来。"""
    return hashlib.sha256(json.dumps([source, value], ensure_ascii=False,
                                     sort_keys=True).encode()).hexdigest()


def _candidate_review_mode(groups, row, field, source, value, local_fields, verify_existing):
    """判定字段是补空、覆盖复核还是同值，并清除该来源失效的差异。"""
    local = source == 'local_nfo'
    current = _text(row.get(COLUMN_OF.get(field, field)))
    if not verify_existing and not local and (field in local_fields or current):
        return None
    baseline = current or (_text(local_fields[field].get('display_value', local_fields[field]['value']))
                           if field in local_fields else '')
    if (baseline and (not local or current) and not (verify_existing and local)
            and baseline == _text(value.get('display_value', value['value']))):
        key = f"asset:{row['id']}:{field}"
        if verify_existing and key in groups:
            group = groups[key]
            choices = [entry for entry in json.loads(group['candidates_json']) if entry['source'] != source]
            group.update(candidates_json=json.dumps(choices, ensure_ascii=False), source_count=len(choices))
        return None
    return 'review' if verify_existing and baseline and (not local or current) else 'fill'


def _previous_order(group, source, value):
    """同一来源再给的出演者只换了次序时沿用上一份。

    候选身份按取值算（`_candidate_identity`），次序一变身份就变，已批准的那一行会被当成来源
    换了说法、重新摆回复核页。javdb 的详情页与匿名接口列女优的次序不同，人却是同一批。
    """
    try:
        previous = next(entry['value'] for entry in json.loads(group['candidates_json'])
                        if entry.get('source') == source)
    except (StopIteration, KeyError, TypeError, ValueError):
        return value
    fresh = value['value']
    if (not isinstance(previous, list) or not isinstance(fresh, list) or previous == fresh
            or sorted(json.dumps(one, ensure_ascii=False, sort_keys=True) for one in previous)
            != sorted(json.dumps(one, ensure_ascii=False, sort_keys=True) for one in fresh)):
        return value
    return {**value, 'value': previous,
            'display_value': '、'.join(str(person.get('name') or '') for person in previous if isinstance(person, dict))}


def _source_candidate(source, document, value, evidence_path, mode):
    """来源值及其可回溯身份，使用同一份归属和复核标记构造。"""
    local = source == 'local_nfo'
    spec = SOURCE_SPECS.get(source)
    official = bool(spec and spec.official)
    candidate = dict(candidate_key=_candidate_identity(source, value['value']), source=source,
                     provider=PROVIDER_NAMES.get(source, source), value=value['value'],
                     display_value=value.get('display_value', str(value['value'])), warnings=value.get('warnings', []),
                     confidence=0.9 if local else 0.75 if official else 0.5 if source.startswith('custom-') else 0.6,
                     source_url=document.get('source_url', ''), raw_snapshot=str(evidence_path),
                     provider_id=str(document.get('id') or ''), content_id=str(document.get('content_id') or ''),
                     source_kind='local' if local else spec.kind if spec else 'community', official=official,
                     catalog_evidence=extract_catalog_evidence(document))
    if source == 'javdb':
        candidate.update(javdb_rule=document.get('javdb_rule'), source_id=document.get('source_id'))
    if mode in ('review', 'identity-review'):
        candidate['requires_review'] = True
    if mode == 'identity-review':
        candidate['requires_identity_review'] = True
    if value.get('unmapped_genres'):
        candidate['unmapped_genres'] = value['unmapped_genres']
    # `metadata.with_codes` 给显示值与提醒配的 code 一并带上，复核页按它们取当前语言。
    candidate.update({key: value[key] for key in ('display_value_code', 'display_value_params',
                                                  'warning_codes', 'warning_params') if key in value})
    return candidate


def _merge_candidates(groups, row, code, source, document, evidence_path, genre_decisions, local_fields=(),
                      *, verify_existing=False, database=None):
    """把 `document` 里认得出的字段并进 `groups`：同来源的旧候选换掉，别的来源保留。

    NFO 核查保留不同来源的取值；已有值的差异标记为覆盖复核。相同取值不重复生成候选。
    """
    local = source == 'local_nfo'
    for field, value in _fields(document, genre_decisions).items():
        key = f"asset:{row['id']}:{field}"
        if field == 'performers':
            value = _previous_order(groups.get(key), source, value)
        if not local and field == 'performers' and field in local_fields:
            _merge_local_performer_profiles(groups, key, value, source)
        mode = _candidate_review_mode(groups, row, field, source, value, local_fields, verify_existing)
        if mode is None:
            continue
        if (field == 'performers' and source == 'javdb' and code and code.upper().startswith('FC2')
                and not _confirmed_cast(database, value['value'])):
            mode = 'identity-review'
        candidate = _source_candidate(source, document, value, evidence_path, mode)
        group = groups.get(key, dict(item_key=key, code=code or '', query=code or row['name'],
            asset_id=row['id'], asset_path=row['path'], field=field,
            field_label=LABELS[field], current_value=row.get(COLUMN_OF.get(field, field)) or '',
            candidates_json='[]', source_count=0, source_profile='library', policy_version='library-v1',
            status='candidate', size_gb=round((row['size'] or 0)/1024**3, 2), videos=1, fetched_at=''))
        choices = [entry for entry in json.loads(group['candidates_json'])
                   if entry['source'] != source and not (local and not verify_existing
                                                         and entry['source'] != 'local_nfo')]
        choices.append(candidate)
        group.update(candidates_json=json.dumps(choices, ensure_ascii=False), source_count=len(choices),
                     fetched_at=time.strftime('%Y-%m-%d %H:%M:%S'))
        groups[key] = group


def _merge_local_performer_profiles(groups, key, remote, source):
    """同名人物的资料页证据并入本地 NFO 演员候选。

    r18 combined 页的人物对象提供 DMM id、假名、罗马字和官方头像。只在规范化主名
    逐字匹配时合并；不同人物作为独立候选保留，改变演员值须复核（ADR-0108）。
    """
    from .entities import normalize_entity_name

    group = groups.get(key)
    if group is None:
        return
    try:
        candidates = json.loads(group['candidates_json'])
    except (KeyError, TypeError, ValueError):
        return
    remote_people = {
        normalize_entity_name(person.get('name')): person
        for person in remote.get('value') or [] if isinstance(person, dict)
    }
    changed = False
    for candidate in candidates:
        if candidate.get('source') != 'local_nfo':
            continue
        people = candidate.get('value')
        if not isinstance(people, list):
            continue
        before = json.dumps(people, ensure_ascii=False, sort_keys=True)
        for person in people:
            if not isinstance(person, dict):
                continue
            matched = remote_people.get(normalize_entity_name(person.get('name')))
            if matched is None:
                continue
            for field in ('external_id', 'thumb_url', 'aliases'):
                if matched.get(field) and person.get(field) != matched[field]:
                    person[field] = matched[field]
                    changed = True
            if matched.get('profile_source') or source:
                profile_source = matched.get('profile_source') or source
                if person.get('profile_source') != profile_source:
                    person['profile_source'] = profile_source
                    changed = True
        # 取值变了，身份就得重算：`candidate_key` 是「用户批准的是哪一版」的唯一凭据，
        # 补进资料却留着旧键，事后按键回溯拿到的是没有这些证据的那一版。
        if json.dumps(people, ensure_ascii=False, sort_keys=True) != before:
            candidate['candidate_key'] = _candidate_identity(candidate.get('source'), people)
    if changed:
        group['candidates_json'] = json.dumps(candidates, ensure_ascii=False)
        groups[key] = group


def _sources_for(code, *evidence, route_overrides=None):
    """按这个番号问哪几**档**资料来源，从左到右；链本身在 `metadata_routes`。

    这里只把「按内容类型的来源链」摊成这条采集路认得的档名：官方与发行方那几家逐个
    成档，三家综合索引合成一档 `community`（那一档不逐家短路，理由见
    `metadata_routes.COMMUNITY_STAGE`）。`evidence` 是这一行的路径、文件名与账本
    厂牌——一本道与カリビアンコム 的番号同形，只有本机证据指着一本道时才问它。
    """
    return metadata_routes.stages_for_code(code, *evidence, overrides=route_overrides)


def _lacks_performers(required, payloads):
    """这一行要演员，而手上这几份快照一个人也没给。"""
    return 'performers' in required and not any(
        extract_peach_fields(payload).get('performers') for payload in payloads)


def _given_fields(entries):
    """这些证据条目一共给出了哪几个非空 Peach 字段。链上何时停手按它判。"""
    return {field for _, payload, _ in entries
            for field, value in extract_peach_fields(payload).items() if value}


def _confirmed_cast(database, people):
    from .metadata_alias_resolve import confirmed_performers
    if database is None:
        return False
    with database.read_connection() as connection:
        return confirmed_performers(connection, people)


def _asks_cover(code, *evidence):
    """这个番号要不要问外部封面。韩国 MIB 与国产、欧美（`metadata_routes` 的 `other`）不问：
    JAV 的封面来源按这种号查，要么查空，要么取回同号的另一部日本片。"""
    return bool(code) and metadata_routes.classify(code, *evidence) not in ('kmib', 'other')


def _scrapes_as_jav(row, code):
    """把账本行摊成 `catalog_rules.scrapes_as_jav` 要的那几样发行证据。

    `performers` 是取行时用 group_concat 带上的出演者投影；`asset` 上没有这一列。
    """
    return scrapes_as_jav(code, row.get('studio'), row.get('creator'), row.get('release_date'),
                          ('performer',) if row.get('performers') else (), row.get('region'))


def _studio_evidence(row):
    """判片商时本机手上有的证据：文件路径、文件名和账本里已记的厂牌。"""
    return (row.get('path'), row.get('name'), row.get('studio'))


def _missing_fields(row, local_fields=()):
    """这一行账本里还空着、本地资料也没给的字段。

    候选表里已有待批候选的字段照样算缺：一条候选还不是账本的值，免复核要两家一致
    （ADR-0030、ADR-0034），只有一家给过的字段正该再问下一家。同一家不重问由
    `_answered_sources` 管。
    """
    return [field for field in COLLECTED_FIELDS
            if field not in local_fields and not row.get(COLUMN_OF.get(field, field))]


def _answered_sources(groups, target_key, fields):
    """在 `fields` 里哪一个字段上已经有自己一条候选的来源；这一行不再问它们。

    一家来源的答复是整份并进候选表的（`_merge_candidates`），它在这一行缺的字段里有一条
    候选，就说明它能给的都已经在表里了：再问一遍拿回的是同一个值，换掉它自己那一条。
    2026-09-25 实测 410 条 FC2 演员候选待批时，这一行被当成「演员已有着落」，
    FC2PPV-DB 一次都没被问到；按来源判就只跳过给过候选的那一家。
    """
    answered = set()
    for field in fields:
        group = groups.get(f'{target_key}:{field}')
        if group:
            answered.update(entry.get('source') for entry in json.loads(group.get('candidates_json') or '[]')
                            if candidate_text_is_valid(entry))
    return answered


class _DirectoryIndex:
    """本趟任务内每个文件夹只列一次，交错处理的目录共享同一份索引。"""

    def __init__(self):
        self._cache: dict[str, dict[str, Path]] = {}
        self._errors: dict[str, OSError] = {}
        self._sidecars: dict[str, SidecarIndex] = {}

    def files(self, directory: Path) -> dict[str, Path]:
        key = str(directory)
        if key in self._errors:
            raise self._errors[key]
        found = self._cache.get(key)
        if found is None:
            try:
                found = self._cache[key] = directory_files(directory)
            except InterruptedError:
                raise
            except OSError as error:
                self._errors[key] = error
                raise
        return found

    def sidecars(self, video):
        key = str(video.parent)
        if key not in self._sidecars:
            self._sidecars[key] = SidecarIndex(self.files(video.parent))
        return self._sidecars[key].for_video(video)


#: 记忆文件的格式号。按站记、带各站接入时刻的是这一版；没有这个键的文件是按档记、
#: 整份绑一个来源目录指纹的写法（`_legacy_fingerprint`）。
MISS_FORMAT = 3
#: 几站合成一档的档名（`metadata_routes.stages_for_chain`）。按档记的文件里这几个键下的
#: 「没有」说不清是哪一站说的。
_MERGED_STAGES = frozenset({'community', 'fc2', 'amane', 'amane_official'})


def _legacy_fingerprint():
    """按档记的那种文件绑着的来源目录指纹。指纹对得上时，其中逐站的几条照旧作数。"""
    return hashlib.sha256('\n'.join(sorted(SOURCE_SPECS)).encode('utf-8')).hexdigest()[:12]


class _MissCache:
    """来源明确答复「没有」的番号，按站分开记，期内不再问。

    r18.dev 不认识的番号每轮「只采集」都重问一遍，每条卡在主机 2 秒间隔上，答案永远一样；
    真实账本上这样的行有六百多条，一轮就是几十分钟。只记 `NotFound`：网络故障与超时
    下次可能就好了，不该记。每记一条就落盘，任务被打断也不丢。

    键是站名（`r18dev`、`javdb`、`fc2cmadb`……），不是档名：一档里几站各说各的「没有」，
    接上新的一站只多出一个没有记忆的站，别的站说过的照旧作数。`cover` 那一条是例外，
    记的是「这个番号的封面来源加起来都没有」，以当时有哪几站为前提：文件里记着每一站
    是什么时候第一次出现的（`joined`），`fresh(..., lineup=...)` 时这个番号的链上有一站
    晚于这条记忆接入，这条就不作数。2026-09-21 接上 FC2 商品页与 fc2cmadb 之后，430 个
    FC2 番号手上还压着一条「封面没有」：答案没变，能问的人变了——而有码番号的记忆与这两站无关。
    """

    def __init__(self, path, *, ttl=MISS_TTL_SECONDS, now=time.time, sites=None):
        self._path = path
        self._ttl = ttl
        self._now = now
        self._sites = sorted(SOURCE_SPECS if sites is None else sites)
        try:
            loaded = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            loaded = {}
        if not isinstance(loaded, dict):
            loaded = {}
        if loaded.get('format') == MISS_FORMAT:
            known = set(loaded.get('sites') or ())
            joined = loaded.get('joined') if isinstance(loaded.get('joined'), dict) else {}
        elif loaded.get('sources') == _legacy_fingerprint() and sites is None:
            # 按档记的旧文件：单站成档的那几条（r18dev、dmm、1pondo）与 `cover` 仍是那一站、
            # 那一批来源的答复，照旧作数；合档的键说不清是哪几站，丢掉。
            known, joined = set(self._sites), {}
            loaded = {'misses': {name: codes for name, codes in (loaded.get('misses') or {}).items()
                                 if name not in _MERGED_STAGES}}
        else:
            known, joined, loaded = set(self._sites), {}, {}
        self._joined = {site: float(stamp) for site, stamp in joined.items()
                        if isinstance(stamp, (int, float))}
        if known:
            for site in self._sites:
                if site not in known:
                    self._joined[site] = self._now()
        self._entries = {}
        for source, codes in (loaded.get('misses') or {}).items():
            if isinstance(codes, dict):
                self._entries[source] = {code: float(stamp) for code, stamp in codes.items()
                                         if isinstance(stamp, (int, float))}
        if ('cover' in self._entries
                and loaded.get('cover_catalog_rules') != upgrade_rules.OFFICIAL_COVER_CATALOG_MISSES):
            # FC2 商品图不查询官方综合目录，单站答复与这一目录判据无关。
            self._entries['cover'] = {
                code: stamp for code, stamp in self._entries.get('cover', {}).items()
                if code.upper().startswith('FC2-PPV-')}

    def fresh(self, source, code, lineup=()):
        """`source` 对 `code` 说过「没有」且还在期内。`lineup` 是这条记忆当时应当问过的几站：
        其中有一站是记下之后才接入的，这条就不作数。"""
        stamp = self._entries.get(source, {}).get(code)
        return (stamp is not None and self._now() - stamp < self._ttl
                and all(self._joined.get(site, 0.0) < stamp for site in lineup))

    def record(self, source, code):
        now = self._now()
        self._entries.setdefault(source, {})[code] = now
        _save(self._path, {
            'format': MISS_FORMAT, 'sites': self._sites,
            'cover_catalog_rules': upgrade_rules.OFFICIAL_COVER_CATALOG_MISSES,
            'joined': {site: stamp for site, stamp in self._joined.items() if now - stamp < self._ttl},
            'misses': {name: {key: stamp for key, stamp in codes.items() if now - stamp < self._ttl}
                       for name, codes in self._entries.items()}})


class _MetadataResults:
    """单站确认后发布证据，同一档的聚合回执只接纳新增取值。"""

    def __init__(self, remote, code, received):
        self.remote, self.code, self.received = remote, code, received
        self.entries = []
        self.known = {}

    def cached(self, entries):
        fresh = []
        for name, payload, path in entries:
            if self.known.get(name) != payload:
                self.known[name] = payload
                fresh.append((name, payload, path))
        self.entries.extend(fresh)
        if fresh:
            self.received(fresh)

    def save(self, found):
        try:
            entries = [self.remote._evidence(name, self.code, payload) for name, payload in found
                       if self.known.get(name) != payload]
            self.cached(entries)
        except InterruptedError:
            raise
        except OSError as error:
            raise _ProcessingPersistenceError('errors.libraryProcessing.evidenceNotSaved',
                                              {'error': str(error)}) from error


class _RemoteSession:
    """一个任务共用的外部来源连接，加上来源说过「没有」的记忆。"""

    def __init__(self, config, provider_factory, misses, *, retrying, recheck_existing=False, routes=None,
                 database=None):
        self._config = config
        self._factory = provider_factory
        self._provider = None
        self.misses = misses
        #: 用户对每种内容类型的来源链覆盖，形状见 `metadata_routes.parse_route_overrides`。
        self._routes = routes or None
        self.database = database
        # 定向重试或明确重采不看旧记忆；本次答复仍照记。
        self._consult = not (retrying or recheck_existing)
        self._task_evidence = {}
        self._task_absent = set()

    def provider(self):
        if self._provider is None:
            self._provider = (self._factory() if self._factory
                              else LibraryMetadataProvider(
                                  self._config.directory('secrets'), tools_root=self._config.directory('tools'),
                                  public_cache=self._config.directory('generated') / 'jav-public',
                                  wiki_root=self._config.directory('sources') / 'library-metadata' / 'seesaa-pages'))
        return self._provider

    def reset(self):
        if self._provider is not None and hasattr(self._provider, 'reset'):
            self._provider.reset()

    def budget_spent(self):
        """本趟采集预算到顶时的说明。还没建 provider（一问都没发）或它不设预算时是空串；
        只认字符串，替身 provider 自动长出来的属性不算到顶。"""
        check = getattr(self._provider, 'budget_spent', None)
        reason = check() if callable(check) else ''
        return reason if isinstance(reason, str) else ''

    def close(self):
        if self._provider is not None and hasattr(self._provider, 'close'):
            self._provider.close()

    def prepare(self, prepared, stages_of, update, *, cover_root=None, groups=None, offline=lambda: False):
        """只为本趟实际需要的来源准备工具，不消费单片查询预算。断网时不准备：装 amane 本身要联网。"""
        if self._factory or offline():
            return
        from . import metadata_amane
        from .scraping_access import paused_until
        required = []
        for row, code, verify, local_fields, *_rest in prepared:
            if not _scrapes_as_jav(row, code):
                continue
            allowed = stages_of(row['path'])
            missing = list(COLLECTED_FIELDS) if verify else _missing_fields(row, local_fields)
            chain = self._chain(code, *_studio_evidence(row))
            metadata = 'metadata' in allowed and bool(missing)
            cover = ('cover' in allowed and _asks_cover(code, *_studio_evidence(row))
                     and (cover_root is None or not cover_settled(cover_root / (code + '.jpg')))
                     and not self._fresh_miss('cover', code, chain))
            if not (metadata or cover):
                continue
            answered = () if verify or cover else _answered_sources(groups or {}, f"asset:{row['id']}", missing)
            members = self._askable([name for name in chain if name in metadata_amane.SITES], code, answered)
            cached = {name for name, *_ in self._cached_evidence(members, code)}
            if any(name not in cached and not paused_until(self._config.directory('secrets'), name)
                   for name in members):
                required.append(row['id'])
        if required:
            try:
                metadata_amane.ensure(self._config.directory('tools'),
                    secrets_root=self._config.directory('secrets'),
                    progress=lambda: update(**stage_fields('library.prepareSources'), current_action='preparing_sources',
                                            current_asset_id=None, current_asset_name='',
                                            current_started_at=time.time(), current_deadline_at=None))
            except metadata_amane.PreparationError as error:
                error.asset_ids = tuple(required)
                raise

    def collect(self, row, code, missing, cover_root, *, update, issue, answered=(), received=lambda entries: None,
                fetch_cover=True):
        """给这一行补外部资料与封面；返回 (证据条目, 新落盘的封面数)。

        `missing` 为空时不问资料，`fetch_cover` 为假时不找封面：媒体库处理方式关掉的那一步不联网。

        文件名被读成番号的创作者作品一家都不问，判据见 `catalog_rules.scrapes_as_jav`；
        本地海报在调用方那一步已经登记过，这里跳过的只是外部来源。`answered` 是在这一行
        已经给过候选的来源（`_answered_sources`），资料那一步不再问它们。
        """
        entries, covers = [], 0
        if not _scrapes_as_jav(row, code):
            return entries, covers
        chain = self._chain(code, *_studio_evidence(row))
        if self._asks_metadata(chain, code, missing, answered):
            entries = self._metadata(row, code, missing, update=update, issue=issue, answered=answered,
                                     received=received)
        if fetch_cover and _asks_cover(code, *_studio_evidence(row)) and not cover_settled(cover_root / (code + '.jpg')):
            snapshots, absent = self._cover_inputs(code, chain, entries)
            covers = self._cover(row, code, cover_root, update=update, issue=issue,
                                 snapshots=snapshots, absent=absent)
        return entries, covers

    def asks(self, row, code, missing, cover_root, *, answered=(), fetch_cover=True):
        """`collect` 这一行会不会去问外部来源，判据与它逐条相同。断网时只把要问的行记成未取得。"""
        if not _scrapes_as_jav(row, code):
            return False
        chain = self._chain(code, *_studio_evidence(row))
        return (self._asks_metadata(chain, code, missing, answered)
                or bool(fetch_cover and _asks_cover(code, *_studio_evidence(row))
                        and not cover_settled(cover_root / (code + '.jpg'))))

    def _asks_metadata(self, chain, code, missing, answered):
        # 链上剩下的站都给过候选或说过没有、且至少有一家给过候选：这一行不是「没取到」，
        # 只是没有新的可问，不进告知项。
        return bool(missing and chain and (self._askable(chain, code, answered)
                                           or not set(answered).intersection(chain)))

    def _cover_inputs(self, code, chain, entries):
        """封面那一步不必再问的：手上已有的快照 `[(来源, 资料)]`，与说过没有或不在链上的站。

        快照是资料那一步这一趟取到的，加上链上其余几站磁盘缓存里还新鲜的那份（给过候选而
        这一趟没问的来源就在那里）。资料那一步已经短路、没走到的站不在里面，封面那一步照旧会问。
        r18.dev 不在这个番号的链上时也算不必问：无码与判不准的番号在 r18.dev 上没有。
        """
        known = {name: payload for name, payload, _ in entries if name in SOURCE_SPECS}
        known.update((name, payload) for name, payload, _ in
                     self._cached_evidence([name for name in chain if name not in known], code))
        absent = {name for name in chain if self._fresh_miss(name, code)}
        return list(known.items()), absent | ({'r18dev'} - set(chain))

    def _evidence(self, source, code, payload):
        _save(self._evidence_path(code, source), payload)
        artifact_rules.remember(self._evidence_path(code, source), str(upgrade_rules.PROVIDER_EVIDENCE))
        entry = (source, payload, self._evidence_path(code, source))
        self._task_evidence[source, code] = entry
        return entry

    def _evidence_path(self, code, source):
        return self._config.directory('sources') / 'library-metadata' / f'{code}-{source}.json'

    def _cached_evidence(self, names, code):
        """这一档上次答过的原始快照；命中就不发请求。

        有效期与「说过没有」的记忆同一个（`MISS_TTL_SECONDS`，7 天）：来源会补录、
        片子可能后来上架，两边同时到期才不会出现「没有」已经过期、「有」还压着旧值。
        重试时首个同番号资产取得新答复，本趟的其他资产复用该答复。
        """
        found = []
        for name in names:
            if (name, code) in self._task_evidence:
                found.append(self._task_evidence[name, code])
                continue
            if not self._consult:
                continue
            path = self._evidence_path(code, name)
            try:
                if not artifact_rules.current(path, str(upgrade_rules.PROVIDER_EVIDENCE)):
                    continue
                if time.time() - path.stat().st_mtime > MISS_TTL_SECONDS:
                    continue
                payload = json.loads(path.read_text(encoding='utf-8'))
                if name == 'javdb':
                    from .javdb_identity import current_evidence
                    if not current_evidence(payload):
                        continue
                if not source_text_is_valid(payload):
                    continue
                entry = (name, payload, path)
                self._task_evidence[name, code] = entry
                found.append(entry)
            except (OSError, ValueError):
                continue
        return found

    def _fresh_miss(self, source, code, lineup=()):
        return ((source, code, tuple(lineup)) in self._task_absent
                or self._consult and self.misses.fresh(source, code, lineup))

    def _record_miss(self, source, code, lineup=()):
        self.misses.record(source, code)
        self._task_absent.add((source, code, tuple(lineup)))

    def _askable(self, members, code, answered=()):
        """一档成员里这一行还该问的：没给过候选（`answered`），也没在一周内说过「没有」。

        「没有」的记忆按站记：一档里说过没有的站摘掉，全档都说过就整档跳过。
        重试不看历史记忆，本趟答复与已给候选仍复用。
        """
        return tuple(name for name in members if name not in answered
                     and not self._fresh_miss(name, code))

    def _custom_sources(self, code, *evidence):
        from .custom_metadata import load
        kind = metadata_routes.classify(code, *evidence)
        return [entry for entry in load(self._config.directory('secrets'))
                if entry['enabled'] and kind in entry['content_types']]

    def _chain(self, code, *evidence):
        from .custom_metadata import source_key
        chain = metadata_routes.route_for_code(code, *evidence, overrides=self._routes)
        return (*chain, *(source_key(entry) for entry in self._custom_sources(code, *evidence)))

    def _ask(self, source, code, members, cached, *, required, deadline, evidence, received=lambda found: None):
        """问链上的一档：按档名分派到 provider 对应的入口，返回这一档答上的 `[(来源, 资料)]`。

        `members` 是这一档里这一行还该问的站（`_askable`），`cached` 是这一档缓存里已有的快照：
        FC2 那一档把它们当作已答上的几处交下去，只补问缺演员时的镜像站。
        """
        if source.startswith('custom-'):
            from .custom_metadata import query, source_key
            config = next((entry for entry in self._custom_sources(code, *evidence) if source_key(entry) == source), None)
            return [(source, query(config, code, deadline=deadline,
                                   secrets_root=self._config.directory('secrets')).payload())] if config else []
        provider = self.provider()
        if source in ('r18dev', 'dmm'):
            return [(source, provider.query(code, source, deadline=deadline))]
        if source == 'fc2':
            answered = {name for name, _, _ in cached}
            return provider.fc2(code, deadline=deadline, required=required,
                                route=tuple(name for name in members if name not in answered),
                                known=[payload for _, payload, _ in cached], received=received)
        if source == '1pondo':
            return provider.one_pondo(code, deadline=deadline)
        if source in ('amane', 'amane_official'):
            return provider.amane(code, deadline=deadline, route=members)
        if source in metadata_routes.WIKI_STAGE:
            return provider.wiki(source, code, deadline=deadline)
        route = metadata_routes.community_route(code, *evidence, overrides=self._routes)
        return provider.community(code, deadline=deadline,
                                  route=tuple(name for name in route if name in members), received=received)

    def _metadata(self, row, code, missing, *, update, issue, answered=(), received=lambda entries: None):
        """按内容类型的来源链逐档问，必填标量字段够了就不问下一档。

        链在 `metadata_routes`：有码先问片商官网、素人先问 MGStage（经 amane 桥，ADR-0048），
        再问 r18.dev；无码问一本道官网（本机证据指着它时），FC2 优先匿名 JavDB，
        缺字段或演员身份未确认时再问发行方商品页与专站（ADR-0150）。

        有码缺标签时另取 JavDB 类别；标量已经齐全时只补这一家，不扩展其他社区查询。

        短路判据是**这一行还缺的必填标量**（标题、演员、厂牌、发行日期），不是「有人答了
        就算」：r18.dev 少给演员时照旧往下问，否则那一行只能等人工去填。列表字段（标签、
        封面）不参与短路——多一家就多一批标签和一个图源，而免复核本来就要两家一致
        （ADR-0030、ADR-0034）、封面互证要两个图源（ADR-0032）。例外有两条：缺标签的行
        在官方档之间多问一家（`metadata_routes.settles` 的 `wants_tags`）；素人缺演员的行，
        MGStage 给了素人名义也接着问认人 Wiki，直到有一个 Wiki 给出演员（`wants_cast`，ADR-0145）；
        两个 Wiki 都没给时，MGStage 给的字段够了就停，不落到综合索引。

        社区那一档的值照常进候选，只剩一家也补空，几家不一时按字段优先级链取：FC2 的演员栏
        取 fc2cmadb，素人的演员栏取认人 Wiki，其余取 javdb（ADR-0034、ADR-0038、ADR-0145）。
        「没有」的记忆按站记：一档里说过没有的站一周内不再问，全档都说过就直接问下一档。
        """
        action = 'querying_metadata'
        budget = ACTION_BUDGETS[action]
        update(**stage_fields('library.fetchMetadata'), current_action=action,
               current_started_at=time.time(), current_deadline_at=time.time() + budget)
        deadline = deadline_after(budget)
        mark = _excused(self._provider)
        evidence = _studio_evidence(row)
        chain = self._chain(code, *evidence)
        required = metadata_routes.required_scalars(missing, code=code)
        wants_tags = 'tags' in missing
        # 素人缺演员：MGStage 给的是素人名义，直到有一个认人 Wiki 给出演员才算问到（ADR-0145）。
        wants_cast = 'performers' in missing and any(name in metadata_routes.WIKI_STAGE for name in chain)
        results = _MetadataResults(self, code, received)
        problems, held, entries = [], [], results.entries
        failures = []
        attempted = set(answered)
        stages = metadata_routes.stages_for_chain(chain)
        for source, then in zip(stages, (*stages[1:], '')):
            members = self._askable(metadata_routes.stage_members(source, chain), code, answered)
            if not members:
                continue
            attempted.update(members)
            cached = self._cached_evidence(members, code)
            if cached:
                results.cached(cached)
                if source in metadata_routes.WIKI_STAGE and any(entry[1].get('actresses') for entry in cached):
                    wants_cast = False
                if metadata_routes.settles(required, self._provided(code, entries),
                                           wants_tags=wants_tags, wants_cast=wants_cast, then=then):
                    break
                # FC2 那一档缓存里只有官方那页时，缺的演员还得去镜像站问（见 `fc2()`）。
                if source != 'fc2':
                    continue
            try:
                # 浏览器来源等人点验证的那段不算进这部片的预算（`LibraryMetadataProvider.excused`）。
                update(current_source={'key': source, 'label': PROVIDER_NAMES.get(source, source)})
                found = self._ask(source, code, members, cached, required=required, evidence=evidence,
                                  deadline=_extended(deadline, _excused(self._provider) - mark),
                                  received=results.save)
            except DeadlineExceeded:
                self.reset()
                if entries:
                    break
                issue(row, phrase('errors.libraryProcessing.deadlineRetryLater'), action=action, retryable=True)
                return []
            except Exception as error:
                _raise_task_failure(error)
                if is_missing(error):
                    for name in getattr(error, 'sites', None) or members:
                        self._record_miss(name, code)
                else:
                    # 社区那一档的原因里已经写明是哪一家了（`community()` 逐家拼过），再套一层
                    # 就成了「社区来源：javdb：…」。单家来源的原因不带来源名，这里补上。
                    problems.append(describe_failure(error)
                                    if source in ('community', 'amane', 'amane_official')
                                    else phrase('errors.libraryProcessing.sourceProblem',
                                                {'source': source_name(source), 'problem': describe_failure(error)}))
                    failures.append(_source_failure_details(error, code, action, source=source))
                    held.append(source_paused(error))
                # 认人 Wiki 没给出演员时，MGStage 给的字段够停手就停，不为它落到综合索引那条 3 秒的队。
                if source in metadata_routes.WIKI_STAGE and metadata_routes.settles(
                        required, self._provided(code, entries), wants_tags=wants_tags,
                        wants_cast=wants_cast, then=then):
                    break
                continue
            update(**stage_fields('library.saveCandidates'))
            results.save(found)
            # 来源快照的演员栏键名是 `actresses`（`SiteRecord.payload`）。
            if source in metadata_routes.WIKI_STAGE and any(payload.get('actresses') for _, payload in found):
                wants_cast = False
            if metadata_routes.settles(required, self._provided(code, entries),
                                       wants_tags=wants_tags, wants_cast=wants_cast, then=then):
                break
        tag_entries = self._preferred_tags(row, code, missing, chain, entries, attempted,
            update=update, issue=issue, deadline=_extended(deadline, _excused(self._provider) - mark))
        results.cached(tag_entries)
        if entries:
            return entries
        # 链上任何一档还在正常作答，这一行就是真没取到；全被限住时才算没轮到。
        paused = bool(held) and all(held)
        issue(row, phrase('errors.libraryProcessing.metadataPaused' if paused
                          else 'errors.libraryProcessing.metadataUnfetched', {'problems': joined_phrases(problems)})
              if problems else MISS_MESSAGES[action],
              action=action, retryable=True, paused=paused,
              **({'diagnostics': {'failures': failures}} if failures else {}))
        return []

    def _provided(self, code, entries):
        from .metadata_alias_resolve import stage_name
        given = _given_fields(entries)
        if metadata_routes.classify(code) != 'fc2' or 'performers' not in given:
            return given
        for source, payload, _path in entries:
            performers = extract_peach_fields(payload).get('performers', {}).get('value')
            if performers and (_confirmed_cast(self.database, performers) or (
                    source != 'javdb' and all(stage_name(person['name']) for person in performers))):
                return given
        return given - {'performers'}

    def _preferred_tags(self, row, code, missing, chain, entries, answered, *, update, issue, deadline):
        """缺标签的有码作品补取 JavDB；已取证、路由排除或缺失记忆命中时直接返回。"""
        source = preferred_tag_source(code)
        if ('tags' not in missing or source not in chain
                or source in {entry[0] for entry in entries}
                or not self._askable((source,), code, answered)):
            return []
        cached = self._cached_evidence((source,), code)
        if cached:
            return cached
        try:
            payload = self.provider().query(code, source, deadline=deadline)
        except Exception as error:
            _raise_task_failure(error)
            # 链上官方来源这一趟已经给了标签时，JavDB 只是换一批更细的类别；取不到就先用官方标签，
            # 和其他已有标签、不再问 JavDB 的作品一样，不算这部片的问题。
            settled = 'tags' in _given_fields(entries)
            if isinstance(error, DeadlineExceeded):
                self.reset()
                if not settled:
                    issue(row, phrase('errors.libraryProcessing.javdbTagsDeadline'), action='querying_metadata',
                          retryable=True)
            elif is_missing(error):
                self._record_miss(source, code)
            elif not settled:
                issue(row, phrase('errors.libraryProcessing.javdbTagsUnfetched', {'problem': describe_failure(error)}),
                      action='querying_metadata', retryable=True, paused=source_paused(error),
                      diagnostics=_source_failure_details(error, code, 'querying_metadata', source=source))
            return []
        update(**stage_fields('library.saveCandidates'))
        return [self._evidence(source, code, payload)]

    def _cover(self, row, code, cover_root, *, update, issue, snapshots=(), absent=()):
        action = 'fetching_cover'
        # 「封面没有」是这条链上各站合起来的答复：链上有一站是记下之后才接入的，就再问一遍。
        lineup = metadata_routes.route_for_code(code, *_studio_evidence(row), overrides=self._routes)
        if self._fresh_miss('cover', code, lineup):
            # 已经有一张小图的不算问题项：卡片上有封面，只是还没换到更大的。
            if measure_image_file(cover_root / (code + '.jpg')) is None:
                issue(row, MISS_MESSAGES[action], action=action, retryable=True)
            return 0
        budget = ACTION_BUDGETS[action]
        update(**stage_fields('library.fetchCovers'), current_action=action,
               current_started_at=time.time(), current_deadline_at=time.time() + budget, current_source=None)
        try:
            return int(self.provider().cover(code, cover_root, deadline=deadline_after(budget),
                                             evidence=_studio_evidence(row), snapshots=snapshots,
                                             absent=absent))
        except DeadlineExceeded:
            self.reset()
            issue(row, phrase('errors.libraryProcessing.coverDeadline'), action=action, retryable=True)
        except CoverKept:
            self._record_miss('cover', code, lineup)
        except NotFound:
            self._record_miss('cover', code, lineup)
            issue(row, MISS_MESSAGES[action], action=action, retryable=True)
        except Exception as error:
            _raise_task_failure(error)
            paused = source_paused(error)
            issue(row, phrase('errors.libraryProcessing.coverPaused' if paused
                              else 'errors.libraryProcessing.coverUnfetched', {'problem': describe_failure(error)}),
                  action=action, retryable=True, paused=paused,
                  diagnostics=_source_failure_details(error, code, action))
        return 0


def _apply_finished_candidates(database, candidate_root, active, asset_ids=None, candidate_rows=None):
    """候选落盘后立即执行窄规则自动落库；没有账本实例时只采集候选。

    停止后一条都不再写：任务已经不属于这次运行，用户按下停止之后账本还在变，
    是这个功能最难解释的一种表现。
    """
    if database is None or not active():
        return {'applied': 0, 'auto_rejected': 0}
    from .jav_cover_fetch import DEFAULT_METADATA_ROOT
    from .metadata_auto_apply import auto_apply_metadata
    # 快照目录是企划名义解析的证据来源（ADR-0038）。路径只有 `DEFAULT_METADATA_ROOT`
    # 一份定义，这里传它而不是再拼一次：两处各拼一份，改 Peach 数据目录时会有一处留在原地。
    return auto_apply_metadata(database, Path(candidate_root), active=active,
                               snapshot_root=DEFAULT_METADATA_ROOT, asset_ids=asset_ids,
                               candidate_rows=candidate_rows)


def _enrich_finished_performers(database, groups, config, candidate_root, remote, active,
                                update=lambda **values: None,
                                issue=lambda asset, message, **options: None):
    """自动落库启用时补同一人物的资料；只采集候选时保持完全只读。"""
    empty = {'aliases': 0, 'avatars': 0, 'conflicts': 0, 'failed': 0}
    if database is None or not active():
        return empty
    from .metadata_performer_profiles import enrich_performer_profiles
    from .jav_cover_fetch import HostLimitedTransport
    from .scraping_access import SourceTransport

    def profile_transport():
        return HostLimitedTransport(
            SourceTransport(config.directory('secrets'), max_requests=MAX_SOURCE_REQUESTS,
                            max_bytes=MAX_SOURCE_BYTES, max_seconds=MAX_SOURCE_SECONDS),
            2.0, limiter=SOURCE_LIMITER)
    # 问题清单要的是这条资产的 id 和路径，候选行上都有。
    rows = {int(group['asset_id']): {'id': int(group['asset_id']),
                                     'path': group.get('asset_path') or ''}
            for group in groups.values() if str(group.get('asset_id') or '').isdigit()}
    return enrich_performer_profiles(
        database, groups.values(), config.directory('generated') / 'avatars',
        candidate_root / 'provider-cache' / 'performer-avatars',
        transport_factory=profile_transport,
        active=active, progress=update,
        # 头像取不到是可重试的：下一次「重试失败项」会连着这条资产一起再来一遍。
        issue=lambda asset_id, message: issue(rows.get(asset_id), message,
                                              action='fetching_cover', retryable=True),
    )


def _entity_watermark(database):
    """刮削开工前实体表的水位。拿不到就返回 None，后面据此整段跳过。"""
    if database is None:
        return None
    try:
        with database.read_connection() as connection:
            row = connection.execute("SELECT max(id) FROM entity").fetchone()
    except sqlite3.Error:
        return None
    return int(row[0] or 0)


def _entity_followups(database, config, watermark, covered=(), *, include_stock=True):
    """这一轮新登记的实体缺什么就补什么，一件事一条后继（ADR-0040、ADR-0052）。

    女优没有头像的派补头像后继；`covered` 是每行换上的封面张数，换上了的作品，它们的
    女优也算进来（`avatar_followup.plan`）。厂牌盘上没有图的派补厂牌后继
    （`studio_followup.plan`），官网与标识在那一条里一起补。新女优另派一条补别名后继
    （`performer_alias_followup.plan`，ADR-0055）与一条补女优资料后继
    （`performer_profile_followup.plan`，ADR-0067）。新创作者派一条查身份后继
    （`creator_identity_followup.plan`，ADR-0098）。

    这一轮的名额（`MAX_FOLLOWUPS`）先给新登记的，余下的给库里早就登记的存量（ADR-0053）：
    补别名与补女优资料各留出至多自己的 `STOCK_SHARE` 条，厂牌与创作者身份先各取至多自己的
    那一份，其余给女优头像。补别名的存量先排缺头像的女优（ADR-0072）。
    存量每轮往前推一截，跑过又没变的不再派。

    只声明，不执行：派发在调用方结算这一轮时发生，真正去跑的是 `followups` 那一层。
    这里出任何问题都只让这一轮不派后继，不影响刮削本身的结论。
    """
    if database is None or watermark is None:
        return []
    from . import (avatar_followup, creator_identity_followup, performer_alias_followup,
                   performer_profile_followup, seed_followup, studio_followup)
    from .followups import Attempts, attempts_root
    from .task_runs import MAX_FOLLOWUPS
    generated = config.directory('generated')
    attempts = Attempts(attempts_root(generated))
    try:
        with database.read_connection() as connection:
            # 随版本附带的实体种子（ADR-0075）排在最前：一轮至多一条，永远在名额之内。
            found = seed_followup.plan(connection, since_entity_id=watermark)
            found += avatar_followup.plan(
                connection, generated / 'avatars', since_entity_id=watermark,
                covered_asset_ids=[asset_id for asset_id, count in covered if count])
            found += studio_followup.plan(connection, generated / 'logos',
                                          since_entity_id=watermark)
            found += performer_alias_followup.plan(connection, since_entity_id=watermark)
            found += performer_profile_followup.plan(connection, since_entity_id=watermark)
            found += creator_identity_followup.plan(connection, since_entity_id=watermark)
            if not include_stock:
                return [item.declared() for item in found]
            taken = {item.key for item in found}
            aliases = min(performer_alias_followup.STOCK_SHARE, max(0, MAX_FOLLOWUPS - len(found)))
            profiles = min(performer_profile_followup.STOCK_SHARE,
                           max(0, MAX_FOLLOWUPS - len(found) - aliases))
            found += studio_followup.stock(
                connection, generated / 'logos', attempts,
                limit=min(studio_followup.STOCK_SHARE,
                          max(0, MAX_FOLLOWUPS - len(found) - aliases - profiles)),
                skip=taken)
            found += creator_identity_followup.stock(
                connection, attempts,
                limit=min(creator_identity_followup.STOCK_SHARE,
                          max(0, MAX_FOLLOWUPS - len(found) - aliases - profiles)),
                skip=taken)
            found += avatar_followup.stock(connection, generated / 'avatars', attempts,
                                           limit=MAX_FOLLOWUPS - len(found) - aliases - profiles,
                                           skip=taken)
            found += performer_alias_followup.stock(
                connection, attempts, limit=min(aliases, MAX_FOLLOWUPS - len(found)), skip=taken,
                avatar_root=generated / 'avatars')
            found += performer_profile_followup.stock(
                connection, attempts, limit=min(profiles, MAX_FOLLOWUPS - len(found)), skip=taken)
    except sqlite3.Error:
        return []
    return [item.declared() for item in found]


def _ffprobe_path(config):
    """数据目录里那份 ffprobe，没有就退到 PATH；都没有回 `None`，扫描照常、只是不探。"""
    choice = FFmpegResolver(config.directory('tools') / 'ffmpeg').ffprobe()
    return str(choice.path) if choice else None


def _chosen_asset_paths(db_path, asset_ids):
    """定向重试只关心这批资产所在的来源根。

    配置里其他来源离线不能让一条已落地的云下载后处理失败；
    如果离线的正是目标资产所在的根，仍保留原有的离线问题。
    """
    if not asset_ids:
        return {}
    with closing(sqlite3.connect(db_path, timeout=30)) as connection:
        rows = connection.execute(
            "SELECT location,path FROM asset WHERE id IN (SELECT value FROM json_each(?)) "
            "AND medium='video' AND disposal IS NULL", (json.dumps(asset_ids),)).fetchall()
    chosen = {}
    for source, path in rows:
        chosen.setdefault(str(source), []).append(translate_ledger_path(path))
    return {source: tuple(paths) for source, paths in chosen.items()}


def _within_processing_root(path, root):
    """按资源身份比较归属，不为逐影片筛选访问挂载目录。"""
    from .platform import within_root
    from .smb_media import SmbResource
    if isinstance(path, SmbResource) or isinstance(root, SmbResource):
        return within_root(path, root)
    return path.is_relative_to(root)


def _online_source_root(source, root, chosen_paths, *, retrying, issue):
    translated_root = translate_ledger_path(root)
    relevant = not retrying or any(
        _within_processing_root(path, translated_root)
        for path in chosen_paths.get(source, ()))
    if not relevant:
        return None
    try:
        if root_online(translated_root):
            return translated_root
    except InterruptedError:
        raise
    except OSError as error:
        issue(None, phrase('errors.libraryProcessing.sourceRootUnreadable', {'source': source, 'error': str(error)}),
              action='reading_local')
        return None
    issue(None, phrase('errors.libraryProcessing.sourceRootOffline', {'source': source}), action='reading_local')
    return None


@dataclass
class _SourceScan:
    online_roots: list[Path]
    scanned: int = 0
    probed: int = 0
    scanned_bytes: int = 0
    junk_isolated: int = 0
    new_ids: tuple[int, ...] = ()


def _scan_sources(config, db_path, *, locations, asset_ids, stage, guard, update, issue,
                  scan_checkpoints=None, save_checkpoint=lambda: None, initial_probed=0, incremental=False,
                  allow_metered=False):
    """发现本趟可访问的来源根，按阶段登记文件并探测新视频。"""
    result = _SourceScan([], probed=initial_probed)
    def count_junk(checked):
        result.junk_isolated += checked['isolated']
    scan_checkpoints = scan_checkpoints if scan_checkpoints is not None else {}
    chosen_paths = _chosen_asset_paths(db_path, asset_ids)
    scan = asset_ids is None and stage in (ALL_STAGES, SCAN_STAGE)
    mounts = {key: tuple(str(value) for value in values) for key, values in config.mounts.items()}
    ffprobe = _ffprobe_path(config) if stage == SCAN_STAGE else None
    for source, roots in locations.items():
        if stage == PREVIEWS_STAGE and source == 'online':
            continue
        for root in roots:
            guard.check()
            # 只补预览不碰开了流量保护的目录，连目录在不在线都不探，除非这一趟显式授权了计费读取。
            if stage == PREVIEWS_STAGE and not allow_metered and cost_for(source, root, config) == 'metered':
                continue
            translated_root = _online_source_root(
                source, root, chosen_paths, retrying=asset_ids is not None, issue=issue)
            if translated_root is None:
                continue
            result.online_roots.append(translated_root)
            if scan:
                key = f'{source}:{PureWindowsPath(root)}'.casefold()
                def remember(value, key=key):
                    scan_checkpoints[key] = value
                    save_checkpoint()
                registered = scan_location(db_path, source, root, declared_roots=config.locations,
                                           mounts=mounts, report=lambda line: None,
                                           read_directory=partial(directory_entries, file_identity=source == 'local'),
                                           onerror=lambda error: issue(None, said_of(error), action='scanning_files'),
                                           resume_state=scan_checkpoints.get(key), save_checkpoint=remember,
                                           new_only=incremental,
                                           progress=lambda files, size: update(
                                               **stage_fields('library.scanFiles'), scanned=result.scanned + files,
                                               scanned_bytes=result.scanned_bytes + size,
                                               checked=0, total=0, current_action='scanning_files'))
                result.scanned += registered.files
                result.scanned_bytes += registered.total_bytes
                result.junk_isolated += registered.junk_isolated
                result.new_ids += registered.new_ids
                if stage == SCAN_STAGE:
                    result.probed += probe_unmeasured(
                        db_path, ffprobe, source, root, config=config,
                        on_junk=count_junk,
                        asset_ids=[*registered.new_ids, *registered.relocated_ids] if incremental else None,
                        report=lambda done, total: update(**stage_fields('library.probeMedia'),
                            checked=result.probed + done, total=result.probed + total, probed=result.probed + done))
                reattach_in(db_path, registered.new_ids)
                update(scanned=result.scanned, probed=result.probed)
    return result


def _probe_sources(config, db_path, locations, online_roots, asset_ids, update, *, total_pending=0,
                   initial_probed=0, protected_ids=(), on_junk=lambda result: None):
    """已登记视频按可访问来源逐项读取媒体属性；媒体库处理方式不读视频信息的根目录跳过。"""
    probed = initial_probed
    checked = initial_probed
    ffprobe = _ffprobe_path(config)
    stages = media_identity.stages_by_root(config)
    def report(done, total):
        update(**stage_fields('library.probeMedia'), checked=checked + done, probed=checked + done,
               total=max(initial_probed + total_pending, checked + total))
    for source, roots in locations.items():
        for root in roots:
            if 'probe' not in stages.get(media_identity.path_key(root), media_identity.STAGES):
                continue
            if translate_ledger_path(root) in online_roots:
                probed += probe_unmeasured(
                    db_path, ffprobe, source, root, asset_ids=asset_ids, config=config,
                    report=report, protected_ids=protected_ids, on_junk=on_junk)
                checked = probed
    update(probed=probed)
    return probed


def _library_stages(config):
    """按作品账本路径查所属媒体库要做的处理步骤（ADR-0116）；不在已配置根目录下的按自动补全。"""
    from .platform import resolve_root
    by_root = media_identity.stages_by_root(config)
    every = frozenset(media_identity.STAGES)

    def stages_of(path):
        location, index, _tail = resolve_root(path, config.locations)
        if location is None:
            return every
        return by_root.get(media_identity.path_key(config.locations[location][index]), every)
    return stages_of


def _people_allowed(config):
    """有没有哪个媒体库的处理方式联网补人物图片；都没有时整轮不补人物资料、不派实体后继。"""
    return any('people' in stages for stages in media_identity.stages_by_root(config).values())


class _NetworkGate:
    """外部采集用的断网判定，`network` 是 `NetworkReachability`，不给就永远算联网。

    只有两次探测都连不上（`offline`）才算断网；代理设置待选（`unknown`）照常采集，判不准的
    结论不拦。`skipped` 是这一趟因断网跳过的行数，续跑时接着上次的数。
    """

    def __init__(self, network, skipped=0):
        self.network, self.skipped = network, skipped

    def probe(self, update):
        """外部采集开始前当场探一次。快照可能是十分钟前的，断网时这一下最多等约 20 秒。

        探测线程顺带拉起：断网首扫之后没人打开页面，联网恢复也要有人发现。"""
        if self.network is None:
            return
        update(**stage_fields('library.checkNetwork'), current_action='', current_started_at=None, current_deadline_at=None)
        self.network.tick()
        self.network.start()

    def offline(self):
        return self.network is not None and self.network.summary().get('state') == 'offline'

    def skips(self, remote, row, code, missing, allowed, cover_root, *, answered, issue):
        """断网时这一行要出网就不去问，记成可重试的未取得；不出网的行照常走完。"""
        if not self.offline() or not remote.asks(row, code, missing if 'metadata' in allowed else [],
                                                 cover_root, answered=answered,
                                                 fetch_cover='cover' in allowed):
            return False
        issue(row, OFFLINE_MESSAGE, action='network_offline', retryable=True)
        self.skipped += 1
        return True


class _SourceBudget:
    """整趟采集预算（`MAX_SOURCE_*`）到顶后，后面要出网的行一家都不问。

    预算按任务算，换连接、暂停再继续都不重置。到顶之后每一问都只会回同一句「本趟已用完」，
    逐行再问只是空转，还把这一句按来源各记一遍，几千条问题项盖住了真正的原因。
    跳过的行不各记问题项：只进可重试名单（「重试失败项」接着采、增量处理不当它已完成）和
    来源未轮到名单（升级补全据此延后），收尾时由 `summarize` 记一条汇总。
    `state` 里的 `budget_skipped`、`budget_reason` 续跑时接着上次的数。
    """

    def __init__(self, remote, state):
        self.remote, self.state = remote, state
        self.skipped_row = None

    def skips(self, row, code, missing, allowed, cover_root, *, answered):
        reason = self.remote.budget_spent()
        if not reason or not self.remote.asks(row, code, missing if 'metadata' in allowed else [],
                                              cover_root, answered=answered,
                                              fetch_cover='cover' in allowed):
            return False
        self.skipped_row = row['id']
        self.state['budget_reason'] = reason
        self.state['budget_skipped'] = self.state.get('budget_skipped', 0) + 1
        for key in ('retryable_asset_ids', 'paused_asset_ids'):
            ids = self.state.setdefault(key, [])
            if row['id'] not in ids:
                ids.append(row['id'])
        return True

    def checkpointed(self, row, entries):
        """这一行要记进完成断点的证据。预算到顶没去问的行一条都不记：它只是没轮到，
        续跑和增量处理都还要再问。"""
        return [] if row['id'] == self.skipped_row else entries

    def summarize(self, issue):
        said = budget_summary(self.state)
        if said:
            issue(None, said, action='source_budget')


def budget_summary(state):
    """预算到顶跳过了几部时，任务卡与问题清单上的那一句（`phrase`）；没跳过是 None。"""
    skipped = state.get('budget_skipped') or 0
    if not skipped:
        return None
    from .scraping_access import BUDGET_SPENT
    # `budget_reason` 是 `BUDGET_SPENT` 的 code；认不出的（升级前按原句记下的）按时间到顶说。
    reason = state.get('budget_reason')
    kind = next((key for key, code in BUDGET_SPENT.items() if code == reason), 'seconds')
    return phrase('labels.libraryProcessing.budgetSkipped', {'head': phrase(_BUDGET_HEADS[kind]), 'count': skipped})


#: 预算三项到顶时汇总句的开头，键与 `scraping_access.BUDGET_SPENT` 一致。
_BUDGET_HEADS = {'requests': 'labels.libraryProcessing.budget.requests',
                 'seconds': 'labels.libraryProcessing.budget.seconds',
                 'bytes': 'labels.libraryProcessing.budget.bytes'}


def _collect_allowed(remote, traffic, row, code, missing, allowed, cover_root, covered, *,
                     update, issue, answered, received, succeeded, gate=_NetworkGate(None), budget=None):
    """按这一行所属媒体库的处理方式问外部来源（ADR-0116），返回 (证据条目, 新落盘的封面数)。

    关掉的联网步骤不问：不补资料时不带缺失字段，不补封面时不找封面，两样都关就整行不联网。
    不补人物图片的媒体库，这一行换上的封面不记进 `covered`，不因此派补头像后继。
    断网（`gate`）时要出网的行一家都不问，留一条问题项，不进断点；本趟预算到顶（`budget`）时
    同样不问，计进 `budget` 的汇总。"""
    found, covers = [], 0
    if gate.skips(remote, row, code, missing, allowed, cover_root, answered=answered, issue=issue):
        return found, covers
    if budget is not None and budget.skips(row, code, missing, allowed, cover_root, answered=answered):
        return found, covers
    if allowed & {'metadata', 'cover'}:
        traffic.start_metadata(code)
        try:
            with processing_item(row['id']):
                found, covers = remote.collect(row, code, missing if 'metadata' in allowed else [], cover_root,
                                               update=update, issue=issue, answered=answered, received=received,
                                               fetch_cover='cover' in allowed)
        except ItemSkipped:
            remote.reset()
            issue(row, phrase('errors.libraryProcessing.itemSkipped'), action='skipped', retryable=True)
        finally:
            traffic.finish_work('metadata', code, successful=succeeded())
            update(current_source=None)
    if 'people' in allowed:
        covered.append((row['id'], covers))
    return found, covers


def _check_processing_junk(database, locations, online_roots, asset_ids, protected_ids, state, update):
    """只检查本趟可访问目录或显式选择，并把隔离与复核计数记进可恢复状态。"""
    roots = [(source, root) for source, paths in locations.items() for root in paths
             if translate_ledger_path(root) in online_roots]
    checked = junk.isolate(database, asset_ids=asset_ids, roots=roots, protected_ids=protected_ids)
    update(junk_isolated=state.get('junk_isolated', 0) + checked['isolated'],
           junk_review=checked['review'])


def _prepare_processing_media(config, db_path, database, locations, sources, asset_ids,
                              protected_ids, stage, state, update):
    """在配套资料、预览和联网采集前检查已知证据，补媒体测量后重新检查。"""
    update(**stage_fields('library.checkJunk'), checked=0, total=0)
    _check_processing_junk(database, locations, sources.online_roots, asset_ids, protected_ids, state, update)
    if stage in (ALL_STAGES, COLLECT_STAGE, PREVIEWS_STAGE):
        _probe_sources(config, db_path, locations, sources.online_roots, asset_ids, update,
                       initial_probed=state['probed'], protected_ids=protected_ids,
                       on_junk=lambda result: update(junk_isolated=state['junk_isolated'] + result['isolated']))
        update(**stage_fields('library.recheckJunk'), checked=0, total=0)
        _check_processing_junk(database, locations, sources.online_roots, asset_ids, protected_ids, state, update)


def _active_prepared(database, prepared):
    """媒体处理后的活动视频携带最新测量值，已隔离或被用户移出的条目不继续采集。"""
    if not prepared:
        return []
    ids = [row[0]['id'] for row in prepared]
    with database.read_connection() as connection:
        current = {}
        for start in range(0, len(ids), 500):
            batch = ids[start:start + 500]
            current.update((row['id'], dict(row)) for row in connection.execute(
                "SELECT * FROM asset WHERE disposal IS NULL AND id IN (" + ','.join('?' for _ in batch) + ')', batch))
    return [(dict(item[0], **current[item[0]['id']]), *item[1:]) for item in prepared
            if item[0]['id'] in current]


def _collection_rows(db_path, *, locations, online_roots, asset_ids):
    """读取可访问视频与采集所需的演员、内容标签和已收录 genre。"""
    multi = ("(SELECT group_concat(entity.canonical_name) FROM asset_entity"
             " JOIN entity ON entity.id=asset_entity.entity_id"
             " WHERE asset_entity.asset_id=asset.id AND entity.kind='performer') AS performers,"
             " (SELECT group_concat(asset_tag.tag) FROM asset_tag"
             " WHERE asset_tag.asset_id=asset.id AND asset_tag.tag NOT LIKE ?) AS tags")
    query = f"SELECT asset.*, {multi} FROM asset WHERE medium='video' AND disposal IS NULL"
    parameters = [PERFORMER_TAG_PREFIX + '%']
    if asset_ids is not None:
        query += ' AND id IN (SELECT value FROM json_each(?))'
        parameters.append(json.dumps(asset_ids))
    query += ' ORDER BY id'
    library_roots = tuple(root for roots in locations.values() for root in roots)
    with closing(sqlite3.connect(db_path, timeout=30)) as connection:
        connection.row_factory = sqlite3.Row
        # 路径归属只比字面，避免逐行 resolve() 访问挂载服务。
        rows = [dict(row) for row in connection.execute(query, parameters)
                if not is_local_extra(row['name'], row['path'],
                                      library_roots=library_roots)
                and row['location'] in locations
                and any(_within_processing_root(translate_ledger_path(row['path']), root) for root in online_roots)]
        genre_decisions = load_genre_decisions(connection)
    return rows, genre_decisions


def _processing_issue_log(config, path, job_id, isolated, *, resume=False):
    """每趟任务保留独立问题清单，仅初始化本趟文件。"""
    log_path = path.with_suffix('.issues.jsonl') if isolated else issues_path(config, job_id)
    if not resume:
        log_path.unlink(missing_ok=True)
    return log_path


def _candidate_scope(groups, asset_ids):
    """按资产选择候选，保留共享 CSV 中其余资产的记录。"""
    if asset_ids is None:
        return groups
    chosen = {str(value) for value in asset_ids}
    return {key: value for key, value in groups.items()
            if str(value.get('asset_id') or '') in chosen}


def _finish_collection(config, database, candidate_root, cover_root, groups, remote, *,
                       asset_ids, active, update, issue, watermark, covered, people=True, offline=False):
    """结算本趟候选并补人物资料，全库任务同时推进存量后继。

    `people` 为假（没有哪个媒体库的处理方式联网补人物图片）时不补人物资料，也不派实体后继。
    `offline` 为真时只跳过补人物资料：后继照派，这一趟登记的实体过了这一趟就不再算新登记，
    恢复后的重试趟派不到它们。"""
    auto_apply = _apply_finished_candidates(database, candidate_root, active, asset_ids)
    profiles = (_enrich_finished_performers(
        database, _candidate_scope(groups, asset_ids), config, candidate_root, remote, active, update, issue)
        if people and not offline else dict(aliases=0, avatars=0, conflicts=0, failed=0))
    followups = [] if asset_ids is not None else sample_followup.plan(database, config, cover_root)
    if people:
        followups += _entity_followups(database, config, watermark, covered, include_stock=asset_ids is None)
    return dict(followups=followups, auto_applied=auto_apply['applied'],
                auto_rejected=auto_apply['auto_rejected'], performer_aliases=profiles['aliases'],
                performer_avatars=profiles['avatars'], performer_profile_conflicts=profiles['conflicts'],
                performer_profile_failed=profiles['failed'])


def _asset_selection(db_path, asset_ids):
    """显式选择只接受仍在馆藏中的视频；空选择不能解释成全库。"""
    if asset_ids is None:
        return None
    if not isinstance(asset_ids, list) or not asset_ids or any(
            type(value) is not int or value <= 0 for value in asset_ids):
        raise UserValueError('errors.libraryProcessing.invalidSelection')
    chosen = list(dict.fromkeys(asset_ids))
    with closing(sqlite3.connect(db_path, timeout=30)) as connection:
        found = {row[0] for row in connection.execute(
            "SELECT id FROM asset WHERE id IN (SELECT value FROM json_each(?)) "
            "AND medium='video' AND disposal IS NULL", (json.dumps(chosen),))}
    if found != set(chosen):
        raise UserValueError('errors.libraryProcessing.selectionGone')
    return chosen


PREVIEW_TIMEOUT_SECONDS = 120.0


class _ProcessingPersistenceError(UserFacingError, RuntimeError):
    """公共进度或检查点未保存，必须由任务层处理。"""


def _raise_task_failure(error):
    if isinstance(error, (InterruptedError, JobPolicyError, sqlite3.Error, _ProcessingPersistenceError)):
        raise error


class _PreviewCaptureError(UserValueError):
    """预览失败的操作提示及脱敏工具证据。"""

    def __init__(self, diagnostics):
        from .error_reporting import scrub
        from .diagnostic_exceptions import media_details
        category = media_details(None, diagnostics, {})
        self.diagnostics = {**scrub(diagnostics), 'failure_category': category or 'unclassified'}
        code = {
            'timeout': 'errors.libraryProcessing.captureTimeout',
            'ffmpeg_error': 'errors.libraryProcessing.captureFfmpegFailed',
            'no_frame': 'errors.libraryProcessing.captureNoFrame',
        }.get(diagnostics.get('reason'), 'errors.libraryProcessing.captureUnfetched')
        super().__init__(code)


def _earlier_timestamps(timestamp, duration):
    """某格抽帧失败后依次改取的更早时间点，只留比上一次更早、仍在片长内的点。

    转存 mp4、只有几帧的短 hevc、尾部损坏的手机视频，容器声明的时长比实际能解码的长，
    靠后的格子落进坏区，硬解软解都取不到帧；前段的帧是好的（#392 实测）。"""
    candidates = []
    for value in (timestamp * 0.5, timestamp * 0.25, max(0.5, duration * 0.05)):
        if 0 < value < duration and value < (candidates[-1] if candidates else timestamp):
            candidates.append(value)
    return candidates


def _capture_preview_cell(capture, timestamp, duration, *, deadline, progress):
    """抽九宫格的一格，返回（是否取到, 首抽诊断）；回退尝试记进诊断的 earlier_attempts。

    超时多是挂载慢，换点位只会耗尽预算；FFmpeg 报错或没出帧才往前找好帧。"""
    diagnostic = {}
    if capture(timestamp, diagnostic):
        return True, diagnostic
    if diagnostic.get('reason') not in ('ffmpeg_error', 'no_frame'):
        return False, diagnostic
    earlier = diagnostic['earlier_attempts'] = []
    for fallback in _earlier_timestamps(timestamp, duration):
        if deadline <= time.monotonic():
            break
        progress()
        detail = {}
        captured = capture(fallback, detail)
        earlier.append(dict(timestamp_seconds=fallback, reason=detail.get('reason'),
                            returncode=detail.get('returncode')))
        if captured:
            return True, diagnostic
    return False, diagnostic


def _generate_preview(config, row, database, resolver, *, progress):
    """复用九宫格抽帧原语，产物可用后在共享写锁内登记。"""
    from . import frame_capture, media_probe
    from .fsutil import atomic_path
    from .previews import PreviewUnavailable

    deadline = deadline_after(PREVIEW_TIMEOUT_SECONDS)

    def remaining(limit):
        value = deadline - time.monotonic()
        if value <= 0:
            raise _PreviewCaptureError(dict(reason='timeout', timeout_seconds=PREVIEW_TIMEOUT_SECONDS))
        return min(limit, value)

    root = (config.directory('generated') / 'snapshots').resolve()
    previous = row.get('snapshot_path')
    if previous:
        previous = translate_ledger_path(previous)
        if previous.is_relative_to(root) and artifact_rules.current(previous) and measure_image_file(previous):
            return False
    choice = resolver.ffmpeg()
    if choice is None:
        raise PreviewUnavailable('errors.libraryProcessing.ffmpegMissing')
    video = translate_ledger_path(row['path'])
    import stat
    if not stat.S_ISREG(file_stat(video, timeout=remaining(20)).st_mode):
        raise PreviewUnavailable('errors.libraryProcessing.mediaInaccessible')
    duration = row.get('duration') or 0
    if duration <= 0:
        probe = resolver.ffprobe()
        if probe is None:
            raise PreviewUnavailable('errors.libraryProcessing.ffprobeMissing')
        measured = media_probe.measure(str(probe.path), row['id'], str(video), timeout=remaining(20))
        duration = measured[0]
        if duration <= 0:
            raise PreviewUnavailable('errors.libraryProcessing.durationUnavailable')
        progress()
        with database.write_transaction() as connection:
            connection.execute(media_probe.UPDATE, measured)
    digest = hashlib.sha1(str(row['path']).encode('utf-8')).hexdigest()[:16]
    destination = root / row['location'] / digest[:2] / (digest + '.jpg')
    if not artifact_rules.current(destination) or not measure_image_file(destination):
        from .hardware_transcode import frame_decode_options
        decode_options = frame_decode_options(str(choice.path), str(video))
        with tempfile.TemporaryDirectory(prefix='peach-preview-') as temporary:
            frames = Path(temporary)
            for index in range(9):
                if metadata_only(config.directory('state')):
                    return False
                progress()
                timestamp = duration * (0.03 + 0.94 * (index + 0.5) / 9)
                captured, diagnostic = _capture_preview_cell(
                    lambda at, detail, destination=frames / f's{index:02d}.jpg': frame_capture.capture_with_retry(
                        str(choice.path), str(video), at, destination,
                        diagnostics=detail, timeout=remaining(45), decode_options=decode_options),
                    timestamp, duration, deadline=deadline, progress=progress)
                if not captured:
                    for attempt in diagnostic.get('attempts', []):
                        attempt['stderr'] = attempt.get('stderr', '').replace(str(video), '<media>')[-4096:]
                    diagnostic['stderr'] = diagnostic.get('stderr', '').replace(str(video), '<media>')[-4096:]
                    diagnostic.update(frame_index=index, duration_seconds=duration,
                                      tool_source=choice.source if hasattr(choice, 'source') else 'unknown',
                                      tool_name=Path(choice.path).name)
                    raise _PreviewCaptureError(diagnostic)
            progress()
            try:
                with atomic_path(destination) as output:
                    if not frame_capture.tile_frames(str(choice.path), str(frames / 's%02d.jpg'), 3, 3, output,
                                                     timeout=remaining(60)):
                        raise UserValueError('errors.libraryProcessing.previewNotGenerated')
                    if not measure_image_file(output):
                        raise UserValueError('errors.libraryProcessing.previewUnreadable')
            except OSError as error:
                raise _ProcessingPersistenceError('errors.libraryProcessing.previewNotSaved',
                                                  {'error': str(error)}) from error
    artifact_rules.remember(destination)
    progress()
    with database.write_transaction() as connection:
        result = connection.execute(
            "UPDATE asset SET snapshot_path=? WHERE id=? AND path=? AND location=? "
            "AND medium='video' AND disposal IS NULL", (str(destination), row['id'], row['path'], row['location']))
    return bool(result.rowcount)


def preview_readable(row, config, *, allow_metered=False):
    """抽帧可以读的视频：在线来源与 STRM/ISO 不读，开了流量保护的目录只在显式授权时读。

    抽帧按九个时间点跳读，不读整部，免费的网盘挂载和本机一样处理。流量保护按目录算
    （`cost_for`），和探测时长用的是同一份判据。扫描、计数、流量预估与抽帧都按它取舍，
    各写一份迟早会出现「计数里有、抽帧时跳过」。"""
    return (row['location'] != 'online' and not skip_background_read(row['path'])
            and (allow_metered or cost_for(row['location'], row['path'], config) == 'free'))


def _generate_previews(config, rows, database, *, update, issue, guard,
                       completed=(), checkpoint=lambda row: None, initial_made=0, allow_metered=False):
    """来源失败与抽帧失败各自保留可重试项目。媒体库处理方式不生成九宫格的作品跳过。"""
    from .previews import PreviewUnavailable
    if database is None:
        return 0
    stages_of = _library_stages(config)
    rows = [row for row in rows if preview_readable(row, config, allow_metered=allow_metered)
            and 'preview' in stages_of(row['path'])]
    base_done = sum(_checkpoint_key(row) in completed for row in rows)
    rows = [row for row in rows if _checkpoint_key(row) not in completed]
    resolver = FFmpegResolver(config.directory('tools') / 'ffmpeg')
    made = initial_made
    for index, row in enumerate(rows):
        if metadata_only(config.directory('state')):
            break
        started = time.time()
        deadline = deadline_after(PREVIEW_TIMEOUT_SECONDS)
        def progress(row=row, index=index, made=made, started=started, deadline=deadline):
            guard.check()
            try:
                update(**stage_fields('library.makePreviews'), checked=base_done + index, total=base_done + len(rows), previews=made,
                       current_asset_id=row['id'], current_asset_name=Path(str(row['name'] or '')).name,
                       current_action='generating_preview', current_started_at=started,
                       current_deadline_at=time.time() + max(0, deadline - time.monotonic()))
            except InterruptedError:
                raise
            except OSError as error:
                raise _ProcessingPersistenceError('errors.libraryProcessing.progressNotSaved',
                                                  {'error': str(error)}) from error
        progress()
        try:
            made += int(_generate_preview(config, row, database, resolver, progress=progress))
        except InterruptedError:
            raise
        except (OSError, ValueError, subprocess.SubprocessError, PreviewUnavailable) as error:
            from .error_reporting import event
            event('library-preview', error, asset_id=row['id'])
            message = (said_of(error) if isinstance(error, (ValueError, PreviewUnavailable)) else
                       phrase('errors.libraryProcessing.previewTimeout') if isinstance(error, subprocess.SubprocessError)
                       else phrase('errors.libraryProcessing.previewFailed'))
            details = {'diagnostics': error.diagnostics} if isinstance(error, _PreviewCaptureError) else {}
            issue(row, message, action='generating_preview', retryable=True, **details)
        else:
            update(previews=made)
            checkpoint(row)
        update(checked=base_done + index + 1, previews=made, current_asset_id=None, current_asset_name='',
               current_action='', current_started_at=None, current_deadline_at=None)
    return made


def _checkpoint_key(row):
    return f"{row['id']}:{row['path']}"


def _newly_coded_assets(database, db_path) -> set[str]:
    """账本里没番号、按现行内置规则能从文件名认出番号的影片 id；处理时会补上番号再采资料。"""
    from .repository import LedgerDatabase
    ledger = database if database is not None else LedgerDatabase(db_path)
    with ledger.read_connection() as connection:
        rows = connection.execute(
            "SELECT id,name FROM asset WHERE medium='video' AND COALESCE(code,'')=''").fetchall()
    return {str(row[0]) for row in rows if release_code_from_filename(row[1] or '')}


class _LibraryCheckpoints:
    """只有预览登记或候选落盘成功才提交影片检查点。"""

    def __init__(self, state, previous, database, db_path):
        self.db_path = db_path
        previous = previous or {}
        if previous.get('processing_rule') != upgrade_rules.PROCESSING:
            state['local_metadata'] = {}
            previous = {key: value for key, value in previous.items()
                        if key not in ('completed_previews', 'completed_metadata', 'local_metadata')}
        state['processing_rule'] = upgrade_rules.PROCESSING
        self.state = state
        self.completed = {phase: set(previous.get(phase) or [])
                          for phase in ('completed_previews', 'completed_metadata')}
        if (previous.get('fc2_metadata_rule') != upgrade_rules.FC2_METADATA
                and self.completed['completed_metadata']):
            from .repository import LedgerDatabase
            ledger = database if database is not None else LedgerDatabase(db_path)
            with ledger.read_connection() as connection:
                missing = {str(row[0]) for row in connection.execute(
                    "SELECT a.id FROM asset a WHERE (upper(a.code) LIKE 'FC2%' OR upper(a.code) LIKE 'FC-%') "
                    "AND NOT EXISTS(SELECT 1 FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id "
                    "WHERE ae.asset_id=a.id AND e.kind='performer')")}
            self.completed['completed_metadata'] = {
                key for key in self.completed['completed_metadata'] if key.partition(':')[0] not in missing}
        state['fc2_metadata_rule'] = upgrade_rules.FC2_METADATA
        if (previous.get('filename_code_rule') != upgrade_rules.FILENAME_CODES
                and self.completed['completed_metadata']):
            newly_coded = _newly_coded_assets(database, db_path)
            self.completed['completed_metadata'] = {
                key for key in self.completed['completed_metadata'] if key.partition(':')[0] not in newly_coded}
        state['filename_code_rule'] = upgrade_rules.FILENAME_CODES
        self.pending_metadata = set()
        self.entity_watermark = previous.get('entity_watermark')
        if self.entity_watermark is None:
            self.entity_watermark = _entity_watermark(database)
        state['entity_watermark'] = self.entity_watermark
        for phase, keys in self.completed.items():
            state[phase] = sorted(keys)

    def mark(self, phase, row, flush):
        self.completed[phase].add(_checkpoint_key(row))
        self.state[phase] = sorted(self.completed[phase])
        flush(force=True)

    def queue_metadata(self, row, entries, issues_before):
        if entries and self.state['issue_count'] == issues_before:
            self.pending_metadata.add(_checkpoint_key(row))

    def commit_metadata(self, flush):
        if not self.pending_metadata:
            return
        completed_ids = [int(key.split(':',1)[0]) for key in self.pending_metadata]
        self.completed['completed_metadata'].update(self.pending_metadata)
        self.pending_metadata.clear()
        self.state['completed_metadata'] = sorted(self.completed['completed_metadata'])
        flush(force=True)
        from .library_new_assets import remember
        remember(self.db_path, completed=completed_ids)

    def remaining_metadata(self, rows):
        return ((index, row) for index, row in enumerate(rows)
                if _checkpoint_key(row) not in self.completed['completed_metadata'])


def _validate_processing_request(config, db_path, stage, asset_ids, retry_ids, database):
    """校验处理范围、选择与预览生成所需条件，返回规范的所选影片。"""
    _require_writer(config, db_path)
    if stage not in STAGES:
        raise UserValueError('errors.libraryProcessing.invalidStage')
    if stage == PREVIEWS_STAGE and metadata_only(config.directory('state')):
        raise UserValueError('errors.libraryProcessing.previewsDisabled')
    if asset_ids is not None and retry_ids is not None:
        raise UserValueError('errors.libraryProcessing.selectionWithRetry')
    selected_ids = _asset_selection(db_path, asset_ids)
    if stage == PREVIEWS_STAGE and database is None:
        raise UserValueError('errors.libraryProcessing.previewsNeedWriter')
    return selected_ids


def _candidate_baseline(database, row, code, verify_existing):
    """用已提交的字段判定补空与覆盖，包括演员、标签关系。"""
    if database is None or not verify_existing:
        return row
    from .metadata_auto_apply import refresh_current_values
    values = [dict(asset_id=row['id'], asset_path=row['path'], code=code or '',
                   field=field, current_value=row.get(COLUMN_OF.get(field, field)) or '') for field in LABELS]
    with database.read_connection() as connection:
        refresh_current_values(connection, values)
    return {**row, **{COLUMN_OF.get(value['field'], value['field']): value['current_value'] for value in values}}


def _read_local_metadata(config, db_path, row, cover_root, listing, state, update, issue, poster_jobs,
                         code_patterns=()):
    """读取一部影片的本地证据，返回可独立发布的资料与在线核查范围。

    `code_patterns` 是用户在设置里写的番号识别规则，已编译，先于内置规则试。"""
    video = translate_ledger_path(row['path'])
    try:
        files = listing.files(video.parent)
    except InterruptedError:
        raise
    except OSError as error:
        issue(row, said_of(error), action='reading_local', retryable=True)
        return None
    if video.name.casefold() not in files:
        issue(row, phrase('errors.libraryProcessing.mediaInaccessible'), action='reading_local', retryable=True)
        return None
    code = _provider_code(row['code']) or release_code_from_filename(row['name'], patterns=code_patterns)
    payload = None
    entries = []
    nfo, posters = listing.sidecars(video)
    if nfo:
        try:
            payload, raw = read_nfo(nfo)
            if payload['id'] and code and not same_release_code(code, payload['id']):
                raise UserValueError('errors.libraryProcessing.nfoCodeConflict')
            code = code or _provider_code(payload['id'])
        except InterruptedError:
            raise
        except (OSError, ValueError, ET.ParseError) as error:
            issue(row, said_of(error), action='reading_local', retryable=isinstance(error, OSError))
            payload = None
    if code and not row['code']:
        with closing(sqlite3.connect(db_path, timeout=30)) as connection, connection:
            write_owned_fields(connection, [row['id']], {'code': code}, SCAN_FILENAME, require_empty=True)
        state['identified'] += 1
    try:
        poster_root = cover_root if code else config.directory('generated') / 'posters'
        _queue_local_poster(video, code or f"{row['id']}_4", poster_root, payload, posters=posters,
                            enqueue=lambda source, key, target: poster_jobs.append((row, source, key, target)),
                            generated=not code)
    except InterruptedError:
        raise
    except (OSError, ValueError):
        issue(row, phrase('errors.libraryProcessing.companionImageUnreadable'), action='reading_local_cover',
              retryable=True)
    if payload:
        evidence_path = config.directory('sources') / 'library-metadata' / (hashlib.sha256(raw).hexdigest() + '.nfo')
        evidence_path.parent.mkdir(parents=True, exist_ok=True)
        evidence_path.write_bytes(raw)
        entries.append(('local_nfo', payload, evidence_path))
    update(identified=state['identified'], covers=state['covers'], current_action='reading_local',
           current_started_at=time.time(), current_deadline_at=None)
    return code, nfo is not None, payload, entries


def _settle_collection_state(state, summary, rows, update):
    summary['auto_applied'] = summary.get('auto_applied', 0) + state['auto_applied']
    summary['auto_rejected'] = summary.get('auto_rejected', 0) + state['auto_rejected']
    update(status='failed' if state['issue_count'] else 'complete', **stage_fields('library.finished'),
           outcome='partial' if state['issue_count'] else 'complete',
           checked=len(rows), total=len(rows), **summary,
           **_error_fields(_finish_summary(budget_summary(state),
                                           issue_summary(state['issue_count'], state['paused_count']))),
           completed_at=time.time(), current_asset_id=None, current_asset_name='',
           current_action='', current_started_at=None, current_deadline_at=None)


def _finish_summary(budget, issues):
    """收尾那一句：预算跳过的说明在前、问题汇总在后，两句都有时连成一句。"""
    if budget and issues:
        return phrase('labels.libraryProcessing.budgetAndIssues', {'budget': budget, 'issues': issues})
    return budget or issues


def _processing_steps(stage, asset_ids, *, metadata_only_enabled):
    """按本趟真实处理范围构造有序阶段清单。"""
    scanning = asset_ids is None and stage in (ALL_STAGES, SCAN_STAGE)
    steps = [('sources', 'scanFiles' if scanning else 'checkFolders')]
    steps.append(('inspect', 'checkJunk' if stage in (SCAN_STAGE, PREVIEWS_STAGE, METADATA_STAGE)
                  else 'probeAndCheckJunk'))
    if stage not in (SCAN_STAGE, PREVIEWS_STAGE):
        steps.append(('local', 'checkCompanions'))
    if stage == PREVIEWS_STAGE or stage in (ALL_STAGES, COLLECT_STAGE):
        steps.append(('media', 'makePreviews' if stage == PREVIEWS_STAGE or not metadata_only_enabled
                      else 'checkPreviewSettings'))
    if stage not in (SCAN_STAGE, PREVIEWS_STAGE):
        steps.append(('collect', 'fetchMetadataAndCovers'))
    return [dict(id=key, label=interface_text.text(f'server:{STEP_PREFIX}{name}'), label_code=STEP_PREFIX + name,
                 status='current' if index == 0 else 'pending')
            for index, (key, name) in enumerate(steps)]


#: 处理步骤名的 code 前缀；`label` 存按 zh-CN 渲染的原文。
STEP_PREFIX = 'labels.libraryProcessing.step.'
STEP_NAMES = ('scanFiles', 'checkFolders', 'checkJunk', 'probeAndCheckJunk', 'checkCompanions', 'makePreviews',
              'checkPreviewSettings', 'fetchMetadataAndCovers')


def _complete_processing_step(steps, key):
    """返回完成当前阶段并激活下一阶段的独立快照。"""
    progress = [dict(item) for item in steps]
    for index, item in enumerate(progress):
        if item['id'] == key:
            item['status'] = 'complete'
            if index + 1 < len(progress):
                progress[index + 1]['status'] = 'current'
            break
    return progress


def _processing_workload(config, rows, stage, database, completed_previews, allow_metered=False):
    """按处理范围和已完成检查点建立各阶段的待处理数量。"""
    pending = {}
    if stage not in (SCAN_STAGE, PREVIEWS_STAGE):
        pending.update(local=len(rows), metadata=len(rows))
    if stage in (ALL_STAGES, COLLECT_STAGE):
        pending['probe'] = sum(row['duration'] is None for row in rows
                               if not skip_background_read(row['path'])
                               and cost_for(row['location'], row['path'], config) == 'free')
    if (database is not None and stage in (ALL_STAGES, COLLECT_STAGE, PREVIEWS_STAGE)
            and not metadata_only(config.directory('state'))):
        pending['previews'] = sum(preview_readable(row, config, allow_metered=allow_metered)
                                  and _checkpoint_key(row) not in completed_previews for row in rows)
    return pending


def _restore_processing_counts(state, previous):
    """同一处理任务沿用累计数、问题清单和已保存证据索引。"""
    previous = previous or {}
    for key in ('started_at', 'identified', 'covers', 'previews', 'probed', 'issue_count', 'paused_count',
                'issue_preview', 'issues_truncated', 'notes', 'retryable_asset_ids', 'paused_asset_ids',
                'junk_isolated', 'junk_review',
                'offline_skipped', 'budget_skipped', 'budget_reason'):
        if key in previous:
            state[key] = previous[key]
    for key in ('scan_checkpoints', 'local_metadata'):
        state[key] = dict(previous.get(key) or {})
    for key in ('auto_applied', 'auto_rejected'):
        state[key] = previous.get(key, 0)


class _LocalEvidenceCache:
    """保存已经读出的本地证据与待处理图片，供同一影片的后续阶段复用。"""

    def __init__(self, config, db_path, cover_root, listing, state, path):
        self.config, self.db_path, self.cover_root = config, db_path, cover_root
        self.listing, self.state, self.path = listing, state, path
        with closing(sqlite3.connect(db_path, timeout=30)) as connection:
            stored = read_settings(connection).get('codePatterns')
        try:
            self.code_patterns = compile_code_patterns(stored)
        except ValueError:
            # 保存时已经校验过；被手改坏的规则当没设置过，不让整轮处理失败。
            self.code_patterns = ()

    def read(self, row, update, issue, poster_jobs):
        key = _checkpoint_key(row)
        cached_path = self.state['local_metadata'].get(key)
        try:
            cached = json.loads(Path(cached_path).read_text(encoding='utf-8')) if cached_path else None
        except (OSError, ValueError):
            cached = None
        if cached is not None:
            code, verify, payload, entries = cached['local']
            poster_jobs.extend((row, translate_ledger_path(source), name, Path(target))
                               for source, name, target in cached['posters'])
            return code, verify, payload, [(source, document, translate_ledger_path(path)) for source, document, path in entries]
        offset, issues_before = len(poster_jobs), self.state['issue_count']
        local = _read_local_metadata(self.config, self.db_path, row, self.cover_root, self.listing,
                                     self.state, update, issue, poster_jobs, self.code_patterns)
        if local is not None and self.state['issue_count'] == issues_before:
            code, verify, payload, entries = local
            record = dict(local=[code, verify, payload, [(source, document, str(path)) for source, document, path in entries]],
                          posters=[(str(source), name, str(target)) for _, source, name, target in poster_jobs[offset:]])
            encoded = json.dumps(record, ensure_ascii=False)
            digest = hashlib.sha256(encoded.encode()).hexdigest()
            item_path = self.path.parent / (self.path.stem + '-items') / f"{row['id']}-{digest}.json"
            if not item_path.is_file():
                atomic_write_text(item_path, encoded)
            self.state['local_metadata'][key] = str(item_path)
        return local


class _ProcessingStateFile:
    """按时间间隔保存任务状态，关键状态允许立即落盘。"""

    def __init__(self, path, state):
        self.path, self.state = path, state
        self.saved_at = 0.0

    def __call__(self, force=False):
        if force or time.time() - self.saved_at >= STATE_FLUSH_SECONDS:
            _save(self.path, self.state)
            self.saved_at = time.time()


class _ProcessingIssues:
    """将带资产身份的问题写入日志，并同步任务进度。"""

    def __init__(self, state, log_path, flush_state, report):
        self.state, self.log_path = state, log_path
        self.flush_state, self.report = flush_state, report

    def __call__(self, asset, message, *, action='', retryable=False, paused=False, diagnostics=None):
        """`message` 是 `phrase`（带 code 的一句），或没有 code 的原文（异常原文、文件名）。"""
        asset = asset or {}
        title = str(asset.get('catalog_title') or '') or Path(str(asset.get('name') or '')).name
        fields = _message_fields(message)
        severity, retryable = _issue_classification(fields, retryable, paused)
        _record_issue(self.state, self.log_path, {
            'asset_id': asset.get('id'), 'title': title, 'path': str(asset.get('path') or ''),
            **fields, 'severity': severity, 'failed_action': action, 'retryable': retryable,
            'last_failed_at': time.time()}, diagnostics=diagnostics)
        self.state['last_progress_at'] = time.time()
        self.flush_state()
        self.report(dict(self.state))


def _initial_processing_scope(db_path, selected_ids, retry_ids, incremental, resume_state):
    """区分待发现范围与首次预估范围；增量恢复沿用已冻结的影片集合。"""
    if incremental:
        from .library_new_assets import pending
        previous = (resume_state or {}).get('incremental_ids')
        return None, list(previous) if previous is not None else pending(db_path)
    if selected_ids is not None:
        return selected_ids, selected_ids
    if retry_ids is not None:
        chosen = list(dict.fromkeys(map(int, retry_ids)))
        return chosen, chosen
    return None, None


def _prepare_library_scope(config, db_path, stage, asset_ids, retry_ids, database, library_id, resume_state):
    """恢复原媒体库并校验显式选择，返回本轮可用的目录配置。"""
    library_id = (resume_state or {}).get('library_id', library_id)
    config = scoped_config(config, library_id)
    selected_ids = _validate_processing_request(config, db_path, stage, asset_ids, retry_ids, database)
    if library_id and selected_ids is not None:
        if set(scoped_assets(config, db_path, library_id, selected_ids)) != set(selected_ids):
            raise UserValueError('errors.libraryProcessing.notInLibrary')
    return config, library_id, selected_ids


def process_library(config, db_path, candidate_root, cover_root, *, location='configured',
                    report=lambda state: None, provider_factory=None, job_id=None,
                    retry_ids=None, active=lambda: True, stage=ALL_STAGES,
                    database=None, route_overrides=None, state_file=None, asset_ids=None,
                    resume_state=None, speed_mode=None, protected_ids=(), recheck_existing=False,
                    incremental=False, network=None, library_id=None, allow_metered=False):
    """登记文件与确定的番号，外部资料保留为可复核候选。

    `retry_ids` 为 `None` 时处理整个馆藏；给定时只处理这些项目（上一任务记录的
    可重试失败），不重新扫描来源目录，已有候选与封面照常复用。

    `stage` 指定处理范围：`all` 扫描并补全资料与预览，`scan` 只扫描，
    `collect` 补全资料与预览，`metadata` 只采集资料，`previews` 只生成预览。预览只抽
    `preview_readable` 认可的视频；`allow_metered` 是对开了流量保护的目录的显式授权，
    只对指定了 `asset_ids` 的 `previews` 生效（路由层把关）。
    `asset_ids` 指定仍在馆藏中的视频，不扫描来源目录；空选择无效。
    `library_id` 将目录扫描、资料处理与候选结算限制到一个媒体库，恢复时沿用原范围。

    `database` 是调用方已经在用的 `LedgerDatabase`。给了它才做收尾的自动落库与人物
    资料补齐与本地预览登记，并且与调用方共用同一把进程内写锁。所有模式都会按范围
    检查垃圾并隔离到回收站；不给 `database` 时外部资料只采集候选。

    `route_overrides` 覆盖某几种内容类型的来源链，形状与判据见
    `metadata_routes.parse_route_overrides`；不给就用内建那张表。
    `state_file` 给后台定向任务保存独立进度，共享候选写入仍使用全库处理锁。
    `network` 是 `NetworkReachability`：外部采集开始前当场探一次，判成断网时要出网的行记为
    可重试的「外部资料未取得」、补人物资料整段跳过，本地那几步照常做完；之后每一行读它的快照。
    不给就不判，命令行走这条。
    """
    config, library_id, selected_ids = _prepare_library_scope(
        config, db_path, stage, asset_ids, retry_ids, database, library_id, resume_state)
    from .repository import LedgerDatabase
    judgement_database = database if database is not None else LedgerDatabase(db_path)
    routes = metadata_routes.parse_route_overrides(route_overrides)
    path = Path(state_file) if state_file is not None else state_path(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    retrying = retry_ids is not None
    scope_ids, initial_ids = _initial_processing_scope(db_path, selected_ids, retry_ids, incremental, resume_state)
    initial_ids = scoped_assets(config, db_path, library_id, initial_ids)
    from .processing_control import execution_mode
    from .task_control import CURRENT as TASK_CONTROL
    speed_mode = execution_mode(judgement_database, speed_mode, control=TASK_CONTROL.get())
    control = task_control(config, state_file)
    identity = job_id or uuid.uuid4().hex
    from .processing_inventory import recent_rows
    traffic = ProcessingTraffic(config, db_path, stage, initial_ids,
                                resume_state=resume_state, inventory_rows=recent_rows(config, db_path, stage, scope_ids),
                                allow_metered=allow_metered)
    def control_report(**values):
        resume_fields(state, values)
        state.update(values)
        estimate.update(state)
        state['traffic'] = traffic.snapshot(finished=state.get('status') in ('complete', 'failed'))
        flush_state(force=True)
        report(dict(state))
    from .update_tasks import activity
    # 后台任务要让路时，`as active` 换上的那个会转为假；后面的检查点与闭包都读这一个。
    with (activity(Path(db_path), 'library-processing'), traffic.bind(),
          _processing_lock(config, background=state_file is not None, active=active) as active,
          bind_control(control, identity, publish=control_report, active=active, db_path=Path(db_path),
                       mode=speed_mode)):
        state = dict(job_id=identity, status='running',
                     **stage_fields('library.checkCompanions' if retrying else 'library.scanFiles'),
                     checked=0, total=0, scanned=0, scanned_bytes=0, probed=0, identified=0, candidates=0, covers=0, previews=0,
                     requested_stage=stage, asset_ids=scope_ids, incremental=incremental, allow_metered=allow_metered,
                     library_id=library_id, library_name=config.library_catalog.get(library_id, {}).get('name', ''),
                     issue_count=0, paused_count=0, issue_preview=[], issues_truncated=False,
                     notes={}, retryable_asset_ids=[],
                     last_progress_at=time.time(), progress_seq=0,
                     current_asset_id=None, current_asset_name='', current_action='',
                     current_started_at=None, current_deadline_at=None,
                     followups=[], offline_skipped=0,
                     junk_isolated=0, junk_review=0,
                     started_at=time.time(), **_error_fields(None))
        state.update(initial_estimate(config, db_path, stage, initial_ids, speed_mode))
        if incremental:
            state['incremental_ids'] = initial_ids
            traffic.unknown_files = True
        state['steps'] = _processing_steps(stage, scope_ids,
            metadata_only_enabled=metadata_only(config.directory('state')))
        _restore_processing_counts(state, resume_state)
        estimate = ProcessingEstimate(config, state, control)
        # 实体表的水位在开工前记一次：比它大的实体就是这一轮建出来的（`_entity_followups`）。
        checkpoints = _LibraryCheckpoints(state, resume_state, database, db_path)
        entity_watermark = checkpoints.entity_watermark
        # 每行这一轮换上了几张封面，`(asset_id, 张数)`：换上了的作品，女优可能截得出更清楚的脸。
        covered = []
        stages_of = _library_stages(config)
        log_path = _processing_issue_log(config, path, state['job_id'], state_file is not None,
                                         resume=bool(resume_state))
        # 界面只展示前 20 条，完整清单在这个文件里；地址跟着状态一起给出，
        # 不让人按 job_id 自己去拼路径。
        state['issues_log'] = str(log_path)

        flush_state = _ProcessingStateFile(path, state)

        def update(**values):
            _require_writer(config, db_path)
            if not active():
                raise UserInterruptedError('errors.libraryProcessing.stopped')
            checkpoint_values(values)
            state.update(values)
            estimate.update(state)
            state['traffic'] = traffic.snapshot(finished=state.get('status') in ('complete', 'failed'))
            state['last_progress_at'] = time.time()
            state['progress_seq'] += 1
            flush_state(force='status' in values)
            report(dict(state))

        def traffic_report():
            state['traffic'] = traffic.snapshot()
            flush_state()
            report(dict(state))

        traffic.publish = traffic_report

        issue = _ProcessingIssues(state, log_path, flush_state, report)

        def finish_step(key):
            """阶段成功返回后发布完成状态；异常退出的阶段保留当前状态。"""
            traffic.finish_work(key)
            update(steps=_complete_processing_step(state['steps'], key))

        update()
        remote = _RemoteSession(config, provider_factory, _MissCache(misses_path(config)),
                                retrying=retrying, recheck_existing=recheck_existing, routes=routes,
                                database=judgement_database)
        flush_candidates = lambda force=False: None

        try:
            guard = CapacityGuard(config)
            guard.check(force=True)
            locations = config.locations if location == 'configured' else {location: config.locations[location]}
            sources = _scan_sources(config, db_path, locations=locations, asset_ids=scope_ids,
                                    stage=stage, guard=guard, update=update, issue=issue,
                                    scan_checkpoints=state['scan_checkpoints'],
                                    save_checkpoint=lambda: flush_state(force=True), initial_probed=state['probed'],
                                    incremental=incremental, allow_metered=allow_metered)
            if incremental:
                from .library_new_assets import _active_videos
                scope_ids = _active_videos(db_path, sorted(set(initial_ids) | set(sources.new_ids)))
                state['asset_ids'] = state['incremental_ids'] = scope_ids
                traffic.asset_ids = scope_ids
            scope_ids = scoped_assets(config, db_path, library_id, scope_ids)
            state['asset_ids'] = scope_ids
            traffic.asset_ids = scope_ids
            state.update(scanned=sources.scanned, scanned_bytes=sources.scanned_bytes, probed=sources.probed)
            state['junk_isolated'] = max(state['junk_isolated'], sources.junk_isolated)
            traffic.unknown_files = False
            traffic.refresh_plan()
            finish_step('sources')
            if incremental and not scope_ids:
                _settle_collection_state(state, {}, [], update)
                return state
            _prepare_processing_media(config, db_path, judgement_database, locations, sources,
                                      scope_ids, protected_ids, stage, state, update)
            finish_step('inspect')
            if stage == SCAN_STAGE:
                # `checked`／`total` 在探时长时借给进度条用过；只扫描这一段没有采集，读数归零。
                update(status='failed' if state['issue_count'] else 'complete',
                       outcome='partial' if state['issue_count'] else 'complete',
                       **stage_fields('library.finished'), completed_at=time.time(), checked=0, total=0,
                       **_error_fields(issue_summary(state['issue_count'], state['paused_count'])))
                return state
            rows, genre_decisions = _collection_rows(
                db_path, locations=locations, online_roots=sources.online_roots, asset_ids=scope_ids)
            traffic.refresh_plan(rows)
            pending = _processing_workload(config, rows, stage, database, checkpoints.completed['completed_previews'],
                                           allow_metered=allow_metered)
            update(estimate_pending=dict(pending))
            if stage == PREVIEWS_STAGE:
                _generate_previews(config, rows, database, update=update, issue=issue, guard=guard,
                                   completed=checkpoints.completed['completed_previews'],
                                   initial_made=state['previews'], allow_metered=allow_metered,
                                   checkpoint=lambda row: checkpoints.mark('completed_previews', row, flush_state))
                _check_processing_junk(judgement_database, locations, sources.online_roots,
                                       scope_ids, protected_ids, state, update)
                finish_step('media')
                update(status='failed' if state['issue_count'] else 'complete', **stage_fields('library.finished'),
                       outcome='partial' if state['issue_count'] else 'complete',
                       completed_at=time.time(),
                       **_error_fields(issue_summary(state['issue_count'], state['paused_count'])))
                return state
            output = candidate_root / 'library-metadata-field-candidates.csv'
            groups = {row['item_key']: row for row in read_rows_shared(output, missing_ok=True)}
            scoped_groups = lambda: _candidate_scope(groups, scope_ids)
            listing = _DirectoryIndex()
            local_evidence = _LocalEvidenceCache(config, db_path, cover_root, listing, state, path)
            csv_dirty = False
            csv_written_at = time.monotonic()
            csv_write_cost = 0.0

            def flush_candidates(force=False):
                nonlocal csv_dirty, csv_written_at, csv_write_cost
                pause = max(CANDIDATE_FLUSH_SECONDS, csv_write_cost * CANDIDATE_FLUSH_COST_RATIO)
                if csv_dirty and (force or time.monotonic() - csv_written_at >= pause):
                    started = time.monotonic()
                    write_rows(output, FIELDS, groups.values(), atomic=True)
                    csv_dirty = False
                    csv_written_at = time.monotonic()
                    csv_write_cost = csv_written_at - started
                if not csv_dirty:
                    checkpoints.commit_metadata(flush_state)

            def publish(row, code, local_fields, verify_existing, entries):
                nonlocal csv_dirty
                if not entries:
                    return
                row = _candidate_baseline(database, row, code, verify_existing)
                for source, document, evidence_path in entries:
                    _merge_candidates(groups, row, code, source, document, evidence_path, genre_decisions,
                                      local_fields, verify_existing=verify_existing, database=judgement_database)
                csv_dirty = True
                selected = [groups[key] for field in LABELS
                            if (key := f"asset:{row['id']}:{field}") in groups]
                landed = _apply_finished_candidates(database, candidate_root, active, [row['id']], selected)
                state['auto_applied'] += landed['applied']
                state['auto_rejected'] += landed['auto_rejected']
                flush_candidates()
                update(candidates=len(scoped_groups()), auto_applied=state['auto_applied'])

            prepared = []
            poster_jobs = []
            local_rows = list(checkpoints.remaining_metadata(rows))
            completed_count = len(rows) - len(local_rows)
            for index, (_, row) in enumerate(local_rows):
                guard.check()
                issues_before = state['issue_count']
                update(**stage_fields('library.checkCompanions'), checked=completed_count + index, total=len(rows),
                       current_asset_id=row['id'], current_asset_name=Path(str(row['name'] or '')).name,
                       current_action='reading_local', current_started_at=time.time(),
                       current_deadline_at=None)
                local = local_evidence.read(row, update, issue, poster_jobs)
                if local is None:
                    continue
                code, verify_existing, payload, entries = local
                verify_existing = bool(verify_existing or recheck_existing)
                local_fields = _fields(payload, genre_decisions) if payload else {}
                publish(row, code, local_fields, verify_existing, entries)
                if code or payload:
                    prepared.append((row, code, verify_existing, local_fields, entries,
                                     state['issue_count'] == issues_before))
                update(checked=completed_count + index + 1)
            flush_candidates(force=True)
            pending.pop('local')
            pending['metadata'] = len(prepared)
            pending['images'] = len(poster_jobs)
            update(estimate_pending=dict(pending), **stage_fields('library.prepareImages'), checked=0, total=0,
                   current_asset_id=None, current_asset_name='', current_action='',
                   current_started_at=None, current_deadline_at=None)
            poster_failed = _read_local_posters(poster_jobs, state, update=update, issue=issue,
                                                generated_root=config.directory('generated') / 'posters')
            pending.pop('images')
            update(estimate_pending=dict(pending), **stage_fields('library.checkCompanions'), checked=0, total=0,
                   current_asset_id=None, current_asset_name='', current_action='',
                   current_started_at=None, current_deadline_at=None)
            finish_step('local')
            traffic.prepare_metadata(prepared)
            if stage in (ALL_STAGES, COLLECT_STAGE):
                pending.pop('probe', None)
                update(estimate_pending=dict(pending), **stage_fields('library.preparePreviews'), checked=0, total=0)
                if not metadata_only(config.directory('state')):
                    _generate_previews(config, rows, database, update=update, issue=issue, guard=guard,
                        completed=checkpoints.completed['completed_previews'],
                        initial_made=state['previews'],
                        checkpoint=lambda row: checkpoints.mark('completed_previews', row, flush_state))
                pending.pop('previews', None)
                update(estimate_pending=dict(pending), **stage_fields('library.prepareMetadata'), checked=0, total=0)
                finish_step('media')
            _check_processing_junk(judgement_database, locations, sources.online_roots,
                                   scope_ids, protected_ids, state, update)
            prepared = _active_prepared(judgement_database, prepared)
            gate = _NetworkGate(network, state['offline_skipped'])
            gate.probe(update)
            from .metadata_amane import PreparationError
            try:
                remote.prepare(prepared, stages_of, update, cover_root=cover_root, groups=groups,
                               offline=gate.offline)
            except PreparationError as error:
                issue(None, phrase('errors.libraryProcessing.toolsNotPrepared', {'error': phrase(error.code, error.params)}),
                      action='preparing_sources')
                blocked = set(error.asset_ids)
                state['retryable_asset_ids'] = sorted(set(state['retryable_asset_ids'])
                                                     | blocked)
                prepared = [entry for entry in prepared if entry[0]['id'] not in blocked]
                update(current_action='', current_started_at=None, current_deadline_at=None)
            budget = _SourceBudget(remote, state)
            for position, (row, code, verify_existing, local_fields, local_entries, local_ok) in enumerate(prepared):
                local_ok = local_ok and row['id'] not in poster_failed
                guard.check()
                issues_before = state['issue_count']
                update(**stage_fields('library.fetchMetadata'), checked=completed_count + position,
                       total=completed_count + len(prepared), current_asset_id=row['id'],
                       current_asset_name=Path(str(row['name'] or '')).name)
                target_key = f"asset:{row['id']}"
                missing = list(COLLECTED_FIELDS) if verify_existing else _missing_fields(row, local_fields)
                found, covers = _collect_allowed(
                    remote, traffic, row, code, missing, stages_of(row['path']), cover_root, covered,
                    update=update, issue=issue,
                    answered=() if verify_existing else _answered_sources(groups, target_key, missing),
                    received=lambda entries, row=row, code=code, fields=local_fields, verify=verify_existing:
                        publish(row, code, fields, verify, entries),
                    succeeded=lambda before=issues_before: state['issue_count'] == before, gate=gate,
                    budget=budget)
                state['offline_skipped'] = gate.skipped
                state['covers'] += covers
                update(**stage_fields('library.saveCandidates'), current_action='writing_candidates',
                       current_started_at=time.time(), current_deadline_at=None)
                checkpoints.queue_metadata(row, budget.checkpointed(row, local_entries + found if local_ok else []),
                                           issues_before)
                flush_candidates()
                update(checked=completed_count + position + 1, candidates=len(scoped_groups()),
                       current_asset_id=None, current_asset_name='', current_action='',
                       current_started_at=None, current_deadline_at=None)
            flush_candidates(force=True)
            budget.summarize(issue)
            update(estimate_pending={}, **stage_fields('library.collectResults'), checked=0, total=0)
            # 候选完整落盘后立即执行调用方注入的窄规则，不再等人打开复核页才触发。
            # 核心处理层不反向依赖 Web 复核层；CLI 与 Web 两个组装入口都传入同一实现。
            summary = _finish_collection(
                config, database, candidate_root, cover_root, groups, remote, asset_ids=scope_ids,
                active=active, update=update, issue=issue, watermark=entity_watermark, covered=covered,
                people=_people_allowed(config), offline=gate.offline())
            finish_step('collect')
            _settle_collection_state(state, summary, rows, update)
        except Exception:
            state.update(status='failed', outcome='interrupted',
                         **_error_fields(phrase('errors.libraryProcessing.interruptedCheckFolders')),
                         completed_at=time.time())
            state.update(interrupted_state(control))
            state['traffic'] = traffic.snapshot(finished=state.get('status') in ('failed', 'cancelled'))
            _save(path, state)
            raise
        finally:
            # 被打断也把已经攒下的候选写全：文件里要么是上一份完整的，要么是这一份完整的。
            flush_candidates(force=True)
            remote.close()
        from .library_new_assets import remember
        unfinished = set(state['retryable_asset_ids'])
        remember(db_path, completed=[row['id'] for row in rows if row['id'] not in unfinished])
        return state
