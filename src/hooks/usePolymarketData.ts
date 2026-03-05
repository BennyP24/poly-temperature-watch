import { useQuery } from "@tanstack/react-query";
import { fetchTemperatureMarkets, searchTemperatureMarkets, type ParsedTemperatureBet } from "@/lib/polymarket";

export function usePolymarketData() {
  return useQuery<ParsedTemperatureBet[]>({
    queryKey: ["polymarket-temperature"],
    queryFn: async () => {
      const [eventBets, marketBets] = await Promise.all([
        fetchTemperatureMarkets(),
        searchTemperatureMarkets(),
      ]);

      // Merge and deduplicate
      const seen = new Set<string>();
      const all: ParsedTemperatureBet[] = [];

      for (const bet of [...eventBets, ...marketBets]) {
        if (!seen.has(bet.id)) {
          seen.add(bet.id);
          all.push(bet);
        }
      }

      // Sort: new bets first, then by creation date
      return all.sort((a, b) => {
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
    refetchInterval: 60_000, // Poll every 60s
    staleTime: 30_000,
  });
}
