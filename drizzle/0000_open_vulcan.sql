CREATE TABLE `demo_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`stage` text NOT NULL,
	`resolved` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` text NOT NULL
);
