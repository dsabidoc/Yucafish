import { database, ensureDatabase, mapRow, now } from "@/db/runtime";
import {
  fetchMarine,
  fetchNearestTideStations,
  fetchTideCheckForecast,
  fetchWeather,
} from "./client";
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
  TideCheckUnavailableError,
  WeatherLocationNotFoundError,
  WeatherUnavailableError,
} from "./errors";
import { assertInsideYucatan, haversineKm } from "./geofence";
import type {
  ConditionThresholds,
  TideStation,
  PortForecast,
  TideSummary,
  WeatherLocation,
} from "./types";

function usesMysql() {
  const configured = (
    process.env.GOFISHING_DB_CLIENT ||
    process.env.DB_CLIENT ||
    ""
  )
    .trim()
    .toLowerCase();
  if (configured === "mysql" || configured === "mariadb") return true;
  return Boolean(
    process.env.GOFISHING_DB_HOST ||
      process.env.DB_HOST ||
      process.env.DATABASE_URL,
  );
}

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
  tide_check_enabled: number | null;
  tide_check_station_id: string | null;
  tide_check_station_name: string | null;
  tide_check_station_latitude: number | null;
  tide_check_station_longitude: number | null;
  tide_check_station_state: string | null;
  tide_check_station_country: string | null;
  station_verified_at: string | null;
  station_verified_by: string | null;
  active: number;
  sort_order: number;
};

