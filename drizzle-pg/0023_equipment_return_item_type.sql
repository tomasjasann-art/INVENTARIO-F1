ALTER TABLE "equipment_returns" ADD COLUMN IF NOT EXISTS "item_type" text DEFAULT 'EQUIPO' NOT NULL;
