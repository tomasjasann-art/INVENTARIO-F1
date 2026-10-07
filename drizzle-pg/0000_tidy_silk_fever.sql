CREATE TABLE "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'SOLO_LECTURA' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"file_name" text NOT NULL,
	"sheet_name" text DEFAULT '' NOT NULL,
	"contractor" text DEFAULT 'F1 SERVICES' NOT NULL,
	"cutoff_date" text DEFAULT '' NOT NULL,
	"raw_row_count" integer DEFAULT 0 NOT NULL,
	"normalized_row_count" integer DEFAULT 0 NOT NULL,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"total_cost_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PROCESSING' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"contractor" text DEFAULT 'F1 SERVICES' NOT NULL,
	"sku" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"series_lot" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit_measure" text DEFAULT 'UND' NOT NULL,
	"equipment_type" text DEFAULT '' NOT NULL,
	"subinventory" text DEFAULT '' NOT NULL,
	"project_code" text DEFAULT '' NOT NULL,
	"project" text DEFAULT '' NOT NULL,
	"purchase_order" text DEFAULT '' NOT NULL,
	"task" text DEFAULT '' NOT NULL,
	"requester" text DEFAULT '' NOT NULL,
	"site" text DEFAULT '' NOT NULL,
	"total_cost_cents" integer DEFAULT 0 NOT NULL,
	"warehouse_entry_date" text DEFAULT '' NOT NULL,
	"receipt_date" text DEFAULT '' NOT NULL,
	"order_number" text DEFAULT '' NOT NULL,
	"age_months" integer DEFAULT 0 NOT NULL,
	"age_bucket" text DEFAULT 'Sin antigüedad' NOT NULL,
	"category" text DEFAULT 'Sin categoría' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordinators" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization" text NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_code" text NOT NULL,
	"coordinator_name" text NOT NULL,
	"coordinator_email" text DEFAULT '' NOT NULL,
	"order_number" text NOT NULL,
	"project" text DEFAULT '' NOT NULL,
	"site" text DEFAULT '' NOT NULL,
	"warehouse" text DEFAULT 'Almacén principal' NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"needed_date" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"outbound_guide" text DEFAULT '' NOT NULL,
	"outbound_guide_link" text DEFAULT '' NOT NULL,
	"shipping_ticket" text DEFAULT '' NOT NULL,
	"shipping_key" text DEFAULT '' NOT NULL,
	"sent_date" text DEFAULT '' NOT NULL,
	"arrival_date" text DEFAULT '' NOT NULL,
	"pickup_date" text DEFAULT '' NOT NULL,
	"logistics_notes" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installation_validations" (
	"id" serial PRIMARY KEY NOT NULL,
	"movement_id" integer NOT NULL,
	"serial" text DEFAULT '' NOT NULL,
	"evidence_ssnn" text DEFAULT '' NOT NULL,
	"installed_site" text DEFAULT '' NOT NULL,
	"management_date" text DEFAULT '' NOT NULL,
	"responsible" text DEFAULT '' NOT NULL,
	"request_status" text DEFAULT 'PENDIENTE' NOT NULL,
	"jira_request_number" text DEFAULT '' NOT NULL,
	"reviewer" text DEFAULT '' NOT NULL,
	"entel_review_date" text DEFAULT '' NOT NULL,
	"year" text DEFAULT '' NOT NULL,
	"oracle_status" text DEFAULT 'PENDIENTE' NOT NULL,
	"report_gr_link" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"observation" text DEFAULT '' NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"movement_date" text NOT NULL,
	"document" text DEFAULT '' NOT NULL,
	"project" text DEFAULT '' NOT NULL,
	"destination_site" text DEFAULT '' NOT NULL,
	"coordinator" text DEFAULT '' NOT NULL,
	"coordinator_f1" text DEFAULT '' NOT NULL,
	"serials" text DEFAULT '' NOT NULL,
	"source_row" text DEFAULT '' NOT NULL,
	"origin_site" text DEFAULT '' NOT NULL,
	"stock_location" text DEFAULT 'MO COMPANY' NOT NULL,
	"unit_measure" text DEFAULT 'UND' NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"equipment_type" text DEFAULT '' NOT NULL,
	"load_gr" text DEFAULT '' NOT NULL,
	"gr_link" text DEFAULT '' NOT NULL,
	"order_number" text DEFAULT '' NOT NULL,
	"ticket" text DEFAULT '' NOT NULL,
	"equipment_status" text DEFAULT 'NUEVO' NOT NULL,
	"condition" text DEFAULT 'OPERATIVO' NOT NULL,
	"origin" text DEFAULT '' NOT NULL,
	"owner" text DEFAULT 'F1 SERVICES' NOT NULL,
	"record_status" text DEFAULT 'Disponible' NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"contractor" text DEFAULT '' NOT NULL,
	"consignee" text DEFAULT '' NOT NULL,
	"requester_email" text DEFAULT '' NOT NULL,
	"email_status" text DEFAULT '' NOT NULL,
	"email_flow_status" text DEFAULT '' NOT NULL,
	"dispatch_id" text DEFAULT '' NOT NULL,
	"email_sent_at" text DEFAULT '' NOT NULL,
	"registered_by" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'Equipos' NOT NULL,
	"unit" text DEFAULT 'UND' NOT NULL,
	"location" text DEFAULT 'Almacén principal' NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"client" text DEFAULT 'ENTEL' NOT NULL,
	"owner" text DEFAULT 'F1 SERVICES' NOT NULL,
	"default_project" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"movement_type" text DEFAULT 'entrada' NOT NULL,
	"sku" text NOT NULL,
	"series_lot" text DEFAULT '' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"movement_date" text DEFAULT '' NOT NULL,
	"document" text DEFAULT '' NOT NULL,
	"source_status" text DEFAULT '' NOT NULL,
	"imported_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_records" ADD CONSTRAINT "audit_records_import_id_audit_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."audit_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_validations" ADD CONSTRAINT "installation_validations_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_email_unique" ON "app_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_imports_source_status_idx" ON "audit_imports" USING btree ("source","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_records_import_key_unique" ON "audit_records" USING btree ("import_id","source_key");--> statement-breakpoint
CREATE INDEX "audit_records_import_source_idx" ON "audit_records" USING btree ("import_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "coordinators_organization_name_unique" ON "coordinators" USING btree ("organization","name");--> statement-breakpoint
CREATE INDEX "equipment_requests_code_idx" ON "equipment_requests" USING btree ("request_code");--> statement-breakpoint
CREATE INDEX "equipment_requests_status_idx" ON "equipment_requests" USING btree ("status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "installation_validations_movement_serial_unique" ON "installation_validations" USING btree ("movement_id","serial");