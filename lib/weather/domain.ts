import type {
  ConditionThresholds,
  DailyForecast,
  MarineCondition,
  PortForecast,
  WeatherCondition,
} from "./types";
import type {
  MarineProviderResponse,
  WeatherProviderResponse,
} from "./schemas";

const value = (items: Array<number | null> | undefined, index: number) =>
  items?.[index] ?? null;

export function degreesToCompass(degrees: number | null): string | null {
  if (
    degrees === null ||
    !Number.isFinite(degrees) ||
    degrees < 0 ||
    degrees > 360
  )
    return null;
  const points = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSO",
    "SO",
    "OSO",
    "O",
    "ONO",
    "NO",
    "NNO",
  ];
  return points[Math.round((degrees % 360) / 22.5) % 16];
}

export function wmoCondition(code: number | null, isDay = true) {
  if (code === null)
    return {
      label: "No disponible",
      icon: "cloud",
      accessibleLabel: "Condición meteorológica no disponible",
    };
  if (code === 0)
    return {
      label: isDay ? "Despejado" : "Noche despejada",
      icon: isDay ? "sun" : "moon",
      accessibleLabel: isDay ? "Cielo despejado" : "Noche despejada",
    };
  if ([1, 2].includes(code))
    return {
      label: "Parcialmente nublado",
      icon: "cloud-sun",
      accessibleLabel: "Cielo parcialmente nublado",
    };
  if (code === 3)
    return {
      label: "Nublado",
      icon: "cloud",
      accessibleLabel: "Cielo nublado",
    };
  if ([45, 48].includes(code))
    return { label: "Niebla", icon: "cloud-fog", accessibleLabel: "Niebla" };
  if ([51, 53, 55, 56, 57].includes(code))
    return {
      label: "Llovizna",
      icon: "cloud-drizzle",
      accessibleLabel: "Llovizna",
    };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { label: "Lluvia", icon: "cloud-rain", accessibleLabel: "Lluvia" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: "Nieve", icon: "snowflake", accessibleLabel: "Nieve" };
  if ([95, 96, 99].includes(code))
    return {
      label: "Tormenta",
      icon: "cloud-lightning",
      accessibleLabel: "Tormenta eléctrica",
    };
  return {
    label: "Condición variable",
    icon: "cloud",
    accessibleLabel: "Condición meteorológica variable",
  };
}

export function nearestTimeIndex(times: string[], target: string) {
  if (!times.length) return -1;
  const targetMs = new Date(target).getTime();
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const current = Math.abs(new Date(time).getTime() - targetMs);
    if (current < distance) {
      best = index;
      distance = current;
    }
  });
  return best;
}

function mapHourlyWeather(data: WeatherProviderResponse): WeatherCondition[] {
  const hourly = data.hourly;
  if (!hourly) return [];
  return hourly.time.map((time, index) => ({
    observedAt: time,
    temperatureC: value(hourly.temperature_2m, index),
    apparentTemperatureC: value(hourly.apparent_temperature, index),
    humidityPercent: value(hourly.relative_humidity_2m, index),
    precipitationMm: value(hourly.precipitation, index),
    precipitationProbabilityPercent: value(
      hourly.precipitation_probability,
      index,
    ),
    weatherCode: value(hourly.weather_code, index),
    cloudCoverPercent: value(hourly.cloud_cover, index),
    visibilityMeters: value(hourly.visibility, index),
    windSpeedKmh: value(hourly.wind_speed_10m, index),
    windDirectionDegrees: value(hourly.wind_direction_10m, index),
    windGustKmh: value(hourly.wind_gusts_10m, index),
    isDay: null,
  }));
}

