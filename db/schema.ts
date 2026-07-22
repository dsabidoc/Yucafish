import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default("Yucatán"),
  country: text("country").notNull().default("México"),
  timezone: text("timezone").notNull().default("America/Merida"),
  weightUnit: text("weight_unit").notNull().default("kg"),
  role: text("role").notNull().default("USER"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const fishingTrips = sqliteTable("fishing_trips", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(),
  port: text("port").notNull(),
  departureLocationId: text("departure_location_id"),
  fishingDate: text("fishing_date").notNull(),
  departureTime: text("departure_time"),
  returnTime: text("return_time"),
  area: text("area"),
  vessel: text("vessel"),
  captain: text("captain"),
  notes: text("notes"),
  status: text("status").notNull().default("DRAFT"),
  coverImageUrl: text("cover_image_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const catches = sqliteTable("catches", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  species: text("species").notNull(),
  customSpecies: integer("custom_species", { mode: "boolean" })
    .notNull()
    .default(false),
  weightKg: real("weight_kg").notNull(),
  originalWeight: real("original_weight").notNull(),
  originalUnit: text("original_unit").notNull(),
  releaseStatus: text("release_status").notNull().default("UNSPECIFIED"),
  lengthCm: real("length_cm"),
  caughtAt: text("caught_at"),
  lure: text("lure"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  tripId: text("trip_id"),
  catchId: text("catch_id"),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  altText: text("alt_text"),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const species = sqliteTable("species", {
  id: text("id").primaryKey(),
  commonName: text("common_name").notNull(),
  aliases: text("aliases").notNull().default(""),
  scientificName: text("scientific_name"),
  slug: text("slug").notNull().unique(),
  iconKey: text("icon_key").notNull().default("fish"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const ports = sqliteTable("ports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull().default("PUERTO"),
  municipality: text("municipality"),
  state: text("state").notNull().default("Yucatán"),
  country: text("country").notNull().default("México"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  marineLatitude: real("marine_latitude"),
  marineLongitude: real("marine_longitude"),
  timezone: text("timezone").notNull().default("America/Merida"),
  isWeatherEnabled: integer("is_weather_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

export const weatherCache = sqliteTable(
  "weather_cache",
  {
    id: text("id").primaryKey(),
    locationId: text("location_id").notNull(),
    forecastType: text("forecast_type").notNull(),
    provider: text("provider").notNull().default("open-meteo"),
    payloadJson: text("payload_json").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    staleUntil: text("stale_until").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("weather_cache_location_type_provider_unique").on(
      table.locationId,
      table.forecastType,
      table.provider,
    ),
  ],
);

export const fishingTripWeatherSnapshots = sqliteTable(
  "fishing_trip_weather_snapshots",
  {
    id: text("id").primaryKey(),
    fishingTripId: text("fishing_trip_id").notNull(),
    locationId: text("location_id").notNull(),
    capturedAt: text("captured_at").notNull(),
    snapshotType: text("snapshot_type").notNull(),
    provider: text("provider").notNull(),
    providerModel: text("provider_model"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    marineLatitude: real("marine_latitude"),
    marineLongitude: real("marine_longitude"),
    timezone: text("timezone").notNull(),
    temperatureC: real("temperature_c"),
    apparentTemperatureC: real("apparent_temperature_c"),
    humidityPercent: real("humidity_percent"),
    precipitationMm: real("precipitation_mm"),
    precipitationProbabilityPercent: real("precipitation_probability_percent"),
    weatherCode: integer("weather_code"),
    cloudCoverPercent: real("cloud_cover_percent"),
    visibilityMeters: real("visibility_meters"),
    windSpeedKmh: real("wind_speed_kmh"),
    windDirectionDegrees: real("wind_direction_degrees"),
    windGustKmh: real("wind_gust_kmh"),
    waveHeightMeters: real("wave_height_meters"),
    waveDirectionDegrees: real("wave_direction_degrees"),
    wavePeriodSeconds: real("wave_period_seconds"),
    swellHeightMeters: real("swell_height_meters"),
    swellDirectionDegrees: real("swell_direction_degrees"),
    swellPeriodSeconds: real("swell_period_seconds"),
    seaSurfaceTemperatureC: real("sea_surface_temperature_c"),
    oceanCurrentVelocityKmh: real("ocean_current_velocity_kmh"),
    oceanCurrentDirectionDegrees: real("ocean_current_direction_degrees"),
    rawProviderReference: text("raw_provider_reference"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("trip_weather_snapshot_trip_unique").on(table.fishingTripId),
  ],
);

export const fishingConditionThresholds = sqliteTable(
  "fishing_condition_thresholds",
  {
    id: text("id").primaryKey(),
    region: text("region").notNull(),
    maximumFavorableWindKmh: real("maximum_favorable_wind_kmh").notNull(),
    maximumCautionWindKmh: real("maximum_caution_wind_kmh").notNull(),
    maximumFavorableGustKmh: real("maximum_favorable_gust_kmh").notNull(),
    maximumCautionGustKmh: real("maximum_caution_gust_kmh").notNull(),
    maximumFavorableWaveMeters: real("maximum_favorable_wave_meters").notNull(),
    maximumCautionWaveMeters: real("maximum_caution_wave_meters").notNull(),
    minimumFavorableWavePeriodSeconds: real(
      "minimum_favorable_wave_period_seconds",
    ).notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by"),
  },
  (table) => [uniqueIndex("weather_threshold_region_unique").on(table.region)],
);

export const weatherRateLimits = sqliteTable(
  "weather_rate_limits",
  {
    id: text("id").primaryKey(),
    rateKey: text("rate_key").notNull(),
    windowStart: text("window_start").notNull(),
    count: integer("count").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("weather_rate_key_unique").on(table.rateKey)],
);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorEmailHash: text("actor_email_hash").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  createdAt: text("created_at").notNull(),
});
