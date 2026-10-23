DROP INDEX "fleet_vehicle_daily_assignment";--> statement-breakpoint
ALTER TABLE "fleet_assignments" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "fleet_assignments" ADD COLUMN "source" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "fleet_vehicle_daily_assignment" ON "fleet_assignments" USING btree ("vehicle_id","service_date") WHERE "fleet_assignments"."tracking_mode" <> 'HISTORICO';--> statement-breakpoint
ALTER TABLE "fleet_assignments" ADD CONSTRAINT "fleet_assignments_import_key_unique" UNIQUE("import_key");
--> statement-breakpoint
ALTER TABLE public.fleet_assignments DROP CONSTRAINT fleet_tracking_mode_values,
ADD CONSTRAINT fleet_tracking_mode_values CHECK (
  (tracking_mode = 'OPERATIVO' AND driver_id IS NOT NULL AND import_key IS NULL AND source IS NULL)
  OR (tracking_mode = 'ADMINISTRATIVO' AND driver_id IS NULL AND started_at = '' AND ended_at = ''
      AND initial_km IS NULL AND final_km IS NULL AND jsonb_array_length(start_photos) = 0 AND jsonb_array_length(end_photos) = 0 AND import_key IS NULL AND source IS NULL)
  OR (tracking_mode = 'HISTORICO' AND driver_id IS NULL AND responsible_name <> '' AND started_at = '' AND ended_at = ''
      AND expected_start = '' AND expected_end = '' AND end_date = service_date AND initial_km IS NOT NULL AND final_km IS NOT NULL
      AND jsonb_array_length(start_photos) = 0 AND jsonb_array_length(end_photos) = 0
      AND plan_status = 'CONFIRMADA' AND import_key IS NOT NULL AND import_key <> '' AND source IS NOT NULL AND source ? 'format' AND source->>'format' = 'HISTORICO')
);
