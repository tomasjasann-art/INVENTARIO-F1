CREATE TABLE `audit_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`file_name` text NOT NULL,
	`sheet_name` text DEFAULT '' NOT NULL,
	`contractor` text DEFAULT 'F1 SERVICES' NOT NULL,
	`cutoff_date` text DEFAULT '' NOT NULL,
	`raw_row_count` integer DEFAULT 0 NOT NULL,
	`normalized_row_count` integer DEFAULT 0 NOT NULL,
	`total_quantity` integer DEFAULT 0 NOT NULL,
	`total_cost_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PROCESSING' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_imports_source_status_idx` ON `audit_imports` (`source`,`status`,`id`);--> statement-breakpoint
CREATE TABLE `audit_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`source` text NOT NULL,
	`source_key` text NOT NULL,
	`contractor` text DEFAULT 'F1 SERVICES' NOT NULL,
	`sku` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`series_lot` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`unit_measure` text DEFAULT 'UND' NOT NULL,
	`equipment_type` text DEFAULT '' NOT NULL,
	`subinventory` text DEFAULT '' NOT NULL,
	`project_code` text DEFAULT '' NOT NULL,
	`project` text DEFAULT '' NOT NULL,
	`purchase_order` text DEFAULT '' NOT NULL,
	`task` text DEFAULT '' NOT NULL,
	`requester` text DEFAULT '' NOT NULL,
	`site` text DEFAULT '' NOT NULL,
	`total_cost_cents` integer DEFAULT 0 NOT NULL,
	`warehouse_entry_date` text DEFAULT '' NOT NULL,
	`receipt_date` text DEFAULT '' NOT NULL,
	`order_number` text DEFAULT '' NOT NULL,
	`age_months` integer DEFAULT 0 NOT NULL,
	`age_bucket` text DEFAULT 'Sin antigüedad' NOT NULL,
	`category` text DEFAULT 'Sin categoría' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `audit_imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_records_import_key_unique` ON `audit_records` (`import_id`,`source_key`);--> statement-breakpoint
CREATE INDEX `audit_records_import_source_idx` ON `audit_records` (`import_id`,`source`);