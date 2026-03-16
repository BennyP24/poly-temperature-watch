import { useQuery } from "@tanstack/react-query";

export interface MarketPrice {
  yesPrice: number;
  noPrice: number;
}

async function fetchMarketPrices(marketIds: string[]): Promise<Map<string, MarketPrice>> {
  if (marketIds.length === 0) return new Map();

  const params = new URLSearchParams();
  params.set("id", marketIds.join(","));
  params.set("limit", String(marketIds.length));

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/polymarket-proxy?endpoint=markets&params=${encodeURIComponent(params.toString())}`,
    {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    }
  );

  if (!response.ok) throw new Error(`Market prices error: ${response.status}`);
  const data = await response.json();

  const result = new Map<string, MarketPrice>();
  const markets = Array.isArray(data) ? data : [data];

  for (const m of markets) {
    if (!m?.id) continue;
    let yesPrice = 0;
    let noPrice = 0;
    try {
      const prices = JSON.parse(m.outcomePrices || "[0,0]");
      yesPrice = parseFloat(prices[0]) || 0;
      noPrice = parseFloat(prices[1]) || 0;
    } catch { /* noop */ }
    result.set(m.id, { yesPrice, noPrice });
  }

  return result;
}

export function useMarketPrices(marketIds: string[]) {
  const sortedIds = [...marketIds].sort();
  const cacheKey = sortedIds.join(",");

  return useQuery<Map<string, MarketPrice>>({
    queryKey: ["market-prices", cacheKey],
    queryFn: () => fetchMarketPrices(sortedIds),
    refetchInterval: 5_000,
    staleTime: 3_000,
    enabled: sortedIds.length > 0,
  });
}
