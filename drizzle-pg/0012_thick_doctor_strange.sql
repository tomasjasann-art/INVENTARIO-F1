ALTER TABLE "products" ALTER COLUMN "location" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "client" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "owner" SET DEFAULT '';--> statement-breakpoint
UPDATE "products" AS "product"
SET "location" = '', "client" = '', "owner" = '', "default_project" = ''
WHERE "product"."location" IN ('MO COMPANY', 'MO Company', 'Almacén principal')
  AND "product"."client" = 'ENTEL'
  AND "product"."owner" = 'F1 SERVICES'
  AND "product"."default_project" = ''
  AND NOT EXISTS (
    SELECT 1
    FROM "movements" AS "movement"
    WHERE "movement"."product_id" = "product"."id"
  );
