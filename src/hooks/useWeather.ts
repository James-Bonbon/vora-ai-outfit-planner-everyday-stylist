import { useState, useEffect } from "react";

export interface WeatherData {
  temp: number;
  code: number;
}

export interface DailyForecast {
  /** Mean daily temperature in °C (rounded to nearest integer) */
  temp: number;
  /** WMO weather code for the day */
  code: number;
  /** ISO date string `yyyy-MM-dd` */
  date: string;
}

/** Map daily forecast entries by ISO date `yyyy-MM-dd`. */
export type ForecastByDate = Record<string, DailyForecast>;

/**
 * Open-Meteo WMO weather codes → coarse label used for icon selection.
 * Keep these labels stable since `outfit_calendar.weather_label` and
 * the WEATHER_ICON map in OutfitCalendar both rely on them.
 */
export function weatherCodeToLabel(code: number): "warm" | "cool" | "rainy" | "neutral" {
  if (code === 0) return "warm";
  if (code >= 71 && code <= 77) return "cool"; // snow
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) return "rainy";
  return "neutral";
}

export const useWeather = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecastByDate, setForecastByDate] = useState<ForecastByDate>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Fetch current weather + 7-day daily forecast in a single request.
          const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
            `&current_weather=true` +
            `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
            `&timezone=auto&forecast_days=7`;
          const res = await fetch(url);
          const data = await res.json();

          setWeather({
            temp: data.current_weather.temperature,
            code: data.current_weather.weathercode,
          });

          const map: ForecastByDate = {};
          const days: string[] = data.daily?.time ?? [];
          const maxs: number[] = data.daily?.temperature_2m_max ?? [];
          const mins: number[] = data.daily?.temperature_2m_min ?? [];
          const codes: number[] = data.daily?.weathercode ?? [];
          for (let i = 0; i < days.length; i++) {
            const max = maxs[i];
            const min = mins[i];
            // Use mean of max+min as representative daily temp; styling
            // thresholds (>22 hot, <15 cold) match this scale well.
            const mean =
              typeof max === "number" && typeof min === "number"
                ? Math.round((max + min) / 2)
                : typeof max === "number"
                ? Math.round(max)
                : typeof min === "number"
                ? Math.round(min)
                : NaN;
            if (Number.isFinite(mean)) {
              map[days[i]] = { temp: mean, code: codes[i] ?? 0, date: days[i] };
            }
          }
          setForecastByDate(map);
        } catch (e) {
          console.error("Weather fetch failed", e);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
      },
    );
  }, []);

  return { weather, forecastByDate, loading };
};
