CREATE SEQUENCE "public"."f1_asset_assignment_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE UNIQUE INDEX f1_assets_serial_unique ON f1_assets (upper(trim(serial))) WHERE trim(serial) <> '';
--> statement-breakpoint
ALTER TABLE f1_assets ADD CONSTRAINT f1_assets_stock_check CHECK (total > 0 AND available >= 0 AND quarantined >= 0 AND available + quarantined <= total AND (NOT serialized OR (total = 1 AND trim(serial) <> '')) AND cost_cents >= 0);
--> statement-breakpoint
ALTER TABLE f1_asset_assignments ADD CONSTRAINT f1_assignments_quantity_check CHECK (quantity > 0 AND returned >= 0 AND returned <= quantity);
--> statement-breakpoint
ALTER TABLE f1_asset_services ADD CONSTRAINT f1_services_quantity_check CHECK (quantity > 0 AND cost_cents >= 0);
--> statement-breakpoint
ALTER TABLE f1_asset_transfers ADD CONSTRAINT f1_transfers_quantity_check CHECK (quantity > 0);
--> statement-breakpoint
CREATE UNIQUE INDEX f1_one_pending_transfer_idx ON f1_asset_transfers(assignment_id) WHERE status = 'Pendiente';
--> statement-breakpoint
CREATE INDEX f1_assignments_asset_idx ON f1_asset_assignments(asset_id);
--> statement-breakpoint
CREATE INDEX f1_assignments_user_idx ON f1_asset_assignments(user_id);
--> statement-breakpoint
CREATE INDEX f1_events_asset_idx ON f1_asset_events(asset_id, id);
--> statement-breakpoint
CREATE INDEX f1_events_assignment_idx ON f1_asset_events(assignment_id);
--> statement-breakpoint
CREATE INDEX f1_files_asset_idx ON f1_asset_files(asset_id);
--> statement-breakpoint
CREATE INDEX f1_files_user_idx ON f1_asset_files(user_id);
--> statement-breakpoint
CREATE INDEX f1_incidents_asset_idx ON f1_asset_incidents(asset_id, status);
--> statement-breakpoint
CREATE INDEX f1_incidents_assignment_idx ON f1_asset_incidents(assignment_id);
--> statement-breakpoint
CREATE INDEX f1_incidents_user_idx ON f1_asset_incidents(user_id);
--> statement-breakpoint
CREATE INDEX f1_services_asset_idx ON f1_asset_services(asset_id, status);
--> statement-breakpoint
CREATE INDEX f1_transfers_to_user_idx ON f1_asset_transfers(to_user_id);
--> statement-breakpoint
REVOKE ALL ON f1_assets, f1_asset_assignments, f1_asset_events, f1_asset_files, f1_asset_incidents, f1_asset_services, f1_asset_transfers FROM anon, authenticated;
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('f1-activos', 'f1-activos', false, 30000000, ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm','video/quicktime']) ON CONFLICT (id) DO NOTHING;
