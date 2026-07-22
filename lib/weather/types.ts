export type WeatherCondition = {
  observedAt: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPercent: number | null;
  weatherCode: number | null;
  cloudCoverPercent: number | null;
  visibilityMeters: number | null;
  windSpeedKmh: number | null;
  windDirectionDegrees: number | null;
  windGustKmh: number | null;
  isDay: boolean | null;
};

export type MarineCondition = {
  observedAt: string;
  waveHeightMeters: number | null;
  waveDirectionDegrees: number | null;
  wavePeriodSeconds: number | null;
  wavePeakPeriodSeconds: number | null;
  swellHeightMeters: number | null;
  swellDirectionDegrees: number | null;
  swellPeriodSeconds: number | null;
  seaSurfaceTemperatureC: number | null;
  currentVelocityKmh: number | null;
  currentDirectionDegrees: number | null;
  seaLevelHeightMeters: number | null;
};

export type DailyForecast = {
  date: string;
  weatherCode: number | null;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  apparentTemperatureMaxC: number | null;
  apparentTemperatureMinC: number | null;
  sunrise: string | null;
  sunset: string | null;
  precipitationSumMm: number | null;
  precipitationProbabilityMaxPercent: number | null;
  windSpeedMaxKmh: number | null;
  windGustMaxKmh: number | null;
  windDirectionDominantDegrees: number | null;
};

export type PortForecast = {
  location: { id: string; name: string; timezone: string };
  currentWeather: WeatherCondition | null;
  currentMarine: MarineCondition | null;
  hourly: Array<{
    time: string;
    weather: WeatherCondition | null;
    marine: MarineCondition | null;
  }>;
  daily: DailyForecast[];
  fetchedAt: string;
  cachedUntil: string;
  provider: "open-meteo";
  isStale: boolean;
  partialError: "weather" | "marine" | null;
  condition: {
    level: "FAVORABLE" | "CAUTION" | "DIFFICULT" | "INSUFFICIENT";
    label: string;
    reasons: string[];
  };
};

export type WeatherLocation = {
  id: string;
  name: string;
  slug: string;
  type: string;
  municipality: string | null;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  marineLatitude: number | null;
  marineLongitude: number | null;
  timezone: string;
  isWeatherEnabled: boolean;
  active: boolean;
  sortOrder: number;
};

export type ConditionThresholds = {
  maximumFavorableWindKmh: number;
  maximumCautionWindKmh: number;
  maximumFavorableGustKmh: number;
  maximumCautionGustKmh: number;
  maximumFavorableWaveMeters: number;
  maximumCautionWaveMeters: number;
  minimumFavorableWavePeriodSeconds: number;
};
