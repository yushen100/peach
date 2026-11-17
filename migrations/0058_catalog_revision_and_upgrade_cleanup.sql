-- 编目聚合不随起播计数失效，完整 asset 版本仍供观看筛选与播放统计使用。
INSERT INTO ledger_revision(tbl, n) VALUES('asset_catalog', 0);
CREATE TRIGGER rev_asset_catalog_insert AFTER INSERT ON asset BEGIN
  UPDATE ledger_revision SET n=n+1 WHERE tbl='asset_catalog';
END;
CREATE TRIGGER rev_asset_catalog_delete AFTER DELETE ON asset BEGIN
  UPDATE ledger_revision SET n=n+1 WHERE tbl='asset_catalog';
END;
CREATE TRIGGER rev_asset_catalog_update AFTER UPDATE OF
  id, location, path, name, medium, size, mtime, hash_kind, hash, creator, studio, series, code,
  duration, width, height, vcodec, fps, has_audio, ctx_length, ctx_orient, ctx_quality, ctx_pace,
  ctx_people, rating, o_count, watch_ratio, source_id, stash_scene_id, snapshot_path,
  first_seen, last_seen, feedback, disposal, feedback_at, release_date, catalog_title,
  original_title, field_owners, mutation_revision, region, disposal_reason
ON asset BEGIN
  UPDATE ledger_revision SET n=n+1 WHERE tbl='asset_catalog';
END;

-- 补修状态由资产派生，升级时清理旧孤儿，后续删除也由触发器收齐。
DELETE FROM ledger_upgrade_item WHERE NOT EXISTS (
  SELECT 1 FROM asset WHERE asset.id=ledger_upgrade_item.asset_id
);
CREATE TRIGGER asset_delete_upgrade_items AFTER DELETE ON asset BEGIN
  DELETE FROM ledger_upgrade_item WHERE asset_id=OLD.id;
END;
