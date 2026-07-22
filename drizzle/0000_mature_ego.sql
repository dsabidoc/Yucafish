CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email_hash` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catches` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`species` text NOT NULL,
	`custom_species` integer DEFAULT false NOT NULL,
	`weight_kg` real NOT NULL,
	`original_weight` real NOT NULL,
	`original_unit` text NOT NULL,
	`release_status` text DEFAULT 'UNSPECIFIED' NOT NULL,
	`length_cm` real,
	`caught_at` text,
	`lure` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `fishing_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`port` text NOT NULL,
	`fishing_date` text NOT NULL,
	`departure_time` text,
	`return_time` text,
	`area` text,
	`vessel` text,
	`captain` text,
	`notes` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`cover_image_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`trip_id` text,
	`catch_id` text,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`alt_text` text,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `ports` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`type` text DEFAULT 'PUERTO' NOT NULL,
	`municipality` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ports_slug_unique` ON `ports` (`slug`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'Yucatán' NOT NULL,
	`country` text DEFAULT 'México' NOT NULL,
	`timezone` text DEFAULT 'America/Merida' NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`role` text DEFAULT 'USER' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `species` (
	`id` text PRIMARY KEY NOT NULL,
	`common_name` text NOT NULL,
	`aliases` text DEFAULT '' NOT NULL,
	`scientific_name` text,
	`slug` text NOT NULL,
	`icon_key` text DEFAULT 'fish' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `species_slug_unique` ON `species` (`slug`);