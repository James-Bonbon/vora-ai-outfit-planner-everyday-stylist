import { useState, useEffect } from "react";

export interface WeatherData {
  temp: number;
  code: number;
}

export const useWeather = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
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
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
          );
          const data = await res.json();
          setWeather({
            temp: data.current_weather.temperature,
            code: data.current_weather.weathercode,
          });
        } catch (e) {
          console.error("Weather fetch failed", e);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
      }
    );
  }, []);

  return { weather, loading };
};
