CREATE TABLE `movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`movement_date` text NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`project` text DEFAULT '' NOT NULL,
	`destination_site` text DEFAULT '' NOT NULL,
	`coordinator` text DEFAULT '' NOT NULL,
	`serials` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'Equipos' NOT NULL,
	`unit` text DEFAULT 'UND' NOT NULL,
	`location` text DEFAULT 'Almacén principal' NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);