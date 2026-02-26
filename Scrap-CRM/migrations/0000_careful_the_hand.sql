CREATE TABLE `county_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text NOT NULL,
	`search_url` text NOT NULL,
	`scrape_party` int NOT NULL DEFAULT 1,
	`scrape_lot` int NOT NULL DEFAULT 1,
	`vpn_required` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `county_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `extracted_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_number` text NOT NULL,
	`source_file` text NOT NULL,
	`document_type` text,
	`grantor` text,
	`grantee` text,
	`instrument_number` text,
	`recording_date` text,
	`dated_date` text,
	`consideration_amount` text,
	`book` text,
	`page_no` text,
	`legal_description` text,
	`data` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `extracted_details_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scrape_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`upload_id` int,
	`data` json NOT NULL,
	`status` text NOT NULL DEFAULT ('pending'),
	`lot_status` text NOT NULL DEFAULT ('pending'),
	`party_status` text NOT NULL DEFAULT ('pending'),
	`result` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `scrape_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `scrape_items` ADD CONSTRAINT `scrape_items_upload_id_uploads_id_fk` FOREIGN KEY (`upload_id`) REFERENCES `uploads`(`id`) ON DELETE no action ON UPDATE no action;