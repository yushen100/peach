"""女优中文名的主动贡献；姓名偏好不自动成为公共译名。"""
from .fsutil import atomic_write_text
from .performer_header import page_names
from .performer_profiles import read_profile
from .seed_contributions import Claim, Reference, claim_key, identity_key, public_url
from .user_messages import UserValueError


def plan(contract, entity_id):
    with contract.read_connection() as con:
        entity = con.execute("SELECT canonical_name FROM entity WHERE id=? AND kind='performer'", (entity_id,)).fetchone()
        if entity is None:
            raise UserValueError('errors.seedSharing.noPerformer')
        refs = []
        for provider, kind, external_id in con.execute(
                'SELECT provider,external_kind,external_id FROM entity_external_ref WHERE entity_id=?'
                ' ORDER BY provider,external_kind,external_id', (entity_id,)):
            try:
                refs.append(Reference(provider=provider, kind=kind, id=external_id))
            except ValueError:
                continue
        page = page_names(read_profile(con, entity_id))
        names = list(dict.fromkeys(n for n in [page['name'], *(a['name'] for a in page['aliases'])] if n))
    return {'canonical_name': entity['canonical_name'], 'original_names': names,
            'refs': [ref.model_dump() for ref in refs], 'eligible': bool(refs and names)}


def save(contract, config, body):
    if type(body.get('entity_id')) is not int:
        raise UserValueError('errors.seedSharing.noPerformer')
    current = plan(contract, body['entity_id'])
    if not current['eligible'] or body.get('original') not in current['original_names']:
        raise UserValueError('errors.seedSharing.noIdentity')
    evidence = body.get('evidence_url')
    if evidence is not None:
        if not isinstance(evidence, str):
            raise UserValueError('errors.seedSharing.invalidEvidence')
        try:
            evidence = public_url(evidence.strip()) if evidence.strip() else None
        except ValueError as error:
            raise UserValueError('errors.seedSharing.invalidEvidence') from error
    refs = [Reference(**ref) for ref in current['refs']]
    try:
        claim = Claim(subject=identity_key(refs[0]), field='chinese-name', value=body.get('name'),
                      language=body.get('language'), original=body['original'], refs=refs,
                      source='user:public-name', origin='manual', evidence_url=evidence)
    except ValueError as error:
        raise UserValueError('errors.seedSharing.invalidName') from error
    path = config.directory('state') / 'seed-name-proposals' / (claim_key(claim) + '.json')
    atomic_write_text(path, claim.model_dump_json(exclude_none=True))
    return {'ok': True, 'status': 'candidate', 'key': claim_key(claim)}
