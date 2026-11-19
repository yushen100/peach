CREATE TABLE scan_pending_asset (
    asset_id INTEGER PRIMARY KEY REFERENCES asset(id) ON DELETE CASCADE
);

INSERT INTO ledger_revision(tbl, n) VALUES('scan_pending_asset', 0);
CREATE TRIGGER rev_scan_pending_asset_insert AFTER INSERT ON scan_pending_asset BEGIN
    UPDATE ledger_revision SET n=n+1 WHERE tbl='scan_pending_asset';
END;
CREATE TRIGGER rev_scan_pending_asset_update AFTER UPDATE ON scan_pending_asset BEGIN
    UPDATE ledger_revision SET n=n+1 WHERE tbl='scan_pending_asset';
END;
CREATE TRIGGER rev_scan_pending_asset_delete AFTER DELETE ON scan_pending_asset BEGIN
    UPDATE ledger_revision SET n=n+1 WHERE tbl='scan_pending_asset';
END;

CREATE TRIGGER cleanup_scan_pending_asset AFTER DELETE ON asset
BEGIN
    DELETE FROM scan_pending_asset WHERE asset_id=OLD.id;
END;
