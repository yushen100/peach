"""公开资料贡献的有界投影；收集结果始终是候选，不是公共事实。"""
from __future__ import annotations

from datetime import date, datetime, timezone
import hashlib
import ipaddress
import json
import re
from typing import Literal
from urllib.parse import parse_qsl, urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from . import __version__
from .catalog_rules import is_jav_code, normalise_code_key
from .field_owners import parse_owners

SCHEMA = 1
MAX_RAW_BYTES = 100 * 1024 * 1024
MAX_BYTES = 18 * 1024 * 1024
FILENAME = 'peach-seed-contributions.json.gz'
FIELDS = ('catalog_title', 'release_date', 'studio', 'series', 'creator')
KANA = re.compile(r'[\u3040-\u30ff]')
HAN = re.compile(r'[\u3400-\u9fff]')


def public_text(value: str) -> str:
    """文本字段拒绝路径、凭据和网址；不靠截断或脱敏伪造原始断言。"""
    from .error_reporting import redact
    if (value != value.strip() or not value or len(value) > 1000 or redact(value) != value
            or re.search(r'[\x00-\x1f]|https?://|magnet:|[A-Za-z]:[\\/]|\\\\', value, re.I)):
        raise ValueError('invalid public text')
    return value


def public_url(value: str) -> str:
    """只保存公开 HTTPS 引用；查询参数只接受公开作品编号，不请求引用地址。"""
    if re.search(r'[\s\x00-\x1f]', value):
        raise ValueError('URL contains whitespace')
    parsed = urlsplit(value)
    host = parsed.hostname or ''
    if (len(value) > 1000 or parsed.scheme != 'https' or not host or '.' not in host
            or host.endswith(('.local', '.localhost', '.internal')) or parsed.username or parsed.password
            or parsed.port not in (None, 443) or parsed.fragment):
        raise ValueError('invalid public URL')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError('IP addresses are not public references')
    if any(key not in {'id', 'cid', 'content_id', 'dvd_id'} or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', val)
           for key, val in parse_qsl(parsed.query, keep_blank_values=True)):
        raise ValueError('URL contains private or unsupported parameters')
    return value


class Reference(BaseModel):
    model_config = ConfigDict(extra='forbid', frozen=True)
    provider: str = Field(pattern=r'^[a-z0-9][a-z0-9_-]{0,39}$')
    kind: str = Field(pattern=r'^[a-z][a-z0-9-]{0,39}$')
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{1,100}$')

    @model_validator(mode='after')
    def public_provider(self):
        if self.provider == 'stash':
            raise ValueError('local database ids are not public identities')
        return self


class Crop(BaseModel):
    model_config = ConfigDict(extra='forbid')
    image_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    width: int = Field(gt=0, le=100000)
    height: int = Field(gt=0, le=100000)
    box: tuple[int, int, int, int]

    @model_validator(mode='after')
    def edges(self):
        x0, y0, x1, y1 = self.box
        if not (0 <= x0 < x1 <= self.width and 0 <= y0 < y1 <= self.height):
            raise ValueError('crop outside source image')
        return self


