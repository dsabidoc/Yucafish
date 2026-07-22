CREATE TABLE `fishing_condition_thresholds` (
	`id` text PRIMARY KEY NOT NULL,
	`region` text NOT NULL,
	`maximum_favorable_wind_kmh` real NOT NULL,
	`maximum_caution_wind_kmh` real NOT NULL,
	`maximum_favorable_gust_kmh` real NOT NULL,
	`maximum_caution_gust_kmh` real NOT NULL,
	`maximum_favorable_wave_meters` real NOT NULL,
	`maximum_caution_wave_meters` real NOT NULL,
	`minimum_favorable_wave_period_seconds` real NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `fishing_trip_weather_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`fishing_trip_id` text NOT NULL,
	`location_id` text NOT NULL,
	`captured_at` text NOT NULL,
	`snapshot_type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_model` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`marine_latitude` real,
	`marine_longitude` real,
	`timezone` text NOT NULL,
	`temperature_c` real,
	`apparent_temperature_c` real,
	`humidity_percent` real,
	`precipitation_mm` real,
	`precipitation_probability_percent` real,
	`weather_code` integer,
	`cloud_cover_percent` real,
	`visibility_meters` real,
	`wind_speed_kmh` real,
	`wind_direction_degrees` real,
	`wind_gust_kmh` real,
	`wave_height_meters` real,
	`wave_direction_degrees` real,
	`wave_period_seconds` real,
	`swell_height_meters` real,
	`swell_direction_degrees` real,
	`swell_period_seconds` real,
	`sea_surface_temperature_c` real,
	`ocean_current_velocity_kmh` real,
	`ocean_current_direction_degrees` real,
	`raw_provider_reference` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weather_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`forecast_type` text NOT NULL,
	`provider` text DEFAULT 'open-meteo' NOT NULL,
	`payload_json` text NOT NULL,
	`fetched_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`stale_until` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weather_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`rate_key` text NOT NULL,
	`window_start` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `fishing_trips` ADD `departure_location_id` text;--> statement-breakpoint
ALTER TABLE `ports` ADD `state` text DEFAULT 'Yucatán' NOT NULL;--> statement-breakpoint
ALTER TABLE `ports` ADD `country` text DEFAULT 'México' NOT NULL;--> statement-breakpoint
ALTER TABLE `ports` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `ports` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `ports` ADD `marine_latitude` real;--> statement-breakpoint
ALTER TABLE `ports` ADD `marine_longitude` real;--> statement-breakpoint
ALTER TABLE `ports` ADD `timezone` text DEFAULT 'America/Merida' NOT NULL;--> statement-breakpoint
ALTER TABLE `ports` ADD `is_weather_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ports` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ports` ADD `updated_at` text DEFAULT '' NOT NULL;