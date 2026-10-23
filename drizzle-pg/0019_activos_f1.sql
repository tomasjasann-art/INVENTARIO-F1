CREATE TABLE "f1_asset_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"asset_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"returned" integer DEFAULT 0 NOT NULL,
	"assigned_at" text NOT NULL,
	"expected_return" text DEFAULT '' NOT NULL,
	"returned_at" text DEFAULT '' NOT NULL,
	"assigned_by" text NOT NULL,
	"dni" text DEFAULT '' NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"cost_center" text DEFAULT '' NOT NULL,
	"client" text DEFAULT '' NOT NULL,
	"project" text DEFAULT '' NOT NULL,
	"condition" text NOT NULL,
	"accessories" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "f1_asset_assignments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "f1_asset_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "f1_asset_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"assignment_id" integer,
	"kind" text NOT NULL,
	"actor" text NOT NULL,
	"at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f1_asset_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "f1_asset_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"asset_id" integer,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"linked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "f1_asset_files_path_unique" UNIQUE("path")
);
--> statement-breakpoint
ALTER TABLE "f1_asset_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "f1_asset_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"assignment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'Abierta' NOT NULL,
	"resolution" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f1_asset_incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "f1_asset_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"quantity" integer NOT NULL,
	"date" text NOT NULL,
	"next_due" text DEFAULT '' NOT NULL,
	"provider" text NOT NULL,
	"certificate" text DEFAULT '' NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f1_asset_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "f1_asset_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'Pendiente' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"resolved_at" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f1_asset_transfers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "f1_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"item" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"serial" text DEFAULT '' NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"serialized" boolean DEFAULT true NOT NULL,
	"total" integer NOT NULL,
	"available" integer NOT NULL,
	"quarantined" integer DEFAULT 0 NOT NULL,
	"condition" text DEFAULT 'Bueno' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"purchase_date" text DEFAULT '' NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'PEN' NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"requires_calibration" boolean DEFAULT false NOT NULL,
	"calibration_due" text DEFAULT '' NOT NULL,
	"maintenance_due" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"photo_id" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "f1_assets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "f1_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "f1_asset_assignments" ADD CONSTRAINT "f1_asset_assignments_asset_id_f1_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."f1_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_assignments" ADD CONSTRAINT "f1_asset_assignments_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_events" ADD CONSTRAINT "f1_asset_events_asset_id_f1_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."f1_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_events" ADD CONSTRAINT "f1_asset_events_assignment_id_f1_asset_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."f1_asset_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_files" ADD CONSTRAINT "f1_asset_files_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_files" ADD CONSTRAINT "f1_asset_files_asset_id_f1_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."f1_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_incidents" ADD CONSTRAINT "f1_asset_incidents_asset_id_f1_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."f1_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_incidents" ADD CONSTRAINT "f1_asset_incidents_assignment_id_f1_asset_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."f1_asset_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_incidents" ADD CONSTRAINT "f1_asset_incidents_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_services" ADD CONSTRAINT "f1_asset_services_asset_id_f1_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."f1_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_transfers" ADD CONSTRAINT "f1_asset_transfers_assignment_id_f1_asset_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."f1_asset_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f1_asset_transfers" ADD CONSTRAINT "f1_asset_transfers_to_user_id_app_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;