function mapHourlyMarine(data: MarineProviderResponse): MarineCondition[] {
  const hourly = data.hourly;
  if (!hourly) return [];
  return hourly.time.map((time, index) => ({
    observedAt: time,
    waveHeightMeters: value(hourly.wave_height, index),
    waveDirectionDegrees: value(hourly.wave_direction, index),
    wavePeriodSeconds: value(hourly.wave_period, index),
    wavePeakPeriodSeconds: value(hourly.wave_peak_period, index),
    swellHeightMeters: value(hourly.swell_wave_height, index),
    swellDirectionDegrees: value(hourly.swell_wave_direction, index),
    swellPeriodSeconds: value(hourly.swell_wave_period, index),
    seaSurfaceTemperatureC: value(hourly.sea_surface_temperature, index),
    currentVelocityKmh: value(hourly.ocean_current_velocity, index),
    currentDirectionDegrees: value(hourly.ocean_current_direction, index),
    seaLevelHeightMeters: value(hourly.sea_level_height_msl, index),
  }));
}

export function mapWeather(
  data: WeatherProviderResponse,
  nowIso = new Date().toISOString(),
) {
  const hourly = mapHourlyWeather(data);
  const nearest = nearestTimeIndex(
    hourly.map((item) => item.observedAt),
    nowIso,
  );
  const supplemental = nearest >= 0 ? hourly[nearest] : null;
  const current = data.current
    ? ({
        observedAt: data.current.time,
        temperatureC: data.current.temperature_2m ?? null,
        apparentTemperatureC: data.current.apparent_temperature ?? null,
        humidityPercent: data.current.relative_humidity_2m ?? null,
        precipitationMm: data.current.precipitation ?? null,
        precipitationProbabilityPercent:
          supplemental?.precipitationProbabilityPercent ?? null,
        weatherCode: data.current.weather_code ?? null,
        cloudCoverPercent: data.current.cloud_cover ?? null,
        visibilityMeters: supplemental?.visibilityMeters ?? null,
        windSpeedKmh: data.current.wind_speed_10m ?? null,
        windDirectionDegrees: data.current.wind_direction_10m ?? null,
        windGustKmh: data.current.wind_gusts_10m ?? null,
        isDay:
          data.current.is_day === null || data.current.is_day === undefined
            ? null
            : data.current.is_day === 1,
      } satisfies WeatherCondition)
    : supplemental;
  const daily: DailyForecast[] = (data.daily?.time ?? []).map(
    (date, index) => ({
      date,
      weatherCode: value(data.daily?.weather_code, index),
      temperatureMaxC: value(data.daily?.temperature_2m_max, index),
      temperatureMinC: value(data.daily?.temperature_2m_min, index),
      apparentTemperatureMaxC: value(
        data.daily?.apparent_temperature_max,
        index,
      ),
      apparentTemperatureMinC: value(
        data.daily?.apparent_temperature_min,
        index,
      ),
      sunrise: data.daily?.sunrise?.[index] ?? null,
      sunset: data.daily?.sunset?.[index] ?? null,
      precipitationSumMm: value(data.daily?.precipitation_sum, index),
      precipitationProbabilityMaxPercent: value(
        data.daily?.precipitation_probability_max,
        index,
      ),
      windSpeedMaxKmh: value(data.daily?.wind_speed_10m_max, index),
      windGustMaxKmh: value(data.daily?.wind_gusts_10m_max, index),
      windDirectionDominantDegrees: value(
        data.daily?.wind_direction_10m_dominant,
        index,
      ),
    }),
  );
  return { current, hourly, daily };
}

