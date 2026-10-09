CREATE SEQUENCE IF NOT EXISTS "public"."equipment_request_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN IF NOT EXISTS "coordinator_entel" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN IF NOT EXISTS "delivery_address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN IF NOT EXISTS "transport" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN IF NOT EXISTS "closed_at" text DEFAULT '' NOT NULL;
