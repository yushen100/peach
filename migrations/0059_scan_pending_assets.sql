CREATE TABLE scan_pending_asset (
    asset_id INTEGER PRIMARY KEY REFERENCES asset(id) ON DELETE CASCADE
);

CREATE TRIGGER cleanup_scan_pending_asset AFTER DELETE ON asset
BEGIN
    DELETE FROM scan_pending_asset WHERE asset_id=OLD.id;
END;
