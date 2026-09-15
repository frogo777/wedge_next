CREATE TABLE `entity_deletions` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`started_at` text NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `financial_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `source_objects` (
	`entity_id` text NOT NULL,
	`sha256` text NOT NULL,
	`object_key` text NOT NULL,
	`media_type` text DEFAULT 'application/xml' NOT NULL,
	`state` text DEFAULT 'stored' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`entity_id`, `sha256`),
	FOREIGN KEY (`entity_id`,`sha256`) REFERENCES `source_artifacts`(`entity_id`,`sha256`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "object_key" CHECK("source_objects"."object_key" = 'entities/' || "source_objects"."entity_id" || '/sources/' || "source_objects"."sha256"),
	CONSTRAINT "object_media" CHECK("source_objects"."media_type" = 'application/xml'),
	CONSTRAINT "object_state" CHECK("source_objects"."state" IN ('stored', 'deleting'))
);
--> statement-breakpoint
CREATE TABLE `source_upload_attempts` (
	`entity_id` text NOT NULL,
	`command_id` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_length` integer NOT NULL,
	`object_key` text NOT NULL,
	`actor_id` text NOT NULL,
	`started_at` text NOT NULL,
	PRIMARY KEY(`entity_id`, `command_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `financial_entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "upload_hash" CHECK(length("source_upload_attempts"."sha256") = 64 AND "source_upload_attempts"."sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "upload_size" CHECK("source_upload_attempts"."byte_length" BETWEEN 1 AND 131072),
	CONSTRAINT "upload_key" CHECK("source_upload_attempts"."object_key" = 'entities/' || "source_upload_attempts"."entity_id" || '/sources/' || "source_upload_attempts"."sha256")
);
