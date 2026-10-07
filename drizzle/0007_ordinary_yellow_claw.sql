CREATE TABLE `equipment_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_code` text NOT NULL,
	`coordinator_name` text NOT NULL,
	`coordinator_email` text DEFAULT '' NOT NULL,
	`order_number` text NOT NULL,
	`project` text DEFAULT '' NOT NULL,
	`site` text DEFAULT '' NOT NULL,
	`warehouse` text DEFAULT 'Almacén principal' NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`needed_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'PENDIENTE' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `equipment_requests_code_idx` ON `equipment_requests` (`request_code`);--> statement-breakpoint
CREATE INDEX `equipment_requests_status_idx` ON `equipment_requests` (`status`,`id`);