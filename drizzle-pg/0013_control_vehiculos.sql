CREATE TABLE "fleet_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"service_date" text NOT NULL,
	"end_date" text NOT NULL,
	"expected_start" text NOT NULL,
	"expected_end" text NOT NULL,
	"coordinator" text DEFAULT '' NOT NULL,
	"ceco" text DEFAULT '' NOT NULL,
	"site" text DEFAULT '' NOT NULL,
	"final_zone" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"plan_status" text DEFAULT 'CONFIRMADA' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"initial_km" double precision,
	"final_km" double precision,
	"started_at" text DEFAULT '' NOT NULL,
	"ended_at" text DEFAULT '' NOT NULL,
	"start_photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"end_photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_registered_by" text DEFAULT '' NOT NULL,
	"end_registered_by" text DEFAULT '' NOT NULL,
	"start_notes" text DEFAULT '' NOT NULL,
	"end_notes" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fleet_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"kind" text NOT NULL,
	"provider" text DEFAULT '' NOT NULL,
	"reference" text NOT NULL,
	"start_date" text NOT NULL,
	"expiry_date" text NOT NULL,
	"attachment" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fleet_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"assignment_id" integer,
	"date" text NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'GAL' NOT NULL,
	"fuel" text DEFAULT '' NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"odometer" double precision,
	"provider" text DEFAULT '' NOT NULL,
	"reference" text NOT NULL,
	"collector" text DEFAULT '' NOT NULL,
	"invoice_id" integer,
	"maintenance_type" text DEFAULT '' NOT NULL,
	"next_km" double precision,
	"attachment" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"fingerprint" text NOT NULL,
	"created_by" text NOT NULL,
	CONSTRAINT "fleet_expenses_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
ALTER TABLE "fleet_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fleet_idle" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"date" text NOT NULL,
	"minutes" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet_idle" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fleet_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"number" text NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text NOT NULL,
	"total_cents" integer NOT NULL,
	"attachment" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fleet_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"date" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reference" text NOT NULL,
	"attachment" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fleet_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"district" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"fuels" text DEFAULT '' NOT NULL,
	"hours" text DEFAULT '' NOT NULL,
	"restrictions" text DEFAULT '' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"verified" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet_stations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fleet_vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"plate" text NOT NULL,
	"ceco" text DEFAULT '' NOT NULL,
	"usage" text DEFAULT 'OPERACIONES' NOT NULL,
	"tenure" text DEFAULT 'PROPIO' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"engine" text DEFAULT '' NOT NULL,
	"chassis" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"title_date" text DEFAULT '' NOT NULL,
	"year" integer,
	"status" text DEFAULT 'OPERATIVO' NOT NULL,
	"target" double precision DEFAULT 30 NOT NULL,
	"initial_km" double precision DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	CONSTRAINT "fleet_vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
