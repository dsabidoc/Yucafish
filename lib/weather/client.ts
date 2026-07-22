import { weatherConfig, assertProviderUrl } from "./config";
import {
  WeatherProviderError,
  WeatherTimeoutError,
  WeatherValidationError,
} from "./errors";
import { marineResponseSchema, weatherResponseSchema } from "./schemas";

const weatherCurrent = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "is_day",
];
const weatherHourly = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "visibility",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
];
const weatherDaily = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "sunrise",
  "sunset",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
];
const marineVariables = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "wave_peak_period",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
  "sea_surface_temperature",
  "ocean_current_velocity",
  "ocean_current_direction",
  "sea_level_height_msl",
];

type Coordinates = { latitude: number; longitude: number; timezone: string };

export function buildWeatherUrl(input: Coordinates) {
  const url = assertProviderUrl(
    weatherConfig.weatherBaseUrl,
    "api.open-meteo.com",
  );
  url.search = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    timezone: input.timezone,
    forecast_days: String(weatherConfig.forecastDays),
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    timeformat: "iso8601",
    current: weatherCurrent.join(","),
    hourly: weatherHourly.join(","),
    daily: weatherDaily.join(","),
  }).toString();
  if (weatherConfig.apiKey)
    url.searchParams.set("apikey", weatherConfig.apiKey);
  return url;
}

export function buildMarineUrl(input: Coordinates) {
  const url = assertProviderUrl(
    weatherConfig.marineBaseUrl,
    "marine-api.open-meteo.com",
  );
  url.search = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    timezone: input.timezone,
    forecast_days: String(weatherConfig.forecastDays),
    length_unit: "metric",
    velocity_unit: "kmh",
    timeformat: "iso8601",
    cell_selection: "sea",
    current: marineVariables.join(","),
    hourly: marineVariables.join(","),
  }).toString();
  if (weatherConfig.apiKey)
    url.searchParams.set("apikey", weatherConfig.apiKey);
  return url;
}

async function requestJson(url: URL, correlationId: string) {
  for (let attempt = 0; attempt <= weatherConfig.retryCount; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      weatherConfig.requestTimeoutMs,
    );
    const started = Date.now();
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json", "user-agent": "YucaFish/1.0" },
      });
      if (!response.ok) {
        if (response.status < 500 || attempt === weatherConfig.retryCount)
          throw new WeatherProviderError(
            `Open-Meteo respondió con estado ${response.status}`,
          );
        continue;
      }
      const length = Number(response.headers.get("content-length") || 0);
      if (length > weatherConfig.maximumResponseBytes)
        throw new WeatherValidationError(
          "Respuesta meteorológica demasiado grande",
        );
      const body = await response.text();
      if (body.length > weatherConfig.maximumResponseBytes)
        throw new WeatherValidationError(
          "Respuesta meteorológica demasiado grande",
        );
      try {
        console.info(
          JSON.stringify({
            event: "weather_provider_request",
            provider: "open-meteo",
            durationMs: Date.now() - started,
            resultStatus: "success",
            correlationId,
          }),
        );
        return JSON.parse(body) as unknown;
      } catch {
        throw new WeatherValidationError("Open-Meteo devolvió JSON inválido");
      }
    } catch (error) {
      if (
        error instanceof WeatherProviderError ||
        error instanceof WeatherValidationError
      )
        throw error;
      if (controller.signal.aborted)
        throw new WeatherTimeoutError(
          "La consulta meteorológica excedió el tiempo permitido",
        );
      if (attempt === weatherConfig.retryCount)
        throw new WeatherProviderError(
          "No fue posible conectar con Open-Meteo",
        );
    } finally {
      clearTimeout(timer);
    }
  }
  throw new WeatherProviderError("No fue posible conectar con Open-Meteo");
}

export async function fetchWeather(input: Coordinates, correlationId: string) {
  const parsed = weatherResponseSchema.safeParse(
    await requestJson(buildWeatherUrl(input), correlationId),
  );
  if (!parsed.success)
    throw new WeatherValidationError(
      "La respuesta meteorológica no tiene el formato esperado",
    );
  return parsed.data;
}

export async function fetchMarine(input: Coordinates, correlationId: string) {
  const parsed = marineResponseSchema.safeParse(
    await requestJson(buildMarineUrl(input), correlationId),
  );
  if (!parsed.success)
    throw new WeatherValidationError(
      "La respuesta marina no tiene el formato esperado",
    );
  return parsed.data;
}
