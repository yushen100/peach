"""FC2 来源缓存中的卖家账号与作品关系；按来源批次可撤回。"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from hashlib import sha256
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit

from .catalog_rules import normalise_code_key
from .coded_text import Said
from .classification import creator_collection_base
from .entities import canonicalize_entity_name, normalize_entity_name, upsert_asset_entity
from .entity_classification import trusted_sql, write_claim

SOURCE = 'script:fc2-seller'
PROVIDERS = {'fc2ppvdb': 'fc2ppv-db.com', 'fc2cmadb': 'fc2cmadb.com',
             'javten': 'javten.com', 'fc2': 'adult.contents.fc2.com'}


def seller_record(payload: dict, provider: str) -> dict | None:
    """只接受对应作品页上的明确卖家名称和 FC2 账号地址。"""
    if not isinstance(payload, dict):
        return None
    code = normalise_code_key(str(payload.get('id') or payload.get('code') or ''))
    name = ' '.join(str(payload.get('label') or '').split())
    url = urlsplit(str(payload.get('seller_url') or ''))
    page = str(payload.get('source_url') or '')
    parsed = urlsplit(page)
    account = re.fullmatch(r'/users/([A-Za-z0-9_-]+)/?', url.path)
    valid_page = (parsed.scheme == 'https' and parsed.netloc == PROVIDERS.get(provider)
                  and re.search(r'(?<!\d)' + re.escape(code.removeprefix('FC2-PPV-')) + r'(?!\d)', parsed.path))
    if not (re.fullmatch(r'FC2-PPV-\d{5,}', code) and valid_page and account
            and url.scheme == 'https' and url.netloc == 'adult.contents.fc2.com'
            and not url.query and not url.fragment and name and len(name) <= 200):
        return None
    if normalize_entity_name(name) in {'fc2', 'fc2ppv', 'fc2-ppv'}:
        return None
    return {'code': code, 'name': name, 'account': account[1],
            'account_url': f'https://adult.contents.fc2.com/users/{account[1]}/',
            'source_url': page, 'provider': provider}


def cached_records(root: Path):
    """逐个读取 FC2 来源快照；失败快照不作为账号证据。"""
    for provider in PROVIDERS:
        for path in sorted(root.glob(f'FC2-PPV-*-{provider}.json')):
            try:
                row = seller_record(json.loads(path.read_text(encoding='utf-8')), provider)
            except (ValueError, TypeError):
                continue
            if row and normalise_code_key(path.name.removesuffix(f'-{provider}.json')) == row['code']:
                yield {**row, 'cache_file': str(path)}


def ingest_name(connection, name: str) -> str:
    """摄取会把 `XXX4K` 这类集合名归到已有账号 `XXX`；计划按同一个名字找账号。"""
    base = creator_collection_base(name)
    if base != name and connection.execute("SELECT 1 FROM entity WHERE kind='creator' AND normalized_name=?",
                                           (normalize_entity_name(base),)).fetchone():
        return base
    return name


def existing_account(connection, rows: list[dict]) -> tuple[int | None, str]:
    """外部账号优先；同名而不同账号保留为冲突。"""
    account = rows[0]['account']
    held = connection.execute("SELECT entity_id FROM entity_external_ref WHERE provider='fc2' "
                              "AND external_kind='creator' AND external_id=?", (account,)).fetchone()
    if held:
        return int(held[0]), ''
    names = {normalize_entity_name(ingest_name(connection, row['name'])) for row in rows}
    found = set()
    for name in names:
        matches = connection.execute("SELECT e.id FROM entity e WHERE e.kind='creator' AND "
            "(e.normalized_name=? OR EXISTS (SELECT 1 FROM entity_alias al WHERE al.entity_id=e.id AND al.normalized_alias=?))",
            (name, name)).fetchall()
        found.update(int(item[0]) for item in matches)
    if len(found) > 1:
        return None, Said('labels.fc2Sellers.nameMatchesAccounts')
    entity_id = next(iter(found), None)
    if entity_id and connection.execute("SELECT 1 FROM entity_external_ref WHERE entity_id=? AND provider='fc2' "
                                       "AND external_kind='creator' AND external_id<>?", (entity_id, account)).fetchone():
        return None, Said('labels.fc2Sellers.nameOtherAccount')
    return entity_id, ''


def _account_groups(connection, groups, skipped):
    names = defaultdict(set)
    for account, rows in groups.items():
        for row in rows:
            names[normalize_entity_name(row['name'])].add(account)
    accounts = []
    for account, rows in sorted(groups.items()):
        entity_id, conflict = existing_account(connection, rows)
        if not entity_id and any(len(names[normalize_entity_name(row['name'])]) > 1 for row in rows):
            conflict = Said('labels.fc2Sellers.sharedName')
        if conflict:
            skipped.append({'account': account, 'reason': conflict})
        else:
            accounts.append({'account': account, 'entity_id': entity_id, 'records': rows})
    return accounts


def collect(connection, root: Path) -> dict:
    """来源账号按作品号与馆藏关联；来源冲突和非馆藏作品不落库。"""
    assets = defaultdict(list)
    for row in connection.execute("SELECT id,code FROM asset WHERE medium='video' AND disposal IS NULL AND code IS NOT NULL"):
        code = normalise_code_key(row[1])
        if code.startswith('FC2-PPV-'):
            assets[code].append(int(row[0]))
    by_code = defaultdict(list)
    for row in cached_records(root):
        if row['code'] in assets:
            by_code[row['code']].append({**row, 'asset_ids': assets[row['code']]})
    groups = defaultdict(list)
    skipped = []
    for code, rows in sorted(by_code.items()):
        if len({row['account'] for row in rows}) != 1:
            skipped.append({'code': code, 'reason': Said('labels.fc2Sellers.conflictingAccounts')})
        else:
            groups[rows[0]['account']].extend(rows)
    accounts = _account_groups(connection, groups, skipped)
    return {'accounts': accounts, 'skipped': skipped}


def _link(connection, entity_id, record, batch):
    if connection.execute('SELECT 1 FROM entity_link WHERE entity_id=? AND url=?',
                          (entity_id, record['account_url'])).fetchone():
        return
    metadata = json.dumps({'source': SOURCE, 'batch': batch, 'source_url': record['source_url']}, ensure_ascii=False)
    stamp = datetime.now(timezone.utc).isoformat()
    connection.execute("INSERT INTO entity_link(entity_id,link_kind,label,url,hostname,is_sensitive,metadata_json,created_at,updated_at) "
                       "VALUES(?,'official','FC2',?,'adult.contents.fc2.com',0,?,?,?)",
                       (entity_id, record['account_url'], metadata, stamp, stamp))


def _claim(connection, entity_id, record, owner):
    if connection.execute("SELECT 1 FROM entity_classification WHERE entity_id=? AND facet='account_role' "
                          "AND value='seller' AND " + trusted_sql(), (entity_id,)).fetchone():
        return
    write_claim(connection, entity_id=entity_id, facet='account_role', value='seller', source=owner,
                source_url=record['source_url'],
                evidence=Said('labels.fc2Sellers.evidence', code=record['code'], name=record['name'],
                              account=record['account_url']),
                status='observed', confidence=1)


def _digest(metadata):
    payload = {key: value for key, value in metadata.items() if key != 'created_payload_digest'}
    return sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _associate(connection, entity_id, name, record, metadata, batch, skipped):
    """把一部作品挂到卖家账号下，返回挂上的账号；一个文件都没挂上时返回 None。

    摄取判定不收（已否决、名字是厂牌、目录名是发行标识）的文件记进 `skipped`；摄取认到的
    账号与计划不同时整批回滚。"""
    payload = {**metadata, **record}
    payload['created_payload_digest'] = _digest(payload)
    linked = None
    for asset_id in record['asset_ids']:
        asset = connection.execute("SELECT code FROM asset WHERE id=? AND medium='video' AND disposal IS NULL", (asset_id,)).fetchone()
        if not asset or normalise_code_key(asset[0]) != record['code']:
            raise ValueError('seller plan is stale: video no longer matches')
        if entity_id and connection.execute("SELECT 1 FROM asset_entity WHERE asset_id=? AND entity_id=? AND role='creator'",
                                            (asset_id, entity_id)).fetchone():
            linked = entity_id
            continue
        landed = upsert_asset_entity(connection, kind='creator', name=name, asset_id=asset_id, role='creator',
            source=batch, metadata=payload, update_entity_metadata=False)
        if landed is None:
            skipped.append({'account': record['account'], 'code': record['code'], 'asset_id': asset_id,
                            'reason': Said('labels.fc2Sellers.rejectedName')})
            continue
        actual = connection.execute('SELECT kind FROM entity WHERE id=?', (landed,)).fetchone()
        if not actual or actual[0] != 'creator':
            raise ValueError('seller account conflicts with a merged performer identity')
        if entity_id and landed != entity_id:
            raise ValueError('seller plan is stale: ingestion resolved a different account')
        entity_id = linked = landed
    return linked


def _install_account(connection, group, batch, skipped):
    first = group['records'][0]
    entity_id = group['entity_id']
    if existing_account(connection, group['records']) != (entity_id, ''):
        raise ValueError('seller plan is stale')
    name = first['name']
    if entity_id:
        held = connection.execute('SELECT kind,canonical_name FROM entity WHERE id=?', (entity_id,)).fetchone()
        if not held or held[0] != 'creator':
            raise ValueError('account identity changed')
        name = held[1]
    metadata = {'source': SOURCE, 'batch': batch, 'account_url': first['account_url']}
    installed = None
    for record in group['records']:
        linked = _associate(connection, entity_id, name, record, metadata, batch, skipped)
        if not linked:
            continue
        entity_id = installed = linked
        _claim(connection, entity_id, record, batch)
        alias = normalize_entity_name(record['name'])
        if alias != normalize_entity_name(name):
            connection.execute('INSERT OR IGNORE INTO entity_alias(entity_id,alias,normalized_alias,source) VALUES(?,?,?,?)',
                               (entity_id, record['name'], alias, batch))
    if not installed:
        return None
    other = connection.execute("SELECT external_id FROM entity_external_ref WHERE entity_id=? AND provider='fc2' "
                               "AND external_kind='creator'", (entity_id,)).fetchone()
    if other and other[0] != first['account']:
        raise ValueError('seller plan is stale: the account is already bound to another FC2 account')
    if not other:
        connection.execute("INSERT INTO entity_external_ref(entity_id,provider,external_kind,external_id,metadata_json) VALUES(?,'fc2','creator',?,?)",
                           (entity_id, first['account'], json.dumps(metadata)))
    _link(connection, entity_id, first, batch)
    return entity_id


def install(connection, frozen: dict, *, batch: str) -> dict:
    """追加卖家关系，保留出演者、扁平字段和既有账号资料。"""
    if not batch.startswith(SOURCE + '@'):
        raise ValueError(f'seller batch must start with {SOURCE}@')
    before = connection.total_changes
    skipped: list[dict] = []
    ids = [_install_account(connection, group, batch, skipped) for group in frozen['accounts']]
    return {'entity_ids': sorted({entity_id for entity_id in ids if entity_id}), 'skipped': skipped,
            'changes': connection.total_changes - before}


def _pending_accounts(connection, frozen: dict, asset_ids=None) -> list[dict]:
    """计划里还有作品没挂上卖家账号的那些账号；`asset_ids` 给了就只看含这些作品的。"""
    wanted = None if asset_ids is None else {int(value) for value in asset_ids}
    linked = {row[0] for row in connection.execute(
        "SELECT asset_id FROM asset_entity WHERE role='creator' AND source LIKE ?", (SOURCE + '@%',))}
    accounts = []
    for group in frozen['accounts']:
        ids = {asset_id for record in group['records'] for asset_id in record['asset_ids']}
        if (wanted is None or ids & wanted) and ids - linked:
            accounts.append(group)
    return accounts


def pending(connection, root: Path) -> bool:
    """整库补一次时有没有要挂的，只读；有才先备份。"""
    return bool(_pending_accounts(connection, collect(connection, root)))


def land(connection, root: Path, *, asset_ids=None, now: str | None = None) -> dict:
    """自动落库那一步：来源快照已写明卖家、还没挂上卖家账号的 FC2 作品，按同一份计划挂上。

    `asset_ids` 给了就只处理含这些作品的账号——刚采完资料的那几部，以及后来才认出番号
    的副本；不给就是整库补一次（升级补修）。已挂上的跳过，所以重复跑不改任何东西；
    计划过期或与已合并的人物冲突时这一批整批不写，留给下一轮。批次号按时刻记，整批可撤。
    """
    frozen = collect(connection, root)
    accounts = _pending_accounts(connection, frozen, asset_ids)
    if not accounts:
        return {'entity_ids': [], 'skipped': frozen['skipped'], 'changes': 0}
    moment = now or datetime.now(timezone.utc).isoformat()
    return install(connection, {**frozen, 'accounts': accounts}, batch=f'{SOURCE}@{moment}')


def planned_revert(connection, source: str, batch: str) -> list[dict]:
    if source != SOURCE:
        return []
    rows = connection.execute("SELECT DISTINCT e.id,e.canonical_name,b.source FROM entity e JOIN ("
        "SELECT entity_id,source FROM asset_entity WHERE role='creator' AND source LIKE ? UNION "
        "SELECT entity_id,source FROM entity_classification WHERE facet='account_role' AND value='seller' AND source LIKE ?) b ON b.entity_id=e.id",
        (SOURCE + '@%', SOURCE + '@%'))
    return [{'entity_id': row[0], 'name': row[1], 'batch': row[2]} for row in rows if not batch or row[2] == batch]


def _referenced(connection, entity_id):
    for (table,) in connection.execute("SELECT name FROM sqlite_schema WHERE type='table'"):
        for fk in connection.execute(f'PRAGMA foreign_key_list("{table}")'):
            if fk[2] == 'entity' and connection.execute(f'SELECT 1 FROM "{table}" WHERE "{fk[3]}"=? LIMIT 1', (entity_id,)).fetchone():
                return True
    return False


def revert(connection, rows: list[dict]) -> int:
    """撤回本批卖家断言与关系；有其他引用的实体继续保留。"""
    removed = 0
    for row in rows:
        entity_id, batch = row['entity_id'], row['batch']
        removed += connection.execute("DELETE FROM asset_entity WHERE entity_id=? AND role='creator' AND source=?", (entity_id, batch)).rowcount
        connection.execute('DELETE FROM entity_classification WHERE entity_id=? AND source=?', (entity_id, batch))
        entity = connection.execute('SELECT metadata_json,canonical_name,normalized_name FROM entity WHERE id=?', (entity_id,)).fetchone()
        metadata = json.loads(entity[0] or '{}') if entity else {}
        original_name = canonicalize_entity_name('creator', metadata.get('name', ''))
        if (metadata.get('source') == SOURCE and metadata.get('batch') == batch
                and entity[1] == original_name and entity[2] == normalize_entity_name(original_name)
                and metadata.get('created_payload_digest') == _digest(metadata) and not _referenced(connection, entity_id)):
            connection.execute('DELETE FROM entity WHERE id=?', (entity_id,))
    return removed