ALTER TABLE "fleet_vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fleet_assignments" ADD CONSTRAINT "fleet_assignments_vehicle_id_fleet_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fleet_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_assignments" ADD CONSTRAINT "fleet_assignments_driver_id_app_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_documents" ADD CONSTRAINT "fleet_documents_vehicle_id_fleet_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fleet_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_expenses" ADD CONSTRAINT "fleet_expenses_vehicle_id_fleet_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fleet_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_expenses" ADD CONSTRAINT "fleet_expenses_assignment_id_fleet_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."fleet_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_expenses" ADD CONSTRAINT "fleet_expenses_invoice_id_fleet_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."fleet_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_idle" ADD CONSTRAINT "fleet_idle_vehicle_id_fleet_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fleet_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_payments" ADD CONSTRAINT "fleet_payments_invoice_id_fleet_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."fleet_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fleet_vehicle_daily_assignment" ON "fleet_assignments" USING btree ("vehicle_id","service_date");--> statement-breakpoint
CREATE INDEX "fleet_assignment_driver_date" ON "fleet_assignments" USING btree ("driver_id","service_date");--> statement-breakpoint
CREATE UNIQUE INDEX "fleet_document_renewal" ON "fleet_documents" USING btree ("vehicle_id","kind","reference","expiry_date");--> statement-breakpoint
CREATE INDEX "fleet_document_vehicle_expiry" ON "fleet_documents" USING btree ("vehicle_id","expiry_date");--> statement-breakpoint
CREATE INDEX "fleet_expense_vehicle_date" ON "fleet_expenses" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "fleet_expense_invoice" ON "fleet_expenses" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "fleet_expense_assignment" ON "fleet_expenses" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fleet_idle_vehicle_date" ON "fleet_idle" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "fleet_invoice_provider_number" ON "fleet_invoices" USING btree ("provider","number");--> statement-breakpoint
CREATE UNIQUE INDEX "fleet_payment_reference" ON "fleet_payments" USING btree ("invoice_id","reference");--> statement-breakpoint
-- Solo el servidor de Logística F1 accede a estas tablas. La API valida rol y propiedad.
REVOKE ALL ON TABLE public.fleet_vehicles, public.fleet_assignments, public.fleet_documents, public.fleet_expenses, public.fleet_idle, public.fleet_invoices, public.fleet_payments, public.fleet_stations FROM anon, authenticated;
--> statement-breakpoint
ALTER TABLE public.fleet_vehicles ADD CONSTRAINT fleet_vehicle_values CHECK (initial_km >= 0 AND target > 0 AND usage IN ('ADMINISTRACION','OPERACIONES') AND tenure IN ('PROPIO','ALQUILADO') AND status IN ('OPERATIVO','MANTENIMIENTO','FUERA_SERVICIO'));
--> statement-breakpoint
ALTER TABLE public.fleet_assignments ADD CONSTRAINT fleet_journey_values CHECK (
  (initial_km IS NULL OR initial_km >= 0) AND (final_km IS NULL OR (initial_km IS NOT NULL AND final_km >= initial_km))
  AND (started_at = '' OR (initial_km IS NOT NULL AND jsonb_array_length(start_photos) = 7))
  AND (ended_at = '' OR (started_at <> '' AND final_km IS NOT NULL AND jsonb_array_length(end_photos) = 7))
  AND plan_status IN ('CONFIRMADA','POR_CONFIRMAR','NO_SALIO','CANCELADA')
  AND (plan_status NOT IN ('NO_SALIO','CANCELADA') OR (reason <> '' AND started_at = ''))
);
--> statement-breakpoint
CREATE UNIQUE INDEX fleet_one_open_vehicle ON public.fleet_assignments(vehicle_id) WHERE started_at <> '' AND ended_at = '';
--> statement-breakpoint
CREATE UNIQUE INDEX fleet_one_open_driver ON public.fleet_assignments(driver_id) WHERE started_at <> '' AND ended_at = '';
--> statement-breakpoint
ALTER TABLE public.fleet_expenses ADD CONSTRAINT fleet_expense_values CHECK (amount_cents > 0 AND quantity >= 0 AND unit_price >= 0 AND kind IN ('COMBUSTIBLE','PEAJE','MANTENIMIENTO') AND unit IN ('GAL','L','M3') AND (kind <> 'COMBUSTIBLE' OR (quantity > 0 AND odometer IS NOT NULL)));
--> statement-breakpoint
ALTER TABLE public.fleet_idle ADD CONSTRAINT fleet_idle_day_limit CHECK (minutes BETWEEN 0 AND 1440);
--> statement-breakpoint
ALTER TABLE public.fleet_invoices ADD CONSTRAINT fleet_invoice_amount CHECK (total_cents > 0);
--> statement-breakpoint
ALTER TABLE public.fleet_payments ADD CONSTRAINT fleet_payment_amount CHECK (amount_cents > 0);
--> statement-breakpoint
ALTER TABLE public.fleet_documents ADD CONSTRAINT fleet_document_dates CHECK (expiry_date >= start_date AND kind IN ('SOAT','REVISION_TECNICA','SEGURO'));
--> statement-breakpoint
ALTER TABLE public.fleet_stations ADD CONSTRAINT fleet_station_coordinates CHECK ((latitude IS NULL OR latitude BETWEEN -90 AND 90) AND (longitude IS NULL OR longitude BETWEEN -180 AND 180) AND (NOT verified OR (latitude IS NOT NULL AND longitude IS NOT NULL)));
