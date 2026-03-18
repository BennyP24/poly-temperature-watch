import { useQuery } from "@tanstack/react-query";

export interface ResolutionStatus {
  currentTempF: number | null;
  currentTempC: number | null;
  observedHighF: number | null;
  observedHighC: number | null;
  isObserved: boolean;
  source: string;
  error?: string;
}

async function fetchResolutionStatus(url: string): Promise<ResolutionStatus> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolution-proxy?url=${encodeURIComponent(url)}`,
    {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    }
  );
  if (!response.ok) throw new Error(`Resolution proxy error: ${response.status}`);
  return response.json();
}

export function useResolutionData(resolutionUrls: Record<string, string>) {
  const urlEntries = Object.entries(resolutionUrls).filter(([, url]) => url.length > 0);
  const cacheKey = urlEntries.map(([id]) => id).sort().join(",");

  return useQuery<Record<string, ResolutionStatus>>({
    queryKey: ["resolution-data", cacheKey],
    queryFn: async () => {
      if (urlEntries.length === 0) return {};

      const probeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolution-proxy?url=${encodeURIComponent("https://www.wunderground.com")}`;
      try {
        const probe = await fetch(probeUrl, {
          method: "HEAD",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        });
        if (!probe.ok) throw new Error("probe failed");
      } catch {
        console.warn("[resolution] Supabase edge function unreachable, skipping batch");
        return {};
      }

      const results: Record<string, ResolutionStatus> = {};
      const batches: Promise<void>[] = [];

      for (const [eventId, url] of urlEntries) {
        batches.push(
          fetchResolutionStatus(url)
            .then((status) => { results[eventId] = status; })
            .catch(() => {
              results[eventId] = {
                currentTempF: null,
                currentTempC: null,
                observedHighF: null,
                observedHighC: null,
                isObserved: false,
                source: url,
                error: "Fetch failed",
              };
            })
        );
      }

      await Promise.all(batches);
      return results;
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 1,
    enabled: urlEntries.length > 0,
  });
}
