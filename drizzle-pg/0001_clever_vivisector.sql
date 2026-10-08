ALTER TABLE "equipment_requests" ADD COLUMN "series_lot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "contractor_ruc" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "contractor_business_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "pickup_person" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "region" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "city" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "outbound_guide_photo" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_requests" ADD COLUMN "shipping_ticket_photo" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "movements" ADD COLUMN "lot_assignment" text DEFAULT 'ORIGINAL' NOT NULL;