function normalizeCatalogText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function portFromRow(row: PortRow): WeatherLocation {
  if (row.latitude === null || row.longitude === null)
    throw new WeatherLocationNotFoundError(
      "El puerto no tiene coordenadas configuradas",
    );
  const normalizedState = normalizeCatalogText(row.state);
  const normalizedCountry = normalizeCatalogText(row.country);
  if (
    !["yucatan", "estado de yucatan"].includes(normalizedState) ||
    !["mexico", "mx"].includes(normalizedCountry)
  )
    throw new WeatherLocationNotFoundError(
      "El puerto no pertenece al catálogo autorizado de Yucatán",
    );
  let marineLatitude = row.marine_latitude;
  let marineLongitude = row.marine_longitude;
  if (weatherConfig.yucatanGeofenceEnabled) {
    try {
      assertInsideYucatan(row.latitude, row.longitude, {
        label: "La coordenada terrestre",
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "weather_port_validation_warning",
          portId: row.id,
          warning: "land_geofence",
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    if (marineLatitude !== null && marineLongitude !== null) {
      try {
        assertInsideYucatan(marineLatitude, marineLongitude, {
          label: "La coordenada marina",
          allowMarineMarginKm: weatherConfig.yucatanMarineMarginKm,
        });
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: "weather_port_validation_warning",
            portId: row.id,
            warning: "marine_geofence",
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
        marineLatitude = null;
        marineLongitude = null;
      }
    }
  }
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
    marineLatitude,
    marineLongitude,
    timezone: row.timezone,
    isWeatherEnabled: Boolean(row.is_weather_enabled),
    tideCheckEnabled: Boolean(row.tide_check_enabled),
    tideCheckStationId: row.tide_check_station_id,
    tideCheckStationName: row.tide_check_station_name,
    tideCheckStationLatitude: row.tide_check_station_latitude,
    tideCheckStationLongitude: row.tide_check_station_longitude,
    tideCheckStationState: row.tide_check_station_state,
    tideCheckStationCountry: row.tide_check_station_country,
    stationVerifiedAt: row.station_verified_at,
    stationVerifiedBy: row.station_verified_by,
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
  forecastType: "weather" | "marine" | "tide",
  provider: "open-meteo" | "tidecheck",
  cacheSeconds: number,
  staleSeconds: number,
  loader: () => Promise<T>,
  correlationId: string,
) {
  const db = database();
  const row = await db
    .prepare(
      "SELECT payload_json, fetched_at, expires_at, stale_until FROM weather_cache WHERE location_id=? AND forecast_type=? AND provider=?",
    )
    .bind(locationId, forecastType, provider)
    .first<CacheRow>();
  const currentMs = Date.now();
  if (row && new Date(row.expires_at).getTime() > currentMs) {
    console.info(
      JSON.stringify({
        event: "weather_cache",
        locationId,
        provider,
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
      Date.now() + cacheSeconds * 1000,
    ).toISOString();
    const staleUntil = new Date(
      Date.now() + staleSeconds * 1000,
    ).toISOString();
    const payload = JSON.stringify(data);
    if (usesMysql()) {
      await db
        .prepare(
          "INSERT INTO weather_cache (id, location_id, forecast_type, provider, payload_json, fetched_at, expires_at, stale_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE payload_json=VALUES(payload_json), fetched_at=VALUES(fetched_at), expires_at=VALUES(expires_at), stale_until=VALUES(stale_until), updated_at=VALUES(updated_at)",
        )
        .bind(
          crypto.randomUUID(),
          locationId,
          forecastType,
          provider,
          payload,
          fetchedAt,
          expiresAt,
          staleUntil,
          fetchedAt,
          fetchedAt,
        )
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO weather_cache (id, location_id, forecast_type, provider, payload_json, fetched_at, expires_at, stale_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(location_id, forecast_type, provider) DO UPDATE SET payload_json=excluded.payload_json, fetched_at=excluded.fetched_at, expires_at=excluded.expires_at, stale_until=excluded.stale_until, updated_at=excluded.updated_at",
        )
        .bind(
          crypto.randomUUID(),
          locationId,
          forecastType,
          provider,
          payload,
          fetchedAt,
          expiresAt,
          staleUntil,
          fetchedAt,
          fetchedAt,
        )
        .run();
    }
    return { data, fetchedAt, expiresAt, stale: false };
  } catch (error) {
    if (row && new Date(row.stale_until).getTime() > currentMs) {
      console.warn(
        JSON.stringify({
          event: "weather_cache",
          locationId,
          provider,
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

function localYucatanDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: weatherConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function mapTideSummary(source: Awaited<ReturnType<typeof fetchTideCheckForecast>>) {
  const station: TideStation = {
    id: source.station.id,
    slug: source.station.slug ?? null,
    name: source.station.name,
    region: source.station.region ?? null,
    country: source.station.country ?? null,
    latitude: source.station.lat ?? null,
    longitude: source.station.lng ?? null,
    label: `${source.station.name}, ${source.station.region ?? ""}, ${source.station.country ?? ""}`
      .replace(/, ,/g, ",")
      .replace(/,\s*$/, "")
      .trim(),
  };
  const summary: TideSummary = {
    station,
    datum: source.datum,
    extremes: (source.extremes ?? []).map((item) => ({
      time: item.time,
      localTime: item.localTime ?? null,
      localDate: item.localDate ?? null,
      heightMeters: item.height ?? null,
      type: item.type,
    })),
    timeSeries: (source.timeSeries ?? []).map((item) => ({
      time: item.time,
      heightMeters: item.height ?? null,
    })),
    sunrise: source.conditions?.sunrise ?? null,
    sunset: source.conditions?.sunset ?? null,
    sunriseLocal: source.conditions?.sunriseLocal ?? null,
    sunsetLocal: source.conditions?.sunsetLocal ?? null,
    moonPhase: source.conditions?.moonPhase ?? null,
    moonPhaseValue: source.conditions?.moonPhaseValue ?? null,
    moonIllumination: source.conditions?.moonIllumination ?? null,
    tidalStrength: source.conditions?.tidalStrength ?? null,
    tidalStrengthValue: source.conditions?.tidalStrengthValue ?? null,
    springNeap: source.conditions?.springNeap ?? null,
    moonCalendar: (source.conditions?.moonCalendar ?? []).map((item) => ({
      type: item.type ?? null,
      name: item.name ?? null,
      date: item.date ?? null,
      dateLocal: item.dateLocal ?? null,
    })),
    dailyConditions: (source.dailyConditions ?? []).map((item) => ({
      date: item.date,
      sunrise: item.sunrise ?? null,
      sunset: item.sunset ?? null,
      sunriseLocal: item.sunriseLocal ?? null,
      sunsetLocal: item.sunsetLocal ?? null,
      moonPhase: item.moonPhase ?? null,
      moonPhaseValue: item.moonPhaseValue ?? null,
      moonIllumination: item.moonIllumination ?? null,
      solunarRating: item.solunarRating ?? null,
      solunarLabel: item.solunarLabel ?? null,
      springNeap: item.springNeap ?? null,
      solunarPeriods: (item.solunarPeriods ?? []).map((period) => ({
        type: period.type,
        start: period.start ?? null,
        end: period.end ?? null,
        peak: period.peak ?? null,
        startLocal: period.startLocal ?? null,
        endLocal: period.endLocal ?? null,
        peakLocal: period.peakLocal ?? null,
        enhanced: Boolean(period.enhanced),
      })),
    })),
  };
  return summary;
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
      "open-meteo",
      weatherConfig.cacheSeconds,
      weatherConfig.staleSeconds,
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
      "open-meteo",
      weatherConfig.cacheSeconds,
      weatherConfig.staleSeconds,
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
  let tideResult:
    | {
        fetchedAt: string;
        expiresAt: string;
        stale: boolean;
        data: ReturnType<typeof mapTideSummary>;
      }
    | null = null;
  let tideUnavailableReason: string | null = null;
  if (location.tideCheckEnabled && location.tideCheckStationId) {
    try {
      tideResult = await cached(
        location.id,
        "tide",
        "tidecheck",
        weatherConfig.tideCacheSeconds,
        weatherConfig.solunarCacheSeconds,
        async () =>
          mapTideSummary(
            await fetchTideCheckForecast(
              {
                stationId: location.tideCheckStationId!,
                start: localYucatanDate(),
                days: weatherConfig.forecastDays,
                datum: "LAT",
              },
              correlationId,
            ),
          ),
        correlationId,
      );
    } catch (error) {
      tideUnavailableReason =
        error instanceof TideCheckUnavailableError
          ? error.message
          : "No fue posible consultar mareas y actividad solunar.";
    }
  } else {
    tideUnavailableReason =
      "Este puerto aún no tiene una estación de mareas verificada.";
  }
  const fetchedAt =
    [general?.fetchedAt, marine?.fetchedAt, tideResult?.fetchedAt]
      .filter(Boolean)
      .sort()
      .at(0) ??
    now();
  const cachedUntil =
    [general?.expiresAt, marine?.expiresAt, tideResult?.expiresAt]
      .filter(Boolean)
      .sort()
      .at(0) ??
    fetchedAt;
  const rules = await thresholds();
  const joinedHourly = joinHourly(mappedWeather.hourly, mappedMarine.hourly);
  return {
    location: {
      id: location.id,
      name: location.name,
      timezone: location.timezone,
      tideCheckEnabled: location.tideCheckEnabled,
      tideCheckStationId: location.tideCheckStationId,
      tideCheckStationName: location.tideCheckStationName,
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
    tides: tideResult?.data ?? null,
    tideUnavailableReason,
    fetchedAt,
    cachedUntil,
    provider: tideResult ? "open-meteo+tidecheck" : "open-meteo",
    isStale: Boolean(general?.stale || marine?.stale || tideResult?.stale),
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
    if (!row) {
      await db
        .prepare(
          "INSERT INTO weather_rate_limits (id, rate_key, window_start, count, updated_at) VALUES (?, ?, ?, 1, ?)",
        )
        .bind(crypto.randomUUID(), rateKey, timestamp, timestamp)
        .run();
    } else {
      await db
        .prepare(
          "UPDATE weather_rate_limits SET window_start=?, count=1, updated_at=? WHERE id=?",
        )
        .bind(timestamp, timestamp, row.id)
        .run();
    }
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

export async function findNearbyTideStations(locationId: string) {
  const location = await getWeatherLocation(locationId);
  if (!weatherConfig.tideCheckApiKey)
    throw new TideCheckUnavailableError(
      "Configura TIDECHECK_API_KEY para buscar estaciones de mareas.",
    );
  const response = await fetchNearestTideStations(
    {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    crypto.randomUUID(),
  );
  return response
    .filter(
      (station) =>
        station.country?.toLowerCase() === "mexico" ||
        station.country?.toLowerCase() === "méxico",
    )
    .filter((station) => station.lat != null && station.lng != null)
    .filter((station) =>
      weatherConfig.yucatanGeofenceEnabled
        ? haversineKm(
            { latitude: location.latitude, longitude: location.longitude },
            {
              latitude: Number(station.lat),
              longitude: Number(station.lng),
            },
          ) <= 120
        : true,
    )
    .map((station) => ({
      id: station.id,
      slug: station.slug ?? null,
      name: station.name,
      region: station.region ?? null,
      country: station.country ?? null,
      latitude: station.lat ?? null,
      longitude: station.lng ?? null,
      label: station.label ?? null,
      distanceKm:
        station.distanceKm ??
        haversineKm(
          { latitude: location.latitude, longitude: location.longitude },
          {
            latitude: Number(station.lat),
            longitude: Number(station.lng),
          },
        ),
    }));
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
  const snapshotValues = [
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
  ];
  if (usesMysql()) {
    await db
      .prepare(
        "INSERT INTO fishing_trip_weather_snapshots (id, fishing_trip_id, location_id, captured_at, snapshot_type, provider, latitude, longitude, marine_latitude, marine_longitude, timezone, temperature_c, apparent_temperature_c, humidity_percent, precipitation_mm, precipitation_probability_percent, weather_code, cloud_cover_percent, visibility_meters, wind_speed_kmh, wind_direction_degrees, wind_gust_kmh, wave_height_meters, wave_direction_degrees, wave_period_seconds, swell_height_meters, swell_direction_degrees, swell_period_seconds, sea_surface_temperature_c, ocean_current_velocity_kmh, ocean_current_direction_degrees, raw_provider_reference, created_at) VALUES (?, ?, ?, ?, ?, 'open-meteo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE location_id=VALUES(location_id), captured_at=VALUES(captured_at), snapshot_type=VALUES(snapshot_type), provider='open-meteo', latitude=VALUES(latitude), longitude=VALUES(longitude), marine_latitude=VALUES(marine_latitude), marine_longitude=VALUES(marine_longitude), timezone=VALUES(timezone), temperature_c=VALUES(temperature_c), apparent_temperature_c=VALUES(apparent_temperature_c), humidity_percent=VALUES(humidity_percent), precipitation_mm=VALUES(precipitation_mm), precipitation_probability_percent=VALUES(precipitation_probability_percent), weather_code=VALUES(weather_code), cloud_cover_percent=VALUES(cloud_cover_percent), visibility_meters=VALUES(visibility_meters), wind_speed_kmh=VALUES(wind_speed_kmh), wind_direction_degrees=VALUES(wind_direction_degrees), wind_gust_kmh=VALUES(wind_gust_kmh), wave_height_meters=VALUES(wave_height_meters), wave_direction_degrees=VALUES(wave_direction_degrees), wave_period_seconds=VALUES(wave_period_seconds), swell_height_meters=VALUES(swell_height_meters), swell_direction_degrees=VALUES(swell_direction_degrees), swell_period_seconds=VALUES(swell_period_seconds), sea_surface_temperature_c=VALUES(sea_surface_temperature_c), ocean_current_velocity_kmh=VALUES(ocean_current_velocity_kmh), ocean_current_direction_degrees=VALUES(ocean_current_direction_degrees), raw_provider_reference=VALUES(raw_provider_reference), created_at=VALUES(created_at)",
      )
      .bind(...snapshotValues)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO fishing_trip_weather_snapshots (id, fishing_trip_id, location_id, captured_at, snapshot_type, provider, latitude, longitude, marine_latitude, marine_longitude, timezone, temperature_c, apparent_temperature_c, humidity_percent, precipitation_mm, precipitation_probability_percent, weather_code, cloud_cover_percent, visibility_meters, wind_speed_kmh, wind_direction_degrees, wind_gust_kmh, wave_height_meters, wave_direction_degrees, wave_period_seconds, swell_height_meters, swell_direction_degrees, swell_period_seconds, sea_surface_temperature_c, ocean_current_velocity_kmh, ocean_current_direction_degrees, raw_provider_reference, created_at) VALUES (?, ?, ?, ?, ?, 'open-meteo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(fishing_trip_id) DO UPDATE SET location_id=excluded.location_id, captured_at=excluded.captured_at, snapshot_type=excluded.snapshot_type, latitude=excluded.latitude, longitude=excluded.longitude, marine_latitude=excluded.marine_latitude, marine_longitude=excluded.marine_longitude, timezone=excluded.timezone, temperature_c=excluded.temperature_c, apparent_temperature_c=excluded.apparent_temperature_c, humidity_percent=excluded.humidity_percent, precipitation_mm=excluded.precipitation_mm, precipitation_probability_percent=excluded.precipitation_probability_percent, weather_code=excluded.weather_code, cloud_cover_percent=excluded.cloud_cover_percent, visibility_meters=excluded.visibility_meters, wind_speed_kmh=excluded.wind_speed_kmh, wind_direction_degrees=excluded.wind_direction_degrees, wind_gust_kmh=excluded.wind_gust_kmh, wave_height_meters=excluded.wave_height_meters, wave_direction_degrees=excluded.wave_direction_degrees, wave_period_seconds=excluded.wave_period_seconds, swell_height_meters=excluded.swell_height_meters, swell_direction_degrees=excluded.swell_direction_degrees, swell_period_seconds=excluded.swell_period_seconds, sea_surface_temperature_c=excluded.sea_surface_temperature_c, ocean_current_velocity_kmh=excluded.ocean_current_velocity_kmh, ocean_current_direction_degrees=excluded.ocean_current_direction_degrees, raw_provider_reference=excluded.raw_provider_reference",
      )
      .bind(...snapshotValues)
      .run();
  }
  const saved = await db
    .prepare(
      "SELECT * FROM fishing_trip_weather_snapshots WHERE fishing_trip_id=?",
    )
    .bind(trip.id)
    .first<Record<string, unknown>>();
  return saved ? mapRow(saved) : null;
}
