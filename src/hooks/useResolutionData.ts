import { useQuery } from "@tanstack/react-query";

export interface ResolutionStatus {
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

      const results: Record<string, ResolutionStatus> = {};
      const batches: Promise<void>[] = [];

      for (const [eventId, url] of urlEntries) {
        batches.push(
          fetchResolutionStatus(url)
            .then((status) => { results[eventId] = status; })
            .catch(() => {
              results[eventId] = {
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
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: urlEntries.length > 0,
  });
}
