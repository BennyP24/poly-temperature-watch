import { useQuery } from "@tanstack/react-query";

export interface HourlyTemp {
  hour: number;
  tempF: number;
  tempC: number;
  isRecorded: boolean;
}

export interface DateWeather {
  highF: number | null;
  highC: number | null;
  forecastHighF: number | null;
  forecastHighC: number | null;
  peakHour: number | null;
  pastPeak: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  observedCoolingConfirmed: boolean;
  coolingStartHour: number | null;
  hourly: HourlyTemp[];
}

export interface CityWeather {
  currentTempF: number | null;
  currentTempC: number | null;
  highestRecordedF: number | null;
  highestRecordedC: number | null;
  forecastHighF: number | null;
  forecastHighC: number | null;
  peakHour: number | null;
  currentHour: number;
  pastPeak: boolean;
  observedCoolingConfirmed: boolean;
  coolingStartHour: number | null;
  timezone: string;
  dates?: Record<string, DateWeather>;
  error?: string;
}

export function useWeatherData(cities: string[]) {
  return useQuery<Record<string, CityWeather>>({
    queryKey: ["weather-data", cities.sort().join(",")],
    queryFn: async () => {
      if (cities.length === 0) return {};
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-data?cities=${encodeURIComponent(cities.join(","))}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      if (!response.ok) throw new Error(`Weather fetch failed: ${response.status}`);
      return response.json();
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: cities.length > 0,
  });
}
