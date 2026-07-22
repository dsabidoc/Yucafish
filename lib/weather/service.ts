import { database, ensureDatabase, mapRow, now } from "@/db/runtime";
import { fetchMarine, fetchWeather } from "./client";
import { weatherConfig } from "./config";
import {
  buildDailyFishingOutlooks,
  fishingCondition,
  joinHourly,
  mapMarine,
  mapWeather,
  nearestTimeIndex,
} from "./domain";
import {
  WeatherLocationNotFoundError,
  WeatherUnavailableError,
} from "./errors";
import type {
  ConditionThresholds,
  PortForecast,
  WeatherLocation,
} from "./types";

type CacheRow = {
  payload_json: string;
  fetched_at: string;
  expires_at: string;
  stale_until: string;
};
type PortRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  municipality: string | null;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  marine_latitude: number | null;
  marine_longitude: number | null;
  timezone: string;
  is_weather_enabled: number;
  active: number;
  sort_order: number;
};

function portFromRow(row: PortRow): WeatherLocation {
  if (row.latitude === null || row.longitude === null)
    throw new WeatherLocationNotFoundError(
      "El puerto no tiene coordenadas configuradas",
    );
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    municipality: row.municipality,
    state: row.state,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    marineLatitude: row.marine_latitude,
    marineLongitude: row.marine_longitude,
    timezone: row.timezone,
    isWeatherEnabled: Boolean(row.is_weather_enabled),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
  };
}

export async function listWeatherLocations() {
  await ensureDatabase();
  const rows =
    (
      await database()
        .prepare(
          "SELECT * FROM ports WHERE active=1 AND is_weather_enabled=1 AND latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY sort_order, name",
        )
        .all<PortRow>()
    ).results ?? [];
  return rows.map(portFromRow);
}

export async function getWeatherLocation(locationId: string) {
  await ensureDatabase();
  const row = await database()
    .prepare("SELECT * FROM ports WHERE id=? LIMIT 1")
    .bind(locationId)
    .first<PortRow>();
  if (!row || !row.active || !row.is_weather_enabled)
    throw new WeatherLocationNotFoundError(
      "El puerto no existe o no tiene clima habilitado",
    );
  return portFromRow(row);
}

async function thresholds(): Promise<ConditionThresholds> {
  const row = await database()
    .prepare(
      "SELECT * FROM fishing_condition_thresholds WHERE active=1 ORDER BY updated_at DESC LIMIT 1",
    )
    .first<Record<string, number>>();
  return {
    maximumFavorableWindKmh: Number(row?.maximum_favorable_wind_kmh ?? 25),
    maximumCautionWindKmh: Number(row?.maximum_caution_wind_kmh ?? 40),
    maximumFavorableGustKmh: Number(row?.maximum_favorable_gust_kmh ?? 35),
    maximumCautionGustKmh: Number(row?.maximum_caution_gust_kmh ?? 55),
    maximumFavorableWaveMeters: Number(
      row?.maximum_favorable_wave_meters ?? 1.2,
    ),
    maximumCautionWaveMeters: Number(row?.maximum_caution_wave_meters ?? 2),
    minimumFavorableWavePeriodSeconds: Number(
      row?.minimum_favorable_wave_period_seconds ?? 5,
    ),
  };
}

async function cached<T>(
  locationId: string,
  forecastType: "weather" | "marine",
  loader: () => Promise<T>,
  correlationId: string,
) {
  const db = database();
  const row = await db
    .prepare(
      "SELECT payload_json, fetched_at, expires_at, stale_until FROM weather_cache WHERE location_id=? AND forecast_type=? AND provider='open-meteo'",
    )
    .bind(locationId, forecastType)
    .first<CacheRow>();
  const currentMs = Date.now();
  if (row && new Date(row.expires_at).getTime() > currentMs) {
    console.info(
      JSON.stringify({
        event: "weather_cache",
        locationId,
        provider: "open-meteo",
        forecastType,
        cacheStatus: "hit",
        resultStatus: "success",
        correlationId,
      }),
    );
    return {
      data: JSON.parse(row.payload_json) as T,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      stale: false,
    };
  }
  try {
    const data = await loader();
    const fetchedAt = now();
    const expiresAt = new Date(
      Date.now() + weatherConfig.cacheSeconds * 1000,
    ).toISOString();
    const staleUntil = new Date(
      Date.now() + weatherConfig.staleSeconds * 1000,
    ).toISOString();
    await db
      .prepare(
        "INSERT INTO weather_cache (id, location_id, forecast_type, provider, payload_json, fetched_at, expires_at, stale_until, created_at, updated_at) VALUES (?, ?, ?, 'open-meteo', ?, ?, ?, ?, ?, ?) ON CONFLICT(location_id, forecast_type, provider) DO UPDATE SET payload_json=excluded.payload_json, fetched_at=excluded.fetched_at, expires_at=excluded.expires_at, stale_until=excluded.stale_until, updated_at=excluded.updated_at",
      )
      .bind(
        crypto.randomUUID(),
        locationId,
        forecastType,
        JSON.stringify(data),
        fetchedAt,
        expiresAt,
        staleUntil,
        fetchedAt,
        fetchedAt,
      )
      .run();
    return { data, fetchedAt, expiresAt, stale: false };
  } catch (error) {
    if (row && new Date(row.stale_until).getTime() > currentMs) {
      console.warn(
        JSON.stringify({
          event: "weather_cache",
          locationId,
          provider: "open-meteo",
          forecastType,
          cacheStatus: "stale",
          resultStatus: "provider_error",
          correlationId,
        }),
      );
      return {
        data: JSON.parse(row.payload_json) as T,
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
        stale: true,
      };
    }
    throw error;
  }
}

