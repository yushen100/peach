"""页面读取已提交结果的轻量版本；任务心跳不参与资料失效。"""
from .review_csv import candidate_root_version
from .web_state import path_version


#: 每个版本键覆盖的账本表。前端按键刷新一组页面（`frontend/src/react/result-updates.tsx`
#: 的 `READINGS`），那些页面背后按表缓存的计算读到的表必须落在刷新它的某个键里，
#: 否则服务端已经换了新结果，页面却不来取。对照由 `tests/test_ledger_revision.py` 的
#: `ResultVersionTablesTests` 核对。
RESULT_TABLES = {
    'catalog': ('asset', 'asset_catalog', 'asset_entity', 'asset_tag', 'asset_subtitle', 'asset_preference',
                'asset_tag_preference', 'entity', 'entity_alias', 'entity_redirect',
                'entity_classification', 'entity_identity_link', 'entity_link', 'entity_external_ref',
                'entity_membership', 'label_maker', 'performer_profile', 'asset_quality_goal',
                'playlist', 'playlist_item', 'watch_queue'),
    'follow': ('follow_item', 'follow_source', 'follow_author_alias', 'entity', 'profile'),
    'discoveries': ('feed_source', 'feed_item', 'feed_discovery', 'feed_discovery_entity', 'watch_queue'),
    'review': ('review_decision', 'genre_decision'),
}


def result_versions(contract):
    """复用账本触发器和文件版本，跨线程、CLI 写入和进程重启均可比较。

    后台任务写账本后，按表缓存的那几页先回旧值、另起重算（ADR-0146）；重算写回时版本已经
    不会再变，所以每个账本键带上自己那几张表的写回次数，页面看到它变了再取一次新值。
    写回按表记：一份只读关注表的结果写回，不让馆藏那一组页面也跟着重取。
    """
    with contract.cache_lock:
        landed = dict(contract.cache_landed)
    result = {key: f"{contract.ledger_revision(tables)}:{sum(landed.get(table, 0) for table in tables)}"
              for key, tables in RESULT_TABLES.items()}
    result['review'] += ':' + str(candidate_root_version(contract.candidate_root))
    result['artwork'] = ':'.join(str(path_version(root)) for root in (
        contract.cover_root, contract.avatar_root, contract.logo_root, contract.poster_root,
        contract.timeline_root))
    return result
