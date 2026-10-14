CREATE INDEX IF NOT EXISTS "equipment_returns_source_movement_id_idx" ON "equipment_returns" USING btree ("source_movement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_returns_stock_movement_id_idx" ON "equipment_returns" USING btree ("stock_movement_id");