export async function getPortForecast(
  locationId: string,
  correlationId = crypto.randomUUID(),
): Promise<PortForecast> {
  const location = await getWeatherLocation(locationId);
  const weatherResult = await Promise.allSettled([
    cached(
      location.id,
      "weather",
      () =>
        fetchWeather(
          {
            latitude: location.latitude,
            longitude: location.longitude,
            timezone: location.timezone,
          },
          correlationId,
        ),
      correlationId,
    ),
    cached(
      location.id,
      "marine",
      () =>
        fetchMarine(
          {
            latitude: location.marineLatitude ?? location.latitude,
            longitude: location.marineLongitude ?? location.longitude,
            timezone: location.timezone,
          },
          correlationId,
        ),
      correlationId,
    ),
  ]);
  const general =
    weatherResult[0].status === "fulfilled" ? weatherResult[0].value : null;
  const marine =
    weatherResult[1].status === "fulfilled" ? weatherResult[1].value : null;
  if (!general && !marine)
    throw new WeatherUnavailableError(
      "No pudimos consultar las condiciones en este momento",
    );
  const mappedWeather = general
    ? mapWeather(general.data)
    : { current: null, hourly: [], daily: [] };
  const mappedMarine = marine
    ? mapMarine(marine.data)
    : { current: null, hourly: [] };
  const fetchedAt =
    [general?.fetchedAt, marine?.fetchedAt].filter(Boolean).sort().at(0) ??
    now();
  const cachedUntil =
    [general?.expiresAt, marine?.expiresAt].filter(Boolean).sort().at(0) ??
    fetchedAt;
  const rules = await thresholds();
  const joinedHourly = joinHourly(mappedWeather.hourly, mappedMarine.hourly);
  return {
    location: {
      id: location.id,
      name: location.name,
      timezone: location.timezone,
    },
    currentWeather: mappedWeather.current,
    currentMarine: mappedMarine.current,
    hourly: joinedHourly,
    daily: mappedWeather.daily,
    dailyFishingOutlooks: buildDailyFishingOutlooks(
      mappedWeather.daily,
      joinedHourly,
      rules,
    ),
    fetchedAt,
    cachedUntil,
    provider: "open-meteo",
    isStale: Boolean(general?.stale || marine?.stale),
    partialError: general ? (marine ? null : "marine") : "weather",
    condition: fishingCondition(
      mappedWeather.current,
      mappedMarine.current,
      rules,
    ),
  };
}

export async function checkRateLimit(
  rateKey: string,
  limit = 30,
  windowSeconds = 60,
) {
  await ensureDatabase();
  const db = database();
  const timestamp = now();
  const row = await db
    .prepare(
      "SELECT id, window_start, count FROM weather_rate_limits WHERE rate_key=?",
    )
    .bind(rateKey)
    .first<{ id: string; window_start: string; count: number }>();
  if (
    !row ||
    Date.now() - new Date(row.window_start).getTime() >= windowSeconds * 1000
  ) {
    await db
      .prepare(
        "INSERT INTO weather_rate_limits (id, rate_key, window_start, count, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET window_start=excluded.window_start, count=1, updated_at=excluded.updated_at",
      )
      .bind(crypto.randomUUID(), rateKey, timestamp, timestamp)
      .run();
    return;
  }
  if (row.count >= limit)
    throw new WeatherUnavailableError(
      "Has realizado demasiadas consultas. Intenta de nuevo en un minuto",
    );
  await db
    .prepare(
      "UPDATE weather_rate_limits SET count=count+1, updated_at=? WHERE id=?",
    )
    .bind(timestamp, row.id)
    .run();
}

