import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { buildMarineUrl, buildWeatherUrl, fetchWeather } from "../lib/weather/client";
import { degreesToCompass, fishingCondition, joinHourly, mapMarine, mapWeather, nearestTimeIndex, wmoCondition } from "../lib/weather/domain";
import { WeatherProviderError, WeatherValidationError } from "../lib/weather/errors";
import { weatherResponseSchema } from "../lib/weather/schemas";
import type { MarineCondition, WeatherCondition } from "../lib/weather/types";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("construye URLs oficiales sin aceptar coordenadas del navegador", () => {
  const weather = buildWeatherUrl({ latitude: 21.282214, longitude: -89.663664, timezone: "America/Merida" });
  assert.equal(weather.hostname, "api.open-meteo.com"); assert.equal(weather.searchParams.get("forecast_days"), "7");
  assert.match(weather.searchParams.get("current") || "", /temperature_2m/); assert.match(weather.searchParams.get("hourly") || "", /visibility/);
  const marine = buildMarineUrl({ latitude: 21.326, longitude: -89.6637, timezone: "America/Merida" });
  assert.equal(marine.hostname, "marine-api.open-meteo.com"); assert.equal(marine.searchParams.get("cell_selection"), "sea"); assert.match(marine.searchParams.get("hourly") || "", /sea_surface_temperature/);
});

test("convierte grados a los 16 puntos cardinales en español", () => {
  assert.equal(degreesToCompass(0), "N"); assert.equal(degreesToCompass(45), "NE"); assert.equal(degreesToCompass(225), "SO"); assert.equal(degreesToCompass(360), "N"); assert.equal(degreesToCompass(-1), null);
});

test("traduce códigos WMO sin mostrar números crudos", () => {
  assert.equal(wmoCondition(0, false).label, "Noche despejada"); assert.equal(wmoCondition(63).label, "Lluvia"); assert.equal(wmoCondition(95).label, "Tormenta"); assert.equal(wmoCondition(null).label, "No disponible");
});

test("valida respuestas y rechaza estructuras incompletas", () => {
  assert.equal(weatherResponseSchema.safeParse({ latitude: 21, longitude: -89 }).success, false);
  assert.equal(weatherResponseSchema.safeParse({ latitude: 21, longitude: -89, timezone: "America/Merida", hourly: { time: [], temperature_2m: [] } }).success, true);
});

test("mapea valores ausentes como null, nunca como cero", () => {
  const mapped = mapWeather({ latitude: 21, longitude: -89, timezone: "America/Merida", hourly: { time: ["2026-07-22T10:00"], temperature_2m: [null], precipitation: [0] } }, "2026-07-22T10:00");
  assert.equal(mapped.current?.temperatureC, null); assert.equal(mapped.current?.precipitationMm, 0); assert.equal(mapped.current?.windSpeedKmh, null);
});

test("selecciona la condición marina más cercana a la hora actual", () => {
  const mapped = mapMarine({ latitude: 21, longitude: -89, timezone: "America/Merida", hourly: { time: ["2026-07-22T08:00", "2026-07-22T11:00"], wave_height: [0.2, 0.8] } }, "2026-07-22T10:30");
  assert.equal(mapped.current?.waveHeightMeters, 0.8); assert.equal(nearestTimeIndex(["2026-07-22T08:00", "2026-07-22T11:00"], "2026-07-22T10:30"), 1);
});

test("une clima y mar por timestamp tolerando horas faltantes", () => {
  const weather = [{ observedAt: "2026-07-22T10:00" } as WeatherCondition]; const marine = [{ observedAt: "2026-07-22T11:00" } as MarineCondition];
  const joined = joinHourly(weather, marine); assert.equal(joined.length, 2); assert.equal(joined[0]?.marine, null); assert.equal(joined[1]?.weather, null);
});

test("el indicador toma el peor nivel y exige información crítica", () => {
  const thresholds = { maximumFavorableWindKmh: 25, maximumCautionWindKmh: 40, maximumFavorableGustKmh: 35, maximumCautionGustKmh: 55, maximumFavorableWaveMeters: 1.2, maximumCautionWaveMeters: 2, minimumFavorableWavePeriodSeconds: 5 };
  assert.equal(fishingCondition({ windSpeedKmh: 12, windGustKmh: 20, weatherCode: 1, visibilityMeters: 10000 } as WeatherCondition, { waveHeightMeters: 0.5, wavePeriodSeconds: 6 } as MarineCondition, thresholds).level, "FAVORABLE");
  assert.equal(fishingCondition({ windSpeedKmh: 42, windGustKmh: 20, weatherCode: 1 } as WeatherCondition, { waveHeightMeters: 0.5, wavePeriodSeconds: 6 } as MarineCondition, thresholds).level, "DIFFICULT");
  assert.equal(fishingCondition({ windSpeedKmh: null, windGustKmh: null } as WeatherCondition, null, thresholds).level, "INSUFFICIENT");
});

test("convierte errores HTTP del proveedor en errores tipados", async () => {
  globalThis.fetch = async () => new Response("bad request", { status: 400 });
  await assert.rejects(() => fetchWeather({ latitude: 21, longitude: -89, timezone: "America/Merida" }, "test-http"), WeatherProviderError);
});

test("rechaza JSON inválido del proveedor", async () => {
  globalThis.fetch = async () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
  await assert.rejects(() => fetchWeather({ latitude: 21, longitude: -89, timezone: "America/Merida" }, "test-json"), WeatherValidationError);
});
