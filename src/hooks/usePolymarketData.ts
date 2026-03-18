import { useQuery } from "@tanstack/react-query";
import { fetchTemperatureEvents, type TemperatureEvent } from "@/lib/polymarket";

export function usePolymarketData(overrideIntervalMs?: number) {
  return useQuery<TemperatureEvent[]>({
    queryKey: ["polymarket-temperature"],
    queryFn: fetchTemperatureEvents,
    refetchInterval: overrideIntervalMs ?? 5_000,
    refetchIntervalInBackground: true,
    staleTime: 3_000,
    retry: 2,
    placeholderData: (prev) => prev,
  });
}