class Claim(BaseModel):
    model_config = ConfigDict(extra='forbid')
    subject: str = Field(min_length=1, max_length=180)
    field: Literal['catalog_title', 'release_date', 'studio', 'series', 'creator', 'performers',
                   'source-id', 'tag', 'tag-mapping', 'cover', 'cover-crop', 'source-result', 'chinese-name',
                   'entity-alias', 'entity-link', 'entity-profile', 'entity-membership']
    value: str | list[str] | Crop
    origin: Literal['manual', 'review', 'source', 'import', 'observed']
    source: str = Field(pattern=r'^[A-Za-z0-9:_@.\-]{1,120}$')
    evidence_url: str | None = None
    original: str | None = None
    language: Literal['zh-CN', 'zh-Hant'] | None = None
    refs: list[Reference] = Field(default_factory=list, max_length=30)
    elapsed_ms: int | None = Field(default=None, ge=0, le=3600000)
    observed_at: datetime | None = None

    @field_validator('evidence_url')
    @classmethod
    def evidence(cls, value):
        return public_url(value) if value is not None else None

    @field_validator('original')
    @classmethod
    def wording(cls, value):
        return public_text(value) if value is not None else None

    @model_validator(mode='after')
    def contract(self):
        self._validate_subject()
        self._validate_value()
        if self.observed_at is not None and self.observed_at.tzinfo is None:
            raise ValueError('observation time requires timezone')
        return self

    def _validate_subject(self):
        if self.field == 'chinese-name':
            if (not self.refs or not self.original or not self.language
                    or not isinstance(self.value, str) or not HAN.search(self.value) or KANA.search(self.value)
                    or len(self.value) > 40 or self.subject != identity_key(self.refs[0])):
                raise ValueError('Chinese name requires public identity, original name and language')
        elif self.field == 'tag-mapping':
            if self.subject != 'vocabulary' or self.original is None:
                raise ValueError('tag mapping requires original wording')
        elif self.field.startswith('entity-'):
            if not self.refs or not re.fullmatch(r'(performer|studio|agency):[A-Za-z0-9:_-]+', self.subject):
                raise ValueError('entity facts require public references')
        elif self.field == 'source-result' and re.fullmatch(r'source:[a-z0-9_-]{1,40}', self.subject):
            pass
        elif not is_jav_code(self.subject) or normalise_code_key(self.subject) != self.subject:
            raise ValueError('work subject must be a normalized public code')

    def _validate_value(self):
        if self.field == 'cover-crop':
            if not isinstance(self.value, Crop):
                raise ValueError('crop requires source fingerprint and geometry')
        elif isinstance(self.value, Crop):
            raise ValueError('geometry only belongs to cover crops')
        elif self.field in {'cover', 'source-id', 'entity-link'}:
            if not isinstance(self.value, str):
                raise ValueError('cover requires a public URL')
            public_url(self.value)
        elif isinstance(self.value, list):
            if self.field != 'performers' or not 1 <= len(self.value) <= 100:
                raise ValueError('only performer lists accept arrays')
            for name in self.value:
                public_text(name)
        else:
            public_text(self.value)
        if self.field == 'source-result' and (not isinstance(self.value, str) or self.value not in {'success', 'not-found', 'error', 'timeout', 'rate-limit'}):
            raise ValueError('invalid source result')


def identity_key(ref: Reference) -> str:
    return f'performer:{ref.provider}:{ref.kind}:{ref.id}'


