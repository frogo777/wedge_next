CREATE TABLE `demo_source_entities` (
	`user_id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `financial_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_demo_source_entities_entity` ON `demo_source_entities` (`entity_id`);