const integer = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
};

export const weatherConfig = {
  weatherBaseUrl:
    process.env.OPEN_METEO_WEATHER_URL ??
    "https://api.open-meteo.com/v1/forecast",
  marineBaseUrl:
    process.env.OPEN_METEO_MARINE_URL ??
    "https://marine-api.open-meteo.com/v1/marine",
  apiKey: process.env.OPEN_METEO_API_KEY || undefined,
  tideCheckBaseUrl:
    process.env.TIDECHECK_API_BASE_URL ?? "https://tidecheck.com",
  tideCheckApiKey: process.env.TIDECHECK_API_KEY || undefined,
  timezone: process.env.DEFAULT_TIMEZONE ?? "America/Merida",
  forecastDays: 7,
  cacheSeconds: integer(process.env.WEATHER_CACHE_SECONDS, 3600, 1800, 3600),
  staleSeconds: integer(process.env.WEATHER_STALE_SECONDS, 21600, 3600, 86400),
  tideCacheSeconds: integer(process.env.TIDE_CACHE_SECONDS, 21600, 1800, 86400),
  solunarCacheSeconds: integer(
    process.env.SOLUNAR_CACHE_SECONDS,
    21600,
    1800,
    86400,
  ),
  requestTimeoutMs: integer(
    process.env.WEATHER_REQUEST_TIMEOUT_MS,
    10000,
    1000,
    30000,
  ),
  tideCheckRequestTimeoutMs: integer(
    process.env.TIDECHECK_REQUEST_TIMEOUT_MS,
    10000,
    1000,
    30000,
  ),
  yucatanGeofenceEnabled:
    process.env.YUCATAN_GEOFENCE_ENABLED === "false" ? false : true,
  yucatanMarineMarginKm: Number(process.env.YUCATAN_MARINE_MARGIN_KM || 12),
  maximumResponseBytes: 2_000_000,
  retryCount: 1,
} as const;

export function assertProviderUrl(value: string, expectedHost: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== expectedHost) {
    throw new Error(
      `El proveedor meteorologico debe usar https://${expectedHost}`,
    );
  }
  return url;
}
