import React from "react";
import { Sun, Cloud, CloudRain, Snowflake, Loader2 } from "lucide-react";
import type { WeatherData } from "@/hooks/useWeather";

interface WeatherWidgetProps {
  weather: WeatherData | null;
  loading: boolean;
}

const RAIN_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];
const CLOUDY_CODES = [1, 2, 3, 45, 48];

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!weather) return null;

  let Icon = Sun;
  if (RAIN_CODES.includes(weather.code)) Icon = CloudRain;
  else if (SNOW_CODES.includes(weather.code)) Icon = Snowflake;
  else if (CLOUDY_CODES.includes(weather.code)) Icon = Cloud;

  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border text-foreground">
      <Icon className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs font-medium">{Math.round(weather.temp)}°C</span>
    </div>
  );
};

export default WeatherWidget;
