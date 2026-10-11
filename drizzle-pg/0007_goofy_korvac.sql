ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "coordinator_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_users" ADD CONSTRAINT "app_users_coordinator_id_coordinators_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."coordinators"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_users_coordinator_id_idx" ON "app_users" USING btree ("coordinator_id");
