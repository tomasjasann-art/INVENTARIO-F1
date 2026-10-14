CREATE SEQUENCE IF NOT EXISTS "public"."equipment_return_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_code" text NOT NULL,
	"product_id" integer NOT NULL,
	"coordinator_id" integer,
	"source_movement_id" integer,
	"stock_movement_id" integer,
	"coordinator_f1" text NOT NULL,
	"order_number" text DEFAULT '' NOT NULL,
	"serial" text NOT NULL,
	"serial_key" text NOT NULL,
	"detected_part_number" text DEFAULT '' NOT NULL,
	"sku_snapshot" text NOT NULL,
	"description_snapshot" text NOT NULL,
	"match_method" text DEFAULT 'MANUAL' NOT NULL,
	"match_confidence" integer DEFAULT 0 NOT NULL,
	"raw_ocr_text" text DEFAULT '' NOT NULL,
	"evidence_image" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'PENDIENTE_APROBACION' NOT NULL,
	"logical_registered_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"approved_at" text DEFAULT '' NOT NULL,
	"approved_by" text DEFAULT '' NOT NULL,
	"physically_received_at" text DEFAULT '' NOT NULL,
	"received_by" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_identifiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"identifier" text NOT NULL,
	"normalized_identifier" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "equipment_returns" ADD CONSTRAINT "equipment_returns_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "equipment_returns" ADD CONSTRAINT "equipment_returns_coordinator_id_coordinators_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."coordinators"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "equipment_returns" ADD CONSTRAINT "equipment_returns_source_movement_id_movements_id_fk" FOREIGN KEY ("source_movement_id") REFERENCES "public"."movements"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "equipment_returns" ADD CONSTRAINT "equipment_returns_stock_movement_id_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."movements"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_returns_active_serial_unique" ON "equipment_returns" USING btree ("serial_key") WHERE "equipment_returns"."status" NOT IN ('RECIBIDA_FISICA', 'RECHAZADA');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_returns_return_code_unique" ON "equipment_returns" USING btree ("return_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_returns_status_idx" ON "equipment_returns" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_returns_product_id_idx" ON "equipment_returns" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_returns_coordinator_id_idx" ON "equipment_returns" USING btree ("coordinator_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_identifiers_normalized_unique" ON "product_identifiers" USING btree ("normalized_identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_identifiers_product_id_idx" ON "product_identifiers" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "equipment_returns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "equipment_returns" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "product_identifiers" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SEQUENCE "equipment_return_code_seq" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SEQUENCE "equipment_returns_id_seq" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SEQUENCE "product_identifiers_id_seq" FROM "anon", "authenticated";
