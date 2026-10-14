ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "batch_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "batch_item" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "site" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "warehouse" text DEFAULT 'RED' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "batch_comments" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "network_component" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "sub_project" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "source_project" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "hardware_task" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "length" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "condition" text DEFAULT 'USADO OPERATIVO' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "volume_m3" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "entel_label_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "model_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "panoramic_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_movement_date" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_document" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_gr_link" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_project" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_origin" text DEFAULT 'DESINSTALACIÓN DE SITIO' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_coordinator_entel" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_origin_site" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_stock_location" text DEFAULT 'MO COMPANY' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_unit_measure" text DEFAULT 'UND' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_equipment_status" text DEFAULT 'USADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_condition" text DEFAULT 'OPERATIVO' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "receipt_unit_cost_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "equipment_returns" SET "batch_code" = "return_code" WHERE "batch_code" = '';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_returns_batch_code_idx" ON "equipment_returns" USING btree ("batch_code","batch_item");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_returns_site_idx" ON "equipment_returns" USING btree ("site");
