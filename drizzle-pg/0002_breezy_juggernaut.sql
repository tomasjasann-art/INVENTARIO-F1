CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_type" text DEFAULT 'RUC' NOT NULL,
	"document_number" text NOT NULL,
	"business_name" text NOT NULL,
	"trade_name" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "invitation_status" text DEFAULT 'PENDIENTE' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "invited_at" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "pickup_person_2" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "movements" ADD COLUMN "contractor_document" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_document_number_unique" ON "suppliers" USING btree ("document_number");--> statement-breakpoint
CREATE INDEX "suppliers_business_name_idx" ON "suppliers" USING btree ("business_name");