ALTER TABLE "fleet_stations" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "fleet_stations" ADD COLUMN "source" jsonb;--> statement-breakpoint
ALTER TABLE "fleet_stations" ADD CONSTRAINT "fleet_stations_import_key_unique" UNIQUE("import_key");