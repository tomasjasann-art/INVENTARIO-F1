CREATE TABLE `source_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`sku` text NOT NULL,
	`series_lot` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`movement_date` text DEFAULT '' NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`source_status` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `movements` ADD `order_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `ticket` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `equipment_status` text DEFAULT 'NUEVO' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `condition` text DEFAULT 'OPERATIVO' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `origin` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `owner` text DEFAULT 'F1 SERVICES' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `record_status` text DEFAULT 'Disponible' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `client` text DEFAULT 'ENTEL' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `owner` text DEFAULT 'F1 SERVICES' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `default_project` text DEFAULT '' NOT NULL;