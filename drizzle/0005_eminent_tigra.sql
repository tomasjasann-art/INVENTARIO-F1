ALTER TABLE `movements` ADD `region` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `province` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `contractor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `consignee` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `requester_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `email_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `email_flow_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `dispatch_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `email_sent_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `registered_by` text DEFAULT '' NOT NULL;