export function mapMarine(
  data: MarineProviderResponse,
  nowIso = new Date().toISOString(),
) {
  const hourly = mapHourlyMarine(data);
  const nearest = nearestTimeIndex(
    hourly.map((item) => item.observedAt),
    nowIso,
  );
  const fallback = nearest >= 0 ? hourly[nearest] : null;
  const current = data.current
    ? ({
        observedAt: data.current.time,
        waveHeightMeters: data.current.wave_height ?? null,
        waveDirectionDegrees: data.current.wave_direction ?? null,
        wavePeriodSeconds: data.current.wave_period ?? null,
        wavePeakPeriodSeconds: data.current.wave_peak_period ?? null,
        swellHeightMeters: data.current.swell_wave_height ?? null,
        swellDirectionDegrees: data.current.swell_wave_direction ?? null,
        swellPeriodSeconds: data.current.swell_wave_period ?? null,
        seaSurfaceTemperatureC: data.current.sea_surface_temperature ?? null,
        currentVelocityKmh: data.current.ocean_current_velocity ?? null,
        currentDirectionDegrees: data.current.ocean_current_direction ?? null,
        seaLevelHeightMeters: data.current.sea_level_height_msl ?? null,
      } satisfies MarineCondition)
    : fallback;
  return { current, hourly };
}

export function joinHourly(
  weather: WeatherCondition[],
  marine: MarineCondition[],
) {
  const allTimes = [
    ...new Set([
      ...weather.map((x) => x.observedAt),
      ...marine.map((x) => x.observedAt),
    ]),
  ].sort();
  const weatherByTime = new Map(
    weather.map((x) => [x.observedAt.slice(0, 13), x]),
  );
  const marineByTime = new Map(
    marine.map((x) => [x.observedAt.slice(0, 13), x]),
  );
  return allTimes.map((time) => ({
    time,
    weather: weatherByTime.get(time.slice(0, 13)) ?? null,
    marine: marineByTime.get(time.slice(0, 13)) ?? null,
  }));
}

export function fishingCondition(
  weather: WeatherCondition | null,
  marine: MarineCondition | null,
  thresholds: ConditionThresholds,
): PortForecast["condition"] {
  const critical = [
    weather?.windSpeedKmh,
    weather?.windGustKmh,
    marine?.waveHeightMeters,
  ];
  if (critical.filter((x) => x !== null && x !== undefined).length < 2)
    return {
      level: "INSUFFICIENT",
      label: "Sin información suficiente",
      reasons: [],
    };
  const difficult: string[] = [];
  const caution: string[] = [];
  if ((weather?.weatherCode ?? 0) >= 95) difficult.push("Tormenta prevista");
  if ((weather?.windSpeedKmh ?? 0) > thresholds.maximumCautionWindKmh)
    difficult.push("Viento fuerte");
  else if ((weather?.windSpeedKmh ?? 0) > thresholds.maximumFavorableWindKmh)
    caution.push("Viento moderado");
  if ((weather?.windGustKmh ?? 0) > thresholds.maximumCautionGustKmh)
    difficult.push("Ráfagas fuertes");
  else if ((weather?.windGustKmh ?? 0) > thresholds.maximumFavorableGustKmh)
    caution.push("Ráfagas moderadas");
  if ((marine?.waveHeightMeters ?? 0) > thresholds.maximumCautionWaveMeters)
    difficult.push("Oleaje elevado");
  else if (
    (marine?.waveHeightMeters ?? 0) > thresholds.maximumFavorableWaveMeters
  )
    caution.push("Oleaje moderado");
  if (
    marine?.wavePeriodSeconds !== null &&
    marine?.wavePeriodSeconds !== undefined &&
    marine.wavePeriodSeconds < thresholds.minimumFavorableWavePeriodSeconds
  )
    caution.push("Periodo corto");
  if (
    weather?.visibilityMeters !== null &&
    weather?.visibilityMeters !== undefined &&
    weather.visibilityMeters < 1000
  )
    difficult.push("Visibilidad reducida");
  if (difficult.length)
    return {
      level: "DIFFICULT",
      label: "Condiciones complicadas",
      reasons: difficult,
    };
  if (caution.length)
    return { level: "CAUTION", label: "Precaución", reasons: caution };
  return {
    level: "FAVORABLE",
    label: "Condiciones favorables",
    reasons: ["Dentro de los umbrales configurados"],
  };
}
