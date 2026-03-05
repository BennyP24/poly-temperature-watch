import { useQuery } from "@tanstack/react-query";
import { fetchTemperatureEvents, type TemperatureEvent } from "@/lib/polymarket";

export function usePolymarketData() {
  return useQuery<TemperatureEvent[]>({
    queryKey: ["polymarket-temperature"],
    queryFn: fetchTemperatureEvents,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });
}
