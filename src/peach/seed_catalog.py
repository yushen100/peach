"""随版本分发的已复核公开断言；投票数永远不是采纳条件。"""
from functools import lru_cache
import hashlib

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .project_root import PROJECT_ROOT
from .seed_contributions import Claim, public_text, public_url

DEFAULT_PACK = PROJECT_ROOT / 'resources/seed/metadata.json'


class Fact(BaseModel):
    model_config = ConfigDict(extra='forbid')
    claim: Claim
    evidence_url: str
    reason: str
    preferred: bool = False

    @field_validator('evidence_url')
    @classmethod
    def evidence(cls, value):
        return public_url(value)

    @field_validator('reason')
    @classmethod
    def explanation(cls, value):
        return public_text(value)


class Pack(BaseModel):
    model_config = ConfigDict(extra='forbid')
    format: int = Field(ge=1, le=1)
    revision: int = Field(ge=1)
    facts: dict[str, Fact]
    withdrawals: dict[str, str]


@lru_cache(maxsize=4)
def _parsed(raw):
    pack = Pack.model_validate_json(raw)
    from .seed_contributions import claim_key
    preferred = set()
    for key, fact in pack.facts.items():
        if key != claim_key(fact.claim) or key in pack.withdrawals or fact.claim.field == 'source-result':
            raise ValueError('invalid reviewed fact')
        slot = fact.claim.subject, fact.claim.field, fact.claim.original, fact.claim.language
        if fact.preferred and slot in preferred:
            raise ValueError('conflicting preferred facts')
        if fact.preferred:
            preferred.add(slot)
    return pack


@lru_cache(maxsize=1)
def _bundled():
    return _parsed(DEFAULT_PACK.read_bytes())


def load(path=None):
    return _parsed(path.read_bytes()) if path is not None else _bundled()


@lru_cache(maxsize=1)
def indexes():
    people, works, vocabulary = {}, {}, {}
    for fact in load().facts.values():
        if not fact.preferred:
            continue
        claim = fact.claim
        if claim.field == 'chinese-name':
            for ref in claim.refs:
                people.setdefault((ref.provider, ref.kind, ref.id), []).append(fact)
        elif claim.field == 'tag-mapping':
            from .genre_taxonomy import CONTENT_GENRES, normalise_genre
            if claim.value == 'non-content' or claim.value in CONTENT_GENRES.values():
                vocabulary[normalise_genre(claim.original)] = None if claim.value == 'non-content' else claim.value
        else:
            works.setdefault(claim.subject, []).append(fact)
    return people, works, vocabulary


def performer_pairs(connection, entity_id):
    """必须有公开编号命中；不凭同名跨实体套用译名。"""
    refs = {tuple(row) for row in connection.execute(
        'SELECT provider,external_kind,external_id FROM entity_external_ref WHERE entity_id=?', (entity_id,))}
    pairs = {}
    matching = {id(fact): fact for ref in refs for fact in indexes()[0].get(ref, ())}
    for fact in sorted(matching.values(), key=lambda f: f.claim.language != 'zh-CN'):
        claim = fact.claim
        if (claim.field == 'chinese-name' and fact.preferred
                and any((r.provider, r.kind, r.id) in refs for r in claim.refs)):
            # 引用在本机对应多份人物时留给身份复核，不把同名档案一并中文化。
            hits = {row[0] for ref in claim.refs for row in connection.execute(
                'SELECT entity_id FROM entity_external_ref WHERE provider=? AND external_kind=? AND external_id=?',
                (ref.provider, ref.kind, ref.id))}
            if hits == {entity_id}:
                pairs[claim.value, claim.original] = fact.evidence_url
    return pairs


def work(code):
    """供资料链读取已复核作品字段；不包含未批准候选或来源错误记忆。"""
    facts = indexes()[1].get(code, ())
    values = {}
    for fact in facts:
        claim = fact.claim
        if claim.field in {'catalog_title', 'release_date', 'studio', 'series', 'creator', 'performers'}:
            values[claim.field] = claim.value
    return values


def payload(code):
    pack = load()
    facts = indexes()[1].get(code, ())
    values = work(code)
    covers = [fact.claim.value for fact in facts if fact.claim.field == 'cover']
    tags = [fact.claim.value for fact in facts if fact.claim.field == 'tag']
    if not values and not covers and not tags:
        return None
    mapped = {'catalog_title': 'title', 'studio': 'maker', 'release_date': 'release_date', 'series': 'series'}
    result = {mapped[key]: value for key, value in values.items() if key in mapped}
    if 'performers' in values:
        result['actresses'] = [{'japanese_name': name} for name in values['performers']]
    if covers:
        result['cover_url'], result['cover_urls'] = covers[0], covers
    if tags:
        result['genres'] = tags
    return {'id': code, 'source_url': facts[0].evidence_url, **result,
            'seed_revision': pack.revision, 'seed_facts': [fact.model_dump(mode='json', exclude_none=True) for fact in facts]}


def crop(code, body, size):
    """公共裁切只复用同一张图片；摘要和尺寸有一项不同都不采用。"""
    from .jav_poster_crop import manual_record
    for fact in indexes()[1].get(code, ()):
        if fact.claim.field != 'cover-crop':
            continue
        value = fact.claim.value
        if (value.width, value.height) == size and hashlib.sha256(body).hexdigest() == value.image_sha256:
            result = manual_record(*size, dict(zip(('x0', 'y0', 'x1', 'y1'), value.box)))
            return {**result, 'source': 'auto:public-seed', 'seed_revision': load().revision} if result else None
    return None


def current_candidate(candidate):
    if candidate.get('source') != 'public-seed':
        return True
    return candidate.get('seed_revision') == load().revision and payload(candidate.get('provider_id')) is not None
