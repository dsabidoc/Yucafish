CREATE UNIQUE INDEX `weather_threshold_region_unique` ON `fishing_condition_thresholds` (`region`);--> statement-breakpoint
CREATE UNIQUE INDEX `trip_weather_snapshot_trip_unique` ON `fishing_trip_weather_snapshots` (`fishing_trip_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `weather_cache_location_type_provider_unique` ON `weather_cache` (`location_id`,`forecast_type`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `weather_rate_key_unique` ON `weather_rate_limits` (`rate_key`);