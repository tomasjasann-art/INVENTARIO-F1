CREATE TABLE `coordinators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization` text NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coordinators_organization_name_unique` ON `coordinators` (`organization`,`name`);--> statement-breakpoint
CREATE TABLE `installation_validations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`movement_id` integer NOT NULL,
	`serial` text DEFAULT '' NOT NULL,
	`evidence_ssnn` text DEFAULT '' NOT NULL,
	`installed_site` text DEFAULT '' NOT NULL,
	`management_date` text DEFAULT '' NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`request_status` text DEFAULT 'PENDIENTE' NOT NULL,
	`jira_request_number` text DEFAULT '' NOT NULL,
	`reviewer` text DEFAULT '' NOT NULL,
	`entel_review_date` text DEFAULT '' NOT NULL,
	`year` text DEFAULT '' NOT NULL,
	`oracle_status` text DEFAULT 'PENDIENTE' NOT NULL,
	`report_gr_link` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`movement_id`) REFERENCES `movements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installation_validations_movement_serial_unique` ON `installation_validations` (`movement_id`,`serial`);