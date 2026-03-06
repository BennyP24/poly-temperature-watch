import { useQuery } from "@tanstack/react-query";

export interface CityWeather {
  currentTemp: number | null;
  highestRecorded: number | null;
  forecastHigh: number | null;
  yesterdayHigh: number | null;
  peakHour: number | null;
  currentHour: number;
  pastPeak: boolean;
  timezone: string;
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
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    enabled: cities.length > 0,
  });
}