export async function captureTripWeather(
  tripId: string,
  ownerEmail: string,
  manual = true,
) {
  await ensureDatabase();
  const db = database();
  const trip = await db
    .prepare(
      "SELECT id, fishing_date, departure_time, departure_location_id, port FROM fishing_trips WHERE id=? AND owner_email=? AND deleted_at IS NULL",
    )
    .bind(tripId, ownerEmail)
    .first<{
      id: string;
      fishing_date: string;
      departure_time: string | null;
      departure_location_id: string | null;
      port: string;
    }>();
  if (!trip)
    throw new WeatherLocationNotFoundError(
      "No tienes permiso para guardar condiciones en esta pesca",
    );
  const locationRow = trip.departure_location_id
    ? await db
        .prepare("SELECT * FROM ports WHERE id=?")
        .bind(trip.departure_location_id)
        .first<PortRow>()
    : await db
        .prepare("SELECT * FROM ports WHERE name=?")
        .bind(trip.port)
        .first<PortRow>();
  if (!locationRow)
    throw new WeatherLocationNotFoundError(
      "La pesca no tiene un puerto meteorológico válido",
    );
  const location = portFromRow(locationRow);
  const forecast = await getPortForecast(location.id);
  const target = `${trip.fishing_date}T${trip.departure_time || "12:00"}`;
  const future =
    trip.fishing_date >
    new Intl.DateTimeFormat("en-CA", { timeZone: location.timezone }).format(
      new Date(),
    );
  const index = future
    ? nearestTimeIndex(
        forecast.hourly.map((item) => item.time),
        target,
      )
    : -1;
  const weather =
    index >= 0 ? forecast.hourly[index]?.weather : forecast.currentWeather;
  const marine =
    index >= 0 ? forecast.hourly[index]?.marine : forecast.currentMarine;
  if (!weather && !marine)
    throw new WeatherUnavailableError(
      "No hay condiciones disponibles para la fecha de la pesca",
    );
  const capturedAt = now();
  const snapshotType = manual
    ? "MANUAL"
    : future
      ? "FORECAST"
      : "CURRENT_CONDITION";
  const values = [
    weather?.temperatureC,
    weather?.apparentTemperatureC,
    weather?.humidityPercent,
    weather?.precipitationMm,
    weather?.precipitationProbabilityPercent,
    weather?.weatherCode,
    weather?.cloudCoverPercent,
    weather?.visibilityMeters,
    weather?.windSpeedKmh,
    weather?.windDirectionDegrees,
    weather?.windGustKmh,
    marine?.waveHeightMeters,
    marine?.waveDirectionDegrees,
    marine?.wavePeriodSeconds,
    marine?.swellHeightMeters,
    marine?.swellDirectionDegrees,
    marine?.swellPeriodSeconds,
    marine?.seaSurfaceTemperatureC,
    marine?.currentVelocityKmh,
    marine?.currentDirectionDegrees,
  ];
  await db
    .prepare(
      "INSERT INTO fishing_trip_weather_snapshots (id, fishing_trip_id, location_id, captured_at, snapshot_type, provider, latitude, longitude, marine_latitude, marine_longitude, timezone, temperature_c, apparent_temperature_c, humidity_percent, precipitation_mm, precipitation_probability_percent, weather_code, cloud_cover_percent, visibility_meters, wind_speed_kmh, wind_direction_degrees, wind_gust_kmh, wave_height_meters, wave_direction_degrees, wave_period_seconds, swell_height_meters, swell_direction_degrees, swell_period_seconds, sea_surface_temperature_c, ocean_current_velocity_kmh, ocean_current_direction_degrees, raw_provider_reference, created_at) VALUES (?, ?, ?, ?, ?, 'open-meteo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(fishing_trip_id) DO UPDATE SET location_id=excluded.location_id, captured_at=excluded.captured_at, snapshot_type=excluded.snapshot_type, latitude=excluded.latitude, longitude=excluded.longitude, marine_latitude=excluded.marine_latitude, marine_longitude=excluded.marine_longitude, timezone=excluded.timezone, temperature_c=excluded.temperature_c, apparent_temperature_c=excluded.apparent_temperature_c, humidity_percent=excluded.humidity_percent, precipitation_mm=excluded.precipitation_mm, precipitation_probability_percent=excluded.precipitation_probability_percent, weather_code=excluded.weather_code, cloud_cover_percent=excluded.cloud_cover_percent, visibility_meters=excluded.visibility_meters, wind_speed_kmh=excluded.wind_speed_kmh, wind_direction_degrees=excluded.wind_direction_degrees, wind_gust_kmh=excluded.wind_gust_kmh, wave_height_meters=excluded.wave_height_meters, wave_direction_degrees=excluded.wave_direction_degrees, wave_period_seconds=excluded.wave_period_seconds, swell_height_meters=excluded.swell_height_meters, swell_direction_degrees=excluded.swell_direction_degrees, swell_period_seconds=excluded.swell_period_seconds, sea_surface_temperature_c=excluded.sea_surface_temperature_c, ocean_current_velocity_kmh=excluded.ocean_current_velocity_kmh, ocean_current_direction_degrees=excluded.ocean_current_direction_degrees, raw_provider_reference=excluded.raw_provider_reference",
    )
    .bind(
      crypto.randomUUID(),
      trip.id,
      location.id,
      capturedAt,
      snapshotType,
      location.latitude,
      location.longitude,
      location.marineLatitude,
      location.marineLongitude,
      location.timezone,
      ...values.map((item) => item ?? null),
      JSON.stringify({ provider: "open-meteo", fetchedAt: forecast.fetchedAt }),
      capturedAt,
    )
    .run();
  const saved = await db
    .prepare(
      "SELECT * FROM fishing_trip_weather_snapshots WHERE fishing_trip_id=?",
    )
    .bind(trip.id)
    .first<Record<string, unknown>>();
  return saved ? mapRow(saved) : null;
}
