"""`POST /api/item-edit`：详情页编辑框的一次保存（ADR-0165）。"""
from __future__ import annotations

from .item_edit import apply_item_edit
from .web_catalog import q_item, write_item_tag
from .web_state import WebContract


def w_item_edit(contract: WebContract, body):
    """字段、恢复自动、演员与标签在一个事务里写完，回这一部的最新详情。

    请求体：`id`、`expected_revision`（打开编辑框时读到的版本）、`fields`（字段名 → 新值，
    厂牌与系列给 `{id}` 或 `{name}`）、`restore`（交回自动采集的字段名）、
    `performers.add` / `performers.remove`、`tags.add` / `tags.remove`。
    """
    asset_id = int(body["id"])
    with contract.write_transaction() as connection:
        receipt = apply_item_edit(connection, asset_id, body, write_tag=write_item_tag)
    contract.cache_bust()
    return {"ok": True, "receipt": receipt, "item": q_item(contract, asset_id)}
