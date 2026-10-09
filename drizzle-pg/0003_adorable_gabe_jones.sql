ALTER TABLE "equipment_requests" ADD COLUMN "pickup_person_dni" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "pickup_person_2_dni" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "equipment_requests_contractor_ruc_idx" ON "equipment_requests" USING btree ("contractor_ruc");--> statement-breakpoint
CREATE INDEX "equipment_requests_pickup_dni_idx" ON "equipment_requests" USING btree ("pickup_person_dni");--> statement-breakpoint

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coordinators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "installation_validations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "equipment_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" FROM "anon", "authenticated";--> statement-breakpoint

INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES (
  'kardex-evidencias',
  'kardex-evidencias',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT ("id") DO NOTHING;
