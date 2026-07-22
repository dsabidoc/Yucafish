import { z } from "zod";

const nullableNumber = z.number().finite().nullable();
const series = z.array(nullableNumber);

export const weatherResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: z
    .object({
      time: z.string(),
      temperature_2m: nullableNumber.optional(),
      relative_humidity_2m: nullableNumber.optional(),
      apparent_temperature: nullableNumber.optional(),
      precipitation: nullableNumber.optional(),
      weather_code: nullableNumber.optional(),
      cloud_cover: nullableNumber.optional(),
      wind_speed_10m: nullableNumber.optional(),
      wind_direction_10m: nullableNumber.optional(),
      wind_gusts_10m: nullableNumber.optional(),
      is_day: nullableNumber.optional(),
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string()),
      temperature_2m: series.optional(),
      apparent_temperature: series.optional(),
      relative_humidity_2m: series.optional(),
      precipitation_probability: series.optional(),
      precipitation: series.optional(),
      weather_code: series.optional(),
      cloud_cover: series.optional(),
      visibility: series.optional(),
      wind_speed_10m: series.optional(),
      wind_direction_10m: series.optional(),
      wind_gusts_10m: series.optional(),
    })
    .optional(),
  daily: z
    .object({
      time: z.array(z.string()),
      weather_code: series.optional(),
      temperature_2m_max: series.optional(),
      temperature_2m_min: series.optional(),
      apparent_temperature_max: series.optional(),
      apparent_temperature_min: series.optional(),
      sunrise: z.array(z.string().nullable()).optional(),
      sunset: z.array(z.string().nullable()).optional(),
      precipitation_sum: series.optional(),
      precipitation_probability_max: series.optional(),
      wind_speed_10m_max: series.optional(),
      wind_gusts_10m_max: series.optional(),
      wind_direction_10m_dominant: series.optional(),
    })
    .optional(),
});

export const marineResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: z
    .object({
      time: z.string(),
      wave_height: nullableNumber.optional(),
      wave_direction: nullableNumber.optional(),
      wave_period: nullableNumber.optional(),
      wave_peak_period: nullableNumber.optional(),
      swell_wave_height: nullableNumber.optional(),
      swell_wave_direction: nullableNumber.optional(),
      swell_wave_period: nullableNumber.optional(),
      sea_surface_temperature: nullableNumber.optional(),
      ocean_current_velocity: nullableNumber.optional(),
      ocean_current_direction: nullableNumber.optional(),
      sea_level_height_msl: nullableNumber.optional(),
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string()),
      wave_height: series.optional(),
      wave_direction: series.optional(),
      wave_period: series.optional(),
      wave_peak_period: series.optional(),
      swell_wave_height: series.optional(),
      swell_wave_direction: series.optional(),
      swell_wave_period: series.optional(),
      sea_surface_temperature: series.optional(),
      ocean_current_velocity: series.optional(),
      ocean_current_direction: series.optional(),
      sea_level_height_msl: series.optional(),
    })
    .optional(),
});

export const locationIdSchema = z.string().uuid();
export type WeatherProviderResponse = z.infer<typeof weatherResponseSchema>;
export type MarineProviderResponse = z.infer<typeof marineResponseSchema>;
