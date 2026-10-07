ALTER TABLE `movements` ADD `coordinator_f1` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `source_row` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `origin_site` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `unit_measure` text DEFAULT 'UND' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `unit_cost_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `equipment_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `load_gr` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `gr_link` text DEFAULT '' NOT NULL;