CREATE TABLE `audit_events` (
	`entity_id` text NOT NULL,
	`event_id` text NOT NULL,
	`kind` text NOT NULL,
	`command_id` text,
	`actor_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	PRIMARY KEY(`entity_id`, `event_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `financial_entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`,`command_id`) REFERENCES `import_receipts`(`entity_id`,`command_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_kind" CHECK(("audit_events"."kind" = 'entity_created' AND "audit_events"."command_id" IS NULL) OR ("audit_events"."kind" = 'source_received' AND "audit_events"."command_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `financial_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_receipts` (
	`entity_id` text NOT NULL,
	`command_id` text NOT NULL,
	`sha256` text NOT NULL,
	`actor_id` text NOT NULL,
	`received_at` text NOT NULL,
	PRIMARY KEY(`entity_id`, `command_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `financial_entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`,`sha256`) REFERENCES `source_artifacts`(`entity_id`,`sha256`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entity_memberships` (
	`entity_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	PRIMARY KEY(`entity_id`, `user_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `financial_entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "membership_role" CHECK("entity_memberships"."role" = 'owner')
);
--> statement-breakpoint
CREATE TABLE `source_artifacts` (
	`entity_id` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_length` integer NOT NULL,
	`storage_state` text DEFAULT 'metadata_only' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`entity_id`, `sha256`),
	FOREIGN KEY (`entity_id`) REFERENCES `financial_entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "source_hash" CHECK(length("source_artifacts"."sha256") = 64 AND "source_artifacts"."sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "source_size" CHECK("source_artifacts"."byte_length" BETWEEN 1 AND 131072),
	CONSTRAINT "source_storage" CHECK("source_artifacts"."storage_state" = 'metadata_only')
);