class Snapshot(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schema_version: Literal[1] = 1
    peach: str = Field(default=__version__, pattern=r'^[0-9A-Za-z.+-]{1,64}$')
    period: str = Field(pattern=r'^\d{4}-W\d{2}$')
    claims: list[Claim] = Field(max_length=100000)
    omitted: int = Field(default=0, ge=0)

    @field_validator('period')
    @classmethod
    def iso_week(cls, value):
        date.fromisocalendar(int(value[:4]), int(value[6:]), 1)
        return value


def parse_snapshot(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('duplicate contribution field')
            result[key] = value
        return result
    try:
        value = json.loads(raw, object_pairs_hook=unique)
    except RecursionError as error:
        raise ValueError('contribution nesting is too deep') from error
    if not isinstance(value, dict) or 'peach' not in value:
        raise ValueError('contribution version is required')
    return Snapshot.model_validate(value)


def claim_key(claim: Claim) -> str:
    value = claim.model_dump(mode='json', exclude_none=True)
    identity = {key: value[key] for key in ('subject', 'field', 'value', 'original', 'language') if key in value}
    return hashlib.sha256(json.dumps(identity, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def _entity_claims(con):
    # 复用实体种子的公开事实投影，跳过个人名称选择及本地行号。
    from .seed_pack import export_pack
    for entity in export_pack(con, version='contribution')['entities']:
        refs = []
        for ref in entity['refs']:
            try:
                refs.append(Reference(**ref))
            except ValueError:
                continue
        if not refs:
            continue
        subject = identity_key(refs[0]).replace('performer:', entity['kind'] + ':', 1)
        common = dict(subject=subject, refs=refs, origin='source')
        for alias in entity['aliases']:
            if not alias['source'].startswith(('user:', 'review:', 'auto:seed')):
                yield dict(**common, field='entity-alias', value=alias['alias'], source=alias['source'])
        for link in entity['links']:
            yield dict(**common, field='entity-link', value=link['url'], source='entity-link')
        profile = entity.get('profile') or {}
        for field, value in profile.get('fields', {}).items():
            if isinstance(value, (str, int, float)):
                yield dict(**common, field='entity-profile', original=field, value=str(value), source=profile['source'])
        for relation in ('agency', 'maker'):
            if relation in entity:
                yield dict(**common, field='entity-membership', original=relation,
                           value=entity[relation]['name'], source=entity[relation]['source'])


def _work_cast(con, codes):
    """标记带个人统称的阵容，防止分享昵称或把名单截成半份。"""
    cast = {}
    rows = con.execute("""
        SELECT ae.asset_id,
               CASE WHEN (json_valid(e.metadata_json)
                          AND json_extract(e.metadata_json, '$.name_preference.source') GLOB 'user:*')
                          OR EXISTS (SELECT 1 FROM entity_alias a WHERE a.entity_id=e.id
                                     AND a.source='user:preferred-name')
                    THEN NULL ELSE e.canonical_name END
          FROM asset_entity ae JOIN entity e ON e.id=ae.entity_id
         WHERE e.kind='performer'
        """)
    for aid, name in rows:
        if aid in codes:
            cast.setdefault(codes[aid], set()).add(name)
    return cast


def collect(contract, config) -> Snapshot:
    """从已有资料、决定与缓存取公开字段；不读媒体正文，不抓取，也不改账本。"""
    from .genre_taxonomy import CONTENT_GENRES
    claims: dict[str, Claim] = {}
    omitted = 0

    def add(**data):
        nonlocal omitted
        try:
            claim = Claim(**data)
        except ValueError:
            omitted += 1
        else:
            claims[hashlib.sha256(claim.model_dump_json(exclude_none=True).encode()).hexdigest()] = claim

    with contract.read_connection() as con:
        con.execute('BEGIN')
        works = list(con.execute('SELECT id,code,catalog_title,release_date,studio,series,creator,field_owners'
                                 ' FROM asset WHERE disposal IS NULL AND code IS NOT NULL'))
        codes = {}
        for row in works:
            if not is_jav_code(row['code']):
                continue
            code = codes[row['id']] = normalise_code_key(row['code'])
            owners = parse_owners(row['field_owners'])
            for field in FIELDS:
                if not row[field]:
                    continue
                source = owners.get(field, 'observed')
                if 'seed' in source:
                    continue
                origin = ('manual' if source.startswith('user:') else 'review' if source.startswith('review:')
                          else 'import' if 'stash' in source else 'source' if source.startswith('auto:') else 'observed')
                add(subject=code, field=field, value=str(row[field]), source=source, origin=origin)
        for code, names in _work_cast(con, codes).items():
            if None in names:
                omitted += 1
                continue
            add(subject=code, field='performers', value=sorted(names), origin='observed', source='ledger')
        for aid, tag, source in con.execute('SELECT asset_id,tag,source FROM asset_tag'):
            if aid in codes and tag in CONTENT_GENRES.values() and 'seed' not in source:
                add(subject=codes[aid], field='tag', value=tag, source=source,
                    origin='manual' if source == 'web-user' else 'source')
        for raw, tag in con.execute('SELECT raw_genre,peach_tag FROM genre_decision'):
            if tag is None or tag in CONTENT_GENRES.values():
                add(subject='vocabulary', field='tag-mapping', original=raw,
                    value=tag if tag else 'non-content', origin='review', source='user:genre')
        for data in _entity_claims(con):
            add(**data)
    # 人物统称与任意手动别名是个人选择；只有明确提交的中日对应进入公开候选。
    proposal_root = config.directory('state') / 'seed-name-proposals'
    for path in sorted(proposal_root.glob('*.json')):
        add(**json.loads(path.read_text(encoding='utf-8')))
    from .seed_observations import cached_claims
    for data in cached_claims(config, contract, set(codes.values())):
        add(**data)
    return Snapshot(period=datetime.now(timezone.utc).strftime('%G-W%V'), claims=list(claims.values()), omitted=omitted)
