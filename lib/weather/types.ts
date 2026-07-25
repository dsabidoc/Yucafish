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

export type TideStation = {
  id: string;
  slug?: string | null;
  name: string;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  label: string | null;
  distanceKm?: number | null;
};

export type TideExtreme = {
  time: string;
  localTime: string | null;
  localDate: string | null;
  heightMeters: number | null;
  type: "high" | "low";
};

export type TideSeriesPoint = {
  time: string;
  heightMeters: number | null;
};

export type SolunarPeriod = {
  type: "major" | "minor";
  start: string | null;
  end: string | null;
  peak: string | null;
  startLocal: string | null;
  endLocal: string | null;
  peakLocal: string | null;
  enhanced: boolean;
};

export type DailySolunarCondition = {
  date: string;
  sunrise: string | null;
  sunset: string | null;
  sunriseLocal: string | null;
  sunsetLocal: string | null;
  moonPhase: string | null;
  moonPhaseValue: number | null;
  moonIllumination: number | null;
  solunarRating: number | null;
  solunarLabel: string | null;
  springNeap: string | null;
  solunarPeriods: SolunarPeriod[];
};

export type TideSummary = {
  station: TideStation;
  datum: "LAT" | "MLLW" | "MSL";
  extremes: TideExtreme[];
  timeSeries: TideSeriesPoint[];
  sunrise: string | null;
  sunset: string | null;
  sunriseLocal: string | null;
  sunsetLocal: string | null;
  moonPhase: string | null;
  moonPhaseValue: number | null;
  moonIllumination: number | null;
  tidalStrength: string | null;
  tidalStrengthValue: number | null;
  springNeap: string | null;
  moonCalendar: Array<{
    type: string | null;
    name: string | null;
    date: string | null;
    dateLocal: string | null;
  }>;
  dailyConditions: DailySolunarCondition[];
};

export type FishingConditionIndicator = {
  level: "IDEAL" | "FAVORABLE" | "CAUTION" | "DIFFICULT" | "INSUFFICIENT";
  label: string;
  reasons: string[];
};

export type DailyFishingOutlook = {
  date: string;
  condition: FishingConditionIndicator;
  bestHours: string[];
  waveHeightMaxMeters: number | null;
  waveHeightAverageMeters: number | null;
  wavePeriodMinSeconds: number | null;
  swellHeightMaxMeters: number | null;
  seaSurfaceTemperatureAverageC: number | null;
  currentVelocityMaxKmh: number | null;
};

export type PortForecast = {
  location: {
    id: string;
    name: string;
    timezone: string;
    tideCheckEnabled?: boolean;
    tideCheckStationId?: string | null;
    tideCheckStationName?: string | null;
  };
  currentWeather: WeatherCondition | null;
  currentMarine: MarineCondition | null;
  hourly: Array<{
    time: string;
    weather: WeatherCondition | null;
    marine: MarineCondition | null;
  }>;
  daily: DailyForecast[];
  dailyFishingOutlooks: DailyFishingOutlook[];
  tides: TideSummary | null;
  tideUnavailableReason: string | null;
  fetchedAt: string;
  cachedUntil: string;
  provider: "open-meteo+tidecheck" | "open-meteo";
  isStale: boolean;
  partialError: "weather" | "marine" | null;
  condition: FishingConditionIndicator;
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
  tideCheckEnabled?: boolean;
  tideCheckStationId?: string | null;
  tideCheckStationName?: string | null;
  tideCheckStationLatitude?: number | null;
  tideCheckStationLongitude?: number | null;
  tideCheckStationState?: string | null;
  tideCheckStationCountry?: string | null;
  stationVerifiedAt?: string | null;
  stationVerifiedBy?: string | null;
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
