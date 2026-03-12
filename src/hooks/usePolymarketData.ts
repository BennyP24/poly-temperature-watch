import { useQuery } from "@tanstack/react-query";
import { fetchTemperatureEvents, type TemperatureEvent } from "@/lib/polymarket";

export function usePolymarketData() {
  return useQuery<TemperatureEvent[]>({
    queryKey: ["polymarket-temperature"],
    queryFn: fetchTemperatureEvents,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    staleTime: 10_000,
    retry: 2,
  });
}
