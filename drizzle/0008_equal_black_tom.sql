CREATE TABLE `app_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'SOLO_LECTURA' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (`email`);--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `outbound_guide` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `outbound_guide_link` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `shipping_ticket` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `shipping_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `sent_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `arrival_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `pickup_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `logistics_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `stock_location` text DEFAULT 'MO COMPANY' NOT NULL;