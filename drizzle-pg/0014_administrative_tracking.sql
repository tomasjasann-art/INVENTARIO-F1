ALTER TABLE "fleet_assignments" ALTER COLUMN "driver_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet_assignments" ADD COLUMN "tracking_mode" text DEFAULT 'OPERATIVO' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet_assignments" ADD COLUMN "responsible_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Preserve journeys already started, including their evidence and account attribution.
-- Unstarted administrative assignments become simple records, without fabricating a trip.
UPDATE public.fleet_assignments a
SET tracking_mode = 'ADMINISTRATIVO',
    responsible_name = COALESCE((SELECT display_name FROM public.app_users u WHERE u.id = a.driver_id), ''),
    driver_id = NULL, expected_start = '', expected_end = '', end_date = a.service_date,
    plan_status = 'CONFIRMADA', reason = ''
FROM public.fleet_vehicles v
WHERE v.id = a.vehicle_id AND v.usage = 'ADMINISTRACION' AND a.started_at = '';
--> statement-breakpoint
ALTER TABLE public.fleet_assignments ADD CONSTRAINT fleet_tracking_mode_values CHECK (
  (tracking_mode = 'OPERATIVO' AND driver_id IS NOT NULL)
  OR (tracking_mode = 'ADMINISTRATIVO' AND driver_id IS NULL AND started_at = '' AND ended_at = ''
      AND initial_km IS NULL AND final_km IS NULL AND jsonb_array_length(start_photos) = 0 AND jsonb_array_length(end_photos) = 0)
);
