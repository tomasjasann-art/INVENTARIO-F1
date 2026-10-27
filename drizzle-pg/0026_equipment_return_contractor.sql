ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "dismantling_contractor_document" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "dismantling_contractor_name" text DEFAULT '' NOT NULL;
