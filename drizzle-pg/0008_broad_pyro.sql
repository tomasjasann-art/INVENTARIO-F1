ALTER TABLE "equipment_requests" ADD COLUMN IF NOT EXISTS "coordinator_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_coordinator_id_coordinators_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."coordinators"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_requests_coordinator_id_idx" ON "equipment_requests" USING btree ("coordinator_id");--> statement-breakpoint
UPDATE "equipment_requests" er
SET "coordinator_id" = c."id"
FROM "coordinators" c
WHERE er."coordinator_id" IS NULL
  AND c."organization" = 'F1'
  AND upper(trim(c."name")) = upper(trim(er."coordinator_name"));
